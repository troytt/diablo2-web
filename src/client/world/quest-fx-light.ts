/**
 * Diablo II v1.13c quest special ambient lights: steps 1–3 of D2Client.dll `CLIENT_GetAmbientLight`
 * (0x6fb59a20), which run before the Levels.txt / act-clock ambient of steps 4–5
 * (`src/common/world/ambient-light.ts`) when the light grid prefill 0x6fb59c90 asks for a room's
 * ambient (0x6fb59cfe player room, 0x6fb59d68 each near room; `bSpecial` = 1):
 *
 * 1. Den of Evil (level 8): the red Den light 0x6fb024d0 (RGB 255,64,48, I 80) while A1Q1 is live
 *    (S2C 0x5E byte 2), fading out over 30 ticks after special quest event 0 (0x89);
 * 2. levels 107/108 (River of Flame, Chaos Sanctuary): red 255,64,48 at intensity 160 while the event 12
 *    flag `[0x6fbcc2e4]` is set and the event 13 countdown `[0x6fba2130]` is -1 (0x6fb59a42-6c);
 * 3. every other level: the global fade `g_Fade` (0x6fbc960c), started by special quest event 1 (Cairn
 *    Stones, 0x6fb02d00 → 0x6fb02450) or by a state whose States.txt `setfunc` is 2 (Cloak of Shadows,
 *    0x6fb223d0), and advanced by FadeTick 0x6fb02f10 (0x6fb59a77-98).
 *
 * A step whose colour is black falls through to steps 4–5 (0x6fb59aae-c3), which is the normal state.
 * All state is integer; only `cos512(phase) * T` is float (Fog #10083, `fogCos`, exact table bits)
 * truncated toward zero like `_ftol2` 0x6fb7acc4.
 *
 * The client globals are per process: `resetForNewGame` mirrors the game init 0x6faf43d0
 * (inline 0x6faf456b-c0 and the fade memset 0x6faf4597), which leaves the S2C 0x5E copy and the
 * event 13 countdown untouched.
 */

import { computeDiminishingReturns, computeLinearScaling } from '../../common/data/calc-ast.ts'
import { resolveLevelAmbient, type AmbientLight } from '../../common/world/ambient-light.ts'
import type { Environment } from '../../common/world/environment.ts'
import { fogCos } from '../weather/fog-sin-table.ts'
import {
  AURA_LEN_CALC_BY_SKILL,
  CAIRN_STONES_MISSILE,
  SETFUNC_FADE_STATES,
  SKILLS_TXT_ROW_COUNT,
} from './quest-fx-data-113c.ts'

/** Levels.txt id of the Den of Evil (0x6fb59a3d). */
export const DEN_OF_EVIL_LEVEL_ID = 8
/** Levels.txt ids lit red by special quest event 12: `lvl > 0x6a && lvl <= 0x6c` (0x6fb59a42-4a). */
export const ACT4_RED_LEVEL_IDS: readonly number[] = [107, 108]
/** Size of the S2C 0x5E quest availability copy `g_QuestAvail` (0x6fbc5590, 0x6fb5c092-a1). */
export const QUEST_AVAILABILITY_BYTES = 37
/** Special quest event ids the handler 0x6fb023b0 accepts (`id >= 0x14` FatalAssert 0x1da). */
export const SPECIAL_QUEST_EVENT_COUNT = 0x14
/** objects.txt Id 17 `StoneAlpha`, looked up by special quest event 1 (0x6fb02d16-24). */
export const STONE_ALPHA_OBJECT_CLASS = 0x11
/** Level the Cairn Stones fade belongs to: Stony Field (0x6fb02d49-81). */
export const CAIRN_STONES_FADE_LEVEL_ID = 4
/** ItemStatCost `modifierlist_skill` / `modifierlist_level`, read by 0x6fb223f9-0x6fb22410. */
export const STAT_MODIFIERLIST_SKILL = 350
export const STAT_MODIFIERLIST_LEVEL = 351

/** Den fade length in ticks: `(t << 7) / 30` (0x6fb02534-4a), done at `++t >= 30` (0x6fb03745-4c). */
const DEN_FADE_TICKS = 30
/** Ticks from special quest event 13 to clearing the Act 4 red flag (0x6fb03764-83). */
const ACT4_RED_COUNTDOWN_TICKS = 30
/** Ramp-out length both starters substitute for 0 (0x6fb024ac-ae, 0x6fb224b6-b8, FadeTick 0x6fb02feb-f4). */
const DEFAULT_RAMP_OUT = 25
/** Ramp-in length of the `setfunc` 2 fade (0x6fb2248c-b0). */
const STATE_FADE_RAMP_IN = 5

