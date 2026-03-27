import { BOARD_ORIGIN, SLOT_GAP, SLOT_SIZE } from "../game/constants";
import { createThreatSchedule } from "../data/waves";
import type {
  BotInstance,
  DiscoveryLog,
  RunState,
  SaveData,
  ShipSlot,
  SimulationState,
} from "../types/gameTypes";
import { createTutorialState } from "./tutorial";
import { createEmptyPool, getBotStagingPosition } from "./utils";

interface CreateRunStateOptions {
  forceTutorial?: boolean;
}

function createSlots(): ShipSlot[] {
  const slots: ShipSlot[] = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const id = `slot_${row}_${col}`;
      const neighbors: string[] = [];
      if (row > 0) neighbors.push(`slot_${row - 1}_${col}`);
      if (row < 2) neighbors.push(`slot_${row + 1}_${col}`);
      if (col > 0) neighbors.push(`slot_${row}_${col - 1}`);
      if (col < 2) neighbors.push(`slot_${row}_${col + 1}`);
      slots.push({
        id,
        label: `${String.fromCharCode(65 + row)}${col + 1}`,
        gridX: col,
        gridY: row,
        x: BOARD_ORIGIN.x + col * (SLOT_SIZE + SLOT_GAP) + SLOT_SIZE / 2,
        y: BOARD_ORIGIN.y + row * (SLOT_SIZE + SLOT_GAP) + SLOT_SIZE / 2,
        neighbors,
      });
    }
  }
  return slots;
}

function createSimulationState(cycle: number): SimulationState {
  return {
    elapsed: 0,
    duration: 46,
    upcomingThreats: createThreatSchedule(cycle),
    threatCursor: 0,
    enemies: [],
    objective: {
      integrity: 90 + cycle * 18,
      maxIntegrity: 90 + cycle * 18,
      rewardClaimed: false,
    },
    bossDefeated: false,
    moonRewardTriggered: false,
    perfectCommitmentRewardGranted: false,
    messageLog: ["Planning phase. Place modules, create a bot, then start the mission."],
    cycleStats: {
      gained: createEmptyPool(),
      lost: {
        botsDestroyed: 0,
        hullDamage: 0,
      },
      rewardsEarned: [],
      discoveries: [],
    },
  };
}

function createStarterBots(): BotInstance[] {
  return [];
}

export function createRunState(
  saveData: SaveData,
  phase: RunState["phase"] = "planning",
  options: CreateRunStateOptions = {},
): RunState {
  const discovery: DiscoveryLog = JSON.parse(JSON.stringify(saveData.discovery));
  return {
    phase,
    cycle: 1,
    paused: false,
    executionSpeed: 1,
    doctrine: "balanced",
    commitmentBonus: 0.5,
    doctrineChangesThisCycle: 0,
    resources: {
      solar: 200,
      minerals: 200,
      scrap: 72,
    },
    ship: {
      slots: createSlots(),
      bots: createStarterBots(),
      hull: 120,
      maxHull: 120,
      shield: 44,
      maxShield: 44,
      upgrades: {
        mining_array: 0,
        defense_grid: 0,
        support_bay: 0,
      },
      artifacts: [],
      botCapacityBase: 4,
    },
    simulation: createSimulationState(1),
    summary: undefined,
    pendingReward: undefined,
    ui: {
      selectedFabricationModuleId: undefined,
      selectedSlotIds: [],
      showDiscoveryLog: false,
      activeDockPanel: "build",
    },
    discovery,
    meta: { ...saveData.meta },
    onboarding: { ...saveData.onboarding },
    tutorial: createTutorialState(saveData, options.forceTutorial),
    missionPrep: {
      modulesPlacedThisMission: 0,
    },
  };
}

export function resetForNextCycle(state: RunState): void {
  state.cycle += 1;
  state.phase = "planning";
  state.paused = false;
  state.commitmentBonus = 0.5;
  state.doctrineChangesThisCycle = 0;
  state.pendingReward = undefined;
  state.summary = undefined;
  state.executionSpeed = 1;
  state.ui.selectedSlotIds = [];
  state.ui.selectedFabricationModuleId = undefined;
  state.ui.activeDockPanel = "build";
  state.ship.shield = state.ship.maxShield;
  state.ship.hull = Math.min(state.ship.maxHull, state.ship.hull + 18);
  state.ship.bots.forEach((bot, index) => {
    const position = getBotStagingPosition(index);
    bot.hp = bot.maxHp;
    bot.x = position.x;
    bot.y = position.y;
    bot.cooldown = 0;
    bot.contribution = { mined: 0, damage: 0, healing: 0, salvage: 0 };
  });
  state.missionPrep.modulesPlacedThisMission = 0;
  state.simulation = createSimulationState(state.cycle);
}

export function prepareExecutionState(state: RunState): void {
  const preMissionDiscoveries = [...state.simulation.cycleStats.discoveries];

  state.phase = "execution";
  state.paused = false;
  state.summary = undefined;
  state.pendingReward = undefined;
  state.executionSpeed = 1;
  state.commitmentBonus = 0.5;
  state.doctrineChangesThisCycle = 0;
  state.ui.selectedSlotIds = [];
  state.ui.selectedFabricationModuleId = undefined;
  state.ui.activeDockPanel = "ship";
  state.ship.shield = state.ship.maxShield;
  state.ship.bots = state.ship.bots.filter((bot) => bot.hp > 0);
  state.ship.bots.forEach((bot, index) => {
    const position = getBotStagingPosition(index);
    bot.hp = Math.min(bot.maxHp, bot.hp + bot.maxHp * 0.35);
    bot.x = position.x;
    bot.y = position.y;
    bot.cooldown = 0;
    bot.contribution = { mined: 0, damage: 0, healing: 0, salvage: 0 };
  });
  state.simulation = createSimulationState(state.cycle);
  state.simulation.cycleStats.discoveries = preMissionDiscoveries;
  state.simulation.messageLog = [
    `Mission ${state.cycle} started. Bots are running at 150% efficiency while commitment holds.`,
  ];
}













