import Phaser from "phaser";
import type { GameController } from "../core/gameController";

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("main-menu");
  }

  create(): void {
    const controller = this.registry.get("controller") as GameController;
    if (controller.getState().phase !== "menu") {
      this.scene.start("run");
      return;
    }

    this.cameras.main.setBackgroundColor("#07131c");
    const unsubscribe = controller.subscribe((state) => {
      if (state.phase !== "menu") {
        unsubscribe();
        this.scene.start("run");
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
  }
}
