/**
 * Generates src/common/skills/missile-clt-cols-113c.ts: the Missiles.txt columns the 1.13c D2Client missile code reads
 * (client missile create 0x6fb630f0, per-frame dispatch 0x6fb61af0, range-end / hit handler 0x6fb61420 and the
 * MissCltDoFunc / MissCltHitFunc tables 0x6fb8d8a0 / 0x6fb8da10), keyed by the row's Id.
 *
 * D2Common loads the compiled missiles.bin (record 0x1a4), so every value is read from missiles.bin at the offset the
 * client reads and cross-checked against missiles.txt; any mismatch, unknown sub-missile name or non-integer cell
 * fails the run.
 *
 * missiles.bin offsets (verified by matching every one of the 684 rows):
 *   +0x04 dwFlags (bit 0 LastCollide, bit 5 ClientSend, bit 10 Town, bit 11 SrcTown)
 *   +0x08 pCltDoFunc, +0x0a pCltHitFunc, +0x16 ExplosionMissile, +0x1e..+0x22 CltSubMissile1..3,
 *   +0x2c..+0x32 CltHitSubMissile1..4, +0x58..+0x68 CltParam1..5, +0x6c..+0x74 cHitPar1..3, +0x96 Range,
 *   +0x98 LevRange, +0x12c CltSrcTown, +0x135 InitSteps, +0x136 Activate, +0x178 AnimLen, +0x17c RandStart,
 *   +0x180 SubLoop, +0x181 SubStart, +0x182 SubStop, +0x183 CollideType, +0x184 Collision, +0x185 ClientCol,
 *   +0x186 CollideKill, +0x187 CollideFriend, +0x188 NextHit, +0x189 NextDelay, +0x18a Size, +0x1a2 LocalBlood.
 *
 * Usage: npm run extract:missile-clt-cols   (MPQs from D2_DATA_DIR or samples/d2)
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { cell, parseTable, type D2Table } from '../../common/world/acts.ts'
import { DEFAULT_NODE_MPQ_DIR, mountNodeArchives } from '../mpq-archive-source.ts'

const MISSILES_BIN_RECORD = 0x1a4

export interface MissileCltColsRow113c {
  readonly id: number
  readonly name: string
  readonly pCltDoFunc: number
  readonly pCltHitFunc: number
  readonly lastCollide: boolean
  readonly clientSend: boolean
  readonly town: boolean
  readonly srcTown: boolean
  readonly explosionMissile: number
  readonly cltSubMissile: readonly [number, number, number]
  readonly cltHitSubMissile: readonly [number, number, number, number]
  readonly cltParam: readonly [number, number, number, number, number]
  readonly cHitPar: readonly [number, number, number]
  readonly range: number
  readonly levRange: number
  readonly cltSrcTown: number
  readonly initSteps: number
  readonly activate: number
  readonly animLen: number
  readonly randStart: number
  readonly subLoop: number
  readonly subStart: number
  readonly subStop: number
  readonly collideType: number
  readonly collision: number
  readonly clientCol: number
  readonly collideKill: number
  readonly collideFriend: number
  readonly nextHit: number
  readonly nextDelay: number
  readonly size: number
  readonly localBlood: number
}

function intCell(table: D2Table, row: readonly string[], column: string, where: string): number {
  if (!table.header.includes(column)) throw new Error(`Missiles.txt has no column ${column}`)
  const raw = cell(table, row, column).trim()
  if (raw === '') return 0
  if (!/^-?\d+$/.test(raw)) throw new Error(`${where}: ${column} = '${raw}' is not an integer`)
  return Number(raw)
}

export function extractMissileCltCols(txtBytes: Uint8Array, binBytes: Uint8Array): MissileCltColsRow113c[] {
  const txt = parseTable(txtBytes)
  const rows = txt.rows.filter(r => {
    const n = cell(txt, r, 'Missile').trim()
    return n !== '' && n !== 'Expansion'
  })
  const view = new DataView(binBytes.buffer, binBytes.byteOffset, binBytes.byteLength)
  const count = view.getUint32(0, true)
  if (count !== rows.length || binBytes.byteLength !== 4 + count * MISSILES_BIN_RECORD) {
    throw new Error(`missiles.bin has ${count} records (${binBytes.byteLength} bytes), Missiles.txt ${rows.length}`)
  }
  const idByName = new Map<string, number>()
  rows.forEach((r, i) => idByName.set(cell(txt, r, 'Missile').trim(), i))
  const subId = (r: readonly string[], column: string, where: string): number => {
    const name = cell(txt, r, column).trim()
    if (name === '') return -1
    const id = idByName.get(name)
    if (id === undefined) throw new Error(`${where}: ${column} names unknown missile '${name}'`)
    return id
  }
  const out: MissileCltColsRow113c[] = []
  rows.forEach((r, id) => {
    const where = `Missiles.txt Id=${id}`
    if (intCell(txt, r, 'Id', where) !== id) throw new Error(`${where}: Id column out of order`)
    const rec = 4 + id * MISSILES_BIN_RECORD
    const u8 = (o: number): number => view.getUint8(rec + o)
    const i16 = (o: number): number => view.getInt16(rec + o, true)
    const i32 = (o: number): number => view.getInt32(rec + o, true)
    const check = (column: string, bin: number, txtValue: number): number => {
      if (bin !== txtValue) throw new Error(`${where}: ${column} missiles.bin ${bin} != missiles.txt ${txtValue}`)
      return bin
    }
    const num = (column: string, bin: number): number => check(column, bin, intCell(txt, r, column, where))
    const sub = (column: string, bin: number): number => check(column, bin, subId(r, column, where))
    const flags = view.getUint32(rec + 4, true)
    const flag = (column: string, bit: number): boolean =>
      check(column, (flags >>> bit) & 1, intCell(txt, r, column, where) !== 0 ? 1 : 0) === 1
    // The client reads both function ids with `movsx` and skips the call when the value is <= 0 (0x6fb61bd1-d8,
    // 0x6fb615b2-b9), so they are kept signed. Row 568 royalstrikechainlightning carries the commented-out cell
    // '*16'; its compiled record holds -584 (0xfdb8), i.e. no CltHitFunc.
    const pCltHitRaw = cell(txt, r, 'pCltHitFunc').trim()
    const pCltHitBin = i16(0x0a)
    const pCltHitFunc = /^\*/.test(pCltHitRaw)
      ? (pCltHitBin <= 0 ? pCltHitBin : check('pCltHitFunc', pCltHitBin, 0))
      : num('pCltHitFunc', pCltHitBin)
    out.push({
      id,
      name: cell(txt, r, 'Missile').trim(),
      pCltDoFunc: num('pCltDoFunc', i16(0x08)),
      pCltHitFunc,
      lastCollide: flag('LastCollide', 0),
      clientSend: flag('ClientSend', 5),
      town: flag('Town', 10),
      srcTown: flag('SrcTown', 11),
      explosionMissile: sub('ExplosionMissile', i16(0x16)),
      cltSubMissile: [
        sub('CltSubMissile1', i16(0x1e)),
        sub('CltSubMissile2', i16(0x20)),
        sub('CltSubMissile3', i16(0x22)),
      ],
      cltHitSubMissile: [
        sub('CltHitSubMissile1', i16(0x2c)),
        sub('CltHitSubMissile2', i16(0x2e)),
        sub('CltHitSubMissile3', i16(0x30)),
        sub('CltHitSubMissile4', i16(0x32)),
      ],
      cltParam: [
        num('CltParam1', i32(0x58)),
        num('CltParam2', i32(0x5c)),
        num('CltParam3', i32(0x60)),
        num('CltParam4', i32(0x64)),
        num('CltParam5', i32(0x68)),
      ],
      cHitPar: [num('cHitPar1', i32(0x6c)), num('cHitPar2', i32(0x70)), num('cHitPar3', i32(0x74))],
      range: num('Range', i16(0x96)),
      levRange: num('LevRange', i16(0x98)),
      cltSrcTown: num('CltSrcTown', u8(0x12c)),
      initSteps: num('InitSteps', u8(0x135)),
      activate: num('Activate', u8(0x136)),
      animLen: num('AnimLen', u8(0x178)),
      randStart: num('RandStart', u8(0x17c)),
      subLoop: num('SubLoop', u8(0x180)),
      subStart: num('SubStart', u8(0x181)),
      subStop: num('SubStop', u8(0x182)),
      collideType: num('CollideType', u8(0x183)),
      collision: num('Collision', u8(0x184)),
      clientCol: num('ClientCol', u8(0x185)),
      collideKill: num('CollideKill', u8(0x186)),
      collideFriend: num('CollideFriend', u8(0x187)),
      nextHit: num('NextHit', u8(0x188)),
      nextDelay: num('NextDelay', u8(0x189)),
      size: num('Size', u8(0x18a)),
      localBlood: num('LocalBlood', u8(0x1a2)),
    })
  })
  return out
}

