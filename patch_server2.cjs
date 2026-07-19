const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /           return { index, text: sentence, audioUrl: `data:audio\/mpeg;base64,\${base64}`, timestamps };\n         }\n         return { index, text: sentence, audioUrl: null };\n       }\);\n     }\)\);\n\n    const validChunks = chunks\.filter\(c => c !== null\);\n\n    if \(validChunks\.length === 0\) {\n       return res\.status\(500\)\.json\({ error: 'TTS generation failed for all chunks' }\);\n    }\n\n    res\.json\({ chunks: validChunks }\);\n  } catch \(err: any\) {\n    console\.error\('ElevenLabs TTS endpoint error:', err\);\n    res\.status\(500\)\.json\({ error: 'Internal server error' }\);\n  }\n}\);/m;

const newStr = `           const result = { index, text: sentence, audioUrl: \`data:audio/mpeg;base64,\${base64}\`, timestamps };
           res.write(JSON.stringify(result) + '\\n');
           return result;
        }
        const errResult = { index, text: sentence, audioUrl: null };
        res.write(JSON.stringify(errResult) + '\\n');
        return errResult;
      });
    }));

    res.end();
  } catch (err: any) {
    console.error('ElevenLabs TTS endpoint error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.end();
    }
  }
});`;

code = code.replace(regex, newStr);
fs.writeFileSync('server.ts', code);
console.log('patched server end');
