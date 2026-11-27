/**
 * Client display-value differential (oracle phase P5.4).
 *
 * Two halves that produce the same `ClientUiValues` record:
 *
 *  - `parseOracleClientUi`: reads the NDJSON written by the original-game hook
 *    `tools/oracle/hook/clientui.dll.c` (strings captured from the original D2Client draw functions:
 *    `UI_DrawCharSheet` 0x6FB6CEA0, the per-skill attack block 0x6FADFD30 and the skill tree tooltip
 *    builders 0x6FAE3B50 / 0x6FAE3550; evidence in kb/ui/oracle-client-display-113c.md).
 *  - `computeTsClientUi`: loads the same `.d2s` into the TS server (`GameInstance`), forwards the
 *    player's server events into a headless TS client (`OnlineSession` -> `ClientWorld` -> `HudModel`),
 *    and reads what the TS character sheet / skill tree would draw.
 *
 * The comparison therefore covers the TS server's resolution *and* the TS client's display of it. To
 * keep the two apart, each record also carries the raw client stat list (`stats`): when the TS client
 * already holds a different stat value than the original client, the mismatch is server/protocol
 * resolution; when the stats agree but the displayed value differs, it is client display.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { OnlineSession } from '../../../src/client/session/online-session.ts'
import { hexToBytes } from '../../../src/netproto/index.ts'
import { decodeD2gsC2sPacketToCommand } from '../../../src/server/net/session.ts'
import {
  computeCharacterBlockChancePct,
  doesSkillShowDamageRow,
  doesSkillUseAttackRating,
} from '../../../src/client/ui/character-sheet.ts'
import { GameInstance } from '../../../src/server/engine/game-instance.ts'
import { SINGLE_PLAYER_POLICY } from '../../../src/server/engine/game-instance/constants-and-helpers.ts'
import { createMapServiceAreaLevelSource } from '../../../src/client/map/map-service-area-source.ts'
import { createAreaBootstrapResolver } from '../../../src/server/world/area-bootstrap.ts'
import type { ReplicaEnvironment } from './replica.ts'

/** Character-sheet value fields, in `UI_DrawCharSheet` table order (0x6FB8D6F0, 18 x 16 bytes). */
export const SHEET_FIELDS = [
  'level',
  'experience',
  'nextLevel',
  'strength',
  'dexterity',
  'defense',
  'vitality',
  'maxStamina',
  'stamina',
  'maxLife',
  'life',
  'energy',
  'maxMana',
  'mana',
  'fireRes',
  'coldRes',
  'lightRes',
  'poisonRes',
] as const
export type SheetField = (typeof SHEET_FIELDS)[number]

export const COMPUTED_FIELDS = ['blockChance', 'leftAttackRating', 'rightAttackRating'] as const
export type ComputedField = (typeof COMPUTED_FIELDS)[number]

/** 0x6FB8D6F0 rows: [xLeft, yBase, xRight, statId] (panel-relative; the 640x480 panel origin is 0,0). */
export const SHEET_TABLE_113C: readonly (readonly [number, number, number, number])[] = [
  [13, 59, 53, 12],
  [67, 59, 180, 13],
  [195, 59, 308, 30],
  [77, 99, 112, 0],
  [77, 161, 112, 2],
  [273, 209, 307, 31],
  [77, 247, 112, 3],
  [232, 246, 267, 11],
  [273, 246, 308, 10],
  [232, 270, 267, 7],
  [273, 270, 308, 6],
  [77, 308, 112, 1],
  [232, 308, 267, 9],
  [273, 308, 308, 8],
  [273, 348, 307, 39],
  [273, 372, 307, 43],
  [273, 396, 307, 41],
  [273, 420, 307, 45],
]

/** What the character sheet shows for one skill placed in the left (top) attack block. */
export interface SkillBlockValues {
  /** Upper-case skill name drawn on the block (`0x6FADFD30`), as displayed. */
  readonly name: string | null
  /** Damage text drawn next to "Damage" (`0x6FBA5210[descdam]`), `null` when the original draws none. */
  readonly damage: string | null
  /** Attack rating drawn in the AR box (`0x6FBA52A0[descatt]`), `null` when not drawn. */
  readonly attackRating: number | null
}

