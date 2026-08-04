const fs = require('fs');
let code = fs.readFileSync('server/videoPipeline.ts', 'utf-8');

const ttsTarget = `    } catch (error) {
        console.error('TTS generation failed, using fallback beep', error);
        if (rendererOverride) {
            throw new Error(\`Scene narration failed completely: \${(error as any).message}\`);
        }
        audioUrl = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';
    }`;

const ttsReplace = `    } catch (error) {
        console.error(\`[TTS] Scene \${scene_id} narration failed; continuing without audio.\`, error);
        audioUrl = null;
        voiceName = 'unavailable';
    }`;

code = code.replace(ttsTarget, ttsReplace);

fs.writeFileSync('server/videoPipeline.ts', code);
