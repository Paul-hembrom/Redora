const fs = require('fs');

let server = fs.readFileSync('server.ts', 'utf-8');

const docRouteOld = `    try {
      await verifyAndIncrementUsage(req.userId, 'document', orgId, true);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }

    await sql.begin(async (tx: any) => {`;

const docRouteNew = `    try {
      await verifyUsageLimit(req.userId, 'document', orgId);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }

    await sql.begin(async (tx: any) => {`;

server = server.replace(docRouteOld, docRouteNew);

const txEndOld = `        flatten(chapters);
        await tx\`INSERT INTO chapters \${tx(flatChapters)}\`;
      }
    });

    res.json({ success: true, document_id: id });`;

const txEndNew = `        flatten(chapters);
        await tx\`INSERT INTO chapters \${tx(flatChapters)}\`;
      }
      await incrementUsage(req.userId, 'document', orgId, tx);
    });

    res.json({ success: true, document_id: id });`;

server = server.replace(txEndOld, txEndNew);

fs.writeFileSync('server.ts', server);
