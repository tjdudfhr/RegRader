#!/bin/bash
# RegRader 자동 갱신: law.go.kr 에서 최신 데이터를 받아 GitHub 에 올린다.
# law.go.kr 는 해외 IP(GitHub Actions)를 막기 때문에 국내 IP 컴퓨터에서 실행해야 한다.
# 설치: scripts/install_auto_update.sh  /  로그: ~/Library/Logs/RegRader-update.log
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
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

git add docs/index.json docs/previous_index.json docs/meta.json docs/changelog.json docs/m?.json
# 시각(generatedAt)만 바뀐 경우에도 올려서 "최종 업데이트" 가 매일 갱신되게 한다.
if git diff --cached --quiet; then
  echo "변경 없음"
else
  COUNT=$(/usr/bin/python3 -c "import json;print(json.load(open('docs/meta.json'))['totalCount'])")
  git commit --quiet -m "data: 법령 데이터 자동 갱신 $(date +%Y-%m-%d) (${COUNT}건)"
  git push --quiet origin main
  echo "업로드 완료 (${COUNT}건)"
fi
