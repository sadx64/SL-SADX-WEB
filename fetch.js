import https from 'https';
https.get('https://sl-flix-web.vercel.app/api-metadata/home', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Data len:', data.length, 'status:', res.statusCode));
});
