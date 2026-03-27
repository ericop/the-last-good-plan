import { MODULE_DEFINITIONS } from "./modules";
import type { MergeModules, MergeRecipe, ModuleId } from "../types/gameTypes";

interface ModuleTrait {
  label: string;
  tags: string[];
  hp: number;
  speed: number;
  mining: number;
  attack: number;
  support: number;
  range: number;
  salvage: number;
  defense: number;
}

const MODULE_ORDER: ModuleId[] = [
  "solar_collector",
  "mineral_drill",
  "shield_emitter",
  "pulse_cannon",
  "cargo_core",
  "repair_node",
];

const MODULE_TRAITS: Record<ModuleId, ModuleTrait> = {
  solar_collector: {
    label: "Solar",
    tags: ["solar", "power"],
    hp: 6,
    speed: 10,
    mining: 1.8,
    attack: 1.2,
    support: 1.2,
    range: 10,
    salvage: 0.3,
    defense: 0.8,
  },
  mineral_drill: {
    label: "Drill",
    tags: ["mining", "industrial"],
    hp: 10,
    speed: 2,
    mining: 3.2,
    attack: 1,
    support: 0.4,
    range: 0,
    salvage: 0.8,
    defense: 0.5,
  },
  shield_emitter: {
    label: "Shield",
    tags: ["defense", "shield"],
    hp: 18,
    speed: -4,
    mining: 0.2,
    attack: 1.5,
    support: 2.2,
    range: 12,
    salvage: 0.3,
    defense: 3.2,
  },
  pulse_cannon: {
    label: "Pulse",
    tags: ["offense", "pulse"],
    hp: 8,
    speed: 3,
    mining: 0.2,
    attack: 4,
    support: 0.3,
    range: 26,
    salvage: 0.4,
    defense: 1.1,
  },
  cargo_core: {
    label: "Cargo",
    tags: ["cargo", "salvage"],
    hp: 14,
    speed: -5,
    mining: 0.8,
    attack: 0.6,
    support: 0.8,
    range: 6,
    salvage: 1.8,
    defense: 1.7,
  },
  repair_node: {
    label: "Repair",
    tags: ["support", "repair"],
    hp: 12,
    speed: 0,
    mining: 0.4,
    attack: 0.4,
    support: 3.4,
    range: 18,
    salvage: 0.5,
    defense: 1.5,
  },
};

