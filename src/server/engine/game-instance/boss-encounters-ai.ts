/**
 * GameInstance Subsystem: Monster Skill/Utility Casting & Diablo, Baal, Uber Tristram and Ancients Boss AI (`src/server/engine/game-instance/boss-encounters-ai.ts`).
 */

import { compute5BandScaling } from '../../../common/data/calc-ast.ts'
import type { MissileRecord, SkillRecord } from '../../../common/data/data-registry.ts'
import { getEmbeddedDropTables } from '../../../common/items/embedded-drop-tables.ts'
import { PANDEMONIUM_FINALE_AREA_ID_113C, UBER_PRIME_EVIL_SET_113C, UBER_PRIME_MINION_SPECS_113C, computeUberPrimeMinionCap113c, createPandemoniumFinaleDrops113c } from '../../world/pandemonium-113c.ts'
import { MONSTATS_113C_ROWS } from '../../../common/units/monstats-113c-data.ts'
import { getMonsterKindByHcIdx, resolveMonsterStats } from '../../../common/units/monsters-data.ts'
import { isBaalTentacleHcIdx113c, isBonePrisonMonsterHcIdx113c, monaiParam113c, normalizeMonAiName113c } from '../../../common/units/monai-113c.ts'
import { MON_UMOD } from '../../../common/units/monster-death-fx.ts'
import type { MonsterSkillEntry } from '../../../common/units/unit-types.ts'
import { getLevelMonsterPlan113c } from '../../../common/world/level-monster-plans.ts'
import type { ServerEvent } from '../../../netproto/index.ts'
import type { SummonedPetUnit } from '../../ai/summon-manager.ts'
import {
  computeMonsterInfernoChannelParams113c,
  computeMonsterInfernoMissileRange113c,
  evaluateMonsterMissileDamage113c,
  resolveMonsterMonStatsSkillSlvl113c,
  resolveMonsterRegisteredSkillSlvl113c,
} from '../../ai/monster-missile-damage-113c.ts'
import { FIXED_ONE, UnitStatList } from '../stat-list.ts'
import { STATE_SLOWMISSILES_113C } from '../../skills/p1-wave4-skills-113c.ts'
import { evaluateSkill113c } from '../../skills/registry.ts'
import type { GameInstanceHost } from './host.ts'
import type { InternalMercenaryRecord, InternalMissileRecord, InternalMonsterRecord, InternalPlayerRecord, MissileDamageChannel } from './types.ts'
import { monsterProfile113c, normalizeMissileElement, playerWirePosition, UNIT_TYPE_113C } from './constants-and-helpers.ts'
import { rollMonsterInitStats113c } from './unit-seeds-113c.ts'


/**
 * Cast one of MonStats `Skill1..8` when it is ready and in range. Projectile
 * skills are evaluated through the same `evaluateSkill113c` registry as player
 * casts; their `srvmissile`/`srvmissilea` row and `Missiles.txt` EType decide
 * the launch and damage channel. Non-projectile utility skills (resurrection,
 * curses, summons) keep their dedicated handlers.
 */
function tryCastMonsterSkill(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  target: { readonly x: number; readonly y: number },
  distance: number,
  options?: {
    readonly hitMonsters?: boolean | undefined
    readonly forcedSkillId?: number | undefined
  },
): boolean {
  if (monster.skillCooldown > 0 || monster.skills.length === 0) return false
  const profile = monsterProfile113c(monster.ai)
  const forcedSkillId = options?.forcedSkillId
  const aiKey = normalizeMonAiName113c(monster.ai)
  // 1.13c `AITHINK_Fn025_WillOWisp` (`0x6FCA0F20..0x6FCA1C6F`, #2012):
  // Never calls `CastSkill` (`Skill1 = #53 Chain Lightning` is unused by WillOWisp AI);
  // ranged lightning attacks strictly use `MissC` (`#320` / `#666`).
  if (forcedSkillId === undefined && aiKey === 'willowisp') return false
  // Healers with `profile.healRangeParam !== undefined` (`HighPriest`, `ZakarumPriest`, `GreaterMummy`,
  // `OblivionKnight`) already evaluate `#179 ZakarumHeal` / `#182 Bestow` once per `aidel` think tick in
  // `stepMonsterAi` (`monster-combat-ai.ts`) when `bInMeleeRange == 0` (`D2Game.dll` `0x6FC390BB`, #2001).
  // Only `Overseer` (`profile.whip === true`, `0x6FC37CB0`) evaluates `#295` / `#291` inside `tryCastMonsterSkill`.
  if (forcedSkillId === undefined && options?.hitMonsters !== true && profile.whip === true) {
    if (this.tryCastMonsterUtilitySkill(monster, target, distance, true)) {
      return true
    }
  }
  const difficulty = this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0
  const ordered = [...monster.skills].sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))

  // 1.13c Succubus / SuccubusWitch (`#309 Defense Curse` when `maxMana < maxHp`, `#310 Blood Mana` when
  // `maxMana >= maxHp`) & explicit `Skill1..8` monster curses (`#66`, `#72`, `#87`, #1822):
  if (forcedSkillId === undefined && options?.hitMonsters !== true && distance <= 25) {
    const hasSuccubusCurse = ordered.some((e) => e.skillId === 309 || e.skillId === 310)
    const explicitCurseEntry = ordered.find(
      (e) => e.skillId === 66 || e.skillId === 72 || e.skillId === 87,
    )
    if (hasSuccubusCurse || explicitCurseEntry !== undefined) {
      let targetPlayer: InternalPlayerRecord | undefined
      let bestPDist = 3
      for (const p of this.players.values()) {
        if (p.dead || p.areaId !== monster.areaId) continue
        const d = Math.hypot(p.x - target.x, p.y - target.y)
        if (d <= bestPDist) {
          bestPDist = d
          targetPlayer = p
        }
      }
      if (hasSuccubusCurse && targetPlayer !== undefined) {
        const wantBloodMana =
          this.getPlayerAccruedMaxManaFixed(targetPlayer) >=
          this.getPlayerAccruedMaxHpFixed(targetPlayer)
        const desiredSkillId = wantBloodMana ? 310 : 309
        const desiredStateId = wantBloodMana ? 114 : 113
        const curseEntry =
          ordered.find((e) => e.skillId === desiredSkillId) ??
          ordered.find((e) => e.skillId === 309 || e.skillId === 310)
        const castChance = Math.max(25, Math.min(100, monster.aiParams[1] || 50))
        if (
          curseEntry?.skillId !== undefined &&
          !targetPlayer.states.has(desiredStateId) &&
          this.rng.rand(100) < castChance
        ) {
          this.applyMonsterCurseToTarget113c(
            monster,
            { kind: 'player', player: targetPlayer },
            curseEntry.skillId,
            Math.max(1, curseEntry.level),
          )
          const curseMode = this.monsterSkillMode(curseEntry.mode)
          monster.mode = curseMode
          this.broadcastToArea(monster.areaId, {
            type: 'UnitMode',
            unitType: 1,
            id: monster.unitId,
            mode: curseMode,
            at: { x: Math.round(targetPlayer.x), y: Math.round(targetPlayer.y) },
            lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
          })
          monster.skillCooldown = Math.max(40, monster.cooldownTicks * 2)
          monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
          return true
        }
      } else if (explicitCurseEntry?.skillId !== undefined && targetPlayer !== undefined) {
        const stateMap: Record<number, number> = { 66: 9, 72: 19, 87: 60 }
        const wantState = stateMap[explicitCurseEntry.skillId] ?? 9
        if (!targetPlayer.states.has(wantState) && this.rng.rand(100) < 40) {
          this.applyMonsterCurseToTarget113c(
            monster,
            { kind: 'player', player: targetPlayer },
            explicitCurseEntry.skillId,
            Math.max(1, explicitCurseEntry.level),
          )
          const curseMode = this.monsterSkillMode(explicitCurseEntry.mode)
          monster.mode = curseMode
          this.broadcastToArea(monster.areaId, {
            type: 'UnitMode',
            unitType: 1,
            id: monster.unitId,
            mode: curseMode,
            at: { x: Math.round(targetPlayer.x), y: Math.round(targetPlayer.y) },
            lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
          })
          monster.skillCooldown = Math.max(40, monster.cooldownTicks * 2)
          monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
          return true
        }
      }
    }
  }
  if (
    forcedSkillId === undefined &&
    this.tryCastMonsterCombatOrSummonSkill113c(
      monster,
      target,
      distance,
      options?.hitMonsters === true,
    )
  ) {
    return true
  }
  const candidates: {
    readonly entry: MonsterSkillEntry
    readonly skill: SkillRecord
    readonly missileRec: MissileRecord
  }[] = []
  for (const entry of ordered) {
    if (entry.skillId === undefined) continue
    if (forcedSkillId !== undefined && entry.skillId !== forcedSkillId) continue
    // Resurrection (181/327/158) is executed by the shaman/undead handler with
    // its own corpse/race rules, not as a projectile.
    if (entry.skillId === 181 || entry.skillId === 327 || entry.skillId === 158) continue
    const skill = this.registry.getSkillById(entry.skillId)
    if (skill === undefined) continue
    if (skill.summon !== '' || skill.petType !== '') continue
    if (/heal|vortex|aura|teleport|armor|bestow/i.test(skill.name)) continue
    const missileName =
      skill.srvMissile !== ''
        ? skill.srvMissile
        : skill.srvMissileA !== ''
          ? skill.srvMissileA
          : ''
    if (missileName === '') continue
    const missileRec = this.registry.getMissileByName(missileName)
    if (missileRec === undefined) continue
    candidates.push({ entry, skill, missileRec })
  }
  if (candidates.length === 0) {
    return forcedSkillId === undefined
      ? this.tryCastMonsterUtilitySkill(monster, target, distance)
      : false
  }
  const chosen = candidates[monster.skillCursor % candidates.length]!
  const { entry, skill, missileRec } = chosen
  const diffIdx: 0 | 1 | 2 = this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0
  const skillLevel = Math.max(1, resolveMonsterRegisteredSkillSlvl113c(entry.level, diffIdx) || entry.level)
  const rangeFrames =
    skill.srvDoFunc === 95
      ? computeMonsterInfernoMissileRange113c(this.registry, skill, missileRec, skillLevel)
      : Math.max(2, missileRec.range + missileRec.levRange * skillLevel)
  // `SKILLS_SrvDo024_FireWall` (`0x6FC637D0`, #1999), `SKILLS_SrvDo028` (`0x6FC62D90`, #2007),
  // & `SKILLS_SetInfernoMissileRange` / `SrvDo095` (`0x6FCD32E0` / `0x6FCD6A60`, #2012):
  // Target-placed wall / sky-fall controller rows store lateral half-width or sky-fall countdown frames,
  // while `SrvDo095` flame/arctic jets travel exact `(vel / 16) * rangeFrames` sub-tiles (`7.5..11.25`).
  const missileReach =
    skill.srvDoFunc === 24
      ? 25
      : skill.srvDoFunc === 28
        ? 35
        : skill.srvDoFunc === 95
          ? missileRec.vel > 0
            ? (missileRec.vel / 16) * rangeFrames
            : rangeFrames
          : missileRec.vel > 0
            ? Math.max(rangeFrames, (missileRec.vel / 16) * rangeFrames)
            : rangeFrames
  if (distance > Math.min(35, Math.max(4, missileReach))) return false
  // 1.13c per-AI cast probability gates (#2012):
  // - `AITHINK_Fn089_Megademon` (`0x6FC38CE0`): rolls `aip1` (`50..90%`) at range (`> 2.5`) or `aip2` (`40..65%`) in melee (`<= 2.5`).
  // - `AITHINK_Fn124_FrozenHorror` (`0x6FC379A0`): requires `!STATE_INFERNO (12)` and rolls `aip3` (`60..80%`).
  // - Generic melee-range monsters alternate between their skill and A1 (`forcedSkillId` callers already ran their gate, #2007).
  if (forcedSkillId === undefined) {
    if (aiKey === 'megademon') {
      if (monster.aiParams.length > 0) {
        const castChance = monaiParam113c(profile, monster.aiParams, distance <= 2.5 ? 1 : 0, 100)
        if (this.rng.rand(100) >= castChance) return false
      }
    } else if (aiKey === 'frozenhorror') {
      if (monster.states.has(12)) return false
      if (monster.aiParams.length > 0) {
        const castChance = monaiParam113c(profile, monster.aiParams, 2, 100)
        if (this.rng.rand(100) >= castChance) return false
      }
    } else if (distance <= 2.5 && this.rng.rand(2) !== 0) {
      return false
    }
    monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, candidates.length)
  }
  const statList = new UnitStatList(this.registry)
  statList.setBaseStat('level', monster.level)
  statList.setBaseStat('tohit', monster.ar)
  statList.setBaseStat('armorclass', monster.ac)
  statList.setBaseStat('maxhp', monster.maxHp * FIXED_ONE)
  statList.setHp256(monster.hp * FIXED_ONE)
  statList.setBaseStat('strength', 0)
  statList.setBaseStat('dexterity', 0)
  statList.setBaseStat('vitality', 0)
  statList.setBaseStat('energy', 0)
  statList.setBaseSkillLevel(entry.skillId!, skillLevel)
  const evalResult = evaluateSkill113c({
    registry: this.registry,
    skill,
    slvl: skillLevel,
    blvl: skillLevel,
    statList,
    difficulty,
  })
  let phys = this.rollInclusive(evalResult.minPhysDmg, evalResult.maxPhysDmg)
  let elem = this.rollInclusive(evalResult.minElemDmg, evalResult.maxElemDmg)
  let elemDurationFrames = evalResult.durationFrames
  let element: MissileDamageChannel =
    normalizeMissileElement(missileRec.eType) ??
    normalizeMissileElement(skill.eType) ??
    'phys'
  if (phys + elem <= 0) {
    const mslEval = evaluateMonsterMissileDamage113c({
      registry: this.registry,
      missile: missileRec,
      slvl: skillLevel,
      difficulty,
      monsterMinPhys: monster.minDmg,
      monsterMaxPhys: monster.maxDmg,
      attackMode: 'S1',
      elementalAttacks: monster.elementalAttacks,
      extraFirePct: monster.monProps.extraFirePct,
      rng: this.rng,
    })
    if (mslEval.totalDamage > 0) {
      phys = mslEval.physDamage
      elem = mslEval.elemDamage
      element = mslEval.element
      if (elemDurationFrames <= 0 && mslEval.elemDurationFrames > 0) {
        elemDurationFrames = mslEval.elemDurationFrames
      }
    }
  }
  const engine = this.onlineMissileEngine()
  const doKind = engine.classifyOnlineSrvDo113c(missileRec)
  const hitKind = engine.classifyOnlineSrvHit113c(missileRec)
  const isGroundFire = doKind === 'groundfire' || missileRec.pSrvDmgFunc === 3
  const isFunctionalCarrier =
    doKind === 'pathspawner' ||
    doKind === 'areaspawner' ||
    doKind === 'orb' ||
    (hitKind !== 'none' && hitKind !== 'engine-only' && hitKind !== 'homing')
  if (phys + elem <= 0 && !isGroundFire && !isFunctionalCarrier) {
    phys = this.rollInclusive(monster.minDmg, monster.maxDmg)
  }
  if (element !== 'phys' && missileRec.srcDamage <= 0) {
    elem += phys
    phys = 0
  }
  if (element === 'fire' && monster.monProps.extraFirePct > 0 && evalResult.maxElemDmg > 0) {
    elem = Math.max(1, Math.floor((elem * (100 + monster.monProps.extraFirePct)) / 100))
  }
  if (element === 'pois' && elem > 0 && elemDurationFrames <= 0) {
    elemDurationFrames = 50
  }
  const mode = this.monsterSkillMode(entry.mode)
  monster.mode = mode
  this.broadcastToArea(monster.areaId, {
    type: 'UnitMode',
    unitType: 1,
    id: monster.unitId,
    mode,
    at: { x: Math.round(target.x), y: Math.round(target.y) },
    lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
  })
  // 1.13c `D2Game.dll` `SKILLS_SrvDo024_FireWall` (`0x6FC637D0..0x6FC63983`, #1999):
  // Spawns two `srvmissilea` makers from `(Xt, Yt)` perpendicular to `(Xc - Xt, Yc - Yt)` plus
  // one stationary `srvmissileb` ground-fire patch at `(Xt, Yt)` (`#51`, `#170`, `#188`, `#321`).
  if (skill.srvDoFunc === 24) {
    let dX = monster.x - target.x
    let dY = monster.y - target.y
    if (dX === 0 && dY === 0) dX = 1
    const groundFire256 =
      evalResult.maxElemDmg256 > 0
        ? { min: evalResult.minElemDmg256, max: evalResult.maxElemDmg256 }
        : undefined
    const commonOpts = {
      skillLevel,
      physDamage: 0,
      elemDamage: 0,
      element: 'fire' as const,
      fromX: target.x,
      fromY: target.y,
      ...(groundFire256 !== undefined ? { groundFire256 } : {}),
      ...(options?.hitMonsters === true ? { hitMonsters: true } : {}),
      skipMultishot: true,
    }
    this.spawnMonsterMissile(monster, target.x - dY, target.y + dX, 0, missileRec.id, skill.id, {
      ...commonOpts,
      missile: missileRec,
    })
    this.spawnMonsterMissile(monster, target.x + dY, target.y - dX, 0, missileRec.id, skill.id, {
      ...commonOpts,
      missile: missileRec,
    })
    const pillarName = skill.srvMissileB.trim()
    const pillarRow = pillarName !== '' ? this.registry.getMissileByName(pillarName) : undefined
    if (pillarRow !== undefined) {
      this.spawnMonsterMissile(monster, target.x, target.y, 0, pillarRow.id, skill.id, {
        ...commonOpts,
        missile: pillarRow,
      })
    }
  } else if (skill.srvDoFunc === 22) {
    // 1.13c `D2Game.dll` `SKILLS_SrvDo022_NovaAttack` (`0x6FC63AA0` -> `SKILLS_SpawnNovaRing` `0x6FCC2800`, #2006):
    // Spawns radial `srvMissile`/`srvMissileA` bolts (`nextHit=1, nextDelay=4`) around `(monster.x, monster.y)`
    // (`#250 summoner` `#44 Frost Nova`, `#369 trap-nova` `#353 Trap Nova`, etc.) with single-hit `STATE_JUSTHIT` gating.
    const reach = Math.max(8, missileReach)
    for (let i = 0; i < 16; i++) {
      const theta = (i / 16) * Math.PI * 2
      this.spawnMonsterMissile(
        monster,
        monster.x + Math.cos(theta) * reach,
        monster.y + Math.sin(theta) * reach,
        phys + elem,
        missileRec.id,
        skill.id,
        {
          missile: missileRec,
          skillLevel,
          physDamage: phys,
          elemDamage: elem,
          element,
          skipMultishot: true,
          ...(elemDurationFrames > 0 ? { elemDurationFrames } : {}),
          ...(options?.hitMonsters === true ? { hitMonsters: true } : {}),
        },
      )
    }
  } else if (skill.srvDoFunc === 28) {
    // 1.13c `D2Game.dll` `SKILLS_SrvDo028` (`0x6FC62D90..0x6FC62EA8`, #2007):
    // Spawns `wSrvMissileA` directly at `(target.x, target.y)` without `MonUMod #29` (`Multishot`) fan duplication.
    this.spawnMonsterMissile(monster, target.x, target.y, phys + elem, missileRec.id, skill.id, {
      missile: missileRec,
      skillLevel,
      physDamage: phys,
      elemDamage: elem,
      element,
      fromX: target.x,
      fromY: target.y,
      skipMultishot: true,
      ...(elemDurationFrames > 0 ? { elemDurationFrames } : {}),
      ...(options?.hitMonsters === true ? { hitMonsters: true } : {}),
    })
  } else if (skill.srvDoFunc === 95) {
    // 1.13c `D2Game.dll` `SKILLS_SrvSt53_MonsterInferno` (`0x6FCD65E0`) &
    // `SKILLS_SrvDo095_MonsterInferno` (`0x6FCD6A60`, #2012):
    // Applies `STATE_INFERNO (12)` for `calc2` (`param1 = 15` or `20` frames) and spawns 1 `srvMissileA`
    // jet (`rangeFrames = SKILLS_SetInfernoMissileRange`, `skipMultishot: true`) every `calc3` (`2` or `3`) frames.
    const { durationFrames, stepFrames } = computeMonsterInfernoChannelParams113c(
      this.registry,
      skill,
      skillLevel,
    )
    this.applyMonsterState(monster.unitId, 12, durationFrames)
    const ang = Math.atan2(target.y - monster.y, target.x - monster.x)
    const jetDist = Math.max(4, missileReach)
    this.spawnMonsterMissile(
      monster,
      monster.x + Math.cos(ang) * jetDist,
      monster.y + Math.sin(ang) * jetDist,
      phys + elem,
      missileRec.id,
      skill.id,
      {
        missile: missileRec,
        skillLevel,
        rangeFrames,
        physDamage: phys,
        elemDamage: elem,
        element,
        skipMultishot: true,
        ...(elemDurationFrames > 0 ? { elemDurationFrames } : {}),
        ...(options?.hitMonsters === true ? { hitMonsters: true } : {}),
      },
    )
    monster.cooldown = Math.max(monster.cooldown, durationFrames)
    if (durationFrames > 1) {
      monster.activeBossChannel = {
        kind: 'monsterinferno',
        skillId: skill.id,
        slvl: skillLevel,
        remainingFrames: durationFrames - 1,
        elapsedFrames: 0,
        angle: ang,
        targetX: target.x,
        targetY: target.y,
        startOffset: 0,
        missileId: missileRec.id,
        rangeFrames,
        stepFrames,
        physDamage: phys,
        elemDamage: elem,
        element,
        ...(elemDurationFrames > 0 ? { elemDurationFrames } : {}),
        ...(options?.hitMonsters === true ? { hitMonsters: true } : {}),
        nextHitFrames: new Map(),
      }
    }
  } else if (skill.srvDoFunc === 148) {
    // 1.13c `D2Game.dll` `MONMODE_ChangeAnimMode` (`0x6FC3F573..0x6FC3F5BE`) &
    // `SKILLS_SrvDo148` (`0x6FCD4C20..0x6FCD4D25`, `#335 DoomKnightMissile`, #2017):
    // `doomknight2` (`311`) and `doomknight3` (`312`, plus `701/702/713`) roll `S3v = pos,fir,col,unh` (`0..3`)
    // into `pMonsterData->byte_0E`, and `SKILLS_SrvDo148` spawns `wSrvMissileA + byte_0E`:
    // `#323 undeadmissile1` (Poison), `#324 undeadmissile2` (Fire), `#325 undeadmissile3` (Cold), `#326 undeadmissile4` (Unholy/Phys).
    const variantIdx = this.rng.rand(4)
    const variantRec = this.registry.getMissileById(missileRec.id + variantIdx) ?? missileRec
    const varEval = evaluateMonsterMissileDamage113c({
      registry: this.registry,
      missile: variantRec,
      slvl: skillLevel,
      difficulty,
      monsterMinPhys: monster.minDmg,
      monsterMaxPhys: monster.maxDmg,
      attackMode: 'S1',
      elementalAttacks: monster.elementalAttacks,
      extraFirePct: monster.monProps.extraFirePct,
      rng: this.rng,
    })
    let varPhys = varEval.physDamage
    let varElem = varEval.elemDamage
    const varElement: MissileDamageChannel = varEval.element
    let varDur = varEval.elemDurationFrames
    if (varPhys + varElem <= 0) {
      varPhys = this.rollInclusive(monster.minDmg, monster.maxDmg)
    }
    if (varElement !== 'phys' && variantRec.srcDamage <= 0) {
      varElem += varPhys
      varPhys = 0
    }
    if (varElement === 'pois' && varElem > 0 && varDur <= 0) {
      varDur = 50
    }
    this.spawnMonsterMissile(
      monster,
      target.x,
      target.y,
      varPhys + varElem,
      variantRec.id,
      skill.id,
      {
        missile: variantRec,
        skillLevel,
        physDamage: varPhys,
        elemDamage: varElem,
        element: varElement,
        ...(varDur > 0 ? { elemDurationFrames: varDur } : {}),
        ...(options?.hitMonsters === true ? { hitMonsters: true } : {}),
      },
    )
  } else {
    this.spawnMonsterMissile(monster, target.x, target.y, phys + elem, missileRec.id, skill.id, {
      missile: missileRec,
      skillLevel,
      physDamage: phys,
      elemDamage: elem,
      element,
      ...(elemDurationFrames > 0 ? { elemDurationFrames } : {}),
      ...(options?.hitMonsters === true ? { hitMonsters: true } : {}),
    })
  }
  const delay = Number.parseInt(skill.delay, 10)
  const megademonCooldown =
    aiKey === 'megademon' && monster.aiParams.length > 0
      ? monaiParam113c(profile, monster.aiParams, 5, 0)
      : 0
  const rawCooldown =
    megademonCooldown > 0
      ? megademonCooldown
      : Number.isFinite(delay) && delay > 0
        ? delay
        : Math.max(25, monster.cooldownTicks * 2)
  monster.skillCooldown =
    monster.monProps.fcrPct > 0
      ? Math.max(5, Math.floor((rawCooldown * 100) / (100 + monster.monProps.fcrPct)))
      : rawCooldown
  return true
}



