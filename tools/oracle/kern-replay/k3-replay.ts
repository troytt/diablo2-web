/**
 * Milestone 34 ([K3]) kernel-driven longitudinal replay runner, coverage gap analyzer, and
 * upward-only horizon ratchet for the 9 [K3] `p52-*` class skill/aura/summon/merc/missile scenarios:
 *   npx tsx tools/oracle/kern-replay/k3-replay.ts [--write] [--update-horizons] [scenario...]
 *
 * Kept separate from `replay-113c.ts` / `report.ts` (`k1/replay/`) so K2 and K3 replay suites
 * evolve without file contention while sharing the pure `ReplayKernel113c` (`0x6FC4E050` / `0x6FCEC550`).
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { collectImportGraph, legacyReachable } from './import-graph.ts'
import type {
  ComputeGapsOptions113c,
  Coverage113c,
  GapRow113c,
  GapSummary113c,
  RuntimeModuleCoverage113c,
  ScenarioGap113c,
} from './gap-report.ts'
import {
  REPO_ROOT_113C,
  UnportedFunction113c,
  bootFromSnapshot113c,
  diffFrame113c,
  goldenPath113c,
  loadGolden113c,
  loadManifest113c,
  loadScenario113c,
  loadSnapshotFile113c,
  manifestKey113c,
  sampleFrame113c,
  stepFrame113c,
  type FieldDivergence113c,
  type ReplayResult113c,
} from './replay-113c.ts'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c.ts'
import { mergeHorizons113c, type DivergenceArtifact113c, type Horizon113c } from './report.ts'

export const K3_REPLAY_SCENARIOS_113C = [
  'p52-amazon-defense',
  'p52-amazon-valkyrie',
  'p52-barbarian-warcries',
  'p52-necromancer-curses',
  'p52-necromancer-poison-golem',
  'p52-paladin-auras',
  'p52-paladin-merc-aura',
  'p52-sorceress-elemental',
  'p52-sorceress-fire-dot',
] as const

export type K3ReplayScenarioName113c = (typeof K3_REPLAY_SCENARIOS_113C)[number]

export const K3_FIXTURES_DIR_113C = join(REPO_ROOT_113C, 'tests/fixtures/oracle/k3/replay')
export const K3_HORIZONS_PATH_113C = join(K3_FIXTURES_DIR_113C, 'horizons.json')
export const K3_DIVERGENCE_DIR_113C = join(REPO_ROOT_113C, 'docs/oracle/k3-replay')

export const K3_SCENARIO_ROOT_CAUSE_MD_113C: Readonly<Record<K3ReplayScenarioName113c, string>> = {
  'p52-amazon-defense': [
    '- **Immediate `F717` root cause (`0` unported manifest VAs)**: At `F715`, `AiZombie` (`D2Game:0x6FCA38B0` @ `0x6FCA3A8C`) enters chase mode `MONMODE_RUN (15)` with `pAiControl->dwVelocityOverride = 100`. `D2Common.#10309` (`UNITS_UpdateAnimRateAndVelocity` `0x6FD83330` -> `0x6FD80D50` @ `0x6FD80D7B`) **always** reads `MonStats.Velocity << 8` (`+0x32`, `1 << 8 = 256` -> `dwVelocity = 448`), never `MonStats.Run` (`+0x34`). `MONSTER_StartMode113c` (`replay-kernel-113c.ts:1369`) uses `row.run (3)` for `mode === 15`, setting `dwVelocity = 1344` and stepping zombie `#9` to `y = 5796` at `F717` instead of `F721`.',
    '- **Downstream combat handlers (`F717..F1800`)**: Hydrate Amazon `.d2s` passive skills/states (`64` Dodge `stat 338`, `65` Avoid `stat 339`, `66` Evade `stat 340`, `68` Critical Strike `stat 337`), wire defender Dodge/Avoid/Evade rolls + `S1` evade animation (`0x6FCFDE90` / `0x6FCFE0C0` / `0x6FC98610`), and wire attacker `stat 337` Critical Strike roll (`0x6FCFD51A..0x6FCFD5B4`, hit flag `0x2005`) during `F1200..F1750` `C2S 0x06` melee attacks.',
  ].join('\n'),
  'p52-amazon-valkyrie': [
    '- **Immediate `F642` root cause (`8` unported `D2Game` VAs)**: `C2S 0x3C` selects `Valkyrie` (skill `#32`) at `F620` and `C2S 0x0C` starts `PLRMODE_CAST (10)` at `F630`. On the `F642` cast keyframe (`arg14 == 1`), `SKILLS_DoUsedSkillAction113c` (`replay-kernel-113c.ts:3918-3923`) only dispatches `wDoFuncIdx === 22`, skipping mana deduction (`0x6FCC19A0`, `18816 -> 12422`) and `wSrvDoFunc = 16` (`SKILLS_SrvDo016_Valkyrie` `0x6FC6D710`).',
    '- **Dynamic `D2Game` gap VAs (`gap-p52-amazon-valkyrie.md`)**: `F642` summon chain `0x6FC6D710` (`SKILLS_SrvDo016_Valkyrie`), `0x6FCC3610` (`D2GAME_SummonPet`), `0x6FCC3090`, `0x6FCB7F50` (spawns `valkyrie` `hcIdx = 357` unit `#12` with `MonEquip.txt` rare gear, synergy passives, and `+20` frame initial AI event at `0x6FC6D877`); `F662` `NecroPet` AI (`MonAI` `#67`) `0x6FC3E900` (`AI_NecroPet`), `0x6FC3E640` (`AI_NecroPet_Melee`), `0x6FC3E140` (`AIPET_CheckFollow`), `0x6FC3CAE0` (`AIPET_PetMove`, including state `1` breadcrumb-ring follow at `F988` reading `pPlayerData+0xA8` written by `0x6FC99B90`).',
  ].join('\n'),
  'p52-barbarian-warcries': [
    '- **Immediate `F638` root cause (`2` unported `D2Game` VAs)**: `C2S 0x3C` selects `Battle Orders` (skill `#149`) at `F620` and `C2S 0x0C` starts `PLRMODE_CAST (10)` at `F630`. On the `F638` cast keyframe (`arg14 == 1`), `SKILLS_DoUsedSkillAction113c` skips `wSrvDoFunc = 68` (`SKILLS_SrvDo068_BasicShout` `0x6FC49720`), so the radial `battleorders` missile ring (`Missiles.txt` `#237`) is not spawned and `MISSMODE_SrvHit18_Shout_BattleCommand_BattleOrders` (`0x6FC5EA60`, `pSrvHitFunc = 18`) never applies state `32` (`maxhp%` scaling HP `136448 -> 221045`).',
    '- **Downstream handlers (`F638..F1600`)**: Port & wire `0x6FC49720` (`SrvDo068` for `Battle Orders` `#149` at `F638`, `Battle Command` `#155` state `51` at `F718`, `Shout` `#138` state `26` at `F798`, and `War Cry` `#154` missile `#235` at `F918+`), port `0x6FC5EA60` (`SrvHit18`), and wire `MISSMODE_SrvDmg07_Warcry_ShockWave` (`0x6FC59600`, `pSrvDmgFunc = 7`, stun state `21` + physical damage) before `F1100+` `C2S 0x06` melee.',
  ].join('\n'),
  'p52-necromancer-curses': [
    '- **Immediate `F630` root cause (`8` unported `D2Game` VAs later at `F1517+`)**: `C2S 0x3C` selects `Amplify Damage` (skill `#66`) at `F620`, and `F630` sends `C2S 0x0D` (`CS_RIGHTSKILLONUNIT`, `0x6FCEEA40` -> `0x6FCEE690` -> `PLAYER_StartSkillOnTarget` `0x6FC98840`) targeting zombie `#10`. `applyPlayerPacket113c` (`replay-kernel-113c.ts:3520-3580`) does not handle `0x0D`, leaving the Necromancer in `PLRMODE_NEUTRAL (1)` instead of `PLRMODE_CAST (10)`.',
    '- **Downstream handlers (`F630..F2000`)**: Wire `C2S 0x0D` (`0x6FC98840`) and `wSrvDoFunc = 30` (`SKILLS_SrvDo030_Curse` `0x6FC705D0`, already ported) for `Amplify Damage` (`#66`, state `9`), `Decrepify` (`#87`, state `60`), `Lower Resist` (`#91`, state `61`), and `Weaken` (`#72`, state `19`) with curse exclusivity + `Event 12` expiry; `F860..F1500` `C2S 0x06` melee kill of cursed zombie `#10`; `F1510+` `Raise Skeleton` (`#70`, `wSrvStFunc = 15` `0x6FC6EF20`) requiring the 8 unported `D2Game` VAs in `gap-p52-necromancer-curses.md`: `0x6FC718B0` (`SKILLS_SrvDo031_RaiseSkeleton_Mage`), `0x6FCC3610`, `0x6FCC3090`, `0x6FCB7F50`, and `F1542/F1576` `NecroPet` AI (`0x6FC3E900`, `0x6FC3E640`, `0x6FC3E140`, `0x6FC3CAE0`).',
  ].join('\n'),
  'p52-necromancer-poison-golem': [
    '- **Immediate `F637` root cause (`9` unported `D2Game` VAs)**: `C2S 0x3C` selects `Clay Golem` (skill `#75`) at `F620` and `C2S 0x0C` starts `PLRMODE_CAST (10)` at `F630`. On the `F637` cast keyframe (`arg14 == 1`), `SKILLS_DoUsedSkillAction113c` skips mana deduction (`75008 -> 68121`) and `wSrvDoFunc = 56` (`SKILLS_SrvDo056_Golem` `0x6FC71750`).',
    '- **Dynamic `D2Game` gap VAs (`gap-p52-necromancer-poison-golem.md`)**: `F637` summon chain `0x6FC71750` (`SKILLS_SrvDo056_Golem`), `0x6FC70070` (Golem Mastery passive bonus), `0x6FCC3610` (`D2GAME_SummonPet`), `0x6FCC3090`, `0x6FCB7F50` (spawns `claygolem` `hcIdx = 289` unit `#12` in mode `8` `S1` with `EventFunc27_SlowTarget` `0x6FC6EF70` on melee hit and `+25` frame first AI think at `F662`); `F662` `NecroPet` AI `0x6FC3E900`, `0x6FC3E640`, `0x6FC3E140`, `0x6FC3CAE0` (including breadcrumb-ring follow at `F919`). `Poison Nova` (`#92`, `SrvDo022` `0x6FC63AA0`) + `Event 3` poison ticks (`0x6FC96740`) at `F830+` are already wired.',
  ].join('\n'),
  'p52-paladin-auras': [
    '- **Immediate `F720` root cause (`0` unported manifest VAs)**: Two pure wiring bugs in `replay-kernel-113c.ts`: (1) `C2S 0x06` (`AttackUnit` on zombie `#10`, sent every 20 frames from `F640`) arrives at `F720` pre-frame while the Paladin is mid-swing in `PLRMODE_ATTACK1 (7)` (`dwFlags & 0x40 == 0`); `applyPlayerPacket113c` (`replay-kernel-113c.ts:3612-3616`) re-enters `startPlayerAttackWithTarget113c` (`MONSTER_ClearModeEvents113c`), deleting the `F720` `arg14 == 1` hit event before `EVENT_UpdateTimers113c` runs (whereas `D2Game:0x6FCEE9D0 -> 0x6FC983A0` rejects restarting `PLRMODE_ATTACK1` mid-swing). (2) `stepFallenSliceFrame113c` (`replay-kernel-113c.ts:3875-3946`) ignores `UNIT_PLAYER` timer `evType === 6` (`SKILLS_EventFunc06_PeriodicSkill` `0x6FCC00B0` -> `SKILLS_SrvDo065_BasicAura` `0x6FCBA8D0`), so `Concentration` (`#113`, state `42` from `F620`) and `Fanaticism` (`#122`, state `49` from `F1100`) never apply their `+damagepercent` / `+tohit%` / `+attackrate` stat lists (`3361` raw `<<8` one-shot kill of `#10` at `F720`).',
  ].join('\n'),
  'p52-paladin-merc-aura': [
    '- **Immediate `F3` root cause (`2` unported `D2Game` VAs)**: The hired Act 1 Rogue Scout (`roguehire` `hcIdx = 271`, `unitId = 1`, `MonAI = Hireable`) has `MON_EVENT_AI_THINK` (`Event 2`) scheduled at `F3` in the `F2` boot snapshot. Both unported `D2Game` VAs in `gap-p52-paladin-merc-aura.md` execute at `F3`: `0x6FC3DD40` (`AI_Hireable`) and `0x6FC3D3C0` (`AI_Hireable_Sub`), which transition Rogue `#1` to `MONMODE_WALK (2)` (`seedLo` `680238887 -> 1066795286`).',
    '- **Downstream handlers (`F3..F1700`)**: Port & wire `0x6FC3DD40` / `0x6FC3D3C0` (`AI_Hireable`), wire Rogue skill casts `#8 Inner Sight` (`SKILLS_SrvDo006_InnerSight_SlowMissiles` `0x6FC6C2A0`, state `17`) and `#11 Cold Arrow` (`SKILLS_SrvDo110_Hireable_RogueMissile` `0x6FCD49F0` -> `coldarrow` `#40` `MISSMODE_SrvDmg01` `0x6FC59CE0`), wire mercenary kill XP split (`0x6FCFC030`), and wire Paladin `Event 6` radial party aura (`0x6FCC00B0` -> `0x6FCBA8D0` + `aura-target-filter` onto friendly mercenary `#1` for `Concentration` `#113` state `42` and `Fanaticism` `#122` state `49`).',
  ].join('\n'),
  'p52-sorceress-elemental': [
    '- **Immediate `F630` root cause (`0` unported manifest VAs)**: `C2S 0x3C` selects `Fire Ball` (skill `#47`) at `F620`, and `F630` sends `C2S 0x0D` (`CS_RIGHTSKILLONUNIT`, `0x6FCEEA40` -> `PLAYER_StartSkillOnTarget` `0x6FC98840`) targeting zombie `#9`. `applyPlayerPacket113c` ignores `0x0D`, leaving the Sorceress in `PLRMODE_NEUTRAL (1)` instead of `PLRMODE_CAST (10)`.',
    '- **Downstream ported handlers to wire (`0` unported VAs)**: Wire `C2S 0x0D` (`0x6FC98840`), `SKILLS_DoUsedSkillAction113c` mana deduction + missile-cast `SrvDo` dispatch, and `MISSILE_DispatchFrameTick113c` `SrvDo`/`SrvHit` handlers: `Fire Ball` (`#47`, `fireball` `#62` -> `MISSMODE_SrvHit01_Fireball` `0x6FC5B990` radial fire splash `F630..F899`), `Chain Lightning` (`#53`, `SKILLS_SrvDo026_ChainLightning` `0x6FC63720` -> `chainlightning` `#93` `MISSMODE_SrvHit12` `0x6FC5D020` `F900..F1149`), `Frozen Orb` (`#64`, `frozenorb` `#260` `MISSMODE_SrvDo15` `0x6FC60CA0` + `MISSMODE_SrvHit29` `0x6FC5C850` -> `frozenorbnova` `#262` `MISSMODE_SrvDo16` `0x6FC60BD0` `F1150..F1399`), and `Glacial Spike` (`#55`, `glacialspike` `#96` `MISSMODE_SrvHit13` `0x6FC5B3E0` radial freeze `F1400..F1650`).',
  ].join('\n'),
  'p52-sorceress-fire-dot': [
    '- **Immediate `F636` root cause (`0` unported manifest VAs)**: `C2S 0x3C` selects `Fire Wall` (skill `#51`) at `F620` and `C2S 0x0C` (`(5662, 5794)`) enters `PLRMODE_CAST (10)` at `F630` (strictly matching `F630..F635`). On the `F636` cast keyframe (`arg14 == 1`), `SKILLS_DoUsedSkillAction113c` (`replay-kernel-113c.ts:3918-3923`) skips mana deduction (`77568 -> 69664`, `31 << 8`) and `wSrvDoFunc = 24` (`SKILLS_SrvDo024_FireWall` `0x6FC637D0`, spawning `firewallmaker` `#68` + `firewall` `#69` and applying `skilldelay` state `121`).',
    '- **Downstream ported handlers to wire (`0` unported VAs)**: Wire `SKILLS_SrvDo024_FireWall` (`0x6FC637D0`), `MISSMODE_SrvDo06_FireWallMaker` (`0x6FC61850`), `MISSMODE_SrvDo05_FireWall` (`0x6FC61980`), and `MISSMODE_SrvDmg03_FireWall` (`0x6FC59670`) for `F636..F899`; then wire `C2S 0x0D` + `PLRMODE_SEQUENCE (14)` channeling (`SKILLS_SrvSt11_Inferno_ArcticBlast` `0x6FC64550` setting `STATE_INFERNO` `85`, `SKILLS_SrvDo019_Inferno_ArcticBlast` `0x6FC64390` spawning `infernoflame1` `#65` and draining per-tick mana) for `Inferno` (`#41`) on zombie `#11` at `F900..F1300`.',
  ].join('\n'),
}

export function k3SnapshotPath113c(name: string, bootFrame = 2): string {
  return join(K3_FIXTURES_DIR_113C, `${name}.snap-f${String(bootFrame).padStart(3, '0')}.ndjson.gz`)
}

export function k3CoveragePath113c(name: string): string {
  return join(K3_FIXTURES_DIR_113C, `${name}.coverage.ndjson.gz`)
}

export function loadK3Horizons113c(): Record<string, Horizon113c> {
  return JSON.parse(readFileSync(K3_HORIZONS_PATH_113C, 'utf8')) as Record<string, Horizon113c>
}

function hexBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '')
  return Uint8Array.from(Buffer.from(clean, 'hex'))
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

/** Boots from `tests/fixtures/oracle/k3/replay/<name>.snap-f002.ndjson.gz` and steps until first pos divergence or golden end. */
export function runK3Replay113c(name: string, bootFrame = 2): ReplayResult113c {
  const golden = loadGolden113c(name)
  const scenario = loadScenario113c(name)
  const saveBytes =
    scenario.save !== undefined
      ? new Uint8Array(readFileSync(join(REPO_ROOT_113C, scenario.save)))
      : undefined
  const snap = loadSnapshotFile113c(k3SnapshotPath113c(name, bootFrame))
  const header = golden.header
  let lastGoldenFrame = 0
  for (const f of golden.frames.keys()) if (f > lastGoldenFrame) lastGoldenFrame = f
  const bootGolden = golden.frames.get(bootFrame)
  if (bootGolden === undefined) throw new Error(`golden has no frame ${bootFrame}`)

  beginVaTrace113c()
  let bootCheck: FieldDivergence113c | null = null
  let strictHorizon = bootFrame
  let posHorizon = bootFrame
  let firstStrict: FieldDivergence113c | null = null
  let firstPos: FieldDivergence113c | null = null
  let unportedHit: ReplayResult113c['unportedHit'] = null
  let framesStepped = 0
  let tsExecutedVas: string[] = []
  try {
    const world = bootFromSnapshot113c(snap, saveBytes)
    if (world.bootFrame !== bootFrame) throw new Error(`snapshot boots at F${world.bootFrame}, expected F${bootFrame}`)
    bootCheck = diffFrame113c(bootGolden, sampleFrame113c(world, header), header, 'strict')
    firstStrict = bootCheck
    firstPos =
      bootCheck === null ? null : diffFrame113c(bootGolden, sampleFrame113c(world, header), header, 'pos')
    if (bootCheck === null) {
      for (let f = bootFrame + 1; f <= lastGoldenFrame; f++) {
        const g = golden.frames.get(f)
        if (g === undefined) throw new Error(`golden has no frame ${f}`)
        const packets = scenario.inputs.filter((i) => i.frame === f).map((i) => hexBytes(i.c2s))
        try {
          stepFrame113c(world, packets)
        } catch (e) {
          if (!(e instanceof UnportedFunction113c)) throw e
          const d: FieldDivergence113c = {
            frame: f,
            key: 'step',
            id: null,
            field: `<unported ${manifestKey113c(e.module, e.va)}>`,
            expected: 'frame simulated by the original game',
            actual: e.message,
          }
          unportedHit = { frame: f, key: manifestKey113c(e.module, e.va), status: e.status, reason: e.reason }
          if (firstStrict === null) firstStrict = d
          if (firstPos === null) firstPos = d
          break
        }
        framesStepped++
        const sample = sampleFrame113c(world, header)
        if (firstStrict === null) {
          const d = diffFrame113c(g, sample, header, 'strict')
          if (d === null) strictHorizon = f
          else firstStrict = d
        }
        const dp = diffFrame113c(g, sample, header, 'pos')
        if (dp !== null) {
          firstPos = dp
          break
        }
        posHorizon = f
      }
    }
  } finally {
    tsExecutedVas = [...endVaTrace113c()].sort()
  }
  return {
    scenario: name,
    bootFrame,
    lastGoldenFrame,
    bootCheck,
    strictHorizon: bootCheck === null ? strictHorizon : bootFrame - 1,
    posHorizon: bootCheck === null ? posHorizon : bootFrame - 1,
    firstStrictDivergence: firstStrict,
    firstPosDivergence: firstPos,
    unportedHit,
    framesStepped,
    tsExecutedVas,
  }
}

