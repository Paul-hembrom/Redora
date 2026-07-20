const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
    /ws\.on\('error', \(err\) => \{/g,
    `if (ws.source) { ws.source.on('error', (err) => console.error('Cartesia WS error:', err)); }
      ws.on('error', (err) => {`
);

fs.writeFileSync('server.ts', code);
