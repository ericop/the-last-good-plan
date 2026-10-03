import { DOCTRINES } from "../data/doctrines";
import { ENEMY_SPAWN_POINT, LANE_YS, OBJECTIVE_POINT, SHIP_CENTER } from "../game/constants";
import type {
  BarrageState,
  BotInstance,
  EnemyInstance,
  EvadeOrder,
  FighterInstance,
  ModuleId,
  MvpSummary,
  StarResult,
  RewardSource,
  RunState,
  ShipSlot,
  ThreatWave,
} from "../types/gameTypes";
import { noteRecipeSuccess } from "./discovery";
import { createLaneEnemy, getCapitalShip, getLaneWaypoint, isCapitalShip, spawnWarship, tickCapitalShip } from "./encounters";
import { createFighter, getPortLoadout, PORT_FIRST_LAUNCH_DELAY } from "./hangar";
import {
  addMessage,
  addToPool,
  clamp,
  closestPointOnSegment,
  countAdjacentWithModule,
  distance,
  getBotDodge,
  getDoctrineArtifactBonus,
  getGlobalArtifactMultiplier,
  getRecipeById,
  getRecipeTagMultiplier,
  moveToward,
  pickRewardChoices,
  roundPool,
} from "./utils";
import { beginBossEncounter, getActiveBoss, getBossDamageProfile, handleBossDefeat, spawnBoss, tickBossEncounter } from "./bossManager";

const CANNON_CHARGE_TIME = 1.4;
const CANNON_RANGE = 300;
const IMPACT_LIFETIME = 0.4;
const EVADE_SPEED_MULTIPLIER = 2.2;
const LAUNCH_BOOST_SPEED_MULTIPLIER = 1.8;
const BARRAGE_FLASH_TIME = 0.35;
const BARRAGE_SHIP_RADIUS = 150;
const BOOSTER_PULSE_INTERVAL = 4;
const BOOSTER_PULSE_RADIUS = 210;
const BOOSTER_PUSH_DISTANCE = 80;
const KNOCKBACK_TIME = 0.35;
const ANNOUNCEMENT_TIME = 2.2;
const CALLOUT_LIFETIME = 1.2;
const QUICK_KILL_TIME = 20;

interface DamageSource {
  kind: "module" | "bot" | "fighter";
  attackerBot?: BotInstance;
  attackerFighter?: FighterInstance;
}

function getCargoCoreCount(slots: ShipSlot[]): number {
  return slots.filter((slot) => slot.moduleId === "cargo_core").length;
}

function isModuleTemporarilyDisabled(state: RunState, moduleId: ModuleId): boolean {
  return (
    state.simulation.bossEncounter.disabledModuleId === moduleId &&
    state.simulation.bossEncounter.disabledModuleTimer > 0
  );
}

function grantResources(state: RunState, resource: "solar" | "minerals" | "scrap", amount: number): void {
  state.resources[resource] += amount;
  state.simulation.cycleStats.gained[resource] += amount;
}

function getBotMultipliers(state: RunState, bot: BotInstance) {
  const commitment = 1 + state.commitmentBonus + getDoctrineArtifactBonus(state);
  const tag = getRecipeTagMultiplier(state, bot);
  return {
    mining: commitment * tag * getGlobalArtifactMultiplier(state, "miningMultiplier") * (1 + state.ship.upgrades.mining_array * 0.18),
    attack: commitment * tag * getGlobalArtifactMultiplier(state, "attackMultiplier") * (1 + state.ship.upgrades.defense_grid * 0.12),
    support: commitment * tag * getGlobalArtifactMultiplier(state, "supportMultiplier") * (1 + state.ship.upgrades.support_bay * 0.16),
    defense: getGlobalArtifactMultiplier(state, "defenseMultiplier") * (1 + state.ship.upgrades.defense_grid * 0.12),
  };
}

function damageShip(state: RunState, amount: number): void {
  const absorbed = Math.min(state.ship.shield, amount);
  state.ship.shield -= absorbed;
  const hullDamage = Math.max(0, amount - absorbed);
  state.ship.hull = Math.max(0, state.ship.hull - hullDamage);
  state.simulation.cycleStats.lost.hullDamage += hullDamage;
}

// Missiles punch through half of the shield, so pure shield stacking cannot fully ignore a ship duel.
function damageShipWithMissile(state: RunState, amount: number): void {
  const absorbed = Math.min(state.ship.shield, amount * 0.5);
  state.ship.shield -= absorbed;
  const hullDamage = amount - absorbed;
  state.ship.hull = Math.max(0, state.ship.hull - hullDamage);
  state.simulation.cycleStats.lost.hullDamage += hullDamage;
}

function addImpact(state: RunState, x: number, y: number, size: number, color: number): void {
  state.simulation.impacts.push({ x, y, age: 0, size, color });
}

function healShip(state: RunState, amount: number): void {
  if (state.ship.shield < state.ship.maxShield) {
    state.ship.shield = Math.min(state.ship.maxShield, state.ship.shield + amount * 1.4);
  } else {
    state.ship.hull = Math.min(state.ship.maxHull, state.ship.hull + amount * 0.5);
  }
}

function removeDeadBots(state: RunState): void {
  const before = state.ship.bots.length;
  state.simulation.fallenBots.push(...state.ship.bots.filter((bot) => bot.hp <= 0));
  state.ship.bots = state.ship.bots.filter((bot) => bot.hp > 0);
  state.simulation.cycleStats.lost.botsDestroyed += before - state.ship.bots.length;
  state.simulation.fighters = state.simulation.fighters.filter((fighter) => fighter.hp > 0);
}

