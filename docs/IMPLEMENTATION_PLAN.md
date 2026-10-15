# Mission Planner: Implementation Plan

Status: **Draft for review** · Baseline `0f7aab3` · Specs: [PRODUCT_SPEC](PRODUCT_SPEC.md), [TECHNICAL_SPEC](TECHNICAL_SPEC.md), [DECISIONS](DECISIONS.md)

The order differs from the brief's suggested sequence because the audit found that **saving is broken in production** (PRODUCT_SPEC §2.1-1). Postgres, auth and mission CRUD already exist, so the plan starts by stopping data loss, then adds the test harness, then builds on top.

## Phase overview

| # | Phase | Depends on | Status |
|---|---|---|---|
| 0 | Baseline and test harness | none | Not started |
| 1 | Stop data loss: save fix, blank editor, local data leak | 0 | Not started |
| 2 | Shared domain layer and unified validator | 0 | Not started |
| 3 | Schema: version, summary, zones, limits on server | 1, 2 | Not started |
| 4 | API hardening and new endpoints | 3 | Not started |
| 5 | Editor redesign: declutter, layout, tokens, a11y | 1, 2 | Not started |
| 6 | Map rendering rewrite (GeoJSON layers, zones, tools) | 5 | Not started |
| 7 | Path planning algorithms | 2, 6 | Not started |
| 8 | Exports and import | 2, 3 | Not started |
| 9 | Dashboard upgrade | 3, 4 | Not started |
| 10 | Account settings | 4 | Not started |
| 11 | Landing page revamp | none (parallel) | Not started |
| 12 | Hardening, staging, rollout | all | Not started |

Phases 2, 5 and 11 can run in parallel once Phase 0 lands. Phases 7 and 8 can run in parallel.

---

### Phase 0: Baseline and test harness
- **Goal:** make every later change verifiable.
- **Evidence:** no test runner, no CI (Verified). Lint shows 1 warning; `tsc` and `build` pass (TECHNICAL_SPEC §1.1).
- **Scope:** add Vitest (unit and integration) and Playwright (E2E); add `test`, `test:e2e` and `typecheck` scripts; add a GitHub Actions workflow (install, lint, typecheck, unit, build); add a scratch-Postgres integration setup; add a smoke E2E (login with the seed user, open the dashboard).
- **Out of scope:** feature changes.
- **Files:** `package.json`, `vitest.config.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`, `tests/**`.
- **DB:** none. **Security:** CI uses a throwaway DB; no secrets are needed.
- **AC:** `pnpm test` and `pnpm typecheck` run green locally and in CI.
- **Risks:** Prisma 8 rc behaviour in CI. Mitigation: the same versions are pinned through the lockfile.
- **Rollback:** delete the added files. **Done when** CI is green on a PR.

### Phase 1: Stop data loss
- **Goal:** edits persist; the editor never goes blank; no cross-account leakage.
- **Evidence:** PRODUCT_SPEC §2.1 items 1–3.
- **Scope:**
  1. Map `MissionItem` to the flat API shape in a single `toWaypointInput()`, used by autosave. Add a unit test proving the payload passes `updateMissionSchema`.
  2. Make autosave robust: one save in flight, a follow-up save if dirty, retry with backoff, an error state with Retry, and a `beforeunload` guard.
  3. Templates, "New" and "Load" inside the editor go through the server: a template replaces the current mission's items and keeps the id, while New and Load navigate to the dashboard flow. Remove `LibraryBridge`, the in-editor Mission library drawer and the Organisation switcher from the editor (DECISIONS D-07).
  4. Clear `mps-*` localStorage keys on logout. Show a one-time "import local data" prompt (TECHNICAL_SPEC §3.3).
  5. Make "Approve & Load" in Flight Deck keep undo history (one undo step).
- **Files:** `src/hooks/useAutosaveMission.ts`, `src/lib/missions/payload.ts` (new), `src/components/layout/ardupilot-layout.tsx`, `src/components/mission/template-picker.tsx`, `src/lib/store/mission-store.ts`, logout call sites.
- **DB:** none. **Security:** removes the shared-browser leak (S3).
- **Tests:** unit for the payload mapping; E2E "add 3 waypoints, reload, still 3"; E2E "apply template, editor stays".
- **AC:** the E2E tests pass; manual check that save status shows Saved after an edit.
- **Risk:** users with unsaved local-only data. Mitigation: the import prompt ships in the same release.
- **Rollback:** revert the release; no schema change. **Done when** merged with green CI and verified on preview.

### Phase 2: Shared domain layer
- **Goal:** one implementation of geometry, validation, metrics and export, shared by the editor, API and SENTINEL.
- **Scope:** `src/lib/domain/{geo,validate,metrics,export,plan}/`. Move pure logic out of `lib/services/*` and leave re-exports during the transition. Add segment–zone intersection, home-relative terrain clearance and the trapezoidal time model (TECHNICAL_SPEC §7.1, 7.5, 7.6, 7.7).
- **Tests:** unit tests with fixtures; target 90% or more line coverage for the domain layer.
- **AC:** SENTINEL, the terrain panel and the editor checks all call `validateMission`; existing behaviour is otherwise unchanged (snapshot of the current issues on the seed mission).
- **Rollback:** the re-exports keep the old imports working.

