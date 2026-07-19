const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// State update
code = code.replace(
  "const [playbackRate, setPlaybackRate] = useState<number>(1);",
  "const [playbackRate, setPlaybackRate] = useState<number>(0.8);"
);

// Dropdown options
const oldOptions = `<option value={1}>1x</option>
               <option value={1.25}>1.25x</option>
               <option value={1.5}>1.5x</option>`;

const newOptions = `<option value={0.5}>0.5x</option>
               <option value={0.8}>0.8x</option>
               <option value={1}>1.0x</option>
               <option value={1.5}>1.5x</option>`;

code = code.replace(oldOptions, newOptions);

// Pass playbackRate to the ReadAloudButtons in ChatArea
code = code.replace(
  /idPrefix=\{chapter.content \? "tts-chapter-" : "tts-summary-"\}/g,
  "idPrefix={chapter.content ? \"tts-chapter-\" : \"tts-summary-\"}\n            playbackRate={playbackRate}"
);

code = code.replace(
  /className="bg-black\/20 hover:bg-black\/40"/g,
  "className=\"bg-black/20 hover:bg-black/40\"\n                        playbackRate={playbackRate}"
);

fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log('patched ChatArea.tsx');
