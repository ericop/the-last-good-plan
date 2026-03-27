import { DOCTRINES } from "../data/doctrines";
import { MERGE_RECIPES } from "../data/merges";
import { MODULE_DEFINITIONS } from "../data/modules";
import { UPGRADE_DEFINITIONS } from "../data/upgrades";
import type { GameController } from "../core/gameController";
import { getDiscoveryDescriptor, getMergePreviewFromModules } from "../core/discovery";
import { getArtifactById, getBotCapacity, getSlotById } from "../core/utils";
import type { ModuleId, RunState, UpgradeId } from "../types/gameTypes";

export class UIManager {
  private topBar: HTMLElement;
  private sideRail: HTMLElement;
  private modalLayer: HTMLElement;

  constructor(private root: HTMLElement, private controller: GameController) {
    root.innerHTML = `
      <div class="app-shell">
        <header class="top-bar" id="hud-top"></header>
        <div class="content-grid">
          <section class="game-column">
            <div class="canvas-shell">
              <div id="game-canvas"></div>
            </div>
          </section>
          <aside class="side-rail" id="side-rail"></aside>
        </div>
        <div class="modal-layer" id="modal-layer"></div>
      </div>
    `;

    const topBar = root.querySelector<HTMLElement>("#hud-top");
    const sideRail = root.querySelector<HTMLElement>("#side-rail");
    const modalLayer = root.querySelector<HTMLElement>("#modal-layer");
    if (!topBar || !sideRail || !modalLayer) {
      throw new Error("UI shell failed to initialize.");
    }
    this.topBar = topBar;
    this.sideRail = sideRail;
    this.modalLayer = modalLayer;

    this.root.addEventListener("click", this.handleClick);
    this.controller.subscribe((state) => {
      this.render(state);
    });
  }

