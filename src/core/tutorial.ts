import type { GameCommand } from "../types/commands";
import type {
  DoctrineId,
  ModuleId,
  Phase,
  RunState,
  SaveData,
  TutorialState,
  TutorialStepId,
} from "../types/gameTypes";

export interface TutorialStepView {
  title: string;
  body: string;
  targetSelectors: string[];
  continueLabel?: string;
  requiresContinue?: boolean;
}

interface TutorialSnapshot {
  doctrine: DoctrineId;
  phase: Phase;
  stepId: TutorialStepId;
  botCount: number;
  totalModules: number;
  moduleCounts: Record<ModuleId, number>;
}

const TUTORIAL_STEP_VIEWS: Record<TutorialStepId, TutorialStepView> = {
  intro: {
    title: "Build a calm plan",
    body: "Build a ship. Make bots. Watch it run.",
    targetSelectors: ["[data-tutorial-target='ship-board']", "[data-tutorial-target='module-panel']"],
    continueLabel: "Show Me",
    requiresContinue: true,
  },
  place_solar_collector: {
    title: "Step 1: Solar",
    body: "Tap Solar, then tap a ship slot.",
    targetSelectors: ["[data-tutorial-target='module-solar_collector']", "[data-tutorial-target='ship-board']"],
  },
  place_mineral_drill: {
    title: "Step 2: Drill",
    body: "Tap Drill, then a slot beside Solar.",
    targetSelectors: ["[data-tutorial-target='module-mineral_drill']", "[data-tutorial-target='ship-board']"],
  },
  place_third_module: {
    title: "Step 3: One more",
    body: "Add a Shield or Cargo module.",
    targetSelectors: [
      "[data-tutorial-target='module-shield_emitter']",
      "[data-tutorial-target='module-cargo_core']",
      "[data-tutorial-target='ship-board']",
    ],
  },
  merge_bot: {
    title: "Step 4: Make a bot",
    body: "Tap Solar and Drill, then Create Bot.",
    targetSelectors: ["[data-tutorial-target='ship-board']", "[data-tutorial-target='merge-panel']"],
  },
  bots_explain: {
    title: "Bots run themselves",
    body: "They mine and fight on their own.",
    targetSelectors: ["[data-tutorial-target='ship-board']"],
    continueLabel: "Got It",
    requiresContinue: true,
  },
  select_doctrine: {
    title: "Step 5: Doctrine",
    body: "Tap Balanced for your first mission.",
    targetSelectors: ["[data-tutorial-target='doctrine-panel']"],
  },
  start_mission: {
    title: "Step 6: Launch",
    body: "Tap Launch. The ship does the rest.",
    targetSelectors: ["[data-tutorial-target='start-mission']"],
  },
  mission_running: {
    title: "Mission running",
    body: "Sit back. Pause anytime from the header.",
    targetSelectors: ["[data-tutorial-target='ship-board']"],
    continueLabel: "Keep Watching",
    requiresContinue: true,
  },
  mission_results: {
    title: "Debrief",
    body: "Stars, chests, and your best bot.",
    targetSelectors: ["[data-tutorial-target='summary-modal']"],
    continueLabel: "Finish Tutorial",
    requiresContinue: true,
  },
};

export function getTutorialHandTarget(state: RunState): string | undefined {
  if (!state.tutorial.active || state.phase !== "planning") {
    return undefined;
  }
  const selected = state.ui.selectedFabricationModuleId;
  switch (state.tutorial.stepId) {
    case "place_solar_collector":
      return selected === "solar_collector" ? undefined : "[data-tutorial-target='module-solar_collector']";
    case "place_mineral_drill":
      return selected === "mineral_drill" ? undefined : "[data-tutorial-target='module-mineral_drill']";
    case "place_third_module":
      return selected === "shield_emitter" || selected === "cargo_core" ? undefined : "[data-tutorial-target='module-shield_emitter']";
    case "merge_bot":
      return state.ui.selectedSlotIds.length >= 2 ? "[data-tutorial-target='merge-panel'] [data-action='merge-selected']" : undefined;
    case "select_doctrine":
      return "[data-doctrine='balanced']";
    case "start_mission":
      return "[data-tutorial-target='start-mission']";
    default:
      return undefined;
  }
}

