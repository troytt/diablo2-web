/**
 * S2C `0xA3` client skill events (`D2Client.dll` handler `0x6FB5EFB0`) and the `SkillCltDoFunc` entries reached
 * through Skills.txt `cltprgfunc1..3`.
 *
 * `0x6FB5EFB0`: the caster must exist (`test eax,eax; je` @ 0x6FB5EFD7); the target lookup result is not checked.
 * `byte [skill+4] & gdwBitMasks[2]` (Skills.txt `progressive`, 0x6FB5F03E) selects
 * - `0x6FB52950` (progressive): ensure the caster has `aurastate` with `aurastat1 = charge` (0x6FB529CE..0x6FB52A21);
 *   when `prgstack` (0x6FB52A97) run `cltprgfunc[i]` for `i < charge-1` with the stat set to `i+1`, then
 *   `cltprgfunc[charge-1]` (0x6FB52B0B);
 * - `0x6FB51B10` otherwise: `cltprgfunc1` (0x6FB51BF5).
 * The slot is looked up in `SkillCltDoFunc` (0x6FB8EA48); a NULL slot (index 0 included) skips the rest. When the call
 * returns non-zero the tail runs: `dosound` on the caster (0x6FB51C36), `tgtsound` on the target unit (0x6FB51C51) and
 * `tgtoverlay` on the target unit (0x6FB51C77). During the call the caster's target is the packet's target unit, or
 * the packet's `(x, y)` when both are non-zero (0x6FB51BA6..0x6FB51BF2), and is restored afterwards.
 */

import { getSkillClientRow113c, type SkillClientRow113c } from '../../common/skills/skill-client-113c.ts'
import { getMissileTxtData } from '../../common/skills/missiles-data.ts'
import { missileTxtVelocity113c } from '../../common/skills/cltdo25-ring-113c.ts'
import { spawnCltDo25Ring113c } from './world-skill-missiles.ts'
import { OVERLAY_TXT_ROWS } from '../render/overlay-txt-rows.ts'
import type { ClientUnit } from './client-unit.ts'
import type { ClientWorldInternal } from './world-skill-state-tables.ts'

export interface UnitSkillEvent113c {
  readonly flag: number
  readonly skill: number
  readonly level: number
  readonly caster: ClientUnit
  readonly target: ClientUnit | undefined
  readonly x: number
  readonly y: number
}

export interface CltPrgContext113c {
  readonly world: ClientWorldInternal
  readonly row: SkillClientRow113c
  readonly caster: ClientUnit
  readonly target: ClientUnit | undefined
  readonly targetX: number
  readonly targetY: number
  readonly level: number
  /** Progressive charge (`aurastat1` value) the slot runs with; 0 for non-progressive skills. */
  readonly charge: number
}

/** A `SkillCltDoFunc` slot reached through `cltprgfunc`; returns the slot's success flag. */
export type CltPrgFunc113c = (ctx: CltPrgContext113c) => boolean

const OVERLAY_INDEX_BY_NAME: ReadonlyMap<string, number> = new Map(
  OVERLAY_TXT_ROWS.map((r, i) => [r.name.trim().toLowerCase(), i] as const),
)

/** Overlay.txt row `name + offset` (the DLL adds `charge - 1` to the compiled overlay index). */
export function overlayNameAtOffset113c(name: string, offset: number): string {
  const base = OVERLAY_INDEX_BY_NAME.get(name.trim().toLowerCase())
  if (base === undefined) throw new Error(`'${name}' is not an Overlay.txt row`)
  const row = OVERLAY_TXT_ROWS[base + offset]
  if (row === undefined) throw new Error(`Overlay.txt row '${name}' + ${String(offset)} is out of range`)
  return row.name
}

function unitSoundRequest(unit: ClientUnit, soundId: number): Record<string, unknown> {
  return { soundId, unit: { unitType: unit.unitType, id: unit.id, x: unit.x, y: unit.y } }
}

/** Skills.txt `cltcalc` cell as the constant the 1.13c rows use for these slots; any expression is rejected. */
function constCalc113c(row: SkillClientRow113c, i: 0 | 1 | 2): number {
  const raw = row.cltCalc[i]
  const v = Number(raw)
  if (raw === '' || !Number.isInteger(v)) {
    throw new Error(`Skills.txt #${String(row.id)} cltcalc${String(i + 1)} '${raw}' is not a constant`)
  }
  return v
}

