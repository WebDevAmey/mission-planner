# Mission Planner

A modern, web-based mission planning application for ArduPilot-compatible autonomous vehicles (drones, planes, rovers, and boats). Built with Next.js 16 and React 19, Mission Planner provides an intuitive interface for creating, managing, and optimizing flight missions with real-time validation and advanced planning features.

## Features

### Core Planning Capabilities
- **Intuitive Mission Creation**: Drag-and-drop waypoint placement on interactive maps
- **Waypoint Management**: Add, edit, and organize mission waypoints with full parameter control
- **Multi-Format Support**: Export missions in JSON, .plan, and waypoints formats
- **Mission Templates**: Pre-configured mission templates for common scenarios
- **Undo/Redo**: Full undo/redo support for all mission modifications

### Advanced Features
- **Route Optimization**: Automatic route optimization and alternative route generation
- **Geofencing**: Define and enforce geofence boundaries for safety
- **Mission Constraints**: Set altitude, speed, and timing constraints
- **Risk Assessment**: Real-time risk scoring based on mission parameters
- **Mission Metrics**: Calculate flight time, distance, and other metrics
- **Terrain Analysis**: Terrain awareness and elevation data integration
- **Timeline View**: Visualize mission execution timeline
- **Sanity Checks**: Automated mission validation with warnings and errors

### User Experience
- **Real-time Map View**: Interactive map with zoom, pan, and satellite imagery
- **Waypoint Table**: Detailed waypoint listing with inline editing
- **Mission Summary**: Quick overview of mission statistics and health
- **Keyboard Shortcuts**: Full keyboard shortcut support for power users
- **Dark Mode**: Optimized dark theme for extended use
- **Responsive Design**: Works seamlessly on desktop and tablet devices

### Integration & Export
- **MAVLink Support**: Full MAVLink protocol support for ArduPilot compatibility
- **Mission Library**: Save and manage mission templates
- **Multi-Tenant Support**: Organize missions by tenant/organization
- **Mission History**: Track mission creation and modification history

