#!/usr/bin/env python3
"""개정마다 '무엇이 바뀌었나'를 국가법령정보센터 개정문으로 분석한다 -> docs/amend_flags.json, docs/amend_details.json

개정 이벤트(법령명 + 시행일 + 개정구분)마다
  - 이 시행일에 실제로 시행되는 개정 지시문만 골라낸다 (조문시행일자문자열·별표시행일자문자열로 시행일이 나뉜 개정을 구분)
  - 건드린 조문의 제목·장(章)으로 벌칙 / 과태료 / 과징금 / 행정처분 관련 개정을 표시한다
  - 조문 신설 · 삭제, 회사에 대한 의무 문장(…하여야 한다 / …아니 된다)이 새로 들어갔는지 표시한다
  - 제개정이유(개정 취지)와 개정 조항 목록을 함께 저장한다 (새로 잡힌 개정의 팝업이 비지 않게)

근거는 모두 법령정보센터 원문(개정문·조문 제목·별표 제목)이며, 판단이 애매한 부분은 표시하지 않는다.
결과는 이벤트 키로 쌓아 두고, 매일 갱신 때는 새 이벤트만 분석한다 (refresh_laws.py 가 부른다).
단독 실행: python3 scripts/amend_details.py [--force] [--only 법령일련번호]
"""
from __future__ import annotations

import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
FLAGS_OUT = DOCS / "amend_flags.json"
DETAILS_OUT = DOCS / "amend_details.json"
CACHE = Path.home() / "Library" / "Caches" / "RegRader" / "law"   # 법령 본문(버전별로 바뀌지 않음) 로컬 캐시
OC = "knowhow1"
SERVICE = "https://www.law.go.kr/DRF/lawService.do"
UA = "Mozilla/5.0 (RegRader amendment analysis)"
VERSION = 4   # 분석 규칙을 바꾸면 올린다 -> 전체 다시 분석

AMEND_SHORT = {"일부개정": "일", "타법개정": "타"}

# ---------- 원문 받기 ----------

def fetch_law(lsi: str) -> dict:
    CACHE.mkdir(parents=True, exist_ok=True)
    p = CACHE / f"{lsi}.json"
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))["법령"]
        except (ValueError, KeyError):
            p.unlink()
    last = None
    for i in range(3):
        try:
            r = requests.get(SERVICE, params={"OC": OC, "target": "law", "type": "JSON", "MST": lsi},
                             headers={"User-Agent": UA}, timeout=120)
            r.raise_for_status()
            j = r.json()
            if "법령" not in j:
                raise ValueError("법령 없음")
            p.write_text(r.text, encoding="utf-8")
            return j["법령"]
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2 + i * 3)
    raise RuntimeError(f"{lsi}: {last}")


ADM_CACHE = Path.home() / "Library" / "Caches" / "RegRader" / "admrul"


def fetch_admrul(seq: str) -> dict:
    """행정규칙 본문 (제개정이유 · 개정문 · 첨부파일). 버전별로 바뀌지 않으므로 캐시한다."""
    ADM_CACHE.mkdir(parents=True, exist_ok=True)
    p = ADM_CACHE / f"{seq}.json"
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))["AdmRulService"]
        except (ValueError, KeyError):
            p.unlink()
    last = None
    for i in range(3):
        try:
            r = requests.get(SERVICE, params={"OC": OC, "target": "admrul", "type": "JSON", "ID": seq},
                             headers={"User-Agent": UA}, timeout=120)
            r.raise_for_status()
            j = r.json()
            if "AdmRulService" not in j:
                raise ValueError("AdmRulService 없음")
            p.write_text(r.text, encoding="utf-8")
            return j["AdmRulService"]
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2 + i * 3)
    raise RuntimeError(f"admrul {seq}: {last}")


