const fs = require('fs');

let server = fs.readFileSync('server.ts', 'utf-8');

const targetFunc = `async function startServer() {`;

const newFunc = `async function startServer() {
  if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    // In-process worker for non-Vercel environments
    setInterval(async () => {
      try {
        const res = await fetch(\`http://127.0.0.1:\${PORT}/api/jobs/drain\`, {
          method: 'POST',
          headers: { 'x-cron-secret': process.env.CRON_SECRET || 'dev_secret' }
        });
        const data = await res.json();
        if (data.error) {
           console.log("[worker] drain error:", data.error);
        }
      } catch (e) {}
    }, 5000);
  }`;

server = server.replace(targetFunc, newFunc);
fs.writeFileSync('server.ts', server);
