import { describe, expect, it } from "vitest";
import { createRunState, prepareExecutionState } from "./createRunState";
import { createDefaultDiscoveryLog } from "./discovery";
import { createCycleThreatSchedule, getEncounterKind, spawnWarship } from "./encounters";
import { getPortLoadout } from "./hangar";
import { processCommand } from "./processCommand";
import { stepSimulation } from "./simulation";
import type { RunState, SaveData } from "../types/gameTypes";

function createSaveData(): SaveData {
  return {
    discovery: createDefaultDiscoveryLog(),
    meta: { totalCyclesCompleted: 3, totalPerfectCommitments: 0, totalArtifactsRecovered: 0 },
    onboarding: { tutorialCompleted: true },
  };
}

function createExecutionState(cycle: number): RunState {
  const state = createRunState(createSaveData(), "planning");
  state.cycle = cycle;
  prepareExecutionState(state);
  return state;
}

function slot(state: RunState, slotId: string) {
  return state.ship.slots.find((candidate) => candidate.id === slotId)!;
}

function run(state: RunState, seconds: number, step = 0.1): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += step) {
    stepSimulation(state, step);
  }
}

describe("encounter rotation", () => {
  it("rotates between swarm defense, ship duels, and boss fights", () => {
    expect(getEncounterKind(1)).toBe("swarm");
    expect(getEncounterKind(2)).toBe("swarm");
    expect(getEncounterKind(3)).toBe("duel");
    expect(getEncounterKind(9)).toBe("duel");
    expect(getEncounterKind(10)).toBe("boss");
    expect(getEncounterKind(12)).toBe("duel");
  });

  it("opens duels with a warship instead of a lane stream", () => {
    const schedule = createCycleThreatSchedule(3);
    expect(schedule[0]).toMatchObject({ kind: "warship", count: 1 });
    expect(createExecutionState(3).simulation.encounterName).toBe("Ship Duel: Corsair Frigate");
  });
});

describe("swarm lanes", () => {
  it("trickles a wave into the lanes instead of spawning it all at once", () => {
    const state = createExecutionState(1);
    run(state, 4.05);

    expect(state.simulation.enemies.length).toBeGreaterThan(0);
    expect(state.simulation.enemies.length).toBeLessThan(state.simulation.upcomingThreats[0].count);
    expect(state.simulation.pendingSpawns.length).toBeGreaterThan(0);
  });
});

describe("ship duels", () => {
  it("parks the warship and trades fire with the player ship", () => {
    const state = createExecutionState(3);
    const startingHull = state.ship.hull + state.ship.shield;
    run(state, 14);

    const warship = state.simulation.enemies.find((enemy) => enemy.kind === "warship")!;
    expect(warship.x).toBeCloseTo(warship.holdX!, 0);
    expect(state.ship.hull + state.ship.shield).toBeLessThan(startingHull);
  });

  it("ends the mission shortly after the warship is destroyed", () => {
    const state = createExecutionState(3);
    const warship = spawnWarship(3);
    warship.x = warship.holdX!;
    warship.hp = 1;
    warship.shield = 0;
    warship.shieldRegen = 0;
    state.simulation.enemies.push(warship);
    state.simulation.threatCursor = 1;
    slot(state, "slot_1_1").moduleId = "pulse_cannon";
    const mineralsBefore = state.resources.minerals;

    run(state, 3);
    expect(state.simulation.warshipDefeated).toBe(true);
    expect(state.resources.minerals).toBeGreaterThan(mineralsBefore);
    expect(state.simulation.duration).toBeLessThan(10);

    run(state, 5);
    expect(state.phase).toBe("results");
  });
});

describe("carrier launch ports", () => {
  it("cannot be built until Hangar Tech is researched", () => {
    const saveData = createSaveData();
    const state = createRunState(saveData, "planning");

    processCommand(state, { type: "select_fabrication_module", moduleId: "launch_port" }, saveData);
    processCommand(state, { type: "board_slot_pressed", slotId: "slot_0_0" }, saveData);
    expect(slot(state, "slot_0_0").moduleId).toBeUndefined();

    state.resources.scrap = 500;
    processCommand(state, { type: "spend_upgrade", upgradeId: "hangar_tech" }, saveData);
    processCommand(state, { type: "board_slot_pressed", slotId: "slot_0_0" }, saveData);
    expect(slot(state, "slot_0_0").moduleId).toBe("launch_port");
  });

  it("launches fighters during battle up to the wing size", () => {
    const state = createExecutionState(1);
    state.simulation.threatCursor = state.simulation.upcomingThreats.length;
    state.ship.upgrades.hangar_tech = 1;
    slot(state, "slot_0_0").moduleId = "launch_port";
    const loadout = getPortLoadout(state, slot(state, "slot_0_0"));

    run(state, 1.5);
    expect(state.simulation.fighters).toHaveLength(1);

    run(state, loadout.interval * (loadout.capacity + 1));
    expect(state.simulation.fighters).toHaveLength(loadout.capacity);
  });

  it("shapes the wing from adjacent modules", () => {
    const state = createExecutionState(1);
    state.ship.upgrades.hangar_tech = 1;
    const port = slot(state, "slot_1_1");
    port.moduleId = "launch_port";
    expect(getPortLoadout(state, port).kind).toBe("interceptor");

    slot(state, "slot_0_1").moduleId = "repair_node";
    expect(getPortLoadout(state, port).kind).toBe("tender");

    slot(state, "slot_1_0").moduleId = "mineral_drill";
    expect(getPortLoadout(state, port).kind).toBe("skiff");

    const plain = getPortLoadout(state, port);
    slot(state, "slot_1_2").moduleId = "pulse_cannon";
    expect(getPortLoadout(state, port).attack).toBeGreaterThan(plain.attack);
  });

  it("refuses to merge a launch port into a bot", () => {
    const saveData = createSaveData();
    const state = createRunState(saveData, "planning");
    slot(state, "slot_0_0").moduleId = "launch_port";
    slot(state, "slot_0_1").moduleId = "solar_collector";
    state.ui.selectedSlotIds = ["slot_0_0", "slot_0_1"];

    processCommand(state, { type: "merge_selected" }, saveData);

    expect(state.ship.bots).toHaveLength(0);
    expect(slot(state, "slot_0_0").moduleId).toBe("launch_port");
  });
});

describe("pulse cannons", () => {
  it("fire visible bolts that damage their target on arrival", () => {
    const state = createExecutionState(1);
    state.simulation.threatCursor = state.simulation.upcomingThreats.length;
    slot(state, "slot_1_1").moduleId = "pulse_cannon";
    const warship = spawnWarship(3);
    warship.x = warship.holdX!;
    warship.shield = 0;
    warship.weapons = [];
    state.simulation.enemies.push(warship);

    run(state, 1.45, 0.05);
    expect(state.simulation.projectiles.some((projectile) => projectile.owner === "player")).toBe(true);
    const hpBeforeImpact = warship.hp;

    run(state, 1.2, 0.05);
    expect(warship.hp).toBeLessThan(hpBeforeImpact);
  });
});
