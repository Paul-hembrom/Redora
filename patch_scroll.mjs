import fs from 'fs';

let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const oldScroll = `targetEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });`;
const newScroll = `
                const scrollParent = targetEl.closest('.overflow-y-auto') || targetEl.closest('.overflow-auto') || document.documentElement;
                if (scrollParent && scrollParent !== document.documentElement) {
                    const targetRect = targetEl.getBoundingClientRect();
                    const parentRect = scrollParent.getBoundingClientRect();
                    
                    // If target is out of view (above or below) or we just want to ensure it's centered
                    const offset = targetRect.top - parentRect.top + scrollParent.scrollTop - (parentRect.height / 2) + (targetRect.height / 2);
                    scrollParent.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
                } else {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                }
`;

code = code.replace(oldScroll, newScroll);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
