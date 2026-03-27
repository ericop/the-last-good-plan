import { describe, expect, it } from "vitest";
import { MERGE_RECIPES } from "../data/merges";
import { createRunState } from "./createRunState";
import { createDefaultDiscoveryLog, getMergePreviewFromModules } from "./discovery";
import { processCommand } from "./processCommand";
import { findRecipeByModules } from "./utils";
import type { ModuleId, SaveData } from "../types/gameTypes";

const MODULE_IDS: ModuleId[] = [
  "solar_collector",
  "mineral_drill",
  "shield_emitter",
  "pulse_cannon",
  "cargo_core",
  "repair_node",
];

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

function getValidPairs(): ModuleId[][] {
  const pairs: ModuleId[][] = [];
  for (let left = 0; left < MODULE_IDS.length; left += 1) {
    for (let right = left + 1; right < MODULE_IDS.length; right += 1) {
      pairs.push([MODULE_IDS[left], MODULE_IDS[right]]);
    }
  }
  return pairs;
}

function getValidTriples(): ModuleId[][] {
  const triples: ModuleId[][] = [];
  for (let first = 0; first < MODULE_IDS.length; first += 1) {
    for (let second = first + 1; second < MODULE_IDS.length; second += 1) {
      for (let third = second + 1; third < MODULE_IDS.length; third += 1) {
        triples.push([MODULE_IDS[first], MODULE_IDS[second], MODULE_IDS[third]]);
      }
    }
  }
  for (const repeated of MODULE_IDS) {
    for (const other of MODULE_IDS) {
      if (other !== repeated) {
        triples.push([repeated, repeated, other]);
      }
    }
  }
  return triples;
}

describe("expanded merge system", () => {
  it("covers every valid recipe with unique ids and names", () => {
    expect(MERGE_RECIPES).toHaveLength(65);
    expect(new Set(MERGE_RECIPES.map((recipe) => recipe.id)).size).toBe(MERGE_RECIPES.length);
    expect(new Set(MERGE_RECIPES.map((recipe) => recipe.resultName)).size).toBe(MERGE_RECIPES.length);

    MERGE_RECIPES.forEach((recipe) => {
      expect(recipe.hint.length).toBeGreaterThan(10);
      expect(recipe.summary.length).toBeGreaterThan(10);
      expect(recipe.masteryNote.length).toBeGreaterThan(10);
      expect(recipe.modules.length === 2 || recipe.modules.length === 3).toBe(true);
    });
  });

  it("resolves every valid mixed 2-module merge and rejects identical pairs", () => {
    const discovery = createDefaultDiscoveryLog();

    getValidPairs().forEach((modules) => {
      const recipe = findRecipeByModules(modules);
      expect(recipe, modules.join(" + ")).toBeDefined();
      const preview = getMergePreviewFromModules(modules, discovery);
      expect(preview.recipe?.id).toBe(recipe?.id);
    });

    MODULE_IDS.forEach((moduleId) => {
      expect(findRecipeByModules([moduleId, moduleId])).toBeUndefined();
    });
  });

  it("resolves every valid 3-module merge and rejects triple identical", () => {
    const discovery = createDefaultDiscoveryLog();

    getValidTriples().forEach((modules) => {
      const recipe = findRecipeByModules(modules);
      expect(recipe, modules.join(" + ")).toBeDefined();
      const preview = getMergePreviewFromModules(modules, discovery);
      expect(preview.recipe?.id).toBe(recipe?.id);
    });

    MODULE_IDS.forEach((moduleId) => {
      expect(findRecipeByModules([moduleId, moduleId, moduleId])).toBeUndefined();
    });
  });

  it("creates a discovered bot from a connected triple merge and records it", () => {
    const saveData = createSaveData();
    const state = createRunState(saveData, "planning");
    const slotA = state.ship.slots.find((slot) => slot.id === "slot_0_0")!;
    const slotB = state.ship.slots.find((slot) => slot.id === "slot_0_1")!;
    const slotC = state.ship.slots.find((slot) => slot.id === "slot_1_0")!;

    slotA.moduleId = "solar_collector";
    slotB.moduleId = "shield_emitter";
    slotC.moduleId = "repair_node";
    state.ui.selectedSlotIds = [slotA.id, slotB.id, slotC.id];

    const recipe = findRecipeByModules([slotA.moduleId, slotB.moduleId, slotC.moduleId]);
    expect(recipe).toBeDefined();
    expect(state.discovery[recipe!.id].state).toBe("unknown");

    processCommand(state, { type: "merge_selected" }, saveData);

    expect(state.ship.bots).toHaveLength(1);
    expect(state.ship.bots[0].recipeId).toBe(recipe!.id);
    expect(slotA.moduleId).toBeUndefined();
    expect(slotB.moduleId).toBeUndefined();
    expect(slotC.moduleId).toBeUndefined();
    expect(state.discovery[recipe!.id].state).toBe("discovered");
  });
});