function offerReward(state: RunState, source: RewardSource): boolean {
  const choices = pickRewardChoices(state, source === "boss_chest" ? "boss_chest" : source);
  if (choices.length === 0) {
    addMessage(state, "No new artifact patterns remain in the vault.");
    return false;
  }
  state.simulation.chests.push({
    source,
    title: source === "moon" ? "Ancient Artifact" : "Recovered Chest",
    description:
      source === "moon"
        ? "Recovered from the exhausted moon seam. Choose one artifact for the run."
        : "Recovered from the broken mini-boss. Choose one relic for the run.",
    choices: choices.map((choice) => ({ kind: "artifact", id: choice.id })),
  });
  addMessage(state, "Chest recovered. It opens at the debrief.");
  return true;
}

function announce(state: RunState, text: string): void {
  state.simulation.announcement = { text, timer: ANNOUNCEMENT_TIME };
}

function addCallout(state: RunState, text: string, x: number, y: number, color: number): void {
  state.simulation.callouts.push({ text, x, y, age: 0, color });
}

const KILLFEED_LENGTH = 6;

function describeKiller(source: DamageSource): { name: string; color: number } {
  if (source.attackerBot) {
    return { name: source.attackerBot.name, color: source.attackerBot.color };
  }
  if (source.attackerFighter) {
    const kind = source.attackerFighter.kind;
    return { name: `${kind[0].toUpperCase()}${kind.slice(1)} wing`, color: source.attackerFighter.color };
  }
  return { name: "Pulse Cannon", color: 0xffc38a };
}

function destroyEnemy(state: RunState, enemy: EnemyInstance, source: DamageSource): boolean {
  const killer = describeKiller(source);
  state.simulation.killfeed = [
    { killer: killer.name, victim: enemy.name, color: killer.color, time: state.simulation.elapsed },
    ...state.simulation.killfeed,
  ].slice(0, KILLFEED_LENGTH);
  const salvageMultiplier =
    getGlobalArtifactMultiplier(state, "salvageMultiplier") * (1 + getCargoCoreCount(state.ship.slots) * 0.06);
  const scrapGain = enemy.scrapReward * salvageMultiplier * state.simulation.scrapMultiplier;
  grantResources(state, "scrap", scrapGain);

  addImpact(state, enemy.x, enemy.y, isCapitalShip(enemy) ? 70 : 22, enemy.color);

  if (enemy.kind === "warship" && !state.simulation.warshipDefeated) {
    state.simulation.warshipDefeated = true;
    const bounty = 14 + state.cycle * 3;
    grantResources(state, "minerals", bounty);
    state.simulation.duration = Math.min(state.simulation.duration, state.simulation.elapsed + 4);
    state.simulation.pendingSpawns = [];
    const quickKill = enemy.spawnedAt !== undefined && state.simulation.elapsed - enemy.spawnedAt < QUICK_KILL_TIME;
    announce(state, quickKill ? "WARSHIP DOWN · UNDER 20s" : "WARSHIP DOWN");
    addMessage(state, `${enemy.name} breaks apart. +${bounty} minerals salvaged. Jumping out in 4s.`);
    return true;
  }

  if (enemy.kind === "boss" && !state.simulation.bossDefeated) {
    state.simulation.bossDefeated = true;
    return handleBossDefeat(state, enemy);
  }

  if (enemy.kind === "mini_boss" && !state.simulation.bossDefeated) {
    state.simulation.bossDefeated = true;
    if (state.simulation.objective.integrity > 0) {
      state.simulation.duration += 10;
      addMessage(state, "Mini-boss broken. Ancient chest recovered. Harvest window extended by 10s.");
    } else {
      addMessage(state, "Mini-boss broken. Ancient chest recovered.");
    }
    offerReward(state, "boss_chest");
    return true;
  }
  return false;
}

function damageEnemy(state: RunState, enemy: EnemyInstance, amount: number, source: DamageSource): boolean {
  if (enemy.hp <= 0) {
    return false;
  }
  let damage = amount;
  if (enemy.kind === "boss") {
    const profile = getBossDamageProfile(enemy, source.attackerBot);
    damage *= profile.multiplier;

    if (profile.reflectRatio > 0) {
      const reflected = damage * profile.reflectRatio;
      if (source.attackerBot) {
        source.attackerBot.hp = Math.max(0, source.attackerBot.hp - reflected);
      } else if (source.attackerFighter) {
        source.attackerFighter.hp = Math.max(0, source.attackerFighter.hp - reflected);
      } else {
        damageShip(state, reflected * 0.55);
      }
    }
  }

  if ((enemy.shield ?? 0) > 0) {
    const absorbed = Math.min(enemy.shield ?? 0, damage);
    enemy.shield = Math.max(0, (enemy.shield ?? 0) - absorbed);
    damage -= absorbed;
  }

  enemy.hp -= damage;
  if (enemy.hp <= 0) {
    enemy.hp = 0;
    return destroyEnemy(state, enemy, source);
  }
  return false;
}

