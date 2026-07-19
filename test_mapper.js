const { JSDOM } = require('jsdom');
const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="test">Hello <b>world</b>, this is a test.</div></body></html>`);
const document = dom.window.document;
const NodeFilter = dom.window.NodeFilter;

function getWordRanges(element, timestamps) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
        textNodes.push(node);
    }

    let fullText = "";
    const indexMap = []; 
    for (const tNode of textNodes) {
        const text = tNode.nodeValue;
        for (let i = 0; i < text.length; i++) {
            indexMap.push({ node: tNode, offset: i });
        }
        fullText += text;
    }

    const ranges = [];
    let searchIndex = 0;
    for (const ts of timestamps) {
        const word = ts.word.trim();
        if (!word) {
            ranges.push(null);
            continue;
        }
        
        let matchIdx = fullText.indexOf(word, searchIndex);
        if (matchIdx === -1) {
            const lowerFull = fullText.toLowerCase();
            matchIdx = lowerFull.indexOf(word.toLowerCase(), searchIndex);
        }

        if (matchIdx !== -1) {
            const startNodeInfo = indexMap[matchIdx];
            const endNodeInfo = indexMap[matchIdx + word.length - 1]; 
            
            if (startNodeInfo && endNodeInfo) {
                // mock Range
                ranges.push({
                    startNode: startNodeInfo.node.nodeValue,
                    startOffset: startNodeInfo.offset,
                    endNode: endNodeInfo.node.nodeValue,
                    endOffset: endNodeInfo.offset + 1
                });
            } else {
                ranges.push(null);
            }
            searchIndex = matchIdx + word.length;
        } else {
            ranges.push(null);
        }
    }
    return ranges;
}

const el = document.getElementById('test');
const timestamps = [
    { word: "Hello" },
    { word: "world" },
    { word: "this" }
];
console.log(getWordRanges(el, timestamps));
