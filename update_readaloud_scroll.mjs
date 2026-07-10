import fs from 'fs';

let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf-8');

// 1. Add containerRef to Props
content = content.replace(
  /interface Props \{[\s\S]*?\}/,
  `interface Props {
  text: string;
  className?: string;
  iconSizeClasses?: string;
  containerRef?: React.RefObject<HTMLElement> | null;
}`
);

// 2. Add containerRef to the function arguments
content = content.replace(
  /export function SmartReadAloudButton\(\{ text, className, iconSizeClasses = "w-4 h-4" \}: Props\) \{/,
  `export function SmartReadAloudButton({ text, className, iconSizeClasses = "w-4 h-4", containerRef }: Props) {`
);

// 3. Add getSentenceElement helper outside the component
const getSentenceElementHelper = `
const getSentenceElement = (container: HTMLElement, sentence: string): HTMLElement | null => {
  const cleanSentence = sentence.replace(/\\s+/g, ' ').trim();
  if (!cleanSentence) return null;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let fullText = "";
  const nodes: { node: Node, start: number, end: number }[] = [];
  
  let node;
  while ((node = walker.nextNode())) {
    const text = node.nodeValue || "";
    nodes.push({ node, start: fullText.length, end: fullText.length + text.length });
    fullText += text;
  }
  
  let matchIndex = fullText.replace(/\\s+/g, ' ').indexOf(cleanSentence);
  if (matchIndex === -1) {
    const shortSearch = cleanSentence.substring(0, 15);
    matchIndex = fullText.replace(/\\s+/g, ' ').indexOf(shortSearch);
  }
  
  if (matchIndex !== -1) {
    let realIndex = 0;
    let cleanIndex = 0;
    for (let i = 0; i < fullText.length; i++) {
      if (cleanIndex === matchIndex) {
        realIndex = i;
        break;
      }
      const isSpace = /\\s/.test(fullText[i]);
      if (isSpace) {
         if (i === 0 || !/\\s/.test(fullText[i-1])) {
            cleanIndex++;
         }
      } else {
         cleanIndex++;
      }
    }
    
    for (const n of nodes) {
      if (realIndex >= n.start && realIndex < n.end) {
        return n.node.parentElement;
      }
    }
  }

  return null;
};

const splitIntoSentences = (text: string) => {
  const regex = /([^.!?]+[.!?]+)\\s*/g;
  let sentences = [];
  let match;
  let lastIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match[1].trim()) {
      sentences.push(match[1].trim());
    }
    lastIndex = regex.lastIndex;
  }
  const remaining = text.substring(lastIndex).trim();
  if (remaining) {
    sentences.push(remaining);
  }
  return sentences;
};
`;

content = content.replace(
  /export function SmartReadAloudButton/,
  getSentenceElementHelper + '\nexport function SmartReadAloudButton'
);

// 4. Update playQueue signature and tryElevenLabsTTS call
const oldPlayQueue = /const playQueue = async \(chunks\) => \{[\s\S]*?playQueue\(data\.chunks\);\n/;
const newPlayQueue = `
  const playQueue = async (chunks: any[], sentences: string[]) => {
    if (stopIntentRef.current || chunks.length === 0) {
      setIsPlaying(false);
      return;
    }
    const currentChunk = chunks.shift();
    const currentSentence = sentences.shift();
    
    // Auto-scroll
    try {
        let container = containerRef?.current;
        if (!container && buttonRef.current) {
           container = buttonRef.current.closest('.prose, .content, .reader, .markdown-body') as HTMLElement;
        }
        if (container && currentSentence) {
            const targetEl = getSentenceElement(container, currentSentence);
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    } catch(e) { console.error("Scroll error", e); }

    const audio = new Audio(currentChunk.audioUrl);
    audioRef.current = audio;
    
    let nextAudio = null;
    if (chunks.length > 0) {
      nextAudio = new Audio(chunks[0].audioUrl);
      nextAudio.preload = 'auto';
    }

    audio.onended = () => {
      if (!stopIntentRef.current) {
        playQueue(chunks, sentences);
      }
    };
    audio.onerror = () => {
      setIsPlaying(false);
      logError('ElevenLabs chunk audio element threw a playback error.');
      speakWithBrowser();
    };

    try {
      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      setIsPlaying(false);
      logError('ElevenLabs chunk playback failed:', err);
    }
  };

  const tryElevenLabsTTS = async () => {
    logInfo('Triggered: Attempting ElevenLabs TTS API call...');
    try {
      setIsLoading(true);
      setErrorMsg('');
      const res = await fetch('/api/tts/elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!res.ok) {
        throw new Error(\`API returned \${res.status}\`);
      }
      const data = await res.json();
      if (!data.chunks || data.chunks.length === 0) throw new Error('No audio chunks returned');
      
      setIsLoading(false);
      stopIntentRef.current = false;
      playQueue(data.chunks, splitIntoSentences(text));
`;

content = content.replace(oldPlayQueue, newPlayQueue);

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log('done');
