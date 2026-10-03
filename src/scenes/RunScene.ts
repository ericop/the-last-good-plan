import Phaser from "phaser";
import { getEpicModuleById, getSlotModulePresentation } from "../data/epicModuleRegistry";
import { getMergePreviewFromModules } from "../core/discovery";
import type { GameController } from "../core/gameController";
import { getTutorialHandTarget } from "../core/tutorial";
import { BOARD_ORIGIN, GAME_HEIGHT, GAME_WIDTH, LANE_YS, SHIP_CENTER, SLOT_GAP, SLOT_SIZE } from "../game/constants";
import {
  AssemblyEffectsManager,
  drawMechanicalModulePlate,
  type BotView,
  type ModuleView,
  type SlotView,
} from "../game/effects/assemblyEffects";
import { createStarfield, drawAmbientPanel, drawMechanicalHalo, type StarfieldHandle } from "../game/effects/ambientVisuals";
import { BoosterTrails, type BoosterEmitter } from "../game/effects/boosterTrails";
import type {
  BarrageState,
  BotInstance,
  EnemyInstance,
  EpicModuleId,
  FighterInstance,
  ModuleId,
  RunState,
  ShipSlot,
} from "../types/gameTypes";
import { ALIEN_COLORS } from "../data/story";
import { haptic, playSound } from "../ui/feedback";
import { getLayoutMode } from "../ui/layoutMode";

const BARRAGE_RED = 0xff2850;
const RESCUE_SWEEP_TIME = 2.4;
const RESCUE_FORMATION = [
  { y: 150, lag: 0 },
  { y: 250, lag: 60 },
  { y: 340, lag: 20 },
  { y: 430, lag: 80 },
  { y: 520, lag: 40 },
];
const LAUNCH_FLASH_TIME = 0.45;
const BIG_HIT_HULL = 8;
const OBSERVER_ZOOM = 1.3;
const PLANNING_ZOOM = 1.45;
const BOARD_CENTER = {
  x: BOARD_ORIGIN.x + (SLOT_SIZE * 3 + SLOT_GAP * 2) / 2,
  y: BOARD_ORIGIN.y + (SLOT_SIZE * 3 + SLOT_GAP * 2) / 2,
};

interface LaunchFlash {
  x: number;
  y: number;
  age: number;
  color: number;
}

