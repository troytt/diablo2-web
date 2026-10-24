import type { SkillCostEntry as CanonicalSkillCostEntry } from '../data/canonical-vendor-data.ts';
import { CANONICAL_CHI_TBL_DICT, CANONICAL_ENG_TBL_DICT, resolveTblKey } from '../data/canonical-tbl-strings.ts';
import { resolveNpcMsgIdTblKey } from '../data/canonical-npc-dialog-table.ts';
import { getDefaultTblLang as getTblLang } from '../formats/tbl.ts';

export interface ParsedTxtTable {
  readonly headers: readonly string[];
  readonly colIndex: ReadonlyMap<string, number>;
  readonly rows: readonly string[][];
}

export function parseTxtTable(rawTsv: string): ParsedTxtTable {
  const lines = rawTsv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
  if (nonEmptyLines.length === 0) {
    return { headers: [], colIndex: new Map(), rows: [] };
  }
  const headers = nonEmptyLines[0]!.split('\t').map((h) => h.trim());
  const colIndex = new Map<string, number>();
  headers.forEach((h, i) => {
    if (h && !colIndex.has(h)) {
      colIndex.set(h, i);
    }
  });
  const rows: string[][] = [];
  for (let i = 1; i < nonEmptyLines.length; i++) {
    const cols = nonEmptyLines[i]!.split('\t');
    if (cols[0]?.trim().toLowerCase() === 'expansion') continue;
    rows.push(cols);
  }
  return { headers, colIndex, rows };
}

/**
 * Canonical 1.13c Vendor IDs (0..16) from D2Game.dll (NPC_GetVendorId / sgptDataTables->pItemCache).
 * Note: Index 6 (Hratli) uses column prefix 'Hralti' in Weapons.txt / Armor.txt / Misc.txt!
 */
export const enum VendorNpcId {
  AKARA = 0,
  GHEED = 1,
  CHARSI = 2,
  FARA = 3,
  LYSANDER = 4,
  DROGNAN = 5,
  HRATLI = 6,
  ALKOR = 7,
  ORMUS = 8,
  ELZIX = 9,
  ASHEARA = 10,
  CAIN = 11,
  HALBU = 12,
  JAMELLA = 13,
  MALAH = 14,
  LARZUK = 15,
  DREHYA = 16,
}

export const VENDOR_COUNT = 17;

/**
 * Exact 1.13c column prefixes in Weapons.txt, Armor.txt, and Misc.txt for VendorNpcId 0..16.
 * Note index 6 is 'Hralti' (official Blizzard typo in MPQ tables).
 */
export const VENDOR_COLUMN_PREFIXES: readonly string[] = [
  'Akara',
  'Gheed',
  'Charsi',
  'Fara',
  'Lysander',
  'Drognan',
  'Hralti',
  'Alkor',
  'Ormus',
  'Elzix',
  'Asheara',
  'Cain',
  'Halbu',
  'Jamella',
  'Malah',
  'Larzuk',
  'Drehya',
] as const;

export interface VendorItemColumns {
  readonly min: number;
  readonly max: number;
  readonly magicMin: number;
  readonly magicMax: number;
  readonly magicLvl: number;
}


export interface NpcRecord {
  /** MonStats hcIdx name (e.g. 'akara', 'charsi', 'Warriv2') */
  readonly npc: string;
  /** Sell multiplier (1024-based, when player buys from NPC) */
  readonly sellMult: number;
  /** Buy multiplier (1024-based, when NPC buys from player) */
  readonly buyMult: number;
  /** Repair multiplier (1024-based) */
  readonly repMult: number;
  /** Quest flags (up to 3 quest slots) */
  readonly questFlag: readonly [number, number, number];
  readonly questSellMult: readonly [number, number, number];
  readonly questBuyMult: readonly [number, number, number];
  readonly questRepMult: readonly [number, number, number];
  /** Max gold NPC pays for a single item in Normal / Nightmare / Hell */
  readonly maxBuy: readonly [number, number, number];
}

export class NpcTable {
  private readonly byKey = new Map<string, NpcRecord>();

  constructor(records: NpcRecord[]) {
    for (const rec of records) {
      this.byKey.set(rec.npc.toLowerCase(), rec);
    }
  }

  get(npcKey: string): NpcRecord | undefined {
    return this.byKey.get(npcKey.toLowerCase());
  }

  getByVendorId(vendorId: VendorNpcId): NpcRecord | undefined {
    const key = VENDOR_ID_TO_NPC_TXT_KEY[vendorId];
    return key ? this.byKey.get(key) : undefined;
  }

  get size(): number {
    return this.byKey.size;
  }
}

const VENDOR_ID_TO_NPC_TXT_KEY: Readonly<Record<VendorNpcId, string>> = {
  [VendorNpcId.AKARA]: 'akara',
  [VendorNpcId.GHEED]: 'gheed',
  [VendorNpcId.CHARSI]: 'charsi',
  [VendorNpcId.FARA]: 'fara',
  [VendorNpcId.LYSANDER]: 'lysander',
  [VendorNpcId.DROGNAN]: 'drognan',
  [VendorNpcId.HRATLI]: 'hratli',
  [VendorNpcId.ALKOR]: 'alkor',
  [VendorNpcId.ORMUS]: 'ormus',
  [VendorNpcId.ELZIX]: 'elzix',
  [VendorNpcId.ASHEARA]: 'asheara',
  [VendorNpcId.CAIN]: 'cain1',
  [VendorNpcId.HALBU]: 'halbu',
  [VendorNpcId.JAMELLA]: 'jamella',
  [VendorNpcId.MALAH]: 'malah',
  [VendorNpcId.LARZUK]: 'larzuk',
  [VendorNpcId.DREHYA]: 'drehya',
};

function cellStr(table: ParsedTxtTable, row: string[], col: string): string {
  const idx = table.colIndex.get(col);
  if (idx === undefined) return '';
  return (row[idx] ?? '').trim();
}

function cellNum(table: ParsedTxtTable, row: string[], col: string, fallback = 0): number {
  const raw = cellStr(table, row, col);
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? fallback : n;
}

export function parseNpcTable(rawTsv: string): NpcTable {
  const table = parseTxtTable(rawTsv);
  const records: NpcRecord[] = [];
  for (const row of table.rows) {
    const npc = cellStr(table, row, 'npc');
    if (!npc) continue;
    records.push({
      npc,
      sellMult: cellNum(table, row, 'sell mult', 1024),
      buyMult: cellNum(table, row, 'buy mult', 1024),
      repMult: cellNum(table, row, 'rep mult', 1024),
      questFlag: [
        cellNum(table, row, 'questflag A', 0),
        cellNum(table, row, 'questflag B', 0),
        cellNum(table, row, 'questflag C', 0),
      ],
      questSellMult: [
        cellNum(table, row, 'questsellmult A', 1024),
        cellNum(table, row, 'questsellmult B', 1024),
        cellNum(table, row, 'questsellmult C', 1024),
      ],
      questBuyMult: [
        cellNum(table, row, 'questbuymult A', 1024),
        cellNum(table, row, 'questbuymult B', 1024),
        cellNum(table, row, 'questbuymult C', 1024),
      ],
      questRepMult: [
        cellNum(table, row, 'questrepmult A', 1024),
        cellNum(table, row, 'questrepmult B', 1024),
        cellNum(table, row, 'questrepmult C', 1024),
      ],
      maxBuy: [
        cellNum(table, row, 'max buy', 5000),
        cellNum(table, row, 'max buy (N)', 30000),
        cellNum(table, row, 'max buy (H)', 35000),
      ],
    });
  }
  return new NpcTable(records);
}

/**
 * Parses Gamble.txt and returns the ordered array of gambleable base item codes.
 */
export function parseGambleTable(rawTsv: string): readonly string[] {
  const table = parseTxtTable(rawTsv);
  const codes: string[] = [];
  for (const row of table.rows) {
    const code = cellStr(table, row, 'code');
    if (code) {
      codes.push(code);
    }
  }
  return codes;
}

export interface BookCostRecord {
  readonly name: string;
  readonly scrollSpellCode: string;
  readonly bookSpellCode: string;
  readonly baseCost: number;
  readonly costPerCharge: number;
}

export class BooksTable {
  private readonly byBookCode = new Map<string, BookCostRecord>();

  constructor(records: BookCostRecord[]) {
    for (const rec of records) {
      this.byBookCode.set(rec.bookSpellCode, rec);
    }
  }

  getByBookCode(code: string): BookCostRecord | undefined {
    return this.byBookCode.get(code);
  }
}

export function parseBooksTable(rawTsv: string): BooksTable {
  const table = parseTxtTable(rawTsv);
  const records: BookCostRecord[] = [];
  for (const row of table.rows) {
    const bookSpellCode = cellStr(table, row, 'BookSpellCode');
    if (!bookSpellCode) continue;
    records.push({
      name: cellStr(table, row, 'Name'),
      scrollSpellCode: cellStr(table, row, 'ScrollSpellCode'),
      bookSpellCode,
      baseCost: cellNum(table, row, 'BaseCost', 0),
      costPerCharge: cellNum(table, row, 'CostPerCharge', 0),
    });
  }
  return new BooksTable(records);
}

export function parseLowQualityTable(rawTsv: string): readonly string[] {
  const table = parseTxtTable(rawTsv);
  const names: string[] = [];
  for (const row of table.rows) {
    const name = cellStr(table, row, 'Name');
    if (name) names.push(name);
  }
  return names;
}

export type SkillCostMap = ReadonlyMap<number, CanonicalSkillCostEntry>;

