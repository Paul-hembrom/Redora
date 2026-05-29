import sql from './server/db.js';
import { v4 as uuidv4 } from 'uuid';

async function run() {
  const docId = uuidv4();
  const userId = '11111111-1111-1111-1111-111111111111'; // Assuming just using a random one string that is fake, wait insert might fail if user_id doesn't exist.
  // Actually let's just query the last used userId
  const users = await sql`SELECT id FROM users LIMIT 1`;
  if (users.length === 0) {
    console.log("no users"); process.exit();
  }
  const uid = users[0].id;

  const flatChapters = [{
    id: uuidv4(),
    document_id: docId,
    chapter_number: 1,
    title: 'Hello',
    summary: 'Summary with \x00 null bytes?', // Just to test
    content: 'test',
    parent_id: null,
    sort_order: 0,
    type: 'chapter'
  }];

  try {
    await sql.begin(async (tx) => {
      await tx`INSERT INTO documents (id, user_id, name, tags) VALUES (${docId}, ${uid}, 'test doc', '[]')`;
      await tx`INSERT INTO chapters ${tx(flatChapters)}`;
    });
    console.log("inserted successfully");
  } catch (e) {
    console.error("Insert failed:", e);
  }
  process.exit();
}
run();
