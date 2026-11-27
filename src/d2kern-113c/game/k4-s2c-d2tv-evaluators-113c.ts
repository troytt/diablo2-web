/**
 * Pure Diablo II v1.13c binary-exact kernel evaluator for Milestone 35 [K4]
 * D2TV S2C packet builder, Huffman codec, and framing vector suite.
 *
 * Drives the pure 1.13c S2C packet builders in `src/d2kern-113c/game/` together
 * with `Fog.#10223` / `Fog.#10224` Huffman compression & decompression and
 * `D2Net.#10002` / `D2Net.#10033` framing & packet-size resolution in
 * `src/d2kern-113c/net/packet-sink.ts`.
 */

import { imul32 } from '../common/int-math.ts'
import { ITEMS_CheckItemTypeIdMemPort113c } from '../common/k0-d2common-memports.ts'
import {
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  frameServerPacket113c,
  getS2CPacketSize113c,
  unframeServerPacket113c,
} from '../net/packet-sink.ts'
import { S2C_SendPacket9C_ItemActionWorld113c } from './a1c-post150-f786-f1040-113c.ts'
import {
  UNIT_SendAllStatesBitstreamToClient113c,
  UNIT_SendGfxStatesBitstreamToClient113c,
} from './boot-init-gap-a-113c.ts'
import {
  D2GAME_PACKET_SendStatByteWordDword113c,
  D2GAME_PACKET_SendUnitStop113c,
} from './boot-init-gap-b-113c.ts'
import { SUNIT_InsertServerUnit113c } from './game-strc.ts'
import {
  NET_SendReassignUnitPacket15_113c,
  NET_SendUnitMovePacket0F113c,
} from './k2-combat-core-w1-113c.ts'
import {
  NET_SendPacket0x23_AssignSkill113c,
  NET_SendPacket0x3E_ItemStatBitStream113c,
  NET_SendPacket0xAB_UnitHeal113c,
} from './k2-gap-melee-dot-113c.ts'
import { NET_SendPacket1A1B1C_StatUpdate_6FCABDA0_113c } from './k2-w2b3-113c.ts'
import {
  NET_SendPacket18_HpManaPot_6FCAB8C0_113c,
  NET_SendPacket19_1D1E1F_GoldUpdate_6FCABE10_113c,
  NET_SendPacket7D_SetItemFlags_6FCAADE0_113c,
  NET_SendPacket95_LifeManaStamina_6FCAB7F0_113c,
  NET_SendPacket96_WalkVerify_6FCAB750_113c,
  NET_SendPacket9D_ItemActionOwned_6FCAB0F0_113c,
  NET_SendPacket9E9FA0_StatValue_6FCABC20_113c,
  NET_SendPacketA0A1A2_StatDelta_6FCABB10_113c,
  NET_SendPacketA3_AuraTargetSkill_6FCABA90_113c,
} from './k2-w4b4-113c.ts'
import {
  NET_SendPacket21_UpdateUnitSkill_6FCAD5F0_113c,
  NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c,
  NET_SendPacketMonsterMoveCoord_6FCAD860_113c,
  NET_SendPacketMonsterTargetUnit_6FCAD990_113c,
} from './k2-w4b5-113c.ts'

export interface S2CVectorInput113c {
  readonly opKind: number
  readonly flags: number
  readonly u16A: number
  readonly u32A: number
  readonly u32B: number
  readonly u16B: number
  readonly u16C: number
}

export interface S2CVectorOutput113c {
  readonly rawLen: number
  readonly framedLen: number
  readonly decompLen: number
  readonly firstPktSize: number
  readonly pktCount: number
  readonly wireHdr0: number
  readonly wireHdr1: number
  readonly firstOpcode: number
  readonly rawFnv1a32: number
  readonly rawMix32: number
  readonly framedFnv1a32: number
  readonly framedMix32: number
  readonly rawPrefix: Uint8Array
  readonly framedPrefix: Uint8Array
  readonly roundtripExact: boolean
}

const SGPT_DATATABLES_VA_113C = 0x6fde9e1c
const ITEMS_TXT_COUNT_VA_113C = 0x6fdefb94
const ITEMS_TXT_PTR_VA_113C = 0x6fdefb98
const ITEMS_TXT_STRIDE_113C = 0x1a8
const INVENTORY_SIGNATURE_113C = 0x01020304

