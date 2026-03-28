import Phaser from "phaser";
import type { BotRole, ModuleId } from "../../types/gameTypes";

export const ASSEMBLY_TIMINGS = {
  placement: 220,
  selection: 150,
  preview: 520,
  merge: 900,
} as const;

export interface SlotView {
  id: string;
  x: number;
  y: number;
  size: number;
}

export interface ModuleView {
  slotId: string;
  moduleId: ModuleId;
  x: number;
  y: number;
  size: number;
  color: number;
  shortName: string;
}

export interface BotPreviewData {
  id: string;
  name: string;
  color: number;
  role: BotRole;
}

export interface BotView {
  id: string;
  x: number;
  y: number;
  color: number;
  role: BotRole;
  name: string;
}

export interface ModuleRenderState {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  shadowAlpha: number;
  glowAlpha: number;
  borderAlpha: number;
  borderColor: number;
  textScale: number;
  textAlpha: number;
}

interface MechanicalPulse {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  lineWidth: number;
}

interface SlotFlashState {
  slotId: string;
  alpha: number;
  inset: number;
}

interface PlacementAnimation {
  slotId: string;
  offsetY: number;
  scale: number;
  rotation: number;
  shadow: number;
  glow: number;
}

interface SelectionAnimation {
  slotId: string;
  progress: number;
}

interface SyncLineState {
  slotIds: string[];
  alpha: number;
  travel: number;
}

interface CombinePreviewState {
  key: string;
  slotIds: string[];
  centerX: number;
  centerY: number;
  compress: number;
  badgeAlpha: number;
  badgeScale: number;
  data: BotPreviewData;
  sync: SyncLineState;
}

interface MergeGhost {
  slotId: string;
  moduleId: ModuleId;
  color: number;
  shortName: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  alpha: number;
}

interface MergeAnimation {
  slotIds: string[];
  centerX: number;
  centerY: number;
  lockAlpha: number;
  flashAlpha: number;
  flashRadius: number;
  botAlpha: number;
  botScale: number;
  botX: number;
  botY: number;
  botColor: number;
  botRole: BotRole;
  botId: string;
  sync: SyncLineState;
  ghosts: MergeGhost[];
}

function rotatePoint(x: number, y: number, rotation: number): Phaser.Geom.Point {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return new Phaser.Geom.Point(x * cos - y * sin, x * sin + y * cos);
}

function buildBeveledPlatePoints(centerX: number, centerY: number, width: number, height: number, bevel: number, rotation: number): Phaser.Geom.Point[] {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const raw = [
    [-halfWidth + bevel, -halfHeight],
    [halfWidth - bevel, -halfHeight],
    [halfWidth, -halfHeight + bevel],
    [halfWidth, halfHeight - bevel],
    [halfWidth - bevel, halfHeight],
    [-halfWidth + bevel, halfHeight],
    [-halfWidth, halfHeight - bevel],
    [-halfWidth, -halfHeight + bevel],
  ];

  return raw.map(([x, y]) => {
    const point = rotatePoint(x, y, rotation);
    return new Phaser.Geom.Point(centerX + point.x, centerY + point.y);
  });
}

function drawBracketCorners(graphics: Phaser.GameObjects.Graphics, centerX: number, centerY: number, width: number, height: number, alpha: number): void {
  const left = centerX - width / 2 - 6;
  const right = centerX + width / 2 + 6;
  const top = centerY - height / 2 - 6;
  const bottom = centerY + height / 2 + 6;
  const corner = 10;

  graphics.lineStyle(2, 0xbcdfff, alpha);
  graphics.lineBetween(left, top + corner, left, top);
  graphics.lineBetween(left, top, left + corner, top);
  graphics.lineBetween(right - corner, top, right, top);
  graphics.lineBetween(right, top, right, top + corner);
  graphics.lineBetween(left, bottom - corner, left, bottom);
  graphics.lineBetween(left, bottom, left + corner, bottom);
  graphics.lineBetween(right - corner, bottom, right, bottom);
  graphics.lineBetween(right, bottom - corner, right, bottom);
}

