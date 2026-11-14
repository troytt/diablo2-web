/**
 * Diablo II v1.13c `D2Common.dll` hover-text (`Chat.cpp`) and DRLG vertex (`DrlgVer.cpp`) leaf functions
 * (image base `0x6FD50000`).
 *
 * Binary evidence (`objdump -d -M intel` on 1.13c `D2Common.dll`):
 * - `#10834` (`0x6FD68220`): `CHAT_CopyHoverMsg` (`__stdcall(pHoverMsg, szDest)`, `ret 0x8`)
 * - `#11067` (`0x6FD68240`): `CHAT_GetTimeoutFromHoverMsg` (`__stdcall(pHoverMsg)`, `ret 0x4`)
 * - `0x6FD8D4A0`: `DRLGVER_SnapAndOffsetVertex` (LTCG `ecx = pDstVertex`, `edx = pSrcVertex`, `esi = pLevel`, `ret`)
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  D2DrlgLevelStrc,
  D2DrlgVertexStrc,
  D2HoverTextStrc,
  D2HoverTextStrc_SIZE,
  D2TextHeaderStrc,
  D2TextHeaderStrc_SIZE,
  D2TextNodeStrc,
  D2TextNodeStrc_SIZE,
} from '../mem/layout.generated.ts'
import { D2CommonAssertError } from './inline-helpers.ts'

export const D2COMMON_LANG_ID_SHADOW_VA_113C = 0x6fdf1478

/**
 * `@va D2Common:0x6FD68220` (`D2Common.#10834` `CHAT_CopyHoverMsg`,
 * stdcall `[esp+4] = pHoverMsg`, `[esp+8] = szDest`, `ret 8`, void).
 *
 * Copies the null-terminated string from `pHoverMsg->szMsg` (`+0x10`) into `szDest`
 * (`0x6FD68228 add eax, 0x10; 0x6FD68230..0x6FD68238 mov cl, [eax]; mov [edx+eax], cl; inc eax; test cl, cl; jne`).
 */
export function CHAT_CopyHoverMsg113c(m: Memory113c, pHoverMsg: number, szDest: number): void {
  const srcBase = ((pHoverMsg >>> 0) + D2HoverTextStrc.szMsg.off) >>> 0
  const dstBase = szDest >>> 0
  let i = 0
  while (true) {
    const ch = m.u8((srcBase + i) >>> 0)
    m.setU8((dstBase + i) >>> 0, ch)
    i++
    if (ch === 0) break
  }
}

/**
 * `@va D2Common:0x6FD68240` (`D2Common.#11067` `CHAT_GetTimeoutFromHoverMsg`,
 * stdcall `[esp+4] = pHoverMsg`, `ret 4` -> `pHoverMsg->dwExpireTime (+0x04)`).
 */
export function CHAT_GetTimeoutFromHoverMsg113c(m: Memory113c, pHoverMsg: number): number {
  return m.get(pHoverMsg >>> 0, D2HoverTextStrc.dwExpireTime) >>> 0
}

/** Exact x86 `cdq; and edx, 7; add eax, edx; sar eax, 3` signed division by 8 toward zero. */
function sarDiv8Signed32(v: number): number {
  const s = v | 0
  const bias = (s >> 31) & 7
  return ((s + bias) | 0) >> 3
}

/**
 * `@va D2Common:0x6FD8D4A0` (`DRLGVER_SnapAndOffsetVertex`,
 * internal LTCG `ecx = pDstVertex`, `edx = pSrcVertex`, `esi = pLevel`, plain `ret`, void).
 *
 * Subtracts `pLevel->nPosX (+0x1C)` and `pLevel->nPosY (+0x20)` from `pSrcVertex->nPosX (+0x00)` and
 * `pSrcVertex->nPosY (+0x04)`, stores the relative coords into `pDstVertex`, snaps one axis according to
 * `pSrcVertex->nDirection (+0x08)` via jump table `0x6FD8D528` (`0..3`: `0 -> x = (x/8)*8 + 11`,
 * `1 -> y = (y/8)*8 + 11`, `2 -> x = (x/8)*8 - 5`, `3 -> y = (y/8)*8 - 5`, `>3 -> no snap`), and adds
 * `pLevel->nPosX` / `pLevel->nPosY` back into `pDstVertex`.
 */
