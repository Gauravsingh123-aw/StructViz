const path = require("node:path");

const { extractInfo } = require("../info.js");
const { parseCode } = require("./swc_module.js");

const EXTENSIONS = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const INDEX_FILES = ["/index.ts", "/index.tsx", "/index.js", "/index.jsx"];

function normalizeProjectPath(filePath) {
  const normalized = path.posix.normalize(String(filePath || "").replace(/\\/g, "/"));
  return normalized.replace(/^\.\//, "");
}

function fileSymbolPrefix(filePath) {
  return `file:${normalizeProjectPath(filePath).replace(/[^\w.$/-]+/g, "_")}`;
}

function prefixSymbolId(filePath, symbolId) {
  if (!symbolId) return symbolId;
  if (String(symbolId).startsWith("file:")) return symbolId;
  return `${fileSymbolPrefix(filePath)}:${symbolId}`;
}

function rewriteSymbolIds(filePath, insight) {
  const next = { ...insight, filePath: normalizeProjectPath(filePath), moduleId: fileSymbolPrefix(filePath) };
  const fields = ["symbolId", "resolvedSymbolId", "targetSymbolId", "superSymbolId"];

  fields.forEach(field => {
    if (next[field]) next[field] = prefixSymbolId(filePath, next[field]);
  });

  if (Array.isArray(next.symbolIds)) {
    next.symbolIds = next.symbolIds.map(symbolId => prefixSymbolId(filePath, symbolId));
  }

  if (Array.isArray(next.specifiers)) {
    next.specifiers = next.specifiers.map(specifier => ({
      ...specifier,
      symbolId: prefixSymbolId(filePath, specifier.symbolId),
    }));
  }

  return next;
}

function isRelativeImport(source) {
  return typeof source === "string" && (source.startsWith("./") || source.startsWith("../"));
}

function resolveImportPath(fromPath, source, fileMap) {
  if (!isRelativeImport(source)) return null;

  const baseDir = path.posix.dirname(normalizeProjectPath(fromPath));
  const requested = normalizeProjectPath(path.posix.join(baseDir, source));
  const candidates = [
    ...EXTENSIONS.map(ext => `${requested}${ext}`),
    ...INDEX_FILES.map(indexFile => `${requested}${indexFile}`),
  ];

  return candidates.find(candidate => fileMap.has(candidate)) || null;
}

function normalizeFiles(payload) {
  const rawFiles = Array.isArray(payload?.files) ? payload.files : [];
  return rawFiles
    .map(file => ({
      path: normalizeProjectPath(file.path || file.filePath || file.name),
      code: typeof file.code === "string" ? file.code : file.content,
    }))
    .filter(file => file.path && typeof file.code === "string");
}

function exportedSymbolsForFile(insights) {
  const exportsByName = new Map();

  insights
    .filter(insight => insight.type === "Export")
    .forEach(exportInsight => {
      (exportInsight.names || []).forEach((name, index) => {
        const symbolId = exportInsight.symbolIds?.[index];
        if (name && symbolId) exportsByName.set(name, symbolId);
      });
    });

  return exportsByName;
}

function resolveImportedName(specifier) {
  if (specifier.kind === "default") return "default";
  if (specifier.kind === "namespace") return "*";
  return specifier.imported || specifier.local;
}

function findModuleCycles(filePaths, dependencies) {
  const adjacency = new Map(filePaths.map(filePath => [filePath, []]));
  const cycles = [];
  const seen = new Set();

  dependencies
    .filter(dependency => dependency.resolved && dependency.to)
    .forEach(dependency => {
      adjacency.get(dependency.from)?.push(dependency.to);
    });

  function canonicalCycle(cycle) {
    const nodes = cycle.slice(0, -1);
    let best = nodes;

    for (let index = 1; index < nodes.length; index++) {
      const rotated = nodes.slice(index).concat(nodes.slice(0, index));
      if (rotated.join("\0") < best.join("\0")) best = rotated;
    }

    return best.concat(best[0]);
  }

  function visit(node, stack = []) {
    const existingIndex = stack.indexOf(node);
    if (existingIndex !== -1) {
      const cycle = canonicalCycle(stack.slice(existingIndex).concat(node));
      const key = cycle.join(" -> ");
      if (!seen.has(key)) {
        seen.add(key);
        cycles.push(cycle);
      }
      return;
    }

    stack.push(node);
    (adjacency.get(node) || []).forEach(next => visit(next, stack.slice()));
  }

  filePaths.forEach(filePath => visit(filePath));
  return cycles;
}

function buildProjectInsights(fileResults, dependencies, importTargetByLocalSymbol) {
  const filePaths = fileResults.map(file => file.path);
  const incomingCounts = new Map(filePaths.map(filePath => [filePath, 0]));
  const outgoingCounts = new Map(filePaths.map(filePath => [filePath, 0]));
  const importedExportSymbols = new Set(importTargetByLocalSymbol.values());
  const projectInsights = [];

  dependencies.forEach(dependency => {
    if (!dependency.resolved || !dependency.to) return;
    outgoingCounts.set(dependency.from, (outgoingCounts.get(dependency.from) || 0) + 1);
    incomingCounts.set(dependency.to, (incomingCounts.get(dependency.to) || 0) + 1);
  });

  filePaths
    .filter(filePath => (incomingCounts.get(filePath) || 0) === 0)
    .forEach(filePath => {
      projectInsights.push({
        type: "EntryPoint",
        path: filePath,
        reason: "no-incoming-imports",
        context: "project",
        location: null,
        span: null,
      });
    });

  findModuleCycles(filePaths, dependencies).forEach((cycle, index) => {
    projectInsights.push({
      type: "ModuleCycle",
      cycle,
      size: Math.max(0, cycle.length - 1),
      cycleId: `cycle:${index + 1}`,
      context: "project",
      location: null,
      span: null,
    });
  });

  fileResults.forEach(fileResult => {
    fileResult.insights
      .filter(insight => insight.type === "Export")
      .forEach(exportInsight => {
        (exportInsight.names || []).forEach((name, index) => {
          const symbolId = exportInsight.symbolIds?.[index];
          if (!symbolId || importedExportSymbols.has(symbolId)) return;
          projectInsights.push({
            type: "DeadExport",
            name,
            symbolId,
            filePath: fileResult.path,
            context: "project",
            location: exportInsight.location,
            span: exportInsight.span,
          });
        });
      });
  });

  fileResults.forEach(fileResult => {
    const functions = fileResult.insights.filter(insight => insight.type === "FunctionDefinition").length;
    const classes = fileResult.insights.filter(insight => insight.type === "Class").length;
    const calls = fileResult.insights.filter(insight => insight.type === "FunctionCall").length;
    const exports = fileResult.insights.filter(insight => insight.type === "Export").reduce((count, insight) => count + (insight.names || []).length, 0);
    const incoming = incomingCounts.get(fileResult.path) || 0;
    const outgoing = outgoingCounts.get(fileResult.path) || 0;
    const score = incoming * 3 + outgoing * 2 + functions + classes * 2 + Math.ceil(calls / 2) + exports;

    if (score === 0) return;

    projectInsights.push({
      type: "Hotspot",
      path: fileResult.path,
      score,
      incoming,
      outgoing,
      functions,
      classes,
      calls,
      exports,
      context: "project",
      location: null,
      span: null,
    });
  });

  return projectInsights;
}

async function analyzeProject(payload) {
  const files = normalizeFiles(payload);

  if (!files.length) {
    const err = new Error("Project analysis requires files: [{ path, code }] or [{ path, content }]");
    err.statusCode = 400;
    throw err;
  }

  const fileMap = new Map(files.map(file => [file.path, file]));
  const fileResults = [];
  const insights = [];
  const parseErrors = [];

  for (const file of files) {
    try {
      const { ast, parser } = await parseCode(file.code);
      const fileInsights = extractInfo(ast, file.code).map(insight => rewriteSymbolIds(file.path, insight));
      fileResults.push({ ...file, parser, insights: fileInsights, exports: exportedSymbolsForFile(fileInsights) });
      insights.push({
        type: "File",
        path: file.path,
        moduleId: fileSymbolPrefix(file.path),
        parser,
        context: "project",
        location: null,
        span: null,
      });
      insights.push(...fileInsights);
    } catch (err) {
      parseErrors.push({ path: file.path, error: err.parseErrors || err.message });
    }
  }

  if (parseErrors.length) {
    const err = new Error("One or more files failed to parse");
    err.statusCode = 400;
    err.parseErrors = parseErrors;
    throw err;
  }

  const importTargetByLocalSymbol = new Map();
  const dependencies = [];

  fileResults.forEach(fileResult => {
    fileResult.insights
      .filter(insight => insight.type === "Import")
      .forEach(importInsight => {
        const targetPath = resolveImportPath(fileResult.path, importInsight.source, fileMap);
        const targetFile = targetPath ? fileResults.find(result => result.path === targetPath) : null;

        dependencies.push({
          type: "ModuleDependency",
          from: fileResult.path,
          to: targetPath,
          source: importInsight.source,
          resolved: !!targetPath,
          external: !isRelativeImport(importInsight.source),
          context: "project",
          location: importInsight.location,
          span: importInsight.span,
        });

        if (!targetFile) return;

        (importInsight.specifiers || []).forEach(specifier => {
          const importedName = resolveImportedName(specifier);
          const targetSymbolId = targetFile.exports.get(importedName) || targetFile.exports.get("default");

          if (specifier.symbolId && targetSymbolId) {
            specifier.resolvedSymbolId = targetSymbolId;
            importTargetByLocalSymbol.set(specifier.symbolId, targetSymbolId);
          }
        });
      });
  });

  insights.forEach(insight => {
    if (insight.targetSymbolId && importTargetByLocalSymbol.has(insight.targetSymbolId)) {
      insight.localTargetSymbolId = insight.targetSymbolId;
      insight.targetSymbolId = importTargetByLocalSymbol.get(insight.targetSymbolId);
    }
    if (insight.resolvedSymbolId && importTargetByLocalSymbol.has(insight.resolvedSymbolId)) {
      insight.localResolvedSymbolId = insight.resolvedSymbolId;
      insight.resolvedSymbolId = importTargetByLocalSymbol.get(insight.resolvedSymbolId);
    }
  });

  const projectInsights = buildProjectInsights(fileResults, dependencies, importTargetByLocalSymbol);

  insights.push(...dependencies, ...projectInsights);

  return {
    insights,
    meta: {
      fileCount: fileResults.length,
      insightCount: insights.length,
      dependencyCount: dependencies.length,
      cycleCount: projectInsights.filter(insight => insight.type === "ModuleCycle").length,
      deadExportCount: projectInsights.filter(insight => insight.type === "DeadExport").length,
      entryPointCount: projectInsights.filter(insight => insight.type === "EntryPoint").length,
    },
  };
}

async function project_module(req, res) {
  try {
    const result = await analyzeProject(req.body);
    res.send({ message: "received", payload: result.insights, meta: result.meta });
  } catch (err) {
    res.status(err.statusCode || 400).send({ error: "Project analysis failed", details: err.parseErrors || err.message });
  }
}

module.exports = {
  analyzeProject,
  findModuleCycles,
  normalizeProjectPath,
  resolveImportPath,
  project_module,
};
