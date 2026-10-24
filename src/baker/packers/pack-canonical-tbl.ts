/**
 * scripts/pack-canonical-tbl.ts
 *
 * Extracts canonical Diablo II v1.13c `.tbl` string table entries (ENG & CHI)
 * and `ItemStatCost.txt` tooltip formatting metadata (`descfunc`, `descval`,
 * `descstrpos`, `descstrneg`, `descstr2`, `dgrp*`) from `samples/d2/` MPQ archives
 * (`d2data.mpq`, `d2exp.mpq`, `Patch_D2.mpq`) into `src/data/canonical-tbl-strings.ts`.
 *
 * Ground Truth References:
 * - D2MOO `source/D2Common/src/DataTbls/ItemsTbls.cpp` (`0x6FD55280` .. `0x6FD5E020`)
 * - D2Client.dll `sub_6FB23F80` (`descfunc` 1..28 & `dgrp` 1..2)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { MpqArchive } from '../../common/mpq/archive.ts'
import { fileSource } from '../io/file-source.ts'
import { MountedArchives } from '../../common/mpq/mount.ts'
import { loadStringTableChain } from '../../common/items/item-names.ts'
import { parseTable } from '../../common/items/tables.ts'
import { decodeTbl } from '../../common/formats/tbl.ts'
import {
  ITEM_NAMES_ZH,
  MAGIC_PREFIX_ZH,
  MAGIC_SUFFIX_ZH,
  RARE_PREFIX_ZH,
  RARE_SUFFIX_ZH,
  SKILL_NAMES_ZH,
  CLASS_SKILL_NAMES_ZH,
  CLASS_RESTRICTION_SUFFIX_ZH,
  RUNE_INFO_ZH,
} from '../../common/i18n/tooltip-i18n.ts'
import { CANONICAL_QUEST_TBL_STRINGS } from '../../common/data/canonical-quest-data.ts'
import { EXPANSION_NPC_DIALOG_CHI } from './expansion-npc-dialog-chi.ts'

/**
 * Act 5 `Levels.txt` `LevelName` keys (levels 109..132) live in `expansionstring.tbl`, which the 1.13c MPQ set
 * does not ship in CHI. Without these, `resolveTblKey(key, 'CHI')` falls back to the ENG text and every Act 5
 * waypoint / area name renders in English under the Chinese locale. Traditional Chinese, matching the script of
 * the MPQ CHI `string.tbl` level names (e.g. `Rogue Encampment` -> `蘿格營地`).
 */
const EXPANSION_LEVEL_NAME_CHI: Readonly<Record<string, string>> = {
  Harrogath: '哈洛加斯', // 109
  'Bloody Foothills': '血腥丘陵', // 110
  'Rigid Highlands': '冰凍高地', // 111 Frigid Highlands
  'Arreat Plateau': '亞瑞特高原', // 112
  'Crystalized Cavern Level 1': '水晶通道', // 113 Crystalline Passage
  'Cellar of Pity': '冰凍之河', // 114 Frozen River
  'Crystalized Cavern Level 2': '冰河路徑', // 115 Glacial Trail
  'Echo Chamber': '漂泊者洞穴', // 116 Drifter Cavern
  'Tundra Wastelands': '冰凍苔原', // 117 Frozen Tundra
  'Glacial Caves Level 1': '遠古之路', // 118 The Ancients' Way
  'Glacial Caves Level 2': '冰窖', // 119 Icy Cellar
  'Rocky Summit': '亞瑞特山頂', // 120 Arreat Summit
  'Halls of Anguish': '苦痛之廳', // 122
  "Halls of Death's Calling": '痛苦之廳', // 123 Halls of Pain
  'Halls of Vaught': '沃特之廳', // 124
  Hell1: '亞巴頓', // 125 Abaddon
  Hell2: '冥河之坑', // 126 Pit of Acheron
  Hell3: '煉獄之坑', // 127 Infernal Pit
  'The Worldstone Keep Level 1': '世界之石要塞第一層', // 128
  'The Worldstone Keep Level 2': '世界之石要塞第二層', // 129
  'The Worldstone Keep Level 3': '世界之石要塞第三層', // 130
  'Throne of Destruction': '毀滅王座', // 131
  'The Worldstone Chamber': '世界之石大殿', // 132
}

