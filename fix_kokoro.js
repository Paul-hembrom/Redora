import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

const target = "buffer += decoder.decode(value, { stream: true });";
const replacement = "buffer += decoder.decode(value, { stream: true });\n      buffer = buffer.replace(/\\}\\s*\\{/g, '}\\n{');";

content = content.replace(target, replacement);

const target2 = `  if (buffer.trim()) {
    try {
        const chunk = JSON.parse(buffer.trim());
        onChunk(chunk);
    } catch (e) {
        console.error("Failed to parse final chunk:", buffer.trim());
    }
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
