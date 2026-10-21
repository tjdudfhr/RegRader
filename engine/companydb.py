"""공공데이터로 회사 찾기 (무료, 내 컴퓨터 안에서 검색한다).

- 국민연금 가입 사업장 내역 (국민연금공단, 매월 갱신): 사업장명·주소·업종·가입자 수
  https://www.data.go.kr/data/15083277/fileData.do
- 전국등록공장현황 (한국산업단지공단, 매년 갱신): 회사명·산업단지·생산품·공장주소
  https://www.data.go.kr/data/15105482/fileData.do
둘 다 이용허락 제한 없음. 원본은 data/raw/ 에 두고, build() 가 data/companies.sqlite 를 만든다.

    python3 -m engine.companydb build        # 원본 파일을 바꾼 뒤 한 번
    python3 -m engine.companydb search 회사명
"""
import csv
import json
import re
import sqlite3
import sys
import unicodedata
from contextlib import closing
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
DB = ROOT / "data" / "companies.sqlite"
SOURCES = [
    {"url": "https://www.data.go.kr/data/15083277/fileData.do", "title": "국민연금 가입 사업장 내역 (국민연금공단)"},
    {"url": "https://www.data.go.kr/data/15105482/fileData.do", "title": "전국등록공장현황 (한국산업단지공단)"},
]

SIDO = {
    "서울특별시": "서울", "부산광역시": "부산", "대구광역시": "대구", "인천광역시": "인천", "광주광역시": "광주",
    "대전광역시": "대전", "울산광역시": "울산", "세종특별자치시": "세종", "경기도": "경기", "강원도": "강원",
    "강원특별자치도": "강원", "충청북도": "충북", "충청남도": "충남", "전라북도": "전북", "전북특별자치도": "전북",
    "전라남도": "전남", "경상북도": "경북", "경상남도": "경남", "제주특별자치도": "제주", "제주도": "제주",
}
SIDO.update({v: v for v in list(SIDO.values())})
METRO = {"서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종"}
CORP_MARKS = re.compile(
    r"\(주\)|㈜|주식회사|\(유\)|유한회사|유한책임회사|\(합\)|합자회사|합명회사|\(사\)|사단법인|\(재\)|재단법인"
    r"|농업회사법인|영농조합법인|의료법인|학교법인|사회복지법인|\(株\)|co\.?,?\s*ltd\.?|inc\.?|corp\.?", re.I)


MARK = re.compile(r"\(주\)|㈜|주식회사|\(유\)|유한회사|\(株\)|의료법인|학교법인|사회복지법인")
SEP = re.compile(r"[\s(\[\-_/·,]")
# 회사 이름을 단 다른 단체 (같은 회사로 묶지 않는다)
NON_COMPANY = re.compile(r"어린이집|새마을금고|노동조합|노조|신용협동조합|신협|근로복지기금|공제회|상조회|협의회|장학회|동호회|직장보육")
# 국민연금 사업장 이름 끝에 붙는 가입 구분 · 부서 표시 — 회사 이름이 아니다 (화면에 보일 이름에서 뗀다)
#   '현대건설(주) 임직원', '(주)대우건설 본사', '서산시청(직장)', '제주특별자치도교육청 총무과', '테라뷰리미티드(영업소)'
# 지점 · 공장 · 병원 · 지역본부처럼 법인을 가르는 이름은 떼지 않는다 (같은 이름의 다른 법인과 구별해야 한다)
WP_TAIL = re.compile(
    r"[\s/\-_·,]*[(（]?\s*(?:"
    r"임직원|교직원|직원|근로자|일용근로자|일용직|일용|상용|일반|직장|본사인원|본사|본점|본청|계약직|무기계약직|무기계약|기간제|전일제|"
    r"공무직(?:\s*근로자)?(?:\s*등)?|교육공무직원?|비공무원|시간강사|회계직원|학교회계직원|대학회계|급식종사자|기타직|국민연금담당자|"
    r"건설일용(?:관리)?|도급|영업소|연락사무소|행정실|총괄|[가-힣]{1,8}과(?:\s*[가-힣]{1,4}계)?|[가-힣]{1,6}팀"
    r")\s*[)）]?\s*$")
EN_TAIL = re.compile(r"\s*[(（][\sA-Za-z0-9&.,'’\-]*[A-Za-z][\sA-Za-z0-9&.,'’\-]*[)）]\s*$")   # 영문 이름 덧붙임 '(Kakao Style Corp.)'


def clean_name(name, st):
    """사업장 이름 → 화면에 보일 회사 이름. 뒤에 붙은 가입 구분 · 부서 · 영문 표기를 떼고 남은 이름이 회사명 줄기와 같을 때만 쓴다
    ('현대건설(주) 임직원' → '현대건설(주)'). 같지 않으면 None (떼면 안 되는 이름: '(주) 녹십자 홀딩스')."""
    s = unicodedata.normalize("NFKC", name or "").strip()
    for _ in range(3):
        cut = WP_TAIL.sub("", s) if WP_TAIL.search(s) else EN_TAIL.sub("", s)
        cut = cut.strip(" -_/·,")
        if not cut or cut == s:
            return None
        s = cut
        if hangul(norm(s)) == st:
            return s
    return None


def norm(name):
    """회사명 비교용: 법인 표시·공백·기호를 뺀다."""
    s = unicodedata.normalize("NFKC", name or "")
    s = re.sub(r"(?<=[A-Za-z])\s*&\s*(?=[A-Za-z])", "앤", s)  # 'KT&G' → 'kt앤g' → 케이티앤지
    return re.sub(r"[\W_]+", "", CORP_MARKS.sub("", s)).lower()


LETTERS = dict(zip("abcdefghijklmnopqrstuvwxyz", ["에이", "비", "씨", "디", "이", "에프", "지", "에이치", "아이", "제이", "케이", "엘", "엠",
                                                  "엔", "오", "피", "큐", "알", "에스", "티", "유", "브이", "더블유", "엑스", "와이", "지"]))
WORDS = {"posco": "포스코", "naver": "네이버", "soil": "에쓰오일", "kakao": "카카오", "hyundai": "현대", "samsung": "삼성"}


def hangul(n):
    """정규화한 이름 속 영문을 한글 읽기로 ('sk하이닉스' → '에스케이하이닉스', '삼성sdi' → '삼성에스디아이', 'posco홀딩스' → '포스코홀딩스')."""
    if not n or not re.search(r"[a-z]", n):
        return n
    return re.sub(r"[a-z]+", lambda m: WORDS.get(m.group(0)) or "".join(LETTERS[c] for c in m.group(0)), n)


def stem(name):
    """사업장명 → 회사명 줄기. '롯데케미칼(주) 여수공장', '(주)에코프로비엠(CAM5)' → '롯데케미칼', '에코프로비엠'."""
    s = unicodedata.normalize("NFKC", name or "").strip()
    m = MARK.search(s)
    if m and s[:m.start()].strip():
        base, rest = s[:m.start()], s[m.end():]
    else:
        tail = s[m.end():].strip() if m else s
        cut = SEP.split(tail, maxsplit=1)
        base, rest = cut[0], (cut[1] if len(cut) > 1 else "")
    if NON_COMPANY.search(rest):
        return hangul(norm(s))
    # 영문은 한글 읽기로 통일한다 (등록공장 'LG전자'와 국민연금 '엘지전자'가 한 회사가 되도록)
    return hangul(norm(base) or norm(s))


def place(addr):
    """주소 → (시·도 약칭, 시·군 이름). 광역시는 시·군을 비운다."""
    t = (addr or "").replace(",", " ").split()
    if not t:
        return "", ""
    first, second = t[0], (t[1] if len(t) > 1 else "")
    if first == "전남광주통합특별시":  # 2026년 통합: 구는 옛 광주광역시, 시·군은 옛 전라남도
        sido = "광주" if second.endswith("구") else "전남"
    else:
        sido = SIDO.get(first, "")
    city = second[:-1] if sido and sido not in METRO and second.endswith(("시", "군")) and len(second) > 1 else ""
    return sido, city


def area(addr):
    """주소 → (시·도, 시·군·구). 이름이 같은 다른 회사를 가를 때 쓴다 (광역시는 구까지)."""
    t = (addr or "").replace(",", " ").split()
    sido = place(addr)[0]
    return sido, (t[1] if sido and len(t) > 1 else "")


# ---------------------------------------------------------------- 색인 만들기

def _unzip_factory():
    """공장 zip 을 받았으면 CSV 만 꺼낸다 (압축 안의 경로는 쓰지 않는다)."""
    import zipfile
    for z in (RAW / "factory").glob("*.zip"):
        out = RAW / "factory" / (z.stem + ".csv")
        if out.exists() and out.stat().st_mtime >= z.stat().st_mtime:
            continue
        with zipfile.ZipFile(z) as zf:
            members = [m for m in zf.infolist() if m.filename.lower().endswith(".csv")]
            if members:
                big = max(members, key=lambda m: m.file_size)
                with zf.open(big) as src, open(out, "wb") as dst:
                    dst.write(src.read())