export function buildSkillCostMap(entries: readonly CanonicalSkillCostEntry[]): SkillCostMap {
  const map = new Map<number, CanonicalSkillCostEntry>();
  for (const entry of entries) {
    map.set(entry.id, entry);
  }
  return map;
}

/**
 * Town NPC service descriptor mapping D2 1.13c MonStats hcIdx & town NPC names
 * to their canonical VendorNpcId, Act index (0..4), and available services.
 */
export interface TownNpcServiceDescriptor {
  readonly id: string;
  readonly hcIdx: number;
  readonly npcTxtKey: string;
  readonly displayName: string;
  readonly actIndex: 0 | 1 | 2 | 3 | 4;
  readonly vendorId: VendorNpcId | null;
  readonly canTrade: boolean;
  readonly canRepair: boolean;
  readonly canGamble: boolean;
  readonly canHeal: boolean;
  readonly canIdentify: boolean;
  readonly canTalk?: boolean | undefined;
  readonly canHire?: boolean | undefined;
  /** 1.13c `NPC_ResurrectMerc`: Tyrael (Act 4) can revive the player's mercenary. */
  readonly canResurrectMerc?: boolean | undefined;
  readonly hireBeforeTrade?: boolean | undefined;
  readonly travelActions?: readonly ('travel_east' | 'travel_west' | 'travel_harrogath')[] | undefined;
  readonly questRewardActions?: readonly ('imbue' | 'add_sockets' | 'personalize')[] | undefined;
  readonly greetingKey: string;
  readonly greetingLines: readonly string[];
  readonly gossipLines?: readonly string[] | undefined;
  readonly questLines?: Readonly<Record<string, string>> | undefined;
}

type RawTownNpcServiceDescriptor = Omit<TownNpcServiceDescriptor, 'id' | 'greetingKey'> & {
  readonly id?: string | undefined;
  readonly greetingKey?: string | undefined;
};

