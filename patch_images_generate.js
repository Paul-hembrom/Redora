import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

const targetPrompt = `        const keywordPrompt = \`You are an Educational Search Assistant. Based on the chapter title, key concepts, and a detailed content summary, generate a single, precise search keyword that can be used on a photo/diagram search engine to find a relevant educational image. 
- If the subject is Mathematics, the search keyword must include the word "mathematics" or "math" and be appropriate for a classroom diagram (e.g., "set theory diagram math").
- Avoid generic keywords that could return irrelevant results (e.g., jewellery, fashion).
Return ONLY a JSON object: {"keyword": "string"}

Subject: \${subject}
Chapter Title: \${subtopic}
Key Concepts: \${title}
Content Summary: \${generatedContent ? generatedContent.substring(0, 2000) : ''}\`;`;

const replacementPrompt = `        const keywordPrompt = \`You are a safe educational image search assistant. Given the following textbook explanation for a subtopic, generate a single, highly specific search keyword that would find a relevant, classroom‑appropriate educational diagram or illustration on Pexels/Unsplash.

The image must be suitable for students of \${grade}.

Avoid any keyword that could return fashion, celebrity, or adult content.

Return ONLY a JSON object: {"keyword": "string"}

Subtopic: \${subtopic}
Full explanation: \${generatedContent ? generatedContent.substring(0, 2000) : ''}\`;`;

if (code.includes(targetPrompt)) {
    code = code.replace(targetPrompt, replacementPrompt);
    fs.writeFileSync('server.ts', code);
    console.log("Patched keyword prompt");
} else {
    console.log("Target prompt not found");
}

