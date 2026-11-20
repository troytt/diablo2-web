/**
 * GameInstance Subsystem: Event Draining, Unit State Snapshots, .d2s Save Export & Deterministic Lockstep Hash (`src/server/engine/game-instance/snapshots-and-d2s.ts`).
 */

import { getEmbeddedDropTables } from '../../../common/items/embedded-drop-tables.ts'
import { QUEST_FLAG_COMPLETED_113C, hasQuestFlag113c } from '../quests-113c.ts'
import { hirelingExpThreshold } from '../../../common/progression/experience-113c.ts'
import { calculateConvictionStats } from '../../../common/skills/paladin-auras.ts'
import { ALL_CURSE_STATE_IDS_113C, isMonsterUncursable113c } from '../../ai/monumod-113c.ts'
import type { ServerEvent } from '../../../netproto/index.ts'
import { getServerItemDataTables } from '../../save/d2s-reader.ts'
import { createDefaultWaypointData, writeD2sSave113c } from '../../save/d2s-writer.ts'
import type { GameInstanceHost } from './host.ts'
import type { InternalPlayerRecord, ServerItemEntry, ServerMonsterState, ServerPlayerState, ServerUnitSummary } from './types.ts'
import { CLASS_SKILL_OFFSET, WAYPOINT_AREA_IDS, experienceForLevel113c } from './constants-and-helpers.ts'


function drainEvents(this: GameInstanceHost, playerUnitId?: number): readonly ServerEvent[] {
  if (playerUnitId !== undefined) {
    const queue = this.outbox.get(playerUnitId)
    if (!queue || queue.length === 0) return []
    return queue.splice(0, queue.length)
  }
  const all: ServerEvent[] = []
  for (const queue of this.outbox.values()) {
    if (queue.length > 0) {
      all.push(...queue.splice(0, queue.length))
    }
  }
  return all
}



function drainPlayerEvents(this: GameInstanceHost, playerUnitId: number): readonly ServerEvent[] {
  return this.drainEvents(playerUnitId)
}



function getPlayerState(this: GameInstanceHost, playerUnitId: number): ServerPlayerState | undefined {
  const p = this.players.get(playerUnitId)
  if (!p) return undefined
  const stats = new Map<number, number>([
    [0, p.strength],
    [1, p.energy],
    [2, p.dexterity],
    [3, p.vitality],
    [4, p.statPts],
    [5, p.newSkills],
    [6, p.hp],
    [7, p.maxHp],
    [8, p.mana],
    [9, p.maxMana],
    [10, p.stamina],
    [11, p.maxStamina],
    [12, p.level],
    [13, p.experience],
    [14, p.gold],
    [15, p.goldBank],
  ])
  return {
    unitId: p.unitId,
    name: p.name,
    classId: p.classId,
    classCode: p.classCode,
    level: p.level,
    act: p.act,
    areaId: p.areaId,
    x: p.x,
    y: p.y,
    targetX: p.targetX,
    targetY: p.targetY,
    run: p.run,
    mode: p.mode,
    hp: p.hp,
    maxHp: p.maxHp,
    mana: p.mana,
    maxMana: p.maxMana,
    stamina: p.stamina,
    maxStamina: p.maxStamina,
    experience: p.experience,
    gold: p.gold,
    goldInInventory: p.gold,
    goldBank: p.goldBank,
    stashGold: p.goldBank,
    strength: p.strength,
    dexterity: p.dexterity,
    vitality: p.vitality,
    energy: p.energy,
    statPts: p.statPts,
    statPoints: p.statPts,
    newSkills: p.newSkills,
    skillPoints: p.newSkills,
    leftSkill: p.leftSkill,
    rightSkill: p.rightSkill,
    skills: new Map(p.skills),
    stats,
    states: new Set(p.states),
    items: p.items.map((i) => ({ ...i, stats: new Map(i.stats) })),
    waypoints: new Set(p.waypoints),
    dead: p.dead,
    corpseId: p.corpseId,
    activeNpcId: p.activeNpcId,
    partyId: p.partyId,
  }
}



