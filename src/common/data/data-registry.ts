/**
 * Authoritative Diablo II: Lord of Destruction v1.13c Data Registry (`D2DataRegistry`).
 *
 * Mounts the 4 canonical 1.13c MPQ archives (`d2data.mpq`, `d2char.mpq`,
 * `d2exp.mpq`, `Patch_D2.mpq`) in exact overlay precedence order via an injected
 * `ArchiveSource` / `MountedArchives` so `Patch_D2.mpq` provides authoritative 1.13c
 * `.txt` tables (`Skills.txt`, `SkillDesc.txt`, `Missiles.txt`, `States.txt`,
 * `ItemStatCost.txt`, `CharStats.txt`, `MonStats.txt`, `MonStats2.txt`,
 * `Overlay.txt`, `PetType.txt`, `ElemTypes.txt`, `Events.txt`, `SkillCalc.txt`,
 * `MissCalc.txt`) while `d2exp.mpq` provides `HitClass.txt` and `AnimData.d2`
 * (`570,304` bytes, `3,558` records).
 */
import type { MountedArchives } from '../mpq/mount.ts'
import { decodeAnimDataFile, type AnimDataFile, type AnimDataRecord } from '../formats/animdata.ts'
import { parseTable, numberCell, textCell, type DataTable } from '../items/tables.ts'
import { getLevelLighting, type LevelLightingDef } from '../world/levels-meta.ts'

export interface ArchiveSource {
  read?(mpqRelativePath: string): Promise<Uint8Array> | Uint8Array | null
  readSync?(mpqRelativePath: string): Uint8Array | null
  readFile?(mpqRelativePath: string): Uint8Array | null
  readBytes?(mpqRelativePath: string): Uint8Array | null
  readText?(mpqRelativePath: string): string | null
  has?(mpqRelativePath: string): boolean
}

export interface D2DataRegistryParams {
  skillsTable: DataTable
  skillDescTable: DataTable
  missilesTable: DataTable
  statesTable: DataTable
  itemStatCostTable: DataTable
  charStatsTable: DataTable
  monStatsTable: DataTable
  monStats2Table: DataTable
  overlayTable: DataTable
  petTypeTable: DataTable
  elemTypesTable: DataTable
  hitClassTable: DataTable
  eventsTable: DataTable
  skillCalcTable: DataTable
  missCalcTable: DataTable
  animData: AnimDataFile
}

export const MPQ_LOAD_ORDER = [
  'd2data.mpq',
  'd2char.mpq',
  'd2exp.mpq',
  'Patch_D2.mpq',
] as const

export const UNIVERSAL_PLAYER_SKILL_IDS = [
  0,   // Attack
  1,   // Kick
  2,   // Throw
  3,   // Unsummon
  4,   // Left Hand Throw
  5,   // Left Hand Swing
  217, // Scroll of Identify
  218, // Book of Identify
  219, // Scroll of Townportal
  220, // Book of Townportal
  350, // Delerium Change
] as const

export const PET_SUB_SKILL_IDS = [
  281, // Wake Of Destruction Sentry
  292, // Teleport 2 (Shadow Warrior/Master)
  294, // Vine Attack (Plague Poppy)
  296, // Barbs Aura (Spirit of Barbs)
  297, // Wolverine Aura (Heart of Wolverine)
  298, // Oak Sage Aura (Oak Sage)
  306, // BoltSentry (Charged Bolt Sentry)
  307, // CorpseCycler (Carrion Vine)
  311, // mon inferno sentry
  312, // mon death sentry
  313, // sentry lightning
  314, // fenris rage
  324, // death sentry ltng
  325, // VineCycler (Solar Creeper)
  326, // BearSmite (Summon Grizzly)
  337, // HydraMissile
  338, // NecromageMissile
] as const

export interface SkillRecord {
  readonly id: number
  readonly name: string
  readonly skill: string
  readonly charClass: string // 'ama' | 'sor' | 'nec' | 'pal' | 'bar' | 'dru' | 'ass' | ''
  readonly skillDesc: string
  readonly srvStFunc: number
  readonly srvDoFunc: number
  readonly srvPrgFunc1: number
  readonly srvPrgFunc2: number
  readonly srvPrgFunc3: number
  readonly prgCalc1: string
  readonly prgCalc2: string
  readonly prgCalc3: string
  readonly prgDam: number
  readonly srvMissile: string
  readonly srvMissileA: string
  readonly srvMissileB: string
  readonly srvMissileC: string
  readonly cltStFunc: number
  readonly cltDoFunc: number
  readonly cltMissile: string
  readonly cltMissileA: string
  readonly cltMissileB: string
  readonly cltMissileC: string
  readonly cltMissileD: string
  readonly passive: boolean
  readonly passiveState: string
  readonly passiveStat1: string
  readonly passiveCalc1: string
  readonly passiveStat2: string
  readonly passiveCalc2: string
  readonly passiveStat3: string
  readonly passiveCalc3: string
  readonly passiveStat4: string
  readonly passiveCalc4: string
  readonly passiveStat5: string
  readonly passiveCalc5: string
  readonly aura: boolean
  readonly auraFilter: number
  readonly auraState: string
  readonly auraTgtState: string
  readonly auraLenCalc: string
  readonly auraRangeCalc: string
  readonly auraStat1: string
  readonly auraStatCalc1: string
  readonly auraStat2: string
  readonly auraStatCalc2: string
  readonly auraStat3: string
  readonly auraStatCalc3: string
  readonly auraStat4: string
  readonly auraStatCalc4: string
  readonly auraStat5: string
  readonly auraStatCalc5: string
  readonly auraStat6: string
  readonly auraStatCalc6: string
  readonly auraEvent1: string
  readonly auraEventFunc1: number
  readonly auraEvent2: string
  readonly auraEventFunc2: number
  readonly auraEvent3: string
  readonly auraEventFunc3: number
  readonly summon: string
  readonly petType: string
  readonly petMax: string
  readonly sumMode: string
  readonly sumSkill1: string
  readonly sumSk1Calc: string
  readonly sumSkill2: string
  readonly sumSk2Calc: string
  readonly sumSkill3: string
  readonly sumSk3Calc: string
  readonly sumSkill4: string
  readonly sumSk4Calc: string
  readonly sumSkill5: string
  readonly sumSk5Calc: string
  readonly sumUMod: number
  readonly sumOverlay: string
  readonly anim: string
  readonly seqTrans: string
  readonly monAnim: string
  readonly seqNum: number
  readonly seqInput: number
  readonly range: string
  readonly selectProc: number
  readonly reqLevel: number
  readonly reqStr: number
  readonly reqDex: number
  readonly reqInt: number
  readonly reqVit: number
  readonly reqSkill1: string
  readonly reqSkill2: string
  readonly reqSkill3: string
  readonly restrict: number
  readonly state1: string
  readonly state2: string
  readonly state3: string
  readonly delay: string
  readonly checkFunc: number
  readonly nocostinstate: boolean
  readonly decquant: boolean
  readonly manaShift: number
  readonly mana: number
  readonly lvlMana: number
  readonly minMana: number
  readonly interrupt: boolean
  readonly inTown: boolean
  readonly periodic: boolean
  readonly perDelay: string
  readonly finishing: boolean
  readonly progressive: boolean
  readonly calc1: string
  readonly calc2: string
  readonly calc3: string
  readonly calc4: string
  readonly param1: number
  readonly param2: number
  readonly param3: number
  readonly param4: number
  readonly param5: number
  readonly param6: number
  readonly param7: number
  readonly param8: number
  readonly toHit: number
  readonly toHitLev: number
  readonly toHitCalc: string
  readonly resultFlags: number
  readonly hitFlags: number
  readonly hitClass: number
  readonly kick: boolean
  readonly hitShift: number
  readonly srcDam: number
  readonly minDam: number
  readonly minLevDam1: number
  readonly minLevDam2: number
  readonly minLevDam3: number
  readonly minLevDam4: number
  readonly minLevDam5: number
  readonly maxDam: number
  readonly maxLevDam1: number
  readonly maxLevDam2: number
  readonly maxLevDam3: number
  readonly maxLevDam4: number
  readonly maxLevDam5: number
  readonly dmgSymPerCalc: string
  readonly eType: string
  readonly eMin: number
  readonly eMinLev1: number
  readonly eMinLev2: number
  readonly eMinLev3: number
  readonly eMinLev4: number
  readonly eMinLev5: number
  readonly eMax: number
  readonly eMaxLev1: number
  readonly eMaxLev2: number
  readonly eMaxLev3: number
  readonly eMaxLev4: number
  readonly eMaxLev5: number
  readonly eDmgSymPerCalc: string
  readonly eLen: number
  readonly eLevLen1: number
  readonly eLevLen2: number
  readonly eLevLen3: number
  readonly eLenSymPerCalc: string
  readonly aiType: number
  readonly aiBonus: number
  readonly castOverlay: string
  readonly cltOverlayA: string
  readonly cltOverlayB: string
  readonly prgOverlay: string
  readonly raw: Readonly<Record<string, string>>
}