def raw_files():
    _unzip_factory()
    newest = lambda ps: max(ps, key=lambda p: p.stat().st_mtime) if ps else None  # noqa: E731
    nps = newest(list((RAW / "nps").glob("*.csv")))
    fac = newest([p for p in (RAW / "factory").rglob("*.csv") if "사전" not in p.name and p.stat().st_size > 1_000_000])
    if not nps or not fac:
        raise SystemExit("data/raw/nps/*.csv 와 data/raw/factory 자료가 필요합니다: python3 -m engine.datasets download nps factory")
    return nps, fac


def _rows(path, encoding="cp949"):
    with open(path, encoding=encoding, errors="replace", newline="") as f:
        r = csv.reader(f)
        head = next(r)
        for row in r:
            yield dict(zip(head, row))


def _col(row, prefix):
    for k, v in row.items():
        if k.startswith(prefix):
            return v
    return ""


def build():
    nps_path, fac_path = raw_files()
    tmp = DB.with_suffix(".tmp")
    tmp.unlink(missing_ok=True)
    con = sqlite3.connect(tmp)
    con.executescript("""
        CREATE TABLE nps(name TEXT, norm TEXT, stem TEXT, bizno TEXT, corp INTEGER, addr TEXT, sido TEXT, city TEXT,
                         ind_cd TEXT, ind_nm TEXT, members INTEGER, since TEXT);
        CREATE TABLE factory(name TEXT, norm TEXT, stem TEXT, complex TEXT, products TEXT, addr TEXT, sido TEXT, city TEXT);
        CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT);
    """)
    ym, batch = "", []
    for row in _rows(nps_path):
        if _col(row, "사업장가입상태코드") != "1":  # 탈퇴 사업장은 뺀다
            continue
        name = _col(row, "사업장명").strip()
        addr = (_col(row, "사업장도로명상세주소") or _col(row, "사업장지번상세주소")).strip()
        sido, city = place(addr)
        ym = ym or _col(row, "자료생성년월")
        batch.append((name, norm(name), stem(name), _col(row, "사업자등록번호"), _col(row, "사업장형태구분코드") == "1", addr, sido, city,
                      row.get("사업장업종코드", ""), _col(row, "사업장업종코드명").strip(),
                      int(_col(row, "가입자수") or 0), _col(row, "적용일자")))
    con.executemany("INSERT INTO nps VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", batch)
    batch = []
    for row in _rows(fac_path):
        name = row.get("회사명", "").strip()
        addr = row.get("공장주소", "").strip()
        sido, city = place(addr)
        batch.append((name, norm(name), stem(name), row.get("단지명", "").strip(), row.get("생산품", "").strip(), addr, sido, city))
    con.executemany("INSERT INTO factory VALUES (?,?,?,?,?,?,?,?)", batch)
    counts = _build_permits(con)
    counts.update(_build_listed(con))
    fac_date = re.search(r"(\d{8})", fac_path.name)
    con.executemany("INSERT INTO meta VALUES (?,?)", [
        ("nps", ym), ("factory", f"{fac_date.group(1)[:4]}-{fac_date.group(1)[4:6]}-{fac_date.group(1)[6:]}" if fac_date else ""),
        ("npsFile", nps_path.name), ("factoryFile", fac_path.name)])
    from datetime import date
    con.executemany("INSERT INTO meta VALUES (?,?)", [(f"permit:{k}", str(v)) for k, v in counts.items()]
                    + [("permits", date.today().isoformat())])
    # 검색용 요약: 회사명 줄기마다 가입자 합계 (검색은 이 표만 훑는다)
    con.executescript("""
        CREATE TABLE stems AS SELECT stem, SUM(members) AS members, COUNT(*) AS n FROM nps GROUP BY stem;
        INSERT INTO stems SELECT stem, 0, COUNT(*) FROM factory WHERE stem NOT IN (SELECT stem FROM stems) GROUP BY stem;
    """)
    con.executescript("CREATE INDEX nps_stem ON nps(stem); CREATE INDEX factory_stem ON factory(stem); CREATE INDEX stems_stem ON stems(stem);"
                      "CREATE INDEX permit_stem ON permit(stem); CREATE INDEX permit_src ON permit(src);")
    counts["branches"] = _build_branches(con)
    con.commit()
    n_nps = con.execute("SELECT count(*) FROM nps").fetchone()[0]
    n_fac = con.execute("SELECT count(*) FROM factory").fetchone()[0]
    con.close()
    tmp.replace(DB)
    return {"nps": n_nps, "factory": n_fac, "asOf": ym, "permits": counts}


# 인허가 자료: 이름이 있으면 해당 입력 항목을 '확인'으로 고른다 (engine/datasets.py 의 SOURCES 와 같은 이름)
PERMITS = {
    "air": {"tags": ["permit:air"], "detail": ["종별명", "업종구분명"]},
    "gas": {"tags": ["permit:gas"], "detail": ["업태구분명"]},
    "sgas": {"tags": ["permit:gas", "sub:gas"], "detail": []},
    "meal": {"tags": ["site:cafeteria"], "detail": []},
    "food": {"tags": ["act:food_mfg"], "detail": []},
    "warehouse": {"tags": ["site:warehouse"], "detail": []},
    "dust": {"tags": ["permit:dust"], "name": "사업자명(상호)", "detail": ["발생사업명"]},
    "ecommerce": {"tags": ["act:consumer_online"], "detail": ["업태구분명"]},
    "water": {"tags": ["permit:water"], "detail": ["업종구분명"], "encoding": "utf-8"},
    "noise": {"tags": ["permit:noise"], "name": "시설명", "detail": ["소음진동구분명"], "encoding": "utf-8"},
    "waste": {"tags": ["permit:waste"], "detail": ["폐기물분류명", "폐기물세부종류명"], "encoding": "utf-8"},
}
ADDR_COLS = ("도로명주소", "지번주소", "소재지도로명주소", "소재지지번주소", "관리기관명")
DATE_COLS = ("인허가일자", "데이터기준일자(신고일자)", "데이터기준일자")


