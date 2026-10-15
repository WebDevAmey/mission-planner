# Mission Planner: Technical Specification

Status: **Draft for review** · Baseline commit `0f7aab3` · Labels: **Verified / Inferred / Proposed / Needs confirmation** (see [PRODUCT_SPEC](PRODUCT_SPEC.md)).

---

## 1. Current architecture (Verified)

| Area | Current |
|---|---|
| Framework | Next.js 16.2.2, App Router, React 19.2.4, React Compiler on (`next.config.ts`), webpack build |
| Language and tooling | TypeScript 5 strict, ESLint 9 (`eslint-config-next`), pnpm (lockfile v9) |
| Styling | Tailwind CSS 4 via `@theme` in `src/app/globals.css`; shadcn primitives in `src/components/ui/` |
| State | Zustand. `mission-store` is in memory. `constraints`, `geofence`, `tenant`, `mission-library` and `agent` stores persist to **localStorage**. |
| Map | MapLibre GL 5.21; vector tiles from OpenFreeMap (`tiles.openfreemap.org`), satellite from Esri World Imagery; geocoding with Nominatim from the browser |
| Terrain | `api.open-elevation.com` (public, best-effort), in-memory cache |
| Database | PostgreSQL 15+ through **Prisma ORM 8.0.0-rc** (`@prisma/orm-postgres` rc.17, CLI rc.22) using the "contract" workflow; one migration at `migrations/app/20261014T0953_init` |
| Auth | Home-grown: Argon2id hashes, DB-backed opaque session tokens (SHA-256 hashed), Resend for email |
| AI | LangGraph + `@langchain/anthropic` (`claude-sonnet-4-5`, `atlas-agent.ts`), streamed over SSE from `/api/flight-deck` |
| Hosting | Vercel, according to the README ("confirmed from the repo's GitHub deployment history"); **Needs confirmation**, since there is no `vercel.json` |
| Tests and CI | **None.** No test runner and no `.github/workflows`. |

