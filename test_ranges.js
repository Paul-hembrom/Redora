function getRanges() {
    // simulated text matching
    const fullText = "A quick brown fox.";
    const words = ["A", "quick", "brown", "fox."];
    
    let currentIndex = 0;
    const globalRanges = [];
    for(const word of words) {
        const idx = fullText.indexOf(word, currentIndex);
        if (idx !== -1) {
            globalRanges.push({ start: idx, end: idx + word.length });
            currentIndex = idx + word.length;
        }
    }
    console.log(globalRanges);
}
getRanges();
