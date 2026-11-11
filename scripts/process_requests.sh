#!/bin/bash
# 적용법규 추가 요청(GitHub Issue, 라벨 law-add)을 처리한다. launchd 가 10분마다 실행.
# 로그: ~/Library/Logs/RegRader-requests.log
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

# 이 작업이 마지막으로 돈 시각 (launchd 가 살아 있는지 확인용)
date '+%Y-%m-%d %H:%M:%S' > .git/regrader-requests-last-run 2>/dev/null || true

# 매일 갱신 추가 시도: launchd 07:00 외에 06 · 19 · 22시에도 한 번씩 부른다.
# 그 시각에 맥이 잠들어 있었으면 깨어난 뒤 첫 실행 때 부른다. auto_update.sh 는 오늘 이미 성공했으면 스스로 건너뛴다.
TODAY=$(date +%Y-%m-%d); HOUR=$((10#$(date +%H)))
find /tmp -maxdepth 1 -name 'regrader-tried-*' -mtime +2 -delete 2>/dev/null || true
# 다시 실행 요청: touch .git/regrader-rerun (auto_update.sh 가 파일을 지우고 성공한 날에도 한 번 더 돈다)
if [ -e .git/regrader-rerun ]; then
  scripts/auto_update.sh >> "$HOME/Library/Logs/RegRader-update.log" 2>&1 || true
fi
for S in 6 19 22; do
  MARK="/tmp/regrader-tried-$TODAY-$S"
  if [ "$HOUR" -ge "$S" ] && [ ! -e "$MARK" ]; then
    : > "$MARK"
    scripts/auto_update.sh >> "$HOME/Library/Logs/RegRader-update.log" 2>&1 || true
  fi
done

# 매일 갱신(auto_update.sh)과 동시에 돌지 않도록 같은 잠금을 쓴다
LOCK=/tmp/regrader.lock
find "$LOCK" -maxdepth 0 -mmin +60 -exec rmdir {} \; 2>/dev/null || true  # 비정상 종료로 남은 잠금 정리
if ! mkdir "$LOCK" 2>/dev/null; then
  exit 0
fi
trap 'rmdir "$LOCK"' EXIT

# 요청이 없으면 조용히 끝낸다 (GitHub 호출 1번)
N=$(gh issue list -R tjdudfhr/RegRader --label law-add --state open --json number --jq 'length' 2>/dev/null || echo 0)
[ "$N" = "0" ] && exit 0

echo "=== $(date '+%Y-%m-%d %H:%M:%S') 요청 ${N}건 처리 ==="
git pull --rebase --quiet origin main
if ! /usr/bin/python3 scripts/process_law_requests.py; then
  echo "처리 실패 — 커밋하지 않은 변경을 되돌리고 다음에 다시 시도합니다"
  git checkout -- docs/ 2>/dev/null || true
  git reset --hard --quiet origin/main
  exit 1
fi
