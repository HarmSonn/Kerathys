# Kerathys: Handoff Brief for Claude Code

*Status: prototype slice 1 exists as a single-file browser page. This brief hands the design, the exact economy numbers, and a proposed structure to a full project.*

## 1. How to use this brief

- Read it fully before writing code. Sections 5 and 6 are the source of truth for the economy; section 7 is a proposed architecture, not a requirement.
- Save the prototype source (single HTML file, about 20 KB) into the repo as `reference/prototype.html`. It is the working reference for behaviour. Published prototype: https://claude.ai/artifact/R1QuQVeP8xeZ7SDifgpRmB (the source must be copied out of that page; Claude Code cannot fetch it).
- The prototype was written and revised in chat and has **not been systematically playtested or unit tested**. Treat its numbers as a starting point and verify behaviour before relying on it.
- The owner prefers to do his own editorial work and wants honest feedback over reassurance. Flag problems with the design instead of smoothing them over.

## 2. Vision and pillars

A real-time-with-pause empire builder in the spirit of The Settlers IV, with the campaign ambition of Rome: Total War and the era structure of Civilization. Inspirations: Age of Empires: Dawn of the Modern World, The Settlers IV, Rome: Total War.

What the owner enjoys most: building up an empire, managing resources, watching subjects gather things, expanding, and building.

**Pillars**

- Economy first: production chains, stockpiles, and trade are the heart of the game
- Terrain matters: where you settle decides what you make and what you must buy
- Two real paths: trade and diplomacy versus war, both viable, each with costs
- Visible subjects: workers walk between buildings so the empire feels alive
- Progress through ages: a research tree that changes how you play, not just the numbers
- Organic look: no visible tile grid; the grid is hidden under smooth terrain

## 3. The world: Kerathys

Historically inspired but fictional. The first age is based on classical antiquity.

**Geography**

- A central inland sea, the Amber Sea, connected to the surrounding ocean by two waterways, ringed by a crescent-shaped continent
- The Northern Highlands: mountains with iron and coal (locked until Age 2), cold, few farms
- The Verdant Coast (west): fertile fields and pasture
- The Redstone Plateau (east): stone, gemstones, dry grazing land
- The Silt Delta (south): river clay, rich farmland, flood-prone
- The Ember Isles: islands in the Amber Sea with rare special resources
- The Wildwood (north-west): dense woodland, timber, barbarian tribes
- About 30 provinces overall, roughly 5 to 6 per region

**Playable factions**

- Rotars (Roman-like): the only faction in slice 1
- Halani (Greek city-state-like)
- Galods (Gallic and Germanic tribe-like)
- Ajupods (Egyptian-like)

Build one faction first. Later factions should differ through data (starting bonus, one unique unit, preferred resources), not through separate code.

**Provinces and expansion**

- An outpost claims a province; a settlement can then be started in it
- Several factions may settle one province, which makes it contested and gives a casus belli
- Province terrain types: woodland, fields, pasture, hills, riverbank, mountain, coast

## 4. Long-term scope (not yet built)

- **Ages**: four to five (for example Settlement, Bronze, Medieval, Renaissance, Industrial), each with 6 to 8 techs. Techs should change play, not just add percentages (sewers allow bigger cities, water management unlocks irrigation and mills, public houses raise happiness and give trade bonuses). Branches: economy, civic, military. Bronze Working gates Age 2 (needs a population threshold and three techs).
- **Resources beyond slice 1**: iron, coal, cattle products, clay and pottery; special resources gemstones and fine pottery, later wine, salt, silk. Map generation rule: no faction starts with everything, so trade is necessary.
- **Trade**: routes between stockpiles, prices shifting with supply and demand, markets and harbours, embargoes and raids.
- **Diplomacy**: relation score plus memory per AI faction; trade agreements, alliances, tribute, embargoes, war declarations that need a reason, peace treaties. Betrayals are remembered.
- **Military**: auto-resolved battles (army strength, terrain, general bonus, randomness) with a short report. Age 1 units: militia spearmen, slingers and archers, light cavalry, hoplites (after Bronze Working), triremes. Armies cost gold and food upkeep. Naval play, harbours and trade ships come in a later stage.
- **Rebellion and unrest** is a core mechanic: tax income and special-resource happiness balance against kingdom stability.
- **Scale target**: 4 to 5 factions, 60 workers per age cap to keep it smooth, 80 to 150 days or roughly 45 to 90 minutes per game.

