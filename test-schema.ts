import sql from './server/db.js';
async function run() {
  const table = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'chapters';
  `;
  console.log(table);
  process.exit(0);
}
run();
