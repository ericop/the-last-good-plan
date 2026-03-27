import { saveProgress } from "../save/localStorageSave";
import type { GameCommand } from "../types/commands";
import type { RunState, SaveData } from "../types/gameTypes";
import { createRunState } from "./createRunState";
import { processCommand } from "./processCommand";
import { stepSimulation } from "./simulation";

export type Listener = (state: RunState) => void;

export class GameController {
  private state: RunState;
  private listeners = new Set<Listener>();
  private saveData: SaveData;
  private emitAccumulator = 0;

  constructor(saveData: SaveData) {
    this.saveData = saveData;
    this.state = createRunState(saveData, "menu");
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
    this.state = processCommand(this.state, command, this.saveData);
    this.syncSaveData();
    this.emit();
  }

  update(dt: number): void {
    const important = stepSimulation(this.state, dt);
    this.emitAccumulator += dt;
    if (important || this.emitAccumulator >= 0.12) {
      this.syncSaveData();
      this.emit();
      this.emitAccumulator = 0;
    }
  }

  private syncSaveData(): void {
    this.saveData.discovery = JSON.parse(JSON.stringify(this.state.discovery));
    this.saveData.meta = { ...this.state.meta };
    saveProgress(this.saveData);
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
