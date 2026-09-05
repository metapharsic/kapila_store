const http = require('http');

const data = JSON.stringify({
  image: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", // 1x1 png base64
  mime_type: "image/png"
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/scan/indent',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  console.log(`STATUS: ${res.statusCode}`);
  let body = '';
  res.on('data', chunk => {
    body += chunk;
  });
  res.on('end', () => {
    console.log('BODY:', body);
  });
});

req.on('error', e => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();
