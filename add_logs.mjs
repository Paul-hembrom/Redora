import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

// Pexels replacement
const pexelsTarget = `const pexelsRes = await fetch(\`https://api.pexels.com/v1/search?query=\${encodeURIComponent(query)}&per_page=3\`, {
                headers: { Authorization: pexelsKey }
              });`;
const pexelsReplacement = `const pexelsUrl = \`https://api.pexels.com/v1/search?query=\${encodeURIComponent(query)}&per_page=3\`;
              console.warn(\`[Pexels] Requesting URL: \${pexelsUrl}\`);
              const pexelsRes = await fetch(pexelsUrl, {
                headers: { Authorization: pexelsKey }
              });
              const pexelsText = await pexelsRes.clone().text();
              console.warn(\`[Pexels] Response Status: \${pexelsRes.status}, Body: \${pexelsText.substring(0, 200)}\`);`;

content = content.replace(pexelsTarget, pexelsReplacement);
content = content.replace(
  `} catch (err) {}`,
  `} catch (err: any) { console.warn(\`[Pexels] Error: \${err.message}\`); }`
); // Note: We might replace all empty catch blocks if we just do string replace. Better to target specifically.

fs.writeFileSync('server.ts', content);
console.log('done');
