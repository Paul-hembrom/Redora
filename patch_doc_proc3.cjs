const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf-8');

const target = `  const chapters: Chapter[] = await response.json();

  callbacks?.onDiscovered?.(chapters);`;

const replace = `  const chapters: Chapter[] = await response.json();

  if (!Array.isArray(chapters) || chapters.length === 0) {
    throw new Error('Processor returned no chapters — falling back to local extraction');
  }

  const totalContentChars = chapters.reduce((sum, ch) => {
    const childChars = (ch.children || []).reduce((s, c) => s + (c.content?.length || 0), 0);
    return sum + (ch.content?.length || 0) + childChars;
  }, 0);

  if (totalContentChars < 500) {
    throw new Error(
      \`Processor returned \${chapters.length} chapters but only \${totalContentChars} chars — falling back\`
    );
  }

  callbacks?.onDiscovered?.(chapters);`;

code = code.replace(target, replace);
fs.writeFileSync('src/lib/documentProcessor.ts', code);
