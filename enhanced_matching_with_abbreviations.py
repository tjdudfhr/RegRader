#!/usr/bin/env python3
import os, sys, json, time, random, re
import urllib.parse, urllib.request
from datetime import datetime
from html import unescape

# 설정
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) law-watch/3.3"
OPENAPI_BASE = "https://www.law.go.kr/DRF/lawSearch.do"
LAW_DETAIL_BASE = "https://www.law.go.kr/DRF/lawService.do"
LAW_OC = os.environ.get("LAW_OC", "knowhow1")

def http_get(url, timeout=45, headers=None, retries=3, backoff=2.0):
    """HTTP GET 요청"""
    last = None
    hdr = {"User-Agent": UA, "Accept": "*/*"}
    if headers: hdr.update(headers)
    
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=hdr)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:
            last = e
            sleep = (backoff ** i) + random.uniform(0, 0.6)
            print(f"[WARN] GET 실패 ({i+1}/{retries}) {url[:80]}... -> {e}; 재시도 {sleep:.1f}초 후", file=sys.stderr)
            time.sleep(sleep)
    
    print(f"[ERROR] GET 최종 실패: {url[:80]}... -> {last}", file=sys.stderr)
    return None

def yyyymmdd_to_iso(s):
    """YYYYMMDD 형식을 YYYY-MM-DD로 변환"""
    if not s: return None
    s = str(s)
    m = re.search(r"(\d{4})(\d{2})(\d{2})", s)
    if not m: return None
    y, mm, dd = map(int, m.groups())
    return f"{y:04d}-{mm:02d}-{dd:02d}"

def normalize_law_title(title):
    """법령명 정규화 (공백 제거, 특수문자 정리)"""
    if not title:
        return ""
    
    # 공백 제거
    normalized = re.sub(r'\s+', '', title.strip())
    
    # 특수 문자 정리
    normalized = re.sub(r'[^가-힣a-zA-Z0-9()「」『』·]', '', normalized)
    
    return normalized

def extract_laws_from_json(data):
    """기존 성공한 JSON 파싱 방식을 사용하여 법령 추출"""
    laws = []
    
    if isinstance(data, dict) and 'LawSearch' in data:
        law_list = data['LawSearch']
        
        if isinstance(law_list, dict):
            for key, value in law_list.items():
                if isinstance(value, list) and len(value) > 0:
                    law_list = value
                    break
        
        if not isinstance(law_list, list):
            return laws
        
        print(f"📋 {len(law_list)}개 법령 항목 발견")
        
        for item in law_list:
            if not isinstance(item, dict):
                continue
            
            # 시행일 확인
            enforcement_date = None
            if '시행일자' in item and item['시행일자']:
                date_str = str(item['시행일자'])
                if '2025' in date_str:
                    enforcement_date = yyyymmdd_to_iso(date_str) or date_str
            
            # 2025년 시행이 아니면 제외
            if not enforcement_date or '2025' not in enforcement_date:
                continue
            
            # 법령명 추출
            title = item.get('법령명', '').strip()
            if not title:
                continue
            
            # 정규화된 법령 정보
            law_info = {
                'title': title,
                'normalized_title': normalize_law_title(title),
                'enforcement_date': enforcement_date,
                'lsId': item.get('법령일련번호', ''),
                'promulgation_date': yyyymmdd_to_iso(item.get('공포일자', '')),
                'ministry': item.get('소관부처', ''),
                'law_type': item.get('법종구분', ''),
                'raw_data': item
            }
            
            laws.append(law_info)
            
    print(f"✅ {len(laws)}개 2025년 시행 법령 추출 완료")
    return laws

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
        print("❌ 기존 정부 법령 데이터를 찾을 수 없습니다. 새로 크롤링합니다.")
        return None

