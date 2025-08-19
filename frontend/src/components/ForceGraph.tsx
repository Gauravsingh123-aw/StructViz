
import React, { useRef, useEffect, useContext } from 'react';
import * as d3 from 'd3';
import { Insight } from '../types';
import { ThemeContext } from '../theme/ThemeContext';

type GraphNode = { id: string; label: string; group: string; r?: number; meta?: any };
type GraphLink = { source: string; target: string; type: string };
type Props = { insights: Insight[]; mode?: 'default' | 'mini' };

function safeId(text: string) {
  return text.replace(/\s+/g, '_');
}

function buildGraph(insights: Insight[]): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodesMap = new Map<string, GraphNode>();
  const links: GraphLink[] = [];

  function ensureNode(id: string, label: string, group: string, meta?: any): GraphNode {
    const existing = nodesMap.get(id);
    if (existing) return existing;
    const node: GraphNode = { id, label, group, meta };
    nodesMap.set(id, node);
    return node;
  }

  function link(a: string, b: string, type: string) {
    links.push({ source: a, target: b, type });
  }

  ensureNode('ctx:global', 'global', 'context');

  function ctxId(ctx: string) {
    return `ctx:${ctx || 'global'}`;
  }

  for (const ins of insights) {
    ensureNode(ctxId((ins as any).context || 'global'), (ins as any).context || 'global', 'context');
  }

  insights.forEach((ins, idx) => {
    const ctx = (ins as any).context || 'global';
    const parentCtxId = ctxId(ctx);

    switch (ins.type) {
      case 'Variable': {
        const name = (ins as any).name || `var_${idx}`;
        const id = `var:${safeId(name)}`;
        ensureNode(id, `var ${name}${(ins as any).init ? ` = ${(ins as any).init}` : ''}`, 'variable', ins);
        link(parentCtxId, id, 'contains');
        break;
      }
      case 'FunctionDefinition': {
        const name = (ins as any).name || `fn_${idx}`;
        const params = (ins as any).params || [];
        const id = `fn:${safeId(name)}`;
        const node = ensureNode(id, `fn ${name}(${params.join(', ')})`, 'function', ins);
        const cyclo = ins && (ins as any).metrics?.cyclomatic ? (ins as any).metrics.cyclomatic : 1;
        node.r = Math.max(14, Math.min(40, 12 + cyclo * 2));
        link(parentCtxId, id, 'contains');
        const fnCtxId = ctxId(name);
        ensureNode(fnCtxId, name, 'context');
        link(id, fnCtxId, 'defines');
        break;
      }
      case 'FunctionCall': {
        const callee = (ins as any).callee || 'unknown';
        const callId = `call:${idx}`;
        ensureNode(callId, `call ${callee}(${((ins as any).args || []).join(', ')})`, 'call', ins);
        link(parentCtxId, callId, 'calls');
        const calleeId = `sym:${safeId(callee)}`;
        ensureNode(calleeId, callee, 'symbol');
        link(callId, calleeId, 'targets');
        break;
      }
      case 'Import': {
        const source = (ins as any).source || '?';
        const modId = `mod:${safeId(source)}`;
        ensureNode(modId, `module ${source}`, 'module', ins);
        link(parentCtxId, modId, 'imports');
        const specs = (ins as any).specifiers || [];
        specs.forEach((s: any) => {
          if (!s || !s.local) return;
          const localId = `sym:${safeId(s.local)}`;
          ensureNode(localId, s.local, 'symbol');
          link(modId, localId, 'binds');
        });
        break;
      }
      case 'Export': {
        const names = (ins as any).names || [];
        const expId = `exp:${idx}`;
        ensureNode(expId, `export ${names.join(', ') || (ins as any).exportKind || 'default'}`, 'export', ins);
        link(parentCtxId, expId, 'exports');
        break;
      }
      case 'Class': {
        const name = (ins as any).name || `Class_${idx}`;
        const id = `class:${safeId(name)}`;
        ensureNode(id, `class ${name}`, 'class', ins);
        link(parentCtxId, id, 'contains');
        const superClass = (ins as any).superClass;
        if (superClass) {
          const superId = `sym:${safeId(superClass)}`;
          ensureNode(superId, superClass, 'symbol');
          link(id, superId, 'extends');
        }
        break;
      }
      case 'Assignment': {
        const aid = `assign:${idx}`;
        ensureNode(aid, `assign ${(ins as any).left} ${(ins as any).operator} ${(ins as any).right}`, 'assignment', ins);
        link(parentCtxId, aid, 'assign');
        const leftId = `sym:${safeId((ins as any).left || 'lhs')}`;
        ensureNode(leftId, (ins as any).left || 'lhs', 'symbol');
        link(aid, leftId, 'writes');
        const rightExpr = (ins as any).right || 'expr';
        const rightId = `expr:${idx}`;
        ensureNode(rightId, rightExpr, 'expression');
        link(aid, rightId, 'reads');
        break;
      }
      case 'Update': {
        const uid = `update:${idx}`;
        ensureNode(uid, `update ${(ins as any).operator}${(ins as any).argument}`, 'assignment', ins);
        link(parentCtxId, uid, 'update');
        const argId = `sym:${safeId((ins as any).argument || 'arg')}`;
        ensureNode(argId, (ins as any).argument || 'arg', 'symbol');
        link(uid, argId, 'writes');
        break;
      }
      case 'Return': {
        const rid = `return:${idx}`;
        ensureNode(rid, `return ${(ins as any).value ?? ''}`.trim(), 'control', ins);
        link(parentCtxId, rid, 'return');
        break;
      }
      case 'Throw': {
        const tid = `throw:${idx}`;
        ensureNode(tid, `throw ${(ins as any).value ?? ''}`.trim(), 'control', ins);
        link(parentCtxId, tid, 'throw');
        break;
      }
      case 'TryCatch': {
        const tcid = `trycatch:${idx}`;
        ensureNode(tcid, `try${(ins as any).hasCatch ? '/catch' : ''}${(ins as any).hasFinally ? '/finally' : ''}` , 'control', ins);
        link(parentCtxId, tcid, 'try');
        break;
      }
      default: {
        const id = `ins:${idx}`;
        ensureNode(id, (ins as any).type.toLowerCase(), 'literal', ins);
        link(parentCtxId, id, 'contains');
      }
    }
  });

  return { nodes: Array.from(nodesMap.values()), links };
}