/** Clamp of the progressive stat read by CltDo12 / CltDo13 (0x6FAF0C2C..0x6FAF0C3D). */
function clampCharge(charge: number): number {
  return charge <= 1 ? 1 : charge >= 3 ? 3 : charge
}

/**
 * CltDo12 `0x6FAF0B60` (Tiger Strike): needs a target unit; overlay `prgoverlay + charge - 1` on the target, sound
 * `prgsound + charge - 1` on the caster.
 */
const cltDo12: CltPrgFunc113c = ctx => {
  if (!ctx.target) return false
  const off = ctx.row.progressive && ctx.row.auraState >= 0 ? clampCharge(ctx.charge) - 1 : 0
  if (ctx.row.prgOverlay !== '') {
    ctx.world.attachUnitOverlay(ctx.target, overlayNameAtOffset113c(ctx.row.prgOverlay, off), false)
  }
  if (ctx.row.prgSound > 0) ctx.world.pushSoundRequest(unitSoundRequest(ctx.caster, ctx.row.prgSound + off))
  return true
}

/** CltDo13 `0x6FAF0A70` (Cobra Strike): overlay and sound (`+ charge - 1`) both on the caster. */
const cltDo13: CltPrgFunc113c = ctx => {
  const off = ctx.row.progressive && ctx.row.auraState >= 0 ? clampCharge(ctx.charge) - 1 : 0
  if (ctx.row.prgOverlay !== '') {
    ctx.world.attachUnitOverlay(ctx.caster, overlayNameAtOffset113c(ctx.row.prgOverlay, off), false)
  }
  if (ctx.row.prgSound > 0) ctx.world.pushSoundRequest(unitSoundRequest(ctx.caster, ctx.row.prgSound + off))
  return true
}

/**
 * Martial-arts release tiers (CltDo9 `0x6FAF1780`, CltDo10 `0x6FAF07C0`, CltDo11 `0x6FAF1690`, CltDo14 `0x6FAF0880`,
 * CltDo83 `0x6FAF15A0`, CltDo15 `0x6FAF14F0`, see kb/skills/player/skills-ass-martial-arts.md): the per-tier client
 * missiles are spawned by `spawnMartialArtsReleaseTier113c` in world-skill-missiles.ts.
 */
const cltDoMartialRelease: CltPrgFunc113c = ctx => {
  ctx.world.spawnMartialArtsReleaseTier(ctx.caster, ctx.row.id, ctx.charge, ctx.targetX, ctx.targetY)
  return true
}

/** CltDo84 `0x6FB24350` (Thunder Storm): `thunderstorm1` above the target unit and `prgoverlay` on it. */
const cltDo84: CltPrgFunc113c = ctx => {
  const target = ctx.target
  if (!target) return false
  ctx.world.spawnMissileByKey(ctx.row.cltMissileA, target.x, target.y, target.x, target.y, {
    ownerType: ctx.caster.unitType,
    ownerId: ctx.caster.id,
    sourceSkillId: ctx.row.id,
    skillLevel: Math.max(1, ctx.level),
    maxTicks: 9,
    altitude: 280,
    verticalDescentPerTick: 40,
  })
  if (ctx.row.prgOverlay !== '') ctx.world.attachUnitOverlay(target, ctx.row.prgOverlay, false)
  return true
}

/**
 * CltDo91 `0x6FB794E0` (Volcano): `cltmissilea` and `cltmissileb` (both `Range = 150`) at the target coordinates
 * (0x6FB51340); both stay in place.
 */
const cltDo91: CltPrgFunc113c = ctx => {
  for (const key of [ctx.row.cltMissileA, ctx.row.cltMissileB]) {
    if (key === '') continue
    const m = ctx.world.spawnMissileByKey(key, ctx.targetX, ctx.targetY, ctx.targetX, ctx.targetY, {
      ownerType: ctx.caster.unitType,
      ownerId: ctx.caster.id,
      sourceSkillId: ctx.row.id,
      skillLevel: Math.max(1, ctx.level),
    })
    m.vx = 0
    m.vy = 0
  }
  return true
}

