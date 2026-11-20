/**
 * 1.13c `NecroPet` monster AI (`MonAI.txt` row 67, `gpMonsterAiFunctionTable` `0x6FD2E788` entry
 * `{0, 0, 0x6FC3E900, 0}`) for player summons that live in the {@link SummonManager} model
 * (Clay/Blood/Iron/Fire Golem, Valkyrie, Necromancer skeletons, revives) on the DRLG oracle path.
 *
 * Pseudocode, RNG consumption, fields read and open items: `kb/monsters/d2game-necropet-ai-113c.md`.
 * Spawn side (`D2GAME_SummonPet` `0x6FCC3610`): `kb/monsters/d2game-summon-pet-spawn-113c.md`.
 *
 * The pet's dynamic path is a monster entry in {@link AreaPathWorld113c} keyed by its unit id, so every
 * move goes through the same `AI_ApproachTarget` / `MONSTER_StartMode` port as DRLG monsters
 * (`startMonsterMoveToPos113c` / `stepMonsterMove113c`).
 */

import { PATH_ComputeDirection as pathComputeDirection } from '../../../common/path/index.ts'
import { SEED_RollRandomNumber, type D2SeedStrc } from '../../../common/rng/d2-rng.ts'
import { MONSTATS_113C_ROWS } from '../../../common/units/monstats-113c-data.ts'
import type { SummonedPetUnit } from '../../ai/summon-manager.ts'
import { getMonEquipRows113c } from '../../../common/data/mon-equip-113c.ts'
import { getMonsterKindByHcIdx } from '../../../common/units/monsters-data.ts'
import { TOWN_AREAS, UNIT_TYPE_113C, areaToAct, unitsDistanceToCoordinates113c } from './constants-and-helpers.ts'
import type { GameInstanceHost } from './host.ts'
import type { InternalMonsterRecord, InternalPlayerRecord } from './types.ts'
import {
  allocItemSeeds113c,
  rollLimitedSeed113c,
  rollMonsterInitStats113c,
  rollMonsterOutfit113c,
} from './unit-seeds-113c.ts'
import {
  createMonsterItem113c,
  ITEM_VERSION_EXPANSION_113C,
  type CreatedMonsterItem113c,
} from '../../items/monster-item-create-113c.ts'
import { evaluateCalc } from '../../../common/data/calc-ast.ts'
import { mulDiv113c } from '../../../common/data/mul-div-113c.ts'
import type { WeaponBase } from '../../../common/items/weapons.ts'
import {
  computeRawDiminishingRate113c,
  playerAnimStartFrame113c,
  resolveWeaponBase113c,
} from '../../../common/units/char-anim-speed.ts'
import { capTargetSlowPct113c, computeToHitChance, emitSUnitDmgTraceEvent113c } from '../combat-pipeline.ts'
import { armMonsterEvent3AfterDamage113c } from './monster-damage.ts'
import { FIXED_ONE } from '../stat-list.ts'

/**
 * A NecroPet branch that has no 1:1 port yet (kb/monsters/d2game-necropet-ai-113c.md §6). The caller
 * (`stepSummonedPets`) reports it and hands the pet back to the generic `tickPets` AI, so the parity
 * run is not aborted; every frame after such a hand-off is outside the 1:1 model.
 */
export class NecroPetNotPortedError113c extends Error {
  constructor(branch: string) {
    super(`NecroPet branch not ported: ${branch}`)
    this.name = 'NecroPetNotPortedError113c'
  }
}

/** Monster modes used here (`MonMode.txt`). */
const MODE_NU = 1
const MODE_WL = 2
const MODE_A1 = 4
const MODE_RN = 15

/** `PlrType.txt` tokens by player class (`0x6FDA01E0` transform class -> COF token). */
const PLAYER_TOKEN_BY_CLASS_113C: readonly string[] = ['AM', 'SO', 'NE', 'PA', 'BA', 'DZ', 'AI']

/** `0x6FC94F90`: `bMoving == 101` maps to `PATHTYPE_TOWARD_FINISH` unless `pAiControl+0x18` overrides it. */
const PATHTYPE_TOWARD_FINISH = 13
/** `0x6FC94FDA`: default `PATH_SetNewDistance` when `pAiControl+0x20` is 0. */
const DEFAULT_NEW_DIST = 5

/**
 * Per-pet AI state: the next type-2 (AI) event frame (`EVENT_SetEvent(pGame, pPet, 2, frame, 0, 0, 0)`
 * `0x6FCAEA80`) and the `D2AiControlStrc` move overrides consumed (and cleared) by every
 * `MONSTER_StartMode` (`0x6FC94F90` reads `+0x18` path type, `+0x1C` velocity, `+0x20` new distance).
 */
export interface NecroPetAiState113c {
  nextAiFrame: number
  ovPathType: number
  ovVelocity: number
  ovNewDist: number
  /** Pending `MONMODE_ATTACK1` swing started by `0x6FD12220` (no AI event while the mode runs). */
  swing?: NecroPetSwing113c | undefined
}

/** One `A1` swing: the AnimData event frame fires the hit, the one-shot end returns the pet to `NU`. */
export interface NecroPetSwing113c {
  readonly targetUnitId: number
  readonly actionFrame: number
  readonly endFrame: number
  resolved: boolean
}

export function createNecroPetAiState113c(firstThinkFrame: number): NecroPetAiState113c {
  return { nextAiFrame: firstThinkFrame, ovPathType: 0, ovVelocity: 0, ovNewDist: 0 }
}

/** `MonMode.txt` codes (`Skills.txt` `summode`). */
const MONMODE_BY_CODE_113C: Readonly<Record<string, number>> = {
  DT: 0, NU: 1, WL: 2, GH: 3, A1: 4, A2: 5, BL: 6, SC: 7,
  S1: 8, S2: 9, S3: 10, S4: 11, DD: 12, KB: 13, SQ: 14, RN: 15,
}

/** Summons whose `MonStats.txt` `AI` is `NecroPet` and that run the 1:1 port (golems, Valkyrie). */
const NECROPET_PORTED_HCIDX_113C: ReadonlySet<number> = new Set([289, 290, 291, 292, 357])

/**
 * First AI event after the summon: `D2GAME_SummonPet` schedules `frame + 25` (`0x6FCC37B5`);
 * `SKILLS_SrvDo016_Valkyrie` re-schedules it to `frame + 20` (`0x6FC6D877`).
 */
function firstThinkDelay113c(skillId: number): number {
  return skillId === 32 ? 20 : 25
}

/**
 * `D2GAME_CreateMonsterEquipment` `0x6FCB2ED0` (nLevel = slvl, called from `0x6FC6F970` at `0x6FC7005A`
 * for the Valkyrie): skip the monster's `MonEquip.txt` rows with `level > nLevel`
 * (`0x6FCB2F28..0x6FCB2F41`), then for that row and every following row of the monster count the leading
 * candidates with `loc` in `1..10` (`0x6FCB2F50..0x6FCB2F62`), pick one with `rollLimited(count)` on
 * `pPet->pSeed` (inline, `0x6FCB2F6C..0x6FCB2FA3`; a draw even for count 1) and, when that body location
 * is still empty (`#11139`), create and equip the item (`D2GAME_EquipMonsterItem` `0x6FCCFCE0`): the
 * item unit allocation takes 2 game-seed draws (unit seed + item-data seed) and the item contents are the
 * 1:1 `createMonsterItem113c` port (kb/items/d2game-monster-item-create-113c.md).
 */
function createMonsterEquipmentUnits113c(
  host: GameInstanceHost,
  pet: SummonedPetUnit,
  seed: D2SeedStrc,
  ilvl: number,
): CreatedMonsterItem113c[] {
  const rows = getMonEquipRows113c(pet.monId)
  let i = 0
  while (i < rows.length && rows[i]!.level > pet.slvl) i++
  const occupied = new Set<string>()
  const items: CreatedMonsterItem113c[] = []
  for (; i < rows.length; i++) {
    const row = rows[i]!
    let count = 0
    while (count < row.candidates.length && count < 3 && row.candidates[count]!.locId > 0 && row.candidates[count]!.locId < 11) count++
    if (count <= 0) continue
    const cand = row.candidates[rollLimitedSeed113c(seed, count)]!
    if (occupied.has(cand.loc)) continue
    occupied.add(cand.loc)
    // 0x6FC31490 -> SUNIT_AllocUnitData 0x6FD01D90 (type 4): 0x6FD00110 + 0x6FD000C0
    const itemId = host.allocateUnitId(UNIT_TYPE_113C.item, false)
    const { unitSeed, itemDataSeed } = allocItemSeeds113c(host.gameSeed)
    host.unitSeeds.set(`${UNIT_TYPE_113C.item}:${itemId}`, unitSeed)
    items.push(
      createMonsterItem113c({
        itemCode: cand.item,
        quality: cand.mod,
        ilvl,
        itemVersion: ITEM_VERSION_EXPANSION_113C,
        unitSeed,
        itemDataSeed,
      }),
    )
  }
  return items
}

