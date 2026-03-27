import type {
  ArtifactDefinition,
  BotInstance,
  DiscoveryLog,
  MergeRecipe,
  ModuleId,
  ResourcePool,
  RunState,
  ShipSlot,
} from "../types/gameTypes";
import { ARTIFACT_DEFINITIONS } from "../data/artifacts";
import { MERGE_RECIPES } from "../data/merges";

export function createEmptyPool(): ResourcePool {
  return { solar: 0, minerals: 0, scrap: 0 };
}

export function clonePool(pool: ResourcePool): ResourcePool {
  return { ...pool };
}

export function addToPool(target: ResourcePool, source: Partial<ResourcePool>): void {
  target.solar += source.solar ?? 0;
  target.minerals += source.minerals ?? 0;
  target.scrap += source.scrap ?? 0;
}

export function subtractFromPool(target: ResourcePool, source: Partial<ResourcePool>): void {
  target.solar -= source.solar ?? 0;
  target.minerals -= source.minerals ?? 0;
  target.scrap -= source.scrap ?? 0;
}

export function canAfford(pool: ResourcePool, cost: Partial<ResourcePool>): boolean {
  return (
    pool.solar >= (cost.solar ?? 0) &&
    pool.minerals >= (cost.minerals ?? 0) &&
    pool.scrap >= (cost.scrap ?? 0)
  );
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function moveToward(
  position: { x: number; y: number },
  target: { x: number; y: number },
  speed: number,
  dt: number,
): void {
  const dx = target.x - position.x;
  const dy = target.y - position.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0.001) {
    return;
  }
  const travel = Math.min(length, speed * dt);
  position.x += (dx / length) * travel;
  position.y += (dy / length) * travel;
}

export function makeBotId(): string {
  return `bot_${Math.random().toString(36).slice(2, 10)}`;
}

export function makeEnemyId(): string {
  return `enemy_${Math.random().toString(36).slice(2, 10)}`;
}

export function addMessage(state: RunState, message: string): void {
  state.simulation.messageLog.unshift(message);
  state.simulation.messageLog = state.simulation.messageLog.slice(0, 8);
}

export function getMergeKey(modules: readonly ModuleId[]): string {
  return [...modules].sort().join("|");
}

export function findRecipeByModules(modules: readonly ModuleId[]): MergeRecipe | undefined {
  if (modules.length < 2 || modules.length > 3) {
    return undefined;
  }
  const key = getMergeKey(modules);
  return MERGE_RECIPES.find((recipe) => getMergeKey(recipe.modules) === key);
}

export function getRecipeById(recipeId: string): MergeRecipe | undefined {
  return MERGE_RECIPES.find((recipe) => recipe.id === recipeId);
}

export function pickRewardChoices(state: RunState): ArtifactDefinition[] {
  const pool = ARTIFACT_DEFINITIONS.filter((artifact) => !state.ship.artifacts.includes(artifact.id));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(3, shuffled.length));
}

export function getArtifactById(artifactId: string): ArtifactDefinition | undefined {
  return ARTIFACT_DEFINITIONS.find((artifact) => artifact.id === artifactId);
}

export function countAdjacentWithModule(
  slots: ShipSlot[],
  slot: ShipSlot,
  moduleId: ModuleId,
): number {
  return slot.neighbors.filter((neighborId) => {
    const neighbor = slots.find((candidate) => candidate.id === neighborId);
    return neighbor?.moduleId === moduleId;
  }).length;
}

export function getBotCapacity(state: RunState): number {
  const supportBay = state.ship.upgrades.support_bay;
  const artifactBonus = state.ship.artifacts
    .map((artifactId) => getArtifactById(artifactId))
    .reduce((sum, artifact) => sum + (artifact?.effect.supportBayBonus ?? 0), 0);
  return state.ship.botCapacityBase + supportBay + artifactBonus;
}

export function getRecipeTagMultiplier(state: RunState, bot: BotInstance): number {
  return state.ship.artifacts
    .map((artifactId) => getArtifactById(artifactId))
    .reduce((multiplier, artifact) => {
      if (!artifact?.effect.recipeTag || !artifact.effect.recipeMultiplier) {
        return multiplier;
      }
      return bot.tags.includes(artifact.effect.recipeTag)
        ? multiplier * artifact.effect.recipeMultiplier
        : multiplier;
    }, 1);
}

export function getDoctrineArtifactBonus(state: RunState): number {
  return state.ship.artifacts
    .map((artifactId) => getArtifactById(artifactId))
    .reduce((sum, artifact) => {
      if (artifact?.effect.doctrineId === state.doctrine) {
        return sum + (artifact.effect.doctrineEfficiencyBonus ?? 0);
      }
      return sum;
    }, 0);
}

export function getGlobalArtifactMultiplier(state: RunState, key: keyof ArtifactDefinition["effect"]): number {
  return state.ship.artifacts
    .map((artifactId) => getArtifactById(artifactId))
    .reduce((multiplier, artifact) => {
      const value = artifact?.effect[key];
      return typeof value === "number" ? multiplier * value : multiplier;
    }, 1);
}

export function roundPool(pool: ResourcePool): ResourcePool {
  return {
    solar: Math.round(pool.solar),
    minerals: Math.round(pool.minerals),
    scrap: Math.round(pool.scrap),
  };
}

export function getSlotById(slots: ShipSlot[], slotId: string): ShipSlot | undefined {
  return slots.find((slot) => slot.id === slotId);
}

export function isAdjacent(slots: ShipSlot[], slotAId: string, slotBId: string): boolean {
  const slot = getSlotById(slots, slotAId);
  return Boolean(slot?.neighbors.includes(slotBId));
}

export function areSlotsConnected(slots: ShipSlot[], slotIds: readonly string[]): boolean {
  if (slotIds.length < 2) {
    return false;
  }

  const selected = new Set(slotIds);
  const visited = new Set<string>();
  const queue = [slotIds[0]];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);

    const current = getSlotById(slots, currentId);
    current?.neighbors.forEach((neighborId) => {
      if (selected.has(neighborId) && !visited.has(neighborId)) {
        queue.push(neighborId);
      }
    });
  }

  return visited.size === selected.size;
}
