// HUD and panels as plain DOM. Panels are re-rendered from strings only when
// their content changes, and clicks go through data-action attributes.

import { BUILDINGS, BuildingType, CONFIG, GOODS, Good, PALETTE } from "../data/config";
import { buildAllowed } from "../sim/construction";
import { poolSize, recruit, setLimit, setPool, setWorkers } from "../sim/sim";
import { Building, World } from "../sim/state";
import { byId, housing, isStore, population, resourceCells, stockTotal, storedTotal, townCenter } from "../sim/world";

const GOOD_LABEL: Record<Good, string> = { wood: "Wood", stone: "Stone", grain: "Grain", flour: "Flour", bread: "Bread" };
const icon = (g: Good) => `<img class="gi" src="${import.meta.env.BASE_URL}art/goods/${g}.png" alt="">`;
const $ = (id: string) => document.getElementById(id)!;

export interface UiHost {
  world(): World;
  speed: number;
  setSpeed(n: number): void;
  tool: BuildingType | null;
  setTool(t: BuildingType | null): void;
  selected: number;
  select(id: number): void;
  save(): void;
  load(): void;
  newGame(): void;
}

export class Ui {
  private last = new Map<string, string>();
  private limitGood: Good = "wood";
  private msgTimer = 0;

  constructor(private host: UiHost) {
    $("speed").addEventListener("click", (e) => {
      const v = (e.target as HTMLElement).closest("button")?.dataset.speed;
      if (v !== undefined) host.setSpeed(Number(v));
    });
    $("palette").addEventListener("click", (e) => {
      const t = (e.target as HTMLElement).closest("button")?.dataset.tool;
      if (t === undefined) return;
      host.setTool(t === "" || host.tool === t ? null : (t as BuildingType));
      if (host.tool) this.message(`Place the ${BUILDINGS[host.tool].name.toLowerCase()}: click on the map. Esc or right-click cancels.`);
    });
    $("panel").addEventListener("click", (e) => this.onPanel(e));
    $("panel").addEventListener("change", (e) => {
      const el = e.target as HTMLSelectElement;
      if (el.dataset.action === "limit-good") { this.limitGood = el.value as Good; this.refresh(); }
    });
    $("menu").addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest("button")?.dataset.action;
      if (a === "save") { host.save(); this.message("Game saved."); }
      if (a === "load") host.load();
      if (a === "new" && confirm("Start a new game? The current game is lost unless you saved it.")) host.newGame();
    });
  }

  message(text: string, error = false) {
    const m = $("msg");
    m.textContent = text;
    m.className = error ? "err" : "";
    this.msgTimer = 6;
  }

  private set(id: string, html: string) {
    if (this.last.get(id) === html) return;
    this.last.set(id, html);
    $(id).innerHTML = html;
  }

  tick(dt: number) {
    this.msgTimer -= dt;
    if (this.msgTimer <= 0 && $("msg").textContent) { $("msg").textContent = ""; }
    this.refresh();
  }

  refresh() {
    const w = this.host.world();
    this.renderTop(w);
    this.renderPalette();
    this.renderPanel(w);
    for (const b of $("speed").querySelectorAll("button")) b.classList.toggle("on", Number(b.dataset.speed) === this.host.speed);
  }

  private renderTop(w: World) {
    const { day, night } = CONFIG.time;
    const phase = w.night ? "Night" : w.clock < 15 ? "Sunrise" : w.clock < 95 ? "Day" : "Sunset";
    const pct = Math.min(100, (w.clock / (day + night)) * 100);
    const pop = population(w), house = housing(w);
    const need = Math.ceil(pop / CONFIG.food.subjectsPerLoaf);
    const goods = GOODS.map((g) => `<span title="${GOOD_LABEL[g]} in all stores">${icon(g)}${storedTotal(w, g)}</span>`).join("");
    const hungry = w.hungryNights > 0 ? `<span class="bad">Hungry ${w.hungryNights} night${w.hungryNights > 1 ? "s" : ""}</span>` : "";
    this.set("stats",
      `<span class="day">Day ${w.day} · ${phase}<i style="width:${pct.toFixed(1)}%"></i></span>${goods}` +
      `<span title="Subjects / housing">👥 ${pop}/${house}</span><span title="Bread eaten tonight">🍞 −${need} tonight</span>${hungry}`);
  }

  private renderPalette() {
    const base = import.meta.env.BASE_URL;
    const items = PALETTE.map((t) => {
      const d = BUILDINGS[t];
      const cost = Object.entries(d.cost).map(([g, n]) => `${n} ${g}`).join(", ");
      return `<button data-tool="${t}" class="${this.host.tool === t ? "on" : ""}" title="${d.name}: ${cost}">` +
        `<img src="${base}art/ui/build_${t}.png" alt=""><span>${d.name}<small>${cost}</small></span></button>`;
    });
    this.set("palette", `<button data-tool="" class="${this.host.tool ? "" : "on"}"><span>✋ Select</span></button>${items.join("")}`);
  }

  private renderPanel(w: World) {
    const b = this.host.selected >= 0 ? byId(w, this.host.selected) : undefined;
    this.set("panel", b ? this.buildingPanel(w, b) : this.settlementPanel(w));
  }

  private settlementPanel(w: World): string {
    const idle = w.subjects.filter((s) => s.role === "idle").length;
    const pool = (role: "carrier" | "builder", label: string, hint: string) =>
      `<div class="row"><b>${label}</b><button data-action="pool" data-role="${role}" data-d="-1">−</button>` +
      `<span class="num">${poolSize(w, role)}</span><button data-action="pool" data-role="${role}" data-d="1">+</button><small>${hint}</small></div>`;
    const log = w.events.slice(-6).reverse().map((e) => `<li>Day ${Math.floor(e.t / (CONFIG.time.day + CONFIG.time.night)) + 1}: ${e.text}</li>`).join("");
    return `<h2>Settlement</h2>` +
      pool("carrier", "Carriers", "haul goods, one at a time") +
      pool("builder", "Builders", "build construction sites") +
      `<div class="row"><b>Idle</b><span class="num">${idle}</span><small>wait at the Town Center</small></div>` +
      `<p class="hint">Click a building to manage it. Click the Town Center to recruit.</p>` +
      `<ul class="log">${log}</ul>`;
  }

  private buildingPanel(w: World, b: Building): string {
    const def = BUILDINGS[b.type];
    let h = `<h2>${def.name}</h2><button class="close" data-action="close" title="Close">×</button>`;
    if (!b.done) {
      const goods = Object.keys(def.cost) as Good[];
      h += `<p class="status">${b.status}</p><div class="bars">` +
        `<label>Built ${Math.round((b.progress / def.buildTime) * 100)}%<progress max="${def.buildTime}" value="${b.progress}"></progress></label></div>` +
        `<p>Materials: ${goods.map((g) => `${icon(g)}${b.delivered[g]}/${def.cost[g]}${b.incoming[g] ? ` (+${b.incoming[g]} coming)` : ""}`).join(" ")}</p>` +
        `<p class="hint">Carriers bring materials; builders can work up to ${Math.round((buildAllowed(b) / def.buildTime) * 100)}% with what's here.</p>`;
      return h;
    }
    if (def.workers) {
      const p = def.production!;
      h += `<p class="status">${b.status || "No workers"}</p>` +
        `<div class="row"><b>Workers</b><button data-action="workers" data-d="-1">−</button><span class="num">${b.workers.length}/${def.workers}</span>` +
        `<button data-action="workers" data-d="1">+</button></div>`;
      if (p.input) h += `<p>Input ${icon(p.input)} ${b.inBuf}/${CONFIG.buffers.input}</p>`;
      h += `<p>Output ${icon(p.output)} ${b.outBuf}/${CONFIG.buffers.output} waiting for carriers</p>`;
      if (def.resource) {
        const n = resourceCells(w, b.workX, b.workY, def.resource).length;
        h += `<p class="hint">${n} ${def.resource === "forest" ? "forest" : "rock"} cells in reach. Drag the white dot to move the work area.</p>`;
      }
      if (b.type === "farm") h += `<p class="hint">Farmers sow the fields around the farm, wait for the crop to ripen, then harvest.</p>`;
    }
    if (def.housing) h += `<p>Room for ${def.housing} subjects.</p>`;
    if (isStore(b)) h += this.storeSection(w, b);
    return h;
  }

  private storeSection(w: World, b: Building): string {
    const cap = BUILDINGS[b.type].storage!;
    let h = "";
    if (b.type === "townCenter") {
      const pop = population(w), free = housing(w) - pop;
      h += `<div class="row"><button class="big" data-action="recruit">Recruit a subject (${CONFIG.food.recruitCost} bread)</button></div>` +
        `<p class="hint">Bread here: ${townCenter(w).stock.bread}. Free housing: ${free}.</p>`;
    }
    h += `<p><b>Stored ${stockTotal(b)}/${cap}</b></p><table class="stock">`;
    for (const g of GOODS) {
      const lim = b.limits[g];
      h += `<tr><td>${icon(g)}${GOOD_LABEL[g]}</td><td class="num">${b.stock[g]}</td><td class="lim">${lim === undefined ? "" : `limit ${lim}`}</td></tr>`;
    }
    h += `</table><div class="limits"><b>Limit</b><select data-action="limit-good">` +
      GOODS.map((g) => `<option value="${g}"${g === this.limitGood ? " selected" : ""}>${GOOD_LABEL[g]}</option>`).join("") +
      `</select>` + [-5, -1, 1, 5].map((d) => `<button data-action="limit" data-d="${d}">${d > 0 ? "+" : "−"}${Math.abs(d)}</button>`).join("") +
      `<button data-action="limit-off">No limit</button></div>` +
      `<p class="hint">${GOOD_LABEL[this.limitGood]}: ${b.limits[this.limitGood] === undefined ? "no limit" : `at most ${b.limits[this.limitGood]}`}. A limit of 0 refuses it.</p>`;
    return h;
  }

  private onPanel(e: Event) {
    const el = (e.target as HTMLElement).closest("button");
    if (!el) return;
    const w = this.host.world();
    const b = this.host.selected >= 0 ? byId(w, this.host.selected) : undefined;
    const d = Number(el.dataset.d ?? 0);
    let err = "";
    switch (el.dataset.action) {
      case "close": this.host.select(-1); break;
      case "pool": {
        const role = el.dataset.role as "carrier" | "builder";
        err = setPool(w, role, poolSize(w, role) + d);
        break;
      }
      case "workers": if (b) err = setWorkers(w, b, b.workers.length + d); break;
      case "recruit": err = recruit(w); if (!err) this.message("A new subject has joined."); break;
      case "limit": if (b) setLimit(w, b, this.limitGood, (b.limits[this.limitGood] ?? b.stock[this.limitGood]) + d); break;
      case "limit-off": if (b) setLimit(w, b, this.limitGood, undefined); break;
    }
    if (err) this.message(err, true);
    this.refresh();
  }
}
