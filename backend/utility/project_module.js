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

  insights.push(...dependencies);

  return {
    insights,
    meta: {
      fileCount: fileResults.length,
      insightCount: insights.length,
      dependencyCount: dependencies.length,
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
  normalizeProjectPath,
  resolveImportPath,
  project_module,
};
