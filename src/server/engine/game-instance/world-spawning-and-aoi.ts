/**
 * GameInstance Subsystem: Monster/Object/Ground-Item/SuperUnique Spawning, World Event & AOI Snapshots (`src/server/engine/game-instance/world-spawning-and-aoi.ts`).
 */

import { CANONICAL_113C_OBJECTS } from '../../../common/world/objects-meta.ts'
import { QUEST_CHEST_OPERATE_FNS_113C, SPARKLY_CHEST_INIT57_CLASS_IDS_113C, WELL_DEFAULT_PARMS_113C, classifyObjectOperate113c, computeWellInitialCharges113c, rollChestTrapType113c, rollPreOperateOpen113c, rollShrineType113c } from '../../../common/world/object-operate-113c.ts'
import { getLevelMonsterLevel113c } from '../../../common/world/levels-monlvl-113c.ts'
import { QUEST_FLAG_COMPLETED_113C, QUEST_FLAG_COMPLETED_NOW_113C, QUEST_FLAG_REWARD_PENDING_113C, hasQuestFlag113c } from '../quests-113c.ts'
import { PALADIN_AURA_STATE_BY_SKILL_ID } from '../../../common/skills/paladin-auras.ts'
import { MONSTATS_113C_ROWS, MONUMOD_113C_ROWS } from '../../../common/units/monstats-113c-data.ts'
import { isBaalTentacleHcIdx113c, isBonePrisonMonsterHcIdx113c, isSubmergeCapableMonsterHcIdx113c, isTentacleHcIdx113c, isTentacleHeadHcIdx113c, resolveInnateMonsterAura113c, rollAuraEnchanted113c } from '../../../common/units/monai-113c.ts'
import { MON_UMOD, resolveMonsterUModIds } from '../../../common/units/monster-death-fx.ts'
import { hasImplicitScarabUMod113c, hasImplicitSelfResurrectUMod113c, hasImplicitShatterOnDeathUMod113c, isAlwaysRunAiMonster113c, isMonsterUncursable113c, isWillOWispChampion113c, shouldKillMinionsOnDeath113c } from '../../ai/monumod-113c.ts'
import { CANONICAL_BOSS_MINIONS, getCanonicalMonsterKinds, getMonsterKindByHcIdx, getSuperUniqueByIndex, resolveMonsterStats, rollSuperUniqueUModIds113c, type MonsterKind, type MonsterRank } from '../../../common/units/monsters-data.ts'
import { getLevelMonsterPlan113c } from '../../../common/world/level-monster-plans.ts'
import { OBJECTS_TXT_113C } from '../../../common/world/objects-txt-113c.ts'
import { MONSTATS2_COMP_BIT_WIDTHS_BY_HCIDX, type ClientCommand, type ServerEvent } from '../../../netproto/index.ts'
import { findStandableNear, isStandableSubTile, resolvePresetObject113c, resolvePresetPortalDestArea113c } from '../../world/area-bootstrap.ts'
import { planLevelPopulation113c, planRoomPopulation113c } from '../../ai/room-streamer.ts'
import { resolveMonsterMonProps113c } from '../../ai/monprop-113c.ts'
import { rollMonsterOrPetLoadout113c } from '../../ai/monequip-helper-113c.ts'
import type { GameInstanceHost } from './host.ts'
import type { InternalMercenaryRecord, InternalMonsterRecord, InternalObjectRecord, InternalPlayerRecord, ServerItemEntry, SpawnMonsterSpec, SpawnObjectSpec } from './types.ts'
import { ACT_TOWN_AREA, MON_UMOD_LABELS_113C, MON_UMOD_ROW_BY_ID_113C, TOWN_AREAS, areaToAct, lookupBaseInfo, monsterProfile113c, UNIT_TYPE_113C } from './constants-and-helpers.ts'
import { canMonsterBlock113c, rollMonsterInitStats113c, rollMonsterOutfit113c } from './unit-seeds-113c.ts'
import { isTownNpcMonster113c } from '../../ai/town-npc-ai-113c.ts'


