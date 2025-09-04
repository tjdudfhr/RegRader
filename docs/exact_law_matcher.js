const fs = require('fs').promises;
const path = require('path');

// 정확한 법령 매칭 함수
async function performExactMatching() {
    try {
        console.log('╔════════════════════════════════════════════════╗');
        console.log('║   당사 적용법규 - 2025년 시행법령 정확 매칭    ║');
        console.log('╚════════════════════════════════════════════════╝\n');
        
        // 1. 당사 적용법규 207개 로드
        console.log('📂 데이터 로드 중...');
        const baseLawsPath = path.join(__dirname, 'base_laws_207.json');
        const baseLawsData = await fs.readFile(baseLawsPath, 'utf8');
        const baseLaws = JSON.parse(baseLawsData);
        console.log(`✅ 당사 적용법규: ${baseLaws.items.length}개 로드 완료`);
        
        // 2. 2025년 시행법령 2,971개 로드
        const laws2025Path = path.join(__dirname, 'laws_2025_complete.json');
        const laws2025Data = await fs.readFile(laws2025Path, 'utf8');
        const laws2025 = JSON.parse(laws2025Data);
        console.log(`✅ 2025년 시행법령: ${laws2025.laws.length}개 로드 완료\n`);
        
        // 3. 법령명 정규화 함수
        function normalizeLawName(name) {
            if (!name) return '';
            // 공백, 특수문자 제거하고 표준화
            return name
                .replace(/\s+/g, '')  // 모든 공백 제거
                .replace(/[\(\)（）\[\]【】]/g, '')  // 괄호 제거
                .replace(/·|･|・|,|、/g, '')  // 구분자 제거
                .replace(/및/g, '')
                .replace(/등/g, '')
                .replace(/에관한/g, '관한')
                .replace(/에대한/g, '대한')
                .toLowerCase();
        }
        
        // 4. 정확한 매칭 수행
        console.log('🔍 정확한 매칭 시작...\n');
        const matchResults = [];
        const unmatchedLaws = [];
        let totalMatches = 0;
        
        for (const baseLaw of baseLaws.items) {
            const normalizedBaseName = normalizeLawName(baseLaw.title);
            const matches = [];
            
            // 2025년 법령에서 정확히 일치하는 것만 찾기
            for (const law2025 of laws2025.laws) {
                const normalized2025Name = normalizeLawName(law2025.법령명);
                
                // 100% 일치 확인
                if (normalizedBaseName === normalized2025Name) {
                    matches.push({
                        법령명: law2025.법령명,
                        법령ID: law2025.법령ID,
                        시행일자: law2025.시행일자,
                        공포일자: law2025.공포일자,
                        제개정구분: law2025.제개정구분,
                        법령구분: law2025.법령구분,
                        소관부처: law2025.소관부처,
                        법령상태: law2025.법령상태,
                        현행연혁코드: law2025.현행연혁코드
                    });
                    totalMatches++;
                }
            }
            
            if (matches.length > 0) {
                matchResults.push({
                    적용법규: baseLaw.title,
                    적용법규_ID: baseLaw.id,
                    카테고리: baseLaw.categories || [],
                    매칭수: matches.length,
                    매칭결과: matches
                });
                
                // 매칭 결과 출력
                if (matches.length === 1) {
                    console.log(`✅ [매칭] ${baseLaw.title}`);
                    console.log(`   └─ ${matches[0].시행일자} (${matches[0].법령상태})`);
                } else {
                    console.log(`✅ [다중매칭 ${matches.length}개] ${baseLaw.title}`);
                    matches.forEach(match => {
                        console.log(`   └─ ${match.시행일자} (${match.법령상태}) - ${match.제개정구분}`);
                    });
                }
            } else {
                unmatchedLaws.push({
                    적용법규: baseLaw.title,
                    적용법규_ID: baseLaw.id,
                    카테고리: baseLaw.categories || []
                });
                console.log(`❌ [미매칭] ${baseLaw.title}`);
            }
        }
        
        console.log('\n' + '═'.repeat(50));
        console.log('📊 매칭 결과 통계\n');
        console.log(`총 적용법규: ${baseLaws.items.length}개`);
        console.log(`매칭된 적용법규: ${matchResults.length}개 (${Math.round(matchResults.length / baseLaws.items.length * 100)}%)`);
        console.log(`미매칭 적용법규: ${unmatchedLaws.length}개 (${Math.round(unmatchedLaws.length / baseLaws.items.length * 100)}%)`);
        console.log(`총 매칭 건수: ${totalMatches}건 (동일 법령 다중 시행일 포함)`);
        
        // 다중 매칭 통계
        const multipleMatches = matchResults.filter(r => r.매칭수 > 1);
        if (multipleMatches.length > 0) {
            console.log(`\n📌 다중 시행일 법령: ${multipleMatches.length}개`);
            multipleMatches.forEach(m => {
                console.log(`  - ${m.적용법규}: ${m.매칭수}회 개정`);
            });
        }
        
        // 5. 결과 저장
        const outputData = {
            metadata: {
                생성일시: new Date().toISOString(),
                적용법규_총개수: baseLaws.items.length,
                매칭된_적용법규수: matchResults.length,
                미매칭_적용법규수: unmatchedLaws.length,
                총_매칭건수: totalMatches,
                매칭율: Math.round(matchResults.length / baseLaws.items.length * 100) + '%',
                설명: '당사 적용법규 207개와 2025년 시행법령 2,971개의 100% 정확 매칭 결과'
            },
            statistics: {
                법령구분별: {},
                소관부처별: {},
                시행월별: {},
                법령상태별: {
                    현행: 0,
                    예정: 0,
                    연혁: 0
                }
            },
            매칭결과: matchResults,
            미매칭법규: unmatchedLaws
        };
        
        // 통계 계산
        matchResults.forEach(result => {
            result.매칭결과.forEach(match => {
                // 법령구분별
                const type = match.법령구분 || '기타';
                outputData.statistics.법령구분별[type] = (outputData.statistics.법령구분별[type] || 0) + 1;
                
                // 소관부처별
                const ministry = match.소관부처 || '기타';
                outputData.statistics.소관부처별[ministry] = (outputData.statistics.소관부처별[ministry] || 0) + 1;
                
                // 시행월별
                if (match.시행일자 && match.시행일자.length >= 6) {
                    const month = parseInt(match.시행일자.substring(4, 6));
                    const monthKey = `${month}월`;
                    outputData.statistics.시행월별[monthKey] = (outputData.statistics.시행월별[monthKey] || 0) + 1;
                }
                
                // 법령상태별
                const status = match.법령상태 || '미정';
                if (outputData.statistics.법령상태별[status] !== undefined) {
                    outputData.statistics.법령상태별[status]++;
                }
            });
        });
        
        // JSON 파일 저장
        const outputPath = path.join(__dirname, 'matched_laws_2025.json');
        await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2), 'utf8');
        console.log(`\n💾 매칭 결과 저장: ${outputPath}`);
        
        // 6. 엑셀 파일 생성
        console.log('\n📊 엑셀 파일 생성 중...');
        await createMatchingExcel(outputData);
        
        // 7. index.json 업데이트용 데이터 생성
        const indexUpdateData = {
            generatedAt: Math.floor(Date.now() / 1000),
            year: 2025,
            description: '2025년 당사 적용 법규 매칭 결과 (100% 정확 매칭)',
            total_laws: totalMatches,
            matched_base_laws: matchResults.length,
            items: []
        };
        
        // 매칭된 법령들을 index.json 형식으로 변환
        matchResults.forEach(result => {
            result.매칭결과.forEach(match => {
                indexUpdateData.items.push({
                    id: `matched_${indexUpdateData.items.length + 1}`,
                    title: match.법령명,
                    baseLawTitle: result.적용법규,
                    lawID: match.법령ID,
                    effectiveDate: formatDate(match.시행일자),
                    promulgationDate: formatDate(match.공포일자),
                    amendmentType: match.제개정구분,
                    lawType: match.법령구분,
                    ministry: match.소관부처,
                    status: match.법령상태,
                    categories: result.카테고리,
                    amendments: [{
                        date: formatDate(match.시행일자),
                        reason: match.제개정구분 || '개정',
                        mainContents: `${result.적용법규}의 2025년 개정사항`
                    }]
                });
            });
        });
        
        const indexPath = path.join(__dirname, 'matched_index_2025.json');
        await fs.writeFile(indexPath, JSON.stringify(indexUpdateData, null, 2), 'utf8');
        console.log(`💾 인덱스 파일 생성: ${indexPath}`);
        
        console.log('\n✨ 모든 작업 완료!');
        return outputData;
        
    } catch (error) {
        console.error('❌ 오류 발생:', error);
        throw error;
    }
}

