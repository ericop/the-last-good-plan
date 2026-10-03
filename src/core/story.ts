import { ALIEN_SPECIES, CAMPAIGN_LENGTH, CAMPAIGN_LEVELS, RESCUE_LINES, UNCHARTED_BULLETINS, type CampaignLevel } from "../data/story";
import { WARSHIP_DEFINITIONS } from "../data/warships";
import { GAME_WIDTH, SHIP_CENTER } from "../game/constants";
import type { DialogLine, DialogScene, FighterInstance, RunState, SectorMap, SpeakerId } from "../types/gameTypes";
import { isCapitalShip } from "./encounters";
import { addMessage } from "./utils";

const COMM_BASE_TIME = 2.4;
const COMM_TIME_PER_CHAR = 0.035;
const RESCUE_ANIMATION_TIME = 4;
const RESCUE_HULL_REPAIR = 0.35;
const RESCUE_CAPITAL_DAMAGE = 0.25;
const HERO_STATION = { x: SHIP_CENTER.x + 60, y: SHIP_CENTER.y + 185 };
const HERO_HP_PER_LEVEL = 0.15;
const DOOM_WARNING = 6;
const DOOM_RESCUE_AT = 1.5;
const DOOM_WIDTH = 130;
const UNCHARTED_BULLETIN_CHANCE = 0.45;
const UNCHARTED_RESCUE_CHANCE = 0.35;
export const SEED_SPACE = 36 ** 6;

export function getCampaignLevel(state: Pick<RunState, "mode" | "cycle">): CampaignLevel | undefined {
  return state.mode === "campaign" ? CAMPAIGN_LEVELS[state.cycle - 1] : undefined;
}

export function createCampaignMap(): SectorMap {
  const columns = CAMPAIGN_LEVELS.map((level, index) => [
    {
      id: `campaign-${level.number}`,
      column: index,
      row: 0,
      rows: 1,
      cycle: level.number,
      route: level.route,
      next: index < CAMPAIGN_LEVELS.length - 1 ? [`campaign-${level.number + 1}`] : [],
      title: `Level ${level.number}: ${level.title}`,
    },
  ]);
  return { index: 0, seed: 0, columns, path: [], selectedNodeId: columns[0][0].id };
}

export function formatSeed(seed: number): string {
  return (seed % SEED_SPACE).toString(36).toUpperCase().padStart(6, "0");
}

export function parseSeed(text: string | undefined): number | undefined {
  const cleaned = text?.trim().toUpperCase();
  if (!cleaned) {
    return undefined;
  }
  if (/^[0-9A-Z]{1,6}$/.test(cleaned)) {
    return parseInt(cleaned, 36);
  }
  let hash = 2166136261;
  for (const character of cleaned) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  return (hash >>> 0) % SEED_SPACE;
}

function seededRoll(seed: number, cycle: number, salt: number): number {
  let value = (seed ^ Math.imul(cycle + 1, 2654435761) ^ Math.imul(salt + 7, 40503)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 2246822507) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 3266489909) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

export function applyCampaignLevel(state: RunState): void {
  const level = getCampaignLevel(state);
  if (!level) {
    return;
  }
  const simulation = state.simulation;
  simulation.encounterName = `Level ${level.number}: ${level.title}`;
  if (level.warshipId) {
    const warship = WARSHIP_DEFINITIONS.find((definition) => definition.id === level.warshipId);
    for (const wave of simulation.upcomingThreats) {
      if (wave.kind === "warship" && warship) {
        wave.warshipId = warship.id;
        wave.label = `Warship: ${warship.name}`;
      }
    }
  }
  if (level.extraWaves) {
    simulation.upcomingThreats = [...simulation.upcomingThreats, ...level.extraWaves.map((wave) => ({ ...wave }))].sort(
      (left, right) => left.time - right.time,
    );
  }
}

function openDialog(state: RunState, scene: DialogScene): void {
  state.story.dialog = { lines: scene.lines, index: 0, options: scene.choice?.options, after: scene.after ?? [] };
}

export function startIntroDialog(state: RunState): void {
  const level = getCampaignLevel(state);
  if (!level || state.story.introSeen.includes(level.number)) {
    return;
  }
  state.story.introSeen.push(level.number);
  state.story.choiceTag = undefined;
  openDialog(state, level.intro);
}

export function startOutroDialog(state: RunState): void {
  const level = getCampaignLevel(state);
  if (level && level.outro.length > 0) {
    openDialog(state, { lines: level.outro });
  }
}

export function advanceDialog(state: RunState): void {
  const dialog = state.story.dialog;
  if (!dialog) {
    return;
  }
  if (dialog.index < dialog.lines.length - 1) {
    dialog.index += 1;
  } else if (dialog.options) {
    return;
  } else if (dialog.after.length > 0) {
    state.story.dialog = { lines: dialog.after, index: 0, after: [] };
  } else {
    state.story.dialog = undefined;
  }
}