function drawMechanicalBotBadge(graphics: Phaser.GameObjects.Graphics, x: number, y: number, role: BotRole, color: number, scale: number, alpha: number): void {
  graphics.fillStyle(0x10202b, alpha * 0.92);
  graphics.fillRoundedRect(x - 18 * scale, y - 16 * scale, 36 * scale, 32 * scale, 8 * scale);
  graphics.lineStyle(2, color, alpha);
  graphics.strokeRoundedRect(x - 18 * scale, y - 16 * scale, 36 * scale, 32 * scale, 8 * scale);

  graphics.fillStyle(color, alpha);
  if (role === "support") {
    graphics.fillCircle(x, y, 8 * scale);
  } else if (role === "defense") {
    graphics.fillRoundedRect(x - 8 * scale, y - 8 * scale, 16 * scale, 16 * scale, 4 * scale);
  } else if (role === "mining") {
    graphics.fillTriangle(x, y - 9 * scale, x - 9 * scale, y + 8 * scale, x + 9 * scale, y + 8 * scale);
  } else {
    graphics.fillPoints([
      new Phaser.Geom.Point(x, y - 10 * scale),
      new Phaser.Geom.Point(x + 10 * scale, y),
      new Phaser.Geom.Point(x, y + 10 * scale),
      new Phaser.Geom.Point(x - 10 * scale, y),
    ], true);
  }
}


export function drawMechanicalModulePlate(
  graphics: Phaser.GameObjects.Graphics,
  moduleView: ModuleView,
  renderState: ModuleRenderState,
): void {
  const width = 52 * renderState.scale;
  const height = 36 * renderState.scale;
  const shadowY = renderState.y + 22;

  graphics.fillStyle(0x04080d, renderState.shadowAlpha);
  graphics.fillEllipse(renderState.x, shadowY, width * 0.84, 11 * renderState.scale);

  if (renderState.glowAlpha > 0.01) {
    graphics.lineStyle(3, moduleView.color, renderState.glowAlpha * 0.3);
    graphics.strokeCircle(renderState.x, renderState.y, 24 * renderState.scale);
  }

  const points = buildBeveledPlatePoints(renderState.x, renderState.y, width, height, 7 * renderState.scale, renderState.rotation);
  graphics.fillStyle(moduleView.color, 0.96);
  graphics.fillPoints(points, true);
  graphics.lineStyle(1.6, renderState.borderColor, renderState.borderAlpha);
  graphics.strokePoints(points, true);

  if (renderState.glowAlpha > 0.05) {
    drawBracketCorners(graphics, renderState.x, renderState.y, width, height, renderState.glowAlpha * 0.7);
  }
}
export function createMechanicalPulse(scene: Phaser.Scene, x: number, y: number): MechanicalPulse {
  const pulse: MechanicalPulse = {
    x,
    y,
    radius: 18,
    alpha: 0.48,
    lineWidth: 2.4,
  };

  scene.tweens.add({
    targets: pulse,
    radius: 46,
    alpha: 0,
    lineWidth: 0.8,
    duration: ASSEMBLY_TIMINGS.placement,
    ease: "Cubic.easeOut",
  });

  return pulse;
}

export function flashSlotLock(scene: Phaser.Scene, slotView: SlotView): SlotFlashState {
  const flash: SlotFlashState = {
    slotId: slotView.id,
    alpha: 0.9,
    inset: -5,
  };

  scene.tweens.add({
    targets: flash,
    alpha: 0,
    inset: -13,
    duration: ASSEMBLY_TIMINGS.placement,
    ease: "Cubic.easeOut",
  });

  return flash;
}

export function createSyncLines(scene: Phaser.Scene, moduleViews: ModuleView[]): SyncLineState {
  const sync: SyncLineState = {
    slotIds: moduleViews.map((moduleView) => moduleView.slotId),
    alpha: 0.3,
    travel: 0,
  };

  scene.tweens.add({
    targets: sync,
    alpha: 0.54,
    duration: 180,
    ease: "Sine.easeInOut",
    yoyo: true,
    repeat: -1,
  });
  scene.tweens.add({
    targets: sync,
    travel: 1,
    duration: 520,
    ease: "Linear",
    repeat: -1,
  });

  return sync;
}