function spawnWave(state: RunState, wave: ThreatWave): void {
  if (wave.kind === "boss") {
    const boss = spawnBoss(state.cycle);
    state.simulation.enemies.push(boss);
    beginBossEncounter(state, boss);
    addMessage(state, `${wave.label} entering the screen.`);
    return;
  }

  if (wave.kind === "warship") {
    const warship = spawnWarship(state.cycle, wave.warshipId);
    warship.spawnedAt = state.simulation.elapsed;
    state.simulation.enemies.push(warship);
    addMessage(state, `${wave.label} is powering weapons.`);
    return;
  }

  const spacing = wave.spacing ?? 0.6;
  const lanes = state.simulation.lanes;
  for (let index = 0; index < wave.count; index += 1) {
    state.simulation.pendingSpawns.push({
      time: state.simulation.elapsed + index * spacing,
      kind: wave.kind,
      lane: wave.kind === "mini_boss" ? 1 : lanes[(index + state.simulation.threatCursor) % lanes.length],
    });
  }
  addMessage(state, `${wave.label} entering the lanes.`);
}

function spawnPendingEnemies(state: RunState): void {
  const due = state.simulation.pendingSpawns.filter((spawn) => spawn.time <= state.simulation.elapsed);
  if (due.length === 0) {
    return;
  }
  state.simulation.pendingSpawns = state.simulation.pendingSpawns.filter((spawn) => spawn.time > state.simulation.elapsed);
  for (const spawn of due) {
    const jitter = ((spawn.time * 37) % 1) * 28 - 14;
    state.simulation.enemies.push(createLaneEnemy(spawn.kind, state.cycle, ENEMY_SPAWN_POINT.x + 30, LANE_YS[spawn.lane] + jitter));
  }
}

function pickCannonTarget(state: RunState): EnemyInstance | undefined {
  const inRange = state.simulation.enemies
    .filter((enemy) => enemy.hp > 0 && distance(enemy, SHIP_CENTER) < CANNON_RANGE)
    .sort((left, right) => distance(left, SHIP_CENTER) - distance(right, SHIP_CENTER))[0];
  return inRange ?? getCapitalShip(state);
}

function firePlayerBolt(state: RunState, slot: ShipSlot, target: EnemyInstance, damage: number): void {
  state.simulation.projectiles.push({
    id: `bolt_${slot.id}_${state.simulation.elapsed.toFixed(2)}`,
    owner: "player",
    kind: "bolt",
    x: slot.x,
    y: slot.y,
    targetId: target.id,
    targetX: target.x,
    targetY: target.y,
    speed: 520,
    damage,
    color: 0xffc38a,
  });
}

function tickBoosterPulse(state: RunState, slot: ShipSlot, dt: number): void {
  const charge = Math.min(BOOSTER_PULSE_INTERVAL, (state.simulation.moduleTimers[slot.id] ?? 0) + dt);
  state.simulation.moduleTimers[slot.id] = charge;
  const pushable = state.simulation.enemies.filter(
    (enemy) => enemy.hp > 0 && !isCapitalShip(enemy) && distance(enemy, SHIP_CENTER) < BOOSTER_PULSE_RADIUS,
  );
  if (charge < BOOSTER_PULSE_INTERVAL || pushable.length === 0) {
    return;
  }
  state.simulation.moduleTimers[slot.id] = 0;
  for (const enemy of pushable) {
    const away = Math.hypot(enemy.x - SHIP_CENTER.x, enemy.y - SHIP_CENTER.y) || 1;
    const falloff = 1 - (away / BOOSTER_PULSE_RADIUS) * 0.5;
    const push = BOOSTER_PUSH_DISTANCE * falloff * (enemy.kind === "mini_boss" ? 0.4 : 1);
    enemy.knockback = {
      vx: ((enemy.x - SHIP_CENTER.x) / away) * (push / KNOCKBACK_TIME),
      vy: ((enemy.y - SHIP_CENTER.y) / away) * (push / KNOCKBACK_TIME),
      timer: KNOCKBACK_TIME,
    };
  }
  addImpact(state, SHIP_CENTER.x, SHIP_CENTER.y, BOOSTER_PULSE_RADIUS * 0.8, 0xf2a6ff);
}

function tickLaunchPort(state: RunState, slot: ShipSlot, dt: number): void {
  if (state.ship.upgrades.hangar_tech < 1) {
    return;
  }
  const timers = state.simulation.moduleTimers;
  const remaining = (timers[slot.id] ?? PORT_FIRST_LAUNCH_DELAY) - dt;
  timers[slot.id] = Math.max(0, remaining);
  if (remaining > 0) {
    return;
  }
  const loadout = getPortLoadout(state, slot);
  const wingSize = state.simulation.fighters.filter((fighter) => fighter.portSlotId === slot.id).length;
  if (wingSize >= loadout.capacity) {
    return;
  }
  state.simulation.fighters.push(createFighter(state, slot, loadout));
  timers[slot.id] = loadout.interval;
}

