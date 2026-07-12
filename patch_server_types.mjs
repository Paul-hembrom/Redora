import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/const { token, role, org_id, redirect } = req\.query;/, "const token = req.query.token as string;\n  const role = req.query.role as string;\n  const org_id = req.query.org_id as string;\n  const redirect = req.query.redirect as string;");
code = code.replace(/sameSite: 'lax',/, "sameSite: 'lax' as const,");

fs.writeFileSync('server.ts', code);
console.log('Patched server.ts types!');
