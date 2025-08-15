
import React, { useRef, useEffect, useContext } from 'react';
import * as d3 from 'd3';
import { Insight } from '../types';
import { ThemeContext } from '../theme/ThemeContext';

type Node = { id: string; label?: string };
type Link = { source: string; target: string };
type Props = { insights: Insight[] };

function buildGraph(insights: Insight[]): { nodes: Node[]; links: Link[] } {
  const nodesMap = new Map<string, Node>();
  const links: Link[] = [];

  function ensureNode(id: string, label: string) {
    if (!nodesMap.has(id)) nodesMap.set(id, { id, label });
  }

  ensureNode('ctx:global', 'global');

  insights.forEach((ins, idx) => {
    const ctxId = `ctx:${(ins as any).context || 'global'}`;
    ensureNode(ctxId, (ins as any).context || 'global');

    const insId = `ins:${idx}`;
    let label = 'node';
    switch (ins.type) {
      case 'Variable':
        label = `var ${(ins as any).name ?? 'unknown'}${(ins as any).init ? ` = ${(ins as any).init}` : ''}`;
        break;
      case 'FunctionDefinition':
        label = `function ${(ins as any).name}(${(ins as any).params.join(', ')})`;
        break;
      case 'FunctionCall':
        label = `call ${(ins as any).callee}(${(ins as any).args.join(', ')})`;
        break;
      case 'BinaryExpression':
        label = `binary ${(ins as any).operator}`;
        break;
      case 'Identifier':
        label = `id ${(ins as any).name}`;
        break;
      case 'StringLiteral':
        label = `"${(ins as any).value}"`;
        break;
    }
    ensureNode(insId, label);
    links.push({ source: ctxId, target: insId });

    if (ins.type === 'FunctionDefinition') {
      const fnCtxId = `ctx:${(ins as any).name || 'anonymous'}`;
      ensureNode(fnCtxId, (ins as any).name || 'anonymous');
      links.push({ source: insId, target: fnCtxId });
    }
    if (ins.type === 'FunctionCall') {
      const calleeId = `callee:${(ins as any).callee}`;
      ensureNode(calleeId, (ins as any).callee);
      links.push({ source: insId, target: calleeId });
    }
  });
  return { nodes: Array.from(nodesMap.values()), links };
}

const ForceGraph: React.FC<Props> = ({ insights }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { theme } = useContext(ThemeContext);
  const { nodes, links } = buildGraph(insights);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const width = 900;
    const height = 600;
    svg.attr('width', width).attr('height', height);
    const themeColors: any = {
      dark: {
        background: '#18181b',
        node: '#3b82f6',
        nodeStroke: '#fff',
        link: '#6366f1',
        label: '#f3f4f6',
        shadow: 'rgba(0,0,0,0.4)',
      },
      light: {
        background: '#f3f4f6',
        node: '#6366f1',
        nodeStroke: '#18181b',
        link: '#3b82f6',
        label: '#18181b',
        shadow: 'rgba(0,0,0,0.1)',
      },
      vibrant: {
        background: 'linear-gradient(135deg, #f43f5e 0%, #3b82f6 100%)',
        node: '#facc15',
        nodeStroke: '#fff',
        link: '#f43f5e',
        label: '#fff',
        shadow: 'rgba(0,0,0,0.3)',
      },
    };
    const colors = themeColors[theme] || themeColors.dark;
    svg.style('background', colors.background);
    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links as any).id((d: any) => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2));
    const link = svg.append('g')
      .attr('stroke', colors.link)
      .attr('stroke-opacity', 0.7)
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke-width', 3)
      .attr('filter', 'url(#linkShadow)');
    const node = svg.append('g')
      .attr('stroke', colors.nodeStroke)
      .attr('stroke-width', 2)
      .selectAll('circle')
      .data(nodes)
      .enter().append('circle')
      .attr('r', 24)
      .attr('fill', colors.node)
      .attr('filter', 'url(#nodeShadow)')
      .style('cursor', 'pointer')
      .on('mouseover', function () {
        d3.select(this).transition().duration(150).attr('r', 30).attr('fill', d3.color(colors.node)?.darker(0.5)?.toString() || colors.node);
      })
      .on('mouseout', function () {
        d3.select(this).transition().duration(150).attr('r', 24).attr('fill', colors.node);
      });
    (node as any).call(d3.drag()
      .on('start', function (event: any, d: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', function (event: any, d: any) {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', function (event: any, d: any) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      })
    );
    node.append('title').text((d: any) => d.label || d.id);
    const label = svg.append('g')
      .selectAll('text')
      .data(nodes)
      .enter().append('text')
      .text((d: any) => d.label || d.id)
      .attr('font-size', 16)
      .attr('font-weight', 'bold')
      .attr('fill', colors.label)
      .attr('text-anchor', 'middle')
      .attr('dy', 6)
      .attr('pointer-events', 'none')
      .attr('filter', 'url(#labelShadow)');
    svg.append('defs').html(`
      <filter id="nodeShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="${colors.shadow}" />
      </filter>
      <filter id="linkShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="${colors.shadow}" />
      </filter>
      <filter id="labelShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="${colors.shadow}" />
      </filter>
    `);
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);
      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);
      label
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y);
    });
  }, [nodes, links, theme]);

  return (
    <div style={{ width: '100%', height: '600px', borderRadius: 20, boxShadow: '0 4px 32px #0004', overflow: 'hidden', background: 'transparent', position: 'relative' }}>
      <svg ref={svgRef} style={{ width: '100%', height: '600px', display: 'block' }} />
      {/* Legend */}
      <div style={{ position: 'absolute', bottom: 16, right: 24, background: '#222a', color: '#fff', padding: '8px 16px', borderRadius: 12, fontSize: 14, boxShadow: '0 2px 8px #0002' }}>
        <b>AST Node</b>: Circle<br />
        <b>Edge</b>: Relationship<br />
        <span style={{ fontSize: 12, opacity: 0.7 }}>Theme: {theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
      </div>
    </div>
  );
};

export default ForceGraph;