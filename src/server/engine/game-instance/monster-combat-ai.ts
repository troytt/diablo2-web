/**
 * GameInstance Subsystem: Monster Combat/Summon Skill AI, Baal Throne Waves, Submerge AI & stepMonsterAi (`src/server/engine/game-instance/monster-combat-ai.ts`).
 */

import { compute5BandScaling } from '../../../common/data/calc-ast.ts'
import { SEED_RollRandomNumber } from '../../../common/rng/d2-rng.ts'
import { MONMODE_KNOCKBACK } from '../../../common/path/types.ts'
import { QUEST_FLAG_STARTED_113C } from '../quests-113c.ts'
import { isBaalTentacleHcIdx113c, isBonePrisonMonsterHcIdx113c, isFrogDemonHcIdx113c, isNonMeleeMonsterAi113c, isPassiveMonsterAi113c, isTentacleHcIdx113c, isTentacleHeadHcIdx113c, monaiParam113c, normalizeMonAiName113c } from '../../../common/units/monai-113c.ts'
import { MON_UMOD } from '../../../common/units/monster-death-fx.ts'
import { MONSTATS_113C_ROWS } from '../../../common/units/monstats-113c-data.ts'
import type { MonsterSkillEntry } from '../../../common/units/unit-types.ts'
import { BAAL_THRONE_WAVES_113C } from '../../ai/monster-ai.ts'
import { unitsGetMeleeDistance113c } from '../../ai/town-npc-ai-113c.ts'
import { computeMissileElementalLength113c, evaluateMonsterMissileDamage113c, resolveMonsterModeMissileSlvl113c, resolveMonsterRegisteredSkillSlvl113c } from '../../ai/monster-missile-damage-113c.ts'
import type { SummonedPetUnit } from '../../ai/summon-manager.ts'
import { FIXED_ONE } from '../stat-list.ts'
import type { GameInstanceHost } from './host.ts'
import type { InternalMercenaryRecord, InternalMonsterRecord, InternalPlayerRecord } from './types.ts'
import { MONSTER_ACTIVATION_RADIUS_SUBTILES, TOWN_AREAS, monsterCanFireRanged113c, monsterProfile113c, monsterShootRange, normalizeMissileElement, unitsDistanceToCoordinates113c, UNIT_TYPE_113C } from './constants-and-helpers.ts'
import { rollLimitedSeed113c } from './unit-seeds-113c.ts'
import { stepFallenThink113c } from './fallen-ai-113c.ts'


/**
 * 1.13c Non-Missile Monster Combat, Summon, Corpse Explosion & Self-Armor Skill Sweep across all 734 `MonStats.txt` rows (#1827):
 * - `#10 Jab` (Duriel, Uber Duriel, Scarab, CorruptLancer)
 * - `#97 Smite` (Duriel, Uber Duriel, Lister #571, Blunderbore, Overseer)
 * - `#107 Charge` & `#352 SerpentCharge` (Duriel, Uber Duriel, ReanimatedHorde, SiegeBeast, ClawViper)
 * - `#126 Bash` (Smith #402, Hephasto #409), `#156 Fire Hit` (SandRaider), `#301 Siege Beast Stomp`
 * - `#215 MonFrenzy` & `#328 BloodLordFrenzy` (BloodLord, DeathMauler)
 * - `#62 Hydra` (Council #345..347, Bartuc #557) + `#337 HydraMissile` (`hydra1..3` #351..353 -> `#247 hydra`)
 * - `#167 Nest` (Blood Raven #267 -> `zombie2` #6 Hungry Dead, `experience: 0`)
 * - `#351 NihlathakCorpseExplosion` & `#285 Baal Corpse Explode` (Nihlathak #526 -> `10..20%` base corpse HP, 50% Phys + 50% Fire, `state 104`)
 * - `#302 MinionSpawner` (Nihlathak #526, #484..491 -> `minion1` #453, `experience: 0`)
 * - `#330 Imp Teleport` (Nihlathak #526 escape blink & Imp #492..496 reposition)
 * - `#60 Chilling Armor` (`state 20`) & `#210 MonBoneArmor` (`state 14`)
 */
