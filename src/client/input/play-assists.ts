import type { ClientCommand } from '../../netproto/index.ts'
import { isWantedLoot, type AutoLootRules, type RoomPlan } from './auto-loot.ts'
import { InventoryCare } from './inventory-care.ts'
import type { ItemData } from '../../netproto/index.ts'
import type { LevelView } from '../map/level-view.ts'
import { findPathWorld, type SubTilePoint, type SubTileWalkabilityGrid } from '../motion/pathfind.ts'
import type { HudModel } from '../ui-model/hud-model.ts'
import type { HudManager } from '../ui/hud-manager.ts'
import type { ClientUnit } from '../world/client-unit.ts'
import type { ClientWorld } from '../world/client-world.ts'
import { CANONICAL_113C_OBJECTS } from '../../common/world/objects-meta.ts'
import { AutoPotionPlanner, bottomBeltPotions, inventoryPotions, potionShortage, wantedPotionPickup, type AutoPotionThresholds, type PotionDrink } from './auto-potion.ts'
import { beltColumnKinds, beltRefillPick, type BeltColumnKinds } from './belt-refill.ts'
import type { CameraLike, DispatchedCommandRecord } from './command-mapper.ts'
import { townPortalRefusalText, townPortalSource, type TownPortalRefusal } from './town-portal.ts'
import { appraisalContextOf } from '../../common/items/loot-context.ts'
import { clientUnitToMonsterTargetInfo } from '../ui-model/hud-item-adapter.ts'
import { attackSkill, auraSkill, BOSS_CLASSES, CLOSE_REACH, CORPSE_EXPLOSION, CURSE_SKILLS, isPriorityClass, raiseSkill, supportSkill, TRAP_CLASSES, TRAP_REACH, type CombatSelf, type CombatTarget, type Hand } from './combat-planner.ts'
import { dodgeSpot, hits, threatOf, type Threat } from './danger-dodge.ts'

export const ITEM_PICKUP_REACH_SUBTILES = 4
const PICKUP_RETRY_MS = 600
const PICKUP_DETOUR_RETRY_MS = 2500
const LOOT_STEP_MS = 200
const LOOT_STEP_AHEAD = 8
const AUTO_PICKUP_RADIUS_SUBTILES = 20
const CARRIED_GOLD_PER_LEVEL = 10_000
const AUTO_COMBAT_REPEAT_MS = 40
const HIT_CONFIRM_SLACK_MS = 120
const DEFAULT_PING_MS = 200
const STATE_HEALTHPOT = 100
const STATE_MANAPOT = 106
const REACH_CACHE_MS = 400
const REACH_MAX_NODES = 4000
const REACH_DETOUR_FACTOR = 1.6
const REACH_DETOUR_SLACK = 12
const DOOR_SEARCH_MS = 400
const DOOR_RETRY_MS = 900
const DOOR_PATH_RADIUS = 3
const BELT_REFILL_MS = 250
const BELT_REFILL_WAIT_MS = 1500
const RED_TEXT = 1
const SUPPORT_MS = 400
const CORPSE_USED_STATE = 0x8f
const CORPSE_REACH = 10
const RECAST_MS = 6000
const SWITCH_MS = 700
const SWITCH_RESEND_MS = 350
const PRIORITY_BONUS = 12
const FINISH_LIFE_PCT = 45
const FINISH_BONUS = 4
const TARGET_CANDIDATES = 8
const SWITCH_MARGIN = 6
const MELEE_CROWD = 4
const MELEE_CROWD_LIFE = 0.5
const CROWD_REACH = 3
const CROWD_SIZE = 2
const BACK_OFF_MS = 2500
const BACK_OFF_STEP = 7
const CURSE_RECAST_MS = 20_000
const PACK_REACH = 6
const BLAST_REACH = 5
const BLAST_PACK = 2
const BLAST_GAP_MS = 700
const BLAST_RANGE = 20
const GIVE_UP_MS = 15_000
const IGNORE_MS = 30_000
const DODGE_GAP_MS = 400
const STANDOFF = 7
const STEER_GRACE_MS = 1500
const PORTAL_CAST_MS = 1500
const DODGE_MS_PER_SUBTILE = 90
const DODGE_MAX_MS = 700
const DODGE_CROWD_COST = 4
const DODGE_SHOT_BONUS = 3
const INTERACTION_PANELS = new Set(['stash', 'cube', 'vendor', 'hire', 'imbue', 'add_sockets', 'personalize', 'trade', 'waypoint'])

export interface PlayAssistHost {
  readonly world: ClientWorld
  readonly hudManager: HudManager
  readonly hudModel: HudModel | null
  readonly camera: CameraLike
  readonly mouseHeld: () => { readonly left: boolean; readonly right: boolean }
  readonly isMoving: () => boolean
  readonly distanceFromSelf: () => (unit: ClientUnit) => number
  readonly centerCameraOnSelf: () => void
  readonly levelViewAt: (sx: number, sy: number) => LevelView | null
  readonly walkableWith: (view: LevelView, sx: number, sy: number, objects: readonly ClientUnit[]) => Uint8Array
  readonly triggerPrimaryWorldAction: (x: number, y: number, unit: ClientUnit | null, nowMs: number, isHold?: boolean) => DispatchedCommandRecord | null
  readonly triggerSecondaryWorldAction: (x: number, y: number, unit: ClientUnit | null, nowMs: number) => DispatchedCommandRecord | null
  readonly selectSkill: (hand: Hand, skillId: number, nowMs: number) => void
  readonly canCastSkill: (skillId: number, nowMs: number) => boolean
  readonly sendCommand: (command: ClientCommand, nowMs?: number) => void
  readonly stepToward: (x: number, y: number, nowMs: number) => void
  readonly isHostile: (unit: ClientUnit) => boolean
  readonly isPointIntercepted: (screenX: number, screenY: number) => boolean
  readonly isPlayerBusyCasting: (nowMs: number) => boolean
  readonly isTownArea: () => boolean
}