def _kind_rows(path):
    """KIND 상장법인목록 (.xls 이지만 EUC-KR HTML 표)."""
    import html as H
    t = path.read_bytes().decode("cp949", "ignore")
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", t, re.S)
    head = None
    for r in rows:
        cells = [H.unescape(re.sub(r"<[^>]+>", "", c)).strip() for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", r, re.S)]
        if head is None:
            head = cells
            continue
        if len(cells) == len(head):
            yield dict(zip(head, cells))


def _fin_rows(path):
    """DART 사업보고서 재무상태표 일괄 zip → 회사별 자산총계 (별도를 연결보다 앞에)."""
    import io
    import zipfile
    with zipfile.ZipFile(path) as z:
        members = []
        for m in z.infolist():
            try:
                nm = m.filename.encode("cp437").decode("cp949")
            except (UnicodeEncodeError, UnicodeDecodeError):
                nm = m.filename
            members.append((0 if "연결" not in nm else 1, nm, m))
        for basis, nm, m in sorted(members, key=lambda x: x[0]):
            with z.open(m) as f:
                r = csv.reader(io.TextIOWrapper(f, encoding="cp949", errors="replace", newline=""), delimiter="\t")
                head = [h.strip() for h in next(r)]
                ix = {h: i for i, h in enumerate(head)}
                for row in r:
                    if len(row) <= ix["당기"] or row[ix["항목코드"]].strip() != "ifrs-full_Assets":
                        continue
                    yield {"code": row[ix["종목코드"]].strip("[] "), "name": row[ix["회사명"]].strip(),
                           "market": row[ix["시장구분"]].strip(), "fyEnd": row[ix["결산기준일"]].strip(),
                           "currency": row[ix["통화"]].strip(), "assets": row[ix["당기"]].replace(",", "").strip(),
                           "basis": "연결" if basis else "별도"}


def _stem_index(con):
    """국민연금·공장 회사명 줄기 → (가입자 수, 시·도들, 법인 여부). 앞 두 글자로 묶어 둔다."""
    stems = {}
    for st, m, sido, bz in con.execute("SELECT stem, members, sido, bizno FROM nps"):
        e = stems.setdefault(st, [0, set(), False])
        e[0] += m or 0
        e[1].add(sido)
        e[2] = e[2] or _kind(bz) in ("c", "b")
    for st, sido in con.execute("SELECT stem, sido FROM factory"):
        e = stems.setdefault(st, [0, set(), True])
        e[1].add(sido)
    by2 = {}
    for st in stems:
        by2.setdefault(st[:2], []).append(st)
    return {"stems": stems, "by2": by2, "all": [st for st, v in stems.items() if v[0] >= 50]}


def _subseq(short, long):
    it = iter(long)
    return all(ch in it for ch in short)


def link_listed(st, sido, index):
    """상장사 이름(줄기) → 국민연금 회사명 줄기. ('신한지주' → '신한금융지주회사', 'sk하이닉스' → '에스케이하이닉스')

    1) 이름이 같거나 영문을 한글로 읽은 이름이 같음  2) 앞 두 글자가 같고 상장사 이름 글자가 순서대로 다 들어 있음
    (예: 신한·지주 → 신한금융지주회사). 여럿이면 상장사 소재 시·도에 사업장이 있는 법인 중 가입자가 많은 쪽.
    """
    stems = index["stems"]
    exact = [k for k in dict.fromkeys([hangul(st), st]) if k in stems]
    if exact:
        k = max(exact, key=lambda x: stems[x][0])
        if stems[k][0] >= 50 or len(k) < 3:
            return k, "같은 이름"
        # 같은 이름의 회사가 아주 작으면 (예: '엠브레인' 몇 명) 이름을 품은 큰 법인이 진짜일 수 있다 ('마크로밀엠브레인').
        # 이름 뒤에 붙인 경우만 본다 — 앞에 붙은 '에이치디현대오일뱅크'는 'HD현대'(지주회사)가 아니라 계열사다.
        bigger = [c for c in index["all"] if c.endswith(k) and c != k and stems[c][2] and (not sido or sido in stems[c][1])
                  and stems[c][0] >= max(50, stems[k][0] * 10)]
        if bigger:
            return max(bigger, key=lambda c: stems[c][0]), "이름 포함"
        return k, "같은 이름"
    best = None
    for k in dict.fromkeys([st, hangul(st)]):
        if len(k) < 2:
            continue
        for cand in index["by2"].get(k[:2], []):
            if cand == k or not _subseq(k, cand) or len(cand) > len(k) + 8:
                continue
            members, sidos, corp = stems[cand]
            if not corp or (sido and sido not in sidos):
                continue
            score = (members, -len(cand))
            if best is None or score > best[0]:
                best = (score, cand)
    return (best[1], "약칭") if best else ("", "")


def _dart_listed():
    """상장사 종목코드 → (DART 정식 회사명, 사업자등록번호). OpenDART 기업개황을 받아 둔 것만 읽는다 (네트워크 없이).
    기업개황은 회사 정보를 만들 때(opendart.company) 받아 .cache/opendart 에 쌓인다."""
    out = {}
    for p in (ROOT / ".cache" / "opendart").glob("company.json_*.json"):
        try:
            j = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        code = (j.get("stock_code") or "").strip()
        if code and j.get("corp_name"):
            out[code] = (j["corp_name"].strip(), re.sub(r"\D", "", j.get("bizr_no") or ""))
    return out


def _biz_stems(con):
    """사업자등록번호 앞 6자리(국민연금 자료) → [(회사명 줄기, 사업장 이름(정규화 · 한글 읽기), 가입자 수)] (법인 본점만)."""
    out = {}
    for st, nm, bz, m in con.execute("SELECT stem, name, bizno, members FROM nps"):
        if _kind(bz) == "c":
            out.setdefault(bz, []).append((st, hangul(norm(nm)), m or 0))
    return out


def dart_link(krx_stem, official, bizr, heur, index, biz_stems):
    """상장사 → 국민연금 회사(회사명 줄기 + 사업자등록번호 앞 6자리)를 DART 기업개황(정식 회사명 · 사업자등록번호)으로 맞춘다.

    거래소 이름은 약칭이라('한전기술' · 'GKL' · '아이앤씨') 이름만으로 붙이면 이름이 비슷한 다른 회사에 붙는다
    ('한전기술서비스' · '지케이엘위드' · '대아이앤씨'). 사업자등록번호 앞 6자리가 같은 법인 사업장 중 이름이 정식 이름과 같거나
    정식 이름으로 시작하는 것('(주)금비이천공장')에 붙인다. 앞 6자리는 세무서 · 법인 구분이라 다른 회사도 같을 수 있어 이름도 맞아야 한다.
    한 줄기에 다른 상장사가 같이 있으면('녹십자' 줄기: (주)녹십자 · (주) 녹십자 홀딩스) 사업자등록번호로 법인을 가른다.
    국내 사업자등록번호가 없는 외국 회사(해외 지주회사 등)는 이름이 똑같은 국내 법인이 있을 때만 붙인다.
    """
    ost = stem(official)
    whole = hangul(re.sub(r"[\W_]+", "", MARK.sub("", unicodedata.normalize("NFKC", official))).lower())   # '(주) DB Inc.' → 디비아이엔씨
    keys = [k for k in dict.fromkeys([ost, hangul(ost), hangul(norm(official)), whole]) if k]   # 한 글자 이름도 ('(주)숲')
    stems = index["stems"]
    if len(bizr) != 10:   # 외국 회사
        same = [k for k in keys if k in stems]
        return (same[0], "정식 이름") if same else ("", "국내 법인 없음")
    rows = biz_stems.get(bizr[:6], [])

    def pick(hits):
        size = {}
        for st, _, m in hits:
            size[st] = size.get(st, 0) + m
        return max(size, key=size.get)

    hit = [x for x in rows if x[0] in keys or x[1] in keys]
    if hit:
        return pick(hit), "사업자번호"
    hit = [x for x in rows if any(x[1].startswith(k) for k in keys if len(k) >= 3)]
    if hit:
        return pick(hit), "사업자번호"
    if heur and any(x[0] == heur for x in rows):
        return heur, "사업자번호"
    same = [k for k in keys if k in stems]
    if same:   # 국민연금에 다른 사업자번호로 올라 있어도 정식 이름이 똑같으면 그 회사
        return same[0], "정식 이름"
    from difflib import SequenceMatcher   # 영문 이름을 다르게 읽은 것 ('SNT모티브' 에스엔티 ↔ 국민연금 '에스앤티모티브')
    near = [x for x in rows if len(x[1]) >= 4 and any(len(k) >= 4 and SequenceMatcher(None, x[1], k).ratio() >= 0.85 for k in keys)]
    if near:
        return pick(near), "사업자번호 · 비슷한 이름"
    return heur, ("약칭 (DART 확인 못 함)" if heur else "")


def _build_listed(con):
    con.executescript("""
        CREATE TABLE listed(name TEXT, stem TEXT, alias TEXT, market TEXT, code TEXT, industry TEXT, products TEXT,
                            since TEXT, sido TEXT, homepage TEXT, nps_stem TEXT, link TEXT, official TEXT, biz TEXT);
        CREATE TABLE fin(code TEXT, name TEXT, stem TEXT, alias TEXT, market TEXT, assets_eok REAL, basis TEXT, fy_end TEXT);
    """)
    counts = {}
    markets = {"stockMkt": "유가증권시장", "kosdaqMkt": "코스닥시장", "konexMkt": "코넥스시장"}
    index = _stem_index(con)
    dart, biz_stems = _dart_listed(), _biz_stems(con)
    n = 0
    for path in sorted((RAW / "listed").glob("*.html")):
        for r in _kind_rows(path):
            nm = r.get("회사명", "")
            st = norm(nm)  # 거래소 이름은 사업장 이름이 붙지 않은 회사명이라 자르지 않는다 ('S-Oil')
            sido = place(r.get("지역", ""))[0]
            code = r.get("종목코드", "").zfill(6)
            nps_stem, how = link_listed(st, sido, index)
            official, bizr = dart.get(code, ("", ""))
            if official:
                nps_stem, how = dart_link(st, official, bizr, nps_stem, index, biz_stems)
            con.execute("INSERT INTO listed VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (
                nm, st, hangul(st), markets.get(path.stem, r.get("시장구분", "")), code,
                r.get("업종", ""), r.get("주요제품", ""), r.get("상장일", ""), sido, r.get("홈페이지", ""), nps_stem, how,
                official, bizr[:6] if len(bizr) == 10 and how.startswith("사업자번호") else ""))
            n += 1
    if n:
        counts["listed"] = n
    zips = sorted((RAW / "fin").glob("*.zip"), key=lambda p: p.stat().st_mtime)
    if zips:
        seen, n = set(), 0
        for r in _fin_rows(zips[-1]):
            key = r["code"] or r["name"]
            if key in seen or r["currency"] != "KRW" or not r["assets"].lstrip("-").isdigit():
                continue  # 별도가 먼저 들어간다
            seen.add(key)
            st = stem(r["name"])
            con.execute("INSERT INTO fin VALUES (?,?,?,?,?,?,?,?)", (r["code"], r["name"], st, hangul(st), r["market"],
                                                                     round(int(r["assets"]) / 1e8), r["basis"], r["fyEnd"]))
            n += 1
        counts["fin"] = n
        con.execute("INSERT OR REPLACE INTO meta VALUES (?,?)", ("finFile", zips[-1].name))
    con.executescript("CREATE INDEX listed_stem ON listed(stem); CREATE INDEX listed_alias ON listed(alias); CREATE INDEX listed_nps ON listed(nps_stem);"
                      "CREATE INDEX fin_code ON fin(code); CREATE INDEX fin_stem ON fin(stem); CREATE INDEX fin_alias ON fin(alias);")
    return counts


def _active(src, row, today):
    if "영업상태명" in row:
        return row["영업상태명"] == "영업/정상"
    if src == "dust":  # 공사·설치 기간이 끝나지 않은 것, 끝 날짜가 없으면 3년 안에 시작한 것
        end, start = row.get("설치(공사)종료일") or "", row.get("설치(공사)시작일") or ""
        return end >= today if end else start >= str(int(today[:4]) - 3) + today[4:]
    return True


