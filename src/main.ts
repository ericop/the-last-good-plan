import "./style.css";
import { GameController } from "./core/gameController";
import { createGame } from "./game/createGame";
import { loadSaveData } from "./save/localStorageSave";
import { UIManager } from "./ui/uiManager";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) {
  throw new Error("App root not found.");
}

const controller = new GameController(loadSaveData());
new UIManager(root, controller);
createGame(controller);