function getMonsterState(this: GameInstanceHost, monsterUnitId: number): ServerMonsterState | undefined {
  const m = this.monsters.get(monsterUnitId)
  if (!m) return undefined
  return {
    unitId: m.unitId,
    classId: m.classId,
    hcIdx: m.hcIdx,
    defId: m.defId,
    name: m.name,
    areaId: m.areaId,
    x: m.x,
    y: m.y,
    hp: m.hp,
    maxHp: m.maxHp,
    baseMaxHp: m.baseMaxHp,
    level: m.level,
    minDmg: m.minDmg,
    maxDmg: m.maxDmg,
    ar: m.ar,
    ac: m.ac,
    experience: m.experience,
    mode: m.mode,
    dead: m.dead,
    alive: !m.dead,
    isNpc: m.isNpc,
    isVendor: m.isVendor,
    isKillable: m.isKillable,
    petIgnore: m.petIgnore,
    isBoss: m.isBoss,
    isPrimeEvil: m.isPrimeEvil,
    isUndead: m.isUndead,
    isDemon: m.isDemon,
    isFlying: m.isFlying,
    isRanged: m.isRanged,
    rank: m.rank,
    modifiers: [...m.modifiers],
    umodIds: [...m.umodIds],
    ai: m.ai,
    aiDelay: m.aiDelay,
    aiParams: [...m.aiParams],
    resistances: { ...m.resistances },
    frozenTicks: m.frozenTicks,
    chillTicks: m.chillTicks,
    fleeTicks: m.fleeTicks,
    states: new Set(m.states),
    shattered: m.shattered,
    corpseSuppressed: m.shattered,
    revivedByShaman: m.revivedByShaman,
    monsterPlayerCount: m.monsterPlayerCount,
    submerged: m.submerged,
    bossUnitId: m.bossUnitId,
  }
}



function getMonster(this: GameInstanceHost, monsterUnitId: number): ServerMonsterState | undefined {
  return this.getMonsterState(monsterUnitId)
}



function listMonsters(this: GameInstanceHost, areaId?: number): ServerMonsterState[] {
  const out: ServerMonsterState[] = []
  for (const m of this.monsters.values()) {
    if (areaId !== undefined && m.areaId !== areaId) continue
    const state = this.getMonsterState(m.unitId)
    if (state) out.push(state)
  }
  return out
}



/** Apply a `States.txt` state (by row id) to a player for `durationFrames` (25 Hz frames). */
function applyPlayerState(this: GameInstanceHost, playerUnitId: number, stateId: number, durationFrames: number): boolean {
  const p = this.players.get(playerUnitId)
  if (!p || p.dead) return false
  if (this.registry.getStateById(stateId) === undefined) {
    throw new Error(`GameInstance.applyPlayerState: unknown States.txt row ${stateId}`)
  }
  this.applyUnitState(p.states, p.stateTimers, 'player', p.unitId, p.areaId, stateId, durationFrames)
  return true
}



