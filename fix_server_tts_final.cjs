const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Ensure that LLM text normalizer handles any uncached responses by waiting properly
const checkNormalizer = code.match(/spokenText = await normalizeTextWithLLM\(cleanChunk\);/);
if (checkNormalizer) {
    console.log("Normalizer is applied successfully");
} else {
    console.log("Normalizer NOT applied");
}