const RAW_TOWN_NPC_DESCRIPTORS: readonly RawTownNpcServiceDescriptor[] = [
  // Act 1
  {
    hcIdx: 148,
    npcTxtKey: 'akara',
    displayName: 'Akara',
    actIndex: 0,
    vendorId: VendorNpcId.AKARA,
    canTrade: true,
    canRepair: false,
    canGamble: false,
    canHeal: true,
    canIdentify: false,
    greetingLines: [
      'I am Akara, High Priestess of the Sisterhood of the Sightless Eye.',
      'Welcome back, my friend. We are still clearing the monastery, but you are welcome to rest here.',
    ],
    gossipLines: [
      'The Sisterhood of the Sightless Eye has guarded the eastern pass for generations.',
      'Deckard Cain is the last of the Horadrim; his counsel is priceless if we can rescue him from Tristram.',
    ],
    questLines: {
      den_of_evil: 'There is a place of great evil in the wilderness. Clear the Den of Evil to earn the trust of the Sisters.',
      search_for_cain: 'Take the Scroll of Inifuss and touch the Cairn Stones in the Stony Field to open the portal to Tristram.',
      sisters_to_the_slaughter: 'Andariel, the Maiden of Anguish, occupies our Cathedral. Destroy her so the eastern road may open.',
    },
  },
  {
    hcIdx: 147,
    npcTxtKey: 'gheed',
    displayName: 'Gheed',
    actIndex: 0,
    vendorId: VendorNpcId.GHEED,
    canTrade: true,
    canRepair: false,
    canGamble: true,
    canHeal: false,
    canIdentify: false,
    greetingLines: [
      'Good day to you, partner! I am Gheed, and I can already tell that I will be your best friend in this forsaken camp.',
      'Step right up! Spend some gold or take a chance on a mystery item!',
    ],
    gossipLines: [
      'My wagon is loaded with curiosities from across the western kingdoms.',
      'Once Warriv opens the caravan route east, I plan to make a fortune in Lut Gholein.',
    ],
    questLines: {
      den_of_evil: 'Fewer monsters outside means more customers alive to spend gold at my wagon!',
      sisters_to_the_slaughter: 'Defeat Andariel so Warriv and I can finally get this caravan moving east.',
    },
  },
  {
    hcIdx: 154,
    npcTxtKey: 'charsi',
    displayName: 'Charsi',
    actIndex: 0,
    vendorId: VendorNpcId.CHARSI,
    canTrade: true,
    canRepair: true,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    questRewardActions: ['imbue'],
    greetingLines: [
      'Hi there! I am Charsi, the blacksmith here in camp.',
      'It is good to see some strong adventurers around here. Need your gear forged or repaired?',
    ],
    gossipLines: [
      'When we fled the Monastery, I had to leave the Horadric Malus behind in the Barracks.',
      'Bring me a normal item after recovering the Malus and I will imbue it with magical power.',
    ],
    questLines: {
      tools_of_the_trade: 'If you recover the Horadric Malus from the Smith in the Monastery Barracks, I will imbue an item for you.',
      sisters_to_the_slaughter: 'Please help us reclaim our Monastery from Andariel.',
    },
  },
  {
    hcIdx: 146,
    npcTxtKey: 'cain1',
    displayName: 'Deckard Cain',
    actIndex: 0,
    vendorId: VendorNpcId.CAIN,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: true,
    greetingLines: [
      'Stay awhile and listen!',
      'Bring me any unidentified items you have found, and I shall reveal their hidden properties.',
    ],
    gossipLines: [
      'Diablo, the Lord of Terror, has awakened and marches eastward toward Aranoch.',
      'As the last of the Horadrim, I will identify your items without charge for rescuing me from Tristram.',
    ],
    questLines: {
      search_for_cain: 'Thank you for freeing me from Griswold and the burning ruins of Tristram.',
      sisters_to_the_slaughter: 'Andariel blocks the pass to the East in Diablo\'s name. She must be vanquished.',
    },
  },
  {
    hcIdx: 265,
    npcTxtKey: 'cain5',
    displayName: 'Deckard Cain',
    actIndex: 0,
    vendorId: VendorNpcId.CAIN,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: true,
    greetingLines: [
      'Stay awhile and listen!',
      'Thank you for rescuing me from Tristram. Let me identify your items.',
    ],
    gossipLines: [
      'The Dark Wanderer who passed through Tristram was none other than Diablo himself.',
    ],
    questLines: {
      search_for_cain: 'You have saved my life in Tristram; my Horadric lore is yours to command.',
      sisters_to_the_slaughter: 'Seek out Andariel in the Catacombs beneath the Cathedral.',
    },
  },
  // Act 2
  {
    hcIdx: 178,
    npcTxtKey: 'fara',
    displayName: 'Fara',
    actIndex: 1,
    vendorId: VendorNpcId.FARA,
    canTrade: true,
    canRepair: true,
    canGamble: false,
    canHeal: true,
    canIdentify: false,
    greetingLines: [
      'Greetings, wanderer. I am Fara. I was once a paladin of the Zakarum in the eastern lands.',
      'Now I ply my trade as a smith and healer here in Lut Gholein.',
    ],
    gossipLines: [
      'I trained with the Zakarum paladins before settling in Lut Gholein to forge armor and heal the wounded.',
    ],
    questLines: {
      radaments_lair: 'A foul creature named Radament lurks in the Sewers beneath our city.',
      tainted_sun: 'This unnatural eclipse is the work of Claw Vipers in the desert temple.',
    },
  },
  {
    hcIdx: 202,
    npcTxtKey: 'lysander',
    displayName: 'Lysander',
    actIndex: 1,
    vendorId: VendorNpcId.LYSANDER,
    canTrade: true,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    greetingLines: [
      'What do you want? Speak up! Mixing potions can be hazardous to one\'s hearing.',
      'Buy a potion or move along before something explodes!',
    ],
    gossipLines: [
      'Alchemical reagents from the desert are volatile—handle my potions with care!',
    ],
    questLines: {
      tainted_sun: 'Even my alchemical lamps cannot pierce this cursed darkness over the desert.',
      horadric_staff: 'Only the Horadric Cube can fuse the Staff of Kings and the Viper Amulet.',
    },
  },
  {
    hcIdx: 177,
    npcTxtKey: 'drognan',
    displayName: 'Drognan',
    actIndex: 1,
    vendorId: VendorNpcId.DROGNAN,
    canTrade: true,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    greetingLines: [
      'Indeed, dark times have come to Lut Gholein.',
      'If you seek arcane knowledge, wands, or staves, examine my wares.',
    ],
    gossipLines: [
      'Ancient Vizjerei scrolls speak of Tal Rasha\'s tomb hidden deep in the Canyon of the Magi.',
    ],
    questLines: {
      tainted_sun: 'Destroy the Claw Viper altar in the Temple of the Claw Vipers to restore the sun.',
      arcane_sanctuary: 'Search beneath the Palace for Horazon\'s Arcane Sanctuary and find the true symbol of Tal Rasha\'s Tomb.',
    },
  },
  {
    hcIdx: 199,
    npcTxtKey: 'elzix',
    displayName: 'Elzix',
    actIndex: 1,
    vendorId: VendorNpcId.ELZIX,
    canTrade: true,
    canRepair: false,
    canGamble: true,
    canHeal: false,
    canIdentify: false,
    greetingLines: [
      'Glad to meet you, traveler. I am Elzix, innkeeper and merchant.',
      'In my youth I was a bandit in the desert. Care to trade or test your luck?',
    ],
    gossipLines: [
      'Every desert caravan eventually passes through my inn. If you have gold, I have rare goods to gamble.',
    ],
    questLines: {
      radaments_lair: 'Atma grieves for her family slain by the horror in the Sewers.',
      horadric_staff: 'The Halls of the Dead and the Maggot Lair hold the pieces of the Horadric Staff.',
    },
  },
  {
    hcIdx: 244,
    npcTxtKey: 'cain2',
    displayName: 'Deckard Cain',
    actIndex: 1,
    vendorId: VendorNpcId.CAIN,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: true,
    greetingLines: [
      'Stay awhile and listen!',
      'The Horadric mysteries run deep in Lut Gholein. Let me identify your artifacts.',
    ],
    gossipLines: [
      'The Horadric Cube is one of the greatest treasures ever crafted by our order.',
    ],
    questLines: {
      horadric_staff: 'Combine the Shaft of the Horadric Staff with the headpiece inside the Horadric Cube.',
      seven_tombs: 'Place the completed Horadric Staff into the orifice inside Tal Rasha\'s true tomb.',
    },
  },
  // Act 3
  {
    hcIdx: 253,
    npcTxtKey: 'hratli',
    displayName: 'Hratli',
    actIndex: 2,
    vendorId: VendorNpcId.HRATLI,
    canTrade: true,
    canRepair: true,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    greetingLines: [
      'Welcome, stranger. I am Hratli, a sorcerer and smith.',
      'My enchantments keep these docks safe, and my anvil keeps your blades sharp.',
    ],
    gossipLines: [
      'I wove a protective ward around the Kurast Docks, though it weakens each day.',
    ],
    questLines: {
      blade_of_the_old_religion: 'The Gidbinn is a sacred dagger that can strengthen the enchantment protecting our docks.',
    },
  },
  {
    hcIdx: 254,
    npcTxtKey: 'alkor',
    displayName: 'Alkor',
    actIndex: 2,
    vendorId: VendorNpcId.ALKOR,
    canTrade: true,
    canRepair: false,
    canGamble: true,
    canHeal: false,
    canIdentify: false,
    greetingLines: [
      'Oh, great. Another interrupting adventurer.',
      'If you want potions or wish to gamble away your coin, make it quick.',
    ],
    gossipLines: [
      'From the ashes of Ku Y\'leh I can brew an elixir of permanent vitality—if you bring me the Jade Figurine.',
    ],
    questLines: {
      golden_bird: 'Bring me the Golden Bird of Ku Y\'leh and I shall distil a potion of life for you.',
      lam_esens_tome: 'Somewhere in the ruined temples of Kurast lies Lam Esen\'s Tome.',
    },
  },
  {
    hcIdx: 255,
    npcTxtKey: 'ormus',
    displayName: 'Ormus',
    actIndex: 2,
    vendorId: VendorNpcId.ORMUS,
    canTrade: true,
    canRepair: false,
    canGamble: false,
    canHeal: true,
    canIdentify: false,
    greetingLines: [
      'You now speak to Ormus. He was once a great mage, but now lives like a rat in a sinking vessel.',
      'Ormus can heal your wounds and trade mystic garments.',
    ],
    gossipLines: [
      'Ormus always speaks of himself in the third person, for the jungle has taken much from him.',
    ],
    questLines: {
      blade_of_the_old_religion: 'Return the Gidbinn to Ormus so the Skatsim protective ward may endure.',
      the_blackened_temple: 'The High Council of Zakarum in Travincal has fallen under Mephisto\'s sway.',
    },
  },
  {
    hcIdx: 252,
    npcTxtKey: 'asheara',
    displayName: 'Asheara',
    actIndex: 2,
    vendorId: VendorNpcId.ASHEARA,
    canTrade: true,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    canHire: true,
    hireBeforeTrade: true,
    greetingLines: [
      'Greetings. I am Asheara, commander of the Iron Wolves.',
      'Browse my weapons and armor if you are heading into the jungle.',
    ],
    gossipLines: [
      'My Iron Wolves are battle-mages trained in fire, ice, and lightning.',
    ],
    questLines: {
      blade_of_the_old_religion: 'Recovering the Gidbinn has inspired my Iron Wolves to fight alongside you.',
    },
  },
  {
    hcIdx: 245,
    npcTxtKey: 'cain3',
    displayName: 'Deckard Cain',
    actIndex: 2,
    vendorId: VendorNpcId.CAIN,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: true,
    greetingLines: [
      'Stay awhile and listen!',
      'Mephisto\'s corruption has twisted Kurast. Show me any relics you have uncovered.',
    ],
    gossipLines: [
      'Only by smashing the Compelling Orb with Khalim\'s Will can you enter the Durance of Hate.',
    ],
    questLines: {
      khalims_will: 'Transmute Khalim\'s Eye, Brain, Heart, and Flail in the Horadric Cube to forge Khalim\'s Will.',
      the_guardian: 'Defeat Mephisto in the Durance of Hate and step through the portal to the Pandemonium Fortress.',
    },
  },
  // Act 4
  {
    hcIdx: 257,
    npcTxtKey: 'halbu',
    displayName: 'Halbu',
    actIndex: 3,
    vendorId: VendorNpcId.HALBU,
    canTrade: true,
    canRepair: true,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    canTalk: false,
    greetingLines: [
      'Keep your weapons ready and your armor mended, mortal.',
    ],
    gossipLines: [
      'The forge of the Pandemonium Fortress burns with celestial fire.',
    ],
    questLines: {
      hellforge: 'Take Mephisto\'s Soulstone to the Hellforge and shatter it with the Hellforge Hammer.',
    },
  },
  {
    hcIdx: 405,
    npcTxtKey: 'jamella',
    displayName: 'Jamella',
    actIndex: 3,
    vendorId: VendorNpcId.JAMELLA,
    canTrade: true,
    canRepair: false,
    canGamble: true,
    canHeal: true,
    canIdentify: false,
    canTalk: false,
    greetingLines: [
      'The Light blesses you, hero. Let me restore your strength and offer my sacred wares.',
    ],
    gossipLines: [
      'The High Heavens watch over your struggle against the Prime Evils.',
    ],
    questLines: {
      the_fallen_angel: 'Free Izual\'s tormented spirit on the Plains of Despair.',
      terrors_end: 'Open the five seals in the Chaos Sanctuary and vanquish Diablo.',
    },
  },
  {
    hcIdx: 246,
    npcTxtKey: 'cain4',
    displayName: 'Deckard Cain',
    actIndex: 3,
    vendorId: VendorNpcId.CAIN,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: true,
    greetingLines: [
      'Stay awhile and listen!',
      'Even at the gates of Hell, Horadric wisdom shall guide us.',
    ],
    gossipLines: [
      'We stand inside the Pandemonium Fortress on the threshold of the Burning Hells.',
    ],
    questLines: {
      hellforge: 'Destroy Mephisto\'s Soulstone upon the Hellforge so his spirit is banished forever.',
      terrors_end: 'Diablo awaits within the Chaos Sanctuary.',
    },
  },
  // Act 5
  {
    hcIdx: 513,
    npcTxtKey: 'malah',
    displayName: 'Malah',
    actIndex: 4,
    vendorId: VendorNpcId.MALAH,
    canTrade: true,
    canRepair: false,
    canGamble: false,
    canHeal: true,
    canIdentify: false,
    greetingLines: [
      'Welcome to Harrogath, traveler. I am Malah, healer of this besieged fortress.',
      'Let me tend to your wounds or supply you with potions and scrolls.',
    ],
    gossipLines: [
      'Anya vanished after confronting Nihlathak; I fear she is trapped in the Frozen River.',
    ],
    questLines: {
      prison_of_ice: 'Use my thawing potion to free Anya from her icy prison in the Frozen River.',
    },
  },
  {
    hcIdx: 511,
    npcTxtKey: 'larzuk',
    displayName: 'Larzuk',
    actIndex: 4,
    vendorId: VendorNpcId.LARZUK,
    canTrade: true,
    canRepair: true,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    questRewardActions: ['add_sockets'],
    greetingLines: [
      'What are you looking at? Never seen a Barbarian smith before?',
      'Take a look at my steel—finest in all the northern highlands!',
    ],
    gossipLines: [
      'Slay Shenk the Overseer to end the siege, and I will add sockets to any piece of equipment you choose.',
    ],
    questLines: {
      siege_on_harrogath: 'Defeat Shenk the Overseer in the Bloody Foothills and I will socket an item for you.',
    },
  },
  {
    hcIdx: 512,
    npcTxtKey: 'drehya',
    displayName: 'Anya',
    actIndex: 4,
    vendorId: VendorNpcId.DREHYA,
    canTrade: true,
    canRepair: false,
    canGamble: true,
    canHeal: false,
    canIdentify: false,
    questRewardActions: ['personalize'],
    greetingLines: [
      'Thank you for rescuing me from the frozen prison, hero.',
      'Please, browse my wares or test your fortune with a gamble.',
    ],
    gossipLines: [
      'Nihlathak stole the Relic of the Ancients and betrayed Harrogath to Baal.',
    ],
    questLines: {
      prison_of_ice: 'Thank you for freeing me from the Frozen River.',
      betrayal_of_harrogath: 'Stop Nihlathak in the Halls of Vaught, and I will inscribe your name upon an item of your choice.',
    },
  },
  {
    hcIdx: 514,
    npcTxtKey: 'nihlathak',
    displayName: 'Nihlathak',
    actIndex: 4,
    vendorId: VendorNpcId.DREHYA,
    canTrade: false,
    canRepair: false,
    canGamble: true,
    canHeal: false,
    canIdentify: false,
    greetingLines: [
      'Why do you bother me? Harrogath does not need outsiders.',
      'If you insist on wasting your gold, I have some curiosities you can gamble on.',
    ],
    gossipLines: [
      'Harrogath\'s survival requires hard choices that outsiders could never understand.',
    ],
    questLines: {
      siege_on_harrogath: 'Killing Shenk will only anger Baal\'s legions further.',
    },
  },
  {
    hcIdx: 520,
    npcTxtKey: 'cain6',
    displayName: 'Deckard Cain',
    actIndex: 4,
    vendorId: VendorNpcId.CAIN,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: true,
    greetingLines: [
      'Stay awhile and listen!',
      'Mount Arreat holds the Worldstone itself. Let me identify your discoveries.',
    ],
    gossipLines: [
      'If Baal corrupts the Worldstone, the very fabric of Sanctuary will be endangered.',
    ],
    questLines: {
      rite_of_passage: 'Prove your worth to the Ancients at the Arreat Summit to enter the Worldstone Keep.',
      eve_of_destruction: 'Stop Baal in the Worldstone Chamber before the Worldstone is lost.',
    },
  },
  // Non-vendor Town & Quest NPCs (Talk / Heal / Travel / Hire)
  {
    hcIdx: 155,
    npcTxtKey: 'warriv1',
    displayName: 'Warriv',
    actIndex: 0,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    travelActions: ['travel_east'],
    greetingLines: [
      'Greetings, stranger. Once the pass to the East is safe, my caravan will take you to Lut Gholein.',
    ],
    gossipLines: [
      'Andariel\'s demons have blocked the monastery gates and the road to Lut Gholein.',
    ],
    questLines: {
      sisters_to_the_slaughter: 'With Andariel defeated, my caravan is ready to travel east to Lut Gholein whenever you wish.',
    },
  },
  {
    hcIdx: 175,
    npcTxtKey: 'warriv2',
    displayName: 'Warriv',
    actIndex: 1,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    travelActions: ['travel_west'],
    greetingLines: [
      'Good to see you in Lut Gholein. Speak with Jerhyn if you seek passage further east, or travel west with my caravan.',
    ],
    gossipLines: [
      'My caravan can take you back west to the Rogue Encampment at any time.',
    ],
    questLines: {
      seven_tombs: 'Safe travels across the desert sands, my friend.',
    },
  },
  {
    hcIdx: 150,
    npcTxtKey: 'kashya',
    displayName: 'Kashya',
    actIndex: 0,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    canHire: true,
    greetingLines: [
      'My Rogue scouts have suffered heavy losses. Prove your valor in the field, warrior.',
    ],
    gossipLines: [
      'Blood Raven was once one of our finest captains at Tristram before Andariel corrupted her.',
    ],
    questLines: {
      sisters_burial_grounds: 'Destroy Blood Raven in the Burial Grounds and my Rogue archers will gladly serve you.',
    },
  },
  {
    hcIdx: 176,
    npcTxtKey: 'atma',
    displayName: 'Atma',
    actIndex: 1,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: true,
    canIdentify: false,
    greetingLines: [
      'Welcome to my tavern, traveler. Let me tend to your wounds while you rest from the desert sun.',
    ],
    gossipLines: [
      'A desiccated horror in the Sewers took the lives of my husband and son.',
    ],
    questLines: {
      radaments_lair: 'Avenge my family by slaying Radament in the Sewers, and the merchants of Lut Gholein will lower their prices for you.',
    },
  },
  {
    hcIdx: 198,
    npcTxtKey: 'greiz',
    displayName: 'Greiz',
    actIndex: 1,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    canHire: true,
    greetingLines: [
      'My desert mercenaries guard the walls of Lut Gholein day and night.',
    ],
    gossipLines: [
      'If you have the coin, my spear-wielding desert guards are the toughest fighters in Aranoch.',
    ],
    questLines: {
      radaments_lair: 'Hire one of my guards if you plan to venture down into the Sewers.',
    },
  },
  {
    hcIdx: 201,
    npcTxtKey: 'jerhyn',
    displayName: 'Jerhyn',
    actIndex: 1,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    greetingLines: [
      'Welcome to Lut Gholein. Dark forces stir beneath the desert sands.',
    ],
    gossipLines: [
      'Demons have erupted from the Harem beneath my palace; Kaelan will grant you entry once Drognan has spoken with me.',
    ],
    questLines: {
      arcane_sanctuary: 'Enter the Palace cellar to find the portal to Horazon\'s Arcane Sanctuary.',
      seven_tombs: 'You have saved Lut Gholein; I have instructed Meshif to sail you east to Kurast.',
    },
  },
  {
    hcIdx: 331,
    npcTxtKey: 'kaelan',
    displayName: 'Kaelan',
    actIndex: 1,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    greetingLines: [
      'Halt! Nobody enters the Palace without Lord Jerhyn\'s permission.',
    ],
    gossipLines: [
      'The palace guards are on high alert since strange noises began echoing from the Harem below.',
    ],
    questLines: {
      arcane_sanctuary: 'Lord Jerhyn has cleared you to enter the Palace and investigate the cellar.',
    },
  },
  {
    hcIdx: 210,
    npcTxtKey: 'meshif1',
    displayName: 'Meshif',
    actIndex: 1,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    travelActions: ['travel_east'],
    greetingLines: [
      'Ahoy, traveler! My ship is ready to sail across the Twin Seas whenever your quest demands.',
    ],
    gossipLines: [
      'Once Lord Jerhyn gives the word, we can set sail east for the docks of Kurast.',
    ],
    questLines: {
      seven_tombs: 'All hands on deck! Speak the word and we sail east to Kurast.',
    },
  },
  {
    hcIdx: 264,
    npcTxtKey: 'meshif2',
    displayName: 'Meshif',
    actIndex: 2,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    travelActions: ['travel_west'],
    greetingLines: [
      'Welcome back aboard, matey! Say the word if you wish to sail back west to Lut Gholein.',
    ],
    gossipLines: [
      'I collect green jade figurines—if you ever find a Golden Bird statue, I would trade handsomely for it.',
    ],
    questLines: {
      golden_bird: 'A Jade Figurine! Here, take this Golden Bird statue in exchange.',
    },
  },
  {
    hcIdx: 200,
    npcTxtKey: 'geglash',
    displayName: 'Geglash',
    actIndex: 1,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    greetingLines: [
      'What are you looking at? Pour another drink or move along!',
    ],
    gossipLines: [
      'No monster in the desert scares me half as much as running out of ale.',
    ],
    questLines: {
      radaments_lair: 'The Sewers smell even worse than usual lately.',
    },
  },
  {
    hcIdx: 297,
    npcTxtKey: 'natalya',
    displayName: 'Natalya',
    actIndex: 2,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    greetingLines: [
      'Keep your eyes open in the jungle. The Prime Evils are gathering in Travincal.',
    ],
    gossipLines: [
      'My order tracks corrupted mages and demons across Sanctuary.',
    ],
    questLines: {
      the_blackened_temple: 'Strike down the corrupted High Council in Travincal before Mephisto\'s plan succeeds.',
    },
  },
  {
    hcIdx: 251,
    npcTxtKey: 'tyrael1',
    displayName: 'Tyrael',
    actIndex: 1,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    travelActions: [],
    greetingLines: [
      'Well done, mortal. Though Baal is already free, you have prevented Duriel from ambushing others.',
    ],
    gossipLines: [
      'Diablo and Baal have sailed east to Kurast to free their brother Mephisto.',
    ],
    questLines: {
      seven_tombs: 'Return to Lut Gholein and sail east with Meshif to Kurast at once.',
    },
  },
  {
    hcIdx: 408,
    npcTxtKey: 'hadriel',
    displayName: 'Hadriel',
    actIndex: 3,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    greetingLines: [
      'Halt, mortal! Beyond lies the Chaos Sanctuary, stronghold of Diablo himself.',
    ],
    gossipLines: [
      'Five seals guard the Lord of Terror within the Chaos Sanctuary.',
    ],
    questLines: {
      hellforge: 'Ensure Mephisto\'s Soulstone is shattered at the Hellforge.',
      terrors_end: 'Proceed into the Chaos Sanctuary and break the five seals to confront Diablo.',
    },
  },
  {
    hcIdx: 367,
    npcTxtKey: 'tyrael2',
    displayName: 'Tyrael',
    actIndex: 3,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    canResurrectMerc: true,
    travelActions: ['travel_harrogath'],
    greetingLines: [
      'Hail to you, champion. The hour of judgment upon Diablo is at hand.',
    ],
    gossipLines: [
      'Izual was once my most trusted lieutenant before his tragic fall.',
    ],
    questLines: {
      the_fallen_angel: 'Thank you for freeing Izual\'s spirit; accept these two skill points as your reward.',
      terrors_end: 'Diablo is vanquished! Step through my portal to Harrogath to stop Baal at Mount Arreat.',
    },
  },
  {
    hcIdx: 515,
    npcTxtKey: 'qual-kehk',
    displayName: 'Qual-Kehk',
    actIndex: 4,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    canHire: true,
    greetingLines: [
      'Once you free our warriors on the Frigid Highlands, the finest Barbarians will fight by your side.',
    ],
    gossipLines: [
      'As senior elder of Harrogath after Nihlathak, I command our fortress defenses.',
    ],
    questLines: {
      rescue_on_mount_arreat: 'Free the fifteen Barbarian prisoners in the Frigid Highlands and take these runes: Ral, Ort, and Tal.',
    },
  },
  // Additional talk-only NPCs per 1.13c MonStats.txt
  {
    hcIdx: 266,
    npcTxtKey: 'navi',
    displayName: 'Flavie',
    actIndex: 0,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    greetingLines: [
      'Turn back! I can tell that you need more experience to fight safely in the next wilderness.',
    ],
    gossipLines: [
      'Beware! Beyond lies the Cold Plains.',
    ],
  },
  {
    hcIdx: 406,
    npcTxtKey: 'izualghost',
    displayName: 'Izual',
    actIndex: 3,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    greetingLines: [
      'Thank you, hero, for freeing me from this monstrous prison.',
    ],
    gossipLines: [
      'It was I who told Diablo and the Prime Evils how to bind themselves to Soulstones.',
    ],
  },
  {
    hcIdx: 521,
    npcTxtKey: 'tyrael3',
    displayName: 'Tyrael',
    actIndex: 4,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    greetingLines: [
      'I am Tyrael, the Archangel of Justice.',
    ],
    gossipLines: [
      'The Worldstone is corrupted beyond repair. It must be destroyed.',
    ],
  },
  {
    hcIdx: 527,
    npcTxtKey: 'drehyaiced',
    displayName: 'Anya',
    actIndex: 4,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    greetingLines: [
      'Help me... Nihlathak trapped me in this ice!',
    ],
    gossipLines: [
      'Malah gave you a thawing potion... please use it quickly!',
    ],
  },
  {
    hcIdx: 377,
    npcTxtKey: 'act2guard4',
    displayName: 'Palace Guard',
    actIndex: 1,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    greetingLines: [
      'Halt! The palace is forbidden.',
    ],
    gossipLines: [
      'Lord Jerhyn placed us on high alert after demons emerged from below.',
    ],
  },
  {
    hcIdx: 378,
    npcTxtKey: 'act2guard5',
    displayName: 'Palace Guard',
    actIndex: 1,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    greetingLines: [
      'Move along, traveler.',
    ],
    gossipLines: [
      'Keep your weapon sheathed inside the city walls.',
    ],
  },
  {
    hcIdx: 537,
    npcTxtKey: 'ancientstatue1',
    displayName: 'Ancient Statue 1',
    actIndex: 4,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    greetingLines: [
      'We are the spirits of the Nephalem.',
    ],
    gossipLines: [
      'Only the worthy may pass into Mount Arreat.',
    ],
  },
  {
    hcIdx: 538,
    npcTxtKey: 'ancientstatue2',
    displayName: 'Ancient Statue 2',
    actIndex: 4,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    greetingLines: [
      'Only the worthy may pass into Mount Arreat.',
    ],
    gossipLines: [
      'Prepare yourself for the trial of the Ancients.',
    ],
  },
  {
    hcIdx: 539,
    npcTxtKey: 'ancientstatue3',
    displayName: 'Ancient Statue 3',
    actIndex: 4,
    vendorId: null,
    canTrade: false,
    canRepair: false,
    canGamble: false,
    canHeal: false,
    canIdentify: false,
    greetingLines: [
      'Prepare yourself for the trial!',
    ],
    gossipLines: [
      'May Bul-Kathos guide your blade.',
    ],
  },
];

