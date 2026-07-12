import fs from 'fs';

let lessonTsx = fs.readFileSync('src/components/InteractiveLesson.tsx', 'utf8');
lessonTsx = lessonTsx.replace(/const \{ transcribeSpeech \} = await import\('\.\.\/lib\/gemini'\);/g, "");
lessonTsx = lessonTsx.replace(/const \{ generateILMChatResponse \} = await import\('\.\.\/lib\/gemini'\);/g, "");
if (!lessonTsx.includes("import { transcribeSpeech, generateILMChatResponse }")) {
    lessonTsx = "import { transcribeSpeech, generateILMChatResponse } from '../lib/gemini';\n" + lessonTsx;
}
fs.writeFileSync('src/components/InteractiveLesson.tsx', lessonTsx);

console.log("Fixed gemini imports!");
