#!/usr/bin/env python3
import json
import re
from datetime import datetime

def normalize_law_title(title):
    """법령명을 정규화"""
    if not title:
        return ""
    
    # 기본 정리
    normalized = title.strip()
    
    # 괄호 안의 추가 정보 제거 (예: "법령명 (개정안)" -> "법령명")
    normalized = re.sub(r'\s*\([^)]*\)\s*$', '', normalized)
    
    # 연속된 공백 정리
    normalized = re.sub(r'\s+', ' ', normalized)
    
    return normalized.strip()

def exact_title_matching():
    """100% 정확한 법령명 매칭"""
    
    print("🎯 100% 정확한 법령명 매칭 시작!")
    print("=" * 60)
    
    # 1. 우리 212개 법령 데이터 로드
    print("📋 212개 법령 데이터 로딩...")
    with open('docs/index.json', 'r', encoding='utf-8') as f:
        our_data = json.load(f)
    
    our_laws = our_data.get('items', [])
    print(f"✅ 우리 법령: {len(our_laws)}개")
    
    # 2. 정부 크롤링된 2025년 시행 법령 로드
    print("🏛️ 정부 2025년 시행 법령 데이터 로딩...")
    with open('docs/crawled_2025_laws.json', 'r', encoding='utf-8') as f:
        gov_data = json.load(f)
    
    gov_laws = gov_data.get('laws', [])
    print(f"✅ 정부 법령: {len(gov_laws)}개")
    
    # 3. 정부 법령을 제목으로 인덱싱 (정확한 매칭을 위해)
    print("🔍 정부 법령 인덱싱...")
    gov_law_index = {}
    
    for gov_law in gov_laws:
        title = normalize_law_title(gov_law.get('title', ''))
        if title:
            # 동일한 제목이 여러 개 있을 수 있으므로 리스트로 저장
            if title not in gov_law_index:
                gov_law_index[title] = []
            gov_law_index[title].append(gov_law)
    
    print(f"✅ {len(gov_law_index)}개 고유 법령명으로 인덱싱 완료")
    
    # 4. 정확한 매칭 수행
    print("\n🔍 100% 정확한 법령명 매칭 수행...")
    
    exact_matches = []
    no_matches = []
    multiple_matches = []
    
    for our_law in our_laws:
        our_title = normalize_law_title(our_law.get('title', ''))
        
        if not our_title:
            continue
        
        # 100% 정확한 제목 매칭
        if our_title in gov_law_index:
            gov_matches = gov_law_index[our_title]
            
            if len(gov_matches) == 1:
                # 단일 매칭
                gov_law = gov_matches[0]
                
                # 우리 법령에 정부 시행일 정보 추가
                matched_law = our_law.copy()
                matched_law.update({
                    'government_enforcement_date': gov_law.get('effectiveDate'),
                    'government_lsId': gov_law.get('lsId'),
                    'government_ministry': gov_law.get('ministry'),
                    'government_law_type': gov_law.get('lawType'),
                    'match_type': 'exact_single',
                    'match_confidence': 1.0
                })
                
                exact_matches.append(matched_law)
                print(f"✅ 정확 매칭: {our_title} → 시행일: {gov_law.get('effectiveDate')}")
                
            else:
                # 다중 매칭 (동일한 제목의 여러 법령)
                print(f"⚠️ 다중 매칭: {our_title} ({len(gov_matches)}개)")
                
                # 가장 최근 시행일의 법령 선택
                latest_gov_law = max(gov_matches, key=lambda x: x.get('effectiveDate', ''))
                
                matched_law = our_law.copy()
                matched_law.update({
                    'government_enforcement_date': latest_gov_law.get('effectiveDate'),
                    'government_lsId': latest_gov_law.get('lsId'),
                    'government_ministry': latest_gov_law.get('ministry'),
                    'government_law_type': latest_gov_law.get('lawType'),
                    'match_type': 'exact_multiple_latest',
                    'match_confidence': 1.0,
                    'alternative_matches': len(gov_matches)
                })
                
                multiple_matches.append(matched_law)
        else:
            # 매칭 안됨
            no_matches.append(our_law)
            print(f"❌ 매칭 실패: {our_title}")
    
    # 5. 결과 분석
    total_exact = len(exact_matches) + len(multiple_matches)
    
    print("\n" + "=" * 60)
    print("📊 100% 정확한 매칭 결과:")
    print(f"   단일 정확 매칭: {len(exact_matches)}개")
    print(f"   다중 정확 매칭: {len(multiple_matches)}개")
    print(f"   총 정확 매칭: {total_exact}개")
    print(f"   매칭 실패: {len(no_matches)}개")
    print(f"   매칭 성공률: {total_exact/len(our_laws)*100:.2f}%")
    
    # 6. 분기별 분석
    print("\n📅 분기별 시행일 분석:")
    quarterly_stats = {'Q1': 0, 'Q2': 0, 'Q3': 0, 'Q4': 0}
    
    all_matched = exact_matches + multiple_matches
    
    for law in all_matched:
        enforcement_date = law.get('government_enforcement_date', '')
        if len(enforcement_date) >= 7:  # YYYY-MM-DD 형식 확인
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
    
    for law in all_matched:
        categories = law.get('categories', [])
        for category in categories:
            job_function_stats[category] = job_function_stats.get(category, 0) + 1
    
    # 내림차순 정렬
    sorted_categories = sorted(job_function_stats.items(), key=lambda x: x[1], reverse=True)
    for category, count in sorted_categories:
        print(f"   {category}: {count}개")
    
    # 8. 결과 저장
    result = {
        'matched_at': datetime.now().isoformat(),
        'matching_method': '100%_exact_title_matching',
        'our_total_laws': len(our_laws),
        'government_total_laws': len(gov_laws),
        'exact_single_matches': len(exact_matches),
        'exact_multiple_matches': len(multiple_matches),
        'total_matches': total_exact,
        'no_matches': len(no_matches),
        'match_success_rate': round(total_exact/len(our_laws)*100, 2),
        'quarterly_distribution': quarterly_stats,
        'job_function_distribution': dict(sorted_categories),
        'matched_laws': all_matched,
        'unmatched_laws': [{'title': law.get('title', ''), 'id': law.get('id', '')} for law in no_matches]
    }
    
    # 파일 저장
    output_file = 'docs/exact_title_matching_result.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"\n📁 결과 저장: {output_file}")
    
    return result

if __name__ == "__main__":
    exact_title_matching()