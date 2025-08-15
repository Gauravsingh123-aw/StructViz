import React, { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { GraphLink, GraphNode, Insight } from '../types';

function buildGraph(insights: Insight[]): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodesMap = new Map<string, GraphNode>();
  const links: GraphLink[] = [];

  function ensureNode(id: string, label: string, group: GraphNode['group']) {
    if (!nodesMap.has(id)) nodesMap.set(id, { id, label, group });
  }

  ensureNode('ctx:global', 'global', 'context');

  insights.forEach((ins, idx) => {
    const ctxId = `ctx:${ins.context || 'global'}`;
    ensureNode(ctxId, ins.context || 'global', 'context');

    const insId = `ins:${idx}`;
    const label = (() => {
      switch (ins.type) {
        case 'Variable':
          return `var ${ins.name ?? 'unknown'}${ins.init ? ` = ${ins.init}` : ''}`;
        case 'FunctionDefinition':
          return `function ${ins.name}(${ins.params.join(', ')})`;
        case 'FunctionCall':
          return `call ${ins.callee}(${ins.args.join(', ')})`;
        case 'BinaryExpression':
          return `binary ${ins.operator}`;
        case 'Identifier':
          return `id ${ins.name}`;
        case 'StringLiteral':
          return `"${ins.value}"`;
        default:
          return 'node';
      }
    })();

    ensureNode(insId, label, 'insight');
    links.push({ source: ctxId, target: insId });

    if (ins.type === 'FunctionDefinition') {
      const fnCtxId = `ctx:${ins.name || 'anonymous'}`;
      ensureNode(fnCtxId, ins.name || 'anonymous', 'context');
      links.push({ source: insId, target: fnCtxId });
    }

    if (ins.type === 'FunctionCall') {
      const calleeId = `callee:${ins.callee}`;
      ensureNode(calleeId, ins.callee, 'callee');
      links.push({ source: insId, target: calleeId });
    }
  });

  return { nodes: Array.from(nodesMap.values()), links };
}

type Props = { insights: Insight[] };

export default function ForceGraph({ insights }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const { nodes, links } = useMemo(() => buildGraph(insights), [insights]);

  useEffect(() => {
    if (!svgRef.current || !wrapperRef.current) return;

    const width = wrapperRef.current.clientWidth;
    const height = Math.max(400, wrapperRef.current.clientHeight);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const color = d3.scaleOrdinal<string>()
      .domain(['context', 'insight', 'callee'])
      .range(['#6366f1', '#10b981', '#f43f5e']);

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>().on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
      g.attr('transform', event.transform.toString());
    });

    const root = svg
      .attr('viewBox', [0, 0, width, height].toString())
      .call(zoomBehavior);

    const g = root.append('g');

    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links as any).id((d: any) => d.id).distance(70).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-260))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(35));

    const link = g.append('g')
      .attr('stroke', '#475569')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', 1.2);

    const node = g.append('g')
      .attr('stroke', '#020617')
      .attr('stroke-width', 1.5)
      .selectAll('g')
      .data(nodes)
      .join('g');

    (node as any).call(
      d3.drag<SVGGElement, GraphNode>()
        .on('start', (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          (d as any).fx = (d as any).x;
          (d as any).fy = (d as any).y;
        })
        .on('drag', (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
          (d as any).fx = event.x;
          (d as any).fy = event.y;
        })
        .on('end', (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
          if (!event.active) simulation.alphaTarget(0);
          (d as any).fx = null;
          (d as any).fy = null;
        })
    );

    node.append('circle')
      .attr('r', 20)
      .attr('fill', (d: any) => color((d as GraphNode).group) as string)
      .attr('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.45))');

    node.append('text')
      .attr('x', 0)
      .attr('y', 4)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('fill', '#e2e8f0')
      .text((d: any) => d.label.length > 24 ? d.label.slice(0, 23) + '…' : d.label)
      .append('title')
      .text((d: any) => d.label);

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => (d.source as any).x)
        .attr('y1', (d: any) => (d.source as any).y)
        .attr('x2', (d: any) => (d.target as any).x)
        .attr('y2', (d: any) => (d.target as any).y);

      node
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, links]);

  return (
    <div className="card" ref={wrapperRef} style={{ height: '100%' }}>
      <div className="card-header">
        <h3 className="text-sm font-semibold text-slate-200">AST Insight Graph</h3>
        <div className="legend">
          <span className="legend-dot ctx" /> Context
          <span className="legend-dot ins" /> Insight
          <span className="legend-dot cal" /> Callee
        </div>
      </div>
      <svg ref={svgRef} className="graph" />
    </div>
  );
} 