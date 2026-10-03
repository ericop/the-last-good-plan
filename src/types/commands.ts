import type { DockPanelId, DoctrineId, FabricationOptionId, UpgradeId } from "./gameTypes";

export type GameCommand =
  | { type: "start_new_run" }
  | { type: "toggle_pause" }
  | { type: "toggle_execution_speed" }
  | { type: "set_doctrine"; doctrineId: DoctrineId }
  | { type: "select_fabrication_module"; moduleId?: FabricationOptionId }
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
  | { type: "choose_reward"; rewardKind: "artifact" | "epic_module"; rewardId: string }
  | { type: "choose_node"; nodeId: string }
  | { type: "start_campaign"; fresh: boolean }
  | { type: "start_roguelike"; seed?: string }
  | { type: "retry_level" }
  | { type: "return_to_menu" }
  | { type: "advance_dialog" }
  | { type: "choose_dialog"; optionIndex: number }
  | { type: "open_chest" };