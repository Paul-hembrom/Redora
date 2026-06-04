import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

// 1. Update authenticate middleware
content = content.replace(
  /const authenticate = \(req: any, res: any, next: any\) => \{[\s\S]*?^};\n/m,
  `const authenticate = async (req: any, res: any, next: any) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  if (!token) {
    console.log('Authenticate: No token found in cookies or headers');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let validUserId = null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string, sub?: string };
    validUserId = decoded.userId || decoded.sub;
  } catch (err) {
    try {
      if (process.env.SUPABASE_JWT_SECRET) {
        const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET, { algorithms: ['HS256'] }) as any;
        validUserId = decoded.sub || decoded.userId;
      } else {
        throw new Error('Invalid token');
      }
    } catch (err2: any) {
      console.log('Authenticate error:', err2.message);
      return res.status(401).json({ error: 'Invalid token' });
    }
  }
  
  if (!validUserId) return res.status(401).json({ error: 'Invalid token' });
  req.userId = validUserId;
  
  const orgId = req.cookies['sb-org-id'];
  req.orgId = null;
  if (orgId) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (orgId === 'demo' || orgId === 'default_org') {
       req.orgId = orgId;
    } else if (uuidRegex.test(orgId)) {
      try {
        const membership = await sql\`SELECT 1 FROM organization_members WHERE organization_id = \${orgId} AND user_id = \${req.userId}\`;
        if (membership.length === 0) {
           return res.status(403).json({ error: 'Forbidden: Not a member of this organization' });
        }
        req.orgId = orgId;
      } catch (err: any) {
        if (!err.message || !err.message.includes('does not exist')) {
           console.error('Org access check error:', err);
           return res.status(500).json({ error: 'Server error check org membership' });
        }
      }
    }
  }
  next();
};

function getDocUserFilter(req: any) {
  if (req.orgId && req.orgId !== 'demo' && req.orgId !== 'default_org') {
    return sql\`user_id IN (SELECT user_id FROM organization_members WHERE organization_id = \${req.orgId})\`;
  }
  return sql\`user_id = \${req.userId}\`;
}

function getDocAliasUserFilter(req: any, alias: string) {
  if (req.orgId && req.orgId !== 'demo' && req.orgId !== 'default_org') {
    if (alias === 'd') return sql\`d.user_id IN (SELECT user_id FROM organization_members WHERE organization_id = \${req.orgId})\`;
    if (alias === 'c') return sql\`c.user_id IN (SELECT user_id FROM organization_members WHERE organization_id = \${req.orgId})\`;
  }
  if (alias === 'd') return sql\`d.user_id = \${req.userId}\`;
  if (alias === 'c') return sql\`c.user_id = \${req.userId}\`;
  return sql\`user_id = \${req.userId}\`;
}
`
);

// 2. Add /api/organizations
const newOrganizationsRoute = `
// --- Organizations Route ---
app.get('/api/organizations', authenticate, async (req: any, res) => {
  try {
    const orgs = await sql\`
      SELECT o.* FROM organizations o 
      JOIN organization_members m ON o.id = m.organization_id 
      WHERE m.user_id = \${req.userId}
    \`;
    res.json(orgs);
  } catch (err: any) {
    if (err.message && err.message.includes('does not exist')) {
      return res.json([]);
    }
    res.status(500).json({ error: err.message });
  }
});
`;

content = content.replace(
  /\/\/ --- Document Routes ---/,
  newOrganizationsRoute + '\n// --- Document Routes ---'
);

// 3. Replace all SQL document lookups
// a: 'const docs = await sql`SELECT * FROM documents WHERE user_id = ${req.userId} ORDER BY upload_date DESC`;'
content = content.replace(
    /const docs = await sql`SELECT \* FROM documents WHERE user_id = \$\{req.userId\} ORDER BY upload_date DESC`;/,
    "const docs = await sql`SELECT * FROM documents WHERE ${getDocUserFilter(req)} ORDER BY upload_date DESC`;"
);

// b: 'const docQuery = await sql`SELECT d.id FROM documents d JOIN chapters c ON d.id = c.document_id WHERE c.id = ${chapterId} AND d.user_id = ${req.userId}`;'
content = content.replace(
    /const docQuery = await sql`SELECT d.id FROM documents d JOIN chapters c ON d\.id = c\.document_id WHERE c\.id = \$\{chapterId\} AND d\.user_id = \$\{req\.userId\}`;/,
    "const docQuery = await sql`SELECT d.id FROM documents d JOIN chapters c ON d.id = c.document_id WHERE c.id = ${chapterId} AND ${getDocAliasUserFilter(req, 'd')}`;"
);

// c: 'const docs = await sql`SELECT id FROM documents WHERE id = ${docId} AND user_id = ${req.userId}`;' (multiple occurrences)
content = content.replace(
    /const docs = await sql`SELECT id FROM documents WHERE id = \$\{docId\} AND user_id = \$\{req\.userId\}`;/g,
    "const docs = await sql`SELECT id FROM documents WHERE id = ${docId} AND ${getDocUserFilter(req)}`;"
);

// d: 'const docs = await sql`SELECT chapters FROM documents WHERE id = ${docId} AND user_id = ${req.userId}`;'
content = content.replace(
    /const docs = await sql`SELECT chapters FROM documents WHERE id = \$\{docId\} AND user_id = \$\{req\.userId\}`;/g,
    "const docs = await sql`SELECT chapters FROM documents WHERE id = ${docId} AND ${getDocUserFilter(req)}`;"
);

// e: 'const docs = await sql`SELECT name, chapters FROM documents WHERE user_id = ${req.userId}`;'
content = content.replace(
    /const docs = await sql`SELECT name, chapters FROM documents WHERE user_id = \$\{req\.userId\}`;/g,
    "const docs = await sql`SELECT name, chapters FROM documents WHERE ${getDocUserFilter(req)}`;"
);

// f: 'WHERE user_id = ${req.userId} AND (name ILIKE ${fuzzyPattern} OR tags ILIKE ${searchPattern})'
// This one is split over multiple lines. Let's substitute string exactly.
content = content.replace(
    /WHERE user_id = \$\{req\.userId\} AND \(name ILIKE \$\{fuzzyPattern\} OR tags ILIKE \$\{searchPattern\}\)/g,
    "WHERE ${getDocUserFilter(req)} AND (name ILIKE ${fuzzyPattern} OR tags ILIKE ${searchPattern})"
);

// g: 'WHERE d.user_id = ${req.userId} AND (c.title ILIKE ${fuzzyPattern} OR c.summary ILIKE ${searchPattern} OR c.content ILIKE ${searchPattern} OR d.tags ILIKE ${searchPattern})'
content = content.replace(
    /WHERE d.user_id = \$\{req\.userId\} AND \(c\.title ILIKE \$\{fuzzyPattern\} OR c\.summary ILIKE \$\{searchPattern\} OR c\.content ILIKE \$\{searchPattern\} OR d\.tags ILIKE \$\{searchPattern\}\)/g,
    "WHERE ${getDocAliasUserFilter(req, 'd')} AND (c.title ILIKE ${fuzzyPattern} OR c.summary ILIKE ${searchPattern} OR c.content ILIKE ${searchPattern} OR d.tags ILIKE ${searchPattern})"
);

// Actually, I also need to make sure the chat routes use org context if needed.
// 'const chats = await sql`SELECT * FROM chats WHERE chapter_id = ${req.params.chapterId} AND user_id = ${req.userId} ORDER BY created_at ASC`;'
// Let's leave chats to user_id as chat belongs to users.

fs.writeFileSync('server.ts', content);
console.log('Update complete.');
