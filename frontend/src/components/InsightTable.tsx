import React, { useMemo, useState } from 'react';
import { Insight } from '../types';

type Props = { insights: Insight[] };

const TYPES: Insight['type'][] = [
  'Variable',
  'FunctionDefinition',
  'FunctionCall',
  'BinaryExpression',
  'Identifier',
  'StringLiteral',
  'BooleanLiteral',
  'NumericLiteral',
  'NullLiteral',
  'TemplateLiteral',
  'Import',
  'Export',
  'Class',
  'Assignment',
  'Update',
  'Return',
  'Throw',
  'TryCatch',
];

function describe(i: Insight) {
  switch (i.type) {
    case 'Variable':
      return `${(i as any).name ?? 'unknown'}${(i as any).init ? ` = ${(i as any).init}` : ''}`;
    case 'FunctionDefinition':
      return `${(i as any).name}(${(i as any).params.join(', ')})`;
    case 'FunctionCall':
      return `${(i as any).callee}(${(i as any).args.join(', ')})`;
    case 'BinaryExpression':
      return `${(i as any).left ?? ''} ${(i as any).operator} ${(i as any).right ?? ''}`.trim();
    case 'Identifier':
      return (i as any).name;
    case 'StringLiteral':
      return (i as any).value;
    case 'BooleanLiteral':
      return String((i as any).value);
    case 'NumericLiteral':
      return String((i as any).value);
    case 'NullLiteral':
      return 'null';
    case 'TemplateLiteral':
      return '`' + ((i as any).parts || []).join('${…}') + '`';
    case 'Import':
      return `import from ${(i as any).source || '?'}`;
    case 'Export':
      return `export ${(i as any).names?.join(', ') || (i as any).exportKind || ''}`.trim();
    case 'Class':
      return `class ${(i as any).name}${(i as any).superClass ? ` extends ${(i as any).superClass}` : ''}`;
    case 'Assignment':
      return `${(i as any).left} ${(i as any).operator} ${(i as any).right}`;
    case 'Update':
      return `${(i as any).operator}${(i as any).argument}`;
    case 'Return':
      return `return ${(i as any).value ?? ''}`.trim();
    case 'Throw':
      return `throw ${(i as any).value ?? ''}`.trim();
    case 'TryCatch':
      return `try${(i as any).hasCatch ? '/catch' : ''}${(i as any).hasFinally ? '/finally' : ''}`;
  }
}

function badgeColor(type: Insight['type']) {
  switch (type) {
    case 'FunctionDefinition': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'FunctionCall': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
    case 'Variable': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300';
    case 'Class': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'Import': return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300';
    case 'Export': return 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300';
    case 'Assignment': return 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200';
    default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
}

export default function InsightTable({ insights }: Props) {
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (activeTypes.size === 0) return insights;
    return insights.filter((i) => activeTypes.has(i.type));
  }, [insights, activeTypes]);

  function toggleType(t: Insight['type']) {
    const next = new Set(activeTypes);
    if (next.has(t)) next.delete(t); else next.add(t);
    setActiveTypes(next);
  }

  return (
    <div className="card flex flex-col" style={{ height: 420 }}>
      <div className="card-header">
        <h3 className="text-sm font-extrabold tracking-tight">Insights</h3>
        <div className="filters">
          {TYPES.map((t) => (
            <button
              key={t}
              className={activeTypes.has(t) ? 'chip active' : 'chip'}
              onClick={() => toggleType(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="insights-wrap flex-1" style={{ overflowY: 'auto', minHeight: 0 }}>
        {filtered.map((i, idx) => (
          <div key={idx} className="insight-card">
            <div className={`insight-badge ${badgeColor(i.type)}`}>{i.type}</div>
            <div className="flex-1">
              <div className="insight-title font-bold">{describe(i)}</div>
              <div className="insight-sub">
                <span className="mr-3">Context: <span className="font-medium">{i.context}</span></span>
                <span className="mr-3">Line: <span className="font-medium">{i.location ? i.location.line : '-'}</span></span>
                {('span' in i && i.span && (i as any).span?.lines) ? (
                  <span>Span: <span className="font-medium">{(i as any).span.lines} lines</span></span>
                ) : null}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-slate-500 dark:text-slate-400 text-sm py-4">No insights</div>
        )}
      </div>
    </div>
  );
} 