import type { RouteId, RunState, SectorMap, SectorNode } from "../types/gameTypes";

// Matches the boss interval in bossManager: jumps 1-9 branch, jump 10 is always the boss.
export const SECTOR_LENGTH = 10;
const DUEL_FIRST_CYCLE = 3;
const EXTRA_LINK_CHANCE = 0.6;

function createRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRoute(random: () => number, cycle: number): RouteId {
  const pool: Array<[RouteId, number]> = [
    ["swarm", 3],
    ["nebula", 1],
    ["derelict", 1],
  ];
  if (cycle >= DUEL_FIRST_CYCLE) {
    pool.push(["duel", 2]);
  }
  let roll = random() * pool.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [route, weight] of pool) {
    roll -= weight;
    if (roll < 0) {
      return route;
    }
  }
  return "swarm";
}

function linkCrosses(from: SectorNode[], to: SectorNode[], source: SectorNode, target: SectorNode): boolean {
  return from.some((other) =>
    other.next.some((id) => {
      const otherTarget = to.findIndex((node) => node.id === id);
      return (other.row < source.row && otherTarget > target.row) || (other.row > source.row && otherTarget < target.row);
    }),
  );
}

function link(source: SectorNode, target: SectorNode): void {
  if (!source.next.includes(target.id)) {
    source.next.push(target.id);
  }
}

export function getSectorIndex(cycle: number): number {
  return Math.floor((cycle - 1) / SECTOR_LENGTH);
}

export function generateSectorMap(index: number, seed: number, firstMission: boolean): SectorMap {
  const random = createRandom(seed + index * 7919);
  const columns: SectorNode[][] = [];
  for (let column = 0; column < SECTOR_LENGTH; column += 1) {
    const cycle = index * SECTOR_LENGTH + column + 1;
    const boss = column === SECTOR_LENGTH - 1;
    const single = boss || (firstMission && column === 0);
    const rows = single ? 1 : 2 + Math.floor(random() * 2);
    const used = new Set<RouteId>();
    const nodes: SectorNode[] = [];
    for (let row = 0; row < rows; row += 1) {
      let route: RouteId = boss ? "boss" : single ? "swarm" : pickRoute(random, cycle);
      if (!single && used.has(route)) {
        route = pickRoute(random, cycle);
      }
      used.add(route);
      nodes.push({ id: `s${index}-c${column}-r${row}`, column, row, rows, cycle, route, next: [] });
    }
    columns.push(nodes);
  }

  for (let column = 0; column < SECTOR_LENGTH - 1; column += 1) {
    const from = columns[column];
    const to = columns[column + 1];
    const nearest = (node: SectorNode, length: number) =>
      Math.round((node.rows === 1 ? 0.5 : node.row / (node.rows - 1)) * (length - 1));
    for (const source of from) {
      link(source, to[nearest(source, to.length)]);
    }
    for (const source of from) {
      const base = nearest(source, to.length);
      const neighbors = [to[base - 1], to[base + 1]].filter((node): node is SectorNode => Boolean(node));
      const target = neighbors[Math.floor(random() * neighbors.length)];
      if (target && random() < EXTRA_LINK_CHANCE && !linkCrosses(from, to, source, target)) {
        link(source, target);
      }
    }
    for (const target of to) {
      if (!from.some((source) => source.next.includes(target.id))) {
        const source = from[nearest(target, from.length)];
        link(source, target);
      }
    }
  }

  return { index, seed, columns, path: [], selectedNodeId: columns[0][0].id };
}

export function getSectorNode(sector: SectorMap, nodeId: string): SectorNode | undefined {
  return sector.columns.flat().find((node) => node.id === nodeId);
}

export function getReachableNodes(state: Pick<RunState, "cycle" | "sector">): SectorNode[] {
  const { sector } = state;
  const column = (state.cycle - 1) % SECTOR_LENGTH;
  const last = sector.path.length > 0 ? getSectorNode(sector, sector.path[sector.path.length - 1]) : undefined;
  const next = last && last.column === column - 1 ? last.next.map((id) => getSectorNode(sector, id)!).filter(Boolean) : [];
  return next.length > 0 ? next : sector.columns[column] ?? [];
}
