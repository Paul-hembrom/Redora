const fs = require('fs');
let code = fs.readFileSync('server/videoPipeline.ts', 'utf-8');

const ttsStart = code.indexOf('    // Call Kokoro');
const ttsEnd = code.indexOf('  } catch (error) {', ttsStart);

if (ttsStart !== -1 && ttsEnd !== -1) {
    const replaceTts = `    // Call Kokoro
    const data = await fetchKokoroWithRetry(cleanText);
    const audioBase64 = data.audio_base64;
    const mime = data.mime || 'audio/wav';
    const ext  = mime === 'audio/mpeg' ? 'mp3' : 'wav';
    audioUrl = await uploadToSupabaseStorage(audioBase64, \`kokoro_\${uuidv4()}.\${ext}\`, mime);
    voiceName = 'kokoro_82m';
    duration = data.playbackDuration ? data.playbackDuration : duration;
`;
    code = code.substring(0, ttsStart) + replaceTts + code.substring(ttsEnd);
    
    // Also, the ON CONFLICT is on (id) in the visual_metadata and narration_assets inserts.
    // Let's fix that. P0-6 says it needs ON CONFLICT (scene_id).
    
    code = code.replace(
      'ON CONFLICT (id) DO UPDATE SET image_url = EXCLUDED.image_url, model_used = EXCLUDED.model_used',
      'ON CONFLICT (scene_id) DO UPDATE SET image_url = EXCLUDED.image_url, model_used = EXCLUDED.model_used, prompt = EXCLUDED.prompt'
    );
    
    code = code.replace(
      'ON CONFLICT (id) DO UPDATE SET asset_url = EXCLUDED.asset_url, voice_name = EXCLUDED.voice_name',
      'ON CONFLICT (scene_id) DO UPDATE SET asset_url = EXCLUDED.asset_url, voice_name = EXCLUDED.voice_name, duration_ms = EXCLUDED.duration_ms'
    );
    
    // Also fix the TTS catch block for P0-3
    const catchTarget = `  } catch (error) {
    console.error('TTS generation failed, using fallback beep', error);
    if (rendererOverride) {
      throw new Error(\`Scene narration failed completely: \${(error as any).message}\`);
    }
  }`;
  
    const catchReplace = `  } catch (error) {
    console.error(\`[TTS] Scene \${scene_id} narration failed; continuing without audio.\`, error);
    audioUrl = null as any;
    voiceName = 'unavailable';
  }`;
    code = code.replace(catchTarget, catchReplace);

    // If audioUrl is null, we shouldn't insert it into narration_assets
    const insertNarrationTarget = `  await sql\`
    INSERT INTO narration_assets (id, org_id, scene_id, asset_url, voice_name, duration_ms)
    VALUES (\${uuidv4()}, \${org_id}, \${scene_id}, \${audioUrl}, \${voiceName}, \${duration * 1000})
    ON CONFLICT (scene_id) DO UPDATE SET asset_url = EXCLUDED.asset_url, voice_name = EXCLUDED.voice_name, duration_ms = EXCLUDED.duration_ms
  \`;`;

    const insertNarrationReplace = `  if (audioUrl) {
    await sql\`
      INSERT INTO narration_assets (id, org_id, scene_id, asset_url, voice_name, duration_ms)
      VALUES (\${uuidv4()}, \${org_id}, \${scene_id}, \${audioUrl}, \${voiceName}, \${Math.round(duration * 1000)})
      ON CONFLICT (scene_id) DO UPDATE SET asset_url = EXCLUDED.asset_url, voice_name = EXCLUDED.voice_name, duration_ms = EXCLUDED.duration_ms
    \`;
  }`;
    code = code.replace(insertNarrationTarget, insertNarrationReplace);

    fs.writeFileSync('server/videoPipeline.ts', code);
}
