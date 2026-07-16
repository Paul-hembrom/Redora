import http from 'http';

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/curriculum?grade=Grade%205(Basic%20Level)&subject=Science',
  method: 'GET'
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(res.statusCode, data));
});

req.on('error', (e) => console.error(e));
req.end();
