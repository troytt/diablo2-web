import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { encodeTbl } from '../src/baker/io/tbl-writer.ts'
import { decodeTbl } from '../src/common/formats/tbl.ts'
import type { DecodedTbl } from '../src/common/formats/tbl.ts'
import { loadArmor } from '../src/common/items/armor.ts'
import { loadWeapons } from '../src/common/items/weapons.ts'
import { loadMisc } from '../src/common/items/misc-items.ts'
import { loadUniqueItems } from '../src/common/items/unique-items.ts'
import { loadSetData } from '../src/common/items/set-items.ts'
import {
  StringTableChain,
  ENG_STRING_TABLE_PATHS,
  CHI_STRING_TABLE_PATHS,
  loadStringTableChain,
  loadItemNameChains,
  resolveItemName,
  resolveArmorName,
  resolveWeaponName,
  resolveMiscName,
  resolveUniqueName,
  resolveUniqueItemName,
  resolveSetItemName,
  resolveSetName,
  resolveRunewordName,
  resolveRuneName,
  resolveAffixName,
} from '../src/common/items/item-names.ts'

const hasD2 = fs.existsSync('samples/d2/d2data.mpq')

function createSyntheticTable(entries: Record<string, string>): DecodedTbl {
  const tblEntries = Object.entries(entries).map(([key, value]) => ({ key, value }))
  const encoded = encodeTbl(tblEntries)
  return decodeTbl(encoded, 'utf-8')
}

