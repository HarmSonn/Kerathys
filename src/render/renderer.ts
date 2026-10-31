// Draws the world. Reads simulation state only; never changes it.

import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { ART_SCALE, CELL_PX, ROCK_STAGES, TREE_VARIANTS, WALK_FRAMES, WORK_ANIMS, WORK_FRAMES } from "../data/art";
import { BUILDINGS, BuildingType, CONFIG } from "../data/config";
import { buildAllowed } from "../sim/construction";
import { hash2, smoothstep, terrainFields } from "../sim/noise";
import { Building, Field, Subject, Terrain, World } from "../sim/state";
import { byId, canPlace, door, fieldCells, idx, resourceCells } from "../sim/world";
import { ImageMap, TextureMap } from "./assets";

const P = CELL_PX;

/** Tint per job, multiplied over the pale placeholder tunic. */
const JOB_TINT: Record<string, number> = {
  idle: 0xffffff, carrier: 0xf2c879, builder: 0xc9a27a, leaving: 0x9a9a9a,
  woodcutter: 0x8fc27a, quarry: 0xa9b4c4, farm: 0xf0dc7a, mill: 0xf4efe0, bakery: 0xf0a878,
};

export interface Ghost { type: BuildingType; x: number; y: number }

export class WorldView {
  readonly root = new Container();
  private ground = new Container();
  private paths = new Graphics();
  private fields = new Graphics();
  private objects = new Container();
  private overlay = new Graphics();
  private natureSprites = new Map<number, Sprite[]>();
  private natureKey = new Map<number, number>();
  private buildingSprites = new Map<number, { main: Sprite; sails?: Sprite; bar: Graphics }>();
  private subjectSprites = new Map<number, { body: Sprite; carry: Sprite }>();
  private pathTimer = 0;
  private w!: World;

  selected = -1;
  ghost: Ghost | null = null;

  constructor(private tex: TextureMap, private images: ImageMap) {
    this.objects.sortableChildren = true;
    this.root.addChild(this.ground, this.paths, this.fields, this.objects, this.overlay);
  }

  setWorld(w: World) {
    this.w = w;
    this.ground.removeChildren().forEach((c) => c.destroy());
    this.objects.removeChildren().forEach((c) => c.destroy());
    this.natureSprites.clear(); this.natureKey.clear();
    this.buildingSprites.clear(); this.subjectSprites.clear();
    this.ground.addChild(new Sprite(this.composeTerrain()));
    this.pathTimer = 0;
  }

  private t(path: string): Texture { return this.tex.get(path) ?? Texture.WHITE; }

  private sprite(path: string): Sprite {
    const s = new Sprite(this.t(path));
    s.anchor.set(0.5, 1);
    s.scale.set(ART_SCALE);
    return s;
  }

  /** Blend the terrain textures using the same fields that decide cell types. */
  private composeTerrain(): Texture {
    const w = this.w, size = w.size * P;
    const res = 4; // mask samples per cell
    const mask = (which: 0 | 1, lo: number, hi: number) => {
      const c = document.createElement("canvas");
      c.width = c.height = w.size * res;
      const g = c.getContext("2d")!, img = g.createImageData(c.width, c.height);
      for (let py = 0; py < c.height; py++) for (let px = 0; px < c.width; px++) {
        const f = terrainFields(px / res + 0.125, py / res + 0.125, w.seed, w.size, CONFIG.map.startRadiusOpen);
        let a = smoothstep(lo, hi, f[which]);
        // Keep the ground under forced-open start buildings clear.
        const cell = w.cells[idx(w, Math.floor(px / res), Math.floor(py / res))];
        if (cell.t === Terrain.Open && cell.occ >= 0) a = 0;
        const i = (py * c.width + px) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * 255;
      }
      g.putImageData(img, 0, 0);
      return c;
    };
    const out = document.createElement("canvas");
    out.width = out.height = size;
    const g = out.getContext("2d")!;
    const fill = (ctx: CanvasRenderingContext2D, file: string) => {
      const img = this.images.get(`terrain/${file}.png`);
      if (!img || !img.complete || img.naturalWidth === 0) { ctx.fillStyle = "#6a9c4e"; ctx.fillRect(0, 0, size, size); return; }
      const pat = ctx.createPattern(img, "repeat")!;
      pat.setTransform(new DOMMatrix().scale(ART_SCALE));
      ctx.fillStyle = pat; ctx.fillRect(0, 0, size, size);
    };
    fill(g, "grass");
    for (const [file, which, lo, hi] of [["forest_floor", 0, 0.45, 0.62], ["rocky_hill", 1, 0.5, 0.66]] as const) {
      const layer = document.createElement("canvas");
      layer.width = layer.height = size;
      const lg = layer.getContext("2d")!;
      fill(lg, file);
      lg.globalCompositeOperation = "destination-in";
      lg.imageSmoothingEnabled = true; lg.imageSmoothingQuality = "high";
      lg.drawImage(mask(which, lo, hi), 0, 0, size, size);
      g.drawImage(layer, 0, 0);
    }
    return Texture.from(out);
  }

