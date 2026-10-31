# Kerathys: Roadmap

*Updated 31 October 2026.*

Rules and numbers are in `docs/game-rules.md` and art requirements are in `docs/art-spec.md`. Every phase ends with a "done when" check. A phase isn't finished until that check passes.

## Phase 0: Decisions and specs ← current

**Decided:**
- 2-minute days with a 5-second night.
- Per-store stock with per-good limits.
- Carriers and builders as general job pools; carriers haul one item per trip.
- Paths form where subjects walk often.
- Recruiting costs 10 food, which must be at the Town Center.
- Stability bands affect walking and work speed.
- Relaxed placement with a movable work area.
- Hand-drawn art in a three-quarter view.
- Browser only.
- Tax deferred to Phase 3.

**Remaining:** the open items in `docs/game-rules.md` section 12; the artist's questions in `docs/art-spec.md` section 9.

**Done when:** both documents are agreed and the art test sheet has been checked.

## Phase 1: Foundation and logistics core

Project setup:
- Vite, TypeScript, PixiJS (rendering only) and Vitest.
- A simulation core with no rendering or DOM code: fixed timestep, seeded random numbers, and a game clock for day and night.
- All numbers in data files, so balancing never needs code changes.

Ported from the prototype:
- Map generation, terrain rendering, placement rules, and path wear.

New:
- A camera that scrolls and zooms, needed now that a cell is 64 px.
- Real building footprints.
- Output and input buffers, per-store stock and limits.
- Carriers and the job dispatcher.
- Recruiting at the Town Center.
- Eating at nightfall.
- Stability.

Tools:
- Save and load to JSON, with autosave.
- A headless runner that simulates N days and prints stock, population, food and stability over time.
- Unit tests for the dispatcher, food chains, deposits, stability bands and save round-trips.
- Template files for the art (footprint and anchor marked).
- The engine loads PNGs from the art folders and falls back to placeholder shapes for anything not drawn yet.

**Done when:** one province runs a wood, stone and food economy through carriers for 10+ days with no stuck goods or idle-forever carriers; tests pass; the headless runner gives sensible curves.

## Phase 2: Make slice 1 a game

- Builders and construction sites in 3 stages.
- The store panel with the per-good limit dropdown and −5/−1/+1/+5 buttons.
- Work-area circles that can be dragged.
- Day/night visuals: sunrise, midday, sunset, a dim night, subjects lying down.
- Pathfinding around buildings, stone roads, depleted-resource markers.
- A goal and a fail state.

**Done when:** you can play one province for 20–30 minutes, the bottlenecks feel like logistics puzzles rather than waiting, and you have playtested it.

## Phase 3: Gold and stability

- Introduce gold: a source of income and things to spend it on (upkeep, special buildings, later research and armies). Buildings cost only materials until then.
- Tax with a real trade-off.
- More reasons for stability to rise and fall, and consequences for low stability: refusing work, leaving, and rebellion.

**Done when:** high, medium and low tax each make sense in some situation.

## Phase 4: Ages and research

- The Age 1 tech tree. Each tech changes how you play, not just a percentage.
- The Bronze Working gate.
- Age 2 resources: iron, coal and clay, with their buildings.

## Phase 5: Province map

- A strategic map of Kerathys, outposts, multiple settlements and contested provinces.
- ⚠️ Settlements you aren't viewing will need a simplified model, because simulating every carrier everywhere is too slow. Design this before Phase 4 ends.

## Phase 6: One AI rival

- Trade routes, diplomacy (relations and memory) and auto-resolved battles.
- ⚠️ Start with a scripted rival. An AI that runs a full carrier economy is a project of its own.

## Phase 7: Content

- Halani, Galods and Ajupods as data: starting bonus, one unique unit, preferred resources.
- More ages and the naval layer.

## Art track (runs alongside the phases)

| When | What |
|---|---|
| Phase 0 | Test sheet: one house, one tree, one walking frame, checked in the engine |
| Phases 1–2 | Everything for slice 1, in the order in `docs/art-spec.md` section 8 |
| Later phases | Art for each phase's new buildings and units, briefed while the phase is designed, not after it's coded |