function applyPassiveModules(state: RunState, dt: number): void {
  const solarArtifact = getGlobalArtifactMultiplier(state, "solarModuleMultiplier");
  const miningArtifact = getGlobalArtifactMultiplier(state, "miningMultiplier");
  const supportArtifact = getGlobalArtifactMultiplier(state, "supportMultiplier");
  const attackArtifact = getGlobalArtifactMultiplier(state, "attackMultiplier");

  for (const slot of state.ship.slots) {
    if (!slot.moduleId || isModuleTemporarilyDisabled(state, slot.moduleId)) {
      continue;
    }
    const cargoAdj = countAdjacentWithModule(state.ship.slots, slot, "cargo_core");
    const repairAdj = countAdjacentWithModule(state.ship.slots, slot, "repair_node");

    switch (slot.moduleId) {
      case "solar_collector": {
        const gain = 1.8 * dt * solarArtifact * (1 + cargoAdj * 0.15);
        grantResources(state, "solar", gain);
        break;
      }
      case "mineral_drill": {
        if (state.simulation.objective.integrity <= 0) {
          break;
        }
        const mine = 1.15 * dt * miningArtifact * (1 + state.ship.upgrades.mining_array * 0.18) * (1 + cargoAdj * 0.15);
        state.simulation.objective.integrity = Math.max(0, state.simulation.objective.integrity - mine);
        grantResources(state, "minerals", mine * 1.4);
        break;
      }
      case "shield_emitter": {
        const shieldGain = 2.6 * dt * (1 + state.ship.upgrades.defense_grid * 0.14) * (1 + repairAdj * 0.08);
        state.ship.shield = Math.min(state.ship.maxShield, state.ship.shield + shieldGain);
        break;
      }
      case "pulse_cannon": {
        const charge = Math.min(CANNON_CHARGE_TIME, (state.simulation.moduleTimers[slot.id] ?? 0) + dt);
        state.simulation.moduleTimers[slot.id] = charge;
        const target = charge >= CANNON_CHARGE_TIME ? pickCannonTarget(state) : undefined;
        if (!target) {
          break;
        }
        state.simulation.moduleTimers[slot.id] = 0;
        const damage =
          5.2 * CANNON_CHARGE_TIME * attackArtifact * (1 + state.ship.upgrades.defense_grid * 0.14) * (1 + cargoAdj * 0.05);
        firePlayerBolt(state, slot, target, damage);
        break;
      }
      case "launch_port":
        tickLaunchPort(state, slot, dt);
        break;
      case "booster":
        tickBoosterPulse(state, slot, dt);
        break;
      case "repair_node": {
        const heal = 2.4 * dt * supportArtifact * (1 + state.ship.upgrades.support_bay * 0.16);
        const damagedBot = state.ship.bots
          .filter((bot) => bot.hp < bot.maxHp)
          .sort((left, right) => left.hp / left.maxHp - right.hp / right.maxHp)[0];
        if (damagedBot) {
          damagedBot.hp = Math.min(damagedBot.maxHp, damagedBot.hp + heal);
          damagedBot.contribution.healing += heal;
        } else {
          healShip(state, heal);
        }
        break;
      }
      case "cargo_core":
        break;
      default:
        break;
    }
  }
}

function chooseEnemyTarget(state: RunState, bot: BotInstance): EnemyInstance | undefined {
  if (bot.tags.includes("boss_breaker")) {
    const boss = getActiveBoss(state);
    if (boss) {
      return boss;
    }
  }

  const sorted = [...state.simulation.enemies].sort((left, right) => {
    if (state.doctrine === "preservation_mode") {
      return distance(left, SHIP_CENTER) - distance(right, SHIP_CENTER);
    }
    if (state.doctrine === "extraction_focus") {
      return distance(left, OBJECTIVE_POINT) - distance(right, OBJECTIVE_POINT);
    }
    return distance(left, bot) - distance(right, bot);
  });
  return sorted[0];
}

function followEvade(unit: { x: number; y: number; evade?: EvadeOrder }, speed: number, dt: number): boolean {
  if (!unit.evade) {
    return false;
  }
  unit.evade.timer -= dt;
  if (unit.evade.timer <= 0) {
    unit.evade = undefined;
    return false;
  }
  moveToward(unit, unit.evade, speed * EVADE_SPEED_MULTIPLIER, dt);
  return true;
}

