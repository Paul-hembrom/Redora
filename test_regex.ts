const text = "This is a sentence. - First item\n- Second item\n5 - 3 = 2.";
let bulletCounter = 1;
const result = text.replace(/(^|\n|[.!?]\s+)([-*•])\s+/g, (match, prefix) => {
    return `${prefix}Point ${bulletCounter++}: `;
});
console.log(result);

const text2 = "- First item. - Second item.";
bulletCounter = 1;
const result2 = text2.replace(/(^|\n|[.!?]\s+)([-*•])\s+/g, (match, prefix) => {
    return `${prefix}Point ${bulletCounter++}: `;
});
console.log(result2);

const text3 = "1. First item\n2. Second item";
const result3 = text3.replace(/(^|\n|[.!?]\s+)(\d+\.)\s+/g, (match, prefix, num) => {
    return `${prefix}${num} `;
});
console.log(result3);