export interface NpcDialogueLookupOptions {
  readonly topic?: 'intro' | 'gossip' | 'quest' | string | undefined;
  readonly gossipIndex?: number | undefined;
  readonly questStringId?: number | undefined;
  readonly lang?: 'CHI' | 'ENG' | undefined;
  readonly raw?: boolean | undefined;
}

export function stripTblAudioIndex(text: string): string {
  return text.replace(/^\s*\d+\r?\n/, '');
}

export const NPC_CANONICAL_INTRO_KEYS: Readonly<Record<string, string>> = {
  akara: 'AkaraIntroGossip1',
  gheed: 'GheedIntroGossip1',
  charsi: 'CharsiIntroGossip1',
  cain: 'A1Q4RescuedByHeroCain',
  cain1: 'A1Q4RescuedByHeroCain',
  cain2: 'CainAct2Gossip1',
  cain3: 'CainAct3IntroGossip1',
  cain4: 'CainAct4IntroGossip1',
  cain5: 'A1Q4RescuedByHeroCain',
  cain6: 'CainAct5IntroGossip1',
  warriv: 'WarrivAct1IntroGossip1',
  warriv1: 'WarrivAct1IntroGossip1',
  warriv2: 'WarrivAct2IntroGossip1',
  kashya: 'KashyaIntroGossip1',
  navi: 'RogueSignpostGossip1',
  flavie: 'RogueSignpostGossip1',
  fara: 'FaraIntroGossip1',
  lysander: 'LysanderIntroGossip1',
  drognan: 'DrognanIntroGossip1',
  elzix: 'ElzixIntroGossip1',
  atma: 'AtmaIntroGossip1',
  greiz: 'GriezIntroGossip1',
  jerhyn: 'JerhynIntroGossip1',
  kaelan: 'PalaceGuardGossip1',
  act2guard2: 'PalaceGuardGossip1',
  act2guard4: 'PalaceGuardGossip1',
  act2guard5: 'PalaceGuardGossip5',
  meshif: 'MeshifIntroGossip1',
  meshif1: 'MeshifIntroGossip1',
  meshif2: 'MeshifAct3IntroGossip1',
  geglash: 'GeglashIntroGossip1',
  hratli: 'HratliActIntroGossip1',
  alkor: 'AlkorIntroGossip1',
  ormus: 'OrmusIntroGossip1',
  asheara: 'AshearaIntroGossip1',
  natalya: 'NatalyaIntroGossip1',
  hadriel: 'HellsAngelGossip1',
  malachai: 'HellsAngelGossip1',
  izual: 'A4Q1SuccessfulIzual',
  izualghost: 'A4Q1SuccessfulIzual',
  tyrael: 'TyraelActIntroGossip1',
  tyrael1: 'TyraelGossip1',
  tyrael2: 'TyraelActIntroGossip1',
  tyrael3: 'A5Q6SuccessfulTyrael',
  malah: 'MalahAct5IntroGossip1',
  larzuk: 'LarzukAct5IntroGossip1',
  drehya: 'AnyaAct5IntroGossip1',
  drehyaiced: 'A5Q3FoundAnyaAnya',
  anya: 'AnyaAct5IntroGossip1',
  nihlathak: 'NihlathakAct5IntroGossip1',
  'qual-kehk': 'QualKehkAct5IntroGossip1',
  qualkehk: 'QualKehkAct5IntroGossip1',
  ancientstatue1: 'AncientsAct5IntroGossip1',
  ancientstatue2: 'AncientsAct5IntroGossip1',
  ancientstatue3: 'AncientsAct5IntroGossip1',
};

