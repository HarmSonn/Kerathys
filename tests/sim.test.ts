import { describe, expect, it } from "vitest";
import { BUILDINGS, CONFIG } from "../src/data/config";
import { botTick } from "../src/sim/bot";
import { deserialize, serialize } from "../src/sim/save";
import { advance, placeBuilding, recruit, setLimit, setPool, setWorkers } from "../src/sim/sim";
import { Terrain, World } from "../src/sim/state";
import { addBuilding, canPlace, createWorld, housing, idx, population, storedTotal, townCenter } from "../src/sim/world";

const DAY = CONFIG.time.day + CONFIG.time.night;

/** A flat world with no forest or hills, for controlled tests. */
function flatWorld(): World {
  const w = createWorld(0);
  for (const c of w.cells) { c.t = Terrain.Open; c.wood = 0; c.stone = 0; }
  return w;
}

const runToNightfall = (w: World) => advance(w, CONFIG.time.day - w.clock + 0.1);

describe("map generation", () => {
  it("is deterministic for a seed", () => {
    expect(serialize(createWorld(3))).toBe(serialize(createWorld(3)));
    expect(serialize(createWorld(3))).not.toBe(serialize(createWorld(4)));
  });

  it("has forest and hills, and an open start area", () => {
    const w = createWorld(0);
    expect(w.cells.filter((c) => c.t === Terrain.Forest).length).toBeGreaterThan(50);
    expect(w.cells.filter((c) => c.t === Terrain.Hill).length).toBeGreaterThan(20);
    for (let y = 17; y < 23; y++) for (let x = 17; x < 23; x++) expect(w.cells[idx(w, x, y)].t).toBe(Terrain.Open);
  });

  it("starts with the agreed state", () => {
    const w = createWorld(0);
    expect(population(w)).toBe(6);
    expect(housing(w)).toBe(8);
    expect(townCenter(w).stock).toMatchObject({ wood: 20, stone: 8, bread: 40 });
  });
});

describe("placement", () => {
  it("keeps a one-cell gap between buildings", () => {
    const w = flatWorld();
    expect(canPlace(w, "house", 22, 18)).toMatch(/Too close/);
    expect(canPlace(w, "house", 23, 18)).toBe("");
  });

  it("reserves a field ring around farms, which other buildings may touch", () => {
    const w = flatWorld();
    expect(placeBuilding(w, "farm", 10, 10)).toBe("");
    expect(canPlace(w, "house", 9, 12)).toMatch(/already there/); // on a field
    expect(canPlace(w, "house", 13, 10)).toBe(""); // touching the field ring
    expect(canPlace(w, "farm", 0, 10)).toMatch(/fields/); // ring would leave the map
  });

  it("needs a resource within reach for gatherers, but not under them", () => {
    const w = flatWorld();
    expect(canPlace(w, "woodcutter", 5, 5)).toMatch(/No trees/);
    w.cells[idx(w, 9, 6)].t = Terrain.Forest;
    w.cells[idx(w, 9, 6)].wood = 6;
    expect(canPlace(w, "woodcutter", 5, 5)).toBe("");
  });

  it("needs nothing paid at placement", () => {
    const w = flatWorld();
    townCenter(w).stock.wood = 0;
    expect(placeBuilding(w, "house", 25, 25)).toBe("");
  });
});

describe("food and hunger", () => {
  it("eats one loaf per two subjects at nightfall", () => {
    const w = flatWorld(); // 6 subjects, 40 bread
    runToNightfall(w);
    expect(storedTotal(w, "bread")).toBe(37);
    w.subjects.pop(); // 5 subjects round up to 3 loaves
    advance(w, DAY);
    expect(storedTotal(w, "bread")).toBe(34);
  });

  it("makes one subject leave on the second hungry night, idle subjects first", () => {
    const w = flatWorld();
    townCenter(w).stock.bread = 0;
    setPool(w, "carrier", 5);
    runToNightfall(w);
    expect(w.hungryNights).toBe(1);
    expect(population(w)).toBe(6);
    advance(w, DAY);
    expect(w.hungryNights).toBe(2);
    expect(population(w)).toBe(5);
    expect(w.subjects.filter((s) => s.role === "carrier").length).toBe(5);
  });

  it("resets the hungry count after a fed night", () => {
    const w = flatWorld();
    townCenter(w).stock.bread = 0;
    runToNightfall(w);
    townCenter(w).stock.bread = 10;
    advance(w, DAY);
    expect(w.hungryNights).toBe(0);
  });
});

