/**
 * Issue #925: Sorceress orb showed "+1 召唤技能 (限死灵法师使用)" (Summoning Skills, Necromancer Only).
 *
 * 1.13c ground truth (samples/d2, `objdump -d -M intel`; kb/items/item-addskill-tab-encoding-113c.md):
 *  - MagicPrefix.txt `skilltab` par is linear `class * 3 + tab` (Burning/Blazing/Volcanic = 3, Sorceress orbs).
 *  - D2Common property func 10 @ 0x6fd98470: `idiv 3; lea eax,[edx+eax*8]` -> stat 188 param = par % 3 + 8 * (par / 3).
 *  - D2Client descfunc 14 @ 0x6fb052e2: class = param >> 3, tab = param & 7 (tab >= 3 -> no line),
 *    string = CharStats[class].StrSkillTab{tab+1}.
 *  - ItemStatCost.txt item_addskill_tab: Save Param Bits 16, Save Bits 3, descfunc 14.
 * A real D2GS therefore sends Burning (+Fire Skills, Sorceress) as param 8; the port's old `param > 20 ? decode : raw`
 * heuristic used 8 as the linear key = "Summoning Skills (Necromancer Only)".
 */
import * as fs from 'fs'
import { describe, expect, it } from 'vitest'
import { getCanonicalItemDataTables } from '../src/client/world/item-tables-provider.ts'
import { resolvePreaggregatedSkillBonus } from '../src/client/ui-model/hud-model.ts'
import { RAW_MAGIC_PREFIX } from '../src/common/data/canonical-drop-data.ts'
import { RAW_ITEM_STAT_COST, RAW_PROPERTIES } from '../src/common/data/canonical-vendor-data.ts'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import { onlineItemDataToUiInventoryItem, rolledPropsToItemStats } from '../src/common/items/item-bridge.ts'
import { CANONICAL_ENG_TBL_DICT } from '../src/common/items/item-tooltip.ts'
import { parseItemStatCostTable, parsePropertiesTable, resolveProperty } from '../src/common/items/properties.ts'
import {
  CANONICAL_SKILL_TABS,
  decodeSkillTabParam,
  encodeSkillTabParam,
  skillTabStatParam,
} from '../src/common/skills/skills-data.ts'
import { CANONICAL_SKILL_TABS_ZH } from '../src/common/i18n/tooltip-i18n.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { cell, loadActTables, parseTable } from '../src/common/world/acts.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { decodeD2gsItemPacket, encodeD2gsItemPacket } from '../src/netproto/d2gs/items/item-bitstream.ts'
import { ITEM_FLAG_IDENTIFIED } from '../src/netproto/d2gs/items/item-types.ts'
import type { ItemData } from '../src/netproto/domain/ids.ts'

const hasRealData = fs.existsSync('samples/d2/d2data.mpq') && fs.existsSync('samples/d2/Patch_D2.mpq')

const iscTable = parseItemStatCostTable(parseTable(new TextEncoder().encode(RAW_ITEM_STAT_COST)))
const propsTable = parsePropertiesTable(parseTable(new TextEncoder().encode(RAW_PROPERTIES)))

function magicPrefixSkilltabRows(): { name: string; par: number; itypes: string[] }[] {
  const lines = RAW_MAGIC_PREFIX.split(/\r?\n/)
  const h = lines[0]!.split('\t')
  const ix = (c: string): number => h.indexOf(c)
  const out: { name: string; par: number; itypes: string[] }[] = []
  for (const l of lines.slice(1)) {
    const r = l.split('\t')
    if (r[ix('mod1code')] !== 'skilltab') continue
    out.push({ name: r[ix('Name')]!, par: Number(r[ix('mod1param')]), itypes: [r[ix('itype1')]!, r[ix('itype2')]!] })
  }
  return out
}

function sorcOrbWithStat188(param: number): ItemData {
  const flags = ITEM_FLAG_IDENTIFIED
  return {
    id: 925, itemId: 925, opcode: 0x9c, action: 0, category: 0, flags, rawFlags: flags, version: 101,
    location: 0, container: 'inventory', bodyLoc: 0, equippedSlot: 0, gridX: 0, gridY: 0, storePage: 0,
    storagePage: 0, worldX: 0, worldY: 0, x: 0, y: 0, code: 'ob5', rawCode: 'ob5 ', compact: false, simple: false,
    identified: true, socketed: false, ethereal: false, runeword: false, personalized: false, isEar: false,
    newItem: false, starterItem: false, broken: false, inSocket: false, equipped: false, socketedChildCount: 0,
    usedSockets: 0, totalSockets: 0, ilvl: 60, quality: 2, invWidth: 1, invHeight: 2,
    durability: 40, maxDurability: 40,
    stats: [{ statId: 188, param, value: 1 }], setBonusStats: [], runewordStats: [],
  } as unknown as ItemData
}