/** `g_Fade` (0x6fbc960c, 11 dwords) minus the `lock` dword, which only the memsets write (always 0). */
export interface FadeState {
  /** +0x00 */
  active: boolean
  /** +0x04: `cos512(phase) * T` of the latest tick */
  intensity: number
  /** +0x08..+0x0a: the player room's base colour, rewritten every tick */
  red: number
  green: number
  blue: number
  /** +0x0c */
  rampIn: number
  /** +0x10 */
  rampOut: number
  /** +0x14 (write-only in 1.13c) */
  hold: number
  /** +0x18 */
  end: number
  /** +0x1c */
  tick: number
  /** +0x20: cosine phase 0..128 (128 = dark) used by the next tick */
  phase: number
  /** +0x24: the fade dies on the first tick the local player's level differs */
  levelId: number
}

/** Plain copy of the client quest-light globals, for tests and debugging. */
export interface QuestFxLightSnapshot {
  readonly questAvailRecv: boolean
  readonly questAvail: Uint8Array
  readonly denTimer: number
  readonly denDone: boolean
  readonly act4Red: boolean
  readonly act4RedCountdown: number
  readonly fade: Readonly<FadeState>
}

/** World access special quest events 1 and 12 need (0x6fb02d00, 0x6fb033f0). */
export interface SpecialQuestEventContext {
  /**
   * D2Common #10754(player room, UNIT_OBJECT, 17) != NULL (0x6fb02d16-24): whether an object of class
   * 17 `StoneAlpha` stands in the local player's room or one of its near rooms, returning its sub-tile
   * coordinates when found (or `boolean` for legacy callers). `false` / `null` when there is no local
   * player or it has no room (0x6fb02d01-13: the event does nothing then).
   */
  readonly findStoneAlpha: () => boolean | { readonly x: number; readonly y: number } | null
  /** 0x6fb02d27-44: spawns client missile 288 (`cairnstones`) at `StoneAlpha` when event 1 fires. */
  readonly spawnCairnStones?: ((x: number, y: number) => void) | undefined
  /**
   * 0x6fb033fe-38: on event 12, when the local player's room is Chaos Sanctuary (`levelId === 108` / `0x6c`),
   * spawns client missile 372 (`diablo appears`) at the local player's sub-tile position.
   */
  readonly spawnDiabloAppearsIfInChaosSanctuary?: (() => void) | undefined
  /**
   * 0x6fb03450 (event 3): when there is a local player with a room and D2Common #10754(room, UNIT_OBJECT, 0x98) finds
   * the Horadric orifice in it or a near room, starts the staff show at the orifice; otherwise does nothing.
   */
  readonly spawnHoradricStaffIfOrificeNear?: (() => void) | undefined
}

/** One stat of a state's statlist, as the state packets carry it (structural `ItemStat`). */
export interface QuestFxStat {
  readonly statId: number
  readonly param: number
  readonly value: number
}

/** Local player input of the quest-FX tick. */
export interface QuestFxPlayer {
  /** Level of the local player's room (D2Common #10826 of `GetRoom(gpPlayer)`). */
  readonly levelId: number
  /** That room's base light: `CLIENT_GetAmbientLight(bSpecial = 0)`, i.e. steps 4–5. */
  readonly base: AmbientLight
}

function emptyFade(): FadeState {
  return {
    active: false,
    intensity: 0,
    red: 0,
    green: 0,
    blue: 0,
    rampIn: 0,
    rampOut: 0,
    hold: 0,
    end: 0,
    tick: 0,
    phase: 0,
    levelId: 0,
  }
}

/**
 * `_ftol2` 0x6fb7acc4 as the fade and Den code use it: truncation toward zero to an integer. An integer
 * has no sign of zero, so `cos512(128) * T` (cos512(128) = -8.74e-8) gives 0, not `Math.trunc`'s -0.
 */
function ftol2(x: number): number {
  const v = Math.trunc(x)
  return v === 0 ? 0 : v
}

function checkPhase(phase: number, where: string): number {
  if (!Number.isInteger(phase) || phase < 0 || phase > 128) {
    throw new Error(`QuestFxLight: ${where} phase ${String(phase)} outside the 1.13c range 0..128`)
  }
  return phase
}