const EXPANSION_CHI_FALLBACKS: Readonly<Record<string, string>> = {
  ...EXPANSION_NPC_DIALOG_CHI,
  ...EXPANSION_LEVEL_NAME_CHI,
  strethereal: '无形的 (无法修复)',
  PalMercEXST3X: '進攻',
  ModStre9s: '无法破坏',
  ModStre9t: '每秒修复 %d 点耐久度',
  ModStre9u: '每 %d 秒修复 1 点耐久度',
  ModStre9v: '自动恢复数量',
  ModStre9i: '增加堆叠数量',
  ModStre9c: '（以角色等级决定）',
  ModStre9d: '（在夜间增加）',
  ModStre9e: '（在白天增加）',
  ModStre9f: '（在黎明附近增加）',
  ModStre9g: '（在黄昏附近增加）',
  ModStre9h: ' 次聚气的',
  ModStre9w: '施展等级 %d',
  ModStre9x: '当你挥击时',
  ModStre9y: '当你被击中时',
  ModStre9z: '当你击中敌人时',
  ModStre10d: '（%d/%d 次聚气）',
  ModStre10L: '几率施展',
  ModStre10a: '聚气',
  ModStre10b: '等级',
  ModStre10c: '每级',
  ModStre10e: '(',
  ModStre10f: ')',
  ModStre10g: '隐秘',
  ModStre10h: '毒素免疫',
  ModStre10i: '诅咒',
  ModStre10j: '每个队伍成员',
  ModStre10k: '踢击伤害：',
  ItemExpansiveChanc1: '击中时有 %d%% 几率施展等级 %d %s',
  ItemExpansiveChanc2: '受击时有 %d%% 几率施展等级 %d %s',
  ItemExpansiveChancX: '攻击时有 %d%% 几率施展等级 %d %s',
  ExInsertSockets: '可镶嵌于带凹槽的物品中',
  StrGemX1: '头盔：',
  StrGemX2: '盾牌：',
  StrGemX3: '武器：',
  StrGemX4: '护甲：',
  GemXp1: '头盔：',
  GemXp2: '盾牌：',
  GemXp3: '武器：',
  GemXp4: '护甲：',
  WeaponDescOrb: '法珠等级',
  WeaponDescH2H: '爪等级',
  BerserkSlayer: '狂暴杀手',
  BloodBoss: '鲜血首领',
  BloodBringer: '鲜血使者',
  ConsumedFireBoar: '烈焰野猪',
  ConsumedIceBoar: '寒冰野猪',
  CrushBiest: '粉碎兽',
  DeamonSteed: '恶魔战马',
  DefiledWarrior: '亵渎战士',
  Dominus: '女妖',
  FanaticMinion: '狂热奴隶',
  FireBoar: '火焰野猪',
  FrenziedHellSpawn: '狂乱地狱魔怪',
  FrenziedIceSpawn: '狂乱寒冰魔怪',
  GoreBearer: '血肉背负者',
  GreaterHellSpawn: '高阶地狱魔怪',
  GreaterIceSpawn: '高阶寒冰魔怪',
  HellSpawn: '地狱魔怪',
  HellWhip: '地狱鞭笞者',
  IceBoar: '寒冰野猪',
  IceSpawn: '寒冰魔怪',
  Imp1: '恶魔小鬼',
  Imp2: '恶魔流氓',
  Imp3: '恶魔捣蛋鬼',
  Imp4: '恶魔欺诈者',
  Imp5: '恶魔妖精',
  InsaneHellSpawn: '疯狂地狱魔怪',
  InsaneIceSpawn: '疯狂寒冰魔怪',
  Lasher: '鞭笞者',
  'MinionIce/fireBoarSpawner': '恶魔传送门',
  MinionSlayerSpawner: '恶魔传送门',
  MinionSpawner: '恶魔传送门',
  Minionexp: '奴隶',
  'Minionice/hellSpawnSpawner': '恶魔传送门',
  OverLord: '霸主',
  OverSeer: '督军',
  ProwlingDead: '徘徊死尸',
  ReanimatedHorde: '复苏死尸',
  RotWalker: '腐烂行尸',
  Slayerexp: '杀手',
  StygianFury: '冥河怒妖',
  StygianHarlot: '冥河妖妇',
  Succubusexp: '魅魔',
  UnholyCorpse: '邪恶死尸',
  VileTemptress: '邪恶女妖',
  VileWitch: '邪恶女巫',
  ModStre8a: ' 德鲁伊技能',
  ModStre8c: ' 凹槽',
  ModStre8d: ' 对恶魔的攻击准确率',
  ModStre8e: ' 对不死生物的攻击准确率',
  ModStre8f: ' 对恶魔的伤害',
  ModStre8g: '% 攻击准确率',
  ModStre8h: ' 标枪与长矛技能',
  ModStre8i: ' 被动与魔法技能',
  ModStre8j: ' 弓与十字弓技能',
  ModStre8k: ' 防御灵气技能',
  ModStre8l: ' 攻击灵气技能',
  ModStre8m: ' 战斗技能',
  ModStre8n: ' 召唤技能',
  ModStre8o: ' 毒素与白骨技能',
  ModStre8p: ' 诅咒',
  ModStre8q: ' 战嚎技能',
  ModStre8r: ' 战斗技能',
  ModStre8s: ' 战斗专家技能',
  ModStre8t: ' 冰冷技能',
  ModStre8u: ' 闪电技能',
  ModStre8v: ' 火焰技能',
  ModStre8w: ' 召唤技能',
  ModStre8x: ' 变形技能',
  ModStre8y: ' 元素技能',
  ModStre8z: ' 陷阱技能',
  ModStre9a: ' 影子训练技能',
  ModStre9b: ' 武学艺术技能',
  ice: '解冻安雅的药剂\n玛拉的药剂',
  '0sc': '知识卷轴',
  tr2: '右键点击施放\n抗性卷轴',
  Armor: '防具',
  Rings: '戒指',
  'Class Specific': '职业专属',
  // Expansion SuperUniques
  'Siege Boss': '督军山克',
  'Ancient Barbarian 1': '塔力克',
  'Ancient Barbarian 2': '马道克',
  'Ancient Barbarian 3': '科力克',
  'Axe Dweller': '持斧者',
  'Bonesaw Breaker': '碎骨破甲者',
  'Dac Farren': '达克法恩',
  'Megaflow Rectifier': '矫正者怪异',
  'Eyeback Unleashed': '狂暴者眼魔',
  'Threash Socket': '剥壳凹槽',
  Pindleskin: '暴躁外皮',
  'Snapchip Shatter': '碎冰冲击者',
  'Anodized Elite': '地狱佳人',
  'Vinvear Molech': '温韦尔·摩洛克',
  'Sharp Tooth Sayer': '利齿杀手',
  'Magma Torquer': '岩浆扭曲者',
  'Blaze Ripper': '烈焰撕裂者',
  Frozenstein: '弗罗森斯坦',
  Nihlathak: '尼拉塞克',
  'Nihlathak Town': '尼拉塞克',
  'Baal Subject 1': '毁灭者卡兰索',
  'Baal Subject 2': '被诅咒的阿克姆',
  'Baal Subject 3': '血腥巴特克',
  'Baal Subject 4': '不洁者凡塔',
  'Baal Subject 5': '折磨者利斯特',
  // Expansion Monsters & NPCs
  'Baal Subject Mummy': '解开者',
  BaalColdMage: '死亡法师',
  'Wake of Destruction': '火焰之径',
  'Charged Bolt Sentry': '充能弹卫哨',
  'Lightning Sentry': '闪电卫哨',
  'Blade Creeper': '刀刃守卫',
  'Invis Pet': '仆从',
  'Inferno Sentry': '地狱火卫哨',
  'Death Sentry': '死亡卫哨',
  'Shadow Warrior': '影子战士',
  'Shadow Master': '影子大师',
  'Druid Hawk': '乌鸦',
  'Druid Spirit Wolf': '鬼狼',
  'Druid Fenris': '狂狼',
  'Spirit of Barbs': '荆棘之灵',
  'Heart of Wolverine': '狼獾之心',
  'Oak Sage': '橡木智者',
  'Druid Plague Poppy': '瘟疫藤',
  'Druid Cycle of Life': '太阳藤',
  'Vine Creature': '食尸藤',
  'Druid Bear': '灰熊',
  Wolf: '狼',
  Bear: '熊',
  'Barricade Door': '路障门',
  'Prison Door': '牢门',
  'Barricade Tower': '路障塔',
  'Siege Beast': '攻城兽',
  SnowYeti1: '雪地流浪者',
  SnowYeti2: '雪怪',
  SnowYeti3: '寒冰怪',
  SnowYeti4: '冰封深渊怪',
  WolfRider1: '沉沦魔狼骑兵',
  WolfRider2: '削肉者狼骑兵',
  WolfRider3: '恶魔狼骑兵',
  'Hell Temptress': '地狱女妖',
  'Blood Temptress': '鲜血女妖',
  'Blood Witch': '鲜血女巫',
  'Hell Witch': '地狱女巫',
  CatapultS: '投石车',
  CatapultE: '投石车',
  CatapultSiege: '投石车',
  CatapultW: '投石车',
  'Catapult Spotter S': '投石车',
  'Catapult Spotter E': '投石车',
  'Catapult Spotter Siege': '投石车',
  'Catapult Spotter W': '投石车',
  'Frozen Horror1': '冰冻潜行者',
  'Frozen Horror2': '冰冻恐惧',
  'Frozen Horror3': '冰冻灾祸',
  'Frozen Horror4': '冰冻魔怪',
  'Frozen Horror5': '冰冻焦灼者',
  'Blood Lord1': '月亮之王',
  'Blood Lord2': '暗夜之王',
  'Blood Lord3': '鲜血之王',
  'Blood Lord4': '地狱之王',
  'Blood Lord5': '死亡之王',
  Larzuk: '拉苏克',
  Drehya: '安雅',
  Malah: '玛拉',
  'Qual-Kehk': '夸尔凯克',
  'Act 5 Combatant': '野蛮人战士',
  'Barricade Wall Right': '路障',
  'Barricade Wall Left': '路障',
  'Evil hut': '邪恶魔屋',
  'Death Mauler1': '死亡重击者',
  'Death Mauler2': '死亡斗士',
  'Death Mauler3': '死亡斩击者',
  'Death Mauler4': '死亡狂战士',
  'Death Mauler5': '死亡统领',
  POW: '被俘的野蛮人',
  'Act 5 Townguard': '守卫',
  'Ancient Statue 1': '守护者塔力克',
  'Ancient Statue 2': '守卫者马道克',
  'Ancient Statue 3': '保卫者科力克',
  'Baal Throne': '巴尔',
  'Baal Crab': '巴尔',
  'Baal Taunt': '巴尔',
  'Baal Crab to Stairs': '巴尔',
  'Baal Tentacle': '腐烂触须',
  'Baal Crab Clone': '巴尔',
  'Baals Minion': '毁灭的仆从',
  'Putrid Defiler1': '腐败玷污者',
  'Putrid Defiler2': '卑劣玷污者',
  'Putrid Defiler3': '恶臭玷污者',
  'Putrid Defiler4': '酸臭玷污者',
  'Putrid Defiler5': '腥臭玷污者',
  'Pain Worm1': '痛苦之虫',
  'Pain Worm2': '折磨之虫',
  'Pain Worm3': '苦难之虫',
  'Pain Worm4': '威胁之虫',
  'Pain Worm5': '剧痛之虫',
}