function spawnMonster(this: GameInstanceHost, spec: SpawnMonsterSpec): number {
  const unitId = this.allocateUnitId(UNIT_TYPE_113C.monster)
  const rawClassId = spec.classId ?? spec.hcIdx ?? spec.monstatsId
  const diffName =
    this.difficulty === 2
      ? 'hell'
      : this.difficulty === 1
        ? 'nightmare'
        : 'normal'

  const rawClassKind =
    rawClassId !== undefined
      ? getMonsterKindByHcIdx(rawClassId, diffName)
      : undefined
  let kind: MonsterKind | undefined
  if (
    spec.defId &&
    !(spec.defId.trim().toLowerCase() === 'chicken' && rawClassId !== undefined && rawClassId !== 149)
  ) {
    const targetDef = spec.defId.trim().toLowerCase()
    const canonicalMap = getCanonicalMonsterKinds(diffName)
    kind = canonicalMap.get(targetDef)
    if (!kind) {
      for (const k of canonicalMap.values()) {
        if (
          k.id.toLowerCase() === targetDef ||
          k.baseId.toLowerCase() === targetDef
        ) {
          kind = k
          break
        }
      }
    }
  }
  if (!kind && rawClassKind) {
    kind = rawClassKind
  }

  const classId = rawClassId ?? kind?.hcIdx ?? 0
  const hcIdx = rawClassId ?? kind?.hcIdx ?? classId
  const defId =
    spec.defId &&
    !(spec.defId.trim().toLowerCase() === 'chicken' && rawClassId !== undefined && rawClassId !== 149)
      ? spec.defId
      : (kind?.id ?? spec.defId ?? `monster_${classId}`)
  const areaId = spec.areaId ?? this.defaultAreaId ?? 1
  const isVendor = Boolean(spec.isVendor)
  const isNpc = Boolean(spec.isNpc || spec.isVendor)

  const rank: MonsterRank =
    spec.rank === 'champion' ||
    spec.rank === 'unique' ||
    spec.rank === 'minion'
      ? spec.rank
      : spec.rank === 'superunique' || spec.rank === 'boss'
        ? 'unique'
        : 'normal'

  const rawUMods = spec.monUMods ?? spec.umodIds ?? spec.modifiers ?? []
  const umodIds: number[] = [
    ...resolveMonsterUModIds(rawUMods as readonly (number | string)[]),
  ]
  // 1.13c D2Game.dll 0x6FC67F0E: Blood Raven (hcIdx 267), Shenk (hcIdx 479), & Countess (hcIdx 45)
  // carry MonUMod 22 (`questcomplete`) (#1823, #1906).
  const normSuId = (spec.superUniqueId ?? '').trim().toLowerCase()
  if (!isNpc) {
    if (hcIdx === 267) {
      if (!umodIds.includes(MON_UMOD.BLOODRAVEN)) umodIds.push(MON_UMOD.BLOODRAVEN)
      if (!umodIds.includes(MON_UMOD.QUESTCOMPLETE)) umodIds.push(MON_UMOD.QUESTCOMPLETE)
    } else if (
      (hcIdx === 479 && (normSuId.includes('shenk') || normSuId.includes('siege boss'))) ||
      (hcIdx === 45 && normSuId.includes('countess'))
    ) {
      if (!umodIds.includes(MON_UMOD.QUESTCOMPLETE)) umodIds.push(MON_UMOD.QUESTCOMPLETE)
    }
    if (
      hasImplicitSelfResurrectUMod113c({
        hcIdx,
        defId,
        rank,
        superUniqueId: spec.superUniqueId,
        isNpc,
        skills: kind?.skills ?? rawClassKind?.skills,
      }) &&
      !umodIds.includes(MON_UMOD.AI_AFTER_DEATH)
    ) {
      umodIds.push(MON_UMOD.AI_AFTER_DEATH)
    }
    if (
      hasImplicitScarabUMod113c({
        hcIdx,
        defId,
        monType: kind?.monType ?? rawClassKind?.monType,
        baseId: kind?.baseId ?? rawClassKind?.baseId,
        isNpc,
      }) &&
      !umodIds.includes(MON_UMOD.SCARAB)
    ) {
      umodIds.push(MON_UMOD.SCARAB)
    }
    if (
      hasImplicitShatterOnDeathUMod113c({
        hcIdx,
        defId,
        monType: kind?.monType ?? rawClassKind?.monType,
        baseId: kind?.baseId ?? rawClassKind?.baseId,
        isNpc,
      }) &&
      !umodIds.includes(MON_UMOD.SHATTER_ON_DEATH)
    ) {
      umodIds.push(MON_UMOD.SHATTER_ON_DEATH)
    }
  }
  const mappedFromUmodIds = umodIds
    .map((id: number): string => {
      const label = MON_UMOD_LABELS_113C[id]
      if (label !== undefined) return label
      // Every other enabled MonUMod row surfaces its canonical `uniquemod` id,
      // so no row is silently dropped (id 22 is `questcomplete`, not Fire).
      const row = MON_UMOD_ROW_BY_ID_113C.get(id)
      return row?.enabled ? row.id : ''
    })
    .filter((s: string) => s.length > 0)
  const modifierNames: string[] = [
    ...new Set([
      ...(spec.modifiers !== undefined
        ? spec.modifiers.map((m) => String(m))
        : []),
      ...mappedFromUmodIds,
    ]),
  ]

  const effectiveAreaLevel =
    spec.areaLevel ??
    (!isNpc && spec.areaId !== undefined
      ? getLevelMonsterPlan113c(spec.areaId, diffName)?.monsterLevel
      : undefined)
  const resolvedStats = kind
    ? resolveMonsterStats(kind, {
        difficulty: diffName,
        rank,
        modifiers: modifierNames,
        playersCount: 1,
        ...(effectiveAreaLevel !== undefined ? { areaLevel: effectiveAreaLevel } : {}),
        ...(spec.statSeed !== undefined ? { seed: spec.statSeed } : {}),
        ...(spec.superUniqueId !== undefined ? { superUniqueId: spec.superUniqueId } : {}),
      })
    : undefined
  const unscaledResolvedStats =
    kind && (rank !== 'normal' || modifierNames.length > 0 || spec.superUniqueId !== undefined)
      ? resolveMonsterStats(kind, {
          difficulty: diffName,
          rank: 'normal',
          modifiers: [],
          playersCount: 1,
          ...(effectiveAreaLevel !== undefined ? { areaLevel: effectiveAreaLevel } : {}),
          ...(spec.statSeed !== undefined ? { seed: spec.statSeed } : {}),
        })
      : resolvedStats

  const noRatio = Boolean(spec.noRatio ?? kind?.noRatio ?? false)
  const unitSeed = this.unitSeeds.get(`${UNIT_TYPE_113C.monster}:${unitId}`)
  const actPalette =
    this.drlgRoomPopulator?.getLevelOutfitPalette(areaId) ??
    this.actMonsterOutfitPalettes[areaToAct(areaId)] ??
    this.actMonsterOutfitPalettes[0]!
  const rolledOutfit =
    unitSeed !== undefined ? rollMonsterOutfit113c(actPalette, hcIdx, unitSeed) : undefined
  const initStatsRoll =
    unitSeed !== undefined && kind !== undefined
      ? rollMonsterInitStats113c({
          kind,
          difficulty: this.difficulty,
          effectiveAreaLevel,
          isBoss: Boolean(kind.isBoss || kind.boss),
          noRatio,
          isExpansion: true,
          unitSeed,
        })
      : undefined
  const hasExplicitHpOrSeed =
    spec.maxHp !== undefined || spec.hp !== undefined || spec.statSeed !== undefined
  const isEliteRank = rank !== 'normal' || spec.superUniqueId !== undefined
  const eliteHpFactor =
    rank === 'unique' || spec.superUniqueId !== undefined
      ? this.difficulty === 2
        ? 2
        : this.difficulty === 1
          ? 3
          : 4
      : rank === 'champion'
        ? this.difficulty === 2
          ? 2
          : this.difficulty === 1
            ? 2.5
            : 3
        : rank === 'minion'
          ? this.difficulty === 2
            ? 1.5
            : this.difficulty === 1
              ? 1.75
              : 2
          : 1
  const useInitStatsHp = !hasExplicitHpOrSeed && initStatsRoll !== undefined
  const baseMaxHp = useInitStatsHp
    ? initStatsRoll.rolledHp <= 0
      ? 0
      : isEliteRank
        ? Math.max(1, Math.floor(initStatsRoll.rolledHp * eliteHpFactor))
        : initStatsRoll.rolledHp
    : Math.max(1, spec.maxHp ?? spec.hp ?? resolvedStats?.maxHp ?? resolvedStats?.hp ?? 50)
  // Explicit `spec.maxHp` / `spec.hp` are treated as the unmultiplied base HP (`#1821` FE explosion,
  // `#1882` Corpse Explosion); only the derived fallback strips the Champion/Unique/Minion HP factor.
  const unscaledMaxHp =
    useInitStatsHp && initStatsRoll.rolledHp <= 0 && spec.unscaledMaxHp === undefined
      ? 0
      : Math.max(
          1,
          spec.unscaledMaxHp ??
            (useInitStatsHp
              ? initStatsRoll.rolledHp
              : (spec.maxHp ??
                spec.hp ??
                unscaledResolvedStats?.maxHp ??
                unscaledResolvedStats?.hp ??
                Math.floor(baseMaxHp / eliteHpFactor))),
        )
  const bossParent =
    spec.bossUnitId !== undefined ? this.monsters.get(spec.bossUnitId) : undefined
  const rawTableAlign =
    kind?.align ?? rawClassKind?.align ?? MONSTATS_113C_ROWS[hcIdx]?.align ?? 0
  // Player-owned Hydras live in `this.summonManagers`; `hydra1..3` (`351..353`) spawned into
  // `this.monsters` without an explicit `spec.align` are evil monster Hydra turrets (`#62 Hydra`, `#2005`).
  const resolvedAlign: 0 | 1 | 2 =
    spec.align !== undefined
      ? spec.align
      : bossParent !== undefined
        ? bossParent.align
        : hcIdx >= 351 && hcIdx <= 353 && spec.boneConstructOwnerPlayerId === undefined
          ? 0
          : rawTableAlign === 1 || rawTableAlign === 2
            ? rawTableAlign
            : 0
  const px = this.playersX
  const monsterPlayerCount =
    isNpc || resolvedAlign !== 0
      ? 1
      : Math.max(1, Math.trunc(spec.monsterPlayerCount ?? px))
  const scaledMaxHp =
    baseMaxHp <= 0
      ? 0
      : isNpc || noRatio || resolvedAlign !== 0
        ? baseMaxHp
        : Math.max(1, Math.floor((baseMaxHp * (px + 1)) / 2))
  const hp = spec.hp !== undefined ? Math.max(1, spec.hp) : scaledMaxHp
  const maxHp = Math.max(hp, scaledMaxHp)

  const level =
    spec.level !== undefined
      ? Math.max(1, Math.trunc(spec.level))
      : initStatsRoll !== undefined
        ? isEliteRank
          ? Math.max(initStatsRoll.level, resolvedStats?.level ?? initStatsRoll.level)
          : initStatsRoll.level
        : Math.max(1, resolvedStats?.level ?? kind?.level?.[this.difficulty] ?? 1)
  const monsterSkills = resolvedStats?.skills ?? kind?.skills ?? []
  const innateAura = !isNpc
    ? resolveInnateMonsterAura113c(hcIdx, diffName, monsterSkills)
    : undefined
  const enchantedAura =
    !isNpc && rank !== 'minion' && innateAura === undefined && umodIds.includes(MON_UMOD.AURA)
      ? rollAuraEnchanted113c(level, hcIdx + areaId + (spec.statSeed ?? 0), spec.superUniqueId)
      : undefined
  const auraSkillId = innateAura?.auraSkillId ?? enchantedAura?.auraSkillId
  const auraLevel = innateAura?.auraLevel ?? enchantedAura?.auraLevel
  const rawBaseXp = spec.experience ?? resolvedStats?.xp
  if (rawBaseXp === undefined) {
    throw new Error(
      `Monster missing experience data for classId=${classId} defId=${defId}`,
    )
  }
  const baseXp = Math.max(0, Math.trunc(rawBaseXp))
  const unscaledXp =
    isNpc || noRatio || resolvedAlign !== 0
  const experience = unscaledXp
    ? baseXp
    : Math.max(0, Math.floor((baseXp * (px + 1)) / 2))
  const isWillowispChamp = isWillOWispChampion113c({
    hcIdx,
    id: defId,
    baseId: kind?.baseId ?? rawClassKind?.baseId,
  })
  const specDmgMult =
    (umodIds.includes(MON_UMOD.STRONG) ? (rank === 'minion' || isWillowispChamp ? 1.75 : 2.5) : 1) *
    (umodIds.includes(MON_UMOD.BERSERK)
      ? isWillowispChamp
        ? 2.5
        : this.difficulty === 2
          ? 2.98
          : this.difficulty === 1
            ? 3.25
            : 4
      : rank === 'champion'
        ? isWillowispChamp
          ? this.difficulty === 2
            ? 1.16
            : this.difficulty === 1
              ? 1.37
              : 1.5
          : this.difficulty === 2
            ? 1.5
            : this.difficulty === 1
              ? 1.75
              : 2
        : 1)
  const monProps = !isNpc
    ? resolveMonsterMonProps113c(
        hcIdx,
        diffName,
        (lo, hi) => this.rollInclusive(lo, hi),
        () => this.rng.rand(100),
      )
    : resolveMonsterMonProps113c(undefined)
  const monEquipLoadout =
    !isNpc && (hcIdx === 267 || hcIdx === 234)
      ? rollMonsterOrPetLoadout113c({
          monster: hcIdx === 267 ? 'bloodraven' : 'flyingscimitar',
          level,
          ilvl: level,
          onInitOnly: true,
          seed: ((spec.statSeed ?? unitId) ^ (hcIdx * 0x9e37)) >>> 0,
        })
      : undefined
  const equipWeaponMin =
    monEquipLoadout && monEquipLoadout.weaponMaxDamage > 0
      ? Math.floor(
          (monEquipLoadout.weaponMinDamage * (100 + monEquipLoadout.offWeapDamagePct)) / 100,
        )
      : 0
  const equipWeaponMax =
    monEquipLoadout && monEquipLoadout.weaponMaxDamage > 0
      ? Math.floor(
          (monEquipLoadout.weaponMaxDamage * (100 + monEquipLoadout.offWeapDamagePct)) / 100,
        )
      : 0
  const baseMinDmg = Math.max(
    1,
    (spec.minDmg !== undefined
      ? Math.round(spec.minDmg * specDmgMult)
      : (resolvedStats?.attack1?.minDamage ??
          resolvedStats?.attack1?.min ??
          resolvedStats?.damage ??
          Math.max(2, level * 3))) + equipWeaponMin,
  )
  const baseMaxDmg = Math.max(
    baseMinDmg,
    (spec.maxDmg !== undefined
      ? Math.round(spec.maxDmg * specDmgMult)
      : (resolvedStats?.attack1?.maxDamage ??
          resolvedStats?.attack1?.max ??
          resolvedStats?.damage ??
          Math.max(baseMinDmg, level * 4))) + equipWeaponMax,
  )
  const syntheticArMult =
    resolvedStats === undefined && spec.ar === undefined
      ? (umodIds.includes(MON_UMOD.STRONG) ? 1.25 : 1) *
        (umodIds.includes(MON_UMOD.FAST) && rank !== 'minion' ? 2 : 1) *
        (umodIds.includes(MON_UMOD.MANahit) && rank !== 'minion' ? 1.75 : 1) *
        (umodIds.includes(MON_UMOD.FANATIC)
          ? 0.3
          : umodIds.includes(MON_UMOD.BERSERK)
            ? this.difficulty === 2
              ? 2.9
              : this.difficulty === 1
                ? 3.5
                : 4
            : rank === 'champion'
              ? this.difficulty === 2
                ? 1.6
                : this.difficulty === 1
                  ? 1.9
                  : 2.2
              : 1)
      : 1
  const applyEquipAr = (rawAr: number): number => {
    if (!monEquipLoadout) return rawAr
    const withFlat = rawAr + monEquipLoadout.flatAttackRating
    return Math.max(1, Math.floor((withFlat * (100 + monEquipLoadout.attackRatingPct)) / 100))
  }
  const baseAr = applyEquipAr(
    Math.max(
      1,
      spec.ar ??
        resolvedStats?.toHit ??
        resolvedStats?.attack1?.toHit ??
        Math.round((50 + level * 15) * syntheticArMult),
    ),
  )
  const baseAttack2Ar = applyEquipAr(
    Math.max(
      1,
      spec.ar ??
        resolvedStats?.attack2?.toHit ??
        kind?.attack2?.toHit ??
        baseAr,
    ),
  )
  const baseSpecial1Ar = applyEquipAr(
    Math.max(
      1,
      spec.ar ??
        resolvedStats?.special1?.toHit ??
        kind?.special1?.toHit ??
        baseAttack2Ar,
    ),
  )
  const arDmgNum = unscaledXp ? 16 : 15 + px
  const minDmg = Math.max(1, Math.floor((baseMinDmg * arDmgNum) / 16))
  const maxDmg = Math.max(minDmg, Math.floor((baseMaxDmg * arDmgNum) / 16))
  const ar = Math.max(1, Math.floor((baseAr * arDmgNum) / 16))
  const attack2Ar = Math.max(1, Math.floor((baseAttack2Ar * arDmgNum) / 16))
  const special1Ar = Math.max(1, Math.floor((baseSpecial1Ar * arDmgNum) / 16))
  const ac = Math.max(
    0,
    (spec.ac ?? resolvedStats?.armor ?? resolvedStats?.armour ?? level * 5) +
      (monEquipLoadout?.defenseBonus ?? 0),
  )

  const isKillable =
    spec.isKillable ??
    spec.killable ??
    (isNpc ? false : (kind?.killable ?? true))
  const petIgnore = Boolean(spec.petIgnore ?? kind?.petIgnore ?? false)
  const isBoss = Boolean(
    spec.isBoss ??
      (kind?.isBoss || kind?.boss || rank === 'unique'),
  )
  const isPrimeEvil = Boolean(
    spec.isPrimeEvil ?? kind?.isPrimeEvil ?? kind?.primeevil ?? false,
  )
  const isUndead = Boolean(spec.isUndead ?? kind?.isUndead ?? false)
  const isDemon = Boolean(spec.isDemon ?? kind?.isDemon ?? false)
  const isFlying = Boolean(
    spec.isFlying ?? spec.flying ?? kind?.isFlying ?? kind?.flying ?? false,
  )
  const modeMissiles = kind?.modeMissiles
  // 1.13c resurrection is a `MonStats.txt` `Skill1..8` row with `srvdofunc=97` on the caster:
  // FallenShaman -> Resurrect (181), FetishShaman/GreaterMummy -> Resurrect2 (327), plus legacy 183/190.
  // SkeletonRaise (158) has an empty `srvdofunc` and is the raise sequence (`seq_skeletonraise` /
  // `seq_fethisraise`) played on the revived unit, never a corpse-resurrecting spell cast by skeletons/fetishes.
  const resurrectSkillId =
    spec.resurrectSkillId ??
    (kind?.skills ?? rawClassKind?.skills ?? []).find(
      (s) => s.skillId === 181 || s.skillId === 327 || s.skillId === 183 || s.skillId === 190,
    )?.skillId
  // Ranged basic attacks (`F12.3`) come strictly from `MonStats.txt` `RangedType` (`1`) or the
  // `MonAI.txt` behavior profile (`ranged: true`), never from display names or blanket `MissA1..MissS1`
  // columns (`#2004`: 55 `RangedType = 0` rows like `councilmember1..3` `#345..347` `mS1 = 1` + `HPS1HTH`
  // `event = 2`, `venomlord` `#558`, `regurgitator1..4` `#307..309, #694`, and `maggotqueen1..5` `#284..288`
  // store skill/special missiles in `MissA2`/`MissS1` without being ranged shooters).
  const aiName = spec.ai ?? kind?.ai ?? rawClassKind?.ai ?? ''
  const isRanged = Boolean(
    spec.isRanged ??
      (kind?.ranged ||
        kind?.isRanged ||
        rawClassKind?.ranged ||
        rawClassKind?.isRanged ||
        monsterProfile113c(aiName).ranged),
  )

  const resistances = {
    phys:
      spec.resistances?.phys ??
      resolvedStats?.resistances?.physical ??
      (umodIds.includes(MON_UMOD.GHOSTLY)
        ? 80
        : umodIds.includes(MON_UMOD.STONESKIN) && rank !== 'minion'
          ? 50
          : 0),
    magic:
      (spec.resistances?.magic ??
        resolvedStats?.resistances?.magic ??
        (umodIds.includes(MON_UMOD.MANahit) && rank !== 'minion' ? 20 : 0)) +
      (monEquipLoadout?.resistMagic ?? 0),
    fire:
      (spec.resistances?.fire ?? resolvedStats?.resistances?.fire ?? 0) +
      (monEquipLoadout?.resistFire ?? 0),
    light:
      (spec.resistances?.light ??
        spec.resistances?.lightning ??
        resolvedStats?.resistances?.lightning ??
        0) + (monEquipLoadout?.resistLightning ?? 0),
    cold:
      (spec.resistances?.cold ?? resolvedStats?.resistances?.cold ?? 0) +
      (monEquipLoadout?.resistCold ?? 0),
    poison:
      (spec.resistances?.poison ?? resolvedStats?.resistances?.poison ?? 0) +
      (monEquipLoadout?.resistPoison ?? 0),
  }

  // Store inventories are filled per player when a trade / gamble window opens (handleNpcAction).
  const vendorPool: ServerItemEntry[] = []

  const specMeleeOverride = spec.minDmg !== undefined || spec.maxDmg !== undefined
  const baseAttack2MinDmg = specMeleeOverride
    ? baseMinDmg
    : Math.max(
        1,
        (resolvedStats?.attack2?.minDamage ??
          resolvedStats?.attack2?.min ??
          kind?.attack2?.minDamage ??
          baseMinDmg) + equipWeaponMin,
      )
  const baseAttack2MaxDmg = specMeleeOverride
    ? baseMaxDmg
    : Math.max(
        baseAttack2MinDmg,
        (resolvedStats?.attack2?.maxDamage ??
          resolvedStats?.attack2?.max ??
          kind?.attack2?.maxDamage ??
          baseMaxDmg) + equipWeaponMax,
      )
  const baseSpecial1MinDmg = specMeleeOverride
    ? baseMinDmg
    : Math.max(
        1,
        (resolvedStats?.special1?.minDamage ??
          resolvedStats?.special1?.min ??
          kind?.special1?.minDamage ??
          baseAttack2MinDmg) + equipWeaponMin,
      )
  const baseSpecial1MaxDmg = specMeleeOverride
    ? baseMaxDmg
    : Math.max(
        baseSpecial1MinDmg,
        (resolvedStats?.special1?.maxDamage ??
          resolvedStats?.special1?.max ??
          kind?.special1?.maxDamage ??
          baseAttack2MaxDmg) + equipWeaponMax,
      )
  const attack2MinDmg = Math.max(1, Math.floor((baseAttack2MinDmg * arDmgNum) / 16))
  const attack2MaxDmg = Math.max(attack2MinDmg, Math.floor((baseAttack2MaxDmg * arDmgNum) / 16))
  const special1MinDmg = Math.max(1, Math.floor((baseSpecial1MinDmg * arDmgNum) / 16))
  const special1MaxDmg = Math.max(special1MinDmg, Math.floor((baseSpecial1MaxDmg * arDmgNum) / 16))
  const baseElementalAttacks =
    resolvedStats?.elementalAttacks ?? kind?.elementalAttacks ?? []
  const elementalAttacks =
    arDmgNum === 16 || baseElementalAttacks.length === 0
      ? baseElementalAttacks
      : baseElementalAttacks.map((ea) => {
          const minBase = ea.minDamage ?? ea.min ?? 0
          const maxBase = ea.maxDamage ?? ea.max ?? 0
          const scaledMin = minBase > 0 ? Math.max(1, Math.floor((minBase * arDmgNum) / 16)) : 0
          const scaledMax = maxBase > 0 ? Math.max(scaledMin, Math.floor((maxBase * arDmgNum) / 16)) : 0
          return {
            ...ea,
            min: scaledMin,
            max: scaledMax,
            minDamage: scaledMin,
            maxDamage: scaledMax,
          }
        })
  const hasAttack2 = Boolean(
    (resolvedStats?.attack2?.maxDamage ?? resolvedStats?.attack2?.max ??
      kind?.attack2?.maxDamage ?? kind?.attack2?.max ?? 0) > 0,
  )
  const hasSpecial1 = Boolean(
    (resolvedStats?.special1?.maxDamage ?? resolvedStats?.special1?.max ??
      kind?.special1?.maxDamage ?? kind?.special1?.max ?? 0) > 0,
  )

  const initialSubmerged =
    !isNpc && isSubmergeCapableMonsterHcIdx113c(hcIdx) && !(spec.startSurfaced ?? false)
  const initialMode = initialSubmerged ? 14 : 1
  const meleeRange = Math.max(
    1,
    Math.floor(
      spec.meleeRange ??
        (isTentacleHcIdx113c(hcIdx) ? 6 : isBaalTentacleHcIdx113c(hcIdx) ? 5 : 1),
    ),
  )

  const nameSeed =
    spec.nameSeed !== undefined
      ? spec.nameSeed & 0xffff
      : spec.superUniqueId !== undefined
        ? 0
        : (Math.imul(unitId, 0x9e37) ^ hcIdx ^ (spec.statSeed ?? 0)) & 0xffff

  const compBitWidths = MONSTATS2_COMP_BIT_WIDTHS_BY_HCIDX[hcIdx]
  const compVariants =
    spec.compVariants !== undefined
      ? spec.compVariants
      : !isNpc && compBitWidths !== undefined
        ? (rolledOutfit ??
          compBitWidths.map((w, idx) =>
            w > 1
              ? ((Math.imul(nameSeed ^ unitId ^ (idx * 37), 0x9e3779b1) >>> 16) & ((1 << w) - 1))
              : 0,
          ))
        : undefined

  const record: InternalMonsterRecord = {
    unitId,
    classId,
    hcIdx,
    defId,
    superUniqueId: spec.superUniqueId,
    nameSeed,
    compVariants,
    name:
      spec.name ??
      resolvedStats?.name ??
      kind?.id ??
      (isNpc ? `NPC_${classId}` : `Monster_${classId}`),
    areaId,
    x: spec.x,
    y: spec.y,
    hp,
    maxHp,
    baseMaxHp,
    unscaledMaxHp,
    level,
    baseXp,
    experience,
    unscaledXp,
    baseMinDmg,
    baseMaxDmg,
    minDmg,
    maxDmg,
    baseAttack2MinDmg,
    baseAttack2MaxDmg,
    attack2MinDmg,
    attack2MaxDmg,
    baseSpecial1MinDmg,
    baseSpecial1MaxDmg,
    special1MinDmg,
    special1MaxDmg,
    hasAttack2,
    hasSpecial1,
    baseElementalAttacks,
    elementalAttacks,
    pendingAttack: undefined,
    pendingAllyAttack: undefined,
    baseAr,
    baseAttack2Ar,
    baseSpecial1Ar,
    ar,
    attack2Ar,
    special1Ar,
    ac,
    mode: initialMode,
    dead: false,
    isNpc,
    isVendor,
    isKillable,
    petIgnore,
    isBoss,
    isPrimeEvil,
    isUndead,
    isDemon,
    isFlying,
    isRanged,
    modeMissiles,
    noRatio,
    rank,
    modifiers: modifierNames,
    umodIds,
    monType: spec.monType ?? kind?.monType ?? rawClassKind?.monType ?? '',
    sizeX: kind?.sizeX ?? rawClassKind?.sizeX ?? 2,
    skills: monsterSkills,
    skillCooldown: 0,
    vampireUpgradeCooldownTicks: 0,
    skillCursor: 0,
    threatPlayerId: 0,
    threatUntilFrame: 0,
    lastHitByMerc: false,
    wanderCooldown: 90,
    wanderTargetX: Number.NaN,
    wanderTargetY: Number.NaN,
    hitRecoveryUntilFrame: 0,
    pendingResurrection: undefined,
    teleportCooldownUntilFrame: 0,
    lastLightningBoltFrame: undefined,
    pendingDeathExplosion: undefined,
    resurrectSkillId,
    auraSkillId,
    auraLevel,
    ai: spec.ai ?? kind?.ai ?? 'Idle',
    aiDelay: Math.max(
      1,
      Math.floor(
        spec.aiDelay ??
          resolvedStats?.aiDelay ??
          (umodIds.includes(MON_UMOD.FANATIC)
            ? Math.max(1, Math.floor(((kind?.aiDelay ?? 15) * 30) / 100))
            : (kind?.aiDelay ?? 15)),
      ),
    ),
    aiParams: spec.aiParams ?? kind?.aiParams ?? [0, 0, 0, 0, 0, 0, 0, 0],
    nextAiFrame:
      this.drlgRoomPopulator !== null && !isNpc
        ? this.currentFrame === 0
          ? 4
          : this.currentFrame + 25
        : 0,
    pathRunning: false,
    spawnedChildren: 0,
    consecutiveA2: 0,
    frenzyUntilFrame: 0,
    frenzySpeedPct: 0,
    resistances,
    drain: spec.drain ?? kind?.drain ?? 100,
    coldEffect: spec.coldEffect ?? kind?.coldEffect ?? -50,
    damageRegen: spec.damageRegen ?? kind?.damageRegen ?? 0,
    regenCarry: 0,
    poisonBitrate256: 0,
    poisonRemainingFrames: 0,
    poisonCarry256: 0,
    poisonAttackerId: 0,
    poisonSkillId: 0,
    toBlock:
      spec.toBlock ??
      (this.drlgRoomPopulator !== null && !canMonsterBlock113c(hcIdx, rolledOutfit)
        ? 0
        : (kind?.toBlock ?? 0)),
    velocity:
      spec.velocity ??
      (umodIds.includes(MON_UMOD.GHOSTLY)
        ? Math.max(1, Math.floor((kind?.velocity ?? 6) / 2))
        : umodIds.includes(MON_UMOD.FANATIC) || umodIds.includes(MON_UMOD.FAST)
          ? (kind?.velocity ?? 6) * 2
          : (kind?.velocity ?? 6)),
    runSpeed:
      spec.runSpeed ??
      (umodIds.includes(MON_UMOD.GHOSTLY)
        ? Math.max(1, Math.floor((kind?.runVelocity ?? 9) / 2))
        : umodIds.includes(MON_UMOD.FANATIC) || umodIds.includes(MON_UMOD.FAST)
          ? (kind?.runVelocity ?? 9) * 2
          : (kind?.runVelocity ?? 9)),
    stepSpeed: spec.stepSpeed,
    // MonStats `aidist` is the AI sight distance; 0 means the 1.13c default ~20 sub-tiles.
    aggroRadius:
      spec.aggroRadius ??
      ((kind?.aiDistance ?? rawClassKind?.aiDistance ?? 0) > 0
        ? (kind?.aiDistance ?? rawClassKind?.aiDistance ?? 20)
        : 20),
    cooldown: hcIdx >= 540 && hcIdx <= 542 ? 8 : 0,
    // MonStats `aidel` is the AI think interval (difficulty tier, Extra Fast boss 0.5x & Fanatic -70% delay, #1946).
    cooldownTicks: Math.max(
      1,
      Math.floor(
        spec.aiDelay ??
          (umodIds.includes(MON_UMOD.FAST) && rank !== 'minion'
            ? Math.max(
                1,
                Math.floor(
                  (resolvedStats?.aiDelay ?? kind?.aiDelay ?? rawClassKind?.aiDelay ?? 6) * 0.5,
                ),
              )
            : (resolvedStats?.aiDelay ??
              (umodIds.includes(MON_UMOD.FANATIC)
                ? Math.max(1, Math.floor(((kind?.aiDelay ?? rawClassKind?.aiDelay ?? 6) * 30) / 100))
                : (kind?.aiDelay ?? rawClassKind?.aiDelay ?? 6)))),
      ),
    ),
    frozenTicks: 0,
    chillTicks: 0,
    convertedUntilFrame: 0,
    convertedByPlayerId: 0,
    path: [],
    pathIndex: 0,
    pathTargetX: Number.NaN,
    pathTargetY: Number.NaN,
    pathNextRecomputeFrame: 0,
    homeX: spec.x,
    homeY: spec.y,
    fleeTicks: 0,
    fleeTargetX: Number.NaN,
    fleeTargetY: Number.NaN,
    shattered: false,
    revivedByShaman: false,
    uncursable: isMonsterUncursable113c(umodIds, resolvedStats?.uncursable),
    alwaysRunAi: isAlwaysRunAiMonster113c(umodIds, spec.alwaysRunAi),
    killMinions: shouldKillMinionsOnDeath113c({
      hcIdx,
      defId,
      superUniqueId: spec.superUniqueId,
      killMinions: spec.killMinions ?? kind?.killMinions ?? rawClassKind?.killMinions,
      splEndDeath: kind?.splEndDeath ?? rawClassKind?.splEndDeath,
      umodIds,
    }).purge,
    alreadyGrantedKillRewards: Boolean(spec.alreadyGrantedKillRewards),
    selfResurrectCheckFrame: 0,
    selfResurrectCount: 0,
    aiDisabled: Boolean(spec.aiDisabled || isNpc),
    pendingDropItems: undefined,
    pendingDropFrame: 0,
    baalThroneWave: 0,
    baalThroneFlags: 0,
    baalThroneTimerFrame: 0,
    pendingBaalWaveSpawn: undefined,
    states:
      auraSkillId !== undefined && PALADIN_AURA_STATE_BY_SKILL_ID[auraSkillId] !== undefined
        ? new Set([PALADIN_AURA_STATE_BY_SKILL_ID[auraSkillId]!])
        : new Set(),
    stateTimers: new Map(),
    vendorPool,
    vendorStoreGenerated: false,
    monsterPlayerCount,
    meleeRange,
    submerged: initialSubmerged,
    submergeAiState: initialSubmerged ? 1 : 2,
    submergeTimerFrame: this.currentFrame,
    emergeUntilFrame: 0,
    bossUnitId: spec.bossUnitId,
    isUberSummonedMinion: Boolean(spec.isUberSummonedMinion),
    uberSummonNextFrame: 0,
    despawnAtFrame: spec.despawnAtFrame ?? 0,
    baalCloneSpawnCount: 0,
    activeBaalCloneUnitId: 0,
    activeBossChannel: undefined,
    activeHoarfrostWaves: undefined,
    diablogeddonUntilFrame: 0,
    baseAcBeforeShout: ac,
    fleeOriginX: Number.NaN,
    fleeOriginY: Number.NaN,
    boneConstructOwnerPlayerId: spec.boneConstructOwnerPlayerId,
    monProps,
    monEquipLoadout,
    wormsOnDeath: umodIds.includes(40),
    corpseAmmo: 0,
    mountedImpUnitId: undefined,
    mountedOnUnitId: undefined,
    hatchAtFrame:
      aiName === 'MaggotEgg'
        ? this.currentFrame + Math.max(25, (spec.aiParams ?? kind?.aiParams)?.[0] ?? 180)
        : 0,
    align: resolvedAlign,
    spiritAttackedOnce: false,
    trappedSoulState: 0,
    mapAi: spec.mapAi,
    townNpcAiEnabled: isTownNpcMonster113c(hcIdx),
    aiAwake: true,
    runVelocityBonus: 0,
    deathAnimEndFrame: 0,
    actionAnimEndFrame: 0,
  }
  this.monsters.set(unitId, record)
  this.areaPathWorld.spawnMonster(areaId, record, this.currentFrame)
  if (isBonePrisonMonsterHcIdx113c(hcIdx)) {
    this.bonePrisonsWatermark = -1
  }

  this.broadcastToArea(areaId, this.buildMonsterUnitAssignEvent(record))

  if (spec.spawnTentacleLimbs && !isNpc && isTentacleHeadHcIdx113c(hcIdx)) {
    this.spawnTentacleCompanionLimbs(record, spec.startSurfaced)
  }

  return unitId
}



