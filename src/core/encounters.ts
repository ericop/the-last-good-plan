import { ENEMY_DEFINITIONS } from "../data/enemies";
import { WARSHIP_DEFINITIONS } from "../data/warships";
import { createDuelSchedule, createThreatSchedule } from "../data/waves";
import { ENEMY_SPAWN_POINT, SHIP_CENTER, WARSHIP_HOLD_POINT } from "../game/constants";
import type {
  EncounterKind,
  EnemyInstance,
  EnemyKind,
  Projectile,
  RunState,
  ShipWeaponDefinition,
  RouteId,
  ThreatWave,
  WarshipDefinition,
} from "../types/gameTypes";
import { getBossForCycle, isBossCycle } from "./bossManager";
import { createWeaponStates, distance, makeEnemyId, moveToward } from "./utils";

const DUEL_CYCLE_INTERVAL = 3;
const SHIP_APPROACH_SPEED = 60;
const LANE_TURN_X = 470;

export function getEncounterKind(cycle: number): EncounterKind {
  if (isBossCycle(cycle)) {
    return "boss";
  }
  return cycle % DUEL_CYCLE_INTERVAL === 0 ? "duel" : "swarm";
}

export function getWarshipForCycle(cycle: number): WarshipDefinition {
  const duelIndex = Math.max(0, Math.floor(cycle / DUEL_CYCLE_INTERVAL) - 1);
  return WARSHIP_DEFINITIONS[duelIndex % WARSHIP_DEFINITIONS.length];
}

export interface RouteDefinition {
  encounter: EncounterKind;
  blurb: string;
  tip: string;
}

export const ROUTES: Record<RouteId, RouteDefinition> = {
  swarm: {
    encounter: "swarm",
    blurb: "Hold three lanes against a stream of small raiders.",
    tip: "Cannons and Booster pulses hold the lanes.",
  },
  duel: {
    encounter: "duel",
    blurb: "Trade fire with a parked warship that charges a lance.",
    tip: "Boosters dodge lances. Shields soak lasers.",
  },
  boss: {
    encounter: "boss",
    blurb: "A capital-class boss with its own weapons and tricks.",
    tip: "Long fight. Bring repairs and steady damage.",
  },
  nebula: {
    encounter: "swarm",
    blurb: "Shields are offline in the ion haze. Every wreck pays double scrap.",
    tip: "Repair Nodes matter more than shields here.",
  },
  derelict: {
    encounter: "swarm",
    blurb: "A lighter fight around a drifting hulk. +20 solar and +30 minerals on arrival.",
    tip: "A safe mission to rebuild your fleet.",
  },
};

export const DERELICT_SUPPLIES = { solar: 20, minerals: 30, scrap: 0 };

export function getDefaultRoute(cycle: number): RouteId {
  return getEncounterKind(cycle);
}

export function getEncounterName(cycle: number, route: RouteId = getDefaultRoute(cycle)): string {
  switch (route) {
    case "boss":
      return `Boss: ${getBossForCycle(cycle).name}`;
    case "duel":
      return `Ship Duel: ${getWarshipForCycle(cycle).name}`;
    case "nebula":
      return "Nebula Run";
    case "derelict":
      return "Derelict Salvage";
    default:
      return "Swarm Defense";
  }
}

export function createCycleThreatSchedule(cycle: number, route: RouteId = getDefaultRoute(cycle)): ThreatWave[] {
  switch (route) {
    case "boss": {
      const boss = getBossForCycle(cycle);
      const supportCount = 2 + Math.floor(cycle / 20);
      return [
        { time: 6, label: `Boss screen x${supportCount}`, kind: "scavenger", count: supportCount, spacing: 0.9 },
        { time: 14, label: `Boss arrival: ${boss.name}`, kind: "boss", count: 1, bossId: boss.id },
        { time: 28, label: `Escort reinforcements x${supportCount + 1}`, kind: "scavenger", count: supportCount + 1, spacing: 0.9 },
        { time: 50, label: `Last guard x${supportCount + 1}`, kind: "scavenger", count: supportCount + 1, spacing: 0.9 },
      ];
    }
    case "duel": {
      const warship = getWarshipForCycle(cycle);
      return createDuelSchedule(cycle, warship.id, warship.name);
    }
    case "derelict":
      return createThreatSchedule(cycle).slice(0, 3);
    default:
      return createThreatSchedule(cycle);
  }
}

