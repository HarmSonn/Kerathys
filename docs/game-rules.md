# Kerathys: Game Rules (Slice 1)

*Phase 0 draft, agreed 31 October 2026. Replaces sections 5 and 6 of `HANDOFF.md`.*

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
- **Forest cell:** up to 3 trees, each giving 4 wood when felled. A missing tree regrows every 8 days *(proposal)*.
- **Hill cell:** 20 stone, never regrows *(proposal)*.
- Trees and rocks are drawn per cell and thin out as they are used up. Empty cells show stumps or bare rock.

## 3. Buildings

Buildings have real footprints that match their art. This replaces the prototype's 1-cell footprint drawn at 1.5 cells.

| Building | Footprint | Wood / Stone / Gold | Storage | Workers | Build time |
|---|---|---|---|---|---|
| Town Center | 4 × 4 | starter | 300 | none | n/a |
| Storage area | 2 × 2 | 4 / 0 / 0 | 200 | none | 10 s |
| Storehouse | 3 × 3 | 8 / 4 / 10 | 400 | none | 30 s |
| House | 2 × 2 | 6 / 2 / 0 | n/a | none (holds 4 subjects) | 20 s |
| Woodcutter | 2 × 2 | 3 / 0 / 0 | n/a | 2 | 15 s |
| Quarry | 2 × 2 | 4 / 0 / 0 | n/a | 3 | 15 s |
| Farm | 2 × 2 | 6 / 0 / 0 | n/a | 2 | 20 s |
| Mill | 3 × 3 | 7 / 3 / 20 | n/a | 1 | 30 s |
| Bakery | 3 × 3 | 7 / 3 / 20 | n/a | 1 | 30 s |

Build time counts only once materials are on site (section 8).

### Placement

- The whole footprint must be on open ground, inside the map, with at least 1 empty cell between footprints.
- **Gatherers (woodcutter, quarry)** go on open ground and need at least 1 matching resource cell inside their work area.
- **Work area:** a circle with a radius of 4 cells. Its centre starts on the building and can be dragged up to 6 cells away. It is shown as a soft circle while placing and while the building is selected, with reachable trees or rocks highlighted.
- Gold is paid at placement and must be available. Wood and stone are not needed up front: the construction site waits for carriers to bring them.

## 4. Production

| Building | Work cycle (per worker) | Roughly per day |
|---|---|---|
| Woodcutter | Walks to the nearest tree in the work area, chops for 12 s, carries 1 wood back to the output buffer | ~6–7 wood |
| Quarry | Walks to the nearest rock in the work area, works for 20 s, carries 1 stone back | ~4 stone |
| Farm | 25 s per grain at the building (fields are not modelled in slice 1) | ~4.8 grain |
| Mill | 15 s: 1 grain → 1 flour | up to 8 flour |
| Bakery | 20 s: 2 flour → 3 bread | up to 18 bread |

- Every production building has an **output buffer of 8 items** and stops working when it is full.
- Processors (mill, bakery) have an **input buffer of 8 per input good** and stop when it is empty.
- Times above are at stability ×1.0 (section 10).

## 5. Subjects and jobs

- Every subject is in one of four states: **idle**, **building worker**, **carrier** or **builder**.
- Building workers are assigned per building with + and −, up to its worker slots.
- Carriers and builders are general pools. The player sets each pool's size with + and −. Pool members take whatever job is most urgent and nearest (section 7).
- Idle subjects wait at the Town Center.
- **Recruiting:** a button on the Town Center. It costs **10 food, which must be in the Town Center's own stock**, and needs free housing. The new subject appears at the Town Center straight away (training time is an open item).
- Housing: 4 subjects per house.

## 6. Food

- In slice 1, food means bread.
- At nightfall, subjects eat **one loaf per two subjects**: ⌈subjects ÷ 2⌉ bread. This keeps food in whole numbers while matching the agreed 0.5 per subject.
- Food is taken from storage areas and storehouses first and from the Town Center last, so food saved for recruiting is touched only when needed *(proposal)*.
- If there isn't enough, everything left is eaten and the settlement is **starving** until a night when there is enough.

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

- Walking speed: **1.0 cell/s** on bare ground, **1.5 cell/s** on a worn path.
- Subjects walk in straight lines. Pathfinding around buildings comes in Phase 2.
- **Wear:** each cell counts how often subjects enter it, and each edge between neighbouring cells counts crossings (both capped at 150). A path becomes visible from 5 crossings, reaches full dirt colour at 100, and gives the speed bonus once the cell has 100.
- Paths fade by 1 per day on any cell nobody crossed that day *(proposal)*.
- Stone roads come in Phase 2; their numbers are not set yet.

## 10. Stability

- Starts at **60** and moves toward its target by **5 per day**, continuously during daylight.
- **Target:** 65, plus 15 if the stores hold at least 2 nights' food after eating (2 × ⌈subjects ÷ 2⌉), minus 30 while starving.
- **Effect** on the walking speed and work speed of all subjects:

| Stability | Speed |
|---|---|
| 75 and above | ×1.25 |
| 50 to 74 | ×1.0 |
| 25 to 49 | ×0.9 |
| below 25 | ×0.75 |

- No tax in slice 1. Tax comes in Phase 3, once gold has uses.

## 11. Starting state

- Town Center centred at (20, 20), with two houses to its west (exact cells are set in Phase 1).
- 6 subjects, housing for 8.
- Town Center stock: 20 wood, 8 stone, 40 bread. Treasury: 50 gold. Stability 60.

## 12. Open items

- **Gold has no income in slice 1.** With 50 gold you can afford exactly one mill, one bakery and one storehouse. That caps the slice at one food chain, which feeds about 28 subjects. Decide whether that's fine for the first playtest or whether to start with more gold.
- Recruit training time.
- Refunds when demolishing a building or cancelling a construction site.
- Check in playtest: the 30-bread Town Center reserve, carrier priorities, path fading, regrowth rates.
- Win and lose conditions (Phase 2).
