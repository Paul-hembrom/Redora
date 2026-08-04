const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const targetDocs = `    try {
      await verifyAndIncrementUsage(req.userId, 'document', orgId);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }

    await sql.begin(async (tx: any) => {`;
    
const replaceDocs = `    try {
      await verifyAndIncrementUsage(req.userId, 'document', orgId, true);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }

    await sql.begin(async (tx: any) => {`;

code = code.replace(targetDocs, replaceDocs);

// After tx resolves, call verifyAndIncrementUsage again but this time to increment.
// Wait, the tx ends with:
// `      }
//    });
//    res.json({ success: true, document_id: id });`

const targetDocsEnd = `        flatten(chapters);
        await tx\`INSERT INTO chapters \${tx(flatChapters)}\`;
      }
    });
    res.json({ success: true, document_id: id });`;

const replaceDocsEnd = `        flatten(chapters);
        await tx\`INSERT INTO chapters \${tx(flatChapters)}\`;
      }
    });
    
    // Now that transaction succeeded, increment usage
    await verifyAndIncrementUsage(req.userId, 'document', orgId, false);
    
    res.json({ success: true, document_id: id });`;

code = code.replace(targetDocsEnd, replaceDocsEnd);

// For P1-17 - large documents exceed postgres parameter limit
const targetInsert = `        flatten(chapters);
        await tx\`INSERT INTO chapters \${tx(flatChapters)}\`;
      }
    });`;

const replaceInsert = `        flatten(chapters);
        const BATCH = 500;
        for (let i = 0; i < flatChapters.length; i += BATCH) {
          const slice = flatChapters.slice(i, i + BATCH);
          await tx\`INSERT INTO chapters \${tx(slice)}\`;
        }
      }
    });`;

code = code.replace(targetInsert, replaceInsert);

fs.writeFileSync('server.ts', code);