export function getCycleDuration(cycle: number, route: RouteId = getDefaultRoute(cycle)): number {
  switch (route) {
    case "boss":
      return 90;
    case "duel":
      return 80;
    case "derelict":
      return 50;
    default:
      return 80;
  }
}

function getEnemyScaling(kind: EnemyKind, cycle: number): { hp: number; attack: number; scrap: number } {
  switch (kind) {
    case "dart":
      return { hp: Math.round(cycle * 1.5), attack: Math.round(cycle * 0.5), scrap: Math.floor(cycle / 2) };
    case "brute":
      return { hp: cycle * 12, attack: cycle, scrap: cycle * 2 };
    case "mini_boss":
      return { hp: cycle * 18, attack: cycle, scrap: cycle * 4 };
    default:
      return { hp: cycle * 3, attack: cycle, scrap: cycle };
  }
}

export function createLaneEnemy(kind: EnemyKind, cycle: number, x: number, y: number): EnemyInstance {
  const definition = ENEMY_DEFINITIONS[kind];
  const scaling = getEnemyScaling(kind, cycle);
  return {
    id: makeEnemyId(),
    kind: definition.kind,
    name: definition.name,
    color: definition.color,
    hp: definition.hp + scaling.hp,
    maxHp: definition.hp + scaling.hp,
    x,
    y,
    speed: definition.speed,
    attack: definition.attack + scaling.attack,
    range: definition.range,
    scrapReward: definition.scrapReward + scaling.scrap,
    cooldown: 0,
  };
}

export function spawnWarship(cycle: number, warshipId?: string): EnemyInstance {
  const definition = WARSHIP_DEFINITIONS.find((warship) => warship.id === warshipId) ?? getWarshipForCycle(cycle);
  const scale = 1 + Math.max(0, cycle - DUEL_CYCLE_INTERVAL) * 0.12;
  const hull = Math.round(definition.hull * scale);
  const shield = Math.round(definition.shield * scale);
  return {
    id: makeEnemyId(),
    kind: "warship",
    name: definition.name,
    color: definition.color,
    hp: hull,
    maxHp: hull,
    x: ENEMY_SPAWN_POINT.x + 60,
    y: WARSHIP_HOLD_POINT.y,
    speed: SHIP_APPROACH_SPEED,
    attack: Math.round(definition.pointDefense * scale),
    range: definition.pointDefenseRange,
    scrapReward: 40 + cycle * 3,
    cooldown: 0,
    shield,
    maxShield: shield,
    shieldRegen: definition.shieldRegen * scale,
    holdX: WARSHIP_HOLD_POINT.x,
    weapons: createWeaponStates(definition.weapons, 1 + Math.max(0, cycle - DUEL_CYCLE_INTERVAL) * 0.08),
    launch: definition.launch ? { ...definition.launch, timer: definition.launch.interval * 0.6 } : undefined,
    warshipId: definition.id,
  };
}

export function isCapitalShip(enemy: EnemyInstance): boolean {
  return enemy.holdX !== undefined;
}

export function getCapitalShip(state: RunState): EnemyInstance | undefined {
  return state.simulation.enemies.find((enemy) => isCapitalShip(enemy) && enemy.hp > 0);
}

export function getLaneWaypoint(enemy: EnemyInstance): { x: number; y: number } {
  return enemy.x > LANE_TURN_X ? { x: LANE_TURN_X, y: enemy.y } : SHIP_CENTER;
}

const BEAM_LENGTH = 900;
const BEAM_EMITTER_OFFSET = 58;

const ESCORT_TARGET_CHANCE = 0.5;

function pickBarrageAim(state: RunState, enemy: EnemyInstance): { x: number; y: number } {
  const escort = state.simulation.fighters.find((fighter) => fighter.hero && fighter.hp > 0);
  if (escort && Math.random() < ESCORT_TARGET_CHANCE) {
    return { x: escort.x, y: escort.y };
  }
  const units = [...state.ship.bots, ...state.simulation.fighters].filter(
    (unit) => unit.hp > 0 && distance(unit, enemy) > BEAM_EMITTER_OFFSET + 12,
  );
  const cluster = units
    .map((unit) => ({ unit, crowd: units.filter((other) => distance(other, unit) < 70).length }))
    .sort((left, right) => right.crowd - left.crowd || distance(left.unit, enemy) - distance(right.unit, enemy))[0];
  return cluster ? { x: cluster.unit.x, y: cluster.unit.y } : SHIP_CENTER;
}

