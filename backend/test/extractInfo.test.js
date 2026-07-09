const assert = require("node:assert/strict");
const test = require("node:test");

const { extractInfo } = require("../info");
const { parseCode } = require("../utility/swc_module");

async function analyze(code) {
  const { ast, parser } = await parseCode(code);
  return { parser, insights: extractInfo(ast, code) };
}

test("parses TypeScript declarations and values", async () => {
  const { insights } = await analyze('type User = { id: string }; const x: User = { id: "1" };');

  assert.ok(insights.some(insight => insight.type === "TypeAlias" && insight.name === "User"));
  assert.ok(insights.some(insight => insight.type === "Variable" && insight.name === "x"));
});

test("normalizes SWC spans across repeated parses", async () => {
  await analyze("function first() {}");
  const { insights } = await analyze("const x = 1;\nconst y = 2;");

  const x = insights.find(insight => insight.type === "Variable" && insight.name === "x");
  const y = insights.find(insight => insight.type === "Variable" && insight.name === "y");

  assert.deepEqual(x.location, { line: 1, column: 7 });
  assert.deepEqual(y.location, { line: 2, column: 7 });
});

test("walks inside function bodies with the correct context", async () => {
  const { insights } = await analyze("function add(a,b){ const sum=a+b; return log(sum); }\nadd(1,2);");

  assert.ok(insights.some(insight => insight.type === "Variable" && insight.name === "sum" && insight.context === "add"));
  assert.ok(insights.some(insight => insight.type === "Return" && insight.context === "add"));
  assert.ok(insights.some(insight => insight.type === "FunctionCall" && insight.callee === "log" && insight.context === "add"));
  assert.ok(insights.some(insight => insight.type === "FunctionCall" && insight.callee === "add" && insight.context === "global"));
});

test("extracts class methods as function definitions", async () => {
  const { insights } = await analyze("class A extends B { method(x){ return this.f(x); } static s(){} }");

  const classInsight = insights.find(insight => insight.type === "Class" && insight.name === "A");
  assert.ok(classInsight);
  assert.deepEqual(classInsight.methods.map(method => method.name), ["method", "s"]);
  assert.ok(insights.some(insight => insight.type === "FunctionDefinition" && insight.name === "A.method" && insight.context === "A"));
  assert.ok(insights.some(insight => insight.type === "FunctionCall" && insight.callee === "this.f" && insight.context === "A.method"));
});

test("preserves exported declaration names", async () => {
  const { insights } = await analyze('import { x as y } from "m"; export function f(){ return y(); }');

  assert.ok(insights.some(insight => insight.type === "Import" && insight.source === "m"));
  assert.ok(insights.some(insight => insight.type === "Export" && insight.names.includes("f")));
  assert.ok(insights.some(insight => insight.type === "FunctionDefinition" && insight.name === "f"));
});

test("does not leak internal span markers into API insights", async () => {
  const { insights } = await analyze("const x = 1;");

  assert.equal(Object.prototype.hasOwnProperty.call(insights[0], "__span"), false);
});

test("resolves calls to declarations in the same scope even before declaration order", async () => {
  const { insights } = await analyze("foo();\nfunction foo(){ return 1; }");

  const definition = insights.find(insight => insight.type === "FunctionDefinition" && insight.name === "foo");
  const call = insights.find(insight => insight.type === "FunctionCall" && insight.callee === "foo");

  assert.ok(definition.symbolId);
  assert.equal(call.targetSymbolId, definition.symbolId);
});

test("resolves shadowed parameter calls to the nearest scope", async () => {
  const { insights } = await analyze("function foo(){ return 1; }\nfunction wrap(foo){ return foo(); }");

  const globalFoo = insights.find(insight => insight.type === "FunctionDefinition" && insight.name === "foo");
  const wrappedCall = insights.find(insight => insight.type === "FunctionCall" && insight.callee === "foo" && insight.context === "wrap");

  assert.ok(wrappedCall.targetSymbolId.includes("parameter:foo"));
  assert.notEqual(wrappedCall.targetSymbolId, globalFoo.symbolId);
});

test("resolves calls through imported bindings", async () => {
  const { insights } = await analyze('import { parse as parseCode } from "pkg";\nparseCode(source);');

  const importInsight = insights.find(insight => insight.type === "Import");
  const importedSymbolId = importInsight.specifiers[0].symbolId;
  const call = insights.find(insight => insight.type === "FunctionCall" && insight.callee === "parseCode");

  assert.ok(importedSymbolId);
  assert.equal(call.targetSymbolId, importedSymbolId);
});

test("adds symbol IDs to exported declarations", async () => {
  const { insights } = await analyze("export function f(){ return 1; }");

  const definition = insights.find(insight => insight.type === "FunctionDefinition" && insight.name === "f");
  const exportInsight = insights.find(insight => insight.type === "Export");

  assert.deepEqual(exportInsight.symbolIds, [definition.symbolId]);
});

test("resolves identifier references to local variables", async () => {
  const { insights } = await analyze("function f(){ const answer = 42; return answer; }");

  const variable = insights.find(insight => insight.type === "Variable" && insight.name === "answer");
  const reference = insights.find(insight => insight.type === "Identifier" && insight.name === "answer");

  assert.equal(reference.resolvedSymbolId, variable.symbolId);
});
