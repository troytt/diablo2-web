/**
 * Offline packer: Diablo II 1.13c `Skills.txt` client-side columns → `src/common/skills/skill-client-113c.ts`.
 *
 * The compiled `D2SkillsTxt` record (0x23C bytes) consumed by `D2Client.dll`:
 * - `cltmissile` +0xE8, `cltmissilea..d` +0xEA..+0xF0, `cltstfunc` +0xF2 (table 0x6FB8E928, 70 slots @0x6FB8EA40),
 *   `cltdofunc` +0xF4 and `cltprgfunc1..3` +0xF6..+0xFA (table 0x6FB8EA48, 130 slots @0x6FB8EC50).
 * - `stsound` +0xFC, `stsoundclass` +0xFE, `dosound` +0x100, `dosound a/b` +0x102/+0x104.
 * - `castoverlay` +0x106, `tgtoverlay` +0x108, `tgtsound` +0x10A, `prgoverlay` +0x10C, `prgsound` +0x10E,
 *   `cltoverlaya/b` +0x110/+0x112, `cltcalc1..3` +0x114.., `ItemCastSound` +0x122, `ItemCastOverlay` +0x124,
 *   `ItemCltEffect` +0x16C, `aurastate` +0x80, `aurastat1` +0x54, `Param1..8` +0x148...
 * - dwFlags (byte+4/+5): `lob` bit1, `progressive` bit2 (S2C 0xA3 0x6FB5F03E), `prgstack` bit7 (0x6FB52A97),
 *   `stsuccessonly` bit12 (0x6FB52068), `stsounddelay` bit13 (0x6FB520A9), `weaponsnd` bit14 (0x6FB520ED).
 *
 * Names are resolved (Overlay.txt row, States.txt row, ItemStatCost.txt row, Missiles.txt row, Sounds.txt id) and the
 * packer fails fast on any unresolvable reference.
 *
 * Usage: `npx tsx src/baker/packers/pack-skill-client-113c.ts [mpqDir]`
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_NODE_MPQ_DIR, NodeMpqArchiveSource } from '../mpq-archive-source.ts'
import { resolveSoundNameToId113c } from './pack-skill-sounds.ts'

const SKILLS_TXT_PATH = 'data\\global\\excel\\Skills.txt'
const STATES_TXT_PATH = 'data\\global\\excel\\States.txt'
const OVERLAY_TXT_PATH = 'data\\global\\excel\\overlay.txt'
const MISSILES_TXT_PATH = 'data\\global\\excel\\Missiles.txt'
const ISC_TXT_PATH = 'data\\global\\excel\\ItemStatCost.txt'

export interface SkillClientRow113c {
  readonly id: number
  readonly skill: string
  readonly cltStFunc: number
  readonly cltDoFunc: number
  /** `cltprgfunc1..3`; 0 = none. */
  readonly cltPrgFunc: readonly [number, number, number]
  readonly lob: boolean
  readonly progressive: boolean
  readonly prgStack: boolean
  readonly stSuccessOnly: boolean
  readonly stSoundDelay: boolean
  readonly weaponSnd: boolean
  /** States.txt row id of `aurastate`, -1 when empty. */
  readonly auraState: number
  /** ItemStatCost.txt row id of `aurastat1`, -1 when empty. */
  readonly auraStat1: number
  readonly cltMissile: string
  readonly cltMissileA: string
  readonly cltMissileB: string
  readonly cltMissileC: string
  readonly cltMissileD: string
  readonly castOverlay: string
  readonly tgtOverlay: string
  readonly prgOverlay: string
  readonly cltOverlayA: string
  readonly cltOverlayB: string
  readonly stSound: number
  readonly stSoundClass: number
  readonly doSound: number
  readonly doSoundA: number
  readonly doSoundB: number
  readonly tgtSound: number
  readonly prgSound: number
  readonly itemCastSound: number
  readonly itemCastOverlay: string
  readonly itemCltEffect: number
  readonly cltCalc: readonly [string, string, string]
  /** `Param1..8` (+0x148..), empty = 0. */
  readonly params: readonly number[]
}

function parseTable(text: string): { header: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/)
  const header = (lines[0] ?? '').split('\t').map(h => h.trim())
  const rows = lines.slice(1).filter(l => l.trim() !== '').map(l => l.split('\t'))
  return { header, rows }
}

function col(header: readonly string[], name: string): number {
  const i = header.findIndex(h => h.toLowerCase() === name.toLowerCase())
  if (i < 0) throw new Error(`column '${name}' missing`)
  return i
}

function nameIndex(text: string, nameCol: string): Map<string, number> {
  const t = parseTable(text)
  const c = col(t.header, nameCol)
  const out = new Map<string, number>()
  t.rows.forEach((r, i) => {
    const n = (r[c] ?? '').trim().toLowerCase()
    if (n !== '' && !out.has(n)) out.set(n, i)
  })
  return out
}

