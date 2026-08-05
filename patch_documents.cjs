const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldDocCode = `  const { id, name, chapters, tags, org_id } = req.body;
  
  try {
    const orgId = org_id || req.query.org_id || req.cookies?.['sb-org-id'];`;

const newDocCode = `  const { id, name, chapters, tags, org_id, contentHash } = req.body;
  
  try {
    const orgId = org_id || req.query.org_id || req.cookies?.['sb-org-id'];`;

code = code.replace(oldDocCode, newDocCode);

const oldInsertCode = `      await tx\`
        INSERT INTO documents (id, user_id, name, upload_date, tags, is_public) 
        VALUES (\${id}, \${req.userId}, \${cleanName}, NOW(), \${safeTags}, \${isPublic})
      \`;`;

const newInsertCode = `      await tx\`
        INSERT INTO documents (id, user_id, name, upload_date, tags, is_public, content_hash) 
        VALUES (\${id}, \${req.userId}, \${cleanName}, NOW(), \${safeTags}, \${isPublic}, \${contentHash || null})
      \`;
      if (contentHash) {
        await tx\`DELETE FROM upload_locks WHERE hash = \${contentHash}\`;
      }`;

code = code.replace(oldInsertCode, newInsertCode);

fs.writeFileSync('server.ts', code);
