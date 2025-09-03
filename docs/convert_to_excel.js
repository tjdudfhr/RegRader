const fs = require('fs').promises;
const path = require('path');
const XLSX = require('xlsx');

async function convertToExcel() {
    try {
        // JSON 데이터 읽기
        const jsonPath = path.join(__dirname, 'laws_2025_complete.json');
        const jsonData = await fs.readFile(jsonPath, 'utf8');
        const data = JSON.parse(jsonData);
        
        console.log(`📊 ${data.laws.length}개 법령 데이터를 엑셀로 변환 중...`);
        
        // 엑셀용 데이터 준비
        const excelData = data.laws.map((law, index) => ({
            '순번': index + 1,
            '법령ID': law.법령ID || '',
            '법령일련번호': law.법령일련번호 || '',
            '법령명': law.법령명 || '',
            '법령약칭': law.법령약칭명 || '',
            '법령구분': law.법령구분 || '',
            '제개정구분': law.제개정구분 || '',
            '시행일자': formatDate(law.시행일자),
            '공포일자': formatDate(law.공포일자),
            '공포번호': law.공포번호 || '',
            '소관부처': law.소관부처 || '',
            '법령상태': law.법령상태 || '',
            '현행연혁코드': law.현행연혁코드 || '',
            '링크': law.링크 || ''
        }));
        
        // 통계 시트 데이터
        const statsData = [
            { '구분': '총 법령 수', '값': data.statistics.total },
            { '구분': '', '값': '' },
            { '구분': '== 상태별 ==', '값': '' },
            { '구분': '현행', '값': data.statistics.byStatus.현행 },
            { '구분': '예정', '값': data.statistics.byStatus.예정 },
            { '구분': '연혁', '값': data.statistics.byStatus.연혁 },
            { '구분': '', '값': '' },
            { '구분': '== 법령구분별 ==', '값': '' },
            ...Object.entries(data.statistics.byType).map(([type, count]) => ({
                '구분': type,
                '값': count
            })),
            { '구분': '', '값': '' },
            { '구분': '== 월별 시행 ==', '값': '' },
            ...Object.entries(data.statistics.byMonth).map(([month, count]) => ({
                '구분': month,
                '값': count
            })),
            { '구분': '', '값': '' },
            { '구분': '== 주요 소관부처 ==', '값': '' },
            ...Object.entries(data.statistics.byMinistry).map(([ministry, count]) => ({
                '구분': ministry,
                '값': count
            }))
        ];
        
        // 메타데이터 시트
        const metaData = [
            { '항목': '생성일시', '내용': data.metadata.generatedAt },
            { '항목': '데이터 출처', '내용': data.metadata.source },
            { '항목': 'API URL', '내용': data.metadata.api.url },
            { '항목': 'API OC', '내용': data.metadata.api.oc },
            { '항목': 'API Target', '내용': data.metadata.api.target },
            { '항목': '조회 범위', '내용': data.metadata.api.range },
            { '항목': '설명', '내용': data.metadata.description }
        ];
        
        // 워크북 생성
        const wb = XLSX.utils.book_new();
        
        // 법령 목록 시트
        const ws1 = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(wb, ws1, '2025년 시행법령');
        
        // 통계 시트
        const ws2 = XLSX.utils.json_to_sheet(statsData);
        XLSX.utils.book_append_sheet(wb, ws2, '통계');
        
        // 메타데이터 시트
        const ws3 = XLSX.utils.json_to_sheet(metaData);
        XLSX.utils.book_append_sheet(wb, ws3, '정보');
        
        // 컬럼 너비 조정
        const maxWidth = 50;
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'].forEach(col => {
            ws1['!cols'] = ws1['!cols'] || [];
            ws1['!cols'].push({ wch: col === 'C' ? maxWidth : 15 }); // 법령명은 넓게
        });
        
        // 파일 저장
        const outputPath = path.join(__dirname, '2025_laws_complete_new.xlsx');
        XLSX.writeFile(wb, outputPath);
        
        console.log(`✅ 엑셀 파일 생성 완료: ${outputPath}`);
        console.log(`📁 파일 크기: ${(await fs.stat(outputPath)).size / 1024 / 1024} MB`);
        
        // 기존 파일 백업하고 교체
        const oldPath = path.join(__dirname, '2025_laws_complete.xlsx');
        const backupPath = path.join(__dirname, '2025_laws_complete_old.xlsx');
        
        try {
            await fs.rename(oldPath, backupPath);
            console.log(`📦 기존 파일 백업: ${backupPath}`);
        } catch (e) {
            console.log('기존 파일이 없거나 백업 실패');
        }
        
        await fs.rename(outputPath, oldPath);
        console.log(`✨ 파일 교체 완료: ${oldPath}`);
        
        return oldPath;
        
    } catch (error) {
        console.error('❌ 변환 실패:', error);
        throw error;
    }
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
module.exports = { convertToExcel };

// 직접 실행
if (require.main === module) {
    console.log('🔄 2025년 시행법령 엑셀 변환 시작...\n');
    convertToExcel()
        .then(() => console.log('\n✅ 모든 작업 완료!'))
        .catch(err => console.error('\n❌ 작업 실패:', err));
}