const http = require('http');

http.get('http://localhost:3001/api/listings', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);
        console.log('--- Listings API Response (First Item) ---');
        const first = json.listings[0];
        console.log('ID Type:', typeof first.id);
        console.log('ID Value:', first.id);
        console.log('UserID Type:', typeof first.userId);
    });
}).on('error', (err) => {
    console.error('Error: ' + err.message);
});
