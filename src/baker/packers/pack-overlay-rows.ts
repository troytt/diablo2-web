/**
 * Offline packer: Diablo II 1.13c compiled `Overlay.txt` records → `src/common/data/overlay-txt-rows.ts`.
 *
 * Ground truth is the compiled table `data\global\excel\overlay.bin` that D2Common loads through
 * `DATATBLS_CompileTxt(hArchive, "overlay", …)` (D2MOO `OverlayTbls.cpp:8-39`, record layout
 * `OverlayTbls.h:21-48`; 1.13c `sgptDataTables+0xBBC` records / `+0xBC0` count, stride 0x84).
 * Every server overlay index — S2C 0x11 (D2Client `0x6FB5DAA0`, bounds check `0x6fb5dad9`),
 * Skills.txt `SrvOverlay`/`TgtOverlay` etc. — is an index into that record array.
 *
 * The record names (txt column `overlay`, a NAMETOINDEX link field) are not stored in the bin, so
 * they are taken from `overlay.txt`, whose `Expansion` divider row is NOT a record: the 1.13c MPQ has
 * 294 txt data rows and 293 bin records. The packer fails fast unless every non-divider txt row's
 * `Filename` equals the bin record's `szFilename` at the same index and `wOverlay == index`.
 * All numeric fields are read from the bin itself.
 *
 * Usage: `npx tsx src/baker/packers/pack-overlay-rows.ts [mpqDir]`
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_NODE_MPQ_DIR, NodeMpqArchiveSource } from '../mpq-archive-source.ts'
import type { OverlayTxtRow } from '../../common/data/overlay-txt-row-type.ts'

export const OVERLAY_TXT_PATH = 'data\\global\\excel\\overlay.txt'
export const OVERLAY_BIN_PATH = 'data\\global\\excel\\overlay.bin'
/** `sizeof(D2OverlayTxt)` (record stride used at D2Client `0x6fb5daed`: `idx*0x84`). */
export const OVERLAY_BIN_RECORD_SIZE = 0x84

export interface OverlayRowsSource {
  readText(mpqRelativePath: string): string
  readBytes(mpqRelativePath: string): Uint8Array
}

/** `(name, Filename)` of the non-divider `Overlay.txt` rows in file order. */
export function parseOverlayTxtNames(text: string): { name: string; filename: string }[] {
  const lines = text.split(/\r?\n/)
  const header = (lines[0] ?? '').split('\t')
  const nameIdx = header.findIndex(h => h.trim().toLowerCase() === 'overlay')
  const fileIdx = header.findIndex(h => h.trim().toLowerCase() === 'filename')
  if (nameIdx < 0 || fileIdx < 0) {
    throw new Error(`Overlay.txt header lacks 'overlay'/'Filename' columns: ${header.slice(0, 4).join('|')}`)
  }
  const rows: { name: string; filename: string }[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!
    if (line.trim() === '') continue
    const cells = line.split('\t')
    const name = (cells[nameIdx] ?? '').trim()
    if (name.toLowerCase() === 'expansion') continue
    rows.push({ name, filename: (cells[fileIdx] ?? '').trim() })
  }
  return rows
}

