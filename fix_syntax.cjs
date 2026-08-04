const fs = require('fs');

let doc = fs.readFileSync('src/components/DocumentReader.tsx', 'utf-8');
doc = doc.replace('downloadBtns.forEach(btn => try { btn.remove(); } catch(e) {});', 'downloadBtns.forEach(btn => { try { btn.remove(); } catch(e) {} });');
// Note: sed -i in task-285 might have changed it to '{ try ... }' already. Let's handle both.
doc = doc.replace('downloadBtns.forEach(btn => { try { btn.remove(); } catch(e) {} });', 'downloadBtns.forEach(btn => { try { btn.remove(); } catch(e) {} });');
fs.writeFileSync('src/components/DocumentReader.tsx', doc);

let rel = fs.readFileSync('src/components/RelationshipGraph.tsx', 'utf-8');
rel = rel.replace('d3.select(svgRef.current).try { selectAll("*").remove(); } catch(e) {};', 'try { d3.select(svgRef.current).selectAll("*").remove(); } catch(e) {}');
rel = rel.replace('if (svgRef.current) d3.select(svgRef.current).try { selectAll("*").remove(); } catch(e) {};', 'if (svgRef.current) { try { d3.select(svgRef.current).selectAll("*").remove(); } catch(e) {} }');
fs.writeFileSync('src/components/RelationshipGraph.tsx', rel);
