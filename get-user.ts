import sql from './server/db.js';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const users = await sql`SELECT id FROM users LIMIT 1`;
  console.log(users[0]?.id);
  process.exit(0);
}
run();
