/**
 * Diablo II v1.13c Top-Left HUD Portrait & `PetType.txt` Metadata (`Hireables.cpp` & `RosterPets.cpp`).
 *
 * Ground Truth:
 * - `D2Client.dll` `Hireables.cpp` (`0x6fb0b120..0x6fb0c980`):
 *   - 7 player class icons (`0x6fb0b260`): `AmazonIcon`, `SorceressIcon`, `NecromancerIcon`,
 *     `PaladinIcon`, `BarbarianIcon`, `DruidIcon`, `AssassinIcon` (`classId 0..6`).
 *   - 4 hireling icons (`PetType.txt` row `7` `hireable`): `rogueicon` (Act 1 Rogue, `hcIdx 271`),
 *     `act2hireableicon` (Act 2 Desert Merc, `hcIdx 338`), `act3hireableicon` (Act 3 Iron Wolf, `hcIdx 359`),
 *     `barbhirable_icon` (Act 5 Barbarian, `hcIdx 560/561`).
 *   - 18 summoned minion icons (`PetType.txt` rows `2..6, 10..16`, `icontype 1..3`).
 */

export type PortraitIconType = 0 | 1 | 2 | 3

export interface PetSubClassMeta {
  readonly classId: number
  readonly icon: string
  readonly nameEn: string
  readonly nameZh: string
}

export interface PetTypePortraitMeta {
  readonly idx: number
  readonly petType: string
  readonly group: number
  readonly drawHp: boolean
  readonly iconType: PortraitIconType
  readonly baseIcon: string
  readonly nameKey: string
  readonly nameEn: string
  readonly nameZh: string
  readonly subClasses: readonly PetSubClassMeta[]
}

/**
 * All 29 portrait DC6 asset stems in `data/global/ui/Hireables/*.dc6`.
 */
export const CANONICAL_PORTRAIT_DC6_NAMES: readonly string[] = [
  // 7 Player Classes (`0x6fb0b260`)
  'AmazonIcon',
  'SorceressIcon',
  'NecromancerIcon',
  'PaladinIcon',
  'BarbarianIcon',
  'DruidIcon',
  'AssassinIcon',
  // 4 Mercenary / Hireling Classes (`PetType.txt` idx=7)
  'rogueicon',
  'act2hireableicon',
  'act3hireableicon',
  'barbhirable_icon',
  // 18 Summon / Minion Icons (`PetType.txt` idx=2..6, 10..16)
  'valkarieicon',
  'earthgolumicon',
  'bloodgolumicon',
  'metalgolumicon',
  'firegolumicon',
  'skeletonicon',
  'skeletonmageicon',
  'revivedicon',
  'raven',
  'wolf',
  'oaksage',
  'heartofwolverine',
  'spiritofbarbs',
  'plaguepoppy',
  'cycleoflife',
  'vines',
  'bear',
  'shadowassassin',
] as const

/**
 * Player class portrait icon key by `classId` (`0..6`) or class code (`ama..ass`).
 */
export const PLAYER_CLASS_PORTRAIT_BY_ID: Readonly<Record<number, string>> = {
  0: 'AmazonIcon',
  1: 'SorceressIcon',
  2: 'NecromancerIcon',
  3: 'PaladinIcon',
  4: 'BarbarianIcon',
  5: 'DruidIcon',
  6: 'AssassinIcon',
}

export const PLAYER_CLASS_PORTRAIT_BY_CODE: Readonly<Record<string, string>> = {
  ama: 'AmazonIcon',
  sor: 'SorceressIcon',
  nec: 'NecromancerIcon',
  pal: 'PaladinIcon',
  bar: 'BarbarianIcon',
  dru: 'DruidIcon',
  ass: 'AssassinIcon',
}

/**
 * Authoritative 1.13c `PetType.txt` table (`idx 1..19`).
 */