/**
 * Fade length X of a `setfunc` 2 state: D2Common #10786 on the skill's Skills.txt `auralencalc` at
 * skill level `slvl` (0x6fb22447-4e). Supports the calc forms Skills.txt uses for single-skill
 * durations — an integer, `parN`, `lnXY` (`parX + (slvl - 1) * parY`) and `dmXY` (diminishing
 * returns) — and throws on any other formula (e.g. `skill('X'.blvl)` terms) instead of guessing.
 *
 * A skill without `auralencalc` gives 0 (UNVERIFIED: #10786 with calc index -1; SPEC #826 V7).
 * UNVERIFIED: `lnXY` / `dmXY` at `slvl <= 0` use the shared helpers, which return `parX`.
 */
export function evaluateAuraLenCalc(skill: number, slvl: number): number {
  const row = AURA_LEN_CALC_BY_SKILL[skill]
  if (row === undefined) return 0
  const par = (index: string): number => row.params[Number(index) - 1]!
  const calc = row.calc
  if (/^-?\d+$/.test(calc)) return Number(calc)
  let m = /^par([1-8])$/.exec(calc)
  if (m) return par(m[1]!)
  m = /^ln([1-8])([1-8])$/.exec(calc)
  if (m) return computeLinearScaling(par(m[1]!), par(m[2]!), slvl)
  m = /^dm([1-8])([1-8])$/.exec(calc)
  if (m) return computeDiminishingReturns(par(m[1]!), par(m[2]!), slvl)
  throw new Error(
    `evaluateAuraLenCalc: Skills.txt ${String(skill)} (${row.skill}) auralencalc '${calc}' ` +
      'is not supported by the fade port',
  )
}

/** The client-side quest-light globals and their handlers (D2Client 1.13c). */
export class QuestFxLight {
  /** `g_bQuestAvailRecv` 0x6fbcc0a0: set by the first S2C 0x5E, never cleared. */
  private questAvailRecv = false
  /** `g_QuestAvail` 0x6fbc5590: S2C 0x5E pkt[1..37]; overwritten by the next 0x5E, never cleared. */
  private readonly questAvail = new Uint8Array(QUEST_AVAILABILITY_BYTES)
  /** `g_nDenTimer` 0x6fba212c */
  private denTimer = -1
  /** `g_bDenDone` 0x6fbcc2e0 */
  private denDone = false
  /** `g_bAct4Red` 0x6fbcc2e4 */
  private act4Red = false
  /** `g_nAct4RedCountdown` 0x6fba2130: not reset by the game init (0x6faf456b-c0). */
  private act4RedCountdown = -1
  /** `g_Fade` 0x6fbc960c */
  private readonly fade: FadeState = emptyFade()
  /** `[pRoom+0x34] & 1` mark set by `0x6faf40c0` on revealed Den of Evil rooms (`tileX,tileY`). */
  private readonly denMarkedRooms = new Set<string>()

  /**
   * Game init 0x6faf43d0: `g_nDenTimer = -1`, `g_bDenDone = 0`, `g_bAct4Red = 0` (0x6faf456b-c0) and the fade
   * memset (0x6faf4597).
   */
  resetForNewGame(): void {
    this.denTimer = -1
    this.denDone = false
    this.act4Red = false
    this.denMarkedRooms.clear()
    this.clearFade()
  }

  /**
   * S2C 0x5E GameQuestAvailability handler 0x6fb5c090: copies pkt[1..37] and sets `g_bQuestAvailRecv`
   * (0x6fb5c092-a1).
   */
  onQuestAvailability(bytes: Uint8Array): void {
    if (bytes.length !== QUEST_AVAILABILITY_BYTES) {
      throw new Error(
        `QuestFxLight: S2C 0x5E carries ${String(QUEST_AVAILABILITY_BYTES)} availability bytes, ` +
          `got ${String(bytes.length)}`,
      )
    }
    this.questAvail.set(bytes)
    this.questAvailRecv = true
  }

  /**
   * `g_QuestAvail[questId]` read as done by `0x6fb12de0` and the level entry title override
   * (`0x6fb6f29f-c0`): FatalAssert `0x60` before the first S2C 0x5E, `0x65` for `questId >= 0x25`.
   */
  getQuestAvailability(questId: number): number {
    if (!this.questAvailRecv) {
      throw new Error('QuestFxLight: g_QuestAvail read before S2C 0x5E (1.13c FatalAssert 0x60)')
    }
    if (!Number.isInteger(questId) || questId < 0 || questId >= QUEST_AVAILABILITY_BYTES) {
      throw new Error(`QuestFxLight: g_QuestAvail[${String(questId)}] trips the 1.13c FatalAssert 0x65`)
    }
    return this.questAvail[questId]!
  }