  // ------------------------------------------------------------ per frame

  update(dt: number, zoom: number) {
    const w = this.w;
    this.updateTint();
    this.pathTimer -= dt;
    if (this.pathTimer <= 0) { this.pathTimer = 0.5; this.drawPaths(); this.drawFields(); }
    this.updateNature();
    this.updateBuildings(dt);
    this.updateSubjects();
    this.drawOverlay(zoom);
    void w;
  }

  private updateTint() {
    const { day, night } = CONFIG.time, c = this.w.clock;
    // Sunrise, midday, sunset, then a short blue night.
    const keys: [number, number][] = [
      [0, 0xffc79a], [15, 0xffffff], [95, 0xffffff], [112, 0xffb27a], [day, 0x8f8fc0], [day + 1, 0x4a5488], [day + night, 0x4a5488],
    ];
    let i = 0;
    while (i < keys.length - 2 && c > keys[i + 1][0]) i++;
    const [t0, c0] = keys[i], [t1, c1] = keys[i + 1];
    const k = Math.min(1, Math.max(0, (c - t0) / (t1 - t0 || 1)));
    const ch = (s: number) => Math.round(((c0 >> s) & 255) + (((c1 >> s) & 255) - ((c0 >> s) & 255)) * k);
    this.root.tint = (ch(16) << 16) | (ch(8) << 8) | ch(0);
  }

  private drawPaths() {
    const g = this.paths.clear(), w = this.w, { visible, full, cap } = CONFIG.paths;
    for (const k in w.edges) {
      const h = w.edges[k];
      if (h < visible) continue;
      const [a, b] = k.split("_").map(Number);
      const t = Math.min(1, h / full);
      const col = ((127 + 33 * t) << 16) | ((150 - 40 * t) << 8) | (95 - 25 * t);
      g.moveTo((a % w.size + 0.5) * P, (Math.floor(a / w.size) + 0.5) * P)
        .lineTo((b % w.size + 0.5) * P, (Math.floor(b / w.size) + 0.5) * P)
        .stroke({ width: P * (0.14 + 0.24 * Math.min(1, h / (cap * 0.6))), color: col, alpha: 0.55 + 0.35 * t, cap: "round" });
    }
  }

  private drawFields() {
    const g = this.fields.clear(), w = this.w;
    w.cells.forEach((c, i) => {
      if (c.farm < 0) return;
      const x = (i % w.size) * P, y = Math.floor(i / w.size) * P;
      const col = c.field === Field.Ripe ? 0xd9b84a : c.field === Field.Growing ? 0x7aa04a : c.field === Field.Empty ? 0x8a6a45 : 0xa08a65;
      g.rect(x + 2, y + 2, P - 4, P - 4).fill({ color: col, alpha: c.field === Field.None ? 0.35 : 0.9 });
      for (let r = 1; r < 4; r++) g.moveTo(x + 6, y + (r * P) / 4).lineTo(x + P - 6, y + (r * P) / 4).stroke({ width: 2, color: 0x000000, alpha: 0.15 });
      if (c.field === Field.Growing || c.field === Field.Ripe) {
        const grown = c.field === Field.Ripe ? 1 : 1 - c.fieldTimer / CONFIG.farm.growTime;
        for (let r = 1; r < 4; r++) for (let j = 0; j < 5; j++)
          g.circle(x + 8 + j * 12, y + (r * P) / 4 - 3, 2 + 3 * grown).fill({ color: c.field === Field.Ripe ? 0xf0d060 : 0x9ccc5a });
      }
    });
  }

