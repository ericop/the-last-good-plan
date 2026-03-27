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
import { createEmptyPool } from "./utils";

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
    messageLog: ["Planning phase. Fabricate modules, merge adjacent systems, then begin the cycle."],
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

export function createRunState(saveData: SaveData, phase: RunState["phase"] = "planning"): RunState {
  const discovery: DiscoveryLog = JSON.parse(JSON.stringify(saveData.discovery));
  return {
    phase,
    cycle: 1,
    paused: false,
    doctrine: "balanced",
    commitmentBonus: 0.5,
    doctrineChangesThisCycle: 0,
    resources: {
      solar: 72,
      minerals: 72,
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
      botCapacityBase: 3,
    },
    simulation: createSimulationState(1),
    summary: undefined,
    pendingReward: undefined,
    ui: {
      selectedFabricationModuleId: undefined,
      selectedSlotIds: [],
      showDiscoveryLog: false,
    },
    discovery,
    meta: { ...saveData.meta },
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
  state.ui.selectedSlotIds = [];
  state.ui.selectedFabricationModuleId = undefined;
  state.ship.shield = state.ship.maxShield;
  state.ship.hull = Math.min(state.ship.maxHull, state.ship.hull + 18);
  state.ship.bots.forEach((bot, index) => {
    bot.hp = bot.maxHp;
    bot.x = 340 + (index % 3) * 22;
    bot.y = 270 + Math.floor(index / 3) * 22;
    bot.cooldown = 0;
    bot.contribution = { mined: 0, damage: 0, healing: 0, salvage: 0 };
  });
  state.simulation = createSimulationState(state.cycle);
}

export function prepareExecutionState(state: RunState): void {
  state.phase = "execution";
  state.paused = false;
  state.summary = undefined;
  state.pendingReward = undefined;
  state.commitmentBonus = 0.5;
  state.doctrineChangesThisCycle = 0;
  state.ui.selectedSlotIds = [];
  state.ui.selectedFabricationModuleId = undefined;
  state.ship.shield = state.ship.maxShield;
  state.ship.bots = state.ship.bots.filter((bot) => bot.hp > 0);
  state.ship.bots.forEach((bot, index) => {
    bot.hp = Math.min(bot.maxHp, bot.hp + bot.maxHp * 0.35);
    bot.x = 360 + (index % 4) * 22;
    bot.y = 250 + Math.floor(index / 4) * 30;
    bot.cooldown = 0;
    bot.contribution = { mined: 0, damage: 0, healing: 0, salvage: 0 };
  });
  state.simulation = createSimulationState(state.cycle);
  state.simulation.messageLog = [
    `Cycle ${state.cycle} started. Bots are running at 150% efficiency while commitment holds.`,
  ];
}
