const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const cacheDeclaration = `const ttsNormalizationCache = new Map<string, string>();\n\napp.post('/api/tts/cartesia',`;
code = code.replace("app.post('/api/tts/cartesia',", cacheDeclaration);

const replacement = `        let spokenText = normalizeTextForCartesia(chunk.text);
        if (/\\\\(?:int|sum|begin|sin|cos|lim|tan|prod|theta|alpha|beta|gamma|omega|sigma)|\\[a-zA-Z]+|\\\\{|\\\\}/i.test(chunk.text)) {
            if (ttsNormalizationCache.has(chunk.text)) {
                spokenText = ttsNormalizationCache.get(chunk.text)!;
            } else {
                spokenText = await normalizeTextForTTS(spokenText);
                ttsNormalizationCache.set(chunk.text, spokenText);
            }
        }
        await context.send({ transcript: spokenText });`;

code = code.replace("        await context.send({ transcript: normalizeTextForCartesia(chunk.text) });", replacement);

fs.writeFileSync('server.ts', code);
console.log('patched cartesia server with LLM normalizer');
