import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

const targetStr = "app.post('/api/curriculum/generate'";
const idx = content.indexOf(targetStr);

const curriculumRoutes = `
app.get('/api/curriculum', async (req: any, res) => {
  try {
    const { grade, subject } = req.query;
    if (!grade || !subject) {
      return res.status(400).json({ error: 'grade and subject are required' });
    }
    const rows = await sql\`SELECT * FROM curriculum_library WHERE grade = \${grade} AND subject = \${subject} ORDER BY title, subtopic\`;
    
    if (rows.length === 0) {
      return res.json(null);
    }
    
    // Group by title
    const docId = \`curr_\${grade}_\${subject}\`.replace(/\\s+/g, '_');
    const doc = {
       id: docId,
       name: \`\${grade} - \${subject} Curriculum\`,
       uploadDate: new Date().toISOString(),
       chapters: [] as any[],
       isPublic: true
    };
    
    let chapterNumber = 1;
    let topicNumber = 1;
    const chaptersMap = new Map<string, any>();
    
    for (const row of rows) {
       if (!chaptersMap.has(row.title)) {
          chaptersMap.set(row.title, {
             id: \`chap_\${chapterNumber}\`,
             chapterNumber,
             title: row.title,
             summary: '',
             content: '',
             type: 'chapter',
             sortOrder: chapterNumber * 100,
             children: []
          });
          chapterNumber++;
          topicNumber = 1;
       }
       
       const chap = chaptersMap.get(row.title);
       
       let fullContent = row.content || '';
       
       if (row.images && Array.isArray(row.images) && row.images.length > 0) {
          fullContent += '\\n\\n### Related Images\\n<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">';
          row.images.forEach((img: any) => {
             fullContent += \`<img src="\${img.url}" alt="\${img.alt}" class="w-full rounded-lg shadow-sm" />\`;
          });
          fullContent += '</div>\\n';
       }
       
       if (row.videos && Array.isArray(row.videos) && row.videos.length > 0) {
          fullContent += '\\n\\n### Related Videos\\n';
          row.videos.forEach((vid: any) => {
             fullContent += \`- [\${vid.title}](https://www.youtube.com/watch?v=\${vid.video_id}) (Channel: \${vid.channel})\\n\`;
          });
       }
       
       if (row.questions && Array.isArray(row.questions) && row.questions.length > 0) {
          fullContent += '\\n\\n### Practice Questions\\n';
          row.questions.forEach((q: any, i: number) => {
             fullContent += \`**Q\${i+1}: \${q.question}**\\n\`;
             q.options.forEach((opt: string) => {
                fullContent += \`- \${opt}\\n\`;
             });
             fullContent += \`*Answer: \${q.answer}*\\n\\n\`;
          });
       }
       
       const topic = {
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
    doc.chapters.sort((a, b) => a.sortOrder - b.sortOrder);
    
    res.json(doc);
  } catch(err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

`;

content = content.substring(0, idx) + curriculumRoutes + content.substring(idx);
fs.writeFileSync('server.ts', content);
console.log("Fixed server.ts routes");
