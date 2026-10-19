"""개정 실무 판단: 신구법 비교(법령정보센터 oldAndNew)로 바뀐 조문의 전·후를 맞대고,
회사가 해야 할 일 · 대상 조건 · 바뀐 숫자를 뽑는다.

출력
  docs/amend_actions.json       개정(키: 법령명|시행일|일/타)별 요약 — 해야 할 일 · 바뀐 숫자 · 판정
  docs/oan/<법령일련번호>.json  상세 화면을 열 때만 읽는 조문별 변경 전·후 (바뀐 조문만)

판정 (v)
  act   회사가 새로 하거나 달리 해야 할 일이 있다 (의무 · 금지 신설 · 변경)
  check 회사 의무는 아니지만 숫자(금액 · 기한 · 인원)나 제재가 바뀌었다 — 확인
  tidy  행정기관 조문이거나 용어 · 인용 조문 정비뿐

회사 사실(당사 인원 등)은 docs/company_facts.json — 숫자 기준이 있는 대상 조건을 당사에 대 본다.
amend_details.py 의 회사 의무 판정(COMP · GOV · DUTY)과 시행일 계산을 그대로 쓴다.
"""
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
import amend_details as AD  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
OUT = DOCS / "amend_actions.json"
OAN_DIR = DOCS / "oan"
CACHE = Path.home() / "Library" / "Caches" / "RegRader" / "oan"
VERSION = 1   # 규칙을 바꾸면 올린다 -> 전체 다시 분석

TAG = re.compile(r"</?P>")
NEW_MARK = re.compile(r"^<\s*신\s*설\s*>$")
PLACE = re.compile(r"\((?:현행과\s*같음|생\s*략)\)\s*$")
DEL = re.compile(r"(?:^|\s)(?:삭\s*제|<\s*삭\s*제\s*>)\s*(?:<[^>]*>)?\s*$")
ART_HEAD = re.compile(r"^제(\d+)조(?:의(\d+))?\s*(?:\(([^()]*(?:\([^()]*\)[^()]*)*)\))?\s*")
CIRC = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳"
MARK = re.compile(r"^\s*([①-⑳]|\d+(?:의\d+)?\.|[가-하]\.)\s*")

# 해야 할 일의 종류: 의무 동사 바로 앞에서 찾는다
TYPES = [
    ("공시", r"공시"),
    ("신고·보고", r"신고|보고|제출|통보|통지"),
    ("허가·등록", r"허가를\s*받|승인을\s*받|등록|인증을\s*받|지정을\s*받|면허"),
    ("선임·지정", r"선임|지정|배치|두어야|임명"),
    ("교육", r"교육|훈련"),
    ("설치·구비", r"설치|갖추|구비|비치|마련"),
    ("점검·평가", r"점검|평가|측정|검사|진단|확인|조사"),
    ("기록·보존", r"기록|보존|보관|작성"),
    ("게시·고지", r"게시|알려야|주지|고지|안내|표시"),
    ("참여·협의", r"참여|협의|동의|의견을\s*(?:들|청취)"),
    ("계획 수립", r"계획|수립"),
    ("납부", r"납부|부담|지급"),
]
TYPE_RE = [(n, re.compile(p)) for n, p in TYPES]
BAN = re.compile(r"(아니\s*된다|안\s*된다|못한다)")
WHEN = re.compile(r"매년|매\s*분기|분기마다|매월|매\s*반기|반기마다|지체\s*없이|즉시|\d+일\s*이내|\d+개월\s*이내|\d+년(?:간|\s*동안)|미리|사전에|\d+년마다|매\s*\d+년")
COND = re.compile(r"(?:상시\s*)?(?:근로자|노동자|종업원)[^.。]{0,25}?(\d[\d,]*)\s*명\s*(이상|미만|이하|초과)|(\d[\d,]*)\s*명\s*(이상|미만|이하|초과)의?\s*(?:근로자|노동자|사업|사업장)")
DELEG = re.compile(r"(대통령령|총리령|[가-힣]+부령|고용노동부령|환경부령)으로\s*정하는\s*(수|규모|기준|사업|사업장|업종|자|금액|사람)")
NUM = re.compile(r"\d[\d,]*(?:\.\d+)?\s*(?:만|천만|백만|억|천|조)?\s*(?:원|명|일|개월|년|시간|퍼센트|%|배|회|톤|제곱미터|㎡|미터)")
# 의무 문장: '…하여야/해야/시켜야/받아야 한다' · '…아니 된다' (amend_details.DUTY 보다 넓게 — '참여시켜야 한다' 같은 것도)
DUTY = re.compile(r"(?:여야|해야|아야|어야|워야|켜야|와야|러야|라야|려야|져야|해야만)\s*한다|아니\s*된다|안\s*된다|하지\s*못한다")
REFS = re.compile(r"제\d+조(?:의\d+)?(?:제\d+항)?(?:제\d+호(?:의\d+)?)?(?:[가-하]목)?|같은\s*(?:조|항|호)|[①-⑳]")


