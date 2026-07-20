const text = `Some text here.

### Related Videos
- Video 1
- Video 2

### Practice Questions
**Q1: What is this?**
`;

function stripVideoSection(text) {
  return text.replace(/### Related Videos[\s\S]*?(?=### |$)/, '').trim();
}

console.log("Result:");
console.log(stripVideoSection(text));
