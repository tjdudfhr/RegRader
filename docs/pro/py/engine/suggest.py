"""회사 정보(업종·사업장·인허가·설비·물질·사업 활동)로 적용법규 후보를 만든다.

1. kb/rules.json 의 규칙을 회사 정보에 맞춰 본다 → 후보 법령과 '왜 해당하는지'
2. 같은 법령은 하나로 합친다 (근거를 모두 모은다)
3. 법제처 API 로 법령명이 실제로 있는지 확인하고, 법령체계도로 시행령·시행규칙을 붙인다
4. 체계도에 연결된 행정규칙(고시 등) 중 규칙의 키워드에 맞는 것만 추천한다

실행: python3 -m engine.suggest examples/manufacturer.json
"""
import json
from functools import lru_cache
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from engine import lawapi

ROOT = Path(__file__).resolve().parents[1]
KB = ROOT / "kb"
JOBS = ["안전", "환경", "인사노무", "재무회계", "공정거래", "정보보호", "지배구조", "지식재산권", "기타"]
TIER_RANK = {"필수": 0, "확인": 1}
# 회사 준수 의무와 거리가 먼 행정규칙: 기관 내부 운영, 공공시설·생활폐기물 등 지자체·기관 대상
ADM_NOISE = [
    "직제", "위임전결", "정원", "인사규정", "청사", "생활폐기물", "생활계", "공공처리",
    "측정망", "예측", "검사기관", "지정기관", "대행계약", "원가계산", "캠퍼스", "개성공업지구", "집적지구 지정",
    "처리이행보증", "처리단가", "의료폐기물", "반입수수료", "반입협력금", "선별시설",
    "전문기관", "기관 지정", "인증방법", "농산물", "사료", "남북교역", "차량통관", "휴대품", "여행자",
    "업에 있어서의", "병행수입", "단체 지정", "특별통관", "교육경비", "수급조절", "제작결함",
]
# 지역을 가리키는 행정규칙 (그 지역 사업장에만 해당)
PLACES = [
    "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "충청", "전북", "전남", "전라",
    "경북", "경남", "경상", "제주", "수원", "성남", "용인", "화성", "평택", "안산", "시흥", "김포", "파주", "이천", "안성", "청주",
    "충주", "천안", "아산", "당진", "서산", "전주", "군산", "익산", "정읍", "여수", "광양", "순천", "목포", "나주", "포항", "구미",
    "경주", "김천", "안동", "경산", "영천", "창원", "김해", "양산", "진주", "거제", "통영", "사천", "밀양", "원주", "강릉", "춘천",
    "동해", "삼척", "제천", "진천", "음성", "오창", "오송", "대산", "온산", "남동", "반월", "시화", "녹산", "달성", "성서", "탕정",
    "북평", "상평", "금산", "새만금", "낙동강", "영산강", "금강", "한강",
    "구례", "영암", "해남", "무안", "담양", "화순", "곡성", "보성", "장흥", "강진", "완도", "진도", "신안", "영광", "함평", "장성",
    "고흥", "남원", "김제", "완주", "진안", "무주", "장수", "임실", "순창", "고창", "부안", "보령", "논산", "공주", "계룡", "홍성",
    "예산", "태안", "서천", "부여", "청양", "보은", "옥천", "영동", "증평", "괴산", "단양", "횡성", "영월", "평창", "정선", "철원",
    "화천", "양구", "인제", "고성", "양양", "홍천", "태백", "속초", "상주", "문경", "영주", "영덕", "청송", "영양", "봉화", "울진",
    "울릉", "의성", "군위", "칠곡", "성주", "고령", "청도", "예천", "함안", "창녕", "의령", "하동", "남해", "산청", "함양", "거창",
    "합천", "기장", "울주", "강화", "옹진", "가평", "양평", "여주", "포천", "연천", "동두천", "양주", "의정부", "남양주", "구리",
    "하남", "광명", "부천", "안양", "군포", "의왕", "과천", "오산", "고양", "서귀포", "삽교", "진위천", "임진강", "섬진강", "만경강",
    "동진강", "형산강", "태화강", "안성천", "한탄강", "팔당",
]
REGION_MARKS = ["산업단지", "산단", "농공단지", "유역환경청", "지방환경청", "특별대책지역", "수계", "유역", "총량관리", "지역지정", "설치제한"]
# 업종 전용 고시: 회사 업종과 맞을 때만 남긴다 ('업종'이 이름에 있을 때)
INDUSTRY_WORDS = {
    "반도체": "ind:electronics", "디스플레이": "ind:electronics", "전자": "ind:electronics", "이차전지": "ind:electronics",
    "석유화학": "ind:chem", "화학": "ind:chem", "도금": "ind:metal", "철강": "ind:metal", "금속": "ind:metal",
    "자동차": "ind:machinery", "기계": "ind:machinery", "제약": "ind:pharma", "의약품": "ind:pharma", "화장품": "ind:pharma",
    "식품": "ind:food", "시멘트": "ind:mineral", "염색": "ind:textile", "섬유": "ind:textile", "조선": "ind:ship",
}
CONSTRUCTION_TAGS = ("ind:construction", "site:construction", "act:construction_order")
# 체계도에 딸려 오지만 특정 품목·국가·지역만 대상인 하위법령
MEMBER_NOISE = ["덤핑방지관세", "특혜관세", "관세협상", "긴급관세", "조정관세", "할당관세", "외국인관광객", "여행객", "면세점",
                "농ㆍ축산", "농·축산", "비영리법인의 설립 및 감독", "비영리법인 설립 및 감독", "비영리법인의 설립과 감독"]
