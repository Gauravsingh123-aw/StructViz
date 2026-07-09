import React, { useState } from 'react';
import { ThemeProvider } from './theme/ThemeContext';
import Topbar from './components/Topbar';
import Editor from './components/Editor';
import ProjectFiles from './components/ProjectFiles';
import ForceGraph from './components/ForceGraph';
import InsightTable from './components/InsightTable';
import { Insight } from './types';
import { convertCodeToInsights, convertProjectToInsights, ProjectFileInput } from './api';
import SiteHeader from './components/SiteHeader';
import Hero from './components/Hero';
import Features from './components/Features';
import Contact from './components/Contact';

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
  const [mode, setMode] = useState<'snippet' | 'project'>('snippet');
  const [projectFiles, setProjectFiles] = useState<ProjectFileInput[]>([]);
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

  async function onProjectSubmit() {
    setLoading(true);
    setError(null);
    try {
      const res = await convertProjectToInsights(projectFiles);
      setInsights(res.payload || []);
    } catch (e: any) {
      setError(e.message || 'Failed to analyze project');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <SiteHeader />
        <Hero />
        <Features />
        <section id="playground" className="max-w-7xl mx-auto px-4 py-10">
          <Topbar />
          <div className="grid gap-6">
            <div className="segmented">
              <button className={mode === 'snippet' ? 'active' : ''} onClick={() => setMode('snippet')}>Snippet</button>
              <button className={mode === 'project' ? 'active' : ''} onClick={() => setMode('project')}>Project</button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                {mode === 'snippet' ? (
                  <Editor value={code} onChange={setCode} onSubmit={onSubmit} loading={loading} />
                ) : (
                  <ProjectFiles files={projectFiles} onFiles={setProjectFiles} onSubmit={onProjectSubmit} loading={loading} />
                )}
                {error && <div className="error">{error}</div>}
              </div>
              <div className="space-y-4">
                <InsightTable insights={insights} />
              </div>
            </div>
            <div>
              <ForceGraph insights={insights} />
            </div>
          </div>
        </section>
        <Contact />
      </div>
    </ThemeProvider>
  );
}

export default App;