/**
 * `0x6FC6F970` HP bonus (`0x6FC6FCD4..0x6FC6FDA8`): `hp = #10913(pPet)` (8.8 max HP), `p = calc1`;
 * `hp += hp * p / 100` with the overflow-safe variants for large values; `STAT_MAXHP = STAT_HITPOINTS = hp`.
 */
function petHpBonus113c(hp: number, p: number): number {
  let add: number
  if (hp > 0x100000) {
    if ((hp & ~0xf) < 0x640) add = Math.trunc((hp * p) / 100) // 0x6FD144B0 64-bit / 100
    else add = Math.trunc(hp / 100) * p
  } else if (p > 0x10000) {
    if ((p & ~0xf) < 0x640) add = Math.trunc((hp * p) / 100)
    else add = Math.trunc(p / 100) * hp
  } else add = Math.trunc((hp * p) / 100)
  return hp + add
}

/**
 * Valkyrie (`SKILLS_SrvDo016_Valkyrie` `0x6FC6D710` -> `0x6FC6F970`) on the oracle path: the HP bonus on
 * the `MONSTER_InitStats` HP, then `D2GAME_CreateMonsterEquipment` with `ilvl = #10786(calc2)`
 * (`0x6FC6D830..0x6FC6D83A`, passed to `0x6FCB2ED0` at `0x6FC70049`) and the items' stat lists merged
 * into the pet (`0x6FCF60D0` body-location equip).
 */
function initOracleValkyrie113c(
  host: GameInstanceHost,
  pet: SummonedPetUnit,
  seed: D2SeedStrc,
  rolledHp: number,
): void {
  const skill = host.registry.getSkillById(32)
  if (skill === undefined) throw new Error('initOracleValkyrie113c: no Skills.txt row 32')
  const ownerCtx = host.buildOwnerSummonCombatContext113c(Number(pet.ownerUnitId))
  const calcCtx = {
    registry: host.registry,
    activeSkill: skill,
    slvl: pet.slvl,
    blvl: ownerCtx.statList.getBaseSkillLevel(32),
    ulvl: ownerCtx.statList.getAccruedStat('level'),
    getBaseSkillLevel: (id: number) => ownerCtx.statList.getBaseSkillLevel(id),
    getEffectiveSkillLevel: (id: number) => ownerCtx.statList.getEffectiveSkillLevel(id),
    getUnitStat: (stat: string | number, baseOnly?: boolean) => ownerCtx.statList.getAccruedStat(stat, baseOnly),
  }
  const hp = petHpBonus113c(rolledHp * FIXED_ONE, evaluateCalc(skill.calc1, calcCtx))
  const ilvl = evaluateCalc(skill.calc2, calcCtx)
  if (ilvl === 0) throw new Error('initOracleValkyrie113c: calc2 = 0 (0x6FC7001F default ilvl not ported)')
  pet.statList.setBaseStat('maxhp', hp)
  pet.statList.setHp256(hp)
  const items = createMonsterEquipmentUnits113c(host, pet, seed, ilvl)
  for (const item of items) {
    const weaponBase = resolveWeaponBase113c(item.code)
    for (const st of item.stats) {
      if (st.layer !== 0) throw new Error(`initOracleValkyrie113c: layered item stat ${st.name}/${st.layer} not applied`)
      // ItemStatCost op 13 (`item_mindamage_percent` 18 / `item_maxdamage_percent` 17, `0x6FD89530`): the
      // percent is folded into the item's own base damage (`op stat1..3` = min/secondary/throw damage) and
      // never reaches the wearer's stat (oracle F851: STAT 17 / 18 = 0, STAT 23 / 24 = 4 / 32 for a 3..15
      // spear with +59% ED and +9 max: 3 + 3*59/100, 15 + 9 + 15*59/100).
      if (st.name === 'item_mindamage_percent' || st.name === 'item_maxdamage_percent') {
        if (weaponBase === undefined) throw new Error(`initOracleValkyrie113c: ${st.name} on non-weapon ${item.code}`)
        const isMin = st.name === 'item_mindamage_percent'
        const oneH = isMin ? weaponBase.mindam : weaponBase.maxdam
        const twoH = (isMin ? weaponBase.twoHandedMindam : weaponBase.twoHandedMaxdam) ?? 0
        const thr = (isMin ? weaponBase.minMisDam : weaponBase.maxMisDam) ?? 0
        if (oneH > 0) pet.statList.addStat(isMin ? 'mindamage' : 'maxdamage', Math.trunc((oneH * st.value) / 100))
        if (twoH > 0) pet.statList.addStat(isMin ? 'secondary_mindamage' : 'secondary_maxdamage', Math.trunc((twoH * st.value) / 100))
        if (thr > 0) pet.statList.addStat(isMin ? 'item_throw_mindamage' : 'item_throw_maxdamage', Math.trunc((thr * st.value) / 100))
        continue
      }
      pet.statList.addStat(st.stat, st.value)
    }
  }
  // Oracle F642 (p52-amazon-valkyrie): STAT_HITPOINTS == STAT_MAXHP after the items (561.0 = 552 + 9);
  // the hitpoints top-up is observed, its code site is not located yet (kb §7).
  pet.statList.setHp256(pet.statList.getMaxHp256())
  // `SummonedPetUnit.hp` / `maxHp` (whole points) mirror the stat list; the combat code re-syncs
  // `hitpoints` from `pet.hp` (`setHp256(pet.hp * FIXED_ONE)`).
  pet.maxHp = pet.statList.getMaxHp256() / FIXED_ONE
  pet.hp = pet.statList.getHp256() / FIXED_ONE
  ;(pet as { monEquipItems113c?: readonly CreatedMonsterItem113c[] }).monEquipItems113c = items

  // 0x6FC6FDAD..0x6FC6FEAA: sumskill1..5 (`Skills+0xC4` ids, `+0xD0` calcs): lvl = #10786(calc); when the
  // id is valid and lvl > 0, #10302(pPet, skill, lvl) adds the skill and, for a passive skill
  // (`SkillsTxt+0x04` & passive flag), 0x6FCC2100(pPet, skill, -1) switches on its `passivestate`.
  const states = host.petVisualStates.get(petUnitIdOf(host, pet))?.states
  if (states === undefined) throw new Error('initOracleValkyrie113c: pet has no state set')
  const sumSkills: readonly (readonly [string, string])[] = [
    [skill.sumSkill1, skill.sumSk1Calc],
    [skill.sumSkill2, skill.sumSk2Calc],
    [skill.sumSkill3, skill.sumSk3Calc],
    [skill.sumSkill4, skill.sumSk4Calc],
  ]
  for (const [name, calc] of sumSkills) {
    if (name.trim() === '') continue
    const sk = host.registry.getSkill(name.trim())
    if (sk === undefined) throw new Error(`initOracleValkyrie113c: sumskill '${name}' not in Skills.txt`)
    const lvl = evaluateCalc(calc, calcCtx)
    if (lvl <= 0) continue
    if (!sk.passive) continue
    const st = host.registry.getStateByName(sk.passiveState)
    if (st === undefined) throw new Error(`initOracleValkyrie113c: passivestate '${sk.passiveState}' not in States.txt`)
    states.add(st.id)
  }
  // SKILLS_SrvDo016_Valkyrie 0x6FC6D88B: #10945(pPet, 93, 1) switches on state 93; States.bin record 93 has
  // +0x2D = 2 / +0x2E = 0, a transform to player class 0 (Amazon) for 0x6FDA01E0, so the walk velocity
  // base becomes CharStats Amazon `WalkVelocity << 8` (0x6FD80DAF). Oracle: 998 = 65% of 6 << 8.
  const ama = host.registry.getCharStats('ama')
  if (ama === undefined) throw new Error('initOracleValkyrie113c: CharStats has no Amazon row')
  ;(pet as { transformBaseVelocityFp8113c?: number }).transformBaseVelocityFp8113c = ama.walkVelocity << 8
  // The same remap makes the Valkyrie a player-type class-0 unit for the animation lookup (`0x6FD82670`
  // COF `AM` + mode + weapon class) and the start frame (`0x6FD82220`).
  ;(pet as { transformPlayerClass113c?: number }).transformPlayerClass113c = 0
  // SKILLS_SrvDo016_Valkyrie 0x6FC6D892: #10210(pPet, pOwner) (0x6FD83020) stores the source unit and
  // switches on state 98 `sourceunit` (0x6FD8306C).
  const sourceUnit = host.registry.getStateByName('sourceunit')
  if (sourceUnit === undefined) throw new Error('initOracleValkyrie113c: States.txt has no sourceunit')
  states.add(sourceUnit.id)
}

