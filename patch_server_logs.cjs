const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldRawBlocks = `    // Chunk by Markdown blocks (paragraphs, lists, etc) separated by double newlines.
    // This perfectly matches the frontend ReactMarkdown block splitting so IDs align perfectly.
    const rawBlocks = text.split(/\\n\\n+/).map(s => s.trim()).filter(Boolean);
    
    const chunkRequests: { text: string, domIndex: number, index: number }[] = [];`;

const newRawBlocks = `    console.log(\`[TTS] Request received. Text length: \${text.length}, HighQuality: \${highQuality}\`);
    // Chunk by Markdown blocks (paragraphs, lists, etc) separated by double newlines.
    // This perfectly matches the frontend ReactMarkdown block splitting so IDs align perfectly.
    const rawBlocks = text.split(/\\n\\n+/).map(s => s.trim()).filter(Boolean);
    
    const chunkRequests: { text: string, domIndex: number, index: number }[] = [];`;

code = code.replace(oldRawBlocks, newRawBlocks);

const oldChunksCreation = `    res.write(JSON.stringify({ totalChunks: chunkRequests.length }) + '\\n');`;

const newChunksCreation = `    console.log(\`[TTS] Created \${chunkRequests.length} chunk(s) from \${rawBlocks.length} markdown block(s).\`);
    res.write(JSON.stringify({ totalChunks: chunkRequests.length }) + '\\n');`;

code = code.replace(oldChunksCreation, newChunksCreation);

const oldError1 = `               if (!response.ok) {
                 retries++;
                 continue;
               }`;

const newError1 = `               if (!response.ok) {
                 const errBody = await response.text().catch(() => 'could not read error body');
                 console.error(\`[TTS] ElevenLabs streaming API error (\${response.status}): \${errBody} (voice: \${voiceId}, model: \${modelId}, text length: \${reqChunk.text.length})\`);
                 retries++;
                 continue;
               }`;

code = code.replace(oldError1, newError1);

const oldCatch1 = `           } catch(e) {
               retries++;
           }`;

const newCatch1 = `           } catch(e) {
               console.error(\`[TTS] ElevenLabs streaming API fetch error:\`, e);
               retries++;
           }`;

code = code.replace(oldCatch1, newCatch1);

const oldFallbackError = `            if (fallbackResponse.ok) {
                const fbBuffer = await fallbackResponse.arrayBuffer();
                if (fbBuffer.byteLength >= 500) {
                    const fbBase64 = Buffer.from(fbBuffer).toString('base64');
                    const fbResult = { index: reqChunk.index, domIndex: reqChunk.domIndex, text: reqChunk.text, audioUrl: \`data:audio/mpeg;base64,\${fbBase64}\`, timestamps: [] };
                    res.write(JSON.stringify(fbResult) + '\\n');
                    return fbResult;
                }
            }
        } catch(e) {}
        
        const errResult = { index: reqChunk.index, domIndex: reqChunk.domIndex, text: reqChunk.text, audioUrl: null };`;

const newFallbackError = `            if (fallbackResponse.ok) {
                const fbBuffer = await fallbackResponse.arrayBuffer();
                if (fbBuffer.byteLength >= 500) {
                    const fbBase64 = Buffer.from(fbBuffer).toString('base64');
                    const fbResult = { index: reqChunk.index, domIndex: reqChunk.domIndex, text: reqChunk.text, audioUrl: \`data:audio/mpeg;base64,\${fbBase64}\`, timestamps: [] };
                    res.write(JSON.stringify(fbResult) + '\\n');
                    return fbResult;
                } else {
                    console.error(\`[TTS] ElevenLabs fallback API returned too small buffer: \${fbBuffer.byteLength} bytes\`);
                }
            } else {
                const errBody = await fallbackResponse.text().catch(() => 'could not read error body');
                console.error(\`[TTS] ElevenLabs fallback API error (\${fallbackResponse.status}): \${errBody}\`);
            }
        } catch(e) {
            console.error(\`[TTS] ElevenLabs fallback API fetch error:\`, e);
        }
        
        console.error(\`[TTS] Chunk \${reqChunk.index} failed completely. Returning null audioUrl.\`);
        const errResult = { index: reqChunk.index, domIndex: reqChunk.domIndex, text: reqChunk.text, audioUrl: null };`;

code = code.replace(oldFallbackError, newFallbackError);

fs.writeFileSync('server.ts', code);
console.log('patched server logs');
