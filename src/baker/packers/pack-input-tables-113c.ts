/**
 * Bake the 1.13c input-routing data the mouse handlers need into a generated TypeScript module.
 *
 * The runtime may not touch an MPQ, so the Skills.txt / MonStats2.txt columns that 1.13c D2Client's
 * click and hover code reads are extracted here and written to
 * `src/client/input/generated/input-tables-113c.ts`. Nothing downstream may invent these values;
 * `tests/client/input-tables-113c-parity.test.ts` re-derives them from the MPQs and requires the
 * generated module to be byte-identical to this packer's output.
 *
 * Baked columns and their 1.13c consumers:
 * - Skills.txt `interrupt`    — busy gate `D2Client 0x6fad9f30` (`byte+7 & 0x80`, D2Common bit 0x1f @0x6fdb4f5b).
 * - Skills.txt `TargetItem`   — ProcessClick `D2Client 0x6facb7f0` (`byte+7 & 0x08`, bit 0x1b @0x6fdb4eda):
 *                               R-button object/item routing and the unit-path SendSkillPacket(1) @0x6facba2a.
 * - Skills.txt `TargetCorpse` — ProcessClick dead-monster routing (`byte+7 & 0x01`, bit 0x18 @0x6fdb4e61).
 * - Skills.txt `TargetPet`, `TargetAlly` — ProcessClick attackable-unit path (@0x6facb9af).
 * - Skills.txt `warp`         — S2C 0x15 reassign 0x6fb57e20: the weather re-select flag is zeroed at
 *                               0x6fb57efe when the used skill has it (`byte+8 & 0x40`, bit 38). Only
 *                               Teleport (54) and Dragon Flight (275) set it.
 * - Skills.txt `range`        — ProcessClick location path `!shift && (L || range == h2h)` -> walk
 *                               (D2Client 0x6facb8b1; R-hold 0x6facbbc0 tests Skills byte +0x14 == 1).
 * - Skills.txt `progressive`  — S2C 0xA3 handler 0x6fb5efb0 (`byte+4 & 0x04`, Fog gdwBitMasks[2] at
 *                               0x6fb5f03e): progressive skills go to 0x6fb52950, others to 0x6fb51b10.
 * - Skills.txt `cltprgfunc1`  — 0x6fb51b10 dispatches it (record +0xf6) through the table 0x6fb8ea48;
 *                               fn #84 (0x6fb24350, only Thunder Storm) calls ForceLightning 0x6fb301f0.
 * - MonStats2.txt `noGfxHitTest` + `htTop/htLeft/htWidth/htHeight` — HitTest `D2Client 0x6fb568e0`
 *   (0x6fb56a77..0x6fb56ad0), keyed by MonStats.txt `hcIdx` through `MonStatsEx` -> MonStats2 `Id`.
 *
 * Usage:
 *   npx tsx src/baker/packers/pack-input-tables-113c.ts [<archiveDir>] [<outFile>]
 */
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { cell, parseTable } from '../../common/world/acts.ts'
import type { D2Table } from '../../common/world/acts.ts'
import { DEFAULT_NODE_MPQ_DIR, mountNodeArchives } from '../mpq-archive-source.ts'

export const SKILLS_MEMBER_113C = 'data\\global\\excel\\Skills.txt'
export const MONSTATS_MEMBER_113C = 'data\\global\\excel\\MonStats.txt'
export const MONSTATS2_MEMBER_113C = 'data\\global\\excel\\MonStats2.txt'
export const INPUT_TABLES_113C_OUT_FILE = 'src/client/input/generated/input-tables-113c.ts'

/** Skills.txt `range` strings accepted by 1.13c D2Common's skills.txt parser. */
export const SKILL_RANGE_VALUES_113C = ['none', 'h2h', 'rng', 'both', 'loc'] as const
export type SkillRange113c = (typeof SKILL_RANGE_VALUES_113C)[number]

/** Bit layout of the baked per-skill flag word (port-side packing, not a 1.13c structure). */
export const SKILL_FLAG_BITS_113C = Object.freeze({
  interrupt: 1,
  targetItem: 2,
  targetCorpse: 4,
  targetPet: 8,
  targetAlly: 16,
  warp: 32,
  progressive: 64,
})

export interface NoGfxHitBox113c {
  readonly top: number
  readonly left: number
  readonly width: number
  readonly height: number
}

