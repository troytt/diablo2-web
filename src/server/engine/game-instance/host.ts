/**
 * GameInstance Composite Host & Public Method Surface (`src/server/engine/game-instance/host.ts`).
 */

import type { DeathKillerKind113c } from '../../../common/progression/experience-113c.ts'
import type { ClientCommand, ServerEvent } from '../../../netproto/index.ts'
import type { SummonManager, CreatePetOutcome, SummonedPetUnit } from '../../ai/summon-manager.ts'
import type { SUnitDmgPacket } from '../combat-pipeline.ts'
import type { AnimDispatcher } from '../anim-dispatcher.ts'
import type { ConnectPlayerSpec, HireMercenarySpec, InternalMercenaryRecord, InternalMonsterRecord, InternalPlayerRecord, ServerItemEntry, ServerMercenaryState, ServerMonsterState, ServerPlayerState, ServerUnitSummary, SpawnMonsterSpec, SpawnObjectSpec, SummonPetSpec } from './types.ts'
import type { GameInstanceState } from './state.ts'
import type { AreaAndSessionMethods } from './area-and-session.ts'
import type { ItemStatsAndDropsMethods } from './item-stats-and-drops.ts'
import type { WorldSpawningAndAoiMethods } from './world-spawning-and-aoi.ts'
import type { FrameAndCommandsMethods } from './frame-and-commands.ts'
import type { PlayerCombatAndVitalsMethods } from './player-combat-and-vitals.ts'
import type { PlayerAurasAndStatesMethods } from './player-auras-and-states.ts'
import type { PlayerSkillsAoeAndCorpseMethods } from './player-skills-aoe-and-corpse.ts'
import type { PlayerSkillsTargetAndMeleeMethods } from './player-skills-target-and-melee.ts'
import type { MonsterDamageMethods } from './monster-damage.ts'
import type { MonsterDeathAndXpMethods } from './monster-death-and-xp.ts'
import type { MissilesStepMethods } from './missiles-step.ts'
import type { MonsterMeleeAttacksMethods } from './monster-melee-attacks.ts'
import type { PvpAndMonsterLocomotionMethods } from './pvp-and-monster-locomotion.ts'
import type { BossEncountersAiMethods } from './boss-encounters-ai.ts'
import type { MonsterCombatAiMethods } from './monster-combat-ai.ts'
import type { PlayerDeathAndShrinesMethods } from './player-death-and-shrines.ts'
import type { QuestsObjectsAndPortalsMethods } from './quests-objects-and-portals.ts'
import type { PlayerInventoryMethods } from './player-inventory.ts'
import type { NpcVendorsAndArtisansMethods } from './npc-vendors-and-artisans.ts'
import type { TradePartyAndProgressionMethods } from './trade-party-and-progression.ts'
import type { MercenariesMethods } from './mercenaries.ts'
import type { SummonedPetsMethods } from './summoned-pets.ts'
import type { SnapshotsAndD2sMethods } from './snapshots-and-d2s.ts'

export interface GameInstanceHost
  extends GameInstanceState,
    AreaAndSessionMethods,
    ItemStatsAndDropsMethods,
    WorldSpawningAndAoiMethods,
    FrameAndCommandsMethods,
    PlayerCombatAndVitalsMethods,
    PlayerAurasAndStatesMethods,
    PlayerSkillsAoeAndCorpseMethods,
    PlayerSkillsTargetAndMeleeMethods,
    MonsterDamageMethods,
    MonsterDeathAndXpMethods,
    MissilesStepMethods,
    MonsterMeleeAttacksMethods,
    PvpAndMonsterLocomotionMethods,
    BossEncountersAiMethods,
    MonsterCombatAiMethods,
    PlayerDeathAndShrinesMethods,
    QuestsObjectsAndPortalsMethods,
    PlayerInventoryMethods,
    NpcVendorsAndArtisansMethods,
    TradePartyAndProgressionMethods,
    MercenariesMethods,
    SummonedPetsMethods,
    SnapshotsAndD2sMethods {}

