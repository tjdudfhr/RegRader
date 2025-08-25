#!/usr/bin/env python3
import os, sys, json, time, random, re
import urllib.parse, urllib.request
from datetime import datetime
from html import unescape

# 설정
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) law-watch/3.3"
OPENAPI_BASE = "https://www.law.go.kr/DRF/lawSearch.do"
LAW_DETAIL_BASE = "https://www.law.go.kr/DRF/lawService.do"
LAW_OC = "20241119YCRNECRQT4Q7SHAZE6P5AXRF"

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

def extract_law_details(lsId):
    """법령 상세 정보에서 약칭 등 추가 정보 추출"""
    if not lsId:
        return {}
    
    params = {
        "OC": LAW_OC,
        "target": "law",
        "type": "JSON",
        "lsId": lsId
    }
    
    url = LAW_DETAIL_BASE + "?" + urllib.parse.urlencode(params)
    
    raw = http_get(url)
    if not raw:
        return {}
    
    try:
        data = json.loads(raw.decode("utf-8", "ignore"))
        
        # 법령 상세 정보에서 약칭, 별칭 등 추출
        detail_info = {}
        
        if isinstance(data, dict):
            # 다양한 경로에서 법령 정보 찾기
            law_info = None
            
            if 'LawService' in data:
                law_info = data['LawService']
            elif 'response' in data:
                law_info = data['response']
            elif 'law' in data:
                law_info = data['law']
            
            if law_info and isinstance(law_info, dict):
                # 약칭 관련 필드들
                abbreviation_fields = [
                    '약칭', '법령약칭', 'abbr', 'abbreviation', 
                    '별칭', 'alias', '통칭', 'common_name'
                ]
                
                for field in abbreviation_fields:
                    if field in law_info and law_info[field]:
                        detail_info['abbreviation'] = law_info[field].strip()
                        break
                
                # 기타 유용한 정보
                detail_info['full_title'] = law_info.get('법령명', '').strip()
                detail_info['english_title'] = law_info.get('법령영문명', '').strip()
                
    except Exception as e:
        print(f"[WARN] 법령 상세정보 파싱 실패 (lsId: {lsId}): {e}")
    
    return detail_info

def extract_laws_from_json_enhanced(data):
    """JSON 데이터에서 법령 정보를 향상된 방법으로 추출 (약칭 포함)"""
    laws = []
    
    if isinstance(data, dict):
        law_list = None
        
        # 다양한 경로 시도
        if 'LawSearch' in data:
            law_list = data['LawSearch']
        elif 'response' in data:
            law_list = data['response']
        elif 'result' in data:
            law_list = data['result']
        elif 'laws' in data:
            law_list = data['laws']
        elif isinstance(data, list):
            law_list = data
        
        if not law_list:
            return laws
        
        # 법령 목록이 딕셔너리인 경우 하위 항목 찾기
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
            
            # 시행일 확인 (여러 가능한 필드명)
            enforcement_date = None
            for date_field in ['시행일자', '시행일', 'efYd', 'enfcDate', 'effectiveDate']:
                if date_field in item and item[date_field]:
                    date_str = str(item[date_field])
                    if '2025' in date_str:
                        enforcement_date = yyyymmdd_to_iso(date_str) or date_str
                        break
            
            # 2025년 시행이 아니면 제외
            if not enforcement_date or '2025' not in enforcement_date:
                continue
            
            # 법령명 추출
            title = None
            for title_field in ['법령명', '법령명칭', 'lawNm', 'title']:
                if title_field in item and item[title_field]:
                    title = item[title_field].strip()
                    break
            
            if not title:
                continue
            
            # 법령 ID 추출
            lsId = item.get('법령일련번호') or item.get('lsId') or ''
            
            # 법령 상세 정보에서 약칭 등 추출 (선택적으로, 너무 많은 API 호출 방지)
            detail_info = {}
            if lsId and len(laws) < 50:  # 처음 50개만 상세 정보 조회
                detail_info = extract_law_details(lsId)
                time.sleep(0.5)  # API 부하 방지
            
            # 정규화된 법령 정보
            law_info = {
                'title': title,
                'enforcement_date': enforcement_date,
                'lsId': lsId,
                'promulgation_date': yyyymmdd_to_iso(item.get('공포일자') or item.get('promDate') or ''),
                'ministry': item.get('소관부처') or item.get('minstNm') or '',
                'law_type': item.get('법종구분') or item.get('lawType') or '',
                'abbreviation': detail_info.get('abbreviation', ''),
                'full_title': detail_info.get('full_title', title),
                'english_title': detail_info.get('english_title', ''),
                'raw_data': item
            }
            
            laws.append(law_info)
            
        print(f"✅ {len(laws)}개 2025년 시행 법령 추출 완료")
    
    return laws