describe("recruiting", () => {
  it("needs 10 bread in the Town Center and free housing", () => {
    const w = flatWorld();
    expect(recruit(w)).toBe("");
    expect(recruit(w)).toBe("");
    expect(population(w)).toBe(8);
    expect(recruit(w)).toMatch(/housing/);
    const w2 = flatWorld();
    townCenter(w2).stock.bread = 9;
    expect(recruit(w2)).toMatch(/bread/);
  });
});

describe("construction and carriers", () => {
  it("carries materials from the Town Center and builds the site", () => {
    const w = flatWorld();
    placeBuilding(w, "house", 24, 18);
    setPool(w, "carrier", 2);
    setPool(w, "builder", 1);
    advance(w, 100);
    const house = w.buildings.find((b) => b.type === "house" && b.x === 24)!;
    expect(house.done).toBe(true);
    expect(townCenter(w).stock.wood).toBe(20 - BUILDINGS.house.cost.wood!);
    expect(housing(w)).toBe(12);
  });

  it("can't build further than the delivered materials allow", () => {
    const w = flatWorld();
    townCenter(w).stock.wood = 3; // half of the house's wood
    townCenter(w).stock.stone = 0;
    placeBuilding(w, "house", 24, 18);
    setPool(w, "carrier", 2);
    setPool(w, "builder", 1);
    advance(w, 115);
    const house = w.buildings.find((b) => b.type === "house" && b.x === 24)!;
    expect(house.done).toBe(false);
    expect(house.progress).toBeCloseTo(BUILDINGS.house.buildTime * (3 / 8), 1);
  });

  it("respects store limits", () => {
    const w = flatWorld();
    const area = addBuilding(w, "storageArea", 24, 18, true);
    setLimit(w, area, "wood", 0);
    const cutter = addBuilding(w, "woodcutter", 26, 22, true);
    cutter.outBuf = 4;
    setPool(w, "carrier", 2);
    advance(w, 60);
    expect(area.stock.wood).toBe(0);
    expect(townCenter(w).stock.wood).toBe(24);
  });
});

describe("production", () => {
  it("woodcutters walk out, chop and use up the forest", () => {
    const w = flatWorld();
    for (let x = 27; x < 30; x++) { const c = w.cells[idx(w, x, 20)]; c.t = Terrain.Forest; c.wood = 2; }
    const cutter = addBuilding(w, "woodcutter", 25, 19, true);
    setWorkers(w, cutter, 2);
    setPool(w, "carrier", 1);
    advance(w, 3 * DAY);
    expect(townCenter(w).stock.wood).toBe(26); // all 6 wood, then nothing left
    expect(cutter.status).toMatch(/No trees/);
  });

  it("forests regrow one tree every 15 days", () => {
    const w = flatWorld();
    const c = w.cells[idx(w, 5, 5)];
    c.t = Terrain.Forest; c.wood = 0;
    advance(w, 14 * DAY);
    expect(c.wood).toBe(0);
    advance(w, 1.5 * DAY);
    expect(c.wood).toBe(2);
  });

  it("a compact, staffed food chain makes about 8 bread a day with 2 carriers", () => {
    const w = flatWorld();
    for (const s of w.subjects.slice(0, 2)) s.role = "idle";
    const farm = addBuilding(w, "farm", 22, 24, true);
    const mill = addBuilding(w, "mill", 26, 24, true);
    const bakery = addBuilding(w, "bakery", 26, 28, true);
    for (const i of w.cells.keys()) if (w.cells[i].farm === farm.id) w.cells[i].field = 1;
    for (let i = 0; i < 6; i++) recruitFree(w);
    setWorkers(w, farm, 2); setWorkers(w, mill, 1); setWorkers(w, bakery, 1);
    setPool(w, "carrier", 2);
    advance(w, 3 * DAY); // warm up
    const before = storedTotal(w, "bread") + bakery.outBuf;
    advance(w, 4 * DAY);
    const eaten = 4 * Math.ceil(population(w) / 2);
    const perDay = (storedTotal(w, "bread") + bakery.outBuf + eaten - before) / 4;
    expect(perDay).toBeGreaterThan(7);
    expect(perDay).toBeLessThanOrEqual(8.5);
  });
});

describe("save and load", () => {
  it("round-trips and continues identically", () => {
    const a = createWorld(1);
    for (let t = 0; t < 300; t++) { botTick(a); advance(a, 1); }
    const b = deserialize(serialize(a));
    for (let t = 0; t < 300; t++) { botTick(a); advance(a, 1); botTick(b); advance(b, 1); }
    expect(serialize(b)).toBe(serialize(a));
  });
});

/** Add a subject without spending bread (test helper). */
function recruitFree(w: World) {
  townCenter(w).stock.bread += CONFIG.food.recruitCost;
  addBuilding(w, "house", 2 + (w.buildings.length % 8) * 4, 34, true);
  recruit(w);
}
