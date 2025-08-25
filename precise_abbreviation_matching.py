#!/usr/bin/env python3
import os, sys, json, time, random, re
import urllib.parse, urllib.request
from datetime import datetime
from html import unescape

# 설정
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) law-watch/3.3"
OPENAPI_BASE = "https://www.law.go.kr/DRF/lawSearch.go"
LAW_OC = os.environ.get("LAW_OC", "knowhow1")

def normalize_law_title(title):
    """법령명 정규화 (공백 제거만)"""
    if not title:
        return ""
    
    # 공백만 제거 (다른 문자는 보존)
    normalized = re.sub(r'\s+', '', title.strip())
    return normalized

def load_existing_government_laws():
    """기존 크롤링된 정부 법령 데이터 로드"""
    try:
        with open('docs/crawled_2025_laws.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
            laws = data.get('laws', [])
            
            # 데이터 구조 정규화
            normalized_laws = []
            for law in laws:
                normalized_law = {
                    'title': law['title'],
                    'normalized_title': normalize_law_title(law['title']),
                    'enforcement_date': law.get('effectiveDate', ''),
                    'lsId': law.get('lsId', ''),
                    'ministry': law.get('ministry', ''),
                    'law_type': law.get('lawType', ''),
                    'raw_data': law
                }
                normalized_laws.append(normalized_law)
            
            return normalized_laws
    except FileNotFoundError:
        print("❌ 정부 법령 데이터를 찾을 수 없습니다.")
        return []

def create_abbreviation_mapping():
    """정확한 약칭 매핑 테이블 생성"""
    # 정확히 알려진 약칭들만 포함
    abbreviation_map = {
        # 약칭: 정식명칭 패턴들
        '자본시장법': ['자본시장과 금융투자업에 관한 법률', '자본시장과금융투자업에관한법률'],
        '근로기준법': ['근로기준법'],  # 이미 정식명칭
        '산업안전보건법': ['산업안전보건법'],  # 이미 정식명칭
        '개인정보보호법': ['개인정보 보호법', '개인정보보호법'],
        '환경영향평가법': ['환경영향평가법'],
        '폐기물관리법': ['폐기물관리법'],
        '화학물질관리법': ['화학물질관리법'],
        '대기환경보전법': ['대기환경보전법'],
        '물환경보전법': ['물환경보전법'],
        '토양환경보전법': ['토양환경보전법'],
        '소음진동관리법': ['소음ㆍ진동관리법', '소음·진동관리법'],
        '하수도법': ['하수도법'],
        '수도법': ['수도법'],
        '전기안전관리법': ['전기안전관리법'],
        '도시가스사업법': ['도시가스사업법'],
        '특허법': ['특허법'],
        '실용신안법': ['실용신안법'],
        '상법': ['상법'],
        '법인세법': ['법인세법'],
        '지방세법': ['지방세법'],
        '종합부동산세법': ['종합부동산세법'],
        '증권거래세법': ['증권거래세법'],
        '석면안전관리법': ['석면안전관리법'],
        '원자력안전법': ['원자력안전법'],
        '고용보험법': ['고용보험법'],
        '고용정책기본법': ['고용정책 기본법', '고용정책기본법'],
        '근로복지기본법': ['근로복지기본법'],
        '식품위생법': ['식품위생법'],
    }
    
    return abbreviation_map

def precise_abbreviation_matching(our_title, government_laws, abbreviation_map):
    """정확한 약칭 매칭만 수행"""
    matches = []
    
    # 우리 법령명 정규화
    our_normalized = normalize_law_title(our_title)
    
    # 1. 정확한 제목 매칭 (공백 무시)
    for gov_law in government_laws:
        gov_normalized = gov_law['normalized_title']
        
        if our_normalized == gov_normalized:
            matches.append({
                'type': 'exact_match',
                'confidence': 1.0,
                'government_law': gov_law,
                'match_info': f"정확 매칭: '{our_title}' = '{gov_law['title']}'"
            })
            return matches  # 정확한 매칭이 있으면 바로 반환
    
    # 2. 약칭 매칭 (정확한 약칭 테이블 사용)
    base_title = our_title.replace(' 시행령', '').replace(' 시행규칙', '').replace('시행령', '').replace('시행규칙', '')
    
    if base_title in abbreviation_map:
        possible_full_names = abbreviation_map[base_title]
        
        for gov_law in government_laws:
            gov_base_title = gov_law['title'].replace(' 시행령', '').replace(' 시행규칙', '').replace('시행령', '').replace('시행규칙', '')
            gov_base_normalized = normalize_law_title(gov_base_title)
            
            for full_name in possible_full_names:
                full_name_normalized = normalize_law_title(full_name)
                
                if full_name_normalized == gov_base_normalized:
                    # 시행령/시행규칙도 일치하는지 확인
                    our_suffix = our_title.replace(base_title, '').strip()
                    gov_suffix = gov_law['title'].replace(gov_base_title, '').strip()
                    our_suffix_norm = normalize_law_title(our_suffix)
                    gov_suffix_norm = normalize_law_title(gov_suffix)
                    
                    if our_suffix_norm == gov_suffix_norm:
                        matches.append({
                            'type': 'abbreviation_match',
                            'confidence': 1.0,
                            'government_law': gov_law,
                            'match_info': f"약칭 매칭: '{our_title}' = '{gov_law['title']}' (약칭: {base_title} → {gov_base_title})"
                        })
                        return matches  # 정확한 약칭 매칭이 있으면 바로 반환
    
    # 매칭 없음
    return matches

def perform_precise_abbreviation_matching():
    """정확한 약칭 매칭 수행"""
    
    print("🎯 정확한 약칭 매칭 시작 (100% 정확도만 허용)")
    print("=" * 60)
    
    # 1. 우리 법령 데이터베이스 로드
    try:
        with open('docs/index.json', 'r', encoding='utf-8') as f:
            our_data = json.load(f)
            our_laws = our_data.get('items', [])
    except Exception as e:
        print(f"❌ 우리 법령 데이터 로드 실패: {e}")
        return
    
    print(f"📊 우리 법령 데이터베이스: {len(our_laws)}개")
    
    # 2. 정부 법령 데이터 로드
    government_laws = load_existing_government_laws()
    if not government_laws:
        print("❌ 정부 법령 데이터를 가져올 수 없습니다.")
        return
    
    print(f"📊 정부 법령 데이터: {len(government_laws)}개")
    
    # 3. 약칭 매핑 테이블 생성
    abbreviation_map = create_abbreviation_mapping()
    print(f"📖 약칭 매핑 테이블: {len(abbreviation_map)}개")
    
    # 4. 정확한 매칭 수행
    matched_laws = []
    exact_matches = 0
    abbreviation_matches = 0
    
    for our_law in our_laws:
        our_title = our_law.get('title', '').strip()
        if not our_title:
            continue
        
        print(f"\n🔍 매칭 중: '{our_title}'")
        
        # 정확한 매칭 수행
        matches = precise_abbreviation_matching(our_title, government_laws, abbreviation_map)
        
        if matches:
            best_match = matches[0]  # 첫 번째 매치 (가장 정확한)
            gov_law = best_match['government_law']
            
            # 매칭된 법령 정보 생성
            matched_law = {
                'our_title': our_title,
                'government_title': gov_law['title'],
                'enforcement_date': gov_law['enforcement_date'],
                'match_type': best_match['type'],
                'confidence': best_match['confidence'],
                'quarter': None,  # 나중에 계산
                'job_functions': our_law.get('categories', []),
                'government_data': gov_law,
                'our_data': our_law
            }
            
            # 분기 계산
            if matched_law['enforcement_date']:
                try:
                    month = int(matched_law['enforcement_date'].split('-')[1])
                    matched_law['quarter'] = f"Q{(month - 1) // 3 + 1}"
                except:
                    matched_law['quarter'] = "Unknown"
            
            matched_laws.append(matched_law)
            
            if best_match['type'] == 'exact_match':
                exact_matches += 1
            elif best_match['type'] == 'abbreviation_match':
                abbreviation_matches += 1
            
            print(f"✅ {best_match['match_info']} ({matched_law['quarter']})")
        else:
            print(f"❌ 매칭 실패")
    
    # 5. 결과 정리 및 저장
    print("\n" + "=" * 60)
    print(f"✅ 정확한 약칭 매칭 완료!")
    print(f"📊 총 우리 법령: {len(our_laws)}개")
    print(f"📊 매칭 성공: {len(matched_laws)}개")
    print(f"📊 매칭률: {len(matched_laws)/len(our_laws)*100:.2f}%")
    print(f"📊 정확한 매칭: {exact_matches}개")
    print(f"📊 약칭 매칭: {abbreviation_matches}개")
    
    # 분기별 통계
    by_quarter = {}
    for law in matched_laws:
        quarter = law['quarter']
        by_quarter[quarter] = by_quarter.get(quarter, 0) + 1
    
    print(f"\n📊 분기별 분포: {dict(sorted(by_quarter.items()))}")
    
    # 6. 결과 파일 저장
    result = {
        'generated_at': datetime.now().isoformat(),
        'matching_algorithm': 'precise_abbreviation_matching',
        'total_our_laws': len(our_laws),
        'total_government_laws': len(government_laws),
        'matched_count': len(matched_laws),
        'matching_rate': len(matched_laws)/len(our_laws)*100,
        'exact_matches': exact_matches,
        'abbreviation_matches': abbreviation_matches,
        'statistics': {
            'by_quarter': by_quarter
        },
        'matched_laws': matched_laws,
        'abbreviation_mapping': abbreviation_map
    }
    
    output_file = 'docs/precise_abbreviation_matching_results.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"📁 저장된 파일: {output_file}")
    
    # 7. 매칭 성공 샘플 출력
    print(f"\n📋 매칭 성공 샘플:")
    for i, law in enumerate(matched_laws[:15]):
        print(f"  {i+1}. {law['our_title']} → {law['government_title']}")
        print(f"     시행일: {law['enforcement_date']} ({law['quarter']}) | 유형: {law['match_type']}")
    
    # 8. 자본시장법 매칭 확인
    capital_market_matches = [law for law in matched_laws if '자본시장법' in law['our_title']]
    if capital_market_matches:
        print(f"\n🎯 자본시장법 매칭 결과:")
        for law in capital_market_matches:
            print(f"  ✅ {law['our_title']} → {law['government_title']}")
    else:
        print(f"\n❌ 자본시장법 매칭 실패 - 약칭 테이블 확인 필요")
    
    return result

if __name__ == "__main__":
    perform_precise_abbreviation_matching()