def admrul_detail(doc: dict) -> dict:
    """행정규칙 개정: 제개정이유(개정 취지·주요내용)와 첨부(고시 전문 등) 링크"""
    reason = flat((doc.get("제개정이유") or {}).get("제개정이유내용"))
    reason = re.sub(r"[ \t]+", " ", reason)
    reason = re.sub(r"◇\s*제\s*ㆍ?\s*개정\s*이유", "◇ 개정이유", reason)
    reason = re.sub(r"\n\s*\n+", "\n", reason).strip()
    att = doc.get("첨부파일") or {}
    if isinstance(att, list):
        att = att[0] if att else {}
    link = att.get("첨부파일링크") or ""
    if isinstance(link, list):
        link = link[0] if link else ""
    name = att.get("첨부파일명") or ""
    if isinstance(name, list):
        name = name[0] if name else ""
    info = doc.get("행정규칙기본정보") or {}
    return {"admrul": True, "reason": reason[:1500] + ("…" if len(reason) > 1500 else ""),
            "attach": link, "attachName": name, "issued": info.get("발령일자") or "", "dept": info.get("담당부서기관명") or ""}


def flat(v) -> str:
    if isinstance(v, list):
        return "\n".join(flat(x) for x in v)
    if isinstance(v, dict):
        return "\n".join(flat(x) for x in v.values())
    return "" if v is None else str(v)


def as_list(v):
    return v if isinstance(v, list) else ([] if v is None else [v])


def compact(s: str) -> str:
    return re.sub(r"[\s·ㆍ・.]", "", s or "")


# ---------- 조문·별표 제목 ----------

def article_index(law: dict):
    """(조문번호, 가지번호) -> {title, chapter}. 장 제목(예: '제12장 벌칙')도 같이 기억한다."""
    idx, chapter = {}, ""
    for row in as_list((law.get("조문") or {}).get("조문단위")):
        body = (row.get("조문내용") or "").strip()
        if row.get("조문여부") == "전문":
            if re.match(r"제\s*\d+\s*장", body):
                chapter = re.sub(r"\s+", " ", body)
            continue
        key = (str(row.get("조문번호") or ""), str(row.get("조문가지번호") or ""))
        title = row.get("조문제목") or ""
        if not title:
            m = re.match(r"제\d+조(?:의\d+)?\(([^)]*)\)", body)
            title = m.group(1) if m else ""
        idx[key] = {"title": title, "chapter": chapter, "changed": row.get("조문변경여부") == "Y",
                    "text": re.sub(r"\s+", " ", body + " " + flat(row.get("항")))[:4000]}
    return idx


def annex_index(law: dict):
    out = {}
    for b in as_list((law.get("별표") or {}).get("별표단위")):
        if (b.get("별표구분") or "별표") != "별표":
            continue
        n = str(int(b.get("별표번호") or 0))
        g = str(int(b.get("별표가지번호") or 0))
        out[(n, "" if g == "0" else g)] = re.sub(r"\s+", " ", b.get("별표제목") or "").strip()
    return out


# ---------- 시행일이 나뉜 개정 ----------

def date_map(s: str):
    """'20260801:제10조의2, 제23조20270101:제44조의4' -> [('2026-08-01', ['제10조의2', '제23조']), ...]"""
    out = []
    for m in re.finditer(r"(\d{8}):(.*?)(?=\d{8}:|$)", s or ""):
        d = m.group(1)
        refs = [x.strip() for x in re.split(r"[,，]", m.group(2)) if x.strip()]
        out.append((f"{d[:4]}-{d[4:6]}-{d[6:]}", refs))
    return out


ART_RE = re.compile(r"제(\d+)조(?:의(\d+))?")
ANNEX_RE = re.compile(r"별표\s*(\d+)(?:의(\d+))?")


def strip_quotes(s: str) -> str:
    return re.sub(r'"[^"]*"|“[^”]*”|「[^」]*」|\'[^\']*\'', " ", s)


# ---------- 개정문 -> 지시문 ----------

DIRECTIVE = ("다음과 같이", "로 한다", "으로 한다", "삭제한다", "신설한다", "로 하고", "으로 하고", "로 하며", "으로 하며", "삭제하고", "삭제하며")
START = re.compile(r"^(제\s*\d+\s*(조|장|절|편|관)|별표|부칙의|목차)")


