# Security policy

## Reporting a vulnerability

Please report security issues privately to the maintainers. Use GitHub's "Report a vulnerability" (private security advisory) on this repository, or email the repository owner. Do not open a public issue. Include the steps to reproduce, the affected route or page, and the impact. We aim to acknowledge reports within 3 working days and to fix confirmed high-severity issues within 14 days.

Please do not run automated scanners against production, access other users' data, or send large volumes of email through the sign-up or password-reset forms.

## What is in place

- **Authentication.** Passwords are hashed with Argon2id (19 MiB, t=2). Sessions are 256-bit random tokens, and only their SHA-256 is stored. The cookie is HttpOnly, `SameSite=Lax` and `Secure` in production. Sessions expire after 30 days, or after 14 days without use. Password change and reset sign out every other session. Users can list and revoke sessions in Settings. Deleting the account requires the password.
- **Access control.** Every API handler checks the session itself; the proxy is only a coarse gate. Missions are scoped to their owner, so another user's mission returns 404. Every state-changing request must come from the same origin (CSRF).
- **Abuse limits.** Login, sign-up, password reset, verification email and account actions are rate-limited per email, per IP or per user. The AI assistant has a quota of 10 runs per hour and 50 per day. Geo lookups are rate-limited. Request bodies are capped while they stream in. Upstream calls have timeouts and response size limits, and redirects are refused.
- **Input handling.** All input is validated with zod, and mission imports (`.plan`, `.waypoints`, `.json`) are validated item by item. There is no raw SQL. Output from the AI model is validated against a schema and applied only after a person approves it.
- **Headers.** A Content Security Policy, HSTS (on HTTPS deployments), `X-Frame-Options: DENY`, nosniff, Referrer-Policy, Permissions-Policy, COOP, and `Cache-Control: no-store` on the API.
- **Logging.** Security events (logins, lockouts, rejected origins, password and session changes, quota hits) are written as JSON lines. Passwords, tokens and email addresses are never logged.
- **Dependencies.** `pnpm audit --prod` reports no known vulnerabilities as of the last audit.

The full audit, with each finding and its test, is in [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md).

## Deployment checklist

- Set `APP_URL` to the public origin. Links in verification and reset emails are built from it.
- Keep secrets (`DATABASE_URL`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`) in the hosting provider's environment settings, never in the repository.
- If self-hosting, put the app behind a proxy that overwrites `X-Forwarded-For`, and set `FORCE_HTTPS=1`.
