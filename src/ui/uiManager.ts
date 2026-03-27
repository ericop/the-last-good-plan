import { DOCTRINES } from "../data/doctrines";
import { MERGE_RECIPES } from "../data/merges";
import { MODULE_DEFINITIONS } from "../data/modules";
import { UPGRADE_DEFINITIONS } from "../data/upgrades";
import type { GameController } from "../core/gameController";
import { getDiscoveryDescriptor, getMergePreviewFromModules } from "../core/discovery";
import { getMissionReadiness, getPhaseLabel, getTutorialStepView } from "../core/tutorial";
import { getArtifactById, getBotCapacity, getSlotById } from "../core/utils";
import type { DockPanelId, ModuleId, RunState, UpgradeId } from "../types/gameTypes";

const DOCK_ITEMS: Array<{ id: DockPanelId; label: string }> = [
  { id: "ship", label: "Ship" },
  { id: "log", label: "Log" },
  { id: "bots", label: "Bots" },
  { id: "upgrades", label: "Upgrades" },
  { id: "settings", label: "Settings" },
];

export class UIManager {
  private hudStrip: HTMLElement;
  private dockNav: HTMLElement;
  private dockPanel: HTMLElement;
  private coreRail: HTMLElement;
  private missionBar: HTMLElement;
  private modalLayer: HTMLElement;
  private highlightedTargets = new Set<HTMLElement>();

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
            <div class="canvas-shell" data-tutorial-target="ship-board">
              <div id="game-canvas"></div>
            </div>
            <div class="mission-bar-wrap" id="mission-bar"></div>
          </main>
          <aside class="core-rail" id="core-rail"></aside>
        </div>
        <div class="modal-layer" id="modal-layer"></div>
      </div>
    `;

    const hudStrip = root.querySelector<HTMLElement>("#hud-strip");
    const dockNav = root.querySelector<HTMLElement>("#dock-nav");
    const dockPanel = root.querySelector<HTMLElement>("#dock-panel");
    const coreRail = root.querySelector<HTMLElement>("#core-rail");
    const missionBar = root.querySelector<HTMLElement>("#mission-bar");
    const modalLayer = root.querySelector<HTMLElement>("#modal-layer");
    if (!hudStrip || !dockNav || !dockPanel || !coreRail || !missionBar || !modalLayer) {
      throw new Error("UI shell failed to initialize.");
    }

    this.hudStrip = hudStrip;
    this.dockNav = dockNav;
    this.dockPanel = dockPanel;
    this.coreRail = coreRail;
    this.missionBar = missionBar;
    this.modalLayer = modalLayer;

    this.root.addEventListener("click", this.handleClick);
    this.controller.subscribe((state) => {
      this.render(state);
    });
  }

  private handleClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    const actionElement = target.closest<HTMLElement>("[data-action]");
    if (!actionElement || actionElement.hasAttribute("disabled")) {
      return;
    }

    const action = actionElement.dataset.action;
    switch (action) {
      case "fabricate":
        this.controller.dispatch({
          type: "select_fabrication_module",
          moduleId: actionElement.dataset.module as ModuleId,
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
      case "choose-reward":
        this.controller.dispatch({
          type: "choose_reward",
          artifactId: actionElement.dataset.artifact!,
        });
        break;
      case "continue-results":
        this.controller.dispatch({ type: "continue_from_results" });
        break;
      case "start-new-run":
        this.controller.dispatch({ type: "start_new_run" });
        break;
      case "set-dock":
        this.controller.dispatch({
          type: "set_dock_panel",
          panelId: actionElement.dataset.panel as DockPanelId,
        });
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
      case "return-menu":
        this.controller.dispatch({ type: "return_to_menu" });
        break;
      default:
        break;
    }
  };

  private render(state: RunState): void {
    this.root.classList.toggle("menu-mode", state.phase === "menu");
    this.hudStrip.innerHTML = this.renderHud(state);
    this.dockNav.innerHTML = state.phase === "menu" ? "" : this.renderDockNav(state);
    this.dockPanel.innerHTML = state.phase === "menu" ? "" : this.renderDockPanel(state);
    this.coreRail.innerHTML = state.phase === "menu" ? "" : this.renderCoreRail(state);
    this.missionBar.innerHTML = state.phase === "menu" ? "" : this.renderMissionBar(state);
    this.modalLayer.innerHTML = this.renderModals(state);
    this.syncTutorialHighlights(state);
  }

  private renderHud(state: RunState): string {
    if (state.phase === "menu") {
      return `
        <div class="hud-card wide">
          <span class="eyebrow">Meta Knowledge</span>
          <strong>${state.meta.totalCyclesCompleted}</strong>
          <span>missions completed</span>
        </div>
        <div class="hud-card">
          <span class="eyebrow">Discoveries</span>
          <strong>${MERGE_RECIPES.filter((recipe) => state.discovery[recipe.id].state !== "unknown").length}/${MERGE_RECIPES.length}</strong>
          <span>merge outcomes known</span>
        </div>
        <div class="hud-card">
          <span class="eyebrow">Artifacts</span>
          <strong>${state.meta.totalArtifactsRecovered}</strong>
          <span>historic recoveries</span>
        </div>
      `;
    }

    const nextThreat = state.simulation.upcomingThreats.find((wave, index) => index >= state.simulation.threatCursor);
    const nextThreatText = nextThreat
      ? `${nextThreat.label} in ${Math.max(0, nextThreat.time - state.simulation.elapsed).toFixed(1)}s`
      : "All telegraphed threats deployed";

    return `
      <div class="hud-card wide">
        <span class="eyebrow">Cycle ${state.cycle}</span>
        <strong>${getPhaseLabel(state.phase)}</strong>
        <span data-tutorial-target="mission-status">${DOCTRINES[state.doctrine].name}</span>
      </div>
      <div class="hud-card resource solar">
        <span class="eyebrow">Solar</span>
        <strong>${Math.round(state.resources.solar)}</strong>
        <span>stored</span>
      </div>
      <div class="hud-card resource minerals">
        <span class="eyebrow">Minerals</span>
        <strong>${Math.round(state.resources.minerals)}</strong>
        <span>stored</span>
      </div>
      <div class="hud-card resource scrap">
        <span class="eyebrow">Scrap</span>
        <strong>${Math.round(state.resources.scrap)}</strong>
        <span>stored</span>
      </div>
      <div class="hud-card">
        <span class="eyebrow">Commitment</span>
        <strong>+${Math.round(state.commitmentBonus * 100)}%</strong>
        <span>efficiency</span>
      </div>
      <div class="hud-card wide">
        <span class="eyebrow">Threat Preview</span>
        <strong>${nextThreatText}</strong>
        <span>${Math.max(0, state.simulation.upcomingThreats.length - state.simulation.threatCursor)} waves queued</span>
      </div>
    `;
  }

  private renderDockNav(state: RunState): string {
    return DOCK_ITEMS.map((item) => {
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
    switch (this.getVisibleDockPanel(state)) {
      case "log":
        return this.renderLogPanel(state);
      case "bots":
        return this.renderBotsPanel(state);
      case "upgrades":
        return this.renderUpgradePanel(state);
      case "settings":
        return this.renderSettingsPanel(state);
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
        ? selectedSlots.map((slot) => `${slot.label}${slot.moduleId ? ` • ${MODULE_DEFINITIONS[slot.moduleId].name}` : ""}`).join("<br>")
        : "Nothing selected yet";

    return `
      <div class="panel-block emphasis-block">
        <span class="eyebrow">Next Step</span>
        <strong>${tutorialView ? tutorialView.title : this.getGeneralGuidanceTitle(state)}</strong>
        <p>${tutorialView ? tutorialView.body : this.getGeneralGuidanceBody(state)}</p>
      </div>
      <div class="panel-block compact-stats">
        <div><span class="eyebrow">Hull</span><strong>${Math.round(state.ship.hull)}/${state.ship.maxHull}</strong></div>
        <div><span class="eyebrow">Shield</span><strong>${Math.round(state.ship.shield)}/${state.ship.maxShield}</strong></div>
        <div data-tutorial-target="bots-summary"><span class="eyebrow">Bots</span><strong>${state.ship.bots.length}/${getBotCapacity(state)}</strong></div>
        <div><span class="eyebrow">Moon</span><strong>${Math.max(0, Math.round(state.simulation.objective.integrity))}</strong></div>
      </div>
      <div class="panel-block">
        <span class="eyebrow">Selection</span>
        <p class="selection-copy">${selectedText}</p>
      </div>
      <div class="panel-block">
        <span class="eyebrow">Recent Messages</span>
        <div class="message-list">
          ${state.simulation.messageLog.slice(-5).map((entry) => `<div class="message-entry">${entry}</div>`).join("")}
        </div>
      </div>
    `;
  }

  private renderLogPanel(state: RunState): string {
    return `
      <div class="panel-block">
        <span class="eyebrow">Discovery Log</span>
        <strong>${MERGE_RECIPES.filter((recipe) => state.discovery[recipe.id].state !== "unknown").length}/${MERGE_RECIPES.length} recipes revealed</strong>
      </div>
      <div class="scroll-stack">
        ${MERGE_RECIPES.map((recipe) => {
          const entry = state.discovery[recipe.id];
          return `
            <article class="discovery-entry ${entry.state}">
              <div>
                <span class="eyebrow">${MODULE_DEFINITIONS[recipe.modules[0]].shortName} + ${MODULE_DEFINITIONS[recipe.modules[1]].shortName}</span>
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
                <article class="bot-card">
                  <strong>${bot.name}</strong>
                  <span>${bot.role} bot</span>
                  <small>HP ${Math.round(bot.hp)}/${bot.maxHp} • Mine ${Math.round(bot.contribution.mined)} • Damage ${Math.round(bot.contribution.damage)}</small>
                </article>
              `,
            )
            .join("")
        : `<div class="empty-state">Create a bot from two adjacent modules to see it here.</div>`;

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
        : `<div class="empty-state">No artifacts installed yet.</div>`;

    return `
      <div class="panel-block">
        <span class="eyebrow">Fleet</span>
        <strong>${state.ship.bots.length}/${getBotCapacity(state)} bots ready</strong>
      </div>
      <div class="scroll-stack">${botCards}</div>
      <div class="panel-block">
        <span class="eyebrow">Artifacts</span>
      </div>
      <div class="scroll-stack">${artifacts}</div>
    `;
  }

  private renderUpgradePanel(state: RunState): string {
    return `
      <div class="panel-block">
        <span class="eyebrow">Upgrade Nodes</span>
        <strong>Spend resources on simple permanent support</strong>
        <p>Mining, defense, and support are kept here so they never crowd the main build flow.</p>
      </div>
      <div class="scroll-stack">
        ${Object.values(UPGRADE_DEFINITIONS)
          .map((upgrade) => {
            const level = state.ship.upgrades[upgrade.id];
            const nextCost = upgrade.costs[level];
            const disabled = state.phase !== "planning" || !nextCost;
            return `
              <button class="upgrade-card" data-action="spend-upgrade" data-upgrade="${upgrade.id}" ${disabled ? "disabled" : ""}>
                <strong>${upgrade.name} Lv.${level}</strong>
                <span>${upgrade.summary}</span>
                <small>${nextCost ? `S ${nextCost.solar} • M ${nextCost.minerals} • C ${nextCost.scrap}` : "Maxed"}</small>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  private renderSettingsPanel(state: RunState): string {
    return `
      <div class="panel-block">
        <span class="eyebrow">Settings</span>
        <strong>Keep the run readable</strong>
        <p>${state.tutorial.active ? "Need less guidance? You can skip the tutorial here." : "Replay the tutorial any time or head back to the menu."}</p>
      </div>
      <div class="button-stack">
        ${state.tutorial.active ? `<button class="ui-button secondary" data-action="skip-tutorial">Skip Tutorial</button>` : `<button class="ui-button secondary" data-action="replay-tutorial">Replay Tutorial</button>`}
        ${state.phase === "execution" ? `<button class="ui-button secondary" data-action="toggle-pause">${state.paused ? "Resume Mission" : "Pause Mission"}</button>` : ""}
        ${state.tutorial.active ? "" : `<button class="ui-button secondary" data-action="return-menu">Return To Menu</button>`}
      </div>
    `;
  }

  private renderCoreRail(state: RunState): string {
    const selectedSlots = state.ui.selectedSlotIds
      .map((slotId) => getSlotById(state.ship.slots, slotId))
      .filter((slot): slot is NonNullable<typeof slot> => Boolean(slot));
    const mergePanel = this.renderMergePanel(state, selectedSlots);

    if (state.phase !== "planning") {
      return `
        ${this.renderDoctrinePanel(state)}
        <section class="core-panel">
          <span class="eyebrow">Mission Feed</span>
          <strong>${getPhaseLabel(state.phase)}</strong>
          <p>Your ship is resolving the plan automatically. Commitment stays visible because doctrine changes affect every bot.</p>
          <div class="compact-stats">
            <div><span class="eyebrow">Elapsed</span><strong>${state.simulation.elapsed.toFixed(1)}s</strong></div>
            <div><span class="eyebrow">Duration</span><strong>${state.simulation.duration}s</strong></div>
            <div><span class="eyebrow">Changes</span><strong>${state.doctrineChangesThisCycle}</strong></div>
            <div><span class="eyebrow">Bots</span><strong>${state.ship.bots.length}</strong></div>
          </div>
        </section>
      `;
    }

    return `
      ${this.renderModulePanel(state)}
      ${mergePanel}
      ${this.renderDoctrinePanel(state)}
    `;
  }

  private renderModulePanel(state: RunState): string {
    return `
      <section class="core-panel" data-tutorial-target="module-panel">
        <span class="eyebrow">Place Modules</span>
        <strong>Build the ship</strong>
        <div class="module-grid compact">
          ${Object.values(MODULE_DEFINITIONS)
            .map((module) => {
              const selected = state.ui.selectedFabricationModuleId === module.id;
              return `
                <button class="module-card ${selected ? "selected" : ""}" data-action="fabricate" data-module="${module.id}" data-tutorial-target="module-${module.id}">
                  <strong>${module.name}</strong>
                  <span>${module.description}</span>
                  <small>S ${module.fabricationCost.solar} • M ${module.fabricationCost.minerals} • C ${module.fabricationCost.scrap}</small>
                </button>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  private renderMergePanel(
    state: RunState,
    selectedSlots: Array<NonNullable<ReturnType<typeof getSlotById>>>,
  ): string {
    let title = "Create a bot";
    let body = "Select two adjacent placed modules to preview their merge.";
    let action = "";

    if (selectedSlots.length === 2 && selectedSlots[0].moduleId && selectedSlots[1].moduleId) {
      const adjacent = selectedSlots[0].neighbors.includes(selectedSlots[1].id);
      if (!adjacent) {
        body = "Those modules are not adjacent yet. Adjacent pairs can merge into bots.";
      } else {
        const preview = getMergePreviewFromModules([selectedSlots[0].moduleId, selectedSlots[1].moduleId], state.discovery);
        title = preview.recipe ? preview.recipe.resultName : title;
        body = preview.text;
        if (preview.recipe) {
          action = `<button class="ui-button primary full-width" data-action="merge-selected">Create Bot</button>`;
        }
      }
    }

    return `
      <section class="core-panel" data-tutorial-target="merge-panel">
        <span class="eyebrow">Merge Preview</span>
        <strong>${title}</strong>
        <p>${body}</p>
        <p class="fine-print">Merging permanently consumes both modules. There is no undo.</p>
        ${action}
      </section>
    `;
  }

  private renderDoctrinePanel(state: RunState): string {
    return `
      <section class="core-panel" data-tutorial-target="doctrine-panel">
        <span class="eyebrow">Doctrine</span>
        <strong>${DOCTRINES[state.doctrine].name}</strong>
        <p>${DOCTRINES[state.doctrine].summary}</p>
        <div class="doctrine-grid">
          ${Object.values(DOCTRINES)
            .map(
              (doctrine) => `
                <button class="ui-button ${state.doctrine === doctrine.id ? "selected" : "secondary"}" data-action="set-doctrine" data-doctrine="${doctrine.id}">
                  ${doctrine.name}
                </button>
              `,
            )
            .join("")}
        </div>
        <p class="fine-print">Each doctrine change during a mission reduces commitment by 10%. You never need to change it to survive.</p>
      </section>
    `;
  }

  private renderMissionBar(state: RunState): string {
    const readiness = getMissionReadiness(state);

    if (state.phase === "planning") {
      return `
        <div class="mission-bar">
          <div class="mission-copy">
            <span class="eyebrow">Primary Action</span>
            <strong>Start Mission</strong>
            <span class="mission-hint">${readiness.ready ? "Your ship is ready to run itself." : readiness.reason}</span>
          </div>
          <button class="mission-button" data-action="begin-execution" data-tutorial-target="start-mission" ${readiness.ready ? "" : "disabled"}>
            Start Mission
          </button>
        </div>
      `;
    }

    if (state.phase === "execution") {
      return `
        <div class="mission-bar running">
          <div class="mission-copy">
            <span class="eyebrow">Mission Status</span>
            <strong>Mission Running</strong>
            <span class="mission-hint">Your ship is acting automatically. Pause is instant if you want time to think.</span>
          </div>
          <button class="mission-button muted" data-action="toggle-pause">
            ${state.paused ? "Resume Mission" : "Pause Mission"}
          </button>
        </div>
      `;
    }

    if (state.phase === "results") {
      return `
        <div class="mission-bar results">
          <div class="mission-copy">
            <span class="eyebrow">Mission Debrief</span>
            <strong>Review what your plan did</strong>
            <span class="mission-hint">The summary is open. When you are ready, go back to planning.</span>
          </div>
          <button class="mission-button" data-action="continue-results" ${state.tutorial.active ? "disabled" : ""}>
            Return To Planning
          </button>
        </div>
      `;
    }

    return `
      <div class="mission-bar results">
        <div class="mission-copy">
          <span class="eyebrow">Run Over</span>
          <strong>Start a fresh run</strong>
          <span class="mission-hint">The plan failed, but the discoveries stay with you.</span>
        </div>
        <button class="mission-button" data-action="start-new-run">
          Start Fresh Run
        </button>
      </div>
    `;
  }

  private renderModals(state: RunState): string {
    const layers: string[] = [];

    if (state.pendingReward) {
      const choices = state.pendingReward.choices
        .map((artifactId) => getArtifactById(artifactId))
        .filter(Boolean)
        .map(
          (artifact) => `
            <button class="reward-card" data-action="choose-reward" data-artifact="${artifact!.id}">
              <strong>${artifact!.name}</strong>
              <span>${artifact!.summary}</span>
              <small>${artifact!.type.replace(/_/g, " ")}</small>
            </button>
          `,
        )
        .join("");
      layers.push(`
        <section class="modal-card reward-modal">
          <h2>${state.pendingReward.source === "moon" ? "Ancient Artifact" : "Recovered Chest"}</h2>
          <p>Choose exactly one reward for the run. The mission continues after you decide.</p>
          <div class="reward-grid">${choices}</div>
        </section>
      `);
    }

    if (state.phase === "results" && state.summary) {
      layers.push(`
        <section class="modal-card results-modal" data-tutorial-target="summary-modal">
          <h2>${state.summary.title}</h2>
          <p>${state.summary.text}</p>
          <div class="compact-stats summary-grid">
            <div><span class="eyebrow">Solar</span><strong>${state.summary.gains.solar}</strong></div>
            <div><span class="eyebrow">Minerals</span><strong>${state.summary.gains.minerals}</strong></div>
            <div><span class="eyebrow">Scrap</span><strong>${state.summary.gains.scrap}</strong></div>
            <div><span class="eyebrow">Bots Lost</span><strong>${state.summary.losses.botsDestroyed}</strong></div>
          </div>
          <p><strong>Discoveries:</strong> ${state.summary.discoveries.length > 0 ? state.summary.discoveries.join(", ") : "No new discoveries this mission."}</p>
          <p><strong>Rewards:</strong> ${state.summary.rewards.length > 0 ? state.summary.rewards.join(", ") : "No artifacts recovered this mission."}</p>
          <p><strong>Perfect commitment bonus:</strong> +${state.summary.perfectCommitmentReward.solar} solar, +${state.summary.perfectCommitmentReward.scrap} scrap</p>
          <button class="ui-button primary" data-action="continue-results">Return To Planning</button>
        </section>
      `);
    }

    if (state.phase === "run_over" && state.summary) {
      layers.push(`
        <section class="modal-card results-modal">
          <h2>${state.summary.title}</h2>
          <p>${state.summary.text}</p>
          <p><strong>Gains:</strong> S ${state.summary.gains.solar}, M ${state.summary.gains.minerals}, C ${state.summary.gains.scrap}</p>
          <p><strong>Discoveries:</strong> ${state.summary.discoveries.length > 0 ? state.summary.discoveries.join(", ") : "No new discoveries this final mission."}</p>
          <button class="ui-button primary" data-action="start-new-run">Start Fresh Run</button>
        </section>
      `);
    }

    const tutorialView = getTutorialStepView(state);
    if (tutorialView) {
      const continueButton = tutorialView.requiresContinue
        ? `<button class="ui-button primary" data-action="advance-tutorial">${tutorialView.continueLabel ?? "Continue"}</button>`
        : "";
      layers.push(`
        <div class="tutorial-shade"></div>
        <section class="tutorial-card">
          <span class="eyebrow">Tutorial</span>
          <h2>${tutorialView.title}</h2>
          <p>${tutorialView.body}</p>
          <div class="tutorial-actions">
            <button class="ui-button secondary" data-action="skip-tutorial">Skip Tutorial</button>
            ${continueButton}
          </div>
        </section>
      `);
    }

    return layers.join("");
  }

  private syncTutorialHighlights(state: RunState): void {
    for (const element of this.highlightedTargets) {
      element.classList.remove("tutorial-highlight");
    }
    this.highlightedTargets.clear();

    const tutorialView = getTutorialStepView(state);
    if (!tutorialView) {
      return;
    }

    for (const selector of tutorialView.targetSelectors) {
      const elements = this.root.querySelectorAll<HTMLElement>(selector);
      elements.forEach((element) => {
        element.classList.add("tutorial-highlight");
        this.highlightedTargets.add(element);
      });
    }
  }

  private getVisibleDockPanel(state: RunState): DockPanelId {
    const requested = state.ui.activeDockPanel;
    if (this.isDockPanelLocked(state, requested)) {
      return "ship";
    }
    return requested;
  }

  private isDockPanelLocked(state: RunState, panelId: DockPanelId): boolean {
    if (!state.tutorial.active) {
      return false;
    }
    return panelId === "log" || panelId === "bots" || panelId === "upgrades";
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
        return "Place modules on the ship, merge a pair into a bot when it makes sense, then press Start Mission.";
      case "execution":
        return "Bots mine, defend, and support automatically. Doctrine changes are optional and commitment always stays visible.";
      case "results":
      case "run_over":
        return "The debrief tells you what your ship earned, what it lost, and what to try next.";
      default:
        return "Start a new run to begin planning.";
    }
  }
}




