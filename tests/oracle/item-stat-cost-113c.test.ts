/**
 * Authoritative 359-row `ItemStatCost.bin` (`0x144` bytes/row) & 7-row `CharStats.bin` (`0xC4` bytes/row)
 * oracle parity tests against the real Diablo II v1.13c `Patch_D2.mpq` and live `D2Common.dll`
 * (`DATATBLS_LoadItemStatCostTxt` `0x6FDC3330..0x6FDC3FF9` & `DATATBLS_LoadCharStatsTxt` `0x6FDB0A80..0x6FDB1680`).
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MpqArchive } from '../../src/common/mpq/archive.ts'
import {
  CANONICAL_CHAR_GROWTH_113C,
  CANONICAL_ITEM_STAT_COST_113C,
  CHAR_STATS_BIN_STRIDE_113C,
  CHAR_STATS_COUNT_113C,
  DEFAULT_STAT_REGISTRY_113C,
  ISC_FLAG_CSV_SIGNED,
  ISC_FLAG_DAMAGE_RELATED,
  ISC_FLAG_DIRECT,
  ISC_FLAG_FCALLBACK,
  ISC_FLAG_FMIN,
  ISC_FLAG_ITEM_SPECIFIC,
  ISC_FLAG_RUNTIME_MAXHP,
  ISC_FLAG_RUNTIME_MAXMANA,
  ISC_FLAG_RUNTIME_MAXSTAM,
  ISC_FLAG_RUNTIME_MAXSTAT,
  ISC_FLAG_SAVED,
  ISC_FLAG_SEND_OTHER,
  ISC_FLAG_SIGNED,
  ISC_FLAG_UPDATE_ANIM_RATE,
  ITEM_STAT_COST_BIN_STRIDE_113C,
  ITEM_STAT_COST_COUNT_113C,
  STAT_ID_NONE_113C,
  StatTableRegistry113c,
  parseCharStatsBin113c,
  parseItemStatCostBin113c,
} from '../../src/d2kern-113c/common/statlist.ts'
import { isOracleToolchainAvailable113c } from '../../tools/oracle/fn-daemon.ts'

function openMpqFromBuffer(label: string, buf: Uint8Array): MpqArchive {
  return MpqArchive.openSync({
    label,
    size: buf.byteLength,
    read: async (off, len) => buf.subarray(off, off + len).slice(),
    readSync: (off, len) => buf.subarray(off, off + len).slice(),
  })
}

const repoRoot = resolve(import.meta.dirname, '../..')
const d2DataDir = process.env.D2_DATA_DIR ?? join(homedir(), 'd2-data')
const patchMpqPath = join(d2DataDir, 'Patch_D2.mpq')
const d2ExpMpqPath = join(d2DataDir, 'd2exp.mpq')

function dumpLivePostLoadItemStatCost(): Uint8Array {
  expect(isOracleToolchainAvailable113c()).toBe(true)
  const oracleRoot = process.env.D2_ORACLE_ROOT ?? join(homedir(), '.local/opt/d2oracle')
  const buildScript = join(repoRoot, 'tools/oracle/headless/build.sh')
  const pfx = mkdtempSync(join(tmpdir(), 'd2host-isc-'))
  try {
    const buildDir = process.env.ORACLE_BUILD ?? join(pfx, 'build')
    execFileSync('bash', [buildScript, buildDir], { cwd: repoRoot, stdio: 'pipe', timeout: 30_000 })
    cpSync(join(oracleRoot, 'wine/prefix'), pfx, { recursive: true, verbatimSymlinks: true })
    const wineDir = join(oracleRoot, 'wine/root/usr/lib/x86_64-linux-gnu/wine')
    const driveD2 = join(pfx, 'drive_c/D2')
    cpSync(join(buildDir, 'd2host-113c.exe'), join(driveD2, 'd2host-113c.exe'))
    const env = {
      ...process.env,
      WINEPREFIX: pfx,
      WINESERVER: join(wineDir, 'wineserver'),
      WINELOADER: join(wineDir, 'wine'),
      WINEDEBUG: '-all',
      WINEDLLOVERRIDES: 'mscoree,mshtml=;winex11.drv=;winedbg.exe=d',
      DISPLAY: '',
    }
    execFileSync(join(wineDir, 'wine'), ['d2host-113c.exe', '--dump-isc', 'C:\\D2\\isc_postload.bin'], {
      cwd: driveD2,
      env,
      stdio: 'pipe',
      timeout: 30_000,
    })
    try {
      execFileSync(join(wineDir, 'wineserver'), ['-k'], { env, stdio: 'pipe', timeout: 5_000 })
    } catch {
      // ignore if wineserver already exited
    }
    return new Uint8Array(readFileSync(join(driveD2, 'isc_postload.bin')))
  } finally {
    rmSync(pfx, { recursive: true, force: true })
  }
}

describe('ItemStatCost.bin (359 x 0x144) & CharStats.bin (7 x 0xC4) 1.13c parity', () => {
  it('loads all 359 canonical 1.13c stats into DEFAULT_STAT_REGISTRY_113C with contiguous IDs 0..358', () => {
    expect(CANONICAL_ITEM_STAT_COST_113C).toHaveLength(ITEM_STAT_COST_COUNT_113C)
    expect(ITEM_STAT_COST_COUNT_113C).toBe(359)
    expect(DEFAULT_STAT_REGISTRY_113C.size).toBe(359)

    for (let i = 0; i < 359; i++) {
      const entry = CANONICAL_ITEM_STAT_COST_113C[i]!
      expect(entry.statId).toBe(i)
      expect(DEFAULT_STAT_REGISTRY_113C.get(i)).toBe(entry)
    }

    // Verify all 4 direct stats in 1.13c (`bDirect = 1` -> `wMaxStat` clamp target):
    // hitpoints(6)->maxhp(7), mana(8)->maxmana(9), stamina(10)->maxstamina(11), durability(72)->maxdurability(73)
    const directStats = CANONICAL_ITEM_STAT_COST_113C.filter((s) => s.direct)
    expect(directStats.map((s) => [s.statId, s.maxStat])).toEqual([
      [6, 7],
      [8, 9],
      [10, 11],
      [72, 73],
    ])
    for (const s of CANONICAL_ITEM_STAT_COST_113C) {
      if (!s.direct) {
        expect(s.maxStat).toBe(STAT_ID_NONE_113C)
      }
    }

    // Verify post-load runtime dwFlags bits 5..8 (`0x6FDC3DC4..0x6FDC3E7A`) are live on the exact 12 rows:
    const runtimeRows = CANONICAL_ITEM_STAT_COST_113C.filter((s) => s.flags !== s.diskFlags)
    expect(runtimeRows.map((s) => s.statId)).toEqual([
      1, 3, 76, 77, 162, 163, 216, 217, 242, 270, 271, 295,
    ])
    // Row 3 (`vitality`, opStats=[7, 11]): 0x1400 | 0x0040 | 0x0100 | 0x0020 == 0x1560
    expect(CANONICAL_ITEM_STAT_COST_113C[3]!.diskFlags).toBe(0x1400)
    expect(CANONICAL_ITEM_STAT_COST_113C[3]!.flags).toBe(0x1560)
    expect(CANONICAL_ITEM_STAT_COST_113C[3]!.runtimeMaxStat).toBe(true)
    expect(CANONICAL_ITEM_STAT_COST_113C[3]!.runtimeMaxHp).toBe(true)
    expect(CANONICAL_ITEM_STAT_COST_113C[3]!.runtimeMaxMana).toBe(false)
    expect(CANONICAL_ITEM_STAT_COST_113C[3]!.runtimeMaxStam).toBe(true)
    // Row 0 (`strength`) carries dwStuff = 6 (+0x140), rows 1..358 carry 0
    expect(CANONICAL_ITEM_STAT_COST_113C[0]!.stuff).toBe(6)
    for (let i = 1; i < 359; i++) {
      expect(CANONICAL_ITEM_STAT_COST_113C[i]!.stuff).toBe(0)
    }
  })

  it('loads all 7 canonical 1.13c character classes into CANONICAL_CHAR_GROWTH_113C', () => {
    expect(CANONICAL_CHAR_GROWTH_113C).toHaveLength(CHAR_STATS_COUNT_113C)
    expect(CHAR_STATS_COUNT_113C).toBe(7)
    expect(CANONICAL_CHAR_GROWTH_113C.map((c) => c.className)).toEqual([
      'Amazon',
      'Sorceress',
      'Necromancer',
      'Paladin',
      'Barbarian',
      'Druid',
      'Assassin',
    ])
    for (let cls = 0; cls < 7; cls++) {
      expect(DEFAULT_STAT_REGISTRY_113C.getCharGrowth(cls)).toEqual(CANONICAL_CHAR_GROWTH_113C[cls])
    }
  })

  it('matches Patch_D2.mpq ItemStatCost.bin, ItemStatCost.txt, events.txt, and CharStats.bin 100% across all 359 + 7 rows', () => {
    expect(existsSync(patchMpqPath)).toBe(true)
    expect(existsSync(d2ExpMpqPath)).toBe(true)
    const mpq = openMpqFromBuffer('Patch_D2.mpq', readFileSync(patchMpqPath))
    const expMpq = openMpqFromBuffer('d2exp.mpq', readFileSync(d2ExpMpqPath))

    const rawIscBin = mpq.readSync(mpq.find('data\\global\\excel\\ItemStatCost.bin')!)
    const rawIscTxt = new TextDecoder('latin1').decode(
      mpq.readSync(mpq.find('data\\global\\excel\\ItemStatCost.txt')!),
    )
    const eventsEntry = mpq.find('data\\global\\excel\\events.txt') ?? expMpq.find('data\\global\\excel\\events.txt')!
    const eventsOwner = mpq.find('data\\global\\excel\\events.txt') ? mpq : expMpq
    const rawEventsTxt = new TextDecoder('latin1').decode(eventsOwner.readSync(eventsEntry))
    const rawCharBin = mpq.readSync(mpq.find('data\\global\\excel\\CharStats.bin')!)

    expect(rawIscBin.byteLength).toBe(4 + ITEM_STAT_COST_COUNT_113C * ITEM_STAT_COST_BIN_STRIDE_113C)
    expect(rawCharBin.byteLength).toBe(4 + CHAR_STATS_COUNT_113C * CHAR_STATS_BIN_STRIDE_113C)

    const parsedIsc = parseItemStatCostBin113c(rawIscBin)
    const parsedIscHeaderless = parseItemStatCostBin113c(rawIscBin.subarray(4))
    expect(parsedIsc).toEqual(CANONICAL_ITEM_STAT_COST_113C)
    expect(parsedIscHeaderless).toEqual(CANONICAL_ITEM_STAT_COST_113C)

    const parsedChars = parseCharStatsBin113c(rawCharBin)
    const parsedCharsHeaderless = parseCharStatsBin113c(rawCharBin.subarray(4))
    expect(parsedChars).toEqual(CANONICAL_CHAR_GROWTH_113C)
    expect(parsedCharsHeaderless).toEqual(CANONICAL_CHAR_GROWTH_113C)

    const eventNameToId = new Map<string, number>()
    const evRows = rawEventsTxt
      .split(/\r?\n/)
      .slice(1)
      .filter((l) => l.split('\t')[0]!.trim().length > 0)
    for (let ei = 0; ei < evRows.length; ei++) {
      eventNameToId.set(evRows[ei]!.split('\t')[0]!.trim().toLowerCase(), ei)
    }

    // Cross-verify every parsed row against ItemStatCost.txt columns as well
    const lines = rawIscTxt.split(/\r?\n/).filter((l) => l.length > 0)
    const headers = lines[0]!.split('\t')
    const colIdx = (name: string) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase())
    const rows = lines.slice(1).filter((l) => {
      const c0 = l.split('\t')[0]!.trim()
      return c0.length > 0 && c0.toLowerCase() !== 'expansion'
    })
    expect(rows).toHaveLength(359)

    const nameToId = new Map<string, number>()
    for (let i = 0; i < 359; i++) {
      nameToId.set(rows[i]!.split('\t')[0]!.trim().toLowerCase(), i)
    }

    for (let i = 0; i < 359; i++) {
      const cols = rows[i]!.split('\t')
      const getNum = (col: string, def = 0): number => {
        const s = (cols[colIdx(col)] ?? '').trim()
        return s === '' ? def : Number(s)
      }
      const getBool = (col: string): boolean => getNum(col, 0) !== 0
      const getStatRef = (col: string): number => {
        const s = (cols[colIdx(col)] ?? '').trim().toLowerCase()
        return s === '' ? STAT_ID_NONE_113C : (nameToId.get(s) ?? STAT_ID_NONE_113C)
      }
      const getEventRef = (col: string): number => {
        const s = (cols[colIdx(col)] ?? '').trim().toLowerCase()
        return s === '' ? STAT_ID_NONE_113C : (eventNameToId.get(s) ?? STAT_ID_NONE_113C)
      }

      const row = parsedIsc[i]!
      expect(row.sendOther).toBe(getBool('Send Other'))
      expect(row.signed).toBe(getBool('Signed'))
      expect(row.damageRelated).toBe(getBool('DamageRelated'))
      expect(row.itemSpecific).toBe(getBool('ItemSpecific'))
      expect(row.direct).toBe(getBool('Direct'))
      expect(row.updateAnimRate).toBe(getBool('UpdateAnimRate'))
      expect(row.fMin).toBe(getBool('fMin'))
      expect(row.fCallback).toBe(getBool('fCallback'))
      expect(row.saved).toBe(getBool('Saved'))
      expect(row.csvSigned).toBe(getBool('CSvSigned'))

      const expectedDiskFlags =
        (row.sendOther ? ISC_FLAG_SEND_OTHER : 0) |
        (row.signed ? ISC_FLAG_SIGNED : 0) |
        (row.damageRelated ? ISC_FLAG_DAMAGE_RELATED : 0) |
        (row.itemSpecific ? ISC_FLAG_ITEM_SPECIFIC : 0) |
        (row.direct ? ISC_FLAG_DIRECT : 0) |
        (row.updateAnimRate ? ISC_FLAG_UPDATE_ANIM_RATE : 0) |
        (row.fMin ? ISC_FLAG_FMIN : 0) |
        (row.fCallback ? ISC_FLAG_FCALLBACK : 0) |
        (row.saved ? ISC_FLAG_SAVED : 0) |
        (row.csvSigned ? ISC_FLAG_CSV_SIGNED : 0)
      expect(row.diskFlags).toBe(expectedDiskFlags >>> 0)

      let expectedPostFlags = expectedDiskFlags
      for (const target of row.opStats ?? []) {
        if (i === 7 || target === 7) {
          expectedPostFlags |= ISC_FLAG_RUNTIME_MAXHP | ISC_FLAG_RUNTIME_MAXSTAT
        } else if (i === 9 || target === 9) {
          expectedPostFlags |= ISC_FLAG_RUNTIME_MAXMANA | ISC_FLAG_RUNTIME_MAXSTAT
        } else if (i === 11 || target === 11) {
          expectedPostFlags |= ISC_FLAG_RUNTIME_MAXSTAM | ISC_FLAG_RUNTIME_MAXSTAT
        }
      }
      expect(row.flags).toBe(expectedPostFlags >>> 0)

      expect(row.sendBits).toBe(getNum('Send Bits'))
      expect(row.sendParamBits).toBe(getNum('Send Param Bits'))
      expect(row.csvBits).toBe(getNum('CSvBits'))
      expect(row.csvParam).toBe(getNum('CSvParam'))
      expect(row.valShift).toBe(getNum('ValShift'))
      expect(row.saveBits).toBe(getNum('Save Bits'))
      expect(row.saveAdd).toBe(getNum('Save Add'))
      expect(row.minAccr).toBe(getNum('MinAccr'))
      expect(row.keepZero).toBe(getBool('KeepZero'))
      expect(row.maxStat).toBe(getStatRef('maxstat'))
      expect(row.itemEvent1).toBe(getEventRef('itemevent1'))
      expect(row.itemEvent2).toBe(getEventRef('itemevent2'))
      expect(row.itemEventFunc1).toBe(getNum('itemeventfunc1'))
      expect(row.itemEventFunc2).toBe(getNum('itemeventfunc2'))
      expect(row.op).toBe(getNum('op'))
      expect(row.opParam).toBe(getNum('op param'))
      expect(row.opBase).toBe(getStatRef('op base'))
      expect(row.stuff).toBe(i === 0 ? getNum('stuff') : 0)

      const rawOpRefs = [getStatRef('op stat1'), getStatRef('op stat2'), getStatRef('op stat3')]
      const expectedOpStats: number[] = []
      if (row.op! > 0 && row.op! < 14) {
        for (const id of rawOpRefs) {
          if (id >= 359) break
          expectedOpStats.push(id)
        }
      }
      expect(row.opStats).toEqual(expectedOpStats)
    }

    // Verify D2Common.dll 0x6FDC3CE3..0x6FDC3EA5 `wBaseDepStats[64]` (+0x5E..+0xDD) & `pOpChain[16]`
    // (+0xDE..+0x13D, 6-byte `{wOpBase, wStat, bOp, bOpParam}` entries) across all 359 stats!
    const reg = new StatTableRegistry113c(parsedIsc, parsedChars)
    const dv = new DataView(rawIscBin.buffer, rawIscBin.byteOffset, rawIscBin.byteLength)

    const dllBaseDeps: number[][] = Array.from({ length: 359 }, () => [])
    const dllReverseOps: Array<
      Array<{ op: number; opParam: number; opBase: number; sourceStat: number }>
    > = Array.from({ length: 359 }, () => [])

    for (let statId = 0; statId < 359; statId++) {
      const base = 4 + statId * ITEM_STAT_COST_BIN_STRIDE_113C
      const bOp = dv.getUint8(base + 0x54)
      if (bOp === 0 || bOp >= 14) continue

      const wOpBase = dv.getUint16(base + 0x56, true)
      if (wOpBase < 359 && dllBaseDeps[wOpBase]!.length < 64) {
        dllBaseDeps[wOpBase]!.push(statId)
      }

      const bOpParam = dv.getUint8(base + 0x55)
      for (let k = 0; k < 3; k++) {
        const wOpStat = dv.getUint16(base + 0x58 + k * 2, true)
        // Exact binary behavior at 0x6FDC3D6F: `cmp eax, [nItemStatCostTxt]; jge 0x6FDC3EA5` -> break!
        if (wOpStat >= 359) break
        if (dllReverseOps[wOpStat]!.length < 16) {
          dllReverseOps[wOpStat]!.push({
            op: bOp,
            opParam: bOpParam,
            opBase: wOpBase,
            sourceStat: statId,
          })
        }
      }
    }

    for (let statId = 0; statId < 359; statId++) {
      expect(reg.getBaseDependents(statId)).toEqual(dllBaseDeps[statId])
      expect(reg.getReverseOps(statId)).toEqual(dllReverseOps[statId])
      expect(DEFAULT_STAT_REGISTRY_113C.getBaseDependents(statId)).toEqual(dllBaseDeps[statId])
      expect(DEFAULT_STAT_REGISTRY_113C.getReverseOps(statId)).toEqual(dllReverseOps[statId])
    }

    // Specifically assert `level` (`statId = 12`) has all 37 `_perlevel` dependents (`214..250`)
    expect(DEFAULT_STAT_REGISTRY_113C.getBaseDependents(12)).toHaveLength(37)
    expect(DEFAULT_STAT_REGISTRY_113C.getBaseDependents(12)[0]).toBe(214)
    expect(DEFAULT_STAT_REGISTRY_113C.getBaseDependents(12)[36]).toBe(250)
  })

  it('matches live Wine D2Common.dll post-load sgptDataTables->pItemStatCostTxt memory across all 359 rows (including +0x51..+0x53 runtime op-target flags derived by StatTableRegistry113c)', () => {
    const liveDump = dumpLivePostLoadItemStatCost()
    expect(liveDump.byteLength).toBe(4 + ITEM_STAT_COST_COUNT_113C * ITEM_STAT_COST_BIN_STRIDE_113C)
    const dv = new DataView(liveDump.buffer, liveDump.byteOffset, liveDump.byteLength)
    expect(dv.getUint32(0, true)).toBe(359)

    for (let statId = 0; statId < 359; statId++) {
      const base = 4 + statId * ITEM_STAT_COST_BIN_STRIDE_113C
      const meta = CANONICAL_ITEM_STAT_COST_113C[statId]!

      // 1. Post-load wStatId (+0x00), dwFlags (+0x04, including runtime bits 5..8), itemevents (+0x48..+0x4F), dwStuff (+0x140)
      expect(dv.getUint16(base + 0x00, true), `stat ${statId} wStatId`).toBe(meta.statId)
      expect(dv.getUint32(base + 0x04, true), `stat ${statId} post-load dwFlags`).toBe(meta.flags)
      expect(dv.getUint16(base + 0x48, true), `stat ${statId} wItemEvent1`).toBe(meta.itemEvent1)
      expect(dv.getUint16(base + 0x4a, true), `stat ${statId} wItemEvent2`).toBe(meta.itemEvent2)
      expect(dv.getUint16(base + 0x4c, true), `stat ${statId} wItemEventFunc1`).toBe(meta.itemEventFunc1)
      expect(dv.getUint16(base + 0x4e, true), `stat ${statId} wItemEventFunc2`).toBe(meta.itemEventFunc2)
      expect(dv.getUint32(base + 0x140, true), `stat ${statId} dwStuff`).toBe(meta.stuff)

      // 1b. Post-load +0x51..+0x53 runtime op-target flags (`bHasOpStat`, `bIsOpTarget`, `bHasDynamicOp`) derived by StatTableRegistry113c
      const op = meta.op !== undefined ? meta.op : 0
      const opStats = meta.opStats !== undefined ? meta.opStats : []
      const baseDeps = DEFAULT_STAT_REGISTRY_113C.getBaseDependents(statId)
      const revOps = DEFAULT_STAT_REGISTRY_113C.getReverseOps(statId)
      const derivedHasOpStat = (op >= 1 && op <= 13 && opStats.length > 0) || baseDeps.length > 0 ? 1 : 0
      const derivedIsOpTarget = revOps.length > 0 ? 1 : 0
      const derivedHasDynOp = op === 4 || op === 5 ? 1 : 0
      expect(dv.getUint8(base + 0x51), `stat ${statId} +0x51 bHasOpStat`).toBe(derivedHasOpStat)
      expect(dv.getUint8(base + 0x52), `stat ${statId} +0x52 bIsOpTarget`).toBe(derivedIsOpTarget)
      expect(dv.getUint8(base + 0x53), `stat ${statId} +0x53 bHasDynamicOp`).toBe(derivedHasDynOp)

      // 2. Live post-load wBaseDepStats[64] (+0x5E..+0xDD, 0xFFFF-terminated)
      const liveDeps: number[] = []
      for (let s = 0; s < 64; s++) {
        const dep = dv.getUint16(base + 0x5e + s * 2, true)
        if (dep === 0xffff) break
        liveDeps.push(dep)
      }
      expect(DEFAULT_STAT_REGISTRY_113C.getBaseDependents(statId), `stat ${statId} wBaseDepStats`).toEqual(liveDeps)

      // 3. Live post-load pOpChain[16] (+0xDE..+0x13D, 6-byte {wOpBase (+0), wStat (+2), bOp (+4), bOpParam (+5)})
      const liveOps: Array<{ op: number; opParam: number; opBase: number; sourceStat: number }> = []
      for (let s = 0; s < 16; s++) {
        const entryOff = base + 0xde + s * 6
        const bOp = dv.getUint8(entryOff + 4)
        if (bOp === 0) break
        liveOps.push({
          opBase: dv.getUint16(entryOff + 0, true),
          sourceStat: dv.getUint16(entryOff + 2, true),
          op: bOp,
          opParam: dv.getUint8(entryOff + 5),
        })
      }
      expect(DEFAULT_STAT_REGISTRY_113C.getReverseOps(statId), `stat ${statId} pOpChain`).toEqual(liveOps)
    }
  }, 60_000)

  it('rejects malformed binary buffer lengths cleanly', () => {
    expect(() => parseItemStatCostBin113c(new Uint8Array(13))).toThrow(RangeError)
    expect(() => parseCharStatsBin113c(new Uint8Array(17))).toThrow(RangeError)
  })
})