def _build_permits(con):
    from datetime import date
    con.execute("CREATE TABLE permit(src TEXT, name TEXT, norm TEXT, stem TEXT, addr TEXT, sido TEXT, city TEXT, date TEXT, detail TEXT)")
    today = date.today().isoformat()
    counts = {}
    for src, cfg in PERMITS.items():
        files = sorted((RAW / src).glob("*.csv"), key=lambda p: p.stat().st_mtime)
        if not files:
            continue
        n, batch = 0, []
        for row in _rows(files[-1], cfg.get("encoding", "cp949")):
            if not _active(src, row, today):
                continue
            name = (row.get(cfg.get("name", "사업장명")) or "").strip()
            st = stem(name)
            if len(st) < 2:
                continue
            addr = next((row[c].strip() for c in ADDR_COLS if (row.get(c) or "").strip()), "")
            sido, city = place(addr)
            detail = " · ".join(v for v in ((row.get(c) or "").strip() for c in cfg["detail"]) if v)
            when = next((row[c] for c in DATE_COLS if row.get(c)), "")
            batch.append((src, name, norm(name), st, addr[:80], sido, city, when[:10], detail[:80]))
            n += 1
            if len(batch) >= 50000:
                con.executemany("INSERT INTO permit VALUES (?,?,?,?,?,?,?,?,?)", batch)
                batch = []
        con.executemany("INSERT INTO permit VALUES (?,?,?,?,?,?,?,?,?)", batch)
        counts[src] = n
    return counts


# ---------------------------------------------------------------- 찾기

def ready():
    return DB.exists()


def _connect():
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    return closing(con)


def meta():
    with _connect() as con:
        return {r["key"]: r["value"] for r in con.execute("SELECT key, value FROM meta")}


def _kind(bizno):
    """사업자번호 4~5번째 자리: 80 이상 법인 (85 는 법인 지점), 그 밖은 개인."""
    t = (bizno or "")[3:5]
    if not t.isdigit():
        return "p"
    return "b" if t == "85" else "c" if int(t) >= 80 else "p"


def _assemble(nps_rows, fac_rows):
    """같은 회사의 사업장·공장을 묶는다. key = '회사명줄기|구분'.

    - 회사명 줄기가 같아야 한 회사다 ('롯데케미칼(주) 여수공장' → 롯데케미칼).
    - 법인 지점(사업자번호 xx-85)은 같은 줄기의 가장 큰 법인 본점에 붙인다. 개인사업자는 사업자번호마다 따로다.
    - 공장 자료에는 사업자번호가 없어 같은 시·군(광역시는 시·도)에 사업장이 있는 회사에 붙인다.
      회사가 하나뿐이면 모두 붙이고, 맞는 회사가 없으면 공장만 있는 회사로 둔다.
    """
    by_stem = {}
    for r in nps_rows:
        by_stem.setdefault(r["stem"], ([], []))[0].append(dict(r))
    for r in fac_rows:
        by_stem.setdefault(r["stem"], ([], []))[1].append(dict(r))
    groups = {}
    for st, (wps, facs) in by_stem.items():
        ents = {}
        heads = {}
        for w in wps:
            if _kind(w["bizno"]) == "c":
                heads[w["bizno"]] = heads.get(w["bizno"], 0) + w["members"]
        head = max(heads, key=heads.get) if heads else None
        for w in wps:
            k = _kind(w["bizno"])
            ek = f"c{w['bizno']}" if k == "c" else (f"c{head}" if head else "b") if k == "b" else f"p{w['bizno']}"
            ents.setdefault(f"{st}|{ek}", {"stem": st, "workplaces": [], "factories": []})["workplaces"].append(w)
        for e in ents.values():
            e["members"] = sum(w["members"] for w in e["workplaces"])
            e["places"] = {(w["sido"], w["city"]) for w in e["workplaces"]}
        real = list(ents.values())

        def near(f, e):
            return (f["sido"], f["city"]) in e["places"] if f["city"] else any(sd == f["sido"] for sd, _ in e["places"])

        for f in facs:
            if len(real) == 1:
                e = real[0]
            else:
                cands = [e for e in real if near(f, e)]
                e = max(cands, key=lambda e: e["members"]) if cands else None
            if e is None:  # 공장만 있는 회사 (사업장이 여럿이면 지역별로 나눈다)
                ek = f"@{f['sido']}{f['city']}" if real else "@"
                e = ents.setdefault(f"{st}|{ek}", {"stem": st, "workplaces": [], "factories": [], "members": 0, "places": set()})
            e["factories"].append(f)
        groups.update(ents)
    per_stem = {}
    for k, e in groups.items():
        e["key"] = k
        per_stem[e["stem"]] = per_stem.get(e["stem"], 0) + 1
    for e in groups.values():
        e["solo"] = per_stem[e["stem"]] == 1  # 이 이름의 회사가 하나뿐
    return groups


def _view(g, n="", keys=()):
    wps = sorted(g["workplaces"], key=lambda w: -w["members"])
    facs = g["factories"]
    names = [w["name"] for w in wps] + [f["name"] for f in facs]
    # 이름: 회사명 줄기와 같은 사업장 이름 중 가장 흔한 것 (같으면 큰 사업장 쪽) → 없으면 가입 구분 · 부서 표시를 뗀 이름 → 가장 짧은 이름
    exact = [x for x in names if hangul(norm(x)) == g["stem"]]
    if not exact:
        exact = [c for c in (clean_name(x, g["stem"]) for x in names) if c]
    name = max(dict.fromkeys(exact), key=exact.count) if exact else min(names, key=len)
    top = next((w for w in wps if (w["ind_cd"] or "")[:2] not in ("99", "00")), wps[0] if wps else {})
    st = g["stem"]
    keys = keys or (n,)
    match = 0 if st in keys else 1 if any(st.startswith(k) for k in keys) else 2
    sidos = list(dict.fromkeys([w["sido"] for w in wps if w["sido"]] + [f["sido"] for f in facs if f["sido"]]))
    return {
        "key": g["key"], "stem": st, "solo": g.get("solo", True), "name": name, "match": match, "corp": bool(top.get("corp")),
        "industry": {"code": top.get("ind_cd", ""), "name": top.get("ind_nm", "")},
        "employees": g["members"], "workplaceCount": len(wps), "factoryCount": len(facs),
        "address": top.get("addr") or (facs[0]["addr"] if facs else ""),
        "sidos": sidos,
        "workplaces": [{k: w[k] for k in ("name", "addr", "sido", "city", "ind_cd", "ind_nm", "members")} for w in wps],
        "factories": [{k: f[k] for k in ("name", "complex", "products", "addr", "sido", "city")} for f in facs],
    }


