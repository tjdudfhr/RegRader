"""RegRader Pro 판정 결과 → RegRader(현행 시스템) 데이터.

Pro 가 적용(·추정)으로 판정한 법령 계열과 행정규칙을 RegRader 의 적용법규 목록 형식으로 쓰고,
RegRader 저장소에 커밋된 수집 스크립트(refresh_laws.py → law_families · admin_rules · amend_details)를 그대로 돌린다.
그래서 결과물(m0~m7.json · index.json · meta.json · law_families.json · admrul_* · amend_* · changelog.json)이
지금 RegRader 와 같은 형식이고, 화면(분기별 · 직무별 · 적용법규 · 계열)도 같은 것을 쓴다.

    python3 -m engine.export_regrader 에코프로비엠            # 회사 찾기 → 판정 → 내보내기 → 수집
    python3 -m engine.export_regrader 에코프로비엠 --no-run   # 적용법규 목록만 쓰고 수집은 하지 않는다
    python3 -m engine.export_regrader --site                  # 화면 사본만 다시 만든다

만드는 것 (out/ 은 저장소에 넣지 않는다)
  out/regrader/_site/            RegRader 화면 (커밋된 docs/ 의 html·js·css, 회사 데이터 없음) — 회사마다 같이 쓴다
  out/regrader/<회사>/scripts/   커밋된 수집 스크립트 사본 + 회사별 행정규칙 범위(admrul_scope.py · company_scope.json)
  out/regrader/<회사>/docs/      그 회사 데이터 (base_laws_207.json 부터 수집 결과까지)
  out/regrader/<회사>/export.json · export.log   진행 상태(단계 · 진행률)와 수집 기록
수집은 engine/rr_launch.py 로 돌린다: 스크립트는 그대로 두고, 법제처 응답을 Pro 와 같은 저장소(.cache/lawapi)에 두고 같이 쓴다
(Pro 가 판정하며 받은 법령체계도를 RegRader 계열 단계가 다시 받지 않는다).
화면은 server.py 의 /rr/<회사>/ 에서 연다 (회사 데이터 → 없으면 _site 의 화면 파일).

RegRader 와 다른 점 (회사별 사본에서만)
  - 직무에 '기타'를 더한다 (Pro 는 8개 직무 + 기타)
  - 대응 현황(Supabase 로그인)과 GitHub 법규 추가 요청은 끈다 — 회사 사본의 사용 기록이 RegRader 쪽으로 가지 않게
  - 행정규칙 범위는 RegRader 의 회사 검토 목록 대신 Pro 판정(추천 · 관련 · 묶음)을 쓴다
"""
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from engine import lawapi

ROOT = Path(__file__).resolve().parents[1]
# RegRader 저장소: RegRader 안의 pro/ 로 들어 있으면 그 저장소, 아니면 ~/RegRader-autoupdate (REGRADER_REPO 로 바꿀 수 있다)
_PARENT = ROOT.parent
REPO = Path(os.environ.get("REGRADER_REPO") or (_PARENT if (_PARENT / "scripts" / "refresh_laws.py").exists() and (_PARENT / ".git").exists()
                                                  else Path.home() / "RegRader-autoupdate"))
OUT = ROOT / "out" / "regrader"
SITE = OUT / "_site"
SCRIPTS = ["refresh_laws.py", "law_families.py", "admin_rules.py", "amend_details.py"]
ASSET_EXT = {".html", ".js", ".css", ".svg", ".jpg", ".png", ".mp4", ".vtt", ".pdf"}
ASSET_NAMES = {"manifest.json"}
STUBS = {
    "tracker.js": "/* RegRader Pro 회사별 사본: 대응 현황(Supabase 로그인) 기능은 끈다 */\n",
    "law-request.js": "/* RegRader Pro 회사별 사본: GitHub 법규 추가 요청은 끈다 (법령은 RegRader Pro 에서 더한다) */\n",
}
JOBS8 = {"인사노무", "공정거래", "정보보호", "지식재산권", "재무회계", "안전", "환경", "지배구조"}
LEVELS = ("법률", "시행령", "시행규칙")
STATUS_FILE = "export.json"
_LOCK = threading.Lock()
_RUNNING = set()


