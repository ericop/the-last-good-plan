import type { DoctrineDefinition, DoctrineId } from "../types/gameTypes";

export const DOCTRINES: Record<DoctrineId, DoctrineDefinition> = {
  balanced: {
    id: "balanced",
    name: "Balanced",
    summary: "Mixed priorities. Bots divide time between mining, defense, and support.",
    weights: {
      mining: 1,
      attack: 1,
      support: 1,
      defense: 1,
    },
  },
  extraction_focus: {
    id: "extraction_focus",
    name: "Extraction Focus",
    summary: "Pushes mining and objective completion. Faster gains, thinner safety margins.",
    weights: {
      mining: 1.45,
      attack: 0.9,
      support: 0.75,
      defense: 0.85,
    },
  },
  preservation_mode: {
    id: "preservation_mode",
    name: "Preservation Mode",
    summary: "Prioritizes bot survival, repairs, and intercepting threats near the ship.",
    weights: {
      mining: 0.7,
      attack: 1.05,
      support: 1.45,
      defense: 1.35,
    },
  },
};