function petUnitIdOf(host: GameInstanceHost, pet: SummonedPetUnit): number {
  const id = host.petUnitIds.get(pet.uid)
  if (id === undefined) throw new Error(`pet ${pet.uid} has no unit id`)
  return id
}

/**
 * Oracle-path spawn side of `D2GAME_SummonPet` (`0x6FCC3610`, kb/monsters/d2game-summon-pet-spawn-113c.md):
 * the monster spawn (`0x6FD0EF10`) rolls the outfit (`0x6FCEA5F0` -> `MONSTER_ChooseOutfit`) and
 * `MONSTER_InitStats` HP (`0x6FCD0043`) on the new unit seed, the unit starts in `Skills.txt` `summode`,
 * gets a dynamic path in the area path world, and its first AI event is scheduled.
 */
export function initOracleSummonedPet113c(
  host: GameInstanceHost,
  pet: SummonedPetUnit,
  petUnitId: number,
  areaId: number,
  skillId: number,
): void {
  const hcIdx = petClassId(pet)
  const seed = host.unitSeeds.get(`${UNIT_TYPE_113C.monster}:${petUnitId}`)
  if (seed === undefined) throw new Error(`initOracleSummonedPet113c: pet ${petUnitId} has no unit seed`)
  const kind = getMonsterKindByHcIdx(hcIdx, host.difficulty)
  if (kind === undefined) throw new Error(`initOracleSummonedPet113c: no MonStats kind for ${hcIdx}`)
  const palette =
    host.drlgRoomPopulator?.getLevelOutfitPalette(areaId) ?? host.actMonsterOutfitPalettes[areaToAct(areaId)]
  if (palette === undefined) throw new Error(`initOracleSummonedPet113c: no outfit palette for area ${areaId}`)
  rollMonsterOutfit113c(palette, hcIdx, seed)
  const init = rollMonsterInitStats113c({
    kind,
    difficulty: host.difficulty,
    isBoss: false,
    noRatio: Boolean(kind.noRatio),
    isExpansion: true,
    unitSeed: seed,
  })
  ;(pet as { initStatsHp113c?: number }).initStatsHp113c = init.rolledHp

  // 0x6FC6E2A0 (nLevel <= 0): STAT_LEVEL = min(ownerLevel, max(1, (3 * ownerLevel) / 4 + slvl)).
  const owner = host.players.get(Number(pet.ownerUnitId))
  if (owner === undefined) throw new Error(`initOracleSummonedPet113c: pet ${petUnitId} has no owner player`)
  const ownerLevel = owner.level
  let petLevel = Math.trunc((3 * ownerLevel) / 4) + pet.slvl
  if (petLevel <= 1) petLevel = 1
  if (petLevel > ownerLevel) petLevel = ownerLevel
  pet.statList.setBaseStat('level', petLevel)

  // MONSTER_InitStats damage of the A1 mode (STAT 21 / 22). The 1:1-ported summons are all MonStats
  // `noRatio = 1`, so the raw `A1MinD` / `A1MaxD` are used without MonLvl scaling (oracle: Clay Golem
  // 21 / 22 = 2 / 5, Valkyrie 9 / 24).
  const statsRow = MONSTATS_113C_ROWS[hcIdx]
  if (statsRow === undefined) throw new Error(`initOracleSummonedPet113c: no MonStats row ${hcIdx}`)
  if (!statsRow.noRatio) throw new Error(`initOracleSummonedPet113c: MonLvl damage scaling for ${hcIdx} not ported`)
  pet.statList.setBaseStat('mindamage', statsRow.a1.minD[host.difficulty]!)
  pet.statList.setBaseStat('maxdamage', statsRow.a1.maxD[host.difficulty]!)

  if (skillId === 32) initOracleValkyrie113c(host, pet, seed, init.rolledHp)

  const skill = host.registry.getSkillById(skillId)
  if (skill === undefined) throw new Error(`initOracleSummonedPet113c: no Skills.txt row ${skillId}`)
  const mode = MONMODE_BY_CODE_113C[skill.sumMode.trim().toUpperCase()]
  if (mode === undefined) throw new Error(`initOracleSummonedPet113c: skill ${skillId} summode '${skill.sumMode}'`)
  pet.mode = mode
  host.areaPathWorld.spawnMonster(
    areaId,
    { unitId: petUnitId, hcIdx, areaId, x: pet.x, y: pet.y, mode, dead: false },
    host.currentFrame,
  )
  if (NECROPET_PORTED_HCIDX_113C.has(hcIdx)) {
    pet.oracleAi113c = createNecroPetAiState113c(host.currentFrame + firstThinkDelay113c(skillId))
  }
}

/** `0x6FD1CED8`: direction rotation table read by the follow-the-owner search (`0x6FC3CC5C`). */
const PET_FOLLOW_DIR_TABLE_113C: readonly number[] = [4, 3, 2, 1, 0, 7, 6, 5]
/** `D2Common #10740` (`0x6FD6A270`): 8-direction unit vector, `dx` at `0x6FDE4EE4`, `dy` at `0x6FDE4EC4`. */
const DIR8_DX_113C: readonly number[] = [0, -1, -1, -1, 0, 1, 1, 1]
const DIR8_DY_113C: readonly number[] = [-1, -1, 0, 1, 1, 1, 0, -1]
/** `D2Common #10266` (`0x6FD6A2B0`): 64-direction to 8-direction table at `0x6FDEF0B0`. */
function dir64To8_10266(dir64: number): number {
  const d = dir64 & 0xff
  if (d >= 64) throw new Error(`#10266: direction ${dir64} outside the 64-entry table`)
  return d < 4 || d >= 60 ? 0 : (d + 4) >> 3
}

interface PetCtx {
  readonly host: GameInstanceHost
  readonly owner: InternalPlayerRecord
  readonly pet: SummonedPetUnit
  readonly petUnitId: number
  readonly areaId: number
  readonly ai: NecroPetAiState113c
  readonly seed: D2SeedStrc
}

/**
 * One server frame of a NecroPet summon: advance its path while it walks/runs; when the move ends or
 * the AI event is due, run the think function. Called from `stepSummonedPets` on the DRLG path only.
 */
