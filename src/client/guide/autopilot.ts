import { appraisalContextOf } from '../../common/items/loot-context.ts'
import { MONSTER_PATH_IDS } from '../../common/path/monster-path-data.ts'
import { getLevelMonsterLevel113c } from '../../common/world/levels-monlvl-113c.ts'
import { WAYPOINT_CLASS_IDS_113C } from '../../common/world/objects-meta.ts'
import type { ItemData } from '../../netproto/index.ts'
import { TELEPORT } from '../input/combat-planner.ts'
import { scrollsCarried, scrollSource } from '../input/town-portal.ts'
import { isClosedDoor, type PlayAssists } from '../input/play-assists.ts'
import type { LevelView } from '../map/level-view.ts'
import { firstPad, guessPartner, Regions, type Pad } from './pad-routes.ts'
import type { SubTilePoint } from '../motion/pathfind.ts'
import type { HudModel } from '../ui-model/hud-model.ts'
import { waitFor } from '../ui-model/stash-deposit.ts'
import type { HudManager } from '../ui/hud-manager.ts'
import type { ClientUnit } from '../world/client-unit.ts'
import type { ClientWorld } from '../world/client-world.ts'
import { useArtisan, type ArtisanKind } from './artisan.ts'
import { freeSpots } from '../input/auto-loot.ts'
import { vendorPrice113c } from '../ui-model/vendor-price.ts'
import { readyRecipe, takeOut, transmute, withdraw, type ReadyRecipe } from './cube-recipes.ts'
import { buildOf, nextSkill, nextStat } from './build-plan.ts'
import { alongLine } from './chevron-flow.ts'
import { FlowField } from './flow-field.ts'
import type { GuidePlan, GuideTarget, PathGuide } from './path-guide.ts'
import LAIRS from './data/boss-lairs.json'
import { WAYPOINT_LEVELS } from './level-links.ts'
import { readiness, trainingGround, type Readiness, type Trainee } from './training.ts'
import { ACT_TOWNS, actOfLevel, levelName, type Goal } from './route.ts'
import TOWNS from './data/towns.json'

export interface AutopilotHost {
  readonly world: ClientWorld
  readonly hudManager: HudManager
  readonly hudModel: HudModel | null
  readonly assists: PlayAssists
  readonly guide: PathGuide
  readonly levelView: () => LevelView | null
}

type Service = keyof (typeof TOWNS)['Rogue Encampment']

interface Errand {
  readonly key: string
  readonly reason: string
  readonly npc?: Service
  readonly stash?: true
  readonly action?: string
  readonly work?: () => Promise<unknown>
}

const TICK_MS = 60
const WALK_MS = 200
const LOOKAHEAD = 15
const TELEPORT_AHEAD = 24
const TELEPORT_MS = 300
const TELEPORT_MANA = 0.5
const TELEPORT_MISSES = 3
const TELEPORT_OFF_MS = 60_000
const REACH = 4
const INTERACT_REACH = 14
const QUEST_FOCUS = 25
const LOOT_SETTLE_MS = 700
const STALL_MS = 1500
const PAD_CLASSES: ReadonlySet<number> = new Set([192, 304, 305, 306])
const PAD_SAME = 4
const CORPSE_SAME = 3
const ASSESS_MS = 5000
const PREP = 'Stocking up before'
const CORPSE_GONE = 10
const BODY_GONE_MS = 3000
const REVIVE_MS = 2500
const DEATH_MEMORY_MS = 20 * 60_000
const DEATH_CAUTION = 0.08
const MAX_CAUTION = 0.24
const HUNT_CAUTION = 0.16
const DOOM_MS = 4000
const DOOM_MIN_LOSS = 0.15
const ELITE_PULL = 12
const PACK_PULL = 3
const PACK_RADIUS = 6
const UNREACHED_ROOM = 1000
const WAYPOINT_GRAB = 40
const PAD_REUSE_MS = 120_000
const PAD_ARRIVAL_MS = 4000
const PAD_JUMP = 20
const PAD_ARRIVAL_NEAR = 12
const PAD_FIELD_CELL = 4
const PAD_FIELD_MS = 3000
const STALL_MOVE = 3
const DOOR_NEAR = 8
const DOOR_LOOKAHEAD = 20
const DOOR_ON_ROUTE = 4
const USE_MS = 600
const USE_TRIES = 8
const TALK_MS = 700
const SPEECH_SKIP_MS = 80
const CARE_START_MS = 350
const REPAIR_MS = 300
const STUCK_TALK_MS = 20_000
const STUCK_MS = 3200
const STUCK_MOVE = 1.5
const MANUAL_PAUSE_MS = 4000
const ERRAND_COOLDOWN_MS = 300_000
const HEAL_COOLDOWN_MS = 8000
const RESTOCK_COOLDOWN_MS = 20_000
const ERRAND_TIMEOUT_MS = 45_000
const RETREAT_LIFE = 0.35
const DRY_LIFE = 0.6
const MIN_RETREAT_LIFE = 0.2
const MAX_RETREAT_LIFE = 0.5
const GAP_CAUTION = 0.03
const STOCKED_POTIONS = 4
const STOCKED_NERVE = 0.12
const HUNT_LIFE = 0.6
const HUNT_POTIONS = 2
const HUNT_GAP = 2
const HUNT_RADIUS = 30
const HUNT_MS = 8000
const HUNT_IGNORE_MS = 30_000
const LAST_POTION_LIFE = 0.45
const BURST_MS = 3000
const BURST_LOSS = 0.4
const KITE_NEAR = 5
const KITE_STEP = 9
const KITE_MS = 2500
const SEAM_JUMP = 20
const SPEND_MS = 1500
const HEAL_LIFE = 0.7
const RECOVERED_LIFE = 0.85
const HEAL_MANA = 0.4
const REPAIR_BELOW = 0.3
const POTION_COLUMNS = { melee: [3, 1], caster: [2, 2] } as const
const POTION_GOLD = 100
const SPARE_POTIONS = { melee: [4, 1], caster: [3, 3] } as const
const SPARE_GOLD = 2000
const SHOP_GOLD = 6000
const BUY_TRIES = 16
const SCROLL_KINDS = {
  portal: { tome: 'tbk', scroll: 'tsc', tomeGold: 500, keep: 10, spare: 2 },
  identify: { tome: 'ibk', scroll: 'isc', tomeGold: 300, keep: 10, spare: 0 },
} as const
const SCROLL_GOLD = 100
const IDENTIFY_MS = 1500
const QUEST_STALE_MS = 30_000
const ROOM_REACHED = 8
const ROOM_END = 3
const STASH_CLASS = 267
const CUBE_CODE = 'box'
const STAFF_CODE = 'hst'
const TOWN_PORTAL_CLASS = 59
const PORTAL_REACH = 12
const TRAVEL_OPTIONS = ['travel_east', 'travel_west', 'travel_harrogath']
const ARTISANS: readonly ArtisanKind[] = ['imbue', 'add_sockets']
const WARP_NEAR = 7
const SEAM_STEP = 20
const CROSS_MS = 4000
const GAP_MS = 2500
const GAP_STEP = 12
const GAP_TRIES = 6

const distance = (a: SubTilePoint, b: SubTilePoint) => Math.hypot(a.x - b.x, a.y - b.y)
const isElite = (unit: ClientUnit) => [unit.isChampion, unit.isUnique, unit.isSuperUnique].includes(true)
const padKey = (pad: SubTilePoint) => `${Math.round(pad.x)},${Math.round(pad.y)}`
const potionTier = (code: string) => Number(code.slice(2)) || 0

