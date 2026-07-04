const fs = require('fs');
let code = fs.readFileSync('src/components/ErrorBoundary.tsx', 'utf8');

const catchRegex = /public componentDidCatch\(error: Error, errorInfo: ErrorInfo\) \{\s*console\.error\('Uncaught error:', error, errorInfo\);\s*\}/;
const catchReplacement = `public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Workspace crash:', error, errorInfo);
  }`;
code = code.replace(catchRegex, catchReplacement);

const errorDisplayRegex = /\{this\.state\.error\?\.message \|\| 'Unknown error'\}/;
const errorDisplayReplacement = `<p style={{ color: 'red', marginTop: '1rem', whiteSpace: 'pre-wrap', textAlign: 'left' }}>{this.state.error?.message}</p>\n              <p style={{ color: '#ffaaaa', marginTop: '0.5rem', fontSize: '10px', whiteSpace: 'pre-wrap', textAlign: 'left' }}>{this.state.error?.stack}</p>`;
code = code.replace(errorDisplayRegex, errorDisplayReplacement);

fs.writeFileSync('src/components/ErrorBoundary.tsx', code);
