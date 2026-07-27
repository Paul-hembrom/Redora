const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf8');

code = code.replace(
  'export async function processDocument(',
  'async function processDocumentLocal('
);

const newCode = `
async function processDocumentViaSpace(
  file: File,
  options: PreprocessOptions,
  onProgress: (msg: string) => void,
  callbacks?: {
    onDiscovered?: (chapters: Chapter[]) => void;
    onChapterDone?: (id: string, title: string, summary: string) => void;
  },
): Promise<Chapter[]> {
  const SPACE_URL = import.meta.env.VITE_HF_SPACE_URL;
  if (!SPACE_URL) {
    throw new Error('VITE_HF_SPACE_URL is not set in environment');
  }

  const endpoint = \`\${SPACE_URL}/process\`;

  onProgress('Uploading document to AI processor…');
  const formData = new FormData();
  formData.append('file', file, file.name);

  const response = await fetch(endpoint, { method: 'POST', body: formData });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(\`Document processing failed (\${response.status}): \${errText}\`);
  }

  onProgress('Receiving structured content…');
  const chapters: Chapter[] = await response.json();

  callbacks?.onDiscovered?.(chapters);
  if (callbacks?.onChapterDone) {
    chapters.forEach((ch: Chapter) => callbacks.onChapterDone && callbacks.onChapterDone(ch.id, ch.title, ch.summary || ''));
  }

  onProgress('Done.');
  return chapters;
}

export async function processDocument(
  file: File,
  options: PreprocessOptions,
  onProgress: (msg: string) => void,
  callbacks?: {
    onDiscovered?: (chapters: Chapter[]) => void;
    onChapterDone?: (id: string, title: string, summary: string) => void;
  },
): Promise<Chapter[]> {
  try {
    return await processDocumentViaSpace(file, options, onProgress, callbacks);
  } catch (error) {
    console.warn('HF Space processing failed, falling back to local pipeline:', error);
    onProgress('AI service unavailable, processing locally…');
    return await processDocumentLocal(file, options, onProgress, callbacks);
  }
}
`;

code = code + '\n' + newCode;

fs.writeFileSync('src/lib/documentProcessor.ts', code);
