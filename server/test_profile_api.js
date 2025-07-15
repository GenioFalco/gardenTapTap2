const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/player/profile',
  method: 'GET',
  headers: {
    'x-user-id': 'test_user'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('Profile API Response:');
      console.log(JSON.stringify(response, null, 2));
    } catch (error) {
      console.error('Error parsing response:', error);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.end(); 