function applyMonsterState(this: GameInstanceHost, 
  monsterUnitId: number,
  stateIdOrName: number | string,
  durationFrames = 50,
  extra?: {
    readonly frozenTicks?: number | undefined
    readonly chillTicks?: number | undefined
    readonly sourcePlayerId?: number | undefined
    readonly slvl?: number | undefined
  },
): boolean {
  const m = this.monsters.get(monsterUnitId)
  if (!m || m.dead || m.isNpc) return false

  let stateId: number
  if (typeof stateIdOrName === 'number') {
    stateId = stateIdOrName
  } else {
    const key = stateIdOrName.trim().toLowerCase()
    if (key === 'freeze' || key === 'frozen') stateId = 1
    else if (key === 'poison') stateId = 2
    else if (key === 'amplifiedamage' || key === 'amplify') stateId = 9
    else if (key === 'weaken') stateId = 19
    else if (key === 'stun' || key === 'stunned') stateId = 21
    else if (key === 'dimvision') stateId = 23
    else if (key === 'taunt') stateId = 27
    else if (key === 'chill' || key === 'chilled' || key === 'cold') stateId = 11
    else if (key === 'holyfreeze') stateId = 43
    else if (key === 'lifetap') stateId = 58
    else if (key === 'ironmaiden') stateId = 55
    else if (key === 'terror') stateId = 56
    else if (key === 'attract') stateId = 57
    else if (key === 'confuse') stateId = 59
    else if (key === 'decrepify') stateId = 60
    else if (key === 'lowerresist') stateId = 61
    else if (key === 'conviction') stateId = 28
    else if (key === 'conversion') stateId = 53
    else stateId = this.registry.getStateByName(key)?.id ?? (Number(key) || 11)
  }

  const isCurse =
    ALL_CURSE_STATE_IDS_113C.has(stateId) ||
    this.registry.getStateById(stateId)?.curse === true
  // 1.13c D2Game.dll 0x6FC437C0 (`MONUMOD_ChampionPossessed`): `STAT_UNCURSABLE` (`+0x22` bit 5)
  // blocks all curse states (Amplify Damage, Decrepify, Lower Resist, Life Tap, Taunt, etc.).
  if (isCurse && isMonsterUncursable113c(m.umodIds, m.uncursable)) {
    return false
  }

  // Freeze/Stun interrupts a monster's pending melee/revive action frame.
  if (stateId === 1 || stateId === 29 || stateId === 21 || stateId === 25) {
    m.pendingAttack = undefined
    m.pendingAllyAttack = undefined
    m.pendingResurrection = undefined
  }

  const isBossOrUnique = m.isBoss || m.isPrimeEvil || m.rank === 'unique'
  // Taunt (27) reaches champions in 1.13c; the other AI-altering curses stay off
  // Champions as well as bosses/uniques.
  const isAiCcImmune =
    isBossOrUnique || (m.rank === 'champion' && stateId !== 27)
  if (isAiCcImmune) {
    // F14.B1: Bosses/Uniques ignore AI-altering crowd-control curses (stun 21/25,
    // dimvision 23, taunt 27, terror 56, attract 57, confuse 59). Champions keep
    // those immunities except Taunt, which reaches them in 1.13c.
    if (
      stateId === 21 ||
      stateId === 23 ||
      stateId === 25 ||
      stateId === 27 ||
      stateId === 56 ||
      stateId === 57 ||
      stateId === 59
    ) {
      return false
    }
  }
  if (isBossOrUnique) {
    // F14.B1: Bosses/Uniques cannot be frozen solid (convert freeze 1/29 -> cold 11)
    if (stateId === 1 || stateId === 29) {
      stateId = 11
      m.states.delete(1)
      m.states.delete(29)
      m.stateTimers.delete(1)
      m.stateTimers.delete(29)
      m.frozenTicks = 0
      m.chillTicks = Math.max(
        m.chillTicks,
        extra?.chillTicks ?? durationFrames,
      )
    }
  } else {
    if (stateId === 1 || stateId === 29) {
      m.frozenTicks = Math.max(
        m.frozenTicks,
        extra?.frozenTicks ?? durationFrames,
      )
    } else if (stateId === 11) {
      m.chillTicks = Math.max(
        m.chillTicks,
        extra?.chillTicks ?? durationFrames,
      )
    } else if (stateId === 27) {
      m.fleeTicks = 0
      m.states.delete(56)
      m.stateTimers.delete(56)
    } else if (stateId === 56) {
      m.fleeTicks = Math.max(m.fleeTicks, durationFrames)
    }
  }

  // 1.13c sub_6FCC00B0 (0x6FCC01C1): Attract (57) cannot be overwritten by any curse=1 state
  if (m.states.has(57) && isCurse) {
    return false
  }
  if (isCurse) {
    for (const prevCurseId of [...m.states]) {
      const isPrevCurse =
        ALL_CURSE_STATE_IDS_113C.has(prevCurseId) ||
        this.registry.getStateById(prevCurseId)?.curse === true
      if (prevCurseId !== stateId && isPrevCurse) {
        m.states.delete(prevCurseId)
        m.stateTimers.delete(prevCurseId)
        this.monsterCombat.get(m.unitId)?.stateBus.removeState(prevCurseId)
        this.broadcastToArea(m.areaId, {
          type: 'UnitState',
          unitType: 'monster',
          unitId: m.unitId,
          state: prevCurseId,
          active: false,
          areaId: m.areaId,
        })
        this.broadcastToArea(m.areaId, {
          type: 'StateEnd',
          unit: { unitType: 1, id: m.unitId },
          state: prevCurseId,
        })
      }
    }
  }

  const dur = Math.max(1, Math.floor(durationFrames))
  if (stateId === 53) {
    m.convertedUntilFrame = Math.max(m.convertedUntilFrame, this.currentFrame + dur)
    if (extra?.sourcePlayerId !== undefined) {
      m.convertedByPlayerId = extra.sourcePlayerId
    }
  }
  const effSlvl = Math.max(1, Math.floor(extra?.slvl ?? 1))
  if (
    extra?.sourcePlayerId !== undefined &&
    (stateId === 53 || stateId === 57 || stateId === 59)
  ) {
    this.monsterCombatContext(m).stateBus.applyState({
      stateNameOrId: stateId,
      sourceUnitId: `player_${extra.sourcePlayerId}`,
      sourceSkillId: 0,
      slvl: effSlvl,
      durationFrames: dur,
      currentFrame: this.currentFrame,
    })
  } else if (
    stateId === 9 ||
    stateId === 19 ||
    stateId === 28 ||
    stateId === 55 ||
    stateId === 58 ||
    stateId === 60 ||
    stateId === 61
  ) {
    const combatCtx = this.monsterCombatContext(m)
    if (!combatCtx.stateBus.hasState(stateId) || extra?.slvl !== undefined) {
      const curseSkillIdByState: Readonly<Record<number, number>> = {
        9: 66,
        19: 72,
        28: 123,
        55: 76,
        58: 82,
        60: 87,
        61: 91,
      }
      const srcSkillId = curseSkillIdByState[stateId] ?? 0
      const srcSkill = srcSkillId > 0 ? this.registry.getSkillById(srcSkillId) : undefined
      let stats: Record<string, number> | undefined
      if (stateId === 28) {
        const conv = calculateConvictionStats(effSlvl)
        const pierce = conv.resistanceReductionPct
        const defPen = -conv.defenseReductionPct
        stats = {
          fireresist: -pierce,
          lightresist: -pierce,
          coldresist: -pierce,
          skill_armor_percent: defPen,
          item_armor_percent: defPen,
        }
      } else if (srcSkill !== undefined) {
        stats = this.evaluateSkillStateStats(srcSkill, effSlvl, combatCtx.statList)
      }
      combatCtx.stateBus.applyState({
        stateNameOrId: stateId,
        sourceUnitId: extra?.sourcePlayerId !== undefined ? `player_${extra.sourcePlayerId}` : 'self',
        sourceSkillId: srcSkillId,
        slvl: effSlvl,
        durationFrames: dur,
        currentFrame: this.currentFrame,
        ...(stats !== undefined ? { stats } : {}),
      })
    }
  }
  this.applyUnitState(
    m.states,
    m.stateTimers,
    'monster',
    m.unitId,
    m.areaId,
    stateId,
    dur,
  )
  return true
}



