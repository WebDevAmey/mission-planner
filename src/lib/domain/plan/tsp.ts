import { dist, type Vec } from '@/lib/domain/geo';

/**
 * Open-path TSP over `pts` with a fixed start `s` and optional fixed end `e`.
 * Returns an order (indices into `pts`). Nearest neighbour construction, then 2-opt and
 * Or-opt (chains of 1..3, both orientations) until no improving move is found.
 */
export function solveOpenPath(s: Vec, pts: Vec[], e: Vec | null, initial?: number[]): number[] {
  const n = pts.length;
  if (n <= 1) return pts.map((_, i) => i);
  const order = initial ? [...initial] : nearestNeighbour(s, pts);
  improve(s, pts, e, order);
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