function tryCastMonsterCombatOrSummonSkill113c(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  target: { readonly x: number; readonly y: number },
  distance: number,
  hitMonsters: boolean,
): boolean {
  if (monster.skillCooldown > 0 || monster.skills.length === 0) return false
  const ordered = [...monster.skills].sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
  // 1.13c AITHINK_Fn121_Nihlathak & AITHINK_Fn139_UberIzual:
  // - Nihlathak (#526) within 6 sub-tiles prioritizes `#330 Imp Teleport` escape blink.
  // - Uber Izual (#706) once buffed with `#60 Chilling Armor` (`state 20`) at `distance >= 5` prioritizes `#184 MonTeleport` gap-closer blink.
  const priorityBlinkEntry =
    monster.hcIdx === 526 && distance <= 6
      ? ordered.find((s) => s.skillId === 330)
      : monster.hcIdx === 706 && monster.states.has(20) && distance >= 5
        ? ordered.find((s) => s.skillId === 184)
        : undefined
  const scanOrder =
    priorityBlinkEntry !== undefined
      ? [
          priorityBlinkEntry,
          ...Array.from(
            { length: ordered.length },
            (_, i) => ordered[(monster.skillCursor + i) % ordered.length]!,
          ).filter((s) => s !== priorityBlinkEntry),
        ]
      : Array.from(
          { length: ordered.length },
          (_, i) => ordered[(monster.skillCursor + i) % ordered.length]!,
        )

  let resolvedHostile:
    | { readonly kind: 'player'; readonly player: InternalPlayerRecord }
    | { readonly kind: 'merc'; readonly merc: InternalMercenaryRecord }
    | { readonly kind: 'pet'; readonly pet: SummonedPetUnit }
    | undefined
  if (!hitMonsters) {
    let bestD = 3.5
    for (const h of this.listHostilesInMonsterArea113c(monster)) {
      const d = Math.hypot(h.x - target.x, h.y - target.y)
      if (d <= bestD) {
        bestD = d
        resolvedHostile = h
      }
    }
  }

  const monsterDiffIdx: 0 | 1 | 2 = this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0
  for (const entry of scanOrder) {
    const sid = entry.skillId
    if (sid === undefined) continue
    const slvl = Math.max(1, resolveMonsterRegisteredSkillSlvl113c(entry.level, monsterDiffIdx) || entry.level)
    const mode = this.monsterSkillMode(entry.mode)

    // Self-armor buffs (`#60 Chilling Armor` -> state 20, `#210 MonBoneArmor` -> state 14).
    // Skills.txt `delay = 0`: gated by the monster's `aidel` think interval (`cooldownTicks`) rather than a multi-second global skill delay.
    if (sid === 60 && !monster.states.has(20)) {
      this.applyMonsterState(monster.unitId, 20, 3600)
      this.emitBossSkillCast113c(monster, 60, slvl, mode, monster.x, monster.y)
      monster.skillCooldown = monster.cooldownTicks
      monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
      return true
    }
    if (sid === 210 && !monster.states.has(14)) {
      this.applyMonsterState(monster.unitId, 14, 3000)
      this.emitBossSkillCast113c(monster, 210, slvl, mode, monster.x, monster.y)
      monster.skillCooldown = monster.cooldownTicks
      monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
      return true
    }

    // `#337 HydraMissile` (`hydra1..3` #351..353 stationary turret firebolt -> `Missiles.txt #247 hydra`, linked `Skill = Hydra` #62, #2001).
    if (sid === 337 && distance <= 24) {
      monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, ordered.length)
      this.emitBossSkillCast113c(monster, 337, slvl, 4, target.x, target.y)
      const ownerBoss =
        monster.bossUnitId !== undefined ? this.monsters.get(monster.bossUnitId) : undefined
      const extraFirePct = ownerBoss?.monProps.extraFirePct ?? monster.monProps.extraFirePct
      const hydraMissileRec = this.registry.getMissileById(247) ?? this.registry.getMissileByName('hydra')
      let fireDmg: number
      if (hydraMissileRec !== undefined) {
        const evalBolt = evaluateMonsterMissileDamage113c({
          registry: this.registry,
          missile: hydraMissileRec,
          slvl,
          difficulty: monsterDiffIdx,
          monsterMinPhys: monster.minDmg,
          monsterMaxPhys: monster.maxDmg,
          attackMode: 'A1',
          extraFirePct,
          rng: this.rng,
        })
        fireDmg = Math.max(1, evalBolt.elemDamage || evalBolt.totalDamage)
      } else {
        const rawFireDmg = Math.max(1, Math.floor((28 + 11 * Math.max(0, slvl - 1)) / 2))
        fireDmg =
          extraFirePct > 0 ? Math.max(1, Math.floor((rawFireDmg * (100 + extraFirePct)) / 100)) : rawFireDmg
      }
      this.emitBossProjectile113c(monster, {
        missileId: 247,
        skillId: 337,
        slvl,
        originX: monster.x,
        originY: monster.y,
        targetX: target.x,
        targetY: target.y,
        speedSubTilesPerFrame: 16 / 16,
        rangeFrames: 30,
        size: 1,
        element: 'fire',
        physDamage: 0,
        elemDamage: fireDmg,
        hitMonsters,
      })
      monster.skillCooldown = 18
      monster.cooldown = Math.max(monster.cooldown, 15)
      return true
    }

    // `#203 DesertTurret` (`#372 firetower`, `#348..350 turret1..3` -> `#283 desertfireball`) &
    // `#204 ArcaneTower` (`#371 lightningspire` -> `#643 lightningtowernova`, `#1892`, `#2006`).
    if ((sid === 203 || sid === 204) && distance <= 22) {
      const diffIdx: 0 | 1 | 2 = this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0
      monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, ordered.length)
      this.emitBossSkillCast113c(monster, sid, slvl, 4, target.x, target.y)
      if (sid === 203) {
        const fireRec =
          this.registry.getMissileByName('desertfireball') ?? this.registry.getMissileById(283)
        const fireEval =
          fireRec !== undefined
            ? evaluateMonsterMissileDamage113c({
                registry: this.registry,
                missile: fireRec,
                slvl,
                difficulty: diffIdx,
                monsterMinPhys: 0,
                monsterMaxPhys: 0,
                extraFirePct: monster.monProps.extraFirePct,
                rng: this.rng,
              })
            : undefined
        const fbMin = 6 + 10 * Math.max(0, slvl - 1)
        const fbMax = Math.max(fbMin, 9 + 11 * Math.max(0, slvl - 1))
        const fireDmg =
          fireEval !== undefined && fireEval.elemDamage > 0
            ? fireEval.elemDamage
            : this.rollInclusive(fbMin, fbMax)
        this.emitBossProjectile113c(monster, {
          missileId: fireRec?.id ?? 283,
          skillId: 203,
          slvl,
          originX: monster.x,
          originY: monster.y,
          targetX: target.x,
          targetY: target.y,
          speedSubTilesPerFrame: 16 / 16,
          rangeFrames: 24,
          size: 1,
          element: 'fire',
          physDamage: 0,
          elemDamage: fireDmg,
          elemDurationFrames: fireEval?.elemDurationFrames ?? 600,
          hitMonsters,
        })
        monster.skillCooldown = 15
        monster.cooldown = Math.max(monster.cooldown, 12)
      } else {
        const ltngRec =
          this.registry.getMissileByName('lightningtowernova') ??
          this.registry.getMissileById(643) ??
          this.registry.getMissileByName('arcanelightningbolt') ??
          this.registry.getMissileByName('lightning')
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
        const ltMin = 12 + 12 * Math.max(0, slvl - 1)
        const ltMax = Math.max(ltMin, 14 + 14 * Math.max(0, slvl - 1))
        const ltngDmg =
          ltngEval !== undefined && ltngEval.elemDamage > 0
            ? ltngEval.elemDamage
            : this.rollInclusive(ltMin, ltMax)
        this.emitBossProjectile113c(monster, {
          missileId: ltngRec?.id ?? 643,
          skillId: 204,
          slvl,
          originX: monster.x,
          originY: monster.y,
          targetX: target.x,
          targetY: target.y,
          speedSubTilesPerFrame: 22 / 16,
          rangeFrames: 28,
          size: 2,
          pierce: true,
          nextHit: true,
          nextDelay: 4,
          element: 'ltng',
          physDamage: 0,
          elemDamage: ltngDmg,
          hitMonsters,
        })
        monster.skillCooldown = 20
        monster.cooldown = Math.max(monster.cooldown, 15)
      }
      return true
    }

    // `#300 Impregnate` (and `#316`, Putrid Defiler `hcIdx 546..550`, `#1894`):
    // Infects a nearby living non-boss ally (`wormsOnDeath = true`, `MON_UMOD #40`, `state 143`) so host death spawns Pain Worms!
    if ((sid === 300 || sid === 316) && !hitMonsters && distance <= 24) {
      let hostTarget: InternalMonsterRecord | undefined
      let bestHostDist = 16
      for (const ally of this.monsters.values()) {
        if (
          ally.dead ||
          ally.isNpc ||
          ally.align !== monster.align ||
          !ally.isKillable ||
          this.isMonsterConverted(ally) ||
          ally.isBoss ||
          ally.isPrimeEvil ||
          ally.unitId === monster.unitId ||
          ally.areaId !== monster.areaId ||
          ally.wormsOnDeath ||
          ally.umodIds.includes(40) ||
          (ally.hcIdx >= 546 && ally.hcIdx <= 555)
        ) {
          continue
        }
        const d = Math.hypot(ally.x - monster.x, ally.y - monster.y)
        if (d <= bestHostDist) {
          bestHostDist = d
          hostTarget = ally
        }
      }
      if (hostTarget !== undefined) {
        hostTarget.wormsOnDeath = true
        if (!hostTarget.umodIds.includes(40)) {
          hostTarget.umodIds = [...hostTarget.umodIds, 40]
        }
        this.applyMonsterState(hostTarget.unitId, 143, 3600)
        monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, ordered.length)
        this.emitBossSkillCast113c(monster, sid, slvl, mode, hostTarget.x, hostTarget.y)
        monster.skillCooldown = 45
        monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
        return true
      }
    }

    // `#214 RegurgitatorEat` & `#213 CorpseSpit` (`regurgitator1..4` `hcIdx 307..309, 694`, `#1895`, `#2006`):
    // Eats nearby intact non-boss corpses (permanently consuming them + healing 35% maxHp + loading `corpseAmmo`)
    // and spits `regurgitatorcorpse` (`#341`, `MissA2`: `HitShift = 8, MinDmg = 25..55 + 15/lvl`, pure physical) at hostiles!
    if ((sid === 214 || sid === 213) && !hitMonsters) {
      if (monster.corpseAmmo > 0 && distance <= 18) {
        const diffIdx: 0 | 1 | 2 = this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0
        monster.corpseAmmo -= 1
        monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, ordered.length)
        this.emitBossSkillCast113c(monster, 213, slvl, 5, target.x, target.y)
        const spitRec =
          (monster.modeMissiles?.A2 ? this.registry.getMissileByName(monster.modeMissiles.A2) : undefined) ??
          this.registry.getMissileByName('regurgitatorcorpse') ??
          this.registry.getMissileById(341)
        const spitEval =
          spitRec !== undefined
            ? evaluateMonsterMissileDamage113c({
                registry: this.registry,
                missile: spitRec,
                slvl,
                difficulty: diffIdx,
                monsterMinPhys: 0,
                monsterMaxPhys: 0,
                rng: this.rng,
              })
            : undefined
        const spMin = 25 + 15 * Math.max(0, slvl - 1)
        const spMax = Math.max(spMin, 55 + 15 * Math.max(0, slvl - 1))
        const spitPhys =
          spitEval !== undefined && spitEval.physDamage > 0
            ? spitEval.physDamage
            : this.rollInclusive(spMin, spMax)
        this.emitBossProjectile113c(monster, {
          missileId: spitRec?.id ?? 341,
          skillId: 213,
          slvl,
          originX: monster.x,
          originY: monster.y,
          targetX: target.x,
          targetY: target.y,
          speedSubTilesPerFrame: 18 / 16,
          rangeFrames: 26,
          size: 2,
          element: spitEval?.element ?? 'phys',
          physDamage: spitPhys,
          elemDamage: spitEval?.elemDamage ?? 0,
          elemDurationFrames: spitEval?.elemDurationFrames ?? 0,
        })
        monster.skillCooldown = 25
        monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
        return true
      }
      let mealCorpse: InternalMonsterRecord | undefined
      let bestMealDist = 18
      for (const c of this.monsters.values()) {
        if (
          !c.dead ||
          c.shattered ||
          c.corpseConsumed ||
          c.states.has(104) ||
          c.isNpc ||
          c.isBoss ||
          c.isPrimeEvil ||
          isBonePrisonMonsterHcIdx113c(c.hcIdx) ||
          c.areaId !== monster.areaId
        ) {
          continue
        }
        const d = Math.hypot(c.x - monster.x, c.y - monster.y)
        if (d < bestMealDist) {
          bestMealDist = d
          mealCorpse = c
        }
      }
      if (mealCorpse !== undefined) {
        if (bestMealDist <= 3.5) {
          mealCorpse.corpseConsumed = true
          mealCorpse.shattered = true
          mealCorpse.states.add(104)
          this.broadcastToArea(monster.areaId, {
            type: 'StateSet',
            unit: { unitType: 1, id: mealCorpse.unitId },
            state: 104,
            stats: [],
            origin: 0xa8,
            complete: true,
          })
          const healAmt = Math.max(4, Math.floor(monster.maxHp * 0.35))
          monster.hp = Math.min(monster.maxHp, monster.hp + healAmt)
          this.monsterCombat.get(monster.unitId)?.statList.setHp256(monster.hp * FIXED_ONE)
          monster.corpseAmmo += 1
          monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, ordered.length)
          this.emitBossSkillCast113c(monster, 214, slvl, mode, mealCorpse.x, mealCorpse.y)
          this.broadcastToArea(monster.areaId, {
            type: 'UnitStatUpdate',
            unitType: 'monster',
            unitId: monster.unitId,
            statId: 6,
            value: monster.hp,
          })
          monster.skillCooldown = 25
          monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
          return true
        }
        this.moveMonsterToward(monster, mealCorpse.x, mealCorpse.y, false)
        return true
      }
    }

    // `#62 Hydra` (`HighPriest` Council `#345..347`, Bartuc `#557`): summon `hydra1` (#351, `0` XP, 250-frame lifespan, cap 3).
    // `D2Game.dll` `0x6FC390BB` & `0x6FC39234..0x6FC392EA` (#2001, #2004):
    // - `HighPriest` only casts `#62 Hydra` when `bInMeleeRange == 0` (`distance > meleeCutoff`),
    //   `distance < aip8` (`30` subtiles via `WORD PTR [ebx+edx*2+0x80]` at `0x6FC39255`), and
    //   `rand(100) < aip4` (`40..50%`, `0x6FC3926E`), setting `dwSpellTimer = dwGameFrame + 100` (`0x64` frames, `0x6FC392DF`).
    if (sid === 62 && !hitMonsters) {
      const isHighPriest = monster.ai === 'HighPriest'
      const meleeCutoff = Math.max(2.5, monster.meleeRange + 1.5)
      const maxHydraDist = isHighPriest ? monster.aiParams[7] || 30 : 22
      const hydraDistanceOk = isHighPriest
        ? distance > meleeCutoff && distance < maxHydraDist
        : distance <= maxHydraDist
      const activeHydras = hydraDistanceOk
        ? [...this.monsters.values()].filter(
            (m) => !m.dead && m.bossUnitId === monster.unitId && m.hcIdx >= 351 && m.hcIdx <= 353,
          ).length
        : 3
      if (
        hydraDistanceOk &&
        activeHydras < 3 &&
        (!isHighPriest || this.rng.rand(100) < (monster.aiParams[3] || 40))
      ) {
        const ang = (this.rng.rand(360) * Math.PI) / 180
        const hx = target.x + Math.cos(ang) * 2.5
        const hy = target.y + Math.sin(ang) * 2.5
        if (
          !this.terrainWalkableCheck ||
          this.terrainWalkableCheck(monster.areaId, Math.round(hx), Math.round(hy), false)
        ) {
          monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, ordered.length)
          this.emitBossSkillCast113c(monster, 62, slvl, mode, hx, hy)
          const hId = this.spawnMonster({
            classId: 351,
            hcIdx: 351,
            defId: 'hydra1',
            ai: 'Hydra',
            x: hx,
            y: hy,
            areaId: monster.areaId,
            level: monster.level,
            experience: 0,
            noRatio: true,
            velocity: 0,
            runSpeed: 0,
            bossUnitId: monster.unitId,
            align: monster.align,
          })
          const hRec = this.monsters.get(hId)
          if (hRec !== undefined) {
            hRec.despawnAtFrame = this.currentFrame + 250
            // Store base `entry.level` (`Sk1lvl`) so line 84 (`resolveMonsterRegisteredSkillSlvl113c`)
            // applies difficulty `MonsterSkillBonus` (`[0, 3, 7]`) exactly once (`0x6FC63F1C`, #2001).
            ;(hRec as { skills: readonly MonsterSkillEntry[] }).skills = [
              { slot: 1, skill: 'HydraMissile', skillId: 337, mode: 'A1', level: entry.level },
            ]
          }
          monster.skillCooldown = isHighPriest ? 100 : 50
          monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
          return true
        }
      }
    }

    // `#167 Nest` on `#267 Blood Raven` (plus `#183` / `#190` cemetery resurrection, `#1891`):
    // First revives any intact dead zombie/undead corpse in range (`experience = 0`, `alreadyGrantedKillRewards = true`);
    // otherwise summons `#6 zombie2` (Hungry Dead) with `experience: 0`, cap `8 + 2 * difficulty`.
    if (
      ((sid === 167 && monster.hcIdx === 267) || sid === 183 || sid === 190) &&
      !hitMonsters &&
      distance <= 24
    ) {
      let revivableCorpse: InternalMonsterRecord | undefined
      let bestReviveDist = 22
      for (const c of this.monsters.values()) {
        if (
          !c.dead ||
          c.shattered ||
          c.corpseConsumed ||
          c.states.has(104) ||
          c.isNpc ||
          c.isBoss ||
          c.isPrimeEvil ||
          c.rank === 'unique' ||
          c.rank === 'champion' ||
          c.superUniqueId !== undefined ||
          c.areaId !== monster.areaId
        ) {
          continue
        }
        const matchesCorpse =
          monster.hcIdx === 267
            ? c.monType === 'zombie' || c.defId.startsWith('zombie') || c.isUndead
            : c.isUndead || c.monType === monster.monType
        if (!matchesCorpse) continue
        const d = Math.hypot(c.x - monster.x, c.y - monster.y)
        if (d <= bestReviveDist) {
          bestReviveDist = d
          revivableCorpse = c
        }
      }
      if (revivableCorpse !== undefined) {
        monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, ordered.length)
        this.emitBossSkillCast113c(monster, sid, slvl, mode, revivableCorpse.x, revivableCorpse.y)
        this.reviveMonsterCorpse(monster, revivableCorpse)
        monster.skillCooldown = 45
        monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
        return true
      }
      if (monster.hcIdx === 267) {
        const cap = 8 + 2 * this.difficulty
        const activeZombies = [...this.monsters.values()].filter(
          (m) => !m.dead && m.bossUnitId === monster.unitId && (m.hcIdx === 6 || m.hcIdx === 7),
        ).length
        if (activeZombies < cap) {
          const ang = (this.rng.rand(360) * Math.PI) / 180
          const zx = monster.x + Math.cos(ang) * 3
          const zy = monster.y + Math.sin(ang) * 3
          if (
            !this.terrainWalkableCheck ||
            this.terrainWalkableCheck(monster.areaId, Math.round(zx), Math.round(zy), false)
          ) {
            monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, ordered.length)
            this.emitBossSkillCast113c(monster, sid, slvl, mode, zx, zy)
            this.spawnMonster({
              classId: 6,
              hcIdx: 6,
              defId: 'zombie2',
              x: zx,
              y: zy,
              areaId: monster.areaId,
              level: monster.level,
              experience: 0,
              alreadyGrantedKillRewards: true,
              bossUnitId: monster.unitId,
            })
            monster.skillCooldown = 45
            monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
            return true
          }
        }
      }
    }

    // `#351 NihlathakCorpseExplosion` (`10..20%`) & `#285 Baal Corpse Explode` (`40%`, `#1893`):
    // Base single-player corpse HP split `50%` Phys + `50%` Fire, sets `state 104` + `corpseConsumed = true`.
    if ((sid === 351 || sid === 285) && !hitMonsters && distance <= 26) {
      let chosenCorpse: InternalMonsterRecord | undefined
      let bestCDist = 22
      for (const c of this.monsters.values()) {
        if (
          !c.dead ||
          c.shattered ||
          c.corpseConsumed ||
          c.states.has(104) ||
          c.isNpc ||
          c.isBoss ||
          c.isPrimeEvil ||
          isBonePrisonMonsterHcIdx113c(c.hcIdx) ||
          c.areaId !== monster.areaId
        ) {
          continue
        }
        const dCaster = Math.hypot(c.x - monster.x, c.y - monster.y)
        if (dCaster > 22) continue
        const dTarget = Math.hypot(c.x - target.x, c.y - target.y)
        if (dTarget < bestCDist) {
          bestCDist = dTarget
          chosenCorpse = c
        }
      }
      if (chosenCorpse !== undefined) {
        chosenCorpse.corpseConsumed = true
        chosenCorpse.shattered = true
        chosenCorpse.states.add(104)
        this.broadcastToArea(monster.areaId, {
          type: 'StateSet',
          unit: { unitType: 1, id: chosenCorpse.unitId },
          state: 104,
          stats: [],
          origin: 0xa8,
          complete: true,
        })
        this.emitBossSkillCast113c(monster, sid, slvl, mode, chosenCorpse.x, chosenCorpse.y)
        this.broadcastExplosionMissile(chosenCorpse, 54)
        const baseCorpseHp = Math.max(
          1,
          chosenCorpse.unscaledMaxHp || chosenCorpse.baseMaxHp || chosenCorpse.maxHp,
        )
        const pct = sid === 285 ? 40 : 10 + this.rng.rand(11)
        const totalCeDmg = Math.max(2, Math.floor((baseCorpseHp * pct) / 100))
        const physHalf = Math.max(1, Math.floor(totalCeDmg / 2))
        const fireHalf = Math.max(1, totalCeDmg - physHalf)
        const ceRadius = sid === 285 ? 12 : 8 + this.difficulty * 2 + Math.min(6, Math.floor(slvl / 2))
        for (const h of this.listHostilesInMonsterArea113c(monster)) {
          if (Math.hypot(h.x - chosenCorpse.x, h.y - chosenCorpse.y) <= ceRadius) {
            this.dealMonsterDirectHitToHostile113c(monster, h, {
              phys: physHalf,
              fire: fireHalf,
            })
          }
        }
        monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, ordered.length)
        monster.skillCooldown = 30
        monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
        return true
      }
    }

    // `#302 MinionSpawner` (Nihlathak `#526` & `#484..491`): spawn `minion1` (#453, `0` XP, cap 6).
    if (sid === 302 && !hitMonsters && distance <= 25) {
      const activeMinions = [...this.monsters.values()].filter(
        (m) =>
          !m.dead &&
          m.bossUnitId === monster.unitId &&
          m.hcIdx >= 453 &&
          m.hcIdx <= 468,
      ).length
      if (activeMinions < 6) {
        const ang = (this.rng.rand(360) * Math.PI) / 180
        const mx = monster.x + Math.cos(ang) * 2.5
        const my = monster.y + Math.sin(ang) * 2.5
        if (
          !this.terrainWalkableCheck ||
          this.terrainWalkableCheck(monster.areaId, Math.round(mx), Math.round(my), false)
        ) {
          monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, ordered.length)
          this.emitBossSkillCast113c(monster, 302, slvl, mode, mx, my)
          this.spawnMonster({
            classId: 453,
            hcIdx: 453,
            defId: 'minion1',
            x: mx,
            y: my,
            areaId: monster.areaId,
            level: monster.level,
            experience: 0,
            bossUnitId: monster.unitId,
          })
          monster.skillCooldown = 55
          monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
          return true
        }
      }
    }

    // `#330 Imp Teleport` (Nihlathak `#526` escape blink when `distance <= 6`, & Demon Imp `#492..496, 688, 689, 714` mount onto SiegeBeast/BarricadeTower or blink `#1894`).
    if (
      sid === 330 &&
      ((monster.hcIdx === 526 && distance <= 6) ||
        (monster.hcIdx !== 526 && distance <= 22))
    ) {
      if (monster.hcIdx !== 526 && monster.mountedOnUnitId === undefined) {
        let carrier: InternalMonsterRecord | undefined
        let bestCarrierDist = 18
        for (const ally of this.monsters.values()) {
          if (
            ally.dead ||
            ally.isNpc ||
            ally.areaId !== monster.areaId ||
            ally.mountedImpUnitId !== undefined
          ) {
            continue
          }
          const isMountableCarrier =
            (ally.hcIdx >= 441 && ally.hcIdx <= 445) || ally.hcIdx === 435
          if (!isMountableCarrier) continue
          const d = Math.hypot(ally.x - monster.x, ally.y - monster.y)
          if (d <= bestCarrierDist) {
            bestCarrierDist = d
            carrier = ally
          }
        }
        if (carrier !== undefined) {
          const from = { x: Math.round(monster.x), y: Math.round(monster.y) }
          this.broadcastExplosionMissile(monster, 451)
          monster.x = carrier.x
          monster.y = carrier.y
          monster.path = []
          monster.pathIndex = 0
          monster.pathTargetX = Number.NaN
          monster.pathTargetY = Number.NaN
          monster.mountedOnUnitId = carrier.unitId
          carrier.mountedImpUnitId = monster.unitId
          this.emitBossSkillCast113c(monster, 330, slvl, mode, carrier.x, carrier.y)
          this.broadcastExplosionMissile(monster, 451)
          this.broadcastToArea(monster.areaId, {
            type: 'UnitMove',
            unitType: 'monster',
            id: monster.unitId,
            unitId: monster.unitId,
            mode: 'run',
            from,
            to: { x: Math.round(carrier.x), y: Math.round(carrier.y) },
            x: Math.round(carrier.x),
            y: Math.round(carrier.y),
            currentX: Math.round(carrier.x),
            currentY: Math.round(carrier.y),
            targetX: Math.round(carrier.x),
            targetY: Math.round(carrier.y),
            areaId: monster.areaId,
          })
          monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, ordered.length)
          monster.skillCooldown = 40
          monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
          return true
        }
      }
      if (monster.hcIdx === 526 || (distance >= 4 && distance <= 20 && monster.mountedOnUnitId === undefined)) {
        const awayAng = Math.atan2(monster.y - target.y, monster.x - target.x)
        let blinkDest: { x: number; y: number } | undefined
        for (const spread of [0, 0.6, -0.6, 1.2, -1.2, Math.PI * 0.75, -Math.PI * 0.75]) {
          const distStep = monster.hcIdx === 526 ? 9 : 5
          const bx = (monster.hcIdx === 526 ? monster.x : target.x) + Math.cos(awayAng + spread) * distStep
          const by = (monster.hcIdx === 526 ? monster.y : target.y) + Math.sin(awayAng + spread) * distStep
          if (
            !this.isClosedDoorAt(monster.areaId, Math.round(bx), Math.round(by)) &&
            (!this.terrainWalkableCheck ||
              this.terrainWalkableCheck(monster.areaId, Math.round(bx), Math.round(by), monster.isFlying)) &&
            !this.isMonsterCellOccupied(monster, bx, by)
          ) {
            blinkDest = { x: bx, y: by }
            break
          }
        }
        if (blinkDest !== undefined) {
          const from = { x: Math.round(monster.x), y: Math.round(monster.y) }
          this.broadcastExplosionMissile(monster, 451)
          monster.x = blinkDest.x
          monster.y = blinkDest.y
          monster.path = []
          monster.pathIndex = 0
          monster.pathTargetX = Number.NaN
          monster.pathTargetY = Number.NaN
          this.emitBossSkillCast113c(monster, 330, slvl, mode, blinkDest.x, blinkDest.y)
          this.broadcastExplosionMissile(monster, 451)
          this.broadcastToArea(monster.areaId, {
            type: 'UnitMove',
            unitType: 'monster',
            id: monster.unitId,
            unitId: monster.unitId,
            mode: 'run',
            from,
            to: { x: Math.round(blinkDest.x), y: Math.round(blinkDest.y) },
            x: Math.round(blinkDest.x),
            y: Math.round(blinkDest.y),
            currentX: Math.round(blinkDest.x),
            currentY: Math.round(blinkDest.y),
            targetX: Math.round(blinkDest.x),
            targetY: Math.round(blinkDest.y),
            areaId: monster.areaId,
          })
          monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, ordered.length)
          monster.skillCooldown = 40
          monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
          return true
        }
      }
    }

    // `#184 MonTeleport` (`#706 uberizual`, `#256 izual` gap-closer blink onto target when `distance >= 5`).
    // Scoped to the Izual rows: other `MonTeleport` users (e.g. `#238..242` Zakarum Priests) keep their own
    // MonAi-driven reposition and must not have their ranged `Skill1..8` casts pre-empted by this blink.
    if (sid === 184 && (monster.hcIdx === 706 || monster.hcIdx === 256) && distance >= 5 && distance <= 28) {
      let blinkDest: { x: number; y: number } | undefined
      const towardAng = Math.atan2(monster.y - target.y, monster.x - target.x)
      for (const spread of [0, 0.7, -0.7, 1.4, -1.4, Math.PI]) {
        const bx = target.x + Math.cos(towardAng + spread) * 2
        const by = target.y + Math.sin(towardAng + spread) * 2
        if (
          !this.isClosedDoorAt(monster.areaId, Math.round(bx), Math.round(by)) &&
          (!this.terrainWalkableCheck ||
            this.terrainWalkableCheck(monster.areaId, Math.round(bx), Math.round(by), monster.isFlying)) &&
          !this.isMonsterCellOccupied(monster, bx, by)
        ) {
          blinkDest = { x: bx, y: by }
          break
        }
      }
      if (blinkDest !== undefined) {
        const from = { x: Math.round(monster.x), y: Math.round(monster.y) }
        monster.x = blinkDest.x
        monster.y = blinkDest.y
        monster.path = []
        monster.pathIndex = 0
        monster.pathTargetX = Number.NaN
        monster.pathTargetY = Number.NaN
        this.emitBossSkillCast113c(monster, 184, slvl, mode, blinkDest.x, blinkDest.y)
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMove',
          unitType: 'monster',
          id: monster.unitId,
          unitId: monster.unitId,
          mode: 'run',
          from,
          to: { x: Math.round(blinkDest.x), y: Math.round(blinkDest.y) },
          x: Math.round(blinkDest.x),
          y: Math.round(blinkDest.y),
          currentX: Math.round(blinkDest.x),
          currentY: Math.round(blinkDest.y),
          targetX: Math.round(blinkDest.x),
          targetY: Math.round(blinkDest.y),
          areaId: monster.areaId,
        })
        monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, ordered.length)
        monster.skillCooldown = 40
        monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
        return true
      }
    }

    // `#44 Frost Nova` (`SKILLS_SrvDo022_NovaAttack` `0x6FC63AA0` -> `0x6FCC2800`, `#256 izual`, `#250 summoner`, `#706 uberizual`, `#2006`):
    // Spawns radial `#119 frostnova` bolts (`nextHit = 1, nextDelay = 4`, `HitShift = 7`, `ELen = 200 + 25*(slvl-1)`) ONLY —
    // never a second synchronous direct-hit AoE loop!
    if (sid === 44 && !hitMonsters && distance <= 10) {
      const diffIdx: 0 | 1 | 2 = this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0
      this.emitBossSkillCast113c(monster, 44, slvl, mode, monster.x, monster.y)
      const novaRec = this.registry.getMissileById(119)
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
      const fbMin = Math.max(1, (compute5BandScaling(slvl, 4, 4, 6, 8, 10, 12) << 7) >> 8)
      const fbMax = Math.max(fbMin, (compute5BandScaling(slvl, 8, 5, 7, 9, 11, 13) << 7) >> 8)
      const coldDmg =
        novaEval !== undefined && novaEval.elemDamage > 0
          ? novaEval.elemDamage
          : this.rollInclusive(fbMin, fbMax)
      const chillFrames =
        novaEval !== undefined && novaEval.elemDurationFrames > 0
          ? novaEval.elemDurationFrames
          : 200 + 25 * Math.max(0, slvl - 1)
      for (let i = 0; i < 16; i++) {
        const theta = (i / 16) * Math.PI * 2
        this.emitBossProjectile113c(monster, {
          missileId: 119,
          skillId: 44,
          slvl,
          originX: monster.x,
          originY: monster.y,
          targetX: monster.x + Math.cos(theta) * 12,
          targetY: monster.y + Math.sin(theta) * 12,
          speedSubTilesPerFrame: 20 / 16,
          rangeFrames: 14,
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
      monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, ordered.length)
      monster.skillCooldown = 30
      monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
      return true
    }

    // `#164 AndrialSpray` (`#156 andariel`, `#707 uberandariel` Lilith: 9-bolt fan of `#32 andarielspray` piercing poison bolts).
    if (sid === 164 && !hitMonsters && distance <= 20) {
      this.emitBossSkillCast113c(monster, 164, slvl, mode, target.x, target.y)
      const baseAngle = Math.atan2(target.y - monster.y, target.x - monster.x)
      const sprayRec = this.registry.getMissileById(32)
      const diffIdx: 0 | 1 | 2 = this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0
      const sprayEval =
        sprayRec !== undefined
          ? evaluateMonsterMissileDamage113c({
              registry: this.registry,
              missile: sprayRec,
              slvl,
              difficulty: diffIdx,
              monsterMinPhys: 0,
              monsterMaxPhys: 0,
              rng: this.rng,
            })
          : undefined
      const sprayPhys = sprayEval?.physDamage ?? 0
      const poisDmg =
        sprayEval !== undefined && sprayEval.elemDamage > 0
          ? sprayEval.elemDamage
          : this.rollInclusive(22, 42) + 12 * slvl + 24 * this.difficulty
      const sprayDur =
        sprayEval !== undefined && sprayEval.elemDurationFrames > 0
          ? sprayEval.elemDurationFrames
          : (sprayRec !== undefined ? computeMissileElementalLength113c(sprayRec, slvl) : 0) || 400
      for (let b = -4; b <= 4; b++) {
        const ang = baseAngle + b * 0.14
        this.emitBossProjectile113c(monster, {
          missileId: 32,
          skillId: 164,
          slvl,
          originX: monster.x,
          originY: monster.y,
          targetX: monster.x + Math.cos(ang) * 20,
          targetY: monster.y + Math.sin(ang) * 20,
          speedSubTilesPerFrame: 18 / 16,
          rangeFrames: 26,
          size: 2,
          pierce: true,
          nextHit: true,
          nextDelay: 4,
          element: 'pois',
          physDamage: sprayPhys,
          elemDamage: poisDmg,
          elemDurationFrames: sprayDur,
        })
      }
      monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, ordered.length)
      monster.skillCooldown = 28
      monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
      return true
    }

    // `#192 PrimePoisonNova` (`SrvDo099`: 16-bolt radial ring of `#220 primepoisoncloud`, `ELen = 300` frames).
    if (sid === 192 && !hitMonsters && distance <= 18) {
      this.emitBossSkillCast113c(monster, 192, slvl, mode, monster.x, monster.y)
      const cloudRec = this.registry.getMissileById(220) ?? this.registry.getMissileById(118)
      const diffIdx: 0 | 1 | 2 = this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0
      const cloudEval =
        cloudRec !== undefined
          ? evaluateMonsterMissileDamage113c({
              registry: this.registry,
              missile: cloudRec,
              slvl,
              difficulty: diffIdx,
              monsterMinPhys: 0,
              monsterMaxPhys: 0,
              rng: this.rng,
            })
          : undefined
      const poisDmg =
        cloudEval !== undefined && cloudEval.elemDamage > 0
          ? cloudEval.elemDamage
          : 12 + 8 * slvl + 16 * this.difficulty
      const cloudDur =
        cloudEval !== undefined && cloudEval.elemDurationFrames > 0
          ? cloudEval.elemDurationFrames
          : 300
      for (let i = 0; i < 16; i++) {
        const theta = (i / 16) * Math.PI * 2
        this.emitBossProjectile113c(monster, {
          missileId: cloudRec?.id ?? 220,
          skillId: 192,
          slvl,
          originX: monster.x,
          originY: monster.y,
          targetX: monster.x + Math.cos(theta) * 18,
          targetY: monster.y + Math.sin(theta) * 18,
          speedSubTilesPerFrame: 16 / 16,
          rangeFrames: 26,
          size: 2,
          pierce: true,
          nextHit: true,
          nextDelay: 4,
          element: 'pois',
          physDamage: 0,
          elemDamage: poisDmg,
          elemDurationFrames: cloudDur,
        })
      }
      monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, ordered.length)
      monster.skillCooldown = 30
      monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
      return true
    }

    // `#201 AndyPoisonBolt` (`#156 andariel`, `#707 uberandariel` Lilith: `#203 andypoisonbolt` long-range poison projectile).
    if (sid === 201 && !hitMonsters && distance <= 24) {
      this.emitBossSkillCast113c(monster, 201, slvl, mode, target.x, target.y)
      const boltRec = this.registry.getMissileById(203)
      const diffIdx: 0 | 1 | 2 = this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0
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
      const boltPhys = boltEval?.physDamage ?? 0
      const poisDmg =
        boltEval !== undefined && boltEval.elemDamage > 0
          ? boltEval.elemDamage
          : this.rollInclusive(28, 52) + 14 * slvl + 28 * this.difficulty
      const boltDur =
        boltEval !== undefined && boltEval.elemDurationFrames > 0
          ? boltEval.elemDurationFrames
          : (boltRec !== undefined ? computeMissileElementalLength113c(boltRec, slvl) : 0) || 800
      this.emitBossProjectile113c(monster, {
        missileId: 203,
        skillId: 201,
        slvl,
        originX: monster.x,
        originY: monster.y,
        targetX: target.x,
        targetY: target.y,
        speedSubTilesPerFrame: 20 / 16,
        rangeFrames: 34,
        size: 2,
        element: 'pois',
        physDamage: boltPhys,
        elemDamage: poisDmg,
        elemDurationFrames: boltDur,
      })
      monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, ordered.length)
      monster.skillCooldown = 22
      monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
      return true
    }

    // `#107 Charge` & `#352 SerpentCharge` (Duriel `#211`, Uber Duriel `#708`, ReanimatedHorde, SiegeBeast, ClawViper).
    if ((sid === 107 || sid === 352) && !hitMonsters && distance > 3.5 && distance <= 15) {
      const dx = target.x - monster.x
      const dy = target.y - monster.y
      const d = Math.max(1, Math.hypot(dx, dy))
      const ux = dx / d
      const uy = dy / d
      let destX = monster.x
      let destY = monster.y
      const maxSteps = Math.max(1, Math.floor(d - 1.4))
      for (let step = 1; step <= maxSteps; step++) {
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
      if (Math.hypot(destX - monster.x, destY - monster.y) >= 1.0) {
        const from = { x: Math.round(monster.x), y: Math.round(monster.y) }
        monster.x = destX
        monster.y = destY
        monster.path = []
        monster.pathIndex = 0
        monster.pathTargetX = Number.NaN
        monster.pathTargetY = Number.NaN
        this.emitBossSkillCast113c(monster, sid, slvl, 14, target.x, target.y)
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
        if (resolvedHostile !== undefined && Math.hypot(target.x - monster.x, target.y - monster.y) <= 3.5) {
          const baseMin =
            monster.minDmg > 0
              ? monster.minDmg
              : monster.special1MinDmg || monster.attack2MinDmg || 4
          const baseMax =
            monster.maxDmg > 0
              ? monster.maxDmg
              : Math.max(baseMin, monster.special1MaxDmg || monster.attack2MaxDmg || 6)
          const chargeMult =
            sid === 352 ? 1 : 1 + (100 + 25 * Math.max(0, slvl - 1)) / 100
          const chargeMin = Math.max(6, Math.round(baseMin * chargeMult))
          const chargeMax = Math.max(chargeMin, Math.round(baseMax * chargeMult))
          this.executeMonsterMeleeSkillStrike113c(monster, resolvedHostile, {
            skillId: sid,
            minDmg: chargeMin,
            maxDmg: chargeMax,
            arBonusPct: 50 + 15 * Math.max(0, slvl - 1),
            knockbackSteps: 3,
          })
        }
        monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, ordered.length)
        monster.skillCooldown = 45
        monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
        return true
      }
    }

    // Melee-range non-missile combat skills (`distance <= 3.5`, #1994 1.13c ToHit & Block parity).
    if (!hitMonsters && resolvedHostile !== undefined && distance <= 3.5) {
      // `#10 Jab` (Duriel `#211`, Uber Duriel `#708`, Scarab, CorruptLancer): 3 rapid physical strikes (`ToHit = 10 + 9*(slvl-1)`).
      if (sid === 10) {
        this.emitBossSkillCast113c(monster, 10, slvl, 4, target.x, target.y)
        const jabMult = Math.max(0.85, 1 + (-15 + 3 * Math.max(0, slvl - 1)) / 100)
        const jabMin = Math.max(2, Math.round(monster.minDmg * jabMult))
        const jabMax = Math.max(jabMin, Math.round(monster.maxDmg * jabMult))
        const jabArBonusPct = 10 + 9 * Math.max(0, slvl - 1)
        for (let strike = 0; strike < 3; strike++) {
          this.executeMonsterMeleeSkillStrike113c(monster, resolvedHostile, {
            skillId: 10,
            minDmg: jabMin,
            maxDmg: jabMax,
            arBonusPct: jabArBonusPct,
          })
        }
        monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, ordered.length)
        monster.skillCooldown = 22
        monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
        return true
      }

      // `#97 Smite` (Duriel `#211`, Uber Duriel `#708`, Lister `#571`, Blunderbore, Overseer): auto-hit + unblockable + Knockback + Stun (`state 21`).
      if (sid === 97) {
        this.emitBossSkillCast113c(monster, 97, slvl, 5, target.x, target.y)
        const smiteMult = 1 + (15 * slvl) / 100
        const smiteMin = Math.max(4, Math.round(monster.minDmg * smiteMult))
        const smiteMax = Math.max(smiteMin, Math.round(monster.maxDmg * smiteMult))
        const stunFrames = Math.min(250, 15 + 15 * slvl)
        this.executeMonsterMeleeSkillStrike113c(monster, resolvedHostile, {
          skillId: 97,
          minDmg: smiteMin,
          maxDmg: smiteMax,
          autoHit: true,
          unblockable: true,
          stunFrames,
          knockbackSteps: 3,
        })
        monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, ordered.length)
        monster.skillCooldown = 28
        monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
        return true
      }

      // `#126 Bash` (Smith `#402`, Hephasto `#409`) & `#156 Fire Hit` (SandRaider `S1` Fire/Cold rider).
      if (sid === 126 || sid === 156) {
        this.emitBossSkillCast113c(monster, sid, slvl, 4, target.x, target.y)
        if (sid === 126) {
          const bashMult = 1 + (50 + 5 * Math.max(0, slvl - 1)) / 100
          const bashMin = Math.max(2, Math.round(monster.minDmg * bashMult)) + slvl
          const bashMax = Math.max(bashMin, Math.round(monster.maxDmg * bashMult) + slvl)
          this.executeMonsterMeleeSkillStrike113c(monster, resolvedHostile, {
            skillId: 126,
            minDmg: bashMin,
            maxDmg: bashMax,
            arBonusPct: 15 + 5 * slvl,
            knockbackSteps: 2,
          })
        } else {
          const s1Min =
            monster.special1MinDmg > 0 ? monster.special1MinDmg : Math.max(2, monster.minDmg)
          const s1Max =
            monster.special1MaxDmg > 0
              ? Math.max(s1Min, monster.special1MaxDmg)
              : Math.max(s1Min, monster.maxDmg)
          this.executeMonsterMeleeSkillStrike113c(monster, resolvedHostile, {
            skillId: 156,
            skillMode: 'S1',
            minDmg: s1Min,
            maxDmg: s1Max,
            arBonusPct: 20 + 10 * Math.max(0, slvl - 1),
          })
        }
        monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, ordered.length)
        monster.skillCooldown = 24
        monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
        return true
      }

      // `#301 Siege Beast Stomp` (`ResultFlags = 1`): auto-hit vs Defense, still rolls Shield Block (`unblockable: false`).
      if (sid === 301) {
        this.emitBossSkillCast113c(monster, 301, slvl, 8, target.x, target.y)
        const stompMin = Math.max(6, Math.round(monster.minDmg * 1.25))
        const stompMax = Math.max(stompMin, Math.round(monster.maxDmg * 1.25))
        for (const h of this.listHostilesInMonsterArea113c(monster)) {
          if (Math.hypot(h.x - monster.x, h.y - monster.y) <= 4.0) {
            this.executeMonsterMeleeSkillStrike113c(monster, h, {
              skillId: 301,
              minDmg: stompMin,
              maxDmg: stompMax,
              autoHit: true,
              unblockable: false,
            })
          }
        }
        monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, ordered.length)
        monster.skillCooldown = 35
        monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
        return true
      }

      // `#215 MonFrenzy` & `#328 BloodLordFrenzy`: self-frenzy (`state 141`) ONLY when `ResultFlags & 1` hit succeeds (`0x6FCD67EC`).
      if (sid === 215 || sid === 328) {
        this.emitBossSkillCast113c(monster, sid, slvl, 5, target.x, target.y)
        const frenzyMin = Math.max(4, Math.round(monster.minDmg * 1.3))
        const frenzyMax = Math.max(frenzyMin, Math.round(monster.maxDmg * 1.3))
        const hit = this.executeMonsterMeleeSkillStrike113c(monster, resolvedHostile, {
          skillId: sid,
          minDmg: frenzyMin,
          maxDmg: frenzyMax,
          arBonusPct: 10 + 10 * Math.max(0, slvl - 1),
        })
        if (hit) {
          this.applyMonsterState(monster.unitId, 141, 150)
          monster.frenzyUntilFrame = this.currentFrame + 150
          monster.frenzySpeedPct = Math.max(monster.frenzySpeedPct, 35)
        }
        monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, ordered.length)
        monster.skillCooldown = 30
        monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
        return true
      }
    }
  }

  return false
}



