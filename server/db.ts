import postgres from 'postgres';

// Use DATABASE_URL from environment, or a default local connection string
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres';

if (connectionString.includes('.supabase.co') && !connectionString.includes('pooler.supabase.com')) {
  const errorMsg = 
    '\n\n================================================================================\n' +
    'CRITICAL ERROR: Supabase direct connections (port 5432) are IPv6 only.\n' +
    'This environment only supports IPv4.\n\n' +
    'You MUST use the Supabase Connection Pooler URL (port 6543) instead.\n' +
    '1. Go to Supabase Dashboard -> Project Settings -> Database\n' +
    '2. Check the box for "Use connection pooling"\n' +
    '3. Copy the new URL (it will have port 6543 and look like pooler.supabase.com)\n' +
    '4. Update your DATABASE_URL secret with this new URL.\n' +
    '================================================================================\n\n';
  console.error(errorMsg);
  throw new Error(errorMsg);
}

const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

// Configure postgres client
const sql = postgres(connectionString, {
  ssl: isLocal ? false : 'require', // Supabase requires SSL for all remote connections
  max: 10, // Max number of connections
  connect_timeout: 10, // Fail fast if the network is unreachable (e.g., IPv4 vs IPv6 issues)
});

// Initialize schema
export async function initDb() {
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
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

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

    await sql`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        text TEXT NOT NULL,
        relationship_graph TEXT,
        follow_ups TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
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
    throw error; // Re-throw to ensure the app fails fast if DB is unreachable
  }
}

// Run initialization
initDb();

export default sql;
