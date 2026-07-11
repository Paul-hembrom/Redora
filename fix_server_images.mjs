import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

// I'll just rewrite the whole loop body to be safe
content = content.replace(
  /const chap = chaptersMap\.get\(row\.title\);[\s\S]*?const subtopicId =/g,
  `const chap = chaptersMap.get(row.title);
       let fullContent = row.content || '';
       
       let rowImages = row.images;
       if (typeof rowImages === 'string') {
         try { rowImages = JSON.parse(rowImages); } catch(e) {}
       }
       if (!Array.isArray(rowImages)) rowImages = [];
       
       if (rowImages.length > 0) {
          fullContent += '\\n\\n### Related Images\\n\\n';
          rowImages.forEach((img: any) => {
             fullContent += \`![$\{img.alt\}]($\{img.url\})\\n\\n\`;
          });
       }
       
       let rowVideos = row.videos;
       if (typeof rowVideos === 'string') {
         try { rowVideos = JSON.parse(rowVideos); } catch(e) {}
       }
       if (!Array.isArray(rowVideos)) rowVideos = [];
       
       if (rowVideos.length > 0) {
          fullContent += '\\n\\n### Related Videos\\n';
          rowVideos.forEach((vid: any) => {
             fullContent += \`- [$\{vid.title\}](https://www.youtube.com/watch?v=$\{vid.video_id\}) (Channel: $\{vid.channel\})\\n\`;
          });
       }
       
       const subtopicId =`
);

fs.writeFileSync('server.ts', content);
console.log('done');
