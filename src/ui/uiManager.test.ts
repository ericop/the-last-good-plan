// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { GameController } from "../core/gameController";
import { createDefaultDiscoveryLog } from "../core/discovery";
import { spawnWarship } from "../core/encounters";
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
    const element = root.querySelector<HTMLElement>(selector);
    expect(element, `missing ${selector}`).not.toBeNull();
    element!.click();
  };
  return { root, controller, click };
}

function startPlanning(controller: GameController): void {
  controller.dispatch({ type: "start_new_run" });
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
    expect(root.querySelector(".route-picker")).not.toBeNull();
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

  it("switches routes from the sector map cards", () => {
    const { root, controller, click } = mount();
    startPlanning(controller);
    const alternative = controller.getState().routeOptions[1];
    click(`[data-action='choose-route'][data-route='${alternative}']`);
    expect(controller.getState().simulation.route).toBe(alternative);
    expect(root.querySelector(".route-card.selected")?.getAttribute("data-route")).toBe(alternative);
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
    expect(root.querySelector(".scoreboard .telegraph")?.textContent).toContain("Siege Lance");
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
    expect(root.querySelector(".tutorial-bubble")?.textContent).toContain("Build a calm plan");
    controller.dispatch({ type: "advance_tutorial" });
    expect(root.querySelector(".ghost-hand")?.classList.contains("visible")).toBe(true);
    expect(root.querySelector(".tutorial-bubble p")!.textContent!.split(/\s+/).length).toBeLessThanOrEqual(8);
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

    click("[data-action='set-dock'][data-panel='bots']");
    expect(root.classList.contains("sheet-open")).toBe(true);
    click("[data-action='close-sheet']");
    expect(root.classList.contains("sheet-open")).toBe(false);
  });
});
