import type { ModuleDefinition, ModuleId } from "../types/gameTypes";

export const MODULE_DEFINITIONS: Record<ModuleId, ModuleDefinition> = {
  solar_collector: {
    id: "solar_collector",
    name: "Solar Collector",
    shortName: "SOL",
    description: "Produces solar income each cycle and powers solar-based merges.",
    color: 0xf6d35c,
    icon: "S",
    fabricationCost: { solar: 10, minerals: 6, scrap: 0 },
  },
  mineral_drill: {
    id: "mineral_drill",
    name: "Mineral Drill",
    shortName: "DRL",
    description: "Mines the moon objective and anchors industrial bot recipes.",
    color: 0x69c0ff,
    icon: "M",
    fabricationCost: { solar: 8, minerals: 12, scrap: 0 },
  },
  shield_emitter: {
    id: "shield_emitter",
    name: "Shield Emitter",
    shortName: "SHD",
    description: "Rebuilds shields and stabilizes defensive bot patterns.",
    color: 0x77ddbb,
    icon: "E",
    fabricationCost: { solar: 10, minerals: 10, scrap: 0 },
  },
  pulse_cannon: {
    id: "pulse_cannon",
    name: "Pulse Cannon",
    shortName: "CAN",
    description: "Provides autonomous ship fire and offensive merge potential.",
    color: 0xff8d70,
    icon: "P",
    fabricationCost: { solar: 8, minerals: 14, scrap: 0 },
  },
  cargo_core: {
    id: "cargo_core",
    name: "Cargo Core",
    shortName: "CAR",
    description: "Boosts adjacent production and improves salvage returns.",
    color: 0xd4b0ff,
    icon: "C",
    fabricationCost: { solar: 6, minerals: 8, scrap: 0 },
  },
  repair_node: {
    id: "repair_node",
    name: "Repair Node",
    shortName: "REP",
    description: "Repairs allied bots and hull, enabling calm recovery loops.",
    color: 0xa6f0a2,
    icon: "R",
    fabricationCost: { solar: 10, minerals: 8, scrap: 0 },
  },
  booster: {
    id: "booster",
    name: "Booster",
    shortName: "BST",
    description:
      "Thruster block. On the ship it fires a pulse that shoves nearby small enemies back. Merged into a bot, each Booster gives 33% dodge against telegraphed lance fire.",
    color: 0xf2a6ff,
    icon: "B",
    fabricationCost: { solar: 12, minerals: 8, scrap: 0 },
  },
  launch_port: {
    id: "launch_port",
    name: "Launch Port",
    shortName: "LPT",
    description:
      "Carrier hangar. Launches fighters on its own during missions. Next to a drill it builds mining skiffs, next to repair it builds tenders. Cannons, shields, and solar sharpen the wing. Cannot be merged.",
    color: 0x8fb4ff,
    icon: "L",
    fabricationCost: { solar: 12, minerals: 10, scrap: 8 },
  },
};