  /**
   * S2C 0x89 SpecialQuestEvent → 0x6fb023b0 (ecx = pkt[1]): FatalAssert for `id >= 0x20` / `id >= 0x14`
   * (0x6fb023b0-db), then the jump table 0x6fba2138. Events 0, 1, 3, 12 and 13 touch lighting / quest-FX state
   * (the other non-null entries 6, 14, 16, 17 and 19 are not ported).
   */
  onSpecialQuestEvent(id: number, ctx: SpecialQuestEventContext): void {
    if (!Number.isInteger(id) || id < 0 || id >= SPECIAL_QUEST_EVENT_COUNT) {
      throw new Error(`QuestFxLight: special quest event ${String(id)} trips the 1.13c FatalAssert (0x6fb023b0-db)`)
    }
    switch (id) {
      case 0:
        // 0x6fb02440: the last Den of Evil monster died; the quest-FX tick fades the Den light out.
        this.denTimer = 0
        return
      case 1: {
        // 0x6fb02d00: Cairn Stones activated. Spawns client missile 288 (`cairnstones`) at StoneAlpha
        // (0x6fb02d27-44), then starts Starter A with rampIn = rampOut = Missiles[288].Param1 and
        // hold = Range - 2 * Param1 for the Stony Field, bForce = 1 (0x6fb02d49-81).
        const stone = ctx.findStoneAlpha()
        if (stone) {
          if (typeof stone === 'object') {
            ctx.spawnCairnStones?.(stone.x, stone.y)
          }
          const ramp = CAIRN_STONES_MISSILE.param1
          this.startFade(ramp, CAIRN_STONES_MISSILE.range - 2 * ramp, ramp, CAIRN_STONES_FADE_LEVEL_ID)
        }
        return
      }
      case 3:
        // 0x6fb03450: A2Q6 staff placed. Needs gpPlayer, its room and the orifice (objects.txt 152) in that room or
        // a near room (#10754); then the staff missile 338 + light_jet overlay (quest-fx-horadric-113c.ts).
        ctx.spawnHoradricStaffIfOrificeNear?.()
        return
      case 12:
        // 0x6fb033f0: Chaos Sanctuary seals done, Diablo spawns: Act 4 red light on (0x6fb033f9) and
        // client missile 372 (`diablo appears`) when the local player is in level 108 (0x6fb033fe-38).
        this.act4Red = true
        ctx.spawnDiabloAppearsIfInChaosSanctuary?.()
        return
      case 13:
        // 0x6fb02420: Diablo killed (classic games only): red off at once, flag cleared 30 ticks later (0x6fb0242d).
        this.act4RedCountdown = 0
        return
      default:
        return
    }
  }

  /**
   * 1.13c `0x6faf40c0` (RoomReveal / AddRoomData): for each Den of Evil room whose `[pRoom+0x34] & 1 == 0`,
   * if `g_bDenDone != 0` calls `0x6fb03550(pRoom)` (`spawnDenLights`) and sets `[pRoom+0x34] |= 1`.
   */
  onRoomRevealed(levelId: number, tileX: number, tileY: number, spawnDenLights?: () => void): void {
    if (levelId !== DEN_OF_EVIL_LEVEL_ID) return
    const key = `${tileX},${tileY}`
    if (this.denMarkedRooms.has(key)) return
    if (this.denDone) {
      spawnDenLights?.()
    }
    this.denMarkedRooms.add(key)
  }

  /**
   * Clears `[pRoom+0x34] & 1` when a Den of Evil room is unloaded (`RoomHide` 0x08 frees `D2RoomStrc`),
   * so re-entering that room while `g_bDenDone == 1` triggers `0x6faf40c0` again.
   */
  onRoomHidden(levelId: number, tileX: number, tileY: number): void {
    if (levelId !== DEN_OF_EVIL_LEVEL_ID) return
    this.denMarkedRooms.delete(`${tileX},${tileY}`)
  }

  /** Marks a Den of Evil room as having `[pRoom+0x34] |= 1` set (`0x6faf40c0`). */
  markDenRoom(tileX: number, tileY: number): void {
    this.denMarkedRooms.add(`${tileX},${tileY}`)
  }

