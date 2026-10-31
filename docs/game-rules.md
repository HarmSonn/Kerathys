# Kerathys: Game Rules (Slice 1)

*Phase 0 draft, updated 31 October 2026. Replaces sections 5 and 6 of `HANDOFF.md`.*

These numbers are starting points for the first playtest. The headless runner built in Phase 1 is the tool for tuning them. Items marked *(proposal)* were not discussed explicitly; change them freely.

## 1. Time

- All times are in real seconds at 1× speed. Speeds: pause, 1×, 2×, 4×.
- A day is **120 s of daylight** (sunrise, midday, sunset; visual only), followed by a **5 s night**. One full cycle is 125 s.
- At nightfall, subjects eat (section 6), then everything stops. Subjects lie down where they stand and the screen dims. At sunrise everyone carries on where they left off.
- A 45 to 90 minute game is roughly 22 to 45 days.
- The simulation runs on a fixed timestep, independent of frame rate (*proposal:* 10 steps per game second).

## 2. Map

- One province on a hidden 40 × 40 grid. Players never see the grid.
- Cell types: open ground, forest, hill. Generation follows the prototype: 3-octave value noise; the centre is forced open (smoothstep from radius 5 to 9); a forest bump at (14, 15) and a hills bump at (26, 25); forest where the forest field exceeds 0.55, hills where the hill field exceeds 0.58; hills take precedence.
- **Forest cell:** up to 3 trees, each giving 4 wood. A cell missing trees regrows one tree every 15 days. Across a typical woodcutter's work area (about 30 forest cells) that is about **2 trees per day**.
- **Hill cell:** 20 stone, never regrows *(proposal)*.
- Trees and rocks are drawn per cell and thin out as they are used up. Empty cells show stumps or bare rock.

## 3. Buildings

Buildings have real footprints that match their art.

| Building | Footprint | Wood / Stone | Storage | Workers | Build time |
|---|---|---|---|---|---|
| Town Center | 4 × 4 | starter | 300 | none | n/a |
| Storage area | 2 × 2 | 4 / 0 | 200 | none | 20 s |
| Storehouse | 3 × 3 | 8 / 4 | 400 | none | 60 s |
| House | 2 × 2 | 6 / 2 | n/a | none (holds 4 subjects) | 40 s |
| Woodcutter | 2 × 2 | 3 / 0 | n/a | 2 | 30 s |
| Quarry | 2 × 2 | 4 / 0 | n/a | 3 | 30 s |
| Farm | 2 × 2 hut + field ring (4 × 4 in total) | 6 / 0 | n/a | 2 | 40 s |
| Mill | 3 × 3 | 7 / 3 | n/a | 1 | 60 s |
| Bakery | 3 × 3 | 7 / 3 | n/a | 1 | 60 s |

Buildings cost only building materials, no gold. Build time counts only once materials are on site (section 8).

### Placement

- The whole footprint must be on open ground, inside the map, with at least 1 empty cell between footprints.
- **Farm fields:** a ring 1 cell wide around the farm hut is reserved for its fields, giving 12 field cells. The ring must be open ground. Fields may border other buildings directly; the 1-cell gap applies to the hut only *(proposal)*. Subjects can walk across fields.
- **Gatherers (woodcutter, quarry)** go on open ground and need at least 1 matching resource cell inside their work area.
- **Work area:** a circle with a radius of 4 cells. Its centre starts on the building and can be dragged up to 6 cells away. It is shown as a soft circle while placing and while the building is selected, with reachable trees or rocks highlighted.
- Nothing is paid at placement. The construction site waits for carriers to bring its wood and stone, so you can place a building before you have the materials.

## 4. Production

Workers really work, as in The Settlers IV: gatherers leave their building, walk to the resource, work it, and carry the result home to the output buffer. Millers and bakers work inside; carriers bring them their input.

| Building | Work cycle (per worker) | Per worker per day | Per building per day |
|---|---|---|---|
| Woodcutter | Walk to the nearest tree in the work area, chop 30 s, carry 1 wood home. A tree is gone after 4 trips. | ~3.3 | ~6.7 (2 workers) |
| Quarry | Walk to the nearest rock in the work area, work 45 s, carry 1 stone home | ~2.3 | ~7 (3 workers) |
| Farm | Walk to an empty field cell and sow (12 s). The crop ripens in 60 s. Walk to a ripe cell, harvest (12 s), carry 1 grain home. About 30 s per grain including walking. | 4 | **8** (2 workers) |
| Mill | 15 s: 1 grain → 1 flour | 8 | **8** |
| Bakery | 15 s: 1 flour → 1 bread | 8 | **8** |