export function stepNecroPet113c(
  host: GameInstanceHost,
  owner: InternalPlayerRecord,
  pet: SummonedPetUnit,
  petUnitId: number,
  areaId: number,
): void {
  const ai = pet.oracleAi113c
  if (ai === undefined) throw new Error(`stepNecroPet113c: pet ${petUnitId} has no NecroPet AI state`)
  const seed = host.unitSeeds.get(`${UNIT_TYPE_113C.monster}:${petUnitId}`)
  if (seed === undefined) throw new Error(`stepNecroPet113c: pet ${petUnitId} has no unit seed`)
  const c: PetCtx = { host, owner, pet, petUnitId, areaId, ai, seed }

  const existingPetPath = host.areaPathWorld.getUnitPathState113c(
    areaId,
    UNIT_TYPE_113C.monster,
    petUnitId,
  )
  if (existingPetPath === null) {
    host.areaPathWorld.removeMonster(petUnitId)
    pet.mode = MODE_NU
    // The re-spawned path unit starts in NU, so a pending A1 one-shot cannot continue.
    ai.swing = undefined
    host.areaPathWorld.spawnMonster(
      areaId,
      {
        unitId: petUnitId,
        hcIdx: petClassId(pet),
        areaId,
        x: Math.floor(pet.x + 0.5),
        y: Math.floor(pet.y + 0.5),
        mode: MODE_NU,
        dead: false,
      },
      host.currentFrame,
    )
  }

  // MONMODE_ATTACK1 started by 0x6FD12220: no AI event is pending while the one-shot runs
  // (kb/monsters/d2game-necropet-ai-113c.md §2.1).
  const swing = ai.swing
  if (swing !== undefined) {
    if (!swing.resolved && host.currentFrame >= swing.actionFrame) {
      swing.resolved = true
      resolvePetMeleeSwing113c(c, swing.targetUnitId)
    }
    if (host.currentFrame >= swing.endFrame) {
      // One-shot end (`#10426` 0x6FD7EF6D) -> MONSTER_StartMode(NU); the AI driver re-arms the type-2
      // event `MonStats.aidel[diff]` frames later (oracle: Clay Golem aidel 15 NU F831 -> think F846,
      // Valkyrie aidel 6 NU F866 -> think F872).
      ai.swing = undefined
      pet.mode = MODE_NU
      host.areaPathWorld.stopMonsterMove113c(areaId, petUnitId, MODE_NU)
      ai.nextAiFrame = host.currentFrame + petAiDelay113c(c)
    }
    return
  }

  let immediateAi = false
  if (pet.mode === MODE_WL || pet.mode === MODE_RN) {
    const res = host.areaPathWorld.stepMonsterMove113c({
      areaId,
      unitId: petUnitId,
      hcIdx: petClassId(pet),
      velocityPct: petVelocityPct113c(c.pet),
      baseVelocityFp8: petTransformBaseVelocity113c(c.pet),
      mode: pet.mode,
    })
    if (res === null) {
      pet.mode = MODE_NU
      immediateAi = true
    } else {
      pet.x = res.x
      pet.y = res.y
      if (res.stepped !== 0) return
      pet.mode = MODE_NU
      host.areaPathWorld.stopMonsterMove113c(areaId, petUnitId, MODE_NU)
      immediateAi = true
    }
  }
  if (!immediateAi && host.currentFrame < ai.nextAiFrame) return
  necroPetThink113c(c)
}

/**
 * Walk velocity percent handed to the path port: the monster base 75 (same convention as the DRLG
 * monster AI) plus the pet's accrued `STAT_VELOCITYPERCENT` (67; Golem Mastery `passivestat1`).
 */
function petVelocityPct113c(pet: SummonedPetUnit): number {
  return 75 + Math.trunc(pet.statList.getAccruedStat(67))
}

/**
 * Transform-state base velocity (`0x6FDA01E0` in `UNITS_UpdateAnimRateAndVelocity`): a state whose
 * States.bin `+0x2D == 2` remaps the unit to player class `+0x2E` and `0x6FD80D50` then returns CharStats
 * `WalkVelocity << 8` instead of MonStats `Velocity << 8`. Set for the Valkyrie (state 93, class 0).
 */
function petTransformBaseVelocity113c(pet: SummonedPetUnit): number | undefined {
  return (pet as { transformBaseVelocityFp8113c?: number }).transformBaseVelocityFp8113c
}

function petClassId(pet: SummonedPetUnit): number {
  if (pet.classId === undefined) throw new Error(`NecroPet: pet ${pet.uid} has no MonStats class`)
  return pet.classId
}

/**
 * `AITHINK_NecroPet` dispatcher `0x6FC3E900`: frees the pending AI events, then calls the ranged variant
 * `0x6FC3E3D0` when `pAiTick->pAiGeneral->[+0x14]` is set, else the melee variant `0x6FC3E640`.
 */
function necroPetThink113c(c: PetCtx): void {
  // `pAiGeneral+0x14` (`0x6FC3E92F`) is only set for the ranged Necromage path; not ported yet.
  if (petClassId(c.pet) === 364) {
    throw new NecroPetNotPortedError113c('ranged variant 0x6FC3E3D0 (necromage)')
  }
  necroPetMeleeThink113c(c)
}

/** `0x6FC3E640` (melee NecroPet). kb/monsters/d2game-necropet-ai-113c.md §2. */
function necroPetMeleeThink113c(c: PetCtx): void {
  const { host, owner } = c
  // 0x6FC3E705: ownerDist = 0x6FCD0A20(pPet, pOwner) (size-subtracted octile distance).
  const ownerDist = sizeDistPetTo(c, UNIT_TYPE_113C.player, owner.unitId)
  if (ownerDist > 50) {
    // 0x6FC3E70A: 0x6FC3CAE0(pPet, pGame, pOwner, 3, 0, 0, 0) (leash teleport).
    petMoveToOwner113c(c, 3, 0, 0, 0)
    return
  }
  // 0x6FC3E730..0x6FC3E74E: run bonus = min(100, Run * 100 / Velocity - 100), 100 when Velocity <= 0.
  const row = MONSTATS_113C_ROWS[petClassId(c.pet)]
  if (row === undefined) throw new Error(`NecroPet: no MonStats row for ${petClassId(c.pet)}`)
  let runBonus = 100
  if (row.velocity > 0) {
    const b = Math.trunc((row.run * 100) / row.velocity) - 100
    runBonus = b < 100 ? b : 100
  }
  if (ownerDist > 28) {
    // 0x6FC3E753: 0x6FC3CAE0(pPet, pGame, pOwner, 0, 0, runBonus, 0).
    petMoveToOwner113c(c, 0, 0, runBonus, 0)
    return
  }
  // 0x6FC3E786: owner's nearest target; dropped when its unit flag bit 30 is set (0x6FC3E791).
  const ownerFind = aiFindNearestTarget113c(c, 'owner')
  const ownerTarget = ownerFind.target !== null && !ownerFind.targetFlag30 ? ownerFind.target : null
  // 0x6FC3E7B5: the pet's own nearest target (writes nTargetDist and bInMeleeRange).
  const petFind = aiFindNearestTarget113c(c, 'pet')
  let target: InternalMonsterRecord | null = null
  if (petFind.target !== null && petFind.dist <= 24 && petFind.dist <= 6) target = petFind.target
  if (target === null && ownerTarget !== null) {
    if (sizeDistPetTo(c, UNIT_TYPE_113C.monster, ownerTarget.unitId) < 36) target = ownerTarget
  }
  // 0x6FC3E7E5: 0x6FCD0E90(pPet, pTarget) validity check; returns 0 for a null target.
  if (target !== null && !isValidPetTarget(c, target)) target = null

  // 0x6FC3E7F0..0x6FC3E810: one inline draw on pPet->pSeed, `lo % 100`.
  const roll = (SEED_RollRandomNumber(c.seed) >>> 0) % 100
  const handled =
    roll < 15
      ? petFollowCheck113c(c, target, petFind.meleeFlag, true, 8)
      : petFollowCheck113c(c, target, petFind.meleeFlag, false, 7)
  if (handled) return

  if (target === null || isTownArea(c.areaId)) {
    // 0x6FC3E853: AI_IdleWander(pGame, pPet, 4) (0x6FD129B0).
    aiIdleWander113c(c, 4)
    return
  }
  if (petFind.meleeFlag) {
    // 0x6FC3E87C: rollLimited(100) < 80 -> attack (0x6FD12220, mode A1) else stall 10 (0x6FD122C0).
    if (rollLimitedSeed113c(c.seed, 100) < 80) {
      aiAttack113c(c, target)
      return
    }
    aiStall113c(c, 10)
    return
  }
  // 0x6FC3E8B7: pAiControl+0x20 = 12, then 0x6FD13000(pGame, pPet, pTarget, 7).
  c.ai.ovNewDist = 12
  aiApproachTarget7_113c(c, target)
}

/**
 * `0x6FD13000(pGame, pPet, pTarget, nFlags)`: `pAiControl+0x18 = 13`, then
 * `AI_ApproachTarget(pGame, pPet, pTarget, WL, 0, 0, 1, nFlags)` (`nFlags = 7` from NecroPet). On failure
 * `nFlags & 2` draws `lo % 100` on `pPet->pSeed`: `< 70` -> `AI_IdleWander(4)`, else stall 10
 * (`0x6FD12641..0x6FD12661`, kb/monsters/d2game-zombie-ai-113c.md §2).
 */
