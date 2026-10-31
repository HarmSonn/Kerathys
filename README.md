# Kerathys

A homegrown game, made together with my girlfriend: a real-time-with-pause empire builder in the spirit of The Settlers IV, set in the fictional world of Kerathys.

**Status:** Phase 1 (foundation and logistics core). Slice 1 is playable with placeholder art.

## What's in here

| File | What it is | Current? |
|---|---|---|
| `ROADMAP.md` | Phases, what each one delivers, and when it counts as done | Yes |
| `docs/game-rules.md` | Slice 1 rules and numbers: time, economy, logistics, stability | **Source of truth**, replaces HANDOFF sections 5 and 6 |
| `docs/art-spec.md` | Sprite sizes, viewing angle, animation list and file rules for the hand-drawn art | Yes |
| `HANDOFF.md` | The original handoff brief: vision, world, long-term scope | Vision and world still apply; its numbers are outdated |
| `reference/prototype.html` | The single-file browser prototype of slice 1 | Reference only; its rules differ from `game-rules.md` |
| `art/templates/` | Drawing templates with footprint and anchor marked | Yes |

## Playing it

You need [Node.js](https://nodejs.org) 22 or newer.

```sh
npm install
npm run dev
```

Then open the address it prints (usually http://localhost:5173).

**Controls**

- **Move the map:** drag it, use WASD or the arrow keys. **Zoom:** mouse wheel or pinch.
- **Build:** pick a building at the bottom, then click the map. A green outline means it fits. Esc or right-click cancels. On a phone, tap once to see the outline and again to build.
- **Manage:** click a building to assign workers, see its status, or set store limits. Click the Town Center to recruit.
- **People:** with nothing selected, the side panel sets how many carriers and builders you have.
- **Speed:** pause with Space, or use 1, 2 and 3 for 1×, 2× and 4×.
- The game autosaves every sunrise. Save, Load and New are at the top.

## For developers

| Command | What it does |
|---|---|
| `npm run dev` | Run the game locally |
| `npm test` | Unit tests for the simulation |
| `npm run headless -- 40` | Play 40 days with a scripted player and print stock, population and food per day |
| `npm run typecheck` | Type-check everything |
| `npm run build` | Build a static site into `dist/` |
| `npm run placeholders` | Recreate missing placeholder art (never overwrites drawings) |

Code layout: `src/data/` holds all numbers and the art list, `src/sim/` is the simulation (no rendering), `src/render/` draws it with PixiJS, `src/ui/` is the HUD and panels.

## Art

Drawings go in `public/art/` and replace the placeholders of the same name. See `docs/art-spec.md` for sizes and names, and `art/templates/` for templates with the footprint and anchor marked.
