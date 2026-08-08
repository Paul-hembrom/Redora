import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}
let finalDbUrl = dbUrl;
try {
  const parsedDb = new URL(finalDbUrl);
  if (parsedDb.hostname.includes('pooler.supabase.com') && parsedDb.username === 'postgres') {
    const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    if (sbUrl) {
      let sbUrlStr = sbUrl;
      if (!sbUrlStr.startsWith('http')) {
        sbUrlStr = 'https://' + sbUrlStr;
      }
      const parsedSb = new URL(sbUrlStr);
      const projectRef = parsedSb.hostname.split('.')[0];
      if (projectRef && projectRef !== 'localhost' && projectRef !== '127') {
        parsedDb.username = `postgres.${projectRef}`;
        finalDbUrl = parsedDb.toString();
        console.log(`Automatically updated pooler username to include project ref: postgres.${projectRef}`);
      }
    } else {
      console.warn('WARNING: Using Supabase pooler with username "postgres" but SUPABASE_URL is not set. You may need to update DATABASE_URL to include your project ref in the username (e.g. postgres.[project-ref]).');
    }
  }
} catch (e) {
  console.log('Could not parse database URL to auto-inject project ref');
}

const url = new URL(finalDbUrl);
console.log(`Connecting to database: ${url.hostname}:${url.port} as username: ${url.username}`);

export let dbReady = process.env.VERCEL ? true : false;

// Handle background connection rejections gracefully without crashing process
const isDbError = (err: any) => {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  const code = (err.code || '').toLowerCase();
  return (
    msg.includes('authentication did not complete') ||
    msg.includes('failed to connect to database') ||
    msg.includes('unable to check out connection') ||
    msg.includes('echeckouttimeout') ||
    msg.includes('connection_closed') ||
    msg.includes('connect_timeout') ||
    code === 'echeckouttimeout' ||
    code === 'connect_timeout'
  );
};

process.on('unhandledRejection', (reason: any) => {
  if (isDbError(reason)) {
    console.warn('[db] Background database connection issue caught:', reason?.message || reason);
    dbReady = false;
  } else {
    console.error('[process] Unhandled Rejection:', reason);
  }
});

process.on('uncaughtException', (err: any) => {
  if (isDbError(err)) {
    console.warn('[db] Background database connection error caught:', err?.message || err);
    dbReady = false;
  } else {
    console.error('[process] Uncaught Exception:', err);
  }
});

const isLocal = finalDbUrl.includes('localhost') || finalDbUrl.includes('127.0.0.1');

const isServerless = Boolean(process.env.VERCEL);