describe('Item Names Localization (Issue #108)', () => {
  describe('Hermetic Unit Tests', () => {
    it('verifies path constants for ENG and CHI chains', () => {
      expect(ENG_STRING_TABLE_PATHS).toEqual([
        'data\\local\\LNG\\ENG\\patchstring.tbl',
        'data\\local\\LNG\\ENG\\expansionstring.tbl',
        'data\\local\\lng\\eng\\string.tbl',
      ])
      expect(CHI_STRING_TABLE_PATHS).toEqual([
        'data\\local\\LNG\\CHI\\patchstring.tbl',
        'data\\local\\LNG\\CHI\\string.tbl',
      ])
    })

    it('implements three-tier lookup hierarchy: patch > expansion > base', () => {
      const baseTbl = createSyntheticTable({
        key1: 'base1',
        key2: 'base2',
        key3: 'base3',
      })
      const expTbl = createSyntheticTable({
        key2: 'exp2',
        key4: 'exp4',
      })
      const patchTbl = createSyntheticTable({
        key1: 'patch1',
      })

      const chain = new StringTableChain('ENG', [patchTbl, expTbl, baseTbl])

      // patch overrides base
      expect(chain.get('key1')).toBe('patch1')
      // expansion overrides base
      expect(chain.get('key2')).toBe('exp2')
      // base is returned when neither patch nor expansion has it
      expect(chain.get('key3')).toBe('base3')
      // expansion-only entry
      expect(chain.get('key4')).toBe('exp4')
      // non-existent
      expect(chain.get('unknown')).toBeUndefined()

      // has() check
      expect(chain.has('key1')).toBe(true)
      expect(chain.has('key4')).toBe(true)
      expect(chain.has('missing')).toBe(false)

      // dict getter check
      expect(chain.dict.get('key1')).toBe('patch1')
      expect(chain.dict.get('key2')).toBe('exp2')
      expect(chain.dict.get('key3')).toBe('base3')
      expect(chain.dict.get('key4')).toBe('exp4')

      // iterable
      expect([...chain].length).toBe(3)
    })

    it('implements language fallback: CHI -> ENG -> code fallback', () => {
      const chiTbl = createSyntheticTable({
        cap: '帽子',
        unique_shared: 'CHI版本',
      })
      const engTbl = createSyntheticTable({
        cap: 'Cap',
        unique_shared: 'ENG Version',
        r33: 'Zod Rune',
      })

      const chiChain = new StringTableChain('CHI', [chiTbl])
      const engChain = new StringTableChain('ENG', [engTbl])

      // Both CHI and ENG present -> CHI wins
      expect(resolveItemName('cap', chiChain, engChain)).toBe('帽子')
      expect(resolveItemName('unique_shared', chiChain, engChain)).toBe('CHI版本')

      // Absent in CHI, present in ENG -> ENG fallback
      expect(resolveItemName('r33', chiChain, engChain)).toBe('Zod Rune')

      // Absent in both -> raw code fallback
      expect(resolveItemName('hpo', chiChain, engChain)).toBe('hpo')
      expect(resolveItemName('nonexistent_key', chiChain, engChain)).toBe('nonexistent_key')

      // Only ENG chain provided
      expect(resolveItemName('cap', undefined, engChain)).toBe('Cap')
      expect(resolveItemName('cap', null, engChain)).toBe('Cap')

      // Neither chain provided
      expect(resolveItemName('cap', undefined, undefined)).toBe('cap')

      // Empty / falsy key returns empty string
      expect(resolveItemName('', chiChain, engChain)).toBe('')
    })

    it('supports ItemNameChains composite object parameter', () => {
      const chiChain = new StringTableChain('CHI', [createSyntheticTable({ tow: '塔盾' })])
      const engChain = new StringTableChain('ENG', [createSyntheticTable({ tow: 'Tower Shield' })])

      expect(resolveItemName('tow', { chi: chiChain, eng: engChain })).toBe('塔盾')
      expect(resolveItemName('tow', { eng: engChain })).toBe('Tower Shield')
    })

    it('tests specific resolver helpers with object and string inputs', () => {
      const chiChain = new StringTableChain('CHI', [
        createSyntheticTable({
          cap: '帽子',
          hax: '手斧',
          hp1: '微型治療藥劑',
          'The Gnasher': '牙齒',
          "Civerb's Ward": '希弗柏的防護',
          "Civerb's Vestments": '希弗伯的法衣',
          Runeword26: '末日',
          r01: '艾爾',
        }),
      ])
      const engChain = new StringTableChain('ENG', [
        createSyntheticTable({
          cap: 'Cap',
          hax: 'Hand Axe',
          hp1: 'Minor Healing Potion',
          'The Gnasher': 'The Gnasher',
          "Civerb's Ward": "Civerb's Ward",
          "Civerb's Vestments": "Civerb's Vestments",
          Runeword26: 'Doom',
          r01: 'El Rune',
        }),
      ])

      // Armor resolver helper (namestr)
      expect(resolveArmorName('cap', chiChain, engChain)).toBe('帽子')
      expect(resolveArmorName({ namestr: 'cap' }, chiChain, engChain)).toBe('帽子')

      // Weapon resolver helper (namestr)
      expect(resolveWeaponName('hax', chiChain, engChain)).toBe('手斧')
      expect(resolveWeaponName({ namestr: 'hax' }, chiChain, engChain)).toBe('手斧')

      // Misc resolver helper (namestr)
      expect(resolveMiscName('hp1', chiChain, engChain)).toBe('微型治療藥劑')
      expect(resolveMiscName({ namestr: 'hp1' }, chiChain, engChain)).toBe('微型治療藥劑')

      // Unique resolver helper (index)
      expect(resolveUniqueName('The Gnasher', chiChain, engChain)).toBe('牙齒')
      expect(resolveUniqueName({ index: 'The Gnasher' }, chiChain, engChain)).toBe('牙齒')
      expect(resolveUniqueItemName({ index: 'The Gnasher' }, chiChain, engChain)).toBe('牙齒')

      // Set item resolver helper (index)
      expect(resolveSetItemName("Civerb's Ward", chiChain, engChain)).toBe('希弗柏的防護')
      expect(resolveSetItemName({ index: "Civerb's Ward" }, chiChain, engChain)).toBe('希弗柏的防護')

      // Set resolver helper (name)
      expect(resolveSetName("Civerb's Vestments", chiChain, engChain)).toBe('希弗伯的法衣')
      expect(resolveSetName({ name: "Civerb's Vestments" }, chiChain, engChain)).toBe('希弗伯的法衣')

      // Runeword resolver helper (Name)
      expect(resolveRunewordName('Runeword26', chiChain, engChain)).toBe('末日')
      expect(resolveRunewordName({ Name: 'Runeword26' }, chiChain, engChain)).toBe('末日')
      expect(resolveRunewordName({ name: 'Runeword26' }, chiChain, engChain)).toBe('末日')

      // Rune resolver helper (namestr / code)
      expect(resolveRuneName('r01', chiChain, engChain)).toBe('艾爾')
      expect(resolveRuneName({ namestr: 'r01' }, chiChain, engChain)).toBe('艾爾')
      expect(resolveRuneName({ code: 'r01' }, chiChain, engChain)).toBe('艾爾')
    })

    it('verifies Magic/Rare affix names return raw text without querying TBL', () => {
      // Magic and rare affix text must be preserved verbatim without TBL query
      expect(resolveAffixName('Cruel')).toBe('Cruel')
      expect(resolveAffixName({ name: "of the Whale" })).toBe("of the Whale")
      expect(resolveAffixName({ Name: "Grandmaster's" })).toBe("Grandmaster's")
      expect(resolveAffixName({ name: 'Beast' })).toBe('Beast')
      expect(resolveAffixName({ name: 'flange' })).toBe('flange')
    })

    it('handles simulated MountedArchives with missing tables', async () => {
      const mockArchive = {
        has(name: string) {
          const lower = name.toLowerCase()
          return lower.includes('patchstring') || lower.endsWith('\\string.tbl') || lower.endsWith('/string.tbl')
        },
        async read(name: string) {
          const lower = name.toLowerCase()
          if (lower.includes('patchstring')) {
            return encodeTbl([{ key: 'p_key', value: 'PatchVal' }])
          }
          if (lower.endsWith('\\string.tbl') || lower.endsWith('/string.tbl')) {
            return encodeTbl([{ key: 'b_key', value: 'BaseVal' }])
          }
          throw new Error('file not found')
        },
      }

      const chain = await loadStringTableChain(mockArchive as unknown as MountedArchives, 'ENG')
      expect(chain.tables.length).toBe(2)
      expect(chain.get('p_key')).toBe('PatchVal')
      expect(chain.get('b_key')).toBe('BaseVal')
    })
  })

  describe.skipIf(!hasD2)('1.13c MPQ Integration Tests (samples/d2)', () => {
    let archives: MountedArchives
    let engChain: StringTableChain
    let chiChain: StringTableChain

    beforeAll(async () => {
      archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }
      const loaded = await loadItemNameChains(archives)
      engChain = loaded.eng
      chiChain = loaded.chi
    })

    it('loads 3 tables for ENG chain and 2 tables for CHI chain', () => {
      expect(engChain.tables.length).toBe(3)
      expect(chiChain.tables.length).toBe(2)
      expect(engChain.lang).toBe('ENG')
      expect(chiChain.lang).toBe('CHI')
    })

    it('asserts ENG coverage on mounted MPQs: Armor 202/202, Weapons 306/306, Misc 143/151', async () => {
      // Armor coverage: 202/202
      const armor = await loadArmor(archives)
      expect(armor.all.length).toBe(202)
      let armorHits = 0
      for (const a of armor.all) {
        if (engChain.has(a.namestr)) armorHits++
      }
      expect(armorHits).toBe(202)

      // Weapons coverage: 306/306
      const weapons = await loadWeapons(archives)
      expect(weapons.all.length).toBe(306)
      let weaponHits = 0
      for (const w of weapons.all) {
        if (engChain.has(w.namestr)) weaponHits++
      }
      expect(weaponHits).toBe(306)

      // Misc coverage: 143/151 (8 unused placeholder potions like hpo, mpo are unmapped)
      const misc = await loadMisc(archives)
      expect(misc.all.length).toBe(151)
      let miscHits = 0
      const unmapped: string[] = []
      for (const m of misc.all) {
        if (engChain.has(m.namestr)) {
          miscHits++
        } else {
          unmapped.push(m.code)
        }
      }
      expect(miscHits).toBe(143)
      expect(unmapped).toEqual(['hpo', 'mpo', 'hpf', 'mpf', 'rps', 'rpl', 'bps', 'bpl'])
    })

    it('asserts CHI UTF-8 decoding: cap -> 帽子, tow -> 塔盾, axe -> 斧', () => {
      expect(resolveArmorName('cap', chiChain, engChain)).toBe('帽子')
      expect(resolveArmorName('tow', chiChain, engChain)).toBe('塔盾')
      expect(resolveWeaponName('axe', chiChain, engChain)).toBe('斧')

      // Also verify via direct resolveItemName
      expect(resolveItemName('cap', chiChain, engChain)).toBe('帽子')
      expect(resolveItemName('tow', chiChain, engChain)).toBe('塔盾')
      expect(resolveItemName('axe', chiChain, engChain)).toBe('斧')
    })

    it('asserts fallback to ENG when absent in CHI: r33 (Zod Rune), Windforce, Annihilus', async () => {
      // r33 (Zod Rune from Misc.txt)
      expect(chiChain.get('r33')).toBeUndefined()
      expect(engChain.get('r33')).toBe('Zod Rune')
      expect(resolveItemName('r33', chiChain, engChain)).toBe('Zod Rune')
      expect(resolveRuneName('r33', chiChain, engChain)).toBe('Zod Rune')

      // Windforce (Unique hydra bow from UniqueItems.txt)
      expect(chiChain.get('Windforce')).toBeUndefined()
      expect(engChain.get('Windforce')).toBe('Windforce')
      expect(resolveItemName('Windforce', chiChain, engChain)).toBe('Windforce')
      expect(resolveUniqueName('Windforce', chiChain, engChain)).toBe('Windforce')

      // Annihilus (Unique small charm from UniqueItems.txt)
      expect(chiChain.get('Annihilus')).toBeUndefined()
      expect(engChain.get('Annihilus')).toBe('Annihilus')
      expect(resolveItemName('Annihilus', chiChain, engChain)).toBe('Annihilus')
      expect(resolveUniqueName('Annihilus', chiChain, engChain)).toBe('Annihilus')
    })

    it('asserts Uniques: The Gnasher -> ENG "The Gnasher" / CHI "牙齒"', async () => {
      const uniques = await loadUniqueItems(archives)
      const gnasher = uniques.byIndex.get('The Gnasher')
      expect(gnasher).toBeDefined()

      expect(resolveUniqueName('The Gnasher', undefined, engChain)).toBe('The Gnasher')
      expect(resolveUniqueName('The Gnasher', chiChain, engChain)).toBe('牙齒')
      expect(resolveUniqueName(gnasher!, chiChain, engChain)).toBe('牙齒')
    })

    it("asserts Sets: Civerb's Ward -> CHI '希弗柏的防護'", async () => {
      const setData = await loadSetData(archives)
      const ward = setData.items.getByIndex("Civerb's Ward")
      expect(ward).toBeDefined()

      expect(resolveSetItemName("Civerb's Ward", undefined, engChain)).toBe("Civerb's Ward")
      expect(resolveSetItemName("Civerb's Ward", chiChain, engChain)).toBe('希弗柏的防護')
      expect(resolveSetItemName(ward!, chiChain, engChain)).toBe('希弗柏的防護')

      // Also check Sets.txt name resolution
      const vestments = setData.sets.getByIndex("Civerb's Vestments")
      expect(vestments).toBeDefined()
      expect(resolveSetName(vestments!, chiChain, engChain)).toBe('希弗伯的法衣')
    })

    it('asserts Runeword: Runeword26 -> "Doom"', () => {
      expect(engChain.get('Runeword26')).toBe('Doom')
      expect(chiChain.get('Runeword26')).toBeUndefined()
      expect(resolveRunewordName('Runeword26', chiChain, engChain)).toBe('Doom')
      expect(resolveRunewordName({ Name: 'Runeword26' }, chiChain, engChain)).toBe('Doom')
    })

    it('verifies namestr vs name distinction (e.g. hp1)', async () => {
      const misc = await loadMisc(archives)
      const hp1 = misc.byCode.get('hp1')
      expect(hp1).toBeDefined()

      // The raw table name is 'Lesser Healing Potion', but namestr is 'hp1'
      expect(hp1?.name).toBe('Lesser Healing Potion')
      expect(hp1?.namestr).toBe('hp1')

      // namestr resolves to 'Minor Healing Potion' in ENG and '輕微治療葯劑' in CHI
      expect(resolveMiscName(hp1!, undefined, engChain)).toBe('Minor Healing Potion')
      expect(resolveMiscName(hp1!, chiChain, engChain)).toBe('輕微治療葯劑')
    })

    it('asserts 100% Simplified Chinese tooltip-i18n parity with official CHI .tbl across all 14 item/affix tables', async () => {
      const {
        ITEM_NAMES_ZH,
        MAGIC_PREFIX_ZH,
        MAGIC_SUFFIX_ZH,
        RARE_PREFIX_ZH,
        RARE_SUFFIX_ZH,
        resolveBaseItemNameEn,
        resolveMagicNameEn,
        resolveRareNameEn,
        translateItemName,
        translateMagicName,
        translateRareName,
      } = await import('../src/common/i18n/tooltip-i18n.ts')
      const { parseTable } = await import('../src/common/items/tables.ts')

      const TRAD_TO_SIMP: Record<string, string> = {
        "髏": "髅", "頭": "头", "級": "级", "鑲": "镶", "鎖": "锁", "環": "环", "鱗": "鳞",
        "鏈": "链", "鍊": "链", "實": "实", "戰": "战", "鎧": "铠", "際": "际", "鐵": "铁",
        "圓": "圆", "輕": "轻", "織": "织", "飾": "饰", "屬": "属", "護": "护", "無": "无",
        "頰": "颊", "鋼": "钢", "連": "连", "網": "网", "鏽": "锈", "銹": "锈", "聖": "圣",
        "鯊": "鲨", "齒": "齿", "紋": "纹", "華": "华", "麗": "丽", "師": "师", "禦": "御",
        "龍": "龙", "惡": "恶", "場": "场", "爭": "争", "殘": "残", "權": "权", "獄": "狱",
        "雙": "双", "軍": "军", "鍬": "锹", "闊": "阔", "鬥": "斗", "偉": "伟", "釘": "钉",
        "錘": "锤", "鎚": "锤", "枷": "枷", "彎": "弯", "劍": "剑", "長": "长", "標": "标",
        "槍": "枪", "飛": "飞", "戟": "戟", "鐮": "镰", "節": "节", "獵": "猎", "組": "组",
        "藥": "药", "葯": "药", "劑": "剂", "誘": "诱", "餌": "饵", "腳": "脚", "馬": "马",
        "爐": "炉", "轉": "转", "軸": "轴", "強": "强", "鉗": "钳", "納": "纳", "鉤": "钩",
        "燒": "烧", "淨": "净", "噴": "喷", "鋸": "锯", "鞭": "鞭", "槌": "槌", "羅": "罗",
        "虛": "虚", "偽": "伪", "間": "间", "斬": "斩", "韓": "韩", "銳": "锐", "詩": "诗",
        "鏢": "镖", "蘭": "兰", "魚": "鱼", "亞": "亚", "柏": "柏", "爾": "尔", "鋒": "锋",
        "體": "体", "靈": "灵", "復": "复", "鏟": "铲", "開": "开", "費": "费", "瑪": "玛",
        "圖": "图", "後": "后", "勞": "劳", "銑": "铣", "維": "维", "達": "达", "備": "备",
        "綠": "绿", "紅": "红", "寶": "宝", "藍": "蓝", "製": "制", "獸": "兽", "鷹": "鹰",
        "鳥": "鸟", "屍": "尸", "斷": "断", "亂": "乱", "殺": "杀", "質": "质", "損": "损",
        "毀": "毁", "壞": "坏", "鑽": "钻", "黃": "黄", "學": "学", "衛": "卫", "閃": "闪",
        "電": "电", "凍": "冻", "風": "风", "書": "书", "識": "识", "視": "视", "鑰": "钥",
        "匙": "匙", "腦": "脑", "臟": "脏", "顎": "颚", "塊": "块", "異": "异", "陽": "阳",
        "專": "专", "擊": "击", "準": "准", "確": "确", "傷": "伤", "時": "时", "機": "机",
        "會": "会", "獲": "获", "減": "减", "緩": "缓", "釋": "释", "點": "点", "選": "选",
        "個": "个", "壽": "寿", "竊": "窃", "壓": "压", "撕": "撕", "驗": "验", "錢": "钱",
        "額": "额", "賭": "赌", "價": "价", "結": "结", "鴉": "鸦", "烏": "乌", "陰": "阴",
        "鮮": "鲜", "懼": "惧", "滅": "灭", "榮": "荣", "勝": "胜", "義": "义", "審": "审",
        "懲": "惩", "罰": "罚", "贖": "赎", "潔": "洁", "墮": "堕", "敗": "败", "劇": "剧",
        "詛": "诅", "霧": "雾", "裝": "装", "脛": "胫", "帶": "带", "勳": "勋", "繞": "绕",
        "萊": "莱", "鐲": "镯", "頸": "颈", "賓": "宾", "緣": "缘", "針": "针", "喬": "乔",
        "鎮": "镇", "傳": "传", "頂": "顶", "塚": "冢", "彈": "弹", "療": "疗", "幟": "帜",
        "渦": "涡", "慟": "恸", "兇": "凶", "樹": "树", "喪": "丧", "鐘": "钟", "堅": "坚",
        "邊": "边", "昇": "升", "裡": "里", "裏": "里", "將": "将", "輓": "挽", "庫": "库",
        "溫": "温", "剝": "剥", "麥": "麦", "錐": "锥", "鷗": "鸥", "張": "张", "該": "该",
        "採": "采", "煩": "烦", "惱": "恼", "禍": "祸", "檢": "检", "氣": "气", "謝": "谢",
        "蘿": "萝", "畫": "画", "響": "响", "導": "导", "擲": "掷", "畢": "毕", "軟": "软",
        "處": "处", "號": "号", "臉": "脸", "觀": "观", "動": "动", "掙": "挣", "擴": "扩",
        "籠": "笼", "絲": "丝", "綢": "绸", "盤": "盘", "牆": "墙", "貝": "贝", "紀": "纪",
        "運": "运", "熱": "热", "凱": "凯", "淚": "泪", "煙": "烟", "諾": "诺", "遺": "遗",
        "國": "国", "項": "项", "線": "线", "繩": "绳", "殼": "壳", "襲": "袭", "誕": "诞",
        "剛": "刚", "極": "极", "縛": "缚", "詭": "诡", "計": "计", "壯": "壮", "迴": "回",
        "穩": "稳", "蠻": "蛮", "絕": "绝", "詐": "诈", "銅": "铜", "銀": "银", "隕": "陨",
        "騎": "骑", "發": "发", "稜": "棱", "鏡": "镜", "棗": "枣", "翠": "翠", "銘": "铭",
        "喚": "唤", "楬": "褐", "擋": "挡", "衝": "冲", "廢": "废", "測": "测", "現": "现",
        "財": "财", "貪": "贪", "幸": "幸", "術": "术", "蟲": "虫", "進": "进", "醫": "医",
        "簡": "简", "樸": "朴", "薔": "蔷", "願": "愿", "繪": "绘", "慘": "惨", "難": "难",
        "規": "规", "奪": "夺", "剋": "克", "編": "编", "紗": "纱", "隱": "隐", "記": "记",
        "徵": "征", "緊": "紧", "觸": "触", "潛": "潜", "躪": "躏", "蹤": "踪", "釦": "扣",
        "捲": "卷", "條": "条", "綁": "绑", "層": "层", "豎": "竖", "蒼": "苍", "鈷": "钴",
        "農": "农", "膿": "脓", "茲": "兹", "鍵": "键", "數": "数",
      }
      const toSimp = (s: string) =>
        [...s].map(ch => TRAD_TO_SIMP[ch] ?? ch).join('')
      const titleLine = (s: string) => {
        const parts = s.trim().split(/\r?\n/).map(p => p.trim()).filter(Boolean)
        return parts[parts.length - 1] ?? s.trim()
      }
      const readTxt = async (name: string) =>
        parseTable(new TextDecoder().decode(await archives.read(`data/global/excel/${name}`)))

      // 1. Armor, Weapons, Misc
      for (const fn of ['armor.txt', 'weapons.txt', 'misc.txt']) {
        const t = await readTxt(fn)
        for (const r of t.rows) {
          const code = (r['code'] || '').trim()
          const namestr = (r['namestr'] || code).trim()
          const txtName = (r['name'] || '').trim()
          if (!code || code === 'Expansion' || txtName.startsWith('*')) continue
          const engRaw = engChain.get(namestr) ?? engChain.get(namestr + ' ')
          if (!engRaw) continue
          const expectedEn = titleLine(engRaw)
          expect(resolveBaseItemNameEn(txtName, code)).toBe(expectedEn)

          const chiRaw = (chiChain.get(namestr) ?? chiChain.get(namestr + ' '))?.trim()
          if (chiRaw && code !== 'hst') {
            const expectedZh = toSimp(titleLine(chiRaw))
            expect(translateItemName(txtName, code)).toBe(expectedZh)
            expect(translateItemName(expectedEn, code)).toBe(expectedZh)
          }
        }
      }
      expect(ITEM_NAMES_ZH['hst']).toBe('赫拉迪克之杖')
      expect(ITEM_NAMES_ZH['Horadric Staff']).toBe('赫拉迪克法杖')

      // 2. UniqueItems.txt, SetItems.txt, Sets.txt, Runes.txt, LowQualityItems.txt
      for (const [fn, col] of [
        ['UniqueItems.txt', 'index'],
        ['SetItems.txt', 'index'],
        ['Sets.txt', 'name'],
        ['Runes.txt', 'Name'],
        ['LowQualityItems.txt', 'Name'],
      ] as const) {
        const t = await readTxt(fn)
        for (const r of t.rows) {
          if (fn === 'UniqueItems.txt' && r['enabled']?.trim() !== '1') continue
          if (fn === 'Runes.txt' && r['complete']?.trim() !== '1') continue
          const k = (r[col] || '').trim()
          if (!k || k === 'Expansion' || k.startsWith('*')) continue
          const chiRaw = (chiChain.get(k) ?? chiChain.get(k + ' '))?.trim()
          if (chiRaw) {
            expect(translateItemName(k)).toBe(toSimp(titleLine(chiRaw)))
          } else {
            expect(translateItemName(k)).not.toBe(k)
          }
        }
      }

      // 3. MagicPrefix.txt, MagicSuffix.txt, AutoMagic.txt, RarePrefix.txt, RareSuffix.txt
      for (const fn of ['MagicPrefix.txt', 'AutoMagic.txt'] as const) {
        const t = await readTxt(fn)
        for (const r of t.rows) {
          const k = (r['Name'] || '').trim()
          if (!k || k === 'Expansion' || k.startsWith('*')) continue
          if (fn === 'AutoMagic.txt' && k.startsWith('of ')) continue
          const engVal = (engChain.get(k) ?? engChain.get(k + ' ') ?? k).trim()
          const chiRaw = (chiChain.get(k) ?? chiChain.get(k + ' '))?.trim()
          if (chiRaw) {
            const expectedZh = toSimp(chiRaw)
            expect(MAGIC_PREFIX_ZH[k]).toBe(expectedZh)
            expect(MAGIC_PREFIX_ZH[engVal]).toBe(expectedZh)
          } else {
            expect(MAGIC_PREFIX_ZH[k]).toBeDefined()
            expect(MAGIC_PREFIX_ZH[engVal]).toBeDefined()
          }
        }
      }

      for (const fn of ['MagicSuffix.txt', 'AutoMagic.txt'] as const) {
        const t = await readTxt(fn)
        for (const r of t.rows) {
          const k = (r['Name'] || '').trim()
          if (!k || k === 'Expansion' || k.startsWith('*')) continue
          if (fn === 'AutoMagic.txt' && !k.startsWith('of ')) continue
          const engVal = (engChain.get(k) ?? engChain.get(k + ' ') ?? k).trim()
          const chiRaw = (chiChain.get(k) ?? chiChain.get(k + ' '))?.trim()
          if (chiRaw) {
            const expectedZh = toSimp(chiRaw)
            expect(MAGIC_SUFFIX_ZH[k]).toBe(expectedZh)
            expect(MAGIC_SUFFIX_ZH[engVal]).toBe(expectedZh)
          } else {
            expect(MAGIC_SUFFIX_ZH[k]).toBeDefined()
            expect(MAGIC_SUFFIX_ZH[engVal]).toBeDefined()
            expect(MAGIC_SUFFIX_ZH[k]!.endsWith('之')).toBe(false)
          }
        }
      }

      for (const r of (await readTxt('RarePrefix.txt')).rows) {
        const k = (r['name'] || '').trim()
        if (!k || k === 'Expansion' || k.startsWith('*')) continue
        const engVal = (engChain.get(k) ?? k).trim()
        const chiRaw = chiChain.get(k)?.trim()
        if (chiRaw) {
          const expectedZh = toSimp(chiRaw)
          expect(RARE_PREFIX_ZH[k]).toBe(expectedZh)
          expect(RARE_PREFIX_ZH[engVal]).toBe(expectedZh)
        }
      }

      for (const r of (await readTxt('RareSuffix.txt')).rows) {
        const k = (r['name'] || '').trim()
        if (!k || k === 'Expansion' || k.startsWith('*')) continue
        const engVal = (engChain.get(k) ?? k).trim()
        const chiRaw = chiChain.get(k)?.trim()
        if (chiRaw) {
          const expectedZh = toSimp(chiRaw)
          expect(RARE_SUFFIX_ZH[k]).toBe(expectedZh)
          expect(RARE_SUFFIX_ZH[engVal]).toBe(expectedZh)
        }
      }

      // Spot-check key .tbl disambiguations
      expect(resolveMagicNameEn("Mechanist's Plate Mail of the Colosuss", 'Plate Mail', "Mechanist's", 'of the Colosuss', 'plt')).toBe("Mechanic's Plate Mail of the Colossus")
      expect(translateMagicName("Mechanist's Plate Mail of the Colosuss", 'Plate Mail', "Mechanist's", 'of the Colosuss', 'plt')).toBe('机械师之太阳神的铠甲')
      expect(translateMagicName('Blank Amulet of Warmth', 'Amulet', 'Blank', 'of Warmth', 'amu')).toBe('虚无之融解的护身符')
      expect(resolveRareNameEn('GhoulRI bite', 'GhoulRI', 'bite')).toBe('Ghoul Bite')
      expect(translateRareName('GhoulRI bite', 'GhoulRI', 'bite')).toBe('食尸鬼之咬')
    })
  })
})
