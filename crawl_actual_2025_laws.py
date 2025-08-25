#!/usr/bin/env python3
import os, sys, json, time, hashlib, re, random
import urllib.parse, urllib.request
from datetime import date, datetime
from html import unescape
import xml.etree.ElementTree as ET

# 국가법령정보센터 OpenAPI 설정
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) law-watch/3.3"
OPENAPI_BASE = "https://www.law.go.kr/DRF/lawSearch.do"
LAW_RSS = "https://www.law.go.kr/rss/lsRss.do?section=LS"

# OpenAPI 키 (환경변수 또는 기본값)
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
            print(f"[WARN] GET 실패 ({i+1}/{retries}) {url} -> {e}; 재시도 {sleep:.1f}초 후", file=sys.stderr)
            time.sleep(sleep)
    
    print(f"[ERROR] GET 최종 실패: {url} -> {last}", file=sys.stderr)
    return None

def yyyymmdd_to_iso(s):
    """YYYYMMDD 형식을 YYYY-MM-DD로 변환"""
    if not s: return None
    s = str(s)
    m = re.search(r"(\d{4})(\d{2})(\d{2})", s)
    if not m: return None
    y, mm, dd = map(int, m.groups())
    return f"{y:04d}-{mm:02d}-{dd:02d}"

def crawl_2025_laws_from_openapi():
    """국가법령정보센터 OpenAPI에서 2025년 시행 법령 크롤링"""
    
    print("🔍 국가법령정보센터 OpenAPI에서 2025년 시행 법령 크롤링 시작...")
    
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
        print(f"🌐 요청 URL: {url}")
        
        raw = http_get(url)
        if not raw:
            print(f"❌ 페이지 {page} 데이터 로드 실패")
            break
            
        # 디버그용 저장
        os.makedirs("docs/_debug", exist_ok=True)
        with open(f"docs/_debug/openapi_2025_p{page}.json", "wb") as f:
            f.write(raw)
        
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
        
        # 100개 미만이면 마지막 페이지
        if len(page_laws) < 100:
            print(f"📄 페이지 {page}가 마지막 페이지입니다")
            break
    
    print(f"🎉 총 {len(all_laws)}개의 2025년 시행 법령 크롤링 완료!")
    return all_laws

def extract_laws_from_json(data):
    """JSON 데이터에서 법령 정보 추출"""
    laws = []
    
    def walk_json(obj, path=""):
        """JSON 객체를 재귀적으로 탐색하여 법령 데이터 찾기"""
        if isinstance(obj, dict):
            # 법령 정보를 포함한 객체인지 확인
            if any(key in obj for key in ["법령명한글", "법령명", "title", "시행일자", "efYd"]):
                laws.append(obj)
            else:
                for key, value in obj.items():
                    walk_json(value, f"{path}.{key}")
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                walk_json(item, f"{path}[{i}]")
    
    walk_json(data)
    
    # 추출된 법령 데이터 정제
    processed_laws = []
    for raw_law in laws:
        try:
            law = process_law_data(raw_law)
            if law:
                processed_laws.append(law)
        except Exception as e:
            print(f"⚠️ 법령 데이터 처리 중 오류: {e}")
            continue
    
    return processed_laws