function applyBotBehavior(state: RunState, bot: BotInstance, dt: number): void {
  bot.targetId = undefined;
  if (followEvade(bot, bot.speed, dt)) {
    return;
  }
  const doctrine = DOCTRINES[state.doctrine];
  const multipliers = getBotMultipliers(state, bot);
  const enemiesNearShip = state.simulation.enemies.filter((enemy) => distance(enemy, SHIP_CENTER) < 180).length;
  const supportNeed =
    state.ship.bots.filter((candidate) => candidate.hp / candidate.maxHp < 0.75).length +
    (state.ship.hull / state.ship.maxHull < 0.85 ? 1 : 0);
  const objectiveActive = state.simulation.objective.integrity > 0 ? 1 : 0;
  let mineScore = bot.mining * multipliers.mining * doctrine.weights.mining * objectiveActive;
  let attackScore = bot.attack * multipliers.attack * doctrine.weights.attack * (state.simulation.enemies.length > 0 ? 1 + enemiesNearShip * 0.1 : 0);
  let supportScore = bot.support * multipliers.support * doctrine.weights.support * (supportNeed > 0 ? 1 + supportNeed * 0.15 : 0.1);

  if (bot.role === "mining") {
    mineScore *= 1.15;
  }
  if (bot.role === "defense") {
    attackScore *= 1.18;
  }
  if (bot.role === "support") {
    supportScore *= 1.2;
  }
  if (state.doctrine === "extraction_focus") {
    mineScore *= 1.1;
  }
  if (state.doctrine === "preservation_mode" && bot.hp / bot.maxHp < 0.45) {
    supportScore *= 1.5;
    mineScore *= 0.25;
    attackScore *= 0.65;
  }

  if (mineScore >= attackScore && mineScore >= supportScore && objectiveActive) {
    moveToward(bot, OBJECTIVE_POINT, bot.speed * (0.85 + state.commitmentBonus * 0.4), dt);
    if (distance(bot, OBJECTIVE_POINT) <= 64) {
      const mineAmount = bot.mining * multipliers.mining * dt;
      state.simulation.objective.integrity = Math.max(0, state.simulation.objective.integrity - mineAmount);
      grantResources(state, "minerals", mineAmount * 1.2);
      bot.contribution.mined += mineAmount;
      if (bot.tags.includes("solar_bleed")) {
        grantResources(state, "solar", 0.45 * dt);
      }
    }
    return;
  }

  if (supportScore >= attackScore) {
    const ally = state.ship.bots
      .filter((candidate) => candidate.id !== bot.id && candidate.hp < candidate.maxHp)
      .sort((left, right) => left.hp / left.maxHp - right.hp / right.maxHp)[0];
    if (ally) {
      moveToward(bot, ally, bot.speed * 0.95, dt);
      if (distance(bot, ally) <= 70) {
        const healAmount = bot.support * multipliers.support * dt;
        ally.hp = Math.min(ally.maxHp, ally.hp + healAmount);
        bot.contribution.healing += healAmount;
        if (bot.tags.includes("shield_aura")) {
          state.ship.shield = Math.min(state.ship.maxShield, state.ship.shield + healAmount * 0.35);
        }
      }
    } else {
      moveToward(bot, SHIP_CENTER, bot.speed * 0.9, dt);
      if (distance(bot, SHIP_CENTER) <= 80) {
        const healAmount = bot.support * multipliers.support * dt;
        healShip(state, healAmount);
        bot.contribution.healing += healAmount;
        if (bot.tags.includes("shield_aura")) {
          state.ship.shield = Math.min(state.ship.maxShield, state.ship.shield + healAmount * 0.45);
        }
      }
    }
    return;
  }

  const target = chooseEnemyTarget(state, bot);
  if (!target) {
    moveToward(bot, SHIP_CENTER, bot.speed * 0.7, dt);
    return;
  }
  if (distance(bot, target) > bot.range * 0.8) {
    moveToward(bot, target, bot.speed * (0.9 + state.commitmentBonus * 0.35), dt);
  }
  if (distance(bot, target) <= bot.range) {
    const damage = bot.attack * multipliers.attack * dt;
    bot.targetId = target.id;
    damageEnemy(state, target, damage, { kind: "bot", attackerBot: bot });
    bot.contribution.damage += damage;
  }
}

function updateFighterHeading(fighter: FighterInstance, startX: number, startY: number): void {
  if (Math.hypot(fighter.x - startX, fighter.y - startY) > 0.01) {
    fighter.heading = Math.atan2(fighter.y - startY, fighter.x - startX);
  }
}

function applyFighterBehavior(state: RunState, fighter: FighterInstance, dt: number): void {
  const startX = fighter.x;
  const startY = fighter.y;
  fighter.targetId = undefined;
  const speed = fighter.speed * (fighter.launchBoost > 0 ? LAUNCH_BOOST_SPEED_MULTIPLIER : 1);
  fighter.launchBoost = Math.max(0, fighter.launchBoost - dt);
  if (followEvade(fighter, fighter.speed, dt)) {
    updateFighterHeading(fighter, startX, startY);
    return;
  }
  const moonActive = state.simulation.objective.integrity > 0;
  const shipDamaged = state.ship.hull < state.ship.maxHull || state.ship.shield < state.ship.maxShield;
  const woundedBot = state.ship.bots
    .filter((bot) => bot.hp < bot.maxHp)
    .sort((left, right) => left.hp / left.maxHp - right.hp / right.maxHp)[0];

  if (fighter.kind === "skiff" && moonActive) {
    const berth = { x: OBJECTIVE_POINT.x + Math.cos(fighter.orbit) * 40, y: OBJECTIVE_POINT.y + Math.sin(fighter.orbit) * 40 };
    moveToward(fighter, berth, speed, dt);
    if (distance(fighter, OBJECTIVE_POINT) <= 64) {
      const mined = fighter.mining * dt * getGlobalArtifactMultiplier(state, "miningMultiplier");
      state.simulation.objective.integrity = Math.max(0, state.simulation.objective.integrity - mined);
      grantResources(state, "minerals", mined * 1.2);
    }
  } else if (fighter.kind === "tender" && (woundedBot || shipDamaged)) {
    const patient = woundedBot ?? SHIP_CENTER;
    moveToward(fighter, patient, speed, dt);
    if (distance(fighter, patient) <= (woundedBot ? fighter.range : 90)) {
      const heal = fighter.support * dt * getGlobalArtifactMultiplier(state, "supportMultiplier");
      if (woundedBot) {
        woundedBot.hp = Math.min(woundedBot.maxHp, woundedBot.hp + heal);
      } else {
        healShip(state, heal);
      }
    }
  } else {
    const nearShip = state.simulation.enemies
      .filter((enemy) => enemy.hp > 0 && distance(enemy, SHIP_CENTER) < CANNON_RANGE)
      .sort((left, right) => distance(left, fighter) - distance(right, fighter))[0];
    // Swarm wings screen the ship like towers; only duels and boss fights send them out on strike runs.
    const strikeTarget =
      state.simulation.encounter === "swarm"
        ? undefined
        : state.simulation.enemies
            .filter((enemy) => enemy.hp > 0)
            .sort((left, right) => distance(left, fighter) - distance(right, fighter))[0];
    const target = nearShip ?? strikeTarget;
    if (target) {
      if (distance(fighter, target) > fighter.range * 0.7) {
        moveToward(fighter, target, speed, dt);
      }
      if (distance(fighter, target) <= fighter.range) {
        fighter.targetId = target.id;
        damageEnemy(state, target, fighter.attack * dt, { kind: "fighter", attackerFighter: fighter });
      }
    } else {
      fighter.orbit += dt * 0.7;
      moveToward(
        fighter,
        { x: SHIP_CENTER.x + Math.cos(fighter.orbit) * 195, y: SHIP_CENTER.y + Math.sin(fighter.orbit) * 195 },
        speed,
        dt,
      );
    }
  }

  updateFighterHeading(fighter, startX, startY);
}

