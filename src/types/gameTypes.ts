export type ResourceId = "solar" | "minerals" | "scrap";
export type DoctrineId = "balanced" | "extraction_focus" | "preservation_mode";
export type ModuleId =
  | "solar_collector"
  | "mineral_drill"
  | "shield_emitter"
  | "pulse_cannon"
  | "cargo_core"
  | "repair_node";
export type EpicModuleId = "dawn_prism" | "war_forge" | "sainted_patch";
export type FabricationOptionId = ModuleId | EpicModuleId;
export type UpgradeId = "mining_array" | "defense_grid" | "support_bay";
export type Phase = "menu" | "planning" | "execution" | "results" | "run_over";
export type DiscoveryState = "unknown" | "discovered" | "known_mastered_lite";
export type BotRole = "mining" | "defense" | "support" | "hybrid";
export type ArtifactType = "passive" | "doctrine" | "merge_support";
export type RewardSource = "moon" | "boss_chest" | "boss";
export type EnemyKind = "scavenger" | "mini_boss" | "boss";
export type DockPanelId = "ship" | "build" | "bots" | "doctrine" | "log";
export type BossBehavior =
  | { kind: "periodic_shield"; interval: number; amount: number }
  | { kind: "spawning_minions"; interval: number; count: number }
  | { kind: "charging_attack"; interval: number; chargeTime: number; damage: number }
  | { kind: "directional_sweep"; interval: number; damage: number; width: number };
export type BossModifier =
  | { kind: "reduces_projectile_damage"; multiplier: number }
  | { kind: "reflects_damage"; ratio: number }
  | { kind: "disables_module_type"; moduleId: ModuleId; interval: number; duration: number };
export type TutorialStepId =
  | "intro"
  | "place_solar_collector"
  | "place_mineral_drill"
  | "place_third_module"
  | "merge_bot"
  | "bots_explain"
  | "select_doctrine"
  | "start_mission"
  | "mission_running"
  | "mission_results";

export interface ResourcePool {
  solar: number;
  minerals: number;
  scrap: number;
}

export interface Cost extends ResourcePool {}

export interface ModuleDefinition {
  id: ModuleId;
  name: string;
  shortName: string;
  description: string;
  color: number;
  icon: string;
  fabricationCost: Cost;
}

export interface DoctrineDefinition {
  id: DoctrineId;
  name: string;
  summary: string;
  weights: {
    mining: number;
    attack: number;
    support: number;
    defense: number;
  };
}

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  summary: string;
  perLevelText: string;
  costs: Cost[];
}

export interface ArtifactDefinition {
  id: string;
  name: string;
  summary: string;
  type: ArtifactType;
  effect: {
    miningMultiplier?: number;
    attackMultiplier?: number;
    supportMultiplier?: number;
    defenseMultiplier?: number;
    salvageMultiplier?: number;
    solarModuleMultiplier?: number;
    supportBayBonus?: number;
    doctrineId?: DoctrineId;
    doctrineEfficiencyBonus?: number;
    recipeTag?: string;
    recipeMultiplier?: number;
  };
}

export interface EpicModuleDefinition {
  id: EpicModuleId;
  baseModuleId: ModuleId;
  name: string;
  shortName: string;
  description: string;
  rarity: "epic";
  color: number;
  previewText: string;
  mergeNote: string;
  applyToBot: (bot: BotInstance) => void;
}

export interface BossDefinition {
  id: string;
  name: string;
  color: number;
  maxHp: number;
  shield: number;
  speed: number;
  attack: number;
  range: number;
  behaviors: BossBehavior[];
  modifiers: BossModifier[];
  reward: EpicModuleId;
}

export interface BotStatsTemplate {
  hp: number;
  speed: number;
  mining: number;
  attack: number;
  support: number;
  range: number;
  salvage: number;
}

export type MergeModules = [ModuleId, ModuleId] | [ModuleId, ModuleId, ModuleId];

export interface MergeRecipe {
  id: string;
  modules: MergeModules;
  resultName: string;
  role: BotRole;
  hint: string;
  summary: string;
  masteryNote: string;
  color: number;
  tags: string[];
  stats: BotStatsTemplate;
}

export interface ShipSlot {
  id: string;
  label: string;
  gridX: number;
  gridY: number;
  x: number;
  y: number;
  neighbors: string[];
  moduleId?: ModuleId;
  epicModuleId?: EpicModuleId;
}

