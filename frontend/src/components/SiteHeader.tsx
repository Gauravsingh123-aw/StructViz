import React, { useContext } from 'react';
import { ThemeContext } from '../theme/ThemeContext';

export default function SiteHeader() {
  const { theme, setTheme } = useContext(ThemeContext);
  return (
    <header className="w-full sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <a href="#home" className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold tracking-tight">
          <span className="inline-block w-2 h-6 bg-brand-600 rounded-full"></span>
          <span>StructViz</span>
        </a>
        <nav className="hidden sm:flex items-center gap-6 text-sm text-slate-600 dark:text-slate-300">
          <a href="#features" className="hover:text-slate-900 dark:hover:text-white">Features</a>
          <a href="#playground" className="hover:text-slate-900 dark:hover:text-white">Playground</a>
          <a href="#contact" className="hover:text-slate-900 dark:hover:text-white">Contact</a>
        </nav>
        <div className="flex items-center gap-3">
          <select
            aria-label="Theme"
            value={theme}
            onChange={e => setTheme(e.target.value as any)}
            className="theme-toggle"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="vibrant">Vibrant</option>
          </select>
          <a href="#playground" className="hidden sm:inline-flex primary">Open App</a>
        </div>
      </div>
    </header>
  );
} 