# 수십 종이 한 묶음으로 오는 기술기준은 한 줄로 접는다
BUNDLES = [("NFPC", "화재안전성능기준(NFPC) — 소방시설 종류별 설치·관리 기준"),
           ("NFTC", "화재안전기술기준(NFTC) — 소방시설 종류별 세부 기술기준"),
           ("전기용품 안전기준(K", "전기용품 안전기준(KC) — 품목별 안전기준")]
# 환경청 등 관할 이름 → 시·도 (지역 고시를 사업장 지역과 맞출 때)
JURISDICTION = {
    "한강": ["서울", "경기", "인천", "강원", "충북"], "낙동강": ["부산", "울산", "경남", "대구", "경북"],
    "금강": ["대전", "세종", "충남", "충북", "전북"], "영산강": ["광주", "전남"], "섬진강": ["전남", "전북", "경남"],
    "대구지방환경청": ["대구", "경북"], "원주지방환경청": ["강원"], "전북지방환경청": ["전북"], "새만금": ["전북"],
    "수도권": ["서울", "경기", "인천"],
}
TOP_N = 8


def load_rules(universe=True):
    """kb/rules.json 의 정밀 규칙 + kb/universe.json 의 나머지 현행 법률 전부 (적용 조건 또는 적용되지 않는 이유)."""
    rules = json.loads((KB / "rules.json").read_text(encoding="utf-8"))["rules"]
    if universe:
        from engine import industry as IND
        from engine import universe as U
        rules = rules + list(U.rules()) + list(IND.rules())
    return rules


def load_duties():
    d = json.loads((KB / "duties.json").read_text(encoding="utf-8"))
    return {lawapi.compact(k): v for k, v in d.items() if not k.startswith("_")}


def duties_for(root, profile, duties=None, facts=None):
    """법령의 핵심 의무 중 이 회사에 해당하는 것. 사전 판단으로 '모름'이면 '해당 시'로 표시한다."""
    from engine.classify import Facts, evaluate
    duties = duties if duties is not None else load_duties()
    facts = facts or Facts(profile)
    out = []
    for d in duties.get(lawapi.compact(root), []):
        val, est, unk, _, _ = evaluate(d.get("when") or {"always": True}, facts)
        if val == "F":
            continue
        item = {k: d[k] for k in ("art", "title", "text") if k in d}
        if val == "U":
            item["ifApplicable"] = True
        elif est:
            item["estimated"] = True
        out.append(item)
    return out