function applyStateToMonster(this: GameInstanceHost, 
  monsterUnitId: number,
  stateIdOrName: number | string,
  durationFrames = 50,
  extra?: {
    readonly frozenTicks?: number | undefined
    readonly chillTicks?: number | undefined
    readonly sourcePlayerId?: number | undefined
    readonly slvl?: number | undefined
  },
): boolean {
  return this.applyMonsterState(
    monsterUnitId,
    stateIdOrName,
    durationFrames,
    extra,
  )
}



function getNpcVendorPool(this: GameInstanceHost, npcUnitId: number): readonly ServerItemEntry[] {
  const m = this.monsters.get(npcUnitId)
  if (!m) return []
  return m.vendorPool.map((i) => ({ ...i, stats: new Map(i.stats) }))
}



function getAllUnits(this: GameInstanceHost): readonly ServerUnitSummary[] {
  const out: ServerUnitSummary[] = []
  for (const p of this.players.values()) {
    out.push({
      unitType: 'player',
      unitId: p.unitId,
      classId: p.classId,
      x: p.x,
      y: p.y,
      areaId: p.areaId,
      name: p.name,
      mode: p.mode,
      hp: p.hp,
      maxHp: p.maxHp,
    })
  }
  for (const m of this.monsters.values()) {
    out.push({
      unitType: 'monster',
      unitId: m.unitId,
      classId: m.classId,
      x: m.x,
      y: m.y,
      areaId: m.areaId,
      name: m.name,
      mode: m.mode,
      hp: m.hp,
      maxHp: m.maxHp,
    })
  }
  for (const merc of this.mercenaries.values()) {
    out.push({
      unitType: 'monster',
      unitId: merc.unitId,
      classId: merc.classId,
      x: merc.x,
      y: merc.y,
      areaId: merc.areaId,
      name: merc.name,
      mode: merc.alive ? 1 : 12,
      hp: merc.hp,
      maxHp: merc.maxHp,
    })
  }
  for (const o of this.objects.values()) {
    out.push({
      unitType: 'object',
      unitId: o.unitId,
      classId: o.classId,
      x: o.x,
      y: o.y,
      areaId: o.areaId,
      mode: o.mode,
    })
  }
  for (const g of this.groundItems.values()) {
    out.push({
      unitType: 'item',
      unitId: g.unitId,
      classId: 0,
      x: g.x,
      y: g.y,
      areaId: g.areaId,
      name: g.code,
    })
  }
  for (const ms of this.missiles.values()) {
    out.push({
      unitType: 'missile',
      unitId: ms.unitId,
      classId: ms.missileId,
      x: ms.x,
      y: ms.y,
      areaId: ms.areaId,
    })
  }
  return out
}



