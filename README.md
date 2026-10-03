# The Last Good Plan
---

Design a self-sustaining spaceship, commit to a plan, and watch it either hold... or fall apart in the silence of deep space.

[Try the game yourself](https://ericop.github.io/the-last-good-plan/)

## 🚀⚙️ About This Game

The Last Good Plan is a calm system-building roguelike about designing a self-sustaining spaceship against the quiet pressures and unforgiving realities of life in deep space.

You combine technology from your ship into autonomous, irreversible bots that operate on their own. Every merge is permanent. Every decision matters.

There are no quick reactions here. No frantic clicks.
Only the plan you chose... and what it becomes.

Commit to a strategy, let your systems run, and watch your ship either stabilize into something brilliant... or slowly unravel.

<img width="2516" height="1298" alt="image" src="https://github.com/user-attachments/assets/57f43050-0448-49f9-8e8d-a13165b348b1" />


## Features

- Planning, execution, and end-of-cycle results loop
- Exactly three resources: solar, minerals, scrap
- Exactly three doctrines: balanced, extraction_focus, preservation_mode
- Commitment bonus that starts at +50% and drops by 10% per doctrine change during execution
- 3x3 ship board with adjacency-aware merges
- Six base modules and ten merge outcomes
- Discovery log with unknown, discovered, and known/mastered-lite states
- Three encounter types that rotate by mission:
  - Swarm Defense: tower-defense style streams of darts, scavengers, and brutes marching down three lanes, ending in a mini-boss
  - Ship Duel (every 3rd mission): an FTL-style warship parks across the field and trades charged laser and missile volleys with your ship
  - Boss (every 10th mission): a boss capital ship with its own weapons, shields, and special behaviors
- Pulse Cannons fire visible bolts; enemy lasers hit shields first and missiles punch through half of them
- Telegraphed lance barrages: warships and bosses lock a big beam onto your densest group of units, show a red
  warning line for about two seconds, then fire. Units with dodge may notice and boost out of the line
- Booster module: each Booster merged into a bot gives 33% dodge (66% with two). Placed on the ship, it pulses
  nearby small enemies back down their lanes
- Booster trails and the charge-shot warning are ported from [Rainbow-Survivors](https://github.com/ericop/Rainbow-Survivors)
- Carrier play: research Hangar Tech to build Launch Ports that launch a fighter wing on their own during battle
  - Ports next to a Mineral Drill build mining skiffs, next to a Repair Node build tenders, otherwise interceptors
  - Adjacent Pulse Cannons, Shield Emitters, and Solar Collectors boost wing firepower, hull, and launch speed
- Moon objective that reveals artifact rewards when fully mined
- Four upgrade nodes, including Hangar Tech
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


