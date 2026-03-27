import type { ArtifactDefinition, DockPanelId, DoctrineId, ModuleId, UpgradeId } from "./gameTypes";

export type GameCommand =
  | { type: "start_new_run" }
  | { type: "toggle_pause" }
  | { type: "toggle_execution_speed" }
  | { type: "set_doctrine"; doctrineId: DoctrineId }
  | { type: "select_fabrication_module"; moduleId?: ModuleId }
  | { type: "board_slot_pressed"; slotId: string }
  | { type: "merge_selected" }
  | { type: "spend_upgrade"; upgradeId: UpgradeId }
  | { type: "begin_execution" }
  | { type: "continue_from_results" }
  | { type: "toggle_discovery_log" }
  | { type: "set_dock_panel"; panelId: DockPanelId }
  | { type: "advance_tutorial" }
  | { type: "skip_tutorial" }
  | { type: "replay_tutorial" }
  | { type: "choose_reward"; artifactId: ArtifactDefinition["id"] }
  | { type: "return_to_menu" };
