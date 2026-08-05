const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldTicketCode = `    const { filename } = req.body || {};
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'filename is required' });
    }`;

const newTicketCode = `    const { filename, contentHash } = req.body || {};
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'filename is required' });
    }
    
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL_ENV!, SUPABASE_KEY_ENV!);

    if (contentHash) {
      // Check documents
      const { data: existingDoc } = await supabase
        .from('documents')
        .select('id')
        .eq('user_id', req.userId)
        .eq('content_hash', contentHash)
        .limit(1)
        .single();
      if (existingDoc) {
        return res.status(409).json({ error: 'DUPLICATE_DOCUMENT' });
      }

      // Check locks
      const { data: existingLock } = await supabase
        .from('upload_locks')
        .select('hash')
        .eq('user_id', req.userId)
        .eq('hash', contentHash)
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .single();
      if (existingLock) {
        return res.status(409).json({ error: 'UPLOAD_IN_PROGRESS' });
      }

      // Insert lock
      await supabase
        .from('upload_locks')
        .insert({ hash: contentHash, user_id: req.userId })
        .select()
        .single();
    }`;

code = code.replace(oldTicketCode, newTicketCode);
code = code.replace("    const { createClient } = await import('@supabase/supabase-js');\n    const supabase = createClient(SUPABASE_URL_ENV!, SUPABASE_KEY_ENV!);\n", "");

fs.writeFileSync('server.ts', code);
