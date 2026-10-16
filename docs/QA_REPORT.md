# QA report: final pre-release pass

Date: 2026-10-16. Branch `task/h-qa`, built on sec's dependency commits (next 16.3.8, maplibre-gl 6.11, @playwright/test 1.56.1, @axe-core/playwright 4.14.0).

## How it was checked

- **Static checks:** `pnpm lint --max-warnings=0` gives 0 errors and 0 warnings. `pnpm typecheck` is clean, `pnpm test` passes 55 of 55 unit tests, and `pnpm test:integration` passes 35 of 35 on a freshly migrated and seeded database.
- **Build:** `pnpm build` produces no warnings. It also builds with a dummy `DATABASE_URL`, which is the setup CI uses.
- **Runtime crawl:** a production server ran on :3203 against a scratch copy of the database. A Playwright script visited every page and opened every panel in four configurations: light and dark themes, each at 390 px and 1440 px. For each one it recorded browser console errors and warnings, page errors, failed and 4xx/5xx requests, hydration and React key warnings, and horizontal overflow. It also took a screenshot of each step.
- **Accessibility:** axe-core checked every page and state against WCAG 2.0, 2.1 and 2.2 at levels A and AA, in both themes and at both widths. Keyboard checks covered the landing page, dialogs and menus.

### Pages and states visited (×4: light/dark × 390/1440)

| Area | States |
|---|---|
| Public | landing, login, login with a wrong password, signup, forgot password, reset password (with a token and without one), verify email (invalid token), 404 |
| Dashboard | grid, table, new-mission dialog, place search inside the dialog, ⌘K command palette |
| Editor | load; every tool on the rail (Select, Waypoint, Survey area, Zone, Set home, Measure, Satellite, Fit route); inspector tabs (Waypoints, Item, Checks, Settings); planner panels (Survey, Optimise, Route around zones); export menu; Template, Draft from description (assistant), Parameter table, Shortcuts; checks chip; terrain panel; map place search |
| Settings | profile, password, sessions, delete-account dialog |
| Errors | mission not found or not owned, legacy /mission-planner redirect |
| Empty states | dashboard empty state and editor "No items yet" (covered by the E2E specs with a new user and new missions) |

## Issues found and fixed

| # | Issue | Where | Fix (commit) |
|---|---|---|---|
| 1 | The label on the primary `ui/Button` was invisible, ink on ink in both themes. The "Back to missions" button on the mission-not-found screen was affected. `cn()` used plain tailwind-merge, which reads `text-body-medium` as a colour and dropped `text-fd-surface`. | src/lib/utils.ts | `cn` now merges through the project's `cx` (63abfbf) |
| 2 | Console warning "Unable to perform style diff" when the basemap host is unreachable | mission-map.tsx | fallback style uses `diff:false` (9771008) |
| 3 | The new-mission dialog showed "Search failed (502)" when the geocoder is down | map-chrome.tsx, dashboard-dialogs.tsx | Plain message saying search is unavailable and the mission can still be created, announced with `role=alert` (abbd5cb) |
| 4 | The editor dialogs (template, delete, shortcuts, export warning, conflict) had no accessible name, did not move focus in or trap it, and did not return focus to the opener. The close button had no focus ring. | ui/dialog.tsx | aria-labelledby comes from DialogTitle; focus moves in on open, is trapped while open and returns on close; the close button gets a focus ring and a 32 px target (090241b) |
| 5 | Template cards said "1 items" | template-picker.tsx | Pluralised (090241b) |
| 6 | axe `label-content-name-mismatch` (WCAG 2.5.3, serious) on the shell search button and the avatar menu | app-shell.tsx, account-menu.tsx | The search button is named by its visible text, and the avatar label includes the initials (96fb4dc) |
| 7 | Every session row's "Sign out" button had the same name | settings/page.tsx | Each label names the device and sign-in date (945495a) |
| 9 | Open redirect: `/login?next=//evil.example` sent the user off-site after sign-in (requested by sec as defence in depth) | login/page.tsx | `safeNextPath()`, falling back to /dashboard, plus an E2E spec that failed before the fix |
| 8 | After the MapLibre 6 upgrade, each waypoint number logged "Image mp-num-N could not be loaded" | mission-map.tsx | Numbers are drawn via `setMissingStyleImageResolver` (525f1be) |

### Blocked external hosts are handled without errors