export function animateModulePlacement(scene: Phaser.Scene, moduleView: ModuleView, slotView: SlotView): PlacementAnimation {
  const placement: PlacementAnimation = {
    slotId: slotView.id,
    offsetY: -18,
    scale: 0.84,
    rotation: -0.08,
    shadow: 0.12,
    glow: 0.56,
  };

  scene.tweens.add({
    targets: placement,
    offsetY: 2,
    scale: 1.04,
    rotation: 0.02,
    shadow: 0.3,
    glow: 0.82,
    duration: 150,
    ease: "Cubic.easeOut",
    onComplete: () => {
      scene.tweens.add({
        targets: placement,
        offsetY: 0,
        scale: 1,
        rotation: 0,
        shadow: 0.18,
        glow: 0.1,
        duration: 90,
        ease: "Back.easeOut",
      });
    },
  });

  return placement;
}

export function setModuleSelectedState(
  scene: Phaser.Scene,
  moduleView: ModuleView,
  selection: SelectionAnimation | undefined,
  isSelected: boolean,
): SelectionAnimation {
  const next = selection ?? { slotId: moduleView.slotId, progress: 0 };
  scene.tweens.killTweensOf(next);
  scene.tweens.add({
    targets: next,
    progress: isSelected ? 1 : 0,
    duration: ASSEMBLY_TIMINGS.selection,
    ease: isSelected ? "Quad.easeOut" : "Quad.easeIn",
  });
  return next;
}

export function showCombinePreview(
  scene: Phaser.Scene,
  selectedModuleViews: ModuleView[],
  botPreviewData: BotPreviewData,
): CombinePreviewState {
  const centerX = selectedModuleViews.reduce((sum, moduleView) => sum + moduleView.x, 0) / selectedModuleViews.length;
  const centerY = selectedModuleViews.reduce((sum, moduleView) => sum + moduleView.y, 0) / selectedModuleViews.length;
  const preview: CombinePreviewState = {
    key: `${selectedModuleViews.map((moduleView) => moduleView.slotId).sort().join("|")}:${botPreviewData.id}`,
    slotIds: selectedModuleViews.map((moduleView) => moduleView.slotId),
    centerX,
    centerY,
    compress: 0,
    badgeAlpha: 0,
    badgeScale: 0.88,
    data: botPreviewData,
    sync: createSyncLines(scene, selectedModuleViews),
  };

  scene.tweens.add({
    targets: preview,
    compress: 1,
    badgeAlpha: 1,
    badgeScale: 1,
    duration: 180,
    ease: "Cubic.easeOut",
    onComplete: () => {
      scene.tweens.add({
        targets: preview,
        compress: 0.34,
        duration: 200,
        ease: "Quad.easeOut",
      });
    },
  });

  return preview;
}

export function animateBotMerge(
  scene: Phaser.Scene,
  selectedModuleViews: ModuleView[],
  botView: BotView,
): MergeAnimation {
  const centerX = selectedModuleViews.reduce((sum, moduleView) => sum + moduleView.x, 0) / selectedModuleViews.length;
  const centerY = selectedModuleViews.reduce((sum, moduleView) => sum + moduleView.y, 0) / selectedModuleViews.length;
  const merge: MergeAnimation = {
    slotIds: selectedModuleViews.map((moduleView) => moduleView.slotId),
    centerX,
    centerY,
    lockAlpha: 0,
    flashAlpha: 0,
    flashRadius: 20,
    botAlpha: 0,
    botScale: 0.56,
    botX: centerX,
    botY: centerY,
    botColor: botView.color,
    botRole: botView.role,
    botId: botView.id,
    sync: createSyncLines(scene, selectedModuleViews),
    ghosts: selectedModuleViews.map((moduleView) => ({
      slotId: moduleView.slotId,
      moduleId: moduleView.moduleId,
      color: moduleView.color,
      shortName: moduleView.shortName,
      x: moduleView.x,
      y: moduleView.y,
      scale: 1,
      rotation: 0,
      alpha: 1,
    })),
  };

  scene.tweens.add({
    targets: merge,
    lockAlpha: 1,
    duration: 110,
    ease: "Cubic.easeOut",
  });

  for (const ghost of merge.ghosts) {
    scene.tweens.add({
      targets: ghost,
      x: centerX + (ghost.x - centerX) * 0.25,
      y: centerY + (ghost.y - centerY) * 0.25,
      scale: 0.82,
      rotation: Phaser.Math.Clamp((centerX - ghost.x) * 0.0025, -0.12, 0.12),
      duration: 250,
      delay: 100,
      ease: "Cubic.easeInOut",
      onComplete: () => {
        scene.tweens.add({
          targets: ghost,
          alpha: 0,
          scale: 0.32,
          x: centerX,
          y: centerY,
          duration: 140,
          ease: "Quad.easeIn",
        });
      },
    });
  }

  scene.tweens.add({
    targets: merge,
    flashAlpha: 0.9,
    flashRadius: 58,
    duration: 130,
    delay: 300,
    ease: "Quad.easeOut",
    yoyo: true,
  });

  scene.tweens.add({
    targets: merge,
    botAlpha: 1,
    botScale: 1.08,
    botX: botView.x,
    botY: botView.y,
    duration: 300,
    delay: 390,
    ease: "Back.easeOut",
    onComplete: () => {
      scene.tweens.add({
        targets: merge,
        botScale: 1,
        lockAlpha: 0,
        duration: 160,
        ease: "Quad.easeOut",
      });
    },
  });

  return merge;
}