def instructions(law: dict):
    """개정문에서 이 법령을 고치는 지시문과 그 뒤에 붙은 새 문장들을 뽑는다."""
    text = flat((law.get("개정문") or {}).get("개정문내용"))
    lines = [re.sub(r"<[^>]+>", "", ln).strip() for ln in text.splitlines()]
    name = compact((law.get("기본정보") or {}).get("법령명_한글") or "")
    start = None
    for i, ln in enumerate(lines):
        if "다음과 같이 개정한다" in ln and (name in compact(ln) or "일부를" in ln):
            if name in compact(ln):
                start = i          # 타법개정: 이 법령을 고치는 단락 (마지막 것)
            elif start is None:
                start = i
    if start is None:
        return []
    out, cur = [], None
    for ln in lines[start + 1:]:
        if not ln:
            continue
        if ln.startswith("부칙") or re.match(r"^(<\s*\d+\s*>|[①-⑳㉑-㉟]\s*\S+.*다음과 같이 개정한다)", ln) or re.match(r"^제\d+조\s*생략", ln) \
                or re.match(r"^<\d+>부터", ln):
            break
        if START.match(ln) and not re.match(r"^제\d+조(의\d+)?\(", ln) and any(k in ln for k in DIRECTIVE):
            cur = {"line": ln, "content": []}
            out.append(cur)
        elif cur is not None:
            cur["content"].append(ln)
    return out


def targets(line: str):
    """지시문이 건드리는 조문 [(번호, 가지)] 과 별표 [(번호, 가지)]"""
    bare = strip_quotes(line)
    arts, annexes = [], []
    for m in ART_RE.finditer(bare):
        k = (m.group(1), m.group(2) or "")
        if k not in arts:
            arts.append(k)
    for m in ANNEX_RE.finditer(bare):
        k = (m.group(1), m.group(2) or "")
        if k not in annexes:
            annexes.append(k)
    return arts, annexes


QUOTE_PAIRS = {'"': '"', "“": "”", "「": "」"}


def split_clauses(line: str):
    """'…로 하고, 같은 항에 …를 신설하며, …' 를 절 단위로 나눈다 (따옴표 안의 쉼표는 무시)."""
    out, buf, q = [], [], None
    for ch in line:
        if q:
            buf.append(ch)
            if ch == q:
                q = None
        elif ch in QUOTE_PAIRS:
            q = QUOTE_PAIRS[ch]
            buf.append(ch)
        elif ch == "," and "".join(buf).rstrip().endswith(("하고", "하며")):
            out.append("".join(buf).strip())
            buf = []
        else:
            buf.append(ch)
    if "".join(buf).strip():
        out.append("".join(buf).strip())
    return out


SUB = r"(?:제\d+항)?(?:제\d+호(?:의\d+)?)?(?:[가-힣]목(?:의\d+)?)?"
LEAD = re.compile(r"^\s*(?:제(\d+)조(?:의(\d+))?(" + SUB + r")|같은\s*(조|항|호)\s*(" + SUB + r"))")


def clauses(ins):
    """지시문 하나 -> 절 목록. 절마다 가리키는 조항(예: '제175조제4항제1호의2')과 새 문장을 붙인다."""
    parts = split_clauses(ins["line"])
    ctx = {"art": None, "hang": "", "ho": ""}
    out = []
    for text in parts:
        bare = strip_quotes(text)
        m = LEAD.match(bare)
        art, sub = None, ""
        if m and m.group(1):
            art = (m.group(1), m.group(2) or "")
            sub = (m.group(3) or "").replace(" ", "")
        elif m and m.group(4):
            art = ctx["art"]
            base = "" if m.group(4) == "조" else ctx["hang"] if m.group(4) == "항" else ctx["hang"] + ctx["ho"]
            sub = base + (m.group(5) or "").replace(" ", "")
        if art:
            h = re.match(r"제\d+항", sub)
            ctx = {"art": art, "hang": h.group(0) if h else (ctx["hang"] if art == ctx["art"] and not sub else ""),
                   "ho": (re.search(r"제\d+호(?:의\d+)?", sub) or [""])[0] if sub else ""}
        # '…에 제1호의2 및 제2호의2를 신설' 처럼 새로 넣는 하위 항목
        added = []
        am = re.search(r"에\s*((?:제\d+(?:항|호)(?:의\d+)?|[가-힣]목(?:의\d+)?)(?:\s*(?:및|ㆍ|,)\s*(?:제\d+(?:항|호)(?:의\d+)?|[가-힣]목(?:의\d+)?))*)\s*(?:를|을)", bare)
        if am:
            added = re.findall(r"제\d+(?:항|호)(?:의\d+)?|[가-힣]목(?:의\d+)?", am.group(1))
        arts, annexes = targets(text)
        if art and art not in arts:
            arts.insert(0, art)
        label = f"제{art[0]}조" + (f"의{art[1]}" if art and art[1] else "") if art else ""
        refs = [label + sub + a for a in added] if (label and added) else ([label + sub] if label else [])
        out.append({"text": text, "arts": arts, "annexes": annexes, "refs": refs, "content": [],
                    "wants": ("다음과 같이" in bare), "nadd": max(1, len(added))})
    removed = re.findall(r'"([^"]+)"\s*(?:을|를)\s*"', ins["line"])
    for c in out:
        c["removed"] = removed
    # 새 문장(내용 줄)을 '다음과 같이 …'인 절에 차례로 나눠 준다
    lines = list(ins["content"])
    takers = [c for c in out if c["wants"]]
    for i, c in enumerate(takers):
        c["content"] = lines if i == len(takers) - 1 else lines[:c["nadd"]]
        lines = [] if i == len(takers) - 1 else lines[c["nadd"]:]
    return out