/**
 * 1.13c Act 3 water pool preset companion limbs (`MonPlace` 10/11 + `AiTentacle` `0x6FC9CB10`):
 * spawns `4..6` `Tentacle` (`hcIdx - 3`, i.e. `258..260`) limbs in the surrounding water pool
 * linked via `bossUnitId` to the parent `TentacleHead`.
 */
function spawnTentacleCompanionLimbs(this: GameInstanceHost, 
  head: InternalMonsterRecord,
  startSurfaced?: boolean,
): void {
  const limbClassId = head.hcIdx - 3
  const limbCount = 4 + this.rng.rand(3)
  const area = this.loadedAreas.get(head.areaId)
  const waterCandidates: { x: number; y: number }[] = []
  const fallbackCandidates: { x: number; y: number }[] = []
  for (let r = 2; r <= 5; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
        const lx = Math.round(head.x) + dx
        const ly = Math.round(head.y) + dy
        const d = Math.hypot(dx, dy)
        if (d < 2 || d > 5.5) continue
        if (area !== undefined) {
          const isLand = area.isWalkable(head.areaId, lx, ly, false)
          const isMissilePassable = area.isWalkable(head.areaId, lx, ly, true)
          if (!isLand && isMissilePassable) {
            waterCandidates.push({ x: lx, y: ly })
          } else if (isMissilePassable) {
            fallbackCandidates.push({ x: lx, y: ly })
          }
        } else {
          waterCandidates.push({ x: lx, y: ly })
        }
      }
    }
  }
  const pool = waterCandidates.length >= limbCount ? waterCandidates : [...waterCandidates, ...fallbackCandidates]
  const chosen: { x: number; y: number }[] = []
  const step = pool.length > 0 ? Math.max(1, Math.floor(pool.length / limbCount)) : 1
  for (let i = 0; i < limbCount && pool.length > 0; i++) {
    const baseIdx = (i * step + this.rng.rand(step)) % pool.length
    let picked: { x: number; y: number } | undefined
    for (let k = 0; k < pool.length; k++) {
      const cand = pool[(baseIdx + k) % pool.length]!
      if (!chosen.some((c) => Math.hypot(c.x - cand.x, c.y - cand.y) < 1.5)) {
        picked = cand
        break
      }
    }
    if (!picked) picked = pool[baseIdx]!
    chosen.push(picked)
    this.spawnMonster({
      classId: limbClassId,
      x: picked.x,
      y: picked.y,
      areaId: head.areaId,
      bossUnitId: head.unitId,
      startSurfaced,
    })
  }
}