function exportPlayerD2s(this: GameInstanceHost, 
  playerUnitId: number,
  options?: { readonly timestampSec?: number | undefined },
): Uint8Array {
  const p = this.players.get(playerUnitId)
  if (!p) {
    throw new Error(
      `GameInstance.exportPlayerD2s: unknown player unitId ${playerUnitId}`,
    )
  }

  const skillsArray = new Uint8Array(30)
  const offset = CLASS_SKILL_OFFSET[p.classId] ?? 6
  if (p.d2sTemplate?.skills) {
    skillsArray.set(p.d2sTemplate.skills.subarray(0, 30))
  }
  for (const [skillId, slvl] of p.skills.entries()) {
    const idx = skillId - offset
    if (idx >= 0 && idx < 30) {
      skillsArray[idx] = Math.max(0, Math.min(255, slvl))
    }
  }

  const template = p.d2sTemplate
  const defaultWp = createDefaultWaypointData()
  const waypoints: [Uint8Array, Uint8Array, Uint8Array] = template?.waypoints
    ? [
        new Uint8Array(template.waypoints[0]),
        new Uint8Array(template.waypoints[1]),
        new Uint8Array(template.waypoints[2]),
      ]
    : [
        defaultWp.slice(8, 32),
        defaultWp.slice(32, 56),
        defaultWp.slice(56, 80),
      ]

  const diffWp = waypoints[this.difficulty]
  diffWp.fill(0, 2, 7)
  for (const areaId of p.waypoints) {
    const bitIndex = WAYPOINT_AREA_IDS.indexOf(areaId)
    if (bitIndex !== -1) {
      const byteIdx = 2 + (bitIndex >> 3)
      const bitMask = 1 << (bitIndex & 7)
      diffWp[byteIdx] = (diffWp[byteIdx] ?? 0) | bitMask
    }
  }
  const questsDiffs = template?.quests
    ? ([
        new Uint16Array(template.quests[0]),
        new Uint16Array(template.quests[1]),
        new Uint16Array(template.quests[2]),
      ] as [Uint16Array, Uint16Array, Uint16Array])
    : ([new Uint16Array(48), new Uint16Array(48), new Uint16Array(48)] as [
        Uint16Array,
        Uint16Array,
        Uint16Array,
      ])
  questsDiffs[this.difficulty] = new Uint16Array(p.questFlags)

  const isHardcoreExport =
    p.isHardcore === true || (((p.statusFlags ?? template?.statusFlags ?? 0) & 0x04) !== 0)
  const statusFlags =
    (((p.statusFlags ?? template?.statusFlags ?? 0x20) |
      (isHardcoreExport ? 0x04 : 0) |
      (isHardcoreExport && (p.dead || p.hasDied === true) ? 0x08 : 0)) &
    0xff)
  const isExpansion = (statusFlags & 0x20) !== 0
  const actsPerDiff = isExpansion ? 5 : 4
  const bossQuests = isExpansion
    ? (['a1q6', 'a2q6', 'a3q6', 'a4q3', 'a5q6'] as const)
    : (['a1q6', 'a2q6', 'a3q6', 'a4q3'] as const)
  let computedProgression = template?.progression ?? 0
  for (let d = 0; d < 3; d++) {
    const qWords = questsDiffs[d]!
    for (let a = 0; a < bossQuests.length; a++) {
      if (hasQuestFlag113c(qWords, bossQuests[a]!, QUEST_FLAG_COMPLETED_113C)) {
        computedProgression = Math.max(computedProgression, d * actsPerDiff + (a + 1))
      }
    }
  }

  const activeMercRecord = [...this.mercenaries.values()].find(
    (m) => m.ownerPlayerId === playerUnitId,
  )
  const activeMerc = activeMercRecord ?? this.getMercenaryForOwner(playerUnitId)
  const exportedMercItems = activeMercRecord
    ? activeMercRecord.equipment.map((item) => this.serverEntryToItemData(item))
    : (template?.mercItems ?? template?.merc?.items)
  const exportedMerc = activeMerc
    ? {
        dead: !activeMerc.alive,
        seed: (template?.merc?.seed || activeMerc.unitId || 1) >>> 0,
        nameId: template?.merc?.nameId ?? 0,
        typeId: activeMerc.subType,
        experience: Math.max(
          template?.merc?.experience ?? 0,
          activeMerc.experience,
          hirelingExpThreshold(activeMerc.level, activeMerc.expPerLvl),
        ),
        ...(exportedMercItems !== undefined ? { items: exportedMercItems } : {}),
      }
    : template?.merc

  const elapsedSessionSec = Math.max(
    1,
    Math.floor(Math.max(0, this.currentFrame - p.connectedFrame) / 25),
  )
  const nextLastPlayedSec =
    options?.timestampSec !== undefined
      ? Math.max(0, Math.trunc(options.timestampSec))
      : Math.max(p.lastPlayedTimestampSec + 1, p.lastPlayedTimestampSec + elapsedSessionSec)
  p.lastPlayedTimestampSec = nextLastPlayedSec
  const savedCorpse = this.selectSavedCorpse113c(p)

  return writeD2sSave113c(
    {
      name: p.name,
      classId: p.classId,
      level: p.level,
      statusFlags,
      progression: computedProgression,
      activeWeapon: p.weaponSet === 1 ? 1 : 0,
      timestampSec: nextLastPlayedSec,
      createdTimestamp: p.createdTimestampSec,
      lastPlayedTimestamp: nextLastPlayedSec,
      hotkeys: [...p.hotkeys],
      leftSkill: p.leftSkill,
      rightSkill: p.rightSkill,
      altLeftSkill: p.altLeftSkill,
      altRightSkill: p.altRightSkill,
      appearance: template?.appearance,
      activeDifficulty: this.difficulty,
      activeAct: p.act,
      mapSeed: this.canPersistMapSeed()
        ? this.currentMapSeed
        : (template?.mapSeed ?? 0),
      merc: exportedMerc,
      mercItems: exportedMercItems,
      quests: questsDiffs,
      waypoints,
      npcIntro: new Uint8Array(p.npcIntro),
      attributes: {
        strength: p.strength,
        energy: p.energy,
        dexterity: p.dexterity,
        vitality: p.vitality,
        statPts: p.statPts,
        newSkills: p.newSkills,
        hitpointsFixed: Math.max(1, p.hpFixed),
        maxHpFixed: p.maxHpFixed,
        manaFixed: p.manaFixed,
        maxManaFixed: p.maxManaFixed,
        staminaFixed: p.staminaFixed,
        maxStaminaFixed: p.maxStaminaFixed,
        level: p.level,
        experience: Math.max(p.experience, experienceForLevel113c(p.level)),
        gold: p.gold,
        goldBank: p.goldBank,
      },
      skills: skillsArray,
      items: p.items.map((item) => this.serverEntryToItemData(item)),
      corpseItems: savedCorpse.items.map((item) =>
        this.serverEntryToItemData(item),
      ),
      ...(savedCorpse.items.length > 0
        ? {
            corpseX: Math.round(savedCorpse.x),
            corpseY: Math.round(savedCorpse.y),
          }
        : {}),
      ironGolem: p.ironGolemItem
        ? this.serverEntryToItemData(p.ironGolemItem)
        : null,
    },
    getServerItemDataTables(),
  )
}



