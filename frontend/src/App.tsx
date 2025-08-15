import React, { useState } from 'react';
import Topbar from './components/Topbar';
import Editor from './components/Editor';
import ForceGraph from './components/ForceGraph';
import InsightTable from './components/InsightTable';
import { Insight } from './types';
import { convertCodeToInsights } from './api';

const SAMPLE = `// Try me
function add(a, b) {
  const sum = a + b;
  log(sum);
  return sum;
}

const double = (x) => add(x, x);

add(2, 3);
`;

function App() {
  const [code, setCode] = useState<string>(SAMPLE);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    try {
      const res = await convertCodeToInsights(code);
      setInsights(res.payload || []);
    } catch (e: any) {
      setError(e.message || 'Failed to parse');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Topbar />
      <div className="container-app">
        <aside className="flex flex-col gap-4">
          <Editor value={code} onChange={setCode} onSubmit={onSubmit} loading={loading} />
          {error && <div className="error">{error}</div>}
          <InsightTable insights={insights} />
        </aside>
        <main className="min-h-0">
          <ForceGraph insights={insights} />
        </main>
      </div>
    </>
  );
}

export default App;