def crawl_2025_laws_with_abbreviations():
    """약칭 정보를 포함하여 2025년 법령 크롤링"""
    
    print("🔍 약칭 정보 포함 2025년 시행 법령 크롤링 시작!")
    print("=" * 60)
    
    # 2025년 전체 기간
    start_date = "20250101"
    end_date = "20251231"
    
    all_laws = []
    
    # 여러 페이지에서 데이터 수집
    for page in range(1, 15):  # API 부하를 고려하여 15페이지까지
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
            
        # 디버그용 저장
        os.makedirs("docs/_debug", exist_ok=True)
        with open(f"docs/_debug/enhanced_crawl_p{page}.json", "wb") as f:
            f.write(raw)
        
        try:
            data = json.loads(raw.decode("utf-8", "ignore"))
        except Exception as e:
            print(f"❌ 페이지 {page} JSON 파싱 실패: {e}")
            break
        
        # 법령 데이터 추출 (약칭 포함)
        page_laws = extract_laws_from_json_enhanced(data)
        
        if not page_laws:
            print(f"📄 페이지 {page}에서 2025년 시행 법령 없음, 크롤링 종료")
            break
            
        all_laws.extend(page_laws)
        print(f"✅ 페이지 {page}: {len(page_laws)}개 법령 수집 (총 {len(all_laws)}개)")
        
        # API 부하 방지
        if page % 3 == 0:
            print("⏸️ API 부하 방지를 위해 잠시 대기...")
            time.sleep(3)
        else:
            time.sleep(1)
    
    if not all_laws:
        print("❌ 약칭 포함 2025년 법령을 찾을 수 없습니다.")
        return None
    
    # 중복 제거 (lsId 기준)
    unique_laws = {}
    for law in all_laws:
        key = law['lsId'] or law['title']
        if key not in unique_laws:
            unique_laws[key] = law
    
    unique_laws_list = list(unique_laws.values())
    
    # 결과 정리
    result = {
        'crawled_at': datetime.now().isoformat(),
        'search_criteria': {
            'enforcement_date_range': f"{start_date}~{end_date}",
            'target': 'eflaw',
            'search_type': '약칭포함_시행일_기준'
        },
        'total_count': len(unique_laws_list),
        'duplicate_removed_count': len(all_laws) - len(unique_laws_list),
        'laws': unique_laws_list
    }
    
    # 파일 저장
    output_file = 'docs/enhanced_2025_laws_with_abbreviations.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print("=" * 60)
    print(f"✅ 약칭 포함 2025년 법령 크롤링 완료!")
    print(f"📊 총 수집된 법령: {len(all_laws)}개")
    print(f"🔄 중복 제거 후: {len(unique_laws_list)}개")
    print(f"📁 저장된 파일: {output_file}")
    
    # 약칭이 있는 법령 샘플 출력
    abbreviation_count = sum(1 for law in unique_laws_list if law.get('abbreviation'))
    print(f"📝 약칭 정보 포함 법령: {abbreviation_count}개")
    
    print("\n📋 약칭 포함 법령 샘플:")
    for i, law in enumerate(unique_laws_list[:10]):
        abbr_info = f" (약칭: {law['abbreviation']})" if law.get('abbreviation') else ""
        print(f"  {i+1}. {law['title']}{abbr_info} (시행: {law['enforcement_date']})")
    
    return result

if __name__ == "__main__":
    crawl_2025_laws_with_abbreviations()