export interface ClientUiValues {
  readonly source: 'oracle' | 'ts'
  readonly classId: number
  readonly sheet: Readonly<Record<SheetField, string | null>>
  /** Raw client stat list values (accrued), for attributing mismatches (server vs client). */
  readonly stats: Readonly<Record<string, number>>
  readonly leftSkill: number
  readonly rightSkill: number
  /**
   * Hover / computed values: block chance (defense hover 0x6FB6C760: D2Common #10212, else weapon block
   * 0x6FB6C430) and the attack rating of the selected left / right skill (0x6FADE350; 0 = no AR box).
   */
  readonly computed: Readonly<Record<ComputedField, number>>
  /** Skill ids in the client player's skill list, ascending. */
  readonly skillList: readonly number[]
  /** Per owned skill id: the attack block with that skill selected. */
  readonly skills: Readonly<Record<string, SkillBlockValues>>
  /** Per owned skill id: skill tree tooltip lines, top-to-bottom, colour codes stripped. */
  readonly tooltips: Readonly<Record<string, readonly string[]>>
  /** Per owned skill id: [hard, total] skill level. */
  readonly skillLevels: Readonly<Record<string, readonly [number, number]>>
}

// ---------------------------------------------------------------------------------------------
// Original (oracle) side
// ---------------------------------------------------------------------------------------------

type TextRec = [fn: number, x: number, y: number, color: number, font: number, text: string]

interface OracleLine {
  kind: string
  [k: string]: unknown
}

/** Removes D2 colour escapes (`ÿc<n>`). */
export function stripColor(s: string): string {
  return s.replace(/\u00ffc./g, '')
}

/**
 * D2 multi-line text is stored bottom line first (the strcat order of the builders; D2Win draws the
 * buffer bottom-up). Returns the lines top-to-bottom with colour codes removed.
 */
export function tooltipLinesFromBuffer(buf: string): string[] {
  return stripColor(buf).split('\n').reverse()
}

const NUMERIC_RE = /^-?\d[\d,]*(-\d[\d,]*)?%?$/

/** Parses one per-skill attack block capture (`0x6FADFD30` with slot 0 = top / left block). */
export function parseSkillBlock(texts: readonly TextRec[]): SkillBlockValues {
  const name = texts[0]?.[5] ?? null
  let damage: string | null = null
  let attackRating: number | null = null
  // Layout table 0x6FBA52E8 (12-byte rows) puts the damage value on the name/damage rows
  // (y < 140 in the 640x480 panel) and the attack rating in the AR box (y >= 140).
  for (const t of texts.slice(1)) {
    const s = stripColor(t[5])
    if (!NUMERIC_RE.test(s)) continue
    if (t[2] < 140) damage ??= s
    else attackRating ??= Number(s.replace(/,/g, ''))
  }
  return { name, damage, attackRating }
}

/** Capture labels in an oracle ui.ndjson (`capture` lines; a file without them is one "town" capture). */
export function oracleCaptureLabels(ndjson: string): string[] {
  const labels = ndjson
    .split('\n')
    .filter((l) => l.includes('"kind":"capture"'))
    .map((l) => (JSON.parse(l) as { label: string }).label)
  return labels.length ? labels : ['town']
}

