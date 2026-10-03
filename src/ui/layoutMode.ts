export type LayoutMode = "pocket" | "compact" | "arena";

export const POCKET_MAX_WIDTH = 700;
export const ARENA_MIN_WIDTH = 1180;

export function getLayoutMode(width = window.innerWidth, height = window.innerHeight): LayoutMode {
  if (width < POCKET_MAX_WIDTH && height > width) {
    return "pocket";
  }
  return width >= ARENA_MIN_WIDTH ? "arena" : "compact";
}