export class Autopilot {
  active = false
  private lastTick = Number.NEGATIVE_INFINITY
  private lastWalk = Number.NEGATIVE_INFINITY
  private blink: { readonly at: number; readonly from: SubTilePoint; readonly pending: boolean; readonly misses: number; readonly offUntil: number } | null = null
  private pausedUntil = Number.NEGATIVE_INFINITY
  private progress = { ms: 0, x: 0, y: 0 }
  private job: Promise<unknown> | null = null
  private readonly uses = new Map<number, { readonly at: number; readonly tries: number }>()
  private readonly errandsAt = new Map<string, number>()
  private talk: { readonly npcId: number; readonly hint: string; readonly since: number; at: number; spoke: boolean; opened: boolean; readonly heard: Set<string> } | null = null
  private waypointTo: number | null = null
  private readonly explored = new Map<number, Set<number>>()
  private exploreField: { readonly key: string; readonly field: FlowField } | null = null
  private trip: 'retreat' | 'return' | null = null
  private retreatWhy = ''
  private trail: { readonly level: number; readonly at: SubTilePoint; readonly before: SubTilePoint }[] = []
  private leftBehind: typeof this.trail = []
  private lastSpot: { readonly level: number; readonly x: number; readonly y: number } | null = null
  private kiteSince: number | null = null
  private questWatch = { hint: '', since: 0, asked: Number.NEGATIVE_INFINITY }
  private chase: { readonly id: number; readonly since: number } | null = null
  private readonly ignored = new Map<number, number>()
  private readonly served = new Set<ArtisanKind>()
  private lootUntil = Number.NEGATIVE_INFINITY
  private stall = { x: 0, y: 0, at: 0 }
  private padsUsed: { readonly x: number; readonly y: number; readonly until: number }[] = []
  private padFrom: { readonly x: number; readonly y: number; readonly at: number; readonly pad: SubTilePoint } | null = null
  private regions: { readonly level: number; readonly regions: Regions } | null = null
  private readonly landings = new Map<string, SubTilePoint>()
  private padCache: { readonly key: string; readonly at: number; readonly field: FlowField } | null = null
  private lifeLog: readonly { readonly at: number; readonly life: number }[] = []
  private crossing: { readonly to: SubTilePoint; readonly until: number } | null = null
  private gapSearch: { readonly since: number; readonly from: SubTilePoint } | null = null
  private lastSpend = Number.NEGATIVE_INFINITY
  private corpse: { readonly level: number; readonly x: number; readonly y: number } | null = null
  private deaths: readonly { readonly at: number; readonly level: number }[] = []
  private training: (Readiness & { readonly ground: number }) | null = null
  private readonly trainedOut = new Set<number>()
  private questLevel: number | null = null
  private assessedAt = Number.NEGATIVE_INFINITY
  private lastRevive = Number.NEGATIVE_INFINITY
  private bodySeen = Number.NEGATIVE_INFINITY
  private readonly prepared = new Map<string, number>()
  spendPoints = false

  constructor(private readonly host: AutopilotHost) {}

  toggle(): void {
    if (this.active) this.stop('Autopilot off', 'tan')
    else this.start()
  }

  start(): void {
    const { assists, guide } = this.host
    Object.assign(this, { active: true, pausedUntil: Number.NEGATIVE_INFINITY, talk: null, waypointTo: null, trip: null })
    this.uses.clear()
    this.errandsAt.clear()
    guide.enabled = true
    assists.questPickup = true
    this.toast('Autopilot on', assists.pilotKey ? `Press ${assists.pilotKey} or click to take over` : 'Click anywhere to take over', 'green')
  }

  stop(title: string, color: 'tan' | 'red' | 'gold' = 'tan', detail = ''): void {
    const { assists, guide } = this.host
    Object.assign(this, { active: false, job: null, talk: null, crossing: null })
    Object.assign(assists, { pilotCombat: false, questPickup: false, standDown: false, holdLoot: false })
    guide.pilotStatus = null
    guide.detour = null
    this.toast(title, detail, color)
  }

  tick(nowMs: number): void {
    if (!this.active || nowMs - this.lastTick < TICK_MS) return
    this.lastTick = nowMs
    const { world, assists } = this.host
    if (assists.playerSteering) this.pausedUntil = nowMs + MANUAL_PAUSE_MS
    if (world.areaId > 0) this.noteArea()
    this.noteArrival(nowMs)
    if (world.isDead) this.mourn(nowMs)
    else if (nowMs < this.pausedUntil) this.say('Paused while you play')
    else if (world.areaId > 0 && !this.job) this.decide(nowMs)
  }

  private mourn(nowMs: number): void {
    const { world, hudModel } = this.host
    if (this.corpse?.level !== world.areaId || distance(this.corpse, world.self) > CORPSE_SAME) {
      this.corpse = { level: world.areaId, x: world.self.x, y: world.self.y }
      this.deaths = [...this.deaths.filter((death) => nowMs - death.at < DEATH_MEMORY_MS), { at: nowMs, level: this.questLevel ?? world.areaId }]
      Object.assign(this, { trip: null, crossing: null, talk: null, chase: null })
      this.toast('You died', 'Going back for your body', 'red')
    }
    this.say('Died, going back for your body')
    if (nowMs - this.lastRevive < REVIVE_MS) return
    this.lastRevive = nowMs
    hudModel?.resurrect()
  }

  private corpseGoal(): Goal | null {
    const corpse = this.corpse
    return corpse && { level: corpse.level, title: 'Your body', hint: 'Get your body back', spot: { x: corpse.x, y: corpse.y } }
  }

  private ownBody(): ClientUnit | undefined {
    const { world } = this.host
    return world.getUnitsByType(0).find((unit) => unit.id !== world.selfId && unit.name === world.self.name)
  }

  private bodyRun(nowMs: number): ClientUnit | null {
    const corpse = this.corpse
    const { world } = this.host
    if (corpse?.level !== world.areaId) return null
    const body = this.ownBody()
    if (body) {
      this.corpse = { level: corpse.level, x: body.x, y: body.y }
      this.bodySeen = nowMs
      return body
    }
    if (distance(corpse, world.self) <= CORPSE_GONE && nowMs - this.bodySeen > BODY_GONE_MS) {
      this.corpse = null
      this.toast('Got your body back', '', 'green')
    }
    return null
  }

  private recover(body: ClientUnit, nowMs: number): void {
    this.say('Picking up your body')
    if (distance(body, this.host.world.self) <= REACH) this.touch(body, nowMs)
    else this.walkTowards(body, nowMs)
  }

  private bossAhead(): string | null {
    const { world, guide } = this.host
    const plan = guide.currentPlan
    const target = plan?.target
    const near = target !== null && target !== undefined && distance(target, world.self) <= LAIRS.range
    const marks = new Set([...(plan?.step?.kind === 'portal' ? plan.step.find.flat() : []), ...(plan?.goal.find ?? []).flat()])
    const lair = Object.entries(LAIRS.levels).find(([, level]) => level === world.areaId)?.[0]
    const spot = near ? Object.entries(LAIRS.objects).find(([, classId]) => marks.has(classId))?.[0] : undefined
    return lair ?? spot ?? null
  }

  private prepareFor(nowMs: number): void {
    const { world, hudManager, assists } = this.host
    const boss = this.bossAhead()
    if (boss === null || nowMs - (this.prepared.get(boss) ?? Number.NEGATIVE_INFINITY) < LAIRS.lingerMs || !assists.hasTownPortal()) return
    if (this.potionsWanted() === 0 && world.self.life >= (hudManager.maxHp || world.self.maxLife) * RECOVERED_LIFE) return
    this.prepared.set(boss, nowMs)
    Object.assign(this, { trip: 'retreat', retreatWhy: `${PREP} ${boss}, heading to town` })
  }

  private assess(nowMs: number): void {
    const { world, guide } = this.host
    const plan = guide.currentPlan
    if (guide.detour === null && plan) this.questLevel = plan.goal.level
    if (nowMs - this.assessedAt < ASSESS_MS || this.corpse !== null || this.trip !== null || this.questLevel === null) return
    this.assessedAt = nowMs
    const me = this.trainee()
    const training = this.training
    if (training) {
      if (me.level >= training.level && me.gold >= training.gold) {
        this.training = null
        this.toast('Ready to carry on', `Heading back to ${levelName(this.questLevel)}`, 'green')
      }
      return
    }
    const setbacks = this.deaths.filter((death) => death.level === this.questLevel && nowMs - death.at < DEATH_MEMORY_MS).length
    const need = readiness(me, this.questLevel, setbacks)
    const ground = need && trainingGround(world.areaId, me, this.waypointLevels(), this.trainedOut)
    if (!need || ground === null) return
    this.training = { ...need, ground }
    this.toast(need.why, `In ${levelName(ground)}`, 'gold')
  }

  private trainee(): Trainee {
    const { world } = this.host
    return { level: world.self.level, gold: world.self.gold + world.self.stashGold, difficulty: world.difficulty }
  }

  private waypointLevels(): ReadonlySet<number> {
    return new Set([...this.host.world.waypoints].flatMap((id) => WAYPOINT_LEVELS.get(id) ?? []))
  }

  private trainingGoal(): Goal | null {
    const training = this.training
    return training && { level: training.ground, title: 'Training', hint: `${training.why} in ${levelName(training.ground)}` }
  }

  private train(nowMs: number): boolean {
    const training = this.training
    const view = this.host.levelView()
    if (!training || !view || this.host.world.areaId !== training.ground) return false
    if (this.exploreLevel(view, nowMs, `${training.why} in ${levelName(training.ground)}`)) return true
    this.trainedOut.add(training.ground)
    this.explored.delete(training.ground)
    const next = trainingGround(training.ground, this.trainee(), this.waypointLevels(), this.trainedOut)
    if (next === null) this.trainedOut.clear()
    this.training = { ...training, ground: next ?? training.ground }
    return true
  }

