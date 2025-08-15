export type Location = {
  line: number;
  column: number;
} | null;

export type Insight =
  | {
      type: "Variable";
      name?: string;
      init?: string;
      params?: string[];
      context: string;
      location: Location;
    }
  | {
      type: "FunctionDefinition";
      name: string;
      params: string[];
      context: string;
      location: Location;
    }
  | {
      type: "FunctionCall";
      callee: string;
      args: string[];
      context: string;
      location: Location;
    }
  | {
      type: "BinaryExpression";
      operator: string;
      left?: string;
      right?: string;
      context: string;
      location: Location;
    }
  | {
      type: "Identifier";
      name: string;
      context: string;
      location: Location;
    }
  | {
      type: "StringLiteral";
      value: string;
      context: string;
      location: Location;
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