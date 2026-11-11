#!/bin/bash
# RegRader 자동 갱신: law.go.kr 에서 최신 데이터를 받아 GitHub 에 올린다.
# law.go.kr 는 해외 IP(GitHub Actions)를 막기 때문에 국내 IP 컴퓨터에서 실행해야 한다.
# 매일 06 · 07 · 19 · 22시에 실행 (오늘 이미 성공했으면 건너뜀)
#   07:00 = launchd(com.regrader.update) / 06 · 19 · 22시 = process_requests.sh (launchd com.regrader.requests, 10분마다)가 부른다
# 로그: ~/Library/Logs/RegRader-update.log
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

# 적용법규 추가 요청 처리(process_requests.sh)와 같은 잠금을 쓴다. 매일 갱신은 건너뛰지 않고 최대 10분 기다린다.
LOCK=/tmp/regrader.lock
find "$LOCK" -maxdepth 0 -mmin +60 -exec rmdir {} \; 2>/dev/null || true  # 비정상 종료로 남은 잠금 정리
for _ in $(seq 1 60); do mkdir "$LOCK" 2>/dev/null && break; sleep 10; done
[ -d "$LOCK" ] || { echo "잠금을 얻지 못함"; exit 1; }
# 60분 넘은 잠금은 '비정상 종료'로 보고 지우는데, Pro 자료 갱신은 2시간 넘게 걸리는 날이 있다 (2026-11-02: 9,311초).
# 돌고 있는 동안에는 2분마다 잠금 시각을 새로 찍어 다른 작업이 끼어들지 않게 한다. 이 스크립트가 죽으면 스스로 멈춘다.
( while kill -0 $$ 2>/dev/null; do touch "$LOCK" 2>/dev/null || exit 0; sleep 120; done ) &
BEAT=$!
trap 'kill "$BEAT" 2>/dev/null; rmdir "$LOCK" 2>/dev/null' EXIT

echo "=== $(date '+%Y-%m-%d %H:%M:%S') 갱신 시작 ==="

# 하루 여러 번 실행된다(맥이 꺼져 있거나 인터넷이 끊긴 시각을 대비). 오늘 이미 끝까지 성공했으면 건너뛴다.
# 실패한 날, Pro 자료만 실패한 날(pro=false), 인터넷이 없어 기록을 못 남긴 날은 다음 시각에 다시 한다.
# .git/regrader-rerun 파일이 있으면 성공한 날에도 한 번 더 돈다 (touch .git/regrader-rerun → 10분 안에 실행)
if [ -e .git/regrader-rerun ]; then
  rm -f .git/regrader-rerun
  echo "다시 실행 요청(.git/regrader-rerun)"
elif /usr/bin/python3 - <<'PY'
import json, sys, datetime
try:
    d = json.load(open('docs/health.json', encoding='utf-8'))
except Exception:
    sys.exit(1)
done = d.get('date') == datetime.date.today().isoformat() and d.get('ok') is True and d.get('pro') is not False
sys.exit(0 if done else 1)
PY
then
  echo "오늘 이미 갱신 완료 — 건너뜀"
  exit 0
fi

DATA=(docs/index.json docs/previous_index.json docs/meta.json docs/changelog.json docs/m?.json docs/upcoming_next.json docs/law_families.json docs/amend_flags.json docs/amend_details.json docs/amend_actions.json docs/oan docs/ordin_index.json docs/radar.json docs/admrul_candidates.json docs/admrul_events.json docs/admrul_index.json)
HEALTH=docs/health.json

# 오늘 갱신 결과를 docs/health.json 에 남긴다 → GitHub 의 매일 아침 점검(daily-check)이 읽어 문제가 있으면 알림 메일
#   health <true|false> <단계> <이유> [개정 건수]
health() {
  /usr/bin/python3 - "$@" <<'PY'
import json, sys, datetime
p = 'docs/health.json'
try:
    old = json.load(open(p, encoding='utf-8'))
except Exception:
    old = {}
now = datetime.datetime.now()
count = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] else old.get('count')
d = {'date': now.strftime('%Y-%m-%d'), 'time': now.strftime('%H:%M'), 'ok': sys.argv[1] == 'true', 'stage': sys.argv[2],
     'reason': sys.argv[3], 'count': int(count) if count else None, 'pro': None}