  private caution(nowMs: number): number {
    return Math.min(MAX_CAUTION, this.deaths.filter((death) => nowMs - death.at < DEATH_MEMORY_MS).length * DEATH_CAUTION)
  }

  private decide(nowMs: number): void {
    const { assists } = this.host
    this.refreshQuests(nowMs)
    const town = this.town()
    this.trip = town && this.trip === 'retreat' ? 'return' : !town && this.trip === 'return' ? null : this.trip
    if (this.trip === 'retreat' && !town && this.recovered() && !this.retreatWhy.startsWith(PREP)) this.trip = null
    if (!town && this.trip === null) this.prepareFor(nowMs)
    const danger = town ? null : this.trip === 'retreat' ? this.retreatWhy : this.danger(nowMs)
    this.assess(nowMs)
    this.host.guide.detour = this.corpseGoal() ?? this.trainingGoal()
    const body = town ? null : this.bodyRun(nowMs)
    assists.pilotCombat = assists.autoCombatKey !== null && danger === null && (body === null || this.cornered(nowMs))
    assists.standDown = danger !== null && !this.cornered(nowMs)
    assists.holdLoot = this.questInReach()
    if (danger === null) this.spend(nowMs)
    if (this.host.hudManager.leftPanel === 'waypoint' || this.host.hudManager.leftPanel === 'orifice') this.answerPanels(nowMs)
    else if (assists.dodging(nowMs)) this.say('Dodging')
    else if (this.keepCrossing(nowMs)) this.say(danger ?? 'Crossing over')
    else if (danger !== null) this.retreat(danger, nowMs)
    else if (body !== null && !this.cornered(nowMs)) this.recover(body, nowMs)
    else if (assists.isFighting(nowMs)) this.say('Fighting')
    else if (!this.questInReach() && this.looting(nowMs)) this.say('Picking up loot')
    else if (!this.answerPanels(nowMs)) this.carryOn(town, nowMs)
  }

  private carryOn(town: (typeof TOWNS)['Rogue Encampment'] | null, nowMs: number): void {
    const { assists, guide } = this.host
    const errand = town && !this.offTheGrid() ? this.nextErrand(town, nowMs) : null
    if (errand) this.run(errand, nowMs)
    else if (town && this.wounded()) this.say('Waiting to heal before heading out')
    else if (!(town && this.trip === 'return' && this.returnThroughPortal(nowMs)) && !(assists.smartSkills && assists.keepUp(null, nowMs)) && !(town === null && assists.pilotCombat && this.hunt(nowMs)) && !(town === null && this.grabWaypoint(nowMs)) && !(town === null && this.train(nowMs))) this.follow(guide.update(nowMs), nowMs)
  }

  private refreshQuests(nowMs: number): void {
    const hint = this.host.guide.currentPlan?.hint ?? ''
    if (this.questWatch.hint !== hint) this.questWatch = { hint, since: nowMs, asked: this.questWatch.asked }
    const stale = nowMs - this.questWatch.since >= QUEST_STALE_MS && nowMs - this.questWatch.asked >= QUEST_STALE_MS
    if (!stale || this.host.hudModel === null) return
    this.questWatch = { ...this.questWatch, asked: nowMs }
    this.host.hudModel.requestQuestData()
    this.host.assists.journal?.('quests', { hint })
  }

  private say(status: string): void {
    if (this.host.guide.pilotStatus !== status) this.host.assists.journal?.('status', { status })
    this.host.guide.pilotStatus = status
  }

  report(): Readonly<Record<string, unknown>> {
    const target = this.host.guide.currentPlan?.target
    return { on: this.active, trip: this.trip, job: this.job !== null, crossing: this.crossing !== null, trail: this.trail.map((spot) => spot.level), gap: this.levelGap(), potions: this.healingPotions(), target: target && [Math.round(target.x), Math.round(target.y), target.label], reaches: this.host.guide.reaches(this.host.world.self) }
  }

  private toast(title: string, detail: string, color: 'green' | 'tan' | 'red' | 'gold'): void {
    this.host.assists.journal?.('toast', { title, detail })
    this.host.hudManager.toasts.push({ title, detail, color }, performance.now())
  }

  private town(): (typeof TOWNS)['Rogue Encampment'] | null {
    return (TOWNS as Readonly<Record<string, (typeof TOWNS)['Rogue Encampment']>>)[levelName(this.host.world.areaId)] ?? null
  }

  private follow(plan: GuidePlan | null, nowMs: number): void {
    if (plan) this.pursue(plan, nowMs)
    else this.explore(nowMs, 'No route from here, exploring')
  }

  private pursue(plan: GuidePlan, nowMs: number): void {
    const { world, assists } = this.host
    const { target, step } = plan
    this.say(plan.hint)
    const door = plan.doors.map((id) => world.getUnit('object', id)).find((unit): unit is ClientUnit => unit !== undefined && isClosedDoor(unit) && distance(unit, world.self) <= REACH + 1)
    const unit = target?.unit && world.getUnit(target.unit.kind === 'object' ? 'object' : 'monster', target.unit.id)
    if (door) this.useOnce(door, nowMs)
    else if (target && !this.host.guide.reaches(world.self) && this.takePad(target, nowMs)) return
    else if (!target) this.explore(nowMs, plan.hint)
    else if (step?.kind === 'waypoint' && unit) {
      this.waypointTo = step.level
      this.reachThen(target, nowMs, () => this.useOnce(unit, nowMs))
    } else if (unit && target.unit.kind === 'npc' && !assists.isHostile(unit)) this.reachThen(target, nowMs, () => this.speakTo(unit, plan, nowMs))
    else if (unit && target.unit.kind === 'object') this.reachThen(target, nowMs, () => this.useOnce(unit, nowMs))
    else if (step?.kind === 'exit') this.exitThrough(target, nowMs)
    else if (distance(target, world.self) <= REACH) this.explore(nowMs, plan.hint)
    else this.walkRoute(nowMs)
  }

  private reachThen(target: GuideTarget, nowMs: number, then: () => void): void {
    if (distance(target, this.host.world.self) <= INTERACT_REACH) then()
    else this.walkRoute(nowMs)
  }

  private walkRoute(nowMs: number, found = this.host.guide.routeFrom(this.host.world.self)): void {
    const { world, assists } = this.host
    const me = world.self
    const goal = this.host.guide.currentPlan?.target
    const route = found.length >= 2 || !goal || distance(goal, me) <= REACH ? found : [me, goal]
    if (route.length < 2) return
    const door = this.doorAhead(route)
    if (door) {
      this.knock(door, nowMs)
      return
    }
    const blink = this.blink
    if (blink?.pending && nowMs - blink.at >= TELEPORT_MS) {
      const misses = distance(me, blink.from) < STUCK_MOVE ? blink.misses + 1 : 0
      this.blink = { ...blink, pending: false, misses, offUntil: misses >= TELEPORT_MISSES ? nowMs + TELEPORT_OFF_MS : blink.offUntil }
    }
    const teleport = !this.town() && me.mana >= (this.host.hudManager.maxMana || me.maxMana) * TELEPORT_MANA && assists.canCast(TELEPORT, nowMs) && nowMs >= (this.blink?.offUntil ?? 0)
    if (teleport) {
      const hop = alongLine(route, TELEPORT_AHEAD)
      if (!this.blink?.pending && assists.castAt(TELEPORT, hop.x, hop.y, nowMs)) this.blink = { at: nowMs, from: { x: me.x, y: me.y }, pending: true, misses: this.blink?.misses ?? 0, offUntil: 0 }
      return
    }
    this.watchProgress(nowMs)
    if (nowMs - this.lastWalk < WALK_MS && this.host.assists.moving) return
    const aim = alongLine(route, LOOKAHEAD)
    if (this.offTheGrid()) this.findGap(aim, nowMs)
    else {
      this.gapSearch = null
      assists.walkTo(aim.x, aim.y, nowMs)
    }
    this.lastWalk = nowMs
  }

  private findGap(aim: SubTilePoint, nowMs: number): void {
    const me = this.host.world.self
    const search = (this.gapSearch ??= { since: nowMs, from: { x: me.x, y: me.y } })
    const tries = Math.floor((nowMs - search.since) / GAP_MS)
    const length = Math.max(1e-6, distance(aim, search.from))
    const [nx, ny] = [(aim.x - search.from.x) / length, (aim.y - search.from.y) / length]
    const side = (tries % 2 === 1 ? 1 : -1) * Math.ceil((tries % (GAP_TRIES + 1)) / 2) * GAP_STEP
    this.host.assists.stepTo(search.from.x + nx * GAP_STEP - ny * side, search.from.y + ny * GAP_STEP + nx * side, nowMs)
  }

