import { MODULE_DEFINITIONS } from "../data/modules";
import { UPGRADE_DEFINITIONS } from "../data/upgrades";
import type { GameCommand } from "../types/commands";
import type { BotInstance, RunState, SaveData } from "../types/gameTypes";
import { createRunState, prepareExecutionState, resetForNextCycle } from "./createRunState";
import { getMergePreviewFromModules, noteRecipeUse } from "./discovery";
import {
  addMessage,
  canAfford,
  getArtifactById,
  getBotCapacity,
  getRecipeById,
  getSlotById,
  isAdjacent,
  makeBotId,
  subtractFromPool,
} from "./utils";

function recalculateShipStats(state: RunState): void {
  const defenseLevel = state.ship.upgrades.defense_grid;
  state.ship.maxHull = 120 + defenseLevel * 10;
  state.ship.maxShield = 44 + defenseLevel * 14;
  state.ship.hull = Math.min(state.ship.maxHull, state.ship.hull + 8);
  state.ship.shield = Math.min(state.ship.maxShield, state.ship.shield + 12);
}

function createBotFromRecipe(recipeId: string, index: number): BotInstance {
  const recipe = getRecipeById(recipeId);
  if (!recipe) {
    throw new Error(`Missing recipe ${recipeId}`);
  }
  return {
    id: makeBotId(),
    recipeId: recipe.id,
    name: recipe.resultName,
    role: recipe.role,
    color: recipe.color,
    tags: [...recipe.tags],
    hp: recipe.stats.hp,
    maxHp: recipe.stats.hp,
    x: 350 + (index % 4) * 20,
    y: 260 + Math.floor(index / 4) * 26,
    speed: recipe.stats.speed,
    mining: recipe.stats.mining,
    attack: recipe.stats.attack,
    support: recipe.stats.support,
    range: recipe.stats.range,
    salvage: recipe.stats.salvage,
    cooldown: 0,
    contribution: {
      mined: 0,
      damage: 0,
      healing: 0,
      salvage: 0,
    },
  };
}