  private updateNature() {
    const w = this.w;
    const maxTrees = CONFIG.forest.treesPerCell;
    for (let i = 0; i < w.cells.length; i++) {
      const c = w.cells[i];
      if (c.t === Terrain.Open) {
        if (this.natureSprites.has(i)) { this.natureSprites.get(i)!.forEach((s) => s.destroy()); this.natureSprites.delete(i); }
        continue;
      }
      const key = c.t === Terrain.Forest ? c.wood : 1000 + c.stone;
      if (this.natureKey.get(i) === key) continue;
      this.natureKey.set(i, key);
      this.natureSprites.get(i)?.forEach((s) => s.destroy());
      const x = i % w.size, y = Math.floor(i / w.size), list: Sprite[] = [];
      if (c.t === Terrain.Forest) {
        const trees = Math.ceil(c.wood / CONFIG.forest.woodPerTree);
        for (let j = 0; j < maxTrees; j++) {
          const v = TREE_VARIANTS[Math.floor(hash2(x, y, j + 7) * TREE_VARIANTS.length)];
          const s = this.sprite(j < trees ? `nature/tree_${v}.png` : "nature/tree_stump.png");
          s.position.set((x + 0.2 + hash2(x, y, j) * 0.6) * P, (y + 0.3 + hash2(y, x, j + 4) * 0.6) * P);
          s.zIndex = s.y;
          list.push(s);
        }
      } else if (c.stone > 0) {
        const frac = c.stone / CONFIG.hill.stonePerCell;
        const stage = ROCK_STAGES[frac > 0.66 ? 0 : frac > 0.33 ? 1 : 2];
        const s = this.sprite(`nature/rock_${stage}.png`);
        s.position.set((x + 0.3 + hash2(x, y, 3) * 0.4) * P, (y + 0.6 + hash2(y, x, 5) * 0.3) * P);
        s.zIndex = s.y;
        list.push(s);
      }
      list.forEach((s) => this.objects.addChild(s));
      this.natureSprites.set(i, list);
    }
  }

  private updateBuildings(dt: number) {
    const w = this.w, seen = new Set<number>();
    for (const b of w.buildings) {
      seen.add(b.id);
      let v = this.buildingSprites.get(b.id);
      if (!v) {
        const main = this.sprite(`buildings/${b.type}.png`);
        const bar = new Graphics();
        this.objects.addChild(main, bar);
        v = { main, bar };
        if (b.type === "mill") {
          v.sails = new Sprite(this.t("buildings/mill_sails.png"));
          v.sails.anchor.set(0.5); v.sails.scale.set(ART_SCALE * 0.9);
          this.objects.addChild(v.sails);
        }
        this.buildingSprites.set(b.id, v);
      }
      const d = door(b);
      const sizeTag = `${b.size}x${b.size}`;
      const half = BUILDINGS[b.type].buildTime / 2;
      const file = b.done ? `buildings/${b.type}.png` : b.progress < half ? `buildings/stage_foundation_${sizeTag}.png` : `buildings/stage_scaffold_${sizeTag}.png`;
      v.main.texture = this.t(file);
      v.main.position.set(d.x * P, (b.y + b.size) * P);
      v.main.zIndex = v.main.y;
      if (v.sails) {
        v.sails.visible = b.done;
        v.sails.position.set(d.x * P, (b.y + b.size * 0.15) * P);
        v.sails.zIndex = v.main.zIndex + 1;
        if (b.processing > 0) v.sails.rotation += dt * 1.5;
      }
      // Construction progress bar.
      v.bar.clear();
      if (!b.done) {
        const bw = b.size * P * 0.7, x0 = d.x * P - bw / 2, y0 = (b.y + b.size) * P + 4;
        const total = BUILDINGS[b.type].buildTime;
        v.bar.rect(x0, y0, bw, 7).fill({ color: 0x000000, alpha: 0.5 });
        v.bar.rect(x0, y0, (bw * buildAllowed(b)) / total, 7).fill({ color: 0xc9a27a, alpha: 0.7 });
        v.bar.rect(x0, y0, (bw * b.progress) / total, 7).fill({ color: 0x58b85a });
        v.bar.zIndex = v.main.zIndex + 2;
      }
    }
    for (const [id, v] of this.buildingSprites) {
      if (seen.has(id)) continue;
      v.main.destroy(); v.bar.destroy(); v.sails?.destroy();
      this.buildingSprites.delete(id);
    }
  }

  private subjectFrame(s: Subject): { file: string; flip: boolean } {
    const w = this.w;
    if (w.night) return { file: "units/subject_sleep.png", flip: s.facing < 0 };
    const b = s.building >= 0 ? byId(w, s.building) : undefined;
    const working = (s.role === "worker" && s.step === "working") || (s.role === "builder" && s.step === "building" && b && !b.done && b.progress < buildAllowed(b));
    if (working) {
      const anim = WORK_ANIMS[s.role === "builder" ? "builder" : b!.type];
      const f = Math.floor((w.t * 4 + s.id) % WORK_FRAMES);
      if (anim) return { file: `units/${anim}_${f}.png`, flip: s.role === "builder" ? s.id % 2 === 0 : s.facing < 0 };
    }
    const away = s.ty < s.y - 0.01;
    if (s.moving) {
      const f = Math.floor((w.t * 8 + s.id) % WALK_FRAMES);
      return { file: `units/subject_walk_${away ? "away" : "toward"}_${f}.png`, flip: s.facing < 0 };
    }
    const f = Math.floor((w.t * 1.5 + s.id) % 2);
    return { file: `units/subject_idle_toward_${f}.png`, flip: s.facing < 0 };
  }