export const NPC_CANONICAL_GOSSIP_KEYS: Readonly<Record<string, readonly string[]>> = {
  akara: [
    'AkaraGossip1',
    'AkaraGossip2',
    'AkaraGossip3',
    'AkaraGossip4',
    'AkaraGossip5',
    'AkaraGossip6',
    'AkaraGossip7',
    'AkaraGossip8',
    'AkaraGossip9',
    'AkaraGossip10',
    'AkaraGossip11',
  ],
  gheed: [
    'GheedGossip1',
    'GheedGossip2',
    'GheedGossip3',
    'GheedGossip4',
    'GheedGossip5',
    'GheedGossip6',
    'GheedGossip7',
  ],
  charsi: [
    'CharsiGossip1',
    'CharsiGossip2',
    'CharsiGossip3',
    'CharsiGossip4',
    'CharsiGossip5',
    'CharsiGossip6',
    'CharsiGossip7',
  ],
  cain: ['CainGossip1', 'CainGossip2', 'CainGossip3', 'CainGossip4', 'CainGossip5'],
  cain1: ['CainGossip1', 'CainGossip2', 'CainGossip3', 'CainGossip4', 'CainGossip5'],
  cain2: [
    'CainAct2Gossip1',
    'CainAct2Gossip2',
    'CainAct2Gossip3',
    'CainAct2Gossip4',
    'CainAct2Gossip5',
  ],
  cain3: [
    'CainAct3Gossip1',
    'CainAct3Gossip2',
    'CainAct3Gossip3',
    'CainAct3Gossip4',
    'CainAct3Gossip5',
    'CainAct3Gossip6',
  ],
  cain4: ['CainAct4Gossip1'],
  cain5: ['CainGossip1', 'CainGossip2', 'CainGossip3', 'CainGossip4', 'CainGossip5'],
  cain6: [
    'CainAct5Gossip1',
    'CainAct5Gossip2',
    'CainAct5Gossip3',
    'CainAct5Gossip4',
    'CainAct5Gossip5',
    'CainAct5Gossip6',
    'CainAct5Gossip7',
    'CainAct5Gossip8',
    'CainAct5Gossip9',
    'CainAct5Gossip10',
  ],
  warriv: [
    'WarrivGossip1',
    'WarrivGossip2',
    'WarrivGossip3',
    'WarrivGossip4',
    'WarrivGossip5',
    'WarrivGossip6',
    'WarrivGossip7',
    'WarrivGossip8',
    'WarrivGossip9',
  ],
  warriv1: [
    'WarrivGossip1',
    'WarrivGossip2',
    'WarrivGossip3',
    'WarrivGossip4',
    'WarrivGossip5',
    'WarrivGossip6',
    'WarrivGossip7',
    'WarrivGossip8',
    'WarrivGossip9',
  ],
  warriv2: [
    'WarrivAct2Gossip1',
    'WarrivAct2Gossip2',
    'WarrivAct2Gossip3',
    'WarrivAct2Gossip4',
    'WarrivAct2Gossip5',
  ],
  kashya: [
    'KashyaGossip1',
    'KashyaGossip2',
    'KashyaGossip3',
    'KashyaGossip4',
    'KashyaGossip5',
    'KashyaGossip6',
    'KashyaGossip7',
    'KashyaGossip8',
    'KashyaGossip9',
    'KashyaGossip10',
  ],
  navi: [
    'RogueSignpostGossip1',
    'RogueSignpostGossip2',
    'RogueSignpostGossip3',
    'RogueSignpostGossip4',
    'RogueSignpostGossip5',
  ],
  flavie: [
    'RogueSignpostGossip1',
    'RogueSignpostGossip2',
    'RogueSignpostGossip3',
    'RogueSignpostGossip4',
    'RogueSignpostGossip5',
  ],
  fara: [
    'FaraGossip1',
    'FaraGossip2',
    'FaraGossip3',
    'FaraGossip4',
    'FaraGossip5',
    'FaraGossip6',
    'FaraGossip7',
    'FaraGossip8',
    'FaraGossip9',
  ],
  lysander: [
    'LysanderGossip1',
    'LysanderGossip2',
    'LysanderGossip3',
    'LysanderGossip4',
    'LysanderGossip5',
    'LysanderGossip6',
    'LysanderGossip7',
    'LysanderGossip8',
    'LysanderGossip9',
    'LysanderGossip10',
  ],
  drognan: [
    'DrognanGossip1',
    'DrognanGossip2',
    'DrognanGossip3',
    'DrognanGossip4',
    'DrognanGossip5',
    'DrognanGossip6',
    'DrognanGossip7',
    'DrognanGossip8',
    'DrognanGossip9',
    'DrognanGossip10',
  ],
  elzix: [
    'ElzixGossip1',
    'ElzixGossip2',
    'ElzixGossip3',
    'ElzixGossip4',
    'ElzixGossip5',
    'ElzixGossip6',
    'ElzixGossip7',
    'ElzixGossip8',
    'ElzixGossip9',
    'ElzixGossip10',
  ],
  atma: [
    'AtmaGossip1',
    'AtmaGossip2',
    'AtmaGossip3',
    'AtmaGossip4',
    'AtmaGossip5',
    'AtmaGossip6',
    'AtmaGossip7',
    'AtmaGossip8',
  ],
  greiz: [
    'GriezGossip1',
    'GriezGossip2',
    'GriezGossip3',
    'GriezGossip4',
    'GriezGossip5',
    'GriezGossip6',
    'GriezGossip7',
    'GriezGossip8',
    'GriezGossip9',
    'GriezGossip10',
    'GriezGossip11',
    'GriezGossip12',
  ],
  jerhyn: [
    'JerhynGossip1',
    'JerhynGossip2',
    'JerhynGossip3',
    'JerhynGossip4',
    'JerhynGossip5',
    'JerhynGossip6',
    'JerhynGossip7',
  ],
  kaelan: [
    'PalaceGuardGossip1',
    'PalaceGuardGossip2',
    'PalaceGuardGossip3',
    'PalaceGuardGossip4',
    'PalaceGuardGossip5',
  ],
  act2guard2: [
    'PalaceGuardGossip1',
    'PalaceGuardGossip2',
    'PalaceGuardGossip3',
    'PalaceGuardGossip4',
    'PalaceGuardGossip5',
  ],
  act2guard4: [
    'PalaceGuardGossip1',
    'PalaceGuardGossip2',
    'PalaceGuardGossip3',
    'PalaceGuardGossip4',
    'PalaceGuardGossip5',
  ],
  act2guard5: [
    'PalaceGuardGossip5',
    'PalaceGuardGossip1',
    'PalaceGuardGossip2',
    'PalaceGuardGossip3',
    'PalaceGuardGossip4',
  ],
  meshif: [
    'MeshifGossip1',
    'MeshifGossip2',
    'MeshifGossip3',
    'MeshifGossip4',
    'MeshifGossip5',
    'MeshifGossip6',
    'MeshifGossip7',
    'MeshifGossip8',
    'MeshifGossip9',
    'MeshifGossip10',
  ],
  meshif1: [
    'MeshifGossip1',
    'MeshifGossip2',
    'MeshifGossip3',
    'MeshifGossip4',
    'MeshifGossip5',
    'MeshifGossip6',
    'MeshifGossip7',
    'MeshifGossip8',
    'MeshifGossip9',
    'MeshifGossip10',
  ],
  meshif2: [
    'MeshifAct3Gossip1',
    'MeshifAct3Gossip2',
    'MeshifAct3Gossip3',
    'MeshifAct3Gossip4',
    'MeshifAct3Gossip5',
    'MeshifAct3Gossip6',
    'MeshifAct3Gossip7',
    'MeshifAct3Gossip8',
    'MeshifAct3Gossip9',
    'MeshifAct3Gossip10',
  ],
  geglash: [
    'GeglashGossip1',
    'GeglashGossip2',
    'GeglashGossip3',
    'GeglashGossip4',
    'GeglashGossip5',
    'GeglashGossip6',
    'GeglashGossip7',
    'GeglashGossip8',
    'GeglashGossip9',
  ],
  hratli: [
    'HratliGossip1',
    'HratliGossip2',
    'HratliGossip3',
    'HratliGossip4',
    'HratliGossip5',
    'HratliGossip6',
    'HratliGossip7',
    'HratliGossip8',
    'HratliGossip9',
    'HratliGossip10',
    'HratliGossip11',
  ],
  alkor: [
    'AlkorGossip1',
    'AlkorGossip2',
    'AlkorGossip3',
    'AlkorGossip4',
    'AlkorGossip6',
    'AlkorGossip7',
    'AlkorGossip8',
    'AlkorGossip9',
    'AlkorGossip10',
    'AlkorGossip11',
  ],
  ormus: [
    'OrmusGossip1',
    'OrmusGossip2',
    'OrmusGossip3',
    'OrmusGossip4',
    'OrmusGossip5',
    'OrmusGossip6',
    'OrmusGossip7',
    'OrmusGossip8',
    'OrmusGossip9',
    'OrmusGossip10',
    'OrmusGossip11',
  ],
  asheara: [
    'AshearaGossip1',
    'AshearaGossip2',
    'AshearaGossip3',
    'AshearaGossip4',
    'AshearaGossip5',
    'AshearaGossip6',
    'AshearaGossip7',
    'AshearaGossip8',
    'AshearaGossip9',
  ],
  natalya: ['NatalyaGossip1', 'NatalyaGossip2', 'NatalyaGossip3', 'NatalyaGossip4'],
  hadriel: ['HellsAngelGossip1', 'HellsAngelGossip2'],
  malachai: ['HellsAngelGossip1', 'HellsAngelGossip2'],
  izual: ['A4Q1SuccessfulIzual'],
  izualghost: ['A4Q1SuccessfulIzual'],
  tyrael: ['TyraelAct4Gossip1', 'TyraelGossip1'],
  tyrael1: ['TyraelGossip1'],
  tyrael2: ['TyraelAct4Gossip1'],
  tyrael3: ['A5Q6SuccessfulTyrael'],
  malah: [
    'MalahGossip1',
    'MalahGossip2',
    'MalahGossip3',
    'MalahGossip4',
    'MalahGossip5',
    'MalahGossip6',
    'MalahGossip7',
    'MalahGossip8',
    'MalahGossip9',
    'MalahGossip10',
    'MalahGossip11',
    'MalahGossip12',
    'MalahGossip13',
  ],
  larzuk: [
    'LarzukGossip1',
    'LarzukGossip2',
    'LarzukGossip3',
    'LarzukGossip4',
    'LarzukGossip5',
    'LarzukGossip6',
    'LarzukGossip7',
    'LarzukGossip8',
    'LarzukGossip9',
    'LarzukGossip10',
  ],
  drehya: [
    'AnyaGossip1',
    'AnyaGossip2',
    'AnyaGossip3',
    'AnyaGossip4',
    'AnyaGossip5',
    'AnyaGossip6',
    'AnyaGossip7',
    'AnyaGossip8',
    'AnyaGossip9',
    'AnyaGossip10',
  ],
  drehyaiced: ['A5Q3FoundAnyaAnya', 'AnyaGossip1'],
  anya: [
    'AnyaGossip1',
    'AnyaGossip2',
    'AnyaGossip3',
    'AnyaGossip4',
    'AnyaGossip5',
    'AnyaGossip6',
    'AnyaGossip7',
    'AnyaGossip8',
    'AnyaGossip9',
    'AnyaGossip10',
  ],
  nihlathak: [
    'NihlathakGossip1',
    'NihlathakGossip2',
    'NihlathakGossip3',
    'NihlathakGossip4',
    'NihlathakGossip5',
    'NihlathakGossip6',
    'NihlathakGossip7',
    'NihlathakGossip8',
    'NihlathakGossip9',
  ],
  'qual-kehk': [
    'QualKehkGossip1',
    'QualKehkGossip2',
    'QualKehkGossip3',
    'QualKehkGossip4',
    'QualKehkGossip5',
    'QualKehkGossip6',
    'QualKehkGossip7',
    'QualKehkGossip8',
    'QualKehkGossip9',
  ],
  qualkehk: [
    'QualKehkGossip1',
    'QualKehkGossip2',
    'QualKehkGossip3',
    'QualKehkGossip4',
    'QualKehkGossip5',
    'QualKehkGossip6',
    'QualKehkGossip7',
    'QualKehkGossip8',
    'QualKehkGossip9',
  ],
  ancientstatue1: ['AncientsAct5IntroGossip1', 'A5Q6InitAncients'],
  ancientstatue2: ['AncientsAct5IntroGossip1', 'A5Q6InitAncients'],
  ancientstatue3: ['AncientsAct5IntroGossip1', 'A5Q6InitAncients'],
};

