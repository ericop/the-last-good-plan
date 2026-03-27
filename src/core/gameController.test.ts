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
});
