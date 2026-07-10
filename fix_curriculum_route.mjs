import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

const targetStr = `       const topic = {
          id: \`topic_\${chap.id}_\${topicNumber}\`,
          chapterNumber: topicNumber,
          title: row.subtopic,
          summary: '',
          content: fullContent,
          type: 'topic',
          parentId: chap.id,
          sortOrder: chap.sortOrder + topicNumber
       };
       doc.chapters.push(topic);
       topicNumber++;
    }
      
    doc.chapters.push(...Array.from(chaptersMap.values()));
      
    // Sort all by sortOrder
    doc.chapters.sort((a, b) => a.sortOrder - b.sortOrder);`;

const replacementStr = `       const topic = {
          id: \`topic_\${chap.id}_\${topicNumber}\`,
          chapterNumber: topicNumber,
          title: row.subtopic,
          summary: '',
          content: fullContent,
          type: 'topic',
          parentId: chap.id,
          sortOrder: chap.sortOrder + topicNumber,
          children: []
       };
       chap.children.push(topic);
       topicNumber++;
    }
      
    doc.chapters.push(...Array.from(chaptersMap.values()));
      
    // Sort all by sortOrder
    doc.chapters.sort((a, b) => a.sortOrder - b.sortOrder);
    doc.chapters.forEach(chap => {
       if (chap.children) {
          chap.children.sort((a, b) => a.sortOrder - b.sortOrder);
       }
    });`;

content = content.replace(targetStr, replacementStr);
fs.writeFileSync('server.ts', content);
console.log("Successfully fixed curriculum GET route.");
