// The fixed-step simulation loop and every action the player can take.
// No rendering or DOM code here.

import { BUILDINGS, BuildingType, CONFIG, Good } from "../data/config";
import { dispatchBuilders, updateBuilder } from "./construction";
import { cancelCarry, dispatchCarriers, updateCarrier } from "./logistics";
import { fadePaths, walkTo } from "./movement";
import { Building, Subject, World } from "./state";
import { releaseWorker, updateNature, updateWorker } from "./work";
import {
  addBuilding, canPlace, centre, dist, door, housing, isStore, log, population, spawnSubject, townCenter,
} from "./world";

const STEP = CONFIG.time.step;

/** Advance the world by `seconds` of game time, in fixed steps. */
export function advance(w: World, seconds: number) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) step(w);
}

export function step(w: World) {
  const dt = STEP;
  // Rounded so fixed steps never drift past day boundaries.
  w.t = Math.round((w.t + dt) * 1000) / 1000;
  w.clock = Math.round((w.clock + dt) * 1000) / 1000;
  const { day, night } = CONFIG.time;

  if (!w.night && w.clock >= day) {
    w.night = true;
    nightfall(w);
  }
  if (w.night) {
    if (w.clock >= day + night) {
      w.night = false;
      w.clock = 0;
      w.day++;
      fadePaths(w);
    }
    return; // everything sleeps
  }

  updateNature(w, dt);
  w.dispatchTimer -= dt;
  if (w.dispatchTimer <= 0) {
    w.dispatchTimer = CONFIG.dispatchInterval;
    dispatchCarriers(w);
    dispatchBuilders(w);
  }
  for (const s of [...w.subjects]) {
    switch (s.role) {
      case "worker": updateWorker(w, s, dt); break;
      case "carrier": updateCarrier(w, s, dt); break;
      case "builder": updateBuilder(w, s, dt); break;
      case "idle": updateIdle(w, s, dt); break;
      case "leaving": updateLeaving(w, s, dt); break;
    }
  }
}

function updateIdle(w: World, s: Subject, dt: number) {
  // Idle subjects wait in a loose crowd in front of the Town Center.
  const d = door(townCenter(w));
  const a = (s.id * 2.399) % (Math.PI * 2), r = 0.8 + ((s.id * 0.37) % 1) * 1.2;
  walkTo(w, s, d.x + Math.cos(a) * r, d.y + 0.8 + Math.abs(Math.sin(a)) * r * 0.8, dt);
}

function updateLeaving(w: World, s: Subject, dt: number) {
  if (walkTo(w, s, s.tx, s.ty, dt)) w.subjects = w.subjects.filter((o) => o.id !== s.id);
}

// ---------------------------------------------------------------- food

/** Stores eaten from first: storage areas and storehouses, Town Center last. */
const eatingOrder = (w: World) =>
  w.buildings.filter(isStore).sort((a, b) => Number(a.type === "townCenter") - Number(b.type === "townCenter"));

function nightfall(w: World) {
  const need = Math.ceil(population(w) / CONFIG.food.subjectsPerLoaf);
  let left = need;
  for (const b of eatingOrder(w)) {
    const free = b.stock.bread - b.claimed.bread;
    const take = Math.min(free, left);
    b.stock.bread -= take;
    left -= take;
  }
  if (left > 0) {
    w.hungryNights++;
    log(w, `Not enough bread tonight: ${left} short.`);
    if (w.hungryNights >= CONFIG.food.leaveAfterHungryNights) leave(w);
  } else w.hungryNights = 0;
}

function leave(w: World) {
  const order = ["idle", "carrier", "builder"] as const;
  let who: Subject | undefined;
  for (const role of order) {
    who = w.subjects.find((s) => s.role === role);
    if (who) break;
  }
  if (!who) {
    who = w.subjects.filter((s) => s.role === "worker").sort((a, b) => b.assignedAt - a.assignedAt)[0];
  }
  if (!who) return;
  if (who.role === "worker") releaseWorker(w, who);
  if (who.role === "carrier") cancelCarry(w, who);
  who.role = "leaving";
  who.building = -1;
  who.carry = null;
  // Walk to the nearest map edge.
  const edges = [[who.x, -1], [who.x, w.size + 1], [-1, who.y], [w.size + 1, who.y]];
  edges.sort((a, b) => dist(who!.x, who!.y, a[0], a[1]) - dist(who!.x, who!.y, b[0], b[1]));
  who.tx = edges[0][0]; who.ty = edges[0][1];
  log(w, "A hungry subject has left the settlement.");
}