/** Decodes every `D2OverlayTxt` record of `overlay.bin` (D2MOO `OverlayTbls.h:21-48`). */
export function readOverlayBinRecords(bin: Uint8Array): Omit<OverlayTxtRow, 'name'>[] {
  if (bin.byteLength < 4) throw new Error('overlay.bin too short')
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength)
  const count = dv.getUint32(0, true)
  if (4 + count * OVERLAY_BIN_RECORD_SIZE !== bin.byteLength) {
    throw new Error(
      `overlay.bin size ${String(bin.byteLength)} != 4 + ${String(count)} * 0x${OVERLAY_BIN_RECORD_SIZE.toString(16)}`,
    )
  }
  const out: Omit<OverlayTxtRow, 'name'>[] = []
  for (let i = 0; i < count; i++) {
    const o = 4 + i * OVERLAY_BIN_RECORD_SIZE
    const wOverlay = dv.getUint16(o, true)
    if (wOverlay !== i) throw new Error(`overlay.bin record ${String(i)} has wOverlay ${String(wOverlay)}`)
    let filename = ''
    for (let k = 0; k < 64; k++) {
      const c = bin[o + 0x02 + k]!
      if (c === 0) break
      filename += String.fromCharCode(c)
    }
    out.push({
      filename,
      version: dv.getUint16(o + 0x42, true),
      frames: dv.getUint32(o + 0x44, true),
      preDraw: bin[o + 0x48]!,
      oneOfN: dv.getUint32(o + 0x4c, true),
      dir: bin[o + 0x50]!,
      open: bin[o + 0x51]!,
      beta: bin[o + 0x52]!,
      xOffset: dv.getInt32(o + 0x54, true),
      yOffset: dv.getInt32(o + 0x58, true),
      height: [
        dv.getInt32(o + 0x5c, true),
        dv.getInt32(o + 0x60, true),
        dv.getInt32(o + 0x64, true),
        dv.getInt32(o + 0x68, true),
      ],
      animRate: dv.getUint32(o + 0x6c, true),
      initRadius: dv.getUint32(o + 0x70, true),
      radius: dv.getUint32(o + 0x74, true),
      loopWaitTime: dv.getUint32(o + 0x78, true),
      trans: bin[o + 0x7c]!,
      red: bin[o + 0x7d]!,
      green: bin[o + 0x7e]!,
      blue: bin[o + 0x7f]!,
      numDirections: bin[o + 0x80]!,
      localBlood: bin[o + 0x81]!,
    })
  }
  return out
}

/** Compiled overlay records with their txt names, verified record-for-record against the txt. */
export function extractOverlayRows(src: OverlayRowsSource): OverlayTxtRow[] {
  const names = parseOverlayTxtNames(src.readText(OVERLAY_TXT_PATH))
  const records = readOverlayBinRecords(src.readBytes(OVERLAY_BIN_PATH))
  if (names.length !== records.length) {
    throw new Error(`Overlay.txt has ${String(names.length)} records but overlay.bin has ${String(records.length)}`)
  }
  return records.map((rec, i) => {
    const txt = names[i]!
    if (txt.filename.toLowerCase() !== rec.filename.toLowerCase()) {
      throw new Error(`Overlay record ${String(i)}: txt Filename '${txt.filename}' != bin '${rec.filename}'`)
    }
    return { name: txt.name, ...rec }
  })
}

export function renderOverlayRowsModule(rows: readonly OverlayTxtRow[]): string {
  const body = rows.map((r, i) => `  ${JSON.stringify(r)}, // ${String(i)}`).join('\n')
  return `/**
 * AUTO-GENERATED by \`src/baker/packers/pack-overlay-rows.ts\` — do not edit by hand.
 *
 * Diablo II 1.13c compiled \`overlay.bin\` records (${String(rows.length)}; the txt \`Expansion\` divider row is not a
 * record) with their \`Overlay.txt\` names. Index = the overlay index sent by the server (S2C 0x11,
 * D2Client \`0x6FB5DAA0\`; bounds-checked against the record count at \`0x6fb5dad9\`).
 */
import type { OverlayTxtRow } from './overlay-txt-row-type.ts'

export const OVERLAY_TXT_ROWS: readonly OverlayTxtRow[] = Object.freeze([
${body}
])
`
}

function main(): void {
  const mpqDir = process.argv[2] ?? DEFAULT_NODE_MPQ_DIR
  const src = new NodeMpqArchiveSource(mpqDir)
  const rows = extractOverlayRows(src)
  const here = dirname(fileURLToPath(import.meta.url))
  const outPath = join(here, '..', '..', 'common', 'data', 'overlay-txt-rows.ts')
  writeFileSync(outPath, renderOverlayRowsModule(rows))
  console.log(`wrote ${String(rows.length)} overlay records → ${outPath}`)
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
