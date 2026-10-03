// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { GameController } from "../core/gameController";
import { createDefaultDiscoveryLog } from "../core/discovery";
import { spawnWarship } from "../core/encounters";
import { getReachableNodes } from "../core/sectorMap";
import type { SaveData } from "../types/gameTypes";
import { UIManager } from "./uiManager";

function createSaveData(tutorialCompleted: boolean): SaveData {
  return {
    discovery: createDefaultDiscoveryLog(),
    meta: { totalCyclesCompleted: 4, totalPerfectCommitments: 0, totalArtifactsRecovered: 0 },
    onboarding: { tutorialCompleted },
  };
}

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: height, configurable: true });
}

function mount(tutorialCompleted = true) {
  const root = document.createElement("div");
  root.id = "app";
  document.body.replaceChildren(root);
  const controller = new GameController(createSaveData(tutorialCompleted));
  new UIManager(root, controller);
  const click = (selector: string) => {
    const element = root.querySelector(selector);
    expect(element, `missing ${selector}`).not.toBeNull();
    element!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  };
  return { root, controller, click };
}

function clearDialog(controller: GameController): void {
  for (let guard = 0; controller.getState().story.dialog && guard < 50; guard += 1) {
    const dialog = controller.getState().story.dialog!;
    const atChoice = dialog.index >= dialog.lines.length - 1 && dialog.options;
    controller.dispatch(atChoice ? { type: "choose_dialog", optionIndex: 0 } : { type: "advance_dialog" });
  }
}

function startPlanning(controller: GameController): void {
  controller.dispatch({ type: "start_new_run" });
  clearDialog(controller);
  const state = controller.getState();
  state.resources = { solar: 999, minerals: 999, scrap: 999 };
}