const objectMetaOf = (unit: ClientUnit) => unit.objectMeta ?? CANONICAL_113C_OBJECTS[unit.classId]
const collisionMask = (unit: ClientUnit) => objectMetaOf(unit)?.hasCollisionMask ?? 0
const objectMode = (unit: ClientUnit) => Math.max(0, Math.min(7, Math.floor(unit.mode || 0)))
const isPriorityTarget = (unit: ClientUnit) => isPriorityClass(unit.classId)

const isTough = (unit: ClientUnit) => [unit.isChampion, unit.isUnique, unit.isSuperUnique].includes(true) || BOSS_CLASSES.has(unit.classId)

export const isClosedDoor = (unit: ClientUnit) => !unit.hidden && !unit.dead && Boolean(objectMetaOf(unit)?.isDoor) && (collisionMask(unit) & (1 << objectMode(unit))) !== 0
const openModeOf = (door: ClientUnit) => [0, 1, 2, 3, 4, 5, 6, 7].find((mode) => (collisionMask(door) & (1 << mode)) === 0)
const asOpened = (door: ClientUnit): ClientUnit => {
  const mode = openModeOf(door)
  return mode === undefined ? door : (Object.create(door, { mode: { value: mode } }) as ClientUnit)
}
const isInGrid = (grid: SubTileWalkabilityGrid, x: number, y: number) => {
  const [ox, oy] = [grid.subOriginX ?? 0, grid.subOriginY ?? 0]
  return x >= ox && y >= oy && x < ox + grid.subWidth && y < oy + grid.subHeight
}

export interface Pilot {
  readonly active?: boolean
  toggle(): void
  tick(nowMs: number): void
}

export class PlayAssists {
  autoGoldPickup = false
  autoPotionThresholds: AutoPotionThresholds | null = null
  autoLootRules: AutoLootRules | null = null
  beltRefill = false
  smartSkills = false
  private pilotFights = false
  questPickup = false
  standDown = false
  holdLoot = false
  journal: ((kind: string, detail: Readonly<Record<string, unknown>>) => void) | null = null
  pilot: Pilot | null = null
  pilotKey: string | null = null
  townPortalKey: string | null = null
  readonly inventoryCare: InventoryCare
  private readonly autoPotion = new AutoPotionPlanner()
  private readonly pickupRetryAt = new Map<number, number>()
  private autoCombatKeyValue: string | null = null
  private autoCombatOn = false
  private targetId: number | null = null
  private lastAutoCombatMs = Number.NEGATIVE_INFINITY
  private lastHit: { readonly id: number; readonly life: number } | null = null
  private swingFinishedAtMs: number | null = null
  private engagedMonsterId: number | null = null
  private readonly reachability = new Map<string, { readonly atMs: number; readonly path: readonly SubTilePoint[] | null }>()
  private lootWalkId: number | null = null
  private itemPickup: { readonly id: number; readonly until: number } | null = null
  private collisionGrids: { readonly atMs: number; readonly grids: Map<boolean, SubTileWalkabilityGrid | null> } = { atMs: Number.NEGATIVE_INFINITY, grids: new Map() }
  private readonly doorAttemptAt = new Map<number, number>()
  private lastDoorSearchMs = Number.NEGATIVE_INFINITY
  private beltRefillSent: { readonly atMs: number; readonly beltSize: number; readonly itemId: number } | null = null
  private beltKinds: BeltColumnKinds = []
  private lastSupportMs = Number.NEGATIVE_INFINITY
  private readonly supportCastAt = new Map<string, number>()
  private readonly givenUp = new Map<number, number>()
  private lastBackOff = Number.NEGATIVE_INFINITY
  private readonly switching: Partial<Record<Hand, { readonly skillId: number; readonly at: number }>> = {}
  private lastBlast = Number.NEGATIVE_INFINITY
  private readonly blasted = new Set<number>()
  private fight: { readonly id: number; readonly life: number; readonly since: number } | null = null
  private dodge: { readonly to: SubTilePoint; readonly until: number } | null = null
  private lastManual = Number.NEGATIVE_INFINITY
  private lastPortalCast = Number.NEGATIVE_INFINITY
  private lastDodge = Number.NEGATIVE_INFINITY

  constructor(private readonly host: PlayAssistHost) {
    this.inventoryCare = new InventoryCare(host)
  }

  get pilotCombat(): boolean {
    return this.pilotFights
  }

  set pilotCombat(on: boolean) {
    if (on === this.pilotFights) return
    this.pilotFights = on
    this.showCombatBadge()
  }

  get autoCombatKey(): string | null {
    return this.autoCombatKeyValue
  }

  set autoCombatKey(key: string | null) {
    this.autoCombatKeyValue = key
    this.setAutoCombatOn(false)
  }

  tick(nowMs: number): void {
    this.drinkPotionsIfLow(nowMs)
    this.refillBelt(nowMs)
    this.inventoryCare.tick()
    if (!this.avoidDanger(nowMs)) {
      this.pickUpNearbyLoot(nowMs)
      this.runAutoCombat(nowMs)
    }
    this.pilot?.tick(nowMs)
  }

