import { createDefaultDiscoveryLog } from "../core/discovery";
import type { SaveData } from "../types/gameTypes";

const SAVE_KEY = "the-last-good-plan-save-v1";

export function loadSaveData(): SaveData {
  const defaults: SaveData = {
    discovery: createDefaultDiscoveryLog(),
    meta: {
      totalCyclesCompleted: 0,
      totalPerfectCommitments: 0,
      totalArtifactsRecovered: 0,
    },
  };

  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      discovery: {
        ...defaults.discovery,
        ...(parsed.discovery ?? {}),
      },
      meta: {
        ...defaults.meta,
        ...(parsed.meta ?? {}),
      },
    };
  } catch {
    return defaults;
  }
}

export function saveProgress(saveData: SaveData): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
}