describe("UI renders every phase without breaking", () => {
  beforeEach(() => {
    setViewport(1440, 900);
  });

  it("shows the meta strip on the menu and the full planning layout after starting", () => {
    const { root, controller } = mount();
    expect(root.querySelector(".resource-strip.menu")).not.toBeNull();
    expect(root.querySelector(".menu-card h1")?.textContent).toContain("The Last Good Plan");
    expect(root.dataset.layout).toBe("arena");

    startPlanning(controller);
    expect(root.querySelector(".sector-map .sector-svg")).not.toBeNull();
    expect(root.querySelectorAll(".packet").length).toBeGreaterThanOrEqual(8);
    expect(root.querySelector("[data-action='begin-execution']")?.textContent).toContain("Launch");
    expect(root.querySelector(".side-rail .wave-timeline")).not.toBeNull();
  });

  it("builds through the tray: packet, slot, merge strip, then Create Bot", () => {
    const { root, controller, click } = mount();
    startPlanning(controller);

    click("[data-module='solar_collector']");
    expect(root.querySelector(".packet.selected")?.getAttribute("data-module")).toBe("solar_collector");
    expect(root.querySelector(".tray-details")?.textContent).toContain("solar");

    controller.dispatch({ type: "board_slot_pressed", slotId: "slot_0_0" });
    controller.dispatch({ type: "select_fabrication_module", moduleId: "pulse_cannon" });
    controller.dispatch({ type: "board_slot_pressed", slotId: "slot_0_1" });
    controller.dispatch({ type: "select_fabrication_module", moduleId: "pulse_cannon" });
    controller.dispatch({ type: "board_slot_pressed", slotId: "slot_0_0" });
    controller.dispatch({ type: "board_slot_pressed", slotId: "slot_0_1" });
    expect(root.querySelector(".merge-strip")).not.toBeNull();

    click("[data-action='merge-selected']");
    expect(controller.getState().ship.bots).toHaveLength(1);
    expect(root.querySelector(".merge-strip")).toBeNull();
  });

  it("renders the whole sector and picks the next jump from the map", () => {
    const { root, controller, click } = mount();
    startPlanning(controller);
    const state = controller.getState();
    expect(root.querySelectorAll(".map-node")).toHaveLength(state.sector.columns.flat().length);
    expect(root.querySelectorAll(".map-node.route-boss")).toHaveLength(1);

    const options = getReachableNodes(state);
    const alternative = options[options.length - 1];
    if (options.length > 1) {
      click(`[data-action='choose-node'][data-node='${alternative.id}']`);
    }
    expect(controller.getState().sector.selectedNodeId).toBe(alternative.id);
    expect(controller.getState().simulation.route).toBe(alternative.route);
    expect(root.querySelector(".map-node.selected")?.getAttribute("data-node") ?? alternative.id).toBe(alternative.id);
  });

  it("renders the scoreboard, launch card, lance alarm, and pause veil during battle", () => {
    const { root, controller, click } = mount();
    startPlanning(controller);
    const state = controller.getState();
    controller.dispatch({ type: "select_fabrication_module", moduleId: "pulse_cannon" });
    controller.dispatch({ type: "board_slot_pressed", slotId: "slot_0_0" });
    click("[data-action='begin-execution']");

    expect(root.querySelector(".launch-card")).not.toBeNull();
    expect(root.querySelector(".scoreboard .stat-bar.hull")).not.toBeNull();

    state.simulation.launchCountdown = 0;
    const warship = spawnWarship(3);
    warship.x = warship.holdX!;
    state.simulation.enemies.push(warship);
    state.simulation.barrages.push({
      id: "test-lance",
      sourceId: warship.id,
      name: "Siege Lance",
      fromX: warship.x - 58,
      fromY: warship.y,
      toX: 0,
      toY: warship.y,
      width: 54,
      damage: 10,
      warning: 2,
      timer: 1.5,
      noticed: [],
      evaders: [],
    });
    state.simulation.announcement = { text: "WARSHIP INBOUND", timer: 2 };
    controller.dispatch({ type: "toggle_pause" });

    expect(root.querySelector(".scoreboard .side-label.enemy")?.textContent).toContain(warship.name);
    expect(root.querySelector(".scoreboard .telegraph:not(.soft)")?.textContent).toContain("Siege Lance");
    expect(root.querySelector("#canvas-shell")?.classList.contains("lance-alarm")).toBe(true);
    expect(root.querySelector(".pause-veil")).not.toBeNull();
    expect(root.querySelector(".announcement")?.textContent).toContain("WARSHIP INBOUND");
  });

  it("runs the debrief: stars, MVP, chests that must be opened, then Next mission", () => {
    const { root, controller, click } = mount();
    startPlanning(controller);
    const state = controller.getState();
    state.phase = "results";
    state.summary = {
      title: "Mission complete",
      text: "",
      gains: { solar: 10, minerals: 20, scrap: 30 },
      losses: { botsDestroyed: 0, hullDamage: 0 },
      discoveries: [],
      rewards: [],
      perfectCommitmentReward: { solar: 0, minerals: 0, scrap: 0 },
      stars: [
        { label: "Survived", earned: true },
        { label: "Moon fully mined", earned: true },
        { label: "No bots lost", earned: false },
      ],
      mvp: { name: "Lancer Skiff", role: "defense", color: 0xffb36e, damage: 120, mined: 0, healing: 0, dodges: 2 },
    };
    state.simulation.chests.push({
      source: "boss",
      title: "Boss Defeated",
      description: "Epic core",
      choices: [{ kind: "epic_module", id: "war_forge" }],
    });
    controller.dispatch({ type: "set_dock_panel", panelId: "bots" });

    expect(root.querySelectorAll(".debrief-star.earned")).toHaveLength(2);
    expect(root.querySelector(".mvp-card")?.textContent).toContain("Lancer Skiff");
    expect(root.querySelector("[data-action='continue-results']")?.hasAttribute("disabled")).toBe(true);

    click("[data-action='open-chest']");
    expect(root.querySelector(".chest-open")).not.toBeNull();
    click("[data-action='choose-reward']");

    expect(root.querySelector("[data-action='continue-results']")?.hasAttribute("disabled")).toBe(false);
    click("[data-action='continue-results']");
    expect(controller.getState().phase).toBe("planning");
  });

  it("starts a run from the menu card with Enter", () => {
    const { controller } = mount();
    expect(controller.getState().phase).toBe("menu");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(controller.getState().phase).toBe("planning");
  });

  it("only animates the newest killfeed row, and only while it is new", () => {
    const { root, controller } = mount();
    startPlanning(controller);
    controller.dispatch({ type: "select_fabrication_module", moduleId: "pulse_cannon" });
    controller.dispatch({ type: "board_slot_pressed", slotId: "slot_0_0" });
    controller.dispatch({ type: "begin_execution" });
    const state = controller.getState();
    state.simulation.elapsed = 10;
    state.simulation.killfeed = [
      { killer: "Pulse Cannon", victim: "Dart", color: 0xffffff, time: 9.9 },
      { killer: "Pulse Cannon", victim: "Scavenger", color: 0xffffff, time: 5 },
    ];
    controller.dispatch({ type: "toggle_execution_speed" });
    const rows = root.querySelectorAll("#rail-kills .kill-row");
    expect(rows).toHaveLength(2);
    expect(rows[0].classList.contains("fresh")).toBe(true);
    expect(rows[1].classList.contains("fresh")).toBe(false);

    state.simulation.elapsed = 12;
    controller.dispatch({ type: "toggle_execution_speed" });
    const settledRow = root.querySelector("#rail-kills .kill-row");
    controller.dispatch({ type: "toggle_execution_speed" });
    expect(root.querySelector("#rail-kills .kill-row")).toBe(settledRow);
    expect(settledRow?.classList.contains("fresh")).toBe(false);
  });

  it("drives planning from the keyboard", () => {
    const { controller } = mount();
    startPlanning(controller);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
    expect(controller.getState().ui.selectedFabricationModuleId).toBe("solar_collector");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "w" }));
    expect(controller.getState().doctrine).toBe("extraction_focus");
  });

  it("shows the tutorial bubble and points the ghost hand at the next control", () => {
    const { root, controller } = mount(false);
    clearDialog(controller);
    expect(root.querySelector(".tutorial-bubble")?.textContent).toContain("Build a calm plan");
    controller.dispatch({ type: "advance_tutorial" });
    expect(root.querySelector(".ghost-hand")?.classList.contains("visible")).toBe(true);
    expect(root.querySelector(".tutorial-bubble p")!.textContent!.split(/\s+/).length).toBeLessThanOrEqual(8);
  });
});