  handleKey(event: { readonly key: string; readonly repeat?: boolean | undefined; readonly preventDefault?: (() => void) | undefined }): boolean {
    const key = event.key === ' ' ? 'SPACE' : event.key.toUpperCase()
    const pilot = this.pilot
    const action = key === this.autoCombatKey ? () => this.setAutoCombatOn(!this.autoCombatOn) : key === this.townPortalKey ? () => this.castTownPortal() : key === this.pilotKey && pilot ? () => pilot.toggle() : null
    if (action === null) return false
    if (!event.repeat) action()
    event.preventDefault?.()
    return true
  }

  castTownPortal(): void {
    const { world, hudManager, hudModel } = this.host
    if (world.isDead || hudModel === null) return
    const source = townPortalSource(world.containers.inventory.values())
    const refusal: TownPortalRefusal | null = this.host.isTownArea() ? 'in-town' : source === null ? 'no-scrolls' : null
    if (source !== null && refusal === null) {
      this.lastPortalCast = performance.now()
      this.useInventoryItem(source.id, source.code, hudModel)
    }
    else world.addLocalSystemMessage(townPortalRefusalText(refusal ?? 'no-scrolls', hudManager.lang === 'ENG' ? 'ENG' : 'CHI'), RED_TEXT)
  }

  hasTownPortal(): boolean {
    return townPortalSource(this.host.world.containers.inventory.values()) !== null
  }

  refillBelt(nowMs: number): void {
    const { world, hudManager, hudModel } = this.host
    if (!this.beltRefill) return
    this.beltKinds = beltColumnKinds(hudManager.belt, this.beltKinds)
    if (hudModel === null || world.isDead || world.containers.cursor !== null || this.isInWorldInteraction() || this.isBeltRefillInFlight(nowMs)) return
    const itemId = beltRefillPick(hudManager.belt, inventoryPotions(world.containers.inventory.values()), this.beltKinds, this.beltRefillSent?.itemId)
    if (itemId === null) return
    this.beltRefillSent = { atMs: nowMs, beltSize: world.containers.belt.size, itemId }
    hudModel.autoBeltItem(itemId)
  }

  private isBeltRefillInFlight(nowMs: number): boolean {
    const sent = this.beltRefillSent
    if (sent === null) return false
    const { belt, inventory } = this.host.world.containers
    const answered = belt.size !== sent.beltSize || !inventory.has(sent.itemId)
    return nowMs - sent.atMs < (answered ? BELT_REFILL_MS : BELT_REFILL_WAIT_MS)
  }

  reset(): void {
    this.targetId = null
  }

  engageMonster(id: number): void {
    this.engagedMonsterId = id
    this.host.hudModel?.setHoveredMonster(id)
  }

  showHoveredMonster(id: number | null): void {
    const engaged = this.engagedMonsterId === null ? undefined : this.host.world.getUnit('monster', this.engagedMonsterId)
    const isShowingEngaged = (this.host.mouseHeld().left || this.autoCombatOn) && engaged !== undefined && this.host.isHostile(engaged)
    if (!isShowingEngaged) this.host.hudModel?.setHoveredMonster(id)
  }

  hasLootNearby(nowMs: number): boolean {
    return this.lootWalkId !== null || this.lootRoute(nowMs).nearest !== undefined
  }

  private lootRoute(nowMs: number): { readonly loot: readonly ClientUnit[]; readonly nearest: { readonly unit: ClientUnit; readonly path: readonly SubTilePoint[] } | undefined } {
    const { world } = this.host
    const { ground } = world.containers
    const wanted = this.lootWanted()
    const distance = this.host.distanceFromSelf()
    const pending = this.itemPickup
    const settling = world.containers.cursor !== null || (pending !== null && ground.has(pending.id) && nowMs < pending.until)
    const loot = [...ground.values()]
      .filter((item) => wanted(item) && (this.pickupRetryAt.get(item.id) ?? 0) <= nowMs && !(settling && this.roomFor(item.id) !== null))
      .map((item) => world.getUnit('item', item.id))
      .filter((unit): unit is ClientUnit => unit !== undefined && distance(unit) <= AUTO_PICKUP_RADIUS_SUBTILES)
    const walkLength = (route: { readonly unit: ClientUnit; readonly path: readonly SubTilePoint[] }) => route.path.length || distance(route.unit)
    const nearest = loot
      .map((unit) => ({ unit, path: this.pathTo(unit, nowMs) }))
      .filter((route): route is { unit: ClientUnit; path: readonly SubTilePoint[] } => route.path !== null)
      .sort((a, b) => walkLength(a) - walkLength(b))[0]
    return { loot, nearest }
  }

