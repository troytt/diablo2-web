const QUANTITY_STAT = 70

export interface TownPortalItem {
  readonly id: number
  readonly code: string
  readonly quantity?: number | undefined
  readonly stats?: readonly { readonly statId: number; readonly value: number }[] | undefined
}

export type TownPortalRefusal = 'no-scrolls' | 'in-town'

const codeOf = (item: TownPortalItem) => item.code.trim().toLowerCase()
const charges = (item: TownPortalItem) => item.quantity ?? item.stats?.find((s) => s.statId === QUANTITY_STAT)?.value ?? 0

export const townPortalSource = (items: Iterable<TownPortalItem>): TownPortalItem | null => scrollSource(items, 'tbk', 'tsc')

export const scrollsCarried = (items: Iterable<TownPortalItem>, tomeCode: string, scrollCode: string): { readonly tome: boolean; readonly scrolls: number } => {
  const carried = [...items]
  const tomes = carried.filter((item) => codeOf(item) === tomeCode)
  return { tome: tomes.length > 0, scrolls: tomes.reduce((sum, tome) => sum + charges(tome), 0) + carried.filter((item) => codeOf(item) === scrollCode).length }
}

export const scrollSource = (items: Iterable<TownPortalItem>, tomeCode: string, scrollCode: string): TownPortalItem | null => {
  const carried = [...items]
  return carried.find((item) => codeOf(item) === tomeCode && charges(item) > 0) ?? carried.find((item) => codeOf(item) === scrollCode) ?? null
}

export const townPortalRefusalText = (refusal: TownPortalRefusal, lang: 'ENG' | 'CHI'): string =>
  refusal === 'in-town' ? (lang === 'ENG' ? "You're already in town" : '你已经在城里了') : lang === 'ENG' ? 'No Town Portal scrolls' : '没有城镇传送卷轴'
