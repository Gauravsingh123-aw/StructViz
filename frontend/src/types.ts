export type Location = {
  line: number;
  column: number;
} | null;

export type SpanInfo = {
  start: { line: number; column: number };
  end: { line: number; column: number };
  lines: number;
} | null;

export type Insight =
  | {
      type: "Variable";
      name?: string;
      init?: string;
      params?: string[];
      context: string;
      location: Location;
      kind?: string;
      span?: SpanInfo;
      scopeDepth?: number;
    }
  | {
      type: "FunctionDefinition";
      name: string;
      params: string[];
      context: string;
      location: Location;
      metrics?: any;
      async?: boolean;
      generator?: boolean;
      span?: SpanInfo;
      scopeDepth?: number;
    }
  | {
      type: "FunctionCall";
      callee: string;
      args: string[];
      context: string;
      location: Location;
      argumentCount?: number;
      span?: SpanInfo;
      scopeDepth?: number;
    }
  | {
      type: "BinaryExpression";
      operator: string;
      left?: string;
      right?: string;
      context: string;
      location: Location;
      span?: SpanInfo;
      scopeDepth?: number;
    }
  | {
      type: "Identifier";
      name: string;
      context: string;
      location: Location;
      span?: SpanInfo;
      scopeDepth?: number;
    }
  | {
      type: "StringLiteral";
      value: string;
      context: string;
      location: Location;
      span?: SpanInfo;
      scopeDepth?: number;
    }
  | {
      type: "BooleanLiteral";
      value: boolean;
      context: string;
      location: Location;
      span?: SpanInfo;
      scopeDepth?: number;
    }
  | {
      type: "NumericLiteral";
      value: number;
      context: string;
      location: Location;
      span?: SpanInfo;
      scopeDepth?: number;
    }
  | {
      type: "NullLiteral";
      value: null;
      context: string;
      location: Location;
      span?: SpanInfo;
      scopeDepth?: number;
    }
  | {
      type: "TemplateLiteral";
      parts: string[];
      expressions: string[];
      context: string;
      location: Location;
      span?: SpanInfo;
      scopeDepth?: number;
    }
  | {
      type: "Import";
      source?: string;
      specifiers?: Array<{ kind: string; imported?: string; local?: string }>;
      context: string;
      location: Location;
      span?: SpanInfo;
      scopeDepth?: number;
    }
  | {
      type: "Export";
      exportKind?: string;
      names?: string[];
      source?: string;
      context: string;
      location: Location;
      span?: SpanInfo;
      scopeDepth?: number;
    }
  | {
      type: "Class";
      name: string;
      superClass?: string;
      methods?: Array<{ name?: string; kind?: string; static?: boolean; async?: boolean; generator?: boolean }>;
      context: string;
      location: Location;
      span?: SpanInfo;
      scopeDepth?: number;
    }
  | {
      type: "Assignment";
      operator: string;
      left: string;
      right: string;
      context: string;
      location: Location;
      span?: SpanInfo;
      scopeDepth?: number;
    }
  | {
      type: "Update";
      operator: string;
      argument: string;
      prefix?: boolean;
      context: string;
      location: Location;
      span?: SpanInfo;
      scopeDepth?: number;
    }
  | {
      type: "Return";
      value?: string;
      context: string;
      location: Location;
      span?: SpanInfo;
      scopeDepth?: number;
    }
  | {
      type: "Throw";
      value?: string;
      context: string;
      location: Location;
      span?: SpanInfo;
      scopeDepth?: number;
    }
  | {
      type: "TryCatch";
      hasCatch: boolean;
      hasFinally: boolean;
      context: string;
      location: Location;
      span?: SpanInfo;
      scopeDepth?: number;
    };

export type ApiResponse = {
  message: string;
  payload: Insight[];
};

export type GraphNode = {
  id: string;
  label: string;
  group: "context" | "insight" | "callee";
};

export type GraphLink = {
  source: string;
  target: string;
}; 