export function chooseDialog(state: RunState, optionIndex: number): void {
  const dialog = state.story.dialog;
  const option = dialog?.options?.[optionIndex];
  if (!dialog || !option || dialog.index < dialog.lines.length - 1) {
    return;
  }
  state.story.choiceTag = option.tag;
  state.story.dialog = { lines: option.reply, index: 0, after: dialog.after };
}

export function captureCheckpoint(state: RunState): void {
  const snapshot: RunState = {
    ...state,
    story: { ...state.story, dialog: undefined },
    campaign: { ...state.campaign, checkpoint: undefined },
  };
  state.campaign.checkpoint = JSON.stringify(snapshot);
}

export function restoreCheckpoint(state: RunState): RunState | undefined {
  if (!state.campaign.checkpoint) {
    return undefined;
  }
  const restored = JSON.parse(state.campaign.checkpoint) as RunState;
  restored.campaign = { ...state.campaign };
  restored.meta = { ...state.meta };
  restored.discovery = state.discovery;
  restored.onboarding = { ...state.onboarding };
  restored.phase = "planning";
  return restored;
}

function resolveLines(state: RunState, event: { lines?: DialogLine[]; byTag?: Record<string, DialogLine[]> }): DialogLine[] {
  if (event.byTag) {
    const tag = state.story.choiceTag;
    return (tag && event.byTag[tag]) || Object.values(event.byTag)[0] || [];
  }
  return event.lines ?? [];
}

function createHero(state: RunState, level: CampaignLevel): FighterInstance | undefined {
  const hero = level.hero;
  if (!hero) {
    return undefined;
  }
  return {
    id: `hero-${hero.speaker}`,
    portSlotId: "hero",
    kind: "interceptor",
    color: hero.color,
    x: HERO_STATION.x,
    y: HERO_STATION.y,
    heading: 0,
    orbit: 0,
    hp: Math.round(hero.hp * (1 + Math.max(0, state.cycle - 3) * HERO_HP_PER_LEVEL)),
    maxHp: Math.round(hero.hp * (1 + Math.max(0, state.cycle - 3) * HERO_HP_PER_LEVEL)),
    speed: 64,
    attack: 5 + state.cycle * 0.4,
    range: 120,
    mining: 0,
    support: 0,
    dodge: 0.5,
    launchBoost: 0,
    hero: { name: hero.name, shipName: hero.shipName, speaker: hero.speaker },
  };
}

export function getHeroStation(): { x: number; y: number } {
  return HERO_STATION;
}

export function armMissionStory(state: RunState): void {
  const simulation = state.simulation;
  const level = getCampaignLevel(state);
  if (level) {
    const hero = createHero(state, level);
    if (hero) {
      simulation.fighters.push(hero);
    }
    if (level.rescue) {
      simulation.rescueArmed = {
        species: ALIEN_SPECIES[Math.floor(Math.random() * ALIEN_SPECIES.length)],
        hullTrigger: level.rescue.hullTrigger,
        minTime: level.rescue.minTime,
        fallbackTime: level.rescue.fallbackTime,
        doomTime: level.rescue.doomTime,
        doomName: level.rescue.doomName,
      };
    }
    return;
  }

  if (state.mode !== "roguelike") {
    return;
  }
  const seed = state.sector.seed;
  if (seededRoll(seed, state.cycle, 1) < UNCHARTED_BULLETIN_CHANCE) {
    const bulletin = UNCHARTED_BULLETINS[Math.floor(seededRoll(seed, state.cycle, 2) * UNCHARTED_BULLETINS.length)];
    simulation.storyEvents = [{ id: "uncharted-bulletin", at: 8 + seededRoll(seed, state.cycle, 3) * 20, lines: bulletin }];
  }
  if (seededRoll(seed, state.cycle, 4) < UNCHARTED_RESCUE_CHANCE) {
    simulation.rescueArmed = {
      species: ALIEN_SPECIES[Math.floor(seededRoll(seed, state.cycle, 5) * ALIEN_SPECIES.length)],
      hullTrigger: 0.3,
      minTime: 10,
    };
  }
}

function lockDoomLance(state: RunState, name: string): void {
  const from = { x: GAME_WIDTH + 40, y: SHIP_CENTER.y - 40 };
  const length = Math.hypot(SHIP_CENTER.x - from.x, SHIP_CENTER.y - from.y);
  state.simulation.barrages.push({
    id: `doom-${state.simulation.elapsed.toFixed(2)}`,
    sourceId: "doom",
    name,
    fromX: from.x,
    fromY: from.y,
    toX: from.x + ((SHIP_CENTER.x - from.x) / length) * 1100,
    toY: from.y + ((SHIP_CENTER.y - from.y) / length) * 1100,
    width: DOOM_WIDTH,
    damage: state.ship.maxHull * 2 + state.ship.maxShield,
    warning: DOOM_WARNING,
    timer: DOOM_WARNING,
    noticed: [],
    evaders: [],
    doom: true,
  });
  state.simulation.announcement = { text: "INCOMING: CERTAIN DOOM", timer: 2.4 };
  state.simulation.commQueue.unshift({ speaker: "ship", text: `Warning: ${name} is charging, aimed at us. Recommend panicking.` });
  state.simulation.activeComm = undefined;
}

