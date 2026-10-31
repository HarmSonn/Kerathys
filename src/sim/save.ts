// Save and load: the world is plain data, so it round-trips through JSON.

import { World } from "./state";

export const SAVE_KEY = "kerathys.autosave";

export const serialize = (w: World): string => JSON.stringify(w);

export function deserialize(json: string): World {
  const w = JSON.parse(json) as World;
  if (w.version !== 1) throw new Error(`Unknown save version ${String(w.version)}`);
  return w;
}
