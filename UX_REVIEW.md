# The Last Good Plan: UI/UX Review

**Prepared for:** the founder
**Perspective:** half esports HUD (League, Dota, Valorant, TFT, Hearthstone Battlegrounds), half the Angry Birds /
Plants vs. Zombies school of tap-first, mobile-friendly games (Kingdom Rush, Clash Royale and Cut the Rope sit in
the same family)
**Build reviewed:** branch `ftl-auto-battler-as-carrier` at `e200bad` (swarm and duel encounters, carrier ports,
lance barrages, Booster module)

---

## The verdict in one paragraph

The game underneath is good, and better than its UI tells you. Swarm lanes, ship duels, a carrier wing and a
telegraphed lance you can dodge are four strong hooks. The UI presents them like a settings page. On a laptop it
works but feels like a dashboard: six equal-weight stat cards, paragraphs on every button, and a debrief that reads
like an email. On a phone it is broken in one place and painful everywhere else: the battlefield shrinks to a third
of its size, the build loop needs scrolling between the card you pick and the slot you tap, and the mission bar
overflows the screen during battles. Both schools I'm channeling would tell you the same thing in different words:
**make the battlefield the hero, put every decision under a thumb or a hotkey, and turn every number into a feeling.**

## The five changes I'd make first

1. **Fix the phone overflow during missions** (a two-line CSS fix, details in P0-1).
2. **Make portrait phones a separate layout, not a squeezed desktop.** Ship at the bottom, lanes running down from
   the top, build tray docked under the thumb. This is the single biggest decision in this review.
3. **Replace the module card list with a seed-packet tray**, PvZ style: icon, cost and a cooldown/affordability
   state, with details on long-press or hover. Drag or tap a packet, then tap a slot.
4. **Give hull and shield real bars and give resources real icons.** Health is the most important pixel in any
   esports HUD, and right now it lives inside a sentence (`Hull 120/120 | Shield 44/44`).
5. **Turn the debrief into a moment:** a 1 to 3 star rating, count-up rewards, an MVP bot card and one big Next
   button.

---

## How I reviewed it

- Ran the dev build and staged planning, a swarm mission, a ship duel with a lance barrage, and the debrief.
- Viewports: **375×812** (iPhone-class portrait) and **1440×900** (laptop).
- Measured layout in the browser instead of eyeballing it. All the numbers below come from those measurements or
  from the source files cited.

| Measurement | Phone 375×812 | Laptop 1440×900 |
| --- | --- | --- |
| Total page height in planning | 1,968 to 2,431 px (2.5 to 3 screens of scroll) | 900 px (no scroll) |
| Rendered battlefield canvas width | **337 px** (35% of its 960 px design size) | 972 px (101%) |
| Ship slot touch target (84 px design) | **~30 px** | ~85 px |
| In-canvas 12 px text (wave list, hints) | **~4 px** effective | ~12 px |
| Board column width while a mission runs | **478 px in a 375 px viewport** (clipped) | fits |

Other facts from the source:

- No audio and no haptics anywhere in `src/`.
- Three hotkeys total: Space (pause), D (log), Enter (start run).
- Six CSS rules set text at 8 to 11 px.
- The battlefield is a fixed 960×640 Phaser canvas scaled with `Phaser.Scale.FIT` (`src/game/createGame.ts`), so
  every pixel decision inside it shrinks with the screen.

---

## The two lenses

**The esports lens** asks: can I read the state of the fight in a 200 ms glance, without reading words? Pro HUDs are
built on these rules:

- Numbers are big and labels are tiny.
- Bars beat digits.
- Team colors are absolute: friendly cyan, enemy red, never mixed.
- Every threat has a timer.
- Nothing important lives in a sentence.
- The camera and HUD serve the spectator as much as the player.

**The Angry Birds / PvZ lens** asks: can a nine-year-old and a tired parent both play this with one thumb, and do they
smile when something happens? Those games are built on these rules:

- Show, never tell. The tutorial is one plant in one lane.
- Every tap gets a squash-and-stretch response and a sound.
- Costs are icons with numbers, not words.
- Every level ends with stars.
- The next action is always one obvious, fat, bright button.
- Nothing ever scrolls during play.

