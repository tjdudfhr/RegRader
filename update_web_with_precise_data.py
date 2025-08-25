#!/usr/bin/env python3
import json
import re

def load_precise_matching_data():
    """정확한 매칭 데이터 로드"""
    with open('docs/precise_law_matching.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def update_html_with_precise_data():
    """HTML을 정확한 매칭 데이터로 업데이트"""
    
    # 정확한 매칭 데이터 로드
    precise_data = load_precise_matching_data()
    
    print("🔄 HTML을 정확한 2025년 매칭 데이터로 업데이트...")
    
    # HTML 파일 읽기
    with open('docs/index.html', 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    # 기존 실제 2025년 데이터를 정확한 매칭 데이터로 교체
    new_js_data = f'''
        // 정확한 2025년 매칭 법령 데이터
        const preciseMatchedData = {json.dumps({
            "total_laws": precise_data["matched_count"],
            "implemented": precise_data["implemented_count"], 
            "upcoming": precise_data["upcoming_count"],
            "by_quarter": precise_data["by_quarter_counts"],
            "by_category": precise_data["by_category_counts"],
            "laws": precise_data["matched_laws"],
            "match_percentage": precise_data["match_percentage"]
        }, ensure_ascii=False, indent=8)};
        
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
            const matchedLawTitles = new Set(preciseMatchedData.laws.map(law => law.title));
            return lawsData.filter(law => matchedLawTitles.has(law.title));
        }}
        
        // 정확한 분기별 법령 표시 함수
        function showQuarterDetailsWithPrecise(quarter) {{
            const preciseLaws = preciseMatchedData.laws;
            const quarterLaws = preciseLaws.filter(law => {{
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
    
    # 기존 actual2025Data 관련 코드를 새로운 정확한 데이터로 교체
    pattern = r'// 실제 2025년 시행 법령 데이터.*?return lawsData\.filter\(law => actualLawTitles\.has\(law\.title\)\);'
    replacement = new_js_data.strip()
    
    html_content = re.sub(pattern, replacement, html_content, flags=re.DOTALL)
    
    # loadData 함수에서 호출하는 함수명도 업데이트
    html_content = html_content.replace(
        'updateQuarterlyDataWithActual();',
        'updateQuarterlyDataWithPrecise();'
    )
    html_content = html_content.replace(
        'updateJobFunctionDataWithActual();',
        'updateJobFunctionDataWithPrecise();'  
    )
    html_content = html_content.replace(
        'updateMainDashboardWithActual();',
        'updateMainDashboardWithPrecise();'
    )
    
    # 분기별 팝업에서도 정확한 데이터 사용하도록 수정
    html_content = html_content.replace(
        'const actual2025Laws = filterActual2025Laws();',
        'const preciseLaws = filterPreciseMatchedLaws();'
    )
    html_content = html_content.replace(
        'const quarterLaws = actual2025Laws.filter',
        'const quarterLaws = preciseLaws.filter'
    )
    
    # 직무별 탭에서도 정확한 데이터 사용
    html_content = html_content.replace(
        'const actual2025Laws = filterActual2025Laws();',
        'const preciseLaws = filterPreciseMatchedLaws();'
    )
    html_content = html_content.replace(
        'const categoryLaws = actual2025Laws.filter',
        'const categoryLaws = preciseLaws.filter'
    )
    
    # 파일에 저장
    with open('docs/index.html', 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print("✅ HTML 업데이트 완료!")
    
    return {
        'total_laws': precise_data['matched_count'],
        'implemented': precise_data['implemented_count'],
        'upcoming': precise_data['upcoming_count'],
        'by_quarter': precise_data['by_quarter_counts'],
        'by_category': precise_data['by_category_counts'],
        'match_percentage': precise_data['match_percentage']
    }

def create_quarter_slide_data():
    """분기별 슬라이드용 상세 데이터 생성"""
    
    precise_data = load_precise_matching_data()
    matched_laws = precise_data['matched_laws']
    
    # 분기별로 법령 분류
    quarters = {
        'Q1': {'laws': [], 'months': ['1월', '2월', '3월']},
        'Q2': {'laws': [], 'months': ['4월', '5월', '6월']}, 
        'Q3': {'laws': [], 'months': ['7월', '8월', '9월']},
        'Q4': {'laws': [], 'months': ['10월', '11월', '12월']}
    }
    
    for law in matched_laws:
        eff_date = law.get('effectiveDate', '')
        if len(eff_date) >= 7:
            month = int(eff_date[5:7])
            
            if 1 <= month <= 3:
                quarters['Q1']['laws'].append(law)
            elif 4 <= month <= 6:
                quarters['Q2']['laws'].append(law)
            elif 7 <= month <= 9:
                quarters['Q3']['laws'].append(law)
            elif 10 <= month <= 12:
                quarters['Q4']['laws'].append(law)
    
    # 각 분기별 상세 정보 생성
    quarter_details = {}
    for quarter, data in quarters.items():
        laws = data['laws']
        
        # 카테고리별 분류
        by_category = {}
        for law in laws:
            categories = law.get('categories', ['기타'])
            for category in categories:
                if category not in by_category:
                    by_category[category] = []
                by_category[category].append(law)
        
        # 월별 분류
        by_month = {}
        for law in laws:
            eff_date = law.get('effectiveDate', '')
            if len(eff_date) >= 7:
                month = int(eff_date[5:7])
                month_name = f"{month}월"
                if month_name not in by_month:
                    by_month[month_name] = []
                by_month[month_name].append(law)
        
        quarter_details[quarter] = {
            'total_count': len(laws),
            'by_category': by_category,
            'by_month': by_month,
            'laws': laws
        }
    
    # 저장
    with open('docs/quarter_slide_data.json', 'w', encoding='utf-8') as f:
        json.dump(quarter_details, f, ensure_ascii=False, indent=2)
    
    print(f"📊 분기별 슬라이드 데이터 생성 완료:")
    for quarter, data in quarter_details.items():
        print(f"   {quarter}: {data['total_count']}개 법령")
    
    return quarter_details

def main():
    print("🚀 웹페이지에 정확한 매칭 데이터 반영 시작!")
    print("=" * 60)
    
    # 1. HTML을 정확한 데이터로 업데이트
    result = update_html_with_precise_data()
    
    # 2. 분기별 슬라이드용 상세 데이터 생성
    quarter_data = create_quarter_slide_data()
    
    print("=" * 60)
    print("✅ 정확한 데이터 웹페이지 반영 완료!")
    print(f"📊 매칭 성공: {result['total_laws']}개 법령")
    print(f"📅 분기별: Q1({result['by_quarter'].get('Q1', 0)}), Q2({result['by_quarter'].get('Q2', 0)}), Q3({result['by_quarter'].get('Q3', 0)}), Q4({result['by_quarter'].get('Q4', 0)})")
    print(f"🎯 매칭율: {result['match_percentage']}%")
    print()
    print("📁 생성된 파일:")
    print("   - docs/index.html (업데이트됨)")
    print("   - docs/quarter_slide_data.json (신규)")
    
    return result

if __name__ == "__main__":
    main()