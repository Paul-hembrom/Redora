import sql from './server/db.js';
async function test() {
  try {
    const res = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'chats';
    `;
    console.log(res);
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
test();
