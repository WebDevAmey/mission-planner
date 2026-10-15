# Mission Planner: Product Specification

Status: **Draft for review** · Baseline commit `0f7aab3` (`main`, 2026-10-15) · Companion docs: [TECHNICAL_SPEC](TECHNICAL_SPEC.md), [IMPLEMENTATION_PLAN](IMPLEMENTATION_PLAN.md), [DECISIONS](DECISIONS.md)

Evidence labels used throughout:
- **Verified**: observed in the repository or by a command that was run.
- **Inferred**: likely from the code, but not exercised end to end.
- **Proposed**: a recommendation for the target state.
- **Needs confirmation**: a decision for the owner.

---

## 1. Product summary

Mission Planner (branded "Flight Deck" on the dashboard and landing page, "MPS" in the editor) is a web planner for ArduPilot vehicles. A signed-in operator creates missions, places waypoints on a map, checks them against limits, no-fly zones and terrain, and exports a file for a ground station or autopilot. It also includes an AI drafting assistant: ATLAS writes the draft and SENTINEL, a set of fixed safety rules, checks it.

**Target user (Proposed, Needs confirmation):** commercial and prosumer multirotor operators who plan survey, inspection, patrol and delivery flights and then fly them in Mission Planner or QGroundControl. The planner supports MAVLink fixed-wing commands, but every template and default assumes a small multirotor.

**Go-to-market position (Proposed):** the fastest way to get from "area on a map" to a validated, ground-station-ready mission file, with the safety checks visible instead of hidden.

## 2. Current state at a glance (Verified unless marked)

| Capability | Status | Evidence |
|---|---|---|
| Signup, login, logout, sessions | Existing | `src/app/api/auth/*`, `src/lib/auth/session.ts` |
| Email verification, forgot and reset password | Existing (delivery needs `RESEND_API_KEY`) | `src/lib/email/send.ts` |
| Dashboard listing your missions | Existing, basic | `src/app/dashboard/page.tsx` |
| Create, open, duplicate, delete a mission | Existing | `src/app/api/missions/**` |
| **Save waypoints to the server** | **Broken.** Any mission with one or more waypoints fails to save. | See §2.1 |
| Map editing: add, drag, remove waypoints; set home | Existing | `src/components/map/map-view.tsx` |
| Waypoint table: inline edit, reorder, bulk delete | Existing | `src/components/flight-plan/waypoint-table.tsx` |
| Undo and redo | Existing, in memory only | `src/lib/store/mission-store.ts` |
| No-fly zones (circles) | Existing, but stored in the browser only and shared by every mission | `constraints-store.ts` (localStorage) |
| Geofences (keep-in and keep-out polygons and circles) | **Partial.** Data model and checker exist, but nothing draws or shows them. | `geofence-store.ts`; no renderer in `map-view.tsx` |
| Polygon and Measure tools | **Non-functional.** The buttons exist but clicking the map does nothing. | `map-toolbar.tsx`; no handlers in `map-view.tsx` |
| Geofence and Terrain buttons | The Geofence toggle renders nothing; Terrain works. | `ardupilot-layout.tsx` renders only `TerrainPanel` |
| Export | **Partial.** The UI offers only a custom "MPS v1 JSON". `.plan` and `.waypoints` builders exist but no UI reaches them. | `ardupilot-layout.tsx`, `mission-builder.ts` |
| Route "Optimise" and "Alternatives" | Existing, heuristic | `route-optimizer.ts` |
| Templates | Existing, but **loading one blanks the editor** (§2.1) | `template-picker.tsx` |
| In-editor Mission library and Organisation switcher | Legacy, browser-only; **conflicts with server missions** (§2.1) | `mission-library-store.ts`, `tenant-store.ts` |
| Terrain profile | Existing, but the clearance maths is wrong when home is not at sea level (§2.1) | `terrain-panel.tsx` |
| Flight Deck (ATLAS + SENTINEL) | Existing | `src/lib/agents/*`, `/api/flight-deck` |
| Account settings and account deletion | Missing | none |
| Automated tests and CI | Missing | no test script, no `.github/` |

