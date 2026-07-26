const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const propsRegex = /interface Props \{\n\s*chapter: Chapter;/;
code = code.replace(propsRegex, `interface Props {\n  isFocusMode?: boolean;\n  chapter: Chapter;`);

const componentRegex = /export function ChatArea\(\{ chapter, documentId, onClearChats, persona, onNavigateChapter, hasPrevChapter, hasNextChapter, isStudent \}: Props\) \{/;
code = code.replace(componentRegex, `export function ChatArea({ isFocusMode, chapter, documentId, onClearChats, persona, onNavigateChapter, hasPrevChapter, hasNextChapter, isStudent }: Props) {`);

// Hide the bottom action bar when in focus mode
const actionBtnsRegex = /\{!\(isStudent && isSummary\) && \(\n\s*<>\n\s*<button onClick=\{handleGenerateFlashcards\}/;
code = code.replace(actionBtnsRegex, `{!isFocusMode && !(isStudent && isSummary) && (
              <>
                <button onClick={handleGenerateFlashcards}`);

const offlineRegex = /<button \n\s*onClick=\{async \(\) => \{\n\s*const lib = await import\('\.\.\/lib\/offline'\);/;
code = code.replace(offlineRegex, `{!isFocusMode && (
            <button 
              onClick={async () => {
                const lib = await import('../lib/offline');`);

const saveOfflineEndRegex = /<\/button>\n\s*<\/ScrollableActionBar>\n\s*<\/div>\n\s*<\/div>/;
code = code.replace(saveOfflineEndRegex, `</button>
            )}
          </ScrollableActionBar>
        </div>
      </div>`);

fs.writeFileSync('src/components/ChatArea.tsx', code);
