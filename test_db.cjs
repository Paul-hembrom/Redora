require('dotenv').config();
const postgres = require('postgres');
async function test() {
  const sql = postgres(process.env.DATABASE_URL);
  try {
    await sql`SELECT 1`;
    console.log("DB connection OK");
  } catch(e) {
    console.error("Connection failed:", e);
  }
}
test().then(() => process.exit(0));