function countModules(state: RunState, moduleId: ModuleId): number {
  return state.ship.slots.filter((slot) => slot.moduleId === moduleId).length;
}

function countAllModules(state: RunState): number {
  return state.ship.slots.filter((slot) => Boolean(slot.moduleId)).length;
}

export function shouldAutoStartTutorial(saveData: SaveData, forceTutorial = false): boolean {
  return forceTutorial || !saveData.onboarding.tutorialCompleted;
}

export function createTutorialState(saveData: SaveData, forceTutorial = false): TutorialState {
  const active = shouldAutoStartTutorial(saveData, forceTutorial);
  return {
    active,
    firstRun: active && !saveData.onboarding.tutorialCompleted && !forceTutorial,
    stepId: "intro",
  };
}

export function captureTutorialSnapshot(state: RunState): TutorialSnapshot {
  return {
    doctrine: state.doctrine,
    phase: state.phase,
    stepId: state.tutorial.stepId,
    botCount: state.ship.bots.length,
    totalModules: countAllModules(state),
    moduleCounts: {
      solar_collector: countModules(state, "solar_collector"),
      mineral_drill: countModules(state, "mineral_drill"),
      shield_emitter: countModules(state, "shield_emitter"),
      pulse_cannon: countModules(state, "pulse_cannon"),
      cargo_core: countModules(state, "cargo_core"),
      repair_node: countModules(state, "repair_node"),
      booster: countModules(state, "booster"),
      launch_port: countModules(state, "launch_port"),
    },
  };
}

function setTutorialStep(state: RunState, stepId: TutorialStepId): void {
  state.tutorial.stepId = stepId;
}

function completeTutorial(state: RunState): void {
  state.tutorial.active = false;
  state.onboarding.tutorialCompleted = true;
}

export function skipTutorial(state: RunState): void {
  completeTutorial(state);
}

export function getPhaseLabel(phase: Phase): string {
  switch (phase) {
    case "planning":
      return "Planning";
    case "execution":
      return "Mission Running";
    case "results":
    case "run_over":
      return "Mission Debrief";
    default:
      return "Menu";
  }
}

export function getMissionReadiness(state: RunState): { ready: boolean; reason: string } {
  const hasBot = state.ship.bots.length >= 1;
  const hasSystems = state.ship.slots.some((slot) => Boolean(slot.moduleId)) || hasBot;
  const onboardingMission = state.tutorial.active || (state.meta.totalCyclesCompleted === 0 && state.cycle === 1);

  if (onboardingMission) {
    const ready = state.missionPrep.modulesPlacedThisMission >= 3 && hasBot;
    return {
      ready,
      reason: ready ? "Ready to run." : "Place 3 modules and create 1 bot",
    };
  }

  return {
    ready: hasSystems,
    reason: hasSystems ? "Ready to run." : "Place 3 modules and create 1 bot",
  };
}

export function getTutorialStepView(state: RunState): TutorialStepView | undefined {
  if (!state.tutorial.active || state.story.dialog) {
    return undefined;
  }
  if (state.tutorial.stepId === "mission_results" && state.phase !== "results" && state.phase !== "run_over") {
    return undefined;
  }
  if (state.pendingReward && state.tutorial.stepId === "mission_running") {
    return undefined;
  }
  return TUTORIAL_STEP_VIEWS[state.tutorial.stepId];
}

