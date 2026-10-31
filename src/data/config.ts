// All slice 1 numbers live here, so balancing never needs code changes.
// Source: docs/game-rules.md. Times are real seconds at 1x speed.

export type Good = "wood" | "stone" | "grain" | "flour" | "bread";
export const GOODS: Good[] = ["wood", "stone", "grain", "flour", "bread"];

export type BuildingType =
  | "townCenter"
  | "storageArea"
  | "storehouse"
  | "house"
  | "woodcutter"
  | "quarry"
  | "farm"
  | "mill"
  | "bakery";

export interface Production {
  kind: "gather" | "farm" | "process";
  /** Seconds of work per item (gather: at the resource; process: inside). */
  workTime: number;
  output: Good;
  input?: Good;
}

export interface BuildingDef {
  name: string;
  size: number; // footprint is size x size cells
  cost: Partial<Record<Good, number>>;
  buildTime: number;
  storage?: number;
  housing?: number;
  workers?: number;
  production?: Production;
  /** Cell type a gatherer works on. */
  resource?: "forest" | "hill";
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  townCenter: { name: "Town Center", size: 4, cost: {}, buildTime: 0, storage: 300 },
  storageArea: { name: "Storage area", size: 2, cost: { wood: 4 }, buildTime: 20, storage: 200 },
  storehouse: { name: "Storehouse", size: 3, cost: { wood: 8, stone: 4 }, buildTime: 60, storage: 400 },
  house: { name: "House", size: 2, cost: { wood: 6, stone: 2 }, buildTime: 40, housing: 4 },
  woodcutter: {
    name: "Woodcutter", size: 2, cost: { wood: 3 }, buildTime: 30, workers: 2, resource: "forest",
    production: { kind: "gather", workTime: 30, output: "wood" },
  },
  quarry: {
    name: "Quarry", size: 2, cost: { wood: 4 }, buildTime: 30, workers: 3, resource: "hill",
    production: { kind: "gather", workTime: 45, output: "stone" },
  },
  farm: {
    name: "Farm", size: 2, cost: { wood: 6 }, buildTime: 40, workers: 2,
    production: { kind: "farm", workTime: 12, output: "grain" },
  },
  mill: {
    name: "Mill", size: 3, cost: { wood: 7, stone: 3 }, buildTime: 60, workers: 1,
    production: { kind: "process", workTime: 15, input: "grain", output: "flour" },
  },
  bakery: {
    name: "Bakery", size: 3, cost: { wood: 7, stone: 3 }, buildTime: 60, workers: 1,
    production: { kind: "process", workTime: 15, input: "flour", output: "bread" },
  },
};

/** Buildings the player can place, in palette order. */
export const PALETTE: BuildingType[] = [
  "woodcutter", "quarry", "farm", "mill", "bakery", "house", "storageArea", "storehouse",
];

export const CONFIG = {
  map: { size: 40, startRadiusOpen: [5, 9] as [number, number] },
  time: { step: 0.1, day: 120, night: 5 },
  walk: { bare: 1.0, path: 1.5 },
  paths: { cap: 150, visible: 5, full: 100, fastAt: 100, fadePerDay: 1 },
  forest: { treesPerCell: 3, woodPerTree: 2, regrowDays: 15 },
  hill: { stonePerCell: 20 },
  farm: { growTime: 60, fieldRing: 1 },
  workArea: { radius: 4, maxOffset: 6 },
  buffers: { output: 8, input: 8 },
  builders: { perSite: 2 },
  food: { subjectsPerLoaf: 2, recruitCost: 10, townCenterReserve: 30, leaveAfterHungryNights: 2 },
  start: {
    subjects: 6,
    stock: { wood: 20, stone: 8, bread: 40 } as Partial<Record<Good, number>>,
    townCenter: [18, 18] as [number, number],
    houses: [[15, 17], [15, 20]] as [number, number][],
  },
  dispatchInterval: 0.5,
};