const LEGACY_RECIPE_OVERRIDES: MergeRecipe[] = [
  {
    id: "survey_harrier",
    modules: ["solar_collector", "mineral_drill"],
    resultName: "Survey Harrier",
    role: "mining",
    hint: "Likely a nimble extractor with strong first-contact mining.",
    summary: "Fast mining drone. Dashes to the moon, then helps intercept light threats.",
    masteryNote: "Mastered crews use Harriers to front-load early artifact races.",
    color: 0xf2e86d,
    tags: ["solar", "mining"],
    stats: { hp: 44, speed: 62, mining: 4.2, attack: 2.8, support: 0.5, range: 78, salvage: 0.3 },
  },
  {
    id: "lancer_skiff",
    modules: ["solar_collector", "pulse_cannon"],
    resultName: "Lancer Skiff",
    role: "defense",
    hint: "Reads like an aggressive solar chassis with ranged pressure.",
    summary: "Long-range skirmisher that burns down wave enemies before they touch the hull.",
    masteryNote: "Mastered Skiffs shine when commitment stays high and shots stay uninterrupted.",
    color: 0xffb36e,
    tags: ["solar", "offense"],
    stats: { hp: 40, speed: 58, mining: 0.8, attack: 5, support: 0.4, range: 140, salvage: 0.7 },
  },
  {
    id: "aegis_kite",
    modules: ["solar_collector", "shield_emitter"],
    resultName: "Aegis Kite",
    role: "support",
    hint: "Suggests a mobile shield relay that prefers guarding lanes.",
    summary: "Projects shields to nearby bots and patches small hull losses mid-cycle.",
    masteryNote: "Mastered Kites let fragile mining plans survive longer than they should.",
    color: 0x8be2c7,
    tags: ["solar", "defense", "support"],
    stats: { hp: 54, speed: 46, mining: 0.6, attack: 1.8, support: 4.8, range: 110, salvage: 0.4 },
  },
  {
    id: "sunsmith_tender",
    modules: ["solar_collector", "repair_node"],
    resultName: "Sunsmith Tender",
    role: "support",
    hint: "Probably a sustain bot that converts clean energy into repairs.",
    summary: "A dedicated support bot that keeps nearby bots healthy and boosts solar-fed recipes.",
    masteryNote: "Mastered Tenders make low-action defensive runs feel almost self-healing.",
    color: 0xb7f29c,
    tags: ["solar", "support"],
    stats: { hp: 50, speed: 48, mining: 0.4, attack: 1.2, support: 5.3, range: 105, salvage: 0.5 },
  },
  {
    id: "quarry_mule",
    modules: ["mineral_drill", "cargo_core"],
    resultName: "Quarry Mule",
    role: "mining",
    hint: "Industrial pattern. Heavy extraction, low elegance, excellent hauling.",
    summary: "Slow heavy miner. Outstanding mineral yield and salvage on secured boards.",
    masteryNote: "Mastered Mules pair best with ships that can keep a calm defensive bubble alive.",
    color: 0x7dc6ff,
    tags: ["mining", "cargo"],
    stats: { hp: 68, speed: 34, mining: 5.2, attack: 1.6, support: 0.5, range: 70, salvage: 1.3 },
  },
  {
    id: "field_mechanic",
    modules: ["mineral_drill", "repair_node"],
    resultName: "Field Mechanic",
    role: "hybrid",
    hint: "A practical maintenance rig. Probably useful, probably not glamorous.",
    summary: "Mediocre hybrid that mines modestly while repairing nearby allies under pressure.",
    masteryNote: "Mastered Mechanics are a quiet glue piece for conservative extraction plans.",
    color: 0xa0e2be,
    tags: ["mining", "support"],
    stats: { hp: 56, speed: 40, mining: 2.6, attack: 1.4, support: 2.8, range: 90, salvage: 0.8 },
  },
  {
    id: "breach_prospector",
    modules: ["mineral_drill", "pulse_cannon"],
    resultName: "Breach Prospector",
    role: "hybrid",
    hint: "Looks like an extractor built to force mining windows through danger.",
    summary: "Combat miner that cracks enemies near the moon and keeps extraction going.",
    masteryNote: "Mastered Prospectors reward players who build for lane control instead of panic swaps.",
    color: 0xff9d77,
    tags: ["mining", "offense"],
    stats: { hp: 52, speed: 50, mining: 3.4, attack: 3.8, support: 0.3, range: 115, salvage: 0.9 },
  },
  {
    id: "bastion_warden",
    modules: ["shield_emitter", "pulse_cannon"],
    resultName: "Bastion Warden",
    role: "defense",
    hint: "Classic escort logic. Slow, deliberate, and built for holding a lane.",
    summary: "Durable defender. Screens the ship and punishes enemies that cross the line.",
    masteryNote: "Mastered Wardens are the backbone of preservation doctrine runs.",
    color: 0xf08e86,
    tags: ["defense", "offense"],
    stats: { hp: 76, speed: 36, mining: 0.5, attack: 4.5, support: 1.4, range: 120, salvage: 0.7 },
  },
  {
    id: "salvage_bulwark",
    modules: ["shield_emitter", "cargo_core"],
    resultName: "Salvage Bulwark",
    role: "hybrid",
    hint: "Defensive logistics frame. Probably sturdy, probably not explosive.",
    summary: "Weak-but-informative tank that improves scrap recovery while body-blocking raids.",
    masteryNote: "Mastered Bulwarks stop feeling weak once salvage artifacts start stacking.",
    color: 0xd6bbff,
    tags: ["defense", "cargo"],
    stats: { hp: 84, speed: 28, mining: 0.6, attack: 2, support: 1.6, range: 88, salvage: 1.9 },
  },
  {
    id: "lifeline_tug",
    modules: ["cargo_core", "repair_node"],
    resultName: "Lifeline Tug",
    role: "support",
    hint: "A support hauler. Likely keeps everyone in the fight longer than expected.",
    summary: "Excellent repair-support bot that also improves salvage efficiency across the fleet.",
    masteryNote: "Mastered Tugs make recovery-focused plans snowball into very safe boards.",
    color: 0xc1ef9b,
    tags: ["cargo", "support"],
    stats: { hp: 60, speed: 44, mining: 0.4, attack: 1.2, support: 5.6, range: 110, salvage: 1.1 },
  },
];