function spawnObject(this: GameInstanceHost, spec: SpawnObjectSpec): number {
  const unitId = this.allocateUnitId(UNIT_TYPE_113C.object, spec.deferUnitSeed !== true)
  const areaId = spec.areaId ?? this.defaultAreaId ?? 1
  const resolvedPreset =
    spec.classId >= 574 && spec.classId <= 582
      ? resolvePresetObject113c(spec.classId, areaId, (n: number) => this.rng.rand(n))
      : null
  const classId = resolvedPreset?.classId ?? spec.classId
  const a3q3Completed = [...this.players.values()].some((p) =>
    hasQuestFlag113c(p.questFlags, 'a3q3', QUEST_FLAG_COMPLETED_113C),
  )
  const a3q6Completed = [...this.players.values()].some((p) =>
    hasQuestFlag113c(
      p.questFlags,
      'a3q6',
      QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
    ),
  )
  const a5q2Completed = [...this.players.values()].some((p) =>
    hasQuestFlag113c(
      p.questFlags,
      'a5q2',
      QUEST_FLAG_REWARD_PENDING_113C |
        QUEST_FLAG_COMPLETED_113C |
        QUEST_FLAG_COMPLETED_NOW_113C,
    ),
  )
  const a5q5Completed = [...this.players.values()].some((p) =>
    hasQuestFlag113c(
      p.questFlags,
      'a5q5',
      QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
    ),
  )
  // D2Game InitFn 47 (0x6fc8f140) for Durance of Hate Stairs (Objects.txt 386),
  // InitFn 60 (0x6fd084a0) for Compelling Orb (Objects.txt 404), and InitFn 44 (0x6fd086c0)
  // for Mephisto Hellgate (Objects.txt 342): start in OBJMODE_OPENED (2) when their quest is complete.
  const objTxt =
    classId >= 0 && classId < OBJECTS_TXT_113C.length ? OBJECTS_TXT_113C[classId] : undefined
  // D2Game InitFn 57 (0x6FC4EF50): ONLY Objects.txt 397 (SparklyChest) and 455 (SpecialChest)
  // set `[pObj+0x78] = 1`; OperateFn 58 is KhalimChest3 (407), NOT a sparkly chest (#1833).
  const isSparkling =
    spec.isSparkling === true ||
    resolvedPreset?.isSparkling === true ||
    SPARKLY_CHEST_INIT57_CLASS_IDS_113C.has(classId)
  // D2Game InitFn 3 (0x6FC4ECB0): quest chests, sparkly chests, and Mephisto Hellgate (342) are NEVER locked (#1832).
  const isNeverLocked =
    isSparkling ||
    classId === 342 ||
    QUEST_CHEST_OPERATE_FNS_113C.has(objTxt?.operateFn ?? -1)
  const effectiveLocked = isNeverLocked ? false : Boolean(spec.isLocked)
  // D2Game InitFn 41/42 (`0x6fd04980` / `0x6fd02e00`, Sewer Stairs 366 & Sewer Lever 367),
  // InitFn 47 (`0x6fc8f140`, Durance of Hate Stairs 386), InitFn 60 (`0x6fd084a0`, Compelling Orb 404),
  // InitFn 44 (`0x6fd086c0`, Mephisto Hellgate 342), InitFn 73 (`0x6fc765b0`, Ancients Door 547),
  // InitFn 75 (`0x6fc76520`, Baal Return Portal 569 in Area 132), InitFn 76 (`0x6fc773d0`, SummitDoor 564 in Area 120),
  // and OperateFn 34 (`0x6fc8d620`, paired Arcane Sanctuary Portal 298): start in OBJMODE_OPENED (2) when unlocked (#1983, #2020).
  const pairedArcanePortalOpened =
    classId === 298 &&
    [...this.objects.values()].some(
      (o) => o.classId === 298 && o.areaId !== areaId && o.mode === 2,
    )
  const baseMode =
    spec.mode ??
    ((((classId === 366 || classId === 367 || classId === 386 || classId === 404) && a3q3Completed) ||
      (classId === 342 && a3q6Completed) ||
      (classId === 473 && areaId === 111 && a5q2Completed) ||
      (classId === 547 && a5q5Completed) ||
      (classId === 564 && areaId === 120 && !this.isAncientsEncounterActive(areaId)) ||
      (classId === 569 && areaId === 132) ||
      pairedArcanePortalOpened)
      ? 2
      : 0)
  const initialMode =
    baseMode === 0 &&
    spec.rollPreOperate === true &&
    !TOWN_AREAS.has(areaId) &&
    rollPreOperateOpen113c(classId, effectiveLocked, this.rng)
      ? 2
      : baseMode
  const destAreaId =
    spec.destAreaId ?? resolvePresetPortalDestArea113c(classId, areaId)
  const isShrine = Boolean(
    spec.isShrine ||
      (spec.shrineType !== undefined && spec.shrineType > 0) ||
      CANONICAL_113C_OBJECTS[classId]?.isShrine ||
      objTxt?.operateFn === 2,
  )
  const shrineType =
    spec.shrineType ?? (isShrine ? rollShrineType113c(classId, areaId, this.rng) : 0)
  const areaLvlForTrap = getLevelMonsterLevel113c(areaId, this.difficulty, true)
  const trapType =
    initialMode !== 0
      ? 0
      : (spec.trapType ??
        (spec.rollTrap === true && !TOWN_AREAS.has(areaId)
          ? rollChestTrapType113c(classId, areaLvlForTrap, isSparkling, this.rng)
          : 0))
  const record: InternalObjectRecord = {
    unitId,
    classId,
    areaId,
    x: spec.x,
    y: spec.y,
    mode: initialMode,
    isWaypoint: Boolean(spec.isWaypoint),
    isShrine,
    shrineType,
    destAreaId,
    portalOwnerId: undefined,
    linkedPortalId: spec.linkedPortalId,
    isLocked: effectiveLocked,
    isSparkling,
    trapType,
    shrineResetFrame: 0,
    wellCharges:
      classifyObjectOperate113c(classId) === 'well'
        ? computeWellInitialCharges113c(WELL_DEFAULT_PARMS_113C.parm2)
        : 0,
    wellRegenFrames: [],
    useCount: classId === 473 && areaId === 111 && a5q2Completed ? 1 : 0,
  }
  this.objects.set(unitId, record)
  this.areaPathWorld.spawnObject(areaId, unitId, record.classId, record.x, record.y, record.mode)
  this.doorFootprintsWatermark = -1

  this.broadcastToArea(areaId, {
    type: 'UnitAssign',
    unitType: 'object',
    unitId,
    classId: record.classId,
    x: record.x,
    y: record.y,
    areaId,
    unit: {
      unitType: 2,
      id: unitId,
      classId: record.classId,
      x: record.x,
      y: record.y,
      mode: record.mode,
    },
  })
  // D2Game InitFn 60 (0x6fd084a0): when Compelling Orb (404) spawns in mode 0,
  // spawn the invisible MonStats 366 compellingorb monster with MONUMOD_QUESTCOMPLETE (22).
  if (record.classId === 404 && record.mode === 0) {
    record.linkedMonsterId = this.spawnMonster({
      classId: 366,
      x: record.x,
      y: record.y,
      areaId,
      isKillable: false,
      aiDisabled: true,
      monUMods: [22],
    })
  }
  return unitId
}