export function parseOracleClientUi(ndjson: string, label?: string): ClientUiValues {
  const all = ndjson
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as OracleLine)
  let lines = all
  if (all.some((l) => l.kind === 'capture')) {
    const start = label === undefined ? all.findIndex((l) => l.kind === 'capture') : all.findIndex((l) => l.kind === 'capture' && l.label === label)
    if (start < 0) throw new Error(`oracle ui.ndjson: no capture "${label}"`)
    const end = all.findIndex((l, i) => i > start && l.kind === 'capture')
    lines = all.slice(start + 1, end < 0 ? undefined : end)
  }
  const meta = lines.find((l) => l.kind === 'meta')
  const statsLine = lines.find((l) => l.kind === 'stats')
  const calc = lines.find((l) => l.kind === 'calc')
  const sheetLine = lines.find((l) => l.kind === 'charsheet')
  if (!meta || !statsLine || !calc || !sheetLine) throw new Error('oracle ui.ndjson: missing meta/stats/calc/charsheet')
  if (sheetLine.fault) throw new Error('oracle ui.ndjson: UI_DrawCharSheet faulted')
  const texts = sheetLine.texts as TextRec[]
  const sheet = {} as Record<SheetField, string | null>
  SHEET_FIELDS.forEach((field, i) => {
    const [xl, y, xr] = SHEET_TABLE_113C[i]!
    // Values are centred in [xLeft, xRight] on baseline yBase (0x6FB6DB90..0x6FB6DBEB).
    const hit = texts.find((t) => t[2] === y && t[1] >= xl && t[1] <= xr && t[4] !== 6)
    sheet[field] = hit ? stripColor(hit[5]) : null
  })
  const skills: Record<string, SkillBlockValues> = {}
  const tooltips: Record<string, readonly string[]> = {}
  const skillLevels: Record<string, readonly [number, number]> = {}
  for (const l of lines) {
    const id = String(l.skill)
    if (l.kind === 'skill') {
      skills[id] = parseSkillBlock(l.texts as TextRec[])
      skillLevels[id] = [l.hard as number, l.total as number]
    } else if (l.kind === 'tooltip') {
      // The builder's own text is the last D2Win #10085 draw (0x6FAE40D8 / 0x6FAE3B37); scroll/tome
      // skills draw their quantity box first.
      const recs = (l.texts as TextRec[]).filter((t) => t[0] === 10085)
      const last = recs[recs.length - 1]
      tooltips[id] = last ? tooltipLinesFromBuffer(last[5]) : []
    }
  }
  return {
    source: 'oracle',
    classId: meta.class as number,
    sheet,
    stats: statsLine.accrued as Record<string, number>,
    leftSkill: calc.leftSkill as number,
    rightSkill: calc.rightSkill as number,
    computed: {
      blockChance: (calc.block as number) > 0 ? (calc.block as number) : (calc.weaponBlock as number),
      leftAttackRating: calc.arLeft as number,
      rightAttackRating: calc.arRight as number,
    },
    skillList: lines.filter((l) => l.kind === 'skill').map((l) => l.skill as number).sort((x, y) => x - y),
    skills,
    tooltips,
    skillLevels,
  }
}

// ---------------------------------------------------------------------------------------------
// TS side
// ---------------------------------------------------------------------------------------------

function headerMapSeed(d2s: Uint8Array): number {
  return d2s.byteLength >= 0xaf ? new DataView(d2s.buffer, d2s.byteOffset).getUint32(0xab, true) >>> 0 : 0
}

const fmtThousands = (n: number): string => Math.trunc(n).toLocaleString('en-US')

const EXCLUDED_NAME = '(not hand-selectable)'
/** Marker for skills no player can put on a mouse button: passives (`Skills.txt passive`). */
export const EXCLUDED_BLOCK: SkillBlockValues = { name: EXCLUDED_NAME, damage: null, attackRating: null }
/**
 * Identify / Town Portal scroll and tome skills (217..220) are bound to the scroll/tome item; the
 * original only offers them on a hand while such an item is carried, so a bare selection is not a
 * state the game can reach.
 */
export const EXCLUDED_BLOCK_SKILLS: ReadonlySet<number> = new Set([217, 218, 219, 220])

/** One TS run: a save, frame-stamped C2S inputs and the frames at which the display is read. */
export interface ClientUiCase {
  readonly save: string
  readonly inputs: readonly { readonly frame: number; readonly c2s: string }[]
  /** [frame, label]; the town captures read frame 75 (the oracle samples 75 frames after entering). */
  readonly captures: readonly (readonly [number, string])[]
}

