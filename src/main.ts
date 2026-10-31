// Boots the game: loads art, creates or restores the world, and runs the
// fixed-step simulation alongside rendering, camera and input.

import { Application } from "pixi.js";
import "./style.css";
import { CELL_PX } from "./data/art";
import { BUILDINGS, BuildingType, CONFIG } from "./data/config";
import { loadArt } from "./render/assets";
import { WorldView } from "./render/renderer";
import { SAVE_KEY, deserialize, serialize } from "./sim/save";
import { moveWorkArea, placeBuilding, step } from "./sim/sim";
import { World } from "./sim/state";
import { createWorld, dist, townCenter } from "./sim/world";
import { Ui, UiHost } from "./ui/ui";

const P = CELL_PX;
const MANUAL_KEY = "kerathys.save";

function storageGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private mode: no saving */ }
}

async function boot() {
  const app = new Application();
  await app.init({ resizeTo: $("game"), background: 0x2b3a2a, antialias: true, autoDensity: true, resolution: window.devicePixelRatio || 1 });
  $("game").appendChild(app.canvas);

  const loading = $("loading");
  const art = await loadArt(app.renderer, (p) => (loading.textContent = `Loading art… ${Math.round(p * 100)}%`));
  loading.remove();

  let world: World = restore(storageGet(SAVE_KEY)) ?? createWorld(0);
  const view = new WorldView(art.textures, art.images);
  app.stage.addChild(view.root);
  view.setWorld(world);

  // ---------------------------------------------------------------- camera
  const cam = { x: 0, y: 0, zoom: 0.8 };
  const applyCam = () => {
    const size = world.size * P;
    const sw = app.screen.width, sh = app.screen.height;
    cam.zoom = Math.min(2, Math.max(Math.max(sw, sh) / size / 1.05, cam.zoom));
    cam.x = Math.min(size - sw / cam.zoom / 2, Math.max(sw / cam.zoom / 2, cam.x));
    cam.y = Math.min(size - sh / cam.zoom / 2, Math.max(sh / cam.zoom / 2, cam.y));
    view.root.scale.set(cam.zoom);
    view.root.position.set(sw / 2 - cam.x * cam.zoom, sh / 2 - cam.y * cam.zoom);
  };
  const centreOn = (wx: number, wy: number) => { cam.x = wx; cam.y = wy; applyCam(); };
  const tc = townCenter(world);
  centreOn((tc.x + 2) * P, (tc.y + 3) * P);
  const toWorld = (sx: number, sy: number) => ({ x: (sx - view.root.x) / cam.zoom, y: (sy - view.root.y) / cam.zoom });

  // ---------------------------------------------------------------- state
  let speed = 1, tool: BuildingType | null = null, acc = 0;
  const host: UiHost = {
    world: () => world,
    get speed() { return speed; },
    setSpeed: (n) => { speed = n; },
    get tool() { return tool; },
    setTool: (t) => { tool = t; if (!t) view.ghost = null; else view.selected = -1; },
    get selected() { return view.selected; },
    select: (id) => { view.selected = id; },
    save: () => storageSet(MANUAL_KEY, serialize(world)),
    load: () => {
      const w = restore(storageGet(MANUAL_KEY));
      if (!w) { ui.message("No saved game found.", true); return; }
      world = w; view.setWorld(world); view.selected = -1; ui.message("Game loaded.");
    },
    newGame: () => { world = createWorld(Math.floor(Math.random() * 1000)); view.setWorld(world); view.selected = -1; storageSet(SAVE_KEY, serialize(world)); },
  };
  const ui = new Ui(host);

  // ---------------------------------------------------------------- input
  const canvas = app.canvas;
  const pointers = new Map<number, { x: number; y: number }>();
  let dragged = false, downAt = { x: 0, y: 0 }, pinch = 0, dragWork = -1;
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    dragged = false; downAt = { x: e.offsetX, y: e.offsetY };
    if (e.button === 2) { host.setTool(null); ui.refresh(); return; }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = dist(a.x, a.y, b.x, b.y);
    }
    // Grab a selected gatherer's work-area dot.
    const sel = view.selected >= 0 ? world.buildings.find((b) => b.id === view.selected) : undefined;
    if (sel && BUILDINGS[sel.type].resource) {
      const p = toWorld(e.offsetX, e.offsetY);
      if (dist(p.x, p.y, sel.workX * P, sel.workY * P) < Math.max(20 / cam.zoom, P * 0.6)) dragWork = sel.id;
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    const p = toWorld(e.offsetX, e.offsetY);
    if (tool && e.pointerType === "mouse") {
      const n = BUILDINGS[tool].size;
      view.ghost = { type: tool, x: Math.round(p.x / P - n / 2), y: Math.round(p.y / P - n / 2) };
    }
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    if (dragWork >= 0) {
      const b = world.buildings.find((o) => o.id === dragWork);
      if (b) moveWorkArea(world, b, p.x / P, p.y / P);
      dragged = true;
      return;
    }
    if (pointers.size === 2) {
      pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      const [a, b] = [...pointers.values()];
      const d = dist(a.x, a.y, b.x, b.y);
      if (pinch > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch);
      pinch = d; dragged = true;
      return;
    }
    if (dist(e.offsetX, e.offsetY, downAt.x, downAt.y) > 6) dragged = true;
    if (dragged) {
      cam.x -= (e.offsetX - prev.x) / cam.zoom;
      cam.y -= (e.offsetY - prev.y) / cam.zoom;
      applyCam();
    }
    pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
  });

  const endPointer = (e: PointerEvent) => {
    const wasDrag = dragged || pointers.size > 1;
    pointers.delete(e.pointerId);
    if (dragWork >= 0) { dragWork = -1; return; }
    if (wasDrag || e.button === 2 || e.type === "pointercancel") return;
    const p = toWorld(e.offsetX, e.offsetY);
    if (tool) {
      const n = BUILDINGS[tool].size;
      const x = Math.round(p.x / P - n / 2), y = Math.round(p.y / P - n / 2);
      // On touch, the first tap shows the outline and a second tap on it builds.
      if (e.pointerType !== "mouse" && !(view.ghost && view.ghost.x === x && view.ghost.y === y)) {
        view.ghost = { type: tool, x, y };
        ui.message("Tap the outline again to build here.");
        return;
      }
      const err = placeBuilding(world, tool, x, y);
      if (err) ui.message(err, true);
      else { ui.message(`${BUILDINGS[tool].name} placed. Carriers will bring the materials.`); if (e.pointerType !== "mouse") view.ghost = null; }
    } else {
      view.selected = view.pick(p.x, p.y)?.id ?? -1;
    }
    ui.refresh();
  };
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("pointerleave", () => { if (tool) view.ghost = null; });

  const zoomAt = (sx: number, sy: number, k: number) => {
    const before = toWorld(sx, sy);
    cam.zoom = Math.min(2, Math.max(0.3, cam.zoom * k));
    applyCam();
    const after = toWorld(sx, sy);
    cam.x += before.x - after.x; cam.y += before.y - after.y;
    applyCam();
  };
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });

  const keys = new Set<string>();
  window.addEventListener("keydown", (e) => {
    if ((e.target as HTMLElement).tagName === "SELECT") return;
    keys.add(e.key.toLowerCase());
    if (e.key === "Escape") { host.setTool(null); view.selected = -1; ui.refresh(); }
    if (e.key === " ") { e.preventDefault(); speed = speed ? 0 : 1; }
    if (e.key === "1") speed = 1;
    if (e.key === "2") speed = 2;
    if (e.key === "3") speed = 4;
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  // The page layout settles after the UI renders, so follow the game area's size.
  new ResizeObserver(() => { app.resize(); applyCam(); }).observe($("game"));

  // Autosave at every sunrise and when the page is hidden.
  let savedDay = world.day;
  const autosave = () => storageSet(SAVE_KEY, serialize(world));
  document.addEventListener("visibilitychange", () => { if (document.hidden) autosave(); });

  // ---------------------------------------------------------------- loop
  let uiTimer = 0;
  app.ticker.add((t) => {
    const dt = Math.min(0.1, t.deltaMS / 1000);
    acc += dt * speed;
    let steps = 0;
    while (acc >= CONFIG.time.step && steps < 60) { step(world); acc -= CONFIG.time.step; steps++; }
    if (steps === 60) acc = 0;
    if (world.day !== savedDay) { savedDay = world.day; autosave(); }

    const pan = 600 * dt / cam.zoom;
    if (keys.has("a") || keys.has("arrowleft")) cam.x -= pan;
    if (keys.has("d") || keys.has("arrowright")) cam.x += pan;
    if (keys.has("w") || keys.has("arrowup")) cam.y -= pan;
    if (keys.has("s") || keys.has("arrowdown")) cam.y += pan;
    if (keys.size) applyCam();

    view.update(dt, cam.zoom);
    uiTimer -= dt;
    if (uiTimer <= 0) { uiTimer = 0.25; ui.tick(0.25); }
  });
  ui.refresh();
  (window as unknown as { kerathys: unknown }).kerathys = { world: () => world, host };
}

function restore(json: string | null): World | null {
  if (!json) return null;
  try { return deserialize(json); } catch (e) { console.warn("Could not load save:", e); return null; }
}

const $ = (id: string) => document.getElementById(id)!;
boot();
