import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

const oldRedirect = `const redirectUrl = redirect ? decodeURIComponent(redirect) : '/';
  res.redirect(redirectUrl);`;

const newRedirect = `let redirectUrl = redirect ? decodeURIComponent(redirect) : '/';
  // Force production domain if staging domain is passed
  if (redirectUrl.includes('d1.alphanexoraai.com')) {
    redirectUrl = redirectUrl.replace('d1.alphanexoraai.com', 'redora.alphanexoraai.com');
  }
  // Ensure the token exchange itself uses the correct domain base if absolute
  if (redirectUrl.startsWith('http') && !redirectUrl.includes('redora.alphanexoraai.com') && !redirectUrl.includes('localhost')) {
     try {
       const url = new URL(redirectUrl);
       url.hostname = 'redora.alphanexoraai.com';
       redirectUrl = url.toString();
     } catch (e) {}
  }
  res.redirect(redirectUrl);`;

if (code.includes(oldRedirect)) {
    code = code.replace(oldRedirect, newRedirect);
    fs.writeFileSync('server.ts', code);
    console.log('Patched redirect!');
} else {
    console.log('Redirect code not found.');
}
