import type { DecodedTbl } from '../formats/tbl.ts'
import type { D2Table } from './acts.ts'
import { cell } from './acts.ts'

/** Decoded TBL structure or string-to-string Map. */
export type D2Tbl = DecodedTbl | Map<string, string>

/** `Levels.txt` 的 `Id` → 中文场景名。 */
export const LEVEL_NAMES_ZH: Readonly<Record<number, string>> = {
  // Act 1
  1: '罗格营地',
  2: '鲜血荒地',
  3: '冰冷之原',
  4: '石块旷野',
  5: '黑暗森林',
  6: '黑色荒地',
  7: '泰摩高地',
  8: '邪恶洞窟',
  9: '洞穴一层',
  10: '地下通道一层',
  11: '窟窿一层',
  12: '深坑一层',
  13: '洞穴二层',
  14: '地下通道二层',
  15: '窟窿二层',
  16: '深坑二层',
  17: '埋骨之地',
  18: '大陵寝',
  19: '灵庙',
  20: '遗忘之塔',
  21: '塔地窖一层',
  22: '塔地窖二层',
  23: '塔地窖三层',
  24: '塔地窖四层',
  25: '塔地窖五层',
  26: '修道院大门',
  27: '外回廊',
  28: '军营',
  29: '监牢一层',
  30: '监牢二层',
  31: '监牢三层',
  32: '内回廊',
  33: '大教堂',
  34: '地下墓穴一层',
  35: '地下墓穴二层',
  36: '地下墓穴三层',
  37: '地下墓穴四层',
  38: '崔斯特瑞姆',
  39: '奶牛关',

  // Act 2
  40: '鲁高因',
  41: '碎石荒地',
  42: '干燥高地',
  43: '遥远绿洲',
  44: '遗失的城市',
  45: '群蛇峡谷',
  46: '术士峡谷',
  47: '下水道一层',
  48: '下水道二层',
  49: '下水道三层',
  50: '后宫一层',
  51: '后宫二层',
  52: '皇宫地牢一层',
  53: '皇宫地牢二层',
  54: '皇宫地牢三层',
  55: '石制古墓一层',
  56: '死亡之殿一层',
  57: '死亡之殿二层',
  58: '利爪蝮蛇神殿一层',
  59: '石制古墓二层',
  60: '死亡之殿三层',
  61: '利爪蝮蛇神殿二层',
  62: '蛆虫巢穴一层',
  63: '蛆虫巢穴二层',
  64: '蛆虫巢穴三层',
  65: '古代通道',
  66: '塔·拉夏古墓 (1)',
  67: '塔·拉夏古墓 (2)',
  68: '塔·拉夏古墓 (3)',
  69: '塔·拉夏古墓 (4)',
  70: '塔·拉夏古墓 (5)',
  71: '塔·拉夏古墓 (6)',
  72: '塔·拉夏古墓 (7)',
  73: '都瑞尔的巢穴',
  74: '秘法圣所',

  // Act 3
  75: '库拉斯特码头',
  76: '蜘蛛森林',
  77: '庞大湿地',
  78: '剥皮丛林',
  79: '库拉斯特下层',
  80: '库拉斯特商场',
  81: '库拉斯特上层',
  82: '库拉斯特堤道',
  83: '崔凡克',
  84: '蜘蛛巢穴',
  85: '蜘蛛洞窟',
  86: '沼泽地坑一层',
  87: '沼泽地坑二层',
  88: '剥皮地牢一层',
  89: '剥皮地牢二层',
  90: '沼泽地坑三层',
  91: '剥皮地牢三层',
  92: '下水道一层',
  93: '下水道二层',
  94: '废弃神殿',
  95: '荒废神庙',
  96: '遗忘圣物室',
  97: '遗忘神殿',
  98: '废弃神庙',
  99: '荒废圣物室',
  100: '憎恨囚牢一层',
  101: '憎恨囚牢二层',
  102: '憎恨囚牢三层',

  // Act 4
  103: '群魔堡垒',
  104: '郊外大草原',
  105: '绝望平原',
  106: '神罚之城',
  107: '火焰之河',
  108: '混沌避难所',

  // Act 5
  109: '哈洛加斯',
  110: '血腥丘陵',
  111: '冰冻高地',
  112: '亚瑞特高原',
  113: '水晶通道',
  114: '冰河',
  115: '冰河路径',
  116: '漂泊者洞穴',
  117: '冰冻苔原',
  118: '远古之路',
  119: '冰窖',
  120: '亚瑞特山顶',
  121: '尼拉塞克的神殿',
  122: '悲痛之厅',
  123: '痛苦之厅',
  124: '沃德之厅',
  125: '艾巴当',
  126: '阿克隆地道',
  127: '炼狱地坑',
  128: '世界之石要塞一层',
  129: '世界之石要塞二层',
  130: '世界之石要塞三层',
  131: '毁灭王座',
  132: '世界之石大殿',
  133: '主母巢穴',
  134: '遗忘沙漠',
  135: '痛苦熔炉',
  136: '崔斯特姆',
}