describe("story UI", () => {
  beforeEach(() => {
    setViewport(1440, 900);
  });

  it("leads the menu with free play and locks story mode until the first clear", () => {
    const { root, controller, click } = mount();
    controller.getState().campaign.storyUnlocked = false;
    controller.dispatch({ type: "set_dock_panel", panelId: "ship" });
    expect(root.querySelector(".uncharted-locked")?.textContent).toContain("first mission");
    expect(root.querySelector("[data-action='start-campaign']")).toBeNull();

    controller.getState().campaign.storyUnlocked = true;
    controller.dispatch({ type: "set_dock_panel", panelId: "log" });
    expect(root.querySelector(".uncharted-locked")).toBeNull();
    expect(root.querySelector("[data-action='start-campaign']")).not.toBeNull();
    const input = root.querySelector<HTMLInputElement>("#seed-input")!;
    input.value = "abc123";
    click("[data-action='start-roguelike']");
    expect(controller.getState().mode).toBe("roguelike");
    expect(root.querySelector(".resource-pill.seed")?.textContent).toContain("ABC123");
  });

  it("skips story dialog with the Skip button or Esc", () => {
    const { root, controller, click } = mount();
    click("[data-action='start-campaign'][data-fresh='true']");
    click("[data-action='skip-dialog']");
    expect(controller.getState().story.dialog).toBeUndefined();
    expect(root.querySelector(".dialog-card")).toBeNull();

    controller.dispatch({ type: "return_to_menu" });
    controller.dispatch({ type: "start_campaign", fresh: true });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(controller.getState().story.dialog).toBeUndefined();
  });

  it("shows the first-clear tip in the debrief", () => {
    const { root, controller } = mount();
    startPlanning(controller);
    const state = controller.getState();
    state.phase = "results";
    state.summary = {
      title: "Mission complete",
      text: "",
      tip: "You win a mission by surviving until the clock hits zero.",
      gains: { solar: 0, minerals: 0, scrap: 0 },
      losses: { botsDestroyed: 0, hullDamage: 0 },
      discoveries: [],
      rewards: [],
      perfectCommitmentReward: { solar: 0, minerals: 0, scrap: 0 },
      stars: [],
    };
    controller.dispatch({ type: "set_dock_panel", panelId: "ship" });
    expect(root.querySelector(".debrief-tip")?.textContent).toContain("surviving");
  });

  it("plays the intro dialog with click-through lines and choice buttons", () => {
    const { root, controller, click } = mount();
    click("[data-action='start-campaign'][data-fresh='true']");
    expect(root.querySelector(".dialog-card .dialog-speaker")?.textContent).toBe("Governor Brightwater");
    for (let guard = 0; guard < 20 && root.querySelector("[data-action='advance-dialog']"); guard += 1) {
      click("[data-action='advance-dialog']");
    }
    expect(root.querySelectorAll("[data-action='choose-dialog']").length).toBeGreaterThan(1);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "2" }));
    expect(controller.getState().story.choiceTag).toBe("noodle");
    expect(root.querySelector(".dialog-card .dialog-text")?.textContent).toContain("snack drawer");
  });

  it("shows comms and the escort bar during an escort level, and offers a retry on failure", () => {
    const { root, controller, click } = mount();
    click("[data-action='start-campaign'][data-fresh='true']");
    clearDialog(controller);
    const state = controller.getState();
    state.cycle = 3;
    state.sector.path = ["campaign-1", "campaign-2"];
    controller.dispatch({ type: "choose_node", nodeId: "campaign-3" });
    controller.dispatch({ type: "select_fabrication_module", moduleId: "pulse_cannon" });
    controller.dispatch({ type: "board_slot_pressed", slotId: "slot_1_1" });
    controller.dispatch({ type: "begin_execution" });
    const running = controller.getState();
    running.simulation.launchCountdown = 0;
    running.simulation.activeComm = { line: { speaker: "rook", text: "Close. Got it." }, timer: 3 };
    controller.dispatch({ type: "toggle_execution_speed" });
    expect(root.querySelector(".comm-panel")?.textContent).toContain("Close. Got it.");
    expect(root.querySelector(".stat-bar.escort")?.textContent).toContain("Rook");

    running.phase = "run_over";
    running.summary = {
      title: "Escort lost",
      text: "",
      gains: { solar: 0, minerals: 0, scrap: 0 },
      losses: { botsDestroyed: 0, hullDamage: 0 },
      discoveries: [],
      rewards: [],
      perfectCommitmentReward: { solar: 0, minerals: 0, scrap: 0 },
      stars: [],
    };
    controller.dispatch({ type: "toggle_execution_speed" });
    expect(root.querySelector(".debrief h2")?.textContent).toBe("Escort lost");
    click("[data-action='retry-level']");
    expect(controller.getState().phase).toBe("planning");
  });
});

