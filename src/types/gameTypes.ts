export type ResourceId = "solar" | "minerals" | "scrap";
export type DoctrineId = "balanced" | "extraction_focus" | "preservation_mode";
export type ModuleId =
  | "solar_collector"
  | "mineral_drill"
  | "shield_emitter"
  | "pulse_cannon"
  | "cargo_core"
  | "repair_node"
  | "booster"
  | "launch_port";
export type MergeableModuleId = Exclude<ModuleId, "launch_port">;
export type EpicModuleId = "dawn_prism" | "war_forge" | "sainted_patch";
export type FabricationOptionId = ModuleId | EpicModuleId;
export type UpgradeId = "mining_array" | "defense_grid" | "support_bay" | "hangar_tech";
export type Phase = "menu" | "planning" | "execution" | "results" | "run_over";
export type DiscoveryState = "unknown" | "discovered" | "known_mastered_lite";
export type BotRole = "mining" | "defense" | "support" | "hybrid";
export type ArtifactType = "passive" | "doctrine" | "merge_support";
export type RewardSource = "moon" | "boss_chest" | "boss";
export type EnemyKind = "scavenger" | "dart" | "brute" | "mini_boss" | "warship" | "boss";
export type EncounterKind = "swarm" | "duel" | "boss";
export type RouteId = "swarm" | "duel" | "boss" | "nebula" | "derelict";
export type FighterKind = "interceptor" | "skiff" | "tender";
export type ProjectileKind = "bolt" | "laser" | "missile";

export interface EvadeOrder {
  x: number;
  y: number;
  timer: number;
}
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

export interface ShipWeaponDefinition {
  name: string;
  kind: "laser" | "missile" | "beam";
  chargeTime: number;
  shots: number;
  damage: number;
  warning?: number;
  width?: number;
}

export interface WarshipDefinition {
  id: string;
  name: string;
  color: number;
  hull: number;
  shield: number;
  shieldRegen: number;
  pointDefense: number;
  pointDefenseRange: number;
  weapons: ShipWeaponDefinition[];
  launch?: { interval: number; count: number };
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
  weapons: ShipWeaponDefinition[];
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

export type MergeModules = [MergeableModuleId, MergeableModuleId] | [MergeableModuleId, MergeableModuleId, MergeableModuleId];

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
  targetId?: string;
  evade?: EvadeOrder;
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
  shield?: number;
  maxShield?: number;
  shieldRegen?: number;
  holdX?: number;
  spawnedAt?: number;
  weapons?: ShipWeaponState[];
  launch?: { interval: number; count: number; timer: number };
  knockback?: { vx: number; vy: number; timer: number };
  bossId?: string;
  warshipId?: string;
  bossBehaviorTimers?: Record<string, number>;
}

export interface ShipWeaponState extends ShipWeaponDefinition {
  charge: number;
}

export interface ThreatWave {
  time: number;
  label: string;
  kind: EnemyKind;
  count: number;
  spacing?: number;
  announce?: string;
  bossId?: string;
  warshipId?: string;
}

export interface SectorNode {
  id: string;
  column: number;
  row: number;
  rows: number;
  cycle: number;
  route: RouteId;
  next: string[];
  title?: string;
}

export type GameMode = "campaign" | "roguelike";
export type SpeakerId =
  | "you"
  | "pip"
  | "rook"
  | "mars"
  | "ship"
  | "governor"
  | "interim"
  | "corsair"
  | "patrol"
  | "warden"
  | "glimmerfolk"
  | "aunties"
  | "tide"
  | "choir";

export interface DialogLine {
  speaker: SpeakerId;
  text: string;
}

export interface DialogOption {
  label: string;
  tag: string;
  reply: DialogLine[];
}

export interface DialogScene {
  lines: DialogLine[];
  choice?: { options: DialogOption[] };
  after?: DialogLine[];
}

export interface ActiveDialog {
  lines: DialogLine[];
  index: number;
  options?: DialogOption[];
  after: DialogLine[];
}

