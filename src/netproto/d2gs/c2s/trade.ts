/**
 * D2GS C->S Trade Button Packet Builder (0x4F, 1.13c).
 */

import { encodeC2sClickButton } from './interact.ts'

/** Trade window buttons share 0x4F ClickButton; `gold` is only meaningful for button 0x08 (TradeGold). */
export function encodeC2sTrade(action: number, gold: number): Uint8Array {
  return encodeC2sClickButton(action, gold)
}