/**
 * DS1 变体后缀 → 方位名。
 *
 * 这些后缀是 D2 自己的命名习惯：城镇/回廊/鲁高因的 DS1 以 `N`/`E`/`S`/`W` 结尾
 * （`TownN1`、`CourtW`、`LutN`…）。**只白名单这几个**，不做"末尾字母是方位"的猜测：
 * `CryptCountess1` 末尾也是 `s`，按猜测会错成"南"。
 */
import { isDefaultTblLangEn as isEn } from '../formats/tbl.ts'

const DIRECTION_SUFFIXES: Readonly<Record<string, string>> = {
  townn1: '北门',
  towne1: '东门',
  towns1: '南门',
  townw1: '西门',
  courtn: '北向',
  courte: '东向',
  courtw: '西向',
  lutn: '北门',
  lutw: '西门',
}

const DIRECTION_SUFFIXES_EN: Readonly<Record<string, string>> = {
  townn1: 'North Gate',
  towne1: 'East Gate',
  towns1: 'South Gate',
  townw1: 'West Gate',
  courtn: 'North',
  courte: 'East',
  courtw: 'West',
  lutn: 'North Gate',
  lutw: 'West Gate',
}

/**
 * 把一个变体后缀变成显示用的中文（拿不准就原样返回 DS1 名）。
 *
 * @param suffix - the part of the pack label after the level slug, e.g. `towns1` or `var1`.
 * @returns the label to show in the third selector.
 */
export function variantLabelZh(suffix: string): string {
  const match = /^var(\d+)$/i.exec(suffix)
  if (match) return `变体 ${match[1]}`
  return DIRECTION_SUFFIXES[suffix.toLowerCase()] ?? suffix
}

export function variantLabelEn(suffix: string): string {
  const match = /^var(\d+)$/i.exec(suffix)
  if (match) return `Variant ${match[1]}`
  return DIRECTION_SUFFIXES_EN[suffix.toLowerCase()] ?? suffix
}

