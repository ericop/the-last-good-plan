import type { DialogLine, DialogScene, RouteId, SpeakerId, ThreatWave, TimedStoryEvent } from "../types/gameTypes";

export interface Speaker {
  name: string;
  short: string;
  color: string;
}

export const SPEAKERS: Record<SpeakerId, Speaker> = {
  you: { name: "You", short: "ME", color: "#f6cf62" },
  pip: { name: "Pip", short: "P", color: "#ffb36e" },
  rook: { name: "Rook", short: "R", color: "#9cc8ff" },
  mars: { name: "Mars", short: "M", color: "#ff8fb8" },
  ship: { name: "Ship log", short: "LOG", color: "#7fe0ff" },
  governor: { name: "Governor Brightwater", short: "GB", color: "#f2e7c5" },
  interim: { name: "Interim Governor Plumb", short: "DP", color: "#c9d6a3" },
  corsair: { name: "Corsair captain", short: "C", color: "#e0866b" },
  patrol: { name: "Courtesy Patrol", short: "CP", color: "#7fd8ff" },
  warden: { name: "Border Warden", short: "W", color: "#ff4d6d" },
  glimmerfolk: { name: "The Glimmerfolk", short: "✦", color: "#8ff0ff" },
  aunties: { name: "The Hovering Aunties", short: "♥", color: "#ffb3e6" },
  tide: { name: "The Quiet Tide", short: "≈", color: "#7fb7ff" },
  choir: { name: "The Brass Choir", short: "♪", color: "#ffd27a" },
};

export const ALIEN_SPECIES: SpeakerId[] = ["glimmerfolk", "aunties", "tide", "choir"];

export const ALIEN_COLORS: Record<string, number> = {
  glimmerfolk: 0x8ff0ff,
  aunties: 0xffb3e6,
  tide: 0x7fb7ff,
  choir: 0xffd27a,
};

const line = (speaker: SpeakerId, text: string): DialogLine => ({ speaker, text });

export const RESCUE_LINES: Record<string, { danger: DialogLine[]; fine: DialogLine[]; farewell: DialogLine[] }> = {
  glimmerfolk: {
    danger: [line("glimmerfolk", "We are the Glimmerfolk! We saw your little lights blinking for help.")],
    fine: [line("glimmerfolk", "We are the Glimmerfolk! You seemed fine, but neighbors check anyway.")],
    farewell: [line("glimmerfolk", "Neighbors don't let neighbors get swarmed. Pass it on to the next one who needs it!")],
  },
  aunties: {
    danger: [line("aunties", "The Hovering Aunties are here! You look underfed AND outnumbered. We just fixed one of those.")],
    fine: [line("aunties", "The Hovering Aunties are here! Nothing wrong, dear, we just wanted to see your face.")],
    farewell: [line("aunties", "No thanks needed. Do the same for somebody someday. And eat something.")],
  },
  tide: {
    danger: [line("tide", "...We are the Quiet Tide. We heard you.")],
    fine: [line("tide", "...We are the Quiet Tide. We were passing. That is reason enough.")],
    farewell: [line("tide", "Kindness is a current. Ride it forward.")],
  },
  choir: {
    danger: [line("choir", "THE BRASS CHOIR HAS ARRIVED, IN HARMONY! Also in a hurry, you looked doomed!")],
    fine: [line("choir", "THE BRASS CHOIR HAS ARRIVED, IN HARMONY! We heard you were nearby and did not want to be rude!")],
    farewell: [line("choir", "A good neighbor helps and asks nothing! Help someone else, and hum while you do it!")],
  },
};

export type StoryEvent = TimedStoryEvent;

export interface HeroDefinition {
  speaker: SpeakerId;
  name: string;
  shipName: string;
  hp: number;
  color: number;
}

export interface RescueDefinition {
  hullTrigger: number;
  minTime: number;
  fallbackTime: number;
  doomTime: number;
  doomName: string;
}

export interface CampaignLevel {
  number: number;
  title: string;
  route: RouteId;
  warshipId?: string;
  intro: DialogScene;
  outro: DialogLine[];
  events: StoryEvent[];
  hero?: HeroDefinition;
  rescue?: RescueDefinition;
  extraWaves?: ThreatWave[];
}

