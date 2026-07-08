import fs from 'fs';
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf-8');

const logHelpers = `
const logInfo = (msg: string, data?: any) => {
  console.log('%c[SmartReadAloud]', 'color: #0ea5e9; font-weight: bold; background: #0ea5e91a; padding: 2px 6px; border-radius: 4px;', msg, data || '');
};

const logSuccess = (msg: string, data?: any) => {
  console.log('%c[SmartReadAloud]', 'color: #10b981; font-weight: bold; background: #10b9811a; padding: 2px 6px; border-radius: 4px;', msg, data || '');
};

const logWarning = (msg: string, data?: any) => {
  console.warn('%c[SmartReadAloud]', 'color: #f59e0b; font-weight: bold; background: #f59e0b1a; padding: 2px 6px; border-radius: 4px;', msg, data || '');
};

const logError = (msg: string, data?: any) => {
  console.error('%c[SmartReadAloud]', 'color: #ef4444; font-weight: bold; background: #ef44441a; padding: 2px 6px; border-radius: 4px;', msg, data || '');
};

`;

content = content.replace("export function SmartReadAloudButton", logHelpers + "\nexport function SmartReadAloudButton");

content = content.replace(/console\.log\(\`\[SmartReadAloud\] Found \$\{vList\.length\} voices\.\`\);/g, "logSuccess(`Found ${vList.length} voices loaded.`);");
content = content.replace(/console\.log\(\`\[SmartReadAloud\] Languages: \$\{Array\.from\(new Set\(vList\.map\(v => v\.lang\)\)\)\.join\(\', \'\)\}\`\);/g, "logInfo(`Available voice languages: ${Array.from(new Set(vList.map(v => v.lang))).join(', ')}`);");
content = content.replace(/console\.log\("\[SmartReadAloud\] No voices initially\. Listening for voiceschanged\.\.\."\);/g, "logInfo('No voices initially. Listening for voiceschanged event...');");
content = content.replace(/console\.log\("\[SmartReadAloud\] speechSynthesis API not found\."\);/g, "logError('speechSynthesis API not found in this browser.');");
content = content.replace(/console\.log\("\[SmartReadAloud\] Trying ElevenLabs TTS"\);/g, "logInfo('Triggered: Attempting ElevenLabs TTS API call...');");
content = content.replace(/console\.log\("\[SmartReadAloud\] ElevenLabs TTS playing successfully\."\);/g, "logSuccess('ElevenLabs TTS API call successful, audio is playing.');");
content = content.replace(/console\.error\("\[SmartReadAloud\] ElevenLabs TTS failed:", err\);/g, "logError('ElevenLabs TTS API call failed:', err);");
content = content.replace(/console\.error\("\[SmartReadAloud\] ElevenLabs audio playback error"\);/g, "logError('ElevenLabs audio element threw a playback error.');");
content = content.replace(/console\.log\("\[SmartReadAloud\] Falling back to browser SpeechSynthesis"\);/g, "logWarning('Falling back to local browser SpeechSynthesis engine...');");
content = content.replace(/console\.log\("\[SmartReadAloud\] speechSynthesis not supported\."\);/g, "logError('SpeechSynthesis engine is not supported by this browser.');");
content = content.replace(/console\.log\("\[SmartReadAloud\] No voices available at speak time\."\);/g, "logError('TTS Failed: No local voices available at time of speak request.');");
content = content.replace(/console\.log\(\`\[SmartReadAloud\] Selected voice: \$\{englishVoice\.name\} \(\$\{englishVoice\.lang\}\)\`\);/g, "logSuccess(`Selected local voice: ${englishVoice.name} (${englishVoice.lang})`);");
content = content.replace(/console\.log\("\[SmartReadAloud\] Selected voice: Default"\);/g, "logInfo('Selected local voice: Default system voice');");
content = content.replace(/console\.error\("\[SmartReadAloud\] SpeechSynthesis error:", e\);/g, "logError('SpeechSynthesis API threw an error:', e);");
content = content.replace(/console\.log\("\[SmartReadAloud\] Called speechSynthesis\.speak\(\)"\);/g, "logInfo('Called window.speechSynthesis.speak() command.');");
content = content.replace(/console\.error\("\[SmartReadAloud\] Exception calling speak\(\):", err\);/g, "logError('Caught exception when calling speak():', err);");
content = content.replace(/console\.warn\("\[SmartReadAloud\] Speaking is false after 2 seconds\. Triggering fallback error\."\);/g, "logWarning('Timeout check: speaking flag is still false after 2 seconds. Triggering failure.');");
content = content.replace(/console\.log\("\[SmartReadAloud\] Confirmed speaking started successfully\."\);/g, "logSuccess('Timeout check: confirmed local synthesis is successfully speaking.');");


fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
