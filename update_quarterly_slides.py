#!/usr/bin/env python3
import re

def update_quarterly_slide_functions():
    """분기별 슬라이드 함수들을 정확한 데이터를 사용하도록 수정"""
    
    with open('docs/index.html', 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    print("🔄 분기별 슬라이드 함수 업데이트 중...")
    
    # 1. showQuarterlyDetail 함수에서 quarterLaws 필터링을 정확한 데이터로 변경
    old_pattern1 = r'// Filter laws for this quarter\s*const quarterLaws = lawsData\.filter\(law => \{\s*if \(!law\.effectiveDate\) return false;\s*const date = new Date\(law\.effectiveDate\);\s*return info\.months\.includes\(date\.getMonth\(\) \+ 1\);\s*\}\);'
    
    new_replacement1 = '''// Filter laws for this quarter using precise data
            const quarterLaws = preciseLawsData.filter(law => {
                if (!law.effectiveDate) return false;
                const date = new Date(law.effectiveDate);
                return info.months.includes(date.getMonth() + 1);
            });'''
    
    html_content = re.sub(old_pattern1, new_replacement1, html_content, flags=re.DOTALL)
    
    # 2. filterQuarterlyLaws 함수도 정확한 데이터 사용하도록 수정
    old_pattern2 = r'// Get all laws for this quarter\s*const quarterLaws = lawsData\.filter\(law => \{\s*if \(!law\.effectiveDate\) return false;\s*const date = new Date\(law\.effectiveDate\);\s*return info\.months\.includes\(date\.getMonth\(\) \+ 1\);\s*\}\);'
    
    new_replacement2 = '''// Get all laws for this quarter using precise data
            const quarterLaws = preciseLawsData.filter(law => {
                if (!law.effectiveDate) return false;
                const date = new Date(law.effectiveDate);
                return info.months.includes(date.getMonth() + 1);
            });'''
    
    html_content = re.sub(old_pattern2, new_replacement2, html_content, flags=re.DOTALL)
    
    # 3. showQuarterlyModal 함수도 정확한 데이터 사용하도록 수정
    old_pattern3 = r'// Filter laws for this quarter\s*const quarterLaws = lawsData\.filter\(law => \{\s*if \(!law\.effectiveDate\) return false;\s*const date = new Date\(law\.effectiveDate\);\s*const month = date\.getMonth\(\) \+ 1;\s*return info\.months\.includes\(month\);\s*\}\)'
    
    new_replacement3 = '''// Filter laws for this quarter using precise data
            const quarterLaws = preciseLawsData.filter(law => {
                if (!law.effectiveDate) return false;
                const date = new Date(law.effectiveDate);
                const month = date.getMonth() + 1;
                return info.months.includes(month);
            })'''
    
    html_content = re.sub(old_pattern3, new_replacement3, html_content, flags=re.DOTALL)
    
    # 파일 저장
    with open('docs/index.html', 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print("✅ 분기별 슬라이드 함수 업데이트 완료!")
    print("   - showQuarterlyDetail: 정확한 데이터 사용")
    print("   - filterQuarterlyLaws: 정확한 데이터 사용") 
    print("   - showQuarterlyModal: 정확한 데이터 사용")
    
    return True

if __name__ == "__main__":
    update_quarterly_slide_functions()