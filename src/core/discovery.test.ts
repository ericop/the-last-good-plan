import { describe, expect, it } from "vitest";
import { createDefaultDiscoveryLog, getMergePreviewFromModules, noteRecipeSuccess, noteRecipeUse } from "./discovery";
import { createThreatSchedule } from "../data/waves";
import { findRecipeByModules } from "./utils";

describe("merge discovery logic", () => {
  it("finds recipes regardless of module order", () => {
    const recipe = findRecipeByModules(["pulse_cannon", "shield_emitter"]);
    expect(recipe?.id).toBe("bastion_warden");
  });

  it("promotes discovery state from unknown to discovered to known/mastered-lite", () => {
    const discovery = createDefaultDiscoveryLog();
    const unknownPreview = getMergePreviewFromModules(["solar_collector", "mineral_drill"], discovery);
    expect(unknownPreview.recipe?.id).toBe("survey_harrier");
    expect(unknownPreview.text).toContain("extractor");

    noteRecipeUse(discovery, "survey_harrier");
    expect(discovery.survey_harrier.state).toBe("discovered");

    noteRecipeSuccess(discovery, "survey_harrier");
    expect(discovery.survey_harrier.state).toBe("known_mastered_lite");
  });
});

describe("threat scheduling", () => {
  it("creates predictable waves ending in the mini-boss", () => {
    const schedule = createThreatSchedule(2);
    expect(schedule).toHaveLength(4);
    expect(schedule[0]).toMatchObject({ time: 6, kind: "scavenger", count: 4 });
    expect(schedule[3]).toMatchObject({ time: 36, kind: "mini_boss", count: 1 });
  });
});
