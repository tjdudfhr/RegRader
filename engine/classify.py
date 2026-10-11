"""모든 법령을 회사마다 빠짐없이 판정한다: 적용 / 적용(추정) / 미적용(추정) / 미적용. 사람에게 묻지 않는다.

판정 근거는 회사 사실(kb/catalog.json 의 항목·숫자·지역)이고, 사실마다 값을 엔진이 정한다.
- 예: 공공데이터·공시·사용자 수정으로 확인됨, 또는 kb/facts.json 의 likely 조건이 맞아 '예(추정)'
- 아니오: 확인됨(사용자가 뺌·자료상 아님), 또는 likely 조건이 맞지 않아 '아니오(추정)'
  review 조건이 맞으면 '아니오(추정)'이되 경계에 있는 판단으로 표시한다 (검토 권장, 판정은 막지 않음)
- 추정 조건은 다른 추정 사실을 근거로 쓸 수 있다 (예: 건물 소유(추정) → 승강기 관리)
- 숫자(근로자 수·자산)나 지역을 전혀 모를 때만 '확인 필요'가 남는다

규칙(kb/rules.json · kb/universe.json)마다 조건을 계산하고, 법령은 그 법령이 든 규칙들 중 가장 강한 결과를 받는다.
- 확인된 사실로 조건이 맞으면 '적용', 추정한 사실이 끼면 '추정'
- 어느 규칙도 맞지 않으면 '미적용' (왜 아닌지 reasons 에 남긴다)
"""
import json
from functools import lru_cache
from pathlib import Path

from engine import lawapi

KB = Path(__file__).resolve().parents[1] / "kb"
T, F, U = "T", "F", "U"
STATUS_RANK = {"적용": 0, "추정": 1, "확인": 2, "미적용": 3}
STATUS_LABEL = {"적용": "적용", "추정": "적용(추정)", "확인": "확인 필요", "미적용": "미적용"}
NUM_LABEL = {"employees": ("상시근로자", "명"), "assets": ("자산총액", "억원")}
FLAG_NO = {"listed": "비상장", "audited": "외부감사 대상 아님", "group": "공시대상기업집단 소속 아님"}