@lru_cache(maxsize=1)
def fact_effects():
    """입력 항목(사실) → 그 사실을 조건으로 쓰는 판정 규칙의 법령 [{name, job, why}] (화면 '항목 추가'의 관련 법령).
    묶음 이름(facts.json groups, 예: MFG)은 그 안의 항목으로 풀어서 센다. 'none'(해당하면 빠지는 조건)은 넣지 않는다."""
    groups = json.loads((KB / "facts.json").read_text(encoding="utf-8")).get("groups", {})
    out = {}
    for r in load_rules(universe=True):
        w = r.get("when") or {}
        if not isinstance(w, dict):
            continue
        ids = set()
        for k in ("any", "all"):
            for x in w.get(k) or []:
                if isinstance(x, str):
                    ids |= set(groups.get(x, [x]))
        for fid in ids:
            laws = out.setdefault(fid, [])
            seen = {x["name"] for x in laws}
            for law in r["laws"]:
                if law["name"] not in seen:
                    seen.add(law["name"])
                    laws.append({"name": law["name"], "job": law.get("job") or "기타", "why": r.get("why") or ""})
    return out


def load_catalog():
    return json.loads((KB / "catalog.json").read_text(encoding="utf-8"))


def matches(when, profile):
    """규칙 조건이 회사 정보에 맞는지. 적힌 조건은 모두 만족해야 한다."""
    tags = set(profile.get("tags") or [])
    nums = profile.get("numbers") or {}
    flags = set(profile.get("flags") or [])
    if when.get("always"):
        pass
    if "any" in when and not tags.intersection(when["any"]):
        return False
    if "all" in when and not set(when["all"]).issubset(tags):
        return False
    if "flag" in when and when["flag"] not in flags:
        return False
    if "regions" in when:
        r = profile.get("regions") or {}
        if not set(when["regions"]).intersection(list(r.get("provinces") or []) + list(r.get("cities") or [])):
            return False
    for key, threshold in (when.get("gte") or {}).items():
        try:
            if float(nums.get(key) or 0) < float(threshold):
                return False
        except (TypeError, ValueError):
            return False
    for key, threshold in (when.get("lt") or {}).items():
        try:
            if not 0 < float(nums.get(key) or 0) < float(threshold):
                return False
        except (TypeError, ValueError):
            return False
    return bool(when)


def classify_profile(profile, rules=None):
    """등록된 모든 법령의 판정 (engine/classify.py)."""
    from engine.classify import classify
    return classify(profile, rules if rules is not None else load_rules())


def candidates(profile, rules=None, statuses=("적용", "추정", "확인")):
    """판정이 적용·추정·확인인 법령 → 법제처 확인 전 후보 목록 (네트워크 없음)."""
    out = []
    for c in classify_profile(profile, rules).values():
        if c["status"] in statuses:
            out.append(dict(c, jobs=[c["job"]]))
    return out


def region_tokens(profile):
    r = profile.get("regions") or {}
    toks = list(r.get("provinces") or []) + [c.strip() for c in (r.get("cities") or []) if c and c.strip()]
    return [t for t in toks if t]


_PLACE_RX = None
AMBIGUOUS_PLACES = ["부여", "영양", "보은", "인제", "청양", "고성", "의령", "진도"]  # 보통 낱말로도 쓰인다


