import type { WarshipDefinition } from "../types/gameTypes";

export const WARSHIP_DEFINITIONS: WarshipDefinition[] = [
  {
    id: "corsair_frigate",
    name: "Corsair Frigate",
    color: 0xe0866b,
    hull: 260,
    shield: 40,
    shieldRegen: 3,
    pointDefense: 6,
    pointDefenseRange: 140,
    weapons: [
      { name: "Burst Laser", kind: "laser", chargeTime: 6, shots: 2, damage: 5 },
      { name: "Breach Missile", kind: "missile", chargeTime: 12, shots: 1, damage: 9 },
    ],
  },
  {
    id: "brood_tender",
    name: "Brood Tender",
    color: 0xc98bf0,
    hull: 300,
    shield: 30,
    shieldRegen: 2,
    pointDefense: 4,
    pointDefenseRange: 120,
    weapons: [{ name: "Flak Laser", kind: "laser", chargeTime: 7, shots: 2, damage: 4 }],
    launch: { interval: 10, count: 2 },
  },
  {
    id: "ion_cutter",
    name: "Ion Cutter",
    color: 0x7fd8ff,
    hull: 220,
    shield: 70,
    shieldRegen: 6,
    pointDefense: 8,
    pointDefenseRange: 150,
    weapons: [
      { name: "Ion Repeater", kind: "laser", chargeTime: 3.5, shots: 1, damage: 5 },
      { name: "Cutter Missile", kind: "missile", chargeTime: 14, shots: 2, damage: 7 },
    ],
  },
];