/**
 * `AITHINK_Fn134_BaalThrone` (`D2Game.dll` `0x6FCC8430`, `MonStats.txt` `#543` `baalthrone`):
 * - While any living killable monster exists within `64` (`0x40`) sub-tiles (`sub_6FC68F60`),
 *   rolls `aip1 = 25%` to cast `#87 Decrepify` (`slvl = 5`, mode `10 = S3`) on the nearest player
 *   if not already decrepified (`state 60`).
 * - When no living monster remains within `64` sub-tiles and `currentFrame >= baalThroneTimerFrame`:
 *   - **Sub-step A** (`!(baalThroneFlags & 1)`):
 *     1. Sends `0xA4 MonsterSpecial` for the upcoming wave's `leaderHcIdx`, `minionHcIdx`, and `extraMinionHcIdx`.
 *     2. Casts `#285 Baal Corpse Explode` (`slvl = 1`, mode `10 = S3`), consuming monster corpses within `40` (`0x28`) sub-tiles (`STATE_CORPSE_NODRAW = 104`).
 *     3. Emits `0x2C PlaySound` (`sound = 16`, `MONSTER_TAUNT` -> `4631` `monster_baal_taunt_1`).
 *     4. Sets `baalThroneFlags |= 1` and `baalThroneTimerFrame = currentFrame + 250` (`10.0s`).
 *   - **Sub-step B** (`(baalThroneFlags & 1) !== 0`):
 *     - For waves `0..4`: casts `#286 Baal Monster Spawn` (`slvl = 1`, mode `10 = S3`, missile `#550` `'baal spawn monsters'`) at `(x, y + 13)`, schedules `spawnSuperUnique(61 + wave, x, y + 13)` after `17` frames (`680ms`), increments `baalThroneWave`, sets `baalThroneTimerFrame = currentFrame + 100` (`4.0s`), and sets `baalThroneFlags = (baalThroneFlags | 2) & ~1`.
 *     - When `baalThroneWave >= 5`: transforms in-place into `#559 baalcrabstairs` (`ai = 'BaalToStairs'`), sets `STATE_CHANGECLASS` (`142`) with `STAT_SHORTPARAM1` (`355`) = `559`, and stalls AI for `5` frames.
 */
function stepBaalThroneAi(this: GameInstanceHost, monster: InternalMonsterRecord): void {
  const playersInArea = [...this.players.values()].filter(
    (p) => !p.dead && p.areaId === monster.areaId,
  )
  if (this.players.size > 0 && playersInArea.length === 0) return

  let hasLivingWaveMonster = false
  for (const other of this.monsters.values()) {
    if (
      other.unitId === monster.unitId ||
      other.dead ||
      other.isNpc ||
      !other.isKillable ||
      other.areaId !== monster.areaId
    ) {
      continue
    }
    if (Math.hypot(other.x - monster.x, other.y - monster.y) <= 64) {
      hasLivingWaveMonster = true
      break
    }
  }

  if (hasLivingWaveMonster || monster.pendingBaalWaveSpawn !== undefined) {
    let nearestPlayer: InternalPlayerRecord | undefined
    let nearestDist = Infinity
    for (const p of playersInArea) {
      const d = Math.hypot(p.x - monster.x, p.y - monster.y)
      if (d < nearestDist) {
        nearestDist = d
        nearestPlayer = p
      }
    }
    const decrepChance = monster.aiParams[0] || 25
    if (
      nearestPlayer !== undefined &&
      nearestDist <= Math.max(monster.aggroRadius, 35) &&
      !nearestPlayer.states.has(60) &&
      this.rng.rand(100) < decrepChance
    ) {
      monster.mode = 10
      this.applyPlayerState(nearestPlayer.unitId, 60, 160)
      const targetPt = {
        x: Math.round(nearestPlayer.x),
        y: Math.round(nearestPlayer.y),
      }
      this.broadcastToArea(monster.areaId, {
        type: 'UnitMode',
        unitType: 1,
        id: monster.unitId,
        mode: 10,
        at: targetPt,
        lifePct: 128,
      })
      this.broadcastToArea(monster.areaId, {
        type: 'SkillCast',
        caster: { unitType: 1, id: monster.unitId },
        skill: 87,
        skillId: 87,
        level: 5,
        target: { unitType: 0, id: nearestPlayer.unitId },
        at: targetPt,
      })
    } else if (monster.mode !== 1) {
      monster.mode = 1
    }
    return
  }

  if (
    monster.baalThroneTimerFrame > 0 &&
    this.currentFrame < monster.baalThroneTimerFrame
  ) {
    return
  }

  const bx = Math.round(monster.x)
  const by = Math.round(monster.y)

  if ((monster.baalThroneFlags & 1) === 0) {
    const waveDef = BAAL_THRONE_WAVES_113C[monster.baalThroneWave]
    if (waveDef !== undefined) {
      this.broadcastToArea(monster.areaId, {
        type: 'MonsterSpecial',
        classId: waveDef.leaderHcIdx,
      })
      if (waveDef.minionHcIdx !== waveDef.leaderHcIdx) {
        this.broadcastToArea(monster.areaId, {
          type: 'MonsterSpecial',
          classId: waveDef.minionHcIdx,
        })
      }
      if (waveDef.extraMinionHcIdx !== undefined) {
        this.broadcastToArea(monster.areaId, {
          type: 'MonsterSpecial',
          classId: waveDef.extraMinionHcIdx,
        })
      }
    }

    const throneHostiles = this.listHostilesInMonsterArea113c(monster)
    for (const corpse of this.monsters.values()) {
      if (
        corpse.unitId === monster.unitId ||
        !corpse.dead ||
        corpse.shattered ||
        corpse.corpseConsumed ||
        corpse.isNpc ||
        corpse.isBoss ||
        corpse.isPrimeEvil ||
        isBonePrisonMonsterHcIdx113c(corpse.hcIdx) ||
        corpse.areaId !== monster.areaId ||
        corpse.states.has(104)
      ) {
        continue
      }
      if (Math.hypot(corpse.x - monster.x, corpse.y - monster.y) <= 40) {
        corpse.corpseConsumed = true
        corpse.states.add(104)
        corpse.shattered = true
        this.broadcastToArea(monster.areaId, {
          type: 'StateSet',
          unit: { unitType: 1, id: corpse.unitId },
          state: 104,
          origin: 0xa7,
        })
        this.broadcastExplosionMissile(corpse, 54)
        // 1.13c `#285 Baal Corpse Explode` (`Skills.txt` `Param1 = 40`, `#1893`):
        // Deals `40%` of single-player corpse base HP (`50%` physical + `50%` fire) in AoE!
        const baseCorpseHp = Math.max(
          1,
          corpse.unscaledMaxHp || corpse.baseMaxHp || corpse.maxHp,
        )
        const totalCeDmg = Math.max(2, Math.floor((baseCorpseHp * 40) / 100))
        const physHalf = Math.max(1, Math.floor(totalCeDmg / 2))
        const fireHalf = Math.max(1, totalCeDmg - physHalf)
        for (const h of throneHostiles) {
          if (Math.hypot(h.x - corpse.x, h.y - corpse.y) <= 12) {
            this.dealMonsterDirectHitToHostile113c(monster, h, {
              phys: physHalf,
              fire: fireHalf,
            })
          }
        }
      }
    }

    monster.mode = 10
    this.broadcastToArea(monster.areaId, {
      type: 'UnitMode',
      unitType: 1,
      id: monster.unitId,
      mode: 10,
      at: { x: bx, y: by },
      lifePct: 128,
    })
    this.broadcastToArea(monster.areaId, {
      type: 'SkillCast',
      caster: { unitType: 1, id: monster.unitId },
      skill: 285,
      skillId: 285,
      level: 1,
      target: { x: bx, y: by },
      at: { x: bx, y: by },
    })
    this.broadcastToArea(monster.areaId, {
      type: 'PlaySound',
      unit: { unitType: 1, id: monster.unitId },
      sound: 16,
    })
    monster.baalThroneFlags |= 1
    monster.baalThroneTimerFrame = this.currentFrame + 250
    return
  }

  if (monster.baalThroneWave < 5) {
    const spawnX = bx
    const spawnY = by + 13
    monster.mode = 10
    this.broadcastToArea(monster.areaId, {
      type: 'UnitMode',
      unitType: 1,
      id: monster.unitId,
      mode: 10,
      at: { x: spawnX, y: spawnY },
      lifePct: 128,
    })
    this.broadcastToArea(monster.areaId, {
      type: 'SkillCast',
      caster: { unitType: 1, id: monster.unitId },
      skill: 286,
      skillId: 286,
      level: 1,
      target: { x: spawnX, y: spawnY },
      at: { x: spawnX, y: spawnY },
    })
    this.broadcastToArea(monster.areaId, {
      type: 'CreateMissile',
      missileId: this.allocateUnitId(UNIT_TYPE_113C.missile),
      missileClassId: 550,
      at: { x: bx, y: by },
      target: { x: spawnX, y: spawnY },
      x: bx,
      y: by,
      targetX: spawnX,
      targetY: spawnY,
      skillId: 286,
      level: 1,
      owner: { unitType: 1, id: monster.unitId },
      ownerType: 'monster',
      ownerId: monster.unitId,
      areaId: monster.areaId,
    })
    monster.pendingBaalWaveSpawn = {
      frame: this.currentFrame + 17,
      superUniqueIndex: 61 + monster.baalThroneWave,
      x: spawnX,
      y: spawnY,
    }
    monster.baalThroneWave += 1
    monster.baalThroneTimerFrame = this.currentFrame + 100
    monster.baalThroneFlags = (monster.baalThroneFlags | 2) & ~1
    return
  }

  // All 5 waves defeated (`0x6FCC864F..0x6FCC86C5`): transform in-place into #559 `baalcrabstairs`.
  monster.classId = 559
  monster.hcIdx = 559
  monster.defId = 'baalcrabstairs'
  monster.ai = 'BaalToStairs'
  monster.mode = 1
  monster.states.add(142)
  this.broadcastToArea(monster.areaId, {
    type: 'StateSet',
    unit: { unitType: 1, id: monster.unitId },
    state: 142,
    stats: [{ statId: 355, param: 0, value: 559 }],
    origin: 0xa8,
    complete: true,
  })
  monster.nextAiFrame = this.currentFrame + 5
}



/**
 * `AITHINK_Fn138_BaalToStairs` (`D2Game.dll` `0x6FCC8350`, `MonStats.txt` `#559` `baalcrabstairs`):
 * Walks toward `Objects.txt` `#563` (`Baals Portal`), activates the portal to Worldstone Chamber (`areaId = 132`),
 * advances `a5q6` (`Eve of Destruction`), emits Baal's final laugh (`PlaySound` `16`), and removes the unit.
 */
function stepBaalToStairsAi(this: GameInstanceHost, monster: InternalMonsterRecord): void {
  const portal = [...this.objects.values()].find(
    (obj) => obj.areaId === monster.areaId && obj.classId === 563,
  )
  if (
    portal !== undefined &&
    Math.hypot(portal.x - monster.x, portal.y - monster.y) > 2.5
  ) {
    this.moveMonsterToward(monster, portal.x, portal.y, false)
    return
  }
  if (portal !== undefined) {
    portal.destAreaId = 132
    this.setObjectMode(portal, 2)
  }
  for (const player of this.players.values()) {
    if (player.areaId === monster.areaId) {
      this.setPlayerQuestFlag(player, 'a5q6', QUEST_FLAG_STARTED_113C)
    }
  }
  this.broadcastToArea(monster.areaId, {
    type: 'PlaySound',
    unit: { unitType: 1, id: monster.unitId },
    sound: 16,
  })
  this.monsters.delete(monster.unitId)
  this.broadcastToArea(monster.areaId, {
    type: 'UnitRemove',
    unitType: 'monster',
    id: monster.unitId,
    unitId: monster.unitId,
    areaId: monster.areaId,
  })
}



function isRayBlockedByClosedDoor(this: GameInstanceHost, 
  areaId: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): boolean {
  const dist = Math.hypot(toX - fromX, toY - fromY)
  const steps = Math.max(4, Math.ceil(dist / 0.5))
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const rx = Math.round(fromX + (toX - fromX) * t)
    const ry = Math.round(fromY + (toY - fromY) * t)
    const rArea = this.areaIdAtWorldPoint(rx, ry, areaId) ?? areaId
    if (this.isClosedDoorAt(rArea, rx, ry)) return true
  }
  return false
}



function emitMonsterSubmergeOrEmergeSkill(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  skillId: 176 | 180,
  mode: 8 | 14,
  targetX: number,
  targetY: number,
): void {
  monster.mode = mode
  const mx = Math.round(monster.x)
  const my = Math.round(monster.y)
  const tx = Math.round(targetX)
  const ty = Math.round(targetY)
  this.broadcastToArea(monster.areaId, {
    type: 'SkillCast',
    caster: { unitType: 1, id: monster.unitId },
    skill: skillId,
    skillId,
    level: 1,
    target: { x: tx, y: ty },
    at: { x: mx, y: my },
  })
}



/**
 * 1.13c `AiTentacleHead` (`D2Game.dll` `0x6FCA5500`, `hcIdx 261..263`, token `TE`):
 * - `submergeAiState === 1` (submerged, `mode = 14`, untargetable/invulnerable `~0x0E`):
 *   when `currentFrame >= submergeTimerFrame` and a hostile is within `aip6` (`12/14/14`),
 *   casts `#180 Emerge` (`mode = 8` `MONMODE_SKILL1`, 21 frames), restores targetability,
 *   and arms `submergeTimerFrame = currentFrame + aip4 * 25`.
 * - `submergeAiState === 2` (surfaced):
 *   after `submergeTimerFrame`, re-submerges via `#176 Submerge` (`mode = 14` `MONMODE_SEQUENCE`)
 *   when no hostile is within `aip6` or (`dist > 6 && Rnd(100) < aip2`); otherwise spits
 *   `MissA1 = tentaclegoo` (`#139`, `mode = 4`) with `aip1` (`70/85/95%`) probability.
 */
