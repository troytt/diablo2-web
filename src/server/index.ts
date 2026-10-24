/**
 * Public Barrel Exports of `src/server/index.ts` (`PROJECT.md § Interface Contracts`).
 *
 * Exposes the unified 25Hz `GameInstance` + `GameModePolicy`, `LocalLoopbackAdapter` + `LocalLobbyProvider`,
 * `MultiClientRoomHost` + `AoiFilter` + `PartyManager` + `RoomClientSession`, 1.13c `.d2s` v96 reader/writer,
 * monster AI, room streaming, drop pipeline, and deterministic lockstep state hashing.
 * Strictly isomorphic: zero DOM globals, zero Node built-ins, zero `Math.random()` or wall-clock calls.
 */

export * from './engine.ts'
export * from './loopback-adapter.ts'
export * from './room-host.ts'
export * from './net/aoi.ts'
export * from './net/party.ts'
export * from './net/session.ts'
export {
  D2S_MAGIC,
  D2S_VERSION,
  D2sCharacterStore,
  D2sCharacterStoreImpl,
  InMemoryD2sCharacterStore,
  captureSnapshot,
  computeD2sChecksum,
  createDefaultNpcIntroData,
  createDefaultQuestData,
  createDefaultWaypointData,
  d2sChecksum,
  extractCharSummaryFromD2s,
  getServerItemDataTables,
  parseSnapshot,
  readD2s,
  readD2sSave,
  readD2sSave113c,
  restoreSnapshot,
  serializeSnapshot,
  verifyD2sChecksum,
  writeD2s,
  writeD2sSave,
  writeD2sSave113c,
  type D2sCharacterData,
  type D2sCharacterSave,
  type D2sItemInput,
  type GameSnapshot,
} from './save/save.ts'
export {
  MON_UMOD,
  MonsterAI,
  createPlayer,
  createWorld,
  damageMonster,
  executeActBossAi113c,
  executeOblivionKnightCurse113c,
  executeShamanResurrect113c,
  tickMercenaryAi25Hz,
  tickMonsters,
  triggerMonsterDeathAffixes113c,
  type CombatEvent,
  type CombatPlayer,
  type CombatTerrain,
  type CombatWorld,
  type Monster,
  type Monster as CombatMonster,
} from './ai/monster-ai.ts'
export { RoomStreamer, streamActiveRooms113c } from './ai/room-streamer.ts'
export { SummonManager, UNSUMMON_PICK_RADIUS, unsummonOwnPetAt } from './ai/summon-manager.ts'
export {
  executeDropPipeline,
  executePendingMonsterDrop113c,
  getEmbeddedDropTables,
  queueMonsterDeathDrop113c,
  resolveMonsterDropPending113c,
  tickPendingMonsterDrops113c,
  type PendingMonsterDrop,
} from './items/drop-pipeline.ts'
export { GroundItemManager } from './items/ground-items.ts'
export {
  computeCharsiImbueIlvl,
  imbueItem113c,
  imbueItemCharsi,
  isEligibleForCharsiImbue113c,
} from './items/imbue.ts'
export {
  SKILL_REGISTRY,
  discoverSkillModules,
  evaluateSkill113c,
  executeSkill113c,
  getRegisteredSkillModule,
  listRegisteredSkillModules,
  registerSkillModule,
} from './skills/registry.ts'
export {
  DRUID_TRANSFORM_CLT_OVERLAYS_113C,
  applyEnchantBuff,
  canCastEnchantOn,
  castSkill,
  castSkillDef,
  type SkillCastBackendContext,
  type SkillCastCharacterLike,
  type SkillCastContext,
  type SkillCastHudAdapter,
  type SkillCastRuntime,
  type SkillCastRuntimeLike,
  type SkillDef,
  type StatusSink,
} from './skills/skills.ts'
export { QuestLog } from './world/quests.ts'


