import fs from 'fs';
let content = fs.readFileSync('src/components/ChatArea.tsx', 'utf-8');

// Replace handlePlayTTS button
content = content.replace(/<button\s+onClick=\{\(\) => handlePlayTTS\(msg\)\}[\s\S]*?<\/button>/g, `<ReadAloudButton 
                        text={msg.text} 
                        iconSizeClasses="w-3.5 h-3.5" 
                        className="bg-black/20 hover:bg-black/40" 
                      />`);

// Replace handleListenChapter button
content = content.replace(/<button\s+onClick=\{handleListenChapter\}[\s\S]*?<\/button>/g, `<ReadAloudButton 
            text={typeof chapter.content === 'string' ? chapter.content : (chapter.summary || '')} 
            className="flex items-center shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors bg-black/40 text-white/80 border-white/5 hover:bg-white/5 hover:text-white"
            iconSizeClasses="w-4 h-4"
          />`);

// Remove audio tag
content = content.replace(/<audio\s+ref=\{ttsAudioRef\}[\s\S]*?\/>/g, '');

fs.writeFileSync('src/components/ChatArea.tsx', content);
