// Every art file the game loads, with its drawing size (2x the on-screen size).
// Matches docs/art-spec.md. Files live in public/art/; replacing a placeholder
// PNG with a drawing of the same name and size is all it takes.

import { BUILDINGS, BuildingType, GOODS } from "./config";

export const CELL_PX = 64; // on-screen pixels per cell at 100% zoom
export const ART_SCALE = 0.5; // drawings are made at 2x

export interface ArtFile {
  path: string;
  w: number;
  h: number;
  kind: string;
  label: string;
  frame?: number;
  variant?: string;
}

const canvasFor = (size: number) => ({ w: size * 128, h: size * 160 });

export const WALK_FRAMES = 6;
export const IDLE_FRAMES = 2;
export const WORK_FRAMES = 4;
export const TREE_VARIANTS = ["a", "b", "c"];
export const ROCK_STAGES = [1, 2, 3];
export const WORK_ANIMS: Record<string, string> = {
  woodcutter: "woodcutter_chop",
  quarry: "quarry_hack",
  builder: "builder_hammer",
  farm: "farmer_harvest",
};

export function artManifest(): ArtFile[] {
  const out: ArtFile[] = [];
  for (const t of ["grass", "forest_floor", "rocky_hill", "dirt_path"])
    out.push({ path: `terrain/${t}.png`, w: 512, h: 512, kind: "terrain", label: t, variant: t });
  for (const v of TREE_VARIANTS) out.push({ path: `nature/tree_${v}.png`, w: 96, h: 160, kind: "tree", label: `tree ${v}`, variant: v });
  out.push({ path: "nature/tree_stump.png", w: 96, h: 160, kind: "stump", label: "stump" });
  for (const r of ROCK_STAGES) out.push({ path: `nature/rock_${r}.png`, w: 96, h: 80, kind: "rock", label: `rock ${r}`, frame: r });

  for (const type of Object.keys(BUILDINGS) as BuildingType[]) {
    const { w, h } = canvasFor(BUILDINGS[type].size);
    out.push({ path: `buildings/${type}.png`, w, h, kind: "building", label: BUILDINGS[type].name, variant: type });
    out.push({ path: `ui/build_${type}.png`, w: 128, h: 128, kind: "icon", label: BUILDINGS[type].name, variant: type });
  }
  out.push({ path: "buildings/mill_sails.png", w: 256, h: 256, kind: "sails", label: "sails" });
  for (const size of [2, 3, 4]) {
    const { w, h } = canvasFor(size);
    out.push({ path: `buildings/stage_foundation_${size}x${size}.png`, w, h, kind: "foundation", label: "foundation", frame: size });
    out.push({ path: `buildings/stage_scaffold_${size}x${size}.png`, w, h, kind: "scaffold", label: "scaffold", frame: size });
  }

  for (const dir of ["toward", "away"]) {
    for (let f = 0; f < WALK_FRAMES; f++) out.push({ path: `units/subject_walk_${dir}_${f}.png`, w: 64, h: 96, kind: "walk", label: "", frame: f, variant: dir });
    for (let f = 0; f < IDLE_FRAMES; f++) out.push({ path: `units/subject_idle_${dir}_${f}.png`, w: 64, h: 96, kind: "idle", label: "", frame: f, variant: dir });
  }
  out.push({ path: "units/subject_sleep.png", w: 64, h: 96, kind: "sleep", label: "" });
  for (const anim of Object.values(WORK_ANIMS)) {
    for (let f = 0; f < WORK_FRAMES; f++) out.push({ path: `units/${anim}_${f}.png`, w: 64, h: 96, kind: "work", label: "", frame: f, variant: anim });
  }
  for (const g of GOODS) out.push({ path: `goods/${g}.png`, w: 64, h: 64, kind: "good", label: g, variant: g });
  return out;
}

/** Templates for the artist: footprint and anchor marked, not loaded by the game. */
export function templateManifest(): ArtFile[] {
  const out: ArtFile[] = [];
  for (const size of [2, 3, 4]) {
    const { w, h } = canvasFor(size);
    out.push({ path: `templates/building_${size}x${size}.png`, w, h, kind: "tpl-building", label: `${size} x ${size} building`, frame: size });
  }
  out.push({ path: "templates/subject_frame.png", w: 64, h: 96, kind: "tpl-subject", label: "subject" });
  out.push({ path: "templates/tree.png", w: 96, h: 160, kind: "tpl-tree", label: "tree" });
  out.push({ path: "templates/rock.png", w: 96, h: 80, kind: "tpl-rock", label: "rock" });
  return out;
}
