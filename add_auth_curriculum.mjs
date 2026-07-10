import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

// Replace the route definition to include authenticate
content = content.replace(
`app.get('/api/curriculum', async (req: any, res) => {`,
`app.get('/api/curriculum', authenticate, async (req: any, res) => {`);

fs.writeFileSync('server.ts', content);
console.log('done');
