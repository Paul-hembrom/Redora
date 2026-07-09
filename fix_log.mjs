import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

const targetStr = `app.post('/api/curriculum/generate', authenticate, async (req: any, res) => {
  try {
    if (!process.env.SUPERADMIN_EMAIL) {`;

const replaceStr = `app.post('/api/curriculum/generate', authenticate, async (req: any, res) => {
  console.log('>>> CURRICULUM GENERATE ENDPOINT HIT <<<');
  try {
    if (!process.env.SUPERADMIN_EMAIL) {`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replaceStr);
  fs.writeFileSync('server.ts', content);
  console.log("Log added successfully.");
} else {
  console.log("Could not find the target string to replace.");
}
