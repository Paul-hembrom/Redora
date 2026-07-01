import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();
const sql = postgres(process.env.DATABASE_URL!);
async function run() {
  const users = await sql`SELECT id FROM users LIMIT 1`;
  console.log(users[0]?.id);
  process.exit(0);
}
run();
