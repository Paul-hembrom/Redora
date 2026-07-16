import sql from './server/db.js';
async function test() {
  const rows = await sql`SELECT grade, subject, subtopic, images FROM curriculum_library LIMIT 5`;
  rows.forEach(r => console.log(r.grade, r.subject, r.subtopic, typeof r.images, r.images));
  process.exit(0);
}
test();
