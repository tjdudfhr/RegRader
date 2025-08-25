#!/usr/bin/env python3
import json
import re

def fix_html_js_data():
    """HTML의 JavaScript 데이터를 안전한 형식으로 수정"""
    
    # 정확한 매칭 데이터 로드
    with open('docs/precise_law_matching.json', 'r', encoding='utf-8') as f:
        precise_data = json.load(f)
    
    # HTML 파일 읽기
    with open('docs/index.html', 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    # 안전한 JavaScript 데이터 생성 (laws 배열 제외)
    safe_js_data = f'''
        // 정확한 2025년 매칭 법령 데이터 (안전한 버전)
        const preciseMatchedData = {{
            "total_laws": {precise_data["matched_count"]},
            "implemented": {precise_data["implemented_count"]}, 
            "upcoming": {precise_data["upcoming_count"]},
            "by_quarter": {json.dumps(precise_data["by_quarter_counts"], ensure_ascii=False)},
            "by_category": {json.dumps(precise_data["by_category_counts"], ensure_ascii=False)},
            "match_percentage": {precise_data["match_percentage"]},
            "laws": [] // 법령 상세 데이터는 별도 로드
        }};
        
        // 정확한 법령 데이터를 별도 파일에서 로드
        let preciseLawsData = [];
        
        async function loadPreciseLawsData() {{
            try {{
                const response = await fetch('./precise_law_matching.json');
                const data = await response.json();
                preciseLawsData = data.matched_laws || [];
                preciseMatchedData.laws = preciseLawsData;
                console.log('✅ 정확한 법령 데이터 로드 완료:', preciseLawsData.length + '건');
            }} catch (error) {{
                console.error('❌ 법령 데이터 로드 실패:', error);
            }}
        }}
        
        // 정확한 분기별 데이터로 업데이트하는 함수  
        function updateQuarterlyDataWithPrecise() {{
            const quarterCounts = preciseMatchedData.by_quarter;
            
            // 각 분기 박스의 수치 업데이트
            document.querySelector('#q1-count').textContent = quarterCounts.Q1 || 0;
            document.querySelector('#q2-count').textContent = quarterCounts.Q2 || 0;
            document.querySelector('#q3-count').textContent = quarterCounts.Q3 || 0;
            document.querySelector('#q4-count').textContent = quarterCounts.Q4 || 0;
            
            console.log('✅ 정확한 분기별 데이터 업데이트 완료:', quarterCounts);
        }}
        
        // 정확한 직무별 데이터로 업데이트하는 함수
        function updateJobFunctionDataWithPrecise() {{
            const categoryData = preciseMatchedData.by_category;
            
            // 각 직무별 카운트 업데이트
            Object.keys(categoryData).forEach(category => {{
                const countElement = document.querySelector(`#job-count-${{category}}`);
                if (countElement) {{
                    countElement.textContent = categoryData[category] || 0;
                }}
            }});
            
            console.log('✅ 정확한 직무별 데이터 업데이트 완료:', categoryData);
        }}
        
        // 정확한 메인 대시보드 수치 업데이트 함수
        function updateMainDashboardWithPrecise() {{
            // 총 적용 법규 (정확한 매칭된 법령 수)
            const totalAppliedElements = document.querySelectorAll('.metric-number');
            if (totalAppliedElements.length > 0) {{
                totalAppliedElements[0].textContent = preciseMatchedData.total_laws;
            }}
            
            // 개정 예정 법규 (시행 예정)
            if (totalAppliedElements.length > 1) {{
                totalAppliedElements[1].textContent = preciseMatchedData.upcoming;
            }}
            
            console.log(`✅ 정확한 대시보드 업데이트: 총 ${{preciseMatchedData.total_laws}}건, 예정 ${{preciseMatchedData.upcoming}}건`);
        }}
        
        // 정확한 2025년 법령만 필터링하는 함수
        function filterPreciseMatchedLaws() {{
            const matchedLawTitles = new Set(preciseLawsData.map(law => law.title));
            return lawsData.filter(law => matchedLawTitles.has(law.title));
        }}
        
        // 정확한 분기별 법령 표시 함수
        function showQuarterDetailsWithPrecise(quarter) {{
            const quarterLaws = preciseLawsData.filter(law => {{
                const date = new Date(law.effectiveDate);
                const month = date.getMonth() + 1;
                
                switch(quarter) {{
                    case 'Q1': return month >= 1 && month <= 3;
                    case 'Q2': return month >= 4 && month <= 6;
                    case 'Q3': return month >= 7 && month <= 9;
                    case 'Q4': return month >= 10 && month <= 12;
                    default: return false;
                }}
            }});
            
            console.log(`${{quarter}} 정확한 법령 ${{quarterLaws.length}}개 표시`);
            return quarterLaws;
        }}
    '''
    
    # 기존 preciseMatchedData 관련 코드를 새로운 안전한 코드로 교체
    pattern = r'// 정확한 2025년 매칭 법령 데이터.*?return quarterLaws;[^}]*}'
    html_content = re.sub(pattern, safe_js_data.strip(), html_content, flags=re.DOTALL)
    
    # loadData 함수에 정확한 데이터 로드 추가
    load_data_pattern = r'(updateMainDashboardWithPrecise\(\);)'
    replacement = r'\1\n                \n                // 정확한 법령 상세 데이터 로드\n                await loadPreciseLawsData();'
    html_content = re.sub(load_data_pattern, replacement, html_content)
    
    # 파일에 저장
    with open('docs/index.html', 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print("✅ JavaScript 데이터 안전하게 수정 완료!")
    print("📊 기본 통계만 인라인으로 포함, 법령 상세 데이터는 별도 로드")
    
    return True

if __name__ == "__main__":
    fix_html_js_data()