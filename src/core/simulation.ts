import { DOCTRINES } from "../data/doctrines";
import { ENEMY_DEFINITIONS } from "../data/enemies";
import { MODULE_DEFINITIONS } from "../data/modules";
import { OBJECTIVE_POINT, SHIP_CENTER, ENEMY_SPAWN_POINT } from "../game/constants";
import type { BotInstance, EnemyInstance, ModuleId, RewardSource, RunState, ShipSlot, ThreatWave } from "../types/gameTypes";
import { noteRecipeSuccess } from "./discovery";
import {
  addMessage,
  addToPool,
  clamp,
  countAdjacentWithModule,
  distance,
  getArtifactById,
  getDoctrineArtifactBonus,
  getGlobalArtifactMultiplier,
  getRecipeById,
  getRecipeTagMultiplier,
  makeEnemyId,
  moveToward,
  pickRewardChoices,
  roundPool,
} from "./utils";

function getCargoCoreCount(slots: ShipSlot[]): number {
  return slots.filter((slot) => slot.moduleId === "cargo_core").length;
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

function healShip(state: RunState, amount: number): void {
  if (state.ship.shield < state.ship.maxShield) {
    state.ship.shield = Math.min(state.ship.maxShield, state.ship.shield + amount * 1.4);
  } else {
    state.ship.hull = Math.min(state.ship.maxHull, state.ship.hull + amount * 0.5);
  }
}

function removeDeadBots(state: RunState): void {
  const before = state.ship.bots.length;
  state.ship.bots = state.ship.bots.filter((bot) => bot.hp > 0);
  state.simulation.cycleStats.lost.botsDestroyed += before - state.ship.bots.length;
}

function offerReward(state: RunState, source: RewardSource): boolean {
  const choices = pickRewardChoices(state, source);
  if (choices.length === 0) {
    addMessage(state, "No new artifact patterns remain in the vault.");
    return false;
  }
  state.pendingReward = {
    source,
    choices: choices.map((choice) => choice.id),
  };
  state.paused = true;
  return true;
}

function destroyEnemy(state: RunState, enemy: EnemyInstance): boolean {
  const salvageMultiplier =
    getGlobalArtifactMultiplier(state, "salvageMultiplier") * (1 + getCargoCoreCount(state.ship.slots) * 0.06);
  const scrapGain = enemy.scrapReward * salvageMultiplier;
  grantResources(state, "scrap", scrapGain);

  if (enemy.kind === "mini_boss" && !state.simulation.bossDefeated) {
    state.simulation.bossDefeated = true;
    if (state.simulation.objective.integrity > 0) {
      state.simulation.duration += 10;
      addMessage(state, "Mini-boss broken. Ancient chest recovered. Harvest window extended by 10s.");
    } else {
      addMessage(state, "Mini-boss broken. Ancient chest recovered.");
    }
    offerReward(state, "boss");
    return true;
  }
  return false;
}

function damageEnemy(state: RunState, enemy: EnemyInstance, amount: number): boolean {
  enemy.hp -= amount;
  if (enemy.hp <= 0) {
    enemy.hp = 0;
    return destroyEnemy(state, enemy);
  }
  return false;
}

function spawnWave(state: RunState, wave: ThreatWave): void {
  const definition = ENEMY_DEFINITIONS[wave.kind];
  for (let index = 0; index < wave.count; index += 1) {
    state.simulation.enemies.push({
      id: makeEnemyId(),
      kind: definition.kind,
      name: definition.name,
      color: definition.color,
      hp: definition.hp + (wave.kind === "scavenger" ? state.cycle * 3 : state.cycle * 18),
      maxHp: definition.hp + (wave.kind === "scavenger" ? state.cycle * 3 : state.cycle * 18),
      x: ENEMY_SPAWN_POINT.x + index * 18,
      y: 170 + ((index * 54 + state.cycle * 20) % 300),
      speed: definition.speed,
      attack: definition.attack + state.cycle,
      range: definition.range,
      scrapReward: definition.scrapReward + (wave.kind === "mini_boss" ? state.cycle * 4 : state.cycle),
      cooldown: 0,
    });
  }
  addMessage(state, `${wave.label} entering the screen.`);
}

function applyPassiveModules(state: RunState, dt: number): void {
  const solarArtifact = getGlobalArtifactMultiplier(state, "solarModuleMultiplier");
  const miningArtifact = getGlobalArtifactMultiplier(state, "miningMultiplier");
  const supportArtifact = getGlobalArtifactMultiplier(state, "supportMultiplier");
  const attackArtifact = getGlobalArtifactMultiplier(state, "attackMultiplier");

  for (const slot of state.ship.slots) {
    if (!slot.moduleId) {
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
        const target = state.simulation.enemies
          .filter((enemy) => distance(enemy, SHIP_CENTER) < 220)
          .sort((left, right) => distance(left, SHIP_CENTER) - distance(right, SHIP_CENTER))[0];
        if (!target) {
          break;
        }
        const damage = 5.2 * dt * attackArtifact * (1 + state.ship.upgrades.defense_grid * 0.14) * (1 + cargoAdj * 0.05);
        damageEnemy(state, target, damage);
        break;
      }
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

function applyBotBehavior(state: RunState, bot: BotInstance, dt: number): void {
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
      }
    } else {
      moveToward(bot, SHIP_CENTER, bot.speed * 0.9, dt);
      if (distance(bot, SHIP_CENTER) <= 80) {
        const healAmount = bot.support * multipliers.support * dt;
        healShip(state, healAmount);
        bot.contribution.healing += healAmount;
      }
    }
    return;
  }

  const target = chooseEnemyTarget(state, bot);
  if (!target) {
    moveToward(bot, SHIP_CENTER, bot.speed * 0.7, dt);
    return;
  }
  moveToward(bot, target, bot.speed * (0.9 + state.commitmentBonus * 0.35), dt);
  if (distance(bot, target) <= bot.range) {
    const damage = bot.attack * multipliers.attack * dt;
    damageEnemy(state, target, damage);
    bot.contribution.damage += damage;
  }
}

