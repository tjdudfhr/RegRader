"""회사 찾기 검증: 정답이 분명한 대량 질의로 순위가 맞는지 잰다.

    python3 -m engine.searchcheck              # 전부 (상장사 전수 — 몇 분 걸림)
    python3 -m engine.searchcheck --sample 300 # 상장사는 무작위 300곳만

1. 상장사: 거래소 회사명으로 찾으면 그 회사(상장 연결된 법인)가 1위 / 3위 안에 나오는지 (스팩 제외)
2. 대형 회사: 국민연금 가입자가 가장 많은 회사 500곳을 사업장명으로 찾으면 1위로 나오는지
3. 짧은 검색어: '신한'·'삼성'·'LG' 같은 앞부분만 넣어도 그 이름으로 시작하는 가장 큰 회사 3곳이 6위 안에 나오는지
"""
import random
import sys
from contextlib import closing

from engine import companydb as cdb

PREFIXES = ["신한", "삼성", "현대", "LG", "SK", "롯데", "한화", "포스코", "하나", "우리", "국민", "카카오", "네이버", "쿠팡",
            "두산", "효성", "기아", "셀트리온", "에코프로", "고려", "대우", "CJ", "GS", "KT", "농협", "한국전력", "대한항공",
            "아모레", "이마트", "코웨이"]


def _db():
    import sqlite3
    con = sqlite3.connect(f"file:{cdb.DB}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    return closing(con)


def listed_cases(sample=None):
    with _db() as con:
        rows = [dict(r) for r in con.execute("SELECT name, code, nps_stem FROM listed WHERE nps_stem != '' AND name NOT LIKE '%스팩%'")]
    if sample:
        random.Random(7).shuffle(rows)
        rows = rows[:sample]
    return rows


def big_cases(n=500):
    with _db() as con:
        rows = con.execute("SELECT stem, SUM(members) AS m FROM nps GROUP BY stem ORDER BY m DESC LIMIT ?", (n * 2,)).fetchall()
        out = []
        for r in rows:
            if cdb.NON_COMPANY.search(r["stem"]) or len(r["stem"]) < 2:
                continue
            name = con.execute("SELECT name FROM nps WHERE stem = ? ORDER BY members DESC LIMIT 1", (r["stem"],)).fetchone()["name"]
            out.append({"stem": r["stem"], "name": name, "members": r["m"]})
            if len(out) >= n:
                break
    return out


def prefix_cases():
    out = []
    with _db() as con:
        for p in PREFIXES:
            keys = list(dict.fromkeys([cdb.norm(p), cdb.hangul(cdb.norm(p))]))
            best = {}
            for k in keys:
                for r in con.execute("SELECT stem, SUM(members) AS m FROM nps WHERE stem LIKE ? GROUP BY stem ORDER BY m DESC LIMIT 10",
                                     (k + "%",)):
                    if (not cdb.NON_COMPANY.search(r["stem"]) and not r["stem"].endswith(("점", "사업부", "센터"))
                            and (r["m"] or 0) >= 100):  # 가맹점·사업부 이름, 100명 미만은 정답에서 뺀다
                        best[r["stem"]] = max(best.get(r["stem"], 0), r["m"])
            top = sorted(best, key=lambda s: -best[s])[:3]
            out.append({"q": p, "expect": top})
    return out


def run(sample=None, verbose=True):
    report = {}
    # 1. 상장사
    cases = listed_cases(sample)
    at1 = at3 = 0
    fails = []
    for c in cases:
        res = cdb.search(c["name"])
        stems = [r["stem"] for r in res]
        if stems[:1] == [c["nps_stem"]]:
            at1 += 1
        if c["nps_stem"] in stems[:3]:
            at3 += 1
        else:
            fails.append((c["name"], c["nps_stem"], [r["name"] for r in res[:3]]))
    report["listed"] = {"n": len(cases), "at1": at1, "at3": at3, "fails": fails}
    # 2. 대형 회사
    big = big_cases()
    ok, bfails = 0, []
    for c in big:
        res = cdb.search(c["name"])
        if res and res[0]["stem"] == c["stem"]:
            ok += 1
        else:
            bfails.append((c["name"], c["members"], [r["name"] for r in res[:3]]))
    report["big"] = {"n": len(big), "at1": ok, "fails": bfails}
    # 3. 짧은 검색어
    pres, pfails = prefix_cases(), []
    good = 0
    for c in pres:
        res = cdb.search(c["q"])
        stems = [r["stem"] for r in res[:6]]
        miss = [e for e in c["expect"] if e not in stems]
        if miss:
            pfails.append((c["q"], miss, [r["name"] for r in res[:6]]))
        else:
            good += 1
    report["prefix"] = {"n": len(pres), "ok": good, "fails": pfails}
    if verbose:
        L, B, P = report["listed"], report["big"], report["prefix"]
        print(f"1. 상장사 {L['n']}곳: 1위 {L['at1'] / max(L['n'], 1):.1%} · 3위 안 {L['at3'] / max(L['n'], 1):.1%}")
        for f in L["fails"][:15]:
            print(f"   놓침 {f[0]} (→ {f[1]}) 결과: {f[2]}")
        print(f"2. 대형 회사 {B['n']}곳: 1위 {B['at1'] / max(B['n'], 1):.1%}")
        for f in B["fails"][:15]:
            print(f"   놓침 {f[0]} ({f[1]:,}명) 결과: {f[2]}")
        print(f"3. 짧은 검색어 {P['n']}개: 큰 회사 3곳이 6위 안 {P['ok']}/{P['n']}")
        for f in P["fails"]:
            print(f"   '{f[0]}' 빠짐 {f[1]} 결과: {f[2]}")
    return report


def main(argv):
    sample = None
    if "--sample" in argv:
        sample = int(argv[argv.index("--sample") + 1])
    r = run(sample)
    ok = (r["listed"]["at3"] / max(r["listed"]["n"], 1) >= 0.97 and r["big"]["at1"] / max(r["big"]["n"], 1) >= 0.97
          and r["prefix"]["ok"] == r["prefix"]["n"])
    print("결과:", "통과" if ok else "기준 미달 (상장사 3위 안 97%, 대형 회사 1위 97%, 짧은 검색어 전부)")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
