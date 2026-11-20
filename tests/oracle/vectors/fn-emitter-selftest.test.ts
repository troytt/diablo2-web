/**
 * M0b Self-Test & Proof Suite for Generic Data-Driven Real-DLL Function Emitter (`fn-emitter.c`),
 * Request Compiler (`fn-request.ts`), and Strict Replay Helper (`fn-fixture.ts`).
 *
 * Covers:
 * - Request validation, sweep expansion, symbolic `&image+off` resolution, and binary `.fnreq` compilation.
 * - `ReplayMemory113c` strict unloaded-byte detection, write-set tracking, and deterministic arena `alloc()`.
 * - P0 (`D2Common 0x6FD51050` `UNITS_GetX`, custom `ecx = pUnit`, `calleePops = 0`): 19 real-DLL vectors
 *   including NULL unit fault (`0xC0000005`), static NULL path fault, dynamic NULL path `0` return,
 *   and unit type sweep `0..6, -1, 0x7FFFFFFF`.
 * - P1 (`D2Common 0x6FD9DE40` `SKILLS_GetFlags`, `stdcall` 1 stack arg, `calleePops = 4`): 14 real-DLL
 *   vectors including NULL skill (`0`), unmapped skill pointer fault (`0xC0000005`), and `dwFlags`
 *   sweep over `0, 1, 2, 4, 0x80, 0x2000, 0x10000, 0x7FFFFFFF, 0x80000000, 0xDEADBEEF, 0xFFFFFFFF`
 *   with `rand:0x5EED` image fill.
 * - P2 (`D2Common 0x6FD73EF0` `ITEMS_CheckNotBrokenOrUnequipping`, `stdcall` 1 stack arg, `calleePops = 4`):
 *   23 real-DLL vectors verifying NULL item (`0`), non-item unit types (`1`), NULL `pItemData` (`1`),
 *   and `ITEMFLAG_BROKEN (0x100)` / `ITEMFLAG_UNEQUIPPING (0x4000)` flag combinations, plus killing the
 *   pre-M0b K0 divergence (`dwUnitType !== 4 -> 0`) as a mutant.
 * - P3 (`D2Common 0x6FD80530` `UNITS_CanDualWield`, `stdcall` 1 stack arg, `calleePops = 4`):
 *   36 real-DLL vectors with synthetic `sgptDataTables` (`0x6FDE9E1C` -> `+0xA80` `nMonStatsCount`)
 *   covering Player classes (`4`, `6`), Monster classes (`417`, `418`), and truncated table counts
 *   (`417`, `418`, `419`), plus killing the pre-M0b K0 missing-table-bound mutant.
 * - `D2Common 0x6FD87F80` (`STATLIST_FindSubListByStateAndFlags`, `__fastcall (ecx = pStatListEx, edx = stateId)`):
 *   18 real-DLL vectors covering NULL `pStatListEx`, `stateId == 0`, non-extended `dwFlags`,
 *   `pMyLastList (+0x3C)` priority over `pMyStats (+0x40)`, and `pPrevLink (+0x2C)` chain traversal.
 */
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { UNIT_ITEM, UNIT_MONSTER, UNIT_PLAYER, UNITS_GetX113c } from '../../../src/d2kern-113c/common/unit.ts'
import {
  ITEMS_CheckNotBrokenOrUnequipping113c,
  SKILLS_GetFlags113c,
  STATLIST_FindSubListByStateAndFlags113c,
  UNITS_CanDualWield113c,
} from '../../../src/d2kern-113c/game/fallen-ai-113c.ts'
import { D2StatListExStrc, D2StatListStrc, D2UnitStrc } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import {
  expectFnFixtureMatches113c,
  expectMutantsKilled113c,
  loadFnFixture113c,
  ReplayMemory113c,
  replayFnFixture113c,
} from '../../../tools/oracle/vectors/fn-fixture.ts'
import {
  compileFnRequestFromText113c,
  encodeFnRequestBinary113c,
  FN_ARENA_IMAGE_BASE_113C,
} from '../../../tools/oracle/vectors/fn-request.ts'

const ROOT_DIR = resolve(import.meta.dirname, '../../..')
const REQ_DIR = resolve(ROOT_DIR, 'tools/oracle/vectors/requests')
const FIX_DIR = resolve(ROOT_DIR, 'tests/fixtures/oracle/k1')