  pickUpNearbyLoot(nowMs: number): void {
    const { world } = this.host
    const { ground } = world.containers
    ;[...this.pickupRetryAt.keys()].filter((id) => !ground.has(id)).forEach((id) => this.pickupRetryAt.delete(id))
    if (world.isDead || this.standDown || this.holdLoot || this.isInWorldInteraction() || this.inventoryCare.busy) return
    const { loot, nearest } = this.lootRoute(nowMs)
    if (nearest === undefined) {
      this.lootWalkId = null
      if (loot.length > 0 && this.isFreeForLootDetour(nowMs, false)) this.openDoorToward(loot, nowMs)
      return
    }
    const { unit, path } = nearest
    const inReach = (path.length || this.host.distanceFromSelf()(unit)) <= ITEM_PICKUP_REACH_SUBTILES
    if (!inReach && !this.isFreeForLootDetour(nowMs, this.lootWalkId === unit.id)) return
    const stepping = !inReach && path.length > LOOT_STEP_AHEAD
    this.lootWalkId = inReach ? null : unit.id
    this.pickupRetryAt.set(unit.id, nowMs + (inReach ? PICKUP_RETRY_MS : stepping ? LOOT_STEP_MS : PICKUP_DETOUR_RETRY_MS))
    const room = this.roomFor(unit.id)
    if (room !== null && room.kind !== 'fits') this.inventoryCare.makeRoom(room, ground.get(unit.id)!)
    else if (inReach) {
      if (room !== null) this.itemPickup = { id: unit.id, until: nowMs + PICKUP_RETRY_MS }
      this.host.sendCommand({ type: 'ItemPickup', itemId: unit.id, toCursor: false }, nowMs)
    } else if (stepping) this.host.triggerPrimaryWorldAction(path[LOOT_STEP_AHEAD]!.x, path[LOOT_STEP_AHEAD]!.y, null, nowMs)
    else this.host.triggerPrimaryWorldAction(unit.x, unit.y, unit, nowMs)
  }

  drinkPotionsIfLow(nowMs: number): void {
    const { world, hudManager, hudModel } = this.host
    const thresholds = this.autoPotionThresholds
    const active = thresholds !== null && !world.isDead && !this.host.isTownArea()
    const { inventory, belt } = world.containers
    const potions = active ? [...inventoryPotions(inventory.values()), ...bottomBeltPotions(belt.values())] : []
    const { self } = world
    const maxLife = hudManager.maxHp || self.maxLife
    const maxMana = hudManager.maxMana || self.maxMana
    const vitals = {
      life: Math.min(self.life, maxLife),
      maxLife,
      mana: Math.min(self.mana, maxMana),
      maxMana,
      mercLifePct: active ? this.mercLifePct() : null,
      healingActive: self.states.has(STATE_HEALTHPOT),
      manaActive: self.states.has(STATE_MANAPOT),
      charClass: self.charClass,
    }
    hudManager.potionShortage = active ? potionShortage(potions, thresholds, vitals) : null
    if (!active || hudModel === null) return
    const drink = this.autoPotion.plan(potions, vitals, thresholds, nowMs)
    if (drink !== null && this.drinkPotion(drink, hudModel)) this.autoPotion.record(drink, nowMs)
  }

  runAutoCombat(nowMs: number): void {
    if (!(this.autoCombatOn || this.pilotCombat) || this.standDown || this.host.mouseHeld().left || this.host.world.isDead || this.isInWorldInteraction() || nowMs - this.lastAutoCombatMs < AUTO_COMBAT_REPEAT_MS) return
    const target = this.resolveTarget(nowMs)
    if (target === null) {
      if (this.smartSkills) this.keepUp(null, nowMs)
      this.openDoorToward(this.visibleHostilesByDistance(), nowMs)
      return
    }
    if (!this.noteProgress(target, nowMs) || this.isAwaitingHitResult(target, nowMs) || (this.smartSkills && this.keepUp(target, nowMs))) return
    const freshTarget = target.id !== this.targetId
    this.targetId = target.id
    this.lastAutoCombatMs = nowMs
    const record = this.smartSkills ? this.strike(target, nowMs, !freshTarget) : this.host.triggerPrimaryWorldAction(target.x, target.y, target, nowMs, !freshTarget)
    if (record?.command.type === 'SkillOn' && record.rateLimit.allowed) {
      this.lastHit = { id: target.id, life: target.lifePct }
      this.swingFinishedAtMs = null
    }
  }

  dodging(nowMs: number): boolean {
    const me = this.host.world.self
    if (this.dodge !== null && (nowMs >= this.dodge.until || Math.hypot(this.dodge.to.x - me.x, this.dodge.to.y - me.y) <= 1)) this.dodge = null
    return this.dodge !== null
  }

  avoidDanger(nowMs: number): boolean {
    const { world } = this.host
    const { left, right } = this.host.mouseHeld()
    if (this.pilot?.active !== true || world.isDead || left || right || this.playerSteering || nowMs - this.lastPortalCast < PORTAL_CAST_MS || this.host.isTownArea() || this.isInWorldInteraction()) return false
    if (this.dodging(nowMs)) return true
    if (nowMs - this.lastDodge < DODGE_GAP_MS) return false
    const me = world.self
    const threats = this.threats()
    const incoming = threats.filter((threat) => hits(threat, me))
    if (incoming.length === 0) return false
    const target = this.targetId === null ? undefined : world.getUnit('monster', this.targetId)
    const preference = (spot: SubTilePoint) => -Math.hypot(spot.x - me.x, spot.y - me.y) - this.hostilesNear(spot, CROWD_REACH) * DODGE_CROWD_COST + (target && !target.dead && this.clearShot(target, spot) ? DODGE_SHOT_BONUS : 0)
    const spot = dodgeSpot(me, threats, (candidate) => this.clearPath(me, candidate), preference)
    if (spot === null) return false
    this.lastDodge = nowMs
    this.dodge = { to: spot, until: nowMs + Math.min(DODGE_MAX_MS, Math.hypot(spot.x - me.x, spot.y - me.y) * DODGE_MS_PER_SUBTILE) }
    this.host.stepToward(spot.x, spot.y, nowMs)
    this.journal?.('dodge', { from: [...new Set(incoming.map((threat) => threat.name))], to: [spot.x, spot.y] })
    return true
  }

