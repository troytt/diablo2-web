import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { Heap113c } from '../../src/d2kern-113c/mem/heap.ts'
import {
  D2ActStrc,
  D2ActStrc_SIZE,
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2AiCmdStrc_SIZE,
  D2AiControlStrc_SIZE,
  D2AiGeneralStrc_SIZE,
  D2DamageStrc,
  D2DamageStrc_SIZE,
  D2DynamicPathStrc,
  D2DynamicPathStrc_SIZE,
  D2EnvironmentStrc,
  D2EnvironmentStrc_SIZE,
  D2EventStrc,
  D2EventStrc_SIZE,
  D2GameStrc,
  D2GameStrc_SIZE,
  D2MonsterDataStrc,
  D2MonsterDataStrc_SIZE,
  D2RoomCollisionGridStrc,
  D2RoomCollisionGridStrc_SIZE,
  D2RoomCoordListStrc,
  D2RoomCoordListStrc_SIZE,
  D2RoomExStrc,
  D2RoomExStrc_SIZE,
  D2StatListExStrc,
  D2StatListExStrc_SIZE,
  D2StatListStrc,
  D2StatListStrc_SIZE,
  D2TimerStrc,
  D2TimerStrc_SIZE,
  D2UnitStrc,
  D2UnitStrc_SIZE,
} from '../../src/d2kern-113c/mem/layout.generated.ts'
import { isOracleToolchainAvailable113c } from '../../tools/oracle/fn-daemon.ts'

/**
 * Route-2 layout gate (`§3.4` / `§3.5`): generated layout in `src/d2kern-113c/mem/layout.generated.ts`
 * is checked against both:
 * 1. Raw 1.13c oracle memory (`a1c-memdump-f820.ndjson.gz` at `F801`, `F820`, `F821`), and
 * 2. Live 1.13c Wine memory (`d2host-113c.exe --dump-layout`) covering full `D2GameStrc` (`0x1DF4`),
 *    `D2ActStrc` (`0x60`), `D2EnvironmentStrc` (`0x38`), `D2ActiveRoomStrc` (`0x80`),
 *    `D2RoomExStrc` (`0xEC`), `D2RoomCollisionGridStrc` (`0x24`), and `D2RoomCoordListStrc` (`0x30`).
 */
interface Block {
  readonly n: string
  readonly a: number
  readonly h: string | null
}
interface Dump {
  readonly type: number
  readonly id: number
  readonly blocks: readonly Block[]
}
interface DmgTraceEntry {
  readonly def: readonly [number, number]
  readonly raw: readonly number[]
  readonly ret: number
}
interface FrameRec {
  readonly frame: number
  readonly gs: readonly [number, number]
  readonly t0: readonly (readonly number[])[]
  readonly t1?: readonly (readonly number[])[]
  readonly dmg?: readonly DmgTraceEntry[]
  readonly mem: readonly Dump[]
}

const REPO = join(import.meta.dirname, '..', '..')
const FIXTURE_PATH = join(REPO, 'tests/fixtures/oracle/route2/a1c-memdump-f820.ndjson.gz')
const SAVE_FIXTURE = join(REPO, 'tests/fixtures/oracle/saves/a1-barbarian-l1.d2s')
const records: FrameRec[] = gunzipSync(readFileSync(FIXTURE_PATH))
  .toString('utf8')
  .split('\n')
  .filter((l) => l.trim() !== '')
  .filter((l) => l.includes('"mem":'))
  .map((l) => JSON.parse(l) as FrameRec)

function load(heap: Heap113c, b: Block): { ptr: number; bytes: Uint8Array } {
  if (b.h === null) throw new Error(`block ${b.n} unreadable`)
  const bytes = Uint8Array.from(Buffer.from(b.h, 'hex'))
  const p = heap.alloc(bytes.length)
  heap.loadBlock(p, bytes)
  return { ptr: p, bytes }
}