/**
 * Non-projectile `Skill1..8` (`#179 ZakarumHeal`, `#182 Bestow`, `MonTeleport`, `MonBoneArmor`,
 * `FetishAura`, `#295 Overseer Whip`): heal, blink or apply the skill's self/ally state.
 */
function tryCastMonsterUtilitySkill(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  target: { readonly x: number; readonly y: number },
  distance: number,
  healOrWhipOnly = false,
): boolean {
  // Heal slots (`#179 ZakarumHeal`, `#182 Bestow`, `#1896`, `#1990`, `#2001`):
  // - `D2Game.dll` `SKILLS_SrvDo096_ZakarumHeal_Bestow` (`0x6FCD3770..0x6FCD3887`):
  //   - `0x6FCD37B9` (`cmp ebp, edi; je 0x6fcd37c1`) strictly forbids `pTarget == pCaster` (never self-heal).
  //   - `#179 ZakarumHeal` heals `15 + 5 * slvl .. 50`% of target `maxHp`; `HighPriest` (`0x6FC3920B`) uses `aip3` cooldown and `50` scan range (`0x9c4`).
  // - `0x6FC35660..0x6FC356B9`: requires combatant ally (`isKillable`, non-turret/construct) and per-AI `D2Common.#11027` HP% threshold
  //   (`HighPriest` `< 75%` per `0x6FC391D5`/`0x6FC356AB`, `ZakarumPriest` `<= 60%`, `OblivionKnight` `< 40%`, `GreaterMummy` `< 100%` Undead).
  // - Dedicated healer AIs (`profile.healRangeParam !== undefined`) must ONLY evaluate `#179/#182` when `healOrWhipOnly === true`
  //   (from `stepMonsterAi`'s `bInMeleeRange == 0` + `aip` gate), never as a 100%-probability fallback when `candidates.length === 0` (#2001).
  const casterProfile = monsterProfile113c(monster.ai)
  const healEntry =
    healOrWhipOnly || casterProfile.healRangeParam === undefined
      ? monster.skills.find((entry) => {
          if (entry.skillId === undefined) return false
          if (entry.skillId === 179 || entry.skillId === 182) return true
          const skill = this.registry.getSkillById(entry.skillId)
          return skill !== undefined && /(?:^|\b)(?:zakarumheal|monheal|bestow)\b/i.test(skill.name)
        })
      : undefined
  if (healEntry?.skillId !== undefined) {
    const healSkill = this.registry.getSkillById(healEntry.skillId)
    const baseRange = monaiParam113c(casterProfile, monster.aiParams, casterProfile.healRangeParam, 12)
    const healRange =
      monster.ai === 'HighPriest'
        ? Math.max(50, baseRange)
        : monster.ai === 'GreaterMummy'
          ? Math.max(12, baseRange) + (monster.hcIdx === 229 ? 10 : 0)
          : Math.max(12, baseRange)
    let healTarget: InternalMonsterRecord | undefined
    let lowestPct = 101
    for (const ally of this.monsters.values()) {
      if (
        ally.dead ||
        ally.isNpc ||
        ally.align !== monster.align ||
        !ally.isKillable ||
        this.isMonsterConverted(ally) ||
        (ally.hcIdx >= 351 && ally.hcIdx <= 353) ||
        isBonePrisonMonsterHcIdx113c(ally.hcIdx) ||
        isBaalTentacleHcIdx113c(ally.hcIdx) ||
        ally.states.has(52) ||
        ally.unitId === monster.unitId ||
        ally.areaId !== monster.areaId ||
        ally.maxHp <= 0 ||
        ally.hp >= ally.maxHp ||
        Math.hypot(ally.x - monster.x, ally.y - monster.y) > healRange
      ) {
        continue
      }
      if (monster.ai === 'GreaterMummy') {
        if (!ally.isUndead) continue
        if (monster.hcIdx !== 229 && ally.rank === 'unique') continue
      }
      const allyHpPct = Math.trunc((ally.hp * 100) / ally.maxHp)
      const passesHpGate =
        monster.ai === 'HighPriest'
          ? allyHpPct < 75
          : monster.ai === 'ZakarumPriest'
            ? allyHpPct <= 60
            : monster.ai === 'OblivionKnight'
              ? allyHpPct < 40
              : true
      if (!passesHpGate) continue
      if (allyHpPct < lowestPct) {
        lowestPct = allyHpPct
        healTarget = ally
      }
    }
    if (healTarget !== undefined) {
      const diffIdx: 0 | 1 | 2 = this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0
      const slvl = Math.max(1, resolveMonsterRegisteredSkillSlvl113c(healEntry.level, diffIdx) || healEntry.level)
      const healPct =
        healEntry.skillId === 179
          ? this.rollInclusive(Math.min(50, 15 + 5 * slvl), 50)
          : this.rollInclusive(15, 25)
      const heal = Math.max(1, Math.trunc((healTarget.maxHp * healPct) / 100))
      const nextHp = Math.min(healTarget.maxHp, healTarget.hp + heal)
      if (nextHp > healTarget.hp) {
        healTarget.hp = nextHp
        this.monsterCombat.get(healTarget.unitId)?.statList.setHp256(healTarget.hp * FIXED_ONE)
        const healMode = this.monsterSkillMode(healEntry.mode)
        monster.mode = healMode
        const atPt = { x: Math.round(healTarget.x), y: Math.round(healTarget.y) }
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: monster.unitId,
          mode: healMode,
          at: atPt,
          lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
        })
        this.broadcastToArea(monster.areaId, {
          type: 'SkillCast',
          caster: { unitType: 1, id: monster.unitId },
          skill: healEntry.skillId,
          skillId: healEntry.skillId,
          level: slvl,
          target: { unitType: 1, id: healTarget.unitId },
          at: atPt,
        })
        this.broadcastToArea(healTarget.areaId, {
          type: 'UnitStatUpdate',
          unitType: 'monster',
          unitId: healTarget.unitId,
          statId: 6,
          value: healTarget.hp,
        })
        if (monster.ai === 'HighPriest') {
          // `D2Game.dll` `0x6FC391F2..0x6FC3920B` (#2004): `pAiControl->dwSpellTimer = dwGameFrame + aip3` (`125 / 100 / 75`).
          monster.skillCooldown = monster.aiParams[2] || 125
        } else {
          const healDelay =
            healSkill?.delay && healSkill.delay !== '0'
              ? healSkill.delay
              : String(Math.max(45, monster.cooldownTicks * 2))
          this.setMonsterSkillCooldown(monster, healDelay)
        }
        return true
      }
    }
  }
  const orderedUtilitySkills = [...monster.skills].sort((a, b) => {
    const rank = (id: number | undefined): number => (id === 295 ? 0 : id === 291 ? 1 : 2)
    return rank(a.skillId) - rank(b.skillId)
  })
  for (const entry of orderedUtilitySkills) {
    if (entry.skillId === undefined) continue
    if (
      entry.skillId === 181 ||
      entry.skillId === 327 ||
      entry.skillId === 183 ||
      entry.skillId === 190 ||
      entry.skillId === 158 ||
      entry.skillId === 60 ||
      entry.skillId === 62 ||
      entry.skillId === 167 ||
      entry.skillId === 210 ||
      entry.skillId === 302 ||
      entry.skillId === 330 ||
      (entry.skillId === 184 && (monster.hcIdx === 706 || monster.hcIdx === 256))
    ) {
      continue
    }
    const skill = this.registry.getSkillById(entry.skillId)
    const name = skill?.name.toLowerCase() ?? ''
    if (
      entry.skillId === 179 ||
      entry.skillId === 182 ||
      /(?:^|\b)(?:zakarumheal|monheal|bestow)\b/.test(name)
    ) {
      continue
    }
    if (entry.skillId === 291) {
      // Overseer `Healing Vortex` (`D2Game.dll` `AITHINK_Fn120_Overseer` `0x6FC37F60..0x6FC3802A` + `Missiles.txt #425`, #1990):
      // Scans injured allies (`!= self`, `!state 52`, HP <= 50%) within 20 subtiles (`aip2 = 50%` roll in AI think),
      // emits `SkillCast 291` (`S2`) + visual `CreateMissile 425`, and heals `10 + 5*(slvl-1) .. 20 + 5*(slvl-1)` HP.
      let vortexTarget: InternalMonsterRecord | undefined
      let bestPct = 0.500001
      for (const ally of this.monsters.values()) {
        if (
          ally.dead ||
          ally.isNpc ||
          ally.align !== monster.align ||
          !ally.isKillable ||
          this.isMonsterConverted(ally) ||
          (ally.hcIdx >= 351 && ally.hcIdx <= 353) ||
          isBonePrisonMonsterHcIdx113c(ally.hcIdx) ||
          isBaalTentacleHcIdx113c(ally.hcIdx) ||
          ally.states.has(52) ||
          ally.unitId === monster.unitId ||
          ally.areaId !== monster.areaId ||
          ally.maxHp <= 0 ||
          Math.hypot(ally.x - monster.x, ally.y - monster.y) > 20
        ) {
          continue
        }
        const pct = ally.hp / ally.maxHp
        if (pct <= 0.5 && pct < bestPct) {
          bestPct = pct
          vortexTarget = ally
        }
      }
      if (vortexTarget === undefined) continue
      if (healOrWhipOnly && this.rng.rand(100) >= (monster.aiParams[1] || 50)) {
        continue
      }
      const diffIdx: 0 | 1 | 2 = this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0
      const slvl = Math.max(1, resolveMonsterRegisteredSkillSlvl113c(entry.level, diffIdx) || entry.level)
      const vortexHeal = this.rollInclusive(10 + 5 * (slvl - 1), 20 + 5 * (slvl - 1))
      const nextHp = Math.min(vortexTarget.maxHp, vortexTarget.hp + vortexHeal)
      if (nextHp <= vortexTarget.hp) continue
      vortexTarget.hp = nextHp
      this.monsterCombat.get(vortexTarget.unitId)?.statList.setHp256(vortexTarget.hp * FIXED_ONE)
      const vortexMode = this.monsterSkillMode(entry.mode ?? 'S2')
      monster.mode = vortexMode
      const vortexPt = { x: Math.round(vortexTarget.x), y: Math.round(vortexTarget.y) }
      this.broadcastToArea(monster.areaId, {
        type: 'UnitMode',
        unitType: 1,
        id: monster.unitId,
        mode: vortexMode,
        at: vortexPt,
        lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
      })
      this.broadcastToArea(monster.areaId, {
        type: 'SkillCast',
        caster: { unitType: 1, id: monster.unitId },
        skill: 291,
        skillId: 291,
        level: slvl,
        target: { unitType: 1, id: vortexTarget.unitId },
        at: vortexPt,
      })
      const visualMissileId = this.allocateUnitId(UNIT_TYPE_113C.missile)
      this.broadcastToArea(monster.areaId, {
        type: 'CreateMissile',
        missileId: visualMissileId,
        missileClassId: 425,
        at: vortexPt,
        target: vortexPt,
        x: vortexPt.x,
        y: vortexPt.y,
        targetX: vortexPt.x,
        targetY: vortexPt.y,
        skillId: 291,
        level: slvl,
        ownerType: 1,
        ownerUnitType: 'monster',
        ownerId: monster.unitId,
        sourceUnitId: monster.unitId,
        areaId: monster.areaId,
      } as ServerEvent)
      this.broadcastToArea(vortexTarget.areaId, {
        type: 'UnitStatUpdate',
        unitType: 'monster',
        unitId: vortexTarget.unitId,
        statId: 6,
        value: vortexTarget.hp,
      })
      this.setMonsterSkillCooldown(
        monster,
        skill?.delay && skill.delay !== '0' ? skill.delay : '50',
      )
      return true
    }
    if (entry.skillId === 290 && !healOrWhipOnly) {
      // Overseer `Cry Help`: rally nearby un-rallied allies onto the current target.
      const nearest = this.players.values()
      let nearestPlayer: InternalPlayerRecord | undefined
      let nearestDist = Infinity
      for (const player of nearest) {
        if (player.dead || player.areaId !== monster.areaId) continue
        const dist = Math.hypot(player.x - monster.x, player.y - monster.y)
        if (dist < nearestDist) {
          nearestDist = dist
          nearestPlayer = player
        }
      }
      if (nearestPlayer === undefined) continue
      let rallied = 0
      for (const ally of this.monsters.values()) {
        if (
          ally.dead ||
          ally.isNpc ||
          ally.align !== monster.align ||
          !ally.isKillable ||
          this.isMonsterConverted(ally) ||
          (ally.hcIdx >= 351 && ally.hcIdx <= 353) ||
          isBonePrisonMonsterHcIdx113c(ally.hcIdx) ||
          isBaalTentacleHcIdx113c(ally.hcIdx) ||
          ally.unitId === monster.unitId ||
          ally.areaId !== monster.areaId ||
          ally.threatUntilFrame > this.currentFrame ||
          Math.hypot(ally.x - monster.x, ally.y - monster.y) > 20
        ) {
          continue
        }
        ally.threatPlayerId = nearestPlayer.unitId
        ally.threatUntilFrame = this.currentFrame + 150
        rallied++
      }
      if (rallied <= 0) continue
      const cryMode = this.monsterSkillMode(entry.mode)
      monster.mode = cryMode
      this.broadcastToArea(monster.areaId, {
        type: 'UnitMode',
        unitType: 1,
        id: monster.unitId,
        mode: cryMode,
        at: { x: Math.round(nearestPlayer.x), y: Math.round(nearestPlayer.y) },
        lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
      })
      this.setMonsterSkillCooldown(monster, skill?.delay ?? '50')
      return true
    }
    if (entry.skillId === 295) {
      // Overseer `Overseer Whip` (`D2Game.dll` `0x6fc2d9c0`, `srvdofunc=131`, `Param1=65`, #1824, #1894):
      // - Heals wounded ally by 25% `maxHp` (unless Prevent Monster Heal `state 52`),
      // - Buffs ally with `bloodlust` (state 140: +50% velocity & +50% attack rate, 250 frames),
      // - 35% chance on `minion1..8` (`hcIdx 453..460`): transforms in-place into `suicideminion1..8` (`461..468`)!
      let whipTarget: InternalMonsterRecord | undefined
      let bestWhipDist = 14
      for (const ally of this.monsters.values()) {
        if (
          ally.dead ||
          ally.isNpc ||
          ally.align !== monster.align ||
          !ally.isKillable ||
          this.isMonsterConverted(ally) ||
          (ally.hcIdx >= 351 && ally.hcIdx <= 353) ||
          isBonePrisonMonsterHcIdx113c(ally.hcIdx) ||
          isBaalTentacleHcIdx113c(ally.hcIdx) ||
          ally.unitId === monster.unitId ||
          ally.areaId !== monster.areaId
        ) {
          continue
        }
        const isTransformableMinion = ally.hcIdx >= 453 && ally.hcIdx <= 460
        if (!isTransformableMinion && ally.states.has(140) && ally.hp >= ally.maxHp) {
          continue
        }
        const d = Math.hypot(ally.x - monster.x, ally.y - monster.y)
        if (
          d <= bestWhipDist &&
          (whipTarget === undefined ||
            isTransformableMinion ||
            ally.monType === 'minion')
        ) {
          bestWhipDist = d
          whipTarget = ally
        }
      }
      if (whipTarget === undefined) continue
      if (!whipTarget.states.has(52) && whipTarget.hp < whipTarget.maxHp) {
        whipTarget.hp = Math.min(
          whipTarget.maxHp,
          whipTarget.hp + Math.max(4, Math.floor(whipTarget.maxHp * 0.25)),
        )
        this.monsterCombat.get(whipTarget.unitId)?.statList.setHp256(whipTarget.hp * FIXED_ONE)
        this.broadcastToArea(whipTarget.areaId, {
          type: 'UnitStatUpdate',
          unitType: 'monster',
          unitId: whipTarget.unitId,
          statId: 6,
          value: whipTarget.hp,
        })
      }
      this.applyMonsterState(whipTarget.unitId, 140, 250)
      if (whipTarget.hcIdx >= 453 && whipTarget.hcIdx <= 460 && this.rng.rand(100) < 35) {
        // D2Game.dll SrvDo131 (`0x6FC2D9C0 -> 0x6FC2D850`) -> MONSTER_MorphIntoClass (`0x6FCCFC50 -> 0x6FCD0320 -> 0x6FCCFDB0`, #2021):
        // Reinitialize the morphed `suicideminion1..8` (`hcIdx 461..468`) stats from `MonStats.txt[newHcIdx]` + `MonLvl.txt[mlvl]`
        // (`0x6FCD006C..0x6FCD0080` sets both `STAT_MAXHP` and `STAT_HITPOINTS` to `newMaxHp << 8`, `Velocity = 10, Run = 10`,
        // and `A1MinD/A1MaxD` from `L-DM * 100..150 / 100`, stripping any pre-morph boss-minion `2x` HP multiplier).
        const newHcIdx = whipTarget.hcIdx + 8
        const newDefId = `suicideminion${String(newHcIdx - 460)}`
        const diffName =
          this.difficulty === 2 ? 'hell' : this.difficulty === 1 ? 'nightmare' : 'normal'
        const newKind = getMonsterKindByHcIdx(newHcIdx, diffName)
        const effectiveAreaLevel = getLevelMonsterPlan113c(whipTarget.areaId, diffName)?.monsterLevel
        const resolvedMorph = newKind
          ? resolveMonsterStats(newKind, {
              difficulty: diffName,
              rank: 'normal',
              modifiers: [],
              playersCount: 1,
              ...(effectiveAreaLevel !== undefined ? { areaLevel: effectiveAreaLevel } : {}),
            })
          : undefined
        const unitSeed = this.unitSeeds.get(`${UNIT_TYPE_113C.monster}:${whipTarget.unitId}`)
        const noRatio = Boolean(newKind?.noRatio ?? false)
        const initRoll =
          unitSeed !== undefined && newKind !== undefined
            ? rollMonsterInitStats113c({
                kind: newKind,
                difficulty: this.difficulty,
                effectiveAreaLevel,
                isBoss: false,
                noRatio,
                isExpansion: true,
                unitSeed,
              })
            : undefined
        const newBaseMaxHp = Math.max(
          1,
          initRoll?.rolledHp ?? resolvedMorph?.maxHp ?? resolvedMorph?.hp ?? 50,
        )
        const px = this.playersX
        const newMaxHp = noRatio
          ? newBaseMaxHp
          : Math.max(1, Math.floor((newBaseMaxHp * (px + 1)) / 2))
        const morphBaseMinDmg = Math.max(
          1,
          resolvedMorph?.attack1?.minDamage ??
            resolvedMorph?.attack1?.min ??
            resolvedMorph?.damage ??
            20,
        )
        const morphBaseMaxDmg = Math.max(
          morphBaseMinDmg,
          resolvedMorph?.attack1?.maxDamage ??
            resolvedMorph?.attack1?.max ??
            resolvedMorph?.damage ??
            30,
        )
        const arDmgNum = noRatio ? 16 : 15 + px

        whipTarget.hcIdx = newHcIdx
        whipTarget.classId = newHcIdx
        whipTarget.defId = newDefId
        whipTarget.rank = 'normal'
        whipTarget.level = Math.max(
          1,
          initRoll?.level ?? resolvedMorph?.level ?? whipTarget.level,
        )
        whipTarget.baseMaxHp = newBaseMaxHp
        whipTarget.unscaledMaxHp = newBaseMaxHp
        whipTarget.maxHp = newMaxHp
        whipTarget.hp = newMaxHp
        whipTarget.baseMinDmg = morphBaseMinDmg
        whipTarget.baseMaxDmg = morphBaseMaxDmg
        whipTarget.minDmg = Math.max(1, Math.floor((morphBaseMinDmg * arDmgNum) / 16))
        whipTarget.maxDmg = Math.max(
          whipTarget.minDmg,
          Math.floor((morphBaseMaxDmg * arDmgNum) / 16),
        )
        whipTarget.ai = 'SuicideMinion'
        whipTarget.aiParams = newKind?.aiParams ?? [0, 0, 0, 0, 0, 0, 0, 0]
        whipTarget.aiDelay = Math.min(whipTarget.aiDelay, 5)
        whipTarget.cooldownTicks = Math.min(whipTarget.cooldownTicks, 5)
        whipTarget.velocity = Math.max(1, newKind?.velocity ?? 10)
        whipTarget.runSpeed = Math.max(whipTarget.velocity, newKind?.runVelocity ?? 10)
        const whipCombat = this.monsterCombat.get(whipTarget.unitId)
        if (whipCombat !== undefined) {
          whipCombat.statList.setBaseStat('maxhp', newMaxHp * FIXED_ONE)
          whipCombat.statList.setHp256(newMaxHp * FIXED_ONE)
        }
        if (!whipTarget.umodIds.includes(MON_UMOD.SUICIDEMINION)) {
          whipTarget.umodIds = [...whipTarget.umodIds, MON_UMOD.SUICIDEMINION]
        }
        this.applyMonsterState(whipTarget.unitId, 142, 2500)
        this.broadcastToArea(whipTarget.areaId, this.buildMonsterUnitAssignEvent(whipTarget))
        this.broadcastToArea(whipTarget.areaId, {
          type: 'UnitStatUpdate',
          unitType: 'monster',
          unitId: whipTarget.unitId,
          statId: 7,
          value: whipTarget.maxHp,
        })
        this.broadcastToArea(whipTarget.areaId, {
          type: 'UnitStatUpdate',
          unitType: 'monster',
          unitId: whipTarget.unitId,
          statId: 6,
          value: whipTarget.hp,
        })
      }
      monster.mode = 5
      const whipPt = { x: Math.round(whipTarget.x), y: Math.round(whipTarget.y) }
      this.broadcastToArea(monster.areaId, {
        type: 'UnitMode',
        unitType: 1,
        id: monster.unitId,
        mode: 5,
        at: whipPt,
        lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
      })
      this.broadcastToArea(monster.areaId, {
        type: 'SkillCast',
        caster: { unitType: 1, id: monster.unitId },
        skill: 295,
        skillId: 295,
        level: Math.max(1, entry.level),
        target: { unitType: 1, id: whipTarget.unitId },
        at: whipPt,
      })
      this.setMonsterSkillCooldown(monster, skill?.delay ?? '35')
      return true
    }
    if (healOrWhipOnly) {
      continue
    }
    if (entry.skillId === 54 || entry.skillId === 212 || /teleport/.test(name)) {
      const tx = monster.x + (target.x - monster.x) * 0.6
      const ty = monster.y + (target.y - monster.y) * 0.6
      if (
        this.isClosedDoorAt(monster.areaId, Math.round(tx), Math.round(ty)) ||
        (this.terrainWalkableCheck &&
          !this.terrainWalkableCheck(monster.areaId, Math.round(tx), Math.round(ty), monster.isFlying)) ||
        this.isMonsterCellOccupied(monster, tx, ty)
      ) {
        continue
      }
      const from = { x: Math.round(monster.x), y: Math.round(monster.y) }
      monster.x = tx
      monster.y = ty
      monster.path = []
      monster.pathIndex = 0
      monster.pathTargetX = Number.NaN
      monster.pathTargetY = Number.NaN
      this.broadcastToArea(monster.areaId, {
        type: 'UnitMove',
        unitType: 'monster',
        id: monster.unitId,
        unitId: monster.unitId,
        mode: 'run',
        from,
        to: { x: Math.round(tx), y: Math.round(ty) },
        x: Math.round(tx),
        y: Math.round(ty),
        currentX: Math.round(tx),
        currentY: Math.round(ty),
        targetX: Math.round(tx),
        targetY: Math.round(ty),
        areaId: monster.areaId,
      })
      this.setMonsterSkillCooldown(monster, skill?.delay ?? '35')
      return true
    }
    if (skill !== undefined && skill.summon !== '') {
      const summonMode = this.monsterSkillMode(entry.mode)
      monster.mode = summonMode
      this.broadcastToArea(monster.areaId, {
        type: 'UnitMode',
        unitType: 1,
        id: monster.unitId,
        mode: summonMode,
        at: { x: Math.round(target.x), y: Math.round(target.y) },
        lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
      })
      try {
        this.spawnMonster({
          defId: skill.summon,
          x: target.x,
          y: target.y,
          areaId: monster.areaId,
          level: monster.level,
          experience: 0,
          bossUnitId: monster.unitId,
        })
      } catch {
        continue
      }
      this.setMonsterSkillCooldown(monster, skill.delay)
      return true
    }
    if (skill !== undefined) {
      const stateName = skill.auraState !== '' ? skill.auraState : skill.state1
      if (stateName !== '') {
        const state = this.registry.getStateByName(stateName)
        if (state === undefined) continue
        this.applyMonsterState(monster.unitId, state.id, 100)
        const stateMode = this.monsterSkillMode(entry.mode)
        monster.mode = stateMode
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: monster.unitId,
          mode: stateMode,
          at: { x: Math.round(monster.x), y: Math.round(monster.y) },
          lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
        })
        this.setMonsterSkillCooldown(monster, skill.delay)
        return true
      }
    }
    if (distance > 20) continue
  }
  return false
}



