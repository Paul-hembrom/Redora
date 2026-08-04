const fs = require('fs');
let content = fs.readFileSync('server/videoPipeline.ts', 'utf-8');

const targetStr = `  // Insert Narration
  let audioUrl = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg'; // fallback
  let voiceName = 'Google_Kore';
  try {
    let cleanText = normalizeTextForCartesia(narration);
    cleanText = cleanText.replace(/\\s+/g, ' ').trim();
    
    // Call Kokoro
    const data = await fetchKokoroWithRetry(cleanText);
    const audioBase64 = data.audio_base64;
    const mime = data.mime || 'audio/wav';
    const ext  = mime === 'audio/mpeg' ? 'mp3' : 'wav';
    audioUrl = await uploadToSupabaseStorage(audioBase64, \`kokoro_\${uuidv4()}.\${ext}\`, mime);
    voiceName = 'kokoro_82m';
    duration = data.playbackDuration ? data.playbackDuration : duration;
  } catch (error) {
    console.error(\`[TTS] Scene \${scene_id} narration failed; continuing without audio.\`, error);
    audioUrl = null as any;
    voiceName = 'unavailable';
  }

  if (audioUrl) {
    await sql\`
      INSERT INTO narration_assets (id, org_id, scene_id, asset_url, voice_name, duration_ms)
      VALUES (\${uuidv4()}, \${org_id}, \${scene_id}, \${audioUrl}, \${voiceName}, \${Math.round(duration * 1000)})
      ON CONFLICT (scene_id) DO UPDATE SET asset_url = EXCLUDED.asset_url, voice_name = EXCLUDED.voice_name, duration_ms = EXCLUDED.duration_ms
    \`;
  }`;

const newStr = `  // Insert Narration
  let audioUrl: string | null = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg'; // fallback
  let voiceName = 'Google_Kore';
  let realDurationMs = Math.round(duration * 1000);
  
  try {
    const cleanText = normalizeTextForCartesia(narration);
    
    // Call Kokoro
    const data = await fetchKokoroWithRetry(cleanText);
    const audioBase64 = data.audio_base64;
    const mime = data.mime || 'audio/wav';
    const ext  = mime === 'audio/mpeg' ? 'mp3' : 'wav';
    audioUrl = await uploadToSupabaseStorage(audioBase64, \`kokoro_\${uuidv4()}.\${ext}\`, mime);
    voiceName = 'kokoro_82m';
    
    realDurationMs = data.playbackDuration 
      ? Math.round(data.playbackDuration * 1000) 
      : Math.round(duration * 1000);
  } catch (error) {
    console.error(\`[TTS] Scene \${scene_id} narration failed; continuing without audio.\`, error);
    audioUrl = null;
    voiceName = 'unavailable';
  }

  await sql\`
    INSERT INTO narration_assets (id, org_id, scene_id, asset_url, voice_name, duration_ms)
    VALUES (\${uuidv4()}, \${org_id}, \${scene_id}, \${audioUrl}, \${voiceName}, \${realDurationMs})
    ON CONFLICT (scene_id) DO UPDATE SET asset_url = EXCLUDED.asset_url, voice_name = EXCLUDED.voice_name, duration_ms = EXCLUDED.duration_ms
  \`;`;

content = content.replace(targetStr, newStr);
fs.writeFileSync('server/videoPipeline.ts', content);
console.log("Fixed duration");
