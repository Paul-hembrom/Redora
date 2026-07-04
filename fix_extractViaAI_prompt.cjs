const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const regex = /CRITICAL RULES:\n1\. DO NOT summarize, change, or omit ANY text\. Copy the text verbatim\. EVERY paragraph, every bullet point, every detail must be included in the content strings\. THIS IS CRITICAL\.\nYou are an expert document processor\. You must process the provided text and output the full contents verbatim\. DO NOT summarize, paraphrase, omit, or change any text\. Ensure all subsections and details are included\. Output in valid JSON format\./;
const replacement = `CRITICAL RULES:\n1. CRITICAL: DO NOT summarize, omit, or change ANY text. Every paragraph, sentence, and word from the original must appear EXACTLY ONCE in the output. Copy the text verbatim into the appropriate topic's "content" field.`;
code = code.replace(regex, replacement);

fs.writeFileSync('src/lib/gemini.ts', code);
