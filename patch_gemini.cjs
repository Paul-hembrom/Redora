const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

// Update callLLM
code = code.replace(/export async function callLLM\(\n  prompt: string,\n  systemInstruction\?: string,\n  responseFormat\?: 'json_object' \| 'text',\n  maxTokens\?: number,\n  temperature\?: number,\n\): Promise<string> \{/, `export async function callLLM(
  prompt: string,
  systemInstruction?: string,
  responseFormat?: 'json_object' | 'text',
  maxTokens?: number,
  temperature?: number,
  imageUrl?: string,
): Promise<string> {`);

code = code.replace(/try \{ return await callDeepSeek\(prompt, systemInstruction, responseFormat, maxTokens, 3, temperature \?\? 0\.2\); \}/, `try { return await callDeepSeek(prompt, systemInstruction, responseFormat, maxTokens, 3, temperature ?? 0.2, imageUrl); }`);
code = code.replace(/try \{ return await callGeminiFlashLite\(prompt, systemInstruction\); \}/, `try { return await callGeminiFlashLite(prompt, systemInstruction, imageUrl); }`);
code = code.replace(/return callNvidiaFallback\(prompt, systemInstruction\);/, `return callNvidiaFallback(prompt, systemInstruction, imageUrl);`);

// Update callDeepSeek
code = code.replace(/async function callDeepSeek\(\n  prompt: string,\n  systemInstruction\?: string,\n  responseFormat\?: 'json_object' \| 'text',\n  maxTokens\?: number,\n  maxRetries = 3,\n  temperature = 0\.2,\n\): Promise<string> \{/, `async function callDeepSeek(
  prompt: string,
  systemInstruction?: string,
  responseFormat?: 'json_object' | 'text',
  maxTokens?: number,
  maxRetries = 3,
  temperature = 0.2,
  imageUrl?: string,
): Promise<string> {`);

code = code.replace(/messages\.push\(\{ role: 'user', content: prompt \}\);/, `  let content: any = prompt;
  if (imageUrl) {
    content = [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: imageUrl } }
    ];
  }
  messages.push({ role: 'user', content });`);

// Update callGeminiFlashLite
code = code.replace(/export async function callGeminiFlashLite\(\n  prompt: string,\n  systemInstruction\?: string,\n\): Promise<string> \{/, `export async function callGeminiFlashLite(
  prompt: string,
  systemInstruction?: string,
  imageUrl?: string,
): Promise<string> {`);

code = code.replace(/const parts: any\[\] = \[\{ text: prompt \}\];/, `  const parts: any[] = [{ text: prompt }];
  if (imageUrl) {
    const base64 = imageUrl.split(',')[1];
    const mimeType = imageUrl.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || 'image/jpeg';
    parts.push({
      inlineData: {
        data: base64,
        mimeType: mimeType
      }
    });
  }`);

// Update callNvidiaFallback
code = code.replace(/export async function callNvidiaFallback\(\n  prompt: string,\n  systemInstruction\?: string,\n\): Promise<string> \{/, `export async function callNvidiaFallback(
  prompt: string,
  systemInstruction?: string,
  imageUrl?: string,
): Promise<string> {`);

code = code.replace(/const messages: any\[\] = \[\];\n  if \(systemInstruction\) messages\.push\(\{ role: 'system', content: systemInstruction \}\);\n  messages\.push\(\{ role: 'user', content: prompt \}\);/, `  const messages: any[] = [];
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
  let content: any = prompt;
  if (imageUrl) {
    content = [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: imageUrl } }
    ];
  }
  messages.push({ role: 'user', content });`);

fs.writeFileSync('src/lib/gemini.ts', code);
