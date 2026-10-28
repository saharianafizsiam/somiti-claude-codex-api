#!/bin/bash
set -euo pipefail
umask 022
if [ "$(id -u)" != 0 ]; then echo 'Run with sudo.'; exit 1; fi
getent passwd somiti-canva >/dev/null || useradd --system --home-dir /var/lib/somiti-canva --shell /usr/sbin/nologin somiti-canva
install -d -m 755 /opt/somiti-canva
install -d -m 700 -o somiti-canva -g somiti-canva /var/lib/somiti-canva
cd /opt/somiti-canva
npm ci --ignore-scripts --omit=dev
PLAYWRIGHT_BROWSERS_PATH=/opt/somiti-canva/browsers node node_modules/playwright/cli.js install chromium
chmod -R go+rX /opt/somiti-canva
umask 077
browser_path=$(PLAYWRIGHT_BROWSERS_PATH=/opt/somiti-canva/browsers node --input-type=module -e 'import { chromium } from "playwright"; console.log(chromium.executablePath())')
if command -v apparmor_parser >/dev/null; then
  # Permit Chromium's own namespace sandbox only for this root-owned binary.
  printf 'abi <abi/4.0>,\ninclude <tunables/global>\nprofile somiti-canva-chromium %s flags=(unconfined) {\n  userns,\n}\n' "$browser_path" > /etc/apparmor.d/somiti-canva-chromium
  apparmor_parser -r /etc/apparmor.d/somiti-canva-chromium
fi
if [ ! -f /var/lib/somiti-canva/vnc.pass ]; then
  python3 - <<'PY'
import secrets, pathlib, subprocess, os
password = secrets.token_hex(4)
p = pathlib.Path('/var/lib/somiti-canva/login-password.txt')
p.write_text(password + '\n')
p.chmod(0o600)
subprocess.run(['x11vnc', '-storepasswd', password, '/var/lib/somiti-canva/vnc.pass'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
PY
  chown somiti-canva:somiti-canva /var/lib/somiti-canva/vnc.pass
  chmod 600 /var/lib/somiti-canva/vnc.pass
fi
install -m 644 /opt/somiti-canva/somiti-canva-browser.service /etc/systemd/system/somiti-canva-browser.service
install -m 644 /opt/somiti-canva/somiti-canva-worker.service /etc/systemd/system/somiti-canva-worker.service
systemctl daemon-reload
systemctl enable --now somiti-canva-browser.service
systemctl is-active somiti-canva-browser.service
