#!/bin/bash
# RegRader 자동 갱신 실행 시각을 바꾼다 (맥 터미널에서 한 번 실행).  기본: 매일 06:00 · 07:00 · 19:00 · 22:00
#   사용: scripts/set_schedule.sh            또는   scripts/set_schedule.sh 6 12 18
# auto_update.sh 는 그날 이미 성공했으면 건너뛰므로, 시각을 늘려도 갱신은 하루 한 번만 된다.
set -euo pipefail
P="$HOME/Library/LaunchAgents/com.regrader.update.plist"
[ -f "$P" ] || { echo "없음: $P"; exit 1; }
HOURS=("$@"); [ ${#HOURS[@]} -gt 0 ] || HOURS=(6 7 19 22)
JSON=""
for h in "${HOURS[@]}"; do
  [[ "$h" =~ ^[0-9]+$ ]] && [ "$h" -le 23 ] || { echo "시각은 0~23 숫자: $h"; exit 1; }
  JSON="${JSON:+$JSON,}{\"Hour\":$((10#$h)),\"Minute\":0}"
done
cp "$P" "$P.bak"
/usr/bin/plutil -remove StartCalendarInterval "$P" 2>/dev/null || true
/usr/bin/plutil -insert StartCalendarInterval -json "[$JSON]" "$P"
/usr/bin/plutil -lint "$P"
launchctl bootout "gui/$(id -u)/com.regrader.update" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$P"
echo "실행 시각: ${HOURS[*]}시 (이전 설정은 $P.bak)"