export const CAMPAIGN_LEVELS: CampaignLevel[] = [
  {
    number: 1,
    title: "Gentle Order",
    route: "swarm",
    intro: {
      lines: [
        line("governor", "Good morning, Halcyon! Governor Brightwater here with today's Gentle Order Bulletin."),
        line("governor", "As you know, the Porch Committee has been relocated to the Lantern Reach for their own enrichment. They'll love it. It's very quiet."),
        line("governor", "Their children are in the care of our Wholesome Supervision Volunteers. Please keep them away from spaceships."),
        line("ship", "Spaceship status: you are near a spaceship. You are in it."),
        line("pip", "Okay, hear me out: we take my uncle's old mining hauler, follow the relocation lanes, and bring everybody home by dinner."),
        line("mars", "That is the worst plan I have ever heard. I'm coming so it has at least one responsible adult."),
        line("rook", "I packed snacks."),
      ],
      choice: {
        options: [
          { label: "We're bringing them home.", tag: "brave", reply: [line("pip", "That's the spirit! I'm painting a mural about this later.")] },
          {
            label: "Is Noodle on board?",
            tag: "noodle",
            reply: [line("ship", "Noodle detected in: the snack drawer."), line("rook", "He packed snacks too.")],
          },
          { label: "Mars, you're fifteen.", tag: "mars", reply: [line("mars", "Fifteen and three quarters. I'm filing that under respect.")] },
        ],
      },
      after: [line("mars", "We named the ship The Last Good Plan because it was the last plan we had. Launching.")],
    },
    events: [
      { id: "l1-swarm", at: 6, lines: [line("pip", "Little ships at three o'clock! Also nine o'clock. Also every o'clock.")] },
      { id: "l1-complaint", at: 22, lines: [line("mars", "I have filed a complaint about the scavengers. With myself. It was approved.")] },
    ],
    outro: [
      line("governor", "Bulletin addendum: a mining hauler has left the system. It was probably a very determined asteroid."),
      line("rook", "We're an asteroid now."),
    ],
  },
  {
    number: 2,
    title: "The Exit Lane",
    route: "swarm",
    intro: {
      lines: [
        line("mars", "Status report. Hull: holding. Snacks: depleted. Noodle: unaccounted for."),
        line("ship", "Noodle detected in: Pulse Cannon."),
        line("pip", "Okay, hear me out: the relocation ships took the Exit Lane. If we follow the lane, we follow them."),
        line("rook", "The Exit Lane has a gift shop."),
      ],
      choice: {
        options: [
          { label: "Follow the lane.", tag: "lane", reply: [line("pip", "Straight down the middle! Bold. Respectable. Possibly loud.")] },
          {
            label: "Visit the gift shop.",
            tag: "shop",
            reply: [line("rook", "They sell a snow globe of space."), line("mars", "Space is already a snow globe, Rook.")],
          },
        ],
      },
    },
    events: [
      {
        id: "l2-bulletin",
        at: 10,
        lines: [line("governor", "Gentle Order Bulletin! Traffic in the Exit Lane is light today, except one hauler that is definitely not full of children.")],
      },
      {
        id: "l2-tag",
        at: 26,
        byTag: {
          lane: [line("pip", "Middle of the lane, just like we planned!")],
          shop: [line("rook", "I bought the snow globe. It is very small space.")],
        },
      },
    ],
    outro: [line("mars", "Captain's log, day two. We are still not grounded. Somehow.")],
  },
  {
    number: 3,
    title: "Corsair Courtesy",
    route: "duel",
    warshipId: "corsair_frigate",
    hero: { speaker: "rook", name: "Rook", shipName: "Quiet Type", hp: 130, color: 0x9cc8ff },
    intro: {
      lines: [
        line("corsair", "Ahoy, little hauler! By ancient corsair tradition, we will now politely steal everything you own."),
        line("rook", "I'll fly cover in the Quiet Type."),
        line("pip", "Rook's tug is held together with tape and optimism. Mostly tape."),
        line("mars", "Keep Rook's tug in one piece. I am not explaining it to his grandmother."),
      ],
      choice: {
        options: [
          { label: "Stay close to us, Rook.", tag: "close", reply: [line("rook", "Close. Got it.")] },
          { label: "Show them what the Quiet Type can do.", tag: "show", reply: [line("rook", "It can do about four things. I'll do all of them.")] },
          { label: "Rook, say something inspiring.", tag: "inspire", reply: [line("rook", "..."), line("rook", "Snacks after.")] },
        ],
      },
    },
    events: [
      { id: "l3-taunt", at: 8, lines: [line("corsair", "Lovely day for piracy, isn't it?")] },
      {
        id: "l3-rook",
        at: 20,
        byTag: {
          close: [line("rook", "Still close.")],
          show: [line("rook", "That was thing number two.")],
          inspire: [line("rook", "Snacks after. I meant it.")],
        },
      },
      { id: "l3-lance", at: 34, lines: [line("rook", "The big laser glows before it fires. I don't like the big laser.")] },
    ],
    outro: [line("corsair", "Fine, fine! Keep your stuff. You fight like a family reunion."), line("rook", "We kind of are one.")],
  },
  {
    number: 4,
    title: "Picnic at the Derelict",
    route: "derelict",
    intro: {
      lines: [
        line("pip", "A derelict relocation barge! Okay, hear me out: picnic."),
        line("mars", "It's a crime scene."),
        line("pip", "A picnic at a crime scene."),
        line("ship", "Recovered cargo manifest: Porch Committee, row C. Destination: Lantern Reach. Note: requested decaf."),
        line("mars", "That's my dad. He always requests decaf. He never gets decaf."),
      ],
      choice: {
        options: [
          { label: "We're on the right trail.", tag: "trail", reply: [line("mars", "We are. Okay. Okay!")] },
          { label: "We'll bring him a decaf.", tag: "decaf", reply: [line("mars", "Large. With the little lid.")] },
        ],
      },
    },
    events: [
      {
        id: "l4-bulletin",
        at: 8,
        lines: [line("governor", "Gentle Order Bulletin! Derelicts belong to the Office of Things Nobody Wants. Please do not picnic on them.")],
      },
      {
        id: "l4-tag",
        at: 20,
        byTag: {
          trail: [line("mars", "Right trail. Logging it.")],
          decaf: [line("mars", "Large decaf, little lid. Logging it.")],
        },
      },
    ],
    outro: [line("rook", "Good picnic."), line("pip", "Best crime scene ever.")],
  },
  {
    number: 5,
    title: "Nebula of Bad Ideas",
    route: "nebula",
    rescue: { hullTrigger: 0.45, minTime: 18, doomTime: 21, doomName: "The Swarm Mother's Glare", fallbackTime: 34 },
    extraWaves: [
      { time: 17, label: "Offended swarm x16", kind: "dart", count: 16, spacing: 0.25, announce: "THE SWARM IS OFFENDED" },
      { time: 19, label: "Offended brutes x4", kind: "brute", count: 4, spacing: 0.9 },
    ],
    intro: {
      lines: [
        line("pip", "Okay, hear me out: shortcut through the nebula. Shields go offline, but the scrap is incredible."),
        line("mars", "That is a nebula of bad ideas."),
        line("pip", "That's what makes it a shortcut!"),
        line("mars", "I'm launching a formal complaint buoy to the Governor."),
        line("ship", "Complaint buoy launched. Complaint buoy eaten by a space whale."),
      ],
      choice: {
        options: [
          { label: "Trust Pip.", tag: "trust", reply: [line("pip", "Finally, someone who appreciates a terrible idea.")] },
          { label: "Side with Mars.", tag: "mars", reply: [line("mars", "Thank you. Also, we are still going in, aren't we.")] },
        ],
      },
    },
    events: [
      { id: "l5-shields", at: 10, lines: [line("mars", "Shields are offline. I would like that noted.")] },
      { id: "l5-warning", at: 16, lines: [line("ship", "Warning: an unusually large swarm is approaching. It looks personally offended.")] },
      {
        id: "l5-after",
        afterRescue: true,
        byTag: {
          trust: [line("pip", "See? Terrible ideas attract wonderful neighbors.")],
          mars: [line("mars", "I'm withdrawing my complaint. Partially.")],
        },
      },
    ],
    outro: [line("mars", "For the record, we nearly died."), line("pip", "For the record, we nearly didn't!")],
  },
  {
    number: 6,
    title: "Brood Season",
    route: "duel",
    warshipId: "brood_tender",
    hero: { speaker: "pip", name: "Pip", shipName: "Sunny Disposition", hp: 120, color: 0xffb36e },
    intro: {
      lines: [
        line("corsair", "You beat my cousin! I'm his other cousin. I brought my whole brood."),
        line("pip", "I'll fly the Sunny Disposition! Okay, hear me out: I distract them with a light show."),
        line("mars", "Pip, your ship is mostly paint."),
        line("pip", "Very motivating paint!"),
      ],
      choice: {
        options: [
          { label: "Be careful, Pip.", tag: "careful", reply: [line("pip", "Careful is my middle name! It's actually Bartholomew.")] },
          { label: "Make it the best light show ever.", tag: "show", reply: [line("pip", "Oh, it is going to have a finale.")] },
        ],
      },
    },
    events: [
      { id: "l6-brood", at: 8, lines: [line("corsair", "Brood, deploy! Be polite, then steal things.")] },
      {
        id: "l6-tag",
        at: 20,
        byTag: {
          careful: [line("pip", "Being careful! Mostly! Ish!")],
          show: [line("pip", "Finale incoming! Wait, that's THEIR finale.")],
        },
      },
      { id: "l6-mural", at: 40, lines: [line("pip", "If I make it out of this, I'm painting a mural of all of you.")] },
    ],
    outro: [line("pip", "I made it! Mural confirmed."), line("rook", "Paint me taller.")],
  },
  {
    number: 7,
    title: "Interim Measures",
    route: "swarm",
    intro: {
      lines: [
        line("interim", "Hello? Is this on? This is Interim Governor Dale Plumb. Governor Brightwater is on a wellness sabbatical."),
        line("interim", "Off the record, she read your complaint buoys. All forty of them."),
        line("mars", "Forty-one."),
        line("interim", "Also, a postcard came for a Pip. It says: Wear a jacket. Love, Mom. The Lantern Reach is lovely, wish you were here, literally, please come."),
        line("pip", "...Mom."),
      ],
      choice: {
        options: [
          { label: "We're coming, Pip's mom.", tag: "coming", reply: [line("pip", "Can we send a postcard back? It'll just say: jacket on.")] },
          {
            label: "Thanks, Interim Governor.",
            tag: "thanks",
            reply: [line("interim", "Please, call me Dale. Actually, call me Interim Governor. It took a lot of paperwork.")],
          },
        ],
      },
    },
    events: [
      { id: "l7-bulletin", at: 6, lines: [line("interim", "Gentle Order Bulletin, interim edition: everything is fine and I am handling it.")] },
      { id: "l7-update", at: 22, lines: [line("interim", "Small update: everything is not fine, but I am still handling it.")] },
      {
        id: "l7-tag",
        at: 34,
        byTag: {
          coming: [line("pip", "Jacket on. Jacket on. Jacket on.")],
          thanks: [line("interim", "You're welcome! Please stop exploding things near the public buoy.")],
        },
      },
    ],
    outro: [line("rook", "Dale seems nice."), line("mars", "Dale is drowning in paperwork. I respect that.")],
  },
  {
    number: 8,
    title: "Courtesy Patrol",
    route: "duel",
    warshipId: "ion_cutter",
    rescue: { hullTrigger: 0.45, minTime: 17, doomTime: 20, doomName: "The Final Notice Cannon", fallbackTime: 34 },
    extraWaves: [
      { time: 16, label: "Courteous reinforcements x10", kind: "scavenger", count: 10, spacing: 0.4, announce: "EXCESSIVE COURTESY" },
      { time: 18, label: "Courteous brutes x3", kind: "brute", count: 3, spacing: 1 },
    ],
    intro: {
      lines: [
        line("patrol", "This is the Gentle Order Courtesy Patrol. Please hold still while we courteously disable your engines."),
        line("mars", "They said please."),
        line("pip", "Okay, hear me out: we say no, thank you."),
      ],
      choice: {
        options: [
          { label: "No, thank you.", tag: "polite", reply: [line("patrol", "Oh. Well. This is awkward. Firing anyway.")] },
          {
            label: "We're going to get our parents.",
            tag: "honest",
            reply: [line("patrol", "That's very sweet. It is also against regulations. Firing with regret.")],
          },
        ],
      },
    },
    events: [
      { id: "l8-courtesy", at: 8, lines: [line("patrol", "This is a courtesy shot.")] },
      { id: "l8-warning", at: 15, lines: [line("ship", "Warning: Courtesy Patrol reinforcements. They brought a lot of courtesy.")] },
      {
        id: "l8-after",
        afterRescue: true,
        byTag: {
          polite: [line("mars", "We were polite AND alive. Best of both.")],
          honest: [line("rook", "Honesty helped.")],
        },
      },
    ],
    outro: [line("patrol", "Courtesy Patrol, signing off. Off the record: good luck.")],
  },
  {
    number: 9,
    title: "Edge of the Map",
    route: "swarm",
    hero: { speaker: "mars", name: "Mars", shipName: "Formal Complaint", hp: 140, color: 0xff8fb8 },
    intro: {
      lines: [
        line("mars", "I'm flying escort in the Formal Complaint. Yes, I named it that. Yes, it's a statement."),
        line("interim", "Clue time! Relocation coordinates for the Lantern Reach. Please don't tell anyone I sent these. Especially me."),
        line("ship", "Coordinates received. Noodle detected in: the coordinates."),
        line("rook", "How."),
      ],
      choice: {
        options: [
          {
            label: "Mars, thanks for coming.",
            tag: "thanks",
            reply: [line("mars", "Somebody had to bring a responsible adult. It was me. I'm the adult.")],
          },
          { label: "Ready to file one last complaint?", tag: "complaint", reply: [line("mars", "Oh, I'm going to file it at very high speed.")] },
        ],
      },
    },
    events: [
      {
        id: "l9-governor",
        at: 12,
        lines: [line("governor", "This is Odessa Brightwater, briefly back from my sabbatical. I read every buoy. I am rethinking some things.")],
      },
      {
        id: "l9-tag",
        at: 24,
        byTag: {
          thanks: [line("mars", "Responsible adult, reporting for duty.")],
          complaint: [line("mars", "Complaint filed. Delivered by cannon.")],
        },
      },
      { id: "l9-edge", at: 38, lines: [line("mars", "The edge of the map is right past this. Then the Warden.")] },
    ],
    outro: [line("pip", "Okay, hear me out: we go past the edge of the map."), line("mars", "For once, I agree with the plan.")],
  },
  {
    number: 10,
    title: "The Signal Tyrant",
    route: "boss",
    rescue: { hullTrigger: 0.45, minTime: 24, doomTime: 28, doomName: "The Warden's Last Word", fallbackTime: 42 },
    intro: {
      lines: [
        line("warden", "Attention, unauthorized youths. I am the Gentle Order Border Warden. People call me the Signal Tyrant. I prefer Warden."),
        line("warden", "Beyond me lies uncharted space and the Lantern Reach. Nobody passes."),
        line("pip", "Okay, hear me out: we pass."),
        line("rook", "We pass."),
        line("mars", "We pass, and I'm logging it."),
      ],
      choice: {
        options: [
          { label: "Let our parents come home.", tag: "plead", reply: [line("warden", "Request noted. Request denied. Very politely.")] },
          { label: "Everybody: go!", tag: "go", reply: [line("pip", "That's the best plan yet!")] },
        ],
      },
    },
    events: [
      { id: "l10-size", at: 6, lines: [line("rook", "Biggest ship I've ever seen.")] },
      { id: "l10-warden", at: 20, lines: [line("warden", "Please give up in an orderly line.")] },
      {
        id: "l10-after",
        afterRescue: true,
        byTag: {
          plead: [line("mars", "We asked nicely. Now we do it the other way.")],
          go: [line("pip", "GO! GO! Still going!")],
        },
      },
    ],
    outro: [
      line("warden", "Warden... offline. Uncharted space is... open."),
      line("governor", "Odessa Brightwater here. Off the record, and on it: the Gentle Order is over. I was wrong. Go find your families, and bring them home."),
      line("interim", "And I get to go back to being Dale!"),
      line("ship", "The Lantern Reach lies beyond charted space. Every jump from here is uncharted."),
      line("pip", "Okay, hear me out: we keep going."),
      line("rook", "Snacks after."),
    ],
  },
];

