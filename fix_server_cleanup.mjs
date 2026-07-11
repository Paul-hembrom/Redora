import fs from 'fs';

let lines = fs.readFileSync('server.ts', 'utf-8').split('\\n');

let startIdx = lines.findIndex(l => l.includes('const chap = chaptersMap.get(row.title);'));
let endIdx = lines.findIndex(l => l.includes('if (row.questions && Array.isArray(row.questions) && row.questions.length > 0) {'));

const newLines = `       const chap = chaptersMap.get(row.title);
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
       
`;

lines.splice(startIdx, endIdx - startIdx, newLines);

fs.writeFileSync('server.ts', lines.join('\\n'));
console.log('done');