function spawnGroundItem(this: GameInstanceHost, spec: {
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
}): number {
  const unitId = this.allocateUnitId(UNIT_TYPE_113C.item)
  const info = lookupBaseInfo(spec.code)
  const areaId = spec.areaId ?? this.defaultAreaId ?? 1
  const quantity = Math.max(1, Math.trunc(spec.quantity ?? 1))
  const code = spec.code.trim()
  const stats = new Map<number, number>()
  if (code === 'gld') {
    stats.set(14, quantity)
  } else if (spec.quantity !== undefined) {
    stats.set(70, quantity)
  }
  if (spec.stats) {
    for (const s of spec.stats) {
      stats.set(s.statId, s.value)
    }
  }
  const identified = spec.identified ?? true
  const entry: ServerItemEntry = {
    unitId,
    code,
    name: info.name,
    quality: spec.quality ?? 2,
    level: spec.level ?? 1,
    location: 'ground',
    x: spec.x,
    y: spec.y,
    width: info.width,
    height: info.height,
    areaId,
    ownerId: 0,
    bodyLoc: 0,
    storePage: 0,
    cost: spec.cost ?? info.cost,
    gamble: false,
    identified,
    ethereal: false,
    socketed: false,
    totalSockets: 0,
    durability: info.maxDurability,
    maxDurability: info.maxDurability,
    quantity,
    stats,
    socketedItems: [],
  }
  this.registerGroundItem113c(entry)

  this.broadcastToArea(areaId, {
    type: 'ItemEvent',
    action: 'groundSpawn',
    itemId: unitId,
    code: entry.code,
    x: entry.x,
    y: entry.y,
    container: 'ground',
    item: this.serverEntryToItemData(entry),
  })
  return unitId
}



/**
 * 1.13c quality-tiered ground item decay duration (`D2Game.dll` `ITEMS_SetGroundExpire`, #1915):
 * - `15,000` frames (`10 min` @ 25 Hz): regular/low/superior (`quality 1..3`), consumables/potions/scrolls/keys/ear, and gold `< 10,000`.
 * - `30,000` frames (`20 min` @ 25 Hz): magic (`quality 4`) and gold piles `>= 10,000`.
 * - `45,000` frames (`30 min` @ 25 Hz): set (`5`), rare (`6`), unique (`7`), crafted (`8`), runeword (`IFLAG_RUNEWORD 0x04000000`), and quest items (`quest !== 0`).
 */
function computeGroundItemTtlFrames113c(this: GameInstanceHost, entry: ServerItemEntry): number {
  const cleanCode = entry.code.trim().toLowerCase()
  if (cleanCode === 'gld') {
    const goldQty = Math.max(entry.quantity || 0, entry.stats.get(14) ?? 0)
    return goldQty >= 10_000 ? 30_000 : 15_000
  }
  if (cleanCode === 'ear' || entry.rawItemData?.isEar === true) {
    return 15_000
  }
  const rawFlags = Number(entry.rawItemData?.rawFlags ?? entry.rawItemData?.flags ?? 0)
  if (entry.rawItemData?.runeword === true || (rawFlags & 0x04000000) !== 0) {
    return 45_000
  }
  const baseInfo = lookupBaseInfo(cleanCode)
  if (baseInfo.quest || this.isOnePerPlayerQuestItem(cleanCode)) {
    return 45_000
  }
  const qual = this.normalizeItemQualityCode113c(entry.rawItemData?.quality ?? entry.quality)
  if (qual >= 5) return 45_000
  if (qual === 4) return 30_000
  return 15_000
}



function registerGroundItem113c(this: GameInstanceHost, entry: ServerItemEntry): void {
  entry.expireFrame = this.currentFrame + this.computeGroundItemTtlFrames113c(entry)
  this.groundItems.set(entry.unitId, entry)
}



/**
 * 1.13c `D2Game.dll` party quest recipient resolution (`#1931`):
 * - Non-Act-boss quest objectives (`includeSameActTown: false`): credits `actor` plus same-party
 *   allies currently in `questAreaId` (or stitched outdoor seam within AOI).
 * - Act-end bosses (`Andariel`, `Duriel`, `Mephisto`, `Diablo`, `Baal`; `includeSameActTown: true`):
 *   credits `actor` plus same-party allies in `questAreaId` OR in the same Act's town (`ACT_TOWN_AREA[act]`).
 * - Ancients (`requireExactArea: true, excludeDead: true, minCharLevel: 20/40/60`): requires alive
 *   same-party members standing on Arreat Summit (`120`).
 * - NEVER credits unpartied bystanders!
 */
function getQuestEligiblePartyRecipients113c(this: GameInstanceHost, 
  actor: InternalPlayerRecord | undefined,
  questAreaId: number,
  options?: {
    readonly includeSameActTown?: boolean
    readonly requireExactArea?: boolean
    readonly excludeDead?: boolean
    readonly minCharLevel?: number
  },
): InternalPlayerRecord[] {
  if (actor === undefined) return []
  const actIdx = areaToAct(questAreaId)
  const sameActTown = ACT_TOWN_AREA[actIdx] ?? 1
  const includeTown = options?.includeSameActTown === true && options?.requireExactArea !== true
  const out: InternalPlayerRecord[] = []
  for (const candidate of this.players.values()) {
    if (options?.excludeDead === true && candidate.dead) continue
    if (options?.minCharLevel !== undefined && candidate.level < options.minCharLevel) continue
    const isActor = candidate.unitId === actor.unitId
    if (
      !isActor &&
      (actor.partyId === 0xffff || candidate.partyId !== actor.partyId)
    ) {
      continue
    }
    if (options?.requireExactArea === true) {
      if (candidate.areaId !== questAreaId) continue
    } else if (!isActor) {
      const inQuestArea =
        candidate.areaId === questAreaId ||
        (this.isAreaSeamAdjacent(candidate.areaId, questAreaId) &&
          this.isPointInViewerAoi113c(candidate, questAreaId, actor.x, actor.y))
      const inTown = includeTown && candidate.areaId === sameActTown && candidate.unlockedAct >= actIdx
      if (!inQuestArea && !inTown) continue
    }
    out.push(candidate)
  }
  return out
}