json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
PY
}
# 실패했을 때: 데이터는 어제 그대로 두고 상태만 올린다
push_health() {
  git add "$HEALTH"
  git commit --quiet -m "status: 자동 갱신 $1 $(date +%Y-%m-%d)" || true
  git push --quiet origin main || true
}

git pull --rebase --quiet origin main

# 네트워크가 잠깐 끊겨도 실패하지 않도록 최대 3번 시도
for i in 1 2 3; do
  if /usr/bin/python3 scripts/refresh_laws.py > /tmp/regrader_refresh.log 2>&1; then
    break
  fi
  echo "갱신 실패 ($i/3)"; tail -3 /tmp/regrader_refresh.log
  if [ "$i" = 3 ]; then
    git checkout -- "${DATA[@]}" 2>/dev/null || true   # 반쯤 받은 데이터는 버린다 (사이트는 어제 데이터 그대로)
    health false "법령 수집" "법령 수집이 3번 모두 실패했습니다 (법제처 무응답 또는 받은 자료 이상): $(tail -1 /tmp/regrader_refresh.log | cut -c1-160)"
    push_health 실패
    exit 1
  fi
  sleep 60
done

git add "${DATA[@]}"
if [ -d docs/archive ]; then git add docs/archive; fi  # 연도 전환 때 보관한 작년 데이터

# 올리기 전에 화면 점검: 이 데이터로 사이트가 멈추면 올리지 않는다 (2026-10-17: 데이터 한 건 때문에 화면이 멈춘 일)
set +e
/usr/bin/python3 scripts/site_check.py --dir docs > /tmp/regrader_check.log 2>&1
RC=$?
set -e
CHECK=$(tail -1 /tmp/regrader_check.log)
if [ "$RC" = 1 ]; then
  echo "화면 점검 실패: $CHECK"
  git reset -q -- "${DATA[@]}" 2>/dev/null || true
  git checkout -- "${DATA[@]}" 2>/dev/null || true
  health false "화면 점검" "오늘 데이터로 사이트 화면이 멈춰 올리지 않았습니다 — $CHECK"
  push_health 실패
  exit 1
fi
echo "화면 점검: $CHECK"
COUNT=$(/usr/bin/python3 -c "import json;print(json.load(open('docs/meta.json'))['totalCount'])")
health true "완료" "$([ "$RC" = 2 ] && echo "$CHECK")" "$COUNT"
git add "$HEALTH"
# 시각(generatedAt)만 바뀐 경우에도 올려서 "최종 업데이트" 가 매일 갱신되게 한다.
if git diff --cached --quiet; then
  echo "변경 없음"
else
  git commit --quiet -m "data: 법령 데이터 자동 갱신 $(date +%Y-%m-%d) (${COUNT}건)"
  git push --quiet origin main
  echo "업로드 완료 (${COUNT}건)"
fi

# RegRader Pro 브라우저판 자료 (docs/pro/ 가 읽는 pro-data 브랜치). 실패해도 위 갱신은 이미 끝났다.
if ! scripts/pro_publish.sh >> "$HOME/Library/Logs/RegRader-pro.log" 2>&1; then
  echo "Pro 자료 갱신 실패 (로그: ~/Library/Logs/RegRader-pro.log)"
  /usr/bin/python3 - <<'PY'
import json
p = 'docs/health.json'
d = json.load(open(p, encoding='utf-8'))
d.update(pro=False, proReason='회사별 화면 자료(pro-data) 갱신 실패 — 맥의 ~/Library/Logs/RegRader-pro.log 확인')
json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
PY
  push_health "Pro 실패"
fi