function aiApproachTarget7_113c(c: PetCtx, target: InternalMonsterRecord): void {
  c.ai.ovPathType = 13
  const pathType = c.ai.ovPathType
  const newDist = c.ai.ovNewDist !== 0 ? c.ai.ovNewDist : DEFAULT_NEW_DIST
  c.ai.ovPathType = 0
  c.ai.ovVelocity = 0
  c.ai.ovNewDist = 0
  const pts = c.host.areaPathWorld.startMonsterMoveToTarget113c({
    areaId: c.areaId,
    unitId: c.petUnitId,
    hcIdx: petClassId(c.pet),
    targetUnitType: UNIT_TYPE_113C.monster,
    targetUnitId: target.unitId,
    pathType,
    stepNum: 1,
    velocityPct: petVelocityPct113c(c.pet),
      baseVelocityFp8: petTransformBaseVelocity113c(c.pet),
    maxDist: newDist,
  })
  if (pts > 0) {
    c.pet.mode = MODE_WL
    return
  }
  if ((SEED_RollRandomNumber(c.seed) >>> 0) % 100 < 70) {
    aiIdleWander113c(c, 4)
  } else {
    aiStall113c(c, 10)
  }
}

/**
 * `0x6FC3E140` follow-the-owner check (kb §3): returns `true` when it issued a move / stall (the
 * caller stops), `false` when the pet may act on its own.
 */
function petFollowCheck113c(
  c: PetCtx,
  target: InternalMonsterRecord | null,
  meleeFlag: boolean,
  skipIdleState2: boolean,
  baseFollow: number,
): boolean {
  const { host, owner } = c
  const ownerDist = sizeDistPetTo(c, UNIT_TYPE_113C.player, owner.unitId)
  const ownerMode = owner.mode
  // 0x6FC3E19E..0x6FC3E1B7: follow distance += floor(totalPets / 2), capped at 36.
  const totalPets = host.summonManagers.get(owner.unitId)?.getActivePets().length ?? 0
  let thr = baseFollow + (totalPets >> 1)
  if (thr > 36) thr = 36
  // 0x6FC3E1BB: standing on the owner while it idles and no melee target -> state 5.
  if (ownerDist <= 1 && ownerMode === 1 && !meleeFlag) {
    return petMoveToOwner113c(c, 5, 0, 0, thr)
  }
  // 0x6FC3E1F3: with a target outside town only a > 80 leash makes the pet come back.
  if (target !== null && !isTownArea(c.areaId)) {
    if (ownerDist > 80) return petMoveToOwner113c(c, 3, 0, 0, thr)
    return false
  }
  // 0x6FC3E229..0x6FC3E31D: owner/pet rooms and the owner's path targets.
  const ownerPath = host.areaPathWorld.getUnitPathState113c(c.areaId, UNIT_TYPE_113C.player, owner.unitId)
  const petPath = host.areaPathWorld.getUnitPathState113c(c.areaId, UNIT_TYPE_113C.monster, c.petUnitId)
  if (ownerPath === null || petPath === null) throw new Error('NecroPet follow: owner or pet has no dynamic path')
  const ownerRoomEx = host.areaPathWorld.tileZoneAtPosition113c(ownerPath.room, ownerPath.x, ownerPath.y)
  const petRoomEx = host.areaPathWorld.tileZoneAtPosition113c(petPath.room, petPath.x, petPath.y)
  let state = 2
  if (ownerMode === 2 || ownerMode === 6 || ownerMode === 3) state = 0
  if (ownerPath.targetX !== ownerPath.finalX && ownerPath.targetY !== ownerPath.finalY) state = 0
  if (ownerRoomEx !== petRoomEx) state = 1
  if (ownerDist > thr) state = 1
  if (ownerDist > 50) state = 3
  // 0x6FC3E366..0x6FC3E399: distance to pPlayerData+0x148/+0x14C (last SUNIT warp position, 0 until warped).
  const warp = owner.lastWarpPos113c
  if (warp === undefined) throw new Error(`NecroPet follow: owner ${owner.unitId} has no pPlayerData warp position`)
  const warpDist = unitDistToCoords(petPath.x, petPath.y, warp.x, warp.y)
  if (warpDist >>> 0 < 28) {
    if (state === 1) {
      if (ownerDist < 30) state = 4
    } else if (state === 2) {
      state = 4
    }
  }
  if (skipIdleState2 && state === 2) return false
  return petMoveToOwner113c(c, state, 0, 0, thr)
}

/** `0x6FCD07B0(pUnit, x, y)`: `UNITS_GetDistanceToCoordinates` from the unit position. */
function unitDistToCoords(ux: number, uy: number, x: number, y: number): number {
  return unitsDistanceToCoordinates113c(ux, uy, x, y)
}

/**
 * `0x6FC3CAE0(pPet, pGame, pOwner, nState, bRun, nVelocity, nFollow)` (kb §4): returns `true` when a
 * move was started or the pet stalled.
 */
function petMoveToOwner113c(c: PetCtx, state: number, runFlag: number, velocity: number, follow: number): boolean {
  void follow
  const { host, owner } = c
  const ownerPath = host.areaPathWorld.getUnitPathState113c(c.areaId, UNIT_TYPE_113C.player, owner.unitId)
  const petPath = host.areaPathWorld.getUnitPathState113c(c.areaId, UNIT_TYPE_113C.monster, c.petUnitId)
  if (ownerPath === null || petPath === null) throw new Error('NecroPet move: owner or pet has no dynamic path')
  const finalX = ownerPath.finalX
  const finalY = ownerPath.finalY
  const petX = petPath.x
  const petY = petPath.y
  const ownerX = ownerPath.x
  const ownerY = ownerPath.y
  switch (state) {
    case 0: {
      // 0x6FC3CC05: #10192(pOwner, finalX, finalY) -> #10266 -> 8-direction.
      let dir = dir64To8_10266(dirToCoords10192(ownerX, ownerY, finalX, finalY))
      const ownerRoomEx = host.areaPathWorld.tileZoneAtPosition113c(ownerPath.room, ownerX, ownerY)
      for (let i = 0; i < 8; i++) {
        const d = PET_FOLLOW_DIR_TABLE_113C[dir]!
        const x = (finalX + DIR8_DX_113C[d]! * 8) | 0
        const y = (finalY + DIR8_DY_113C[d]! * 8) | 0
        if (host.areaPathWorld.tileZoneAtPosition113c(ownerPath.room, x, y) === ownerRoomEx) {
          if (velocity < -126 || velocity > 126) throw new Error(`NecroPet move: velocity ${velocity} out of range`)
          if (velocity !== 0) c.ai.ovVelocity = velocity
          c.ai.ovNewDist = 40
          const mode = runFlag !== 0 ? MODE_RN : MODE_WL
          if (aiApproachPos113c(c, mode, x, y, 1, 4)) return true
          if (aiApproachPos113c(c, mode, ((petX + x) >>> 0) >>> 1, ((petY + y) >>> 0) >>> 1, 1, 4)) return true
        }
        dir = (dir + 1) & 7
      }
      // 0x6FC3CD6A: every candidate failed -> wander, then the owner midpoint, then the owner.
      if (aiIdleWander113c(c, 4)) return true
      const mx = Math.trunc((ownerX + petX) / 2)
      const my = Math.trunc((ownerY + petY) / 2)
      if (runFlag !== 0 && aiApproachPos113c(c, MODE_RN, mx, my, 1, 4)) return true
      if (aiApproachPos113c(c, MODE_WL, mx, my, 1, 4)) return true
      return aiApproachPos113c(c, MODE_WL, ownerX, ownerY, 1, 0)
    }
    case 2: {
      // 0x6FC3D0E1: 10% wander 3..5, else stall 15.
      if (rollLimitedSeed113c(c.seed, 100) < 10) {
        const range = rollLimitedSeed113c(c.seed, 3) + 3
        if (aiIdleWander113c(c, range)) return true
        c.ai.ovNewDist = 40
        if (aiApproachPos113c(c, MODE_WL, finalX, finalY, 1, 4)) return true
      }
      aiStall113c(c, 15)
      return true
    }
    case 4: {
      // 0x6FC3D245: count the owner's other pets within 1 sub-tile (0x6FCB6AF0 + callback 0x6FC35590).
      let stacked = 0
      const mgr = host.summonManagers.get(owner.unitId)
      for (const other of mgr?.getActivePets() ?? []) {
        if (other.uid === c.pet.uid) continue
        const otherId = host.petUnitIds.get(other.uid)
        if (otherId === undefined) continue
        if (sizeDistPetTo(c, UNIT_TYPE_113C.monster, otherId) <= 1) stacked++
      }
      if (stacked < 1) {
        aiStall113c(c, 15)
        return true
      }
      throw new NecroPetNotPortedError113c('move state 4 with stacked pets (0x6FD12D80)')
    }
    default:
      throw new NecroPetNotPortedError113c(`move state ${state} (0x6FC3CAE0 jump table 0x6FC3D39C)`)
  }
}

