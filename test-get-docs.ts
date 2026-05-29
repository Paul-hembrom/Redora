import sql from './server/db.js';

async function run() {
  try {
    const docs = await sql`SELECT * FROM documents ORDER BY upload_date DESC LIMIT 5`;
    
    const docIds = docs.map(d => d.id);
    let allChapters: any[] = [];
    if (docIds.length > 0) {
      allChapters = await sql`SELECT * FROM chapters WHERE document_id IN ${sql(docIds)}`;
    }

    const result = docs.map(doc => {
      const flatChapters = allChapters.filter(ch => ch.document_id === doc.id);
      
      const chapterMap = new Map();
      const roots: any[] = [];
      flatChapters.forEach(ch => {
        chapterMap.set(ch.id, {
          id: ch.id,
          chapterNumber: ch.chapter_number,
          title: ch.title,
          summary: ch.summary,
          content: ch.content,
          parentId: ch.parent_id,
          sortOrder: ch.sort_order || 0,
          type: ch.type || 'chapter',
          children: []
        });
      });

      Array.from(chapterMap.values()).forEach(ch => {
        if (ch.parentId && chapterMap.has(ch.parentId)) {
          chapterMap.get(ch.parentId).children.push(ch);
        } else {
          roots.push(ch);
        }
      });
      return { id: doc.id, rootCount: roots.length };
    });
    console.log(result);
  } catch (err) {
    console.error(err);
  }
  process.exit();
}
run();