def slug(name):
    s = re.sub(r"\((주|유|사|재)\)|[㈜㈔㈕]|주식회사|유한회사|유한책임회사|합자회사|합명회사|사단법인|재단법인|\s임직원$", "", name or "")   # 국민연금 사업장명 '○○(주) 임직원'
    s = re.sub(r"[^0-9A-Za-z가-힣]+", "", s)
    return s or "company"


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _iso(ymd):
    s = re.sub(r"\D", "", str(ymd or ""))
    return f"{s[:4]}-{s[4:6]}-{s[6:8]}" if len(s) == 8 else ""


# ---------- RegRader 화면 사본 ----------

def _archive():
    """RegRader 저장소 HEAD 의 docs/ · scripts/ (커밋된 것만; 작업 중인 파일은 넣지 않는다)."""
    if not (REPO / ".git").exists():
        raise RuntimeError(f"RegRader 저장소가 없습니다: {REPO} (REGRADER_REPO 로 바꿀 수 있습니다)")
    head = subprocess.run(["git", "-C", str(REPO), "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
    tar = subprocess.run(["git", "-C", str(REPO), "archive", "--format=tar", "HEAD", "docs", "scripts"],
                         capture_output=True, check=True).stdout
    return head, tarfile.open(fileobj=io.BytesIO(tar))


_ARRAY = re.compile(r"\[\s*(['\"])[가-힣]+\1(?:\s*,\s*(['\"])[가-힣]+\2){7}\s*\]")


def add_etc_job(text):
    """8개 직무를 늘어놓은 배열·카운터·탭에 '기타'를 더한다 (화면 파일 하나의 내용 → 바뀐 내용)."""
    def arr(m):
        s = m.group(0)
        if set(re.findall(r"[가-힣]+", s)) != JOBS8:
            return s
        q = m.group(1)
        return s[:-1].rstrip() + f", {q}기타{q}]"
    text = _ARRAY.sub(arr, text)
    # 직무별 건수 객체 { "환경": 0, … "지배구조": 0 }
    text = re.sub(r'("지식재산권": 0,\s*"지배구조": 0)(\s*\})', r'\1, "기타": 0\2', text)
    # 직무별 현황 탭 · 적용법규 탭의 직무 목록
    tab = '<div class="filter-tab" data-filter="지배구조">🏛️ 지배구조 (<span id="count-지배구조">–</span>)</div>'
    text = text.replace(tab, tab + '\n                <div class="filter-tab" data-filter="기타">📁 기타 (<span id="count-기타">–</span>)</div>')
    item = re.search(r'( *)<div class="job-function-item" data-job="지식재산권".*?</div>\n', text, re.S)
    if item:
        pad = item.group(1)
        etc = (f'{pad}<div class="job-function-item" data-job="기타" onclick="showJobFunctionLaws(\'기타\', \'📁 기타\')">\n'
               f'{pad}    <span class="job-icon">📁</span>\n{pad}    <span class="job-name">기타</span>\n'
               f'{pad}    <span class="job-count" id="job-count-기타">–</span>\n{pad}</div>\n')
        text = text[:item.end()] + etc + text[item.end():]
    return text


PRO_JS = """/* RegRader Pro 회사별 사본: 어느 회사 데이터인지 화면 맨 위 · 사이드바 · 탭 제목에 표시한다 (pro_company.json · company-chip.js) */
(function () {
  fetch('./pro_company.json?v=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (c) {
      if (!c || !c.company || !window.rrCompanyChip) return;
      window.rrCompanyChip({ company: c.company, laws: c.laws, admin: c.admin, date: c.date || String(c.generatedAt || '').slice(0, 10),
                             home: '/', homeLabel: '다른 회사 판정' });
    })
    .catch(function () {});
})();
"""


def build_site(force=False, log=print):
    """out/regrader/_site/ : 커밋된 RegRader 화면 (회사 데이터 빼고). HEAD 가 같으면 다시 만들지 않는다."""
    head, tar = _archive()
    mark = SITE / ".commit"
    if not force and mark.exists() and mark.read_text().strip() == head:
        return head
    tmp = SITE.with_name("_site.tmp")
    shutil.rmtree(tmp, ignore_errors=True)
    (tmp / "scripts").mkdir(parents=True)
    n = 0
    for m in tar.getmembers():
        if not m.isfile():
            continue
        p = Path(m.name)
        if p.parts[0] == "scripts":
            if p.name in SCRIPTS:
                (tmp / "scripts" / p.name).write_bytes(tar.extractfile(m).read())
            continue
        rel = Path(*p.parts[1:])
        if rel.suffix.lower() not in ASSET_EXT and rel.name not in ASSET_NAMES:
            continue   # 데이터(json·xlsx)와 문서는 회사마다 새로 만든다
        if rel.parts[0] == "pro":
            continue   # 브라우저판 Pro (docs/pro/) 는 회사 화면 사본에 넣지 않는다
        dest = tmp / "docs" / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        if rel.name in STUBS:
            dest.write_text(STUBS[rel.name], encoding="utf-8")
        elif rel.suffix in (".html", ".js"):
            text = add_etc_job(tar.extractfile(m).read().decode("utf-8"))
            if rel.name == "index.html":
                chip_v = hashlib.sha1((ROOT / "web" / "company-chip.js").read_bytes()).hexdigest()[:8]   # 바뀌면 브라우저가 새로 받게
                text = text.replace("</body>", f'    <script src="./company-chip.js?v={chip_v}"></script>\n    <script src="./pro-company.js"></script>\n</body>', 1)
                text = text.replace('data-src="./pro/?embed=1"', 'data-src="/?embed=1"')   # 기업별 적용법규 검색 탭: 이 서버의 Pro 화면
                # 회사 사본은 매일 자동 수집하지 않는다 (RegRader Pro 에서 다시 보내면 새로 수집)
                text = text.replace("<b>매일 07:00 자동 수집</b>", "<b>RegRader Pro 에서 보낼 때 수집</b>")
            dest.write_text(text, encoding="utf-8")
        else:
            dest.write_bytes(tar.extractfile(m).read())
        n += 1
    (tmp / "docs" / "pro-company.js").write_text(PRO_JS, encoding="utf-8")
    shutil.copy2(ROOT / "web" / "company-chip.js", tmp / "docs" / "company-chip.js")   # 회사 이름 표시 (브라우저판 사본도 쓴다)
    missing = [s for s in SCRIPTS if not (tmp / "scripts" / s).exists()]
    if missing:
        raise RuntimeError(f"RegRader 저장소에 수집 스크립트가 없습니다: {', '.join(missing)}")
    (tmp / ".commit").write_text(head)
    shutil.rmtree(SITE, ignore_errors=True)
    tmp.rename(SITE)
    log(f"화면 사본: RegRader {head[:7]} · 파일 {n}개 → {SITE.relative_to(ROOT)}")
    return head


# ---------- Pro 판정 → RegRader 적용법규 ----------

def applied(result):
    """suggest() 결과에서 RegRader 로 넘길 계열 (적용 · 추정 · 직접 추가)."""
    return [f for f in result["families"] if f.get("status", "적용") in ("적용", "추정") or f.get("tier") == "직접 추가"]


def _job(f):
    return f.get("category") or f.get("job") or "기타"


def _level(m):
    lv = m.get("level")
    if lv in LEVELS:
        return lv
    t = (m.get("name") or "").strip()
    return "시행령" if t.endswith("시행령") else "시행규칙" if t.endswith("시행규칙") else "법률"


def base_items(families, workers=6):
    """계열의 법령(법률 · 시행령 · 시행규칙)마다 RegRader 적용법규 한 줄. 이름은 법제처 현행 이름으로 맞춘다."""
    rows, seen = [], set()
    for f in families:
        if not f.get("verified", True):
            continue
        members = f.get("members") or [{"name": f["root"], "level": "법률"}]
        for m in members:
            k = lawapi.compact(m["name"])
            if k in seen:
                continue
            seen.add(k)
            rows.append((m, f))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        infos = list(pool.map(lambda mf: lawapi.search_law(mf[0]["name"]), rows))
    items, missing = [], []
    for (m, f), info in zip(rows, infos):
        if not info:
            missing.append(m["name"])
        info = info or {}
        meta = {"ministry": info.get("ministry") or f.get("ministry") or "", "lsId": info.get("id") or "",
                "proFamily": f["root"], "proStatus": f.get("status") or "적용"}
        if f.get("reasons"):
            meta["proWhy"] = " / ".join(f["reasons"])
        if f.get("presumed"):
            meta["proPresumed"] = f["presumed"]
        items.append({"id": f"law_{len(items) + 1:03d}", "title": info.get("name") or m["name"], "categories": [_job(f)],
                      "lawType": _level(m), "effectiveDate": _iso(info.get("effective")), "status": "현행", "meta": meta})
    return items, missing


def _admrul_row(rid, name):
    """행정규칙 검색에서 그 ID 의 현행 정보 (일련번호 · 발령일 · 시행일 · 제개정구분)."""
    j = lawapi._get(lawapi.SEARCH, {"target": "admrul", "query": name, "display": "50"})
    for x in lawapi._as_list((j.get("AdmRulSearch") or {}).get("admrul")):
        if str(x.get("행정규칙ID") or "") == rid:
            return x
    return {}


def admin_selection(families, workers=6):
    """Pro 가 고른 행정규칙 (추천 · 관련 · 묶음) → (적용할 행정규칙ID, 체계도 밖이라 후보에 덧붙일 것)."""
    keep, tree_ids = {}, set()

    def tree(f):
        return lawapi.family(f["root"])["admin"] if f.get("verified", True) else []

    with ThreadPoolExecutor(max_workers=workers) as pool:
        trees = list(pool.map(tree, families))
    for f, adm in zip(families, trees):
        by_name = {a["name"]: a for a in adm}
        tree_ids |= {a["id"] for a in adm}
        chosen = list(f.get("admin") or []) + list(f.get("adminMore") or [])
        for b in f.get("bundles") or []:
            chosen += [by_name[n] for n in b.get("bundle") or [] if n in by_name]
        for a in chosen:
            rid = str(a.get("id") or "")
            if rid and not rid.startswith("bundle:"):
                keep.setdefault(rid, {"id": rid, "name": a["name"], "kind": a.get("kind") or "", "family": f["root"], "job": _job(f)})
    extra = []
    for rid, a in keep.items():
        if rid in tree_ids:
            continue
        x = _admrul_row(rid, a["name"])
        t = x.get("제개정구분명") or ""
        extra.append({"id": rid, "name": a["name"], "kind": x.get("행정규칙종류") or a["kind"], "seq": str(x.get("행정규칙일련번호") or ""),
                      "issued": str(x.get("발령일자") or ""), "effective": str(x.get("시행일자") or ""), "type": t,
                      "families": [a["family"]], "links": [f"{a['family']} (RegRader Pro 필수 고시)"], "jobs": [a["job"]]})
    return sorted(keep), extra


SCOPE_PY = '''#!/usr/bin/env python3
"""회사별 행정규칙 적용 범위 — RegRader Pro 가 판정한 행정규칙만 적용법규로 둔다.

engine/export_regrader.py 가 만든 파일이다. RegRader 원본 scripts/admrul_scope.py (특정 회사 검토 목록) 대신 쓰며
같은 이름(scope · apply · write_index · PROMOTE · EXCLUDE · KEEP)을 둔다.
  company_scope.json
    keep   Pro 가 적용으로 고른 행정규칙ID (추천 · 관련 · 묶음) — 이름 규칙의 '참고'로 접지 않는다
    all    true 면 연결 행정규칙을 모두 남긴다 (전체 법률 수집 — engine/static_site.py universe)
    extra  법령체계도에 연결돼 있지 않지만 Pro 가 꼭 넣은 고시 — 후보 목록(admrul_candidates.json)에 덧붙인다
나머지 연결 행정규칙은 '이 회사 사업과 무관'(pro)으로 뺀다.
바로 반영: python3 scripts/admrul_scope.py --apply
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

_CFG = json.loads((Path(__file__).resolve().parent / "company_scope.json").read_text(encoding="utf-8"))
REASONS = {"pro": "RegRader Pro 판정: 이 회사 사업과 무관"}
ALL = bool(_CFG.get("all"))   # 전체 법률 수집(브라우저용 공통 자료): 연결 행정규칙을 모두 남긴다


class _Every(set):
    def __contains__(self, item):
        return True


KEEP: set[str] = set(_CFG.get("keep") or [])
PROMOTE: set[str] = _Every() if ALL else KEEP
EXCLUDE: dict[str, str] = {}


def scope(item: dict) -> str:
    return "" if ALL or str(item.get("id") or "") in KEEP else "pro"


def _with_extra(docs: Path, items: list) -> list:
    have = {c["id"] for c in items}
    add = [dict(x, tag="", out="") for x in _CFG.get("extra") or [] if x["id"] not in have]
    if add:
        items.extend(add)
        path = docs / "admrul_candidates.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        data["items"], data["count"] = items, len(items)
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return items


def apply(docs: Path, log=print) -> None:
    path = docs / "admrul_candidates.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    for c in data["items"]:
        if c["id"] in PROMOTE:
            c["tag"] = ""
        c["out"] = scope(c)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    write_index(docs, data["items"])
    log(f"admrul_scope: 행정규칙 {len(data['items'])}개 중 적용 {sum(1 for c in data['items'] if not c.get('tag') and not c.get('out'))}")


def write_index(docs: Path, items: list) -> None:
    """화면용 짧은 목록 (RegRader 와 같은 형식). Pro 가 더한 고시를 후보 목록에 먼저 덧붙인다."""
    items = _with_extra(docs, items)
    (docs / "admrul_index.json").write_text(json.dumps({"generatedAt": datetime.now(timezone.utc).isoformat(), "items": [
        {"i": c["id"], "n": c["name"], "k": c["kind"], "q": c["seq"], "f": (c["families"] or [""])[0], "c": (c["jobs"] or [""])[0],
         "g": c["tag"], "e": c["effective"]} for c in items if not c.get("out")]}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    if "--apply" in sys.argv:
        apply(Path(__file__).resolve().parents[1] / "docs")
    else:
        print(__doc__)
'''


def workspace(name):
    return OUT / slug(name)


def status(name_or_slug):
    p = OUT / slug(name_or_slug) / STATUS_FILE
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def listing():
    """보낸 회사 전부의 상태 (RegRader '기업별 적용법규' 탭이 읽는다). 최근 것부터."""
    out = []
    for d in OUT.iterdir() if OUT.exists() else []:
        if d.name.startswith("_") or not d.is_dir():
            continue
        st = status(d.name)
        if not st:
            continue
        p = st.get("prepared") or {}
        out.append({"company": st.get("company"), "slug": d.name, "url": f"/rr/{d.name}/", "state": st.get("state"),
                    "step": st.get("step"), "progress": st.get("progress"), "result": st.get("result"),
                    "laws": p.get("laws"), "admin": p.get("admin"), "families": p.get("families"), "byJob": p.get("byJob"),
                    "date": p.get("date"), "finishedAt": st.get("finishedAt"), "updatedAt": st.get("updatedAt")})
    out.sort(key=lambda x: x.get("updatedAt") or "", reverse=True)
    return out


def _set_status(ws, **kw):
    p = ws / STATUS_FILE
    try:
        cur = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        cur = {}
    cur.update(kw, updatedAt=_now())
    p.write_text(json.dumps(cur, ensure_ascii=False, indent=1), encoding="utf-8")
    return cur


def prepare(name, families, profile=None, log=print):
    """회사 작업 폴더를 만든다: 수집 스크립트 사본 + 회사별 행정규칙 범위 + 적용법규 목록. 수집은 run() 이 한다."""
    head = build_site(log=log)
    ws = workspace(name)
    (ws / "docs").mkdir(parents=True, exist_ok=True)
    (ws / "scripts").mkdir(exist_ok=True)
    for s in SCRIPTS:
        shutil.copy2(SITE / "scripts" / s, ws / "scripts" / s)
    items, missing = base_items(families)
    keep, extra = admin_selection(families)
    (ws / "scripts" / "admrul_scope.py").write_text(SCOPE_PY, encoding="utf-8")
    (ws / "scripts" / "company_scope.json").write_text(json.dumps({"company": name, "keep": keep, "extra": extra},
                                                                  ensure_ascii=False, indent=1), encoding="utf-8")
    year = datetime.now().year
    base = {"generatedAt": _now(), "year": year, "description": f"{name} 적용 법규 {len(items)}개 (RegRader Pro 판정)",
            "total_laws": len(items), "items": items, "updatedAt": _now()}
    path = ws / "docs" / "base_laws_207.json"
    old = json.loads(path.read_text(encoding="utf-8")) if path.exists() else None
    changed = not old or [x["title"] for x in old["items"]] != [x["title"] for x in items] or \
        [x["categories"] for x in old["items"]] != [x["categories"] for x in items]
    path.write_text(json.dumps(base, ensure_ascii=False, indent=2), encoding="utf-8")
    jobs = {}
    for x in items:
        jobs[x["categories"][0]] = jobs.get(x["categories"][0], 0) + 1
    info = {"company": name, "generatedAt": _now(), "date": datetime.now().date().isoformat(), "regrader": head, "families": len(families), "laws": len(items),
            "admin": len(keep), "adminExtra": len(extra), "byJob": jobs, "notFound": missing,
            "profile": {k: (profile or {}).get(k) for k in ("name", "regions", "numbers", "flags")} if profile else None}
    (ws / "docs" / "pro_company.json").write_text(json.dumps(info, ensure_ascii=False, indent=1), encoding="utf-8")
    if not (ws / "docs" / "changelog.json").exists():   # 업데이트 내역 화면용 (두 번째 수집부터 기록이 쌓인다)
        (ws / "docs" / "changelog.json").write_text(json.dumps({"entries": [], "updatedAt": _now()}), encoding="utf-8")
    if changed:
        # 직무만 바뀌어도 계열 목록을 다시 만들게 한다 (law_families 는 법령 이름이 같으면 30일 동안 다시 만들지 않는다)
        (ws / "docs" / "law_families.json").unlink(missing_ok=True)
    elif (ws / "docs" / "admrul_candidates.json").exists():
        # 적용법규가 같으면 law_families 가 체계도를 다시 받지 않는다 → 행정규칙 범위만 다시 적용한다
        subprocess.run([python(), "scripts/admrul_scope.py", "--apply"], cwd=ws, check=True, capture_output=True)
    log(f"{name}: 적용법규 {len(items)}개 (계열 {len(families)}) · 행정규칙 {len(keep)}개 (체계도 밖 {len(extra)}) → {ws.relative_to(ROOT)}")
    if missing:
        log(f"  법제처 현행 법령에서 이름을 못 찾은 것 {len(missing)}개: {', '.join(missing[:10])}")
    return ws, info


def python():
    """RegRader 수집 스크립트를 돌릴 파이썬 (requests 가 있어야 한다)."""
    for py in [os.environ.get("REGRADER_PYTHON"), sys.executable, shutil.which("python3"), "/usr/bin/python3"]:
        if py and subprocess.run([py, "-c", "import requests"], capture_output=True).returncode == 0:
            return py
    raise RuntimeError("RegRader 수집에 필요한 requests 패키지가 있는 파이썬을 찾지 못했습니다 (REGRADER_PYTHON 으로 지정)")


def quarterly(ws):
    """예전 화면 일부가 읽는 quarterly_details.json 을 이번 수집 결과(index.json)로 만든다."""
    idx = json.loads((ws / "docs" / "index.json").read_text(encoding="utf-8"))
    year = idx["year"]
    qs = {f"Q{i}": {"period": f"{year}년 {3 * i - 2}~{3 * i}월", "count": 0, "laws": []} for i in range(1, 5)}
    items, cats, matrix = [], {}, {}
    for e in idx["items"]:
        q = f"Q{(int(e['effectiveDate'][5:7]) - 1) // 3 + 1}"
        url = (e.get("source") or {}).get("url") or ""
        law = {"id": e["id"], "title": e["title"], "summary": e.get("summary"), "effectiveDate": e["effectiveDate"],
               "effective_date": e["effectiveDate"], "lawType": e.get("lawType"), "law_type": e.get("lawType"),
               "status": e.get("status"), "ministry": e.get("ministry"), "categories": e.get("categories") or ["기타"],
               "detail_url": url, "originalTitle": e.get("originalTitle")}
        qs[q]["laws"].append(law)
        qs[q]["count"] += 1
        items.append(law)
        for c in law["categories"]:
            cats[c] = cats.get(c, 0) + 1
            matrix.setdefault(c, {k: 0 for k in qs})[q] += 1
    out = {"generatedAt": _now(), "year": year, "description": f"{year}년 적용법규 개정 (RegRader Pro 회사별 수집)",
           "total_laws": len(items), "quarters": qs, "items": items, "categoryBreakdown": cats, "categoryQuarterMatrix": matrix}
    (ws / "docs" / "quarterly_details.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")


class Progress:
    """수집 기록 줄 → 화면에 보일 단계와 진행률 (0~100).

    단계(진행률 몫): 올해 개정 목록 10 → 계열 묶기(법령체계도) 45 → 행정규칙 개정 목록 15 → 개정문 분석 25 → 마무리 5
    계열 단계는 적용법규 목록이 그대로면 RegRader 가 건너뛴다.
    """
    STAGES = {"list": (0, 10), "tree": (10, 45), "admrul": (55, 15), "amend": (70, 25), "end": (95, 5)}

    def __init__(self, roots):
        self.roots = max(roots, 1)
        self.total = {}
        self.acc = {}
        self.stage, self.frac, self.text = "list", 0.0, "법제처 올해 개정 목록 받는 중"
        self.versions = 0

    def pct(self):
        base, w = self.STAGES[self.stage]
        return min(99, int(base + w * min(self.frac, 1.0)))

    def feed(self, line):
        """한 줄을 읽고, 화면 문구가 바뀌면 True."""
        before = (self.stage, self.text, self.pct())
        t = line.strip()
        m = re.match(r"(law|eflaw) totalCnt=(\d+)", t)
        if m:
            self.total[m.group(1)] = int(m.group(2))
        m = re.match(r"(law|eflaw) p\d+ acc=(\d+)", t)
        if m and self.stage == "list":
            kind, n = m.group(1), int(m.group(2))
            self.acc[kind] = n
            # 현행(law) 목록이 1/3, 시행일 목록(eflaw, 연혁 포함)이 2/3 쯤 된다
            self.frac = (n / max(self.total.get("law", 1), 1) / 3 if kind == "law"
                         else 1 / 3 + 2 / 3 * n / max(self.total.get("eflaw", 1), 1))
            self.text = f"법제처 올해 개정 목록 받는 중 ({sum(self.acc.values()):,}/{sum(self.total.values()):,}건)"
        m = re.match(r"\[pro\] tree (\d+)", t)
        if m:
            n = int(m.group(1))
            self.stage, self.frac = "tree", n / self.roots
            self.text = f"계열 묶기 · 법령체계도 {min(n, self.roots)}/{self.roots}"
        if t.startswith(("admrul_candidates:", "law_families:")):
            self.stage, self.frac, self.text = "admrul", 0.0, "행정규칙 개정 목록 받는 중"
        m = re.match(r"\[pro\] admrul (\d+) (\d+)", t)
        if m:
            n, tot = int(m.group(1)), int(m.group(2)) or 1
            self.stage, self.frac = "admrul", n / tot
            self.text = f"행정규칙 개정 목록 {n}/{tot}쪽"
        m = re.match(r"amend_details: 분석할 개정 (\d+)건 \(법령 버전 (\d+)개\)", t)
        if m:
            self.versions = int(m.group(2))
            self.stage, self.frac = "amend", 0.0
            self.text = f"개정문 분석 · 개정 {int(m.group(1)):,}건" if self.versions else "개정문 분석 (새 개정 없음)"
        m = re.match(r"\[pro\] body (\d+)", t)
        if m and self.stage == "amend":
            n = int(m.group(1))
            self.frac = n / max(self.versions, 1)
            self.text = f"개정문 분석 · 법령 원문 {n}개 받음 (분석할 법령 버전 {self.versions}개 중 저장분 제외)"
        if t.startswith("amend_details: 행정규칙"):
            self.stage, self.frac, self.text = "end", 0.0, "마무리 (개정 표시 · 업데이트 내역 저장)"
        return (self.stage, self.text, self.pct()) != before


def _roots(ws):
    """계열 단계에서 법령체계도를 받을 법령 수 (law_families.guess_root 와 같은 규칙)."""
    items = json.loads((ws / "docs" / "base_laws_207.json").read_text(encoding="utf-8"))["items"]
    return len({re.sub(r"\s*(시행령|시행규칙)$", "", x["title"].strip()) for x in items})


def run(ws, log=print):
    """작업 폴더에서 RegRader 수집(refresh_laws.py)을 돌린다. 기록은 export.log, 진행은 export.json 의 step · progress."""
    prog = Progress(_roots(ws))
    _set_status(ws, state="running", step=prog.text, progress=0, error=None)
    logf = ws / "export.log"
    last = 0.0
    with open(logf, "w", encoding="utf-8") as fh:
        p = subprocess.Popen([python(), "-u", str(ROOT / "engine" / "rr_launch.py"), str(ws), str(lawapi.CACHE)],
                             stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                             env=dict(os.environ, PYTHONWARNINGS="ignore"))
        for line in p.stdout:
            changed = prog.feed(line)
            if not line.startswith("[pro] ") or "법제처 응답" in line:   # 진행 줄은 기록에 남기지 않는다 (응답 요약 · 실패는 남긴다)
                fh.write(line)
                fh.flush()
                if not line.startswith("  "):   # 쪽마다 찍는 줄은 화면에 다 보이지 않는다
                    log(line.rstrip())
            now = time.time()
            if changed and now - last > 1:
                _set_status(ws, step=prog.text, progress=prog.pct())
                last = now
        code = p.wait()
    if code != 0 or not (ws / "docs" / "meta.json").exists():
        tail = logf.read_text(encoding="utf-8").strip().splitlines()[-5:]
        _set_status(ws, state="error", step="수집 실패", error=" / ".join(tail), finishedAt=_now())
        raise RuntimeError("RegRader 수집 실패: " + " / ".join(tail))
    quarterly(ws)
    meta = json.loads((ws / "docs" / "meta.json").read_text(encoding="utf-8"))
    return _set_status(ws, state="done", step="완료", progress=100, finishedAt=_now(),
                       result={k: meta.get(k) for k in ("asOf", "totalCount", "lawEvents", "admrulEvents", "baseLaws", "admrulLaws")})


def export(name, families, profile=None, do_run=True, log=print, started=None):
    started = started or _now()
    ws, info = prepare(name, families, profile, log=log)
    _set_status(ws, company=name, slug=ws.name, url=f"/rr/{ws.name}/", state="running" if do_run else "ready", step="적용법규 목록 작성",
                prepared=info, error=None, startedAt=started, progress=0, result=None, finishedAt=None)
    return run(ws, log=log) if do_run else status(ws.name)


def start(name, families, profile=None):
    """서버용: 백그라운드로 내보내기 + 수집. 같은 회사가 이미 돌고 있으면 그 상태를 돌려준다."""
    s = slug(name)
    with _LOCK:
        if s in _RUNNING:
            return status(s)
        _RUNNING.add(s)
    ws = workspace(name)
    ws.mkdir(parents=True, exist_ok=True)
    started = _now()
    _set_status(ws, company=name, slug=s, url=f"/rr/{s}/", state="running", step="적용법규 목록 작성", error=None,
                startedAt=started, progress=0, result=None, finishedAt=None)

    def job():
        try:
            export(name, families, profile, log=lambda m: None, started=started)
        except Exception as e:  # noqa: BLE001
            _set_status(ws, state="error", error=str(e), finishedAt=_now())
        finally:
            with _LOCK:
                _RUNNING.discard(s)

    threading.Thread(target=job, daemon=True).start()
    return status(s)


def resolve_file(s, rel):
    """/rr/<회사>/<rel> → 회사 데이터 파일, 없으면 화면 사본 파일 (폴더 밖은 None)."""
    rel = rel or "index.html"
    if rel.endswith("/"):
        rel += "index.html"
    for base in (OUT / slug(s) / "docs", SITE / "docs"):
        p = (base / rel).resolve()
        if base.resolve() in p.parents and p.is_file():
            return p
    return None


def main(argv):
    if argv[:1] == ["--site"]:
        build_site(force=True)
        return 0
    args = [a for a in argv if not a.startswith("--")]
    if not args:
        print(__doc__)
        return 2
    from engine import companydb
    from engine.suggest import load_catalog, plain_categories, suggest
    hits = companydb.search(args[0])
    if not hits:
        print(f"{args[0]}: 회사를 찾지 못했습니다")
        return 1
    c = companydb.get(hits[0]["key"])
    draft = companydb.draft(c, load_catalog())
    print(f"회사: {hits[0]['name']} — 판정 중…", flush=True)
    res = plain_categories(suggest(draft["profile"]))
    fams = applied(res)
    st = export(hits[0]["name"], fams, draft["profile"], do_run="--no-run" not in argv, log=lambda m: print(m, flush=True))
    print(json.dumps(st, ensure_ascii=False, indent=1))
    print(f"화면: python3 server.py → http://127.0.0.1:8787/rr/{slug(hits[0]['name'])}/")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
