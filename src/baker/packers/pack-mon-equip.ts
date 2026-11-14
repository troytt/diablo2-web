/**
 * Offline packer: Diablo II 1.13c `MonEquip.txt` + `monequip.bin` -> `src/common/data/mon-equip-113c.ts`.
 *
 * Ground truth:
 * - `Patch_D2.mpq` -> `data\global\excel\MonEquip.txt` & `data\global\excel\monequip.bin`
 * - `D2Common.dll` `DATATBLS_LoadMonEquipTxt` (`0x6FDA4F00..0x6FDA5249`, record stride `0x1C` = 28 bytes):
 *   - `+0x00`: `int16 nMonster` (`MonStats.txt` `hcIdx`, `-1` sentinel on final row)
 *   - `+0x02`: `uint16 wLevel`
 *   - `+0x04`: `uint32 bOnInit`
 *   - `+0x08`: `char[4][3] dwItem` (`item1..3`, `'    '` when empty)
 *   - `+0x14`: `uint8[3] nLoc` (`loc1..3` via `BodyLocs.txt`: 1=head, 2=neck, 3=tors, 4=rarm, 5=larm, 6=rrin, 7=lrin, 8=belt, 9=feet, 10=glov)
 *   - `+0x17`: `uint8[3] nMod` (`mod1..3` item quality: 3=superior, 4=magic, 6=rare)
 * - `D2Game.dll` `D2GAME_CreateMonsterEquipment` (`0x6FCB2ED0..0x6FCB303D`):
 *   - Scans rows for `nMonster` while `wLevel > nLevel`, then iterates remaining rows for `nMonster`
 *     (stored in descending `level` order per monster in `MonEquip.txt`).
 *   - For each row, counts valid `loc1..3` (`0 < nLoc < 11`), picks one candidate uniformly at random,
 *     and equips into `nLoc` ONLY if that body slot does not already hold an item (`0x6FCB2FB4`).
 *
 * Usage:
 *   npx tsx src/baker/packers/pack-mon-equip.ts [mpqDir]
 *   npx tsx src/baker/packers/pack-mon-equip.ts --check
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_NODE_MPQ_DIR, NodeMpqArchiveSource } from '../mpq-archive-source.ts'
import { parseTable, numberCell, textCell } from '../../common/items/tables.ts'

export const MONEQUIP_TXT_PATH = 'data\\global\\excel\\MonEquip.txt'
export const MONEQUIP_BIN_PATH = 'data\\global\\excel\\monequip.bin'
export const MONSTATS_TXT_PATH = 'data\\global\\excel\\MonStats.txt'
export const ARMOR_TXT_PATH = 'data\\global\\excel\\Armor.txt'
export const MONEQUIP_BIN_RECORD_SIZE = 0x1c

export type MonEquipBodyLoc =
  | 'head'
  | 'neck'
  | 'tors'
  | 'rarm'
  | 'larm'
  | 'rrin'
  | 'lrin'
  | 'belt'
  | 'feet'
  | 'glov'

export type MonEquipQuality = 'normal' | 'superior' | 'magic' | 'rare'

const BODY_LOC_ID_BY_CODE: Readonly<Record<MonEquipBodyLoc, number>> = {
  head: 1,
  neck: 2,
  tors: 3,
  rarm: 4,
  larm: 5,
  rrin: 6,
  lrin: 7,
  belt: 8,
  feet: 9,
  glov: 10,
}

const QUALITY_BY_MOD: Readonly<Record<number, MonEquipQuality>> = {
  2: 'normal',
  3: 'superior',
  4: 'magic',
  6: 'rare',
}

export interface PackedMonEquipCandidate {
  readonly item: string
  readonly loc: MonEquipBodyLoc
  readonly locId: number
  readonly mod: number
  readonly quality: MonEquipQuality
}

export interface PackedMonEquipRow {
  readonly rowIndex: number
  readonly monster: string
  readonly hcIdx: number
  readonly oninit: 0 | 1
  readonly level: number
  readonly candidates: readonly PackedMonEquipCandidate[]
}

export interface MonEquipSource {
  readText(mpqRelativePath: string): string
  readBytes(mpqRelativePath: string): Uint8Array
}

export function extractMonEquipData(src: MonEquipSource): {
  readonly rows: readonly PackedMonEquipRow[]
  readonly normalTorsCodes: readonly string[]
  readonly normalHelmCodes: readonly string[]
} {
  const monStatsTbl = parseTable(src.readText(MONSTATS_TXT_PATH))
  const hcIdxByMonId = new Map<string, number>()
  let compiledMonIdx = 0
  for (const r of monStatsTbl.rows) {
    const id = textCell(r, 'Id').trim().toLowerCase()
    if (!id || id === 'expansion') continue
    hcIdxByMonId.set(id, compiledMonIdx++)
  }

  const txtTbl = parseTable(src.readText(MONEQUIP_TXT_PATH))
  const bin = src.readBytes(MONEQUIP_BIN_PATH)
  if (bin.byteLength < 4) throw new Error('monequip.bin too short')
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength)
  const binCount = dv.getUint32(0, true)
  if (4 + binCount * MONEQUIP_BIN_RECORD_SIZE !== bin.byteLength) {
    throw new Error(
      `monequip.bin size ${String(bin.byteLength)} != 4 + ${String(binCount)} * 0x${MONEQUIP_BIN_RECORD_SIZE.toString(16)}`,
    )
  }

  const txtDataRows = txtTbl.rows.filter(r => {
    const mon = textCell(r, 'monster').trim().toLowerCase()
    return mon !== '' && mon !== 'expansion' && !mon.startsWith('*end*')
  })

  // Final bin record is the sentinel row with nMonster = -1 ("*end*  do not remove" row in MonEquip.txt)
  if (txtDataRows.length + 1 !== binCount) {
    throw new Error(
      `MonEquip.txt has ${String(txtDataRows.length)} monster rows, expected binCount-1 = ${String(binCount - 1)}`,
    )
  }

  const rows: PackedMonEquipRow[] = []
  for (let i = 0; i < txtDataRows.length; i++) {
    const r = txtDataRows[i]!
    const monster = textCell(r, 'monster').trim().toLowerCase()
    const expectedHcIdx = hcIdxByMonId.get(monster)
    if (expectedHcIdx === undefined) {
      throw new Error(`MonEquip.txt row ${String(i)}: unknown monster '${monster}'`)
    }
    const oninit = numberCell(r, 'oninit', 0) ? 1 : 0
    const level = numberCell(r, 'level', 0)

    const o = 4 + i * MONEQUIP_BIN_RECORD_SIZE
    const binMon = dv.getInt16(o, true)
    const binLevel = dv.getUint16(o + 2, true)
    const binOnInit = dv.getUint32(o + 4, true)

    if (binMon !== expectedHcIdx || binLevel !== level || binOnInit !== oninit) {
      throw new Error(
        `monequip.bin mismatch at row ${String(i)} (${monster}): txt=(hcIdx=${String(expectedHcIdx)}, level=${String(level)}, oninit=${String(oninit)}) vs bin=(hcIdx=${String(binMon)}, level=${String(binLevel)}, oninit=${String(binOnInit)})`,
      )
    }

    const candidates: PackedMonEquipCandidate[] = []
    for (let k = 1; k <= 3; k++) {
      const item = textCell(r, `item${String(k)}`).trim()
      const locStr = textCell(r, `loc${String(k)}`).trim().toLowerCase()
      const mod = numberCell(r, `mod${String(k)}`, 0)

      const binItem = String.fromCharCode(
        bin[o + 8 + (k - 1) * 4]!,
        bin[o + 9 + (k - 1) * 4]!,
        bin[o + 10 + (k - 1) * 4]!,
        bin[o + 11 + (k - 1) * 4]!,
      ).trim()
      const binLoc = bin[o + 0x14 + (k - 1)]!
      const binMod = bin[o + 0x17 + (k - 1)]!

      if (locStr === '') {
        if (binLoc !== 0) {
          throw new Error(`monequip.bin row ${String(i)} slot ${String(k)}: expected loc 0, got ${String(binLoc)}`)
        }
        continue
      }

      if (!(locStr in BODY_LOC_ID_BY_CODE)) {
        throw new Error(`MonEquip.txt row ${String(i)} slot ${String(k)}: invalid body loc '${locStr}'`)
      }
      const loc = locStr as MonEquipBodyLoc
      const locId = BODY_LOC_ID_BY_CODE[loc]
      if (binLoc !== locId || binItem !== item || binMod !== mod) {
        throw new Error(
          `monequip.bin slot mismatch at row ${String(i)} slot ${String(k)}: txt=(${item},${loc},${String(mod)}) vs bin=(${binItem},${String(binLoc)},${String(binMod)})`,
        )
      }
      const quality = QUALITY_BY_MOD[mod]
      if (!quality) {
        throw new Error(`MonEquip.txt row ${String(i)} slot ${String(k)}: unsupported mod ${String(mod)}`)
      }
      candidates.push({
        item,
        loc,
        locId,
        mod,
        quality,
      })
    }

    rows.push({
      rowIndex: i,
      monster,
      hcIdx: expectedHcIdx,
      oninit,
      level,
      candidates,
    })
  }

  // Extract normal-tier spawnable torso and helm codes from Armor.txt for empty-item slots
  const armorTbl = parseTable(src.readText(ARMOR_TXT_PATH))
  const normalTorsCodes: string[] = []
  const normalHelmCodes: string[] = []
  for (const r of armorTbl.rows) {
    const code = textCell(r, 'code').trim()
    const normcode = textCell(r, 'normcode').trim()
    const type = textCell(r, 'type').trim()
    const spawnable = numberCell(r, 'spawnable', 0)
    if (!code || !spawnable || code !== normcode) continue
    if (type === 'tors') normalTorsCodes.push(code)
    if (type === 'helm') normalHelmCodes.push(code)
  }

  return { rows, normalTorsCodes, normalHelmCodes }
}

export function renderMonEquipModule(data: {
  readonly rows: readonly PackedMonEquipRow[]
  readonly normalTorsCodes: readonly string[]
  readonly normalHelmCodes: readonly string[]
}): string {
  const rowLines = data.rows.map(r => {
    const cands = r.candidates
      .map(
        c =>
          `{ item: ${JSON.stringify(c.item)}, loc: ${JSON.stringify(c.loc)}, locId: ${String(c.locId)}, mod: ${String(c.mod)}, quality: ${JSON.stringify(c.quality)} }`,
      )
      .join(', ')
    return `  { rowIndex: ${String(r.rowIndex)}, monster: ${JSON.stringify(r.monster)}, hcIdx: ${String(r.hcIdx)}, oninit: ${String(r.oninit)}, level: ${String(r.level)}, candidates: [${cands}] },`
  })

  return `/**
 * AUTO-GENERATED by \`src/baker/packers/pack-mon-equip.ts\` — do not edit by hand.
 *
 * Authoritative Diablo II: Lord of Destruction v1.13c \`MonEquip.txt\` / \`monequip.bin\` table
 * (\`Patch_D2.mpq\` -> \`data\\global\\excel\\MonEquip.txt\`, 44 monster records + 1 sentinel record)
 * and \`D2GAME_CreateMonsterEquipment\` (\`0x6FCB2ED0\`) slot/quality selection logic.
 */