function lockBarrage(state: RunState, enemy: EnemyInstance, weapon: ShipWeaponDefinition): void {
  const aim = pickBarrageAim(state, enemy);
  const reach = Math.hypot(aim.x - enemy.x, aim.y - enemy.y) || 1;
  const from = {
    x: enemy.x + ((aim.x - enemy.x) / reach) * BEAM_EMITTER_OFFSET,
    y: enemy.y + ((aim.y - enemy.y) / reach) * BEAM_EMITTER_OFFSET,
  };
  const length = Math.hypot(aim.x - from.x, aim.y - from.y) || 1;
  const warning = weapon.warning ?? 2;
  state.simulation.barrages.push({
    id: `${enemy.id}_${weapon.name}_${state.simulation.elapsed.toFixed(2)}`,
    sourceId: enemy.id,
    name: weapon.name,
    fromX: from.x,
    fromY: from.y,
    toX: from.x + ((aim.x - from.x) / length) * BEAM_LENGTH,
    toY: from.y + ((aim.y - from.y) / length) * BEAM_LENGTH,
    width: weapon.width ?? 56,
    damage: weapon.damage,
    warning,
    timer: warning,
    noticed: [],
    evaders: [],
  });
}

function fireVolley(state: RunState, enemy: EnemyInstance, weapon: ShipWeaponDefinition): void {
  if (weapon.kind === "beam") {
    lockBarrage(state, enemy, weapon);
    return;
  }
  for (let shot = 0; shot < weapon.shots; shot += 1) {
    const projectile: Projectile = {
      id: `${enemy.id}_${weapon.name}_${state.simulation.elapsed.toFixed(2)}_${shot}`,
      owner: "enemy",
      kind: weapon.kind,
      x: enemy.x - 40 - shot * 14,
      y: enemy.y + (shot % 2 === 0 ? -8 : 8),
      targetX: SHIP_CENTER.x + (Math.random() - 0.5) * 90,
      targetY: SHIP_CENTER.y + (Math.random() - 0.5) * 90,
      speed: weapon.kind === "missile" ? 170 : 280,
      damage: weapon.damage,
      color: weapon.kind === "missile" ? 0xffa45c : 0xff5e6c,
    };
    state.simulation.projectiles.push(projectile);
  }
}

export function tickCapitalShip(
  state: RunState,
  enemy: EnemyInstance,
  dt: number,
  pointDefenseTargets: Array<{ x: number; y: number; hp: number }>,
): string[] {
  const events: string[] = [];
  if (enemy.x > (enemy.holdX ?? enemy.x) + 0.5) {
    moveToward(enemy, { x: enemy.holdX!, y: enemy.y }, SHIP_APPROACH_SPEED, dt);
    return events;
  }

  if (enemy.shieldRegen && enemy.maxShield) {
    enemy.shield = Math.min(enemy.maxShield, (enemy.shield ?? 0) + enemy.shieldRegen * dt);
  }

  for (const weapon of enemy.weapons ?? []) {
    weapon.charge += dt;
    if (weapon.charge >= weapon.chargeTime) {
      weapon.charge = 0;
      fireVolley(state, enemy, weapon);
      if (weapon.kind === "beam") {
        events.push(`${enemy.name} is charging its ${weapon.name}. Nimble units may slip out of the line.`);
      }
    }
  }

  if (enemy.launch) {
    enemy.launch.timer -= dt;
    if (enemy.launch.timer <= 0) {
      enemy.launch.timer = enemy.launch.interval;
      for (let index = 0; index < enemy.launch.count; index += 1) {
        state.simulation.enemies.push(createLaneEnemy("dart", state.cycle, enemy.x - 30, enemy.y - 40 + index * 40));
      }
      events.push(`${enemy.name} launches ${enemy.launch.count} darts.`);
    }
  }

  const target = pointDefenseTargets
    .filter((unit) => unit.hp > 0 && distance(unit, enemy) <= enemy.range)
    .sort((left, right) => distance(left, enemy) - distance(right, enemy))[0];
  if (target) {
    target.hp = Math.max(0, target.hp - enemy.attack * dt);
  }
  return events;
}
