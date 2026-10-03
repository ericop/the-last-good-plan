import { describe, expect, it } from "vitest";
import { createRunState, prepareExecutionState, selectRoute } from "./createRunState";
import { createDefaultDiscoveryLog } from "./discovery";
import { getRouteOptions, spawnWarship } from "./encounters";
import { processCommand } from "./processCommand";
import { stepSimulation } from "./simulation";
import type { ModuleId, RouteId, RunState, SaveData } from "../types/gameTypes";

function createSaveData(totalCyclesCompleted = 3): SaveData {
  return {
    discovery: createDefaultDiscoveryLog(),
    meta: { totalCyclesCompleted, totalPerfectCommitments: 0, totalArtifactsRecovered: 0 },
    onboarding: { tutorialCompleted: true },
  };
}

function slot(state: RunState, slotId: string) {
  return state.ship.slots.find((candidate) => candidate.id === slotId)!;
}

function buildSturdyShip(state: RunState, saveData: SaveData): void {
  state.resources = { solar: 999, minerals: 999, scrap: 999 };
  state.ship.upgrades.support_bay = 2;
  state.ship.upgrades.hangar_tech = 2;
  const merge = (modules: ModuleId[]) => {
    const ids = ["slot_2_0", "slot_2_1", "slot_2_2"].slice(0, modules.length);
    modules.forEach((moduleId, index) => {
      slot(state, ids[index]).moduleId = moduleId;
    });
    state.ui.selectedSlotIds = ids;
    processCommand(state, { type: "merge_selected" }, saveData);
  };
  merge(["solar_collector", "pulse_cannon"]);
  merge(["booster", "pulse_cannon"]);
  merge(["solar_collector", "mineral_drill"]);
  const layout: Record<string, ModuleId> = {
    slot_0_0: "pulse_cannon",
    slot_0_1: "shield_emitter",
    slot_0_2: "pulse_cannon",
    slot_1_0: "launch_port",
    slot_1_1: "repair_node",
    slot_1_2: "booster",
  };
  for (const [slotId, moduleId] of Object.entries(layout)) {
    slot(state, slotId).moduleId = moduleId;
  }
  state.missionPrep.modulesPlacedThisMission = Object.keys(layout).length;
}

function playMission(state: RunState, saveData: SaveData, maxSeconds = 240): void {
  processCommand(state, { type: "begin_execution" }, saveData);
  for (let elapsed = 0; elapsed < maxSeconds && state.phase === "execution"; elapsed += 0.05) {
    stepSimulation(state, 0.05);
  }
}

function openAllChests(state: RunState, saveData: SaveData): void {
  while (state.simulation.chests.length > 0 || state.pendingReward) {
    if (!state.pendingReward) {
      processCommand(state, { type: "open_chest" }, saveData);
    }
    const choice = state.pendingReward!.choices[0];
    processCommand(state, { type: "choose_reward", rewardKind: choice.kind, rewardId: choice.id }, saveData);
  }
}

function expectSaneState(state: RunState): void {
  for (const value of [state.ship.hull, state.ship.shield, state.resources.solar, state.resources.minerals, state.resources.scrap]) {
    expect(Number.isFinite(value)).toBe(true);
  }
  expect(state.ship.hull).toBeGreaterThanOrEqual(0);
}

describe("full missions play to a debrief on every route", () => {
  const routes: Array<{ route: RouteId; cycle: number }> = [
    { route: "swarm", cycle: 2 },
    { route: "derelict", cycle: 2 },
    { route: "nebula", cycle: 4 },
    { route: "duel", cycle: 3 },
    { route: "boss", cycle: 10 },
  ];

  for (const { route, cycle } of routes) {
    it(`finishes a ${route} mission with stars, a summary, and openable chests`, () => {
      const saveData = createSaveData();
      const state = createRunState(saveData, "planning");
      state.cycle = cycle;
      selectRoute(state, route);
      buildSturdyShip(state, saveData);

      playMission(state, saveData);

      expect(["results", "run_over"]).toContain(state.phase);
      expect(state.summary?.stars).toHaveLength(3);
      expectSaneState(state);
      if (state.phase === "results") {
        openAllChests(state, saveData);
        processCommand(state, { type: "continue_from_results" }, saveData);
        expect(state.phase).toBe("planning");
        expect(state.cycle).toBe(cycle + 1);
      }
    });
  }

  it("survives a multi-mission campaign of route picks, chests, and debriefs without breaking state", () => {
    const saveData = createSaveData(0);
    const state = createRunState(saveData, "planning");
    buildSturdyShip(state, saveData);
    for (let mission = 0; mission < 6 && state.phase === "planning"; mission += 1) {
      const route = state.routeOptions[state.routeOptions.length - 1];
      processCommand(state, { type: "choose_route", routeId: route }, saveData);
      expect(state.simulation.route).toBe(route);
      playMission(state, saveData);
      expectSaneState(state);
      const phase = state.phase as RunState["phase"];
      if (phase !== "results") {
        break;
      }
      openAllChests(state, saveData);
      processCommand(state, { type: "continue_from_results" }, saveData);
      state.resources = { solar: 999, minerals: 999, scrap: 999 };
    }
    expect(state.meta.totalStars).toBeGreaterThan(0);
  });
});

