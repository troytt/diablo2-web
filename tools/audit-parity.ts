/**
 * Diablo II 1.13c Drop Parity Statistical Audit CLI (Issue #126).
 *
 * Usage:
 *   npx tsx scripts/audit-parity.ts [kills=1000] [boss=mephisto] [difficulty=hell]
 *   or:
 *   npx tsx scripts/audit-parity.ts --kills=1000 --boss=mephisto --difficulty=hell --mf=250 --players=1
 */

import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import { executeDropPipeline } from '../src/common/items/drop-tables.ts'
import type { UpgradableItemBase } from '../src/common/items/item-upgrade.ts'
import type { Item } from '../src/common/items/items.ts'

export type Difficulty = 'normal' | 'nightmare' | 'hell'

export interface BossPreset {
  readonly id: string
  readonly act: 1 | 2 | 3 | 4 | 5
  readonly nameCn: string
  readonly nameEn: string
  readonly mlvl: { normal: number; nightmare: number; hell: number }
  readonly tc: { normal: string; nightmare: string; hell: string }
  readonly questTc: { normal: string; nightmare: string; hell: string }
  readonly baseNoDrop: number
  readonly picks: number
  readonly monsterType?: number
}

export type BossDefinition = BossPreset

export const ACT_BOSSES: readonly BossPreset[] = [
  {
    id: 'andariel',
    act: 1,
    nameCn: '安达利尔 (Andariel)',
    nameEn: 'Maiden of Anguish',
    mlvl: { normal: 12, nightmare: 49, hell: 75 },
    tc: { normal: 'Andariel', nightmare: 'Andariel (N)', hell: 'Andariel (H)' },
    questTc: { normal: 'Andarielq', nightmare: 'Andarielq (N)', hell: 'Andarielq (H)' },
    baseNoDrop: 19,
    picks: 7,
    monsterType: 4,
  },
  {
    id: 'duriel',
    act: 2,
    nameCn: '督瑞尔 (Duriel)',
    nameEn: 'Lord of Pain',
    mlvl: { normal: 22, nightmare: 55, hell: 88 },
    tc: { normal: 'Duriel', nightmare: 'Duriel (N)', hell: 'Duriel (H)' },
    questTc: { normal: 'Durielq', nightmare: 'Durielq (N)', hell: 'Durielq (H)' },
    baseNoDrop: 19,
    picks: 7,
    monsterType: 4,
  },
  {
    id: 'mephisto',
    act: 3,
    nameCn: '墨菲斯托 (Mephisto)',
    nameEn: 'Lord of Hatred',
    mlvl: { normal: 26, nightmare: 59, hell: 87 },
    tc: { normal: 'Mephisto', nightmare: 'Mephisto (N)', hell: 'Mephisto (H)' },
    questTc: { normal: 'Mephistoq', nightmare: 'Mephistoq (N)', hell: 'Mephistoq (H)' },
    baseNoDrop: 15,
    picks: 7,
    monsterType: 4,
  },
  {
    id: 'diablo',
    act: 4,
    nameCn: '暗黑破坏神 (Diablo)',
    nameEn: 'Lord of Terror',
    mlvl: { normal: 40, nightmare: 62, hell: 94 },
    tc: { normal: 'Diablo', nightmare: 'Diablo (N)', hell: 'Diablo (H)' },
    questTc: { normal: 'Diabloq', nightmare: 'Diabloq (N)', hell: 'Diabloq (H)' },
    baseNoDrop: 15,
    picks: 7,
    monsterType: 4,
  },
  {
    id: 'baal',
    act: 5,
    nameCn: '巴尔 (Baal)',
    nameEn: 'Lord of Destruction',
    mlvl: { normal: 60, nightmare: 75, hell: 99 },
    tc: { normal: 'Baal', nightmare: 'Baal (N)', hell: 'Baal (H)' },
    questTc: { normal: 'Baalq', nightmare: 'Baalq (N)', hell: 'Baalq (H)' },
    baseNoDrop: 15,
    picks: 7,
    monsterType: 4,
  },
]

export const BOSS_LIST: readonly BossDefinition[] = ACT_BOSSES

export interface ParityAuditSummary {
  readonly config: {
    readonly boss: string
    readonly difficulty: Difficulty
    readonly kills: number
    readonly monsterType: number
    readonly mlvl: number
    readonly tcName: string
    readonly playerMf: number
    readonly gamePlayers: number
    readonly isQuestKill: boolean
  }
  readonly totalItems: number
  readonly qualityDistribution: {
    readonly counts: Record<string, number>
    readonly ratios: Record<string, number>
  }
  readonly baseTierUpgrade: {
    readonly totalEquipment: number
    readonly normalCount: number
    readonly exceptionalCount: number
    readonly eliteCount: number
    readonly exceptionalRatio: number
    readonly eliteRatio: number
    readonly upgradedRatio: number
  }
  readonly affixCountDistribution: {
    readonly magic: Record<string, number>
    readonly rare: Record<string, number>
  }
}

function classifyBaseTier(item: Item): 'normal' | 'exceptional' | 'elite' | null {
  if (item.base.kind !== 'weapon' && item.base.kind !== 'armor') {
    return null
  }
  const b = item.base as UpgradableItemBase
  const id = (b.id ?? '').trim().toLowerCase()
  const uber = (b.ubercode ?? '').trim().toLowerCase()
  const ultra = (b.ultracode ?? '').trim().toLowerCase()

  if (ultra && ultra !== 'xxx' && id === ultra) {
    return 'elite'
  }
  if (uber && uber !== 'xxx' && id === uber) {
    return 'exceptional'
  }
  return 'normal'
}

