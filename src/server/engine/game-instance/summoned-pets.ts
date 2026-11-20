/**
 * GameInstance Subsystem: SummonManager, Iron Golem, Pet Summoning/Unsummoning, Druid Spirit Auras & Pet AI (`src/server/engine/game-instance/summoned-pets.ts`).
 */

import { getEmbeddedDropTables } from '../../../common/items/embedded-drop-tables.ts'
import { resolveWeaponBase113c } from '../../../common/units/char-anim-speed.ts'
import { FRIENDLY_AURA_TARGET_STATE_IDS_113C } from '../../../common/skills/paladin-auras.ts'
import { getMissileTxtData } from '../../../common/skills/missiles-data.ts'
import { PET_TYPE_IDX_BY_NAME_113C, PET_TYPE_PORTRAIT_TABLE } from '../../../common/units/pet-type-table.ts'
import type { ServerEvent } from '../../../netproto/index.ts'
import { isMetalItemCode113c } from '../../../common/items/metal-items-113c.ts'
import { SummonManager, resolvePetAiProfile113c, type CreatePetOutcome, type SummonedPetUnit } from '../../ai/summon-manager.ts'
import { executeSUnitDmg, type SUnitDmgPacket, type CombatUnitContext } from '../combat-pipeline.ts'
import type { IronGolemItemProps, MissileEngine } from '../missile-engine.ts'
import { FIXED_ONE, UnitStatList } from '../stat-list.ts'
import { StateBus } from '../state-bus.ts'
import { AuraScanner } from '../aura-scanner.ts'
import { isWithinAuraRange, passesAuraFilter } from '../../../common/skills/aura-filter.ts'
import type { GameInstanceHost } from './host.ts'
import type { InternalMercenaryRecord, InternalMonsterRecord, InternalPlayerRecord, ServerItemEntry, SummonPetSpec } from './types.ts'
import { TOWN_AREAS, normalizeMissileElement, UNIT_TYPE_113C } from './constants-and-helpers.ts'
import { initOracleSummonedPet113c, NecroPetNotPortedError113c, stepNecroPet113c } from './necropet-ai-113c.ts'


function getSummonManager(this: GameInstanceHost, ownerPlayerId: number): SummonManager {
  let mgr = this.summonManagers.get(ownerPlayerId)
  if (!mgr) {
    mgr = new SummonManager(this.registry)
    this.summonManagers.set(ownerPlayerId, mgr)
  }
  return mgr
}



function buildOwnerSummonCombatContext113c(this: GameInstanceHost, ownerPlayerId: number): CombatUnitContext {
  const owner = this.players.get(ownerPlayerId)
  const statList = new UnitStatList(this.registry, undefined, {
    ownerType: 'player',
    charClass: owner?.classCode ?? 'nec',
  })
  statList.setBaseStat('level', owner?.level ?? 1)
  statList.setBaseStat('strength', owner ? owner.strength + this.sumPlayerItemStat(owner, 0) : 0)
  statList.setBaseStat('dexterity', owner ? owner.dexterity + this.sumPlayerItemStat(owner, 2) : 0)
  statList.setBaseStat('vitality', owner ? owner.vitality + this.sumPlayerItemStat(owner, 3) : 0)
  statList.setBaseStat('energy', owner ? owner.energy + this.sumPlayerItemStat(owner, 1) : 0)
  statList.setBaseStat('tohit', owner ? this.computePlayerBaseToHit113c(owner) : 0)
  statList.setBaseStat('armorclass', owner ? this.computePlayerDefense(owner) : 0)
  const maxHpFixed = owner ? this.getPlayerAccruedMaxHpFixed(owner) : 100 * FIXED_ONE
  const maxManaFixed = owner ? this.getPlayerAccruedMaxManaFixed(owner) : 0
  statList.setBaseStat('maxhp', maxHpFixed)
  statList.setHp256(owner?.hpFixed ?? maxHpFixed)
  statList.setBaseStat('maxmana', maxManaFixed)
  statList.setMana256(owner?.manaFixed ?? 0)
  const stateBus = new StateBus(statList, this.registry)
  if (owner) {
    this.mirrorPersistentStates(this.playerCombat.get(owner.unitId), stateBus)
    if (owner.states.has(51) && !stateBus.hasState(51)) {
      stateBus.applyState({
        stateNameOrId: 'battlecommand',
        sourceUnitId: `player_${owner.unitId}`,
        sourceSkillId: 155,
        slvl: 1,
        currentFrame: this.currentFrame,
        stats: { item_allskills: 1 },
      })
    }
    this.applyItemMasteryPierceStats113c(statList, (sid) => this.sumPlayerItemStat(owner, sid))
    this.syncPlayerSkillLevelsToStatList113c(owner, statList, stateBus)
  }
  return {
    id: String(ownerPlayerId),
    name: owner?.name ?? `Player_${ownerPlayerId}`,
    unitType: 'player',
    statList,
    stateBus,
    x: owner?.x ?? 128,
    y: owner?.y ?? 128,
  }
}



function extractIronGolemPropsFromEntry113c(this: GameInstanceHost, 
  entry: ServerItemEntry,
  ownerLevel: number,
): {
  readonly props: IronGolemItemProps & {
    readonly fireResist?: number
    readonly lightResist?: number
    readonly coldResist?: number
    readonly poisonResist?: number
  }
  readonly auraLevels: Map<number, number>
  readonly extraStats: {
    readonly minDamage?: number
    readonly maxDamage?: number
    readonly damageResist: number
    readonly magicResist: number
    readonly crushingBlow: number
    readonly openWounds: number
    readonly deadlyStrike: number
    readonly thornsFlat: number
    readonly fireMinDam: number
    readonly fireMaxDam: number
    readonly lightMinDam: number
    readonly lightMaxDam: number
    readonly coldMinDam: number
    readonly coldMaxDam: number
  }
} {
  const isMetallic = isMetalItemCode113c(entry.code)
  const isEth = entry.ethereal === true || entry.rawItemData?.ethereal === true
  const stats = this.collectServerItemEntryStats113c(entry)
  let edPct = 0
  let flatMin = 0
  let flatMax = 0
  let armorEdPct = 0
  let flatDef = 0
  let physRes = 0
  let magRes = 0
  let fireRes = 0
  let lightRes = 0
  let coldRes = 0
  let poisRes = 0
  let crushingBlow = 0
  let openWounds = 0
  let deadlyStrike = 0
  let thornsFlat = 0
  let fireMinDam = 0
  let fireMaxDam = 0
  let lightMinDam = 0
  let lightMaxDam = 0
  let coldMinDam = 0
  let coldMaxDam = 0
  const auraLevels = new Map<number, number>()
  for (const st of stats) {
    if (st.statId === 17) edPct += st.value
    else if (st.statId === 219) edPct += (st.value * ownerLevel) >> 3
    else if (st.statId === 21 || st.statId === 23 || st.statId === 111) flatMin += st.value
    else if (st.statId === 22 || st.statId === 24 || st.statId === 111) flatMax += st.value
    else if (st.statId === 218) flatMax += (st.value * ownerLevel) >> 3
    else if (st.statId === 16) armorEdPct += st.value
    else if (st.statId === 31) flatDef += st.value
    else if (st.statId === 214) flatDef += (st.value * ownerLevel) >> 3
    else if (st.statId === 36) physRes += st.value
    else if (st.statId === 37) magRes += st.value
    else if (st.statId === 39) fireRes += st.value
    else if (st.statId === 41) lightRes += st.value
    else if (st.statId === 43) coldRes += st.value
    else if (st.statId === 45) poisRes += st.value
    else if (st.statId === 48) fireMinDam += st.value
    else if (st.statId === 49) fireMaxDam += st.value
    else if (st.statId === 50) lightMinDam += st.value
    else if (st.statId === 51) lightMaxDam += st.value
    else if (st.statId === 54) coldMinDam += st.value
    else if (st.statId === 55) coldMaxDam += st.value
    else if (st.statId === 78) thornsFlat += st.value
    else if (st.statId === 135) openWounds += st.value
    else if (st.statId === 136) crushingBlow += st.value
    else if (st.statId === 141) deadlyStrike += st.value
    else if (st.statId === 151 && st.param > 0 && st.value > 0) {
      auraLevels.set(st.param, (auraLevels.get(st.param) ?? 0) + st.value)
    }
  }

  let minDamage: number | undefined
  let maxDamage: number | undefined
  let defense: number | undefined
  const wb = resolveWeaponBase113c(entry.code)
  if (wb !== undefined) {
    const baseMin = wb.twoHanded && wb.twoHandedMindam ? wb.twoHandedMindam : wb.mindam
    const baseMax = wb.twoHanded && wb.twoHandedMaxdam ? wb.twoHandedMaxdam : wb.maxdam
    const ethMin = isEth ? Math.floor(baseMin * 1.5) : baseMin
    const ethMax = isEth ? Math.floor(baseMax * 1.5) : baseMax
    minDamage = Math.max(1, Math.trunc((ethMin * (100 + edPct)) / 100) + flatMin)
    maxDamage = Math.max(minDamage, Math.trunc((ethMax * (100 + edPct)) / 100) + flatMax)
  }
  const armorRec = getEmbeddedDropTables().armor.get(entry.code.trim().toLowerCase())
  const explicitDef = (entry.rawItemData as { readonly defense?: number } | undefined)?.defense
  if (armorRec !== undefined || flatDef > 0 || (explicitDef ?? 0) > 0) {
    const rawAc = explicitDef ?? armorRec?.maxac ?? 0
    const ethAc = isEth && explicitDef === undefined ? Math.floor(rawAc * 1.5) : rawAc
    defense = Math.max(0, Math.trunc((ethAc * (100 + armorEdPct)) / 100) + flatDef)
  }
  const avgBaseDamage =
    minDamage !== undefined && maxDamage !== undefined
      ? Math.floor((minDamage + maxDamage) / 2)
      : undefined

  return {
    props: {
      isMetallic,
      isEthereal: isEth,
      ...(minDamage !== undefined ? { minDamage } : {}),
      ...(maxDamage !== undefined ? { maxDamage } : {}),
      ...(avgBaseDamage !== undefined ? { baseDamage: avgBaseDamage } : {}),
      ...(defense !== undefined ? { defense } : {}),
      ...(auraLevels.size > 0 ? { auras: [...auraLevels.keys()] } : {}),
      fireResist: fireRes,
      lightResist: lightRes,
      coldResist: coldRes,
      poisonResist: poisRes,
    },
    auraLevels,
    extraStats: {
      ...(minDamage !== undefined ? { minDamage } : {}),
      ...(maxDamage !== undefined ? { maxDamage } : {}),
      damageResist: physRes,
      magicResist: magRes,
      crushingBlow,
      openWounds,
      deadlyStrike,
      thornsFlat,
      fireMinDam,
      fireMaxDam,
      lightMinDam,
      lightMaxDam,
      coldMinDam,
      coldMaxDam,
    },
  }
}



