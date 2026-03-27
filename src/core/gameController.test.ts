import { describe, expect, it } from "vitest";
import { GameController } from "./gameController";
import { createDefaultDiscoveryLog } from "./discovery";
import type { SaveData } from "../types/gameTypes";

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

describe("game controller updates", () => {
  it("does not emit timed UI updates while planning", () => {
    const controller = new GameController(createSaveData(false));
    let emissions = 0;

    controller.subscribe(() => {
      emissions += 1;
    });

    controller.update(0.2);
    controller.update(0.2);
    controller.update(0.2);

    expect(controller.getState().phase).toBe("planning");
    expect(emissions).toBe(1);
  });

  it("runs missions at double speed when fast forward is enabled", () => {
    Object.defineProperty(globalThis, "localStorage", {
      value: { setItem: () => undefined },
      configurable: true,
    });
    const controller = new GameController(createSaveData(true));
    controller.dispatch({ type: "start_new_run" });
    const state = controller.getState();
    state.missionPrep.modulesPlacedThisMission = 3;
    state.ship.bots.push({
      id: "bot_stub",
      recipeId: "survey_harrier",
      name: "Survey Harrier",
      role: "mining",
      color: 0xffffff,
      tags: ["solar", "mining"],
      hp: 20,
      maxHp: 20,
      x: 0,
      y: 0,
      speed: 1,
      mining: 1,
      attack: 1,
      support: 0,
      range: 1,
      salvage: 0,
      cooldown: 0,
      contribution: {
        mined: 0,
        damage: 0,
        healing: 0,
        salvage: 0,
      },
    });

    controller.dispatch({ type: "begin_execution" });
    controller.dispatch({ type: "toggle_execution_speed" });
    controller.update(1);

    expect(controller.getState().executionSpeed).toBe(2);
    expect(controller.getState().simulation.elapsed).toBe(2);
  });
});