export interface StoryState {
  dialog?: ActiveDialog;
  choiceTag?: string;
  introSeen: number[];
}

export interface CampaignProgress {
  highestLevelCleared: number;
  roguelikeUnlocked: boolean;
  checkpoint?: string;
}

export interface TimedStoryEvent {
  id: string;
  at?: number;
  afterRescue?: boolean;
  lines?: DialogLine[];
  byTag?: Record<string, DialogLine[]>;
}

export interface CommMessage {
  line: DialogLine;
  timer: number;
}

export interface RescueState {
  species: SpeakerId;
  age: number;
}

export interface SectorMap {
  index: number;
  seed: number;
  columns: SectorNode[][];
  path: string[];
  selectedNodeId: string;
}

export interface Callout {
  text: string;
  x: number;
  y: number;
  age: number;
  color: number;
}

export interface KillfeedEntry {
  killer: string;
  victim: string;
  color: number;
  time: number;
}

export interface StarResult {
  label: string;
  earned: boolean;
}

export interface MvpSummary {
  name: string;
  role: BotRole;
  color: number;
  damage: number;
  mined: number;
  healing: number;
  dodges: number;
}

export interface PendingSpawn {
  time: number;
  kind: EnemyKind;
  lane: number;
}

export interface Projectile {
  id: string;
  owner: "player" | "enemy";
  kind: ProjectileKind;
  x: number;
  y: number;
  targetId?: string;
  targetX: number;
  targetY: number;
  speed: number;
  damage: number;
  color: number;
}

export interface FighterInstance {
  id: string;
  portSlotId: string;
  kind: FighterKind;
  color: number;
  x: number;
  y: number;
  heading: number;
  orbit: number;
  hp: number;
  maxHp: number;
  speed: number;
  attack: number;
  range: number;
  mining: number;
  support: number;
  dodge: number;
  launchBoost: number;
  targetId?: string;
  evade?: EvadeOrder;
  hero?: { name: string; shipName: string; speaker: SpeakerId };
}

export interface BarrageState {
  id: string;
  sourceId: string;
  name: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  width: number;
  damage: number;
  warning: number;
  timer: number;
  firedAge?: number;
  noticed: string[];
  evaders: string[];
  doom?: boolean;
}

export interface ImpactEffect {
  x: number;
  y: number;
  age: number;
  size: number;
  color: number;
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
  totalStars?: number;
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
  stars: StarResult[];
  mvp?: MvpSummary;
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
  route: RouteId;
  encounter: EncounterKind;
  encounterName: string;
  lanes: number[];
  launchCountdown: number;
  shieldsOffline: boolean;
  scrapMultiplier: number;
  chests: RewardOffer[];
  callouts: Callout[];
  killfeed: KillfeedEntry[];
  announcement?: { text: string; timer: number };
  dodgesByUnit: Record<string, number>;
  fallenBots: BotInstance[];
  storyFired: string[];
  storyEvents: TimedStoryEvent[];
  commQueue: DialogLine[];
  activeComm?: CommMessage;
  heroLost: boolean;
  rescueArmed?: {
    species: SpeakerId;
    hullTrigger: number;
    minTime: number;
    fallbackTime?: number;
    doomTime?: number;
    doomName?: string;
  };
  rescue?: RescueState;
  startingHull: number;
  upcomingThreats: ThreatWave[];
  threatCursor: number;
  pendingSpawns: PendingSpawn[];
  enemies: EnemyInstance[];
  projectiles: Projectile[];
  barrages: BarrageState[];
  fighters: FighterInstance[];
  impacts: ImpactEffect[];
  moduleTimers: Record<string, number>;
  warshipDefeated: boolean;
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
  sector: SectorMap;
  mode: GameMode;
  story: StoryState;
  campaign: CampaignProgress;
}

export interface SaveData {
  discovery: DiscoveryLog;
  meta: MetaProgress;
  onboarding: OnboardingProgress;
  campaign?: CampaignProgress;
}