def plain(s: str) -> str:
    return re.sub(r"\s+", " ", TAG.sub("", s or "")).strip()


# 비교에서 지우는 것: 서식 번호 · 부처 · 기관 이름 · 부령 이름 (정부조직 개편 · 서식 정비로 바뀐 문장은 같은 문장으로 본다)
NORM_DROP = re.compile(r"별지\s*제\d+호(?:의\d+)?\s*서식|[가-힣]+(?:부령|부장관|처장|청장|위원회|도지사|시장|군수|구청장|세무서장|세관장|기관의\s*장)|<\d+>")
GOV2 = re.compile(AD.GOV.pattern.replace("(장관|", "(장관|세관장|세무서장|지방국세청장|공무원|세관공무원|세무공무원|허가관청|"))
# 대상이 회사 일반이면 '해당', 특정 역할 · 신청인이면 '해당 시'
GENERIC = re.compile(r"^(?:사업주|사용자|사업자|회사|법인|내국법인|기업|고용주|개인정보처리자|모든\s*사업주|사업장의\s*사업주)$")


def norm(s: str) -> str:
    """비교용: 조항 번호 · 괄호 풀이 · 서식 · 기관 이름 · 띄어쓰기 · 문장부호를 지운다"""
    s = NORM_DROP.sub("", REFS.sub("", plain(s)))
    s = re.sub(r"\(이하[^)]*\)|“[^”]*”", "", s)
    return re.sub(r"[\s,.ㆍ·「」『』()\"']", "", s)


def fetch(mst: str):
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / f"{mst}.json"
    if f.exists():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except ValueError:
            f.unlink()
    last = None
    for i in range(3):
        try:
            r = requests.get(AD.SERVICE, params={"OC": AD.OC, "target": "oldAndNew", "MST": mst, "type": "JSON"},
                             headers={"User-Agent": AD.UA}, timeout=60)
            r.raise_for_status()
            d = r.json()
            f.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
            return d
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2 + i * 3)
    raise RuntimeError(f"{mst}: {last}")


def pairs_of(doc: dict):
    s = (doc or {}).get("OldAndNewService") or {}
    o = AD.as_list(((s.get("구조문목록") or {}).get("조문")))
    n = AD.as_list(((s.get("신조문목록") or {}).get("조문")))
    return [(a.get("content") or "", b.get("content") or "") for a, b in zip(o, n)]