def _prefix(a: str, b: str) -> bool:
    """a 가 b 의 앞부분인가 (제23조 vs 제23조의2 는 다른 조문)"""
    return b.startswith(a) and (len(b) == len(a) or not re.match(r"의\d", b[len(a):]))


def ref_dates(fr, main_date, deferred):
    """조항 하나의 시행일 (늦게 시행되는 부분을 일부 포함하면 본래 시행일과 그 날 모두)"""
    dates, hit = set(), False
    fr = fr.replace(" ", "")
    for d, drefs in deferred:
        for r in drefs:
            r = r.replace(" ", "")
            if r.startswith("별표"):
                continue
            if _prefix(r, fr):
                dates.add(d); hit = True
            elif _prefix(fr, r):
                dates.update({d, main_date}); hit = True
    return dates if hit else {main_date}


def clause_dates(c, main_date, deferred):
    """절의 시행일: 조문시행일자문자열에 그 조항(또는 그 조항을 포함하는 상위 조항)이 있으면 그 날."""
    annexes = [f"별표{n}" + (f"의{g}" if g else "") for n, g in c["annexes"]]
    if not c["refs"] and not annexes:
        return {main_date}
    dates = set()
    for fr in c["refs"]:
        dates |= ref_dates(fr, main_date, deferred)
    for an in annexes:
        ds = {d for d, drefs in deferred for r in drefs if r.replace(" ", "") == an}
        dates.update(ds or {main_date})
    return dates


CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳"


def line_ref(base: str, line: str):
    """새로 넣은 줄의 번호(①, 1., 1의2., 가.)로 그 줄이 가리키는 조항을 만든다. 모르면 None."""
    if not base:
        return None
    t = line.strip()
    m = re.match(r"^(\d+)(?:의(\d+))?\.", t)
    if m:
        ho = f"제{m.group(1)}호" + (f"의{m.group(2)}" if m.group(2) else "")
        return re.sub(r"제\d+호(?:의\d+)?$", "", base) + ho
    if t[:1] and t[0] in CIRCLED:
        return re.sub(r"(제\d+항)?(제\d+호(?:의\d+)?)?$", "", base) + f"제{CIRCLED.index(t[0]) + 1}항"
    return None


# ---------- 표시 규칙 ----------