function setMonsterSkillCooldown(this: GameInstanceHost, monster: InternalMonsterRecord, delay: string): void {
  const parsed = Number.parseInt(delay, 10)
  const raw =
    Number.isFinite(parsed) && parsed > 0
      ? parsed
      : Math.max(25, monster.cooldownTicks * 2)
  monster.skillCooldown =
    monster.monProps.fcrPct > 0
      ? Math.max(5, Math.floor((raw * 100) / (100 + monster.monProps.fcrPct)))
      : raw
}



/** Map `MonStats.txt Sk*Mode` onto the 1.13c unit mode ids. */
function monsterSkillMode(this: GameInstanceHost, mode?: string): number {
  switch ((mode ?? '').toUpperCase()) {
    case 'A1':
      return 4
    case 'A2':
      return 5
    case 'S1':
      return 8
    case 'S2':
      return 9
    case 'S3':
      return 10
    case 'S4':
      return 11
    case 'C':
      return 4
    case 'SC':
    case 'SQ':
      return 8
    default:
      return 8
  }
}



/** Despawn a temporary monster summon (`baalclone`, `baaltentacle`, `boneprison`, `hydra`) with zero XP/drops/quest side-effects. */
function despawnTemporaryMonsterUnit113c(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  deathMissileId?: number,
): void {
  if (deathMissileId !== undefined) {
    this.broadcastExplosionMissile(monster, deathMissileId)
  }
  this.monsters.delete(monster.unitId)
  this.monsterCombat.delete(monster.unitId)
  this.broadcastToArea(monster.areaId, {
    type: 'UnitRemove',
    unitType: 'monster',
    id: monster.unitId,
    unitId: monster.unitId,
    areaId: monster.areaId,
  })
}



/** Immediately despawn `#570 baalclone` & `#562..566 baaltentacle1..5` when real `#544 baalcrab` / `#709 uberbaal` dies (#1826). */
function despawnBaalMinionsOnBossDeath113c(this: GameInstanceHost, baal: InternalMonsterRecord): void {
  for (const other of [...this.monsters.values()]) {
    if (
      other.bossUnitId === baal.unitId &&
      (other.hcIdx === 570 || isBaalTentacleHcIdx113c(other.hcIdx))
    ) {
      this.despawnTemporaryMonsterUnit113c(other, other.hcIdx === 570 ? 614 : undefined)
    }
  }
  baal.activeBaalCloneUnitId = 0
}



function emitBossSkillCast113c(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  skillId: number,
  slvl: number,
  mode: number,
  targetX: number,
  targetY: number,
  targetRef?: { readonly unitType: 0 | 1; readonly id: number },
): void {
  monster.mode = mode
  const mx = Math.round(monster.x)
  const my = Math.round(monster.y)
  const tx = Math.round(targetX)
  const ty = Math.round(targetY)
  this.broadcastToArea(monster.areaId, {
    type: 'UnitMode',
    unitType: 1,
    id: monster.unitId,
    mode,
    at: { x: tx, y: ty },
    lifePct: monster.maxHp > 0 ? Math.max(0, Math.round((monster.hp / monster.maxHp) * 128)) : 0,
  })
  this.broadcastToArea(monster.areaId, {
    type: 'SkillCast',
    caster: { unitType: 1, id: monster.unitId },
    skill: skillId,
    skillId,
    level: Math.max(1, slvl),
    target: targetRef ?? { x: tx, y: ty },
    at: { x: tx, y: ty },
    from: { x: mx, y: my },
  } as ServerEvent)
}



/** Emit a 1.13c monster/boss projectile with explicit origin, velocity, range, pierce, and `nextDelay` (works with or without MPQ registry). */
function emitBossProjectile113c(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  spec: {
    readonly missileId: number
    readonly skillId: number
    readonly slvl: number
    readonly originX: number
    readonly originY: number
    readonly targetX: number
    readonly targetY: number
    readonly speedSubTilesPerFrame: number
    readonly rangeFrames: number
    readonly size?: number | undefined
    readonly collideType?: number | undefined
    readonly pierce?: boolean | undefined
    readonly nextHit?: boolean | undefined
    readonly nextDelay?: number | undefined
    readonly element: MissileDamageChannel
    readonly physDamage: number
    readonly elemDamage: number
    readonly elemDurationFrames?: number | undefined
    readonly groundFire256?: { readonly min: number; readonly max: number } | undefined
    readonly guaranteedHit?: boolean | undefined
    readonly hitMonsters?: boolean | undefined
  },
): number {
  const rec = this.registry.getMissileById(spec.missileId)
  const dx = spec.targetX - spec.originX
  const dy = spec.targetY - spec.originY
  const dist = Math.max(0.25, Math.hypot(dx, dy))
  const rawSpeed =
    rec !== undefined && rec.vel > 0
      ? (rec.vel + Math.trunc((rec.velLev * spec.slvl) / 8)) / 16
      : spec.speedSubTilesPerFrame
  const speed = monster.states.has(STATE_SLOWMISSILES_113C) ? rawSpeed * 0.33 : rawSpeed
  const rawRangeFrames =
    rec !== undefined && rec.range > 0
      ? Math.max(2, rec.range + rec.levRange * spec.slvl)
      : Math.max(2, spec.rangeFrames)
  const rangeFrames =
    spec.missileId === 225 && rawRangeFrames >= 78 ? 77 : rawRangeFrames
  const physDamage = Math.max(0, Math.floor(spec.physDamage))
  const elemDamage = Math.max(0, Math.floor(spec.elemDamage))
  const engine = rec !== undefined ? this.onlineMissileEngine() : undefined
  const doKind = rec !== undefined && engine !== undefined ? engine.classifyOnlineSrvDo113c(rec) : 'standard'
  const hitKind = rec !== undefined && engine !== undefined ? engine.classifyOnlineSrvHit113c(rec) : 'none'
  const isGroundFire =
    spec.groundFire256 !== undefined ||
    (rec !== undefined && (doKind === 'groundfire' || rec.pSrvDmgFunc === 3))
  const isFunctionalCarrier =
    rec !== undefined &&
    (doKind === 'pathspawner' ||
      doKind === 'areaspawner' ||
      doKind === 'orb' ||
      (hitKind !== 'none' && hitKind !== 'engine-only' && hitKind !== 'homing'))
  const rawTotal = physDamage + elemDamage
  const totalDamage =
    isGroundFire || (rawTotal <= 0 && isFunctionalCarrier) ? 0 : Math.max(1, rawTotal)
  const missileUnitId = this.allocateUnitId(UNIT_TYPE_113C.missile)
  const missile: InternalMissileRecord = {
    unitId: missileUnitId,
    missileId: spec.missileId,
    skillId: spec.skillId,
    ownerType: 'monster',
    ownerId: monster.unitId,
    areaId: monster.areaId,
    x: spec.originX,
    y: spec.originY,
    vx: speed > 0 ? (dx / dist) * speed : 0,
    vy: speed > 0 ? (dy / dist) * speed : 0,
    damage: totalDamage,
    remainingFrames: rangeFrames,
    collideType: rec?.collideType ?? spec.collideType ?? 3,
    size: Math.max(1, rec?.size ?? spec.size ?? 2),
    pierce: isGroundFire || (rec !== undefined && !rec.collideKill) || spec.pierce === true,
    nextHit: rec?.nextHit === true || spec.nextHit === true,
    nextDelay: Math.max(0, rec?.nextDelay ?? spec.nextDelay ?? 0),
    element: isGroundFire ? 'fire' : spec.element,
    physDamage: isGroundFire ? 0 : physDamage,
    elemDamage: isGroundFire ? 0 : elemDamage,
    elemDurationFrames: Math.max(0, spec.elemDurationFrames ?? 0),
    hitCooldowns: new Map(),
    guaranteedHit: spec.guaranteedHit ?? (rec !== undefined ? !rec.toHit : false),
    ...(spec.hitMonsters === true ? { hitMonsters: true } : {}),
  }
  if (isGroundFire) {
    missile.carrier = 'groundfire'
    missile.groundFire256 =
      spec.groundFire256 ??
      (rec !== undefined ? this.resolveOnlineGroundFire256113c(rec, Math.max(1, spec.slvl), undefined) : undefined)
    missile.groundFireCarry = new Map()
  } else if (rawTotal <= 0 && isFunctionalCarrier) {
    missile.carrier = 'none'
  }
  if (rec !== undefined && (isGroundFire || isFunctionalCarrier)) {
    this.attachOnlineMissileState113c(
      missile,
      rec,
      spec.skillId,
      Math.max(1, spec.slvl),
      speed > 0 ? Math.ceil(dist / speed) : 0,
    )
  }
  missile.createdFrame = this.currentFrame
  this.missiles.set(missileUnitId, missile)
  this.broadcastToArea(monster.areaId, {
    type: 'CreateMissile',
    missileId: missileUnitId,
    missileClassId: spec.missileId,
    at: { x: Math.round(spec.originX), y: Math.round(spec.originY) },
    target: { x: Math.round(spec.targetX), y: Math.round(spec.targetY) },
    x: Math.round(spec.originX),
    y: Math.round(spec.originY),
    targetX: Math.round(spec.targetX),
    targetY: Math.round(spec.targetY),
    skillId: spec.skillId,
    level: Math.max(1, spec.slvl),
    ownerType: 1,
    ownerUnitType: 'monster',
    ownerId: monster.unitId,
    sourceUnitId: monster.unitId,
    areaId: monster.areaId,
  } as ServerEvent)
  return missileUnitId
}



/** Push a player away from `(fromX, fromY)` up to `maxSteps` walkable sub-tiles (1.13c Smite / Charge / Hoarfrost knockback). */
function knockbackPlayerFromBoss113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  fromX: number,
  fromY: number,
  maxSteps = 3,
): boolean {
  if (player.dead) return false
  const dx = player.x - fromX
  const dy = player.y - fromY
  const d = Math.hypot(dx, dy)
  const dirX = d > 0.01 ? dx / d : 1
  const dirY = d > 0.01 ? dy / d : 0
  let endX = player.x
  let endY = player.y
  for (let step = 1; step <= maxSteps; step++) {
    const cx = player.x + dirX * step
    const cy = player.y + dirY * step
    if (!this.isWorldWalkableForPlayer(player.areaId, Math.round(cx), Math.round(cy))) {
      break
    }
    endX = cx
    endY = cy
  }
  if (Math.hypot(endX - player.x, endY - player.y) < 0.25) return false
  player.x = endX
  player.y = endY
  player.targetX = endX
  player.targetY = endY
  this.broadcastToArea(player.areaId, {
    type: 'UnitReassign',
    unitType: 0,
    id: player.unitId,
    unitId: player.unitId,
    at: { x: Math.round(endX), y: Math.round(endY) },
    x: Math.round(endX),
    y: Math.round(endY),
    snap: true,
  })
  return true
}



