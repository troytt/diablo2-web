/**
 * Generates src/data/skills-catalog.ts with full Blizzard 1.13c ground-truth
 * skill properties, English and Chinese localized descriptions, 5-band damage progression,
 * mana formulas, and synergy networks.
 */

import { MpqArchive } from '../../common/mpq/archive.ts'
import { fileSource } from '../io/file-source.ts'
import { MountedArchives } from '../../common/mpq/mount.ts'
import { decodeTbl } from '../../common/formats/tbl.ts'
import { loadActTables } from '../../common/world/acts.ts'
import { CANONICAL_SKILL_TREE } from '../../common/skills/skill-tree.ts'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CLASS_NAMES_ZH: Record<string, string> = {
  ama: '亚马逊',
  sor: '法师',
  nec: '死灵法师',
  pal: '圣骑士',
  bar: '野蛮人',
  dru: '德鲁伊',
  ass: '刺客',
}

const TAB_NAMES_ZH: Record<string, readonly string[]> = {
  ama: ['弓与弩技能', '被动与魔法技能', '标枪与长矛技能'],
  sor: ['火焰法术', '闪电法术', '冰冷法术'],
  nec: ['诅咒', '毒素与白骨法术', '召唤法术'],
  pal: ['作战技能', '攻击灵气', '防御灵气'],
  bar: ['战斗技能', '战斗专家', '呐喊'],
  dru: ['召唤技能', '变形技能', '元素技能'],
  ass: ['陷阱', '暗影武艺', '武学艺术'],
}

const EXPANSION_SKILL_NAMES_ZH: Record<number, string> = {
  // Druid
  221: '乌鸦', 222: '毒藤', 223: '狼人变化', 224: '变形术', 225: '火风暴',
  226: '橡木智者', 227: '召唤恶狼', 228: '熊人变化', 229: '熔岩巨石', 230: '极地风暴',
  231: '食尸藤', 232: '狂犬病', 233: '太阳藤', 234: '裂地', 235: '旋风甲',
  236: '狼獾之心', 237: '召唤狂狼', 238: '狂怒', 239: '撞击', 240: '龙卷风',
  241: '枯萎藤', 242: '火爪', 243: '震波', 244: '火山', 245: '暴风',
  246: '灵之守护', 247: '召唤灰熊', 248: '狂怒', 249: '末日浩劫', 250: '毁天灭地',
  // Assassin
  251: '火爆', 252: '爪支配', 253: '心灵震爆', 254: '虎击', 255: '龙爪',
  256: '电能网', 257: '刃之小刀', 258: '加速', 259: '双手挥舞', 260: '眼镜蛇打击',
  261: '闪电手雷', 262: '火之复生', 263: '武器格挡', 264: '魔影斗篷', 265: '飞龙在天',
  266: '雷电爪', 267: '消解', 268: '狂怒刃', 269: '复仇之火', 270: '影分身',
  271: '寒冰刃', 272: '龙尾', 273: '雷光守卫', 274: '火焰复苏', 275: '刃之护盾',
  276: '毒牙', 277: '暗影大师', 278: '飞龙升天', 279: '死亡守卫', 280: '凤凰攻击',
}

