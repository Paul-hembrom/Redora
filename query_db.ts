import sql from './server/db.js';

async function run() {
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
  console.log("TABLES:", tables.map((t: any) => t.table_name));
  
  for (const t of tables) {
    const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ${t.table_name}`;
    console.log(`TABLE ${t.table_name}:`, cols.map((c: any) => c.column_name));
  }
  process.exit(0);
}
run();
