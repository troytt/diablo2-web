import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { MountedArchives } from '../../common/mpq/mount.ts'
import { getSharedMountedArchives } from '../mpq-archive-source.ts'

function parseTsv(text: string): { readonly header: readonly string[]; readonly rows: readonly (readonly string[])[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
  if (lines.length === 0) return { header: [], rows: [] }
  const header = lines[0]!.split('\t')
  const rows = lines.slice(1).map((line) => line.split('\t'))
  return { header, rows }
}

export type MonStats113cDifficultyVector = readonly [normal: number, nightmare: number, hell: number]

export interface MonStats113cAttackRow {
  readonly minD: MonStats113cDifficultyVector
  readonly maxD: MonStats113cDifficultyVector
  readonly th: MonStats113cDifficultyVector
  readonly move?: number
}

export interface MonStats113cElementalAttackRow {
  readonly slot: 1 | 2 | 3
  readonly mode: string
  readonly type: string
  readonly pct: MonStats113cDifficultyVector
  readonly minD: MonStats113cDifficultyVector
  readonly maxD: MonStats113cDifficultyVector
  readonly dur: MonStats113cDifficultyVector
}

export interface MonStats113cSkillRow {
  readonly slot: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  readonly skill: string
  readonly skillId: number
  readonly mode: string
  readonly level: number
}

export interface MonStats113cRow {
  readonly hcIdx: number
  readonly id: string
  readonly baseId: string
  readonly nextInClass: string
  readonly nameStr: string
  readonly monStatsEx: string
  readonly monProp: string
  readonly monType: string
  readonly ai: string
  readonly descStr: string
  readonly code: string
  readonly enabled: boolean
  readonly rangedType: boolean
  readonly placeSpawn: boolean
  readonly isSpawn: boolean
  readonly isMelee: boolean
  readonly noMap: boolean
  readonly opendoors: boolean
  readonly boss: boolean
  readonly primeevil: boolean
  readonly killable: boolean
  readonly switchai: boolean
  readonly noAura: boolean
  readonly neverCount: boolean
  readonly petIgnore: boolean
  readonly deathDmg: boolean
  readonly genericSpawn: boolean
  readonly zoo: boolean
  readonly SendSkills: number
  readonly align: 0 | 1 | 2
  readonly isLUndead: boolean
  readonly isHUndead: boolean
  readonly isDemon: boolean
  readonly flying: boolean
  readonly noRatio: boolean
  readonly setBoss: boolean
  readonly bossXfer: boolean
  readonly inTown: boolean
  readonly interact: boolean
  readonly npc: boolean
  readonly inventory: boolean

  readonly minGrp: number
  readonly maxGrp: number
  readonly partyMin: number
  readonly partyMax: number
  readonly velocity: number
  readonly run: number
  readonly sparsePopulate: number
  readonly rarity: number
  readonly threat: number
  readonly meleeRng: number
  readonly sizeX: number
  readonly sizeY: number
  readonly spawnCol: number
  readonly height: number
  readonly overlayHeight: number
  readonly pixHeight: number
  readonly baseW: string
  readonly hitClass: number

  readonly level: MonStats113cDifficultyVector
  readonly aidel: MonStats113cDifficultyVector
  readonly aidist: MonStats113cDifficultyVector
  readonly aip1: MonStats113cDifficultyVector
  readonly aip2: MonStats113cDifficultyVector
  readonly aip3: MonStats113cDifficultyVector
  readonly aip4: MonStats113cDifficultyVector
  readonly aip5: MonStats113cDifficultyVector
  readonly aip6: MonStats113cDifficultyVector
  readonly aip7: MonStats113cDifficultyVector
  readonly aip8: MonStats113cDifficultyVector

  readonly minHP: MonStats113cDifficultyVector
  readonly maxHP: MonStats113cDifficultyVector
  readonly ac: MonStats113cDifficultyVector
  readonly exp: MonStats113cDifficultyVector
  readonly toBlock: MonStats113cDifficultyVector
  readonly crit: number
  readonly damageRegen: number

  readonly a1: MonStats113cAttackRow
  readonly a2: MonStats113cAttackRow
  readonly s1: MonStats113cAttackRow
  readonly elementalAttacks: readonly MonStats113cElementalAttackRow[]
  readonly skills: readonly MonStats113cSkillRow[]
  readonly modeMissiles: Readonly<
    Partial<
      Record<
        | 'MissA1'
        | 'MissA2'
        | 'MissS1'
        | 'MissS2'
        | 'MissS3'
        | 'MissS4'
        | 'MissC'
        | 'MissSQ'
        | 'A1'
        | 'A2'
        | 'S1'
        | 'S2'
        | 'S3'
        | 'S4'
        | 'C'
        | 'SQ',
        string
      >
    >
  >

  readonly resDm: MonStats113cDifficultyVector
  readonly resMa: MonStats113cDifficultyVector
  readonly resFi: MonStats113cDifficultyVector
  readonly resLi: MonStats113cDifficultyVector
  readonly resCo: MonStats113cDifficultyVector
  readonly resPo: MonStats113cDifficultyVector
  readonly drain: MonStats113cDifficultyVector
  readonly coldEffect: MonStats113cDifficultyVector
  readonly coldeffect: MonStats113cDifficultyVector

  readonly tc: readonly [
    norm: string,
    champ: string,
    uniq: string,
    quest: string,
    nmNorm: string,
    nmChamp: string,
    nmUniq: string,
    nmQuest: string,
    hellNorm: string,
    hellChamp: string,
    hellUniq: string,
    hellQuest: string,
  ]
  readonly minions: readonly string[]

  readonly m1m: boolean
  readonly m2m: boolean
  readonly mSm: boolean
  readonly m1c: boolean
  readonly m2c: boolean
  readonly mSc: boolean
}

export interface MonAi113cRow {
  readonly index: number
  readonly ai: string
  readonly paramDescriptions: readonly string[]
}

export interface MonLvl113cRow {
  readonly level: number
  readonly ac: MonStats113cDifficultyVector
  readonly lAc: MonStats113cDifficultyVector
  readonly th: MonStats113cDifficultyVector
  readonly lTh: MonStats113cDifficultyVector
  readonly hp: MonStats113cDifficultyVector
  readonly lHp: MonStats113cDifficultyVector
  readonly dm: MonStats113cDifficultyVector
  readonly lDm: MonStats113cDifficultyVector
  readonly xp: MonStats113cDifficultyVector
  readonly lXp: MonStats113cDifficultyVector
}

export interface MonUMod113cRow {
  readonly umodId: number
  readonly id: string
  readonly enabled: boolean
  readonly version: number
  readonly xfer: boolean
  readonly champion: boolean
  readonly fPick: number
  readonly exclude1: string
  readonly exclude2: string
  readonly cpick: MonStats113cDifficultyVector
  readonly upick: MonStats113cDifficultyVector
  readonly constants: number
}

export interface MonUMod113cConstants {
  readonly raw: readonly number[]
  readonly championChance: number
  readonly championHpBonusPct: MonStats113cDifficultyVector
  readonly championDmgBonusPct: MonStats113cDifficultyVector
  readonly championArBonusPct: MonStats113cDifficultyVector
  readonly championToHitBonusPct: number
  readonly uniqueHpBonusPct: MonStats113cDifficultyVector
  readonly uniqueDmgBonusPct: MonStats113cDifficultyVector
  readonly uniqueArBonusPct: MonStats113cDifficultyVector
  readonly uniqueToHitBonusPct: number
  readonly uniqueStrongDmgBonusPct: number
  readonly minionHpBonusPct: MonStats113cDifficultyVector
  readonly minionDmgBonusPct: MonStats113cDifficultyVector
  readonly minionArBonusPct: MonStats113cDifficultyVector
  readonly minionToHitBonusPct: number
  readonly minionStrongDmgBonusPct: number
  readonly minionElemMinDmgPct: MonStats113cDifficultyVector
  readonly minionElemMaxDmgPct: MonStats113cDifficultyVector
  readonly championElemMinDmgPct: MonStats113cDifficultyVector
  readonly championElemMaxDmgPct: MonStats113cDifficultyVector
  readonly uniqueElemMinDmgPct: MonStats113cDifficultyVector
  readonly uniqueElemMaxDmgPct: MonStats113cDifficultyVector
}

export interface SuperUnique113cTc {
  readonly 0: string
  readonly 1: string
  readonly 2: string
  readonly normal: string
  readonly nightmare: string
  readonly hell: string
}

export interface SuperUnique113cRow {
  readonly superunique: string
  readonly name: string
  readonly classId: string
  readonly class: string
  readonly hcIdx: number
  readonly monSound: string
  readonly mod1: number
  readonly mod2: number
  readonly mod3: number
  readonly mods: readonly number[]
  readonly minGrp: number
  readonly maxGrp: number
  readonly eClass: number
  readonly autoPos: boolean
  readonly stacks: boolean
  readonly replaceable: boolean
  readonly uTrans: MonStats113cDifficultyVector
  readonly tc: SuperUnique113cTc
}

export interface Hireling113cSkillEntry {
  readonly slot: 1 | 2 | 3 | 4 | 5 | 6
  readonly skillName: string
  readonly skillId: number
  readonly mode: number
  readonly chance: number
  readonly chancePerLvl: number
  readonly level: number
  readonly lvlPerLvl: number
}

export interface Hireling113cExtractedRecord {
  readonly hireling: string
  readonly subType: string
  readonly id: number
  readonly version: number
  readonly subTypeId: number
  readonly classId: number
  readonly act: number
  readonly difficulty: number
  readonly seller: number
  readonly gold: number
  readonly hireCost: number
  readonly level: number
  readonly expPerLvl: number
  readonly hp: number
  readonly hpPerLvl: number
  readonly defense: number
  readonly defPerLvl: number
  readonly str: number
  readonly strPerLvl: number
  readonly dex: number
  readonly dexPerLvl: number
  readonly ar: number
  readonly arPerLvl: number
  readonly share: number
  readonly dmgMin: number
  readonly dmgMax: number
  readonly dmgPerLvl: number
  readonly resist: number
  readonly resistPerLvl: number
  readonly wType1: string
  readonly wType2: string
  readonly hireDesc: number
  readonly defaultChance: number
  readonly nameFirstKey: string
  readonly nameLastKey: string
  readonly wNameFirstId: number
  readonly wNameLastId: number
  readonly skills: readonly number[]
  readonly skillEntries: readonly Hireling113cSkillEntry[]
}

export interface ExtractedMonsters113cData {
  readonly monStats: readonly MonStats113cRow[]
  readonly monAi: readonly MonAi113cRow[]
  readonly monLvl: readonly MonLvl113cRow[]
  readonly monUMod: readonly MonUMod113cRow[]
  readonly monUModConstants: MonUMod113cConstants
  readonly superUniques: readonly SuperUnique113cRow[]
  readonly hirelings: readonly Hireling113cExtractedRecord[]
}

function intOr(raw: string | undefined, fallback = 0): number {
  if (!raw) return fallback
  const trimmed = raw.trim()
  if (trimmed === '') return fallback
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

function boolOr(raw: string | undefined): boolean {
  return intOr(raw, 0) !== 0
}

function diffVecStrict(
  get: (col: string) => string | undefined,
  normCol: string,
  nmCol: string,
  hellCol: string,
  fallback = 0,
): MonStats113cDifficultyVector {
  return [
    intOr(get(normCol), fallback),
    intOr(get(nmCol), fallback),
    intOr(get(hellCol), fallback),
  ]
}

function resolveHirelingDescCode(raw: string | undefined): number {
  const s = (raw ?? '').trim().toLowerCase()
  switch (s) {
    case 'farw':
    case 'strhirespecial1':
      return 1
    case 'carw':
    case 'strhirespecial2':
      return 2
    case 'comb':
    case 'palmercexst4x':
      return 3
    case 'def':
    case 'palmercexst1x':
      return 4
    case 'off':
    case 'palmercexst3x':
      return 5
    case 'fire':
    case 'strhirespecial7':
      return 6
    case 'cold':
    case 'strhirespecial6':
      return 7
    case 'ltng':
    case 'strhirespecial5':
      return 8
    default:
      return 0
  }
}

function resolveWNameId(key: string): number {
  const trimmed = key.trim()
  if (trimmed.startsWith('merc') && !trimmed.startsWith('merca2')) {
    const num = Number.parseInt(trimmed.slice(4), 10)
    if (!Number.isNaN(num)) return 3411 + (num - 1)
  }
  if (trimmed.startsWith('merca2')) {
    const num = Number.parseInt(trimmed.slice(6), 10)
    if (!Number.isNaN(num)) {
      if (num <= 21) return 1019 + (num - 1)
      return 1040 + (num - 22)
    }
  }
  if (trimmed.startsWith('MercX')) {
    const num = Number.parseInt(trimmed.slice(5), 10)
    if (!Number.isNaN(num)) return 10835 + (num - 101)
  }
  return 0
}

export function extractMonsters113cFromMpq(
  archives: MountedArchives = getSharedMountedArchives(),
): ExtractedMonsters113cData {
  const monStatsTsv = parseTsv(archives.readText('data\\global\\excel\\monstats.txt'))
  const monStats2Tsv = parseTsv(archives.readText('data\\global\\excel\\monstats2.txt'))
  const monAiTsv = parseTsv(archives.readText('data\\global\\excel\\monai.txt'))
  const monLvlTsv = parseTsv(archives.readText('data\\global\\excel\\monlvl.txt'))
  const monUModTsv = parseTsv(archives.readText('data\\global\\excel\\monumod.txt'))
  const superUniquesTsv = parseTsv(archives.readText('data\\global\\excel\\superuniques.txt'))
  const hirelingTsv = parseTsv(archives.readText('data\\global\\excel\\hireling.txt'))
  const skillsTsv = parseTsv(archives.readText('data\\global\\excel\\skills.txt'))

  // 1. Build skillName -> skillId map from skills.txt
  const skillIdByName = new Map<string, number>()
  const skNameCol = skillsTsv.header.findIndex((h) => h.trim().toLowerCase() === 'skill')
  const skIdCol = skillsTsv.header.findIndex((h) => h.trim().toLowerCase() === 'id')
  const skDescCol = skillsTsv.header.findIndex((h) => h.trim().toLowerCase() === 'skilldesc')
  for (const row of skillsTsv.rows) {
    const name = (row[skNameCol] ?? '').trim()
    const idRaw = (row[skIdCol] ?? '').trim()
    if (!name || idRaw === '') continue
    const id = Number.parseInt(idRaw, 10)
    if (!Number.isNaN(id)) {
      skillIdByName.set(name.toLowerCase(), id)
      const desc = (row[skDescCol] ?? '').trim()
      if (desc && !skillIdByName.has(desc.toLowerCase())) {
        skillIdByName.set(desc.toLowerCase(), id)
      }
    }
  }

  // 2. Index MonStats2.txt by lowercase Id
  const ms2HeaderMap = new Map<string, number>()
  monStats2Tsv.header.forEach((h, i) => ms2HeaderMap.set(h.trim(), i))
  const ms2ById = new Map<string, readonly string[]>()
  const ms2IdCol = ms2HeaderMap.get('Id') ?? 0
  for (const row of monStats2Tsv.rows) {
    const id = (row[ms2IdCol] ?? '').trim()
    if (!id || id.toLowerCase() === 'expansion') continue
    if (!ms2ById.has(id.toLowerCase())) {
      ms2ById.set(id.toLowerCase(), row)
    }
  }

  // 3. Parse MonStats.txt (734 rows)
  const msHeaderMap = new Map<string, number>()
  monStatsTsv.header.forEach((h, i) => msHeaderMap.set(h.trim(), i))

  const nextInClassById = new Map<string, string>()
  const msIdCol = msHeaderMap.get('Id') ?? 0
  const msNextCol = msHeaderMap.get('NextInClass')
  for (const row of monStatsTsv.rows) {
    const rowId = (row[msIdCol] ?? '').trim()
    if (!rowId || rowId.toLowerCase() === 'expansion') continue
    const nextId = msNextCol !== undefined ? (row[msNextCol] ?? '').trim() : ''
    if (!nextInClassById.has(rowId.toLowerCase())) {
      nextInClassById.set(rowId.toLowerCase(), nextId)
    }
  }

  const monStats: MonStats113cRow[] = []
  for (const row of monStatsTsv.rows) {
    const get = (col: string): string | undefined => {
      const idx = msHeaderMap.get(col)
      return idx !== undefined ? row[idx]?.trim() : undefined
    }
    const id = get('Id') ?? ''
    const hcIdxRaw = get('hcIdx') ?? ''
    if (!id || id === 'Expansion' || hcIdxRaw === '') continue
    const hcIdx = Number.parseInt(hcIdxRaw, 10)
    if (Number.isNaN(hcIdx)) continue

    const monStatsExKey = (get('MonStatsEx') || id).toLowerCase()
    const ms2Row = ms2ById.get(monStatsExKey) ?? ms2ById.get(id.toLowerCase())
    const get2 = (col: string): string | undefined => {
      if (!ms2Row) return undefined
      const idx = ms2HeaderMap.get(col)
      return idx !== undefined ? ms2Row[idx]?.trim() : undefined
    }

    const modeMissiles: Partial<
      Record<
        | 'MissA1'
        | 'MissA2'
        | 'MissS1'
        | 'MissS2'
        | 'MissS3'
        | 'MissS4'
        | 'MissC'
        | 'MissSQ'
        | 'A1'
        | 'A2'
        | 'S1'
        | 'S2'
        | 'S3'
        | 'S4'
        | 'C'
        | 'SQ',
        string
      >
    > = {}
    for (const [slot, shortKey] of [
      ['MissA1', 'A1'],
      ['MissA2', 'A2'],
      ['MissS1', 'S1'],
      ['MissS2', 'S2'],
      ['MissS3', 'S3'],
      ['MissS4', 'S4'],
      ['MissC', 'C'],
      ['MissSQ', 'SQ'],
    ] as const) {
      const val = get(slot) ?? ''
      if (val !== '') {
        modeMissiles[slot] = val
        modeMissiles[shortKey] = val
      }
    }

    const elementalAttacks: MonStats113cElementalAttackRow[] = []
    for (const slot of [1, 2, 3] as const) {
      const mode = get(`El${slot}Mode`) ?? ''
      const type = get(`El${slot}Type`) ?? ''
      if (!mode || !type) continue
      const suffixN = slot === 1 ? '' : ''
      void suffixN
      elementalAttacks.push({
        slot,
        mode,
        type,
        pct: diffVecStrict(get, `El${slot}Pct`, `El${slot}Pct(N)`, `El${slot}Pct(H)`),
        minD: diffVecStrict(get, `El${slot}MinD`, `El${slot}MinD(N)`, `El${slot}MinD(H)`),
        maxD: diffVecStrict(get, `El${slot}MaxD`, `El${slot}MaxD(N)`, `El${slot}MaxD(H)`),
        dur: diffVecStrict(get, `El${slot}Dur`, `El${slot}Dur(N)`, `El${slot}Dur(H)`),
      })
    }

    const skills: MonStats113cSkillRow[] = []
    for (const slot of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
      const skill = get(`Skill${slot}`) ?? ''
      if (!skill) continue
      const mode = get(`Sk${slot}mode`) ?? ''
      const level = intOr(get(`Sk${slot}lvl`), 1)
      const skillId = skillIdByName.get(skill.toLowerCase()) ?? -1
      skills.push({
        slot,
        skill,
        skillId,
        mode,
        level,
      })
    }

    const m1 = get('minion1') ?? ''
    let m2 = get('minion2') ?? ''
    if (m1 && !m2) {
      const autoM2 = nextInClassById.get(m1.toLowerCase()) ?? ''
      if (autoM2 && autoM2.toLowerCase() !== m1.toLowerCase()) {
        m2 = autoM2
      }
    }
    const minions: string[] = []
    if (m1) minions.push(m1)
    if (m2) minions.push(m2)

    const alignNum = intOr(get('Align'), 0)
    const align: 0 | 1 | 2 = alignNum === 1 ? 1 : alignNum === 2 ? 2 : 0

    const velocity = intOr(get('Velocity'), 0)
    const run = intOr(get('Run'), velocity)

    monStats.push({
      hcIdx,
      id,
      baseId: get('BaseId') || id,
      nextInClass: get('NextInClass') ?? '',
      nameStr: get('NameStr') ?? '',
      monStatsEx: get('MonStatsEx') ?? '',
      monProp: get('MonProp') ?? '',
      monType: get('MonType') ?? '',
      ai: get('AI') ?? '',
      descStr: get('DescStr') ?? '',
      code: get('Code') ?? '',
      enabled: boolOr(get('enabled')),
      rangedType: boolOr(get('rangedtype')),
      placeSpawn: boolOr(get('placespawn')),
      isSpawn: boolOr(get('isSpawn')),
      isMelee: boolOr(get('isMelee')),
      noMap: boolOr(get2('noMap') ?? get('noMap')),
      opendoors: boolOr(get('opendoors')),
      boss: boolOr(get('boss')),
      primeevil: boolOr(get('primeevil')),
      killable: boolOr(get('killable')),
      switchai: boolOr(get('switchai')),
      noAura: boolOr(get('noAura')),
      neverCount: boolOr(get('neverCount')),
      petIgnore: boolOr(get('petIgnore')),
      deathDmg: boolOr(get('deathDmg')),
      genericSpawn: boolOr(get('genericSpawn')),
      zoo: boolOr(get('zoo')),
      SendSkills: intOr(get('SendSkills'), 0),
      align,
      isLUndead: boolOr(get('lUndead')),
      isHUndead: boolOr(get('hUndead')),
      isDemon: boolOr(get('demon')),
      flying: boolOr(get('flying')),
      noRatio: boolOr(get('noRatio')),
      setBoss: boolOr(get('SetBoss')),
      bossXfer: boolOr(get('BossXfer')),
      inTown: boolOr(get('inTown')),
      interact: boolOr(get('interact')),
      npc: boolOr(get('npc')),
      inventory: boolOr(get('inventory')),

      minGrp: intOr(get('MinGrp'), 1),
      maxGrp: intOr(get('MaxGrp'), intOr(get('MinGrp'), 1)),
      partyMin: intOr(get('PartyMin'), 0),
      partyMax: intOr(get('PartyMax'), 0),
      velocity,
      run,
      sparsePopulate: intOr(get('sparsePopulate'), 100),
      rarity: intOr(get('Rarity'), 0),
      threat: intOr(get('threat'), 0),
      meleeRng: intOr(get2('MeleeRng') ?? get('MeleeRng'), 0),
      sizeX: intOr(get2('SizeX'), 1),
      sizeY: intOr(get2('SizeY'), 1),
      spawnCol: intOr(get2('spawnCol'), 0),
      height: intOr(get2('Height'), 0),
      overlayHeight: intOr(get2('OverlayHeight'), 0),
      pixHeight: intOr(get2('pixHeight'), 0),
      baseW: get2('BaseW') ?? '',
      hitClass: intOr(get2('HitClass'), 0),

      level: diffVecStrict(get, 'Level', 'Level(N)', 'Level(H)', 0),
      aidel: diffVecStrict(get, 'aidel', 'aidel(N)', 'aidel(H)', 0),
      aidist: diffVecStrict(get, 'aidist', 'aidist(N)', 'aidist(H)', 0),
      aip1: diffVecStrict(get, 'aip1', 'aip1(N)', 'aip1(H)', 0),
      aip2: diffVecStrict(get, 'aip2', 'aip2(N)', 'aip2(H)', 0),
      aip3: diffVecStrict(get, 'aip3', 'aip3(N)', 'aip3(H)', 0),
      aip4: diffVecStrict(get, 'aip4', 'aip4(N)', 'aip4(H)', 0),
      aip5: diffVecStrict(get, 'aip5', 'aip5(N)', 'aip5(H)', 0),
      aip6: diffVecStrict(get, 'aip6', 'aip6(N)', 'aip6(H)', 0),
      aip7: diffVecStrict(get, 'aip7', 'aip7(N)', 'aip7(H)', 0),
      aip8: diffVecStrict(get, 'aip8', 'aip8(N)', 'aip8(H)', 0),

      minHP: diffVecStrict(get, 'minHP', 'MinHP(N)', 'MinHP(H)', 0),
      maxHP: diffVecStrict(get, 'maxHP', 'MaxHP(N)', 'MaxHP(H)', 0),
      ac: diffVecStrict(get, 'AC', 'AC(N)', 'AC(H)', 0),
      exp: diffVecStrict(get, 'Exp', 'Exp(N)', 'Exp(H)', 0),
      toBlock: diffVecStrict(get, 'ToBlock', 'ToBlock(N)', 'ToBlock(H)', 0),
      crit: intOr(get('Crit'), 0),
      damageRegen: intOr(get('DamageRegen'), 0),

      a1: {
        minD: diffVecStrict(get, 'A1MinD', 'A1MinD(N)', 'A1MinD(H)', 0),
        maxD: diffVecStrict(get, 'A1MaxD', 'A1MaxD(N)', 'A1MaxD(H)', 0),
        th: diffVecStrict(get, 'A1TH', 'A1TH(N)', 'A1TH(H)', 0),
        ...(intOr(get2('A1mv') ?? get('A1Move'), 0) !== 0
          ? { move: intOr(get2('A1mv') ?? get('A1Move'), 0) }
          : {}),
      },
      a2: {
        minD: diffVecStrict(get, 'A2MinD', 'A2MinD(N)', 'A2MinD(H)', 0),
        maxD: diffVecStrict(get, 'A2MaxD', 'A2MaxD(N)', 'A2MaxD(H)', 0),
        th: diffVecStrict(get, 'A2TH', 'A2TH(N)', 'A2TH(H)', 0),
        ...(intOr(get2('A2mv') ?? get('A2Move'), 0) !== 0
          ? { move: intOr(get2('A2mv') ?? get('A2Move'), 0) }
          : {}),
      },
      s1: {
        minD: diffVecStrict(get, 'S1MinD', 'S1MinD(N)', 'S1MinD(H)', 0),
        maxD: diffVecStrict(get, 'S1MaxD', 'S1MaxD(N)', 'S1MaxD(H)', 0),
        th: diffVecStrict(get, 'S1TH', 'S1TH(N)', 'S1TH(H)', 0),
        ...(intOr(get2('S1mv') ?? get('S1Move'), 0) !== 0
          ? { move: intOr(get2('S1mv') ?? get('S1Move'), 0) }
          : {}),
      },
      elementalAttacks,
      skills,
      modeMissiles,

      resDm: diffVecStrict(get, 'ResDm', 'ResDm(N)', 'ResDm(H)', 0),
      resMa: diffVecStrict(get, 'ResMa', 'ResMa(N)', 'ResMa(H)', 0),
      resFi: diffVecStrict(get, 'ResFi', 'ResFi(N)', 'ResFi(H)', 0),
      resLi: diffVecStrict(get, 'ResLi', 'ResLi(N)', 'ResLi(H)', 0),
      resCo: diffVecStrict(get, 'ResCo', 'ResCo(N)', 'ResCo(H)', 0),
      resPo: diffVecStrict(get, 'ResPo', 'ResPo(N)', 'ResPo(H)', 0),
      drain: diffVecStrict(get, 'Drain', 'Drain(N)', 'Drain(H)', 0),
      coldEffect: diffVecStrict(get, 'coldeffect', 'coldeffect(N)', 'coldeffect(H)', 0),
      coldeffect: diffVecStrict(get, 'coldeffect', 'coldeffect(N)', 'coldeffect(H)', 0),

      tc: [
        get('TreasureClass1') ?? '',
        get('TreasureClass2') ?? '',
        get('TreasureClass3') ?? '',
        get('TreasureClass4') ?? '',
        get('TreasureClass1(N)') ?? '',
        get('TreasureClass2(N)') ?? '',
        get('TreasureClass3(N)') ?? '',
        get('TreasureClass4(N)') ?? '',
        get('TreasureClass1(H)') ?? '',
        get('TreasureClass2(H)') ?? '',
        get('TreasureClass3(H)') ?? '',
        get('TreasureClass4(H)') ?? '',
      ],
      minions,

      m1m: boolOr(get2('mA1') ?? get2('m1m')),
      m2m: boolOr(get2('mA2') ?? get2('m2m')),
      mSm: boolOr(get2('mS1') ?? get2('mSm')),
      m1c: boolOr(get2('mC') ?? get2('m1c')),
      m2c: boolOr(get2('mWL') ?? get2('m2c')),
      mSc: boolOr(get2('mSC') ?? get2('mSc')),
    })
  }

  // 4. Parse MonAi.txt (148 rows)
  const monAi: MonAi113cRow[] = []
  let aiIndex = 0
  for (const row of monAiTsv.rows) {
    const ai = (row[0] ?? '').trim()
    if (!ai || ai.toLowerCase() === 'expansion') continue
    const paramDescriptions: string[] = []
    for (let i = 1; i <= 8; i++) {
      paramDescriptions.push((row[i] ?? '').trim())
    }
    monAi.push({
      index: aiIndex++,
      ai,
      paramDescriptions,
    })
  }

  // 5. Parse MonLvl.txt (111 rows, levels 0..110)
  const mlHeaderMap = new Map<string, number>()
  monLvlTsv.header.forEach((h, i) => mlHeaderMap.set(h.trim(), i))
  const monLvl: MonLvl113cRow[] = []
  for (const row of monLvlTsv.rows) {
    const get = (col: string): string | undefined => {
      const idx = mlHeaderMap.get(col)
      return idx !== undefined ? row[idx]?.trim() : undefined
    }
    const lvlRaw = get('Level') ?? ''
    if (lvlRaw === '' || lvlRaw.toLowerCase() === 'expansion') continue
    const level = Number.parseInt(lvlRaw, 10)
    if (Number.isNaN(level)) continue
    monLvl.push({
      level,
      ac: diffVecStrict(get, 'AC', 'AC(N)', 'AC(H)', 0),
      lAc: diffVecStrict(get, 'L-AC', 'L-AC(N)', 'L-AC(H)', 0),
      th: diffVecStrict(get, 'TH', 'TH(N)', 'TH(H)', 0),
      lTh: diffVecStrict(get, 'L-TH', 'L-TH(N)', 'L-TH(H)', 0),
      hp: diffVecStrict(get, 'HP', 'HP(N)', 'HP(H)', 0),
      lHp: diffVecStrict(get, 'L-HP', 'L-HP(N)', 'L-HP(H)', 0),
      dm: diffVecStrict(get, 'DM', 'DM(N)', 'DM(H)', 0),
      lDm: diffVecStrict(get, 'L-DM', 'L-DM(N)', 'L-DM(H)', 0),
      xp: diffVecStrict(get, 'XP', 'XP(N)', 'XP(H)', 0),
      lXp: diffVecStrict(get, 'L-XP', 'L-XP(N)', 'L-XP(H)', 0),
    })
  }

  // 6. Parse MonUMod.txt (43 rows + 34 [constants])
  const mumHeaderMap = new Map<string, number>()
  monUModTsv.header.forEach((h, i) => mumHeaderMap.set(h.trim(), i))
  const monUMod: MonUMod113cRow[] = []
  const rawConstants: number[] = []
  for (const row of monUModTsv.rows) {
    const get = (col: string): string | undefined => {
      const idx = mumHeaderMap.get(col)
      return idx !== undefined ? row[idx]?.trim() : undefined
    }
    const umodName = get('uniquemod') ?? ''
    const idRaw = get('id') ?? ''
    if (!umodName || umodName.toLowerCase() === 'expansion' || idRaw === '') continue
    const umodId = Number.parseInt(idRaw, 10)
    if (Number.isNaN(umodId)) continue
    const cVal = intOr(get('constants'), 0)
    if (umodId <= 33) {
      rawConstants[umodId] = cVal
    }
    monUMod.push({
      umodId,
      id: umodName,
      enabled: boolOr(get('enabled')),
      version: intOr(get('version'), 0),
      xfer: boolOr(get('xfer')),
      champion: boolOr(get('champion')),
      fPick: intOr(get('fPick'), 0),
      exclude1: get('exclude1') ?? '',
      exclude2: get('exclude2') ?? '',
      cpick: diffVecStrict(get, 'cpick', 'cpick (N)', 'cpick (H)', 0),
      upick: diffVecStrict(get, 'upick', 'upick (N)', 'upick (H)', 0),
      constants: cVal,
    })
  }

  const monUModConstants: MonUMod113cConstants = {
    raw: rawConstants,
    championChance: rawConstants[0] ?? 20,
    championHpBonusPct: [rawConstants[4] ?? 200, rawConstants[5] ?? 150, rawConstants[6] ?? 100],
    championDmgBonusPct: [rawConstants[11] ?? 100, rawConstants[11] ?? 100, rawConstants[11] ?? 100],
    championArBonusPct: [rawConstants[10] ?? 75, rawConstants[10] ?? 75, rawConstants[10] ?? 75],
    championToHitBonusPct: rawConstants[10] ?? 75,
    uniqueHpBonusPct: [rawConstants[7] ?? 300, rawConstants[8] ?? 200, rawConstants[9] ?? 100],
    uniqueDmgBonusPct: [rawConstants[15] ?? 150, rawConstants[15] ?? 150, rawConstants[15] ?? 150],
    uniqueArBonusPct: [rawConstants[13] ?? 100, rawConstants[13] ?? 100, rawConstants[13] ?? 100],
    uniqueToHitBonusPct: rawConstants[13] ?? 100,
    uniqueStrongDmgBonusPct: rawConstants[15] ?? 150,
    minionHpBonusPct: [rawConstants[1] ?? 100, rawConstants[2] ?? 75, rawConstants[3] ?? 50],
    minionDmgBonusPct: [rawConstants[14] ?? 75, rawConstants[14] ?? 75, rawConstants[14] ?? 75],
    minionArBonusPct: [rawConstants[12] ?? 50, rawConstants[12] ?? 50, rawConstants[12] ?? 50],
    minionToHitBonusPct: rawConstants[12] ?? 50,
    minionStrongDmgBonusPct: rawConstants[14] ?? 75,
    minionElemMinDmgPct: [rawConstants[16] ?? 0, rawConstants[17] ?? 33, rawConstants[18] ?? 33],
    minionElemMaxDmgPct: [rawConstants[19] ?? 0, rawConstants[20] ?? 50, rawConstants[21] ?? 50],
    championElemMinDmgPct: [rawConstants[22] ?? 33, rawConstants[23] ?? 33, rawConstants[24] ?? 33],
    championElemMaxDmgPct: [rawConstants[25] ?? 50, rawConstants[26] ?? 50, rawConstants[27] ?? 50],
    uniqueElemMinDmgPct: [rawConstants[28] ?? 66, rawConstants[29] ?? 66, rawConstants[30] ?? 66],
    uniqueElemMaxDmgPct: [rawConstants[31] ?? 100, rawConstants[32] ?? 100, rawConstants[33] ?? 100],
  }

  // 7. Parse SuperUniques.txt (66 rows)
  const suHeaderMap = new Map<string, number>()
  superUniquesTsv.header.forEach((h, i) => suHeaderMap.set(h.trim(), i))
  const superUniques: SuperUnique113cRow[] = []
  for (const row of superUniquesTsv.rows) {
    const get = (col: string): string | undefined => {
      const idx = suHeaderMap.get(col)
      return idx !== undefined ? row[idx]?.trim() : undefined
    }
    const suId = get('Superunique') ?? ''
    if (!suId || suId.toLowerCase() === 'expansion') continue
    const hcIdx = intOr(get('hcIdx'), superUniques.length)
    const classId = get('Class') ?? ''
    const mod1 = intOr(get('Mod1'), 0)
    const mod2 = intOr(get('Mod2'), 0)
    const mod3 = intOr(get('Mod3'), 0)
    const mods = [mod1, mod2, mod3].filter((m) => m > 0)
    const tcN = get('TC') ?? ''
    const tcNm = get('TC(N)') ?? ''
    const tcH = get('TC(H)') ?? ''
    superUniques.push({
      superunique: suId,
      name: get('Name') || suId,
      classId,
      class: classId,
      hcIdx,
      monSound: get('MonSound') ?? '',
      mod1,
      mod2,
      mod3,
      mods,
      minGrp: intOr(get('MinGrp'), 0),
      maxGrp: intOr(get('MaxGrp'), 0),
      eClass: intOr(get('EClass'), 0),
      autoPos: boolOr(get('AutoPos')),
      stacks: boolOr(get('Stacks')),
      replaceable: boolOr(get('Replaceable')),
      uTrans: diffVecStrict(get, 'Utrans', 'Utrans(N)', 'Utrans(H)', 0),
      tc: {
        0: tcN,
        1: tcNm,
        2: tcH,
        normal: tcN,
        nightmare: tcNm,
        hell: tcH,
      },
    })
  }

  // 8. Parse Hireling.txt (120 rows)
  const hHeaderMap = new Map<string, number>()
  hirelingTsv.header.forEach((h, i) => hHeaderMap.set(h.trim(), i))
  const hirelings: Hireling113cExtractedRecord[] = []
  for (const row of hirelingTsv.rows) {
    const get = (col: string): string | undefined => {
      const idx = hHeaderMap.get(col)
      return idx !== undefined ? row[idx]?.trim() : undefined
    }
    const hireling = get('Hireling') ?? ''
    const idRaw = get('Id') ?? ''
    if (!hireling || hireling.toLowerCase() === 'expansion' || idRaw === '') continue
    const id = Number.parseInt(idRaw, 10)
    if (Number.isNaN(id)) continue

    const skillEntries: Hireling113cSkillEntry[] = []
    const skills: number[] = []
    for (const slot of [1, 2, 3, 4, 5, 6] as const) {
      const skillName = get(`Skill${slot}`) ?? ''
      if (!skillName) continue
      const skillId = skillIdByName.get(skillName.toLowerCase()) ?? -1
      const mode = intOr(get(`Mode${slot}`), 0)
      const chance = intOr(get(`Chance${slot}`), 0)
      const chancePerLvl = intOr(get(`ChancePerLvl${slot}`), 0)
      const level = intOr(get(`Level${slot}`), 1)
      const lvlPerLvl = intOr(get(`LvlPerLvl${slot}`), 0)
      skills.push(skillId)
      skillEntries.push({
        slot,
        skillName,
        skillId,
        mode,
        chance,
        chancePerLvl,
        level,
        lvlPerLvl,
      })
    }

    const nameFirstKey = get('NameFirst') ?? ''
    const nameLastKey = get('NameLast') ?? ''
    const gold = intOr(get('Gold'), 100)

    hirelings.push({
      hireling,
      subType: get('SubType') ?? '',
      id,
      version: intOr(get('Version'), 0),
      subTypeId: id,
      classId: intOr(get('Class'), 0),
      act: intOr(get('Act'), 1),
      difficulty: intOr(get('Difficulty'), 1),
      seller: intOr(get('Seller'), 0),
      gold,
      hireCost: gold,
      level: intOr(get('Level'), 1),
      expPerLvl: intOr(get('Exp/Lvl'), 100),
      hp: intOr(get('HP'), 40),
      hpPerLvl: intOr(get('HP/Lvl'), 0),
      defense: intOr(get('Defense'), 0),
      defPerLvl: intOr(get('Def/Lvl'), 0),
      str: intOr(get('Str'), 10),
      strPerLvl: intOr(get('Str/Lvl'), 0),
      dex: intOr(get('Dex'), 10),
      dexPerLvl: intOr(get('Dex/Lvl'), 0),
      ar: intOr(get('AR'), 0),
      arPerLvl: intOr(get('AR/Lvl'), 0),
      share: intOr(get('Share'), 0),
      dmgMin: intOr(get('Dmg-Min'), 0),
      dmgMax: intOr(get('Dmg-Max'), 0),
      dmgPerLvl: intOr(get('Dmg/Lvl'), 0),
      resist: intOr(get('Resist'), 0),
      resistPerLvl: intOr(get('Resist/Lvl'), 0),
      wType1: get('WType1') ?? '',
      wType2: get('WType2') ?? '',
      hireDesc: resolveHirelingDescCode(get('HireDesc')),
      defaultChance: intOr(get('DefaultChance'), 0),
      nameFirstKey,
      nameLastKey,
      wNameFirstId: resolveWNameId(nameFirstKey),
      wNameLastId: resolveWNameId(nameLastKey),
      skills,
      skillEntries,
    })
  }

  return {
    monStats,
    monAi,
    monLvl,
    monUMod,
    monUModConstants,
    superUniques,
    hirelings,
  }
}

export function renderMonStats113cModule(data: ExtractedMonsters113cData): string {
  return `/**
 * Canonical Diablo II v1.13c Monster Data Contract.
 *
 * Generated by \`src/baker/packers/pack-monsters-113c.ts\` from authoritative 1.13c MPQ archives:
 * - \`MonStats.txt\` + \`MonStats2.txt\` (${data.monStats.length} rows)
 * - \`MonAi.txt\` (${data.monAi.length} rows)
 * - \`MonLvl.txt\` (${data.monLvl.length} rows, levels 0..110)
 * - \`MonUMod.txt\` (${data.monUMod.length} rows + 34 difficulty [constants])
 * - \`SuperUniques.txt\` (${data.superUniques.length} rows)
 *
 * DO NOT EDIT MANUALLY.
 */

export type MonStats113cDifficultyVector = readonly [normal: number, nightmare: number, hell: number]

export interface MonStats113cAttackRow {
  readonly minD: MonStats113cDifficultyVector
  readonly maxD: MonStats113cDifficultyVector
  readonly th: MonStats113cDifficultyVector
  readonly move?: number
}

export interface MonStats113cElementalAttackRow {
  readonly slot: 1 | 2 | 3
  readonly mode: string
  readonly type: string
  readonly pct: MonStats113cDifficultyVector
  readonly minD: MonStats113cDifficultyVector
  readonly maxD: MonStats113cDifficultyVector
  readonly dur: MonStats113cDifficultyVector
}

export interface MonStats113cSkillRow {
  readonly slot: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  readonly skill: string
  readonly skillId: number
  readonly mode: string
  readonly level: number
}

export interface MonStats113cRow {
  readonly hcIdx: number
  readonly id: string
  readonly baseId: string
  readonly nextInClass: string
  readonly nameStr: string
  readonly monStatsEx: string
  readonly monProp: string
  readonly monType: string
  readonly ai: string
  readonly descStr: string
  readonly code: string
  readonly enabled: boolean
  readonly rangedType: boolean
  readonly placeSpawn: boolean
  readonly isSpawn: boolean
  readonly isMelee: boolean
  readonly noMap: boolean
  readonly opendoors: boolean
  readonly boss: boolean
  readonly primeevil: boolean
  readonly killable: boolean
  readonly switchai: boolean
  readonly noAura: boolean
  readonly neverCount: boolean
  readonly petIgnore: boolean
  readonly deathDmg: boolean
  readonly genericSpawn: boolean
  readonly zoo: boolean
  readonly SendSkills: number
  readonly align: 0 | 1 | 2
  readonly isLUndead: boolean
  readonly isHUndead: boolean
  readonly isDemon: boolean
  readonly flying: boolean
  readonly noRatio: boolean
  readonly setBoss: boolean
  readonly bossXfer: boolean
  readonly inTown: boolean
  readonly interact: boolean
  readonly npc: boolean
  readonly inventory: boolean

  readonly minGrp: number
  readonly maxGrp: number
  readonly partyMin: number
  readonly partyMax: number
  readonly velocity: number
  readonly run: number
  readonly sparsePopulate: number
  readonly rarity: number
  readonly threat: number
  readonly meleeRng: number
  readonly sizeX: number
  readonly sizeY: number
  readonly spawnCol: number
  readonly height: number
  readonly overlayHeight: number
  readonly pixHeight: number
  readonly baseW: string
  readonly hitClass: number

  readonly level: MonStats113cDifficultyVector
  readonly aidel: MonStats113cDifficultyVector
  readonly aidist: MonStats113cDifficultyVector
  readonly aip1: MonStats113cDifficultyVector
  readonly aip2: MonStats113cDifficultyVector
  readonly aip3: MonStats113cDifficultyVector
  readonly aip4: MonStats113cDifficultyVector
  readonly aip5: MonStats113cDifficultyVector
  readonly aip6: MonStats113cDifficultyVector
  readonly aip7: MonStats113cDifficultyVector
  readonly aip8: MonStats113cDifficultyVector

  readonly minHP: MonStats113cDifficultyVector
  readonly maxHP: MonStats113cDifficultyVector
  readonly ac: MonStats113cDifficultyVector
  readonly exp: MonStats113cDifficultyVector
  readonly toBlock: MonStats113cDifficultyVector
  readonly crit: number
  readonly damageRegen: number

  readonly a1: MonStats113cAttackRow
  readonly a2: MonStats113cAttackRow
  readonly s1: MonStats113cAttackRow
  readonly elementalAttacks: readonly MonStats113cElementalAttackRow[]
  readonly skills: readonly MonStats113cSkillRow[]
  readonly modeMissiles: Readonly<
    Partial<
      Record<
        | 'MissA1'
        | 'MissA2'
        | 'MissS1'
        | 'MissS2'
        | 'MissS3'
        | 'MissS4'
        | 'MissC'
        | 'MissSQ'
        | 'A1'
        | 'A2'
        | 'S1'
        | 'S2'
        | 'S3'
        | 'S4'
        | 'C'
        | 'SQ',
        string
      >
    >
  >

  readonly resDm: MonStats113cDifficultyVector
  readonly resMa: MonStats113cDifficultyVector
  readonly resFi: MonStats113cDifficultyVector
  readonly resLi: MonStats113cDifficultyVector
  readonly resCo: MonStats113cDifficultyVector
  readonly resPo: MonStats113cDifficultyVector
  readonly drain: MonStats113cDifficultyVector
  readonly coldEffect: MonStats113cDifficultyVector
  readonly coldeffect: MonStats113cDifficultyVector

  readonly tc: readonly [
    norm: string,
    champ: string,
    uniq: string,
    quest: string,
    nmNorm: string,
    nmChamp: string,
    nmUniq: string,
    nmQuest: string,
    hellNorm: string,
    hellChamp: string,
    hellUniq: string,
    hellQuest: string,
  ]
  readonly minions: readonly string[]

  readonly m1m: boolean
  readonly m2m: boolean
  readonly mSm: boolean
  readonly m1c: boolean
  readonly m2c: boolean
  readonly mSc: boolean
}

export interface MonAi113cRow {
  readonly index: number
  readonly ai: string
  readonly paramDescriptions: readonly string[]
}

export interface MonLvl113cRow {
  readonly level: number
  readonly ac: MonStats113cDifficultyVector
  readonly lAc: MonStats113cDifficultyVector
  readonly th: MonStats113cDifficultyVector
  readonly lTh: MonStats113cDifficultyVector
  readonly hp: MonStats113cDifficultyVector
  readonly lHp: MonStats113cDifficultyVector
  readonly dm: MonStats113cDifficultyVector
  readonly lDm: MonStats113cDifficultyVector
  readonly xp: MonStats113cDifficultyVector
  readonly lXp: MonStats113cDifficultyVector
}

export interface MonUMod113cRow {
  readonly umodId: number
  readonly id: string
  readonly enabled: boolean
  readonly version: number
  readonly xfer: boolean
  readonly champion: boolean
  readonly fPick: number
  readonly exclude1: string
  readonly exclude2: string
  readonly cpick: MonStats113cDifficultyVector
  readonly upick: MonStats113cDifficultyVector
  readonly constants: number
}

export interface MonUMod113cConstants {
  readonly raw: readonly number[]
  readonly championChance: number
  readonly championHpBonusPct: MonStats113cDifficultyVector
  readonly championDmgBonusPct: MonStats113cDifficultyVector
  readonly championArBonusPct: MonStats113cDifficultyVector
  readonly championToHitBonusPct: number
  readonly uniqueHpBonusPct: MonStats113cDifficultyVector
  readonly uniqueDmgBonusPct: MonStats113cDifficultyVector
  readonly uniqueArBonusPct: MonStats113cDifficultyVector
  readonly uniqueToHitBonusPct: number
  readonly uniqueStrongDmgBonusPct: number
  readonly minionHpBonusPct: MonStats113cDifficultyVector
  readonly minionDmgBonusPct: MonStats113cDifficultyVector
  readonly minionArBonusPct: MonStats113cDifficultyVector
  readonly minionToHitBonusPct: number
  readonly minionStrongDmgBonusPct: number
  readonly minionElemMinDmgPct: MonStats113cDifficultyVector
  readonly minionElemMaxDmgPct: MonStats113cDifficultyVector
  readonly championElemMinDmgPct: MonStats113cDifficultyVector
  readonly championElemMaxDmgPct: MonStats113cDifficultyVector
  readonly uniqueElemMinDmgPct: MonStats113cDifficultyVector
  readonly uniqueElemMaxDmgPct: MonStats113cDifficultyVector
}

export interface SuperUnique113cTc {
  readonly 0: string
  readonly 1: string
  readonly 2: string
  readonly normal: string
  readonly nightmare: string
  readonly hell: string
}

export interface SuperUnique113cRow {
  readonly superunique: string
  readonly name: string
  readonly classId: string
  readonly class: string
  readonly hcIdx: number
  readonly monSound: string
  readonly mod1: number
  readonly mod2: number
  readonly mod3: number
  readonly mods: readonly number[]
  readonly minGrp: number
  readonly maxGrp: number
  readonly eClass: number
  readonly autoPos: boolean
  readonly stacks: boolean
  readonly replaceable: boolean
  readonly uTrans: MonStats113cDifficultyVector
  readonly tc: SuperUnique113cTc
}

export const MONSTATS_113C_ROWS: readonly MonStats113cRow[] = ${JSON.stringify(data.monStats)}

export const MONAI_113C_ROWS: readonly MonAi113cRow[] = ${JSON.stringify(data.monAi)}

export const MONLVL_113C_ROWS: readonly MonLvl113cRow[] = ${JSON.stringify(data.monLvl)}

export const MONUMOD_113C_ROWS: readonly MonUMod113cRow[] = ${JSON.stringify(data.monUMod)}

export const MONUMOD_113C_CONSTANTS: MonUMod113cConstants = ${JSON.stringify(data.monUModConstants)}

export const SUPERUNIQUES_113C_ROWS: readonly SuperUnique113cRow[] = ${JSON.stringify(data.superUniques)}
`
}

export function renderHirelingTableModule(hirelings: readonly Hireling113cExtractedRecord[]): string {
  return `/**
 * Canonical Diablo II v1.13c Hireling data table & stat resolver.
 *
 * Ground Truth References:
 * - \`Hireling.txt\` / \`hireling.bin\` (120 rows)
 * - D2Common.dll ordinal 10988 (0x6fd7c9e0) -> Act index resolution
 * - D2Common.dll ordinal 10458 (0x6fd7ccc0) -> 64-bit LCG candidate evaluation
 * - D2Common.dll ordinal 10091 (0x6fd7c9c0) -> Ability description string resolution
 * - D2Common.dll ordinal 11156 (0x6fda32c0) -> Highest level <= mercLevel bracket selection
 * - D2Game.dll 0x6fc68ba0 (D2GAME_MERCS_SetStats_6FC68BA0) -> Hireling level-up stat scaling
 * - D2Game.dll 0x6fc3c4e0 (AIMERC_ChooseSkill_6FC3C4E0) -> Hireling skill chance & level scaling
 * - D2Client.dll 0x6faf9440 -> Candidate dialog line formatting
 *
 * DO NOT EDIT MANUALLY.
 */

import { lookupTbl } from '../formats/tbl.ts'

export interface HirelingSkillEntry {
  readonly slot: 1 | 2 | 3 | 4 | 5 | 6
  readonly skillName: string
  readonly skillId: number
  readonly mode: number
  readonly chance: number
  readonly chancePerLvl: number
  readonly level: number
  readonly lvlPerLvl: number
}

export interface HirelingRecord {
  readonly hireling: string
  readonly subType: string
  readonly id: number
  readonly version: number
  readonly subTypeId: number
  readonly classId: number
  readonly act: number
  readonly difficulty: number
  readonly seller: number
  readonly gold: number
  readonly hireCost: number
  readonly level: number
  readonly expPerLvl: number
  readonly hp: number
  readonly hpPerLvl: number
  readonly defense: number
  readonly defPerLvl: number
  readonly str: number
  readonly strPerLvl: number
  readonly dex: number
  readonly dexPerLvl: number
  readonly ar: number
  readonly arPerLvl: number
  readonly share: number
  readonly dmgMin: number
  readonly dmgMax: number
  readonly dmgPerLvl: number
  readonly resist: number
  readonly resistPerLvl: number
  readonly wType1: string
  readonly wType2: string
  readonly hireDesc: number
  readonly defaultChance: number
  readonly nameFirstKey: string
  readonly nameLastKey: string
  readonly wNameFirstId: number
  readonly wNameLastId: number
  readonly skills: readonly number[]
  readonly skillEntries: readonly HirelingSkillEntry[]
}

export const HIRELING_RECORDS: readonly HirelingRecord[] = ${JSON.stringify(hirelings, null, 2)}

export interface ResolvedHirelingSkillAtLevel {
  readonly skillId: number
  readonly skillName: string
  readonly mode: number
  readonly chance: number
  readonly effectiveLevel: number
}

export interface ResolvedHirelingStatsAtLevel {
  readonly id: number
  readonly subType: string
  readonly classId: number
  readonly act: number
  readonly difficulty: number
  readonly level: number
  readonly baseRowLevel: number
  readonly hp: number
  readonly defense: number
  readonly str: number
  readonly dex: number
  readonly ar: number
  readonly minDmg: number
  readonly maxDmg: number
  readonly resist: number
  readonly defaultChance: number
  readonly skills: readonly ResolvedHirelingSkillAtLevel[]
  readonly auraSkillId?: number
  readonly auraSkillLevel?: number
  readonly record: HirelingRecord
}

/**
 * Returns all Hireling.txt rows matching a Hireling Id (and expansion/classic version).
 */
export function getHirelingRecordsById(id: number, expansion = true): readonly HirelingRecord[] {
  const version = expansion ? 100 : 0
  return HIRELING_RECORDS.filter((r) => r.version === version && (r.id === id || r.subTypeId === id))
}

/**
 * Resolves a hireling's stats and skill levels at a target mercenary level
 * per D2Common.dll #11156 (0x6fda32c0) bracket selection and
 * D2Game.dll D2GAME_MERCS_SetStats_6FC68BA0 (0x6fc68ba0) + AIMERC_ChooseSkill_6FC3C4E0 (0x6fc3c4e0).
 */
export function resolveHirelingStatsAtLevel(
  hirelingId: number,
  targetLevel: number,
  expansion?: boolean,
): ResolvedHirelingStatsAtLevel | undefined
export function resolveHirelingStatsAtLevel(
  subTypeOrId: number | string,
  act: number,
  difficulty: number,
  mercLevel: number,
  expansion?: boolean,
): ResolvedHirelingStatsAtLevel | undefined
export function resolveHirelingStatsAtLevel(
  subTypeOrId: number | string,
  actOrTargetLevel: number,
  difficultyOrExpansion?: number | boolean,
  maybeMercLevel?: number,
  maybeExpansion = true,
): ResolvedHirelingStatsAtLevel | undefined {
  let candidates: readonly HirelingRecord[]
  let mercLevel: number

  if (typeof difficultyOrExpansion === 'boolean' || difficultyOrExpansion === undefined) {
    // 2/3-arg overload: (hirelingId, targetLevel, expansion?)
    const expansion = difficultyOrExpansion ?? true
    const version = expansion ? 100 : 0
    mercLevel = actOrTargetLevel
    candidates = HIRELING_RECORDS.filter(
      (r) =>
        r.version === version &&
        (typeof subTypeOrId === 'number'
          ? r.id === subTypeOrId || r.subTypeId === subTypeOrId
          : r.subType.toLowerCase() === subTypeOrId.toLowerCase().trim() ||
            r.hireling.toLowerCase() === subTypeOrId.toLowerCase().trim()),
    )
  } else {
    // 4/5-arg overload: (subTypeOrId, act, difficulty, mercLevel, expansion?)
    const act = actOrTargetLevel
    const difficulty = difficultyOrExpansion
    mercLevel = maybeMercLevel ?? 1
    const version = maybeExpansion ? 100 : 0
    const matchesSubType = (r: HirelingRecord): boolean => {
      if (typeof subTypeOrId === 'number') {
        return r.id === subTypeOrId || r.subTypeId === subTypeOrId
      }
      const q = subTypeOrId.toLowerCase().trim()
      const sub = r.subType.toLowerCase()
      const subPrefix = sub.split(/[\\s-]+/)[0] ?? sub
      return (
        sub === q ||
        sub.startsWith(q) ||
        (subPrefix.length >= 3 && q.startsWith(subPrefix)) ||
        r.hireling.toLowerCase() === q
      )
    }
    candidates = HIRELING_RECORDS.filter(
      (r) =>
        r.version === version &&
        r.act === act &&
        r.difficulty === difficulty &&
        matchesSubType(r),
    )

    if (candidates.length === 0) {
      candidates = HIRELING_RECORDS.filter(
        (r) => r.version === version && matchesSubType(r),
      )
    }
  }

  if (candidates.length === 0) return undefined

  // Select the row with the highest base level <= mercLevel (or lowest row if mercLevel < all rows)
  let selected = candidates[0]!
  for (const row of candidates) {
    if (row.level <= mercLevel && row.level >= selected.level) {
      selected = row
    }
  }

  const deltaLvl = Math.max(0, mercLevel - selected.level)

  // D2Game.dll 0x6fc68ba0 fixed-point scaling
  const hp = Math.max(40, selected.hp + deltaLvl * selected.hpPerLvl)
  const defense = Math.max(0, selected.defense + deltaLvl * selected.defPerLvl)
  const str = Math.max(10, selected.str + Math.trunc((deltaLvl * selected.strPerLvl) / 8))
  const dex = Math.max(10, selected.dex + Math.trunc((deltaLvl * selected.dexPerLvl) / 8))
  const ar = Math.max(0, selected.ar + deltaLvl * selected.arPerLvl)
  const dmgBonus = Math.trunc((deltaLvl * selected.dmgPerLvl) / 8)
  const minDmg = selected.dmgMin + dmgBonus
  const maxDmg = selected.dmgMax + dmgBonus
  const resist = Math.max(0, selected.resist + Math.trunc((deltaLvl * selected.resistPerLvl) / 4))

  let auraSkillId: number | undefined
  let auraSkillLevel: number | undefined

  const skills: ResolvedHirelingSkillAtLevel[] = selected.skillEntries.map((sk) => {
    const chance = Math.max(0, sk.chance + Math.trunc((deltaLvl * sk.chancePerLvl) / 4))
    const rawLevel = sk.level + Math.trunc((deltaLvl * sk.lvlPerLvl) / 32)
    const effectiveLevel = Math.min(32, Math.max(1, rawLevel))
    if (sk.mode === 1) {
      auraSkillId = sk.skillId
      auraSkillLevel = effectiveLevel
    }
    return {
      skillId: sk.skillId,
      skillName: sk.skillName,
      mode: sk.mode,
      chance,
      effectiveLevel,
    }
  })

  return {
    id: selected.id,
    subType: selected.subType,
    classId: selected.classId,
    act: selected.act,
    difficulty: selected.difficulty,
    level: mercLevel,
    baseRowLevel: selected.level,
    hp,
    defense,
    str,
    dex,
    ar,
    minDmg,
    maxDmg,
    resist,
    defaultChance: selected.defaultChance,
    skills,
    ...(auraSkillId !== undefined ? { auraSkillId } : {}),
    ...(auraSkillLevel !== undefined ? { auraSkillLevel } : {}),
    record: selected,
  }
}

export interface HirelingCandidateDesc {
  readonly mercId: number
  readonly nameId: number
  readonly seed: number
  readonly actIndex: number
  readonly classId: number
  readonly subTypeId: number
  readonly name: string
  readonly level: number
  readonly hp: number
  readonly defense: number
  readonly strength: number
  readonly dexterity: number
  readonly cost: number
  readonly resist: number
  readonly hireDescId: number
  readonly hireDesc: string
  readonly skills: readonly number[]
  readonly line1: string
  readonly line2: string
  readonly record?: any | undefined
}

/**
 * Maps a mercenary name ID to their act index (0..3) per D2Common.dll ordinal 10988 (0x6fd7c9e0).
 */
export function resolveHirelingAct(wMercName: number, expansion = true): number {
  const version = expansion ? 100 : 0
  for (const r of HIRELING_RECORDS) {
    if (r.version === version && r.wNameFirstId <= wMercName && wMercName <= r.wNameLastId) {
      return r.act - 1
    }
  }
  // Fallbacks by known name ranges
  if (wMercName >= 3411 && wMercName <= 3451) return 0
  if (wMercName >= 1019 && wMercName <= 1039) return 1
  if (wMercName >= 1040 && wMercName <= 1059) return 2
  if (wMercName === 11021 || wMercName === 0x0421) return 2
  if (wMercName >= 10835 && wMercName <= 10901) return 4
  return 0
}

/**
 * Resolves a mercenary name string from their TBL index or (mercType, nameId) per D2Client.dll 0x6faf9783.
 */
export function resolveHirelingName(
  mercTypeOrNameId: number,
  nameIdOrLang?: number | 'ENG' | 'CHI',
  maybeLang: 'ENG' | 'CHI' = 'CHI',
): string {
  let wMercName: number
  let lang: 'ENG' | 'CHI'

  if (typeof nameIdOrLang === 'number') {
    const mercType = mercTypeOrNameId
    const nameId = nameIdOrLang
    lang = maybeLang

    if (nameId >= 1000) {
      wMercName = nameId
    } else {
      if (mercType === 0 || mercType === 271) {
        wMercName = 3411 + nameId
      } else if (mercType === 1 || mercType === 338) {
        wMercName = 1019 + nameId
      } else if (mercType === 2 || mercType === 359) {
        wMercName = 1040 + nameId
      } else if (mercType === 3 || mercType === 4 || mercType === 561) {
        wMercName = 10835 + nameId
      } else {
        wMercName = nameId
      }
    }
  } else {
    wMercName = mercTypeOrNameId
    lang = nameIdOrLang ?? 'CHI'
  }

  // D2Client.dll 0x6faf978c: if wMercName == 0x0421 (1057), replace with 0x2b0d (11021 = "Jarulf")
  const resolvedNameId = wMercName === 0x0421 ? 0x2b0d : wMercName

  if (resolvedNameId === 0x2b0d) {
    return lookupTbl('merca239', lang) ?? (lang === 'ENG' ? 'Jarulf' : '賈魯夫')
  }

  // Act 1 Rogue (string.tbl 3411..3444 -> merc01..merc34)
  if (resolvedNameId >= 3411 && resolvedNameId <= 3451) {
    const idx = resolvedNameId - 3411 + 1
    const key = \`merc\${idx < 10 ? \`0\${idx}\` : idx}\`
    return lookupTbl(key, lang) ?? (lang === 'ENG' ? \`Rogue #\${idx}\` : \`羅格 #\${idx}\`)
  }

  // Act 2 Desert Mercenary (patchstring.tbl 1019..1039 -> merca201..merca221)
  if (resolvedNameId >= 1019 && resolvedNameId <= 1039) {
    const idx = resolvedNameId - 1019 + 1
    const key = \`merca2\${idx < 10 ? \`0\${idx}\` : idx}\`
    return lookupTbl(key, lang) ?? (lang === 'ENG' ? \`Desert Mercenary #\${idx}\` : \`沙漠傭兵 #\${idx}\`)
  }

  // Act 3 Iron Wolf (patchstring.tbl 1040..1059 -> merca222..merca241)
  if (resolvedNameId >= 1040 && resolvedNameId <= 1059) {
    const idx = resolvedNameId - 1040 + 22
    const key = \`merca2\${idx}\`
    return lookupTbl(key, lang) ?? (lang === 'ENG' ? \`Iron Wolf #\${idx}\` : \`鐵狼 #\${idx}\`)
  }

  // Act 5 Barbarian (patchstring.tbl 835..901 / global 10835..10901 -> MercX101..MercX167)
  const barbId = resolvedNameId >= 10000 ? resolvedNameId - 10000 : resolvedNameId
  if (barbId >= 835 && barbId <= 901) {
    const idx = barbId - 835 + 101
    const key = \`MercX\${idx}\`
    return lookupTbl(key, lang) ?? (lang === 'ENG' ? \`Barbarian #\${idx}\` : \`野蠻人 #\${idx}\`)
  }

  return lookupTbl(\`merc\${resolvedNameId}\`, lang) ?? \`Mercenary #\${resolvedNameId}\`
}

/**
 * Resolves the hireling ability description string per D2Common.dll ordinal 10091 (0x6fd7c9c0).
 */
export function resolveHirelingDesc(hireDescId: number, lang: 'ENG' | 'CHI' = 'CHI'): string {
  switch (hireDescId) {
    case 1:
      return lookupTbl('strhirespecial1', lang) ?? (lang === 'ENG' ? 'Fire Arrow' : '火箭')
    case 2:
      return lookupTbl('strhirespecial2', lang) ?? (lang === 'ENG' ? 'Cold Arrow' : '冰箭')
    case 3:
      return lookupTbl('PalMercEXST4X', lang) ?? (lang === 'ENG' ? 'Combat' : '戰鬥')
    case 4:
      return lookupTbl('PalMercExST1X', lang) ?? (lang === 'ENG' ? 'Defensive' : '防禦')
    case 5:
      return lookupTbl('PalMercEXST3X', lang) ?? (lang === 'ENG' ? 'Offensive' : '進攻')
    case 6:
      return lookupTbl('strhirespecial7', lang) ?? (lang === 'ENG' ? 'Fire' : '火')
    case 7:
      return lookupTbl('strhirespecial6', lang) ?? (lang === 'ENG' ? 'Cold' : '冷')
    case 8:
      return lookupTbl('strhirespecial5', lang) ?? (lang === 'ENG' ? 'Lightning' : '閃電')
    default:
      return ''
  }
}

/**
 * Formats a candidate into 2 lines for the scrollable list control per D2Client.dll 0x6faf9440.
 */
export function formatHirelingCandidateLines(
  name: string,
  level: number,
  hp: number,
  defense: number,
  cost: number,
  hireDesc: string,
  lang: 'ENG' | 'CHI' = 'CHI',
): { line1: string; line2: string } {
  const lvlLabel = lookupTbl('Level', lang) ?? (lang === 'ENG' ? 'Lvl' : '等級')
  const lifeLabel = lookupTbl('HP', lang) ?? (lang === 'ENG' ? 'Life' : '生命')
  const defLabel = lookupTbl('AC', lang) ?? (lang === 'ENG' ? 'Def' : '防禦')
  const costLabel = lookupTbl('Cost', lang) ?? (lang === 'ENG' ? 'Cost' : '花費')

  const line1 = \`\${name} - \${lvlLabel}: \${level}  \${lifeLabel}: \${hp}  \${defLabel}: \${defense}  \${costLabel}: \${cost}\`
  const line2 = hireDesc ? \`  \${hireDesc}\` : '  '

  return { line1, line2 }
}

/**
 * Evaluates a candidate's authentic stats, level, and hire cost using Diablo II's 64-bit LCG
 * per D2Common.dll ordinal 10458 (0x6fd7ccc0).
 * Also supports direct (act: 1|2|3|5, difficulty: 1|2|3, subTypeIndex: number, targetLevel: number, expansion?: boolean) lookup.
 */
export function resolveHirelingCandidate(
  candidate: { readonly nameId: number; readonly seed: number },
  playerLevel: number,
  difficulty: number,
  actIndex: number,
  expansion?: boolean,
  lang?: 'ENG' | 'CHI',
): HirelingCandidateDesc
export function resolveHirelingCandidate(
  act: 1 | 2 | 3 | 5,
  difficulty: 1 | 2 | 3,
  subTypeIndex: number,
  targetLevel: number,
  expansion?: boolean,
): HirelingRecord | undefined
export function resolveHirelingCandidate(
  candidateOrAct: { readonly nameId: number; readonly seed: number } | (1 | 2 | 3 | 5),
  playerLevelOrDifficulty: number,
  difficultyOrSubTypeIndex: number,
  actIndexOrTargetLevel: number,
  expansion = true,
  lang: 'ENG' | 'CHI' = 'CHI',
): HirelingCandidateDesc | HirelingRecord | undefined {
  const version = expansion ? 100 : 0

  if (typeof candidateOrAct === 'number') {
    const act = candidateOrAct
    const difficulty = playerLevelOrDifficulty
    const subTypeIndex = difficultyOrSubTypeIndex
    const targetLevel = actIndexOrTargetLevel
    const matching = HIRELING_RECORDS.filter(
      (r) => r.version === version && r.act === act && r.difficulty === difficulty,
    )
    if (matching.length === 0) return undefined
    const distinctIds: number[] = []
    for (const r of matching) {
      if (!distinctIds.includes(r.subTypeId)) distinctIds.push(r.subTypeId)
    }
    const targetSubTypeId = distinctIds[subTypeIndex % distinctIds.length]!
    const subRows = matching.filter((r) => r.subTypeId === targetSubTypeId)
    let selected = subRows[0]!
    for (const r of subRows) {
      if (r.level <= targetLevel && r.level >= selected.level) {
        selected = r
      }
    }
    return selected
  }

  const candidate = candidateOrAct
  const playerLevel = playerLevelOrDifficulty
  const difficulty = difficultyOrSubTypeIndex
  const actIndex = actIndexOrTargetLevel
  const targetAct = actIndex + 1
  const targetDiff = difficulty + 1

  // 1. Collect all base rows matching (version, act, difficulty) per 0x6fda3050
  const actDiffRows = HIRELING_RECORDS.filter(
    (r) => r.version === version && r.act === targetAct && r.difficulty === targetDiff,
  )

  let matchingRows = actDiffRows
  if (actDiffRows.length > 0) {
    const baseLevel = actDiffRows[0]!.level
    const levelFiltered = actDiffRows.filter((r) => r.level === baseLevel)
    if (levelFiltered.length > 0) {
      matchingRows = levelFiltered
    }
  }

  if (matchingRows.length === 0) {
    matchingRows = HIRELING_RECORDS.filter((r) => r.act === targetAct)
  }
  if (matchingRows.length === 0) {
    matchingRows = [HIRELING_RECORDS[0]!]
  }

  // 2. D2Common 64-bit LCG simulation (0x6fd7cd20..0x6fd7cd95)
  let seedLo = candidate.seed >>> 0
  let seedHi = 0x29a // 666

  // Step 1: Subtype / row selection
  const step1 = BigInt(seedLo) * 0x6ac690c5n + BigInt(seedHi)
  seedLo = Number(step1 & 0xffffffffn) >>> 0
  seedHi = Number((step1 >> 32n) & 0xffffffffn) >>> 0

  const rowCount = matchingRows.length
  const isPowerOfTwo = (rowCount & (rowCount - 1)) === 0
  const rowIndex = isPowerOfTwo ? (seedLo & (rowCount - 1)) : (seedLo % rowCount)
  const pRow = matchingRows[rowIndex] ?? matchingRows[0]!

  // Step 2: Level selection
  const step2 = BigInt(seedLo) * 0x6ac690c5n + BigInt(seedHi)
  const seedLo2 = Number(step2 & 0xffffffffn) >>> 0
  const levelOffset = (seedLo2 >>> 0) % 5

  const effPlayerLevel = Math.max(1, playerLevel)
  const mercLevel = Math.max(2, effPlayerLevel + levelOffset - 5)
  const levelDelta = mercLevel - pRow.level

  // Step 3: Compute exact stats
  const hp = Math.max(40, pRow.hp + levelDelta * pRow.hpPerLvl)
  const defense = Math.max(0, pRow.defense + levelDelta * pRow.defPerLvl)
  const strength = Math.max(10, pRow.str + ((levelDelta * pRow.strPerLvl) >> 3))
  const dexterity = Math.max(10, pRow.dex + ((levelDelta * pRow.dexPerLvl) >> 3))
  const cost = Math.max(
    pRow.hireCost,
    Math.trunc((pRow.hireCost * (100 + 15 * levelDelta)) / 100),
  )
  const resist = Math.max(0, pRow.resist + Math.trunc((levelDelta * pRow.resistPerLvl) / 4))

  const name = resolveHirelingName(candidate.nameId, lang)
  const hireDesc = resolveHirelingDesc(pRow.hireDesc, lang)
  const { line1, line2 } = formatHirelingCandidateLines(
    name,
    mercLevel,
    hp,
    defense,
    cost,
    hireDesc,
    lang,
  )

  return {
    mercId: candidate.nameId,
    nameId: candidate.nameId,
    seed: candidate.seed,
    actIndex,
    classId: pRow.classId,
    subTypeId: pRow.subTypeId,
    name,
    level: mercLevel,
    hp,
    defense,
    strength,
    dexterity,
    cost,
    resist,
    hireDescId: pRow.hireDesc,
    hireDesc,
    skills: pRow.skills,
    line1,
    line2,
    record: { ...pRow, hcIdx: pRow.classId },
  }
}

/**
 * Resolves a list of candidates from raw { nameId, seed } pairs.
 */
export function resolveHirelingCandidates(
  candidates: readonly { readonly nameId: number; readonly seed: number }[],
  playerLevel: number,
  difficulty: number,
  actIndex: number,
  expansion = true,
  lang: 'ENG' | 'CHI' = 'CHI',
): readonly HirelingCandidateDesc[] {
  return candidates.map((c) =>
    resolveHirelingCandidate(c, playerLevel, difficulty, actIndex, expansion, lang),
  )
}
`
}

export function runMonsters113cPacker(write = false): {
  readonly monStatsCount: number
  readonly monAiCount: number
  readonly monLvlCount: number
  readonly monUModCount: number
  readonly superUniquesCount: number
  readonly hirelingsCount: number
} {
  const data = extractMonsters113cFromMpq()
  if (data.monStats.length !== 734) {
    throw new Error(`Expected 734 MonStats.txt rows, got ${String(data.monStats.length)}`)
  }
  if (data.monAi.length !== 148) {
    throw new Error(`Expected 148 MonAi.txt rows, got ${String(data.monAi.length)}`)
  }
  if (data.monLvl.length !== 111) {
    throw new Error(`Expected 111 MonLvl.txt rows, got ${String(data.monLvl.length)}`)
  }
  if (data.monUMod.length !== 43) {
    throw new Error(`Expected 43 MonUMod.txt rows, got ${String(data.monUMod.length)}`)
  }
  if (data.superUniques.length !== 66) {
    throw new Error(`Expected 66 SuperUniques.txt rows, got ${String(data.superUniques.length)}`)
  }
  if (data.hirelings.length !== 120) {
    throw new Error(`Expected 120 Hireling.txt rows, got ${String(data.hirelings.length)}`)
  }

  const monStatsOutPath = resolve(
    import.meta.dirname,
    '..',
    '..',
    'common',
    'units',
    'monstats-113c-data.ts',
  )
  const hirelingOutPath = resolve(
    import.meta.dirname,
    '..',
    '..',
    'common',
    'units',
    'hireling-table.ts',
  )

  const expectedMonStatsContent = renderMonStats113cModule(data)
  const expectedHirelingContent = renderHirelingTableModule(data.hirelings)

  if (write) {
    writeFileSync(monStatsOutPath, expectedMonStatsContent, 'utf-8')
    writeFileSync(hirelingOutPath, expectedHirelingContent, 'utf-8')
  } else {
    if (!existsSync(monStatsOutPath)) {
      throw new Error(`Missing generated file: ${monStatsOutPath} (run with --pack)`)
    }
    const actualMonStats = readFileSync(monStatsOutPath, 'utf-8')
    if (actualMonStats !== expectedMonStatsContent) {
      throw new Error(`Parity mismatch in ${monStatsOutPath} (run with --pack to regenerate)`)
    }
    if (!existsSync(hirelingOutPath)) {
      throw new Error(`Missing generated file: ${hirelingOutPath} (run with --pack)`)
    }
    const actualHireling = readFileSync(hirelingOutPath, 'utf-8')
    if (actualHireling !== expectedHirelingContent) {
      throw new Error(`Parity mismatch in ${hirelingOutPath} (run with --pack to regenerate)`)
    }
  }

  return {
    monStatsCount: data.monStats.length,
    monAiCount: data.monAi.length,
    monLvlCount: data.monLvl.length,
    monUModCount: data.monUMod.length,
    superUniquesCount: data.superUniques.length,
    hirelingsCount: data.hirelings.length,
  }
}

const isMain =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  resolve(process.argv[1]).endsWith('pack-monsters-113c.ts')

if (isMain) {
  const shouldWrite = process.argv.includes('--pack') || process.argv.includes('--write')
  const summary = runMonsters113cPacker(shouldWrite)
  console.log(
    `[pack-monsters-113c] ${shouldWrite ? 'Wrote' : 'Verified'} 1.13c data contract: ` +
      `MonStats=${String(summary.monStatsCount)}, MonAi=${String(summary.monAiCount)}, ` +
      `MonLvl=${String(summary.monLvlCount)}, MonUMod=${String(summary.monUModCount)}, ` +
      `SuperUniques=${String(summary.superUniquesCount)}, Hireling=${String(summary.hirelingsCount)}`,
  )
}