function stepTentacleHeadAi(this: GameInstanceHost, monster: InternalMonsterRecord): void {
  const aip1SpitChance = Math.max(1, Math.min(100, monster.aiParams[0] || 70))
  const aip2SubmergeChance = Math.max(0, Math.min(100, monster.aiParams[1] || 50))
  const aip3SubmergedSec = Math.max(1, monster.aiParams[2] || 16)
  const aip4SurfacedSec = Math.max(1, monster.aiParams[3] || 12)
  const aip5IdleStall = Math.max(1, monster.aiParams[4] || 15)
  const aip6TriggerDist = Math.max(4, monster.aiParams[5] || 12)
  const hasDimVision = monster.states.has(23)

  if (monster.submerged || monster.submergeAiState === 1) {
    monster.submerged = true
    monster.submergeAiState = 1
    if (monster.mode !== 14) {
      monster.mode = 14
    }
    if (!hasDimVision && this.currentFrame >= monster.submergeTimerFrame) {
      const nearest = this.nearestHostileForMonster(monster, aip6TriggerDist)
      if (nearest !== null) {
        const dist = Math.hypot(nearest.x - monster.x, nearest.y - monster.y)
        if (dist < aip6TriggerDist) {
          monster.submerged = false
          monster.submergeAiState = 2
          monster.emergeUntilFrame = this.currentFrame + 21
          monster.submergeTimerFrame = this.currentFrame + aip4SurfacedSec * 25
          monster.cooldown = 21
          monster.nextAiFrame = this.currentFrame + 21
          this.emitMonsterSubmergeOrEmergeSkill(monster, 180, 8, nearest.x, nearest.y)
          return
        }
      }
    }
    monster.nextAiFrame = this.currentFrame + aip5IdleStall
    return
  }

  const searchDist = Math.max(aip6TriggerDist, 25)
  const nearest = hasDimVision ? null : this.nearestHostileForMonster(monster, searchDist)
  const dist = nearest !== null ? Math.hypot(nearest.x - monster.x, nearest.y - monster.y) : Infinity

  if (this.currentFrame > monster.submergeTimerFrame) {
    const shouldSubmerge =
      nearest === null ||
      dist > aip6TriggerDist ||
      (dist > 6 && this.rng.rand(100) < aip2SubmergeChance)
    if (shouldSubmerge) {
      monster.submerged = true
      monster.submergeAiState = 1
      monster.emergeUntilFrame = 0
      monster.pendingAttack = undefined
      monster.pendingAllyAttack = undefined
      monster.submergeTimerFrame = this.currentFrame + aip3SubmergedSec * 25
      monster.cooldown = 21
      monster.nextAiFrame = this.currentFrame + 21
      this.emitMonsterSubmergeOrEmergeSkill(
        monster,
        176,
        14,
        nearest?.x ?? monster.x,
        nearest?.y ?? monster.y,
      )
      return
    }
  }

  if (nearest !== null && dist <= 25 && monster.cooldown <= 0 && this.rng.rand(100) < aip1SpitChance) {
    const missName = monster.modeMissiles?.A1 || 'tentaclegoo'
    const missileRec = this.registry.getMissileByName(missName) ?? this.registry.getMissileById(139)
    const timing = this.monsterAttackTiming(monster, 'A1')
    monster.cooldown = Math.max(monster.cooldownTicks, timing.totalFrames)
    monster.mode = 4
    const lifePct =
      monster.maxHp > 0 ? Math.max(1, Math.round((monster.hp / monster.maxHp) * 128)) : 128
    this.broadcastToArea(monster.areaId, {
      type: 'UnitMode',
      unitType: 1,
      id: monster.unitId,
      mode: 4,
      at: { x: Math.round(monster.x), y: Math.round(monster.y) },
      lifePct,
    })
    const missileId = missileRec?.id ?? 139
    const diffIdx: 0 | 1 | 2 = this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0
    const modeMissileSlvl = resolveMonsterModeMissileSlvl113c(diffIdx)
    const mslEval =
      missileRec !== undefined
        ? evaluateMonsterMissileDamage113c({
            registry: this.registry,
            missile: missileRec,
            slvl: modeMissileSlvl,
            difficulty: diffIdx,
            monsterMinPhys: monster.minDmg,
            monsterMaxPhys: monster.maxDmg,
            attackMode: 'A1',
            elementalAttacks: monster.elementalAttacks,
            extraFirePct: monster.monProps.extraFirePct,
            rng: this.rng,
          })
        : undefined
    const physDamage = mslEval?.physDamage ?? 0
    const elemDamage =
      mslEval?.elemDamage ??
      Math.max(
        2,
        monster.minDmg + this.rng.rand(Math.max(0, monster.maxDmg - monster.minDmg) + 1),
      )
    const element = mslEval?.element ?? normalizeMissileElement(missileRec?.eType) ?? 'pois'
    const elemDurationFrames =
      mslEval !== undefined && mslEval.elemDurationFrames > 0
        ? mslEval.elemDurationFrames
        : element === 'pois'
          ? Math.max(50, missileRec?.eLen ?? 200)
          : 0
    this.spawnMonsterMissile(
      monster,
      nearest.x,
      nearest.y,
      Math.max(1, physDamage + elemDamage),
      missileId,
      0,
      {
        missile: missileRec,
        skillLevel: modeMissileSlvl,
        physDamage,
        elemDamage,
        element,
        ...(elemDurationFrames > 0 ? { elemDurationFrames } : {}),
      },
    )
    return
  }
}



/**
 * 1.13c `AiTentacle` (`D2Game.dll` `0x6FC9CB10`, `hcIdx 258..260`, token `TN`, `MeleeRng = 6`):
 * - `0x6FC9CB41..0x6FC9CBF1`: boss `TentacleHead` check — kills immediately if boss unit was
 *   removed, or with `40%` probability per AI tick once boss is dead (`DT`/`DD`).
 * - Submerged / surfaced `#180 Emerge` (`mode = 8`, 13 frames) & `#176 Submerge` (`mode = 14`,
 *   13 frames) coordinated with player proximity (`< aip6` / `<= 6`) and boss surfaced/submerged state.
 */
function stepTentacleAi(this: GameInstanceHost, monster: InternalMonsterRecord): void {
  const boss =
    monster.bossUnitId !== undefined ? this.monsters.get(monster.bossUnitId) : undefined
  if (monster.bossUnitId !== undefined) {
    if (boss === undefined || (boss.dead && this.rng.rand(100) < 40)) {
      monster.submerged = false
      monster.hp = 0
      this.applyMonsterDeath(monster, undefined, 'phys')
      return
    }
  }

  const aip1MeleeChance = Math.max(1, Math.min(100, monster.aiParams[0] || 60))
  const aip2SubmergeChance = Math.max(0, Math.min(100, monster.aiParams[1] || 50))
  const aip3SubmergedSec = Math.max(1, monster.aiParams[2] || 16)
  const aip4SurfacedSec = Math.max(1, monster.aiParams[3] || 12)
  const aip5IdleStall = Math.max(1, monster.aiParams[4] || 15)
  const aip6TriggerDist = Math.max(6, monster.aiParams[5] || 12)
  const hasDimVision = monster.states.has(23)

  if (monster.submerged || monster.submergeAiState === 1) {
    monster.submerged = true
    monster.submergeAiState = 1
    if (monster.mode !== 14) {
      monster.mode = 14
    }
    if (!hasDimVision && this.currentFrame >= monster.submergeTimerFrame) {
      const nearest = this.nearestHostileForMonster(monster, aip6TriggerDist)
      const dist = nearest !== null ? Math.hypot(nearest.x - monster.x, nearest.y - monster.y) : Infinity
      const bossSurfaced = boss !== undefined && !boss.dead && !boss.submerged
      if (dist < aip6TriggerDist || (bossSurfaced && this.rng.rand(100) < 5)) {
        monster.submerged = false
        monster.submergeAiState = 2
        monster.emergeUntilFrame = this.currentFrame + 13
        monster.submergeTimerFrame = this.currentFrame + aip4SurfacedSec * 25
        monster.cooldown = 13
        monster.nextAiFrame = this.currentFrame + 13
        this.emitMonsterSubmergeOrEmergeSkill(
          monster,
          180,
          8,
          nearest?.x ?? boss?.x ?? monster.x,
          nearest?.y ?? boss?.y ?? monster.y,
        )
        return
      }
    }
    monster.nextAiFrame = this.currentFrame + aip5IdleStall
    return
  }

  const nearest = hasDimVision ? null : this.nearestHostileForMonster(monster, aip6TriggerDist)
  const dist = nearest !== null ? Math.hypot(nearest.x - monster.x, nearest.y - monster.y) : Infinity
  const bossSubmerged = boss !== undefined && !boss.dead && boss.submerged

  if (this.currentFrame > monster.submergeTimerFrame) {
    const shouldSubmerge =
      nearest === null ||
      dist > aip6TriggerDist ||
      (dist > 6 && this.rng.rand(100) < aip2SubmergeChance) ||
      (bossSubmerged && this.rng.rand(100) < 50)
    if (shouldSubmerge) {
      monster.submerged = true
      monster.submergeAiState = 1
      monster.emergeUntilFrame = 0
      monster.pendingAttack = undefined
      monster.pendingAllyAttack = undefined
      monster.submergeTimerFrame = this.currentFrame + aip3SubmergedSec * 25
      monster.cooldown = 15
      monster.nextAiFrame = this.currentFrame + 15
      this.emitMonsterSubmergeOrEmergeSkill(
        monster,
        176,
        14,
        nearest?.x ?? monster.x,
        nearest?.y ?? monster.y,
      )
      return
    }
  }

  const meleeReach = Math.max(6, monster.meleeRange) + 1.5
  if (
    nearest !== null &&
    dist <= meleeReach &&
    monster.cooldown <= 0 &&
    monster.pendingAttack === undefined &&
    monster.pendingAllyAttack === undefined &&
    this.rng.rand(100) < aip1MeleeChance
  ) {
    if (nearest.kind === 'player') {
      this.beginMonsterMeleeAttack(monster, nearest.player)
    } else if (nearest.kind === 'merc') {
      monster.mode = 4
      this.broadcastToArea(monster.areaId, {
        type: 'UnitMode',
        unitType: 1,
        id: monster.unitId,
        mode: 4,
        at: { x: Math.round(monster.x), y: Math.round(monster.y) },
        lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 128,
      })
      this.beginMonsterMeleeAttackOnAlly(monster, {
        kind: 'merc',
        id: nearest.merc.unitId,
      })
    } else {
      monster.mode = 4
      this.broadcastToArea(monster.areaId, {
        type: 'UnitMode',
        unitType: 1,
        id: monster.unitId,
        mode: 4,
        at: { x: Math.round(monster.x), y: Math.round(monster.y) },
        lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 128,
      })
      this.beginMonsterMeleeAttackOnAlly(monster, {
        kind: 'pet',
        id: nearest.pet.uid,
      })
    }
  }
}



/**
 * 1.13c `FrogDemon` (`hcIdx 247..249`, token `FD`, `#176 Submerge` / `#180 Emerge`):
 * handles submerged ambush & disengage re-submerge; returns `true` when handled, or `false`
 * when surfaced in active combat so standard `FrogDemon` ranged/walk AI runs.
 */
function stepFrogDemonSubmergeAi(this: GameInstanceHost, monster: InternalMonsterRecord): boolean {
  const aip3SubmergedSec = Math.max(1, monster.aiParams[2] || 8)
  const aip4SurfacedSec = Math.max(1, monster.aiParams[3] || 6)
  const aip5TriggerDist = Math.max(8, monster.aiParams[4] || 20)
  const aip6IdleStall = Math.max(1, monster.aiParams[5] || 15)
  const hasDimVision = monster.states.has(23)

  if (monster.submerged || monster.submergeAiState === 1) {
    monster.submerged = true
    monster.submergeAiState = 1
    if (monster.mode !== 14) {
      monster.mode = 14
    }
    if (!hasDimVision && this.currentFrame >= monster.submergeTimerFrame) {
      const nearest = this.nearestHostileForMonster(monster, aip5TriggerDist)
      if (nearest !== null) {
        monster.submerged = false
        monster.submergeAiState = 2
        monster.emergeUntilFrame = this.currentFrame + 16
        monster.submergeTimerFrame = this.currentFrame + aip4SurfacedSec * 25
        monster.cooldown = 16
        monster.nextAiFrame = this.currentFrame + 16
        this.emitMonsterSubmergeOrEmergeSkill(monster, 180, 8, nearest.x, nearest.y)
        return true
      }
    }
    monster.nextAiFrame = this.currentFrame + aip6IdleStall
    return true
  }

  if (this.currentFrame > monster.submergeTimerFrame) {
    const nearest = hasDimVision ? null : this.nearestHostileForMonster(monster, aip5TriggerDist)
    if (nearest === null) {
      monster.submerged = true
      monster.submergeAiState = 1
      monster.emergeUntilFrame = 0
      monster.path = []
      monster.pathIndex = 0
      monster.pathTargetX = Number.NaN
      monster.pathTargetY = Number.NaN
      monster.submergeTimerFrame = this.currentFrame + aip3SubmergedSec * 25
      monster.cooldown = 16
      monster.nextAiFrame = this.currentFrame + 16
      this.emitMonsterSubmergeOrEmergeSkill(monster, 176, 14, monster.x, monster.y)
      return true
    }
  }
  return false
}



