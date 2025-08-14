import os, sys, json, time, hashlib, re, random
import urllib.parse, urllib.request
from datetime import date, datetime

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) law-watch/3.1"
OPENAPI = "https://www.law.go.kr/DRF/lawSearch.do"
LAW_RSS = "https://www.law.go.kr/rss/lsRss.do?section=LS"  # 백업용

TODAY = date.today()
YEAR_START = date(TODAY.year, 1, 1)
YEAR_END   = date(TODAY.year, 12, 31)

AMEND_RE = re.compile(r"(전부개정|일부개정|타법개정|일괄개정|개정(령|법률|규칙)?)")
DATE_RE = re.compile(r"(\d{4})(\d{2})(\d{2})")

def log(msg):
    print(msg, file=sys.stderr)

def http_get(url, timeout=40, headers=None, retries=5, backoff=2.0):
    """
    신뢰성 향상: 최대 5회 재시도, 지수 백오프(+지터)
    실패 시 None 반환(예외로 죽지 않게)
    """
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
            log(f"[WARN] GET fail ({i+1}/{retries}) {url} -> {e}; retry in {sleep:.1f}s")
            time.sleep(sleep)
    log(f"[ERROR] GET failed after retries: {url} -> {last}")
    return None

def yyyymmdd_to_iso(s):
    if not s: return None
    s = str(s)
    m = DATE_RE.search(s) or re.search(r"(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]?\s*(\d{1,2})", s)
    if not m: return None
    y, mm, dd = map(int, m.groups())
    try:
        return f"{y:04d}-{mm:02d}-{dd:02d}"
    except:
        return None

def is_amendment(text):
    return bool(AMEND_RE.search(text or ""))

def norm_lawtype(title, raw_type):
    raw_type = (raw_type or "").strip()
    if raw_type: return raw_type
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
            "sort": "efdes",
        }
        url = OPENAPI + "?" + urllib.parse.urlencode(params, safe="~:")
        raw = http_get(url, timeout=45)
        if raw:
            with open(f"docs/_debug/openapi_p{page}.json", "wb") as f:
                f.write(raw)
        else:
            # 네트워크 실패 시 더 진행하지 않고 종료
            break

        try:
            data = json.loads(raw.decode("utf-8", "ignore"))
        except Exception as e:
            log(f"[WARN] OpenAPI JSON decode fail p{page}: {e}")
            break

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
            lawtype = norm_lawtype(title, it.get("제개정구분명") or it.get("구분"))
            law_id = (it.get("법령ID") or it.get("lsId") or it.get("법령일련번호") or "").strip()

            detail_url = f"https://www.law.go.kr/LSW/lsInfoP.do?lsId={law_id}" if law_id else ""
            search_url = "https://www.law.go.kr/lsSc.do?query=" + urllib.parse.quote(title)

            collected.append({
                "title": title,
                "summary": "",
                "effectiveDate": eff,
                "announcedDate": None,
                "lawType": lawtype,
                "source": {"name":"국가법령정보(OpenAPI)","url": detail_url or search_url,"search": search_url}
            })

        if len(items) < display:
            break

    return collected

def parse_rss_backup():
    os.makedirs("docs/_debug", exist_ok=True)
    raw = http_get(LAW_RSS, timeout=45)
    if not raw:
        return []
    with open("docs/_debug/law_rss.xml", "wb") as f:
        f.write(raw)
    xml = raw.decode("utf-8", "ignore")
    blocks = re.findall(r"<item\b[^>]*>(.*?)</item>", xml, flags=re.I|re.S)
    out = []
    for blk in blocks:
        def pick(tag):
            m = re.search(rf"<{tag}[^>]*>(.*?)</{tag}>", blk, flags=re.I|re.S)
            return re.sub(r"<[^>]+>", "", m.group(1)).strip() if m else ""
        title = pick("title")
        link = pick("link")
        desc = pick("description")
        eff = yyyymmdd_to_iso(desc) or yyyymmdd_to_iso(title)
        if not eff:  # RSS에 시행일이 안 박힌 경우가 있어요
            continue
        try:
            dd = datetime.strptime(eff, "%Y-%m-%d").date()
        except:
            continue
        if not (YEAR_START <= dd <= YEAR_END):
            continue
        if not is_amendment(title + " " + desc):
            continue
        out.append({
            "title": title, "summary": desc, "effectiveDate": eff,
            "announcedDate": None, "lawType": "개정",
            "source": {"name":"RSS","url": link, "search": "https://www.law.go.kr/lsSc.do?query=" + urllib.parse.quote(title)}
        })
    return out

def build_results(candidates, limit=60):
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
            "source": it.get("source") or {"name":"","url":""}
        })
    out.sort(key=lambda x: (x.get("effectiveDate") or "", x.get("title") or ""), reverse=True)
    return out[:limit]

def main():
    oc = os.environ.get("LAW_OC") or "knowhow1"

    # 1) OpenAPI 시도(리트라이 포함)
    openapi_items = parse_openapi_year(oc, YEAR_START, YEAR_END, display=100, max_pages=10)

    # 2) 올해 시행 + 개정만 남기기
    filtered = []
    for it in openapi_items:
        lt = it.get("lawType") or ""
        if "개정" not in lt and not is_amendment(it.get("title")):
            continue
        d = it.get("effectiveDate")
        if not d:
            continue
        try:
            dd = datetime.strptime(d, "%Y-%m-%d").date()
        except:
            continue
        if YEAR_START <= dd <= YEAR_END:
            filtered.append(it)

    # 3) OpenAPI가 비었으면 RSS 백업 사용
    if not filtered:
        log("[INFO] Using RSS backup because OpenAPI returned no usable items.")
        filtered = parse_rss_backup()

    results = build_results(filtered, 60)
    os.makedirs("docs", exist_ok=True)
    print(json.dumps({"generatedAt": int(time.time()), "year": TODAY.year, "items": results}, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
