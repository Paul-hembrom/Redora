import sql from './server/db.js';

async function test() {
  try {
    await sql`ALTER TABLE chats ALTER COLUMN chapter_id TYPE TEXT;`;
    console.log("Success: Altered chapter_id to TEXT");
  } catch (e) {
    console.error("DB Error:", e);
  }
  process.exit(0);
}
test();
