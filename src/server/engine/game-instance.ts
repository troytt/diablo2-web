/**
 * Authoritative Server GameInstance (`src/server/engine/game-instance.ts`).
 *
 * Modular facade composing `GameInstanceState` with 1.13c server subsystem modules
 * under `src/server/engine/game-instance/`.
 */

import {
  computeMercHireCost113c,
  computeMercResurrectCost113c,
  generateHireCandidates113c,
} from '../../common/units/hireling-table.ts'
import {
  ACT_BOSS_QUEST_113C,
  CHAR_ANIM_TOKEN_BY_CLASS_113C,
  CLOSED_REALM_POLICY,
  MONSTER_AI_BEHAVIOR_BY_AI,
  OPEN_BNET_POLICY,
  PER_LEVEL_STAT_MAP_113C,
  QUEST_ITEM_EQUIVALENT_CODES_113C,
  QUEST_ITEM_SUPERSEDING_CODES_113C,
  SINGLE_PLAYER_POLICY,
  resolveGameModePolicy,
} from './game-instance/constants-and-helpers.ts'
import type { GameInstancePublicMethods } from './game-instance/host.ts'
import { GameInstanceState } from './game-instance/state.ts'
import type {
  AreaArrival,
  ConnectPlayerSpec,
  GameInstanceConfig,
  GameMode,
  GameModePolicy,
  HireMercenarySpec,
  MonsterAiBehavior,
  ServerItemEntry,
  ServerMercenaryState,
  ServerMonsterState,
  ServerPlayerState,
  ServerUnitSummary,
  SpawnMonsterSpec,
  SpawnObjectSpec,
  SummonPetSpec,
} from './game-instance/types.ts'
import { areaAndSessionMethods } from './game-instance/area-and-session.ts'
import { itemStatsAndDropsMethods } from './game-instance/item-stats-and-drops.ts'
import { worldSpawningAndAoiMethods } from './game-instance/world-spawning-and-aoi.ts'
import { frameAndCommandsMethods } from './game-instance/frame-and-commands.ts'
import { playerCombatAndVitalsMethods } from './game-instance/player-combat-and-vitals.ts'
import { playerAurasAndStatesMethods } from './game-instance/player-auras-and-states.ts'
import { playerSkillsAoeAndCorpseMethods } from './game-instance/player-skills-aoe-and-corpse.ts'
import { playerSkillsTargetAndMeleeMethods } from './game-instance/player-skills-target-and-melee.ts'
import { monsterDamageMethods } from './game-instance/monster-damage.ts'
import { monsterDeathAndXpMethods } from './game-instance/monster-death-and-xp.ts'
import { missilesStepMethods } from './game-instance/missiles-step.ts'
import { monsterMeleeAttacksMethods } from './game-instance/monster-melee-attacks.ts'
import { pvpAndMonsterLocomotionMethods } from './game-instance/pvp-and-monster-locomotion.ts'
import { bossEncountersAiMethods } from './game-instance/boss-encounters-ai.ts'
import { monsterCombatAiMethods } from './game-instance/monster-combat-ai.ts'
import { playerDeathAndShrinesMethods } from './game-instance/player-death-and-shrines.ts'
import { questsObjectsAndPortalsMethods } from './game-instance/quests-objects-and-portals.ts'
import { playerInventoryMethods } from './game-instance/player-inventory.ts'
import { npcVendorsAndArtisansMethods } from './game-instance/npc-vendors-and-artisans.ts'
import { tradePartyAndProgressionMethods } from './game-instance/trade-party-and-progression.ts'
import { mercenariesMethods } from './game-instance/mercenaries.ts'
import { summonedPetsMethods } from './game-instance/summoned-pets.ts'
import { snapshotsAndD2sMethods } from './game-instance/snapshots-and-d2s.ts'

export {
  CLOSED_REALM_POLICY,
  MONSTER_AI_BEHAVIOR_BY_AI,
  OPEN_BNET_POLICY,
  SINGLE_PLAYER_POLICY,
  computeMercHireCost113c,
  computeMercResurrectCost113c,
  generateHireCandidates113c,
  resolveGameModePolicy,
}

export type {
  AreaArrival,
  ConnectPlayerSpec,
  GameInstanceConfig,
  GameMode,
  GameModePolicy,
  HireMercenarySpec,
  MonsterAiBehavior,
  ServerItemEntry,
  ServerMercenaryState,
  ServerMonsterState,
  ServerPlayerState,
  ServerUnitSummary,
  SpawnMonsterSpec,
  SpawnObjectSpec,
  SummonPetSpec,
}

export class GameInstance extends GameInstanceState {
  static readonly ACT_BOSS_QUEST_113C = ACT_BOSS_QUEST_113C
  static readonly PER_LEVEL_STAT_MAP_113C = PER_LEVEL_STAT_MAP_113C
  static readonly CHAR_ANIM_TOKEN_BY_CLASS_113C = CHAR_ANIM_TOKEN_BY_CLASS_113C
  static readonly QUEST_ITEM_EQUIVALENT_CODES_113C = QUEST_ITEM_EQUIVALENT_CODES_113C
  static readonly QUEST_ITEM_SUPERSEDING_CODES_113C = QUEST_ITEM_SUPERSEDING_CODES_113C
}

export interface GameInstance extends GameInstancePublicMethods {}

Object.assign(
  GameInstance.prototype,
  areaAndSessionMethods,
  itemStatsAndDropsMethods,
  worldSpawningAndAoiMethods,
  frameAndCommandsMethods,
  playerCombatAndVitalsMethods,
  playerAurasAndStatesMethods,
  playerSkillsAoeAndCorpseMethods,
  playerSkillsTargetAndMeleeMethods,
  monsterDamageMethods,
  monsterDeathAndXpMethods,
  missilesStepMethods,
  monsterMeleeAttacksMethods,
  pvpAndMonsterLocomotionMethods,
  bossEncountersAiMethods,
  monsterCombatAiMethods,
  playerDeathAndShrinesMethods,
  questsObjectsAndPortalsMethods,
  playerInventoryMethods,
  npcVendorsAndArtisansMethods,
  tradePartyAndProgressionMethods,
  mercenariesMethods,
  summonedPetsMethods,
  snapshotsAndD2sMethods,
)
