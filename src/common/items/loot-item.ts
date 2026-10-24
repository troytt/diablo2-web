export interface LootStat {
  readonly statId: number
  readonly param: number
  readonly value: number
}

export interface LootItem {
  readonly id: number
  readonly code: string
  readonly quality?: number | undefined
  readonly identified: boolean
  readonly runeword: boolean
  readonly stats: readonly LootStat[]
  readonly runewordStats: readonly LootStat[]
  readonly socketedItems?: readonly LootItem[] | undefined
  readonly uniqueItemId?: number | undefined
  readonly setItemId?: number | undefined
  readonly totalSockets: number
  readonly usedSockets: number
  readonly bodyLoc: number
  readonly equippedSlot: number
  readonly defense?: number | undefined
  readonly invWidth: number
  readonly invHeight: number
}