export const PET_TYPE_PORTRAIT_TABLE: Readonly<Record<number, PetTypePortraitMeta>> = {
  2: {
    idx: 2,
    petType: 'valkyrie',
    group: 0,
    drawHp: true,
    iconType: 1,
    baseIcon: 'valkarieicon',
    nameKey: 'Valkyrie',
    nameEn: 'Valkyrie',
    nameZh: '女武神',
    subClasses: [{ classId: 357, icon: 'valkarieicon', nameEn: 'Valkyrie', nameZh: '女武神' }],
  },
  3: {
    idx: 3,
    petType: 'golem',
    group: 0,
    drawHp: true,
    iconType: 3,
    baseIcon: 'earthgolumicon',
    nameKey: 'Golem',
    nameEn: 'Clay Golem',
    nameZh: '黏土石魔',
    subClasses: [
      { classId: 289, icon: 'earthgolumicon', nameEn: 'Clay Golem', nameZh: '黏土石魔' },
      { classId: 290, icon: 'bloodgolumicon', nameEn: 'Blood Golem', nameZh: '鮮血石魔' },
      { classId: 291, icon: 'metalgolumicon', nameEn: 'Iron Golem', nameZh: '鋼鐵石魔' },
      { classId: 292, icon: 'firegolumicon', nameEn: 'Fire Golem', nameZh: '火焰石魔' },
    ],
  },
  4: {
    idx: 4,
    petType: 'skeleton',
    group: 0,
    drawHp: true,
    iconType: 2,
    baseIcon: 'skeletonicon',
    nameKey: 'Skeleton',
    nameEn: 'Skeleton',
    nameZh: '骷髏',
    subClasses: [{ classId: 363, icon: 'skeletonicon', nameEn: 'Skeleton', nameZh: '骷髏' }],
  },
  5: {
    idx: 5,
    petType: 'skeletonmage',
    group: 0,
    drawHp: true,
    iconType: 2,
    baseIcon: 'skeletonmageicon',
    nameKey: 'SkeletonMage',
    nameEn: 'Skeletal Mage',
    nameZh: '骷髏法師',
    subClasses: [{ classId: 364, icon: 'skeletonmageicon', nameEn: 'Skeletal Mage', nameZh: '骷髏法師' }],
  },
  6: {
    idx: 6,
    petType: 'revive',
    group: 0,
    drawHp: true,
    iconType: 2,
    baseIcon: 'revivedicon',
    nameKey: 'Revive',
    nameEn: 'Revive',
    nameZh: '復生怪物',
    subClasses: [],
  },
  7: {
    idx: 7,
    petType: 'hireable',
    group: 0,
    drawHp: true,
    iconType: 1,
    baseIcon: 'rogueicon',
    nameKey: 'Merc',
    nameEn: 'Mercenary',
    nameZh: '傭兵',
    subClasses: [
      { classId: 271, icon: 'rogueicon', nameEn: 'Rogue Scout', nameZh: '蘿格斥候' },
      { classId: 338, icon: 'act2hireableicon', nameEn: 'Desert Mercenary', nameZh: '沙漠傭兵' },
      { classId: 359, icon: 'act3hireableicon', nameEn: 'Iron Wolf', nameZh: '鐵狼衛士' },
      { classId: 560, icon: 'barbhirable_icon', nameEn: 'Barbarian', nameZh: '野蠻人傭兵' },
      { classId: 561, icon: 'barbhirable_icon', nameEn: 'Barbarian', nameZh: '野蠻人傭兵' },
    ],
  },
  10: {
    idx: 10,
    petType: 'raven',
    group: 0,
    drawHp: false,
    iconType: 2,
    baseIcon: 'raven',
    nameKey: 'DruidHawk',
    nameEn: 'Raven',
    nameZh: '烏鴉',
    subClasses: [{ classId: 419, icon: 'raven', nameEn: 'Raven', nameZh: '烏鴉' }],
  },
  11: {
    idx: 11,
    petType: 'spiritwolf',
    group: 1,
    drawHp: true,
    iconType: 2,
    baseIcon: 'wolf',
    nameKey: 'SpiritWolf',
    nameEn: 'Spirit Wolf',
    nameZh: '鬼狼',
    subClasses: [{ classId: 420, icon: 'wolf', nameEn: 'Spirit Wolf', nameZh: '鬼狼' }],
  },
  12: {
    idx: 12,
    petType: 'fenris',
    group: 1,
    drawHp: true,
    iconType: 2,
    baseIcon: 'wolf',
    nameKey: 'Fenris',
    nameEn: 'Dire Wolf',
    nameZh: '狂狼',
    subClasses: [{ classId: 421, icon: 'wolf', nameEn: 'Dire Wolf', nameZh: '狂狼' }],
  },
  13: {
    idx: 13,
    petType: 'totem',
    group: 2,
    drawHp: true,
    iconType: 3,
    baseIcon: 'oaksage',
    nameKey: 'Totem',
    nameEn: 'Oak Sage',
    nameZh: '橡木智者',
    subClasses: [
      { classId: 424, icon: 'oaksage', nameEn: 'Oak Sage', nameZh: '橡木智者' },
      { classId: 423, icon: 'heartofwolverine', nameEn: 'Heart of Wolverine', nameZh: '狼獾之心' },
      { classId: 422, icon: 'spiritofbarbs', nameEn: 'Spirit of Barbs', nameZh: '棘靈' },
    ],
  },
  14: {
    idx: 14,
    petType: 'vine',
    group: 3,
    drawHp: true,
    iconType: 3,
    baseIcon: 'plaguepoppy',
    nameKey: 'Vine',
    nameEn: 'Poison Creeper',
    nameZh: '劇毒藤蔓',
    subClasses: [
      { classId: 425, icon: 'plaguepoppy', nameEn: 'Poison Creeper', nameZh: '劇毒藤蔓' },
      { classId: 426, icon: 'cycleoflife', nameEn: 'Carrion Vine', nameZh: '食屍藤蔓' },
      { classId: 427, icon: 'vines', nameEn: 'Solar Creeper', nameZh: '太陽藤蔓' },
    ],
  },
  15: {
    idx: 15,
    petType: 'grizzly',
    group: 1,
    drawHp: true,
    iconType: 1,
    baseIcon: 'bear',
    nameKey: 'DruidBear',
    nameEn: 'Grizzly',
    nameZh: '灰熊',
    subClasses: [{ classId: 428, icon: 'bear', nameEn: 'Grizzly', nameZh: '灰熊' }],
  },
  16: {
    idx: 16,
    petType: 'shadowwarrior',
    group: 4,
    drawHp: true,
    iconType: 1,
    baseIcon: 'shadowassassin',
    nameKey: 'ShadowWarrior',
    nameEn: 'Shadow Warrior',
    nameZh: '影子戰士',
    subClasses: [
      { classId: 417, icon: 'shadowassassin', nameEn: 'Shadow Warrior', nameZh: '影子戰士' },
      { classId: 418, icon: 'shadowassassin', nameEn: 'Shadow Master', nameZh: '影子大師' },
    ],
  },
}

