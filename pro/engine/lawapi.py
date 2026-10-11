"""국가법령정보센터 Open API (law.go.kr/DRF) 클라이언트.

- 표준 라이브러리만 쓴다. 응답은 .cache/lawapi/ 에 7일 보관한다.
- law.go.kr 는 해외 IP 를 막는다. 국내 IP 에서 실행한다.
- OC(인증 아이디)는 환경변수 LAW_OC 로 준다.
"""
import hashlib
import json
import os
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "lawapi"
SEARCH = "https://www.law.go.kr/DRF/lawSearch.do"
SERVICE = "https://www.law.go.kr/DRF/lawService.do"
OC = os.environ.get("LAW_OC", "knowhow1")
TTL = 7 * 24 * 3600
UA = "Mozilla/5.0 (RegRader Pro)"
LEVEL_ORDER = {"법률": 0, "시행령": 1, "시행규칙": 2}
SKIP_KEYS = {"기본정보", "행정규칙", "자치법규", "관련법령"}
# 회사 준수 의무와 무관한 하위법령 (법원 규칙, 정부 조직 직제)
NOISE_KINDS = {"대법원규칙", "헌법재판소규칙", "선거관리위원회규칙", "중앙선거관리위원회규칙", "국회규칙", "감사원규칙"}


def compact(name):
    """비교용 이름: 공백과 가운뎃점 표기 차이(· ㆍ ・)를 없앤다."""
    return re.sub(r"[\s·ㆍ・.]", "", (name or "").strip())


def _get(url, params):
    params = dict(params, OC=OC, type="JSON")
    key = hashlib.sha1((url + "?" + urllib.parse.urlencode(sorted(params.items()))).encode()).hexdigest()
    path = CACHE / f"{key}.json"
    if path.exists() and time.time() - path.stat().st_mtime < TTL:
        return json.loads(path.read_text(encoding="utf-8"))
    req = urllib.request.Request(url + "?" + urllib.parse.urlencode(params), headers={"User-Agent": UA})
    last = None
    for i in range(3):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                data = json.loads(r.read().decode("utf-8"))
            CACHE.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            return data
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.5 * (i + 1))
    raise RuntimeError(f"법제처 API 호출 실패: {last}")


def _as_list(x):
    if not x:
        return []
    return x if isinstance(x, list) else [x]


def search_law(name):
    """현행 법령 중 이름이 정확히 같은 것 (없으면 None)."""
    j = _get(SEARCH, {"target": "law", "query": name, "display": "50"})
    for x in _as_list((j.get("LawSearch") or {}).get("law")):
        if compact(x.get("법령명한글")) == compact(name):
            return {
                "name": x.get("법령명한글"),
                "kind": x.get("법령구분명"),
                "ministry": x.get("소관부처명"),
                "id": x.get("법령ID"),
                "mst": x.get("법령일련번호"),
                "effective": x.get("시행일자"),
            }
    return None


def find_laws(query, limit=8):
    """이름에 검색어가 든 현행 법령 (직접 추가용). 법률을 앞에 둔다."""
    j = _get(SEARCH, {"target": "law", "query": query, "display": "50"})
    out, seen = [], set()
    for x in _as_list((j.get("LawSearch") or {}).get("law")):
        name = x.get("법령명한글")
        if not name or compact(name) in seen:
            continue
        seen.add(compact(name))
        out.append({"name": name, "kind": x.get("법령구분명"), "ministry": x.get("소관부처명")})
    q = compact(query)
    out.sort(key=lambda x: (compact(x["name"]) != q, x["kind"] != "법률", len(x["name"])))
    return out[:limit]


def articles(name):
    """현행 법령의 조문 번호 → 제목. 예: {"제93조": "취업규칙의 작성ㆍ신고", "제76조의2": "직장 내 괴롭힘의 금지"}."""
    info = search_law(name)
    if not info:
        return {}
    j = _get(SERVICE, {"target": "law", "MST": info["mst"]})
    out = {}
    for a in _as_list(((j.get("법령") or {}).get("조문") or {}).get("조문단위")):
        if a.get("조문여부") != "조문":
            continue
        no = f"제{a.get('조문번호')}조" + (f"의{a['조문가지번호']}" if a.get("조문가지번호") else "")
        out[no] = a.get("조문제목") or ""
    return out


def search_admrul(name):
    """현행 행정규칙 중 이름이 정확히 같은 것 (없으면 None)."""
    j = _get(SEARCH, {"target": "admrul", "query": name, "display": "50"})
    for x in _as_list((j.get("AdmRulSearch") or {}).get("admrul")):
        if compact(x.get("행정규칙명")) == compact(name):
            return {
                "id": str(x.get("행정규칙ID") or ""),
                "name": x.get("행정규칙명"),
                "kind": x.get("행정규칙종류"),
                "ministry": x.get("소관부처명"),
                "effective": x.get("시행일자"),
            }
    return None


def _stmd_mst(name):
    j = _get(SEARCH, {"target": "lsStmd", "query": name, "display": "100"})
    hits = [x for x in _as_list((j.get("LsStmdSearch") or {}).get("law")) if compact(x.get("법령명")) == compact(name)]
    hits.sort(key=lambda x: 0 if x.get("법령구분명") == "법률" else 1)
    return hits[0].get("법령일련번호") if hits else None


def family(name):
    """법령체계도: 법률 → 시행령 → 시행규칙과, 각 단계에 연결된 행정규칙.

    돌려주는 값: {"members": [{name, level, kind, parent}], "admin": [{id, name, kind, link}]}
    체계도가 없으면 members 는 비어 있다.
    """
    mst = _stmd_mst(name)
    if not mst:
        return {"members": [], "admin": []}
    j = _get(SERVICE, {"target": "lsStmd", "MST": mst})
    top = ((j.get("법령체계도") or {}).get("상하위법")) or {}
    members, seen, admin, seen_adm = [], set(), [], set()

    def walk(node, level, parent):
        if not isinstance(node, dict):
            return
        info = node.get("기본정보") or {}
        nm = (info.get("법령명") or "").strip()
        kind = (info.get("법종구분") or {}).get("content") or ""
        if nm and compact(nm) not in seen and kind not in NOISE_KINDS and "직제" not in nm:
            seen.add(compact(nm))
            members.append({"name": nm, "level": level, "kind": kind, "parent": parent})
        rules = node.get("행정규칙") or {}
        for rkind, lst in (rules.items() if isinstance(rules, dict) else []):
            for x in _as_list(lst):
                b = (x or {}).get("기본정보") or {}
                rid = str(b.get("행정규칙ID") or "")
                if rid and rid not in seen_adm:
                    seen_adm.add(rid)
                    admin.append({
                        "id": rid,
                        "name": (b.get("행정규칙명") or "").strip(),
                        "kind": (b.get("법종구분") or {}).get("content") or rkind,
                        "link": nm or parent,
                    })
        for k in sorted((k for k in node if k not in SKIP_KEYS), key=lambda k: LEVEL_ORDER.get(k, 9)):
            for child in _as_list(node[k]):
                walk(child, k, nm or parent)

    for k, v in top.items():
        for node in _as_list(v):
            walk(node, k, None)
    return {"members": members, "admin": admin}
