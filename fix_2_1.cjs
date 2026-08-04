const fs = require('fs');
let server = fs.readFileSync('server.ts', 'utf-8');

// 1. /api/lessons/generate-pro (~1346)
const proDispatchOld = `    processInteractiveProJob(jobId, chapterId, org_id, document_id).catch(console.error);
    res.status(202).json({ job_id: jobId });`;
const proDispatchNew = `    await sql\`
      INSERT INTO job_queue (id, job_type, payload, status)
      VALUES (\${uuidv4()}, 'interactive_pro',
              \${sql.json({ jobId, chapterId, org_id, document_id, userId: req.userId })}, 'queued')
    \`;
    res.status(202).json({ job_id: jobId });`;
server = server.replace(proDispatchOld, proDispatchNew);
if(server.indexOf(proDispatchNew) === -1) console.log("Failed to replace proDispatch");

// 2. /api/lessons/generate (~1190)
const storyboardOld = `    generateStoryboardJob(
      jobId, organization_id, document_id, chapter_id, title, summary, 
      key_concepts, subject, grade_level, visual_style, narration_style
    ).catch(console.error);
    res.status(202).json({ job_id: jobId });`;
const storyboardNew = `    await sql\`
      INSERT INTO job_queue (id, job_type, payload, status)
      VALUES (\${uuidv4()}, 'storyboard',
              \${sql.json({ jobId, organization_id, document_id, chapter_id, title, summary,
                           key_concepts, subject, grade_level, visual_style, narration_style })},
              'queued')
    \`;
    res.status(202).json({ job_id: jobId });`;
server = server.replace(storyboardOld, storyboardNew);

// 3. /api/scenes/:id/regenerate (~1424)
const sceneRegenOld = `    processSceneAssets(scene.id, scene.organization_id, scene.visual_prompt, scene.narration, scene.estimated_duration_seconds).catch(console.error);
    res.json({ success: true, scene_id: scene.id });`;
const sceneRegenNew = `    await sql\`
      INSERT INTO job_queue (id, job_type, payload, status)
      VALUES (\${uuidv4()}, 'scene_assets',
              \${sql.json({ sceneId: scene.id, orgId: scene.organization_id,
                           visualPrompt: scene.visual_prompt, narration: scene.narration,
                           duration: scene.estimated_duration_seconds })},
              'queued')
    \`;
    res.json({ success: true, scene_id: scene.id });`;
server = server.replace(sceneRegenOld, sceneRegenNew);

// 4. Update the worker endpoint
const workerOld = `app.post('/api/jobs/drain', async (req, res) => {
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
      if (p.userId) await verifyAndIncrementUsage(p.userId, 'interactive', p.org_id, false);
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
});`;

const workerNew = `const MAX_JOB_ATTEMPTS = 3;

app.post('/api/jobs/drain', async (req, res) => {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const claimed = await sql\`
    UPDATE job_queue
       SET status = 'running', started_at = NOW(), attempts = attempts + 1
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
    switch (job.job_type) {
      case 'interactive_pro':
        await processInteractiveProJob(p.jobId, p.chapterId, p.org_id, p.document_id);
        if (p.userId) await incrementUsage(p.userId, 'video', p.org_id); // quota on completion
        break;
      case 'video_lesson':
        await processVideoLessonJob(p.jobId, p.chapterId, p.org_id, p.document_id);
        break;
      case 'storyboard':
        const { generateStoryboardJob } = await import('./server/storyboardEngine.js');
        await generateStoryboardJob(
          p.jobId, p.organization_id, p.document_id, p.chapter_id, p.title, p.summary,
          p.key_concepts, p.subject, p.grade_level, p.visual_style, p.narration_style
        );
        break;
      case 'scene_assets':
        await processSceneAssets(p.sceneId, p.orgId, p.visualPrompt, p.narration, p.duration);
        break;
      default:
        throw new Error(\`Unknown job_type: \${job.job_type}\`);
    }

    await sql\`UPDATE job_queue SET status = 'done', finished_at = NOW() WHERE id = \${job.id}\`;
    res.json({ drained: 1, job_type: job.job_type, status: 'done' });

  } catch (e: any) {
    const finalStatus = job.attempts >= MAX_JOB_ATTEMPTS ? 'failed' : 'queued';
    await sql\`
      UPDATE job_queue
         SET status = \${finalStatus},
             error = \${e.message},
             finished_at = \${finalStatus === 'failed' ? sql\`NOW()\` : null}
       WHERE id = \${job.id}
    \`;
    console.error(\`[jobs] \${job.job_type} attempt \${job.attempts} failed:\`, e.message);
    res.json({ drained: 1, job_type: job.job_type, status: finalStatus });
  }
});`;
server = server.replace(workerOld, workerNew);

fs.writeFileSync('server.ts', server);
