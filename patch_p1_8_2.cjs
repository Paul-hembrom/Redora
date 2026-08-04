const fs = require('fs');
let code = fs.readFileSync('server/videoPipeline.ts', 'utf-8');

// First replace uploadToSupabaseStorage signature
code = code.replace(`async function uploadToSupabaseStorage(base64: string, filename: string): Promise<string> {`, `async function uploadToSupabaseStorage(base64: string, filename: string, contentType = 'audio/wav'): Promise<string> {`);
code = code.replace(`contentType: 'audio/wav',`, `contentType,`);

// Next, replace the entire Kokoro block
const ttsStart = code.indexOf('// Call Kokoro');
const ttsEnd = code.indexOf('    } catch (error) {', ttsStart);

if (ttsStart !== -1 && ttsEnd !== -1) {
    const replaceTts = `// Call Kokoro
    const data = await fetchKokoroWithRetry(cleanText);
    const audioBase64 = data.audio_base64;
    const mime = data.mime || 'audio/wav';
    const ext  = mime === 'audio/mpeg' ? 'mp3' : 'wav';
    audioUrl = await uploadToSupabaseStorage(audioBase64, \`kokoro_\${uuidv4()}.\${ext}\`, mime);
    voiceName = 'kokoro_af_sarah';
    
    // Add real duration for P1-9 if present
    const realDurationMs = data.playbackDuration ? Math.round(data.playbackDuration * 1000) : duration * 1000;

    await sql\`
      INSERT INTO narration_assets (id, org_id, scene_id, asset_url, voice_name, duration_ms)
      VALUES (\${uuidv4()}, \${org_id}, \${scene_id}, \${audioUrl}, \${voiceName}, \${realDurationMs})
      ON CONFLICT (scene_id) DO UPDATE
        SET asset_url = EXCLUDED.asset_url,
            voice_name = EXCLUDED.voice_name,
            duration_ms = EXCLUDED.duration_ms
    \`;
`;
    code = code.substring(0, ttsStart) + replaceTts + code.substring(ttsEnd);
    
    // Remove the old INSERT INTO narration_assets further down since we just embedded it inside the try block (so it uses realDurationMs).
    // Actually wait, if the TTS fails, we catch it and audioUrl becomes null. We should let the later block do the insert so it's clean.
    // Let's rewrite it cleanly.
}
fs.writeFileSync('server/videoPipeline.ts', code);
