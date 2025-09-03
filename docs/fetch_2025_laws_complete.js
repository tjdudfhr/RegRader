const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const xml2js = require('xml2js');

// API 설정
const API_URL = 'https://www.law.go.kr/DRF/lawSearch.do';
const OC_VALUE = 'knowhow1';

// XML을 JSON으로 변환
async function parseXML(xmlData) {
    const parser = new xml2js.Parser({
        explicitArray: false,
        ignoreAttrs: true,
        tagNameProcessors: [xml2js.processors.stripPrefix]
    });
    
    return new Promise((resolve, reject) => {
        parser.parseString(xmlData, (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
}

// 2025년 시행법령 전체 조회
async function fetchAll2025Laws() {
    const allLaws = [];
    let page = 1;
    let totalCount = 0;
    const pageSize = 100;
    
    console.log('🔍 2025년 시행법령 조회 시작...');
    console.log('  API: 국가법령정보센터');
    console.log('  대상: eflaw (시행법령)');
    console.log('  범위: 2025-01-01 ~ 2025-12-31');
    console.log('  상태: 예정 + 현행 + 연혁');
    console.log('');
    
    do {
        try {
            const params = {
                OC: OC_VALUE,
                target: 'eflaw',
                type: 'XML',
                efYd: '20250101~20251231',
                display: pageSize.toString(),
                page: page.toString()
            };
            
            console.log(`📄 페이지 ${page} 조회 중...`);
            
            const response = await axios.get(API_URL, {
                params,
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'text/xml'
                }
            });
            
            // XML 파싱
            const data = await parseXML(response.data);
            
            if (data.LawSearch) {
                // 전체 개수 확인
                if (page === 1) {
                    totalCount = parseInt(data.LawSearch.totalCnt || 0);
                    console.log(`📊 총 ${totalCount}개 법령 발견\n`);
                }
                
                // 법령 목록 추출
                let laws = data.LawSearch.law;
                if (!laws) {
                    break;
                }
                
                // 단일 객체인 경우 배열로 변환
                if (!Array.isArray(laws)) {
                    laws = [laws];
                }
                
                // 법령 정보 정제
                const processedLaws = laws.map((law, idx) => {
                    // 시행일자 추출 (시행일자 필드가 있으면 사용, 없으면 공포일자 기반 계산)
                    let 시행일자 = law.시행일자 || '';
                    if (!시행일자 && law.공포일자) {
                        // 일반적으로 공포 후 일정 기간 후 시행
                        시행일자 = law.공포일자;
                    }
                    
                    return {
                        id: `law_2025_${page}_${idx + 1}`,
                        법령일련번호: law.법령일련번호 || '',
                        법령ID: law.법령ID || '',
                        법령명: law.법령명한글 || '',
                        법령약칭명: law.법령약칭명 || '',
                        시행일자: 시행일자,
                        공포일자: law.공포일자 || '',
                        공포번호: law.공포번호 || '',
                        제개정구분: law.제개정구분명 || '',
                        법령구분: law.법령구분명 || '',
                        소관부처코드: law.소관부처코드 || '',
                        소관부처: law.소관부처명 || '',
                        현행연혁코드: law.현행연혁코드 || '',
                        법령상태: determineStatus(시행일자, law.현행연혁코드),
                        링크: law.법령상세링크 || `https://www.law.go.kr/법령/${encodeURIComponent(law.법령명한글)}`,
                        조회일시: new Date().toISOString()
                    };
                });
                
                allLaws.push(...processedLaws);
                console.log(`  ✅ ${laws.length}개 법령 추가 (누적: ${allLaws.length}/${totalCount})`);
                
                // 진행률 표시
                const progress = Math.round((allLaws.length / totalCount) * 100);
                console.log(`  📈 진행률: ${progress}%`);
                
                // 다음 페이지로
                if (allLaws.length < totalCount) {
                    page++;
                    // API 부하 방지를 위한 딜레이
                    await new Promise(resolve => setTimeout(resolve, 300));
                } else {
                    break;
                }
                
            } else {
                console.log('응답 데이터 형식 오류');
                break;
            }
            
        } catch (error) {
            console.error(`❌ 페이지 ${page} 조회 실패:`, error.message);
            break;
        }
        
    } while (allLaws.length < totalCount);
    
    console.log(`\n✅ 조회 완료: 총 ${allLaws.length}개 법령`);
    return allLaws;
}

// 법령 상태 판별
function determineStatus(시행일자, 현행연혁코드) {
    // 현행연혁코드가 있으면 우선 사용
    if (현행연혁코드) {
        if (현행연혁코드 === '현행') return '현행';
        if (현행연혁코드 === '연혁') return '연혁';
    }
    
    // 시행일자로 판단
    if (!시행일자) return '미정';
    
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    if (시행일자 > todayStr) {
        return '예정';
    } else {
        return '현행';
    }
}

// 결과 저장
async function saveLaws(laws) {
    const outputPath = path.join(__dirname, 'laws_2025_complete.json');
    
    // 통계 계산
    const stats = {
        total: laws.length,
        byStatus: {},
        byType: {},
        byMonth: {},
        byMinistry: {}
    };
    
    // 상태별
    stats.byStatus = {
        현행: laws.filter(l => l.법령상태 === '현행').length,
        예정: laws.filter(l => l.법령상태 === '예정').length,
        연혁: laws.filter(l => l.법령상태 === '연혁').length,
        미정: laws.filter(l => l.법령상태 === '미정').length
    };
    
    // 법령구분별
    const typeMap = {};
    laws.forEach(law => {
        const type = law.법령구분 || '기타';
        typeMap[type] = (typeMap[type] || 0) + 1;
    });
    stats.byType = typeMap;
    
    // 월별
    for (let month = 1; month <= 12; month++) {
        const monthStr = String(month).padStart(2, '0');
        stats.byMonth[`${month}월`] = laws.filter(l => 
            l.시행일자 && l.시행일자.substring(4, 6) === monthStr
        ).length;
    }
    
    // 소관부처별 (상위 10개)
    const ministryMap = {};
    laws.forEach(law => {
        const ministry = law.소관부처 || '기타';
        ministryMap[ministry] = (ministryMap[ministry] || 0) + 1;
    });
    const sortedMinistries = Object.entries(ministryMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    stats.byMinistry = Object.fromEntries(sortedMinistries);
    
    const data = {
        metadata: {
            generatedAt: new Date().toISOString(),
            source: '국가법령정보센터 Open API',
            api: {
                url: API_URL,
                oc: OC_VALUE,
                target: 'eflaw',
                range: '2025-01-01 ~ 2025-12-31'
            },
            year: 2025,
            description: '2025년 시행 법령 전체 목록 (예정, 현행, 연혁 포함)'
        },
        statistics: stats,
        laws: laws
    };
    
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');
    
    console.log(`\n💾 파일 저장 완료: ${outputPath}`);
    console.log('\n📊 통계 요약:');
    console.log('━'.repeat(50));
    console.log(`총 법령 수: ${stats.total}개`);
    console.log('\n상태별:');
    Object.entries(stats.byStatus).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}개`);
    });
    console.log('\n법령구분별 (상위 5개):');
    Object.entries(stats.byType)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([type, count]) => {
            console.log(`  ${type}: ${count}개`);
        });
    console.log('\n월별 시행:');
    Object.entries(stats.byMonth).forEach(([month, count]) => {
        if (count > 0) {
            console.log(`  ${month}: ${count}개`);
        }
    });
    console.log('\n주요 소관부처:');
    Object.entries(stats.byMinistry).forEach(([ministry, count]) => {
        console.log(`  ${ministry}: ${count}개`);
    });
    console.log('━'.repeat(50));
    
    return outputPath;
}

// 메인 실행
async function main() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   2025년 시행법령 전체 조회 시스템     ║');
    console.log('║   국가법령정보센터 Open API 활용       ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    try {
        const laws = await fetchAll2025Laws();
        
        if (laws.length > 0) {
            const savedPath = await saveLaws(laws);
            console.log('\n✨ 작업 완료!');
            console.log(`📁 ${laws.length}개 법령이 저장되었습니다.`);
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

// 모듈 export
module.exports = {
    fetchAll2025Laws,
    saveLaws,
    main
};

// 직접 실행
if (require.main === module) {
    main();
}