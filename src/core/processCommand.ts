import { applyEpicModifiers, getEpicModuleById, getFabricationBaseModuleId, grantEpicModule, isEpicModuleId } from "../data/epicModuleRegistry";
import { MODULE_DEFINITIONS } from "../data/modules";
import { UPGRADE_DEFINITIONS } from "../data/upgrades";
import type { GameCommand } from "../types/commands";
import type { BotInstance, ModuleId, RunState, SaveData, ShipSlot } from "../types/gameTypes";
import { createRunState, prepareExecutionState, resetForNextCycle } from "./createRunState";
import { getMergePreviewFromModules, noteRecipeUse } from "./discovery";
import { getMissionReadiness, skipTutorial } from "./tutorial";
import {
  addMessage,
  canAfford,
  getArtifactById,
  getBotCapacity,
  getBotStagingPosition,
  getRecipeById,
  getSlotById,
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

function createBotFromRecipe(recipeId: string, index: number, epicModuleIds: string[] = []): BotInstance {
  const recipe = getRecipeById(recipeId);
  if (!recipe) {
    throw new Error(`Missing recipe ${recipeId}`);
  }
  const position = getBotStagingPosition(index);
  const bot: BotInstance = {
    id: makeBotId(),
    recipeId: recipe.id,
    name: recipe.resultName,
    role: recipe.role,
    color: recipe.color,
    tags: [...recipe.tags],
    hp: recipe.stats.hp,
    maxHp: recipe.stats.hp,
    x: position.x,
    y: position.y,
    speed: recipe.stats.speed,
    mining: recipe.stats.mining,
    attack: recipe.stats.attack,
    support: recipe.stats.support,
    range: recipe.stats.range,
    salvage: recipe.stats.salvage,
    epicModules: [],
    cooldown: 0,
    contribution: {
      mined: 0,
      damage: 0,
      healing: 0,
      salvage: 0,
    },
  };
  applyEpicModifiers(bot, epicModuleIds.filter((value): value is BotInstance["epicModules"][number] => isEpicModuleId(value)));
  return bot;
}

function getSelectedMergeSlots(state: RunState): ShipSlot[] | undefined {
  const slots = state.ui.selectedSlotIds
    .map((slotId) => getSlotById(state.ship.slots, slotId))
    .filter((slot): slot is NonNullable<typeof slot> => Boolean(slot));
  if (slots.length < 2 || slots.length > 3) {
    return undefined;
  }
  if (slots.some((slot) => !slot.moduleId)) {
    return undefined;
  }
  return slots;
}

function getSelectedMergeModules(state: RunState): ModuleId[] | undefined {
  const slots = getSelectedMergeSlots(state);
  if (!slots) {
    return undefined;
  }
  return slots.map((slot) => slot.moduleId!);
}

export function processCommand(state: RunState, command: GameCommand, saveData: SaveData): RunState {
  switch (command.type) {
    case "start_new_run": {
      return createRunState(saveData, "planning");
    }

    case "toggle_pause": {
      if (state.phase === "execution") {
        state.paused = !state.paused;
        addMessage(state, state.paused ? "Mission paused instantly." : "Mission resumed.");
      }
      return state;
    }
    case "toggle_execution_speed": {
      if (state.phase === "execution") {
        state.executionSpeed = state.executionSpeed === 1 ? 2 : 1;
        addMessage(state, `Mission speed set to ${state.executionSpeed}x.`);
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
        addMessage(state, `Mission doctrine set to ${command.doctrineId.replace(/_/g, " ")}.`);
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
      const selectedFabricationId = state.ui.selectedFabricationModuleId;
      if (selectedFabricationId && !slot.moduleId) {
        if (isEpicModuleId(selectedFabricationId)) {
          if (state.ship.epicInventory[selectedFabricationId] <= 0) {
            addMessage(state, "That Epic Module core is not currently in your fabrication pool.");
            return state;
          }
          const epic = getEpicModuleById(selectedFabricationId);
          state.ship.epicInventory[selectedFabricationId] -= 1;
          slot.moduleId = epic.baseModuleId;
          slot.epicModuleId = epic.id;
          state.missionPrep.modulesPlacedThisMission += 1;
          addMessage(state, `${epic.name} installed in ${slot.label}.`);
          return state;
        }

        const cost = MODULE_DEFINITIONS[selectedFabricationId].fabricationCost;
        if (!canAfford(state.resources, cost)) {
          addMessage(state, "Insufficient resources for that module.");
          return state;
        }
        subtractFromPool(state.resources, cost);
        slot.moduleId = getFabricationBaseModuleId(selectedFabricationId);
        slot.epicModuleId = undefined;
        state.missionPrep.modulesPlacedThisMission += 1;
        addMessage(state, `${MODULE_DEFINITIONS[selectedFabricationId].name} placed in ${slot.label}.`);
        return state;
      }

      if (!slot.moduleId) {
        state.ui.selectedSlotIds = [];
        return state;
      }

      if (state.ui.selectedSlotIds.includes(slot.id)) {
        state.ui.selectedSlotIds = state.ui.selectedSlotIds.filter((slotId) => slotId !== slot.id);
      } else {
        state.ui.selectedSlotIds = [...state.ui.selectedSlotIds, slot.id].slice(-3);
      }
      return state;
    }
    case "merge_selected": {
      if (state.phase !== "planning") {
        return state;
      }
      const selectedSlotIds = state.ui.selectedSlotIds;
      const selectedSlots = getSelectedMergeSlots(state);
      const modules = selectedSlots?.map((slot) => slot.moduleId!) ?? undefined;
      if (!selectedSlots || !modules || selectedSlotIds.length < 2 || selectedSlotIds.length > 3) {
        addMessage(state, "Select two or three placed modules to create a bot.");
        return state;
      }
      if (state.ship.bots.length >= getBotCapacity(state)) {
        addMessage(state, "Support Bay limit reached. Upgrade support capacity or lose a bot first.");
        return state;
      }
      const preview = getMergePreviewFromModules(modules, state.discovery);
      if (!preview.recipe) {
        addMessage(state, preview.text);
        return state;
      }
      const entryBefore = state.discovery[preview.recipe.id]?.state ?? "unknown";
      noteRecipeUse(state.discovery, preview.recipe.id);
      if (entryBefore === "unknown") {
        state.simulation.cycleStats.discoveries.push(preview.recipe.resultName);
      }
      const epicModuleIds = selectedSlots
        .map((slot) => slot.epicModuleId)
        .filter((epicId): epicId is NonNullable<typeof epicId> => Boolean(epicId));
      selectedSlotIds.forEach((slotId) => {
        const slot = getSlotById(state.ship.slots, slotId);
        if (slot) {
          slot.moduleId = undefined;
          slot.epicModuleId = undefined;
        }
      });
      const bot = createBotFromRecipe(preview.recipe.id, state.ship.bots.length, epicModuleIds);
      state.ship.bots.push(bot);
      state.ui.selectedSlotIds = [];
      addMessage(
        state,
        epicModuleIds.length > 0
          ? `${preview.recipe.resultName} assembled with epic hardware. The merge is permanent.`
          : `${preview.recipe.resultName} assembled. The merge is permanent.`,
      );
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
      addMessage(state, `${definition.name} upgraded to tier ${state.ship.upgrades[command.upgradeId]}. ${definition.perLevelText}`);
      return state;
    }
    case "begin_execution": {
      if (state.phase !== "planning") {
        return state;
      }
      const readiness = getMissionReadiness(state);
      if (!readiness.ready) {
        addMessage(state, readiness.reason);
        return state;
      }
      prepareExecutionState(state);
      return state;
    }
    case "toggle_discovery_log": {
      state.ui.showDiscoveryLog = !state.ui.showDiscoveryLog;
      state.ui.activeDockPanel = state.ui.showDiscoveryLog ? "log" : state.phase === "planning" ? "build" : "ship";
      return state;
    }
    case "set_dock_panel": {
      state.ui.activeDockPanel = command.panelId;
      state.ui.showDiscoveryLog = command.panelId === "log";
      return state;
    }
    case "advance_tutorial": {
      return state;
    }
    case "skip_tutorial": {
      skipTutorial(state);
      state.ui.activeDockPanel = state.phase === "planning" ? "build" : "ship";
      return state;
    }
    case "replay_tutorial": {
      return createRunState(saveData, "planning", { forceTutorial: true });
    }
    case "choose_reward": {
      if (!state.pendingReward) {
        return state;
      }
      if (command.rewardKind === "artifact") {
        if (state.ship.artifacts.includes(command.rewardId)) {
          state.pendingReward = undefined;
          state.paused = false;
          return state;
        }
        const artifact = getArtifactById(command.rewardId);
        if (!artifact) {
          return state;
        }
        state.ship.artifacts.push(artifact.id);
        state.simulation.cycleStats.rewardsEarned.push(artifact.name);
        state.meta.totalArtifactsRecovered += 1;
        addMessage(state, `${artifact.name} installed.`);
      } else {
        if (!isEpicModuleId(command.rewardId)) {
          return state;
        }
        const epic = getEpicModuleById(command.rewardId);
        grantEpicModule(state, epic.id);
        state.simulation.cycleStats.rewardsEarned.push(epic.name);
        addMessage(state, `${epic.name} added to the fabrication pool.`);
      }
      state.pendingReward = undefined;
      if (state.phase === "execution") {
        state.paused = false;
      }
      recalculateShipStats(state);
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