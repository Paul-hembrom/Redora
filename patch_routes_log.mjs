import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

const logCode = `
console.log('=== REGISTERED ROUTES ===');
app._router.stack.forEach((r) => {
  if (r.route && r.route.path) {
    console.log(Object.keys(r.route.methods).join(', ').toUpperCase() + ' ' + r.route.path);
  }
});
console.log('=========================');
`;

if (!code.includes('REGISTERED ROUTES')) {
  // insert before export default app;
  code = code.replace('export default app;', logCode + '\nexport default app;');
  fs.writeFileSync('server.ts', code);
  console.log('Added route logging');
}
