import Phaser from "phaser";
import type { GameController } from "../core/gameController";
import { getPhaseLabel } from "../core/tutorial";
import { MODULE_DEFINITIONS } from "../data/modules";
import { BOARD_ORIGIN, GAME_HEIGHT, GAME_WIDTH, OBJECTIVE_POINT, SHIP_CENTER, SLOT_GAP, SLOT_SIZE } from "../game/constants";
import type { BotInstance, RunState, ShipSlot } from "../types/gameTypes";

export class RunScene extends Phaser.Scene {
  private controller!: GameController;
  private graphics!: Phaser.GameObjects.Graphics;
  private slotLabelTexts = new Map<string, Phaser.GameObjects.Text>();
  private slotCodeTexts = new Map<string, Phaser.GameObjects.Text>();
  private threatTexts: Phaser.GameObjects.Text[] = [];
  private phaseText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private overlayText!: Phaser.GameObjects.Text;
  private stars: Array<{ x: number; y: number; size: number; alpha: number }> = [];

  constructor() {
    super("run");
  }

  create(): void {
    this.controller = this.registry.get("controller") as GameController;
    this.graphics = this.add.graphics();
    this.stars = Array.from({ length: 74 }, () => ({
      x: Phaser.Math.Between(0, GAME_WIDTH),
      y: Phaser.Math.Between(0, GAME_HEIGHT),
      size: Phaser.Math.FloatBetween(0.7, 2.2),
      alpha: Phaser.Math.FloatBetween(0.15, 0.6),
    }));

    const state = this.controller.getState();
    for (const slot of state.ship.slots) {
      const zone = this.add.zone(slot.x, slot.y, SLOT_SIZE, SLOT_SIZE).setInteractive({ useHandCursor: true });
      zone.on("pointerdown", () => {
        this.controller.dispatch({ type: "board_slot_pressed", slotId: slot.id });
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
          color: "#0b1217",
          align: "center",
        })
        .setOrigin(0.5);
      this.slotLabelTexts.set(slot.id, labelText);
      this.slotCodeTexts.set(slot.id, codeText);
    }

    for (let index = 0; index < 4; index += 1) {
      this.threatTexts.push(
        this.add.text(772, 430 + index * 34, "", {
          fontFamily: "Trebuchet MS, Verdana, sans-serif",
          fontSize: "14px",
          color: "#f7dba0",
        }),
      );
    }

    this.phaseText = this.add.text(24, 20, "", {
      fontFamily: "Trebuchet MS, Verdana, sans-serif",
      fontSize: "18px",
      color: "#e6f3ff",
    });
    this.objectiveText = this.add.text(664, 58, "", {
      fontFamily: "Trebuchet MS, Verdana, sans-serif",
      fontSize: "16px",
      color: "#d3edf6",
    });
    this.hintText = this.add.text(28, 594, "", {
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
    this.controller.update(delta / 1000);
    const state = this.controller.getState();
    this.renderState(state);
  }

  private renderState(state: RunState): void {
    this.graphics.clear();
    this.drawBackground();
    this.drawPlayfield(state);
    this.drawSlots(state);
    this.drawObjective(state);
    this.drawBots(state);
    this.drawEnemies(state);
    this.updateTexts(state);
    this.drawOverlay(state);
  }

  private drawBackground(): void {
    this.graphics.fillStyle(0x061018, 1);
    this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    for (const star of this.stars) {
      this.graphics.fillStyle(0xd8f1ff, star.alpha);
      this.graphics.fillCircle(star.x, star.y, star.size);
    }
  }

  private drawPlayfield(state: RunState): void {
    this.graphics.lineStyle(2, 0x2c5871, 0.9);
    this.graphics.fillStyle(0x0b1a25, 0.95);
    this.graphics.fillRoundedRect(24, 52, 420, 520, 18);
    this.graphics.strokeRoundedRect(24, 52, 420, 520, 18);

    this.graphics.fillStyle(0x0a1d2b, 0.95);
    this.graphics.fillRoundedRect(470, 52, 466, 520, 18);
    this.graphics.strokeRoundedRect(470, 52, 466, 520, 18);

    this.graphics.lineStyle(2, 0x4f7d8d, 0.7);
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

    this.graphics.fillStyle(0x112636, 0.9);
    this.graphics.fillCircle(SHIP_CENTER.x, SHIP_CENTER.y, 82);

    this.graphics.fillStyle(0x122f40, 1);
    this.graphics.fillRoundedRect(620, 112, 232, 118, 18);
    this.graphics.lineStyle(2, 0x5ea8c9, 0.8);
    this.graphics.strokeRoundedRect(620, 112, 232, 118, 18);

    this.graphics.fillStyle(0x0d2330, 1);
    this.graphics.fillRoundedRect(744, 406, 160, 142, 16);
    this.graphics.strokeRoundedRect(744, 406, 160, 142, 16);
  }

  private drawSlots(state: RunState): void {
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
        this.graphics.lineStyle(2, 0x406a7f, 0.45);
        this.graphics.lineBetween(slot.x, slot.y, neighbor.x, neighbor.y);
      }
    }

    const tutorialTargets = this.getTutorialSlotTargets(state);

    for (const slot of state.ship.slots) {
      const selected = state.ui.selectedSlotIds.includes(slot.id);
      const recommended = tutorialTargets.has(slot.id);
      this.graphics.fillStyle(selected ? 0x305d70 : 0x143243, 1);
      this.graphics.fillRoundedRect(slot.x - SLOT_SIZE / 2, slot.y - SLOT_SIZE / 2, SLOT_SIZE, SLOT_SIZE, 14);
      this.graphics.lineStyle(2, selected ? 0xb8efe9 : recommended ? 0xf0cf7d : 0x5a7b8a, 0.95);
      this.graphics.strokeRoundedRect(slot.x - SLOT_SIZE / 2, slot.y - SLOT_SIZE / 2, SLOT_SIZE, SLOT_SIZE, 14);

      if (recommended) {
        this.graphics.lineStyle(4, 0xf0cf7d, 0.28);
        this.graphics.strokeRoundedRect(slot.x - SLOT_SIZE / 2 - 4, slot.y - SLOT_SIZE / 2 - 4, SLOT_SIZE + 8, SLOT_SIZE + 8, 16);
      }

      const codeText = this.slotCodeTexts.get(slot.id);
      if (!slot.moduleId) {
        codeText?.setText(state.phase === "planning" ? "+" : "").setColor(recommended ? "#f7e6a7" : "#9dc0d0");
        continue;
      }
      const definition = MODULE_DEFINITIONS[slot.moduleId];
      this.graphics.fillStyle(definition.color, 1);
      this.graphics.fillRoundedRect(slot.x - SLOT_SIZE / 2 + 10, slot.y - SLOT_SIZE / 2 + 18, SLOT_SIZE - 20, SLOT_SIZE - 28, 10);
      codeText?.setText(definition.shortName).setColor("#091016");
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

  private drawBots(state: RunState): void {
    for (const bot of state.ship.bots) {
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

    const ratio = bot.hp / bot.maxHp;
    this.graphics.fillStyle(0x182029, 1);
    this.graphics.fillRect(bot.x - 16, bot.y + 18, 32, 4);
    this.graphics.fillStyle(0xa8f29e, 1);
    this.graphics.fillRect(bot.x - 16, bot.y + 18, 32 * ratio, 4);
  }

  private drawEnemies(state: RunState): void {
    for (const enemy of state.simulation.enemies) {
      this.graphics.fillStyle(enemy.color, 1);
      if (enemy.kind === "mini_boss") {
        this.graphics.fillRoundedRect(enemy.x - 22, enemy.y - 18, 44, 36, 8);
        this.graphics.lineStyle(2, 0xfee2a2, 0.8);
        this.graphics.strokeRoundedRect(enemy.x - 22, enemy.y - 18, 44, 36, 8);
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
      this.graphics.fillStyle(0xf7b098, 1);
      this.graphics.fillRect(enemy.x - 18, enemy.y - 26, 36 * ratio, 4);
    }
  }

  private updateTexts(state: RunState): void {
    this.phaseText.setText(
      `Cycle ${state.cycle} • ${getPhaseLabel(state.phase)} • Hull ${Math.round(state.ship.hull)}/${state.ship.maxHull} • Shield ${Math.round(state.ship.shield)}/${state.ship.maxShield}`,
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
      text.setText(spawned ? `${wave.label} • deployed` : `${wave.label} • ${countdown.toFixed(1)}s`);
      text.setColor(spawned ? "#7ec9a9" : "#f7dba0");
    });

    for (const slot of state.ship.slots) {
      const labelText = this.slotLabelTexts.get(slot.id);
      labelText?.setColor(state.ui.selectedSlotIds.includes(slot.id) ? "#dfffee" : "#9cc1cf");
    }
  }

  private drawOverlay(state: RunState): void {
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
          return "Place the Solar Collector in any empty slot on the left board.";
        case "place_mineral_drill":
          return "Place the Mineral Drill next to the Solar Collector so the pair can merge.";
        case "place_third_module":
          return "Place one more module to round out the ship. Shield Emitter or Cargo Core are both good tutorial picks.";
        case "merge_bot":
          return "Select the Solar Collector and Mineral Drill, then press Create Bot in the right panel.";
        case "select_doctrine":
          return "Balanced is recommended for the first mission. Click it once in the right panel.";
        case "start_mission":
          return "The big Start Mission button is ready when you are.";
        case "mission_running":
          return "Watch the system run. You do not need to aim or click quickly.";
        default:
          return "Follow the highlighted action to keep the tutorial moving.";
      }
    }

    if (state.phase === "planning") {
      return "Place modules on the ship, select adjacent pairs to preview merges, and press Start Mission when the plan looks ready.";
    }

    return "Mission resolution is automatic. Space pauses instantly, and doctrine changes are optional but reduce commitment.";
  }

  private findSlot(slots: ShipSlot[], slotId: string): ShipSlot | undefined {
    return slots.find((slot) => slot.id === slotId);
  }
}
