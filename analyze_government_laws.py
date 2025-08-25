#!/usr/bin/env python3
import json
import re
from collections import Counter

def analyze_government_law_titles():
    """정부 크롤링된 법령명들을 분석해서 패턴 파악"""
    
    print("🔍 정부 크롤링된 2025년 법령명 분석 시작!")
    print("=" * 60)
    
    # 정부 크롤링된 데이터 로드
    with open('docs/crawled_2025_laws.json', 'r', encoding='utf-8') as f:
        gov_data = json.load(f)
    
    gov_laws = gov_data.get('laws', [])
    print(f"📊 분석 대상: {len(gov_laws)}개 법령")
    
    # 법령명 추출 및 분석
    all_titles = []
    for law in gov_laws:
        title = law.get('title', '').strip()
        if title:
            all_titles.append(title)
    
    print(f"✅ 유효한 법령명: {len(all_titles)}개")
    
    # 1. 우리가 찾는 법령들과 유사한 것들 찾기
    print("\n🎯 우리 212개 법령과 관련된 정부 법령 찾기...")
    
    # 우리 법령 로드
    with open('docs/index.json', 'r', encoding='utf-8') as f:
        our_data = json.load(f)
    our_laws = our_data.get('items', [])
    
    # 우리 법령명에서 키워드 추출
    our_keywords = set()
    for our_law in our_laws:
        title = our_law.get('title', '').strip()
        if title:
            # 기본 키워드 추출 (시행령, 시행규칙 제거)
            base_title = re.sub(r'\s*(시행령|시행규칙)$', '', title)
            base_title = re.sub(r'법$', '', base_title)  # 법도 제거
            
            # 띄어쓰기로 분리된 키워드들
            words = base_title.split()
            for word in words:
                if len(word) >= 2:  # 2글자 이상만
                    our_keywords.add(word)
    
    print(f"📋 추출된 키워드: {len(our_keywords)}개")
    
    # 2. 정부 법령 중에서 우리 키워드와 매칭되는 것들 찾기
    related_gov_laws = []
    
    for gov_law in gov_laws:
        gov_title = gov_law.get('title', '').strip()
        
        # 우리 키워드와 매칭되는지 확인
        for keyword in our_keywords:
            if keyword in gov_title:
                related_gov_laws.append({
                    'title': gov_title,
                    'enforcement_date': gov_law.get('effectiveDate', ''),
                    'lsId': gov_law.get('lsId', ''),
                    'matched_keyword': keyword
                })
                break
    
    print(f"✅ 우리 키워드와 관련된 정부 법령: {len(related_gov_laws)}개")
    
    # 3. 관련 법령들을 키워드별로 그룹화
    keyword_groups = {}
    for law in related_gov_laws:
        keyword = law['matched_keyword']
        if keyword not in keyword_groups:
            keyword_groups[keyword] = []
        keyword_groups[keyword].append(law)
    
    # 4. 각 그룹별로 분석
    print("\n📋 키워드별 정부 법령 분석:")
    
    for keyword, laws in sorted(keyword_groups.items()):
        print(f"\n🔑 키워드: '{keyword}' ({len(laws)}개)")
        
        # 해당 키워드와 관련된 우리 법령들 찾기
        our_related = []
        for our_law in our_laws:
            if keyword in our_law.get('title', ''):
                our_related.append(our_law.get('title', ''))
        
        print(f"   우리 법령 ({len(our_related)}개):")
        for our_title in sorted(our_related):
            print(f"     - {our_title}")
        
        print(f"   정부 법령 ({len(laws)}개):")
        for law in sorted(laws, key=lambda x: x['title']):
            print(f"     - {law['title']} (시행: {law['enforcement_date']})")
    
    # 5. 매칭 가능성 분석
    print("\n🎯 100% 정확한 매칭 가능한 법령들:")
    
    exact_possible_matches = []
    
    for our_law in our_laws:
        our_title = our_law.get('title', '').strip()
        
        # 정부 법령에서 정확히 일치하는 것 찾기
        for gov_law in gov_laws:
            gov_title = gov_law.get('title', '').strip()
            
            if our_title == gov_title:
                exact_possible_matches.append({
                    'our_title': our_title,
                    'gov_title': gov_title,
                    'enforcement_date': gov_law.get('effectiveDate', ''),
                    'lsId': gov_law.get('lsId', ''),
                    'our_law': our_law
                })
    
    print(f"✅ 100% 정확 매칭 가능: {len(exact_possible_matches)}개")
    
    for match in exact_possible_matches:
        print(f"   - {match['our_title']} (시행: {match['enforcement_date']})")
    
    # 6. 결과 저장
    analysis_result = {
        'analyzed_at': '2025-08-25',
        'government_total_laws': len(gov_laws),
        'our_total_laws': len(our_laws),
        'related_government_laws': len(related_gov_laws),
        'exact_matches_possible': len(exact_possible_matches),
        'keyword_groups': {k: len(v) for k, v in keyword_groups.items()},
        'exact_matches': exact_possible_matches,
        'keyword_analysis': keyword_groups
    }
    
    with open('docs/government_law_analysis.json', 'w', encoding='utf-8') as f:
        json.dump(analysis_result, f, ensure_ascii=False, indent=2)
    
    print(f"\n📁 분석 결과 저장: docs/government_law_analysis.json")
    
    return analysis_result

if __name__ == "__main__":
    analyze_government_law_titles()