/**
 * 1.13c `PetType.txt` rows (`idx`) with `unsummon = 1` (bit 3 of the record flags, `gdwBitMasks[3]`), tested by
 * D2Client `SkillCltStFunc[3]` (Unsummon #3, 0x6FB51110) and D2Game `SKILLS_SrvSt03_Unsummon` (0x6FCBFEF0):
 * valkyrie, golem, skeleton, skeletonmage, revive, dopplezon, spiritwolf, fenris, totem, vine, grizzly,
 * shadowwarrior. Not unsummonable: single, hireable, invis, raven, assassintrap, pettrap, hydra.
 */
export const PET_TYPE_UNSUMMON_IDX_113C: ReadonlySet<number> = new Set<number>([
  2, 3, 4, 5, 6, 8, 11, 12, 13, 14, 15, 16,
])

/** 1.13c `PetType.txt` `pet type` -> `idx` (rows 0..19). */
export const PET_TYPE_IDX_BY_NAME_113C: Readonly<Record<string, number>> = {
  none: 0,
  single: 1,
  valkyrie: 2,
  golem: 3,
  skeleton: 4,
  skeletonmage: 5,
  revive: 6,
  hireable: 7,
  dopplezon: 8,
  invis: 9,
  raven: 10,
  spiritwolf: 11,
  fenris: 12,
  totem: 13,
  vine: 14,
  grizzly: 15,
  shadowwarrior: 16,
  assassintrap: 17,
  pettrap: 18,
  hydra: 19,
}

/** PetType.txt `unsummon` for a pet type name; throws on a name that is not a PetType.txt row. */
export function isPetTypeUnsummonable113c(petType: string): boolean {
  const idx = PET_TYPE_IDX_BY_NAME_113C[petType.toLowerCase()]
  if (idx === undefined) {
    throw new RangeError(`pet-type-table: ${JSON.stringify(petType)} is not a 1.13c PetType.txt row`)
  }
  return PET_TYPE_UNSUMMON_IDX_113C.has(idx)
}

/**
 * Reverse lookup from monster `hcIdx` (`classId`) to `PetType.txt` row index (`idx`).
 */
