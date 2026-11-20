/**
 * The two ways to travel without walking: waypoints and the town portal.
 *
 * Both are pure state machines over level ids and sub-tile positions. Nothing
 * here touches the DOM, the renderer or the clock — the scene asks what is
 * possible and where it leads, and does the moving itself. That keeps the rules
 * testable without a browser, and keeps them out of the render loop.
 *
 * ## Waypoints
 *
 * A waypoint is not a link between two places. It is a member of a network:
 * step on one and you may afterwards travel to any other you have already
 * stepped on. `Levels.txt` `Waypoint` gives each one a number, 0 to 38, and the
 * number — not the level — is the identity, which is why the network is keyed
 * on it.
 *
 * Activation is per character, and there is no un-activating: in the original
 * game the blue ring stays lit for the rest of the game once touched.
 *
 * ## Town portals
 *
 * At most one open at a time. Casting a second closes the first, which is the
 * original behaviour and also the only rule that makes the return trip
 * unambiguous. A portal has two mouths — one where it was cast and one in the
 * act's town — and stepping into either sends you to the other.
 *
 * Browser safety: no `node:` builtins, no `Math.random`, no wall-clock.
 */

/** Where a traveller comes out. */
export interface TravelTarget {
  /** `Levels.txt` `Id` of the destination. */
  readonly levelId: number
  /** Where to stand on arrival, in sub-tiles. */
  readonly x: number
  readonly y: number
}

/** One waypoint the network knows about. */
export interface WaypointSite {
  /** `Levels.txt` `Waypoint`, 0..38. */
  readonly waypointId: number
  /** The level hosting it. */
  readonly levelId: number
  /** The act it belongs to, 1..5, for grouping in the UI. */
  readonly act: number
  /** Its display name. */
  readonly name: string
  /** Where the pedestal stands, in sub-tiles. */
  readonly x: number
  readonly y: number
}

/**
 * The set of waypoints this character has touched.
 *
 * The catalogue of every waypoint in the world is separate from the set that
 * has been activated: the first is a property of the world and is the same for
 * everyone, the second is save data.
 */
export class WaypointNetwork {
  private readonly sites = new Map<number, WaypointSite>()
  private readonly activated = new Set<number>()

  /**
   * Tell the network a waypoint exists.
   *
   * Idempotent, and later registrations win, so re-registering after a level
   * variant swap corrects the position rather than duplicating the entry.
   *
   * @param site - the waypoint.
   */
  register(site: WaypointSite): void {
    this.sites.set(site.waypointId, site)
  }

  /**
   * Light a waypoint up.
   *
   * @param waypointId - the waypoint touched.
   * @returns true when this was the first time.
   */
  activate(waypointId: number): boolean {
    if (this.activated.has(waypointId)) return false
    this.activated.add(waypointId)
    return true
  }

  /**
   * Whether a waypoint has been touched.
   *
   * @param waypointId - the waypoint.
   * @returns true when it is lit.
   */
  isActive(waypointId: number): boolean {
    return this.activated.has(waypointId)
  }

  /**
   * Every destination currently reachable, in act then waypoint order.
   *
   * @returns the lit waypoints whose positions are known.
   */
  destinations(): WaypointSite[] {
    const out: WaypointSite[] = []
    for (const id of this.activated) {
      const site = this.sites.get(id)
      if (site !== undefined) out.push(site)
    }
    out.sort((a, b) => a.act - b.act || a.waypointId - b.waypointId)
    return out
  }

  /**
   * Where a waypoint leads.
   *
   * @param waypointId - the wanted waypoint.
   * @returns the target, or null when it is unknown or not yet lit.
   */
  travelTo(waypointId: number): TravelTarget | null {
    if (!this.activated.has(waypointId)) return null
    const site = this.sites.get(waypointId)
    if (site === undefined) return null
    return { levelId: site.levelId, x: site.x, y: site.y }
  }

  /**
   * The lit waypoint ids, for saving.
   *
   * @returns the ids, ascending.
   */
  save(): number[] {
    return [...this.activated].sort((a, b) => a - b)
  }

  /**
   * Restore the lit set from a save.
   *
   * @param ids - the ids to light.
   */
  load(ids: readonly number[]): void {
    this.activated.clear()
    for (const id of ids) this.activated.add(id)
  }
}

