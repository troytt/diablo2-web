/**
 * [K6] Fix 1 — Real-DLL D2Game.dll Kernel Parity Unlock Suite (47 net-new VAs, 151 real-DLL vectors).
 *
 * Replays every real-DLL vector emitted by tools/oracle/k6-fix1/k6-fix1-d2game-emitter.c
 * against the fixed TypeScript v1.13c kernel in src/d2kern-113c/game/*, verifying 100%
 * bit-exact agreement on return values, Fog.#10024 assertion line numbers, staged arena
 * memory mutations (S2C client packet buffers, timer wheels, statlists, paths, quest
 * records, combat damage structs, animation frame/speed fields), heap allocations, and
 * va-trace-113c runtime hits across all 9 parity-fix unlock groups.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers'
import '../../../src/d2kern-113c/game/ai-fallen-113c'
import {
  NET_QueuePacketToClientBuffer113c,
  NET_SendFixed40BytePacketToClient113c,
} from '../../../src/d2kern-113c/game/boot-init-gap-a-113c'
import { bindK2KernelGlobals113c } from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c'
import {
  CLIENT_BroadcastPlayerLeftPacket5C_6FC4BED0_113c,
  OBJECTS_InitFn10_InitRogueFireAndScheduleEvent_6FC53740_113c,
  OBJECTS_InitFn14_SetAnimMode1_6FC4E740_113c,
  OBJECTS_InitFn23_SyncQuest0FObjectAnimMode_6FC54370_113c,
  OBJECTS_InitFn26_SetAnimMode1_6FC4E730_113c,
  OBJECTS_InitFn34_RandomSetAnimMode1_6FC4EC70_113c,
  QUESTS_AppendQuestTimer_6FC53AF0_113c,
} from '../../../src/d2kern-113c/game/k2-laneJ-0x6fc4-w1-113c'
import {
  SKILLS_OnCurseExpireResetAlignmentA_6FC6EB90_113c,
  SKILLS_OnCurseExpireResetAlignmentB_6FC6EBE0_113c,
} from '../../../src/d2kern-113c/game/k2-laneL-0x6fc6-w1-113c'
import {
  ACT5Q6_InitWorldstoneChamberObject94_6FC76520_113c,
  ACT5Q6_InitWorldstoneChamberObject9C_6FC764D0_113c,
} from '../../../src/d2kern-113c/game/k2-laneM-0x6fc7-w1-113c'
import {
  SUNITDMG_AddPlayerExperienceAndCheckLevelUp113c,
  SUNITDMG_ApplySideEffectsAndKill113c,
} from '../../../src/d2kern-113c/game/k2-real-s2c-combat-113c'
import {
  OBJECTS_InitOperatingObjectWithTimer25_6FC88F90_113c,
  OBJECTS_OperateToggleObjectMode012_6FC89A80_113c,
} from '../../../src/d2kern-113c/game/k2-w2b2-113c'
import {
  MONMODE_EnterAnimMode10_6FC94C90_113c,
  MONMODE_EnterAnimMode6_6FC94C10_113c,
  MONMODE_EnterMode11AndScheduleEndAnim15_6FC96700_113c,
  OBJ_ResetSubClassBit0ObjectToNeutral_6FC89D60_113c,
  OBJ_ToggleNeutralAndOperatingMode_6FC89AD0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b3-113c'
import {
  ACT4Q3_ActivateHarrogathWaypointForPlayer_6FCD9030_113c,
  SKILLS_SrvSt_AllocZeroDamageCombatForTarget_6FCD3EB0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b6-113c'
import {
  PACKET_Srv53_TurnOnWalkToRun_6FCEB450_113c,
  PACKET_Srv54_TurnOffRunToWalk_6FCEB420_113c,
} from '../../../src/d2kern-113c/game/k2-w2b7-113c'
import { SUNIT_FreeCombatListAndChangeAnimMode_6FCFF980_113c } from '../../../src/d2kern-113c/game/k2-w2b8-113c'
import { NET_SendPacket26_ChatMessage_6FCAB470_113c } from '../../../src/d2kern-113c/game/k2-w4b4-113c'
import {
  NET_SendPacket21_UpdateUnitSkill_6FCAD5F0_113c,
  NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c,
  NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c,
} from '../../../src/d2kern-113c/game/k2-w4b5-113c'
import {
  ITEMMODS_ApplyAttackerTakesFireDamage_6FCCD7B0_113c,
  ITEMMODS_ApplyAttackerTakesLightningDamage_6FCCD860_113c,
  MONAI_NestOrMeleeWanderThink_6FCC5B30_113c,
} from '../../../src/d2kern-113c/game/k2-w4b7-113c'
import { NET_SendChatMessagePacket26Wrapper_6FCEB580_113c } from '../../../src/d2kern-113c/game/k2-w5b5-113c'
import { NET_SendPacket5A_PartyRelationEvent_6FD10720_113c } from '../../../src/d2kern-113c/game/k2-w5b9-113c'
import {
  PARTY_InvitePlayerToParty_6FD10870_113c,
  PARTY_SyncJoinedPartyRelationsCallback_6FD10B90_113c,
  PARTY_UpdateMuteFlag02AndSyncRoster_6FD10EE0_113c,
  PARTY_UpdateRelationFlagAndSyncRoster_6FD10C60_113c,
  PARTY_UpdateSquelchFlag04AndSyncRoster_6FD10E80_113c,
} from '../../../src/d2kern-113c/game/k2-w6b7-113c'
import {
  PARTY_DeclareHostility_6FD10CD0_113c,
  SUNITDMG_GrantExpToPlayerOrHireling_6FCFE870_113c,
} from '../../../src/d2kern-113c/game/k2-w7b4-113c'
import {
  PARTY_AcceptInviteAndSyncParty_6FD10D50_113c,
  PARTY_DeclareHostilityBetweenPlayers_6FD10FF0_113c,
} from '../../../src/d2kern-113c/game/k2-w8b4-113c'
import { MONSTER_StartNeutral113c } from '../../../src/d2kern-113c/game/monster-events'
import { SUNIT_SetMonsterAlignmentState113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c'
import { parseVectorHeader } from '../../../tools/oracle/vectors/vector-format'

type DispatchFn = (m: SparseMemory113c, a: readonly number[]) => unknown

const DISPATCH_BY_VA: Record<string, DispatchFn> = {
  // Group 1 — Bug 1: 0x5A bColor offset (+0x02)
  '0x6FD10720': (m, a) => NET_SendPacket5A_PartyRelationEvent_6FD10720_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD10CD0': (m, a) => PARTY_DeclareHostility_6FD10CD0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD10870': (m, a) => PARTY_InvitePlayerToParty_6FD10870_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD10B90': (m, a) => PARTY_SyncJoinedPartyRelationsCallback_6FD10B90_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD10FF0': (m, a) => PARTY_DeclareHostilityBetweenPlayers_6FD10FF0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD10D50': (m, a) => PARTY_AcceptInviteAndSyncParty_6FD10D50_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),

  // Group 2 — Bug 2: stack-allocated local/packet scratch (zero heapTop drift)
  '0x6FD10C60': (m, a) => PARTY_UpdateRelationFlagAndSyncRoster_6FD10C60_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD10E80': (m, a) => PARTY_UpdateSquelchFlag04AndSyncRoster_6FD10E80_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD10EE0': (m, a) => PARTY_UpdateMuteFlag02AndSyncRoster_6FD10EE0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCD9030': (m, a) => ACT4Q3_ActivateHarrogathWaypointForPlayer_6FCD9030_113c(m, a[0]!, a[1]!),
  '0x6FCD3EB0': (m, a) => SKILLS_SrvSt_AllocZeroDamageCombatForTarget_6FCD3EB0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCAD120': (m, a) => NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c(m, a[0]!, a[1]!),
  '0x6FCAD570': (m, a) => NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCAD5F0': (m, a) => NET_SendPacket21_UpdateUnitSkill_6FCAD5F0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),

  // Group 3 — Bug 3: 0x6FCAA3E0 returns nPacketSize + zeroes recycled 0x208 nodes
  '0x6FCEB580': (m, a) => NET_SendChatMessagePacket26Wrapper_6FCEB580_113c(m, a[0]!, a[1]!),
  '0x6FCAA3E0': (m, a) => NET_QueuePacketToClientBuffer113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCAB400': (m, a) => NET_SendFixed40BytePacketToClient113c(m, a[0]!, a[1]!),
  '0x6FCAB470': (m, a) => NET_SendPacket26_ChatMessage_6FCAB470_113c(m, a[0]!, a[1]!),

  // Group 4 — Bug 4: 0x6FCFCF20 calls 0x6FCCF710(pDefender, 0x13) + single-call thorns
  '0x6FCCD7B0': (m, a) => ITEMMODS_ApplyAttackerTakesFireDamage_6FCCD7B0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCCD860': (m, a) => ITEMMODS_ApplyAttackerTakesLightningDamage_6FCCD860_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCFCF20': (m, a) => SUNITDMG_ApplySideEffectsAndKill113c(m, a[0]!, a[1]!, a[2]!, a[3]!),

  // Group 5 — Bug 5: 0x6FCFE6D0 STAT_LASTEXP (0x1D) + STAT_NEXTEXP (0x1E) + level-up parity
  '0x6FCFE870': (m, a) => SUNITDMG_GrantExpToPlayerOrHireling_6FCFE870_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCFE6D0': (m, a) =>
    SUNITDMG_AddPlayerExperienceAndCheckLevelUp113c(m, a[0]!, a[1]!, a[2]!, false, a[3]!),

  // Group 6 — Bug 6: 0x6FD00460 without synthetic pStatListEx+0x10 flag drift
  '0x6FC6EB90': (m, a) => SKILLS_OnCurseExpireResetAlignmentA_6FC6EB90_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC6EBE0': (m, a) => SKILLS_OnCurseExpireResetAlignmentB_6FC6EBE0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD00460': (m, a) => SUNIT_SetMonsterAlignmentState113c(m, a[0]!, a[1]!, a[2]!),

  // Group 7 — Bug 7: 0x6FC94E60 null pMonData/pMonStatsTxt early return without EV2
  '0x6FC94E60': (m, a) => MONSTER_StartNeutral113c(m, a[0]!, a[1]!),

  // Group 8 — Bug 8: D2CommonAssertError parity + 0x6FCC5B30 AI handler
  '0x6FC4BED0': (m, a) => CLIENT_BroadcastPlayerLeftPacket5C_6FC4BED0_113c(m, a[0]!, a[1]!),
  '0x6FC54370': (m, a) => OBJECTS_InitFn23_SyncQuest0FObjectAnimMode_6FC54370_113c(m, a[0]!),
  '0x6FC53AF0': (m, a) => QUESTS_AppendQuestTimer_6FC53AF0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC5B30': (m, a) => MONAI_NestOrMeleeWanderThink_6FCC5B30_113c(m, a[0]!, a[1]!, a[2]!),

  // Group 9 — Bug 9: D2Common.#11090 (0x6FD83920) UNITS_ChangeAnimMode anim frame/speed parity
  '0x6FCFF980': (m, a) => SUNIT_FreeCombatListAndChangeAnimMode_6FCFF980_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCEB420': (m, a) => PACKET_Srv54_TurnOffRunToWalk_6FCEB420_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEB450': (m, a) => PACKET_Srv53_TurnOnWalkToRun_6FCEB450_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC4E730': (m, a) => OBJECTS_InitFn26_SetAnimMode1_6FC4E730_113c(m, a[0]!),
  '0x6FC4E740': (m, a) => OBJECTS_InitFn14_SetAnimMode1_6FC4E740_113c(m, a[0]!),
  '0x6FC88F90': (m, a) => OBJECTS_InitOperatingObjectWithTimer25_6FC88F90_113c(m, a[0]!),
  '0x6FC89D60': (m, a) => OBJ_ResetSubClassBit0ObjectToNeutral_6FC89D60_113c(m, a[0]!, a[1]!),
  '0x6FC89AD0': (m, a) => OBJ_ToggleNeutralAndOperatingMode_6FC89AD0_113c(m, a[0]!),
  '0x6FC4EC70': (m, a) => OBJECTS_InitFn34_RandomSetAnimMode1_6FC4EC70_113c(m, a[0]!),
  '0x6FC89A80': (m, a) => OBJECTS_OperateToggleObjectMode012_6FC89A80_113c(m, a[0]!),
  '0x6FC53740': (m, a) => OBJECTS_InitFn10_InitRogueFireAndScheduleEvent_6FC53740_113c(m, a[0]!),
  '0x6FC94C10': (m, a) => MONMODE_EnterAnimMode6_6FC94C10_113c(m, a[0]!, a[1]!),
  '0x6FC94C90': (m, a) => MONMODE_EnterAnimMode10_6FC94C90_113c(m, a[0]!, a[1]!),
  '0x6FC96700': (m, a) => MONMODE_EnterMode11AndScheduleEndAnim15_6FC96700_113c(m, a[0]!, a[1]!),
  '0x6FC764D0': (m, a) => ACT5Q6_InitWorldstoneChamberObject9C_6FC764D0_113c(m, a[0]!),
  '0x6FC76520': (m, a) => ACT5Q6_InitWorldstoneChamberObject94_6FC76520_113c(m, a[0]!),
}

const STAGE_BASE = 0x30000000
const STAGE_FIXED_SIZE = 0x00009000
const STAGE_SETUP_BASE = 0x30020000
const HEAP_BASE = 0x40000000
const PAGE_BITS = 12
const PAGE_SIZE = 1 << PAGE_BITS

interface MemRunRecord {
  readonly addr: string
  readonly hex: string
}

interface K6Fix1VectorRecord {
  readonly va: string
  readonly name: string
  readonly caseIdx: number
  readonly label: string
  readonly tsArgs: readonly number[]
  readonly retMask: string
  readonly asserted: boolean
  readonly assertLine: number
  readonly ret: string
  readonly setupTop: string
  readonly preMem: readonly MemRunRecord[]
  readonly postMem: readonly MemRunRecord[]
  readonly heapTop: string
  readonly heapHex: string
}

class CoWSparseMemory113c extends SparseMemory113c {
  private readonly basePages = new Map<number, Uint8Array>()
  private readonly baseKnown = new Map<number, Uint8Array>()
  private readonly overlayPages = new Map<number, Uint8Array>()
  private readonly overlayKnown = new Map<number, Uint8Array>()
  private heapCursor = HEAP_BASE

  commitOverlayToBase(): void {
    for (const [pg, data] of this.overlayPages.entries()) {
      this.basePages.set(pg, data)
      this.baseKnown.set(pg, this.overlayKnown.get(pg)!)
    }
    this.overlayPages.clear()
    this.overlayKnown.clear()
    this.heapCursor = HEAP_BASE
  }

  resetOverlay(): void {
    this.overlayPages.clear()
    this.overlayKnown.clear()
    this.heapCursor = HEAP_BASE
  }

  getHeapTop(): number {
    return this.heapCursor >>> 0
  }

  override alloc(size: number): number {
    const p = ((this.heapCursor + 3) & ~3) >>> 0
    this.fill(p, size, 0)
    this.heapCursor = (p + size) >>> 0
    return p
  }

  override loadBlock(addr: number, data: Uint8Array): void {
    for (let i = 0; i < data.length; i++) {
      this.setU8((addr + i) >>> 0, data[i]!)
    }
  }

  override readBytes(addr: number, len: number): Uint8Array {
    const out = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      out[i] = this.u8((addr + i) >>> 0)
    }
    return out
  }

  override u8(p: number): number {
    const addr = p >>> 0
    const pg = addr >>> PAGE_BITS
    const off = addr & (PAGE_SIZE - 1)
    const ok = this.overlayKnown.get(pg)
    if (ok !== undefined && ok[off] !== 0) {
      return this.overlayPages.get(pg)![off]!
    }
    const bk = this.baseKnown.get(pg)
    if (bk !== undefined && bk[off] !== 0) {
      return this.basePages.get(pg)![off]!
    }
    throw new Error(`CoWSparseMemory113c: read of unloaded byte 0x${addr.toString(16)}`)
  }

  override u16(p: number): number {
    return this.u8(p) | (this.u8((p + 1) >>> 0) << 8)
  }

  override u32(p: number): number {
    return (this.u16(p) | (this.u16((p + 2) >>> 0) << 16)) >>> 0
  }

  override setU8(p: number, v: number): void {
    const addr = p >>> 0
    const pg = addr >>> PAGE_BITS
    const off = addr & (PAGE_SIZE - 1)
    let od = this.overlayPages.get(pg)
    let ok = this.overlayKnown.get(pg)
    if (od === undefined || ok === undefined) {
      const bd = this.basePages.get(pg)
      const bk = this.baseKnown.get(pg)
      od = bd !== undefined ? bd.slice() : new Uint8Array(PAGE_SIZE)
      ok = bk !== undefined ? bk.slice() : new Uint8Array(PAGE_SIZE)
      this.overlayPages.set(pg, od)
      this.overlayKnown.set(pg, ok)
    }
    od[off] = v & 0xff
    ok[off] = 1
  }

  override setU16(p: number, v: number): void {
    this.setU8(p, v & 0xff)
    this.setU8((p + 1) >>> 0, (v >>> 8) & 0xff)
  }

  override setU32(p: number, v: number): void {
    this.setU16(p, v & 0xffff)
    this.setU16((p + 2) >>> 0, (v >>> 16) & 0xffff)
  }

  override fill(p: number, len: number, v: number): void {
    const byte = v & 0xff
    for (let i = 0; i < len; i++) {
      this.setU8((p + i) >>> 0, byte)
    }
  }

  override get(base: number, f: FieldLayout113c, index = 0): number {
    if (base === 0) throw new Error('CoWSparseMemory113c: NULL base')
    if (index < 0 || index >= f.count) {
      throw new Error(`CoWSparseMemory113c: index ${index} outside 0..${f.count - 1}`)
    }
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    const p = (base + f.off + index * width) >>> 0
    return width === 1 ? this.u8(p) : width === 2 ? this.u16(p) : this.u32(p)
  }

  override set(base: number, f: FieldLayout113c, v: number, index = 0): void {
    if (base === 0) throw new Error('CoWSparseMemory113c: NULL base')
    if (index < 0 || index >= f.count) {
      throw new Error(`CoWSparseMemory113c: index ${index} outside 0..${f.count - 1}`)
    }
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    const p = (base + f.off + index * width) >>> 0
    if (width === 1) this.setU8(p, v)
    else if (width === 2) this.setU16(p, v)
    else this.setU32(p, v)
  }
}

const HEX_CHARS = '0123456789abcdef'

function hexToBytes(hex: string): Uint8Array {
  const n = hex.length >>> 1
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!
    out += HEX_CHARS[(b >>> 4) & 0x0f]! + HEX_CHARS[b & 0x0f]!
  }
  return out
}

function extractMemRunsRange(
  mem: CoWSparseMemory113c,
  startAddr: number,
  endAddr: number,
  out: MemRunRecord[],
): void {
  let a = startAddr >>> 0
  const end = endAddr >>> 0
  while (a < end) {
    const chunkEnd = a + 16 <= end ? a + 16 : end
    let nz = false
    for (let k = a; k < chunkEnd; k++) {
      if (mem.u8(k) !== 0) {
        nz = true
        break
      }
    }
    if (!nz) {
      a = chunkEnd
      continue
    }
    const runStart = a
    let runEnd = chunkEnd
    while (runEnd < end && runEnd - runStart < 512) {
      const nextEnd = runEnd + 16 <= end ? runEnd + 16 : end
      let nextNz = false
      for (let k = runEnd; k < nextEnd; k++) {
        if (mem.u8(k) !== 0) {
          nextNz = true
          break
        }
      }
      if (!nextNz) break
      runEnd = nextEnd
    }
    const addrHex = `0x${runStart.toString(16).toUpperCase().padStart(8, '0')}`
    const hex = bytesToHex(mem.readBytes(runStart, runEnd - runStart))
    out.push({ addr: addrHex, hex })
    a = runEnd
  }
}

function extractStageRuns(mem: CoWSparseMemory113c, setupTop: number): MemRunRecord[] {
  const out: MemRunRecord[] = []
  extractMemRunsRange(mem, STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE, out)
  if (setupTop > STAGE_SETUP_BASE) {
    extractMemRunsRange(mem, STAGE_SETUP_BASE, setupTop, out)
  }
  return out
}

function loadVectors(): K6Fix1VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-fix1/k6-fix1-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6Fix1VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6Fix1VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6] Fix 1 real-DLL D2Game.dll kernel parity unlock vectors (47 net-new VAs)', () => {
  let mem: CoWSparseMemory113c

  beforeAll(() => {
    const imgPath = resolve(
      import.meta.dirname,
      '../../fixtures/oracle/k1/d2game-datatbls-113c.img.gz',
    )
    const raw = gunzipSync(readFileSync(imgPath))
    const hdr = parseVectorHeader(raw)
    expect(hdr.kind).toBe('PAGEIMG')
    expect(hdr.recordSize).toBe(4100)

    mem = new CoWSparseMemory113c()
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
    let off = 32
    for (let i = 0; i < hdr.recordCount; i++) {
      const va = view.getUint32(off, true) >>> 0
      mem.loadBlock(va, raw.subarray(off + 4, off + 4 + 4096))
      off += 4100
    }
    bindK2KernelGlobals113c(mem)
    mem.fill(STAGE_BASE, STAGE_FIXED_SIZE, 0)
    mem.commitOverlayToBase()
  })

  it('covers 47 net-new unlocked real-DLL D2Game.dll VAs (>= 3 cases each)', () => {
    expect(VECTORS_BY_VA.size).toBe(47)
    expect(Object.keys(DISPATCH_BY_VA).length).toBe(47)
    expect(ALL_VECTORS.length).toBeGreaterThanOrEqual(141)
    for (const [va, cases] of VECTORS_BY_VA.entries()) {
      const num = Number.parseInt(va, 16) >>> 0
      expect(num).toBeGreaterThanOrEqual(0x6fc20000)
      expect(num).toBeLessThanOrEqual(0x6fd1ffff)
      expect(cases.length).toBeGreaterThanOrEqual(3)
      expect(DISPATCH_BY_VA[va]).toBeTypeOf('function')
    }
  })

  for (const [va, cases] of VECTORS_BY_VA.entries()) {
    const fnName = cases[0]!.name
    it(`${va} ${fnName} (${cases.length} real-DLL cases)`, () => {
      const fn = DISPATCH_BY_VA[va]
      expect(fn).toBeDefined()

      for (const vec of cases) {
        mem.resetOverlay()
        const setupTop = Number.parseInt(vec.setupTop, 16) >>> 0
        if (setupTop > STAGE_SETUP_BASE) {
          mem.fill(STAGE_SETUP_BASE, setupTop - STAGE_SETUP_BASE, 0)
        }
        for (const blk of vec.preMem) {
          const addr = Number.parseInt(blk.addr, 16) >>> 0
          mem.loadBlock(addr, hexToBytes(blk.hex))
        }

        beginVaTrace113c()
        let retVal: unknown = 0
        let caughtErr: unknown = null
        try {
          retVal = fn!(mem, vec.tsArgs)
        } catch (err) {
          caughtErr = err
        }
        const hits = endVaTrace113c()
        expect(
          hits.has(`D2Game:${va}`),
          `${va} case ${vec.caseIdx} (${vec.label}) missing va-trace hit D2Game:${va}`,
        ).toBe(true)

        if (vec.asserted) {
          expect(
            caughtErr,
            `${va} case ${vec.caseIdx} (${vec.label}) expected D2CommonAssertError(${vec.assertLine})`,
          ).toBeInstanceOf(D2CommonAssertError)
          expect((caughtErr as D2CommonAssertError).line).toBe(vec.assertLine)
          continue
        }

        if (caughtErr !== null) {
          throw new Error(
            `${va} case ${vec.caseIdx} (${vec.label}) threw unexpected error: ${String(caughtErr)}`,
          )
        }

        const retMask = Number.parseInt(vec.retMask, 16) >>> 0
        if (retMask !== 0) {
          const actualMasked = ((Number(retVal) | 0) & retMask) >>> 0
          const expectedMasked = Number.parseInt(vec.ret, 16) >>> 0
          expect(
            actualMasked,
            `${va} case ${vec.caseIdx} (${vec.label}) return mismatch: got 0x${actualMasked.toString(16)} expected 0x${expectedMasked.toString(16)}`,
          ).toBe(expectedMasked)
        }

        const actualPostMem = extractStageRuns(mem, setupTop)
        expect(
          actualPostMem,
          `${va} case ${vec.caseIdx} (${vec.label}) staged arena memory mismatch`,
        ).toEqual(vec.postMem)

        if (vec.heapHex.length > 0) {
          const expectedHeapTop = Number.parseInt(vec.heapTop, 16) >>> 0
          expect(
            mem.getHeapTop(),
            `${va} case ${vec.caseIdx} (${vec.label}) heapTop mismatch`,
          ).toBe(expectedHeapTop)
          const actualHeapHex = bytesToHex(mem.readBytes(HEAP_BASE, expectedHeapTop - HEAP_BASE))
          expect(
            actualHeapHex,
            `${va} case ${vec.caseIdx} (${vec.label}) heap contents mismatch`,
          ).toBe(vec.heapHex)
        } else {
          expect(
            mem.getHeapTop(),
            `${va} case ${vec.caseIdx} (${vec.label}) unexpected heap allocation (expected zero heap drift)`,
          ).toBe(HEAP_BASE)
        }
      }
    })
  }
})
