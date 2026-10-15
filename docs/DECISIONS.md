# Mission Planner: Decisions

Each record lists context, options, a recommendation, trade-offs, and what would change the decision. **Approved 2026-10-15, defaults** marks the records the owner signed off (recommended defaults, "for now").

## D-01 · Production PostgreSQL host: **Neon** (Approved 2026-10-15, defaults)
- **Context:** Vercel serverless (README, Inferred); there is no Supabase (brief); a pooled connection is required.
- **Options:** Neon; Railway/Render Postgres; AWS RDS plus RDS Proxy; Vercel Postgres (which is Neon underneath).
- **Recommendation:** Neon, with the pooled URL for the app, the direct URL for migrations, and branch-per-preview.
- **Why:** serverless pooling is built in, it has a native Vercel integration, point-in-time restore, and a low cost at this scale.
- **Downsides:** cold starts on the free tier; vendor-specific branching.
- **Would change if:** the hosting leaves Vercel (then managed Postgres on the same cloud), or data-residency requirements apply.

## D-02 · ORM: **keep Prisma 8 (release candidate) for now, pin exactly, re-evaluate before GA launch** (Approved 2026-10-15, defaults)
- **Context:** the code uses `@prisma/orm-postgres` 8.0.0-rc.17 and CLI rc.22 with the contract workflow. Migrate, sign, seed and build all ran successfully on a scratch DB. There is also an unused `@prisma/client` 7 dependency.
- **Options:** (a) keep Prisma 8 rc; (b) move to stable Prisma 6/7; (c) Drizzle.
- **Recommendation:** (a). Pin the versions (remove `^`), remove `@prisma/client`, and keep all DB access behind `src/lib/missions/repo.ts` and the auth helpers so a later swap stays small.
- **Downsides:** rc APIs may change and there is less community help. CHECK constraint support is unverified.
- **Would change if:** the rc breaks on upgrade, a production bug is traced to the ORM, or GA slips past launch. Then switch to (b).

## D-03 · Authentication: **keep the in-house implementation** (Approved 2026-10-15, defaults)
- **Context:** the existing auth is careful: Argon2id, hashed opaque sessions, rate limits, no enumeration, reset revokes sessions.
- **Options:** keep it; Better Auth; Auth.js; a hosted provider (Clerk, WorkOS).
- **Recommendation:** keep it and close the gaps S1–S11 (TECHNICAL_SPEC §4.2).
- **Why:** it already works and is already reviewed in the code; migrating means a risky session and password-hash migration for little gain.
- **Downsides:** we own security maintenance. There is no social login, MFA or SSO.
- **Would change if:** SSO, MFA or social login become requirements (then Better Auth or WorkOS).

## D-04 · Mission save model: **whole-document PATCH plus optimistic version**
- **Options:** whole document; per-item JSON Patch; CRDT or real-time.
- **Why:** simplest correct choice for one editor and missions of 2,000 waypoints or fewer.
- **Would change if:** collaborative editing or very large missions.

## D-05 · Map, geocoding and elevation providers (Approved 2026-10-15, defaults)
- **Context:** OpenFreeMap vector tiles, Esri World Imagery satellite, public Nominatim and public Open-Elevation, all called from the browser, with attribution hidden.
- **Recommendation:** keep OpenFreeMap for vector tiles with attribution shown. For a commercial launch, use a paid satellite source (MapTiler or Mapbox satellite, or an ArcGIS account for Esri) and a paid geocoder (MapTiler, LocationIQ or OpenCage). Elevation from MapTiler terrain-RGB or a self-hosted Copernicus/SRTM tile set behind `/api/geo/elevation`. All of it is proxied and cached.
- **Why:** the public Nominatim and Open-Elevation services forbid or don't support commercial-scale use, and the Esri imagery terms need an account for commercial use (Needs confirmation by reading each provider's current terms).
- **Would change if:** usage stays at hobby scale.

## D-06 · Path-planning algorithms
- Survey: boustrophedon scanlines with trapezoidal decomposition as the fallback. Ordering: nearest neighbour, then 2-opt and Or-opt. Avoidance: visibility graph plus A*. All run in a Web Worker in a local ENU frame.
- **Why:** these are standard, deterministic and testable, and fast enough for 500 points or fewer without dependencies.
- **Rejected:** OR-Tools or genetic algorithms (heavy, non-deterministic); a grid A* (resolution artefacts).
- **Would change if:** missions grow past about 1,000 spatial points or need multi-vehicle routing.

## D-07 · Organisations and tenants: **remove from the editor for MVP** (Approved 2026-10-15, defaults)
- **Context:** the tenant switcher is localStorage-only, conflicts with server missions and causes the blank-editor bug.
- **Options:** remove it now and design real workspaces later; or model `Organization` and `Membership` now.
- **Recommendation:** remove it. Real teams need invites, roles and billing, which are out of MVP scope.
- **Would change if:** the first paying customers are teams.

## D-08 · Zones storage: **a `Zone` table with JSONB vertices**
- **Why:** variable-length polygons are always read whole; this avoids a vertex table and joins. Zod validates the shape. PostGIS was considered and deferred (no spatial queries server-side yet).

## D-09 · Brand name (Approved 2026-10-15, defaults)
- "Flight Deck" vs "MPS". **Default:** "Flight Deck" for the product, with "MPS" dropped from the UI.

## Open questions

> The recommended defaults in D-01 to D-09 were approved by the owner on 2026-10-15 "for now" and are in effect. The questions below remain open for later review.
1. Target user: multirotor only for MVP, or fixed-wing as well? (Default: multirotor.)
2. Should email verification be required before export or AI use? (Default: no, keep the banner.)
3. AI quota per user per day? (Default: 50 runs per day and 10 per hour.)
4. Soft delete for missions? (Default: hard delete with confirmation.)
5. Is pricing or billing in scope for the landing page? (Default: a "Free during beta" message.)
6. Confirm Vercel is the production host and who holds the Neon and Vercel accounts.