  /** Whether `[pRoom+0x34] & 1` is currently set for the given Den of Evil room (`tileX, tileY`). */
  isRoomDenMarked(tileX: number, tileY: number): boolean {
    return this.denMarkedRooms.has(`${tileX},${tileY}`)
  }

  /**
   * State set-function dispatch 0x6fb22530 → setfunc 2 = 0x6fb223d0 for one state set by S2C 0xA8 (after
   * the 0x1ff stat terminator, 0x6fb5dea3) or 0xAA (per state, 0x6fb5dcfa) on a unit the client knows.
   *
   * @param stats - the stats that packet added to the state; the state's statlist exists only when there
   *   is at least one (States.txt bit 0x10 clear: the re-set frees the old statlist, 0x6fb237df-f5).
   * @param unitLevelId - level of the unit's room, `null` when it has no room (0x6fb223d3-e1: return).
   */
  onStateSetFunc(state: number, stats: readonly QuestFxStat[] | undefined, unitLevelId: number | null): void {
    if (!SETFUNC_FADE_STATES.includes(state)) return
    // 0x6fb2256f-92 skips dead units only when states.bin byte +0x14 has bit 0x80: clear for every
    // setfunc 2 state (asserted by the generator), so the check is moot.
    if (unitLevelId === null) return
    if (stats === undefined || stats.length === 0) return // 0x6fb223e8-f3: no statlist
    let skill = 0
    let slvl = 0
    for (const stat of stats) {
      if (stat.param !== 0) continue
      if (stat.statId === STAT_MODIFIERLIST_SKILL) skill = stat.value
      else if (stat.statId === STAT_MODIFIERLIST_LEVEL) slvl = stat.value
    }
    if (skill < 0 || skill >= SKILLS_TXT_ROW_COUNT) return // 0x6fb22415-2b
    this.startStateFade(evaluateAuraLenCalc(skill, slvl), unitLevelId)
  }

  /**
   * Starter B 0x6fb223d0 (after the skill lookup): ramp in 5 ticks, hold `3X/5`, ramp out `2X/5`
   * (0 → 25), signed divisions (0x6fb2245d-86); memset, then the fields (0x6fb2248c-cc).
   */
  startStateFade(lengthX: number, levelId: number): void {
    const rampOut = Math.trunc((2 * lengthX) / 5)
    const hold = Math.trunc((3 * lengthX) / 5)
    this.clearFade()
    const f = this.fade
    f.active = true
    f.rampIn = STATE_FADE_RAMP_IN
    f.hold = hold
    f.rampOut = rampOut === 0 ? DEFAULT_RAMP_OUT : rampOut
    f.end = hold + f.rampOut + STATE_FADE_RAMP_IN
    f.levelId = levelId
  }

  /**
   * Quest-FX tick 0x6fb03720, once per 25 Hz logic frame after the unit update and before #10135
   * UpdatePeriodOfDay (0x6faf4ab1): FadeTick when the fade is active (0x6fb03720-29), the Den timer
   * (0x6fb0372e-56), then the Act 4 countdown (0x6fb0375b-83).
   */
  tick(player: QuestFxPlayer | null, onDenDone?: () => void): void {
    if (this.fade.active) this.fadeTick(player)
    if (!this.denDone && this.denTimer !== -1) {
      this.denTimer += 1
      // 0x6fb0374c -> 0x6fb036f0: sets g_bDenDone = 1 and spawns denofevillight (287) in loaded level-8 rooms.
      if (this.denTimer >= DEN_FADE_TICKS) {
        this.denDone = true
        onDenDone?.()
      }
    }
    if (this.act4Red && this.act4RedCountdown !== -1) {
      this.act4RedCountdown += 1
      if (this.act4RedCountdown >= ACT4_RED_COUNTDOWN_TICKS) {
        this.act4Red = false
        this.act4RedCountdown = -1
      }
    }
  }

  /**
   * Steps 1–3 of 0x6fb59a20 for a room of level `levelId`; `null` when the step's colour is black, so
   * the caller falls through to steps 4–5 (0x6fb59aae-c3).
   *
   * @throws when the Den of Evil light is asked for before any S2C 0x5E (FatalAssert 0x6fb024dd-fd).
   */
  special(levelId: number): AmbientLight | null {
    if (levelId === DEN_OF_EVIL_LEVEL_ID) return this.denLight()
    if (ACT4_RED_LEVEL_IDS.includes(levelId)) {
      // 0x6fb59a4c-73
      return this.act4Red && this.act4RedCountdown === -1
        ? { intensity: 0xa0, red: 0xff, green: 0x40, blue: 0x30, source: 'act4' }
        : null
    }
    // 0x6fb59a77-98: bytes 0x6fbc9614..16 and dword 0x6fbc9610.
    const f = this.fade
    if ((f.red | f.green | f.blue) === 0) return null
    return { intensity: f.intensity, red: f.red, green: f.green, blue: f.blue, source: 'fade' }
  }

