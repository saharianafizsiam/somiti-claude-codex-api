# Canva browser host

The owner-login browser runs separately from the existing API and bots. It is not
yet an invitation/removal adapter. Keep public redemption disabled until both
operations are verified on the correct Education team with the Student role.

## Install on Ubuntu

Install `xvfb openbox x11vnc novnc websockify xauth x11-utils libnss3
libatk-bridge2.0-0 libgbm1 libasound2t64 libgtk-3-0 fonts-liberation` using
`apt-get install --no-upgrade --no-install-recommends` with
`DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l`. Do not upgrade/restart existing
services as part of this setup. Copy this directory to `/opt/somiti-canva`, owned
by root, then run `sudo bash /opt/somiti-canva/install-browser.sh`.

The service uses a dedicated `somiti-canva` account, a private persistent profile,
Chromium's namespace sandbox, 50% of one CPU, 650 MiB memory high watermark,
800 MiB maximum and 128 MiB maximum swap. Only this service is restarted on failure.
The AppArmor exception for user namespaces is scoped to the installed root-owned
Chromium binary. No global AppArmor setting is disabled.

## Owner login

Forward localhost port 6082 to the server's localhost port 6082 through SSH.
Open `http://127.0.0.1:6082/vnc.html?autoconnect=1&resize=scale` locally.
The generated VNC password is in `/var/lib/somiti-canva/login-password.txt`
(root-readable). Transfer it privately; never commit or paste it in chat.
Enter the Canva email and verification code directly in the browser, then select
the Education team. Do not export session cookies.

VNC and its web viewer bind only to 127.0.0.1. Never open AWS inbound ports 5902
or 6082. No nginx changes are required. Close the SSH tunnel to close remote access.
To release resources, `sudo systemctl stop somiti-canva-browser` preserves login.
Use `sudo systemctl start somiti-canva-browser` when needed again.

## Release

The root production build applies only migrations 0005 and 0006 after validating
the existing baseline migration timestamp. It holds the migration-table lock,
uses bounded timeouts and records migrations transactionally. Failure stops the
new Vercel build, leaving the previous deployment active. Local and preview builds
do not change the database. `CANVA_INVITES_ENABLED` defaults to off. The worker
secret and a tested delivery/removal adapter still need to be configured before
customer redemption can be enabled.
