import sql from './server/db.js';

async function check() {
  try {
    const res = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;
    console.log(res);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

check();