export function buildK3Artifact113c(r: ReplayResult113c): DivergenceArtifact113c {
  const d = r.firstStrictDivergence
  const context: Array<{ frame: number; row: unknown }> = []
  if (d !== null && d.id !== null && d.key.startsWith('t')) {
    const golden = loadGolden113c(r.scenario)
    for (let f = Math.max(1, d.frame - 3); f <= d.frame; f++) {
      const rows = golden.frames.get(f)?.[d.key as `t${number}`]
      if (rows === undefined) continue
      context.push({ frame: f, row: rows.find((row) => row[0] === d.id) })
    }
  }
  return {
    scenario: r.scenario,
    bootFrame: r.bootFrame,
    lastGoldenFrame: r.lastGoldenFrame,
    strictHorizon: r.strictHorizon,
    posHorizon: r.posHorizon,
    matchedKernelFrames: Math.max(0, r.strictHorizon - r.bootFrame),
    bootCheck: r.bootCheck,
    firstDivergence: d,
    firstPosDivergence: r.firstPosDivergence,
    unportedHit: r.unportedHit,
    context,
    goldenSha256: sha256File(goldenPath113c(r.scenario)),
    snapshotSha256: sha256File(k3SnapshotPath113c(r.scenario, r.bootFrame)),
  }
}