### 1.1 Commands (taken from `package.json`, run on a scratch clone at `0f7aab3`)

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` (pnpm 10.30.0, Node 22) | OK |
| `pnpm lint` | OK: 0 errors, 1 warning (`terrain-panel.tsx:87` missing hook dependency) |
| `npx tsc --noEmit --incremental false` | OK, 0 errors |
| `pnpm build` (`contract:emit` + `next build --webpack`) with a dummy `DATABASE_URL` | OK; 21 routes, Proxy middleware |
| `pnpm db:migrate`, `db:sign`, `db:seed` against a scratch local Postgres 16 | OK; 1 migration, 26 operations |
| Autosave payload against `updateMissionSchema` (a tsx script) | **Fails** with 1 or more waypoints (see PRODUCT_SPEC §2.1-1) |

The checks were not run on your machine. Your `.env` was not read.

### 1.2 Request flow (Verified)

```
Browser (client components, Zustand)
  ├─ fetch /api/auth/*        → route handlers → db (Prisma 8 runtime) → Postgres
  ├─ fetch /api/missions/**   → proxy.ts (cookie → session lookup) → handler → requireUser() → ownership check → db
  ├─ fetch /api/flight-deck   → proxy.ts auth only → LangGraph → Anthropic API (+ Nominatim, Open-Elevation)
  └─ direct third-party calls: OpenFreeMap tiles, Esri tiles, Nominatim search, Open-Elevation
```

## 2. Target architecture (Proposed)

Keep the monolith: Next.js route handlers plus Postgres, and no new services. Changes:

1. **The server is the single source of truth** for missions, waypoints, settings, limits and zones. localStorage is used only for UI preferences (panel sizes, last map view), namespaced by user id and cleared on logout.
2. **A shared domain layer** in `src/lib/domain/`: pure functions for geometry, validation, path planning and exporters, used by the editor, the API (server-side export and validation) and SENTINEL. No React or store imports.
3. **A typed API client** in `src/lib/api/missions.ts`, with Zod schemas shared between client and server. The client sends **one canonical item shape** (the bug in §2.1-1 is a shape mismatch).
4. **Server-side map adapters:** proxy and cache geocoding and elevation through `/api/geo/search` and `/api/geo/elevation`. This adds rate limits, attribution compliance and caching, and lets the provider change in one place.

## 3. Data model

### 3.1 Existing tables (Verified, `src/prisma/contract.prisma`)
`User`, `Session`, `EmailVerificationToken`, `PasswordResetToken`, `AuthAttempt`, `Mission`, `MissionSettings` (1:1), and `Waypoint` (unique `(missionId, sequence)`). All use UUID primary keys and `ON DELETE CASCADE` from `User` to `Mission` to its children, with indexes on foreign keys. `MissionActionType` is a Postgres enum.

Gaps (Verified):
- `updatedAt` columns have `default now()` only and are not touched on update. The mission PATCH sets them manually; `User.updatedAt` is never updated.
- No version column for concurrency.
- Limits exist on `MissionSettings` (`maxDistanceM` and others) but the client never reads or writes them; the editor uses the localStorage `constraints-store`.
- No tables for zones, survey areas or rally points.

### 3.2 Proposed changes (all additive migrations)

| Entity | Change | Purpose and rules |
|---|---|---|
| `Mission` | add `version Int @default(1)`, `status MissionStatus @default(draft)` (`draft`, `ready`, `archived`), `vehicleType String @default("multirotor")`, `lastValidatedAt`, `summary` (Proposed: denormalised `distanceM`, `durationS`, `waypointCount`, `errorCount`, `warningCount`, `bbox`) | Optimistic locking; a dashboard that doesn't need to load waypoints. The summary is written on every save by the server-side validator. Index `(userId, updatedAt desc)`. |
| `MissionSettings` | add `cruiseSpeed`, `hoverSpeed`, `turnaroundM`, `homeElevationM Float?` | Export and estimates; terrain maths. Range checks are enforced in Zod, and as Postgres `CHECK` constraints where the ORM supports them (**Needs confirmation** for Prisma 8 rc). |
| `Zone` (new) | `id uuid PK`, `missionId FK → Mission ON DELETE CASCADE`, `kind` (`no_fly`, `keep_in`, `keep_out`), `shape` (`circle`, `polygon`), `label text`, `enabled bool`, `centerLat/centerLng/radiusM Float?`, `vertices jsonb?` (an array of `[lng, lat]`, validated as 3–500 points, closed, non-self-intersecting), `minAltM/maxAltM Float?`, `createdAt`, `updatedAt`. Index `(missionId)`. | Replaces both `constraints-store.nfzs` and `geofence-store`. JSONB is justified because vertex lists are variable length and always read whole. |
| `SurveyArea` (new, Phase 7) | `id`, `missionId FK cascade`, `vertices jsonb`, `params jsonb` (spacing, angle, overlap, altitude, camera), `generatedItemIds text[]` | Lets the user regenerate a survey after editing the polygon. |
| `RallyPoint` (later) | `id`, `missionId FK`, `lat`, `lng`, `alt` | Exported in `.plan`. |
| `Waypoint` | keep. Add `CHECK (latitude BETWEEN -90 AND 90)` and the longitude equivalent if supported. | |
| `AuthAttempt` | add a retention job (delete rows older than 30 days) | Unbounded growth today. |
| `Session` | add `lastSeenAt`; scheduled cleanup of expired rows | Session list in Settings; table hygiene. |
| `AiRun` (Proposed, Needs confirmation) | `id`, `userId FK cascade`, `prompt text`, `verdict`, `costTokens int`, `createdAt` | Server-side quota and audit; replaces `mps-flight-deck-history` in localStorage. |

Organisations and tenants are **not** modelled in MVP. See DECISIONS D-07.

**Deletion behaviour:** deleting a user cascades to sessions, tokens, missions, settings, waypoints, zones and AI runs. Deleting a mission cascades to its children. There are no soft deletes in MVP (Needs confirmation; the alternative is `archived` status plus a 30-day purge).

### 3.3 Migration of existing data (Proposed)
- **Server data:** additive columns with defaults, so no backfill is needed except `version = 1`. The summary columns are backfilled by a one-off script that runs the validator per mission (idempotent, batched).
- **Browser-only data (no-fly zones, geofences, library missions):** on first load after release, if localStorage has `mps-constraints-store`, `mps-geofence-store` or `mps-mission-library` entries, show a one-time "Import N local missions / M zones into your account?" prompt. Import calls the normal API, and the keys are deleted afterwards. No silent upload.
- **Waypoint data lost by the save bug:** it cannot be recovered server-side. Users' library copies in localStorage may hold their latest edits, because `LibraryBridge` mirrors every change. The import prompt above recovers them, which is a strong reason to ship it together with the save fix.

## 4. Authentication and security

### 4.1 Current design (Verified), keep
Argon2id (19 MiB, t=2); a 256-bit session token in an `httpOnly`, `SameSite=Lax`, `Secure` (production) cookie with only its hash stored; a 30-day absolute expiry; same-origin `Origin` check on mutating routes; DB-backed rate limits (login 10 per 15 min per email, signup 5 per hour per IP, forgot-password 5 per hour per email); no account enumeration on login or forgot-password; constant-ish timing with a dummy hash; password reset revokes all sessions; route handlers re-check the session (`requireUser`) and ownership (404 on a foreign mission).

### 4.2 Gaps and fixes (Verified finding → Proposed fix)

| # | Finding | Fix |
|---|---|---|
| S1 | `/api/flight-deck` has no same-origin check, no in-handler `requireUser`, no rate limit or quota, and `request.json()` is not wrapped in try/catch. Any signed-in user can drive unlimited Anthropic spend. | Add `requireUser`, same-origin check, a per-user limit (for example 10 runs per hour and 50 per day, Needs confirmation), a request body size cap and a run timeout. |
| S2 | `DELETE /api/missions/:id` lacks the same-origin check that every other mutation has. | Add it. (`SameSite=Lax` plus preflight already mitigates this; the fix is for consistency.) |
| S3 | Mission data, zones and prompt history in localStorage persist across accounts on a shared browser. | Server-side storage (§3.2); clear namespaced keys on logout. |
| S4 | `PATCH` accepts client-supplied waypoint `id`s, so a collision with another mission's waypoint id causes a 500. | Ignore client ids, or accept them only after ownership verification. Server generates ids. |
| S5 | No security headers (CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`). Not found in `next.config.ts`. | Add headers in `next.config.ts`. CSP allowlist: self, the tile and geocode hosts (or none once proxied), and Anthropic only server-side. |
| S6 | Signup rate limit is keyed on IP only (shared NAT); there is no global login throttle per IP. | Add a second key on email. Optionally add an IP-wide login ceiling. |
| S7 | Email verification is not required for anything. | Require verification before export and AI use (Needs confirmation), or keep it informational. |
| S8 | There is no session rotation and no sliding expiry. A 30-day absolute session lasts until expiry or logout. | Add `lastSeenAt`, a "Sign out everywhere" option, and rotate the token on password change. |
| S9 | Third-party calls from the browser (Nominatim, Open-Elevation, tiles) leak user location queries and violate the Nominatim usage policy at scale. | Proxy through `/api/geo/*` with caching and a User-Agent; choose commercial providers (DECISIONS D-05). |
| S10 | Map attribution is hidden. | Enable `attributionControl` (compact). |
| S11 | `console.warn` in `send.ts` logs recipient email addresses. | Log a hashed or redacted address. |
| S12 | The dependency set includes a release-candidate ORM and unused `@prisma/client`. | See DECISIONS D-02; remove the unused dependency. |

**Trust boundaries:** (1) browser to route handlers: everything from the client is untrusted, and every handler validates with Zod and derives the user from the cookie; (2) route handlers to Postgres: only server code holds `DATABASE_URL`; (3) server to Anthropic, geocode and elevation providers: outbound only, with keys in server env; (4) the LLM output is untrusted and only becomes mission data after SENTINEL validation and explicit human approval.

**Where authorisation is enforced:** `src/proxy.ts` (coarse, for pages and API prefixes), then `requireUser()` in every handler, then an ownership check (`mission.userId === user.id`) in every mission handler. Proposed: move the ownership check into a single `getOwnedMission(id, userId)` helper in `src/lib/missions/repo.ts` so no handler can forget it, and add an integration test per route asserting a 404 for a foreign mission.

**Auth library decision:** keep the home-grown implementation for MVP. See DECISIONS D-03 for the alternatives (Better Auth, Auth.js, Lucia-style).

## 5. API

### 5.1 Inventory (Verified)

| Route | Method | Auth | Notes |
|---|---|---|---|
| `/api/auth/signup` | POST | none | origin check, rate limit, creates session |
| `/api/auth/login` | POST | none | origin check, rate limit |
| `/api/auth/logout` | POST | cookie | no origin check (low risk) |
| `/api/auth/me` | GET | cookie | |
| `/api/auth/verify-email` | POST | token | |
| `/api/auth/resend-verification` | POST | cookie | no rate limit |
| `/api/auth/forgot-password` / `reset-password` | POST | none / token | |
| `/api/missions` | GET, POST | cookie | GET returns summaries; POST is not transactional (mission + settings) |
| `/api/missions/[id]` | GET, PATCH, DELETE | cookie + owner | PATCH replaces all waypoints (delete + insert) in a transaction |
| `/api/missions/[id]/duplicate` | POST | cookie + owner | per-row inserts in a transaction |
| `/api/flight-deck` | POST (SSE) | proxy only | see S1 |

### 5.2 Proposed additions and changes

| Route | Purpose | Validation and errors | Persistence |
|---|---|---|---|
| `PATCH /api/missions/[id]` | Body: `{ baseVersion, name?, description?, home?, settings?, limits?, items?, zones? }`. Items use the canonical flat shape. | 400 (Zod, first issue plus path), 404 (not owner), **409 `{ currentVersion }` when `baseVersion` ≠ the stored version**, 413 over 2,000 items | One transaction: update mission (`version + 1`, `updatedAt`), upsert settings, replace waypoints with a single multi-row insert, replace zones, recompute the summary. |
| `GET /api/missions?query=&sort=` | Dashboard list with summary fields | | Reads the `Mission` summary only |
| `GET /api/missions/[id]/export?format=plan\|waypoints\|kml\|geojson\|csv\|json` | Server-side export | 400 for an unknown format; 422 if there are validation errors and no `force=1` | Read only |
| `POST /api/missions/import` | Upload `.plan`, `.waypoints` or MPS JSON (1 MB max) | 400 with line or field detail | Creates a mission |
| `POST /api/missions/[id]/plan/survey` | Optional server endpoint; MVP runs client-side through the shared domain lib | | none |
| `GET /api/geo/search?q=` | Geocode proxy (cached 24 h, 1 request/s upstream) | 429 per user | none |
| `POST /api/geo/elevation` | Elevation proxy (batch of 100 or fewer, cached) | | none |
| `PATCH /api/account`, `POST /api/account/password`, `GET/DELETE /api/account/sessions`, `DELETE /api/account` | Settings (W9) | Re-auth with the current password for password change and delete | |

All mutating routes get the same-origin check, `requireUser`, Zod validation, and a consistent error shape `{ ok: false, error, code, issues? }`.

### 5.3 Saving and concurrency (Proposed)
- The client autosaves the **whole mission document** (debounced about 900 ms, maximum one save in flight; changes made during a save trigger one follow-up save).
- Optimistic concurrency uses `version`. On a 409 the client keeps local edits and shows "Changed elsewhere: Reload (discard mine) or Overwrite (keep mine)". Overwrite re-sends with the new `baseVersion`.
- Whole-document replace is acceptable at MVP scale (2,000 items or fewer, a single editor). Per-item patches and real-time collaboration are out of scope.
- `beforeunload` guard while the status is pending or error; `navigator.sendBeacon` is not used (it can't carry the origin check reliably). Instead, in-app navigation awaits the flush.

## 6. Map and editor implementation (Proposed)

| Current (Verified) | Problem | Change |
|---|---|---|
| Every mission change removes and re-adds all DOM `Marker`s, route layers and no-fly zone layers (`map-view.tsx` render effect) | Cost grows with item count, causes flicker and loses drag state | Use one GeoJSON source each for waypoints, route, zones and the survey preview, update it with `setData`, and draw waypoints with `circle` and `symbol` layers. Use feature-state for hover and selection; dragging is done with mouse events on the layer. DOM markers are kept only for home. |
| Switching map style calls `setStyle`, which drops custom layers, and the render effect doesn't re-run (`mapReady` is already true). Route and zones probably disappear until the next edit (Inferred). | Lost overlays | Re-add sources on `style.load`, or use `setStyle(..., { transformStyle })` to carry the overlay layers across. |
| Hard-coded colours and inline styles | Inconsistent visuals | Map paint colours come from CSS variables read once per theme. |
| Waypoint table inputs use `defaultValue` keyed by value | Fragile | Controlled inputs in the Inspector, committing on blur or Enter with validation messages. |
| Initial view at `[0,0]` zoom 3 | Disorienting | Fit to the route, then home, then the user's last view, then browser geolocation if granted. |

## 7. Algorithms (Proposed)

All live in `src/lib/domain/` as pure, unit-tested functions. Geometry runs in a local ENU (east-north-up) metric frame centred on the mission (equirectangular projection around the centroid), which is accurate to under 0.1% for areas under about 20 km. Distances shown to users use haversine; Vincenty or geodesic accuracy is not needed at this scale.

1. **Segment–zone intersection** (replaces midpoint sampling). Circle: the closest-point distance from the segment to the centre is compared with the radius. Polygon: segment–edge intersection tests plus point-in-polygon for the endpoints. Complexity is O(segments × edges); add an R-tree (`rbush`) only if a profile shows a need.
2. **Survey lawnmower (boustrophedon) coverage.** Inputs are a polygon (optionally with holes), line spacing (`spacing = footprintWidth × (1 − sideOverlap)` from camera sensor, focal length and altitude, or entered directly), sweep angle (default: the polygon's minimum-width direction, from rotating calipers on the convex hull) and turnaround distance. Steps: rotate the polygon by −angle, intersect horizontal scanlines with it (handling concave shapes by pairing sorted intersections), alternate direction, extend each line by the turnaround distance, rotate back, then emit a WAYPOINT per line end plus an optional `DO_SET_CAM_TRIGG_DIST` (trigger distance = footprintHeight × (1 − frontOverlap)). Output is previewed with counts, length and time. Shapes that don't decompose cleanly fall back to splitting the polygon into monotone cells (trapezoidal decomposition) and ordering cells by nearest neighbour.
3. **Route ordering (Optimise).** Treated as an open travelling-salesman path, with fixed start at takeoff or home and a fixed end (RTL returns home, so the cost includes the return leg). Construct with nearest neighbour, then improve with **2-opt plus Or-opt** until no improving move is found (about 100 ms for 200 points or fewer in a Web Worker). Constraints: attached non-spatial items (speed, camera, wait) move with the next spatial item; `DO_JUMP` targets are remapped by item id; locked items (user-pinned) stay in place. The result is applied as **one** undo step.
4. **Zone avoidance.** When a leg crosses a keep-out zone, build a visibility graph over the leg endpoints and the zone vertices (circles approximated by a buffered polygon, with buffer = safety margin), then run A* (Euclidean heuristic) for the shortest detour. Insert the resulting via-points as WAYPOINTs tagged `generated: avoidance`. Keep-in zones are handled by rejecting edges that leave the keep-in polygon.
5. **Time and energy estimate.** Per leg, a trapezoidal speed profile (accelerate, cruise, decelerate, with acceleration a configurable 2 m/s²); climb and descent time from altitude change at a configurable climb rate; dwell for loiter and wait; takeoff and landing time from altitude and speed parameters. Energy is a simple endurance budget: estimated time / (rated endurance × reserve factor), with rated endurance a per-mission setting. It replaces the hard-coded 20-minute assumption in `sentinel-audit.ts` and the "×1.1" battery string in `metrics-service.ts`.
6. **Terrain clearance.** `AGL = (relAlt + homeElev) − terrainElev(sample)`, sampled every `max(30 m, leg/50)` along each leg, not only at midpoints. `homeElev` comes from the elevation of the home point (or of the first waypoint). One function is shared by the terrain panel and SENTINEL.
7. **Validator.** A single `validateMission(mission, zones, limits, terrain?) → Issue[]`. It merges `missionSanityCheck`, `computeViolationCount`, `checkGeofences` and the terrain check. Codes are stable (for example `ZONE_KEEP_OUT_CROSS`), severity is error or warning, and each issue carries `itemIds`. The risk score is kept as an informational number with documented weights, never as a pass/fail on its own.

## 8. Export formats (Proposed)

| Format | Spec notes |
|---|---|
| `.plan` (QGC v1 JSON) | `firmwareType: 3` (ArduPilot), `vehicleType` from mission (2 = quad, 1 = fixed wing), `globalPlanAltitudeMode: 1` (relative), `plannedHomePosition` = home or first waypoint, items as `SimpleItem`, `geoFence.polygons[]` (`inclusion: true/false`) and `circles[]` from zones, `rallyPoints`. |
| `QGC WPL 110` | Row 0 is home (frame 0, `MAV_CMD_NAV_WAYPOINT`, current=1); then items with tab-separated 12 columns; `\r\n` line endings for Windows tools (Needs confirmation: verify against Mission Planner). |
| KML | `<Placemark>` LineString with `altitudeMode=relativeToGround` plus a point per waypoint; zones as Polygons. |
| GeoJSON | FeatureCollection: route LineString, waypoint Points with properties (seq, command, alt), zones. |
| CSV | `seq,command,lat,lon,alt_rel_m,speed_ms,param1..4,notes`. |
| MPS JSON | Keep the current `exportMissionAsV1Json`; bump to `version: "1.1"` once zones come from the server. Re-importable. |

Builders are pure functions in `src/lib/domain/export/` with golden-file tests. Filenames are slugged (`[^a-z0-9-_]` replaced by `-`, at most 80 characters) plus a timestamp.

## 9. Testing (Proposed)

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest | domain: geometry, survey, 2-opt, avoidance, validator, exporters (golden files), payload mapping |
| API integration | Vitest + a real Postgres (Docker or service container) | each route: auth, ownership (404 for foreign), validation, 409 concurrency |
| E2E | Playwright | sign up, create mission, add 3 waypoints, reload (persisted), export `.plan`, delete; template load doesn't blank; two-tab conflict |
| Accessibility | `@axe-core/playwright` | dashboard, editor, settings: no serious or critical violations |
| CI | GitHub Actions | `pnpm install --frozen-lockfile`, lint, `tsc --noEmit`, unit, integration (Postgres service), build, E2E on preview |

## 10. Environments and deployment

- **Environments:** local (`.env` with a local Postgres), preview (Vercel preview plus a Neon branch per preview: Proposed), production. Each has its own `DATABASE_URL`; production secrets live only in Vercel.
- **Env vars (Verified from `.env.local.example`):** `DATABASE_URL` (required), `ANTHROPIC_API_KEY` (Flight Deck), `RESEND_API_KEY` and `EMAIL_FROM` (email). Proposed additions: `GEOCODER_*` and `ELEVATION_*` provider keys, `MAP_STYLE_URL`, `AI_DAILY_QUOTA`.
- **Database hosting:** Neon (DECISIONS D-01), using the **pooled** connection string for the app and the direct string for migrations.
- **Migrations:** `pnpm db:plan`, review the SQL in the PR, `db:migrate` against staging, smoke-test, then production before the deploy that needs it. Additive-first (expand, then contract) for any rename.
- **Backups:** Neon point-in-time restore (check the retention for the chosen plan: Needs confirmation), plus a weekly `pg_dump` to separate storage. Restore is rehearsed once before the first schema change in production.
- **Observability (Proposed):** structured server logs (no PII), Vercel log drain, error tracking (Sentry or similar: Needs confirmation), and a save-failure counter.

## 11. What can be tested where

| Locally, no accounts | Needs provider credentials or production |
|---|---|
| Everything in §9 except below; scratch Postgres works (verified) | Real email delivery (Resend + verified domain); Flight Deck runs (`ANTHROPIC_API_KEY`); commercial geocode, elevation and satellite tiles; Neon branching; Vercel preview deploys; backup restore drill |

## 12. Scalability assumptions
Sized for up to a few thousand users and missions of 2,000 waypoints or fewer. Expected bottlenecks: the Postgres connection count from serverless (pooler required), auth rate-limit table growth (retention job), public geocode and elevation APIs (proxy, cache, paid plan), and Anthropic cost (quota). The whole-document mission save is fine until missions are edited by several people at once.