/** An open town portal, with a mouth at each end. */
export interface OpenPortal {
  /** The level it was cast in. */
  readonly fromLevelId: number
  /** The mouth in that level, in sub-tiles. */
  readonly fromX: number
  readonly fromY: number
  /** The act's town. */
  readonly townLevelId: number
  /** The mouth in town, in sub-tiles. */
  readonly townX: number
  readonly townY: number
  /** Optional creation timestamp (ms) for the 15-frame opening animation (OP -> ON). */
  readonly createdAtMs?: number
}

/** Description of the portal mouth visible in a given level. */
export interface PortalMouthInLevel {
  /** Sub-tile X of the portal mouth in this level. */
  readonly x: number
  /** Sub-tile Y of the portal mouth in this level. */
  readonly y: number
  /** Destination `Levels.txt` ID when stepping into this mouth. */
  readonly toLevelId: number
  /** True when this mouth is the one inside town (clicking it closes the portal). */
  readonly isTownMouth: boolean
  /** Optional creation timestamp (ms) for opening animation playback. */
  readonly createdAtMs?: number
}

/**
 * The one town portal a character may have open.
 *
 * Deliberately a single slot rather than a list. Two open portals would make
 * "step into the portal in town" ambiguous, and the original game does not
 * allow it either: casting again closes the old one.
 */
export class TownPortalSlot {
  private open: OpenPortal | null = null

  /**
   * Cast a portal, replacing any previous one.
   *
   * @param portal - the new portal.
   * @returns the portal that was closed to make room, if any.
   */
  cast(portal: OpenPortal): OpenPortal | null {
    const previous = this.open
    this.open = portal
    return previous
  }

  /** Close the portal, if one is open. */
  close(): void {
    this.open = null
  }

  /**
   * The open portal.
   *
   * @returns it, or null.
   */
  current(): OpenPortal | null {
    return this.open
  }

  /**
   * Describe the portal mouth present in `levelId`, if any.
   *
   * @param levelId - the level currently loaded.
   * @returns the mouth present in `levelId`, or null.
   */
  mouthInLevel(levelId: number): PortalMouthInLevel | null {
    const portal = this.open
    if (portal === null) return null
    if (levelId === portal.fromLevelId) {
      return {
        x: portal.fromX,
        y: portal.fromY,
        toLevelId: portal.townLevelId,
        isTownMouth: false,
        ...(portal.createdAtMs !== undefined ? { createdAtMs: portal.createdAtMs } : {}),
      }
    }
    if (levelId === portal.townLevelId) {
      return {
        x: portal.townX,
        y: portal.townY,
        toLevelId: portal.fromLevelId,
        isTownMouth: true,
        ...(portal.createdAtMs !== undefined ? { createdAtMs: portal.createdAtMs } : {}),
      }
    }
    return null
  }

  /**
   * Where stepping into a mouth in the given level leads (pure query).
   *
   * @param levelId - the level the player is standing in.
   * @returns the other mouth, or null when this level has no mouth.
   */
  otherEnd(levelId: number): TravelTarget | null {
    const portal = this.open
    if (portal === null) return null
    if (levelId === portal.fromLevelId) {
      return { levelId: portal.townLevelId, x: portal.townX, y: portal.townY }
    }
    if (levelId === portal.townLevelId) {
      return { levelId: portal.fromLevelId, x: portal.fromX, y: portal.fromY }
    }
    return null
  }

  /**
   * Step into the portal mouth in `levelId` (`OBJECTS_OperateFunction15_Portal`, `ObjMode.cpp:3125`):
   * - Entering from the wilderness (`levelId === fromLevelId`) transports the player to town
   *   and keeps the portal open so the return mouth remains in town.
   * - Entering from town (`levelId === townLevelId`) transports the player back to the wilderness
   *   and **closes the portal** (`ObjMode.cpp:3245`).
   *
   * @param levelId - the level the player is entering the portal from.
   * @returns the travel destination, or null if no portal mouth is in `levelId`.
   */
  enterFrom(levelId: number): TravelTarget | null {
    const portal = this.open
    if (portal === null) return null
    if (levelId === portal.fromLevelId) {
      return { levelId: portal.townLevelId, x: portal.townX, y: portal.townY }
    }
    if (levelId === portal.townLevelId) {
      const target: TravelTarget = { levelId: portal.fromLevelId, x: portal.fromX, y: portal.fromY }
      this.open = null
      return target
    }
    return null
  }
}

export { ACT_TOWNS, townLevelForAct } from './acts.ts'