function stepMonsterAi(this: GameInstanceHost, monster: InternalMonsterRecord): void {
  if (
    !monster.submerged &&
    monster.mode === 8 &&
    monster.emergeUntilFrame > 0 &&
    this.currentFrame >= monster.emergeUntilFrame
  ) {
    monster.emergeUntilFrame = 0
    monster.mode = 1
    this.broadcastToArea(monster.areaId, {
      type: 'UnitMode',
      unitType: 1,
      id: monster.unitId,
      mode: 1,
      lifePct:
        monster.maxHp > 0 ? Math.max(1, Math.round((monster.hp / monster.maxHp) * 128)) : 128,
    })
  }
  if (
    monster.pendingBaalWaveSpawn !== undefined &&
    this.currentFrame >= monster.pendingBaalWaveSpawn.frame
  ) {
    const pending = monster.pendingBaalWaveSpawn
    monster.pendingBaalWaveSpawn = undefined
    this.spawnSuperUnique({
      superUniqueIndex: pending.superUniqueIndex,
      x: pending.x,
      y: pending.y,
      areaId: monster.areaId,
    })
  }
  if (monster.cooldown > 0) {
    monster.cooldown--
  }
  if (monster.skillCooldown > 0) {
    monster.skillCooldown--
  }
  if (this.stepBossChannelsAndSummonLifespans113c(monster)) {
    return
  }
  // GetHit / Knockback animation lock: the monster may not start a new action while the
  // GH animation plays (1.13c AnimData `GH`, D2Game.dll 0x6FC95070 / 0x6FC965E0).
  // DRLG oracle path: a type-2 AI event that was already pending when the GH started still fires and its
  // think replaces the GH mode (oracle `p52-necromancer-poison-golem` zombie #9: GH F823, event F833 ->
  // A2 on F833 while the 17-frame GH would run to F840).
  const drlgAiEventInterruptsGh =
    this.drlgRoomPopulator !== null && monster.mode === 3 && this.currentFrame >= monster.nextAiFrame
  if (this.currentFrame < monster.hitRecoveryUntilFrame && !drlgAiEventInterruptsGh) {
    return
  }
  if (drlgAiEventInterruptsGh) monster.hitRecoveryUntilFrame = this.currentFrame
  if (monster.mode === MONMODE_KNOCKBACK || (this.drlgRoomPopulator !== null && monster.mode === 3)) {
    monster.mode = 1
  }
  if (this.drlgRoomPopulator !== null) {
    stepDrlgMonsterAi113c.call(this, monster)
    return
  }
  const isConverted = this.isMonsterConverted(monster)
  const aiProfile = monsterProfile113c(monster.ai)
  const aiBehavior = aiProfile.family
  // MonStats `aidel` is the AI think interval (aip1..8 carry behavior-specific values).
  const aiInterval = Math.max(1, Math.round(monster.aiDelay || 15))
  const thinkDue = this.currentFrame >= monster.nextAiFrame
  if (thinkDue) monster.nextAiFrame = this.currentFrame + aiInterval

  // F11.4: Freeze (1 / 29) or Stun (21 / 25) completely halts monster movement & attack
  if (
    !monster.submerged &&
    (monster.states.has(1) ||
      monster.states.has(29) ||
      monster.states.has(21) ||
      monster.states.has(25) ||
      monster.frozenTicks > 0)
  ) {
    monster.pendingAttack = undefined
    monster.pendingAllyAttack = undefined
    monster.pendingResurrection = undefined
    // Frozen / stunned units hold the neutral animation frame; broadcast the mode
    // transition once so clients stop the previous attack or walk clip.
    if (monster.mode !== 1) {
      monster.mode = 1
      this.broadcastToArea(monster.areaId, {
        type: 'UnitMode',
        unitType: 1,
        id: monster.unitId,
        mode: 1,
        lifePct:
          monster.maxHp > 0
            ? Math.max(0, Math.round((monster.hp / monster.maxHp) * 128))
            : 0,
      })
    }
    monster.path = []
    monster.pathIndex = 0
    monster.pathTargetX = Number.NaN
    monster.pathTargetY = Number.NaN
    return
  }

  // Frame-based timers advance every tick, even between AI think frames.
  if (monster.fleeTicks > 0) {
    monster.fleeTicks--
    if (monster.fleeTicks === 0) {
      monster.fleeTargetX = Number.NaN
      monster.fleeTargetY = Number.NaN
    }
  } else if (!monster.states.has(56)) {
    monster.fleeTargetX = Number.NaN
    monster.fleeTargetY = Number.NaN
  }
  if (monster.wanderCooldown > 0) monster.wanderCooldown--

  // 1.13c `dwNextAiFrame`: only re-run the decision state machine every
  // `aidel` frames. Movement along the already-chosen path stays continuous.
  if (!thinkDue) {
    if (
      monster.path.length > 0 &&
      Number.isFinite(monster.pathTargetX) &&
      Number.isFinite(monster.pathTargetY)
    ) {
      this.moveMonsterToward(
        monster,
        monster.pathTargetX,
        monster.pathTargetY,
        monster.pathRunning,
      )
    }
    return
  }

  // 1.13c `AITHINK_Fn028_Vampire` (`D2Game.dll` `0x6FCA6954`, #2007):
  // Decrement `dwAiParam4` (`vampireUpgradeCooldownTicks`) by `1` per AI think tick when `> 0`.
  if (
    normalizeMonAiName113c(monster.ai) === 'vampire' &&
    monster.vampireUpgradeCooldownTicks > 0
  ) {
    monster.vampireUpgradeCooldownTicks -= 1
  }

  // 1.13c `AIGENERAL_Think` (`D2Game.dll` `0x6FCBD4A2` -> `AI_TryTeleportUMod` `0x6FCBCDE0`, #1993):
  // Evaluates `MonUMod #26` (`Teleport`) on boss units (`rank !== 'minion'`) before dispatching `pfnAiThink`.
  if (
    monster.rank !== 'minion' &&
    monster.umodIds.includes(MON_UMOD.TELEPORT) &&
    !monster.submerged &&
    !isConverted &&
    this.currentFrame >= monster.teleportCooldownUntilFrame
  ) {
    const isBossOrUniqueEarly =
      monster.isBoss || monster.isPrimeEvil || monster.rank === 'unique'
    const hasDimVisionEarly = !isBossOrUniqueEarly && monster.states.has(23)
    const hasTauntEarly = !isBossOrUniqueEarly && monster.states.has(27)
    const aggroEarly = hasDimVisionEarly && !hasTauntEarly ? 3.5 : monster.aggroRadius
    let teleportTarget = this.nearestHostileForMonster(monster, aggroEarly)
    if (!teleportTarget && this.currentFrame <= monster.threatUntilFrame) {
      const threat = this.players.get(monster.threatPlayerId)
      if (
        threat !== undefined &&
        !threat.dead &&
        this.isAreaSeamAdjacent(monster.areaId, threat.areaId) &&
        Math.hypot(threat.x - monster.x, threat.y - monster.y) <=
          Math.max(aggroEarly, MONSTER_ACTIVATION_RADIUS_SUBTILES)
      ) {
        teleportTarget = { kind: 'player', x: threat.x, y: threat.y, player: threat }
      }
    }
    if (
      teleportTarget &&
      this.teleportEliteAwayFrom(monster, { x: teleportTarget.x, y: teleportTarget.y })
    ) {
      return
    }
  }

  if (monster.ai === 'BaalThrone') {
    this.stepBaalThroneAi(monster)
    return
  }
  if (monster.ai === 'BaalToStairs') {
    this.stepBaalToStairsAi(monster)
    return
  }
  if (isTentacleHeadHcIdx113c(monster.hcIdx)) {
    this.stepTentacleHeadAi(monster)
    return
  }
  if (isTentacleHcIdx113c(monster.hcIdx)) {
    this.stepTentacleAi(monster)
    return
  }
  if (isBaalTentacleHcIdx113c(monster.hcIdx)) {
    this.stepBaalTentacleAi113c(monster)
    return
  }
  if (monster.hcIdx === 242 || monster.hcIdx === 704) {
    this.stepUberMephistoBossAi113c(monster)
    return
  }
  if (monster.hcIdx === 243 || monster.hcIdx === 333 || monster.hcIdx === 705) {
    this.stepDiabloBossAi113c(monster)
    return
  }
  if (monster.hcIdx === 544 || monster.hcIdx === 570 || monster.hcIdx === 709) {
    this.stepBaalCrabBossAi113c(monster)
    return
  }
  if (monster.hcIdx === 540 || monster.hcIdx === 541 || monster.hcIdx === 542) {
    this.stepAncientBarbAi113c(monster)
    return
  }
  if (isFrogDemonHcIdx113c(monster.hcIdx) && this.stepFrogDemonSubmergeAi(monster)) {
    return
  }
  // `#1892` `MaggotEgg` (`maggotegg1..6` `hcIdx 190..194, 681`): hatches into `maggotbaby1..6` (`180..184, 680`)
  // when `currentFrame >= hatchAtFrame` and a hostile is in range (`0` XP, `0` drops on hatched shell & larvae).
  if (monster.ai === 'MaggotEgg') {
    if (monster.hatchAtFrame > 0 && this.currentFrame >= monster.hatchAtFrame) {
      const nearHostile = this.nearestHostileForMonster(monster, 30)
      if (nearHostile !== null || this.players.size === 0) {
        const babyHcIdx =
          monster.hcIdx === 681
            ? 680
            : 180 + Math.max(0, Math.min(4, monster.hcIdx - 190))
        const babyDefId =
          babyHcIdx === 680 ? 'maggotbaby6' : `maggotbaby${String(babyHcIdx - 179)}`
        const larvaCount = Math.max(2, Math.min(5, monster.skills[0]?.level ?? 2))
        this.emitBossSkillCast113c(monster, 159, larvaCount, 8, monster.x, monster.y)
        for (let i = 0; i < larvaCount; i++) {
          const ang = ((i * (360 / larvaCount)) * Math.PI) / 180
          const bx = monster.x + Math.cos(ang) * 1.1
          const by = monster.y + Math.sin(ang) * 1.1
          if (
            !this.terrainWalkableCheck ||
            this.terrainWalkableCheck(monster.areaId, Math.round(bx), Math.round(by), false)
          ) {
            this.spawnMonster({
              classId: babyHcIdx,
              hcIdx: babyHcIdx,
              defId: babyDefId,
              x: bx,
              y: by,
              areaId: monster.areaId,
              level: monster.level,
              experience: 0,
              alreadyGrantedKillRewards: true,
            })
          }
        }
        monster.hp = 0
        monster.dead = true
        monster.shattered = true
        monster.corpseConsumed = true
        monster.mode = 12
        monster.alreadyGrantedKillRewards = true
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: monster.unitId,
          mode: 12,
          lifePct: 0,
        })
      }
    }
    return
  }
  // `#1895` `SandMaggot` (`sandmaggot1..7` `hcIdx 68..72, 679, 716`):
  // `#162 MagottDown` burrow -> `#161 MagottUp` surface -> `#163 MagottLay` egg laying (`aip3` cap).
  if (monster.ai === 'SandMaggot') {
    if (monster.submerged) {
      if (this.currentFrame >= monster.submergeTimerFrame) {
        monster.submerged = false
        monster.submergeAiState = 2
        monster.mode = 8
        monster.submergeTimerFrame = this.currentFrame + 75
        this.emitBossSkillCast113c(monster, 161, 1, 8, monster.x, monster.y)
      }
      return
    }
    const maggotTarget = this.nearestHostileForMonster(monster, monster.aggroRadius)
    if (maggotTarget !== null) {
      const eggCap = Math.max(1, monster.aiParams[2] || 2)
      if (
        monster.spawnedChildren < eggCap &&
        monster.skillCooldown <= 0 &&
        monster.cooldown <= 0 &&
        this.rng.rand(100) < 45
      ) {
        const eggHcIdx =
          monster.hcIdx >= 68 && monster.hcIdx <= 72 ? 190 + (monster.hcIdx - 68) : 681
        const eggDefId =
          eggHcIdx === 681 ? 'maggotegg6' : `maggotegg${String(eggHcIdx - 189)}`
        const ang = (this.rng.rand(360) * Math.PI) / 180
        const ex = monster.x + Math.cos(ang) * 1.5
        const ey = monster.y + Math.sin(ang) * 1.5
        if (
          !this.terrainWalkableCheck ||
          this.terrainWalkableCheck(monster.areaId, Math.round(ex), Math.round(ey), false)
        ) {
          this.emitBossSkillCast113c(monster, 163, 1, 8, ex, ey)
          this.spawnMonster({
            classId: eggHcIdx,
            hcIdx: eggHcIdx,
            defId: eggDefId,
            x: ex,
            y: ey,
            areaId: monster.areaId,
            level: monster.level,
            experience: 0,
            alreadyGrantedKillRewards: true,
          })
          monster.spawnedChildren += 1
          monster.skillCooldown = 65
          monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
          return
        }
      }
      if (
        this.currentFrame >= monster.submergeTimerFrame &&
        monster.skillCooldown <= 0 &&
        Math.hypot(maggotTarget.x - monster.x, maggotTarget.y - monster.y) > 3.5 &&
        this.rng.rand(100) < 25
      ) {
        monster.submerged = true
        monster.submergeAiState = 1
        monster.mode = 14
        monster.submergeTimerFrame = this.currentFrame + 45
        this.emitBossSkillCast113c(monster, 162, 1, 14, monster.x, monster.y)
        return
      }
    }
  }
  // `#1894` Mounted `Imp` riding `SiegeBeast` (`441..445`) or `BarricadeTower` (`435`):
  // Syncs coordinates to carrier and casts ranged fire skills from carrier's back without walking away.
  if (monster.mountedOnUnitId !== undefined) {
    const carrier = this.monsters.get(monster.mountedOnUnitId)
    if (carrier === undefined || carrier.dead || carrier.areaId !== monster.areaId) {
      if (carrier !== undefined && carrier.mountedImpUnitId === monster.unitId) {
        carrier.mountedImpUnitId = undefined
      }
      monster.mountedOnUnitId = undefined
    } else {
      monster.x = carrier.x
      monster.y = carrier.y
      const mountedHostile = this.nearestHostileForMonster(monster, Math.max(20, monster.aggroRadius))
      if (mountedHostile !== null && monster.skillCooldown <= 0) {
        const mDist = Math.hypot(mountedHostile.x - monster.x, mountedHostile.y - monster.y)
        this.tryCastMonsterSkill(monster, mountedHostile, mDist)
      }
      return
    }
  }

  // Chill/Decrepify/Holy Freeze slow movement by their 1.13c percentages.
  const isSlowed = this.monsterSlowPercent(monster) > 0
  const normAiKey = normalizeMonAiName113c(monster.ai)

  // `#2005`: 1.13c passive / controller AIs (`None` `0x6FCBC990`, `Idle` `0x6FCBCB00`, `BoneWall` `0x6FC36410`,
  // `7TIllusion` `0x6FCC4B90`, `DarkWanderer` `0x6FCC6E60`, `AncientStatue` `0x6FCC4F40`, `InvisoSpawner` `0x6FC3BCA0`,
  // `InvisoPet` `0x6FCC5350`, non-combat NPC AIs) and Neutral `Align = 2` rows (`#179 cow`) never fight or chase.
  if (monster.align === 2 || isPassiveMonsterAi113c(monster.ai)) {
    monster.nextAiFrame = Math.max(
      monster.nextAiFrame,
      this.currentFrame + (normAiKey === 'idle' ? 200 : 50),
    )
    return
  }

  // `#2005`: 1.13c `#97 Spirit` (`AITHINK_Fn097_Spirit` @ `0x6FC360B0`, `hcIdx 401 mephistospirit`):
  // Checks `pAiControl->dwAiFlags3` (`spiritAttackedOnce`). Swings `MONMODE_ATTACK1` (`mode = 4`) at most once
  // when a hostile enters melee range, then permanently calls `AI_SetIdle(pGame, pMonster, 50)`.
  if (normAiKey === 'spirit') {
    if (monster.spiritAttackedOnce) {
      monster.nextAiFrame = Math.max(monster.nextAiFrame, this.currentFrame + 50)
      return
    }
    const spiritReach = Math.max(2.5, monster.meleeRange + 1.5)
    const spiritTarget = this.nearestHostileForMonster(monster, spiritReach)
    if (
      spiritTarget !== null &&
      Math.hypot(spiritTarget.x - monster.x, spiritTarget.y - monster.y) <= spiritReach &&
      monster.cooldown <= 0 &&
      monster.pendingAttack === undefined &&
      monster.pendingAllyAttack === undefined
    ) {
      monster.spiritAttackedOnce = true
      monster.cooldown = Math.max(50, monster.cooldownTicks)
      monster.nextAiFrame = this.currentFrame + 50
      if (spiritTarget.kind === 'player') {
        this.beginMonsterMeleeAttack(monster, spiritTarget.player)
      } else if (spiritTarget.kind === 'merc') {
        monster.mode = 4
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: monster.unitId,
          mode: 4,
          at: { x: Math.round(spiritTarget.merc.x), y: Math.round(spiritTarget.merc.y) },
          lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
        })
        this.beginMonsterMeleeAttackOnAlly(monster, { kind: 'merc', id: spiritTarget.merc.unitId })
      } else {
        monster.mode = 4
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: monster.unitId,
          mode: 4,
          at: { x: Math.round(spiritTarget.pet.x), y: Math.round(spiritTarget.pet.y) },
          lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
        })
        this.beginMonsterMeleeAttackOnAlly(monster, { kind: 'pet', id: spiritTarget.pet.uid })
      }
    } else {
      monster.nextAiFrame = Math.max(monster.nextAiFrame, this.currentFrame + 15)
    }
    return
  }

  // `#2005`: 1.13c `#99 TrappedSoul` (`AITHINK_Fn099_TrappedSoul` @ `0x6FCC5580`, `hcIdx 403..404 trappedsoul1..2`):
  // Harmless proximity fidget (`MONMODE_SKILL2 = 9` wake when player `< 5` subtiles, visual fidget modes `4/5`
  // without `SUnitDmg`, `MONMODE_SKILL1 = 8` return-to-rest when no player `< 5` subtiles). Never deals melee damage.
  if (normAiKey === 'trappedsoul') {
    let nearPlayer: InternalPlayerRecord | undefined
    for (const p of this.players.values()) {
      if (p.dead || p.areaId !== monster.areaId) continue
      if (Math.hypot(p.x - monster.x, p.y - monster.y) < 5) {
        nearPlayer = p
        break
      }
    }
    const lifePct = monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0
    if (monster.trappedSoulState === 0) {
      if (nearPlayer !== undefined) {
        monster.trappedSoulState = 1
        monster.mode = 9
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: monster.unitId,
          mode: 9,
          at: { x: Math.round(nearPlayer.x), y: Math.round(nearPlayer.y) },
          lifePct,
        })
        monster.nextAiFrame = this.currentFrame + 35
      } else {
        monster.nextAiFrame = this.currentFrame + 15
      }
    } else if (nearPlayer === undefined) {
      monster.trappedSoulState = 0
      monster.mode = 8
      this.broadcastToArea(monster.areaId, {
        type: 'UnitMode',
        unitType: 1,
        id: monster.unitId,
        mode: 8,
        at: { x: Math.round(monster.x), y: Math.round(monster.y) },
        lifePct,
      })
      monster.nextAiFrame = this.currentFrame + 15
    } else {
      const roll = this.rng.rand(100)
      if (roll < 70) {
        const fidgetMode = roll < 35 ? 4 : 5
        monster.mode = fidgetMode
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: monster.unitId,
          mode: fidgetMode,
          at: { x: Math.round(nearPlayer.x), y: Math.round(nearPlayer.y) },
          lifePct,
        })
      }
      monster.nextAiFrame = this.currentFrame + 35
    }
    return
  }

  // `#2005`: 1.13c Good/Friendly (`Align = 1`) world monsters (`#522..523 act5barb1..2` `NpcBarb` @ `0x6FCC66E0`,
  // `#534 act5pow` `Wussie` @ `0x6FCC7A10`, `#535..536 act5barb3..4`, ambient critters):
  // Never target players, mercenaries, or player pets. `NpcBarb` engages nearby evil (`align === 0`) monsters.
  if (monster.align === 1) {
    if (normAiKey === 'npcbarb') {
      let barbTarget: InternalMonsterRecord | undefined
      let bestEvilDist = Math.max(1, monster.aggroRadius)
      for (const other of this.monsters.values()) {
        if (
          other.unitId === monster.unitId ||
          other.align !== 0 ||
          other.dead ||
          other.isNpc ||
          !other.isKillable ||
          other.submerged ||
          this.isMonsterConverted(other) ||
          isBonePrisonMonsterHcIdx113c(other.hcIdx) ||
          other.areaId !== monster.areaId
        ) {
          continue
        }
        const d = Math.hypot(other.x - monster.x, other.y - monster.y)
        if (d < bestEvilDist) {
          bestEvilDist = d
          barbTarget = other
        }
      }
      if (barbTarget !== undefined) {
        if (bestEvilDist <= 2.5) {
          if (monster.cooldown <= 0) {
            monster.cooldown = monster.cooldownTicks
            this.attackMonsterTarget(monster, barbTarget)
          }
        } else {
          this.moveMonsterToward(monster, barbTarget.x, barbTarget.y, bestEvilDist > 5 && !isSlowed)
        }
        return
      }
      if (Math.hypot(monster.homeX - monster.x, monster.homeY - monster.y) > 12) {
        this.moveMonsterToward(monster, monster.homeX, monster.homeY, false)
        return
      }
      if (monster.wanderCooldown <= 0) {
        const angle = (this.rng.rand(360) * Math.PI) / 180
        const radius = 1 + this.rng.rand(4)
        const tx = monster.homeX + Math.cos(angle) * radius
        const ty = monster.homeY + Math.sin(angle) * radius
        if (
          !this.isClosedDoorAt(monster.areaId, Math.round(tx), Math.round(ty)) &&
          (!this.terrainWalkableCheck ||
            this.terrainWalkableCheck(monster.areaId, Math.round(tx), Math.round(ty), false))
        ) {
          this.moveMonsterToward(monster, tx, ty, false)
        }
        monster.wanderCooldown = 45 + this.rng.rand(60)
      }
    }
    return
  }

  // Terror (56) or pack morale fleeTicks causes non-boss monsters to flee away from player (overridden by Taunt 27)
  const isBossOrUnique =
    monster.isBoss || monster.isPrimeEvil || monster.rank === 'unique'
  const hasTaunt = !isBossOrUnique && monster.states.has(27)
  if (hasTaunt && monster.fleeTicks > 0) {
    monster.fleeTicks = 0
    monster.fleeTargetX = Number.NaN
    monster.fleeTargetY = Number.NaN
  }
  const isTerrified =
    !isBossOrUnique &&
    !hasTaunt &&
    (monster.states.has(56) || monster.fleeTicks > 0)

  if (!isTerrified) {
    monster.fleeOriginX = Number.NaN
    monster.fleeOriginY = Number.NaN
  }

  if (isTerrified) {
    const hasWardOrigin =
      Number.isFinite(monster.fleeOriginX) && Number.isFinite(monster.fleeOriginY)
    let nearestPlayer: InternalPlayerRecord | undefined
    let minPlayerDist = Infinity
    for (const p of this.players.values()) {
      if (p.dead || p.areaId !== monster.areaId) continue
      const d = Math.hypot(p.x - monster.x, p.y - monster.y)
      if (d < minPlayerDist) {
        minPlayerDist = d
        nearestPlayer = p
      }
    }
    const fearOriginX = hasWardOrigin ? monster.fleeOriginX : nearestPlayer?.x
    const fearOriginY = hasWardOrigin ? monster.fleeOriginY : nearestPlayer?.y
    if (fearOriginX !== undefined && fearOriginY !== undefined) {
      const targetValid =
        Number.isFinite(monster.fleeTargetX) &&
        Number.isFinite(monster.fleeTargetY) &&
        Math.hypot(monster.fleeTargetX - monster.x, monster.fleeTargetY - monster.y) > 1
      if (!targetValid) {
        const dx = monster.x - fearOriginX
        const dy = monster.y - fearOriginY
        const dist = Math.hypot(dx, dy) || 1
        // 1.13c fear uses the path finder, not a straight-line shove: pick the
        // first walkable point roughly away from the fear source so walls are routed around.
        const baseAngle = Math.atan2(dy, dx)
        let fleeX = monster.x + (dx / dist) * 8
        let fleeY = monster.y + (dy / dist) * 8
        for (const offset of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6]) {
          const cx = monster.x + Math.cos(baseAngle + offset) * 8
          const cy = monster.y + Math.sin(baseAngle + offset) * 8
          if (
            !this.isClosedDoorAt(monster.areaId, Math.round(cx), Math.round(cy)) &&
            !this.isBlockedByBonePrison(monster.areaId, Math.round(cx), Math.round(cy)) &&
            (!this.terrainWalkableCheck ||
              this.terrainWalkableCheck(
                monster.areaId,
                Math.round(cx),
                Math.round(cy),
                monster.isFlying,
              ))
          ) {
            fleeX = cx
            fleeY = cy
            break
          }
        }
        monster.fleeTargetX = fleeX
        monster.fleeTargetY = fleeY
      }
      this.moveMonsterToward(
        monster,
        monster.fleeTargetX,
        monster.fleeTargetY,
        true,
      )
    }
    return
  }

  // Conversion (53), Confuse (59), or nearby Attract (57) monster-vs-monster targeting.
  // Converted monsters fight for the caster and ignore players; normal monsters
  // treat converted ones as their new enemies.
  let monsterTarget: InternalMonsterRecord | undefined
  if (isConverted) {
    let bestMDist = 40
    for (const other of this.monsters.values()) {
      if (
        other.unitId === monster.unitId ||
        other.dead ||
        other.isNpc ||
        other.align !== 0 ||
        other.areaId !== monster.areaId ||
        this.isMonsterConverted(other)
      ) {
        continue
      }
      const d = Math.hypot(other.x - monster.x, other.y - monster.y)
      if (d < bestMDist) {
        bestMDist = d
        monsterTarget = other
      }
    }
  } else if (!isBossOrUnique && !hasTaunt && monster.states.has(59)) {
    let bestMDist = Infinity
    for (const other of this.monsters.values()) {
      if (
        other.unitId === monster.unitId ||
        other.dead ||
        other.isNpc ||
        other.align !== 0 ||
        other.areaId !== monster.areaId ||
        this.isMonsterConverted(other)
      ) {
        continue
      }
      const d = Math.hypot(other.x - monster.x, other.y - monster.y)
      if (d < bestMDist) {
        bestMDist = d
        monsterTarget = other
      }
    }
  } else if (!isBossOrUnique && !hasTaunt) {
    // Attract is a curse on the target; nearby monsters engage it within their own
    // MonStats `aidist`-derived aggro radius (not a hardcoded 20), plus friendly `NpcBarb` soldiers (#2005).
    let bestAttractDist = Math.max(1, monster.aggroRadius)
    for (const other of this.monsters.values()) {
      if (
        other.unitId === monster.unitId ||
        other.dead ||
        other.isNpc ||
        other.areaId !== monster.areaId
      ) {
        continue
      }
      const converted = this.isMonsterConverted(other)
      const attracted = other.states.has(57)
      const boneWall = other.boneConstructOwnerPlayerId !== undefined
      const friendlySoldier =
        other.align === 1 &&
        other.isKillable &&
        !other.submerged &&
        normalizeMonAiName113c(other.ai) === 'npcbarb'
      if (!converted && !attracted && !boneWall && !friendlySoldier) continue
      const d = Math.hypot(other.x - monster.x, other.y - monster.y)
      const maxEngageDist = boneWall && !converted && !attracted ? 4.5 : bestAttractDist
      if (d < maxEngageDist && d < bestAttractDist) {
        bestAttractDist = d
        monsterTarget = other
      }
    }
  }

  // 1.13c `#81 Dim Vision` (`state 23`) & `#264 Cloak of Shadows` (`state 156` `cloaked`, #1944):
  // Both blind non-boss, non-unique, non-champion monsters (`MONSTER_GetAiStatus` returns blind).
  const hasDimVision =
    !isBossOrUnique &&
    (monster.states.has(23) ||
      (monster.states.has(156) &&
        monster.rank !== 'champion' &&
        monster.superUniqueId === undefined))

  if (monsterTarget) {
    const mDist = Math.hypot(
      monsterTarget.x - monster.x,
      monsterTarget.y - monster.y,
    )
    if (normalizeMonAiName113c(monster.ai) === 'vampire') {
      this.stepVampireTargetAi113c(
        monster,
        { kind: 'monster', x: monsterTarget.x, y: monsterTarget.y, monster: monsterTarget },
        mDist,
        hasDimVision,
        hasTaunt,
      )
      return
    }
    // Confused/converted/attracted casters and archers keep their ranged Skill1..8
    // and MissA1/A2/S1/C attacks against the hostile monster instead of walking into melee.
    if (
      !hasDimVision &&
      !hasTaunt &&
      mDist > 2.5 &&
      this.tryCastMonsterSkill(monster, monsterTarget, mDist, { hitMonsters: true })
    ) {
      return
    }
    const preferredShootMode: 'S1' | 'A2' | 'A1' =
      monster.modeMissiles?.S1 !== undefined && monster.maxDmg <= 1
        ? 'S1'
        : monster.modeMissiles?.A2 !== undefined &&
            monster.hasAttack2 &&
            this.rng.rand(2) === 0
          ? 'A2'
          : 'A1'
    const selectedShootMode: 'A1' | 'A2' | 'S1' | 'C' =
      monster.modeMissiles?.[preferredShootMode] !== undefined
        ? preferredShootMode
        : monster.modeMissiles?.S1 !== undefined
          ? 'S1'
          : monster.modeMissiles?.A2 !== undefined
            ? 'A2'
            : monster.modeMissiles?.A1 !== undefined
              ? 'A1'
              : 'C'
    const monsterShootMissile = monster.modeMissiles?.[selectedShootMode]
    const isConvertedGreaterMummy = monster.ai === 'GreaterMummy'
    if (
      (monster.isRanged || aiProfile.ranged || isConvertedGreaterMummy) &&
      !hasDimVision &&
      !hasTaunt &&
      monsterShootMissile !== undefined &&
      (isConvertedGreaterMummy ? mDist > 1.5 && mDist < 5 : mDist > 2.5 && mDist <= monsterShootRange(monster)) &&
      monster.cooldown <= 0
    ) {
      const missileRec = this.registry.getMissileByName(monsterShootMissile)
      if (missileRec !== undefined) {
        const attackMode = this.monsterSkillMode(selectedShootMode)
        monster.cooldown = monster.cooldownTicks
        monster.mode = attackMode
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: monster.unitId,
          mode: attackMode,
          at: { x: Math.round(monsterTarget.x), y: Math.round(monsterTarget.y) },
          lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
        })
        const modeMinPhys =
          selectedShootMode === 'C'
            ? 0
            : selectedShootMode === 'S1'
              ? monster.special1MinDmg
              : selectedShootMode === 'A2'
                ? monster.attack2MinDmg
                : monster.minDmg
        const modeMaxPhys =
          selectedShootMode === 'C'
            ? 0
            : selectedShootMode === 'S1'
              ? monster.special1MaxDmg
              : selectedShootMode === 'A2'
                ? monster.attack2MaxDmg
                : monster.maxDmg
        const diffIdx: 0 | 1 | 2 = this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0
        const modeMissileSlvl = resolveMonsterModeMissileSlvl113c(diffIdx)
        const mslEval = evaluateMonsterMissileDamage113c({
          registry: this.registry,
          missile: missileRec,
          slvl: modeMissileSlvl,
          difficulty: diffIdx,
          monsterMinPhys: modeMinPhys,
          monsterMaxPhys: modeMaxPhys,
          attackMode: selectedShootMode,
          elementalAttacks: monster.elementalAttacks,
          extraFirePct: monster.monProps.extraFirePct,
          rng: this.rng,
        })
        const physDamage =
          mslEval.totalDamage > 0
            ? mslEval.physDamage
            : this.rollInclusive(modeMinPhys, modeMaxPhys)
        const elemDamage = mslEval.elemDamage
        const element = mslEval.element
        this.spawnMonsterMissile(
          monster,
          monsterTarget.x,
          monsterTarget.y,
          Math.max(1, physDamage + elemDamage),
          missileRec.id,
          0,
          {
            missile: missileRec,
            skillLevel: modeMissileSlvl,
            hitMonsters: true,
            physDamage,
            elemDamage,
            element,
            ...(mslEval.elemDurationFrames > 0
              ? { elemDurationFrames: mslEval.elemDurationFrames }
              : {}),
          },
        )
        return
      }
    }
    if (mDist <= 2.5) {
      if (monster.cooldown <= 0) {
        monster.cooldown = monster.cooldownTicks
        this.attackMonsterTarget(monster, monsterTarget)
      }
    } else {
      this.moveMonsterToward(monster, monsterTarget.x, monsterTarget.y, mDist > 5)
    }
    return
  }

  // Converted monsters never fall through to the player-hostile path.
  if (isConverted) return

  // `#2010`: `AIGENERAL_Think` (`D2Game.dll` `0x6FCBD494 -> 0x6FCBD160 -> 0x6FD13220`) gates every
  // `nTargetMode = 1` AI row (`g_MonAiTable` `0x6FD2E788`, all 104 hostile combat/healer/shaman/boss AIs)
  // on acquiring a valid hostile `pTarget` before invoking `pfnAiThink` (`0x6FCBD4E9`).
  const effectiveAggro = hasDimVision && !hasTaunt ? 3.5 : monster.aggroRadius

  let nearest = this.nearestHostileForMonster(monster, effectiveAggro)
  // Being attacked pulls the monster's attention even when the attacker is
  // outside its normal `aidist` (1.13c last-attacker threat), without
  // overriding a closer visible hostile (such as a mercenary or summon in melee).
  if (!nearest && this.currentFrame <= monster.threatUntilFrame) {
    const threat = this.players.get(monster.threatPlayerId)
    if (
      threat !== undefined &&
      !threat.dead &&
      this.isAreaSeamAdjacent(monster.areaId, threat.areaId) &&
      Math.hypot(threat.x - monster.x, threat.y - monster.y) <=
        Math.max(effectiveAggro, MONSTER_ACTIVATION_RADIUS_SUBTILES)
    ) {
      nearest = { kind: 'player', x: threat.x, y: threat.y, player: threat }
    }
  }
  if (!nearest) {
    // Return to the DRLG spawn anchor when pulled too far away.
    if (Math.hypot(monster.homeX - monster.x, monster.homeY - monster.y) > 12) {
      this.moveMonsterToward(monster, monster.homeX, monster.homeY, false)
      monster.wanderTargetX = Number.NaN
      monster.wanderTargetY = Number.NaN
      return
    }
    // 1.13c idle AI: stationary rows stay put, others wander a few sub-tiles
    // around their spawn anchor between fights.
    if (aiBehavior === 'stationary') return
    if (
      Number.isFinite(monster.wanderTargetX) &&
      Number.isFinite(monster.wanderTargetY)
    ) {
      const remaining = Math.hypot(
        monster.wanderTargetX - monster.x,
        monster.wanderTargetY - monster.y,
      )
      if (remaining > 0.75) {
        this.moveMonsterToward(
          monster,
          monster.wanderTargetX,
          monster.wanderTargetY,
          false,
        )
        return
      }
      monster.wanderTargetX = Number.NaN
      monster.wanderTargetY = Number.NaN
      monster.wanderCooldown = 60 + this.rng.rand(90)
    }
    if (monster.wanderCooldown <= 0) {
      const angle = (this.rng.rand(360) * Math.PI) / 180
      const radius = 1 + this.rng.rand(4)
      const tx = monster.homeX + Math.cos(angle) * radius
      const ty = monster.homeY + Math.sin(angle) * radius
      if (
        !this.isClosedDoorAt(monster.areaId, Math.round(tx), Math.round(ty)) &&
        (!this.terrainWalkableCheck ||
          this.terrainWalkableCheck(monster.areaId, Math.round(tx), Math.round(ty), monster.isFlying))
      ) {
        monster.wanderTargetX = tx
        monster.wanderTargetY = ty
        monster.wanderCooldown = 45 + this.rng.rand(60)
      } else {
        monster.wanderCooldown = 20 + this.rng.rand(40)
      }
    }
    return
  }
  const woundedPct = monaiParam113c(
    aiProfile,
    monster.aiParams,
    aiProfile.woundedTargetParam,
    -1,
  )
  if (woundedPct >= 0 && nearest.kind === 'player') {
    const nearestMaxHpFixed = this.getPlayerAccruedMaxHpFixed(nearest.player)
    const nearestHpPct =
      nearestMaxHpFixed > 0
        ? (nearest.player.hpFixed / nearestMaxHpFixed) * 100
        : 100
    if (nearestHpPct > woundedPct) {
      for (const candidate of this.players.values()) {
        if (candidate.dead || candidate.areaId !== monster.areaId) continue
        const candidateMaxHpFixed = this.getPlayerAccruedMaxHpFixed(candidate)
        const hpPct =
          candidateMaxHpFixed > 0
            ? (candidate.hpFixed / candidateMaxHpFixed) * 100
            : 100
        if (hpPct > woundedPct) continue
        if (Math.hypot(candidate.x - monster.x, candidate.y - monster.y) > effectiveAggro) {
          continue
        }
        nearest = {
          kind: 'player',
          x: candidate.x,
          y: candidate.y,
          player: candidate,
        }
        break
      }
    }
  }
  const bestDist = Math.hypot(nearest.x - monster.x, nearest.y - monster.y)

  // `#1896` / `#1990` / `#2010`: Monster healers (`ZakarumPriest` `#179`, `HighPriest` `#179/#182`, `GreaterMummy` `#182`,
  // `OblivionKnight` `#182`) evaluate healing wounded allies (`!state 52`, `ally !== self` per `0x6FCD37B9`,
  // same alignment & non-converted per `D2Common.#10666`/`#10830`) only after acquiring a hostile target
  // (`nTargetMode = 1`) and when no hostile is already in melee range (`0x6FCA8380` / `0x6FC39080`).
  if (
    !hasTaunt &&
    aiProfile.healRangeParam !== undefined &&
    monster.skillCooldown <= 0 &&
    monster.cooldown <= 0
  ) {
    const meleeHostile = this.nearestHostileForMonster(
      monster,
      Math.max(2.5, monster.meleeRange + 1.5),
    )
    if (meleeHostile === null) {
      const baseCheckRange = monaiParam113c(
        aiProfile,
        monster.aiParams,
        aiProfile.healRangeParam,
        12,
      )
      const checkRange =
        monster.ai === 'HighPriest'
          ? Math.max(50, baseCheckRange)
          : monster.ai === 'GreaterMummy'
            ? Math.max(12, baseCheckRange) + (monster.hcIdx === 229 ? 10 : 0)
            : Math.max(12, baseCheckRange)
      let hasWoundedAlly = false
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
          Math.hypot(ally.x - monster.x, ally.y - monster.y) > checkRange
        ) {
          continue
        }
        if (monster.ai === 'GreaterMummy') {
          if (!ally.isUndead) continue
          if (monster.hcIdx !== 229 && ally.rank === 'unique') continue
        }
        const allyHpPct = Math.trunc((ally.hp * 100) / ally.maxHp)
        const belowThreshold =
          monster.ai === 'HighPriest'
            ? allyHpPct < 75
            : monster.ai === 'ZakarumPriest'
              ? allyHpPct <= 60
              : monster.ai === 'OblivionKnight'
                ? allyHpPct < 40
                : true
        if (belowThreshold) {
          hasWoundedAlly = true
          break
        }
      }
      if (hasWoundedAlly) {
        const passedGate =
          monster.ai === 'GreaterMummy'
            ? this.rng.rand(100) < (monster.aiParams[2] || 40)
            : monster.ai === 'HighPriest'
              ? this.rng.rand(100) < (monster.aiParams[1] || 25)
              : monster.ai === 'ZakarumPriest'
                ? this.rng.rand(100) < 25
                : monster.ai === 'OblivionKnight'
                  ? this.rng.rand(100) < (monster.aiParams[4] || 65) &&
                    this.rng.rand(100) < (monster.aiParams[5] || 30)
                  : true
        if (
          passedGate &&
          this.tryCastMonsterUtilitySkill(monster, { x: monster.x, y: monster.y }, 0, true)
        ) {
          monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
          return
        }
      }
    }
  }

  // F11.5 / `#1891` / `#1992` / `#2010`: 1.13c Corpse Resurrection (`D2Game.dll` `0x6FCA8380` `GreaterMummy`,
  // `0x6FCA90A0` `FallenShaman`, `0x6FCA7BB0` `FetishShaman`, `0x6FC39E70` `BloodRaven`):
  // - Gated by `AIGENERAL_Think` `nTargetMode = 1` hostile target acquisition (`0x6FCBD494`).
  // - Melee (`bInMeleeRange`), `FetishShaman` close `FetishInferno` (`<= 5` sub-tiles, `0x6FCA7BC6`),
  //   and `GreaterMummy` close poison breath (`< 5` sub-tiles, `0x6FCA843A`, `rand(100) < aip1`)
  //   take precedence over corpse resurrection.
  // - Spatial callbacks (`0x6FC9B8E0`, `0x6FC9BD50`, `0x6FC9BB90`) pick the nearest valid corpse
  //   within `resurrectRange` (`+10` for Radament `#229` per `0x6FCA856E`), enforcing wall/door LOS
  //   (`DUNGEON_CheckLos`, bypassed only by Radament `#229` or `FetishShaman` with `aip2 >= 3`)
  //   and walkable corpse sub-tile (`SKILLS_CanUnitCorpseBeResurrected` `0x6FD13E30`).
  // - Per-AI `rand(100)` gates: `GreaterMummy` `< aip2` (`0x6FCA864A`), `FallenShaman` approach roll
  //   + `< aip1` (`0x6FCA91E5` / `0x6FCA9263`), `FetishShaman` `< aip1` + walk toward corpse when
  //   `corpseDist > aip3` (`0x6FCA7D0D` / `0x6FCA7D5F`).
  if (
    !hasTaunt &&
    (monster.resurrectSkillId !== undefined || monster.hcIdx === 267) &&
    monster.cooldown <= 0
  ) {
    const isGreaterMummy =
      monster.monType === 'unraveler' || monster.ai === 'GreaterMummy'
    const isFetishShaman = monster.ai === 'FetishShaman'
    const isFallenShaman = monster.ai === 'FallenShaman'
    const isBloodRaven = monster.hcIdx === 267 || monster.ai === 'BloodRaven'
    const meleeHostile = this.nearestHostileForMonster(
      monster,
      Math.max(2.5, monster.meleeRange + 1.5),
    )
    const closeFetishHostile = isFetishShaman ? this.nearestHostileForMonster(monster, 5) : null
    const closeMummyBreath =
      isGreaterMummy &&
      meleeHostile === null &&
      monster.modeMissiles?.A2 !== undefined &&
      this.nearestHostileForMonster(monster, 5) !== null &&
      this.rng.rand(100) < (monster.aiParams[0] || 70)
    if (meleeHostile === null && closeFetishHostile === null && !closeMummyBreath) {
      const configuredRange =
        aiProfile.resurrectRangeParam !== undefined
          ? monaiParam113c(aiProfile, monster.aiParams, aiProfile.resurrectRangeParam, 0)
          : 0
      const baseResurrectRange = Math.max(
        1,
        Math.floor(
          configuredRange ||
            (monster.hcIdx === 267 ? 20 : monster.aiParams[3] || monster.aiParams[4] || 15),
        ),
      )
      const resurrectRange = baseResurrectRange + (monster.hcIdx === 229 ? 10 : 0)
      const bypassCorpseLos =
        monster.hcIdx === 229 || (isFetishShaman && (monster.aiParams[1] ?? 0) >= 3)
      let bestCorpse: InternalMonsterRecord | undefined
      let bestCorpseDist = resurrectRange + 1e-6
      for (const corpse of this.monsters.values()) {
        if (
          !corpse.dead ||
          corpse.shattered ||
          corpse.corpseConsumed ||
          corpse.states.has(104) ||
          corpse.isBoss ||
          corpse.isPrimeEvil ||
          (corpse.rank === 'unique' && !(isGreaterMummy && monster.hcIdx === 229)) ||
          corpse.rank === 'champion' ||
          corpse.superUniqueId !== undefined ||
          corpse.isNpc ||
          corpse.areaId !== monster.areaId
        ) {
          continue
        }
        // 1.13c race rules (`D2Game.dll` `0x6fc9bd50` / `0x6fc9bb90` / `0x6fc9b8e0`, `#1891`):
        // - Fallen/Fetish shamans raise their own MonType (`fallen` / `fetish`);
        // - Blood Raven (`hcIdx 267`) raises cemetery zombies (`monType === 'zombie'`);
        // - Greater Mummies (`unraveler1..9`, `radament` `#229`) raise any undead ally
        //   (non-Radament unravelers cannot raise other unravelers).
        const sameRace =
          !isGreaterMummy &&
          !isBloodRaven &&
          corpse.monType !== '' &&
          corpse.monType === monster.monType
        const raisesZombie =
          isBloodRaven && (corpse.monType === 'zombie' || corpse.defId.startsWith('zombie'))
        const raisesUndead =
          (isGreaterMummy ||
            monster.resurrectSkillId === 158 ||
            monster.resurrectSkillId === 183 ||
            monster.resurrectSkillId === 190) &&
          corpse.isUndead &&
          (monster.hcIdx === 229 ||
            (corpse.monType !== 'unraveler' && corpse.ai !== 'GreaterMummy'))
        if (!sameRace && !raisesZombie && !raisesUndead) continue
        const corpseDist = Math.hypot(corpse.x - monster.x, corpse.y - monster.y)
        if (corpseDist > resurrectRange || corpseDist >= bestCorpseDist) {
          continue
        }
        if (
          this.terrainWalkableCheck &&
          !this.terrainWalkableCheck(
            corpse.areaId,
            Math.round(corpse.x),
            Math.round(corpse.y),
            corpse.isFlying,
          )
        ) {
          continue
        }
        if (
          !bypassCorpseLos &&
          !this.isMonsterStepWalkable(
            monster.areaId,
            monster.x,
            monster.y,
            corpse.x,
            corpse.y,
            true,
          )
        ) {
          continue
        }
        bestCorpse = corpse
        bestCorpseDist = corpseDist
      }
      if (bestCorpse !== undefined) {
        let passedResurrectGate = true
        if (isGreaterMummy) {
          const rawChance = monaiParam113c(
            aiProfile,
            monster.aiParams,
            aiProfile.resurrectChanceParam,
            -1,
          )
          const chance = rawChance >= 0 ? Math.min(100, rawChance) : 30
          passedResurrectGate = this.rng.rand(100) < chance
        } else if (isFallenShaman) {
          const rawChance = monaiParam113c(
            aiProfile,
            monster.aiParams,
            aiProfile.resurrectChanceParam,
            -1,
          )
          const chance = rawChance >= 0 ? Math.min(100, rawChance) : 45
          passedResurrectGate = this.rng.rand(100) < chance
        } else if (isFetishShaman) {
          const rawChance = monaiParam113c(
            aiProfile,
            monster.aiParams,
            aiProfile.resurrectChanceParam,
            -1,
          )
          const chance = rawChance >= 0 ? Math.min(100, rawChance) : 40
          passedResurrectGate = this.rng.rand(100) < chance
        }
        if (passedResurrectGate) {
          if (isFetishShaman) {
            const rawMaxCastRange = monaiParam113c(
              aiProfile,
              monster.aiParams,
              aiProfile.resurrectCastRangeParam,
              0,
            )
            const maxCastRange = Math.max(1, rawMaxCastRange > 0 ? rawMaxCastRange : 15)
            if (bestCorpseDist > maxCastRange) {
              this.moveMonsterToward(monster, bestCorpse.x, bestCorpse.y, true)
              return
            }
          }
          monster.cooldown = Math.max(aiInterval, monster.cooldownTicks)
          monster.mode = 8
          this.broadcastToArea(monster.areaId, {
            type: 'UnitMode',
            unitType: 1,
            id: monster.unitId,
            mode: 8,
            at: { x: Math.round(bestCorpse.x), y: Math.round(bestCorpse.y) },
            lifePct:
              monster.maxHp > 0
                ? Math.round((monster.hp / monster.maxHp) * 128)
                : 0,
          })
          monster.pendingResurrection = {
            corpseUnitId: bestCorpse.unitId,
            frame: this.currentFrame + 6,
          }
          return
        }
      }
    }
  }

  // MonAi charge rows (SandRaider row 8, ClawViper 16/142, BloodHawk 5,
  // ReanimatedHorde 114, SiegeBeast 115, Duriel 44): a burst from mid range.
  // The row's descriptor owns min/max distance and which `aip` slot paces it.
  const charge = aiProfile.charge
  if (
    charge !== undefined &&
    bestDist > charge.minDistance &&
    bestDist <= charge.maxDistance &&
    monster.cooldown <= 0 &&
    !isSlowed
  ) {
    const chargeDelay = Math.max(
      1,
      Math.floor(
        charge.fixedDelayFrames ??
          monaiParam113c(aiProfile, monster.aiParams, charge.delayParam, monster.cooldownTicks * 2),
      ),
    )
    monster.cooldown = chargeDelay
    const bursts = Math.max(1, Math.round(charge.speedMultiplier ?? 2))
    for (let i = 0; i < bursts; i += 1) {
      this.moveMonsterToward(monster, nearest.x, nearest.y, true)
    }
    // `#1892` ClawViper / ClawViperEx (`#107 Charge` / `#352 SerpentCharge`) & chargers:
    // Deal charge impact + knockback when the burst reaches melee contact (`<= 3.5` sub-tiles)!
    if (
      (monster.ai === 'ClawViper' ||
        monster.ai === 'ClawViperEx' ||
        monster.skills.some((s) => s.skillId === 107 || s.skillId === 352)) &&
      Math.hypot(nearest.x - monster.x, nearest.y - monster.y) <= 3.5
    ) {
      const chargeSkill = monster.skills.find((s) => s.skillId === 107 || s.skillId === 352)
      const chargeSid = chargeSkill?.skillId ?? 107
      const chargeSlvl = Math.max(1, chargeSkill?.level ?? 1)
      const baseMin =
        monster.minDmg > 0
          ? monster.minDmg
          : monster.special1MinDmg || monster.attack2MinDmg || 4
      const baseMax =
        monster.maxDmg > 0
          ? monster.maxDmg
          : Math.max(baseMin, monster.special1MaxDmg || monster.attack2MaxDmg || 6)
      const chargeMult =
        chargeSid === 352 ? 1 : 1 + (100 + 25 * Math.max(0, chargeSlvl - 1)) / 100
      const chargeMin = Math.max(6, Math.round(baseMin * chargeMult))
      const chargeMax = Math.max(chargeMin, Math.round(baseMax * chargeMult))
      this.emitBossSkillCast113c(
        monster,
        chargeSid,
        chargeSlvl,
        14,
        nearest.x,
        nearest.y,
      )
      this.executeMonsterMeleeSkillStrike113c(monster, nearest, {
        skillId: chargeSid,
        minDmg: chargeMin,
        maxDmg: chargeMax,
        arBonusPct: 50 + 15 * Math.max(0, chargeSlvl - 1),
        knockbackSteps: 3,
      })
    }
    return
  }
  // SandLeaper row 17: leap at the target from outside melee range.
  const leap = aiProfile.leap
  if (
    leap !== undefined &&
    bestDist > leap.minDistance &&
    bestDist <= leap.maxDistance &&
    monster.cooldown <= 0 &&
    !isSlowed
  ) {
    monster.cooldown = Math.max(
      1,
      Math.floor(
        leap.fixedDelayFrames ??
          monaiParam113c(aiProfile, monster.aiParams, leap.delayParam, monster.cooldownTicks * 3),
      ),
    )
    const bursts = Math.max(1, Math.round(leap.speedMultiplier ?? 2))
    for (let i = 0; i < bursts; i += 1) {
      this.moveMonsterToward(monster, nearest.x, nearest.y, true)
    }
    return
  }
  if (normalizeMonAiName113c(monster.ai) === 'vampire') {
    this.stepVampireTargetAi113c(monster, nearest, bestDist, hasDimVision, hasTaunt)
    return
  }
  // Archers/finger mages back away when the player closes in.
  const kiteDistance = Math.max(
    2,
    monaiParam113c(aiProfile, monster.aiParams, aiProfile.kiteDistanceParam, 4),
  )
  if (aiBehavior === 'kiter' && bestDist < kiteDistance) {
    // A retreating caster still gets its Sk*Mode curse/utility cast.
    if (
      !hasDimVision &&
      !hasTaunt &&
      this.tryCastMonsterSkill(monster, nearest, bestDist)
    ) {
      return
    }
    const dx = monster.x - nearest.x
    const dy = monster.y - nearest.y
    const dist = Math.max(0.5, Math.hypot(dx, dy))
    this.moveMonsterToward(
      monster,
      monster.x + (dx / dist) * 4,
      monster.y + (dy / dist) * 4,
      true,
    )
    return
  }

  // MonAi hurt-retreat rows (Arach row 26: aip5 hurt %, aip4 run distance).
  const hurtRetreat = aiProfile.hurtRetreat
  if (hurtRetreat !== undefined) {
    const hurtPct = Math.max(
      0,
      Math.min(100, monaiParam113c(aiProfile, monster.aiParams, hurtRetreat.hurtParam, 0)),
    )
    const runDist = Math.max(
      1,
      monaiParam113c(aiProfile, monster.aiParams, hurtRetreat.distanceParam, 8),
    )
    const hpPct = monster.maxHp > 0 ? (monster.hp / monster.maxHp) * 100 : 100
    if (hurtPct > 0 && hpPct <= hurtPct && bestDist < runDist) {
      const dx = monster.x - nearest.x
      const dy = monster.y - nearest.y
      const dist = Math.max(0.5, Math.hypot(dx, dy))
      this.moveMonsterToward(
        monster,
        monster.x + (dx / dist) * 4,
        monster.y + (dy / dist) * 4,
        true,
      )
      return
    }
  }

  // F11.5 / #1822: Oblivion Knight (`MonCurseCast` 0x6FCD5950 & 0x6FD1B454) 1.13c 5-curse pool:
  // Decrepify (#87/60), Amplify Damage (#66/9), Lower Resist (#91/61), Weaken (#72/19), Life Tap (#82/58) — NO Iron Maiden (#76/55) in 1.13c!
  if (
    !hasDimVision &&
    !hasTaunt &&
    aiProfile.curse &&
    monster.cooldown <= 0 &&
    monster.skillCooldown <= 0 &&
    bestDist <= 25
  ) {
    const curseChance = Math.max(25, Math.min(100, monster.aiParams[4] || 80))
    const closeRange = Math.max(4, monster.aiParams[0] || 6)
    const targetHasDecrep =
      nearest.kind === 'player'
        ? nearest.player.states.has(60)
        : nearest.kind === 'merc'
          ? nearest.merc.states.has(60)
          : false
    if (!(bestDist <= closeRange && targetHasDecrep) && this.rng.rand(100) < curseChance) {
      const curseSkills = [87, 66, 91, 72, 82] as const
      const chosenSkillId =
        bestDist <= closeRange ? 87 : curseSkills[this.rng.rand(curseSkills.length)]!
      const curseSlvl = Math.max(1, Math.floor(monster.level / 5))
      if (nearest.kind === 'player') {
        this.applyMonsterCurseToTarget113c(
          monster,
          { kind: 'player', player: nearest.player },
          chosenSkillId,
          curseSlvl,
        )
      } else if (nearest.kind === 'merc') {
        this.applyMonsterCurseToTarget113c(
          monster,
          { kind: 'merc', merc: nearest.merc },
          chosenSkillId,
          curseSlvl,
        )
      }
      monster.mode = 8
      this.broadcastToArea(monster.areaId, {
        type: 'UnitMode',
        unitType: 1,
        id: monster.unitId,
        mode: 8,
        at: { x: Math.round(nearest.x), y: Math.round(nearest.y) },
        lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
      })
      monster.cooldown = Math.max(monster.aiDelay, monster.cooldownTicks)
      monster.skillCooldown = Math.max(35, monster.cooldownTicks * 2)
      return
    }
  }

  // MonStats `Skill1..8`: cast a data-driven projectile skill (ShamanFire,
  // ZakarumLightning, PrimeLightning, DoomKnightMissile, ...) before the plain
  // `MissA1/A2/S1/C` attack. The action mode comes from the MonStats `Sk*Mode`.
  if (
    !hasDimVision &&
    !hasTaunt &&
    this.tryCastMonsterSkill(monster, nearest, bestDist)
  ) {
    return
  }

  // 1.13c spawner AIs (`VileMother`, `FoulCrowNest`, `SandMaggotQueen`, `MosquitoNest`, `Sarcophagus`, `#1892`)
  // periodically create their child monster while a hostile is in range (`0` XP, `0` drops).
  if (aiProfile.spawn !== undefined && bestDist <= 30 && monster.cooldown <= 0) {
    const spawn = aiProfile.spawn
    const maxChildren = Math.max(
      0,
      Math.floor(monaiParam113c(aiProfile, monster.aiParams, spawn.maxParam, 4)),
    )
    if (monster.spawnedChildren < maxChildren) {
      const rawBatch =
        spawn.fixedBatch ??
        Math.floor(monaiParam113c(aiProfile, monster.aiParams, spawn.batchParam, 1))
      const batch = Math.min(maxChildren - monster.spawnedChildren, Math.max(1, rawBatch))
      const interval = Math.max(
        1,
        Math.floor(monaiParam113c(aiProfile, monster.aiParams, spawn.intervalParam, 125)),
      )
      let resolvedChildDefId = spawn.child
      if (monster.ai === 'VileMother') {
        resolvedChildDefId =
          monster.hcIdx >= 298 && monster.hcIdx <= 300
            ? `vilechild${String(monster.hcIdx - 297)}`
            : monster.hcIdx === 675
              ? 'vilechild4'
              : monster.hcIdx === 676
                ? 'vilechild5'
                : 'vilechild1'
      } else if (monster.ai === 'SandMaggotQueen' && monster.hcIdx >= 284 && monster.hcIdx <= 288) {
        resolvedChildDefId = `maggotegg${String(monster.hcIdx - 283)}`
      } else if (monster.ai === 'FoulCrowNest' && monster.hcIdx >= 206 && monster.hcIdx <= 209) {
        resolvedChildDefId = `foulcrow${String(monster.hcIdx - 205)}`
      } else if (monster.ai === 'MosquitoNest' && monster.hcIdx >= 334 && monster.hcIdx <= 337) {
        resolvedChildDefId = `mosquito${String(monster.hcIdx - 333)}`
      }
      let spawned = 0
      for (let i = 0; i < batch; i += 1) {
        const angle = (this.rng.rand(360) * Math.PI) / 180
        const tx = monster.x + Math.cos(angle) * (1 + this.rng.rand(2))
        const ty = monster.y + Math.sin(angle) * (1 + this.rng.rand(2))
        if (
          this.terrainWalkableCheck &&
          !this.terrainWalkableCheck(monster.areaId, Math.round(tx), Math.round(ty), false)
        ) {
          continue
        }
        this.spawnMonster({
          defId: resolvedChildDefId,
          x: tx,
          y: ty,
          areaId: monster.areaId,
          level: monster.level,
          experience: 0,
          alreadyGrantedKillRewards: true,
        })
        spawned += 1
      }
      if (spawned > 0) {
        monster.spawnedChildren += spawned
        monster.cooldown = interval
        monster.mode = 8
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: monster.unitId,
          mode: 8,
          at: { x: Math.round(nearest.x), y: Math.round(nearest.y) },
          lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
        })
        return
      }
    }
  }

  // F12.3: Ranged monster missile firing (suppressed when Dim Vision 23 or Taunt 27 is active)
  // 1.13c `AITHINK_Fn022_GreaterMummy` (`0x6FCA8380`, `0x6FCA843A: cmp eax, 5`, #1989):
  // `GreaterMummy` (`unraveler1..9`, `Radament`, `Achmel`) fires `MissA2` (`mummy1..4` / `mummyex`
  // close-range poison breath) ONLY when `bestDist < 5` sub-tiles, never at `bestDist >= 5`.
  const isGreaterMummy = monster.ai === 'GreaterMummy'
  const isNonMeleeStationary = isNonMeleeMonsterAi113c(monster.ai)
  const inRangedMissileBand = isGreaterMummy
    ? bestDist > 1.5 && bestDist < 5 && monster.modeMissiles?.A2 !== undefined
    : (isNonMeleeStationary ? bestDist >= 0 : bestDist > 2.5) && bestDist <= monsterShootRange(monster)
  if (
    (monster.isRanged || aiProfile.ranged || isGreaterMummy) &&
    !hasDimVision &&
    !hasTaunt &&
    inRangedMissileBand &&
    (monster.cooldown > 0 || monsterCanFireRanged113c(monster, this.rng.rand(100)))
  ) {
    if (monster.cooldown <= 0) {
      // The AI mode picks the MonStats Missiles.txt column: S1 for pure casters,
      // A2 for GreaterMummy poison breath (`dist < 5`) or rows with a secondary attack,
      // otherwise A1. Only fall back to the next declared column when the selected one is empty.
      const preferredMode = isGreaterMummy
        ? 'A2'
        : monster.modeMissiles?.S1 !== undefined && monster.maxDmg <= 1
          ? 'S1'
          : monster.modeMissiles?.A2 !== undefined &&
              monster.hasAttack2 &&
              this.rng.rand(2) === 0
            ? 'A2'
            : 'A1'
      const selectedMode: 'A1' | 'A2' | 'S1' | 'C' =
        monster.modeMissiles?.[preferredMode] !== undefined
          ? preferredMode
          : monster.modeMissiles?.A1 !== undefined
            ? 'A1'
            : monster.modeMissiles?.A2 !== undefined
              ? 'A2'
              : monster.modeMissiles?.S1 !== undefined
                ? 'S1'
                : 'C'
      const missileName = monster.modeMissiles?.[selectedMode]
      const missileRec = missileName
        ? this.registry.getMissileByName(missileName)
        : undefined
      // A `rangedtype` row without a Missiles.txt row falls through to melee
      // instead of silently firing missile id 1 (javelin).
      if (missileRec !== undefined) {
        const attackMode = this.monsterSkillMode(selectedMode)
        monster.cooldown = monster.cooldownTicks
        monster.mode = attackMode
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: monster.unitId,
          mode: attackMode,
          at: { x: Math.round(nearest.x), y: Math.round(nearest.y) },
          lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
        })
        // 1.13c `D2Common#10413` (`0x6FDBBAA0`, #1989): evaluate `Missiles.txt` `MinDamage..MaxDamage` /
        // `EMin..EMax << HitShift`, inheriting monster `minDmg..maxDmg` & `El1..3` ONLY when `SrcDamage > 0`.
        const modeMinPhys =
          selectedMode === 'C'
            ? 0
            : selectedMode === 'S1'
              ? monster.special1MinDmg
              : selectedMode === 'A2'
                ? monster.attack2MinDmg
                : monster.minDmg
        const modeMaxPhys =
          selectedMode === 'C'
            ? 0
            : selectedMode === 'S1'
              ? monster.special1MaxDmg
              : selectedMode === 'A2'
                ? monster.attack2MaxDmg
                : monster.maxDmg
        const diffIdx: 0 | 1 | 2 = this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0
        const modeMissileSlvl = resolveMonsterModeMissileSlvl113c(diffIdx)
        const mslEval = evaluateMonsterMissileDamage113c({
          registry: this.registry,
          missile: missileRec,
          slvl: modeMissileSlvl,
          difficulty: diffIdx,
          monsterMinPhys: modeMinPhys,
          monsterMaxPhys: modeMaxPhys,
          attackMode: selectedMode,
          elementalAttacks: monster.elementalAttacks,
          extraFirePct: monster.monProps.extraFirePct,
          rng: this.rng,
        })
        const physDamage =
          mslEval.totalDamage > 0
            ? mslEval.physDamage
            : this.rollInclusive(modeMinPhys, modeMaxPhys)
        const elemDamage = mslEval.elemDamage
        const element = mslEval.element
        // MonUMod 29 `multishot` (`+2` fan projectiles) is applied inside `spawnMonsterMissile` (#1900).
        this.spawnMonsterMissile(
          monster,
          nearest.x,
          nearest.y,
          Math.max(1, physDamage + elemDamage),
          missileRec.id,
          0,
          {
            missile: missileRec,
            skillLevel: modeMissileSlvl,
            physDamage,
            elemDamage,
            element,
            ...(mslEval.elemDurationFrames > 0
              ? { elemDurationFrames: mslEval.elemDurationFrames }
              : {}),
          },
        )
        return
      }
    } else if (!isGreaterMummy) {
      return
    }
  }

  if (bestDist <= 2.5) {
    if (aiBehavior === 'suicide') {
      monster.hp = 0
      this.applyMonsterDeath(
        monster,
        nearest.kind === 'player' ? nearest.player : undefined,
        'phys',
      )
      return
    }
    if (isNonMeleeStationary) {
      return
    }
    if (
      monster.cooldown <= 0 &&
      monster.pendingAttack === undefined &&
      monster.pendingAllyAttack === undefined
    ) {
      monster.cooldown = monster.cooldownTicks
      if (nearest.kind === 'player') {
        this.beginMonsterMeleeAttack(monster, nearest.player)
      } else if (nearest.kind === 'merc') {
        monster.mode = 4
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: monster.unitId,
          mode: 4,
          at: { x: Math.round(nearest.merc.x), y: Math.round(nearest.merc.y) },
          lifePct:
            monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
        })
        this.beginMonsterMeleeAttackOnAlly(monster, {
          kind: 'merc',
          id: nearest.merc.unitId,
        })
      } else {
        monster.mode = 4
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: monster.unitId,
          mode: 4,
          at: { x: Math.round(nearest.pet.x), y: Math.round(nearest.pet.y) },
          lifePct:
            monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
        })
        this.beginMonsterMeleeAttackOnAlly(monster, { kind: 'pet', id: nearest.pet.uid })
      }
    }
  } else if (aiBehavior !== 'stationary') {
    const running = (aiBehavior === 'suicide' || bestDist > 5) && !isSlowed
    this.moveMonsterToward(monster, nearest.x, nearest.y, running)
  }
}

