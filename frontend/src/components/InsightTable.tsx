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
];

function describe(i: Insight) {
  switch (i.type) {
    case 'Variable':
      return `${i.name ?? 'unknown'}${i.init ? ` = ${i.init}` : ''}`;
    case 'FunctionDefinition':
      return `${i.name}(${i.params.join(', ')})`;
    case 'FunctionCall':
      return `${i.callee}(${i.args.join(', ')})`;
    case 'BinaryExpression':
      return `${i.left ?? ''} ${i.operator} ${i.right ?? ''}`.trim();
    case 'Identifier':
      return i.name;
    case 'StringLiteral':
      return i.value;
  }
}

function badgeColor(type: Insight['type']) {
  switch (type) {
    case 'FunctionDefinition': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'FunctionCall': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
    case 'Variable': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300';
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
    <div className="card">
      <div className="card-header">
        <h3 className="text-sm font-semibold">Insights</h3>
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
      <div className="insights-wrap">
        {filtered.map((i, idx) => (
          <div key={idx} className="insight-card">
            <div className={`insight-badge ${badgeColor(i.type)}`}>{i.type}</div>
            <div className="flex-1">
              <div className="insight-title">{describe(i)}</div>
              <div className="insight-sub">
                <span className="mr-3">Context: <span className="font-medium">{i.context}</span></span>
                <span>Line: <span className="font-medium">{i.location ? i.location.line : '-'}</span></span>
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