def _place_rx():
    """지명은 낱말 경계에서만 본다 ('건강진단'의 '강진', '조경기준'의 '경기'는 지명이 아니다)."""
    global _PLACE_RX
    if _PLACE_RX is None:
        names = "|".join(sorted((p for p in PLACES if p not in AMBIGUOUS_PLACES), key=len, reverse=True))
        amb = "|".join(AMBIGUOUS_PLACES)
        _PLACE_RX = re.compile(r"(?:^|[\s(「『_·,])(?:(" + names + r")(?=특별|광역|시|군|구|도|지역|권|유역|지방|산업단지|산단|[\s)_·,]|$)"
                               r"|(" + amb + r")(?=시|군))")
    return _PLACE_RX


def is_regional(name):
    if _place_rx().search(name) or any(m in name for m in REGION_MARKS):
        return True
    # '…지정·고시(구례 용방)'처럼 끝 괄호에 장소가 붙은 것 (연도·NFPC 번호는 제외)
    m = re.search(r"\(([^()]*)\)\s*$", name)
    return bool(m and not re.search(r"\d|NFPC|NFTC|[A-Za-z]", m.group(1)) and _place_rx().search("(" + m.group(1)))


_SCOPE = None


def admin_scope():
    """kb/admin_scope.json: 대상자(기관 내부용)·다른 업종·계열별 범위 규칙."""
    global _SCOPE
    if _SCOPE is None:
        d = json.loads((KB / "admin_scope.json").read_text(encoding="utf-8"))
        _SCOPE = {
            "audience": re.compile(d["audience"]),
            "sector": [(re.compile(x["rx"]), set(x["unless"])) for x in d["sector"]],
            "families": {lawapi.compact(k): {kk: re.compile(vv) for kk, vv in v.items()} for k, v in d["families"].items()},
        }
    return _SCOPE


def admin_out(name, tags=(), root=""):
    """이 행정규칙을 뺄 이유 (남기면 빈 문자열)."""
    sc = admin_scope()
    if any(n in name for n in ADM_NOISE) or sc["audience"].search(name):
        return "audience"
    tags = set(tags)
    for rx, unless in sc["sector"]:
        if rx.search(name) and not unless & tags:
            return "sector"
    fam = sc["families"].get(lawapi.compact(root)) or {}
    if "only" in fam and not fam["only"].search(name):
        return "scope"
    if "drop" in fam and fam["drop"].search(name):
        return "scope"
    if "업종" in name:
        words = [w for w in INDUSTRY_WORDS if w in name]
        if words and not any(INDUSTRY_WORDS[w] in tags for w in words):
            return "sector"
    return ""


def pick_admin(admin, keywords, regions, tags=(), root="", strict=False):
    """연결된 행정규칙을 골라 낸다 → (추천, 관련, 묶음, 뺀 수).

    - 기관 내부용·다른 업종·계열 범위 밖은 뺀다 (kb/admin_scope.json)
    - 특정 지역 것은 회사 사업장 지역과 맞을 때만 남긴다
    - 규칙 키워드가 이름에 든 것·사업장 지역 것은 점수순으로 TOP_N 개 '추천', 나머지 남긴 것은 '관련' (둘 다 적용 후보)
    - NFPC 같은 수십 종 기술기준은 한 줄 묶음으로
    """
    scored, related, bundles, other = [], [], {}, 0
    for a in admin:
        nm = a["name"]
        if admin_out(nm, tags, root):
            other += 1
            continue
        local = False
        if is_regional(nm):
            near = any(t in nm for t in regions) or any(k in nm and set(v) & set(regions) for k, v in JURISDICTION.items())
            if not near:
                other += 1
                continue
            local = True
        bundle = next((b for b in BUNDLES if b[0] in nm), None)
        if bundle:
            if bundle[1]:
                bundles.setdefault(bundle[1], []).append(a)
            continue
        hit = [k for k in keywords if k in nm]
        if not hit and not local:
            if strict:  # 낱말을 정해 둔 법률만 (kb/universe.json): 맞지 않는 행정규칙은 뺀다
                other += 1
            else:
                related.append(dict(a, matched=[]))
            continue
        score = sum(keywords[k] for k in hit) + (1 if a.get("kind") == "고시" else 0) + (2 if local else 0) - (2 if "수수료" in nm else 0)
        scored.append(dict(a, matched=hit + (["사업장 지역"] if local else []), score=score))
    scored.sort(key=lambda a: (-a["score"], a["name"]))
    related.sort(key=lambda a: (a.get("kind") != "고시", a["name"]))
    seen, uniq = set(), []
    for a in scored + related:
        if a["name"] not in seen:
            seen.add(a["name"])
            uniq.append(a)
    n_scored = min(len({a["name"] for a in scored}), TOP_N)
    picks = [dict(b, bundle=[x["name"] for x in items]) for b, items in
             (({"id": "bundle:" + label, "name": label, "kind": "묶음", "matched": ["소방시설"]}, items) for label, items in bundles.items())]
    return uniq[:n_scored], uniq[n_scored:], picks, other