export interface InputTables113c {
  /** Indexed by Skills.txt `Id`. */
  readonly skillFlags: readonly number[]
  /** Indexed by Skills.txt `Id`. */
  readonly skillRange: readonly SkillRange113c[]
  /** Skills.txt `cltprgfunc1` indexed by `Id` (blank = 0). */
  readonly skillCltPrgFunc1: readonly number[]
  /** `[hcIdx, box]`, ascending hcIdx, only monsters whose MonStats2 row sets `noGfxHitTest`. */
  readonly noGfxHitBoxes: readonly (readonly [number, NoGfxHitBox113c])[]
}

function parseFlagCell(table: D2Table, row: readonly string[], column: string, where: string): boolean {
  if (!table.header.includes(column)) {
    throw new Error(`pack-input-tables-113c: ${where} has no column ${column}`)
  }
  const raw = cell(table, row, column).trim()
  if (raw === '' || raw === '0') return false
  if (raw === '1') return true
  throw new Error(`pack-input-tables-113c: ${where} column ${column} has non-boolean value ${JSON.stringify(raw)}`)
}

function parseIntCell(table: D2Table, row: readonly string[], column: string, where: string): number {
  if (!table.header.includes(column)) {
    throw new Error(`pack-input-tables-113c: ${where} has no column ${column}`)
  }
  const raw = cell(table, row, column).trim()
  if (!/^-?\d+$/.test(raw)) {
    throw new Error(`pack-input-tables-113c: ${where} column ${column} is not an integer: ${JSON.stringify(raw)}`)
  }
  return Number.parseInt(raw, 10)
}

/** A non-negative integer cell where blank means 0 (the excel parser's default for numeric fields). */
function parseCountCell(table: D2Table, row: readonly string[], column: string, where: string): number {
  if (!table.header.includes(column)) {
    throw new Error(`pack-input-tables-113c: ${where} has no column ${column}`)
  }
  const raw = cell(table, row, column).trim()
  if (raw === '') return 0
  if (!/^\d+$/.test(raw)) {
    throw new Error(`pack-input-tables-113c: ${where} column ${column} is not a non-negative integer: ${JSON.stringify(raw)}`)
  }
  return Number.parseInt(raw, 10)
}

/**
 * Pure builder: derive the input tables from the three parsed excel tables. Fails fast on missing
 * columns, unknown `range` strings, non-contiguous skill ids, or MonStats rows without a MonStats2 join.
 */