export function runParityAudit(options?: {
  kills?: number
  bossId?: string
  difficulty?: Difficulty
  playerMf?: number
  gamePlayers?: number
  isQuestKill?: boolean
  baseSeed?: number
}): ParityAuditSummary {
  const kills = options?.kills ?? 1000
  const bossId = (options?.bossId ?? 'mephisto').toLowerCase()
  const difficulty: Difficulty = options?.difficulty ?? 'hell'
  const playerMf = options?.playerMf ?? 250
  const gamePlayers = options?.gamePlayers ?? 1
  const isQuestKill = options?.isQuestKill ?? true
  const baseSeed = options?.baseSeed ?? 0x12600001

  const boss = BOSS_LIST.find(b => b.id === bossId) ?? BOSS_LIST[2]!
  const monsterType = boss.monsterType ?? 4
  const mlvl = boss.mlvl[difficulty]
  const tcName = isQuestKill ? boss.questTc[difficulty] : boss.tc[difficulty]

  const dropTables = getEmbeddedDropTables()

  let totalItems = 0
  const qualityCounts: Record<string, number> = {
    unique: 0,
    set: 0,
    rare: 0,
    magic: 0,
    superior: 0,
    normal: 0,
    low: 0,
  }

  let totalEquipment = 0
  let normalCount = 0
  let exceptionalCount = 0
  let eliteCount = 0

  const magicAffixDist: Record<string, number> = { '1': 0, '2': 0 }
  const rareAffixDist: Record<string, number> = { '3': 0, '4': 0, '5': 0, '6': 0 }

  for (let i = 0; i < kills; i++) {
    const seed = (baseSeed + i * 104729) >>> 0
    const drops = executeDropPipeline({
      tcName,
      nLevel: mlvl,
      monsterType,
      dropTables,
      difficulty,
      playerMf,
      gamePlayers,
      partyPlayers: 1,
      monsterRng: seed,
    })

    for (const item of drops) {
      totalItems++
      const rarity = (item.rarity || 'normal').toLowerCase()
      qualityCounts[rarity] = (qualityCounts[rarity] ?? 0) + 1

      const tier = classifyBaseTier(item)
      if (tier !== null) {
        totalEquipment++
        if (tier === 'elite') eliteCount++
        else if (tier === 'exceptional') exceptionalCount++
        else normalCount++
      }

      if (rarity === 'magic') {
        const count = (item.prefix ? 1 : 0) + (item.suffix ? 1 : 0)
        const key = String(Math.max(1, count))
        magicAffixDist[key] = (magicAffixDist[key] ?? 0) + 1
      } else if (rarity === 'rare') {
        const rareAffixes = (item as any).rolledRareAffixes?.affixes
        const count = Array.isArray(rareAffixes) ? rareAffixes.length : 0
        if (count > 0) {
          const key = String(count)
          rareAffixDist[key] = (rareAffixDist[key] ?? 0) + 1
        }
      }
    }
  }

  const qualityRatios: Record<string, number> = {}
  for (const [k, v] of Object.entries(qualityCounts)) {
    qualityRatios[k] = totalItems > 0 ? Number((v / totalItems).toFixed(4)) : 0
  }

  const exceptionalRatio = totalEquipment > 0 ? Number((exceptionalCount / totalEquipment).toFixed(4)) : 0
  const eliteRatio = totalEquipment > 0 ? Number((eliteCount / totalEquipment).toFixed(4)) : 0
  const upgradedRatio =
    totalEquipment > 0 ? Number(((exceptionalCount + eliteCount) / totalEquipment).toFixed(4)) : 0

  return {
    config: {
      boss: boss.id,
      difficulty,
      kills,
      monsterType,
      mlvl,
      tcName,
      playerMf,
      gamePlayers,
      isQuestKill,
    },
    totalItems,
    qualityDistribution: {
      counts: qualityCounts,
      ratios: qualityRatios,
    },
    baseTierUpgrade: {
      totalEquipment,
      normalCount,
      exceptionalCount,
      eliteCount,
      exceptionalRatio,
      eliteRatio,
      upgradedRatio,
    },
    affixCountDistribution: {
      magic: magicAffixDist,
      rare: rareAffixDist,
    },
  }
}

// CLI entry point
const isMain =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  process.argv[1].includes('audit-parity')

if (isMain) {
  const args = process.argv.slice(2)
  let kills = 1000
  let bossId = 'mephisto'
  let difficulty: Difficulty = 'hell'
  let playerMf = 250
  let gamePlayers = 1

  const positional: string[] = []
  for (const arg of args) {
    if (arg.startsWith('--kills=')) kills = Number(arg.slice('--kills='.length)) || 1000
    else if (arg.startsWith('--boss=')) bossId = arg.slice('--boss='.length)
    else if (arg.startsWith('--difficulty=')) difficulty = arg.slice('--difficulty='.length) as Difficulty
    else if (arg.startsWith('--mf=')) playerMf = Number(arg.slice('--mf='.length)) || 250
    else if (arg.startsWith('--players=')) gamePlayers = Number(arg.slice('--players='.length)) || 1
    else if (!arg.startsWith('-')) positional.push(arg)
  }

  if (positional[0]) kills = Number(positional[0]) || kills
  if (positional[1]) bossId = positional[1]
  if (positional[2]) difficulty = positional[2] as Difficulty

  const summary = runParityAudit({ kills, bossId, difficulty, playerMf, gamePlayers })
  console.log(JSON.stringify(summary, null, 2))
}
