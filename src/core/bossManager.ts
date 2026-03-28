import { BOSS_DEFINITIONS } from "../data/bosses";
import { ENEMY_DEFINITIONS } from "../data/enemies";
import { getEpicModuleById } from "../data/epicModuleRegistry";
import { ENEMY_SPAWN_POINT, SHIP_CENTER } from "../game/constants";
import type { BossBehavior, BossDefinition, BotInstance, EnemyInstance, RunState, ThreatWave } from "../types/gameTypes";
import { addMessage, distance, makeEnemyId } from "./utils";
import { createThreatSchedule } from "../data/waves";

const BOSS_CYCLE_INTERVAL = 10;
const BOSS_INTRO_DURATION = 1.5;

function getBossIndex(cycleNumber: number): number {
  return Math.max(0, Math.floor(cycleNumber / BOSS_CYCLE_INTERVAL) - 1);
}

function getBehaviorKey(kind: BossBehavior["kind"], index: number): string {
  return `${kind}_${index}`;
}

function applyShipPressure(state: RunState, amount: number): void {
  const absorbed = Math.min(state.ship.shield, amount);
  state.ship.shield -= absorbed;
  const hullDamage = Math.max(0, amount - absorbed);
  state.ship.hull = Math.max(0, state.ship.hull - hullDamage);
  state.simulation.cycleStats.lost.hullDamage += hullDamage;
}

export function isBossCycle(cycleNumber: number): boolean {
  return cycleNumber > 0 && cycleNumber % BOSS_CYCLE_INTERVAL === 0;
}

export function getBossForCycle(cycleNumber: number): BossDefinition {
  return BOSS_DEFINITIONS[getBossIndex(cycleNumber) % BOSS_DEFINITIONS.length];
}

export function createCycleThreatSchedule(cycleNumber: number): ThreatWave[] {
  if (!isBossCycle(cycleNumber)) {
    return createThreatSchedule(cycleNumber);
  }

  const boss = getBossForCycle(cycleNumber);
  const supportCount = 2 + Math.floor(cycleNumber / 20);
  return [
    {
      time: 6,
      label: `Boss screen x${supportCount}`,
      kind: "scavenger",
      count: supportCount,
    },
    {
      time: 14,
      label: `Boss arrival: ${boss.name}`,
      kind: "boss",
      count: 1,
      bossId: boss.id,
    },
    {
      time: 28,
      label: `Escort reinforcements x${supportCount + 1}`,
      kind: "scavenger",
      count: supportCount + 1,
    },
  ];
}

export function getCycleDuration(cycleNumber: number): number {
  return isBossCycle(cycleNumber) ? 58 : 46;
}

export function spawnBoss(cycleNumber: number): EnemyInstance {
  const definition = getBossForCycle(cycleNumber);
  const cycleScale = 1 + getBossIndex(cycleNumber) * 0.18;
  const behaviorTimers = Object.fromEntries(
    definition.behaviors.map((behavior, index) => [getBehaviorKey(behavior.kind, index), behavior.interval]),
  );
  for (const [index, modifier] of definition.modifiers.entries()) {
    if (modifier.kind === "disables_module_type") {
      behaviorTimers[`modifier_${index}`] = modifier.interval;
    }
  }

  return {
    id: makeEnemyId(),
    kind: "boss",
    name: definition.name,
    color: definition.color,
    hp: Math.round(definition.maxHp * cycleScale),
    maxHp: Math.round(definition.maxHp * cycleScale),
    x: ENEMY_SPAWN_POINT.x - 12,
    y: SHIP_CENTER.y,
    speed: definition.speed,
    attack: Math.round(definition.attack * cycleScale),
    range: definition.range,
    scrapReward: 42 + cycleNumber * 2,
    cooldown: 0,
    bossId: definition.id,
    bossShield: Math.round(definition.shield * cycleScale),
    maxBossShield: Math.round(definition.shield * cycleScale),
    bossBehaviorTimers: behaviorTimers,
  };
}

export function getActiveBoss(state: RunState): EnemyInstance | undefined {
  return state.simulation.enemies.find((enemy) => enemy.kind === "boss");
}

export function beginBossEncounter(state: RunState, boss: EnemyInstance): void {
  state.simulation.bossEncounter.activeBossId = boss.bossId;
  state.simulation.bossEncounter.activeBossName = boss.name;
  state.simulation.bossEncounter.rewardEpicId = getBossForCycle(state.cycle).reward;
  state.simulation.bossEncounter.introTimer = BOSS_INTRO_DURATION;
  state.simulation.bossEncounter.telegraph = "Signal lock acquired";
  state.simulation.bossEncounter.telegraphTimer = BOSS_INTRO_DURATION;
  addMessage(state, `${boss.name} has entered the battlespace.`);
}

