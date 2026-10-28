# Canva invitations — implementation status

The code-management foundation is implemented locally. Automatic invitations and
membership revocation are **not connected**. The public Get invite button is
disabled, so no code can be consumed or customer falsely told an invite was sent.

## Implemented

- `/canva/invite`: public Education invitation form.
- `/dashboard/canva`: authenticated admin overview, batches of 1–1,000 random
  16-digit codes, copy all with one code per line, paginated code/email listing,
  and deletion of unused codes (soft deletion).
- Codes are encrypted at rest and separately HMAC-hashed for eventual redemption.
- Admin records are scoped to their creator; mutations check session, role and origin.

## Required before enabling redemption

Confirm a supported Canva connection for the **Student** role. The account owner
reported People, Classes, Team profile, Billing, Permissions, Controls, Apps,
Private apps, LMS integrations and Web domains, but no Admin API/SCIM settings.

Canva's documented Admin API requires Enterprise, Districts or Campus. Its team
invitation endpoint lists admin/designer/member, not Student. Do not silently
substitute a member invitation for a student invitation.

The owner explicitly wants removing an email to revoke Canva team access too.
Only clear/reuse a code after confirmed membership removal and cancellation of
any pending invitation. A failed/ambiguous removal must preserve the assignment.

The owner selected an isolated browser on the existing AWS server. The login
browser is installed with CPU/memory limits, a dedicated user and a private SSH
tunnel. Owner login and a verified invitation/removal adapter remain required.
Never report delivery success before Canva confirms it.

## Serial queue implementation (local, not deployed)

Atomic redemption, email-bound retries, rate limits, durable invitation jobs,
signed status receipts and five-second polling are implemented. Positions include
the currently processing job. A database lock serializes claims across instances;
only one invitation may be PROCESSING. Tests cover duplicate redemption, invalid
receipts and claims, position advancement and uncertain delivery.

Keep `CANVA_INVITES_ENABLED` unset until the browser integration passes a real
invitation test. The worker endpoints `/api/canva/worker/claim` and `/finish` use
a separate bearer `CANVA_WORKER_SECRET` of at least 32 characters. Completion
requires the job ID, claim token and outcome SENT or REVIEW. Never report SENT
without confirming the invitation in Canva. Repeated acknowledgements are safe.

REVIEW blocks further claims. A lost processing job is never automatically
reassigned, because the invitation might already have been sent. After ten minutes
the UI shows a delivery delay. Operator reconciliation and removal jobs remain to
be implemented. Do not log codes, receipts or worker credentials.

Apply migration `0006_abnormal_the_captain.sql` after `0005_square_speedball.sql`.
The AWS login browser is installed; it does not yet claim jobs. Existing API and
bot services were not restarted. See `ops/canva/README.md` for service details.

Production Vercel builds apply these additive migrations transactionally after
checking the baseline history. Other build environments do not migrate databases.

References:
- https://www.canva.com/help/set-up-admin-api/
- https://www.canva.dev/docs/admin/api-reference/teams/create-team-invitation/
- https://www.canva.dev/docs/scim/