/** Delivers one C2S packet like a D2GS connection in game state (same path as tools/oracle/lib/replica.ts). */
function deliverC2s(game: GameInstance, pid: number, hex: string): void {
  const pkt = hexToBytes(hex)
  const cmd = decodeD2gsC2sPacketToCommand(pkt)
  if (cmd === null) throw new Error(`client-ui: C2S ${hex} is not decodable by the D2GS server path`)
  if (cmd.type === 'Ping') return
  game.enqueueCommand(pid, cmd)
}

/**
 * Runs the TS server + headless TS client for one case and reads the displayed values at every capture.
 * Pure function of (save bytes, inputs, environment data): fixed-step `GameInstance.stepFrame()`; inputs tagged
 * frame F are enqueued before the step that produces frame F (oracle `on_pre_frame` convention).
 */
export function runTsClientUiCase(c: ClientUiCase, env: ReplicaEnvironment, repoRoot?: string): Record<string, ClientUiValues> {
  const d2s = new Uint8Array(readFileSync(resolve(repoRoot ?? process.cwd(), c.save)))
  const seed = headerMapSeed(d2s) || 12345
  const game = new GameInstance({
    mode: 'singlePlayer',
    policy: SINGLE_PLAYER_POLICY,
    difficulty: 0,
    mapSeed: seed,
    animActionWindup: true,
    registry: env.registry,
    resolveAreaBootstrap: createAreaBootstrapResolver(createMapServiceAreaLevelSource(env.mapService)),
  })
  const pid = game.connectPlayer({ d2s, restoreMercenary: true })
  const session = new OnlineSession()
  session.hudManager.resize(800, 600)
  const pump = (): void => {
    for (const ev of game.drainEvents(pid)) session.handleServerEvent(ev)
  }
  pump()
  const out: Record<string, ClientUiValues> = {}
  const caps = [...c.captures].sort((x, y) => x[0] - y[0])
  let next = 0
  for (let f = 1; f <= caps[caps.length - 1]![0]; f++) {
    while (next < c.inputs.length && c.inputs[next]!.frame <= f) deliverC2s(game, pid, c.inputs[next++]!.c2s)
    game.stepFrame()
    pump()
    for (const [cf, label] of caps) if (cf === f) out[label] = readTsClientUi(session, env)
  }
  return out
}

/** Town case of one save (75 frames, no inputs). */
export function computeTsClientUi(savePath: string, env: ReplicaEnvironment): ClientUiValues {
  return runTsClientUiCase({ save: savePath, inputs: [], captures: [[75, 'town']] }, env).town!
}

