# Production secret rotation

Rotate the three application secrets as one planned maintenance change. Do not
paste a secret into source control, a pull request, or a chat.

## What changes

| Secret | Effect |
| --- | --- |
| `AUTH_SECRET` | Changes the HMAC key used by sessions and customer credentials. The included temporary fallback keeps existing keys and codes working while they are reissued. |
| `API_KEY_ENCRYPTION_SECRET` | Protects encrypted database values. These must be re-encrypted before the old value is removed. |
| `CRON_SECRET` | Invalidates authenticated external cron calls until their caller receives the new value. |

## Required inputs

Keep these locally in a password manager, not in a committed `.env` file:

- current production `DATABASE_URL`
- current production `API_KEY_ENCRYPTION_SECRET`
- current production `AUTH_SECRET`
- a new 64-character hexadecimal encryption secret
- a new `AUTH_SECRET` of at least 32 random characters
- a new `CRON_SECRET` of at least 32 random characters

Generate the new values locally in PowerShell (this writes them to your private
Documents folder and never prints them):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/create-rotation-secrets.ps1
```

## Run order

1. In Vercel, set the new values from `new-rotation-secrets.env` as
   `AUTH_SECRET`, `API_KEY_ENCRYPTION_SECRET`, and `CRON_SECRET`. Add the old
   values as `AUTH_SECRET_PREVIOUS` and
   `API_KEY_ENCRYPTION_PREVIOUS_SECRET`, then deploy this version first. This
   keeps old keys, codes, sessions, and encrypted values usable during the
   transition.
2. Temporarily prevent admin/key-management writes and schedule a quiet minute.
3. Verify the old encryption secret can read every protected database value:

   ```powershell
   $env:DATABASE_URL = '<current production DATABASE_URL>'
   $env:OLD_API_KEY_ENCRYPTION_SECRET = '<current production encryption secret>'
   $env:NEW_API_KEY_ENCRYPTION_SECRET = '<new encryption secret from new-rotation-secrets.env>'
   npm run security:rotate-encryption -- --dry-run
   ```

4. If that reports only counts, run the exact same command without `--dry-run`.
   It uses one transaction and rolls back completely if any record cannot be
   decrypted. It never prints plaintext or secret values.

5. Reissue customer API keys, dashboard links, redeem codes, and Canva
   invitation codes during the fallback period. Update any external cron
   caller with the new `CRON_SECRET`.
6. After old sessions expire and all legacy keys/codes have been replaced or
   intentionally disabled, remove `AUTH_SECRET_PREVIOUS` and
   `API_KEY_ENCRYPTION_PREVIOUS_SECRET`, then redeploy.

## Verification

- Sign in and verify 2FA.
- Reveal one test API key and send a test request.
- Open one regenerated dashboard link.
- Redeem one freshly generated Canva code.
- Call the authenticated cron endpoint only from its intended scheduler.

If the dry run fails, do not change Vercel. Investigate while the old values are
still active.