function getGroundItems(this: GameInstanceHost): readonly ServerItemEntry[] {
  return [...this.groundItems.values()]
}



function findMercOrPetRecord(this: GameInstanceHost, 
  unitId: number,
):
  | { readonly kind: 'merc'; readonly merc: InternalMercenaryRecord }
  | {
      readonly kind: 'pet'
      readonly ownerId: number
      readonly areaId: number
      readonly classId: number
      readonly name: string
      readonly x: number
      readonly y: number
      readonly hp: number
      readonly maxHp: number
    }
  | undefined {
  for (const merc of this.mercenaries.values()) {
    if (merc.unitId === unitId && merc.alive) {
      return { kind: 'merc', merc }
    }
  }
  for (const [ownerId, mgr] of this.summonManagers.entries()) {
    for (const pet of mgr.getActivePets()) {
      if (this.petUnitIds.get(pet.uid) === unitId && pet.alive !== false && pet.hp > 0) {
        const petMeta = pet as unknown as { areaId?: number }
        const owner = this.players.get(ownerId)
        const areaId = petMeta.areaId ?? owner?.areaId ?? this.defaultAreaId ?? 1
        return {
          kind: 'pet',
          ownerId,
          areaId,
          classId: pet.classId ?? 363,
          name: pet.name,
          x: pet.x,
          y: pet.y,
          hp: pet.hp,
          maxHp: pet.maxHp,
        }
      }
    }
  }
  return undefined
}



function lookupWorldUnitArea(this: GameInstanceHost, 
  unitType: 'player' | 'monster' | 'object' | 'item' | 'missile' | 'tile',
  unitId: number,
): number | undefined {
  switch (unitType) {
    case 'player': {
      const directPlayer = this.players.get(unitId)
      if (directPlayer) return directPlayer.areaId
      for (const p of this.players.values()) {
        if (p.corpseId === unitId && this.hasLivePrimaryCorpse113c(p)) {
          return p.corpseAreaId ?? p.areaId
        }
        for (const extra of p.extraCorpses ?? []) {
          if (extra.corpseId === unitId && (extra.items.length > 0 || (extra.lostExp ?? 0) > 0)) {
            return extra.areaId
          }
        }
      }
      return undefined
    }
    case 'monster': {
      const m = this.monsters.get(unitId)
      if (m) return m.areaId
      const mp = this.findMercOrPetRecord(unitId)
      return mp?.kind === 'merc' ? mp.merc.areaId : mp?.areaId
    }
    case 'object':
      return this.objects.get(unitId)?.areaId
    case 'tile':
      return this.warpTiles.get(unitId)?.areaId
    case 'item':
      return this.groundItems.get(unitId)?.areaId
    case 'missile': {
      const mis = this.missiles.get(unitId)
      return mis && mis.remainingFrames > 0 ? mis.areaId : undefined
    }
    default:
      return undefined
  }
}



function hasLiveWorldEntity(this: GameInstanceHost, 
  unitType: 'player' | 'monster' | 'object' | 'item' | 'missile' | 'tile',
  unitId: number,
): boolean {
  return this.lookupWorldUnitArea(unitType, unitId) !== undefined
}



function getAoiWorldEntities(this: GameInstanceHost): ReadonlyArray<{
  readonly unitType: 'player' | 'monster' | 'object' | 'item' | 'missile' | 'tile'
  readonly unitId: number
  readonly areaId: number
  readonly x: number
  readonly y: number
}> {
  const out: Array<{
    readonly unitType: 'player' | 'monster' | 'object' | 'item' | 'missile' | 'tile'
    readonly unitId: number
    readonly areaId: number
    readonly x: number
    readonly y: number
  }> = []
  for (const p of this.players.values()) {
    out.push({
      unitType: 'player',
      unitId: p.unitId,
      areaId: p.areaId,
      x: Math.round(p.x),
      y: Math.round(p.y),
    })
    if (this.hasLivePrimaryCorpse113c(p) && p.corpseId !== undefined) {
      out.push({
        unitType: 'player',
        unitId: p.corpseId,
        areaId: p.corpseAreaId ?? p.areaId,
        x: Math.round(p.corpseX),
        y: Math.round(p.corpseY),
      })
    }
    for (const extra of p.extraCorpses ?? []) {
      if (extra.items.length > 0 || (extra.lostExp ?? 0) > 0) {
        out.push({
          unitType: 'player',
          unitId: extra.corpseId,
          areaId: extra.areaId,
          x: Math.round(extra.x),
          y: Math.round(extra.y),
        })
      }
    }
  }
  for (const m of this.monsters.values()) {
    out.push({
      unitType: 'monster',
      unitId: m.unitId,
      areaId: m.areaId,
      x: Math.round(m.x),
      y: Math.round(m.y),
    })
  }
  for (const merc of this.mercenaries.values()) {
    if (!merc.alive) continue
    out.push({
      unitType: 'monster',
      unitId: merc.unitId,
      areaId: merc.areaId,
      x: Math.round(merc.x),
      y: Math.round(merc.y),
    })
  }
  for (const [ownerId, mgr] of this.summonManagers.entries()) {
    const owner = this.players.get(ownerId)
    for (const pet of mgr.getActivePets()) {
      if (pet.alive === false || pet.hp <= 0) continue
      const unitId = this.petUnitIds.get(pet.uid)
      if (unitId === undefined) continue
      const petMeta = pet as unknown as { areaId?: number }
      const areaId = petMeta.areaId ?? owner?.areaId ?? this.defaultAreaId ?? 1
      out.push({
        unitType: 'monster',
        unitId,
        areaId,
        x: Math.round(pet.x),
        y: Math.round(pet.y),
      })
    }
  }
  for (const obj of this.objects.values()) {
    out.push({
      unitType: 'object',
      unitId: obj.unitId,
      areaId: obj.areaId,
      x: Math.round(obj.x),
      y: Math.round(obj.y),
    })
  }
  for (const tile of this.warpTiles.values()) {
    out.push({
      unitType: 'tile',
      unitId: tile.unitId,
      areaId: tile.areaId,
      x: Math.round(tile.x),
      y: Math.round(tile.y),
    })
  }
  for (const gItem of this.groundItems.values()) {
    out.push({
      unitType: 'item',
      unitId: gItem.unitId,
      areaId: gItem.areaId,
      x: Math.round(gItem.x),
      y: Math.round(gItem.y),
    })
  }
  for (const mis of this.missiles.values()) {
    if (mis.remainingFrames <= 0) continue
    out.push({
      unitType: 'missile',
      unitId: mis.unitId,
      areaId: mis.areaId,
      x: Math.round(mis.x),
      y: Math.round(mis.y),
    })
  }
  return out
}



function buildEntityEnterAoiEvents(this: GameInstanceHost, 
  unitType: 'player' | 'monster' | 'object' | 'item' | 'missile' | 'tile',
  unitId: number,
): readonly ServerEvent[] {
  switch (unitType) {
    case 'player': {
      const p = this.players.get(unitId)
      if (!p) {
        for (const owner of this.players.values()) {
          if (owner.corpseId === unitId && this.hasLivePrimaryCorpse113c(owner)) {
            return this.buildPlayerCorpseEvents113c(owner)
          }
          for (const extra of owner.extraCorpses ?? []) {
            if (extra.corpseId === unitId && (extra.items.length > 0 || (extra.lostExp ?? 0) > 0)) {
              return this.buildPlayerCorpseEventsForSet113c(
                owner,
                extra.corpseId,
                extra.areaId,
                extra.x,
                extra.y,
                extra.items,
              )
            }
          }
        }
        return []
      }
      const px = Math.round(p.x)
      const py = Math.round(p.y)
      return [
        {
          type: 'UnitAssign',
          unitType: 'player',
          unitId: p.unitId,
          classId: p.classId,
          name: p.name,
          x: px,
          y: py,
          areaId: p.areaId,
          unit: {
            unitType: 0,
            id: p.unitId,
            classId: p.classId,
            name: p.name,
            x: px,
            y: py,
            mode: p.dead ? 16 : p.mode,
          },
        },
      ]
    }
    case 'monster': {
      const direct = this.buildUnitAssignEvent('monster', unitId)
      if (direct) return [direct]
      const mp = this.findMercOrPetRecord(unitId)
      if (mp?.kind === 'merc') {
        const merc = mp.merc
        const mx = Math.round(merc.x)
        const my = Math.round(merc.y)
        const lifePct =
          merc.maxHp > 0
            ? Math.max(1, Math.min(128, Math.round((merc.hp / merc.maxHp) * 128)))
            : 128
        return [
          {
            type: 'UnitAssign',
            unitType: 'monster',
            unitId: merc.unitId,
            classId: merc.classId,
            name: merc.name,
            x: mx,
            y: my,
            areaId: merc.areaId,
            unit: {
              unitType: 1,
              id: merc.unitId,
              classId: merc.classId,
              name: merc.name,
              x: mx,
              y: my,
              mode: 1,
              lifePct,
              ownerType: 0,
              ownerId: merc.ownerPlayerId,
            },
          },
          {
            type: 'Merc',
            kind: 'assign',
            ownerId: merc.ownerPlayerId,
            mercId: merc.unitId,
            classId: merc.classId,
            nameId: 0,
          },
        ]
      }
      if (mp?.kind === 'pet') {
        const px = Math.round(mp.x)
        const py = Math.round(mp.y)
        const lifePct =
          mp.maxHp > 0
            ? Math.max(1, Math.min(128, Math.round((mp.hp / mp.maxHp) * 128)))
            : 128
        return [
          {
            type: 'UnitAssign',
            unitType: 'monster',
            unitId,
            classId: mp.classId,
            name: mp.name,
            x: px,
            y: py,
            areaId: mp.areaId,
            unit: {
              unitType: 1,
              id: unitId,
              classId: mp.classId,
              name: mp.name,
              x: px,
              y: py,
              mode: 1,
              lifePct,
              ownerType: 0,
              ownerId: mp.ownerId,
            },
          },
        ]
      }
      return []
    }
    case 'object': {
      const obj = this.objects.get(unitId)
      if (!obj) return []
      const out: ServerEvent[] = []
      const assign = this.buildUnitAssignEvent('object', unitId)
      if (assign) out.push(assign)
      if (obj.destAreaId !== undefined) {
        out.push({
          type: 'Portal',
          portalId: obj.unitId,
          ownerId: obj.portalOwnerId,
          areaId: obj.areaId,
          destAreaId: obj.destAreaId,
          localId: obj.unitId,
          remoteId: obj.unitId,
          flags: 1,
        })
      }
      return out
    }
    case 'tile': {
      const tile = this.warpTiles.get(unitId)
      return tile ? [this.warpTileAssignEvent(tile)] : []
    }
    case 'item': {
      const gItem = this.groundItems.get(unitId)
      if (!gItem) return []
      return [
        {
          type: 'ItemEvent',
          action: 'groundSpawn',
          itemId: gItem.unitId,
          code: gItem.code,
          x: gItem.x,
          y: gItem.y,
          container: 'ground',
          item: this.serverEntryToItemData(gItem),
        },
        ...this.buildSocketChildEvents(gItem, 0x13),
      ]
    }
    case 'missile': {
      const mis = this.missiles.get(unitId)
      if (!mis || mis.remainingFrames <= 0) return []
      const sx = Math.round(mis.x)
      const sy = Math.round(mis.y)
      const tx = Math.round(mis.x + mis.vx * mis.remainingFrames)
      const ty = Math.round(mis.y + mis.vy * mis.remainingFrames)
      return [
        {
          type: 'CreateMissile',
          missileId: mis.unitId,
          missileClassId: mis.missileId,
          at: { x: sx, y: sy },
          target: { x: tx, y: ty },
          x: sx,
          y: sy,
          targetX: tx,
          targetY: ty,
          remainingFrames: mis.remainingFrames,
          skillId: mis.skillId,
          level: 1,
          ownerType: mis.ownerType,
          ownerId: mis.ownerId,
          areaId: mis.areaId,
        },
      ]
    }
    default:
      return []
  }
}