/**
 * `D2Common #10192` (`0x6FD7F910`): 64-direction from the unit's sub-tile centre to `(x, y)`
 * (`PATH_GetDirectionVector` on `(n << 16) + 0x8000`).
 */
function dirToCoords10192(ux: number, uy: number, x: number, y: number): number {
  return pathComputeDirection(ux, uy, x, y)
}

/**
 * `AI_IdleWander` `0x6FD129B0` (same body as `0x6FD11B10`, kb/monsters/d2game-zombie-ai-113c.md §3):
 * 4 draws on `pPet->pSeed`, then `AI_ApproachTarget(..., WL, x0 + dx, y0 + dy, 1, 0)`.
 */
function aiIdleWander113c(c: PetCtx, range: number): boolean {
  const petPath = c.host.areaPathWorld.getUnitPathState113c(c.areaId, UNIT_TYPE_113C.monster, c.petUnitId)
  if (petPath === null) throw new Error('NecroPet wander: pet has no dynamic path')
  const s1 = SEED_RollRandomNumber(c.seed)
  let dx: number
  let dy: number
  if ((s1 & 1) !== 0) {
    dy = rollLimitedSeed113c(c.seed, range)
    dx = range
  } else {
    dx = rollLimitedSeed113c(c.seed, range)
    dy = range
  }
  if ((SEED_RollRandomNumber(c.seed) & 1) !== 0) dx = -dx
  if ((SEED_RollRandomNumber(c.seed) & 1) !== 0) dy = -dy
  return aiApproachPos113c(c, MODE_WL, petPath.x + dx, petPath.y + dy, 1, 0)
}

/**
 * `AI_ApproachTarget(pGame, pPet, NULL, nMode, x, y, nStepNum, nFlags)` `0x6FD12540` with the
 * `MONSTER_StartMode` path part (`0x6FC94F90`: consume and clear the `pAiControl` overrides).
 * `nFlags & 4` on failure only frees pending AI events (no draw); `& 2` is never passed here.
 */
function aiApproachPos113c(c: PetCtx, mode: number, x: number, y: number, stepNum: number, flags: number): boolean {
  void flags
  const pathType = c.ai.ovPathType !== 0 ? c.ai.ovPathType : PATHTYPE_TOWARD_FINISH
  const newDist = c.ai.ovNewDist !== 0 ? c.ai.ovNewDist : DEFAULT_NEW_DIST
  c.ai.ovPathType = 0
  c.ai.ovVelocity = 0
  c.ai.ovNewDist = 0
  const pts = c.host.areaPathWorld.startMonsterMoveToPos113c({
    areaId: c.areaId,
    unitId: c.petUnitId,
    hcIdx: petClassId(c.pet),
    targetX: x | 0,
    targetY: y | 0,
    pathType,
    stepNum,
    velocityPct: petVelocityPct113c(c.pet),
      baseVelocityFp8: petTransformBaseVelocity113c(c.pet),
    maxDist: newDist,
  })
  if (pts > 0) {
    c.pet.mode = mode
    return true
  }
  return false
}

/**
 * `0x6FD122C0(pGame, pPet, nFrames)`: `MONSTER_StartMode(NU)` unless already neutral (which clears the
 * `pAiControl` overrides), then the next AI event at `frame + max(1, nFrames)`.
 */
function aiStall113c(c: PetCtx, frames: number): void {
  if (c.pet.mode !== MODE_NU) {
    c.pet.mode = MODE_NU
    c.host.areaPathWorld.stopMonsterMove113c(c.areaId, c.petUnitId, MODE_NU)
    c.ai.ovPathType = 0
    c.ai.ovVelocity = 0
    c.ai.ovNewDist = 0
  }
  c.ai.nextAiFrame = c.host.currentFrame + (frames === 0 ? 1 : frames)
}

/** `MonStats.aidel[diff]`: frames between the end of a mode and the next type-2 AI event. */
function petAiDelay113c(c: PetCtx): number {
  const row = MONSTATS_113C_ROWS[petClassId(c.pet)]
  const aidel = row?.aidel[c.host.difficulty]
  if (aidel === undefined) throw new Error(`NecroPet: MonStats aidel missing for ${petClassId(c.pet)}`)
  return Math.max(1, aidel)
}

/** `0x6FD81B90(pPet, 1)`: the pet's equipped weapon (MonEquip item with a `Weapons.txt` base), if any. */
function petEquippedWeapon113c(pet: SummonedPetUnit): WeaponBase | undefined {
  const items = (pet as { monEquipItems113c?: readonly CreatedMonsterItem113c[] }).monEquipItems113c ?? []
  for (const item of items) {
    const base = resolveWeaponBase113c(item.code)
    if (base !== undefined) return base
  }
  return undefined
}

/**
 * Animation timing of the pet's `A1` (`UNITS_UpdateAnimRateAndVelocity` `0x6FD833DE..0x6FD8354F` +
 * mode-start init `0x6FD835F0`):
 * - `0x6FDA01E0` transform remap: a `States.txt` `gfxtype = 2` state (Valkyrie state 93 -> player class 0)
 *   turns the monster into a player-type unit, monster mode 4 -> player mode 7 (`0x6FDE30D8[4]`), and the
 *   COF is `token + A1 + wclass(weapon)` (`0x6FD93860`, `hth` without weapon); otherwise `code + A1 + hth`.
 * - rate = `STAT_ATTACKRATE (68)` + diminished `item_fasterattackrate` (`0x6FD823E0`, base 120), clamped
 *   `[15, 175]`; the dual-wield averaging `0x6FD80530` and the shapeshift weapon delay `0x6FDA0CE0` do not
 *   apply to pets. `MONSTER_InitStats` seeds STAT 68 = 100 (`0x6FCCFFC5`; the pet stat list here holds only
 *   the item / skill contributions, same convention as `petVelocityPct113c`).
 * - speed = `AnimData.speed * rate / 100` (unsigned `/100`); the mode starts at `start << 8`
 *   (`0x6FD82220`, non-zero only for player-type Amazon / Sorceress weapon classes).
 * - action on `ceil((event - start) * 256 / speed)`, `NU` on `ceil((frames - start) * 256 / speed)`.
 * Oracle: Clay Golem `G1A1HTH` (16 frames, event 9, speed 232) F813 -> hit F823 -> NU F831; Valkyrie
 * `AMA12HT` (18 / 11, rate 110, start 2) F851 -> hit F860 -> NU F866.
 */
