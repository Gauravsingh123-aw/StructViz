# StructViz Product Roadmap

## Phase 1: Parser correctness

Status: implemented.

- Parse JavaScript, JSX, TypeScript, and TSX through SWC fallback candidates.
- Normalize SWC spans so line and column positions are request-local.
- Traverse function, arrow function, function expression, and class method bodies.
- Extract class methods, exports, imports, type aliases, interfaces, and enums.
- Return parser metadata and validation errors from the backend API.
- Cover parser regressions with backend tests.

## Phase 2: Symbol graph

Status: next.

- Build scoped declaration and reference tables.
- Resolve local function calls to concrete declarations where possible.
- Distinguish same-name symbols in different scopes or files.
- Model reads, writes, returns, throws, and calls as typed graph edges.
- Reduce literal/identifier noise in the graph view with semantic filtering.

## Phase 3: Project analysis

Status: planned.

- Accept multiple files or repository snapshots.
- Resolve relative imports and package imports.
- Build module dependency graphs.
- Identify entry points, cycles, dead exports, and architectural hotspots.
- Preserve per-file source locations for navigation.

## Phase 4: Launch readiness

Status: planned.

- Add request limits, structured errors, health checks, and CI.
- Add export formats for graph JSON and images.
- Add examples, onboarding snippets, and public documentation.
- Add deployment checks for frontend and backend builds.
- Add security review for uploaded source handling.