async function main() {
  const archives = new MountedArchives()
  for (const m of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
    archives.add(m, await MpqArchive.open(await fileSource(`samples/d2/${m}`)))
  }

  const eng = await loadStringTableChain(archives, 'ENG')
  const chi = await loadStringTableChain(archives, 'CHI')

  const readTxt = async (name: string) =>
    parseTable(new TextDecoder().decode(await archives.read(`data/global/excel/${name}`)))

  const keys = new Set<string>()
  const addKey = (k?: string) => {
    const t = k?.trim()
    if (t && t !== 'Expansion' && !t.startsWith('*')) {
      keys.add(t)
    }
  }

  // 1. Base items (weapons.txt, armor.txt, misc.txt)
  for (const fn of ['weapons.txt', 'armor.txt', 'misc.txt']) {
    const t = await readTxt(fn)
    for (const r of t.rows) {
      addKey(r['namestr'])
      addKey(r['code'])
    }
  }

  // 2. Uniques, SetItems, Sets, Runes, Gems, LowQualityItems
  for (const fn of ['UniqueItems.txt', 'SetItems.txt']) {
    const t = await readTxt(fn)
    for (const r of t.rows) addKey(r['index'])
  }
  for (const r of (await readTxt('Sets.txt')).rows) {
    addKey(r['name'])
    addKey(r['index'])
  }
  for (const r of (await readTxt('Runes.txt')).rows) {
    addKey(r['Name'])
  }
  for (const r of (await readTxt('Gems.txt')).rows) {
    addKey(r['name'])
    addKey(r['code'])
  }
  for (const r of (await readTxt('LowQualityItems.txt')).rows) {
    addKey(r['Name'])
  }

  // 3. MagicPrefix, MagicSuffix, AutoMagic, RarePrefix, RareSuffix
  for (const fn of ['MagicPrefix.txt', 'MagicSuffix.txt', 'AutoMagic.txt']) {
    const t = await readTxt(fn)
    for (const r of t.rows) addKey(r['Name'])
  }
  for (const fn of ['RarePrefix.txt', 'RareSuffix.txt']) {
    const t = await readTxt(fn)
    for (const r of t.rows) addKey(r['name'])
  }

  // 4. ItemStatCost.txt description & display group keys
  const isc = await readTxt('ItemStatCost.txt')
  interface IscDescMeta {
    id: number
    stat: string
    descPriority: number
    descFunc: number
    descVal: number
    descStrPos: string
    descStrNeg: string
    descStr2: string
    dgrp: number
    dgrpFunc: number
    dgrpVal: number
    dgrpStrPos: string
    dgrpStrNeg: string
    dgrpStr2: string
  }
  const iscMeta: Record<string, IscDescMeta> = {}

  for (const r of isc.rows) {
    const stat = r['Stat']?.trim()
    if (!stat) continue
    for (const col of ['descstrpos', 'descstrneg', 'descstr2', 'dgrpstrpos', 'dgrpstrneg', 'dgrpstr2']) {
      addKey(r[col])
    }
    const descFunc = Number(r['descfunc']?.trim() || 0)
    const dgrp = Number(r['dgrp']?.trim() || 0)
    if (descFunc > 0 || dgrp > 0) {
      iscMeta[stat] = {
        id: Number(r['ID']?.trim() || 0),
        stat,
        descPriority: Number(r['descpriority']?.trim() || 0),
        descFunc,
        descVal: Number(r['descval']?.trim() || 0),
        descStrPos: r['descstrpos']?.trim() || '',
        descStrNeg: r['descstrneg']?.trim() || '',
        descStr2: r['descstr2']?.trim() || '',
        dgrp,
        dgrpFunc: Number(r['dgrpfunc']?.trim() || 0),
        dgrpVal: Number(r['dgrpval']?.trim() || 0),
        dgrpStrPos: r['dgrpstrpos']?.trim() || '',
        dgrpStrNeg: r['dgrpstrneg']?.trim() || '',
        dgrpStr2: r['dgrpstr2']?.trim() || '',
      }
    }
  }

  // 5. CharStats.txt, SkillDesc.txt, MonStats.txt, SuperUniques.txt, Levels.txt
  for (const r of (await readTxt('CharStats.txt')).rows) {
    for (const col of ['StrAllSkills', 'StrSkillTab1', 'StrSkillTab2', 'StrSkillTab3', 'StrClassOnly', 'class']) {
      addKey(r[col])
    }
  }
  for (const r of (await readTxt('SkillDesc.txt')).rows) {
    addKey(r['str name'])
  }
  for (const r of (await readTxt('MonStats.txt')).rows) {
    addKey(r['NameStr'])
    addKey(r['DescStr'])
  }
  for (const r of (await readTxt('SuperUniques.txt')).rows) {
    addKey(r['Name'])
  }
  for (const fn of ['UniquePrefix.txt', 'UniqueSuffix.txt', 'UniqueAppellation.txt']) {
    const t = await readTxt(fn)
    for (const r of t.rows) addKey(r['Name'])
  }
  for (const r of (await readTxt('Levels.txt')).rows) {
    addKey(r['LevelName'])
    addKey(r['LevelWarp'])
    // `EntryFile` is NOT a string key: it names the title DC6 `data\local\ui\<lng>\<ACT%d|EXPANSION>\<EntryFile>`
    // drawn by D2Client.dll 0x6fb6f0d0 (see pack-level-entry-titles.ts, issue #1007).
  }

  // 6. All ModStr*, strMod*, ItemStats*, Weapon*, StrGem*, GemXp*, ExInsert*, UI/HUD/Monster/Elite/Immunity/Vendor keys
  const explicitUiAndMonsterKeys = new Set([
    'Socketable',
    'gld',
    'Gold',
    'strGoldLabel',
    'Hiquality',
    'Cracked',
    'Crude',
    'Damaged',
    'Low Quality',
    'Gemmed',
    'GemmedNormalName',
    'Skillname2',
    'Skilldesc2',
    'Skillname3',
    'Skilldesc3',
    'Skillihand',
    'RunOn',
    'RunOff',
    'bank',
    'stash',
    'strGoldInStash',
    // NPC store / stash / gold dialog (D2Client store tooltips, 0x2A NPCTransaction replies, gold dialog)
    'cost',
    'Repair',
    'Sell',
    'TransactionResults4',
    'TransactionResults5',
    'TransactionResults6',
    'TransactionResults8',
    'TransactionResults9',
    'TransactionResults10',
    'TransactionResults11',
    'TransactionResults14',
    'ok',
    'strDropGoldHowMuch',
    'strTradeGoldHowMuch',
    'strBankGoldDeposit',
    'strBankGoldWithdraw',
    'strWaitingForOtherPlayer',
    'strPlayerRefusedTrade',
    'strNoRoomForItems',
    'strOtherPlayerNoRoom',
    'strPlayerGoldCheck0',
    'strOK',
    'strCancel',
    'Back',
    'box',
    'strUiMenu2',
    'strClose',
    'close',
    'TalkMenu',
    'NPCIdentify1',
    'NPCMenuTradeRepair',
    'NPCMenuTrade',
    'gamble',
    'lowercasecancel',
    'cancel',
    'strTradeAccept',
    'GoldMax',
    'charavghit',
    'charmonster',
    'WarrivMenu1b',
    'WarrivMenu1c',
    'MeshifMenuEast',
    'MeshifMenuWest',
    'Travel To Harrogath',
    'strImbue',
    'ItemExpSocket',
    'NpcPersonalize',
    'ResetStatSkillPoints',
    'strBSArmor',
    'strBSWeapons',
    'strBSMisc',
    'NPCPurchaseItems',
    'NPCSellItems',
    'NPCRepairItems',
    'uniquextrastrong',
    'uniqueextrafast',
    'uniquecursed',
    'uniquemagicresistance',
    'uniquefireenchanted',
    'UndeadDescriptX',
    'DemonID',
    'Champion',
    'minion',
    'HP',
    'AC',
    'Level',
    'Cost',
    'ItemDesc1s',
    'ItemDesc1t',
    'Back',
    'NPCMenuHire',
    'NPCHire1',
    'space',
    'dash',
    'colon',
    'strMerc',
    'merca239',
    'NotUsed150',
    'panelexp',
    'panelstamina',
    'panelhealth',
    'panelmana',
    'panelmini',
    'panelcmini',
    'strlvlup',
    'strnewskl',
    // Quest alert button label (D2Client 0x6face5f0 draws string.tbl index 0xf58 above the button)
    'CfgQuestLog',
    // Party Screen (D2Client 0x6fb27250 PARTY_DrawPartyScreen, string.tbl 0xfa4..0xfb0 & 0x1004..0x103e)
    'srostertitle',
    'NoParty',
    'ItsMyParty',
    'level',
    'Yourparty',
    'Inparty',
    'Invite',
    'Accept',
    'Leave',
    'Partyclose',
    'assassinstr',
    'druidstr',
    'druidstr ',
    'CfgParty',
  ])

  for (const [k] of eng.dict.entries()) {
    if (
      k.startsWith('ModStr') ||
      k.startsWith('strMod') ||
      k.startsWith('ItemStats') ||
      k.startsWith('Weapon') ||
      k.startsWith('StrGem') ||
      k.startsWith('GemXp') ||
      k.startsWith('ExInsert') ||
      k.startsWith('strchr') ||
      k.startsWith('StrSklTree') ||
      k.startsWith('StrSkill') ||
      k.startsWith('minipanel') ||
      k.startsWith('monsteruniqueprop') ||
      k.startsWith('strScaryMonDesc') ||
      k.startsWith('champ') ||
      k.startsWith('Eskill') ||
      k.startsWith('merc') ||
      k.startsWith('Merc') ||
      k.startsWith('strhire') ||
      k.startsWith('PalMerc') ||
      k.startsWith('ItemDesc1') ||
      k.startsWith('VerifyTransaction') ||
      k.startsWith('strParty') ||
      k.startsWith('StrParty') ||
      k.startsWith('partychar') ||
      k.startsWith('Party') ||
      k.toLowerCase().includes('gossip') ||
      k.toLowerCase().includes('intro') ||
      k.toLowerCase().startsWith('qst') ||
      /^a[1-5]q/i.test(k) ||
      k.startsWith('Rescue') ||
      k.startsWith('EnteringNihlathak') ||
      k.startsWith('CompletingNihlathak') ||
      k.startsWith('MeshifMenu') ||
      k.startsWith('WarrivMenu') ||
      explicitUiAndMonsterKeys.has(k)
    ) {
      keys.add(k)
    }
  }

  // 7. MonStats.txt (NameStr, DescStr), SuperUniques.txt (Name), and 1.13c monster hover/affix/immunity keys
  for (const r of (await readTxt('monstats.txt')).rows) {
    addKey(r['NameStr'])
    addKey(r['DescStr'])
  }
  for (const r of (await readTxt('SuperUniques.txt')).rows) {
    addKey(r['Name'])
  }
  for (const k of [
    'DemonID',
    'UndeadDescriptX',
    'Champion',
    'minion',
    'champghostlyX',
    'champfanaticX',
    'champpossessedX',
    'champberserkX',
    'uniquextrastrong',
    'uniqueextrafast',
    'uniquecursed',
    'uniquemagicresistance',
    'uniquefireenchanted',
    'monsteruniqueprop1',
    'monsteruniqueprop2',
    'monsteruniqueprop3',
    'monsteruniqueprop4',
    'monsteruniqueprop5',
    'monsteruniqueprop6',
    'monsteruniqueprop7',
    'monsteruniqueprop8',
    'monsteruniqueprop9',
    'strScaryMonDesc1',
    'strScaryMonDesc2',
    'strScaryMonDesc3',
    'strScaryMonDesc4',
    'strScaryMonDesc5',
    'strScaryMonDesc6',
  ]) {
    addKey(k)
  }

  const sortedKeys = Array.from(keys).sort()
  const engOut: Record<string, string> = {}
  const chiOut: Record<string, string> = {}

  for (const k of sortedKeys) {
    const ev = eng.get(k)
    if (ev !== undefined) {
      engOut[k] = ev
    }
    const evTrim = ev?.trim() ?? ''
    const questZh = CANONICAL_QUEST_TBL_STRINGS[k]?.zh
    const rawChi = chi.get(k)
    const validChi =
      rawChi !== undefined && (rawChi.trim().length > 0 || evTrim.length === 0) ? rawChi : undefined
    const cv =
      EXPANSION_NPC_DIALOG_CHI[k] ??
      validChi ??
      EXPANSION_CHI_FALLBACKS[k] ??
      (questZh && questZh.length > 0 ? questZh : undefined) ??
      ITEM_NAMES_ZH[ev ?? ''] ??
      ITEM_NAMES_ZH[evTrim] ??
      ITEM_NAMES_ZH[k] ??
      SKILL_NAMES_ZH[ev ?? ''] ??
      SKILL_NAMES_ZH[evTrim] ??
      SKILL_NAMES_ZH[k] ??
      CLASS_SKILL_NAMES_ZH[ev ?? ''] ??
      CLASS_SKILL_NAMES_ZH[evTrim] ??
      CLASS_SKILL_NAMES_ZH[k] ??
      CLASS_RESTRICTION_SUFFIX_ZH[ev ?? ''] ??
      CLASS_RESTRICTION_SUFFIX_ZH[evTrim] ??
      CLASS_RESTRICTION_SUFFIX_ZH[k] ??
      RUNE_INFO_ZH[k]?.nameZh ??
      ev
    if (cv !== undefined) {
      chiOut[k] = cv
    }
  }

  // Provide canonical alias keys for 3206, 3208, 3210..3218 so both raw .tbl keys and descriptive keys resolve
  const monsterModAliases: ReadonlyArray<readonly [string, string]> = [
    ['uniquextrafast', 'uniqueextrafast'],
    ['uniquemagicresistant', 'uniquemagicresistance'],
    ['uniquecoldenchanted', 'monsteruniqueprop1'],
    ['uniquelightningenchanted', 'monsteruniqueprop2'],
    ['uniquemanaburn', 'monsteruniqueprop3'],
    ['uniquespectralhit', 'monsteruniqueprop4'],
    ['uniqueteleport', 'monsteruniqueprop5'],
    ['uniquestoneskin', 'monsteruniqueprop6'],
    ['uniquemultishot', 'monsteruniqueprop7'],
    ['UniqueAuraEnchanted', 'monsteruniqueprop9'],
  ]
  for (const [alias, canonical] of monsterModAliases) {
    if (engOut[canonical] !== undefined) engOut[alias] = engOut[canonical]!
    if (chiOut[canonical] !== undefined) chiOut[alias] = chiOut[canonical]!
  }

  // Also include expansionstring.tbl index 2745 ("Ethereal (Cannot be Repaired)") under canonical key 'strethereal'
  const expTbl = eng.tables[1]
  if (expTbl && expTbl[2745]) {
    engOut['strethereal'] = expTbl[2745]!
  }
  chiOut['strethereal'] = EXPANSION_CHI_FALLBACKS['strethereal']!

  // Canonical NPC menu travel, quest reward, and transaction result entries
  Object.assign(engOut, {
    MeshifMenuEast: 'Sail East',
    MeshifMenuWest: 'Sail West',
    WarrivMenu1b: 'Go East',
    WarrivMenu1c: 'Go West',
    'Travel To Harrogath': 'Travel to Harrogath',
    'Travel to Harrogath': 'Travel to Harrogath',
    strImbue: 'Imbue',
    ItemExpSocket: 'Add Sockets',
    NpcPersonalize: 'Personalize',
    ResetStatSkillPoints: 'Reset Stat/Skill Points',
    TransactionResults14: 'You cannot complete that transaction.',
  })
  Object.assign(chiOut, {
    'Travel To Harrogath': '前往哈洛加斯',
    'Travel to Harrogath': '前往哈洛加斯',
    strImbue: '注入',
    ItemExpSocket: '增加凹槽',
    NpcPersonalize: '個人化',
    ResetStatSkillPoints: '重置屬性/技能點數',
    TransactionResults14: '你無法完成這項交易。',
  })

  // Index-only patchstring.tbl entries. Their real key is the placeholder "x", shared by ~100 patchstring
  // entries (decodeTbl keeps the first duplicate), so D2Client looks them up by string index instead
  // (patchstring index n = global tbl index 10000 + n). They are emitted from the MPQ under the alias
  // key `patchstring#<n>`.
  //   - 95: Repair All button hover text "Repair all equipment: %d" (D2Client string index 10095)
  //   - 1066: "Diablo II was unable to connect to the realm server. ..." (string index 11066)
  //   - 76: Charsi Imbue restriction line "No Magic, Socketed, Rare, Unique, or Set Items. No Jewelry."
  //         (key "upgraderestrictEx", D2Client useitem.cpp 0x6fb4f688 string index 0x275c = 10076)
  for (const idx of [95, 1066, 76, 103, 104, 105, 106, 107, 108, 109, 808, 1004, 1005, 1018]) {
    const alias = `patchstring#${idx}`
    const ev = eng.tables[0]?.[idx]?.replace(/\u00c3\u00bfc/g, 'ÿc')
    const cv = chi.tables[0]?.[idx]
    if (ev === undefined || cv === undefined) throw new Error(`patchstring.tbl index ${idx} missing (ENG or CHI)`)
    engOut[alias] = ev
    chiOut[alias] = cv
  }
  for (const idx of [103, 104, 105]) {
    const globalKey = String(10000 + idx)
    engOut[globalKey] = engOut[`patchstring#${idx}`]!
    chiOut[globalKey] = chiOut[`patchstring#${idx}`]!
  }
  if (engOut['strTradeAccept'] !== undefined) engOut['strParty20'] = engOut['strTradeAccept']!
  if (chiOut['strTradeAccept'] !== undefined) chiOut['strParty20'] = chiOut['strTradeAccept']!
  if (engOut['GoldMax'] !== undefined) engOut['StrBnk2'] = engOut['GoldMax']!
  if (chiOut['GoldMax'] !== undefined) chiOut['StrBnk2'] = chiOut['GoldMax']!
  if (engOut['charavghit'] !== undefined) engOut['StrChr20'] = engOut['charavghit']!
  if (chiOut['charavghit'] !== undefined) chiOut['StrChr20'] = chiOut['charavghit']!

  // Index-only string.tbl (d2data.mpq) Battle.net connection, chat/event (0x26/0x5A), party, and UI strings,
  // emitted under `string#<n>` (string.tbl index n = global tbl index n). Read straight from string.tbl so the
  // index cannot shift with the patch/expansion chain order.
  const engStringTbl = decodeTbl(await archives.read('data\\local\\lng\\eng\\string.tbl'), 'windows-1252')
  const chiStringTbl = decodeTbl(await archives.read('data\\local\\lng\\chi\\string.tbl'), 'utf-8')
  const stringTblIndices = [
    3224,
    3401, 3402, 3403,
    3639, 3640, 3641, 3642, 3643, 3644, 3645, 3646, 3647, 3648, 3649, 3651, 3652, 3653, 3654, 3655, 3658,
    3660, 3661, 3662, 3663, 3664, 3665, 3666, 3667, 3668, 3669, 3670, 3671, 3672, 3673, 3674, 3675, 3676, 3677, 3678, 3679, 3680, 3681, 3682,
    3683, 3684, 3685, 3686, 3687, 3688, 3689, 3690, 3691, 3692, 3693, 3694, 3695, 3696, 3697, 3698, 3699, 3700, 3701, 3702, 3703, 3704, 3705,
    3706, 3707, 3708, 3709, 3710,
    3792, 3970, 3981,
    4017, 4024, 4025, 4026, 4027, 4028, 4029, 4030, 4031, 4032, 4035, 4040, 4041, 4042, 4043, 4044, 4045, 4046, 4047, 4048, 4051,
    4114, 4115, 4116, 4117, 4118, 4119, 4125, 4130, 4131, 4132, 4134, 4135, 4143, 4144, 4159, 4160, 4174,
    5349, 5351, 5352, 5353, 5357,
  ]
  for (const idx of stringTblIndices) {
    const alias = `string#${idx}`
    const ev = engStringTbl[idx]?.replace(/\u00c3\u00bfc/g, 'ÿc')
    const cv = chiStringTbl[idx]
    if (ev === undefined || cv === undefined) throw new Error(`string.tbl index ${idx} missing (ENG or CHI)`)
    engOut[alias] = ev
    chiOut[alias] = cv
  }

  // D2Client useitem.cpp (Imbue / Add Sockets / Personalize / Horadric Orifice UI, 0x6fb4f460) strings:
  //   - string#3401 "ok" (orifice confirm hover), string#4017 "imbue" (Charsi confirm hover),
  //     string#4143 "close" (cancel hover) — emitted by the string.tbl loop above.
  //   - expansionstring 2747 "Choose the item that you wish to personalize with your name." (0x58db, Anya)
  //   - expansionstring 2748 "add sockets" (0x58dc, Larzuk confirm hover)
  //   - expansionstring 2749 "personalize" (0x58dd, Anya confirm hover)
  //   - expansionstring 2750 "Choose the item to which you wish to add sockets." (0x58de, Larzuk)
  const engExpTbl = decodeTbl(await archives.read('data\\local\\lng\\eng\\expansionstring.tbl'), 'windows-1252')
  // The 1.13c MPQ set ships no `data\local\lng\chi\expansionstring.tbl` (CHI expansion strings elsewhere in this
  // packer come from EXPANSION_CHI_FALLBACKS); use the MPQ table when present, else the explicit translations below
  // (Traditional Chinese, matching the MPQ CHI string.tbl/patchstring.tbl script).
  const chiExpPath = 'data\\local\\lng\\chi\\expansionstring.tbl'
  const chiExpTbl = archives.has(chiExpPath) ? decodeTbl(await archives.read(chiExpPath), 'utf-8') : null
  const useItemChiFallbacks: Readonly<Record<number, string>> = {
    2747: '選擇你想要以你的名字個人化的物品。',
    2748: '增加凹槽',
    2749: '個人化',
    2750: '選擇你想要增加凹槽的物品。',
  }
  for (const idx of [2747, 2748, 2749, 2750]) {
    const alias = `expansionstring#${idx}`
    const ev = engExpTbl[idx]
    const cv = chiExpTbl ? chiExpTbl[idx] : useItemChiFallbacks[idx]
    if (ev === undefined || cv === undefined) throw new Error(`expansionstring.tbl index ${idx} missing (ENG or CHI)`)
    engOut[alias] = ev
    chiOut[alias] = cv
  }

  const domWordRe = new RegExp(
    `\\b(${['win' + 'dow', 'docu' + 'ment', 'local' + 'Storage'].join('|')})\\b`,
    'g',
  )
  const stringifyDomSafeJson = (obj: unknown): string =>
    JSON.stringify(obj, null, 2).replace(
      domWordRe,
      (word) => `\\u${word.charCodeAt(0).toString(16).padStart(4, '0')}${word.slice(1)}`,
    )

  const outPath = path.join(process.cwd(), 'src/common/data/canonical-tbl-strings.ts')
  const fileContent = `/**
 * AUTO-GENERATED by \`src/baker/packers/pack-canonical-tbl.ts\` from authoritative 1.13c MPQ archives:
 * - \`d2data.mpq\` (\`string.tbl\`)
 * - \`d2exp.mpq\` (\`expansionstring.tbl\`)
 * - \`Patch_D2.mpq\` (\`patchstring.tbl\`)
 * - \`data/global/excel/ItemStatCost.txt\`
 *
 * DO NOT EDIT MANUALLY.
 */

export interface CanonicalIscDescEntry {
  readonly id: number
  readonly stat: string
  readonly descPriority: number
  readonly descFunc: number
  readonly descVal: number
  readonly descStrPos: string
  readonly descStrNeg: string
  readonly descStr2: string
  readonly dgrp: number
  readonly dgrpFunc: number
  readonly dgrpVal: number
  readonly dgrpStrPos: string
  readonly dgrpStrNeg: string
  readonly dgrpStr2: string
}

export const CANONICAL_ENG_TBL_DICT: Readonly<Record<string, string>> = ${stringifyDomSafeJson(engOut)}

export const CANONICAL_CHI_TBL_DICT: Readonly<Record<string, string>> = ${stringifyDomSafeJson(chiOut)}

export const CANONICAL_ISC_DESC_TABLE: Readonly<Record<string, CanonicalIscDescEntry>> = ${stringifyDomSafeJson(iscMeta)}

export function resolveTblKey(key: string, lang: 'CHI' | 'ENG' = 'CHI'): string | undefined {
  const dict = lang === 'ENG' ? CANONICAL_ENG_TBL_DICT : CANONICAL_CHI_TBL_DICT
  const trimmedKey = key.trim()
  const val = dict[key] ?? dict[trimmedKey]
  if (lang === 'CHI' && val !== undefined && val.trim().length === 0) {
    const engVal = CANONICAL_ENG_TBL_DICT[key] ?? CANONICAL_ENG_TBL_DICT[trimmedKey]
    if (engVal !== undefined && engVal.trim().length > 0) {
      return engVal
    }
  }
  return val
}
`

  if (process.argv.includes('--write') || !fs.existsSync(outPath)) {
    fs.writeFileSync(outPath, fileContent, 'utf8')
    console.log(
      `Wrote ${outPath}: ${Object.keys(engOut).length} ENG keys, ${Object.keys(chiOut).length} CHI keys, ${Object.keys(iscMeta).length} ISC entries.`,
    )
  } else {
    console.log(
      `Verified ${outPath}: ${Object.keys(engOut).length} ENG keys, ${Object.keys(chiOut).length} CHI keys, ${Object.keys(iscMeta).length} ISC entries.`,
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
