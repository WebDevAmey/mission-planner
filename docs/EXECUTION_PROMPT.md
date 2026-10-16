# Execution prompt: Flight Deck design overhaul

Paste the block below into Claude Code at the repository root, on a branch made from `feature/revamp`. It is self-contained: it installs the design skills safely, then runs the overhaul task by task with subagents.

## One-time setup (run yourself, in the repo root)

```bash
git fetch origin && git checkout -b feature/design-overhaul origin/feature/revamp   # or check out the existing branch
# Design skills, project-local, copied rather than symlinked, telemetry off
export DISABLE_TELEMETRY=1
npx skills add anthropics/skills --skill frontend-design -a claude-code -y --copy
npx skills add wshobson/agents --skill design-system-patterns -a claude-code -y --copy
npx skills add nextlevelbuilder/ui-ux-pro-max-skill --skill ui-ux-pro-max -a claude-code -y --copy
npx skills add Leonxlnx/taste-skill --skill design-taste-frontend -a claude-code -y --copy
npx skills add Leonxlnx/taste-skill --skill redesign-existing-projects -a claude-code -y --copy
# impeccable: skills only, no hooks (its default install adds hooks to .claude/settings and runs a downloaded binary)
npx impeccable install --no-hooks
# ECC: reference only. Do not run its install.sh or enable its hooks.
git clone --depth 1 https://github.com/affaan-m/ECC.git ../ECC
```

Keep `.claude/skills/` out of the app's commits unless you want the team to share them.

## Prompt

```text
You are redesigning Flight Deck, a Next.js 16 / React 19 / Tailwind v4 drone mission planner, so it looks clean and tasteful and no longer "AI-native". Read these first and follow them exactly:
- docs/DESIGN_SPEC.md (the source of truth: tokens, type, surfaces, acceptance criteria)
- docs/IMPLEMENTATION_PLAN.md, Phase 13 (task split)
- Skills: .claude/skills/impeccable (reference/operate.md, mode-operate.md, craft-floor.md, layout.md, polish.md) for app screens;
  .claude/skills/redesign-existing-projects/SKILL.md for the process; .claude/skills/design-taste-frontend (SKILL.md, references/tells.md, copy.md) for the landing page only;
  .claude/skills/frontend-design/SKILL.md; .claude/skills/design-system-patterns/references/design-tokens.md;
  ../ECC/skills/frontend-design-direction/SKILL.md and ../ECC/rules/web/design-quality.md.
  Where skills disagree, DESIGN_SPEC §1.2 (D-17) decides. Never run impeccable's launcher, hooks or live mode, ECC's installer or hooks, or any script that downloads assets.

Hard constraints:
- Do not change behaviour, routes, API contracts, the database schema, .env files or deploy settings. Every existing feature must keep working (login, dashboard CRUD, editor autosave, survey, optimise, zones, checks, every export and import, settings, the assistant).
- Use the vendored BoardUI components (src/components/base, src/components/application) and ARC UI (src/components/arc/arc.tsx) first. Extra components from Vengeance UI or 21st.dev only where DESIGN_SPEC §7 allows, after checking the licence. No glow, gradient, shimmer, orb, 3D or parallax components.
- No raw hex in components; semantic tokens only. One accent-filled control per view.
- Work on branch feature/design-overhaul. Commit and push after each task with a clear message. Never push to main.

Process (subagent-driven, task by task, in parallel where possible):
1. Create one git worktree per task from feature/design-overhaul: task/ds-foundation, task/ds-marketing, task/ds-app, task/ds-editor. Symlink node_modules from the main checkout to save install time.
2. Spawn the Foundation agent first (Phase 13.1). It writes a signal file when tokens, fonts and base components are done.
3. Spawn the Marketing+Auth, Dashboard+Settings and Editor+Map agents at the same time. Each builds against the token names in DESIGN_SPEC §3 and merges task/ds-foundation into its branch as soon as the signal exists, before visual checks.
4. Run an Integrator agent continuously: as each task finishes, merge it into feature/design-overhaul, resolve conflicts (theme.css, globals.css and arc.tsx are owned by Foundation; other agents request changes there through a shared requests file), run pnpm typecheck, pnpm lint, pnpm test and pnpm build after every merge, fix breakages, and push.
5. Keep a shared LEARNINGS.md; every agent reads it before starting and appends anything the next agent should know (a token gotcha, a component quirk).
6. Each agent verifies its own surfaces by screenshots (Playwright, Chromium) at 390, 1024 and 1440 px in light and dark, fixes the top 3 problems it sees, up to 3 rounds, and checks keyboard focus and reduced motion.
7. Finish with scripts/design-lint.sh passing, all checks green, screenshots saved to docs/screenshots/overhaul/, and a PR from feature/design-overhaul into feature/revamp (or main if PR #1 is merged) whose description lists what changed per surface and anything not verified.
```
