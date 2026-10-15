"""OpenDART(금융감독원 공식 API)로 회사 사실을 확인한다. 무료 인증키가 .env 의 OPENDART_KEY 에 있을 때만 쓴다.

    python3 -m engine.opendart 에코프로비엠      # 확인한 사실과 근거 보기

- 기업개황(company.json): 표준산업분류 코드, 사업자등록번호 (국민연금 사업장과 맞추는 데 씀)
- 정기공시 목록(list.json) → 가장 최근 사업보고서 원문(document.xml): '회사의 개요'·'사업의 내용'·직원·계열회사·
  그 밖의 사항·상세표만 읽고 재무제표는 읽지 않는다 (주석의 일반 문구가 사실을 흐린다)
- 직원 현황(empSttus.json): 상시 인원·기간제(계약직) 인원

DART 웹사이트(dart.fss.or.kr)의 보고서 화면은 robots.txt 가 자동 수집을 막으므로 쓰지 않는다. 화면에는 사람이 열어 볼 링크만 둔다.
응답은 .cache/opendart 에 저장한다 (회사 목록·기업개황 30일, 공시 목록 7일, 원문은 바뀌지 않으므로 계속).
"""
import gzip
import html
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "opendart"
API = "https://opendart.fss.or.kr/api/"
VIEW = "https://dart.fss.or.kr/dsaf001/main.do?rcpNo="
DAY = 86400
READ_SECTIONS = ("I.", "II.", "IV.", "VIII.", "IX.", "XI.", "XII.")


def key():
    k = os.environ.get("OPENDART_KEY", "").strip()
    if not k:
        env = ROOT / ".env"
        if env.exists():
            for line in env.read_text(encoding="utf-8").splitlines():
                if line.strip().startswith("OPENDART_KEY="):
                    k = line.split("=", 1)[1].strip().strip('"').strip("'")
    return k


def enabled():
    return bool(key())