function readTsClientUi(session: OnlineSession, env: ReplicaEnvironment): ClientUiValues {
  const model = session.hudModel
  const hud = session.hudManager
  hud.charSheet.lang = 'ENG'
  hud.skillTree.lang = 'ENG'
  model.syncFromWorld()
  const self = session.world.self as unknown as {
    charClass: number
    leftSkill: number
    rightSkill: number
    stats: { get(id: number): number }
  }
  const a = hud.charSheet.attrs
  // Value expressions are the ones CharacterSheetPanel.draw uses (src/client/ui/character-sheet.ts).
  const num = (v: unknown): string | null => (typeof v === 'number' && Number.isFinite(v) ? String(Math.round(v)) : null)
  const sheet: Record<SheetField, string | null> = {
    level: num(a.level),
    experience: fmtThousands(a.xp),
    nextLevel: fmtThousands(a.nextLevelXp),
    strength: num(a.str),
    dexterity: num(a.dex),
    defense: num(a.defense),
    vitality: num(a.vit),
    maxStamina: num(a.maxStamina || hud.maxStamina),
    stamina: num(hud.stamina),
    maxLife: num(a.maxHp || hud.maxHp),
    life: num(hud.hp),
    energy: num(a.ene),
    maxMana: num(a.maxMana || hud.maxMana),
    mana: num(hud.mana),
    fireRes: num(a.fireRes),
    coldRes: num(a.coldRes),
    lightRes: num(a.lightRes),
    poisonRes: num(a.poisRes),
  }
  const stats: Record<string, number> = {}
  for (let id = 0; id < 359; id++) {
    const v = self.stats.get(id)
    if (v) stats[String(id)] = v
  }
  const leftSkill = self.leftSkill
  const rightSkill = self.rightSkill

  const skills: Record<string, SkillBlockValues> = {}
  const tooltips: Record<string, readonly string[]> = {}
  const skillLevels: Record<string, readonly [number, number]> = {}
  const tree = hud.skillTree
  const selfSkills = session.world.self as unknown as {
    skills: ReadonlyMap<number, number>
    skillEntries: ReadonlyMap<number, { level?: number; baseLevel?: number }>
    defaultSkills: ReadonlyMap<number, number>
  }
  // Client skill list: server-assigned skills plus the unit's default skills (D2Client 0x6FAC91E0 -> #10506).
  const known = new Set<number>([
    ...selfSkills.skills.keys(),
    ...selfSkills.skillEntries.keys(),
    ...selfSkills.defaultSkills.keys(),
  ])
  const skillList = [...known].sort((x, y) => x - y)
  const owned = known
  const skillsTxt = env.registry.skills.rows
  for (const id of [...owned].sort((x, y) => x - y)) {
    const entry = selfSkills.skillEntries.get(id)
    const hard =
      tree.getHardPoints(id) ||
      Math.max(0, Number(entry?.baseLevel ?? selfSkills.skills.get(id) ?? selfSkills.defaultSkills.get(id) ?? 0))
    const total = tree.getEffectiveLevel(id) || Math.max(0, Number(entry?.level ?? hard))
    skillLevels[String(id)] = [hard, total]
    const row = skillsTxt.find((r) => Number(r.Id) === id)
    if (!row) throw new Error(`Skills.txt has no row ${id}`)
    if (Number(row.passive) || EXCLUDED_BLOCK_SKILLS.has(id)) {
      skills[String(id)] = EXCLUDED_BLOCK
    } else {
      // Put the skill in the hand it can be selected on (Skills.txt `leftskill`), like a player would;
      // the original block (0x6FADFD30) depends only on the skill, not on the hand.
      const left = Number(row.leftskill) === 1
      if (left) self.leftSkill = id
      else self.rightSkill = id
      model.syncFromWorld()
      const held = left ? self.leftSkill : self.rightSkill
      if (held !== id) {
        skills[String(id)] = { name: `(TS refuses to select ${id})`, damage: null, attackRating: null }
      } else {
        // Expressions of CharacterSheetPanel.draw: block name, damage row (descdam handler present and the
        // item-based handler not empty) and the AR box (descatt handler present).
        const nameV = left ? a.leftSkillName : a.rightSkillName
        const dmgV = left ? a.leftSkillDmg : a.rightSkillDmg
        const arV = left ? (a.leftAttackRating ?? a.leftAR ?? a.attackRating) : (a.rightAttackRating ?? a.rightAR ?? a.attackRating)
        const empty = (left ? a.leftSkillBlockEmpty : a.rightSkillBlockEmpty) === true
        skills[String(id)] = {
          name: typeof nameV === 'string' && nameV ? nameV : null,
          damage: doesSkillShowDamageRow(id) && !empty ? (typeof dmgV === 'string' && dmgV ? dmgV : '1-2') : null,
          attackRating: doesSkillUseAttackRating(id) && !empty ? Number(arV) : null,
        }
      }
      self.leftSkill = leftSkill
      self.rightSkill = rightSkill
    }
    let tip: readonly string[]
    try {
      tip = tree.formatSkillTooltipLines(id).map((l) => stripColor(l.text))
    } catch (err) {
      tip = [`(TS tooltip error: ${err instanceof Error ? err.message : String(err)})`]
    }
    tooltips[String(id)] = tip
  }
  model.syncFromWorld()
  return {
    source: 'ts',
    classId: self.charClass,
    sheet,
    stats,
    leftSkill,
    rightSkill,
    computed: {
      blockChance: computeCharacterBlockChancePct(a),
      leftAttackRating: doesSkillUseAttackRating(leftSkill) ? Number(a.leftAttackRating ?? a.leftAR ?? 0) : 0,
      rightAttackRating: doesSkillUseAttackRating(rightSkill) ? Number(a.rightAttackRating ?? a.rightAR ?? 0) : 0,
    },
    skillList,
    skills,
    tooltips,
    skillLevels,
  }
}