const NPC_CHI_FALLBACK_DIALOGUE: Readonly<
  Record<string, { readonly intro: readonly string[]; readonly gossip: readonly string[] }>
> = {
  halbu: {
    intro: ['站住，凡人。這座神聖熔爐在天界的監督下運轉。', '若要在混沌避難所作戰，先讓你的鋼鐵做好準備。'],
    gossip: ['地獄熔爐深藏在火焰之河；唯有在墨菲斯托的靈魂之石被粉碎之前，它的火焰才會為凡人燃燒。'],
  },
  jamella: {
    intro: ['願聖光庇佑你，英雄。你的傷勢已經痊癒。', '只要群魔堡壘屹立不搖，我的聖殿就向你敞開。'],
    gossip: ['墮落天使衣卒爾曾是泰瑞爾最信任的副官，直到他率領對地獄熔爐的突襲並遭到腐化。'],
  },
};

const DESCRIPTOR_BY_HCIDX = new Map<number, TownNpcServiceDescriptor>();
const DESCRIPTOR_BY_NAME = new Map<string, TownNpcServiceDescriptor>();

export function resolveNpcDialogueTblText(
  npcOrKey: TownNpcServiceDescriptor | number | string,
  topicOrOptions?: 'intro' | 'gossip' | 'quest' | string | NpcDialogueLookupOptions,
  langArg?: 'CHI' | 'ENG',
): string | undefined {
  const options: NpcDialogueLookupOptions =
    typeof topicOrOptions === 'object' && topicOrOptions !== null
      ? topicOrOptions
      : {
          topic: typeof topicOrOptions === 'string' ? topicOrOptions : undefined,
          lang: langArg,
        };

  const lang = options.lang ?? langArg ?? getTblLang();
  const raw = Boolean(options.raw);

  // 1. Direct string table key lookup (e.g. 'AkaraIntroGossip1', 'A1Q1InitAkara').
  // Skip direct lookup when npcOrKey is a known NPC identifier (e.g. 'hratli', 'alkor',
  // 'ormus', 'asheara', 'halbu', 'navi', 'tyrael') whose lowercase key also exists in
  // string.tbl as a 1-word monster name entry.
  if (typeof npcOrKey === 'string') {
    const trimmed = npcOrKey.trim();
    const lower = trimmed.toLowerCase();
    const isNpcIdentifier =
      getTownNpcDescriptorByName(trimmed) !== undefined ||
      NPC_CANONICAL_INTRO_KEYS[lower] !== undefined ||
      NPC_CANONICAL_GOSSIP_KEYS[lower] !== undefined;
    if (!isNpcIdentifier) {
      const directEng = CANONICAL_ENG_TBL_DICT[npcOrKey] ?? CANONICAL_ENG_TBL_DICT[trimmed];
      const directChi = CANONICAL_CHI_TBL_DICT[npcOrKey] ?? CANONICAL_CHI_TBL_DICT[trimmed];
      if (directEng !== undefined || directChi !== undefined) {
        const val = lang === 'ENG' ? directEng : (directChi ?? directEng);
        if (val !== undefined) {
          return raw ? val : stripTblAudioIndex(val);
        }
      }
    }
  }

  // 2. Resolve descriptor and lookup key
  let desc: TownNpcServiceDescriptor | undefined;
  let npcLookupKey: string;
  if (typeof npcOrKey === 'object' && npcOrKey !== null) {
    desc = npcOrKey;
    npcLookupKey = desc.npcTxtKey.toLowerCase();
  } else if (typeof npcOrKey === 'number') {
    desc = getTownNpcDescriptorByHcIdx(npcOrKey);
    npcLookupKey = desc ? desc.npcTxtKey.toLowerCase() : String(npcOrKey);
  } else {
    desc = getTownNpcDescriptorByName(npcOrKey);
    npcLookupKey = desc ? desc.npcTxtKey.toLowerCase() : npcOrKey.trim().toLowerCase();
  }

  const topic = (options.topic ?? 'intro').toLowerCase();
  let targetTblKey: string | undefined;

  if (topic === 'intro' || topic === 'introduction') {
    targetTblKey =
      desc?.greetingKey && desc.greetingKey !== desc.npcTxtKey
        ? desc.greetingKey
        : NPC_CANONICAL_INTRO_KEYS[npcLookupKey];
  } else if (topic === 'gossip') {
    const list = NPC_CANONICAL_GOSSIP_KEYS[npcLookupKey];
    if (list && list.length > 0) {
      const idx = options.gossipIndex ?? 0;
      targetTblKey = list[idx % list.length];
    }
  } else if (topic.startsWith('gossip:')) {
    const idx = parseInt(topic.slice('gossip:'.length), 10) || 0;
    const list = NPC_CANONICAL_GOSSIP_KEYS[npcLookupKey];
    if (list && list.length > 0) {
      targetTblKey = list[idx % list.length];
    }
  } else if (topic === 'quest' && options.questStringId) {
    targetTblKey = resolveNpcMsgIdTblKey(options.questStringId) ?? `string#${options.questStringId}`;
    if (!CANONICAL_ENG_TBL_DICT[targetTblKey] && !CANONICAL_CHI_TBL_DICT[targetTblKey]) targetTblKey = undefined;
  } else if (topic.startsWith('quest:') || topic.startsWith('talk_quest:')) {
    const qId = parseInt(topic.slice(topic.indexOf(':') + 1), 10);
    if (Number.isFinite(qId) && qId > 0) {
      targetTblKey = resolveNpcMsgIdTblKey(qId) ?? `string#${qId}`;
      if (!CANONICAL_ENG_TBL_DICT[targetTblKey] && !CANONICAL_CHI_TBL_DICT[targetTblKey]) targetTblKey = undefined;
    }
  } else if (desc?.questLines && desc.questLines[topic]) {
    const qKey = desc.questLines[topic];
    if (qKey && (CANONICAL_ENG_TBL_DICT[qKey] || CANONICAL_CHI_TBL_DICT[qKey])) {
      targetTblKey = qKey;
    } else {
      return qKey;
    }
  } else {
    if (CANONICAL_ENG_TBL_DICT[topic] || CANONICAL_CHI_TBL_DICT[topic]) {
      targetTblKey = topic;
    }
  }

  if (targetTblKey) {
    const engVal = CANONICAL_ENG_TBL_DICT[targetTblKey] ?? CANONICAL_ENG_TBL_DICT[targetTblKey.trim()];
    const chiVal = CANONICAL_CHI_TBL_DICT[targetTblKey] ?? CANONICAL_CHI_TBL_DICT[targetTblKey.trim()];
    const val = lang === 'ENG' ? engVal : (chiVal ?? engVal);
    if (val !== undefined) {
      return raw ? val : stripTblAudioIndex(val);
    }
  }

  // 3. Fallback to descriptor strings if tbl key lookup had no match
  if (lang === 'CHI') {
    const chiFallback = NPC_CHI_FALLBACK_DIALOGUE[npcLookupKey];
    if (chiFallback) {
      if (topic === 'intro' || topic === 'introduction') {
        return chiFallback.intro.join('\n');
      }
      if (topic === 'gossip' || topic.startsWith('gossip:')) {
        return chiFallback.gossip.join('\n');
      }
    }
  }
  if (topic === 'intro' || topic === 'introduction') {
    return desc?.greetingLines?.join('\n');
  }
  if (topic === 'gossip' || topic.startsWith('gossip:')) {
    return desc?.gossipLines?.join('\n') ?? desc?.greetingLines?.join('\n');
  }
  return undefined;
}