const ForceGraph: React.FC<Props> = ({ insights, mode = 'default' }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const { theme } = useContext(ThemeContext);
  const { nodes, links } = buildGraph(insights);
  const isMini = mode === 'mini';

  useEffect(() => {
    const svg = d3.select<SVGSVGElement, unknown>(svgRef.current as SVGSVGElement);
    svg.selectAll('*').remove();
    const width = (svgRef.current?.parentElement?.clientWidth || 900);
    const height = Math.max(isMini ? 240 : 400, Math.min(720, (svgRef.current?.parentElement?.clientHeight || (isMini ? 320 : 600))));
    svg.attr('width', width).attr('height', height);

    const themeColors: any = {
      dark: {
        background: '#0b1220',
        label: '#e5e7eb',
        groups: {
          context: '#6366f1', function: '#22c55e', variable: '#0ea5e9', call: '#f43f5e', symbol: '#eab308', module: '#06b6d4', export: '#d946ef', class: '#f59e0b', assignment: '#94a3b8', expression: '#a78bfa', control: '#ef4444', literal: '#64748b',
        },
        links: {
          contains: '#64748b', defines: '#10b981', calls: '#ef4444', targets: '#f43f5e', imports: '#06b6d4', binds: '#22d3ee', exports: '#d946ef', extends: '#f59e0b', assign: '#94a3b8', reads: '#a78bfa', writes: '#f59e0b', return: '#22c55e', throw: '#ef4444', try: '#f97316', update: '#cbd5e1',
        },
      },
      light: {
        background: '#f8fafc',
        label: '#0f172a',
        groups: {
          context: '#4f46e5', function: '#16a34a', variable: '#0284c7', call: '#dc2626', symbol: '#a16207', module: '#0891b2', export: '#a21caf', class: '#d97706', assignment: '#64748b', expression: '#7c3aed', control: '#b91c1c', literal: '#6b7280',
        },
        links: {
          contains: '#94a3b8', defines: '#16a34a', calls: '#b91c1c', targets: '#dc2626', imports: '#0891b2', binds: '#06b6d4', exports: '#a21caf', extends: '#d97706', assign: '#64748b', reads: '#7c3aed', writes: '#d97706', return: '#16a34a', throw: '#b91c1c', try: '#ea580c', update: '#64748b',
        },
      },
      vibrant: {
        background: 'linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)',
        label: '#fff',
        groups: {
          context: '#fff', function: '#34d399', variable: '#93c5fd', call: '#fecaca', symbol: '#fde68a', module: '#67e8f9', export: '#f5d0fe', class: '#fdba74', assignment: '#e5e7eb', expression: '#ddd6fe', control: '#fecaca', literal: '#e5e7eb',
        },
        links: {
          contains: '#e5e7eb', defines: '#34d399', calls: '#fecaca', targets: '#fecaca', imports: '#67e8f9', binds: '#a5f3fc', exports: '#f5d0fe', extends: '#fdba74', assign: '#e5e7eb', reads: '#ddd6fe', writes: '#fde68a', return: '#bbf7d0', throw: '#fecaca', try: '#fed7aa', update: '#e2e8f0',
        },
      },
    };

    const palette = themeColors[theme] || themeColors.dark;
    const groupColor = (g: string) => (palette.groups && palette.groups[g]) || '#3b82f6';
    const linkColor = (t: string) => (palette.links && palette.links[t]) || '#94a3b8';

    svg.style('background', palette.background);

    const container = svg.append('g');

    if (!isMini) {
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .filter((event: any) => {
          if (event.type === 'wheel') return !!event.ctrlKey; // disable wheel zoom, allow pinch (ctrl+wheel)
          return true; // allow drag, touch
        })
        .on('zoom', (event) => {
          container.attr('transform', event.transform);
        });
      zoomRef.current = zoom;
      svg.call(zoom as any);
    } else {
      // start mini view at a modest scale to avoid initial "big" flash
      container.attr('transform', 'scale(0.7)');
    }

    svg.append('defs').html(`
      <marker id="arrow" viewBox="0 -5 10 10" refX="12" refY="0" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,-5L10,0L0,5" fill="#94a3b8"></path>
      </marker>
    `);

    const sim = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links as any).id((d: any) => d.id).distance((l: any) => {
        const t = l.type;
        if (isMini) {
          if (t === 'defines') return 30;
          if (t === 'calls' || t === 'targets') return 60;
          if (t === 'imports' || t === 'exports') return 70;
          return 48;
        }
        if (t === 'defines') return 60;
        if (t === 'calls' || t === 'targets') return 120;
        if (t === 'imports' || t === 'exports') return 140;
        return 90;
      }))
      .force('charge', d3.forceManyBody().strength(isMini ? -180 : -420))
      .force('collide', d3.forceCollide().radius((d: any) => (d.r ? (isMini ? Math.max(8, Math.min(16, d.r)) : d.r + 6) : (isMini ? 14 : 26))))
      .force('center', d3.forceCenter(width / 2, height / 2));

    if (isMini) {
      (sim as any).alpha(1).alphaDecay(0.25);
    }

    const link = container.append('g')
      .attr('stroke-opacity', 0.8)
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke-width', isMini ? 1.5 : 2)
      .attr('stroke', (d: any) => linkColor(d.type))
      .attr('marker-end', 'url(#arrow)');

    const node = container.append('g')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', (d: any) => (isMini ? Math.max(8, Math.min(16, (d.r || 16))) : d.r || 22))
      .attr('fill', (d: any) => groupColor(d.group))
      .attr('stroke', theme === 'dark' ? '#0b1220' : '#0f172a')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function () {
        d3.select(this).transition().duration(120).attr('r', (d: any) => (isMini ? Math.max(10, Math.min(18, (d.r || 16) + 2)) : (d.r || 22) + 6));
      })
      .on('mouseout', function () {
        d3.select(this).transition().duration(120).attr('r', (d: any) => (isMini ? Math.max(8, Math.min(16, (d.r || 16))) : d.r || 22));
      });

    (node as any).call(d3.drag()
      .on('start', function (event: any, d: any) {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', function (event: any, d: any) {
        d.fx = event.x; d.fy = event.y;
      })
      .on('end', function (event: any, d: any) {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null; d.fy = null;
      }));

    node.append('title').text((d: any) => {
      const meta = d.meta || {};
      if (!isMini && d.group === 'function' && meta.metrics) {
        const m = meta.metrics;
        return `${d.label}\nbranches:${m.branches} loops:${m.loops} calls:${m.calls} returns:${m.returns} cyclomatic:${m.cyclomatic} loc:${m.linesOfCode ?? '-'}`;
      }
      return d.label;
    });

    if (!isMini) {
      const label = container.append('g')
        .selectAll('text')
        .data(nodes)
        .enter().append('text')
        .text((d: any) => d.label)
        .attr('font-size', 12)
        .attr('font-weight', '600')
        .attr('fill', palette.label)
        .attr('text-anchor', 'middle')
        .attr('dy', 4)
        .attr('pointer-events', 'none');

      sim.on('tick', () => {
        link.attr('x1', (d: any) => d.source.x).attr('y1', (d: any) => d.source.y).attr('x2', (d: any) => d.target.x).attr('y2', (d: any) => d.target.y);
        node.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y);
        label.attr('x', (d: any) => d.x).attr('y', (d: any) => d.y + ((d.r || 22) + 14));
      });
    } else {
      sim.on('tick', () => {
        link.attr('x1', (d: any) => d.source.x).attr('y1', (d: any) => d.source.y).attr('x2', (d: any) => d.target.x).attr('y2', (d: any) => d.target.y);
        node.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y);
      });

      const fit = () => {
        const xs = (nodes as any).map((n: any) => n.x);
        const ys = (nodes as any).map((n: any) => n.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const padding = 32;
        const dx = Math.max(1, maxX - minX);
        const dy = Math.max(1, maxY - minY);
        const scale = 0.75 * Math.min(width / (dx + padding * 2), height / (dy + padding * 2));
        const tx = (width - scale * (minX + maxX)) / 2;
        const ty = (height - scale * (minY + maxY)) / 2;
        container.attr('transform', `translate(${tx},${ty}) scale(${scale})`);
      };
      setTimeout(fit, 0);
      setTimeout(fit, 800);
      sim.on('end', fit);
    }
  }, [nodes, links, theme, mode]);

  function zoomIn() {
    if (!zoomRef.current || !svgRef.current) return;
    d3.select(svgRef.current).transition().duration(150).call(zoomRef.current.scaleBy as any, 1.2);
  }
  function zoomOut() {
    if (!zoomRef.current || !svgRef.current) return;
    d3.select(svgRef.current).transition().duration(150).call(zoomRef.current.scaleBy as any, 1/1.2);
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {mode !== 'mini' && (
        <div className="card-header">
          <h3 className="text-sm font-semibold">Graph</h3>
          <div className="flex items-center gap-3">
            <div className="legend">
              <span><span className="legend-dot ctx" /> Context</span>
              <span><span className="legend-dot fn" /> Function</span>
              <span><span className="legend-dot call" /> Call</span>
              <span><span className="legend-dot mod" /> Module</span>
              <span><span className="legend-dot cls" /> Class</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={zoomOut} className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-emerald-500 text-white hover:bg-emerald-600">-</button>
              <button onClick={zoomIn} className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-emerald-500 text-white hover:bg-emerald-600">+</button>
            </div>
          </div>
        </div>
      )}
      <svg ref={svgRef} className={mode==='mini' ? '' : 'graph'} style={mode==='mini' ? { width: '100%', height: '100%' } : undefined} />
    </div>
  );
};

export default ForceGraph;