export const CAMPAIGN_LENGTH = CAMPAIGN_LEVELS.length;

export function coreGiftLines(coreName: string): DialogLine[] {
  return [
    line("ship", `Cargo check: the Warden's ${coreName} came with us from story mode. It's waiting in your build tray.`),
    line("pip", "Okay, hear me out: put it on the ship, then merge it into a bot. Instant super bot!"),
  ];
}

export const UNCHARTED_BULLETINS: DialogLine[][] = [
  [line("interim", "Uncharted bulletin from Dale: the Porch Committee was spotted holding a meeting on a moon. It's loud.")],
  [line("governor", "Odessa here. Your parents say hello, and that you are grounded, lovingly.")],
  [line("interim", "A relocation ship sent a postcard: the Lantern Reach has excellent sunsets and terrible coffee.")],
  [line("ship", "Noodle detected in: the navigation computer. Navigation has never been better.")],
  [line("governor", "I've reopened the Exit Lane gift shop. The snow globes are back."), line("rook", "Good.")],
  [line("interim", "Clue from Dale: a decaf order was placed somewhere past this sector. Large. Little lid."), line("mars", "Dad!")],
  [line("pip", "Okay, hear me out: what if the next sector is the one?"), line("mars", "You said that last sector."), line("pip", "And I'll say it next sector!")],
];
