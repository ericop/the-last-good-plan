import type { FighterInstance, FighterKind, RunState, ShipSlot } from "../types/gameTypes";
import { countAdjacentWithModule, getGlobalArtifactMultiplier } from "./utils";

export const PORT_FIRST_LAUNCH_DELAY = 1.2;

const FIGHTER_BASE: Record<FighterKind, Omit<FighterInstance, "id" | "portSlotId" | "kind" | "x" | "y" | "heading" | "orbit" | "maxHp">> = {
  interceptor: { color: 0x9cc8ff, hp: 24, speed: 88, attack: 4, range: 72, mining: 0, support: 0 },
  skiff: { color: 0x7fe3e8, hp: 16, speed: 72, attack: 1.2, range: 60, mining: 1.6, support: 0 },
  tender: { color: 0xa6f0a2, hp: 16, speed: 74, attack: 0.8, range: 60, mining: 0, support: 2 },
};

export interface PortLoadout {
  kind: FighterKind;
  interval: number;
  capacity: number;
  hp: number;
  attack: number;
}

export function isLaunchPortUnlocked(state: RunState): boolean {
  return state.ship.upgrades.hangar_tech >= 1;
}

export function getPortLoadout(state: RunState, slot: ShipSlot): PortLoadout {
  const level = Math.max(1, state.ship.upgrades.hangar_tech);
  const adjacent = (moduleId: Parameters<typeof countAdjacentWithModule>[2]) =>
    countAdjacentWithModule(state.ship.slots, slot, moduleId) > 0;
  const kind: FighterKind = adjacent("mineral_drill") ? "skiff" : adjacent("repair_node") ? "tender" : "interceptor";
  const base = FIGHTER_BASE[kind];
  const scale = 1 + (level - 1) * 0.12;
  return {
    kind,
    interval: 7 * (1 - (level - 1) * 0.06) * (adjacent("solar_collector") ? 0.8 : 1),
    capacity: 2 + Math.floor((level - 1) / 2),
    hp: Math.round(base.hp * scale * (adjacent("shield_emitter") ? 1.4 : 1)),
    attack: base.attack * scale * (adjacent("pulse_cannon") ? 1.35 : 1) * getGlobalArtifactMultiplier(state, "attackMultiplier"),
  };
}

export function createFighter(state: RunState, slot: ShipSlot, loadout: PortLoadout): FighterInstance {
  const base = FIGHTER_BASE[loadout.kind];
  const scale = 1 + (Math.max(1, state.ship.upgrades.hangar_tech) - 1) * 0.12;
  return {
    id: `fighter_${Math.random().toString(36).slice(2, 10)}`,
    portSlotId: slot.id,
    kind: loadout.kind,
    color: base.color,
    x: slot.x,
    y: slot.y,
    heading: 0,
    orbit: Math.random() * Math.PI * 2,
    hp: loadout.hp,
    maxHp: loadout.hp,
    speed: base.speed,
    attack: loadout.attack,
    range: base.range,
    mining: base.mining * scale,
    support: base.support * scale,
  };
}
