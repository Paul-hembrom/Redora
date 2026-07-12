import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');
if (!code.includes("app.get('/api/curriculum/generate'")) {
    const getRoute = `app.get('/api/curriculum/generate', (req, res) => { res.status(401).json({ error: 'Missing access_token' }); });\n`;
    code = code.replace("app.post('/api/curriculum/generate'", getRoute + "app.post('/api/curriculum/generate'");
    fs.writeFileSync('server.ts', code);
    console.log("Added GET route");
}
