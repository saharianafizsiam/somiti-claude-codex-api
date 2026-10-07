# Somiti API

A Next.js App Router API reseller console with PostgreSQL accounting, owner authentication, encrypted customer credentials, private read-only dashboards, and a configurable upstream gateway. Designed for one Vercel project serving `somiti.page` and `api.somiti.page`.

## Admin login

Open `/login` to enter your **username (or email), password, and six-digit authenticator code**. OWNER and ADMIN accounts require enrolled TOTP; there is no password-only administrator fallback. Before using a newly created owner, run `npm run owner:totp` and confirm enrollment as described below. Existing owners can continue using their email as the login identifier after migration and TOTP enrollment.

Set `OWNER_USERNAME` to 3–32 letters, digits, underscores or hyphens when provisioning an owner. It is stored lowercase and must be unique. Run `npm run db:migrate` to add the username column before deploying this login change.

## Quick start

Requires Node.js 22+ and PostgreSQL (Neon recommended).

```sh
npm ci
cp .env.example .env.local
# Fill the environment values described below.
npm run db:migrate
npm run owner:create
npm run owner:totp
npm run dev
```

Open `http://localhost:3000`. On PowerShell, use `Copy-Item .env.example .env.local`. Do not use development credentials or seeded models in production.

Generate **different** secrets with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Run it independently for each secret. The owner command requires `OWNER_USERNAME`, `OWNER_EMAIL` and an `OWNER_PASSWORD` of 8–72 characters, hashes the password with bcrypt, and creates a zero-balance wallet. It does not overwrite an existing user. Remove `OWNER_PASSWORD` afterward. There is no public registration or default password.

## Environment

| Variable                                             | Purpose                                                                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                       | PostgreSQL connection string; Neon pooled URL with `sslmode=require` for Vercel                                 |
| `AUTH_SECRET`                                        | At least 32 random characters; HMAC key for credentials, shares, redeem codes, sessions                         |
| `API_KEY_ENCRYPTION_SECRET`                          | Exactly 64 hex characters (32 random bytes), for AES-256-GCM                                                    |
| `APP_URL`                                            | Exact browser origin; local `http://localhost:3000`, production `https://somiti.page`; used for CSRF protection |
| `API_URL`                                            | Public API origin, e.g. `https://api.somiti.page` (without `/v1`)                                               |
| `UPSTREAM_PROVIDER`                                  | `mwapi`; models choose their adapter explicitly                                                                 |
| `MWAPI_BASE_URL`                                     | Verified upstream HTTPS origin                                                                                  |
| `MWAPI_API_KEY`                                      | Server-only upstream credential                                                                                 |
| `MWAPI_CHAT_PATH`                                    | **Verified** OpenAI-compatible chat endpoint path; no default                                                   |
| `MWAPI_MESSAGES_PATH`                                | **Verified** Anthropic-compatible messages endpoint path; no default                                            |
| `MWAPI_AUTH_HEADER`                                  | Provider credential header, default `Authorization`                                                             |
| `MWAPI_AUTH_PREFIX`                                  | Default `Bearer`; set empty for an unprefixed `x-api-key` header                                                |
| `CRON_SECRET`                                        | Random secret authenticating reservation recovery                                                               |
| `OWNER_USERNAME`, `OWNER_EMAIL`, `OWNER_PASSWORD`                      | Initial owner provisioning only                                                                                 |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Reserved for an optional future Redis implementation; current limiter uses PostgreSQL                           |

Next.js sets `NODE_ENV`; do not force development mode on Vercel. Environment secrets must never use a `NEXT_PUBLIC_` prefix. Changing `AUTH_SECRET` invalidates every credential hash; changing the encryption key makes stored encrypted credentials unreadable. Back these secrets up securely.

## Architecture and folders

