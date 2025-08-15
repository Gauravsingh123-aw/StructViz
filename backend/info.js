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

  function getPropertyName(prop) {
    if (!prop || typeof prop !== 'object') return 'unknown';
    if (prop.type === 'Identifier') return prop.value;
    if (prop.type === 'PrivateName') return `#${prop.id?.value || 'unknown'}`;
    if (prop.type === 'StringLiteral') return prop.value;
    if (prop.type === 'NumericLiteral') return String(prop.value);
    if (prop.type === 'Computed' && prop.expression) return `[${describeExpression(prop.expression)}]`;
    return 'unknown';
  }

  function describePattern(pat, depth = 0) {
    if (!pat || typeof pat !== 'object') return 'param';
    switch (pat.type) {
      case 'Identifier':
        return pat.value;
      case 'RestElement':
        return `...${describePattern(pat.argument, depth + 1)}`;
      case 'AssignmentPattern':
        return `${describePattern(pat.left, depth + 1)}=${describeExpression(pat.right, depth + 1)}`;
      case 'ArrayPattern':
        return `[${(pat.elements || []).map(e => (e ? describePattern(e, depth + 1) : '')).join(', ')}]`;
      case 'ObjectPattern':
        return `{ … }`;
      default:
        // SWC Parameter node often has shape { type: 'Parameter', pat: { ... } }
        if (pat.pat) return describePattern(pat.pat, depth + 1);
        return 'param';
    }
  }

  function paramName(p) {
    if (!p || typeof p !== 'object') return 'param';
    if (p.type === 'Parameter' && p.pat) return describePattern(p.pat);
    return describePattern(p);
  }

  function getFunctionName(n) {
    return (
      n?.id?.value ||
      n?.identifier?.value ||
      n?.ident?.value ||
      (n?.id && (n.id.name || n.id.value)) ||
      'anonymous'
    );
  }

  function describeExpression(expr, depth = 0) {
    if (!expr || typeof expr !== 'object') return 'unknown';
    if (depth > 2) return '…';
    switch (expr.type) {
      case 'Identifier':
        return expr.value;
      case 'ThisExpression':
        return 'this';
      case 'Super':
        return 'super';
      case 'NullLiteral':
        return 'null';
      case 'BooleanLiteral':
        return String(expr.value);
      case 'StringLiteral':
        return JSON.stringify(expr.value);
      case 'NumericLiteral':
        return String(expr.value);
      case 'BigIntLiteral':
        return `${expr.value}n`;
      case 'TemplateLiteral':
        return '`' + (expr.quasis?.map(q => q.cooked).join('${…}') || '') + '`';
      case 'ArrayExpression':
        return `Array(${expr.elements?.length || 0})`;
      case 'ObjectExpression': {
        const keys = (expr.properties || []).map(p => {
          if (p.type === 'KeyValueProperty') return getPropertyName(p.key);
          if (p.type === 'Identifier') return p.value;
          return '…';
        });
        return `{ ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', …' : ''} }`;
      }
      case 'MemberExpression': {
        const objectName = describeExpression(expr.object, depth + 1);
        const propName = getPropertyName(expr.property);
        return `${objectName}.${propName}`;
      }
      case 'CallExpression':
        return `${describeExpression(expr.callee, depth + 1)}(${(expr.arguments || []).map(a => describeArgument(a, depth + 1)).join(', ')})`;
      case 'NewExpression':
        return `new ${describeExpression(expr.callee, depth + 1)}(${(expr.arguments || []).map(a => describeArgument(a, depth + 1)).join(', ')})`;
      case 'ArrowFunctionExpression':
        return `(${(expr.params || []).map(paramName).join(', ')}) => …`;
      case 'FunctionExpression':
        return `function ${getFunctionName(expr)}(${(expr.params || []).map(paramName).join(', ')})`;
      case 'UnaryExpression':
        return `${expr.operator}${describeExpression(expr.argument, depth + 1)}`;
      case 'BinaryExpression':
        return `${describeExpression(expr.left, depth + 1)} ${expr.operator} ${describeExpression(expr.right, depth + 1)}`;
      case 'ConditionalExpression':
        return `${describeExpression(expr.test, depth + 1)} ? ${describeExpression(expr.consequent, depth + 1)} : ${describeExpression(expr.alternate, depth + 1)}`;
      default:
        return expr.type || 'unknown';
    }
  }

  function unwrapArgExpression(arg) {
    if (!arg || typeof arg !== 'object') return null;
    if ('expression' in arg) return arg.expression;
    if ('expr' in arg) return arg.expr;
    if (arg.type === 'SpreadElement') return arg.argument || arg.expr || null;
    return arg;
  }

  function describeArgument(arg, depth = 0) {
    if (!arg) return 'unknown';
    const isSpread = !!(arg && (arg.spread || arg.type === 'SpreadElement'));
    const expr = unwrapArgExpression(arg) || arg;
    const value = describeExpression(expr, depth + 1);
    return isSpread ? `...${value}` : value;
  }

  function getCalleeName(expr) {
    if (!expr || typeof expr !== "object") return "unknown";
    if (expr.type === "Identifier") {
      return expr.value;
    }
    if (expr.type === "MemberExpression") {
      const objectName = describeExpression(expr.object);
      const propertyName = getPropertyName(expr.property);
      return `${objectName}.${propertyName}`;
    }
    if (expr.type === "CallExpression") {
      return getCalleeName(expr.callee);
    }
    return "unknown";
  }

  function computeFunctionMetrics(node) {
    const metrics = { branches: 0, loops: 0, returns: 0, calls: 0, statements: 0, usesThis: false };
    function walkBody(n) {
      if (!n || typeof n !== 'object') return;
      switch (n.type) {
        case 'IfStatement':
        case 'ConditionalExpression':
        case 'SwitchStatement':
        case 'SwitchCase':
        case 'LogicalExpression':
          metrics.branches++;
          break;
        case 'ForStatement':
        case 'ForOfStatement':
        case 'ForInStatement':
        case 'WhileStatement':
        case 'DoWhileStatement':
          metrics.loops++;
          break;
        case 'ReturnStatement':
          metrics.returns++;
          break;
        case 'CallExpression':
          metrics.calls++;
          break;
        case 'ThisExpression':
          metrics.usesThis = true;
          break;
      }
      if (Array.isArray(n.body)) metrics.statements += n.body.length;
      for (const k in n) {
        const c = n[k];
        if (Array.isArray(c)) c.forEach(walkBody);
        else if (c && typeof c === 'object') walkBody(c);
      }
    }
    if (node.body) walkBody(node.body);
    return metrics;
  }

  function walk(n) {
    if (!n || typeof n !== "object") return;

    switch (n.type) {
      case "VariableDeclaration":
        n.declarations.forEach(decl => {
          const idNode = decl.id;
          const name = idNode?.value || (idNode?.type ? describePattern(idNode) : undefined);
          const initNode = decl.init;
          const initType = initNode?.type;
          const info = {
            type: "Variable",
            name,
            init: initNode ? describeExpression(initNode) : undefined,
            context: currentContext(),
            location: getLocation(n.span),
            kind: n.kind || undefined,
          };
          if (initType === "ArrowFunctionExpression") {
            info.params = (initNode.params || []).map(paramName);
            info.isAsync = !!initNode.async;
          }
          insights.push(info);
        });
        break;

      case "FunctionDeclaration":
      case "ArrowFunctionExpression":
      case "FunctionExpression": {
        const funcName = getFunctionName(n);
        const params = (n.params || []).map(paramName);
        const metrics = computeFunctionMetrics(n);
        insights.push({
          type: "FunctionDefinition",
          name: funcName,
          params,
          context: currentContext(),
          location: getLocation(n.span),
          metrics,
          async: !!n.async,
          generator: !!n.generator,
        });
        contextStack.push(funcName);
        break;
      }

      case "CallExpression": {
        const argsDesc = (n.arguments || []).map(a => describeArgument(a));
        insights.push({
          type: "FunctionCall",
          callee: getCalleeName(n.callee),
          args: argsDesc,
          context: currentContext(),
          location: getLocation(n.span),
          argumentCount: argsDesc.length,
        });
        break;
      }

      case "BinaryExpression":
        insights.push({
          type: "BinaryExpression",
          operator: n.operator,
          left: describeExpression(n.left),
          right: describeExpression(n.right),
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