def articles(pairs):
    """신구 쌍을 조문별로 묶는다: [{ref, title, items:[{m, k, o, n}]}]  k = 신설 · 삭제 · 변경 · 같음"""
    arts, cur = [], None
    for o, n in pairs:
        po, pn = plain(o), plain(n)
        head = ART_HEAD.match(pn) or ART_HEAD.match(po)
        if head and (pn.startswith("제") or po.startswith("제")):
            ref = f"제{head.group(1)}조" + (f"의{head.group(2)}" if head.group(2) else "")
            if not cur or cur["ref"] != ref:
                cur = {"ref": ref, "title": (head.group(3) or "").strip(), "items": []}
                arts.append(cur)
        if cur is None:
            cur = {"ref": "", "title": "", "items": []}
            arts.append(cur)
        body_o = ART_HEAD.sub("", po, count=1) if head else po
        body_n = ART_HEAD.sub("", pn, count=1) if head else pn
        mm = MARK.match(body_n) or MARK.match(body_o)
        m = mm.group(1) if mm else ""
        if NEW_MARK.match(po):
            k = "신설"
        elif DEL.search(pn) and not DEL.search(po):
            k = "삭제"
        elif PLACE.search(pn) or po == pn:
            k = "같음"
        else:
            k = "변경"
        cur["items"].append({"m": m, "k": k, "o": "" if k == "신설" else o.strip(), "n": "" if k == "삭제" else n.strip()})
    return arts


def sentences(txt: str):
    """의무 문장 단위: [{s: 문장, items: 각 호 목록}] — '…다.' 로 끊고, 한 칸에 붙어 온 다음 항(②…)도 나눈다.
    앞 문장 뒤에 이어진 '1. … 2. …' 목록은 문장으로 보지 않고 앞 문장에 붙인다."""
    t = ART_HEAD.sub("", plain(txt), count=1)
    out = []
    for part in re.split(r"(?=[②-⑳])", t):
        part = MARK.sub("", part, count=1)
        for i, x in enumerate(re.split(r"(?<=다\.)\s*(?=\S)", part)):
            x = x.strip()
            if not x:
                continue
            if i > 0 and re.match(r"^\d+(?:의\d+)?\.\s*", x):
                if out:
                    out[-1]["items"] += [y.strip()[:80] for y in re.split(r"(?:(?<=\s)|(?<=[^\d\s,]))(?=\d+(?:의\d+)?\.\s*[^\d\s])", x) if y.strip()][:10]
                continue
            out.append({"s": x, "items": []})
    return out


def company_duty(sent: str, art_text: str = "") -> bool:
    """회사가 지는 의무 · 금지인가 (주어가 회사 쪽 · 행정기관 주어보다 앞 · 노력 의무 제외)"""
    if not DUTY.search(sent) or AD.SOFT.search(sent):
        return False
    c, g = AD.COMP.search(sent), GOV2.search(sent)
    if c and (not g or c.start() < g.start()):
        return True
    if c or g:
        return False
    if art_text:   # 주어 없는 문장(호 · 후단): 조문 첫 문장의 주어를 따른다
        c2, g2 = AD.COMP.search(art_text), GOV2.search(art_text)
        return bool(c2 and (not g2 or c2.start() < g2.start()) and DUTY.search(art_text))
    return False


def act_type(sent: str) -> str:
    dm = list(DUTY.finditer(sent))
    if dm and BAN.search(dm[-1].group(0)):
        return "금지"
    end = dm[-1].start() if dm else len(sent)
    window = sent[max(0, end - 40):end + 12]
    best, pos = "", -1
    for name, rx in TYPE_RE:
        for m in rx.finditer(window):
            if m.start() > pos:
                best, pos = name, m.start()
    return best or "준수"


def who_of(sent: str):
    """(대상 구절, 역할 낱말) — 예: ('우선지원대상기업의 사업주', '사업주')"""
    sent = re.sub(r"^<\d+>", "", sent).strip()
    c, g = AD.COMP.search(sent), GOV2.search(sent)
    if not c or (g and g.start() < c.start()):
        return "", ""
    w = sent[:c.end()]
    w = re.sub(r"(?:는|은|가|이|,|와|과|\s*및|\s*등은|\s*등이)$", "", w).strip()
    w = re.sub(r"^\s*(다만|이 경우|또한|제\d+항에도 불구하고)\s*,?\s*", "", w)
    w = re.sub(r"^[①-⑳]\s*", "", w)
    return w[-90:], re.sub(r"\s+", "", c.group(1))


