import fs from 'fs';

let content = fs.readFileSync('src/components/DocumentReader.tsx', 'utf-8');

const sentenceWrapper = `
const splitIntoSentences = (text: string) => {
  const regex = /([^.!?]+[.!?]+)\s*/g;
  let sentences = [];
  let match;
  let lastIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      sentences.push({ text: text.slice(lastIndex, match.index), isSentence: false });
    }
    sentences.push({ text: match[1], isSentence: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    sentences.push({ text: text.slice(lastIndex), isSentence: false });
  }
  return sentences;
};

const SentenceWrapper = ({ text }: { text: string }) => {
  const parts = splitIntoSentences(text);
  let sentenceIdx = 0;
  return (
    <>
      {parts.map((part, i) => {
        if (part.isSentence) {
          const currentIndex = sentenceIdx++;
          return <span key={i} data-sentence-index={currentIndex} className="transition-colors duration-300">{part.text} </span>;
        }
        return <span key={i}>{part.text}</span>;
      })}
    </>
  );
};
`;

content = content.replace("import { markdownComponents } from './MarkdownComponents';", "import { markdownComponents } from './MarkdownComponents';\n" + sentenceWrapper);

content = content.replace(
  "{chapter.content}",
  "<SentenceWrapper text={chapter.content} />"
);

fs.writeFileSync('src/components/DocumentReader.tsx', content);