PENALTY = re.compile(r"벌칙|양벌")
FINE = re.compile(r"과태료")
SURCHARGE = re.compile(r"과징금")
NOT_PENALTY = re.compile(r"공무원\s*의제")   # '벌칙 적용에서 공무원 의제'는 회사에 대한 벌칙이 아니다
SANCTION = re.compile(r"영업정지|업무정지|사업정지|조업정지|행정처분|처분(의)?\s*기준|(허가|등록|지정|인증|자격|승인|면허)(의)?\s*취소|폐쇄\s*명령|사용\s*중지\s*명령")
PENALTY_CHAPTER = re.compile(r"장(?:의\d+)?\s+벌칙\s*(?:<[^>]*>)?\s*$")   # '제12장 벌칙' (보칙과 섞인 장은 제외)
DUTY = re.compile(r"(하여야|해야|받아야|두어야|갖추어야|알려야|제출하여야|신고하여야|보고하여야|공시하여야|게시하여야|보관하여야|사용해야|설치하여야|지정하여야|실시하여야)\s*한다|아니\s*된다|안\s*된다|하지\s*못한다")
SOFT = re.compile(r"노력하여야\s*한다|노력해야\s*한다")      # 노력 의무는 빼고 본다
# 의무를 지는 쪽: 회사로 읽히는 주어가 정부(장관·위원회 등) 주어보다 먼저 나올 때만 회사 의무로 본다
COMP = re.compile(r"(사업주|사용자|도급인|수급인|사업자|영업자|개인정보처리자|정보통신서비스\s*제공자|제공자|법인|회사|기업|배출자|운영자|설치자|소유자|관리자|대표자|제조자|수입자|판매자|발주자|취급자|처리자|시공자|점유자|고용주|[가-힣]+(?:한|된|는|받은|하려는)\s*자)(?:는|은|가|이|,|와|과|\s*및|\s*등은|\s*등이)")
GOV = re.compile(r"(장관|청장|위원회|위원장|시장|군수|구청장|도지사|시ㆍ도지사|근로감독관|노동감독관|감독관|공단|국가|지방자치단체|행정기관|기관의\s*장|처장|원장|법원|검사)(?:은|는|이|가)\s")
AMOUNT = re.compile(r"\d[\d,]*\s*(?:원|만원|천만원|억원)|\d+\s*(?:년|개월)\s*이하|징역|벌금|과태료|과징금|영업정지|취소")


def company_duty(sentence: str, article_text: str = "") -> bool:
    """이 문장이 회사에 새 의무(…하여야 한다 / …아니 된다)를 지우는가."""
    if not DUTY.search(sentence) or SOFT.search(sentence):
        return False
    c, g = COMP.search(sentence), GOV.search(sentence)
    if c and (not g or c.start() < g.start()):
        return True
    if c or g:
        return False
    # 주어가 없는 문장(예: 호·후단 신설): 그 조문 본문의 주어를 따른다
    if article_text:
        c2, g2 = COMP.search(article_text), GOV.search(article_text)
        return bool(c2 and (not g2 or c2.start() < g2.start()) and DUTY.search(article_text))
    return False


def clean_reason(law: dict) -> str:
    t = flat((law.get("제개정이유") or {}).get("제개정이유내용"))
    t = re.sub(r"^\s*\[[^\]]*\]\s*", "", t.strip())
    t = re.sub(r"<[^>]*제공>\s*$", "", t.strip())
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n\s*\n+", "\n", t).strip()
    return t[:1200] + ("…" if len(t) > 1200 else "")


def sentences(txt: str):
    for s in re.split(r"(?<=다\.)\s+|\n", txt):
        s = s.strip()
        if s:
            yield s