export interface MissileRecord {
  readonly id: number
  readonly name: string
  readonly pCltDoFunc: number
  readonly pCltHitFunc: number
  readonly pSrvDoFunc: number
  readonly pSrvHitFunc: number
  readonly pSrvDmgFunc: number
  readonly srvCalc1: string
  readonly param1: number
  readonly param2: number
  readonly param3: number
  readonly param4: number
  readonly param5: number
  readonly cltCalc1: string
  readonly cParam1: number
  readonly cParam2: number
  readonly cParam3: number
  readonly cParam4: number
  readonly cParam5: number
  readonly sHitCalc1: string
  readonly sHitPar1: number
  readonly sHitPar2: number
  readonly sHitPar3: number
  readonly cHitCalc1: string
  readonly cHitPar1: number
  readonly cHitPar2: number
  readonly cHitPar3: number
  readonly dmgCalc1: string
  readonly dParam1: number
  readonly dParam2: number
  readonly vel: number
  readonly maxVel: number
  readonly velLev: number
  readonly accel: number
  readonly range: number
  readonly levRange: number
  readonly light: number
  readonly flicker: number
  readonly red: number
  readonly green: number
  readonly blue: number
  readonly initSteps: number
  readonly activate: number
  readonly loopAnim: number
  readonly celFile: string
  readonly animRate: number
  readonly animLen: number
  readonly animSpeed: number
  readonly subLoop: boolean
  readonly subStart: number
  readonly subStop: number
  readonly collideType: number
  readonly collideKill: boolean
  readonly collideFriend: boolean
  readonly lastCollide: boolean
  readonly collision: boolean
  readonly clientCol: boolean
  readonly nextHit: boolean
  readonly nextDelay: number
  readonly size: number
  readonly returnFire: boolean
  readonly trans: number
  readonly alwaysExplode: boolean
  readonly explosion: boolean
  readonly town: boolean
  readonly noUniqueMod: boolean
  readonly noMultiShot: boolean
  readonly holy: number
  readonly canSlow: boolean
  readonly canDestroy: boolean
  readonly toHit: boolean
  readonly pierce: boolean
  readonly skill: string
  readonly hitShift: number
  readonly srcDamage: number
  readonly minDamage: number
  readonly minLevDam1: number
  readonly minLevDam2: number
  readonly minLevDam3: number
  readonly minLevDam4: number
  readonly minLevDam5: number
  readonly maxDamage: number
  readonly maxLevDam1: number
  readonly maxLevDam2: number
  readonly maxLevDam3: number
  readonly maxLevDam4: number
  readonly maxLevDam5: number
  readonly dmgSymPerCalc: string
  readonly eType: string
  readonly eMin: number
  readonly eMinLev1: number
  readonly eMinLev2: number
  readonly eMinLev3: number
  readonly eMinLev4: number
  readonly eMinLev5: number
  readonly eMax: number
  readonly eMaxLev1: number
  readonly eMaxLev2: number
  readonly eMaxLev3: number
  readonly eMaxLev4: number
  readonly eMaxLev5: number
  readonly eDmgSymPerCalc: string
  readonly eLen: number
  readonly eLevLen1: number
  readonly eLevLen2: number
  readonly eLevLen3: number
  readonly hitClass: number
  readonly numDirections: number
  readonly localBlood: number
  readonly damageRate: number
  readonly explosionMissile: string
  readonly subMissile1: string
  readonly subMissile2: string
  readonly subMissile3: string
  readonly hitSubMissile1: string
  readonly hitSubMissile2: string
  readonly hitSubMissile3: string
  readonly hitSubMissile4: string
  readonly cltSubMissile1: string
  readonly cltSubMissile2: string
  readonly cltSubMissile3: string
  readonly cltHitSubMissile1: string
  readonly cltHitSubMissile2: string
  readonly cltHitSubMissile3: string
  readonly cltHitSubMissile4: string
  readonly raw: Readonly<Record<string, string>>
}

export interface StateRecord {
  readonly id: number
  readonly state: string
  readonly group: number
  readonly remhit: boolean
  readonly nosend: boolean
  readonly transform: boolean
  readonly aura: boolean
  readonly curse: boolean
  readonly curable: boolean
  readonly active: boolean
  readonly restrict: boolean
  readonly disguise: boolean
  readonly blue: boolean
  readonly attblue: boolean
  readonly dmgblue: boolean
  readonly armblue: boolean
  readonly rfblue: boolean
  readonly rlblue: boolean
  readonly rcblue: boolean
  readonly stambarblue: boolean
  readonly rpblue: boolean
  readonly attred: boolean
  readonly dmgred: boolean
  readonly armred: boolean
  readonly rfred: boolean
  readonly rlred: boolean
  readonly rcred: boolean
  readonly rpred: boolean
  readonly exp: boolean
  readonly plrstaydeath: boolean
  readonly monstaydeath: boolean
  readonly bossstaydeath: boolean
  readonly hide: boolean
  readonly shatter: boolean
  readonly udead: boolean
  readonly life: boolean
  readonly green: boolean
  readonly pgsv: boolean
  readonly nooverlays: boolean
  readonly noclear: boolean
  readonly bossinv: boolean
  readonly meleeonly: boolean
  readonly notondead: boolean
  readonly overlay1: string
  readonly overlay2: string
  readonly overlay3: string
  readonly overlay4: string
  readonly pgsvoverlay: string
  readonly castoverlay: string
  readonly removerlay: string
  readonly stat: string
  readonly setfunc: number
  readonly remfunc: number
  readonly missile: string
  readonly skill: string
  readonly itemtrans: string
  readonly colorpri: number
  readonly colorshift: number
  readonly lightR: number
  readonly lightG: number
  readonly lightB: number
  readonly onsound: string
  readonly offsound: string
  readonly raw: Readonly<Record<string, string>>
}

export interface ItemStatCostRecord {
  readonly id: number
  readonly stat: string
  readonly sendBits: number
  readonly signed: boolean
  readonly valShift: number
  readonly damageRelated: boolean
  readonly op: number
  readonly opParam: number
  readonly opBase: string
  readonly opStat1: string
  readonly opStat2: string
  readonly opStat3: string
  readonly direct: boolean
  readonly maxStat: string
  readonly raw: Readonly<Record<string, string>>
}

export interface PetTypeRecord {
  readonly idx: number
  readonly petType: string
  readonly group: number
  readonly baseMax: number
  readonly warp: boolean
  readonly range: boolean
  readonly partysend: boolean
  readonly unsummon: boolean
  readonly automap: boolean
  readonly name: string
  readonly drawhp: boolean
  readonly icontype: number
  readonly baseicon: string
  readonly mclass1: number
  readonly micon1: string
  readonly mclass2: number
  readonly micon2: string
  readonly mclass3: number
  readonly micon3: string
  readonly raw: Readonly<Record<string, string>>
}

export interface OverlayRecord {
  readonly id: number
  readonly overlay: string
  readonly filename: string
  readonly frames: number
  readonly animRate: number
  readonly initRadius: number
  readonly radius: number
  readonly loopWaitTime: number
  readonly trans: number
  readonly xOffset: number
  readonly yOffset: number
  readonly height1: number
  readonly height2: number
  readonly height3: number
  readonly height4: number
  readonly preDraw: boolean
  readonly red: number
  readonly green: number
  readonly blue: number
  readonly raw: Readonly<Record<string, string>>
}

export interface MonStats2LightingRecord {
  readonly id: string
  readonly light: number
  readonly lightR: number
  readonly lightG: number
  readonly lightB: number
  readonly shadow: boolean
  readonly raw: Readonly<Record<string, string>>
}

export interface MonStatsRecord {
  readonly hcIdx: number
  readonly id: string
  readonly baseId: string
  readonly nextInClass: string
  readonly translvl: number
  readonly nameStr: string
  readonly monStatsEx: string
  readonly code: string
  readonly enabled: boolean
  readonly rangedtype: boolean
  readonly align: number
  readonly isSpawn: boolean
  readonly isMelee: boolean
  readonly lUndead: boolean
  readonly hUndead: boolean
  readonly demon: boolean
  readonly flying: boolean
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
  readonly velocity: number
  readonly run: number
  readonly minHP: number
  readonly maxHP: number
  readonly ac: number
  readonly exp: number
  readonly a1MinD: number
  readonly a1MaxD: number
  readonly a1TH: number
  readonly a2MinD: number
  readonly a2MaxD: number
  readonly a2TH: number
  readonly s1MinD: number
  readonly s1MaxD: number
  readonly s1TH: number
  readonly resDm: number
  readonly resMa: number
  readonly resFi: number
  readonly resLi: number
  readonly resCo: number
  readonly resPo: number
  readonly skill1: string
  readonly sk1mode: string
  readonly sk1lvl: number
  readonly skill2: string
  readonly sk2mode: string
  readonly sk2lvl: number
  readonly skill3: string
  readonly sk3mode: string
  readonly sk3lvl: number
  readonly raw: Readonly<Record<string, string>>
}

