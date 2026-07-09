import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

const routeStart = "app.post('/api/curriculum/generate'";
const routeEndStr = "Error in /api/curriculum/generate:\", err);\n    res.status(500).json({ error: err.message });\n  }\n});";

const startIdx = content.indexOf(routeStart);
if (startIdx === -1) {
  console.log("Could not find start of route.");
  process.exit(1);
}
let endIdx = content.indexOf(routeEndStr, startIdx);
if (endIdx === -1) {
  console.log("Could not find end of route.");
  process.exit(1);
}
endIdx += routeEndStr.length;

const routeStr = content.substring(startIdx, endIdx);

// Remove route from its current position
content = content.substring(0, startIdx) + content.substring(endIdx);

// Insert it right before console.log('=== END ROUTES ===');
const insertTarget = "console.log('=== END ROUTES ===');";
const insertIdx = content.indexOf(insertTarget);

if (insertIdx === -1) {
  console.log("Could not find insertion target.");
  process.exit(1);
}

// Add the requested console.log before the route
const modifiedRouteStr = "\nconsole.log('>>> REGISTERING CURRICULUM GENERATE ROUTE <<<');\n" + routeStr.replace(
  "console.log('>>> CURRICULUM GENERATE ENDPOINT HIT <<<');", 
  "console.log('>>> CURRICULUM GENERATE HANDLER CALLED <<<');"
) + "\n\n";

content = content.substring(0, insertIdx) + modifiedRouteStr + content.substring(insertIdx);

fs.writeFileSync('server.ts', content);
console.log("Route moved successfully.");