def cond_of(text: str, facts: dict):
    """대상 조건: 숫자 기준이면 당사 인원과 대 본다 / 하위 법령에 맡긴 기준이면 확인 필요"""
    m = COND.search(text)
    if m:
        n = int((m.group(1) or m.group(3)).replace(",", ""))
        op = m.group(2) or m.group(4)
        label = m.group(0).strip()
        hc = facts.get("headcount")
        if isinstance(hc, int):
            ok = {"이상": hc >= n, "초과": hc > n, "미만": hc < n, "이하": hc <= n}[op]
            return {"t": label, "ok": ok, "why": f"당사 {hc:,}명"}
        return {"t": label}
    d = DELEG.search(text)
    if d:
        return {"t": d.group(0), "deleg": True}
    return None


def similar(a: str, pool):
    """가장 비슷한 종전 문장과 그 비율"""
    na = norm(a)
    best, txt = 0.0, ""
    if not na:
        return best, txt
    for b, raw in pool:
        r = SequenceMatcher(None, na, b).ratio() if b else 0.0
        if r > best:
            best, txt = r, raw
            if best > 0.97:
                break
    return best, txt


def spans(s: str):
    return re.findall(r"<P>(.*?)</P>", s or "", flags=re.S)


def num_changes(o: str, n: str):
    """바뀐 부분(<P>…</P>)의 숫자가 같은 단위로 바뀐 것: '1천만원' → '3천만원'"""
    so, sn = " ".join(spans(o)), " ".join(spans(n))
    a, b = NUM.findall(so), NUM.findall(sn)
    out = []
    if not a or not b:
        return out
    unit = lambda x: re.sub(r"[\d,.\s]", "", x).lstrip("만천백억조") or re.sub(r"[\d,.\s]", "", x)
    for x, y in zip(a, b):
        if re.sub(r"\s", "", x) != re.sub(r"\s", "", y) and unit(x) == unit(y):
            out.append((x.strip(), y.strip()))
    return out


