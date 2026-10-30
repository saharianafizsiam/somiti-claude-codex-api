#!/bin/bash
set -euo pipefail
umask 077
export DISPLAY=:92
export XAUTHORITY=/var/lib/somiti-canva/Xauthority
CHROME_BIN=/usr/bin/brave-browser
CHROME_PROFILE=/var/lib/somiti-canva/browser-profile
touch "$XAUTHORITY"
xauth -f "$XAUTHORITY" add "$DISPLAY" . "$(mcookie)"
Xvfb "$DISPLAY" -screen 0 1280x800x24 -nolisten tcp -auth "$XAUTHORITY" &
xpid=$!
trap 'kill $(jobs -pr) 2>/dev/null || true; wait || true' EXIT
for attempt in $(seq 1 50); do
  if xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then break; fi
  sleep 0.2
done
xdpyinfo -display "$DISPLAY" >/dev/null
openbox --sm-disable &
opid=$!
x11vnc -display "$DISPLAY" -auth "$XAUTHORITY" -rfbauth /var/lib/somiti-canva/vnc.pass -no6 -listen 127.0.0.1 -rfbport 5902 -forever -shared -quiet &
vpid=$!
websockify 127.0.0.1:6083 127.0.0.1:5902 &
wpid=$!
node /opt/somiti-canva/viewer.mjs &
hpid=$!
node /opt/somiti-canva/proxy-rotator.mjs &
rpid=$!
# Launch Chromium with local rotating proxy forwarder.
mkdir -p "$CHROME_PROFILE"
"$CHROME_BIN" \
  --user-data-dir="$CHROME_PROFILE" \
  --no-first-run \
  --no-default-browser-check \
  --no-sandbox \
  --disable-features=BraveNews,BraveRewards,BraveWallet \
  --password-store=basic \
  --proxy-server="http://127.0.0.1:8888" \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  --window-size=1280,800 \
  https://www.canva.com/login \
  >/var/lib/somiti-canva/chromium.log 2>&1 &
bpid=$!
wait -n "$xpid" "$opid" "$vpid" "$wpid" "$hpid" "$rpid" "$bpid"
exit 1