  private handleClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    const actionElement = target.closest<HTMLElement>("[data-action]");
    if (!actionElement) {
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
      case "toggle-discovery":
        this.controller.dispatch({ type: "toggle_discovery_log" });
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
      default:
        break;
    }
  };

  private render(state: RunState): void {
    this.topBar.innerHTML = this.renderTopBar(state);
    this.sideRail.innerHTML = this.renderSideRail(state);
    this.modalLayer.innerHTML = this.renderModals(state);
  }

  private renderTopBar(state: RunState): string {
    if (state.phase === "menu") {
      return `
        <div class="top-card wide">
          <span class="eyebrow">Meta Knowledge</span>
          <strong>${state.meta.totalCyclesCompleted}</strong>
          <span>cycles completed</span>
        </div>
        <div class="top-card">
          <span class="eyebrow">Discoveries</span>
          <strong>${MERGE_RECIPES.filter((recipe) => state.discovery[recipe.id].state !== "unknown").length}/${MERGE_RECIPES.length}</strong>
          <span>merge patterns known</span>
        </div>
        <div class="top-card">
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
      <div class="top-card wide">
        <span class="eyebrow">Cycle ${state.cycle}</span>
        <strong>${state.phase.toUpperCase()}</strong>
        <span>${DOCTRINES[state.doctrine].name} doctrine</span>
      </div>
      <div class="top-card resource solar">
        <span class="eyebrow">Solar</span>
        <strong>${Math.round(state.resources.solar)}</strong>
        <span>stored</span>
      </div>
      <div class="top-card resource minerals">
        <span class="eyebrow">Minerals</span>
        <strong>${Math.round(state.resources.minerals)}</strong>
        <span>stored</span>
      </div>
      <div class="top-card resource scrap">
        <span class="eyebrow">Scrap</span>
        <strong>${Math.round(state.resources.scrap)}</strong>
        <span>stored</span>
      </div>
      <div class="top-card">
        <span class="eyebrow">Commitment</span>
        <strong>+${Math.round(state.commitmentBonus * 100)}%</strong>
        <span>bot efficiency</span>
      </div>
      <div class="top-card wide">
        <span class="eyebrow">Threat Preview</span>
        <strong>${nextThreatText}</strong>
        <span>${state.simulation.upcomingThreats.map((wave) => wave.label).join(" • ")}</span>
      </div>
      <div class="top-actions">
        <button class="ui-button secondary" data-action="toggle-discovery">${state.ui.showDiscoveryLog ? "Hide" : "Discovery Log"}</button>
        <button class="ui-button secondary" data-action="toggle-pause">${state.paused ? "Unpause" : "Pause"}</button>
      </div>
    `;
  }

  private renderSideRail(state: RunState): string {
    if (state.phase === "menu") {
      return `
        <section class="panel">
          <h2>What This MVP Includes</h2>
          <p>A single-screen run with calm planning, autonomous cycle execution, doctrine shifts, merge discovery, artifact rewards, and instant pause.</p>
          <p>Use the big button inside the game view to start. The sidebar becomes the planning console once the run begins.</p>
        </section>
      `;
    }

    const selectedSlots = state.ui.selectedSlotIds.map((slotId) => getSlotById(state.ship.slots, slotId)).filter(Boolean);
    const mergePreview = this.renderMergePreview(state);

    return `
      <section class="panel compact-grid">
        <div>
          <span class="eyebrow">Ship</span>
          <strong>${Math.round(state.ship.hull)}/${state.ship.maxHull} hull</strong>
        </div>
        <div>
          <span class="eyebrow">Shield</span>
          <strong>${Math.round(state.ship.shield)}/${state.ship.maxShield}</strong>
        </div>
        <div>
          <span class="eyebrow">Bots</span>
          <strong>${state.ship.bots.length}/${getBotCapacity(state)}</strong>
        </div>
        <div>
          <span class="eyebrow">Moon</span>
          <strong>${Math.max(0, Math.round(state.simulation.objective.integrity))}</strong>
        </div>
      </section>

      <section class="panel">
        <h2>Doctrine</h2>
        <p>${DOCTRINES[state.doctrine].summary}</p>
        <div class="button-stack">
          ${Object.values(DOCTRINES)
            .map(
              (doctrine) => `
                <button class="ui-button ${state.doctrine === doctrine.id ? "selected" : ""}" data-action="set-doctrine" data-doctrine="${doctrine.id}">
                  ${doctrine.name}
                </button>
              `,
            )
            .join("")}
        </div>
        <p class="fine-print">During execution, each doctrine change costs 10% commitment. You never need to change it to survive.</p>
      </section>

      ${state.phase === "planning" ? this.renderFabricationPanel(state) : ""}
      ${state.phase === "planning" ? mergePreview : this.renderExecutionPanel(state)}
      ${state.phase === "planning" ? this.renderUpgradePanel(state) : ""}

      <section class="panel">
        <h2>Fleet and Artifacts</h2>
        <div class="tag-list">
          ${state.ship.bots.length > 0 ? state.ship.bots.map((bot) => `<span class="tag">${bot.name}</span>`).join("") : `<span class="empty-state">No bots assembled yet</span>`}
        </div>
        <div class="artifact-list">
          ${state.ship.artifacts.length > 0 ? state.ship.artifacts.map((artifactId) => {
            const artifact = getArtifactById(artifactId);
            return artifact ? `<div class="artifact-chip"><strong>${artifact.name}</strong><span>${artifact.summary}</span></div>` : "";
          }).join("") : `<span class="empty-state">No artifacts installed yet</span>`}
        </div>
      </section>

      <section class="panel">
        <h2>Message Log</h2>
        <div class="log-list">
          ${state.simulation.messageLog.map((entry) => `<div class="log-entry">${entry}</div>`).join("")}
        </div>
      </section>

      ${state.phase === "planning" ? `<button class="ui-button primary large" data-action="begin-execution">Begin Cycle</button>` : ""}
    `;
  }

  private renderFabricationPanel(state: RunState): string {
    return `
      <section class="panel">
        <h2>Fabricate Modules</h2>
        <div class="module-grid">
          ${Object.values(MODULE_DEFINITIONS)
            .map((module) => {
              const selected = state.ui.selectedFabricationModuleId === module.id;
              return `
                <button class="module-card ${selected ? "selected" : ""}" data-action="fabricate" data-module="${module.id}">
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

  private renderMergePreview(state: RunState): string {
    const slots = state.ui.selectedSlotIds
      .map((slotId) => getSlotById(state.ship.slots, slotId))
      .filter((slot): slot is NonNullable<typeof slot> => Boolean(slot));
    let body = `<p>Select two adjacent occupied slots to preview a merge.</p>`;
    let action = "";

    if (slots.length === 2 && slots[0].moduleId && slots[1].moduleId) {
      const adjacent = slots[0].neighbors.includes(slots[1].id);
      if (!adjacent) {
        body = `
          <p><strong>${slots[0].label}</strong> + <strong>${slots[1].label}</strong></p>
          <p>These modules are compatible in theory, but they must sit in adjacent slots before the merge can stabilize.</p>
        `;
      } else {
        const preview = getMergePreviewFromModules([slots[0].moduleId, slots[1].moduleId], state.discovery);
        body = `
          <p><strong>${slots[0].label}</strong> + <strong>${slots[1].label}</strong></p>
          <p>${preview.text}</p>
        `;
        if (preview.recipe) {
          action = `<button class="ui-button primary" data-action="merge-selected">Commit Merge</button>`;
        }
      }
    }

    return `
      <section class="panel">
        <h2>Merge Preview</h2>
        ${body}
        <p class="fine-print">Merges permanently consume both modules and create an autonomous bot. There is no undo.</p>
        ${action}
      </section>
    `;
  }

  private renderUpgradePanel(state: RunState): string {
    return `
      <section class="panel">
        <h2>Upgrade Nodes</h2>
        <div class="button-stack">
          ${Object.values(UPGRADE_DEFINITIONS)
            .map((upgrade) => {
              const level = state.ship.upgrades[upgrade.id];
              const nextCost = upgrade.costs[level];
              return `
                <button class="ui-button secondary" data-action="spend-upgrade" data-upgrade="${upgrade.id}">
                  ${upgrade.name} Lv.${level}
                  <span>${upgrade.summary}</span>
                  <small>${nextCost ? `S ${nextCost.solar} • M ${nextCost.minerals} • C ${nextCost.scrap}` : "Maxed"}</small>
                </button>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  private renderExecutionPanel(state: RunState): string {
    return `
      <section class="panel">
        <h2>Execution Feed</h2>
        <p>Bots are resolving the plan automatically. Commitment directly boosts overall bot efficiency for mining, attack, and support.</p>
        <div class="compact-grid">
          <div>
            <span class="eyebrow">Commitment</span>
            <strong>+${Math.round(state.commitmentBonus * 100)}%</strong>
          </div>
          <div>
            <span class="eyebrow">Changes</span>
            <strong>${state.doctrineChangesThisCycle}</strong>
          </div>
          <div>
            <span class="eyebrow">Elapsed</span>
            <strong>${state.simulation.elapsed.toFixed(1)}s</strong>
          </div>
          <div>
            <span class="eyebrow">Duration</span>
            <strong>${state.simulation.duration}s</strong>
          </div>
        </div>
        <button class="ui-button secondary" data-action="toggle-pause">${state.paused ? "Resume Cycle" : "Pause Cycle"}</button>
      </section>
    `;
  }

  private renderModals(state: RunState): string {
    const modals: string[] = [];

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
      modals.push(`
        <section class="modal-card reward-modal">
          <h2>${state.pendingReward.source === "moon" ? "Ancient Artifact" : "Recovered Chest"}</h2>
          <p>Choose exactly one reward for the run. Execution resumes after you decide.</p>
          <div class="reward-grid">${choices}</div>
        </section>
      `);
    }

    if (state.ui.showDiscoveryLog) {
      modals.push(`
        <section class="modal-card discovery-modal">
          <div class="modal-header">
            <h2>Discovery Log</h2>
            <button class="ui-button secondary" data-action="toggle-discovery">Close</button>
          </div>
          <div class="discovery-list">
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
        </section>
      `);
    }

    if (state.phase === "results" && state.summary) {
      modals.push(`
        <section class="modal-card results-modal">
          <h2>${state.summary.title}</h2>
          <p>${state.summary.text}</p>
          <div class="compact-grid summary-grid">
            <div><span class="eyebrow">Solar</span><strong>${state.summary.gains.solar}</strong></div>
            <div><span class="eyebrow">Minerals</span><strong>${state.summary.gains.minerals}</strong></div>
            <div><span class="eyebrow">Scrap</span><strong>${state.summary.gains.scrap}</strong></div>
            <div><span class="eyebrow">Bots Lost</span><strong>${state.summary.losses.botsDestroyed}</strong></div>
          </div>
          <p><strong>Discoveries:</strong> ${state.summary.discoveries.length > 0 ? state.summary.discoveries.join(", ") : "No new discoveries this cycle."}</p>
          <p><strong>Rewards:</strong> ${state.summary.rewards.length > 0 ? state.summary.rewards.join(", ") : "No artifacts recovered this cycle."}</p>
          <p><strong>Perfect commitment bonus:</strong> +${state.summary.perfectCommitmentReward.solar} solar, +${state.summary.perfectCommitmentReward.scrap} scrap</p>
          <button class="ui-button primary" data-action="continue-results">Return To Planning</button>
        </section>
      `);
    }

    if (state.phase === "run_over" && state.summary) {
      modals.push(`
        <section class="modal-card results-modal">
          <h2>${state.summary.title}</h2>
          <p>${state.summary.text}</p>
          <p><strong>Gains:</strong> S ${state.summary.gains.solar}, M ${state.summary.gains.minerals}, C ${state.summary.gains.scrap}</p>
          <p><strong>Discoveries:</strong> ${state.summary.discoveries.length > 0 ? state.summary.discoveries.join(", ") : "No new discoveries this run-ending cycle."}</p>
          <button class="ui-button primary" data-action="start-new-run">Start Fresh Run</button>
        </section>
      `);
    }

    return modals.join("");
  }
}