export function buildInputTables113c(tables: {
  readonly skills: D2Table
  readonly monStats: D2Table
  readonly monStats2: D2Table
}): InputTables113c {
  const { skills, monStats, monStats2 } = tables
  const skillFlags: number[] = []
  const skillRange: SkillRange113c[] = []
  const skillCltPrgFunc1: number[] = []
  skills.rows.forEach((row, index) => {
    const where = `Skills.txt row ${String(index)}`
    const id = parseIntCell(skills, row, 'Id', where)
    if (id !== skillFlags.length) {
      throw new Error(`pack-input-tables-113c: ${where} has Id ${String(id)}, expected ${String(skillFlags.length)}`)
    }
    let flags = 0
    if (parseFlagCell(skills, row, 'interrupt', where)) flags |= SKILL_FLAG_BITS_113C.interrupt
    if (parseFlagCell(skills, row, 'TargetItem', where)) flags |= SKILL_FLAG_BITS_113C.targetItem
    if (parseFlagCell(skills, row, 'TargetCorpse', where)) flags |= SKILL_FLAG_BITS_113C.targetCorpse
    if (parseFlagCell(skills, row, 'TargetPet', where)) flags |= SKILL_FLAG_BITS_113C.targetPet
    if (parseFlagCell(skills, row, 'TargetAlly', where)) flags |= SKILL_FLAG_BITS_113C.targetAlly
    if (parseFlagCell(skills, row, 'warp', where)) flags |= SKILL_FLAG_BITS_113C.warp
    if (parseFlagCell(skills, row, 'progressive', where)) flags |= SKILL_FLAG_BITS_113C.progressive
    if (!skills.header.includes('range')) throw new Error(`pack-input-tables-113c: ${where} has no column range`)
    const range = cell(skills, row, 'range').trim()
    if (!(SKILL_RANGE_VALUES_113C as readonly string[]).includes(range)) {
      throw new Error(`pack-input-tables-113c: ${where} (Id ${String(id)}) has unknown range ${JSON.stringify(range)}`)
    }
    skillFlags.push(flags)
    skillRange.push(range as SkillRange113c)
    skillCltPrgFunc1.push(parseCountCell(skills, row, 'cltprgfunc1', where))
  })
  if (skillFlags.length === 0) throw new Error('pack-input-tables-113c: Skills.txt has no rows')

  const ms2ById = new Map<string, readonly string[]>()
  for (const row of monStats2.rows) {
    const id = cell(monStats2, row, 'Id').trim()
    if (id.length === 0) continue
    if (ms2ById.has(id)) throw new Error(`pack-input-tables-113c: MonStats2.txt duplicates Id ${id}`)
    ms2ById.set(id, row)
  }
  const noGfxHitBoxes: (readonly [number, NoGfxHitBox113c])[] = []
  const seenHcIdx = new Set<number>()
  monStats.rows.forEach((row, index) => {
    const where = `MonStats.txt row ${String(index)}`
    const name = cell(monStats, row, 'Id').trim()
    if (name === 'Expansion') return
    const hcIdx = parseIntCell(monStats, row, 'hcIdx', where)
    if (seenHcIdx.has(hcIdx)) throw new Error(`pack-input-tables-113c: ${where} duplicates hcIdx ${String(hcIdx)}`)
    seenHcIdx.add(hcIdx)
    const ex = cell(monStats, row, 'MonStatsEx').trim()
    const ms2 = ms2ById.get(ex)
    if (ms2 === undefined) {
      throw new Error(`pack-input-tables-113c: ${where} (${name}) MonStatsEx ${JSON.stringify(ex)} has no MonStats2.txt row`)
    }
    const ms2Where = `MonStats2.txt Id ${ex}`
    if (!parseFlagCell(monStats2, ms2, 'noGfxHitTest', ms2Where)) return
    noGfxHitBoxes.push([
      hcIdx,
      {
        top: parseIntCell(monStats2, ms2, 'htTop', ms2Where),
        left: parseIntCell(monStats2, ms2, 'htLeft', ms2Where),
        width: parseIntCell(monStats2, ms2, 'htWidth', ms2Where),
        height: parseIntCell(monStats2, ms2, 'htHeight', ms2Where),
      },
    ])
  })
  noGfxHitBoxes.sort((a, b) => a[0] - b[0])
  return { skillFlags, skillRange, skillCltPrgFunc1, noGfxHitBoxes }
}

/** Read the three excel members from mounted 1.13c archives and build the tables. */
export async function readInputTables113c(archives: {
  read(member: string): Promise<Uint8Array>
}): Promise<InputTables113c> {
  const [skills, monStats, monStats2] = await Promise.all([
    archives.read(SKILLS_MEMBER_113C),
    archives.read(MONSTATS_MEMBER_113C),
    archives.read(MONSTATS2_MEMBER_113C),
  ])
  return buildInputTables113c({
    skills: parseTable(skills),
    monStats: parseTable(monStats),
    monStats2: parseTable(monStats2),
  })
}

function chunkLines(values: readonly string[], perLine: number): string {
  const lines: string[] = []
  for (let i = 0; i < values.length; i += perLine) {
    lines.push(`  ${values.slice(i, i + perLine).join(', ')},`)
  }
  return lines.join('\n')
}