function enqueueCommand(this: GameInstanceHost, playerUnitId: number, command: ClientCommand): void {
  if (!this.players.has(playerUnitId)) return
  this.commandQueue.push({ playerUnitId, command })
}



/**
 * #1327: 1.13c room-based population. When a player stands in a DRLG room, that
 * room and its near rooms (touching bounds, `pRoom->ppRoomsNear`) are populated
 * once from the level's `Levels.txt` plan (`MonDen`, `NumMon`, `mon`/`nmon`,
 * `umon` + `MonUMin..MonUMax` elites with `MonUMod.txt` affixes), with
 * `MonStats.txt` + `MonLvl.txt` stats at the level's `MonLvl*Ex`. Towns and
 * `MonDen = 0` levels never populate; monsters only land on walkable cells.
 */
/**
 * Activate the DRLG rooms around a player and spawn their pending preset monsters.
 *
 * 1.13c: rooms near the room a unit stands in become active (D2Common room-near list, the same
 * touching-rectangle neighbourhood `streamWildernessRoomsForPlayer` uses). Every newly activated room is
 * pushed to the act's new-room list, which `D2Game.dll` `0x6FC4CBE0` walks head-first each frame
 * (`[pDrlg+0x54]`, next = `[room+0x7C]`), calling `0x6FD01430` to spawn the room's presets (objects, then
 * monsters `type == 1`). The oracle trace of the Rogue Encampment shows the resulting order: the player's
 * own room last, the other near rooms in descending (y, x) order, i.e. activation order
 * `[current, ...near rooms ascending (y, x)]` with head insertion (docs/oracle/P4-first-divergence.md #2).
 */
function activatePresetRoomsNearPlayer113c(this: GameInstanceHost, player: InternalPlayerRecord): void {
  if (this.drlgRoomPopulator !== null) return
  const pending = this.pendingPresetMonsters.get(player.areaId)
  if (pending === undefined) return
  const area = this.loadedAreas.get(player.areaId)
  if (area === undefined) return
  const px = Math.floor(player.x)
  const py = Math.floor(player.y)
  const current = area.roomRects.find(
    (r) => px >= r.x && py >= r.y && px < r.x + r.w && py < r.y + r.h,
  )
  if (current === undefined) return
  // Activation order: the player's room, then its D2Common `ppRoomsNear` list in order (DRLG
  // `sub_6FD77BB0` + `DRLGROOM_SortRoomListByPosition` `0x6FD77EB0`, exposed as `roomRects[].near`).
  // Geometry without the DRLG capture (synthetic test levels) falls back to the touching rooms in
  // ascending `(y, x)` order.
  let near: (typeof area.roomRects)[number][]
  if (current.near !== undefined) {
    const byIndex = new Map(area.roomRects.map((r) => [r.index, r] as const))
    near = current.near
      .filter((idx) => idx !== current.index)
      .map((idx) => byIndex.get(idx))
      .filter((r): r is NonNullable<typeof r> => r !== undefined)
  } else {
    near = area.roomRects.filter(
      (room) =>
        room.index !== current.index &&
        room.x <= current.x + current.w &&
        room.x + room.w >= current.x &&
        room.y <= current.y + current.h &&
        room.y + room.h >= current.y,
    )
    near.sort((a, b) => a.y - b.y || a.x - b.x)
  }
  const activation = [current, ...near].filter((r) => !pending.activated.has(r.index))
  if (activation.length === 0) return
  for (const room of activation) pending.activated.add(room.index)
  const a5q2AlreadyDone =
    player.areaId === 111 &&
    [...this.players.values()].some((p) =>
      hasQuestFlag113c(
        p.questFlags,
        'a5q2',
        QUEST_FLAG_REWARD_PENDING_113C |
          QUEST_FLAG_COMPLETED_113C |
          QUEST_FLAG_COMPLETED_NOW_113C,
      ),
    )
  // Head insertion into the new-room list: processed in reverse activation order. Per room
  // (`0x6FC4CBE0` -> `0x6FD01430`): preset objects, then preset monsters; the room's warp tiles follow.
  for (let i = activation.length - 1; i >= 0; i -= 1) {
    const entry = pending.byRoom.get(activation[i]!.index)
    if (entry === undefined) continue
    pending.byRoom.delete(activation[i]!.index)
    for (const objectId of entry.objectIds) {
      this.drawDeferredUnitSeed113c(UNIT_TYPE_113C.object, objectId)
      // D2Game.dll InitFn 28 (`ACT5Q2_ObjInit` @ `0x6FC7C850 -> 0x6FC7C2A0`, #2021):
      // when `cagedwussie1` (`Objects.txt 473`) activates in Frigid Highlands (`Area 111`) before `a5q2`
      // completion, spawn 5 friendly `act5pow` (`hcIdx 534`, `Align = 1`) soldiers inside the pen.
      if (player.areaId === 111 && !a5q2AlreadyDone) {
        const penObj = this.objects.get(objectId)
        if (
          penObj !== undefined &&
          penObj.classId === 473 &&
          penObj.useCount === 0 &&
          !this.arreatSpawnedPenObjectIds.has(penObj.unitId)
        ) {
          this.arreatSpawnedPenObjectIds.add(penObj.unitId)
          const powOffsets: readonly (readonly [number, number])[] = [
            [-1, -1],
            [1, -1],
            [0, 0],
            [-1, 1],
            [1, 1],
          ]
          for (const [dx, dy] of powOffsets) {
            const stand = findStandableNear(
              (x, y) => area.isWalkable(111, x, y),
              penObj.x + dx,
              penObj.y + dy,
              6,
            )
            this.spawnMonster({
              classId: 534,
              defId: 'act5pow',
              x: stand?.x ?? penObj.x + dx,
              y: stand?.y ?? penObj.y + dy,
              areaId: 111,
              align: 1,
            })
          }
        }
      }
    }
    for (const mon of entry.monsters) this.spawnAreaPresetMonster113c(player.areaId, mon)
    for (const tileId of entry.tileIds) this.drawDeferredUnitSeed113c(UNIT_TYPE_113C.tile, tileId)
  }
  if (pending.byRoom.size === 0) this.pendingPresetMonsters.delete(player.areaId)
}



function streamWildernessRoomsForPlayer(this: GameInstanceHost, player: InternalPlayerRecord): void {
  if (this.drlgRoomPopulator !== null) return
  if (TOWN_AREAS.has(player.areaId)) return
  const provider = this.areaRoomProvider
  const walkable = this.terrainWalkableCheck
  if (!provider || !walkable) return

  let state = this.areaPopulations.get(player.areaId)
  if (!state) {
    const rooms = provider(player.areaId) ?? []
    const levelSeed = (this.currentMapSeed ^ Math.imul(player.areaId, 0x9e3779b1)) >>> 0
    state = {
      rooms,
      plan: planLevelPopulation113c(player.areaId, this.difficulty, rooms, levelSeed),
      populated: new Set<number>(),
    }
    this.areaPopulations.set(player.areaId, state)
  }
  const plan = state.plan
  if (!plan) return

  const px = Math.floor(player.x)
  const py = Math.floor(player.y)
  const current = state.rooms.find(
    (r) => px >= r.x && py >= r.y && px < r.x + r.w && py < r.y + r.h,
  )
  if (!current) return

  const areaId = player.areaId
  for (const room of state.rooms) {
    if (state.populated.has(room.index)) continue
    const near =
      room.x <= current.x + current.w &&
      room.x + room.w >= current.x &&
      room.y <= current.y + current.h &&
      room.y + room.h >= current.y
    if (!near) continue
    state.populated.add(room.index)
    const spawns = planRoomPopulation113c(plan, room, (x, y) =>
      walkable(areaId, x, y, false),
    )
    for (let i = 0; i < spawns.length; i++) {
      const s = spawns[i]!
      this.spawnMonster({
        classId: s.kind.hcIdx,
        areaId,
        x: s.x,
        y: s.y,
        rank: s.rank,
        modifiers: s.modifiers,
        areaLevel: plan.plan.monsterLevel,
        statSeed: (room.seed ^ Math.imul(i + 1, 0x85ebca6b)) >>> 0,
      })
    }
  }
}



/**
 * Spawn a `SuperUniques.txt` boss (DRLG preset `type 1`, index `>= MonStats count`)
 * with its `Mod1..Mod3` affixes and `MinGrp..MaxGrp` minions (`MonStats.txt`
 * `minion1`/`minion2`, or its own class when it has none).
 *
 * @returns the unit ids, boss first.
 */
function getSojSoldCount(this: GameInstanceHost): number {
  return this.sojSoldCount
}



function isWorldEventTriggered(this: GameInstanceHost): boolean {
  return this.worldEventTriggered
}



function isDiabloCloneSpawned(this: GameInstanceHost): boolean {
  return this.diabloCloneSpawned
}



function isEligibleWorldEventSuperUnique113c(this: GameInstanceHost, 
  superUniqueIndex: number,
  areaId: number,
): boolean {
  if (this.difficulty !== 2 || TOWN_AREAS.has(areaId)) return false
  // Exclude scripted non-replaceable quest encounter waves (Chaos Seals 36..38 in 108, Ancients 43..45, Baal Throne 61..65).
  if (areaId === 108 && superUniqueIndex >= 36 && superUniqueIndex <= 38) return false
  if (superUniqueIndex >= 43 && superUniqueIndex <= 45) return false
  if (superUniqueIndex >= 61 && superUniqueIndex <= 65) return false
  return true
}



function spawnDiabloCloneAt113c(this: GameInstanceHost, areaId: number, x: number, y: number): number {
  this.diabloCloneSpawned = true
  this.broadcastToArea(areaId, {
    type: 'MonsterSpecial',
    classId: 333,
  })
  return this.spawnMonster({
    classId: 333,
    hcIdx: 333,
    defId: 'diabloclone',
    name: 'Diablo',
    areaId,
    x,
    y,
    rank: 'unique',
    isBoss: true,
    isPrimeEvil: true,
    level: 110,
  })
}