def search(q, limit=12):
    """회사명 일부 → 회사 후보 (같은 회사의 사업장·공장을 합친 것).

    순위 = 이름 일치(같음 > 앞부분 > 포함) + 회사 규모(국민연금 가입자) + 상장사. 이름이 같은 작은 회사가
    큰 회사를 밀어내지 않게 한다 ('신한' → 신한은행·신한카드·신한금융지주회사가 위로).
    """
    import math
    n = norm(q)
    if not n:
        return []
    one = len(n) == 1   # 한 글자 이름('(주)숲')은 이름이 똑같은 곳만
    org = bool(NON_COMPANY.search(q))   # '새마을금고중앙회' · '군인공제회' 처럼 그 이름을 직접 찾으면 빼지 않는다
    main_keys = [k for k in dict.fromkeys([hangul(n), n]) if len(k) >= (1 if one else 2)]
    # 보조 검색어: 지점명을 뗀 회사명 ('기아(주)AutoLand화성' → '기아'). 검색어 그대로는 아무것도 없을 때만 쓴다
    # (늘 쓰면 '법무법인 한별' 이 '법무법인' 으로 잘려 더 큰 법무법인들이 앞선다)
    cut = stem(q)
    keys = list(main_keys)
    with _connect() as con:
        size, listed, by_name = {}, {}, set()

        def look(ks):
          for k in ks:
            like = k if one else f"%{k}%"
            try:
                rows = con.execute("SELECT stem, members AS m FROM stems WHERE stem LIKE ? ORDER BY members DESC LIMIT 400", (like,))
            except sqlite3.OperationalError:  # 요약표가 없는 옛 색인
                rows = con.execute("SELECT stem, SUM(members) AS m FROM nps WHERE stem LIKE ? GROUP BY stem ORDER BY m DESC LIMIT 400", (like,))
            for r in rows:
                size[r["stem"]] = max(size.get(r["stem"], 0), r["m"] or 0)
            try:
                for r in con.execute("SELECT * FROM listed WHERE (name LIKE ? OR stem LIKE ? OR alias LIKE ? OR nps_stem LIKE ?) AND nps_stem != ''",
                                     (f"%{q.strip()}%", like, like, like)):   # 정식 이름(국민연금 줄기)으로 찾아도 ('한국전력기술' ← 거래소 '한전기술')
                    rows_ = listed.setdefault(r["nps_stem"], [])
                    if all(x["code"] != r["code"] for x in rows_):
                        rows_.append(dict(r))
            except sqlite3.OperationalError:
                pass

        look(main_keys)
        if not one and not any(k in size for k in main_keys):
            # 줄기는 띄어쓰기에서 잘린다 ('(주) 녹십자 홀딩스' → 녹십자): 이름이 같은 줄기가 없으면 사업장 이름 전체로도 찾는다
            for k in main_keys:
                for r in con.execute("SELECT stem, SUM(members) AS m FROM nps WHERE norm LIKE ? GROUP BY stem ORDER BY m DESC LIMIT 100", (f"%{k}%",)):
                    size[r["stem"]] = max(size.get(r["stem"], 0), r["m"] or 0)
                    if not any(x in r["stem"] for x in main_keys):   # 줄기로도 맞는 회사는 원래대로
                        by_name.add(r["stem"])
            for st in by_name:   # 이름으로 찾은 회사도 상장 정보를 붙인다
                try:
                    for r in con.execute("SELECT * FROM listed WHERE nps_stem = ?", (st,)):
                        rows_ = listed.setdefault(st, [])
                        if all(x["code"] != r["code"] for x in rows_):
                            rows_.append(dict(r))
                except sqlite3.OperationalError:
                    pass
        if not size and not listed and not one and len(cut) >= 2 and cut not in main_keys:
            keys = main_keys + [cut]
            look([cut])
        for st in listed:
            if st not in size:
                row = con.execute("SELECT SUM(members) AS m FROM nps WHERE stem = ?", (st,)).fetchone()
                size[st] = row["m"] or 0

        # 두 글자 검색어는 같은 이름이 흔하다. 다만 '쿠팡 주식회사'처럼 법인 표시까지 쓰면 그 회사를 찾는 것이다
        short = (min(len(k) for k in main_keys) <= 2 if main_keys else False) and not CORP_MARKS.search(q)

        def name_score(st):
            if st in main_keys:
                return 3.5 if short else 5  # 두 글자는 같은 이름이 흔하다 ('신한', '하나')
            if any(st.startswith(k) for k in main_keys):
                return 3
            if st in keys:
                return 4  # 검색어에서 지점명을 뗀 회사명과 같음 ('(주)한화/건설 부문' → 한화)
            if any(k in st for k in keys):
                return 1.5
            return 0

        def bonus_of(st, lst):
            if any(k in (lst["stem"], lst["alias"]) for k in main_keys):
                return 6  # 상장사 이름과 정확히 같음 ('LG', '신한지주')
            if re.search(r"지주|홀딩스", lst["name"] + st):
                return 2.5  # 그룹을 대표하는 상장 지주회사
            return 0.5

        def listed_bonus(st):
            rows_ = listed.get(st) or []
            if not rows_:
                return 0, None
            lst = max(rows_, key=lambda r: bonus_of(st, r))
            return bonus_of(st, lst), lst

        def stem_score(st):
            return name_score(st) + math.log10(size.get(st, 0) + 1) * 2.5 + listed_bonus(st)[0]

        named = [st for st in size if any(k in st for k in keys) or st in listed or st in by_name]
        up = branch_parents(con, named)   # 본사에 붙인 공장 · 지점 줄기는 본사로 ('성우하이텍소주공장' → 성우하이텍)
        if up:
            for b, par in up.items():
                size[par] = max(size.get(par, 0), size.get(b, 0))
                if b in by_name:
                    by_name.add(par)
            named = list(dict.fromkeys(up.get(st, st) for st in named))
        if not org:
            named = [st for st in named if not NON_COMPANY.search(st)] or named
        stems = sorted(named, key=lambda st: (-stem_score(st), st))[:40]
        if not stems:
            return []
        qs = ",".join("?" * len(stems))
        groups = assemble(con, stems)
    out = [_view(g, n, keys) for g in groups.values()]
    if not org:
        out = [c for c in out if not NON_COMPANY.search(c["name"])] or out
    def wp_names(c):
        return [hangul(norm(x)) for x in [c["name"]] + [w["name"] for w in c["workplaces"]] + [f["name"] for f in c["factories"]]]
    if by_name:   # 이름으로만 찾은 줄기('(주) 녹십자 홀딩스' → 녹십자 · '현대건설(주) 임직원' → 현대건설)는 사업장 이름이 검색어를 품은 회사(법인)만
        out = [c for c in out if c["stem"] not in by_name or any(k in x for x in wp_names(c) for k in main_keys)]
    # 순위는 회사(법인) 하나하나의 규모로: 같은 이름 작은 회사들의 합계가 큰 회사를 밀어내지 않게
    best_of = {}
    for c in out:
        if "|p" not in c["key"] and "|@" not in c["key"]:
            if c["stem"] not in best_of or c["employees"] > best_of[c["stem"]]["employees"]:
                best_of[c["stem"]] = c

    def entity_score(c):
        lst = entity_listing(listed.get(c["stem"]) or [], c["key"], best_of.get(c["stem"]) is c)
        is_listed = lst is not None
        c["listedAs"] = {"name": lst["name"], "code": lst["code"], "market": lst["market"]} if is_listed else None
        if is_listed and lst.get("official"):
            c["name"] = lst["official"]
        size_ = c["employees"] or c["factoryCount"] * 20
        nm = hangul(norm(c["name"]))
        # 이름이 검색어와 똑같은 곳을 같은 줄기의 지점 · 병원 · 지역본부보다 위로 ('한국국토정보공사' > '… 대구경북지역본부')
        same = 1.5 if nm in main_keys else 0
        by = max(name_score(x) for x in wp_names(c)) if c["stem"] in by_name else 0
        return max(name_score(c["stem"]), by) + same + math.log10(size_ + 1) * 2.5 + (bonus_of(c["stem"], lst) if is_listed else 0)

    scored = sorted(((entity_score(c), c) for c in out), key=lambda x: (-x[0], x[1]["name"]))
    # 이름에 검색어가 걸치기만 한 아주 작은 곳은 뺀다 (예: '…쿠팡퇴직금…진상규명을위한…')
    scored = [(sc, c) for sc, c in scored if name_score(c["stem"]) > 1.5 or c["employees"] >= 10 or c["factoryCount"] or c.get("listedAs")]
    final, per_stem, top_size = [], {}, {}
    for _, c in scored:
        # 같은 이름(줄기)은 대표 회사 위주로: 이름이 검색어와 정확히 같을 때만 여럿(최대 3) 보여 준다
        k = per_stem.get(c["stem"], 0)
        big = top_size.setdefault(c["stem"], c["employees"])
        exact = c["stem"] in keys
        cap = 3 if exact else 2
        small = c["employees"] < (big * 0.05 if exact else max(20, big * 0.1))  # 큰 회사와 이름만 같은 대리점·지점 등
        if k >= cap or (k >= 1 and small):
            continue
        per_stem[c["stem"]] = k + 1
        final.append(c)
    final = final[:limit]
    for c in final:  # 목록에는 앞부분만
        c["workplaces"], c["factories"] = c["workplaces"][:5], c["factories"][:5]
    return final


def get(key):
    """search 결과의 key → 회사 하나 (사업장·공장 전체)."""
    st = key.split("|")[0]
    with _connect() as con:
        groups = assemble(con, [st])
        try:
            lst = [dict(r) for r in con.execute("SELECT * FROM listed WHERE nps_stem = ?", (st,))]
        except sqlite3.OperationalError:
            lst = []
    g = groups.get(key)
    if not g:
        return None
    v = _view(g, st)
    row = entity_listing(lst, key, _best_corp(groups) == key) if lst else None
    if row and row.get("official"):
        v["name"] = row["official"]   # 상장사는 DART 정식 회사명 ('현대건설(주) 임직원' → '현대건설(주)')
    return v


# ---------------------------------------------------------------- 회사 정보 초안

def permits_for(c):
    """회사의 인허가 기록: 같은 회사명 줄기 + 같은 시·군 (이름이 하나뿐인 회사면 지역 무관).

    집단급식소는 위탁업체 이름으로 신고되는 일이 많아, 사업장명에 회사명이 들어 있고 지역이 맞으면 함께 본다.
    """
    st = c.get("stem") or ""
    if not st:
        return []
    areas = {area(w["addr"]) for w in c["workplaces"]} | {area(f["addr"]) for f in c["factories"]}

    def near(r):
        return area(r["addr"]) in areas

    with _connect() as con:
        try:
            own = con.execute("SELECT * FROM permit WHERE stem = ?", (st,)).fetchall()
            vendor = con.execute("SELECT * FROM permit WHERE src = 'meal' AND stem != ? AND norm LIKE ?",
                                 (st, f"%{st}%")).fetchall() if len(st) >= 3 else []
        except sqlite3.OperationalError:  # 인허가 색인이 없는 옛 색인
            return []
    # 지역이 달라도 받는 것은 이름이 회사명과 똑같을 때만 ('카카오 퓨어(cacao pure)'는 줄기가 '카카오'여도 다른 사업자)
    return [dict(r) for r in own if near(r) or (c.get("solo") and hangul(r["norm"]) == hangul(st))] + [dict(r) for r in vendor if near(r)]


def key_biz(key):
    """회사 키 '줄기|c123811' → 사업자등록번호 앞 6자리 (법인 본점만)."""
    m = re.search(r"\|c(\d{6})$", key or "")
    return m.group(1) if m else ""


def entity_listing(rows, key, is_best):
    """같은 회사명 줄기에 붙은 상장사들 중 이 회사(법인)의 것.
    사업자등록번호로 확인한 상장사는 그 번호의 법인에만, 이름으로만 맞춘 상장사는 그 줄기에서 가장 큰 법인에 붙인다."""
    b = key_biz(key)
    for r in rows:
        if r.get("biz") and r["biz"] == b:
            return r
    if is_best:
        return next((r for r in rows if not r.get("biz")), None)
    return None


GENERIC_PARENT = re.compile(r"(?:법인|법률사무소|조합|협회|재단|학교|병원|의원|교회|센터)$")   # '세무법인' 처럼 법인 종류 이름에는 붙이지 않는다


