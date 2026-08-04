const fs = require('fs');

let server = fs.readFileSync('server.ts', 'utf-8');

const proRouteOld = `    try {
      await verifyAndIncrementUsage(req.userId, 'video', orgId);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }`;

const proRouteNew = `    try {
      await verifyUsageLimit(req.userId, 'video', orgId);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }`;

server = server.replace(proRouteOld, proRouteNew);

const dispatchOld = `// Start background processing
    const { processInteractiveProJob } = await import('./server/videoPipeline.js');
    processInteractiveProJob(jobId, chapterId, org_id, document_id).catch(console.error);
    
    // Return early, same job ID system as existing generation pipeline
    res.status(202).json({ job_id: jobId });`;
const dispatchNew = `// Start background processing
    await sql\`
      INSERT INTO job_queue (id, job_type, payload, status)
      VALUES (\${uuidv4()}, 'interactive_pro',
              \${sql.json({ jobId, chapterId, org_id, document_id, userId: req.userId })}, 'queued')
    \`;
    
    // Return early, same job ID system as existing generation pipeline
    res.status(202).json({ job_id: jobId });`;

if (server.includes(dispatchOld)) {
  server = server.replace(dispatchOld, dispatchNew);
}

fs.writeFileSync('server.ts', server);
