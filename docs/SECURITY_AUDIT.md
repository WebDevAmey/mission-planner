# Flight Deck security audit

Date: 2026-10-16. Scope: the whole server side (Next.js 16 route handlers under `src/app/api`, `src/proxy.ts`, home-grown auth in `src/lib/auth`, HTTP helpers in `src/lib/http`, email, validation, the LangGraph assistant in `src/lib/agents`, `next.config.ts`, dependencies and git history). Method: OWASP Top 10 (2021) with OWASP ASVS 4.0 Level 2 as the checklist, a code review of every route, integration tests against a scratch Postgres, and checks against `next start` with curl and a headless browser.

## Summary

- 26 findings. 21 are fixed, each with a regression test. 5 are accepted and the reason is given below. 3 are follow-ups owned by other areas.
- `pnpm audit --prod` went from 120 advisories (5 critical, 46 high) to **0**. The full audit, including dev tools, went from 68 (after the prod fixes) to 7. All 7 are in dev-only tooling (see F26).
- Integration tests went from 35 to 87, in 13 files. One of them is an access-control sweep that imports every API handler and checks auth, CSRF and IDOR, so a new route is covered automatically.

## Findings

Severity is the impact on this app as deployed (Vercel, Postgres): Critical, High, Medium, Low or Info.

