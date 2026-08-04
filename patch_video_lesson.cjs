const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const target = `app.post('/api/chapters/:id/generate-lesson', authenticate, async (req: any, res) => {
  try {
    const { orgId, userRole } = await getUserOrgRole(req.userId);
    if (userRole === 'student') return res.status(403).json({ error: 'Students cannot modify content' });
    
    try {
      await verifyAndIncrementUsage(req.userId, 'video', orgId);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }`;

const replace = `app.post('/api/chapters/:id/generate-lesson', authenticate, async (req: any, res) => {
  return res.status(501).json({
    error: 'Video lesson generation is not yet available. Please use Interactive Pro.'
  });
  try {
    const { orgId, userRole } = await getUserOrgRole(req.userId);
    if (userRole === 'student') return res.status(403).json({ error: 'Students cannot modify content' });
    
    // Disabled quota check
    /*
    try {
      await verifyAndIncrementUsage(req.userId, 'video', orgId);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }
    */`;

code = code.replace(target, replace);
fs.writeFileSync('server.ts', code);