```text
src/app/                    App Router pages and HTTP handlers
  dashboard/                Authenticated owner routes and private [shareToken] page
  api/admin/                Same-origin, session-authenticated mutations
  api/auth/                 Login/logout
  api/cron/recover/          Interrupted-reservation recovery
  v1/                       Customer API endpoints
src/components/             Responsive console, forms, tables and charts
  ui/                       shadcn-style Radix button/dialog primitives
src/lib/
  auth/                     Opaque database sessions and role checks
  api-keys/                 API authentication and separate dashboard authorization
  billing/                  Decimal arithmetic, row locking, ledger and settlement
  db/                       Drizzle schema and PostgreSQL connection
  models/                   Dynamic family/custom access rules
  providers/                Isolated provider mappings, usage normalization and SSE
  rate-limit/               Atomic PostgreSQL minute buckets
  security/                 HMAC, encryption and trusted request IP handling
src/server/                 Validated admin services, gateway, reporting queries
drizzle/                    Versioned SQL migrations
scripts/                    Migration, owner, TOTP, seed and PostgreSQL verification
tests/                      Unit, embedded database and gateway integration tests
```

## Database

The schema contains `users`, `sessions`, `wallets`, `api_keys`, `api_key_models`, `dashboard_shares`, `models`, `model_aliases`, `api_requests`, `balance_transactions`, `redeem_codes`, `audit_logs`, `rate_buckets`, and `settings`.

Money is `NUMERIC(20,8)` and remains decimal strings across JSON boundaries. Foreign keys preserve accounting relationships; key constraints prohibit negative available credit. Unique credential hashes and aliases prevent duplicates. Request/key/date/model and transaction indexes support reporting. Request totals, daily series and model summaries use SQL aggregates; logs paginate at 25 records.

```sh
npm run db:generate  # after a schema change; review generated SQL
npm run db:migrate   # apply checked-in migrations using .env.local
```

Create a Neon project, choose a region near your Vercel functions, copy its pooled connection string, and set `DATABASE_URL`. Use a separate branch/database for development and previews. Run migrations from a trusted workstation or release job **before** deploying code that depends on them; builds do not migrate or seed production automatically. Use Neon backups/PITR appropriate to your plan.

## Owner workflow

1. Sign in at `/dashboard`.
2. Open **Models → Add model**. Add a verified public ID, upstream ID, family, capabilities, context/output bounds, prices, and endpoint support. Family does not imply endpoint support.
3. For Claude models select `CLAUDE`; for ChatGPT/OpenAI models select `OPENAI`. Models are loaded from the database, not a source-code list.
4. Choose upstream-plus-markup or manual selling prices. Cached input discounts affect estimated upstream cost; customers are charged the configured input selling price for all input tokens.
5. Add wallet balance on Overview. Manual adjustments are administrator bookkeeping, not payment collection. Alternatively generate and redeem a code. Only OWNER/ADMIN roles can mint credit or edit the global catalog/settings; RESELLER accounts can manage their own keys and redeem codes.
6. Create a key, choose family or custom access, allocate credit, and optionally create a customer link. Copy the key and link securely.
7. Key detail supports credit additions/returns, IPs, expiry, rate limits, secret regeneration, link expiration/regeneration/disable, and archive. Return remaining credit and wait for reservations before archiving.

`CLAUDE_ONLY`, `OPENAI_ONLY`, and `CLAUDE_AND_OPENAI` dynamically include enabled, visible, non-archived auto-family models. `CUSTOM` grants only the selected IDs. Aliases and public model IDs share one namespace, serialized during catalog edits. Model disablement blocks new requests without changing history. Duplicate a model from its detail page and supply a new public ID.

## Customer dashboard

`/dashboard/sk-myapi_<random>` is a read-only bearer link for exactly one key. The actual API credential is `sk-somiti_<random>`. Each uses 32 random bytes and a different prefix; neither authenticates at the other's entry point. Both are hashed for lookup and encrypted at rest for authorized reveal. Rotations immediately invalidate the old secret. Disabling API access still allows the dashboard to show its disabled status; disabling the share link removes dashboard access.

Customer views deliberately select only customer fields. They never render provider mappings, provider secrets, upstream cost, profit, owner wallet or other keys. The page refreshes every 30 seconds while visible. Dates and accounting charts use UTC. Never add analytics or third-party scripts to private dashboard routes. Configure your infrastructure/access-log retention or redaction to protect the bearer token in the URL; application code does not log these paths or credentials.

