import type { ThreatWave } from "../types/gameTypes";

export function createThreatSchedule(cycle: number): ThreatWave[] {
  const threatLevel = cycle * 2;
  return [
    {
      time: 6,
      label: `Scavenger pair x${2 + threatLevel}`,
      kind: "scavenger",
      count: 2 + threatLevel,
    },
    {
      time: 16,
      label: `Scavenger sweep x${3 + threatLevel}`,
      kind: "scavenger",
      count: 3 + threatLevel,
    },
    {
      time: 27,
      label: `Heavy sweep x${4 + threatLevel}`,
      kind: "scavenger",
      count: 4 + threatLevel,
    },
    {
      time: 36,
      label: "Mini-boss: Grave Knocker",
      kind: "mini_boss",
      count: 1,
    },
  ];
}