def _build_branches(con):
    """따로 줄기가 된 지점 · 공장 → 본사 줄기 (branch_of 표).

    국민연금에는 공장 · 지점이 지점 사업자번호(xx-85)와 '(주)성우하이텍소주공장' 같은 이름으로 따로 올라
    줄기가 '성우하이텍소주공장' 이 된다 → 본사 '(주)성우하이텍' 가입자가 31명으로 잡혔다 (실제 1,600여 명).
    붙이는 조건: 그 줄기의 사업장이 모두 지점 번호이고 · 이름이 공장 · 지점 · 사업장 · 센터 · 연구소 등으로 끝나며 ·
    그 앞부분이 본점 번호가 있는 회사 줄기이고 · 그보다 긴 다른 회사 줄기가 없을 것('케이피에프충주공장' 은 '케이피' 가 아니다) ·
    본사 이름이 '세무법인' 같은 법인 종류 이름이 아닐 것. 'NHN KCP'(엔에이치엔케이씨피)처럼 이름 끝이 사업장 표시가 아니면 붙이지 않는다.
    """
    con.execute("DROP TABLE IF EXISTS branch_of")
    con.execute("CREATE TABLE branch_of(stem TEXT PRIMARY KEY, parent TEXT)")
    c_stems = corp_stems(con)
    every = {r[0] for r in con.execute("SELECT stem FROM stems")}
    kinds = {}
    for st, bz in con.execute("SELECT stem, bizno FROM nps"):
        kinds.setdefault(st, set()).add(_kind(bz))
    pairs = []
    for st in every:
        if st in c_stems or not WP_STEM_END.search(st) or kinds.get(st, {"b"}) != {"b"}:
            continue
        parent = next((st[:i] for i in range(len(st) - 1, 1, -1) if st[:i] in every), None)
        if not parent or parent not in c_stems or GENERIC_PARENT.search(parent):
            continue
        if len(WP_STEM_END.sub("", st[len(parent):])) > 8:
            continue
        pairs.append((st, parent))
    con.executemany("INSERT INTO branch_of VALUES (?,?)", pairs)
    con.execute("CREATE INDEX branch_parent ON branch_of(parent)")
    return len(pairs)


def assemble(con, stems):
    """줄기들 → 회사(법인)들. 따로 줄기가 된 지점 · 공장(branch_of)도 본사에 붙인다.
    한 줄기에 법인이 여럿이면 사업장 이름이 가장 길게 맞는 법인에 ('심텍홀딩스서울지점' → (주) 심텍 홀딩스, 아니면 가장 큰 법인)."""
    stems = list(dict.fromkeys(stems))
    if not stems:
        return {}
    qs = ",".join("?" * len(stems))
    groups = _assemble(con.execute(f"SELECT * FROM nps WHERE stem IN ({qs})", stems).fetchall(),
                       con.execute(f"SELECT * FROM factory WHERE stem IN ({qs})", stems).fetchall())
    try:
        pairs = con.execute(f"SELECT stem, parent FROM branch_of WHERE parent IN ({qs})", stems).fetchall()
    except sqlite3.OperationalError:   # 지점 표가 없는 옛 색인
        return groups
    if not pairs:
        return groups
    parent_of = {r[0]: r[1] for r in pairs}
    bq = ",".join("?" * len(parent_of))
    for kind, table in (("workplaces", "nps"), ("factories", "factory")):
        for r in con.execute(f"SELECT * FROM {table} WHERE stem IN ({bq})", list(parent_of)).fetchall():
            parent = parent_of[r["stem"]]
            corps = [g for k, g in groups.items() if g["stem"] == parent and ("|c" in k or k.endswith("|b"))]
            if not corps:
                continue
            r = dict(r)
            n = hangul(norm(r["name"]))

            def fit(g):
                return max((len(m) for m in (hangul(norm(w["name"])) for w in g["workplaces"]) if m and n.startswith(m)), default=0)
            g = max(corps, key=lambda g: (fit(g), g["members"]))
            g[kind].append(r)
            if kind == "workplaces":
                g["members"] += r["members"] or 0
                g["places"].add((r["sido"], r["city"]))
    return groups


def branch_parents(con, stems):
    """이 줄기들 중 본사에 붙인 지점 · 공장 줄기 → 본사 줄기."""
    stems = list(stems)
    if not stems:
        return {}
    try:
        return {r[0]: r[1] for r in con.execute(f"SELECT stem, parent FROM branch_of WHERE stem IN ({','.join('?' * len(stems))})", stems)}
    except sqlite3.OperationalError:
        return {}


def _best_corp(groups):
    """줄기에서 가장 큰 법인. 본점 번호가 국민연금에 없고 지점 번호(xx-85)로만 올라 있는 회사('삼성물산|b')도 법인이다."""
    corps = [g for k, g in groups.items() if "|c" in k or k.endswith("|b")]
    return max(corps, key=lambda g: g["members"])["key"] if corps else None


# 지점 · 공장 하나가 따로 줄기가 된 것 ('성우하이텍소주공장', '케이씨씨글라스전의공장') — 회사로 따로 세우지 않는다
WP_STEM_END = re.compile(r"(?:공장|사업장|지점|사업부|사업소|센터|센타|연구소|연구원|본부|지사|영업소|출장소|캠퍼스|현장)$")


def corp_stems(con):
    """본점(법인) 사업자번호가 있는 회사명 줄기들."""
    return {r[0] for r in con.execute("SELECT DISTINCT stem FROM nps WHERE substr(bizno, 4, 2) >= '80' AND substr(bizno, 4, 2) <= '99' AND substr(bizno, 4, 2) != '85'")}


def branch_only_company(st, c_stems):
    """지점 번호로만 올라 있는 줄기가 회사 하나인지 ('삼성물산' · '삼성중공업' · '율촌화학'),
    본사가 따로 있는 회사의 지점 · 공장인지 ('성우하이텍소주공장' · '삼양사판교' · '지에스리테일홈쇼핑')."""
    if WP_STEM_END.search(st):
        return False
    return not any(st[:i] in c_stems for i in range(3, len(st)))


def listing_for(c):
    """상장 정보와 자산총계 (한국거래소 상장법인목록 + DART 사업보고서 재무상태표).

    이름이 같은 회사가 여럿이면 법인이고 상장사 소재 시·도에 사업장이 있는 쪽만 맞춘다.
    """
    st = c.get("stem") or ""
    if not st:
        return None, None
    keys = list(dict.fromkeys([st, hangul(st)]))
    qs = ",".join("?" * len(keys))
    with _connect() as con:
        try:
            lst = [dict(r) for r in con.execute("SELECT * FROM listed WHERE nps_stem = ?", (st,))]
            row = None
            if lst:
                groups = assemble(con, [st])
                row = entity_listing(lst, c.get("key", ""), _best_corp(groups) == c.get("key"))
            fin = None
            if row:
                fin = con.execute("SELECT * FROM fin WHERE code = ?", (row["code"],)).fetchone()
            if fin is None and c.get("solo"):  # 상장사가 아니어도 사업보고서를 내는 주요 비상장사
                fin = con.execute(f"SELECT * FROM fin WHERE stem IN ({qs}) OR alias IN ({qs})", keys + keys).fetchone()
        except sqlite3.OperationalError:  # 상장·재무 색인이 없는 옛 색인
            return None, None
    return row, (dict(fin) if fin else None)


def listed_index_ready():
    try:
        with _connect() as con:
            return con.execute("SELECT count(*) FROM listed").fetchone()[0] > 0
    except sqlite3.OperationalError:
        return False


def dart_for(c, extra=()):
    """DART 공시 목록 확인 (네트워크). 실패하면 None. 상장사는 거래소 약칭도 함께 찾는다 ('신한지주')."""
    try:
        from engine import dart
        return dart.lookup([*extra, c.get("name", ""), c.get("stem", "")])
    except Exception:  # noqa: BLE001 - 인터넷이 안 되면 건너뛴다
        return None


def load_map():
    return json.loads((ROOT / "kb" / "company_map.json").read_text(encoding="utf-8"))


def _industry(code, name, cmap, company=""):
    """국민연금 업종코드·업종명(·회사명) → 업종 태그들. 앞 4자리 표 → 앞 2자리 표 → 업종명 규칙 순."""
    code, name = code or "", name or ""
    tags = []
    base = cmap.get("npsPrefix4", {}).get(code[:4]) or cmap["npsPrefix"].get(code[:2])
    if base:
        tags.append(base)
    for rule in cmap["npsName"]:
        if rule.get("prefixes") and code[:2] not in rule["prefixes"]:
            continue
        if rule.get("nameHas") and rule["nameHas"] not in company:
            continue
        if rule.get("nameLacks") and rule["nameLacks"] in company:
            continue
        if not any(w in name for w in rule["words"]):
            continue
        if rule.get("replace"):
            if rule["replace"] in tags:
                tags = [t for t in tags if t != rule["replace"]]
            elif tags:
                continue  # 바꿀 대상이 아니면 건너뛴다 (예: 화학이 아닌데 '화장품'이 든 업종명)
        if rule["tag"] not in tags:
            tags.append(rule["tag"])
    return _fin_fix(tags, code, company, cmap)