/** Render the generated module source (deterministic; LF line endings). */
export function renderInputTables113cModule(tables: InputTables113c): string {
  const flags = chunkLines(tables.skillFlags.map(v => String(v)), 20)
  const ranges = chunkLines(tables.skillRange.map(v => `'${v}'`), 12)
  const cltPrgFunc1 = chunkLines(tables.skillCltPrgFunc1.map(v => String(v)), 20)
  const boxes = tables.noGfxHitBoxes
    .map(([hcIdx, b]) =>
      `  [${String(hcIdx)}, { top: ${String(b.top)}, left: ${String(b.left)}, width: ${String(b.width)}, height: ${String(b.height)} }],`,
    )
    .join('\n')
  return `/**
 * AUTO-GENERATED by \`npx tsx src/baker/packers/pack-input-tables-113c.ts\` from the 1.13c MPQs
 * (Skills.txt, MonStats.txt, MonStats2.txt). Do not edit by hand: parity with the MPQs is enforced by
 * \`tests/client/input-tables-113c-parity.test.ts\`.
 */

/** Skills.txt \`range\` strings (1.13c D2Common skills.txt parser). */
export type SkillRange113c = 'none' | 'h2h' | 'rng' | 'both' | 'loc'

/** Skills.txt \`interrupt\` — busy gate 1.13c D2Client 0x6fad9f30 (\`byte+7 & 0x80\`). */
export const SKILL_FLAG_INTERRUPT_113C = ${String(SKILL_FLAG_BITS_113C.interrupt)}
/** Skills.txt \`TargetItem\` — ProcessClick 1.13c D2Client 0x6facb7f0 (\`byte+7 & 0x08\`). */
export const SKILL_FLAG_TARGET_ITEM_113C = ${String(SKILL_FLAG_BITS_113C.targetItem)}
/** Skills.txt \`TargetCorpse\` — ProcessClick dead-monster routing (\`byte+7 & 0x01\`). */
export const SKILL_FLAG_TARGET_CORPSE_113C = ${String(SKILL_FLAG_BITS_113C.targetCorpse)}
/** Skills.txt \`TargetPet\` — ProcessClick attackable-unit path (0x6facb9af). */
export const SKILL_FLAG_TARGET_PET_113C = ${String(SKILL_FLAG_BITS_113C.targetPet)}
/** Skills.txt \`TargetAlly\` — ProcessClick attackable-unit path (0x6facb9af). */
export const SKILL_FLAG_TARGET_ALLY_113C = ${String(SKILL_FLAG_BITS_113C.targetAlly)}
/** Skills.txt \`warp\` — S2C 0x15 reassign 1.13c D2Client 0x6fb57efe (\`byte+8 & 0x40\`). */
export const SKILL_FLAG_WARP_113C = ${String(SKILL_FLAG_BITS_113C.warp)}
/** Skills.txt \`progressive\` — S2C 0xA3 handler 1.13c D2Client 0x6fb5f03e (\`byte+4 & 0x04\`). */
export const SKILL_FLAG_PROGRESSIVE_113C = ${String(SKILL_FLAG_BITS_113C.progressive)}

/** Per-skill flag word indexed by Skills.txt \`Id\` (${String(tables.skillFlags.length)} rows). */
export const SKILL_INPUT_FLAGS_113C: readonly number[] = [
${flags}
]

/** Skills.txt \`range\` indexed by \`Id\`. */
export const SKILL_RANGE_113C: readonly SkillRange113c[] = [
${ranges}
]

/**
 * Skills.txt \`cltprgfunc1\` indexed by \`Id\` (blank = 0): the client function 1.13c D2Client 0x6fb51b10
 * dispatches through the table 0x6fb8ea48 for S2C 0xA3.
 */
export const SKILL_CLT_PRG_FUNC1_113C: readonly number[] = [
${cltPrgFunc1}
]

export interface NoGfxHitBox113c {
  readonly top: number
  readonly left: number
  readonly width: number
  readonly height: number
}

/**
 * MonStats.txt \`hcIdx\` -> MonStats2.txt \`htTop/htLeft/htWidth/htHeight\` for rows that set
 * \`noGfxHitTest\` (HitTest 1.13c D2Client 0x6fb568e0 @0x6fb56a77..0x6fb56ad0).
 */
export const NO_GFX_HIT_BOXES_113C: readonly (readonly [number, NoGfxHitBox113c])[] = [
${boxes}
]
`
}

async function main(): Promise<void> {
  const archiveDir = process.argv[2] ?? DEFAULT_NODE_MPQ_DIR
  const outFile = resolve(process.argv[3] ?? INPUT_TABLES_113C_OUT_FILE)
  const archives = mountNodeArchives(archiveDir)
  const tables = await readInputTables113c(archives)
  await writeFile(outFile, renderInputTables113cModule(tables), 'utf8')
  console.log(
    `pack-input-tables-113c: ${String(tables.skillFlags.length)} skills, ` +
      `${String(tables.noGfxHitBoxes.length)} noGfxHitTest monsters -> ${outFile}`,
  )
}

const invokedPath = process.argv[1] !== undefined ? resolve(process.argv[1]) : ''
if (invokedPath.endsWith('pack-input-tables-113c.ts')) {
  main().catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
}