export function isTutorialCommandAllowed(state: RunState, command: GameCommand): boolean {
  const alwaysAllowed: GameCommand["type"][] = [
    "start_new_run",
    "advance_dialog",
    "choose_dialog",
    "retry_level",
    "return_to_menu",
    "start_campaign",
    "start_roguelike",
  ];
  if (!state.tutorial.active || alwaysAllowed.includes(command.type)) {
    return true;
  }

  if (command.type === "set_dock_panel") {
    return ["ship", "build", "bots", "doctrine", "log"].includes(command.panelId);
  }

  switch (state.tutorial.stepId) {
    case "intro":
      return command.type === "advance_tutorial" || command.type === "skip_tutorial";
    case "place_solar_collector":
      return (
        command.type === "skip_tutorial" ||
        (command.type === "select_fabrication_module" && command.moduleId === "solar_collector") ||
        command.type === "board_slot_pressed"
      );
    case "place_mineral_drill":
      return (
        command.type === "skip_tutorial" ||
        (command.type === "select_fabrication_module" && command.moduleId === "mineral_drill") ||
        command.type === "board_slot_pressed"
      );
    case "place_third_module":
      return (
        command.type === "skip_tutorial" ||
        (command.type === "select_fabrication_module" &&
          (command.moduleId === "shield_emitter" || command.moduleId === "cargo_core")) ||
        command.type === "board_slot_pressed"
      );
    case "merge_bot":
      return command.type === "skip_tutorial" || command.type === "board_slot_pressed" || command.type === "merge_selected";
    case "bots_explain":
      return command.type === "advance_tutorial" || command.type === "skip_tutorial";
    case "select_doctrine":
      return command.type === "skip_tutorial" || (command.type === "set_doctrine" && command.doctrineId === "balanced");
    case "start_mission":
      return command.type === "skip_tutorial" || command.type === "begin_execution";
    case "mission_running":
      return (
        command.type === "skip_tutorial" ||
        command.type === "advance_tutorial" ||
        command.type === "toggle_pause" ||
        command.type === "toggle_execution_speed"
      );
    case "mission_results":
      return (
        command.type === "skip_tutorial" ||
        command.type === "advance_tutorial" ||
        command.type === "open_chest" ||
        command.type === "choose_reward"
      );
    default:
      return true;
  }
}

export function updateTutorialAfterCommand(state: RunState, before: TutorialSnapshot, command: GameCommand): void {
  if (!state.tutorial.active) {
    return;
  }

  if (command.type === "skip_tutorial") {
    skipTutorial(state);
    return;
  }

  switch (before.stepId) {
    case "intro":
      if (command.type === "advance_tutorial") {
        setTutorialStep(state, "place_solar_collector");
      }
      break;
    case "place_solar_collector":
      if (state.ship.slots.some((slot) => slot.moduleId === "solar_collector") && before.moduleCounts.solar_collector === 0) {
        setTutorialStep(state, "place_mineral_drill");
      }
      break;
    case "place_mineral_drill":
      if (state.ship.slots.some((slot) => slot.moduleId === "mineral_drill") && before.moduleCounts.mineral_drill === 0) {
        setTutorialStep(state, "place_third_module");
      }
      break;
    case "place_third_module": {
      const placedShield = state.ship.slots.some((slot) => slot.moduleId === "shield_emitter") && before.moduleCounts.shield_emitter === 0;
      const placedCargo = state.ship.slots.some((slot) => slot.moduleId === "cargo_core") && before.moduleCounts.cargo_core === 0;
      if (placedShield || placedCargo) {
        setTutorialStep(state, "merge_bot");
      }
      break;
    }
    case "merge_bot":
      if (state.ship.bots.length > before.botCount) {
        setTutorialStep(state, "bots_explain");
      }
      break;
    case "bots_explain":
      if (command.type === "advance_tutorial") {
        setTutorialStep(state, "select_doctrine");
      }
      break;
    case "select_doctrine":
      if (command.type === "set_doctrine" && command.doctrineId === "balanced") {
        setTutorialStep(state, "start_mission");
      }
      break;
    case "start_mission":
      if (state.phase === "execution") {
        setTutorialStep(state, "mission_running");
      }
      break;
    case "mission_running":
      if (command.type === "advance_tutorial") {
        setTutorialStep(state, "mission_results");
      }
      break;
    case "mission_results":
      if (command.type === "advance_tutorial") {
        completeTutorial(state);
      }
      break;
    default:
      break;
  }
}

export function updateTutorialAfterSimulation(state: RunState, before: TutorialSnapshot): void {
  if (!state.tutorial.active) {
    return;
  }

  if (before.stepId === "start_mission" && state.phase === "execution") {
    setTutorialStep(state, "mission_running");
    return;
  }

  if (
    (before.stepId === "mission_running" || before.stepId === "mission_results") &&
    (state.phase === "results" || state.phase === "run_over")
  ) {
    setTutorialStep(state, "mission_results");
  }
}