function queueLines(state: RunState, lines: DialogLine[]): void {
  state.simulation.commQueue.push(...lines);
}

export function triggerRescue(state: RunState, species: SpeakerId, danger: boolean): void {
  const simulation = state.simulation;
  simulation.rescue = { species, age: 0 };
  simulation.rescueArmed = undefined;
  simulation.pendingSpawns = [];
  simulation.barrages = simulation.barrages.filter((barrage) => barrage.firedAge !== undefined);
  for (const enemy of simulation.enemies) {
    if (isCapitalShip(enemy)) {
      enemy.hp = Math.max(1, enemy.hp - enemy.maxHp * RESCUE_CAPITAL_DAMAGE);
      enemy.shield = 0;
    } else {
      enemy.hp = 0;
    }
  }
  simulation.enemies = simulation.enemies.filter((enemy) => enemy.hp > 0);
  state.ship.hull = Math.min(state.ship.maxHull, state.ship.hull + state.ship.maxHull * RESCUE_HULL_REPAIR);
  if (!simulation.shieldsOffline) {
    state.ship.shield = state.ship.maxShield;
  }
  for (const fighter of simulation.fighters) {
    fighter.hp = fighter.maxHp;
  }
  simulation.announcement = { text: "GOOD NEIGHBORS ARRIVE", timer: 2.6 };
  const lines = RESCUE_LINES[species];
  queueLines(state, [...(danger ? lines.danger : lines.fine), ...lines.farewell]);
  const level = getCampaignLevel(state);
  for (const event of level?.events.filter((candidate) => candidate.afterRescue) ?? []) {
    queueLines(state, resolveLines(state, event));
  }
  addMessage(state, `${species.replace(/^\w/, (letter) => letter.toUpperCase())} swept the field and left without a word of thanks expected.`);
}

export function tickStory(state: RunState, dt: number): void {
  const simulation = state.simulation;
  const level = getCampaignLevel(state);
  const timed = [...(level?.events ?? []), ...simulation.storyEvents];
  for (const event of timed) {
    if (event.at === undefined || event.at > simulation.elapsed || simulation.storyFired.includes(event.id)) {
      continue;
    }
    simulation.storyFired.push(event.id);
    queueLines(state, resolveLines(state, event));
  }

  if (simulation.activeComm) {
    simulation.activeComm.timer -= dt;
    if (simulation.activeComm.timer <= 0) {
      simulation.activeComm = undefined;
    }
  }
  if (!simulation.activeComm && simulation.commQueue.length > 0) {
    const next = simulation.commQueue.shift()!;
    simulation.activeComm = { line: next, timer: COMM_BASE_TIME + next.text.length * COMM_TIME_PER_CHAR };
  }

  const armed = simulation.rescueArmed;
  if (armed?.doomTime !== undefined && armed.doomName && simulation.elapsed >= armed.doomTime && !simulation.storyFired.includes("doom")) {
    simulation.storyFired.push("doom");
    lockDoomLance(state, armed.doomName);
  }
  if (armed && simulation.elapsed >= armed.minTime) {
    const hero = simulation.fighters.find((fighter) => fighter.hero);
    const doom = simulation.barrages.find((barrage) => barrage.doom && barrage.firedAge === undefined);
    const danger =
      state.ship.hull / state.ship.maxHull <= armed.hullTrigger ||
      (hero !== undefined && hero.hp / hero.maxHp <= 0.35) ||
      (doom !== undefined && doom.timer <= DOOM_RESCUE_AT);
    if (danger || (armed.fallbackTime !== undefined && simulation.elapsed >= armed.fallbackTime)) {
      triggerRescue(state, armed.species, danger);
    }
  }

  if (simulation.rescue) {
    simulation.rescue.age += dt;
    if (simulation.rescue.age >= RESCUE_ANIMATION_TIME) {
      simulation.rescue = undefined;
    }
  }
}

export function recordCampaignClear(state: RunState): void {
  const level = getCampaignLevel(state);
  if (!level) {
    return;
  }
  state.campaign.highestLevelCleared = Math.max(state.campaign.highestLevelCleared, level.number);
  if (level.number >= CAMPAIGN_LENGTH) {
    state.campaign.roguelikeUnlocked = true;
  }
}

export function isCampaignFinale(state: RunState): boolean {
  return state.mode === "campaign" && state.cycle >= CAMPAIGN_LENGTH;
}
