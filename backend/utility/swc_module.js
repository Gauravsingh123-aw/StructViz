const { extractInfo } = require("../info.js");
const swc = require("@swc/core");

async function swc_module(req, res) {
  try {
    const code = req.body; // assuming raw JS code string
    const ast = await swc.parse(code, {
      syntax: "ecmascript",
      jsx: true,
    });
    const final = extractInfo(ast, code);
    res.send({ message: "received", payload: final });
  } catch (err) {
    res.status(500).send({ error: "Parsing failed", details: err.message });
  }
}

module.exports = { swc_module };