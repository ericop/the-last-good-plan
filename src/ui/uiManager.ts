import { getBossForCycle } from "../core/bossManager";
import { DOCTRINES } from "../data/doctrines";
import { getEpicModuleById, getFabricationCardData, getSlotModulePresentation } from "../data/epicModuleRegistry";
import { MERGE_RECIPES } from "../data/merges";
import { MODULE_DEFINITIONS } from "../data/modules";
import { UPGRADE_DEFINITIONS } from "../data/upgrades";
import type { GameController } from "../core/gameController";
import { getDiscoveryDescriptor, getMergePreviewFromModules } from "../core/discovery";
import { getWarshipForCycle, ROUTES } from "../core/encounters";
import { isLaunchPortUnlocked } from "../core/hangar";
import { getMissionReadiness, getPhaseLabel, getTutorialHandTarget, getTutorialStepView } from "../core/tutorial";
import { canAfford, getArtifactById, getBotCapacity, getBotDodge, getSlotById } from "../core/utils";
import type {
  Cost,
  DockPanelId,
  FabricationOptionId,
  ModuleId,
  ResourcePool,
  RouteId,
  RunState,
  ShipWeaponDefinition,
  UpgradeId,
} from "../types/gameTypes";
import { getPortLoadout } from "../core/hangar";
import { applyButtonHoverEffect, applyPanelGlow, pulseCounter } from "./effects";
import { haptic, isMuted, playSound, toggleMuted, unlockAudio } from "./feedback";
import { getLayoutMode, type LayoutMode } from "./layoutMode";

type ResourceId = keyof ResourcePool;
type SectionId =
  | "hud"
  | "header"
  | "overlay"
  | "tray"
  | "dockNav"
  | "dockPanel"
  | "missionBar"
  | "modal"
  | "railWaves"
  | "railKills";

const DOCK_ITEMS: Array<{ id: DockPanelId; label: string; pocket: boolean }> = [
  { id: "ship", label: "Ship", pocket: true },
  { id: "build", label: "Codex", pocket: false },
  { id: "bots", label: "Fleet", pocket: true },
  { id: "doctrine", label: "Doctrine", pocket: false },
  { id: "log", label: "Log", pocket: true },
];

const DOCTRINE_HOTKEYS: Record<string, RunState["doctrine"]> = { q: "balanced", w: "extraction_focus", e: "preservation_mode" };

const TRAY_LABELS: Record<ModuleId, string> = {
  solar_collector: "Solar",
  mineral_drill: "Drill",
  shield_emitter: "Shield",
  pulse_cannon: "Cannon",
  cargo_core: "Cargo",
  repair_node: "Repair",
  booster: "Booster",
  launch_port: "Port",
};

const RESOURCE_IDS: ResourceId[] = ["solar", "minerals", "scrap"];
const HULL_HIT_FLASH_MS = 350;
const DELTA_FLUSH_MS = 450;
const COUNT_UP_MS = 900;

const ICONS: Record<string, string> = {
  solar: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></g></svg>`,
  minerals: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 20 9l-8 13L4 9z" fill="currentColor"/><path d="M4 9h16M12 2l-3 7 3 13 3-13z" stroke="rgba(0,0,0,.35)" stroke-width="1.2" fill="none"/></svg>`,
  scrap: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 2h3.4l.5 2.6 2.2.9 2.2-1.5 2.4 2.4-1.5 2.2.9 2.2 2.6.5v3.4l-2.6.5-.9 2.2 1.5 2.2-2.4 2.4-2.2-1.5-2.2.9-.5 2.6h-3.4l-.5-2.6-2.2-.9-2.2 1.5-2.4-2.4 1.5-2.2-.9-2.2-2.6-.5v-3.4l2.6-.5.9-2.2-1.5-2.2 2.4-2.4 2.2 1.5 2.2-.9z" fill="currentColor"/><circle cx="12" cy="12" r="3.4" fill="#0b1720"/></svg>`,
  star: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8 5.7 21.4l1.5-7.1L1.8 9.4 9 8.6z" fill="currentColor"/></svg>`,
  chest: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h18v10H3z" fill="currentColor"/><path d="M3 10a9 5 0 0 1 18 0z" fill="currentColor" opacity=".8"/><path d="M3 12.5h18" stroke="#0b1720" stroke-width="1.4"/><rect x="10.5" y="11" width="3" height="4" rx=".8" fill="#0b1720"/></svg>`,
  sound_on: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
  sound_off: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor"/><path d="m16 9 6 6m0-6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/></svg>`,
  play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8z" fill="currentColor"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="2" fill="none"/></svg>`,
  hand: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V10l.2-1.8a1.5 1.5 0 0 1 3 .3V11l.2-.9a1.4 1.4 0 0 1 2.8.5v4.6c0 3.6-2.6 6.3-6.1 6.3-2.6 0-4.1-1.1-5.4-3.2L4.3 14a1.5 1.5 0 0 1 2.5-1.6L9 15z" fill="#fff" stroke="#0b1720" stroke-width="1.2"/></svg>`,
};

const ROUTE_SILHOUETTES: Record<RouteId, string> = {
  swarm: `<svg viewBox="0 0 48 32" aria-hidden="true"><path d="M8 8l8-4v8zM20 18l8-4v8zM32 10l8-4v8zM14 26l8-4v8z" fill="currentColor"/></svg>`,
  duel: `<svg viewBox="0 0 48 32" aria-hidden="true"><path d="M4 16 14 7h24l6 6v6l-6 6H14z" fill="currentColor"/><rect x="18" y="13" width="14" height="6" fill="#0b1720"/></svg>`,
  boss: `<svg viewBox="0 0 48 32" aria-hidden="true"><path d="M2 16 12 5h26l8 8v6l-8 8H12z" fill="currentColor"/><path d="M14 5l3-4 3 4M26 5l3-4 3 4" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="24" cy="16" r="4" fill="#0b1720"/></svg>`,
  nebula: `<svg viewBox="0 0 48 32" aria-hidden="true"><path d="M10 22a7 7 0 0 1 3-13 9 9 0 0 1 17-1 7 7 0 0 1 8 7 6 6 0 0 1-2 11H14a6 6 0 0 1-4-4z" fill="currentColor"/><path d="M18 18q6-6 12 0" stroke="#0b1720" stroke-width="2" fill="none"/></svg>`,
  derelict: `<svg viewBox="0 0 48 32" aria-hidden="true"><path d="M4 18 12 9h10l-3 5 4 3-3 6H12z" fill="currentColor"/><path d="M27 9h11l6 6-3 3 3 2-6 4H28l3-6-4-3z" fill="currentColor" opacity=".7"/></svg>`,
};

function icon(name: keyof typeof ICONS, className = ""): string {
  return `<span class="icon ${className}">${ICONS[name]}</span>`;
}

function renderModuleSignature(modules: readonly ModuleId[]): string {
  return modules.map((moduleId) => MODULE_DEFINITIONS[moduleId].shortName).join(" + ");
}

function renderCost(cost: Partial<Cost>): string {
  return RESOURCE_IDS.filter((id) => (cost[id] ?? 0) > 0)
    .map((id) => `<span class="cost ${id}">${icon(id)}${cost[id]}</span>`)
    .join("");
}