def crawl_government_laws_if_needed():
    """필요시 정부 법령 데이터 크롤링"""
    existing_laws = load_existing_government_laws()
    
    if existing_laws and len(existing_laws) > 1000:
        print(f"✅ 기존 정부 법령 데이터 사용: {len(existing_laws)}개")
        return existing_laws
    
    print("🔍 새로운 정부 법령 데이터 크롤링 시작...")
    
    # 2025년 전체 기간
    start_date = "20250101"
    end_date = "20251231"
    
    all_laws = []
    
    # 여러 페이지에서 데이터 수집
    for page in range(1, 20):  # 최대 20페이지까지
        print(f"📄 페이지 {page} 크롤링 중...")
        
        params = {
            "OC": LAW_OC,
            "target": "eflaw",  # 시행법령
            "type": "JSON",
            "display": "100",   # 페이지당 100개
            "page": str(page),
            "efYd": f"{start_date}~{end_date}",  # 시행일자 범위
            "sort": "efdes",    # 시행일자 내림차순
        }
        
        url = OPENAPI_BASE + "?" + urllib.parse.urlencode(params, safe="~:")
        
        raw = http_get(url)
        if not raw:
            print(f"❌ 페이지 {page} 데이터 로드 실패")
            break
            
        try:
            data = json.loads(raw.decode("utf-8", "ignore"))
        except Exception as e:
            print(f"❌ 페이지 {page} JSON 파싱 실패: {e}")
            break
        
        # 법령 데이터 추출
        page_laws = extract_laws_from_json(data)
        
        if not page_laws:
            print(f"📄 페이지 {page}에서 법령 데이터 없음, 크롤링 종료")
            break
            
        all_laws.extend(page_laws)
        print(f"✅ 페이지 {page}: {len(page_laws)}개 법령 수집 (총 {len(all_laws)}개)")
        
        # API 부하 방지
        time.sleep(1)
    
    return all_laws

def enhanced_title_matching(our_title, government_laws):
    """향상된 법령명 매칭 (공백 무시, 약칭 처리)"""
    matches = []
    
    # 우리 법령명 정규화
    our_normalized = normalize_law_title(our_title)
    
    for gov_law in government_laws:
        gov_title = gov_law['title']
        gov_normalized = gov_law['normalized_title']
        
        # 1. 정확한 매칭 (공백 무시)
        if our_normalized == gov_normalized:
            matches.append({
                'type': 'exact_normalized',
                'confidence': 1.0,
                'government_law': gov_law,
                'match_info': f"정확 매칭: '{our_title}' = '{gov_title}'"
            })
            continue
        
        # 2. 포함 관계 매칭 (우리가 약칭일 가능성)
        if our_normalized in gov_normalized or gov_normalized in our_normalized:
            # 길이 차이가 너무 크면 제외 (오매칭 방지)
            if abs(len(our_normalized) - len(gov_normalized)) <= len(our_normalized) * 0.7:
                confidence = min(len(our_normalized), len(gov_normalized)) / max(len(our_normalized), len(gov_normalized))
                matches.append({
                    'type': 'partial_match',
                    'confidence': confidence,
                    'government_law': gov_law,
                    'match_info': f"부분 매칭: '{our_title}' ↔ '{gov_title}' (신뢰도: {confidence:.3f})"
                })
        
        # 3. 키워드 기반 매칭 (더 안전한 접근)
        # 우리 제목의 주요 키워드들이 모두 정부 제목에 포함되는지 확인
        our_keywords = [word for word in re.findall(r'[가-힣]{2,}', our_normalized) if len(word) >= 2]
        if len(our_keywords) >= 2:  # 최소 2개 키워드
            matching_keywords = [kw for kw in our_keywords if kw in gov_normalized]
            if len(matching_keywords) == len(our_keywords) and len(matching_keywords) >= 2:
                confidence = 0.8 * len(matching_keywords) / len(our_keywords)
                matches.append({
                    'type': 'keyword_match',
                    'confidence': confidence,
                    'government_law': gov_law,
                    'match_info': f"키워드 매칭: '{our_title}' ↔ '{gov_title}' (키워드: {matching_keywords})"
                })
    
    # 신뢰도 순으로 정렬
    matches.sort(key=lambda x: x['confidence'], reverse=True)
    
    return matches