export interface GameInstancePublicMethods {
  setAnimActionWindup(enabled: boolean): void
  isAnimActionWindupEnabled(): boolean
  getPlayerAnimDispatcher(playerUnitId: number): AnimDispatcher | undefined
  getCairnStoneOrder(): readonly number[]
  getTrueTalRashaTombAreaId(): number
  isAreaLoaded(areaId: number): boolean
  ensureAreaLoaded(areaId: number): boolean
  setTerrainWalkableCheck(fn: ((areaId: number, x: number, y: number, isFlying?: boolean) => boolean) | undefined): void
  setWalkabilityCallback(fn: | ((x: number, y: number, isFlying?: boolean) => boolean)
    | ((areaId: number, x: number, y: number, isFlying?: boolean) => boolean)
    | undefined): void
  movePlayer(playerUnitId: number, x: number, y: number): void
  isPaused(): boolean
  setPaused(paused: boolean): void
  getPlayersX(): number
  setPlayersX(value: number, options?: { readonly syncMonsterPlayerCount?: boolean | undefined }): number
  connectPlayer(spec?: ConnectPlayerSpec | undefined): number
  addPlayer(spec?: ConnectPlayerSpec | undefined): number
  disconnectPlayer(playerUnitId: number): Uint8Array | null
  removePlayer(playerUnitId: number): Uint8Array | null
  buildUnitAssignEvent(unitType: 'monster' | 'object', unitId: number): ServerEvent | undefined
  spawnMonster(spec: SpawnMonsterSpec): number
  spawnObject(spec: SpawnObjectSpec): number
  spawnGroundItem(spec: {
  readonly code: string
  readonly x: number
  readonly y: number
  readonly areaId?: number | undefined
  readonly quality?: number | undefined
  readonly level?: number | undefined
  readonly cost?: number | undefined
  readonly quantity?: number | undefined
  readonly identified?: boolean | undefined
  readonly stats?:
    | ReadonlyArray<{
        readonly statId: number
        readonly param?: number | undefined
        readonly value: number
      }>
    | undefined
}): number
  getGroundItems(): readonly ServerItemEntry[]
  lookupWorldUnitArea(unitType: 'player' | 'monster' | 'object' | 'item' | 'missile' | 'tile', unitId: number): number | undefined
  hasLiveWorldEntity(unitType: 'player' | 'monster' | 'object' | 'item' | 'missile' | 'tile', unitId: number): boolean
  getAoiWorldEntities(): ReadonlyArray<{
  readonly unitType: 'player' | 'monster' | 'object' | 'item' | 'missile' | 'tile'
  readonly unitId: number
  readonly areaId: number
  readonly x: number
  readonly y: number
}>
  buildEntityEnterAoiEvents(unitType: 'player' | 'monster' | 'object' | 'item' | 'missile' | 'tile', unitId: number): readonly ServerEvent[]
  enqueueCommand(playerUnitId: number, command: ClientCommand): void
  getSojSoldCount(): number
  isWorldEventTriggered(): boolean
  isDiabloCloneSpawned(): boolean
  spawnSuperUnique(spec: {
  readonly superUniqueIndex: number
  readonly x: number
  readonly y: number
  readonly areaId?: number | undefined
}): number[]
  stepFrame(): Map<number, readonly ServerEvent[]>
  stepFrames(count: number): void
  getActiveGrimWards113c(): ReadonlyArray<{
  readonly objectUnitId: number
  readonly ownerPlayerId: number
  readonly areaId: number
  readonly x: number
  readonly y: number
  readonly slvl: number
  readonly radiusSubtiles: number
  readonly fleeDurationFrames: number
  readonly expireFrame: number
}>
  getUnmodeledPlayerSrvDoFuncs(): number[]
  applyDamageToMonster(attackerOrMonsterId: InternalPlayerRecord | number, monsterOrDamage: InternalMonsterRecord | number, damageOrAttackerId?: number, skillIdArg?: number, channelOverride?: 'phys' | 'fire' | 'ltng' | 'cold' | 'mag' | 'pois', source?: 'player' | 'merc' | InternalMercenaryRecord | SummonedPetUnit | undefined, hitContext?: {
    readonly attackKind?: 'melee' | 'missile' | 'spell' | undefined
    readonly autoHit?: boolean | undefined
    readonly unblockable?: boolean | undefined
    readonly elemDurationFrames?: number | undefined
    readonly toHitBonusPct?: number | undefined
    readonly weaponHand?: 'left' | 'right' | undefined
    readonly elemDamage256?: number | undefined
    readonly concentrationAlreadyApplied?: boolean | undefined
    readonly bladeWeaponHit?: boolean | undefined
    readonly bladeShieldPulse?: boolean | undefined
    readonly outHitResult?: { landedHitRoll: boolean } | undefined
    readonly srcDam?: number | undefined
    readonly skipHitRiders?: boolean | undefined
    readonly skipElemMastery?: boolean | undefined
    readonly missileHitFlags113c?: number | undefined
    readonly missileResultFlags113c?: number | undefined
    readonly suppressReturnFireThreat?: boolean | undefined
    readonly isGroundFire?: boolean | undefined
    readonly fromPet?: boolean | undefined
    readonly vengeanceSpec?:
      | {
          readonly weaponBaseRolled: number
          readonly physDamagePct: number
          readonly griefFlat: number
          readonly multiElemPacket: NonNullable<SUnitDmgPacket["multiElemPacket"]>
        }
      | undefined
  }): boolean
  applyDamageToMerc(
    mercUnitIdOrRecord: number | InternalMercenaryRecord,
    damage: number,
    areaIdOverride?: number,
    options?: { readonly skipGetHit?: boolean | undefined },
  ): void
  applyDamageToSummon(ownerIdOrPet: number | SummonedPetUnit, petOrDamage: SummonedPetUnit | string | number, damageOverride?: number, areaIdOverride?: number): void
  isAreaSeamAdjacent(a: number, b: number): boolean
  areaIdAtWorldPoint(x: number, y: number, referenceAreaId?: number): number | undefined
  applyDamageToPlayer(playerUnitIdOrRecord: number | InternalPlayerRecord, damage: number, options?: {
    readonly dmg256?: number | undefined
    readonly hitClass?: number | string | undefined
    readonly isPurePoison?: boolean | undefined
    readonly skipGetHit?: boolean | undefined
    readonly killerType?: DeathKillerKind113c
    readonly killerUnitId?: number | undefined
  }): void
  listWarpTiles(areaId: number): readonly {
  readonly unitId: number
  readonly lvlWarpId: number
  readonly x: number
  readonly y: number
  readonly destAreaId: number
}[]
  drainEvents(playerUnitId?: number): readonly ServerEvent[]
  drainPlayerEvents(playerUnitId: number): readonly ServerEvent[]
  getPlayerState(playerUnitId: number): ServerPlayerState | undefined
  getMonsterState(monsterUnitId: number): ServerMonsterState | undefined
  getMonster(monsterUnitId: number): ServerMonsterState | undefined
  listMonsters(areaId?: number): ServerMonsterState[]
  applyPlayerState(playerUnitId: number, stateId: number, durationFrames: number): boolean
  applyMonsterState(monsterUnitId: number, stateIdOrName: number | string, durationFrames?: number | undefined, extra?: {
    readonly frozenTicks?: number | undefined
    readonly chillTicks?: number | undefined
    readonly sourcePlayerId?: number | undefined
    readonly slvl?: number | undefined
  }): boolean
  applyStateToMonster(monsterUnitId: number, stateIdOrName: number | string, durationFrames?: number | undefined, extra?: {
    readonly frozenTicks?: number | undefined
    readonly chillTicks?: number | undefined
    readonly sourcePlayerId?: number | undefined
    readonly slvl?: number | undefined
  }): boolean
  hireMercenary(ownerPlayerId: number, spec?: HireMercenarySpec | undefined): number
  getMercenaryForOwner(ownerPlayerId: number): ServerMercenaryState | undefined
  getMercenaryState(unitIdOrOwnerId: number): ServerMercenaryState | undefined
  getMercenaryOrPetArea(unitId: number): number | undefined
  getMonsterOrAllyArea(unitId: number): number | undefined
  getSummonManager(ownerPlayerId: number): SummonManager
  summonPet(ownerPlayerId: number, spec: SummonPetSpec): CreatePetOutcome
  unsummonPetAt(ownerPlayerId: number, x: number, y: number, radius?: number | undefined): SummonedPetUnit | null
  getPetsForOwner(ownerPlayerId: number): readonly SummonedPetUnit[]
  getPetState(idOrOutcome: | number
    | string
    | {
        readonly pet?: SummonedPetUnit | null | undefined
        readonly uid?: string | undefined
      }): SummonedPetUnit | undefined
  getNpcVendorPool(npcUnitId: number): readonly ServerItemEntry[]
  getAllUnits(): readonly ServerUnitSummary[]
  exportPlayerD2s(playerUnitId: number, options?: { readonly timestampSec?: number | undefined }): Uint8Array
  computeFrameLockstepHash(): number
  getStateHash(): number
  getLastLockstepHash(): number
}