function petAttackTiming113c(c: PetCtx): { readonly actionTicks: number; readonly endTicks: number } {
  const { host, pet } = c
  const transformClass = (pet as { transformPlayerClass113c?: number }).transformPlayerClass113c
  let cofName: string
  let startFrame = 0
  if (transformClass !== undefined) {
    const token = PLAYER_TOKEN_BY_CLASS_113C[transformClass]
    if (token === undefined) throw new Error(`NecroPet: no player token for class ${transformClass}`)
    const wclass = (petEquippedWeapon113c(pet)?.wclass ?? 'hth').trim().toUpperCase()
    cofName = `${token}A1${wclass}`
    startFrame = playerAnimStartFrame113c(transformClass, 7, wclass)
  } else {
    const code = MONSTATS_113C_ROWS[petClassId(pet)]?.code?.trim().toUpperCase()
    if (code === undefined || code === '') throw new Error(`NecroPet: MonStats code missing for ${petClassId(pet)}`)
    cofName = `${code}A1HTH`
  }
  const record = host.registry.getAnimDataRecord(cofName)
  if (record === undefined || record.framesPerDirection <= 0) {
    throw new Error(`NecroPet: AnimData record ${cofName} missing`)
  }
  const event = record.events.find((e) => e.code !== 0)
  if (event === undefined) throw new Error(`NecroPet: AnimData record ${cofName} has no action event`)
  let rate =
    100 +
    Math.trunc(pet.statList.getAccruedStat('attackrate')) +
    computeRawDiminishingRate113c(Math.trunc(pet.statList.getAccruedStat('item_fasterattackrate')), 120)
  if (rate < 15) rate = 15
  else if (rate > 175) rate = 175
  const speed = Math.trunc(((record.animationSpeed * rate) >>> 0) / 100)
  if (speed <= 0) throw new Error(`NecroPet: zero anim speed for ${cofName}`)
  return {
    actionTicks: Math.max(1, Math.ceil(((event.frame - startFrame) * 256) / speed)),
    endTicks: Math.max(1, Math.ceil(((record.framesPerDirection - startFrame) * 256) / speed)),
  }
}

/**
 * `0x6FD12220(eax = pPet, pGame, nMode, pTarget)`: fills the mode-change struct (`0x6FC95070`) with
 * `nMode` and the target and calls `MONSTER_StartMode(pGame, &struct, 1)` (`0x6FC95E10`): the moving path
 * stops, the `pAiControl` overrides are consumed, and the pet stays in `A1` until the one-shot ends.
 */
function aiAttack113c(c: PetCtx, target: InternalMonsterRecord): void {
  c.ai.ovPathType = 0
  c.ai.ovVelocity = 0
  c.ai.ovNewDist = 0
  c.pet.mode = MODE_A1
  c.host.areaPathWorld.stopMonsterMove113c(c.areaId, c.petUnitId, MODE_A1)
  const timing = petAttackTiming113c(c)
  c.ai.swing = {
    targetUnitId: target.unitId,
    actionFrame: c.host.currentFrame + timing.actionTicks,
    endFrame: c.host.currentFrame + timing.endTicks,
    resolved: false,
  }
}

/**
 * `0x6FCFCD80` elemental pair roll (no mastery for pets): `min = STAT(minId) << 8`, `max = STAT(maxId) << 8`,
 * one exclusive `RAND(&pPet->pSeed, max - min)` only when `max > min`.
 */
function rollPetElemPair113c(c: PetCtx, minStat: string, maxStat: string): number {
  const min = Math.trunc(c.pet.statList.getAccruedStat(minStat)) << 8
  const max = Math.trunc(c.pet.statList.getAccruedStat(maxStat)) << 8
  if (max <= 0 && min <= 0) return 0
  return max > min ? min + rollLimitedSeed113c(c.seed, max - min) : min
}

/**
 * Pet melee action frame on a monster (`0x6FC64AC0` -> `0x6FCFE5A0` -> `0x6FCFDDE0` -> `SUNITDMG`):
 * 1. to-hit on `pPet->pSeed` (`0x6FCFE011`), defender shield block on its seed (`0x6FCFB7F8`, `toblock > 0`);
 * 2. `SUNITDMG_FillPacket` (`0x6FCFC530`): weapon -> `secondary_min/maxdamage` (two-handed, `0x6FC2A7C0 == 2`)
 *    or `min/maxdamage`, else `min/maxdamage` with the `1` / `2` floors; `<< 8` + `STAT 111`; `%` pool =
 *    `damagepercent` + weapon `StrBonus * str / 100` + `DexBonus * dex / 100` + weapon-mastery ED (0 for pets),
 *    clamped `>= -90`, plus `item_min/maxdamage_percent` (0 on pets: op 13 is folded into the damage stats);
 *    `0x6FCFBED0`: `min' = min + min * pct / 100`, roll `RAND(max' - min')` (exclusive);
 * 3. `0x6FCFD51A..0x6FCFD5B4` (any attacker, `nSrcDam` arg 0): weapon-mastery crit (weapon only, 0 for pets),
 *    `passive_critical_strike` (337), `item_deadlystrike` (141): one `rand(100)` each while > 0 and no proc
 *    yet; a proc doubles the physical damage and sets result flag `0x2000`;
 * 4. elemental pairs fire 48/49, lightning 50/51, cold 54/55, magic 52/53 (`0x6FCFD664..0x6FCFD6CE`);
 * 5. `RAND(1)` (`0x6FCFD908`, unconditional) and `MonStats.crit` (`0x6FC9713B`, doubles every channel).
 * Oracle: Valkyrie F860 draws 6 (to-hit 78, phys 1300 + 886 = 2186, CS 67 >= 56, lightning 256 + 936 = 1192,
 * `RAND(1)`, crit 90 >= 5); Clay Golem F823 draws 4 (to-hit 78, phys 1228 + 188 = 1416, `RAND(1)`, crit 56).
 */