/**
 * CltDo92 `0x6FB795F0` (Armageddon / Diablogeddon): `frames = cltcalc1`, `fall = cltcalc2`, `slide = cltcalc3`
 * (each must be > 0, else the slot fails); `cltmissilea` (tail) and `cltmissileb` (rock) at the target with
 * `UNIT_Set3DTrajectory` (0x6FB77E30) offset `(frames * slide, frames * fall)` and path velocity
 * `(-slide << 11, 0, -fall << 11)` (0x6FB79747..0x6FB79757), i.e. the meteor slides `slide / 32` sub-tiles and drops
 * `fall` pixels per frame onto the target in `frames` frames.
 */
const cltDo92: CltPrgFunc113c = ctx => {
  const frames = constCalc113c(ctx.row, 0)
  const fall = constCalc113c(ctx.row, 1)
  const slide = constCalc113c(ctx.row, 2)
  if (frames <= 0 || fall <= 0 || slide <= 0) return false
  const skyX = ctx.targetX - (frames * slide) / 32
  for (const key of [ctx.row.cltMissileA, ctx.row.cltMissileB]) {
    if (key === '') continue
    const m = ctx.world.spawnMissileByKey(key, skyX, ctx.targetY, ctx.targetX, ctx.targetY, {
      ownerType: ctx.caster.unitType,
      ownerId: ctx.caster.id,
      sourceSkillId: ctx.row.id,
      skillLevel: Math.max(1, ctx.level),
      maxTicks: frames,
      altitude: frames * fall,
      verticalDescentPerTick: fall,
    })
    m.vx = slide / 32
    m.vy = 0
  }
  return true
}

/**
 * CltDo93 `0x6FB75670` (CorpseCycler / VineCycler): needs the target unit (the corpse, 0x6FB55F70); spawns
 * `cltmissileb` (`recycler delay`) on it.
 */
const cltDo93: CltPrgFunc113c = ctx => {
  const corpse = ctx.target
  if (!corpse || ctx.row.cltMissileB === '') return false
  const m = ctx.world.spawnMissileByKey(ctx.row.cltMissileB, corpse.x, corpse.y, corpse.x, corpse.y, {
    ownerType: ctx.caster.unitType,
    ownerId: ctx.caster.id,
    sourceSkillId: ctx.row.id,
    skillLevel: Math.max(1, ctx.level),
  })
  m.vx = 0
  m.vy = 0
  return true
}

/** TS implementations of the `SkillCltDoFunc` slots that 1.13c Skills.txt reaches through `cltprgfunc1..3`. */
export const CLT_PRG_FUNCS_113C: Readonly<Record<number, CltPrgFunc113c>> = Object.freeze({
  9: cltDoMartialRelease,
  10: cltDoMartialRelease,
  11: cltDoMartialRelease,
  12: cltDo12,
  13: cltDo13,
  14: cltDoMartialRelease,
  15: cltDoMartialRelease,
  83: cltDoMartialRelease,
  84: cltDo84,
  91: cltDo91,
  92: cltDo92,
  93: cltDo93,
})

/** `SkillCltDoFunc` table size (`[0x6FB8EC50]` = 130). */
const CLT_DO_FUNC_COUNT_113C = 130

function runSlot(ctx: CltPrgContext113c, slot: number): boolean {
  if (slot <= 0 || slot >= CLT_DO_FUNC_COUNT_113C) return false
  const fn = CLT_PRG_FUNCS_113C[slot]
  if (!fn) throw new Error(`SkillCltDoFunc[${String(slot)}] (Skills.txt #${String(ctx.row.id)}) has no TS implementation`)
  return fn(ctx)
}

function runTail(world: ClientWorldInternal, row: SkillClientRow113c, caster: ClientUnit, target?: ClientUnit): void {
  if (row.doSound > 0) world.pushSoundRequest(unitSoundRequest(caster, row.doSound))
  if (row.tgtSound > 0 && target) world.pushSoundRequest(unitSoundRequest(target, row.tgtSound))
  if (row.tgtOverlay !== '' && target) world.attachUnitOverlay(target, row.tgtOverlay, false)
}

/**
 * Applies one S2C 0xA3 event. Returns `true` when a `cltprgfunc` slot ran successfully (tail included).
 * Skills without a client row or without a `cltprgfunc` do nothing (the NULL slot 0 skips the tail).
 */