## 5. Slice 1 scope (what the prototype does)

Rotars only, one province shown as a 40x40 hidden logic grid with woodland and hills, smooth organic rendering.

- Starting buildings: one storehouse and two houses
- Placeable buildings: woodcutter, quarry, farm, mill, bakery, house, storehouse
- Worker sprites walk home to workplace to storehouse; roads emerge from repeated use
- Pause and 1x, 2x, 4x speed
- Tax slider driving a stability number
- Placement outline preview (green valid, red invalid), progress bars at buildings, roads drawn as fading lines
- **Missing**: stone road upgrades, win or lose state, save and load, enemies, anything beyond the Rotars

## 6. Economy and rules: exact numbers

**Time**

- 1 tick = 1 game day = 5 real seconds at 1x speed. All rates below are per day.

**Starting state**

- 40 wood, 15 stone, 50 gold, 75 food, 0 grain, 0 flour
- 4 residents, housing for 8
- Storehouse at cell (20, 20); houses at (17, 19) and (17, 22)

**Buildings** (costs in wood / stone / gold; construction is instant in slice 1)

| Building | Cost | Worker slots | Behaviour |
| --- | --- | --- | --- |
| Storehouse | 30 / 10 / 0 | none | Stockpile and delivery point; starter is free |
| House | 20 / 5 / 0 | none | Holds 4 residents; starters are free |
| Woodcutter | 10 / 0 / 0 | 2 | 1.0 wood per worker per day; must be on a forest cell |
| Quarry | 15 / 0 / 0 | 3 | 0.6 stone per worker per day; must be on a hill cell |
| Farm | 20 / 0 / 0 | 2 | 1.2 grain per worker per day; on open ground |
| Mill | 25 / 10 / 20 | 1 | Consumes 2 grain per day, makes flour 1:1 |
| Bakery | 25 / 10 / 20 | 1 | Consumes 2 flour per day, makes bread at 1.5 per flour; bread adds to the food stock |

One food chain (2 farmers, 1 miller, 1 baker) nominally makes about 3 food per day, which feeds around 30 residents at the current consumption.

**Worker cycle**

- A worker carries 8 units per trip.
- Gatherers: work for 8 / (rate x productivity) days, collect up to 8 units, walk to the nearest storehouse, deliver, walk back.
- Processors (mill, bakery): walk to the nearest storehouse, take 8 input units (wait if the stock is below 8), walk back, process for 8 / (rate x productivity) days, make output, walk to the storehouse, deliver, repeat.
- Walking speed: 3 tiles per day on bare ground, 4.5 once the cell has been crossed 30 times. Movement is a straight line between building and storehouse.
- Distance is the proximity mechanic: mills and bakeries near farms and the storehouse lose less time walking.

**Roads**

- Each cell counts how often workers enter it (cap 60); each edge between neighbouring cells counts crossings too (cap 60).
- Drawn as lines that appear after 2 crossings and fade from grass-like to dirt colour, widening as traffic grows (colour scale up to 40 crossings, width up to 30).
- Stone road upgrade (6 tiles per day) is planned but not built.

**Deposits**

- Forest cell: 60 wood cap, regrows 0.03 per day up to the cap
- Hill cell: 250 stone, never regrows
- Woodcutters and quarries gather from cells within 4 cells of the building, nearest first; if nothing is left the worker waits and retries each day

**Food, tax, stability**

