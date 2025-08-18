import React from 'react';

const items = [
  {
    title: 'Deep Insights',
    body: 'Extracts functions, calls, imports, classes, control flow, assignments and more.',
  },
  {
    title: 'Interactive Graph',
    body: 'Zoom, drag, and explore relationships. Node size scales with complexity.',
  },
  {
    title: 'Theme Aware',
    body: 'Beautiful in dark, light and vibrant modes with clear colors and labels.',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-12">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Features</h2>
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((it) => (
            <div key={it.title} className="card p-4">
              <div className="text-base font-semibold text-slate-900 dark:text-white">{it.title}</div>
              <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">{it.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
} 