export interface CharStatsRecord {
  readonly className: string
  readonly classCode: string // 'ama' | 'sor' | 'nec' | 'pal' | 'bar' | 'dru' | 'ass'
  readonly token: string     // 'am'  | 'so'  | 'ne'  | 'pa'  | 'ba'  | 'dz'  | 'ai'
  readonly str: number
  readonly dex: number
  readonly int: number
  readonly vit: number
  readonly stamina: number
  readonly hpadd: number
  readonly percentStr: number
  readonly percentDex: number
  readonly percentInt: number
  readonly percentVit: number
  readonly manaRegen: number
  readonly toHitFactor: number
  readonly walkVelocity: number
  readonly runVelocity: number
  readonly runDrain: number
  readonly lifePerLevel: number
  readonly staminaPerLevel: number
  readonly manaPerLevel: number
  readonly lifePerVitality: number
  readonly staminaPerVitality: number
  readonly manaPerMagic: number
  readonly blockFactor: number
  readonly startSkill: string
  readonly baseWClass: string
  readonly skills: readonly string[]
  readonly raw: Readonly<Record<string, string>>
}

/**
 * Helper to parse numeric cell while stripping leading `*` (Edge Case #3:
 * `royalstrikechainlightning` row 568 has `pSrvHitFunc = "*12"` and `pCltHitFunc = "*16"`).
 */
function parseFuncIdCell(row: Readonly<Record<string, string>>, col: string, fallback = 0): number {
  const raw = row[col]
  if (raw === undefined) return fallback
  const cleaned = raw.trim().replace(/^\*+/, '')
  const val = Number(cleaned)
  return Number.isFinite(val) ? val : fallback
}

const CLASS_NAME_TO_CODE: Readonly<Record<string, { code: string; token: string }>> = {
  amazon: { code: 'ama', token: 'am' },
  sorceress: { code: 'sor', token: 'so' },
  necromancer: { code: 'nec', token: 'ne' },
  paladin: { code: 'pal', token: 'pa' },
  barbarian: { code: 'bar', token: 'ba' },
  druid: { code: 'dru', token: 'dz' },
  assassin: { code: 'ass', token: 'ai' },
}

export class D2DataRegistry {
  readonly skillsTable: DataTable
  readonly skillDescTable: DataTable
  readonly missilesTable: DataTable
  readonly statesTable: DataTable
  readonly itemStatCostTable: DataTable
  readonly charStatsTable: DataTable
  readonly monStatsTable: DataTable
  readonly monStats2Table: DataTable
  readonly overlayTable: DataTable
  readonly petTypeTable: DataTable
  readonly elemTypesTable: DataTable
  readonly hitClassTable: DataTable
  readonly eventsTable: DataTable
  readonly skillCalcTable: DataTable
  readonly missCalcTable: DataTable
  readonly animData: AnimDataFile

  readonly skillsById = new Map<number, SkillRecord>()
  readonly skillsByName = new Map<string, SkillRecord>()
  readonly skillDescsByKey = new Map<string, Readonly<Record<string, string>>>()
  readonly missilesById = new Map<number, MissileRecord>()
  readonly missilesByName = new Map<string, MissileRecord>()
  readonly statesById = new Map<number, StateRecord>()
  readonly statesByName = new Map<string, StateRecord>()
  readonly statsById = new Map<number, ItemStatCostRecord>()
  readonly statsByName = new Map<string, ItemStatCostRecord>()
  readonly charStatsByCode = new Map<string, CharStatsRecord>()
  readonly monStatsByHcIdx = new Map<number, MonStatsRecord>()
  readonly monStatsById = new Map<string, MonStatsRecord>()
  readonly monStats2ById = new Map<string, MonStats2LightingRecord>()
  readonly overlaysByName = new Map<string, OverlayRecord>()
  readonly petTypesByIdx = new Map<number, PetTypeRecord>()
  readonly petTypesByName = new Map<string, PetTypeRecord>()
  readonly elemTypes = new Set<string>()
  readonly hitClasses = new Map<string, number>()
  readonly events = new Set<string>()

  constructor(paramsOrSource: D2DataRegistryParams | ArchiveSource | MountedArchives) {
    const params = isRegistryParams(paramsOrSource)
      ? paramsOrSource
      : buildRegistryParamsFromSourceSync(paramsOrSource)

    this.skillsTable = params.skillsTable
    this.skillDescTable = params.skillDescTable
    this.missilesTable = params.missilesTable
    this.statesTable = params.statesTable
    this.itemStatCostTable = params.itemStatCostTable
    this.charStatsTable = params.charStatsTable
    this.monStatsTable = params.monStatsTable
    this.monStats2Table = params.monStats2Table
    this.overlayTable = params.overlayTable
    this.petTypeTable = params.petTypeTable
    this.elemTypesTable = params.elemTypesTable
    this.hitClassTable = params.hitClassTable
    this.eventsTable = params.eventsTable
    this.skillCalcTable = params.skillCalcTable
    this.missCalcTable = params.missCalcTable
    this.animData = params.animData

    this.indexSkillDescs()
    this.indexSkills()
    this.indexMissiles()
    this.indexStates()
    this.indexItemStatCost()
    this.indexCharStats()
    this.indexMonStats()
    this.indexMonStats2()
    this.indexOverlays()
    this.indexPetTypes()
    this.indexElemTypesAndEvents()
  }

  get skills(): DataTable {
    return this.skillsTable
  }
  get skillDesc(): DataTable {
    return this.skillDescTable
  }
  get missiles(): DataTable {
    return this.missilesTable
  }
  get states(): DataTable {
    return this.statesTable
  }
  get itemStatCost(): DataTable {
    return this.itemStatCostTable
  }
  get charStats(): DataTable {
    return this.charStatsTable
  }
  get monStats(): DataTable {
    return this.monStatsTable
  }
  get monStats2(): DataTable {
    return this.monStats2Table
  }
  get overlay(): DataTable {
    return this.overlayTable
  }
  get petType(): DataTable {
    return this.petTypeTable
  }

  private indexSkillDescs(): void {
    for (const row of this.skillDescTable.rows) {
      const key = textCell(row, 'skilldesc').toLowerCase()
      if (key) this.skillDescsByKey.set(key, row)
    }
  }