  private threats(): Threat[] {
    return this.host.world.getUnitsByType(3).flatMap((missile) => {
      const threat = this.isHostileMissile(missile) ? threatOf({ name: missile.missileKey ?? '', x: missile.x, y: missile.y, vx: missile.vx ?? 0, vy: missile.vy ?? 0, ticksLeft: (missile.maxTicks ?? 0) - (missile.ageTicks ?? 0) }) : null
      return threat ? [threat] : []
    })
  }

  private isHostileMissile(missile: ClientUnit): boolean {
    const { world } = this.host
    if (missile.ownerType === 'object') return true
    if (missile.ownerType !== 'monster' || missile.ownerId === undefined || world.pets.has(missile.ownerId)) return false
    const owner = world.getUnit('monster', missile.ownerId)
    return owner === undefined || this.host.isHostile(owner)
  }

  isFighting(nowMs: number): boolean {
    return (this.autoCombatOn || this.pilotCombat) && !this.host.world.isDead && this.resolveTarget(nowMs) !== null
  }

  keepUp(target: ClientUnit | null, nowMs: number): boolean {
    if (nowMs - this.lastSupportMs < SUPPORT_MS || this.host.isPlayerBusyCasting(nowMs)) return false
    this.lastSupportMs = nowMs
    const castKey = (skillId: number) => `${skillId}:${target?.id ?? 0}`
    const canCast = (skillId: number) => this.host.canCastSkill(skillId, nowMs)
    const fresh = (skillId: number) => canCast(skillId) && nowMs - (this.supportCastAt.get(castKey(skillId)) ?? Number.NEGATIVE_INFINITY) >= (CURSE_SKILLS.has(skillId) ? CURSE_RECAST_MS : RECAST_MS)
    const self = this.combatSelf()
    const use = raiseSkill(self, canCast) ?? supportSkill(self, target && this.combatTarget(target), fresh)
    if (use === null) {
      const aura = auraSkill(self, target !== null, canCast)
      if (aura !== null) this.holdSkill('right', aura, nowMs)
      return false
    }
    const { x, y } = use.on === 'self' ? this.host.world.self : target!
    if (!this.holdSkill('right', use.skillId, nowMs)) return true
    this.supportCastAt.set(castKey(use.skillId), nowMs)
    this.logCast(use.on === 'self' ? 'support' : 'curse', use.skillId, use.on === 'self' ? null : target)
    return this.host.triggerSecondaryWorldAction(x, y, use.on === 'self' ? null : target, nowMs) !== null
  }

  get moving(): boolean {
    return this.host.isMoving()
  }

  get playerSteering(): boolean {
    const { left, right } = this.host.mouseHeld()
    return left || right || performance.now() - this.lastManual < STEER_GRACE_MS
  }

  noteManual(nowMs: number): void {
    this.lastManual = nowMs
  }

  isHostile(unit: ClientUnit): boolean {
    return this.host.isHostile(unit)
  }

  walkTo(x: number, y: number, nowMs: number): void {
    this.host.triggerPrimaryWorldAction(x, y, null, nowMs)
  }

  stepTo(x: number, y: number, nowMs: number): void {
    this.host.stepToward(x, y, nowMs)
  }

  use(unit: ClientUnit, nowMs: number): void {
    this.host.triggerPrimaryWorldAction(unit.x, unit.y, unit, nowMs)
  }

  canCast(skillId: number, nowMs: number): boolean {
    return (this.host.world.self.skills.get(skillId) ?? 0) > 0 && this.host.canCastSkill(skillId, nowMs)
  }

  castAt(skillId: number, x: number, y: number, nowMs: number): boolean {
    if (this.host.isPlayerBusyCasting(nowMs) || !this.holdSkill('right', skillId, nowMs)) return false
    return this.host.triggerSecondaryWorldAction(x, y, null, nowMs) !== null
  }

  private strike(target: ClientUnit, nowMs: number, isHold: boolean): DispatchedCommandRecord | null {
    const corpse = this.corpseToBlast(target, nowMs)
    if (corpse) {
      if (!this.holdSkill('right', CORPSE_EXPLOSION, nowMs)) return null
      this.blasted.add(corpse.id)
      this.lastBlast = nowMs
      this.logCast('blast', CORPSE_EXPLOSION, corpse)
      return this.host.triggerSecondaryWorldAction(corpse.x, corpse.y, corpse, nowMs)
    }
    const use = attackSkill(this.combatSelf(), this.combatTarget(target), (skillId) => this.host.canCastSkill(skillId, nowMs))
    if (use.reach === 'close' && this.host.distanceFromSelf()(target) > CLOSE_REACH) return this.host.triggerPrimaryWorldAction(target.x, target.y, null, nowMs)
    if (use.reach !== 'melee' && !this.clearShot(target)) return this.host.triggerPrimaryWorldAction(target.x, target.y, null, nowMs)
    const life = this.combatSelf().lifeFraction
    const standoff = use.reach === 'ranged' && isTough(target) && Math.hypot(target.x - this.host.world.self.x, target.y - this.host.world.self.y) < STANDOFF
    const room = standoff ? this.roomToBreathe(nowMs, 1, [target]) : use.reach === 'ranged' ? this.roomToBreathe(nowMs, CROWD_SIZE) : life < MELEE_CROWD_LIFE ? this.roomToBreathe(nowMs, MELEE_CROWD) : null
    if (room) return this.host.triggerPrimaryWorldAction(room.x, room.y, null, nowMs)
    if (!this.holdSkill(use.hand, use.skillId, nowMs)) return null
    if (!isHold) this.logCast('attack', use.skillId, target)
    return use.hand === 'left' ? this.host.triggerPrimaryWorldAction(target.x, target.y, target, nowMs, isHold) : this.host.triggerSecondaryWorldAction(target.x, target.y, target, nowMs)
  }