  private offTheGrid(): boolean {
    const view = this.host.levelView()
    const me = this.host.world.self
    const [gx, gy] = view ? [Math.round(me.x) - view.originX, Math.round(me.y) - view.originY] : [0, 0]
    return view !== null && gx >= 0 && gy >= 0 && gx < view.subWidth && gy < view.subHeight && view.walkable[gy * view.subWidth + gx] === 0
  }

  private watchProgress(nowMs: number): void {
    const me = this.host.world.self
    if (distance(me, this.progress) >= STUCK_MOVE || nowMs - this.progress.ms > STUCK_MS * 3) this.progress = { ms: nowMs, x: me.x, y: me.y }
    else if (nowMs - this.progress.ms > STUCK_MS) {
      const angle = Math.random() * Math.PI * 2
      this.host.assists.walkTo(me.x + Math.cos(angle) * 6, me.y + Math.sin(angle) * 6, nowMs)
      this.lastWalk = nowMs
      this.progress = { ms: nowMs, x: me.x, y: me.y }
    }
  }

  private exitThrough(target: GuideTarget, nowMs: number): void {
    const { world } = this.host
    const me = world.self
    const warp = world.getUnitsByType(5).filter((tile) => distance(tile, target) <= WARP_NEAR).sort((a, b) => distance(a, target) - distance(b, target))[0]
    if (warp && distance(warp, me) <= REACH + 2) this.useOnce(warp, nowMs)
    else if (warp || distance(target, me) > REACH) this.walkRoute(nowMs)
    else this.stepAcross(target, nowMs)
  }

  private stepAcross(target: GuideTarget, nowMs: number): void {
    const me = this.host.world.self
    const inward = this.host.levelView()?.entrances.find((entrance) => entrance.toLevelId === this.host.guide.currentPlan?.step?.level)
    const out = inward ? { x: inward.x - inward.interiorX, y: inward.y - inward.interiorY } : { x: target.x - me.x, y: target.y - me.y }
    const length = Math.max(1e-6, Math.hypot(out.x, out.y))
    this.cross({ x: target.x + (out.x / length) * SEAM_STEP, y: target.y + (out.y / length) * SEAM_STEP }, nowMs)
  }

  private cross(to: SubTilePoint, nowMs: number): void {
    this.crossing = { to, until: nowMs + CROSS_MS }
    this.keepCrossing(nowMs)
  }

  private keepCrossing(nowMs: number): boolean {
    const crossing = this.crossing
    if (!crossing || nowMs >= crossing.until || distance(crossing.to, this.host.world.self) <= STUCK_MOVE) {
      this.crossing = null
      return false
    }
    if (nowMs - this.lastWalk >= WALK_MS) {
      this.host.assists.stepTo(crossing.to.x, crossing.to.y, nowMs)
      this.lastWalk = nowMs
    }
    return true
  }

  private useOnce(unit: ClientUnit, nowMs: number): void {
    const used = this.uses.get(unit.id)
    if (used && nowMs - used.at < USE_MS) return
    if (used && used.tries >= USE_TRIES) this.giveUpOn(unit, nowMs)
    else {
      this.uses.set(unit.id, { at: nowMs, tries: (used?.tries ?? 0) + 1 })
      this.host.assists.use(unit, nowMs)
    }
  }

  private giveUpOn(unit: ClientUnit, nowMs: number): void {
    const plan = this.host.guide.currentPlan
    if (plan?.target?.unit?.id === unit.id) this.skip(plan, `${unit.name ?? 'It'} wouldn't respond`)
    else this.walkRoute(nowMs)
  }

  private speakTo(npc: ClientUnit, plan: GuidePlan, nowMs: number): void {
    const talk = this.talk
    const same = talk?.npcId === npc.id && talk.hint === plan.hint ? talk : null
    if (same?.spoke && nowMs - same.since > STUCK_TALK_MS) this.skip(plan, `Talking to ${npc.name ?? 'them'} didn't move it on`)
    else if (!same || (nowMs - same.at >= TALK_MS && !this.host.hudManager.worldPanels.npcMenu)) {
      this.talk = same ? Object.assign(same, { at: nowMs, opened: false }) : { npcId: npc.id, hint: plan.hint, since: nowMs, at: nowMs, spoke: false, opened: false, heard: new Set<string>() }
      this.host.assists.use(npc, nowMs)
    }
  }

  private skip(plan: GuidePlan, why: string): void {
    this.talk = null
    if (plan.goal.row === undefined) this.stop('Autopilot needs you', 'gold', plan.hint)
    else {
      this.host.guide.skip(plan.goal.row)
      this.toast(`Skipping ${plan.goal.title} for now`, why, 'gold')
    }
  }

  private answerPanels(nowMs: number): boolean {
    const { hudManager, hudModel, world } = this.host
    if (hudModel === null) return false
    const wp = hudManager.worldPanels
    if (hudManager.leftPanel === 'orifice') {
      this.offerStaff()
      return true
    }
    if (hudManager.leftPanel === 'waypoint') {
      if (this.waypointTo !== null && this.waypointTo !== world.areaId) hudModel.teleportToLevel(this.waypointTo)
      else hudModel.closeWaypoint()
      this.waypointTo = null
      return true
    }
    const menu = wp.npcMenu
    const talk = this.talk
    const ours = menu !== null && talk !== null && (menu.npcUnitId ?? menu.npcId ?? 0) === talk.npcId ? talk : null
    const ids = (menu?.options ?? []).map((option) => option.id)
    const service = ours && ARTISANS.find((kind) => ids.includes(kind) && !this.served.has(kind))
    if (ours && service) {
      this.served.add(service)
      this.serve(service, ours.npcId)
      return true
    }
    const topic = ours && (ids.find((id) => TRAVEL_OPTIONS.includes(id)) ?? ids.find((id) => id.startsWith('talk_quest') && !ours.heard.has(id)) ?? (!ours.opened && menu?.submenu !== 'talk' && ids.includes('talk') ? 'talk' : undefined))
    if (menu && ours && topic) {
      if (topic === 'talk') ours.opened = true
      else Object.assign(ours, { spoke: true, at: nowMs }).heard.add(topic)
      wp.clickNpcMenuOption(topic, menu.context)
      return true
    }
    if (wp.npcSpeech) {
      if (!talk || nowMs - talk.at >= SPEECH_SKIP_MS) wp.closeNpcSpeech()
      return true
    }
    if (!menu) return false
    if (talk) Object.assign(talk, { spoke: true })
    hudModel.closeActiveNpcPanel()
    hudModel.requestQuestData()
    return true
  }

  private explore(nowMs: number, status: string): void {
    const view = this.host.levelView()
    if (!view || this.town()) this.say(status)
    else this.exploreLevel(view, nowMs, status)
  }

  private exploreLevel(view: LevelView, nowMs: number, status: string): boolean {
    const { world, assists } = this.host
    const visited = this.explored.get(view.id) ?? new Set<number>()
    this.explored.set(view.id, visited)
    const me = world.self
    const centre = (room: LevelView['rooms'][number]) => ({ x: room.worldSubX + room.subW / 2, y: room.worldSubY + room.subH / 2 })
    view.rooms.filter((room) => distance(centre(room), me) <= Math.max(room.subW, room.subH) / 2 + ROOM_REACHED).forEach((room) => visited.add(room.index))
    const here = this.padField(view, nowMs)
    const walk = (room: LevelView['rooms'][number]) => {
      const entry = here.pathFrom(centre(room).x, centre(room).y, 1, 1)[0]
      return (entry ? here.distanceFrom(entry.x, entry.y) : null) ?? distance(centre(room), me) + UNREACHED_ROOM
    }
    const next = view.rooms.filter((room) => !visited.has(room.index)).map((room) => ({ room, cost: walk(room) })).sort((a, b) => a.cost - b.cost)[0]?.room
    this.say(next ? status : `${status} (explored everything)`)
    if (!next) return false
    const goal = centre(next)
    const key = `${view.id}:${next.index}`
    if (this.exploreField?.key !== key) this.exploreField = { key, field: new FlowField({ ...view, walkable: assists.walkableWithDoorsOpen(view) }, goal.x, goal.y) }
    const field = this.exploreField.field
    const path = field.pathFrom(me.x, me.y, 1, 40)
    if (path.length <= ROOM_END) visited.add(next.index)
    else this.walkRoute(nowMs, [me, ...field.corners(path, me)])
    this.host.guide.focus(goal, nowMs)
    return true
  }

