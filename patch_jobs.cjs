const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Add drainer route
const drainerRoute = `
app.post('/api/jobs/drain', async (req, res) => {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const claimed = await sql\`
    UPDATE job_queue SET status = 'running', started_at = NOW()
    WHERE id = (
      SELECT id FROM job_queue
      WHERE status = 'queued'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  \`;
  if (!claimed.length) return res.json({ drained: 0 });

  const job = claimed[0];
  const p = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;

  try {
    if (job.job_type === 'interactive_pro') {
      await processInteractiveProJob(p.jobId, p.chapterId, p.org_id, p.document_id);
    } else if (job.job_type === 'video_lesson') {
      await processVideoLessonJob(p.jobId, p.chapterId, p.org_id, p.document_id);
    } else if (job.job_type === 'generate_storyboard') {
      const { generateStoryboardJob } = await import('./server/storyboardEngine.js');
      await generateStoryboardJob(p.jobId, p.organization_id, p.document_id, p.chapter_id, p.title, p.summary, p.key_concepts, p.subject, p.grade_level, p.visual_style, p.narration_style);
    } else if (job.job_type === 'scene_assets') {
      await processSceneAssets(p.scene_id, p.organization_id, p.visual_prompt, p.narration, p.estimated_duration_seconds);
    }
    await sql\`UPDATE job_queue SET status = 'done', finished_at = NOW() WHERE id = \${job.id}\`;
  } catch (e) {
    await sql\`UPDATE job_queue SET status = 'failed', error = \${e.message} WHERE id = \${job.id}\`;
  }
  res.json({ drained: 1 });
});
`;

code = code.replace("async function startServer() {", drainerRoute + "\nasync function startServer() {");

// Replace detached promises
code = code.replace(
  /generateStoryboardJob\(\s*jobId,\s*organization_id,\s*document_id,\s*chapter_id,\s*title,\s*summary,\s*key_concepts,\s*subject,\s*grade_level,\s*visual_style,\s*narration_style\s*\)\.catch\(console\.error\);/g,
  `await sql\`
      INSERT INTO job_queue (id, job_type, payload, status)
      VALUES (\${uuidv4()}, 'generate_storyboard',
              \${sql.json({ jobId, organization_id, document_id, chapter_id, title, summary, key_concepts, subject, grade_level, visual_style, narration_style })}, 'queued')
    \`;`
);

code = code.replace(
  /processVideoLessonJob\(jobId,\s*chapterId,\s*org_id,\s*document_id\)\.catch\(console\.error\);/g,
  `await sql\`
      INSERT INTO job_queue (id, job_type, payload, status)
      VALUES (\${uuidv4()}, 'video_lesson',
              \${sql.json({ jobId, chapterId, org_id, document_id })}, 'queued')
    \`;`
);

code = code.replace(
  /processInteractiveProJob\(jobId,\s*chapterId,\s*org_id,\s*document_id\)\.catch\(console\.error\);/g,
  `await sql\`
      INSERT INTO job_queue (id, job_type, payload, status)
      VALUES (\${uuidv4()}, 'interactive_pro',
              \${sql.json({ jobId, chapterId, org_id, document_id })}, 'queued')
    \`;`
);

code = code.replace(
  /processSceneAssets\(scene\.id,\s*scene\.organization_id,\s*scene\.visual_prompt,\s*scene\.narration,\s*scene\.estimated_duration_seconds\)\.catch\(console\.error\);/g,
  `await sql\`
      INSERT INTO job_queue (id, job_type, payload, status)
      VALUES (\${uuidv4()}, 'scene_assets',
              \${sql.json({ scene_id: scene.id, organization_id: scene.organization_id, visual_prompt: scene.visual_prompt, narration: scene.narration, estimated_duration_seconds: scene.estimated_duration_seconds })}, 'queued')
    \`;`
);

fs.writeFileSync('server.ts', code);
