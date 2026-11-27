/**
 * [K5] Single-Player `d2kern-113c` Runtime Switch, Loopback & Multi-Resolution E2E Showcase Backend
 * (`tools/oracle/k5-showcase-server.ts`).
 *
 * Serves authentic K5 artifacts under `/api/k5-showcase/*`:
 *   - `/api/k5-showcase/overview`  — Live `site-config.json` backend mode, 9-suite D2TV status,
 *     committed `.d2s` save fixture count, registered viewport profiles.
 *   - `/api/k5-showcase/d2tv`      — Live SHA-256 & `D2TV` header audit across all 9 merged vector suites
 *     (`13` pinned binary files from `tests/oracle/k5/exitgate-d2tv-regression.test.ts`).
 *   - `/api/k5-showcase/saves`     — Live `.d2s` header/checksum/stat parse via `readD2sSave113c` across
 *     committed `tests/fixtures/oracle/saves/*.d2s`.
 *   - `/api/k5-showcase/viewports` — Live `VIEWPORT_PROFILES` (`640x480`..`1424x800`) HUD anchor geometry.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import {
  DEFAULT_ALLOWED_VIEWPORT_RESOLUTIONS,
  NATIVE_113C_VIEWPORT_RESOLUTIONS,
  VIEWPORT_PROFILES,
  panelDockWidth,
} from '../../src/client/view/viewport-profile.ts'
import {
  isD2sNewCharacterHeader113c,
  readD2sNewCharacterHeader113c,
  readD2sSave113c,
} from '../../src/server/save/d2s-reader.ts'
import { verifyD2sChecksum } from '../../src/server/save/save.ts'
import {
  DEFAULT_REPO_ROOT,
  parseShowcaseRequest,
  sendJson,
  sha256Buffer,
} from './showcase-common.ts'
import { DRLG_DATATBLS_RAW_SHA256 } from './vectors/drlg-ts-runner.ts'
import { parseVectorHeader } from './vectors/vector-format.ts'

interface K5D2tvSpec {
  readonly suite: string
  readonly id: string
  readonly relPath: string
  readonly gzipped: boolean
  readonly isD2tv: boolean
  readonly pinnedSha256: string
  readonly description: string
}

const K5_D2TV_SPECS: readonly K5D2tvSpec[] = [
  {
    suite: '1. PRNG',
    id: 'prng',
    relPath: 'tests/fixtures/oracle/vectors/prng-10k.d2tv',
    gzipped: false,
    isD2tv: true,
    pinnedSha256: '257e65050dd758de0cdd1f808c456910b29a933f7da3f1d1d6b25650d4df599e',
    description: '10,000 64-bit LCG SEED_RollLimited records',
  },
  {
    suite: '2. EVENTWHEEL',
    id: 'eventwheel',
    relPath: 'tests/fixtures/oracle/vectors/eventwheel-113c.d2tv',
    gzipped: false,
    isD2tv: true,
    pinnedSha256: '716404b144a4fbd0d5b7c3cd13622a9ce7b759e303650b7895eddc8c90ea7993',
    description: '256 multi-frame timer-wheel scenarios (45,101 fired events)',
  },
  {
    suite: '3. DRLG',
    id: 'drlgDigest',
    relPath: 'tests/fixtures/oracle/vectors/drlg-digest-113c.d2tv.gz',
    gzipped: true,
    isD2tv: true,
    pinnedSha256: '2bdf75938c7e55904b354f7463c0f35334d3f130ef580681bf5d58399eeced28',
    description: '20,400 seeds (50 × 3 diffs × 136 levels) SHA-256 layout digests',
  },
  {
    suite: '3. DRLG',
    id: 'drlgRooms',
    relPath: 'tests/fixtures/oracle/vectors/drlg-rooms-s12345.d2tv.gz',
    gzipped: true,
    isD2tv: true,
    pinnedSha256: 'dc625a2bf9a4ee24c117a11fde8891d97d926c6edbae56d282edfa0690f49ee9',
    description: '20,807 room records for seed 12345 across 408 level-diff combos',
  },
  {
    suite: '3. DRLG',
    id: 'drlgColl',
    relPath: 'tests/fixtures/oracle/vectors/drlg-coll-towns-s12345-d0.d2tv.gz',
    gzipped: true,
    isD2tv: true,
    pinnedSha256: 'a7fc68ead57379c285df1e45c92a833d9a1213dc7357099a96f298939dfee120',
    description: '169 Act 1–5 town room u16 collision grid hashes',
  },
  {
    suite: '3. DRLG',
    id: 'drlgDataTbls',
    relPath: 'tests/fixtures/oracle/vectors/drlg-datatbls-113c.img.gz',
    gzipped: true,
    isD2tv: false,
    pinnedSha256: DRLG_DATATBLS_RAW_SHA256,
    description: 'Live 1.13c sgptDataTables binary snapshot for DRLG runner',
  },
  {
    suite: '4. PATH',
    id: 'pathVectors',
    relPath: 'tests/fixtures/oracle/vectors/path-vectors-113c.d2tv.gz',
    gzipped: true,
    isD2tv: true,
    pinnedSha256: 'eb59554dc7b5d0bb4e79211c8042fa24ca1a5a6e61e56fd3a919c9ec7d9068dc',
    description: '6,924 Stage 1..4 PATHTYPE 0..17 #10342 vectors',
  },
  {
    suite: '4. PATH',
    id: 'pathWorldImg',
    relPath: 'tests/fixtures/oracle/vectors/path-world-town-s12345.img.gz',
    gzipped: true,
    isD2tv: false,
    pinnedSha256: '7938797317be1ce51e911a6788ceb886fa8437d5c59bb0230a2b18520546123b',
    description: '65-page Rogue Encampment SparseMemory world image',
  },
  {
    suite: '5. MONSPAWN',
    id: 'monspawn',
    relPath: 'tests/fixtures/oracle/k2/monspawn-113c.d2tv.gz',
    gzipped: true,
    isD2tv: true,
    pinnedSha256: '7d35dcb158a1748828a953ad5eb19972e881eca4503793761a775ec5c93a653f',
    description: '2,448 all-136-level / Act 1–5 / Diff 0..2 monster pack & boss spawn records',
  },
  {
    suite: '6. TCDROP',
    id: 'tcdrop',
    relPath: 'tests/fixtures/oracle/k2/tcdrop-113c.d2tv.gz',
    gzipped: true,
    isD2tv: true,
    pinnedSha256: 'bf091c145fad1d71dba1aa2d8794a09d3ba1746477f5ed7d4f257f3c9368c0e5',
    description: '1,200 TreasureClassEx drop-tree evaluation records',
  },
  {
    suite: '7. ITEMGEN',
    id: 'itemgen',
    relPath: 'tests/fixtures/oracle/k2/itemgen-113c.d2tv.gz',
    gzipped: true,
    isD2tv: true,
    pinnedSha256: '10c61d8fc4b1b4f97fcfc98a380df690d84caa31c21102dd636018afd3812ce9',
    description: '2,400 all-8-quality (incl. Set/Unique/Crafted) item generation + #10987 bitstream records',
  },
  {
    suite: '8. SKILLCALC',
    id: 'skillcalc',
    relPath: 'tests/fixtures/oracle/k3/skillcalc-113c.d2tv.gz',
    gzipped: true,
    isD2tv: true,
    pinnedSha256: '336145e033b11206340f76113f34794e7631c6dc93c9e237f1bdec57d801d6c1',
    description: '12,600 7-class / 210-skill × slvl 1..60 / 73-field-code calculation vectors',
  },
  {
    suite: '9. S2C',
    id: 's2c',
    relPath: 'tests/fixtures/oracle/k4/s2c-113c.d2tv.gz',
    gzipped: true,
    isD2tv: true,
    pinnedSha256: '330ed2d430ae232a3b204c17dd83e0890abfafcf8d03d69cbc76104c8a31ebb2',
    description: '1,440 S2C payload, Fog.#10223 Huffman & D2Net framing vectors',
  },
]

const CLASS_NAMES = ['Amazon', 'Sorceress', 'Necromancer', 'Paladin', 'Barbarian', 'Druid', 'Assassin'] as const

export interface K5D2tvAuditRow {
  readonly suite: string
  readonly id: string
  readonly relPath: string
  readonly diskBytes: number
  readonly rawBytes: number
  readonly kind: string
  readonly recordCount: number
  readonly recordSize: number
  readonly actualSha256: string
  readonly pinnedSha256: string
  readonly shaMatch: boolean
  readonly description: string
}

export interface K5D2tvResponse {
  readonly ok: true
  readonly totalArtifacts: number
  readonly allMatched: boolean
  readonly totalRecords: number
  readonly rows: readonly K5D2tvAuditRow[]
}

export interface K5SaveAuditRow {
  readonly file: string
  readonly bytes: number
  readonly checksumValid: boolean
  readonly name: string
  readonly classId: number
  readonly className: string
  readonly level: number
  readonly act: number
  readonly expansion: boolean
  readonly hardcore: boolean
  readonly mapSeedHex: string
  readonly itemCount: number
  readonly skillPointsAllocated: number
}

export interface K5SavesResponse {
  readonly ok: true
  readonly saveCount: number
  readonly allChecksumsValid: boolean
  readonly saves: readonly K5SaveAuditRow[]
}

export interface K5ViewportRow {
  readonly id: string
  readonly width: number
  readonly height: number
  readonly aspectRatio: string
  readonly native113c: boolean
  readonly barOffsetX: number
  readonly barOffsetY: number
  readonly panelOffsetY: number
  readonly dockWidth: number
  readonly centerChannelWidth: number
}

export interface K5ViewportsResponse {
  readonly ok: true
  readonly profiles: readonly K5ViewportRow[]
}

export interface K5OverviewResponse {
  readonly ok: true
  readonly siteConfig: {
    readonly singlePlayerEnabled: boolean
    readonly singlePlayerBackend: string
    readonly source: string
  }
  readonly d2tvSuiteCount: number
  readonly d2tvArtifactCount: number
  readonly d2tvAllMatched: boolean
  readonly d2tvTotalRecords: number
  readonly saveFixtureCount: number
  readonly viewportCount: number
}

const d2tvCache = new Map<string, K5D2tvResponse>()
const savesCache = new Map<string, K5SavesResponse>()

export function getK5D2tvData(rootDir: string = DEFAULT_REPO_ROOT): K5D2tvResponse {
  const hit = d2tvCache.get(rootDir)
  if (hit) return hit
  const rows: K5D2tvAuditRow[] = []
  let allMatched = true
  let totalRecords = 0

  for (const spec of K5_D2TV_SPECS) {
    const abs = resolve(rootDir, spec.relPath)
    if (!existsSync(abs)) {
      allMatched = false
      rows.push({
        suite: spec.suite,
        id: spec.id,
        relPath: spec.relPath,
        diskBytes: 0,
        rawBytes: 0,
        kind: 'MISSING',
        recordCount: 0,
        recordSize: 0,
        actualSha256: '',
        pinnedSha256: spec.pinnedSha256,
        shaMatch: false,
        description: spec.description,
      })
      continue
    }
    const diskBuf = readFileSync(abs)
    const rawBuf = spec.gzipped ? gunzipSync(diskBuf) : diskBuf
    const actualSha = sha256Buffer(rawBuf)
    const shaMatch = actualSha === spec.pinnedSha256
    if (!shaMatch) allMatched = false

    let kind = 'RAWIMG'
    let recordCount = 0
    let recordSize = 0
    if (spec.isD2tv) {
      const hdr = parseVectorHeader(rawBuf)
      kind = hdr.kind
      recordCount = hdr.recordCount
      recordSize = hdr.recordSize
      totalRecords += recordCount
    }
    rows.push({
      suite: spec.suite,
      id: spec.id,
      relPath: spec.relPath,
      diskBytes: diskBuf.byteLength,
      rawBytes: rawBuf.byteLength,
      kind,
      recordCount,
      recordSize,
      actualSha256: actualSha,
      pinnedSha256: spec.pinnedSha256,
      shaMatch,
      description: spec.description,
    })
  }

  const res: K5D2tvResponse = {
    ok: true,
    totalArtifacts: rows.length,
    allMatched,
    totalRecords,
    rows,
  }
  d2tvCache.set(rootDir, res)
  return res
}

export function getK5SavesData(rootDir: string = DEFAULT_REPO_ROOT): K5SavesResponse {
  const hit = savesCache.get(rootDir)
  if (hit) return hit
  const dir = resolve(rootDir, 'tests/fixtures/oracle/saves')
  const files = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.d2s'))
        .sort()
    : []
  const saves: K5SaveAuditRow[] = []
  let allValid = true

  for (const file of files) {
    const bytes = new Uint8Array(readFileSync(resolve(dir, file)))
    const checksumValid = verifyD2sChecksum(bytes)
    if (!checksumValid) allValid = false
    if (isD2sNewCharacterHeader113c(bytes)) {
      const hdr = readD2sNewCharacterHeader113c(bytes)
      saves.push({
        file,
        bytes: bytes.byteLength,
        checksumValid,
        name: hdr.name,
        classId: hdr.classId,
        className: CLASS_NAMES[hdr.classId] ?? `Class#${hdr.classId}`,
        level: hdr.level,
        act: 1,
        expansion: (hdr.statusFlags & 0x20) !== 0,
        hardcore: (hdr.statusFlags & 0x04) !== 0,
        mapSeedHex: `0x${(hdr.mapSeed >>> 0).toString(16).toUpperCase().padStart(8, '0')}`,
        itemCount: 0,
        skillPointsAllocated: 0,
      })
      continue
    }
    const parsed = readD2sSave113c(bytes)
    const skillPoints = parsed.skills.reduce((sum, n) => sum + n, 0)
    saves.push({
      file,
      bytes: bytes.byteLength,
      checksumValid,
      name: parsed.name,
      classId: parsed.classId,
      className: CLASS_NAMES[parsed.classId] ?? `Class#${parsed.classId}`,
      level: parsed.level,
      act: parsed.act + 1,
      expansion: parsed.isExpansion,
      hardcore: parsed.isHardcore,
      mapSeedHex: `0x${(parsed.mapSeed >>> 0).toString(16).toUpperCase().padStart(8, '0')}`,
      itemCount: parsed.items.length,
      skillPointsAllocated: skillPoints,
    })
  }

  const res: K5SavesResponse = {
    ok: true,
    saveCount: saves.length,
    allChecksumsValid: allValid,
    saves,
  }
  savesCache.set(rootDir, res)
  return res
}

export function getK5ViewportsData(): K5ViewportsResponse {
  const nativeSet = new Set<string>(NATIVE_113C_VIEWPORT_RESOLUTIONS)
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const profiles: K5ViewportRow[] = DEFAULT_ALLOWED_VIEWPORT_RESOLUTIONS.map((id) => {
    const prof = VIEWPORT_PROFILES[id]
    const g = gcd(prof.width, prof.height)
    const dockW = panelDockWidth(prof)
    return {
      id: prof.id,
      width: prof.width,
      height: prof.height,
      aspectRatio: `${prof.width / g}:${prof.height / g} (${(prof.width / prof.height).toFixed(2)})`,
      native113c: nativeSet.has(prof.id),
      barOffsetX: prof.barOffsetX,
      barOffsetY: prof.barOffsetY,
      panelOffsetY: prof.panelOffsetY,
      dockWidth: dockW,
      centerChannelWidth: Math.max(0, prof.width - dockW * 2),
    }
  })
  return { ok: true, profiles }
}

export function getK5OverviewData(rootDir: string = DEFAULT_REPO_ROOT): K5OverviewResponse {
  const siteCfgPath = resolve(rootDir, 'public/site-config.json')
  let singlePlayerEnabled = true
  let singlePlayerBackend = 'd2kern-113c'
  let source = 'default (LocalLobbyProvider default = d2kern-113c)'
  if (existsSync(siteCfgPath)) {
    try {
      const parsed = JSON.parse(readFileSync(siteCfgPath, 'utf8')) as {
        singlePlayerEnabled?: boolean
        singlePlayerBackend?: string
      }
      singlePlayerEnabled = parsed.singlePlayerEnabled !== false
      singlePlayerBackend = parsed.singlePlayerBackend ?? 'd2kern-113c'
      source = 'public/site-config.json'
    } catch {
      // Keep default if invalid
    }
  }
  const d2tv = getK5D2tvData(rootDir)
  const saves = getK5SavesData(rootDir)
  const viewports = getK5ViewportsData()
  return {
    ok: true,
    siteConfig: { singlePlayerEnabled, singlePlayerBackend, source },
    d2tvSuiteCount: 9,
    d2tvArtifactCount: d2tv.totalArtifacts,
    d2tvAllMatched: d2tv.allMatched,
    d2tvTotalRecords: d2tv.totalRecords,
    saveFixtureCount: saves.saveCount,
    viewportCount: viewports.profiles.length,
  }
}

export interface K5ShowcaseMiddlewareOptions {
  readonly rootDir?: string
}

export function createK5ShowcaseHttpMiddleware(options?: K5ShowcaseMiddlewareOptions) {
  const rootDir = options?.rootDir ?? DEFAULT_REPO_ROOT
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const parsed = parseShowcaseRequest(req, '/api/k5-showcase/')
    if (!parsed) {
      next()
      return
    }
    if (req.method !== 'GET') {
      sendJson(res, 405, { ok: false, error: 'Method Not Allowed' })
      return
    }
    try {
      if (parsed.subRoute === 'overview') {
        sendJson(res, 200, getK5OverviewData(rootDir))
        return
      }
      if (parsed.subRoute === 'd2tv') {
        sendJson(res, 200, getK5D2tvData(rootDir))
        return
      }
      if (parsed.subRoute === 'saves') {
        sendJson(res, 200, getK5SavesData(rootDir))
        return
      }
      if (parsed.subRoute === 'viewports') {
        sendJson(res, 200, getK5ViewportsData())
        return
      }
      sendJson(res, 404, { ok: false, error: `Unknown K5 showcase route: ${parsed.normPath}` })
    } catch (err: unknown) {
      sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }
}