The game currently satisfies neither. The good news is that the fixes overlap about 70%.

---

## Problems, ranked

### P0: broken or blocking

**P0-1. The mission bar overflows phones during battles.** At 375 px wide the running mission bar and the canvas
column grow to 478 px and get clipped: the warship, the moon and half of "Pause Mission" are cut off. Root cause:
the phone media query sets `.mission-button { min-width: 0 }`, but the more specific `.mission-controls
.mission-button` and `.mission-bar.running .mission-button` (`src/style.css:518` and `:558`) keep `min-width: 220px`,
and `.mission-controls` is `flex-wrap: nowrap`. Two 220 px buttons cannot fit in 375 px.
*Fix:* override those two selectors inside the `max-width: 760px` query and allow the controls to wrap. Ship it
today.

**P0-2. The battlefield is unreadable on phones.** The canvas renders at 35% scale, so wave timers, the boss bar
label and slot labels drop to about 4 px, and ship slots become 30 px touch targets (Apple's minimum is 44 pt,
Material's is 48 dp). The lance warning, the best visual moment in the game, is a thin line on a postage stamp.
*Fix:* see "Two form factors" below. Short term, move all text out of the canvas into DOM overlays sized in CSS
pixels, and give slots invisible hit areas at least 48 px across.

**P0-3. On phones, the build loop requires scrolling between pick and place.** Building is the core verb of planning.
On a phone the board ends at about 425 px down the page, the first module card starts at about 761 px, and the
Launch Port card sits around 1,500 px. The loop is: scroll down, tap card, scroll up, tap slot, repeat. PvZ solved
this in 2009: the seed packets sit next to the lawn and never move.
*Fix:* a docked build tray directly under the board (phone) or as an action bar (desktop). Nothing in the core loop
should ever scroll.

**P0-4. Mid-battle reward modals pause the game.** Moon artifacts, mini-boss chests and boss epics all freeze the
mission and demand a choice. For a game whose promise is "don't pay attention while it runs", this is the one thing
that forces attention. Both schools agree: rewards go to the end screen.
*Fix:* queue them with a small "chest collected" toast and a counter. Present them on the debrief as a
chest-opening moment.

### P1: hurting the experience

**P1-1. Hull and shield are a sentence, not bars.** `Cycle 3 | Ship Duel: Corsair Frigate | Mission Running | Hull
120/120 | Shield 44/44` is how the game tells you whether you're dying. The rings around the ship do encode hull and
shield, but they are unlabeled and look decorative.
*Fix:* a unit-frame-style plate pinned to the ship: a thick hull bar with a shield overlay segment, a number on the
bar, and a red flash plus a slight shake on hull damage. Enemy capital ships get the mirrored plate at the top (the
boss bar is already the right idea; give it the same treatment).

**P1-2. The HUD is six equal cards full of filler.** Cycle, Solar, Minerals, Scrap, Commitment and Encounter all have
the same weight, and three of them carry the word "stored" or "efficiency" as a subtitle.
*Fix:* one slim resource strip with icons (sun, crystal, gear) and big numbers, with `+12` deltas floating off them
as income arrives. The encounter becomes a top-center "match header" with a timer. Commitment becomes a meter near
the doctrine control, because it only matters when you're about to change doctrine.

**P1-3. Every button is a paragraph.** Module cards, upgrade cards and the Launch Port card carry three to five lines
of prose. On a phone the Booster card is taller than the battlefield's ship board.
*Fix:* card face = icon + short name + cost icons. Details live in a long-press sheet (mobile) or a hover tooltip
(desktop), esports-style with stat deltas ("+12% fighter hull"). Write prose once, in the Log.

**P1-4. The tutorial tells instead of showing, and covers the HUD.** The tutorial banner sits over the top resource
row and explains in sentences. PvZ's first level is one lane, one plant type and a pointing hand.
*Fix:* a ghost hand that animates from the Solar packet to slot C3; dim everything except the two targets; one line
of text, max eight words. Mission 1 should be one lane.

**P1-5. The debrief is an email.** It has a title, two stat rows, three bolded labels with sentences, and a "Return
To Planning" button that also appears again in the mission bar underneath it.
*Fix:* stars (see Fun below), count-up resource gains with a coin sound, an MVP bot card ("Lancer Skiff: 312 damage,
2 lance dodges"), one primary button ("Next mission ▸") and a secondary "Rebuild" link. Remove the duplicate button.

**P1-6. There is no ceremony at the transition into battle.** "Start Mission" swaps a label and the game starts.
*Fix:* rename it **Launch**. Play a 1.5 s pre-fight beat: camera eases to the battlefield, an encounter card slides
in ("SHIP DUEL · Corsair Frigate · Siege Lance"), and a 3-2-1 or engine spool. Esports does this with team intros;
PvZ does it with the "Ready… Set… PLANT!" stamp. Same function: it marks the moment you stop planning and start
watching.

**P1-7. The encounter preview is buried.** You now have three genuinely different encounter types, and the planning
screen mentions which one is next only in a HUD card subtitle and the hint line.
*Fix:* a big "Next up" card in planning with an enemy silhouette, its weapons as icons, and one tip ("Boosters dodge
lances"). Kingdom Rush's wave preview and PvZ's "zombies standing on the street" pan both exist so you can plan.
Planning without seeing the enemy is guessing.

**P1-8. The lance warning deserves the full screen.** The telegraph itself is good (dashed line, corridor, "!",
locked countdown). It just stays inside the battlefield.
*Fix:* add a red edge vignette pulse, a two-tone warning sound, a haptic tick on phones, and a "PERFECT DODGE!"
callout over any unit that slips out. That last one turns a defensive mechanic into a reward moment.

### P2: polish and feel

**P2-1. Type.** Georgia for headings and Trebuchet for body read as "documentation". Pick per direction (see
Variants):
- Esports: a condensed geometric face such as Rajdhani or Oxanium, with tabular numerals for every counter.
- PvZ-style: a chunky rounded face such as Lilita One or Baloo 2.

Either way, set a floor of 12 px for anything readable, and remove the 8 to 11 px rules (six of them in
`src/style.css`).

**P2-2. Color.** Everything is teal on teal at similar values. The primary CTA does not stand out from secondary
buttons, and disabled buttons are nearly invisible on phones (see the greyed "Start Mission" in the phone
screenshots).
*Fix:* assign one "go" color used only for the primary action (a saturated green-cyan, or PvZ-style
sunflower-yellow on a green button). Formalize team colors: friendly = cyan/white, enemy = red/orange, neutral or
loot = gold. The lance is already red; keep red exclusive to enemy threats.

**P2-3. Juice.** None of these exist yet, and they cost hours each:
- **Placing a module:** a squash-and-stretch pop on the slot (the assembly effects are close; push the overshoot).
- **Hits:** hit-stop of 40 to 60 ms on capital-ship hits and on the lance impact.
- **Damage numbers:** small floating numbers, colored by source, toggleable.
- **Income:** coins or crystals arcing from destroyed enemies to the resource strip.
- **Big hits:** screen shake scaled to the damage taken.

**P2-4. Sound (none today).** A tap click, a slot "thunk", cannon pew, lance charge whine, lance fire, a fighter
launch whoosh, wave horn, and victory stinger. Both schools treat audio as half of the feedback. Default to on, with
a mute toggle in the HUD.

**P2-5. Speed and attention controls.** Only 1x and 2x exist. Esports spectating and idle games both want **1x / 2x /
4x**, and casual players want an **Auto-continue** toggle that starts the next mission after the debrief if nothing
needs a decision.

**P2-6. Hotkeys on desktop.**
- Modules: 1 to 9.
- Doctrines: Q, W, E.
- Fast-forward: F.
- Launch: Enter.

Show the key as a tiny badge on each control, like ability hotkeys.

**P2-7. Accessibility.**
- Respect `prefers-reduced-motion` for the shimmer, breathe and pulse animations (there are several on every panel).
- Never rely on red vs. green alone; the enemy shapes already differ, which is good.
- Add a colorblind-safe lance pattern (the dashes already help).

---

## Two form factors: my recommendation

Don't make one layout stretch. Ship **two layouts over one simulation**, the way Teamfight Tactics ships a PC HUD and a separate mobile HUD over the same game. The
sim already uses fixed world coordinates and the renderer is separate, which makes this unusually cheap for a game
at this stage.

### Phone portrait (< 700 px wide): "Pocket Carrier"

```
┌───────────────────────────┐
│ ☀ 120  ◆ 86  ⚙ 42   ⏸ 2x │  resource strip + pause/speed (thumb-safe top corners)
│ SHIP DUEL · Corsair  0:42 │  match header with timer
│ ███████████░░ enemy hull  │
├───────────────────────────┤
│          ▼ ▼ ▼            │  enemies enter from the TOP
│      ╎    ╎    ╎          │  three vertical lanes
│      ╎  ⬢ warship         │
│      ╎    ╎    ╎          │
│   ✈ ✈   fighters          │
│        ┌─────┐            │
│        │ 3×3 │  your ship │  ship at the BOTTOM, close to the thumb
│        └─────┘            │
│ ████████████░░ hull/shield│
├───────────────────────────┤
│ [☀][⛏][🛡][✹][⚙][✚][⇧][✈] │  seed-packet build tray, horizontally scrollable
│        [  LAUNCH  ]       │  one fat primary button
└───────────────────────────┘
```

- Rotate the battlefield 90°: lanes run top to bottom and the ship sits at the bottom. Portrait lane games
  (Rush Royale, Clash Royale) work because the threat approaches the thumb. This is a
  view transform in `RunScene`, not a sim change. Map world `(x, y)` to screen `(y, x)`, and draw text through a
  helper that doesn't rotate.
- Ship slots become 64+ px squares. The board is the bottom third of the screen and is the main interaction
  surface.
- Tabs disappear. Upgrades, Bots, Doctrine and Log become bottom sheets opened from icons in the header. In planning
  the tray is the build tray; during battle it collapses to doctrine chips and speed.
- **No page scroll, ever.** The layout is `100dvh` with the canvas filling the middle.

### Desktop / tablet landscape (≥ 1180 px): "Arena"

```
┌──────────────────────────────────────────────────────────────┐
│ ☀120 ◆86 ⚙42        SHIP DUEL · Corsair Frigate · 0:42     ⏸ 1x 2x 4x │
├──────────┬───────────────────────────────────────┬───────────┤
│ FLEET    │                                       │ WAVES     │
│ ▣ Lancer │                                       │ ▸ 0:18 ✈x3 │
│ ▣ Warden │        battlefield (hero, 70%)        │ ▸ 0:38 ◆x4 │
│ ✈ wing 4 │                                       │ KILLFEED  │
│ dodge %  │                                       │ Lancer→Dart│
├──────────┴───────────────────────────────────────┴───────────┤
│ [1☀][2⛏][3🛡][4✹][5⚙][6✚][7⇧][8✈]   Q W E doctrine   [ LAUNCH ↵ ] │
└──────────────────────────────────────────────────────────────┘
```

- An action bar at the bottom with hotkeys, MOBA-style.
- Unit frames on the left (party-frame style: hp bar, dodge %, role icon).
- A wave timeline plus a small killfeed on the right.
- The battlefield gets 70% of the width and loses the internal panel borders it draws today.
- Tablets in portrait use the phone layout; tablets in landscape use Arena.

### In between (700 to 1180 px)

Arena layout with the side columns collapsed into icon rails. Never the current "everything stacked vertically"
fallback.

---

## Fun suggestions (opinionated)

1. **Stars.** One star: survive. Two: survive with the moon fully mined (or the warship destroyed in a duel). Three:
   no bots lost. Stars gate nothing at first; they exist to make you replay. This is the cheapest retention system
   ever invented.
2. **Sector map between missions.** FTL's beacon map meets Angry Birds' level select. Let the player pick the next
   node: Swarm, Duel, Shop, Derelict (free module), Nebula (no shields, double scrap). The encounter rotation you
   just built becomes a choice instead of a schedule.
3. **"PERFECT DODGE!" and "WING DOWN" callouts.** Announcer-style text for notable moments: perfect dodge, warship
   destroyed in under 20 s, no hull damage taken. Esports announcers and PvZ's "Huge wave of zombies is approaching!"
   banner do the same job.
4. **MVP bot.** End every mission with the top-performing bot's card, like a match MVP screen. Players will name and
   protect favorites.
5. **Observer camera on phones.** During battle, gently zoom toward the action (the lance corridor, a boss
   arrival), then ease back. Esports observers do this so viewers never miss the play. It also fixes much of the
   small-screen readability problem for free.
6. **Haptics.** A short vibration on lance fire, boss arrival and hull below 25%, through `navigator.vibrate` where
   supported.
7. **Daily Seed.** One shared seed per day, same encounters for everyone, and a score. It's the competitive hook
   without any netcode.
8. **Fighter launch moment.** When a Launch Port fires, the port slot flashes, a short catapult streak appears, and a
   tiny whoosh plays. The booster trail is already there; add the slot flash and sound and the carrier fantasy
   lands.
9. **Chest of the mission.** All rewards collected mid-battle (see P0-4) open together on the debrief, one at a
   time, Clash-style. It turns the pause into the payoff.

---

## Four directions you could take the game

### A. "Arena Broadcast": esports-first

The game as a spectator sport you happen to coach.

- **Look:** dark, sharp, condensed type, tabular numbers, thin glowing team-color lines.
- **HUD:** a killfeed, a wave timeline, unit frames and post-match stats (DPS charts, damage-taken pie).
- **Progression:** Daily Seed leaderboards and a "replay last mission" button with a scrubbable timeline.
- **Best on:** desktop.
- **Risk:** reads as cold and intimidating to casual players. Best fit if your audience is FTL and auto-battler
  veterans.

### B. "Pocket Carrier": Angry Birds / PvZ-first

The game as a cozy toy.

- **Look:** portrait only, chunky rounded art, saturated friendly palette, big tactile seed packets, a mascot
  captain who reacts to events.
- **Progression:** stars, a level-select sector map and short missions (60 to 90 s).
- **Onboarding:** almost no text; every new module is introduced with a one-lane demo level.
- **Best on:** phones.
- **Risk:** strategy depth (doctrine, commitment, adjacency) gets hidden, and desktop feels like a blown-up phone
  game.

### C. "Hybrid Bridge": my recommendation

One sim and two native layouts (Pocket on phones, Arena on desktop) with a shared visual language: chunky,
readable silhouettes and a playful palette from B, and the information discipline from A (bars, timers, team
colors, hotkeys). TFT proves the split works: the same game feels native on a phone and on a big screen because each gets its own HUD.

- Do the P0 items, then the phone layout, then stars and the debrief.
- Leave the sector map and Daily Seed for after the core feels right.

### D. "Idle Admiral": the casual extreme

Lean all the way into "set it and watch":

- **Battle UI:** fades out during battle (a cinematic mode) and comes back on tap.
- **Pacing:** auto-continue between missions, plus 4x and 8x speed.
- **Offline progress:** "your fleet ran 6 missions while you were away" with a summary.
- **Monetization:** the natural fit if you ever add any (cosmetic ship skins, not power).
- **Best on:** phones, as a second-screen game.
- **Risk:** the lance-dodge and duel drama loses its audience, because nobody is watching.

---

## Suggested order of work

| Phase | Items | Rough effort |
| --- | --- | --- |
| Now | P0-1 overflow fix · remove duplicate debrief button · 12 px text floor · disabled-button contrast · 48 px slot hit areas | under a day |
| Next | Hull/shield unit frame · resource strip with icons and deltas · seed-packet tray · rewards queued to debrief · stars + count-up debrief | 1 to 2 weeks |
| Then | Portrait "Pocket" layout with rotated battlefield · Arena layout with action bar and hotkeys · sound pass · launch ceremony | 2 to 4 weeks |
| Later | Sector map · Daily Seed · observer camera · MVP card · haptics | ongoing |

Ship the Now row before anyone else plays it on a phone.
