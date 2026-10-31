// Headless balancing runner: plays the scripted opening for N days and prints
// one line per day. Usage: npm run headless -- [days] [seed]

import { CONFIG, GOODS } from "../src/data/config";
import { botTick } from "../src/sim/bot";
import { advance } from "../src/sim/sim";
import { createWorld, housing, population, storedTotal } from "../src/sim/world";

const days = Number(process.argv[2] ?? 30);
const seed = Number(process.argv[3] ?? 0);
const w = createWorld(seed);
const cycle = CONFIG.time.day + CONFIG.time.night;

const pad = (v: string | number, n: number) => String(v).padStart(n);
console.log(
  ["day", "pop", "house", "idle", "carr", "build", ...GOODS, "busy%", "hungry", "buildings"].map((h, i) => pad(h, i === 13 ? 0 : 6)).join(""),
);

let lastEvent = 0;
for (let d = 1; d <= days; d++) {
  let busy = 0, samples = 0;
  for (let t = 0; t < cycle; t += 1) {
    botTick(w);
    advance(w, 1);
    const carriers = w.subjects.filter((s) => s.role === "carrier");
    busy += carriers.filter((s) => s.good).length;
    samples += carriers.length;
  }
  const roles = (r: string) => w.subjects.filter((s) => s.role === r).length;
  const built = w.buildings.filter((b) => b.done).length;
  console.log(
    [
      d, population(w), housing(w), roles("idle"), roles("carrier"), roles("builder"),
      ...GOODS.map((g) => storedTotal(w, g)),
      samples ? Math.round((busy / samples) * 100) : 0, w.hungryNights,
    ].map((v) => pad(v, 6)).join("") + `  ${built} built, ${w.buildings.length - built} sites`,
  );
  for (const e of w.events) if (e.t > lastEvent && /left|short/.test(e.text)) console.log(`        ! ${e.text}`);
  lastEvent = w.t;
}
