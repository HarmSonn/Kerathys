// The whole simulation state. Plain data only (ids, no object references),
// so it serialises to JSON for save/load and stays deterministic.

import { BuildingType, Good } from "../data/config";

export enum Terrain { Open = 0, Forest = 1, Hill = 2 }
export enum Field { None = 0, Empty = 1, Growing = 2, Ripe = 3 }

export interface Cell {
  t: Terrain;
  wood: number;
  stone: number;
  /** Daylight seconds accumulated towards the next tree. */
  regrow: number;
  /** Units of wood/stone already claimed by a worker on the way. */
  claimed: number;
  heat: number;
  crossed: boolean;
  /** Building whose footprint covers this cell, or -1. */
  occ: number;
  /** Farm that owns this field cell, or -1. */
  farm: number;
  field: Field;
  fieldTimer: number;
  fieldClaimed: boolean;
}

export type Stock = Record<Good, number>;

export interface Building {
  id: number;
  type: BuildingType;
  x: number;
  y: number;
  size: number;
  done: boolean;
  /** Construction: materials on site, and seconds of building done. */
  delivered: Stock;
  progress: number;
  /** Goods on their way here (site materials, processor input, store stock). */
  incoming: Stock;
  /** Store contents and goods already claimed by a carrier. */
  stock: Stock;
  claimed: Stock;
  limits: Partial<Record<Good, number>>;
  inBuf: number;
  outBuf: number;
  outClaimed: number;
  /** Processor work in progress (seconds left), 0 when idle. */
  processing: number;
  workers: number[];
  workX: number;
  workY: number;
  status: string;
}

export type Role = "idle" | "worker" | "carrier" | "builder" | "leaving";

export interface Ref { kind: "store" | "out" | "site" | "input"; id: number }

export interface Subject {
  id: number;
  x: number;
  y: number;
  role: Role;
  building: number;
  assignedAt: number;
  /** State-machine step for the current role. */
  step: string;
  timer: number;
  /** Target point for walking. */
  tx: number;
  ty: number;
  /** Cell index a worker is working, or -1. */
  cell: number;
  carry: Good | null;
  /** Carrier job. */
  good: Good | null;
  from: Ref | null;
  to: Ref | null;
  /** Carrier/builder asked to stop after the current job. */
  quit: boolean;
  moving: boolean;
  facing: number;
}

export interface GameEvent { t: number; text: string }

export interface World {
  version: 1;
  seed: number;
  size: number;
  t: number;
  day: number;
  /** Seconds into the current 125 s cycle. */
  clock: number;
  night: boolean;
  cells: Cell[];
  edges: Record<string, number>;
  buildings: Building[];
  subjects: Subject[];
  nextId: number;
  hungryNights: number;
  dispatchTimer: number;
  events: GameEvent[];
}

export const emptyStock = (): Stock => ({ wood: 0, stone: 0, grain: 0, flour: 0, bread: 0 });