| ID | OWASP | Sev | Location | Finding | Status | Test |
|---|---|---|---|---|---|---|
| F01 | A06 | Critical | package.json | next 16.2.2 had RCE (image optimizer, `next/og`), proxy-bypass, SSRF and DoS advisories. maplibre-gl 5.21 had an attribution XSS. shadcn (a CLI) was a runtime dependency that pulled in hono, proxy-addr and the MCP SDK. | Fixed: next 16.3.8, maplibre-gl 6.11.2 (worker served from `public/maplibre`), shadcn, tw-animate-css and framer-motion removed, overrides for transitive packages. | `pnpm audit --prod` = 0; build plus editor map smoke test |
| F02 | A04 | Medium | src/lib/http/api.ts `readJsonBody`; import route | The size cap was checked against Content-Length, and then the whole body was buffered. A chunked upload (no Content-Length), or multipart `formData()`, was read fully into memory. | Fixed: `readBodyBytes` stops the stream once it passes the cap. | limits.itest.ts |
| F03 | A04 | Medium | src/app/api/auth/*/route.ts | Auth routes used `request.json()` with no size cap. A login password could be any length. | Fixed: 8 KB cap through `readJsonBody`. Passwords limited to 200 characters, tokens to 256. | limits.itest.ts |
| F04 | A04/A05 | Medium | src/lib/validation/mission.ts | Waypoint `command` and `frame` had no bounds, so a value of 1e12 overflowed the int4 column and returned a 500. | Fixed: uint16 and uint8 ranges; sequence capped at 100000. | limits.itest.ts |
| F05 | A03/A08 | Medium | src/app/api/missions/import/route.ts | The home position and settings from an imported file were stored without validation, so strings and negative numbers reached the DB. | Fixed: `homeSchema` and `missionSettingsInputSchema` per field, falling back to defaults with a warning. | limits.itest.ts |
| F06 | A04/A07 | Medium | src/lib/auth/rate-limit.ts | The forgot-password limit counted only failures, but every request is recorded as a success. The limit never triggered, so the route could be used to flood any mailbox. | Fixed: the limit now counts every request (5 per hour per email). | auth-flows.itest.ts |
| F07 | A07 | Medium | signup, forgot-password and resend-verification routes | Verification and reset links were built from the request `Origin`/`Host`. Both are attacker-controlled when self-hosted, which allows password-reset poisoning. | Fixed: `appOrigin()` uses `APP_URL`, then the Vercel URL, and falls back to the request URL only in local dev. | auth-flows.itest.ts |
| F08 | A07 | Medium | src/app/api/auth/reset-password/route.ts | A reset token was checked outside the transaction, so two concurrent requests could both use it. | Fixed: the row is locked `FOR NO KEY UPDATE` and re-checked; the user's other unused tokens are deleted. | auth-flows.itest.ts |
| F09 | A07 | Low | src/app/api/account/password/route.ts | A reset link requested before a password change could still undo that change. | Fixed: a password change deletes outstanding reset tokens. | auth-flows.itest.ts |
| F10 | A07 | Medium | src/app/api/auth/login/route.ts | Login was limited only per email, so a single client could spray passwords across many accounts. | Fixed: also limited to 50 failures per 15 min per IP. | auth-flows.itest.ts |
| F11 | A07 | Medium | src/lib/auth/session.ts | A session stayed valid for 30 days even when unused. | Fixed: 14-day idle timeout based on `lastSeenAt` (or `createdAt`). Idle sessions are deleted, hidden from the session list and swept by cleanup. | sessions.itest.ts |
| F12 | A07 | Low | login, signup and reset routes | Signing in again, or as someone else, left the browser's previous session valid on the server. | Fixed: `startSession()` revokes the browser's current session first and uses the same cookie options everywhere. | sessions.itest.ts |
| F13 | A01 | Medium | src/proxy.ts with src/app/login/page.tsx | `/login?next=//evil.example` was followed after login, which is an open redirect. | Fixed in the proxy: an unsafe `next` is stripped before the page loads, and `safeNextPath()` is exported. Client-side use of it is requested from qa. | proxy.itest.ts |
| F14 | A04 (latency) | Low | src/proxy.ts | Each API call ran the session lookup twice: once in the proxy and once in the handler. | Fixed: for the API, the proxy only checks that the cookie is present. Handlers authorise every request (enforced by the sweep test). | access-control.itest.ts, proxy.itest.ts |
| F15 | A04 | Medium | src/app/api/flight-deck/route.ts | The run was not aborted when the client disconnected, so paid model calls carried on. Writes after a disconnect threw. | Fixed: the run is aborted on request abort, stream cancel or the 120 s timeout. Sends are guarded. | flight-deck.itest.ts |
| F16 | A05/A09 | Medium | flight-deck route; src/lib/agents/atlas-agent.ts | The SSE "done" frame carried `err.message` (provider, network or DB text). The missing-key message named the env var and `.env.local`. | Fixed: users see a generic message and the detail goes to the server log. The setup hint shows only in development. | flight-deck.itest.ts |
| F17 | A04/A08 | Low | src/lib/agents/schemas.ts, tools.ts | The assistant request had unbounded arrays, coordinates and labels. Tool inputs had no range checks. | Fixed: bounds on all of them (200 zones, 500 vertices, valid lat/lng). | flight-deck.itest.ts |
| F18 | A10 | Low | src/app/api/geo/*, src/lib/agents/tools.ts | Upstream fetches followed redirects, and `res.json()` had no size limit. `GEOCODER_URL`/`ELEVATION_URL` were not validated. | Fixed: `fetchUpstreamJson` (redirects refused, timeout, response cap) and `upstreamUrl` (https only in production, no credentials). User input never sets the host. | ssrf.itest.ts |
| F19 | A04 | Low | src/app/api/geo/elevation/route.ts | No per-user limit, although each call fans out to a third-party API. | Fixed: 60 requests per minute per user, then 429 with Retry-After. | ssrf.itest.ts |
| F20 | A05 | Low | next.config.ts | API JSON had no Cache-Control. There was no COOP. The CSP allowed unused Google Fonts hosts. | Fixed: `/api/*` sends `no-store, no-transform`, COOP is `same-origin`, and the font hosts are removed. Checked with curl against `next start`. | headers.itest.ts |
| F21 | A09 | Medium | (none) | Failed logins, lockouts, CSRF rejections and password or session changes were not logged. | Fixed: `securityEvent()` writes JSON lines with userId/IP and a hashed email reference. It never logs a password, token or address. | logging.itest.ts |
| F22 | A04 | Low | src/lib/email/send.ts | The Resend call had no timeout, so signup and reset could hang. | Fixed: 10 s timeout. | logging.itest.ts |
| F23 | A07 | Low | signup route | A 409 for an existing email reveals that the account exists. | Accepted: needed for the signup UX. Rate-limited per IP and per email. Login and forgot-password do not reveal it (timing measured, see below). | security.itest.ts |
| F24 | A07 | Low | rate-limit.ts | The per-email lockout (10 failures per 15 min) can be triggered by a third party to lock someone out. | Accepted: lasts 15 minutes and is the standard trade-off; the per-IP ceiling limits the attacker. | auth-flows.itest.ts |
| F25 | A05 | Low | next.config.ts | The CSP has `script-src 'unsafe-inline'` because Next injects inline bootstrap scripts. | Accepted for now: nonces would force every page to render dynamically. Follow-up: nonce-based CSP once a page budget allows it. | headers.itest.ts |
| F26 | A06 | Info | devDependencies | 7 advisories remain in the full audit, all in dev tools: tinypool and @vitest/mocker (vitest 3; the fix needs vitest 4), braces (no patched release), @humanfs/node, valibot and fast-glob paths under eslint and the prisma CLI. | Accepted: never shipped or run on a server. Follow-up: vitest 4. | `pnpm audit` |

### Follow-ups for other owners (in signals/h/requests.md)

- perf: `src/lib/services/terrain-service.ts` should use `fetchUpstreamJson` (redirects off, size cap). It calls a fixed host, so the risk is low. Done.
- qa: use `safeNextPath()` in `src/app/login/page.tsx`. Delete the unused `social-button` component, which holds the only `dangerouslySetInnerHTML` in `src` (static SVG). Both done; `src` now has no `dangerouslySetInnerHTML`.
- Docs: add `APP_URL` to `.env.local.example` and the deploy guide. Done.

## Checklist by category

**A01 Broken access control.**
- Every handler re-checks the session through `authorize()` or `getCurrentSession()`. Every mutation also checks same-origin (the Origin host must match the request host; a missing Origin is refused).
- Missions use `getOwnedMission`/`getOwnedFullMission`, so a mission that belongs to someone else, or a malformed id, returns 404.
- The sweep test calls every exported method of every route directly: 401 without a session, 403 for a cross-site or missing Origin, 404 for another user's mission on every `[id]` route (and the mission is left unchanged), and 404 for another user's session id.
- Routes that are not defined return 405 (Next).
- The proxy protects `/missions`, `/dashboard`, `/settings` and `/mission-planner`. The pages under them are client components that read data only through the API.

**A02 Cryptographic failures.**
- Argon2id with m=19 MiB, t=2, p=1 (the OWASP baseline). It takes about 9 ms per hash on the test container.
- Tokens are 32 random bytes from `crypto.randomBytes`, base64url-encoded. Only their SHA-256 is stored.
- Session cookie `mps_session`: HttpOnly, `SameSite=Lax`, `Secure` in production, `path=/`, 30-day Max-Age and Expires.
- Verification links last 24 h and are deleted on use. Reset links last 1 h, work once and are locked during use.
- HSTS (2 years, preload) is sent on HTTPS deployments.
- Not done: a `__Host-` cookie prefix. Renaming the cookie would sign everyone out. Noted for a future auth change.

**A03 Injection.**
- All DB access goes through the Prisma ORM query builder. There is no raw SQL. Search uses `escapeLike`.
- Import parses only JSON (`.plan`, the app's own `.json`) and `QGC WPL` text, so there is no XML parser and no entity expansion.
- Imports are capped at 1 MB, 2000 items and 200 zones. Every item and zone, plus home and settings, is checked with zod.
- `JSON.parse` results are read field by field and never merged into objects, so prototype pollution is not possible.
- SSE frames are `JSON.stringify`ed, so data cannot contain newlines that break framing.
- Export filenames are slugs (`[a-z0-9-_]`, at most 80 characters) followed by a UTC timestamp, so `Content-Disposition` cannot be injected.
- Email HTML escapes the link.
- `dangerouslySetInnerHTML`: one occurrence, static SVG, unused component.

**A04 Insecure design and limits.**

| Area | Limit |
|---|---|
| Login | 10 failures / 15 min per email, 50 / 15 min per IP |
| Signup | 5 / hour per IP and per email |
| Forgot password | 5 / hour per email |
| Resend verification | 5 / hour per user |
| Password change, account delete | 5 failures / 15 min |
| Assistant | 10 runs / hour and 50 / day per user; 256 KB body; 120 s run timeout; 30 s per model call; 10 s per tool |
| Geo search | 1 request / s per user, plus 1 / s upstream per instance |
| Elevation | 60 requests / min per user, 100 points per request |
| Request bodies | Capped on every route while streaming: auth 8 KB, account 4 KB, create 16 KB, elevation 32 KB, import 1 MB, PATCH 4 MB |
| Upstream calls | Timeouts of 8–10 s and response caps |

**A05 Security misconfiguration.**
- `next start` sends: CSP (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP, and HSTS on HTTPS deployments.
- `x-powered-by` is off.
- Errors use the `{ ok:false, error, code }` shape and never include stack traces or DB text. Unhandled errors give Next's empty 500.
- `devVerifyUrl` and `devResetUrl` are returned only when `NODE_ENV !== 'production'` and email was not delivered. Vercel previews run with `NODE_ENV=production`, so they are off there too. Checked on `next start`: neither signup nor forgot-password returns a dev link.

**A06 Vulnerable components.** See F01 and F26. maplibre-gl 6 ships its web worker as separate ES modules. `pnpm maplibre:worker` (which runs inside `dev` and `build`) copies them into `public/maplibre/`, and the editor calls `setWorkerUrl` with that same-origin path.

**A07 Identification and authentication.**
- Sessions: 30-day absolute expiry and a 14-day idle timeout. `lastSeenAt` is updated at most every 5 minutes.
- Logout deletes the session on the server.
- Password change and reset revoke every session and issue a new one for the current device.
- Settings › Sessions lists sessions and can revoke one, all others, or all.
- Deleting the account requires the password and is rate-limited.
- Password policy: 10 to 200 characters, no composition rules (as NIST 800-63B recommends).
- Login timing: 30 samples each over HTTP gave a median of 43 ms for an existing email with a wrong password and 48 ms for an unknown email. The difference is within noise; a dummy argon2 verify runs for unknown emails.
- ASVS L2 asks for 12 h sessions or a 30 min idle timeout. That is an accepted deviation: 30 days absolute plus 14 days idle suits a planning tool, and the account actions above all require re-authentication.

**A08 Software and data integrity.** No `eval` or `new Function`. Every input is checked with zod. LLM output is treated as untrusted: it is parsed against `MissionDraftSchema`, audited by SENTINEL and only applied after a person approves it. The lockfile is committed. Supply chain: versions are pinned to releases at least two weeks old, and there are no install scripts beyond the ignored `sharp` and `unrs-resolver` builds.

**A09 Logging.** See F21. Email addresses in logs are redacted (`j***@e***.com`) or hashed. Tests assert that no email, password or reset token appears in any console output during login and reset flows.

**A10 SSRF.** See F18. The only outbound hosts are the fixed geocoder and elevation services, `api.anthropic.com` (SDK) and `api.resend.com`. User input never chooses a host.

**Secrets.**
- A pattern scan of every commit in `git log --all -p` (connection strings with passwords, `sk-ant-`, `re_`, `npg_`, AWS, GitHub and Slack tokens, private keys) found only placeholders: the localhost CI database in the workflow and `user:password@localhost` examples. No real secret is in the repo or its history.
- `.gitignore` covers `.env*`, except `.env.local.example`, which holds empty values.
- `ANTHROPIC_API_KEY`, `RESEND_API_KEY` and `DATABASE_URL` are read only in server modules. There are no `NEXT_PUBLIC_` variables, and the built client chunks do not contain those names.

## Latency (auth paths)

Measured on `next start` with local Postgres, 4 vCPU:

| Path | Time |
|---|---|
| Argon2id hash or verify | ~9 ms |
| Login | ~45 ms median |
| Authenticated `GET /api/missions` | 13–22 ms |
| `GET /api/auth/me` | ~12 ms |
| `/dashboard` HTML | ~10 ms |

Session lookup is one indexed query on `tokenHash` with the user joined, plus at most one `lastSeenAt` write every 5 minutes. The proxy no longer repeats that lookup for API calls (F14).

## Configuration required in production

- `APP_URL`: the public origin used in emailed links, e.g. `https://flightdeck.example.com` (documented in `.env.local.example` and the README deploy steps). When unset it falls back to the Vercel production URL (`VERCEL_PROJECT_PRODUCTION_URL`), then the deployment URL (`VERCEL_URL`), and otherwise to the request URL, which is meant for local development only. Set it for a custom domain and always when self-hosting.
- If self-hosting: run behind a proxy that overwrites `X-Forwarded-For`, so per-IP limits cannot be dodged, and set `FORCE_HTTPS=1` to get HSTS and `upgrade-insecure-requests`.
- `GEOCODER_URL` and `ELEVATION_URL` are optional and must be https.