/** Apply direct boss/monster combat skill damage + optional chill, stun, and knockback to a hostile player, merc, or pet. */
function dealMonsterDirectHitToHostile113c(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  target:
    | { readonly kind: 'player'; readonly player: InternalPlayerRecord }
    | { readonly kind: 'merc'; readonly merc: InternalMercenaryRecord }
    | { readonly kind: 'pet'; readonly pet: SummonedPetUnit },
  parts: {
    readonly phys?: number | undefined
    readonly fire?: number | undefined
    readonly cold?: number | undefined
    readonly light?: number | undefined
    readonly magic?: number | undefined
  },
  effects?: {
    readonly chillFrames?: number | undefined
    readonly stunFrames?: number | undefined
    readonly knockbackSteps?: number | undefined
    readonly knockbackOriginX?: number | undefined
    readonly knockbackOriginY?: number | undefined
    readonly skipGetHit?: boolean | undefined
    readonly damageRate?: number | undefined
  },
): void {
  if (target.kind === 'player') {
    const p = target.player
    if (p.dead) return
    const elemTotal =
      (parts.phys ?? 0) + (parts.fire ?? 0) + (parts.cold ?? 0) + (parts.light ?? 0)
    if (elemTotal > 0) {
      this.applyPlayerElementalDamage(
        p,
        {
          phys: parts.phys,
          fire: parts.fire,
          cold: parts.cold,
          light: parts.light,
        },
        {
          ...(effects?.skipGetHit === true ? { skipGetHit: true } : {}),
          ...(effects?.damageRate !== undefined && effects.damageRate > 0
            ? { damageRate: effects.damageRate }
            : {}),
          killerType: 'monster',
          killerUnitId: monster.unitId,
        },
      )
    }
    if ((parts.magic ?? 0) > 0 && !p.dead) {
      this.applyDamageToPlayer(p, Math.max(1, Math.round(parts.magic!)), {
        ...(effects?.skipGetHit === true ? { skipGetHit: true } : {}),
        killerType: 'monster',
        killerUnitId: monster.unitId,
      })
    }
    if (!p.dead) {
      if ((effects?.chillFrames ?? 0) > 0) {
        this.applyUnitState(
          p.states,
          p.stateTimers,
          'player',
          p.unitId,
          p.areaId,
          11,
          effects!.chillFrames!,
        )
      }
      if ((effects?.stunFrames ?? 0) > 0) {
        this.applyUnitState(
          p.states,
          p.stateTimers,
          'player',
          p.unitId,
          p.areaId,
          21,
          effects!.stunFrames!,
        )
      }
      if ((effects?.knockbackSteps ?? 0) > 0) {
        this.knockbackPlayerFromBoss113c(
          p,
          effects?.knockbackOriginX ?? monster.x,
          effects?.knockbackOriginY ?? monster.y,
          effects!.knockbackSteps!,
        )
      }
    }
    return
  }
  const rawTotal = Math.max(
    1,
    Math.round(
      (parts.phys ?? 0) +
        (parts.fire ?? 0) +
        (parts.cold ?? 0) +
        (parts.light ?? 0) +
        (parts.magic ?? 0),
    ),
  )
  if (target.kind === 'merc') {
    this.applyDamageToMerc(
      target.merc,
      rawTotal,
      monster.areaId,
      effects?.skipGetHit === true ? { skipGetHit: true } : undefined,
    )
    return
  }
  this.applyDamageToSummon(target.pet, rawTotal, monster.areaId)
}



/**
 * 1.13c Monster Melee Combat Skill Resolver (`D2Game.dll` `0x6FCC11B0` -> `SUNITDMG_AllocCombat` `0x6FCFE5A0`, #1994):
 * - Routes monster melee skills (`#10 Jab`, `#97 Smite`, `#107/#352 Charge`, `#126 Bash`, `#143 Leap Attack`,
 *   `#151 Whirlwind`, `#156 Fire Hit`, `#198 DiabRun`, `#215/#328 Frenzy`, `#301 Siege Beast Stomp`) through
 *   `resolveMonsterAttackOnPlayer` / `applyMonsterMissileToDefender(..., 'melee')` (`executeSUnitDmg`).
 * - Enforces 1.13c `RollToHit` vs Defense (when `(ResultFlags & 1) == 0` and not `#97 Smite`), Shield Block /
 *   Weapon Block / Dodge (when not `#97 Smite`), `MonStats.txt` `S1` riders (e.g. `sandraider1..10` Fire/Cold),
 *   and applies `stunFrames` / `knockbackSteps` strictly on unblocked hits (`dmgOut.hit === true`).
 */
function executeMonsterMeleeSkillStrike113c(this: GameInstanceHost,
  monster: InternalMonsterRecord,
  target:
    | { readonly kind: 'player'; readonly player: InternalPlayerRecord }
    | { readonly kind: 'merc'; readonly merc: InternalMercenaryRecord }
    | { readonly kind: 'pet'; readonly pet: SummonedPetUnit },
  spec: {
    readonly skillId: number
    readonly minDmg: number
    readonly maxDmg: number
    readonly skillMode?: 'A1' | 'A2' | 'S1' | undefined
    readonly arBonusPct?: number | undefined
    readonly autoHit?: boolean | undefined
    readonly unblockable?: boolean | undefined
    readonly stunFrames?: number | undefined
    readonly knockbackSteps?: number | undefined
    readonly knockbackOriginX?: number | undefined
    readonly knockbackOriginY?: number | undefined
  },
): boolean {
  const minDmg = Math.max(1, Math.round(spec.minDmg))
  const maxDmg = Math.max(minDmg, Math.round(spec.maxDmg))
  const skillMode = spec.skillMode ?? 'A1'

  if (target.kind === 'player') {
    const p = target.player
    if (p.dead) return false
    const hit = this.resolveMonsterAttackOnPlayer(monster, p, {
      minDmg,
      maxDmg,
      skillMode,
      attackKind: 'melee',
      skillId: spec.skillId,
      arBonusPct: spec.arBonusPct,
      autoHit: spec.autoHit,
      unblockable: spec.unblockable,
    })
    if (hit && !p.dead) {
      if ((spec.stunFrames ?? 0) > 0) {
        this.applyUnitState(
          p.states,
          p.stateTimers,
          'player',
          p.unitId,
          p.areaId,
          21,
          spec.stunFrames!,
        )
      }
      if ((spec.knockbackSteps ?? 0) > 0) {
        this.knockbackPlayerFromBoss113c(
          p,
          spec.knockbackOriginX ?? monster.x,
          spec.knockbackOriginY ?? monster.y,
          spec.knockbackSteps!,
        )
      }
    }
    return hit
  }

  const rider = this.rollMonsterElementalRider(monster, skillMode)
  let hit = false
  const swing = {
    skillId: spec.skillId,
    physDamage: this.rollInclusive(minDmg, maxDmg),
    elemDamage: rider?.damage ?? 0,
    element: rider?.element ?? ('phys' as MissileDamageChannel),
    elemDurationFrames: rider?.durationFrames ?? 0,
    guaranteedHit: spec.autoHit,
    toHitBonusPct: spec.arBonusPct,
    skillMode,
    unblockable: spec.unblockable,
    onOutcome: (didHit: boolean) => {
      hit = didHit
    },
  }
  if (target.kind === 'merc') {
    const merc = target.merc
    if (!merc.alive) return false
    const prevHp = merc.hp
    const nextHp = this.applyMonsterMissileToDefender(
      monster,
      swing,
      {
        id: `merc_${merc.unitId}`,
        name: merc.name,
        unitType: 'mercenary',
        level: merc.level,
        hp: merc.hp,
        maxHp: merc.maxHp,
        defense: merc.defense,
        resist: merc.resist,
        equipment: merc.equipment,
      },
      'melee',
    )
    if (nextHp < prevHp) {
      this.applyDamageToMerc(merc, prevHp - nextHp, merc.areaId)
    }
    return hit
  }

  const pet = target.pet
  if (pet.alive === false || pet.hp <= 0) return false
  const prevHp = pet.hp
  const nextHp = this.applyMonsterMissileToDefender(
    monster,
    swing,
    {
      id: pet.uid,
      name: pet.name,
      unitType: 'minion',
      level: pet.statList.getAccruedStat('level'),
      hp: pet.hp,
      maxHp: pet.maxHp,
      stats: pet.statList,
      stateBus: pet.stateBus,
      x: pet.x,
      y: pet.y,
    },
    'melee',
  )
  if (nextHp < prevHp) {
    pet.hp = prevHp
    this.applyDamageToSummon(pet, prevHp - nextHp, monster.areaId)
  }
  return hit
}



/** Enumerate all living hostile units (players, mercs, pets) in `monster.areaId`. */
function listHostilesInMonsterArea113c(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
): (
  | { readonly kind: 'player'; readonly key: number; readonly x: number; readonly y: number; readonly player: InternalPlayerRecord }
  | { readonly kind: 'merc'; readonly key: number; readonly x: number; readonly y: number; readonly merc: InternalMercenaryRecord }
  | { readonly kind: 'pet'; readonly key: number; readonly x: number; readonly y: number; readonly pet: SummonedPetUnit }
)[] {
  const out: (
    | { readonly kind: 'player'; readonly key: number; readonly x: number; readonly y: number; readonly player: InternalPlayerRecord }
    | { readonly kind: 'merc'; readonly key: number; readonly x: number; readonly y: number; readonly merc: InternalMercenaryRecord }
    | { readonly kind: 'pet'; readonly key: number; readonly x: number; readonly y: number; readonly pet: SummonedPetUnit }
  )[] = []
  for (const p of this.players.values()) {
    if (!p.dead && p.areaId === monster.areaId) {
      out.push({ kind: 'player', key: p.unitId, x: p.x, y: p.y, player: p })
    }
  }
  for (const merc of this.mercenaries.values()) {
    if (!merc.alive || merc.areaId !== monster.areaId) continue
    const owner = this.players.get(merc.ownerPlayerId)
    if (owner && !owner.dead && owner.areaId === monster.areaId) {
      out.push({ kind: 'merc', key: 100000 + merc.unitId, x: merc.x, y: merc.y, merc })
    }
  }
  for (const [ownerId, mgr] of this.summonManagers) {
    const owner = this.players.get(ownerId)
    if (!owner || owner.dead || owner.areaId !== monster.areaId) continue
    for (const pet of mgr.getActivePets()) {
      if (pet.alive !== false && pet.hp > 0) {
        out.push({
          kind: 'pet',
          key: 200000 + (this.petUnitIds.get(pet.uid) ?? 0),
          x: pet.x,
          y: pet.y,
          pet,
        })
      }
    }
  }
  return out
}



/**
 * Per-tick boss channel, Hoarfrost V-wedge, Armageddon meteor, and summon lifespan stepper (#1825, #1826, #1827).
 * Returns `true` when the monster despawned or is locked in an active multi-frame boss channel.
 */
function stepBossChannelsAndSummonLifespans113c(this: GameInstanceHost, monster: InternalMonsterRecord): boolean {
  if (monster.despawnAtFrame > 0 && this.currentFrame >= monster.despawnAtFrame) {
    this.despawnTemporaryMonsterUnit113c(monster, monster.hcIdx === 570 ? 614 : undefined)
    return true
  }
  if (
    (monster.hcIdx === 570 || isBaalTentacleHcIdx113c(monster.hcIdx)) &&
    monster.bossUnitId !== undefined
  ) {
    const parent = this.monsters.get(monster.bossUnitId)
    if (parent === undefined || parent.dead) {
      this.despawnTemporaryMonsterUnit113c(monster, monster.hcIdx === 570 ? 614 : undefined)
      return true
    }
  }

  const diffIdx: 0 | 1 | 2 = this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0

  // `#349 Diablogeddon` (`Armageddon`) periodic meteor impacts on `#333 diabloclone` / `#705 uberdiablo` (#1825, #2006).
  if (monster.diablogeddonUntilFrame > this.currentFrame && this.currentFrame % 12 === 0) {
    const near = this.nearestHostileForMonster(monster, 18)
    const jitterX = (this.rng.rand(7) - 3) * 0.8
    const jitterY = (this.rng.rand(7) - 3) * 0.8
    const mx = (near?.x ?? monster.x) + jitterX
    const my = (near?.y ?? monster.y) + jitterY
    const geddonSlvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, 349, diffIdx, 5)
    const geddonRec = this.registry.getMissileById(670)
    const geddonEval =
      geddonRec !== undefined
        ? evaluateMonsterMissileDamage113c({
            registry: this.registry,
            missile: geddonRec,
            slvl: geddonSlvl,
            difficulty: diffIdx,
            monsterMinPhys: 0,
            monsterMaxPhys: 0,
            rng: this.rng,
          })
        : undefined
    const geddonPhys =
      geddonEval !== undefined && geddonEval.physDamage > 0
        ? geddonEval.physDamage
        : this.rollInclusive(
            compute5BandScaling(geddonSlvl, 4, 4, 6, 8, 10, 12),
            compute5BandScaling(geddonSlvl, 16, 4, 7, 9, 12, 14),
          )
    const geddonFire =
      geddonEval !== undefined && geddonEval.elemDamage > 0
        ? geddonEval.elemDamage
        : this.rollInclusive(
            compute5BandScaling(geddonSlvl, 25, 15, 20, 25, 30, 35),
            compute5BandScaling(geddonSlvl, 75, 16, 22, 27, 33, 38),
          )
    this.emitBossProjectile113c(monster, {
      missileId: 674,
      skillId: 349,
      slvl: geddonSlvl,
      originX: mx,
      originY: my,
      targetX: mx,
      targetY: my,
      speedSubTilesPerFrame: 0,
      rangeFrames: 18,
      size: 2,
      collideType: 0,
      nextHit: true,
      nextDelay: 6,
      element: 'fire',
      physDamage: geddonPhys,
      elemDamage: geddonFire,
    })
  }

  // Baal `#318 Baal Cold Missiles` (`Hoarfrost`) expanding V-wedge wave (#1826, #2006).
  if (monster.activeHoarfrostWaves !== undefined && monster.activeHoarfrostWaves.length > 0) {
    const hostiles = this.listHostilesInMonsterArea113c(monster)
    const frostRec = this.registry.getMissileById(589)
    for (const wave of monster.activeHoarfrostWaves) {
      wave.x += wave.vx
      wave.y += wave.vy
      wave.stepDone += 1
      wave.remainingSteps -= 1
      const halfWidth = 1.5 + wave.stepDone * 0.45
      const speedNorm = Math.max(0.01, Math.hypot(wave.vx, wave.vy))
      const dirX = wave.vx / speedNorm
      const dirY = wave.vy / speedNorm
      if (wave.stepDone % 2 === 1) {
        for (const side of [-1, 1] as const) {
          const lx = wave.x + wave.perpX * halfWidth * side
          const ly = wave.y + wave.perpY * halfWidth * side
          this.broadcastToArea(monster.areaId, {
            type: 'CreateMissile',
            missileId: this.allocateUnitId(UNIT_TYPE_113C.missile),
            missileClassId: 590,
            at: { x: Math.round(lx), y: Math.round(ly) },
            target: { x: Math.round(lx + wave.vx), y: Math.round(ly + wave.vy) },
            x: Math.round(lx),
            y: Math.round(ly),
            targetX: Math.round(lx + wave.vx),
            targetY: Math.round(ly + wave.vy),
            skillId: 318,
            level: wave.slvl,
            ownerType: 1,
            ownerUnitType: 'monster',
            ownerId: monster.unitId,
            sourceUnitId: monster.unitId,
            areaId: monster.areaId,
          } as ServerEvent)
        }
      }
      for (const h of hostiles) {
        if (wave.hitUnits.has(h.key)) continue
        const rx = h.x - wave.x
        const ry = h.y - wave.y
        const along = rx * dirX + ry * dirY
        const lat = Math.abs(rx * wave.perpX + ry * wave.perpY)
        if (Math.abs(along) <= 1.8 && lat <= halfWidth) {
          wave.hitUnits.add(h.key)
          const frostEval =
            frostRec !== undefined
              ? evaluateMonsterMissileDamage113c({
                  registry: this.registry,
                  missile: frostRec,
                  slvl: wave.slvl,
                  difficulty: diffIdx,
                  monsterMinPhys: 0,
                  monsterMaxPhys: 0,
                  rng: this.rng,
                })
              : undefined
          const coldDmg =
            frostEval !== undefined && frostEval.elemDamage > 0
              ? frostEval.elemDamage
              : this.rollInclusive(
                  compute5BandScaling(wave.slvl, 20, 9, 13, 13, 13, 13),
                  compute5BandScaling(wave.slvl, 40, 9, 13, 13, 13, 13),
                )
          const chillFrames =
            frostEval !== undefined && frostEval.elemDurationFrames > 0
              ? frostEval.elemDurationFrames
              : 200 + 50 * Math.max(0, wave.slvl - 1)
          const kbSteps = this.rng.rand(100) < 75 ? 3 : 0
          this.dealMonsterDirectHitToHostile113c(
            monster,
            h,
            { cold: coldDmg },
            {
              chillFrames,
              knockbackSteps: kbSteps,
              knockbackOriginX: monster.x,
              knockbackOriginY: monster.y,
            },
          )
        }
      }
    }
    monster.activeHoarfrostWaves = monster.activeHoarfrostWaves.filter(
      (w) => w.remainingSteps > 0,
    )
  }

  const ch = monster.activeBossChannel
  if (ch === undefined) return false
  if (
    ch.kind === 'monsterinferno' &&
    (this.currentFrame < monster.hitRecoveryUntilFrame ||
      monster.states.has(1) ||
      monster.states.has(29) ||
      monster.states.has(21) ||
      monster.states.has(25) ||
      monster.frozenTicks > 0 ||
      !monster.states.has(12))
  ) {
    monster.activeBossChannel = undefined
    if (monster.states.has(12)) {
      this.clearUnitState(monster.states, monster.stateTimers, 'monster', monster.unitId, monster.areaId, 12)
    }
    if (monster.mode !== 1 && this.currentFrame >= monster.hitRecoveryUntilFrame) {
      monster.mode = 1
    }
    return false
  }
  if (ch.remainingFrames <= 0) {
    monster.activeBossChannel = undefined
    if (ch.kind === 'monsterinferno' && monster.states.has(12)) {
      this.clearUnitState(monster.states, monster.stateTimers, 'monster', monster.unitId, monster.areaId, 12)
    }
    if (monster.mode !== 1) monster.mode = 1
    return false
  }
  ch.remainingFrames -= 1

  const nearHostile = this.nearestHostileForMonster(monster, 35)
  if (
    nearHostile !== null &&
    (ch.kind === 'diablight' || ch.kind === 'baalinferno' || ch.kind === 'monsterinferno')
  ) {
    const desired = Math.atan2(nearHostile.y - monster.y, nearHostile.x - monster.x)
    let delta = desired - ch.angle
    while (delta > Math.PI) delta -= Math.PI * 2
    while (delta < -Math.PI) delta += Math.PI * 2
    const maxTurn = ch.kind === 'diablight' || ch.kind === 'monsterinferno' ? 0.08 : 0.06
    ch.angle += Math.max(-maxTurn, Math.min(maxTurn, delta))
  }

  if (ch.kind === 'monsterinferno') {
    const elapsed = (ch.elapsedFrames ?? 0) + 1
    ch.elapsedFrames = elapsed
    const stepEvery = Math.max(1, ch.stepFrames ?? 2)
    if (elapsed % stepEvery === 0 && ch.missileId !== undefined) {
      const mRec = this.registry.getMissileById(ch.missileId)
      if (mRec !== undefined) {
        const rf = Math.max(1, ch.rangeFrames ?? 10)
        const jetDist = Math.max(4, mRec.vel > 0 ? (mRec.vel / 16) * rf : rf)
        const phys = ch.physDamage ?? 0
        const elem = ch.elemDamage ?? 0
        this.spawnMonsterMissile(
          monster,
          monster.x + Math.cos(ch.angle) * jetDist,
          monster.y + Math.sin(ch.angle) * jetDist,
          phys + elem,
          mRec.id,
          ch.skillId,
          {
            missile: mRec,
            skillLevel: ch.slvl,
            rangeFrames: rf,
            physDamage: phys,
            elemDamage: elem,
            ...(ch.element !== undefined ? { element: ch.element } : {}),
            skipMultishot: true,
            ...(ch.elemDurationFrames !== undefined && ch.elemDurationFrames > 0
              ? { elemDurationFrames: ch.elemDurationFrames }
              : {}),
            ...(ch.hitMonsters === true ? { hitMonsters: true } : {}),
          },
        )
      }
    }
    if (ch.remainingFrames <= 0) {
      monster.activeBossChannel = undefined
      if (monster.states.has(12)) {
        this.clearUnitState(monster.states, monster.stateTimers, 'monster', monster.unitId, monster.areaId, 12)
      }
      monster.mode = 1
    }
    return true
  }

  if (ch.kind === 'diablight') {
    // 1.13c `#193 DiabLight` (`0x6FCD6840`, `Missiles.txt #172 diablight` `HitShift = 6`, #1825, #2006):
    // 40-frame channel, stream pulse every 2 frames; Normal (`startOffset = 0`) hits point-blank while NM/Hell (`startOffset = 5.5` sub-tiles) leaves `< 4.5` inside the blind spot!
    if (ch.remainingFrames % 2 === 0) {
      const cos = Math.cos(ch.angle)
      const sin = Math.sin(ch.angle)
      const beamEnd = 24
      const ox = monster.x + cos * ch.startOffset
      const oy = monster.y + sin * ch.startOffset
      const ex = monster.x + cos * beamEnd
      const ey = monster.y + sin * beamEnd
      this.broadcastToArea(monster.areaId, {
        type: 'CreateMissile',
        missileId: this.allocateUnitId(UNIT_TYPE_113C.missile),
        missileClassId: 172,
        at: { x: Math.round(ox), y: Math.round(oy) },
        target: { x: Math.round(ex), y: Math.round(ey) },
        x: Math.round(ox),
        y: Math.round(oy),
        targetX: Math.round(ex),
        targetY: Math.round(ey),
        skillId: 193,
        level: ch.slvl,
        ownerType: 1,
        ownerUnitType: 'monster',
        ownerId: monster.unitId,
        sourceUnitId: monster.unitId,
        areaId: monster.areaId,
      } as ServerEvent)
      const diabLightRec = this.registry.getMissileById(172)
      for (const h of this.listHostilesInMonsterArea113c(monster)) {
        const nextReady = ch.nextHitFrames.get(h.key) ?? 0
        if (this.currentFrame < nextReady) continue
        const rx = h.x - monster.x
        const ry = h.y - monster.y
        const proj = rx * cos + ry * sin
        const perp = Math.abs(-rx * sin + ry * cos)
        if (proj >= ch.startOffset && proj <= beamEnd && perp <= 1.75) {
          ch.nextHitFrames.set(h.key, this.currentFrame + 3)
          const lightEval =
            diabLightRec !== undefined
              ? evaluateMonsterMissileDamage113c({
                  registry: this.registry,
                  missile: diabLightRec,
                  slvl: ch.slvl,
                  difficulty: diffIdx,
                  monsterMinPhys: 0,
                  monsterMaxPhys: 0,
                  rng: this.rng,
                })
              : undefined
          const physDmg =
            lightEval !== undefined && lightEval.physDamage > 0
              ? lightEval.physDamage
              : Math.max(1, ((this.rollInclusive(7, 15) + 10 * Math.max(0, ch.slvl - 1)) << 6) >> 8)
          const ltngDmg =
            lightEval !== undefined && lightEval.elemDamage > 0
              ? lightEval.elemDamage
              : Math.max(1, ((this.rollInclusive(25, 66) + 16 * Math.max(0, ch.slvl - 1)) << 6) >> 8)
          this.dealMonsterDirectHitToHostile113c(
            monster,
            h,
            {
              phys: physDmg,
              light: ltngDmg,
            },
            {
              // 1.13c `#172 diablight` (`Missiles.txt`: `GetHit = 0`, `DamageRate = 82`, #2017).
              skipGetHit: diabLightRec !== undefined ? !diabLightRec.getHit : true,
              damageRate: diabLightRec !== undefined && diabLightRec.damageRate > 0 ? diabLightRec.damageRate : 82,
            },
          )
        }
      }
    }
    if (ch.remainingFrames <= 0) {
      monster.activeBossChannel = undefined
      monster.mode = 1
    }
    return true
  }

  if (ch.kind === 'baalinferno') {
    // 1.13c `#317 Baal Inferno` (`Mana Rift`, `SrvHit55` `0x6FC5FD60`, `Skills.txt #317` `HitShift = 5`, #1826, #2006):
    // Magic beam (`<< 5 >> 8` = `1/8` HP scaling per tick) + 50% current Mana drain.
    if (ch.remainingFrames % 2 === 0) {
      const cos = Math.cos(ch.angle)
      const sin = Math.sin(ch.angle)
      const beamEnd = 16
      const ex = monster.x + cos * beamEnd
      const ey = monster.y + sin * beamEnd
      this.broadcastToArea(monster.areaId, {
        type: 'CreateMissile',
        missileId: this.allocateUnitId(UNIT_TYPE_113C.missile),
        missileClassId: 554,
        at: { x: Math.round(monster.x), y: Math.round(monster.y) },
        target: { x: Math.round(ex), y: Math.round(ey) },
        x: Math.round(monster.x),
        y: Math.round(monster.y),
        targetX: Math.round(ex),
        targetY: Math.round(ey),
        skillId: 317,
        level: ch.slvl,
        ownerType: 1,
        ownerUnitType: 'monster',
        ownerId: monster.unitId,
        sourceUnitId: monster.unitId,
        areaId: monster.areaId,
      } as ServerEvent)
      const infernoRec = this.registry.getMissileById(554)
      for (const h of this.listHostilesInMonsterArea113c(monster)) {
        const nextReady = ch.nextHitFrames.get(h.key) ?? 0
        if (this.currentFrame < nextReady) continue
        const rx = h.x - monster.x
        const ry = h.y - monster.y
        const proj = rx * cos + ry * sin
        const perp = Math.abs(-rx * sin + ry * cos)
        if (proj >= 0.5 && proj <= beamEnd && perp <= 2.0) {
          ch.nextHitFrames.set(h.key, this.currentFrame + 4)
          const infEval =
            infernoRec !== undefined
              ? evaluateMonsterMissileDamage113c({
                  registry: this.registry,
                  missile: infernoRec,
                  slvl: ch.slvl,
                  difficulty: diffIdx,
                  monsterMinPhys: 0,
                  monsterMaxPhys: 0,
                  rng: this.rng,
                })
              : undefined
          const magicDmg =
            infEval !== undefined && infEval.elemDamage > 0
              ? infEval.elemDamage
              : Math.max(1, ((this.rollInclusive(64, 96) + 48 * Math.max(0, ch.slvl - 1)) << 5) >> 8)
          this.dealMonsterDirectHitToHostile113c(monster, h, { magic: magicDmg })
          if (h.kind === 'player' && !h.player.dead && h.player.manaFixed > 0) {
            const drained = Math.floor(h.player.manaFixed / 2)
            h.player.manaFixed = Math.max(0, h.player.manaFixed - drained)
            h.player.mana = Math.floor(h.player.manaFixed / FIXED_ONE)
            this.emitToPlayer(h.player.unitId, {
              type: 'UnitStatUpdate',
              unitType: 'player',
              unitId: h.player.unitId,
              statId: 8,
              value: h.player.manaFixed,
            })
            this.emitToPlayer(h.player.unitId, {
              type: 'LifeMana',
              life: h.player.hp,
              mana: h.player.mana,
              stamina: h.player.stamina,
              at: playerWirePosition(h.player),
              vx: 0,
              vy: 0,
            })
          }
        }
      }
    }
    if (ch.remainingFrames <= 0) {
      monster.activeBossChannel = undefined
      monster.mode = 1
    }
    return true
  }

  // Talic `#151 Whirlwind` (`#540 ancientbarb1`, #1827): continuous spin-through-target movement + 4-frame multi-hits.
  const vx = ch.stepVx ?? Math.cos(ch.angle) * 0.9
  const vy = ch.stepVy ?? Math.sin(ch.angle) * 0.9
  const nx = monster.x + vx
  const ny = monster.y + vy
  if (
    !this.isClosedDoorAt(monster.areaId, Math.round(nx), Math.round(ny)) &&
    (!this.terrainWalkableCheck ||
      this.terrainWalkableCheck(monster.areaId, Math.round(nx), Math.round(ny), false)) &&
    !this.isBlockedByBonePrison(monster.areaId, nx, ny)
  ) {
    const from = { x: Math.round(monster.x), y: Math.round(monster.y) }
    monster.x = nx
    monster.y = ny
    this.broadcastToArea(monster.areaId, {
      type: 'UnitMove',
      unitType: 'monster',
      id: monster.unitId,
      unitId: monster.unitId,
      mode: 'run',
      from,
      to: { x: Math.round(nx), y: Math.round(ny) },
      x: Math.round(nx),
      y: Math.round(ny),
      currentX: Math.round(nx),
      currentY: Math.round(ny),
      targetX: Math.round(ch.targetX),
      targetY: Math.round(ch.targetY),
      areaId: monster.areaId,
    })
  }
  for (const h of this.listHostilesInMonsterArea113c(monster)) {
    const nextReady = ch.nextHitFrames.get(h.key) ?? 0
    if (this.currentFrame < nextReady) continue
    if (Math.hypot(h.x - monster.x, h.y - monster.y) <= 3.1) {
      ch.nextHitFrames.set(h.key, this.currentFrame + 4)
      const wwMult = 1 + (50 + Math.max(0, ch.slvl - 1) * 8) / 100
      const wwMin = Math.max(4, Math.round(monster.minDmg * wwMult))
      const wwMax = Math.max(wwMin, Math.round(monster.maxDmg * wwMult))
      this.executeMonsterMeleeSkillStrike113c(monster, h, {
        skillId: 151,
        minDmg: wwMin,
        maxDmg: wwMax,
        arBonusPct: 5 * Math.max(0, ch.slvl - 1),
      })
    }
  }
  if (ch.remainingFrames <= 0) {
    monster.activeBossChannel = undefined
    monster.mode = 1
  }
  return true
}



