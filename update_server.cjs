const fs = require('fs');

const content = fs.readFileSync('server.ts', 'utf8');

const anchor1 = 'app.use(cookieParser());';

const regex = /\/\/ DO NOT REMOVE – Gateway token exchange for teachers\/students\napp\.all\(\[\'\/auth\/token-exchange\', \'\/api\/auth\/token-exchange\'\], async \(req, res\) => \{[\s\S]*?\}\);\n/;
const match = content.match(regex);

if (match) {
    const block = match[0];
    let newContent = content.replace(block, '');
    
    // Also remove the old trust proxy line from its old location
    const proxyLine = '\n// --- Trust Proxy for Secure Cookies Behind Vercel ---\napp.set(\'trust proxy\', 1);\n';
    newContent = newContent.replace(proxyLine, '\n');
    
    // Insert after anchor1
    const parts = newContent.split(anchor1);
    
    newContent = parts[0] + anchor1 + '\n' + proxyLine + '\n' + block + parts[1];
    
    fs.writeFileSync('server.ts', newContent, 'utf8');
    console.log('Update successful');
} else {
    console.log('Block not found');
}
