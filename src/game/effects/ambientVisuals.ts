import Phaser from "phaser";

interface StarParticle {
  x: number;
  y: number;
  size: number;
  alpha: number;
  driftX: number;
  driftY: number;
  color: number;
}

interface ShootingStarState {
  active: boolean;
  x: number;
  y: number;
  length: number;
  angle: number;
  progress: number;
  alpha: number;
  width: number;
  speed: number;
}

export interface StarfieldHandle {
  update(dt: number): void;
  draw(graphics: Phaser.GameObjects.Graphics): void;
  destroy(): void;
}

interface StarfieldOptions {
  width: number;
  height: number;
  farCount?: number;
  nearCount?: number;
}

function wrapCoordinate(value: number, limit: number): number {
  if (value < 0) {
    return limit;
  }
  if (value > limit) {
    return 0;
  }
  return value;
}

function createStar(scene: Phaser.Scene, width: number, height: number, layer: "far" | "near"): StarParticle {
  const far = layer === "far";
  const star: StarParticle = {
    x: Phaser.Math.FloatBetween(0, width),
    y: Phaser.Math.FloatBetween(0, height),
    size: far ? Phaser.Math.FloatBetween(0.5, 1.6) : Phaser.Math.FloatBetween(0.9, 2.4),
    alpha: far ? Phaser.Math.FloatBetween(0.1, 0.26) : Phaser.Math.FloatBetween(0.2, 0.52),
    driftX: far ? Phaser.Math.FloatBetween(-0.22, 0.22) : Phaser.Math.FloatBetween(-0.42, 0.42),
    driftY: far ? Phaser.Math.FloatBetween(-0.08, 0.08) : Phaser.Math.FloatBetween(-0.16, 0.16),
    color: far ? 0x9dbdd0 : Phaser.Math.Between(0, 100) > 74 ? 0xdcb678 : 0xd7f0ff,
  };

  scene.tweens.add({
    targets: star,
    alpha: far ? star.alpha + 0.08 : star.alpha + 0.14,
    duration: Phaser.Math.Between(4200, 9000),
    ease: "Sine.easeInOut",
    yoyo: true,
    repeat: -1,
    delay: Phaser.Math.Between(0, 4000),
  });

  return star;
}

export function createStarfield(scene: Phaser.Scene, options: StarfieldOptions): StarfieldHandle {
  const width = options.width;
  const height = options.height;
  const farStars = Array.from({ length: options.farCount ?? 56 }, () => createStar(scene, width, height, "far"));
  const nearStars = Array.from({ length: options.nearCount ?? 28 }, () => createStar(scene, width, height, "near"));
  const shootingStar: ShootingStarState = {
    active: false,
    x: 0,
    y: 0,
    length: 80,
    angle: Phaser.Math.DegToRad(32),
    progress: 0,
    alpha: 0,
    width: 2,
    speed: 0,
  };

  function trySpawnShootingStar(): void {
    if (shootingStar.active || Math.random() > 0.0016) {
      return;
    }
    shootingStar.active = true;
    shootingStar.x = Phaser.Math.FloatBetween(width * 0.2, width * 0.78);
    shootingStar.y = Phaser.Math.FloatBetween(40, height * 0.34);
    shootingStar.length = Phaser.Math.FloatBetween(70, 120);
    shootingStar.width = Phaser.Math.FloatBetween(1.4, 2.2);
    shootingStar.progress = 0;
    shootingStar.alpha = 0.46;
    shootingStar.speed = Phaser.Math.FloatBetween(380, 520);
    scene.tweens.add({
      targets: shootingStar,
      alpha: 0,
      duration: 520,
      ease: "Quad.easeOut",
      onComplete: () => {
        shootingStar.active = false;
      },
    });
  }

  return {
    update(dt: number) {
      for (const star of farStars) {
        star.x = wrapCoordinate(star.x + star.driftX * dt, width);
        star.y = wrapCoordinate(star.y + star.driftY * dt, height);
      }
      for (const star of nearStars) {
        star.x = wrapCoordinate(star.x + star.driftX * dt, width);
        star.y = wrapCoordinate(star.y + star.driftY * dt, height);
      }

      if (shootingStar.active) {
        shootingStar.progress += shootingStar.speed * dt;
      } else {
        trySpawnShootingStar();
      }
    },
    draw(graphics: Phaser.GameObjects.Graphics) {
      for (const star of farStars) {
        graphics.fillStyle(star.color, star.alpha);
        graphics.fillCircle(star.x, star.y, star.size);
      }
      for (const star of nearStars) {
        graphics.fillStyle(star.color, star.alpha);
        graphics.fillCircle(star.x, star.y, star.size);
      }

      if (shootingStar.active) {
        const dx = Math.cos(shootingStar.angle) * shootingStar.length;
        const dy = Math.sin(shootingStar.angle) * shootingStar.length;
        const startX = shootingStar.x + shootingStar.progress;
        const startY = shootingStar.y + shootingStar.progress * 0.55;
        graphics.lineStyle(shootingStar.width, 0xe9f8ff, shootingStar.alpha);
        graphics.beginPath();
        graphics.moveTo(startX, startY);
        graphics.lineTo(startX - dx, startY - dy);
        graphics.strokePath();
      }
    },
    destroy() {
      scene.tweens.killTweensOf(farStars);
      scene.tweens.killTweensOf(nearStars);
      scene.tweens.killTweensOf(shootingStar);
    },
  };
}

export function drawAmbientPanel(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  time: number,
): void {
  const glowAlpha = 0.1 + Math.sin(time * 0.18) * 0.03;
  graphics.fillStyle(0x0c1822, 0.34 + glowAlpha);
  graphics.fillRoundedRect(x - 4, y - 4, width + 8, height + 8, radius + 4);

  graphics.fillStyle(0x0e1b26, 0.96);
  graphics.fillRoundedRect(x, y, width, height, radius);

  graphics.fillStyle(0x153247, 0.18);
  graphics.fillRoundedRect(x + 8, y + 8, width - 16, Math.max(18, height * 0.28), Math.max(10, radius - 4));

  graphics.lineStyle(1, 0x243543, 0.82);
  graphics.strokeRoundedRect(x, y, width, height, radius);

  const rivets = [
    [x + 14, y + 14],
    [x + width - 14, y + 14],
    [x + 14, y + height - 14],
    [x + width - 14, y + height - 14],
  ];
  for (const [rivetX, rivetY] of rivets) {
    graphics.fillStyle(0xb08d57, 0.22);
    graphics.fillCircle(rivetX, rivetY, 2.6);
  }
}

export function drawMechanicalHalo(
  graphics: Phaser.GameObjects.Graphics,
  centerX: number,
  centerY: number,
  time: number,
): void {
  const brass = 0xb08d57;
  const rotation = time * 0.09;

  graphics.lineStyle(4, brass, 0.22);
  graphics.strokeCircle(centerX, centerY, 178);
  graphics.lineStyle(1, brass, 0.34);
  graphics.strokeCircle(centerX, centerY, 171);

  for (let tick = 0; tick < 24; tick += 1) {
    const angle = rotation + (Math.PI * 2 * tick) / 24;
    const inner = 168;
    const outer = tick % 3 === 0 ? 184 : 178;
    graphics.lineStyle(tick % 3 === 0 ? 2 : 1, brass, tick % 3 === 0 ? 0.28 : 0.2);
    graphics.lineBetween(
      centerX + Math.cos(angle) * inner,
      centerY + Math.sin(angle) * inner,
      centerX + Math.cos(angle) * outer,
      centerY + Math.sin(angle) * outer,
    );
  }
}

