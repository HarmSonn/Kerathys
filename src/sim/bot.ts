// A simple scripted player, used by the headless runner and the tests.
// It plays a sensible opening so balance curves can be compared run to run.

import { BUILDINGS, BuildingType } from "../data/config";
import { placeBuilding, poolSize, recruit, setPool, setWorkers } from "./sim";
import { World } from "./state";
import { canPlace, centre, dist, housing, population, townCenter } from "./world";

/** Nearest valid spot for a building to a point, or null. */
export function findSpot(w: World, type: BuildingType, nx: number, ny: number): [number, number] | null {
  const n = BUILDINGS[type].size;
  let best: [number, number] | null = null, bd = Infinity;
  for (let y = 0; y < w.size; y++) {
    for (let x = 0; x < w.size; x++) {
      const d = dist(x + n / 2, y + n / 2, nx, ny);
      if (d >= bd || canPlace(w, type, x, y)) continue;
      bd = d; best = [x, y];
    }
  }
  return best;
}

const count = (w: World, type: BuildingType) => w.buildings.filter((b) => b.type === type).length;
const sites = (w: World) => w.buildings.filter((b) => !b.done).length;

function place(w: World, type: BuildingType, nx: number, ny: number) {
  const spot = findSpot(w, type, nx, ny);
  if (spot) placeBuilding(w, type, spot[0], spot[1]);
}

/** One decision tick of the scripted player. */
export function botTick(w: World) {
  const tc = centre(townCenter(w));
  const chains = Math.max(1, count(w, "bakery"));

  // Build order: one food chain, then grow with houses, a quarry and more chains.
  const done = (type: BuildingType) => w.buildings.some((b) => b.type === type && b.done);
  if (count(w, "woodcutter") === 0) place(w, "woodcutter", 14, 15);
  if (count(w, "farm") === 0) place(w, "farm", tc.x + 1, tc.y + 6);
  if (count(w, "mill") === 0) place(w, "mill", tc.x + 5, tc.y + 1);
  if (count(w, "bakery") === 0) place(w, "bakery", tc.x + 5, tc.y + 5);
  if (count(w, "quarry") === 0 && done("bakery")) place(w, "quarry", 26, 25);
  if (sites(w) === 0 && done("bakery") && population(w) >= housing(w) - 1) place(w, "house", tc.x - 4, tc.y - 4);
  if (sites(w) === 0 && population(w) >= 12 * chains && count(w, "woodcutter") < 2) place(w, "woodcutter", 12, 18);
  if (sites(w) === 0 && population(w) >= 12 * chains) {
    place(w, "farm", tc.x - 6, tc.y + 6);
    place(w, "mill", tc.x - 2, tc.y + 9);
    place(w, "bakery", tc.x + 2, tc.y + 9);
  }

  // Recruit only with bread to spare: keep two nights of food in hand.
  const tcBread = townCenter(w).stock.bread;
  if (done("bakery") && tcBread >= 10 + 2 * Math.ceil(population(w) / 2)) recruit(w);

  // Staff: one builder while there are sites, carriers for the producers.
  setPool(w, "builder", sites(w) > 0 ? 1 : 0);
  const producers = w.buildings.filter((b) => b.done && BUILDINGS[b.type].workers).length;
  const wantCarriers = Math.max(1, Math.ceil(producers * 0.6));
  if (poolSize(w, "carrier") < wantCarriers) setPool(w, "carrier", poolSize(w, "carrier") + 1);

  // Staffing order: first worker of each kind, then fill up.
  const firsts: [BuildingType, number][] = [
    ["woodcutter", 1], ["farm", 2], ["mill", 1], ["bakery", 1], ["woodcutter", 2], ["quarry", 1], ["quarry", 2],
  ];
  for (const [type, want] of firsts) {
    const ofType = w.buildings.filter((b) => b.type === type);
    // Keep people free for a building that's still under construction.
    if (ofType.some((b) => !b.done) && !ofType.some((b) => b.done)) break;
    for (const b of ofType) if (b.done && b.workers.length < want) setWorkers(w, b, want);
  }
}
