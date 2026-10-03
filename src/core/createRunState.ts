import { BOARD_ORIGIN, SLOT_GAP, SLOT_SIZE } from "../game/constants";
import { createEmptyEpicInventory } from "../data/epicModuleRegistry";
import type {
  BotInstance,
  DiscoveryLog,
  RouteId,
  RunState,
  SaveData,
  ShipSlot,
  SimulationState,
} from "../types/gameTypes";
import { createTutorialState } from "./tutorial";
import {
  createCycleThreatSchedule,
  DERELICT_SUPPLIES,
  getCycleDuration,
  getEncounterName,
  ROUTES,
} from "./encounters";
import { generateSectorMap, getReachableNodes, getSectorIndex, getSectorNode } from "./sectorMap";
import { addMessage, addToPool, createEmptyPool, getBotStagingPosition } from "./utils";

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

const LAUNCH_COUNTDOWN = 1.6;

export function isFirstMission(state: Pick<RunState, "cycle" | "meta">): boolean {
  return state.cycle === 1 && state.meta.totalCyclesCompleted === 0;
}

export function createSimulationState(cycle: number, route: RouteId, firstMission: boolean): SimulationState {
  return {
    elapsed: 0,
    duration: getCycleDuration(cycle, route),
    route,
    encounter: ROUTES[route].encounter,
    encounterName: getEncounterName(cycle, route),
    lanes: firstMission ? [1] : [0, 1, 2],
    launchCountdown: 0,
    shieldsOffline: route === "nebula",
    scrapMultiplier: route === "nebula" ? 2 : 1,
    chests: [],
    callouts: [],
    killfeed: [],
    announcement: undefined,
    dodgesByUnit: {},
    fallenBots: [],
    startingHull: 0,
    upcomingThreats: createCycleThreatSchedule(cycle, route),
    threatCursor: 0,
    pendingSpawns: [],
    enemies: [],
    projectiles: [],
    barrages: [],
    fighters: [],
    impacts: [],
    moduleTimers: {},
    warshipDefeated: false,
    objective: {
      integrity: 90 + cycle * 18,
      maxIntegrity: 90 + cycle * 18,
      rewardClaimed: false,
    },
    bossDefeated: false,
    moonRewardTriggered: false,
    perfectCommitmentRewardGranted: false,
    bossEncounter: {
      activeBossId: undefined,
      activeBossName: undefined,
      rewardEpicId: undefined,
      introTimer: 0,
      telegraph: undefined,
      telegraphTimer: 0,
      disabledModuleId: undefined,
      disabledModuleTimer: 0,
    },
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
  const firstMission = isFirstMission({ cycle: 1, meta: saveData.meta });
  const sector = generateSectorMap(0, Math.floor(Math.random() * 2 ** 31), firstMission);
  const firstNode = sector.columns[0][0];
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
        hangar_tech: 0,
      },
      artifacts: [],
      epicInventory: createEmptyEpicInventory(),
      botCapacityBase: 4,
    },
    simulation: createSimulationState(1, firstNode.route, firstMission),
    sector,
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
  const sectorIndex = getSectorIndex(state.cycle);
  if (sectorIndex !== state.sector.index) {
    state.sector = generateSectorMap(sectorIndex, state.sector.seed, false);
  }
  const nextNode = getReachableNodes(state)[0];
  state.sector.selectedNodeId = nextNode.id;
  state.simulation = createSimulationState(state.cycle, nextNode.route, false);
}

export function selectNode(state: RunState, nodeId: string): boolean {
  const node = getReachableNodes(state).find((candidate) => candidate.id === nodeId);
  if (!node) {
    return false;
  }
  state.sector.selectedNodeId = node.id;
  selectRoute(state, node.route);
  return true;
}

export function selectRoute(state: RunState, route: RouteId): void {
  const discoveries = [...state.simulation.cycleStats.discoveries];
  const messages = [...state.simulation.messageLog];
  state.simulation = createSimulationState(state.cycle, route, isFirstMission(state));
  state.simulation.cycleStats.discoveries = discoveries;
  state.simulation.messageLog = messages;
}

export function prepareExecutionState(state: RunState): void {
  const preMissionDiscoveries = [...state.simulation.cycleStats.discoveries];
  const route = state.simulation.route;
  if (getSectorNode(state.sector, state.sector.selectedNodeId) && !state.sector.path.includes(state.sector.selectedNodeId)) {
    state.sector.path.push(state.sector.selectedNodeId);
  }

  state.phase = "execution";
  state.paused = false;
  state.summary = undefined;
  state.pendingReward = undefined;
  state.executionSpeed = 1;
  state.commitmentBonus = 0.5;
  state.doctrineChangesThisCycle = 0;
  state.ui.selectedSlotIds = [];
  state.ui.selectedFabricationModuleId = undefined;
  state.ui.activeDockPanel = "bots";
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
  state.simulation = createSimulationState(state.cycle, route, isFirstMission(state));
  state.simulation.cycleStats.discoveries = preMissionDiscoveries;
  state.simulation.launchCountdown = LAUNCH_COUNTDOWN;
  state.simulation.messageLog = [
    `${state.simulation.encounterName} started. Bots are running at 150% efficiency while commitment holds.`,
  ];
  if (state.simulation.shieldsOffline) {
    state.ship.shield = 0;
  }
  if (route === "derelict") {
    addToPool(state.resources, DERELICT_SUPPLIES);
    addToPool(state.simulation.cycleStats.gained, DERELICT_SUPPLIES);
    addMessage(state, `Derelict supplies recovered: +${DERELICT_SUPPLIES.solar} solar, +${DERELICT_SUPPLIES.minerals} minerals.`);
  }
  state.simulation.startingHull = state.ship.hull;
}