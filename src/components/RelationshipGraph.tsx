import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { ZoomOut, Download, Search, X } from 'lucide-react';

interface Node extends d3.SimulationNodeDatum {
  id: string;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  relation: string;
}

interface Props {
  data: { source: string; target: string; relation: string }[];
}

export default function RelationshipGraph({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [filterTerm, setFilterTerm] = useState('');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const filteredData = useMemo(() => {
    if (!filterTerm.trim()) return data;
    const term = filterTerm.toLowerCase();
    return data.filter(d => 
      d.source.toLowerCase().includes(term) || 
      d.target.toLowerCase().includes(term) || 
      d.relation.toLowerCase().includes(term)
    );
  }, [data, filterTerm]);

  useEffect(() => {
    if (!svgRef.current || filteredData.length === 0) {
      if (svgRef.current) d3.select(svgRef.current).selectAll("*").remove();
      return;
    }

    const width = 400;
    const height = 300;

    d3.select(svgRef.current).selectAll("*").remove();

    const nodesMap = new Map<string, Node>();
    filteredData.forEach(d => {
      if (!nodesMap.has(d.source)) nodesMap.set(d.source, { id: d.source });
      if (!nodesMap.has(d.target)) nodesMap.set(d.target, { id: d.target });
    });

    const nodes: Node[] = Array.from(nodesMap.values());
    const links: Link[] = filteredData.map(d => ({ ...d }));

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .style("max-width", "100%")
      .style("height", "auto");

    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      })
      .on("end", (event) => {
        sessionStorage.setItem('relationshipGraphZoom', JSON.stringify({
          k: event.transform.k,
          x: event.transform.x,
          y: event.transform.y
        }));
      });
      
    svg.call(zoom);
    zoomRef.current = zoom;

    // Restore zoom state if available
    const savedZoom = sessionStorage.getItem('relationshipGraphZoom');
    if (savedZoom) {
      try {
        const { k, x, y } = JSON.parse(savedZoom);
        const transform = d3.zoomIdentity.translate(x, y).scale(k);
        svg.call(zoom.transform, transform);
      } catch (e) {
        console.error("Failed to restore zoom state", e);
      }
    }

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink<Node, Link>(links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2));

    svg.append("defs").append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 15)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#10b981")
      .attr("d", "M0,-5L10,0L0,5");

    const link = g.append("g")
      .attr("stroke", "#10b981")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrow)");

    link.append("title")
      .text(d => d.relation);

    const linkText = g.append("g")
      .selectAll("text")
      .data(links)
      .join("text")
      .attr("font-size", "8px")
      .attr("fill", "#9ca3af")
      .attr("text-anchor", "middle")
      .attr("dy", -5)
      .text(d => d.relation);

    const node = g.append("g")
      .attr("stroke", "#059669")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", 5)
      .attr("fill", "#0f0f0f")
      .call(drag(simulation));

    node.append("title")
      .text(d => d.id);

    const nodeText = g.append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .attr("font-size", "10px")
      .attr("fill", "#e5e5e5")
      .attr("dx", 8)
      .attr("dy", 3)
      .text(d => d.id);

    node.on("mouseover", (event, d) => {
      node.attr("opacity", n => n.id === d.id || links.some(l => ((l.source as Node).id === d.id && (l.target as Node).id === n.id) || ((l.target as Node).id === d.id && (l.source as Node).id === n.id)) ? 1 : 0.2);
      link.attr("stroke-opacity", l => (l.source as Node).id === d.id || (l.target as Node).id === d.id ? 1 : 0.1);
      linkText.attr("opacity", l => (l.source as Node).id === d.id || (l.target as Node).id === d.id ? 1 : 0.1);
      nodeText.attr("opacity", n => n.id === d.id || links.some(l => ((l.source as Node).id === d.id && (l.target as Node).id === n.id) || ((l.target as Node).id === d.id && (l.source as Node).id === n.id)) ? 1 : 0.2);
    }).on("mouseout", () => {
      node.attr("opacity", 1);
      link.attr("stroke-opacity", 0.6);
      linkText.attr("opacity", 1);
      nodeText.attr("opacity", 1);
    });

    node.on("click", (event, d) => {
      event.stopPropagation();
      setSelectedNode(d.id);
    });

    node.on("dblclick", (event, d) => {
      event.stopPropagation();
      const scale = 2;
      const transform = d3.zoomIdentity
        .translate(width / 2 - d.x! * scale, height / 2 - d.y! * scale)
        .scale(scale);
      svg.transition().duration(750).call(zoom.transform, transform);
    });

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as Node).x!)
        .attr("y1", d => (d.source as Node).y!)
        .attr("x2", d => (d.target as Node).x!)
        .attr("y2", d => (d.target as Node).y!);

      linkText
        .attr("x", d => ((d.source as Node).x! + (d.target as Node).x!) / 2)
        .attr("y", d => ((d.source as Node).y! + (d.target as Node).y!) / 2);

      node
        .attr("cx", d => d.x!)
        .attr("cy", d => d.y!);

      nodeText
        .attr("x", d => d.x!)
        .attr("y", d => d.y!);
    });

    function drag(simulation: d3.Simulation<Node, undefined>) {
      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      return d3.drag<SVGCircleElement, Node>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }
  }, [filteredData]);

  const exportSvg = () => {
    if (!svgRef.current) return;
    const svgElement = svgRef.current.cloneNode(true) as SVGSVGElement;
    const serializer = new XMLSerializer();
    const source = '<?xml version="1.0" standalone="no"?>\r\n' + serializer.serializeToString(svgElement);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'relationship-graph.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-2.5 top-2 text-neutral-500" />
          <input
            type="text"
            placeholder="Filter nodes or relations..."
            value={filterTerm}
            onChange={(e) => setFilterTerm(e.target.value)}
            className="w-full bg-[#141414] border border-neutral-800 rounded-md text-xs py-1.5 pl-8 pr-3 focus:outline-none focus:border-emerald-500/50 text-neutral-200 placeholder:text-neutral-600"
          />
        </div>
      </div>
      
      <div className="relative w-full h-64 bg-[#141414] border border-neutral-800 rounded-lg overflow-hidden">
        <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
          <button 
            onClick={exportSvg}
            className="p-1.5 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 rounded-md transition-colors"
            title="Export as SVG"
          >
            <Download className="w-4 h-4" />
          </button>
          <button 
            onClick={() => {
              if (svgRef.current && zoomRef.current) {
                d3.select(svgRef.current).transition().duration(750).call(zoomRef.current.transform, d3.zoomIdentity);
                sessionStorage.removeItem('relationshipGraphZoom');
              }
            }}
            className="p-1.5 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 rounded-md transition-colors"
            title="Reset Zoom"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
        
        <svg ref={svgRef} className="w-full h-full" />

        {selectedNode && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 p-4 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] border border-neutral-800 p-4 rounded-lg max-w-sm w-full shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-emerald-400 font-medium truncate text-lg">{selectedNode}</h3>
                <button onClick={() => setSelectedNode(null)} className="text-neutral-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="text-sm text-neutral-300 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                <p className="mb-2 text-xs text-neutral-500 uppercase tracking-wider font-mono">Connections</p>
                {data.filter(d => d.source === selectedNode || d.target === selectedNode).length > 0 ? (
                  <ul className="space-y-2">
                    {data.filter(d => d.source === selectedNode || d.target === selectedNode).map((d, i) => (
                      <li key={i} className="bg-[#0f0f0f] p-2.5 rounded border border-neutral-800/50 flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-neutral-500">{d.source === selectedNode ? 'Target:' : 'Source:'}</span>
                          <span className="text-emerald-400/90 font-medium">{d.source === selectedNode ? d.target : d.source}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-neutral-500">Relation:</span>
                          <span className="text-neutral-300 italic">{d.relation}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-neutral-500 italic text-xs">No direct connections found.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
