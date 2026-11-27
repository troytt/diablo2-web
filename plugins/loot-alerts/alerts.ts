import type { PluginToast } from '../../src/client/plugin-host/api.ts'
import { GEM_INFO } from '../../src/common/items/gems-data.ts'
import { onlineItemDataToUiInventoryItem } from '../../src/common/items/item-bridge.ts'
import { appraiseItem, TIER_RANK, type Appraisal, type AppraisalContext } from '../../src/common/items/loot-appraisal.ts'
import { levelDisplayName } from '../../src/common/world/level-names-zh.ts'
import type { ItemData } from '../../src/netproto/index.ts'
import STYLES from './alert-styles.json'

export type AlertLevel = 'smart' | 'notable' | 'valuable' | 'runes'

const NEW_DROP = 0x00
const PERFECT = 5
const STYLE = STYLES as Readonly<Partial<Record<Appraisal['kind'], { readonly label: string; readonly color: PluginToast['color'] }>>>

const isPerfectGem = (item: Pick<ItemData, 'code'>) => (GEM_INFO[item.code.trim().toLowerCase()]?.tier ?? 0) >= PERFECT

const WANTED: Record<Exclude<AlertLevel, 'smart'>, (appraisal: Appraisal, item: ItemData) => boolean> = {
  notable: ({ kind }) => kind === 'unique' || kind === 'set' || kind === 'rune',
  valuable: ({ kind }, item) => ['unique', 'set', 'rune', 'rare', 'charm', 'jewel'].includes(kind) || (kind === 'gem' && isPerfectGem(item)),
  runes: ({ kind }) => kind === 'rune',
}

const wants = (level: AlertLevel, appraisal: Appraisal, item: ItemData): boolean =>
  level === 'smart' ? TIER_RANK[appraisal.tier] >= TIER_RANK.good && appraisal.kind !== 'consumable' && appraisal.kind !== 'gold' : WANTED[level](appraisal, item)

const nameOf = (item: ItemData): string => onlineItemDataToUiInventoryItem(item).name || item.code

export function lootAlert(action: number, item: ItemData, level: AlertLevel, areaId: number, context: AppraisalContext): PluginToast | null {
  if (action !== NEW_DROP) return null
  const appraisal = appraiseItem(item, context)
  const style = STYLE[appraisal.kind]
  if (style === undefined || !wants(level, appraisal, item)) return null
  const area = areaId > 0 ? levelDisplayName(areaId, 'en') : ''
  const what = level === 'smart' ? appraisal.reason : style.label
  return { title: nameOf(item), detail: [what, area].filter(Boolean).join(' · '), color: style.color }
}