def resolve(c, regions=(), tags=()):
    """후보 하나를 법제처에서 확인하고 체계도로 펼친다."""
    info = lawapi.search_law(c["root"])
    fam = lawapi.family(c["root"]) if info else {"members": [], "admin": []}
    members = [m for m in fam["members"] if not any(n in m["name"] for n in MEMBER_NOISE) and not re.search(r"제\d+조(의\d+)?에 따른", m["name"])]
    members = members or ([{"name": info["name"], "level": "법률", "kind": info["kind"], "parent": None}] if info else [])
    picked, more, bundles, other = pick_admin(fam["admin"], c["keywords"], regions, tags, c["root"], strict=c.get("admStrict", False))
    for nm in reversed(c["admNames"]):
        # 꼭 넣을 고시는 순위와 상관없이 맨 앞으로
        found = next((a for a in picked + more if lawapi.compact(a["name"]) == lawapi.compact(nm)), None)
        if found:
            if found in more:
                more.remove(found)
            else:
                picked.remove(found)
            picked.insert(0, dict(found, matched=["필수 고시"] + found["matched"], score=99))
            continue
        a = lawapi.search_admrul(nm)
        if a:
            picked.insert(0, dict(a, matched=["필수 고시"], link=c["root"], score=99))
    if len(picked) > TOP_N:
        more = picked[TOP_N:] + more
        picked = picked[:TOP_N]
    return dict(
        c,
        verified=bool(info),
        ministry=(info or {}).get("ministry"),
        kind=(info or {}).get("kind"),
        members=members,
        admin=picked,
        adminMore=more,
        bundles=bundles,
        adminOther=other,
    )


MFG_TAGS = {"ind:chem", "ind:metal", "ind:electronics", "ind:machinery", "ind:mineral", "ind:food", "ind:pharma", "site:factory"}


def admin_tags(profile):
    """행정규칙 고를 때 쓰는 태그 (대형 제조사는 건설공사 발주자이기도 하다)."""
    tags = set(profile.get("tags") or [])
    if tags & MFG_TAGS and float((profile.get("numbers") or {}).get("employees") or 0) >= 300:
        tags.add("size:big-mfg")
    return tags


STATUS_RANK = {"적용": 0, "추정": 1, "확인": 2, "미적용": 3}


