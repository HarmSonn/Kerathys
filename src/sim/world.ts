// Map generation, geometry helpers and placement rules.

import { BUILDINGS, BuildingType, CONFIG, Good } from "../data/config";
import { terrainFields } from "./noise";
import { Building, Cell, Field, Subject, Terrain, World, emptyStock } from "./state";

export const idx = (w: World, x: number, y: number) => y * w.size + x;
export const inMap = (w: World, x: number, y: number) => x >= 0 && y >= 0 && x < w.size && y < w.size;
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

/** Door point (bottom centre of the footprint) where goods and subjects enter. */
export const door = (b: Building) => ({ x: b.x + b.size / 2, y: b.y + b.size + 0.05 });
export const centre = (b: Building) => ({ x: b.x + b.size / 2, y: b.y + b.size / 2 });

export const byId = (w: World, id: number) => w.buildings.find((b) => b.id === id);
export const subjectById = (w: World, id: number) => w.subjects.find((s) => s.id === id);

export const isStore = (b: Building) => b.done && BUILDINGS[b.type].storage !== undefined;
export const townCenter = (w: World) => w.buildings.find((b) => b.type === "townCenter")!;

export function log(w: World, text: string) {
  w.events.push({ t: w.t, text });
  if (w.events.length > 40) w.events.shift();
}

export function createWorld(seed = 0): World {
  const size = CONFIG.map.size;
  const cells: Cell[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [forest, hill] = terrainFields(x + 0.5, y + 0.5, seed, size, CONFIG.map.startRadiusOpen);
      let t = Terrain.Open;
      if (hill > 0.58) t = Terrain.Hill;
      else if (forest > 0.55) t = Terrain.Forest;
      cells.push({
        t,
        wood: t === Terrain.Forest ? CONFIG.forest.treesPerCell * CONFIG.forest.woodPerTree : 0,
        stone: t === Terrain.Hill ? CONFIG.hill.stonePerCell : 0,
        regrow: 0, claimed: 0, heat: 0, crossed: false, occ: -1, farm: -1,
        field: Field.None, fieldTimer: 0, fieldClaimed: false,
      });
    }
  }
  const w: World = {
    version: 1, seed, size, t: 0, day: 1, clock: 0, night: false, cells, edges: {},
    buildings: [], subjects: [], nextId: 1, hungryNights: 0, dispatchTimer: 0, events: [],
  };

  const { start } = CONFIG;
  const tc = addBuilding(w, "townCenter", start.townCenter[0], start.townCenter[1], true, true);
  for (const g of Object.keys(start.stock) as Good[]) tc.stock[g] = start.stock[g]!;
  for (const [hx, hy] of start.houses) addBuilding(w, "house", hx, hy, true, true);
  const d = door(tc);
  for (let i = 0; i < start.subjects; i++) spawnSubject(w, d.x + (i - start.subjects / 2) * 0.4, d.y + 0.6);
  return w;
}

export function spawnSubject(w: World, x: number, y: number): Subject {
  const s: Subject = {
    id: w.nextId++, x, y, role: "idle", building: -1, assignedAt: 0, step: "", timer: 0,
    tx: x, ty: y, cell: -1, carry: null, good: null, from: null, to: null, quit: false,
    moving: false, facing: 1,
  };
  w.subjects.push(s);
  return s;
}

/** Cells of a farm's field ring (inside the map). */
export function fieldCells(w: World, x: number, y: number, size: number): number[] {
  const r = CONFIG.farm.fieldRing, out: number[] = [];
  for (let cy = y - r; cy < y + size + r; cy++) {
    for (let cx = x - r; cx < x + size + r; cx++) {
      const inside = cx >= x && cx < x + size && cy >= y && cy < y + size;
      if (!inside && inMap(w, cx, cy)) out.push(idx(w, cx, cy));
    }
  }
  return out;
}