const EXPANSION_SKILL_DESC_ZH: Record<number, { short: string; long: string }> = {
  221: { short: '召唤乌鸦啄瞎敌人', long: '召唤乌鸦啄击敌人眼睛，降低其视野' },
  222: { short: '召唤毒藤在地下散播毒素', long: '毒藤在地下穿行，让接触的敌人中毒' },
  223: { short: '变身为狼人形态', long: '提升攻击速度、准确率和移动速度' },
  224: { short: '提升变身形态的生命与持续时间', long: '被动提升狼人和熊人形态的最大生命值和变形持续时间' },
  225: { short: '向前方喷射混乱的地表烈火', long: '在地面释放多道混乱游走的烈焰裂隙' },
  226: { short: '召唤提升全队最大生命值的自然之灵', long: '光环增加附近所有队友的最大生命值' },
  227: { short: '召唤恶狼协助战斗', long: '召唤狼群撕咬敌人，提升自身命中' },
  228: { short: '变身为巨熊形态', long: '大幅提升防御力、生命值和打击力量' },
  229: { short: '发射滚动的熔岩火球击退敌人', long: '火石沿直线滚向敌人，造成物理和火焰双重爆炸伤害' },
  230: { short: '引导一道连续的严寒冻气', long: '持续喷射极地寒冰冻结并减速前方敌人' },
  231: { short: '召唤食尸藤吞噬尸体回复生命', long: '在地下吞噬倒下的怪物尸体，为德鲁伊回复生命' },
  232: { short: '狼人撕咬敌人传播剧毒传染病', long: '撕咬使目标感染狂犬病毒，毒素会快速传染给周围怪物' },
  233: { short: '召唤太阳藤吞噬尸体回复法力', long: '吞噬死去的怪物尸体，为德鲁伊持续回复法力值' },
  234: { short: '撕裂大地喷发地热蒸汽与熔火', long: '在地面裂隙中喷发出炽热地火' },
  235: { short: '召唤环绕身躯的旋风护盾吸收元素伤害', long: '吸收即将到来的火焰、冰冷和闪电元素伤害' },
  236: { short: '召唤提升全队物理伤害与准确率的灵体', long: '狼獾图腾提升周围所有同伴的物理伤害与攻击命中' },
  237: { short: '召唤更加凶残狂暴的狂狼', long: '狂狼可以吃下死者尸体进入狂乱嗜血状态' },
  238: { short: '狼人连续疯狂撕咬周围的所有敌人', long: '对周围复数敌人发动疾风骤雨般的连续强力撕咬' },
  239: { short: '熊人沉重重击击晕并重创敌人', long: '熊掌沉重拍击地面，将敌人震晕并击退' },
  240: { short: '释放多道不可预测的毁灭龙卷风', long: '向前方释放穿透撕裂敌人的强力物理龙卷风' },
  241: { short: '召唤藤蔓缠绕吸收毒素', long: '从敌人体内吸取并中和毒素' },
  242: { short: '变身形态下的烈焰利爪攻击', long: '在狼人或熊人形态下发动附加高额火焰伤害的利爪攻击' },
  243: { short: '熊人咆哮震出大范围冲击波击晕敌人', long: '熊吼发出锥形震波，大范围击晕所有前方敌人' },
  244: { short: '在地面引发微型火山喷发火球', long: '在指定位置升起火山，持续喷吐炽热石块砸向周围敌人' },
  245: { short: '在身周召唤严寒暴风席卷敌人', long: '环绕德鲁伊旋转的极寒风暴，持续对近身敌人造成冰冷伤害' },
  246: { short: '召唤带有荆棘反伤效果的自然之灵', long: '反弹受到的物理伤害给近战攻击者' },
  247: { short: '召唤威猛无比的森林灰熊', long: '召唤强大的巨熊，具备极高的生命值与重击压制力' },
  248: { short: '狼人狂暴撕咬', long: '连续撕咬目标' },
  249: { short: '天降冰霜陨石撕碎战场', long: '从天空降下极寒冰彗星轰炸全场' },
  250: { short: '天降烈火流星轰炸战场', long: '持续在德鲁伊身边下落炽热陨石与熔岩碎片' },

  251: { short: '投掷小型火焰爆炸炸弹', long: '投掷可以弹跳并爆炸的手雷，造成小范围火焰伤害' },
  252: { short: '提升爪类武器的伤害、命中与暴击', long: '被动提升使用爪类武器时的战斗效能' },
  253: { short: '释放精神冲击击退并转换敌人', long: '震慑目标心智，使其陷入昏迷甚至暂时为你作战' },
  254: { short: '武术聚气：积聚毁灭性的物理近战能量', long: '最多积聚3段气劲，释放时造成毁天灭地的巨大物理爆发' },
  255: { short: '连续飞腿踢击单个目标', long: '随着技能等级提高，发动2次至5次超快速的连续旋风踢' },
  256: { short: '在地面投下一道电能火花陷阱网', long: '电能网在地面停留，对踩上的敌人造成持续电击' },
  257: { short: '掷出飞刀穿透沿途敌人', long: '投射旋转利刃切入敌群' },
  258: { short: '短时间内大幅提升攻击与移动速度', long: '进入加速状态，脚步如飞，出招极快' },
  259: { short: '双持爪具同时挥击', long: '双手爪具同时砍向敌人' },
  260: { short: '武术聚气：吸取敌人的生命与法力', long: '3段聚气分别吸取生命、法力，以及两者兼顾' },
  261: { short: '投掷充能弹陷阱手雷', long: '落地后释放大量蜿蜒前行的充能电火花' },
  262: { short: '埋设火焰浪潮喷射陷阱', long: '当敌人接近时自动向前方喷射烈焰波浪' },
  263: { short: '双持爪类武器时格挡敌人的攻击', long: '甚至可以格挡法术飞弹与远程攻击' },
  264: { short: '唤来暗影帷幕降低敌人视野与防御', long: '使全场陷入致盲暗影，极大降低怪物的防御力' },
  265: { short: '瞬间传送到目标身旁发动强力重踢', long: '跨越障碍瞬移至敌人面前施展终结飞踢' },
  266: { short: '武术聚气：积聚连锁闪电能量', long: '3段聚气释放电球、充能弹以及连锁闪电' },
  267: { short: '提高所有元素抗性与物理伤害减免', long: '身躯半虚无化，减少受到的诅咒持续时间和所有伤害' },
  268: { short: '向周围四方狂暴发射飞舞的利刃', long: '引导飞刀风暴绞杀四周一切敌人' },
  269: { short: '释放持续追踪燃烧的火焰之墙', long: '在地面制造一道燃烧的火墙' },
  270: { short: '召唤刺客的暗影斗士同伴', long: '暗影斗士会模仿刺客当前快捷栏上的技能进行战斗' },
  271: { short: '武术聚气：积聚严寒冰霜风暴', long: '3段聚气分别冻结单体、冻结周围以及引发冰爆' },
  272: { short: '终结飞踢引发巨大烈焰冲击波', long: '释放聚气造成巨额火焰爆破并击退所有近身敌人' },
  273: { short: '安放强大的雷光守卫陷阱', long: '刺客核心陷阱，持续发射高伤害的穿透穿刺穿透雷光束' },
  274: { short: '安放火焰复苏地雷陷阱', long: '持续向周围四方喷射火焰新星' },
  275: { short: '召唤围绕身旁的利刃旋涡护甲', long: '环绕身躯的飞刀切碎任何企图近身的敌人' },
  276: { short: '给爪具和武器涂抹致命剧毒', long: '短时间内使所有武器攻击附带极高毒素伤害' },
  277: { short: '召唤拥有全部刺客技能的高阶暗影大师', long: '暗影大师具备极强的抗性与AI，能自主施展刺客全套技能' },
  278: { short: '跳跃至空中施展从天而降的终结重踏', long: '跃向半空踢翻目标并释放积聚的武学能量' },
  279: { short: '安放引爆附近死尸的死亡守卫陷阱', long: '引爆死去的怪物尸体造成尸爆，并能发射闪电' },
  280: { short: '武术终极聚气：召唤凤凰的烈焰、闪电与冰霜', long: '1段聚气陨石，2段聚气连锁闪电，3段聚气极寒冰晶' },
}

