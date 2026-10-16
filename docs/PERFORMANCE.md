# Performance

Measured on 2026-10-16 in the dev container (4 vCPU, Node 22, Postgres 16 on the same box,
`next build --webpack` + `next start`). Other agents were building and testing on the same
machine at the time (load average 3–8), so small endpoints (under ~30 ms) move by a few ms
between runs. The large wins below are far outside that noise.

## Dataset and method

- Demo user `demo@example.com` with **50 missions**: one with **2,000 waypoints and 50 zones**
  (25 circles, 25 polygons of 8–48 vertices), 49 with 20–200 waypoints and 0–5 zones.
- **API**: a Node script logs in once, then sends each request **50 times** sequentially with the
  session cookie (3 warm-up requests first; 30 for exports and the 2,000-waypoint save, 20 for
  import). p50/p95 are wall-clock times at the client.
- **Before** = `1a6f2ec` (pre-hardening) and **after** = `task/h-perf`. Both builds also merge
  `task/h-sec`, because the shared `node_modules` moved to Next 16.3 / maplibre 6 and neither
  side builds without sec's dependency fixes. Base and after ran back to back on the same database.
- **Domain**: a `tsx` script runs each function on 500- and 2,000-point missions (with 50 zones)
  until 50 runs or a 1.5 s budget, and reports the median.
- Identical results: a 40-scenario dump of `validateMission`, `computeRisk`, `avoidZones` and the
  server analysis was byte-identical before and after. The unit tests and export golden files pass
  unchanged. The new box pre-checks also have property tests.

Scripts (not in the repo): `bench-api.mjs`, `bench-domain.ts`, `gen.ts`, `seed-perf.ts`,
`bundle.mjs` in the perf scratch folder.

## API latency (ms)

| Request | Before p50 / p95 | After (this branch) p50 / p95 | After + requested route changes p50 / p95 |
|---|---|---|---|
| GET /api/auth/me (session lookup only) | 7.1 / 16.7 | 6.2 / 10.8 | 9.1 / 16.0 |
| GET /api/missions (50 missions) | 15.9 / 23.9 | 11.9 / 18.4 | 18.9 / 25.0 |
| GET /api/missions/:id (small) | 14.7 / 29.0 | 10.8 / 16.8 | 17.5 / 30.3 |
| GET /api/missions/:id (2,000 wp, 50 zones) | 74.8 / 99.1 | 61.9 / 82.1 | 81.9 / 102.9 |
| PATCH name only (small mission) | 28.5 / 45.3 | 22.1 / 35.1 | 26.1 / 57.2 |
| PATCH full document (small mission) | 37.5 / 54.2 | 30.8 / 56.7 | 36.9 / 76.1 |
| **PATCH 2,000 wp + 50 zones** | **915 / 1,161** | **543 / 683** | **548 / 679** |
| PATCH 2,000 wp + 50 zones, `Prefer: return=minimal` | 854 / 1,167 (604 KB reply) | n/a | 541 / 697 (0.3 KB reply) |
| **Autosave of a rename on the 2,000-wp mission** (items omitted) | **401 / 1,493** (the old client always sent everything) | n/a | **92 / 158** |
| GET export plan / waypoints / kml (2,000 wp) | 70 / 68 / 62 | 82 / 80 / 80 | 81 / 83 / 91 |
| GET export geojson / csv / json (2,000 wp) | 77 / 76 / 94 | 77 / 67 / 75 | 83 / 63 / 67 |
| **POST import .plan (2,000 wp)** | **1,057 / 1,545** | **605 / 818** | **449 / 521** |

The "after (this branch)" column comes from a separate run at a lower machine load than the other
two columns, so compare the large rows. The "after + requested route changes" column is this branch
plus the two route edits requested from sec (see below). Those edits were applied only in a scratch
build to measure them. The same-load before/after pairs are columns 1 and 3.

Where the 2,000-waypoint save time went, in process (before → after):