describe('Issue #925: item_addskill_tab (stat 188) param encoding', () => {
  it('ItemStatCost.txt item_addskill_tab: id 188, Save Param Bits 16, Save Bits 3, descfunc 14', () => {
    const rec = iscTable.getByStat('item_addskill_tab')!
    expect(rec.id).toBe(188)
    expect(rec.saveParamBits).toBe(16)
    expect(rec.saveBits).toBe(3)
    expect(rec.sendParamBits).toBe(6)
  })

  it('MagicPrefix.txt skilltab par is linear class*3+tab (Sorceress orb prefixes Burning/Sparking/Chilling = 3/4/5)', () => {
    const rows = magicPrefixSkilltabRows()
    const orb = rows.filter((r) => r.itypes.includes('orb'))
    expect(orb.map((r) => [r.name, r.par])).toEqual([
      ['Burning', 3], ['Blazing', 3], ['Volcanic', 3],
      ['Sparking', 4], ['Charged', 4], ['Powered', 4],
      ['Chilling', 5], ['Freezing', 5], ['Glacial', 5],
    ])
    for (const r of rows) expect(r.par).toBeGreaterThanOrEqual(0)
    for (const r of rows) expect(r.par).toBeLessThanOrEqual(20)
  })

  it('property func 10 (D2Common 0x6fd98470) stores par % 3 + 8 * (par / 3); decode inverts it', () => {
    for (let par = 0; par <= 20; par++) {
      const expected = (par % 3) + 8 * Math.floor(par / 3)
      expect(encodeSkillTabParam(par)).toBe(expected)
      expect(decodeSkillTabParam(expected)).toBe(par)
      const resolved = resolveProperty('skilltab', par, 1, 1, { properties: propsTable, stats: iscTable })
      expect(resolved).toHaveLength(1)
      expect(resolved[0]!.statId).toBe(188)
      expect(resolved[0]!.param).toBe(expected)
    }
    // D2Client descfunc 14 rejects tab >= 3 (cmp ebp,3; jge) and classes without a CharStats row.
    expect(decodeSkillTabParam(3)).toBeUndefined()
    expect(decodeSkillTabParam(7 * 8)).toBeUndefined()
    expect(() => encodeSkillTabParam(21)).toThrow(RangeError)
  })

  it('screenshot repro: Sorceress orb "Burning" (par 3) arrives as stat 188 param 8 and shows Fire Skills (Sorceress Only)', () => {
    const tables = getCanonicalItemDataTables()
    const wireParam = encodeSkillTabParam(3)
    expect(wireParam).toBe(8)
    const pkt = encodeD2gsItemPacket(sorcOrbWithStat188(wireParam), tables, { saveFormat: false })
    const decoded = decodeD2gsItemPacket(pkt, tables, { saveFormat: false })
    expect(decoded.stats).toEqual([{ statId: 188, param: 8, value: 1 }])

    const ui = onlineItemDataToUiInventoryItem(decoded, undefined, getEmbeddedDropTables(), 1)
    const zh = ui.stats.map((s) => s.text)
    const en = (ui.statsEn ?? []).map((s) => s.text)
    expect(zh).toContain('+1 火焰技能 (限法师使用)')
    expect(en).toContain('+1 to Fire Skills (Sorceress Only)')
    expect(zh.join('|')).not.toContain('死灵法师')
    expect(en.join('|')).not.toContain('Necromancer')
  })

  it('every packed param 0..20 class/tab decodes to the matching EN/ZH line (no 8..10 / 16..18 collisions)', () => {
    const tables = getEmbeddedDropTables()
    for (let par = 0; par <= 20; par++) {
      const ui = onlineItemDataToUiInventoryItem(sorcOrbWithStat188(encodeSkillTabParam(par)), undefined, tables, 1)
      expect(ui.stats.map((s) => s.text)).toContain(`+1 ${CANONICAL_SKILL_TABS_ZH[par]}`)
      expect((ui.statsEn ?? []).map((s) => s.text)).toContain(`+1 to ${CANONICAL_SKILL_TABS[par]}`)
    }
  })

  it('rolledPropsToItemStats (Charsi imbue) encodes the skilltab prop into the wire form', () => {
    expect(rolledPropsToItemStats([{ code: 'skilltab', param: 5, min: 2, max: 2, value: 2 }])).toEqual([
      { statId: 188, param: 10, value: 2 },
    ])
  })

  it('+skill-tab bonus lands only on the decoded class/tab (Sorceress Fire param 8 does not boost Necro Summoning)', () => {
    const agg = {
      allSkills: 0,
      classSkills: new Map<number, number>(),
      tabSkills: new Map<number, number>([[8, 1]]),
      singleSkills: new Map<number, number>(),
      elemSkills: new Map<string, number>(),
      oskills: new Map<number, number>(),
    }
    expect(skillTabStatParam(1, 0)).toBe(8)
    expect(resolvePreaggregatedSkillBonus(36, 'sor', agg as never)).toBe(1) // Fire Bolt (Sorceress page 1)
    expect(resolvePreaggregatedSkillBonus(70, 'nec', agg as never)).toBe(0) // Raise Skeleton (Necro page 3, linear 8)
  })

  describe.runIf(hasRealData)('MPQ CharStats.txt StrSkillTab1..3 ordering', () => {
    it('CANONICAL_SKILL_TABS[class*3+tab] == CharStats[class].StrSkillTab{tab+1} text', async () => {
      const archives = new MountedArchives()
      for (const m of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(m, await MpqArchive.open(await fileSource(`samples/d2/${m}`)))
      }
      const charstats = (await loadActTables(archives)).charstats!
      const classRows = charstats.rows.filter((r) => cell(charstats, r, 'StrSkillTab1') !== '')
      expect(classRows).toHaveLength(7)
      classRows.forEach((r, classId) => {
        for (let tab = 0; tab < 3; tab++) {
          const key = cell(charstats, r, `StrSkillTab${tab + 1}`)
          const tbl = CANONICAL_ENG_TBL_DICT[key]
          expect(tbl, key).toBeDefined()
          const label = CANONICAL_SKILL_TABS[classId * 3 + tab]!.replace(/ \([^)]*\)$/, '')
          expect(tbl).toBe(`+%d to ${label}`)
        }
      })
    })
  })
})