function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function toHexColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function renderBar(label: string, value: number, max: number, className: string): string {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return `
    <div class="stat-bar ${className}">
      <div class="stat-bar-fill" style="width:${(ratio * 100).toFixed(1)}%"></div>
      <span class="stat-bar-label">${label}</span>
      <span class="stat-bar-value">${Math.round(value)}/${Math.round(max)}</span>
    </div>
  `;
}

function renderWeaponChips(weapons: ShipWeaponDefinition[]): string {
  return weapons.map((weapon) => `<span class="chip chip-${weapon.kind}">${weapon.name}</span>`).join("");
}

export class UIManager {
  private hudStrip: HTMLElement;
  private matchHeader: HTMLElement;
  private battleOverlay: HTMLElement;
  private canvasShell: HTMLElement;
  private tray: HTMLElement;
  private dockNav: HTMLElement;
  private dockPanel: HTMLElement;
  private missionBar: HTMLElement;
  private modalLayer: HTMLElement;
  private fxLayer: HTMLElement;
  private ghostHand: HTMLElement;
  private highlightedTargets = new Set<HTMLElement>();
  private lastHtml = new Map<SectionId, string>();
  private lastResourceSnapshot?: ResourcePool;
  private pendingDeltas: ResourcePool = { solar: 0, minerals: 0, scrap: 0 };
  private lastDeltaFlush = 0;
  private lastHull?: number;
  private hullHitUntil = 0;
  private countedSummaryKey?: string;
  private railWaves: HTMLElement;
  private railKills: HTMLElement;
  private layoutMode: LayoutMode = getLayoutMode();
  private sheetOpen = false;

  constructor(private root: HTMLElement, private controller: GameController) {
    root.innerHTML = `
      <div class="app-shell" id="app-shell">
        <header class="hud-strip" id="hud-strip"></header>
        <div class="play-layout">
          <aside class="dock-shell">
            <nav class="dock-nav" id="dock-nav"></nav>
            <section class="dock-panel" id="dock-panel"></section>
          </aside>
          <main class="board-column">
            <div class="match-header" id="match-header"></div>
            <div class="canvas-shell main-panel" id="canvas-shell" data-panel="main-panel" data-tutorial-target="ship-board">
              <div id="game-canvas"></div>
              <div class="battle-overlay" id="battle-overlay"></div>
            </div>
            <div class="build-tray" id="build-tray"></div>
            <div class="mission-bar-wrap" id="mission-bar"></div>
          </main>
          <aside class="side-rail" id="side-rail">
            <section class="rail-block">
              <span class="eyebrow">Wave timeline</span>
              <div class="wave-timeline" id="rail-waves"></div>
            </section>
            <section class="rail-block">
              <span class="eyebrow">Killfeed</span>
              <div class="killfeed" id="rail-kills"></div>
            </section>
            <section class="rail-block hotkey-legend">
              <span class="eyebrow">Hotkeys</span>
              <small><kbd>1</kbd>-<kbd>9</kbd> build · <kbd>Q</kbd><kbd>W</kbd><kbd>E</kbd> doctrine · <kbd>Enter</kbd> launch · <kbd>F</kbd> speed · <kbd>Space</kbd> pause</small>
            </section>
          </aside>
        </div>
        <div class="modal-layer" id="modal-layer"></div>
        <div class="fx-layer" id="fx-layer"><div class="ghost-hand" id="ghost-hand">${ICONS.hand}</div></div>
      </div>
    `;

    const find = (selector: string) => {
      const element = root.querySelector<HTMLElement>(selector);
      if (!element) {
        throw new Error(`UI shell failed to initialize: ${selector}`);
      }
      return element;
    };
    this.hudStrip = find("#hud-strip");
    this.matchHeader = find("#match-header");
    this.battleOverlay = find("#battle-overlay");
    this.canvasShell = find("#canvas-shell");
    this.tray = find("#build-tray");
    this.dockNav = find("#dock-nav");
    this.dockPanel = find("#dock-panel");
    this.missionBar = find("#mission-bar");
    this.modalLayer = find("#modal-layer");
    this.fxLayer = find("#fx-layer");
    this.ghostHand = find("#ghost-hand");
    this.railWaves = find("#rail-waves");
    this.railKills = find("#rail-kills");

    this.root.addEventListener("pointerdown", unlockAudio);
    this.root.addEventListener("click", this.handleClick);
    this.root.addEventListener("pointerover", this.handlePacketHover);
    window.addEventListener("keydown", this.handleHotkey);
    window.addEventListener("resize", () => {
      const mode = getLayoutMode();
      if (mode !== this.layoutMode) {
        this.layoutMode = mode;
        this.sheetOpen = false;
        this.render(this.controller.getState());
      }
    });
    this.controller.subscribe((state) => {
      this.render(state);
    });
  }

  private handlePacketHover = (event: Event): void => {
    const packet = (event.target as HTMLElement).closest<HTMLElement>(".packet[data-module]");
    const details = this.tray.querySelector<HTMLElement>(".tray-details");
    if (!packet || !details) {
      return;
    }
    details.textContent = getFabricationCardData(packet.dataset.module as FabricationOptionId).description;
  };