function dumpLiveServerLayout(): { rawNdjson: string; rec: FrameRec } {
  expect(isOracleToolchainAvailable113c()).toBe(true)
  const oracleRoot = process.env.D2_ORACLE_ROOT ?? join(homedir(), '.local/opt/d2oracle')
  const buildScript = join(REPO, 'tools/oracle/headless/build.sh')
  const pfx = mkdtempSync(join(tmpdir(), 'd2host-layout-'))
  try {
    const buildDir = process.env.ORACLE_BUILD ?? join(pfx, 'build')
    execFileSync('bash', [buildScript, buildDir], { cwd: REPO, stdio: 'pipe', timeout: 30_000 })
    cpSync(join(oracleRoot, 'wine/prefix'), pfx, { recursive: true, verbatimSymlinks: true })
    const wineDir = join(oracleRoot, 'wine/root/usr/lib/x86_64-linux-gnu/wine')
    const driveD2 = join(pfx, 'drive_c/D2')
    mkdirSync(join(driveD2, 'Save'), { recursive: true })
    cpSync(join(buildDir, 'd2host-113c.exe'), join(driveD2, 'd2host-113c.exe'))
    cpSync(SAVE_FIXTURE, join(driveD2, 'Save/Oracle.d2s'))
    const env = {
      ...process.env,
      WINEPREFIX: pfx,
      WINESERVER: join(wineDir, 'wineserver'),
      WINELOADER: join(wineDir, 'wine'),
      WINEDEBUG: '-all',
      WINEDLLOVERRIDES: 'mscoree,mshtml=;winex11.drv=;winedbg.exe=d',
      DISPLAY: '',
    }
    execFileSync(
      join(wineDir, 'wine'),
      ['d2host-113c.exe', '--seed', '12345', '--dump-layout', 'C:\\D2\\layout_live.ndjson'],
      { cwd: driveD2, env, stdio: 'pipe', timeout: 30_000 },
    )
    try {
      execFileSync(join(wineDir, 'wineserver'), ['-k'], { env, stdio: 'pipe', timeout: 5_000 })
    } catch {
      // ignore if wineserver already exited
    }
    const rawNdjson = readFileSync(join(driveD2, 'layout_live.ndjson'), 'utf8')
    const rec = JSON.parse(rawNdjson.trim()) as FrameRec
    return { rawNdjson, rec }
  } finally {
    rmSync(pfx, { recursive: true, force: true })
  }
}

