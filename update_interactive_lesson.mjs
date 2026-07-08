import fs from 'fs';

let content = fs.readFileSync('src/components/InteractiveLesson.tsx', 'utf-8');

// Update the fetch logic with a 30s timeout
const oldFetchLogic = `       const { generateILMChatResponse } = await import('../lib/gemini');
       const aiResponseText = await generateILMChatResponse(textToSubmit, contentContext, chatHistory as any);`;

const newFetchLogic = `       const { generateILMChatResponse } = await import('../lib/gemini');
       
       const timeoutPromise = new Promise<string>((_, reject) => {
         setTimeout(() => reject(new Error('TIMEOUT')), 30000);
       });
       
       const aiResponseText = await Promise.race([
         generateILMChatResponse(textToSubmit, contentContext, chatHistory as any),
         timeoutPromise
       ]);`;

content = content.replace(oldFetchLogic, newFetchLogic);

// Update error message
content = content.replace(
  'setError("Failed to get an answer.");',
  'setError("Maya is having trouble answering right now. Please try again.");'
);

// Update loading text
const oldLoader = `<div className="bg-zinc-800/80 rounded-3xl px-6 py-5 rounded-bl-sm border border-white/10 flex gap-2 shadow-md">
                      <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>`;

const newLoader = `<div className="bg-zinc-800/80 rounded-3xl px-6 py-5 rounded-bl-sm border border-white/10 flex items-center gap-3 shadow-md">
                      <span className="text-white/60 text-sm font-medium">Maya is thinking...</span>
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>`;

content = content.replace(oldLoader, newLoader);

fs.writeFileSync('src/components/InteractiveLesson.tsx', content);