/**
 * 1.13c `AITHINK_Fn028_Vampire` (`D2Game.dll` `0x6FCA6900..0x6FCA7000`, `#2007`):
 * - `aip1` (`aiParams[0]`, `55..85`): melee fight vs retreat chance (`%`).
 * - `aip2` (`aiParams[1]`, `20..40` Normal / `40..70` NM / `45..80` Hell): ranged spell cast gate (`%`).
 * - `aip3` (`aiParams[2]`, `24..28`): max ranged spell evaluation distance (sub-tiles).
 * - `aip4` (`aiParams[3]`, `25..51`): `#170 VampireFirewall` / `#171 VampireMeteor` upgrade roll (`%`).
 * - `aip5` (`aiParams[4]`, `1 | 3 | 5 | 7`): spell repertoire bitmask (`1` = `#169/#333`, `2` = `#170`, `4` = `#171`).
 * - `vampireUpgradeCooldownTicks` (`dwAiParam4`, `0x6FCA6EC3`): `11` AI think ticks lockout after `#170` or `#171`.
 */
function stepVampireTargetAi113c(
  this: GameInstanceHost,
  monster: InternalMonsterRecord,
  target:
    | { readonly kind: 'player'; readonly x: number; readonly y: number; readonly player: InternalPlayerRecord }
    | { readonly kind: 'merc'; readonly x: number; readonly y: number; readonly merc: InternalMercenaryRecord }
    | { readonly kind: 'pet'; readonly x: number; readonly y: number; readonly pet: SummonedPetUnit }
    | { readonly kind: 'monster'; readonly x: number; readonly y: number; readonly monster: InternalMonsterRecord },
  dist: number,
  hasDimVision: boolean,
  hasTaunt: boolean,
): void {
  const hitMonsters = target.kind === 'monster'
  const aip1 = monster.aiParams[0] || 55
  const aip2 = monster.aiParams[1] || 20
  const aip3 = monster.aiParams[2] || 24
  const aip4 = monster.aiParams[3] || 25
  const hasExplicitAiParams = monster.aiParams.some((v) => v !== 0)
  const aip5 = hasExplicitAiParams ? (monster.aiParams[4] ?? 0) : 7

  const hasSkill = (sid: number): boolean => monster.skills.some((s) => s.skillId === sid)
  const pickBaseProjectileSkillId = (): number | undefined => {
    const has169 = hasSkill(169)
    const has333 = hasSkill(333)
    if (has169 && has333) {
      return this.rng.rand(100) < 50 ? 169 : 333
    }
    return has169 ? 169 : has333 ? 333 : undefined
  }
  const retreatAway = (): void => {
    const dx = monster.x - target.x
    const dy = monster.y - target.y
    const d = Math.max(0.5, Math.hypot(dx, dy))
    this.moveMonsterToward(monster, monster.x + (dx / d) * 4, monster.y + (dy / d) * 4, false)
  }

  // `bInMeleeRange != 0` (`0x6FCA6CC5..0x6FCA6DEB`)
  if (dist <= 2.5) {
    if (this.rng.rand(100) < aip1) {
      if (
        !hasDimVision &&
        !hasTaunt &&
        (aip5 & 1) !== 0 &&
        dist <= 20 &&
        monster.skillCooldown <= 0 &&
        this.isMonsterStepWalkable(monster.areaId, monster.x, monster.y, target.x, target.y, true) &&
        this.rng.rand(100) <= 30
      ) {
        const baseSid = pickBaseProjectileSkillId()
        if (
          baseSid !== undefined &&
          this.tryCastMonsterSkill(monster, target, dist, { hitMonsters, forcedSkillId: baseSid })
        ) {
          monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
          return
        }
      }
      if (target.kind === 'monster') {
        if (monster.cooldown <= 0) {
          monster.cooldown = monster.cooldownTicks
          this.attackMonsterTarget(monster, target.monster)
        }
      } else if (
        monster.cooldown <= 0 &&
        monster.pendingAttack === undefined &&
        monster.pendingAllyAttack === undefined
      ) {
        monster.cooldown = monster.cooldownTicks
        if (target.kind === 'player') {
          this.beginMonsterMeleeAttack(monster, target.player)
        } else if (target.kind === 'merc') {
          monster.mode = 4
          this.broadcastToArea(monster.areaId, {
            type: 'UnitMode',
            unitType: 1,
            id: monster.unitId,
            mode: 4,
            at: { x: Math.round(target.merc.x), y: Math.round(target.merc.y) },
            lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
          })
          this.beginMonsterMeleeAttackOnAlly(monster, { kind: 'merc', id: target.merc.unitId })
        } else {
          monster.mode = 4
          this.broadcastToArea(monster.areaId, {
            type: 'UnitMode',
            unitType: 1,
            id: monster.unitId,
            mode: 4,
            at: { x: Math.round(target.pet.x), y: Math.round(target.pet.y) },
            lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
          })
          this.beginMonsterMeleeAttackOnAlly(monster, { kind: 'pet', id: target.pet.uid })
        }
      }
      return
    }
    retreatAway()
    return
  }

  // `bInMeleeRange == 0` (`0x6FCA6DEE..0x6FCA6FD2`)
  if (
    dist < aip3 &&
    !hasDimVision &&
    !hasTaunt &&
    monster.skillCooldown <= 0 &&
    monster.cooldown <= 0 &&
    this.rng.rand(100) < aip2
  ) {
    // Upgrade 1: `#170 VampireFirewall` (`(aip5 & 2) != 0`, `0x6FCA6E2C..0x6FCA6E6E`)
    if (
      (aip5 & 2) !== 0 &&
      monster.vampireUpgradeCooldownTicks <= 0 &&
      hasSkill(170) &&
      this.rng.rand(100) < aip4 &&
      this.tryCastMonsterSkill(monster, target, dist, { hitMonsters, forcedSkillId: 170 })
    ) {
      monster.vampireUpgradeCooldownTicks = 11
      monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
      return
    }
    // Upgrade 2: `#171 VampireMeteor` (`(aip5 & 4) != 0`, `0x6FCA6E70..0x6FCA6ECE`)
    if (
      (aip5 & 4) !== 0 &&
      monster.vampireUpgradeCooldownTicks <= 0 &&
      hasSkill(171) &&
      this.rng.rand(100) < aip4 &&
      this.tryCastMonsterSkill(monster, target, dist, { hitMonsters, forcedSkillId: 171 })
    ) {
      monster.vampireUpgradeCooldownTicks = 11
      monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
      return
    }
    // Base projectile: `#169 VampireFireball` / `#333 VampireMissile` (`(aip5 & 1) != 0`, `0x6FCA6ED1..0x6FCA6F65`)
    if (
      (aip5 & 1) !== 0 &&
      dist <= 20 &&
      this.isMonsterStepWalkable(monster.areaId, monster.x, monster.y, target.x, target.y, true)
    ) {
      if (this.rng.rand(100) < 75) {
        const baseSid = pickBaseProjectileSkillId()
        if (
          baseSid !== undefined &&
          this.tryCastMonsterSkill(monster, target, dist, { hitMonsters, forcedSkillId: baseSid })
        ) {
          monster.cooldown = Math.max(monster.cooldown, monster.cooldownTicks)
          return
        }
      } else {
        retreatAway()
        return
      }
    }
  }

  this.moveMonsterToward(monster, target.x, target.y, false)
}