### Phase 3: Schema changes
- **Goal:** the server stores everything the editor needs.
- **Scope:** add `Mission.version`, `status`, `vehicleType` and the summary columns; the new `MissionSettings` columns; the `Zone` table; the `Session.lastSeenAt` column. Generate the migration with `pnpm db:plan`, review the SQL and commit it. Add a backfill script for `version` and the summary.
- **DB:** additive only. **Backup:** take a Neon snapshot and a `pg_dump` before production apply. **Rollback:** the columns are unused by the old code, so the app can roll back without a down migration.
- **Tests:** migration applies on an empty DB and on a DB seeded with the current schema.
- **AC:** `db:migrate` and `db:sign` succeed on staging; the old app version still works against the new schema.

### Phase 4: API hardening and endpoints
- **Scope:** the `getOwnedMission` helper; same-origin checks everywhere (S2); Flight Deck auth, quota and timeout (S1); PATCH with `baseVersion` returning 409; a single multi-row waypoint insert; server-generated ids (S4); zones and limits in PATCH; summary recompute; `GET /export`; `POST /import`; `/api/geo/*` proxies; security headers (S5); email log redaction (S11); `AuthAttempt` retention.
- **Tests:** an integration suite per route (401, 404 for foreign, 400, 409, happy path).
- **AC:** all routes are covered; a manual CSP check finds no console violations in the editor.

### Phase 5: Editor redesign
- **Goal:** the decluttered layout in PRODUCT_SPEC §6.
- **Scope:** a new header, tool rail, right inspector (Waypoints, Item, Checks, Settings), status bar and bottom drawer for the full parameter table. Consolidated tokens and type scale; remove inline styles in the touched components; fix the viewport zoom lock and contrast; responsive breakpoints.
- **Out of scope:** map rendering internals (Phase 6).
- **Tests:** axe has no serious violations; E2E selectors are updated; visual check at 1440, 1024 and 390 px wide.
- **AC:** the header holds 8 or fewer controls; minimum text is 12 px (11 px for tabular numbers); every action from the old UI is reachable.

### Phase 6: Map rendering
- **Scope:** GeoJSON sources and layers for waypoints, route, zones and survey preview; drag on layers; restore overlays on style change; visible attribution; fit-to-route on load; Draw area, Draw zone (polygon and circle) and Measure tools; geocoding through `/api/geo/search`.
- **Tests:** E2E: draw a zone, it appears in Checks; drag a waypoint, the coordinates update.
- **AC:** a 500-waypoint mission pans at 60 fps on a mid-range laptop (manual check).

### Phase 7: Path planning
- **Scope:** survey lawnmower generator, 2-opt + Or-opt ordering with `DO_JUMP` remap, and visibility-graph zone avoidance, each running in a Web Worker with preview and apply as one undo step.
- **Tests:** property tests: coverage spacing is within ±5% of the target; the optimised length is never above the original; an avoided path never intersects keep-out zones.
- **AC:** PRODUCT_SPEC W6 criteria.

### Phase 8: Exports and import
- **Scope:** fix and expose `.plan` and `.waypoints`; add KML, GeoJSON and CSV; an Export menu in the editor and on the dashboard; import of `.plan`, `.waypoints` and MPS JSON.
- **Tests:** golden files; round trip (export then import gives the same items).
- **AC:** a manual import into QGC and Mission Planner, recorded in the release notes.

### Phase 9: Dashboard
- **Scope:** cards with route thumbnail (a static SVG from the summary `bbox` and simplified route), stats and status; search and sort; a create dialog with template and location; toasts for failures; skeletons.
- **AC:** PRODUCT_SPEC W2.

### Phase 10: Account settings
- **Scope:** the `/settings` page and `/api/account/*` (W9).
- **Security:** re-authentication for password change and account deletion; delete cascades.
- **AC:** integration plus E2E tests for each action.

### Phase 11: Landing page revamp
- **Scope:** align the brand, clear value proposition, product screenshots of the new editor, a pricing placeholder (**Needs confirmation**), FAQ, and a signup call to action. Reuse the existing motion components. Use third-party component libraries only after checking that they exist, are maintained and are licence-compatible.
- **AC:** Lighthouse performance and accessibility of 90 or higher on mobile.

### Phase 12: Hardening and rollout
- **Steps:** staging deploy with a Neon branch; restore drill; full E2E; production migration; deploy; watch save failures and errors for 48 h. **Rollback:** Vercel instant rollback (schema changes are additive).
- **Done when** production has run 48 h with no P1 issues and the README and these docs are updated.

## Checklist
- [ ] Phase 0 · [ ] 1 · [ ] 2 · [ ] 3 · [ ] 4 · [ ] 5 · [ ] 6 · [ ] 7 · [ ] 8 · [ ] 9 · [ ] 10 · [ ] 11 · [ ] 12