/**
 * 1.13c `D2Game.dll` `0x6FD0D750` (`PLAYER_SaveCorpses`) + `0x6FD0C260` (`corpseX` / `corpseY`):
 * `.d2s` persists at most 1 corpse; when multiple unrecovered corpses exist in the room,
 * save the one with the highest total gold value along with its world coordinates.
 */
function selectSavedCorpse113c(this: GameInstanceHost, p: InternalPlayerRecord): {
  readonly items: readonly ServerItemEntry[]
  readonly x: number
  readonly y: number
} {
  const extras = (p.extraCorpses ?? []).filter((c) => c.items.length > 0)
  if (extras.length === 0) {
    return { items: p.corpseItems, x: p.corpseX, y: p.corpseY }
  }
  const candidates: ReadonlyArray<{
    readonly items: readonly ServerItemEntry[]
    readonly x: number
    readonly y: number
  }> =
    p.corpseItems.length > 0
      ? [{ items: p.corpseItems, x: p.corpseX, y: p.corpseY }, ...extras]
      : extras
  const tables = getEmbeddedDropTables()
  const scoreSet = (set: readonly ServerItemEntry[]): number => {
    let total = 0
    for (const item of set) {
      const baseCost = tables.getBase(item.code)?.cost ?? 0
      const qual = this.normalizeItemQualityCode113c(item.rawItemData?.quality ?? item.quality)
      const qualMult = qual === 7 ? 5 : qual === 5 ? 4 : qual === 6 ? 3 : qual === 4 ? 2 : 1
      total += Math.max(item.cost, baseCost) * qualMult + 1
    }
    return total
  }
  let best = candidates[0]!
  let bestScore = scoreSet(best.items)
  for (let i = 1; i < candidates.length; i++) {
    const s = scoreSet(candidates[i]!.items)
    if (s > bestScore) {
      bestScore = s
      best = candidates[i]!
    }
  }
  return best
}



