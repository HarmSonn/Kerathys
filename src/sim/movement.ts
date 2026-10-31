// Straight-line walking with path wear. Pathfinding comes in Phase 2.

import { CONFIG } from "../data/config";
import { Subject, World } from "./state";
import { idx, inMap } from "./world";

const cellAt = (w: World, x: number, y: number) => {
  const cx = Math.floor(x), cy = Math.floor(y);
  return inMap(w, cx, cy) ? idx(w, cx, cy) : -1;
};

function wear(w: World, from: number, to: number) {
  const { cap } = CONFIG.paths;
  const c = w.cells[to];
  c.heat = Math.min(cap, c.heat + 1);
  c.crossed = true;
  if (from >= 0) {
    const k = from < to ? `${from}_${to}` : `${to}_${from}`;
    w.edges[k] = Math.min(cap, (w.edges[k] ?? 0) + 1);
  }
}

/** Walk towards (tx, ty). Returns true on arrival. */
export function walkTo(w: World, s: Subject, tx: number, ty: number, dt: number): boolean {
  s.tx = tx; s.ty = ty;
  const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy);
  const here = cellAt(w, s.x, s.y);
  const fast = here >= 0 && w.cells[here].heat >= CONFIG.paths.fastAt;
  const step = (fast ? CONFIG.walk.path : CONFIG.walk.bare) * dt;
  if (Math.abs(dx) > 0.01) s.facing = dx > 0 ? 1 : -1;
  if (d <= step) {
    s.x = tx; s.y = ty; s.moving = false;
  } else {
    s.x += (dx / d) * step; s.y += (dy / d) * step; s.moving = true;
  }
  const now = cellAt(w, s.x, s.y);
  if (now !== here && now >= 0) wear(w, here, now);
  return !s.moving;
}

/** Once a day: paths nobody used fade a little. */
export function fadePaths(w: World) {
  const f = CONFIG.paths.fadePerDay;
  for (const c of w.cells) {
    if (!c.crossed && c.heat > 0) c.heat = Math.max(0, c.heat - f);
    c.crossed = false;
  }
  // Edges fade when neither end was used; heat decay above is the main signal.
  for (const k of Object.keys(w.edges)) {
    const [a, b] = k.split("_").map(Number);
    if (w.cells[a].heat === 0 && w.cells[b].heat === 0) delete w.edges[k];
    else if (w.cells[a].heat < w.edges[k] && w.cells[b].heat < w.edges[k]) w.edges[k] = Math.max(0, w.edges[k] - f);
  }
}