## API

Available routes:

- `GET /v1/models` — only models authorized for the key, OpenAI list shape.
- `GET /v1/balance` — allocated, used, reserved and remaining decimal strings.
- `GET /v1/usage?period=today|7d|30d|all` — key-scoped counts, tokens and spend.
- `POST /v1/chat/completions` — OpenAI-compatible requests and SSE.
- `POST /v1/messages` — Anthropic-compatible requests and SSE.

Send `Authorization: Bearer sk-somiti_...` or `x-api-key`. Examples with actual database model IDs are copyable from the customer page. Owner UI never relies on an API key for administrative authorization. All errors use `{error:{message,type,code}}`. Request logs store metadata only, not customer messages or generated content.

## Selecting an upstream provider

The **Models** page now has a provider selector. Its family tabs and pagination show only database models assigned to that provider, and **Add model** keeps that selection. Provider-specific setup instructions are shown both on the catalog and while editing a model. **Load upstream models** queries the selected provider using server-side credentials; select a Claude or ChatGPT account for claude-n-codex.com. Select **Add model** on a returned item to open a disabled draft, then verify the family, public ID, prices and capabilities before saving/enabling it. Discovery never changes the database automatically or copies upstream credentials to the browser.

For claude-n-codex.com use `CLAUDE_N_CODEX_CLAUDE_API_KEY` and `CLAUDE_N_CODEX_OPENAI_API_KEY` separately. Gateway credential selection follows the database model's family, not its endpoint. Missing family credentials fail closed; the gateway never borrows the other account or a legacy shared key. The supplied dashboards confirmed `https://claude-n-codex.com:8443`, `/v1/chat/completions` and `/v1/messages`. Read-only `/v1/models` checks succeeded for both accounts. Configure `CLAUDE_N_CODEX_MODELS_PATH=/v1/models` and `MWAPI_MODELS_PATH=/v1/models`. Both second-provider accounts were exhausted at inspection time; generation/streaming still require a funded compatibility test.

Customers use `https://api.somiti.page/v1` for MWAPI and `https://api.somiti.page/v2` for claude-n-codex.com, with the same Somiti key. These prefixes select the provider. Each models endpoint lists only authorized models for that provider; generation rejects a model assigned to the other provider before reserving credit. Both prefixes expose `/models`, `/chat/completions`, `/messages`, `/balance` and `/usage`. Balance and usage report the same shared key totals across providers. Existing claude-n-codex integrations must switch to `/v2`. Upstream paths remain unchanged. In **Models → Add/Edit model → Upstream provider**, choose **MWAPI** or **claude-n-codex.com**. Each model routes only to that provider; there is no automatic fallback or credential sharing. To expose the same model through both providers, create two catalog entries with different public IDs, select each provider, and assign those IDs to custom customer keys as needed. Changing an existing entry's provider preserves its public model ID.

Configure the API origin, endpoint paths, auth header/prefix, and separate family credentials shown above. Settings reports configuration readiness for each account; readiness does not certify generation compatibility.

Provider-neutral JSON/SSE usage parsing lives in `src/lib/providers/usage.ts`; shared compatible HTTP transport lives in `compatible.ts`. Provider-specific changes belong in the corresponding adapter. The database already stores provider per model, so this change needs no schema migration.

## MWAPI information still required

This project does **not** assume undocumented MWAPI routes exist. Before live traffic, obtain and verify:

1. Exact base origin, chat path, messages path, authorization header/prefix, and API credential.
2. Supported upstream model IDs and endpoint availability for each model.
3. Confirmation that these endpoints accept OpenAI/Anthropic-compatible JSON and SSE, including `stream_options.include_usage` for OpenAI streams and the Anthropic version header.
4. Final usage fields, cache accounting, reasoning-token accounting, streaming terminal events, and error semantics.
5. True context/output limits and upstream prices.

Set only verified paths. Unconfigured endpoints fail closed with no charge. If MWAPI uses another wire format, implement that mapping **only** in `src/lib/providers/mwapi.ts` and add adapter tests. The current adapter passes through the selected compatible protocol; it does not claim to convert Anthropic to OpenAI or vice versa. Every capability toggle must reflect verified provider support. `POST /v1/responses` and providers other than MWAPI and claude-n-codex.com are not included.

