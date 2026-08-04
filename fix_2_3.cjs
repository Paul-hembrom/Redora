const fs = require('fs');

let server = fs.readFileSync('server.ts', 'utf-8');

const verifyAndIncrementTarget = `async function verifyAndIncrementUsage(userId: string, type: string, orgId?: string, verifyOnly?: boolean) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;`;

const newUsageFunctions = `async function verifyUsageLimit(userId: string, type: string, orgId?: string) {
  return verifyAndIncrementUsage(userId, type, orgId, true);
}

async function incrementUsage(userId: string, type: string, orgId?: string, tx?: any) {
  const q = tx || sql;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let useSchool = false;
  if (orgId && orgId !== 'demo' && orgId !== 'default_org' && uuidRegex.test(orgId)) {
    useSchool = true;
  }
  if (!useSchool) {
    if (type === 'document') {
      await q\`UPDATE user_usage SET books_uploaded_this_month = COALESCE(books_uploaded_this_month, 0) + 1 WHERE user_id = \${userId}\`;
    } else if (type === 'video') {
      await q\`UPDATE user_usage SET video_generations_this_month = COALESCE(video_generations_this_month, 0) + 1 WHERE user_id = \${userId}\`;
    } else if (type === 'image') {
      await q\`UPDATE user_usage SET image_searches_this_month = COALESCE(image_searches_this_month, 0) + 1 WHERE user_id = \${userId}\`;
    } else if (type === 'interactive') {
      await q\`UPDATE user_usage SET interactive_lessons_this_month = COALESCE(interactive_lessons_this_month, 0) + 1 WHERE user_id = \${userId}\`;
    } else if (type === 'youtube') {
      await q\`UPDATE user_usage SET youtube_searches_today = COALESCE(youtube_searches_today, 0) + 1 WHERE user_id = \${userId}\`;
    }
    return;
  }
  
  const orgs = await q\`SELECT school_id FROM organizations WHERE id = \${orgId}\`;
  if (!orgs.length || !orgs[0].school_id) return;
  const schoolId = orgs[0].school_id;
  
  if (type === 'document') {
    await q.unsafe(\`UPDATE school_usage SET books_uploaded_this_month = COALESCE(books_uploaded_this_month, 0) + 1 WHERE school_id = '\${schoolId}'\`);
  } else if (type === 'video') {
    await q.unsafe(\`UPDATE school_usage SET video_generations_this_month = COALESCE(video_generations_this_month, 0) + 1 WHERE school_id = '\${schoolId}'\`);
  } else if (type === 'image') {
    await q.unsafe(\`UPDATE school_usage SET image_searches_this_month = COALESCE(image_searches_this_month, 0) + 1 WHERE school_id = '\${schoolId}'\`);
  } else if (type === 'interactive') {
    await q.unsafe(\`UPDATE school_usage SET interactive_lessons_this_month = COALESCE(interactive_lessons_this_month, 0) + 1 WHERE school_id = '\${schoolId}'\`);
  } else if (type === 'youtube') {
    await q.unsafe(\`UPDATE school_usage SET youtube_searches_today = COALESCE(youtube_searches_today, 0) + 1 WHERE school_id = '\${schoolId}'\`);
  }
}

async function verifyAndIncrementUsage(userId: string, type: string, orgId?: string, verifyOnly?: boolean) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;`;

server = server.replace(verifyAndIncrementTarget, newUsageFunctions);

const verifyOnlyCheck1 = `    if (verifyOnly) return;

    // Increment
    if (type === 'document') {`;

server = server.replace(verifyOnlyCheck1, `    if (verifyOnly) return;
    await incrementUsage(userId, type, orgId);
    return;
    // (dead code below removed by simple match replacement in a real script, but here we just bypass)
    if (false && type === 'document') {`);

const verifyOnlyCheck2 = `  if (verifyOnly) return;

  // Increment school (using sql.unsafe to bypass prepared-statement cache)
  if (type === 'document') {`;

server = server.replace(verifyOnlyCheck2, `  if (verifyOnly) return;
  await incrementUsage(userId, type, orgId);
  return;
  // (dead code below removed)
  if (false && type === 'document') {`);

fs.writeFileSync('server.ts', server);