def analyze(doc: dict, event_date: str, main_date: str, deferred, facts: dict):
    arts = articles(pairs_of(doc))
    # 시행일이 나뉜 개정: 이 시행일에 들어가는 조문만
    keep = [a for a in arts if not a["ref"] or event_date in AD.ref_dates(a["ref"], main_date, deferred)]
    old_pool = [(norm(x["s"]), x["s"]) for a in arts for it in a["items"] if it["o"] for x in sentences(it["o"])]
    acts, nums, gov, tidy = [], [], 0, 0
    changed_arts = []
    for a in keep:
        ch = [it for it in a["items"] if it["k"] != "같음"]
        if not ch:
            continue
        changed_arts.append(a)
        art_text = ART_HEAD.sub("", " ".join(plain(it["n"]) for it in a["items"] if it["n"] and not PLACE.search(plain(it["n"]))), count=1)
        art_text = re.sub(r"^\s*<\d+>", "", art_text)
        sanction_art = bool(re.search(r"벌칙|과태료|과징금|양벌", a["title"]))
        art_has = False
        for it in ch:
            m = it["m"]
            ref = a["ref"] + (f" {m}" if m and m[0] in CIRC else (f" {m.rstrip('.')}호" if m and m[0].isdigit() else (f" {m.rstrip('.')}목" if m else "")))
            item_text = plain(it["n"]) or plain(it["o"])
            g, c0 = GOV2.search(item_text), AD.COMP.search(item_text)
            gov_first = bool(g and (not c0 or g.start() < c0.start()))
            for x, y in num_changes(it["o"], it["n"]):
                if re.match(r"^(19|20)\d\d\s*년$", x) or (gov_first and not sanction_art):
                    continue      # 연도 바꾸기 · 행정기관 쪽 숫자(위원 수 · 조사 기간)는 뺀다
                nums.append({"ref": ref, "title": a["title"], "b": x, "a": y, "s": sanction_art})
            if it["k"] == "삭제" or not it["n"]:
                continue
            for sx in sentences(it["n"]):
                s = sx["s"]
                if not company_duty(s, art_text):
                    if GOV2.search(s) and DUTY.search(s):
                        gov += 1
                    continue
                sim, before = similar(s, old_pool)
                if sim >= 0.93:
                    continue          # 문장은 그대로 — 조항 번호만 옮겼거나 용어만 바꿈
                state = "신설" if sim < 0.6 else "변경"
                c = cond_of(s, facts) or cond_of(art_text[:400], facts)
                w = WHEN.search(s)
                who, role = who_of(s)
                if not who:
                    who, role = who_of(art_text[:300])
                bare = re.sub(r"^(?:모든|사업장의|해당)\s*", "", who)
                if c and not c.get("deleg") and "ok" in c:
                    fit = "yes" if c["ok"] else "no"
                elif c:
                    fit = "cond"
                elif role and GENERIC.match(role) and re.sub(r"\s+", "", bare) == role:
                    fit = "yes"      # 대상이 회사 일반(사업주 · 회사 · 개인정보처리자 …)
                else:
                    fit = "if"       # 특정 역할 · 신청인 · 조건이 붙은 대상 — 해당할 때만
                act = {
                    "ref": ref, "title": a["title"], "type": act_type(s), "state": state, "fit": fit, "role": role,
                    "who": who, "cond": c, "when": w.group(0) if w else "",
                    "text": s[:420] + ("…" if len(s) > 420 else ""),
                }
                if sx["items"]:
                    act["items"] = sx["items"]
                if state == "변경" and before:
                    act["before"] = before[:420] + ("…" if len(before) > 420 else "")
                acts.append(act)
                art_has = True
        if not art_has and not any(n for n in nums if n["ref"].startswith(a["ref"])):
            tidy += 1
    # 같은 문장이 여러 번 잡히면 한 번만
    seen, uniq = set(), []
    for x in acts:
        k = norm(x["text"])[:120]
        if k not in seen:
            seen.add(k)
            uniq.append(x)
    v = "act" if uniq else ("check" if nums else "tidy")
    return {
        "v": v, "acts": uniq[:25], "nums": nums[:20], "arts": [a["ref"] for a in changed_arts],
        "n": {"art": len(changed_arts), "acts": len(uniq), "nums": len(nums), "gov": gov, "tidy": tidy},
    }, changed_arts


def resolve_delegated(items, rows, facts):
    """법률이 '대통령령으로 정하는 수 이상의 근로자' 처럼 하위 법령에 맡긴 대상 기준을 올해 바뀐 시행령 · 시행규칙에서 찾아 채운다.
    예: 산업안전보건법 제10조의2① → 시행령 제12조의2 '상시근로자 수가 500명 이상인 사업주' → 당사 2,722명 해당"""
    vers = {}
    for r in rows:
        vers.setdefault(r["t"], set()).add(r["u"])
    cache = {}

    def texts(u):
        if u not in cache:
            try:
                j = json.loads((OAN_DIR / f"{u}.json").read_text(encoding="utf-8"))
                cache[u] = [(a["ref"], plain(it["n"])) for a in j.get("arts", []) for it in a.get("items", []) if it.get("n")]
            except (OSError, ValueError):
                cache[u] = []
        return cache[u]

    n = 0
    for key, res in items.items():
        title = key.split("|")[0]
        if re.search(r"시행령$|시행규칙$", title):
            continue
        for a in res.get("acts", []):
            c = a.get("cond")
            if not (c and c.get("deleg")) or c.get("src"):
                continue
            m = re.match(r"(제\d+조(?:의\d+)?)(?:\s*([①-⑳]))?", a["ref"])
            if not m:
                continue
            target = "법 " + m.group(1) + (f"제{CIRC.index(m.group(2)) + 1}항" if m.group(2) else "")
            found = None
            for sub in (title + " 시행령", title + " 시행규칙"):
                for u in sorted(vers.get(sub, ())):
                    for ref, t in texts(u):
                        for sent in re.split(r"(?<=다\.)\s*", t):
                            if target in sent:
                                cm = cond_of(sent, facts)
                                if cm and not cm.get("deleg"):
                                    found = dict(cm, src=f"{sub.replace(title, '').strip()} {ref}")
                                    break
                        if found:
                            break
                    if found:
                        break
                if found:
                    break
            if found:
                a["cond"] = found
                if "ok" in found:
                    a["fit"] = "yes" if found["ok"] else "no"
                n += 1
    return n


