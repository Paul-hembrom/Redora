import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

const logs = [
  '>>> /api/curriculum HIT – query:',
  '[Curriculum API] Received request - raw grade:',
  '[Curriculum API] Query complete. Found',
  '[Curriculum API] Response JSON (truncated):'
];

for (const log of logs) {
  if (!code.includes(log)) {
    console.error('Missing log:', log);
  } else {
    console.log('Found log:', log);
  }
}
