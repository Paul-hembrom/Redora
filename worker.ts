import sql from './server/db.js';
import {
  processInteractiveProJob,
  processVideoLessonJob,
  processSceneAssets,
} from './server/videoPipeline.js';
import { generateStoryboardJob } from './server/storyboardEngine.js';

const MAX_ATTEMPTS = 3;

async function drainOne(): Promise<boolean> {
  // FOR UPDATE SKIP LOCKED keeps this safe if you ever run more than one replica.
  const claimed = await sql`
    UPDATE job_queue
       SET status = 'running', started_at = NOW(), attempts = attempts + 1
     WHERE id = (
       SELECT id FROM job_queue
        WHERE status = 'queued'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     )
    RETURNING *`;

  if (!claimed.length) return false;

  const job = claimed[0];
  const p = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
  console.log(`[worker] claimed ${job.job_type} (${job.id}) attempt ${job.attempts}`);

  try {
    switch (job.job_type) {
      case 'interactive_pro':
        await processInteractiveProJob(p.jobId, p.chapterId, p.org_id, p.document_id);
        break;
      case 'video_lesson':
        await processVideoLessonJob(p.jobId, p.chapterId, p.org_id, p.document_id);
        break;
      case 'storyboard':
        await generateStoryboardJob(
          p.jobId, p.organization_id, p.document_id, p.chapter_id, p.title, p.summary,
          p.key_concepts, p.subject, p.grade_level, p.visual_style, p.narration_style
        );
        break;
      case 'scene_assets':
        await processSceneAssets(p.sceneId, p.orgId, p.visualPrompt, p.narration, p.duration);
        break;
      default:
        throw new Error(`Unknown job_type: ${job.job_type}`);
    }

    await sql`UPDATE job_queue SET status='done', finished_at=NOW() WHERE id=${job.id}`;
    console.log(`[worker] done ${job.job_type} (${job.id})`);

  } catch (e: any) {
    const final = job.attempts >= MAX_ATTEMPTS ? 'failed' : 'queued';
    await sql`UPDATE job_queue SET status=${final}, error=${e.message} WHERE id=${job.id}`;

    // The client polls generation_jobs, NOT job_queue. Without this the UI
    // spins forever on a job that has already given up.
    if (final === 'failed' && p.jobId) {
      await sql`UPDATE generation_jobs
                   SET status='failed', error_message=${e.message}
                 WHERE id=${p.jobId}`;
    }
    console.error(`[worker] ${job.job_type} attempt ${job.attempts} failed:`, e.message);
  }
  return true;
}

async function reclaimStaleJobs() {
  try {
    const reclaimed = await sql`
      UPDATE job_queue
         SET status = 'queued', started_at = NULL
       WHERE status = 'running'
         AND started_at < NOW() - INTERVAL '30 minutes'
      RETURNING id`;
    if (reclaimed.length) {
      console.log(`[worker] reclaimed ${reclaimed.length} stale job(s)`);
    }
  } catch (e: any) {
    console.error('[worker] reclaimStaleJobs error:', e.message);
  }
}

let shuttingDown = false;
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => { console.log(`[worker] ${sig} received`); shuttingDown = true; });
}

(async function loop() {
  console.log('[worker] started');
  let loopCount = 0;
  while (!shuttingDown) {
    try {
      loopCount++;
      if (loopCount % 12 === 1) {
        await reclaimStaleJobs();
      }
      const did = await drainOne();
      await new Promise(r => setTimeout(r, did ? 250 : 5000));
    } catch (e) {
      console.error('[worker] loop error:', e);
      await new Promise(r => setTimeout(r, 10000));
    }
  }
  await sql.end({ timeout: 5 });
  console.log('[worker] stopped');
  process.exit(0);
})();
