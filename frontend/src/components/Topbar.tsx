
import React, { useContext } from 'react';
import { ThemeContext } from '../theme/ThemeContext';

export default function Topbar() {
  const { theme, setTheme } = useContext(ThemeContext);

  return (
    <div className="topbar">
      <div className="brand">StructViz</div>
      <div className="flex items-center gap-3">
        <label htmlFor="theme-select" className="text-xs text-slate-500 dark:text-slate-400">Theme</label>
        <select
          id="theme-select"
          value={theme}
          onChange={e => setTheme(e.target.value as any)}
          className="theme-toggle"
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="vibrant">Vibrant</option>
        </select>
      </div>
    </div>
  );
}