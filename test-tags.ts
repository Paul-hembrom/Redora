import sql from './server/db.js';

async function run() {
  const docs = await sql`SELECT tags FROM documents ORDER BY upload_date DESC LIMIT 5;`;
  console.log("Docs tags:", docs.map(d => `'${d.tags}'`));
  process.exit();
}
run();
