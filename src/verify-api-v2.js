const http = require('http');

http.get('http://localhost:3001/api/categories', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);
        console.log('--- Categories API Response (First Item) ---');
        const first = json.categories[0];
        console.log('ID Type:', typeof first.id);
        console.log('ID Value:', first.id);
        console.log('ImageUrl:', first.imageUrl);
    });
}).on('error', (err) => {
    console.error('Error: ' + err.message);
});