// ---------------------------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------------------------

export interface FieldDiff {
  readonly id: string
  readonly group: 'sheet' | 'skill' | 'tooltip'
  readonly original: string
  readonly ts: string
  readonly match: boolean
}

const show = (v: unknown): string => (v === null || v === undefined ? '—' : String(v))

/** Field-by-field comparison; ids are stable (`sheet.<field>`, `skill.<id>.<part>`, `tooltip.<id>.<line>`). */
export function compareClientUi(orig: ClientUiValues, ts: ClientUiValues): FieldDiff[] {
  const out: FieldDiff[] = []
  for (const f of SHEET_FIELDS) {
    out.push({ id: `sheet.${f}`, group: 'sheet', original: show(orig.sheet[f]), ts: show(ts.sheet[f]), match: orig.sheet[f] === ts.sheet[f] })
  }
  for (const [f, o, t] of [
    ['leftSkill', orig.leftSkill, ts.leftSkill],
    ['rightSkill', orig.rightSkill, ts.rightSkill],
  ] as const) {
    out.push({ id: `sheet.${f}`, group: 'sheet', original: show(o), ts: show(t), match: o === t })
  }
  for (const f of COMPUTED_FIELDS) {
    const o = orig.computed[f], t = ts.computed[f]
    out.push({ id: `sheet.${f}`, group: 'sheet', original: show(o), ts: show(t), match: o === t })
  }
  const ol = orig.skillList.join(','), tl = ts.skillList.join(',')
  out.push({ id: 'skills.list', group: 'skill', original: ol, ts: tl, match: ol === tl })
  for (const id of Object.keys(orig.skills).sort((x, y) => Number(x) - Number(y))) {
    const o = orig.skills[id]!
    const t = ts.skills[id]
    const ol = orig.skillLevels[id]
    const tlv = ts.skillLevels[id]
    const lv = (v: readonly [number, number] | undefined): string => (v ? `${v[0]}/${v[1]}` : '—')
    // Skills missing from the TS list are reported once, as `skills.list`.
    if (tlv && ts.skillList.includes(Number(id))) {
      out.push({ id: `skill.${id}.level`, group: 'skill', original: lv(ol), ts: lv(tlv), match: lv(ol) === lv(tlv) })
    }
    if (t?.name === EXCLUDED_NAME || EXCLUDED_BLOCK_SKILLS.has(Number(id))) continue
    for (const part of ['name', 'damage', 'attackRating'] as const) {
      const ov = o[part]
      const tv = t ? t[part] : undefined
      const norm = (v: unknown): string => show(v)
      out.push({ id: `skill.${id}.${part}`, group: 'skill', original: show(ov), ts: show(tv), match: norm(ov) === norm(tv) })
    }
  }
  for (const id of Object.keys(orig.tooltips).sort((x, y) => Number(x) - Number(y))) {
    const o = orig.tooltips[id]!
    const t = ts.tooltips[id] ?? []
    const n = Math.max(o.length, t.length)
    let first = -1
    for (let i = 0; i < n && first < 0; i++) if ((o[i] ?? '') !== (t[i] ?? '')) first = i
    if (first < 0) {
      out.push({ id: `tooltip.${id}`, group: 'tooltip', original: `${o.length} lines`, ts: `${t.length} lines`, match: true })
    } else {
      const line = (v: string | undefined): string => `L${first}: ${v === undefined || v === '' ? '—' : v}`
      out.push({ id: `tooltip.${id}`, group: 'tooltip', original: line(o[first]), ts: line(t[first]), match: false })
    }
  }
  return out
}

