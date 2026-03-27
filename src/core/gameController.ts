import { saveProgress } from "../save/localStorageSave";
import type { GameCommand } from "../types/commands";
import type { RunState, SaveData } from "../types/gameTypes";
import { createRunState } from "./createRunState";
import { processCommand } from "./processCommand";
import { stepSimulation } from "./simulation";
import {
  captureTutorialSnapshot,
  isTutorialCommandAllowed,
  shouldAutoStartTutorial,
  updateTutorialAfterCommand,
  updateTutorialAfterSimulation,
} from "./tutorial";

export type Listener = (state: RunState) => void;

export class GameController {
  private state: RunState;
  private listeners = new Set<Listener>();
  private saveData: SaveData;
  private emitAccumulator = 0;

  constructor(saveData: SaveData) {
    this.saveData = saveData;
    const autoTutorial = shouldAutoStartTutorial(saveData);
    this.state = createRunState(saveData, autoTutorial ? "planning" : "menu", { forceTutorial: autoTutorial });
  }

  getState(): RunState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispatch(command: GameCommand): void {
    if (!isTutorialCommandAllowed(this.state, command)) {
      return;
    }

    const before = captureTutorialSnapshot(this.state);
    this.state = processCommand(this.state, command, this.saveData);
    updateTutorialAfterCommand(this.state, before, command);
    this.syncSaveData();
    this.emit();
  }

  update(dt: number): void {
    const before = captureTutorialSnapshot(this.state);
    const important = stepSimulation(this.state, dt);
    updateTutorialAfterSimulation(this.state, before);

    if (important) {
      this.syncSaveData();
      this.emit();
      this.emitAccumulator = 0;
      return;
    }

    const shouldStreamUi = this.state.phase === "execution" && !this.state.paused && !this.state.pendingReward;
    if (!shouldStreamUi) {
      this.emitAccumulator = 0;
      return;
    }

    this.emitAccumulator += dt;
    if (this.emitAccumulator >= 0.12) {
      this.syncSaveData();
      this.emit();
      this.emitAccumulator = 0;
    }
  }

  private syncSaveData(): void {
    this.saveData.discovery = JSON.parse(JSON.stringify(this.state.discovery));
    this.saveData.meta = { ...this.state.meta };
    this.saveData.onboarding = { ...this.state.onboarding };
    saveProgress(this.saveData);
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
