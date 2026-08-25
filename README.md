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

## Environment Variables

Copy the example file and add your key:
```bash
cp .env.local.example .env.local
```
```env
# Required for Flight Deck (ATLAS/SENTINEL agentic mission planner)
ANTHROPIC_API_KEY=sk-ant-...
```
Get a key at [console.anthropic.com](https://console.anthropic.com/). Restart the dev
server after adding it. The rest of the app works without it — Flight Deck's prompt bar
will report a clear "Missing API key" error in the Agent Console until it's set.

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
