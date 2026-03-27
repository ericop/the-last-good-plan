import { describe, expect, it } from "vitest";
import { createDefaultDiscoveryLog } from "./discovery";
import { createRunState } from "./createRunState";
import { processCommand } from "./processCommand";
import { captureTutorialSnapshot, getMissionReadiness, updateTutorialAfterCommand } from "./tutorial";
import type { GameCommand } from "../types/commands";
import type { RunState, SaveData } from "../types/gameTypes";

function createSaveData(tutorialCompleted = false): SaveData {
  return {
    discovery: createDefaultDiscoveryLog(),
    meta: {
      totalCyclesCompleted: 0,
      totalPerfectCommitments: 0,
      totalArtifactsRecovered: 0,
    },
    onboarding: {
      tutorialCompleted,
    },
  };
}

function createBotStub() {
  return {
    id: "bot_stub",
    recipeId: "survey_harrier",
    name: "Survey Harrier",
    role: "mining" as const,
    color: 0xffffff,
    tags: ["survey"],
    hp: 24,
    maxHp: 24,
    x: 0,
    y: 0,
    speed: 60,
    mining: 4,
    attack: 1,
    support: 0,
    range: 60,
    salvage: 1,
    cooldown: 0,
    contribution: {
      mined: 0,
      damage: 0,
      healing: 0,
      salvage: 0,
    },
  };
}

function runTutorialCommand(state: RunState, saveData: SaveData, command: GameCommand): RunState {
  const before = captureTutorialSnapshot(state);
  const nextState = processCommand(state, command, saveData);
  updateTutorialAfterCommand(nextState, before, command);
  return nextState;
}

describe("tutorial onboarding flow", () => {
  it("starts tutorial automatically for a brand new save", () => {
    const state = createRunState(createSaveData(false), "planning");
    expect(state.tutorial.active).toBe(true);
    expect(state.tutorial.stepId).toBe("intro");
  });

  it("requires three placed modules and one bot before first mission", () => {
    const state = createRunState(createSaveData(false), "planning");
    expect(getMissionReadiness(state)).toEqual({
      ready: false,
      reason: "Place 3 modules and create 1 bot",
    });

    state.missionPrep.modulesPlacedThisMission = 3;
    state.ship.bots.push(createBotStub());

    expect(getMissionReadiness(state)).toEqual({
      ready: true,
      reason: "Ready to run.",
    });
  });

  it("advances from doctrine selection even when balanced was already selected", () => {
    const state = createRunState(createSaveData(false), "planning");
    state.tutorial.stepId = "select_doctrine";
    const before = captureTutorialSnapshot(state);

    updateTutorialAfterCommand(state, before, {
      type: "set_doctrine",
      doctrineId: "balanced",
    });

    expect(state.tutorial.stepId).toBe("start_mission");
  });

  it("guides a fresh run from intro through mission start", () => {
    const saveData = createSaveData(false);
    let state = createRunState(saveData, "planning");

    state = runTutorialCommand(state, saveData, { type: "advance_tutorial" });
    expect(state.tutorial.stepId).toBe("place_solar_collector");

    state = runTutorialCommand(state, saveData, { type: "select_fabrication_module", moduleId: "solar_collector" });
    state = runTutorialCommand(state, saveData, { type: "board_slot_pressed", slotId: "slot_1_1" });
    expect(state.tutorial.stepId).toBe("place_mineral_drill");

    state = runTutorialCommand(state, saveData, { type: "select_fabrication_module", moduleId: "mineral_drill" });
    state = runTutorialCommand(state, saveData, { type: "board_slot_pressed", slotId: "slot_1_2" });
    expect(state.tutorial.stepId).toBe("place_third_module");

    state = runTutorialCommand(state, saveData, { type: "select_fabrication_module", moduleId: "cargo_core" });
    state = runTutorialCommand(state, saveData, { type: "board_slot_pressed", slotId: "slot_0_0" });
    expect(state.tutorial.stepId).toBe("merge_bot");

    state = runTutorialCommand(state, saveData, { type: "board_slot_pressed", slotId: "slot_1_1" });
    state = runTutorialCommand(state, saveData, { type: "board_slot_pressed", slotId: "slot_1_2" });
    state = runTutorialCommand(state, saveData, { type: "merge_selected" });
    expect(state.tutorial.stepId).toBe("bots_explain");
    expect(state.ship.bots).toHaveLength(1);

    state = runTutorialCommand(state, saveData, { type: "advance_tutorial" });
    state = runTutorialCommand(state, saveData, { type: "set_doctrine", doctrineId: "balanced" });
    expect(state.tutorial.stepId).toBe("start_mission");

    state = runTutorialCommand(state, saveData, { type: "begin_execution" });
    expect(state.phase).toBe("execution");
    expect(state.tutorial.stepId).toBe("mission_running");
  });
});