export type MonEquipBodyLoc =
  | 'head'
  | 'neck'
  | 'tors'
  | 'rarm'
  | 'larm'
  | 'rrin'
  | 'lrin'
  | 'belt'
  | 'feet'
  | 'glov'

export type MonEquipQuality = 'normal' | 'superior' | 'magic' | 'rare'

export interface MonEquipCandidate113c {
  readonly item: string
  readonly loc: MonEquipBodyLoc
  readonly locId: number
  readonly mod: number
  readonly quality: MonEquipQuality
}

export interface MonEquipRow113c {
  readonly rowIndex: number
  readonly monster: string
  readonly hcIdx: number
  readonly oninit: 0 | 1
  readonly level: number
  readonly candidates: readonly MonEquipCandidate113c[]
}

export interface MonsterEquippedItem113c {
  readonly slot: MonEquipBodyLoc
  readonly locId: number
  readonly itemCode: string
  readonly quality: MonEquipQuality
  readonly mod: number
  readonly ilvl: number
  readonly rowLevel: number
}

/**
 * Normal-tier spawnable \`Armor.txt\` base item codes for \`tors\` and \`head\` slots when
 * \`MonEquip.txt\` specifies an empty \`item\` column (\`dwItem == '    '\` on \`shadowwarrior\`
 * and \`shadowmaster\` torso/head rows) and no owner equipment override is supplied.
 */