describe("sector map routes", () => {
  it("offers only swarm on the very first mission and only the boss on boss cycles", () => {
    expect(getRouteOptions(1, true)).toEqual(["swarm"]);
    expect(getRouteOptions(10, false)).toEqual(["boss"]);
  });

  it("offers up to three distinct routes, led by the default rotation", () => {
    expect(getRouteOptions(2, false)).toEqual(["swarm", "nebula", "derelict"]);
    const duelCycle = getRouteOptions(6, false);
    expect(duelCycle[0]).toBe("duel");
    expect(new Set(duelCycle).size).toBe(duelCycle.length);
    expect(duelCycle.length).toBe(3);
  });

  it("ignores routes that are not on offer", () => {
    const saveData = createSaveData();
    const state = createRunState(saveData, "planning");
    processCommand(state, { type: "choose_route", routeId: "boss" }, saveData);
    expect(state.simulation.route).toBe("swarm");
  });

  it("runs the first-ever mission down a single lane", () => {
    const state = createRunState(createSaveData(0), "planning");
    expect(state.simulation.lanes).toEqual([1]);
    expect(createRunState(createSaveData(1), "planning").simulation.lanes).toEqual([0, 1, 2]);
  });

  it("turns shields off and doubles scrap in the nebula", () => {
    const saveData = createSaveData();
    const state = createRunState(saveData, "planning");
    state.cycle = 4;
    state.routeOptions = ["nebula"];
    selectRoute(state, "nebula");
    prepareExecutionState(state);
    state.simulation.launchCountdown = 0;
    stepSimulation(state, 0.1);
    expect(state.ship.shield).toBe(0);
    expect(state.simulation.scrapMultiplier).toBe(2);
  });

  it("hands out derelict supplies on arrival", () => {
    const state = createRunState(createSaveData(), "planning");
    state.cycle = 2;
    selectRoute(state, "derelict");
    const before = { ...state.resources };
    prepareExecutionState(state);
    expect(state.resources.solar).toBe(before.solar + 20);
    expect(state.resources.minerals).toBe(before.minerals + 30);
    expect(state.simulation.upcomingThreats).toHaveLength(3);
  });
});

describe("launch, chests, and debrief", () => {
  it("holds the clock during the launch countdown", () => {
    const saveData = createSaveData();
    const state = createRunState(saveData, "planning");
    buildSturdyShip(state, saveData);
    processCommand(state, { type: "begin_execution" }, saveData);
    stepSimulation(state, 1);
    expect(state.simulation.elapsed).toBe(0);
    stepSimulation(state, 1);
    stepSimulation(state, 1);
    expect(state.simulation.elapsed).toBeGreaterThan(0);
  });

  it("blocks the next mission until every chest is opened", () => {
    const saveData = createSaveData();
    const state = createRunState(saveData, "results");
    state.simulation.chests.push({
      source: "boss",
      title: "Boss Defeated",
      description: "",
      choices: [{ kind: "epic_module", id: "war_forge" }],
    });

    processCommand(state, { type: "continue_from_results" }, saveData);
    expect(state.phase).toBe("results");

    processCommand(state, { type: "open_chest" }, saveData);
    expect(state.pendingReward?.source).toBe("boss");
    processCommand(state, { type: "choose_reward", rewardKind: "epic_module", rewardId: "war_forge" }, saveData);
    expect(state.ship.epicInventory.war_forge).toBe(1);

    processCommand(state, { type: "continue_from_results" }, saveData);
    expect(state.phase).toBe("planning");
  });

  it("scores stars and names an MVP", () => {
    const saveData = createSaveData();
    const state = createRunState(saveData, "planning");
    state.cycle = 2;
    selectRoute(state, "swarm");
    buildSturdyShip(state, saveData);
    playMission(state, saveData);

    const summary = state.summary!;
    expect(summary.stars.map((star) => star.label)).toEqual(["Survived", "Moon fully mined", "No bots lost"]);
    if (state.phase === "results") {
      expect(summary.stars[0].earned).toBe(true);
      expect(summary.mvp?.name).toBeTruthy();
    }
  });
});

describe("battle events", () => {
  it("records the killer in the killfeed", () => {
    const saveData = createSaveData();
    const state = createRunState(saveData, "planning");
    buildSturdyShip(state, saveData);
    playMission(state, saveData, 20);
    expect(state.simulation.killfeed.length).toBeGreaterThan(0);
    expect(state.simulation.killfeed[0].killer).toBeTruthy();
  });

  it("calls out a perfect dodge and credits the dodger", () => {
    const saveData = createSaveData();
    const state = createRunState(saveData, "planning");
    state.cycle = 3;
    selectRoute(state, "duel");
    prepareExecutionState(state);
    state.simulation.launchCountdown = 0;
    state.simulation.threatCursor = state.simulation.upcomingThreats.length;
    const warship = spawnWarship(3);
    warship.x = warship.holdX!;
    warship.attack = 0;
    warship.weapons = warship.weapons!.filter((weapon) => weapon.kind === "beam");
    warship.weapons[0].charge = warship.weapons[0].chargeTime;
    state.simulation.enemies.push(warship);
    state.ship.upgrades.hangar_tech = 1;
    state.simulation.fighters.push({
      id: "ace",
      portSlotId: "slot_0_0",
      kind: "interceptor",
      color: 0xffffff,
      x: warship.x - 140,
      y: warship.y,
      heading: 0,
      orbit: 0,
      hp: 30,
      maxHp: 30,
      speed: 60,
      attack: 0,
      range: 10,
      mining: 0,
      support: 0,
      dodge: 1,
      launchBoost: 0,
    });

    for (let elapsed = 0; elapsed < 3; elapsed += 0.05) {
      stepSimulation(state, 0.05);
    }

    expect(state.simulation.dodgesByUnit.ace).toBe(1);
    expect(state.simulation.callouts.some((callout) => callout.text === "PERFECT DODGE!") || state.simulation.dodgesByUnit.ace === 1).toBe(true);
  });
});