// ---------------------------------------------------------------- actions

export function placeBuilding(w: World, type: BuildingType, x: number, y: number): string {
  const err = canPlace(w, type, x, y);
  if (err) return err;
  const b = addBuilding(w, type, x, y);
  log(w, `${BUILDINGS[type].name} placed.`);
  return b ? "" : "Could not place.";
}

const idleNearest = (w: World, x: number, y: number) =>
  w.subjects.filter((s) => s.role === "idle").sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y))[0];

/** Set the number of workers at a finished production building. */
export function setWorkers(w: World, b: Building, n: number): string {
  const slots = BUILDINGS[b.type].workers ?? 0;
  if (!b.done) return "Not finished yet.";
  n = Math.max(0, Math.min(slots, n));
  while (b.workers.length < n) {
    const d = door(b);
    const s = idleNearest(w, d.x, d.y);
    if (!s) return "No idle subjects.";
    s.role = "worker"; s.building = b.id; s.step = "toBuilding"; s.assignedAt = w.t;
    b.workers.push(s.id);
  }
  while (b.workers.length > n) {
    const s = w.subjects.find((o) => o.id === b.workers[b.workers.length - 1])!;
    releaseWorker(w, s);
  }
  if (b.workers.length === 0) { b.status = "No workers"; }
  return "";
}

/** Set the size of the carrier or builder pool. */
export function setPool(w: World, role: "carrier" | "builder", n: number): string {
  const members = w.subjects.filter((s) => s.role === role && !s.quit);
  n = Math.max(0, n);
  if (members.length < n) {
    // Cancel a pending quit before taking new people.
    for (const s of w.subjects) if (s.role === role && s.quit && members.length < n) { s.quit = false; members.push(s); }
    const tc = door(townCenter(w));
    while (members.length < n) {
      const s = idleNearest(w, tc.x, tc.y);
      if (!s) return "No idle subjects.";
      s.role = role; s.building = -1; s.step = ""; s.good = null;
      members.push(s);
    }
  }
  // Free members leave at once; busy ones finish their current job first.
  members.sort((a, b) => Number(isBusy(a)) - Number(isBusy(b)));
  while (members.length > n) {
    const s = members.shift()!;
    if (isBusy(s)) s.quit = true;
    else { s.role = "idle"; s.building = -1; s.step = ""; }
  }
  return "";
}

const isBusy = (s: Subject) => (s.role === "carrier" ? !!s.good : s.building >= 0);

export const poolSize = (w: World, role: "carrier" | "builder") =>
  w.subjects.filter((s) => s.role === role && !s.quit).length;

export function recruit(w: World): string {
  const tc = townCenter(w);
  const cost = CONFIG.food.recruitCost;
  if (population(w) >= housing(w)) return "No free housing. Build a house.";
  if (tc.stock.bread - tc.claimed.bread < cost) return `Needs ${cost} bread in the Town Center.`;
  tc.stock.bread -= cost;
  const d = door(tc);
  spawnSubject(w, d.x, d.y);
  log(w, "A new subject has joined.");
  return "";
}

/** Set a store's limit for one good; undefined removes the limit. */
export function setLimit(_w: World, b: Building, g: Good, limit: number | undefined) {
  if (limit === undefined) delete b.limits[g];
  else b.limits[g] = Math.max(0, Math.min(BUILDINGS[b.type].storage ?? 0, Math.round(limit)));
}

export function moveWorkArea(_w: World, b: Building, x: number, y: number) {
  const c = centre(b), max = CONFIG.workArea.maxOffset;
  const d = dist(x, y, c.x, c.y);
  const k = d > max ? max / d : 1;
  b.workX = c.x + (x - c.x) * k;
  b.workY = c.y + (y - c.y) * k;
}