@lru_cache(maxsize=1)
def facts_kb():
    return json.loads((KB / "facts.json").read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def labels():
    cat = json.loads((KB / "catalog.json").read_text(encoding="utf-8"))
    out = {o["id"]: o["label"] for s in cat["sections"] for o in s["options"]}
    out.update({f["id"]: f["label"] for f in cat["flags"]})
    out.update({n["id"]: n["label"] for n in cat["numbers"]})
    out["regions"] = "사업장 소재지"
    from engine import industry
    out.update(industry.labels())
    return out


def label(fact):
    return labels().get(fact, fact)


class Facts:
    """회사 사실의 3값 상태. profile: {tags, flags, denied, numbers, regions}."""

    def __init__(self, profile):
        self.yes = set(profile.get("tags") or []) | set(profile.get("flags") or [])
        self.no = set(profile.get("denied") or [])
        self.nums = {k: float(v) for k, v in (profile.get("numbers") or {}).items() if v not in (None, "") and float(v) > 0}
        r = profile.get("regions") or {}
        self.regions = set(r.get("provinces") or []) | {c for c in (r.get("cities") or []) if c}
        self.groups = facts_kb()["groups"]
        self._memo = {}
        self.basis = {}

    def expand(self, items):
        out = []
        for x in items:
            out += self.groups.get(x, [x])
        return out

    def _prior(self, cond):
        """사전 판단 조건. 사실은 확인·추정 값을 모두 쓴다 (추정 사실에서 다시 추정할 수 있음)."""
        ok = True if cond.get("always") else bool(cond)
        yes = lambda f: self.state(f)[0] == T  # noqa: E731
        if "any" in cond and not any(yes(f) for f in self.expand(cond["any"])):
            return False
        if "all" in cond and not all(yes(f) for f in self.expand(cond["all"])):
            return False
        if "none" in cond and any(yes(f) for f in self.expand(cond["none"])):
            return False
        if "flag" in cond and not yes(cond["flag"]):
            return False
        for k, n in (cond.get("gte") or {}).items():
            if k not in self.nums or self.nums[k] < float(n):
                return False
        for k, n in (cond.get("lt") or {}).items():
            if k not in self.nums or self.nums[k] >= float(n):
                return False
        if "regions" in cond and not self.regions & set(cond["regions"]):
            return False
        return ok

    def state(self, fact):
        """(값, 추정 여부, 출처). 출처: 확인 / 추정 / 검토(아니오로 정했지만 경계)"""
        if fact in self._memo:
            return self._memo[fact]
        if fact in self.yes:
            r = (T, False, "확인")
        elif fact in self.no:
            r = (F, False, "확인")
        else:
            self._memo[fact] = (F, True, "추정")  # 순환 방지: 계산 중에는 아니오로 본다
            p = facts_kb()["facts"].get(fact, {})
            hit = next((c for c in p.get("likely", []) if self._prior(c)), None)
            if hit is not None:
                r = (T, True, "추정")
                self.basis[fact] = hit
            elif any(self._prior(c) for c in p.get("review", [])):
                r = (F, True, "검토")
            else:
                r = (F, True, "추정")
        self._memo[fact] = r
        return r

    def why(self, fact):
        """추정으로 '예'가 된 근거 (사람이 읽는 한 줄)."""
        return describe(self.basis.get(fact) or {})


def describe(cond):
    """사전 판단 조건 → '제조업 · 공장 · 상시 300명 이상' 같은 한 줄."""
    bits = []
    groups = facts_kb()["groups"]
    name = {"MFG": "제조업", "CHEMISH": "화학·전자·금속·의약 제조", "HEAVY": "중화학 제조", "FIN": "금융업"}
    for key in ("any", "all"):
        xs = cond.get(key) or []
        if xs:
            labs = [name.get(x) or label(x) for x in xs]
            bits.append((" 또는 " if key == "any" else " · ").join(labs[:4]) + (" 등" if len(labs) > 4 else ""))
    if cond.get("flag"):
        bits.append(label(cond["flag"]))
    for k, n in (cond.get("gte") or {}).items():
        nm, unit = NUM_LABEL.get(k, (label(k), ""))
        bits.append(f"{nm} {int(n):,}{unit} 이상")
    for k, n in (cond.get("lt") or {}).items():
        nm, unit = NUM_LABEL.get(k, (label(k), ""))
        bits.append(f"{nm} {int(n):,}{unit} 미만")
    if cond.get("regions"):
        bits.append("항만·임해 지역 사업장" if len(cond["regions"]) > 8 else "·".join(cond["regions"]) + " 사업장")
    if cond.get("always"):
        bits.append("대부분의 회사")
    _ = groups
    return " · ".join(bits)


def evaluate(when, facts, skip=()):
    """조건 → (값, 추정 여부, 모르는 사실들, 추정으로 '예'가 된 사실들, 아닌 이유들)."""
    parts = []  # (val, est, unknown, presumed, reasons)
    if "never" in when:  # 기업에 적용되지 않는 법률 (kb/universe.json 의 범위 밖 분류)
        return F, bool(when.get("est")), set(), set(), [when["never"]]
    if when.get("always"):
        parts.append((T, False, set(), set(), []))
    if "any" in when:
        fs = facts.expand(when["any"])
        st = {f: facts.state(f) for f in fs}
        yes = [f for f in fs if st[f][0] == T]
        unk = {f for f in fs if st[f][0] == U}
        if yes:
            sure = [f for f in yes if not st[f][1]]
            parts.append((T, not sure, set(), set() if sure else {yes[0]}, []))
        elif unk:
            parts.append((U, False, unk, set(), []))
        else:
            est = any(st[f][1] for f in fs)
            parts.append((F, est, set(), set(), [" · ".join(label(f) for f in fs[:3]) + (" 등" if len(fs) > 3 else "") + " 해당 없음"]))
    if "all" in when:
        fs = facts.expand(when["all"])
        st = {f: facts.state(f) for f in fs}
        no = [f for f in fs if st[f][0] == F]
        unk = {f for f in fs if st[f][0] == U}
        if no:
            parts.append((F, all(st[f][1] for f in no), set(), set(), [f"{label(no[0])} 해당 없음"]))
        elif unk:
            parts.append((U, False, unk, set(), []))
        else:
            pres = {f for f in fs if st[f][1]}
            parts.append((T, bool(pres), set(), pres, []))
    if "none" in when:  # 이 사실 중 하나라도 '예'면 이 규칙은 아니다 (예: 은행 중 인터넷전문은행 제외)
        fs = facts.expand(when["none"])
        yes = [f for f in fs if facts.state(f)[0] == T]
        if yes:
            parts.append((F, facts.state(yes[0])[1], set(), set(), [f"{label(yes[0])}에는 해당 없음"]))
    if "flag" in when:
        f = when["flag"]
        v, est, _ = facts.state(f)
        if v == T:
            parts.append((T, est, set(), {f} if est else set(), []))
        elif v == U:
            parts.append((U, False, {f}, set(), []))
        else:
            parts.append((F, est, set(), set(), [FLAG_NO.get(f, f"{label(f)} 아님")]))
    for op in ("gte", "lt"):
        for k, n in (when.get(op) or {}).items():
            name, unit = NUM_LABEL.get(k, (label(k), ""))
            if k not in facts.nums:
                if k in skip:
                    parts.append((F, True, set(), set(), [f"{name} 정보 없음"]))
                else:
                    parts.append((U, False, {k}, set(), []))
                continue
            ok = facts.nums[k] >= float(n) if op == "gte" else facts.nums[k] < float(n)
            word = "미만" if op == "gte" else "이상"
            parts.append((T, False, set(), set(), []) if ok else (F, False, set(), set(), [f"{name} {int(n):,}{unit} {word}"]))
    if "regions" in when:
        if not facts.regions:
            parts.append((U, False, {"regions"}, set(), []))
        elif facts.regions & set(when["regions"]):
            parts.append((T, False, set(), set(), []))
        else:
            parts.append((F, False, set(), set(), ["해당 지역 사업장 없음"]))
    if not parts:
        return F, False, set(), set(), ["조건 없음"]
    fails = [p for p in parts if p[0] == F]
    if fails:
        return F, all(p[1] for p in fails), set(), set(), [r for p in fails for r in p[4]]
    unks = [p for p in parts if p[0] == U]
    if unks:
        return U, False, set().union(*(p[2] for p in unks)), set(), []
    return T, any(p[1] for p in parts), set(), set().union(*(p[3] for p in parts)), []


def classify(profile, rules):
    """법령마다 판정. 반환: {법령명 압축: {root, job, status, tier, reasons, questions, presumed, notReasons, keywords, admNames, ruleIds}}"""
    facts = Facts(profile)
    laws = {}
    for rule in rules:
        val, est, unk, pres, why_not = evaluate(rule.get("when") or {}, facts, rule.get("skipUnknown") or ())
        for law in rule["laws"]:
            key = lawapi.compact(law["name"])
            e = laws.setdefault(key, {"root": law["name"], "job": law["job"], "scope": rule.get("scope", "rules"), "tests": []})
            e["tests"].append({"rule": rule, "val": val, "est": est, "unknown": unk, "presumed": pres, "whyNot": why_not})
    out = {}
    for key, e in laws.items():
        tests = e["tests"]
        sure = [t for t in tests if t["val"] == T and not t["est"]]
        guess = [t for t in tests if t["val"] == T and t["est"]]
        unknown = [t for t in tests if t["val"] == U]
        if sure:
            status, basis = "적용", sure
        elif guess:
            status, basis = "추정", guess
        elif unknown:
            status, basis = "확인", unknown
        else:
            status, basis = "미적용", []
        live = sure + guess + (unknown if status == "확인" else [])
        tier = "필수" if any(t["rule"].get("tier") == "필수" for t in basis) else "확인"
        keywords, adm_names = {}, []
        for t in live:
            for i, kw in enumerate(t["rule"].get("adm") or []):
                keywords[kw] = max(keywords.get(kw, 0), 2.0 if i < 2 else 1.0)
            adm_names += [n for n in t["rule"].get("admNames") or [] if n not in adm_names]
        not_reasons = []
        if status == "미적용":
            for t in tests:
                for r in t["whyNot"]:
                    if r not in not_reasons:
                        not_reasons.append(r)
        questions = sorted(set().union(*(t["unknown"] for t in unknown))) if status == "확인" else []
        presumed = sorted(set().union(*(t["presumed"] for t in guess))) if status == "추정" else []
        out[key] = {
            "root": e["root"], "job": e["job"], "scope": e["scope"], "status": status, "tier": tier if status != "미적용" else "",
            "reasons": list(dict.fromkeys(t["rule"]["why"] for t in (sure + guess if status in ("적용", "추정") else basis))),
            "questions": questions, "presumed": presumed,
            "notReasons": not_reasons[:4], "notEstimated": status == "미적용" and all(t["est"] for t in tests if t["val"] == F),
            "keywords": keywords, "admNames": adm_names, "ruleIds": [t["rule"]["id"] for t in live],
            "admStrict": bool(live) and all(t["rule"].get("admStrict") for t in live),
            "blockers": sorted({f for t in tests if t["val"] == F and "never" not in (t["rule"].get("when") or {})
                                for f in facts.expand((t["rule"].get("when") or {}).get("any", []) + (t["rule"].get("when") or {}).get("all", []))
                                if facts.state(f)[0] == F and facts.state(f)[1]}) if status == "미적용" else [],
        }
    return out


def reviews(classified, profile):
    """'아니오(추정)'으로 정했지만 경계에 있는 사실들과, '예'라면 적용될 법령 (판정은 이미 끝났고, 고치고 싶을 때만 본다)."""
    facts = Facts(profile)
    by = {}
    for c in classified.values():
        if c["status"] != "미적용":
            continue
        for f in c.get("blockers", []):
            if facts.state(f)[2] == "검토":
                by.setdefault(f, []).append(c["root"])
    out = [{"fact": f, "label": label(f), "laws": laws} for f, laws in by.items()]
    out.sort(key=lambda x: (-len(x["laws"]), x["label"]))
    return out


def questions(classified):
    """'확인' 법령들이 기다리는 질문: 사실별로 묶고 영향 법령이 많은 순."""
    by = {}
    for c in classified.values():
        for q in c["questions"]:
            by.setdefault(q, []).append(c["root"])
    out = [{"fact": q, "label": label(q), "kind": "number" if q in NUM_LABEL else "region" if q == "regions" else "yesno",
            "laws": laws} for q, laws in by.items()]
    out.sort(key=lambda x: (-len(x["laws"]), x["label"]))
    return out


def presumptions(classified, profile=None):
    """추정으로 '예'라고 본 사실들과 근거 (틀리면 빼면 판정이 바뀐다)."""
    facts = Facts(profile or {})
    by = {}
    for c in classified.values():
        for f in c["presumed"]:
            by.setdefault(f, []).append(c["root"])
    out = []
    for f, laws in sorted(by.items(), key=lambda x: -len(x[1])):
        if profile is not None:
            facts.state(f)
        out.append({"fact": f, "label": label(f), "laws": laws, "why": facts.why(f) if profile is not None else ""})
    return out
