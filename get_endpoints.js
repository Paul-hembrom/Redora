const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf-8');

const imageIdx = content.indexOf("app.post('/api/topics/:id/images'");
const videoIdx = content.indexOf("app.post('/api/retrieve-videos'");

console.log("Images endpoint starts at: " + imageIdx);
console.log("Videos endpoint starts at: " + videoIdx);

if (imageIdx !== -1) {
  const nextAppPost = content.indexOf("app.post(", imageIdx + 10);
  console.log("Images endpoint code:\n" + content.substring(imageIdx, nextAppPost));
}

if (videoIdx !== -1) {
  const nextAppPost = content.indexOf("app.post(", videoIdx + 10);
  console.log("Videos endpoint code:\n" + content.substring(videoIdx, nextAppPost));
}
