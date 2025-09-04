const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// 캐시 방지 미들웨어
app.use((req, res, next) => {
    // HTML과 JSON 파일에 대해서만 캐시 방지
    if (req.path.endsWith('.html') || req.path.endsWith('.json')) {
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Last-Modified': new Date().toUTCString()
        });
    }
    next();
});

// CORS 헤더 설정
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    next();
});

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, 'docs'), {
    etag: false,
    lastModified: false,
    setHeaders: (res, filePath) => {
        // JSON 파일에 대해 추가 캐시 방지
        if (filePath.endsWith('.json')) {
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

// 404 처리
app.use((req, res) => {
    res.status(404).send('Page not found');
});

app.listen(PORT, () => {
    console.log(`✨ RegRader Law Watch Server is running on port ${PORT}`);
    console.log(`📁 Serving directory: ${path.join(__dirname, 'docs')}`);
    console.log(`🚫 Cache disabled for .html and .json files`);
    console.log(`🌐 Access at: http://localhost:${PORT}`);
});