function computeFrameLockstepHash(this: GameInstanceHost): number {
  let h = 0x811c9dc5
  const mix = (val: number): void => {
    const v = val >>> 0
    h ^= v & 0xff
    h = Math.imul(h, 0x01000193) >>> 0
    h ^= (v >>> 8) & 0xff
    h = Math.imul(h, 0x01000193) >>> 0
    h ^= (v >>> 16) & 0xff
    h = Math.imul(h, 0x01000193) >>> 0
    h ^= (v >>> 24) & 0xff
    h = Math.imul(h, 0x01000193) >>> 0
  }

  mix(this.currentFrame)
  mix(this.currentMapSeed)
  const rngState = this.rng.getSeed()
  mix(rngState.lo)
  mix(rngState.hi)
  mix(this.playersX)

  for (const p of this.players.values()) {
    mix(p.unitId)
    mix(p.areaId)
    mix(Math.round(p.x * 100))
    mix(Math.round(p.y * 100))
    mix(p.hpFixed)
    mix(p.maxHpFixed)
    mix(p.manaFixed)
    mix(p.experience)
    mix(p.level)
    mix(p.strength)
    mix(p.dexterity)
    mix(p.vitality)
    mix(p.energy)
    mix(p.gold)
    mix(p.statPts)
    mix(p.newSkills)
    mix(p.items.length)
    mix(p.dead ? 1 : 0)
  }

  for (const m of this.monsters.values()) {
    mix(m.unitId)
    mix(m.areaId)
    mix(Math.round(m.x * 100))
    mix(Math.round(m.y * 100))
    mix(m.hp)
    mix(m.mode)
    mix(m.dead ? 1 : 0)
  }

  for (const merc of this.mercenaries.values()) {
    mix(merc.unitId)
    mix(merc.areaId)
    mix(Math.round(merc.x * 100))
    mix(Math.round(merc.y * 100))
    mix(merc.hp)
    mix(merc.alive ? 1 : 0)
  }

  for (const [ownerId, mgr] of this.summonManagers.entries()) {
    mix(ownerId)
    for (const pet of mgr.getActivePets()) {
      mix(Math.round(pet.x * 100))
      mix(Math.round(pet.y * 100))
      mix(pet.hp)
    }
  }

  for (const ms of this.missiles.values()) {
    mix(ms.unitId)
    mix(Math.round(ms.x * 100))
    mix(Math.round(ms.y * 100))
  }

  for (const g of this.groundItems.values()) {
    mix(g.unitId)
    mix(Math.round(g.x * 100))
    mix(Math.round(g.y * 100))
    mix(g.quality)
  }

  return h >>> 0
}