export function extractSkillClientRows(src: {
  skills: string
  states: string
  overlay: string
  missiles: string
  isc: string
}): SkillClientRow113c[] {
  const overlays = nameIndex(src.overlay, 'overlay')
  const states = nameIndex(src.states, 'state')
  const missiles = nameIndex(src.missiles, 'Missile')
  const stats = nameIndex(src.isc, 'Stat')
  const sk = parseTable(src.skills)
  const c = (n: string): number => col(sk.header, n)
  const ix = {
    id: c('Id'), skill: c('skill'), st: c('cltstfunc'), dofn: c('cltdofunc'),
    p1: c('cltprgfunc1'), p2: c('cltprgfunc2'), p3: c('cltprgfunc3'),
    lob: c('lob'), prog: c('progressive'), stack: c('prgstack'), succ: c('stsuccessonly'),
    sdel: c('stsounddelay'), wsnd: c('weaponsnd'), aura: c('aurastate'), aurastat: c('aurastat1'),
    m: c('cltmissile'), ma: c('cltmissilea'), mb: c('cltmissileb'), mc: c('cltmissilec'), md: c('cltmissiled'),
    cast: c('castoverlay'), tgt: c('tgtoverlay'), prg: c('prgoverlay'), oa: c('cltoverlaya'), ob: c('cltoverlayb'),
    sts: c('stsound'), stc: c('stsoundclass'), dos: c('dosound'), dosa: c('dosound a'), dosb: c('dosound b'),
    tgs: c('tgtsound'), prs: c('prgsound'), ics: c('ItemCastSound'), ico: c('ItemCastOverlay'),
    ice: c('ItemCltEffect'), cc1: c('cltcalc1'), cc2: c('cltcalc2'), cc3: c('cltcalc3'),
    params: [1, 2, 3, 4, 5, 6, 7, 8].map(i => c(`Param${String(i)}`)),
  }
  const out: SkillClientRow113c[] = []
  for (const r of sk.rows) {
    const idText = (r[ix.id] ?? '').trim()
    if (idText === '') continue
    const where = `Skills.txt #${idText}`
    const cell = (i: number): string => (r[i] ?? '').trim()
    const num = (i: number): number => Number(cell(i) || 0)
    const flag = (i: number): boolean => cell(i) === '1'
    const ov = (i: number, what: string): string => {
      const v = cell(i)
      if (v !== '' && !overlays.has(v.toLowerCase())) throw new Error(`${where} ${what}: '${v}' is not an Overlay.txt row`)
      return v
    }
    const mis = (i: number, what: string): string => {
      const v = cell(i)
      if (v !== '' && !missiles.has(v.toLowerCase())) throw new Error(`${where} ${what}: '${v}' is not a Missiles.txt row`)
      return v
    }
    const snd = (i: number, what: string): number => {
      const v = cell(i)
      if (v === '') return 0
      const id = resolveSoundNameToId113c(v)
      if (id <= 0) throw new Error(`${where} ${what}: '${v}' is not a Sounds.txt row`)
      return id
    }
    const ref = (i: number, map: Map<string, number>, what: string): number => {
      const v = cell(i)
      if (v === '') return -1
      const id = map.get(v.toLowerCase())
      if (id === undefined) throw new Error(`${where} ${what}: '${v}' unresolved`)
      return id
    }
    const row: SkillClientRow113c = {
      id: Number(idText),
      skill: cell(ix.skill),
      cltStFunc: num(ix.st),
      cltDoFunc: num(ix.dofn),
      cltPrgFunc: [num(ix.p1), num(ix.p2), num(ix.p3)],
      lob: flag(ix.lob),
      progressive: flag(ix.prog),
      prgStack: flag(ix.stack),
      stSuccessOnly: flag(ix.succ),
      stSoundDelay: flag(ix.sdel),
      weaponSnd: flag(ix.wsnd),
      auraState: ref(ix.aura, states, 'aurastate'),
      auraStat1: ref(ix.aurastat, stats, 'aurastat1'),
      cltMissile: mis(ix.m, 'cltmissile'),
      cltMissileA: mis(ix.ma, 'cltmissilea'),
      cltMissileB: mis(ix.mb, 'cltmissileb'),
      cltMissileC: mis(ix.mc, 'cltmissilec'),
      cltMissileD: mis(ix.md, 'cltmissiled'),
      castOverlay: ov(ix.cast, 'castoverlay'),
      tgtOverlay: ov(ix.tgt, 'tgtoverlay'),
      prgOverlay: ov(ix.prg, 'prgoverlay'),
      cltOverlayA: ov(ix.oa, 'cltoverlaya'),
      cltOverlayB: ov(ix.ob, 'cltoverlayb'),
      stSound: snd(ix.sts, 'stsound'),
      stSoundClass: snd(ix.stc, 'stsoundclass'),
      doSound: snd(ix.dos, 'dosound'),
      doSoundA: snd(ix.dosa, 'dosound a'),
      doSoundB: snd(ix.dosb, 'dosound b'),
      tgtSound: snd(ix.tgs, 'tgtsound'),
      prgSound: snd(ix.prs, 'prgsound'),
      itemCastSound: snd(ix.ics, 'ItemCastSound'),
      itemCastOverlay: ov(ix.ico, 'ItemCastOverlay'),
      itemCltEffect: num(ix.ice),
      cltCalc: [cell(ix.cc1), cell(ix.cc2), cell(ix.cc3)],
      params: ix.params.map(i => num(i)),
    }
    const interesting =
      row.cltStFunc || row.cltDoFunc || row.cltPrgFunc.some(v => v !== 0) || row.progressive ||
      row.stSuccessOnly || row.stSoundDelay || row.weaponSnd || row.cltMissile || row.cltMissileA ||
      row.castOverlay || row.tgtOverlay || row.prgOverlay || row.cltOverlayA || row.stSound || row.stSoundClass ||
      row.doSound || row.doSoundA || row.tgtSound || row.prgSound || row.itemCastSound || row.itemCastOverlay ||
      row.itemCltEffect
    if (interesting) out.push(row)
  }
  return out
}

