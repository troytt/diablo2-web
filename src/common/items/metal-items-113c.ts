/**
 * Diablo II v1.13c metal-item test (`ITEMS_IsMetalItem`, used by Iron Golem #90).
 *
 * Ground truth:
 * - D2Game `SKILLS_SrvSt20_IronGolem` (0x6FC6EDD0) and D2Client `SKILLS_CltSt23_IronGolem` (0x6FB782A0) accept only a
 *   ground item whose base passes `ITEMS_IsMetalItem(pItem->dwClassId)`.
 * - That test reads the Weapons.txt / Armor.txt / Misc.txt `bitfield1` column: bit 1 (`0x2`) marks metal
 *   (1.13c values: `3` = metal body/helm/shield/blade, `1` = leather/cloth/wood/bone, `5` = wand/staff/orb,
 *   `0` = throwing potions; Misc.txt rows are `0` or `1` — rings, amulets and jewels are not metal).
 *
 * The table is derived from the embedded 1.13c excel text (`canonical-drop-data.ts`), keyed by the 3-letter
 * item `code`. An unknown code throws: callers must pass a real item code (no permissive fallback).
 */
import { RAW_ARMOR, RAW_MISC, RAW_WEAPONS } from '../data/canonical-drop-data.ts'

/** Weapons/Armor/Misc.txt `bitfield1` bit that marks a metal base. */
export const ITEM_BITFIELD1_METAL_113C = 0x2

let bitfieldByCode: Map<string, number> | null = null

function indexBitfield1(raw: string, table: string, out: Map<string, number>): void {
  const lines = raw.split(/\r?\n/)
  const header = (lines[0] ?? '').split('\t')
  const codeIdx = header.indexOf('code')
  const bfIdx = header.indexOf('bitfield1')
  if (codeIdx < 0 || bfIdx < 0) {
    throw new Error(`metal-items-113c: ${table} has no code/bitfield1 column`)
  }
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i]!.split('\t')
    const code = (cols[codeIdx] ?? '').trim()
    if (code === '') continue
    const rawBf = (cols[bfIdx] ?? '').trim()
    const bf = rawBf === '' ? 0 : Number.parseInt(rawBf, 10)
    if (!Number.isInteger(bf) || bf < 0) {
      throw new Error(`metal-items-113c: ${table} code ${code} has invalid bitfield1 ${JSON.stringify(rawBf)}`)
    }
    if (!out.has(code)) out.set(code, bf)
  }
}

function getBitfieldIndex(): Map<string, number> {
  if (bitfieldByCode === null) {
    const map = new Map<string, number>()
    indexBitfield1(RAW_WEAPONS, 'Weapons.txt', map)
    indexBitfield1(RAW_ARMOR, 'Armor.txt', map)
    indexBitfield1(RAW_MISC, 'Misc.txt', map)
    bitfieldByCode = map
  }
  return bitfieldByCode
}

/** Weapons/Armor/Misc.txt `bitfield1` of item base `code` (3-letter, trailing spaces ignored). */
export function getItemBitfield1For113c(code: string): number {
  const key = code.trim()
  const bf = getBitfieldIndex().get(key)
  if (bf === undefined) {
    throw new RangeError(`metal-items-113c: unknown 1.13c item code ${JSON.stringify(code)}`)
  }
  return bf
}

/** 1.13c `ITEMS_IsMetalItem`: base `code` has Weapons/Armor/Misc.txt `bitfield1 & 2`. */
export function isMetalItemCode113c(code: string): boolean {
  return (getItemBitfield1For113c(code) & ITEM_BITFIELD1_METAL_113C) !== 0
}
