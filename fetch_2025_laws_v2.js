// 국가법령정보센터 API를 통해 2025년 시행 법규 가져오기 (수정된 버전)
const https = require('https');
const fs = require('fs');
const querystring = require('querystring');

// API 설정  
const API_KEY = 'fPZJvJ1TyfPJ8SYLvmxNxqZEAyCqakmwXCbMl%2BpuBM9KEtJ9TQKlOp1P%2Fd8f9M5CSO9YU4e9gTrkkP2%2F6mOb8Q%3D%3D';

// 디코딩된 API 키
const DECODED_KEY = decodeURIComponent(API_KEY);

// 2025년 시행 법규 검색 - 개정법령 목록 조회
async function fetch2025Laws() {
    const results = [];
    
    console.log('Fetching 2025 laws from 국가법령정보센터 API...\n');
    
    // 시행일자 기준 조회 (2025년 전체)
    const params = {
        OC: DECODED_KEY,
        type: 'JSON',
        target: 'eflaw',  // 시행법령
        EF_YD: '20250101:20251231'  // 시행일자 범위
    };
    
    const url = `https://www.law.go.kr/DRF/lawSearch.do?${querystring.stringify(params)}`;
    
    console.log('Request URL:', url.replace(DECODED_KEY, 'API_KEY'));
    
    try {
        const data = await fetchFromAPI(url);
        console.log('Response received:', data ? 'Data found' : 'No data');
        
        if (data) {
            // 파일로 저장하여 구조 확인
            fs.writeFileSync('docs/api_response_raw.json', JSON.stringify(data, null, 2), 'utf-8');
            console.log('Raw response saved to docs/api_response_raw.json');
            
            // 데이터 구조에 따라 파싱
            if (data.Search && data.Search.eflaw) {
                results.push(...data.Search.eflaw);
            } else if (data.eflaw) {
                results.push(...data.eflaw);
            } else if (Array.isArray(data)) {
                results.push(...data);
            } else if (data.LawSearch && data.LawSearch.law) {
                results.push(...data.LawSearch.law);
            }
        }
    } catch (error) {
        console.error('Error:', error);
        
        // 대체 방법: OpenAPI 사용
        console.log('\nTrying alternative OpenAPI endpoint...');
        await tryAlternativeAPI(results);
    }
    
    console.log(`\nTotal laws found: ${results.length}`);
    
    // 결과 저장
    const outputData = {
        generatedAt: new Date().toISOString(),
        year: 2025,
        description: "2025년 시행 법령 목록",
        total_laws: results.length,
        laws: results
    };
    
    fs.writeFileSync('docs/laws_2025_from_api.json', JSON.stringify(outputData, null, 2), 'utf-8');
    console.log('Results saved to docs/laws_2025_from_api.json');
    
    return outputData;
}

// 대체 API 시도
async function tryAlternativeAPI(results) {
    // 법령 검색 API (개정법령 중심)
    const baseUrl = 'https://www.law.go.kr/LSW/openApi/lawSearch.do';
    
    // 주요 법령 키워드로 검색
    const keywords = ['개인정보', '근로기준', '산업안전', '환경', '조세', '금융', '공정거래'];
    
    for (const keyword of keywords) {
        const params = {
            OC: DECODED_KEY,
            target: 'law',
            type: 'JSON',
            query: keyword,
            display: '100'
        };
        
        const url = `${baseUrl}?${querystring.stringify(params)}`;
        console.log(`Searching for ${keyword} laws...`);
        
        try {
            const data = await fetchFromAPI(url);
            if (data && data.LawSearch && data.LawSearch.law) {
                const laws = data.LawSearch.law.filter(law => {
                    const enfDate = law.시행일자 || law.enfDate || '';
                    return enfDate.startsWith('2025');
                });
                results.push(...laws);
                console.log(`  Found ${laws.length} laws for keyword: ${keyword}`);
            }
        } catch (error) {
            console.error(`  Error for keyword ${keyword}:`, error.message);
        }
        
        await sleep(500); // API 제한 방지
    }
}

// API 호출 함수
function fetchFromAPI(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            }
        }, (res) => {
            let data = '';
            
            console.log('Status Code:', res.statusCode);
            console.log('Headers:', res.headers['content-type']);
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    // HTML 응답 체크
                    if (data.includes('<!DOCTYPE') || data.includes('<html')) {
                        console.error('Received HTML instead of JSON');
                        fs.writeFileSync('docs/api_error.html', data, 'utf-8');
                        console.log('Error HTML saved to docs/api_error.html');
                        resolve(null);
                        return;
                    }
                    
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (error) {
                    console.error('Failed to parse response:', error.message);
                    console.log('Raw data (first 500 chars):', data.substring(0, 500));
                    resolve(null);
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

// 대기 함수
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 실행
fetch2025Laws().then(() => {
    console.log('\nCompleted!');
}).catch(error => {
    console.error('Fatal error:', error);
});
