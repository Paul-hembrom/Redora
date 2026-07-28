const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

if (!code.includes("const mainContainerRef = useRef<HTMLDivElement>(null);")) {
    code = code.replace("const messagesEndRef = useRef<HTMLDivElement>(null);", "const messagesEndRef = useRef<HTMLDivElement>(null);\n  const mainContainerRef = useRef<HTMLDivElement>(null);");
}

code = code.replace(
    /<div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 custom-scrollbar relative z-0">/g,
    '<div ref={mainContainerRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 custom-scrollbar relative z-0">'
);

const alternativeEffect = `  const currentChapterIdRef = useRef(chapter.id);
  useEffect(() => {
    const isLargeFont = isFocusMode && ['2xl', '3xl', '4xl', '5xl', '6xl'].includes((focusFontSize || '3xl').toLowerCase());
    if (isLargeFont && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = 0;
    }
  }, [isFocusMode, focusFontSize]);`;

code = code.replace("chatContainerRef.current", "mainContainerRef.current");
code = code.replace("chatContainerRef.current", "mainContainerRef.current");

fs.writeFileSync('src/components/ChatArea.tsx', code);
