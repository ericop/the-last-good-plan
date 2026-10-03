import { describe, expect, it } from "vitest";
import { generateSectorMap, SECTOR_LENGTH } from "./sectorMap";
import type { SectorMap } from "../types/gameTypes";

function sampleMaps(): SectorMap[] {
  const maps: SectorMap[] = [];
  for (let seed = 1; seed <= 60; seed += 1) {
    for (let index = 0; index < 3; index += 1) {
      maps.push(generateSectorMap(index, seed * 7477, false));
    }
  }
  return maps;
}

describe("sector map generation", () => {
  it("lays out ten jumps that end in a single boss node", () => {
    for (const map of sampleMaps()) {
      expect(map.columns).toHaveLength(SECTOR_LENGTH);
      const last = map.columns[SECTOR_LENGTH - 1];
      expect(last.map((node) => node.route)).toEqual(["boss"]);
      for (const column of map.columns.slice(0, -1)) {
        expect(column.length).toBeGreaterThanOrEqual(2);
        expect(column.length).toBeLessThanOrEqual(3);
        expect(column.some((node) => node.route === "boss")).toBe(false);
      }
    }
  });

  it("connects every node forward and backward so every path reaches the boss", () => {
    for (const map of sampleMaps()) {
      map.columns.forEach((column, index) => {
        for (const node of column) {
          if (index < SECTOR_LENGTH - 1) {
            expect(node.next.length).toBeGreaterThan(0);
            const nextIds = map.columns[index + 1].map((candidate) => candidate.id);
            expect(node.next.every((id) => nextIds.includes(id))).toBe(true);
          }
          if (index > 0) {
            expect(map.columns[index - 1].some((source) => source.next.includes(node.id))).toBe(true);
          }
        }
      });
    }
  });

  it("offers a real choice on a healthy share of jumps", () => {
    const branching = sampleMaps().flatMap((map) => map.columns.slice(0, SECTOR_LENGTH - 2).flat());
    const choices = branching.filter((node) => node.next.length > 1).length;
    expect(choices / branching.length).toBeGreaterThan(0.4);
  });

  it("keeps duels out of the first two jumps and opens a first-ever run with one swarm node", () => {
    for (const map of sampleMaps().filter((candidate) => candidate.index === 0)) {
      for (const column of map.columns.slice(0, 2)) {
        expect(column.some((node) => node.route === "duel")).toBe(false);
      }
    }
    const firstRun = generateSectorMap(0, 42, true);
    expect(firstRun.columns[0].map((node) => node.route)).toEqual(["swarm"]);
  });

  it("is deterministic for a seed and varies between seeds", () => {
    expect(generateSectorMap(1, 99, false)).toEqual(generateSectorMap(1, 99, false));
    const routes = (seed: number) => JSON.stringify(generateSectorMap(0, seed, false).columns.map((column) => column.map((node) => node.route)));
    expect(new Set([1, 2, 3, 4, 5].map((seed) => routes(seed * 1013))).size).toBeGreaterThan(1);
  });
});