def _fin_fix(tags, code, company, cmap):
    if company:
        # 금융업은 회사명이 업종코드보다 정확하다 ('신한카드'가 '기타 금융 투자업', '현대캐피탈'이 방문판매원으로 신고된 경우 등)
        nm = re.sub(r"\s+", "", unicodedata.normalize("NFKC", company))
        bare = re.sub(r"^(주식회사|\(주\)|㈜)|(주식회사|\(주\)|㈜)$", "", nm)
        strong = bare.endswith(tuple(cmap.get("finStrongName", [])))
        if code[:2] in ("65", "66", "67") or strong:
            hit = _fin_by_name(nm, cmap)
            if hit:
                tags = hit if strong else [t for t in tags if t not in FIN_TAGS] + hit
    return tags


MFG_IND = {"ind:chem", "ind:metal", "ind:electronics", "ind:machinery", "ind:mineral", "ind:food", "ind:pharma", "ind:cosmetics", "ind:semiconductor",
           "ind:refinery", "ind:agrochem", "ind:auto_mfg", "ind:shipbuilding", "ind:aerospace", "ind:textile", "ind:medical_device", "ind:defense", "ind:printing"}

FIN_TAGS = {"ind:bank", "ind:savings_bank", "ind:internet_bank", "ind:securities", "ind:insurance", "ind:fin_service", "ind:credit",
            "ind:fin_holding", "ind:holding", "ind:virtual_asset"}


def _fin_by_name(name, cmap):
    """회사명 → 금융업 태그들 (표의 앞쪽 규칙이 먼저: '저축은행'이 '은행'보다 먼저)."""
    for r in cmap.get("finByName", []):
        if any(w in name for w in r["words"]):
            return list(r.get("tags") or [r["tag"]])
    return []


def _krx_industry(listing, cmap):
    """거래소 상장법인목록 업종(한국표준산업분류 중분류 이름) → 업종 태그들."""
    ind, name = listing.get("industry") or "", unicodedata.normalize("NFKC", listing.get("name") or "")
    out = [r["tag"] for r in cmap.get("krxIndustry", []) if ind in r["names"]]
    h = cmap.get("krxHolding") or {}
    if ind in h.get("names", []):
        if ind == "기타 금융업":
            out += ["ind:fin_holding"] if "금융" in name else _fin_by_name(name, cmap) or ["ind:holding"]
        elif any(w in name for w in h.get("holdingWords", [])):
            out.append("ind:holding")
        else:
            out.append("ind:professional")
    return out


def _product_hit(rule, text):
    t = (text or "").lower()
    for x in rule.get("exclude", []):
        t = t.replace(x.lower(), " ")
    return next((w for w in rule["words"] if w.lower() in t), None)