function getStateHash(this: GameInstanceHost): number {
  return this.computeFrameLockstepHash()
}



function getLastLockstepHash(this: GameInstanceHost): number {
  return this.computeFrameLockstepHash()
}

export interface SnapshotsAndD2sMethods {
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
  getNpcVendorPool(npcUnitId: number): readonly ServerItemEntry[]
  getAllUnits(): readonly ServerUnitSummary[]
  exportPlayerD2s(playerUnitId: number, options?: { readonly timestampSec?: number | undefined }): Uint8Array
  selectSavedCorpse113c(p: InternalPlayerRecord): {
  readonly items: readonly ServerItemEntry[]
  readonly x: number
  readonly y: number
}
  computeFrameLockstepHash(): number
  getStateHash(): number
  getLastLockstepHash(): number
}

export const snapshotsAndD2sMethods: Record<keyof SnapshotsAndD2sMethods, unknown> = {
  drainEvents,
  drainPlayerEvents,
  getPlayerState,
  getMonsterState,
  getMonster,
  listMonsters,
  applyPlayerState,
  applyMonsterState,
  applyStateToMonster,
  getNpcVendorPool,
  getAllUnits,
  exportPlayerD2s,
  selectSavedCorpse113c,
  computeFrameLockstepHash,
  getStateHash,
  getLastLockstepHash,
}
