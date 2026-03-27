import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultDiscoveryLog } from "../core/discovery";
import { clearSaveData, loadSaveData, saveProgress } from "./localStorageSave";
import type { SaveData } from "../types/gameTypes";

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

const memoryStorage = createMemoryStorage();
vi.stubGlobal("localStorage", memoryStorage);

afterEach(() => {
  clearSaveData();
});

describe("local storage save", () => {
  it("persists discovered recipes across reloads", () => {
    const discovery = createDefaultDiscoveryLog();
    discovery.survey_harrier = {
      recipeId: "survey_harrier",
      state: "known_mastered_lite",
      uses: 3,
      successes: 2,
    };

    const saveData: SaveData = {
      discovery,
      meta: {
        totalCyclesCompleted: 4,
        totalPerfectCommitments: 2,
        totalArtifactsRecovered: 1,
      },
      onboarding: {
        tutorialCompleted: true,
      },
    };

    saveProgress(saveData);
    const loaded = loadSaveData();

    expect(loaded.discovery.survey_harrier.state).toBe("known_mastered_lite");
    expect(loaded.discovery.survey_harrier.uses).toBe(3);
    expect(loaded.meta.totalCyclesCompleted).toBe(4);
    expect(loaded.onboarding.tutorialCompleted).toBe(true);
  });
});
