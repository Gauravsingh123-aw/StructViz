function extractInfo(ast, sourceCode) {
  const insights = [];
  const contextStack = [];

  function currentContext() {
    return contextStack.length ? contextStack[contextStack.length - 1] : "global";
  }

  function byteOffsetToLineColumn(code, offset) {
    const lines = code.slice(0, offset).split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    return { line, column };
  }

  function getLocation(span) {
    if (!span || typeof span.start !== "number") return null;
    return byteOffsetToLineColumn(sourceCode, span.start);
  }

  function getCalleeName(expr) {
    if (!expr || typeof expr !== "object") return "unknown";

    if (expr.type === "Identifier") {
      return expr.value;
    }

    if (expr.type === "MemberExpression") {
      const objectName = getCalleeName(expr.object);
      const propertyName = expr.property?.value || "unknown";
      return `${objectName}.${propertyName}`;
    }

    if (expr.type === "CallExpression") {
      return getCalleeName(expr.callee);
    }

    return "unknown";
  }

  function walk(n) {
    if (!n || typeof n !== "object") return;

    switch (n.type) {
      case "VariableDeclaration":
        n.declarations.forEach(decl => {
          const name = decl.id?.value;
          const initType = decl.init?.type;
          const info = {
            type: "Variable",
            name,
            init: initType,
            context: currentContext(),
            location: getLocation(n.span),
          };

          if (initType === "ArrowFunctionExpression") {
            info.params = decl.init.params.map(p => p.value);
          }

          insights.push(info);
        });
        break;

      case "FunctionDeclaration":
      case "ArrowFunctionExpression":
      case "FunctionExpression":
        const funcName = n.id?.value || "anonymous";
        const params = n.params.map(p => p.value);
        insights.push({
          type: "FunctionDefinition",
          name: funcName,
          params,
          context: currentContext(),
          location: getLocation(n.span),
        });
        contextStack.push(funcName);
        break;

      case "CallExpression":
        insights.push({
          type: "FunctionCall",
          callee: getCalleeName(n.callee),
          args: n.arguments?.map(arg => arg.expression?.type || "unknown"),
          context: currentContext(),
          location: getLocation(n.span),
        });
        break;

      case "BinaryExpression":
        insights.push({
          type: "BinaryExpression",
          operator: n.operator,
          left: n.left?.type,
          right: n.right?.type,
          context: currentContext(),
          location: getLocation(n.span),
        });
        break;

      case "Identifier":
        insights.push({
          type: "Identifier",
          name: n.value,
          context: currentContext(),
          location: getLocation(n.span),
        });
        break;

      case "StringLiteral":
        insights.push({
          type: "StringLiteral",
          value: n.value,
          context: currentContext(),
          location: getLocation(n.span),
        });
        break;

      default:
        for (const key in n) {
          const child = n[key];
          if (Array.isArray(child)) {
            child.forEach(c => walk(c));
          } else if (typeof child === "object" && child !== null) {
            walk(child);
          }
        }
    }

    if (["FunctionDeclaration", "ArrowFunctionExpression", "FunctionExpression"].includes(n.type)) {
      contextStack.pop();
    }
  }

  walk(ast);
  return insights;
}

module.exports = { extractInfo };