# Kerathys: Art Spec (Slice 1)

*For the hand-drawn art. Phase 0 draft, 31 October 2026. Anything here can change if it makes drawing easier: ask first, and we adjust the engine.*

## 1. View and style

- **Slight top-down three-quarter view**, like The Settlers IV.
- **Ground is drawn straight from above.** Terrain textures are flat and square, and the engine blends them.
- **Objects stand up and face the viewer.** Buildings, trees, rocks and people show their front and a bit of their top. Draw buildings facing front, not turned at an angle.
- **Light comes from the top left**, for every sprite. Shade objects to match.
- **Don't draw shadows on the ground.** The engine adds a soft shadow under each object, so shadows change correctly from sunrise to sunset.
- **Draw everything in daylight colours.** The engine tints the screen for sunrise, sunset and night.
- No visible grid anywhere. The look should be organic.

## 2. Scale

At 100% zoom, **one map cell is 64 × 64 pixels** on screen. A province is 40 × 40 cells, so the camera scrolls and zooms.

**Draw everything at 2× the on-screen size.** The sizes below are the drawing sizes. The engine scales them down, and the extra detail is used when zooming in.

**Line weight:** lines should be at least 3 px thick at drawing size so they survive being scaled down by half.

## 3. Sprite sizes (drawing size, at 2×)

The canvas is wider than the footprint is tall because objects stand up out of the ground. The bottom part of each canvas is the footprint; the extra height above it is for roofs and treetops.

| What | Footprint | Canvas (w × h) | Notes |
|---|---|---|---|
| Small building | 2 × 2 cells | 256 × 320 | House, storage area, woodcutter, quarry, farm |
| Medium building | 3 × 3 cells | 384 × 480 | Mill, bakery, storehouse |
| Town Center | 4 × 4 cells | 512 × 640 | |
| Tree | 1 cell | 96 × 160 | 3–4 variants, plus a stump |
| Rock | 1 cell | 96 × 80 | 3 stages: full, half, nearly gone |
| Subject (one frame) | n/a | 64 × 96 | The figure itself is about 80 px tall |
| Carried good | n/a | 48 × 48 | Drawn over the carrier's hands |
| Good icon (UI) | n/a | 64 × 64 | Can be the same drawing as the carried good |
| Building icon (UI) | n/a | 128 × 128 | For the build menu |
| Terrain texture | n/a | 512 × 512 | Must tile seamlessly |

**Anchor point:** every sprite stands on the **bottom centre of its footprint**. I'll make template files with the footprint and anchor marked so every drawing lines up.

## 4. Animation

Walking:
- **6 frames**, drawn for **2 directions**: diagonally toward the viewer and diagonally away from the viewer, both walking right. The engine mirrors them to get the left-walking directions, so 4 directions in total.

Other states:
- **Idle:** 1–2 frames, for the same 2 directions.
- **Sleeping** (lying down at night): 1 frame.

Jobs share one walking figure:
- The engine colours each job's tunic differently: carrier, builder, woodcutter, quarry worker, farmer, miller, baker.
- Tools appear only in the work animations.

Work animations: 4 frames each, 1 direction (mirrored by the engine).

| Animation | Who | Tool |
|---|---|---|
| Chopping | Woodcutter | Axe |
| Hacking stone | Quarry worker | Pickaxe |
| Hammering | Builder | Hammer |
| Harvesting | Farmer | Sickle |

Millers and bakers work indoors, so they have no work animation. The buildings show they're working instead: the engine turns the mill's sails (drawn as a separate sprite) and puffs smoke from the bakery chimney.

## 5. Construction stages

Every building goes through 3 stages:
1. Foundation
2. Scaffolding
3. Finished

The foundation and scaffolding can be **generic, one drawing per footprint size** (2 × 2, 3 × 3, 4 × 4), reused for every building of that size. Only the finished stage needs a drawing per building.

## 6. Goods for slice 1

Wood, stone, grain, flour, bread. Each needs one drawing (used for carrying and for the UI icon). Storage areas show their contents as piles, which the engine builds from these drawings.

## 7. Files

- **PNG**, transparent background, sRGB colour.
- **One file per frame or per object.** The engine packs them into sheets automatically.
- No stray pixels or leftover background around the drawing.
- Naming: lowercase, with underscores, frame numbers starting at 0:
  - `buildings/woodcutter.png`
  - `buildings/stage_foundation_2x2.png`, `buildings/stage_scaffold_2x2.png`
  - `units/subject_walk_toward_0.png` … `units/subject_walk_toward_5.png`
  - `units/subject_walk_away_0.png` … `units/subject_walk_away_5.png`
  - `units/woodcutter_chop_0.png` … `units/woodcutter_chop_3.png`
  - `nature/tree_a.png`, `nature/tree_stump.png`, `nature/rock_1.png`
  - `goods/wood.png`
  - `terrain/grass.png`
- Keep the original working files (Krita, Procreate, Photoshop or scans) separately. Only the exported PNGs go into the game.

## 8. Order of work for slice 1

1. Terrain textures (grass, forest floor, rocky hill, dirt path), trees and stumps, rocks
2. Town Center, house, storage area
3. Woodcutter, quarry, farm, mill (with separate sails), bakery, storehouse
4. Construction stages (foundation and scaffolding per footprint size)
5. Subject walk cycle, idle and sleeping frames
6. Goods drawings
7. Work animations
8. Build menu icons

Placeholder shapes stand in until each drawing arrives, so the game never waits for art.

## 9. Open questions for the artist

- Paper or tablet? For paper, scan at 600 dpi; the backgrounds can be cleaned up afterwards.
- Which drawing program? The template files will be made in a format it opens.
- Palette and line style: worth a test sheet first (one house, one tree, one walking frame), checked in the engine before drawing everything.
