const block = "1. First item\n2. Second item";
console.log(block.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g));