export const MON_EQUIP_EMPTY_SLOT_BASE_CODES_113C: Readonly<Record<'tors' | 'head', readonly string[]>> = {
  tors: ${JSON.stringify(data.normalTorsCodes)},
  head: ${JSON.stringify(data.normalHelmCodes)},
}

/**
 * All 44 monster equipment rows from 1.13c \`MonEquip.txt\` / \`monequip.bin\` in exact table order.
 */
export const MON_EQUIP_ROWS_113C: readonly MonEquipRow113c[] = [
${rowLines.join('\n')}
]

const ROWS_BY_MONSTER = new Map<string, readonly MonEquipRow113c[]>()
for (const row of MON_EQUIP_ROWS_113C) {
  const existing = ROWS_BY_MONSTER.get(row.monster)
  if (existing) {
    ;(existing as MonEquipRow113c[]).push(row)
  } else {
    ROWS_BY_MONSTER.set(row.monster, [row])
  }
}

export function getMonEquipRows113c(monsterId: string): readonly MonEquipRow113c[] {
  return ROWS_BY_MONSTER.get(monsterId.trim().toLowerCase()) ?? []
}

export interface ResolveMonsterEquipmentOptions113c {
  /** Monster ID in \`MonStats.txt\` / \`MonEquip.txt\` (e.g. \`'shadowwarrior'\`, \`'shadowmaster'\`, \`'valkyrie'\`, \`'bloodraven'\`, \`'flyingscimitar'\`). */
  readonly monster: string
  /**
   * Level threshold compared against \`MonEquip.txt\` \`level\` column (\`wLevel <= nLevel\` at \`0x6FCB2F3A\`).
   * - For Shadow Warrior (#268), Shadow Master (#279), and Valkyrie (#32): \`nLevel = slvl\` (\`0x6FCB5ADD\`, \`0x6FC7004C\`).
   * - For regular monsters initialized via \`D2GAME_InitMonster\` (\`0x6FCD02F4\`): \`nLevel = mlvl\`.
   */
  readonly level: number
  /**
   * Item level (\`ilvl\`) passed to \`D2GAME_EquipMonsterItem\` (\`0x6FCCFCE0\`), clamped to \`[1, 99]\`.
   */
  readonly ilvl: number
  /**
   * When \`true\` (\`bOnInit = 1\` in \`D2GAME_InitMonster\` @ \`0x6FCD02F4\`), only monsters whose first
   * \`MonEquip.txt\` row has \`oninit === 1\` (\`0x6FCB2F06\`) receive equipment.
   */
  readonly onInitOnly?: boolean | undefined
  /** Optional uniform \`[0, 1)\` PRNG for candidate and empty-slot base item selection. */
  readonly rng?: (() => number) | undefined
  /**
   * Optional owner equipped base codes by body slot (\`0x6FCB2FD5..0x6FCB2FFE\`: when \`dwItem == '    '\`,
   * \`D2GAME_CreateMonsterEquipment\` queries \`INVENTORY_GetItemFromBodyLoc(pOwner->pInventory, nLoc)\`).
   */
  readonly ownerEquippedBaseCodes?: Readonly<Partial<Record<MonEquipBodyLoc, string>>> | undefined
}

