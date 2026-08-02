import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

const synthesizeKokoroStreamCode = `
async function synthesizeKokoroStream(text: string, voice = "af_sarah", onChunk: (chunk: any) => void) {
  const supportedVoices = ["bf_emma", "bf_isabella", "bm_george", "bm_lewis", "af_bella", "af_sarah"];
  const kokoroVoice = supportedVoices.includes(voice) ? voice : "af_sarah";
  
  let cleanText = text.replace(/[^a-zA-Z0-9\\s.,!?\\-:;()]/g, ' ');
  cleanText = cleanText.replace(/\\s+/g, ' ').trim();

  const response = await fetch("https://paulhemb-redora.hf.space/v1/speech/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: cleanText, voice: kokoroVoice, speed: 1.0 })
  });

  if (!response.ok) {
    throw new Error(\`Kokoro streaming TTS failed: \${response.statusText}\`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No readable stream");

  const decoder = new TextDecoder();
  let buffer = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      let newlineIdx;
      while ((newlineIdx = buffer.indexOf('\\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        if (line) {
          try {
            const chunk = JSON.parse(line);
            onChunk(chunk);
          } catch (e) {
            console.error("Failed to parse chunk:", line);
          }
        }
      }
    }
    if (done) break;
  }
  if (buffer.trim()) {
    try {
      onChunk(JSON.parse(buffer.trim()));
    } catch (e) {}
  }
}
`;

const target = "app.post('/api/tts/cartesia', async (req, res) => {";
content = content.replace(target, synthesizeKokoroStreamCode + '\n' + target);

const oldLogicStart = "const chunks = chunkDocumentText(text);";
const cartesiaRouteStartIdx = content.indexOf(target);
const oldLogicStartIdx = content.indexOf(oldLogicStart, cartesiaRouteStartIdx);

// We need to inject the Kokoro streaming try-catch before oldLogicStart
const newLogic = `
    // Try Kokoro streaming first
    try {
      let headersSent = false;
      let chunkIndex = 0;
      await synthesizeKokoroStream(text, "af_sarah", (chunk) => {
        if (!headersSent) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          headersSent = true;
        }
        if (chunk.totalChunks !== undefined) {
           res.write(JSON.stringify({ totalChunks: chunk.totalChunks }) + '\\n');
        } else {
           res.write(JSON.stringify({
              index: chunk.index !== undefined ? chunk.index : chunkIndex,
              domIndex: chunk.index !== undefined ? chunk.index : chunkIndex,
              text: chunk.text || "",
              audioUrl: chunk.audioUrl,
              timestamps: chunk.timestamps
           }) + '\\n');
           chunkIndex++;
        }
      });
      if (headersSent) {
        res.end();
        return;
      } else {
        throw new Error("No chunks received from Kokoro stream");
      }
    } catch (kokoroErr) {
      console.error('Kokoro stream TTS failed, falling back to original pipeline:', kokoroErr.message);
      if (res.headersSent) {
         res.end();
         return;
      }
    }
    
    // Fallback logic
    `;

content = content.substring(0, oldLogicStartIdx) + newLogic + content.substring(oldLogicStartIdx);
fs.writeFileSync('server.ts', content);
