#!/usr/bin/env bash
# Design lint (DESIGN_SPEC §8.1): fails when banned "AI-native" patterns are
# present in UI code. Run with `pnpm design:lint`. Needs ripgrep (rg).
set -uo pipefail

cd "$(dirname "$0")/.."

SCOPE=(src/components src/app)

# Allow-list (paths are rg globs, relative to the repo root):
#  - src/app/globals.css: the `fd-ticks` corner-bracket utility draws its 1px
#    hairlines with solid single-colour linear-gradient() layers (no fade).
#  - src/components/arc/arc-tokens.css: vendored ARC tokens; the Flight Deck
#    block re-points every ARC gradient token to a solid hairline or `none`,
#    but the generated upstream defaults are kept for regeneration.
#  - src/components/motion/tilt-card.tsx: the inert TiltCard definition kept
#    so old imports compile; any *use* of TiltCard elsewhere still fails.
GRADIENT_ALLOW=(--glob '!src/app/globals.css' --glob '!src/components/arc/arc-tokens.css')
TILT_ALLOW=(--glob '!src/components/motion/tilt-card.tsx')

fail=0
total=0

check() {
  local label="$1"; shift
  local out
  out="$(rg --no-heading --line-number --color never "$@" "${SCOPE[@]}" 2>/dev/null || true)"
  if [[ -n "$out" ]]; then
    local n
    n="$(printf '%s\n' "$out" | wc -l | tr -d ' ')"
    total=$((total + n))
    fail=1
    printf '\n✗ %s (%s)\n' "$label" "$n"
    printf '%s\n' "$out" | sed 's/^/    /' | cut -c1-200
  else
    printf '✓ %s\n' "$label"
  fi
}

check "matrix green #00ff41"          -i -e '#00ff41' -e 'rgba?\(0,\s*255,\s*65'
check "blur-3xl glow blobs"           -e 'blur-3xl'
check "bg-gradient-* utilities"       -e 'bg-gradient-' -e 'bg-linear-to-' -e 'bg-radial'
check "linear-gradient( in UI code"   "${GRADIENT_ALLOW[@]}" -e 'linear-gradient\('
check "radial-gradient( in UI code"   "${GRADIENT_ALLOW[@]}" -e 'radial-gradient\('
check "GradientText"                  -e 'GradientText'
check "TiltCard"                      "${TILT_ALLOW[@]}" -e 'TiltCard'
check "sparkle / magic icons"         -e 'RiSparkling' -e 'RiMagic'
check "\"AI-powered\" copy"           -i -e 'AI-powered'
check "rounded-2xl"                   -e 'rounded-2xl'

echo
if [[ $fail -ne 0 ]]; then
  echo "design-lint: $total violation(s)"
  exit 1
fi
echo "design-lint: clean"