// 엑셀 파일 생성 함수
async function createMatchingExcel(data) {
    const XLSX = require('xlsx');
    
    // 매칭 결과 시트 데이터
    const matchingData = [];
    data.매칭결과.forEach(result => {
        result.매칭결과.forEach(match => {
            matchingData.push({
                '적용법규': result.적용법규,
                '카테고리': result.카테고리.join(', '),
                '매칭된_법령명': match.법령명,
                '법령ID': match.법령ID,
                '시행일자': formatDate(match.시행일자),
                '공포일자': formatDate(match.공포일자),
                '제개정구분': match.제개정구분,
                '법령구분': match.법령구분,
                '소관부처': match.소관부처,
                '법령상태': match.법령상태,
                '현행연혁코드': match.현행연혁코드
            });
        });
    });
    
    // 미매칭 시트 데이터
    const unmatchedData = data.미매칭법규.map(law => ({
        '적용법규': law.적용법규,
        '카테고리': law.카테고리.join(', '),
        '비고': '2025년 개정 없음'
    }));
    
    // 통계 시트 데이터
    const statsData = [
        { '구분': '총 적용법규', '값': data.metadata.적용법규_총개수 },
        { '구분': '매칭된 적용법규', '값': data.metadata.매칭된_적용법규수 },
        { '구분': '미매칭 적용법규', '값': data.metadata.미매칭_적용법규수 },
        { '구분': '총 매칭건수', '값': data.metadata.총_매칭건수 },
        { '구분': '매칭율', '값': data.metadata.매칭율 },
        { '구분': '', '값': '' },
        { '구분': '== 법령상태별 ==', '값': '' },
        ...Object.entries(data.statistics.법령상태별).map(([k, v]) => ({ '구분': k, '값': v })),
        { '구분': '', '값': '' },
        { '구분': '== 시행월별 ==', '값': '' },
        ...Object.entries(data.statistics.시행월별).sort((a, b) => {
            const monthA = parseInt(a[0]);
            const monthB = parseInt(b[0]);
            return monthA - monthB;
        }).map(([k, v]) => ({ '구분': k, '값': v }))
    ];
    
    // 워크북 생성
    const wb = XLSX.utils.book_new();
    
    // 시트 추가
    const ws1 = XLSX.utils.json_to_sheet(matchingData);
    const ws2 = XLSX.utils.json_to_sheet(unmatchedData);
    const ws3 = XLSX.utils.json_to_sheet(statsData);
    
    XLSX.utils.book_append_sheet(wb, ws1, '매칭결과');
    XLSX.utils.book_append_sheet(wb, ws2, '미매칭법규');
    XLSX.utils.book_append_sheet(wb, ws3, '통계');
    
    // 파일 저장
    const outputPath = path.join(__dirname, 'matched_laws_2025.xlsx');
    XLSX.writeFile(wb, outputPath);
    console.log(`✅ 엑셀 파일 생성: ${outputPath}`);
}

// 날짜 포맷 함수
function formatDate(dateStr) {
    if (!dateStr) return '';
    if (dateStr.length === 8) {
        return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    }
    return dateStr;
}

// 모듈 내보내기
module.exports = { performExactMatching };

// 직접 실행
if (require.main === module) {
    performExactMatching()
        .then(() => console.log('\n🎉 매칭 작업이 성공적으로 완료되었습니다!'))
        .catch(err => console.error('\n❌ 작업 실패:', err));
}