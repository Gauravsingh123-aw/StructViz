function extractInfo(ast, sourceCode) {
  const insights = [];
  const contextStack = [];
  const spanBase = typeof ast?.span?.start === "number" ? ast.span.start : 1;

  function currentContext() {
    return contextStack.length ? contextStack[contextStack.length - 1] : "global";
  }

  function isNode(value) {
    return value && typeof value === "object" && typeof value.type === "string";
  }

  function toSourceOffset(position) {
    if (typeof position !== "number") return 0;
    return Math.max(0, Math.min(sourceCode.length, position - spanBase));
  }

  function offsetToLineColumn(offset) {
    const lines = sourceCode.slice(0, offset).split("\n");
    return { line: lines.length, column: lines[lines.length - 1].length + 1 };
  }

  function getLocation(span) {
    if (!span || typeof span.start !== "number") return null;
    return offsetToLineColumn(toSourceOffset(span.start));
  }

  function getSpanInfo(span) {
    if (!span || typeof span.start !== "number" || typeof span.end !== "number") return null;
    const start = offsetToLineColumn(toSourceOffset(span.start));
    const end = offsetToLineColumn(toSourceOffset(span.end));
    return { start, end, lines: Math.max(1, end.line - start.line + 1) };
  }

  function getPropertyName(prop) {
    if (!prop || typeof prop !== "object") return "unknown";
    if (prop.type === "Identifier") return prop.value;
    if (prop.type === "PrivateName") return `#${prop.id?.value || "unknown"}`;
    if (prop.type === "StringLiteral") return prop.value;
    if (prop.type === "NumericLiteral") return String(prop.value);
    if (prop.type === "Computed" && prop.expression) return `[${describeExpression(prop.expression)}]`;
    return "unknown";
  }

  function describePattern(pattern, depth = 0) {
    if (!pattern || typeof pattern !== "object") return "param";
    if (depth > 2) return "...";

    switch (pattern.type) {
      case "Identifier":
        return pattern.value;
      case "RestElement":
        return `...${describePattern(pattern.argument, depth + 1)}`;
      case "AssignmentPattern":
        return `${describePattern(pattern.left, depth + 1)}=${describeExpression(pattern.right, depth + 1)}`;
      case "ArrayPattern":
        return `[${(pattern.elements || []).map(item => item ? describePattern(item, depth + 1) : "").join(", ")}]`;
      case "ObjectPattern":
        return "{ ... }";
      default:
        if (pattern.pat) return describePattern(pattern.pat, depth + 1);
        return pattern.type || "param";
    }
  }

  function paramName(param) {
    if (!param || typeof param !== "object") return "param";
    if (param.type === "Parameter" && param.pat) return describePattern(param.pat);
    return describePattern(param);
  }

  function getFunctionName(node, fallback = "anonymous") {
    return (
      node?.identifier?.value ||
      node?.id?.value ||
      node?.ident?.value ||
      node?.key?.value ||
      node?.id?.name ||
      fallback
    );
  }

  function describeExpression(expr, depth = 0) {
    if (!expr || typeof expr !== "object") return "unknown";
    if (depth > 2) return "...";

    switch (expr.type) {
      case "Identifier":
        return expr.value;
      case "ThisExpression":
        return "this";
      case "Super":
        return "super";
      case "NullLiteral":
        return "null";
      case "BooleanLiteral":
        return String(expr.value);
      case "StringLiteral":
        return JSON.stringify(expr.value);
      case "NumericLiteral":
        return String(expr.value);
      case "BigIntLiteral":
        return `${expr.value}n`;
      case "TemplateLiteral":
        return "`" + (expr.quasis?.map(part => part.cooked).join("${...}") || "") + "`";
      case "ArrayExpression":
        return `Array(${expr.elements?.length || 0})`;
      case "ObjectExpression": {
        const keys = (expr.properties || []).map(prop => {
          if (prop.type === "KeyValueProperty") return getPropertyName(prop.key);
          if (prop.type === "Identifier") return prop.value;
          return "...";
        });
        return `{ ${keys.slice(0, 3).join(", ")}${keys.length > 3 ? ", ..." : ""} }`;
      }
      case "MemberExpression":
        return `${describeExpression(expr.object, depth + 1)}.${getPropertyName(expr.property)}`;
      case "CallExpression":
        return `${describeExpression(expr.callee, depth + 1)}(${(expr.arguments || []).map(arg => describeArgument(arg, depth + 1)).join(", ")})`;
      case "NewExpression":
        return `new ${describeExpression(expr.callee, depth + 1)}(${(expr.arguments || []).map(arg => describeArgument(arg, depth + 1)).join(", ")})`;
      case "ArrowFunctionExpression":
        return `(${(expr.params || []).map(paramName).join(", ")}) => ...`;
      case "FunctionExpression":
        return `function ${getFunctionName(expr)}(${(expr.params || []).map(paramName).join(", ")})`;
      case "UnaryExpression":
      case "UpdateExpression":
        return `${expr.operator}${describeExpression(expr.argument, depth + 1)}`;
      case "BinaryExpression":
      case "LogicalExpression":
        return `${describeExpression(expr.left, depth + 1)} ${expr.operator} ${describeExpression(expr.right, depth + 1)}`;
      case "ConditionalExpression":
        return `${describeExpression(expr.test, depth + 1)} ? ${describeExpression(expr.consequent, depth + 1)} : ${describeExpression(expr.alternate, depth + 1)}`;
      case "AwaitExpression":
        return `await ${describeExpression(expr.argument, depth + 1)}`;
      case "YieldExpression":
        return `yield ${describeExpression(expr.argument, depth + 1)}`;
      case "JSXElement":
        return "<JSXElement>";
      case "JSXFragment":
        return "<>";
      default:
        return expr.type || "unknown";
    }
  }

  function unwrapArgExpression(arg) {
    if (!arg || typeof arg !== "object") return null;
    if ("expression" in arg) return arg.expression;
    if ("expr" in arg) return arg.expr;
    if (arg.type === "SpreadElement") return arg.argument || arg.expr || null;
    return arg;
  }

  function describeArgument(arg, depth = 0) {
    if (!arg) return "unknown";
    const isSpread = !!(arg.spread || arg.type === "SpreadElement");
    const value = describeExpression(unwrapArgExpression(arg) || arg, depth + 1);
    return isSpread ? `...${value}` : value;
  }

  function getCalleeName(expr) {
    if (!expr || typeof expr !== "object") return "unknown";
    if (expr.type === "Identifier") return expr.value;
    if (expr.type === "MemberExpression") return `${describeExpression(expr.object)}.${getPropertyName(expr.property)}`;
    if (expr.type === "CallExpression") return getCalleeName(expr.callee);
    if (expr.type === "Super") return "super";
    return describeExpression(expr);
  }

  function computeFunctionMetrics(node) {
    const metrics = { branches: 0, loops: 0, returns: 0, calls: 0, statements: 0, usesThis: false };

    function walkBody(value) {
      if (!value || typeof value !== "object") return;

      if (Array.isArray(value)) {
        value.forEach(walkBody);
        return;
      }

      switch (value.type) {
        case "IfStatement":
        case "ConditionalExpression":
        case "SwitchStatement":
        case "SwitchCase":
        case "LogicalExpression":
          metrics.branches++;
          break;
        case "ForStatement":
        case "ForOfStatement":
        case "ForInStatement":
        case "WhileStatement":
        case "DoWhileStatement":
          metrics.loops++;
          break;
        case "ReturnStatement":
          metrics.returns++;
          break;
        case "CallExpression":
          metrics.calls++;
          break;
        case "ThisExpression":
          metrics.usesThis = true;
          break;
      }

      if (value.type === "BlockStatement" && Array.isArray(value.stmts)) {
        metrics.statements += value.stmts.length;
      }

      for (const child of Object.values(value)) {
        walkBody(child);
      }
    }

    walkBody(node.body);
    const span = getSpanInfo(node.span);
    return {
      ...metrics,
      cyclomatic: 1 + metrics.branches + metrics.loops,
      linesOfCode: span ? span.lines : undefined,
    };
  }

  function describeLeft(left) {
    if (!left || typeof left !== "object") return "unknown";
    if (left.type === "Identifier") return left.value;
    if (left.type === "MemberExpression") return `${describeExpression(left.object)}.${getPropertyName(left.property)}`;
    if (left.type === "ArrayPattern" || left.type === "ObjectPattern") return describePattern(left);
    return left.type || "unknown";
  }

  function push(insight) {
    const { __span, ...publicInsight } = insight;
    insights.push({ scopeDepth: contextStack.length, span: getSpanInfo(__span), ...publicInsight });
  }

  function walkChildren(node, skippedKeys = []) {
    const skipped = new Set(["type", "span", "ctxt", "decorators", ...skippedKeys]);
    for (const [key, child] of Object.entries(node)) {
      if (skipped.has(key) || key.endsWith("Type") || key.endsWith("TypeParams")) continue;
      if (Array.isArray(child)) {
        child.forEach(walk);
      } else {
        walk(child);
      }
    }
  }

  function emitFunction(node, name = getFunctionName(node), span = node.span) {
    push({
      type: "FunctionDefinition",
      name,
      params: (node.params || []).map(paramName),
      context: currentContext(),
      location: getLocation(span),
      metrics: computeFunctionMetrics(node),
      async: !!node.async,
      generator: !!node.generator,
      __span: span,
    });

    contextStack.push(name);
    if (node.body) walk(node.body);
    contextStack.pop();
  }

  function emitClassMethod(className, method) {
    const methodName = getPropertyName(method.key);
    const functionNode = method.function || method;
    const fullName = `${className}.${methodName}`;

    emitFunction(
      {
        ...functionNode,
        span: method.span || functionNode.span,
        params: functionNode.params || [],
        async: functionNode.async,
        generator: functionNode.generator,
      },
      fullName,
      method.span || functionNode.span
    );
  }

  function walk(node) {
    if (!isNode(node)) return;

    switch (node.type) {
      case "Module":
      case "Script":
      case "BlockStatement":
        walkChildren(node);
        break;

      case "VariableDeclaration":
        node.declarations.forEach(decl => {
          const name = decl.id?.value || (decl.id?.type ? describePattern(decl.id) : undefined);
          const initNode = decl.init;
          const info = {
            type: "Variable",
            name,
            init: initNode ? describeExpression(initNode) : undefined,
            context: currentContext(),
            location: getLocation(decl.span || node.span),
            kind: node.kind || undefined,
            __span: decl.span || node.span,
          };

          if (initNode?.type === "ArrowFunctionExpression" || initNode?.type === "FunctionExpression") {
            info.params = (initNode.params || []).map(paramName);
            info.isAsync = !!initNode.async;
          }

          push(info);

          if (initNode?.type === "ArrowFunctionExpression" || initNode?.type === "FunctionExpression") {
            emitFunction(initNode, name || getFunctionName(initNode), initNode.span || decl.span);
          } else {
            walk(initNode);
          }
        });
        break;

      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression":
        emitFunction(node);
        break;

      case "CallExpression":
        push({
          type: "FunctionCall",
          callee: getCalleeName(node.callee),
          args: (node.arguments || []).map(arg => describeArgument(arg)),
          context: currentContext(),
          location: getLocation(node.span),
          argumentCount: (node.arguments || []).length,
          __span: node.span,
        });
        (node.arguments || []).forEach(arg => walk(unwrapArgExpression(arg)));
        break;

      case "NewExpression":
        push({
          type: "FunctionCall",
          callee: `new ${getCalleeName(node.callee)}`,
          args: (node.arguments || []).map(arg => describeArgument(arg)),
          context: currentContext(),
          location: getLocation(node.span),
          argumentCount: (node.arguments || []).length,
          __span: node.span,
        });
        (node.arguments || []).forEach(arg => walk(unwrapArgExpression(arg)));
        break;

      case "BinaryExpression":
      case "LogicalExpression":
        push({
          type: "BinaryExpression",
          operator: node.operator,
          left: describeExpression(node.left),
          right: describeExpression(node.right),
          context: currentContext(),
          location: getLocation(node.span),
          __span: node.span,
        });
        walk(node.left);
        walk(node.right);
        break;

      case "AssignmentExpression":
        push({
          type: "Assignment",
          operator: node.operator,
          left: describeLeft(node.left),
          right: describeExpression(node.right),
          context: currentContext(),
          location: getLocation(node.span),
          __span: node.span,
        });
        walk(node.right);
        break;

      case "UpdateExpression":
        push({
          type: "Update",
          operator: node.operator,
          argument: describeExpression(node.argument),
          prefix: !!node.prefix,
          context: currentContext(),
          location: getLocation(node.span),
          __span: node.span,
        });
        break;

      case "ReturnStatement":
        push({
          type: "Return",
          value: node.argument ? describeExpression(node.argument) : undefined,
          context: currentContext(),
          location: getLocation(node.span),
          __span: node.span,
        });
        walk(node.argument);
        break;

      case "ThrowStatement":
        push({
          type: "Throw",
          value: node.argument ? describeExpression(node.argument) : undefined,
          context: currentContext(),
          location: getLocation(node.span),
          __span: node.span,
        });
        walk(node.argument);
        break;

      case "TryStatement":
        push({
          type: "TryCatch",
          hasCatch: !!node.handler,
          hasFinally: !!node.finalizer,
          context: currentContext(),
          location: getLocation(node.span),
          __span: node.span,
        });
        walkChildren(node);
        break;

      case "Identifier":
        push({
          type: "Identifier",
          name: node.value,
          context: currentContext(),
          location: getLocation(node.span),
          __span: node.span,
        });
        break;

      case "StringLiteral":
        push({ type: "StringLiteral", value: node.value, context: currentContext(), location: getLocation(node.span), __span: node.span });
        break;

      case "BooleanLiteral":
        push({ type: "BooleanLiteral", value: node.value, context: currentContext(), location: getLocation(node.span), __span: node.span });
        break;

      case "NumericLiteral":
        push({ type: "NumericLiteral", value: node.value, context: currentContext(), location: getLocation(node.span), __span: node.span });
        break;

      case "NullLiteral":
        push({ type: "NullLiteral", value: null, context: currentContext(), location: getLocation(node.span), __span: node.span });
        break;

      case "TemplateLiteral":
        push({
          type: "TemplateLiteral",
          parts: (node.quasis || []).map(part => part.cooked),
          expressions: (node.expressions || []).map(expr => describeExpression(expr)),
          context: currentContext(),
          location: getLocation(node.span),
          __span: node.span,
        });
        (node.expressions || []).forEach(walk);
        break;

      case "ImportDeclaration":
        push({
          type: "Import",
          source: node.source?.value,
          specifiers: (node.specifiers || []).map(specifier => {
            if (specifier.type === "ImportDefaultSpecifier") return { kind: "default", local: specifier.local?.value };
            if (specifier.type === "ImportNamespaceSpecifier") return { kind: "namespace", local: specifier.local?.value };
            if (specifier.type === "ImportSpecifier") {
              return {
                kind: "named",
                imported: specifier.imported?.value || specifier.imported?.name || specifier.local?.value,
                local: specifier.local?.value,
              };
            }
            return { kind: "unknown" };
          }),
          context: currentContext(),
          location: getLocation(node.span),
          __span: node.span,
        });
        break;

      case "ExportDefaultDeclaration":
      case "ExportDefaultExpression":
      case "ExportDeclaration":
      case "ExportNamedDeclaration":
      case "ExportAllDeclaration": {
        let names = [];
        const declaration = node.declaration;
        const declarationName = declaration && getFunctionName(declaration, null);
        if (declarationName) names.push(declarationName);
        if (Array.isArray(node.specifiers)) {
          names = names.concat(node.specifiers.map(specifier => (
            specifier.exported?.value ||
            specifier.exported?.name ||
            specifier.orig?.value ||
            specifier.local?.value
          )).filter(Boolean));
        }
        push({
          type: "Export",
          exportKind: node.type,
          names,
          source: node.source?.value,
          context: currentContext(),
          location: getLocation(node.span),
          __span: node.span,
        });
        walk(declaration);
        break;
      }

      case "ClassDeclaration":
      case "ClassExpression": {
        const name = getFunctionName(node);
        const body = Array.isArray(node.body) ? node.body : node.body?.body || [];
        push({
          type: "Class",
          name,
          superClass: node.superClass ? describeExpression(node.superClass) : undefined,
          methods: body.filter(member => member.type === "MethodProperty" || member.type === "ClassMethod").map(member => ({
            name: getPropertyName(member.key),
            kind: member.kind || "method",
            static: !!member.isStatic,
            async: !!member.function?.async || !!member.isAsync,
            generator: !!member.function?.generator || !!member.isGenerator,
          })),
          context: currentContext(),
          location: getLocation(node.span),
          __span: node.span,
        });

        contextStack.push(name);
        body.forEach(member => {
          if (member.type === "MethodProperty" || member.type === "ClassMethod") {
            emitClassMethod(name, member);
          } else {
            walk(member);
          }
        });
        contextStack.pop();
        break;
      }

      case "TsTypeAliasDeclaration":
        push({
          type: "TypeAlias",
          name: node.id?.value || "anonymous",
          context: currentContext(),
          location: getLocation(node.span),
          __span: node.span,
        });
        break;

      case "TsInterfaceDeclaration":
        push({
          type: "Interface",
          name: node.id?.value || "anonymous",
          context: currentContext(),
          location: getLocation(node.span),
          __span: node.span,
        });
        break;

      case "TsEnumDeclaration":
        push({
          type: "Enum",
          name: node.id?.value || "anonymous",
          members: (node.members || []).map(member => getPropertyName(member.id)),
          context: currentContext(),
          location: getLocation(node.span),
          __span: node.span,
        });
        break;

      default:
        walkChildren(node, ["typeAnnotation", "returnType", "typeParameters", "typeParams", "typeArguments"]);
    }
  }

  walk(ast);
  return insights;
}

module.exports = { extractInfo };
