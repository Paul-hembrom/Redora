const dbUrl = process.env.DATABASE_URL || '';
const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
console.log('DB URL Host:', dbUrl ? new URL(dbUrl).hostname : 'none');
console.log('DB URL User:', dbUrl ? new URL(dbUrl).username : 'none');
console.log('SB URL Host:', sbUrl ? new URL(sbUrl).hostname : 'none');
