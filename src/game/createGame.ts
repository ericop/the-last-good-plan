import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./constants";
import { BootScene } from "../scenes/BootScene";
import { MainMenuScene } from "../scenes/MainMenuScene";
import { RunScene } from "../scenes/RunScene";
import type { GameController } from "../core/gameController";

export function createGame(controller: GameController): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game-canvas",
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#07131c",
    scene: [BootScene, MainMenuScene, RunScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    callbacks: {
      postBoot: (game) => {
        game.registry.set("controller", controller);
      },
    },
  });
}
