import os, sys, json, time, hashlib, re, random
import urllib.parse, urllib.request
from datetime import date, datetime
from html import unescape

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) law-watch/3.3"
OPENAPI = "https://www.law.go.kr/DRF/lawSearch.do"
LAW_RSS = "https://www.law.go.kr/rss/lsRss.do?section=LS"

TODAY = date.today()
YEAR_START = date(TODAY.year, 1, 1)
YEAR_END   = date(TODAY.year, 12, 31)

AMEND_RE = re.compile(r"(전부개정|일부개정|타법개정|일괄개정|개정(령|법률|규칙)?)")
DATE_RE = re.compile(r"(\d{4})(\d{2})(\d{2})", re.I)

# 1) 키워드 규칙(확장)
CATE_RULES = {
    "안전": [
        r"산업안전|안전보건|중대재해|소방|재난|유해위험|위험물|승강기|시설물.*안전|전기안전|가스(안전)?|기계설비|건설안전|철도안전|항공안전|화공(안전)?",
        r"식품(위생|안전)|의약품(안전|관리)|의료기기|생활화학|산안법|KOSHA",
    ],
    "환경": [
        r"환경(정책|영향평가|보전|기본)|대기|수질|토양|소음|진동|폐기물|자원재활용|순환자원",
        r"화학물질|유해화학|실내공기|해양환경|미세먼지|온실가스|기후|배출권|물환경|자원순환",
    ],
    "인사노무": [
        r"근로기준|최저임금|남녀고용평등|기간제|단시간|파견근로|퇴직급여|근로자퇴직급여",
        r"산업재해보상|산재보험|고용보험|노동조합|노동관계|채용절차|직장내.*괴롭힘|육아|출산|모성보호",
    ],
    "지배구조": [
        r"상법|자본시장|금융투자|공정거래|독점규제|하도급|표시광고|전자상거래|기업지배|내부통제|공시|사외이사|내부회계",
    ],
    "재무회계": [
        r"법인세|부가가치세|소득세|국세기본|지방세|관세|외부감사|주식회사의.*외부감사|회계|세무사",
        r"세금계산서|전자세금|원천징수|국세징수|조세특례|국가회계",
    ],
    "정보보호": [
        r"개인정보보호|정보통신망|신용정보|위치정보|통신비밀|전자금융거래|전자서명|정보보호|사이버|정보보안",
        r"데이터(산업|기본|거버넌스)|디지털플랫폼|클라우드",
    ],
}
# 2) 부처 → 보조 분류
MINISTRY_TO_CAT = {
    "고용노동부": ["인사노무","안전"],
    "환경부": ["환경"],
    "소방청": ["안전"],
    "산업통상자원부": ["안전","재무회계"],
    "원자력안전위원회": ["안전"],
    "금융위원회": ["재무회계","지배구조"],
    "기획재정부": ["재무회계","지배구조"],
    "국세청": ["재무회계"],
    "공정거래위원회": ["지배구조"],
    "개인정보보호위원회": ["정보보호"],
    "방송통신위원회": ["정보보호"],
    "과학기술정보통신부": ["정보보호"],
    "국토교통부": ["안전","지배구조"],
    "해양수산부": ["환경","안전"],
}

def http_get(url, timeout=45, headers=None, retries=5, backoff=2.0):
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
            sleep = (backoff ** i) + random.uniform(0,0.6)
            print(f"[WARN] GET fail ({i+1}/{retries}) {url} -> {e}; retry in {sleep:.1f}s", file=sys.stderr)
            time.sleep(sleep)
    print(f"[ERROR] GET failed after retries: {url} -> {last}", file=sys.stderr)
    return None

def yyyymmdd_to_iso(s):
    if not s: return None
    s = str(s)
    m = DATE_RE.search(s) or re.search(r"(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]?\s*(\d{1,2})", s)
    if not m: return None
    y, mm, dd = map(int, m.groups())
    return f"{y:04d}-{mm:02d}-{dd:02d}"

def is_amendment(text): return bool(AMEND_RE.search(text or ""))

def norm_lawtype(title, raw_type):
    raw_type = (raw_type or "").strip()
    if raw_type: return raw_type
    for k in ("전부개정","일부개정","타법개정","일괄개정","개정"):
        if k in (title or ""): return k
    return ""

def categorize(title, ministry):
    title = unescape(title or "")
    cats = set()
    for cat, rules in CATE_RULES.items():
        for r in rules:
            if re.search(r, title):
                cats.add(cat); break
    if ministry:
        for m, m_cats in MINISTRY_TO_CAT.items():
            if m in ministry:
                cats.update(m_cats)
    return sorted(cats) if cats else ["기타"]