## Reservation and settlement policy

Before forwarding, the service locks the key row, rechecks credential state and model permissions, and reserves the configured full context-input cost plus requested maximum output cost. This is deliberately conservative; it is a **reservation bound**, not an invented input token estimate. Requests always get an output limit. Only one completion is supported per request. Maximum accepted JSON body size is 2 MB.

Confirmed provider usage settles against the request's immutable customer/upstream price snapshot. Settlement locks the wallet/request/key in a consistent order, marks the request settled, releases its reservation and writes ledger entries in one transaction. Repeating settlement is safe. Credit already spent/reserved cannot be returned. Provider usage above the reservation is capped at the reservation for customer billing and flagged `provider_exceeded_reservation`; the reseller absorbs the excess upstream cost. Monitor this anomaly and correct model bounds.

Missing usage produces `UNAVAILABLE`, null token fields, and **zero customer charge**. The reseller bears unknown upstream cost. No tokenizer approximation is implemented. An interrupted stream may have partial confirmed usage; that usage is retained and the request marked failed. Browser disconnects do not stop final upstream usage collection. SSE buffering is limited to individual frames, public model IDs replace upstream IDs, and provider error payloads are sanitized.

The upstream timeout is 240 seconds and function maximum 300 seconds. The authenticated cron endpoint releases unsettled requests older than 15 minutes with unavailable usage/no charge, and cleans expired sessions/rate buckets. `vercel.json` schedules it once daily (`0 0 * * *`, UTC), compatible with Vercel Hobby cron frequency limits. Configure `CRON_SECRET` in Vercel so its requests authenticate. Interrupted requests can leave credit reserved until the next daily recovery; normal completed requests still settle immediately. For faster recovery, use a Vercel plan supporting a ten-minute schedule (`*/10 * * * *`) or an external scheduler calling `GET /api/cron/recover` with `Authorization: Bearer <CRON_SECRET>`. Without an authenticated scheduler, hard-killed functions can leave funds reserved until recovery is called.

## Security

Sessions are random database tokens with HMAC hashes, 12-hour expiry, HttpOnly/SameSite cookies and Secure `__Host-` cookies in production. Every admin mutation verifies the exact browser Origin and session. Login throttles both email and IP. Model/catalog/credit-minting permissions are checked server-side. IP restrictions trust Vercel's overwritten forwarding header only when running on Vercel; local development uses loopback, other production hosts fail closed for IP-restricted keys until a trusted proxy adapter is implemented.

Dashboard responses use no-store caching, no-referrer, a nonce-based script CSP, frame-ancestor denial, nosniff and production HSTS. AES-GCM uses a new IV per encrypted value. Audit records exclude raw credentials. Do not put deployment secrets in logs, Git, public variables, or client storage.

Required administrator TOTP setup:

```sh
npm run owner:totp
# Add the printed otpauth URI to an authenticator.
# Set TOTP_SETUP_SECRET and TOTP_CODE temporarily, then rerun:
npm run owner:totp
```

The second run verifies possession, encrypts the TOTP secret and revokes sessions. Remove setup variables afterward. Administrative account recovery, password reset email, additional-user provisioning UI and TOTP recovery codes are not included; manage recovery through a trusted database/operator procedure.

## Development seed