export function renderMissileCltCols(rows: readonly MissileCltColsRow113c[]): string {
  const lines = [
    '/**',
    ' * Auto-generated by src/baker/extract/gen-missile-clt-cols.ts from missiles.bin (cross-checked against',
    ' * missiles.txt). Do not edit by hand: npm run extract:missile-clt-cols.',
    ' *',
    ' * The Missiles.txt columns the 1.13c D2Client missile code reads (create 0x6fb630f0, dispatch 0x6fb61af0,',
    ' * range-end / hit 0x6fb61420, MissCltDoFunc 0x6fb8d8a0 / MissCltHitFunc 0x6fb8da10). Sub-missile columns hold',
    ' * row ids (-1 = empty); arrays are CltSubMissile1..3, CltHitSubMissile1..4, CltParam1..5, cHitPar1..3.',
    ' */',
    '',
    'export interface MissileCltColsRow113c {',
    '  readonly id: number',
    '  readonly name: string',
    '  readonly pCltDoFunc: number',
    '  readonly pCltHitFunc: number',
    '  readonly lastCollide: boolean',
    '  readonly clientSend: boolean',
    '  readonly town: boolean',
    '  readonly srcTown: boolean',
    '  readonly explosionMissile: number',
    '  readonly cltSubMissile: readonly [number, number, number]',
    '  readonly cltHitSubMissile: readonly [number, number, number, number]',
    '  readonly cltParam: readonly [number, number, number, number, number]',
    '  readonly cHitPar: readonly [number, number, number]',
    '  readonly range: number',
    '  readonly levRange: number',
    '  readonly cltSrcTown: number',
    '  readonly initSteps: number',
    '  readonly activate: number',
    '  readonly animLen: number',
    '  readonly randStart: number',
    '  readonly subLoop: number',
    '  readonly subStart: number',
    '  readonly subStop: number',
    '  readonly collideType: number',
    '  readonly collision: number',
    '  readonly clientCol: number',
    '  readonly collideKill: number',
    '  readonly collideFriend: number',
    '  readonly nextHit: number',
    '  readonly nextDelay: number',
    '  readonly size: number',
    '  readonly localBlood: number',
    '}',
    '',
    `export const MISSILE_CLT_COLS_113C_COUNT = ${rows.length}`,
    '',
    '/** Row names, by Id. */',
    `const NAMES: readonly string[] = ${JSON.stringify(rows.map(r => r.name))}`,
    '',
    '/**',
    ' * One flat number tuple per row, in this order: pCltDoFunc, pCltHitFunc, flags (bit 0 lastCollide, 1 clientSend,',
    ' * 2 town, 3 srcTown), explosionMissile, cltSubMissile1..3, cltHitSubMissile1..4, cltParam1..5, cHitPar1..3, range,',
    ' * levRange, cltSrcTown, initSteps, activate, animLen, randStart, subLoop, subStart, subStop, collideType, collision,',
    ' * clientCol, collideKill, collideFriend, nextHit, nextDelay, size, localBlood.',
    ' */',
    'const RAW: readonly (readonly number[])[] = [',
  ]
  for (const m of rows) {
    const flags = (m.lastCollide ? 1 : 0) | (m.clientSend ? 2 : 0) | (m.town ? 4 : 0) | (m.srcTown ? 8 : 0)
    const t = [m.pCltDoFunc, m.pCltHitFunc, flags, m.explosionMissile, ...m.cltSubMissile, ...m.cltHitSubMissile,
      ...m.cltParam, ...m.cHitPar, m.range, m.levRange, m.cltSrcTown, m.initSteps, m.activate, m.animLen, m.randStart,
      m.subLoop, m.subStart, m.subStop, m.collideType, m.collision, m.clientCol, m.collideKill, m.collideFriend,
      m.nextHit, m.nextDelay, m.size, m.localBlood]
    lines.push(`  [${t.join(',')}],`)
  }
  lines.push(
    ']',
    '',
    'function decode(t: readonly number[], id: number): MissileCltColsRow113c {',
    '  const n = (i: number): number => t[i]!',
    '  return {',
    '    id,',
    '    name: NAMES[id]!,',
    '    pCltDoFunc: n(0),',
    '    pCltHitFunc: n(1),',
    '    lastCollide: (n(2) & 1) !== 0,',
    '    clientSend: (n(2) & 2) !== 0,',
    '    town: (n(2) & 4) !== 0,',
    '    srcTown: (n(2) & 8) !== 0,',
    '    explosionMissile: n(3),',
    '    cltSubMissile: [n(4), n(5), n(6)],',
    '    cltHitSubMissile: [n(7), n(8), n(9), n(10)],',
    '    cltParam: [n(11), n(12), n(13), n(14), n(15)],',
    '    cHitPar: [n(16), n(17), n(18)],',
    '    range: n(19),',
    '    levRange: n(20),',
    '    cltSrcTown: n(21),',
    '    initSteps: n(22),',
    '    activate: n(23),',
    '    animLen: n(24),',
    '    randStart: n(25),',
    '    subLoop: n(26),',
    '    subStart: n(27),',
    '    subStop: n(28),',
    '    collideType: n(29),',
    '    collision: n(30),',
    '    clientCol: n(31),',
    '    collideKill: n(32),',
    '    collideFriend: n(33),',
    '    nextHit: n(34),',
    '    nextDelay: n(35),',
    '    size: n(36),',
    '    localBlood: n(37),',
    '  }',
    '}',
    '',
    '/** Indexed by Missiles.txt Id. */',
    'export const MISSILE_CLT_COLS_113C: readonly MissileCltColsRow113c[] = Object.freeze(RAW.map((t, id) => decode(t, id)))',
    '',
  )
  lines.push(
    '/** Row by Missiles.txt Id; an unknown id throws (no silent fallback). */',
    'export function missileCltCols113c(id: number): MissileCltColsRow113c {',
    '  const row = Number.isInteger(id) ? MISSILE_CLT_COLS_113C[id] : undefined',
    '  if (row === undefined) throw new RangeError(`no Missiles.txt row for missile id ${String(id)}`)',
    '  return row',
    '}',
    '',
    'const BY_NAME = new Map(MISSILE_CLT_COLS_113C.map(r => [r.name.toLowerCase(), r] as const))',
    '',
    '/** Row by lower-case Missiles.txt `Missile` name, or undefined for a name that is not a row. */',
    'export function missileCltColsByName113c(name: string): MissileCltColsRow113c | undefined {',
    '  return BY_NAME.get(name.trim().toLowerCase())',
    '}',
    '',
  )
  return lines.join('\n')
}

async function main(): Promise<void> {
  const archives = mountNodeArchives(DEFAULT_NODE_MPQ_DIR)
  const rows = extractMissileCltCols(
    await archives.read('data\\global\\excel\\missiles.txt'),
    await archives.read('data\\global\\excel\\missiles.bin'),
  )
  const target = resolve('src/common/skills/missile-clt-cols-113c.ts')
  writeFileSync(target, renderMissileCltCols(rows))
  console.log(`wrote ${target}: ${rows.length} rows`)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
