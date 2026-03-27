import type { ThreatWave } from "../types/gameTypes";

export function createThreatSchedule(cycle: number): ThreatWave[] {
  return [
    {
      time: 6,
      label: `Scavenger pair x${2 + cycle}`,
      kind: "scavenger",
      count: 2 + cycle,
    },
    {
      time: 16,
      label: `Scavenger sweep x${3 + cycle}`,
      kind: "scavenger",
      count: 3 + cycle,
    },
    {
      time: 27,
      label: `Heavy sweep x${4 + cycle}`,
      kind: "scavenger",
      count: 4 + cycle,
    },
    {
      time: 36,
      label: "Mini-boss: Grave Knocker",
      kind: "mini_boss",
      count: 1,
    },
  ];
}
