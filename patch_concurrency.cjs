const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

// Remove the import
content = content.replace("import { createConcurrencyLimit } from './src/lib/documentProcessor.js';", "");

// Add definition at the top
const concurrencyCode = `
export function createConcurrencyLimit(concurrency: number) {
  const queue: (() => void)[] = [];
  let activeCount = 0;
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (activeCount >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    activeCount++;
    try {
      return await task();
    } finally {
      activeCount--;
      if (queue.length > 0) {
        const next = queue.shift();
        if (next) next();
      }
    }
  };
}
`;

content = content.replace("import { safeParseJSON } from './src/lib/utils.js';", "import { safeParseJSON } from './src/lib/utils.js';\n" + concurrencyCode);

fs.writeFileSync('server.ts', content);
