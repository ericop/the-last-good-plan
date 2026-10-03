import { describe, expect, it } from "vitest";
import { CAMPAIGN_LEVELS, coreGiftLines, SPEAKERS, UNCHARTED_BULLETINS } from "../data/story";
import { WARSHIP_DEFINITIONS } from "../data/warships";
import { GameController } from "./gameController";
import { createRunState } from "./createRunState";
import { createDefaultDiscoveryLog } from "./discovery";
import { processCommand } from "./processCommand";
import { generateSectorMap } from "./sectorMap";
import { stepSimulation } from "./simulation";
import { armMissionStory, captureCheckpoint, formatSeed, parseSeed } from "./story";
import type { DialogLine, ModuleId, RunState, SaveData } from "../types/gameTypes";

function createSaveData(overrides: Partial<SaveData> = {}): SaveData {
  return {
    discovery: createDefaultDiscoveryLog(),
    meta: { totalCyclesCompleted: 3, totalPerfectCommitments: 0, totalArtifactsRecovered: 0 },
    onboarding: { tutorialCompleted: true },
    ...overrides,
  };
}

function clearDialog(state: RunState, saveData: SaveData, option = 0): void {
  for (let guard = 0; state.story.dialog && guard < 60; guard += 1) {
    const dialog = state.story.dialog;
    const atChoice = dialog.index >= dialog.lines.length - 1 && dialog.options;
    processCommand(state, atChoice ? { type: "choose_dialog", optionIndex: option } : { type: "advance_dialog" }, saveData);
  }
}

function buildSturdyShip(state: RunState, saveData: SaveData): void {
  state.resources = { solar: 999, minerals: 999, scrap: 999 };
  state.ship.upgrades.support_bay = 2;
  const merge = (modules: ModuleId[]) => {
    const ids = ["slot_2_0", "slot_2_1"];
    modules.forEach((moduleId, index) => {
      state.ship.slots.find((slot) => slot.id === ids[index])!.moduleId = moduleId;
    });
    state.ui.selectedSlotIds = ids;
    processCommand(state, { type: "merge_selected" }, saveData);
  };
  merge(["solar_collector", "pulse_cannon"]);
  merge(["booster", "pulse_cannon"]);
  const layout: Record<string, ModuleId> = { slot_0_0: "pulse_cannon", slot_0_1: "shield_emitter", slot_0_2: "pulse_cannon", slot_1_1: "repair_node" };
  for (const [slotId, moduleId] of Object.entries(layout)) {
    state.ship.slots.find((slot) => slot.id === slotId)!.moduleId = moduleId;
  }
  state.missionPrep.modulesPlacedThisMission = 4;
}

function launch(state: RunState, saveData: SaveData): void {
  processCommand(state, { type: "begin_execution" }, saveData);
  state.simulation.launchCountdown = 0;
}

function step(state: RunState, seconds: number): void {
  for (let elapsed = 0; elapsed < seconds && state.phase === "execution"; elapsed += 0.05) {
    stepSimulation(state, 0.05);
  }
}

function jumpToLevel(state: RunState, level: number): void {
  state.cycle = level;
  state.sector.path = CAMPAIGN_LEVELS.slice(0, level - 1).map((entry) => `campaign-${entry.number}`);
  processCommand(state, { type: "choose_node", nodeId: `campaign-${level}` }, createSaveData());
}