  private indexSkills(): void {
    for (const row of this.skillsTable.rows) {
      const idStr = row['Id']
      const name = textCell(row, 'skill')
      if (idStr === undefined || name === '') continue
      const id = Number(idStr)
      if (!Number.isFinite(id)) continue

      const record: SkillRecord = {
        id,
        name,
        skill: name,
        charClass: textCell(row, 'charclass').toLowerCase(),
        skillDesc: textCell(row, 'skilldesc'),
        srvStFunc: parseFuncIdCell(row, 'srvstfunc', 0),
        srvDoFunc: parseFuncIdCell(row, 'srvdofunc', 0),
        srvPrgFunc1: parseFuncIdCell(row, 'srvprgfunc1', 0),
        srvPrgFunc2: parseFuncIdCell(row, 'srvprgfunc2', 0),
        srvPrgFunc3: parseFuncIdCell(row, 'srvprgfunc3', 0),
        prgCalc1: textCell(row, 'prgcalc1'),
        prgCalc2: textCell(row, 'prgcalc2'),
        prgCalc3: textCell(row, 'prgcalc3'),
        prgDam: numberCell(row, 'prgdam', 0),
        srvMissile: textCell(row, 'srvmissile'),
        srvMissileA: textCell(row, 'srvmissilea'),
        srvMissileB: textCell(row, 'srvmissileb'),
        srvMissileC: textCell(row, 'srvmissilec'),
        cltStFunc: parseFuncIdCell(row, 'cltstfunc', 0),
        cltDoFunc: parseFuncIdCell(row, 'cltdofunc', 0),
        cltMissile: textCell(row, 'cltmissile'),
        cltMissileA: textCell(row, 'cltmissilea'),
        cltMissileB: textCell(row, 'cltmissileb'),
        cltMissileC: textCell(row, 'cltmissilec'),
        cltMissileD: textCell(row, 'cltmissiled'),
        passive: numberCell(row, 'passive', 0) !== 0,
        passiveState: textCell(row, 'passivestate'),
        passiveStat1: textCell(row, 'passivestat1'),
        passiveCalc1: textCell(row, 'passivecalc1'),
        passiveStat2: textCell(row, 'passivestat2'),
        passiveCalc2: textCell(row, 'passivecalc2'),
        passiveStat3: textCell(row, 'passivestat3'),
        passiveCalc3: textCell(row, 'passivecalc3'),
        passiveStat4: textCell(row, 'passivestat4'),
        passiveCalc4: textCell(row, 'passivecalc4'),
        passiveStat5: textCell(row, 'passivestat5'),
        passiveCalc5: textCell(row, 'passivecalc5'),
        aura: numberCell(row, 'aura', 0) !== 0,
        auraFilter: numberCell(row, 'aurafilter', 0),
        auraState: textCell(row, 'aurastate'),
        auraTgtState: textCell(row, 'auratargetstate') || textCell(row, 'auratgtstate'),
        auraLenCalc: textCell(row, 'auralencalc'),
        auraRangeCalc: textCell(row, 'aurarangecalc'),
        auraStat1: textCell(row, 'aurastat1'),
        auraStatCalc1: textCell(row, 'aurastatcalc1'),
        auraStat2: textCell(row, 'aurastat2'),
        auraStatCalc2: textCell(row, 'aurastatcalc2'),
        auraStat3: textCell(row, 'aurastat3'),
        auraStatCalc3: textCell(row, 'aurastatcalc3'),
        auraStat4: textCell(row, 'aurastat4'),
        auraStatCalc4: textCell(row, 'aurastatcalc4'),
        auraStat5: textCell(row, 'aurastat5'),
        auraStatCalc5: textCell(row, 'aurastatcalc5'),
        auraStat6: textCell(row, 'aurastat6'),
        auraStatCalc6: textCell(row, 'aurastatcalc6'),
        auraEvent1: textCell(row, 'auraevent1'),
        auraEventFunc1: parseFuncIdCell(row, 'auraeventfunc1', 0),
        auraEvent2: textCell(row, 'auraevent2'),
        auraEventFunc2: parseFuncIdCell(row, 'auraeventfunc2', 0),
        auraEvent3: textCell(row, 'auraevent3'),
        auraEventFunc3: parseFuncIdCell(row, 'auraeventfunc3', 0),
        summon: textCell(row, 'summon'),
        petType: textCell(row, 'pettype'),
        petMax: textCell(row, 'petmax'),
        sumMode: textCell(row, 'summode'),
        sumSkill1: textCell(row, 'sumskill1'),
        sumSk1Calc: textCell(row, 'sumsk1calc'),
        sumSkill2: textCell(row, 'sumskill2'),
        sumSk2Calc: textCell(row, 'sumsk2calc'),
        sumSkill3: textCell(row, 'sumskill3'),
        sumSk3Calc: textCell(row, 'sumsk3calc'),
        sumSkill4: textCell(row, 'sumskill4'),
        sumSk4Calc: textCell(row, 'sumsk4calc'),
        sumSkill5: textCell(row, 'sumskill5'),
        sumSk5Calc: textCell(row, 'sumsk5calc'),
        sumUMod: numberCell(row, 'sumumod', 0),
        sumOverlay: textCell(row, 'sumoverlay'),
        anim: textCell(row, 'anim', 'SC'),
        seqTrans: textCell(row, 'seqtrans'),
        monAnim: textCell(row, 'monanim'),
        seqNum: numberCell(row, 'seqnum', 0),
        seqInput: numberCell(row, 'seqinput', 0),
        range: textCell(row, 'range', 'none'),
        selectProc: numberCell(row, 'SelectProc', 0),
        reqLevel: numberCell(row, 'reqlevel', 1),
        reqStr: numberCell(row, 'reqstr', 0),
        reqDex: numberCell(row, 'reqdex', 0),
        reqInt: numberCell(row, 'reqint', 0),
        reqVit: numberCell(row, 'reqvit', 0),
        reqSkill1: textCell(row, 'reqskill1'),
        reqSkill2: textCell(row, 'reqskill2'),
        reqSkill3: textCell(row, 'reqskill3'),
        restrict: numberCell(row, 'restrict', 0),
        state1: textCell(row, 'State1'),
        state2: textCell(row, 'State2'),
        state3: textCell(row, 'State3'),
        delay: textCell(row, 'delay'),
        checkFunc: parseFuncIdCell(row, 'checkfunc', 0),
        nocostinstate: numberCell(row, 'nocostinstate', 0) !== 0,
        decquant: numberCell(row, 'decquant', 0) !== 0,
        manaShift: numberCell(row, 'manashift', 8),
        mana: numberCell(row, 'mana', 0),
        lvlMana: numberCell(row, 'lvlmana', 0),
        minMana: numberCell(row, 'minmana', 0),
        interrupt: numberCell(row, 'interrupt', 0) !== 0,
        inTown: numberCell(row, 'InTown', 0) !== 0,
        periodic: numberCell(row, 'periodic', 0) !== 0,
        perDelay: textCell(row, 'perdelay'),
        finishing: numberCell(row, 'finishing', 0) !== 0,
        progressive: numberCell(row, 'progressive', 0) !== 0,
        calc1: textCell(row, 'calc1'),
        calc2: textCell(row, 'calc2'),
        calc3: textCell(row, 'calc3'),
        calc4: textCell(row, 'calc4'),
        param1: numberCell(row, 'Param1', 0),
        param2: numberCell(row, 'Param2', 0),
        param3: numberCell(row, 'Param3', 0),
        param4: numberCell(row, 'Param4', 0),
        param5: numberCell(row, 'Param5', 0),
        param6: numberCell(row, 'Param6', 0),
        param7: numberCell(row, 'Param7', 0),
        param8: numberCell(row, 'Param8', 0),
        toHit: numberCell(row, 'ToHit', 0),
        toHitLev: numberCell(row, 'LevToHit', 0),
        toHitCalc: textCell(row, 'ToHitCalc'),
        resultFlags: numberCell(row, 'ResultFlags', 0),
        hitFlags: numberCell(row, 'HitFlags', 0),
        hitClass: numberCell(row, 'HitClass', 0),
        kick: numberCell(row, 'Kick', 0) !== 0,
        hitShift: numberCell(row, 'HitShift', 0),
        srcDam: numberCell(row, 'SrcDam', 0),
        minDam: numberCell(row, 'MinDam', 0),
        minLevDam1: numberCell(row, 'MinLevDam1', 0),
        minLevDam2: numberCell(row, 'MinLevDam2', 0),
        minLevDam3: numberCell(row, 'MinLevDam3', 0),
        minLevDam4: numberCell(row, 'MinLevDam4', 0),
        minLevDam5: numberCell(row, 'MinLevDam5', 0),
        maxDam: numberCell(row, 'MaxDam', 0),
        maxLevDam1: numberCell(row, 'MaxLevDam1', 0),
        maxLevDam2: numberCell(row, 'MaxLevDam2', 0),
        maxLevDam3: numberCell(row, 'MaxLevDam3', 0),
        maxLevDam4: numberCell(row, 'MaxLevDam4', 0),
        maxLevDam5: numberCell(row, 'MaxLevDam5', 0),
        dmgSymPerCalc: textCell(row, 'DmgSymPerCalc'),
        eType: textCell(row, 'EType'),
        eMin: numberCell(row, 'EMin', 0),
        eMinLev1: numberCell(row, 'EMinLev1', 0),
        eMinLev2: numberCell(row, 'EMinLev2', 0),
        eMinLev3: numberCell(row, 'EMinLev3', 0),
        eMinLev4: numberCell(row, 'EMinLev4', 0),
        eMinLev5: numberCell(row, 'EMinLev5', 0),
        eMax: numberCell(row, 'EMax', 0),
        eMaxLev1: numberCell(row, 'EMaxLev1', 0),
        eMaxLev2: numberCell(row, 'EMaxLev2', 0),
        eMaxLev3: numberCell(row, 'EMaxLev3', 0),
        eMaxLev4: numberCell(row, 'EMaxLev4', 0),
        eMaxLev5: numberCell(row, 'EMaxLev5', 0),
        eDmgSymPerCalc: textCell(row, 'EDmgSymPerCalc'),
        eLen: numberCell(row, 'ELen', 0),
        eLevLen1: numberCell(row, 'ELevLen1', 0),
        eLevLen2: numberCell(row, 'ELevLen2', 0),
        eLevLen3: numberCell(row, 'ELevLen3', 0),
        eLenSymPerCalc: textCell(row, 'ELenSymPerCalc'),
        aiType: numberCell(row, 'aitype', 0),
        aiBonus: numberCell(row, 'aibonus', 0),
        castOverlay: textCell(row, 'castoverlay'),
        cltOverlayA: textCell(row, 'cltoverlaya'),
        cltOverlayB: textCell(row, 'cltoverlayb'),
        prgOverlay: textCell(row, 'prgoverlay'),
        raw: row,
      }

      this.skillsById.set(id, record)
      this.skillsByName.set(name.toLowerCase(), record)
      if (record.skillDesc) {
        const descLower = record.skillDesc.toLowerCase()
        if (!this.skillsByName.has(descLower)) {
          this.skillsByName.set(descLower, record)
        }
      }
    }
  }

