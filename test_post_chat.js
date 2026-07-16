import http from 'http';

const postData = JSON.stringify({
  id: "test-id-1234",
  chapterId: "topic_curr_Grade_5_Science",
  role: "user",
  text: "Hello!"
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/chats',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(res.statusCode, data));
});

req.on('error', (e) => console.error(e));
req.write(postData);
req.end();
