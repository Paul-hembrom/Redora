const fs = require('fs');
let code = fs.readFileSync('server/videoPipeline.ts', 'utf-8');

const target1 = `async function uploadToSupabaseStorage(base64: string, filename: string): Promise<string> {`;
const replace1 = `async function uploadToSupabaseStorage(base64: string, filename: string, contentType = 'audio/wav'): Promise<string> {`;
code = code.replace(target1, replace1);

const target2 = `    contentType: 'audio/wav',`;
const replace2 = `    contentType,`;
code = code.replace(target2, replace2);

const target3 = `    // Call Kokoro
    const data = await fetchKokoroWithRetry(cleanText);
    const audioBase64 = data.audio_base64;
    const duration = data.duration || 10;
    
    // Upload to Supabase
    const audioUrl = await uploadToSupabaseStorage(audioBase64, \`kokoro_\${uuidv4()}.wav\`);`;

const replace3 = `    // Call Kokoro
    const data = await fetchKokoroWithRetry(cleanText);
    const audioBase64 = data.audio_base64;
    
    // Upload to Supabase
    const mime = data.mime || 'audio/wav';
    const ext  = mime === 'audio/mpeg' ? 'mp3' : 'wav';
    const audioUrl = await uploadToSupabaseStorage(audioBase64, \`kokoro_\${uuidv4()}.\${ext}\`, mime);`;

if (code.includes('const audioUrl = await uploadToSupabaseStorage(audioBase64, `kokoro_${uuidv4()}.wav`);')) {
    code = code.replace(target3, replace3);
} else {
    // maybe it looks different.
    const fallbackTarget = `    const audioUrl = await uploadToSupabaseStorage(data.audio_base64, \`kokoro_\${uuidv4()}.wav\`);`;
    const fallbackReplace = `    const mime = data.mime || 'audio/wav';
    const ext  = mime === 'audio/mpeg' ? 'mp3' : 'wav';
    const audioUrl = await uploadToSupabaseStorage(data.audio_base64, \`kokoro_\${uuidv4()}.\${ext}\`, mime);`;
    code = code.replace(fallbackTarget, fallbackReplace);
}

// P1-9 — duration_ms is an estimate
// "realDurationMs = data.playbackDuration ? Math.round(data.playbackDuration * 1000) : duration * 1000"
const targetDuration = `        VALUES (\${uuidv4()}, \${org_id}, \${scene_id}, \${audioUrl}, \${voiceName}, \${duration * 1000})`;
const replaceDuration = `        VALUES (\${uuidv4()}, \${org_id}, \${scene_id}, \${audioUrl}, \${voiceName}, \${data.playbackDuration ? Math.round(data.playbackDuration * 1000) : duration * 1000})`;
code = code.replace(targetDuration, replaceDuration);

fs.writeFileSync('server/videoPipeline.ts', code);
