import fs from 'fs';

let content = fs.readFileSync('server/lessonOrchestrator.ts', 'utf-8');

const regex = /try\s*\{\s*const response = await ai\.models\.generateContent\(\{\s*model: "gemini-2\.5-flash",[\s\S]*?\}\s*catch\(e\)\s*\{\s*console\.error\("Failed to enrich Maya personality:", e\);\s*\}/m;

const match = content.match(regex);
if (match) {
  const replacement = match[0].replace(
    'console.error("Failed to enrich Maya personality:", e);',
    'console.warn("Maya personality enrichment failed, using raw steps", e.message || e);'
  );
  content = content.replace(regex, replacement);
  fs.writeFileSync('server/lessonOrchestrator.ts', content);
} else {
  console.log("Could not find regex match!");
}
