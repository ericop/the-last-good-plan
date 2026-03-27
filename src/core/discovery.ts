import { MERGE_RECIPES } from "../data/merges";
import type { DiscoveryEntry, DiscoveryLog, MergeRecipe, ModuleId } from "../types/gameTypes";
import { findRecipeByModules } from "./utils";

function createEntry(recipeId: string): DiscoveryEntry {
  return {
    recipeId,
    state: "unknown",
    uses: 0,
    successes: 0,
  };
}

function ensureEntry(discovery: DiscoveryLog, recipeId: string): DiscoveryEntry {
  if (!discovery[recipeId]) {
    discovery[recipeId] = createEntry(recipeId);
  }
  return discovery[recipeId];
}

export function createDefaultDiscoveryLog(): DiscoveryLog {
  return Object.fromEntries(
    MERGE_RECIPES.map((recipe) => [recipe.id, createEntry(recipe.id)]),
  );
}

export function noteRecipeUse(discovery: DiscoveryLog, recipeId: string): DiscoveryEntry {
  const entry = ensureEntry(discovery, recipeId);
  entry.uses += 1;
  if (entry.state === "unknown") {
    entry.state = "discovered";
  }
  return entry;
}

export function noteRecipeSuccess(discovery: DiscoveryLog, recipeId: string): DiscoveryEntry {
  const entry = ensureEntry(discovery, recipeId);
  entry.successes += 1;
  if (entry.state !== "known_mastered_lite" && (entry.uses >= 2 || entry.successes >= 1)) {
    entry.state = "known_mastered_lite";
  }
  return entry;
}

export function getDiscoveryDescriptor(entry: DiscoveryEntry, recipe: MergeRecipe): string {
  if (entry.state === "unknown") {
    return recipe.hint;
  }
  if (entry.state === "discovered") {
    return recipe.summary;
  }
  return `${recipe.summary} ${recipe.masteryNote}`;
}

interface MergePreviewResult {
  recipe?: MergeRecipe;
  text: string;
  invalidReason?: "needs_variety";
}

function getInvalidMergeText(modules: readonly ModuleId[]): string {
  if (modules.length < 2) {
    return "Select at least two placed modules to preview a merge.";
  }
  if (modules.length > 3) {
    return "Only 2-module and 3-module merges are supported.";
  }
  if (modules.length === 2 && modules[0] === modules[1]) {
    return "A bot needs 2+ module types. This pair is too repetitive to stabilize.";
  }
  if (modules.length === 3 && modules[0] === modules[1] && modules[1] === modules[2]) {
    return "A bot needs 2+ module types. Three identical modules collapse into a dead chassis.";
  }
  return "No stable chassis pattern. This cluster does not produce a viable autonomous bot.";
}

export function getMergePreviewFromModules(
  modules: readonly ModuleId[],
  discovery: DiscoveryLog,
): MergePreviewResult {
  const recipe = findRecipeByModules(modules);
  if (!recipe) {
    const sameTypeSelection = modules.length >= 2 && new Set(modules).size === 1;
    return {
      text: getInvalidMergeText(modules),
      invalidReason: sameTypeSelection ? "needs_variety" : undefined,
    };
  }
  const entry = ensureEntry(discovery, recipe.id);
  if (entry.state === "unknown") {
    return {
      recipe,
      text: recipe.hint,
    };
  }
  if (entry.state === "discovered") {
    return {
      recipe,
      text: `${recipe.resultName}: ${recipe.summary}`,
    };
  }
  return {
    recipe,
    text: `${recipe.resultName}: ${recipe.summary} ${recipe.masteryNote}`,
  };
}