  private roomToBreathe(nowMs: number, crowdSize: number, around?: readonly ClientUnit[]): SubTilePoint | null {
    const me = this.host.world.self
    const crowd = around ?? this.host.world.getUnitsByType(1).filter((unit) => !unit.dead && this.host.isHostile(unit) && Math.hypot(unit.x - me.x, unit.y - me.y) <= CROWD_REACH)
    if (crowd.length < crowdSize || nowMs - this.lastBackOff < BACK_OFF_MS) return null
    const gap = (spot: SubTilePoint) => Math.min(...crowd.map((unit) => Math.hypot(unit.x - spot.x, unit.y - spot.y)))
    const threats = this.threats()
    const spot = Array.from({ length: 12 }, (_, i) => ({ x: Math.round(me.x + Math.cos((i * Math.PI) / 6) * BACK_OFF_STEP), y: Math.round(me.y + Math.sin((i * Math.PI) / 6) * BACK_OFF_STEP) }))
      .filter((candidate) => this.clearPath(me, candidate) && !threats.some((threat) => hits(threat, candidate)))
      .sort((a, b) => gap(b) - gap(a))[0]
    if (!spot || gap(spot) <= gap(me) + 1) return null
    this.lastBackOff = nowMs
    this.journal?.('back-off', { crowd: crowd.length, to: [spot.x, spot.y] })
    return spot
  }

