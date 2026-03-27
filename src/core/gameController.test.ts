import { describe, expect, it } from "vitest";
import { GameController } from "./gameController";
import { createRunState } from "./createRunState";
import { stepSimulation } from "./simulation";
import { pickRewardChoices } from "./utils";
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

  it("always offers a capacity artifact from moon rewards while bot capacity is below six", () => {
    const controller = new GameController(createSaveData(true));
    const state = controller.getState();

    const moonChoices = pickRewardChoices(state, "moon");
    expect(moonChoices.some((artifact) => artifact.id === "spare_bays")).toBe(true);

    state.ship.artifacts.push("spare_bays");
    const fallbackChoices = pickRewardChoices(state, "moon");
    expect(fallbackChoices.some((artifact) => artifact.id === "quiet_hangars")).toBe(true);

    state.ship.artifacts.push("quiet_hangars");
    const cappedChoices = pickRewardChoices(state, "moon");
    expect(cappedChoices.some((artifact) => artifact.id === "spare_bays" || artifact.id === "quiet_hangars")).toBe(false);
  });

  it("adds 10 seconds after the mini-boss is defeated", () => {
    const state = createRunState(createSaveData(true), "execution");
    state.tutorial.active = false;
    state.ship.bots = [
      {
        id: "bot_boss_test",
        recipeId: "survey_harrier",
        name: "Survey Harrier",
        role: "defense",
        color: 0xffffff,
        tags: ["defense"],
        hp: 20,
        maxHp: 20,
        x: 300,
        y: 300,
        speed: 1,
        mining: 0,
        attack: 500,
        support: 0,
        range: 200,
        salvage: 0,
        cooldown: 0,
        contribution: {
          mined: 0,
          damage: 0,
          healing: 0,
          salvage: 0,
        },
      },
    ];
    state.simulation.enemies = [
      {
        id: "boss_test",
        kind: "mini_boss",
        name: "Grave Knocker",
        color: 0xffc266,
        hp: 1,
        maxHp: 1,
        x: 300,
        y: 300,
        speed: 0,
        attack: 0,
        range: 0,
        scrapReward: 0,
        cooldown: 0,
      },
    ];

    const startingDuration = state.simulation.duration;
    stepSimulation(state, 1);

    expect(state.simulation.bossDefeated).toBe(true);
    expect(state.simulation.duration).toBe(startingDuration + 10);
    expect(state.pendingReward?.source).toBe("boss");
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