  private noteArea(): void {
    const { world } = this.host
    const { areaId, self } = world
    const last = this.lastSpot
    if (last && last.level !== areaId) {
      const back = this.trail.findIndex((spot) => spot.level === areaId)
      const resumed = this.trail.length === 0 && this.leftBehind.at(-1)?.level === areaId
      if (this.town()) [this.leftBehind, this.trail] = [this.trail.length > 0 ? this.trail : this.leftBehind, []]
      else this.trail = resumed ? this.leftBehind : back >= 0 ? this.trail.slice(0, back + 1) : [...this.trail, { level: areaId, at: { x: self.x, y: self.y }, before: { x: last.x, y: last.y } }]
    }
    this.lastSpot = { level: areaId, x: self.x, y: self.y }
  }

  private danger(nowMs: number): string | null {
    const { world, hudManager } = this.host
    const me = world.self
    const life = me.life / (hudManager.maxHp || me.maxLife)
    const healing = this.healingPotions()
    const stocked = healing >= STOCKED_POTIONS
    this.lifeLog = [...this.lifeLog.filter((entry) => nowMs - entry.at <= BURST_MS), { at: nowMs, life }]
    const burst = Math.max(...this.lifeLog.map((entry) => entry.life)) - life
    const retreatAt = Math.min(MAX_RETREAT_LIFE, Math.max(MIN_RETREAT_LIFE, RETREAT_LIFE + this.levelGap() * GAP_CAUTION - (stocked ? STOCKED_NERVE : 0))) + this.caution(nowMs)
    const doomedIn = burst > DOOM_MIN_LOSS ? (life * BURST_MS) / burst : Infinity
    if (life < retreatAt) return 'Low on life, heading to town'
    if (doomedIn < DOOM_MS) return 'Taking a beating, heading to town'
    if (healing === 0 && life < DRY_LIFE) return 'Out of healing potions, heading to town'
    return (!stocked && burst >= BURST_LOSS && life < DRY_LIFE) || (healing <= 1 && life < LAST_POTION_LIFE) ? 'Taking a beating, heading to town' : null
  }

  private cornered(nowMs: number): boolean {
    const { world, assists } = this.host
    const me = world.self
    if (distance(me, this.stall) >= STALL_MOVE) this.stall = { x: me.x, y: me.y, at: nowMs }
    return nowMs - this.stall.at >= STALL_MS && world.getUnitsByType(1).some((unit) => !unit.dead && assists.isHostile(unit) && distance(unit, me) <= KITE_NEAR)
  }

  private doorAhead(route: readonly SubTilePoint[]): ClientUnit | undefined {
    const me = this.host.world.self
    const ahead = route.filter((point) => distance(point, me) <= DOOR_LOOKAHEAD)
    return this.host.world.getUnitsByType(2).find((unit) => isClosedDoor(unit) && (this.uses.get(unit.id)?.tries ?? 0) < USE_TRIES && distance(unit, me) <= DOOR_NEAR && ahead.some((point) => distance(point, unit) <= DOOR_ON_ROUTE))
  }

  private grabWaypoint(nowMs: number): boolean {
    const { world, guide } = this.host
    const me = world.self
    if (guide.knowsWaypointIn(world.areaId)) return false
    const waypoint = world.getUnitsByType(2).find((unit) => WAYPOINT_CLASS_IDS_113C.has(unit.classId) && distance(unit, me) <= WAYPOINT_GRAB && (this.uses.get(unit.id)?.tries ?? 0) < USE_TRIES)
    if (!waypoint) return false
    this.say('Activating the waypoint')
    if (distance(waypoint, me) <= INTERACT_REACH) this.knock(waypoint, nowMs)
    else this.walkTowards(waypoint, nowMs)
    return true
  }

  private takePad(target: SubTilePoint, nowMs: number): boolean {
    const { world } = this.host
    const view = this.host.levelView()
    const me = world.self
    if (!view) return false
    const here = this.padField(view, nowMs)
    const reachable = (pad: SubTilePoint) => distance(pad, me) <= INTERACT_REACH || here.pathFrom(pad.x, pad.y, 1, 1).length > 0
    const spots = this.padSpots(view)
    const free = (spot: (typeof spots)[number]) => !this.padUsed(spot, nowMs) && reachable(spot)
    const regions = this.regionsOf(view)
    const pad = firstPad(regions, spots, me, target, (spot) => this.landingOf(spot, spots, regions), free) ?? spots.filter(free).sort((a, b) => distance(a, target) - distance(b, target))[0]
    if (!pad) return false
    this.say('Taking the teleport pad')
    if (!pad.unit || distance(pad, me) > INTERACT_REACH) this.walkTowards(pad, nowMs)
    else {
      this.banPad(pad, nowMs)
      this.padFrom = { x: me.x, y: me.y, at: nowMs, pad }
      this.touch(pad.unit, nowMs)
    }
    return true
  }

  private regionsOf(view: LevelView): Regions {
    if (this.regions?.level !== view.id) this.regions = { level: view.id, regions: new Regions(view) }
    return this.regions.regions
  }

  private landingOf<P extends Pad>(pad: P, pads: readonly P[], regions: Regions): P | undefined {
    const landed = this.landings.get(padKey(pad))
    return landed ? pads.find((other) => distance(other, landed) <= PAD_SAME) : guessPartner(pad, pads, regions)
  }

  private padSpots(view: LevelView): { readonly x: number; readonly y: number; readonly classId: number; readonly unit?: ClientUnit }[] {
    const live = this.host.world.getUnitsByType(2).filter((unit) => PAD_CLASSES.has(unit.classId)).map((unit) => ({ x: unit.x, y: unit.y, classId: unit.classId, unit }))
    const preset = view.presetUnits.filter((u) => u.type === 2 && PAD_CLASSES.has(u.index)).map((u) => ({ x: view.originX + u.subX, y: view.originY + u.subY, classId: u.index }))
    return [...live, ...preset.filter((spot) => !live.some((pad) => distance(pad, spot) <= PAD_SAME))]
  }

  private padUsed(spot: SubTilePoint, nowMs: number): boolean {
    return this.padsUsed.some((used) => used.until > nowMs && distance(used, spot) <= PAD_SAME)
  }

  private banPad(spot: SubTilePoint, nowMs: number): void {
    this.padsUsed = [...this.padsUsed.filter((used) => used.until > nowMs), { x: spot.x, y: spot.y, until: nowMs + PAD_REUSE_MS }]
  }

  private padField(view: LevelView, nowMs: number): FlowField {
    const me = this.host.world.self
    const key = `${view.id}:${Math.round(me.x / PAD_FIELD_CELL)}:${Math.round(me.y / PAD_FIELD_CELL)}`
    if (this.padCache?.key !== key || nowMs - this.padCache.at > PAD_FIELD_MS) this.padCache = { key, at: nowMs, field: new FlowField({ ...view, walkable: this.host.assists.walkableWithDoorsOpen(view) }, me.x, me.y) }
    return this.padCache.field
  }

  private noteArrival(nowMs: number): void {
    const from = this.padFrom
    const me = this.host.world.self
    if (!from || nowMs - from.at > PAD_ARRIVAL_MS || distance(from, me) < PAD_JUMP) return
    this.padFrom = null
    const view = this.host.levelView()
    const arrived = view ? this.padSpots(view).filter((spot) => distance(spot, me) <= PAD_ARRIVAL_NEAR) : []
    arrived.forEach((spot) => this.banPad(spot, nowMs))
    const landing = arrived.sort((a, b) => distance(a, me) - distance(b, me))[0]
    if (landing) this.landings.set(padKey(from.pad), landing)
  }

  private knock(door: ClientUnit, nowMs: number): void {
    const used = this.uses.get(door.id)
    if (used && nowMs - used.at < USE_MS) return
    this.uses.set(door.id, { at: nowMs, tries: (used?.tries ?? 0) + 1 })
    this.host.assists.use(door, nowMs)
  }

  private looting(nowMs: number): boolean {
    const { assists } = this.host
    if (assists.inventoryCare.busy || assists.hasLootNearby(nowMs)) this.lootUntil = nowMs + LOOT_SETTLE_MS
    return nowMs < this.lootUntil
  }

  private questInReach(): boolean {
    const target = this.host.guide.currentPlan?.target
    return target?.unit?.kind === 'object' && distance(target, this.host.world.self) <= QUEST_FOCUS
  }

  private recovered(): boolean {
    const { world, hudManager } = this.host
    return world.self.life >= (hudManager.maxHp || world.self.maxLife) * RECOVERED_LIFE && this.healingPotions() >= HUNT_POTIONS
  }

  private wounded(): boolean {
    const { world, hudManager } = this.host
    return world.self.life < (hudManager.maxHp || world.self.maxLife) * HEAL_LIFE
  }

  private healingPotions(): number {
    const { belt, inventory } = this.host.world.containers
    return [...belt.values(), ...inventory.values()].filter((item) => /^(hp|rv)/.test(item.code)).length
  }

