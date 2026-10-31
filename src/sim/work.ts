// Building workers: gatherers walk out to trees and rocks, farmers to their
// fields, millers and bakers work inside.

import { BUILDINGS, CONFIG } from "../data/config";
import { walkTo } from "./movement";
import { Building, Field, Subject, Terrain, World } from "./state";
import { byId, dist, door, fieldCells, resourceCells } from "./world";

const cellCentre = (w: World, i: number) => ({ x: (i % w.size) + 0.5, y: Math.floor(i / w.size) + 0.75 });

function nearestFree(w: World, b: Building, cells: number[], ok: (i: number) => boolean): number {
  const d = door(b);
  let best = -1, bd = Infinity;
  for (const i of cells) {
    if (!ok(i)) continue;
    const c = cellCentre(w, i), dd = dist(c.x, c.y, d.x, d.y);
    if (dd < bd) { bd = dd; best = i; }
  }
  return best;
}

/** Hand an item the worker is holding to the building (used when unassigning). */
export function releaseWorker(w: World, s: Subject) {
  const b = byId(w, s.building);
  if (s.cell >= 0) {
    const c = w.cells[s.cell];
    if (c.claimed > 0) c.claimed--;
    c.fieldClaimed = false;
    s.cell = -1;
  }
  if (b) {
    if (s.carry && b.outBuf < CONFIG.buffers.output) b.outBuf++;
    b.workers = b.workers.filter((id) => id !== s.id);
  }
  s.carry = null;
  s.building = -1;
  s.role = "idle";
  s.step = "";
  s.timer = 0;
}

export function updateWorker(w: World, s: Subject, dt: number) {
  const b = byId(w, s.building);
  if (!b) { s.role = "idle"; return; }
  const prod = BUILDINGS[b.type].production!;
  const home = door(b);

  switch (s.step) {
    case "toBuilding":
      if (walkTo(w, s, home.x, home.y, dt)) s.step = prod.kind === "process" ? "inside" : "home";
      return;

    case "inside": {
      if (b.processing > 0) {
        b.processing -= dt;
        if (b.processing <= 0) { b.processing = 0; b.outBuf++; }
        b.status = "Working";
      } else if (b.outBuf >= CONFIG.buffers.output) b.status = "Output full: waiting for carriers";
      else if (b.inBuf > 0) { b.inBuf--; b.processing = prod.workTime; b.status = "Working"; }
      else b.status = `Waiting for ${prod.input}`;
      return;
    }

    case "home": {
      if (s.timer > 0) { s.timer -= dt; return; }
      if (prod.kind === "gather") {
        if (b.outBuf >= CONFIG.buffers.output) { b.status = "Output full: waiting for carriers"; s.timer = 1; return; }
        const res = BUILDINGS[b.type].resource!;
        const target = nearestFree(w, b, resourceCells(w, b.workX, b.workY, res), (i) => {
          const c = w.cells[i];
          return (res === "forest" ? c.wood : c.stone) - c.claimed > 0;
        });
        if (target < 0) { b.status = res === "forest" ? "No trees left in the work area" : "No rock left in the work area"; s.timer = 2; return; }
        w.cells[target].claimed++;
        s.cell = target; s.step = "toResource"; b.status = "Working";
        return;
      }
      // Farm: harvest a ripe field if there's room for the grain, else sow an empty one.
      const fields = fieldCells(w, b.x, b.y, b.size).filter((i) => w.cells[i].farm === b.id);
      let target = -1;
      if (b.outBuf < CONFIG.buffers.output)
        target = nearestFree(w, b, fields, (i) => w.cells[i].field === Field.Ripe && !w.cells[i].fieldClaimed);
      if (target < 0) target = nearestFree(w, b, fields, (i) => w.cells[i].field === Field.Empty && !w.cells[i].fieldClaimed);
      if (target < 0) {
        b.status = b.outBuf >= CONFIG.buffers.output ? "Output full: waiting for carriers" : "Crops growing";
        s.timer = 1;
        return;
      }
      w.cells[target].fieldClaimed = true;
      s.cell = target; s.step = "toResource"; b.status = "Working";
      return;
    }

    case "toResource": {
      const c = cellCentre(w, s.cell);
      if (walkTo(w, s, c.x, c.y, dt)) { s.step = "working"; s.timer = prod.workTime; }
      return;
    }

    case "working": {
      s.timer -= dt;
      if (s.timer > 0) return;
      const c = w.cells[s.cell];
      if (prod.kind === "gather") {
        c.claimed--;
        if (c.t === Terrain.Forest) c.wood--; else c.stone--;
        s.carry = prod.output;
      } else {
        c.fieldClaimed = false;
        if (c.field === Field.Ripe) { c.field = Field.Empty; s.carry = prod.output; }
        else { c.field = Field.Growing; c.fieldTimer = CONFIG.farm.growTime; }
      }
      s.cell = -1;
      s.step = "returning";
      return;
    }

    case "returning":
      if (!walkTo(w, s, home.x, home.y, dt)) return;
      if (s.carry) { b.outBuf++; s.carry = null; }
      s.step = "home";
      return;
  }
}

/** Crops ripen and forests regrow (daylight only). */
export function updateNature(w: World, dt: number) {
  const regrowAfter = CONFIG.forest.regrowDays * CONFIG.time.day;
  const maxWood = CONFIG.forest.treesPerCell * CONFIG.forest.woodPerTree;
  for (const c of w.cells) {
    if (c.field === Field.Growing) {
      c.fieldTimer -= dt;
      if (c.fieldTimer <= 0) { c.field = Field.Ripe; c.fieldTimer = 0; }
    }
    if (c.t === Terrain.Forest && c.wood < maxWood) {
      c.regrow += dt;
      if (c.regrow >= regrowAfter) {
        c.regrow = 0;
        c.wood = Math.min(maxWood, c.wood + CONFIG.forest.woodPerTree);
      }
    }
  }
}

/** Fields become usable once their farm is finished. */
export function openFields(w: World, b: Building) {
  for (const i of fieldCells(w, b.x, b.y, b.size)) if (w.cells[i].farm === b.id) w.cells[i].field = Field.Empty;
}

