import { dist, type Vec } from '@/lib/domain/geo';

/**
 * Up to this many points the exhaustive local search runs (every 2-opt / Or-opt move is
 * tried each pass, O(n²) per pass). Above it, moves are only tried between each point and
 * its nearest neighbours, which keeps 2,000 points well under a second instead of minutes.
 */
export const EXACT_TSP_MAX_POINTS = 120;
/** Candidate list size for the large-input search. */
const NEIGHBOURS = 10;
/** Hard cap on improvement sweeps for the large-input search (each sweep is O(n·k)). */
const MAX_SWEEPS = 60;

/**
 * Open-path TSP over `pts` with a fixed start `s` and optional fixed end `e`.
 * Returns an order (indices into `pts`). Nearest neighbour construction, then 2-opt and
 * Or-opt (chains of 1..3, both orientations) until no improving move is found. Inputs
 * above `EXACT_TSP_MAX_POINTS` use neighbour-list candidates and a sweep cap.
 */
export function solveOpenPath(s: Vec, pts: Vec[], e: Vec | null, initial?: number[]): number[] {
  const n = pts.length;
  if (n <= 1) return pts.map((_, i) => i);
  if (n <= EXACT_TSP_MAX_POINTS) {
    const order = initial ? [...initial] : nearestNeighbour(s, pts);
    improve(s, pts, e, order);
    return order;
  }
  const order = initial ? [...initial] : fastNearestNeighbour(s, pts);
  improveWithNeighbours(s, pts, e, order);
  return order;
}

function nearestNeighbour(s: Vec, pts: Vec[]): number[] {
  const left = new Set(pts.map((_, i) => i));
  const out: number[] = [];
  let cur = s;
  while (left.size) {
    let best = -1;
    let bd = Infinity;
    for (const i of left) {
      const d = dist(cur, pts[i]);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    left.delete(best);
    out.push(best);
    cur = pts[best];
  }
  return out;
}

export function openPathLength(s: Vec, pts: Vec[], e: Vec | null, order: number[]): number {
  let d = 0;
  let cur = s;
  for (const i of order) {
    d += dist(cur, pts[i]);
    cur = pts[i];
  }
  return e ? d + dist(cur, e) : d;
}

const EPS = 1e-7;

function improve(s: Vec, pts: Vec[], e: Vec | null, order: number[]): void {
  // Node sequence: position -1 is s, position n is e (absent when open).
  const n = order.length;
  const at = (k: number): Vec | null => (k < 0 ? s : k >= n ? e : pts[order[k]]);
  const d = (a: Vec | null, b: Vec | null) => (a && b ? dist(a, b) : 0);
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 1000) {
    improved = false;
    // 2-opt: reverse order[i..k]
    for (let i = 0; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const a = at(i - 1);
        const b = at(i);
        const c = at(k);
        const f = at(k + 1);
        const delta = d(a, c) + d(b, f) - d(a, b) - d(c, f);
        if (delta < -EPS) {
          reverse(order, i, k);
          improved = true;
        }
      }
    }
    // Or-opt: move a chain of length L starting at i to between j and j+1.
    for (let L = 1; L <= 3 && !improved; L++) {
      for (let i = 0; i + L <= n && !improved; i++) {
        const p = at(i - 1);
        const first = at(i);
        const last = at(i + L - 1);
        const q = at(i + L);
        const removeGain = d(p, first) + d(last, q) - d(p, q);
        for (let j = -1; j < n && !improved; j++) {
          if (j >= i - 1 && j <= i + L - 1) continue;
          const u = at(j);
          const v = at(j + 1);
          const base = d(u, v);
          const fwd = d(u, first) + d(last, v) - base;
          const rev = d(u, last) + d(first, v) - base;
          const add = Math.min(fwd, rev);
          if (add - removeGain < -EPS) {
            const chain = order.splice(i, L);
            if (rev < fwd) chain.reverse();
            const insertAt = j < i ? j + 1 : j + 1 - L;
            order.splice(insertAt, 0, ...chain);
            improved = true;
          }
        }
      }
    }
  }
}

function reverse(a: number[], i: number, k: number) {
  while (i < k) {
    [a[i], a[k]] = [a[k], a[i]];
    i++;
    k--;
  }
}

/** Euclidean distance without Math.hypot (several times faster in V8; fine at mission scale). */
const fastDist = (a: Vec, b: Vec) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/** Nearest-neighbour construction over flat coordinate arrays (large inputs). */
function fastNearestNeighbour(s: Vec, pts: Vec[]): number[] {
  const n = pts.length;
  const xs = Float64Array.from(pts, (p) => p.x);
  const ys = Float64Array.from(pts, (p) => p.y);
  const left = Int32Array.from({ length: n }, (_, i) => i);
  let size = n;
  const out: number[] = [];
  let cx = s.x;
  let cy = s.y;
  while (size > 0) {
    let best = 0;
    let bd = Infinity;
    for (let m = 0; m < size; m++) {
      const i = left[m];
      const dx = xs[i] - cx;
      const dy = ys[i] - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bd) {
        bd = d2;
        best = m;
      }
    }
    const i = left[best];
    left.copyWithin(best, best + 1, size);
    size--;
    out.push(i);
    cx = xs[i];
    cy = ys[i];
  }
  return out;
}