function isInBarrage(barrage: BarrageState, unit: { x: number; y: number }, margin: number): boolean {
  const closest = closestPointOnSegment(unit, { x: barrage.fromX, y: barrage.fromY }, { x: barrage.toX, y: barrage.toY });
  return distance(unit, closest) <= barrage.width / 2 + margin;
}

function planEvade(barrage: BarrageState, unit: { x: number; y: number }): EvadeOrder {
  const closest = closestPointOnSegment(unit, { x: barrage.fromX, y: barrage.fromY }, { x: barrage.toX, y: barrage.toY });
  let normalX = unit.x - closest.x;
  let normalY = unit.y - closest.y;
  const offset = Math.hypot(normalX, normalY);
  if (offset < 1) {
    const length = Math.hypot(barrage.toX - barrage.fromX, barrage.toY - barrage.fromY) || 1;
    const side = Math.random() < 0.5 ? 1 : -1;
    normalX = (-(barrage.toY - barrage.fromY) / length) * side;
    normalY = ((barrage.toX - barrage.fromX) / length) * side;
  } else {
    normalX /= offset;
    normalY /= offset;
  }
  const clearance = barrage.width / 2 + 36;
  return {
    x: clamp(closest.x + normalX * clearance, 30, 930),
    y: clamp(closest.y + normalY * clearance, 60, 580),
    timer: barrage.timer + 0.3,
  };
}

function fireBarrage(state: RunState, barrage: BarrageState): void {
  let hits = 0;
  for (const bot of state.ship.bots) {
    if (bot.hp > 0 && isInBarrage(barrage, bot, 10)) {
      bot.hp = Math.max(0, bot.hp - barrage.damage / getBotMultipliers(state, bot).defense);
      hits += 1;
    }
  }
  for (const fighter of state.simulation.fighters) {
    if (fighter.hp > 0 && isInBarrage(barrage, fighter, 10)) {
      fighter.hp = Math.max(0, fighter.hp - barrage.damage);
      hits += 1;
    }
  }
  const nearestToShip = closestPointOnSegment(SHIP_CENTER, { x: barrage.fromX, y: barrage.fromY }, { x: barrage.toX, y: barrage.toY });
  if (distance(SHIP_CENTER, nearestToShip) <= BARRAGE_SHIP_RADIUS) {
    damageShip(state, barrage.damage * 0.6);
    addImpact(state, nearestToShip.x, nearestToShip.y, 40, 0xff2850);
  }
  for (const unit of [...state.ship.bots, ...state.simulation.fighters]) {
    if (unit.hp > 0 && barrage.evaders.includes(unit.id) && !isInBarrage(barrage, unit, 10)) {
      state.simulation.dodgesByUnit[unit.id] = (state.simulation.dodgesByUnit[unit.id] ?? 0) + 1;
      addCallout(state, "PERFECT DODGE!", unit.x, unit.y - 22, 0xf2a6ff);
    }
  }
  const dodged = barrage.noticed.length - hits;
  if (barrage.noticed.length > 0) {
    addMessage(state, `${barrage.name} fired: ${Math.max(0, dodged)} dodged, ${hits} hit.`);
  }
}

function tickBarrages(state: RunState, dt: number): boolean {
  let fired = false;
  const units: Array<BotInstance | FighterInstance> = [...state.ship.bots, ...state.simulation.fighters];
  state.simulation.barrages = state.simulation.barrages.filter((barrage) => {
    if (barrage.firedAge !== undefined) {
      barrage.firedAge += dt;
      return barrage.firedAge < BARRAGE_FLASH_TIME;
    }
    if (!state.simulation.enemies.some((enemy) => enemy.id === barrage.sourceId && enemy.hp > 0)) {
      return false;
    }

    for (const unit of units) {
      if (unit.hp <= 0 || barrage.noticed.includes(unit.id) || !isInBarrage(barrage, unit, 18)) {
        continue;
      }
      barrage.noticed.push(unit.id);
      const dodge = "recipeId" in unit ? getBotDodge(unit) : unit.dodge;
      if (Math.random() < dodge) {
        unit.evade = planEvade(barrage, unit);
        barrage.evaders.push(unit.id);
      }
    }

    barrage.timer -= dt;
    if (barrage.timer <= 0) {
      fireBarrage(state, barrage);
      barrage.firedAge = 0;
      fired = true;
    }
    return true;
  });
  return fired;
}