describe("campaign script", () => {
  const allLines = (): DialogLine[] =>
    CAMPAIGN_LEVELS.flatMap((level) => [
      ...level.intro.lines,
      ...(level.intro.after ?? []),
      ...(level.intro.choice?.options.flatMap((option) => option.reply) ?? []),
      ...level.outro,
      ...level.events.flatMap((event) => [...(event.lines ?? []), ...Object.values(event.byTag ?? {}).flat()]),
    ]).concat(UNCHARTED_BULLETINS.flat(), coreGiftLines("Dawn Prism"));

  it("has ten levels that end in the boss, with authored duels, escorts, and rescues", () => {
    expect(CAMPAIGN_LEVELS.map((level) => level.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(CAMPAIGN_LEVELS[9].route).toBe("boss");
    for (const level of CAMPAIGN_LEVELS.filter((entry) => entry.route === "duel")) {
      expect(WARSHIP_DEFINITIONS.some((warship) => warship.id === level.warshipId)).toBe(true);
    }
    expect(CAMPAIGN_LEVELS.filter((level) => level.hero).map((level) => level.number)).toEqual([3, 6, 9]);
    expect(CAMPAIGN_LEVELS.filter((level) => level.rescue).map((level) => level.number)).toEqual([5, 8, 10]);
  });

  it("only branches dialog on tags the level's choices can produce", () => {
    for (const level of CAMPAIGN_LEVELS) {
      const tags = new Set(level.intro.choice?.options.map((option) => option.tag) ?? []);
      for (const event of level.events) {
        for (const tag of Object.keys(event.byTag ?? {})) {
          expect(tags.has(tag), `level ${level.number} event ${event.id} tag ${tag}`).toBe(true);
        }
      }
    }
  });

  it("uses known speakers, non-empty lines, and no em dashes", () => {
    for (const line of allLines()) {
      expect(SPEAKERS[line.speaker]).toBeDefined();
      expect(line.text.trim().length).toBeGreaterThan(0);
      expect(line.text).not.toContain("—");
    }
  });
});

describe("campaign dialog", () => {
  it("opens level 1 with an intro, waits on the choice, then plays the chosen reply", () => {
    const saveData = createSaveData();
    const state = createRunState(saveData, "planning", { mode: "campaign" });
    const intro = CAMPAIGN_LEVELS[0].intro;
    expect(state.story.dialog?.lines[0]).toEqual(intro.lines[0]);

    for (let index = 0; index < intro.lines.length - 1; index += 1) {
      processCommand(state, { type: "advance_dialog" }, saveData);
    }
    processCommand(state, { type: "advance_dialog" }, saveData);
    expect(state.story.dialog?.index).toBe(intro.lines.length - 1);

    processCommand(state, { type: "choose_dialog", optionIndex: 1 }, saveData);
    expect(state.story.choiceTag).toBe("noodle");
    expect(state.story.dialog?.lines).toEqual(intro.choice!.options[1].reply);
    clearDialog(state, saveData);
    expect(state.story.dialog).toBeUndefined();
  });

  it("names the encounter after the level and uses the authored warship", () => {
    const saveData = createSaveData();
    const state = createRunState(saveData, "planning", { mode: "campaign" });
    jumpToLevel(state, 8);
    expect(state.simulation.encounterName).toBe("Level 8: Courtesy Patrol");
    expect(state.simulation.upcomingThreats.find((wave) => wave.kind === "warship")?.warshipId).toBe("ion_cutter");
    expect(state.simulation.upcomingThreats.some((wave) => wave.label.startsWith("Courteous"))).toBe(true);
  });

  it("plays timed comms, picking the line for the dialog choice", () => {
    const saveData = createSaveData();
    const state = createRunState(saveData, "planning", { mode: "campaign" });
    clearDialog(state, saveData);
    jumpToLevel(state, 2);
    state.story.choiceTag = "shop";
    buildSturdyShip(state, saveData);
    launch(state, saveData);
    const heard: string[] = [];
    for (let elapsed = 0; elapsed < 30 && state.phase === "execution"; elapsed += 0.05) {
      stepSimulation(state, 0.05);
      const text = state.simulation.activeComm?.line.text;
      if (text && heard[heard.length - 1] !== text) {
        heard.push(text);
      }
    }
    expect(heard.some((text) => text.includes("snow globe"))).toBe(true);
    expect(heard.some((text) => text.includes("Middle of the lane"))).toBe(false);
  });
});

describe("escorts, retries, and rescues", () => {
  it("fails the level when the escort goes down, then retries from the level checkpoint", () => {
    const saveData = createSaveData();
    const state = createRunState(saveData, "planning", { mode: "campaign" });
    clearDialog(state, saveData);
    buildSturdyShip(state, saveData);
    jumpToLevel(state, 3);
    captureCheckpoint(state);
    launch(state, saveData);

    const hero = state.simulation.fighters.find((fighter) => fighter.hero);
    expect(hero?.hero?.name).toBe("Rook");
    hero!.hp = 0;
    step(state, 0.1);
    expect(state.phase).toBe("run_over");
    expect(state.summary?.title).toBe("Escort lost");

    const retried = processCommand(state, { type: "retry_level" }, saveData);
    expect(retried.phase).toBe("planning");
    expect(retried.cycle).toBe(3);
    expect(retried.ship.bots.length).toBe(state.ship.bots.length);
  });

  it("sends good neighbors when the ship is in mortal danger", () => {
    const saveData = createSaveData();
    const state = createRunState(saveData, "planning", { mode: "campaign" });
    clearDialog(state, saveData);
    jumpToLevel(state, 5);
    buildSturdyShip(state, saveData);
    launch(state, saveData);
    expect(state.simulation.rescueArmed).toBeDefined();

    step(state, 18.5);
    state.ship.hull = state.ship.maxHull * 0.2;
    step(state, 0.2);
    expect(state.simulation.rescue).toBeDefined();
    expect(state.simulation.enemies.every((enemy) => enemy.holdX !== undefined)).toBe(true);
    expect(state.ship.hull).toBeGreaterThan(state.ship.maxHull * 0.5);
    expect(state.simulation.announcement?.text).toBe("GOOD NEIGHBORS ARRIVE");
  });

  it("still sends the neighbors at the fallback time if the ship is doing fine", () => {
    const saveData = createSaveData();
    const state = createRunState(saveData, "planning", { mode: "campaign" });
    clearDialog(state, saveData);
    jumpToLevel(state, 5);
    buildSturdyShip(state, saveData);
    launch(state, saveData);
    state.ship.maxHull = 5000;
    state.ship.hull = 5000;
    step(state, 33);
    expect(state.simulation.rescueArmed).toBeUndefined();
    expect(state.simulation.storyFired).toContain("l5-shields");
  });
});

describe("campaign completion and the uncharted roguelike", () => {
  it("plays the whole campaign, unlocks Uncharted, and returns to the menu", () => {
    const saveData = createSaveData();
    let state = createRunState(saveData, "planning", { mode: "campaign" });
    buildSturdyShip(state, saveData);
    for (let level = 1; level <= CAMPAIGN_LEVELS.length; level += 1) {
      clearDialog(state, saveData, level % 2);
      expect(state.cycle).toBe(level);
      state.resources = { solar: 999, minerals: 999, scrap: 999 };
      launch(state, saveData);
      state.ship.maxHull = 50000;
      state.ship.hull = 50000;
      for (const fighter of state.simulation.fighters.filter((candidate) => candidate.hero)) {
        fighter.maxHp = 50000;
        fighter.hp = 50000;
      }
      step(state, 240);
      expect(state.phase, `level ${level}`).toBe("results");
      expect(state.campaign.highestLevelCleared).toBe(level);
      clearDialog(state, saveData);
      while (state.simulation.chests.length > 0 || state.pendingReward) {
        if (!state.pendingReward) {
          processCommand(state, { type: "open_chest" }, saveData);
        }
        const choice = state.pendingReward!.choices[0];
        processCommand(state, { type: "choose_reward", rewardKind: choice.kind, rewardId: choice.id }, saveData);
      }
      state = processCommand(state, { type: "continue_from_results" }, saveData);
    }
    expect(state.phase).toBe("menu");
    expect(state.campaign.storyUnlocked).toBe(true);

    const uncharted = processCommand(state, { type: "start_roguelike", seed: "LANTRN" }, saveData);
    expect(uncharted.mode).toBe("roguelike");
    expect(uncharted.sector.seed).toBe(parseSeed("LANTRN"));
    expect(uncharted.ship.epicInventory.dawn_prism).toBe(1);
    expect(uncharted.story.dialog?.lines[0].text).toContain("Dawn Prism");
    expect(uncharted.campaign.coreGift).toBeUndefined();

    const nextRun = processCommand(uncharted, { type: "start_new_run" }, saveData);
    expect(nextRun.ship.epicInventory.dawn_prism).toBe(0);
    expect(nextRun.story.dialog).toBeUndefined();
  });

  it("starts in free play and unlocks story mode after the first cleared mission", () => {
    const saveData = createSaveData({ meta: { totalCyclesCompleted: 0, totalPerfectCommitments: 0, totalArtifactsRecovered: 0 } });
    const menu = createRunState(saveData, "menu");
    expect(menu.campaign.storyUnlocked).toBe(false);
    expect(processCommand(menu, { type: "start_campaign", fresh: true }, saveData)).toBe(menu);

    const state = processCommand(menu, { type: "start_roguelike" }, saveData);
    expect(state.mode).toBe("roguelike");
    expect(state.story.dialog).toBeUndefined();
    buildSturdyShip(state, saveData);
    launch(state, saveData);
    state.ship.maxHull = 5000;
    state.ship.hull = 5000;
    step(state, 240);
    expect(state.phase).toBe("results");
    expect(state.summary?.tip).toContain("surviving");
    expect(state.campaign.storyUnlocked).toBe(true);
  });

  it("skips the rest of a dialog in one command", () => {
    const saveData = createSaveData();
    const state = createRunState(saveData, "planning", { mode: "campaign" });
    expect(state.story.dialog).toBeDefined();
    processCommand(state, { type: "skip_dialog" }, saveData);
    expect(state.story.dialog).toBeUndefined();
  });

  it("round-trips seed codes and builds the same maps from the same seed", () => {
    expect(formatSeed(parseSeed("A1B2C3")!)).toBe("A1B2C3");
    expect(parseSeed("  lantrn ")).toBe(parseSeed("LANTRN"));
    expect(parseSeed("the lantern reach")).toBe(parseSeed("THE LANTERN REACH"));
    expect(parseSeed("")).toBeUndefined();
    const saveData = createSaveData({ campaign: { highestLevelCleared: 10, storyUnlocked: true } });
    const first = createRunState(saveData, "planning", { mode: "roguelike", seed: parseSeed("SEED42") });
    const second = createRunState(saveData, "planning", { mode: "roguelike", seed: parseSeed("SEED42") });
    expect(first.sector).toEqual(second.sector);
    expect(first.sector).toEqual({ ...generateSectorMap(0, parseSeed("SEED42")!, false), selectedNodeId: first.sector.selectedNodeId });
  });

  it("rolls seeded Governor bulletins and rescues in Uncharted runs", () => {
    const saveData = createSaveData({ campaign: { highestLevelCleared: 10, storyUnlocked: true } });
    const rolls = (seed: string) =>
      Array.from({ length: 20 }, (_, index) => {
        const state = createRunState(saveData, "planning", { mode: "roguelike", seed: parseSeed(seed) });
        state.cycle = index + 1;
        armMissionStory(state);
        return `${state.simulation.storyEvents.length}:${state.simulation.rescueArmed?.species ?? "-"}`;
      });
    expect(rolls("ABC123")).toEqual(rolls("ABC123"));
    expect(rolls("ABC123").some((entry) => entry.startsWith("1"))).toBe(true);
    expect(rolls("ABC123").some((entry) => !entry.endsWith("-"))).toBe(true);
  });

  it("saves a checkpoint so Continue resumes the current level", () => {
    Object.defineProperty(globalThis, "localStorage", { value: { setItem: () => undefined }, configurable: true });
    const saveData = createSaveData();
    const controller = new GameController(saveData);
    controller.dispatch({ type: "start_campaign", fresh: true });
    const state = controller.getState();
    jumpToLevel(state, 4);
    processCommand(state, { type: "return_to_menu" }, saveData);
    expect(saveData.campaign?.checkpoint).toBeTruthy();

    controller.dispatch({ type: "return_to_menu" });
    controller.dispatch({ type: "start_campaign", fresh: false });
    expect(controller.getState().phase).toBe("planning");
    expect(controller.getState().mode).toBe("campaign");
  });
});