  private ignore(unit: ClientUnit, nowMs: number): boolean {
    this.ignored.set(unit.id, nowMs + HUNT_IGNORE_MS)
    return true
  }

  private levelGap(): number {
    const { world } = this.host
    return getLevelMonsterLevel113c(world.areaId, world.difficulty) - world.self.level
  }

  private hunt(nowMs: number): boolean {
    const { world, hudManager, assists } = this.host
    const me = world.self
    const bold = me.life >= (hudManager.maxHp || me.maxLife) * HUNT_LIFE && this.healingPotions() >= HUNT_POTIONS && this.levelGap() <= HUNT_GAP && this.caution(nowMs) < HUNT_CAUTION && this.corpse === null
    const chased = this.chase && world.getUnit('monster', this.chase.id)
    const huntable = (unit: ClientUnit) => !unit.dead && assists.isHostile(unit) && distance(unit, me) <= HUNT_RADIUS && (this.ignored.get(unit.id) ?? 0) <= nowMs
    const hostiles = world.getUnitsByType(1).filter(huntable)
    const worth = (unit: ClientUnit) => distance(unit, me) - (isElite(unit) ? ELITE_PULL : 0) - PACK_PULL * hostiles.filter((other) => other !== unit && distance(other, unit) <= PACK_RADIUS).length
    const fresh = () => [...hostiles].sort((a, b) => worth(a) - worth(b)).find((unit) => assists.canReach(unit, nowMs) || !this.ignore(unit, nowMs))
    const prey = bold ? (chased && huntable(chased) ? chased : fresh()) : undefined
    if (!prey) {
      this.chase = null
      return false
    }
    const chase = this.chase?.id === prey.id ? this.chase : (this.chase = { id: prey.id, since: nowMs })
    if (nowMs - chase.since > HUNT_MS) {
      this.ignored.set(prey.id, nowMs + HUNT_IGNORE_MS)
      return false
    }
    this.say(`Hunting ${prey.name ?? 'monsters'}`)
    this.walkTowards(prey, nowMs)
    return true
  }

  private retreat(why: string, nowMs: number): void {
    const { world, assists } = this.host
    const me = world.self
    Object.assign(this, { trip: 'retreat', retreatWhy: why })
    this.say(why)
    const threats = world.getUnitsByType(1).filter((unit) => !unit.dead && assists.isHostile(unit) && distance(unit, me) <= KITE_NEAR)
    this.kiteSince = threats.length === 0 ? null : (this.kiteSince ?? nowMs)
    const portal = world.getUnitsByType(2).find((unit) => unit.classId === TOWN_PORTAL_CLASS && distance(unit, me) <= PORTAL_REACH)
    if (portal) this.touch(portal, nowMs)
    else if (threats.length > 0 && nowMs - this.kiteSince! < KITE_MS && this.kite(threats, nowMs)) return
    else if (assists.hasTownPortal()) this.castPortal(nowMs)
    else this.walkHome(nowMs)
  }

  private touch(unit: ClientUnit, nowMs: number): void {
    if (nowMs - (this.uses.get(unit.id)?.at ?? Number.NEGATIVE_INFINITY) < USE_MS) return
    this.uses.set(unit.id, { at: nowMs, tries: 0 })
    this.host.assists.use(unit, nowMs)
  }

  private castPortal(nowMs: number): void {
    if (nowMs - (this.errandsAt.get('portal') ?? Number.NEGATIVE_INFINITY) <= USE_MS * 2) return
    this.errandsAt.set('portal', nowMs)
    this.host.assists.castTownPortal()
  }

  private kite(threats: readonly ClientUnit[], nowMs: number): boolean {
    const view = this.host.levelView()
    if (!view) return false
    const me = this.host.world.self
    const walkable = this.host.assists.walkableWithDoorsOpen(view)
    const open = ({ x, y }: SubTilePoint) => {
      const [gx, gy] = [Math.round(x) - view.originX, Math.round(y) - view.originY]
      return gx >= 0 && gy >= 0 && gx < view.subWidth && gy < view.subHeight && walkable[gy * view.subWidth + gx] !== 0
    }
    const gap = (spot: SubTilePoint) => Math.min(...threats.map((threat) => distance(threat, spot)))
    const safest = Array.from({ length: 16 }, (_, i) => ({ x: me.x + Math.cos((i * Math.PI) / 8) * KITE_STEP, y: me.y + Math.sin((i * Math.PI) / 8) * KITE_STEP }))
      .filter((spot) => open(spot) && open({ x: (spot.x + me.x) / 2, y: (spot.y + me.y) / 2 }))
      .sort((a, b) => gap(b) - gap(a))[0]
    if (!safest || gap(safest) <= gap(me)) return false
    if (nowMs - this.lastWalk >= WALK_MS) {
      this.host.assists.walkTo(safest.x, safest.y, nowMs)
      this.lastWalk = nowMs
    }
    return true
  }

  private walkHome(nowMs: number): void {
    const me = this.host.world.self
    const here = this.trail.at(-1)
    if (here?.level !== this.host.world.areaId) this.homeByWaypoint(nowMs)
    else if (distance(here.at, me) > REACH) this.walkTowards(here.at, nowMs)
    else this.leaveBy(here, nowMs)
  }

  private leaveBy(here: (typeof this.trail)[number], nowMs: number): void {
    const { world } = this.host
    const near = (unit: ClientUnit) => distance(unit, here.at) <= WARP_NEAR
    const way = [...world.getUnitsByType(2).filter((unit) => unit.classId === TOWN_PORTAL_CLASS || WAYPOINT_CLASS_IDS_113C.has(unit.classId)), ...world.getUnitsByType(5)].find(near)
    const across = { x: here.before.x - here.at.x, y: here.before.y - here.at.y }
    const length = Math.hypot(across.x, across.y)
    if (way) this.takeHome(way, nowMs)
    else if (length > SEAM_JUMP || length < 1e-6) this.homeByWaypoint(nowMs)
    else this.cross({ x: here.at.x + (across.x / length) * SEAM_STEP, y: here.at.y + (across.y / length) * SEAM_STEP }, nowMs)
  }

  private takeHome(way: ClientUnit, nowMs: number): void {
    if (WAYPOINT_CLASS_IDS_113C.has(way.classId)) this.waypointTo = ACT_TOWNS[actOfLevel(this.host.world.areaId)]!
    if (distance(way, this.host.world.self) <= REACH) this.touch(way, nowMs)
    else this.walkTowards(way, nowMs)
  }

  private homeByWaypoint(nowMs: number): void {
    const { world } = this.host
    const view = this.host.levelView()
    const seen = world.getUnitsByType(2).find((unit) => WAYPOINT_CLASS_IDS_113C.has(unit.classId))
    const preset = view?.presetUnits.find((unit) => unit.type === 2 && WAYPOINT_CLASS_IDS_113C.has(unit.index))
    if (seen) this.takeHome(seen, nowMs)
    else if (view && preset) this.walkTowards({ x: view.originX + preset.subX, y: view.originY + preset.subY }, nowMs)
    else {
      this.trip = null
      this.stop('Autopilot needs you', 'red', 'Low on life with no town portal or way back')
    }
  }

  private spend(nowMs: number): void {
    const { world, hudManager, hudModel } = this.host
    const build = buildOf(world.self.charClass)
    if (!this.spendPoints || build === null || hudModel === null || nowMs - this.lastSpend < SPEND_MS) return
    const tree = hudManager.skillTree
    const attrs = hudManager.charSheet.attrs
    const skill = tree.unspentSkillPoints > 0 ? nextSkill(build, (id) => tree.getHardPoints(id), (id) => tree.canAllocate(id)) : null
    const stat = attrs.statPoints > 0 ? nextStat(build, { str: attrs.baseStr ?? 0, dex: attrs.baseDex ?? 0, vit: attrs.baseVit ?? 0, ene: attrs.baseEne ?? 0 }) : null
    if (skill !== null) hudModel.allocateSkill(skill)
    else if (stat !== null) hudModel.allocateStat(stat)
    else return
    this.lastSpend = nowMs
  }

  private returnThroughPortal(nowMs: number): boolean {
    const { world } = this.host
    const portal = world.getUnitsByType(2).filter((unit) => unit.classId === TOWN_PORTAL_CLASS).sort((a, b) => distance(a, world.self) - distance(b, world.self))[0]
    if (!portal) {
      this.trip = null
      return false
    }
    this.say('Back through the portal')
    if (distance(portal, world.self) <= REACH) this.useOnce(portal, nowMs)
    else this.walkTowards(portal, nowMs)
    return true
  }