export function fnv1a32Bytes113c(data: Uint8Array): number {
  let h = 0x811c9dc5
  for (let i = 0; i < data.byteLength; i++) {
    h = (h ^ data[i]!) >>> 0
    h = imul32(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export function mix32Bytes113c(data: Uint8Array): number {
  const len = data.byteLength >>> 0
  let h = (0x9e3779b9 ^ imul32(len, 0x85ebca6b)) >>> 0
  for (let i = 0; i < data.byteLength; i++) {
    let k = (data[i]! + imul32(i, 0x27d4eb2d)) >>> 0
    k = imul32(k, 0xcc9e2d51) >>> 0
    k = ((k << 15) | (k >>> 17)) >>> 0
    k = imul32(k, 0x1b873593) >>> 0
    h = (h ^ k) >>> 0
    h = ((h << 13) | (h >>> 19)) >>> 0
    h = (imul32(h, 5) + 0xe6546b64) >>> 0
  }
  h = (h ^ len) >>> 0
  h = (h ^ (h >>> 16)) >>> 0
  h = imul32(h, 0x85ebca6b) >>> 0
  h = (h ^ (h >>> 13)) >>> 0
  h = imul32(h, 0xc2b2ae35) >>> 0
  h = (h ^ (h >>> 16)) >>> 0
  return h >>> 0
}

function readMemorySlice(m: Memory113c, addr: number, len: number): Uint8Array {
  const out = new Uint8Array(len)
  const base = addr >>> 0
  for (let i = 0; i < len; i++) {
    out[i] = m.u8((base + i) >>> 0)
  }
  return out
}

function getItemsTxtPtr113c(m: Memory113c, itemId: number): number {
  const count = m.u32(ITEMS_TXT_COUNT_VA_113C) >>> 0
  if ((itemId >>> 0) >= count) return 0
  const base = m.u32(ITEMS_TXT_PTR_VA_113C) >>> 0
  if (base === 0) return 0
  return (base + imul32(itemId >>> 0, ITEMS_TXT_STRIDE_113C)) >>> 0
}

function setupTestItemFromInput113c(
  m: Memory113c,
  pGame: number,
  input: S2CVectorInput113c,
): number {
  const pItem = m.alloc(0x200) >>> 0
  const pItemData = m.alloc(0x100) >>> 0
  const pItemPath = m.alloc(0x40) >>> 0

  const itemId = input.u16A & 0xffff
  const itemGuid = input.u32A >>> 0
  const cfg = input.u32B >>> 0
  const gemItemId = input.u16C & 0xffff

  const quality = cfg & 0x0f
  const animMode = (cfg >>> 4) & 0x07
  const bodyLoc = (cfg >>> 7) & 0x0f
  let invPage = (cfg >>> 11) & 0x07
  if (invPage === 7) invPage = 0xff
  const itemFormat = ((cfg >>> 14) & 1) !== 0 ? 0 : 100
  const ilvl = 1 + ((cfg >>> 15) & 0x3f)
  const numGems = (cfg >>> 21) & 0x03
  const isEth = (cfg >>> 23) & 1
  const isIdent = (cfg >>> 24) & 1
  const posX = (cfg >>> 25) & 0x0f
  const posY = (cfg >>> 29) & 0x07

  let cmdFlags = 0
  if (isIdent !== 0) cmdFlags |= 0x10
  if (isEth !== 0) cmdFlags |= 0x400000
  if (numGems > 0) cmdFlags |= 0x800

  m.setU32(pItem + 0x00, 4)
  m.setU32(pItem + 0x04, itemId)
  m.setU32(pItem + 0x0c, itemGuid)
  m.setU32(pItem + 0x10, animMode)
  m.setU32(pItem + 0x14, pItemData)
  m.setU32(pItem + 0x20, (itemGuid ^ 0x13579bdf) >>> 0)
  m.setU32(pItem + 0x24, 0x0000029a)
  m.setU32(pItem + 0x28, (itemGuid ^ 0x2468ace0) >>> 0)
  m.setU32(pItem + 0x2c, pItemPath)

  if (animMode === 3 || animMode === 5) {
    m.setU32(pItemPath + 0x0c, (5100 + posX * 7) >>> 0)
    m.setU32(pItemPath + 0x10, (5200 + posY * 9) >>> 0)
  } else {
    m.setU32(pItemPath + 0x0c, posX % 10)
    m.setU32(pItemPath + 0x10, posY % 4)
  }

  m.setU32(pItemData + 0x00, quality)
  m.setU32(pItemData + 0x04, (itemGuid ^ 0x55aa55aa) >>> 0)
  m.setU32(pItemData + 0x08, 0x0000029a)
  m.setU32(pItemData + 0x0c, itemGuid)
  m.setU32(pItemData + 0x18, cmdFlags >>> 0)
  const fileIndex =
    quality === 1 || quality === 3 ? itemGuid % 4 : quality === 7 ? 5 : 0xffffffff
  m.setU32(pItemData + 0x28, fileIndex >>> 0)
  m.setU32(pItemData + 0x2c, ilvl)
  m.setU16(pItemData + 0x30, itemFormat)

  if (quality === 4) {
    m.setU16(pItemData + 0x38, (10 + (itemGuid % 40)) & 0xffff)
    m.setU16(pItemData + 0x3e, (5 + ((itemGuid >>> 4) % 40)) & 0xffff)
  } else if (quality === 6) {
    m.setU16(pItemData + 0x32, (1 + (itemGuid % 20)) & 0xffff)
    m.setU16(pItemData + 0x34, (1 + ((itemGuid >>> 3) % 20)) & 0xffff)
    m.setU16(pItemData + 0x38, (12 + (itemGuid % 30)) & 0xffff)
    m.setU16(pItemData + 0x3e, (8 + ((itemGuid >>> 5) % 30)) & 0xffff)
  }
  m.setU8(pItemData + 0x44, bodyLoc)
  m.setU8(pItemData + 0x45, invPage)

  STATLIST_CreateEx113c(m, pItem, 0, pGame)
  const pTxt = getItemsTxtPtr113c(m, itemId)
  if (pTxt !== 0 && m.u8(pTxt + 0x137) === 0) {
    if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x32) !== 0) {
      STATLIST_SetUnitStat113c(m, pItem, 0x1f, (15 + (itemGuid % 80)) | 0, 0)
    }
    if (m.u8(pTxt + 0x113) === 0 && m.u8(pTxt + 0x112) !== 0) {
      const maxDur = m.u8(pTxt + 0x112)
      const curDur = (1 + (itemGuid % maxDur)) | 0
      STATLIST_SetUnitStat113c(m, pItem, 0x49, maxDur, 0)
      STATLIST_SetUnitStat113c(m, pItem, 0x48, curDur, 0)
    }
    if (m.u8(pTxt + 0x132) !== 0) {
      STATLIST_SetUnitStat113c(m, pItem, 0x46, (10 + (itemGuid % 20)) | 0, 0)
    }
    if (numGems > 0) {
      STATLIST_SetUnitStat113c(m, pItem, 0xc2, (numGems + 1) | 0, 0)
    }
    if (isIdent !== 0 && (quality === 4 || quality === 6)) {
      const pBonus = STATLIST_AllocList113c(m, 0x40, 4, itemGuid, 0, 0)
      STATLIST_SetStat113c(m, pBonus, 0, (5 + (itemGuid % 15)) | 0, 0)
      STATLIST_SetStat113c(m, pBonus, 7, ((10 + (itemGuid % 30)) << 8) | 0, 0)
      if (quality === 6) {
        STATLIST_SetStat113c(m, pBonus, 39, (10 + ((itemGuid >>> 3) % 25)) | 0, 0)
      }
      STATLIST_MergeStatLists113c(m, pItem, pBonus, 1)
    }
  }

  if (numGems > 0 && pTxt !== 0 && m.u8(pTxt + 0x137) === 0) {
    const pItemInv = m.alloc(0x40) >>> 0
    const pGem1 = m.alloc(0x200) >>> 0
    const pGem1Data = m.alloc(0x100) >>> 0
    const pGem1Path = m.alloc(0x40) >>> 0
    const pGem2 = numGems >= 2 ? m.alloc(0x200) >>> 0 : 0
    const pGem2Data = numGems >= 2 ? m.alloc(0x100) >>> 0 : 0
    const pGem2Path = numGems >= 2 ? m.alloc(0x40) >>> 0 : 0

    m.setU32(pItemInv + 0x00, INVENTORY_SIGNATURE_113C)
    m.setU32(pItemInv + 0x08, pItem)
    m.setU32(pItemInv + 0x0c, pGem1)
    m.setU32(pItemInv + 0x10, numGems >= 2 ? pGem2 : pGem1)
    m.setU32(pItem + 0x60, pItemInv)

    m.setU32(pGem1 + 0x00, 4)
    m.setU32(pGem1 + 0x04, gemItemId)
    m.setU32(pGem1 + 0x0c, (itemGuid + 10000) >>> 0)
    m.setU32(pGem1 + 0x10, 6)
    m.setU32(pGem1 + 0x14, pGem1Data)
    m.setU32(pGem1 + 0x2c, pGem1Path)
    m.setU32(pGem1Data + 0x00, 2)
    m.setU32(pGem1Data + 0x18, 0x10)
    m.setU32(pGem1Data + 0x2c, ilvl)
    m.setU16(pGem1Data + 0x30, itemFormat)
    m.setU8(pGem1Data + 0x45, 0xff)
    m.setU32(pGem1Data + 0x5c, pItemInv)
    m.setU32(pGem1Data + 0x64, numGems >= 2 ? pGem2 : 0)
    STATLIST_CreateEx113c(m, pGem1, 0, pGame)

    if (numGems >= 2) {
      m.setU32(pGem2 + 0x00, 4)
      m.setU32(pGem2 + 0x04, gemItemId)
      m.setU32(pGem2 + 0x0c, (itemGuid + 20000) >>> 0)
      m.setU32(pGem2 + 0x10, 6)
      m.setU32(pGem2 + 0x14, pGem2Data)
      m.setU32(pGem2 + 0x2c, pGem2Path)
      m.setU32(pGem2Data + 0x00, 2)
      m.setU32(pGem2Data + 0x18, 0x10)
      m.setU32(pGem2Data + 0x2c, ilvl)
      m.setU16(pGem2Data + 0x30, itemFormat)
      m.setU8(pGem2Data + 0x45, 0xff)
      m.setU32(pGem2Data + 0x5c, pItemInv)
      m.setU32(pGem2Data + 0x60, pGem1)
      STATLIST_CreateEx113c(m, pGem2, 0, pGame)
    }
  }

  return pItem
}

function drainQueuedClientRawBytes113c(m: Memory113c, pClient: number): Uint8Array {
  let total = 0
  let walk = m.u32((pClient + 0x1b8) >>> 0) >>> 0
  let guard = 0
  while (walk !== 0 && guard++ < 64) {
    total += m.u32(walk) >>> 0
    walk = m.u32((walk + 0x204) >>> 0) >>> 0
  }
  const out = new Uint8Array(total)
  let off = 0
  walk = m.u32((pClient + 0x1b8) >>> 0) >>> 0
  guard = 0
  while (walk !== 0 && guard++ < 64) {
    const used = m.u32(walk) >>> 0
    for (let i = 0; i < used; i++) {
      out[off++] = m.u8((walk + 0x04 + i) >>> 0)
    }
    walk = m.u32((walk + 0x204) >>> 0) >>> 0
  }
  return out
}

export function evaluateS2CVector113c(
  m: Memory113c,
  input: S2CVectorInput113c,
): S2CVectorOutput113c {
  const pGame = m.alloc(0x2000) >>> 0
  const pClient = m.alloc(0x600) >>> 0
  m.setU32(pClient + 0x00, 1)
  m.setU32(pClient + 0x1a8, pGame)

  const nQueue = input.flags & 3
  let rawBytes: Uint8Array

  switch (input.opKind) {
    case 0: {
      const wLife = input.u16A & 0x7fff
      const wMana = input.u32A & 0x7fff
      const wStam = (input.u32A >>> 15) & 0x7fff
      const bLifeReg = ((input.flags >>> 2) & 0x3f) | (((input.u16A >>> 15) & 1) << 6)
      const bManaReg = ((input.u32A >>> 30) & 3) | ((input.u32B & 0x1f) << 2)
      NET_SendPacket18_HpManaPot_6FCAB8C0_113c(
        m,
        pClient,
        wLife,
        wMana,
        wStam,
        bLifeReg,
        bManaReg,
        input.u16B,
        input.u16C,
        (input.u32B >>> 8) & 0xff,
        (input.u32B >>> 16) & 0xff,
      )
      rawBytes = drainQueuedClientRawBytes113c(m, pClient)
      break
    }
    case 1: {
      NET_SendPacket95_LifeManaStamina_6FCAB7F0_113c(
        m,
        pClient,
        input.u16A & 0x7fff,
        input.u32A & 0x7fff,
        (input.u32A >>> 15) & 0x7fff,
        input.u16B,
        input.u16C,
        input.u32B & 0xff,
        (input.u32B >>> 8) & 0xff,
      )
      rawBytes = drainQueuedClientRawBytes113c(m, pClient)
      break
    }
    case 2: {
      NET_SendPacket96_WalkVerify_6FCAB750_113c(
        m,
        pClient,
        input.u16A & 0x7fff,
        input.u16B,
        input.u16C,
        input.u32A & 0xff,
        (input.u32A >>> 8) & 0xff,
      )
      rawBytes = drainQueuedClientRawBytes113c(m, pClient)
      break
    }
    case 3: {
      D2GAME_PACKET_SendStatByteWordDword113c(m, pClient, input.u16A % 255, input.u32A)
      const pNode = m.u32(pClient + 0x1b8) >>> 0
      rawBytes = readMemorySlice(m, pNode + 4, m.u32(pNode))
      break
    }
    case 4: {
      NET_SendPacket1A1B1C_StatUpdate_6FCABDA0_113c(m, pClient, input.u32A | 0, input.u32B | 0)
      rawBytes = drainQueuedClientRawBytes113c(m, pClient)
      break
    }
    case 5: {
      NET_SendPacket19_1D1E1F_GoldUpdate_6FCABE10_113c(m, pClient, input.u32A | 0, input.u32B | 0)
      rawBytes = drainQueuedClientRawBytes113c(m, pClient)
      break
    }
    case 6: {
      let pU = 0
      if ((input.flags & 4) === 0) {
        pU = m.alloc(0x100) >>> 0
        m.setU32(pU + 0x0c, input.u32B >>> 0)
      }
      NET_SendPacket9E9FA0_StatValue_6FCABC20_113c(m, input.u16A % 255, pU, pClient, input.u32A >>> 0)
      rawBytes = drainQueuedClientRawBytes113c(m, pClient)
      break
    }
    case 7: {
      let pU = 0
      if ((input.flags & 4) === 0) {
        pU = m.alloc(0x100) >>> 0
        m.setU32(pU + 0x0c, (((input.u16B & 0xffff) << 16) | (input.u16C & 0xffff)) >>> 0)
      }
      NET_SendPacketA0A1A2_StatDelta_6FCABB10_113c(
        m,
        pClient,
        input.u16A % 255,
        input.u32A | 0,
        input.u32B | 0,
        pU,
      )
      rawBytes = drainQueuedClientRawBytes113c(m, pClient)
      break
    }
    case 8: {
      const uType = (input.flags >>> 2) & 1
      const modeA = (input.flags >>> 3) & 3
      const hasSecond = (input.flags >>> 5) & 1
      const secondEnded = (input.flags >>> 6) & 1
      const stA = input.u16A & 0xff
      const stB = (input.u16A >>> 8) & 0xff

      const pUnit = m.alloc(0x200) >>> 0
      m.setU32(pUnit + 0x00, uType)
      m.setU32(pUnit + 0x0c, input.u32A >>> 0)
      STATLIST_CreateEx113c(m, pUnit, 0, pGame)

      if (modeA === 0) {
        STATES_ToggleGfxStateFlag113c(m, pUnit, stA, 1)
        STATES_ToggleGfxStateFlag113c(m, pUnit, stA, 0)
      } else if (modeA === 1) {
        STATES_ToggleGfxStateFlag113c(m, pUnit, stA, 1)
      } else {
        STATES_ToggleGfxStateFlag113c(m, pUnit, stA, 1)
        const pSub = STATLIST_AllocList113c(m, 0, uType, input.u32A >>> 0, stA, 0)
        STATLIST_SetState113c(m, pSub, stA)
        let v1 = (input.u16C << 16) >> 16
        if (input.u16B === 7 || input.u16B === 9) v1 <<= 8
        STATLIST_SetStat113c(m, pSub, input.u16B, v1, input.u32B & 0xffff)
        if (modeA === 3) {
          const st2 = (input.u32B >>> 16) & 0x1ff
          let v2 = (((input.u16C * 3 + 7) & 0x3f) + 1) | 0
          if (st2 === 7 || st2 === 9) v2 <<= 8
          STATLIST_SetStat113c(m, pSub, st2, v2, 0)
        }
        STATLIST_MergeStatLists113c(m, pUnit, pSub, 1)
      }

      if (hasSecond !== 0 && stB !== 0 && stB !== stA) {
        STATES_ToggleGfxStateFlag113c(m, pUnit, stB, 1)
        if (secondEnded !== 0) STATES_ToggleGfxStateFlag113c(m, pUnit, stB, 0)
      }

      UNIT_SendGfxStatesBitstreamToClient113c(m, pUnit, pClient)
      rawBytes = drainQueuedClientRawBytes113c(m, pClient)
      break
    }
    case 9: {
      const uType = (input.flags >>> 2) & 1
      const hasStats0 = (input.flags >>> 3) & 1
      const hasTwo0 = (input.flags >>> 4) & 1
      const hasStats1 = (input.flags >>> 5) & 1
      const s0 = input.u16A & 0xff
      const s1 = (input.u16A >>> 8) & 0xff

      const pUnit = m.alloc(0x200) >>> 0
      m.setU32(pUnit + 0x00, uType)
      m.setU32(pUnit + 0x0c, input.u32A >>> 0)
      STATLIST_CreateEx113c(m, pUnit, 0, pGame)

      if (s0 !== 0) {
        STATES_ToggleGfxStateFlag113c(m, pUnit, s0, 1)
        if (hasStats0 !== 0) {
          const pSub0 = STATLIST_AllocList113c(m, 0, uType, input.u32A >>> 0, s0, 0)
          STATLIST_SetState113c(m, pSub0, s0)
          let v1 = (input.u16C << 16) >> 16
          if (input.u16B === 7 || input.u16B === 9) v1 <<= 8
          STATLIST_SetStat113c(m, pSub0, input.u16B, v1, input.u32B & 0xffff)
          if (hasTwo0 !== 0) {
            const st2 = (input.u32B >>> 16) & 0x1ff
            let v2 = ((input.u16C & 0x3f) + 1) | 0
            if (st2 === 7 || st2 === 9) v2 <<= 8
            STATLIST_SetStat113c(m, pSub0, st2, v2, 0)
          }
          STATLIST_MergeStatLists113c(m, pUnit, pSub0, 1)
        }
      }
      if (s1 !== 0 && s1 !== s0) {
        STATES_ToggleGfxStateFlag113c(m, pUnit, s1, 1)
        if (hasStats1 !== 0) {
          const pSub1 = STATLIST_AllocList113c(m, 0, uType, input.u32A >>> 0, s1, 0)
          STATLIST_SetState113c(m, pSub1, s1)
          STATLIST_SetStat113c(m, pSub1, 21, ((input.u16C & 0x1f) + 1) | 0, 0)
          STATLIST_MergeStatLists113c(m, pUnit, pSub1, 1)
        }
      }

      UNIT_SendAllStatesBitstreamToClient113c(m, pUnit, pClient)
      rawBytes = drainQueuedClientRawBytes113c(m, pClient)
      break
    }
    case 10: {
      const pUnit = m.alloc(0x200) >>> 0
      const pPath = m.alloc(0x200) >>> 0
      m.setU32(pUnit + 0x00, 0)
      m.setU32(pUnit + 0x0c, input.u32A >>> 0)
      m.setU32(pUnit + 0x2c, pPath)
      m.setU8(pUnit + 0xb0, (input.flags >>> 2) & 0x3f)
      m.setU16(pPath + 0x02, input.u16B)
      m.setU16(pPath + 0x06, input.u16C)
      m.setU16(pPath + 0x10, input.u32B & 0xffff)
      m.setU16(pPath + 0x12, (input.u32B >>> 16) & 0xffff)
      NET_SendUnitMovePacket0F113c(m, pGame, pUnit, pClient, input.u16A % 20)
      rawBytes = drainQueuedClientRawBytes113c(m, pClient)
      break
    }
    case 11: {
      const uType = ((input.flags >>> 2) % 3) >>> 0
      const pUnit = m.alloc(0x200) >>> 0
      const pPath = m.alloc(0x200) >>> 0
      m.setU32(pUnit + 0x00, uType)
      m.setU32(pUnit + 0x0c, input.u32A >>> 0)
      m.setU32(pUnit + 0x2c, pPath)
      if (uType === 2) {
        m.setU32(pPath + 0x0c, input.u16B)
        m.setU32(pPath + 0x10, input.u16C)
      } else {
        m.setU16(pPath + 0x02, input.u16B)
        m.setU16(pPath + 0x06, input.u16C)
      }
      NET_SendReassignUnitPacket15_113c(m, pUnit, pClient, input.u16A & 0xff)
      rawBytes = drainQueuedClientRawBytes113c(m, pClient)
      break
    }
    case 12: {
      const pt = input.u16A & 0x0f
      const extremeVel = (input.flags >>> 2) & 1
      const moveType = (input.flags >>> 3) & 7
      const bByteA = (input.u16A >>> 4) & 0xff
      const bByteF = (input.u16A >>> 12) & 0x0f
      const bByteB = (((input.flags >>> 2) * 17) & 0xff) >>> 0

      const pMon = m.alloc(0x200) >>> 0
      const pPath = m.alloc(0x200) >>> 0
      m.setU32(pMon + 0x00, 1)
      m.setU32(pMon + 0x0c, input.u32A >>> 0)
      m.setU32(pMon + 0x2c, pPath)
      m.setU32(pPath + 0x3c, pt)
      if (pt === 5 || pt === 6) {
        m.setU32(pPath + 0x28, 2)
        m.setU16(pPath + 0xa0, input.u32B & 0xffff)
        m.setU16(pPath + 0xa2, (input.u32B >>> 16) & 0xffff)
      }
      STATLIST_CreateEx113c(m, pMon, 0, pGame)
      const vel =
        pt === 5 || pt === 6
          ? extremeVel !== 0
            ? 40000
            : 25
          : extremeVel !== 0
            ? input.u32B | 0
            : ((input.u32B & 0xffff) << 16) >> 16
      STATLIST_SetUnitStat113c(m, pMon, 0x43, vel, 0)
      SUNIT_InsertServerUnit113c(m, pGame, pMon)
      NET_SendPacketMonsterMoveCoord_6FCAD860_113c(
        m,
        pClient,
        0x67,
        input.u32A >>> 0,
        moveType,
        input.u16B,
        input.u16C,
        bByteA,
        bByteF,
        bByteB,
      )
      rawBytes = drainQueuedClientRawBytes113c(m, pClient)
      break
    }
    case 13: {
      const pt = input.u16A & 0x0f
      const extremeVel = (input.flags >>> 2) & 1
      const moveType = (input.flags >>> 3) & 7
      const targetType = (input.flags >>> 6) & 3
      const bByteF = input.u16A & 0xff
      const bByte14 = (input.u16A >>> 8) & 0xff
      const bByte10 = ((input.u32B ^ input.u32A) & 0xff) >>> 0

      const pMon = m.alloc(0x200) >>> 0
      const pPath = m.alloc(0x200) >>> 0
      m.setU32(pMon + 0x00, 1)
      m.setU32(pMon + 0x0c, input.u32A >>> 0)
      m.setU32(pMon + 0x2c, pPath)
      m.setU16(pPath + 0x02, input.u16B)
      m.setU16(pPath + 0x06, input.u16C)
      m.setU32(pPath + 0x3c, pt)
      STATLIST_CreateEx113c(m, pMon, 0, pGame)
      const signedB14 = (bByte14 << 24) >> 24
      const vel = extremeVel !== 0 ? ((input.u32A & 1) !== 0 ? -45000 : 45000) : signedB14 * 3
      STATLIST_SetUnitStat113c(m, pMon, 0x43, vel, 0)
      SUNIT_InsertServerUnit113c(m, pGame, pMon)
      NET_SendPacketMonsterTargetUnit_6FCAD990_113c(
        m,
        pClient,
        0x68,
        input.u32A >>> 0,
        moveType,
        targetType,
        input.u32B >>> 0,
        bByteF,
        bByte14,
        bByte10,
      )
      rawBytes = drainQueuedClientRawBytes113c(m, pClient)
      break
    }
    case 14: {
      D2GAME_PACKET_SendUnitStop113c(
        m,
        pClient,
        input.u32A >>> 0,
        input.u16B,
        input.u16C,
        input.u16A & 0xff,
      )
      const pNode = m.u32(pClient + 0x1b8) >>> 0
      rawBytes = readMemorySlice(m, pNode + 4, m.u32(pNode))
      break
    }
    case 15: {
      const pItem = setupTestItemFromInput113c(m, pGame, input)
      const bSimple = (input.flags >>> 2) & 1
      const clientActive = (input.flags >>> 3) & 1
      const bAction = input.u16B & 0xff
      const extraCmdFlags = (input.u16B >>> 8) & 0xff

      const pOwner = m.alloc(0x200) >>> 0
      m.setU32(pOwner + 0x00, 0)
      m.setU32(pOwner + 0x0c, 77)
      SUNIT_InsertServerUnit113c(m, pGame, pOwner)
      m.setU32(pClient + 0x16c, 0)
      m.setU32(pClient + 0x170, 77)
      m.setU32(pClient + 0x174, pOwner)
      m.setU8(pClient + 0x3d4, clientActive)

      S2C_SendPacket9C_ItemActionWorld113c(m, pClient, pItem, bAction, extraCmdFlags, bSimple)
      rawBytes = drainQueuedClientRawBytes113c(m, pClient)
      break
    }
    case 16: {
      const pItem = setupTestItemFromInput113c(m, pGame, input)
      const bGamble = (input.flags >>> 2) & 1
      const ownerMode = (input.flags >>> 4) & 3
      const bAction = input.u16B & 0xff
      const extraCmdFlags = (input.u16B >>> 8) & 0xff

      let pOwner = 0
      if (ownerMode < 3) {
        pOwner = m.alloc(0x200) >>> 0
        const oType = ownerMode === 0 ? 0 : ownerMode === 1 ? 1 : 4
        m.setU32(pOwner + 0x00, oType)
        m.setU32(pOwner + 0x0c, (500 + (input.u32A & 0xff)) >>> 0)
      }
      NET_SendPacket9D_ItemActionOwned_6FCAB0F0_113c(
        m,
        bAction,
        pOwner,
        pItem,
        pClient,
        extraCmdFlags,
        bGamble,
      )
      rawBytes = drainQueuedClientRawBytes113c(m, pClient)
      break
    }
    case 17: {
      let pIt = 0
      if (((input.flags >>> 2) & 1) === 0) {
        pIt = m.alloc(0x100) >>> 0
        m.setU32(pIt + 0x00, 4)
        m.setU32(pIt + 0x0c, input.u32A >>> 0)
      }
      NET_SendPacket0x3E_ItemStatBitStream113c(
        m,
        pIt,
        input.u16B,
        pClient,
        (input.flags >>> 3) & 1,
        input.u16A & 0x1ff,
        input.u32B >>> 0,
      )
      const pNode = m.u32(pClient + 0x1b8) >>> 0
      rawBytes = readMemorySlice(m, pNode + 4, m.u32(pNode))
      break
    }
    case 18: {
      let pOw = 0
      if (((input.flags >>> 2) & 1) === 0) {
        pOw = m.alloc(0x100) >>> 0
        m.setU32(pOw + 0x00, (input.flags >>> 3) & 3)
        m.setU32(pOw + 0x0c, (((input.u16A & 0xffff) << 16) | (input.u16B & 0xffff)) >>> 0)
      }
      let pIt = 0
      if (((input.flags >>> 5) & 1) === 0) {
        pIt = m.alloc(0x100) >>> 0
        m.setU32(pIt + 0x00, 4)
        m.setU32(
          pIt + 0x0c,
          (((input.u16C & 0xffff) << 16) | ((input.u16A ^ input.u16B) & 0xffff)) >>> 0,
        )
      }
      NET_SendPacket7D_SetItemFlags_6FCAADE0_113c(
        m,
        pOw,
        pIt,
        pClient,
        input.u32A >>> 0,
        input.u32B >>> 0,
      )
      rawBytes = drainQueuedClientRawBytes113c(m, pClient)
      break
    }
    case 19: {
      const uType = (input.flags >>> 2) & 1
      const cClass = (input.flags >>> 3) & 7
      const itemOwned = (input.flags >>> 6) & 1
      const skId = input.u16A & 0xffff
      const baseLvl = input.u16B & 0xff
      const arg2 = (input.u16B >>> 8) & 0xff

      const pUnit = m.alloc(0x200) >>> 0
      m.setU32(pUnit + 0x00, uType)
      m.setU32(pUnit + 0x04, cClass)
      m.setU32(pUnit + 0x0c, input.u32A >>> 0)
      STATLIST_CreateEx113c(m, pUnit, 0, pGame)
      if ((input.u32B & 7) !== 0) {
        STATLIST_SetUnitStat113c(m, pUnit, 0x7f, input.u32B & 7, 0)
      }
      const sgpt = m.u32(SGPT_DATATABLES_VA_113C) >>> 0
      const pSkillsTxt = m.u32(sgpt + 0xb98) >>> 0
      const nSkillsCount = m.u32(sgpt + 0xb9c) >>> 0
      if (skId < nSkillsCount) {
        const pSkillList = m.alloc(0x20) >>> 0
        const pSkillNode = m.alloc(0x40) >>> 0
        m.setU32(pSkillNode + 0x00, (pSkillsTxt + imul32(skId, 0x23c)) >>> 0)
        m.setU32(pSkillNode + 0x28, baseLvl)
        m.setU32(pSkillNode + 0x2c, input.u16C & 0x0f)
        m.setU32(pSkillNode + 0x34, itemOwned !== 0 ? 123 : 0xffffffff)
        m.setU32(pSkillList + 0x04, pSkillNode)
        m.setU32(pUnit + 0xa8, pSkillList)
      }
      NET_SendPacket21_UpdateUnitSkill_6FCAD5F0_113c(m, pClient, pUnit, skId, baseLvl, arg2)
      rawBytes = drainQueuedClientRawBytes113c(m, pClient)
      break
    }
    case 20: {
      const uType = (input.flags >>> 2) & 1
      const regUnit = (input.flags >>> 3) & 1
      const morph = (input.flags >>> 4) & 1
      if (regUnit !== 0) {
        const pUnit = m.alloc(0x200) >>> 0
        m.setU32(pUnit + 0x00, uType)
        m.setU32(pUnit + 0x0c, input.u32A >>> 0)
        STATLIST_CreateEx113c(m, pUnit, 0, pGame)
        if (morph !== 0) {
          STATES_ToggleGfxStateFlag113c(m, pUnit, 7, 1)
        }
        SUNIT_InsertServerUnit113c(m, pGame, pUnit)
      }
      NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c(
        m,
        pClient,
        uType,
        input.u32A >>> 0,
        input.u16A,
        input.u16B & 0xff,
      )
      rawBytes = drainQueuedClientRawBytes113c(m, pClient)
      break
    }
    case 21: {
      const uType = (input.flags >>> 2) & 3
      const nHand = (input.flags >>> 4) & 3
      NET_SendPacket0x23_AssignSkill113c(
        m,
        uType,
        input.u32A >>> 0,
        pClient,
        nHand,
        input.u16A,
        input.u32B >>> 0,
      )
      const pNode = m.u32(pClient + 0x1b8) >>> 0
      rawBytes = readMemorySlice(m, pNode + 4, m.u32(pNode))
      break
    }
    case 22: {
      const subMode = (input.flags >>> 2) & 7
      if (subMode === 0) {
          NET_SendPacketA3_AuraTargetSkill_6FCABA90_113c(
          m,
          input.u16A & 3,
          input.u16B,
          pClient,
          input.u16C,
          (input.u16A >>> 2) & 3,
          input.u32A >>> 0,
          (input.u16A >>> 8) & 0xff,
          input.u32B >>> 0,
          (input.u32A ^ 0x1234) & 0x7fff,
          (input.u32B ^ 0x5678) & 0x7fff,
        )
        rawBytes = drainQueuedClientRawBytes113c(m, pClient)
      } else if (subMode === 1) {
        NET_SendPacket0xAB_UnitHeal113c(
          m,
          input.u16A & 3,
          input.u32A >>> 0,
          pClient,
          input.u16B & 0xff,
        )
        const pNode = m.u32(pClient + 0x1b8) >>> 0
        rawBytes = readMemorySlice(m, pNode + 4, m.u32(pNode))
      } else if (subMode === 2) {
          const nPkts = input.u16A >>> 0
        for (let p = 0; p < nPkts; p++) {
          const g1 = (input.u32A + imul32(p, 0x9e3779b9)) >>> 0
          const g2 = (input.u32B ^ imul32(p, 0x85ebca6b)) >>> 0
          NET_SendPacketA3_AuraTargetSkill_6FCABA90_113c(
            m,
            p & 3,
            (10 + p * 7) & 0xffff,
            pClient,
            (1 + (p % 20)) & 0xffff,
            (p + 1) & 3,
            g1,
            (0x5a ^ (p * 19)) & 0xff,
            g2,
            ((g1 >>> 5) ^ imul32(p, 331)) >>> 0,
            ((g2 >>> 3) ^ imul32(p, 733)) >>> 0,
          )
        }
        rawBytes = drainQueuedClientRawBytes113c(m, pClient)
      } else if (subMode === 3) {
        rawBytes = new Uint8Array([0xaf, input.u16A & 0xff])
      } else {
        D2GAME_PACKET_SendUnitStop113c(
          m,
          pClient,
          input.u32A >>> 0,
          input.u16B,
          input.u16C,
          input.u16A & 0xff,
        )
        const pNode = m.u32(pClient + 0x1b8) >>> 0
        rawBytes = readMemorySlice(m, pNode + 4, m.u32(pNode))
      }
      break
    }
    default:
      throw new Error(`Unsupported S2C opKind: ${input.opKind}`)
  }

  const framedBytes = frameServerPacket113c(nQueue, rawBytes)
  const decompBytes = unframeServerPacket113c(nQueue, framedBytes, rawBytes.byteLength)

  let roundtripExact = decompBytes.byteLength === rawBytes.byteLength
  if (roundtripExact) {
    for (let i = 0; i < rawBytes.byteLength; i++) {
      if (decompBytes[i] !== rawBytes[i]) {
        roundtripExact = false
        break
      }
    }
  }

  let firstPktSize = 0xffff
  let pktCount = 0
  let curOff = 0
  while (curOff < rawBytes.byteLength) {
    const outSz = getS2CPacketSize113c(rawBytes.subarray(curOff))
    if (outSz <= 0 || curOff + outSz > rawBytes.byteLength) {
      if (curOff === 0) firstPktSize = 0xffff
      break
    }
    if (pktCount === 0) firstPktSize = outSz & 0xffff
    pktCount = (pktCount + 1) & 0xff
    curOff += outSz
  }

  const rawPrefix = new Uint8Array(12)
  rawPrefix.set(rawBytes.subarray(0, Math.min(12, rawBytes.byteLength)))

  const framedPrefix = new Uint8Array(8)
  framedPrefix.set(framedBytes.subarray(0, Math.min(8, framedBytes.byteLength)))

  return {
    rawLen: rawBytes.byteLength,
    framedLen: framedBytes.byteLength,
    decompLen: decompBytes.byteLength,
    firstPktSize,
    pktCount,
    wireHdr0: framedBytes.byteLength >= 1 ? framedBytes[0]! : 0,
    wireHdr1: framedBytes.byteLength >= 2 ? framedBytes[1]! : 0,
    firstOpcode: rawBytes.byteLength >= 1 ? rawBytes[0]! : 0,
    rawFnv1a32: fnv1a32Bytes113c(rawBytes),
    rawMix32: mix32Bytes113c(rawBytes),
    framedFnv1a32: fnv1a32Bytes113c(framedBytes),
    framedMix32: mix32Bytes113c(framedBytes),
    rawPrefix,
    framedPrefix,
    roundtripExact,
  }
}
