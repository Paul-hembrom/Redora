import fs from 'fs';

let content = fs.readFileSync('src/components/InteractiveLesson.tsx', 'utf-8');

content = content.replace(
  /\} catch \(err\) \{ catch \(err\) \{/g,
  `} catch (err) {`
);

fs.writeFileSync('src/components/InteractiveLesson.tsx', content);
console.log('done');