  private nextErrand(town: (typeof TOWNS)['Rogue Encampment'], nowMs: number): Errand | null {
    const { world, hudManager, assists } = this.host
    const me = world.self
    const care = assists.inventoryCare
    const dry = this.healingPotions() === 0
    const cooldown = (key: string) => (key === 'heal' ? HEAL_COOLDOWN_MS : (key === 'potions' && dry) || key === 'cube' ? RESTOCK_COOLDOWN_MS : ERRAND_COOLDOWN_MS)
    const ready = (key: string) => nowMs - (this.errandsAt.get(key) ?? Number.NEGATIVE_INFINITY) >= cooldown(key)
    const wounded = me.life < (hudManager.maxHp || me.maxLife) * HEAL_LIFE || me.mana < (hudManager.maxMana || me.maxMana) * HEAL_MANA
    const merc = world.merc
    const worn = [...world.containers.equipment.values()].some((item) => (item.maxDurability ?? 0) > 0 && (item.curDurability ?? item.durability ?? 0) < (item.maxDurability ?? 0) * REPAIR_BELOW)
    const recipe = readyRecipe(world)
    const errands: readonly (Errand | false)[] = [
      wounded && ready('heal') && { key: 'heal', reason: 'Healing up', npc: 'healer' },
      Boolean(merc?.isDead) && (merc?.reviveCost ?? Infinity) <= me.gold && ready('mercs') && { key: 'mercs', reason: 'Reviving your mercenary', npc: 'mercs', action: 'resurrect' },
      worn && ready('repair') && { key: 'repair', reason: 'Repairing gear', npc: 'repair', action: 'trade_repair', work: () => this.repairAndShop() },
      me.gold >= SHOP_GOLD && ready('shop') && { key: 'shop', reason: 'Looking for better gear at the smith', npc: 'repair', action: 'trade_repair', work: () => this.buyUpgrade() },
      (this.scrollsWanted('portal') > 0 && me.gold >= SCROLL_GOLD) || (this.potionsWanted() > 0 && me.gold >= POTION_GOLD) || (care.config?.sellJunk === true && care.junk.length + care.clutter.length > 0)
        ? ready('potions') && { key: 'potions', reason: 'Buying potions and portals', npc: 'potions', action: 'trade', work: () => this.restock() }
        : false,
      this.storedQuestItem() !== null && ready('fetch') && { key: 'fetch', reason: 'Taking the quest item out of storage', work: () => this.fetch(this.storedQuestItem()!) },
      recipe !== null && ready('cube') && { key: 'cube', reason: `Making ${recipe.name} in the Horadric Cube`, work: () => this.cube(recipe) },
      care.upgrades.length > 0 && ready('gear') && { key: 'gear', reason: 'Putting on better gear', work: () => care.wearUpgrades() },
      this.unidentified().length > 0 && scrollSource(world.containers.inventory.values(), 'ibk', 'isc') !== null && ready('identify') && { key: 'identify', reason: 'Identifying items', work: () => this.identifyAll() },
      care.config?.stashValuables === true && care.stashable.length > 0 && ready('stash') && { key: 'stash', reason: 'Stashing valuables', stash: true },
    ]
    const errand = errands.find((e): e is Errand => e !== false) ?? null
    return errand && (errand.npc === undefined || town[errand.npc]) ? errand : null
  }

  private run(errand: Errand, nowMs: number): void {
    this.errandsAt.set(errand.key, nowMs)
    this.say(errand.reason)
    this.job = this.errand(errand)
      .catch(() => undefined)
      .finally(() => {
        this.job = null
      })
  }

  private storedQuestItem(): string | null {
    const code = this.host.guide.currentPlan?.goal.bring
    const { inventory, stash, cube } = this.host.world.containers
    const has = (items: ReadonlyMap<number, { readonly code: string }>) => [...items.values()].some((item) => item.code.trim() === code)
    return code !== undefined && !has(inventory) && (has(stash) || has(cube)) ? code : null
  }

  private async fetch(code: string): Promise<void> {
    const { world, hudManager, hudModel } = this.host
    if (hudModel === null) return
    const host = { world, hudManager, hudModel }
    const inCube = [...world.containers.cube.values()].some((item) => item.code.trim() === code)
    const stored = [code, ...(inCube ? [CUBE_CODE] : [])].filter((wanted) => [...world.containers.stash.values()].some((item) => item.code.trim() === wanted))
    if (stored.length > 0) {
      const stash = await this.reach(() => world.getUnitsByType(2).find((unit) => unit.classId === STASH_CLASS), { key: 'fetch', reason: '', stash: true })
      if (!stash) return
      this.host.assists.use(stash, performance.now())
      if (!(await waitFor(() => hudManager.leftPanel === 'stash', 6000))) return
      const taken = await withdraw(host, stored)
      hudModel.closeStash()
      if (!taken) return
    }
    if (inCube) await takeOut(host, code)
  }

  private offerStaff(): void {
    const { world, hudManager, hudModel } = this.host
    const staff = [...world.containers.inventory.values()].find((item) => item.code.trim() === STAFF_CODE)
    if (hudModel === null || !staff) {
      hudModel?.closeHoradricOrifice()
      return
    }
    this.say('Placing the Horadric Staff')
    this.job = (async () => {
      hudModel.pickupItemToCursor(staff.id)
      if (await waitFor(() => world.containers.cursor?.id === staff.id, 3000)) hudModel.confirmQuestReward(staff.id)
      await waitFor(() => hudManager.leftPanel !== 'orifice', 4000)
      hudModel.requestQuestData()
    })()
      .catch(() => undefined)
      .finally(() => {
        this.job = null
      })
  }

  private async cube({ recipe, inStash }: ReadyRecipe): Promise<void> {
    const { world, hudManager, hudModel } = this.host
    if (hudModel === null) return
    const host = { world, hudManager, hudModel }
    this.host.assists.journal?.('cube', { makes: recipe.makes, inStash })
    if (inStash.length > 0) {
      const stash = await this.reach(() => world.getUnitsByType(2).find((unit) => unit.classId === STASH_CLASS), { key: 'cube', reason: '', stash: true })
      if (!stash) return
      this.host.assists.use(stash, performance.now())
      if (!(await waitFor(() => hudManager.leftPanel === 'stash', 6000))) return
      const taken = await withdraw(host, inStash)
      hudModel.closeStash()
      if (!taken) return
    }
    const made = await transmute(host, recipe)
    this.toast(made ? 'Transmuted in the Horadric Cube' : "Couldn't use the Horadric Cube", made ? recipe.makes : 'Try it by hand', made ? 'green' : 'gold')
    hudModel.requestQuestData()
  }

  private serve(kind: ArtisanKind, npcId: number): void {
    const { world, hudManager, hudModel } = this.host
    if (hudModel === null) return
    this.say(kind === 'imbue' ? 'Imbuing your best white item' : 'Socketing your best item')
    this.job = useArtisan({ world, hudManager, hudModel }, kind, npcId)
      .then((item) => {
        this.toast(item ? (kind === 'imbue' ? 'Imbued an item' : 'Socketed an item') : 'Nothing worth using the reward on', item?.code.trim() ?? 'Saving it for later', item ? 'green' : 'gold')
        hudModel.requestQuestData()
      })
      .catch(() => undefined)
      .finally(() => {
        this.job = null
      })
  }

  private async errand(errand: Errand): Promise<void> {
    const { world, hudManager, hudModel } = this.host
    const town = this.town()
    if (!town || hudModel === null) return
    if (!errand.npc && !errand.stash) {
      await errand.work?.()
      return
    }
    const find = errand.stash ? () => world.getUnitsByType(2).find((unit) => unit.classId === STASH_CLASS) : () => world.getUnitsByType(1).find((unit) => unit.classId === MONSTER_PATH_IDS.indexOf(town[errand.npc!]))
    const unit = await this.reach(find, errand)
    if (!unit || !this.active) return
    this.host.assists.use(unit, performance.now())
    if (errand.stash) {
      if (!(await waitFor(() => hudManager.leftPanel === 'stash', 6000))) return
      await waitFor(() => this.host.assists.inventoryCare.busy, CARE_START_MS)
      await waitFor(() => !this.host.assists.inventoryCare.busy, 20000)
      hudModel.closeStash()
      return
    }
    if (!(await waitFor(() => Boolean(hudManager.worldPanels.npcMenu) || Boolean(hudManager.worldPanels.npcSpeech), 6000))) return
    if (hudManager.worldPanels.npcSpeech) hudManager.worldPanels.closeNpcSpeech()
    if (errand.action) {
      hudModel.handleNpcMenuAction(errand.action, unit.id)
      await waitFor(() => hudManager.leftPanel === 'vendor' || !hudManager.worldPanels.npcMenu, 5000)
      await waitFor(() => this.host.assists.inventoryCare.busy, CARE_START_MS)
      await waitFor(() => !this.host.assists.inventoryCare.busy, 20000)
      await errand.work?.()
    }
    hudModel.closeActiveNpcPanel()
  }

