import os, sys, json, time, hashlib, re
import urllib.parse, urllib.request
from datetime import datetime, date, timedelta

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) law-updates-bot/2.1"

OPENAPI = "https://www.law.go.kr/DRF/lawSearch.do"
LAW_RSS = "https://www.law.go.kr/rss/lsRss.do?section=LS"
ALT_RSS = "https://opinion.lawmaking.go.kr/rss/announce.rss"

TODAY = date.today()
RANGE_DAYS = 365
FUTURE_LIMIT = TODAY + timedelta(days=RANGE_DAYS)

AMEND_RE = re.compile(r"(전부개정|일부개정|타법개정|일괄개정|개정(령|법률|규칙)?)")
DATE_RE = re.compile(r"(\d{4})(\d{2})(\d{2})")

def http_get(url, timeout=30, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def yyyymmdd_to_iso(s):
    if not s: return None
    m = DATE_RE.search(str(s))
    if not m: return None
    y, mm, dd = map(int, m.groups())
    try:
        return f"{y:04d}-{mm:02d}-{dd:02d}"
    except:
        return None

def is_amendment(text):
    return bool(AMEND_RE.search(text or ""))

def parse_openapi_all(oc, start_d, end_d, display=100, max_pages=5):
    if not oc:
        return []
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
        raw = http_get(url)
        open(f"docs/_debug/openapi_p{page}.json", "wb").write(raw)

        try:
            data = json.loads(raw.decode("utf-8", "ignore"))
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

        if not items:
            break

        for it in items:
            title = (it.get("법령명한글") or it.get("법령명") or it.get("title") or "").strip()
            eff = yyyymmdd_to_iso(it.get("시행일자") or it.get("시행일") or it.get("efYd"))
            lawtype = (it.get("제개정구분명") or it.get("구분") or "").strip()
            if not lawtype and is_amendment(title):
                lawtype = "개정"
            law_id = (it.get("법령ID") or it.get("lsId") or it.get("법령일련번호") or "").strip()

            collected.append({
                "title": title,
                "summary": "",
                "effectiveDate": eff,
                "announcedDate": None,
                "lawType": lawtype,
                "source": {
                    "name": "국가법령정보(OpenAPI)",
                    "url": f"https://www.law.go.kr/법령?lsId={law_id}" if law_id else ""
                }
            })

        if len(items) < display:
            break

    return collected

def parse_rss_backup(url, debug_name):
    try:
        raw = http_get(url)
        os.makedirs("docs/_debug", exist_ok=True)
        open(f"docs/_debug/{debug_name}.xml", "wb").write(raw)
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
            eff = None
            m = re.search(r"(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]?\s*(\d{1,2})", desc or "")
            if m:
                try:
                    eff = f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
                except: pass
            out.append({
                "title": title, "summary": desc, "effectiveDate": eff,
                "announcedDate": None, "lawType": "개정" if is_amendment(title+desc) else "",
                "source": {"name":"RSS", "url": link}
            })
        return out
    except Exception as e:
        print(f"[WARN] RSS backup failed {debug_name}: {e}", file=sys.stderr)
        return []

def build_results(candidates, limit=30):
    results, seen = [], set()
    for it in candidates[:limit]:
        key = (it.get("title") or "") + (it.get("source",{}).get("url") or "")
        _id = hashlib.md5(key.encode("utf-8")).hexdigest()
        if _id in seen: continue
        seen.add(_id)
        results.append({
            "id": _id,
            "title": it.get("title") or "",
            "summary": it.get("summary") or "",
            "effectiveDate": it.get("effectiveDate"),
            "announcedDate": it.get("announcedDate"),
            "lawType": it.get("lawType") or "",
            "source": it.get("source") or {"name":"","url":""},
        })
    def sk(x):
        eff = x.get("effectiveDate") or ""
        return (1, eff) if eff else (2, x.get("title") or "")
    results.sort(key=sk, reverse=True)
    return results

def main():
    oc = os.environ.get("LAW_OC") or "knowhow1"
    openapi_items = parse_openapi_all(oc, TODAY, FUTURE_LIMIT, display=100, max_pages=5)

    primary = []
    for x in openapi_items:
        if "개정" not in (x.get("lawType") or ""): continue
        d = x.get("effectiveDate")
        if not d: continue
        try:
            dd = datetime.strptime(d, "%Y-%m-%d").date()
            if TODAY <= dd <= FUTURE_LIMIT: primary.append(x)
        except: pass

    secondary = [x for x in openapi_items if "개정" in (x.get("lawType") or "") and x.get("effectiveDate")]
    tertiary = openapi_items[:30]

    fallback = parse_rss_backup(LAW_RSS, "law_rss")[:20] or parse_rss_backup(ALT_RSS, "announce_rss")[:20]

    picked = primary or secondary or tertiary or fallback
    results = build_results(picked, 30)

    os.makedirs("docs", exist_ok=True)
    print(json.dumps({"generatedAt": int(time.time()), "items": results}, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
