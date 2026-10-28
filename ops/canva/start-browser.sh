#!/bin/bash
set -euo pipefail
umask 077
export DISPLAY=:92
export XAUTHORITY=/var/lib/somiti-canva/Xauthority
CHROME_BIN=/opt/somiti-canva/browsers/chromium-1243/chrome-linux64/chrome
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
# Launch Chromium directly instead of through Playwright.  Google sign-in rejects
# browser sessions marked as automated; this remains an ordinary, user-operated
# profile exposed only through the private VNC tunnel.
mkdir -p "$CHROME_PROFILE"
"$CHROME_BIN" \
  --user-data-dir="$CHROME_PROFILE" \
  --no-first-run \
  --no-default-browser-check \
  --password-store=basic \
  --window-size=1280,800 \
  https://www.canva.com/login \
  >/var/lib/somiti-canva/chromium.log 2>&1 &
bpid=$!
wait -n "$xpid" "$opid" "$vpid" "$wpid" "$hpid" "$bpid"
exit 1