  private indexMissiles(): void {
    for (const row of this.missilesTable.rows) {
      const idStr = row['Id']
      const name = textCell(row, 'Missile')
      if (idStr === undefined || name === '') continue
      const id = Number(idStr)
      if (!Number.isFinite(id)) continue

      const record: MissileRecord = {
        id,
        name,
        pCltDoFunc: parseFuncIdCell(row, 'pCltDoFunc', 0),
        pCltHitFunc: parseFuncIdCell(row, 'pCltHitFunc', 0),
        pSrvDoFunc: parseFuncIdCell(row, 'pSrvDoFunc', 0),
        pSrvHitFunc: parseFuncIdCell(row, 'pSrvHitFunc', 0),
        pSrvDmgFunc: parseFuncIdCell(row, 'pSrvDmgFunc', 0),
        srvCalc1: textCell(row, 'SrvCalc1'),
        param1: numberCell(row, 'Param1', 0),
        param2: numberCell(row, 'Param2', 0),
        param3: numberCell(row, 'Param3', 0),
        param4: numberCell(row, 'Param4', 0),
        param5: numberCell(row, 'Param5', 0),
        cltCalc1: textCell(row, 'CltCalc1'),
        cParam1: numberCell(row, 'CltParam1', 0),
        cParam2: numberCell(row, 'CltParam2', 0),
        cParam3: numberCell(row, 'CltParam3', 0),
        cParam4: numberCell(row, 'CltParam4', 0),
        cParam5: numberCell(row, 'CltParam5', 0),
        sHitCalc1: textCell(row, 'SHitCalc1'),
        sHitPar1: numberCell(row, 'sHitPar1', 0),
        sHitPar2: numberCell(row, 'sHitPar2', 0),
        sHitPar3: numberCell(row, 'sHitPar3', 0),
        cHitCalc1: textCell(row, 'CHitCalc1'),
        cHitPar1: numberCell(row, 'cHitPar1', 0),
        cHitPar2: numberCell(row, 'cHitPar2', 0),
        cHitPar3: numberCell(row, 'cHitPar3', 0),
        dmgCalc1: textCell(row, 'DmgCalc1'),
        dParam1: numberCell(row, 'dParam1', 0),
        dParam2: numberCell(row, 'dParam2', 0),
        vel: numberCell(row, 'Vel', 0),
        maxVel: numberCell(row, 'MaxVel', 0),
        velLev: numberCell(row, 'VelLev', 0),
        accel: numberCell(row, 'Accel', 0),
        range: numberCell(row, 'Range', 0),
        levRange: numberCell(row, 'LevRange', 0),
        light: numberCell(row, 'Light', 0),
        flicker: numberCell(row, 'Flicker', 0),
        red: numberCell(row, 'Red', 255),
        green: numberCell(row, 'Green', 255),
        blue: numberCell(row, 'Blue', 255),
        initSteps: numberCell(row, 'InitSteps', 0),
        activate: numberCell(row, 'Activate', 0),
        loopAnim: numberCell(row, 'LoopAnim', 0),
        celFile: textCell(row, 'CelFile'),
        animRate: numberCell(row, 'animrate', 1024),
        animLen: numberCell(row, 'AnimLen', 8),
        animSpeed: numberCell(row, 'AnimSpeed', 16),
        subLoop: numberCell(row, 'SubLoop', 0) !== 0,
        subStart: numberCell(row, 'SubStart', 0),
        subStop: numberCell(row, 'SubStop', 0),
        collideType: numberCell(row, 'CollideType', 0),
        collideKill: numberCell(row, 'CollideKill', 0) !== 0,
        collideFriend: numberCell(row, 'CollideFriend', 0) !== 0,
        lastCollide: numberCell(row, 'LastCollide', 0) !== 0,
        collision: numberCell(row, 'Collision', 0) !== 0,
        clientCol: numberCell(row, 'ClientCol', 0) !== 0,
        nextHit: numberCell(row, 'NextHit', 0) !== 0,
        nextDelay: numberCell(row, 'NextDelay', 0),
        size: numberCell(row, 'Size', 1),
        returnFire: numberCell(row, 'ReturnFire', 0) !== 0,
        trans: numberCell(row, 'Trans', 0),
        alwaysExplode: numberCell(row, 'AlwaysExplode', 0) !== 0,
        explosion: numberCell(row, 'Explosion', 0) !== 0,
        town: numberCell(row, 'Town', 0) !== 0,
        noUniqueMod: numberCell(row, 'NoUniqueMod', 0) !== 0,
        noMultiShot: numberCell(row, 'NoMultiShot', 0) !== 0,
        holy: numberCell(row, 'Holy', 0),
        canSlow: numberCell(row, 'CanSlow', 0) !== 0,
        canDestroy: numberCell(row, 'CanDestroy', 0) !== 0,
        toHit: numberCell(row, 'ToHit', 0) !== 0,
        pierce: numberCell(row, 'Pierce', 0) !== 0,
        skill: textCell(row, 'Skill'),
        hitShift: numberCell(row, 'HitShift', 0),
        srcDamage: numberCell(row, 'SrcDamage', 0),
        minDamage: numberCell(row, 'MinDamage', 0),
        minLevDam1: numberCell(row, 'MinLevDam1', 0),
        minLevDam2: numberCell(row, 'MinLevDam2', 0),
        minLevDam3: numberCell(row, 'MinLevDam3', 0),
        minLevDam4: numberCell(row, 'MinLevDam4', 0),
        minLevDam5: numberCell(row, 'MinLevDam5', 0),
        maxDamage: numberCell(row, 'MaxDamage', 0),
        maxLevDam1: numberCell(row, 'MaxLevDam1', 0),
        maxLevDam2: numberCell(row, 'MaxLevDam2', 0),
        maxLevDam3: numberCell(row, 'MaxLevDam3', 0),
        maxLevDam4: numberCell(row, 'MaxLevDam4', 0),
        maxLevDam5: numberCell(row, 'MaxLevDam5', 0),
        dmgSymPerCalc: textCell(row, 'DmgSymPerCalc'),
        eType: textCell(row, 'EType'),
        eMin: numberCell(row, 'EMin', 0),
        eMinLev1: numberCell(row, 'MinELev1', 0),
        eMinLev2: numberCell(row, 'MinELev2', 0),
        eMinLev3: numberCell(row, 'MinELev3', 0),
        eMinLev4: numberCell(row, 'MinELev4', 0),
        eMinLev5: numberCell(row, 'MinELev5', 0),
        eMax: numberCell(row, 'Emax', 0),
        eMaxLev1: numberCell(row, 'MaxELev1', 0),
        eMaxLev2: numberCell(row, 'MaxELev2', 0),
        eMaxLev3: numberCell(row, 'MaxELev3', 0),
        eMaxLev4: numberCell(row, 'MaxELev4', 0),
        eMaxLev5: numberCell(row, 'MaxELev5', 0),
        eDmgSymPerCalc: textCell(row, 'EDmgSymPerCalc'),
        eLen: numberCell(row, 'ELen', 0),
        eLevLen1: numberCell(row, 'ELevLen1', 0),
        eLevLen2: numberCell(row, 'ELevLen2', 0),
        eLevLen3: numberCell(row, 'ELevLen3', 0),
        hitClass: numberCell(row, 'HitClass', 0),
        numDirections: numberCell(row, 'NumDirections', 16),
        localBlood: numberCell(row, 'LocalBlood', 0),
        damageRate: numberCell(row, 'DamageRate', 0),
        explosionMissile: textCell(row, 'ExplosionMissile'),
        subMissile1: textCell(row, 'SubMissile1'),
        subMissile2: textCell(row, 'SubMissile2'),
        subMissile3: textCell(row, 'SubMissile3'),
        hitSubMissile1: textCell(row, 'HitSubMissile1'),
        hitSubMissile2: textCell(row, 'HitSubMissile2'),
        hitSubMissile3: textCell(row, 'HitSubMissile3'),
        hitSubMissile4: textCell(row, 'HitSubMissile4'),
        cltSubMissile1: textCell(row, 'CltSubMissile1'),
        cltSubMissile2: textCell(row, 'CltSubMissile2'),
        cltSubMissile3: textCell(row, 'CltSubMissile3'),
        cltHitSubMissile1: textCell(row, 'CltHitSubMissile1'),
        cltHitSubMissile2: textCell(row, 'CltHitSubMissile2'),
        cltHitSubMissile3: textCell(row, 'CltHitSubMissile3'),
        cltHitSubMissile4: textCell(row, 'CltHitSubMissile4'),
        raw: row,
      }

      this.missilesById.set(id, record)
      this.missilesByName.set(name.toLowerCase(), record)
    }
  }