### 2.1 Defects found during the audit (Verified)

1. **Waypoints never reach the database.** `useAutosaveMission` sends `mission.items` straight to `PATCH /api/missions/:id`. Those items carry `parameters: {param1..param7}`, but `waypointInputSchema` expects `param1..param7` as flat fields. Checked by parsing the editor's item shape with `updateMissionSchema`: 0 waypoints passes, 1 waypoint fails with `items.0.param1: expected number, received undefined`. The user sees "Could not save", and their work is lost on reload.
2. **The editor goes blank** after choosing a template, creating or loading a mission from the in-editor library, or switching organisation. Each of these calls `loadMission()` with a mission that has a new id. `mission-planner/page.tsx` then returns `null` because `mission.id !== missionId`.
3. **Browser-only data leaks between accounts on a shared browser.** `LibraryBridge` copies every server mission into the `mps-mission-library` localStorage key, and no-fly zones, geofences, organisations and Flight Deck prompt history are also stored in localStorage. None of it is cleared on logout or tied to a user.
4. **Terrain-panel clearance compares relative altitude with sea-level elevation.** It computes `flightAlt - terrainElev`. Altitudes use frame `GLOBAL_RELATIVE_ALT`, so a site at 1,600 m elevation flags every point. SENTINEL already does this correctly by subtracting the elevation delta from home.
5. **The `.plan` export sets `firmwareType: 12`**, which is PX4. ArduPilot is `3`. It is unreachable today but must be fixed before it is exposed.
6. **"Optimise" breaks `DO_JUMP` targets.** It reorders items without remapping `DO_JUMP` param1. It also pushes one undo step per moved item.
7. **No-fly zone and geofence checks test only waypoints and segment midpoints**, so a leg can cross a zone undetected.
8. **The vector and satellite map attributions are hidden** (`attributionControl: false`). OpenStreetMap, OpenFreeMap and Esri terms require visible attribution.

## 3. Scope

**MVP (this plan):** fix the defects above; one source of truth for missions on the server; a decluttered, map-first editor; correct and complete exports; real path-planning algorithms for survey and route ordering; account settings; tests, CI and a staged rollout.

**Later (out of scope for MVP):** team workspaces and real multi-tenancy, live vehicle telemetry and upload over MAVLink, fixed-wing-specific planning (turn radius, landing patterns), offline/PWA mode, billing, KML/KMZ and shapefile import, wind-aware energy models.

---

## 4. Information architecture (Proposed)

```
/                 Landing (marketing)
/login /signup /forgot-password /reset-password /verify-email
/dashboard        Missions list (default after login)
/missions/[id]    Editor (replaces /mission-planner?mission=[id]; old URL redirects)
/settings         Account: name, email, password, sessions, delete account
```

- One brand everywhere. **Needs confirmation:** "Flight Deck" or "MPS". Today `layout.tsx` metadata says "MPS Offline Mission Planner", the dashboard says "Flight Deck" and the editor says "MPS".
- Organisations are removed from the editor until real team support exists. See DECISIONS D-07.

## 5. Workflows

Each workflow lists the goal, entry point, happy path, failure cases, states, data changed, acceptance criteria (AC), and accessibility/responsive notes.

### W1. Sign up, verify, sign in, sign out (Existing, keep)
- **Goal:** get a secure account. **Entry:** `/signup`, `/login`.
- **Happy path:** sign up, which creates a session and sends a verification email, then lands on `/dashboard`.
- **Failures:** duplicate email (409), weak password (min 10 characters), rate limited (429), email not configured (a dev link appears only outside production).
- **States:** submitting, field errors, success.
- **Data:** `User`, `Session`, `EmailVerificationToken`.
- **AC:** existing behaviour is unchanged. Logout also clears all client-side mission data (new).
- **A11y:** labels linked to inputs; errors announced with `aria-live`.