export function getBossDamageProfile(enemy: EnemyInstance, sourceBot?: BotInstance): { multiplier: number; reflectRatio: number } {
  if (!enemy.bossId) {
    return { multiplier: 1, reflectRatio: 0 };
  }
  const boss = BOSS_DEFINITIONS.find((definition) => definition.id === enemy.bossId);
  if (!boss) {
    return { multiplier: 1, reflectRatio: 0 };
  }

  let multiplier = 1;
  let reflectRatio = 0;
  for (const modifier of boss.modifiers) {
    if (modifier.kind === "reduces_projectile_damage") {
      const sourceIgnoresDampening = sourceBot?.tags.includes("boss_breaker");
      if (!sourceIgnoresDampening) {
        multiplier *= modifier.multiplier;
      }
    }
    if (modifier.kind === "reflects_damage") {
      reflectRatio = modifier.ratio;
    }
  }

  return { multiplier, reflectRatio };
}

export function tickBossEncounter(state: RunState, dt: number): void {
  const encounter = state.simulation.bossEncounter;
  if (encounter.introTimer > 0) {
    encounter.introTimer = Math.max(0, encounter.introTimer - dt);
  }
  if (encounter.telegraphTimer > 0) {
    encounter.telegraphTimer = Math.max(0, encounter.telegraphTimer - dt);
    if (encounter.telegraphTimer <= 0) {
      encounter.telegraph = undefined;
    }
  }
  if (encounter.disabledModuleTimer > 0) {
    encounter.disabledModuleTimer = Math.max(0, encounter.disabledModuleTimer - dt);
    if (encounter.disabledModuleTimer <= 0) {
      addMessage(state, `${encounter.disabledModuleId?.replace(/_/g, " ")} back online.`);
      encounter.disabledModuleId = undefined;
    }
  }

  const bossEnemy = getActiveBoss(state);
  if (!bossEnemy || !bossEnemy.bossId || !bossEnemy.bossBehaviorTimers) {
    encounter.activeBossId = undefined;
    encounter.activeBossName = undefined;
    return;
  }

  if (encounter.introTimer > 0) {
    return;
  }

  const definition = BOSS_DEFINITIONS.find((boss) => boss.id === bossEnemy.bossId);
  if (!definition) {
    return;
  }

  for (const [index, behavior] of definition.behaviors.entries()) {
    const key = getBehaviorKey(behavior.kind, index);
    const chargeKey = `${key}_charge`;
    const chargeRemaining = bossEnemy.bossBehaviorTimers[chargeKey] ?? 0;
    if (chargeRemaining > 0) {
      bossEnemy.bossBehaviorTimers[chargeKey] = Math.max(0, chargeRemaining - dt);
      if (bossEnemy.bossBehaviorTimers[chargeKey] <= 0 && behavior.kind === "charging_attack") {
        deliverChargingAttack(state, definition, behavior.damage);
        bossEnemy.bossBehaviorTimers[key] = behavior.interval;
      }
      continue;
    }

    bossEnemy.bossBehaviorTimers[key] = (bossEnemy.bossBehaviorTimers[key] ?? behavior.interval) - dt;
    if (bossEnemy.bossBehaviorTimers[key] > 0) {
      continue;
    }

    triggerBossBehavior(state, bossEnemy, definition, behavior, key);
  }

  for (const [index, modifier] of definition.modifiers.entries()) {
    if (modifier.kind !== "disables_module_type") {
      continue;
    }
    const key = `modifier_${index}`;
    bossEnemy.bossBehaviorTimers[key] = (bossEnemy.bossBehaviorTimers[key] ?? modifier.interval) - dt;
    if (bossEnemy.bossBehaviorTimers[key] > 0) {
      continue;
    }

    state.simulation.bossEncounter.disabledModuleId = modifier.moduleId;
    state.simulation.bossEncounter.disabledModuleTimer = modifier.duration;
    state.simulation.bossEncounter.telegraph = `${modifier.moduleId.replace(/_/g, " ")} disrupted`;
    state.simulation.bossEncounter.telegraphTimer = 1.25;
    addMessage(state, `${definition.name} disrupts ${modifier.moduleId.replace(/_/g, " ")} for ${modifier.duration.toFixed(0)}s.`);
    bossEnemy.bossBehaviorTimers[key] = modifier.interval;
  }
}