function applyEnemyBehavior(state: RunState, dt: number): void {
  const fighters = state.simulation.fighters;
  for (const enemy of [...state.simulation.enemies]) {
    if (enemy.hp <= 0) {
      continue;
    }

    if (enemy.knockback) {
      enemy.x += enemy.knockback.vx * dt;
      enemy.y += enemy.knockback.vy * dt;
      enemy.knockback.timer -= dt;
      if (enemy.knockback.timer <= 0) {
        enemy.knockback = undefined;
      }
      continue;
    }

    if (isCapitalShip(enemy)) {
      for (const event of tickCapitalShip(state, enemy, dt, [...state.ship.bots, ...fighters])) {
        addMessage(state, event);
      }
      continue;
    }

    const targetBot = state.ship.bots
      .filter((bot) => distance(bot, enemy) < 120)
      .sort((left, right) => distance(left, enemy) - distance(right, enemy))[0];
    const targetFighter = fighters
      .filter((fighter) => fighter.hp > 0 && distance(fighter, enemy) < 120)
      .sort((left, right) => distance(left, enemy) - distance(right, enemy))[0];
    const engageFighter = targetFighter && (!targetBot || distance(targetFighter, enemy) < distance(targetBot, enemy));

    if (engageFighter) {
      moveToward(enemy, targetFighter, enemy.speed, dt);
      if (distance(enemy, targetFighter) <= enemy.range) {
        targetFighter.hp = Math.max(0, targetFighter.hp - enemy.attack * dt);
      }
      continue;
    }

    if (targetBot) {
      moveToward(enemy, targetBot, enemy.speed, dt);
      if (distance(enemy, targetBot) <= enemy.range) {
        const botMultipliers = getBotMultipliers(state, targetBot);
        const damage = enemy.attack * dt / botMultipliers.defense;
        targetBot.hp = Math.max(0, targetBot.hp - damage);
      }
      continue;
    }

    moveToward(enemy, getLaneWaypoint(enemy), enemy.speed, dt);
    if (distance(enemy, SHIP_CENTER) <= enemy.range) {
      damageShip(state, enemy.attack * dt);
    }
  }
}

function stepProjectiles(state: RunState, dt: number): boolean {
  let majorUpdate = false;
  const inFlight = [];
  for (const projectile of state.simulation.projectiles) {
    const target =
      projectile.owner === "player"
        ? state.simulation.enemies.find((enemy) => enemy.id === projectile.targetId && enemy.hp > 0)
        : undefined;
    if (target) {
      projectile.targetX = target.x;
      projectile.targetY = target.y;
    }
    const aim = { x: projectile.targetX, y: projectile.targetY };
    if (distance(projectile, aim) > projectile.speed * dt) {
      moveToward(projectile, aim, projectile.speed, dt);
      inFlight.push(projectile);
      continue;
    }

    addImpact(state, aim.x, aim.y, projectile.kind === "missile" ? 26 : 14, projectile.color);
    if (projectile.owner === "player") {
      if (target) {
        majorUpdate = damageEnemy(state, target, projectile.damage, { kind: "module" }) || majorUpdate;
      }
    } else if (projectile.kind === "missile") {
      damageShipWithMissile(state, projectile.damage);
    } else {
      damageShip(state, projectile.damage);
    }
  }
  state.simulation.projectiles = inFlight;
  return majorUpdate;
}

function ageAnnouncements(state: RunState, dt: number): void {
  for (const callout of state.simulation.callouts) {
    callout.age += dt;
    callout.y -= 18 * dt;
  }
  state.simulation.callouts = state.simulation.callouts.filter((callout) => callout.age < CALLOUT_LIFETIME);
  if (state.simulation.announcement) {
    state.simulation.announcement.timer -= dt;
    if (state.simulation.announcement.timer <= 0) {
      state.simulation.announcement = undefined;
    }
  }
}

function ageImpacts(state: RunState, dt: number): void {
  for (const impact of state.simulation.impacts) {
    impact.age += dt;
  }
  state.simulation.impacts = state.simulation.impacts.filter((impact) => impact.age < IMPACT_LIFETIME);
}

function cleanDeadEnemies(state: RunState): boolean {
  const before = state.simulation.enemies.length;
  state.simulation.enemies = state.simulation.enemies.filter((enemy) => enemy.hp > 0);
  return before !== state.simulation.enemies.length;
}

function maybeTriggerObjectiveReward(state: RunState): boolean {
  if (state.simulation.objective.integrity <= 0 && !state.simulation.objective.rewardClaimed) {
    state.simulation.objective.rewardClaimed = true;
    state.simulation.moonRewardTriggered = true;
    addMessage(state, "Moon seam exhausted. Ancient artifact exposed.");
    return offerReward(state, "moon");
  }
  return false;
}

function scoreStars(state: RunState, survived: boolean): StarResult[] {
  const simulation = state.simulation;
  const objective =
    simulation.encounter === "duel"
      ? { label: "Warship destroyed", met: simulation.warshipDefeated }
      : simulation.encounter === "boss"
        ? { label: "Boss destroyed", met: simulation.bossDefeated }
        : { label: "Moon fully mined", met: simulation.objective.integrity <= 0 };
  return [
    { label: "Survived", earned: survived },
    { label: objective.label, earned: survived && objective.met },
    { label: "No bots lost", earned: survived && simulation.cycleStats.lost.botsDestroyed === 0 },
  ];
}

function pickMvp(state: RunState): MvpSummary | undefined {
  const scored = [...state.ship.bots, ...state.simulation.fallenBots]
    .map((bot) => {
      const dodges = state.simulation.dodgesByUnit[bot.id] ?? 0;
      const { damage, mined, healing } = bot.contribution;
      return { bot, dodges, score: damage + mined * 1.5 + healing * 1.2 + dodges * 15 };
    })
    .sort((left, right) => right.score - left.score)[0];
  if (!scored || scored.score <= 0) {
    return undefined;
  }
  return {
    name: scored.bot.name,
    role: scored.bot.role,
    color: scored.bot.color,
    damage: Math.round(scored.bot.contribution.damage),
    mined: Math.round(scored.bot.contribution.mined),
    healing: Math.round(scored.bot.contribution.healing),
    dodges: scored.dodges,
  };
}