export class AssemblyEffectsManager {
  private placementAnimations = new Map<string, PlacementAnimation>();
  private selectionAnimations = new Map<string, SelectionAnimation>();
  private pulses: MechanicalPulse[] = [];
  private slotFlashes = new Map<string, SlotFlashState>();
  private preview?: CombinePreviewState;
  private merge?: MergeAnimation;
  private suppressedBotIds = new Set<string>();
  private hoveredSlotId?: string;

  constructor(private scene: Phaser.Scene) {}

  destroy(): void {
    for (const placement of this.placementAnimations.values()) {
      this.scene.tweens.killTweensOf(placement);
    }
    for (const selection of this.selectionAnimations.values()) {
      this.scene.tweens.killTweensOf(selection);
    }
    for (const pulse of this.pulses) {
      this.scene.tweens.killTweensOf(pulse);
    }
    for (const flash of this.slotFlashes.values()) {
      this.scene.tweens.killTweensOf(flash);
    }
    if (this.preview) {
      this.killSync(this.preview.sync);
      this.scene.tweens.killTweensOf(this.preview);
    }
    if (this.merge) {
      this.killSync(this.merge.sync);
      this.scene.tweens.killTweensOf(this.merge);
      for (const ghost of this.merge.ghosts) {
        this.scene.tweens.killTweensOf(ghost);
      }
    }
  }

  setHoveredSlot(slotId?: string): void {
    this.hoveredSlotId = slotId;
  }

  animateModulePlacement(moduleView: ModuleView, slotView: SlotView): void {
    const placement = animateModulePlacement(this.scene, moduleView, slotView);
    this.placementAnimations.set(slotView.id, placement);
    const flash = flashSlotLock(this.scene, slotView);
    this.slotFlashes.set(slotView.id, flash);
    this.pulses.push(createMechanicalPulse(this.scene, slotView.x, slotView.y));
    this.pulses.push(createMechanicalPulse(this.scene, slotView.x, slotView.y));
  }

  setModuleSelectedState(moduleView: ModuleView, isSelected: boolean): void {
    const selection = setModuleSelectedState(this.scene, moduleView, this.selectionAnimations.get(moduleView.slotId), isSelected);
    this.selectionAnimations.set(moduleView.slotId, selection);
    if (!isSelected) {
      this.scene.time.delayedCall(ASSEMBLY_TIMINGS.selection + 40, () => {
        const current = this.selectionAnimations.get(moduleView.slotId);
        if (current && current.progress <= 0.01) {
          this.selectionAnimations.delete(moduleView.slotId);
        }
      });
    }
  }

  showCombinePreview(selectedModuleViews: ModuleView[], botPreviewData: BotPreviewData): void {
    const key = `${selectedModuleViews.map((moduleView) => moduleView.slotId).sort().join("|")}:${botPreviewData.id}`;
    if (this.preview?.key === key) {
      return;
    }
    this.clearCombinePreview();
    this.preview = showCombinePreview(this.scene, selectedModuleViews, botPreviewData);
  }

  clearCombinePreview(): void {
    if (!this.preview) {
      return;
    }
    this.killSync(this.preview.sync);
    this.scene.tweens.killTweensOf(this.preview);
    this.preview = undefined;
  }

