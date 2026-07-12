import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

const oldListen = `app.listen(PORT, '0.0.0.0', () => {
  console.log(\`Server running on http://0.0.0.0:\${PORT}\`);
});`;
const newListen = `if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(\`Server running on http://0.0.0.0:\${PORT}\`);
  });
}`;

if (code.includes(oldListen)) {
    code = code.replace(oldListen, newListen);
    fs.writeFileSync('server.ts', code);
    console.log('Patched listen!');
} else {
    console.log('Could not find listen block');
}