def suggest(profile, workers=4):
    """회사 정보 → 등록된 모든 법령의 판정과, 적용·추정·확인 법령의 체계도·행정규칙·의무."""
    from engine.classify import Facts, presumptions, questions, reviews
    cls = classify_profile(profile)
    cands = [dict(c, jobs=[c["job"]]) for c in cls.values() if c["status"] != "미적용"]
    regions = region_tokens(profile)
    tags = admin_tags(profile)
    with ThreadPoolExecutor(max_workers=workers) as pool:
        fams = list(pool.map(lambda c: resolve(c, regions, tags), cands))
    # 다른 후보의 체계도 안에 이미 들어 있는 법령은 그 계열로 합친다 (예: 시행규칙만 따로 잡힌 경우)
    inside = {}
    for f in fams:
        for m in f["members"][1:]:
            inside.setdefault(lawapi.compact(m["name"]), f)
    merged = []
    for f in fams:
        host = inside.get(lawapi.compact(f["root"]))
        if host is not None and host is not f:
            host["reasons"] += [r for r in f["reasons"] if r not in host["reasons"]]
            if STATUS_RANK[f["status"]] < STATUS_RANK[host["status"]]:
                host["status"] = f["status"]
            continue
        merged.append(f)
    duties = load_duties()
    facts = Facts(profile)
    for f in merged:
        f["duties"] = duties_for(f["root"], profile, duties, facts)
    merged.sort(key=lambda f: (JOBS.index(f["job"]) if f["job"] in JOBS else 99, STATUS_RANK[f["status"]],
                               TIER_RANK.get(f["tier"], 1), f["root"]))
    applied = [f for f in merged if f["status"] in ("적용", "추정")]
    pending = [f for f in merged if f["status"] == "확인"]
    from engine import universe as U
    scope_label = {k: v.get("label", k) for k, v in U.load().get("scopes", {}).items()}
    not_app = sorted(({"root": c["root"], "job": c["job"], "reasons": c["notReasons"], "estimated": c["notEstimated"],
                       "scope": c.get("scope", "rules"),
                       "scopeLabel": scope_label.get(c.get("scope"), "") if c.get("scope") in U.OUT_OF_SCOPE else ""}
                      for c in cls.values() if c["status"] == "미적용"),
                     key=lambda x: (JOBS.index(x["job"]) if x["job"] in JOBS else 99, x["root"]))
    by_job, by_job_status = {}, {}
    for f in merged:
        by_job[f["job"]] = by_job.get(f["job"], 0) + 1
    for c in list(merged) + not_app:
        st = c.get("status", "미적용")
        by_job_status.setdefault(c["job"], {"적용": 0, "추정": 0, "확인": 0, "미적용": 0})[st] += 1

    def adm_total(fs):
        return sum(len(f["admin"]) + len(f["adminMore"]) + sum(len(b["bundle"]) for b in f["bundles"]) for f in fs)

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "profile": profile,
        "summary": {
            "registry": len(cls),
            "byStatus": {st: sum(1 for c in cls.values() if c["status"] == st) for st in STATUS_RANK},
            "byJobStatus": by_job_status,
            "families": len(applied),
            "pending": len(pending),
            "notApplicable": len(not_app),
            "laws": sum(len(f["members"]) or 1 for f in applied),
            "admin": sum(len(f["admin"]) for f in applied),
            "adminRelated": sum(len(f["adminMore"]) for f in applied),
            "adminTotal": adm_total(applied),
            "pendingLaws": sum(len(f["members"]) or 1 for f in pending),
            "pendingAdmin": adm_total(pending),
            "byJob": by_job,
            "notFound": [f["root"] for f in merged if not f["verified"]],
        },
        "families": merged,
        "notApplicable": not_app,
        "scopes": {k: {"label": v.get("label", k), "reason": v.get("reason", "")} for k, v in U.load().get("scopes", {}).items()},
        "questions": questions(cls),
        "presumptions": presumptions(cls, profile),
        "reviews": reviews(cls, profile),
    }


