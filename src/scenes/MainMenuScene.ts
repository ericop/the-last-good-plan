import Phaser from "phaser";
import type { GameController } from "../core/gameController";

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("main-menu");
  }

  create(): void {
    const controller = this.registry.get("controller") as GameController;
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#07131c");
    this.add.rectangle(width / 2, height / 2, width * 0.84, height * 0.72, 0x0d2230, 0.94).setStrokeStyle(2, 0x3a7ca5, 0.6);
    this.add.text(width / 2, 118, "THE LAST GOOD PLAN", {
      fontFamily: "Georgia, serif",
      fontSize: "42px",
      color: "#f1e7c4",
      align: "center",
    }).setOrigin(0.5);
    this.add.text(width / 2, 176, "A calm spaceship systems roguelike about building for the cycle you expect.", {
      fontFamily: "Verdana, sans-serif",
      fontSize: "18px",
      color: "#b8d6e8",
      align: "center",
      wordWrap: { width: 620 },
    }).setOrigin(0.5);

    const meta = controller.getState().meta;
    this.add.text(width / 2, 258, `Known cycles: ${meta.totalCyclesCompleted}   Perfect commitments: ${meta.totalPerfectCommitments}   Artifacts recovered: ${meta.totalArtifactsRecovered}`, {
      fontFamily: "Verdana, sans-serif",
      fontSize: "18px",
      color: "#d9efef",
      align: "center",
    }).setOrigin(0.5);

    this.add.text(width / 2, 340, "Plan in the sidebar, click ship slots to place or select modules, merge adjacent systems into bots, then let the cycle run.", {
      fontFamily: "Verdana, sans-serif",
      fontSize: "20px",
      color: "#d9efef",
      align: "center",
      wordWrap: { width: 690 },
    }).setOrigin(0.5);

    const button = this.add.rectangle(width / 2, 470, 260, 64, 0x285f7c, 1).setStrokeStyle(2, 0xbde4f2, 0.8).setInteractive({ useHandCursor: true });
    this.add.text(width / 2, 470, "Start New Run", {
      fontFamily: "Verdana, sans-serif",
      fontSize: "24px",
      color: "#f8f4e3",
    }).setOrigin(0.5);
    this.add.text(width / 2, 544, "Controls: Click slots and panels, `Space` pauses instantly, doctrine changes are optional but reduce commitment.", {
      fontFamily: "Verdana, sans-serif",
      fontSize: "16px",
      color: "#9fc6d8",
      align: "center",
      wordWrap: { width: 680 },
    }).setOrigin(0.5);

    const startRun = () => {
      controller.dispatch({ type: "start_new_run" });
      this.scene.start("run");
    };

    button.on("pointerdown", startRun);
    this.input.keyboard?.on("keydown-ENTER", startRun);
  }
}
