#!/usr/bin/env python3
import json
import re
from datetime import datetime

def normalize_law_title_enhanced(title):
    """법령명을 향상된 방법으로 정규화"""
    if not title:
        return ""
    
    # 기본 정리
    normalized = title.strip()
    
    # 띄어쓰기 정규화 (일관성을 위해)
    # "법 시행령" -> "법시행령", "법 시행규칙" -> "법시행규칙" 등
    normalized = re.sub(r'(\S)\s+(시행령|시행규칙)', r'\1\2', normalized)
    
    # 반대로 붙어있는 것을 띄우기도 시도
    # "법시행령" -> "법 시행령"
    alt_normalized = re.sub(r'(\S)(시행령|시행규칙)', r'\1 \2', normalized)
    
    # 괄호 안의 추가 정보 제거
    normalized = re.sub(r'\s*\([^)]*\)\s*$', '', normalized)
    alt_normalized = re.sub(r'\s*\([^)]*\)\s*$', '', alt_normalized)
    
    # 연속된 공백 정리
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    alt_normalized = re.sub(r'\s+', ' ', alt_normalized).strip()
    
    return [normalized, alt_normalized] if normalized != alt_normalized else [normalized]

def enhanced_exact_matching():
    """향상된 정확한 법령명 매칭"""
    
    print("🎯 향상된 정확한 법령명 매칭 시작!")
    print("=" * 60)
    
    # 1. 우리 212개 법령 데이터 로드
    with open('docs/index.json', 'r', encoding='utf-8') as f:
        our_data = json.load(f)
    our_laws = our_data.get('items', [])
    
    # 2. 정부 크롤링된 2025년 시행 법령 로드
    with open('docs/crawled_2025_laws.json', 'r', encoding='utf-8') as f:
        gov_data = json.load(f)
    gov_laws = gov_data.get('laws', [])
    
    print(f"📋 우리 법령: {len(our_laws)}개")
    print(f"🏛️ 정부 법령: {len(gov_laws)}개")
    
    # 3. 정부 법령을 향상된 방법으로 인덱싱
    print("🔍 정부 법령 향상된 인덱싱...")
    gov_law_index = {}
    
    for gov_law in gov_laws:
        title = gov_law.get('title', '').strip()
        if not title:
            continue
        
        # 여러 정규화 버전 생성
        normalized_versions = normalize_law_title_enhanced(title)
        
        for normalized in normalized_versions:
            if normalized not in gov_law_index:
                gov_law_index[normalized] = []
            gov_law_index[normalized].append(gov_law)
    
    print(f"✅ {len(gov_law_index)}개 정규화된 법령명으로 인덱싱 완료")
    
    # 4. 향상된 매칭 수행
    print("\n🔍 향상된 정확한 매칭 수행...")
    
    exact_matches = []
    no_matches = []
    
    for our_law in our_laws:
        our_title = our_law.get('title', '').strip()
        
        if not our_title:
            continue
        
        # 우리 법령도 여러 정규화 버전 생성
        our_normalized_versions = normalize_law_title_enhanced(our_title)
        
        matched = False
        
        for our_normalized in our_normalized_versions:
            if our_normalized in gov_law_index:
                gov_matches = gov_law_index[our_normalized]
                
                # 가장 최근 시행일의 법령 선택
                best_match = max(gov_matches, key=lambda x: x.get('effectiveDate', ''))
                
                # 우리 법령에 정부 시행일 정보 추가
                matched_law = our_law.copy()
                matched_law.update({
                    'government_enforcement_date': best_match.get('effectiveDate'),
                    'government_lsId': best_match.get('lsId'),
                    'government_ministry': best_match.get('ministry'),
                    'government_law_type': best_match.get('lawType'),
                    'government_title': best_match.get('title'),
                    'match_type': 'enhanced_exact',
                    'match_confidence': 1.0,
                    'matched_version': our_normalized,
                    'original_title': our_title
                })
                
                exact_matches.append(matched_law)
                print(f"✅ 향상된 매칭: {our_title}")
                print(f"   → {best_match.get('title')} (시행: {best_match.get('effectiveDate')})")
                
                matched = True
                break
        
        if not matched:
            no_matches.append(our_law)
            print(f"❌ 매칭 실패: {our_title}")
    
    # 5. 결과 분석
    print("\n" + "=" * 60)
    print("📊 향상된 정확한 매칭 결과:")
    print(f"   총 정확 매칭: {len(exact_matches)}개")
    print(f"   매칭 실패: {len(no_matches)}개")
    print(f"   매칭 성공률: {len(exact_matches)/len(our_laws)*100:.2f}%")
    
    # 6. 분기별 분석
    print("\n📅 분기별 시행일 분석:")
    quarterly_stats = {'Q1': 0, 'Q2': 0, 'Q3': 0, 'Q4': 0}
    
    for law in exact_matches:
        enforcement_date = law.get('government_enforcement_date', '')
        if len(enforcement_date) >= 7:
            try:
                month = int(enforcement_date[5:7])
                if 1 <= month <= 3:
                    quarterly_stats['Q1'] += 1
                elif 4 <= month <= 6:
                    quarterly_stats['Q2'] += 1
                elif 7 <= month <= 9:
                    quarterly_stats['Q3'] += 1
                elif 10 <= month <= 12:
                    quarterly_stats['Q4'] += 1
            except (ValueError, IndexError):
                pass
    
    for quarter, count in quarterly_stats.items():
        print(f"   {quarter}: {count}개")
    
    # 7. 직무별 분석
    print("\n👥 직무별 분석:")
    job_function_stats = {}
    
    for law in exact_matches:
        categories = law.get('categories', [])
        for category in categories:
            job_function_stats[category] = job_function_stats.get(category, 0) + 1
    
    sorted_categories = sorted(job_function_stats.items(), key=lambda x: x[1], reverse=True)
    for category, count in sorted_categories:
        print(f"   {category}: {count}개")
    
    # 8. 매칭되지 않은 법령 분석
    print("\n❌ 매칭되지 않은 법령 샘플 (처음 10개):")
    for i, law in enumerate(no_matches[:10]):
        print(f"   {i+1}. {law.get('title', '')}")
    
    # 9. 결과 저장
    result = {
        'matched_at': datetime.now().isoformat(),
        'matching_method': 'enhanced_exact_title_matching',
        'our_total_laws': len(our_laws),
        'government_total_laws': len(gov_laws),
        'total_matches': len(exact_matches),
        'no_matches': len(no_matches),
        'match_success_rate': round(len(exact_matches)/len(our_laws)*100, 2),
        'quarterly_distribution': quarterly_stats,
        'job_function_distribution': dict(sorted_categories),
        'matched_laws': exact_matches,
        'unmatched_laws': [{'title': law.get('title', ''), 'id': law.get('id', '')} for law in no_matches]
    }
    
    # 파일 저장
    output_file = 'docs/enhanced_exact_matching_result.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"\n📁 결과 저장: {output_file}")
    
    return result

if __name__ == "__main__":
    enhanced_exact_matching()