/** Canonical English level name keys corresponding to Levels.txt Id. */
export const CANONICAL_LEVEL_NAME_KEYS: Readonly<Record<number, string>> = {
  1: 'Rogue Encampment',
  2: 'Blood Moor',
  3: 'Cold Plains',
  4: 'Stony Field',
  5: 'Dark Wood',
  6: 'Black Marsh',
  7: 'Tamoe Highland',
  8: 'Den of Evil',
  9: 'Cave Level 1',
  10: 'Underground Passage Level 1',
  11: 'Hole Level 1',
  12: 'Pit Level 1',
  13: 'Cave Level 2',
  14: 'Underground Passage Level 2',
  15: 'Hole Level 2',
  16: 'Pit Level 2',
  17: 'Burial Grounds',
  18: 'Crypt',
  19: 'Mausoleum',
  20: 'Forgotten Tower',
  21: 'Tower Cellar Level 1',
  22: 'Tower Cellar Level 2',
  23: 'Tower Cellar Level 3',
  24: 'Tower Cellar Level 4',
  25: 'Tower Cellar Level 5',
  26: 'Monastery Gate',
  27: 'Outer Cloister',
  28: 'Barracks',
  29: 'Jail Level 1',
  30: 'Jail Level 2',
  31: 'Jail Level 3',
  32: 'Inner Cloister',
  33: 'Cathedral',
  34: 'Catacombs Level 1',
  35: 'Catacombs Level 2',
  36: 'Catacombs Level 3',
  37: 'Catacombs Level 4',
  38: 'Tristram',
  39: 'Moo Moo Farm',

  40: 'Lut Gholein',
  41: 'Rocky Waste',
  42: 'Dry Hills',
  43: 'Far Oasis',
  44: 'Lost City',
  45: 'Valley of Snakes',
  46: 'Canyon of the Magi',
  47: 'Sewers Level 1',
  48: 'Sewers Level 2',
  49: 'Sewers Level 3',
  50: 'Harem Level 1',
  51: 'Harem Level 2',
  52: 'Palace Cellar Level 1',
  53: 'Palace Cellar Level 2',
  54: 'Palace Cellar Level 3',
  55: 'Stony Tomb Level 1',
  56: 'Halls of the Dead Level 1',
  57: 'Halls of the Dead Level 2',
  58: 'Claw Viper Temple Level 1',
  59: 'Stony Tomb Level 2',
  60: 'Halls of the Dead Level 3',
  61: 'Claw Viper Temple Level 2',
  62: 'Maggot Lair Level 1',
  63: 'Maggot Lair Level 2',
  64: 'Maggot Lair Level 3',
  65: 'Ancient Tunnels',
  66: "Tal Rasha's Tomb 1",
  67: "Tal Rasha's Tomb 2",
  68: "Tal Rasha's Tomb 3",
  69: "Tal Rasha's Tomb 4",
  70: "Tal Rasha's Tomb 5",
  71: "Tal Rasha's Tomb 6",
  72: "Tal Rasha's Tomb 7",
  73: "Duriel's Lair",
  74: 'Arcane Sanctuary',

  75: 'Kurast Docks',
  76: 'Spider Forest',
  77: 'Great Marsh',
  78: 'Flayer Jungle',
  79: 'Lower Kurast',
  80: 'Kurast Bazaar',
  81: 'Upper Kurast',
  82: 'Kurast Causeway',
  83: 'Travincal',
  84: 'Spider Cave',
  85: 'Spider Cavern',
  86: 'Swampy Pit Level 1',
  87: 'Swampy Pit Level 2',
  88: 'Flayer Dungeon Level 1',
  89: 'Flayer Dungeon Level 2',
  90: 'Swampy Pit Level 3',
  91: 'Flayer Dungeon Level 3',
  92: 'Sewers Level 1',
  93: 'Sewers Level 2',
  94: 'Ruined Temple',
  95: 'Disused Fane',
  96: 'Forgotten Reliquary',
  97: 'Forgotten Temple',
  98: 'Ruined Fane',
  99: 'Disused Reliquary',
  100: 'Durance of Hate Level 1',
  101: 'Durance of Hate Level 2',
  102: 'Durance of Hate Level 3',

  103: 'Pandemonium Fortress',
  104: 'Outer Steppes',
  105: 'Plains of Despair',
  106: 'City of the Damned',
  107: 'River of Flame',
  108: 'Chaos Sanctuary',

  109: 'Harrogath',
  110: 'Bloody Foothills',
  111: 'Frigid Highlands',
  112: 'Arreat Plateau',
  113: 'Crystalline Passage',
  114: 'Frozen River',
  115: 'Glacial Trail',
  116: 'Drifter Cavern',
  117: 'Frozen Tundra',
  118: "The Ancients' Way",
  119: 'Icy Cellar',
  120: 'Arreat Summit',
  121: "Nihlathak's Temple",
  122: 'Halls of Anguish',
  123: 'Halls of Pain',
  124: 'Halls of Vaught',
  125: 'Abaddon',
  126: 'Pit of Acheron',
  127: 'Infernal Pit',
  128: 'Worldstone Keep Level 1',
  129: 'Worldstone Keep Level 2',
  130: 'Worldstone Keep Level 3',
  131: 'Throne of Destruction',
  132: 'Worldstone Chamber',
  133: "Matron's Den",
  134: 'Forgotten Sands',
  135: 'Furnace of Pain',
  136: 'Tristram',
}

/**
 * Normalizes any level slug or name string for robust lookup.
 * e.g. "17-burial-grounds" -> "burialgrounds"
 *      "rogue-encampment" -> "rogueencampment"
 *      "The Ancients' Way" -> "theancientsway"
 */