/** Cells inside a work area circle that hold the given resource. */
export function resourceCells(w: World, cx: number, cy: number, res: "forest" | "hill"): number[] {
  const r = CONFIG.workArea.radius, out: number[] = [];
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (!inMap(w, x, y) || dist(x + 0.5, y + 0.5, cx, cy) > r) continue;
      const c = w.cells[idx(w, x, y)];
      if (res === "forest" ? c.t === Terrain.Forest && c.wood > 0 : c.t === Terrain.Hill && c.stone > 0) out.push(idx(w, x, y));
    }
  }
  return out;
}

/** "" if the building can go here, otherwise the reason it can't. */
export function canPlace(w: World, type: BuildingType, x: number, y: number): string {
  const def = BUILDINGS[type], n = def.size;
  for (let cy = y; cy < y + n; cy++) {
    for (let cx = x; cx < x + n; cx++) {
      if (!inMap(w, cx, cy)) return "Outside the map.";
      const c = w.cells[idx(w, cx, cy)];
      if (c.occ >= 0 || c.farm >= 0) return "Something is already there.";
      if (c.t !== Terrain.Open) return "Needs open ground.";
    }
  }
  // At least one empty cell between building footprints (fields may touch).
  for (let cy = y - 1; cy <= y + n; cy++) {
    for (let cx = x - 1; cx <= x + n; cx++) {
      if (inMap(w, cx, cy) && w.cells[idx(w, cx, cy)].occ >= 0) return "Too close to another building.";
    }
  }
  if (type === "farm") {
    for (const i of fieldCells(w, x, y, n)) {
      const c = w.cells[i];
      if (c.t !== Terrain.Open || c.occ >= 0 || c.farm >= 0) return "The farm needs open ground around it for fields.";
    }
    if (fieldCells(w, x, y, n).length < 4 * (n + 1)) return "The farm needs room for fields.";
  }
  if (def.resource) {
    if (resourceCells(w, x + n / 2, y + n / 2, def.resource).length === 0)
      return def.resource === "forest" ? "No trees within reach." : "No rock within reach.";
  }
  return "";
}

export function addBuilding(w: World, type: BuildingType, x: number, y: number, done = false, force = false): Building {
  const def = BUILDINGS[type];
  const b: Building = {
    id: w.nextId++, type, x, y, size: def.size, done, delivered: emptyStock(), progress: 0,
    incoming: emptyStock(), stock: emptyStock(), claimed: emptyStock(), limits: {},
    inBuf: 0, outBuf: 0, outClaimed: 0, processing: 0, workers: [],
    workX: x + def.size / 2, workY: y + def.size / 2, status: done ? "" : "Waiting for materials",
  };
  const claim = (i: number) => {
    const c = w.cells[i];
    if (force) { c.t = Terrain.Open; c.wood = 0; c.stone = 0; }
  };
  for (let cy = y; cy < y + def.size; cy++) {
    for (let cx = x; cx < x + def.size; cx++) {
      const i = idx(w, cx, cy);
      claim(i);
      w.cells[i].occ = b.id;
    }
  }
  if (type === "farm") {
    for (const i of fieldCells(w, x, y, def.size)) {
      claim(i);
      w.cells[i].farm = b.id;
    }
  }
  w.buildings.push(b);
  return b;
}

export const population = (w: World) => w.subjects.filter((s) => s.role !== "leaving").length;
export const housing = (w: World) =>
  w.buildings.reduce((n, b) => n + (b.done ? BUILDINGS[b.type].housing ?? 0 : 0), 0);

/** Total of a good across all stores. */
export const storedTotal = (w: World, g: Good) =>
  w.buildings.reduce((n, b) => n + (isStore(b) ? b.stock[g] : 0), 0);

export const stockTotal = (b: Building) => Object.values(b.stock).reduce((a, n) => a + n, 0);
export const incomingTotal = (b: Building) => Object.values(b.incoming).reduce((a, n) => a + n, 0);

/** Can this store take one more of good g (counting goods already on the way)? */
export function accepts(b: Building, g: Good): boolean {
  if (!isStore(b)) return false;
  const limit = b.limits[g] ?? Infinity;
  if (b.stock[g] + b.incoming[g] >= limit) return false;
  return stockTotal(b) + incomingTotal(b) < BUILDINGS[b.type].storage!;
}