  private handleHotkey = (event: KeyboardEvent): void => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) {
      return;
    }
    const state = this.controller.getState();
    const key = event.key.toLowerCase();
    if (state.phase === "menu") {
      if (key === "enter") {
        this.controller.dispatch({ type: "start_new_run" });
      }
      return;
    }
    if (state.phase === "results") {
      if (key === "enter") {
        this.controller.dispatch(state.simulation.chests.length > 0 && !state.pendingReward ? { type: "open_chest" } : { type: "continue_from_results" });
      }
      return;
    }
    if (DOCTRINE_HOTKEYS[key] && (state.phase === "planning" || state.phase === "execution")) {
      this.controller.dispatch({ type: "set_doctrine", doctrineId: DOCTRINE_HOTKEYS[key] });
      return;
    }
    if (key === "f" && state.phase === "execution") {
      this.controller.dispatch({ type: "toggle_execution_speed" });
      return;
    }
    if (state.phase !== "planning") {
      return;
    }
    if (key === "enter") {
      this.controller.dispatch({ type: "begin_execution" });
      return;
    }
    if (key === "escape" && state.ui.selectedFabricationModuleId) {
      this.controller.dispatch({ type: "select_fabrication_module", moduleId: state.ui.selectedFabricationModuleId });
      return;
    }
    const slot = Number(key);
    if (Number.isInteger(slot) && slot >= 1) {
      const packet = this.tray.querySelectorAll<HTMLElement>(".packet[data-module]:not([disabled])")[slot - 1];
      if (packet) {
        playSound("tap");
        this.controller.dispatch({ type: "select_fabrication_module", moduleId: packet.dataset.module as FabricationOptionId });
      }
    }
  };

  private handleClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    const actionElement = target.closest<HTMLElement>("[data-action]");
    if (!actionElement || actionElement.hasAttribute("disabled")) {
      return;
    }

    const action = actionElement.dataset.action;
    playSound(action === "open-chest" ? "chest" : "tap");
    switch (action) {
      case "fabricate":
        this.controller.dispatch({
          type: "select_fabrication_module",
          moduleId: actionElement.dataset.module as FabricationOptionId,
        });
        break;
      case "set-doctrine":
        this.controller.dispatch({
          type: "set_doctrine",
          doctrineId: actionElement.dataset.doctrine as RunState["doctrine"],
        });
        break;
      case "merge-selected":
        this.controller.dispatch({ type: "merge_selected" });
        break;
      case "spend-upgrade":
        this.controller.dispatch({
          type: "spend_upgrade",
          upgradeId: actionElement.dataset.upgrade as UpgradeId,
        });
        break;
      case "begin-execution":
        this.controller.dispatch({ type: "begin_execution" });
        break;
      case "toggle-pause":
        this.controller.dispatch({ type: "toggle_pause" });
        break;
      case "toggle-fast-forward":
        this.controller.dispatch({ type: "toggle_execution_speed" });
        break;
      case "choose-route":
        this.controller.dispatch({ type: "choose_route", routeId: actionElement.dataset.route as RouteId });
        break;
      case "open-chest":
        haptic(25);
        this.controller.dispatch({ type: "open_chest" });
        break;
      case "choose-reward":
        this.controller.dispatch({
          type: "choose_reward",
          rewardKind: actionElement.dataset.rewardKind as "artifact" | "epic_module",
          rewardId: actionElement.dataset.rewardId!,
        });
        break;
      case "continue-results":
        this.controller.dispatch({ type: "continue_from_results" });
        break;
      case "start-new-run":
        this.controller.dispatch({ type: "start_new_run" });
        break;
      case "set-dock": {
        const panelId = actionElement.dataset.panel as DockPanelId;
        const visible = this.getVisibleDockPanel(this.controller.getState());
        this.sheetOpen = this.layoutMode === "pocket" ? !(this.sheetOpen && visible === panelId) : false;
        this.controller.dispatch({ type: "set_dock_panel", panelId });
        this.render(this.controller.getState());
        break;
      }
      case "close-sheet":
        this.sheetOpen = false;
        this.render(this.controller.getState());
        break;
      case "toggle-sound":
        toggleMuted();
        this.render(this.controller.getState());
        break;
      case "advance-tutorial":
        this.controller.dispatch({ type: "advance_tutorial" });
        break;
      case "skip-tutorial":
        this.controller.dispatch({ type: "skip_tutorial" });
        break;
      case "replay-tutorial":
        this.controller.dispatch({ type: "replay_tutorial" });
        break;
      default:
        break;
    }
  };

  private render(state: RunState): void {
    const inRun = state.phase !== "menu";
    this.root.classList.toggle("menu-mode", !inRun);
    this.root.dataset.layout = this.layoutMode;
    this.root.classList.toggle("sheet-open", this.layoutMode === "pocket" && this.sheetOpen);
    if (inRun && this.layoutMode === "arena") {
      this.setSectionHtml("railWaves", this.railWaves, this.renderWaveTimeline(state));
      this.setSectionHtml("railKills", this.railKills, this.renderKillfeed(state));
    }
    this.setSectionHtml("hud", this.hudStrip, this.renderHud(state));
    this.setSectionHtml("header", this.matchHeader, inRun ? this.renderMatchHeader(state) : "");
    this.setSectionHtml("overlay", this.battleOverlay, inRun ? this.renderBattleOverlay(state) : this.renderMenuCard(state));
    this.setSectionHtml("tray", this.tray, inRun ? this.renderTray(state) : "");
    this.setSectionHtml("dockNav", this.dockNav, inRun ? this.renderDockNav(state) : "");
    this.setSectionHtml("dockPanel", this.dockPanel, inRun ? this.renderDockPanel(state) : "");
    this.setSectionHtml("missionBar", this.missionBar, inRun ? this.renderMissionBar(state) : "");
    this.setSectionHtml("modal", this.modalLayer, this.renderModals(state));
    this.canvasShell.classList.toggle(
      "lance-alarm",
      state.phase === "execution" && state.simulation.barrages.some((barrage) => barrage.firedAge === undefined),
    );
    this.tray.classList.toggle("is-empty", !this.tray.innerHTML.trim());
    this.missionBar.classList.toggle("is-empty", !this.missionBar.innerHTML.trim());
    this.matchHeader.classList.toggle("is-empty", !this.matchHeader.innerHTML.trim());
    this.syncTutorialHighlights(state);
    this.applyAmbientEffects();
    this.showResourceDeltas(state);
    this.runDebriefCountUp(state);
  }

  private setSectionHtml(section: SectionId, element: HTMLElement, html: string): void {
    if (this.lastHtml.get(section) === html) {
      return;
    }
    this.lastHtml.set(section, html);
    element.innerHTML = html;
  }

  private renderHud(state: RunState): string {
    const soundToggle = `
      <button class="icon-button sound-toggle" data-action="toggle-sound" aria-label="${isMuted() ? "Unmute" : "Mute"}">
        ${icon(isMuted() ? "sound_off" : "sound_on")}
      </button>
    `;
    if (state.phase === "menu") {
      return `
        <div class="resource-strip menu">
          <span class="resource-pill"><strong>${state.meta.totalCyclesCompleted}</strong><small>missions</small></span>
          <span class="resource-pill stars">${icon("star")}<strong>${state.meta.totalStars ?? 0}</strong><small>stars</small></span>
          <span class="resource-pill"><strong>${MERGE_RECIPES.filter((recipe) => state.discovery[recipe.id]?.state !== "unknown").length}/${MERGE_RECIPES.length}</strong><small>bots found</small></span>
          ${soundToggle}
        </div>
      `;
    }

    return `
      <div class="resource-strip">
        ${RESOURCE_IDS.map(
          (id) => `
            <span class="resource-pill ${id}" data-resource-id="${id}">
              ${icon(id)}<strong>${Math.round(state.resources[id])}</strong>
            </span>
          `,
        ).join("")}
        <span class="resource-pill cycle"><small>Mission</small><strong>${state.cycle}</strong></span>
        ${soundToggle}
      </div>
    `;
  }

  private renderMatchHeader(state: RunState): string {
    if (state.phase === "planning") {
      this.lastHull = undefined;
      return this.renderRoutePicker(state);
    }

    const simulation = state.simulation;
    const now = performance.now();
    if (this.lastHull !== undefined && state.ship.hull < this.lastHull - 0.5) {
      this.hullHitUntil = now + HULL_HIT_FLASH_MS;
    }
    if (this.lastHull !== undefined && this.lastHull / state.ship.maxHull >= 0.25 && state.ship.hull / state.ship.maxHull < 0.25) {
      haptic([60, 40, 60]);
    }
    this.lastHull = state.ship.hull;

    const capital = simulation.enemies.find((enemy) => (enemy.kind === "warship" || enemy.kind === "boss") && enemy.hp > 0);
    const lockedBarrage = capital
      ? simulation.barrages.find((barrage) => barrage.sourceId === capital.id && barrage.firedAge === undefined)
      : undefined;
    const nextWave = simulation.upcomingThreats[simulation.threatCursor];
    const nextWaveText = nextWave
      ? `${nextWave.label} in ${Math.max(0, nextWave.time - simulation.elapsed).toFixed(0)}s`
      : "All waves deployed";

    const enemySide = capital
      ? `
          <span class="side-label enemy">${capital.name}</span>
          ${renderBar("Hull", capital.hp, capital.maxHp, "enemy-hull")}
          ${capital.maxShield ? renderBar("Shield", capital.shield ?? 0, capital.maxShield, "enemy-shield thin") : ""}
          ${lockedBarrage ? `<span class="telegraph">${lockedBarrage.name} locked · ${Math.max(0, lockedBarrage.timer).toFixed(1)}s</span>` : ""}
        `
      : `
          <span class="side-label">Moon seam</span>
          ${renderBar("Moon", Math.max(0, simulation.objective.integrity), simulation.objective.maxIntegrity, "moon")}
          <span class="next-wave">${nextWaveText}</span>
        `;

    const controls = state.phase === "execution" ? `<div class="header-controls">${this.renderSpeedControls(state)}</div>` : "";

    return `
      <div class="scoreboard ${now < this.hullHitUntil ? "is-hit" : ""}">
        <div class="score-side friendly">
          <span class="side-label">Your ship</span>
          ${renderBar("Hull", state.ship.hull, state.ship.maxHull, "hull")}
          ${simulation.shieldsOffline ? `<span class="telegraph soft">Shields offline in the nebula</span>` : renderBar("Shield", state.ship.shield, state.ship.maxShield, "shield thin")}
        </div>
        <div class="score-center">
          <span class="encounter-kicker">${getPhaseLabel(state.phase)}</span>
          <strong class="encounter-name">${simulation.encounterName}</strong>
          <span class="clock">${formatClock(simulation.duration - simulation.elapsed)}</span>
          ${simulation.chests.length > 0 ? `<span class="chest-count">${icon("chest")}×${simulation.chests.length}</span>` : ""}
        </div>
        <div class="score-side hostile">
          ${enemySide}
        </div>
        ${controls}
      </div>
    `;
  }

  private renderSpeedControls(state: RunState): string {
    return `
      <button class="icon-button speed ${state.executionSpeed === 2 ? "selected" : ""}" data-action="toggle-fast-forward" aria-label="Toggle 2x speed">${state.executionSpeed}x</button>
      <button class="icon-button" data-action="toggle-pause" aria-label="${state.paused ? "Resume" : "Pause"}">${icon(state.paused ? "play" : "pause")}</button>
    `;
  }

  private renderRoutePicker(state: RunState): string {
    const selected = state.simulation.route;
    const cards = state.routeOptions
      .map((route) => `
          <button class="route-card route-${route} ${route === selected ? "selected" : ""}" data-action="choose-route" data-route="${route}" ${state.routeOptions.length === 1 ? "disabled" : ""}>
            <span class="route-silhouette">${ROUTE_SILHOUETTES[route]}</span>
            <span class="route-copy">
              <strong>${this.getRouteName(state, route)}</strong>
              <small>${ROUTES[route].blurb}</small>
            </span>
          </button>
        `)
      .join("");

    return `
      <div class="route-picker">
        <div class="route-heading">
          <span class="eyebrow">${state.routeOptions.length > 1 ? "Choose your next jump" : "Next up"}</span>
          <span class="route-intel">${this.renderRouteIntel(state)}</span>
        </div>
        <div class="route-cards">${cards}</div>
      </div>
    `;
  }

  private getRouteName(state: RunState, route: RouteId): string {
    switch (route) {
      case "duel":
        return `Ship Duel: ${getWarshipForCycle(state.cycle).name}`;
      case "boss":
        return `Boss: ${getBossForCycle(state.cycle).name}`;
      case "nebula":
        return "Nebula Run";
      case "derelict":
        return "Derelict Salvage";
      default:
        return "Swarm Defense";
    }
  }

  private renderRouteIntel(state: RunState): string {
    const route = state.simulation.route;
    const weapons =
      route === "duel" ? getWarshipForCycle(state.cycle).weapons : route === "boss" ? getBossForCycle(state.cycle).weapons : [];
    const enemyKinds = [
      ...new Set(
        state.simulation.upcomingThreats.filter((wave) => wave.kind !== "warship" && wave.kind !== "boss").map((wave) => wave.kind),
      ),
    ];
    const enemyChips = enemyKinds.map((kind) => `<span class="chip chip-enemy">${kind.replace(/_/g, " ")}</span>`).join("");
    return `${renderWeaponChips(weapons)}${enemyChips}<span class="route-tip">${ROUTES[route].tip}</span>`;
  }

  private renderBattleOverlay(state: RunState): string {
    const layers: string[] = [];
    const simulation = state.simulation;
    const encounter = ROUTES[simulation.route].encounter;

    if (state.phase === "execution" && simulation.launchCountdown > 0) {
      const stamp = simulation.launchCountdown < 0.6;
      layers.push(`
        <div class="launch-card ${stamp ? "stamp" : ""}">
          ${
            stamp
              ? `<strong class="launch-stamp">LAUNCH!</strong>`
              : `
            <span class="encounter-kicker">${encounter === "duel" ? "Ship duel" : encounter === "boss" ? "Boss fight" : "Lane defense"}</span>
            <strong>${simulation.encounterName}</strong>
            <span class="route-tip">${ROUTES[simulation.route].tip}</span>
          `
          }
        </div>
      `);
    } else if (state.phase === "execution" && simulation.bossEncounter.introTimer > 0 && simulation.bossEncounter.activeBossName) {
      layers.push(`<div class="announcement boss">${simulation.bossEncounter.activeBossName}<small>Ancient signal spike detected</small></div>`);
    } else if (state.phase === "execution" && simulation.announcement) {
      layers.push(`<div class="announcement">${simulation.announcement.text}</div>`);
    }

    if (state.phase === "execution" && simulation.launchCountdown <= 0) {
      layers.push(`<div class="overlay-controls">${this.renderSpeedControls(state)}</div>`);
    }

    if (state.phase === "execution" && state.paused) {
      layers.push(`<button class="pause-veil" data-action="toggle-pause">${icon("play")}<span>Paused · tap to resume</span></button>`);
    }

    const tutorialView = getTutorialStepView(state);
    if (tutorialView) {
      layers.push(`
        <section class="tutorial-bubble">
          <div>
            <strong>${tutorialView.title}</strong>
            <p>${tutorialView.body}</p>
          </div>
          <div class="tutorial-actions">
            ${tutorialView.requiresContinue ? `<button class="ui-button primary" data-action="advance-tutorial">${tutorialView.continueLabel ?? "Continue"}</button>` : ""}
            <button class="ui-button ghost" data-action="skip-tutorial">Skip</button>
          </div>
        </section>
      `);
    }
    return layers.join("");
  }

  private renderTray(state: RunState): string {
    if (state.phase !== "planning" && state.phase !== "execution") {
      return "";
    }
    const commitmentRatio = Math.max(0, Math.min(1, state.commitmentBonus / 0.5));
    const doctrineRow = `
      <div class="doctrine-row" data-tutorial-target="doctrine-panel">
        <span class="eyebrow">Doctrine</span>
        <div class="doctrine-chips">
          ${Object.values(DOCTRINES)
            .map(
              (doctrine) => `
                <button class="chip-button ${state.doctrine === doctrine.id ? "selected" : ""}" data-action="set-doctrine" data-doctrine="${doctrine.id}" title="${doctrine.summary}">
                  <kbd class="hotkey">${Object.keys(DOCTRINE_HOTKEYS).find((key) => DOCTRINE_HOTKEYS[key] === doctrine.id)?.toUpperCase()}</kbd>${doctrine.name}
                </button>
              `,
            )
            .join("")}
        </div>
        <div class="commitment-meter" title="Commitment bonus. Each doctrine change mid-mission costs 10%.">
          <div class="commitment-fill" style="width:${(commitmentRatio * 100).toFixed(0)}%"></div>
          <span>+${Math.round(state.commitmentBonus * 100)}%</span>
        </div>
      </div>
    `;

    if (state.phase === "execution") {
      return doctrineRow;
    }

    const selectedSlots = state.ui.selectedSlotIds
      .map((slotId) => getSlotById(state.ship.slots, slotId))
      .filter((slot): slot is NonNullable<typeof slot> => Boolean(slot));
    const body = selectedSlots.length >= 2 ? this.renderMergeStrip(state, selectedSlots) : this.renderPackets(state);
    return `${doctrineRow}${body}`;
  }

  private renderPackets(state: RunState): string {
    const selectedId = state.ui.selectedFabricationModuleId;
    const epicPackets = Object.entries(state.ship.epicInventory)
      .filter(([, count]) => count > 0)
      .map(([epicId, count]) => {
        const epic = getEpicModuleById(epicId as Parameters<typeof getEpicModuleById>[0]);
        return `
          <button class="packet epic ${selectedId === epicId ? "selected" : ""}" data-action="fabricate" data-module="${epicId}" style="--packet-color:${toHexColor(epic.color)}">
            <span class="packet-glyph">${epic.shortName}</span>
            <span class="packet-name">${epic.name.split(" ")[0]}</span>
            <span class="packet-cost">×${count}</span>
          </button>
        `;
      })
      .join("");

    const packets = Object.values(MODULE_DEFINITIONS)
      .map((module) => {
        const locked = module.id === "launch_port" && !isLaunchPortUnlocked(state);
        const affordable = canAfford(state.resources, module.fabricationCost);
        return `
          <button class="packet ${selectedId === module.id ? "selected" : ""} ${affordable ? "" : "unaffordable"} ${locked ? "locked" : ""}"
            data-action="fabricate" data-module="${module.id}" data-tutorial-target="module-${module.id}"
            style="--packet-color:${toHexColor(module.color)}" ${locked ? "disabled" : ""}>
            <span class="packet-glyph">${locked ? icon("lock") : module.icon}</span>
            <span class="packet-name">${TRAY_LABELS[module.id]}</span>
            <span class="packet-cost">${locked ? "Hangar Tech" : renderCost(module.fabricationCost)}</span>
          </button>
        `;
      })
      .join("");

    const details = selectedId
      ? getFabricationCardData(selectedId).description
      : "Pick a module, then tap an open ship slot. Tap placed modules to merge them into a bot.";

    let hotkey = 0;
    const withHotkeys = `${epicPackets}${packets}`.replace(/<button class="packet(?![^>]*disabled)([^>]*)>/g, (match) => {
      hotkey += 1;
      return hotkey <= 9 ? `${match}<kbd class="hotkey">${hotkey}</kbd>` : match;
    });
    return `
      <div class="packet-row" data-tutorial-target="module-panel">${withHotkeys}</div>
      <p class="tray-details">${details}</p>
    `;
  }

  private renderMergeStrip(state: RunState, selectedSlots: Array<NonNullable<ReturnType<typeof getSlotById>>>): string {
    const modules = selectedSlots.map((slot) => slot.moduleId).filter((moduleId): moduleId is ModuleId => Boolean(moduleId));
    const preview = getMergePreviewFromModules(modules, state.discovery);
    const atCapacity = state.ship.bots.length >= getBotCapacity(state);
    const epicNotes = selectedSlots
      .map((slot) => slot.epicModuleId)
      .filter((epicId): epicId is NonNullable<typeof epicId> => Boolean(epicId))
      .map((epicId) => getEpicModuleById(epicId).mergeNote)
      .join(" ");
    const action = !preview.recipe
      ? `<button class="ui-button" disabled>${preview.invalidReason === "needs_variety" ? "Need 2+ types" : "No bot pattern"}</button>`
      : atCapacity
        ? `<button class="ui-button" disabled>Bay full ${state.ship.bots.length}/${getBotCapacity(state)}</button>`
        : `<button class="ui-button primary" data-action="merge-selected">Create Bot</button>`;

    return `
      <div class="merge-strip" data-tutorial-target="merge-panel">
        <div class="merge-copy">
          <span class="eyebrow">${renderModuleSignature(modules)}</span>
          <strong>${preview.recipe?.resultName ?? "Unstable pattern"}</strong>
          <p>${preview.text} ${epicNotes}</p>
          <small class="fine-print">Merging is permanent.</small>
        </div>
        ${action}
      </div>
    `;
  }

  private renderDockNav(state: RunState): string {
    return DOCK_ITEMS.filter((item) => this.layoutMode !== "pocket" || item.pocket).map((item) => {
      const locked = this.isDockPanelLocked(state, item.id);
      const selected = this.getVisibleDockPanel(state) === item.id;
      return `
        <button class="dock-button ${selected ? "selected" : ""}" data-action="set-dock" data-panel="${item.id}" ${locked ? "disabled" : ""}>
          ${item.label}
        </button>
      `;
    }).join("");
  }

  private renderDockPanel(state: RunState): string {
    const sheetClose = `<button class="sheet-close" data-action="close-sheet" aria-label="Close">Close ✕</button>`;
    return `${sheetClose}${this.renderDockPanelBody(state)}`;
  }

  private renderDockPanelBody(state: RunState): string {
    switch (this.getVisibleDockPanel(state)) {
      case "build":
        return this.renderBuildPanel(state);
      case "log":
        return this.renderLogPanel(state);
      case "bots":
        return this.renderBotsPanel(state);
      case "doctrine":
        return this.renderDoctrinePanel(state);
      case "ship":
      default:
        return this.renderShipPanel(state);
    }
  }

  private renderShipPanel(state: RunState): string {
    const tutorialView = getTutorialStepView(state);
    const selectedSlots = state.ui.selectedSlotIds
      .map((slotId) => getSlotById(state.ship.slots, slotId))
      .filter((slot): slot is NonNullable<typeof slot> => Boolean(slot));
    const selectedText =
      selectedSlots.length > 0
        ? selectedSlots
            .map((slot) => {
              const presentation = getSlotModulePresentation(slot);
              if (!presentation) {
                return slot.label;
              }
              if (presentation.epicModuleId) {
                return `${slot.label} | ${getEpicModuleById(presentation.epicModuleId).name}`;
              }
              return `${slot.label} | ${MODULE_DEFINITIONS[presentation.moduleId].name}`;
            })
            .join("<br>")
        : "Nothing selected yet";

    return `
      ${this.renderShipUpgradePanel(state)}
      <div class="panel-block emphasis-block">
        <span class="eyebrow">Next Step</span>
        <strong>${tutorialView ? tutorialView.title : this.getGeneralGuidanceTitle(state)}</strong>
        <p>${tutorialView ? tutorialView.body : this.getGeneralGuidanceBody(state)}</p>
      </div>
      <div class="panel-block compact-stats">
        <div data-tutorial-target="bots-summary"><span class="eyebrow">Bots</span><strong>${state.ship.bots.length}/${getBotCapacity(state)}</strong></div>
        <div><span class="eyebrow">Ports</span><strong>${state.ship.slots.filter((slot) => slot.moduleId === "launch_port").length}</strong></div>
        <div><span class="eyebrow">Fighters</span><strong>${state.simulation.fighters.length}</strong></div>
        <div><span class="eyebrow">Moon</span><strong>${Math.max(0, Math.round(state.simulation.objective.integrity))}</strong></div>
      </div>
      <div class="panel-block">
        <span class="eyebrow">Selection</span>
        <p class="selection-copy">${selectedText}</p>
      </div>
      <div class="panel-block">
        <span class="eyebrow">Recent Messages</span>
        <div class="message-list">
          ${state.simulation.messageLog.slice(0, 5).map((entry) => `<div class="message-entry">${entry}</div>`).join("")}
        </div>
      </div>
      <div class="panel-block">
        <span class="eyebrow">Tutorial</span>
        <div class="button-stack">
          ${state.tutorial.active ? `<button class="ui-button secondary" data-action="skip-tutorial">Skip Tutorial</button>` : `<button class="ui-button secondary" data-action="replay-tutorial">Replay Tutorial</button>`}
        </div>
      </div>
    `;
  }

  private renderBuildPanel(state: RunState): string {
    const selectedId = state.ui.selectedFabricationModuleId;
    const cards = [
      ...Object.entries(state.ship.epicInventory)
        .filter(([, count]) => count > 0)
        .map(([epicId]) => epicId as FabricationOptionId),
      ...Object.values(MODULE_DEFINITIONS).map((module) => module.id as FabricationOptionId),
    ]
      .map((id) => {
        const card = getFabricationCardData(id);
        const locked = id === "launch_port" && !isLaunchPortUnlocked(state);
        const selected = selectedId === id;
        const costLabel = locked
          ? "Requires Hangar Tech Lv.1"
          : card.rarity
            ? `${state.ship.epicInventory[id as keyof typeof state.ship.epicInventory]} stored`
            : renderCost(MODULE_DEFINITIONS[id as ModuleId].fabricationCost);
        return `
          <button class="module-card ${selected ? "selected" : ""}" data-action="fabricate" data-module="${id}" ${state.phase !== "planning" || locked ? "disabled" : ""} style="--packet-color:${toHexColor(card.color)}">
            <strong>${card.name}</strong>
            <small>${costLabel}</small>
            ${selected ? `<span>${card.description}</span>` : ""}
          </button>
        `;
      })
      .join("");
    return `
      <section class="core-panel">
        <span class="eyebrow">Module codex</span>
        <strong>Every part, in detail</strong>
        <div class="module-grid compact">${cards}</div>
      </section>
    `;
  }

  private renderLogPanel(state: RunState): string {
    return `
      <div class="panel-block">
        <span class="eyebrow">Discovery Log</span>
        <strong>${MERGE_RECIPES.filter((recipe) => state.discovery[recipe.id]?.state !== "unknown").length}/${MERGE_RECIPES.length} recipes revealed</strong>
      </div>
      <div class="scroll-stack">
        ${MERGE_RECIPES.map((recipe) => {
          const entry = state.discovery[recipe.id];
          return `
            <article class="discovery-entry ${entry.state}">
              <div>
                <span class="eyebrow">${renderModuleSignature(recipe.modules)}</span>
                <strong>${entry.state === "unknown" ? "Unknown Pattern" : recipe.resultName}</strong>
                <p>${getDiscoveryDescriptor(entry, recipe)}</p>
              </div>
              <span class="state-pill">${entry.state.replace(/_/g, " ")}</span>
            </article>
          `;
        }).join("")}
      </div>
    `;
  }

  private renderBotsPanel(state: RunState): string {
    const botCards =
      state.ship.bots.length > 0
        ? state.ship.bots
            .map(
              (bot) => `
                <article class="bot-card" style="--packet-color:${toHexColor(bot.color)}">
                  <strong>${bot.name}</strong>
                  <span>${bot.role} bot${getBotDodge(bot) > 0 ? ` · ${Math.round(getBotDodge(bot) * 100)}% dodge` : ""}</span>
                  <div class="mini-bar"><div style="width:${((bot.hp / bot.maxHp) * 100).toFixed(0)}%"></div></div>
                  <small>Mine ${Math.round(bot.contribution.mined)} · Damage ${Math.round(bot.contribution.damage)} · Heal ${Math.round(bot.contribution.healing)}</small>
                </article>
              `,
            )
            .join("")
        : `<div class="empty-state">Select two or three placed modules, then tap Create Bot in the tray.</div>`;

    const artifacts =
      state.ship.artifacts.length > 0
        ? state.ship.artifacts
            .map((artifactId) => getArtifactById(artifactId))
            .filter(Boolean)
            .map(
              (artifact) => `
                <article class="artifact-card">
                  <strong>${artifact!.name}</strong>
                  <span>${artifact!.summary}</span>
                </article>
              `,
            )
            .join("")
        : `<div class="empty-state">No artifacts installed yet. Open chests at the debrief.</div>`;

    const wings = state.ship.slots
      .filter((slot) => slot.moduleId === "launch_port")
      .map((slot) => {
        const loadout = getPortLoadout(state, slot);
        const active = state.simulation.fighters.filter((fighter) => fighter.portSlotId === slot.id).length;
        return `<article class="bot-card wing"><strong>${slot.label} ${loadout.kind} wing</strong><span>${active}/${loadout.capacity} airborne · ${Math.round(loadout.dodge * 100)}% dodge</span></article>`;
      })
      .join("");
    return `
      <div class="panel-block">
        <span class="eyebrow">Fleet</span>
        <strong>${state.ship.bots.length}/${getBotCapacity(state)} bots ready</strong>
      </div>
      <div class="scroll-stack">${botCards}${wings}</div>
      <div class="panel-block">
        <span class="eyebrow">Artifacts</span>
      </div>
      <div class="scroll-stack">${artifacts}</div>
    `;
  }

  private renderShipUpgradePanel(state: RunState): string {
    const cards = Object.values(UPGRADE_DEFINITIONS)
      .map((upgrade) => {
        const level = state.ship.upgrades[upgrade.id];
        const nextCost = upgrade.costs[level];
        const disabled = state.phase !== "planning" || !nextCost;
        const pips = upgrade.costs.map((_, index) => `<i class="${index < level ? "on" : ""}"></i>`).join("");
        return `
          <button class="upgrade-card" data-action="spend-upgrade" data-upgrade="${upgrade.id}" title="Each level: ${upgrade.perLevelText}" ${disabled ? "disabled" : ""}>
            <span class="upgrade-head"><strong>${upgrade.name}</strong><span class="level-pips">${pips}</span></span>
            <span>${upgrade.summary}</span>
            <small class="upgrade-cost">${nextCost ? renderCost(nextCost) : "Maxed"}</small>
          </button>
        `;
      })
      .join("");

    return `
      <div class="panel-block">
        <span class="eyebrow">Ship Upgrades</span>
        <div class="upgrade-stack">${cards}</div>
      </div>
    `;
  }

  private renderDoctrinePanel(state: RunState): string {
    return `
      <section class="core-panel">
        <span class="eyebrow">Doctrine</span>
        <strong>${DOCTRINES[state.doctrine].name}</strong>
        ${Object.values(DOCTRINES)
          .map((doctrine) => `<p><b>${doctrine.name}:</b> ${doctrine.summary}</p>`)
          .join("")}
        <p class="fine-print">Switch doctrine from the tray under the battlefield. Each change during a mission costs 10% commitment.</p>
      </section>
    `;
  }

  private renderMissionBar(state: RunState): string {
    if (state.phase !== "planning") {
      return "";
    }
    const readiness = getMissionReadiness(state);
    return `
      <div class="mission-bar">
        <span class="mission-hint">${readiness.ready ? `Next: ${state.simulation.encounterName}` : readiness.reason}</span>
        <button class="mission-button primary-cta ${readiness.ready ? "ready" : ""}" data-action="begin-execution" data-tutorial-target="start-mission" ${readiness.ready ? "" : "disabled"}>
          Launch ▸ <kbd class="hotkey">Enter</kbd>
        </button>
      </div>
    `;
  }

  private renderWaveTimeline(state: RunState): string {
    const simulation = state.simulation;
    const waves = simulation.upcomingThreats
      .map((wave, index) => {
        const deployed = index < simulation.threatCursor;
        const remaining = Math.max(0, wave.time - simulation.elapsed);
        const progress = deployed ? 1 : Math.min(1, simulation.elapsed / Math.max(0.1, wave.time));
        return `
          <div class="wave-row ${deployed ? "deployed" : ""} ${wave.kind === "boss" || wave.kind === "warship" ? "capital" : ""}">
            <span>${wave.label}</span>
            <small>${deployed ? "deployed" : state.phase === "planning" ? `${wave.time}s` : `${remaining.toFixed(0)}s`}</small>
            <div class="wave-progress"><div style="width:${(progress * 100).toFixed(0)}%"></div></div>
          </div>
        `;
      })
      .join("");
    return waves || `<small class="fine-print">No telegraphed waves.</small>`;
  }

  private renderKillfeed(state: RunState): string {
    const simulation = state.simulation;
    const kills = simulation.killfeed
      .map(
        (entry, index) => `
          <div class="kill-row ${index === 0 && simulation.elapsed - entry.time < 0.6 ? "fresh" : ""}">
            <b style="color:${toHexColor(entry.color)}">${entry.killer}</b><span>▸</span><span>${entry.victim}</span>
          </div>
        `,
      )
      .join("");
    return kills || `<small class="fine-print">${state.phase === "planning" ? "Launch to start the fight." : "Quiet so far."}</small>`;
  }

  private renderMenuCard(state: RunState): string {
    return `
      <section class="menu-card">
        <h1>The Last Good Plan</h1>
        <p class="menu-tagline">Build a ship, merge modules into bots, and let the mission run.</p>
        <ol class="menu-steps">
          <li><b>Build</b><span>Place modules on your 3×3 ship.</span></li>
          <li><b>Merge</b><span>Fuse pairs or trios into autonomous bots.</span></li>
          <li><b>Launch</b><span>Pick a jump and watch the plan play out.</span></li>
        </ol>
        <button class="mission-button primary-cta ready" data-action="start-new-run">Start New Run ▸</button>
        <button class="ui-button ghost" data-action="replay-tutorial">Replay tutorial</button>
        <small class="fine-print">${state.meta.totalCyclesCompleted > 0 ? "Your discoveries and stars carry over between runs." : "Press Enter to start."}</small>
      </section>
    `;
  }

  private renderModals(state: RunState): string {
    const layers: string[] = [];

    if ((state.phase === "results" || state.phase === "run_over") && state.summary) {
      layers.push(this.renderDebrief(state));
    }

    if (state.pendingReward) {
      const choices = state.pendingReward.choices
        .map((choice) => {
          if (choice.kind === "artifact") {
            const artifact = getArtifactById(choice.id);
            if (!artifact) {
              return "";
            }
            return `
              <button class="reward-card" data-action="choose-reward" data-reward-kind="artifact" data-reward-id="${artifact.id}">
                <strong>${artifact.name}</strong>
                <span>${artifact.summary}</span>
                <small>${artifact.type.replace(/_/g, " ")}</small>
              </button>
            `;
          }

          const epic = getEpicModuleById(choice.id);
          return `
            <button class="reward-card epic" data-action="choose-reward" data-reward-kind="epic_module" data-reward-id="${epic.id}">
              <strong>${epic.name}</strong>
              <span>${epic.description}</span>
              <small>Epic module core</small>
            </button>
          `;
        })
        .join("");
      layers.push(`
        <section class="modal-card reward-modal chest-open">
          <div class="chest-burst">${icon("chest")}</div>
          <h2>${state.pendingReward.title}</h2>
          <p>${state.pendingReward.description}</p>
          <div class="reward-grid">${choices}</div>
        </section>
      `);
    }

    return layers.join("");
  }

  private renderDebrief(state: RunState): string {
    const summary = state.summary!;
    const survived = state.phase === "results";
    const chests = state.simulation.chests;
    const stars = summary.stars
      .map(
        (star, index) => `
          <div class="debrief-star ${star.earned ? "earned" : ""}" style="--star-delay:${0.25 + index * 0.3}s">
            ${icon("star")}
            <small>${star.label}</small>
          </div>
        `,
      )
      .join("");
    const gains = RESOURCE_IDS.map(
      (id) => `<span class="gain ${id}">${icon(id)}<strong data-count-to="${summary.gains[id]}">0</strong></span>`,
    ).join("");
    const mvp = summary.mvp
      ? `
        <div class="mvp-card" style="--packet-color:${toHexColor(summary.mvp.color)}">
          <span class="mvp-badge">MVP</span>
          <div>
            <strong>${summary.mvp.name}</strong>
            <small>${summary.mvp.role} bot</small>
          </div>
          <div class="mvp-stats">
            ${summary.mvp.damage > 0 ? `<span><b>${summary.mvp.damage}</b> dmg</span>` : ""}
            ${summary.mvp.mined > 0 ? `<span><b>${summary.mvp.mined}</b> mined</span>` : ""}
            ${summary.mvp.healing > 0 ? `<span><b>${summary.mvp.healing}</b> healed</span>` : ""}
            ${summary.mvp.dodges > 0 ? `<span><b>${summary.mvp.dodges}</b> dodges</span>` : ""}
          </div>
        </div>
      `
      : "";
    let chestBlock = "";
    if (!survived && chests.length > 0) {
      chestBlock = `<p class="fine-print">${chests.length} chest${chests.length > 1 ? "s were" : " was"} lost with the ship.</p>`;
    } else if (survived && chests.length > 0) {
      chestBlock = `
        <div class="chest-row">
          <div class="chest-stack">${chests.map(() => icon("chest", "chest-icon")).join("")}</div>
          <button class="ui-button primary" data-action="open-chest">Open chest (${chests.length})</button>
        </div>
      `;
    } else if (summary.rewards.length > 0) {
      chestBlock = `<p class="fine-print">Recovered: ${summary.rewards.join(", ")}</p>`;
    }
    const extras = [
      summary.discoveries.length > 0 ? `New: ${summary.discoveries.join(", ")}` : "",
      summary.perfectCommitmentReward.solar > 0 ? "Perfect commitment bonus included" : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const primary = survived
      ? `<button class="mission-button primary-cta ready" data-action="continue-results" ${chests.length > 0 || state.tutorial.active ? "disabled" : ""}>${chests.length > 0 ? "Open your chests first" : "Next mission ▸"}</button>`
      : `<button class="mission-button primary-cta ready" data-action="start-new-run">Start fresh run ▸</button>`;

    return `
      <section class="modal-card debrief ${survived ? "" : "failed"}" data-tutorial-target="summary-modal" data-summary-key="${state.cycle}-${summary.title}">
        <span class="encounter-kicker">Mission ${state.cycle} · ${state.simulation.encounterName}</span>
        <h2>${survived ? "Mission complete" : "The plan failed"}</h2>
        <div class="debrief-stars">${stars}</div>
        <div class="debrief-gains">${gains}</div>
        ${mvp}
        ${chestBlock}
        ${extras ? `<p class="fine-print">${extras}</p>` : ""}
        ${primary}
      </section>
    `;
  }

  private runDebriefCountUp(state: RunState): void {
    const debrief = this.modalLayer.querySelector<HTMLElement>(".debrief");
    if (!debrief) {
      this.countedSummaryKey = undefined;
      return;
    }
    const key = debrief.dataset.summaryKey;
    const counters = [...debrief.querySelectorAll<HTMLElement>("[data-count-to]")];
    if (key === this.countedSummaryKey) {
      counters.forEach((counter) => {
        counter.textContent = counter.dataset.countTo ?? "0";
      });
      debrief.classList.add("settled");
      return;
    }
    this.countedSummaryKey = key;
    const earned = state.summary?.stars.filter((star) => star.earned).length ?? 0;
    for (let index = 0; index < earned; index += 1) {
      window.setTimeout(() => {
        playSound("star", 0);
        haptic(15);
      }, 250 + index * 300);
    }
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / COUNT_UP_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      counters.forEach((counter) => {
        counter.textContent = String(Math.round(Number(counter.dataset.countTo ?? 0) * eased));
      });
      if (progress < 1) {
        playSound("coin", 70);
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }

  private applyAmbientEffects(): void {
    this.root
      .querySelectorAll<HTMLElement>(".dock-nav, .dock-panel, .panel-block, .canvas-shell, .modal-card")
      .forEach((element) => {
        applyPanelGlow(element);
      });

    this.root.querySelectorAll<HTMLElement>(".mission-button, .ui-button, .upgrade-card").forEach((button) => {
      applyButtonHoverEffect(button, {
        primary: button.matches(".primary-cta"),
      });
    });
  }

  private showResourceDeltas(state: RunState): void {
    if (state.phase !== "planning" && state.phase !== "execution") {
      this.lastResourceSnapshot = undefined;
      this.pendingDeltas = { solar: 0, minerals: 0, scrap: 0 };
      return;
    }
    const snapshot = { ...state.resources };
    if (this.lastResourceSnapshot) {
      for (const id of RESOURCE_IDS) {
        this.pendingDeltas[id] += snapshot[id] - this.lastResourceSnapshot[id];
      }
    }
    this.lastResourceSnapshot = snapshot;

    const now = performance.now();
    if (now - this.lastDeltaFlush < DELTA_FLUSH_MS) {
      return;
    }
    this.lastDeltaFlush = now;
    for (const id of RESOURCE_IDS) {
      const delta = Math.round(this.pendingDeltas[id]);
      if (delta === 0) {
        continue;
      }
      this.pendingDeltas[id] -= delta;
      const pill = this.root.querySelector<HTMLElement>(`[data-resource-id="${id}"]`);
      if (!pill) {
        continue;
      }
      pulseCounter(pill);
      const rect = pill.getBoundingClientRect();
      const float = document.createElement("span");
      float.className = `delta-float ${id} ${delta < 0 ? "spend" : ""}`;
      float.textContent = `${delta > 0 ? "+" : ""}${delta}`;
      float.style.left = `${rect.left + rect.width / 2}px`;
      float.style.top = `${rect.bottom - 4}px`;
      this.fxLayer.appendChild(float);
      window.setTimeout(() => float.remove(), 1100);
    }
  }

  private syncTutorialHighlights(state: RunState): void {
    for (const element of this.highlightedTargets) {
      element.classList.remove("tutorial-highlight");
    }
    this.highlightedTargets.clear();

    const tutorialView = getTutorialStepView(state);
    if (tutorialView) {
      for (const selector of tutorialView.targetSelectors) {
        this.root.querySelectorAll<HTMLElement>(selector).forEach((element) => {
          element.classList.add("tutorial-highlight");
          this.highlightedTargets.add(element);
        });
      }
    }

    const handSelector = getTutorialHandTarget(state);
    const handTarget = handSelector ? this.root.querySelector<HTMLElement>(handSelector) : null;
    if (!handTarget) {
      this.ghostHand.classList.remove("visible");
      return;
    }
    const rect = handTarget.getBoundingClientRect();
    this.ghostHand.style.left = `${rect.left + rect.width * 0.55}px`;
    this.ghostHand.style.top = `${rect.top + rect.height * 0.55}px`;
    this.ghostHand.classList.add("visible");
  }

  private getVisibleDockPanel(state: RunState): DockPanelId {
    const requested = state.ui.activeDockPanel;
    return this.isDockPanelLocked(state, requested) ? "ship" : requested;
  }

  private isDockPanelLocked(state: RunState, panelId: DockPanelId): boolean {
    return state.tutorial.active && panelId !== "ship";
  }

  private getGeneralGuidanceTitle(state: RunState): string {
    switch (state.phase) {
      case "planning":
        return "Build your next mission";
      case "execution":
        return "Watch the plan resolve";
      case "results":
      case "run_over":
        return "Review the mission debrief";
      default:
        return "Start a new run";
    }
  }

  private getGeneralGuidanceBody(state: RunState): string {
    switch (state.phase) {
      case "planning":
        return "Pick your next jump above the battlefield, build from the tray below it, then Launch.";
      case "execution":
        return "Bots, cannons, and fighters act on their own. Doctrine changes are optional and cost commitment.";
      case "results":
      case "run_over":
        return "Open your chests and check the stars, then move on.";
      default:
        return "Start a new run to begin planning.";
    }
  }
}