// Configure postgres client
const sql = postgres(finalDbUrl, {
  ssl: isLocal ? false : { rejectUnauthorized: false }, // Avoid SSL certificate validation hangs/failures on remote connection
  max: isServerless ? 1 : 5, // 1 for Vercel serverless, 5 for persistent Railway worker/server
  idle_timeout: isServerless ? 20 : 0, // Release idle connections quickly on Vercel
  max_lifetime: 60 * 10, // recycle connections every 10 minutes
  connect_timeout: 10, // Fail fast instead of blocking a request for 15s
  prepare: false, // REQUIRED for Supavisor transaction mode (prepared statements disabled)
  connection: { application_name: isServerless ? 'readora-vercel' : 'readora-worker' },
  onnotice: () => {},
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Initialize schema
export async function initDb() {
  let retries = 3;
  let connected = false;

  while (retries > 0 && !connected) {
    try {
      console.log(`Database connection attempt ${4 - retries}/3...`);
      await sql`SELECT 1`;
      connected = true;
      dbReady = true;
      console.log('Database connected successfully.');
    } catch (err: any) {
      console.warn(`Connection attempt failed: ${err.message}`);
      if (err.message?.includes('authentication did not complete') || err.message?.includes('CONNECT_TIMEOUT') || err.code === 'CONNECT_TIMEOUT') {
        console.error('\n================================================================================\n' +
          'DATABASE AUTHENTICATION / CONNECTION TIMEOUT DETECTED.\n' +
          'Please verify your DATABASE_URL environment variable has the correct password and project reference.\n' +
          'Format: postgres://postgres.[project-ref]:[password]@...pooler.supabase.com:6543/postgres\n' +
          '================================================================================\n');
      }
      retries--;
      if (retries > 0) {
        console.log('Waiting 2 seconds before retrying...');
        await sleep(2000);
      }
    }
  }

  if (!connected) {
    console.warn('All database connection retries failed. Setting flag dbReady = false. This is expected if DATABASE_URL is not configured.');
    dbReady = false;
    return;
  }

  // Avoid running heavy DDL / locks on every serverless cold start if table already exists
  try {
    const existingTable = await sql`
      SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users' LIMIT 1
    `;
    if (existingTable.length > 0) {
      console.log('Database schema already initialized. Skipping DDL execution on cold start.');
      return;
    }
  } catch (e) {
    // Proceed to create tables if check failed
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        tags TEXT DEFAULT '[]',
        is_public BOOLEAN DEFAULT FALSE
      );
    `;

    // Add columns if they don't exist (for existing databases)
    try {
      await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '[]'`;
      await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE`;
      await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS organization_id TEXT`;
      await sql`CREATE INDEX IF NOT EXISTS idx_documents_org ON documents (organization_id)`;
      await sql`ALTER TABLE storyboards ADD COLUMN IF NOT EXISTS generation_job_id TEXT`;
    } catch (e) {
      // Ignore if columns already exist or syntax error on older PG versions
    }

    try {
      await sql`
        UPDATE documents d
        SET organization_id = om.organization_id
        FROM organization_members om
        WHERE d.organization_id IS NULL
          AND om.user_id = d.user_id
          AND (SELECT count(*) FROM organization_members x WHERE x.user_id = d.user_id) = 1
      `;

      const unresolved = await sql`
        SELECT d.id, d.name, d.user_id,
               (SELECT count(*) FROM organization_members x WHERE x.user_id = d.user_id) AS class_count
        FROM documents d
        WHERE d.organization_id IS NULL
        ORDER BY class_count DESC
      `;
      if (unresolved.length > 0) {
        console.info(`[db] Unresolved documents for organization_id backfill (${unresolved.length} rows):`, unresolved);
      } else {
        console.info(`[db] Backfill completed with 0 unresolved documents.`);
      }
    } catch (e) {
      console.warn('[db] Backfill for documents.organization_id skipped/failed:', e);
    }

    await sql`
      CREATE TABLE IF NOT EXISTS chapters (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        chapter_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        content TEXT NOT NULL
      );
    `;

    try {
      await sql`ALTER TABLE chapters ADD COLUMN IF NOT EXISTS parent_id TEXT`;
      await sql`ALTER TABLE chapters ALTER COLUMN parent_id TYPE TEXT USING parent_id::text`;
    } catch(e) {}
    try {
      await sql`ALTER TABLE chapters ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`;
    } catch(e) {}
    try {
      await sql`ALTER TABLE chapters DROP CONSTRAINT IF EXISTS chapters_type_check`;
      await sql`ALTER TABLE chapters ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'chapter'`;
    } catch(e) {}

    await sql`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        text TEXT NOT NULL,
        relationship_graph TEXT,
        follow_ups TEXT,
        type TEXT,
        action_data TEXT,
        recommended_videos TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    try {
      await sql`ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_chapter_id_fkey`;
      await sql`ALTER TABLE chats ALTER COLUMN chapter_id TYPE TEXT`;
    } catch(e) {}
    try {
      await sql`ALTER TABLE chats ADD COLUMN IF NOT EXISTS type TEXT`;
      await sql`ALTER TABLE chats ADD COLUMN IF NOT EXISTS action_data TEXT`;
      await sql`ALTER TABLE chats ADD COLUMN IF NOT EXISTS recommended_videos TEXT`;
      await sql`ALTER TABLE chats ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT FALSE`;
    } catch (e) {
      // Ignore
    }
    await sql`
      CREATE TABLE IF NOT EXISTS storyboards (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
        chapter_id TEXT REFERENCES chapters(id) ON DELETE CASCADE,
        generation_job_id TEXT,
        title TEXT NOT NULL,
        visual_style TEXT,
        narration_style TEXT,
        grade_level TEXT,
        subject TEXT,
        status TEXT DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS scenes (
        id TEXT PRIMARY KEY,
        storyboard_id TEXT NOT NULL REFERENCES storyboards(id) ON DELETE CASCADE,
        organization_id TEXT NOT NULL,
        scene_number INTEGER NOT NULL,
        narration TEXT,
        animation_instructions TEXT,
        camera_directions TEXT,
        labels TEXT, -- JSON array
        transition_to_next TEXT,
        estimated_duration_seconds INTEGER,
        visual_prompt TEXT,
        educational_metadata TEXT, -- JSON
        video_url TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS generation_jobs (
        id TEXT PRIMARY KEY,
        org_id TEXT,
        document_id TEXT,
        chapter_id TEXT,
        status TEXT,
        progress INTEGER,
        error_message TEXT,
        video_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS narration_assets (
        id TEXT PRIMARY KEY,
        org_id TEXT,
        scene_id TEXT,
        asset_url TEXT,
        voice_name TEXT,
        duration_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS visual_metadata (
        id TEXT PRIMARY KEY,
        org_id TEXT,
        scene_id TEXT,
        image_url TEXT,
        prompt TEXT,
        model_used TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    try {
      await sql`DELETE FROM visual_metadata a USING visual_metadata b WHERE a.ctid < b.ctid AND a.scene_id = b.scene_id`;
      await sql`DELETE FROM narration_assets a USING narration_assets b WHERE a.ctid < b.ctid AND a.scene_id = b.scene_id`;
      await sql`ALTER TABLE visual_metadata ADD CONSTRAINT visual_metadata_scene_uniq UNIQUE (scene_id)`;
    } catch (e) {}
    try {
      await sql`ALTER TABLE narration_assets ADD CONSTRAINT narration_assets_scene_uniq UNIQUE (scene_id)`;
    } catch(e) {}

    await sql`
      CREATE TABLE IF NOT EXISTS student_memory (
        id UUID PRIMARY KEY,
        user_id TEXT NOT NULL,
        chapter_id TEXT,
        summary TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_student_memory_user ON student_memory(user_id, created_at DESC)`;
    
    await sql`
      CREATE TABLE IF NOT EXISTS job_queue (
        id UUID PRIMARY KEY,
        job_type TEXT NOT NULL,
        payload JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        attempts INT NOT NULL DEFAULT 0,
        error TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        finished_at TIMESTAMPTZ
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status, created_at)`;
    
    await sql`
      CREATE TABLE IF NOT EXISTS user_usage (
        user_id TEXT PRIMARY KEY,
        books_uploaded_this_month INTEGER DEFAULT 0,
        video_generations_this_month INTEGER DEFAULT 0,
        image_searches_this_month INTEGER DEFAULT 0,
        interactive_lessons_this_month INTEGER DEFAULT 0,
        video_generations_today INTEGER DEFAULT 0,
        image_searches_today INTEGER DEFAULT 0,
        last_reset_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    try {
      await sql`ALTER TABLE user_usage ADD COLUMN IF NOT EXISTS video_generations_this_month INTEGER DEFAULT 0`;
      await sql`ALTER TABLE user_usage ADD COLUMN IF NOT EXISTS image_searches_this_month INTEGER DEFAULT 0`;
      await sql`ALTER TABLE user_usage ADD COLUMN IF NOT EXISTS interactive_lessons_this_month INTEGER DEFAULT 0`;
      await sql`ALTER TABLE user_usage ADD COLUMN IF NOT EXISTS youtube_searches_today INTEGER DEFAULT 0`;
      await sql`ALTER TABLE user_usage ADD COLUMN IF NOT EXISTS last_daily_reset_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP`;
    } catch(e) {}

    console.log('Database schema initialized successfully.');
  } catch (error: any) {
    console.error('Failed to initialize database schema:', error);
    if (error.message?.includes('CONNECT_TIMEOUT') || error.code === 'CONNECT_TIMEOUT') {
      console.error('\n\n================================================================================\n' +
        'CRITICAL ERROR: Database Connection Timeout.\n' +
        'If you are using Supabase, you MUST use the Connection Pooler URL (port 6543).\n' +
        'Direct connections (port 5432) are IPv6 only and will time out in this environment.\n' +
        '================================================================================\n\n');
    } else if (error.message?.includes('password authentication failed')) {
      console.error('\n\n================================================================================\n' +
        'CRITICAL ERROR: Database Password Authentication Failed.\n' +
        'The password in your DATABASE_URL secret is incorrect.\n' +
        'Did you forget to replace [YOUR-PASSWORD] with your actual database password?\n' +
        'Make sure to remove the brackets [] as well.\n' +
        '================================================================================\n\n');
    } else if (error.message?.includes('Tenant or user not found')) {
      console.error('\n\n================================================================================\n' +
        'CRITICAL ERROR: Database Tenant or User Not Found.\n' +
        'The connection string in your DATABASE_URL secret is incorrect.\n' +
        'If you are using Supabase Connection Pooling (port 6543), your username MUST include the project reference.\n' +
        'Format: postgres://[db-user].[project-ref]:[password]@...pooler.supabase.com:6543/[db-name]\n' +
        'If you are using Neon, ensure the endpoint ID in the username or host is correct.\n' +
        '================================================================================\n\n');
    }
    dbReady = false;
  }
}

// Run initialization safely (skipped on Vercel)
if (!process.env.VERCEL) {
  initDb().catch((err) => {
    console.error('initDb unhandled error:', err);
    dbReady = false;
  });
} else {
  console.log('[db] Skipping initDb on Vercel — schema managed by worker/migration.');
}

export default sql;