/**
 * Resolves a monster's equipment loadout per \`D2GAME_CreateMonsterEquipment\` (\`0x6FCB2ED0\` in \`D2Game.dll\` 1.13c):
 * 1. Looks up \`MonEquip.txt\` rows for \`monster\`. If \`onInitOnly\` is set and \`rows[0].oninit === 0\`, returns \`[]\`.
 * 2. Skips rows with \`row.level > level\` (\`0x6FCB2F28..0x6FCB2F49\`).
 * 3. Iterates remaining rows in table order (descending \`row.level\`):
 *    - Uniformly picks one of the row's 1..3 \`(item, loc, mod)\` candidates (\`0x6FCB2F6C..0x6FCB2FA3\`).
 *    - If \`loc\` already has an item equipped from a higher-\`level\` row, skips the row (\`0x6FCB2FB4\`).
 *    - If \`item\` is empty (\`""\`), uses \`ownerEquippedBaseCodes[loc]\` if provided, otherwise selects a random
 *      base code for that body location from \`MON_EQUIP_EMPTY_SLOT_BASE_CODES_113C\`.
 */
export function resolveMonsterEquipment113c(
  options: ResolveMonsterEquipmentOptions113c,
): MonsterEquippedItem113c[] {
  const rows = getMonEquipRows113c(options.monster)
  if (rows.length === 0) return []
  if (options.onInitOnly && rows[0]!.oninit === 0) return []

  const lvl = Math.max(0, Math.floor(options.level))
  const clampedIlvl = Math.max(1, Math.min(99, Math.floor(options.ilvl)))
  const rng = options.rng ?? Math.random

  const occupiedSlots = new Set<MonEquipBodyLoc>()
  const result: MonsterEquippedItem113c[] = []

  for (const row of rows) {
    if (row.level > lvl) continue
    const count = row.candidates.length
    if (count === 0) continue

    const pickIdx = count === 1 ? 0 : Math.min(count - 1, Math.max(0, Math.floor(rng() * count)))
    const cand = row.candidates[pickIdx]!
    if (occupiedSlots.has(cand.loc)) continue

    let itemCode = cand.item
    if (itemCode === '') {
      const ownerCode = options.ownerEquippedBaseCodes?.[cand.loc]?.trim()
      if (ownerCode) {
        itemCode = ownerCode
      } else if (cand.loc === 'tors' || cand.loc === 'head') {
        const pool = MON_EQUIP_EMPTY_SLOT_BASE_CODES_113C[cand.loc]
        const poolIdx = Math.min(pool.length - 1, Math.max(0, Math.floor(rng() * pool.length)))
        itemCode = pool[poolIdx]!
      }
    }
    if (!itemCode) continue

    occupiedSlots.add(cand.loc)
    result.push({
      slot: cand.loc,
      locId: cand.locId,
      itemCode,
      quality: cand.quality,
      mod: cand.mod,
      ilvl: clampedIlvl,
      rowLevel: row.level,
    })
  }

  return result
}