  private indexStates(): void {
    for (const row of this.statesTable.rows) {
      const idStr = row['id']
      const state = textCell(row, 'state')
      if (idStr === undefined || state === '') continue
      const id = Number(idStr)
      if (!Number.isFinite(id)) continue

      const record: StateRecord = {
        id,
        state,
        group: numberCell(row, 'group', 0),
        remhit: numberCell(row, 'remhit', 0) !== 0,
        nosend: numberCell(row, 'nosend', 0) !== 0,
        transform: numberCell(row, 'transform', 0) !== 0,
        aura: numberCell(row, 'aura', 0) !== 0,
        curse: numberCell(row, 'curse', 0) !== 0,
        curable: numberCell(row, 'curable', 0) !== 0,
        active: numberCell(row, 'active', 0) !== 0,
        restrict: numberCell(row, 'restrict', 0) !== 0,
        disguise: numberCell(row, 'disguise', 0) !== 0,
        blue: numberCell(row, 'blue', 0) !== 0,
        attblue: numberCell(row, 'attblue', 0) !== 0,
        dmgblue: numberCell(row, 'damblue', 0) !== 0,
        armblue: numberCell(row, 'armblue', 0) !== 0,
        rfblue: numberCell(row, 'rfblue', 0) !== 0,
        rlblue: numberCell(row, 'rlblue', 0) !== 0,
        rcblue: numberCell(row, 'rcblue', 0) !== 0,
        stambarblue: numberCell(row, 'stambarblue', 0) !== 0,
        rpblue: numberCell(row, 'rpblue', 0) !== 0,
        attred: numberCell(row, 'attred', 0) !== 0,
        dmgred: numberCell(row, 'damred', 0) !== 0,
        armred: numberCell(row, 'armred', 0) !== 0,
        rfred: numberCell(row, 'rfred', 0) !== 0,
        rlred: numberCell(row, 'rlred', 0) !== 0,
        rcred: numberCell(row, 'rcred', 0) !== 0,
        rpred: numberCell(row, 'rpred', 0) !== 0,
        exp: numberCell(row, 'exp', 0) !== 0,
        plrstaydeath: numberCell(row, 'plrstaydeath', 0) !== 0,
        monstaydeath: numberCell(row, 'monstaydeath', 0) !== 0,
        bossstaydeath: numberCell(row, 'bossstaydeath', 0) !== 0,
        hide: numberCell(row, 'hide', 0) !== 0,
        shatter: numberCell(row, 'shatter', 0) !== 0,
        udead: numberCell(row, 'udead', 0) !== 0,
        life: numberCell(row, 'life', 0) !== 0,
        green: numberCell(row, 'green', 0) !== 0,
        pgsv: numberCell(row, 'pgsv', 0) !== 0,
        nooverlays: numberCell(row, 'nooverlays', 0) !== 0,
        noclear: numberCell(row, 'noclear', 0) !== 0,
        bossinv: numberCell(row, 'bossinv', 0) !== 0,
        meleeonly: numberCell(row, 'meleeonly', 0) !== 0,
        notondead: numberCell(row, 'notondead', 0) !== 0,
        overlay1: textCell(row, 'overlay1'),
        overlay2: textCell(row, 'overlay2'),
        overlay3: textCell(row, 'overlay3'),
        overlay4: textCell(row, 'overlay4'),
        pgsvoverlay: textCell(row, 'pgsvoverlay'),
        castoverlay: textCell(row, 'castoverlay'),
        removerlay: textCell(row, 'removerlay'),
        stat: textCell(row, 'stat'),
        setfunc: parseFuncIdCell(row, 'setfunc', 0),
        remfunc: parseFuncIdCell(row, 'remfunc', 0),
        missile: textCell(row, 'missile'),
        skill: textCell(row, 'skill'),
        itemtrans: textCell(row, 'itemtrans'),
        colorpri: numberCell(row, 'colorpri', 0),
        colorshift: numberCell(row, 'colorshift', 0),
        lightR: numberCell(row, 'light-r', 0),
        lightG: numberCell(row, 'light-g', 0),
        lightB: numberCell(row, 'light-b', 0),
        onsound: textCell(row, 'onsound'),
        offsound: textCell(row, 'offsound'),
        raw: row,
      }

      this.statesById.set(id, record)
      this.statesByName.set(state.toLowerCase(), record)
    }
  }

  private indexItemStatCost(): void {
    for (const row of this.itemStatCostTable.rows) {
      const idStr = row['ID']
      const stat = textCell(row, 'Stat')
      if (idStr === undefined || stat === '') continue
      const id = Number(idStr)
      if (!Number.isFinite(id)) continue

      const record: ItemStatCostRecord = {
        id,
        stat,
        sendBits: numberCell(row, 'Send Bits', 0),
        signed: numberCell(row, 'Signed', 0) !== 0,
        valShift: numberCell(row, 'ValShift', 0),
        damageRelated: numberCell(row, 'damagerelated', 0) !== 0,
        op: numberCell(row, 'op', 0),
        opParam: numberCell(row, 'op param', 0),
        opBase: textCell(row, 'op base'),
        opStat1: textCell(row, 'op stat1'),
        opStat2: textCell(row, 'op stat2'),
        opStat3: textCell(row, 'op stat3'),
        direct: numberCell(row, 'direct', 0) !== 0,
        maxStat: textCell(row, 'maxstat'),
        raw: row,
      }

      this.statsById.set(id, record)
      this.statsByName.set(stat.toLowerCase(), record)
    }
  }

  private indexCharStats(): void {
    for (const row of this.charStatsTable.rows) {
      const className = textCell(row, 'class')
      const mapping = CLASS_NAME_TO_CODE[className.toLowerCase()]
      if (!mapping) continue

      const skills: string[] = []
      for (let i = 1; i <= 10; i += 1) {
        const sk = textCell(row, `Skill ${String(i)}`)
        if (sk) skills.push(sk)
      }

      const record: CharStatsRecord = {
        className,
        classCode: mapping.code,
        token: mapping.token,
        str: numberCell(row, 'str', 15),
        dex: numberCell(row, 'dex', 15),
        int: numberCell(row, 'int', 15),
        vit: numberCell(row, 'vit', 15),
        stamina: numberCell(row, 'stamina', 80),
        hpadd: numberCell(row, 'hpadd', 20),
        percentStr: numberCell(row, 'PercentStr', 25),
        percentDex: numberCell(row, 'PercentDex', 25),
        percentInt: numberCell(row, 'PercentInt', 25),
        percentVit: numberCell(row, 'PercentVit', 25),
        manaRegen: numberCell(row, 'ManaRegen', 120),
        toHitFactor: numberCell(row, 'ToHitFactor', 0),
        walkVelocity: numberCell(row, 'WalkVelocity', 6),
        runVelocity: numberCell(row, 'RunVelocity', 9),
        runDrain: numberCell(row, 'RunDrain', 20),
        lifePerLevel: numberCell(row, 'LifePerLevel', 8),
        staminaPerLevel: numberCell(row, 'StaminaPerLevel', 4),
        manaPerLevel: numberCell(row, 'ManaPerLevel', 8),
        lifePerVitality: numberCell(row, 'LifePerVitality', 8),
        staminaPerVitality: numberCell(row, 'StaminaPerVitality', 4),
        manaPerMagic: numberCell(row, 'ManaPerMagic', 8),
        blockFactor: numberCell(row, 'BlockFactor', 20),
        startSkill: textCell(row, 'StartSkill'),
        baseWClass: textCell(row, 'baseWClass', 'hth'),
        skills,
        raw: row,
      }

      this.charStatsByCode.set(mapping.code, record)
      this.charStatsByCode.set(mapping.token, record)
      this.charStatsByCode.set(className.toLowerCase(), record)
    }
  }

  private indexMonStats(): void {
    for (const row of this.monStatsTable.rows) {
      const hcIdxStr = row['hcIdx']
      const id = textCell(row, 'Id')
      if (hcIdxStr === undefined || id === '') continue
      const hcIdx = Number(hcIdxStr)
      if (!Number.isFinite(hcIdx)) continue

      const record: MonStatsRecord = {
        hcIdx,
        id,
        baseId: textCell(row, 'BaseId'),
        nextInClass: textCell(row, 'NextInClass'),
        translvl: numberCell(row, 'TransLvl', 0),
        nameStr: textCell(row, 'NameStr'),
        monStatsEx: textCell(row, 'MonStatsEx'),
        code: textCell(row, 'Code'),
        enabled: numberCell(row, 'enabled', 0) !== 0,
        rangedtype: numberCell(row, 'rangedtype', 0) !== 0,
        align: numberCell(row, 'Align', 0),
        isSpawn: numberCell(row, 'isSpawn', 0) !== 0,
        isMelee: numberCell(row, 'isMelee', 0) !== 0,
        lUndead: numberCell(row, 'lUndead', 0) !== 0,
        hUndead: numberCell(row, 'hUndead', 0) !== 0,
        demon: numberCell(row, 'demon', 0) !== 0,
        flying: numberCell(row, 'flying', 0) !== 0,
        opendoors: numberCell(row, 'opendoors', 0) !== 0,
        boss: numberCell(row, 'boss', 0) !== 0,
        primeevil: numberCell(row, 'primeevil', 0) !== 0,
        killable: numberCell(row, 'killable', 0) !== 0,
        switchai: numberCell(row, 'switchai', 0) !== 0,
        noAura: numberCell(row, 'noAura', 0) !== 0,
        neverCount: numberCell(row, 'neverCount', 0) !== 0,
        petIgnore: numberCell(row, 'petIgnore', 0) !== 0,
        deathDmg: numberCell(row, 'deathDmg', 0) !== 0,
        genericSpawn: numberCell(row, 'genericSpawn', 0) !== 0,
        zoo: numberCell(row, 'zoo', 0) !== 0,
        velocity: numberCell(row, 'Velocity', 6),
        run: numberCell(row, 'Run', 9),
        minHP: numberCell(row, 'minHP', 100),
        maxHP: numberCell(row, 'maxHP', 150),
        ac: numberCell(row, 'AC', 20),
        exp: numberCell(row, 'Exp', 50),
        a1MinD: numberCell(row, 'A1MinD', 5),
        a1MaxD: numberCell(row, 'A1MaxD', 10),
        a1TH: numberCell(row, 'A1TH', 50),
        a2MinD: numberCell(row, 'A2MinD', 5),
        a2MaxD: numberCell(row, 'A2MaxD', 10),
        a2TH: numberCell(row, 'A2TH', 50),
        s1MinD: numberCell(row, 'S1MinD', 5),
        s1MaxD: numberCell(row, 'S1MaxD', 10),
        s1TH: numberCell(row, 'S1TH', 50),
        resDm: numberCell(row, 'ResDm', 0),
        resMa: numberCell(row, 'ResMa', 0),
        resFi: numberCell(row, 'ResFi', 0),
        resLi: numberCell(row, 'ResLi', 0),
        resCo: numberCell(row, 'ResCo', 0),
        resPo: numberCell(row, 'ResPo', 0),
        skill1: textCell(row, 'Skill1'),
        sk1mode: textCell(row, 'Sk1mode'),
        sk1lvl: numberCell(row, 'Sk1lvl', 1),
        skill2: textCell(row, 'Skill2'),
        sk2mode: textCell(row, 'Sk2mode'),
        sk2lvl: numberCell(row, 'Sk2lvl', 1),
        skill3: textCell(row, 'Skill3'),
        sk3mode: textCell(row, 'Sk3mode'),
        sk3lvl: numberCell(row, 'Sk3lvl', 1),
        raw: row,
      }

      this.monStatsByHcIdx.set(hcIdx, record)
      this.monStatsById.set(id.toLowerCase(), record)
    }
  }

