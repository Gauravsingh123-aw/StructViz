import React from 'react';

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading?: boolean;
};

export default function Editor({ value, onChange, onSubmit, loading }: Props) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>JavaScript Source</h3>
        <button className="primary" onClick={onSubmit} disabled={loading}>
          {loading ? 'Parsing…' : 'Parse with SWC'}
        </button>
      </div>
      <textarea
        className="editor"
        spellCheck={false}
        placeholder="Paste or type JavaScript/JSX code here…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="hint">Backend: POST text/plain to /swc-app/convert</div>
    </div>
  );
} 