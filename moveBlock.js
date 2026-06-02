const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');

const startIndex = content.indexOf('// --- Gateway Token Exchange Route ---');
let endIndex = content.indexOf('// --- Auth Middleware ---');
endIndex = content.lastIndexOf('});', endIndex) + 3;

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find blocks");
  process.exit(1);
}

const tokenRoute = content.substring(startIndex, endIndex);
let newContent = content.slice(0, startIndex) + content.slice(endIndex);

const insertTarget = 'app.use(cookieParser());\n';
const insertIndex = newContent.indexOf(insertTarget);

if (insertIndex === -1) {
  console.log("Could not find insert point");
  process.exit(1);
}

// Ensure trust proxy is added
const injectedRoute = "\n// --- Trust Proxy for Secure Cookies Behind Vercel ---\napp.set('trust proxy', 1);\n\n" + tokenRoute + "\n";

newContent = newContent.slice(0, insertIndex + insertTarget.length) + injectedRoute + newContent.slice(insertIndex + insertTarget.length);

fs.writeFileSync('server.ts', newContent);
console.log("Successfully moved route and added trust proxy");