export const TOWN_NPC_DESCRIPTORS: readonly TownNpcServiceDescriptor[] &
  Readonly<Record<string, TownNpcServiceDescriptor>> = (() => {
  const arr: TownNpcServiceDescriptor[] = RAW_TOWN_NPC_DESCRIPTORS.map(d => {
    const canonicalIntroKey = d.greetingKey ?? NPC_CANONICAL_INTRO_KEYS[d.npcTxtKey.toLowerCase()];
    const greetingKey = canonicalIntroKey ?? d.npcTxtKey;
    const tblGreetings = canonicalIntroKey
      ? resolveNpcDialogueTblText(canonicalIntroKey, { lang: 'ENG' })?.split('\n')
      : undefined;
    const tblGossip = resolveNpcDialogueTblText(d.npcTxtKey, { topic: 'gossip', lang: 'ENG' })?.split('\n');
    return {
      ...d,
      id: d.id ?? d.npcTxtKey,
      greetingKey,
      greetingLines: (tblGreetings && tblGreetings.length > 0) ? tblGreetings : d.greetingLines,
      gossipLines: (tblGossip && tblGossip.length > 0) ? tblGossip : d.gossipLines,
    };
  });
  for (const d of arr) {
    Object.defineProperty(arr, d.npcTxtKey, {
      value: d,
      enumerable: false,
    });
  }
  return Object.freeze(arr) as unknown as readonly TownNpcServiceDescriptor[] &
    Readonly<Record<string, TownNpcServiceDescriptor>>;
})();

const HCIDX_ALIASES: Readonly<Record<number, string>> = {};

export const NPC_HCIDX_TO_DESCRIPTOR_ID: Readonly<Record<number, string>> & {
  get(hcIdx: number): string | undefined;
  has(hcIdx: number): boolean;
} = (() => {
  const rec: Record<number, string> = {};
  for (const d of TOWN_NPC_DESCRIPTORS) {
    rec[d.hcIdx] = d.npcTxtKey;
  }
  for (const [hcIdx, key] of Object.entries(HCIDX_ALIASES)) {
    rec[Number(hcIdx)] = key;
  }
  Object.defineProperties(rec, {
    get: {
      value: (hcIdx: number) => rec[hcIdx],
      enumerable: false,
    },
    has: {
      value: (hcIdx: number) => Object.prototype.hasOwnProperty.call(rec, hcIdx),
      enumerable: false,
    },
  });
  return Object.freeze(rec) as Readonly<Record<number, string>> & {
    get(hcIdx: number): string | undefined;
    has(hcIdx: number): boolean;
  };
})();