/** Line-level tooltip agreement: [matching lines, total lines] over all skills of the original. */
export function tooltipLineRate(orig: ClientUiValues, ts: ClientUiValues): [number, number] {
  let m = 0
  let n = 0
  for (const [id, o] of Object.entries(orig.tooltips)) {
    const t = ts.tooltips[id] ?? []
    const k = Math.max(o.length, t.length)
    n += k
    for (let i = 0; i < k; i++) if ((o[i] ?? '') === (t[i] ?? '')) m++
  }
  return [m, n]
}

// ---------------------------------------------------------------------------------------------
// Mismatch classes (suspected cause + layer)
// ---------------------------------------------------------------------------------------------

export interface MismatchClass {
  readonly layer: 'server' | 'client'
  readonly cause: string
}

/**
 * Root-cause classes seen in the P5.4 runs. `server` = the TS client already holds different data
 * than the original client (TS server/protocol resolution); `client` = the data agrees, the TS
 * display computation differs from the named original D2Client function.
 */
export const MISMATCH_CLASSES: Readonly<Record<string, MismatchClass>> = {
  'base-skill-list': {
    layer: 'server',
    cause:
      'The original client skill list (unit+0xA8 chain, D2Common #10306 levels) holds the class-less Skills.txt rows ' +
      '0..5 (Attack, Kick, Throw, Unsummon, Left Hand Throw/Swing) and 217..220 (scroll/tome skills) at level 1; the TS ' +
      'server never assigns them, so the TS ClientWorld skill list has only class skills.',
  },
  'short-name': {
    layer: 'client',
    cause:
      'D2Client 0x6FADFD30 draws SkillDesc `str alt` (word at SkillDesc+0x0E -> D2Lang #10003) upper-cased by ' +
      '0x6FB6E800; TS CharacterSheetPanel draws Skills `str name` (getSkillName).',
  },
  'no-damage-row': {
    layer: 'client',
    cause:
      'D2Client 0x6FADFD30 draws the "Damage" row only when SkillDesc descdam selects a non-null 0x6FBA5210 handler ' +
      'and it outputs a value (0x6FADFEA4..0x6FADFF89); TS CharacterSheetPanel.draw always draws the row with ' +
      'leftSkillDmg (`--` for non-damage skills, `1-2` fallback).',
  },
  'no-item-block': {
    layer: 'client',
    cause:
      'The 0x6FBA5210[descdam] / 0x6FBA52A0[descatt] handlers output nothing when the item the skill uses is absent ' +
      '(Throw without a throwable, Left Hand Throw/Swing without a left-hand weapon); TS computes the main-weapon damage/AR.',
  },
  'kick-damage': {
    layer: 'client',
    cause:
      'Kick: the original descdam handler (0x6FBA5210[descdam]) shows 0-1 for every class here (suspected: boots ' +
      'kick damage only, none equipped); TS combat-stats computes a strength/dexterity based kick range.',
  },
  'smite-damage': {
    layer: 'client',
    cause:
      'Smite: the original descdam handler (0x6FBA5210[descdam]) shows the shield smite damage (Armor.txt mindam/maxdam, ' +
      '1-5 here); TS uses the weapon damage path.',
  },
  'elemental-rounding': {
    layer: 'client',
    cause:
      'Synergy-boosted elemental min/max differ by 1: the original evaluates them with D2Common #10121 (0x6FDA0460) / ' +
      '#11091 (0x6FDA0360) in 256ths (synergy percent applied before the >>8), TS skill-calc-engine rounds differently.',
  },
  'radius-format': {
    layer: 'client',
    cause:
      'Radius descline (0x6FAE16C0 dispatcher): the original prints the integer radius from the calc ("1 yard"), TS ' +
      'formats a fractional yard value ("2.6 yards").',
  },
  'summon-damage': {
    layer: 'client',
    cause:
      'Summon damage descline (0x6FAE16C0): original "Damage: 61-63", TS "55 - 57" (value 6 lower, suspected missing ' +
      'Skeleton Mastery bonus, and a " - " separator the original does not print).',
  },
  'no-tooltip-nontree': {
    layer: 'client',
    cause:
      'The original builds a tooltip for every skill (0x6FAE3B50, also used by the skill-select popup); TS ' +
      'SkillTreePanel.formatSkillTooltipLines only knows class-tree skills and returns nothing for 0..5 / 217..220.',
  },
  unclassified: { layer: 'client', cause: 'not classified yet' },
}

