const fullText = 'The set A has subsets in set B.';
const searchWords = ['set', 'A', 'has', 'subsets', 'in', 'set', 'B'];
let searchIndex = 0;
for (const word of searchWords) {
    let regexPattern = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (/^\w/.test(word)) regexPattern = '\\b' + regexPattern;
    if (/\w$/.test(word)) regexPattern = regexPattern + '\\b';
    const regex = new RegExp(regexPattern, 'gi');
    regex.lastIndex = searchIndex;
    let match = regex.exec(fullText);
    let matchIdx = match ? match.index : -1;
    if (matchIdx === -1) {
        matchIdx = fullText.toLowerCase().indexOf(word.toLowerCase(), searchIndex);
    }
    console.log(word, matchIdx);
    if (matchIdx !== -1) {
        searchIndex = matchIdx + word.length;
    }
}