| Step | Before | After |
|---|---|---|
| `computeMissionSummary` incl. zone sampling (result was always overwritten) | 140 ms | skipped unless the domain analysis fails |
| `analyseMission` (metrics + validator) | 75 ms | 10–18 ms |
| `deleteAll()` returning and decoding 2,000 old waypoint rows | ~15 ms | `deleteAndCount()` |
| `update()` pre-select + RETURNING row (×2) | 2 round trips extra | `updateAndCount()` |
| Re-read of the full mission by the route after the save | ~40 ms | available from `saveMissionDocument()` (route change requested) |
| **Total `saveMissionDocument`** | **~600–670 ms** | **~270 ms** (idle), ~360 ms (loaded) |

Most of what remains is ORM work for the 2,000-row multi-insert (parameter collection and encoding
for about 38,000 bind values) and about 60 ms of Postgres time for the insert itself.

Session lookup: before, every `/api/*` call resolved the session twice, once in `proxy.ts` and once in
the handler. sec's `a21da31` makes the proxy check only that the cookie is present for API calls,
so each call now costs one indexed `tokenHash` lookup with the user joined. The lookup writes
`lastSeenAt` at most every 5 minutes.

## Domain algorithms (median ms, 50 zones)

| Function | 500 before → after | 2,000 before → after |
|---|---|---|
| `optimiseRoute` (shuffled input) | **9,679 → 81** | **minutes → 484** (1,000 pts was 57 s) |
| `avoidZones` | 170 → 1.8 | **931 → 45** |
| `computeRisk` (runs on every editor change) | 76 → 1.3 | **322 → 4.2** |
| `validateMission` | 16 → 2.7 | 56 → 8.5 |
| server `analyseMission` | 14 → 2.8 | 61 → 9.8 |
| `computeMissionMetrics` | 0.3 → 0.3 | 1.0 → 1.1 |
| exporters (plan / waypoints / kml / geojson / csv / json) | 0.5–3.4, unchanged | 2–12, unchanged (linear) |
| importers (plan / waypoints / json) | 3.2–4.4, unchanged | 14–19, unchanged (linear) |
| `generateSurvey` 3×3 km at 20 m | 0.3 | – |
| `generateSurvey` 20×20 km at 1 m | built 20,000 passes | throws in under 1 ms (cap of 1,000 passes) |

## Client hot paths

| What | Before | After |
|---|---|---|
| Store edit on a 2,000-item mission (single waypoint) | 8.6 ms, all 2,000 items re-created | 2.9 ms, the other 1,999 items keep their identity |
| Heap after 120 edits (undo history of 100) | 91 MB | 31 MB |
| Mission analysis per edit | once per `useMissionAnalysis` caller (7 components) | once per snapshot (shared WeakMap cache) |
| Autosave fingerprint | 3 × `JSON.stringify` of the whole document per save cycle | once per snapshot (cached) |
| Autosave body, 2,000 wp + 50 zones | 625 KB on every save | full 537 KB (no item ids); rename 0.4 KB; one waypoint moved 510 KB (zones omitted) |
| Autosave reply | 604 KB full mission | 0.3 KB once the API honours `Prefer: return=minimal` (requested) |
| Terrain profile | a rename or zone edit during a lookup aborted it and restarted the 1.2 s debounce; 4–5 chunks fetched one after another | the lookup is kept while the sampled route is unchanged; chunks are fetched in parallel; aborted on route change and on unmount |
| Agents' server elevation cache | unbounded `Map` | capped at 20,000 entries, oldest evicted first |

## Bundle size (first-load client JS per route, gzip)

Built with `next build --webpack`. Each figure is the root main files plus every chunk the route's
client reference manifest lists.

| Route | Before | After |
|---|---|---|
| /missions/[id] (editor) | 617 KB (2,102 KB raw) | **600 KB** (2,036 KB raw) |
| /dashboard | 395 KB | **377 KB** |
| /settings | 291 KB | **273 KB** |
| /login, /signup, /reset-password | 209 KB | 209 KB |
| /forgot-password | 201 KB | 201 KB |
| /verify-email | 180 KB | 180 KB |
| /, /mission-planner, /_not-found | 173 KB | 173 KB |