  private updateSubjects() {
    const w = this.w, seen = new Set<number>();
    for (const s of w.subjects) {
      seen.add(s.id);
      let v = this.subjectSprites.get(s.id);
      if (!v) {
        const body = this.sprite("units/subject_idle_toward_0.png");
        const carry = new Sprite(Texture.WHITE);
        carry.anchor.set(0.5); carry.scale.set(ART_SCALE * 0.75);
        this.objects.addChild(body, carry);
        v = { body, carry };
        this.subjectSprites.set(s.id, v);
      }
      // Millers and bakers work out of sight, inside their building.
      const inside = s.role === "worker" && s.step === "inside";
      v.body.visible = !inside;
      const { file, flip } = this.subjectFrame(s);
      v.body.texture = this.t(file);
      v.body.scale.x = Math.abs(v.body.scale.x) * (flip ? -1 : 1);
      v.body.position.set(s.x * P, s.y * P);
      v.body.zIndex = v.body.y;
      const job = s.role === "worker" ? byId(w, s.building)?.type ?? "idle" : s.role;
      v.body.tint = JOB_TINT[job] ?? 0xffffff;
      v.carry.visible = !inside && !!s.carry && !w.night;
      if (s.carry) {
        v.carry.texture = this.t(`goods/${s.carry}.png`);
        v.carry.position.set(s.x * P, s.y * P - 50);
        v.carry.zIndex = v.body.zIndex + 0.5;
      }
    }
    for (const [id, v] of this.subjectSprites) {
      if (seen.has(id)) continue;
      v.body.destroy(); v.carry.destroy();
      this.subjectSprites.delete(id);
    }
  }

  private drawOverlay(zoom: number) {
    const g = this.overlay.clear(), w = this.w;
    const lw = 2 / zoom;
    const workArea = (cx: number, cy: number, res: "forest" | "hill") => {
      for (const i of resourceCells(w, cx, cy, res)) {
        g.rect((i % w.size) * P + 4, Math.floor(i / w.size) * P + 4, P - 8, P - 8).fill({ color: 0xffffff, alpha: 0.18 });
      }
      g.circle(cx * P, cy * P, CONFIG.workArea.radius * P).fill({ color: 0xffffff, alpha: 0.08 }).stroke({ width: lw * 1.5, color: 0xffffff, alpha: 0.7 });
      g.circle(cx * P, cy * P, 8 / zoom).fill({ color: 0xffffff, alpha: 0.9 });
    };
    const sel = this.selected >= 0 ? byId(w, this.selected) : undefined;
    if (sel) {
      g.roundRect(sel.x * P - 4, sel.y * P - 4, sel.size * P + 8, sel.size * P + 8, 10).stroke({ width: lw * 1.5, color: 0xffffff, alpha: 0.9 });
      const res = BUILDINGS[sel.type].resource;
      if (res) workArea(sel.workX, sel.workY, res);
    }
    if (this.ghost) {
      const { type, x, y } = this.ghost, n = BUILDINGS[type].size;
      const ok = canPlace(w, type, x, y) === "";
      const col = ok ? 0x5ee06a : 0xff6a5a;
      if (type === "farm") for (const i of fieldCells(w, x, y, n))
        g.rect((i % w.size) * P + 2, Math.floor(i / w.size) * P + 2, P - 4, P - 4).fill({ color: col, alpha: 0.12 }).stroke({ width: lw, color: col, alpha: 0.5 });
      g.roundRect(x * P, y * P, n * P, n * P, 8).fill({ color: col, alpha: 0.25 }).stroke({ width: lw * 2, color: col });
      const res = BUILDINGS[type].resource;
      if (res) workArea(x + n / 2, y + n / 2, res);
    }
  }

  /** Building under a world point, if any. */
  pick(wx: number, wy: number): Building | undefined {
    const cx = Math.floor(wx / P), cy = Math.floor(wy / P);
    if (cx < 0 || cy < 0 || cx >= this.w.size || cy >= this.w.size) return undefined;
    const c = this.w.cells[idx(this.w, cx, cy)];
    const id = c.occ >= 0 ? c.occ : c.farm;
    return id >= 0 ? byId(this.w, id) : undefined;
  }
}