- Food consumption: 0.10 per resident per day (was 0.25; lowered after the first playtest)
- Tax rate slider: 0 to 0.5 gold per employed non-military subject per day, step 0.05, default 0.10
- Stability target = 80 - 60 x tax rate, minus 30 while food is zero; stability moves toward the target by up to 1 per day; starts at 74
- Productivity multiplier: 1.0 at stability 70 or above, 0.8 from 40 to 69, 0.5 below 40
- Immigration: every 10 days, +1 resident if housing is free, food is above zero, and stability is at least 50
- Residents are assigned to jobs manually (+ and - on each building); unassigned residents pay no tax

**Placement rules**

- Woodcutter: forest cell. Quarry: hill cell. Everything else: open ground.
- No building within 2 cells of another
- Must afford the full cost

**Map generation**

- 40x40 cells; each cell is forest, hill, or open ground, from smooth value noise (3-octave fractal) sampled at cell centres
- Terrain near the centre is forced open (smoothstep from radius 5 to 9)
- A forest bump at (14, 15) and a hills bump at (26, 25) guarantee both resources near the start; forest where the forest field exceeds 0.55, hills where the hill field exceeds 0.58, hills take precedence
- The terrain image is a 160x160 bitmap (4 pixels per cell) coloured from the same fields, scaled up smoothly; trees and rocks are drawn per cell, fewer as the deposit depletes

## 7. Proposed project structure

This is a recommendation; change it if you have a better plan.

- **Stack**: TypeScript with Vite; PixiJS or Phaser for rendering. Keep the simulation free of rendering code.
- **Simulation core** (`src/sim/`): fixed timestep, deterministic where possible, no DOM access. Modules: world and map generation, economy (stockpiles, production, consumption), workers and jobs, stability and tax, roads, placement rules.
- **Data files** (`src/data/*.json` or `.ts`): buildings, resources, terrain types, techs, factions, units. All numbers in section 6 should live here so balancing never needs code changes.
- **Rendering** (`src/render/`): reads sim state only; terrain bitmap, tree and rock sprites, buildings, workers, road lines, placement outline, progress bars.
- **UI** (`src/ui/`): HUD, build palette, building panel, speed and tax controls, messages.
- **Save and load**: serialise the sim state to JSON; autosave to local storage.
- **Tests**: unit tests for the economy (a chain feeds N residents, deposits deplete and regrow, stability thresholds) so balance changes show regressions.
- **Later**: faction data, province map layer, AI and diplomacy modules, tech tree, naval layer.

## 8. Known gaps and risks

- Roads form only from straight-line routes between buildings; there is no real pathfinding around obstacles.
- Buildings are drawn larger (about 1.5 cells) than their one-cell footprint, which may look cramped.
- Food balance after the 0.10 change is probably too generous; check whether food stays a meaningful constraint at 20 or more residents.
- Empty forests make the worker bar restart every day instead of showing a depleted state.
- No obstacles or collision between workers; no construction time.
- Start distances (forest and hills about 10 cells from the storehouse) are meant to make a second storehouse worthwhile; verify that this actually happens in play.

## 9. Suggested roadmap

1. Port slice 1 to the new project with the sim and render separated, matching the prototype’s behaviour; add economy unit tests
2. Real art pass: sprites for terrain, buildings, workers; sound
3. Stone roads, construction time, depleted-resource markers, save and load
4. Tech tree for Age 1 and the Bronze Working gate; Age 2 resources (iron, coal)
5. Province map layer with outposts and contested provinces
6. One AI rival, trade routes, diplomacy, auto-resolved combat
7. Remaining factions as data, more ages, naval layer

## 10. Open questions for the owner

- Art direction: pixel, painterly, or flat vector; where the art will come from (asset pack or artist)
- How heavy the rebellion and unrest system should be
- Whether the project stays browser-only or also targets desktop
- Faction cultures and AI personalities beyond the one-line descriptions above