/** Spawn 16 `boneprison1..4` (`hcIdx 340..343`, `0` XP/drops, 600-frame lifespan) around `(cx, cy)` (`#199 DiabPrison`, #1825). */
function spawnDiabloBonePrisonRing113c(this: GameInstanceHost, 
  diablo: InternalMonsterRecord,
  cx: number,
  cy: number,
  slvl: number,
): number {
  this.emitBossSkillCast113c(diablo, 199, slvl, 10, cx, cy)
  const radius = 2.8
  const segHp = Math.max(
    40,
    Math.round((80 + 60 * slvl) * (this.difficulty === 2 ? 4 : this.difficulty === 1 ? 2.2 : 1)),
  )
  let spawned = 0
  for (let i = 0; i < 16; i++) {
    const theta = (i / 16) * Math.PI * 2
    const sx = cx + Math.cos(theta) * radius
    const sy = cy + Math.sin(theta) * radius
    if (
      this.terrainWalkableCheck &&
      !this.terrainWalkableCheck(diablo.areaId, Math.round(sx), Math.round(sy), false)
    ) {
      continue
    }
    const segHcIdx = 340 + (i % 4)
    const segId = this.spawnMonster({
      classId: segHcIdx,
      hcIdx: segHcIdx,
      defId: `boneprison${String((i % 4) + 1)}`,
      ai: 'BoneWall',
      x: sx,
      y: sy,
      areaId: diablo.areaId,
      level: diablo.level,
      hp: segHp,
      maxHp: segHp,
      experience: 0,
      noRatio: true,
      velocity: 0,
      runSpeed: 0,
      bossUnitId: diablo.unitId,
    })
    const seg = this.monsters.get(segId)
    if (seg !== undefined) {
      seg.despawnAtFrame = this.currentFrame + 600
    }
    spawned += 1
  }
  return spawned
}



/**
 * 1.13c `AITHINK_Fn051_Diablo` (`D2Game.dll` `0x6FCCAF30`, `#243 diablo`, `#333 diabloclone`, `#705 uberdiablo`, #1825):
 * Executes Red Lightning Hose (`#193`, NM/Hell `< 4.5` blind spot), 32-bolt radial Fire Nova (`#195`),
 * Firestorm (`#197`), PrimeFirewall (`#188`), Cold Touch (`#194`), Four-Legged Charge (`#198`),
 * Bone Prison (`#199` on player AND active Chaos Sanctuary Town Portals `classId = 59`), and Diablogeddon (`#349`).
 */
function stepDiabloBossAi113c(this: GameInstanceHost, monster: InternalMonsterRecord): void {
  const diffIdx: 0 | 1 | 2 = this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0
  if (
    (monster.hcIdx === 333 || monster.hcIdx === 705) &&
    monster.diablogeddonUntilFrame <= this.currentFrame
  ) {
    const geddonSlvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, 349, diffIdx, 5)
    monster.diablogeddonUntilFrame = this.currentFrame + 1000
    this.applyMonsterState(monster.unitId, 144, 1000)
    this.emitBossSkillCast113c(monster, 349, geddonSlvl, 8, monster.x, monster.y)
    monster.cooldown = Math.max(8, monster.cooldownTicks)
    return
  }

  const nearest = this.nearestHostileForMonster(monster, Math.max(35, monster.aggroRadius))
  if (nearest === null) return
  const dist = Math.hypot(nearest.x - monster.x, nearest.y - monster.y)

  if (monster.hcIdx === 705 && this.trySpawnUberPrimeMinion113c(monster, nearest)) {
    return
  }

  // 1.13c Town Portal trap (`0x6FCCAF30`): Diablo cages any un-trapped player Town Portal (`classId === 59`) within 85 sub-tiles!
  if (monster.skillCooldown <= 0) {
    for (const obj of this.objects.values()) {
      if (obj.areaId !== monster.areaId || obj.classId !== 59) continue
      if (Math.hypot(obj.x - monster.x, obj.y - monster.y) > 85) continue
      const alreadyCaged = [...this.monsters.values()].some(
        (m) =>
          !m.dead &&
          m.areaId === monster.areaId &&
          isBonePrisonMonsterHcIdx113c(m.hcIdx) &&
          Math.hypot(m.x - obj.x, m.y - obj.y) <= 5,
      )
      if (!alreadyCaged) {
        const prisonSlvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, 199, diffIdx, 4)
        this.spawnDiabloBonePrisonRing113c(monster, obj.x, obj.y, prisonSlvl)
        monster.skillCooldown = 50
        monster.cooldown = Math.max(10, monster.cooldownTicks)
        return
      }
    }
  }

  if (monster.cooldown <= 0 && monster.skillCooldown <= 0) {
    const slot = monster.skillCursor % 7
    monster.skillCursor = (monster.skillCursor + 1) % 7

    // Close-range melee Cold Touch (`#194 DiabCold`, `Skills.txt #194` `EType = mag`, `HitShift = 8`) when target is un-chilled in melee range.
    const targetChilled =
      nearest.kind === 'player'
        ? nearest.player.states.has(11)
        : nearest.kind === 'merc'
          ? nearest.merc.states.has(11)
          : false
    if (dist <= 3.8 && (!targetChilled || slot === 4)) {
      const slvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, 194, diffIdx, 4)
      this.emitBossSkillCast113c(monster, 194, slvl, 9, nearest.x, nearest.y)
      const coldTouchSkill = this.registry.getSkillById(194)
      let magicDmg: number
      let chillFrames: number
      if (coldTouchSkill !== undefined) {
        const statList = new UnitStatList(this.registry, undefined, { ownerType: 'monster' })
        statList.setBaseStat('level', slvl)
        const evalOut = evaluateSkill113c({
          registry: this.registry,
          skill: coldTouchSkill,
          slvl,
          blvl: slvl,
          statList,
          difficulty: diffIdx,
        })
        magicDmg = this.rollInclusive(
          Math.max(1, evalOut.minElemDmg),
          Math.max(1, evalOut.maxElemDmg),
        )
        chillFrames = evalOut.durationFrames > 0 ? evalOut.durationFrames : 100 + 50 * Math.max(0, slvl - 1)
      } else {
        magicDmg = this.rollInclusive(15 + 9 * Math.max(0, slvl - 1), 25 + 12 * Math.max(0, slvl - 1))
        chillFrames = 100 + 50 * Math.max(0, slvl - 1)
      }
      this.dealMonsterDirectHitToHostile113c(
        monster,
        nearest,
        { magic: magicDmg },
        { chillFrames },
      )
      monster.cooldown = Math.max(10, monster.cooldownTicks)
      monster.skillCooldown = 18
      return
    }

    // Four-Legged Charge (`#198 DiabRun`) at mid/long range (`dist >= 6`).
    if (slot === 5 && dist >= 6 && dist <= 24) {
      const slvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, 198, diffIdx, 5)
      this.emitBossSkillCast113c(monster, 198, slvl, 14, nearest.x, nearest.y)
      const dx = nearest.x - monster.x
      const dy = nearest.y - monster.y
      const d = Math.max(1, Math.hypot(dx, dy))
      const ux = dx / d
      const uy = dy / d
      let destX = monster.x
      let destY = monster.y
      const stopDist = Math.max(1, Math.floor(d - 1.5))
      for (let step = 1; step <= stopDist; step++) {
        const cx = monster.x + ux * step
        const cy = monster.y + uy * step
        if (
          this.isClosedDoorAt(monster.areaId, Math.round(cx), Math.round(cy)) ||
          (this.terrainWalkableCheck &&
            !this.terrainWalkableCheck(monster.areaId, Math.round(cx), Math.round(cy), false)) ||
          this.isBlockedByBonePrison(monster.areaId, cx, cy)
        ) {
          break
        }
        destX = cx
        destY = cy
      }
      const from = { x: Math.round(monster.x), y: Math.round(monster.y) }
      monster.x = destX
      monster.y = destY
      this.broadcastToArea(monster.areaId, {
        type: 'UnitMove',
        unitType: 'monster',
        id: monster.unitId,
        unitId: monster.unitId,
        mode: 'run',
        from,
        to: { x: Math.round(destX), y: Math.round(destY) },
        x: Math.round(destX),
        y: Math.round(destY),
        currentX: Math.round(destX),
        currentY: Math.round(destY),
        targetX: Math.round(destX),
        targetY: Math.round(destY),
        areaId: monster.areaId,
      })
      if (Math.hypot(nearest.x - monster.x, nearest.y - monster.y) <= 3.8) {
        // 1.13c `#198 DiabRun` (`SrvDo103` `0x6FCD3F10`, `ResultFlags = 5`, `Skills.txt #198` `MinDam=17+9*(slvl-1)`, `MaxDam=33+9*(slvl-1)`, #1994, #2006):
        // Auto-hits vs Defense (`ResultFlags & 1`) while still rolling Shield Block (`unblockable: false`).
        const diabRunSkill = this.registry.getSkillById(198)
        let flatMin = 17 + 9 * Math.max(0, slvl - 1)
        let flatMax = 33 + 9 * Math.max(0, slvl - 1)
        if (diabRunSkill !== undefined) {
          const statList = new UnitStatList(this.registry, undefined, { ownerType: 'monster' })
          statList.setBaseStat('level', slvl)
          const runEval = evaluateSkill113c({
            registry: this.registry,
            skill: diabRunSkill,
            slvl,
            blvl: slvl,
            statList,
            difficulty: diffIdx,
          })
          if (runEval.maxPhysDmg > 0) {
            flatMin = runEval.minPhysDmg
            flatMax = runEval.maxPhysDmg
          }
        }
        const chargeMin = monster.minDmg + flatMin
        const chargeMax = Math.max(chargeMin, monster.maxDmg + flatMax)
        this.executeMonsterMeleeSkillStrike113c(monster, nearest, {
          skillId: 198,
          minDmg: chargeMin,
          maxDmg: chargeMax,
          autoHit: true,
          unblockable: false,
          knockbackSteps: 3,
        })
      }
      monster.cooldown = Math.max(12, monster.cooldownTicks)
      monster.skillCooldown = 25
      return
    }

    // Bone Prison (`#199 DiabPrison`) around ranged player target (`dist >= 4.5`).
    if (slot === 6 && nearest.kind === 'player' && dist >= 4.5 && dist <= 26) {
      const playerAlreadyCaged = [...this.monsters.values()].some(
        (m) =>
          !m.dead &&
          m.areaId === monster.areaId &&
          isBonePrisonMonsterHcIdx113c(m.hcIdx) &&
          Math.hypot(m.x - nearest.x, m.y - nearest.y) <= 4.5,
      )
      if (!playerAlreadyCaged) {
        const prisonSlvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, 199, diffIdx, 4)
        this.spawnDiabloBonePrisonRing113c(monster, nearest.x, nearest.y, prisonSlvl)
        monster.cooldown = Math.max(12, monster.cooldownTicks)
        monster.skillCooldown = 50
        return
      }
    }

    // `#193 DiabLight` (Red Lightning Hose, 40 frames; NM/Hell blind spot `startOffset = 5.5` sub-tiles).
    if (slot === 0) {
      const slvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, 193, diffIdx, 3)
      const angle = Math.atan2(nearest.y - monster.y, nearest.x - monster.x)
      this.emitBossSkillCast113c(monster, 193, slvl, 8, nearest.x, nearest.y)
      monster.activeBossChannel = {
        kind: 'diablight',
        skillId: 193,
        slvl,
        remainingFrames: 40,
        angle,
        targetX: nearest.x,
        targetY: nearest.y,
        startOffset: this.difficulty >= 1 ? 5.5 : 0,
        nextHitFrames: new Map(),
      }
      monster.cooldown = 44
      monster.skillCooldown = 44
      return
    }

    // `#195 DiabFire` (32-bolt 360° radial Fire Nova, `diabfire` #176, `HitShift=8`, `nextHit=true, nextDelay=4`).
    if (slot === 1) {
      const slvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, 195, diffIdx, 5)
      this.emitBossSkillCast113c(monster, 195, slvl, 8, nearest.x, nearest.y)
      const fireNovaRec = this.registry.getMissileById(176)
      for (let i = 0; i < 32; i++) {
        const theta = (i / 32) * Math.PI * 2
        const fireEval =
          fireNovaRec !== undefined
            ? evaluateMonsterMissileDamage113c({
                registry: this.registry,
                missile: fireNovaRec,
                slvl,
                difficulty: diffIdx,
                monsterMinPhys: 0,
                monsterMaxPhys: 0,
                rng: this.rng,
              })
            : undefined
        const fireDmg =
          fireEval !== undefined && fireEval.elemDamage > 0
            ? fireEval.elemDamage
            : this.rollInclusive(20, 50) + 8 * Math.max(0, slvl - 1)
        this.emitBossProjectile113c(monster, {
          missileId: 176,
          skillId: 195,
          slvl,
          originX: monster.x,
          originY: monster.y,
          targetX: monster.x + Math.cos(theta) * 28,
          targetY: monster.y + Math.sin(theta) * 28,
          speedSubTilesPerFrame: 30 / 16,
          rangeFrames: 50,
          size: 2,
          pierce: true,
          nextHit: true,
          nextDelay: 4,
          element: 'fire',
          physDamage: 0,
          elemDamage: fireDmg,
        })
      }
      monster.cooldown = Math.max(12, monster.cooldownTicks)
      monster.skillCooldown = 25
      return
    }

    // `#197 DiabWall` (Firestorm: diverging `diabwallmaker` #179 / `diabwall` #180 `HitShift = 3` fire + phys ground streams).
    if (slot === 2) {
      const slvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, 197, diffIdx, 3)
      this.emitBossSkillCast113c(monster, 197, slvl, 10, nearest.x, nearest.y)
      const baseAngle = Math.atan2(nearest.y - monster.y, nearest.x - monster.x)
      const tongues = Math.min(5, Math.max(3, slvl))
      const wallRec = this.registry.getMissileById(180)
      for (let t = 0; t < tongues; t++) {
        const spread = (t - (tongues - 1) / 2) * 0.22
        const ang = baseAngle + spread
        const wallEval =
          wallRec !== undefined
            ? evaluateMonsterMissileDamage113c({
                registry: this.registry,
                missile: wallRec,
                slvl,
                difficulty: diffIdx,
                monsterMinPhys: 0,
                monsterMaxPhys: 0,
                rng: this.rng,
              })
            : undefined
        const wallPhys =
          wallEval !== undefined && wallEval.physDamage > 0
            ? wallEval.physDamage
            : Math.max(1, ((this.rollInclusive(4, 12) + 2 * Math.max(0, slvl - 1)) << 3) >> 8)
        const wallFire =
          wallEval !== undefined && wallEval.elemDamage > 0
            ? wallEval.elemDamage
            : Math.max(1, ((this.rollInclusive(12, 25) + 5 * Math.max(0, slvl - 1)) << 3) >> 8)
        this.emitBossProjectile113c(monster, {
          missileId: 180,
          skillId: 197,
          slvl,
          originX: monster.x + Math.cos(ang) * 1.5,
          originY: monster.y + Math.sin(ang) * 1.5,
          targetX: monster.x + Math.cos(ang) * 18,
          targetY: monster.y + Math.sin(ang) * 18,
          speedSubTilesPerFrame: 20 / 16,
          rangeFrames: 24,
          size: 2,
          collideType: 8,
          pierce: true,
          nextHit: true,
          nextDelay: 1,
          element: 'fire',
          physDamage: wallPhys,
          elemDamage: wallFire,
        })
      }
      monster.cooldown = Math.max(12, monster.cooldownTicks)
      monster.skillCooldown = 24
      return
    }

    // `#188 PrimeFirewall` (`SKILLS_SrvDo024_FireWall` `0x6FC637D0`, #1999):
    // 2 perpendicular `#130 vampirefirewallmaker` makers from `(Xt, Yt)` + 1 center `#131 vampirefirewall`.
    {
      const slvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, 188, diffIdx, 8)
      this.emitBossSkillCast113c(monster, 188, slvl, 10, nearest.x, nearest.y)
      const makerRow = this.registry.getMissileById(130)
      const patchRow = this.registry.getMissileById(131)
      if (makerRow !== undefined && patchRow !== undefined) {
        let dX = monster.x - nearest.x
        let dY = monster.y - nearest.y
        if (dX === 0 && dY === 0) dX = 1
        const commonOpts = {
          skillLevel: slvl,
          physDamage: 0,
          elemDamage: 0,
          element: 'fire' as const,
          fromX: nearest.x,
          fromY: nearest.y,
          skipMultishot: true,
        }
        this.spawnMonsterMissile(monster, nearest.x - dY, nearest.y + dX, 0, makerRow.id, 188, {
          ...commonOpts,
          missile: makerRow,
        })
        this.spawnMonsterMissile(monster, nearest.x + dY, nearest.y - dX, 0, makerRow.id, 188, {
          ...commonOpts,
          missile: makerRow,
        })
        this.spawnMonsterMissile(monster, nearest.x, nearest.y, 0, patchRow.id, 188, {
          ...commonOpts,
          missile: patchRow,
        })
      } else {
        const baseAngle = Math.atan2(nearest.y - monster.y, nearest.x - monster.x)
        const perpX = -Math.sin(baseAngle)
        const perpY = Math.cos(baseAngle)
        const groundFire256 = {
          min: (2 + 2 * Math.max(0, slvl - 1)) << 2,
          max: (3 + 2 * Math.max(0, slvl - 1)) << 2,
        }
        for (let k = -3; k <= 3; k++) {
          const px = nearest.x + perpX * k * 1.5
          const py = nearest.y + perpY * k * 1.5
          this.emitBossProjectile113c(monster, {
            missileId: 131,
            skillId: 188,
            slvl,
            originX: px,
            originY: py,
            targetX: px,
            targetY: py,
            speedSubTilesPerFrame: 0,
            rangeFrames: 90,
            size: 2,
            collideType: 3,
            pierce: true,
            element: 'fire',
            physDamage: 0,
            elemDamage: 0,
            groundFire256,
          })
        }
      }
      monster.cooldown = Math.max(12, monster.cooldownTicks)
      monster.skillCooldown = 28
      return
    }
  }

  if (dist <= 3.5) {
    if (
      monster.cooldown <= 0 &&
      monster.pendingAttack === undefined &&
      monster.pendingAllyAttack === undefined
    ) {
      monster.cooldown = monster.cooldownTicks
      if (nearest.kind === 'player') {
        this.beginMonsterMeleeAttack(monster, nearest.player)
      } else if (nearest.kind === 'merc') {
        this.beginMonsterMeleeAttackOnAlly(monster, { kind: 'merc', id: nearest.merc.unitId })
      } else {
        this.beginMonsterMeleeAttackOnAlly(monster, { kind: 'pet', id: nearest.pet.uid })
      }
    }
  } else {
    this.moveMonsterToward(monster, nearest.x, nearest.y, dist > 5)
  }
}



