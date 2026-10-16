/**
 * Map paint colours (DESIGN_SPEC §3.1 "Map colours"). MapLibre needs concrete
 * colour strings, so each semantic token is read from the CSS variables at
 * runtime, painted to a 1×1 canvas (handles oklch / color-mix / var chains) and
 * read back as rgba. Re-read whenever the theme changes (`watchTheme`).
 *
 * Roles:
 *   route      accent, 3px, on a 1px surface casing (legible on satellite)
 *   waypoint   surface fill, ink stroke and number; selected = accent fill + accent-ink number
 *   takeoff/land  ink square / diamond (home is an ink square marker)
 *   keep-out   danger 12% fill, 1.5px dashed danger stroke
 *   keep-in    info 8% fill, info stroke
 *   preview    info lines (survey passes, optimise / avoid previews)
 */
export interface MapColors {
  /** Route line and selected waypoint fill. */
  accent: string;
  /** Text on accent (selected waypoint number). */
  accentInk: string;
  /** Waypoint fill, route casing, halos. */
  surface: string;
  /** Offline basemap background. */
  surface2: string;
  /** Waypoint stroke and number, takeoff/land shapes. */
  ink: string;
  /** Secondary ink (measure tool). */
  ink2: string;
  danger: string;
  warn: string;
  info: string;
}

/** [primary token, legacy token, named-colour fallback] */
const TOKENS: Record<keyof MapColors, [string, string, string]> = {
  accent: ['--fd-accent', '--color-accent-500', 'orangered'],
  accentInk: ['--fd-accent-ink', '--color-text-white', 'white'],
  surface: ['--fd-surface', '--color-background-primary-default', 'white'],
  surface2: ['--fd-surface-2', '--color-background-secondary-default', 'gainsboro'],
  ink: ['--fd-ink', '--color-text-primary', 'black'],
  ink2: ['--fd-ink-2', '--color-text-secondary', 'dimgray'],
  danger: ['--fd-danger', '--color-red', 'firebrick'],
  warn: ['--fd-warn', '--color-amber', 'darkgoldenrod'],
  info: ['--fd-info', '--color-blue', 'royalblue'],
};

function resolve(ctx: CanvasRenderingContext2D, value: string, fallback: string): string {
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = fallback;
  if (value) ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}

/** Reads the current theme's map colours (uncached: call again after a theme change). */
export function readMapColors(): MapColors {
  const style = getComputedStyle(document.documentElement);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const out = {} as MapColors;
  for (const key of Object.keys(TOKENS) as (keyof MapColors)[]) {
    const [primary, legacy, fallback] = TOKENS[key];
    const raw = style.getPropertyValue(primary).trim() || style.getPropertyValue(legacy).trim();
    out[key] = ctx ? resolve(ctx, raw, fallback) : fallback;
  }
  return out;
}

/** @deprecated kept for callers that only need one read; prefer `readMapColors`. */
export const getMapColors = readMapColors;

/** Same colour with a different alpha (input is the rgba() string from `readMapColors`). */
export function withAlpha(rgba: string, alpha: number): string {
  const m = rgba.match(/rgba?\(([^)]+)\)/);
  if (!m) return rgba;
  const [r, g, b] = m[1].split(',').map((s) => s.trim());
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Calls `onChange` when the light/dark theme flips (the `dark` class or a
 * `data-theme` attribute on <html>, or the OS preference). Returns an unsubscribe.
 */
export function watchTheme(onChange: () => void): () => void {
  const root = document.documentElement;
  let last = `${root.className}|${root.dataset.theme ?? ''}`;
  const check = () => {
    const now = `${root.className}|${root.dataset.theme ?? ''}`;
    if (now === last) return;
    last = now;
    onChange();
  };
  const mo = new MutationObserver(check);
  mo.observe(root, { attributes: true, attributeFilter: ['class', 'data-theme'] });
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', onChange);
  return () => {
    mo.disconnect();
    mq.removeEventListener('change', onChange);
  };
}
