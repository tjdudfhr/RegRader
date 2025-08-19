const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 8005;
const docRoot = './docs';

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    let filePath = path.join(docRoot, req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'text/plain';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain');
            res.end('File not found');
        } else {
            res.statusCode = 200;
            res.setHeader('Content-Type', contentType);
            res.end(data);
        }
    });
});

server.listen(port, '0.0.0.0', () => {
    console.log(`Law Watch dashboard server running at http://0.0.0.0:${port}/`);
});