/**
 * 1.13c `AITHINK_Fn135_BaalCrab` (`0x6FCCCBE0`) & `Fn137_BaalCrabClone` (`0x6FCCCA40`)
 * (`#544 baalcrab`, `#570 baalclone` Vile Effigy, `#709 uberbaal`, #1826).
 */
function stepBaalCrabBossAi113c(this: GameInstanceHost, monster: InternalMonsterRecord): void {
  const isClone = monster.hcIdx === 570
  const isUber = monster.hcIdx === 709
  const diffIdx: 0 | 1 | 2 = this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0

  if (isUber && !monster.states.has(20)) {
    const armorSlvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, 60, diffIdx, 15)
    this.applyMonsterState(monster.unitId, 20, 3600)
    this.emitBossSkillCast113c(monster, 60, armorSlvl, 8, monster.x, monster.y)
    monster.cooldown = Math.max(8, monster.cooldownTicks)
    return
  }

  if (monster.activeBaalCloneUnitId !== 0) {
    const existingClone = this.monsters.get(monster.activeBaalCloneUnitId)
    if (existingClone === undefined || existingClone.dead) {
      monster.activeBaalCloneUnitId = 0
    }
  }

  const nearest = this.nearestHostileForMonster(monster, Math.max(35, monster.aggroRadius))
  if (nearest === null) return
  const dist = Math.hypot(nearest.x - monster.x, nearest.y - monster.y)

  if (isUber && this.trySpawnUberPrimeMinion113c(monster, nearest)) {
    return
  }

  if (monster.cooldown <= 0 && monster.skillCooldown <= 0) {
    const slot = monster.skillCursor % 6
    monster.skillCursor = (monster.skillCursor + 1) % 6

    // 1) Spawn Vile Effigy (`#570 baalclone`): ONLY real `#544 baalcrab` (`!isClone && !isUber`), max 1 active, up to 2 per fight!
    if (
      !isClone &&
      !isUber &&
      monster.activeBaalCloneUnitId === 0 &&
      monster.baalCloneSpawnCount < 2 &&
      slot === 0
    ) {
      let cx = nearest.x + 3
      let cy = nearest.y + 3
      for (const ang of [0.6, -0.6, 1.4, -1.4, 2.4, -2.4, Math.PI]) {
        const tx = nearest.x + Math.cos(ang) * 4
        const ty = nearest.y + Math.sin(ang) * 4
        if (
          !this.isClosedDoorAt(monster.areaId, Math.round(tx), Math.round(ty)) &&
          (!this.terrainWalkableCheck ||
            this.terrainWalkableCheck(monster.areaId, Math.round(tx), Math.round(ty), false)) &&
          !this.isMonsterCellOccupied(monster, tx, ty)
        ) {
          cx = tx
          cy = ty
          break
        }
      }
      const cloneSlvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, 331, diffIdx, 1)
      this.emitBossSkillCast113c(monster, 331, cloneSlvl, 8, cx, cy)
      this.broadcastExplosionMissile(monster, 614)
      // `rClone = max(-100, 2 * r - 100)` guarantees `(100 - rClone)/100 = 2 * (100 - r)/100` (exact 2x incoming damage vs real Baal!).
      const doubleVuln = (r: number): number => Math.max(-100, 2 * Math.min(95, r) - 100)
      const cloneId = this.spawnMonster({
        classId: 570,
        hcIdx: 570,
        defId: 'baalclone',
        ai: 'BaalCrabClone',
        x: cx,
        y: cy,
        areaId: monster.areaId,
        level: monster.level,
        hp: Math.max(1, Math.floor(monster.hp / 3)),
        maxHp: Math.max(1, Math.floor(monster.maxHp / 3)),
        experience: 0,
        noRatio: true,
        minDmg: monster.minDmg,
        maxDmg: monster.maxDmg,
        ar: monster.ar,
        ac: monster.ac,
        resistances: {
          phys: doubleVuln(monster.resistances.phys),
          magic: doubleVuln(monster.resistances.magic),
          fire: doubleVuln(monster.resistances.fire),
          light: doubleVuln(monster.resistances.light),
          cold: doubleVuln(monster.resistances.cold),
          poison: doubleVuln(monster.resistances.poison),
        },
        bossUnitId: monster.unitId,
      })
      const cloneRec = this.monsters.get(cloneId)
      if (cloneRec !== undefined) {
        cloneRec.despawnAtFrame = this.currentFrame + 750
        cloneRec.skillCursor = 1
      }
      monster.activeBaalCloneUnitId = cloneId
      monster.baalCloneSpawnCount += 1
      monster.cooldown = Math.max(12, monster.cooldownTicks)
      monster.skillCooldown = 40
      return
    }

    // 2) `#315 Baal Tentacle` (`Festering Appendages`): ONLY non-clone Baal (`!isClone`), spawns `2..4` (N) / `3..5` (NM) / `4..6` (H) `baaltentacle1..5` (`#562..566`).
    if (!isClone && slot === 1) {
      const activeTentacles = [...this.monsters.values()].filter(
        (m) => !m.dead && m.bossUnitId === monster.unitId && isBaalTentacleHcIdx113c(m.hcIdx),
      ).length
      if (activeTentacles < 8) {
        const count = this.difficulty + 2 + this.rng.rand(3)
        const slvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, 315, diffIdx, 1)
        this.emitBossSkillCast113c(monster, 315, slvl, 9, nearest.x, nearest.y)
        for (let i = 0; i < count; i++) {
          const ang = (i / count) * Math.PI * 2 + (this.rng.rand(10) - 5) * 0.05
          const tx = nearest.x + Math.cos(ang) * (2.2 + (i % 2) * 1.1)
          const ty = nearest.y + Math.sin(ang) * (2.2 + (i % 2) * 1.1)
          if (
            this.terrainWalkableCheck &&
            !this.terrainWalkableCheck(monster.areaId, Math.round(tx), Math.round(ty), false)
          ) {
            continue
          }
          const tHcIdx = 562 + (i % 5)
          const tId = this.spawnMonster({
            classId: tHcIdx,
            hcIdx: tHcIdx,
            defId: `baaltentacle${String((i % 5) + 1)}`,
            ai: 'BaalTentacle',
            x: tx,
            y: ty,
            areaId: monster.areaId,
            level: monster.level,
            experience: 0,
            noRatio: true,
            velocity: 0,
            runSpeed: 0,
            meleeRange: 5,
            bossUnitId: monster.unitId,
          })
          const tRec = this.monsters.get(tId)
          if (tRec !== undefined) {
            tRec.despawnAtFrame = this.currentFrame + 25 * (10 + this.rng.rand(10))
          }
        }
        monster.cooldown = Math.max(12, monster.cooldownTicks)
        monster.skillCooldown = 35
        return
      }
    }

    // 3) `#309 Defense Curse` (`state 113` when `maxHp > maxMana`) vs `#310 Blood Mana` (`state 114` when `maxMana >= maxHp`, #1996).
    if (nearest.kind === 'player' && !nearest.player.states.has(113) && !nearest.player.states.has(114) && slot === 2) {
      const wantBloodMana =
        this.getPlayerAccruedMaxManaFixed(nearest.player) >=
        this.getPlayerAccruedMaxHpFixed(nearest.player)
      const curseSkillId = wantBloodMana ? 310 : 309
      const curseSlvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, curseSkillId, diffIdx, 1)
      this.applyMonsterCurseToTarget113c(
        monster,
        { kind: 'player', player: nearest.player },
        curseSkillId,
        curseSlvl,
      )
      monster.mode = 10
      this.broadcastToArea(monster.areaId, {
        type: 'UnitMode',
        unitType: 1,
        id: monster.unitId,
        mode: 10,
        at: { x: Math.round(nearest.x), y: Math.round(nearest.y) },
        lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
      })
      monster.cooldown = Math.max(12, monster.cooldownTicks)
      monster.skillCooldown = 30
      return
    }

    // 4) `#318 Baal Cold Missiles` (`Hoarfrost` expanding V-wedge + Cold + Chill + 75% Knockback).
    if (slot === 3) {
      const slvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, 318, diffIdx, 1)
      this.emitBossSkillCast113c(monster, 318, slvl, 4, nearest.x, nearest.y)
      const ang = Math.atan2(nearest.y - monster.y, nearest.x - monster.x)
      const cos = Math.cos(ang)
      const sin = Math.sin(ang)
      this.broadcastToArea(monster.areaId, {
        type: 'CreateMissile',
        missileId: this.allocateUnitId(UNIT_TYPE_113C.missile),
        missileClassId: 589,
        at: { x: Math.round(monster.x), y: Math.round(monster.y) },
        target: { x: Math.round(nearest.x), y: Math.round(nearest.y) },
        x: Math.round(monster.x),
        y: Math.round(monster.y),
        targetX: Math.round(nearest.x),
        targetY: Math.round(nearest.y),
        skillId: 318,
        level: slvl,
        ownerType: 1,
        ownerUnitType: 'monster',
        ownerId: monster.unitId,
        sourceUnitId: monster.unitId,
        areaId: monster.areaId,
      } as ServerEvent)
      if (monster.activeHoarfrostWaves === undefined) {
        monster.activeHoarfrostWaves = []
      }
      monster.activeHoarfrostWaves.push({
        x: monster.x + cos * 1.2,
        y: monster.y + sin * 1.2,
        vx: cos * 1.25,
        vy: sin * 1.25,
        perpX: -sin,
        perpY: cos,
        remainingSteps: 15,
        stepDone: 0,
        slvl,
        hitUnits: new Set(),
      })
      monster.cooldown = Math.max(12, monster.cooldownTicks)
      monster.skillCooldown = 26
      return
    }

    // 5) `#317 Baal Inferno` (`Mana Rift` 20-frame Magic beam + 50% current Mana drain).
    if (slot === 4 && dist <= 18) {
      const slvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, 317, diffIdx, 1)
      const ang = Math.atan2(nearest.y - monster.y, nearest.x - monster.x)
      this.emitBossSkillCast113c(monster, 317, slvl, 14, nearest.x, nearest.y)
      monster.activeBossChannel = {
        kind: 'baalinferno',
        skillId: 317,
        slvl,
        remainingFrames: 20,
        angle: ang,
        targetX: nearest.x,
        targetY: nearest.y,
        startOffset: 0.5,
        nextHitFrames: new Map(),
      }
      monster.cooldown = 24
      monster.skillCooldown = 28
      return
    }

    // 6) `#329 Baal Teleport` (`#331` on clone): closes distance TOWARD target when `dist >= 8` (`0x6FCCCBE0`).
    if (dist >= 8) {
      const tpSkillId = isClone ? 331 : 329
      const slvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, tpSkillId, diffIdx, 1)
      const ang = Math.atan2(nearest.y - monster.x + monster.x - monster.y, nearest.x - monster.x)
      const targetAng = Math.atan2(nearest.y - monster.y, nearest.x - monster.x)
      void ang
      let chosen: { x: number; y: number } | undefined
      for (const standOff of [2.5, 3.5, 4.5]) {
        for (const spread of [0, 0.5, -0.5, 1.0, -1.0]) {
          const tx = nearest.x - Math.cos(targetAng + spread) * standOff
          const ty = nearest.y - Math.sin(targetAng + spread) * standOff
          if (Math.hypot(nearest.x - tx, nearest.y - ty) >= dist) continue
          if (
            !this.isClosedDoorAt(monster.areaId, Math.round(tx), Math.round(ty)) &&
            (!this.terrainWalkableCheck ||
              this.terrainWalkableCheck(monster.areaId, Math.round(tx), Math.round(ty), false)) &&
            !this.isMonsterCellOccupied(monster, tx, ty)
          ) {
            chosen = { x: tx, y: ty }
            break
          }
        }
        if (chosen !== undefined) break
      }
      if (chosen !== undefined) {
        const from = { x: Math.round(monster.x), y: Math.round(monster.y) }
        this.broadcastExplosionMissile(monster, 613)
        monster.x = chosen.x
        monster.y = chosen.y
        monster.path = []
        monster.pathIndex = 0
        monster.pathTargetX = Number.NaN
        monster.pathTargetY = Number.NaN
        this.emitBossSkillCast113c(monster, tpSkillId, slvl, 8, chosen.x, chosen.y)
        this.broadcastExplosionMissile(monster, 613)
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMove',
          unitType: 'monster',
          id: monster.unitId,
          unitId: monster.unitId,
          mode: 'run',
          from,
          to: { x: Math.round(chosen.x), y: Math.round(chosen.y) },
          x: Math.round(chosen.x),
          y: Math.round(chosen.y),
          currentX: Math.round(chosen.x),
          currentY: Math.round(chosen.y),
          targetX: Math.round(chosen.x),
          targetY: Math.round(chosen.y),
          areaId: monster.areaId,
        })
        monster.cooldown = Math.max(10, monster.cooldownTicks)
        monster.skillCooldown = 25
        return
      }
    }

    // 7) `#316 Baal Nova` (`Incineration Nova` — 32 radial `baal nova` #555 fire bolts, `nextHit=true, nextDelay=4`).
    {
      const slvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, 316, diffIdx, 1)
      this.emitBossSkillCast113c(monster, 316, slvl, 10, nearest.x, nearest.y)
      const novaRec = this.registry.getMissileById(555)
      for (let i = 0; i < 32; i++) {
        const theta = (i / 32) * Math.PI * 2
        const novaEval =
          novaRec !== undefined
            ? evaluateMonsterMissileDamage113c({
                registry: this.registry,
                missile: novaRec,
                slvl,
                difficulty: diffIdx,
                monsterMinPhys: 0,
                monsterMaxPhys: 0,
                rng: this.rng,
              })
            : undefined
        const novaFire =
          novaEval !== undefined && novaEval.elemDamage > 0
            ? novaEval.elemDamage
            : this.rollInclusive(
                compute5BandScaling(slvl, 50, 24, 32, 32, 32, 32),
                compute5BandScaling(slvl, 75, 24, 32, 32, 32, 32),
              )
        this.emitBossProjectile113c(monster, {
          missileId: 555,
          skillId: 316,
          slvl,
          originX: monster.x,
          originY: monster.y,
          targetX: monster.x + Math.cos(theta) * 26,
          targetY: monster.y + Math.sin(theta) * 26,
          speedSubTilesPerFrame: 20 / 16,
          rangeFrames: 40,
          size: 2,
          pierce: true,
          nextHit: true,
          nextDelay: 4,
          element: 'fire',
          physDamage: 0,
          elemDamage: novaFire,
        })
      }
      monster.cooldown = Math.max(12, monster.cooldownTicks)
      monster.skillCooldown = 26
      return
    }
  }

  if (dist <= 3.5) {
    if (
      monster.cooldown <= 0 &&
      monster.pendingAttack === undefined &&
      monster.pendingAllyAttack === undefined
    ) {
      monster.cooldown = monster.cooldownTicks
      if (nearest.kind === 'player') {
        this.beginMonsterMeleeAttack(monster, nearest.player)
      } else if (nearest.kind === 'merc') {
        this.beginMonsterMeleeAttackOnAlly(monster, { kind: 'merc', id: nearest.merc.unitId })
      } else {
        this.beginMonsterMeleeAttackOnAlly(monster, { kind: 'pet', id: nearest.pet.uid })
      }
    }
  } else {
    this.moveMonsterToward(monster, nearest.x, nearest.y, dist > 5)
  }
}



