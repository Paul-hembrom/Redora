import sql from './server/db.js';
async function test() {
  try {
    const res = await sql`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'chats'::regclass;
    `;
    console.log(res);
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
test();
