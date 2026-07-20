const block = "This is a sentence.\nThat is another.";
const sentences = block.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);
console.log(sentences);