export function DRLGVER_SnapAndOffsetVertex113c(
  m: Memory113c,
  pDstVertex: number,
  pSrcVertex: number,
  pLevel: number,
): void {
  const dst = pDstVertex >>> 0
  const src = pSrcVertex >>> 0
  const lvl = pLevel >>> 0

  const relX = ((m.get(src, D2DrlgVertexStrc.nPosX) | 0) - (m.get(lvl, D2DrlgLevelStrc.nPosX) | 0)) >>> 0
  m.set(dst, D2DrlgVertexStrc.nPosX, relX)

  const relY = ((m.get(src, D2DrlgVertexStrc.nPosY) | 0) - (m.get(lvl, D2DrlgLevelStrc.nPosY) | 0)) >>> 0
  m.set(dst, D2DrlgVertexStrc.nPosY, relY)

  const dir = m.get(src, D2DrlgVertexStrc.nDirection) & 0xff
  switch (dir) {
    case 0: {
      // 0x6FD8D4C1: mov eax, [ecx]; cdq; and edx, 7; add eax, edx; sar eax, 3; lea edx, [eax*8 + 0xb]; mov [ecx], edx
      const q = sarDiv8Signed32(m.get(dst, D2DrlgVertexStrc.nPosX) | 0)
      m.set(dst, D2DrlgVertexStrc.nPosX, ((q << 3) + 11) >>> 0)
      break
    }
    case 1: {
      // 0x6FD8D4D7: cdq; and edx, 7; add eax, edx; sar eax, 3; lea eax, [eax*8 + 0xb]; mov [ecx+4], eax
      const q = sarDiv8Signed32(relY | 0)
      m.set(dst, D2DrlgVertexStrc.nPosY, ((q << 3) + 11) >>> 0)
      break
    }
    case 2: {
      // 0x6FD8D4E9: mov eax, [ecx]; cdq; and edx, 7; add eax, edx; sar eax, 3; lea edx, [eax*8 - 5]; mov [ecx], edx
      const q = sarDiv8Signed32(m.get(dst, D2DrlgVertexStrc.nPosX) | 0)
      m.set(dst, D2DrlgVertexStrc.nPosX, ((q << 3) - 5) >>> 0)
      break
    }
    case 3: {
      // 0x6FD8D4FF: cdq; and edx, 7; add eax, edx; sar eax, 3; lea eax, [eax*8 - 5]; mov [ecx+4], eax
      const q = sarDiv8Signed32(relY | 0)
      m.set(dst, D2DrlgVertexStrc.nPosY, ((q << 3) - 5) >>> 0)
      break
    }
    default:
      break
  }

  const lvlX = m.get(lvl, D2DrlgLevelStrc.nPosX) | 0
  const curX = m.get(dst, D2DrlgVertexStrc.nPosX) | 0
  const curY = m.get(dst, D2DrlgVertexStrc.nPosY) | 0
  m.set(dst, D2DrlgVertexStrc.nPosX, (curX + lvlX) >>> 0)
  const lvlY = m.get(lvl, D2DrlgLevelStrc.nPosY) | 0
  m.set(dst, D2DrlgVertexStrc.nPosY, (curY + lvlY) >>> 0)
}

/**
 * `@va D2Common:0x6FD68260` (`D2Common.#10422` `CHAT_FreeHoverMsg`,
 * stdcall `[esp+4] = pMemPool`, `[esp+8] = pHoverText`, `ret 8`, void).
 */
export function CHAT_FreeHoverMsg113c(m: Memory113c, pMemPool: number, pHoverText: number): void {
  const pMsg = pHoverText >>> 0
  if (pMsg !== 0) {
    void pMemPool
    ;(m as { free?: (p: number) => void }).free?.(pMsg)
  }
}

/**
 * `@va D2Common:0x6FD68280` (`D2Common.#10454` `CHAT_AllocHoverMsg`,
 * stdcall `[esp+4] = pMemPool`, `[esp+8] = szText`, `[esp+0xC] = nFrame`, `ret 0xC` -> `pHoverText` or `0`).
 */
export function CHAT_AllocHoverMsg113c(
  m: Memory113c,
  pMemPool: number,
  szText: number,
  nFrame: number,
): number {
  void pMemPool
  const pStr = szText >>> 0
  let len = 0
  while (m.u8((pStr + len) >>> 0) !== 0) {
    len++
  }
  if (len === 0) return 0
  const clampedLen = len >= 0xff ? 0xfe : len
  const pMsg = m.alloc(D2HoverTextStrc_SIZE)
  const dwDisplayTime = (clampedLen * 8 + 0x7d) | 0
  m.set(pMsg, D2HoverTextStrc.dwDisplayTime, dwDisplayTime >>> 0)
  m.set(pMsg, D2HoverTextStrc.dwExpireTime, (dwDisplayTime + (nFrame | 0)) >>> 0)
  m.set(pMsg, D2HoverTextStrc.bUsed, 0)

  let nulReached = false
  for (let i = 0; i < clampedLen + 1; i++) {
    const ch = nulReached ? 0 : m.u8((pStr + i) >>> 0)
    if (ch === 0) nulReached = true
    m.setU8((pMsg + D2HoverTextStrc.szMsg.off + i) >>> 0, ch)
  }
  m.setU8((pMsg + 0x11 + clampedLen) >>> 0, 0)

  const nLangId = m.u8(D2COMMON_LANG_ID_SHADOW_VA_113C)
  m.set(pMsg, D2HoverTextStrc.nLangId, nLangId & 0xff)
  return pMsg >>> 0
}

