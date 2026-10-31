// Carriers and the job dispatcher. Carriers haul one item per trip.
// Priorities (docs/game-rules.md section 7):
//   1. construction materials to sites
//   2. inputs to processors
//   3. bread to the Town Center until it holds its reserve
//   4. emptying output buffers into the nearest store with room

import { BUILDINGS, CONFIG, Good } from "../data/config";
import { walkTo } from "./movement";
import { Building, Ref, Subject, World } from "./state";
import { accepts, byId, dist, door, isStore } from "./world";

interface Source { ref: Ref; b: Building }
interface Request { to: Ref; b: Building; good: Good; exclude?: number }

function sourcesOf(w: World, g: Good, exclude?: number): Source[] {
  const out: Source[] = [];
  for (const b of w.buildings) {
    if (!b.done || b.id === exclude) continue;
    if (isStore(b) && b.stock[g] - b.claimed[g] > 0) out.push({ ref: { kind: "store", id: b.id }, b });
    const p = BUILDINGS[b.type].production;
    if (p && p.output === g && b.outBuf - b.outClaimed > 0) out.push({ ref: { kind: "out", id: b.id }, b });
  }
  return out;
}

function requests(w: World): Request[][] {
  const levels: Request[][] = [[], [], []];
  for (const b of w.buildings) {
    const def = BUILDINGS[b.type];
    if (!b.done) {
      for (const g of Object.keys(def.cost) as Good[]) {
        if (def.cost[g]! - b.delivered[g] - b.incoming[g] > 0) levels[0].push({ to: { kind: "site", id: b.id }, b, good: g });
      }
      continue;
    }
    const p = def.production;
    if (p?.input && b.inBuf + b.incoming[p.input] < CONFIG.buffers.input)
      levels[1].push({ to: { kind: "input", id: b.id }, b, good: p.input });
    if (b.type === "townCenter" && b.stock.bread + b.incoming.bread < CONFIG.food.townCenterReserve && accepts(b, "bread"))
      levels[2].push({ to: { kind: "store", id: b.id }, b, good: "bread", exclude: b.id });
  }
  return levels;
}

function claim(w: World, s: Subject, good: Good, from: Source, to: Ref) {
  if (from.ref.kind === "store") from.b.claimed[good]++;
  else from.b.outClaimed++;
  byId(w, to.id)!.incoming[good]++;
  s.good = good; s.from = from.ref; s.to = to; s.step = "toPickup";
}

/** Give every free carrier its best job. */
export function dispatchCarriers(w: World) {
  const free = w.subjects.filter((s) => s.role === "carrier" && !s.good && !s.quit);
  if (free.length === 0) return;
  const levels = requests(w);
  for (const s of free) {
    let done = false;
    for (const level of levels) {
      let best: { req: Request; src: Source } | null = null, bd = Infinity;
      for (const req of level) {
        const rd = door(req.b);
        for (const src of sourcesOf(w, req.good, req.exclude)) {
          if (src.b.id === req.b.id) continue;
          const sd = door(src.b);
          const d = dist(s.x, s.y, sd.x, sd.y) + dist(sd.x, sd.y, rd.x, rd.y);
          if (d < bd) { bd = d; best = { req, src }; }
        }
      }
      if (best) {
        claim(w, s, best.req.good, best.src, best.req.to);
        // The request may still need more; recompute lazily on the next carrier.
        levels.splice(0, levels.length, ...requests(w));
        done = true;
        break;
      }
    }
    if (done) continue;

    // Priority 4: empty the fullest-nearest output buffer into the nearest store with room.
    let best: { src: Source; store: Building; good: Good } | null = null, bd = Infinity;
    for (const b of w.buildings) {
      const p = BUILDINGS[b.type].production;
      if (!b.done || !p || b.outBuf - b.outClaimed <= 0) continue;
      const bd0 = door(b);
      let store: Building | null = null, sd = Infinity;
      for (const st of w.buildings) {
        if (!accepts(st, p.output)) continue;
        const d = door(st), dd = dist(bd0.x, bd0.y, d.x, d.y);
        if (dd < sd) { sd = dd; store = st; }
      }
      if (!store) continue;
      const d = dist(s.x, s.y, bd0.x, bd0.y) + sd;
      if (d < bd) { bd = d; best = { src: { ref: { kind: "out", id: b.id }, b }, store, good: p.output }; }
    }
    if (best) claim(w, s, best.good, best.src, { kind: "store", id: best.store.id });
  }
}

/** Undo a carrier's claims (job cancelled before or after pickup). */
export function cancelCarry(w: World, s: Subject) {
  if (s.good && s.to) {
    const to = byId(w, s.to.id);
    if (to && to.incoming[s.good] > 0) to.incoming[s.good]--;
    if (s.step === "toPickup" && s.from) {
      const from = byId(w, s.from.id);
      if (from) {
        if (s.from.kind === "store") from.claimed[s.good]--;
        else from.outClaimed--;
      }
    }
  }
  s.good = null; s.from = null; s.to = null; s.carry = null; s.step = "";
}

export function updateCarrier(w: World, s: Subject, dt: number) {
  if (!s.good || !s.from || !s.to) {
    if (s.quit) { s.role = "idle"; s.quit = false; }
    s.moving = false;
    return;
  }
  if (s.step === "toPickup") {
    const from = byId(w, s.from.id)!;
    const d = door(from);
    if (!walkTo(w, s, d.x, d.y, dt)) return;
    if (s.from.kind === "store") { from.stock[s.good]--; from.claimed[s.good]--; }
    else { from.outBuf--; from.outClaimed--; }
    s.carry = s.good;
    s.step = "toDrop";
    return;
  }
  const to = byId(w, s.to.id)!;
  const d = door(to);
  if (!walkTo(w, s, d.x, d.y, dt)) return;
  to.incoming[s.good]--;
  if (s.to.kind === "site") to.delivered[s.good]++;
  else if (s.to.kind === "input") to.inBuf++;
  else to.stock[s.good]++;
  s.carry = null; s.good = null; s.from = null; s.to = null; s.step = "";
  if (s.quit) { s.role = "idle"; s.quit = false; }
}