def draft(c, catalog, cmap=None):
    """회사 하나 → {profile, research}. research 는 화면이 근거를 보여 주는 데 쓴다."""
    cmap = cmap or load_map()
    info = meta()
    labels = {o["id"]: o["label"] for s in catalog["sections"] for o in s["options"]}
    ev, tags = {}, []

    def add(tag, basis, evidence, source):
        if tag and tag in labels and tag not in ev:
            tags.append(tag)
            ev[tag] = {"basis": basis, "evidence": evidence, "source": source}

    nps_src, fac_src = SOURCES[0]["url"], SOURCES[1]["url"]
    nm = unicodedata.normalize("NFKC", c["name"] or "")
    for r in cmap.get("nameTags", []):
        hit = next((w for w in r["words"] if w in nm), None)
        if hit:
            for t in r["tags"]:
                add(t, "확인", f"회사명에 ‘{hit}’", nps_src)
    from engine import industry as IND
    inds = []  # 회사 업종 (국세청 업종코드 → 업종 법규)
    total = sum(w["members"] for w in c["workplaces"]) or 1
    biggest = max(c["workplaces"], key=lambda w: w["members"]) if c["workplaces"] else None
    for w in c["workplaces"]:
        if w is not biggest and w["members"] < total * 0.2:
            continue  # 작은 부속 사업장의 업종은 회사 업종으로 보지 않는다 (예: 호텔의 부동산 임대 사업장)
        r = IND.resolve(w["ind_cd"])
        if r:  # 국세청 업종코드 표 (kb/industry_laws.json)
            # 공장 여부는 등록공장 자료와 사전 판단이 정한다 (업종만으로 '확인'하지 않는다)
            r = dict(r, tags=[t for t in _fin_fix(list(r["tags"]), w["ind_cd"], w["name"], cmap) if t != "site:factory"], workplace=w["name"])
            inds.append(r)
            for t in r["tags"]:
                add(t, "확인", f"국민연금 신고 업종: {w['ind_nm']} (국세청 업종코드 {w['ind_cd']})", nps_src)
        else:  # 미분류·옛 업종코드는 업종명·회사명 규칙으로
            for t in _industry(w["ind_cd"], w["ind_nm"], cmap, w["name"]):
                add(t, "확인", f"국민연금 신고 업종: {w['ind_nm']}", nps_src)
    for f in c["factories"]:
        for rule in cmap["products"]:
            hit = _product_hit(rule, f["products"])
            if hit:
                where = f["complex"] or " ".join(x for x in (f["sido"], f["city"]) if x)
                add(rule["tag"], "확인", f"등록공장 생산품에 ‘{hit}’ ({where})", fac_src)
    is_mfg = any((w["ind_cd"] or "")[:2] in cmap["manufacturing"] for w in c["workplaces"])
    facs = c["factories"]
    if facs:
        add("site:factory", "확인", f"등록공장 {len(facs)}곳", fac_src)
        add("permit:factory", "확인", f"공장설립온라인지원시스템 등록공장 {len(facs)}곳", fac_src)
        parks = list(dict.fromkeys(f["complex"] for f in facs if f["complex"]))
        if parks:
            add("site:complex", "확인", "입주 산업단지: " + ", ".join(parks[:4]), fac_src)

    # 인허가 기록 (지방행정 인허가·표준데이터)
    from engine.datasets import SOURCES as DS, page_url
    hits = {}
    for r in permits_for(c):
        for t in PERMITS[r["src"]]["tags"]:
            hits.setdefault(t, []).append(r)
        if r["src"] == "waste" and "지정" in r["detail"]:
            hits.setdefault("permit:designated_waste", []).append(r)
    used_src = []
    for t, rs in hits.items():
        r0 = rs[0]
        where = " ".join(x for x in (r0["sido"], r0["city"]) if x)
        more = f" 외 {len(rs) - 1}곳" if len(rs) > 1 else ""
        bits = [x for x in (r0["detail"], f"{r0['date']} 인허가" if r0["date"] else "") if x]
        add(t, "확인", f"{DS[r0['src']]['title']}: {r0['name']} ({where}){more}" + (f" · {' · '.join(bits)}" if bits else ""),
            page_url(r0["src"]))
        used_src += [r["src"] for r in rs]

    # 업종에서 흔한 항목: 고르지는 않고 권하기만 한다
    sugg = []
    seen = set(tags)

    def suggest_from(key, why):
        for t in cmap["typical"].get(key, []):
            if t in labels and t not in seen:
                seen.add(t)
                sugg.append({"id": t, "why": why})

    if not facs and is_mfg:
        for t in ("site:factory", "permit:factory"):
            if t not in seen:
                seen.add(t)
                sugg.append({"id": t, "why": "제조업으로 신고되어 있으나 등록공장 자료에서 찾지 못했습니다"})
    for t in [t for t in tags if t.startswith("ind:")]:
        suggest_from(t, f"{labels[t]} 업종에서 흔한 항목")
    if facs or is_mfg:
        suggest_from("factory", "제조 공장에서 흔한 항목")
    sugg = sugg[:18]

    # OpenDART (인증키가 있을 때): 표준산업분류, 사업보고서 본문에서 확인한 사실, 직원 현황
    from engine import opendart
    od = opendart.evidence(c) if opendart.enabled() else None
    employees, employees_note, denied_ev, denied = c["employees"], None, {}, []
    if od and not od.get("error"):
        for t in opendart.ksic_tags(od.get("ksic") or "", od.get("corp_name") or c["name"]):
            add(t, "확인", f"DART 기업개황 표준산업분류 {od['ksic']}", "https://opendart.fss.or.kr/")
        ksic = od.get("ksic") or ""
        if ksic:
            # 공시 표준산업분류가 있으면 국민연금 사업장별 신고 업종은 쓰지 않는다 (사업장마다 엉뚱하게 신고된 경우가 많다:
            # 카지노를 '건물 임대업', 경비업체를 '조명장치 제조업'으로)
            keep = set(opendart.ksic_tags(ksic, od.get("corp_name") or c["name"]))
            # 업종 태그가 없는 일반 코드(예: '기타 사업서비스', '작곡가')도 버린다 — 남기면 '업종코드 확인'으로 공시 업종(게임 · 음악 …)의 법령을 덮는다
            inds = [r for r in inds if set(r["tags"]) & keep]
            for t in [t for t in tags if t.startswith("ind:") and t not in keep and ev[t]["evidence"].startswith("국민연금")]:
                tags.remove(t)
                ev.pop(t)
        if ksic and not ("10" <= ksic[:2] <= "34"):
            # 공시상 주업종이 제조업이 아니면, 국민연금 신고 업종에서 온 제조업 태그는 버린다 (예: 경비업체가 '조명장치 제조업'으로 신고)
            for t in [t for t in tags if t in MFG_IND and ev[t]["evidence"].startswith("국민연금")]:
                tags.remove(t)
                ev.pop(t)
            is_mfg = False
            if "site:factory" not in (od.get("facts") or {}):
                for t in [t for t in tags if ev[t]["source"] == fac_src]:
                    tags.remove(t)
                    ev.pop(t)
                facs = []
        for f, v in od["facts"].items():
            if v["value"]:
                add(f, "확인", v["evidence"], v["source"])
            elif f not in tags and f in labels:
                denied.append(f)
                denied_ev[f] = {"basis": "확인", "evidence": v["evidence"], "source": v["source"]}
        if "act:si" in tags and "ind:it" not in tags:   # IT 서비스 · 시스템 통합 사업을 하면 IT 업종 (표준산업분류가 엔지니어링 등이어도)
            add("ind:it", "확인", ev["act:si"]["evidence"], ev["act:si"]["source"])
        if od.get("employees"):
            employees = od["employees"]
            employees_note = (f"DART {od['report']['report']} 직원 현황 {employees:,}명"
                              + (f" (국민연금 가입자 {c['employees']:,}명)" if c["employees"] else ""))
    # 상장 여부·외부감사 대상·공시대상기업집단 소속: OpenDART 공시로 자동으로 정한다 (사람이 고르지 않는다)
    listing, fin = listing_for(c)
    flags, listed_note, assets, assets_note = [], "", 0, "DART에 재무제표가 없습니다 (외부감사 대상이 아닌 회사)."
    if listing:
        flags = ["listed"]
        listed_note = f"{listing['market']} 상장 · 종목코드 {listing['code']}" + (f" · {listing['since']} 상장" if listing["since"] else "")
        for t in _krx_industry(listing, cmap):
            add(t, "확인", f"상장법인목록 업종: {listing['industry']}", page_url("listed"))
        for rule in cmap["products"]:
            hit = _product_hit(rule, listing["products"] + " " + listing["industry"])
            if hit:
                add(rule["tag"], "확인", f"상장법인목록 주요제품·업종에 ‘{hit}’ ({listing['products'][:40]})", page_url("listed"))
        used_src.append("listed")
    flag_notes = {"listed": listed_note} if listing else {}
    if not listing and listed_index_ready():
        denied.append("listed")
        flag_notes["listed"] = "한국거래소 상장법인목록에 없음 (비상장)"
    st = (od or {}).get("status") if od and not od.get("error") else None
    dl = None
    if st:
        flags, denied = [], [x for x in denied if x != "listed"]
        for f in ("listed", "audited", "group"):
            (flags if st[f]["value"] else denied).append(f)
            flag_notes[f] = st[f]["note"]
        if listing and "listed" not in flags:  # 거래소 목록이 더 최신이면 그쪽을 따른다
            flags.append("listed")
            denied.remove("listed")
            flag_notes["listed"] = listed_note
        used_src.append("dart")
    else:
        dl = dart_for(c, [listing["name"]] if listing and listing.get("name") else [])
    if dl:
        filed = dl.get("audit") or dl.get("annual")
        if filed:
            flags.append("audited")
            flag_notes["audited"] = f"DART {filed['report']} 제출 ({filed['filer']}, {filed['date']})"
        else:
            denied.append("audited")
            flag_notes["audited"] = "DART 공시 목록에 감사보고서·사업보고서 없음 (외부감사 대상 아님으로 추정)"
        if dl.get("group"):
            flags.append("group")
            flag_notes["group"] = f"DART {dl['group']['report']} 제출 ({dl['group']['date']})"
        else:
            denied.append("group")
            flag_notes["group"] = "DART 공시 목록에 기업집단현황공시 없음 (대기업집단 소속 아님으로 추정)"
        used_src.append("dart")
    if fin:
        assets = int(fin["assets_eok"])
        assets_note = f"{fin['fy_end']} {fin['basis']} 재무상태표 자산총계 (DART 사업보고서)"
        used_src.append("fin")
    elif st and st["audited"]["value"] and od.get("corp_code"):
        try:
            aa = opendart.audit_assets(od["corp_code"])
        except Exception:  # 네트워크 문제는 판정을 막지 않는다
            aa = None
        if aa:
            assets = aa["assets_eok"]
            assets_note = f"DART {aa['report']} 재무상태표 자산총계 ({aa['date'][:4]}.{aa['date'][4:6]} 제출)"

    ksic_mfg = bool(od and not od.get("error") and "10" <= (od.get("ksic") or "")[:2] <= "34")
    if not facs and not is_mfg and not ksic_mfg and "site:factory" not in tags and c["workplaces"]:
        denied.append("site:factory")  # 등록공장도 없고 업종도 제조업이 아니면 공장은 없다고 본다
        denied_ev["site:factory"] = {"basis": "확인", "evidence": "전국등록공장현황에 없고 신고 업종도 제조업이 아님", "source": fac_src}
    places = [(w["sido"], w["city"]) for w in c["workplaces"]] + [(f["sido"], f["city"]) for f in facs]
    provinces = list(dict.fromkeys(s for s, _ in places if s))
    cities = list(dict.fromkeys(ct for _, ct in places if ct))[:10]
    wp_n = len(c["workplaces"])
    sites = [{"name": w["name"], "address": w["addr"], "kind": f"국민연금 가입 {w['members']}명"} for w in c["workplaces"][:8]]
    sites += [{"name": f["complex"] or "등록공장", "address": f["addr"], "kind": "공장 · " + f["products"][:40]} for f in facs[:8]]
    ind_names = list(dict.fromkeys(w["ind_nm"] for w in c["workplaces"] if w["ind_nm"] and (w["ind_cd"] or "")[:2] not in ("99", "00")))
    summary = " · ".join(x for x in [
        "업종: " + ", ".join(ind_names[:3]) if ind_names else "",
        f"국민연금 가입자 {c['employees']:,}명 (사업장 {wp_n}곳)" if wp_n else "",
        f"등록공장 {len(facs)}곳" if facs else "",
    ] if x)
    # 공시 · 사업보고서로 확인한 업종(예: 게임) 중 국민연금 업종코드표가 다루지 않는 것이 있으면 'nts:known' 을 두지 않는다
    # — 두면 업종 태그로 거는 법령(게임산업진흥법 등)이 꺼진다. 업종코드표 법령은 nts 사실로 그대로 붙는다
    covered = set().union(*[set(r["tags"]) for r in inds]) if inds else set()
    uncovered = [t for t in tags if t.startswith("ind:") and ev.get(t, {}).get("basis") == "확인"
                 and not ev[t]["evidence"].startswith("국민연금") and t not in covered]
    profile = {
        "name": c["name"],
        "numbers": {"employees": employees, "assets": assets},
        "flags": flags,
        "denied": denied,
        "tags": tags + list(dict.fromkeys(f for r in inds for f in r["facts"])) + (["nts:known"] if inds and not uncovered else []),
        "regions": {"provinces": provinces, "cities": cities},
    }
    research = {
        "query": c["name"], "officialName": c["name"], "summary": summary, "alternatives": [],
        "employeesNote": employees_note or (f"국민연금 가입자 합계 ({info.get('nps', '')} 기준). 60세 이상 등 가입 제외자는 빠지므로 실제보다 적을 수 있습니다."
                                            if wp_n else "국민연금 자료에서 찾지 못했습니다. 직접 넣어 주세요."),
        "assetsNote": assets_note,
        "listedNote": listed_note,
        "flagNotes": flag_notes,
        "dart": dl,
        "sites": sites,
        "tagEvidence": ev,
        "industries": [{"code": r["code"], "name": r["name"], "workplace": r["workplace"], "laws": r["laws"]} for r in
                       {r["code"]: r for r in inds}.values()],
        "deniedEvidence": denied_ev,
        "opendart": ({"corp": od.get("corp_name"), "ksic": od.get("ksic"), "report": od.get("report")} if od and not od.get("error")
                     else {"error": od["error"]} if od else None),
        "suggestions": sugg,
        "facts": [],
        "unknowns": ([] if fin else ["자산총액 (비상장사는 공개 자료가 없습니다)"]) + [
                     "유해화학물질 영업허가·위험물 제조소 (전국 공개 명단이 없습니다)",
                     "설비·취급 물질 (아래 ‘이 업종에서 흔한 항목’에서 해당하는 것을 누르세요)"],
        "sources": SOURCES + [{"url": page_url(x), "title": f"{DS[x]['title']} ({DS[x]['org']})"} for x in dict.fromkeys(used_src) if x in DS]
        + [{"url": v["url"], "title": f"DART {v['report']} ({v['date']})"} for v in (dl or {}).values() if isinstance(v, dict)]
        + ([{"url": od["report"]["url"], "title": f"DART {od['report']['report']} 원문 (OpenDART)"}] if od and od.get("report") else []),
        "dataAsOf": {"nps": info.get("nps", ""), "factory": info.get("factory", ""), "permits": info.get("permits", "")},
        "model": None,
    }
    return {"profile": profile, "research": research}


def main(argv):
    if argv[:1] == ["build"]:
        print(build())
    elif argv[:1] == ["search"] and len(argv) > 1:
        for c in search(" ".join(argv[1:])):
            print(f"{c['name']} | {c['industry']['name']} | 가입자 {c['employees']} | 사업장 {c['workplaceCount']} | 공장 {c['factoryCount']} | {c['address']}")
    else:
        print(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