/**
 * Resolves \`oninit = 1\` monster spawn equipment per \`D2GAME_InitMonster\` (\`0x6FCD02F4..0x6FCD0304\`):
 * passes \`nLevel = mlvl\`, \`nIlvl = mlvl\`, \`bOnInit = 1\` (applies to \`bloodraven\` and \`flyingscimitar\`).
 */
export function generateMonsterInitEquipment113c(
  monsterId: string,
  mlvl: number,
  rng?: () => number,
): MonsterEquippedItem113c[] {
  const lvl = Math.max(1, Math.floor(mlvl))
  return resolveMonsterEquipment113c({
    monster: monsterId,
    level: lvl,
    ilvl: lvl,
    onInitOnly: true,
    rng,
  })
}
`
}

function main(): void {
  const args = process.argv.slice(2)
  const checkOnly = args.includes('--check')
  const mpqDir = args.find(a => !a.startsWith('--')) ?? DEFAULT_NODE_MPQ_DIR
  const data = extractMonEquipData(new NodeMpqArchiveSource(mpqDir))
  const rendered = renderMonEquipModule(data)
  const here = dirname(fileURLToPath(import.meta.url))
  const outPath = join(here, '..', '..', 'common', 'data', 'mon-equip-113c.ts')

  if (checkOnly) {
    const existing = readFileSync(outPath, 'utf8')
    if (existing !== rendered) {
      throw new Error(`${outPath} is out of date with MonEquip.txt / monequip.bin`)
    }
    console.log(`verified ${String(data.rows.length)} MonEquip rows in ${outPath}`)
    return
  }

  writeFileSync(outPath, rendered)
  console.log(`wrote ${String(data.rows.length)} MonEquip rows -> ${outPath}`)
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