def _fetch(name, params, max_age, binary=False):
    """API 호출 (디스크 캐시). binary 면 bytes, 아니면 JSON."""
    CACHE.mkdir(parents=True, exist_ok=True)
    tag = re.sub(r"[^0-9A-Za-z_.-]", "_", name + "_" + "_".join(f"{k}-{v}" for k, v in sorted(params.items())))
    path = CACHE / (tag + (".bin" if binary else ".json"))
    if path.exists() and (max_age is None or time.time() - path.stat().st_mtime < max_age):
        data = path.read_bytes()
        return data if binary else json.loads(data)
    q = urllib.parse.urlencode(dict(params, crtfc_key=key()))
    req = urllib.request.Request(API + name + "?" + q, headers={"User-Agent": "RegRaderPro/0.1"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    if binary and not data.startswith(b"PK"):
        raise RuntimeError(f"OpenDART {name}: {data[:200].decode('utf-8', 'ignore')}")
    if not binary:
        j = json.loads(data)
        if j.get("status") not in ("000", "013"):  # 013 = 조회된 데이터 없음
            raise RuntimeError(f"OpenDART {name}: {j.get('status')} {j.get('message')}")
    path.write_bytes(data)
    return data if binary else json.loads(data)


_CORPS = None


def corps():
    """전체 공시 대상 회사 목록 [{corp_code, corp_name, stock_code}] (약 12만 곳)."""
    global _CORPS
    if _CORPS is None:
        raw = _fetch("corpCode.xml", {}, 30 * DAY, binary=True)
        z = zipfile.ZipFile(io.BytesIO(raw))
        t = z.read(z.namelist()[0]).decode("utf-8")
        _CORPS = [{"corp_code": c, "corp_name": n.strip(), "stock_code": s.strip()}
                  for c, n, s in re.findall(r"<corp_code>(\d+)</corp_code>\s*<corp_name>(.*?)</corp_name>.*?<stock_code>(.*?)</stock_code>", t, re.S)]
    return _CORPS


_BY_STEM = None


def _by_stem():
    """회사명 줄기 → 회사들 (회사 찾기와 같은 줄기 규칙, 한글 읽기 포함)."""
    global _BY_STEM
    if _BY_STEM is None:
        from engine import companydb as cdb
        _BY_STEM = {}
        for x in corps():
            st = cdb.stem(x["corp_name"])
            for k in {st, cdb.hangul(st)}:
                if k:
                    _BY_STEM.setdefault(k, []).append(x)
    return _BY_STEM


def company(corp_code):
    return _fetch("company.json", {"corp_code": corp_code}, 30 * DAY)


def match(c):
    """회사 찾기 결과(companydb) → OpenDART 고유번호. 상장 종목코드, 아니면 이름 + 사업자등록번호 앞 6자리로 맞춘다."""
    from engine import companydb as cdb
    listing, _ = cdb.listing_for(c)
    code = (listing or {}).get("code") or (c.get("listedAs") or {}).get("code")
    if code:
        hit = next((x for x in corps() if x["stock_code"] == code), None)
        if hit:
            return hit["corp_code"]
    names = {cdb.stem(w["name"]) for w in c.get("workplaces", [])} | {cdb.stem(c.get("name", "")), c.get("stem") or ""}
    names |= {cdb.hangul(n) for n in names}
    names.discard("")
    m = re.match(r"[^|]*\|c(\d{6})", c.get("key", ""))  # 회사 키에 사업자등록번호 앞 6자리가 들어 있다
    biz = {m.group(1)} if m else set()
    idx = _by_stem()
    cands = list({x["corp_code"]: x for n in names for x in idx.get(n, [])}.values())
    if not cands:
        return None
    if len(cands) == 1 and not biz:
        return cands[0]["corp_code"]
    for x in cands[:8]:  # 같은 이름이 여럿이면 사업자등록번호로 고른다
        info = company(x["corp_code"])
        if (info.get("bizr_no") or "")[:6] in biz:
            return x["corp_code"]
    return None


def latest_report(corp_code):
    """최근 2년 안의 가장 최근 사업보고서 (정정본이면 정정본)."""
    bgn = (date.today() - timedelta(days=730)).strftime("%Y%m%d")
    j = _fetch("list.json", {"corp_code": corp_code, "bgn_de": bgn, "pblntf_ty": "A", "page_count": "100"}, 7 * DAY)
    reps = [x for x in j.get("list", []) if "사업보고서" in x["report_nm"]]
    if not reps:
        return None
    reps.sort(key=lambda x: x["rcept_no"], reverse=True)
    r = reps[0]
    return {"rcept_no": r["rcept_no"], "report": r["report_nm"].replace("[기재정정]", "").strip(), "date": r["rcept_dt"], "url": VIEW + r["rcept_no"]}


MARKET = {"Y": "유가증권시장", "K": "코스닥시장", "N": "코넥스시장"}


def disclosure_status(corp_code, info=None):
    """상장·외부감사 대상·공시대상기업집단 소속을 공시로 정한다 → {flag: {value, note, source}}.

    - 상장: 기업개황 법인구분 (Y 유가증권 · K 코스닥 · N 코넥스, E 기타 = 비상장)
    - 외부감사 대상: 최근 2년 사업보고서(감사보고서 첨부) 또는 감사보고서 제출
    - 공시대상기업집단 소속: 최근 2년 공정위 공시(기업집단현황·대규모내부거래·비상장회사 중요사항 등) 제출 — 소속회사만 낸다
    """
    info = info or company(corp_code)
    bgn = (date.today() - timedelta(days=730)).strftime("%Y%m%d")
    lists = {t: _fetch("list.json", {"corp_code": corp_code, "bgn_de": bgn, "pblntf_ty": t, "page_count": "10"}, 7 * DAY) for t in ("A", "F", "J")}
    first = lambda t, word="": next((x for x in lists[t].get("list", []) if word in x["report_nm"]), None)  # noqa: E731
    out = {}
    cls = info.get("corp_cls") or ""
    out["listed"] = ({"value": True, "note": f"{MARKET[cls]} 상장 (DART 기업개황)"} if cls in MARKET
                     else {"value": False, "note": "DART 기업개황상 비상장 (기타법인)"})
    rep = first("A", "사업보고서") or first("F", "감사보고서")
    out["audited"] = ({"value": True, "note": f"DART {rep['report_nm'].replace('[기재정정]', '').strip()} 제출 ({rep['rcept_dt']})", "source": VIEW + rep["rcept_no"]} if rep
                      else {"value": False, "note": "최근 2년 DART에 감사보고서·사업보고서 제출 없음 (외부감사 대상 아님)"})
    grp = first("J")
    out["group"] = ({"value": True, "note": f"DART 공정위 공시 '{grp['report_nm']}' 제출 ({grp['rcept_dt']}) — 공시대상기업집단 소속회사만 내는 공시", "source": VIEW + grp["rcept_no"]} if grp
                    else {"value": False, "note": "최근 2년 DART 공정위 공시(기업집단현황 등) 없음 (공시대상기업집단 소속 아님)"})
    return out


UNIT = {"원": 1e-8, "천원": 1e-5, "백만원": 1e-2, "억원": 1.0}


def audit_assets(corp_code):
    """최근 감사보고서 재무상태표의 자산총계 → {assets_eok, report, date, url} (사업보고서를 내지 않는 비상장 외감 회사용)."""
    path = CACHE / f"assets_{corp_code}.json"
    if path.exists() and time.time() - path.stat().st_mtime < 30 * DAY:
        return json.loads(path.read_text(encoding="utf-8")) or None
    bgn = (date.today() - timedelta(days=730)).strftime("%Y%m%d")
    j = _fetch("list.json", {"corp_code": corp_code, "bgn_de": bgn, "pblntf_ty": "F", "page_count": "10"}, 7 * DAY)
    rep = next((x for x in j.get("list", []) if "감사보고서" in x["report_nm"] and "연결" not in x["report_nm"]), None) \
        or next((x for x in j.get("list", []) if "감사보고서" in x["report_nm"]), None)
    out = None
    if rep:
        raw = _fetch("document.xml", {"rcept_no": rep["rcept_no"]}, None, binary=True)
        z = zipfile.ZipFile(io.BytesIO(raw))
        t = _text(z.read(max(z.namelist(), key=lambda n: z.getinfo(n).file_size)).decode("utf-8", "ignore"))
        for head in re.finditer(r"재\s*무\s*상\s*태\s*표", t):  # 목차·감사의견 문장이 아닌 표 머리 (바로 뒤에 단위가 있다)
            body = t[head.start():]
            unit = re.search(r"단위\s*[:：]?\s*(백만원|천원|억원|원)", body[:400])
            m = re.search(r"자\s*산\s*총\s*계\s*([\d,]{3,})", body) if unit else None
            if unit and m:
                eok = int(m.group(1).replace(",", "")) * UNIT[unit.group(1)]
                out = {"assets_eok": round(eok), "report": rep["report_nm"].strip(), "date": rep["rcept_dt"], "url": VIEW + rep["rcept_no"]}
                break
        (CACHE / f"document.xml_rcept_no-{rep['rcept_no']}.bin").unlink(missing_ok=True)
    path.write_text(json.dumps(out or {}, ensure_ascii=False), encoding="utf-8")
    return out


def _text(x):
    x = re.sub(r"<[^>]+>", " ", x)
    return re.sub(r"\s+", " ", html.unescape(x)).strip()


def report_sections(rcept_no):
    """사업보고서 원문 → {장 제목: 본문}. 재무제표 장은 뺀다."""
    path = CACHE / f"doc_{rcept_no}.json.gz"
    if path.exists():
        return json.loads(gzip.decompress(path.read_bytes()))
    raw = _fetch("document.xml", {"rcept_no": rcept_no}, None, binary=True)
    z = zipfile.ZipFile(io.BytesIO(raw))
    main = max(z.namelist(), key=lambda n: z.getinfo(n).file_size)
    t = z.read(main).decode("utf-8", "ignore")
    out = {}
    for s in re.findall(r"<SECTION-1[^>]*>(.*?)</SECTION-1>", t, re.S):
        m = re.search(r"<TITLE[^>]*>(.*?)</TITLE>", s)
        title = _text(m.group(1)) if m else ""
        if title.startswith(READ_SECTIONS):
            out[title] = _text(s)
    path.write_bytes(gzip.compress(json.dumps(out, ensure_ascii=False).encode("utf-8")))
    (CACHE / f"document.xml_rcept_no-{rcept_no}.bin").unlink(missing_ok=True)  # 원본 zip 은 지운다 (본문만 남김)
    return out


def employees(corp_code, year):
    """직원 현황 → {total, contract} (사업보고서 기준)."""
    j = _fetch("empSttus.json", {"corp_code": corp_code, "bsns_year": str(year), "reprt_code": "11011"}, 30 * DAY)
    num = lambda v: int(re.sub(r"[^\d]", "", v or "") or 0)  # noqa: E731
    rows = j.get("list", [])
    if not rows:
        return None
    return {"total": sum(num(x.get("sm")) for x in rows), "contract": sum(num(x.get("cnttk_co")) for x in rows)}


# 사업보고서 문장 → 사실. (사실, 정규식, 읽을 장 앞머리 또는 None=전부). 맞은 문장을 근거로 남긴다.
PATTERNS = [
    ("act:rnd", r"기업부설연구소|연구개발전담부서|연구개발\s*담당\s*조직|연구소명", None),
    ("site:lab", r"기업부설연구소|연구소명|연구소\s*소재지", None),
    ("act:overseas", r"(?:미국|중국|베트남|인도네시아|인도|헝가리|폴란드|독일|멕시코|캐나다|일본|태국|말레이시아|싱가포르|브라질|체코|슬로바키아|튀르키예|터키|러시아|영국|프랑스|네덜란드|홍콩|대만|필리핀|호주|아랍에미리트|사우디)\s*(?:소재|법인|현지법인)|해외\s*(?:종속|현지)\s*법인|해외법인", ("I.", "II.", "IX.", "XII.")),
    ("act:subcontract", r"하도급\s*(?:거래|법|대금|계약|업체)|수급사업자|외주\s*(?:가공|생산|제작)|협력\s*(?:업체|사|회사)(?:에|를|로부터)?\s*(?:위탁|발주|외주)", None),
    ("act:dealer", r"(?<!보험)대리점\s*(?:판매|영업|망|채널|유통|계약)|(?<!보험)대리점을\s*통", ("II.",)),
    ("act:franchise", r"가맹사업|가맹본부|프랜차이즈", ("II.",)),
    ("act:consumer_online", r"자사\s*몰|온라인\s*(?:몰|쇼핑|판매|채널|스토어)|이커머스|e-?커머스|오픈마켓", ("II.",)),
    ("act:direct_sales", r"방문판매|다단계|텔레마케팅|전화\s*권유", ("II.",)),
    ("act:public_contract", r"조달청|관급|공공기관\s*(?:발주|수주|납품)|국가\s*및\s*지방자치단체\s*(?:발주|수주)|관공서\s*(?:납품|발주)", ("II.",)),
    ("act:core_tech", r"국가핵심기술|국가첨단전략기술", None),
    ("act:foreign_worker", r"외국인\s*근로자|외국인\s*인력", None),
    ("act:ghg", r"배출권\s*할당|할당\s*대상\s*업체|할당대상업체|배출권\s*거래제|목표관리\s*(?:업체|대상)|배출량\s*명세서", None),
    ("act:energy", r"에너지\s*사용량|에너지다소비|목표관리\s*(?:업체|대상)|할당대상업체", None),
    ("sub:hazchem", r"유해화학물질|유독물질|사고대비물질|화학물질관리법", None),
    ("sub:newchem", r"화학물질의\s*등록\s*및\s*평가|화평법|K-?REACH", None),
    ("sub:dangerous", r"위험물\s*(?:안전관리|저장|취급|제조소)", None),
    ("act:ks", r"KS\s*(?:마크|표시\s*인증|인증\s*(?:제품|획득|취득|보유|을))", None),
    ("act:emc", r"전자파\s*적합성|전파\s*인증|방송통신기자재|KC\s*(?:인증|마크)", None),
    ("act:health_food", r"건강기능식품", ("II.",)),
    ("act:kids_product", r"어린이\s*제품|유아용품|완구", ("II.",)),
    ("sub:biocide", r"살생물|생활화학제품", None),
    ("permit:radiation", r"방사선\s*발생\s*장치|방사성\s*동위원소", None),
    ("act:guard", r"청원경찰", None),
    ("act:critical_infra", r"국가핵심기반|주요정보통신기반시설|국가\s*중요\s*시설", None),
    ("act:ai", r"생성형\s*(?:AI|인공지능)|인공지능\s*(?:서비스|플랫폼|모델)|AI\s*(?:서비스|플랫폼|모델)", ("II.",)),
    ("act:epay", r"전자금융업|선불\s*전자지급|전자지급결제대행|PG\s*사업|간편\s*결제\s*서비스", ("II.",)),
    ("act:location", r"위치기반\s*서비스|위치정보\s*사업", ("II.",)),
    ("act:performance", r"공연\s*(?:기획|사업|매출|개최|제작)|콘서트\s*(?:투어|개최|매출)|월드\s*투어", ("II.",)),
    ("act:broadcaster", r"방송사업자|방송채널사용사업|종합유선방송|위성방송사업|IPTV\s*사업", ("II.",)),
    ("act:animal_test", r"동물\s*실험|비임상\s*시험", None),
    ("act:foreign_investment", r"외국인\s*투자\s*기업", None),
    ("permit:integrated", r"통합\s*환경\s*허가|통합허가", None),
    ("act:cloud", r"클라우드\s*(?:컴퓨팅\s*)?(?:서비스|사업)(?:를|을)?\s*(?:제공|운영|영위)|IaaS|PaaS|SaaS|호스팅\s*서비스", ("II.",)),
    ("act:esign", r"전자서명인증사업자|(?:사설|민간)\s*인증서|인증서\s*서비스|본인확인기관", ("II.",)),
    ("act:fin_group", r"금융지주(?:회사)?(?:의|가)\s*(?:\d+(?:\.\d+)?%\s*)?(?:지분을\s*)?(?:보유|소유)|금융지주회사의\s*(?:완전\s*)?자회사|최대주주\S{0,6}\s*\S*금융지주", None),
    ("site:owned", r"(?:본사|사옥)\s*(?:건물|빌딩)?\s*(?:을|를)?\s*(?:자가|소유|취득|매입|신축)|자가\s*사옥|사옥\s*(?:매입|신축|준공)", ("II.", "IV.")),
    ("act:vc", r"창업투자회사|벤처투자회사|벤처투자조합|창업기획자|신기술사업투자조합", ("II.",)),
    ("act:bio_material", r"혈장\s*분획|혈액제제|인체조직|세포치료제|줄기세포\s*치료|유전자치료제|첨단바이오의약품|제대혈", ("II.",)),
    ("act:port", r"전용\s*부두|자가\s*부두|부두\s*(?:시설|운영)|항만\s*하역|선적\s*부두", ("II.",)),
    ("ind:defense", r"방산업체|방위산업체|방산물자|방위사업청(?:과의?|에)\s*(?:계약|납품)", ("II.",)),
    ("act:parcel", r"택배\s*(?:사업|서비스|물량|시장)", ("II.",)),
    ("site:factory", r"가동률|생산능력|생산\s*실적", ("II.",)),
    ("ind:railway", r"철도\s*차량|전동차|고속\s*열차|도시철도\s*차량", ("II.",)),
    ("ind:fishery", r"원양\s*어업|(?:선망|연승|트롤|오징어\s*채낚기)\s*어선|어선\s*\d+\s*척", ("II.",)),
    ("act:union", r"노동조합\s*(?:원|가입|조합원|이\s*(?:있|결성|조직)|과\s*(?:단체|임금))|단체\s*협약", None),
]
NEGATIVE = [
    ("act:union", r"노동조합(?:이|은)\s*(?:없|조직되어\s*있지\s*않|결성되어\s*있지\s*않)"),
]


# 인허가가 필요한 활동은 연결 자회사 설명이 아니라 회사 자신의 사업일 때만 인정한다 (사업보고서는 연결 기준으로 쓴다)
SELF_ONLY = {"ind:railway", "ind:fishery", "ind:defense", "act:health_food", "act:kids_product", "act:parcel", "act:bio_material", "act:port", "act:vc", "act:epay", "act:broadcaster", "act:location", "act:esign", "act:cloud", "act:si", "act:franchise", "act:direct_sales",
             "act:public_contract", "act:ai", "act:performance"}
SELF_RX = re.compile(r"당사|당행|회사는|회사가|우리\s*회사")
OTHER_RX = re.compile(r"종속(?:회사|기업)|자회사|계열사|관계(?:회사|기업)|연결\s*대상|지분\s*법")


NONE_AFTER = re.compile(r"해당\s*사항\s*(?:이\s*)?없|해당\s*없|없습니다|기재\s*생략")


def _real(body, m):
    """목차 제목·'해당사항 없음' 문장이 아닌지 (바로 뒤 40자에 '해당사항 없음'이 오면 버린다)."""
    return not NONE_AFTER.search(body[m.end():m.end() + 40])


def _own(body, m):
    before = body[max(0, m.start() - 120):m.start()]
    return bool(SELF_RX.search(before)) and not OTHER_RX.search(before[-60:])


def _snippet(text, m, width=60):
    a, b = max(0, m.start() - width), min(len(text), m.end() + width)
    return ("…" if a else "") + text[a:b].strip() + ("…" if b < len(text) else "")


def _export(secs):
    """매출 표의 수출·내수 금액 → (수출액, 합계, 근거 문장) 또는 None."""
    two = next((v for k, v in secs.items() if k.startswith("II.")), "")
    m = re.search(r"(?:합\s*계|총\s*계)\s*수출\s*([\d,]+)\s.*?내수\s*([\d,]+)", two)
    if not m:
        m = re.search(r"수출\s*([\d,]{3,})\s.{0,80}?내수\s*([\d,]{3,})", two)
    if not m:
        return None
    ex, dom = (int(x.replace(",", "") or 0) for x in m.groups())
    return ex, ex + dom, _snippet(two, m, 30)


def evidence(c):
    """회사 하나 → {corp_code, ksic, report, employees, facts: {사실: {value, evidence, source}}}. 키가 없거나 못 찾으면 None."""
    if not enabled():
        return None
    try:
        code = match(c)
        if not code:
            return None
        info = company(code)
        out = {"corp_code": code, "corp_name": info.get("corp_name"), "ksic": info.get("induty_code") or "",
               "corp_cls": info.get("corp_cls"), "report": None, "employees": None, "facts": {},
               "status": disclosure_status(code, info)}
        rep = latest_report(code)
        if not rep:
            return out
        out["report"] = rep
        src = rep["url"]
        label = "사업보고서 " + re.sub(r"^사업보고서\s*", "", rep["report"])
        secs = report_sections(rep["rcept_no"])
        facts = out["facts"]

        def put(fact, value, ev):
            if fact not in facts:
                facts[fact] = {"value": value, "evidence": f"{label}: {ev}", "source": src}

        ex = _export(secs)
        if ex:
            e, tot, snip = ex
            if e > 0:
                put("act:export", True, f"매출 중 수출 {e:,} ({e / tot:.0%}) — {snip}" if tot else snip)
            else:
                put("act:export", False, f"매출이 모두 내수 — {snip}")
        for fact, rx in NEGATIVE:
            for title, body in secs.items():
                m = re.search(rx, body)
                if m:
                    put(fact, False, _snippet(body, m))
                    break
        for fact, rx, where in PATTERNS:
            hit = None
            for title, body in secs.items():
                if where and not title.startswith(where):
                    continue
                for m in re.finditer(rx, body):
                    if _real(body, m) and (fact not in SELF_ONLY or _own(body, m)):
                        hit = (body, m)
                        break
                if hit:
                    break
            if hit:
                put(fact, True, _snippet(*hit))
        # 사업의 내용(II.)에 IT 서비스 · 시스템 통합 사업이 여러 번 나오면 회사 사업으로 본다
        # ('회사와 연결 종속회사는 IT서비스 사업과 …을 영위' 처럼 종속회사와 함께 쓰는 문장이 많아 한 문장으로는 판단하지 않는다)
        # — 사업의 개요(II. 첫머리)에 나와야 회사 자신의 사업이다 (뒤쪽 종속회사 설명만 있으면 아니다: 한국전력 → 한전KDN)
        biz = " ".join(b for t, b in secs.items() if t.startswith("II."))
        head = biz[:1500]
        it_rx = r"IT\s*서비스|시스템\s*통합|System\s*Integration|정보시스템\s*(?:구축|운영)|(?:ERP|MES)\s*(?:시스템\s*)?구축|IT\s*아웃소싱"
        n_it = len(re.findall(it_rx, biz))
        if n_it >= 5 and re.search(it_rx, head) and "act:si" not in facts:
            put("act:si", True, f"사업의 개요에 IT 서비스 · 시스템 통합 사업 (사업의 내용 {n_it}곳) — " + _snippet(head, re.search(it_rx, head)))
        game_rx = r"게임\s*(?:개발|퍼블리싱|서비스|사업)|(?:온라인|모바일|PC|콘솔)\s*게임|MMORPG"
        # 자회사가 주어인 문장('…카카오게임즈는 모바일 게임…', '종속회사는 …')은 회사 자신의 사업이 아니다
        own = [m for m in re.finditer(game_rx, head)
               if not OTHER_RX.search(head[max(0, m.start() - 60):m.start()]) and not re.search(r"[가-힣A-Za-z]+게임즈", head[max(0, m.start() - 60):m.start()])]
        if own and len(re.findall(game_rx, biz)) >= 3 and "ind:game" not in facts:
            put("ind:game", True, "사업의 개요에 게임 사업 — " + _snippet(head, own[0]))
        year = int(re.search(r"\((\d{4})\.", rep["report"]).group(1)) if re.search(r"\((\d{4})\.", rep["report"]) else date.today().year - 1
        emp = employees(code, year)
        if emp and emp["total"]:
            out["employees"] = emp["total"]
            put("act:fixed_term", emp["contract"] > 0, f"직원 {emp['total']:,}명 중 기간제(계약직) {emp['contract']:,}명")
        return out
    except Exception as e:  # 네트워크·한도 문제는 판정을 막지 않는다 (공공데이터만으로 계속)
        return {"error": str(e)}


def ksic_tags(code, name=""):
    """표준산업분류 코드 → 업종 태그 (kb/ksic_map.json, 가장 긴 앞자리)."""
    m = json.loads((ROOT / "kb" / "ksic_map.json").read_text(encoding="utf-8"))["prefix"]
    for n in range(len(code), 1, -1):
        if code[:n] in m:
            tags = list(m[code[:n]])
            if "ind:holding" in tags and "금융" in (name or ""):
                tags = ["ind:fin_holding"]
            return tags
    return []


def main(argv):
    from engine import companydb as cdb
    if not enabled():
        print(".env 에 OPENDART_KEY 가 없습니다.")
        return 1
    for q in argv:
        r = cdb.search(q)
        if not r:
            print(q, "회사 없음")
            continue
        c = cdb.get(r[0]["key"])
        ev = evidence(c)
        print(f"== {q} → {c['name']}")
        if not ev:
            print("   OpenDART 에서 찾지 못함")
            continue
        if ev.get("error"):
            print("   오류:", ev["error"])
            continue
        print(f"   {ev['corp_name']} ({ev['corp_code']}) 업종코드 {ev['ksic']} → {ksic_tags(ev['ksic'], ev['corp_name'])}")
        print(f"   {(ev['report'] or {}).get('report', '사업보고서 없음')} · 직원 {ev['employees']}")
        for f, v in ev["facts"].items():
            print(f"   {'예' if v['value'] else '아니오'} {f}: {v['evidence'][:150]}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