def perform_enhanced_matching():
    """향상된 매칭 수행"""
    
    print("🚀 향상된 법령 매칭 시작!")
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
    
    # 2. 정부 법령 데이터 로드/크롤링
    government_laws = crawl_government_laws_if_needed()
    if not government_laws:
        print("❌ 정부 법령 데이터를 가져올 수 없습니다.")
        return
    
    print(f"📊 정부 법령 데이터: {len(government_laws)}개")
    
    # 3. 향상된 매칭 수행
    matched_laws = []
    match_details = []
    
    for our_law in our_laws:
        our_title = our_law.get('title', '').strip()
        if not our_title:
            continue
        
        print(f"\n🔍 매칭 중: '{our_title}'")
        
        # 향상된 매칭 수행
        matches = enhanced_title_matching(our_title, government_laws)
        
        if matches:
            best_match = matches[0]  # 가장 높은 신뢰도 매치
            
            if best_match['confidence'] >= 0.7:  # 신뢰도 70% 이상만 채택
                gov_law = best_match['government_law']
                
                # 매칭된 법령 정보 생성
                matched_law = {
                    'our_title': our_title,
                    'government_title': gov_law['title'],
                    'enforcement_date': gov_law['enforcement_date'],
                    'match_type': best_match['type'],
                    'confidence': best_match['confidence'],
                    'quarter': None,  # 나중에 계산
                    'job_functions': our_law.get('job_functions', []),
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
                
                print(f"✅ {best_match['match_info']} (Q{matched_law['quarter']})")
                
                # 상세 매칭 정보 저장
                match_details.append({
                    'our_title': our_title,
                    'all_matches': matches[:3],  # 상위 3개 매치만 저장
                    'selected_match': best_match
                })
            else:
                print(f"❌ 매칭 실패 (최고 신뢰도: {best_match['confidence']:.3f})")
        else:
            print(f"❌ 매칭 실패 (매치 없음)")
    
    # 4. 결과 정리 및 저장
    print("\n" + "=" * 60)
    print(f"✅ 향상된 매칭 완료!")
    print(f"📊 총 우리 법령: {len(our_laws)}개")
    print(f"📊 매칭 성공: {len(matched_laws)}개")
    print(f"📊 매칭률: {len(matched_laws)/len(our_laws)*100:.2f}%")
    
    # 분기별/신뢰도별 통계
    by_quarter = {}
    by_confidence = {"high": 0, "medium": 0, "low": 0}
    
    for law in matched_laws:
        quarter = law['quarter']
        confidence = law['confidence']
        
        by_quarter[quarter] = by_quarter.get(quarter, 0) + 1
        
        if confidence >= 0.9:
            by_confidence["high"] += 1
        elif confidence >= 0.8:
            by_confidence["medium"] += 1
        else:
            by_confidence["low"] += 1
    
    print(f"\n📊 분기별 분포: {dict(sorted(by_quarter.items()))}")
    print(f"📊 신뢰도별: 높음(90%+): {by_confidence['high']}개, 중간(80-90%): {by_confidence['medium']}개, 낮음(70-80%): {by_confidence['low']}개")
    
    # 5. 결과 파일 저장
    result = {
        'generated_at': datetime.now().isoformat(),
        'matching_algorithm': 'enhanced_with_normalization_and_abbreviation',
        'total_our_laws': len(our_laws),
        'total_government_laws': len(government_laws),
        'matched_count': len(matched_laws),
        'matching_rate': len(matched_laws)/len(our_laws)*100,
        'statistics': {
            'by_quarter': by_quarter,
            'by_confidence': by_confidence
        },
        'matched_laws': matched_laws,
        'match_details': match_details
    }
    
    output_file = 'docs/enhanced_matching_results.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"📁 저장된 파일: {output_file}")
    
    # 6. 샘플 매칭 결과 출력
    print(f"\n📋 매칭 성공 샘플 (상위 10개):")
    for i, law in enumerate(matched_laws[:10]):
        conf_str = f"{law['confidence']:.1%}"
        print(f"  {i+1}. {law['our_title']} → {law['government_title']}")
        print(f"     시행일: {law['enforcement_date']} ({law['quarter']}) | 신뢰도: {conf_str} | 유형: {law['match_type']}")
    
    return result

if __name__ == "__main__":
    perform_enhanced_matching()