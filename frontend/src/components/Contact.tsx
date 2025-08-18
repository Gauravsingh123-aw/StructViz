import React from 'react';

export default function Contact() {
  return (
    <footer id="contact" className="mt-12 border-t border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-10 grid md:grid-cols-3 gap-8 text-sm">
        <div>
          <div className="font-semibold text-slate-900 dark:text-white">StructViz</div>
          <div className="text-slate-600 dark:text-slate-300 mt-2">Visual code structure analyzer powered by SWC.</div>
        </div>
        <div>
          <div className="font-semibold text-slate-900 dark:text-white">Contact</div>
          <div className="mt-2 text-slate-600 dark:text-slate-300">Email: hello@structviz.app</div>
          <div className="text-slate-600 dark:text-slate-300">Twitter: @structviz</div>
        </div>
        <div>
          <div className="font-semibold text-slate-900 dark:text-white">Links</div>
          <div className="mt-2"><a href="#playground" className="text-brand-600">Open Playground</a></div>
          <div className="mt-1"><a href="#features" className="text-brand-600">Features</a></div>
        </div>
      </div>
    </footer>
  );
} 