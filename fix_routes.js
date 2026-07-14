import fs from 'fs';
let lines = fs.readFileSync('server.ts', 'utf8').split('\n');

const endRoutesIdx = lines.findIndex(l => l.includes("console.log('=== END ROUTES ===');"));
const startServerIdx = lines.findIndex(l => l.includes("async function startServer() {"));

// Find the start of app.get("/api/curriculum"
const curriculumStart = lines.findIndex((l, i) => i > startServerIdx && l.includes('app.get("/api/curriculum"'));
// Find the end of app.get("/api/curriculum"
const curriculumEnd = lines.findIndex((l, i) => i > curriculumStart && l.includes('});') && lines[i-1] && lines[i-1].includes('res.status(500).json({ error: err.message });'));

if (curriculumStart !== -1 && curriculumEnd !== -1) {
  const curriculumCode = lines.slice(curriculumStart, curriculumEnd + 1);
  const debugCode = [
    'app.get("/api/curriculum-test", (req, res) => {',
    '  res.json({ ok: true, time: new Date().toISOString() });',
    '});'
  ];
  
  // Remove curriculum code from original place
  lines.splice(curriculumStart, curriculumEnd - curriculumStart + 1);
  
  // Recalculate endRoutesIdx
  const newEndRoutesIdx = lines.findIndex(l => l.includes("console.log('=== END ROUTES ===');"));
  
  // Insert before === END ROUTES ===
  lines.splice(newEndRoutesIdx, 0, ...debugCode, ...curriculumCode);
  
  fs.writeFileSync('server.ts', lines.join('\n'));
  console.log("Successfully moved curriculum routes outside of startServer");
} else {
  console.log("Could not find curriculum route bounds:", curriculumStart, curriculumEnd);
}
