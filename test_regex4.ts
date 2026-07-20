function processLists(text: string) {
    let bulletCounter = 1;
    let t = text.replace(/([.!?])\s*\n\s*([-*•])\s+/g, (match, punct) => {
        return `${punct} Point ${bulletCounter++}: `;
    });
    t = t.replace(/(^|[^.!?])\s*\n\s*([-*•])\s+/g, (match, prevChar) => {
        return `${prevChar}. Point ${bulletCounter++}: `;
    });
    t = t.replace(/^\s*([-*•])\s+/g, () => {
        return `Point ${bulletCounter++}: `;
    });
    
    t = t.replace(/([.!?])\s*\n\s*(\d+)\.\s+/g, (match, punct, num) => {
        return `${punct} ${num}. `;
    });
    t = t.replace(/(^|[^.!?])\s*\n\s*(\d+)\.\s+/g, (match, prevChar, num) => {
        return `${prevChar}. ${num}. `;
    });
    t = t.replace(/^\s*(\d+)\.\s+/g, (match, num) => {
        return `${num}. `;
    });
    return t;
}

console.log(processLists("This is a sentence.\n- First item\n- Second item\n5 - 3 = 2."));
console.log(processLists("- First\n- Second"));
console.log(processLists("1. First\n2. Second"));
console.log(processLists("Hello\n1. First\n2. Second"));
console.log(processLists("First item.\n- Second item."));
