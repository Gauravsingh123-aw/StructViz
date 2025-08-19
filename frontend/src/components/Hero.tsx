import React, { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph from './ForceGraph';
import { Insight } from '../types';

const SAMPLE_CODE = `function add(a, b) {\n  const sum = a + b;\n  log(sum);\n  return sum;\n}`;

type Mode = 'code' | 'graph';

export default function Hero() {
  const miniInsights: Insight[] = useMemo(() => ([
    { type: 'FunctionDefinition', name: 'add', params: ['a','b'], context: 'global', location: null, metrics: { branches: 1, loops: 0, returns: 1, calls: 1, cyclomatic: 2, linesOfCode: 5 } },
    { type: 'FunctionCall', callee: 'log', args: ['sum'], context: 'add', location: null },
    { type: 'Variable', name: 'sum', init: 'a + b', context: 'add', location: null, kind: 'const' },
  ] as any), []);

  const [mode, setMode] = useState<Mode>('code');
  const [pulseGraph, setPulseGraph] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const seenRef = useRef<boolean>(false);
  const timerRef = useRef<number | null>(null);
  const interactedRef = useRef<boolean>(false);

  useEffect(() => {
    // Respect reduced motion
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    // Run once per mount only; no persistence so it happens each page load
    if (seenRef.current) return;

    const el = previewRef.current;
    if (!el) return;

    const cancel = () => {
      interactedRef.current = true;
      if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    };

    const onInteract = () => cancel();
    el.addEventListener('pointerdown', onInteract);
    el.addEventListener('mousemove', onInteract, { passive: true } as any);
    window.addEventListener('keydown', onInteract);
    window.addEventListener('scroll', onInteract as any, { passive: true } as any);

    const isTouch = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !interactedRef.current && !seenRef.current) {
        // Run once after short delay
        timerRef.current = window.setTimeout(() => {
          // Only auto on non-touch to avoid surprise
          if (!isTouch && !interactedRef.current) {
            setMode('graph');
            setPulseGraph(true);
            window.setTimeout(() => setPulseGraph(false), 1500);
            seenRef.current = true;
          }
        }, 1800);
      } else {
        cancel();
      }
    }, { threshold: 0.4 });

    io.observe(el);
    return () => {
      io.disconnect();
      el.removeEventListener('pointerdown', onInteract);
      el.removeEventListener('mousemove', onInteract as any);
      window.removeEventListener('keydown', onInteract);
      window.removeEventListener('scroll', onInteract as any);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

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
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-soft" ref={previewRef}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Preview</div>
            <div role="tablist" aria-label="Preview mode" className="inline-flex rounded-full border border-emerald-500/40 dark:border-emerald-600/40 overflow-hidden">
              <button
                role="tab"
                aria-selected={mode==='code'}
                onClick={() => setMode('code')}
                className={mode==='code' ? 'px-3 py-1.5 text-xs bg-emerald-500 dark:bg-emerald-600 text-white' : 'px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300'}
              >Code</button>
              <button
                role="tab"
                aria-selected={mode==='graph'}
                onClick={() => setMode('graph')}
                className={(mode==='graph' ? 'px-3 py-1.5 text-xs bg-emerald-500 dark:bg-emerald-600 text-white ' : 'px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 ') + (pulseGraph ? ' ring-2 ring-emerald-300 dark:ring-emerald-500' : '')}
              >Graph</button>
            </div>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ height: 320 }}>
            {mode === 'code' ? (
              <pre className="m-0 p-4 text-xs leading-5 bg-slate-900 text-slate-100 dark:bg-slate-900 h-full">
{SAMPLE_CODE}
              </pre>
            ) : (
              <div className="h-full">
                <ForceGraph insights={miniInsights} mode="mini" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
} 