export const TOWN_NPC_SERVICES: Readonly<Record<string, TownNpcServiceDescriptor>> = (() => {
  const rec: Record<string, TownNpcServiceDescriptor> = {};
  for (const d of TOWN_NPC_DESCRIPTORS) {
    rec[d.npcTxtKey] = d;
  }
  if (rec.warriv1) {
    rec.warriv = rec.warriv1;
    rec.warriv_act1 = rec.warriv1;
  }
  if (rec.warriv2) {
    rec.warriv_act2 = rec.warriv2;
  }
  if (rec.meshif1) {
    rec.meshif = rec.meshif1;
    rec.meshif_act2 = rec.meshif1;
  }
  if (rec.meshif2) {
    rec.meshif_act3 = rec.meshif2;
  }
  if (rec.tyrael1) {
    rec.tyrael_act2 = rec.tyrael1;
  }
  if (rec.tyrael2) {
    rec.tyrael = rec.tyrael2;
    rec.tyrael_act4 = rec.tyrael2;
  }
  if (rec.tyrael3) {
    rec.tyrael_act5 = rec.tyrael3;
  }
  if (rec['qual-kehk']) {
    rec.qual_kehk = rec['qual-kehk'];
  }
  if (rec.drehya) {
    rec.anya = rec.drehya;
  }
  if (rec.cain1) {
    rec.cain = rec.cain1;
  }
  if (rec.navi) {
    rec.flavie = rec.navi;
  }
  if (rec.kaelan) {
    rec.act2guard2 = rec.kaelan;
  }
  if (rec.hadriel) {
    rec.malachai = rec.hadriel;
  }
  return Object.freeze(rec);
})();

for (const d of TOWN_NPC_DESCRIPTORS) {
  DESCRIPTOR_BY_HCIDX.set(d.hcIdx, d);
  if (!DESCRIPTOR_BY_NAME.has(d.displayName.toLowerCase())) {
    DESCRIPTOR_BY_NAME.set(d.displayName.toLowerCase(), d);
  }
  DESCRIPTOR_BY_NAME.set(d.npcTxtKey.toLowerCase(), d);
}
for (const [hcIdx, key] of Object.entries(HCIDX_ALIASES)) {
  const target = TOWN_NPC_SERVICES[key];
  if (target) {
    DESCRIPTOR_BY_HCIDX.set(Number(hcIdx), target);
  }
}

if (TOWN_NPC_SERVICES.kaelan) {
  DESCRIPTOR_BY_NAME.set('act2guard2', TOWN_NPC_SERVICES.kaelan);
}
if (TOWN_NPC_SERVICES.hadriel) {
  DESCRIPTOR_BY_NAME.set('malachai', TOWN_NPC_SERVICES.hadriel);
}

export function getTownNpcDescriptorByHcIdx(hcIdx: number): TownNpcServiceDescriptor | undefined {
  if (DESCRIPTOR_BY_HCIDX.size === 0) {
    const raw = RAW_TOWN_NPC_DESCRIPTORS.find(d => d.hcIdx === hcIdx);
    return raw as TownNpcServiceDescriptor | undefined;
  }
  return DESCRIPTOR_BY_HCIDX.get(hcIdx);
}

export function isTownNpcHcIdx(hcIdx: number): boolean {
  return DESCRIPTOR_BY_HCIDX.has(hcIdx);
}

export function getTownNpcDescriptorByName(
  name: string,
  actIndex?: number,
): TownNpcServiceDescriptor | undefined {
  const lower = name.trim().toLowerCase();
  if (DESCRIPTOR_BY_NAME.size === 0) {
    const raw = RAW_TOWN_NPC_DESCRIPTORS.find(
      d =>
        d.npcTxtKey.toLowerCase() === lower ||
        d.displayName?.toLowerCase() === lower ||
        (d.id && d.id.toLowerCase() === lower),
    );
    return raw as TownNpcServiceDescriptor | undefined;
  }
  if (actIndex === undefined) {
    const direct = DESCRIPTOR_BY_NAME.get(lower);
    if (direct) return direct;
  }
  if (lower.includes('cain')) {
    const cainMatch = TOWN_NPC_DESCRIPTORS.find(
      d => d.vendorId === VendorNpcId.CAIN && (actIndex === undefined || d.actIndex === actIndex),
    );
    if (cainMatch) return cainMatch;
  }
  return DESCRIPTOR_BY_NAME.get(lower);
}

export function getTownNpcDescriptorByVendorId(
  vendorId: VendorNpcId,
  actIndex?: number,
): TownNpcServiceDescriptor | undefined {
  return TOWN_NPC_DESCRIPTORS.find(
    d => d.vendorId === vendorId && (actIndex === undefined || d.actIndex === actIndex),
  ) ?? TOWN_NPC_DESCRIPTORS.find(d => d.vendorId === vendorId);
}

const NPC_NAME_TBL_KEYS: Readonly<Record<string, string>> = {
  akara: 'Akara',
  gheed: 'Gheed',
  charsi: 'Charsi',
  cain: 'DeckardCain',
  cain1: 'DeckardCain',
  cain2: 'DeckardCain',
  cain3: 'DeckardCain',
  cain4: 'DeckardCain',
  cain5: 'DeckardCain',
  cain6: 'DeckardCain',
  'deckard cain': 'DeckardCain',
  warriv: 'Warriv',
  warriv1: 'Warriv',
  warriv2: 'Warriv',
  kashya: 'Kashya',
  navi: 'navi',
  flavie: 'navi',
  fara: 'Fara',
  lysander: 'Lysander',
  drognan: 'Drognan',
  elzix: 'Elzix',
  atma: 'Atma',
  greiz: 'Greiz',
  jerhyn: 'Jerhyn',
  kaelan: 'Kaelan',
  act2guard2: 'Kaelan',
  meshif: 'Meshif',
  meshif1: 'Meshif',
  meshif2: 'Meshif',
  geglash: 'Geglash',
  hratli: 'hratli',
  alkor: 'alkor',
  ormus: 'ormus',
  asheara: 'asheara',
  natalya: 'Natalya',
  halbu: 'halbu',
  jamella: 'Jamella',
  hadriel: 'Malachai',
  malachai: 'Malachai',
  tyrael: 'tyrael',
  tyrael1: 'tyrael',
  tyrael2: 'tyrael',
  tyrael3: 'tyrael',
  malah: 'Malah',
  larzuk: 'Larzuk',
  drehya: 'Drehya',
  drehyaiced: 'Drehya',
  anya: 'Drehya',
  nihlathak: 'Nihlathak Town',
  'qual-kehk': 'Qual-Kehk',
  qualkehk: 'Qual-Kehk',
  izual: 'Izual',
  izualghost: 'Izual',
  ancientstatue1: 'Ancient Statue 1',
  ancientstatue2: 'Ancient Statue 2',
  ancientstatue3: 'Ancient Statue 3',
  act2guard4: 'Kaelan',
  act2guard5: 'Kaelan',
};

export function getLocalizedNpcName(
  nameOrDesc: TownNpcServiceDescriptor | string,
  lang: 'CHI' | 'ENG' = getTblLang(),
): string {
  const desc = typeof nameOrDesc === 'string' ? getTownNpcDescriptorByName(nameOrDesc) : nameOrDesc;
  const rawKey =
    typeof nameOrDesc === 'string'
      ? nameOrDesc.trim()
      : nameOrDesc.npcTxtKey || nameOrDesc.displayName;
  const lowerKey = rawKey.toLowerCase();
  const fallbackEn =
    desc?.displayName ?? (typeof nameOrDesc === 'string' ? nameOrDesc.trim() : nameOrDesc.displayName);
  const tblKey = NPC_NAME_TBL_KEYS[lowerKey] ?? rawKey;
  return resolveTblKey(tblKey, lang) ?? fallbackEn;
}

export function getNpcDisplayNameByHcIdx(
  hcIdx: number,
  lang?: 'CHI' | 'ENG',
): string | undefined {
  const desc = getTownNpcDescriptorByHcIdx(hcIdx);
  if (!desc) return undefined;
  if (lang !== undefined) {
    return getLocalizedNpcName(desc, lang);
  }
  return desc.displayName;
}

export function getLocalizedNpcGreetings(
  descriptor: TownNpcServiceDescriptor,
  lang: 'CHI' | 'ENG' = getTblLang(),
): readonly string[] {
  const tblText = resolveNpcDialogueTblText(descriptor, 'intro', lang);
  if (tblText && tblText.trim().length > 0) {
    return tblText.split('\n');
  }
  return descriptor.greetingLines;
}

export function getLocalizedNpcGossip(
  descriptor: TownNpcServiceDescriptor,
  lang: 'CHI' | 'ENG' = getTblLang(),
  gossipIndex = 0,
): readonly string[] {
  const tblText = resolveNpcDialogueTblText(descriptor, {
    topic: 'gossip',
    gossipIndex,
    lang,
  });
  if (tblText && tblText.trim().length > 0) {
    return tblText.split('\n');
  }
  return descriptor.gossipLines && descriptor.gossipLines.length > 0
    ? descriptor.gossipLines
    : getLocalizedNpcGreetings(descriptor, lang);
}

export function npcDisplayName(
  nameOrDesc: TownNpcServiceDescriptor | string,
  lang?: 'CHI' | 'ENG',
): string {
  return getLocalizedNpcName(nameOrDesc, lang ?? 'CHI');
}