Set `ALLOW_DEV_SEED=true` only against a development database and run `npm run db:seed`. The seed does not run during migration/build. Example models are disabled and require verified upstream mappings before activation. Seed data is for exercising dashboards and must not be treated as provider availability or live traffic.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:postgres
```

The fast tests run real SQL using PGlite. `test:postgres` additionally starts an isolated PostgreSQL binary from the dev-only `embedded-postgres` package, applies migrations, tests 100 concurrent reservations using multiple connections, tests repeated settlement, and starts the production Next server to exercise login, owner pages and customer isolation. It uses localhost ports 15432/3100 and retains test clusters under ignored `.tmp/` for inspection. Run it after the production build. On root-only Linux containers, run the tests as a non-root user. No production database is touched.

Runtime dependency audit: `npm audit --omit=dev`. Some upstream development-tool dependencies currently have advisories (Drizzle's legacy esbuild loader and Next ESLint glob tooling); these are not shipped as runtime dependencies. Review upstream updates without blindly applying breaking `npm audit fix --force` downgrades.

For browser verification, install Chromium with `npx playwright install chromium`, then run `UI_TEST=1 npm run test:postgres` (PowerShell: `$env:UI_TEST='1'; npm run test:postgres`). This checks interactive login/key creation and desktop/mobile rendering, and saves screenshots under `.tmp/screenshots/`.

## Vercel deployment and domains

1. Push this project to your Git provider and import it into Vercel with the Next.js preset, Node 22+ and the repository root directory.
2. Set production environment variables using your production Neon database and new secrets. Set `APP_URL=https://somiti.page` and `API_URL=https://api.somiti.page`.
3. Apply migrations against production with a trusted release environment. Run the first-owner command there once. Do not enable development seeding.
4. Build/deploy. Add **both** `somiti.page` and `api.somiti.page` in Project → Settings → Domains. Copy Vercel's exact DNS records into your DNS provider and wait for certificate verification; don't assume fixed DNS target values.
5. Set the public API URL in dashboard Settings to `https://api.somiti.page`.
6. Verify HTTPS login on `somiti.page`, API auth on `api.somiti.page/v1/models`, provider responses/usage, and cron execution before issuing customer credit.

Both domains may target this project. `/v1/*` and `/v2/*` routes are API-only and do not conflict with `/dashboard/*`. The same API routes also work on the main domain; SDK examples prefer the API subdomain. Admin mutations accept only the configured `APP_URL` origin. Preview deployments need their own APP_URL and isolated database/secrets. Native browser SDK usage from third-party origins is intentionally not enabled; use a server-side integration to protect keys.

## Remaining operational boundaries

The application can build and run independently of MWAPI, but live-provider compatibility and production Vercel/Neon deployment cannot be verified without your credentials/configuration. No live provider requests or public deployment were performed. Model presets and payment gateways are optional extensions and are not implemented. This is a single-global-catalog, per-reseller-wallet system; it is not a marketplace with self-service reseller registration. Upstream cost/profit figures are estimates. Complete a staging test against your actual provider, monitor failures and reservation anomalies, configure backups/log redaction, and verify cron before serving paying customers.
## Dedicated upstream keys (current workflow)

Each customer Somiti key is bound to exactly one upstream credential and API route: API v1 or API v2. In API Keys → Create API key, choose the route and paste that customer's quota-limited upstream API key. Credentials are encrypted at rest and never returned to customer pages. Blank credentials on edit keep the existing credential; switching providers requires a replacement. Delete disables the Somiti credential and its share link and erases its stored upstream credential; it does not delete the key at the upstream service or cancel requests already in progress.

Quota is retrieved server-side from the assigned key's read-only quota endpoint. The UI returns only allocation, usage, remaining balance, and check time. Failures display Unavailable, never a fabricated zero or local estimate. Generation uses only the attached credential, without falling back to global credentials. The upstream provider enforces quota. No Somiti wallet funding, redemption, second reservation, or customer charge is applied to these requests. Local logs retain token counts and response status; monetary request costs are unavailable. Historical ledger rows are preserved.

**Upgrade existing deployments before deploying the new code:** run `sql/neon-upstream-key-upgrade.sql` once in Neon SQL Editor (or `npm run db:migrate`, not both). Existing keys need an upstream credential attached via Edit before generation works. For a new empty database only, use the updated `sql/neon-initial-setup.sql`. No production database migration or deployment is performed automatically.

Global upstream keys are used only for admin catalog discovery; they are not a substitute for per-customer credentials. API base origins and generation paths still require server configuration. MWAPI generation paths still require confirmation; read-only quota checks for both providers were verified, but paid generation has not been tested. Customer-visible public model IDs and display names are chosen by the administrator: do not put private provider names or credentials in them.

This section supersedes the earlier reseller wallet, shared-key, and redeem workflow descriptions.

