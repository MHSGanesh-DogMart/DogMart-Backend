const http = require('http');

http.get('http://localhost:3001/api/categories', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('--- Categories API Response ---');
        console.log(data);
    });
}).on('error', (err) => {
    console.error('Error: ' + err.message);
});
