const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

// Replace local chunksMap and audioQueue declarations
content = content.replace(/const chunksMap = new Map<number, any>\(\);\s*const audioQueue: any\[\] = \[\];/, 
`audioQueueRef.current = [];
      chunksMapRef.current.clear();`);

content = content.replace(/chunksMap/g, "chunksMapRef.current");
content = content.replace(/audioQueue/g, "audioQueueRef.current");

// Use animationFrameIdRef in highlightLoop
content = content.replace(/let animationFrameId: number;/, "");
content = content.replace(/animationFrameId = requestAnimationFrame\(highlightLoop\);/g, "animationFrameIdRef.current = requestAnimationFrame(highlightLoop);");
content = content.replace(/cancelAnimationFrame\(animationFrameId\);/g, `if (animationFrameIdRef.current !== null) { cancelAnimationFrame(animationFrameIdRef.current); animationFrameIdRef.current = null; }`);

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Patched tryCartesia successfully");
