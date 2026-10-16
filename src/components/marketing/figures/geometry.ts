/**
 * Deterministic geometry for the hand-built cartographic figures. Everything is
 * computed once at module load from fixed parameters (no randomness), so the
 * server and client render the same paths.
 */

export type Pt = readonly [number, number];

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Closed smooth path through points (Catmull-Rom converted to cubic Béziers). */
export function smoothClosed(points: Pt[]): string {
  const n = points.length;
  const p = (i: number) => points[(i + n) % n];
  let d = `M${r1(p(0)[0])} ${r1(p(0)[1])}`;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = p(i - 1);
    const [x1, y1] = p(i);
    const [x2, y2] = p(i + 1);
    const [x3, y3] = p(i + 2);
    const c1x = x1 + (x2 - x0) / 6;
    const c1y = y1 + (y2 - y0) / 6;
    const c2x = x2 - (x3 - x1) / 6;
    const c2y = y2 - (y3 - y1) / 6;
    d += ` C${r1(c1x)} ${r1(c1y)} ${r1(c2x)} ${r1(c2y)} ${r1(x2)} ${r1(y2)}`;
  }
  return `${d} Z`;
}

/** Open smooth path through points. */
export function smoothOpen(points: Pt[]): string {
  const n = points.length;
  const p = (i: number) => points[Math.max(0, Math.min(n - 1, i))];
  let d = `M${r1(p(0)[0])} ${r1(p(0)[1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = p(i - 1);
    const [x1, y1] = p(i);
    const [x2, y2] = p(i + 1);
    const [x3, y3] = p(i + 2);
    d += ` C${r1(x1 + (x2 - x0) / 6)} ${r1(y1 + (y2 - y0) / 6)} ${r1(x2 - (x3 - x1) / 6)} ${r1(y2 - (y3 - y1) / 6)} ${r1(x2)} ${r1(y2)}`;
  }
  return d;
}

export interface Hill {
  cx: number;
  cy: number;
  /** Radius of the innermost ring. */
  r0: number;
  /** Distance between rings. */
  step: number;
  rings: number;
  /** Phase seed for the ring distortion. */
  seed: number;
  /** Horizontal stretch. */
  sx?: number;
  /** How far each ring's centre drifts, per ring. */
  drift?: Pt;
}

/** Concentric, gently distorted closed rings: reads as terrain contours. */
export function hillContours(h: Hill): string[] {
  const out: string[] = [];
  const steps = 36;
  for (let k = 0; k < h.rings; k++) {
    const R = h.r0 + k * h.step;
    const cx = h.cx + (h.drift?.[0] ?? 0) * k;
    const cy = h.cy + (h.drift?.[1] ?? 0) * k;
    const pts: Pt[] = [];
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const wobble =
        1 +
        0.13 * Math.sin(2 * t + h.seed) +
        0.07 * Math.sin(3 * t + h.seed * 1.7 + k * 0.25) +
        0.035 * Math.sin(5 * t + h.seed * 0.6 - k * 0.4);
      pts.push([cx + Math.cos(t) * R * wobble * (h.sx ?? 1), cy + Math.sin(t) * R * wobble]);
    }
    out.push(smoothClosed(pts));
  }
  return out;
}

/** Open contour lines that run across the sheet (valley sides). */
export function valleyLines(
  count: number,
  opts: { x0: number; x1: number; y: number; gap: number; amp: number; seed: number },
): string[] {
  const out: string[] = [];
  const steps = 14;
  for (let k = 0; k < count; k++) {
    const pts: Pt[] = [];
    for (let i = 0; i <= steps; i++) {
      const x = opts.x0 + ((opts.x1 - opts.x0) * i) / steps;
      const t = (i / steps) * Math.PI * 2;
      const y =
        opts.y +
        k * opts.gap +
        opts.amp * Math.sin(t * 0.9 + opts.seed + k * 0.18) +
        opts.amp * 0.45 * Math.sin(t * 2.3 + opts.seed * 2 - k * 0.3);
      pts.push([x, y]);
    }
    out.push(smoothOpen(pts));
  }
  return out;
}

/** Polyline path ("M x y L x y …"). */
export function polyline(points: Pt[]): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${r1(x)} ${r1(y)}`).join(' ');
}
