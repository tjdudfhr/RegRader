import os, sys, json, time, hashlib, re
import urllib.parse, urllib.request
from datetime import datetime, date, timedelta

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) law-watch/3.0"

OPENAPI = "https://www.law.go.kr/DRF/lawSearch.do"
LAW_RSS = "https://www.law.go.kr/rss/lsRss.do?section=LS"  # 디버그/백업용만 사용

TODAY = date.today()
YEAR_START = date(TODAY.year, 1, 1)
YEAR_END = date(TODAY.year, 12, 31)

AMEND_RE = re.compile(r"(전부개정|일부개정|타법개정|일괄개정|개정(령|법률|규칙)?)")
DATE_RE = re.compile(r"(\d{4})(\d{2})(\d{2})")

def http_get(url, timeout=30, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def yyyymmdd_to_iso(s):
    if not s: return None
    s = str(s)
    m = DATE_RE.search(s) or re.search(r"(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]?\s*(\d{1,2})", s)
    if not m: return None
    y, mm, dd = int(m.group(1)), int(m.group(2)), int(m.group(3))
    try:
        return f"{y:04d}-{mm:02d}-{dd:02d}"
    except:
        return None

def is_amendment(text):
    return bool(AMEND_RE.search(text or ""))

def norm_lawtype(title, raw_type):
    raw_type = (raw_type or "").strip()
    if raw_type: return raw_type
    # 타입이 비어있으면 제목으로 추정
    if "전부개정" in title: return "전부개정"
    if "일부개정" in title: return "일부개정"
    if "타법개정" in title: return "타법개정"
    if "일괄개정" in title: return "일괄개정"
    if "개정" in title: return "개정"
    return ""

def parse_openapi_year(oc, start_d, end_d, display=100, max_pages=10):
    if not oc: return []
    os.makedirs("docs/_debug", exist_ok=True)
    collected = []
    for page in range(1, max_pages + 1):
        params = {
            "OC": oc,
            "target": "eflaw",
            "type": "JSON",
            "display": str(display),
            "page": str(page),
            "efYd": f"{start_d.strftime('%Y%m%d')}~{end_d.strftime('%Y%m%d')}",
            "sort": "efdes",  # 시행일 내림차순
        }
        url = OPENAPI + "?" + urllib.parse.urlencode(params, safe="~:")
        raw = http_get(url)
        open(f"docs/_debug/openapi_p{page}.json", "wb").write(raw)

        try:
            data = json.loads(raw.decode("utf-8", "ignore"))
        except Exception as e:
            print(f"[WARN] OpenAPI JSON decode fail p{page}: {e}", file=sys.stderr)
            break

        # 구조 유연 파싱
        items = []
        def walk(x):
            if isinstance(x, list):
                for v in x: walk(v)
            elif isinstance(x, dict):
                if any(k in x for k in ("법령명한글","법령명","title")):
                    items.append(x)
                for v in x.values(): walk(v)
        walk(data)

        if not items: break

        for it in items:
            title = (it.get("법령명한글") or it.get("법령명") or it.get("title") or "").strip()
            eff = yyyymmdd_to_iso(it.get("시행일자") or it.get("시행일") or it.get("efYd"))
            raw_type = (it.get("제개정구분명") or it.get("구분") or "").strip()
            lawtype = norm_lawtype(title, raw_type)
            law_id = (it.get("법령ID") or it.get("lsId") or it.get("법령일련번호") or "").strip()

            # 상세/검색 URL 생성
            detail_url = f"https://www.law.go.kr/LSW/lsInfoP.do?lsId={law_id}" if law_id else ""
            search_url = "https://www.law.go.kr/lsSc.do?query=" + urllib.parse.quote(title)

            collected.append({
                "title": title,
                "summary": "",
                "effectiveDate": eff,
                "announcedDate": None,
                "lawType": lawtype,
                "source": {
                    "name": "국가법령정보(OpenAPI)",
                    "url": detail_url or search_url,
                    "search": search_url
                }
            })

        if len(items) < display: break

    return collected

def build_results(candidates, limit=60):
    # 중복 제거 + 정렬(시행일 최신순)
    seen, out = set(), []
    for it in candidates:
        key = (it.get("title") or "") + (it.get("source",{}).get("url") or "")
        _id = hashlib.md5(key.encode("utf-8")).hexdigest()
        if _id in seen: continue
        seen.add(_id)
        out.append({
            "id": _id,
            "title": it.get("title") or "",
            "summary": it.get("summary") or "",
            "effectiveDate": it.get("effectiveDate"),
            "announcedDate": it.get("announcedDate"),
            "lawType": it.get("lawType") or "",
            "source": it.get("source") or {"name":"","url":""},
        })
    out.sort(key=lambda x: (x.get("effectiveDate") or "", x.get("title") or ""), reverse=True)
    return out[:limit]

def main():
    oc = os.environ.get("LAW_OC") or "knowhow1"

    # 올해 범위만 수집
    openapi_items = parse_openapi_year(oc, YEAR_START, YEAR_END, display=100, max_pages=10)

    # 올해 시행 + 개정만 남기기
    filtered = []
    for x in openapi_items:
        lt = x.get("lawType") or ""
        if "개정" not in lt: 
            # 타입을 못 받았는데 제목으로 개정 감지되는 케이스
            if not is_amendment(x.get("title")): 
                continue
        d = x.get("effectiveDate")
        if not d: 
            continue
        try:
            dd = datetime.strptime(d, "%Y-%m-%d").date()
            if YEAR_START <= dd <= YEAR_END:
                filtered.append(x)
        except:
            continue

    results = build_results(filtered, 60)

    os.makedirs("docs", exist_ok=True)
    print(json.dumps({
        "generatedAt": int(time.time()),
        "year": TODAY.year,
        "items": results
    }, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
