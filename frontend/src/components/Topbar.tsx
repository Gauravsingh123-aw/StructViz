import React from 'react';

export default function Topbar() {
  function toggleTheme() {
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  }

  React.useEffect(() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  return (
    <div className="topbar">
      <div className="brand">StructViz</div>
      <button className="theme-toggle" onClick={toggleTheme}>
        <span className="hidden sm:inline">Toggle theme</span>
        <span aria-hidden>🌗</span>
      </button>
    </div>
  );
} 