const DIGITS_RE = /\d/

/** Assigns a mismatch class to one non-matching field. */
export function classifyMismatch(d: FieldDiff, orig: ClientUiValues): string {
  if (d.id === 'skills.list') return 'base-skill-list'
  const m = /^skill\.(\d+)\.(\w+)$/.exec(d.id)
  if (m) {
    const id = Number(m[1])
    const part = m[2]
    if (part === 'level') return 'base-skill-list'
    if (part === 'name') return 'short-name'
    if (id === 1) return 'kick-damage'
    if (id === 97) return 'smite-damage'
    if (d.original === '—' && d.ts === '--') return 'no-damage-row'
    if (d.original === '—' && (id === 2 || id === 4 || id === 5)) return 'no-item-block'
    if (DIGITS_RE.test(d.original) && DIGITS_RE.test(d.ts)) return 'elemental-rounding'
    return 'unclassified'
  }
  const t = /^tooltip\.(\d+)$/.exec(d.id)
  if (t) {
    if (d.ts.endsWith(': —') && !orig.skillList.some((s) => s === Number(t[1]) && s > 5 && s < 217)) return 'no-tooltip-nontree'
    if (d.original.includes('Radius')) return 'radius-format'
    if (Number(t[1]) === 70) return 'summon-damage'
    if (/Damage: \d/.test(d.original)) return 'elemental-rounding'
    return 'unclassified'
  }
  return 'unclassified'
}

// ---------------------------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------------------------

/** Town cases: one per class, its level-40 save. */
export const CLIENT_UI_TOWN_SAVES: Readonly<Record<string, string>> = {
  barbarian: 'tests/fixtures/oracle/saves/barbarian-l40-warcries.d2s',
  paladin: 'tests/fixtures/oracle/saves/paladin-l40-auras.d2s',
  amazon: 'tests/fixtures/oracle/saves/amazon-l40-passives.d2s',
  sorceress: 'tests/fixtures/oracle/saves/sorceress-l40-elemental.d2s',
  necromancer: 'tests/fixtures/oracle/saves/necromancer-l40-curses-summons.d2s',
}
/** Capture scenarios (tests/fixtures/oracle/scenarios/<name>.json, tools/oracle/make-p54-scenarios.py). */
export const CLIENT_UI_SCENARIOS: readonly string[] = ['p54-barbarian-buffs', 'p54-paladin-auras']

export interface NamedClientUiCase extends ClientUiCase {
  /** Oracle output directory name (`run-client-ui.sh <dir> <name>`). */
  readonly name: string
}

export function clientUiCases(repoRoot = process.cwd()): NamedClientUiCase[] {
  const out: NamedClientUiCase[] = Object.entries(CLIENT_UI_TOWN_SAVES).map(([name, save]) => ({
    name,
    save,
    inputs: [],
    captures: [[75, 'town']],
  }))
  for (const name of CLIENT_UI_SCENARIOS) {
    const s = JSON.parse(readFileSync(resolve(repoRoot, 'tests/fixtures/oracle/scenarios', `${name}.json`), 'utf8')) as {
      save: string
      inputs: { frame: number; c2s: string }[]
      captures: [number, string][]
    }
    out.push({ name, save: s.save, inputs: s.inputs, captures: s.captures })
  }
  return out
}

/** Result / golden id of one capture: the class for town captures, else `<scenario>-<label>`. */
export function captureId(caseName: string, label: string): string {
  return label === 'town' ? caseName : `${caseName}-${label}`
}
