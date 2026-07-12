import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

const anchor = `app.use(cookieParser());`;

const tokenExchangeBlock = `
app.all(['/auth/token-exchange', '/api/auth/token-exchange'], (req, res) => {
  const { token, role, org_id, redirect } = req.query;

  if (token) {
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    };
    
    res.cookie('token', token, cookieOptions);
    if (role) res.cookie('sb-role', role, cookieOptions);
    if (org_id) res.cookie('sb-org-id', org_id, cookieOptions);
  }

  const redirectUrl = redirect ? decodeURIComponent(redirect) : '/';
  res.redirect(redirectUrl);
});
`;

if (!code.includes('/auth/token-exchange')) {
    code = code.replace(anchor, anchor + "\n" + tokenExchangeBlock);
    fs.writeFileSync('server.ts', code);
    console.log('Patched token exchange route!');
} else {
    console.log('Token exchange route already exists.');
}
