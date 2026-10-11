"""DART 공시 목록으로 외부감사 대상·대기업집단 소속 여부를 확인한다 (키 없이).

- dart.fss.or.kr 의 공시통합검색 목록(/dsab007/detailSearch.ax)만 쓴다. robots.txt 가 막은 보고서 본문
  뷰어(/dsaf001/main.do, /report/viewer.do)는 열지 않는다. 그래서 자산 금액은 가져오지 않는다.
- 회사를 고를 때 한 번만 묻고, 결과는 .cache/dart/ 에 30일 보관한다.

확인하는 공시
- 감사보고서·연결감사보고서 (F001, F002): 외부감사 대상 회사
- 기업집단현황공시 (J004), 비상장회사중요사항공시 (J005), 하도급대금결제조건공시 (J009): 공시대상기업집단 소속회사
- 사업보고서 (A001): 사업보고서 제출 대상 (상장사·주요 비상장사)
"""
import hashlib
import html
import json
import re
import time
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "dart"
TTL = 30 * 24 * 3600
BASE = "https://dart.fss.or.kr"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
TYPES = {"F001": "audit", "F002": "audit", "J004": "group", "J005": "group", "J009": "group", "A001": "annual"}
REPORT_KIND = [("연결감사보고서", "audit"), ("감사보고서", "audit"), ("기업집단현황", "group"), ("비상장회사중요사항", "group"),
               ("하도급대금", "group"), ("사업보고서", "annual")]


def _norm(name):
    from engine.companydb import norm
    return norm(name)


def latin(n):
    """한글로 읽은 영문 약자를 영문으로 ('에스케이에너지' → 'sk에너지'). 못 바꾸면 그대로."""
    from engine.companydb import LETTERS
    for word, ko in (("posco", "포스코"), ("naver", "네이버"), ("soil", "에쓰오일")):
        if n.startswith(ko):
            return word + n[len(ko):]
    reading = sorted(((ko, ch) for ch, ko in LETTERS.items()), key=lambda x: -len(x[0]))
    out, i = "", 0
    while i < len(n):
        hit = next(((ko, ch) for ko, ch in reading if n.startswith(ko, i)), None)
        if not hit:
            break
        out += hit[1]
        i += len(hit[0])
    return out + n[i:] if len(out) >= 2 else n


def _search(name, years=2):
    end = date.today()
    start = end - timedelta(days=365 * years)
    form = [("currentPage", "1"), ("maxResults", "50"), ("maxLinks", "10"), ("sort", "date"), ("series", "desc"),
            ("textCrpNm", name), ("startDate", start.strftime("%Y%m%d")), ("endDate", end.strftime("%Y%m%d")),
            ("finalReport", "recent"), ("option", "corp")] + [("publicType", t) for t in TYPES]
    req = urllib.request.Request(f"{BASE}/dsab007/detailSearch.ax", data=urllib.parse.urlencode(form).encode(),
                                 headers={"User-Agent": UA, "Referer": f"{BASE}/dsab007/main.do",
                                          "X-Requested-With": "XMLHttpRequest"})
    with urllib.request.urlopen(req, timeout=30) as r:
        t = r.read().decode("utf-8", "ignore")
    rows = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", t, re.S):
        cells = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", c))).strip() for c in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
        rcp = re.search(r"rcpNo=(\d+)", tr)
        if len(cells) >= 5 and rcp:
            corp = re.sub(r"^\S\s+", "", cells[1])  # 앞의 시장 구분 글자(유·코·넥·기) 빼기
            rows.append({"corp": corp, "report": cells[2], "filer": cells[3], "date": cells[4], "rcpNo": rcp.group(1)})
    return rows


def lookup(names):
    """회사명 후보들 → {"audit": 최근 감사보고서, "group": 최근 기업집단 공시, "annual": 최근 사업보고서} (없으면 None)."""
    targets = [n for n in dict.fromkeys(names) if n]
    base = list(dict.fromkeys(_norm(n) for n in targets))
    keys = list(dict.fromkeys(base + [latin(k) for k in base]))
    path = CACHE / (hashlib.sha1(json.dumps(sorted(set(keys)), ensure_ascii=False).encode()).hexdigest() + ".json")
    if path.exists() and time.time() - path.stat().st_mtime < TTL:
        return json.loads(path.read_text(encoding="utf-8"))
    out = {"audit": None, "group": None, "annual": None, "checked": date.today().isoformat()}
    queries = [q for q in keys if len(q) >= 2]
    for q in queries[:3]:
        for r in _search(q):
            if _norm(r["corp"]) not in keys:
                continue  # 이름이 정확히 같은 회사만
            kind = next((k for word, k in REPORT_KIND if word in r["report"]), None)
            if kind and out[kind] is None:
                out[kind] = dict(r, url=f"{BASE}/dsaf001/main.do?rcpNo={r['rcpNo']}")
        if out["audit"] or out["group"] or out["annual"]:
            break
        time.sleep(0.5)
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    return out
