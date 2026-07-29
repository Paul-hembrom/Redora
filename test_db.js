import jwt from 'jsonwebtoken';
const secret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'super-secret-jwt-key-change-me-in-prod';
const token = jwt.sign({ userId: '75531dc9-9cbf-4c18-8983-2833bb37b826' }, secret, { expiresIn: '1d' });
async function run() {
  const res = await fetch('http://localhost:3000/api/documents/f468d7a8-4e10-4856-8b33-d9094b2bd6fb', {
    method: 'DELETE',
    headers: { 'Cookie': 'token=' + token }
  });
  const text = await res.text();
  console.log(res.status, text);
}
run();
