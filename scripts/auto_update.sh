#!/bin/bash
# RegRader 자동 갱신: law.go.kr 에서 최신 데이터를 받아 GitHub 에 올린다.
# law.go.kr 는 해외 IP(GitHub Actions)를 막기 때문에 국내 IP 컴퓨터에서 실행해야 한다.
# launchd(com.regrader.update)가 매일 07:00 실행  /  로그: ~/Library/Logs/RegRader-update.log
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

# 적용법규 추가 요청 처리(process_requests.sh)와 같은 잠금을 쓴다. 매일 갱신은 건너뛰지 않고 최대 10분 기다린다.
LOCK=/tmp/regrader.lock
find "$LOCK" -maxdepth 0 -mmin +60 -exec rmdir {} \; 2>/dev/null || true  # 비정상 종료로 남은 잠금 정리
for _ in $(seq 1 60); do mkdir "$LOCK" 2>/dev/null && break; sleep 10; done
[ -d "$LOCK" ] || { echo "잠금을 얻지 못함"; exit 1; }
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

echo "=== $(date '+%Y-%m-%d %H:%M:%S') 갱신 시작 ==="

git pull --rebase --quiet origin main

# 네트워크가 잠깐 끊겨도 실패하지 않도록 최대 3번 시도
for i in 1 2 3; do
  if /usr/bin/python3 scripts/refresh_laws.py > /tmp/regrader_refresh.log 2>&1; then
    break
  fi
  echo "갱신 실패 ($i/3)"; tail -3 /tmp/regrader_refresh.log
  [ "$i" = 3 ] && exit 1
  sleep 60
done

git add docs/index.json docs/previous_index.json docs/meta.json docs/changelog.json docs/m?.json docs/upcoming_next.json docs/law_families.json docs/amend_flags.json docs/amend_details.json docs/admrul_candidates.json docs/admrul_events.json docs/admrul_index.json
if [ -d docs/archive ]; then git add docs/archive; fi  # 연도 전환 때 보관한 작년 데이터
# 시각(generatedAt)만 바뀐 경우에도 올려서 "최종 업데이트" 가 매일 갱신되게 한다.
if git diff --cached --quiet; then
  echo "변경 없음"
else
  COUNT=$(/usr/bin/python3 -c "import json;print(json.load(open('docs/meta.json'))['totalCount'])")
  git commit --quiet -m "data: 법령 데이터 자동 갱신 $(date +%Y-%m-%d) (${COUNT}건)"
  git push --quiet origin main
  echo "업로드 완료 (${COUNT}건)"
fi
