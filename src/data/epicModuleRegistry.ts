import type {
  BotInstance,
  EpicModuleDefinition,
  EpicModuleId,
  FabricationOptionId,
  ModuleId,
  RunState,
  ShipSlot,
} from "../types/gameTypes";
import { MODULE_DEFINITIONS } from "./modules";

export const EPIC_MODULE_REGISTRY: Record<EpicModuleId, EpicModuleDefinition> = {
  dawn_prism: {
    id: "dawn_prism",
    baseModuleId: "solar_collector",
    name: "Dawn Prism",
    shortName: "PRS",
    description: "Epic solar prism. Single-use fabrication core that overcharges the bot it joins.",
    rarity: "epic",
    color: 0xffdf78,
    previewText: "Dawn Prism overcharges the result with speed, mining, and solar bleed.",
    mergeNote: "Overcharge: +speed, +mining, +support, and passive solar drip during missions.",
    applyToBot(bot) {
      bot.name = `Prism ${bot.name}`;
      bot.color = 0xffdf78;
      bot.speed += 8;
      bot.mining = Math.round(bot.mining * 1.28 * 10) / 10;
      bot.support = Math.round(bot.support * 1.18 * 10) / 10;
      bot.tags.push("epic", "epic_solar");
    },
  },
  war_forge: {
    id: "war_forge",
    baseModuleId: "pulse_cannon",
    name: "War Forge",
    shortName: "WRF",
    description: "Epic cannon block. Single-use fabrication core that turns merged bots into siege pieces.",
    rarity: "epic",
    color: 0xff8f6d,
    previewText: "War Forge hardens the result into a siege unit with boss-breaking fire.",
    mergeNote: "Siege frame: +attack, +range, +hp, and partial immunity to boss projectile dampening.",
    applyToBot(bot) {
      bot.name = `War ${bot.name}`;
      bot.color = 0xff8f6d;
      bot.attack = Math.round(bot.attack * 1.38 * 10) / 10;
      bot.range += 18;
      bot.maxHp += 14;
      bot.hp += 14;
      bot.tags.push("epic", "epic_siege");
    },
  },
  sainted_patch: {
    id: "sainted_patch",
    baseModuleId: "repair_node",
    name: "Sainted Patch",
    shortName: "STP",
    description: "Epic repair weave. Single-use fabrication core that sanctifies the merged bot into a guardian healer.",
    rarity: "epic",
    color: 0x9ff0ce,
    previewText: "Sainted Patch grants the result a guardian field that amplifies repair and defense.",
    mergeNote: "Guardian field: +support, +defense, and stronger shield recovery during missions.",
    applyToBot(bot) {
      bot.name = `Sainted ${bot.name}`;
      bot.color = 0x9ff0ce;
      bot.support = Math.round(bot.support * 1.42 * 10) / 10;
      bot.maxHp += 10;
      bot.hp += 10;
      bot.tags.push("epic", "epic_guardian");
    },
  },
};

export function createEmptyEpicInventory(): Record<EpicModuleId, number> {
  return {
    dawn_prism: 0,
    war_forge: 0,
    sainted_patch: 0,
  };
}

export function isEpicModuleId(id: string | undefined): id is EpicModuleId {
  return Boolean(id && id in EPIC_MODULE_REGISTRY);
}

export function getEpicModuleById(id: EpicModuleId): EpicModuleDefinition {
  return EPIC_MODULE_REGISTRY[id];
}

export function getFabricationBaseModuleId(fabricationId: FabricationOptionId): ModuleId {
  return isEpicModuleId(fabricationId) ? EPIC_MODULE_REGISTRY[fabricationId].baseModuleId : fabricationId;
}

export function getFabricationCardData(fabricationId: FabricationOptionId): {
  id: FabricationOptionId;
  name: string;
  shortName: string;
  description: string;
  color: number;
  costLabel: string;
  rarity?: "epic";
  count?: number;
} {
  if (isEpicModuleId(fabricationId)) {
    const epic = getEpicModuleById(fabricationId);
    return {
      id: fabricationId,
      name: epic.name,
      shortName: epic.shortName,
      description: epic.description,
      color: epic.color,
      costLabel: "1 stored core",
      rarity: "epic",
    };
  }

  const module = MODULE_DEFINITIONS[fabricationId];
  const costParts = [`S ${module.fabricationCost.solar}`, `M ${module.fabricationCost.minerals}`];
  if (module.fabricationCost.scrap > 0) {
    costParts.push(`C ${module.fabricationCost.scrap}`);
  }
  return {
    id: fabricationId,
    name: module.name,
    shortName: module.shortName,
    description: module.description,
    color: module.color,
    costLabel: costParts.join(" | "),
  };
}

export function getSlotModulePresentation(slot: ShipSlot): {
  moduleId: ModuleId;
  shortName: string;
  color: number;
  epicModuleId?: EpicModuleId;
} | undefined {
  if (!slot.moduleId) {
    return undefined;
  }
  if (slot.epicModuleId) {
    const epic = getEpicModuleById(slot.epicModuleId);
    return {
      moduleId: slot.moduleId,
      shortName: epic.shortName,
      color: epic.color,
      epicModuleId: epic.id,
    };
  }
  const module = MODULE_DEFINITIONS[slot.moduleId];
  return {
    moduleId: slot.moduleId,
    shortName: module.shortName,
    color: module.color,
  };
}

export function grantEpicModule(state: RunState, epicId: EpicModuleId): void {
  state.ship.epicInventory[epicId] += 1;
}

export function applyEpicModifiers(bot: BotInstance, epicModuleIds: readonly EpicModuleId[]): void {
  if (epicModuleIds.length === 0) {
    return;
  }

  bot.epicModules = [...epicModuleIds];
  for (const epicId of epicModuleIds) {
    EPIC_MODULE_REGISTRY[epicId].applyToBot(bot);
  }

  if (bot.tags.includes("epic_solar")) {
    bot.tags.push("solar_bleed");
  }
  if (bot.tags.includes("epic_siege")) {
    bot.tags.push("boss_breaker");
  }
  if (bot.tags.includes("epic_guardian")) {
    bot.tags.push("shield_aura");
  }
}