function triggerBossBehavior(
  state: RunState,
  bossEnemy: EnemyInstance,
  definition: BossDefinition,
  behavior: BossBehavior,
  key: string,
): void {
  switch (behavior.kind) {
    case "periodic_shield":
      bossEnemy.bossShield = Math.min(bossEnemy.maxBossShield ?? 0, (bossEnemy.bossShield ?? 0) + behavior.amount);
      state.simulation.bossEncounter.telegraph = `${definition.name} restores shielding`;
      state.simulation.bossEncounter.telegraphTimer = 1;
      addMessage(state, `${definition.name} restores shielding.`);
      bossEnemy.bossBehaviorTimers![key] = behavior.interval;
      break;
    case "spawning_minions":
      spawnBossMinions(state, behavior.count);
      state.simulation.bossEncounter.telegraph = `${definition.name} unfolds escorts`;
      state.simulation.bossEncounter.telegraphTimer = 1;
      addMessage(state, `${definition.name} deploys escort drones.`);
      bossEnemy.bossBehaviorTimers![key] = behavior.interval;
      break;
    case "charging_attack":
      bossEnemy.bossBehaviorTimers![`${key}_charge`] = behavior.chargeTime;
      state.simulation.bossEncounter.telegraph = `${definition.name} charging`;
      state.simulation.bossEncounter.telegraphTimer = behavior.chargeTime;
      addMessage(state, `${definition.name} is charging a hull-breaking attack.`);
      break;
    case "directional_sweep":
      deliverSweepAttack(state, bossEnemy, behavior.damage, behavior.width);
      state.simulation.bossEncounter.telegraph = `${definition.name} sweeps the lane`;
      state.simulation.bossEncounter.telegraphTimer = 1;
      addMessage(state, `${definition.name} sweeps the whole approach.`);
      bossEnemy.bossBehaviorTimers![key] = behavior.interval;
      break;
    default:
      break;
  }
}

function spawnBossMinions(state: RunState, count: number): void {
  const definition = ENEMY_DEFINITIONS.scavenger;
  for (let index = 0; index < count; index += 1) {
    state.simulation.enemies.push({
      id: makeEnemyId(),
      kind: definition.kind,
      name: definition.name,
      color: definition.color,
      hp: definition.hp + state.cycle * 2,
      maxHp: definition.hp + state.cycle * 2,
      x: ENEMY_SPAWN_POINT.x - 30 + index * 24,
      y: 190 + index * 44,
      speed: definition.speed + 2,
      attack: definition.attack + Math.floor(state.cycle / 3),
      range: definition.range,
      scrapReward: definition.scrapReward + Math.floor(state.cycle / 2),
      cooldown: 0,
    });
  }
}

function deliverChargingAttack(state: RunState, definition: BossDefinition, damage: number): void {
  const nearbyBots = state.ship.bots.filter((bot) => distance(bot, SHIP_CENTER) < 120);
  for (const bot of nearbyBots) {
    bot.hp = Math.max(0, bot.hp - damage * 0.7);
  }
  applyShipPressure(state, damage);
  state.simulation.bossEncounter.telegraph = `${definition.name} impact`;
  state.simulation.bossEncounter.telegraphTimer = 0.9;
  addMessage(state, `${definition.name} slams the ship with a charged strike.`);
}

function deliverSweepAttack(state: RunState, bossEnemy: EnemyInstance, damage: number, width: number): void {
  const affectedBots = state.ship.bots.filter((bot) => Math.abs(bot.y - bossEnemy.y) <= width * 0.5 || distance(bot, bossEnemy) < 150);
  for (const bot of affectedBots) {
    bot.hp = Math.max(0, bot.hp - damage * 0.55);
  }
  applyShipPressure(state, damage * 0.8);
}

export function handleBossDefeat(state: RunState, enemy: EnemyInstance): boolean {
  if (enemy.kind !== "boss" || !enemy.bossId) {
    return false;
  }

  const definition = BOSS_DEFINITIONS.find((boss) => boss.id === enemy.bossId);
  if (!definition) {
    return false;
  }

  const epic = getEpicModuleById(definition.reward);
  state.simulation.bossEncounter.activeBossId = undefined;
  state.simulation.bossEncounter.activeBossName = undefined;
  state.simulation.bossEncounter.rewardEpicId = definition.reward;
  state.simulation.bossEncounter.telegraph = "Boss Defeated";
  state.simulation.bossEncounter.telegraphTimer = 1.4;
  state.pendingReward = {
    source: "boss",
    title: "Boss Defeated",
    description: `Install ${epic.name} into your fabrication pool. Epic Modules are single-use parts that permanently alter the bot they merge into.`,
    choices: [{ kind: "epic_module", id: definition.reward }],
  };
  state.paused = true;
  addMessage(state, `${definition.name} destroyed. ${epic.name} recovered.`);
  return true;
}