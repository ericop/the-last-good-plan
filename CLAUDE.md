# The Last Good Plan

A casual auto-battler (Line Wars meets FTL): build a 3×3 ship, merge modules into bots, pick a jump on the sector map,
and watch the mission play out. TypeScript + Vite + Phaser 3, DOM UI over a Phaser canvas.

Read [DEV_NOTES.md](DEV_NOTES.md) for how the systems fit together and [UX_REVIEW.md](UX_REVIEW.md) for the design
direction. The chosen direction is **Hybrid Bridge** (variant C): one sim, a portrait "pocket" layout on phones and an
"arena" layout on desktop.

## Commands

- `npm run dev` serves at `http://localhost:5173/the-last-good-plan/` (Vite `base` is `/the-last-good-plan/`).
  `.claude/launch.json` lets Claude Code's browser preview start it.
- `npm run typecheck`, `npm run test`, `npm run build`. Run one test file with `npx vitest run <path>`.
- Pushing to `main` deploys to GitHub Pages (`.github/workflows/deploy.yml`). There are no CI checks on PRs, so run
  typecheck, tests, and build locally before merging.

## Architecture rules

- **Sim and presentation are separate.** `src/core/*` owns all game state and rules and never touches the DOM or
  Phaser. `src/ui/uiManager.ts` renders the DOM; `src/scenes/RunScene.ts` renders the battlefield. Neither mutates
  state directly: every player action is a `GameCommand` dispatched through `GameController` into `processCommand`.
- **New commands must pass the tutorial gate.** `isTutorialCommandAllowed` in `src/core/tutorial.ts` silently drops
  commands a tutorial step does not list. Add new commands to the steps where they are reachable.
- **Never pause mid-mission for a choice.** Rewards found during a fight go to `simulation.chests` and open at the
  debrief. Story beats during a fight are non-blocking comm messages; dialog with choices happens between levels.
- **Runs default to campaign mode.** Tests about general mechanics should create runs with `{ mode: "roguelike" }`,
  or they will hit level renames and intro dialog.
- **Story script is data.** Edit `src/data/story.ts`; `story.test.ts` rejects unknown speakers, unreachable choice
  tags, and em dashes in dialog.
- **All HUD text lives in the DOM**, never in the canvas, so it stays readable at phone scale.
- **Everything in `RunScene` goes inside `this.world`.** Portrait phones rotate that container by -90° and swap the
  game size to 640×960; the sim keeps landscape coordinates. New texts need `setRotation(-this.world.rotation)`.
- **Layouts** come from `src/ui/layoutMode.ts` (`pocket` / `compact` / `arena`), written to `#app[data-layout]`.
  Menu-mode overrides sit after the layout rules in `style.css` because they share specificity.

## UI pitfalls already hit

- `UIManager` re-renders each section by replacing `innerHTML` when its string changes, and execution emits about
  every 0.12s. Keep fast-changing values (timers, countdowns) out of sections with entry animations, or the
  animation replays every frame (the killfeed flicker bug).
- Keep panels that swap content at a fixed height (the build tray does), or the canvas above resizes and jumps.
- Older broad rules like `.upgrade-card span { display: block }` still exist; new inline elements inside cards need
  more specific selectors.

## Adding content

- **Module:** `ModuleId` in `src/types/gameTypes.ts`, `MODULE_DEFINITIONS`, and if mergeable `MODULE_ORDER`,
  `MODULE_TRAITS`, and `countModules` in `src/data/merges.ts`; `moduleCounts` in `tutorial.ts`; `TRAY_LABELS` in
  `uiManager.ts`. The recipe count in `mergeSystem.test.ts` is pairs + trios + doubled trios (98 for 7 modules).
- **Campaign level beat:** add a timed event to the level in `src/data/story.ts`; use `byTag` to vary it by the
  intro choice.
- **Warship:** append to `src/data/warships.ts`. **Route:** `ROUTES` in `src/core/encounters.ts`, plus its weight
  in `pickRoute` in `src/core/sectorMap.ts` so it appears on the map.

## Testing

- `src/core/missionFlow.test.ts` plays full missions on every route headlessly. Check it first after sim changes.
- `src/ui/uiManager.test.ts` renders the real UI under happy-dom. Drive it with `controller.dispatch(...)`; mutating
  state directly does not trigger a re-render.
- Sim tests use `Math.random`, so assert invariants and outcomes, not exact numbers.

## Checking the game in Claude Code's browser pane

- When the pane is hidden, `requestAnimationFrame` and CSS animations pause and screenshots can be stale.
- To stage a scenario, add a temporary hook at the end of `src/main.ts`:
  `const game = createGame(controller); // TEMP-DEBUG` and
  `Object.assign(window, { __controller: controller, __game: game }); // TEMP-DEBUG`, then step frames with
  `__game.step(t, 33.3)`. Step only a few frames per call: looping hundreds of steps synchronously froze the app.
  Remove the hook before committing (`rg TEMP-DEBUG src` must return nothing).
- `localStorage.clear()` boots straight into the tutorial; a save with `onboarding.tutorialCompleted: true` boots to
  the menu.

## Conventions

- Comments are rare and explain why, not what. No em dashes in code, comments, docs, or commits.
- Several files start with a UTF-8 BOM (`src/main.ts`, `src/game/constants.ts`, `DEV_NOTES.md`, `vite.config.ts`, and
  others). Preserve it when editing.
- Split commits by concern (game logic, UI, docs).