def compact_arts(arts):
    """상세 화면용: 바뀐 항목만 + 앞뒤 맥락 없이"""
    out = []
    for a in arts:
        items = [{"m": it["m"], "k": it["k"], "o": it["o"], "n": it["n"]} for it in a["items"] if it["k"] != "같음"]
        if items:
            out.append({"ref": a["ref"], "title": a["title"], "items": items})
    return out


def facts_of():
    p = DOCS / "company_facts.json"
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def build(force=False, log=print):
    old = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    if old.get("version") != VERSION:
        force = True
    facts = facts_of()
    rows = [r for r in AD.event_rows() if not r.get("k") and r.get("u")]
    items = {} if force else dict(old.get("items") or {})
    live = {AD.key_of(r) for r in rows}
    todo = [r for r in rows if force or AD.key_of(r) not in items]
    msts = sorted({r["u"] for r in todo})
    log(f"amend_actions: 분석할 개정 {len(todo)}건 (법령 버전 {len(msts)}개)")

    def get(m):
        try:
            return m, fetch(m), AD.fetch_law(m)
        except Exception as e:  # noqa: BLE001
            return m, e, None

    docs, failed = {}, []
    with ThreadPoolExecutor(max_workers=3) as ex:
        for m, d, law in ex.map(get, msts):
            if isinstance(d, Exception):
                failed.append(m)
                log(f"  {m} 받기 실패: {d}")
            else:
                docs[m] = (d, law)
    OAN_DIR.mkdir(exist_ok=True)
    for r in todo:
        got = docs.get(r["u"])
        if not got:
            continue
        doc, law = got
        info = (law or {}).get("기본정보") or {}
        main = info.get("시행일자") or ""
        main_date = f"{main[:4]}-{main[4:6]}-{main[6:]}" if len(main) == 8 else r["d"]
        deferred = AD.date_map(info.get("조문시행일자문자열"))
        try:
            res, arts = analyze(doc, r["d"], main_date, deferred, facts)
        except Exception as e:  # noqa: BLE001
            log(f"  {AD.key_of(r)} 분석 실패: {e}")
            continue
        items[AD.key_of(r)] = res
        f = OAN_DIR / f"{r['u']}.json"
        f.write_text(json.dumps({"u": r["u"], "arts": compact_arts(articles(pairs_of(doc)))}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    items = {k: v for k, v in items.items() if k in live}
    got = resolve_delegated(items, rows, facts)
    if got:
        log(f"amend_actions: 하위 법령에서 대상 기준을 찾아 채움 {got}건")
    keep_u = {r["u"] for r in rows}
    for f in OAN_DIR.glob("*.json"):
        if f.stem not in keep_u:
            f.unlink()
    OUT.write_text(json.dumps({"version": VERSION, "generatedAt": datetime.now(timezone.utc).isoformat(), "facts": facts, "items": items},
                              ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    c = {k: sum(1 for v in items.values() if v["v"] == k) for k in ("act", "check", "tidy")}
    log(f"amend_actions: {len(items)}건 · 할 일 있음 {c['act']} · 확인 {c['check']} · 정비 {c['tidy']}" + (f" · 실패 {len(failed)}" if failed else ""))
    return items


if __name__ == "__main__":
    build(force="--force" in sys.argv)