### W2. Dashboard: find and manage missions (Existing, improve)
- **Goal:** see all saved missions, find one fast, act on it. **Entry:** `/dashboard`.
- **Happy path:** a list sorted by last edited; each card shows name, map thumbnail of the route, waypoint count, distance, estimated time, last edited, and validation status (Ready, Has warnings, Has errors, Empty).
- **Actions:** Open (primary), Rename, Duplicate, Export (menu), Delete (with confirmation).
- **New:** search by name, sort (Last edited, Name, Created), and a "New mission" button that opens a small dialog (name, plus optional template, plus optional starting location).
- **Failures:** load failure shows a Retry button; duplicate, delete or create failures show a toast with the reason (today they fail silently).
- **States:** skeleton cards while loading; empty state with "Create your first mission" and a template shortcut; error banner.
- **Data:** none on read; `Mission` on create, duplicate and delete.
- **AC:** every failed action shows a visible message. The list reflects create, duplicate and delete without a full reload. Status is computed from the same validator used by the editor.
- **Responsive:** 1 column under 640 px, 2 up to 1024 px, 3 above. Cards keep a 16 px gutter.

### W3. Edit a mission on the map (Existing, redesign: see §6)
- **Goal:** build a flyable route. **Entry:** Open from the dashboard.
- **Happy path:** the map fits to the route (or to the user's last area). Click to add a waypoint, drag to move, select to edit in the inspector, reorder in the list, set home.
- **Failures:** map tiles fail (show a banner; editing keeps working); search fails (inline message).
- **States:** loading skeleton; "No waypoints yet" hint over the map; saving, saved and failed in the header.
- **Data:** `Waypoint` rows and `Mission.home*`.
- **AC:** every edit persists within 2 s of the last change. Reloading shows exactly what was on screen. Undo and redo work across all edit types, and an AI-loaded draft is one undo step.
- **A11y:** every map action has a non-map path (table add and coordinate entry). Waypoints are focusable in the list, Delete removes the selected one, and focus is visible.

### W4. Save, restore and protect unsaved work (Broken, fix)
- **Goal:** never lose work.
- **Behaviour:** debounced autosave (about 900 ms) using the correct payload shape. A failed save retries with backoff and shows a persistent "Not saved, Retry" state. `beforeunload` warns while a save is pending or failed. On navigation inside the app, pending changes flush first.
- **Concurrency:** the save carries the version the client loaded. If the server version is newer (another tab), show "This mission changed elsewhere: Reload or Overwrite". See TECHNICAL_SPEC §5.3.
- **AC:** reload after any edit restores it. Editing in two tabs never silently overwrites without a prompt. Logging out and back in shows the same missions.

### W5. Limits, zones and validation (Partial, unify)
- **Goal:** know whether the mission is safe and legal to fly before export.
- **Behaviour:** limits (max distance, min and max altitude, max speed, min terrain clearance) are stored **per mission** on the server (`MissionSettings` already has the columns). Zones (no-fly circles plus keep-in and keep-out polygons and circles) are stored per mission on the server and drawn on the map. One validator produces issues with severity (error or warning), a human message, and a link to the affected waypoint.
- **UI:** a single "Checks" section in the right panel listing issues; clicking one selects the waypoint. The header shows a count badge (for example "2 errors"). Colour is never the only signal: icons and text accompany it.
- **AC:** a leg that crosses a zone is flagged even when both ends are outside. Terrain clearance uses home-relative maths. Export of a mission with errors requires an explicit "Export anyway".

### W6. Path planning (Existing heuristics, upgrade: see TECHNICAL_SPEC §7)
- **Survey (new):** draw an area polygon and choose camera or line spacing, overlap, angle, altitude and turnaround distance. The app generates a lawnmower (boustrophedon) pattern clipped to the polygon, with a waypoint count and time estimate before you apply it.
- **Optimise order (improved):** visits the same waypoints in a shorter order, keeps takeoff first and RTL/LAND last, keeps attached commands with their waypoint, remaps `DO_JUMP`, and is applied as one undo step. Shows "Saves 1.2 km (14%)" before you apply it.
- **Avoid zones (new):** "Route around zones" inserts the fewest extra waypoints needed so no leg crosses a keep-out zone or leaves a keep-in zone, with a preview.
- **Patterns (new, later in MVP):** orbit (POI circle) and corridor (along a polyline).
- **AC:** each algorithm previews before apply, applies as one undo step, and never produces a path that violates a zone it was told to respect.

### W7. Export (Partial, complete)
- **Goal:** get a file the ground station or autopilot accepts.
- **Formats (Proposed MVP):**

| Format | Use | Status |
|---|---|---|
| QGroundControl `.plan` (JSON) | QGC and Mission Planner import, including geofence | Builder exists; fix `firmwareType`, add fences and rally points, expose in UI |
| `QGC WPL 110` `.waypoints` | Mission Planner (ArduPilot) and MAVProxy | Builder exists; expose in UI |
| KML | Google Earth and sharing a visual route | New |
| GeoJSON | GIS tools | New |
| CSV | Spreadsheet review | New |
| MPS JSON (current v1) | Full-fidelity backup and re-import | Existing; keep |

- **Behaviour:** an Export menu in the editor header and on dashboard cards. Filenames look like `<mission-slug>_<yyyymmdd-hhmm>.<ext>`, sanitised for every OS. Errors are blocked unless the user confirms. The same builders run server-side as `GET /api/missions/:id/export?format=` so the dashboard can export without opening the editor.
- **Import (Proposed, MVP-stretch):** `.plan`, `.waypoints` and MPS JSON into a new mission.
- **AC:** golden-file tests for each format. A `.plan` loads in QGroundControl, and a `.waypoints` file loads in Mission Planner, with the same items, order and altitudes (manual check recorded in the release notes).

### W8. Flight Deck AI drafting (Existing, keep with guardrails)
- Keep ATLAS and SENTINEL. Add a per-user rate limit and daily quota, same-origin checks, and server-side auth inside the handler. SENTINEL uses the same unified validator as W5. "Approve & Load" is one undo step and autosaves. Prompt history moves to the server or is cleared on logout.

### W9. Account settings (Missing, add)
- `/settings`: change name; change password (requires the current one; signs out other sessions); list active sessions with "Sign out everywhere"; resend verification; delete account (requires password re-entry; cascades missions; irreversible, with a confirmation dialog).
- **AC:** each action is confirmed by a toast. Deleted accounts can't sign in, and their data is gone from the database.

---

## 6. Editor redesign: declutter and spacing (Proposed)

### 6.1 Findings (Verified from code)
- **The top bar is overloaded.** One 38 px row holds the brand, organisation switcher, mission name, AI prompt bar, undo, redo, Optimise, Alternatives, Templates, Missions, Timeline, Flight Deck, risk gauge, Export and Sign out (`ardupilot-layout.tsx` TopBar). A second 32 px row holds a single "Flight Plan" tab that does nothing.
- **Type is too small.** Text sizes in components cluster at 9–11 px (counted: 40 uses of `text-[9px]`, 33 of `10px`, 24 of `11px`, plus 5 each at 7 and 8 px). Toolbar labels are 7–8 px.
- **Contrast fails.** `--color-text-muted: #444` on `#0a0a0a` is about 2:1, far below WCAG AA (4.5:1).
- **Zoom is disabled.** `viewport` sets `maximumScale: 1, userScalable: false`, which fails WCAG 1.4.4.
- **Too much floats over the map.** The map stacks seven overlays: tool badge, mission info card, search box, zoom and style buttons, legend, no-fly zone list and distance pill. The Alternatives panel, toasts and save pill float on top of that.
- **Mission stats appear three times:** the summary strip, the risk gauge in the header, and the map info card.
- **Styling is inconsistent.** There are two colour systems in `globals.css` (terminal green `#00ff41` and a neutral shadcn palette), 106 inline `style={{}}` blocks and 75 hard-coded hex colours in components.
- **Some tools are dead:** Polygon, Measure and Geofence.

### 6.2 Target layout (desktop, 1280 px and wider)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ◀ Missions  │  Survey North Field ✎  · Saved     [Undo][Redo]  [Ask AI] [Export ▾] [⋯] │  56px header
├────┬───────────────────────────────────────────────────┬─────────────────┤
│Tool│                                                   │ Inspector 320px │
│rail│                    MAP                            │  Tabs:          │
│ 48 │   (search top-left · zoom/layers bottom-right ·   │  Waypoints      │
│ px │    scale + attribution bottom)                    │  Selected item  │
│    │                                                   │  Checks (2)     │
│    │                                                   │  Settings       │
├────┴───────────────────────────────────────────────────┴─────────────────┤
│ 3.4 km · 6m 20s · 12 WPs · max 80 m · Risk Low · 0 errors  │ ▲ Terrain    │  40px status bar
└──────────────────────────────────────────────────────────────────────────┘
```

- **Header (56 px):** back to Missions, mission name (inline rename), save state, undo and redo, "Ask AI" (opens the Flight Deck drawer with the prompt inside it; it no longer sits in the header), Export menu, and an overflow menu (Templates, Duplicate, Delete, Shortcuts, Account, Sign out). The Organisation switcher, Timeline toggle, risk gauge and the dead "Flight Plan" tab are removed.
- **Tool rail (48 px, icons 20 px with tooltips and shortcut hints):** Select (V), Add waypoint (A), Draw area (P), Draw zone (Z), Set home (H), Measure (M). Each tool shows a one-line hint at the top of the map while active ("Click to add waypoints · Esc to finish").
- **Right inspector (320 px, collapsible):** replaces the bottom waypoint table, the Limits drawer and the floating no-fly zone list. Its tabs are Waypoints (compact reorderable list), Item (fields for the selected item, with labelled params instead of "P1–P4"), Checks, and Settings (defaults, limits, zones list).
- **Full parameter table:** available as an expandable bottom drawer for power users. It is hidden by default.
- **Status bar (40 px):** the single place for mission metrics and check counts. It replaces the summary strip, risk gauge, map info card and distance pill. The Terrain profile opens upward from here.
- **Map chrome:** only search (top-left), zoom/layers/fit (bottom-right), scale and attribution. The legend moves into the Layers popover.
- **Path tools:** Optimise, Alternatives, Survey and Avoid zones move into a "Plan" menu in the Waypoints tab, each with a preview and Apply/Cancel.

### 6.3 Visual system
- **Tokens:** one palette. Neutral surfaces (from the existing shadcn tokens) plus one accent and semantic colours: success, warning, danger, info. The neon `#00ff41` is retired from UI chrome and kept only, softened, for the route line if the brand wants it.
- **Type scale:** 12 / 13 / 14 / 16 / 20 / 24 px. The minimum UI text size is 12 px, and 11 px is allowed only for tabular numbers. Inter is used for UI; JetBrains Mono only for coordinates and numbers.
- **Spacing:** a 4 px base grid. Panel padding is 16 px, gaps between controls 8 px, and section separation 24 px. Every interactive target is at least 32 px (desktop) and 44 px (touch).
- **Contrast:** all text meets WCAG AA. Muted text is no darker than about `#8a8a8a` on the base background.
- **Consistency:** no inline styles or hard-coded hex values in components; everything goes through tokens and the `ui/` primitives.

### 6.4 Responsive
- **1024–1279 px:** the inspector overlays the map as a drawer, toggled from the header.
- **Tablet (768–1023 px):** the rail moves to the bottom; the inspector becomes a bottom sheet.
- **Under 768 px:** view-and-light-edit mode: map, waypoint list sheet, export. A banner suggests desktop for full planning. Pinch zoom must work, so the viewport lock is removed.

### 6.5 States checklist (every screen)
Loading (skeleton), empty (with a primary action), saving, saved, error (with a retry and a reason), offline (tiles or terrain unavailable), and permission (signed out, redirect to login with `next`).

## 7. Non-goals
- Do not replace MapLibre or rebuild the map engine.
- Do not change working auth flows or URLs without a redirect.
- No redesign of the landing page in this plan.

## 8. Success metrics (Proposed, Needs confirmation)
- Zero lost-work reports. Save success rate above 99.5% (server logs).
- Median time from "New mission" to first export under 3 minutes for a 10-waypoint mission (moderated test with 5 users).
- Exported `.plan` and `.waypoints` files import into QGC and Mission Planner without edits in 100% of the golden test cases.
