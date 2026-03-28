# The Last Good Plan

---

## ?? Short Description

Design a self-sustaining spaceship, commit to a plan, and watch it either hold... or fall apart in the silence of deep space.

[Try the game yourself](https://ericop.github.io/the-last-good-plan/)

## ?? About This Game

The Last Good Plan is a calm system-building roguelike about designing a self-sustaining spaceship against the quiet pressures and unforgiving realities of life in deep space.

You combine technology from your ship into autonomous, irreversible bots that operate on their own. Every merge is permanent. Every decision matters.

There are no quick reactions here. No frantic clicks.
Only the plan you chose... and what it becomes.

Commit to a strategy, let your systems run, and watch your ship either stabilize into something brilliant... or slowly unravel.

## Features

- Planning, execution, and end-of-cycle results loop
- Exactly three resources: solar, minerals, scrap
- Exactly three doctrines: balanced, extraction_focus, preservation_mode
- Commitment bonus that starts at +50% and drops by 10% per doctrine change during execution
- 3x3 ship board with adjacency-aware merges
- Six base modules and ten merge outcomes
- Discovery log with unknown, discovered, and known/mastered-lite states
- Predictable wave schedule with a mini-boss
- Moon objective that reveals artifact rewards when fully mined
- Three upgrade nodes
- LocalStorage persistence for discovery and meta knowledge
- Instant pause with `Space` or the pause button

## Setup

1. Install Node.js 20+.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open the local Vite URL in your browser.

## Other Commands

- `npm run typecheck`
- `npm run build`
- `npm run test`
- `npm run preview`

## Controls

- Click a module card in the sidebar, then click an empty ship slot to place it.
- Click occupied ship slots to select them for merge preview.
- Click `Commit Merge` to consume both modules and assemble a bot.
- Click doctrine buttons to choose a starting doctrine or optionally switch it mid-cycle.
- Press `Space` to pause or unpause instantly during execution.
- Click `Discovery Log` to inspect known and unknown merge outcomes.
- Choose one artifact when a moon reward or boss chest appears.

## Gameplay Notes

- Bots gain efficiency directly from the current commitment bonus.
- Zero doctrine changes during a cycle grants a perfect-commitment reserve bonus.
- Some merge outcomes are strong, some are merely practical, and some are intentionally weak but informative.
- Cargo Cores and adjacency matter for economy, salvage, and merge planning.

## Project Layout

- `src/core`: simulation, commands, run-state creation, and reusable helpers
- `src/data`: doctrines, modules, merges, waves, artifacts, and enemies
- `src/game`: Phaser bootstrapping and layout constants
- `src/scenes`: Boot, Main Menu, and Run scenes
- `src/ui`: DOM-driven HUD, panels, discovery log, reward modals, and results modals
- `src/save`: localStorage persistence helpers
- `src/types`: shared TypeScript types and command definitions

## Persistence

The MVP persists discovery progress and lightweight meta progression in localStorage. It does not save an in-progress run.


