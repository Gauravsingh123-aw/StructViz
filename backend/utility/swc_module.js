const { extractInfo } = require("../info.js");
const swc = require("@swc/core");

const PARSER_CANDIDATES = [
  { label: "typescript-tsx", options: { syntax: "typescript", tsx: true, decorators: true } },
  { label: "typescript", options: { syntax: "typescript", tsx: false, decorators: true } },
  { label: "javascript-jsx", options: { syntax: "ecmascript", jsx: true } },
  { label: "javascript", options: { syntax: "ecmascript", jsx: false } },
];

async function parseCode(code, preferredSyntax) {
  const normalizedPreference = String(preferredSyntax || "").toLowerCase();
  const candidates = normalizedPreference
    ? PARSER_CANDIDATES.filter(candidate => candidate.label === normalizedPreference)
    : PARSER_CANDIDATES;

  const attempts = candidates.length ? candidates : PARSER_CANDIDATES;
  const errors = [];

  for (const candidate of attempts) {
    try {
      const ast = await swc.parse(code, candidate.options);
      return { ast, parser: candidate.label };
    } catch (err) {
      errors.push(`${candidate.label}: ${err.message}`);
    }
  }

  const err = new Error(errors.join("\n"));
  err.parseErrors = errors;
  throw err;
}

async function swc_module(req, res) {
  try {
    const code = req.body; // assuming raw JS code string
    if (typeof code !== "string" || code.trim().length === 0) {
      return res.status(400).send({ error: "No code supplied" });
    }

    const { ast, parser } = await parseCode(code, req.query?.syntax);
    const final = extractInfo(ast, code);
    res.send({ message: "received", payload: final, meta: { parser, insightCount: final.length } });
  } catch (err) {
    res.status(400).send({ error: "Parsing failed", details: err.parseErrors || err.message });
  }
}

module.exports = { swc_module, parseCode };
