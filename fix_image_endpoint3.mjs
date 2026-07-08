import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

// Update import
content = content.replace(
  "import { generateChapterMetadata, generateSearchQueries } from './src/lib/gemini.js';",
  "import { generateChapterMetadata, generateSearchQueries, callLLM } from './src/lib/gemini.js';"
);

const targetStartStr = "const ai = new GoogleGenAI({ \n      apiKey: process.env.GEMINI_API_KEY || '',\n      httpOptions: {\n        retryOptions: {\n          attempts: 2\n        }\n      }\n    });";

const targetEndStr = "      console.error(\"Gemini query generation failed, using fallback query\", err);\n    }";

const targetStart = content.indexOf("const ai = new GoogleGenAI({ ");
if (targetStart === -1) throw new Error('Could not find GoogleGenAI initialization');

const targetEndIndex = content.indexOf(targetEndStr) + targetEndStr.length;

const newCode = `const keywordPrompt = \`You are an Educational Search Assistant. Your job is to extract a single, precise, physical or scientific search keyword from the provided chapter and subtopics that can be used on photo/diagram search engines. Return ONLY a JSON object matching this format: {"keyword": "string"}\n\nChapter Title: \${title}\nKey Concepts: \${Array.isArray(key_concepts) ? key_concepts.join(', ') : ''}\`;\n\n    let searchQuery = \`\${title} \${Array.isArray(key_concepts) ? key_concepts.join(' ') : ''}\`.substring(0, 50).trim();\n    try {\n      const raw = await callLLM(keywordPrompt, undefined, 'json_object');\n      const parsed = JSON.parse(raw);\n      if (parsed.keyword) {\n        searchQuery = parsed.keyword.trim();\n      }\n    } catch (err) {\n      console.error("DeepSeek query generation failed, using fallback query", err);\n    }`;

content = content.substring(0, targetStart) + newCode + content.substring(targetEndIndex);
fs.writeFileSync('server.ts', content);
console.log('Update complete');