  animateBotMerge(selectedModuleViews: ModuleView[], botView: BotView): void {
    this.clearCombinePreview();
    if (this.merge) {
      this.killSync(this.merge.sync);
      for (const ghost of this.merge.ghosts) {
        this.scene.tweens.killTweensOf(ghost);
      }
      this.scene.tweens.killTweensOf(this.merge);
    }
    this.merge = animateBotMerge(this.scene, selectedModuleViews, botView);
    this.suppressedBotIds.add(botView.id);
    this.scene.time.delayedCall(ASSEMBLY_TIMINGS.merge, () => {
      this.suppressedBotIds.delete(botView.id);
      if (this.merge?.botId === botView.id) {
        this.killSync(this.merge.sync);
        this.merge = undefined;
      }
    });
  }

  isBotSuppressed(botId: string): boolean {
    return this.suppressedBotIds.has(botId);
  }

  getModuleRenderState(slotView: SlotView, time: number, selected: boolean, recommended: boolean): ModuleRenderState {
    const placement = this.placementAnimations.get(slotView.id);
    const selection = this.selectionAnimations.get(slotView.id);
    const hoverProgress = this.hoveredSlotId === slotView.id ? 0.42 : 0;
    const selectedProgress = selection?.progress ?? 0;
    const primed = Math.max(selectedProgress, hoverProgress);
    const pulse = primed > 0 ? 0.5 + 0.5 * Math.sin(time * 5.6 + slotView.x * 0.012) : 0;

    let x = slotView.x;
    let y = slotView.y + (placement?.offsetY ?? 0);
    let scale = (placement?.scale ?? 1) * (1 + primed * 0.05 + pulse * selectedProgress * 0.012);
    let rotation = placement?.rotation ?? 0;

    if (this.preview?.slotIds.includes(slotView.id)) {
      const dx = this.preview.centerX - slotView.x;
      const dy = this.preview.centerY - slotView.y;
      x += dx * 0.06 * this.preview.compress;
      y += dy * 0.06 * this.preview.compress;
      rotation += Phaser.Math.Clamp(dx * 0.0008, -0.08, 0.08) * this.preview.compress;
      scale *= 1 - this.preview.compress * 0.03;
    }

    return {
      x,
      y,
      scale,
      rotation,
      shadowAlpha: 0.16 + (placement?.shadow ?? 0) + primed * 0.12,
      glowAlpha: (placement?.glow ?? 0) + primed * 0.2 + (recommended ? 0.08 : 0),
      borderAlpha: 0.72 + primed * 0.2,
      borderColor: selected ? 0xdaf5ff : hoverProgress > 0 ? 0xb8efe9 : 0x0f1c24,
      textScale: 1 + primed * 0.04,
      textAlpha: 0.92 + primed * 0.08,
    };
  }

  getSlotAttention(slotId: string, time: number): { extraGlow: number; flashInset: number; flashAlpha: number } {
    const flash = this.slotFlashes.get(slotId);
    if (flash && flash.alpha <= 0.01) {
      this.slotFlashes.delete(slotId);
    }
    return {
      extraGlow: flash ? flash.alpha * (0.5 + 0.5 * Math.sin(time * 18)) : 0,
      flashInset: flash?.inset ?? -4,
      flashAlpha: flash?.alpha ?? 0,
    };
  }

  drawUnderlay(graphics: Phaser.GameObjects.Graphics, slotViews: SlotView[], time: number): void {
    this.pulses = this.pulses.filter((pulse) => pulse.alpha > 0.01);
    for (const pulse of this.pulses) {
      graphics.lineStyle(pulse.lineWidth, 0xbad5e5, pulse.alpha * 0.6);
      graphics.strokeCircle(pulse.x, pulse.y, pulse.radius);
      graphics.lineStyle(1, 0xf0d27a, pulse.alpha * 0.42);
      graphics.lineBetween(pulse.x - pulse.radius * 0.9, pulse.y, pulse.x + pulse.radius * 0.9, pulse.y);
    }

    if (this.preview) {
      this.drawSync(graphics, slotViews, this.preview.sync, 0x90d4ec, time, 0.82);
    }
    if (this.merge) {
      this.drawSync(graphics, slotViews, this.merge.sync, 0xf0d27a, time, 1);
    }
  }

