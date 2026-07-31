const word = "elements,";
let regexPattern = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
if (/^\w/.test(word)) regexPattern = '\\b' + regexPattern;
if (/\w$/.test(word)) regexPattern = regexPattern + '\\b';
console.log(regexPattern);
const regex = new RegExp(regexPattern, 'gi');
console.log(regex.test('elements, '));