function normalizeSlug(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Check if a string looks like a code/slug rather than a human-readable title. */
function isRawSlug(str: string): boolean {
  return str.includes('-') || str.includes('_') || /^[a-z0-9]+$/.test(str)
}

function toTitleCase(slug: string): string {
  const clean = slug.replace(/^\d+[-_]/, '')
  return clean
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/** Pre-built map of normalized slugs/names to canonical level ID. */
const SLUG_TO_LEVEL_ID: ReadonlyMap<string, number> = (() => {
  const map = new Map<string, number>()
  for (let id = 1; id <= 136; id++) {
    const en = CANONICAL_LEVEL_NAME_KEYS[id]
    if (en) {
      map.set(normalizeSlug(en), id)
      map.set(normalizeSlug(en.replace(/^The\s+/i, '')), id)
    }
  }
  // Common aliases in pack manifests
  const aliases: Record<string, number> = {
    'rogueencampment': 1,
    'bloodmoor': 2,
    'coldplains': 3,
    'stonyfield': 4,
    'darkwood': 5,
    'blackmarsh': 6,
    'tamoehighland': 7,
    'denofevil': 8,
    'cave1': 9,
    'cavelevel1': 9,
    'undergroundpassage1': 10,
    'undergroundpassagelevel1': 10,
    'hole1': 11,
    'holelevel1': 11,
    'pit1': 12,
    'pitlevel1': 12,
    'cave2': 13,
    'cavelevel2': 13,
    'undergroundpassage2': 14,
    'undergroundpassagelevel2': 14,
    'hole2': 15,
    'holelevel2': 15,
    'pit2': 16,
    'pitlevel2': 16,
    'burialgrounds': 17,
    'crypt': 18,
    'mausoleum': 19,
    'forgottentower': 20,
    'towercellar1': 21,
    'towercellar2': 22,
    'towercellar3': 23,
    'towercellar4': 24,
    'towercellar5': 25,
    'monasterygate': 26,
    'outercloister': 27,
    'barracks': 28,
    'jail1': 29,
    'jail2': 30,
    'jail3': 31,
    'innercloister': 32,
    'cathedral': 33,
    'catacombs1': 34,
    'catacombs2': 35,
    'catacombs3': 36,
    'catacombs4': 37,
    'tristram': 38,
    'moomoofarm': 39,
    'lutgholein': 40,
    'rockywaste': 41,
    'dryhills': 42,
    'faroasis': 43,
    'lostcity': 44,
    'valleyofsnakes': 45,
    'canyonofmagi': 46,
    'canyonofthemagi': 46,
    'harrogath': 109,
    'bloodyfoothills': 110,
    'frigidhighlands': 111,
    'arreatplateau': 112,
    'crystallinepassage': 113,
    'frozenriver': 114,
    'glacialtrail': 115,
    'driftercavern': 116,
    'frozentundra': 117,
    'ancientsway': 118,
    'theancientsway': 118,
    'icycellar': 119,
    'arreatsummit': 120,
    'nihlathakstemple': 121,
    'hallsofanguish': 122,
    'hallsofpain': 123,
    'hallsofvaught': 124,
    'abaddon': 125,
    'pitofacheron': 126,
    'infernalpit': 127,
    'worldstonekeep1': 128,
    'worldstonekeep2': 129,
    'worldstonekeep3': 130,
    'throneofdestruction': 131,
    'worldstonechamber': 132,
    'theworldstonechamber': 132,
    'pandemoniumfortress': 103,
    'thepandemoniumfortress': 103,
    'chaossanctuary': 108,
    'thechaossanctuary': 108,
    'matronsden': 133,
    'forgottensands': 134,
    'furnaceofpain': 135,
    'ubertristram': 136,
    'pandemoniumtristram': 136,
  }
  for (const [k, v] of Object.entries(aliases)) {
    map.set(normalizeSlug(k), v)
  }
  return map
})()

/**
 * 从 pack 索引条目的 `slug` 或关卡代号里解析 `Levels.txt` 的关卡 Id。
 * 支持前缀格式（`17-burial-grounds`）以及无前缀纯文本 slug（`burial-grounds`、`rogue-encampment`）。
 *
 * @param slug - e.g. `17-burial-grounds` or `burial-grounds`.
 * @returns the id (1..136), or null when unresolvable.
 */
export function levelIdOfSlug(slug: string): number | null {
  if (slug == null || typeof slug !== 'string') return null
  const trimmed = slug.trim()
  if (!trimmed) return null
  const match = /^(\d+)(?:-|_|$)/.exec(trimmed)
  if (match?.[1] !== undefined) {
    const parsed = Number(match[1])
    if (parsed >= 1 && parsed <= 136) return parsed
  }
  const norm = normalizeSlug(trimmed)
  return (
    SLUG_TO_LEVEL_ID.get(norm) ??
    SLUG_TO_LEVEL_ID.get(norm.replace(/^the/, '')) ??
    SLUG_TO_LEVEL_ID.get('the' + norm) ??
    null
  )
}

export interface LevelNames {
  readonly nameZh: string
  readonly nameEn: string
}

/**
 * Bilingual level name lookup for UI banners and HUD displays.
 * Resolves both numeric level IDs (1..136) and string slugs (e.g. 'burial-grounds').
 * Returns authentic Chinese and English names, never empty, never leaking raw slugs.
 */
export function getLevelNames(levelIdOrSlug: number | string | null | undefined): LevelNames {
  if (levelIdOrSlug == null || levelIdOrSlug === '') {
    return { nameZh: 'Unknown Area', nameEn: 'Unknown Area' }
  }

  let id: number | null = null
  let rawStr = ''

  if (typeof levelIdOrSlug === 'number') {
    if (Number.isFinite(levelIdOrSlug) && Number.isInteger(levelIdOrSlug)) {
      id = levelIdOrSlug
    }
    rawStr = String(levelIdOrSlug)
  } else {
    rawStr = String(levelIdOrSlug).trim()
    if (!rawStr) {
      return { nameZh: 'Unknown Area', nameEn: 'Unknown Area' }
    }
    id = levelIdOfSlug(rawStr)
  }

  let nameZh: string | undefined
  let nameEn: string | undefined

  if (id !== null) {
    nameZh = activeTblLevelNames?.get(id) ?? LEVEL_NAMES_ZH[id]
    nameEn = CANONICAL_LEVEL_NAME_KEYS[id]
  }

  if (!nameEn) {
    nameEn = toTitleCase(rawStr) || 'Unknown Area'
  }
  if (!nameZh) {
    nameZh = nameEn
  }

  return { nameZh, nameEn }
}

/**
 * 一个场景的中文名，取不到就回退调用方给的英文名。
 * 支持传入自定义映射表或自动使用全局由 string.tbl 解码的名称，无匹配时回退到 LEVEL_NAMES_ZH 或 fallback。
 * 防止原始无前缀 slug（如 'burial-grounds'）直接泄露到 UI。
 *
 * @param slug - the scene slug from the pack index.
 * @param fallback - the English name from the pack index.
 * @param customMap - optional custom map or record of levelId -> name.
 * @returns the display name.
 */
export function sceneNameZh(
  slug: string | number | null | undefined,
  fallback?: string,
  customMap?: Map<number, string> | Record<number, string>,
): string {
  if (slug == null || slug === '') {
    return fallback && !isRawSlug(fallback) ? fallback : 'Unknown Area'
  }
  const slugStr = typeof slug === 'string' ? slug.trim() : String(slug)
  if (!slugStr) {
    return fallback && !isRawSlug(fallback) ? fallback : 'Unknown Area'
  }
  const id = typeof slug === 'number' ? (Number.isInteger(slug) ? slug : null) : levelIdOfSlug(slugStr)
  if (id !== null) {
    if (customMap) {
      const val = customMap instanceof Map ? customMap.get(id) : customMap[id]
      if (val) return val
    }
    if (activeTblLevelNames?.has(id)) {
      return activeTblLevelNames.get(id)!
    }
    if (LEVEL_NAMES_ZH[id]) {
      return LEVEL_NAMES_ZH[id]!
    }
  }
  // Guard against leaking raw un-prefixed slugs
  if (fallback && !isRawSlug(fallback)) {
    return fallback
  }
  return getLevelNames(slug).nameZh
}

/**
 * 一个场景的英文名。
 *
 * @param slug - the scene slug from the pack index or numeric level ID.
 * @param fallback - optional fallback English string.
 * @returns canonical English level name.
 */
export function sceneNameEn(
  slug: string | number | null | undefined,
  fallback?: string,
): string {
  if (slug == null || slug === '') {
    return fallback && !isRawSlug(fallback) ? fallback : 'Unknown Area'
  }
  const slugStr = typeof slug === 'string' ? slug.trim() : String(slug)
  if (!slugStr) {
    return fallback && !isRawSlug(fallback) ? fallback : 'Unknown Area'
  }
  const id = typeof slug === 'number' ? (Number.isInteger(slug) ? slug : null) : levelIdOfSlug(slugStr)
  if (id !== null && CANONICAL_LEVEL_NAME_KEYS[id]) {
    return CANONICAL_LEVEL_NAME_KEYS[id]!
  }
  if (fallback && !isRawSlug(fallback)) {
    return fallback
  }
  return getLevelNames(slug).nameEn
}

export function levelDisplayName(
  levelIdOrSlug: number | string | null | undefined,
  lang?: 'CHI' | 'ENG' | 'zh' | 'en',
): string {
  const names = getLevelNames(levelIdOrSlug)
  const useEn = lang !== undefined ? (lang === 'ENG' || lang === 'en') : isEn()
  return useEn ? names.nameEn : names.nameZh
}


function lookupTbl(tbl: D2Tbl | Map<string, string>, key: string): string | undefined {
  if (tbl instanceof Map) {
    return tbl.get(key)
  }
  if (tbl && typeof tbl === 'object' && 'dict' in tbl && tbl.dict instanceof Map) {
    return tbl.dict.get(key)
  }
  return undefined
}

/** Currently active decoded level names from string.tbl. */
let activeTblLevelNames: Map<number, string> | null = null

/** Set or clear the globally active level names decoded from string.tbl. */
export function setActiveLevelNames(names: Map<number, string> | Record<number, string> | null): void {
  if (names === null) {
    activeTblLevelNames = null
  } else if (names instanceof Map) {
    activeTblLevelNames = names
  } else {
    activeTblLevelNames = new Map(Object.entries(names).map(([k, v]) => [Number(k), v]))
  }
}

/**
 * Decodes localized level names from a string.tbl dictionary (or Map<string, string>).
 * Supports reading from string.tbl and optional Levels.txt table (or loadActTables).
 * Falls back gracefully to LEVEL_NAMES_ZH or English nameKey if strings are missing or table is not loaded.
 *
 * @param tbl - decoded string.tbl object or Map of string keys to localized names.
 * @param levelsTable - optional Levels.txt D2Table for dynamic Id->LevelName mapping.
 * @returns Map of levelId -> localized display name.
 */
export function decodeLevelNamesFromTbl(
  tbl?: D2Tbl | Map<string, string> | null,
  levelsTable?: D2Table,
): Map<number, string> {
  const result = new Map<number, string>()

  if (levelsTable) {
    for (const row of levelsTable.rows) {
      const idStr = cell(levelsTable, row, 'Id')
      if (!idStr) continue
      const id = Number(idStr)
      if (isNaN(id) || id <= 0) continue

      const levelNameKey = cell(levelsTable, row, 'LevelName')
      const nameKey = cell(levelsTable, row, 'Name')
      const canonicalKey = CANONICAL_LEVEL_NAME_KEYS[id]

      let match: string | undefined
      if (tbl) {
        match =
          (levelNameKey ? lookupTbl(tbl, levelNameKey) : undefined) ??
          (nameKey ? lookupTbl(tbl, nameKey) : undefined) ??
          (canonicalKey ? lookupTbl(tbl, canonicalKey) : undefined) ??
          lookupTbl(tbl, String(id))
      }

      if (match) {
        result.set(id, match)
      } else {
        const fallback = LEVEL_NAMES_ZH[id] ?? levelNameKey ?? canonicalKey ?? nameKey
        if (fallback) {
          result.set(id, fallback)
        }
      }
    }
    return result
  }

  // Without Levels.txt, iterate all canonical IDs
  const allIds = new Set<number>([
    ...Object.keys(LEVEL_NAMES_ZH).map(Number),
    ...Object.keys(CANONICAL_LEVEL_NAME_KEYS).map(Number),
  ])

  for (const id of allIds) {
    const canonicalKey = CANONICAL_LEVEL_NAME_KEYS[id]
    let match: string | undefined
    if (tbl) {
      match =
        (canonicalKey ? lookupTbl(tbl, canonicalKey) : undefined) ??
        lookupTbl(tbl, String(id))
    }

    if (match) {
      result.set(id, match)
    } else {
      const fallback = LEVEL_NAMES_ZH[id] ?? canonicalKey ?? String(id)
      result.set(id, fallback)
    }
  }

  return result
}
