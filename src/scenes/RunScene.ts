import Phaser from "phaser";
import { getEpicModuleById, getSlotModulePresentation } from "../data/epicModuleRegistry";
import { getMergePreviewFromModules } from "../core/discovery";
import type { GameController } from "../core/gameController";
import { getPhaseLabel } from "../core/tutorial";
import { GAME_HEIGHT, GAME_WIDTH, SHIP_CENTER, SLOT_SIZE } from "../game/constants";
import {
  AssemblyEffectsManager,
  drawMechanicalModulePlate,
  type BotView,
  type ModuleView,
  type SlotView,
} from "../game/effects/assemblyEffects";
import { createStarfield, drawAmbientPanel, drawMechanicalHalo, type StarfieldHandle } from "../game/effects/ambientVisuals";
import type { BotInstance, EpicModuleId, ModuleId, RunState, ShipSlot } from "../types/gameTypes";

interface VisualSnapshot {
  phase: RunState["phase"];
  slotModules: Record<string, ModuleId | undefined>;
  slotEpicModules: Record<string, EpicModuleId | undefined>;
  selectedSlotIds: string[];
  botIds: string[];
  bots: BotView[];
}

export class RunScene extends Phaser.Scene {
  private controller!: GameController;
  private graphics!: Phaser.GameObjects.Graphics;
  private slotLabelTexts = new Map<string, Phaser.GameObjects.Text>();
  private slotCodeTexts = new Map<string, Phaser.GameObjects.Text>();
  private threatTexts: Phaser.GameObjects.Text[] = [];
  private threatTitleText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private bossLabelText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private overlayText!: Phaser.GameObjects.Text;
  private starfield!: StarfieldHandle;
  private assemblyEffects!: AssemblyEffectsManager;
  private visualTime = 0;
  private visualSnapshot?: VisualSnapshot;

  constructor() {
    super("run");
  }

  create(): void {
    this.controller = this.registry.get("controller") as GameController;
    this.graphics = this.add.graphics();
    this.starfield = createStarfield(this, { width: GAME_WIDTH, height: GAME_HEIGHT });
    this.assemblyEffects = new AssemblyEffectsManager(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.starfield.destroy();
      this.assemblyEffects.destroy();
    });

    const state = this.controller.getState();
    for (const slot of state.ship.slots) {
      const zone = this.add.zone(slot.x, slot.y, SLOT_SIZE, SLOT_SIZE).setInteractive({ useHandCursor: true });
      zone.on("pointerdown", () => {
        this.controller.dispatch({ type: "board_slot_pressed", slotId: slot.id });
      });
      zone.on("pointerover", () => {
        this.assemblyEffects.setHoveredSlot(slot.id);
      });
      zone.on("pointerout", () => {
        this.assemblyEffects.setHoveredSlot(undefined);
      });

      const labelText = this.add.text(slot.x - 30, slot.y - 34, slot.label, {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "12px",
        color: "#9cc1cf",
      });
      const codeText = this.add
        .text(slot.x, slot.y, "", {
          fontFamily: "Trebuchet MS, Verdana, sans-serif",
          fontSize: "16px",
          color: "#091016",
          align: "center",
        })
        .setOrigin(0.5);
      this.slotLabelTexts.set(slot.id, labelText);
      this.slotCodeTexts.set(slot.id, codeText);
    }

    this.threatTitleText = this.add.text(728, 372, "Waves", {
      fontFamily: "Trebuchet MS, Verdana, sans-serif",
      fontSize: "14px",
      color: "#d3edf6",
    });

    for (let index = 0; index < 4; index += 1) {
      this.threatTexts.push(
        this.add.text(728, 400 + index * 30, "", {
          fontFamily: "Trebuchet MS, Verdana, sans-serif",
          fontSize: "12px",
          color: "#f7dba0",
          wordWrap: { width: 176 },
        }),
      );
    }

