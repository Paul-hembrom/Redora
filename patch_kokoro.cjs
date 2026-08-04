const fs = require('fs');
let code = fs.readFileSync('server/videoPipeline.ts', 'utf-8');

const kokoroHelper = `async function fetchKokoroWithRetry(cleanText: string, attempts = 3): Promise<any> {
  const delays = [5000, 15000, 30000];
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch("https://paulhemb-redora.hf.space/v1/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText, voice: "af_sarah", speed: 1.0 }),
      });
      if (!r.ok) throw new Error(\`Kokoro \${r.status}\`);
      const data = await r.json();
      if (!data.audio_base64) throw new Error('Kokoro returned no audio_base64');
      return data;
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await delay(delays[i]);
    }
  }
  throw lastErr;
}

export async function processSceneAssets(`;

code = code.replace("export async function processSceneAssets(", kokoroHelper);

const ttsTarget = `    // Call Kokoro
    let response = await fetch("https://paulhemb-redora.hf.space/v1/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: cleanText, voice: "af_sarah", speed: 1.0 })
    });
    if (!response.ok) {
       console.warn(\`[TTS] First Kokoro attempt failed (\${response.statusText}), retrying...\`);
       await delay(2000);
       response = await fetch("https://paulhemb-redora.hf.space/v1/speech", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ text: cleanText, voice: "af_sarah", speed: 1.0 })
       });
       if (!response.ok) throw new Error(\`Kokoro TTS failed: \${response.statusText}\`);
    }
    const data = await response.json();
    if (!data.audio_base64) {
        throw new Error("Invalid Kokoro response (no audio)");
    }`;

const ttsReplace = `    // Call Kokoro
    const data = await fetchKokoroWithRetry(cleanText);`;

code = code.replace(ttsTarget, ttsReplace);

fs.writeFileSync('server/videoPipeline.ts', code);
