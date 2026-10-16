# Flight Deck: Design Spec (overhaul)

Status: **Approved defaults, in build** · Baseline: `feature/revamp` (PR #1) · Branch: `feature/design-overhaul`
Companion docs: [PRODUCT_SPEC](PRODUCT_SPEC.md), [TECHNICAL_SPEC](TECHNICAL_SPEC.md), [IMPLEMENTATION_PLAN](IMPLEMENTATION_PLAN.md) (Phase 13), [EXECUTION_PROMPT](EXECUTION_PROMPT.md)

## 1. Goal

Make Flight Deck look like a serious aerospace planning tool, not an AI demo. One coherent system across the landing page, auth, dashboard, settings and the map editor. The behaviour, URLs, APIs and data stay exactly as they are; this is a visual, layout and copy overhaul.

**What the owner asked for:** clean, tasteful, decluttered; remove the "AI-native" feel; use the listed design skills and component libraries; take cues from Outcrowd, Shield AI, Gallatin AI and Supermemory.

### 1.1 What reads as "AI-native" today (Verified in code)

| Pattern | Where |
|---|---|
| Blurred accent blob and radial-masked grid behind the hero | `src/components/marketing/hero.tsx` |
| Sparkle icon and "Flight Deck AI" feature card; ATLAS/SENTINEL branding on the landing page and FAQ | `marketing/features.tsx`, `safety.tsx`, `faq.tsx` |
| `GradientText`, `TiltCard`, parallax and blur-in reveals | `components/arc/arc.tsx` exports, `components/motion/*` |
| "Ask AI" as a primary header button with accent styling | `editor/editor-header.tsx`, `marketing/product-mock.tsx` |
| Matrix green `#00ff41` as the product accent, cyan/blue glows, `shadow-*` on most surfaces (70 uses) | `app/globals.css`, components |
| Rounded-2xl cards with soft shadows everywhere | 12 uses of `rounded-2xl` |

### 1.2 Decisions taken (defaults; owner can override)

- **D-10 Visual direction: "flight-plan paper".** Monochrome, cartographic, exact numbers and units, small mono labels, one signal colour. Gallatin gives the cartography, Shield AI the HUD restraint, Supermemory the documentation-grade type and honest data, Outcrowd the bento of real product fragments.
- **D-11 The AI assistant stays, demoted.** The feature keeps working. It moves out of the header's primary slot into a quiet "Draft from description" entry in the editor's overflow menu and the command palette. It is renamed "Assistant" in the UI; ATLAS/SENTINEL names leave user-facing copy (SENTINEL's checks become "Pre-flight checks"). The landing page mentions it once, in the FAQ.
- **D-12 Light is the default theme everywhere, dark is a full peer.** Field use in daylight favours light; the toggle stays and is remembered.
- **D-13 Fonts: Geist Sans and Geist Mono** (`geist` npm package, self-hosted through `next/font`). Inter and JetBrains Mono are removed.
- **D-14 Icons stay Remix Icon (line set).** Swapping the whole set costs more than it buys. Banned: sparkle, magic, wand, brain, robot, star-glow icons.
- **D-15 Component libraries:** BoardUI and ARC UI stay the base (already vendored). Vengeance UI, 21st.dev and ThreeUI are allowed only for the specific pieces listed in §7, after a licence check, and never their glow, gradient, shimmer or 3D-orb pieces.
- **D-17 Skill conflicts resolved:** the listed skills disagree in places. Rules used: no eyebrow labels above every heading (mono caps only for table headers and map/telemetry labels); tabular numbers in the sans face, mono only for literal coordinates, IDs and file extensions; no cockpit costume, the aerospace world contributes type, palette, density and one signature move (the contour-and-route figure); taste-skill rules apply to the landing page, impeccable "Operate" rules to the app. Full digest: `design/skills/SUMMARY.md` in the build workspace, summarised in §9.
- **D-16 Brand mark:** a simple wordmark "Flight Deck" in Geist Mono 500 with a 2-stroke route glyph. No gradient logo.

## 2. Principles

1. **The product is the picture.** Real UI, real maps, real numbers. No illustration that the app could not draw itself.
2. **One accent per view.** Signal orange marks the primary action, the selected waypoint and the active route. Nothing else is orange.
3. **Hairlines over shadows.** 1px lines separate things; shadows only on floating map panels and menus.
4. **Numbers are data.** Tabular figures in the sans face, units always shown (m, m/s, km, min, %); mono only for coordinates, IDs and file extensions.
5. **Quiet motion.** Motion confirms an action or reveals a section once. Nothing loops, nothing follows the cursor.
6. **Say the job, not the technology.** Concrete nouns (waypoints, geofence, AGL, .plan, KML). "AI" appears at most once on the landing page.
7. **Dense where it is a tool, spacious where it is a story.** Editor and dashboard at 14px; marketing at 16–18px with 96–128px section gaps.

## 3. Tokens

Implemented once in `src/styles/theme.css` (BoardUI semantic layer) and `src/app/globals.css` (app layer). Components use **semantic** tokens only; no raw hex in components.

### 3.1 Colour

| Role | Token (new semantic name) | Light | Dark |
|---|---|---|---|
| Page | `--fd-bg` → `background-full` | `#F5F4F0` | `#0A0B0D` |
| Surface (cards, panels) | `--fd-surface` → `background-primary-default` | `#FFFFFF` | `#111316` |
| Inset (table header, map chrome) | `--fd-surface-2` → `background-secondary-default` | `#EDECE7` | `#171A1E` |
| Hover | `--fd-surface-3` → `background-*-hover` | `#E4E2DC` | `#1E2227` |
| Hairline | `--fd-line` → `border-*-default` | `#DAD8D1` | `#24282E` |
| Strong line (inputs) | `--fd-line-strong` | `#B9B6AD` | `#353A42` |
| Text primary | `--fd-ink` → `text-primary` | `#0E1013` | `#EDEDEA` |
| Text secondary | `--fd-ink-2` → `text-secondary` | `#4A4D52` | `#A3A7AD` |
| Text tertiary / labels | `--fd-ink-3` → `text-tertiary` | `#6B6E73` | `#7E838A` |
| Accent (signal orange) | `--fd-accent` → `accent-500/600` ramp | `#C63B15` (darkened from #E0461C for 4.5:1 label contrast) | `#FF5A2B` |
| On accent | `--fd-accent-ink` | `#FFFFFF` | `#0A0B0D` |
| Accent tint (selected row) | `--fd-accent-tint` | `#FBE6DE` | `#2A1610` |
| Info / map overlay (cobalt) | `--fd-info` | `#1F5FD6` | `#5B8CFF` |
| OK | `--fd-ok` | `#1E7F4F` | `#3FBF7F` |
| Warning | `--fd-warn` | `#B7791F` | `#E3A63B` |
| Danger | `--fd-danger` | `#B42318` | `#F0574A` |

- The BoardUI accent ramp (`--color-accent-50…950`) is re-pointed to an orange ramp built around `#C63B15` (light) so every BoardUI control picks it up. The primary button **gradient is removed**: solid accent fill.
- The legacy editor tokens (`--color-bg-base`, `--color-green`, `--color-text-dim`, …) are re-pointed to the new semantic values so nothing breaks, then removed from components during the editor pass. `--color-green` must no longer be `#00ff41`.
- **Map colours** (`src/components/map/map-colors.ts`): route line = accent, 3px, with a 1px surface-coloured casing; waypoints = 22px circles, surface fill, ink 1.5px stroke, mono number; selected = accent fill, accent-ink number; takeoff/RTL = ink square/diamond; keep-out zone = danger 12% fill + 1.5px danger dashed stroke; keep-in = info 8% fill + info stroke; survey preview = info 1px lines. Contrast checked on both vector and satellite basemaps (casing makes it legible on satellite).
- Contrast: all text pairs meet WCAG AA (4.5:1 body, 3:1 for ≥18px and UI glyphs). Verify `ink-3` on `surface-2` in both themes.

### 3.2 Type

| Style | Size / line | Weight | Use |
|---|---|---|---|
| display-1 | 64/68, −0.03em | 500 | landing H1 (desktop) |
| display-2 | 48/52, −0.025em | 500 | landing H1 (mobile), section heads (desktop) |
| title-1 | 32/38, −0.02em | 500 | section heads (mobile), page titles |
| title-2 | 24/30, −0.015em | 500 | card titles on marketing, dialog titles |
| title-3 | 18/26 | 500 | panel titles |
| body-lg | 18/28 | 400 | marketing lead |
| body | 16/24 (app 14/20) | 400 | default |
| small | 13/18 | 400 | helper text |
| label-mono | 11/14, +0.06em, UPPERCASE | 500 | table headers, map/telemetry labels, figure captions (not section eyebrows) |
| data-mono | 13/18, tabular | 400 | coordinates, IDs, file extensions |

- Geist Sans for everything else; weights 400 and 500 only (600 allowed for numbers in stat tiles). Never 700+.
- `font-variant-numeric: tabular-nums` on every number in the app.
- Reading width max 64ch; headlines `text-wrap: balance`, paragraphs `text-wrap: pretty`.
- The existing BoardUI typography utilities (`text-display-*`, `text-title-*`, `text-body-*`, `text-caption-*`) keep their names and are re-valued to this scale so call sites keep working; add `text-label-mono` and `text-data-mono`.

### 3.3 Space, grid, radius, elevation

- Spacing: 4px base (4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96, 128).
- Marketing: 12-col grid, max 1200px content, 24px gutters, 16px side gutter on phones, 96px (mobile 64px) between sections, hairline dividers instead of tinted bands.
- App shell: 56px top bar; dashboard content max 1280px; editor = map + 360px inspector (resizable 320–480) + 48px tool rail + 32px status bar.
- Radius: marketing buttons, inputs, frames **2px**; app controls and cards **6px**; dialogs, menus and floating map panels **10px**; pills and dots full. No `rounded-2xl` anywhere.
- Elevation: none by default. `--fd-shadow-float: 0 1px 2px rgb(0 0 0/.06), 0 8px 24px rgb(0 0 0/.08)` (dark: `0 0 0 1px var(--fd-line), 0 8px 24px rgb(0 0 0/.5)`) for menus, popovers, floating map panels, dialogs only.
- **Corner ticks**: an `.fd-ticks` utility draws 8px L-brackets at the four corners of a frame (pseudo-elements, ink-3). Used on the hero product frame, the final CTA and featured figures only.

### 3.4 Motion

- Durations 120ms (hover/press), 200ms (popover, tooltip), 280ms (dialog, drawer), 480ms (section reveal, once). Easing `cubic-bezier(.2,.8,.2,1)`.
- Reveal = opacity 0→1 and 8px rise, once per element, stagger ≤ 60ms. No blur-in, parallax, tilt, marquee, scroll-jacking or looping glow.
- Hero: the route on the contour map draws once (stroke-dashoffset, 1.2s).
- `prefers-reduced-motion`: fades only, no draw-on.
- Remove from use: `GradientText`, `TiltCard`, `Parallax`, `SmoothScroll`, `TextReveal` blur variant, `Marquee` (static logo row instead). Keep `ScrollReveal` with blur set to 0, and `AnimatedNumber` for stat tiles.

## 4. Copy rules

- Lead with the job: "Plan survey and waypoint missions. Check them. Export files your ground station opens."
- Use the user's nouns: waypoint, leg, survey area, overlap, AGL, keep-out zone, .plan, .waypoints, KML.
- Real numbers with units; no unverifiable claims ("10x faster", "trusted by thousands"). If a number is shown it is a product limit or a measured fact (e.g. "Up to 2,000 waypoints", "6 export formats").
- Banned words in UI and marketing: "AI-powered", "magic", "supercharge", "unleash", "revolutionise", "seamless", "next-gen", emoji.
- Buttons are verbs: "Start planning", "New mission", "Export", "Run checks".
- Sentence case everywhere except `label-mono` eyebrows.

## 5. Surfaces

### 5.1 Landing page (`/`)

Order and content (top to bottom):

1. **Announcement bar** (optional, accent background, 32px): "Free during beta. Exports for Mission Planner and QGroundControl." Dismissible.
2. **Nav** (64px, hairline bottom): wordmark left; sentence-case links (Product, How it works, Formats, FAQ); right: "Sign in" text link and a square primary "Start planning" button. Mobile: a sheet menu.
3. **Hero** (left-aligned, 12-col: text 6 cols, figure 6 cols on desktop; stacked on mobile): no eyebrow pill; H1 display-1 "From an area on the map to a mission file you can fly."; lead body-lg (≤ 2 lines desktop); primary + secondary buttons; a mono fine-print line. Background: a **cartographic SVG** (contour lines, graticule, range ring) in ink-3 at low contrast, with an orange route drawing through numbered waypoints. The figure is a **real product frame** (the existing `ProductMock` rebuilt with the new tokens, or a screenshot) inside an `.fd-ticks` frame.
4. **Formats strip**: hairline-bounded row "Exports to" + mono format chips (.plan · .waypoints · KML · GeoJSON · CSV · JSON) and "Opens in Mission Planner · QGroundControl". Static, no marquee.
5. **How it works**: Draw, Check, Export as a real `<ol>` sequence (Gallatin), each with a title-2, two-line body and a monochrome line diagram (SVG, hairline, accent only on the route).
6. **Capabilities bento** (Outcrowd, but calm): 2×3 grid on desktop of cards separated by tone steps and hairlines (not identical icon cards), each with a title-3, one sentence and a **real UI fragment** (survey grid preview, route-optimise before/after distance, zone conflict highlight, terrain profile chart, export menu, checks list). No icon tiles.
7. **Spec table / numbers** (Supermemory): a figure with real product limits and facts (tabular numbers, `label-mono` caption) (waypoints per mission, export formats, check types, time-on-route model) with "Fig. 1" caption.
8. **Pre-flight checks** (replaces "Safety"/ATLAS-SENTINEL): what is checked on every edit (altitude limits, terrain clearance, zone intersections per leg, battery/time estimate, DO_JUMP validity). The assistant is not mentioned here.
9. **FAQ**: ARC accordion restyled with hairlines; includes one answer about the optional assistant ("Is there an assistant? Yes, optional; it drafts, you approve.").
10. **Final CTA**: `.fd-ticks` frame, H2 + one primary button.
11. **Footer**: multi-column links, mono legal line, a small status dot "All systems normal" only if wired to something real; otherwise omitted.

### 5.2 Auth (`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`)

- Split layout on desktop: left 5 cols = form card (surface, hairline, 6px radius, 400px max); right 7 cols = the same contour/route figure with a mono caption. Mobile: form only, wordmark on top.
- Inputs 40px, 6px radius, strong-line border, accent focus ring (2px, offset 2). Errors in danger with an icon. Password rules as a quiet checklist.
- No social buttons unless the backend supports them (it does not today: Verified, home-grown auth only), so remove the BoardUI social buttons if rendered.

### 5.3 Dashboard (`/dashboard`)

- Top bar (56px): wordmark, primary nav (Missions, Settings), search (⌘K opens command palette), account menu with theme toggle.
- Page header: title-1 "Missions", count as tabular number, actions right: "Import" (secondary), "New mission" (primary).
- Toolbar: search field, sort select, **view toggle Grid / Table** (segmented control; remembered in localStorage).
- Grid: cards with the route thumbnail on an inset map-paper background (graticule lines), name, tabular stats row (waypoints, km, min), status dot + label ("Ready", "2 issues"), updated time. Hairline cards, 6px radius, hover = line-strong border, no lift.
- Table: BoardUI table, columns Name, Waypoints, Distance, Est. time, Checks, Updated, actions; mono numbers right-aligned.
- Empty state: a small line-art route figure, "No missions yet", primary "New mission" and secondary "Import a .plan file".
- Skeletons match the final layout; toasts bottom-right.

### 5.4 Editor (`/missions/[id]`)

- **Header (48px)**: back to Missions, inline-editable name, save indicator (mono, "Saved 12:04"), then right side: Undo/Redo, Checks summary chip (ok/warn/danger dot + count), **Export** (primary, the one accent button), overflow menu (Template, Draft from description, Shortcuts, Settings). Max 8 controls (PRODUCT_SPEC rule).
- **Tool rail (48px, left)**: icon buttons with tooltips and shortcut hints: Select, Waypoint, Survey area, Zone, Measure; separator; Map/Satellite toggle; Fit route. Active tool = ink fill, surface icon (not accent).
- **Map**: full-bleed, MapLibre attribution visible bottom-right in small type; coordinates readout bottom-left in `data-mono`; floating panels (plan panel, tool hints, context menu) use 10px radius + float shadow.
- **Inspector (right, 360px)**: tabs Waypoints / Item / Checks / Settings as a segmented control; dense 14px rows, 32px row height, mono numbers; selected row = accent-tint background + 2px accent left rule.
- **Status bar (32px)**: distance, est. time, waypoint count, max altitude, all tabular numbers, separated by hairlines.
- **Terrain profile**: area chart in ink-3 line + surface-2 fill, terrain in warn when clearance < limit, waypoints as ticks.
- **Assistant** (D-11): opened from the overflow menu or ⌘K "Draft from description"; renders as a right-side drawer using the same panel style; no gradient, no orb loader (use a plain progress line); the audit section is titled "Pre-flight checks".
- Mobile (≤ 768px): map full-screen, inspector becomes a bottom sheet with 3 snap points, tool rail becomes a bottom toolbar.

### 5.5 Settings (`/settings`)

Single column (max 720px), sections separated by hairlines with title-3 headings: Profile, Password, Sessions, Danger zone (danger outline, hold-to-confirm delete).

### 5.6 System states

`not-found.tsx` and `error.tsx` at app root (new): wordmark, mono error code, one sentence, one button. Loading: skeletons, never spinners over full pages.

## 6. Accessibility and quality bars

- WCAG 2.2 AA: contrast as in §3.1, visible focus ring (2px accent, 2px offset) on every interactive element, hit targets ≥ 32px in the editor and ≥ 44px on touch.
- Keyboard: every tool and menu reachable; existing shortcuts kept and listed in the Shortcuts dialog.
- No layout shift from fonts (next/font with `display: swap` and size-adjust).
- Lighthouse mobile on `/`: Performance ≥ 90, Accessibility ≥ 95 (Needs confirmation on a real deploy; container can't reach map hosts).
- No horizontal scroll at 390px on any page.

## 7. Component sourcing

| Need | Use | Source |
|---|---|---|
| Buttons, inputs, select, tabs, switch, checkbox, tooltip, dropdown, table, badges, kbd, avatar | BoardUI (vendored `src/components/base/*`), restyled through tokens | in repo |
| Accordion (FAQ), FeatureCard, CtaBanner, AnimatedNumber | ARC UI React (`src/components/arc/arc.tsx`) with `arc-tokens.css` re-pointed to the new tokens | in repo |
| Segmented control (view toggle, Map/Satellite, inspector tabs) | BoardUI `segmented-control` | in repo |
| Command palette (⌘K) | build on react-aria `Autocomplete`/`Menu` already installed, styled per spec; Vengeance `search-modal` as a visual reference only | in repo |
| Bottom sheet (mobile inspector) | ARC `bottom-sheet` via `@uiarc` registry if it installs cleanly; else a small vaul-free CSS sheet | ARC registry |
| Stats counter, logo row | ARC `AnimatedNumber`; static row | in repo |
| Contour hero figure, line diagrams | hand-built SVG components in `src/components/marketing/figures/` | new |

Not used: 21st.dev glow/shimmer/beam/aurora items, ThreeUI scenes, BoardUI agent loaders, Vengeance glow cards.

## 8. Acceptance criteria

1. No `#00ff41`, `blur-3xl`, `bg-gradient-*`/`linear-gradient` on UI chrome, `GradientText`, `TiltCard`, sparkle icons, or "AI-powered" copy remain (`rg` check in CI-able script `scripts/design-lint.sh`).
2. Every page renders correctly in light and dark at 390, 1024 and 1440px wide (screenshots in `docs/screenshots/overhaul/`).
3. All existing behaviour still works: login, create mission, add waypoint, autosave, reload persists, survey, optimise, zones, checks, every export, import, settings actions, assistant draft-and-approve.
4. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration`, `pnpm build` all pass.
5. Header ≤ 8 controls; one accent-filled control per view.
6. Fonts are Geist/Geist Mono; no Inter/JetBrains Mono requests.

## 9. Skills used and how

| Skill | Used for |
|---|---|
| impeccable (`operate`, `mode-operate`, `craft-floor`, `layout`, `polish`) | Dashboard, editor, settings: density, states, restraint |
| redesign-existing-projects (taste-skill) | Process: scan, diagnose, fix in order (tokens, palette, states, layout, components, empty/error, polish), verify by screenshots |
| design-taste-frontend v2 + `tells.md`, `copy.md` | Landing page only: AI tells to remove, copy rules |
| frontend-design (Anthropic) | Direction and the one signature move |
| design-system-patterns | Token tiers (primitive, semantic, component), theming |
| ui-ux-pro-max quick reference | Accessibility and interaction checklist |
| ECC `frontend-design-direction`, `design-quality`, `accessibility` | Screen-state contract (loading, empty, error, partial, success, permission) and the rendered-screenshot check |

Not run (safety): impeccable's closed-source launcher and hooks, ECC's installer and hooks, taste's asset-fetching scripts. `taste lint.mjs` (read-only) may be run against `src/`.
