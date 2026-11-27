import { ACT_TOWNS, actOfLevel } from './route.ts'
import { WAYPOINT_LEVELS } from './level-links.ts'

const STORAGE_KEY = 'd2web.guide.waypoints.v1'
const TOWN_WAYPOINTS = [...WAYPOINT_LEVELS].filter(([, level]) => (ACT_TOWNS as readonly number[]).includes(level)).map(([id]) => id)

type Saved = Record<string, readonly number[]>

export class WaypointMemory {
  private saved: Saved

  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage) {
    this.saved = this.load()
  }

  known(character: string, level: number, fromMenu: ReadonlySet<number>): ReadonlySet<number> {
    if (fromMenu.size > 0 && !this.matches(character, fromMenu)) this.save(character, [...fromMenu])
    const reachedTowns = TOWN_WAYPOINTS.filter((_, act) => act <= actOfLevel(level))
    return new Set([...(this.saved[character] ?? []), ...fromMenu, ...reachedTowns])
  }

  hasMenu(character: string): boolean {
    return character in this.saved
  }

  private matches(character: string, menu: ReadonlySet<number>): boolean {
    const saved = this.saved[character] ?? []
    return saved.length === menu.size && saved.every((id) => menu.has(id))
  }

  private save(character: string, ids: readonly number[]): void {
    this.saved = { ...this.saved, [character]: ids }
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.saved))
    } catch {
      return
    }
  }

  private load(): Saved {
    try {
      const parsed: unknown = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? '{}')
      return parsed && typeof parsed === 'object' ? (parsed as Saved) : {}
    } catch {
      return {}
    }
  }
}
