import React, { useState } from 'react';
import { ThemeProvider } from './theme/ThemeContext';
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
    <ThemeProvider>
      <div className="App">
        <Topbar />
        <div style={{ display: 'flex', flexDirection: 'row', gap: 24, marginTop: 24 }}>
          <Editor value={code} onChange={setCode} onSubmit={onSubmit} loading={loading} />
          <ForceGraph insights={insights} />
          <InsightTable insights={insights} />
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
