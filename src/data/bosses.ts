import type { BossDefinition } from "../types/gameTypes";

export const BOSS_DEFINITIONS: BossDefinition[] = [
  {
    id: "signal_tyrant",
    name: "Signal Tyrant",
    color: 0xffd27a,
    maxHp: 520,
    shield: 120,
    speed: 11,
    attack: 24,
    range: 132,
    behaviors: [
      { kind: "periodic_shield", interval: 9, amount: 42 },
      { kind: "charging_attack", interval: 12, chargeTime: 1.35, damage: 26 },
    ],
    modifiers: [{ kind: "reduces_projectile_damage", multiplier: 0.68 }],
    reward: "dawn_prism",
  },
  {
    id: "grave_foundry",
    name: "Grave Foundry",
    color: 0xff9e76,
    maxHp: 640,
    shield: 80,
    speed: 9,
    attack: 28,
    range: 124,
    behaviors: [
      { kind: "spawning_minions", interval: 10, count: 2 },
      { kind: "directional_sweep", interval: 13, damage: 18, width: 180 },
    ],
    modifiers: [{ kind: "reflects_damage", ratio: 0.08 }],
    reward: "war_forge",
  },
  {
    id: "null_shepherd",
    name: "Null Shepherd",
    color: 0x9ef1d4,
    maxHp: 700,
    shield: 150,
    speed: 10,
    attack: 30,
    range: 138,
    behaviors: [
      { kind: "periodic_shield", interval: 8, amount: 34 },
      { kind: "charging_attack", interval: 14, chargeTime: 1.15, damage: 30 },
    ],
    modifiers: [{ kind: "disables_module_type", moduleId: "shield_emitter", interval: 12, duration: 4 }],
    reward: "sainted_patch",
  },
];