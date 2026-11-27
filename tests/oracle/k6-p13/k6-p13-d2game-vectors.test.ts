/**
 * [K6-P13] Real-DLL D2Game.dll Band C (0x6FCB0000..0x6FCDFFFF) Closure Parity Vector Suite.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers'
import {
  ACT3Q1_Callback03_LevelChanged113c,
  MONSTER_DestroyMonsterUnit113c,
} from '../../../src/d2kern-113c/game/a1c-post150-f150-f276-113c'
import {
  PARTY_CountLivingPartyMemberCallback113c,
  PARTY_ForEachPartyMemberInSameLevel113c,
  SKILLS_StartUsedSkill113c,
} from '../../../src/d2kern-113c/game/a1c-post150-f786-f1040-113c'
import { ROOM_ActivateRoomForClient113c } from '../../../src/d2kern-113c/game/act-rooms-113c'
import { AI_CheckApproachTauntSound113c } from '../../../src/d2kern-113c/game/ai-fallen-113c'
import {
  D2GAME_MONSTER_ApplyMercStatsOnOwner113c,
  D2GAME_SUMMON_BroadcastPlayerPetsToClient113c,
} from '../../../src/d2kern-113c/game/boot-init-gap-b-113c'
import { bindK2KernelGlobals113c } from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c'
import {
  ITEMEVENT_AttackerTakesDamage113c,
  ITEMEVENT_ChanceToCastSkill113c,
  SKILLS_Event08_AuraPulseTick113c,
} from '../../../src/d2kern-113c/game/k2-gap-itemdef-113c'
import { ACT_WarpClientPlayerToActTown_6FCBDF40_113c } from '../../../src/d2kern-113c/game/k2-w11b1-113c'
import { PLAYER_ChangeLevelOrActTransition_6FCBE170_113c } from '../../../src/d2kern-113c/game/k2-w12b1-113c'
import {
  D2Game_6FCC3610_113c,
  D2Game_6FCDE2A0_113c,
  D2Game_6FCDE640_113c,
  D2Game_6FCDEE30_113c,
  D2Game_6FCDF990_113c,
} from '../../../src/d2kern-113c/game/k2-w13b1-113c'
import {
  NPCTRADE_EnsureVendorInventoryGenerated_6FCDF1C0_113c,
  NPCTRADE_PopulateVendorItemsFromTable_6FCDF2E0_113c,
  SKILLS_SrvDo_Valkyrie_6FCB5980_113c,
} from '../../../src/d2kern-113c/game/k2-w14b1-113c'
import {
  PETS_ForEachPlayerPetUnit_6FCB6AF0_113c,
  SKILLS_SrvDo_SpawnChargedMissileAtTargetUnit_6FCB93A0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b5-113c'
import {
  SKILLS_DispatchStateOnSrvDoFuncForSkill_6FCBE8E0_113c,
  SKILLS_ResetAttackerCombatAndStartWeaponOrMonsterAttack_6FCC2DE0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b6-113c'
import {
  MONAI_EvaluateTargetCandidateCallback_6FCD1660_113c,
  MONAI_ForEachUnitInAdjacentRooms_6FCD0720_113c,
  MONAI_ForEachUnitInNonTownAdjacentRoomsWithPlayer_6FCD0CE0_113c,
  MONAI_PutridDefilerThink_6FCC7290_113c,
} from '../../../src/d2kern-113c/game/k2-w4b7-113c'
import {
  PETS_KillOrUnsummonPetByGuid_6FCB77E0_113c,
  SKILLS_SrvDo_SpawnLeapOrChargeProjectile_6FCB94C0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b2-113c'
import { AURA_ForEachUnitInTargetRadius_6FCC0AD0_113c } from '../../../src/d2kern-113c/game/k2-w5b3-113c'
import {
  AIBAAL_TrySpawnBaalClone_6FCD7D30_113c,
  SKILLS_SpawnNovaRingOfSpiralProjectiles_6FCB3D60_113c,
} from '../../../src/d2kern-113c/game/k2-w5b6-113c'
import {
  PETS_CleanupOrMarkDeadPetSlot_6FCB7420_113c,
  PETS_RemovePetFromSlotByGuid_6FCB7920_113c,
  SKILLS_SrvDo_SpawnChargeScaledScatteredProjectiles_6FCB4DC0_113c,
} from '../../../src/d2kern-113c/game/k2-w6b2-113c'
import {
  NPCS_CainIdentifyAllItems_6FCDDB10_113c,
  PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c,
  SKILLS_SrvDo_ExecuteMultiStrikeMelee_6FCB9D20_113c,
  SKILLS_SrvDo_SpawnChargedSpiralNova_6FCB4E60_113c,
} from '../../../src/d2kern-113c/game/k2-w6b5-113c'
import { PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c } from '../../../src/d2kern-113c/game/k2-w7b3-113c'
import {
  PETS_UnsummonPetsBeyondDistanceSq_6FCB6C00_113c,
  PETS_UnsummonSameGroupPetTypes_6FCB7C20_113c,
} from '../../../src/d2kern-113c/game/k2-w8b2-113c'
import { AI_RunMonsterAI113c } from '../../../src/d2kern-113c/game/monster-events'
import { MONSTER_EquipMonEquipItems113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c'
import {
  AI_AcquireOrValidateCombatTarget113c,
  AI_FollowPackLeaderOrAttack113c,
  AI_TryOpenNearbyClosedDoor113c,
} from '../../../src/d2kern-113c/game/town-runtime-gap-113c'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c'
import { parseVectorHeader } from '../../../tools/oracle/vectors/vector-format'

type DispatchFn = (m: CoWSparseMemory113c, a: readonly number[]) => unknown

const EXPECTED_VA_COUNT = 48

const DISPATCH_BY_VA: Record<string, DispatchFn> = {
  '0x6FCB2ED0': (m, a) => MONSTER_EquipMonEquipItems113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FCB3D60': (m, a) => SKILLS_SpawnNovaRingOfSpiralProjectiles_6FCB3D60_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!),
  '0x6FCB4DC0': (m, a) => SKILLS_SrvDo_SpawnChargeScaledScatteredProjectiles_6FCB4DC0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB4E60': (m, a) => SKILLS_SrvDo_SpawnChargedSpiralNova_6FCB4E60_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB5980': (m, a) => SKILLS_SrvDo_Valkyrie_6FCB5980_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB6920': (m, a) => D2GAME_SUMMON_BroadcastPlayerPetsToClient113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCB6AF0': (m, a) => PETS_ForEachPlayerPetUnit_6FCB6AF0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB6C00': (m, a) => PETS_UnsummonPetsBeyondDistanceSq_6FCB6C00_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB7420': (m, a) => PETS_CleanupOrMarkDeadPetSlot_6FCB7420_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCB77E0': (m, a) => PETS_KillOrUnsummonPetByGuid_6FCB77E0_113c(m, a[0]!, a[1]!),
  '0x6FCB7920': (m, a) => PETS_RemovePetFromSlotByGuid_6FCB7920_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB7B50': (m, a) => PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB7C20': (m, a) => PETS_UnsummonSameGroupPetTypes_6FCB7C20_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCB93A0': (m, a) => SKILLS_SrvDo_SpawnChargedMissileAtTargetUnit_6FCB93A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB94C0': (m, a) => SKILLS_SrvDo_SpawnLeapOrChargeProjectile_6FCB94C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB9D20': (m, a) => SKILLS_SrvDo_ExecuteMultiStrikeMelee_6FCB9D20_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCBC070': (m, a) => {
    const cb = a[2]! >>> 0
    if (cb !== 0x6fcbc000) throw new Error(`0x6FCBC070 unexpected callback VA 0x${cb.toString(16)}`)
    return PARTY_ForEachPartyMemberInSameLevel113c(m, a[0]!, a[1]!, PARTY_CountLivingPartyMemberCallback113c, a[3]!)
  },
  '0x6FCBCA60': (m, a) => AI_CheckApproachTauntSound113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCBCB30': (m, a) => AI_FollowPackLeaderOrAttack113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCBCCF0': (m, a) => AI_TryOpenNearbyClosedDoor113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCBCFE0': (m, a) => AI_AcquireOrValidateCombatTarget113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCBD3B0': (m, a) => AI_RunMonsterAI113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCBDC10': (m, a) => ROOM_ActivateRoomForClient113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCBDF40': (m, a) => ACT_WarpClientPlayerToActTown_6FCBDF40_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCBE170': (m, a) => PLAYER_ChangeLevelOrActTransition_6FCBE170_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCBE8E0': (m, a) => SKILLS_DispatchStateOnSrvDoFuncForSkill_6FCBE8E0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCBF2B0': (m, a) => D2GAME_MONSTER_ApplyMercStatsOnOwner113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC0830': (m, a) => SKILLS_StartUsedSkill113c(m, a[0]!, a[1]!),
  '0x6FCC0AD0': (m, a) => AURA_ForEachUnitInTargetRadius_6FCC0AD0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FCC1E80': (m, a) => SKILLS_Event08_AuraPulseTick113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCC22E0': (m, a) => PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCC2DE0': (m, a) => SKILLS_ResetAttackerCombatAndStartWeaponOrMonsterAttack_6FCC2DE0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC3610': (m, a) => D2Game_6FCC3610_113c(m, a[0]!, a[1]!),
  '0x6FCC7290': (m, a) => MONAI_PutridDefilerThink_6FCC7290_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCCD910': (m, a) => ITEMEVENT_AttackerTakesDamage113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FCCDCE0': (m, a) => ITEMEVENT_ChanceToCastSkill113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCCFB90': (m, a) => MONSTER_DestroyMonsterUnit113c(m, a[0]!, a[1]!),
  '0x6FCD0720': (m, a) => {
    const cb = a[1]! >>> 0
    if (cb === 0) return MONAI_ForEachUnitInAdjacentRooms_6FCD0720_113c(m, a[0]!, 0, a[2]!, a[3]!)
    if (cb !== 0x6fcd1660) throw new Error(`0x6FCD0720 unexpected callback VA 0x${cb.toString(16)}`)
    return MONAI_ForEachUnitInAdjacentRooms_6FCD0720_113c(
      m,
      a[0]!,
      cb,
      a[2]!,
      a[3]!,
      (mem, pg, pOrig, pCand, pCtx) => MONAI_EvaluateTargetCandidateCallback_6FCD1660_113c(mem, pg, pOrig, pCand, pCtx),
    )
  },
  '0x6FCD0CE0': (m, a) => {
    const cb = a[1]! >>> 0
    if (cb !== 0x6fcd1660) throw new Error(`0x6FCD0CE0 unexpected callback VA 0x${cb.toString(16)}`)
    return MONAI_ForEachUnitInNonTownAdjacentRoomsWithPlayer_6FCD0CE0_113c(
      m,
      a[0]!,
      cb,
      a[2]!,
      a[3]!,
      (mem, pg, pOrig, pCand, pCtx) => MONAI_EvaluateTargetCandidateCallback_6FCD1660_113c(mem, pg, pOrig, pCand, pCtx),
    )
  },
  '0x6FCD7D30': (m, a) => AIBAAL_TrySpawnBaalClone_6FCD7D30_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCDA1E0': (m, a) => ACT3Q1_Callback03_LevelChanged113c(m, a[0]!, a[1]!),
  '0x6FCDDB10': (m, a) => NPCS_CainIdentifyAllItems_6FCDDB10_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCDE2A0': (m, a) => D2Game_6FCDE2A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCDE640': (m, a) => D2Game_6FCDE640_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FCDEE30': (m, a) => D2Game_6FCDEE30_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FCDF1C0': (m, a) => NPCTRADE_EnsureVendorInventoryGenerated_6FCDF1C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCDF2E0': (m, a) => NPCTRADE_PopulateVendorItemsFromTable_6FCDF2E0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCDF990': (m, a) => D2Game_6FCDF990_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
}

interface MemRunRecord {
  addr: string
  hex: string
}

interface ExtraCapRecord {
  addr: string
  len: number
}

interface K6P13VectorRecord {
  va: string
  name: string
  caseIdx: number
  label: string
  tsArgs: number[]
  extraCaps: ExtraCapRecord[]
  retMask: string
  asserted: boolean
  assertLine: number
  ret: string
  setupTop: string
  preMem: MemRunRecord[]
  postMem: MemRunRecord[]
  heapTop: string
  heapHex: string
}

const STAGE_BASE = 0x30000000
const STAGE_FIXED_SIZE = 0x00009000
const STAGE_CS_GAME = 0x30010000
const STAGE_SETUP_BASE = 0x30020000
const HEAP_BASE = 0x40000000
const PAGE_BITS = 12
const PAGE_SIZE = 1 << PAGE_BITS

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
    const effSize = size === 0 ? 4 : size
    const p = ((this.heapCursor + 3) & ~3) >>> 0
    if (p > this.heapCursor) {
      this.fill(this.heapCursor, p - this.heapCursor, 0)
    }
    this.fill(p, effSize, 0)
    this.heapCursor = (p + effSize) >>> 0
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
    let anyNz = false
    for (let i = 0; i < 16 && a + i < end; i++) {
      if (mem.u8((a + i) >>> 0) !== 0) {
        anyNz = true
        break
      }
    }
    if (!anyNz) {
      a += 16
      continue
    }
    const runStart = a
    while (a < end && (a - runStart) < 512) {
      let chunkNz = false
      for (let i = 0; i < 16 && a + i < end; i++) {
        if (mem.u8((a + i) >>> 0) !== 0) {
          chunkNz = true
          break
        }
      }
      if (!chunkNz) break
      a += 16
    }
    const runEnd = a < end ? a : end
    const len = runEnd - runStart
    out.push({
      addr: `0x${runStart.toString(16).toUpperCase().padStart(8, '0')}`,
      hex: bytesToHex(mem.readBytes(runStart, len)),
    })
  }
}

function extractStageRuns(
  mem: CoWSparseMemory113c,
  setupTop: number,
  extraCaps: readonly ExtraCapRecord[],
): MemRunRecord[] {
  const out: MemRunRecord[] = []
  extractMemRunsRange(mem, STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE, out)
  if (setupTop > STAGE_SETUP_BASE) {
    extractMemRunsRange(mem, STAGE_SETUP_BASE, setupTop, out)
  }
  for (const cap of extraCaps) {
    const start = Number.parseInt(cap.addr, 16) >>> 0
    extractMemRunsRange(mem, start, (start + cap.len) >>> 0, out)
  }
  return out
}

function loadVectors(): K6P13VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-p13/k6-p13-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6P13VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6P13VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe(`[K6-P13] Real-DLL D2Game.dll Band C Closure Parity Vector Suite (${EXPECTED_VA_COUNT} VAs)`, () => {
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
    mem.fill(0x6fd19f00, 0x3100, 0)
    mem.fill(0x6fd30000, 0x3000, 0)
    bindK2KernelGlobals113c(mem)
    // Hydrate SGPT_ITEMS_LINKER_PTR_VA (0x6FDEFF6C) from loaded Items.txt rows
    const nItems = mem.u32(0x6fdefb94) >>> 0
    const pItems = mem.u32(0x6fdefb98) >>> 0
    if (nItems > 0 && nItems < 4096 && pItems !== 0) {
      const nodes: Array<{ code: number; row: number }> = []
      for (let r = 0; r < nItems; r++) {
        const code = mem.u32((pItems + r * 0x1a8 + 0x80) >>> 0) >>> 0
        nodes.push({ code, row: r })
      }
      nodes.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : a.row - b.row))
      const hdrVa = 0x20fe0000
      const nodesVa = 0x20fe0010
      mem.setU32(hdrVa, nItems)
      mem.setU32((hdrVa + 4) >>> 0, 0)
      mem.setU32((hdrVa + 8) >>> 0, nodesVa)
      for (let i = 0; i < nodes.length; i++) {
        mem.setU32((nodesVa + i * 8) >>> 0, nodes[i]!.code)
        mem.setU32((nodesVa + i * 8 + 4) >>> 0, nodes[i]!.row >>> 0)
      }
      mem.setU32(0x6fdeff6c, hdrVa)
    }
    mem.fill(STAGE_BASE, STAGE_FIXED_SIZE, 0)
    mem.fill(STAGE_CS_GAME, 0x1000, 0)
    mem.fill(0x28000000, 0x4000, 0)
    mem.setU32(0x28000004, 1)
    mem.setU32(0x6fd18d10, 100000)
    mem.fill(0x6fd2d8bc, 4, 0)
    mem.fill(0x6fd30398, 0x20, 0)
    mem.fill(0x6fd303b8, 0x800, 0)
    mem.fill(0x6fd30c04, 0x1008, 0)
    mem.fill(0x6fd31c0c, 0x40, 0)
    mem.fill(0x6fd31f80, 0x20, 0)
    mem.commitOverlayToBase()
  })

  it(`covers all ${EXPECTED_VA_COUNT} Band C D2Game VAs (>= 3 cases each)`, () => {
    expect(VECTORS_BY_VA.size).toBe(EXPECTED_VA_COUNT)
    expect(VECTORS_BY_VA.size).toBe(Object.keys(DISPATCH_BY_VA).length)
    expect(ALL_VECTORS.length).toBeGreaterThanOrEqual(VECTORS_BY_VA.size * 3)
    for (const [va, cases] of VECTORS_BY_VA.entries()) {
      const num = Number.parseInt(va, 16) >>> 0
      expect(num >= 0x6fcb0000 && num <= 0x6fcdffff, `${va} outside Band C`).toBe(true)
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
        for (const cap of vec.extraCaps) {
          const capStart = Number.parseInt(cap.addr, 16) >>> 0
          mem.fill(capStart, cap.len, 0)
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
          const detail = caughtErr instanceof Error && caughtErr.stack ? caughtErr.stack : String(caughtErr)
          throw new Error(
            `${va} case ${vec.caseIdx} (${vec.label}) threw unexpected error: ${detail}`,
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

        const normalizeRun = (run: MemRunRecord): MemRunRecord => {
          // D2Game.dll@0x6FCAAC90 leaves S2C 0x2A bytes [3..6] (0x30002607..0x3000260A) unwritten on stack.
          if (
            (va === '0x6FCDDB10' || va === '0x6FCDE640' || va === '0x6FCDF990') &&
            run.addr === '0x30002600' &&
            run.hex.startsWith('0f0000002a') &&
            run.hex.length >= 22
          ) {
            return {
              addr: run.addr,
              hex: `${run.hex.slice(0, 14)}00000000${run.hex.slice(22)}`,
            }
          }
          return run
        }
        const actualPostMem = extractStageRuns(mem, setupTop, vec.extraCaps)
        const expectedPostMem = vec.postMem.map(normalizeRun)
        expect(
          actualPostMem,
          `${va} case ${vec.caseIdx} (${vec.label}) staged arena memory mismatch`,
        ).toEqual(expectedPostMem)

        if (vec.heapHex.length > 0) {
          const expectedHeapTop = Number.parseInt(vec.heapTop, 16) >>> 0
          expect(
            mem.getHeapTop(),
            `${va} case ${vec.caseIdx} (${vec.label}) heapTop mismatch`,
          ).toBe(expectedHeapTop)
          const rawHeapBytes = mem.readBytes(HEAP_BASE, expectedHeapTop - HEAP_BASE)
          const actualHeapHex = bytesToHex(rawHeapBytes)
          expect(
            actualHeapHex,
            `${va} case ${vec.caseIdx} (${vec.label}) heap contents mismatch`,
          ).toBe(vec.heapHex)
        } else {
          expect(
            mem.getHeapTop(),
            `${va} case ${vec.caseIdx} (${vec.label}) unexpected heap allocation`,
          ).toBe(HEAP_BASE)
        }
      }
    })
  }
})