/**
 * 1.13c Pandemonium Finale (`D2Game.dll` `0x6FD0AA30..0x6FD0AB09`, #1841):
 * Records killed Uber Prime Evils (`#704`, `#705`, `#709`) in Area `136`. Only when all three
 * have been killed and none remain alive does the last boss drop `Hellfire Torch` (`cm2` unique `id=400`,
 * `ilvl=110`) + `max(1, players.size)` × `Standard of Heroes` (`std`, `ilvl=90`) and despawn all
 * remaining summoned Uber Tristram minions.
 */
function handleUberTristramBossKilled113c(this: GameInstanceHost, monster: InternalMonsterRecord): void {
  this.uberTristramKilledBosses.add(monster.hcIdx)
  const hasLivingUberPrime = [...this.monsters.values()].some(
    (m) =>
      m.unitId !== monster.unitId &&
      !m.dead &&
      m.areaId === PANDEMONIUM_FINALE_AREA_ID_113C &&
      UBER_PRIME_EVIL_SET_113C.has(m.hcIdx),
  )
  if (
    !this.uberTristramRewardDropped &&
    this.uberTristramKilledBosses.size >= 3 &&
    !hasLivingUberPrime
  ) {
    this.uberTristramRewardDropped = true
    const finaleDrops = createPandemoniumFinaleDrops113c({
      dropTables: getEmbeddedDropTables(),
      nextSeed: () => this.rng.rand(0x7fffffff) || 1,
      activePlayerCount: Math.max(1, this.players.size),
      spawnedUniqueIds: this.spawnedUniqueIds,
    })
    if (finaleDrops.length > 0) {
      monster.pendingDropItems = finaleDrops
      monster.pendingDropFrame = this.currentFrame + this.monsterDeathDropDelayFrames(monster)
    }
    for (const other of [...this.monsters.values()]) {
      if (
        !other.dead &&
        other.areaId === PANDEMONIUM_FINALE_AREA_ID_113C &&
        other.isUberSummonedMinion
      ) {
        this.despawnTemporaryMonsterUnit113c(other)
      }
    }
  }
}



/**
 * 1.13c Uber Prime Evil Minion Spawner (`D2Game.dll` `0x6FD0A730..0x6FD0AA30` & `0x6FCD0C40`, #1841):
 * - `#704 ubermephisto`: `#725..730` undead warriors/archers/mages (`cap = 15` together / `30` isolated).
 * - `#705 uberdiablo`: `#712 megademon6` Pit Lords (`cap = 4` together / `10` isolated).
 * - `#709 uberbaal`: `#732 wraith9` Specters & `#731 vampire9` Dark Lords (`cap = 7` together / `15` isolated).
 * All summoned Uber minions have `experience: 0` and `isUberSummonedMinion: true` (zero drops).
 */
function trySpawnUberPrimeMinion113c(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  target: { readonly x: number; readonly y: number },
): boolean {
  if (monster.cooldown > 0 || this.currentFrame < monster.uberSummonNextFrame) return false
  const spec = UBER_PRIME_MINION_SPECS_113C[monster.hcIdx]
  if (!spec || spec.pool.length === 0) return false

  const livingPrimes = [...this.monsters.values()].filter(
    (m) => !m.dead && m.areaId === monster.areaId && UBER_PRIME_EVIL_SET_113C.has(m.hcIdx),
  )
  const cap = computeUberPrimeMinionCap113c(
    monster.hcIdx,
    monster.unitId,
    monster.x,
    monster.y,
    livingPrimes,
  )
  const activeOwned = [...this.monsters.values()].filter(
    (m) =>
      !m.dead &&
      m.areaId === monster.areaId &&
      m.isUberSummonedMinion &&
      m.bossUnitId === monster.unitId,
  ).length
  if (activeOwned >= cap) return false

  const minionHcIdx = spec.pool[this.rng.rand(spec.pool.length)]!
  let spawnDest: { x: number; y: number } | undefined
  const baseAng = (this.rng.rand(360) * Math.PI) / 180
  for (const anchor of [target, monster]) {
    for (let k = 0; k < 8; k++) {
      const ang = baseAng + (k * Math.PI) / 4
      const sx = anchor.x + Math.cos(ang) * 3
      const sy = anchor.y + Math.sin(ang) * 3
      if (
        !this.isClosedDoorAt(monster.areaId, Math.round(sx), Math.round(sy)) &&
        (!this.terrainWalkableCheck ||
          this.terrainWalkableCheck(monster.areaId, Math.round(sx), Math.round(sy), false)) &&
        !this.isMonsterCellOccupied(monster, sx, sy)
      ) {
        spawnDest = { x: sx, y: sy }
        break
      }
    }
    if (spawnDest !== undefined) break
  }
  if (spawnDest === undefined) return false

  this.emitBossSkillCast113c(monster, spec.summonSkillId, 10, 8, spawnDest.x, spawnDest.y)
  const minionRow = MONSTATS_113C_ROWS[minionHcIdx]
  this.spawnMonster({
    classId: minionHcIdx,
    hcIdx: minionHcIdx,
    ...(minionRow ? { defId: minionRow.id } : {}),
    x: spawnDest.x,
    y: spawnDest.y,
    areaId: monster.areaId,
    experience: 0,
    bossUnitId: monster.unitId,
    isUberSummonedMinion: true,
  })
  monster.uberSummonNextFrame = this.currentFrame + spec.cooldownFrames
  monster.cooldown = Math.max(8, monster.cooldownTicks)
  return true
}



/**
 * 1.13c `AITHINK_Fn050_Mephisto` (`0x6FCA5B60`, `#242 mephisto`) & `AITHINK_Fn146_UberMephisto`
 * (`0x6FC9B4E0`, `#704 ubermephisto`, #1841, #2006, #2008):
 * - Normal (`difficulty === 0`, `#242`): casts ONLY `#334 MephistoMissile` (`#276`), `#185 PrimeLightning` (`#170`),
 *   `#186 PrimeBolt` (`slvl + 2` fanned `#56` bolts), and `#192 PrimePoisonNova` (`#118` 16-bolt ring).
 * - Nightmare/Hell (`difficulty > 0`) & Uber (`#704`): unlocks `#346 MephFrostNova` (`0x6FCA5F1C`, `dist < 15`,
 *   radial `#679` cold ring + chill) and `#59 Blizzard` (`0x6FCA5ED1`, forced on `!hasMissileLos` "Moat Trick" or
 *   `dist > 30`, spawning `#158 blizzardcenter` -> `#159 blizzard1` shards over `100` frames).
 * - `#704 ubermephisto` radiates innate level 20 `Conviction` (`#123`) and summons `#725..730` undead.
 */
function stepUberMephistoBossAi113c(this: GameInstanceHost, monster: InternalMonsterRecord): void {
  const isUber = monster.hcIdx === 704
  const diffIdx: 0 | 1 | 2 = this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0
  const canCastNmHellSpells = diffIdx > 0 || isUber
  const nearest = this.nearestHostileForMonster(monster, Math.max(35, monster.aggroRadius))
  if (nearest === null) return
  const dist = Math.hypot(nearest.x - monster.x, nearest.y - monster.y)

  if (isUber && this.trySpawnUberPrimeMinion113c(monster, nearest)) {
    return
  }

  if (monster.cooldown <= 0 && monster.skillCooldown <= 0) {
    const slot = monster.skillCursor % 6
    monster.skillCursor = (monster.skillCursor + 1) % 6

    let hasMissileLos = true
    if (this.terrainWalkableCheck !== undefined && dist > 1) {
      const steps = Math.max(1, Math.ceil(dist))
      for (let s = 1; s < steps; s++) {
        const t = s / steps
        const sx = Math.round(monster.x + (nearest.x - monster.x) * t)
        const sy = Math.round(monster.y + (nearest.y - monster.y) * t)
        if (!this.terrainWalkableCheck(monster.areaId, sx, sy, true)) {
          hasMissileLos = false
          break
        }
      }
    }

    let effectiveSlot = slot
    if (canCastNmHellSpells && (!hasMissileLos || dist > 30)) {
      // 1.13c `0x6FCA5ED1`: NM/Hell/Uber Mephisto casts `#59 Blizzard` whenever missile LoS is blocked
      // (`COLLIDE_MISSILE_BARRIER`, "Moat Trick") or target distance exceeds `30` sub-tiles.
      effectiveSlot = 5
    } else if (slot === 4) {
      // 1.13c `0x6FCA5F1C`: `#346 MephFrostNova` requires `nDifficulty > 0` (or Uber) AND `dist < 15`;
      // otherwise falls back to `#334 MephistoMissile` (never `#59 Blizzard`).
      effectiveSlot = canCastNmHellSpells && dist < 15 ? 4 : 0
    } else if (slot === 5) {
      // 1.13c `0x6FCA5ED1`: Normal Mephisto never casts `#59 Blizzard` (routes to `#185 PrimeLightning`).
      effectiveSlot = canCastNmHellSpells ? 5 : 1
    }

    // `#346 MephFrostNova` when target is within 15 sub-tiles in NM/Hell/Uber (`SKILLS_SrvDo022_NovaAttack` `0x6FC63AA0` ->
    // `SKILLS_SpawnNovaRing` `0x6FCC2800`: radial `mephfrostnova` `#679` bolts ONLY, `nextHit=true, nextDelay=4`
    // single-hit `STATE_JUSTHIT` gating — zero synchronous direct-hit AoE double damage, #2006, #2008).
    if (effectiveSlot === 4) {
      const slvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, 346, diffIdx, 1)
      this.emitBossSkillCast113c(monster, 346, slvl, 8, monster.x, monster.y)
      const frostRec = this.registry.getMissileById(679)
      for (let i = 0; i < 16; i++) {
        const theta = (i / 16) * Math.PI * 2
        const frostEval =
          frostRec !== undefined
            ? evaluateMonsterMissileDamage113c({
                registry: this.registry,
                missile: frostRec,
                slvl,
                difficulty: diffIdx,
                monsterMinPhys: 0,
                monsterMaxPhys: 0,
                rng: this.rng,
              })
            : undefined
        const coldDmg =
          frostEval !== undefined && frostEval.elemDamage > 0
            ? frostEval.elemDamage
            : this.rollInclusive(
                40 + 20 * Math.max(0, slvl - 1),
                60 + 20 * Math.max(0, slvl - 1),
              )
        const chillFrames =
          frostEval !== undefined && frostEval.elemDurationFrames > 0
            ? frostEval.elemDurationFrames
            : 200 + 50 * Math.max(0, slvl - 1)
        this.emitBossProjectile113c(monster, {
          missileId: 679,
          skillId: 346,
          slvl,
          originX: monster.x,
          originY: monster.y,
          targetX: monster.x + Math.cos(theta) * 12,
          targetY: monster.y + Math.sin(theta) * 12,
          speedSubTilesPerFrame: 20 / 16,
          rangeFrames: 18,
          size: 2,
          pierce: true,
          nextHit: true,
          nextDelay: 4,
          element: 'cold',
          physDamage: 0,
          elemDamage: coldDmg,
          elemDurationFrames: chillFrames,
        })
      }
      const fcrDiv = 100 + monster.monProps.fcrPct
      monster.cooldown = Math.max(6, Math.floor((Math.max(12, monster.cooldownTicks) * 100) / fcrDiv))
      monster.skillCooldown = Math.max(6, Math.floor((24 * 100) / fcrDiv))
      return
    }

    // `#334 MephistoMissile` (icy skull orb `#276 mephisto`: `Sk4lvl = 5`, `HitShift = 8` cold + physical impact + chill, #2006).
    if (effectiveSlot === 0) {
      const slvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, 334, diffIdx, 5)
      this.emitBossSkillCast113c(monster, 334, slvl, 8, nearest.x, nearest.y)
      const skullRec = this.registry.getMissileById(276)
      const skullEval =
        skullRec !== undefined
          ? evaluateMonsterMissileDamage113c({
              registry: this.registry,
              missile: skullRec,
              slvl,
              difficulty: diffIdx,
              monsterMinPhys: 0,
              monsterMaxPhys: 0,
              rng: this.rng,
            })
          : undefined
      const skullPhys =
        skullEval !== undefined && skullEval.physDamage > 0
          ? skullEval.physDamage
          : this.rollInclusive(
              compute5BandScaling(slvl, 12, 8, 10, 12, 12, 12),
              compute5BandScaling(slvl, 16, 8, 10, 12, 12, 12),
            )
      const skullCold =
        skullEval !== undefined && skullEval.elemDamage > 0
          ? skullEval.elemDamage
          : this.rollInclusive(
              compute5BandScaling(slvl, 12, 18, 24, 24, 24, 24),
              compute5BandScaling(slvl, 18, 20, 28, 28, 28, 28),
            )
      const skullChill =
        skullEval !== undefined && skullEval.elemDurationFrames > 0
          ? skullEval.elemDurationFrames
          : 75 + 25 * Math.max(0, slvl - 1)
      this.emitBossProjectile113c(monster, {
        missileId: 276,
        skillId: 334,
        slvl,
        originX: monster.x,
        originY: monster.y,
        targetX: nearest.x,
        targetY: nearest.y,
        speedSubTilesPerFrame: 22 / 16,
        rangeFrames: 38,
        size: 2,
        element: 'cold',
        physDamage: skullPhys,
        elemDamage: skullCold,
        elemDurationFrames: skullChill,
      })
      const fcrDiv = 100 + monster.monProps.fcrPct
      monster.cooldown = Math.max(6, Math.floor((Math.max(10, monster.cooldownTicks) * 100) / fcrDiv))
      monster.skillCooldown = Math.max(6, Math.floor((20 * 100) / fcrDiv))
      return
    }

    // `#185 PrimeLightning` (`Sk1lvl = 6`, `#170 monsterlight` on `#242` / `#680 mephlight` on `#704`,
    // `Vel = 30`, `Range = 25`, `CollideKill = 1` non-piercing bolt — terminates on first unit hit, #2006, #2008).
    if (effectiveSlot === 1) {
      const slvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, 185, diffIdx, 6)
      this.emitBossSkillCast113c(monster, 185, slvl, 8, nearest.x, nearest.y)
      const ltngMissileId = isUber ? 680 : 170
      const ltngRec = this.registry.getMissileById(ltngMissileId) ?? this.registry.getMissileById(680)
      const ltngEval =
        ltngRec !== undefined
          ? evaluateMonsterMissileDamage113c({
              registry: this.registry,
              missile: ltngRec,
              slvl,
              difficulty: diffIdx,
              monsterMinPhys: 0,
              monsterMaxPhys: 0,
              rng: this.rng,
            })
          : undefined
      const ltngDmg =
        ltngEval !== undefined && ltngEval.elemDamage > 0
          ? ltngEval.elemDamage
          : this.rollInclusive(15, 30 + 30 * Math.max(0, slvl - 1))
      this.emitBossProjectile113c(monster, {
        missileId: ltngMissileId,
        skillId: 185,
        slvl,
        originX: monster.x,
        originY: monster.y,
        targetX: nearest.x,
        targetY: nearest.y,
        speedSubTilesPerFrame: 30 / 16,
        rangeFrames: 25,
        size: 2,
        element: 'ltng',
        physDamage: 0,
        elemDamage: ltngDmg,
      })
      const fcrDiv = 100 + monster.monProps.fcrPct
      monster.cooldown = Math.max(6, Math.floor((Math.max(10, monster.cooldownTicks) * 100) / fcrDiv))
      monster.skillCooldown = Math.max(6, Math.floor((22 * 100) / fcrDiv))
      return
    }

    // `#186 PrimeBolt` (`Sk2lvl = 6` on `#242`, `Sk2lvl = 20` on `#704`; `Skills.txt #186` `calc1 = "lvl+2"` ->
    // `min(24, slvl + 2)` fanned bolts, `srvMissileA = "chargedstrikebolt"` `#215` / `cltMissileA = "chargedbolt"` `#56`, #2006, #2008).
    if (effectiveSlot === 2) {
      const slvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, 186, diffIdx, isUber ? 20 : 6)
      this.emitBossSkillCast113c(monster, 186, slvl, 8, nearest.x, nearest.y)
      const baseAngle = Math.atan2(nearest.y - monster.y, nearest.x - monster.x)
      const boltRec = this.registry.getMissileById(215)
      const boltCount = Math.max(1, Math.min(24, slvl + 2))
      const halfSpan = (boltCount - 1) / 2
      for (let i = 0; i < boltCount; i++) {
        const ang = baseAngle + (i - halfSpan) * 0.22
        const boltEval =
          boltRec !== undefined
            ? evaluateMonsterMissileDamage113c({
                registry: this.registry,
                missile: boltRec,
                slvl,
                difficulty: diffIdx,
                monsterMinPhys: 0,
                monsterMaxPhys: 0,
                rng: this.rng,
              })
            : undefined
        const boltLtng =
          boltEval !== undefined && boltEval.elemDamage > 0
            ? boltEval.elemDamage
            : this.rollInclusive(1, compute5BandScaling(slvl, 30, 12, 16, 20, 24, 28))
        this.emitBossProjectile113c(monster, {
          missileId: 56,
          skillId: 186,
          slvl,
          originX: monster.x,
          originY: monster.y,
          targetX: monster.x + Math.cos(ang) * 22,
          targetY: monster.y + Math.sin(ang) * 22,
          speedSubTilesPerFrame: 12 / 16,
          rangeFrames: 40,
          size: 1,
          element: 'ltng',
          physDamage: 0,
          elemDamage: boltLtng,
        })
      }
      const fcrDiv = 100 + monster.monProps.fcrPct
      monster.cooldown = Math.max(6, Math.floor((Math.max(10, monster.cooldownTicks) * 100) / fcrDiv))
      monster.skillCooldown = Math.max(6, Math.floor((22 * 100) / fcrDiv))
      return
    }

    // `#192 PrimePoisonNova` (`Sk3lvl = 7`, `#220 primepoisoncloud` 16-bolt poison ring, #2006).
    if (effectiveSlot === 3) {
      const slvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, 192, diffIdx, 7)
      this.emitBossSkillCast113c(monster, 192, slvl, 8, monster.x, monster.y)
      const novaRec = this.registry.getMissileById(220) ?? this.registry.getMissileById(118)
      const novaEval =
        novaRec !== undefined
          ? evaluateMonsterMissileDamage113c({
              registry: this.registry,
              missile: novaRec,
              slvl,
              difficulty: diffIdx,
              monsterMinPhys: 0,
              monsterMaxPhys: 0,
              rng: this.rng,
            })
          : undefined
      const novaDur =
        novaEval !== undefined && novaEval.elemDurationFrames > 0
          ? novaEval.elemDurationFrames
          : 300 + 20 * Math.max(0, slvl - 1)
      const poisDmg =
        novaEval !== undefined && novaEval.elemDamage > 0
          ? novaEval.elemDamage
          : Math.max(1, Math.round(((10 + 5 * Math.max(0, slvl - 1)) * novaDur) / 256))
      for (let i = 0; i < 16; i++) {
        const theta = (i / 16) * Math.PI * 2
        this.emitBossProjectile113c(monster, {
          missileId: 118,
          skillId: 192,
          slvl,
          originX: monster.x,
          originY: monster.y,
          targetX: monster.x + Math.cos(theta) * 18,
          targetY: monster.y + Math.sin(theta) * 18,
          speedSubTilesPerFrame: 18 / 16,
          rangeFrames: 26,
          size: 2,
          pierce: true,
          nextHit: true,
          nextDelay: 4,
          element: 'pois',
          physDamage: 0,
          elemDamage: poisDmg,
          elemDurationFrames: novaDur,
        })
      }
      const fcrDiv = 100 + monster.monProps.fcrPct
      monster.cooldown = Math.max(6, Math.floor((Math.max(12, monster.cooldownTicks) * 100) / fcrDiv))
      monster.skillCooldown = Math.max(6, Math.floor((26 * 100) / fcrDiv))
      return
    }

    // `#59 Blizzard` (`Sk6lvl = 5`, NM/Hell/Uber only `0x6FCA5ED1`):
    // Spawns `#158 blizzardcenter` (`MISSMODE_SrvDo10_BlizzardCenter` `0x6FC613D0`, `Range = 100`, `CollideType = 0`),
    // which rains 1 `#159 blizzard1` shard (`Range = 9`, `Size = 2`) every 4 frames inside `[-6, +5]` around target (#2008).
    {
      const slvl = resolveMonsterMonStatsSkillSlvl113c(monster.hcIdx, 59, diffIdx, 5)
      this.emitBossSkillCast113c(monster, 59, slvl, 8, nearest.x, nearest.y)
      const centerRec = this.registry.getMissileById(158)
      const blizRec = this.registry.getMissileById(159)
      const blizEval =
        blizRec !== undefined
          ? evaluateMonsterMissileDamage113c({
              registry: this.registry,
              missile: blizRec,
              slvl,
              difficulty: diffIdx,
              monsterMinPhys: 0,
              monsterMaxPhys: 0,
              rng: this.rng,
            })
          : undefined
      const coldDmg =
        blizEval !== undefined && blizEval.elemDamage > 0
          ? blizEval.elemDamage
          : this.rollInclusive(
              compute5BandScaling(slvl, 45, 15, 30, 45, 55, 65),
              compute5BandScaling(slvl, 75, 16, 31, 46, 56, 66),
            )
      const chillFrames =
        blizEval !== undefined && blizEval.elemDurationFrames > 0
          ? blizEval.elemDurationFrames
          : 100
      if (centerRec !== undefined) {
        this.emitBossProjectile113c(monster, {
          missileId: 158,
          skillId: 59,
          slvl,
          originX: nearest.x,
          originY: nearest.y,
          targetX: nearest.x,
          targetY: nearest.y,
          speedSubTilesPerFrame: 0,
          rangeFrames: centerRec.range > 0 ? centerRec.range : 100,
          size: 1,
          collideType: 0,
          element: 'cold',
          physDamage: 0,
          elemDamage: coldDmg,
          elemDurationFrames: chillFrames,
        })
      } else {
        this.emitBossProjectile113c(monster, {
          missileId: 159,
          skillId: 59,
          slvl,
          originX: nearest.x,
          originY: nearest.y,
          targetX: nearest.x,
          targetY: nearest.y,
          speedSubTilesPerFrame: 0,
          rangeFrames: 9,
          size: 2,
          collideType: 3,
          pierce: true,
          element: 'cold',
          physDamage: 0,
          elemDamage: coldDmg,
          elemDurationFrames: chillFrames,
        })
      }
      const fcrDiv = 100 + monster.monProps.fcrPct
      monster.cooldown = Math.max(6, Math.floor((Math.max(12, monster.cooldownTicks) * 100) / fcrDiv))
      monster.skillCooldown = Math.max(6, Math.floor((28 * 100) / fcrDiv))
      return
    }
  }

  if (dist <= 3.5) {
    if (
      monster.cooldown <= 0 &&
      monster.pendingAttack === undefined &&
      monster.pendingAllyAttack === undefined
    ) {
      monster.cooldown = monster.cooldownTicks
      if (nearest.kind === 'player') {
        this.beginMonsterMeleeAttack(monster, nearest.player)
      } else if (nearest.kind === 'merc') {
        this.beginMonsterMeleeAttackOnAlly(monster, { kind: 'merc', id: nearest.merc.unitId })
      } else {
        this.beginMonsterMeleeAttackOnAlly(monster, { kind: 'pet', id: nearest.pet.uid })
      }
    }
  } else {
    this.moveMonsterToward(monster, nearest.x, nearest.y, dist > 5)
  }
}



