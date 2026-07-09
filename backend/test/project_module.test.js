const assert = require("node:assert/strict");
const test = require("node:test");

const { analyzeProject, normalizeProjectPath, resolveImportPath } = require("../utility/project_module");

test("normalizes project paths to stable POSIX paths", () => {
  assert.equal(normalizeProjectPath(".\\src\\app.ts"), "src/app.ts");
  assert.equal(normalizeProjectPath("./src/../src/app.ts"), "src/app.ts");
});

test("resolves relative imports with common source extensions", () => {
  const fileMap = new Map([
    ["src/math.ts", {}],
    ["src/app.ts", {}],
  ]);

  assert.equal(resolveImportPath("src/app.ts", "./math", fileMap), "src/math.ts");
  assert.equal(resolveImportPath("src/app.ts", "react", fileMap), null);
});

test("analyzes files and emits module dependencies", async () => {
  const result = await analyzeProject({
    files: [
      { path: "src/math.ts", code: "export function add(a:number,b:number){ return a+b; }" },
      { path: "src/app.ts", code: 'import { add } from "./math"; export const result = add(1,2);' },
    ],
  });

  const dependency = result.insights.find(insight => insight.type === "ModuleDependency");
  const addDefinition = result.insights.find(insight => insight.type === "FunctionDefinition" && insight.filePath === "src/math.ts" && insight.name === "add");
  const addCall = result.insights.find(insight => insight.type === "FunctionCall" && insight.filePath === "src/app.ts" && insight.callee === "add");
  const exportedResult = result.insights.find(insight => insight.type === "Export" && insight.filePath === "src/app.ts");

  assert.deepEqual(
    { from: dependency.from, to: dependency.to, resolved: dependency.resolved },
    { from: "src/app.ts", to: "src/math.ts", resolved: true }
  );
  assert.equal(addCall.targetSymbolId, addDefinition.symbolId);
  assert.ok(exportedResult.symbolIds[0].includes("variable:result"));
  assert.equal(result.meta.fileCount, 2);
  assert.equal(result.meta.dependencyCount, 1);
});

test("resolves default imports to default exports", async () => {
  const result = await analyzeProject({
    files: [
      { path: "src/factory.ts", code: "export default function make(){ return 1; }" },
      { path: "src/app.ts", code: 'import make from "./factory"; make();' },
    ],
  });

  const definition = result.insights.find(insight => insight.type === "FunctionDefinition" && insight.name === "make");
  const call = result.insights.find(insight => insight.type === "FunctionCall" && insight.callee === "make");
  const importInsight = result.insights.find(insight => insight.type === "Import");

  assert.equal(importInsight.specifiers[0].resolvedSymbolId, definition.symbolId);
  assert.equal(call.targetSymbolId, definition.symbolId);
});

test("keeps unresolved external imports as external dependencies", async () => {
  const result = await analyzeProject({
    files: [
      { path: "src/app.ts", code: 'import React from "react"; React.createElement("div");' },
    ],
  });

  const dependency = result.insights.find(insight => insight.type === "ModuleDependency");
  const call = result.insights.find(insight => insight.type === "FunctionCall" && insight.callee === "React.createElement");

  assert.equal(dependency.to, null);
  assert.equal(dependency.external, true);
  assert.equal(call.targetSymbolId, undefined);
});
