#!/bin/bash
set -euo pipefail
umask 077
export DISPLAY=:92
export XAUTHORITY=/var/lib/somiti-canva/Xauthority
export PLAYWRIGHT_BROWSERS_PATH=/opt/somiti-canva/browsers
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
websockify --web=/usr/share/novnc 127.0.0.1:6082 127.0.0.1:5902 &
wpid=$!
node /opt/somiti-canva/browser.mjs &
bpid=$!
wait -n "$xpid" "$opid" "$vpid" "$wpid" "$bpid"
exit 1