/**
 * 1.13c `D2Game.dll` `SKILLS_SrvSt20_IronGolem` (`0x6FC6EDD0`) + `SKILLS_SrvDo_IronGolem` (`0x6FD01D20`):
 * Validates that a ground metallic weapon/armor item is targeted BEFORE deducting mana/cooldown,
 * consumes the ground item, and spawns the Iron Golem (`#90`) bound to `player.ironGolemItem` (#1787).
 */
function executeIronGolemSkillCast113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  target: {
    readonly targetItemId?: number | undefined
    readonly tx?: number | undefined
    readonly ty?: number | undefined
  },
): void {
  if (player.dead || this.isPlayerInHitRecovery(player)) return
  const cast = this.resolvePlayerSkillCast(player, 90)
  if (cast === null) return

  let groundItem: ServerItemEntry | undefined
  if (target.targetItemId !== undefined) {
    const candidate = this.groundItems.get(target.targetItemId)
    if (candidate && (candidate.areaId === undefined || candidate.areaId === player.areaId)) {
      groundItem = candidate
    }
  } else if (
    target.tx !== undefined &&
    target.ty !== undefined &&
    Number.isFinite(target.tx) &&
    Number.isFinite(target.ty)
  ) {
    let bestDist = 6
    for (const g of this.groundItems.values()) {
      if (g.areaId !== undefined && g.areaId !== player.areaId) continue
      const d = Math.hypot(g.x - target.tx, g.y - target.ty)
      if (d <= bestDist) {
        bestDist = d
        groundItem = g
      }
    }
  }

  if (groundItem === undefined || !isMetalItemCode113c(groundItem.code)) {
    return
  }

  if (this.animActionWindupEnabled) {
    const targetUnitId = groundItem.unitId
    const targetX = Math.round(groundItem.x)
    const targetY = Math.round(groundItem.y)
    this.schedulePlayerSkillWindup113c(
      player,
      cast,
      targetX,
      targetY,
      { x: targetX, y: targetY },
      {
        onStrike: () => {
          const liveItem = this.groundItems.get(targetUnitId)
          if (
            liveItem === undefined ||
            (liveItem.areaId !== undefined && liveItem.areaId !== player.areaId) ||
            !isMetalItemCode113c(liveItem.code)
          ) {
            return
          }
          this.summonPet(player.unitId, {
            skillId: 90,
            slvl: cast.slvl,
            x: liveItem.x,
            y: liveItem.y,
            ironGolemItemId: liveItem.unitId,
          })
        },
      },
    )
    return
  }

  this.commitPlayerSkillCast(player, cast)
  this.broadcastPlayerSkillCast(player, cast, {
    x: Math.round(groundItem.x),
    y: Math.round(groundItem.y),
  })
  this.summonPet(player.unitId, {
    skillId: 90,
    slvl: cast.slvl,
    x: groundItem.x,
    y: groundItem.y,
    ironGolemItemId: groundItem.unitId,
  })
}