function getDebriefText(state: RunState): string {
  if (state.simulation.encounter === "duel") {
    return state.simulation.warshipDefeated
      ? "You out-traded the warship and stripped its wreck. Review what the duel cost and what to try next."
      : "The warship slipped away before it broke. More firepower or a bigger wing would finish it next time.";
  }
  if (state.simulation.encounter === "boss") {
    return "The ship weathered a boss engagement. Review what held and what nearly gave way.";
  }
  return "Your ship held the lanes. Review what the mission earned, what the doctrine bought you, and what to try next.";
}

function finalizeCycle(state: RunState): void {
  const perfectReward = state.doctrineChangesThisCycle === 0 ? { solar: 8, minerals: 0, scrap: 8 } : { solar: 0, minerals: 0, scrap: 0 };
  if (state.doctrineChangesThisCycle === 0 && !state.simulation.perfectCommitmentRewardGranted) {
    addToPool(state.resources, perfectReward);
    addToPool(state.simulation.cycleStats.gained, perfectReward);
    state.meta.totalPerfectCommitments += 1;
    state.simulation.perfectCommitmentRewardGranted = true;
    addMessage(state, "Perfect commitment held. Reserve bonus issued.");
  }

  for (const bot of state.ship.bots) {
    const performance = bot.contribution.mined + bot.contribution.damage * 0.35 + bot.contribution.healing * 0.3 + bot.contribution.salvage * 0.6;
    if (bot.hp > 0 && performance >= 8) {
      const entryBefore = state.discovery[bot.recipeId].state;
      noteRecipeSuccess(state.discovery, bot.recipeId);
      if (entryBefore !== state.discovery[bot.recipeId].state && state.discovery[bot.recipeId].state === "known_mastered_lite") {
        const recipe = getRecipeById(bot.recipeId);
        if (recipe) {
          state.simulation.cycleStats.discoveries.push(`${recipe.resultName} mastered`);
        }
      }
    }
  }

  state.meta.totalCyclesCompleted += 1;
  const survived = state.ship.hull > 0;
  const stars = scoreStars(state, survived);
  state.meta.totalStars = (state.meta.totalStars ?? 0) + stars.filter((star) => star.earned).length;
  if (survived && state.simulation.encounter === "duel" && !state.simulation.warshipDefeated) {
    addMessage(state, "The warship disengaged before it broke.");
  }
  state.summary = {
    title: survived ? `Mission ${state.cycle} complete – ${state.simulation.encounterName}` : "The plan failed",
    text: survived ? getDebriefText(state) : "Hull collapse ended the run. The debrief below should still tell you what almost worked.",
    gains: roundPool(state.simulation.cycleStats.gained),
    losses: state.simulation.cycleStats.lost,
    discoveries: [...state.simulation.cycleStats.discoveries],
    rewards: [...state.simulation.cycleStats.rewardsEarned],
    perfectCommitmentReward: perfectReward,
    stars,
    mvp: pickMvp(state),
  };
  state.phase = state.ship.hull > 0 ? "results" : "run_over";
  state.paused = false;
}

export function stepSimulation(state: RunState, dt: number): boolean {
  if (state.phase !== "execution" || state.paused || state.pendingReward) {
    return false;
  }

  if (state.simulation.launchCountdown > 0) {
    state.simulation.launchCountdown = Math.max(0, state.simulation.launchCountdown - dt);
    return true;
  }

  let majorUpdate = false;
  state.simulation.elapsed = Math.min(state.simulation.duration, state.simulation.elapsed + dt);
  if (state.simulation.shieldsOffline) {
    state.ship.shield = 0;
  }
  ageAnnouncements(state, dt);

  while (
    state.simulation.threatCursor < state.simulation.upcomingThreats.length &&
    state.simulation.elapsed >= state.simulation.upcomingThreats[state.simulation.threatCursor].time
  ) {
    const wave = state.simulation.upcomingThreats[state.simulation.threatCursor];
    spawnWave(state, wave);
    if (wave.announce) {
      announce(state, wave.announce);
    }
    state.simulation.threatCursor += 1;
    majorUpdate = true;
  }
  spawnPendingEnemies(state);
  ageImpacts(state, dt);
  if (tickBarrages(state, dt)) {
    majorUpdate = true;
  }

  tickBossEncounter(state, dt);
  if (state.simulation.bossEncounter.introTimer > 0) {
    return true;
  }

  applyPassiveModules(state, dt);
  for (const bot of state.ship.bots) {
    applyBotBehavior(state, bot, dt);
  }
  for (const fighter of state.simulation.fighters) {
    applyFighterBehavior(state, fighter, dt);
  }
  applyEnemyBehavior(state, dt);
  if (stepProjectiles(state, dt)) {
    majorUpdate = true;
  }
  removeDeadBots(state);
  if (cleanDeadEnemies(state)) {
    majorUpdate = true;
  }
  if (maybeTriggerObjectiveReward(state)) {
    majorUpdate = true;
  }

  if (state.ship.hull <= 0) {
    finalizeCycle(state);
    return true;
  }

  if (state.simulation.elapsed >= state.simulation.duration && !state.pendingReward) {
    finalizeCycle(state);
    return true;
  }

  return majorUpdate;
}