function applyEnemyBehavior(state: RunState, dt: number): void {
  for (const enemy of state.simulation.enemies) {
    const targetBot = state.ship.bots
      .filter((bot) => distance(bot, enemy) < 120)
      .sort((left, right) => distance(left, enemy) - distance(right, enemy))[0];

    if (targetBot) {
      moveToward(enemy, targetBot, enemy.speed, dt);
      if (distance(enemy, targetBot) <= enemy.range) {
        const botMultipliers = getBotMultipliers(state, targetBot);
        const damage = enemy.attack * dt / botMultipliers.defense;
        targetBot.hp = Math.max(0, targetBot.hp - damage);
      }
      continue;
    }

    moveToward(enemy, SHIP_CENTER, enemy.speed, dt);
    if (distance(enemy, SHIP_CENTER) <= enemy.range) {
      damageShip(state, enemy.attack * dt);
    }
  }
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
  state.summary = {
    title: state.ship.hull > 0 ? `Mission ${state.cycle} complete` : "The plan failed",
    text:
      state.ship.hull > 0
        ? "Your ship held together. Review what the mission earned, what the doctrine bought you, and what to try next."
        : "Hull collapse ended the run. The debrief below should still tell you what almost worked.",
    gains: roundPool(state.simulation.cycleStats.gained),
    losses: state.simulation.cycleStats.lost,
    discoveries: [...state.simulation.cycleStats.discoveries],
    rewards: [...state.simulation.cycleStats.rewardsEarned],
    perfectCommitmentReward: perfectReward,
  };
  state.phase = state.ship.hull > 0 ? "results" : "run_over";
  state.paused = false;
}

export function stepSimulation(state: RunState, dt: number): boolean {
  if (state.phase !== "execution" || state.paused || state.pendingReward) {
    return false;
  }

  let majorUpdate = false;
  state.simulation.elapsed = Math.min(state.simulation.duration, state.simulation.elapsed + dt);

  while (
    state.simulation.threatCursor < state.simulation.upcomingThreats.length &&
    state.simulation.elapsed >= state.simulation.upcomingThreats[state.simulation.threatCursor].time
  ) {
    const wave = state.simulation.upcomingThreats[state.simulation.threatCursor];
    spawnWave(state, wave);
    state.simulation.threatCursor += 1;
    majorUpdate = true;
  }

  applyPassiveModules(state, dt);
  for (const bot of state.ship.bots) {
    applyBotBehavior(state, bot, dt);
  }
  applyEnemyBehavior(state, dt);
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





