import Phaser from "phaser";

// Ported from Rainbow-Survivors' spawnSprintGust/drawGust (github.com/ericop/Rainbow-Survivors, index.html), flattened
// from its 2.5D projection to top-down.
const PLAYER_SCALE = 1.3;
const GUST_GAP = 0.035;
// The source draws at full canvas size; this canvas is scaled down, so the faint streaks need extra alpha to read.
const VISIBILITY_BOOST = 2.2;

interface GustLine {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  lineWidth: number;
  alpha: number;
}

interface Gust {
  life: number;
  maxLife: number;
  lines: GustLine[];
}

export interface BoosterEmitter {
  id: string;
  x: number;
  y: number;
  scale: number;
}

const rnd = (min: number, max: number) => min + Math.random() * (max - min);

function createGust(x: number, y: number, dx: number, dy: number, scale: number): Gust {
  const length = Math.hypot(dx, dy);
  const dirX = dx / length;
  const dirY = dy / length;
  const back = (10 + rnd(0, 18)) * scale;
  const perpX = -dirY;
  const perpY = dirX;
  const baseX = x - dirX * back;
  const baseY = y - dirY * back;
  const lineScale = scale / PLAYER_SCALE;
  const point = (forward: number, lateral: number) => ({
    x: baseX + dirX * forward + perpX * lateral,
    y: baseY + dirY * forward + perpY * lateral,
  });
  const makeLine = (lateral: number): GustLine => {
    const lineLength = rnd(15, 25) * lineScale;
    const a = point(-lineLength, lateral);
    const b = point(lineLength * 0.15, lateral);
    return { ax: a.x, ay: a.y, bx: b.x, by: b.y, lineWidth: rnd(1, 1.8) * lineScale, alpha: rnd(0.09, 0.2) };
  };
  const life = rnd(0.26, 0.36);
  return {
    life,
    maxLife: life,
    lines: [makeLine(rnd(-9, 9) * scale), makeLine(rnd(-7, 7) * scale), makeLine(rnd(-8, 8) * scale)],
  };
}

export class BoosterTrails {
  private gusts: Gust[] = [];
  private emitters = new Map<string, { x: number; y: number; tick: number }>();

  update(dt: number, active: BoosterEmitter[]): void {
    for (const gust of this.gusts) {
      gust.life -= dt;
    }
    this.gusts = this.gusts.filter((gust) => gust.life > 0);

    const seen = new Set<string>();
    for (const emitter of active) {
      seen.add(emitter.id);
      const previous = this.emitters.get(emitter.id);
      if (!previous) {
        this.emitters.set(emitter.id, { x: emitter.x, y: emitter.y, tick: 0 });
        continue;
      }
      const dx = emitter.x - previous.x;
      const dy = emitter.y - previous.y;
      if (Math.hypot(dx, dy) > 0.001) {
        previous.tick -= dt;
        while (previous.tick <= 0) {
          this.gusts.push(createGust(emitter.x, emitter.y, dx, dy, emitter.scale));
          previous.tick += GUST_GAP;
        }
      }
      previous.x = emitter.x;
      previous.y = emitter.y;
    }
    for (const id of [...this.emitters.keys()]) {
      if (!seen.has(id)) {
        this.emitters.delete(id);
      }
    }
  }

  draw(graphics: Phaser.GameObjects.Graphics): void {
    for (const gust of this.gusts) {
      const age = 1 - gust.life / gust.maxLife;
      const fade = Math.min(Phaser.Math.Clamp(age / 0.25, 0, 1), Phaser.Math.Clamp((1 - age) / 0.35, 0, 1));
      for (const line of gust.lines) {
        graphics.lineStyle(line.lineWidth, 0xffffff, Math.min(1, line.alpha * fade * VISIBILITY_BOOST));
        graphics.lineBetween(line.ax, line.ay, line.bx, line.by);
      }
    }
  }

  clear(): void {
    this.gusts = [];
    this.emitters.clear();
  }
}
