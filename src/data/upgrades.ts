import type { UpgradeDefinition, UpgradeId } from "../types/gameTypes";

export const UPGRADE_DEFINITIONS: Record<UpgradeId, UpgradeDefinition> = {
  mining_array: {
    id: "mining_array",
    name: "Mining Array",
    summary: "Boosts all mining output from modules and bots.",
    perLevelText: "+18% module mining and +18% bot mining.",
    costs: [
      { solar: 6, minerals: 8, scrap: 36 },
      { solar: 8, minerals: 11, scrap: 48 },
      { solar: 10, minerals: 14, scrap: 60 },
    ],
  },
  defense_grid: {
    id: "defense_grid",
    name: "Defense Grid",
    summary: "Raises shield capacity and offensive hold strength.",
    perLevelText: "+10 hull, +14 shield, +14% module defense, +12% bot combat.",
    costs: [
      { solar: 5, minerals: 7, scrap: 48 },
      { solar: 7, minerals: 9, scrap: 66 },
      { solar: 9, minerals: 11, scrap: 84 },
    ],
  },
  support_bay: {
    id: "support_bay",
    name: "Support Bay",
    summary: "Adds bot capacity and improves repair efficiency.",
    perLevelText: "+1 bot capacity and +16% repair/support output.",
    costs: [
      { solar: 6, minerals: 6, scrap: 42 },
      { solar: 8, minerals: 8, scrap: 60 },
      { solar: 10, minerals: 10, scrap: 78 },
    ],
  },
};
