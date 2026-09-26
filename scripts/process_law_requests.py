#!/usr/bin/env python3
"""적용법규 추가 요청 처리.

사이트의 [+ 법규 추가] 버튼은 GitHub Issue(라벨 law-add)를 만든다. 이 스크립트는
  1. 열린 요청을 읽고, 저장소 쓰기 권한이 있는 사람의 요청만 받는다.
  2. 법령정보센터에서 법령명을 검증해 정식 명칭·소관부처·종류를 가져온다 (약칭도 찾아 준다).
  3. docs/base_laws_207.json 에 추가한다 (원하면 시행령·시행규칙도 함께).
  4. refresh_laws.py 를 돌려 새 법규의 2026년 개정을 바로 수집하고, GitHub 에 올린다.
  5. 요청에 결과를 댓글로 남기고 닫는다.
law.go.kr 는 해외 IP 를 막으므로 국내 IP 컴퓨터에서 실행한다 (scripts/process_requests.sh).
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
BASE_PATH = DOCS / "base_laws_207.json"  # 파일명은 여러 화면이 참조하므로 그대로 둔다
REPO = os.environ.get("RR_REPO", "tjdudfhr/RegRader")
LABEL = "law-add"
OC = os.environ.get("LAW_OC") or "knowhow1"
CATS = ["인사노무", "공정거래", "정보보호", "지식재산권", "재무회계", "안전", "환경", "지배구조"]
WRITE_PERMS = {"admin", "maintain", "write"}
LAWTYPE = {"대통령령": "시행령", "총리령": "시행규칙", "부령": "시행규칙"}


def sh(*args, check=True, capture=True):
    r = subprocess.run(args, cwd=ROOT, text=True, capture_output=capture)
    if check and r.returncode != 0:
        raise RuntimeError(f"{' '.join(args[:3])} 실패: {r.stderr.strip()[:300]}")
    return r.stdout


def gh_json(*args):
    return json.loads(sh("gh", *args) or "null")


def compact(name: str) -> str:
    return re.sub(r"[\s·ㆍ・.]", "", (name or "").strip())


def search_laws(query: str):
    r = requests.get("https://www.law.go.kr/DRF/lawSearch.do", params={
        "OC": OC, "target": "law", "type": "JSON", "query": query, "display": "50",
    }, headers={"User-Agent": "RegRader-requests/1.0"}, timeout=25)
    r.raise_for_status()
    laws = (r.json().get("LawSearch") or {}).get("law") or []
    return [laws] if isinstance(laws, dict) else laws


def resolve(query: str):
    """법령명(약칭 포함) -> 법령정보센터 정식 법령 1건. 못 찾거나 애매하면 (None, 후보목록)."""
    hits = search_laws(query)
    exact = [h for h in hits if compact(h.get("법령명한글")) == compact(query)]
    if exact:
        return exact[0], []
    # 약칭(예: 중대재해처벌법)으로 검색하면 정식 명칭의 법률과 그 하위법령이 나온다 -> 법률이 하나면 그것
    acts = [h for h in hits if h.get("법령구분명") == "법률"]
    if len(acts) == 1:
        return acts[0], []
    return None, sorted({h.get("법령명한글") for h in hits if h.get("법령명한글")})[:8]


def subordinate(title: str):
    hits = search_laws(title)
    want = {compact(title + " 시행령"), compact(title + " 시행규칙")}
    return [h for h in hits if compact(h.get("법령명한글")) in want]


def parse_body(body: str):
    def field(name):
        m = re.search(rf"^[ \t]*{name}[ \t]*[:：][ \t]*(.*?)[ \t]*$", body or "", re.M)  # 한 줄 안에서만 읽는다
        return m.group(1).strip() if m else ""
    return {
        "name": field("법령명"),
        "category": field("직무"),
        "withSub": field("하위법령 함께 추가").startswith(("예", "Y", "y", "네")),
        "memo": field("메모"),
    }


def has_write(login: str) -> bool:
    try:
        p = gh_json("api", f"repos/{REPO}/collaborators/{login}/permission")
        return (p or {}).get("permission") in WRITE_PERMS
    except RuntimeError:
        return False


def comment_close(num: int, text: str, close=True):
    sh("gh", "issue", "comment", str(num), "-R", REPO, "--body", text)
    if close:
        sh("gh", "issue", "close", str(num), "-R", REPO)


def base_entry(hit, category, next_id, issue):
    kind = hit.get("법령구분명") or ""
    title = hit.get("법령명한글", "").strip()
    law_type = "시행령" if title.endswith("시행령") else "시행규칙" if title.endswith("시행규칙") else (kind if kind == "법률" else LAWTYPE.get(kind, kind or "법률"))
    return {
        "id": f"law_{next_id:03d}",
        "title": hit.get("법령명한글", "").strip(),
        "categories": [category],
        "lawType": law_type,
        "effectiveDate": re.sub(r"(\d{4})(\d{2})(\d{2})", r"\1-\2-\3", str(hit.get("시행일자") or "")),
        "status": "현행",
        "meta": {
            "ministry": (hit.get("소관부처명") or "").strip(),
            "lsId": str(hit.get("법령ID") or ""),
            "addedAt": datetime.now(timezone.utc).isoformat(),
            "addedBy": f"issue #{issue}",
        },
    }


def main():
    issues = gh_json("issue", "list", "-R", REPO, "--label", LABEL, "--state", "open",
                     "--json", "number,title,body,author", "--limit", "20") or []
    if not issues:
        print("요청 없음")
        return 0

    base = json.loads(BASE_PATH.read_text(encoding="utf-8"))
    items = base["items"]
    have = {compact(x["title"]) for x in items}
    next_id = max(int(re.sub(r"\D", "", x.get("id", "0")) or 0) for x in items) + 1
    added, replies = [], []  # replies: (issue, text) — 업로드가 끝난 뒤 남긴다

    for it in issues:
        num, login = it["number"], (it.get("author") or {}).get("login", "")
        req = parse_body(it.get("body") or "")
        print(f"#{num} {login}: {req}")
        if not has_write(login):
            comment_close(num, f"@{login} 님, 적용법규 추가는 저장소 관리자만 요청할 수 있어 처리하지 않았습니다.")
            continue
        if not req["name"]:
            comment_close(num, "요청 본문에서 `법령명:` 줄을 찾지 못했습니다. 사이트의 [+ 법규 추가] 버튼으로 다시 요청해 주세요.")
            continue
        if req["category"] not in CATS:
            comment_close(num, f"직무 `{req['category'] or '(비어 있음)'}` 를 알 수 없습니다. 다음 중 하나여야 합니다: {', '.join(CATS)}")
            continue
        hit, cands = resolve(req["name"])
        if not hit:
            msg = f"법령정보센터에서 `{req['name']}` 을(를) 정확히 찾지 못했습니다."
            if cands:
                msg += "\n\n혹시 아래 중 하나인가요? 정확한 이름으로 다시 요청해 주세요.\n" + "\n".join(f"- {c}" for c in cands)
            comment_close(num, msg)
            continue
        targets = [hit] + (subordinate(hit["법령명한글"]) if req["withSub"] else [])
        new, dup = [], []
        for h in targets:
            if compact(h.get("법령명한글")) in have:
                dup.append(h["법령명한글"])
                continue
            e = base_entry(h, req["category"], next_id, num)
            next_id += 1
            items.append(e)
            have.add(compact(e["title"]))
            new.append(e)
        added.extend(new)
        replies.append((num, new, dup, req))

    if not added:
        for num, new, dup, req in replies:
            comment_close(num, "이미 적용법규에 있어 추가할 것이 없습니다: " + ", ".join(f"「{d}」" for d in dup))
        return 0

    base["total_laws"] = len(items)
    base["description"] = f"당사 적용 법규 {len(items)}개 기본 목록"
    base["updatedAt"] = datetime.now(timezone.utc).isoformat()
    BASE_PATH.write_text(json.dumps(base, ensure_ascii=False, indent=2), encoding="utf-8")

    # 새 법규의 2026년 개정을 바로 수집한다. 업데이트 내역에는 '적용법규 추가'로 따로 기록된다.
    env = dict(os.environ, RR_BASE_ADDED=json.dumps(
        [{"title": e["title"], "category": e["categories"][0], "ministry": e["meta"]["ministry"], "lawType": e["lawType"]} for e in added],
        ensure_ascii=False))
    r = subprocess.run([sys.executable, "scripts/refresh_laws.py"], cwd=ROOT, env=env, text=True, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError("refresh_laws.py 실패: " + r.stderr.strip()[-500:])

    rows = []
    for i in range(8):
        rows += json.loads((DOCS / f"m{i}.json").read_text(encoding="utf-8"))
    per_law = {e["title"]: [x for x in rows if x.get("t") == e["title"]] for e in added}

    sh("git", "add", "docs/base_laws_207.json", "docs/index.json", "docs/previous_index.json",
       "docs/meta.json", "docs/changelog.json", "docs/upcoming_next.json", "docs/law_families.json",
       "docs/amend_flags.json", "docs/amend_details.json", "docs/admrul_candidates.json", "docs/admrul_events.json",
       *[f"docs/m{i}.json" for i in range(8)])
    sh("git", "commit", "-q", "-m", "data: 적용법규 추가 " + ", ".join(e["title"] for e in added))
    sh("git", "push", "-q", "origin", "main")

    for num, new, dup, req in replies:
        if not new:
            comment_close(num, "이미 적용법규에 있어 추가할 것이 없습니다: " + ", ".join(f"「{d}」" for d in dup))
            continue
        lines = []
        for e in new:
            ev = per_law.get(e["title"], [])
            evtxt = ", ".join(f"{x['d']} {'일부개정' if x['a'] == '일' else '타법개정' if x['a'] == '타' else x['a']}" for x in ev[:6])
            lines.append(f"- 「{e['title']}」 ({e['lawType']}, {e['meta']['ministry']}) → 2026년 개정 {len(ev)}건" + (f": {evtxt}" if ev else ""))
        if dup:
            lines.append("- 이미 등록되어 있어 건너뜀: " + ", ".join(f"「{d}」" for d in dup))
        comment_close(num, f"✅ 적용법규에 추가했습니다 (직무: {req['category']}). 몇 분 뒤 사이트에 반영됩니다.\n\n" + "\n".join(lines) +
                      f"\n\n현재 적용법규 {len(items)}개")
    print(f"추가 {len(added)}건, 적용법규 {len(items)}개")
    return 0


if __name__ == "__main__":
    sys.exit(main())