/** Stationary `#562..566 baaltentacle1..5` (`Festering Appendages`, #1826): rooted melee whip within `meleeRange + 1`. */
function stepBaalTentacleAi113c(this: GameInstanceHost, monster: InternalMonsterRecord): void {
  const reach = Math.max(5, monster.meleeRange) + 1
  const nearest = this.nearestHostileForMonster(monster, reach)
  if (
    nearest !== null &&
    monster.cooldown <= 0 &&
    monster.pendingAttack === undefined &&
    monster.pendingAllyAttack === undefined
  ) {
    monster.cooldown = Math.max(8, monster.cooldownTicks)
    if (nearest.kind === 'player') {
      this.beginMonsterMeleeAttack(monster, nearest.player)
    } else if (nearest.kind === 'merc') {
      this.beginMonsterMeleeAttackOnAlly(monster, { kind: 'merc', id: nearest.merc.unitId })
    } else {
      this.beginMonsterMeleeAttackOnAlly(monster, { kind: 'pet', id: nearest.pet.uid })
    }
  }
}



/**
 * 1.13c `AITHINK_Fn133_Ancient` (`D2Game.dll` `0x6FCC9390`, `MonStats.txt` `#540..542` `ancientbarb1..3`, #1827):
 * - `#540 Talic` (`ancientbarb1`): `#151 Whirlwind` (`slvl = 15`), spinning through & `+8` sub-tiles past target.
 * - `#541 Madawc` (`ancientbarb2`): `#138 Shout` (`slvl = 5`, `state 26`, `+140%` Defense on self & nearby allies) + `#140 Double Throw` (`slvl = 12`, dual `#525 ancient throwing axe`).
 * - `#542 Korlic` (`ancientbarb3`): `#143 Leap Attack` (`slvl = 5`, airborne gap-close + `+200%` ED physical impact).
 */
function stepAncientBarbAi113c(this: GameInstanceHost, monster: InternalMonsterRecord): void {
  const nearest = this.nearestHostileForMonster(monster, Math.max(35, monster.aggroRadius))
  if (nearest === null) return
  const dist = Math.hypot(nearest.x - monster.x, nearest.y - monster.y)

  // `#540 Talic` — Whirlwind (`#151`, `slvl = 15`, `aip1 = 15` range, `aip4 = 8` overshoot).
  if (monster.hcIdx === 540) {
    const wwRange = Math.max(8, monster.aiParams[0] || 15)
    const overshoot = Math.max(4, monster.aiParams[3] || 8)
    if (dist <= wwRange && monster.skillCooldown <= 0 && monster.cooldown <= 0) {
      const slvl = 15
      const ang = Math.atan2(nearest.y - monster.y, nearest.x - monster.x)
      const totalDist = Math.min(22, Math.max(6, dist + overshoot))
      const tx = monster.x + Math.cos(ang) * totalDist
      const ty = monster.y + Math.sin(ang) * totalDist
      const frames = Math.max(8, Math.min(28, Math.ceil(totalDist / 0.9)))
      this.emitBossSkillCast113c(monster, 151, slvl, 14, tx, ty)
      monster.activeBossChannel = {
        kind: 'whirlwind',
        skillId: 151,
        slvl,
        remainingFrames: frames,
        angle: ang,
        targetX: tx,
        targetY: ty,
        startOffset: 0,
        stepVx: Math.cos(ang) * 0.9,
        stepVy: Math.sin(ang) * 0.9,
        nextHitFrames: new Map(),
      }
      monster.cooldown = frames + 6
      monster.skillCooldown = frames + 18
      return
    }
  }

  // `#541 Madawc` — Shout (`#138`, `slvl = 5`, `+140%` Defense, `state 26`) + Double Throw (`#140`, `slvl = 12`, `#525 ancient throwing axe`).
  if (monster.hcIdx === 541) {
    const unbuffedAncientNearby = [...this.monsters.values()].some(
      (ally) =>
        !ally.dead &&
        !ally.isNpc &&
        ally.align === monster.align &&
        !this.isMonsterConverted(ally) &&
        ally.areaId === monster.areaId &&
        Math.hypot(ally.x - monster.x, ally.y - monster.y) <= 20 &&
        !ally.states.has(26),
    )
    if (unbuffedAncientNearby && monster.skillCooldown <= 0 && monster.cooldown <= 0) {
      const slvl = 5
      const defPct = 100 + 10 * Math.max(0, slvl - 1) // slvl 5 => +140% Defense
      this.emitBossSkillCast113c(monster, 138, slvl, 8, monster.x, monster.y)
      this.broadcastExplosionMissile(monster, 149) // Missiles.txt #149 `shout`
      for (const ally of this.monsters.values()) {
        if (
          ally.dead ||
          ally.isNpc ||
          ally.align !== monster.align ||
          this.isMonsterConverted(ally) ||
          ally.areaId !== monster.areaId ||
          Math.hypot(ally.x - monster.x, ally.y - monster.y) > 20
        ) {
          continue
        }
        ally.ac = Math.max(ally.baseAcBeforeShout, Math.round(ally.baseAcBeforeShout * (1 + defPct / 100)))
        this.applyUnitState(
          ally.states,
          ally.stateTimers,
          'monster',
          ally.unitId,
          ally.areaId,
          26,
          1500,
        )
      }
      monster.cooldown = Math.max(10, monster.cooldownTicks)
      monster.skillCooldown = 45
      return
    }

    if (dist < 4 && this.rng.rand(100) < 25) {
      const dx = monster.x - nearest.x
      const dy = monster.y - nearest.y
      const d = Math.max(0.5, Math.hypot(dx, dy))
      this.moveMonsterToward(monster, monster.x + (dx / d) * 6, monster.y + (dy / d) * 6, true)
      return
    }

    const throwRange = Math.max(12, monster.aiParams[0] || 18)
    if (dist <= throwRange && monster.cooldown <= 0) {
      const slvl = 12
      this.emitBossSkillCast113c(monster, 140, slvl, 4, nearest.x, nearest.y)
      const baseAng = Math.atan2(nearest.y - monster.y, nearest.x - monster.x)
      const axePhys = Math.max(
        8,
        Math.round(this.rollInclusive(monster.minDmg, monster.maxDmg) * 1.35),
      )
      for (const spread of [-0.07, 0.07] as const) {
        const ang = baseAng + spread
        this.emitBossProjectile113c(monster, {
          missileId: 525, // Missiles.txt #525 `ancient throwing axe`
          skillId: 140,
          slvl,
          originX: monster.x,
          originY: monster.y,
          targetX: monster.x + Math.cos(ang) * Math.max(18, dist + 6),
          targetY: monster.y + Math.sin(ang) * Math.max(18, dist + 6),
          speedSubTilesPerFrame: 24 / 16,
          rangeFrames: 24,
          size: 1,
          pierce: true,
          element: 'phys',
          physDamage: axePhys,
          elemDamage: 0,
        })
      }
      monster.cooldown = Math.max(10, monster.cooldownTicks)
      monster.skillCooldown = 14
      return
    }
  }

  // `#542 Korlic` — Leap Attack (`#143`, `slvl = 5`, `aip1 = 15` range, airborne leap over ground obstacles + `+200%` ED impact).
  if (monster.hcIdx === 542) {
    const leapRange = Math.max(10, monster.aiParams[0] || 15)
    if (dist > 3.0 && dist <= leapRange && monster.skillCooldown <= 0 && monster.cooldown <= 0) {
      const slvl = 5
      const ang = Math.atan2(nearest.y - monster.y, nearest.x - monster.x)
      let landing: { x: number; y: number } | undefined
      for (const standOff of [1.4, 2.0, 2.6]) {
        for (const spread of [0, 0.5, -0.5, 1.0, -1.0]) {
          const lx = nearest.x - Math.cos(ang + spread) * standOff
          const ly = nearest.y - Math.sin(ang + spread) * standOff
          if (
            !this.isClosedDoorAt(monster.areaId, Math.round(lx), Math.round(ly)) &&
            (!this.terrainWalkableCheck ||
              this.terrainWalkableCheck(monster.areaId, Math.round(lx), Math.round(ly), false)) &&
            !this.isMonsterCellOccupied(monster, lx, ly)
          ) {
            landing = { x: lx, y: ly }
            break
          }
        }
        if (landing !== undefined) break
      }
      if (landing !== undefined) {
        const from = { x: Math.round(monster.x), y: Math.round(monster.y) }
        monster.x = landing.x
        monster.y = landing.y
        monster.path = []
        monster.pathIndex = 0
        monster.pathTargetX = Number.NaN
        monster.pathTargetY = Number.NaN
        this.emitBossSkillCast113c(monster, 143, slvl, 14, nearest.x, nearest.y)
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMove',
          unitType: 'monster',
          id: monster.unitId,
          unitId: monster.unitId,
          mode: 'run',
          from,
          to: { x: Math.round(landing.x), y: Math.round(landing.y) },
          x: Math.round(landing.x),
          y: Math.round(landing.y),
          currentX: Math.round(landing.x),
          currentY: Math.round(landing.y),
          targetX: Math.round(landing.x),
          targetY: Math.round(landing.y),
          areaId: monster.areaId,
        })
        // `+100 + 30*(slvl-1)%` = `+220%` (`3.2x`) physical Leap Attack impact with `+50 + 15*(slvl-1)%` AR (#1994)!
        const leapMult = 1 + (100 + 30 * Math.max(0, slvl - 1)) / 100
        const leapMin = Math.max(12, Math.round(monster.minDmg * leapMult))
        const leapMax = Math.max(leapMin, Math.round(monster.maxDmg * leapMult))
        this.executeMonsterMeleeSkillStrike113c(monster, nearest, {
          skillId: 143,
          minDmg: leapMin,
          maxDmg: leapMax,
          arBonusPct: 50 + 15 * Math.max(0, slvl - 1),
          knockbackSteps: 2,
        })
        monster.cooldown = Math.max(12, monster.cooldownTicks)
        monster.skillCooldown = 28
        return
      }
    }
  }

  if (dist <= 3.2) {
    if (
      monster.cooldown <= 0 &&
      monster.pendingAttack === undefined &&
      monster.pendingAllyAttack === undefined
    ) {
      monster.cooldown = monster.cooldownTicks
      if (nearest.kind === 'player') {
        this.beginMonsterMeleeAttack(monster, nearest.player)
      } else if (nearest.kind === 'merc') {
        this.beginMonsterMeleeAttackOnAlly(monster, { kind: 'merc', id: nearest.merc.unitId })
      } else {
        this.beginMonsterMeleeAttackOnAlly(monster, { kind: 'pet', id: nearest.pet.uid })
      }
    }
  } else {
    this.moveMonsterToward(monster, nearest.x, nearest.y, true)
  }
}

export interface BossEncountersAiMethods {
  tryCastMonsterSkill(
    monster: InternalMonsterRecord,
    target: { readonly x: number; readonly y: number },
    distance: number,
    options?: {
      readonly hitMonsters?: boolean | undefined
      readonly forcedSkillId?: number | undefined
    },
  ): boolean
  tryCastMonsterUtilitySkill(monster: InternalMonsterRecord, target: { readonly x: number; readonly y: number }, distance: number, healOrWhipOnly?: boolean | undefined): boolean
  setMonsterSkillCooldown(monster: InternalMonsterRecord, delay: string): void
  monsterSkillMode(mode?: string): number
  despawnTemporaryMonsterUnit113c(monster: InternalMonsterRecord, deathMissileId?: number): void
  despawnBaalMinionsOnBossDeath113c(baal: InternalMonsterRecord): void
  emitBossSkillCast113c(monster: InternalMonsterRecord, skillId: number, slvl: number, mode: number, targetX: number, targetY: number, targetRef?: { readonly unitType: 0 | 1; readonly id: number }): void
  emitBossProjectile113c(monster: InternalMonsterRecord, spec: {
    readonly missileId: number
    readonly skillId: number
    readonly slvl: number
    readonly originX: number
    readonly originY: number
    readonly targetX: number
    readonly targetY: number
    readonly speedSubTilesPerFrame: number
    readonly rangeFrames: number
    readonly size?: number | undefined
    readonly collideType?: number | undefined
    readonly pierce?: boolean | undefined
    readonly nextHit?: boolean | undefined
    readonly nextDelay?: number | undefined
    readonly element: MissileDamageChannel
    readonly physDamage: number
    readonly elemDamage: number
    readonly elemDurationFrames?: number | undefined
    readonly groundFire256?: { readonly min: number; readonly max: number } | undefined
    readonly guaranteedHit?: boolean | undefined
    readonly hitMonsters?: boolean | undefined
  }): number
  knockbackPlayerFromBoss113c(player: InternalPlayerRecord, fromX: number, fromY: number, maxSteps?: number | undefined): boolean
  executeMonsterMeleeSkillStrike113c(monster: InternalMonsterRecord, target: | { readonly kind: 'player'; readonly player: InternalPlayerRecord }
    | { readonly kind: 'merc'; readonly merc: InternalMercenaryRecord }
    | { readonly kind: 'pet'; readonly pet: SummonedPetUnit }, spec: {
    readonly skillId: number
    readonly minDmg: number
    readonly maxDmg: number
    readonly skillMode?: 'A1' | 'A2' | 'S1' | undefined
    readonly arBonusPct?: number | undefined
    readonly autoHit?: boolean | undefined
    readonly unblockable?: boolean | undefined
    readonly stunFrames?: number | undefined
    readonly knockbackSteps?: number | undefined
    readonly knockbackOriginX?: number | undefined
    readonly knockbackOriginY?: number | undefined
  }): boolean
  dealMonsterDirectHitToHostile113c(monster: InternalMonsterRecord, target: | { readonly kind: 'player'; readonly player: InternalPlayerRecord }
    | { readonly kind: 'merc'; readonly merc: InternalMercenaryRecord }
    | { readonly kind: 'pet'; readonly pet: SummonedPetUnit }, parts: {
    readonly phys?: number | undefined
    readonly fire?: number | undefined
    readonly cold?: number | undefined
    readonly light?: number | undefined
    readonly magic?: number | undefined
  }, effects?: {
    readonly chillFrames?: number | undefined
    readonly stunFrames?: number | undefined
    readonly knockbackSteps?: number | undefined
    readonly knockbackOriginX?: number | undefined
    readonly knockbackOriginY?: number | undefined
    readonly skipGetHit?: boolean | undefined
    readonly damageRate?: number | undefined
  }): void
  listHostilesInMonsterArea113c(monster: InternalMonsterRecord): (
  | { readonly kind: 'player'; readonly key: number; readonly x: number; readonly y: number; readonly player: InternalPlayerRecord }
  | { readonly kind: 'merc'; readonly key: number; readonly x: number; readonly y: number; readonly merc: InternalMercenaryRecord }
  | { readonly kind: 'pet'; readonly key: number; readonly x: number; readonly y: number; readonly pet: SummonedPetUnit }
)[]
  stepBossChannelsAndSummonLifespans113c(monster: InternalMonsterRecord): boolean
  spawnDiabloBonePrisonRing113c(diablo: InternalMonsterRecord, cx: number, cy: number, slvl: number): number
  stepDiabloBossAi113c(monster: InternalMonsterRecord): void
  stepBaalCrabBossAi113c(monster: InternalMonsterRecord): void
  handleUberTristramBossKilled113c(monster: InternalMonsterRecord): void
  trySpawnUberPrimeMinion113c(monster: InternalMonsterRecord, target: { readonly x: number; readonly y: number }): boolean
  stepUberMephistoBossAi113c(monster: InternalMonsterRecord): void
  stepBaalTentacleAi113c(monster: InternalMonsterRecord): void
  stepAncientBarbAi113c(monster: InternalMonsterRecord): void
}

export const bossEncountersAiMethods: Record<keyof BossEncountersAiMethods, unknown> = {
  tryCastMonsterSkill,
  tryCastMonsterUtilitySkill,
  setMonsterSkillCooldown,
  monsterSkillMode,
  despawnTemporaryMonsterUnit113c,
  despawnBaalMinionsOnBossDeath113c,
  emitBossSkillCast113c,
  emitBossProjectile113c,
  knockbackPlayerFromBoss113c,
  executeMonsterMeleeSkillStrike113c,
  dealMonsterDirectHitToHostile113c,
  listHostilesInMonsterArea113c,
  stepBossChannelsAndSummonLifespans113c,
  spawnDiabloBonePrisonRing113c,
  stepDiabloBossAi113c,
  stepBaalCrabBossAi113c,
  handleUberTristramBossKilled113c,
  trySpawnUberPrimeMinion113c,
  stepUberMephistoBossAi113c,
  stepBaalTentacleAi113c,
  stepAncientBarbAi113c,
}