interface FeedbackSnapshot {
  warningIds: Set<string>;
  firedIds: Set<string>;
  fighterIds: Set<string>;
  announcement?: string;
  calloutCount: number;
  comm?: string;
  launching: boolean;
  bossIntro: boolean;
  hull: number;
}

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
  private boosterGraphics!: Phaser.GameObjects.Graphics;
  private boosterTrails = new BoosterTrails();
  private barrageAlertTexts: Phaser.GameObjects.Text[] = [];
  private slotLabelTexts = new Map<string, Phaser.GameObjects.Text>();
  private slotCodeTexts = new Map<string, Phaser.GameObjects.Text>();
  private calloutTexts: Phaser.GameObjects.Text[] = [];
  private heroLabel!: Phaser.GameObjects.Text;
  private world!: Phaser.GameObjects.Container;
  private portrait = false;
  private launchFlashes: LaunchFlash[] = [];
  private feedbackSnapshot?: FeedbackSnapshot;
  private starfield!: StarfieldHandle;
  private assemblyEffects!: AssemblyEffectsManager;
  private visualTime = 0;
  private visualSnapshot?: VisualSnapshot;

  constructor() {
    super("run");
  }

  create(): void {
    this.controller = this.registry.get("controller") as GameController;
    this.slotLabelTexts = new Map();
    this.slotCodeTexts = new Map();
    this.calloutTexts = [];
    this.barrageAlertTexts = [];
    this.launchFlashes = [];
    this.feedbackSnapshot = undefined;
    this.visualSnapshot = undefined;
    this.boosterTrails.clear();
    this.graphics = this.add.graphics();
    this.boosterGraphics = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.starfield = createStarfield(this, { width: GAME_WIDTH, height: GAME_HEIGHT });
    this.assemblyEffects = new AssemblyEffectsManager(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.starfield.destroy();
      this.assemblyEffects.destroy();
    });

    const state = this.controller.getState();
    for (const slot of state.ship.slots) {
      const zone = this.add.zone(slot.x, slot.y, SLOT_SIZE + SLOT_GAP, SLOT_SIZE + SLOT_GAP).setInteractive({ useHandCursor: true });
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

    this.heroLabel = this.add
      .text(0, 0, "", { fontFamily: "system-ui, sans-serif", fontSize: "13px", fontStyle: "bold", color: "#ffffff", stroke: "#0b1720", strokeThickness: 3 })
      .setOrigin(0.5)
      .setVisible(false);

    for (let index = 0; index < 8; index += 1) {
      this.calloutTexts.push(
        this.add
          .text(0, 0, "", {
            fontFamily: "system-ui, sans-serif",
            fontSize: "22px",
            fontStyle: "bold",
            color: "#ffffff",
            stroke: "#0b1720",
            strokeThickness: 4,
          })
          .setOrigin(0.5)
          .setVisible(false),
      );
    }

    for (let index = 0; index < 4; index += 1) {
      this.barrageAlertTexts.push(
        this.add
          .text(0, 0, "!", { fontFamily: "system-ui, sans-serif", fontSize: "26px", fontStyle: "bold", color: "#ff2850" })
          .setOrigin(0.5)
          .setDepth(4)
          .setVisible(false),
      );
    }

    this.world = this.add.container(0, 0, [
      this.graphics,
      this.boosterGraphics,
      ...this.children.list.filter(
        (child) => child !== this.graphics && child !== this.boosterGraphics && child !== this.world,
      ),
    ]);
    this.applyOrientation(getLayoutMode() === "pocket");

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
    if (state.phase === "menu") {
      this.scene.start("main-menu");
      return;
    }
    const portrait = getLayoutMode() === "pocket";
    if (portrait !== this.portrait) {
      this.applyOrientation(portrait);
    }
    const missionLive = state.phase === "execution" && !state.paused && !state.pendingReward;
    if (missionLive) {
      this.launchFlashes.forEach((flash) => {
        flash.age += dt * state.executionSpeed;
      });
      this.launchFlashes = this.launchFlashes.filter((flash) => flash.age < LAUNCH_FLASH_TIME);
    }
    this.emitBattleFeedback(state);
    this.updateObserverCamera(state, dt);
    if (state.phase !== "execution") {
      this.boosterTrails.clear();
    } else if (missionLive) {
      this.boosterTrails.update(dt * state.executionSpeed, this.collectBoosterEmitters(state));
    }
    this.syncAssemblyEffects(state);
    this.renderState(state);
    this.visualSnapshot = this.captureVisualSnapshot(state);
  }

  private renderState(state: RunState): void {
    this.graphics.clear();
    this.drawBackground();
    this.drawPlayfield(state);
    this.drawLanes(state);
    this.drawSlots(state);
    this.drawObjective(state);
    this.drawBeams(state);
    this.drawBots(state);
    this.drawFighters(state);
    this.drawEnemies(state);
    this.drawProjectiles(state);
    this.drawBarrages(state);
    this.drawImpacts(state);
    this.drawLaunchFlashes();
    this.drawTapMarker(state);
    this.drawRescue(state);
    this.drawHeroLabel(state);
    this.boosterGraphics.clear();
    this.boosterTrails.draw(this.boosterGraphics);
    this.assemblyEffects.drawOverlay(this.graphics);
    this.updateSlotLabels(state);
    this.drawCallouts(state);
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

    drawAmbientPanel(this.graphics, 690, 102, 232, 128, 18, time + 2.1);
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
          .setRotation(-this.world.rotation)
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
        .setRotation(renderState.rotation * 0.5 - this.world.rotation)
        .setAlpha(renderState.textAlpha);
    }
  }

  private drawObjective(state: RunState): void {
    const integrityRatio = state.simulation.objective.integrity / state.simulation.objective.maxIntegrity;
    this.graphics.fillStyle(0x8c8a87, 1);
    this.graphics.fillCircle(806, 160, 36);
    this.graphics.fillStyle(0x6d655a, 1);
    this.graphics.fillCircle(820, 148, 11);
    this.graphics.fillCircle(788, 172, 9);
    this.graphics.fillStyle(0xd6c085, 0.9);
    this.graphics.fillRect(702, 210, 208 * integrityRatio, 10);
    this.graphics.lineStyle(2, 0x5ea8c9, 0.7);
    this.graphics.strokeRect(702, 210, 208, 10);

    if (state.simulation.objective.integrity <= 0) {
      this.graphics.fillStyle(0xf0d27a, 0.8);
      this.graphics.fillCircle(806, 160, 12);
    }
  }

  private drawLanes(state: RunState): void {
    if (state.simulation.encounter !== "swarm" || state.phase === "results" || state.phase === "run_over") {
      return;
    }
    const pulse = 0.12 + Math.sin(this.visualTime * 1.4) * 0.04;
    for (const laneY of state.simulation.lanes.map((lane) => LANE_YS[lane])) {
      for (let x = 930; x > 470; x -= 26) {
        this.graphics.lineStyle(2, 0xff8f7a, pulse);
        this.graphics.lineBetween(x, laneY, x - 12, laneY);
      }
      this.graphics.lineStyle(1, 0xff8f7a, pulse * 0.7);
      this.graphics.lineBetween(470, laneY, SHIP_CENTER.x + 160, SHIP_CENTER.y + (laneY - SHIP_CENTER.y) * 0.4);
    }
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
      if (enemy.hp <= 0) {
        continue;
      }
      if (enemy.kind === "warship" || enemy.kind === "boss") {
        this.drawCapitalShip(enemy);
        continue;
      }

      this.graphics.fillStyle(enemy.color, 1);
      if (enemy.kind === "mini_boss") {
        this.graphics.fillRoundedRect(enemy.x - 22, enemy.y - 18, 44, 36, 8);
        this.graphics.lineStyle(2, 0xfee2a2, 0.8);
        this.graphics.strokeRoundedRect(enemy.x - 22, enemy.y - 18, 44, 36, 8);
      } else if (enemy.kind === "dart") {
        this.graphics.fillTriangle(enemy.x - 10, enemy.y, enemy.x + 8, enemy.y - 7, enemy.x + 8, enemy.y + 7);
      } else if (enemy.kind === "brute") {
        this.graphics.fillRoundedRect(enemy.x - 17, enemy.y - 15, 34, 30, 4);
        this.graphics.lineStyle(2, 0x2a1410, 0.8);
        this.graphics.strokeRoundedRect(enemy.x - 17, enemy.y - 15, 34, 30, 4);
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
      const barWidth = enemy.kind === "dart" ? 20 : 36;
      this.graphics.fillStyle(0x1d1414, 1);
      this.graphics.fillRect(enemy.x - barWidth / 2, enemy.y - 24, barWidth, 3);
      this.graphics.fillStyle(0xf7b098, 1);
      this.graphics.fillRect(enemy.x - barWidth / 2, enemy.y - 24, barWidth * ratio, 3);
    }
  }

  private drawCapitalShip(enemy: EnemyInstance): void {
    const scale = enemy.kind === "boss" ? 1.25 : 1;
    const x = enemy.x;
    const y = enemy.y;
    const hull = [
      new Phaser.Geom.Point(x - 62 * scale, y),
      new Phaser.Geom.Point(x - 30 * scale, y - 24 * scale),
      new Phaser.Geom.Point(x + 48 * scale, y - 26 * scale),
      new Phaser.Geom.Point(x + 60 * scale, y - 10 * scale),
      new Phaser.Geom.Point(x + 60 * scale, y + 10 * scale),
      new Phaser.Geom.Point(x + 48 * scale, y + 26 * scale),
      new Phaser.Geom.Point(x - 30 * scale, y + 24 * scale),
    ];
    this.graphics.fillStyle(0x1a1416, 0.95);
    this.graphics.fillPoints(hull, true);
    this.graphics.lineStyle(2, enemy.color, 0.9);
    this.graphics.strokePoints(hull, true);
    this.graphics.fillStyle(enemy.color, 0.75);
    this.graphics.fillRect(x - 16 * scale, y - 8 * scale, 44 * scale, 16 * scale);
    this.graphics.fillStyle(0xffe2b8, 0.6 + Math.sin(this.visualTime * 6) * 0.2);
    this.graphics.fillCircle(x + 58 * scale, y, 4 * scale);

    const weapons = enemy.weapons ?? [];
    weapons.forEach((weapon, index) => {
      const ratio = Math.min(1, weapon.charge / weapon.chargeTime);
      const pipX = x - 26 * scale + index * 22;
      const pipY = y + 34 * scale;
      this.graphics.fillStyle(0x2a1d1d, 1);
      this.graphics.fillRect(pipX, pipY, 18, 4);
      this.graphics.fillStyle(weapon.kind === "missile" ? 0xffa45c : 0xff5e6c, 0.9);
      this.graphics.fillRect(pipX, pipY, 18 * ratio, 4);
    });

    const shieldRatio = enemy.maxShield ? (enemy.shield ?? 0) / enemy.maxShield : 0;
    if (shieldRatio > 0.02) {
      this.graphics.lineStyle(2 + shieldRatio * 2, 0x6dd4ff, 0.18 + shieldRatio * 0.5);
      this.graphics.strokeEllipse(x, y, 150 * scale, 82 * scale);
    }
  }

  private drawBeams(state: RunState): void {
    const flicker = 0.25 + Math.abs(Math.sin(this.visualTime * 18)) * 0.25;
    const drawBeam = (unit: { x: number; y: number; targetId?: string; color: number }) => {
      const target = unit.targetId ? state.simulation.enemies.find((enemy) => enemy.id === unit.targetId) : undefined;
      if (!target) {
        return;
      }
      this.graphics.lineStyle(1.5, unit.color, flicker);
      this.graphics.lineBetween(unit.x, unit.y, target.x, target.y);
    };
    state.ship.bots.forEach(drawBeam);
    state.simulation.fighters.forEach(drawBeam);
  }

  private drawFighters(state: RunState): void {
    for (const fighter of state.simulation.fighters) {
      this.drawFighter(fighter);
    }
  }

  private drawFighter(fighter: FighterInstance): void {
    if (fighter.hero) {
      this.drawHero(fighter);
      return;
    }
    const cos = Math.cos(fighter.heading);
    const sin = Math.sin(fighter.heading);
    const point = (forward: number, side: number) =>
      new Phaser.Geom.Point(fighter.x + cos * forward - sin * side, fighter.y + sin * forward + cos * side);
    this.graphics.fillStyle(fighter.color, 1);
    this.graphics.fillPoints([point(12, 0), point(-9, -9), point(-4, 0), point(-9, 9)], true);
    this.graphics.fillStyle(0xffffff, 0.5 + Math.sin(this.visualTime * 10 + fighter.orbit) * 0.3);
    this.graphics.fillCircle(fighter.x - cos * 7, fighter.y - sin * 7, 2);
    if (fighter.hp < fighter.maxHp) {
      this.graphics.fillStyle(0x182029, 1);
      this.graphics.fillRect(fighter.x - 9, fighter.y + 12, 18, 2);
      this.graphics.fillStyle(0xa8f29e, 1);
      this.graphics.fillRect(fighter.x - 9, fighter.y + 12, 18 * (fighter.hp / fighter.maxHp), 2);
    }
  }

  private drawProjectiles(state: RunState): void {
    for (const projectile of state.simulation.projectiles) {
      const angle = Math.atan2(projectile.targetY - projectile.y, projectile.targetX - projectile.x);
      const tail = projectile.kind === "missile" ? 16 : projectile.kind === "laser" ? 14 : 10;
      const tailX = projectile.x - Math.cos(angle) * tail;
      const tailY = projectile.y - Math.sin(angle) * tail;
      if (projectile.kind === "missile") {
        this.graphics.lineStyle(3, 0xffe0b0, 0.35);
        this.graphics.lineBetween(tailX, tailY, projectile.x, projectile.y);
        this.graphics.fillStyle(projectile.color, 1);
        this.graphics.fillCircle(projectile.x, projectile.y, 4);
      } else {
        this.graphics.lineStyle(projectile.kind === "laser" ? 3 : 2.5, projectile.color, 0.95);
        this.graphics.lineBetween(tailX, tailY, projectile.x, projectile.y);
      }
    }
  }

  private drawImpacts(state: RunState): void {
    for (const impact of state.simulation.impacts) {
      const progress = impact.age / 0.4;
      this.graphics.lineStyle(2, impact.color, 0.8 * (1 - progress));
      this.graphics.strokeCircle(impact.x, impact.y, impact.size * (0.4 + progress * 0.8));
    }
  }

  private drawHero(hero: FighterInstance): void {
    const point = (forward: number, side: number) => new Phaser.Geom.Point(hero.x + forward, hero.y + side);
    const hull = [point(26, 0), point(8, -12), point(-18, -12), point(-24, -5), point(-24, 5), point(-18, 12), point(8, 12)];
    this.graphics.fillStyle(0x0b1720, 0.95);
    this.graphics.fillPoints(hull, true);
    this.graphics.lineStyle(3, hero.color, 1);
    this.graphics.strokePoints(hull, true);
    this.graphics.fillStyle(hero.color, 0.9);
    this.graphics.fillCircle(hero.x + 6, hero.y, 5);
    this.graphics.lineStyle(2, hero.color, 0.35 + Math.abs(Math.sin(this.visualTime * 3)) * 0.35);
    this.graphics.strokeCircle(hero.x, hero.y, 32);
    const ratio = Math.max(0, hero.hp / hero.maxHp);
    this.graphics.fillStyle(0x182029, 1);
    this.graphics.fillRect(hero.x - 22, hero.y + 18, 44, 4);
    this.graphics.fillStyle(ratio > 0.35 ? 0xa8f29e : 0xff6b6b, 1);
    this.graphics.fillRect(hero.x - 22, hero.y + 18, 44 * ratio, 4);
  }

  private drawHeroLabel(state: RunState): void {
    const hero = state.phase === "execution" ? state.simulation.fighters.find((fighter) => fighter.hero) : undefined;
    if (!hero?.hero) {
      this.heroLabel.setVisible(false);
      return;
    }
    this.heroLabel
      .setText(hero.hero.shipName)
      .setColor(`#${hero.color.toString(16).padStart(6, "0")}`)
      .setPosition(hero.x, hero.y - 26)
      .setVisible(true);
  }

  private getRescueShips(state: RunState): Array<{ id: string; x: number; y: number }> {
    const rescue = state.simulation.rescue;
    if (!rescue) {
      return [];
    }
    const progress = rescue.age / RESCUE_SWEEP_TIME;
    return RESCUE_FORMATION.map((offset, index) => ({
      id: `alien-${index}`,
      x: -120 + progress * (GAME_WIDTH + 240) - offset.lag,
      y: offset.y + Math.sin(rescue.age * 4 + index) * 10,
    }));
  }

  private drawRescue(state: RunState): void {
    const rescue = state.simulation.rescue;
    if (!rescue) {
      return;
    }
    const color = ALIEN_COLORS[rescue.species] ?? 0xffffff;
    const flash = Math.max(0, 1 - rescue.age / 0.6);
    if (flash > 0) {
      this.graphics.fillStyle(color, 0.25 * flash);
      this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
    for (const ship of this.getRescueShips(state)) {
      this.graphics.fillStyle(color, 0.25);
      this.graphics.fillCircle(ship.x, ship.y, 22);
      this.graphics.fillStyle(color, 0.95);
      if (rescue.species === "tide") {
        this.graphics.fillEllipse(ship.x, ship.y, 54, 18);
      } else if (rescue.species === "aunties") {
        this.graphics.fillPoints([new Phaser.Geom.Point(ship.x + 16, ship.y), new Phaser.Geom.Point(ship.x, ship.y - 12), new Phaser.Geom.Point(ship.x - 16, ship.y), new Phaser.Geom.Point(ship.x, ship.y + 12)], true);
        this.graphics.lineStyle(2, 0xffffff, 0.8);
        this.graphics.lineBetween(ship.x - 22, ship.y - 10, ship.x + 22, ship.y + 10);
      } else if (rescue.species === "choir") {
        this.graphics.fillTriangle(ship.x + 18, ship.y, ship.x - 12, ship.y - 12, ship.x - 12, ship.y + 12);
        this.graphics.fillCircle(ship.x - 14, ship.y, 5);
      } else {
        this.graphics.fillCircle(ship.x, ship.y - 4, 12);
        for (let tendril = -2; tendril <= 2; tendril += 1) {
          this.graphics.lineStyle(2, color, 0.8);
          this.graphics.lineBetween(ship.x + tendril * 4, ship.y + 6, ship.x + tendril * 5 - 8, ship.y + 22);
        }
      }
    }
  }

  private collectBoosterEmitters(state: RunState): BoosterEmitter[] {
    const emitters: BoosterEmitter[] = [];
    for (const ship of this.getRescueShips(state)) {
      emitters.push({ id: ship.id, x: ship.x, y: ship.y, scale: 1.6 });
    }
    for (const bot of state.ship.bots) {
      if (bot.evade) {
        emitters.push({ id: bot.id, x: bot.x, y: bot.y, scale: 1 });
      }
    }
    for (const fighter of state.simulation.fighters) {
      if (fighter.evade || fighter.launchBoost > 0) {
        emitters.push({ id: fighter.id, x: fighter.x, y: fighter.y, scale: 0.7 });
      }
    }
    for (const enemy of state.simulation.enemies) {
      if (enemy.holdX !== undefined && enemy.x > enemy.holdX + 0.5) {
        emitters.push({ id: enemy.id, x: enemy.x, y: enemy.y, scale: 2.4 });
      } else if (enemy.knockback) {
        emitters.push({ id: enemy.id, x: enemy.x, y: enemy.y, scale: 0.9 });
      }
    }
    return emitters;
  }

  private drawBarrages(state: RunState): void {
    this.barrageAlertTexts.forEach((text) => text.setVisible(false));
    let alertIndex = 0;
    for (const barrage of state.simulation.barrages) {
      if (barrage.firedAge === undefined) {
        this.drawBarrageWarning(barrage);
        const alert = this.barrageAlertTexts[alertIndex];
        alertIndex += 1;
        alert
          ?.setPosition(barrage.fromX, barrage.fromY - 52)
          .setScale(1 + Math.sin(this.visualTime * 14) * 0.08)
          .setVisible(true);
      } else {
        this.drawBarrageFlash(barrage);
      }
    }
  }

  private getBarrageCorridor(barrage: BarrageState, width: number): Phaser.Geom.Point[] {
    const length = Math.hypot(barrage.toX - barrage.fromX, barrage.toY - barrage.fromY) || 1;
    const offsetX = (-(barrage.toY - barrage.fromY) / length) * (width / 2);
    const offsetY = ((barrage.toX - barrage.fromX) / length) * (width / 2);
    return [
      new Phaser.Geom.Point(barrage.fromX + offsetX, barrage.fromY + offsetY),
      new Phaser.Geom.Point(barrage.toX + offsetX, barrage.toY + offsetY),
      new Phaser.Geom.Point(barrage.toX - offsetX, barrage.toY - offsetY),
      new Phaser.Geom.Point(barrage.fromX - offsetX, barrage.fromY - offsetY),
    ];
  }

  private drawBarrageWarning(barrage: BarrageState): void {
    const progress = Phaser.Math.Clamp(1 - barrage.timer / barrage.warning, 0, 1);
    const finalBlink = barrage.timer < 0.5 ? Math.abs(Math.sin(this.visualTime * 22)) : 1;
    const corridor = this.getBarrageCorridor(barrage, barrage.width);
    this.graphics.fillStyle(BARRAGE_RED, (0.04 + progress * 0.12) * finalBlink);
    this.graphics.fillPoints(corridor, true);
    this.graphics.lineStyle(1.5, BARRAGE_RED, 0.2 + progress * 0.4);
    this.graphics.lineBetween(corridor[0].x, corridor[0].y, corridor[1].x, corridor[1].y);
    this.graphics.lineBetween(corridor[3].x, corridor[3].y, corridor[2].x, corridor[2].y);

    // Rainbow-Survivors' charge windup aim line: 11px dashes, 7px gaps, 5px wide at 85% alpha.
    const length = Math.hypot(barrage.toX - barrage.fromX, barrage.toY - barrage.fromY) || 1;
    const dirX = (barrage.toX - barrage.fromX) / length;
    const dirY = (barrage.toY - barrage.fromY) / length;
    this.graphics.lineStyle(5, BARRAGE_RED, 0.85);
    for (let start = 0; start < length; start += 18) {
      const end = Math.min(length, start + 11);
      this.graphics.lineBetween(
        barrage.fromX + dirX * start,
        barrage.fromY + dirY * start,
        barrage.fromX + dirX * end,
        barrage.fromY + dirY * end,
      );
    }

    this.graphics.fillStyle(BARRAGE_RED, 0.35 + progress * 0.4);
    this.graphics.fillCircle(barrage.fromX, barrage.fromY, 5 + progress * 11);
    this.graphics.fillStyle(0xffffff, 0.4 + progress * 0.5);
    this.graphics.fillCircle(barrage.fromX, barrage.fromY, 2 + progress * 4);
  }

  private drawBarrageFlash(barrage: BarrageState): void {
    const fade = 1 - Phaser.Math.Clamp((barrage.firedAge ?? 0) / 0.35, 0, 1);
    this.graphics.fillStyle(0xff5e6c, 0.8 * fade);
    this.graphics.fillPoints(this.getBarrageCorridor(barrage, barrage.width * (0.6 + fade * 0.4)), true);
    this.graphics.fillStyle(0xffffff, 0.9 * fade);
    this.graphics.fillPoints(this.getBarrageCorridor(barrage, 6 + fade * 6), true);
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
        playSound("place");
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

  private findSlot(slots: ShipSlot[], slotId: string): ShipSlot | undefined {
    return slots.find((slot) => slot.id === slotId);
  }

  // Portrait phones turn the battlefield so enemies enter from the top and the ship sits under the thumb. The sim keeps
  // its landscape coordinates; only this container rotates, and texts counter-rotate to stay upright.
  private applyOrientation(portrait: boolean): void {
    this.portrait = portrait;
    const width = portrait ? GAME_HEIGHT : GAME_WIDTH;
    const height = portrait ? GAME_WIDTH : GAME_HEIGHT;
    this.scale.setGameSize(width, height);
    this.cameras.main.setSize(width, height).setBounds(0, 0, width, height).setZoom(1).centerOn(width / 2, height / 2);
    this.world.setRotation(portrait ? -Math.PI / 2 : 0).setPosition(0, portrait ? GAME_WIDTH : 0);
    for (const child of this.world.list) {
      if (child instanceof Phaser.GameObjects.Text) {
        child.setRotation(-this.world.rotation);
      }
    }
  }

  private toScreen(point: { x: number; y: number }): { x: number; y: number } {
    return this.portrait ? { x: point.y, y: GAME_WIDTH - point.x } : point;
  }

  private updateObserverCamera(state: RunState, dt: number): void {
    const camera = this.cameras.main;
    const center = { x: camera.width / 2, y: camera.height / 2 };
    let focus = center;
    let zoom = 1;
    if (this.portrait && state.phase === "planning") {
      focus = this.toScreen(BOARD_CENTER);
      zoom = PLANNING_ZOOM;
    } else if (this.portrait && state.phase === "execution") {
      const warning = state.simulation.barrages.find((barrage) => barrage.firedAge === undefined);
      const boss = state.simulation.enemies.find((enemy) => enemy.kind === "boss");
      if (warning) {
        focus = this.toScreen({ x: warning.fromX - 120, y: warning.fromY });
        zoom = OBSERVER_ZOOM;
      } else if (boss && state.simulation.bossEncounter.introTimer > 0) {
        focus = this.toScreen(boss);
        zoom = OBSERVER_ZOOM;
      }
    }
    const ease = Math.min(1, dt * 3);
    const nextZoom = camera.zoom + (zoom - camera.zoom) * ease;
    const current = { x: camera.midPoint.x, y: camera.midPoint.y };
    camera.setZoom(nextZoom);
    camera.centerOn(current.x + (focus.x - current.x) * ease, current.y + (focus.y - current.y) * ease);
  }

  private emitBattleFeedback(state: RunState): void {
    const simulation = state.simulation;
    const next: FeedbackSnapshot = {
      warningIds: new Set(simulation.barrages.filter((barrage) => barrage.firedAge === undefined).map((barrage) => barrage.id)),
      firedIds: new Set(simulation.barrages.filter((barrage) => barrage.firedAge !== undefined).map((barrage) => barrage.id)),
      fighterIds: new Set(simulation.fighters.map((fighter) => fighter.id)),
      announcement: simulation.announcement?.text,
      calloutCount: simulation.callouts.length,
      comm: simulation.activeComm?.line.text,
      launching: state.phase === "execution" && simulation.launchCountdown > 0,
      bossIntro: simulation.bossEncounter.introTimer > 0,
      hull: state.ship.hull,
    };
    const previous = this.feedbackSnapshot;
    this.feedbackSnapshot = next;
    if (!previous || state.phase !== "execution") {
      return;
    }

    if (next.launching && !previous.launching) {
      playSound("launch");
      haptic(25);
    }
    if ([...next.warningIds].some((id) => !previous.warningIds.has(id))) {
      playSound("lance_warning");
      haptic(20);
    }
    if ([...next.firedIds].some((id) => !previous.firedIds.has(id))) {
      playSound("lance_fire");
      haptic([40, 30, 60]);
      this.cameras.main.shake(220, 0.006);
    }
    for (const fighter of simulation.fighters) {
      if (previous.fighterIds.has(fighter.id)) {
        continue;
      }
      const port = this.findSlot(state.ship.slots, fighter.portSlotId);
      if (port) {
        this.launchFlashes.push({ x: port.x, y: port.y, age: 0, color: fighter.color });
      }
      playSound("fighter", 120);
    }
    if (next.announcement && next.announcement !== previous.announcement) {
      playSound("announce");
    }
    if (next.comm && next.comm !== previous.comm) {
      playSound("coin", 150);
    }
    if (next.calloutCount > previous.calloutCount) {
      playSound("dodge");
    }
    if (next.bossIntro && !previous.bossIntro) {
      haptic([80, 40, 80]);
    }
    if (previous.hull - next.hull >= BIG_HIT_HULL) {
      playSound("hit", 150);
      this.cameras.main.shake(160, 0.004);
    }
  }

  private drawLaunchFlashes(): void {
    for (const flash of this.launchFlashes) {
      const progress = flash.age / LAUNCH_FLASH_TIME;
      const size = SLOT_SIZE * (1 + progress * 0.35);
      this.graphics.lineStyle(4 - progress * 3, flash.color, 0.9 * (1 - progress));
      this.graphics.strokeRoundedRect(flash.x - size / 2, flash.y - size / 2, size, size, 16);
      this.graphics.fillStyle(0xffffff, 0.35 * (1 - progress));
      this.graphics.fillRoundedRect(flash.x - SLOT_SIZE / 2, flash.y - SLOT_SIZE / 2, SLOT_SIZE, SLOT_SIZE, 14);
    }
  }

  private drawTapMarker(state: RunState): void {
    if (!state.tutorial.active || state.phase !== "planning" || getTutorialHandTarget(state)) {
      return;
    }
    const step = state.tutorial.stepId;
    if (!["place_solar_collector", "place_mineral_drill", "place_third_module", "merge_bot"].includes(step)) {
      return;
    }
    const targetId = [...this.getTutorialSlotTargets(state)].find((slotId) => !state.ui.selectedSlotIds.includes(slotId));
    const slot = targetId ? this.findSlot(state.ship.slots, targetId) : undefined;
    if (!slot) {
      return;
    }
    const pulse = (this.visualTime * 1.6) % 1;
    this.graphics.lineStyle(4, 0xffffff, 0.8 * (1 - pulse));
    this.graphics.strokeCircle(slot.x, slot.y, 14 + pulse * 30);
    this.graphics.fillStyle(0xffffff, 0.9);
    this.graphics.fillCircle(slot.x, slot.y, 9 + Math.sin(this.visualTime * 8) * 1.5);
    this.graphics.fillStyle(0xf0cf7d, 1);
    this.graphics.fillCircle(slot.x, slot.y, 5);
  }

  private updateSlotLabels(state: RunState): void {
    for (const slot of state.ship.slots) {
      this.slotLabelTexts.get(slot.id)?.setColor(state.ui.selectedSlotIds.includes(slot.id) ? "#dfffee" : "#9cc1cf");
    }
  }

  private drawCallouts(state: RunState): void {
    this.calloutTexts.forEach((text, index) => {
      const callout = state.phase === "execution" ? state.simulation.callouts[index] : undefined;
      if (!callout) {
        text.setVisible(false);
        return;
      }
      const pop = Math.min(1, callout.age / 0.12);
      text
        .setText(callout.text)
        .setColor(`#${callout.color.toString(16).padStart(6, "0")}`)
        .setPosition(callout.x, callout.y)
        .setScale(0.6 + pop * 0.5 - Math.max(0, callout.age - 0.12) * 0.1)
        .setAlpha(Math.min(1, 2.4 - callout.age * 2))
        .setVisible(true);
    });
  }
}