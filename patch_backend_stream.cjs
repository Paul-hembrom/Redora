const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldUrl = "const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_22050_32`;";
const newUrl = "const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=3&with_timestamps=true&output_format=mp3_44100_128`;";
code = code.replace(oldUrl, newUrl);

// Also replace in the prewarm endpoint
const oldPrewarm = "fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_22050_32`, {";
const newPrewarm = "fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=3&with_timestamps=true&output_format=mp3_44100_128`, {";
code = code.replace(oldPrewarm, newPrewarm);

const oldLogicRegex = /               const audioBuffer = await response\.arrayBuffer\(\);[\s\S]*?console\.error\("Scribe error:", scribeErr\);\n               }/m;

const newLogic = `               const decoder = new TextDecoder();
               const reader = response.body.getReader();
               let buffer = '';
               let finalAudioBase64 = '';
               let chars = [];
               let startTimes = [];
               let durations = [];
               
               while (true) {
                   const { done, value } = await reader.read();
                   if (done) break;
                   buffer += decoder.decode(value, { stream: true });
                   
                   let boundary = buffer.indexOf('\\n');
                   while (boundary !== -1) {
                       const line = buffer.slice(0, boundary).trim();
                       buffer = buffer.slice(boundary + 1);
                       if (line) {
                           try {
                               const data = JSON.parse(line);
                               if (data.audio_base64) finalAudioBase64 += data.audio_base64;
                               if (data.alignment) {
                                   if (data.alignment.chars) chars.push(...data.alignment.chars);
                                   if (data.alignment.charStartTimesMs) startTimes.push(...data.alignment.charStartTimesMs);
                                   if (data.alignment.charDurationsMs) durations.push(...data.alignment.charDurationsMs);
                               }
                           } catch(e) {}
                       }
                       boundary = buffer.indexOf('\\n');
                   }
               }
               
               if (buffer.trim()) {
                   try {
                       const data = JSON.parse(buffer);
                       if (data.audio_base64) finalAudioBase64 += data.audio_base64;
                       if (data.alignment) {
                           if (data.alignment.chars) chars.push(...data.alignment.chars);
                           if (data.alignment.charStartTimesMs) startTimes.push(...data.alignment.charStartTimesMs);
                           if (data.alignment.charDurationsMs) durations.push(...data.alignment.charDurationsMs);
                       }
                   } catch(e) {}
               }
               
               if (!finalAudioBase64) {
                   retries++;
                   continue;
               }
               
               let timestamps = [];
               let currentWord = "";
               let wordStart = null;
               let wordEnd = null;
               
               for (let i = 0; i < chars.length; i++) {
                   const char = chars[i];
                   const start = startTimes[i];
                   const duration = durations[i];
                   
                   if (char.trim() === "") {
                       if (currentWord.length > 0) {
                           timestamps.push({ word: currentWord, start: wordStart / 1000, end: wordEnd / 1000 });
                           currentWord = "";
                           wordStart = null;
                       }
                   } else {
                       if (currentWord.length === 0) wordStart = start;
                       currentWord += char;
                       wordEnd = start + duration;
                   }
               }
               if (currentWord.length > 0) {
                   timestamps.push({ word: currentWord, start: wordStart / 1000, end: wordEnd / 1000 });
               }`;

code = code.replace(oldLogicRegex, newLogic);
fs.writeFileSync('server.ts', code);
console.log('patched stream backend');