  private async reach(find: () => ClientUnit | undefined, errand: Errand): Promise<ClientUnit | null> {
    const deadline = performance.now() + ERRAND_TIMEOUT_MS
    const preset = this.presetOf(errand)
    while (this.active && this.town() !== null && !this.host.assists.playerSteering && performance.now() < deadline) {
      const unit = find()
      const goal = unit ?? preset
      if (!goal) return null
      if (unit && distance(unit, this.host.world.self) <= REACH) return unit
      this.walkTowards(goal, performance.now())
      await new Promise((resolve) => setTimeout(resolve, TICK_MS * 2))
    }
    return null
  }

  private presetOf(errand: Errand): SubTilePoint | null {
    const view = this.host.levelView()
    const town = this.town()
    if (!view || !town) return null
    const preset = view.presetUnits.find((u) => (errand.stash ? u.type === 2 && u.index === STASH_CLASS : u.type === 1 && u.index === MONSTER_PATH_IDS.indexOf(town[errand.npc!])))
    return preset ? { x: view.originX + preset.subX, y: view.originY + preset.subY } : null
  }

  private walkTowards(goal: SubTilePoint, nowMs: number): void {
    const view = this.host.levelView()
    if (!view) return
    this.host.guide.focus(goal, nowMs)
    const me = this.host.world.self
    const key = `walk:${Math.round(goal.x)},${Math.round(goal.y)}`
    if (this.exploreField?.key !== key) this.exploreField = { key, field: new FlowField({ ...view, walkable: this.host.assists.walkableWithDoorsOpen(view) }, goal.x, goal.y) }
    const field = this.exploreField.field
    const path = field.pathFrom(me.x, me.y, 1, 40)
    this.walkRoute(nowMs, path.length > 0 ? [me, ...field.corners(path, me)] : [me, goal])
  }

  private potionsWanted(): number {
    const { world, hudManager } = this.host
    const rows = hudManager.belt.maxRows
    const [healing, mana] = POTION_COLUMNS[this.isCaster() ? 'caster' : 'melee']
    const count = (prefix: string) => [...world.containers.belt.values()].filter((item) => item.code.startsWith(prefix)).length
    const free = rows * 4 - world.containers.belt.size
    return Math.min(free, Math.max(0, healing * rows - count('hp')) + Math.max(0, mana * rows - count('mp')))
  }

  private scrollsWanted(kind: keyof typeof SCROLL_KINDS): number {
    const { tome: tomeCode, scroll, keep, spare } = SCROLL_KINDS[kind]
    const { tome, scrolls } = scrollsCarried(this.host.world.containers.inventory.values(), tomeCode, scroll)
    return Math.max(0, (tome ? keep : spare) - scrolls)
  }

  private async restock(): Promise<void> {
    await this.buyScroll('portal')
    await this.buyPotions()
    await this.topUp('portal', BUY_TRIES)
    await this.buyScroll('identify')
    await this.topUp('identify', BUY_TRIES)
    await this.buyUpgrade()
  }

  private async repairAndShop(): Promise<void> {
    await this.repair()
    await this.buyUpgrade()
  }

  private async buyUpgrade(): Promise<void> {
    const { world, hudManager, hudModel, assists } = this.host
    const npcId = world.npcInteraction.npcId
    const npc = npcId === null ? undefined : world.getUnit('monster', npcId)
    if (hudModel === null || hudManager.leftPanel !== 'vendor' || !npc) return
    const budget = world.self.gold - SPARE_GOLD
    const price = (item: ItemData) => {
      try {
        return vendorPrice113c(item, 0, { world, npcClass: npc.classId })
      } catch {
        return Infinity
      }
    }
    const fits = (item: ItemData) => freeSpots(world.containers.inventory.values(), item.invWidth, item.invHeight).length > 0
    const pick = [...world.containers.shop.values()]
      .map((item) => ({ item, appraisal: assists.inventoryCare.appraise(item), cost: price(item) }))
      .filter(({ item, appraisal, cost }) => appraisal.upgradeSlot !== undefined && cost <= budget && fits(item))
      .sort((a, b) => b.appraisal.score / Math.max(1, b.cost) - a.appraisal.score / Math.max(1, a.cost))[0]
    const before = world.self.gold
    if (!pick || !hudModel.vendorBuy(pick.item.id, false) || !(await waitFor(() => world.self.gold < before, 1500))) return
    this.toast('Bought better gear', pick.appraisal.reason, 'green')
  }

  private async topUp(kind: keyof typeof SCROLL_KINDS, tries: number): Promise<void> {
    if (tries > 0 && (await this.buyScroll(kind))) await this.topUp(kind, tries - 1)
  }

  private async buyScroll(kind: keyof typeof SCROLL_KINDS): Promise<boolean> {
    const { world, hudManager, hudModel } = this.host
    const { tome: tomeCode, scroll, tomeGold } = SCROLL_KINDS[kind]
    const { tome } = scrollsCarried(world.containers.inventory.values(), tomeCode, scroll)
    const code = tome ? scroll : world.self.gold >= tomeGold ? tomeCode : kind === 'portal' ? scroll : null
    const ware = [...world.containers.shop.values()].find((item) => item.code.trim() === code)
    const before = world.self.gold
    const wanted = code === tomeCode || this.scrollsWanted(kind) > 0
    if (hudModel === null || hudManager.leftPanel !== 'vendor' || !ware || !wanted) return false
    return hudModel.vendorBuy(ware.id, false) && waitFor(() => world.self.gold < before, 1500)
  }

  private unidentified(): ItemData[] {
    return [...this.host.world.containers.inventory.values()].filter((item) => !item.identified)
  }

  private async identifyAll(): Promise<void> {
    const { world, hudManager, hudModel } = this.host
    for (const item of this.unidentified()) {
      const source = scrollSource(world.containers.inventory.values(), 'ibk', 'isc')
      if (!source || hudModel === null || !this.active) break
      hudModel.useItem(source.id)
      if (!(await waitFor(() => hudManager.pendingIdentifyScrollId !== null, IDENTIFY_MS))) break
      hudModel.identifyItem(item.id, source.id)
      await waitFor(() => world.containers.inventory.get(item.id)?.identified !== false, IDENTIFY_MS)
    }
    if (hudManager.rightPanel === 'inv') hudManager.toggleRightPanel('inv')
  }

  private isCaster(): boolean {
    return appraisalContextOf(this.host.world).build.style !== 'melee'
  }

  private async buyPotions(): Promise<void> {
    const { world, hudManager, hudModel } = this.host
    if (hudModel === null || hudManager.leftPanel !== 'vendor') return
    const rows = hudManager.belt.maxRows
    const [healing, mana] = POTION_COLUMNS[this.isCaster() ? 'caster' : 'melee']
    const belt = (prefix: string) => [...world.containers.belt.values()].filter((item) => item.code.startsWith(prefix)).length
    const bestIn = (prefix: string): ItemData | undefined => [...world.containers.shop.values()].filter((item) => item.code.startsWith(prefix)).sort((a, b) => potionTier(b.code) - potionTier(a.code))[0]
    for (const [prefix, columns] of [['hp', healing], ['mp', mana]] as const) {
      const potion = bestIn(prefix)
      for (let tries = 0; potion && tries < BUY_TRIES && belt(prefix) < columns * rows && world.containers.belt.size < rows * 4; tries++) {
        const before = belt(prefix)
        if (!hudModel.vendorBuy(potion.id, false) || !(await waitFor(() => belt(prefix) > before, 1500))) break
      }
    }
    const spares = this.isCaster() ? SPARE_POTIONS.caster : SPARE_POTIONS.melee
    const total = (prefix: string) => [...world.containers.belt.values(), ...world.containers.inventory.values()].filter((item) => item.code.startsWith(prefix)).length
    for (const [prefix, spare] of [['hp', spares[0]], ['mp', spares[1]]] as const) {
      const potion = bestIn(prefix)
      const wanted = belt(prefix) + spare
      for (let tries = 0; potion && tries < BUY_TRIES && total(prefix) < wanted && world.self.gold >= SPARE_GOLD; tries++) {
        const before = total(prefix)
        if (!hudModel.vendorBuy(potion.id, false) || !(await waitFor(() => total(prefix) > before, 1500))) break
      }
    }
  }

  private async repair(): Promise<void> {
    const { hudManager, hudModel } = this.host
    if (hudModel !== null && hudManager.leftPanel === 'vendor') hudModel.vendorRepairAll()
    await new Promise((resolve) => setTimeout(resolve, REPAIR_MS))
  }
}