function resolvePetMeleeSwing113c(c: PetCtx, targetUnitId: number): void {
  const { host, pet, owner } = c
  const target = host.monsters.get(targetUnitId)
  if (target === undefined || target.dead) return
  const row = MONSTATS_113C_ROWS[petClassId(pet)]
  if (row === undefined) throw new Error(`NecroPet: no MonStats row for ${petClassId(pet)}`)
  const sl = pet.statList
  for (const unsupported of ['poisonmindam', 'lifedrainmindam', 'manadrainmindam', 'item_crushingblow', 'item_openwounds'] as const) {
    if (Math.trunc(sl.getAccruedStat(unsupported)) !== 0) {
      throw new NecroPetNotPortedError113c(`pet melee stat ${unsupported} (0x6FCFD6D7..0x6FCFD8F0)`)
    }
  }
  const defCtx = host.monsterCombatContext(target)
  const targetSeed = host.unitSeeds.get(`${UNIT_TYPE_113C.monster}:${target.unitId}`)

  // 1. to-hit (attacker seed) and the defender's shield block (defender seed).
  const cth = computeToHitChance({
    attackerAr: Math.trunc(sl.getAccruedStat('tohit')),
    defenderDef: Math.max(0, Math.trunc(defCtx.statList.getAccruedStat('armorclass'))),
    attackerLvl: Math.max(1, Math.trunc(sl.getAccruedStat('level'))),
    defenderLvl: Math.max(1, target.level),
    attackKind: 'melee',
  })
  if (rollLimitedSeed113c(c.seed, 100) >= cth) return
  const toBlock = Math.trunc(defCtx.statList.getAccruedStat('toblock'))
  if (toBlock > 0) {
    if (targetSeed === undefined) throw new Error(`NecroPet: target ${target.unitId} has no unit seed`)
    if (rollLimitedSeed113c(targetSeed, 100) < Math.min(75, toBlock)) return
  }

  // 2. SUNITDMG_FillPacket physical roll.
  const weapon = petEquippedWeapon113c(pet)
  let min: number
  let max: number
  if (weapon !== undefined) {
    min = Math.trunc(sl.getAccruedStat(weapon.twoHanded ? 'secondary_mindamage' : 'mindamage')) << 8
    max = Math.trunc(sl.getAccruedStat(weapon.twoHanded ? 'secondary_maxdamage' : 'maxdamage')) << 8
  } else {
    const rawMin = Math.trunc(sl.getAccruedStat('mindamage'))
    const rawMax = Math.trunc(sl.getAccruedStat('maxdamage'))
    min = (rawMin <= 0 ? 1 : rawMin) << 8
    max = (rawMax <= 1 ? 2 : rawMax) << 8
  }
  const normal = Math.trunc(sl.getAccruedStat('item_normaldamage')) << 8
  min += normal
  max += normal
  if (min < 1) min = 0x100
  if (max <= min) max = min + 0x100
  let pct = Math.trunc(sl.getAccruedStat('damagepercent'))
  if (weapon !== undefined) {
    pct += Math.trunc((weapon.strBonus * Math.trunc(sl.getAccruedStat('strength'))) / 100)
    pct += Math.trunc((weapon.dexBonus * Math.trunc(sl.getAccruedStat('dexterity'))) / 100)
  }
  if (pct < -90) pct = -90
  const minScaled = min + mulDiv113c(min, pct + Math.trunc(sl.getAccruedStat('item_mindamage_percent')), 100)
  const maxScaled = max + mulDiv113c(max, pct + Math.trunc(sl.getAccruedStat('item_maxdamage_percent')), 100)
  let phys = maxScaled > minScaled ? minScaled + rollLimitedSeed113c(c.seed, maxScaled - minScaled) : minScaled

  // 3. Critical Strike / Deadly Strike.
  let doubled = false
  for (const stat of ['passive_critical_strike', 'item_deadlystrike'] as const) {
    if (doubled) break
    const chance = Math.trunc(sl.getAccruedStat(stat))
    if (chance > 0 && rollLimitedSeed113c(c.seed, 100) < chance) doubled = true
  }
  if (doubled) phys *= 2

  // 4. Elemental pairs in FillDamageValues order.
  let fire = rollPetElemPair113c(c, 'firemindam', 'firemaxdam')
  let ltng = rollPetElemPair113c(c, 'lightmindam', 'lightmaxdam')
  let cold = rollPetElemPair113c(c, 'coldmindam', 'coldmaxdam')
  let mag = rollPetElemPair113c(c, 'magicmindam', 'magicmaxdam')

  // 5. RAND(1) + MonStats crit.
  rollLimitedSeed113c(c.seed, 1)
  if (row.crit > 0 && rollLimitedSeed113c(c.seed, 100) < row.crit) {
    phys *= 2
    fire *= 2
    ltng *= 2
    cold *= 2
    mag *= 2
  }

  // SUNITDMG_ApplyResistances (0x6FCFB3C0) for a monster defender (no pierce on pets).
  const applyRes = (dmg256: number, statName: string): number => {
    if (dmg256 <= 0) return 0
    const res = Math.min(100, Math.max(-100, Math.trunc(defCtx.statList.getAccruedStat(statName))))
    if (res >= 100) return 0
    return Math.max(0, dmg256 - Math.trunc((dmg256 * res) / 100))
  }
  const finalPhys = applyRes(phys, 'damageresist')
  const finalFire = applyRes(fire, 'fireresist')
  const finalLtng = applyRes(ltng, 'lightresist')
  const finalCold = applyRes(cold, 'coldresist')
  const finalMag = applyRes(mag, 'magicresist')
  if (cold > 0) throw new NecroPetNotPortedError113c('pet melee cold length (0x6FCFD1F0)')
  const total = finalPhys + finalFire + finalLtng + finalCold + finalMag
  const hpBefore256 = target.hp256 ?? target.hp * FIXED_ONE
  let hpAfter256 = hpBefore256 - total
  if (hpAfter256 < FIXED_ONE) hpAfter256 = 0

  emitSUnitDmgTraceEvent113c({
    att: [UNIT_TYPE_113C.monster, c.petUnitId],
    def: [UNIT_TYPE_113C.monster, target.unitId],
    hp: [hpBefore256 >>> 0, hpBefore256 >>> 0],
    ret: total >>> 0,
    raw: [
      0x20,
      (0x01 | (total > 0 ? 0x04 : 0) | (doubled ? 0x2000 : 0)) >>> 0,
      finalPhys >>> 0,
      0,
      finalFire >>> 0,
      finalPhys > 0 ? 2 : 0,
      0,
      finalLtng >>> 0,
      finalMag >>> 0,
      finalCold >>> 0,
      0, 0, 0, 0, 0, 0, 0, 0,
    ],
  })
  if (total <= 0) return

  if (target.aiAwake === false) target.nextAiFrame = Math.max(target.nextAiFrame, host.currentFrame + 1)
  target.aiAwake = true
  target.lastDamagedFrame113c = host.currentFrame
  target.hp256 = hpAfter256
  target.hp = Math.ceil(hpAfter256 / FIXED_ONE)
  target.hp256Whole = target.hp
  if (hpAfter256 <= 0) {
    host.applyMonsterDeath(target, owner, finalLtng > finalPhys ? 'ltng' : 'phys', 'pet')
    return
  }
  armMonsterEvent3AfterDamage113c(host, target)
  // Clay Golem `EventFunc27_SlowTarget` (`0x6FC6EF70` -> `ITEMEVENTS_ApplySlow` `0x6FCCD2C0`, no draw): a landed
  // hit puts state 24 `slowed` on the target for 750 frames, `item_slow` capped 90 / 75 / 50
  // (oracle `p52-necromancer-poison-golem`: zombie #9 F823 and #11 F1028 gain state 24 on the golem's hit).
  if (petClassId(pet) === 289) {
    const rawSlow = pet.slowPct
    if (rawSlow === undefined || rawSlow <= 0) throw new Error('NecroPet: Clay Golem has no item_slow')
    target.slowedPct113c = capTargetSlowPct113c(rawSlow, defCtx)
    host.applyMonsterState(target.unitId, 24, 750)
  }
  host.maybeEnterMonsterHitRecovery(target, Math.max(1, Math.floor(total / FIXED_ONE)), { dmg256: total })
}

/** `0x6FCD0A20(pPet, pUnit)`: size-subtracted octile distance from the pet to a player/monster. */
function sizeDistPetTo(c: PetCtx, unitType: number, unitId: number): number {
  const d = c.host.areaPathWorld.unitSizeSubtractedDistToTarget(c.areaId, c.petUnitId, unitType, unitId)
  if (d === null) throw new Error(`NecroPet: no path units for distance pet ${c.petUnitId} -> ${unitType}:${unitId}`)
  return d
}

/** `#10057(#10331(pUnit))`: the unit's level is a town. */
function isTownArea(areaId: number): boolean {
  return TOWN_AREAS.has(areaId)
}

/** `0x6FCD0E90(pPet, pTarget)` target validity (alive hostile in reach). */
function isValidPetTarget(c: PetCtx, target: InternalMonsterRecord): boolean {
  void c
  return !target.dead && target.hp > 0
}

/**
 * `AI_FindNearestPlayerOrAlly` `0x6FCD1C90` as called by NecroPet (`pAiGeneral` flags 0): nearest alive
 * hostile monster within 35 sub-tiles (`0x6FCD1D41`; MonStats `aidist` when non-zero) of the source
 * unit (`0x6FCD08F0` distance, `< 0x37` cap), outputs `nTargetDist` (minimum seen when none) and
 * `bInMeleeRange` (`#11138`). See kb §5 for the parts not modelled (game target lists, `#10839`).
 */
function aiFindNearestTarget113c(
  c: PetCtx,
  who: 'owner' | 'pet',
): { target: InternalMonsterRecord | null; dist: number; meleeFlag: boolean; targetFlag30: boolean } {
  const { host } = c
  let sx: number
  let sy: number
  let radius = 35
  if (who === 'owner') {
    sx = Math.round(c.owner.x)
    sy = Math.round(c.owner.y)
  } else {
    sx = Math.round(c.pet.x)
    sy = Math.round(c.pet.y)
    const aidist = MONSTATS_113C_ROWS[petClassId(c.pet)]?.aidist[host.difficulty]
    if (aidist === undefined) throw new Error(`NecroPet: MonStats aidist missing for ${petClassId(c.pet)}`)
    if (aidist !== 0) radius = aidist
  }
  let best: InternalMonsterRecord | null = null
  let bestDist = radius
  let minSeen = 0x7fffffff
  for (const m of host.monsters.values()) {
    if (m.dead || m.isNpc || !m.isKillable || m.align !== 0 || m.areaId !== c.areaId) continue
    if (host.isMonsterConverted(m)) continue
    const d = unitsDistanceToCoordinates113c(Math.round(m.x), Math.round(m.y), sx, sy)
    if (d < minSeen) minSeen = d
    if (d >= 0x37) continue
    if (d < bestDist) {
      bestDist = d
      best = m
    }
  }
  if (best === null) return { target: null, dist: minSeen, meleeFlag: false, targetFlag30: false }
  let meleeFlag = false
  if (who === 'pet') {
    const r = host.areaPathWorld.isMonsterInMeleeRange113c(c.areaId, c.petUnitId, UNIT_TYPE_113C.monster, best.unitId, 0)
    if (r === null) throw new Error(`NecroPet: no path units for melee check pet ${c.petUnitId} -> ${best.unitId}`)
    meleeFlag = r
  }
  return { target: best, dist: bestDist, meleeFlag, targetFlag30: false }
}

