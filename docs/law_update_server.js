const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');

const PORT = 3001;
const INDEX_JSON_PATH = path.join(__dirname, 'index.json');

// CORS 헤더 설정
function setCORSHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

// index.json 읽기
async function readIndexJson() {
    try {
        const data = await fs.readFile(INDEX_JSON_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Failed to read index.json:', error);
        return null;
    }
}

// index.json 쓰기
async function writeIndexJson(data) {
    try {
        // 백업 생성
        const backupPath = path.join(__dirname, `index_backup_${Date.now()}.json`);
        const currentData = await fs.readFile(INDEX_JSON_PATH, 'utf8');
        await fs.writeFile(backupPath, currentData);
        console.log('Backup created:', backupPath);
        
        // 새 데이터 저장
        await fs.writeFile(INDEX_JSON_PATH, JSON.stringify(data, null, 2), 'utf8');
        console.log('index.json updated successfully');
        return true;
    } catch (error) {
        console.error('Failed to write index.json:', error);
        return false;
    }
}

// HTTP 서버 생성
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    // CORS preflight 요청 처리
    if (req.method === 'OPTIONS') {
        setCORSHeaders(res);
        res.writeHead(200);
        res.end();
        return;
    }
    
    // GET /api/laws - 현재 법규 목록 가져오기
    if (pathname === '/api/laws' && req.method === 'GET') {
        setCORSHeaders(res);
        const data = await readIndexJson();
        if (data) {
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, data }));
        } else {
            res.writeHead(500);
            res.end(JSON.stringify({ success: false, error: 'Failed to read data' }));
        }
        return;
    }
    
    // POST /api/laws - 법규 목록 업데이트
    if (pathname === '/api/laws' && req.method === 'POST') {
        setCORSHeaders(res);
        
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                
                // 데이터 검증
                if (!data.items || !Array.isArray(data.items)) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ success: false, error: 'Invalid data format' }));
                    return;
                }
                
                // 메타데이터 업데이트
                data.generatedAt = Math.floor(Date.now() / 1000);
                data.year = data.year || 2025;
                data.description = data.description || "2025년 당사 적용 법규 목록 (수정됨)";
                data.total_laws = data.items.length;
                
                // 파일 저장
                const success = await writeIndexJson(data);
                
                if (success) {
                    res.writeHead(200);
                    res.end(JSON.stringify({ 
                        success: true, 
                        message: `Successfully updated ${data.items.length} laws`,
                        total: data.items.length
                    }));
                } else {
                    res.writeHead(500);
                    res.end(JSON.stringify({ success: false, error: 'Failed to save data' }));
                }
            } catch (error) {
                console.error('Error processing request:', error);
                res.writeHead(400);
                res.end(JSON.stringify({ success: false, error: 'Invalid JSON data' }));
            }
        });
        return;
    }
    
    // 404 - Not Found
    setCORSHeaders(res);
    res.writeHead(404);
    res.end(JSON.stringify({ success: false, error: 'Not found' }));
});

// 서버 시작
server.listen(PORT, () => {
    console.log(`Law Update Server running on http://localhost:${PORT}`);
    console.log(`Monitoring file: ${INDEX_JSON_PATH}`);
    console.log('\nAPI Endpoints:');
    console.log('  GET  /api/laws - Get current laws');
    console.log('  POST /api/laws - Update laws (expects JSON with items array)');
});