interface SynergyParsed {
  providerName: string
  providerId: number
  percentPerLevel: number
  type: 'damage' | 'elemental' | 'duration'
}

const EXPANSION_EXTRA_STRINGS_ZH: Record<string, string> = {
  ESkillHawk: '乌鸦：',
  ESkillWolves: '狼：',
  EskillLifeSteal: '生命偷取：',
  EskillManaSteal: '法力偷取：',
  Eskillpowerup1: '聚气 1 段 -',
  Eskillpowerup2: '聚气 2 段 -',
  Eskillpowerup3: '聚气 3 段 -',
  Eskillpuddgmper: '% 伤害',
  Eskillkickdamage: '踢击伤害：',
  EskillKickSing: '踢',
  EskillKickPlur: '踢',
  ESkillSpikes: '地刺：',
  Eskillfistsoffire1: '火焰伤害：',
  Eskillfistsoffire2: '火焰伤害范围：',
  ESkillShoots: '发射',
  ESkillTimes: '次',
  Eskillpudmana: '% 生命与法力偷取',
  Eskillpudlife: '% 生命偷取',
  EskillPerBlade: '每枚利刃',
  Eskillthunder1: '闪电伤害：',
  Eskillthunder2: '闪电新星伤害：',
  Eskillthunder3: '充能弹伤害：',
  Eskillbladesofice1: '冰冷伤害：',
  Eskillbladesofice2: '冰冷伤害范围：',
  Eskillbladesofice3: '冻结时间：',
  Eskillphoenix1: '陨石伤害：',
  Eskillphoenix2: '连锁闪电伤害：',
  Eskillphoenix3: '混沌冰球伤害：',
}

