const fs = require('fs');
let rel = fs.readFileSync('src/components/RelationshipGraph.tsx', 'utf-8');
rel = rel.replace(/d3\.select\(svgRef\.current\)\.try \{ selectAll\("\*"\)\.remove\(\); \} catch\(e\) \{\};/g, 'try { d3.select(svgRef.current).selectAll("*").remove(); } catch(e) {}');
rel = rel.replace(/if \(svgRef\.current\) d3\.select\(svgRef\.current\)\.try \{ selectAll\("\*"\)\.remove\(\); \} catch\(e\) \{\};/g, 'if (svgRef.current) { try { d3.select(svgRef.current).selectAll("*").remove(); } catch(e) {} }');
fs.writeFileSync('src/components/RelationshipGraph.tsx', rel);
