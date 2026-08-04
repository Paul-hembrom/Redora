const fs = require('fs');
let code = fs.readFileSync('server/videoPipeline.ts', 'utf-8');

// 1. Add jsonrepair import
if (!code.includes("jsonrepair")) {
  code = "import { jsonrepair } from 'jsonrepair';\n" + code;
}

// 2. Fix the prompt instruction
code = code.replace(
  'Output only the JSON array without markdown formatting.',
  'Return a JSON object of the form {"scenes": [ ... ]} containing 6 to 10 scene objects.'
);

// 3. Fix the JSON parsing and callLLM invocation
const targetParse = `    const rawResponse = await callLLM(prompt, "You are a helpful AI assistant.", "json_object");
    let scenesData: any = [];
    try {
        let text = rawResponse.trim();
        if (text.startsWith("\`\`\`json")) {
            text = text.substring(7);
        }
        if (text.endsWith("\`\`\`")) {
            text = text.substring(0, text.length - 3);
        }
        scenesData = JSON.parse(text);
        if (!Array.isArray(scenesData)) {
            // Might be wrapped in an object like { scenes: [] }
            scenesData = scenesData.scenes || scenesData.data || [];
        }
    } catch(e) {
        throw new Error("Failed to parse LLM response into structured scenes JSON");
    }`;

const replaceParse = `    const rawResponse = await callLLM(prompt, "You are a helpful AI assistant.", "json_object", 8192);
    let scenesData: any[] = [];
    try {
        const text = rawResponse.replace(/\`\`\`json\\s*/gi, '').replace(/\`\`\`\\s*/gi, '').trim();
        let parsed;
        try { parsed = JSON.parse(text); }
        catch { parsed = JSON.parse(jsonrepair(text)); }
        scenesData = Array.isArray(parsed) ? parsed : (parsed.scenes || parsed.data || []);
    } catch(e) {
        throw new Error(\`Failed to parse LLM scenes JSON: \${(e as any).message}\`);
    }`;

code = code.replace(targetParse, replaceParse);

fs.writeFileSync('server/videoPipeline.ts', code);