def analyze(law: dict, event_date: str):
    info = law.get("기본정보") or {}
    main = info.get("시행일자") or ""
    main_date = f"{main[:4]}-{main[4:6]}-{main[6:]}" if len(main) == 8 else event_date
    deferred = date_map(info.get("조문시행일자문자열")) + date_map(info.get("별표시행일자문자열"))
    arts_idx = article_index(law)
    annex_idx = annex_index(law)
    ins_all = instructions(law)
    dated = [(c, clause_dates(c, main_date, deferred)) for ins in ins_all for c in clauses(ins)]
    mine = [c for c, ds in dated if event_date in ds]
    other_dates = sorted({d for _, ds in dated for d in ds} - {event_date})

    touched, annexes = [], []   # [{ref, title}]
    flags = {k: {} for k in ("penalty", "fine", "surcharge", "sanction")}   # 표시 -> 강화·신설 여부(True) / 인용·용어 정비(False)
    new_articles, deleted, evidence, duty = [], [], [], []
    new_clauses = 0

    def label_art(k):
        return f"제{k[0]}조" + (f"의{k[1]}" if k[1] else "")

    def add_art(k):
        label = label_art(k)
        ent = next((t for t in touched if t["ref"] == label), None)
        if not ent:
            a = arts_idx.get(k, {})
            ent = {"ref": label, "title": a.get("title") or "", "chapter": a.get("chapter") or ""}
            touched.append(ent)
        return ent

    def mark(kind, label, strong):
        flags[kind][label] = flags[kind].get(label, False) or strong

    ops = {}   # 조문·별표 -> 바뀐 방식 (신설 / 삭제 / 전부 개정 / 문구 변경) : '주요 개정내용'이 비었을 때 보여 준다

    def add_op(label, title, op):
        e = ops.setdefault(label, {"ref": label, "title": title, "ops": []})
        if op not in e["ops"]:
            e["ops"].append(op)

    for ins in mine:
        line = ins["text"]
        bare = strip_quotes(line)
        arts, anx = ins["arts"], ins["annexes"]
        # 한 절에서 넣은 항목들의 시행일이 다르면(예: 1호는 올해, 2호는 내년) 이 시행일 것만 남긴다
        base = ins["refs"][0] if len(ins["refs"]) == 1 else ""
        content = []
        for i, ln in enumerate(ins["content"]):
            r = (ins["refs"][i] if len(ins["refs"]) == len(ins["content"]) and len(ins["refs"]) > 1 else line_ref(base, ln))
            if not r or event_date in ref_dates(r, main_date, deferred):
                content.append(ln)
        orig_n = len(ins["content"])   # 원래 넣은 줄 수 (별표처럼 그림으로만 된 경우 0)
        ins = dict(ins, content=content)
        is_new = "신설" in bare
        is_del = "삭제" in bare
        whole_new = bool(re.match(r"^제\d+조(의\d+)?(를|을)\s*다음과 같이 신설한다", line))
        whole_del = bool(re.match(r"^(제\d+조(의\d+)?(,|\s|및)*)+(를|을)\s*(각각\s*)?삭제한다", line))
        replaced = re.findall(r'(?:을|를)\s*"([^"]+)"\s*(?:으로|로)', line)
        rewrites = "다음과 같이 한다" in bare
        # 벌칙·과태료 등의 '강화·신설': 항목을 새로 넣었거나, 금액·형량을 바꿨거나, 내용을 새로 썼을 때 (단순 인용·용어 정비는 아님)
        # 같은 지시문에서 지운 문구를 항목으로 옮겨 적기만 한 경우는 신설로 보지 않는다
        removed_txt = [re.sub(r"\s+", "", x) for x in ins.get("removed", []) if len(x) >= 15]
        moved = bool(ins["content"]) and all(any(rt in re.sub(r"\s+", "", c) for rt in removed_txt) for c in ins["content"])
        strong = (is_new and bool(ins["content"] or orig_n == 0) and not moved) or any(AMOUNT.search(x) for x in replaced) \
            or (rewrites and any(AMOUNT.search(c) for c in ins["content"]))
        hits = set()
        for k in arts:
            ent = add_art(k)
            t, ch = ent["title"], ent["chapter"]
            lab = ent["ref"] + (f"({t})" if t else "")
            if NOT_PENALTY.search(t):
                pass
            elif FINE.search(t):
                hits.add("fine"); mark("fine", lab, strong)
            elif PENALTY.search(t) or (PENALTY_CHAPTER.search(ch) and not SURCHARGE.search(t)):
                hits.add("penalty"); mark("penalty", lab, strong)
            if SURCHARGE.search(t):
                hits.add("surcharge"); mark("surcharge", lab, strong)
            if SANCTION.search(t):
                hits.add("sanction"); mark("sanction", lab, strong)
            if whole_new and lab not in new_articles:
                new_articles.append(lab)
            if whole_del and ent["ref"] not in deleted:
                deleted.append(ent["ref"])
        for k in anx:
            title = annex_idx.get(k, "")
            label = f"별표 {k[0]}" + (f"의{k[1]}" if k[1] else "")
            if not any(a["ref"] == label for a in annexes):
                annexes.append({"ref": label, "title": title})
            lab = f"{label}({title})" if title else label
            if FINE.search(title):
                hits.add("fine"); mark("fine", lab, strong)
            if SURCHARGE.search(title):
                hits.add("surcharge"); mark("surcharge", lab, strong)
            if SANCTION.search(title):
                hits.add("sanction"); mark("sanction", lab, strong)
        if is_new and not whole_new:
            new_clauses += 1
        op = "조문 신설" if whole_new else "조문 삭제" if whole_del else "항목 신설" if is_new else "항목 삭제" if is_del else "내용 전부 개정" if rewrites else "문구 변경"
        for k0 in (arts if (whole_new or whole_del) else arts[:1]):   # '제102조, 제102조의2 및 제103조를 각각 삭제한다'
            add_op(label_art(k0), arts_idx.get(k0, {}).get("title") or "", op)
        for k in anx:
            add_op(f"별표 {k[0]}" + (f"의{k[1]}" if k[1] else ""), annex_idx.get(k, ""), op)
        # 회사에 대한 의무 문장: 새로 넣은 문장 + 바꿔 넣은 문구
        art_text = arts_idx.get(arts[0], {}).get("text", "") if arts else ""
        for txt in list(ins["content"]) + replaced:
            for sen in sentences(txt):
                if len(duty) < 3 and company_duty(sen, art_text):
                    s2 = re.sub(r"\s+", " ", sen)
                    s2 = s2[:170] + ("…" if len(s2) > 170 else "")
                    if s2 not in duty:
                        duty.append(s2)
        if hits:
            head = f"[{ins['refs'][0]}] " if ins["refs"] and not line.startswith("제") else ""
            ev = head + re.sub(r"\s+", " ", line)
            ev = ev[:220] + ("…" if len(ev) > 220 else "")
            if ins["content"]:
                c = re.sub(r"\s+", " ", ins["content"][0])
                ev += " ⏎ " + c[:160] + ("…" if len(c) > 160 else "")
            evidence.append((0 if strong else 1, len(evidence), ev))

    # 지시문을 못 읽은 경우(전부개정·제정 등): 조문변경여부 표시로 대신한다 (강화 여부는 모름)
    if not ins_all:
        for k, a in arts_idx.items():
            if a["changed"]:
                ent = add_art(k)
                lab = ent["ref"] + (f"({ent['title']})" if ent["title"] else "")
                if FINE.search(ent["title"]):
                    mark("fine", lab, False)
                elif PENALTY.search(ent["title"]) or PENALTY_CHAPTER.search(ent["chapter"]):
                    mark("penalty", lab, False)

    names = (("벌칙", "penalty"), ("과태료", "fine"), ("과징금", "surcharge"), ("처분", "sanction"))
    codes = [c for c, k in names if any(flags[k].values())]          # 목록 배지: 강화·신설만
    if new_articles:
        codes.append("신설")
    if duty:
        codes.append("의무")
    if deleted:
        codes.append("삭제")
    detail = {
        "lsi": info.get("법령일련번호") or "",
        "promulgated": info.get("공포일자") or "",
        "mainDate": main_date,
        "otherDates": other_dates,
        "reason": clean_reason(law),
        "articles": [{"ref": t["ref"], "title": t["title"]} for t in touched] + annexes,
        "flags": {k: [{"ref": r, "strong": v} for r, v in flags[k].items()] for k in flags},
        "changes": list(ops.values()),
        "newArticles": new_articles,
        "deleted": deleted,
        "newClauses": new_clauses,
        "duty": duty,
        "evidence": [e for _, _, e in sorted(evidence)[:4]],   # 강화·신설 근거를 먼저
        "instructions": len(mine),
    }
    return codes, detail