  private clearPath(from: SubTilePoint, to: SubTilePoint): boolean {
    const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y))
    return Array.from({ length: steps }, (_, i) => (i + 1) / steps).every((t) => !this.host.world.isSubTileBlocked(Math.round(from.x + (to.x - from.x) * t), Math.round(from.y + (to.y - from.y) * t)))
  }

  private clearShot(target: SubTilePoint, me: SubTilePoint = this.host.world.self): boolean {
    const steps = Math.ceil(Math.hypot(target.x - me.x, target.y - me.y))
    return Array.from({ length: Math.max(0, steps - 1) }, (_, i) => (i + 1) / steps).every((t) => !this.host.world.isSubTileMissileBlocked(Math.round(me.x + (target.x - me.x) * t), Math.round(me.y + (target.y - me.y) * t)))
  }

  private corpseToBlast(target: ClientUnit, nowMs: number): ClientUnit | undefined {
    if ((this.host.world.self.skills.get(CORPSE_EXPLOSION) ?? 0) === 0 || nowMs - this.lastBlast < BLAST_GAP_MS || !this.host.canCastSkill(CORPSE_EXPLOSION, nowMs)) return undefined
    const me = this.host.world.self
    const worth = (corpse: ClientUnit) => this.hostilesNear(corpse, BLAST_REACH) >= BLAST_PACK || (isTough(target) && Math.hypot(corpse.x - target.x, corpse.y - target.y) <= BLAST_REACH)
    const corpse = this.corpses().find((body) => !this.blasted.has(body.id) && Math.hypot(body.x - me.x, body.y - me.y) <= BLAST_RANGE && Math.hypot(body.x - target.x, body.y - target.y) <= BLAST_REACH && worth(body))
    return corpse
  }

  private corpses(): ClientUnit[] {
    return this.host.world.getUnitsByType(1).filter((unit) => unit.dead && !unit.hidden && !unit.states.has(CORPSE_USED_STATE))
  }

  private hostilesNear(spot: SubTilePoint, reach: number): number {
    return this.host.world.getUnitsByType(1).filter((unit) => !unit.dead && this.host.isHostile(unit) && Math.hypot(unit.x - spot.x, unit.y - spot.y) <= reach).length
  }

  get currentTargetId(): number | null {
    return this.targetId
  }

  private logCast(why: string, skillId: number, unit: ClientUnit | null): void {
    this.journal?.('cast', { why, skillId, target: unit && { id: unit.id, classId: unit.classId, name: unit.name, lifePct: unit.lifePct, dead: unit.dead } })
  }

  private holdSkill(hand: Hand, skillId: number, nowMs: number): boolean {
    const { self } = this.host.world
    if ((hand === 'left' ? self.leftSkill : self.rightSkill) === skillId) return true
    const pending = this.switching[hand]
    if (pending && nowMs - pending.at < SWITCH_MS && (pending.skillId !== skillId || nowMs - pending.at < SWITCH_RESEND_MS)) return false
    this.switching[hand] = { skillId, at: nowMs }
    this.host.selectSkill(hand, skillId, nowMs)
    return false
  }

  private combatSelf(): CombatSelf {
    const { world } = this.host
    const { self } = world
    return {
      skills: self.skills,
      mainSkills: appraisalContextOf(world).build.mainSkills,
      states: self.states,
      petClasses: [...world.pets.values()].filter((pet) => pet.ownerId === world.selfId && !pet.isDead).map((pet) => pet.classId),
      lifeFraction: self.life / Math.max(1, this.host.hudManager.maxHp || self.maxLife),
      manaFraction: self.mana / Math.max(1, this.host.hudManager.maxMana || self.maxMana),
      corpsesNear: this.corpses().filter((unit) => Math.hypot(unit.x - self.x, unit.y - self.y) <= CORPSE_REACH).length,
    }
  }

  private combatTarget(unit: ClientUnit): CombatTarget {
    const { world } = this.host
    const near = (other: ClientUnit) => Math.hypot(other.x - unit.x, other.y - unit.y) <= TRAP_REACH
    return {
      distance: this.host.distanceFromSelf()(unit),
      resists: clientUnitToMonsterTargetInfo(unit, world.difficulty).resistances ?? {},
      states: unit.states,
      trapsNear: world.getUnitsByType(1).filter((other) => TRAP_CLASSES.has(other.classId) && near(other)).length,
      tough: isTough(unit),
      lifeFraction: unit.lifePct / 128,
      packSize: this.hostilesNear(unit, PACK_REACH),
    }
  }

  private setAutoCombatOn(on: boolean): void {
    this.autoCombatOn = on
    this.targetId = null
    this.showCombatBadge()
  }

  private showCombatBadge(): void {
    this.host.hudManager.autoCombatBadge = this.autoCombatKeyValue === null ? null : { on: this.autoCombatOn || this.pilotFights, key: this.autoCombatKeyValue }
  }

  private isInWorldInteraction(): boolean {
    const { hudManager } = this.host
    return INTERACTION_PANELS.has(hudManager.leftPanel) || Boolean(hudManager.worldPanels.npcMenu)
  }

  private roomFor(itemId: number): RoomPlan | null {
    const item = this.host.world.containers.ground.get(itemId)
    return item === undefined || item.code.trim() === 'gld' || this.inventoryCare.appraise(item).kind === 'consumable' ? null : this.inventoryCare.roomFor(item)
  }

  private lootWanted(): (item: ItemData) => boolean {
    const { self, containers } = this.host.world
    const wantsGold = this.autoGoldPickup && self.gold < self.level * CARRIED_GOLD_PER_LEVEL
    const thresholds = this.autoPotionThresholds
    const wantsPotion = thresholds === null ? () => false : wantedPotionPickup(inventoryPotions([...containers.inventory.values(), ...containers.belt.values()]), thresholds)
    const rules = this.autoLootRules
    const care = this.inventoryCare
    const wantsLoot = (item: ItemData) => rules !== null && !care.discarded.has(item.id) && isWantedLoot(rules, item, care.appraise(item)) && care.roomFor(item) !== null
    const wantsQuest = (item: ItemData) => this.questPickup && care.appraise(item).kind === 'quest' && care.roomFor(item) !== null
    return (item) => (wantsGold && item.code.trim() === 'gld') || wantsPotion(item.code.trim()) || wantsLoot(item) || wantsQuest(item)
  }

  private isFreeForLootDetour(nowMs: number, walkingToLoot: boolean): boolean {
    const { left, right } = this.host.mouseHeld()
    const fighting = this.isFighting(nowMs)
    return !left && !right && !fighting && (walkingToLoot || !this.host.isMoving())
  }

  private drinkPotion(drink: PotionDrink, hudModel: HudModel): boolean {
    const { hudManager } = this.host
    const withSound = hudManager.commandSink === hudModel
    if ('itemId' in drink) return this.useInventoryItem(drink.itemId, drink.code, hudModel)
    const toMerc = drink.kind === 'merc'
    return withSound ? hudManager.drinkBeltSlot(drink.column, toMerc) : hudModel.useBeltSlot(drink.column, toMerc)
  }

  private useInventoryItem(itemId: number, code: string, hudModel: HudModel): boolean {
    if (this.host.hudManager.commandSink === hudModel) return this.host.hudManager.drinkInventoryPotion(itemId, code)
    hudModel.useItem(itemId)
    return true
  }

  private mercLifePct(): number | null {
    const { world } = this.host
    const unit = world.merc && !world.merc.isDead && world.merc.mercId > 0 ? world.getUnit('monster', world.merc.mercId) : undefined
    return unit === undefined ? null : (unit.lifePct * 100) / 128
  }

  private isAwaitingHitResult(target: ClientUnit, nowMs: number): boolean {
    const last = this.lastHit
    if (last?.id !== target.id || last.life !== target.lifePct) return false
    if (this.host.isPlayerBusyCasting(nowMs)) {
      this.swingFinishedAtMs = null
      return true
    }
    this.swingFinishedAtMs ??= nowMs
    return nowMs - this.swingFinishedAtMs < (this.host.hudManager.pingMs || DEFAULT_PING_MS) + HIT_CONFIRM_SLACK_MS
  }

  private isOnScreenHostile(unit: ClientUnit): boolean {
    if (!this.host.isHostile(unit)) return false
    const { camera } = this.host
    const screen = camera.subtileToScreen(unit.x, unit.y)
    const { width, height } = camera.viewportProfile
    return screen.x >= 0 && screen.y >= 0 && screen.x <= width && screen.y <= height && !this.host.isPointIntercepted(screen.x, screen.y)
  }

  private resolveTarget(nowMs: number): ClientUnit | null {
    this.host.centerCameraOnSelf()
    const current = this.targetId === null ? undefined : this.host.world.getUnit('monster', this.targetId)
    const worthIt = (unit: ClientUnit) => this.isReachable(unit, nowMs) && (this.givenUp.get(unit.id) ?? 0) <= nowMs
    const distance = this.host.distanceFromSelf()
    const urgency = (unit: ClientUnit) => distance(unit) - (isPriorityTarget(unit) ? PRIORITY_BONUS : 0) - (unit.lifePct < FINISH_LIFE_PCT ? FINISH_BONUS : 0)
    const visible = this.visibleHostilesByDistance()
    const best = [...new Set([...visible.slice(0, TARGET_CANDIDATES), ...visible.filter(isPriorityTarget)])].sort((a, b) => urgency(a) - urgency(b)).find(worthIt)
    const keep = current !== undefined && this.isOnScreenHostile(current) && worthIt(current) && (best === undefined || urgency(best) > urgency(current) - SWITCH_MARGIN)
    return keep ? current : (best ?? null)
  }

  private noteProgress(target: ClientUnit, nowMs: number): boolean {
    const fight = this.fight
    if (fight?.id !== target.id || fight.life !== target.lifePct) {
      this.fight = { id: target.id, life: target.lifePct, since: nowMs }
      return true
    }
    if (nowMs - fight.since < GIVE_UP_MS) return true
    this.givenUp.set(target.id, nowMs + IGNORE_MS)
    this.targetId = null
    this.fight = null
    return false
  }

  private visibleHostilesByDistance(): ClientUnit[] {
    const distance = this.host.distanceFromSelf()
    return [...this.host.world.units.values()].filter((unit) => this.isOnScreenHostile(unit)).sort((a, b) => distance(a) - distance(b))
  }

  canReach(unit: ClientUnit, nowMs: number): boolean {
    return this.isReachable(unit, nowMs)
  }

  private isReachable(unit: ClientUnit, nowMs: number): boolean {
    return this.pathTo(unit, nowMs) !== null
  }

  private pathTo(unit: ClientUnit, nowMs: number): readonly SubTilePoint[] | null {
    const cached = this.reachability.get(unit.key)
    if (cached !== undefined && nowMs - cached.atMs < REACH_CACHE_MS) return cached.path
    const path = this.walkPathTo(unit, false, nowMs)
    this.reachability.set(unit.key, { atMs: nowMs, path })
    return path
  }

  private walkPathTo(unit: ClientUnit, openDoors: boolean, nowMs: number): readonly SubTilePoint[] | null {
    const [sx, sy] = [Math.round(this.host.world.self.x), Math.round(this.host.world.self.y)]
    const grid = this.collisionGridAt(sx, sy, openDoors, nowMs)
    if (grid === null || !isInGrid(grid, unit.x, unit.y)) return []
    const { rawPath, reachedGoal } = findPathWorld(grid, sx, sy, Math.round(unit.x), Math.round(unit.y), { unitSize: 2, allowPartial: false, smooth: false, nearestTargetRadius: 2, maxExpandedNodes: REACH_MAX_NODES })
    return reachedGoal && rawPath.length <= Math.hypot(unit.x - sx, unit.y - sy) * REACH_DETOUR_FACTOR + REACH_DETOUR_SLACK ? rawPath : null
  }

  private collisionGridAt(sx: number, sy: number, openDoors: boolean, nowMs: number): SubTileWalkabilityGrid | null {
    if (nowMs - this.collisionGrids.atMs >= REACH_CACHE_MS) this.collisionGrids = { atMs: nowMs, grids: new Map() }
    const { grids } = this.collisionGrids
    if (grids.has(openDoors)) return grids.get(openDoors) ?? null
    const view = this.host.levelViewAt(sx, sy)
    const objects = this.objects().map((unit) => (openDoors && isClosedDoor(unit) ? asOpened(unit) : unit))
    const grid = view && view.walkable.length > 0 && isInGrid(view, sx, sy) ? { ...view, walkable: this.walkableAround(view, sx, sy, objects) } : null
    grids.set(openDoors, grid)
    return grid
  }

  walkableWithDoorsOpen(view: LevelView): Uint8Array {
    return this.walkableAround(view, Math.round(this.host.world.self.x), Math.round(this.host.world.self.y), this.objects().map((unit) => (isClosedDoor(unit) ? asOpened(unit) : unit)))
  }

  private walkableAround(view: LevelView, sx: number, sy: number, objects: readonly ClientUnit[]): Uint8Array {
    try {
      return this.host.walkableWith(view, sx, sy, objects)
    } catch {
      return view.walkable
    }
  }

  private objects(): readonly ClientUnit[] {
    return this.host.world.getUnitsByType(2)
  }

  private openDoorToward(targets: readonly ClientUnit[], nowMs: number): void {
    if (nowMs - this.lastDoorSearchMs < DOOR_SEARCH_MS) return
    this.lastDoorSearchMs = nowMs
    const doors = this.objects().filter((door) => isClosedDoor(door) && (this.doorAttemptAt.get(door.id) ?? 0) <= nowMs)
    if (doors.length === 0) return
    const doorOnPath = (path: readonly SubTilePoint[]) => path.map((step) => doors.find((door) => Math.hypot(door.x - step.x, door.y - step.y) <= DOOR_PATH_RADIUS)).find((door) => door !== undefined)
    const door = targets.reduce<ClientUnit | undefined>((found, target) => found ?? doorOnPath(this.walkPathTo(target, true, nowMs) ?? []), undefined)
    if (door === undefined) return
    this.doorAttemptAt.set(door.id, nowMs + DOOR_RETRY_MS)
    this.lastAutoCombatMs = nowMs
    this.host.triggerPrimaryWorldAction(door.x, door.y, door, nowMs)
  }
}