function summonPet(this: GameInstanceHost, ownerPlayerId: number, spec: SummonPetSpec): CreatePetOutcome {
  const owner = this.players.get(ownerPlayerId)
  const mgr = this.getSummonManager(ownerPlayerId)
  const ownerCtx = this.buildOwnerSummonCombatContext113c(ownerPlayerId)
  const slvl = Math.max(
    1,
    spec.slvl ??
      spec.skillLevel ??
      (owner ? Math.max(1, this.resolvePlayerSkillLevelById(owner, spec.skillId)) : 1),
  )
  const curEff = ownerCtx.statList.getEffectiveSkillLevel(spec.skillId)
  if (slvl !== curEff) {
    const baseLvl = ownerCtx.statList.getBaseSkillLevel(spec.skillId)
    const modAllSkills = Math.trunc(ownerCtx.statList.getModifierBonus('item_allskills'))
    ownerCtx.statList.setBonusSkillLevel(spec.skillId, slvl - baseLvl - modAllSkills)
  }

  const areaId = owner?.areaId ?? this.defaultAreaId ?? 1
  let targetIronGolemGroundItem: ServerItemEntry | undefined
  let ironGolemExtracted:
    | ReturnType<typeof this.extractIronGolemPropsFromEntry113c>
    | undefined

  if (spec.skillId === 90) {
    if (spec.restoreSavedIronGolem === true) {
      const savedEntry = owner?.ironGolemItem ?? undefined
      if (!savedEntry) {
        return {
          created: false,
          reason: 'invalid_item',
          evictedPetUids: [],
          activeCountForType: mgr.getActivePets().filter((p) => p.petType === 'golem').length,
        }
      }
      ironGolemExtracted = this.extractIronGolemPropsFromEntry113c(
        savedEntry,
        owner?.level ?? 1,
      )
    } else {
      if (spec.ironGolemItemId !== undefined) {
        const g = this.groundItems.get(spec.ironGolemItemId)
        if (g && (g.areaId === undefined || g.areaId === areaId)) {
          targetIronGolemGroundItem = g
        }
      } else if (spec.x !== undefined && spec.y !== undefined) {
        let bestDist = 6
        for (const g of this.groundItems.values()) {
          if (g.areaId !== undefined && g.areaId !== areaId) continue
          const d = Math.hypot(g.x - spec.x, g.y - spec.y)
          if (d <= bestDist) {
            bestDist = d
            targetIronGolemGroundItem = g
          }
        }
      }
      if (!targetIronGolemGroundItem) {
        return {
          created: false,
          reason: 'invalid_item',
          evictedPetUids: [],
          activeCountForType: mgr.getActivePets().filter((p) => p.petType === 'golem').length,
        }
      }
      ironGolemExtracted = this.extractIronGolemPropsFromEntry113c(
        targetIronGolemGroundItem,
        owner?.level ?? 1,
      )
    }
    if (!ironGolemExtracted.props.isMetallic) {
      return {
        created: false,
        reason: 'invalid_item',
        evictedPetUids: [],
        activeCountForType: mgr.getActivePets().filter((p) => p.petType === 'golem').length,
      }
    }
  }

  const requiresCorpse =
    spec.skillId === 70 || spec.skillId === 80 || spec.skillId === 95
  const corpses: {
    id: string
    consumed: boolean
    baseMaxHp?: number
    classId?: number
    monId?: string
    monsterLevel?: number
    isBoss?: boolean
    revivable?: boolean
    isUnique?: boolean
    isChampion?: boolean
    states?: ReadonlySet<number>
    x?: number
    y?: number
    _monsterRef?: InternalMonsterRecord
  }[] = []

  if (requiresCorpse) {
    for (const m of this.monsters.values()) {
      if (!m.dead || m.shattered || m.isNpc) continue
      if (owner && m.areaId !== owner.areaId) continue
      if (
        spec.corpseMonsterId !== undefined &&
        m.unitId !== spec.corpseMonsterId
      ) {
        continue
      }
      corpses.push({
        id: String(m.unitId),
        consumed: false,
        baseMaxHp: m.baseMaxHp,
        classId: m.classId,
        monId: m.defId,
        monsterLevel: m.level,
        isBoss: m.isBoss,
        revivable: !m.isBoss && m.rank === 'normal',
        isUnique: m.rank === 'unique',
        isChampion: m.rank === 'champion',
        states: m.states,
        x: m.x,
        y: m.y,
        _monsterRef: m,
      })
    }
    const refX = spec.x ?? (owner ? owner.x : 0)
    const refY = spec.y ?? (owner ? owner.y : 0)
    corpses.sort((a, b) => {
      const da = ((a.x ?? refX) - refX) ** 2 + ((a.y ?? refY) - refY) ** 2
      const db = ((b.x ?? refX) - refX) ** 2 + ((b.y ?? refY) - refY) ** 2
      return da - db
    })
  }

  let spawnX = spec.x ?? (owner ? owner.x + 1 : 128)
  let spawnY = spec.y ?? (owner ? owner.y + 1 : 128)
  if (
    this.terrainWalkableCheck &&
    !this.isWorldWalkableForPlayer(areaId, Math.round(spawnX), Math.round(spawnY))
  ) {
    let nudged = false
    for (let r = 1; r <= 5 && !nudged; r++) {
      for (let dy = -r; dy <= r && !nudged; dy++) {
        for (let dx = -r; dx <= r && !nudged; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
          const cx = Math.round(spawnX) + dx
          const cy = Math.round(spawnY) + dy
          if (this.isWorldWalkableForPlayer(areaId, cx, cy)) {
            spawnX = cx
            spawnY = cy
            nudged = true
          }
        }
      }
    }
    if (!nudged && owner) {
      spawnX = owner.x
      spawnY = owner.y
    }
  }

  if (requiresCorpse && corpses.length > 1) {
    const targetX = spec.x ?? owner?.x ?? spawnX
    const targetY = spec.y ?? owner?.y ?? spawnY
    corpses.sort(
      (a, b) =>
        Math.hypot((a.x ?? 0) - targetX, (a.y ?? 0) - targetY) -
        Math.hypot((b.x ?? 0) - targetX, (b.y ?? 0) - targetY),
    )
  }

  const prePetMetaByUid = new Map(
    mgr.getActivePets().map((p) => [
      p.uid,
      {
        classId: p.classId ?? 363,
        sourceSkillId: p.sourceSkillId,
        petTypeIdx:
          PET_TYPE_IDX_BY_NAME_113C[p.petType] ?? PET_TYPE_PORTRAIT_TABLE[0]?.idx ?? 1,
      },
    ]),
  )
  const outcome = mgr.createPet({
    owner: ownerCtx,
    skillId: spec.skillId,
    slvl,
    x: spawnX,
    y: spawnY,
    difficulty: this.difficulty,
    ...(this.drlgRoomPopulator !== null ? { skipMonEquipLoadout113c: true } : {}),
    ...(requiresCorpse ? { corpses } : {}),
    ...(ironGolemExtracted !== undefined ? { ironGolemItem: ironGolemExtracted.props } : {}),
  })

  if (outcome.created && targetIronGolemGroundItem !== undefined) {
    this.groundItems.delete(targetIronGolemGroundItem.unitId)
    this.broadcastToArea(areaId, {
      type: 'UnitRemove',
      unitType: 4,
      id: targetIronGolemGroundItem.unitId,
      unitId: targetIronGolemGroundItem.unitId,
    })
    if (owner) {
      owner.ironGolemItem = targetIronGolemGroundItem
    }
  }

  for (const c of corpses) {
    if (c.consumed && c._monsterRef) {
      c._monsterRef.shattered = true
      this.broadcastToArea(c._monsterRef.areaId, {
        type: 'UnitRemove',
        unitType: 1,
        id: c._monsterRef.unitId,
        unitId: c._monsterRef.unitId,
        areaId: c._monsterRef.areaId,
      })
      // 1.13c `SKILLS_SrvDo031_RaiseSkeleton_Mage` (`0x6FC718B0`) frees the corpse unit with
      // `SUNIT_RemoveUnit` (`0x6FD020A0`, call at `0x6FC7199B`) before `0x6FCC3610` spawns the pet.
      // `SKILLS_SrvDo058_Revive` (`0x6FC71340`) and the other corpse consumers never call it.
      if (spec.skillId === 70 || spec.skillId === 80) {
        this.monsters.delete(c._monsterRef.unitId)
      }
    }
  }
  for (const evictedUid of outcome.evictedPetUids) {
    this.petAuraScanners.delete(evictedUid)
    for (const [mId, msl] of this.missiles.entries()) {
      if (msl.trapPetUid === evictedUid) {
        this.missiles.delete(mId)
      }
    }
    const evictedMeta = prePetMetaByUid.get(evictedUid)
    if (evictedMeta?.sourceSkillId === 90 && spec.skillId !== 90 && owner) {
      owner.ironGolemItem = null
    }
    const evictedUnitId = this.petUnitIds.get(evictedUid)
    if (evictedUnitId !== undefined) {
      this.petUnitIds.delete(evictedUid)
      this.petVisualStates.delete(evictedUnitId)
      this.broadcastToArea(areaId, {
        type: 'UnitRemove',
        unitType: 1,
        id: evictedUnitId,
        unitId: evictedUnitId,
      })
      this.emitToPlayer(ownerPlayerId, {
        type: 'Merc',
        kind: 'assign',
        isSummonAction: true,
        summonAction: 0,
        petType: evictedMeta?.petTypeIdx ?? 1,
        mercId: evictedUnitId,
        ownerId: ownerPlayerId,
        classId: evictedMeta?.classId ?? 363,
      })
    }
  }

  if (outcome.created && outcome.pet) {
    if (ironGolemExtracted !== undefined) {
      const ex = ironGolemExtracted.extraStats
      const fgBlvl = owner?.skills.get(94) ?? 0
      const synMult = 100 + fgBlvl * 6
      const baseMinTable = [7, 11, 12] as const
      const baseMaxTable = [19, 30, 33] as const
      if (ex.minDamage !== undefined) {
        outcome.pet.statList.setBaseStat(
          'mindamage',
          Math.floor((((baseMinTable[this.difficulty] ?? 7) + ex.minDamage) * synMult) / 100),
        )
      }
      if (ex.maxDamage !== undefined) {
        outcome.pet.statList.setBaseStat(
          'maxdamage',
          Math.floor((((baseMaxTable[this.difficulty] ?? 19) + ex.maxDamage) * synMult) / 100),
        )
      }
      if (ex.damageResist !== 0) outcome.pet.statList.addStat(36, ex.damageResist)
      if (ex.magicResist !== 0) outcome.pet.statList.addStat(37, ex.magicResist)
      if (ex.crushingBlow > 0) outcome.pet.statList.addStat(136, ex.crushingBlow)
      if (ex.openWounds > 0) outcome.pet.statList.addStat(135, ex.openWounds)
      if (ex.deadlyStrike > 0) outcome.pet.statList.addStat(141, ex.deadlyStrike)
      if (ex.thornsFlat > 0) outcome.pet.statList.addStat(78, ex.thornsFlat)
      if (ex.fireMaxDam > 0) {
        outcome.pet.statList.addStat(48, ex.fireMinDam)
        outcome.pet.statList.addStat(49, ex.fireMaxDam)
      }
      if (ex.lightMaxDam > 0) {
        outcome.pet.statList.addStat(50, ex.lightMinDam)
        outcome.pet.statList.addStat(51, ex.lightMaxDam)
      }
      if (ex.coldMaxDam > 0) {
        outcome.pet.statList.addStat(54, ex.coldMinDam)
        outcome.pet.statList.addStat(55, ex.coldMaxDam)
      }
    }
    const petUnitId = this.allocateUnitId(UNIT_TYPE_113C.monster)
    this.petUnitIds.set(outcome.pet.uid, petUnitId)
    const petMeta = outcome.pet as unknown as {
      unitId?: number
      areaId?: number
      states?: Set<number>
      inheritedAuraLevels?: Map<number, number>
    }
    const vis = this.getOrCreatePetCombatContext113c(outcome.pet, petUnitId, areaId)
    petMeta.unitId = petUnitId
    petMeta.areaId = areaId
    petMeta.states = vis.states
    if (this.drlgRoomPopulator !== null) {
      initOracleSummonedPet113c(this, outcome.pet, petUnitId, areaId, spec.skillId)
    }
    if (ironGolemExtracted !== undefined && ironGolemExtracted.auraLevels.size > 0) {
      petMeta.inheritedAuraLevels = ironGolemExtracted.auraLevels
    }
    const petTypeIdx =
      PET_TYPE_IDX_BY_NAME_113C[outcome.pet.petType] ??
      PET_TYPE_PORTRAIT_TABLE[0]?.idx ??
      1
    const classId = outcome.pet.classId ?? 363
    this.broadcastToArea(areaId, {
      type: 'UnitAssign',
      unitType: 'monster',
      unitId: petUnitId,
      classId,
      name: outcome.pet.name,
      x: outcome.pet.x,
      y: outcome.pet.y,
      areaId,
      unit: {
        unitType: 1,
        id: petUnitId,
        classId,
        name: outcome.pet.name,
        x: outcome.pet.x,
        y: outcome.pet.y,
        mode: 1,
        lifePct: 128,
        ownerType: 0,
        ownerId: ownerPlayerId,
      },
    })
    this.emitToPlayer(ownerPlayerId, {
      type: 'Merc',
      kind: 'assign',
      isSummonAction: true,
      summonAction: 1,
      petType: petTypeIdx,
      mercId: petUnitId,
      ownerId: ownerPlayerId,
      classId,
    })
    const spiritSkillId = outcome.pet.subSkillIds.find(
      (id) => id === 296 || id === 297 || id === 298,
    )
    if (spiritSkillId !== undefined && owner !== undefined) {
      this.pulseDruidSpiritPetAura113c(owner, outcome.pet, petUnitId, spiritSkillId, true)
    } else if (
      outcome.pet.inheritedAuras !== undefined &&
      outcome.pet.inheritedAuras.length > 0 &&
      owner !== undefined
    ) {
      const inheritedSkillId = outcome.pet.inheritedAuras[0]!
      const inheritedSlvl = petMeta.inheritedAuraLevels?.get(inheritedSkillId) ?? 1
      this.pulseDruidSpiritPetAura113c(
        owner,
        outcome.pet,
        petUnitId,
        inheritedSkillId,
        true,
        inheritedSlvl,
      )
    }
  }

  return outcome
}



