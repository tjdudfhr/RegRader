#!/usr/bin/env python3
import json
import re
from datetime import date, datetime

def load_actual_2025_data():
    """실제 2025년 시행 법령 데이터 로드"""
    with open('docs/actual_2025_laws_analysis.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def update_html_with_actual_data():
    """HTML 파일을 실제 2025년 데이터로 업데이트"""
    
    # 실제 데이터 로드
    actual_data = load_actual_2025_data()
    
    # HTML 파일 읽기
    with open('docs/index.html', 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    print("🔄 HTML 업데이트 시작...")
    
    # 1. 메인 대시보드 수치 업데이트
    # 전체 적용 법규 수정 (212개 유지)
    # 총 적용 법규 수정 (실제 2025년 시행 법령)
    html_content = re.sub(
        r'총 적용 법규 <span class="metric-number">\d+</span>건',
        f'총 적용 법규 <span class="metric-number">{actual_data["total_laws"]}</span>건',
        html_content
    )
    
    # 개정 예정 법규 수정 (시행 예정)
    html_content = re.sub(
        r'개정 예정 법규 <span class="metric-number">\d+</span>건',
        f'개정 예정 법규 <span class="metric-number">{actual_data["upcoming"]}</span>건',
        html_content
    )
    
    print(f"✅ 메인 대시보드: 총 {actual_data['total_laws']}건, 예정 {actual_data['upcoming']}건")
    
    # 2. JavaScript 데이터 업데이트 함수 추가
    js_update_code = f'''
    
        // 실제 2025년 시행 법령 데이터
        const actual2025Data = {json.dumps(actual_data, ensure_ascii=False, indent=8)};
        
        // 분기별 실제 데이터로 업데이트하는 함수  
        function updateQuarterlyDataWithActual() {{
            const quarterCounts = actual2025Data.by_quarter;
            
            // 각 분기 박스의 수치 업데이트
            document.querySelector('#q1-count').textContent = quarterCounts.Q1;
            document.querySelector('#q2-count').textContent = quarterCounts.Q2;
            document.querySelector('#q3-count').textContent = quarterCounts.Q3;
            document.querySelector('#q4-count').textContent = quarterCounts.Q4;
            
            console.log('✅ 분기별 데이터 업데이트 완료:', quarterCounts);
        }}
        
        // 직무별 실제 데이터로 업데이트하는 함수
        function updateJobFunctionDataWithActual() {{
            const categoryData = actual2025Data.by_category;
            
            // 각 직무별 카운트 업데이트
            Object.keys(categoryData).forEach(category => {{
                const countElement = document.querySelector(`#job-count-${{category}}`);
                if (countElement) {{
                    countElement.textContent = categoryData[category];
                }}
            }});
            
            console.log('✅ 직무별 데이터 업데이트 완료:', categoryData);
        }}
        
        // 실제 2025년 법령만 필터링하는 함수
        function filterActual2025Laws() {{
            const actualLawTitles = new Set(actual2025Data.laws.map(law => law.title));
            return lawsData.filter(law => actualLawTitles.has(law.title));
        }}
    '''
    
    # HTML에 JavaScript 코드 삽입 (기존 script 태그 앞에)
    html_content = html_content.replace(
        '<script>',
        f'<script>{js_update_code}\n',
        1  # 첫 번째 script 태그만
    )
    
    # 3. 페이지 로드 시 자동 업데이트되도록 수정
    # DOMContentLoaded 이벤트에 함수 호출 추가
    init_code = '''
            // 실제 2025년 데이터로 업데이트
            updateQuarterlyDataWithActual();
            updateJobFunctionDataWithActual();
            
            // 필터링된 데이터로 차트 업데이트'''
    
    # loadLawData 함수 안에 코드 추가
    html_content = re.sub(
        r'(async function loadLawData\(\) \{[^}]+)(updateDashboard\(lawsData\);)',
        rf'\1{init_code}\n            \2',
        html_content,
        flags=re.DOTALL
    )
    
    print("✅ JavaScript 업데이트 코드 추가 완료")
    
    # 4. 분기별 팝업에서 실제 데이터만 표시하도록 수정
    popup_filter_code = '''
        function showQuarterDetails(quarter) {
            const actual2025Laws = filterActual2025Laws();
            const quarterLaws = actual2025Laws.filter(law => {
                const date = new Date(law.effectiveDate);
                const month = date.getMonth() + 1;
                
                switch(quarter) {
                    case 'Q1': return month >= 1 && month <= 3;
                    case 'Q2': return month >= 4 && month <= 6;
                    case 'Q3': return month >= 7 && month <= 9;
                    case 'Q4': return month >= 10 && month <= 12;
                    default: return false;
                }
            });'''
    
    # 기존 showQuarterDetails 함수 대체
    html_content = re.sub(
        r'function showQuarterDetails\(quarter\) \{[^}]+const quarterLaws = lawsData\.filter\(law => \{[^}]+\}\);',
        popup_filter_code,
        html_content,
        flags=re.DOTALL
    )
    
    # 5. 직무별 탭에서도 실제 데이터만 표시하도록 수정
    job_filter_code = '''
        function showJobFunctionLaws(category, categoryLabel) {
            const actual2025Laws = filterActual2025Laws();
            const categoryLaws = actual2025Laws.filter(law => 
                law.categories && law.categories.includes(category)
            );'''
    
    html_content = re.sub(
        r'function showJobFunctionLaws\(category, categoryLabel\) \{[^}]+const categoryLaws = lawsData\.filter\(law =>[^}]+\);',
        job_filter_code,
        html_content,
        flags=re.DOTALL
    )
    
    # 파일에 저장
    with open('docs/index.html', 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print("✅ HTML 파일 업데이트 완료!")
    
    return {
        'total_laws': actual_data['total_laws'],
        'implemented': actual_data['implemented'], 
        'upcoming': actual_data['upcoming'],
        'by_quarter': actual_data['by_quarter'],
        'by_category': actual_data['by_category']
    }

if __name__ == "__main__":
    print("🚀 실제 2025년 시행 법령 데이터로 HTML 업데이트 시작...")
    result = update_html_with_actual_data()
    
    print(f"\n📊 업데이트 완료 결과:")
    print(f"  총 2025년 시행 법령: {result['total_laws']}개")
    print(f"  이미 시행: {result['implemented']}개")  
    print(f"  시행 예정: {result['upcoming']}개")
    print(f"  분기별: {result['by_quarter']}")
    print(f"  직무별: {result['by_category']}")
    
    print(f"\n🎉 1번째/2번째 탭이 실제 2025년 데이터로 정확히 업데이트됨!")