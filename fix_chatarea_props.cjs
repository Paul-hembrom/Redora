const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const target = `export default function ChatArea({ chapter, documentId, onClearChats, persona, onNavigateChapter, hasPrevChapter, hasNextChapter, isStudent }: Props) {`;
const replacement = `export default function ChatArea({ isFocusMode, chapter, documentId, onClearChats, persona, onNavigateChapter, hasPrevChapter, hasNextChapter, isStudent }: Props) {`;

code = code.replace(target, replacement);

fs.writeFileSync('src/components/ChatArea.tsx', code);
