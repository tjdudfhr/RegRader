#!/usr/bin/env python3
import json
import re
from difflib import SequenceMatcher
from datetime import datetime

def load_our_212_laws():
    """우리가 분류한 212개 법령 로드"""
    with open('docs/index.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data['items']

def load_crawled_2025_laws():
    """크롤링된 실제 2025년 시행 법령 로드"""
    with open('docs/crawled_2025_laws.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data['laws']

def normalize_law_title(title):
    """법령명 정규화 (매칭을 위한 전처리)"""
    if not title:
        return ""
    
    # 공백 제거
    normalized = re.sub(r'\s+', '', title)
    
    # 특수문자 정리
    normalized = re.sub(r'[()（）\[\]【】]', '', normalized)
    
    # 한자 괄호 제거 (예: 法律 -> 법률)
    normalized = re.sub(r'\([^)]*\)', '', normalized)
    
    # 소문자로 변환
    normalized = normalized.lower()
    
    return normalized

def similarity_score(str1, str2):
    """두 문자열 간의 유사도 점수 계산 (0.0 ~ 1.0)"""
    return SequenceMatcher(None, str1, str2).ratio()

def extract_base_law_name(title):
    """기본 법령명 추출 (시행령, 시행규칙 등 제거)"""
    # 시행령, 시행규칙 등 제거
    base = re.sub(r'(시행령|시행규칙|시행세칙|시행규정)$', '', title)
    base = re.sub(r'(의시행에관한|에관한|관련).*', '', base)
    return base.strip()

def match_laws_precisely(our_laws, crawled_laws):
    """정확한 법령 매칭"""
    
    print("🔍 212개 법령과 실제 2025년 시행 법령 정확한 매칭 시작...")
    
    matched_laws = []
    unmatched_our_laws = []
    matching_stats = {
        "exact_matches": 0,
        "fuzzy_matches": 0,
        "base_name_matches": 0,
        "no_matches": 0
    }
    
    for our_law in our_laws:
        our_title = our_law.get('title', '')
        our_normalized = normalize_law_title(our_title)
        our_base_name = extract_base_law_name(our_title)
        
        best_match = None
        best_score = 0.0
        match_type = "no_match"
        
        for crawled_law in crawled_laws:
            crawled_title = crawled_law.get('title', '')
            crawled_normalized = normalize_law_title(crawled_title)
            
            # 1. 정확한 매칭 시도
            if our_normalized == crawled_normalized:
                best_match = crawled_law
                best_score = 1.0
                match_type = "exact"
                break
            
            # 2. 기본 법령명 매칭 시도 (시행령, 시행규칙 무시)
            crawled_base = extract_base_law_name(crawled_title)
            our_base_normalized = normalize_law_title(our_base_name)
            crawled_base_normalized = normalize_law_title(crawled_base)
            
            if our_base_normalized == crawled_base_normalized and len(our_base_normalized) > 3:
                score = 0.9  # 기본명 매칭은 0.9점
                if score > best_score:
                    best_match = crawled_law
                    best_score = score
                    match_type = "base_name"
            
            # 3. 유사도 기반 매칭 (최소 75% 이상)
            similarity = similarity_score(our_normalized, crawled_normalized)
            if similarity >= 0.75 and similarity > best_score:
                best_match = crawled_law
                best_score = similarity
                match_type = "fuzzy"
        
        # 매칭 결과 처리
        if best_match and best_score >= 0.75:
            # 우리 법령 정보를 기본으로 하고, 실제 시행일자 업데이트
            matched_law = our_law.copy()
            matched_law['effectiveDate'] = best_match['effectiveDate']
            matched_law['actual_title'] = best_match['title']
            matched_law['match_score'] = best_score
            matched_law['match_type'] = match_type
            matched_law['government_lsId'] = best_match.get('lsId', '')
            matched_law['government_ministry'] = best_match.get('ministry', '')
            
            matched_laws.append(matched_law)
            
            # 통계 업데이트
            if match_type == "exact":
                matching_stats["exact_matches"] += 1
            elif match_type == "base_name":
                matching_stats["base_name_matches"] += 1
            else:
                matching_stats["fuzzy_matches"] += 1
            
            print(f"✅ 매칭: {our_title[:30]}... -> {best_match['title'][:30]}... (점수: {best_score:.3f}, 타입: {match_type})")
        
        else:
            unmatched_our_laws.append(our_law)
            matching_stats["no_matches"] += 1
            print(f"❌ 미매칭: {our_title}")
    
    return matched_laws, unmatched_our_laws, matching_stats

def categorize_matched_laws(matched_laws):
    """매칭된 법령들을 카테고리별로 분류"""
    
    # 직무별 분류
    by_category = {}
    for law in matched_laws:
        categories = law.get('categories', ['기타'])
        for category in categories:
            if category not in by_category:
                by_category[category] = []
            by_category[category].append(law)
    
    # 분기별 분류
    by_quarter = {"Q1": [], "Q2": [], "Q3": [], "Q4": []}
    for law in matched_laws:
        eff_date = law.get('effectiveDate', '')
        if len(eff_date) >= 7:
            month = int(eff_date[5:7])
            if 1 <= month <= 3:
                by_quarter["Q1"].append(law)
            elif 4 <= month <= 6:
                by_quarter["Q2"].append(law)
            elif 7 <= month <= 9:
                by_quarter["Q3"].append(law)
            elif 10 <= month <= 12:
                by_quarter["Q4"].append(law)
    
    # 시행 상태별 분류 (현재 날짜 기준)
    from datetime import date
    today = date.today()
    
    implemented = []  # 이미 시행
    upcoming = []     # 시행 예정
    
    for law in matched_laws:
        eff_date_str = law.get('effectiveDate', '')
        if eff_date_str:
            try:
                eff_date = datetime.strptime(eff_date_str, '%Y-%m-%d').date()
                if eff_date <= today:
                    implemented.append(law)
                else:
                    upcoming.append(law)
            except:
                pass
    
    return {
        'by_category': by_category,
        'by_quarter': by_quarter,
        'implemented': implemented,
        'upcoming': upcoming
    }

def save_matching_results(matched_laws, unmatched_laws, matching_stats, classifications):
    """매칭 결과 저장"""
    
    result = {
        "matched_at": datetime.now().isoformat(),
        "total_our_laws": len(matched_laws) + len(unmatched_laws),
        "matched_count": len(matched_laws),
        "unmatched_count": len(unmatched_laws),
        "matching_stats": matching_stats,
        "match_percentage": round((len(matched_laws) / (len(matched_laws) + len(unmatched_laws))) * 100, 2),
        
        # 분류 결과
        "by_category_counts": {cat: len(laws) for cat, laws in classifications['by_category'].items()},
        "by_quarter_counts": {q: len(laws) for q, laws in classifications['by_quarter'].items()},
        "implemented_count": len(classifications['implemented']),
        "upcoming_count": len(classifications['upcoming']),
        
        # 실제 법령 데이터
        "matched_laws": matched_laws,
        "unmatched_laws": unmatched_laws,
        "classifications": classifications
    }
    
    # 저장
    with open('docs/precise_law_matching.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    # 결과 출력
    print("\n" + "="*60)
    print("📊 정확한 법령 매칭 결과")
    print("="*60)
    print(f"🎯 전체 법령: {result['total_our_laws']}개")
    print(f"✅ 매칭 성공: {result['matched_count']}개 ({result['match_percentage']}%)")
    print(f"❌ 매칭 실패: {result['unmatched_count']}개")
    print()
    print("📈 매칭 방식별 통계:")
    for match_type, count in matching_stats.items():
        print(f"   {match_type}: {count}개")
    print()
    print("📅 분기별 분포 (매칭된 법령):")
    for quarter, count in result['by_quarter_counts'].items():
        print(f"   {quarter}: {count}개")
    print()
    print("👥 직무별 분포 (매칭된 법령):")
    for category, count in sorted(result['by_category_counts'].items()):
        print(f"   {category}: {count}개")
    print()
    print(f"📊 시행 상태:")
    print(f"   이미 시행: {result['implemented_count']}개")
    print(f"   시행 예정: {result['upcoming_count']}개")
    print()
    print(f"💾 결과 저장: docs/precise_law_matching.json")
    
    return result

def main():
    print("🚀 정확한 법령 매칭 프로세스 시작!")
    
    # 1. 데이터 로드
    our_laws = load_our_212_laws()
    crawled_laws = load_crawled_2025_laws()
    
    print(f"📋 우리 법령: {len(our_laws)}개")
    print(f"🏛️ 크롤링된 2025년 시행 법령: {len(crawled_laws)}개")
    print()
    
    # 2. 정확한 매칭
    matched_laws, unmatched_laws, matching_stats = match_laws_precisely(our_laws, crawled_laws)
    
    # 3. 분류
    classifications = categorize_matched_laws(matched_laws)
    
    # 4. 결과 저장
    result = save_matching_results(matched_laws, unmatched_laws, matching_stats, classifications)
    
    return result

if __name__ == "__main__":
    main()