  private indexMonStats2(): void {
    for (const row of this.monStats2Table.rows) {
      const id = textCell(row, 'Id')
      if (!id || id === 'expansion') continue
      const record: MonStats2LightingRecord = {
        id: id.toLowerCase(),
        light: numberCell(row, 'Light', 0),
        lightR: numberCell(row, 'light-r', 255),
        lightG: numberCell(row, 'light-g', 255),
        lightB: numberCell(row, 'light-b', 255),
        shadow: numberCell(row, 'Shadow', 0) !== 0,
        raw: row,
      }
      this.monStats2ById.set(id.toLowerCase(), record)
    }
  }

  private indexOverlays(): void {
    let idx = 0
    for (const row of this.overlayTable.rows) {
      const overlay = textCell(row, 'overlay')
      if (!overlay) continue
      const record: OverlayRecord = {
        id: idx++,
        overlay,
        filename: textCell(row, 'Filename'),
        frames: numberCell(row, 'Frames', 1),
        animRate: numberCell(row, 'AnimRate', 2),
        initRadius: numberCell(row, 'InitRadius', 0),
        radius: numberCell(row, 'Radius', 0),
        loopWaitTime: numberCell(row, 'LoopWaitTime', 0),
        trans: numberCell(row, 'Trans', 0),
        xOffset: numberCell(row, 'Xoffset', 0),
        yOffset: numberCell(row, 'Yoffset', 0),
        height1: numberCell(row, 'Height1', 0),
        height2: numberCell(row, 'Height2', 0),
        height3: numberCell(row, 'Height3', 0),
        height4: numberCell(row, 'Height4', 0),
        preDraw: numberCell(row, 'PreDraw', 0) !== 0,
        red: numberCell(row, 'Red', 255),
        green: numberCell(row, 'Green', 255),
        blue: numberCell(row, 'Blue', 255),
        raw: row,
      }
      this.overlaysByName.set(overlay.toLowerCase(), record)
    }
  }

  private indexPetTypes(): void {
    for (const row of this.petTypeTable.rows) {
      const petType = textCell(row, 'pet type')
      if (!petType) continue
      const idx = numberCell(row, 'idx', 0)
      const record: PetTypeRecord = {
        idx,
        petType,
        group: numberCell(row, 'group', 0),
        baseMax: numberCell(row, 'basemax', 0),
        warp: numberCell(row, 'warp', 0) !== 0,
        range: numberCell(row, 'range', 0) !== 0,
        partysend: numberCell(row, 'partysend', 0) !== 0,
        unsummon: numberCell(row, 'unsummon', 0) !== 0,
        automap: numberCell(row, 'automap', 0) !== 0,
        name: textCell(row, 'name'),
        drawhp: numberCell(row, 'drawhp', 0) !== 0,
        icontype: numberCell(row, 'icontype', 0),
        baseicon: textCell(row, 'baseicon'),
        mclass1: numberCell(row, 'mclass1', 0),
        micon1: textCell(row, 'micon1'),
        mclass2: numberCell(row, 'mclass2', 0),
        micon2: textCell(row, 'micon2'),
        mclass3: numberCell(row, 'mclass3', 0),
        micon3: textCell(row, 'micon3'),
        raw: row,
      }
      this.petTypesByIdx.set(idx, record)
      this.petTypesByName.set(petType.toLowerCase(), record)
    }
  }

  private indexElemTypesAndEvents(): void {
    for (const row of this.elemTypesTable.rows) {
      const code = textCell(row, 'Code')
      if (code) this.elemTypes.add(code.toLowerCase())
    }
    for (const row of this.hitClassTable.rows) {
      const code = textCell(row, 'Code')
      const num = numberCell(row, 'Hit Class', 0)
      if (code) this.hitClasses.set(code.toLowerCase(), num)
    }
    for (const row of this.eventsTable.rows) {
      const evt = textCell(row, 'event')
      if (evt) this.events.add(evt.toLowerCase())
    }
  }

  getSkill(idOrName: number | string): SkillRecord | undefined {
    if (typeof idOrName === 'number') return this.getSkillById(idOrName)
    return this.getSkillByName(idOrName)
  }

  getSkillById(id: number): SkillRecord | undefined {
    return this.skillsById.get(id)
  }

  getSkillByName(name: string): SkillRecord | undefined {
    return this.skillsByName.get(name.trim().toLowerCase())
  }

  getSkillDesc(key: string): Readonly<Record<string, string>> | undefined {
    return this.skillDescsByKey.get(key.trim().toLowerCase())
  }

  getMissileById(id: number): MissileRecord | undefined {
    return this.missilesById.get(id)
  }

  getMissileByName(name: string): MissileRecord | undefined {
    return this.missilesByName.get(name.trim().toLowerCase())
  }

  getStateById(id: number): StateRecord | undefined {
    return this.statesById.get(id)
  }

  getStateByName(name: string): StateRecord | undefined {
    return this.statesByName.get(name.trim().toLowerCase())
  }

  getStatById(id: number): ItemStatCostRecord | undefined {
    return this.statsById.get(id)
  }

  getStatByName(name: string): ItemStatCostRecord | undefined {
    return this.statsByName.get(name.trim().toLowerCase())
  }

  getCharStats(codeOrName: string): CharStatsRecord | undefined {
    return this.charStatsByCode.get(codeOrName.trim().toLowerCase())
  }

  getMonStats(idOrHcIdx: string | number): MonStatsRecord | undefined {
    if (typeof idOrHcIdx === 'number') return this.monStatsByHcIdx.get(idOrHcIdx)
    return this.monStatsById.get(idOrHcIdx.trim().toLowerCase())
  }

  getMonStats2Lighting(id: string): MonStats2LightingRecord | undefined {
    return this.monStats2ById.get(id.trim().toLowerCase())
  }

  getLevelLighting(levelId: number): LevelLightingDef | undefined {
    return getLevelLighting(levelId)
  }

  getOverlay(name: string): OverlayRecord | undefined {
    return this.overlaysByName.get(name.trim().toLowerCase())
  }

  getPetType(nameOrIdx: string | number): PetTypeRecord | undefined {
    if (typeof nameOrIdx === 'number') return this.petTypesByIdx.get(nameOrIdx)
    return this.petTypesByName.get(nameOrIdx.trim().toLowerCase())
  }

  getAnimDataRecord(cofName: string): AnimDataRecord | undefined {
    return this.animData.records.get(cofName.trim().toUpperCase())
  }

  /**
   * Returns all 221 player skills (210 class skills across 7 classes + 11 universal player skills).
   */
  getAllPlayerSkills(): SkillRecord[] {
    const universalSet = new Set<number>(UNIVERSAL_PLAYER_SKILL_IDS)
    const result: SkillRecord[] = []
    for (const rec of this.skillsById.values()) {
      if (rec.charClass !== '' || universalSet.has(rec.id)) {
        result.push(rec)
      }
    }
    return result.sort((a, b) => a.id - b.id)
  }

  /**
   * Returns all 17 summoned pet and trap AI sub-skills (IDs 281..338).
   */
  getPetSubSkills(): SkillRecord[] {
    const result: SkillRecord[] = []
    for (const id of PET_SUB_SKILL_IDS) {
      const rec = this.skillsById.get(id)
      if (rec) result.push(rec)
    }
    return result
  }

  static fromArchiveSourceSync(source: ArchiveSource | MountedArchives): D2DataRegistry {
    return new D2DataRegistry(buildRegistryParamsFromSourceSync(source))
  }

  static async fromArchiveSource(source: ArchiveSource | MountedArchives): Promise<D2DataRegistry> {
    return D2DataRegistry.fromMountedArchives(source)
  }