const ROLE_NAME_PARTS = {
  mining: { pair: "Prospector", repeated: "Excavator", trio: "Expedition" },
  defense: { pair: "Warden", repeated: "Bulwark", trio: "Bastion" },
  support: { pair: "Tender", repeated: "Sanctuary", trio: "Relay" },
  hybrid: { pair: "Frame", repeated: "Works", trio: "Matrix" },
} as const;

const ROLE_HINTS = {
  mining: "a self-directed extractor",
  defense: "a defensive escort",
  support: "a field support unit",
  hybrid: "a cross-role chassis",
} as const;

const ROLE_SUMMARIES = {
  mining: "Mining bot that races objectives and keeps ore flowing.",
  defense: "Defense bot that screens the ship and punishes incoming threats.",
  support: "Support bot that stabilizes allies and stretches safe missions.",
  hybrid: "Hybrid bot that spreads its work across mining, pressure, and sustain.",
} as const;

const ROLE_MASTERY = {
  mining: "Mastered crews use it to front-load objective pressure without frantic swapping.",
  defense: "Mastered crews use it to hold predictable lanes and let the rest of the ship stay calm.",
  support: "Mastered crews use it to turn risky boards into stable, self-correcting plans.",
  hybrid: "Mastered crews use it when one clean chassis needs to cover multiple jobs at once.",
} as const;

function sortModules(modules: readonly ModuleId[]): ModuleId[] {
  return [...modules].sort((left, right) => MODULE_ORDER.indexOf(left) - MODULE_ORDER.indexOf(right));
}

function toMergeModules(modules: readonly ModuleId[]): MergeModules {
  const sorted = sortModules(modules);
  if (sorted.length === 2) {
    return [sorted[0], sorted[1]];
  }
  return [sorted[0], sorted[1], sorted[2]];
}

function getMergeKey(modules: readonly ModuleId[]): string {
  return sortModules(modules).join("|");
}

