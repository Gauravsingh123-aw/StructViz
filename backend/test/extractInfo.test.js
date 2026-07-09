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