function unsummonPetAt(this: GameInstanceHost, 
  ownerPlayerId: number,
  x: number,
  y: number,
  radius = 80,
): SummonedPetUnit | null {
  const mgr = this.summonManagers.get(ownerPlayerId)
  if (!mgr) return null
  const removed = mgr.unsummonOwnPetAt(String(ownerPlayerId), x, y, radius)
  if (removed) {
    this.petAuraScanners.delete(removed.uid)
    const petUnitId = this.petUnitIds.get(removed.uid)
    const owner = this.players.get(ownerPlayerId)
    if (removed.sourceSkillId === 90 && owner) {
      owner.ironGolemItem = null
    }
    const areaId = owner?.areaId ?? this.defaultAreaId ?? 1
    if (petUnitId !== undefined) {
      this.petUnitIds.delete(removed.uid)
      this.petVisualStates.delete(petUnitId)
      this.broadcastToArea(areaId, {
        type: 'UnitRemove',
        unitType: 1,
        id: petUnitId,
        unitId: petUnitId,
      })
      this.emitToPlayer(ownerPlayerId, {
        type: 'Merc',
        kind: 'assign',
        isSummonAction: true,
        summonAction: 0,
        petType: PET_TYPE_IDX_BY_NAME_113C[removed.petType] ?? 1,
        mercId: petUnitId,
        ownerId: ownerPlayerId,
        classId: removed.classId ?? 363,
      })
    }
  }
  return removed
}



function getPetsForOwner(this: GameInstanceHost, ownerPlayerId: number): readonly SummonedPetUnit[] {
  const mgr = this.summonManagers.get(ownerPlayerId)
  return mgr ? mgr.getActivePets().filter((pet) => pet.alive !== false && pet.hp > 0) : []
}



function getPetState(this: GameInstanceHost, 
  idOrOutcome:
    | number
    | string
    | {
        readonly pet?: SummonedPetUnit | null | undefined
        readonly uid?: string | undefined
      },
): SummonedPetUnit | undefined {
  if (typeof idOrOutcome === 'object' && idOrOutcome !== null) {
    const targetUid = idOrOutcome.pet?.uid ?? idOrOutcome.uid
    if (targetUid) {
      for (const mgr of this.summonManagers.values()) {
        for (const pet of mgr.getActivePets()) {
          if (pet.uid === targetUid) return pet
        }
      }
    }
    return idOrOutcome.pet ?? undefined
  }
  for (const mgr of this.summonManagers.values()) {
    for (const pet of mgr.getActivePets()) {
      const mappedId =
        this.petUnitIds.get(pet.uid) ??
        (pet as unknown as { unitId?: number }).unitId
      if (
        pet.uid === String(idOrOutcome) ||
        mappedId === idOrOutcome ||
        Number(pet.uid) === idOrOutcome
      ) {
        return pet
      }
    }
  }
  return undefined
}



/**
 * Pulse a Druid Spirit Totem's 1.13c aura sub-skill (`#296` Barbs Aura -> `147`, `#297` Wolverine
 * Aura -> `148`, `#298` Oak Sage Aura -> `149`) or an Iron Golem's inherited `item_aura` (`stat 151`,
 * e.g. `Insight` `#120` Meditation) across allied players, mercenaries, and pets.
 */
function pulseDruidSpiritPetAura113c(this: GameInstanceHost, 
  owner: InternalPlayerRecord,
  pet: SummonedPetUnit,
  petUnitId: number,
  spiritSkillId: number,
  forceInitial = false,
  slvlOverride?: number,
): void {
  const skill = this.registry.getSkillById(spiritSkillId)
  if (!skill || !skill.aura) return
  const slvl = Math.max(1, slvlOverride ?? pet.slvl)
  const radiusSubtiles = this.auraRangeSubtiles(spiritSkillId, slvl)
  const casterStateId = skill.auraState ? this.registry.getStateByName(skill.auraState)?.id : undefined
  const targetStateId = skill.auraTgtState ? this.registry.getStateByName(skill.auraTgtState)?.id : undefined
  const signature = `${spiritSkillId}:${slvl}`
  const petVis = this.getOrCreatePetCombatContext113c(pet, petUnitId, owner.areaId)
  let runtime = this.petAuraScanners.get(pet.uid)
  const signatureChanged = runtime === undefined || runtime.signature !== signature
  if (signatureChanged) {
    const scanner = new AuraScanner(this.registry, (this.currentMapSeed ^ petUnitId) >>> 0)
    const pulseTick = Math.max(1, this.currentFrame)
    const source = scanner.setActiveAura(petVis.ctx, spiritSkillId, slvl, pulseTick)
    if (source === null) return
    if (casterStateId !== undefined) {
      this.applyPersistentUnitState(
        petVis.states,
        petVis.timers,
        'monster',
        petUnitId,
        owner.areaId,
        casterStateId,
      )
    }
    runtime = {
      scanner,
      signature,
      sources: [
        {
          skillId: spiritSkillId,
          slvl,
          isItemAura: false,
          radiusSubtiles,
          casterStateId,
          targetStateId,
          source,
        },
      ],
      needsInitialPulse: true,
    }
    this.petAuraScanners.set(pet.uid, runtime)
  } else if (runtime !== undefined && casterStateId !== undefined && !petVis.states.has(casterStateId)) {
    this.applyPersistentUnitState(
      petVis.states,
      petVis.timers,
      'monster',
      petUnitId,
      owner.areaId,
      casterStateId,
    )
  }
  if (runtime === undefined || runtime.sources.length === 0) return
  runtime.scanner.syncCasterPosition(pet.x, pet.y)

  const targets = this.collectFriendlyAuraAllies113c({
    ownerPlayerId: owner.unitId,
    areaId: owner.areaId,
    originX: pet.x,
    originY: pet.y,
    maxRadius: radiusSubtiles,
    selfPet: pet,
  })
  const auraEnv = {
    isTown: TOWN_AREAS.has(owner.areaId),
    hasLineOfSight: (src: CombatUnitContext, tgt: { x?: number; y?: number }) =>
      src.x === undefined || src.y === undefined || tgt.x === undefined || tgt.y === undefined
        ? false
        : this.isMonsterStepWalkable(owner.areaId, src.x, src.y, tgt.x, tgt.y, true),
    rng: this.rng,
  }
  const pulseTick = Math.max(1, this.currentFrame)
  const entry = runtime.sources[0]!
  if (runtime.needsInitialPulse || forceInitial) {
    runtime.needsInitialPulse = false
    runtime.scanner.pulseAura(entry.source, pulseTick, targets.allAllies, [], [], auraEnv)
  } else {
    runtime.scanner.tick(this.currentFrame, targets.allAllies, [], [], auraEnv)
    if (targetStateId !== undefined && FRIENDLY_AURA_TARGET_STATE_IDS_113C.has(targetStateId)) {
      const unpulsedAllies = targets.allAllies.filter((a) => {
        if (a.id === petVis.ctx.id || a.x === undefined || a.y === undefined) return false
        if (!isWithinAuraRange(a.x - pet.x, a.y - pet.y, radiusSubtiles)) return false
        if (a.stateBus.hasState(targetStateId)) return false
        return passesAuraFilter(entry.source.skill.auraFilter, {
          kind: a.unitType === 'player' ? 'player' : 'monster',
          relation: 'ally',
          dead: a.statList.getHp256() <= 0,
          inTown: auraEnv.isTown,
        })
      })
      if (unpulsedAllies.length > 0) {
        runtime.scanner.pulseAura(entry.source, pulseTick, unpulsedAllies, [], [], auraEnv)
      }
    }
  }
  const selfPetCasterStates = casterStateId !== undefined ? new Set<number>([casterStateId]) : undefined
  this.syncFriendlyAuraTargets113c(targets, owner.areaId, {
    skipSelfPetUnitId: petUnitId,
    selfPetCasterStates,
    forceRefresh: signatureChanged || forceInitial,
  })
}