  drawOverlay(graphics: Phaser.GameObjects.Graphics): void {
    if (this.preview) {
      const rise = 42 + (1 - this.preview.badgeScale) * 10;
      graphics.fillStyle(0x0d1822, this.preview.badgeAlpha * 0.92);
      graphics.fillRoundedRect(this.preview.centerX - 74, this.preview.centerY - rise - 20, 148, 34, 12);
      graphics.lineStyle(1, this.preview.data.color, this.preview.badgeAlpha * 0.84);
      graphics.strokeRoundedRect(this.preview.centerX - 74, this.preview.centerY - rise - 20, 148, 34, 12);
      drawMechanicalBotBadge(graphics, this.preview.centerX - 50, this.preview.centerY - rise - 3, this.preview.data.role, this.preview.data.color, 0.64 * this.preview.badgeScale, this.preview.badgeAlpha);
    }

    if (!this.merge) {
      return;
    }

    graphics.lineStyle(2, 0xf0d27a, this.merge.lockAlpha * 0.75);
    graphics.strokeCircle(this.merge.centerX, this.merge.centerY, 26 + this.merge.lockAlpha * 10);

    for (const ghost of this.merge.ghosts) {
      if (ghost.alpha <= 0.01) {
        continue;
      }
      this.drawGhostModule(graphics, ghost);
    }

    if (this.merge.flashAlpha > 0.01) {
      graphics.fillStyle(0xf5e1a5, this.merge.flashAlpha * 0.3);
      graphics.fillCircle(this.merge.centerX, this.merge.centerY, this.merge.flashRadius);
      graphics.lineStyle(2, 0xf5e1a5, this.merge.flashAlpha * 0.72);
      graphics.strokeCircle(this.merge.centerX, this.merge.centerY, this.merge.flashRadius + 8);
    }

    if (this.merge.botAlpha > 0.01) {
      drawMechanicalBotBadge(graphics, this.merge.botX, this.merge.botY, this.merge.botRole, this.merge.botColor, this.merge.botScale, this.merge.botAlpha);
      drawBracketCorners(graphics, this.merge.botX, this.merge.botY, 28 * this.merge.botScale, 28 * this.merge.botScale, this.merge.botAlpha * 0.6);
    }
  }

  private drawGhostModule(graphics: Phaser.GameObjects.Graphics, ghost: MergeGhost): void {
    const width = 48 * ghost.scale;
    const height = 34 * ghost.scale;
    const shadowY = ghost.y + 20;
    graphics.fillStyle(0x04080d, ghost.alpha * 0.18);
    graphics.fillEllipse(ghost.x, shadowY, width * 0.8, 10 * ghost.scale);

    const points = buildBeveledPlatePoints(ghost.x, ghost.y, width, height, 7 * ghost.scale, ghost.rotation);
    graphics.fillStyle(ghost.color, ghost.alpha * 0.95);
    graphics.fillPoints(points, true);
    graphics.lineStyle(1.5, 0xeaf7ff, ghost.alpha * 0.74);
    graphics.strokePoints(points, true);
  }

  private drawSync(
    graphics: Phaser.GameObjects.Graphics,
    slotViews: SlotView[],
    sync: SyncLineState,
    color: number,
    time: number,
    intensity: number,
  ): void {
    const selectedSlots = sync.slotIds
      .map((slotId) => slotViews.find((slotView) => slotView.id === slotId))
      .filter((slotView): slotView is SlotView => Boolean(slotView));

    if (selectedSlots.length < 2) {
      return;
    }

    const alpha = sync.alpha * intensity * (0.72 + Math.sin(time * 4.2) * 0.08);
    for (let index = 0; index < selectedSlots.length - 1; index += 1) {
      const from = selectedSlots[index];
      const to = selectedSlots[index + 1];
      graphics.lineStyle(1.5, color, alpha);
      graphics.lineBetween(from.x, from.y, to.x, to.y);

      const pulseT = (sync.travel + index * 0.18) % 1;
      const pulseX = Phaser.Math.Linear(from.x, to.x, pulseT);
      const pulseY = Phaser.Math.Linear(from.y, to.y, pulseT);
      graphics.fillStyle(color, alpha * 0.85);
      graphics.fillCircle(pulseX, pulseY, 2.4);
    }

    const bounds = new Phaser.Geom.Rectangle();
    Phaser.Geom.Rectangle.FromPoints(selectedSlots.map((slot) => new Phaser.Geom.Point(slot.x, slot.y)), bounds);
    drawBracketCorners(graphics, bounds.centerX, bounds.centerY, bounds.width + 52, bounds.height + 52, alpha * 0.56);
  }

  private killSync(sync: SyncLineState): void {
    this.scene.tweens.killTweensOf(sync);
  }
}