function parseSynergyFormula(formula: string, params: Record<string, number>, nameToId: Map<string, number>): SynergyParsed[] {
  if (!formula || typeof formula !== 'string') return []
  const result: SynergyParsed[] = []

  // Pattern: skill('Skill Name'.blvl) * par8 or (skill('A'.blvl) + skill('B'.blvl)) * par8
  // Or: skill('A'.blvl)*par8 + skill('B'.blvl)*par7
  const re = /skill\(['"]([^'"]+)['"]\.blvl\)(?:\s*\*\s*([a-zA-Z0-9_]+))?/g
  let match: RegExpExecArray | null
  while ((match = re.exec(formula)) !== null) {
    const providerName = match[1]!
    const paramKey = match[2] || 'par8'
    let percent = 0
    if (/^\d+$/.test(paramKey)) {
      percent = Number(paramKey)
    } else {
      percent = params[paramKey] ?? 0
    }
    const providerId = nameToId.get(providerName.toLowerCase()) ?? 0
    if (providerId > 0) {
      result.push({
        providerName,
        providerId,
        percentPerLevel: percent,
        type: 'elemental',
      })
    }
  }

  // Also check if formula had form `(skill('A'.blvl)+skill('B'.blvl))*parX`
  if (result.length === 0) {
    const outerMatch = /\(([^)]+)\)\s*\*\s*([a-zA-Z0-9_]+)/.exec(formula)
    if (outerMatch) {
      const inner = outerMatch[1]!
      const paramKey = outerMatch[2]!
      const percent = /^\d+$/.test(paramKey) ? Number(paramKey) : (params[paramKey] ?? 0)
      const innerRe = /skill\(['"]([^'"]+)['"]\.blvl\)/g
      let m: RegExpExecArray | null
      while ((m = innerRe.exec(inner)) !== null) {
        const providerName = m[1]!
        const providerId = nameToId.get(providerName.toLowerCase()) ?? 0
        if (providerId > 0) {
          result.push({
            providerName,
            providerId,
            percentPerLevel: percent,
            type: 'elemental',
          })
        }
      }
    }
  }

  return result
}