export const MONSTER_CLASS_TO_PET_TYPE_IDX: Readonly<Record<number, number>> = {
  357: 2, // Valkyrie
  289: 3, // Clay Golem
  290: 3, // Blood Golem
  291: 3, // Iron Golem
  292: 3, // Fire Golem
  363: 4, // Necro Skeleton
  364: 5, // Necro Skeletal Mage
  271: 7, // Act 1 Rogue Hireling
  338: 7, // Act 2 Desert Mercenary
  359: 7, // Act 3 Iron Wolf
  560: 7, // Act 5 Barbarian Hireling
  561: 7, // Act 5 Barbarian Hireling
  419: 10, // Raven
  420: 11, // Spirit Wolf
  421: 12, // Dire Wolf (Fenris)
  422: 13, // Spirit of Barbs
  423: 13, // Heart of Wolverine
  424: 13, // Oak Sage
  425: 14, // Poison Creeper (Plague Poppy)
  426: 14, // Carrion Vine (Cycle of Life)
  427: 14, // Solar Creeper (Vine Creature)
  428: 15, // Druid Grizzly Bear
  417: 16, // Shadow Warrior
  418: 16, // Shadow Master
}

/**
 * Resolve the authentic 1.13c mercenary portrait icon key from `classId` (`Hireables.cpp` `0x6fb0b2a0`).
 */
export function resolveMercPortraitIcon(classId: number | undefined): string {
  switch (classId) {
    case 338:
      return 'act2hireableicon'
    case 359:
      return 'act3hireableicon'
    case 560:
    case 561:
      return 'barbhirable_icon'
    case 271:
    default:
      return 'rogueicon'
  }
}

/**
 * Resolve the authentic 1.13c player class portrait icon key from `charClass` (`0..6` or `'ama'..'ass'`).
 */
export function resolvePlayerClassPortraitIcon(charClass: number | string | undefined): string {
  if (typeof charClass === 'number') {
    return PLAYER_CLASS_PORTRAIT_BY_ID[charClass] ?? 'AmazonIcon'
  }
  if (typeof charClass === 'string') {
    const num = Number(charClass)
    if (Number.isFinite(num) && PLAYER_CLASS_PORTRAIT_BY_ID[num]) {
      return PLAYER_CLASS_PORTRAIT_BY_ID[num]!
    }
    const lower = charClass.toLowerCase().slice(0, 3)
    if (PLAYER_CLASS_PORTRAIT_BY_CODE[lower]) {
      return PLAYER_CLASS_PORTRAIT_BY_CODE[lower]!
    }
  }
  return 'AmazonIcon'
}

/**
 * Resolve `PetTypePortraitMeta` and specific sub-class icon/label for a summoned pet (`Hireables.cpp` `0x6fb0b170`).
 */
export function resolvePetPortraitInfo(
  petTypeOrIdx: number | string | undefined,
  classId?: number | undefined,
): {
  readonly meta: PetTypePortraitMeta
  readonly iconKey: string
  readonly nameEn: string
  readonly nameZh: string
} | null {
  let idx: number | undefined
  if (typeof petTypeOrIdx === 'number' && PET_TYPE_PORTRAIT_TABLE[petTypeOrIdx]) {
    idx = petTypeOrIdx
  } else if (typeof petTypeOrIdx === 'string') {
    const asNum = Number(petTypeOrIdx)
    if (Number.isFinite(asNum) && PET_TYPE_PORTRAIT_TABLE[asNum]) {
      idx = asNum
    } else {
      const lower = petTypeOrIdx.toLowerCase()
      const found = Object.values(PET_TYPE_PORTRAIT_TABLE).find(p => p.petType === lower)
      if (found) idx = found.idx
    }
  }
  if (idx === undefined && classId !== undefined) {
    idx = MONSTER_CLASS_TO_PET_TYPE_IDX[classId]
  }
  if (idx === undefined) return null

  const meta = PET_TYPE_PORTRAIT_TABLE[idx]
  if (!meta || meta.iconType === 0) return null

  const sub = classId !== undefined ? meta.subClasses.find(s => s.classId === classId) : undefined
  return {
    meta,
    iconKey: sub?.icon ?? meta.baseIcon,
    nameEn: sub?.nameEn ?? meta.nameEn,
    nameZh: sub?.nameZh ?? meta.nameZh,
  }
}