export function renderSkillClientModule(rows: readonly SkillClientRow113c[]): string {
  const body = rows.map(r => `  ${JSON.stringify(r)},`).join('\n')
  return `/**
 * AUTO-GENERATED by \`src/baker/packers/pack-skill-client-113c.ts\` — do not edit by hand.
 *
 * Diablo II 1.13c Skills.txt client columns (compiled D2SkillsTxt offsets in the packer header). Overlay names are
 * Overlay.txt rows, sounds are Sounds.txt ids, \`auraState\` / \`auraStat1\` are States.txt / ItemStatCost.txt ids.
 */

export interface SkillClientRow113c {
  readonly id: number
  readonly skill: string
  readonly cltStFunc: number
  readonly cltDoFunc: number
  readonly cltPrgFunc: readonly [number, number, number]
  readonly lob: boolean
  readonly progressive: boolean
  readonly prgStack: boolean
  readonly stSuccessOnly: boolean
  readonly stSoundDelay: boolean
  readonly weaponSnd: boolean
  readonly auraState: number
  readonly auraStat1: number
  readonly cltMissile: string
  readonly cltMissileA: string
  readonly cltMissileB: string
  readonly cltMissileC: string
  readonly cltMissileD: string
  readonly castOverlay: string
  readonly tgtOverlay: string
  readonly prgOverlay: string
  readonly cltOverlayA: string
  readonly cltOverlayB: string
  readonly stSound: number
  readonly stSoundClass: number
  readonly doSound: number
  readonly doSoundA: number
  readonly doSoundB: number
  readonly tgtSound: number
  readonly prgSound: number
  readonly itemCastSound: number
  readonly itemCastOverlay: string
  readonly itemCltEffect: number
  readonly cltCalc: readonly [string, string, string]
  readonly params: readonly number[]
}

export const SKILL_CLIENT_ROWS_113C: readonly SkillClientRow113c[] = Object.freeze([
${body}
])

const BY_ID: ReadonlyMap<number, SkillClientRow113c> = new Map(SKILL_CLIENT_ROWS_113C.map(r => [r.id, r]))

/** Skills.txt client columns of \`skillId\`, \`undefined\` when the row has none. */
export function getSkillClientRow113c(skillId: number): SkillClientRow113c | undefined {
  return BY_ID.get(skillId)
}
`
}

function main(): void {
  const mpqDir = process.argv[2] ?? DEFAULT_NODE_MPQ_DIR
  const src = new NodeMpqArchiveSource(mpqDir)
  const rows = extractSkillClientRows({
    skills: src.readText(SKILLS_TXT_PATH),
    states: src.readText(STATES_TXT_PATH),
    overlay: src.readText(OVERLAY_TXT_PATH),
    missiles: src.readText(MISSILES_TXT_PATH),
    isc: src.readText(ISC_TXT_PATH),
  })
  const here = dirname(fileURLToPath(import.meta.url))
  const outPath = join(here, '..', '..', 'common', 'skills', 'skill-client-113c.ts')
  writeFileSync(outPath, renderSkillClientModule(rows))
  console.log(`wrote ${String(rows.length)} skill client rows → ${outPath}`)
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