export function processCommand(state: RunState, command: GameCommand, saveData: SaveData): RunState {
  switch (command.type) {
    case "start_new_run": {
      return createRunState(saveData, "planning");
    }
    case "return_to_menu": {
      return createRunState(saveData, "menu");
    }
    case "toggle_pause": {
      if (state.phase === "execution") {
        state.paused = !state.paused;
        addMessage(state, state.paused ? "Cycle paused instantly." : "Cycle resumed.");
      }
      return state;
    }
    case "set_doctrine": {
      if (state.doctrine === command.doctrineId) {
        return state;
      }
      state.doctrine = command.doctrineId;
      if (state.phase === "execution") {
        state.doctrineChangesThisCycle += 1;
        state.commitmentBonus = Math.max(0, state.commitmentBonus - 0.1);
        addMessage(
          state,
          `Doctrine changed to ${command.doctrineId.replace(/_/g, " ")}. Commitment now +${Math.round(
            state.commitmentBonus * 100,
          )}%`,
        );
      } else {
        addMessage(state, `Starting doctrine set to ${command.doctrineId.replace(/_/g, " ")}.`);
      }
      return state;
    }
    case "select_fabrication_module": {
      if (state.phase !== "planning") {
        return state;
      }
      state.ui.selectedFabricationModuleId =
        state.ui.selectedFabricationModuleId === command.moduleId ? undefined : command.moduleId;
      return state;
    }
    case "board_slot_pressed": {
      if (state.phase !== "planning") {
        return state;
      }
      const slot = getSlotById(state.ship.slots, command.slotId);
      if (!slot) {
        return state;
      }
      const selectedModuleId = state.ui.selectedFabricationModuleId;
      if (selectedModuleId && !slot.moduleId) {
        const cost = MODULE_DEFINITIONS[selectedModuleId].fabricationCost;
        if (!canAfford(state.resources, cost)) {
          addMessage(state, "Insufficient resources for that module.");
          return state;
        }
        subtractFromPool(state.resources, cost);
        slot.moduleId = selectedModuleId;
        addMessage(state, `${MODULE_DEFINITIONS[selectedModuleId].name} fabricated into ${slot.label}.`);
        return state;
      }

      if (!slot.moduleId) {
        state.ui.selectedSlotIds = [];
        return state;
      }

      if (state.ui.selectedSlotIds.includes(slot.id)) {
        state.ui.selectedSlotIds = state.ui.selectedSlotIds.filter((slotId) => slotId !== slot.id);
      } else {
        state.ui.selectedSlotIds = [...state.ui.selectedSlotIds, slot.id].slice(-2);
      }
      return state;
    }
    case "merge_selected": {
      if (state.phase !== "planning" || state.ui.selectedSlotIds.length !== 2) {
        return state;
      }
      const [slotAId, slotBId] = state.ui.selectedSlotIds;
      const slotA = getSlotById(state.ship.slots, slotAId);
      const slotB = getSlotById(state.ship.slots, slotBId);
      if (!slotA?.moduleId || !slotB?.moduleId) {
        return state;
      }
      if (!isAdjacent(state.ship.slots, slotAId, slotBId)) {
        addMessage(state, "Modules must be in adjacent slots to merge.");
        return state;
      }
      if (state.ship.bots.length >= getBotCapacity(state)) {
        addMessage(state, "Support Bay limit reached. Upgrade support capacity or lose a bot first.");
        return state;
      }
      const preview = getMergePreviewFromModules([slotA.moduleId, slotB.moduleId], state.discovery);
      if (!preview.recipe) {
        addMessage(state, preview.text);
        return state;
      }
      const entryBefore = state.discovery[preview.recipe.id].state;
      noteRecipeUse(state.discovery, preview.recipe.id);
      if (entryBefore === "unknown") {
        state.simulation.cycleStats.discoveries.push(preview.recipe.resultName);
      }
      const bot = createBotFromRecipe(preview.recipe.id, state.ship.bots.length);
      slotA.moduleId = undefined;
      slotB.moduleId = undefined;
      state.ship.bots.push(bot);
      state.ui.selectedSlotIds = [];
      addMessage(state, `${preview.recipe.resultName} assembled. The merge is permanent.`);
      return state;
    }
    case "spend_upgrade": {
      if (state.phase !== "planning") {
        return state;
      }
      const level = state.ship.upgrades[command.upgradeId];
      const definition = UPGRADE_DEFINITIONS[command.upgradeId];
      const cost = definition.costs[level];
      if (!cost) {
        addMessage(state, `${definition.name} is already at maximum level.`);
        return state;
      }
      if (!canAfford(state.resources, cost)) {
        addMessage(state, `Insufficient resources for ${definition.name}.`);
        return state;
      }
      subtractFromPool(state.resources, cost);
      state.ship.upgrades[command.upgradeId] += 1;
      recalculateShipStats(state);
      addMessage(state, `${definition.name} upgraded to tier ${state.ship.upgrades[command.upgradeId]}.`);
      return state;
    }
    case "begin_execution": {
      if (state.phase !== "planning") {
        return state;
      }
      const hasSystems = state.ship.slots.some((slot) => slot.moduleId) || state.ship.bots.length > 0;
      if (!hasSystems) {
        addMessage(state, "Install or merge at least one active system before running the cycle.");
        return state;
      }
      prepareExecutionState(state);
      return state;
    }
    case "toggle_discovery_log": {
      state.ui.showDiscoveryLog = !state.ui.showDiscoveryLog;
      return state;
    }
    case "choose_reward": {
      if (!state.pendingReward) {
        return state;
      }
      if (state.ship.artifacts.includes(command.artifactId)) {
        state.pendingReward = undefined;
        state.paused = false;
        return state;
      }
      const artifact = getArtifactById(command.artifactId);
      if (!artifact) {
        return state;
      }
      state.ship.artifacts.push(artifact.id);
      state.simulation.cycleStats.rewardsEarned.push(artifact.name);
      state.meta.totalArtifactsRecovered += 1;
      state.pendingReward = undefined;
      if (state.phase === "execution") {
        state.paused = false;
      }
      recalculateShipStats(state);
      addMessage(state, `${artifact.name} installed.`);
      return state;
    }
    case "continue_from_results": {
      if (state.phase === "results") {
        resetForNextCycle(state);
      }
      return state;
    }
    default:
      return state;
  }
}