Map tiles, the geocoder and the elevation service are unreachable from this container. In each case the app shows a clear message and raises no uncaught errors:

- **Basemap:** a toast says "Basemap tiles could not load. Editing still works". The map falls back to a blank style, and the route, waypoints and zones still draw.
- **Map place search:** shows "Search is unavailable right now".
- **New-mission search:** shows the message from fix 3.
- **Terrain panel:** shows "Terrain data is unavailable right now. Clearance is not being checked." The Checks tab repeats the same note.

The browser's own "Failed to load resource" lines for these hosts, and for the 502 responses from `/api/geo/*`, are expected.

### Console output that remains, all expected

- **Intended HTTP responses that browsers log:** 401 on a wrong password, 400 on a verify-email request with an invalid token, 404 on the 404 page, and 404 on the API request for a mission that does not exist.
- **Aborted RSC prefetches (`ERR_ABORTED`) during navigation:** these are normal Next.js behaviour.

No crawl step showed page errors, hydration warnings, React key warnings or horizontal overflow.

## Automated suites

### E2E (Playwright): `pnpm build && pnpm test:e2e`

The suite has 19 specs in `tests/e2e`. Configuration is in `playwright.config.ts`. It uses one worker against `next start`, or against `E2E_BASE_URL` if that is set. The global setup stores a session for the seeded demo user.

- **auth:** sign up a new user, sign out and sign back in; wrong password shows a generic error; demo user signs in through the form; an off-site `?next=` after sign-in stays in the app
- **dashboard:** create, rename and delete a mission
- **editor:** add 3 waypoints, see "Saved", reload and still have 3; apply a template; survey generation is undone in one step; a keep-out zone across a leg raises a "crosses keep-out zone" check and an error count on the checks chip; `.plan` export downloads valid QGroundControl JSON
- **import:** import a `.plan` from the dashboard and open it
- **settings:** change the display name; sign out other sessions (the other device gets a 401, this one stays signed in)
- **a11y:** keyboard-only tab order of the landing nav with visible focus rings; skip link and nav anchors; axe with no serious or critical violations on landing, login, dashboard and editor

**Result:** 19 of 19 passed on the final build. The first 18 specs also passed twice: once against :3203, and once from a fresh database in CI mode (`CI=1`, Playwright starting its own server).

### CI: `.github/workflows/ci.yml`

CI runs on pull requests and on pushes to main. It uses Node 22, and the pnpm version comes from the `packageManager` field.

- **`checks` job:** `pnpm install --frozen-lockfile`, `pnpm lint --max-warnings=0`, typecheck, unit tests, `pnpm design:lint` (ripgrep is installed first if the runner lacks it), then a build with a dummy `DATABASE_URL`.
- **`integration-e2e` job:** a Postgres 16 service container; `pnpm db:migrate && pnpm db:sign && pnpm db:seed`; integration tests; build; `playwright install --with-deps chromium`; `pnpm test:e2e`; the Playwright report is uploaded as an artifact.
- **Secrets:** none are needed.

The full sequence was simulated locally against an empty database and every step was green.

## Remaining items

- **Prefetch 404 for signed-in users (fixed by sec in de335c3, the proxy now lets RSC prefetches of `/login` and `/signup` through):** after logging in, and on the landing page, signed-in users get one console 404. Next prefetches `/login` and `/signup`, the proxy redirects those prefetches to `/dashboard`, and the browser follows the redirect without RSC headers, so `/dashboard?_rsc=…` answers 404. Navigation works. The fix belongs in `src/proxy.ts` (sec's file): skip the redirect for requests that carry `next-router-prefetch`. Requested in requests.md.
- **Menu semantics:** dropdown menus (More actions, Plan, Add, card actions) are built as dialogs of buttons rather than ARIA `menu`/`menuitem`. They are keyboard-operable with Tab and Escape and axe passes, but there is no arrow-key navigation. Changing this is a component-level refactor of `base/dropdown`; logged as a follow-up.
- **Local reruns and rate limits:** the signup rate limit (5 per hour per IP or email) applies to local reruns of the E2E suite. Clear the `AuthAttempt` table in a scratch database between runs. CI always starts from a fresh database.
- **Map rendering in E2E:** with blocked tile hosts, the editor E2E specs exercise the blank fallback basemap. Real tile rendering was not visually verified in this container.
