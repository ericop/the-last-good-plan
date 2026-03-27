import type { UpgradeDefinition, UpgradeId } from "../types/gameTypes";

export const UPGRADE_DEFINITIONS: Record<UpgradeId, UpgradeDefinition> = {
  mining_array: {
    id: "mining_array",
    name: "Mining Array",
    summary: "Boosts all mining output from modules and bots.",
    costs: [
      { solar: 12, minerals: 16, scrap: 12 },
      { solar: 16, minerals: 22, scrap: 16 },
      { solar: 20, minerals: 28, scrap: 20 },
    ],
  },
  defense_grid: {
    id: "defense_grid",
    name: "Defense Grid",
    summary: "Raises shield capacity and offensive hold strength.",
    costs: [
      { solar: 10, minerals: 14, scrap: 16 },
      { solar: 14, minerals: 18, scrap: 22 },
      { solar: 18, minerals: 22, scrap: 28 },
    ],
  },
  support_bay: {
    id: "support_bay",
    name: "Support Bay",
    summary: "Adds bot capacity and improves repair efficiency.",
    costs: [
      { solar: 12, minerals: 12, scrap: 14 },
      { solar: 16, minerals: 16, scrap: 20 },
      { solar: 20, minerals: 20, scrap: 26 },
    ],
  },
};