function stepPetMissiles113c(this: GameInstanceHost): void {
  for (const [key, untilFrame] of [...this.petMissileNextDelayUntil.entries()]) {
    if (this.currentFrame >= untilFrame) {
      this.petMissileNextDelayUntil.delete(key)
    }
  }

  for (const [mslId, msl] of [...this.petMissiles.entries()]) {
    const prevX = msl.x
    const prevY = msl.y
    const nextX = prevX + msl.vx
    const nextY = prevY + msl.vy
    msl.remainingFrames -= 1

    if (!this.isMonsterStepWalkable(msl.areaId, prevX, prevY, nextX, nextY, true)) {
      this.petMissiles.delete(mslId)
      continue
    }

    msl.x = nextX
    msl.y = nextY

    const segDx = nextX - prevX
    const segDy = nextY - prevY
    const segLenSq = segDx * segDx + segDy * segDy
    let hitAny = false

    for (const m of this.monsters.values()) {
      if (
        m.dead ||
        m.isNpc ||
        !m.isKillable ||
        m.submerged ||
        m.align !== 0 ||
        this.isMonsterConverted(m) ||
        m.areaId !== msl.areaId ||
        msl.hitUnitIds.has(m.unitId)
      ) {
        continue
      }
      const ndKey = `${msl.ownerPlayerId}:${msl.sourceSkillId}:${m.unitId}`
      const ndUntil = this.petMissileNextDelayUntil.get(ndKey) ?? 0
      if (msl.nextDelayFrames > 0 && this.currentFrame < ndUntil) {
        continue
      }

      let t = 1
      if (segLenSq > 1e-6) {
        t = Math.max(0, Math.min(1, ((m.x - prevX) * segDx + (m.y - prevY) * segDy) / segLenSq))
      }
      const cx = prevX + segDx * t
      const cy = prevY + segDy * t
      const hitRadius = Math.max(1.8, (m.sizeX || 2) * 0.65)
      if (Math.hypot(m.x - cx, m.y - cy) > hitRadius) continue

      msl.hitUnitIds.add(m.unitId)
      if (msl.nextDelayFrames > 0) {
        this.petMissileNextDelayUntil.set(ndKey, this.currentFrame + msl.nextDelayFrames)
      }
      hitAny = true

      const owner = this.players.get(msl.ownerPlayerId)
      if (owner) {
        if (msl.dmgPacket.elemType === 'pois') {
          const dur = Math.max(25, msl.dmgPacket.elemDurationFrames ?? 100)
          const totalMin256 = Math.max(FIXED_ONE, msl.dmgPacket.elemMin256 ?? FIXED_ONE)
          const rawBitrate256 = Math.max(1, Math.floor(totalMin256 / dur))
          this.applyMonsterPoisonDot(owner, m, rawBitrate256, dur, msl.sourceSkillId, 'pet')
        } else {
          const mCtx = this.monsterCombatContext(m)
          mCtx.statList.setHp256(m.hp * FIXED_ONE)
          const out = executeSUnitDmg(msl.mslOwnerCtx, mCtx, msl.dmgPacket, this.rng)
          if (out.hit && !out.immuneToElem && out.totalDamage256 > 0) {
            const dealt = Math.max(1, Math.floor(out.totalDamage256 / FIXED_ONE))
            const channel = normalizeMissileElement(msl.dmgPacket.elemType) ?? 'fire'
            this.finishMonsterDamage(
              owner,
              m,
              dealt,
              msl.sourceSkillId,
              channel,
              undefined,
              msl.dmgPacket.elemDurationFrames,
              false,
              { fromPet: true, dmg256: out.totalDamage256 },
            )
            mCtx.statList.setHp256(m.hp * FIXED_ONE)
          }
        }
      }

      if (!msl.pierce) {
        break
      }
    }

    if (!hitAny || msl.pierce) {
      const owner = this.players.get(msl.ownerPlayerId)
      if (owner && !owner.dead) {
        const pvpTargets = this.collectHostilePvpTargetsInArea113c(msl.ownerPlayerId, msl.areaId)
        const pvpCandidates: Array<{
          readonly idKey: number
          readonly x: number
          readonly y: number
          readonly sizeX: number
          readonly target:
            | { readonly kind: 'player'; readonly player: InternalPlayerRecord }
            | { readonly kind: 'merc'; readonly merc: InternalMercenaryRecord }
            | {
                readonly kind: 'pet'
                readonly ownerId: number
                readonly pet: SummonedPetUnit
                readonly petUnitId: number
                readonly areaId: number
              }
        }> = []
        for (const p of pvpTargets.players) {
          pvpCandidates.push({ idKey: -p.unitId, x: p.x, y: p.y, sizeX: 2, target: { kind: 'player', player: p } })
        }
        for (const c of pvpTargets.mercs) {
          pvpCandidates.push({
            idKey: -(1_000_000 + c.unitId),
            x: c.x,
            y: c.y,
            sizeX: 2,
            target: { kind: 'merc', merc: c },
          })
        }
        for (const entry of pvpTargets.pets) {
          pvpCandidates.push({
            idKey: -(2_000_000 + entry.petUnitId),
            x: entry.pet.x,
            y: entry.pet.y,
            sizeX: 2,
            target: { kind: 'pet', ...entry },
          })
        }
        const srcPet = this.summonManagers
          .get(msl.ownerPlayerId)
          ?.getActivePets()
          .find((pt) => pt.uid === msl.mslOwnerCtx.id)
        for (const cand of pvpCandidates) {
          if (msl.hitUnitIds.has(cand.idKey)) continue
          const ndKey = `${msl.ownerPlayerId}:${msl.sourceSkillId}:pvp:${cand.idKey}`
          const ndUntil = this.petMissileNextDelayUntil.get(ndKey) ?? 0
          if (msl.nextDelayFrames > 0 && this.currentFrame < ndUntil) continue

          let t = 1
          if (segLenSq > 1e-6) {
            t = Math.max(0, Math.min(1, ((cand.x - prevX) * segDx + (cand.y - prevY) * segDy) / segLenSq))
          }
          const cx = prevX + segDx * t
          const cy = prevY + segDy * t
          const hitRadius = Math.max(1.8, cand.sizeX * 0.65)
          if (Math.hypot(cand.x - cx, cand.y - cy) > hitRadius) continue

          msl.hitUnitIds.add(cand.idKey)
          if (msl.nextDelayFrames > 0) {
            this.petMissileNextDelayUntil.set(ndKey, this.currentFrame + msl.nextDelayFrames)
          }
          hitAny = true

          const physDmg = Math.max(0, Math.floor((msl.dmgPacket.flatPhysMin256 ?? 0) / FIXED_ONE))
          const elemMin256 = Math.max(0, msl.dmgPacket.elemMin256 ?? 0)
          const elemMax256 = Math.max(elemMin256, msl.dmgPacket.elemMax256 ?? elemMin256)
          const elemDmg =
            elemMax256 > 0 ? Math.max(1, Math.floor(this.rollInclusive(elemMin256, elemMax256) / FIXED_ONE)) : 0
          this.applyPvpHitToTarget113c(owner, cand.target, {
            skillId: msl.sourceSkillId,
            physDamage: physDmg,
            elemDamage: elemDmg,
            elemType: normalizeMissileElement(msl.dmgPacket.elemType) ?? 'fire',
            elemDurationFrames: msl.dmgPacket.elemDurationFrames,
            attackKind: msl.dmgPacket.attackKind ?? 'spell',
            autoHit: msl.dmgPacket.autoHit ?? true,
            unblockable: msl.dmgPacket.unblockable ?? true,
            source: srcPet ?? { petUnitId: msl.petUnitId },
          })
          if (!msl.pierce) break
        }
      }
    }

    if ((hitAny && !msl.pierce) || msl.remainingFrames <= 0) {
      this.petMissiles.delete(mslId)
    }
  }
}



/**
 * DRLG oracle path: run the 1:1 NecroPet summons before the monster loop. D2Game updates the units of a
 * room in its LIFO unit list (newest first, the order already observed for merc missile collisions), and a
 * summon is always newer than the room's monsters; oracle `p52-necromancer-poison-golem` F802: the Clay
 * Golem steps to (5667,5798) and zombie #9's unit-targeted run path ends on that same frame.
 */
