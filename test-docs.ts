import sql from './server/db.js';

async function run() {
  const docs = await sql`SELECT * FROM documents ORDER BY upload_date DESC LIMIT 5;`;
  console.log("Docs:", docs.length);
  
  if (docs.length > 0) {
    const ch = await sql`SELECT * FROM chapters WHERE document_id = ${docs[0].id}`;
    console.log("Chapters:", ch.length);
  }
  process.exit();
}
run();