  snapshot(): QuestFxLightSnapshot {
    return {
      questAvailRecv: this.questAvailRecv,
      questAvail: this.questAvail.slice(),
      denTimer: this.denTimer,
      denDone: this.denDone,
      act4Red: this.act4Red,
      act4RedCountdown: this.act4RedCountdown,
      fade: { ...this.fade },
    }
  }

  /** `DenLight` 0x6fb024d0. */
  private denLight(): AmbientLight | null {
    if (this.denDone) return null // 0x6fb024d0-d7
    if (!this.questAvailRecv) {
      throw new Error(
        'QuestFxLight: Den of Evil light before S2C 0x5E GameQuestAvailability (FatalAssert 0x6fb024dd-fd)',
      )
    }
    if (this.questAvail[1] === 0) return null // 0x6fb02502-0b: A1Q1 not live in this game
    // 0x6fb0251c-5d
    const intensity =
      this.denTimer === -1
        ? 0x50
        : ftol2(fogCos(checkPhase(Math.trunc((this.denTimer << 7) / DEN_FADE_TICKS), 'den')) * 80)
    return { intensity, red: 0xff, green: 0x40, blue: 0x30, source: 'den' }
  }

  /** Starter A 0x6fb02450 (the dead `lock` test 0x6fb02453-62 omitted). */
  private startFade(rampIn: number, hold: number, rampOut: number, levelId: number): void {
    this.clearFade()
    const f = this.fade
    f.active = true
    if (rampIn === 0) throw new Error('QuestFxLight: fade ramp-in of 0 trips the 1.13c FatalAssert (0x6fb02480-99)')
    f.rampIn = rampIn
    f.hold = hold
    f.rampOut = rampOut === 0 ? DEFAULT_RAMP_OUT : rampOut
    f.end = rampIn + hold + f.rampOut
    f.levelId = levelId
  }

  /**
   * FadeTick 0x6fb02f10. The intensity uses the phase the previous tick stored, so ticks 0 and 1 both
   * give T. Without a local player the fade is cleared in this tick (1.13c: level 0 != levelId).
   */
  private fadeTick(player: QuestFxPlayer | null): void {
    if (player === null) {
      this.clearFade()
      return
    }
    const f = this.fade
    // 0x6fb02f2e-44: colour rewritten every tick; T converted as (double)(uint32_t)T.
    f.red = player.base.red
    f.green = player.base.green
    f.blue = player.base.blue
    const T = player.base.intensity >>> 0
    const k = f.tick
    if (k < f.rampIn) {
      // 0x6fb02f57-93
      f.intensity = ftol2(fogCos(f.phase) * T)
      f.phase = checkPhase(Math.trunc((k << 7) / f.rampIn), 'fade ramp-in')
    } else if (k >= f.end - f.rampOut) {
      // 0x6fb02fa9-0x6fb03007 (n uses the old rampOut)
      f.intensity = ftol2(fogCos(f.phase) * T)
      const n = f.rampOut - f.end + k
      if (f.rampOut === 0) f.rampOut = DEFAULT_RAMP_OUT
      f.phase = checkPhase(128 - Math.trunc((n << 7) / f.rampOut), 'fade ramp-out')
    } else {
      f.intensity = 0 // 0x6fb0300f
    }
    f.tick = k + 1
    if (f.tick > f.end || player.levelId !== f.levelId) this.clearFade() // 0x6fb0303d-5f
  }

  private clearFade(): void {
    Object.assign(this.fade, emptyFade())
  }
}

/**
 * Ambient light of a room of level `levelId` as the light grid prefill 0x6fb59c90 reads it
 * (`CLIENT_GetAmbientLight` with `bSpecial` = 1): steps 1–3 from `fx`, else steps 4–5.
 */
export function resolveRoomAmbient(
  levelId: number,
  env: Pick<Environment, 'intensity' | 'red' | 'green' | 'blue'>,
  fx: QuestFxLight,
): AmbientLight {
  return fx.special(levelId) ?? resolveLevelAmbient(levelId, env)
}
