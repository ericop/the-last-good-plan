# DEV_NOTES

## Architecture Overview

The MVP separates simulation from presentation.

- `src/core/gameController.ts` owns the active run state, subscriptions, command dispatch, and persistence sync.
- `src/core/processCommand.ts` is the command surface for all player intent.
- `src/core/simulation.ts` advances execution time, waves, module passives, bots, enemies, rewards, and cycle resolution.
- `src/ui/uiManager.ts` renders the sidebar, HUD, discovery log, reward modals, and results using DOM.
- `src/scenes/RunScene.ts` renders the board, battlefield, bots, enemies, and pause feedback with Phaser.

The key future-proofing choice is that UI and scene input never mutate gameplay state directly. They always dispatch commands.

## Adding Modules

1. Add the new module definition to `src/data/modules.ts`.
2. Extend the `ModuleId` union in `src/types/gameTypes.ts`.
3. Add module-specific passive behavior in `src/core/simulation.ts` if it should act on the board.
4. Update any UI copy if the module needs special planning guidance.

## Adding Bots

Bots are produced from merge recipes rather than authored separately.

1. Add or update a recipe in `src/data/merges.ts`.
2. Make sure its tags, role, and stats reflect its intended logic family.
3. If the new role needs special behavior beyond the current mining, defense, support, or hybrid logic, extend `applyBotBehavior` in `src/core/simulation.ts`.

## Adding Merge Recipes

1. Add a new `MergeRecipe` entry to `src/data/merges.ts`.
2. Keep the pairing logic understandable. The current pattern language is deliberate:
   - solar pairs create nimble energy-based frames
   - mining plus cargo/support creates industrial frames
   - shield plus cannon creates hold-the-line defenders
3. The discovery log will pick it up automatically if it is present in the recipe table.

## Adding Doctrines

1. Add the doctrine to the `DoctrineId` union in `src/types/gameTypes.ts`.
2. Define its weights and summary in `src/data/doctrines.ts`.
3. Update any UI assumptions in `src/ui/uiManager.ts`.
4. Extend doctrine-specific logic in `src/core/simulation.ts` only when needed.

## Adding Artifacts

1. Add the artifact definition to `src/data/artifacts.ts`.
2. Reuse the existing effect fields where possible.
3. If an artifact needs a brand-new rule hook, extend the relevant helper in `src/core/utils.ts` or the sim logic in `src/core/simulation.ts`.
4. Keep artifacts exciting but readable. The player should be able to tell why the run changed.

## Adding Enemies

1. Add the enemy definition to `src/data/enemies.ts`.
2. Add or update wave scheduling in `src/data/waves.ts`.
3. Extend `applyEnemyBehavior` in `src/core/simulation.ts` if the enemy needs a different movement or targeting rule.

## Save System

- `src/save/localStorageSave.ts` persists discovery progress and meta progress.
- The active run is intentionally not persisted.
- Discovery state is keyed by recipe id, so changing recipe ids will break continuity.

## Future Same-Room Couch Co-op Support

The MVP does not implement couch co-op, but the structure is designed so it can be added without rewriting core systems.

Recommended later split:
- Player 1: builder and upgrader
- Player 2: doctrine manager, discovery helper, reward helper

Why the current architecture helps:
- All player intent already flows through command objects in `src/types/commands.ts` and `src/core/processCommand.ts`.
- The DOM HUD is modular and can be split into separate control zones later.
- The Phaser scene only renders and forwards clicks into commands.
- Shared resources, shared ship state, and shared reward choice already exist as a single-source-of-truth run state.

A practical future co-op path:
1. Add a lightweight input router that can label commands with a source player id.
2. Partition sidebar panels into role-based sections without changing the simulation API.
3. Add optional command locks or soft reservations so both players can work calmly without fighting over the same panel.
4. Keep the run state shared. Do not fork separate inventories or ships.
