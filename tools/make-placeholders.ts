// Draws placeholder PNGs for every art file (public/art/) and templates for
// the artist (art/templates/), using the pre-installed Chromium.
// Usage: npm run placeholders            (only writes files that don't exist)
//        npm run placeholders -- --force (overwrites placeholders too)
//
// Never overwrite real drawings: without --force, existing files are kept.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
import { ArtFile, artManifest, templateManifest } from "../src/data/art";

const force = process.argv.includes("--force");
const root = join(dirname(new URL(import.meta.url).pathname), "..");

// Runs inside the browser page.
function drawAll(files: ArtFile[]): string[] {
  const BUILD_COLOURS: Record<string, [string, string]> = {
    townCenter: ["#c9b28a", "#8c3b2e"], storageArea: ["#b89a6a", "#7a6040"], storehouse: ["#a67c52", "#6b4a2e"],
    house: ["#d8c3a0", "#a5452f"], woodcutter: ["#8a6a45", "#4f6b3a"], quarry: ["#9a9ca3", "#5d5f66"],
    farm: ["#d9c06a", "#9a6a35"], mill: ["#e0d2b0", "#8a6a45"], bakery: ["#d8a46b", "#8c3b2e"],
  };
  const GOOD_COLOURS: Record<string, string> = { wood: "#8a5a2b", stone: "#9a9ca3", grain: "#e3c34a", flour: "#f2eee2", bread: "#c98a4b" };
  const out: string[] = [];
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  const outline = "#3b2f25";

  const label = (text: string, x: number, y: number, size: number) => {
    g.font = `600 ${size}px system-ui, sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = Math.max(3, size / 5); g.strokeStyle = "rgba(255,255,255,.85)";
    g.strokeText(text, x, y); g.fillStyle = outline; g.fillText(text, x, y);
  };
  const shape = (fill: string, path: () => void, lw = 4) => {
    g.beginPath(); path(); g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = outline; g.stroke();
  };

  const building = (f: ArtFile) => {
    const { w, h } = f, foot = w; // footprint is w x w at the bottom of the canvas
    const [wall, roof] = BUILD_COLOURS[f.variant!] ?? ["#ccc", "#888"];
    const left = w * 0.1, right = w * 0.9, base = h - foot * 0.12, top = h - foot * 0.62;
    if (f.variant === "storageArea") {
      // Open-air yard: a fenced plot with a few stacks.
      shape("#cdb98f", () => g.rect(w * 0.06, h - foot * 0.86, w * 0.88, foot * 0.78));
      for (let i = 0; i < 3; i++) shape("#a07a4a", () => g.rect(w * (0.16 + i * 0.25), h - foot * 0.55, w * 0.18, foot * 0.3));
      label(f.label, w / 2, h - foot * 0.2, w * 0.09);
      return;
    }
    // Front wall and a roof rising above the footprint (three-quarter view).
    shape(wall, () => g.rect(left, top, right - left, base - top));
    shape(roof, () => { g.moveTo(left - w * 0.05, top + 6); g.lineTo(w / 2, top - (h - foot) - foot * 0.25); g.lineTo(right + w * 0.05, top + 6); g.closePath(); });
    shape("#5a3e2a", () => g.rect(w / 2 - w * 0.07, base - foot * 0.22, w * 0.14, foot * 0.22));
    if (f.variant === "townCenter") shape("#e9d9b0", () => g.rect(w * 0.47, top - (h - foot) - foot * 0.45, w * 0.02 + 4, foot * 0.25));
    if (f.variant === "bakery") shape("#7a4a2a", () => g.rect(w * 0.7, top - (h - foot) * 0.9, w * 0.08, foot * 0.25));
    label(f.label, w / 2, (top + base) / 2 - foot * 0.05, Math.min(w * 0.11, 34));
  };

  const stage = (f: ArtFile, scaffold: boolean) => {
    const { w, h } = f, foot = w;
    shape("#b8a27a", () => g.rect(w * 0.08, h - foot * 0.5, w * 0.84, foot * 0.4));
    if (scaffold) {
      g.lineWidth = 6; g.strokeStyle = "#7a5a35";
      for (let i = 0; i <= 4; i++) { const x = w * (0.12 + i * 0.19); g.beginPath(); g.moveTo(x, h - foot * 0.12); g.lineTo(x, h - foot * 0.95); g.stroke(); }
      for (let j = 1; j <= 3; j++) { const y = h - foot * (0.12 + j * 0.25); g.beginPath(); g.moveTo(w * 0.1, y); g.lineTo(w * 0.9, y); g.stroke(); }
    }
    label(scaffold ? "scaffold" : "foundation", w / 2, h - foot * 0.3, w * 0.08);
  };

  const figure = (f: ArtFile) => {
    const { w, h } = f, cx = w / 2, frame = f.frame ?? 0;
    const away = f.variant === "away" || f.variant?.endsWith("away");
    if (f.kind === "sleep") {
      shape("#e8e8e8", () => g.ellipse(cx, h - 18, 26, 9, 0, 0, 7), 3);
      shape("#f1d3b0", () => g.arc(cx - 22, h - 22, 8, 0, 7), 3);
      label("z", cx + 14, h - 44, 18);
      return;
    }
    const walking = f.kind === "walk";
    const phase = walking ? Math.sin((frame / 6) * Math.PI * 2) : 0;
    const bob = walking ? Math.abs(phase) * 2 : f.kind === "idle" ? frame : 0;
    // Legs
    g.lineWidth = 6; g.strokeStyle = outline; g.lineCap = "round";
    g.beginPath(); g.moveTo(cx - 5, h - 34); g.lineTo(cx - 5 + phase * 9, h - 6); g.stroke();
    g.beginPath(); g.moveTo(cx + 5, h - 34); g.lineTo(cx + 5 - phase * 9, h - 6); g.stroke();
    // Tunic (pale, so the engine's job tint shows) and head
    shape("#eeeeee", () => g.roundRect(cx - 13, h - 66 - bob, 26, 36, 6), 3);
    shape("#f1d3b0", () => g.arc(cx, h - 76 - bob, 10, 0, 7), 3);
    if (away) shape("#6b4a2e", () => g.arc(cx, h - 78 - bob, 9, Math.PI, 0), 2);
    else { g.fillStyle = outline; g.fillRect(cx + 2, h - 79 - bob, 3, 3); }
    if (f.kind === "work") {
      // A tool swinging through 4 frames, facing right.
      const a = [-1.9, -1.1, -0.2, 0.5][frame];
      g.lineWidth = 5; g.strokeStyle = "#6b4a2e";
      const sx = cx + 8, sy = h - 58;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a) * 24, sy + Math.sin(a) * 24); g.stroke();
      shape("#9aa0a8", () => g.arc(sx + Math.cos(a) * 26, sy + Math.sin(a) * 26, 5, 0, 7), 2);
    }
  };

  const tree = (f: ArtFile, stump: boolean) => {
    const { w, h } = f, cx = w / 2;
    shape("#7a5232", () => g.rect(cx - 8, h - (stump ? 22 : 60), 16, stump ? 16 : 54), 3);
    if (stump) { shape("#c9a27a", () => g.ellipse(cx, h - 22, 8, 4, 0, 0, 7), 2); return; }
    const k = { a: 1, b: 0.85, c: 1.1 }[f.variant as "a" | "b" | "c"] ?? 1;
    shape("#2f6a3a", () => g.ellipse(cx, h - 92 * k, 38 * k, 50 * k, 0, 0, 7));
    shape("#44894f", () => g.ellipse(cx - 10, h - 106 * k, 18 * k, 22 * k, 0, 0, 7), 2);
  };

  const rock = (f: ArtFile) => {
    const { w, h } = f, s = [1, 0.7, 0.4][(f.frame ?? 1) - 1];
    shape("#8b8d93", () => g.ellipse(w / 2, h - 30 * s - 6, 42 * s, 30 * s, 0, 0, 7));
    shape("#b3b5ba", () => g.ellipse(w / 2 - 10 * s, h - 40 * s - 6, 18 * s, 11 * s, 0, 0, 7), 2);
  };

  const terrain = (f: ArtFile) => {
    const base: Record<string, [number, number, number]> = {
      grass: [104, 156, 78], forest_floor: [58, 104, 60], rocky_hill: [150, 140, 118], dirt_path: [160, 120, 72],
    };
    const [r0, g0, b0] = base[f.variant!];
    const img = g.createImageData(f.w, f.h);
    // Tileable value noise: sample on a torus so edges match.
    const hash = (x: number, y: number) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
    const P = 16;
    const noise = (x: number, y: number) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const s = (t: number) => t * t * (3 - 2 * t);
      const v = (a: number, b: number) => hash(((a % P) + P) % P, ((b % P) + P) % P);
      const a = v(xi, yi), b = v(xi + 1, yi), cc = v(xi, yi + 1), d = v(xi + 1, yi + 1);
      return a + (b - a) * s(xf) + (cc - a) * s(yf) + (a - b - cc + d) * s(xf) * s(yf);
    };
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      const n = noise((x / f.w) * P, (y / f.h) * P) * 0.6 + noise((x / f.w) * P * 2, (y / f.h) * P * 2) * 0.4;
      const i = (y * f.w + x) * 4, k = (n - 0.5) * 40;
      img.data[i] = r0 + k; img.data[i + 1] = g0 + k; img.data[i + 2] = b0 + k * 0.7; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  };

  const template = (f: ArtFile) => {
    const { w, h } = f;
    g.fillStyle = "rgba(255,255,255,1)"; g.fillRect(0, 0, w, h);
    const foot = f.kind === "tpl-building" ? w : f.kind === "tpl-subject" ? 0 : 128 * (f.kind === "tpl-tree" ? 0.75 : 0.75);
    if (f.kind === "tpl-building") {
      // Footprint area at the bottom, one cell = 128 px, and the extra height above.
      g.fillStyle = "rgba(120,170,255,.18)"; g.fillRect(0, h - foot, w, foot);
      g.strokeStyle = "rgba(60,110,200,.6)"; g.lineWidth = 2; g.setLineDash([8, 6]);
      for (let i = 0; i <= f.frame!; i++) {
        g.beginPath(); g.moveTo(i * 128, h - foot); g.lineTo(i * 128, h); g.stroke();
        g.beginPath(); g.moveTo(0, h - foot + i * 128); g.lineTo(w, h - foot + i * 128); g.stroke();
      }
      g.setLineDash([]);
      label("footprint (top-down ground)", w / 2, h - foot / 2, 18);
      label("room for roof / height", w / 2, (h - foot) / 2, 16);
    } else {
      g.strokeStyle = "rgba(60,110,200,.6)"; g.lineWidth = 2; g.setLineDash([6, 5]);
      g.strokeRect(1, 1, w - 2, h - 2); g.setLineDash([]);
      label(f.label, w / 2, 14, 12);
    }
    void foot;
    // Anchor: bottom centre, where the object touches the ground.
    g.strokeStyle = "#d33"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(w / 2 - 10, h - 3); g.lineTo(w / 2 + 10, h - 3); g.moveTo(w / 2, h - 13); g.lineTo(w / 2, h); g.stroke();
  };

  const icon = (f: ArtFile) => {
    const [wall, roof] = BUILD_COLOURS[f.variant!] ?? ["#ccc", "#888"];
    shape(wall, () => g.roundRect(14, 50, 100, 64, 8));
    shape(roof, () => { g.moveTo(8, 54); g.lineTo(64, 12); g.lineTo(120, 54); g.closePath(); });
    label(f.label.split(" ")[0], 64, 92, 17);
  };

  for (const f of files) {
    c.width = f.w; c.height = f.h;
    g.clearRect(0, 0, f.w, f.h);
    g.lineJoin = "round"; g.lineCap = "round"; g.setLineDash([]);
    switch (f.kind) {
      case "terrain": terrain(f); break;
      case "tree": tree(f, false); break;
      case "stump": tree(f, true); break;
      case "rock": rock(f); break;
      case "building": building(f); break;
      case "foundation": stage(f, false); break;
      case "scaffold": stage(f, true); break;
      case "sails":
        g.translate(f.w / 2, f.h / 2);
        for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); shape("#efe6cf", () => g.rect(6, -14, 110, 28), 4); }
        shape("#6b4a2e", () => g.arc(0, 0, 14, 0, 7));
        g.setTransform(1, 0, 0, 1, 0, 0);
        break;
      case "walk": case "idle": case "sleep": case "work": figure(f); break;
      case "good": {
        const col = GOOD_COLOURS[f.variant!];
        if (f.variant === "wood") { shape(col, () => g.roundRect(8, 22, 48, 20, 8)); shape("#c9a27a", () => g.ellipse(50, 32, 6, 9, 0, 0, 7), 2); }
        else if (f.variant === "stone") shape(col, () => g.ellipse(32, 36, 22, 16, 0, 0, 7));
        else if (f.variant === "bread") shape(col, () => g.ellipse(32, 34, 24, 15, 0, 0, 7));
        else { shape(col, () => { g.moveTo(14, 52); g.lineTo(18, 18); g.lineTo(46, 18); g.lineTo(50, 52); g.closePath(); }); }
        break;
      }
      case "icon": icon(f); break;
      default: template(f);
    }
    out.push(c.toDataURL("image/png"));
  }
  return out;
}

async function main() {
  const jobs: [string, ArtFile[]][] = [["public/art", artManifest()], ["art", templateManifest()]];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // tsx wraps functions in a __name() helper that doesn't exist in the page.
  await page.evaluate("globalThis.__name = (f) => f");
  let written = 0, kept = 0;
  for (const [dir, files] of jobs) {
    const todo = files.filter((f) => force || !existsSync(join(root, dir, f.path)));
    kept += files.length - todo.length;
    if (todo.length === 0) continue;
    const urls = await page.evaluate(drawAll, todo);
    todo.forEach((f, i) => {
      const file = join(root, dir, f.path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, Buffer.from(urls[i].split(",")[1], "base64"));
      written++;
    });
  }
  await browser.close();
  console.log(`Wrote ${written} files, kept ${kept} existing ones.`);
}

main();