    this.phaseText = this.add.text(24, 20, "", {
      fontFamily: "Trebuchet MS, Verdana, sans-serif",
      fontSize: "18px",
      color: "#e6f3ff",
    });
    this.objectiveText = this.add.text(664, 68, "", {
      fontFamily: "Trebuchet MS, Verdana, sans-serif",
      fontSize: "16px",
      color: "#d3edf6",
    });
    this.bossLabelText = this.add
      .text(GAME_WIDTH / 2, 48, "", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "13px",
        color: "#f2e3b4",
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setDepth(3)
      .setVisible(false);    this.hintText = this.add.text(28, 594, "", {
      fontFamily: "Trebuchet MS, Verdana, sans-serif",
      fontSize: "14px",
      color: "#9fc6d8",
      wordWrap: { width: 680 },
    });
    this.overlayText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "", {
        fontFamily: "Georgia, serif",
        fontSize: "30px",
        color: "#f7f4df",
        align: "center",
        wordWrap: { width: 420 },
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setVisible(false);

    this.input.keyboard?.on("keydown-SPACE", (event: KeyboardEvent) => {
      event.preventDefault();
      this.controller.dispatch({ type: "toggle_pause" });
    });
    this.input.keyboard?.on("keydown-D", () => {
      this.controller.dispatch({ type: "toggle_discovery_log" });
    });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.visualTime += dt;
    this.starfield.update(dt);
    this.controller.update(dt);
    const state = this.controller.getState();
    this.syncAssemblyEffects(state);
    this.renderState(state);
    this.visualSnapshot = this.captureVisualSnapshot(state);
  }

  private renderState(state: RunState): void {
    this.graphics.clear();
    this.drawBackground();
    this.drawPlayfield(state);
    this.drawSlots(state);
    this.drawObjective(state);
    this.drawBossHud(state);
    this.drawBots(state);
    this.drawEnemies(state);
    this.assemblyEffects.drawOverlay(this.graphics);
    this.updateTexts(state);
    this.drawOverlay(state);
  }

  private drawBackground(): void {
    this.graphics.fillStyle(0x061018, 1);
    this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.starfield.draw(this.graphics);
    this.graphics.fillStyle(0x08131b, 0.18);
    this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  private drawPlayfield(state: RunState): void {
    const time = this.visualTime;

    drawAmbientPanel(this.graphics, 24, 52, 420, 520, 18, time);
    drawAmbientPanel(this.graphics, 470, 52, 466, 520, 18, time + 1.2);
    drawMechanicalHalo(this.graphics, SHIP_CENTER.x, SHIP_CENTER.y, time);

    this.graphics.lineStyle(2, 0x4f7d8d, 0.3);
    this.graphics.strokeCircle(SHIP_CENTER.x, SHIP_CENTER.y, 118);
    this.graphics.strokeCircle(SHIP_CENTER.x, SHIP_CENTER.y, 134);

    const shieldRatio = state.ship.shield / state.ship.maxShield;
    this.graphics.lineStyle(8, 0x79d0e6, 0.85);
    this.graphics.beginPath();
    this.graphics.arc(
      SHIP_CENTER.x,
      SHIP_CENTER.y,
      146,
      Phaser.Math.DegToRad(-90),
      Phaser.Math.DegToRad(-90 + shieldRatio * 360),
      false,
    );
    this.graphics.strokePath();

    const hullRatio = state.ship.hull / state.ship.maxHull;
    this.graphics.lineStyle(8, 0xe9d78d, 0.85);
    this.graphics.beginPath();
    this.graphics.arc(
      SHIP_CENTER.x,
      SHIP_CENTER.y,
      160,
      Phaser.Math.DegToRad(-90),
      Phaser.Math.DegToRad(-90 + hullRatio * 360),
      false,
    );
    this.graphics.strokePath();

    this.graphics.fillStyle(0x112636, 0.92);
    this.graphics.fillCircle(SHIP_CENTER.x, SHIP_CENTER.y, 82);

    drawAmbientPanel(this.graphics, 620, 112, 232, 118, 18, time + 2.1);
    drawAmbientPanel(this.graphics, 712, 356, 208, 182, 16, time + 3.2);
  }

  private drawSlots(state: RunState): void {
    const slotViews = state.ship.slots.map((slot) => this.createSlotView(slot));
    this.assemblyEffects.drawUnderlay(this.graphics, slotViews, this.visualTime);

    const drawnPairs = new Set<string>();
    for (const slot of state.ship.slots) {
      for (const neighborId of slot.neighbors) {
        const neighbor = state.ship.slots.find((candidate) => candidate.id === neighborId);
        if (!neighbor || !slot.moduleId || !neighbor.moduleId) {
          continue;
        }
        const key = [slot.id, neighbor.id].sort().join("|");
        if (drawnPairs.has(key)) {
          continue;
        }
        drawnPairs.add(key);
        this.graphics.lineStyle(2, slot.epicModuleId || neighbor.epicModuleId ? 0xf0d27a : 0x406a7f, 0.45);
        this.graphics.lineBetween(slot.x, slot.y, neighbor.x, neighbor.y);
      }
    }

    const tutorialTargets = this.getTutorialSlotTargets(state);

    for (const slot of state.ship.slots) {
      const slotView = this.createSlotView(slot);
      const selected = state.ui.selectedSlotIds.includes(slot.id);
      const recommended = tutorialTargets.has(slot.id);
      const attention = this.assemblyEffects.getSlotAttention(slot.id, this.visualTime);
      const shellSize = SLOT_SIZE + (selected ? 4 : 0);

      this.graphics.fillStyle(selected ? 0x284f62 : 0x143243, 1);
      this.graphics.fillRoundedRect(slot.x - shellSize / 2, slot.y - shellSize / 2, shellSize, shellSize, 14);
      this.graphics.lineStyle(2, selected ? 0xdaf5ff : recommended ? 0xf0cf7d : 0x5a7b8a, 0.95);
      this.graphics.strokeRoundedRect(slot.x - shellSize / 2, slot.y - shellSize / 2, shellSize, shellSize, 14);

      if (recommended) {
        this.graphics.lineStyle(4, 0xf0cf7d, 0.28);
        this.graphics.strokeRoundedRect(slot.x - SLOT_SIZE / 2 - 4, slot.y - SLOT_SIZE / 2 - 4, SLOT_SIZE + 8, SLOT_SIZE + 8, 16);
      }

      if (attention.flashAlpha > 0.01) {
        this.graphics.lineStyle(2, 0xf0d27a, attention.flashAlpha * 0.8);
        this.graphics.strokeRoundedRect(
          slot.x - SLOT_SIZE / 2 + attention.flashInset,
          slot.y - SLOT_SIZE / 2 + attention.flashInset,
          SLOT_SIZE - attention.flashInset * 2,
          SLOT_SIZE - attention.flashInset * 2,
          16,
        );
      }

      const codeText = this.slotCodeTexts.get(slot.id);
      if (!slot.moduleId) {
        codeText
          ?.setText(state.phase === "planning" ? "+" : "")
          .setColor(recommended ? "#f7e6a7" : "#9dc0d0")
          .setPosition(slot.x, slot.y)
          .setScale(1)
          .setRotation(0)
          .setAlpha(1);
        continue;
      }

      const moduleView = this.createModuleView(slot, slot.moduleId, slot.epicModuleId);
      const renderState = this.assemblyEffects.getModuleRenderState(slotView, this.visualTime, selected, recommended);
      drawMechanicalModulePlate(this.graphics, moduleView, renderState);
      if (slot.epicModuleId) {
        this.graphics.lineStyle(2, 0xf0d27a, 0.7);
        this.graphics.strokeCircle(renderState.x + 18, renderState.y - 16, 7 * renderState.scale);
      }
      codeText
        ?.setText(moduleView.shortName)
        .setColor(slot.epicModuleId ? "#13100a" : "#091016")
        .setPosition(renderState.x, renderState.y)
        .setScale(renderState.textScale)
        .setRotation(renderState.rotation * 0.5)
        .setAlpha(renderState.textAlpha);
    }
  }

  private drawObjective(state: RunState): void {
    const integrityRatio = state.simulation.objective.integrity / state.simulation.objective.maxIntegrity;
    this.graphics.fillStyle(0x8c8a87, 1);
    this.graphics.fillCircle(744, 166, 36);
    this.graphics.fillStyle(0x6d655a, 1);
    this.graphics.fillCircle(758, 154, 11);
    this.graphics.fillCircle(726, 178, 9);
    this.graphics.fillStyle(0xd6c085, 0.9);
    this.graphics.fillRect(632, 210, 208 * integrityRatio, 10);
    this.graphics.lineStyle(2, 0x5ea8c9, 0.7);
    this.graphics.strokeRect(632, 210, 208, 10);

    if (state.simulation.objective.integrity <= 0) {
      this.graphics.fillStyle(0xf0d27a, 0.8);
      this.graphics.fillCircle(744, 166, 12);
    }
  }

  private drawBossHud(state: RunState): void {
    const boss = state.simulation.enemies.find((enemy) => enemy.kind === "boss");
    if (!boss) {
      this.bossLabelText.setVisible(false);
      return;
    }

    const width = 340;
    const x = GAME_WIDTH / 2 - width / 2;
    const y = 40;
    const hpRatio = boss.hp / boss.maxHp;
    const shieldRatio = boss.maxBossShield ? (boss.bossShield ?? 0) / boss.maxBossShield : 0;

    this.graphics.fillStyle(0x07131c, 0.88);
    this.graphics.fillRoundedRect(x, y, width, 44, 12);
    this.graphics.lineStyle(1, boss.color, 0.72);
    this.graphics.strokeRoundedRect(x, y, width, 44, 12);

    this.graphics.fillStyle(0x14222d, 1);
    this.graphics.fillRoundedRect(x + 12, y + 18, width - 24, 10, 5);
    if (shieldRatio > 0) {
      this.graphics.fillStyle(0x6dd4ff, 0.85);
      this.graphics.fillRoundedRect(x + 12, y + 18, (width - 24) * shieldRatio, 10, 5);
    }
    this.graphics.fillStyle(boss.color, 0.9);
    this.graphics.fillRoundedRect(x + 12, y + 30, (width - 24) * hpRatio, 8, 4);

    this.graphics.fillStyle(0xf1e8ca, 0.92);
    this.graphics.fillCircle(x + 18, y + 11, 3);

    const telegraph = state.simulation.bossEncounter.telegraph;
    const telegraphText = telegraph ? ` | ${telegraph}` : "";
    this.phaseText.setDepth(2);
    this.bossLabelText.setText(`${boss.name}${telegraphText}`).setPosition(GAME_WIDTH / 2, y + 4).setVisible(true);
  }
  private drawBots(state: RunState): void {
    for (const bot of state.ship.bots) {
      if (this.assemblyEffects.isBotSuppressed(bot.id)) {
        continue;
      }
      this.drawBot(bot);
    }
  }

  private drawBot(bot: BotInstance): void {
    this.graphics.fillStyle(bot.color, 1);
    if (bot.role === "support") {
      this.graphics.fillCircle(bot.x, bot.y, 12);
    } else if (bot.role === "defense") {
      this.graphics.fillRoundedRect(bot.x - 12, bot.y - 12, 24, 24, 5);
    } else if (bot.role === "mining") {
      this.graphics.fillTriangle(bot.x, bot.y - 14, bot.x - 13, bot.y + 12, bot.x + 13, bot.y + 12);
    } else {
      const points = [
        new Phaser.Geom.Point(bot.x, bot.y - 14),
        new Phaser.Geom.Point(bot.x + 14, bot.y),
        new Phaser.Geom.Point(bot.x, bot.y + 14),
        new Phaser.Geom.Point(bot.x - 14, bot.y),
      ];
      this.graphics.fillPoints(points, true);
    }

    if (bot.epicModules.length > 0) {
      this.graphics.lineStyle(2, 0xf0d27a, 0.65);
      this.graphics.strokeCircle(bot.x, bot.y, 17);
    }

    const ratio = bot.hp / bot.maxHp;
    this.graphics.fillStyle(0x182029, 1);
    this.graphics.fillRect(bot.x - 16, bot.y + 18, 32, 4);
    this.graphics.fillStyle(0xa8f29e, 1);
    this.graphics.fillRect(bot.x - 16, bot.y + 18, 32 * ratio, 4);
  }

  private drawEnemies(state: RunState): void {
    for (const enemy of state.simulation.enemies) {
      this.graphics.fillStyle(enemy.color, 1);
      if (enemy.kind === "mini_boss" || enemy.kind === "boss") {
        const width = enemy.kind === "boss" ? 52 : 44;
        const height = enemy.kind === "boss" ? 42 : 36;
        this.graphics.fillRoundedRect(enemy.x - width / 2, enemy.y - height / 2, width, height, 8);
        this.graphics.lineStyle(2, enemy.kind === "boss" ? 0xf0d27a : 0xfee2a2, 0.8);
        this.graphics.strokeRoundedRect(enemy.x - width / 2, enemy.y - height / 2, width, height, 8);
      } else {
        const points = [
          new Phaser.Geom.Point(enemy.x, enemy.y - 14),
          new Phaser.Geom.Point(enemy.x + 14, enemy.y),
          new Phaser.Geom.Point(enemy.x, enemy.y + 14),
          new Phaser.Geom.Point(enemy.x - 14, enemy.y),
        ];
        this.graphics.fillPoints(points, true);
      }

      const ratio = enemy.hp / enemy.maxHp;
      this.graphics.fillStyle(0x1d1414, 1);
      this.graphics.fillRect(enemy.x - 18, enemy.y - 26, 36, 4);
      if (enemy.kind === "boss" && (enemy.maxBossShield ?? 0) > 0) {
        const shieldRatio = (enemy.bossShield ?? 0) / (enemy.maxBossShield ?? 1);
        this.graphics.fillStyle(0x6dd4ff, 0.9);
        this.graphics.fillRect(enemy.x - 18, enemy.y - 32, 36 * shieldRatio, 4);
      }
      this.graphics.fillStyle(0xf7b098, 1);
      this.graphics.fillRect(enemy.x - 18, enemy.y - 26, 36 * ratio, 4);
    }
  }

  private updateTexts(state: RunState): void {
    this.phaseText.setText(
      `Cycle ${state.cycle} | ${getPhaseLabel(state.phase)} | Hull ${Math.round(state.ship.hull)}/${state.ship.maxHull} | Shield ${Math.round(state.ship.shield)}/${state.ship.maxShield}`,
    );
    this.objectiveText.setText(
      `Moon Objective\nIntegrity ${Math.max(0, Math.round(state.simulation.objective.integrity))}/${state.simulation.objective.maxIntegrity}`,
    );
    this.hintText.setText(this.getHintText(state));

    const upcoming = state.simulation.upcomingThreats.slice(0, 4);
    upcoming.forEach((wave, index) => {
      const text = this.threatTexts[index];
      const spawned = index < state.simulation.threatCursor;
      const countdown = Math.max(0, wave.time - state.simulation.elapsed);
      text.setText(spawned ? `${wave.label} | deployed` : `${wave.label} | ${countdown.toFixed(1)}s`);
      text.setColor(spawned ? "#7ec9a9" : wave.kind === "boss" ? "#f2e3b4" : "#f7dba0");
    });

    for (const slot of state.ship.slots) {
      const labelText = this.slotLabelTexts.get(slot.id);
      labelText?.setColor(state.ui.selectedSlotIds.includes(slot.id) ? "#dfffee" : "#9cc1cf");
    }
  }

  private drawOverlay(state: RunState): void {
    if (state.simulation.bossEncounter.introTimer > 0 && state.simulation.bossEncounter.activeBossName) {
      this.graphics.fillStyle(0x050b10, 0.46);
      this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      this.overlayText
        .setText(`${state.simulation.bossEncounter.activeBossName}\nAncient signal spike detected`)
        .setVisible(true);
      return;
    }
    if (state.paused && state.phase === "execution") {
      this.graphics.fillStyle(0x07131c, 0.52);
      this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      this.overlayText.setText("Paused\nThe mission is fully frozen.").setVisible(true);
      return;
    }
    if (state.pendingReward) {
      this.graphics.fillStyle(0x07131c, 0.28);
      this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      this.overlayText.setText("Reward choice ready\nPick one reward in the overlay.").setVisible(true);
      return;
    }
    this.overlayText.setVisible(false);
  }

  private syncAssemblyEffects(state: RunState): void {
    const current = this.captureVisualSnapshot(state);
    const previous = this.visualSnapshot;

    if (!previous) {
      return;
    }

    for (const slot of state.ship.slots) {
      const previousModule = previous.slotModules[slot.id];
      if (!previousModule && slot.moduleId) {
        this.assemblyEffects.animateModulePlacement(
          this.createModuleView(slot, slot.moduleId, slot.epicModuleId),
          this.createSlotView(slot),
        );
      }
    }

    const selectionUnion = new Set([...previous.selectedSlotIds, ...current.selectedSlotIds]);
    for (const slotId of selectionUnion) {
      const wasSelected = previous.selectedSlotIds.includes(slotId);
      const isSelected = current.selectedSlotIds.includes(slotId);
      if (wasSelected === isSelected) {
        continue;
      }
      const slot = this.findSlot(state.ship.slots, slotId);
      const moduleId = slot?.moduleId ?? previous.slotModules[slotId];
      const epicModuleId = slot?.epicModuleId ?? previous.slotEpicModules[slotId];
      if (!slot || !moduleId) {
        continue;
      }
      this.assemblyEffects.setModuleSelectedState(this.createModuleView(slot, moduleId, epicModuleId), isSelected);
    }

    const selectedModuleViews = current.selectedSlotIds
      .map((slotId) => {
        const slot = this.findSlot(state.ship.slots, slotId);
        return slot?.moduleId ? this.createModuleView(slot, slot.moduleId, slot.epicModuleId) : undefined;
      })
      .filter((moduleView): moduleView is ModuleView => Boolean(moduleView));

    if (state.phase === "planning" && selectedModuleViews.length >= 2 && selectedModuleViews.length <= 3) {
      const preview = getMergePreviewFromModules(
        selectedModuleViews.map((moduleView) => moduleView.moduleId),
        state.discovery,
      );
      if (preview.recipe) {
        this.assemblyEffects.showCombinePreview(selectedModuleViews, {
          id: preview.recipe.id,
          name: preview.recipe.resultName,
          color: preview.recipe.color,
          role: preview.recipe.role,
        });
      } else {
        this.assemblyEffects.clearCombinePreview();
      }
    } else {
      this.assemblyEffects.clearCombinePreview();
    }

    const newBot = current.bots.find((bot) => !previous.botIds.includes(bot.id));
    const previousSelectedModules = previous.selectedSlotIds
      .map((slotId) => {
        const slot = this.findSlot(state.ship.slots, slotId);
        const moduleId = previous.slotModules[slotId];
        const epicModuleId = previous.slotEpicModules[slotId];
        return slot && moduleId ? this.createModuleView(slot, moduleId, epicModuleId) : undefined;
      })
      .filter((moduleView): moduleView is ModuleView => Boolean(moduleView));

    if (newBot && previousSelectedModules.length >= 2 && previousSelectedModules.length <= 3) {
      const mergePreview = getMergePreviewFromModules(previousSelectedModules.map((moduleView) => moduleView.moduleId), state.discovery);
      const consumedSlots = previous.selectedSlotIds.every((slotId) => !current.slotModules[slotId]);
      if (mergePreview.recipe && consumedSlots) {
        this.assemblyEffects.animateBotMerge(previousSelectedModules, newBot);
      }
    }
  }

  private captureVisualSnapshot(state: RunState): VisualSnapshot {
    return {
      phase: state.phase,
      slotModules: Object.fromEntries(state.ship.slots.map((slot) => [slot.id, slot.moduleId])),
      slotEpicModules: Object.fromEntries(state.ship.slots.map((slot) => [slot.id, slot.epicModuleId])),
      selectedSlotIds: [...state.ui.selectedSlotIds],
      botIds: state.ship.bots.map((bot) => bot.id),
      bots: state.ship.bots.map((bot) => ({
        id: bot.id,
        x: bot.x,
        y: bot.y,
        color: bot.color,
        role: bot.role,
        name: bot.name,
      })),
    };
  }

  private createSlotView(slot: ShipSlot): SlotView {
    return {
      id: slot.id,
      x: slot.x,
      y: slot.y,
      size: SLOT_SIZE,
    };
  }

  private createModuleView(slot: ShipSlot, moduleId: ModuleId, epicModuleId?: EpicModuleId): ModuleView {
    const presentation = epicModuleId
      ? {
          moduleId,
          shortName: getEpicModuleById(epicModuleId).shortName,
          color: getEpicModuleById(epicModuleId).color,
        }
      : getSlotModulePresentation({ ...slot, moduleId, epicModuleId })!;
    return {
      slotId: slot.id,
      moduleId,
      x: slot.x,
      y: slot.y,
      size: SLOT_SIZE,
      color: presentation.color,
      shortName: presentation.shortName,
    };
  }

  private getTutorialSlotTargets(state: RunState): Set<string> {
    if (!state.tutorial.active || state.phase !== "planning") {
      return new Set<string>();
    }

    switch (state.tutorial.stepId) {
      case "place_solar_collector":
      case "place_third_module":
        return new Set(state.ship.slots.filter((slot) => !slot.moduleId).map((slot) => slot.id));
      case "place_mineral_drill": {
        const solarSlot = state.ship.slots.find((slot) => slot.moduleId === "solar_collector");
        if (!solarSlot) {
          return new Set(state.ship.slots.filter((slot) => !slot.moduleId).map((slot) => slot.id));
        }
        return new Set(solarSlot.neighbors.filter((neighborId) => !this.findSlot(state.ship.slots, neighborId)?.moduleId));
      }
      case "merge_bot":
        return new Set(
          state.ship.slots
            .filter((slot) => slot.moduleId === "solar_collector" || slot.moduleId === "mineral_drill")
            .map((slot) => slot.id),
        );
      default:
        return new Set<string>();
    }
  }

  private getHintText(state: RunState): string {
    if (state.tutorial.active) {
      switch (state.tutorial.stepId) {
        case "place_solar_collector":
          return "Click Solar Collector, then click an empty ship slot, like C3.";
        case "place_mineral_drill":
          return "Place the Mineral Drill. You will merge it with the Solar Collector in the next step.";
        case "place_third_module":
          return "Place one more module to round out the ship. Shield Emitter or Cargo Core are both good tutorial picks.";
        case "merge_bot":
          return "Select the Solar Collector and Mineral Drill, then press Create Bot in the Bots tab.";
        case "select_doctrine":
          return "Balanced is recommended for the first mission. Click it once in the Doctrine tab.";
        case "start_mission":
          return "The big Start Mission button is ready when you are.";
        case "mission_running":
          return "Watch the system run. You can change doctrine mid-mission, but each change costs 10% commitment.";
        default:
          return "Follow the highlighted action to keep the tutorial moving.";
      }
    }

    if (state.phase === "planning") {
      return "Place modules on the ship, select any pair or trio to preview a merge, and press Start Mission when the plan looks ready.";
    }

    return "Mission resolution is automatic. Space pauses instantly, and doctrine changes are optional but reduce commitment.";
  }

  private findSlot(slots: ShipSlot[], slotId: string): ShipSlot | undefined {
    return slots.find((slot) => slot.id === slotId);
  }
}