export function loadK3Coverage113c(name: string): Coverage113c {
  const lines = gunzipSync(readFileSync(k3CoveragePath113c(name)))
    .toString('utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
  const hdr = JSON.parse(lines[0] as string) as {
    k: string
    from: number
    to: number
    entries: number
    hit: number
    otherThreadHits: number
  }
  if (hdr.k !== 'hdr') throw new Error(`${name}: coverage has no header`)
  const hits = lines.slice(1).map((l) => {
    const o = JSON.parse(l) as { m: string; va: string; f: number }
    return { module: o.m, va: parseInt(o.va, 16), firstFrame: o.f }
  })
  if (hits.length !== hdr.hit) throw new Error(`${name}: coverage header says ${hdr.hit} hits, file has ${hits.length}`)
  return {
    from: hdr.from,
    to: hdr.to,
    entries: hdr.entries,
    hit: hdr.hit,
    otherThreadHits: hdr.otherThreadHits,
    hits,
  }
}

const DONE_STATUSES_113C = new Set(['ported', 'diff-verified'])

export function computeK3Gaps113c(name: string, opts?: ComputeGapsOptions113c): ScenarioGap113c {
  const coverage = loadK3Coverage113c(name)
  const manifest = loadManifest113c()
  const rawTsVas = opts?.tsExecutedVas !== undefined ? opts.tsExecutedVas : runK3Replay113c(name).tsExecutedVas
  const tsExecutedSet = new Set<string>(rawTsVas)
  const tsExecutedVas = [...tsExecutedSet].sort()

  const executed: GapSummary113c['executed'] = {}
  const runtimeMutable: Record<
    string,
    { dllExecuted: number; tsExecuted: number; tsTotalExecuted: number; runtimeGap: number; runtimeGapBytes: number }
  > = {
    D2Common: { dllExecuted: 0, tsExecuted: 0, tsTotalExecuted: 0, runtimeGap: 0, runtimeGapBytes: 0 },
    D2Game: { dllExecuted: 0, tsExecuted: 0, tsTotalExecuted: 0, runtimeGap: 0, runtimeGapBytes: 0 },
  }
  for (const key of tsExecutedVas) {
    const colon = key.indexOf(':')
    const mod = colon >= 0 ? key.slice(0, colon) : key
    let rm = runtimeMutable[mod]
    if (rm === undefined) {
      rm = { dllExecuted: 0, tsExecuted: 0, tsTotalExecuted: 0, runtimeGap: 0, runtimeGapBytes: 0 }
      runtimeMutable[mod] = rm
    }
    rm.tsTotalExecuted++
  }

  const dllExecutedVas: string[] = []
  const manifestGap: GapRow113c[] = []
  const runtimeExecGap: GapRow113c[] = []
  const impure: Array<GapRow113c & { kernFile: string }> = []
  const purity = new Map<string, boolean>()
  const isPure = (kf: string): boolean => {
    let v = purity.get(kf)
    if (v === undefined) {
      v = legacyReachable(collectImportGraph(REPO_ROOT_113C, [kf]), [kf]).length === 0
      purity.set(kf, v)
    }
    return v
  }
  for (const h of coverage.hits) {
    const key = manifestKey113c(h.module, h.va)
    dllExecutedVas.push(key)
    const f = manifest.get(key)
    if (f === undefined) throw new Error(`${name}: covered ${key} is not a manifest function`)
    let e = executed[h.module]
    if (e === undefined) {
      e = { total: 0, done: 0, gap: 0, gapBytes: 0 }
      executed[h.module] = e
    }
    e.total++

    let rm = runtimeMutable[h.module]
    if (rm === undefined) {
      rm = { dllExecuted: 0, tsExecuted: 0, tsTotalExecuted: 0, runtimeGap: 0, runtimeGapBytes: 0 }
      runtimeMutable[h.module] = rm
    }
    rm.dllExecuted++

    if (tsExecutedSet.has(key)) {
      rm.tsExecuted++
    } else {
      rm.runtimeGap++
      rm.runtimeGapBytes += f.size
      runtimeExecGap.push({
        module: h.module,
        va: h.va,
        name: f.name,
        size: f.size,
        status: f.status,
        firstFrame: h.firstFrame,
      })
    }

    if (DONE_STATUSES_113C.has(f.status)) {
      e.done++
      if (typeof f.kernFile === 'string' && !isPure(f.kernFile)) {
        impure.push({
          module: h.module,
          va: h.va,
          name: f.name,
          size: f.size,
          status: f.status,
          firstFrame: h.firstFrame,
          kernFile: f.kernFile,
        })
      }
      continue
    }
    e.gap++
    e.gapBytes += f.size
    manifestGap.push({
      module: h.module,
      va: h.va,
      name: f.name,
      size: f.size,
      status: f.status,
      firstFrame: h.firstFrame,
    })
  }
  dllExecutedVas.sort()
  manifestGap.sort((a, b) => a.firstFrame - b.firstFrame || a.va - b.va)
  runtimeExecGap.sort((a, b) => a.firstFrame - b.firstFrame || a.va - b.va)
  impure.sort((a, b) => a.firstFrame - b.firstFrame || a.va - b.va)
  const runtimeExecuted: Record<string, RuntimeModuleCoverage113c> = runtimeMutable
  return {
    scenario: name,
    coverage,
    executed,
    gaps: manifestGap,
    impure,
    dllExecutedVas,
    tsExecutedVas,
    manifestGap,
    runtimeExecGap,
    runtimeExecuted,
  }
}

function hexVa(va: number): string {
  return `0x${(va >>> 0).toString(16).toUpperCase().padStart(8, '0')}`
}

export function k3GapMarkdown113c(s: ScenarioGap113c): string {
  const c = s.coverage
  const lines = [
    `# K3 replay coverage & runtime execution gap list: ${s.scenario}`,
    '',
    'Generated by `npx tsx tools/oracle/kern-replay/k3-replay.ts --write`; do not edit by hand.',
    '',
    `Source: \`tests/fixtures/oracle/k3/replay/${s.scenario}.coverage.ndjson.gz\` (function-entry coverage of the`,
    `original 1.13c D2Game.dll + D2Common.dll under headless Wine \`d2host-113c.exe\`, frames F${c.from}..F${c.to},`,
    `${c.hit}/${c.entries} manifest entries hit, ${c.otherThreadHits} traps on other threads) vs live TS \`va-trace-113c\``,
    `execution across \`runK3Replay113c('${s.scenario}')\`.`,
    '',
    '| Module | DLL executed | TS executed (`dll ∩ ts`) | TS total hit | manifest unported | manifest gap bytes | runtime exec gap (`dll - ts`) | runtime gap bytes |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
  ]
  for (const mod of ['D2Common', 'D2Game']) {
    const e = s.executed[mod] ?? { total: 0, done: 0, gap: 0, gapBytes: 0 }
    const r = s.runtimeExecuted[mod] ?? {
      dllExecuted: 0,
      tsExecuted: 0,
      tsTotalExecuted: 0,
      runtimeGap: 0,
      runtimeGapBytes: 0,
    }
    lines.push(
      `| ${mod} | ${e.total} | ${r.tsExecuted} / ${r.dllExecuted} | ${r.tsTotalExecuted} | ${e.gap} | ${e.gapBytes} | ${r.runtimeGap} | ${r.runtimeGapBytes} |`,
    )
  }
  for (const mod of ['D2Common', 'D2Game']) {
    const rows = s.manifestGap.filter((g) => g.module === mod)
    lines.push(
      '',
      `## ${mod} Manifest Unported (${rows.length})`,
      '',
      '| first | VA | size | status | name |',
      '|---:|---|---:|---|---|',
    )
    for (const g of rows) lines.push(`| F${g.firstFrame} | \`${hexVa(g.va)}\` | ${g.size} | ${g.status} | ${g.name} |`)
  }
  for (const mod of ['D2Common', 'D2Game']) {
    const rows = s.runtimeExecGap.filter((g) => g.module === mod)
    lines.push(
      '',
      `## ${mod} Runtime Execution Gap — DLL Hit Not Executed by TS (${rows.length})`,
      '',
      '| first | VA | size | manifest status | name |',
      '|---:|---|---:|---|---|',
    )
    for (const g of rows) lines.push(`| F${g.firstFrame} | \`${hexVa(g.va)}\` | ${g.size} | ${g.status} | ${g.name} |`)
  }
  lines.push(
    '',
    `## Executed ported/diff-verified functions on an impure kernFile (${s.impure.length})`,
    '',
    '| first | module | VA | size | status | name | kernFile |',
    '|---:|---|---|---:|---|---|---|',
  )
  for (const g of s.impure) {
    lines.push(`| F${g.firstFrame} | ${g.module} | \`${hexVa(g.va)}\` | ${g.size} | ${g.status} | ${g.name} | \`${g.kernFile}\` |`)
  }
  lines.push('')
  return lines.join('\n')
}

export function k3ArtifactMarkdown113c(a: DivergenceArtifact113c, rootCauseMd?: string): string {
  const d = a.firstDivergence
  const dp = a.firstPosDivergence
  const lines = [
    `# K3 kernel replay: ${a.scenario}`,
    '',
    `| | |`,
    `|---|---|`,
    `| Boot snapshot | F${a.bootFrame} (\`${a.snapshotSha256.slice(0, 16)}…\`) |`,
    `| Golden | F1..F${a.lastGoldenFrame} (\`${a.goldenSha256.slice(0, 16)}…\`) |`,
    `| Boot check (hydrated F${a.bootFrame} vs golden, strict) | ${a.bootCheck === null ? 'identical' : `DIFFERS: ${JSON.stringify(a.bootCheck)}`} |`,
    `| Strict horizon (all fields incl. seeds, stats) | F${a.strictHorizon} |`,
    `| Position horizon (id/class/mode/x/y) | F${a.posHorizon} |`,
    `| Kernel frames matched | ${a.matchedKernelFrames} of ${a.lastGoldenFrame - a.bootFrame} |`,
    '',
    '## First strict divergence',
    '',
  ]
  if (d === null) {
    lines.push('None: the kernel matches the golden on every frame.')
  } else {
    lines.push(
      `- frame: F${d.frame}`,
      `- key: \`${d.key}\``,
      `- unit id: ${d.id === null ? '-' : d.id}`,
      `- field: \`${d.field}\``,
      `- expected: \`${JSON.stringify(d.expected)}\``,
      `- actual: \`${JSON.stringify(d.actual)}\``,
    )
  }
  if (dp !== null && (d === null || dp.frame !== d.frame || dp.key !== d.key || dp.field !== d.field || dp.id !== d.id)) {
    lines.push(
      '',
      '## First position divergence',
      '',
      `- frame: F${dp.frame}`,
      `- key: \`${dp.key}\``,
      `- unit id: ${dp.id === null ? '-' : dp.id}`,
      `- field: \`${dp.field}\``,
      `- expected: \`${JSON.stringify(dp.expected)}\``,
      `- actual: \`${JSON.stringify(dp.actual)}\``,
    )
  }
  if (a.unportedHit !== null) {
    lines.push(
      '',
      '## Unported kernel function hit',
      '',
      `- \`${a.unportedHit.key}\` (manifest status \`${a.unportedHit.status}\`) at F${a.unportedHit.frame}`,
      `- ${a.unportedHit.reason}`,
    )
  }
  if (rootCauseMd !== undefined && rootCauseMd.trim().length > 0) {
    lines.push('', '## Root-cause analysis (`D2Game.dll` VAs & handlers)', '', rootCauseMd.trim())
  }
  if (a.context.length > 0) {
    lines.push('', '## Golden context', '', '| frame | row |', '|---|---|')
    for (const c of a.context) lines.push(`| F${c.frame} | \`${JSON.stringify(c.row)}\` |`)
  }
  lines.push('')
  return lines.join('\n')
}

function main(argv: readonly string[]): number {
  const write = argv.includes('--write')
  const update = argv.includes('--update-horizons')
  const named = argv.filter((a) => !a.startsWith('--'))
  const scenarios = named.length > 0 ? named : [...K3_REPLAY_SCENARIOS_113C]
  const results = scenarios.map((s) => runK3Replay113c(s))
  mkdirSync(K3_DIVERGENCE_DIR_113C, { recursive: true })
  for (const r of results) {
    const a = buildK3Artifact113c(r)
    const gap = computeK3Gaps113c(r.scenario, { tsExecutedVas: r.tsExecutedVas })
    const rc = gap.runtimeExecuted.D2Common ?? {
      dllExecuted: 0,
      tsExecuted: 0,
      tsTotalExecuted: 0,
      runtimeGap: 0,
      runtimeGapBytes: 0,
    }
    const rg = gap.runtimeExecuted.D2Game ?? {
      dllExecuted: 0,
      tsExecuted: 0,
      tsTotalExecuted: 0,
      runtimeGap: 0,
      runtimeGapBytes: 0,
    }
    console.log(
      `${r.scenario}: boot F${r.bootFrame} ${r.bootCheck === null ? 'ok' : 'MISMATCH'}, strict F${r.strictHorizon}/${r.lastGoldenFrame}, pos F${r.posHorizon}/${r.lastGoldenFrame}, firstStrict=${JSON.stringify(r.firstStrictDivergence)}, firstPos=${JSON.stringify(r.firstPosDivergence)}, d2commonExec=${rc.tsExecuted}/${rc.dllExecuted} (totalTS=${rc.tsTotalExecuted}, manifestGap=${gap.executed.D2Common?.gap ?? 0}, runtimeExecGap=${rc.runtimeGap}), d2gameExec=${rg.tsExecuted}/${rg.dllExecuted} (totalTS=${rg.tsTotalExecuted}, manifestGap=${gap.executed.D2Game?.gap ?? 0}, runtimeExecGap=${rg.runtimeGap})`,
    )
    if (write) {
      const rootCauseMd = K3_SCENARIO_ROOT_CAUSE_MD_113C[r.scenario as K3ReplayScenarioName113c]
      writeFileSync(join(K3_DIVERGENCE_DIR_113C, `${r.scenario}.divergence.json`), `${JSON.stringify(a, null, 2)}\n`)
      writeFileSync(join(K3_DIVERGENCE_DIR_113C, `${r.scenario}.divergence.md`), k3ArtifactMarkdown113c(a, rootCauseMd))
      writeFileSync(join(K3_DIVERGENCE_DIR_113C, `gap-${r.scenario}.md`), k3GapMarkdown113c(gap))
    }
  }
  if (update) {
    let committed: Record<string, Horizon113c> = {}
    try {
      committed = loadK3Horizons113c()
    } catch {
      committed = {}
    }
    const { next, regressions } = mergeHorizons113c(committed, results)
    if (regressions.length > 0) {
      console.error(`horizon regression, horizons.json left unchanged:\n  ${regressions.join('\n  ')}`)
      return 1
    }
    writeFileSync(K3_HORIZONS_PATH_113C, `${JSON.stringify(next, null, 2)}\n`)
  }
  return 0
}

if (process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = main(process.argv.slice(2))
}