/**
 * DRLG oracle path: 1.13c `AiZombie` (D2Game `0x6FCA38B0`) with `AI_ApproachTarget` (`0x6FD12540`) and
 * `AI_IdleWander` (`0x6FD11B10`). Pseudocode, RNG table and fields: kb/monsters/d2game-zombie-ai-113c.md.
 * NOTE: every DRLG-populated monster currently runs this AI regardless of its MonStats `AI` column.
 */
function stepDrlgMonsterAi113c(this: GameInstanceHost, monster: InternalMonsterRecord): void {
  const aiInterval = Math.max(1, Math.round(monster.aiDelay))
  if (
    !monster.submerged &&
    (monster.states.has(1) ||
      monster.states.has(29) ||
      monster.states.has(21) ||
      monster.states.has(25) ||
      monster.frozenTicks > 0)
  ) {
    monster.pendingAttack = undefined
    monster.pendingAllyAttack = undefined
    monster.actionAnimEndFrame = 0
    if (monster.mode !== 1) {
      monster.mode = 1
      this.areaPathWorld.stopMonsterMove113c(monster.areaId, monster.unitId, 1)
    }
    return
  }

  if (monster.actionAnimEndFrame !== undefined && monster.actionAnimEndFrame > 0) {
    if (this.currentFrame < monster.actionAnimEndFrame) {
      return
    }
    monster.actionAnimEndFrame = 0
    monster.mode = 1
    monster.nextAiFrame = this.currentFrame + aiInterval
    return
  }

  let immediateAi = false
  if (monster.mode === 2 || monster.mode === 15) {
    const slowPct = this.monsterSlowPercent(monster)
    // `pAiControl+0x1C` velocity override, stored by `0x6FC94F90` into the mode struct (`+0x10`) for the
    // whole move: zombie RN chase 100, Fallen WL flee 50 (`0x6FCA3255`); 0 for every other move.
    const velPct = 75 + (monster.runVelocityBonus ?? 0) - slowPct
    const res = this.areaPathWorld.stepMonsterMove113c({
      areaId: monster.areaId,
      unitId: monster.unitId,
      hcIdx: monster.hcIdx,
      velocityPct: velPct,
      mode: monster.mode,
    })
    if (res !== null) {
      monster.x = res.x
      monster.y = res.y
      if (res.stepped === 0) {
        monster.mode = 1
        monster.runVelocityBonus = 0
        this.areaPathWorld.stopMonsterMove113c(monster.areaId, monster.unitId, 1)
        immediateAi = true
      } else {
        return
      }
    } else {
      monster.mode = 1
      monster.runVelocityBonus = 0
      immediateAi = true
    }
  }

  if (!immediateAi && this.currentFrame < monster.nextAiFrame) {
    return
  }

  const unitSeed = this.unitSeeds.get(`${UNIT_TYPE_113C.monster}:${monster.unitId}`)
  if (unitSeed === undefined) {
    monster.nextAiFrame = this.currentFrame + aiInterval
    return
  }

  // MonAI flag-1 tick (`0x6FCBD196` -> `0x6FD13220`, kb/monsters/d2game-zombie-ai-113c.md §6): without a
  // player strictly inside `MonStats.aidist` (35 when 0) by `UNITS_GetDistanceToCoordinates` the think
  // function is skipped and the AI re-scheduled: `d >= 35` -> 25, `d < 25` -> 10, else `d - 10` frames.
  {
    const aiDist = monStatsAiDist113c(monster.hcIdx, this.difficulty)
    const mx = Math.floor(monster.x + 0.5)
    const my = Math.floor(monster.y + 0.5)
    let minDist = 0x7fffffff
    for (const p of this.players.values()) {
      // `AI_FindNearestPlayerOrAlly` (`0x6FCD1DCD`): players in town (`DRLGROOM_IsInTown`) are skipped.
      if (p.dead || TOWN_AREAS.has(p.areaId) || !this.isAreaSeamAdjacent(monster.areaId, p.areaId)) {
        continue
      }
      const d = unitsDistanceToCoordinates113c(Math.floor(p.x + 0.5), Math.floor(p.y + 0.5), mx, my)
      if (d < minDist) minDist = d
    }
    for (const merc of this.mercenaries.values()) {
      if (!merc.alive || TOWN_AREAS.has(merc.areaId) || !this.isAreaSeamAdjacent(monster.areaId, merc.areaId)) {
        continue
      }
      const d = unitsDistanceToCoordinates113c(Math.floor(merc.x + 0.5), Math.floor(merc.y + 0.5), mx, my)
      if (d < minDist) minDist = d
    }
    if (minDist >= aiDist) {
      monster.nextAiFrame =
        this.currentFrame + (minDist >= 35 ? 25 : minDist < 25 ? 10 : minDist - 10)
      return
    }
  }

  const hasDimVision = monster.states.has(23)
  const hasTaunt = monster.states.has(54)
  // `AI_FindNearestPlayerOrAlly` (`D2Game.dll` `0x6FCD1C90`):
  // - Initial radius `[esp+0x14] = MonStats.aidist[diff]` (35 when 0; 4 under Dim Vision without Taunt).
  // - Distance uses `UNITS_GetDistanceToCoordinates` (`0x6FCD08F0`, `< 0x37` and `< bestDist`).
  // - Sight check (`#10839(..., 4)` `COLLIDE_MISSILE_BARRIER`, skipped in outdoor rooms `#10685`):
  //   approximated via `isMonsterStepWalkable(..., true)` (`0x0804` missile-barrier + closed-door ray).
  let target:
    | { readonly kind: 'player'; readonly x: number; readonly y: number; readonly player: InternalPlayerRecord }
    | { readonly kind: 'merc'; readonly x: number; readonly y: number; readonly merc: InternalMercenaryRecord }
    | { readonly kind: 'pet'; readonly x: number; readonly y: number; readonly pet: SummonedPetUnit }
    | null = null
  let dist = Infinity
  if (monster.align === 0) {
    const mx = Math.floor(monster.x + 0.5)
    const my = Math.floor(monster.y + 0.5)
    let bestDist =
      hasDimVision && !hasTaunt ? 4 : monStatsAiDist113c(monster.hcIdx, this.difficulty)
    const hasSight = (tx: number, ty: number): boolean =>
      this.isMonsterStepWalkable(monster.areaId, monster.x, monster.y, tx, ty, true)
    for (const p of this.players.values()) {
      if (p.dead || TOWN_AREAS.has(p.areaId) || !this.isAreaSeamAdjacent(monster.areaId, p.areaId)) {
        continue
      }
      const pd = unitsDistanceToCoordinates113c(Math.floor(p.x + 0.5), Math.floor(p.y + 0.5), mx, my)
      if (pd < 0x37 && pd < bestDist && hasSight(p.x, p.y)) {
        bestDist = pd
        target = { kind: 'player', x: p.x, y: p.y, player: p }
      }
      const mgr = this.summonManagers.get(p.unitId)
      if (mgr !== undefined) {
        for (const pet of mgr.getActivePets()) {
          if (pet.alive === false || pet.hp <= 0) continue
          const petD = unitsDistanceToCoordinates113c(
            Math.floor(pet.x + 0.5),
            Math.floor(pet.y + 0.5),
            mx,
            my,
          )
          if (petD < bestDist && hasSight(pet.x, pet.y)) {
            bestDist = petD
            target = { kind: 'pet', x: pet.x, y: pet.y, pet }
          }
        }
      }
    }
    for (const merc of this.mercenaries.values()) {
      if (!merc.alive || TOWN_AREAS.has(merc.areaId) || !this.isAreaSeamAdjacent(monster.areaId, merc.areaId)) {
        continue
      }
      const mercOwner = this.players.get(merc.ownerPlayerId)
      if (
        mercOwner !== undefined &&
        (mercOwner.dead || TOWN_AREAS.has(mercOwner.areaId) || !this.isAreaSeamAdjacent(monster.areaId, mercOwner.areaId))
      ) {
        continue
      }
      const md = unitsDistanceToCoordinates113c(
        Math.floor(merc.x + 0.5),
        Math.floor(merc.y + 0.5),
        mx,
        my,
      )
      if (md < bestDist && hasSight(merc.x, merc.y)) {
        bestDist = md
        target = { kind: 'merc', x: merc.x, y: merc.y, merc }
      }
    }
    if (target !== null) {
      dist = bestDist
    }
  }

  let inMeleeRange = false
  if (target !== null) {
    if (target.kind === 'player') {
      const exactMelee = this.areaPathWorld.isMonsterInMeleeRange113c(
        monster.areaId,
        monster.unitId,
        0,
        target.player.unitId,
        0,
      )
      if (exactMelee !== null) {
        inMeleeRange = exactMelee
      } else {
        const rawRng = MONSTATS_113C_ROWS[monster.hcIdx]?.meleeRng ?? 0
        const meleeRng = rawRng === 0xff ? 0 : rawRng
        const meleeDist = unitsGetMeleeDistance113c(
          Math.round(monster.x),
          Math.round(monster.y),
          MONSTATS_113C_ROWS[monster.hcIdx]?.sizeX ?? 2,
          Math.round(target.x),
          Math.round(target.y),
          2,
        )
        inMeleeRange = meleeDist <= 0 || meleeRng + 1 >= meleeDist
      }
    } else {
      const targetMonId =
        target.kind === 'merc'
          ? target.merc.unitId
          : (this.petUnitIds.get(target.pet.uid) ?? -1)
      const exactMelee =
        targetMonId > 0
          ? this.areaPathWorld.isMonsterInMeleeRange113c(
              monster.areaId,
              monster.unitId,
              1,
              targetMonId,
              0,
            )
          : null
      if (exactMelee !== null) {
        inMeleeRange = exactMelee
      } else {
        const rawRng = MONSTATS_113C_ROWS[monster.hcIdx]?.meleeRng ?? 0
        const meleeRng = rawRng === 0xff ? 0 : rawRng
        const targetHcIdx =
          target.kind === 'merc' ? target.merc.classId : (target.pet.classId ?? 0)
        const meleeDist = unitsGetMeleeDistance113c(
          Math.round(monster.x),
          Math.round(monster.y),
          MONSTATS_113C_ROWS[monster.hcIdx]?.sizeX ?? 2,
          Math.round(target.x),
          Math.round(target.y),
          MONSTATS_113C_ROWS[targetHcIdx]?.sizeX ?? 2,
        )
        inMeleeRange = meleeDist <= 0 || meleeRng + 1 >= meleeDist
      }
    }
  }

  // MonAI dispatch (`0x6FD2E788 + ai * 16`, think at `+8`): ported families get their own think; every other
  // family still runs the Zombie think below (kb/monsters/d2game-zombie-ai-113c.md).
  if (MONSTATS_113C_ROWS[monster.hcIdx]?.ai === 'Fallen') {
    stepFallenThink113c(this, monster, {
      seed: unitSeed,
      target,
      dist,
      inMelee: target !== null && inMeleeRange,
      alwaysChase: hasTaunt,
      aip: (n) => monStatsAip113c(this, monster, n),
      aiInterval,
    })
    return
  }

  if (target !== null && inMeleeRange) {
    // AiZombie 0x6FCA38D7..0x6FCA3906: `pMonster->pSeed % 100 < aip4` -> A1 (mode 4), else A2 (mode 5).
    const aip4 = monStatsAip113c(this, monster, 4)
    const useA1 = rollLimitedSeed113c(unitSeed, 100) < aip4 || !monster.hasAttack2
    const skillMode: 'A1' | 'A2' = useA1 ? 'A1' : 'A2'
    const mode = skillMode === 'A1' ? 4 : 5
    const minDmg = skillMode === 'A2' ? monster.attack2MinDmg : monster.minDmg
    const maxDmg = skillMode === 'A2' ? monster.attack2MaxDmg : monster.maxDmg
    const timing = this.monsterAttackTiming(monster, skillMode)
    monster.mode = mode
    monster.actionAnimEndFrame = this.currentFrame + timing.totalFrames
    if (target.kind === 'player') {
      monster.pendingAttack = {
        playerId: target.player.unitId,
        frame: this.currentFrame + timing.actionFrame,
        mode,
        skillMode,
        minDmg,
        maxDmg,
      }
    } else if (target.kind === 'merc') {
      monster.pendingAllyAttack = {
        targetKind: 'merc',
        targetId: target.merc.unitId,
        frame: this.currentFrame + timing.actionFrame,
        mode,
        skillMode,
        minDmg,
        maxDmg,
      }
    } else if (target.kind === 'pet') {
      monster.pendingAllyAttack = {
        targetKind: 'pet',
        targetId: target.pet.uid,
        frame: this.currentFrame + timing.actionFrame,
        mode,
        skillMode,
        minDmg,
        maxDmg,
      }
    }
    return
  }

  // AiZombie 0x6FCA3A07..0x6FCA3A6B (kb/monsters/d2game-zombie-ai-113c.md §AiZombie): the "always chase"
  // special case is tested first, then `dist < aip2` gates one `pMonster->pSeed % 100 < aip1` roll, and
  // only when that fails is the Burial Grounds level check (#10331 -> #10826 == 17) made.
  const aip1 = monStatsAip113c(this, monster, 1)
  const aip2 = monStatsAip113c(this, monster, 2)
  const suKey = monster.superUniqueId?.toLowerCase()
  const shouldChase =
    suKey === 'corpsefire' ||
    suKey === 'creeping feature' ||
    hasTaunt ||
    (target !== null && dist < aip2 && rollLimitedSeed113c(unitSeed, 100) < aip1) ||
    monster.areaId === 17

  const slowPct = this.monsterSlowPercent(monster)
  if (shouldChase && target !== null) {
    const hasDecrep = monster.states.has(60)
    const moveMode = hasDecrep ? 2 : 15
    const velBonus = hasDecrep ? 0 : 100
    monster.runVelocityBonus = velBonus
    // AiZombie chase: `AI_ApproachTarget(pGame, pMonster, pTarget, RN/WL, 0, 0, 1, 0)` (`0x6FD12540`) for any
    // unit target (player, mercenary or summon; summons are monster-type path units keyed by their unit id).
    const petTargetUnitId = target.kind === 'pet' ? this.petUnitIds.get(target.pet.uid) : undefined
    const pts =
      target.kind === 'player'
        ? this.areaPathWorld.startMonsterMoveToTarget113c({
            areaId: monster.areaId,
            unitId: monster.unitId,
            hcIdx: monster.hcIdx,
            targetUnitType: 0,
            targetUnitId: target.player.unitId,
            pathType: MONSTER_MOVE_PATHTYPE_113C,
            stepNum: 1,
            velocityPct: 75 + velBonus - slowPct,
          })
        : target.kind === 'merc' || (petTargetUnitId !== undefined && target.pet.oracleAi113c !== undefined)
          ? this.areaPathWorld.startMonsterMoveToTarget113c({
              areaId: monster.areaId,
              unitId: monster.unitId,
              hcIdx: monster.hcIdx,
              targetUnitType: 1,
              targetUnitId: target.kind === 'merc' ? target.merc.unitId : petTargetUnitId!,
              pathType: MONSTER_MOVE_PATHTYPE_113C,
              stepNum: 1,
              velocityPct: 75 + velBonus - slowPct,
            })
          : this.areaPathWorld.startMonsterMoveToPos113c({
              areaId: monster.areaId,
              unitId: monster.unitId,
              hcIdx: monster.hcIdx,
              targetX: Math.round(target.x),
              targetY: Math.round(target.y),
              pathType: MONSTER_MOVE_PATHTYPE_113C,
              stepNum: 1,
              velocityPct: 75 + velBonus - slowPct,
            })
    if (pts > 0) {
      monster.mode = moveMode
    } else {
      monster.mode = 1
      monster.runVelocityBonus = 0
      monster.nextAiFrame = this.currentFrame + aiInterval
    }
    return
  }

  // `AI_IdleWander(pGame, pMonster, 3)` (`D2Game.dll` `0x6FD11B10`)
  const s1 = SEED_RollRandomNumber(unitSeed)
  let dx: number
  let dy: number
  if ((s1 & 1) !== 0) {
    dy = rollLimitedSeed113c(unitSeed, 3)
    dx = 3
  } else {
    dx = rollLimitedSeed113c(unitSeed, 3)
    dy = 3
  }
  if ((SEED_RollRandomNumber(unitSeed) & 1) !== 0) dx = -dx
  if ((SEED_RollRandomNumber(unitSeed) & 1) !== 0) dy = -dy

  monster.runVelocityBonus = 0
  const pts = this.areaPathWorld.startMonsterMoveToPos113c({
    areaId: monster.areaId,
    unitId: monster.unitId,
    hcIdx: monster.hcIdx,
    targetX: Math.round(monster.x) + dx,
    targetY: Math.round(monster.y) + dy,
    pathType: MONSTER_MOVE_PATHTYPE_113C,
    stepNum: 1,
    velocityPct: 75 - slowPct,
  })
  if (pts > 0) {
    monster.mode = 2
  } else {
    monster.mode = 1
    monster.nextAiFrame = this.currentFrame + aiInterval
  }
}

