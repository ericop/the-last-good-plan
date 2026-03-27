import { MERGE_RECIPES } from "../data/merges";
import type { DiscoveryEntry, DiscoveryLog, MergeRecipe } from "../types/gameTypes";
import { findRecipeByModules } from "./utils";

export function createDefaultDiscoveryLog(): DiscoveryLog {
  return Object.fromEntries(
    MERGE_RECIPES.map((recipe) => [
      recipe.id,
      {
        recipeId: recipe.id,
        state: "unknown",
        uses: 0,
        successes: 0,
      } satisfies DiscoveryEntry,
    ]),
  );
}

export function noteRecipeUse(discovery: DiscoveryLog, recipeId: string): DiscoveryEntry {
  const entry = discovery[recipeId];
  entry.uses += 1;
  if (entry.state === "unknown") {
    entry.state = "discovered";
  }
  return entry;
}

export function noteRecipeSuccess(discovery: DiscoveryLog, recipeId: string): DiscoveryEntry {
  const entry = discovery[recipeId];
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

export function getMergePreviewFromModules(
  modules: [MergeRecipe["modules"][0], MergeRecipe["modules"][1]],
  discovery: DiscoveryLog,
): { recipe?: MergeRecipe; text: string } {
  const recipe = findRecipeByModules(modules);
  if (!recipe) {
    return {
      text: "No stable chassis pattern. This pair does not produce a viable autonomous bot.",
    };
  }
  const entry = discovery[recipe.id];
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