export interface BotInstance {
  id: string;
  recipeId: string;
  name: string;
  role: BotRole;
  color: number;
  tags: string[];
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  speed: number;
  mining: number;
  attack: number;
  support: number;
  range: number;
  salvage: number;
  epicModules: EpicModuleId[];
  cooldown: number;
  contribution: {
    mined: number;
    damage: number;
    healing: number;
    salvage: number;
  };
}

export interface EnemyDefinition {
  kind: EnemyKind;
  name: string;
  color: number;
  hp: number;
  speed: number;
  attack: number;
  range: number;
  scrapReward: number;
}

export interface EnemyInstance {
  id: string;
  kind: EnemyKind;
  name: string;
  color: number;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  speed: number;
  attack: number;
  range: number;
  scrapReward: number;
  cooldown: number;
  bossId?: string;
  bossShield?: number;
  maxBossShield?: number;
  bossBehaviorTimers?: Record<string, number>;
}

export interface ThreatWave {
  time: number;
  label: string;
  kind: EnemyKind;
  count: number;
  bossId?: string;
}

export interface ObjectiveState {
  integrity: number;
  maxIntegrity: number;
  rewardClaimed: boolean;
}

export interface DiscoveryEntry {
  recipeId: string;
  state: DiscoveryState;
  uses: number;
  successes: number;
}

export interface DiscoveryLog {
  [recipeId: string]: DiscoveryEntry;
}

export interface MetaProgress {
  totalCyclesCompleted: number;
  totalPerfectCommitments: number;
  totalArtifactsRecovered: number;
}

export interface OnboardingProgress {
  tutorialCompleted: boolean;
}

export type RewardChoice =
  | { kind: "artifact"; id: string }
  | { kind: "epic_module"; id: EpicModuleId };

export interface RewardOffer {
  source: RewardSource;
  title: string;
  description: string;
  choices: RewardChoice[];
}

export interface CycleSummary {
  title: string;
  text: string;
  gains: ResourcePool;
  losses: {
    botsDestroyed: number;
    hullDamage: number;
  };
  discoveries: string[];
  rewards: string[];
  perfectCommitmentReward: ResourcePool;
}

export interface TutorialState {
  active: boolean;
  firstRun: boolean;
  stepId: TutorialStepId;
}

export interface UiState {
  selectedFabricationModuleId?: FabricationOptionId;
  selectedSlotIds: string[];
  showDiscoveryLog: boolean;
  activeDockPanel: DockPanelId;
}

export interface MissionPrepState {
  modulesPlacedThisMission: number;
}

export interface CycleStats {
  gained: ResourcePool;
  lost: {
    botsDestroyed: number;
    hullDamage: number;
  };
  rewardsEarned: string[];
  discoveries: string[];
}

export interface SimulationState {
  elapsed: number;
  duration: number;
  upcomingThreats: ThreatWave[];
  threatCursor: number;
  enemies: EnemyInstance[];
  objective: ObjectiveState;
  bossDefeated: boolean;
  moonRewardTriggered: boolean;
  perfectCommitmentRewardGranted: boolean;
  bossEncounter: {
    activeBossId?: string;
    activeBossName?: string;
    rewardEpicId?: EpicModuleId;
    introTimer: number;
    telegraph?: string;
    telegraphTimer: number;
    disabledModuleId?: ModuleId;
    disabledModuleTimer: number;
  };
  messageLog: string[];
  cycleStats: CycleStats;
}

export interface ShipState {
  slots: ShipSlot[];
  bots: BotInstance[];
  hull: number;
  maxHull: number;
  shield: number;
  maxShield: number;
  upgrades: Record<UpgradeId, number>;
  artifacts: string[];
  epicInventory: Record<EpicModuleId, number>;
  botCapacityBase: number;
}

export interface RunState {
  phase: Phase;
  cycle: number;
  paused: boolean;
  executionSpeed: 1 | 2;
  doctrine: DoctrineId;
  commitmentBonus: number;
  doctrineChangesThisCycle: number;
  resources: ResourcePool;
  ship: ShipState;
  simulation: SimulationState;
  summary?: CycleSummary;
  pendingReward?: RewardOffer;
  ui: UiState;
  discovery: DiscoveryLog;
  meta: MetaProgress;
  onboarding: OnboardingProgress;
  tutorial: TutorialState;
  missionPrep: MissionPrepState;
}

export interface SaveData {
  discovery: DiscoveryLog;
  meta: MetaProgress;
  onboarding: OnboardingProgress;
}