describe('route-2 layout vs 1.13c binary & oracle memory (a1c F801/F820/F821 + live Wine dump)', () => {
  it('enforces exact 1.13c Fog.#10042 / D2Common / D2Game struct allocation sizes and tail offsets', () => {
    expect(D2UnitStrc_SIZE).toBe(0xf4)
    expect(D2StatListStrc_SIZE).toBe(0x3c)
    expect(D2StatListExStrc_SIZE).toBe(0x64)
    expect(D2MonsterDataStrc_SIZE).toBe(0x60)
    expect(D2AiGeneralStrc_SIZE).toBe(0x40)
    expect(D2AiCmdStrc_SIZE).toBe(0x1c)
    expect(D2AiControlStrc_SIZE).toBe(0x24)
    expect(D2EventStrc_SIZE).toBe(0x30)
    expect(D2TimerStrc_SIZE).toBe(0xa20)
    expect(D2GameStrc_SIZE).toBe(0x1df4)
    expect(D2ActiveRoomStrc_SIZE).toBe(0x80)
    expect(D2DynamicPathStrc_SIZE).toBe(0x200)
    expect(D2DamageStrc_SIZE).toBe(0x70)
    expect(D2ActStrc_SIZE).toBe(0x60)
    expect(D2EnvironmentStrc_SIZE).toBe(0x38)
    expect(D2RoomExStrc_SIZE).toBe(0xec)
    expect(D2RoomCoordListStrc_SIZE).toBe(0x30)
    expect(D2RoomCollisionGridStrc_SIZE).toBe(0x24)

    expect(D2GameStrc.dwMonSpawnCount.off).toBe(0x1d70)
    expect(D2GameStrc.dwMonSpawnCount.count).toBe(17)
    expect(D2GameStrc.dwMonSpawnTotal.off).toBe(0x1db4)
    expect(D2GameStrc.dwUberStateEnd.off).toBe(0x1df0)

    expect(D2ActStrc.pDrlg.off).toBe(0x48)
    expect(D2ActStrc.pActMisc.off).toBe(0x48)
    expect(D2ActStrc.pfnActCallBack.off).toBe(0x50)
    expect(D2ActStrc.bHasCallback.off).toBe(0x50)
    expect(D2ActiveRoomStrc.pAct.off).toBe(0x2c)
    expect(D2ActiveRoomStrc.pActUpdateFlag.off).toBe(0x2c)
    expect(D2RoomExStrc.pStatusPrev.off).toBe(0x1c)
    expect(D2RoomExStrc.nRoomStatus.off).toBe(0x44)
    expect(D2RoomExStrc.bTriggerType.off).toBe(0x44)
    expect(D2RoomExStrc.pStatusNext.off).toBe(0xe8)
    expect(D2RoomExStrc.pRoomExNext.off).toBe(0xe8)
    expect(D2RoomCoordListStrc.nEndGameX.off).toBe(0x08)
    expect(D2RoomCoordListStrc.nBox0Width.off).toBe(0x08)
    expect(D2RoomCoordListStrc.nEndGameY.off).toBe(0x0c)
    expect(D2RoomCoordListStrc.nBox0Height.off).toBe(0x0c)
    expect(D2RoomCoordListStrc.nEndTileX.off).toBe(0x18)
    expect(D2RoomCoordListStrc.nBox1Width.off).toBe(0x18)
    expect(D2RoomCoordListStrc.nEndTileY.off).toBe(0x1c)
    expect(D2RoomCoordListStrc.nBox1Height.off).toBe(0x1c)
  })

  it('catches 100% (59/59) of struct size and field offset mutations via route2-layout-check.py', () => {
    const baseDoc = JSON.parse(readFileSync(join(REPO, 'docs/oracle/route2-layout.json'), 'utf8'))
    const mutations: Array<{ name: string; fn: (doc: typeof baseDoc) => void }> = [
      { name: 'size:D2GameStrc+4', fn: (d) => (d.structs.D2GameStrc.size = 0x1df8) },
      { name: 'size:D2GameStrc-4', fn: (d) => (d.structs.D2GameStrc.size = 0x1df0) },
      { name: 'size:D2UnitStrc', fn: (d) => (d.structs.D2UnitStrc.size = 0x100) },
      { name: 'size:D2MonsterDataStrc', fn: (d) => (d.structs.D2MonsterDataStrc.size = 0x100) },
      { name: 'size:D2AiGeneralStrc', fn: (d) => (d.structs.D2AiGeneralStrc.size = 0x80) },
      { name: 'size:D2AiControlStrc', fn: (d) => (d.structs.D2AiControlStrc.size = 0x40) },
      { name: 'size:D2AiCmdStrc', fn: (d) => (d.structs.D2AiCmdStrc.size = 0x30) },
      { name: 'size:D2StatListStrc', fn: (d) => (d.structs.D2StatListStrc.size = 0x40) },
      { name: 'size:D2StatListExStrc', fn: (d) => (d.structs.D2StatListExStrc.size = 0x80) },
      { name: 'size:D2DynamicPathStrc', fn: (d) => (d.structs.D2DynamicPathStrc.size = 0x220) },
      { name: 'size:D2EventStrc', fn: (d) => (d.structs.D2EventStrc.size = 0x40) },
      { name: 'size:D2TimerStrc', fn: (d) => (d.structs.D2TimerStrc.size = 0xa40) },
      { name: 'size:D2DamageStrc', fn: (d) => (d.structs.D2DamageStrc.size = 0x80) },
      { name: 'size:D2ActStrc', fn: (d) => (d.structs.D2ActStrc.size = 0x80) },
      { name: 'size:D2EnvironmentStrc', fn: (d) => (d.structs.D2EnvironmentStrc.size = 0x40) },
      { name: 'size:D2ActiveRoomStrc', fn: (d) => (d.structs.D2ActiveRoomStrc.size = 0x90) },
      { name: 'size:D2RoomExStrc', fn: (d) => (d.structs.D2RoomExStrc.size = 0xf0) },
      { name: 'size:D2RoomCoordListStrc', fn: (d) => (d.structs.D2RoomCoordListStrc.size = 0x40) },
      { name: 'size:D2RoomCollisionGridStrc', fn: (d) => (d.structs.D2RoomCollisionGridStrc.size = 0x30) },
    ]
    const fieldTargets: Array<[string, string, number]> = [
      ['D2GameStrc', 'dwUberStateEnd', 4],
      ['D2GameStrc', 'dwMonSpawnTotal', 4],
      ['D2GameStrc', 'dwMonSpawnCount', 4],
      ['D2GameStrc', 'pTileList', 4],
      ['D2GameStrc', 'dwInitSeed', 4],
      ['D2GameStrc', 'pClientList', 4],
      ['D2GameStrc', 'dwGameFrame', 4],
      ['D2GameStrc', 'pTimer', 4],
      ['D2ActStrc', 'pEnvironment', 4],
      ['D2ActStrc', 'dwTownId', 4],
      ['D2ActStrc', 'dwMapSeed', 4],
      ['D2ActStrc', 'pRoom1', 4],
      ['D2ActStrc', 'nAct', 4],
      ['D2ActStrc', 'pDrlg', 4],
      ['D2ActStrc', 'pfnActCallBack', 4],
      ['D2ActStrc', 'bInitialized', 4],
      ['D2ActStrc', 'pMemPool', 4],
      ['D2EnvironmentStrc', 'dwCycleIndex', 4],
      ['D2EnvironmentStrc', 'nTimeOfDay', 4],
      ['D2EnvironmentStrc', 'dwTicks', 4],
      ['D2EnvironmentStrc', 'dwIntensity', 4],
      ['D2EnvironmentStrc', 'bRed', 1],
      ['D2EnvironmentStrc', 'dwCyclePeriod', 4],
      ['D2EnvironmentStrc', 'bEclipse', 4],
      ['D2RoomCoordListStrc', 'nBox0PosX', 4],
      ['D2RoomCoordListStrc', 'nEndGameX', 4],
      ['D2RoomCoordListStrc', 'nBox1PosX', 4],
      ['D2RoomCoordListStrc', 'nEndTileX', 4],
      ['D2RoomCoordListStrc', 'bNode', 4],
      ['D2RoomCoordListStrc', 'nIndex', 4],
      ['D2RoomCoordListStrc', 'pNext', 4],
      ['D2RoomExStrc', 'pStatusPrev', 4],
      ['D2RoomExStrc', 'nRoomStatus', 4],
      ['D2RoomExStrc', 'pStatusNext', 4],
      ['D2ActiveRoomStrc', 'pAct', 4],
      ['D2ActiveRoomStrc', 'nPlayers', 4],
      ['D2UnitStrc', 'pCombat', 4],
      ['D2UnitStrc', 'pSkills', 4],
      ['D2StatListExStrc', 'pModStat', 4],
      ['D2TimerStrc', 'pPool', 4],
    ]
    for (const [sname, fname, delta] of fieldTargets) {
      mutations.push({
        name: `field:${sname}.${fname}`,
        fn: (d) => {
          const fld = d.structs[sname].fields.find((x: { name: string }) => x.name === fname)
          expect(fld).toBeDefined()
          fld.off = fld.off >= delta ? fld.off - delta : fld.off + delta
        },
      })
    }
    expect(mutations.length).toBe(59)

    const tmpDir = mkdtempSync(join(tmpdir(), 'd2layout-mut-'))
    try {
      let caught = 0
      for (let i = 0; i < mutations.length; i++) {
        const mut = mutations[i]!
        const doc = structuredClone(baseDoc)
        mut.fn(doc)
        const mutPath = join(tmpDir, `mut-${i}.json`)
        writeFileSync(mutPath, JSON.stringify(doc))
        let failed = false
        try {
          execFileSync('python3', ['tools/oracle/route2-layout-check.py'], {
            cwd: REPO,
            env: { ...process.env, ROUTE2_LAYOUT_JSON: mutPath },
            stdio: 'pipe',
          })
        } catch {
          failed = true
        }
        expect(failed, `expected mutation ${mut.name} to fail route2-layout-check.py`).toBe(true)
        if (failed) caught++
      }
      expect(caught).toBe(59)
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  }, 60_000)

  it('verifies generated layout + Python check + live Wine dump for Game/Act/Env/Room1/RoomEx/CollGrid/CoordList', () => {
    execFileSync(join(REPO, 'node_modules/.bin/tsx'), ['tools/oracle/gen-route2-layout.ts', '--check'], { cwd: REPO })

    const { rawNdjson, rec } = dumpLiveServerLayout()
    const tmpDir = mkdtempSync(join(tmpdir(), 'd2layout-chk-'))
    try {
      const livePath = join(tmpDir, 'layout_live.ndjson')
      execFileSync('python3', ['-c', 'import sys; open(sys.argv[1], "w").write(sys.argv[2])', livePath, rawNdjson])
      const out = execFileSync('python3', ['tools/oracle/route2-layout-check.py', FIXTURE_PATH, livePath], {
        cwd: REPO,
        encoding: 'utf8',
      })
      expect(out).toContain('checks passed')
      expect(out).not.toContain('FAIL ')
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }

    const dump = rec.mem[0]!
    const heap = new Heap113c()
    const byName = new Map<string, { block: Block; ptr: number; bytes: Uint8Array }>()
    const roomUnits: { block: Block; ptr: number }[] = []
    for (const b of dump.blocks) {
      if (b.h === null) continue
      const loaded = load(heap, b)
      if (b.n === 'roomunit') roomUnits.push({ block: b, ptr: loaded.ptr })
      else if (b.n !== 'event' && b.n !== 'childstatlist' && b.n !== 'adjroom') {
        byName.set(b.n, { block: b, ptr: loaded.ptr, bytes: loaded.bytes })
      }
    }

    const game = byName.get('game')!
    const unit = byName.get('unit')!
    const act = byName.get('act')!
    const env = byName.get('env')!
    const room = byName.get('room')!
    const roomex = byName.get('roomex')!
    const collgrid = byName.get('collgrid')!
    const coordlist = byName.get('coordlist')!

    expect(game.bytes.length).toBe(D2GameStrc_SIZE)
    expect(unit.bytes.length).toBe(D2UnitStrc_SIZE)
    let spawnSum = 0
    for (let k = 1; k < 17; k++) {
      spawnSum += heap.get(game.ptr, D2GameStrc.dwMonSpawnCount, k)
    }
    expect(spawnSum).toBeGreaterThan(0)
    expect(heap.get(game.ptr, D2GameStrc.dwMonSpawnTotal)).toBe(spawnSum)
    expect([0, 1]).toContain(heap.get(game.ptr, D2GameStrc.dwUberStateEnd))

    expect(act.bytes.length).toBe(D2ActStrc_SIZE)
    expect(act.block.a).toBe(heap.get(unit.ptr, D2UnitStrc.pAct))
    expect(heap.get(act.ptr, D2ActStrc.nAct)).toBe(heap.get(unit.ptr, D2UnitStrc.nAct))
    expect(heap.get(act.ptr, D2ActStrc.dwTownId)).toBeGreaterThanOrEqual(1)
    expect(heap.get(act.ptr, D2ActStrc.pRoom1)).not.toBe(0)
    expect(heap.get(act.ptr, D2ActStrc.pDrlg)).not.toBe(0)
    expect(heap.get(act.ptr, D2ActStrc.pActMisc)).toBe(heap.get(act.ptr, D2ActStrc.pDrlg))
    expect(heap.get(act.ptr, D2ActStrc.pEnvironment)).toBe(env.block.a)

    expect(env.bytes.length).toBe(D2EnvironmentStrc_SIZE)
    expect(heap.get(env.ptr, D2EnvironmentStrc.dwCycleIndex)).toBeLessThan(6)
    expect(heap.get(env.ptr, D2EnvironmentStrc.dwCyclePeriod)).toBeGreaterThan(0)
    expect(heap.get(env.ptr, D2EnvironmentStrc.dwIntensity)).toBeGreaterThan(0)
    expect(heap.get(env.ptr, D2EnvironmentStrc.bRed)).toBeGreaterThan(0)
    expect(heap.get(env.ptr, D2EnvironmentStrc.bGreen)).toBeGreaterThan(0)
    expect(heap.get(env.ptr, D2EnvironmentStrc.bBlue)).toBeGreaterThan(0)

    expect(room.bytes.length).toBe(D2ActiveRoomStrc_SIZE)
    expect(roomex.bytes.length).toBe(D2RoomExStrc_SIZE)
    expect(heap.get(room.ptr, D2ActiveRoomStrc.pAct)).toBe(act.block.a)
    expect(heap.get(room.ptr, D2ActiveRoomStrc.pRoomEx)).toBe(roomex.block.a)
    expect(heap.get(roomex.ptr, D2RoomExStrc.pRoom1)).toBe(room.block.a)
    expect(heap.get(roomex.ptr, D2RoomExStrc.nTileXPos)).toBe(heap.get(room.ptr, D2ActiveRoomStrc.nTileX))
    expect(heap.get(roomex.ptr, D2RoomExStrc.nTileYPos)).toBe(heap.get(room.ptr, D2ActiveRoomStrc.nTileY))
    expect(heap.get(roomex.ptr, D2RoomExStrc.nTileWidth)).toBe(heap.get(room.ptr, D2ActiveRoomStrc.nTileWidth))
    expect(heap.get(roomex.ptr, D2RoomExStrc.nTileHeight)).toBe(heap.get(room.ptr, D2ActiveRoomStrc.nTileHeight))
    expect(heap.get(roomex.ptr, D2RoomExStrc.nRoomStatus)).toBeLessThan(4)
    expect(heap.get(roomex.ptr, D2RoomExStrc.pLevel)).not.toBe(0)
    expect(heap.get(roomex.ptr, D2RoomExStrc.pLogicalRoomInfo)).not.toBe(0)

    expect(collgrid.bytes.length).toBe(D2RoomCollisionGridStrc_SIZE)
    expect(heap.get(room.ptr, D2ActiveRoomStrc.pCollisionGrid)).toBe(collgrid.block.a)
    expect(heap.get(collgrid.ptr, D2RoomCollisionGridStrc.nSubtileX)).toBe(heap.get(room.ptr, D2ActiveRoomStrc.nSubtileX))
    expect(heap.get(collgrid.ptr, D2RoomCollisionGridStrc.nSubtileY)).toBe(heap.get(room.ptr, D2ActiveRoomStrc.nSubtileY))
    expect(heap.get(collgrid.ptr, D2RoomCollisionGridStrc.nSubtileWidth)).toBe(heap.get(room.ptr, D2ActiveRoomStrc.nSubtileWidth))
    expect(heap.get(collgrid.ptr, D2RoomCollisionGridStrc.nSubtileHeight)).toBe(heap.get(room.ptr, D2ActiveRoomStrc.nSubtileHeight))
    expect(heap.get(collgrid.ptr, D2RoomCollisionGridStrc.nTileX)).toBe(heap.get(room.ptr, D2ActiveRoomStrc.nTileX))
    expect(heap.get(collgrid.ptr, D2RoomCollisionGridStrc.nTileY)).toBe(heap.get(room.ptr, D2ActiveRoomStrc.nTileY))
    expect(heap.get(collgrid.ptr, D2RoomCollisionGridStrc.nTileWidth)).toBe(heap.get(room.ptr, D2ActiveRoomStrc.nTileWidth))
    expect(heap.get(collgrid.ptr, D2RoomCollisionGridStrc.nTileHeight)).toBe(heap.get(room.ptr, D2ActiveRoomStrc.nTileHeight))
    expect(heap.get(collgrid.ptr, D2RoomCollisionGridStrc.pMapStart)).toBe(collgrid.block.a + D2RoomCollisionGridStrc_SIZE)

    expect(coordlist.bytes.length).toBe(D2RoomCoordListStrc_SIZE)
    const tx = heap.get(roomex.ptr, D2RoomExStrc.nTileXPos)
    const ty = heap.get(roomex.ptr, D2RoomExStrc.nTileYPos)
    const tw = heap.get(roomex.ptr, D2RoomExStrc.nTileWidth)
    const th = heap.get(roomex.ptr, D2RoomExStrc.nTileHeight)
    expect(heap.get(coordlist.ptr, D2RoomCoordListStrc.nBox0PosX)).toBeGreaterThanOrEqual(tx)
    expect(heap.get(coordlist.ptr, D2RoomCoordListStrc.nEndGameX)).toBeLessThanOrEqual(tx + tw)
    expect(heap.get(coordlist.ptr, D2RoomCoordListStrc.nBox0PosY)).toBeGreaterThanOrEqual(ty)
    expect(heap.get(coordlist.ptr, D2RoomCoordListStrc.nEndGameY)).toBeLessThanOrEqual(ty + th)
    expect(heap.get(coordlist.ptr, D2RoomCoordListStrc.nBox1PosX)).toBeGreaterThanOrEqual(tx)
    expect(heap.get(coordlist.ptr, D2RoomCoordListStrc.nEndTileX)).toBeLessThanOrEqual(tx + tw)
    expect(heap.get(coordlist.ptr, D2RoomCoordListStrc.nBox1PosY)).toBeGreaterThanOrEqual(ty)
    expect(heap.get(coordlist.ptr, D2RoomCoordListStrc.nEndTileY)).toBeLessThanOrEqual(ty + th)
    expect(heap.get(coordlist.ptr, D2RoomCoordListStrc.nIndex)).toBeGreaterThanOrEqual(1)

    expect(roomUnits.length).toBeGreaterThanOrEqual(1)
    expect(roomUnits[0]!.block.a).toBe(heap.get(room.ptr, D2ActiveRoomStrc.pUnitFirst))
    expect(roomUnits.some((ru) => ru.block.a === unit.block.a)).toBe(true)
  }, 60_000)

  it('captures real D2DamageStrc (112B) at F801 on lethal hit against Fallen #12', () => {
    const f801 = records.find((r) => r.frame === 801)
    expect(f801).toBeDefined()
    const dump12 = f801!.mem.find((m) => m.type === 1 && m.id === 12)
    expect(dump12).toBeDefined()
    const dmgBlock = dump12!.blocks.find((b) => b.n === 'damage')
    expect(dmgBlock?.h).toBeTruthy()
  })

  for (const rec of records) {
    for (const dump of rec.mem) {
      it(`F${rec.frame} unit ${dump.type}:${dump.id}`, () => {
        const heap = new Heap113c()
        const byName = new Map<string, { block: Block; ptr: number; bytes: Uint8Array }>()
        const events: { block: Block; ptr: number }[] = []
        const childLists: { block: Block; ptr: number }[] = []
        for (const b of dump.blocks) {
          if (b.h === null) continue
          const loaded = load(heap, b)
          if (b.n === 'event') events.push({ block: b, ptr: loaded.ptr })
          else if (b.n === 'childstatlist') childLists.push({ block: b, ptr: loaded.ptr })
          else if (b.n !== 'adjroom' && b.n !== 'aiminion' && b.n !== 'childstats') {
            byName.set(b.n, { block: b, ptr: loaded.ptr, bytes: loaded.bytes })
          }
        }
        const game = byName.get('game')!
        const timer = byName.get('timer')!
        const unit = byName.get('unit')!
        expect(heap.get(game.ptr, D2GameStrc.dwGameFrame)).toBe(rec.frame)
        expect(heap.get(game.ptr, D2GameStrc.pTimer)).toBe(timer.block.a)
        expect([heap.get(game.ptr, D2GameStrc.seedLo), heap.get(game.ptr, D2GameStrc.seedHi)]).toEqual(rec.gs)
        expect(heap.get(timer.ptr, D2TimerStrc.nCurrentSlot)).toBe(rec.frame & 63)

        expect(heap.get(unit.ptr, D2UnitStrc.dwUnitType)).toBe(dump.type)
        expect(heap.get(unit.ptr, D2UnitStrc.dwUnitId)).toBe(dump.id)
        expect(heap.get(unit.ptr, D2UnitStrc.pGame)).toBe(game.block.a)
        const row = (dump.type === 0 ? rec.t0 : (rec.t1 ?? [])).find((r) => r[0] === dump.id)!
        expect(heap.get(unit.ptr, D2UnitStrc.dwClassId)).toBe(row[1])
        expect(heap.get(unit.ptr, D2UnitStrc.dwAnimMode)).toBe(row[2])
        expect([heap.get(unit.ptr, D2UnitStrc.seedLo), heap.get(unit.ptr, D2UnitStrc.seedHi)]).toEqual([row[5], row[6]])
        expect(heap.get(unit.ptr, D2UnitStrc.pUnitData)).toBe(byName.get('data')!.block.a)

        const path = byName.get('path')!
        expect(path).toBeDefined()
        expect(heap.get(unit.ptr, D2UnitStrc.pPath)).toBe(path.block.a)
        expect(heap.get(path.ptr, D2DynamicPathStrc.wPosX)).toBe(row[3])
        expect(heap.get(path.ptr, D2DynamicPathStrc.wPosY)).toBe(row[4])
        expect(heap.get(path.ptr, D2DynamicPathStrc.pUnit)).toBe(unit.block.a)

        const slex = byName.get('statlistex')!
        expect(slex).toBeDefined()
        expect(heap.get(unit.ptr, D2UnitStrc.pStatListEx)).toBe(slex.block.a)
        expect(heap.get(slex.ptr, D2StatListExStrc.eOwnerType)).toBe(dump.type)
        expect(heap.get(slex.ptr, D2StatListExStrc.dwOwnerId)).toBe(dump.id)
        expect((heap.get(slex.ptr, D2StatListExStrc.dwFlags) & 0x80000000) !== 0).toBe(true)
        expect(heap.get(slex.ptr, D2StatListExStrc.pOwner)).toBe(unit.block.a)
        expect(heap.get(slex.ptr, D2StatListExStrc.pGame)).toBe(game.block.a)
        const sf = byName.get('stateflags')!
        expect(sf).toBeDefined()
        expect(heap.get(slex.ptr, D2StatListExStrc.pStateFlags)).toBe(sf.block.a)

        const mystats = byName.get('mystats')
        if (mystats !== undefined) {
          expect(heap.get(slex.ptr, D2StatListExStrc.pStat)).toBe(mystats.block.a)
          const myCnt = heap.get(slex.ptr, D2StatListExStrc.wStatCount)
          const myCap = heap.get(slex.ptr, D2StatListExStrc.wStatCapacity)
          expect(myCnt).toBeLessThanOrEqual(myCap)
          expect(mystats.bytes.length).toBe(myCnt * 8)
        }
        const fullstats = byName.get('fullstats')
        if (fullstats !== undefined) {
          expect(heap.get(slex.ptr, D2StatListExStrc.pFullStat)).toBe(fullstats.block.a)
          const fCnt = heap.get(slex.ptr, D2StatListExStrc.wFullStatCount)
          const fCap = heap.get(slex.ptr, D2StatListExStrc.wFullStatCapacity)
          expect(fCnt).toBeLessThanOrEqual(fCap)
          expect(fullstats.bytes.length).toBe(fCnt * 8)
        }

        expect(heap.get(slex.ptr, D2StatListExStrc.pMyLastList)).toBe(childLists[0]?.block.a ?? 0)
        childLists.forEach((cl, ci) => {
          expect(heap.get(cl.ptr, D2StatListStrc.pParent)).toBe(slex.block.a)
          expect(heap.get(cl.ptr, D2StatListStrc.pUnit)).toBe(unit.block.a)
          expect(heap.get(cl.ptr, D2StatListStrc.pPrevLink)).toBe(childLists[ci + 1]?.block.a ?? 0)
          if (ci > 0) {
            expect(heap.get(cl.ptr, D2StatListStrc.pNextLink)).toBe(childLists[ci - 1]!.block.a)
          }
        })

        const dmg = byName.get('damage')
        if (dmg !== undefined) {
          expect(dmg.bytes.length).toBe(D2DamageStrc_SIZE)
          const traceDmg = rec.dmg?.find((d) => d.def[0] === dump.type && d.def[1] === dump.id)
          expect(traceDmg).toBeDefined()
          expect(heap.get(dmg.ptr, D2DamageStrc.dwHitFlags)).toBe(traceDmg!.raw[0])
          expect(heap.get(dmg.ptr, D2DamageStrc.wResultFlags)).toBe(traceDmg!.raw[1])
          expect(heap.get(dmg.ptr, D2DamageStrc.dwPhysDamage)).toBe(traceDmg!.raw[2])
          expect(heap.get(dmg.ptr, D2DamageStrc.dwDmgTotal)).toBe(traceDmg!.ret)
        }

        if (dump.type === 1) {
          const data = byName.get('data')!
          expect(heap.get(data.ptr, D2MonsterDataStrc.pAiGeneral)).toBe(byName.get('aigeneral')!.block.a)
          expect(heap.get(data.ptr, D2MonsterDataStrc.pAiControl)).toBe(byName.get('aicontrol')!.block.a)
        }

        const partition = [0, 1, 3, 2, 4][dump.type]!
        expect(heap.get(unit.ptr, D2UnitStrc.pEventFirst)).toBe(events[0]?.block.a ?? 0)
        events.forEach((ev, i) => {
          expect(heap.get(ev.ptr, D2EventStrc.pUnit)).toBe(unit.block.a)
          expect(heap.get(ev.ptr, D2EventStrc.dwUnitId)).toBe(dump.id)
          expect(heap.get(ev.ptr, D2EventStrc.dwUnitType)).toBe(dump.type)
          expect(heap.get(ev.ptr, D2EventStrc.pUnitNext)).toBe(events[i + 1]?.block.a ?? 0)
          const frame = heap.get(ev.ptr, D2EventStrc.dwFrame)
          if (frame !== 0xffffffff) {
            const slot = partition * 64 + (frame & 63)
            expect(heap.get(timer.ptr, D2TimerStrc.pSlotHead, slot)).not.toBe(0)
            expect(heap.get(timer.ptr, D2TimerStrc.pSlotTail, slot)).not.toBe(0)
          }
        })

        const room = byName.get('room')
        if (room !== undefined) {
          expect(heap.get(room.ptr, D2ActiveRoomStrc.pUnitFirst)).not.toBe(0)
          expect(heap.get(room.ptr, D2ActiveRoomStrc.bDeathRingIdx)).toBeLessThan(4)
          if (dump.type === 1) {
            expect(heap.get(room.ptr, D2ActiveRoomStrc.dwDeathRing, 0)).toBe(12)
            expect(heap.get(room.ptr, D2ActiveRoomStrc.bDeathRingIdx)).toBe(1)
          }
        }
      })
    }
  }
})
