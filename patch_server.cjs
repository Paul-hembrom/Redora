const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldTTS = `    const chunks = await Promise.all(rawBlocks.map(async (block: string, index: number) => {
      return ttsLimiter(async () => {
        // Optional: Normalize Math per-block if it looks like there might be math or it's long enough.
        // We skip very short lines or headings to speed up processing.
        let sentence = block;
        if (sentence.length > 20 && !sentence.startsWith('#')) {
            sentence = await normalizeTextForTTS(sentence);
        }
`;

const newTTS = `    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send total chunks count as the first line so frontend knows how many to expect
    res.write(JSON.stringify({ totalChunks: rawBlocks.length }) + '\\n');

    const chunks = await Promise.all(rawBlocks.map(async (block: string, index: number) => {
      return ttsLimiter(async () => {
        // We skip normalizeTextForTTS to ensure Scribe timestamps align perfectly with the frontend text,
        // and to eliminate the startup delay caused by the Gemini API call.
        let sentence = block;
`;

code = code.replace(oldTTS, newTTS);

const oldReturn = `           return { index, text: sentence, audioUrl: \`data:audio/mpeg;base64,\${base64}\`, timestamps };
        }
        return { index, text: sentence, audioUrl: null };
      });
    }));

    const validChunks = chunks.filter(c => c !== null);
    if (validChunks.length === 0) {
       return res.status(500).json({ error: 'TTS generation failed for all chunks' });
    }
    
    return res.json({ chunks: validChunks });
  } catch (err: any) {
    console.error("ElevenLabs TTS Error:", err);
    res.status(500).json({ error: 'TTS failed' });
  }
});`;

const newReturn = `           const result = { index, text: sentence, audioUrl: \`data:audio/mpeg;base64,\${base64}\`, timestamps };
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
    console.error("ElevenLabs TTS Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'TTS failed' });
    } else {
      res.end();
    }
  }
});`;

code = code.replace(oldReturn, newReturn);

fs.writeFileSync('server.ts', code);
console.log('patched server');
