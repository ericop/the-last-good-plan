import type { EnemyDefinition, EnemyKind } from "../types/gameTypes";

export const ENEMY_DEFINITIONS: Record<EnemyKind, EnemyDefinition> = {
  scavenger: {
    kind: "scavenger",
    name: "Scavenger Drone",
    color: 0xff6f6f,
    hp: 34,
    speed: 24,
    attack: 8,
    range: 84,
    scrapReward: 8,
  },
  mini_boss: {
    kind: "mini_boss",
    name: "Grave Knocker",
    color: 0xffc266,
    hp: 240,
    speed: 14,
    attack: 18,
    range: 112,
    scrapReward: 32,
  },
};
