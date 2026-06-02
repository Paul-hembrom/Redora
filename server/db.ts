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
      const parsedSb = new URL(sbUrl);
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

export let dbReady = true;

const isLocal = finalDbUrl.includes('localhost') || finalDbUrl.includes('127.0.0.1');

// Configure postgres client
const sql = postgres(finalDbUrl, {
  ssl: isLocal ? false : 'require', // Supabase requires SSL for all remote connections
  max: 10, // Max number of connections
  connect_timeout: 30, // Updated to 30 seconds
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
      console.log('Database connected successfully.');
    } catch (err: any) {
      console.error(`Connection attempt failed: ${err.message}`);
      retries--;
      if (retries > 0) {
        console.log('Waiting 5 seconds before retrying...');
        await sleep(5000);
      }
    }
  }

  if (!connected) {
    console.error('All database connection retries failed. Setting flag dbReady = false.');
    dbReady = false;
    return;
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
      await sql`ALTER TABLE storyboards ADD COLUMN IF NOT EXISTS generation_job_id TEXT`;
    } catch (e) {
      // Ignore if columns already exist or syntax error on older PG versions
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
      await sql`ALTER TABLE chapters ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES chapters(id) ON DELETE CASCADE`;
    } catch(e) {}
    try {
      await sql`ALTER TABLE chapters ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`;
    } catch(e) {}
    try {
      await sql`ALTER TABLE chapters ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('part', 'chapter', 'topic')) DEFAULT 'chapter'`;
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
      );
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

// Run initialization
initDb();

export default sql;
