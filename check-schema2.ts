import sql from './server/db.js';
async function run() {
  try {
    const res = await sql`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'chapters'::regclass
      AND contype = 'c';
    `;
    console.log(res);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