Change: `@/lib/domain/zones` no longer re-exports the zod `zoneInputSchema`, so zod is in no client
chunk now. Before, it shipped to the editor, dashboard and settings.

Heaviest client chunks after the change:

| Chunk | gzip | Routes | Contents | Recommendation |
|---|---|---|---|---|
| `cb912e20…` + `0fd7fb0d…` | 140 + 132 KB | editor | maplibre-gl (runtime + style spec) | Load the map with `next/dynamic(…, { ssr: false })` behind the editor skeleton (qa) |
| `2862…` | 65 KB | all | Next.js client runtime | none |
| `ac723545…` | 62 KB | all | react-dom | none |
| `6349…` | 56 KB | dashboard, editor | motion + react-aria + lucide | Use `LazyMotion`/`m` with `domAnimation` (qa) |
| `4483…` | 36 KB | 3 | react-aria widgets | none |
| `9733…` | 25 KB | editor | react-aria (editor dialogs) | Lazy-load the dialogs (template picker, shortcuts, param table) (qa) |
| `app/missions/[id]/page-…` | 53 KB (158 KB raw) | editor | editor UI, including `AgentConsole`, which `editor-shell.tsx` imports statically | Lazy-load the assistant console when it is opened (qa) |

## What changed (commits on task/h-perf)

1. `perf(plan)`: candidate-list 2-opt/Or-opt above 120 points (neighbour lists, flat arrays,
   sweep cap). Routes of 120 points or fewer use the unchanged exact search.
2. `perf(zones)`: padded bounding boxes on `LocalZone`, used to pre-check point and segment tests.
3. `perf(risk)`: projects each zone once and skips zones whose box gap cannot lower the minimum clearance.
4. `perf(avoid)`: buffers each zone once and answers clear legs without buffers. The visibility test
   checks the box first.
5. `perf(missions)`: `deleteAndCount`/`updateAndCount`, zone sampling only for the fallback summary,
   ownership checked in SQL, and saves/creates return the stored row.
6. `perf(autosave)`: sends only the changed parts, drops item ids, sends `Prefer: return=minimal`,
   and caches the serialisation per snapshot.
7. `perf(editor)`: one mission analysis shared by all inspector components.
8. `perf(terrain)`: keeps a same-route lookup alive and fetches chunks in parallel.
9. `perf(store)`: structural sharing in place of a deep clone per edit; `resequenceStable`.
10. `perf(survey)`: caps passes at 1,000 (2,000 waypoints, the mission limit).
11. `perf(terrain-service)`: bounded elevation cache.
12. `perf(missions)`: the list query selects only the summary columns.
13. `perf(bundle)`: zod kept out of the client.

## Follow-ups

- **sec** (requested in `signals/h/requests.md`): the PATCH route should use the row returned by
  `saveMissionDocument()` and honour `Prefer: return=minimal`. Create, import and duplicate should
  use `createMissionWithDocument()` / `duplicateMissionDocument()`. `getSession` should select only
  the user columns it returns rather than the whole `User` row with `passwordHash`.
  `getCurrentUser`/`getCurrentSession` should be wrapped in React `cache()`.
- **qa**: lazy-load maplibre, the assistant console and the editor dialogs (table above). Replace
  whole-store subscriptions (`const { … } = useUIStore()` in plan-panel-host, checks-tab,
  item-tab, settings-tab, waypoints-tab, editor-header, template-picker; `useSaveStore()` in
  save-indicator; `useAgentStore()` in the agent console) with selectors (`useShallow`), so that
  UI-only state changes stop re-rendering them.
- Large saves: if 2,000-waypoint saves need to go below about 0.3 s, replace the ORM multi-insert
  for waypoints with one `INSERT … SELECT FROM unnest($1::…[])` statement. This needs no schema
  change.
- Indexes: none needed. Every hot query uses an existing index (`Session.tokenHash` unique,
  `Mission(userId, updatedAt)`, `Waypoint(missionId)`, `Zone(missionId)`).
