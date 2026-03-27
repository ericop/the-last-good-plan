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

    const { width, height } = this.scale;
    const panelWidth = Math.min(width * 0.74, 720);
    const panelHeight = Math.min(height * 0.76, 500);
    const panelX = width / 2;
    const panelY = height / 2;
    const top = panelY - panelHeight / 2;
    const copyWidth = panelWidth - 104;

    this.cameras.main.setBackgroundColor("#07131c");

    this.add.rectangle(width / 2, height / 2, width, height, 0x061019, 1);
    this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x0d2230, 0.96).setStrokeStyle(2, 0x3a7ca5, 0.62);
    this.add.rectangle(panelX, top + 56, panelWidth - 44, 92, 0x112b3b, 0.72).setStrokeStyle(1, 0x7bc4e2, 0.22);

    this.add
      .text(panelX, top + 52, "THE LAST GOOD PLAN", {
        fontFamily: "Georgia, serif",
        fontSize: "40px",
        color: "#f1e7c4",
        align: "center",
      })
      .setOrigin(0.5, 0);

    this.add
      .text(panelX, top + 112, "Build a ship, combine modules into bots, and let the mission run.", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "19px",
        color: "#bfd8e6",
        align: "center",
        wordWrap: { width: copyWidth },
      })
      .setOrigin(0.5, 0);

    const meta = controller.getState().meta;
    this.add
      .text(
        panelX,
        top + 182,
        `Known cycles: ${meta.totalCyclesCompleted}   Perfect commitments: ${meta.totalPerfectCommitments}   Artifacts recovered: ${meta.totalArtifactsRecovered}`,
        {
          fontFamily: "Trebuchet MS, Verdana, sans-serif",
          fontSize: "17px",
          color: "#d9efef",
          align: "center",
          wordWrap: { width: copyWidth },
        },
      )
      .setOrigin(0.5, 0);

    this.add
      .text(
        panelX,
        top + 246,
        "Place modules. Merge them into bots. Pick a doctrine. Press Start Mission. The ship handles mining and combat on its own.",
        {
          fontFamily: "Trebuchet MS, Verdana, sans-serif",
          fontSize: "20px",
          color: "#d9efef",
          align: "center",
          wordWrap: { width: copyWidth },
        },
      )
      .setOrigin(0.5, 0);

    const buttonY = top + panelHeight - 118;
    const button = this.add
      .rectangle(panelX, buttonY, 268, 64, 0x285f7c, 1)
      .setStrokeStyle(2, 0xbde4f2, 0.82)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(panelX, buttonY, "Start New Run", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "24px",
        color: "#f8f4e3",
      })
      .setOrigin(0.5);

    this.add
      .text(panelX, top + panelHeight - 62, "Controls: Click modules and slots. Space pauses instantly. Doctrine changes are optional.", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "16px",
        color: "#9fc6d8",
        align: "center",
        wordWrap: { width: copyWidth },
      })
      .setOrigin(0.5, 0.5);

    const startRun = () => {
      controller.dispatch({ type: "start_new_run" });
      this.scene.start("run");
    };

    button.on("pointerdown", startRun);
    this.input.keyboard?.on("keydown-ENTER", startRun);
  }
}