### Customer console and catalog imports

The private customer dashboard uses Overview, Connect, Documentation, and History views without changing its URL. History is paginated through a share-token-protected endpoint. All client props and history responses use explicit public field lists. Unknown quota and costs are never displayed as invented balances or prices.

In admin Models, choose the provider and account, then **Import saved catalog (Oct 7)** to add the catalog fetched on 2026-10-07 (9 v1 Claude IDs, 23 v2 Claude IDs/aliases, 8 v2 OpenAI IDs). **Refresh & import from API** fetches the latest catalog using server environment credentials. Existing provider/model records and their edits are preserved. New records are disabled drafts: review endpoint support and limits in Edit model, then enable. Public IDs are prefixed with `v1/` or `v2/` to distinguish identical upstream IDs; customers use the exact public ID displayed in their dashboard. New manual models can still be created with Add model.

The saved catalog contains model IDs and names only, never credentials. Importing requires no new schema migration beyond the existing upstream-key migration. Catalog listing does not verify generation support or pricing. Deployment and production catalog imports must be performed against your production project; local UI tests use an isolated database.

Catalog activation fix: the import buttons now read **Import & enable saved models** and **Refresh & enable from API**. Imports enable new entries and restore untouched drafts made by the previous import flow. Claude entries use the messages endpoint; OpenAI entries use chat completions. Custom edits, deliberately disabled already-activated entries, and archived entries are preserved. For CUSTOM key access, explicitly assign the imported models in key settings. This supersedes the disabled-draft workflow above.

### v2 connection guides

The v2 Connect view now has the reference's 38 entries, grouped and searchable: Agents & IDEs, Chat applications, and Automation & SDK. Each entry has its own steps; configurable clients show the selected compatible model, Somiti URL, key placeholder, and configuration examples where applicable. The user can explicitly load their Somiti key into examples and hide it again; it is not stored in browser storage. macOS/Linux and PowerShell examples are supported.

Anthropic SDK-style clients may append `/v1/messages` to the `/v2` base URL, so `/v2/v1/messages` delegates to the existing authenticated v2 messages gateway. `/v2/v1/models` likewise delegates to v2 model discovery. These aliases preserve provider/key/model enforcement. Direct `/v2/messages` remains available.

Codex CLI is listed with an unsupported status because this gateway has no Responses API. Agents receive a warning when tool support is disabled for their model. Embeddings, count_tokens, advanced desktop gateway features, and browser CORS are not implied by the guide. The list is not a claim that all 38 clients have been end-to-end generation-tested.

Reference checked 2026-10-07: supplied dashboard client list (no credential stored in this documentation). Configuration cross-checks: [Claude Code gateway documentation](https://code.claude.com/docs/en/llm-gateway), [Continue configuration reference](https://docs.continue.dev/reference), [OpenCode providers](https://docs.opencode.ai/docs/providers/), [OpenClaw custom providers](https://docs.openclaw.ai/gateway/config-tools/custom-providers). OpenCode example targets its v1 configuration schema.

### v2 account history and statistics

Customer v2 dashboards now fetch the assigned account's read-only requests, 30-day statistics (UTC), and model prices on the server. This includes activity before the key was added to Somiti. Account requests are displayed separately from the local gateway logs; records are never added together or imported into billing tables. The share-protected history endpoint pages 25 account requests at a time, with model filtering applied to the displayed page.

The customer view includes account success rate, median/p95 latency, cache hit rate, today's spending, a 14-day spending chart, request charges/cache tokens/TTFT, and API-returned model prices. Repeated display names are grouped with alternate IDs available to copy. If an account endpoint fails, the UI reports unavailable rather than inventing zero activity. Only validated public fields leave the server; raw errors, account keys, and provider metadata are discarded. No new environment variable or database migration is required.

The v2 cost panel now uses compact two-column model rows with live input-price badges ($/M), expandable output/cache rates, and alternate model IDs. The Token types tab shows input, output, cache-read, and cache-write totals summed from the same full 30-day account statistics (UTC), plus the reported cache-hit rate. Missing categories remain unavailable. No price or token count is taken from a screenshot or hardcoded example.
