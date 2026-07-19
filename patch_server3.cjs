const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "    const validChunks = chunks.filter(c => c !== null);\n\n    if (validChunks.length === 0) {\n       return res.status(500).json({ error: 'TTS generation failed for all chunks' });\n    }\n\n    res.json({ chunks: validChunks });\n  } catch (err: any) {\n    console.error('ElevenLabs TTS endpoint error:', err);\n    res.status(500).json({ error: 'Internal server error' });\n  }\n});",
  "    res.end();\n  } catch (err: any) {\n    console.error('ElevenLabs TTS endpoint error:', err);\n    if (!res.headersSent) {\n      res.status(500).json({ error: 'Internal server error' });\n    } else {\n      res.end();\n    }\n  }\n});"
);

code = code.replace(
  "           return { index, text: sentence, audioUrl: `data:audio/mpeg;base64,${base64}`, timestamps };\n        }\n        return { index, text: sentence, audioUrl: null };\n      });\n    }));",
  "           const result = { index, text: sentence, audioUrl: `data:audio/mpeg;base64,${base64}`, timestamps };\n           res.write(JSON.stringify(result) + '\\n');\n           return result;\n        }\n        const errResult = { index, text: sentence, audioUrl: null };\n        res.write(JSON.stringify(errResult) + '\\n');\n        return errResult;\n      });\n    }));"
);

fs.writeFileSync('server.ts', code);
console.log('patched server end part 3');
