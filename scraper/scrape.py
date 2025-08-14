import os, sys, json, time, hashlib, re, random
import urllib.parse, urllib.request
from datetime import date, datetime

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) law-watch/3.2"
OPENAPI = "https://www.law.go.kr/DRF/lawSearch.do"
LAW_RSS = "https://www.law.go.kr/rss/lsRss.do?section=LS"  # 백업

TODAY = date.today()
YEAR_START = date(TODAY.year, 1, 1)
YEAR_END   = date(TODAY.year, 12, 31)

AMEND_RE = re.compile(r"(전부개정|일부개정|타법개정|일괄개정|개정(령|법률|규칙)?)")
DATE_RE = re.compile(r"(\d{4})(\d{2})(\d{2})", re.I)

# 기업 직무 카테고리 규칙(원하시면 자유롭게 추가/수정하세요)
CATE_RULES = {
    "안전": [
        r"산업안전|안전보건|소방|재난|유해위험|위험물|승강기|시설물.*안전",
        r"전기(안전|사업)?|가스|철도안전|항공안전|건설.*안전|기계설비",
    ],
    "환경": [
        r"환경(정책|영향평가|보전|기본)|대기|수질|토양|소음|진동|폐기물|자원재활용",
        r"화학물질|유해화학|실내공기|해양환경|미세먼지|온실가스|기후|배출권",
    ],
    "인사노무": [
        r"근로기준|최저임금|남녀고용평등|기간제|단시간|파견근로|퇴직급여",
        r"산업재해보상|산재보험|고용보험|노동조합|노동관계|채용절차|직장내.*괴롭힘|육아|출산",
    ],
    "지배구조": [
        r"상법|자본시장|금융투자|공정거래|독점규제|하도급|표시광고|기업지배|내부통제|공시",
    ],
    "재무회계": [
        r"법인세|부가가치세|소득세|국세기본|지방세|관세|원천징수|외부감사|회계",
        r"세금계산서|전자세금",
    ],
    "정보보호": [
        r"개인정보보호|정보통신망|신용정보|위치정보|통신비밀|전자금융거래|전자서명|정보보호|사이버",
        r"데이터(산업|기본|거버넌스)",
    ],
}
MINISTRY_TO_CAT = {
    "고용노동부": ["인사노무", "안전"],
    "환경부": ["환경"],
    "소방청": ["안전"],
    "산업통상자원부": ["안전"],
    "원자력안전위원회": ["안전"],
    "금융위원회": ["재무회계", "지배구조"],
    "기획재정부": ["재무회계"],
    "국세청": ["재무회계"],
    "공정거래위원회": ["지배구조"],
    "개인정보보호위원회": ["정보보호"],
    "방송통신위원회": ["정보보호"],
    "과학기술정보통신부": ["정보보호"],
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
            sleep = (backoff ** i) + random.uniform(0, 0.6)
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

def categorize(title, ministry):
    cats = set()
    t = title or ""
    # 키워드 우선
    for cat, rules in CATE_RULES.items():
        for r in rules:
            if re.search(r, t):
                cats.add(cat); break
    # 소관부처 보조
    if ministry:
        for m, m_cats in MINISTRY_TO_CAT.items():
            if m in ministry:
                cats.update(m_cats)
    return sorted(cats) if cats else ["기타"]

def parse_openapi_year(oc, start_d, end_d, display=100, max_pages=10):
    if not oc: return []
    os.makedirs("docs/_debug", exist_ok=True)
    collected = []
    for page in range(1, max_pages + 1):
        params = {
            "OC": oc, "target": "eflaw", "type": "JSON",
            "display": str(display), "page": str(page),
            "efYd": f"{start_d.strftime('%Y%m%d')}~{end_d.strftime('%Y%m%d')}",
            "sort": "efdes",
        }
        url = OPENAPI + "?" + urllib.parse.urlencode(params, safe="~:")
        raw = http_get(url)
        if not raw:
            break
        open(f"docs/_debug/openapi_p{page}.json", "wb").write(raw)

        try:
            data = json.loads(raw.decode("utf-8", "ignore"))
        except Exception as e:
            print(f"[WARN] OpenAPI JSON decode fail p{page}: {e}", file=sys.stderr)
            break

        # 유연 파싱
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
                "meta": {"ministry": ministry},
                "source": {"name":"국가법령정보(OpenAPI)","url": detail_url or search_url,"search": search_url}
            })

        if len(items) < display:
            break
    return collected

def parse_rss_backup():
    os.makedirs("docs/_debug", exist_ok=True)
    raw = http_get(LAW_RSS)
    if not raw: return []
    open("docs/_debug/law_rss.xml", "wb").write(raw)
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
        if not eff: 
            continue
        try:
            dd = datetime.strptime(eff, "%Y-%m-%d").date()
        except:
            continue
        if not (YEAR_START <= dd <= YEAR_END): 
            continue
        if not is_amendment(title + " " + desc): 
            continue
        cats = categorize(title, "")
        out.append({
            "title": title, "summary": desc, "effectiveDate": eff,
            "announcedDate": None, "lawType": "개정", "categories": cats,
            "meta": {"ministry": ""},
            "source": {"name":"RSS","url": link, "search": "https://www.law.go.kr/lsSc.do?query=" + urllib.parse.quote(title)}
        })
    return out

def build_results(candidates, limit=120):
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

    filtered = []
    for it in api_items:
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

    if not filtered:
        print("[INFO] Using RSS backup because OpenAPI returned no usable items.", file=sys.stderr)
        filtered = parse_rss_backup()

    results = build_results(filtered, 120)
    os.makedirs("docs", exist_ok=True)
    print(json.dumps({"generatedAt": int(time.time()), "year": TODAY.year, "items": results}, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