def main(argv):
    if len(argv) < 2:
        print("사용법: python3 -m engine.suggest <회사정보.json>")
        return 2
    profile = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
    res = suggest(profile)
    out = ROOT / "out"
    out.mkdir(exist_ok=True)
    (out / "result.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    s = res["summary"]
    print(f"법령 계열 {s['families']}개 · 법령 {s['laws']}개 · 추천 행정규칙 {s['admin']}개")
    print("직무별:", s["byJob"])
    if s["notFound"]:
        print("법제처에서 찾지 못한 이름:", s["notFound"])
    for f in res["families"]:
        mark = "" if f["verified"] else "  ⚠ 확인 필요"
        print(f"[{f['job']}] {f['tier']} {f['root']} (+{len(f['members']) - 1 if f['members'] else 0} 하위, 고시 {len(f['admin'])}){mark}")
    return 0


def add_law(name, job, profile):
    """사용자가 직접 넣은 법령 하나를 법제처에서 확인하고 체계도로 펼친다."""
    c = {"root": name, "jobs": [job], "job": job, "tier": "직접 추가", "reasons": [],
         "ruleIds": [], "keywords": {}, "admNames": []}
    f = resolve(c, region_tokens(profile), admin_tags(profile))
    f["category"] = job
    f["duties"] = duties_for(f["root"], profile)
    return f


VERDICT_RANK = {"적용": 0, "검토 필요": 1, "해당 가능성 낮음": 2}


def _categories(res):
    by_cat = {}
    for f in res["families"]:
        by_cat[f["category"]] = by_cat.get(f["category"], 0) + 1
    order = JOBS + [c for c in by_cat if c not in JOBS]
    res["categories"] = [{"name": n, "description": "", "count": by_cat[n]} for n in order if by_cat.get(n)]
    res["summary"]["byCategory"] = by_cat


def apply_ai(res, cls, profile):
    """AI 판단(직무·적용 여부·추가 제안)을 결과에 합친다 (유료 AI 를 켰을 때만).

    - AI 가 정한 직무를 쓰고, AI 가 안 붙인 법령은 규칙의 직무를 쓴다.
    - AI 가 더 제안한 법령은 법제처에 실제로 있는 것만 넣고, 체계도·고시까지 펼친다.
    """
    by_root = {lawapi.compact(x["root"]): x for x in cls.get("laws") or []}
    fams = res["families"]
    have = {lawapi.compact(f["root"]) for f in fams}
    for f in fams:
        a = by_root.get(lawapi.compact(f["root"]))
        f["category"] = (a or {}).get("category") or f["job"]
        if a:
            f["verdict"], f["aiReason"] = a["verdict"], a["reason"]
    regions = region_tokens(profile)
    tags = admin_tags(profile)
    added = []
    for x in cls.get("additional") or []:
        key = lawapi.compact(x["name"])
        if key in have:
            continue
        c = {"root": x["name"], "jobs": [x["category"]], "job": x["category"], "tier": "AI 제안", "reasons": [],
             "ruleIds": [], "keywords": {k: 1.5 for k in x.get("keywords") or []}, "admNames": []}
        f = resolve(c, regions, tags)
        if not f["verified"]:
            continue  # 법제처에 없는 이름은 버린다
        f.update(category=x["category"], verdict="적용", aiReason=x["reason"], aiAdded=True,
                 duties=duties_for(x["name"], profile))
        fams.append(f)
        have.add(key)
        added.append(f["root"])
    rank = {j: i for i, j in enumerate(JOBS)}
    fams.sort(key=lambda f: (rank.get(f["category"], 99), VERDICT_RANK.get(f.get("verdict"), 1),
                             TIER_RANK.get(f["tier"], 2), f["root"]))
    _categories(res)
    res["summary"].update(
        families=len(fams),
        laws=sum(len(f["members"]) or 1 for f in fams),
        admin=sum(len(f["admin"]) for f in fams),
        adminRelated=sum(len(f["adminMore"]) for f in fams),
        adminTotal=sum(len(f["admin"]) + len(f["adminMore"]) + sum(len(b["bundle"]) for b in f["bundles"]) for f in fams),
        aiAdded=added,
        aiLow=[f["root"] for f in fams if f.get("verdict") == "해당 가능성 낮음"],
    )
    res["ai"] = True
    return res


def plain_categories(res):
    """AI 없이: 규칙의 직무로 묶는다."""
    for f in res["families"]:
        f["category"] = f["job"]
    _categories(res)
    res["ai"] = False
    return res


if __name__ == "__main__":
    sys.exit(main(sys.argv))
