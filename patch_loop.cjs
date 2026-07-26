const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const target = `        const highlightLoop = () => {
            if (currentSessionId !== playSessionIdRef.current || audio.paused || audio.ended) return;`;

const replacement = `        const highlightLoop = () => {
            if (!(window as any)._firstRafLog) {
                console.log('[Frontend] highlightLoop started running!');
                (window as any)._firstRafLog = true;
            }
            if (currentSessionId !== playSessionIdRef.current || audio.paused || audio.ended) return;`;

code = code.replace(target, replacement);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
