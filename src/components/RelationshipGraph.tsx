import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { ZoomOut, Download, Search, X, Image as ImageIcon } from 'lucide-react';

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
  const selectedNodeRef = useRef<string | null>(null);

  useEffect(() => {
    selectedNodeRef.current = selectedNode;
  }, [selectedNode]);

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
      if (svgRef.current) try { d3.select(svgRef.current).selectAll("*").remove(); } catch(e) {}
      return;
    }

    const width = 400;
    const height = 300;

    try { d3.select(svgRef.current).selectAll("*").remove(); } catch(e) {}

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
      .attr("fill", "#22d3ee")
      .attr("d", "M0,-5L10,0L0,5");

    const link = g.append("g")
      .attr("stroke", "#22d3ee")
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
      .attr("class", "link-text")
      .attr("font-size", "8px")
      .attr("fill", "#9ca3af")
      .attr("text-anchor", "middle")
      .attr("dy", -5)
      .text(d => d.relation);

    const node = g.append("g")
      .attr("stroke", "#06b6d4")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("class", "node-circle")
      .attr("r", 5)
      .attr("fill", "#050505")
      .call(drag(simulation));

    node.append("title")
      .text(d => d.id);

    const nodeText = g.append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .attr("class", "node-text")
      .attr("font-size", "10px")
      .attr("fill", "#e5e5e5")
      .attr("dx", 8)
      .attr("dy", 3)
      .text(d => d.id);

    node.on("mouseover", (event, d) => {
      if (selectedNodeRef.current) return;
      node.attr("opacity", n => n.id === d.id || links.some(l => ((l.source as Node).id === d.id && (l.target as Node).id === n.id) || ((l.target as Node).id === d.id && (l.source as Node).id === n.id)) ? 1 : 0.2);
      link.attr("stroke-opacity", l => (l.source as Node).id === d.id || (l.target as Node).id === d.id ? 1 : 0.1);
      linkText.attr("opacity", l => (l.source as Node).id === d.id || (l.target as Node).id === d.id ? 1 : 0.1);
      nodeText.attr("opacity", n => n.id === d.id || links.some(l => ((l.source as Node).id === d.id && (l.target as Node).id === n.id) || ((l.target as Node).id === d.id && (l.source as Node).id === n.id)) ? 1 : 0.2);
    }).on("mouseout", () => {
      if (selectedNodeRef.current) return;
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

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const node = svg.selectAll(".node-circle");
    const link = svg.selectAll("line");
    const linkText = svg.selectAll(".link-text");
    const nodeText = svg.selectAll(".node-text");

    if (selectedNode) {
      node.attr("opacity", (n: any) => n.id === selectedNode || filteredData.some(l => (l.source === selectedNode && l.target === n.id) || (l.target === selectedNode && l.source === n.id)) ? 1 : 0.2);
      link.attr("stroke-opacity", (l: any) => l.source.id === selectedNode || l.target.id === selectedNode ? 1 : 0.1);
      linkText.attr("opacity", (l: any) => l.source.id === selectedNode || l.target.id === selectedNode ? 1 : 0.1);
      nodeText.attr("opacity", (n: any) => n.id === selectedNode || filteredData.some(l => (l.source === selectedNode && l.target === n.id) || (l.target === selectedNode && l.source === n.id)) ? 1 : 0.2);
    } else {
      node.attr("opacity", 1);
      link.attr("stroke-opacity", 0.6);
      linkText.attr("opacity", 1);
      nodeText.attr("opacity", 1);
    }
  }, [selectedNode, filteredData]);

  const exportSvg = () => {
    if (!svgRef.current) return;
    const svgElement = svgRef.current.cloneNode(true) as SVGSVGElement;
    
    const bbox = svgRef.current.getBoundingClientRect();
    const width = bbox.width || 800;
    const height = bbox.height || 600;
    
    svgElement.setAttribute('width', width.toString());
    svgElement.setAttribute('height', height.toString());

    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("width", "100%");
    bgRect.setAttribute("height", "100%");
    bgRect.setAttribute("fill", "#050505");
    svgElement.insertBefore(bgRect, svgElement.firstChild);

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

  const exportPng = () => {
    if (!svgRef.current) return;
    const svgElement = svgRef.current.cloneNode(true) as SVGSVGElement;
    
    const bbox = svgRef.current.getBoundingClientRect();
    const width = bbox.width || 800;
    const height = bbox.height || 600;
    
    svgElement.setAttribute('width', width.toString());
    svgElement.setAttribute('height', height.toString());

    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("width", "100%");
    bgRect.setAttribute("height", "100%");
    bgRect.setAttribute("fill", "#050505");
    svgElement.insertBefore(bgRect, svgElement.firstChild);

    const serializer = new XMLSerializer();
    const source = '<?xml version="1.0" standalone="no"?>\r\n' + serializer.serializeToString(svgElement);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = 2;
      canvas.width = width * scale;
      canvas.height = height * scale;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = 'relationship-graph.png';
        a.click();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-white/30" />
          <input
            type="text"
            placeholder="Filter nodes or relations..."
            value={filterTerm}
            onChange={(e) => setFilterTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg text-[16px] md:text-sm py-2 pl-9 pr-3 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 text-white placeholder:text-white/30 transition-all"
          />
        </div>
      </div>
      
      <div className="relative w-full h-72 bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden shadow-inner">
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          <button 
            onClick={exportPng}
            className="p-2 bg-black/40 hover:bg-white/10 border border-white/5 text-white/70 hover:text-white rounded-lg transition-all backdrop-blur-md"
            title="Export as PNG"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          <button 
            onClick={exportSvg}
            className="p-2 bg-black/40 hover:bg-white/10 border border-white/5 text-white/70 hover:text-white rounded-lg transition-all backdrop-blur-md"
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
            className="p-2 bg-black/40 hover:bg-white/10 border border-white/5 text-white/70 hover:text-white rounded-lg transition-all backdrop-blur-md"
            title="Reset Zoom"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
        
        <svg ref={svgRef} className="w-full h-full" />

        {selectedNode && (
          <div className="absolute top-3 left-3 bottom-3 w-64 bg-[#0a0a0a]/90 backdrop-blur-md border border-white/10 p-4 rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.05)] flex flex-col z-20">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h3 className="text-cyan-400 font-display font-semibold truncate text-base tracking-wide" title={selectedNode}>{selectedNode}</h3>
              <button onClick={() => setSelectedNode(null)} className="text-white/40 hover:text-white transition-colors p-1 hover:bg-white/5 rounded-lg shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm text-white/70 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <p className="mb-2 text-[10px] text-white/40 uppercase tracking-widest font-medium">Connections</p>
              {data.filter(d => d.source === selectedNode || d.target === selectedNode).length > 0 ? (
                <ul className="space-y-2">
                  {data.filter(d => d.source === selectedNode || d.target === selectedNode).map((d, i) => (
                    <li key={i} className="bg-white/5 p-3 rounded-lg border border-white/5 flex flex-col gap-1 hover:border-cyan-500/30 transition-colors">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-white/40 font-light">{d.source === selectedNode ? 'Target:' : 'Source:'}</span>
                        <span className="text-cyan-400 font-medium truncate" title={d.source === selectedNode ? d.target : d.source}>{d.source === selectedNode ? d.target : d.source}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-white/40 font-light">Relation:</span>
                        <span className="text-white/90 italic font-light truncate" title={d.relation}>{d.relation}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-white/40 italic text-xs font-light">No direct connections found.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