function blendColors(modules: readonly ModuleId[]): number {
  const totals = modules.reduce(
    (accumulator, moduleId) => {
      const color = MODULE_DEFINITIONS[moduleId].color;
      accumulator.r += (color >> 16) & 0xff;
      accumulator.g += (color >> 8) & 0xff;
      accumulator.b += color & 0xff;
      return accumulator;
    },
    { r: 0, g: 0, b: 0 },
  );
  const count = modules.length;
  const r = Math.round(totals.r / count);
  const g = Math.round(totals.g / count);
  const b = Math.round(totals.b / count);
  return (r << 16) + (g << 8) + b;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function countModules(modules: readonly ModuleId[]): Record<ModuleId, number> {
  return modules.reduce(
    (counts, moduleId) => {
      counts[moduleId] += 1;
      return counts;
    },
    {
      solar_collector: 0,
      mineral_drill: 0,
      shield_emitter: 0,
      pulse_cannon: 0,
      cargo_core: 0,
      repair_node: 0,
    } satisfies Record<ModuleId, number>,
  );
}

function buildAxisTotals(modules: readonly ModuleId[]) {
  const counts = countModules(modules);
  const distinctCount = new Set(modules).size;
  const has = (moduleId: ModuleId) => counts[moduleId] > 0;
  const totals = modules.reduce(
    (accumulator, moduleId) => {
      const trait = MODULE_TRAITS[moduleId];
      accumulator.hp += trait.hp;
      accumulator.speed += trait.speed;
      accumulator.mining += trait.mining;
      accumulator.attack += trait.attack;
      accumulator.support += trait.support;
      accumulator.range += trait.range;
      accumulator.salvage += trait.salvage;
      accumulator.defense += trait.defense;
      return accumulator;
    },
    { hp: 0, speed: 0, mining: 0, attack: 0, support: 0, range: 0, salvage: 0, defense: 0 },
  );

  if (has("solar_collector") && has("mineral_drill")) {
    totals.mining += 1.1;
    totals.speed += 2;
  }
  if (has("solar_collector") && has("shield_emitter")) {
    totals.support += 0.9;
    totals.defense += 0.8;
  }
  if (has("solar_collector") && has("pulse_cannon")) {
    totals.attack += 0.8;
    totals.speed += 2;
  }
  if (has("solar_collector") && has("cargo_core")) {
    totals.mining += 0.3;
    totals.salvage += 0.5;
  }
  if (has("solar_collector") && has("repair_node")) {
    totals.support += 1;
  }
  if (has("mineral_drill") && has("shield_emitter")) {
    totals.mining += 0.4;
    totals.defense += 0.8;
  }
  if (has("mineral_drill") && has("pulse_cannon")) {
    totals.attack += 0.9;
    totals.mining += 0.5;
  }
  if (has("mineral_drill") && has("cargo_core")) {
    totals.mining += 0.8;
    totals.salvage += 0.7;
  }
  if (has("mineral_drill") && has("repair_node")) {
    totals.support += 0.7;
    totals.mining += 0.5;
  }
  if (has("shield_emitter") && has("pulse_cannon")) {
    totals.attack += 0.7;
    totals.defense += 1.1;
  }
  if (has("shield_emitter") && has("cargo_core")) {
    totals.defense += 1.2;
    totals.salvage += 0.5;
  }
  if (has("shield_emitter") && has("repair_node")) {
    totals.support += 1.2;
    totals.defense += 1;
  }
  if (has("pulse_cannon") && has("cargo_core")) {
    totals.attack += 0.6;
    totals.salvage += 0.5;
  }
  if (has("pulse_cannon") && has("repair_node")) {
    totals.attack += 0.4;
    totals.support += 0.8;
  }
  if (has("cargo_core") && has("repair_node")) {
    totals.support += 0.7;
    totals.salvage += 0.8;
  }

  if (counts.solar_collector === 2) {
    totals.mining += 0.6;
    totals.support += 0.4;
    totals.speed += 2;
  }
  if (counts.mineral_drill === 2) {
    totals.mining += 1.2;
    totals.hp += 4;
  }
  if (counts.shield_emitter === 2) {
    totals.support += 0.8;
    totals.defense += 1.2;
    totals.hp += 6;
  }
  if (counts.pulse_cannon === 2) {
    totals.attack += 1.4;
    totals.range += 12;
  }
  if (counts.cargo_core === 2) {
    totals.salvage += 1.1;
    totals.hp += 6;
    totals.speed -= 2;
  }
  if (counts.repair_node === 2) {
    totals.support += 1.4;
    totals.hp += 4;
  }

  if (modules.length === 3) {
    totals.hp += 10;
    totals.speed -= 2;
  }
  if (distinctCount === 3) {
    totals.mining += 0.2;
    totals.attack += 0.2;
    totals.support += 0.2;
  }

  return { counts, distinctCount, totals };
}

function determineRole(modules: readonly ModuleId[]): MergeRecipe["role"] {
  const { distinctCount, totals } = buildAxisTotals(modules);
  const scores = [
    { id: "mining" as const, value: totals.mining + totals.salvage * 0.25 },
    { id: "defense" as const, value: totals.attack * 0.85 + totals.defense + totals.hp / 30 },
    { id: "support" as const, value: totals.support + totals.defense * 0.45 },
  ].sort((left, right) => right.value - left.value);

  const hybridThreshold = distinctCount === 3 ? 0.9 : 0.84;
  if (scores[1].value >= scores[0].value * hybridThreshold) {
    return "hybrid";
  }
  if (scores[0].id === "mining") {
    return "mining";
  }
  if (scores[0].id === "support") {
    return "support";
  }
  return "defense";
}

function buildStats(modules: readonly ModuleId[], role: MergeRecipe["role"]): MergeRecipe["stats"] {
  const { totals } = buildAxisTotals(modules);
  const stats = {
    hp: Math.round(26 + totals.hp + totals.defense * 6),
    speed: Math.round(Math.max(28, Math.min(68, 36 + totals.speed))),
    mining: round1(totals.mining),
    attack: round1(totals.attack),
    support: round1(totals.support),
    range: Math.round(Math.max(68, Math.min(150, 70 + totals.range))),
    salvage: round1(0.1 + totals.salvage),
  };

  if (role === "mining") {
    stats.mining = round1(Math.max(stats.mining, 2.6));
    stats.speed = Math.min(72, stats.speed + 2);
  }
  if (role === "defense") {
    stats.attack = round1(Math.max(stats.attack, 2.8));
    stats.hp += 6;
  }
  if (role === "support") {
    stats.support = round1(Math.max(stats.support, 2.8));
    stats.range += 6;
  }
  if (role === "hybrid") {
    stats.mining = round1(Math.max(stats.mining, 1.6));
    stats.attack = round1(Math.max(stats.attack, 1.6));
    stats.support = round1(Math.max(stats.support, 1.6));
  }

  return stats;
}

function describeAxes(modules: readonly ModuleId[]): string {
  const { totals } = buildAxisTotals(modules);
  const axes = [
    { label: "mining", value: totals.mining + totals.salvage * 0.2 },
    { label: "defense", value: totals.attack * 0.7 + totals.defense },
    { label: "support", value: totals.support + totals.defense * 0.35 },
  ].sort((left, right) => right.value - left.value);
  if (axes[1].value >= axes[0].value * 0.8) {
    return `${axes[0].label} and ${axes[1].label}`;
  }
  return axes[0].label;
}

function getBehaviorNotes(modules: readonly ModuleId[]): string[] {
  const { counts } = buildAxisTotals(modules);
  const notes: string[] = [];
  const has = (moduleId: ModuleId) => counts[moduleId] > 0;

  if (counts.solar_collector === 2) notes.push("Double solar hardware keeps it unusually quick and efficient.");
  if (counts.mineral_drill === 2) notes.push("Paired drills let it bite deeper into the moon objective.");
  if (counts.shield_emitter === 2) notes.push("Stacked shield work makes it hold lanes for longer.");
  if (counts.pulse_cannon === 2) notes.push("Twin pulse emitters give it sharp threat pressure.");
  if (counts.cargo_core === 2) notes.push("Extra cargo framing turns more debris into scrap.");
  if (counts.repair_node === 2) notes.push("Twin repair nodes let it stabilize attrition over time.");

  if (has("solar_collector") && has("mineral_drill")) notes.push("It reaches the moon quickly and turns time into minerals.");
  if (has("solar_collector") && has("shield_emitter")) notes.push("Its solar-fed shielding helps it stay calm under pressure.");
  if (has("solar_collector") && has("pulse_cannon")) notes.push("It converts clean power into steady long-range pressure.");
  if (has("solar_collector") && has("repair_node")) notes.push("It converts spare energy into reliable repair coverage.");
  if (has("mineral_drill") && has("cargo_core")) notes.push("It pulls extra value from safe mining windows.");
  if (has("mineral_drill") && has("pulse_cannon")) notes.push("It can force space around the moon before settling in to mine.");
  if (has("shield_emitter") && has("pulse_cannon")) notes.push("It wants to anchor a lane and punish anything that pushes through.");
  if (has("shield_emitter") && has("repair_node")) notes.push("It leans hard into keeping friendly pieces alive.");
  if (has("cargo_core") && has("repair_node")) notes.push("It stretches both salvage and recovery in the same chassis.");
  if (has("cargo_core") && has("pulse_cannon")) notes.push("It recovers value while helping clear lighter threats.");

  return [...new Set(notes)];
}

function listModuleNames(modules: readonly ModuleId[]): string {
  const names = modules.map((moduleId) => MODULE_DEFINITIONS[moduleId].name);
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
  return `${names[0]}, ${names[1]}, and ${names[2]}`;
}

function buildName(modules: readonly ModuleId[], role: MergeRecipe["role"]): string {
  const { counts, distinctCount } = buildAxisTotals(modules);
  const sorted = sortModules(modules);
  const labels = sorted.map((moduleId) => MODULE_TRAITS[moduleId].label);

  if (modules.length === 2) {
    return `${labels[0]}-${labels[1]} ${ROLE_NAME_PARTS[role].pair}`;
  }

  const repeated = Object.entries(counts).find(([, count]) => count === 2)?.[0] as ModuleId | undefined;
  if (repeated) {
    const other = sorted.find((moduleId) => moduleId !== repeated)!;
    return `Twin ${MODULE_TRAITS[repeated].label} ${MODULE_TRAITS[other].label} ${ROLE_NAME_PARTS[role].repeated}`;
  }

  if (distinctCount === 3) {
    return `${labels[0]}-${labels[1]}-${labels[2]} ${ROLE_NAME_PARTS[role].trio}`;
  }

  return `${labels.join("-")} ${ROLE_NAME_PARTS[role].trio}`;
}

function buildHint(modules: readonly ModuleId[], role: MergeRecipe["role"]): string {
  return `Pattern leans ${describeAxes(modules)}. Expect ${ROLE_HINTS[role]} built from ${listModuleNames(modules)}.`;
}

function buildSummary(modules: readonly ModuleId[], role: MergeRecipe["role"]): string {
  const notes = getBehaviorNotes(modules).slice(0, 2).join(" ");
  return `${ROLE_SUMMARIES[role]} Built from ${listModuleNames(modules)}.${notes ? ` ${notes}` : ""}`;
}

function buildMasteryNote(modules: readonly ModuleId[], role: MergeRecipe["role"]): string {
  const repeatedModule = Object.entries(countModules(modules)).find(([, count]) => count === 2)?.[0] as ModuleId | undefined;
  if (repeatedModule) {
    return `${ROLE_MASTERY[role]} Repeating ${MODULE_DEFINITIONS[repeatedModule].name} gives this chassis a very committed lane.`;
  }
  if (modules.length === 3) {
    return `${ROLE_MASTERY[role]} Three-module frames reward players who plan the cluster before the mission starts.`;
  }
  return ROLE_MASTERY[role];
}

function buildTags(modules: readonly ModuleId[], role: MergeRecipe["role"]): string[] {
  return [
    ...new Set(modules.flatMap((moduleId) => MODULE_TRAITS[moduleId].tags).concat(role, modules.length === 3 ? "triple" : "pair")),
  ];
}

function buildGeneratedRecipe(modules: MergeModules): MergeRecipe {
  const role = determineRole(modules);
  const key = getMergeKey(modules);
  const override = LEGACY_RECIPE_OVERRIDES.find((recipe) => getMergeKey(recipe.modules) === key);
  const generated: MergeRecipe = {
    id: `merge_${key.replace(/\|/g, "__")}`,
    modules,
    resultName: buildName(modules, role),
    role,
    hint: buildHint(modules, role),
    summary: buildSummary(modules, role),
    masteryNote: buildMasteryNote(modules, role),
    color: blendColors(modules),
    tags: buildTags(modules, role),
    stats: buildStats(modules, role),
  };

  return override
    ? {
        ...generated,
        ...override,
        modules,
      }
    : generated;
}

function buildValidModuleSets(): MergeModules[] {
  const moduleSets: MergeModules[] = [];

  for (let left = 0; left < MODULE_ORDER.length; left += 1) {
    for (let right = left + 1; right < MODULE_ORDER.length; right += 1) {
      moduleSets.push([MODULE_ORDER[left], MODULE_ORDER[right]]);
    }
  }

  for (let first = 0; first < MODULE_ORDER.length; first += 1) {
    for (let second = first + 1; second < MODULE_ORDER.length; second += 1) {
      for (let third = second + 1; third < MODULE_ORDER.length; third += 1) {
        moduleSets.push([MODULE_ORDER[first], MODULE_ORDER[second], MODULE_ORDER[third]]);
      }
    }
  }

  for (const repeated of MODULE_ORDER) {
    for (const other of MODULE_ORDER) {
      if (other === repeated) {
        continue;
      }
      moduleSets.push(toMergeModules([repeated, repeated, other]));
    }
  }

  return moduleSets;
}

export const MERGE_RECIPES: MergeRecipe[] = buildValidModuleSets().map((modules) => buildGeneratedRecipe(modules));