describe('M0b generic data-driven real-DLL function emitter & replay helper', () => {
  it('compiles request JSON, expands sweeps, resolves &img+off refs, and encodes binary .fnreq', () => {
    const rawJson = JSON.stringify({
      fn: 'TEST_Fn',
      module: 'D2Common',
      va: '0x6FD51050',
      size: 39,
      conv: { stack: 1, regs: ['ecx'], calleePops: 4, returns: 'eax' },
      tables: 'none',
      fill: 'rand:0x1234',
      images: {
        unit: { size: 244 },
        path: { size: 64 },
      },
      vectors: [
        {
          label: 'base',
          init: [
            { img: 'unit', off: '0x2C', u32: '&path+0x04' },
            { img: 'path', off: 4, u16: 1234 },
          ],
          regs: { ecx: '&unit' },
          stack: ['&path'],
        },
      ],
      sweeps: [
        {
          base: 'base',
          field: { img: 'unit', off: 0, type: 'u32' },
          values: [0, 2, 4],
        },
      ],
    })

    const compiled = compileFnRequestFromText113c(rawJson)
    expect(compiled.vectors.length).toBe(4)
    expect(compiled.images[0]!.addr).toBe(FN_ARENA_IMAGE_BASE_113C)
    const pathAddr = compiled.images[1]!.addr
    expect(compiled.vectors[0]!.regs.ecx).toBe(FN_ARENA_IMAGE_BASE_113C)
    expect(compiled.vectors[0]!.stack[0]).toBe(pathAddr)

    const unitDv = new DataView(
      compiled.vectors[0]!.imageBytes[0]!.buffer,
      compiled.vectors[0]!.imageBytes[0]!.byteOffset,
      compiled.vectors[0]!.imageBytes[0]!.byteLength,
    )
    expect(unitDv.getUint32(0x2c, true)).toBe((pathAddr + 4) >>> 0)

    const bin = encodeFnRequestBinary113c(compiled)
    expect(bin.subarray(0, 4).toString('ascii')).toBe('D2FR')
    expect(bin.readUInt32LE(4)).toBe(1)
  })

  it('enforces ReplayMemory113c strict read, write-set, and deterministic alloc() invariants', () => {
    const m = new ReplayMemory113c()
    m.loadHexAt(0x20000000, '01020304')
    expect(m.writtenBytes.size).toBe(0)
    expect(m.u32(0x20000000)).toBe(0x04030201)
    expect(() => m.u8(0x20000004)).toThrow(/read of unloaded byte/)

    m.setU16(0x20000000, 0xbeef)
    expect(m.writtenBytes.has(0x20000000)).toBe(true)
    expect(m.writtenBytes.has(0x20000001)).toBe(true)
    expect(m.writtenBytes.has(0x20000002)).toBe(false)

    m.allocQueue.push([16, 0x21000000])
    expect(() => m.alloc(8)).toThrow(/alloc size mismatch/)
    m.allocQueue.push([16, 0x21000000])
    const ptr = m.alloc(16)
    expect(ptr).toBe(0x21000000)
    expect(m.u32(0x21000000)).toBe(0)
    expect(() => m.alloc(16)).toThrow(/Unexpected alloc/)
  })

  it('P0 (D2Common 0x6FD51050 UNITS_GetX): matches 19 real-DLL vectors including NULL fault and type sweep, and kills mutants', () => {
    const reqPath = resolve(REQ_DIR, 'd2common-0x6fd51050-units-get-x.req.json')
    const fixPath = resolve(FIX_DIR, 'd2common-0x6fd51050-units-get-x.ndjson.gz')
    const fx = loadFnFixture113c(fixPath, reqPath)

    expect(fx.header.va).toBe('0x6FD51050')
    expect(fx.header.fn).toBe('UNITS_GetX')
    expect(fx.header.conv.calleePops).toBe(0)
    expect(fx.decompressedSha256).toBe(
      '6dc2eab4d72d3fcd17d260c361b801980971d5836a17350e7c9c1fb785a2d880',
    )

    const report = expectFnFixtureMatches113c(
      fx,
      (m, _args, regs) => UNITS_GetX113c(m, regs.ecx),
      { minVectors: 19, minFaults: 2 },
    )
    expect(report.total).toBe(19)
    expect(report.faults).toBe(2)

    expectMutantsKilled113c(
      fx,
      (m, _args, regs) => UNITS_GetX113c(m, regs.ecx),
      [
        [
          'swallow-null-fault-return-0',
          (inv) => (m, args, regs, rec) => (regs.ecx === 0 ? 0 : inv(m, args, regs, rec)),
        ],
        [
          'treat-type-2-as-dynamic',
          () => (m, _args, regs) => {
            const pPath = m.u32(regs.ecx + 0x2c)
            return pPath === 0 ? 0 : m.u16(pPath + 0x02)
          },
        ],
      ],
    )
  })

  it('P1 (D2Common 0x6FD9DE40 SKILLS_GetFlags): matches 14 real-DLL vectors with rand:0x5EED fill and kills mutants', () => {
    const reqPath = resolve(REQ_DIR, 'd2common-0x6fd9de40-skills-get-flags.req.json')
    const fixPath = resolve(FIX_DIR, 'd2common-0x6fd9de40-skills-get-flags.ndjson.gz')
    const fx = loadFnFixture113c(fixPath, reqPath)

    expect(fx.header.va).toBe('0x6FD9DE40')
    expect(fx.header.fn).toBe('SKILLS_GetFlags')
    expect(fx.header.conv.calleePops).toBe(4)
    expect(fx.decompressedSha256).toBe(
      'bb4bd6a68453eaa709b9aeee478a9baefdd39ced5dd45a90e463499f5eb310ed',
    )

    const report = expectFnFixtureMatches113c(
      fx,
      (m, args) => SKILLS_GetFlags113c(m, args[0]!),
      { minVectors: 14, minFaults: 1 },
    )
    expect(report.total).toBe(14)
    expect(report.faults).toBe(1)

    expectMutantsKilled113c(
      fx,
      (m, args) => SKILLS_GetFlags113c(m, args[0]!),
      [
        [
          'wrong-offset-0x08',
          () => (m, args) => (args[0]! === 0 ? 0 : m.u32(args[0]! + 0x08)),
        ],
        [
          'missing-null-guard',
          () => (m, args) => m.u32(args[0]! + 0x0c),
        ],
      ],
    )

    // Also verify void return is rejected when conv.returns === 'eax'
    const badVoidReport = replayFnFixture113c(fx, () => undefined)
    expect(badVoidReport.failures.length).toBeGreaterThan(0)
  })

  it('P2 (D2Common 0x6FD73EF0 ITEMS_CheckNotBrokenOrUnequipping): matches 23 real-DLL vectors and kills pre-M0b K0 non-item=0 divergence', () => {
    const reqPath = resolve(
      REQ_DIR,
      'd2common-0x6fd73ef0-items-check-not-broken-or-unequipping.req.json',
    )
    const fixPath = resolve(
      FIX_DIR,
      'd2common-0x6fd73ef0-items-check-not-broken-or-unequipping.ndjson.gz',
    )
    const fx = loadFnFixture113c(fixPath, reqPath)

    expect(fx.header.va).toBe('0x6FD73EF0')
    expect(fx.header.fn).toBe('ITEMS_CheckNotBrokenOrUnequipping')
    expect(fx.header.conv.calleePops).toBe(4)
    expect(fx.decompressedSha256).toBe(
      '9de121eba3a396d968a0de72ce3c63d1063e54afb0aa15b5a9008a351c776457',
    )

    const report = expectFnFixtureMatches113c(
      fx,
      (m, args) => ITEMS_CheckNotBrokenOrUnequipping113c(m, args[0]!),
      { minVectors: 23, minFaults: 2 },
    )
    expect(report.total).toBe(23)
    expect(report.faults).toBe(2)

    expectMutantsKilled113c(
      fx,
      (m, args) => ITEMS_CheckNotBrokenOrUnequipping113c(m, args[0]!),
      [
        [
          'k0-bug-non-item-returns-0',
          () => (m, args) => {
            const pItem = args[0]!
            if (pItem === 0 || m.get(pItem, D2UnitStrc.dwUnitType) !== UNIT_ITEM) return 0
            const pItemData = m.get(pItem, D2UnitStrc.pUnitData)
            if (pItemData !== 0 && (m.u32(pItemData + 0x18) & 0x4100) !== 0) return 0
            return 1
          },
        ],
        [
          'ignore-broken-flag-0x100',
          () => (m, args) => {
            const pItem = args[0]!
            if (pItem === 0) return 0
            if (m.get(pItem, D2UnitStrc.dwUnitType) !== UNIT_ITEM) return 1
            const pItemData = m.get(pItem, D2UnitStrc.pUnitData)
            if (pItemData !== 0 && (m.u32(pItemData + 0x18) & 0x4000) !== 0) return 0
            return 1
          },
        ],
        [
          'ignore-unequipping-flag-0x4000',
          () => (m, args) => {
            const pItem = args[0]!
            if (pItem === 0) return 0
            if (m.get(pItem, D2UnitStrc.dwUnitType) !== UNIT_ITEM) return 1
            const pItemData = m.get(pItem, D2UnitStrc.pUnitData)
            if (pItemData !== 0 && (m.u32(pItemData + 0x18) & 0x0100) !== 0) return 0
            return 1
          },
        ],
      ],
    )
  })

  it('P3 (D2Common 0x6FD80530 UNITS_CanDualWield): matches 36 real-DLL vectors with synthetic sgptDataTables and kills K0 missing-bound mutant', () => {
    const reqPath = resolve(REQ_DIR, 'd2common-0x6fd80530-units-can-dual-wield.req.json')
    const fixPath = resolve(FIX_DIR, 'd2common-0x6fd80530-units-can-dual-wield.ndjson.gz')
    const fx = loadFnFixture113c(fixPath, reqPath)

    expect(fx.header.va).toBe('0x6FD80530')
    expect(fx.header.fn).toBe('UNITS_CanDualWield')
    expect(fx.header.conv.calleePops).toBe(4)
    expect(fx.header.tables).toBe('synthetic')
    expect(fx.decompressedSha256).toBe(
      '97a2af5e79e2b9ce3b48f8ca11871bf6188c4bc9989e7224c9d32c9a4e92aad0',
    )

    const report = expectFnFixtureMatches113c(
      fx,
      (m, args) => UNITS_CanDualWield113c(m, args[0]!),
      { minVectors: 36, minFaults: 1 },
    )
    expect(report.total).toBe(36)
    expect(report.faults).toBe(1)

    expectMutantsKilled113c(
      fx,
      (m, args) => UNITS_CanDualWield113c(m, args[0]!),
      [
        [
          'k0-bug-missing-sgptDataTables-bound-check',
          () => (m, args) => {
            const pUnit = args[0]!
            if (pUnit === 0) return 0
            const uType = m.get(pUnit, D2UnitStrc.dwUnitType)
            const classId = m.get(pUnit, D2UnitStrc.dwClassId) >>> 0
            if (uType === UNIT_PLAYER) return classId === 4 || classId === 6 ? 1 : 0
            if (uType === UNIT_MONSTER) return classId === 417 || classId === 418 ? 1 : 0
            return 0
          },
        ],
        [
          'drop-assassin-class-6',
          () => (m, args) => {
            const pUnit = args[0]!
            if (pUnit === 0) return 0
            if (m.get(pUnit, D2UnitStrc.dwUnitType) === UNIT_PLAYER && m.get(pUnit, D2UnitStrc.dwClassId) === 6) {
              return 0
            }
            return UNITS_CanDualWield113c(m, pUnit)
          },
        ],
      ],
    )
  })

  it('D2Common 0x6FD87F80 STATLIST_FindSubListByStateAndFlags: matches 18 real-DLL vectors and kills chain/flag mutants', () => {
    const reqPath = resolve(
      REQ_DIR,
      'd2common-0x6fd87f80-statlist-find-sublist-by-state-and-flags.req.json',
    )
    const fixPath = resolve(
      FIX_DIR,
      'd2common-0x6fd87f80-statlist-find-sublist-by-state-and-flags.ndjson.gz',
    )
    const fx = loadFnFixture113c(fixPath, reqPath)

    expect(fx.header.va).toBe('0x6FD87F80')
    expect(fx.header.fn).toBe('STATLIST_FindSubListByStateAndFlags')
    expect(fx.header.conv.calleePops).toBe(0)
    expect(fx.decompressedSha256).toBe(
      '61f2f5d3bf2247f68be4bc609112e10538ec80cfa61f446c7f5db147e8e4c591',
    )

    const report = expectFnFixtureMatches113c(
      fx,
      (m, _args, regs) => STATLIST_FindSubListByStateAndFlags113c(m, regs.ecx, regs.edx),
      { minVectors: 18, minFaults: 1 },
    )
    expect(report.total).toBe(18)
    expect(report.faults).toBe(1)

    expectMutantsKilled113c(
      fx,
      (m, _args, regs) => STATLIST_FindSubListByStateAndFlags113c(m, regs.ecx, regs.edx),
      [
        [
          'skip-extended-flag-check',
          () => (m, _args, regs) => {
            const pStatListEx = regs.ecx
            const stateId = regs.edx
            if (pStatListEx === 0 || stateId === 0) return 0
            for (
              let sub = m.get(pStatListEx, D2StatListExStrc.pMyLastList);
              sub !== 0;
              sub = m.get(sub, D2StatListStrc.pPrevLink)
            ) {
              if (m.get(sub, D2StatListStrc.dwStateNo) === (stateId >>> 0)) return sub
            }
            return 0
          },
        ],
        [
          'walk-myStats-before-myLastList',
          () => (m, _args, regs) => {
            const pStatListEx = regs.ecx
            const stateId = regs.edx
            if (pStatListEx === 0 || stateId === 0) return 0
            if ((m.get(pStatListEx, D2StatListStrc.dwFlags) & 0x80000000) === 0) return 0
            for (
              let sub = m.get(pStatListEx, D2StatListExStrc.pMyStats);
              sub !== 0;
              sub = m.get(sub, D2StatListStrc.pPrevLink)
            ) {
              if (m.get(sub, D2StatListStrc.dwStateNo) === (stateId >>> 0)) return sub
            }
            for (
              let sub = m.get(pStatListEx, D2StatListExStrc.pMyLastList);
              sub !== 0;
              sub = m.get(sub, D2StatListStrc.pPrevLink)
            ) {
              if (m.get(sub, D2StatListStrc.dwStateNo) === (stateId >>> 0)) return sub
            }
            return 0
          },
        ],
      ],
    )
  })
})