function maybeReplacePreloadedRoomSuperUniqueWithDiabloClone113c(this: GameInstanceHost, 
  areaId: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): void {
  for (const [bossId, pack] of this.spawnedSuperUniquePackIds.entries()) {
    if (pack.areaId !== areaId) continue
    if (!this.isEligibleWorldEventSuperUnique113c(pack.superUniqueIndex, areaId)) continue
    const boss = this.monsters.get(bossId)
    if (!boss || boss.dead || boss.hp < boss.maxHp) continue
    if (boss.x < rx || boss.x >= rx + rw || boss.y < ry || boss.y >= ry + rh) continue

    for (const memberId of pack.allUnitIds) {
      if (this.monsters.delete(memberId)) {
        this.monsterCombat.delete(memberId)
        this.broadcastToArea(areaId, {
          type: 'UnitRemove',
          unitType: 1,
          id: memberId,
          unitId: memberId,
          areaId,
        })
      }
    }
    this.spawnedSuperUniquePackIds.delete(bossId)
    this.spawnDiabloCloneAt113c(areaId, pack.x, pack.y)
    return
  }
}



function spawnSuperUnique(this: GameInstanceHost, spec: {
  readonly superUniqueIndex: number
  readonly x: number
  readonly y: number
  readonly areaId?: number | undefined
}): number[] {
  const su = getSuperUniqueByIndex(spec.superUniqueIndex)
  if (!su) {
    throw new Error(`SuperUniques.txt has no row ${String(spec.superUniqueIndex)}`)
  }
  const areaId = spec.areaId ?? this.defaultAreaId ?? 1
  if (
    this.worldEventTriggered &&
    !this.diabloCloneSpawned &&
    this.isEligibleWorldEventSuperUnique113c(spec.superUniqueIndex, areaId)
  ) {
    return [this.spawnDiabloCloneAt113c(areaId, spec.x, spec.y)]
  }
  const diffName =
    this.difficulty === 2 ? 'hell' : this.difficulty === 1 ? 'nightmare' : 'normal'
  const kinds = getCanonicalMonsterKinds(diffName)
  const bossKind = kinds.get(su.monsterId)
  if (!bossKind) {
    throw new Error(`SuperUnique ${su.id}: Class '${su.monsterId}' is not a MonStats.txt Id`)
  }
  const levelPlan = getLevelMonsterPlan113c(areaId, diffName)
  const areaLevel = levelPlan?.monsterLevel
  // D2Game.dll 0x6FC451F0 (0x6FC45307..0x6FC453B6):
  // Apply fixed Mod1..Mod3 (stopping at 0, skipping 24 thief) and roll +difficulty (0/1/2) random Unique modifiers.
  const rolledSuUMods = rollSuperUniqueUModIds113c(
    su.modifiers,
    this.rng,
    this.difficulty,
    bossKind,
  )
  // D2Game.dll 0x6FC454FC: Baal Throne wave bosses (SuperUniques 61..65) receive MONUMOD_QUESTCOMPLETE (22).
  const isBaalWaveBoss = spec.superUniqueIndex >= 61 && spec.superUniqueIndex <= 65
  const bossUMods = isBaalWaveBoss
    ? [...rolledSuUMods, MON_UMOD.QUESTCOMPLETE]
    : rolledSuUMods
  // #2018: Snap SuperUnique boss onto connected walkable floor within 100 subtiles (`D2GAME_FindFreeCoords`
  // @ `0x6FC54130`, `maxRadius = 0x64`) when `(spec.x, spec.y)` lands on blocked/void terrain, and center
  // minion rings around `(bossX, bossY)` up to `r = 12` so large packs (e.g. Baal Wave 2 `5 + 10 = 15`)
  // never clip into walls or starve near pillars.
  const hasLoadedArea = this.loadedAreas.has(areaId)
  const isWalkable = (x: number, y: number): boolean =>
    hasLoadedArea
      ? this.isWorldWalkableForPlayer(areaId, x, y)
      : !this.terrainWalkableCheck || this.terrainWalkableCheck(areaId, x, y, false)
  let bossX = spec.x
  let bossY = spec.y
  const rawBossCellX = Math.round(spec.x)
  const rawBossCellY = Math.round(spec.y)
  if (hasLoadedArea) {
    if (!isStandableSubTile(isWalkable, rawBossCellX, rawBossCellY)) {
      const stand = findStandableNear(isWalkable, spec.x, spec.y, 100)
      if (stand !== null) {
        bossX = stand.x
        bossY = stand.y
      } else if (!isWalkable(rawBossCellX, rawBossCellY)) {
        return []
      }
    }
  } else if (
    this.terrainWalkableCheck &&
    !this.terrainWalkableCheck(areaId, rawBossCellX, rawBossCellY, false)
  ) {
    const stand = findStandableNear(isWalkable, spec.x, spec.y, 100)
    if (stand !== null) {
      bossX = stand.x
      bossY = stand.y
    }
  }
  const ids: number[] = []
  ids.push(
    this.spawnMonster({
      classId: bossKind.hcIdx,
      name: su.name ?? su.nameKey,
      areaId,
      x: bossX,
      y: bossY,
      rank: 'superunique',
      superUniqueId: su.id,
      monUMods: bossUMods,
      areaLevel,
    }),
  )

  // D2Game.dll 0x6FC45382: when SuperUniques.txt MinGrp > 0, add +difficulty (0/1/2) to MinGrp and MaxGrp.
  const minionIds = CANONICAL_BOSS_MINIONS[su.id] ?? [su.monsterId]
  const diffBonus = su.minMinions > 0 ? this.difficulty : 0
  const minMinions = Math.max(0, su.minMinions + diffBonus)
  const maxMinions = Math.max(minMinions, su.maxMinions + diffBonus)
  const count = minMinions + this.rng.rand(maxMinions - minMinions + 1)
  const extraColdMageCount = spec.superUniqueIndex === 62 ? 10 : 0
  const totalNeeded = count + extraColdMageCount
  const offsets: (readonly [number, number])[] = []
  if (totalNeeded > 0) {
    for (let r = 1; r <= 12; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) === r) offsets.push([dx, dy])
        }
      }
    }
  }
  const minionUMods = bossUMods.filter((id) => {
    const row = MONUMOD_113C_ROWS.find((r) => r.umodId === id)
    return row !== undefined && row.xfer && !row.champion
  })
  const bossCenterX = Math.round(bossX)
  const bossCenterY = Math.round(bossY)
  let placed = 0
  let offsetCursor = 0
  for (; offsetCursor < offsets.length && placed < count; offsetCursor++) {
    const [dx, dy] = offsets[offsetCursor]!
    const x = bossCenterX + dx
    const y = bossCenterY + dy
    if (!isWalkable(x, y)) continue
    const minionId = minionIds[this.rng.rand(minionIds.length)]!
    const minionKind = kinds.get(minionId)
    if (!minionKind) {
      throw new Error(`SuperUnique ${su.id}: minion '${minionId}' is not a MonStats.txt Id`)
    }
    ids.push(
      this.spawnMonster({
        classId: minionKind.hcIdx,
        areaId,
        x,
        y,
        rank: 'minion',
        monUMods: minionUMods,
        areaLevel,
      }),
    )
    placed++
  }
  // D2Game.dll 0x6FC456CB -> sub_6FD0DE90(pGame, pRoom, x, y, 381, 1, 5, 0):
  // Wave 2 (SuperUnique 62, Achmel the Cursed / Baal Subject 2) spawns a hardcoded extra pack
  // of 10 Burning Dead Mages (skmage_cold3, hcIdx = 381).
  if (extraColdMageCount > 0) {
    let extraPlaced = 0
    for (; offsetCursor < offsets.length && extraPlaced < extraColdMageCount; offsetCursor++) {
      const [dx, dy] = offsets[offsetCursor]!
      const x = bossCenterX + dx
      const y = bossCenterY + dy
      if (!isWalkable(x, y)) continue
      ids.push(
        this.spawnMonster({
          classId: 381,
          areaId,
          x,
          y,
          rank: 'minion',
          monUMods: minionUMods,
          areaLevel,
        }),
      )
      extraPlaced++
    }
  }
  if (ids[0] !== undefined) {
    this.spawnedSuperUniquePackIds.set(ids[0], {
      superUniqueIndex: spec.superUniqueIndex,
      areaId,
      x: bossX,
      y: bossY,
      allUnitIds: [...ids],
    })
  }
  return ids
}

export interface WorldSpawningAndAoiMethods {
  spawnMonster(spec: SpawnMonsterSpec): number
  spawnTentacleCompanionLimbs(head: InternalMonsterRecord, startSurfaced?: boolean): void
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
  computeGroundItemTtlFrames113c(entry: ServerItemEntry): number
  registerGroundItem113c(entry: ServerItemEntry): void
  getQuestEligiblePartyRecipients113c(actor: InternalPlayerRecord | undefined, questAreaId: number, options?: {
    readonly includeSameActTown?: boolean
    readonly requireExactArea?: boolean
    readonly excludeDead?: boolean
    readonly minCharLevel?: number
  }): InternalPlayerRecord[]
  getGroundItems(): readonly ServerItemEntry[]
  findMercOrPetRecord(unitId: number): | { readonly kind: 'merc'; readonly merc: InternalMercenaryRecord }
  | {
      readonly kind: 'pet'
      readonly ownerId: number
      readonly areaId: number
      readonly classId: number
      readonly name: string
      readonly x: number
      readonly y: number
      readonly hp: number
      readonly maxHp: number
    }
  | undefined
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
  streamWildernessRoomsForPlayer(player: InternalPlayerRecord): void
  activatePresetRoomsNearPlayer113c(player: InternalPlayerRecord): void
  getSojSoldCount(): number
  isWorldEventTriggered(): boolean
  isDiabloCloneSpawned(): boolean
  isEligibleWorldEventSuperUnique113c(superUniqueIndex: number, areaId: number): boolean
  spawnDiabloCloneAt113c(areaId: number, x: number, y: number): number
  maybeReplacePreloadedRoomSuperUniqueWithDiabloClone113c(areaId: number, rx: number, ry: number, rw: number, rh: number): void
  spawnSuperUnique(spec: {
  readonly superUniqueIndex: number
  readonly x: number
  readonly y: number
  readonly areaId?: number | undefined
}): number[]
}

export const worldSpawningAndAoiMethods: Record<keyof WorldSpawningAndAoiMethods, unknown> = {
  spawnMonster,
  spawnTentacleCompanionLimbs,
  spawnObject,
  spawnGroundItem,
  computeGroundItemTtlFrames113c,
  registerGroundItem113c,
  getQuestEligiblePartyRecipients113c,
  getGroundItems,
  findMercOrPetRecord,
  lookupWorldUnitArea,
  hasLiveWorldEntity,
  getAoiWorldEntities,
  buildEntityEnterAoiEvents,
  enqueueCommand,
  streamWildernessRoomsForPlayer,
  activatePresetRoomsNearPlayer113c,
  getSojSoldCount,
  isWorldEventTriggered,
  isDiabloCloneSpawned,
  isEligibleWorldEventSuperUnique113c,
  spawnDiabloCloneAt113c,
  maybeReplacePreloadedRoomSuperUniqueWithDiabloClone113c,
  spawnSuperUnique,
}
