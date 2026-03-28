import { describe, expect, it } from "vitest";
import { createRunState } from "./createRunState";
import { handleBossDefeat, isBossCycle, spawnBoss, createCycleThreatSchedule } from "./bossManager";
import { createDefaultDiscoveryLog } from "./discovery";
import { processCommand } from "./processCommand";
import type { SaveData } from "../types/gameTypes";

function createSaveData(): SaveData {
  return {
    discovery: createDefaultDiscoveryLog(),
    meta: {
      totalCyclesCompleted: 0,
      totalPerfectCommitments: 0,
      totalArtifactsRecovered: 0,
    },
    onboarding: {
      tutorialCompleted: true,
    },
  };
}

describe("boss system", () => {
  it("marks every tenth cycle as a boss cycle", () => {
    expect(isBossCycle(9)).toBe(false);
    expect(isBossCycle(10)).toBe(true);
    expect(isBossCycle(20)).toBe(true);
    expect(isBossCycle(21)).toBe(false);
  });

  it("replaces normal threats with a boss schedule on boss cycles", () => {
    const threats = createCycleThreatSchedule(10);

    expect(threats).toHaveLength(3);
    expect(threats.some((wave) => wave.kind === "boss")).toBe(true);
    expect(threats.filter((wave) => wave.kind === "scavenger").length).toBe(2);
  });

  it("offers an epic module reward on boss defeat", () => {
    const state = createRunState(createSaveData(), "execution");
    state.cycle = 10;
    const boss = spawnBoss(10);

    const handled = handleBossDefeat(state, boss);

    expect(handled).toBe(true);
    expect(state.pendingReward?.source).toBe("boss");
    expect(state.pendingReward?.choices[0]).toEqual({ kind: "epic_module", id: "dawn_prism" });
    expect(state.paused).toBe(true);
  });

  it("grants epic modules to the fabrication pool and applies their merge traits", () => {
    const saveData = createSaveData();
    const state = createRunState(saveData, "planning");

    state.pendingReward = {
      source: "boss",
      title: "Boss Defeated",
      description: "Take the epic core.",
      choices: [{ kind: "epic_module", id: "war_forge" }],
    };

    processCommand(state, { type: "choose_reward", rewardKind: "epic_module", rewardId: "war_forge" }, saveData);
    expect(state.ship.epicInventory.war_forge).toBe(1);

    processCommand(state, { type: "select_fabrication_module", moduleId: "war_forge" }, saveData);
    processCommand(state, { type: "board_slot_pressed", slotId: "slot_0_0" }, saveData);

    state.ship.slots.find((slot) => slot.id === "slot_0_1")!.moduleId = "solar_collector";
    state.ship.slots.find((slot) => slot.id === "slot_1_0")!.moduleId = "shield_emitter";
    state.ui.selectedSlotIds = ["slot_0_0", "slot_0_1", "slot_1_0"];

    processCommand(state, { type: "merge_selected" }, saveData);

    expect(state.ship.bots).toHaveLength(1);
    expect(state.ship.bots[0].epicModules).toEqual(["war_forge"]);
    expect(state.ship.bots[0].tags).toContain("boss_breaker");
    expect(state.ship.bots[0].name.startsWith("War ")).toBe(true);
  });
});