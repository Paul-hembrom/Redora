const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf8');
const hashFileCode = `
export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

`;
if (!code.includes('hashFile(file: File)')) {
  // Add it before the processDocument export
  code = code.replace('export async function processDocument', hashFileCode + 'export async function processDocument');
  fs.writeFileSync('src/lib/documentProcessor.ts', code);
}
