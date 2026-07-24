const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regexClean = /let cleanText = extractedText\.replace\(\/\[\^\}\{\\\[\\\]"\'\]\/g, ' '\);/g;
// Actually I can just replace the specific string
code = code.replace(/let cleanText = extractedText\.replace\(\/\[\^\}\{\\\[\\\]"\'\]\/g, ' '\);/, "let cleanText = extractedText.replace(/[^a-zA-Z0-9\\s.,!?\\-:;()]/g, ' ');");
// Wait, the original code is:
// let cleanText = extractedText.replace(/[{}[\]"']/g, ' ');
code = code.replace(/let cleanText = extractedText\.replace\(\/\[\{\}\[\\\]"'\]\/g, ' '\);/, "let cleanText = extractedText.replace(/[^a-zA-Z0-9\\s.,!?\\-:;()]/g, ' ');");

const regexTimestamps = /const words = cleanText\.split\(\/\\s\+\/\)\.filter\(w => w\.length > 0\);\n    if \(words\.length > 0\) \{\n      const avgDuration = playbackDuration \/ words\.length;\n      mappedTimestamps = words\.map\(\(word, idx\) => \(\{\n        word,\n        start: idx \* avgDuration,\n        end: \(idx \+ 1\) \* avgDuration\n      \}\)\);\n      console\.log\(`\[Kokoro\] Raw duration: \$\{rawDuration\.toFixed\(2\)\}s, Playback duration: \$\{playbackDuration\.toFixed\(2\)\}s, Words: \$\{words\.length\}, Avg per word: \$\{avgDuration\.toFixed\(3\)\}s`\);\n    \}/;

const newTimestamps = `const words = cleanText.split(/\\s+/).filter(w => w.length > 0);
    
    const cleanedWords = words
      .map(w => w.replace(/[^a-zA-Z]/g, ''))
      .filter(w => w.length > 0);
    
    const speakableWords = cleanedWords.filter(w => 
      w.length > 1 || w === 'a' || w === 'i' || w === 'A' || w === 'I'
    );
    
    if (speakableWords.length > 0) {
      const totalChars = speakableWords.reduce((sum, w) => sum + w.length, 0);
      let currentTime = 0;
      
      mappedTimestamps = speakableWords.map((word) => {
        const wordDuration = (word.length / totalChars) * playbackDuration;
        const timestamp = {
          word,
          start: currentTime,
          end: currentTime + wordDuration
        };
        currentTime += wordDuration;
        return timestamp;
      });
      console.log(\`[Kokoro] Raw duration: \$\{rawDuration.toFixed(2)\}s, Playback duration: \$\{playbackDuration.toFixed(2)\}s, Speakable Words: \$\{speakableWords.length\}\`);
    } else if (words.length > 0) {
      const avgDuration = playbackDuration / words.length;
      mappedTimestamps = words.map((word, idx) => ({
        word,
        start: idx * avgDuration,
        end: (idx + 1) * avgDuration
      }));
    }`;

code = code.replace(regexTimestamps, newTimestamps);
fs.writeFileSync('server.ts', code);
console.log("Patched server.ts with word-length weights");