/**
 * `@va D2Common:0x6FD8D060` (`D2Common.#10619` `TEXT_BuildMessageList`,
 * stdcall `[esp+4] = pTextHeader`, `[esp+8] = pMsgList`, `ret 8`, void).
 */
export function TEXT_BuildMessageList113c(
  m: Memory113c,
  pTextHeader: number,
  pMsgList: number,
): void {
  const pHdr = pTextHeader >>> 0
  if (pHdr === 0) {
    throw new D2CommonAssertError('Text.cpp', 0xed)
  }
  const pOut = pMsgList >>> 0
  if (pOut === 0) {
    throw new D2CommonAssertError('Text.cpp', 0xee)
  }
  for (let i = 0; i < 8; i++) {
    m.setU32((pOut + i * 4) >>> 0, 0)
  }
  m.setU16((pOut + 0x20) >>> 0, 0)
  let pNode = m.get(pHdr, D2TextHeaderStrc.pFirstNode)
  const countByte = m.u8((pHdr + D2TextHeaderStrc.wCount.off) >>> 0)
  m.setU8(pOut, countByte)
  if (pNode === 0) return

  let ecx = (pOut + 4) >>> 0
  let idx = 0
  while (pNode !== 0) {
    if (idx >= 8) {
      throw new D2CommonAssertError('Text.cpp', 0xf8)
    }
    m.setU8((ecx - 2) >>> 0, m.u8((pNode + D2TextNodeStrc.nMenuIndex.off) >>> 0))
    m.setU16(ecx, m.get(pNode, D2TextNodeStrc.wStringId) & 0xffff)
    pNode = m.get(pNode, D2TextNodeStrc.pNext)
    idx++
    ecx = (ecx + 4) >>> 0
  }
}

/**
 * `@va D2Common:0x6FD8D210` (`D2Common.#10972` `TEXT_AddNodeToTextList`,
 * stdcall `[esp+4] = pTextHeader`, `[esp+8] = nStringId`, `[esp+0xC] = nMenuIndex`, `ret 0xC`, void).
 */
export function TEXT_AddNodeToTextList113c(
  m: Memory113c,
  pTextHeader: number,
  nStringId: number,
  nMenuIndex: number,
): void {
  const pHdr = pTextHeader >>> 0
  const pMemPool = m.get(pHdr, D2TextHeaderStrc.pMemPool)
  void pMemPool
  const pOldFirst = m.get(pHdr, D2TextHeaderStrc.pFirstNode)
  const pNode = m.alloc(D2TextNodeStrc_SIZE)
  m.set(pNode, D2TextNodeStrc.pNext, pOldFirst)
  m.set(pNode, D2TextNodeStrc.wStringId, nStringId & 0xffff)
  m.set(pNode, D2TextNodeStrc.nMenuIndex, nMenuIndex >>> 0)
  m.set(pHdr, D2TextHeaderStrc.wCount, (m.get(pHdr, D2TextHeaderStrc.wCount) + 1) & 0xffff)
  m.set(pHdr, D2TextHeaderStrc.pFirstNode, pNode >>> 0)
}

/**
 * `@va D2Common:0x6FD8D280` (`D2Common.#10204` `TEXT_AllocTextList`,
 * stdcall `[esp+4] = pMemPool`, `ret 4` -> `pTextHeader`).
 */
export function TEXT_AllocTextList113c(m: Memory113c, pMemPool: number): number {
  const pool = pMemPool >>> 0
  const pHdr = m.alloc(D2TextHeaderStrc_SIZE)
  m.set(pHdr, D2TextHeaderStrc.pMemPool, pool)
  m.set(pHdr, D2TextHeaderStrc.pFirstNode, 0)
  m.set(pHdr, D2TextHeaderStrc.wCount, 0)
  return pHdr >>> 0
}

/**
 * `@va D2Common:0x6FD8D450` (`D2Common.#10660` `TEXT_FreeTextList`,
 * stdcall `[esp+4] = pTextHeader`, `ret 4`, void).
 */
export function TEXT_FreeTextList113c(m: Memory113c, pTextHeader: number): void {
  const pHdr = pTextHeader >>> 0
  let pNode = m.get(pHdr, D2TextHeaderStrc.pFirstNode)
  while (pNode !== 0) {
    const pMemPool = m.get(pHdr, D2TextHeaderStrc.pMemPool)
    void pMemPool
    const pNext = m.get(pNode, D2TextNodeStrc.pNext)
    ;(m as { free?: (p: number) => void }).free?.(pNode)
    pNode = pNext
  }
  const pMemPool = m.get(pHdr, D2TextHeaderStrc.pMemPool)
  void pMemPool
  m.set(pHdr, D2TextHeaderStrc.wCount, 0)
  ;(m as { free?: (p: number) => void }).free?.(pHdr)
}