# ---------- 전체 실행 ----------

def event_rows():
    rows = []
    for i in range(8):
        p = DOCS / f"m{i}.json"
        if p.exists():
            rows += [r for r in json.loads(p.read_text(encoding="utf-8")) if isinstance(r, dict) and r.get("t")]
    nxt = DOCS / "upcoming_next.json"
    if nxt.exists():
        try:
            v = json.loads(nxt.read_text(encoding="utf-8"))
            rows += [r for r in v if isinstance(r, dict) and r.get("t")]
        except ValueError:
            pass
    return rows


def key_of(r):
    return f"{r['t']}|{r['d']}|{r.get('a') or ''}"


def build(force=False, only=None, log=print):
    old_flags = json.loads(FLAGS_OUT.read_text(encoding="utf-8")) if FLAGS_OUT.exists() else {}
    old_det = json.loads(DETAILS_OUT.read_text(encoding="utf-8")) if DETAILS_OUT.exists() else {}
    if old_flags.get("version") != VERSION:
        force = True
    rows = event_rows()
    items_f = {} if force else dict(old_flags.get("items") or {})
    items_d = {} if force else dict(old_det.get("items") or {})
    old_reasons = old_det.get("reasons") or []
    for v in items_d.values():   # 저장할 때 개정 취지는 번호로 줄여 두었다 -> 되살린다
        if "r" in v:
            r = v.pop("r")
            v["reason"] = old_reasons[r] if isinstance(r, int) and r < len(old_reasons) else ""
    live = {key_of(r) for r in rows}
    todo = [r for r in rows if (force or key_of(r) not in items_d) and r.get("u") and (not only or r.get("u") == only)]
    adm_todo = [r for r in todo if r.get("k")]          # 행정규칙: 제개정이유만
    todo = [r for r in todo if not r.get("k")]
    lsis = sorted({r["u"] for r in todo})
    log(f"amend_details: 분석할 개정 {len(todo)}건 (법령 버전 {len(lsis)}개)")
    laws, failed = {}, []

    def get(lsi):
        try:
            return lsi, fetch_law(lsi)
        except Exception as e:  # noqa: BLE001
            return lsi, e

    with ThreadPoolExecutor(max_workers=4) as ex:
        for lsi, law in ex.map(get, lsis):
            if isinstance(law, Exception):
                failed.append(lsi)
                log(f"  {lsi} 받기 실패: {law}")
            else:
                laws[lsi] = law
    for r in todo:
        law = laws.get(r["u"])
        if not law:
            continue
        try:
            codes, detail = analyze(law, r["d"])
        except Exception as e:  # noqa: BLE001
            log(f"  {key_of(r)} 분석 실패: {e}")
            continue
        items_f[key_of(r)] = codes
        items_d[key_of(r)] = detail
    # 행정규칙 개정: 제개정이유 · 첨부 (표시 코드는 없음)
    def get_adm(seq):
        try:
            return seq, fetch_admrul(seq)
        except Exception as e:  # noqa: BLE001
            return seq, e
    with ThreadPoolExecutor(max_workers=4) as ex:
        adm_docs = dict(ex.map(get_adm, sorted({r["u"] for r in adm_todo})))
    for r in adm_todo:
        doc = adm_docs.get(r["u"])
        if isinstance(doc, Exception) or not doc:
            failed.append(r["u"])
            continue
        items_f[key_of(r)] = []
        items_d[key_of(r)] = admrul_detail(doc)
    if adm_todo:
        log(f"amend_details: 행정규칙 {len(adm_todo)}건 제개정이유")

    # 목록에서 빠진 개정은 지운다
    items_f = {k: v for k, v in items_f.items() if k in live}
    items_d = {k: v for k, v in items_d.items() if k in live}
    now = datetime.now(timezone.utc).isoformat()
    FLAGS_OUT.write_text(json.dumps({"version": VERSION, "generatedAt": now, "items": items_f}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    # 같은 개정법(예: 정부조직법)의 제개정이유가 수십 건에 반복되므로 한 번만 저장하고 번호로 가리킨다
    reasons, rid, packed = [], {}, {}
    for k, v in items_d.items():
        v = dict(v)
        t = v.pop("reason", "") or ""
        if t not in rid:
            rid[t] = len(reasons)
            reasons.append(t)
        v["r"] = rid[t]
        packed[k] = v
    DETAILS_OUT.write_text(json.dumps({"version": VERSION, "generatedAt": now, "reasons": reasons, "items": packed},
                                      ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    n = {c: sum(1 for v in items_f.values() if c in v) for c in ("벌칙", "과태료", "과징금", "처분", "신설", "의무", "삭제")}
    log(f"amend_details: {len(items_f)}건 · " + " · ".join(f"{k} {v}" for k, v in n.items()) + (f" · 실패 {len(failed)}" if failed else ""))
    return items_f


if __name__ == "__main__":
    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
    build(force="--force" in sys.argv, only=only)
