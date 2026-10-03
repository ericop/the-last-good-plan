import type { ThreatWave } from "../types/gameTypes";

export function createThreatSchedule(cycle: number): ThreatWave[] {
  const scaled = (base: number, perCycle: number) => base + Math.floor(cycle * perCycle);
  return [
    {
      time: 4,
      label: `Dart stream x${scaled(4, 1.2)}`,
      kind: "dart",
      count: scaled(4, 1.2),
      spacing: 0.7,
    },
    {
      time: 16,
      label: `Scavenger column x${scaled(3, 1.2)}`,
      kind: "scavenger",
      count: scaled(3, 1.2),
      spacing: 1.1,
    },
    {
      time: 30,
      label: `Brute push x${scaled(1, 0.5)}`,
      kind: "brute",
      count: scaled(1, 0.5),
      spacing: 2.4,
    },
    {
      time: 44,
      label: `Mixed rush x${scaled(3, 0.8)}`,
      kind: "dart",
      count: scaled(3, 0.8),
      spacing: 0.7,
      announce: "BIG WAVE INBOUND",
    },
    {
      time: 58,
      label: "Mini-boss: Grave Knocker",
      kind: "mini_boss",
      count: 1,
    },
  ];
}

export function createDuelSchedule(cycle: number, warshipId: string, warshipName: string): ThreatWave[] {
  const escorts = 2 + Math.floor(cycle / 3);
  return [
    {
      time: 2,
      label: `Warship: ${warshipName}`,
      kind: "warship",
      count: 1,
      warshipId,
      announce: "WARSHIP INBOUND",
    },
    {
      time: 18,
      label: `Escort darts x${escorts}`,
      kind: "dart",
      count: escorts,
      spacing: 0.8,
    },
    {
      time: 38,
      label: `Boarding column x${escorts + 1}`,
      kind: "scavenger",
      count: escorts + 1,
      spacing: 1,
    },
    {
      time: 56,
      label: `Second escort x${escorts}`,
      kind: "dart",
      count: escorts,
      spacing: 0.8,
    },
  ];
}