### Flight Deck (agentic mission planning)
- **Natural-language mission drafting**: Describe a mission in plain English via the prompt bar in the top toolbar; **ATLAS** (an LLM agent) turns it into a waypoint list, geocoding named locations and consulting terrain data as needed.
- **Automated safety audit**: **SENTINEL** deterministically checks every draft against mission sanity rules, geofences, risk score, terrain clearance, and an assumed energy budget — implemented as plain code, not a second LLM call, so it can't be talked out of a blocker.
- **Veto loop**: SENTINEL can send a draft back to ATLAS for revision (up to 3 rounds) before giving up and asking for human input.
- **Human-in-the-loop approval**: Nothing is written to your mission until you review the draft and findings in the Agent Console and click **Approve & Load**.
- Requires an `ANTHROPIC_API_KEY` — see [Environment Variables](#environment-variables).

## Tech Stack

- **Frontend Framework**: [Next.js 16.2.2](https://nextjs.org/) with React 19
- **Language**: TypeScript 5
- **Styling**: [Tailwind CSS 4.2](https://tailwindcss.com/) with PostCSS
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) with Radix UI
- **State Management**: [Zustand 5.0](https://zustand-demo.vercel.app/)
- **Mapping**: [MapLibre GL 5.21](https://maplibre.org/)
- **Icons**: [Lucide React 1.7](https://lucide.dev/)
- **Animation**: [Framer Motion 12.38](https://www.framer.com/motion/)
- **Utilities**: UUID, class-variance-authority, clsx, tailwind-merge
- **Agentic Planning**: [LangGraph](https://langchain-ai.github.io/langgraphjs/) + [LangChain Anthropic](https://www.npmjs.com/package/@langchain/anthropic) + Zod
- **Build Tool**: Webpack (Next.js built-in)
- **Code Quality**: ESLint 9

## Prerequisites

- **Node.js**: 18.17 or later
- **Package Manager**: pnpm 10.30+ (recommended) or npm 10+
- **Git**: For version control
- **PostgreSQL**: 15 or newer, for accounts and server-persisted missions — see
  [Database & Authentication](#database--authentication)

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd mission-planner
```

### 2. Install Dependencies
Using pnpm (recommended):
```bash
pnpm install
```

Or using npm:
```bash
npm install
```

### 3. Verify Installation
```bash
pnpm dev
```

The application should start at [http://localhost:3000](http://localhost:3000)

## Development

### Starting the Development Server
```bash
pnpm dev
```

The app will open at `http://localhost:3000` with hot-reload enabled.

### Building for Production
```bash
pnpm build
```

This generates an optimized production build in the `.next` directory.

### Running Production Build Locally
```bash
pnpm start
```

### Linting
```bash
pnpm lint
```

### Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Copies the MapLibre worker, then starts the dev server on :3000 |
| `pnpm build` / `pnpm start` | Emits the database contract, copies the MapLibre worker, builds; then serves the build |
| `pnpm maplibre:worker` | Copies MapLibre 6's worker modules to `public/maplibre` (gitignored). `dev` and `build` run it; run it by hand if the map draws no route after `next start` |
| `pnpm lint` | ESLint (CI runs it with `--max-warnings=0`) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm design:lint` | Fails on banned design patterns in UI code (gradients, glow blobs, `rounded-2xl`, sparkle icons and similar; `docs/DESIGN_SPEC.md` §8.1). Needs ripgrep (`rg`) |
| `pnpm test` | Vitest unit tests (`tests/unit`) |
| `pnpm test:integration` | Route and database tests (`tests/integration`); needs `DATABASE_URL` pointing at a migrated scratch database |
| `pnpm test:e2e` | Playwright end-to-end tests (`tests/e2e`) against a production build: run `pnpm build` first, with a migrated and seeded database in `DATABASE_URL`. Starts `next start` on port 3100 unless `E2E_BASE_URL` is set. Install the browser once with `pnpm exec playwright install chromium` |
| `pnpm db:migrate` / `pnpm db:sign` / `pnpm db:seed` | Apply migrations, sign the database, create the demo user (see [Migrations](#migrations)) |

## Project Structure

```
mission-planner/
├── src/
│   ├── app/                          # Next.js app directory
│   │   ├── api/
│   │   │   └── flight-deck/route.ts  # Flight Deck streaming API (SSE)
│   │   ├── mission-planner/          # Main mission planner page
│   │   ├── layout.tsx                # Root layout
│   │   ├── globals.css               # Global styles + Tailwind v4 @theme tokens
│   │   └── page.tsx                  # Entry point
│   │
│   ├── components/                   # React components
│   │   ├── layout/                   # Layout components
│   │   │   └── ardupilot-layout.tsx  # Main application layout
│   │   ├── flight-plan/              # Flight planning UI
│   │   │   ├── map-toolbar.tsx
│   │   │   └── waypoint-table.tsx
│   │   ├── map/                      # Map components
│   │   │   └── map-view.tsx          # Interactive map
│   │   ├── mission/                  # Mission management
│   │   │   ├── mission-summary.tsx
│   │   │   ├── mission-library-panel.tsx
│   │   │   ├── template-picker.tsx
│   │   │   ├── terrain-panel.tsx
│   │   │   ├── timeline-panel.tsx
│   │   │   └── tenant-selector.tsx
│   │   ├── constraints/              # Constraint management
│   │   │   └── constraints-panel.tsx
│   │   ├── agent-console/            # Flight Deck UI
│   │   │   ├── mission-prompt-bar.tsx
│   │   │   └── agent-console.tsx     # Streamed agent log + approval card
│   │   ├── ui/                       # Reusable UI components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── slider.tsx
│   │   │   └── ... (more UI components)
│   │   └── common/                   # Common components
│   │       └── toast.tsx
│   │
│   ├── lib/                          # Utilities and services
│   │   ├── store/                    # Zustand stores
│   │   │   ├── mission-store.ts
│   │   │   ├── mission-library-store.ts
│   │   │   ├── constraints-store.ts
│   │   │   ├── geofence-store.ts
│   │   │   ├── ui-store.ts
│   │   │   ├── tenant-store.ts
│   │   │   └── agent-store.ts        # Flight Deck run state + streamed events
│   │   ├── services/                 # Business logic
│   │   │   ├── mission-builder.ts    # Mission creation & export
│   │   │   ├── route-optimizer.ts    # Route optimization
│   │   │   ├── risk-scorer.ts        # Risk assessment
│   │   │   ├── metrics-service.ts    # Mission metrics
│   │   │   ├── terrain-service.ts    # Terrain analysis
│   │   │   └── geofence-checker.ts   # Geofence intersection checks
│   │   ├── agents/                   # Flight Deck (ATLAS/SENTINEL agents)
│   │   │   ├── schemas.ts            # Zod schemas + shared types
│   │   │   ├── prompts.ts            # ATLAS system prompt
│   │   │   ├── tools.ts              # ATLAS tools: geocode, terrain lookup
│   │   │   ├── atlas-agent.ts        # LLM tool-calling loop → MissionDraft
│   │   │   ├── sentinel-audit.ts     # Deterministic safety audit + verdict
│   │   │   ├── graph.ts              # LangGraph state machine (veto loop)
│   │   │   └── client.ts             # Client-side SSE consumer
│   │   ├── mavlink/                  # MAVLink protocol
│   │   │   └── commands.ts           # MAVLink command definitions
│   │   ├── templates/                # Mission templates
│   │   │   └── mission-templates.ts
│   │   └── utils.ts                  # Utility functions
│   │
│   ├── types/                        # TypeScript type definitions
│   │   └── mission.ts                # Mission-related types
│   │
│   └── hooks/                        # Custom React hooks
│       └── useKeyboardShortcuts.ts   # Keyboard shortcut handling
│
├── public/                           # Static assets
├── .next/                            # Next.js build output (generated)
├── components.json                   # shadcn/ui configuration
├── tsconfig.json                     # TypeScript configuration
├── next.config.ts                    # Next.js configuration
├── postcss.config.mjs                # PostCSS configuration (Tailwind v4 plugin)
├── eslint.config.mjs                 # ESLint configuration
├── .env.local.example                # Template for ANTHROPIC_API_KEY
├── pnpm-lock.yaml                    # pnpm lockfile (do not edit)
├── package.json                      # Project dependencies
└── README.md                         # This file
```

> Note: Tailwind CSS v4 is configured via `@theme` in `src/app/globals.css`, not a
> `tailwind.config.ts` file — that file doesn't exist in this project by design.

## Key Services

### Mission Builder (`lib/services/mission-builder.ts`)
Handles mission creation, validation, and export functionality.
- `missionSanityCheck()`: Validates mission integrity
- `exportMissionAsV1Json()`: Exports missions to JSON format
- `makeExportFilename()`: Generates export filenames

### Route Optimizer (`lib/services/route-optimizer.ts`)
Optimizes flight paths and generates alternatives.
- `optimiseRoute()`: Optimizes waypoint sequence
- `generateAlternativeRoutes()`: Creates alternative mission variations

### Risk Scorer (`lib/services/risk-scorer.ts`)
Evaluates mission risk based on various factors.
- `computeRiskScore()`: Calculates overall risk score (0-100)

### Metrics Service (`lib/services/metrics-service.ts`)
Calculates mission statistics.
- `computeMissionMetrics()`: Computes flight time, distance, etc.

### Terrain Service (`lib/services/terrain-service.ts`)
Provides terrain and elevation data.

### Geofence Checker (`lib/services/geofence-checker.ts`)
Checks waypoints and leg midpoints against keep-in/keep-out geofences.
- `checkGeofences()`: Returns every violation with the offending waypoint index

## Flight Deck (`lib/agents/`)
An agentic layer that turns a natural-language request into a validated mission:
- **ATLAS** (`atlas-agent.ts`): a Claude-backed agent that calls `geocode` and
  `get_terrain_elevation` tools, then emits a JSON `MissionDraft` (Zod-validated).
- **SENTINEL** (`sentinel-audit.ts`): deterministic code — not an LLM call — that
  reuses `missionSanityCheck`, `checkGeofences`, `computeRiskScore`, and
  `computeMissionMetrics` to produce a PASS/VETO verdict with findings. Making this
  code rather than a model call means it can't be reasoned or prompt-injected into
  approving something unsafe.
- **graph.ts**: a LangGraph state machine wiring ATLAS → SENTINEL with a veto loop
  (max 3 revisions) before surfacing the result for human approval.
- Nothing touches the live mission until the pilot clicks **Approve & Load** in the
  Agent Console (`components/agent-console/`).
- Not yet implemented: a route-negotiation agent, a long-term pilot-preference
  memory agent, persistent run checkpointing, and an eval suite — see the PRD this
  was scoped from for the full multi-agent vision.

## State Management

The application uses Zustand for state management with the following stores:

- **Mission Store**: Current mission and waypoint management
- **Mission Library Store**: Saved missions and templates
- **Constraints Store**: Flight constraints and parameters
- **Geofence Store**: Geofence boundary definitions
- **UI Store**: UI state and preferences
- **Tenant Store**: Multi-tenant organization support

## Configuration

### Tailwind CSS
Configure styling tokens in `tailwind.config.ts`. The project uses a neutral base color with CSS variables for theming.

### shadcn/ui
Component configuration is in `components.json`. Uses Radix Nova style with Lucide icons.

### Next.js
Configuration options in `next.config.ts`:
- React Compiler enabled for optimizations
- App Router enabled
- TypeScript strict mode

## MAVLink Support

The application supports ArduPilot's MAVLink protocol through:
- **Command Definitions** (`lib/mavlink/commands.ts`): Comprehensive MAVLink mission command mappings
- **Mission Item Format**: Compatible with MAVLink mission protocol (v1)
- **Export Formats**: Generates MAVLink-compatible mission files

## Development Workflow

### Adding a New Component
1. Create the component in `src/components/`
2. Use shadcn/ui components for consistency
3. Implement TypeScript interfaces
4. Add proper error handling

### Adding a New Service
1. Create service in `src/lib/services/`
2. Export pure functions or class methods
3. Add TypeScript types
4. Document with JSDoc comments

### Adding a New Store
1. Create store in `src/lib/store/`
2. Use Zustand's create function
3. Define proper TypeScript types
4. Export from barrel file if applicable

## Performance Optimizations

- **React Compiler**: Enabled for automatic optimization
- **Image Optimization**: Next.js built-in image optimization
- **Code Splitting**: Automatic route-based code splitting
- **Tailwind CSS**: Purges unused styles in production

## Browser Support

- Chrome/Edge: Latest versions
- Firefox: Latest versions
- Safari: Latest versions
- Mobile browsers: iOS Safari, Chrome Android

## Troubleshooting

### Port 3000 Already in Use
```bash
# Use a different port
pnpm dev -- -p 3001
```

### Node Modules Issues
```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### TypeScript Errors
```bash
# Regenerate Next.js type definitions
rm -rf .next
pnpm dev
```

## Contributing

### Code Style
- Follow ESLint rules configured in the project
- Use TypeScript for type safety
- Follow React best practices
- Use meaningful variable and function names

### Commit Messages
- Use clear, descriptive commit messages
- Reference issue numbers when applicable
- Follow conventional commit format

### Pull Requests
- Ensure all tests pass
- Update documentation as needed
- Provide clear description of changes
- Request review from team members

## Database & Authentication

Accounts and missions are persisted in PostgreSQL via Prisma ORM. Signup, login,
logout, session persistence, protected routes, email verification, and password
reset are all real — no mocked auth, no plaintext passwords, no faked emails.

### Schema

Defined in [`src/prisma/contract.prisma`](src/prisma/contract.prisma):

| Model | Purpose |
| --- | --- |
| `User` | Account identity. `passwordHash` is Argon2id (never plaintext). `emailVerified` is a nullable timestamp. |
| `Session` | One row per signed-in session. Only a SHA-256 hash of the session token is stored — the raw token lives only in the `mps_session` httpOnly cookie — so a DB leak alone can't be replayed into a valid session. |
| `EmailVerificationToken` / `PasswordResetToken` | Single-use, hashed, expiring tokens (24h / 1h) for the two email-based flows. |
| `AuthAttempt` | A row per login/signup/forgot-password attempt, keyed by a coarse identifier (email or IP). Backs the rate limiter — see below. |
| `Mission` | Belongs to exactly one `User` (`userId`, cascade-deleted with the user). Home position is three plain nullable columns, not JSON. |
| `MissionSettings` | 1:1 with `Mission` — flight defaults (altitude/speed/loiter/wait) and the safety-limit configuration from the Constraints panel. A real table, not a JSON blob, because every field is a fixed, individually meaningful number. |
| `Waypoint` | Belongs to a `Mission` (cascade-deleted with it). One row per waypoint; `action` is a Postgres-enforced enum matching `PlannerAction`; `(missionId, sequence)` is unique. |

UUID primary keys throughout, FK cascades on every child table, and indexes on
every foreign key plus the `AuthAttempt` rate-limit lookup. Nothing mission-shaped
is stored as an unstructured blob — the only genuinely flexible field in the whole
schema would be a JSONB column, and there isn't one yet because nothing here needs
one.

**Deliberately out of scope for this pass:** the existing tenant/organization
switcher, no-fly zones, and geofences remain exactly as they were before — a
client-only, localStorage-backed convenience inside the mission editor. Only
`Mission` identity, its `Waypoint`s, and its `MissionSettings` are server-persisted.
Migrating those three is a reasonable next step, not done here, to avoid widening
an already-large change.

### Migrations

This project's Prisma CLI (`8.0.0-rc.22`) uses a "contract" workflow rather than the
classic `prisma migrate dev`: you edit the schema, emit a typed contract, plan a
migration from the diff, then apply it. Every migration is a version-controlled,
on-disk package under [`migrations/app/`](migrations/app) — nothing is inferred
and auto-applied at startup.

```bash
pnpm contract:emit     # regenerate contract.json / contract.d.ts from the schema
pnpm db:plan           # diff the contract against migration history, write a new migration
pnpm db:migrate        # apply pending migrations to $DATABASE_URL
pnpm db:sign           # mark the DB as matching the contract (required before querying it)
```

Run `db:plan` → review the generated SQL under `migrations/app/<timestamp>_<name>/` →
`db:migrate` → `db:sign`, in that order, every time the schema changes. **Never**
run these against production without reviewing the generated SQL first, and never
`db:migrate` with a destructive rename/delete you haven't deliberately confirmed
(the planner refuses silently-lossy changes and tells you to pass `--rename` or
`--delete` explicitly).

### Authentication implementation

- **Password hashing**: Argon2id via `@node-rs/argon2` (prebuilt native binary,
  no node-gyp build step — matters for Vercel's serverless build). OWASP-baseline
  cost parameters in `src/lib/auth/password.ts`.
- **Sessions**: a random 256-bit token in an `httpOnly`, `sameSite=lax`, `secure`
  (in production) cookie; only its hash is stored server-side (`src/lib/auth/session.ts`).
  Logout deletes the DB row, not just the cookie. Resetting a password invalidates
  every existing session for that account.
- **Email verification / password reset**: same hashed-token pattern, 24h / 1h
  expiry, single-use (`src/lib/auth/tokens.ts`, the `verify-email` / `reset-password`
  routes).
- **Email delivery**: `src/lib/email/send.ts` calls the Resend REST API directly
  with `fetch` (no SDK dependency). Without `RESEND_API_KEY` set, no email is sent
  — the app is honest about that rather than pretending — and outside production
  the API response instead includes a working `devVerifyUrl` / `devResetUrl` so the
  flow stays testable.
- **Rate limiting**: `src/lib/auth/rate-limit.ts` tracks attempts in the
  `AuthAttempt` table (10 failed logins / 15 min, 5 signups or password-reset
  requests / hour, per identifier) — database-backed rather than in-memory because
  Vercel's serverless functions don't share process memory across invocations.
- **CSRF**: every mutating route checks the request's `Origin` header matches the
  app's own host (`src/lib/http/same-origin.ts`) — a cross-site form post or
  `<img>` trick can't set that header, and it's a second layer on top of the
  session cookie's `sameSite: 'lax'`.
- **Account enumeration**: login and forgot-password return the same generic
  response whether or not the account exists (login also runs a dummy password
  check so timing doesn't leak it either).
- **Authorization**: every mission route re-derives the signed-in user from the
  session cookie itself and filters every query by `userId` — a mission that
  exists but isn't yours 404s, it doesn't 403, so its existence isn't confirmed
  either. `src/proxy.ts` (Next's renamed `middleware.ts`) blocks page navigation
  for signed-out users, but per Next's own guidance that's defense-in-depth, not
  the only check — every route handler verifies independently.
- **Protected surfaces**: `/dashboard`, `/mission-planner`, `/api/missions/*`, and
  `/api/flight-deck` require a session; `/login` and `/signup` redirect to
  `/dashboard` if you already have one.

### Environment variables

Copy the example file:
```bash
cp .env.local.example .env.local
```

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string. Read by both the Next.js app and the Prisma CLI (the CLI loads it via `dotenv/config` from a plain `.env` file — put it there, not only in `.env.local`, or the CLI commands above won't see it). |
| `ANTHROPIC_API_KEY` | Only for Flight Deck | Unrelated to auth — the ATLAS/SENTINEL agentic planner. |
| `RESEND_API_KEY` | Recommended for production | Without it, verification/reset emails aren't sent (see above). |
| `APP_URL` | Recommended for production | Public origin for emailed verification/reset links, e.g. `https://flightdeck.example.com`. When unset it falls back to the Vercel production URL, then the deployment URL; links are never built from request headers. Set it for a custom domain or when self-hosting. |
| `EMAIL_FROM` | No | Defaults to `Flight Deck <onboarding@resend.dev>` (Resend's own sandbox sender — fine for testing, won't reliably land in Gmail/Outlook inboxes for real users; verify your own domain in Resend for production). |

### Local development

A dedicated Postgres role and database, least-privilege (not the superuser):

```bash
psql -d postgres -c "CREATE ROLE mission_planner_app LOGIN PASSWORD 'pick-a-local-password';"
psql -d postgres -c "CREATE DATABASE mission_planner_dev OWNER mission_planner_app;"
```

Set `DATABASE_URL` in `.env` to that role/database, then:

```bash
pnpm install
pnpm contract:emit
pnpm db:plan --name init     # only needed once, or after a schema change
pnpm db:migrate
pnpm db:sign
pnpm db:seed                 # optional — creates demo@example.com / password1234 with a sample mission
pnpm dev
```

### Recommended PostgreSQL hosting for production

This app deploys to **Vercel** (confirmed from the repo's GitHub deployment
history), whose serverless functions are short-lived and shouldn't hold a
persistent Postgres connection open — a self-managed "just run `postgres` on the
server" setup isn't an option there. Recommended, in order:

1. **[Neon](https://neon.tech)** — serverless Postgres with a built-in connection
   pooler, generous free tier, and a first-class Vercel integration (adds
   `DATABASE_URL` to your project automatically). This is a plain managed Postgres
   product, not a bundled backend-as-a-service — you still own the schema, the
   migrations, and the auth code in this repo.
2. **[Railway](https://railway.app)** or **[Render](https://render.com)** — also
   plain managed Postgres, simple dashboard-based provisioning, if you'd rather not
   use Neon specifically.

To use Neon: create a project at neon.tech (or via the Vercel integration in your
Vercel project's Storage tab), copy its connection string, and set it as
`DATABASE_URL` in your Vercel project's Environment Variables (Production scope).
Use the same string locally in `.env` if you want local dev to point at a Neon
branch instead of a local Postgres install.

**This requires an account and cannot be done on your behalf** — provisioning a
database is an action only you can take. Once `DATABASE_URL` is set in Vercel, run
the migration commands above with that same connection string (from your own
machine, pointed at the production database) before the first deploy that needs
it, then set `RESEND_API_KEY` the same way if you want real verification/reset
emails to go out.

### Production deployment steps

1. Provision a Postgres database (see above) and copy its connection string.
2. In Vercel → Project → Settings → Environment Variables, set `DATABASE_URL`
   (and `RESEND_API_KEY` / `EMAIL_FROM` if you want real email) for the
   Production environment. Set `APP_URL` to your public origin (for example
   `https://flightdeck.example.com`) so emailed links point at it; when unset,
   links fall back to the Vercel production URL. Self-hosting outside Vercel also
   needs `APP_URL` and `FORCE_HTTPS=1` (see `docs/SECURITY_AUDIT.md`).
3. From your own machine, with `DATABASE_URL` pointed at that same production
   database: `pnpm contract:emit && pnpm db:migrate && pnpm db:sign`. Do this
   before traffic hits a deploy that depends on the new schema.
4. Push to `main` (or your Vercel-connected branch) — Vercel's existing
   GitHub integration builds and deploys as it already does today; nothing about
   the deploy trigger changes.
5. Never run `db:migrate` against production without having reviewed the planned
   SQL first, and never re-run `prisma orm init` or point `db:migrate` at a
   production URL with `--to @empty` or similar — both are destructive and this
   project's tooling will refuse a silently-lossy plan, but a forced one will not
   be stopped twice.

## License

[Add your license information here]

## Support & Contact

For issues, questions, or feature requests, please:
- Open an issue on the project repository
- Contact the development team
- Check existing documentation

## Changelog

### Version 0.1.0 (Initial Release)
- Initial mission planner MVP
- Core waypoint management
- Route optimization
- Risk assessment
- Mission export
- Geofencing support

---

**Last Updated**: 2026-07-13  
**Next.js Version**: 16.2.2  
**React Version**: 19.2.4  
**Node.js Requirement**: 18.17+