export function stepOracleNecroPetsEarly113c(host: GameInstanceHost): void {
  for (const [ownerPlayerId, mgr] of host.summonManagers.entries()) {
    const owner = host.players.get(ownerPlayerId)
    if (!owner || owner.dead) continue
    for (const pet of mgr.getActivePets()) {
      if (pet.oracleAi113c === undefined || pet.hp <= 0 || pet.alive === false) continue
      const petUnitId = host.petUnitIds.get(pet.uid)
      const areaId = (pet as { areaId?: number }).areaId
      if (petUnitId === undefined || areaId === undefined || areaId !== owner.areaId) continue
      ;(pet as { necroPetSteppedFrame113c?: number }).necroPetSteppedFrame113c = host.currentFrame
      try {
        stepNecroPet113c(host, owner, pet, petUnitId, areaId)
      } catch (err) {
        if (!(err instanceof NecroPetNotPortedError113c)) throw err
        console.warn(`[necropet-113c] frame ${host.currentFrame} pet ${petUnitId}: ${err.message}`)
        pet.oracleAi113c = undefined
      }
    }
  }
}

function stepSummonedPets(this: GameInstanceHost): void {
  this.stepPetMissiles113c()

  const noOpAuraScanner = {
    setActiveAura: () => null,
    pulseAura: () => {},
  } as unknown as AuraScanner

  for (const [ownerPlayerId, mgr] of this.summonManagers.entries()) {
    const owner = this.players.get(ownerPlayerId)
    if (!owner || owner.dead) continue

    const preTickPets = mgr.getActivePets().map((pet) => {
      const petMeta = pet as unknown as {
        areaId?: number
        unitId?: number
        states?: Set<number>
        inheritedAuraLevels?: Map<number, number>
        poisonCarry256?: number
      }
      const petUnitId = this.petUnitIds.get(pet.uid) ?? petMeta.unitId
      const aiProfile = resolvePetAiProfile113c(pet, 1)
      let crossAreaSnapped = false
      if (
        pet.hp > 0 &&
        pet.alive !== false &&
        !aiProfile.isStationary &&
        petMeta.areaId !== undefined &&
        petMeta.areaId !== owner.areaId
      ) {
        pet.x = owner.x
        pet.y = owner.y
        pet.mode = 1
        if (pet.oracleAi113c !== undefined) {
          pet.oracleAi113c.ovPathType = 0
          pet.oracleAi113c.ovVelocity = 0
          pet.oracleAi113c.ovNewDist = 0
        }
        petMeta.areaId = owner.areaId
        crossAreaSnapped = true
        if (petUnitId !== undefined) {
          this.areaPathWorld.removeMonster(petUnitId)
          this.areaPathWorld.spawnMonster(
            owner.areaId,
            {
              unitId: petUnitId,
              hcIdx: pet.classId ?? 363,
              areaId: owner.areaId,
              x: Math.floor(pet.x + 0.5),
              y: Math.floor(pet.y + 0.5),
              mode: 1,
              dead: false,
            },
            this.currentFrame,
          )
          this.broadcastToArea(owner.areaId, {
            type: 'UnitReassign',
            unitType: 1,
            id: petUnitId,
            unitId: petUnitId,
            areaId: owner.areaId,
            at: { x: Math.round(pet.x), y: Math.round(pet.y) },
            x: Math.round(pet.x),
            y: Math.round(pet.y),
            snap: true,
          })
        }
      } else if (petMeta.areaId === undefined) {
        petMeta.areaId = owner.areaId
      }
      if (petUnitId !== undefined && pet.hp > 0 && pet.alive !== false) {
        if (petMeta.unitId === undefined) petMeta.unitId = petUnitId
        const vis = this.getOrCreatePetCombatContext113c(pet, petUnitId, petMeta.areaId)
        petMeta.states = vis.states
        this.stepUnitStates(vis.states, vis.timers, 'monster', petUnitId, petMeta.areaId)
        if (!vis.states.has(2) && (pet.stateBus.hasState(2) || pet.stateBus.hasState('poison'))) {
          pet.stateBus.removeState(2)
          pet.stateBus.removeState('poison')
        }
        const petPois = pet.stateBus.getState(2) ?? pet.stateBus.getState('poison')
        const petPoisBitrate256 = petPois
          ? Math.max(0, petPois.stats['poisonmindam'] ?? -(petPois.stats['hpregen'] ?? 0))
          : 0
        if (petPoisBitrate256 > 0 && pet.hp > 0) {
          petMeta.poisonCarry256 = (petMeta.poisonCarry256 ?? 0) + petPoisBitrate256
          if (petMeta.poisonCarry256 >= FIXED_ONE) {
            const rawDrain = Math.floor(petMeta.poisonCarry256 / FIXED_ONE)
            petMeta.poisonCarry256 -= rawDrain * FIXED_ONE
            const petArea = petMeta.areaId ?? owner.areaId
            const drain = TOWN_AREAS.has(petArea)
              ? Math.max(0, Math.min(rawDrain, pet.hp - 1))
              : rawDrain
            if (drain > 0) {
              this.applyDamageToSummon(ownerPlayerId, pet, drain, petArea)
            }
          }
        } else {
          petMeta.poisonCarry256 = 0
        }
        if (pet.hp > 0 && (pet.alive as boolean | undefined) !== false) {
          const spiritSkillId = pet.subSkillIds.find(
            (id) => id === 296 || id === 297 || id === 298,
          )
          if (spiritSkillId !== undefined) {
            this.pulseDruidSpiritPetAura113c(owner, pet, petUnitId, spiritSkillId, false)
          } else if (pet.inheritedAuras !== undefined && pet.inheritedAuras.length > 0) {
            const inheritedSkillId = pet.inheritedAuras[0]!
            const inheritedSlvl = petMeta.inheritedAuraLevels?.get(inheritedSkillId) ?? 1
            this.pulseDruidSpiritPetAura113c(
              owner,
              pet,
              petUnitId,
              inheritedSkillId,
              false,
              inheritedSlvl,
            )
          }
        }
        if (
          pet.oracleAi113c !== undefined &&
          pet.hp > 0 &&
          (pet as { necroPetSteppedFrame113c?: number }).necroPetSteppedFrame113c !== this.currentFrame
        ) {
          try {
            stepNecroPet113c(this, owner, pet, petUnitId, petMeta.areaId)
          } catch (err) {
            if (!(err instanceof NecroPetNotPortedError113c)) throw err
            // Unported NecroPet branch: report and hand the pet back to the generic AI (outside 1:1).
            console.warn(`[necropet-113c] frame ${this.currentFrame} pet ${petUnitId}: ${err.message}`)
            pet.oracleAi113c = undefined
          }
        }
      }
      return {
        uid: pet.uid,
        petUnitId,
        petType: pet.petType,
        sourceSkillId: pet.sourceSkillId,
        classId: pet.classId ?? 363,
        prevX: pet.x,
        prevY: pet.y,
        crossAreaSnapped,
      }
    })

    if (preTickPets.length === 0) continue

    const ownerCtx = this.buildOwnerSummonCombatContext113c(ownerPlayerId)
    const ownerPreHp256 = ownerCtx.statList.getHp256()
    const ownerPreMana256 = ownerCtx.statList.getMana256()

    const enemyPositions = new Map<string, { x: number; y: number }>()
    const enemyEntries: {
      readonly record: InternalMonsterRecord
      readonly ctx: CombatUnitContext
      readonly preHp256: number
      readonly hadDimVision: boolean
      readonly hadStun: boolean
      readonly hadPoison: boolean
      readonly hadAmp: boolean
      readonly hadDecrep: boolean
      readonly hadWeaken: boolean
      readonly hadLowerRes: boolean
    }[] = []

    for (const m of this.monsters.values()) {
      if (
        m.dead ||
        m.isNpc ||
        !m.isKillable ||
        m.submerged ||
        m.align !== 0 ||
        this.isMonsterConverted(m) ||
        m.areaId !== owner.areaId
      ) {
        continue
      }
      const ctx = this.monsterCombatContext(m)
      ctx.statList.setHp256(m.hp * FIXED_ONE)
      Object.assign(ctx, { petIgnore: m.petIgnore })
      enemyPositions.set(ctx.id, { x: m.x, y: m.y })
      enemyEntries.push({
        record: m,
        ctx,
        preHp256: m.hp * FIXED_ONE,
        hadDimVision: ctx.stateBus.hasState('dimvision') || ctx.stateBus.hasState(23),
        hadStun: ctx.stateBus.hasState('stun') || ctx.stateBus.hasState(21),
        hadPoison: ctx.stateBus.hasState('poison') || ctx.stateBus.hasState(2),
        hadAmp: ctx.stateBus.hasState('amplifydamage') || ctx.stateBus.hasState(9) || m.states.has(9),
        hadDecrep: ctx.stateBus.hasState('decrepify') || ctx.stateBus.hasState(60) || m.states.has(60),
        hadWeaken: ctx.stateBus.hasState('weaken') || ctx.stateBus.hasState(19) || m.states.has(19),
        hadLowerRes: ctx.stateBus.hasState('lowerresist') || ctx.stateBus.hasState(61) || m.states.has(61),
      })
    }

    const pvpHostiles = this.collectHostilePvpTargetsInArea113c(ownerPlayerId, owner.areaId)
    const pvpEnemyEntries: Array<{
      readonly target:
        | { readonly kind: 'player'; readonly player: InternalPlayerRecord }
        | { readonly kind: 'merc'; readonly merc: InternalMercenaryRecord }
        | {
            readonly kind: 'pet'
            readonly ownerId: number
            readonly pet: SummonedPetUnit
            readonly petUnitId: number
            readonly areaId: number
          }
      readonly ctx: CombatUnitContext
      readonly preHp256: number
      readonly hadStun: boolean
    }> = []
    for (const p of pvpHostiles.players) {
      const snap = this.buildPlayerDefenderSnapshot113c(p)
      enemyPositions.set(snap.defenderCtx.id, { x: p.x, y: p.y })
      pvpEnemyEntries.push({
        target: { kind: 'player', player: p },
        ctx: snap.defenderCtx,
        preHp256: p.hpFixed,
        hadStun: p.states.has(21),
      })
    }
    for (const c of pvpHostiles.mercs) {
      const base = this.mercCombatContext(c)
      const ctx: CombatUnitContext = {
        ...base,
        unitType: 'mercenary',
        ownerUnitId: String(c.ownerPlayerId),
      }
      ctx.statList.setHp256(c.hp * FIXED_ONE)
      enemyPositions.set(ctx.id, { x: c.x, y: c.y })
      pvpEnemyEntries.push({
        target: { kind: 'merc', merc: c },
        ctx,
        preHp256: c.hp * FIXED_ONE,
        hadStun: c.states.has(21),
      })
    }
    for (const pEntry of pvpHostiles.pets) {
      pEntry.pet.statList.setHp256(pEntry.pet.hp * FIXED_ONE)
      const ctx: CombatUnitContext = {
        id: pEntry.pet.uid,
        name: pEntry.pet.name,
        unitType: 'minion',
        ownerUnitId: String(pEntry.ownerId),
        statList: pEntry.pet.statList,
        stateBus: pEntry.pet.stateBus,
        x: pEntry.pet.x,
        y: pEntry.pet.y,
      }
      enemyPositions.set(ctx.id, { x: pEntry.pet.x, y: pEntry.pet.y })
      pvpEnemyEntries.push({
        target: { kind: 'pet', ...pEntry },
        ctx,
        preHp256: pEntry.pet.hp * FIXED_ONE,
        hadStun: pEntry.pet.stateBus.hasState(21),
      })
    }

    const corpses: {
      id: string
      consumed: boolean
      baseMaxHp?: number
      isBoss?: boolean
      shattered?: boolean
      isCorpse?: boolean
      x?: number
      y?: number
      _monsterRef: InternalMonsterRecord
    }[] = []
    for (const m of this.monsters.values()) {
      if (!m.dead || m.shattered || m.isNpc || m.areaId !== owner.areaId) continue
      corpses.push({
        id: String(m.unitId),
        consumed: false,
        baseMaxHp: m.unscaledMaxHp || m.baseMaxHp,
        isBoss: m.isBoss,
        shattered: m.shattered,
        isCorpse: true,
        x: m.x,
        y: m.y,
        _monsterRef: m,
      })
    }
    corpses.sort(
      (a, b) =>
        Math.hypot((a.x ?? owner.x) - owner.x, (a.y ?? owner.y) - owner.y) -
        Math.hypot((b.x ?? owner.x) - owner.x, (b.y ?? owner.y) - owner.y),
    )

    const petMissileProxy = {
      spawnMissile: (sp: {
        missileNameOrId: string | number
        sourceSkillId: number
        slvl: number
        owner: CombatUnitContext
        startX: number
        startY: number
        targetX: number
        targetY: number
        dmgPacket: SUnitDmgPacket
        nextDelayFrames?: number | undefined
      }) => {
        const mTxt =
          typeof sp.missileNameOrId === 'number'
            ? this.registry.getMissileById(sp.missileNameOrId)
            : (getMissileTxtData(sp.missileNameOrId) ??
              this.registry.getMissileByName(sp.missileNameOrId))
        const missileClassId =
          mTxt?.id ?? (typeof sp.missileNameOrId === 'number' ? sp.missileNameOrId : 59)
        const projId = this.allocateUnitId(UNIT_TYPE_113C.missile)
        const petUnitId = this.petUnitIds.get(sp.owner.id) ?? owner.unitId
        const at = { x: Math.round(sp.startX), y: Math.round(sp.startY) }
        const tgt = { x: Math.round(sp.targetX), y: Math.round(sp.targetY) }
        this.broadcastToArea(owner.areaId, {
          type: 'CreateMissile',
          missileId: projId,
          missileClassId,
          at,
          target: tgt,
          x: at.x,
          y: at.y,
          targetX: tgt.x,
          targetY: tgt.y,
          skillId: sp.sourceSkillId,
          level: sp.slvl,
          ownerType: 1,
          ownerUnitType: 'monster',
          ownerId: petUnitId,
          sourceUnitId: petUnitId,
          areaId: owner.areaId,
        } as ServerEvent)

        // Poison Creeper (`#222`) applies its poison damage/state directly inside `tickPets`.
        if (sp.sourceSkillId === 222) {
          return null
        }

        const dx = sp.targetX - sp.startX
        const dy = sp.targetY - sp.startY
        const dist = Math.hypot(dx, dy)
        const velSubtilesPerFrame = Math.max(0.8, (mTxt?.vel ?? 18) / 12)
        const vx = dist > 1e-4 ? (dx / dist) * velSubtilesPerFrame : velSubtilesPerFrame
        const vy = dist > 1e-4 ? (dy / dist) * velSubtilesPerFrame : 0
        const rangeFrames = Math.max(15, (mTxt?.range ?? 40) + sp.slvl * (mTxt?.levRange ?? 0))
        const pierce =
          Boolean(mTxt?.pierce) ||
          sp.sourceSkillId === 262 ||
          sp.sourceSkillId === 271 ||
          sp.sourceSkillId === 272 ||
          sp.sourceSkillId === 276

        this.petMissiles.set(projId, {
          unitId: projId,
          missileClassId,
          petUnitId,
          ownerPlayerId,
          mslOwnerCtx: sp.owner,
          areaId: owner.areaId,
          x: sp.startX,
          y: sp.startY,
          vx,
          vy,
          remainingFrames: rangeFrames,
          pierce,
          nextDelayFrames: sp.nextDelayFrames ?? 0,
          sourceSkillId: sp.sourceSkillId,
          slvl: sp.slvl,
          dmgPacket: sp.dmgPacket,
          hitUnitIds: new Set<number>(),
        })
        return null
      },
    } as unknown as MissileEngine

    mgr.tickPets({
      currentTick: this.currentFrame,
      owner: ownerCtx,
      enemies: [...enemyEntries.map((e) => e.ctx), ...pvpEnemyEntries.map((e) => e.ctx)],
      enemyPositions,
      corpses,
      missileEngine: petMissileProxy,
      auraScanner: noOpAuraScanner,
      coordScale: 1,
      respectAiDelay: true,
      enforceMeleeReach: true,
      canStep: (pet, nextX, nextY) =>
        this.isMonsterStepWalkable(
          owner.areaId,
          pet.x,
          pet.y,
          nextX,
          nextY,
          pet.petType === 'raven',
        ),
    })

    for (const c of corpses) {
      if (c.consumed && !c._monsterRef.shattered) {
        c._monsterRef.shattered = true
        this.broadcastToArea(c._monsterRef.areaId, {
          type: 'UnitRemove',
          unitType: 1,
          id: c._monsterRef.unitId,
          unitId: c._monsterRef.unitId,
          areaId: c._monsterRef.areaId,
        })
      }
    }

    const ownerPostHp256 = ownerCtx.statList.getHp256()
    const ownerPostMana256 = ownerCtx.statList.getMana256()
    if (ownerPostHp256 !== ownerPreHp256) {
      const maxHpFixed = this.getPlayerAccruedMaxHpFixed(owner)
      owner.hpFixed = Math.min(maxHpFixed, Math.max(FIXED_ONE, ownerPostHp256))
      owner.hp = Math.max(1, Math.ceil(owner.hpFixed / FIXED_ONE))
      this.emitToPlayer(owner.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: owner.unitId,
        statId: 6,
        value: owner.hpFixed,
      })
    }
    if (ownerPostMana256 !== ownerPreMana256) {
      const maxManaFixed = this.getPlayerAccruedMaxManaFixed(owner)
      owner.manaFixed = Math.min(maxManaFixed, Math.max(0, ownerPostMana256))
      owner.mana = Math.max(0, Math.floor(owner.manaFixed / FIXED_ONE))
      this.emitToPlayer(owner.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: owner.unitId,
        statId: 8,
        value: owner.manaFixed,
      })
    }

    for (const entry of enemyEntries) {
      const m = entry.record
      if (m.dead) continue
      if (
        !entry.hadDimVision &&
        (entry.ctx.stateBus.hasState('dimvision') || entry.ctx.stateBus.hasState(23))
      ) {
        this.applyMonsterState(m.unitId, 23, 100)
      }
      if (
        !entry.hadStun &&
        (entry.ctx.stateBus.hasState('stun') || entry.ctx.stateBus.hasState(21))
      ) {
        this.applyMonsterState(m.unitId, 21, 75)
      }
      if (
        !entry.hadPoison &&
        (entry.ctx.stateBus.hasState('poison') || entry.ctx.stateBus.hasState(2))
      ) {
        const pState = entry.ctx.stateBus.getState('poison') ?? entry.ctx.stateBus.getState(2)
        const rate256 = Math.max(1, pState?.stats['poisonmindam'] ?? FIXED_ONE)
        const dur = Math.max(25, pState ? pState.expireFrame - this.currentFrame : 100)
        this.applyMonsterPoisonDot(owner, m, rate256, dur, pState?.sourceSkillId ?? 222, 'pet')
      }
      // `#1898` Sync pet `MonEquip.txt` CtC curses (`#66`, `#87`, `#72`, `#91`) onto monster persistent state!
      const ctcCurses: readonly {
        readonly had: boolean
        readonly stateName: string
        readonly stateId: number
      }[] = [
        { had: entry.hadAmp, stateName: 'amplifydamage', stateId: 9 },
        { had: entry.hadDecrep, stateName: 'decrepify', stateId: 60 },
        { had: entry.hadWeaken, stateName: 'weaken', stateId: 19 },
        { had: entry.hadLowerRes, stateName: 'lowerresist', stateId: 61 },
      ]
      for (const ctc of ctcCurses) {
        if (
          !ctc.had &&
          !m.uncursable &&
          (entry.ctx.stateBus.hasState(ctc.stateName) || entry.ctx.stateBus.hasState(ctc.stateId))
        ) {
          const applied =
            entry.ctx.stateBus.getState(ctc.stateName) ?? entry.ctx.stateBus.getState(ctc.stateId)
          const dur = Math.max(50, applied ? applied.expireFrame - this.currentFrame : 200)
          this.applyMonsterState(m.unitId, ctc.stateId, dur)
          const persistent = this.monsterCombat.get(m.unitId)
          if (persistent !== undefined && applied !== undefined) {
            persistent.stateBus.applyState({
              stateNameOrId: ctc.stateName,
              sourceUnitId: applied.sourceUnitId ?? `player_${owner.unitId}`,
              sourceSkillId: applied.sourceSkillId ?? 66,
              slvl: applied.slvl ?? 1,
              durationFrames: dur,
              currentFrame: this.currentFrame,
              stats: applied.stats,
            })
          }
        }
      }

      const postHp256 = entry.ctx.statList.getHp256()
      if (postHp256 < entry.preHp256 && !m.dead) {
        const dealt256 = entry.preHp256 - postHp256
        const dealt = Math.max(1, Math.floor(dealt256 / FIXED_ONE))
        this.finishMonsterDamage(owner, m, dealt, 0, 'phys', undefined, undefined, false, {
          fromPet: true,
          dmg256: dealt256,
        })
        entry.ctx.statList.setHp256(m.hp * FIXED_ONE)
      }
    }

    const firstPetUnitId =
      preTickPets.find((p) => p.petUnitId !== undefined)?.petUnitId ?? owner.unitId
    for (const pvpEntry of pvpEnemyEntries) {
      const { target, ctx, preHp256, hadStun } = pvpEntry
      if (!hadStun && (ctx.stateBus.hasState('stun') || ctx.stateBus.hasState(21))) {
        this.applyPvpDebuffStateToTarget113c(
          target,
          21,
          75,
          `pet_${firstPetUnitId}`,
          326,
          1,
        )
      }
      const postHp256 = ctx.statList.getHp256()
      if (postHp256 < preHp256) {
        const dealt = Math.max(1, Math.floor((preHp256 - postHp256) / FIXED_ONE))
        if (target.kind === 'player' && !target.player.dead) {
          this.applyDamageToPlayer(target.player, dealt, {
            killerType: 'player_pet',
            killerUnitId: firstPetUnitId,
          })
        } else if (target.kind === 'merc' && target.merc.alive) {
          this.applyDamageToMerc(target.merc, dealt, target.merc.areaId)
        } else if (target.kind === 'pet' && target.pet.alive !== false && target.pet.hp > 0) {
          target.pet.hp = Math.ceil(preHp256 / FIXED_ONE)
          target.pet.statList.setHp256(preHp256)
          this.applyDamageToSummon(target.ownerId, target.pet, dealt, target.areaId)
        }
      }
    }

    const activeByUid = new Map(mgr.getActivePets().map((p) => [p.uid, p]))
    for (const pre of preTickPets) {
      const livePet = activeByUid.get(pre.uid)
      if (!livePet || livePet.hp <= 0 || livePet.alive === false) {
        this.petAuraScanners.delete(pre.uid)
        if (pre.sourceSkillId === 90) {
          owner.ironGolemItem = null
        }
        if (pre.petUnitId !== undefined) {
          this.petUnitIds.delete(pre.uid)
          this.petVisualStates.delete(pre.petUnitId)
          this.broadcastToArea(owner.areaId, {
            type: 'UnitRemove',
            unitType: 1,
            id: pre.petUnitId,
            unitId: pre.petUnitId,
          })
          this.emitToPlayer(ownerPlayerId, {
            type: 'Merc',
            kind: 'assign',
            isSummonAction: true,
            summonAction: 0,
            petType: PET_TYPE_IDX_BY_NAME_113C[pre.petType] ?? 1,
            mercId: pre.petUnitId,
            ownerId: ownerPlayerId,
            classId: pre.classId,
          })
        }
        continue
      }

      if (pre.petUnitId !== undefined && !pre.crossAreaSnapped) {
        const movedDist = Math.hypot(livePet.x - pre.prevX, livePet.y - pre.prevY)
        if (movedDist >= 5) {
          this.broadcastToArea(owner.areaId, {
            type: 'UnitReassign',
            unitType: 1,
            id: pre.petUnitId,
            unitId: pre.petUnitId,
            areaId: owner.areaId,
            at: { x: Math.round(livePet.x), y: Math.round(livePet.y) },
            x: Math.round(livePet.x),
            y: Math.round(livePet.y),
            snap: true,
          })
        } else if (movedDist >= 0.01) {
          this.broadcastToArea(owner.areaId, {
            type: 'UnitMove',
            unitType: 'monster',
            id: pre.petUnitId,
            unitId: pre.petUnitId,
            areaId: owner.areaId,
            mode: 'walk',
            to: { x: Math.round(livePet.x), y: Math.round(livePet.y) },
            x: Math.round(livePet.x),
            y: Math.round(livePet.y),
          })
        }
      }
    }
  }
}

