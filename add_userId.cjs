const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const generateProTarget = `      INSERT INTO job_queue (id, job_type, payload, status)
      VALUES (\${uuidv4()}, 'interactive_pro',
              \${sql.json({ jobId, chapterId, org_id, document_id })}, 'queued')`;

const generateProReplace = `      INSERT INTO job_queue (id, job_type, payload, status)
      VALUES (\${uuidv4()}, 'interactive_pro',
              \${sql.json({ jobId, chapterId, org_id, document_id, userId: req.userId })}, 'queued')`;

code = code.replace(generateProTarget, generateProReplace);

const workerTarget = `    if (job.job_type === 'interactive_pro') {
      await processInteractiveProJob(p.jobId, p.chapterId, p.org_id, p.document_id);`;

const workerReplace = `    if (job.job_type === 'interactive_pro') {
      await processInteractiveProJob(p.jobId, p.chapterId, p.org_id, p.document_id);
      if (p.userId) await verifyAndIncrementUsage(p.userId, 'interactive', p.org_id, false);`;

code = code.replace(workerTarget, workerReplace);

fs.writeFileSync('server.ts', code);
