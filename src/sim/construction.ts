// Builders: walk to the nearest site that has materials to work with.
// Build time is split evenly across materials, so a half-supplied site
// can be at most half built.

import { BUILDINGS, CONFIG, Good } from "../data/config";
import { walkTo } from "./movement";
import { Building, Subject, World } from "./state";
import { byId, dist, door, log } from "./world";
import { openFields } from "./work";

const costTotal = (b: Building) => Object.values(BUILDINGS[b.type].cost).reduce((a, n) => a + (n ?? 0), 0);
const deliveredTotal = (b: Building) =>
  (Object.keys(BUILDINGS[b.type].cost) as Good[]).reduce((a, g) => a + b.delivered[g], 0);

/** Seconds of building the delivered materials allow so far. */
export const buildAllowed = (b: Building) => {
  const total = costTotal(b), t = BUILDINGS[b.type].buildTime;
  return total === 0 ? t : (deliveredTotal(b) / total) * t;
};

export const buildersAt = (w: World, b: Building) =>
  w.subjects.filter((s) => s.role === "builder" && s.building === b.id).length;

export function dispatchBuilders(w: World) {
  for (const s of w.subjects) {
    if (s.role !== "builder" || s.building >= 0 || s.quit) continue;
    let best: Building | null = null, bd = Infinity;
    for (const b of w.buildings) {
      if (b.done || buildAllowed(b) - b.progress <= 0.01) continue;
      if (buildersAt(w, b) >= CONFIG.builders.perSite) continue;
      const d = door(b), dd = dist(s.x, s.y, d.x, d.y);
      if (dd < bd) { bd = dd; best = b; }
    }
    if (best) { s.building = best.id; s.step = "toSite"; s.timer = 0; }
  }
}

function finish(w: World, b: Building) {
  b.done = true;
  b.status = "";
  b.delivered = { wood: 0, stone: 0, grain: 0, flour: 0, bread: 0 };
  if (b.type === "farm") openFields(w, b);
  log(w, `${BUILDINGS[b.type].name} finished.`);
  for (const s of w.subjects) if (s.role === "builder" && s.building === b.id) { s.building = -1; s.step = ""; }
}

export function updateBuilder(w: World, s: Subject, dt: number) {
  const b = s.building >= 0 ? byId(w, s.building) : undefined;
  if (!b || b.done) {
    s.building = -1;
    s.moving = false;
    if (s.quit) { s.role = "idle"; s.quit = false; }
    return;
  }
  // Each builder stands at its own spot along the front of the site.
  const slot = w.subjects.filter((o) => o.role === "builder" && o.building === b.id).findIndex((o) => o.id === s.id);
  const spotX = b.x + b.size * (slot === 0 ? 0.3 : 0.7);
  const spotY = b.y + b.size + 0.05;
  if (s.step === "toSite") {
    if (walkTo(w, s, spotX, spotY, dt)) s.step = "building";
    return;
  }
  const allowed = buildAllowed(b);
  if (b.progress < allowed) {
    b.progress = Math.min(allowed, b.progress + dt);
    b.status = "Being built";
    s.timer = 0;
    if (b.progress >= BUILDINGS[b.type].buildTime - 1e-6) finish(w, b);
  } else {
    b.status = "Waiting for materials";
    s.timer += dt;
    // Nothing to do here for a while: free up for another site.
    if (s.timer > 3) { s.building = -1; s.step = ""; s.timer = 0; if (s.quit) { s.role = "idle"; s.quit = false; } }
  }
}
