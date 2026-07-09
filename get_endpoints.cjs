const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf-8');

const imageIdx = content.indexOf("app.post('/api/topics/:id/images'");
const videoIdx = content.indexOf("app.post('/api/retrieve-videos'");

if (imageIdx !== -1) {
  const nextAppPost = content.indexOf("app.post(", imageIdx + 10);
  console.log("Images endpoint code:\n" + content.substring(imageIdx, nextAppPost > -1 ? nextAppPost : imageIdx + 5000));
}

if (videoIdx !== -1) {
  const nextAppPost = content.indexOf("app.post(", videoIdx + 10);
  console.log("Videos endpoint code:\n" + content.substring(videoIdx, nextAppPost > -1 ? nextAppPost : videoIdx + 5000));
}