describe("pause menu", () => {
  beforeEach(() => {
    setViewport(1440, 900);
  });

  it("pauses a running mission, resumes on close, and opens the discovery log", () => {
    const { root, controller, click } = mount();
    startPlanning(controller);
    controller.dispatch({ type: "select_fabrication_module", moduleId: "pulse_cannon" });
    controller.dispatch({ type: "board_slot_pressed", slotId: "slot_0_0" });
    controller.dispatch({ type: "begin_execution" });
    expect(controller.getState().phase).toBe("execution");
    expect(controller.getState().paused).toBe(false);

    click(".menu-toggle");
    expect(root.querySelector(".pause-menu h2")?.textContent).toBe("Paused");
    expect(controller.getState().paused).toBe(true);
    click("[data-action='close-menu']");
    expect(root.querySelector(".pause-menu")).toBeNull();
    expect(controller.getState().paused).toBe(false);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(root.querySelector(".pause-menu")).not.toBeNull();
    click("[data-action='open-discoveries']");
    expect(controller.getState().ui.activeDockPanel).toBe("log");
    expect(root.querySelector(".pause-menu")).toBeNull();
  });

  it("asks twice before abandoning a run for the main menu", () => {
    const { root, controller, click } = mount();
    startPlanning(controller);
    click(".menu-toggle");
    click(".pause-menu [data-action='return-to-menu']");
    expect(controller.getState().phase).toBe("planning");
    expect(root.querySelector(".pause-menu [data-action='return-to-menu']")?.textContent).toContain("Tap again");
    click(".pause-menu [data-action='return-to-menu']");
    expect(controller.getState().phase).toBe("menu");
    expect(root.querySelector(".pause-menu")).toBeNull();
  });
});

describe("pocket layout", () => {
  it("uses the pocket layout on portrait phones and opens dock panels as sheets", () => {
    setViewport(375, 812);
    const { root, controller, click } = mount();
    startPlanning(controller);
    expect(root.dataset.layout).toBe("pocket");
    expect(root.querySelector("#rail-waves")?.innerHTML.trim()).toBe("");
    expect(root.querySelectorAll(".dock-button")).toHaveLength(3);
    expect(root.querySelector(".dock-button.menu-button")).not.toBeNull();
    expect(root.querySelector("[data-action='set-dock'][data-panel='log']")).toBeNull();

    click("[data-action='set-dock'][data-panel='bots']");
    expect(root.classList.contains("sheet-open")).toBe(true);
    click("[data-action='close-sheet']");
    expect(root.classList.contains("sheet-open")).toBe(false);
  });
});
