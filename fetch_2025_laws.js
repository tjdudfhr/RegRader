// 국가법령정보센터 API를 통해 2025년 시행 법규 가져오기
const https = require('https');
const fs = require('fs');

// API 설정
const API_KEY = 'fPZJvJ1TyfPJ8SYLvmxNxqZEAyCqakmwXCbMl%2BpuBM9KEtJ9TQKlOp1P%2Fd8f9M5CSO9YU4e9gTrkkP2%2F6mOb8Q%3D%3D';
const BASE_URL = 'https://www.law.go.kr';

// 2025년 시행 법규 검색
async function fetch2025Laws() {
    const results = [];
    const year = 2025;
    
    // 월별로 검색 (1월~12월)
    for (let month = 1; month <= 12; month++) {
        const startDate = `${year}${String(month).padStart(2, '0')}01`;
        const endDate = month === 12 ? `${year}1231` : `${year}${String(month).padStart(2, '0')}31`;
        
        console.log(`Fetching laws for ${year}-${String(month).padStart(2, '0')}...`);
        
        // 제정·개정 법령 목록 조회 API
        const url = `${BASE_URL}/DRF/lawSearch.do?OC=${API_KEY}&type=JSON&target=eflaw&proCls=01&ancYd=${startDate}~${endDate}`;
        
        try {
            const data = await fetchFromAPI(url);
            if (data && data.eflaw) {
                results.push(...data.eflaw);
                console.log(`  Found ${data.eflaw.length} laws for month ${month}`);
            }
        } catch (error) {
            console.error(`Error fetching month ${month}:`, error.message);
        }
        
        // API 호출 제한 방지를 위한 대기
        await sleep(1000);
    }
    
    // 중복 제거 및 정리
    const uniqueLaws = removeDuplicates(results);
    console.log(`\nTotal unique laws found: ${uniqueLaws.length}`);
    
    // 결과 저장
    const outputData = {
        generatedAt: new Date().toISOString(),
        year: 2025,
        description: "2025년 시행 법령 목록 (국가법령정보센터)",
        total_laws: uniqueLaws.length,
        laws: uniqueLaws.map(law => ({
            id: law.법령ID || law.lawId,
            title: law.법령명 || law.lawName,
            lawType: law.법령구분 || law.lawType || '법률',
            effectiveDate: formatDate(law.시행일자 || law.enfDate),
            promulgationDate: formatDate(law.공포일자 || law.promDate),
            promulgationNo: law.공포번호 || law.promNo,
            ministry: law.소관부처 || law.department || '관계부처',
            status: '현행',
            url: law.링크 || law.link || ''
        }))
    };
    
    // 파일로 저장
    fs.writeFileSync('docs/laws_2025_from_api.json', JSON.stringify(outputData, null, 2), 'utf-8');
    console.log('Results saved to docs/laws_2025_from_api.json');
    
    return outputData;
}

// API 호출 함수
function fetchFromAPI(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (error) {
                    console.error('Failed to parse JSON:', error);
                    resolve(null);
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

// 중복 제거
function removeDuplicates(laws) {
    const seen = new Map();
    laws.forEach(law => {
        const key = `${law.법령명 || law.lawName}_${law.시행일자 || law.enfDate}`;
        if (!seen.has(key)) {
            seen.set(key, law);
        }
    });
    return Array.from(seen.values());
}

// 날짜 포맷팅
function formatDate(dateStr) {
    if (!dateStr) return '2025-01-01';
    
    // YYYYMMDD -> YYYY-MM-DD
    if (dateStr.length === 8) {
        return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    }
    return dateStr;
}

// 대기 함수
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 실행
fetch2025Laws().then(() => {
    console.log('Completed fetching 2025 laws from API');
}).catch(error => {
    console.error('Error:', error);
});