- The food chain is balanced 1 : 1 : 1: **one farm, one mill and one bakery each handle 8 per day**, so one chain makes about 8 bread per day.
- Every production building has an **output buffer of 8 items** and stops working when it is full.
- Processors (mill, bakery) have an **input buffer of 8 per input good** and stop when it is empty.
- Daily figures are on paper. Walking and waiting for carriers make the real numbers somewhat lower; the headless runner will show by how much.

## 5. Subjects and jobs

- Every subject is in one of four states: **idle**, **building worker**, **carrier** or **builder**.
- Building workers are assigned per building with + and −, up to its worker slots.
- Carriers and builders are general pools. The player sets each pool's size with + and −. Pool members take whatever job is most urgent and nearest (section 7).
- Idle subjects wait at the Town Center.
- **Recruiting:** a button on the Town Center. It costs **10 bread, which must be in the Town Center's own stock**, and needs free housing. The new subject appears at the Town Center straight away (training time is an open item).
- Housing: 4 subjects per house.

## 6. Food and hunger

- In slice 1, food means bread.
- At nightfall, subjects eat **one loaf per two subjects**: ⌈subjects ÷ 2⌉ bread.
- Food is taken from storage areas and storehouses first and from the Town Center last, so food saved for recruiting is touched only when needed *(proposal)*.
- If there isn't enough, everything left is eaten and the night counts as a **hungry night**.
- **Leaving:** on the second hungry night in a row, and on every hungry night after that, **1 subject leaves** and walks off the map edge. Who leaves *(proposal)*: an idle subject first, then a carrier, then a builder, then the most recently assigned building worker.
- One night with enough food resets the count.

## 7. Logistics

- Each store (Town Center, storehouse, storage area) has its own stock and a total capacity (section 3).
- **Per-good limits:** in the store's panel, pick a good from a dropdown and adjust its limit with −5, −1, +1, +5. The limit is the most of that good the store accepts. By default there is no limit other than the total capacity. A limit of 0 means the store refuses that good.
- Carriers carry **one item per trip**.
- **Job priority** *(proposal, check in playtest)*:
  1. Construction materials to sites
  2. Inputs to processors (grain to mills, flour to bakeries)
  3. Food to the Town Center until it holds 30 (a reserve for recruiting)
  4. Emptying output buffers into the nearest store that accepts the good and has room
- Within a priority level, the nearest job goes first, measured from the carrier to the pickup plus from the pickup to the drop-off.
- A pickup can be a store or a building's output buffer, so a mill can be fed straight from a farm without the grain going into storage first.
- Building materials come from the nearest store that holds them. The Town Center is simply where the starting stock is.

## 8. Construction

- Placing a building creates a construction site. Carriers bring its materials.
- Builders walk to the nearest site that has materials and room for another builder. At most 2 builders per site *(proposal)*.
- Build time is split evenly across the materials: a site with half its materials delivered can be at most half built.
- When it's finished, workers can be assigned.

## 9. Movement and paths

- Walking speed: **1.0 cell/s** on bare ground, **1.5 cell/s** on a worn path. Walking was deliberately not slowed down with production: slower walking would mean more carriers for the same goods.
- Subjects walk in straight lines. Pathfinding around buildings comes in Phase 2.
- **Wear:** each cell counts how often subjects enter it, and each edge between neighbouring cells counts crossings (both capped at 150). A path becomes visible from 5 crossings, reaches full dirt colour at 100, and gives the speed bonus once the cell has 100.
- Paths fade by 1 per day on any cell nobody crossed that day *(proposal)*.
- Stone roads come in Phase 2; their numbers are not set yet.

## 10. Starting state

- Town Center centred at (20, 20), with two houses to its west (exact cells are set in Phase 1).
- 6 subjects, housing for 8.
- Town Center stock: 20 wood, 8 stone, 40 bread.

## 11. Parked for Phase 3

Not in slice 1, kept here so the design isn't lost:

- **Gold and tax.**
- **Stability**, with these speed bands for walking and work:

| Stability | Speed |
|---|---|
| 75 and above | ×1.25 |
| 50 to 74 | ×1.0 |
| 25 to 49 | ×0.9 |
| below 25 | ×0.75 |

## 12. Open items

- Recruit training time.
- Refunds when demolishing a building or cancelling a construction site.
- Check in playtest: the 30-bread Town Center reserve, carrier priorities, path fading, regrowth rates, recruit cost.
- Win and lose conditions (Phase 2).
