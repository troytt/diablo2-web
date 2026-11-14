/**
 * src/common/items/dgrp-line.ts
 *
 * ItemStatCost `dgrp` group lines (D2Client.dll 0x6FB04AC0 decides the fold, 0x6FB04E10 formats it with the
 * group's dgrpfunc / dgrpval / dgrpstrpos / dgrpstrneg):
 *   dgrp 1 (strength/energy/dexterity/vitality): dgrpfunc 1, dgrpval 1 → "+N" / "-N" + " " + Moditem2allattrib
 *   dgrp 2 (fire/light/cold/poison resist):       dgrpfunc 19 → Unicode::sprintf(strModAllResistances, N)
 *     (0x6FB0554F: the tbl format "All Resistances +%d" is used verbatim, so a negative value prints "+-N").
 */
import { CANONICAL_CHI_TBL_DICT, CANONICAL_ENG_TBL_DICT } from '../data/canonical-tbl-strings.ts'

function tbl(key: string, locale: 'en' | 'zh'): string {
  const dict = locale === 'en' ? CANONICAL_ENG_TBL_DICT : CANONICAL_CHI_TBL_DICT
  const v = dict[key] ?? CANONICAL_ENG_TBL_DICT[key]
  if (v === undefined) throw new Error(`dgrp-line: tbl key '${key}' missing`)
  return v.replace(/\n$/, '')
}

export function formatDgrpLine(code: 'all-stats' | 'res-all', value: number, locale: 'en' | 'zh'): string {
  if (code === 'all-stats') {
    // descfunc 1: '+' only for positive values, descval 1 = value first, then ' ' + string.
    return `${value > 0 ? '+' : ''}${value} ${tbl('Moditem2allattrib', locale)}`
  }
  return tbl('strModAllResistances', locale).replace('%d', String(value))
}
