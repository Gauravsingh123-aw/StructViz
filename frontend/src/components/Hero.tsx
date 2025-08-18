import React, { useMemo } from 'react';
import ForceGraph from './ForceGraph';
import { Insight } from '../types';

export default function Hero() {
  const miniInsights: Insight[] = useMemo(() => ([
    { type: 'FunctionDefinition', name: 'add', params: ['a','b'], context: 'global', location: null, metrics: { branches: 1, loops: 0, returns: 1, calls: 1, cyclomatic: 2, linesOfCode: 5 } },
    { type: 'FunctionCall', callee: 'log', args: ['sum'], context: 'add', location: null },
    { type: 'Variable', name: 'sum', init: 'a + b', context: 'add', location: null, kind: 'const' },
  ] as any), []);

  return (
    <section id="home" className="bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-12 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            Understand code structure visually
          </h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            StructViz parses your JavaScript/TypeScript using SWC and turns it into a beautiful, interactive graph.
            Inspect functions, calls, imports, classes and more—instantly.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <a href="#playground" className="primary">Try the Playground</a>
            <a href="#features" className="text-sm text-brand-600 font-medium">See Features →</a>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-soft">
          <div className="rounded-xl overflow-hidden">
            <ForceGraph insights={miniInsights} />
          </div>
        </div>
      </div>
    </section>
  );
} 