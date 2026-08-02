import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

const target2 = `  if (buffer.trim()) {
    try {
      onChunk(JSON.parse(buffer.trim()));
    } catch (e) {}
  }`;

const replacement2 = `  if (buffer.trim()) {
    buffer = buffer.replace(/\\}\\s*\\{/g, '}\\n{');
    const lines = buffer.split('\\n');
    for (const line of lines) {
      if (line.trim()) {
        try {
            const chunk = JSON.parse(line.trim());
            onChunk(chunk);
        } catch (e) {
            console.error("Failed to parse final chunk:", line.trim().substring(0, 100));
        }
      }
    }
  }`;

content = content.replace(target2, replacement2);
fs.writeFileSync('server.ts', content);
