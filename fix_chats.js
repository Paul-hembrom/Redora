import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

const searchGet = `    try {
      await sql\`ALTER TABLE chats ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb\`;
      await sql\`ALTER TABLE chats ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb\`;
    } catch(e) {}`;

const replaceGet = `    try {
      await sql\`ALTER TABLE chats ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb\`;
      await sql\`ALTER TABLE chats ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb\`;
      await sql\`ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_chapter_id_fkey\`;
    } catch(e) {}`;

code = code.replace(searchGet, replaceGet);

const searchPost = `app.post('/api/chats', authenticate, async (req: any, res) => {
  const { id, chapterId, role, text, relationshipGraph, followUps, type, actionData, recommended_videos, images } = req.body;
  try {`;

const replacePost = `app.post('/api/chats', authenticate, async (req: any, res) => {
  const { id, chapterId, role, text, relationshipGraph, followUps, type, actionData, recommended_videos, images } = req.body;
  try {
    try {
      await sql\`ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_chapter_id_fkey\`;
    } catch (e) {}`;

code = code.replace(searchPost, replacePost);

fs.writeFileSync('server.ts', code);
