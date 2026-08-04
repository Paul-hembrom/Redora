const fs = require('fs');
let server = fs.readFileSync('server.ts', 'utf-8');

const regex = /app\.post\('\/api\/chapters\/:id\/generate-lesson', authenticate, generateLessonLimiter, async \(req: any, res\) => \{[\s\S]*?(?=app\.)/m;

const match = server.match(regex);
if (match) {
  const replacement = `app.post('/api/chapters/:id/generate-lesson', authenticate, generateLessonLimiter, async (req: any, res) => {
  return res.status(501).json({
    error: 'Video lesson generation is not yet available. Please use Interactive Pro instead.'
  });
});\n\n`;
  server = server.replace(regex, replacement);
  fs.writeFileSync('server.ts', server);
  console.log("Replaced generate-lesson route");
} else {
  console.log("Could not find route");
}
