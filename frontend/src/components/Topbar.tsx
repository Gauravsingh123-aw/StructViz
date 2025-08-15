
import React, { useContext } from 'react';
import { ThemeContext } from '../theme/ThemeContext';

export default function Topbar() {
  const { theme, setTheme } = useContext(ThemeContext);

  return (
    <div className="topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', background: '#18181b', color: '#fff', boxShadow: '0 2px 8px #0002', borderRadius: 16, marginBottom: 16 }}>
      <div className="brand" style={{ fontWeight: 700, fontSize: 24, letterSpacing: 1 }}>StructViz</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <label htmlFor="theme-select" style={{ fontSize: 16, marginRight: 8 }}>Theme:</label>
        <select
          id="theme-select"
          value={theme}
          onChange={e => setTheme(e.target.value as any)}
          style={{ padding: '6px 12px', borderRadius: 8, fontSize: 16, background: '#222', color: '#fff', border: 'none', outline: 'none', boxShadow: '0 1px 4px #0002' }}
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="vibrant">Vibrant</option>
        </select>
      </div>
    </div>
  );
}