/**
 * `MONSTER_StartMode` path type for a moving mode (D2Game `0x6FC95070` stores 101 in the mode-change
 * struct when the mode-flag table `0x6FD1BC50[mode].bMoving` is set, i.e. WL/KB/S4?/RN; `0x6FC94FE3`
 * maps 101 to `PATHTYPE_TOWARD_FINISH` 13 unless the AI control block overrides it at `+0x18`).
 * See kb/monsters/d2game-zombie-ai-113c.md §MONSTER_StartMode.
 */
const MONSTER_MOVE_PATHTYPE_113C = 13

/**
 * MonStats `aip<n>` for the game difficulty, read the way D2Game does
 * (`pMonStatsTxt->wAiParam[n - 1][pGame->nDifficulty]`: int16 rows at +0x56 / +0x5C / +0x62 / +0x68 ...,
 * e.g. AiZombie 0x6FCA38FD aip4, 0x6FCA3A12 aip1, 0x6FCA3A0D aip2). No default: a missing row is a
 * data error.
 */
function monStatsAip113c(host: GameInstanceHost, monster: InternalMonsterRecord, n: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8): number {
  const row = MONSTATS_113C_ROWS[monster.hcIdx]
  if (row === undefined) {
    throw new Error(`monStatsAip113c: no MonStats.txt row for hcIdx ${monster.hcIdx}`)
  }
  const value = row[`aip${n}`][host.difficulty]
  if (value === undefined) {
    throw new Error(`monStatsAip113c: MonStats aip${n} of ${row.id} has no difficulty ${host.difficulty}`)
  }
  return value
}

/**
 * Target-search radius of `AI_FindNearestPlayerOrAlly` (`0x6FCD1C90`): `MonStats.txt` `aidist[diff]`
 * (byte at `pMonStatsTxt + 0x52 + nDifficulty`, `0x6FCD1D5D..0x6FCD1D6C`), replaced by the hard-coded `0x23`
 * (35, `0x6FCD1D41`) when that byte is 0. Players qualify when their distance is strictly below it.
 */
export function monStatsAiDist113c(hcIdx: number, difficulty: number): number {
  const row = MONSTATS_113C_ROWS[hcIdx]
  if (row === undefined || row.hcIdx !== hcIdx) {
    throw new Error(`monStatsAiDist113c: no MonStats.txt row for hcIdx ${hcIdx}`)
  }
  const value = (row as { aidist?: readonly number[] }).aidist?.[difficulty]
  if (value === undefined) {
    throw new Error(`monStatsAiDist113c: MonStats aidist of ${row.id} has no difficulty ${difficulty}`)
  }
  return value !== 0 ? value : 0x23
}

export interface MonsterCombatAiMethods {
  tryCastMonsterCombatOrSummonSkill113c(monster: InternalMonsterRecord, target: { readonly x: number; readonly y: number }, distance: number, hitMonsters: boolean): boolean
  stepBaalThroneAi(monster: InternalMonsterRecord): void
  stepBaalToStairsAi(monster: InternalMonsterRecord): void
  isRayBlockedByClosedDoor(areaId: number, fromX: number, fromY: number, toX: number, toY: number): boolean
  emitMonsterSubmergeOrEmergeSkill(monster: InternalMonsterRecord, skillId: 176 | 180, mode: 8 | 14, targetX: number, targetY: number): void
  stepTentacleHeadAi(monster: InternalMonsterRecord): void
  stepTentacleAi(monster: InternalMonsterRecord): void
  stepFrogDemonSubmergeAi(monster: InternalMonsterRecord): boolean
  stepVampireTargetAi113c(
    monster: InternalMonsterRecord,
    target:
      | { readonly kind: 'player'; readonly x: number; readonly y: number; readonly player: InternalPlayerRecord }
      | { readonly kind: 'merc'; readonly x: number; readonly y: number; readonly merc: InternalMercenaryRecord }
      | { readonly kind: 'pet'; readonly x: number; readonly y: number; readonly pet: SummonedPetUnit }
      | { readonly kind: 'monster'; readonly x: number; readonly y: number; readonly monster: InternalMonsterRecord },
    dist: number,
    hasDimVision: boolean,
    hasTaunt: boolean,
  ): void
  stepMonsterAi(monster: InternalMonsterRecord): void
}

export const monsterCombatAiMethods: Record<keyof MonsterCombatAiMethods, unknown> = {
  tryCastMonsterCombatOrSummonSkill113c,
  stepBaalThroneAi,
  stepBaalToStairsAi,
  isRayBlockedByClosedDoor,
  emitMonsterSubmergeOrEmergeSkill,
  stepTentacleHeadAi,
  stepTentacleAi,
  stepFrogDemonSubmergeAi,
  stepVampireTargetAi113c,
  stepMonsterAi,
}