def parse_openapi_year(oc, start_d, end_d, display=100, max_pages=10):
    if not oc: return []
    os.makedirs("docs/_debug", exist_ok=True)
    collected = []
    for page in range(1, max_pages+1):
        params = {
            "OC": oc, "target": "eflaw", "type":"JSON",
            "display": str(display), "page": str(page),
            "efYd": f"{start_d.strftime('%Y%m%d')}~{end_d.strftime('%Y%m%d')}",
            "sort":"efdes",
        }
        url = OPENAPI + "?" + urllib.parse.urlencode(params, safe="~:")
        raw = http_get(url)
        if not raw: break
        open(f"docs/_debug/openapi_p{page}.json","wb").write(raw)
        try:
            data = json.loads(raw.decode("utf-8","ignore"))
        except Exception as e:
            print(f"[WARN] OpenAPI JSON decode fail p{page}: {e}", file=sys.stderr)
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
            title = unescape((it.get("법령명한글") or it.get("법령명") or it.get("title") or "").strip())
            eff = yyyymmdd_to_iso(it.get("시행일자") or it.get("시행일") or it.get("efYd"))
            lawtype = norm_lawtype(title, it.get("제개정구분명") or it.get("구분"))
            law_id = (it.get("법령ID") or it.get("lsId") or it.get("법령일련번호") or "").strip()
            ministry = (it.get("소관부처명") or it.get("부처명") or "").strip()
            cats = categorize(title, ministry)

            detail_url = f"https://www.law.go.kr/LSW/lsInfoP.do?lsId={law_id}" if law_id else ""
            search_url = "https://www.law.go.kr/lsSc.do?query=" + urllib.parse.quote(title)

            collected.append({
                "title": title,
                "summary": "",
                "effectiveDate": eff,
                "announcedDate": None,
                "lawType": lawtype,
                "categories": cats,
                "meta": {"ministry": ministry, "lsId": law_id},
                "source": {"name":"국가법령정보(OpenAPI)","url": detail_url or search_url,"search": search_url}
            })

        if len(items) < display: break
    return collected

def parse_rss_backup():
    os.makedirs("docs/_debug", exist_ok=True)
    raw = http_get(LAW_RSS)
    if not raw: return []
    open("docs/_debug/law_rss.xml","wb").write(raw)
    xml = raw.decode("utf-8","ignore")
    blocks = re.findall(r"<item\b[^>]*>(.*?)</item>", xml, flags=re.I|re.S)
    out = []
    for blk in blocks:
        def pick(tag):
            m = re.search(rf"<{tag}[^>]*>(.*?)</{tag}>", blk, flags=re.I|re.S)
            return re.sub(r"<[^>]+>","", m.group(1)).strip() if m else ""
        title = unescape(pick("title"))
        link = pick("link")
        desc = pick("description")
        eff = yyyymmdd_to_iso(desc) or yyyymmdd_to_iso(title)
        if not eff: continue
        try: dd = datetime.strptime(eff, "%Y-%m-%d").date()
        except: continue
        if not (YEAR_START <= dd <= YEAR_END): continue
        if not is_amendment(title + " " + desc): continue
        cats = categorize(title, "")
        out.append({
            "title": title, "summary": desc, "effectiveDate": eff,
            "announcedDate": None, "lawType": "개정", "categories": cats,
            "meta": {"ministry": "", "lsId": ""},
            "source": {"name":"RSS","url": link, "search": "https://www.law.go.kr/lsSc.do?query=" + urllib.parse.quote(title)}
        })
    return out

# 상세 페이지에서 소관부처 보정(최대 N건)
def fetch_ministry_from_detail(lsId):
    if not lsId: return ""
    cache = f"docs/_debug/ministry_{lsId}.txt"
    if os.path.exists(cache):
        return open(cache, "r", encoding="utf-8").read().strip()
    url = f"https://www.law.go.kr/LSW/lsInfoP.do?lsId={lsId}"
    raw = http_get(url, timeout=30, retries=3)
    if not raw: return ""
    html = raw.decode("utf-8","ignore")
    m = re.search(r"(소관부처|주무부처)\s*</(?:th|dt)>\s*<(?:td|dd)[^>]*>\s*([^<]+)", html, flags=re.I)
    val = unescape(m.group(2)).strip() if m else ""
    try:
        open(cache,"w",encoding="utf-8").write(val)
    except: pass
    return val

def refine_categories(items, max_lookups=20):
    looked = 0
    for it in items:
        cats = it.get("categories") or ["기타"]
        if cats != ["기타"]: continue
        if looked >= max_lookups: break
        lsId = it.get("meta",{}).get("lsId") or ""
        ministry = it.get("meta",{}).get("ministry") or ""
        if not ministry:
            ministry = fetch_ministry_from_detail(lsId)
            if ministry:
                it["meta"]["ministry"] = ministry
        new_cats = categorize(it.get("title") or "", ministry)
        if new_cats != ["기타"]:
            it["categories"] = new_cats
        looked += 1
    return items

def build_results(candidates, limit=200):
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
            "categories": it.get("categories") or ["기타"],
            "meta": it.get("meta") or {},
            "source": it.get("source") or {"name":"","url":""}
        })
    out.sort(key=lambda x: (x.get("effectiveDate") or "", x.get("title") or ""), reverse=True)
    return out[:limit]

def main():
    oc = os.environ.get("LAW_OC") or "knowhow1"

    api_items = parse_openapi_year(oc, YEAR_START, YEAR_END, display=100, max_pages=10)

    # 올해 시행 + 개정만
    filtered = []
    for it in api_items:
        if "개정" not in (it.get("lawType") or "") and not is_amendment(it.get("title")):
            continue
        d = it.get("effectiveDate")
        if not d: continue
        try: dd = datetime.strptime(d, "%Y-%m-%d").date()
        except: continue
        if YEAR_START <= dd <= YEAR_END:
            filtered.append(it)

    if not filtered:
        print("[INFO] Using RSS backup (OpenAPI가 유효 항목 0건).", file=sys.stderr)
        filtered = parse_rss_backup()

    # 소관부처 기반 재분류(기타 보정)
    filtered = refine_categories(filtered, max_lookups=20)

    results = build_results(filtered, 200)
    os.makedirs("docs", exist_ok=True)
    print(json.dumps({"generatedAt": int(time.time()), "year": TODAY.year, "items": results}, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
