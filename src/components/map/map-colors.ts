/**
 * Map paint colours come from the design tokens (TECHNICAL_SPEC §6), resolved
 * once in the browser. MapLibre can't parse every CSS colour syntax (oklch,
 * color-mix), so each token is painted to a 1×1 canvas and read back as rgba.
 */
export interface MapColors {
  route: string;
  routeError: string;
  waypoint: string;
  waypointText: string;
  selected: string;
  warning: string;
  error: string;
  keepOut: string;
  keepIn: string;
  preview: string;
  measure: string;
  halo: string;
}

const TOKENS: Record<keyof MapColors, [string, string]> = {
  // [css variable, CSS named-colour fallback]
  route: ['--color-cyan', 'deepskyblue'],
  routeError: ['--color-red', 'red'],
  waypoint: ['--color-cyan', 'deepskyblue'],
  waypointText: ['--color-bg-base', 'black'],
  selected: ['--color-text', 'white'],
  warning: ['--color-amber', 'orange'],
  error: ['--color-red', 'red'],
  keepOut: ['--color-red', 'red'],
  keepIn: ['--color-blue', 'dodgerblue'],
  preview: ['--color-green', 'lime'],
  measure: ['--color-amber', 'orange'],
  halo: ['--color-bg-base', 'black'],
};

function resolve(ctx: CanvasRenderingContext2D, value: string, fallback: string): string {
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = fallback;
  ctx.fillStyle = value || fallback;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}

let cached: MapColors | null = null;

export function getMapColors(): MapColors {
  if (cached) return cached;
  const style = getComputedStyle(document.documentElement);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const out = {} as MapColors;
  for (const key of Object.keys(TOKENS) as (keyof MapColors)[]) {
    const [variable, fallback] = TOKENS[key];
    const raw = style.getPropertyValue(variable).trim();
    out[key] = ctx ? resolve(ctx, raw, fallback) : fallback;
  }
  cached = out;
  return out;
}