async function main() {
  console.log('Mounting MPQ archives...')
  const archives = new MountedArchives()
  for (const m of ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
    archives.add(m, await MpqArchive.open(await fileSource(`samples/d2/${m}`)))
  }

  const tables = await loadActTables(archives)
  const skillsTable = tables.skills!
  const skillDescTable = tables.skilldesc!
  const monstatsTable = tables.monstats!

  const engTbl = decodeTbl(await archives.read('data\\local\\LNG\\ENG\\string.tbl'))
  const engExpTbl = decodeTbl(await archives.read('data\\local\\LNG\\ENG\\expansionstring.tbl'))
  const engPatchTbl = decodeTbl(await archives.read('data\\local\\LNG\\ENG\\patchstring.tbl'))

  const chiTbl = decodeTbl(await archives.read('data\\local\\LNG\\CHI\\string.tbl'), 'utf-8')
  const chiPatchTbl = decodeTbl(await archives.read('data\\local\\LNG\\CHI\\patchstring.tbl'), 'utf-8')

  function getStrings(key: string): { en: string; zh: string } {
    if (!key) return { en: '', zh: '' }
    const en = engPatchTbl.dict.get(key) || engExpTbl.dict.get(key) || engTbl.dict.get(key) || key
    const zh = EXPANSION_EXTRA_STRINGS_ZH[key] || chiPatchTbl.dict.get(key) || chiTbl.dict.get(key) || en
    return { en: en.trim(), zh: zh.trim() }
  }

  // Load scratch/skills_extracted.json
  const extractedRaw = JSON.parse(readFileSync('scratch/skills_extracted.json', 'utf8'))
  const extractedById = new Map<number, any>()
  for (const item of extractedRaw) {
    extractedById.set(item.id, item)
  }

  // Build name to ID map
  const nameToId = new Map<string, number>()
  for (const node of CANONICAL_SKILL_TREE) {
    nameToId.set(node.name.toLowerCase(), node.id)
  }

  const catalog: any[] = []
  const skillsById: Record<number, any> = {}

  for (const node of CANONICAL_SKILL_TREE) {
    const id = node.id
    const ext = extractedById.get(id) || {}
    const cls = node.classCode
    const tabIndex = node.tabIndex

    const tabNameEn = node.tabName
    const tabNameZh = TAB_NAMES_ZH[cls]?.[tabIndex] || tabNameEn

    // Look up SkillDesc row
    const skillRow = skillsTable.rows.find(r => Number(r[1]) === id)
    const descName = skillRow ? skillRow[3] : ''
    const descRow = skillDescTable.rows.find(d => d[0]?.toLowerCase() === descName?.toLowerCase())

    const nameKey = descRow ? descRow[7] : ''
    const shortKey = descRow ? descRow[8] : ''
    const longKey = descRow ? descRow[9] : ''

    const nameObj = getStrings(nameKey)
    let nameEn = nameObj.en || node.name
    let nameZh = nameObj.zh || nameEn
    if (EXPANSION_SKILL_NAMES_ZH[id]) {
      nameZh = EXPANSION_SKILL_NAMES_ZH[id]!
    }

    const shortObj = getStrings(shortKey)
    let shortEn = shortObj.en
    let shortZh = shortObj.zh
    if (EXPANSION_SKILL_DESC_ZH[id]) {
      shortZh = EXPANSION_SKILL_DESC_ZH[id]!.short
    }

    const longObj = getStrings(longKey)
    let longEn = longObj.en
    let longZh = longObj.zh
    if (EXPANSION_SKILL_DESC_ZH[id]) {
      longZh = EXPANSION_SKILL_DESC_ZH[id]!.long
    }

    // Combine params
    const params: Record<string, number> = {}
    if (node.params) {
      for (const [k, v] of Object.entries(node.params)) {
        if (typeof v === 'number') params[k] = v
      }
    }
    if (ext.Param && Array.isArray(ext.Param)) {
      ext.Param.forEach((val: any, idx: number) => {
        const num = Number(val)
        if (!isNaN(num) && num !== 0) {
          params[`par${idx + 1}`] = num
        }
      })
    }

    // Parse synergies received
    const synList: SynergyParsed[] = []
    if (node.synergyFormulas.elemental) {
      synList.push(...parseSynergyFormula(node.synergyFormulas.elemental, params, nameToId))
    }
    if (node.synergyFormulas.physical) {
      synList.push(...parseSynergyFormula(node.synergyFormulas.physical, params, nameToId))
    }
    if (node.synergyFormulas.duration) {
      synList.push(...parseSynergyFormula(node.synergyFormulas.duration, params, nameToId))
    }

    // Determine masteries that apply
    const masteries: number[] = []
    if (cls === 'sor') {
      if (ext.EType === 'fire' && id !== 61) masteries.push(61) // Fire Mastery
      if (ext.EType === 'ltng' && id !== 63) masteries.push(63) // Lightning Mastery
      if (ext.EType === 'cold' && id !== 65) masteries.push(65) // Cold Mastery
    } else if (cls === 'pal') {
      if (id === 112) masteries.push(113) // Concentration applies to Blessed Hammer
    } else if (cls === 'ass') {
      if (['Tiger Strike', 'Dragon Talon', 'Fists of Fire', 'Dragon Claw', 'Cobra Strike', 'Claws of Thunder', 'Dragon Tail', 'Blades of Ice', 'Dragon Flight'].includes(node.name)) {
        masteries.push(252) // Claw Mastery
      }
    }

    // Extract descdam
    const descdam = descRow ? (descRow[skillDescTable.header.indexOf('descdam')] || '') : ''

    // Extract descLines (descline1..6)
    const descLines: any[] = []
    if (descRow) {
      for (let i = 1; i <= 6; i++) {
        const lStr = descRow[skillDescTable.header.indexOf(`descline${i}`)]
        const lNum = Number(lStr)
        if (lNum && lNum > 0 && lNum !== 1) {
          const textaKey = descRow[skillDescTable.header.indexOf(`desctexta${i}`)] || ''
          const textbKey = descRow[skillDescTable.header.indexOf(`desctextb${i}`)] || ''
          const calca = descRow[skillDescTable.header.indexOf(`desccalca${i}`)] || ''
          const calcb = descRow[skillDescTable.header.indexOf(`desccalcb${i}`)] || ''
          const aObj = getStrings(textaKey)
          const bObj = getStrings(textbKey)
          descLines.push({
            lineType: lNum,
            textaKey: textaKey || undefined,
            textbKey: textbKey || undefined,
            textaEn: aObj.en || undefined,
            textaZh: aObj.zh || undefined,
            textbEn: bObj.en || undefined,
            textbZh: bObj.zh || undefined,
            calca: calca || undefined,
            calcb: calcb || undefined,
          })
        }
      }
    }

    // Extract dsc2Lines (dsc2line1..4)
    const dsc2Lines: any[] = []
    if (descRow) {
      for (let i = 1; i <= 4; i++) {
        const lStr = descRow[skillDescTable.header.indexOf(`dsc2line${i}`)]
        const lNum = Number(lStr)
        if (lNum && lNum > 0 && lNum !== 1) {
          const textaKey = descRow[skillDescTable.header.indexOf(`dsc2texta${i}`)] || ''
          const textbKey = descRow[skillDescTable.header.indexOf(`dsc2textb${i}`)] || ''
          const calca = descRow[skillDescTable.header.indexOf(`dsc2calca${i}`)] || ''
          const calcb = descRow[skillDescTable.header.indexOf(`dsc2calcb${i}`)] || ''
          const aObj = getStrings(textaKey)
          const bObj = getStrings(textbKey)
          dsc2Lines.push({
            lineType: lNum,
            textaKey: textaKey || undefined,
            textbKey: textbKey || undefined,
            textaEn: aObj.en || undefined,
            textaZh: aObj.zh || undefined,
            textbEn: bObj.en || undefined,
            textbZh: bObj.zh || undefined,
            calca: calca || undefined,
            calcb: calcb || undefined,
          })
        }
      }
    }

    // Check minion summoning stats from MonStats.txt
    const summonCode = skillRow ? skillRow[skillsTable.header.indexOf('summon')] : ''
    let minionStats: any = undefined
    if (summonCode && summonCode !== '') {
      const mRow = monstatsTable.rows.find(r => r[0]?.toLowerCase() === summonCode.toLowerCase())
      if (mRow) {
        minionStats = {
          code: summonCode,
          minHP: Number(mRow[monstatsTable.header.indexOf('minHP')]) || 0,
          maxHP: Number(mRow[monstatsTable.header.indexOf('maxHP')]) || 0,
          minDam: Number(mRow[monstatsTable.header.indexOf('A1MinD')]) || 0,
          maxDam: Number(mRow[monstatsTable.header.indexOf('A1MaxD')]) || 0,
        }
      }
    }

    const entry = {
      id,
      name: nameEn,
      nameZh,
      classCode: cls,
      classNameZh: CLASS_NAMES_ZH[cls],
      tabIndex,
      tabName: tabNameEn,
      tabNameZh,
      row: node.row,
      col: node.col,
      reqlevel: node.reqlevel,
      reqskills: node.reqskills,
      dependents: node.dependents,

      // Mana
      mana: ext.mana ?? 0,
      lvlmana: ext.lvlmana ?? 0,
      minmana: ext.minmana ?? 0,
      manashift: ext.manashift ?? 8,
      delay: ext.delay ?? 0,

      // Damage & mechanics
      descdam,
      hitshift: ext.HitShift ?? 0,
      srcDamage: ext.SrcDam ?? 0,
      minDam: ext.MinDam ?? 0,
      maxDam: ext.MaxDam ?? 0,
      minLevDam: ext.MinLevDam ?? [0, 0, 0, 0, 0],
      maxLevDam: ext.MaxLevDam ?? [0, 0, 0, 0, 0],

      eType: ext.EType ?? '',
      eMin: ext.EMin ?? 0,
      eMax: ext.EMax ?? 0,
      eMinLev: ext.EMinLev ?? [0, 0, 0, 0, 0],
      eMaxLev: ext.EMaxLev ?? [0, 0, 0, 0, 0],
      eLen: ext.ELen ?? 0,
      eLevLen: ext.ELevLen ?? [0, 0, 0],

      params,
      synergyFormulas: node.synergyFormulas,
      synergiesReceived: synList,
      synergiesGiven: [] as any[],
      masteries,
      descLines,
      dsc2Lines,
      minionStats,

      shortDesc: shortEn,
      shortDescZh: shortZh,
      longDesc: longEn,
      longDescZh: longZh,
      icon: `/skills/icon_${id}.png`,
      iconActive: `/skills/icon_${id}_active.png`,
    }

    catalog.push(entry)
    skillsById[id] = entry
  }

  // Populate synergies given
  for (const node of catalog) {
    for (const syn of node.synergiesReceived) {
      if (skillsById[syn.providerId]) {
        skillsById[syn.providerId].synergiesGiven.push({
          targetId: node.id,
          targetName: node.name,
          targetNameZh: node.nameZh,
          percentPerLevel: syn.percentPerLevel,
        })
      }
    }
  }

  console.log(`Successfully compiled ${catalog.length} skills with synergy networks! Writing file...`)

  const tsContent = `// Auto-generated Diablo II 1.13c 210-Skill Catalog
// Ground truth parsed from Skills.txt, SkillDesc.txt, string.tbl, and MPQs.

import type { CharacterClassCode } from '../units/classes.ts'

export interface SynergyBonusInfo {
  readonly providerId: number
  readonly providerName: string
  readonly percentPerLevel: number
  readonly type: 'damage' | 'elemental' | 'duration'
}

export interface SynergyGivenInfo {
  readonly targetId: number
  readonly targetName: string
  readonly targetNameZh: string
  readonly percentPerLevel: number
}

export interface DescLineDefinition {
  readonly lineType: number
  readonly textaKey?: string | undefined
  readonly textbKey?: string | undefined
  readonly textaEn?: string | undefined
  readonly textaZh?: string | undefined
  readonly textbEn?: string | undefined
  readonly textbZh?: string | undefined
  readonly calca?: string | undefined
  readonly calcb?: string | undefined
}

export interface MinionBaseStats {
  readonly code: string
  readonly minHP: number
  readonly maxHP: number
  readonly minDam: number
  readonly maxDam: number
}

export interface SkillCatalogEntry {
  readonly id: number
  readonly name: string
  readonly nameZh: string
  readonly classCode: CharacterClassCode
  readonly classNameZh: string
  readonly tabIndex: number
  readonly tabName: string
  readonly tabNameZh: string
  readonly row: number
  readonly col: number
  readonly reqlevel: number
  readonly reqskills: readonly number[]
  readonly dependents: readonly number[]
  readonly mana: number
  readonly lvlmana: number
  readonly minmana: number
  readonly manashift: number
  readonly delay: number
  readonly descdam?: string | undefined
  readonly hitshift: number
  readonly srcDamage: number
  readonly minDam: number
  readonly maxDam: number
  readonly minLevDam: readonly number[]
  readonly maxLevDam: readonly number[]
  readonly eType: string
  readonly eMin: number
  readonly eMax: number
  readonly eMinLev: readonly number[]
  readonly eMaxLev: readonly number[]
  readonly eLen: number
  readonly eLevLen: readonly number[]
  readonly params: Readonly<Record<string, number | undefined>>
  readonly synergyFormulas: {
    readonly physical?: string | undefined
    readonly elemental?: string | undefined
    readonly duration?: string | undefined
  }
  readonly synergiesReceived: readonly SynergyBonusInfo[]
  readonly synergiesGiven: readonly SynergyGivenInfo[]
  readonly masteries: readonly number[]
  readonly descLines?: readonly DescLineDefinition[] | undefined
  readonly dsc2Lines?: readonly DescLineDefinition[] | undefined
  readonly minionStats?: MinionBaseStats | undefined
  readonly shortDesc: string
  readonly shortDescZh: string
  readonly longDesc: string
  readonly longDescZh: string
  readonly icon: string
  readonly iconActive: string
}

export const SKILLS_CATALOG: readonly SkillCatalogEntry[] = Object.freeze(${JSON.stringify(catalog, null, 2)})

export const SKILLS_BY_ID: Readonly<Record<number, SkillCatalogEntry>> = Object.freeze(
  SKILLS_CATALOG.reduce<Record<number, SkillCatalogEntry>>((acc, cur) => {
    acc[cur.id] = cur
    return acc
  }, {})
)

export const SKILLS_BY_CLASS: Readonly<Record<CharacterClassCode, readonly SkillCatalogEntry[]>> = Object.freeze({
  ama: SKILLS_CATALOG.filter(s => s.classCode === 'ama'),
  sor: SKILLS_CATALOG.filter(s => s.classCode === 'sor'),
  nec: SKILLS_CATALOG.filter(s => s.classCode === 'nec'),
  pal: SKILLS_CATALOG.filter(s => s.classCode === 'pal'),
  bar: SKILLS_CATALOG.filter(s => s.classCode === 'bar'),
  dru: SKILLS_CATALOG.filter(s => s.classCode === 'dru'),
  ass: SKILLS_CATALOG.filter(s => s.classCode === 'ass'),
})
`

  writeFileSync(join(process.cwd(), 'src', 'common', 'data', 'skills-catalog.ts'), tsContent, 'utf-8')
  console.log('Wrote src/common/data/skills-catalog.ts successfully!')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