export interface SummonedPetsMethods {
  getSummonManager(ownerPlayerId: number): SummonManager
  buildOwnerSummonCombatContext113c(ownerPlayerId: number): CombatUnitContext
  extractIronGolemPropsFromEntry113c(entry: ServerItemEntry, ownerLevel: number): {
  readonly props: IronGolemItemProps & {
    readonly fireResist?: number
    readonly lightResist?: number
    readonly coldResist?: number
    readonly poisonResist?: number
  }
  readonly auraLevels: Map<number, number>
  readonly extraStats: {
    readonly minDamage?: number
    readonly maxDamage?: number
    readonly damageResist: number
    readonly magicResist: number
    readonly crushingBlow: number
    readonly openWounds: number
    readonly deadlyStrike: number
    readonly thornsFlat: number
    readonly fireMinDam: number
    readonly fireMaxDam: number
    readonly lightMinDam: number
    readonly lightMaxDam: number
    readonly coldMinDam: number
    readonly coldMaxDam: number
  }
}
  executeIronGolemSkillCast113c(player: InternalPlayerRecord, target: {
    readonly targetItemId?: number | undefined
    readonly tx?: number | undefined
    readonly ty?: number | undefined
  }): void
  summonPet(ownerPlayerId: number, spec: SummonPetSpec): CreatePetOutcome
  unsummonPetAt(ownerPlayerId: number, x: number, y: number, radius?: number | undefined): SummonedPetUnit | null
  getPetsForOwner(ownerPlayerId: number): readonly SummonedPetUnit[]
  getPetState(idOrOutcome: | number
    | string
    | {
        readonly pet?: SummonedPetUnit | null | undefined
        readonly uid?: string | undefined
      }): SummonedPetUnit | undefined
  pulseDruidSpiritPetAura113c(owner: InternalPlayerRecord, pet: SummonedPetUnit, petUnitId: number, spiritSkillId: number, forceInitial?: boolean | undefined, slvlOverride?: number): void
  stepPetMissiles113c(): void
  stepSummonedPets(): void
}

export const summonedPetsMethods: Record<keyof SummonedPetsMethods, unknown> = {
  getSummonManager,
  buildOwnerSummonCombatContext113c,
  extractIronGolemPropsFromEntry113c,
  executeIronGolemSkillCast113c,
  summonPet,
  unsummonPetAt,
  getPetsForOwner,
  getPetState,
  pulseDruidSpiritPetAura113c,
  stepPetMissiles113c,
  stepSummonedPets,
}