def process_law_data(raw_law):
    """원시 법령 데이터를 정제된 형태로 변환"""
    
    # 법령명 추출
    title = (raw_law.get("법령명한글") or 
             raw_law.get("법령명") or 
             raw_law.get("title") or "").strip()
    
    if not title:
        return None
    
    title = unescape(title)
    
    # 시행일자 추출
    effective_date = yyyymmdd_to_iso(
        raw_law.get("시행일자") or 
        raw_law.get("시행일") or 
        raw_law.get("efYd") or ""
    )
    
    if not effective_date or not effective_date.startswith("2025"):
        return None
    
    # 법령ID 추출
    law_id = (raw_law.get("법령ID") or 
              raw_law.get("lsId") or 
              raw_law.get("법령일련번호") or "").strip()
    
    # 소관부처 추출
    ministry = (raw_law.get("소관부처명") or 
                raw_law.get("부처명") or 
                raw_law.get("소관부처") or "").strip()
    
    # 법령 유형 추출
    law_type = (raw_law.get("제개정구분명") or 
                raw_law.get("구분") or 
                raw_law.get("제개정구분") or "").strip()
    
    # 개정 관련 키워드가 있는지 확인
    if not law_type:
        if any(keyword in title for keyword in ["개정", "신설", "제정", "전부개정", "일부개정"]):
            law_type = "개정"
        else:
            law_type = "시행"
    
    # URL 생성
    detail_url = f"https://www.law.go.kr/LSW/lsInfoP.do?lsId={law_id}" if law_id else ""
    search_url = "https://www.law.go.kr/lsSc.do?query=" + urllib.parse.quote(title)
    
    # 고유 ID 생성
    key = title + detail_url
    unique_id = hashlib.md5(key.encode("utf-8")).hexdigest()
    
    law_data = {
        "id": unique_id,
        "title": title,
        "effectiveDate": effective_date,
        "lawType": law_type,
        "ministry": ministry,
        "lsId": law_id,
        "detailUrl": detail_url,
        "searchUrl": search_url,
        "source": "국가법령정보센터 OpenAPI",
        "crawled_at": datetime.now().isoformat()
    }
    
    return law_data

def save_crawled_data(laws):
    """크롤링된 데이터 저장"""
    
    # 중복 제거 (제목 기준)
    unique_laws = {}
    for law in laws:
        title = law["title"]
        if title not in unique_laws:
            unique_laws[title] = law
        else:
            # 더 자세한 정보가 있는 것으로 업데이트
            if law.get("lsId") and not unique_laws[title].get("lsId"):
                unique_laws[title] = law
    
    final_laws = list(unique_laws.values())
    
    # 시행일자 기준 정렬
    final_laws.sort(key=lambda x: (x.get("effectiveDate", ""), x.get("title", "")))
    
    # 분석 정보
    analysis = {
        "crawled_at": datetime.now().isoformat(),
        "total_laws": len(final_laws),
        "source": "국가법령정보센터 OpenAPI",
        "year": 2025,
        "date_range": "2025-01-01 ~ 2025-12-31",
        "laws": final_laws
    }
    
    # 분기별 통계
    quarters = {"Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0}
    for law in final_laws:
        date_str = law.get("effectiveDate", "")
        if len(date_str) >= 7:
            month = int(date_str[5:7])
            if 1 <= month <= 3:
                quarters["Q1"] += 1
            elif 4 <= month <= 6:
                quarters["Q2"] += 1
            elif 7 <= month <= 9:
                quarters["Q3"] += 1
            elif 10 <= month <= 12:
                quarters["Q4"] += 1
    
    analysis["by_quarter"] = quarters
    
    # 부처별 통계
    ministries = {}
    for law in final_laws:
        ministry = law.get("ministry", "미상")
        ministries[ministry] = ministries.get(ministry, 0) + 1
    
    analysis["by_ministry"] = ministries
    
    # 저장
    output_file = "docs/crawled_2025_laws.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(analysis, f, ensure_ascii=False, indent=2)
    
    print(f"💾 크롤링 결과 저장: {output_file}")
    print(f"📊 총 법령 수: {len(final_laws)}개")
    print(f"📅 분기별 분포: {quarters}")
    print(f"🏛️ 상위 부처: {dict(list(sorted(ministries.items(), key=lambda x: x[1], reverse=True))[:5])}")
    
    return analysis

def main():
    print("🚀 국가법령정보센터 2025년 시행 법령 정확한 크롤링 시작!")
    print("=" * 60)
    
    # 1. OpenAPI에서 크롤링
    laws = crawl_2025_laws_from_openapi()
    
    if not laws:
        print("❌ 크롤링된 법령이 없습니다!")
        return
    
    # 2. 데이터 저장 및 분석
    analysis = save_crawled_data(laws)
    
    print("=" * 60)
    print("✅ 2025년 실제 시행 법령 크롤링 완료!")
    print(f"📁 결과 파일: docs/crawled_2025_laws.json")
    
    return analysis

if __name__ == "__main__":
    main()