  /**
   * Load the complete 1.13c D2DataRegistry from a MountedArchives or ArchiveSource.
   */
  static async fromMountedArchives(mounted: MountedArchives | ArchiveSource): Promise<D2DataRegistry> {
    if (!mounted || typeof mounted !== 'object') {
      throw new Error('Missing required ArchiveSource or MountedArchives in D2DataRegistry.fromMountedArchives')
    }
    const decoder = new TextDecoder('latin1')
    const readBytesAsync = async (path: string): Promise<Uint8Array> => {
      if ('read' in mounted && typeof mounted.read === 'function') {
        const res = await mounted.read(path)
        if (res !== null && res !== undefined) return res
      }
      return readBytesFromSourceSync(mounted, path)
    }
    const readTxt = async (path: string): Promise<DataTable> => {
      if ('readText' in mounted && typeof mounted.readText === 'function') {
        const txt = mounted.readText(path)
        if (txt !== null && txt !== undefined) return parseTable(txt)
      }
      const bytes = await readBytesAsync(path)
      return parseTable(decoder.decode(bytes))
    }

    const [
      skillsTable,
      skillDescTable,
      missilesTable,
      statesTable,
      itemStatCostTable,
      charStatsTable,
      monStatsTable,
      monStats2Table,
      overlayTable,
      petTypeTable,
      elemTypesTable,
      hitClassTable,
      eventsTable,
      skillCalcTable,
      missCalcTable,
      animDataBytes,
    ] = await Promise.all([
      readTxt('data\\global\\excel\\Skills.txt'),
      readTxt('data\\global\\excel\\SkillDesc.txt'),
      readTxt('data\\global\\excel\\Missiles.txt'),
      readTxt('data\\global\\excel\\States.txt'),
      readTxt('data\\global\\excel\\ItemStatCost.txt'),
      readTxt('data\\global\\excel\\CharStats.txt'),
      readTxt('data\\global\\excel\\MonStats.txt'),
      readTxt('data\\global\\excel\\MonStats2.txt'),
      readTxt('data\\global\\excel\\Overlay.txt'),
      readTxt('data\\global\\excel\\PetType.txt'),
      readTxt('data\\global\\excel\\ElemTypes.txt'),
      readTxt('data\\global\\excel\\HitClass.txt'),
      readTxt('data\\global\\excel\\Events.txt'),
      readTxt('data\\global\\excel\\SkillCalc.txt'),
      readTxt('data\\global\\excel\\MissCalc.txt'),
      readBytesAsync('data\\global\\AnimData.d2'),
    ])

    const animData = decodeAnimDataFile(animDataBytes)

    return new D2DataRegistry({
      skillsTable,
      skillDescTable,
      missilesTable,
      statesTable,
      itemStatCostTable,
      charStatsTable,
      monStatsTable,
      monStats2Table,
      overlayTable,
      petTypeTable,
      elemTypesTable,
      hitClassTable,
      eventsTable,
      skillCalcTable,
      missCalcTable,
      animData,
    })
  }
}

function isRegistryParams(arg: D2DataRegistryParams | ArchiveSource | MountedArchives): arg is D2DataRegistryParams {
  return typeof arg === 'object' && arg !== null && 'skillsTable' in arg && 'missilesTable' in arg
}

function readBytesFromSourceSync(source: ArchiveSource | MountedArchives, path: string): Uint8Array {
  if ('readBytes' in source && typeof source.readBytes === 'function') {
    const res = source.readBytes(path)
    if (res !== null && res !== undefined) return res
  }
  if ('readFile' in source && typeof source.readFile === 'function') {
    const res = source.readFile(path)
    if (res !== null && res !== undefined) return res
  }
  if ('readSync' in source && typeof source.readSync === 'function') {
    const res = source.readSync(path)
    if (res !== null && res !== undefined) return res
  }
  if ('readText' in source && typeof source.readText === 'function') {
    const txt = source.readText(path)
    if (txt !== null && txt !== undefined) return new TextEncoder().encode(txt)
  }
  throw new Error(`ArchiveSource does not support synchronous reading for '${path}'`)
}

function readTxtFromSourceSync(source: ArchiveSource | MountedArchives, decoder: TextDecoder, path: string): DataTable {
  if ('readText' in source && typeof source.readText === 'function') {
    const txt = source.readText(path)
    if (txt !== null && txt !== undefined) return parseTable(txt)
  }
  const bytes = readBytesFromSourceSync(source, path)
  return parseTable(decoder.decode(bytes))
}

function buildRegistryParamsFromSourceSync(source: ArchiveSource | MountedArchives): D2DataRegistryParams {
  if (!source || typeof source !== 'object') {
    throw new Error('Missing required ArchiveSource for D2DataRegistry')
  }
  const decoder = new TextDecoder('latin1')
  const readTxt = (p: string) => readTxtFromSourceSync(source, decoder, p)
  const animDataBytes = readBytesFromSourceSync(source, 'data\\global\\AnimData.d2')
  return {
    skillsTable: readTxt('data\\global\\excel\\Skills.txt'),
    skillDescTable: readTxt('data\\global\\excel\\SkillDesc.txt'),
    missilesTable: readTxt('data\\global\\excel\\Missiles.txt'),
    statesTable: readTxt('data\\global\\excel\\States.txt'),
    itemStatCostTable: readTxt('data\\global\\excel\\ItemStatCost.txt'),
    charStatsTable: readTxt('data\\global\\excel\\CharStats.txt'),
    monStatsTable: readTxt('data\\global\\excel\\MonStats.txt'),
    monStats2Table: readTxt('data\\global\\excel\\MonStats2.txt'),
    overlayTable: readTxt('data\\global\\excel\\Overlay.txt'),
    petTypeTable: readTxt('data\\global\\excel\\PetType.txt'),
    elemTypesTable: readTxt('data\\global\\excel\\ElemTypes.txt'),
    hitClassTable: readTxt('data\\global\\excel\\HitClass.txt'),
    eventsTable: readTxt('data\\global\\excel\\Events.txt'),
    skillCalcTable: readTxt('data\\global\\excel\\SkillCalc.txt'),
    missCalcTable: readTxt('data\\global\\excel\\MissCalc.txt'),
    animData: decodeAnimDataFile(animDataBytes),
  }
}

let cachedMountedSource: MountedArchives | ArchiveSource | null = null
let cachedRegistryInstance: D2DataRegistry | null = null

export function resetSharedDataRegistryCache(): void {
  cachedMountedSource = null
  cachedRegistryInstance = null
}

/**
 * Returns the cached `D2DataRegistry` instance if an archive source has already been mounted,
 * or `undefined` if no archive source has been initialized yet.
 */
export function tryGetSharedDataRegistry(): D2DataRegistry | undefined {
  if (cachedRegistryInstance !== null) {
    return cachedRegistryInstance
  }
  if (cachedMountedSource !== null) {
    try {
      cachedRegistryInstance = D2DataRegistry.fromArchiveSourceSync(cachedMountedSource)
      return cachedRegistryInstance
    } catch {
      return undefined
    }
  }
  return undefined
}

/**
 * Returns or caches an injected `MountedArchives` / `ArchiveSource`.
 * Fails fast with an Error when called without an explicit `ArchiveSource` when uncached.
 */
export function getSharedMountedArchives(source?: ArchiveSource | MountedArchives): MountedArchives {
  if (source !== undefined) {
    if (typeof source !== 'object' || source === null) {
      throw new Error('Invalid ArchiveSource: expected an ArchiveSource or MountedArchives instance')
    }
    cachedMountedSource = source
    return source as MountedArchives
  }
  if (cachedMountedSource !== null) {
    return cachedMountedSource as MountedArchives
  }
  throw new Error(
    'Missing required ArchiveSource: pass an ArchiveSource or MountedArchives instance to getSharedMountedArchives(source)',
  )
}

/**
 * Returns the singleton cached `D2DataRegistry` built from an explicit `ArchiveSource` / `MountedArchives`.
 * Fails fast with an Error when called without an `ArchiveSource` when uncached.
 */
export function getSharedDataRegistry(source?: ArchiveSource | MountedArchives): D2DataRegistry {
  if (source !== undefined) {
    if (typeof source !== 'object' || source === null) {
      throw new Error('Invalid ArchiveSource: expected an ArchiveSource or MountedArchives instance')
    }
    try {
      cachedRegistryInstance = D2DataRegistry.fromArchiveSourceSync(source)
      cachedMountedSource = source
      return cachedRegistryInstance
    } catch (err) {
      cachedRegistryInstance = null
      throw err
    }
  }
  if (cachedRegistryInstance !== null) {
    return cachedRegistryInstance
  }
  if (cachedMountedSource !== null) {
    try {
      cachedRegistryInstance = D2DataRegistry.fromArchiveSourceSync(cachedMountedSource)
      return cachedRegistryInstance
    } catch (err) {
      cachedRegistryInstance = null
      throw err
    }
  }
  throw new Error(
    'Missing required ArchiveSource: pass an ArchiveSource or MountedArchives instance to getSharedDataRegistry(source)',
  )
}