/** Neighbour lists are reused across the two solves `optimiseRoute` runs on the same points. */
const neighbourCache = new WeakMap<Vec[], { k: number; lists: Int32Array }>();

/** The `k` nearest other points of every point, as a flat `n·k` index array (brute force, O(n²)). */
function neighbourLists(pts: Vec[], k: number): Int32Array {
  const cached = neighbourCache.get(pts);
  if (cached && cached.k === k) return cached.lists;
  const n = pts.length;
  const xs = Float64Array.from(pts, (p) => p.x);
  const ys = Float64Array.from(pts, (p) => p.y);
  const out = new Int32Array(n * k);
  const bestD = new Float64Array(k);
  const bestI = new Int32Array(k);
  for (let i = 0; i < n; i++) {
    let size = 0;
    const xi = xs[i];
    const yi = ys[i];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const dx = xs[j] - xi;
      const dy = ys[j] - yi;
      const dj = dx * dx + dy * dy;
      if (size === k && dj >= bestD[k - 1]) continue;
      // insertion into the sorted top-k
      let at = size < k ? size++ : k - 1;
      while (at > 0 && bestD[at - 1] > dj) {
        bestD[at] = bestD[at - 1];
        bestI[at] = bestI[at - 1];
        at--;
      }
      bestD[at] = dj;
      bestI[at] = j;
    }
    for (let m = 0; m < k; m++) out[i * k + m] = bestI[m];
  }
  neighbourCache.set(pts, { k, lists: out });
  return out;
}

/**
 * 2-opt and Or-opt restricted to moves that create an edge between a point and one of its
 * `NEIGHBOURS` nearest points (the classic candidate-list speed-up). Every applied move
 * shortens the path by more than EPS, so the result is never longer than the input.
 */
function improveWithNeighbours(s: Vec, pts: Vec[], e: Vec | null, order: number[]): void {
  const n = order.length;
  const k = Math.min(NEIGHBOURS, n - 1);
  const nb = neighbourLists(pts, k);
  const pos = new Int32Array(n);
  const reindex = (from: number, to: number) => {
    for (let p = Math.max(0, from); p <= Math.min(n - 1, to); p++) pos[order[p]] = p;
  };
  reindex(0, n - 1);
  const at = (p: number): Vec | null => (p < 0 ? s : p >= n ? e : pts[order[p]]);
  const d = (a: Vec | null, b: Vec | null) => (a && b ? fastDist(a, b) : 0);

  /** Reverses order[i..j] when that shortens the path. */
  const tryReverse = (i: number, j: number): boolean => {
    if (i < 0 || j >= n || i >= j) return false;
    const delta = d(at(i - 1), at(j)) + d(at(i), at(j + 1)) - d(at(i - 1), at(i)) - d(at(j), at(j + 1));
    if (delta >= -EPS) return false;
    reverse(order, i, j);
    reindex(i, j);
    return true;
  };

  /** Moves the chain order[i..i+L-1] between slots j and j+1 when that shortens the path. */
  const tryMove = (i: number, L: number, j: number): boolean => {
    if (j < -1 || j >= n || (j >= i - 1 && j <= i + L - 1)) return false;
    const first = at(i);
    const last = at(i + L - 1);
    const removeGain = d(at(i - 1), first) + d(last, at(i + L)) - d(at(i - 1), at(i + L));
    const u = at(j);
    const v = at(j + 1);
    const base = d(u, v);
    const fwd = d(u, first) + d(last, v) - base;
    const rev = d(u, last) + d(first, v) - base;
    if (Math.min(fwd, rev) - removeGain >= -EPS) return false;
    const chain = order.splice(i, L);
    if (rev < fwd) chain.reverse();
    const insertAt = j < i ? j + 1 : j + 1 - L;
    order.splice(insertAt, 0, ...chain);
    reindex(Math.min(i, insertAt), Math.max(i + L - 1, insertAt + L - 1));
    return true;
  };

  let improved = true;
  let sweeps = 0;
  while (improved && sweeps++ < MAX_SWEEPS) {
    improved = false;
    for (let x = 0; x < n; x++) {
      for (let m = 0; m < k; m++) {
        const y = nb[x * k + m];
        const p = pos[x];
        const q = pos[y];
        const lo = Math.min(p, q);
        const hi = Math.max(p, q);
        if (hi - lo < 2) continue;
        // Both reversals that make x and y adjacent.
        if (tryReverse(lo + 1, hi) || tryReverse(lo, hi - 1)) improved = true;
      }
    }
    for (let L = 1; L <= 3; L++) {
      for (let x = 0; x < n; x++) {
        const i = pos[x];
        if (i + L > n) continue;
        const ends = [order[i], order[i + L - 1]];
        for (const end of ends) {
          for (let m = 0; m < k; m++) {
            const r = pos[nb[end * k + m]];
            // Insert right after or right before the neighbour.
            if (tryMove(pos[x], L, r) || tryMove(pos[x], L, r - 1)) {
              improved = true;
              break;
            }
          }
          if (pos[x] !== i) break;
        }
      }
    }
  }
}
