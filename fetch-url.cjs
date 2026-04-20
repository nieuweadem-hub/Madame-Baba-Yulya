const https = require('https');

https.get('https://ibb.co/RTV5vb1S', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    const match = data.match(/<meta property="og:image" content="(.*?)"/);
    if (match) {
      console.log('Direct URL:', match[1]);
    } else {
      console.log('No direct URL found');
    }
  });
}).on('error', (err) => {
  console.log('Error: ' + err.message);
});
