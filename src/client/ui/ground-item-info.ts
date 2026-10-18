import type { ItemData } from '../../netproto/index.ts'

export type LootFilter = 'off' | 'junk' | 'strict'

export interface ItemInfoConfig {
  readonly itemLevel: boolean
  readonly labelDetails: boolean
  readonly alwaysShow: boolean
  readonly lootFilter: LootFilter
}

const [LOW, NORMAL, SUPERIOR, MAGIC] = [1, 2, 3, 4]
const JUNK_CODES = new Set(['aqv', 'cqv', 'tsc', 'isc', 'hp1', 'hp2', 'hp3', 'mp1', 'mp2', 'mp3'])
const LESSER_GEMS = ['v', 'y', 'b', 'g', 'r', 'w'].flatMap((gem) => ['c', 'f', 's', 'l'].map((grade) => `g${grade}${gem}`))
const STRICT_CODES = new Set([...JUNK_CODES, ...LESSER_GEMS, 'gzv', 'skc', 'skf', 'sku', 'skl', 'hp4', 'hp5', 'mp4', 'mp5', 'yps', 'vps', 'wms', 'gpl', 'opl', 'gps', 'ops', 'gpm', 'opm'])
const QUEST_CODES = new Set(['leg', 'hdm', 'msf', 'vip', 'hst', 'g33', 'd33', 'qf1', 'qf2', 'hfh', 'bks', 'bkd', 'ass', 'tr1', 'tr2', 'box', 'j34', 'g34', 'xyz', 'bbb', 'qey', 'qhr', 'qbr', 'mss', 'ice'])

export const isLootHidden = (data: ItemData, isGear: boolean, filter: LootFilter): boolean => {
  const code = data.code.trim().toLowerCase()
  if (filter === 'off' || QUEST_CODES.has(code)) return false
  const quality = data.quality ?? NORMAL
  const plainGear = isGear && !data.ethereal && data.totalSockets === 0 && (quality === NORMAL || quality === SUPERIOR)
  const junk = JUNK_CODES.has(code) || (isGear && quality === LOW) || plainGear
  return junk || (filter === 'strict' && (STRICT_CODES.has(code) || (isGear && quality === MAGIC)))
}

export const groundLabelDetails = (data: ItemData, isEn: boolean): string =>
  data.simple || data.ilvl === undefined
    ? ''
    : ` [${[
        data.totalSockets > 0 ? `${data.totalSockets}${isEn ? 'os' : '孔'}` : null,
        data.ethereal ? (isEn ? 'eth' : '无形') : null,
        `${isEn ? 'ilvl' : '等级'} ${data.ilvl}`,
      ]
        .filter((part) => part !== null)
        .join(' · ')}]`
