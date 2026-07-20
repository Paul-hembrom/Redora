const text = "This is a sentence.\n- First item\n- Second item\n5 - 3 = 2.";
let bulletCounter = 1;
// We match the beginning of a line or sentence boundary
const result = text.replace(/(^|\n|[.!?]\s+)([-*•])\s+/g, (match, prefix) => {
    // If the prefix is a newline, we can turn it into a period and a space, EXCEPT if the previous character was already a punctuation.
    // But prefix is exactly `\n` or `.\s+` etc.
    let newPrefix = prefix;
    if (prefix === '\n') {
        newPrefix = '. ';
    }
    return `${newPrefix}Point ${bulletCounter++}: `;
});
console.log("Bullet:", result);

const text3 = "1. First item\n2. Second item";
const result3 = text3.replace(/(^|\n|[.!?]\s+)(\d+)\.\s+/g, (match, prefix, num) => {
    let newPrefix = prefix;
    if (prefix === '\n') {
        newPrefix = '. '; // Adds a spoken pause (period) at the end of the previous line!
    }
    // keep the number but add a spoken pause, e.g. "1. " -> "1. " (or maybe "1, ")
    // We add the pause by ensuring the previous line ended with a period, 
    // and maybe adding a comma after the number? "1., "
    return `${newPrefix}${num}. `;
});
console.log("Numbered:", result3);
