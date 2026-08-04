const fs = require('fs');
let content = fs.readFileSync('src/lib/gemini.ts', 'utf-8');

const oldEnv = `const DEEPSEEK_KEY = getEnvSafe('VITE_DEEPSEEK_API_KEY', () => import.meta.env.VITE_DEEPSEEK_API_KEY as string);
const GEMINI_KEY   = getEnvSafe('VITE_GEMINI_API_KEY',   () => import.meta.env.VITE_GEMINI_API_KEY as string);
const EL_KEY       = getEnvSafe('VITE_ELEVENLABS_API_KEY', () => import.meta.env.VITE_ELEVENLABS_API_KEY as string);`;

const newEnv = `const DEEPSEEK_KEY = getEnvSafe('DEEPSEEK_API_KEY', () => import.meta.env.VITE_DEEPSEEK_API_KEY as string)
                  || getEnvSafe('VITE_DEEPSEEK_API_KEY', () => import.meta.env.VITE_DEEPSEEK_API_KEY as string);
const GEMINI_KEY   = getEnvSafe('GEMINI_API_KEY', () => import.meta.env.VITE_GEMINI_API_KEY as string)
                  || getEnvSafe('VITE_GEMINI_API_KEY', () => import.meta.env.VITE_GEMINI_API_KEY as string);
const EL_KEY       = getEnvSafe('ELEVENLABS_API_KEY', () => import.meta.env.VITE_ELEVENLABS_API_KEY as string)
                  || getEnvSafe('VITE_ELEVENLABS_API_KEY', () => import.meta.env.VITE_ELEVENLABS_API_KEY as string);`;

content = content.replace(oldEnv, newEnv);

const oldTTS = `    const chunks = await Promise.all(sentences.map(async (sentence: string, index: number) => {
       const response = await fetch(url, {`;
       
const newTTS = `    const limit = (await import('./documentProcessor.js')).createConcurrencyLimit(3);
    const chunks = await Promise.all(
      sentences.map((sentence: string, index: number) => limit(async () => {
       const response = await fetch(url, {`;

content = content.replace(oldTTS, newTTS);

const oldTTSEnd = `           sentence: sentence
         };
       }
    }));
    return chunks;
  } catch (e) {`;

const newTTSEnd = `           sentence: sentence
         };
       }
    })));
    
    const validChunks = chunks.filter(c => c !== null);
    if (validChunks.length === 0) {
      console.error(\`[TTS] All \${sentences.length} ElevenLabs chunks failed (likely rate limited).\`);
      return null;
    }
    if (validChunks.length < sentences.length) {
      console.warn(\`[TTS] \${sentences.length - validChunks.length}/\${sentences.length} chunks failed.\`);
    }
    return validChunks;
  } catch (e) {`;

content = content.replace(oldTTSEnd, newTTSEnd);

fs.writeFileSync('src/lib/gemini.ts', content);
console.log("Fixed env and tts gemini.ts");
