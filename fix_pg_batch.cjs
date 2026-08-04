const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const oldTarget = `        flatten(chapters);

        await tx\`INSERT INTO chapters \${tx(flatChapters)}\`;
      }
    });`;

const newTarget = `        flatten(chapters);

        const BATCH = 500;
        for (let i = 0; i < flatChapters.length; i += BATCH) {
          const slice = flatChapters.slice(i, i + BATCH);
          await tx\`INSERT INTO chapters \${tx(slice)}\`;
        }
        console.log(\`[documents] Inserted \${flatChapters.length} chapter rows in \${Math.ceil(flatChapters.length / BATCH)} batches.\`);
      }
    });`;

content = content.replace(oldTarget, newTarget);
fs.writeFileSync('server.ts', content);
console.log("Fixed PG batch limit");