export function applyUnitSkillEvent113c(world: ClientWorldInternal, ev: UnitSkillEvent113c): boolean {
  const row = getSkillClientRow113c(ev.skill)
  if (!row) return false
  const { caster, target } = ev
  const targetX = target ? target.x : ev.x !== 0 && ev.y !== 0 ? ev.x : caster.x
  const targetY = target ? target.y : ev.x !== 0 && ev.y !== 0 ? ev.y : caster.y
  const base = { world, row, caster, target, targetX, targetY, level: ev.level }
  if (row.progressive) {
    // 0x6FB52992..0x6FB52A21: no aurastate / aurastat1 -> nothing happens.
    if (row.auraState < 0 || row.auraStat1 < 0) return false
    const charge = ev.flag
    let charges = (caster as any).chargeCounts as Map<number, number> | undefined
    if (!charges) {
      charges = new Map<number, number>()
      ;(caster as any).chargeCounts = charges
    }
    caster.states.add(row.auraState)
    const idx = charge - 1
    if (row.prgStack) {
      for (let i = 0; i < idx; i++) {
        charges.set(row.id, i + 1)
        if (row.cltPrgFunc[i] !== undefined && row.cltPrgFunc[i]! > 0) runSlot({ ...base, charge: i + 1 }, row.cltPrgFunc[i]!)
      }
    }
    charges.set(row.id, charge)
    const slot = row.cltPrgFunc[idx]
    if (slot === undefined || slot <= 0) return false
    if (!runSlot({ ...base, charge }, slot)) return false
    runTail(world, row, caster, target)
    return true
  }
  const slot = row.cltPrgFunc[0]
  if (slot <= 0) return false
  if (!runSlot({ ...base, charge: 0 }, slot)) return false
  runTail(world, row, caster, target)
  return true
}

/**
 * Client Do tail for the target unit (`D2Client.dll` `0x6FB52C90`, after the SkillCltDoFunc): `tgtsound` (+0x10A)
 * played on the target unit (`0x6FB52E7A`, target from `0x6FB55F70`) and `tgtoverlay` (+0x108) attached to it
 * (`0x6FB52EA4`). `dosound` (+0x100) is played by the keyframe sound path (`emitSkillKeyframeSound`).
 */
export function runSkillDoTargetTail113c(
  world: ClientWorldInternal,
  skillId: number,
  target: ClientUnit | undefined,
): void {
  const row = getSkillClientRow113c(skillId)
  if (!row || !target) return
  if (row.tgtSound > 0) world.pushSoundRequest(unitSoundRequest(target, row.tgtSound))
  if (row.tgtOverlay !== '') world.attachUnitOverlay(target, row.tgtOverlay, false)
}

/**
 * `SkillCltDoFunc[ItemCltEffect]` for item casts (1.13c Skills.txt: #44 Frost Nova / #48 Nova = 10, #53 Chain
 * Lightning = 96):
 * - CltDo10 `0x6FAF07C0`: `missile = cltmissilea` (`0x6FAF0550`, non-progressive), `velocity = Missiles.txt
 *   velocity at the skill level` (`0x6FABCB5C`), ring of that missile around the caster (`0x6FB51020`).
 * - CltDo96 `0x6FB24610`: one `cltmissilea` from the caster toward the target (`0x6FB51340` / `0x6FB55F70`) with
 *   `eval(calc1)` set on it (`0x6FABC448`) — the same missile the regular #53 Do spawns (`normalDo`).
 */
export function runItemCltEffect113c(
  world: ClientWorldInternal,
  caster: ClientUnit,
  skillId: number,
  slot: number,
  level: number,
  normalDo: () => void,
): void {
  const row = getSkillClientRow113c(skillId)
  if (!row) throw new Error(`Skills.txt #${String(skillId)} has no client row`)
  if (slot === 10) {
    const m = getMissileTxtData(row.cltMissileA)
    spawnCltDo25Ring113c(world, m.name, caster.x, caster.y, missileTxtVelocity113c(m, Math.max(1, level)), {
      ownerType: caster.unitType,
      ownerId: caster.id,
      sourceSkillId: skillId,
      skillLevel: Math.max(1, level),
    })
    return
  }
  if (slot === 96) {
    normalDo()
    return
  }
  throw new Error(`ItemCltEffect SkillCltDoFunc[${String(slot)}] (Skills.txt #${String(skillId)}) has no TS implementation`)
}
