const axios = require('axios');

// 여러 API 테스트
async function testAPIs() {
    const tests = [
        {
            name: 'Test 1: eflaw with OC=knowhow1',
            url: 'https://www.law.go.kr/DRF/lawSearch.do',
            params: {
                OC: 'knowhow1',
                target: 'eflaw',
                type: 'XML'
            }
        },
        {
            name: 'Test 2: eflaw with efYd range',
            url: 'https://www.law.go.kr/DRF/lawSearch.do',
            params: {
                OC: 'knowhow1',
                target: 'eflaw',
                type: 'XML',
                efYd: '20250101~20251231'
            }
        },
        {
            name: 'Test 3: law target test',
            url: 'https://www.law.go.kr/DRF/lawSearch.do',
            params: {
                OC: 'knowhow1',
                target: 'law',
                type: 'XML',
                efYd: '20250101~20251231'
            }
        },
        {
            name: 'Test 4: different OC value test',
            url: 'https://www.law.go.kr/DRF/lawSearch.do',
            params: {
                OC: 'test',
                target: 'eflaw',
                type: 'XML',
                efYd: '20250101~20251231'
            }
        },
        {
            name: 'Test 5: with display parameter',
            url: 'https://www.law.go.kr/DRF/lawSearch.do',
            params: {
                OC: 'knowhow1',
                target: 'eflaw',
                type: 'XML',
                efYd: '20250101',
                efYdEnd: '20251231',
                display: '10',
                page: '1'
            }
        }
    ];
    
    for (const test of tests) {
        console.log('\n' + '='.repeat(50));
        console.log(test.name);
        console.log('URL:', test.url);
        console.log('Params:', test.params);
        console.log('-'.repeat(50));
        
        try {
            const response = await axios.get(test.url, {
                params: test.params,
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/xml, application/json, text/xml, */*'
                }
            });
            
            console.log('✅ Status:', response.status);
            console.log('Headers:', response.headers['content-type']);
            
            // 응답 내용 일부 출력
            const data = response.data;
            if (typeof data === 'string') {
                console.log('Response (first 500 chars):');
                console.log(data.substring(0, 500));
                
                // XML에서 특정 태그 찾기
                if (data.includes('<totalCnt>')) {
                    const match = data.match(/<totalCnt>(\d+)<\/totalCnt>/);
                    if (match) {
                        console.log('🎯 Total Count:', match[1]);
                    }
                }
                if (data.includes('법령명한글')) {
                    console.log('✨ 법령 데이터 발견!');
                }
            } else {
                console.log('Response type:', typeof data);
                console.log('Response:', JSON.stringify(data).substring(0, 500));
            }
            
        } catch (error) {
            console.log('❌ Error:', error.message);
            if (error.response) {
                console.log('Status:', error.response.status);
                console.log('Data:', error.response.data?.substring?.(0, 200));
            }
        }
    }
}

// 실행
testAPIs().then(() => {
    console.log('\n✅ All tests completed');
}).catch(err => {
    console.error('Fatal error:', err);
});