const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// 국가법령정보센터 API 설정
const API_BASE_URL = 'https://www.law.go.kr/DRF/lawSearch.do';
const OC_VALUE = 'knowhow1';  // 제공받은 OC 값

// 2025년 시행법령 전체 조회 함수
async function fetchAll2025Laws() {
    const allLaws = [];
    let page = 1;
    let hasMore = true;
    
    console.log('🔍 2025년 시행법령 조회 시작...');
    
    while (hasMore) {
        try {
            const params = {
                OC: OC_VALUE,
                target: 'eflaw',  // 시행법령
                type: 'json',     // JSON 형식
                nw: 'Y',          // 예정+현행+연혁 모두 포함
                efYd: '20250101', // 시행일자 시작
                efYdEnd: '20251231', // 시행일자 끝
                display: '100',   // 한 페이지당 100개
                page: page.toString(),
                sort: 'efasc'     // 시행일 오름차순
            };
            
            console.log(`📄 페이지 ${page} 조회 중...`);
            
            const response = await axios.get(API_BASE_URL, { 
                params,
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            // 응답 데이터 파싱
            if (response.data) {
                let data = response.data;
                
                // XML 응답인 경우 처리
                if (typeof data === 'string' && data.includes('<?xml')) {
                    console.log('XML 응답 감지, JSON으로 변환 시도...');
                    // XML 파싱 로직 추가 필요
                    const parseString = require('xml2js').parseString;
                    await new Promise((resolve, reject) => {
                        parseString(data, (err, result) => {
                            if (err) reject(err);
                            else {
                                data = result;
                                resolve();
                            }
                        });
                    });
                }
                
                // 법령 목록 추출
                let laws = [];
                if (data.law) {
                    laws = Array.isArray(data.law) ? data.law : [data.law];
                } else if (data.Law) {
                    laws = Array.isArray(data.Law) ? data.Law : [data.Law];
                } else if (data.laws) {
                    laws = Array.isArray(data.laws) ? data.laws : [data.laws];
                } else if (data.lawSearch && data.lawSearch.law) {
                    laws = Array.isArray(data.lawSearch.law) ? data.lawSearch.law : [data.lawSearch.law];
                }
                
                if (laws.length > 0) {
                    // 법령 정보 정제
                    const processedLaws = laws.map((law, idx) => ({
                        id: `law_2025_${page}_${idx}`,
                        법령명: law.법령명한글 || law.법령명 || law.lawName || '',
                        법령ID: law.법령ID || law.법령일련번호 || law.lawId || '',
                        시행일자: law.시행일자 || law.efYd || '',
                        공포일자: law.공포일자 || law.promDate || '',
                        공포번호: law.공포번호 || law.promNo || '',
                        제개정구분: law.제개정구분명 || law.제개정구분 || '',
                        법령구분: law.법령구분명 || law.법령구분 || '',
                        소관부처: law.소관부처명 || law.소관부처 || '',
                        법령상태: law.법령상태 || determineStatus(law.시행일자) || '',
                        연혁: law.연혁 || [],
                        조회일시: new Date().toISOString()
                    }));
                    
                    allLaws.push(...processedLaws);
                    console.log(`✅ ${laws.length}개 법령 추가 (누적: ${allLaws.length}개)`);
                    
                    // 다음 페이지 확인
                    const totalCount = parseInt(data.totalCnt || data.totalCount || '0');
                    if (totalCount > 0 && allLaws.length < totalCount) {
                        page++;
                    } else {
                        hasMore = false;
                    }
                } else {
                    console.log('더 이상 법령이 없습니다.');
                    hasMore = false;
                }
            } else {
                console.log('응답 데이터가 비어있습니다.');
                hasMore = false;
            }
            
            // API 호출 간격 조절 (너무 빠르게 호출하지 않도록)
            if (hasMore) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
        } catch (error) {
            console.error(`❌ API 호출 실패 (페이지 ${page}):`, error.message);
            
            // 네트워크 오류가 아닌 경우 재시도
            if (error.response && error.response.status === 404) {
                console.log('API 엔드포인트를 찾을 수 없습니다.');
                break;
            } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                console.log('API 서버에 연결할 수 없습니다. 재시도 중...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
            } else {
                // 기타 오류의 경우 중단
                break;
            }
        }
    }
    
    console.log(`\n📊 총 ${allLaws.length}개 법령 조회 완료`);
    return allLaws;
}

// 법령 상태 판별 함수
function determineStatus(effectiveDate) {
    if (!effectiveDate) return '미정';
    
    const today = new Date();
    const efDate = parseDate(effectiveDate);
    
    if (!efDate) return '미정';
    
    if (efDate > today) {
        return '예정';
    } else {
        return '현행';
    }
}

// 날짜 파싱 함수
function parseDate(dateStr) {
    if (!dateStr) return null;
    
    // YYYYMMDD 형식
    if (dateStr.length === 8) {
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        return new Date(year, month, day);
    }
    
    // YYYY-MM-DD 형식
    if (dateStr.includes('-')) {
        return new Date(dateStr);
    }
    
    return null;
}

// 결과 저장 함수
async function saveLaws(laws) {
    const outputPath = path.join(__dirname, 'laws_2025_all.json');
    
    const data = {
        generatedAt: new Date().toISOString(),
        year: 2025,
        totalCount: laws.length,
        description: '2025년 시행 법령 전체 목록 (예정, 현행, 연혁 포함)',
        api: {
            source: '국가법령정보센터',
            endpoint: API_BASE_URL,
            oc: OC_VALUE
        },
        statistics: {
            byStatus: {
                예정: laws.filter(l => l.법령상태 === '예정').length,
                현행: laws.filter(l => l.법령상태 === '현행').length,
                연혁: laws.filter(l => l.법령상태 === '연혁').length,
                미정: laws.filter(l => l.법령상태 === '미정').length
            },
            byType: {
                법률: laws.filter(l => l.법령구분 === '법률').length,
                대통령령: laws.filter(l => l.법령구분 === '대통령령').length,
                총리령: laws.filter(l => l.법령구분 === '총리령').length,
                부령: laws.filter(l => l.법령구분 === '부령').length,
                기타: laws.filter(l => !['법률', '대통령령', '총리령', '부령'].includes(l.법령구분)).length
            },
            byMonth: {}
        },
        items: laws
    };
    
    // 월별 통계 계산
    for (let month = 1; month <= 12; month++) {
        const monthStr = String(month).padStart(2, '0');
        data.statistics.byMonth[`${month}월`] = laws.filter(l => 
            l.시행일자 && l.시행일자.substring(4, 6) === monthStr
        ).length;
    }
    
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`\n💾 결과 저장 완료: ${outputPath}`);
    console.log('\n📈 통계:');
    console.log('  상태별:', data.statistics.byStatus);
    console.log('  유형별:', data.statistics.byType);
    console.log('  월별:', data.statistics.byMonth);
    
    return outputPath;
}

// 메인 실행 함수
async function main() {
    console.log('==================================');
    console.log('2025년 시행법령 전체 조회 시작');
    console.log('==================================\n');
    
    try {
        // xml2js 설치 확인
        try {
            require('xml2js');
        } catch (e) {
            console.log('xml2js 패키지 설치 중...');
            const { execSync } = require('child_process');
            execSync('npm install xml2js', { stdio: 'inherit' });
        }
        
        const laws = await fetchAll2025Laws();
        
        if (laws.length > 0) {
            const savedPath = await saveLaws(laws);
            console.log('\n✨ 작업 완료!');
            return laws;
        } else {
            console.log('\n⚠️ 조회된 법령이 없습니다.');
            return [];
        }
        
    } catch (error) {
        console.error('\n❌ 오류 발생:', error);
        return [];
    }
}

// 모듈로 사용할 수 있도록 export
module.exports = {
    fetchAll2025Laws,
    saveLaws,
    main
};

// 직접 실행시
if (require.main === module) {
    main();
}