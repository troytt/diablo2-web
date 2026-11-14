/**
 * 1.13c Monster Hit/Death FX, Screen Shake, and Quest Visual Controllers (`src/client/world/world-quest-fx.ts`).
 */

import {
  HELLFORGE_OBJECT_CLASS,
  HELLFORGE_SMASH_SOUND,
  HELLFORGE_SONG_SOUND,
  HF_CONTROL_MISSILE,
} from './quest-fx-hellforge-113c.ts'
import {
  ANYA_CENTER_MISSILE,
  ANYA_INITIAL_TARGET_Y,
  FROZEN_ANYA_INTERACT_OBJECT_CLASS,
  FROZEN_ANYA_OBJECT_CLASS,
  TAINTED_SUN_ALTAR_OBJECT_CLASS,
  TAINTED_SUN_CONTROL_MISSILE,
} from './quest-fx-tainted-anya-baal-113c.ts'
import { d2Rand, LIGHT_SEED_HI, type D2Seed } from '../../common/drlg/light-grid.ts'
import { getMissileTxtData } from '../../common/skills/missiles-data.ts'
import {
  D2CLIENT_DEATH_BOOM_POINTS,
  D2CLIENT_NOVA_RING_X,
  D2CLIENT_NOVA_RING_Y,
  DURIEL_MAGGOT_HCIDX,
  DURIEL_MAGGOT_OFFSETS,
  MON_UMOD,
  calcColdEnchantedDeathNova,
  computeChargedBolt8WayVectors,
  getBossDeathFxSpec,
  getFreezeShatterMissiles,
  getInnateMonsterDeathOverlays,
  hasMonsterUMod,
  hasShatterState113c,
  isBaalCloneMonster,
  isBoneFetishMonster,
  isDurielMonster,
  isFireTowerMonster,
  isMaggotSmallMonster,
  isPoisonDeadMonster,
  isScarabMonster,
  isSuicideMinionMonster,
  resolveSuicideExplodeMissileKey,
} from '../../common/units/monster-death-fx.ts'
import { ClientUnit } from './client-unit.ts'
import { applyClientMonsterDeathModeOverlays113c } from './monster-overlays-113c.ts'
import {
  BR_DEATH_CONTROL_INITIAL_COUNTDOWN,
  BR_DEATH_MISSILES_113C,
  MEPHISTO_DEATH_CONTROL_INITIAL_COUNTDOWN,
  MEPHISTO_DEATH_MISSILES_113C,
  OVERSEER_CONTROL_INITIAL_COUNTDOWN,
} from './boss-death-cltdo-113c.ts'
import {
  COMPELLING_ORB_MONSTER_CLASS,
  DURANCE_STAIRS_OBJECT_CLASS,
  MONUMOD_QUESTCOMPLETE,
  ORB_MIST_MISSILE_ROWS,
  TOWER_CHEST_OBJECT_CLASS,
  TOWER_MIST_MISSILE_ROWS,
  orbMistTarget,
} from './quest-fx-compelling-orb-113c.ts'
import { QUEST_FX_MISSILES_113C } from './quest-fx-data-113c.ts'
import {
  HORADRIC_MISSILE_ROWS,
  HORADRIC_ORIFICE_OBJECT_CLASS,
  HORADRIC_ORIFICE_OVERLAY,
  TRAJ_FIXED_SHIFT,
  lightningTraj3d,
  staffTraj3d,
  type HoradricStaffSpawn,
} from './quest-fx-horadric-113c.ts'
import type { ClientWorldInternal } from './world-skill-state-tables.ts'

export function triggerMonsterGetHitFxImpl(this: ClientWorldInternal, unit: ClientUnit): void {
  if (unit.unitType !== 'monster' || unit.dead) return
  if (
    unit.isNpc ||
    unit.ownerType === 'player' ||
    this._pets.has(unit.id) ||
    (this._merc && unit.id === this._merc.mercId)
  ) {
    return
  }
  const vectors = computeChargedBolt8WayVectors(16)
  const mlvl = Math.max(1, unit.stats.get(12) || 1)
  if (!unit.isMinion && hasMonsterUMod(unit, MON_UMOD.LIGHTNING)) {
    for (const vec of vectors) {
      this.spawnMissileByKey(
        'lightunique',
        unit.x,
        unit.y,
        unit.x + vec.dx,
        unit.y + vec.dy,
        {
          ownerType: 'monster',
          ownerId: unit.id,
          sourceSkillId: 38,
          skillLevel: Math.max(1, Math.floor(mlvl / 2)),
          jitterIndex: vec.index + 1,
        },
      )
    }
  }
  if (hasMonsterUMod(unit, MON_UMOD.SCARAB) || isScarabMonster(unit.classId, unit.name)) {
    for (const vec of vectors) {
      this.spawnMissileByKey(
        'buglightning',
        unit.x,
        unit.y,
        unit.x + vec.dx,
        unit.y + vec.dy,
        {
          ownerType: 'monster',
          ownerId: unit.id,
          sourceSkillId: 38,
          skillLevel: mlvl,
          jitterIndex: vec.index + 1,
        },
      )
    }
  }
}

/** D2Client death handlers 0x6fad0a60 / 0x6fad0d20 / 0x6fad0e60 play sound 0x99a (necromancer_corpseexp_1). */
const CORPSE_EXPLODE_SOUND_113C = 0x99a

function pushCorpseExplodeSound(this: ClientWorldInternal, unit: ClientUnit): void {
  this.pushSoundRequest({
    soundId: CORPSE_EXPLODE_SOUND_113C,
    unit: { unitType: 'monster', id: unit.id, x: unit.x, y: unit.y },
    x: unit.x,
    y: unit.y,
  })
}

/** Stationary death missile at (x, y); lifetime = Missiles.txt `Range` of the real row. */
function spawnStaticDeathMissile(
  this: ClientWorldInternal,
  unit: ClientUnit,
  missileKey: string,
  x: number,
  y: number,
): ClientUnit {
  const row = getMissileTxtData(missileKey)
  const m = this.spawnMissileByKey(missileKey, x, y, x, y, {
    ownerType: 'monster',
    ownerId: unit.id,
    loopAnim: false,
    maxTicks: Math.max(1, row.range),
  })
  m.vx = 0
  m.vy = 0
  return m
}

/** `missileKey` at the five D2Client death-boom points (`D2CLIENT_DEATH_BOOM_POINTS`). */
function spawnDeathBoomPoints(this: ClientWorldInternal, unit: ClientUnit, missileKey: string): void {
  for (const p of D2CLIENT_DEATH_BOOM_POINTS) {
    spawnStaticDeathMissile.call(this, unit, missileKey, unit.x + p.dx, unit.y + p.dy)
  }
}

/**
 * D2Client 0x6fb51020(missile, -1, …) -> 0x6fb50db0(0): one `missileKey` per entry of the 64-entry ring
 * table, aimed at `(x + X[i], y + Y[i])`. The velocity override passed in ebx is `Vel` of
 * `velocityMissileKey` (0x6fabcb5c).
 */
function spawnD2ClientNovaRing(
  this: ClientWorldInternal,
  unit: ClientUnit,
  missileKey: string,
  velocityMissileKey: string,
  level: number,
): void {
  const ownVel = getMissileTxtData(missileKey).vel
  const overrideVel = getMissileTxtData(velocityMissileKey).vel
  if (!(ownVel > 0) || !(overrideVel > 0)) {
    throw new Error(
      `nova ring ${missileKey}: Missiles.txt Vel must be > 0 (own ${ownVel}, ${velocityMissileKey} ${overrideVel})`,
    )
  }
  const velScale = overrideVel / ownVel
  for (let i = 0; i < D2CLIENT_NOVA_RING_X.length; i++) {
    const m = this.spawnMissileByKey(
      missileKey,
      unit.x,
      unit.y,
      unit.x + D2CLIENT_NOVA_RING_X[i]!,
      unit.y + D2CLIENT_NOVA_RING_Y[i]!,
      { ownerType: 'monster', ownerId: unit.id, skillLevel: Math.max(1, level) },
    )
    m.vx *= velScale
    m.vy *= velScale
  }
}

/**
 * Bone Fetish death (MonStats deathDmg, nBaseId bonefetish1, D2Game.dll 0x6fc65320): creates
 * exactly one MISSILE_MONSTERCORPSEEXPLODE (#117) at the unit (#1210). No undeadmissile skulls.
 */
function applyBoneFetishDeath(this: ClientWorldInternal, unit: ClientUnit): void {
  unit.corpseSuppressed = true
  this.attachUnitOverlay(unit, 'fetishdeath1', false)
  this.attachUnitOverlay(unit, 'fetishdeath2', false)
  spawnStaticDeathMissile.call(this, unit, 'monstercorpseexplode', unit.x, unit.y)
}

export function triggerMonsterDeathFxImpl(this: ClientWorldInternal, unit: ClientUnit): void {
  if (unit.unitType !== 'monster' || unit.deathFxTriggered) return
  if (unit.mode !== 12) {
    this.emitMonsterModeSound(unit, 0)
  } else if (unit.id > 0) {
    this._deadSoundUnitIds.add(unit.id)
  }
  unit.deathFxTriggered = true
  if (unit.mode !== 12) {
    applyClientMonsterDeathModeOverlays113c(unit, () => this._nextOverlayId++)
  }
  if (
    unit.isNpc ||
    unit.ownerType === 'player' ||
    this._pets.has(unit.id) ||
    (this._merc && unit.id === this._merc.mercId)
  ) {
    return
  }
  const mlvl = Math.max(1, unit.stats.get(12) || 1)

  // 1. Freeze / Shatter on Death (`D2Client.dll` 0x6FAFBEC0): States.txt shatter=1 (#1 freeze, #107 shatter,
  // #184 uberminion) or MonUMod #35 shatter_on_death. Spawns with dwFlags = 0x2020 (0x6FB63570 4-way shard direction),
  // and MissCltHitFunc[31] leaves the icebreak*melt puddle at matching direction (#1453).
  if (hasShatterState113c(unit.states) || hasMonsterUMod(unit, MON_UMOD.SHATTER_ON_DEATH)) {
    unit.corpseSuppressed = true
    const shatterDir = (unit.id + Math.round(unit.x) + Math.round(unit.y)) & 3
    const shatterMissiles = getFreezeShatterMissiles(unit.classId, this.getUnitSizeX(unit))
    for (const mKey of shatterMissiles) {
      const shard = this.spawnMissileByKey(mKey, unit.x, unit.y, unit.x, unit.y, {
        ownerType: 'monster',
        ownerId: unit.id,
        direction: mKey === 'icebreaksmoke' ? 0 : shatterDir,
        loopAnim: false,
      })
      shard.vx = 0
      shard.vy = 0
    }
  }

  // 2. MonUMod Death Effects (minions excluded per MonUMod.txt exclude=1)
  if (!unit.isMinion) {
    if (hasMonsterUMod(unit, MON_UMOD.FIRE)) {
      // D2Client 0x6fad0d20 (umod 9, mode 0, event param 4): 5x 0x75 monstercorpseexplode then
      // 5x 0x52 fireexplosion at (x,y) and the four diagonal neighbours, then sound 0x99a.
      // No overlay is attached (#1209).
      spawnDeathBoomPoints.call(this, unit, 'monstercorpseexplode')
      spawnDeathBoomPoints.call(this, unit, 'fireexplosion')
      pushCorpseExplodeSound.call(this, unit)
    }

    if (unit.mode === 0 && hasMonsterUMod(unit, MON_UMOD.COLD)) {
      // D2Client 0x6fad0c40 edi==0x12: coldunique (#194) ring with frostnova (#119) Vel (#1211).
      const novaSpec = calcColdEnchantedDeathNova(mlvl)
      spawnD2ClientNovaRing.call(
        this,
        unit,
        novaSpec.missileKey,
        novaSpec.velocityMissileKey,
        novaSpec.skillLevel,
      )
    }

    if (unit.mode === 0 && hasMonsterUMod(unit, MON_UMOD.NOVADEATH)) {
      // D2Client 0x6fad0c40 edi==0x2a (umod 42 novadeath, mode 0): 0x5a nova (#90) ring,
      // velocity from 0x6fabcb5c(0x5a) (#1212).
      spawnD2ClientNovaRing.call(this, unit, 'nova', 'nova', mlvl)
    }

    if (hasMonsterUMod(unit, MON_UMOD.CORPSEBOOMDEATH)) {
      // D2Client 0x6fad0e60 (umod 31 corpseboom, mode 0, event param 4): 5x 0x52 fireexplosion
      // at (x,y) and the four diagonal neighbours, then sound 0x99a.
      spawnDeathBoomPoints.call(this, unit, 'fireexplosion')
      pushCorpseExplodeSound.call(this, unit)
    }

    if (hasMonsterUMod(unit, MON_UMOD.PAINWORMDEATH)) {
      // D2Client 0x6fad0fa0 -> 0x6fad0a60 (umod 40): 0x75 monstercorpseexplode + 0x221
      // 'pain worm appear' (#545) at the unit, then sound 0x99a (#1214).
      for (const key of ['monstercorpseexplode', 'pain worm appear'] as const) {
        spawnStaticDeathMissile.call(this, unit, key, unit.x, unit.y)
      }
      pushCorpseExplodeSound.call(this, unit)
    }

    if (
      unit.mode === 0 &&
      (hasMonsterUMod(unit, MON_UMOD.POISON) || isPoisonDeadMonster(unit.classId, unit.name))
    ) {
      // D2Client 0x6fad0c40 (edi == 0xa, MonUMod 10 poisondead, mode 0): 1x 0x9b corpsepoisoncloud (#155)
      // at the unit (#1219).
      const centerCloud = this.spawnMissileByKey(
        'corpsepoisoncloud',
        unit.x,
        unit.y,
        unit.x,
        unit.y,
        {
          ownerType: 'monster',
          ownerId: unit.id,
          skillLevel: mlvl,
          maxTicks: getMissileTxtData('corpsepoisoncloud').range,
        },
      )
      centerCloud.vx = 0
      centerCloud.vy = 0
    }

    if (isBoneFetishMonster(unit.classId, unit.name)) {
      applyBoneFetishDeath.call(this, unit)
    }

    if (hasMonsterUMod(unit, MON_UMOD.KILL_MINIONS)) {
      // MonUMod 15 killminionsdeath (D2Game.dll 0x6fc6fd10) (#1213).
      for (const m of this._monsters.values()) {
        if (m.id === unit.id || m.dead) continue
        if (
          (m.isMinion || m.ownerId === unit.id) &&
          Math.hypot(m.x - unit.x, m.y - unit.y) <= 25
        ) {
          m.tempSummonExpireTick = this.frameCount + 1
        }
      }
    }
  } else if (isBoneFetishMonster(unit.classId, unit.name)) {
    // Innate Bone Fetish death explosion applies even to minion Bone Fetishes
    applyBoneFetishDeath.call(this, unit)
  } else if (unit.mode === 0 && isPoisonDeadMonster(unit.classId, unit.name)) {
    const centerCloud = this.spawnMissileByKey(
      'corpsepoisoncloud',
      unit.x,
      unit.y,
      unit.x,
      unit.y,
      {
        ownerType: 'monster',
        ownerId: unit.id,
        skillLevel: mlvl,
        maxTicks: getMissileTxtData('corpsepoisoncloud').range,
      },
    )
    centerCloud.vx = 0
    centerCloud.vy = 0
  }

  // MonUMod #20 Scarab (`D2Client.dll` mode 0 / `D2Game.dll` `0x6FC41B00` -> `0x6FC460D0`, #1995):
  // Fires 8 radial `buglightning` (#225) bolts at `slvl = mlvl` across all monster ranks (including minions).
  if (
    unit.mode === 0 &&
    (hasMonsterUMod(unit, MON_UMOD.SCARAB) || isScarabMonster(unit.classId, unit.name))
  ) {
    const boltKey = 'buglightning'
    const vectors = computeChargedBolt8WayVectors(16)
    for (const vec of vectors) {
      this.spawnMissileByKey(boltKey, unit.x, unit.y, unit.x + vec.dx, unit.y + vec.dy, {
        ownerType: 'monster',
        ownerId: unit.id,
        sourceSkillId: 38,
        skillLevel: mlvl,
        jitterIndex: vec.index + 1,
      })
    }
  }

  // 3. Innate Monster Death Overlays & Special Monster Death Missiles
  const innateOverlays = getInnateMonsterDeathOverlays(unit.classId, unit.name)
  for (const ovToken of innateOverlays) {
    this.attachUnitOverlay(unit, ovToken, false)
  }
  if (
    unit.mode === 0 &&
    ((!unit.isMinion && hasMonsterUMod(unit, MON_UMOD.SUICIDEMINION_EXPLODE)) ||
      isSuicideMinionMonster(unit.classId, unit.name))
  ) {
    // D2Client 0x6facffc0 (MonUMod 33 event 2, mode 0): selects suicidefireexplode (#427, aip1==1),
    // suicideiceexplode (#428, aip1>=2), or suicidecorpseexplode (#426, default) + sound 0x99a (#1218).
    unit.corpseSuppressed = true
    const suiKey = resolveSuicideExplodeMissileKey(
      unit.classId,
      this.difficulty ?? 0,
      unit.aip1,
    )
    spawnStaticDeathMissile.call(this, unit, suiKey, unit.x, unit.y)
    pushCorpseExplodeSound.call(this, unit)
  }
  if (isFireTowerMonster(unit.classId, unit.name)) {
    // D2Client 0x6fafe850 (classId 0x1b3 = 435 barricadetower): spawns 0x1a8 'tower death' (#424, Range=1) (#1220).
    spawnStaticDeathMissile.call(this, unit, 'tower death', unit.x, unit.y)
  }
  if (isBaalCloneMonster(unit.classId, unit.name)) {
    // D2Client 0x6fafe588 -> 0x6fafe717 (classId 0x23a = 570 baalclone): spawns 0x266 'baalclonedeath' (#614, Range=20,
    // AnimLen=20, CelFile=Expansion\Baalteleport) and sets mode 0xc (MONMODE_DEAD, corpseSuppressed) (#1216, #1221).
    unit.corpseSuppressed = true
    unit.mode = 12
    spawnStaticDeathMissile.call(this, unit, 'baalclonedeath', unit.x, unit.y)
  }

  // 4. Duriel (hcIdx=211) Death: 5x Small Maggots (hcIdx=227) + durieldead_fwd / durieldead_rear
  if (isDurielMonster(unit.classId, unit.name)) {
    for (let i = 0; i < DURIEL_MAGGOT_OFFSETS.length; i++) {
      const off = DURIEL_MAGGOT_OFFSETS[i]!
      let mx = unit.x + off.dx
      let my = unit.y + off.dy
      if (this.isSubTileBlocked(mx, my)) {
        mx = unit.x
        my = unit.y
      }
      const maggotId = 960000 + ((unit.id * 10 + i) % 30000)
      const maggot = new ClientUnit({
        unitType: 'monster',
        id: maggotId,
        classId: DURIEL_MAGGOT_HCIDX,
        name: 'maggot',
        x: mx,
        y: my,
        mode: 1,
        direction: (i * 12) & 0x3f,
        lifePct: 128,
        isMinion: true,
        ownerType: 'monster',
        ownerId: unit.id,
      })
      this._units.set(maggot.key, maggot)
      this._monsters.set(maggot.id, maggot)
      this.npcMotion.spawnMonster({
        unitId: maggot.id,
        classId: maggot.classId,
        x: maggot.x,
        y: maggot.y,
        mode: maggot.mode,
        direction: maggot.direction,
        lifePct: maggot.lifePct,
        isDead: false,
      })
    }
  }

  // 5. Act Boss & Quest Boss Death FX Controller + Screen Shake + Minion Purge
  const rawBossSpec = getBossDeathFxSpec(unit.classId, unit.name)
  // 1.13c Blood Raven (267) / Shenk (overseer1 479) death shows are the MonUMod 22 `questcomplete` event-1 handler
  // 0x6fad0fb0 (mode 0 only): a plain overseer1 without umod 22 has no show and purges nothing (Issue #1042).
  const bossSpec =
    rawBossSpec !== null &&
    rawBossSpec.requiresQuestCompleteUMod === true &&
    !(unit.mode === 0 && hasMonsterUMod(unit, MONUMOD_QUESTCOMPLETE))
      ? null
      : rawBossSpec
  if (bossSpec) {
    const ctrlSeed: D2Seed = {
      lo: ((unit.id ^ 0x6ac690c5) + Math.floor(unit.x) * 31 + Math.floor(unit.y)) >>> 0,
      hi: LIGHT_SEED_HI,
    }
    if (bossSpec.bossKey === 'countess') {
      // 1.13c D2Client 0x6fad0fb0 (MonUMod 22 event 1, mode 0) -> 0x6fb02860 (The Countess, MonStats 45 corruptrogue3):
      // Finds objects.txt 0x173 (371, Tower Tome / quest chest) in room or near rooms (fallback (x-15, y-15)),
      // spawns moving towermist (#291, Vel=2, Range=400, pCltDoFunc=25) from (x,y) toward (target.x, target.y),
      // and spawns stationary towerchestspawner (#332, Vel=0, Range=400, pCltDoFunc=30) at (target.x, target.y)
      // with SetTargetY(0) (#1215).
      const x = Math.floor(unit.x)
      const y = Math.floor(unit.y)
      let chest: { x: number; y: number } | null =
        this._nearRoomObjectFinder !== null
          ? this._nearRoomObjectFinder(x, y, TOWER_CHEST_OBJECT_CLASS)
          : null
      if (chest === null) {
        for (const obj of this._units.values()) {
          if (obj.unitType === 'object' && obj.classId === TOWER_CHEST_OBJECT_CLASS) {
            chest = { x: Math.floor(obj.x), y: Math.floor(obj.y) }
            break
          }
        }
      }
      const target = orbMistTarget(
        { x, y },
        chest === null ? null : { x: Math.floor(chest.x), y: Math.floor(chest.y) },
      )
      const mistRow = TOWER_MIST_MISSILE_ROWS.mist
      this.spawnMissileByKey(mistRow.name, x, y, target.x, target.y, {
        classId: mistRow.id,
        ownerType: 'monster',
        ownerId: unit.id,
        maxTicks: mistRow.range,
        loopAnim: true,
        missileSeed: ctrlSeed,
      })
      const spawnerRow = TOWER_MIST_MISSILE_ROWS.chestSpawner
      const spawnerSeed: D2Seed = {
        lo: ((unit.id ^ 0x5bd1e995) + target.x * 31 + target.y) >>> 0,
        hi: LIGHT_SEED_HI,
      }
      const spawner = this.spawnMissileByKey(
        spawnerRow.name,
        target.x,
        target.y,
        target.x,
        target.y,
        {
          classId: spawnerRow.id,
          ownerType: 'monster',
          ownerId: unit.id,
          maxTicks: spawnerRow.range,
          loopAnim: true,
          missileSeed: spawnerSeed,
        },
      )
      spawner.vx = 0
      spawner.vy = 0
      spawner.cltCountdownY = 0
    } else {
      // The controller lives for its Missiles.txt Range (no maxTicks override, #1207); Diablo's 0x6fb02600 creates no
      // missile at all (#1205).
      const ctrl =
        bossSpec.controllerMissile === null
          ? null
          : this.spawnMissileByKey(bossSpec.controllerMissile, unit.x, unit.y, unit.x, unit.y, {
              ownerType: 'monster',
              ownerId: unit.id,
              loopAnim: true,
              missileSeed: ctrlSeed,
            })
      if (ctrl) {
        ctrl.vx = 0
        ctrl.vy = 0
        if (bossSpec.bossKey === 'bloodraven') {
          // 0x6fb02320: brdeathcontrol + SetTargetX(50), then brdeathspirits1 and brdeathsmokes1, once each, on Blood
          // Raven; their S1 -> NU -> DT chains are the rows' ExplosionMissile + AlwaysExplode (Issue #1041).
          ctrl.cltCountdown = BR_DEATH_CONTROL_INITIAL_COUNTDOWN
          for (const key of BR_DEATH_MISSILES_113C.slice(1)) {
            const m = this.spawnMissileByKey(key, unit.x, unit.y, unit.x, unit.y, {
              ownerType: 'monster',
              ownerId: unit.id,
            })
            m.vx = 0
            m.vy = 0
          }
        } else if (bossSpec.bossKey === 'shenk') {
          // 0x6fb02bd0: overseercontrol + SetTargetX(25) (Issue #1040).
          ctrl.cltCountdown = OVERSEER_CONTROL_INITIAL_COUNTDOWN
        } else if (bossSpec.bossKey === 'mephisto') {
          // 0x6fb02270: mephistodeathcontrol + SetTargetX(75) / SetTargetY(75), then mephistoholedelay and
          // mephistodonotdraw, once each, on Mephisto (Issue #1208).
          ctrl.cltCountdown = MEPHISTO_DEATH_CONTROL_INITIAL_COUNTDOWN
          ctrl.cltCountdownY = MEPHISTO_DEATH_CONTROL_INITIAL_COUNTDOWN
          // Both are static (Vel 0, AnimLen 2) helpers that live for their Missiles.txt Range (50 / 70): holedelay
          // then explodes into mephistoholebirth, donotdraw fires its corpseexplosions at elapsed CltParam1.
          for (const key of MEPHISTO_DEATH_MISSILES_113C.slice(1)) {
            const m = this.spawnMissileByKey(key, unit.x, unit.y, unit.x, unit.y, {
              ownerType: 'monster',
              ownerId: unit.id,
              maxTicks: getMissileTxtData(key).range,
            })
            m.vx = 0
            m.vy = 0
          }
        }
      }
    }

    // 1.13c monster death handlers (0x6FB02xxx) never trigger StartScreenShake (#1718):
    // Andariel and Duriel shakes come from their controller missiles (CltDo 29 at elapsed 90, CltDo 36 at rem 325).

    if (bossSpec.purgeSurroundingMonstersRadius > 0) {
      for (const m of this._monsters.values()) {
        if (m.id === unit.id || m.dead) continue
        if (this.isFriendlyOrNonHostileMonster(m)) continue
        if (isMaggotSmallMonster(m.classId, m.name)) continue
        const dist = Math.hypot(m.x - unit.x, m.y - unit.y)
        if (dist <= bossSpec.purgeSurroundingMonstersRadius) {
          if (
            bossSpec.bossKey === 'andariel' ||
            bossSpec.bossKey === 'shenk' ||
            m.isMinion ||
            m.ownerId === unit.id
          ) {
            m.tempSummonExpireTick = this.frameCount + 12 + (m.id % 20)
          }
        }
      }
    }
  }

  // 6. 1.13c MonUMod 22 `questcomplete` event 1 (0x6fba9fe0[22 * 5 + 1] = 0x6fad0fb0): MonStats 366 `compellingorb`
  // in mode 0 -> 0x6fb030d0, the orb mist that flows to the Durance stairs (Issue #917).
  if (
    unit.classId === COMPELLING_ORB_MONSTER_CLASS &&
    unit.mode === 0 &&
    hasMonsterUMod(unit, MONUMOD_QUESTCOMPLETE)
  ) {
    this.spawnCompellingOrbMist(unit)
  }
}

/**
 * 1.13c `D2Client.dll` `0x6FB3AD30` (called by `UpdateScreenShake` `0x6FB3AFD0`, Issue #1721, #2023):
 * Computes `vol = clamp(trunc(amp * 255 / 20), 0, 255)`, plays/updates looping sound `0x1C4` (`452` `andariel_quake_loop`)
 * while `vol > 0`, and stops it when `vol === 0`.
 */
export function updateScreenShakeSound113c(this: ClientWorldInternal, amp: number): void {
  const vol = Math.max(0, Math.min(255, Math.trunc((amp * 255) / 20)))
  if (vol > 0) {
    const unitId = this._screenShakeSoundUnitId || this.selfId || 1
    this._screenShakeSoundUnitId = unitId
    const unit = { unitType: 'player' as const, id: unitId, isLocalPlayer: true }
    if (!this._screenShakeSoundActive) {
      this._screenShakeSoundActive = true
      this._screenShakeSoundVol = vol
      this.pushSoundRequest({
        kind: 'unit-loop-start',
        soundId: 0x1c4,
        unitId,
        unit,
        local: true,
        volume: vol,
        volumeOverride: vol,
      })
    } else if (this._screenShakeSoundVol !== vol) {
      this._screenShakeSoundVol = vol
      this.pushSoundRequest({
        kind: 'unit-loop-start',
        soundId: 0x1c4,
        unitId,
        unit,
        local: true,
        volume: vol,
        volumeOverride: vol,
      })
    }
  } else if (this._screenShakeSoundActive) {
    const unitId = this._screenShakeSoundUnitId || this.selfId || 1
    const unit = { unitType: 'player' as const, id: unitId, isLocalPlayer: true }
    this._screenShakeSoundActive = false
    this._screenShakeSoundVol = 0
    this._screenShakeSoundUnitId = 0
    this.pushSoundRequest({
      kind: 'unit-sound-stop',
      soundId: 0x1c4,
      unitId,
      unit,
      local: true,
    })
  }
}

/**
 * 1.13c `D2Client.dll` `0x6FB39EB0` (`ClearScreenShake`): zeroes the active screen shake state and stops
 * any active `0x1C4` (`452` `andariel_quake_loop`) loop sound.
 */
export function clearScreenShakeImpl(this: ClientWorldInternal): void {
  updateScreenShakeSound113c.call(this, 0)
  this._screenShake = {
    active: false,
    startMs: 0,
    rampUpMs: 0,
    sustainMs: 0,
    rampDownMs: 0,
    amplitude: 0,
    offsetX: 0,
    offsetY: 0,
  }
}

export function startScreenShakeImpl(this: ClientWorldInternal, sustainMs: number, amplitude: number, rampUpMs = 0, rampDownMs = 0): void {
  const sustain = Math.trunc(sustainMs)
  // 1.13c StartScreenShake (0x6FB39F00): test esi, esi; je -> no-op when sustain <= 0 (#1721).
  if (sustain <= 0) return
  this._screenShake = {
    active: true,
    startMs: this._simTimeMs,
    rampUpMs: Math.max(0, Math.trunc(rampUpMs)),
    sustainMs: sustain,
    rampDownMs: Math.max(0, Math.trunc(rampDownMs)),
    amplitude: Math.max(0, Math.trunc(amplitude)),
    offsetX: 0,
    offsetY: 0,
  }
  this.updateScreenShake()
}

export function updateScreenShakeImpl(this: ClientWorldInternal): void {
  const sh = this._screenShake
  if (!sh.active) return
  const dt = this._simTimeMs - sh.startMs
  const totalMs = sh.rampUpMs + sh.sustainMs + sh.rampDownMs
  // 1.13c UpdateScreenShake (0x6FB3AFD0 -> 0x6FB3AFFF..0x6FB3B005): cmp ecx, eax; jbe -> ends when dt > totalMs (#1721).
  if (dt < 0 || dt > totalMs) {
    clearScreenShakeImpl.call(this)
    return
  }
  let amp = 0
  if (dt < sh.rampUpMs && sh.rampUpMs > 0) {
    amp = Math.trunc((sh.amplitude * dt) / sh.rampUpMs)
  } else if (dt < sh.rampUpMs + sh.sustainMs) {
    amp = sh.amplitude
  } else if (sh.rampDownMs > 0) {
    const remDown = sh.rampDownMs - (dt - sh.rampUpMs - sh.sustainMs)
    amp = Math.trunc((sh.amplitude * remDown) / sh.rampDownMs)
  }
  if (amp > 0) {
    // 1.13c 0x6FB3B065..0x6FB3B088: draws RAND(2*amp) - amp twice from the local player unit seed (unit+0x20, #1721).
    const selfPlayer = this.selfId ? this.getUnit('player', this.selfId) : undefined
    const shakeSeed = selfPlayer?.seed ?? this._questFxSeed
    const offsetX = d2Rand(shakeSeed, 2 * amp) - amp
    const offsetY = d2Rand(shakeSeed, 2 * amp) - amp
    this._screenShake = { ...sh, offsetX, offsetY }
  } else {
    this._screenShake = { ...sh, offsetX: 0, offsetY: 0 }
  }
  const soundAmp =
    this._screenShakeSoundActive && sh.amplitude > 0 && dt >= 0 && dt < sh.rampUpMs && amp === 0
      ? 1
      : amp
  updateScreenShakeSound113c.call(this, soundAmp)
}

export function spawnDenOfEvilLightsInRoomImpl(
  this: ClientWorldInternal,
  roomSubX: number,
  roomSubY: number,
  roomSubW: number,
  roomSubH: number,
): ClientUnit[] {
  if (roomSubW <= 0 || roomSubH <= 0) return []
  const row287 = QUEST_FX_MISSILES_113C[287]!
  const spawned: ClientUnit[] = []
  let attempts = 0
  while (spawned.length < 3 && attempts < 25) {
    attempts += 1
    const dx = d2Rand(this._questFxSeed, roomSubW)
    const dy = d2Rand(this._questFxSeed, roomSubH)
    const x = roomSubX + dx
    const y = roomSubY + dy
    if (this.isSubTileBlocked(x, y)) continue
    const missileSeed: D2Seed = {
      lo: d2Rand(this._questFxSeed, 0x7fffffff),
      hi: LIGHT_SEED_HI,
    }
    const dir64 = d2Rand(missileSeed, 64)
    const initialFrame = d2Rand(missileSeed, row287.animLen)
    const lightUnit = this.spawnMissileByKey('denofevillight', x, y, x, y, {
      classId: row287.id,
      ownerType: 'player',
      ownerId: this.selfId || 1,
      maxTicks: row287.range,
      loopAnim: true,
      direction: dir64,
      initialFrame,
      missileSeed,
    })
    lightUnit.vx = 0
    lightUnit.vy = 0
    spawned.push(lightUnit)
  }
  return spawned
}

export function spawnCairnStonesControllerImpl(this: ClientWorldInternal, stoneX: number, stoneY: number): ClientUnit {
  const row288 = QUEST_FX_MISSILES_113C[288]!
  const missileSeed: D2Seed = {
    lo: (Math.floor(stoneX) ^ 0x6ac690c5) >>> 0,
    hi: LIGHT_SEED_HI,
  }
  const ctrl = this.spawnMissileByKey('cairnstones', stoneX, stoneY, stoneX, stoneY, {
    classId: row288.id,
    ownerType: 'player',
    ownerId: this.selfId || 1,
    maxTicks: row288.range,
    loopAnim: true,
    missileSeed,
  })
  ctrl.vx = 0
  ctrl.vy = 0
  return ctrl
}

export function spawnDiabloAppearsControllerImpl(this: ClientWorldInternal, x: number, y: number): ClientUnit {
  const row372 = QUEST_FX_MISSILES_113C[372]!
  const ctrl = this.spawnMissileByKey('diablo appears', x, y, x, y, {
    classId: row372.id,
    ownerType: 'player',
    ownerId: this.selfId || 1,
    maxTicks: row372.range,
    loopAnim: false,
  })
  ctrl.vx = 0
  ctrl.vy = 0
  return ctrl
}

export function spawnCompellingOrbMistImpl(this: ClientWorldInternal, orb: ClientUnit): ClientUnit {
  if (orb.unitType !== 'monster' || orb.classId !== COMPELLING_ORB_MONSTER_CLASS) {
    throw new Error(`spawnCompellingOrbMist: unit ${orb.key} is not MonStats 366 compellingorb`)
  }
  const x = Math.floor(orb.x)
  const y = Math.floor(orb.y)
  const finder = this._nearRoomObjectFinder
  let stairs: ClientUnit | null = null
  if (finder !== null) {
    stairs = finder(x, y, DURANCE_STAIRS_OBJECT_CLASS)
  } else {
    let bestDistSq = Number.POSITIVE_INFINITY
    for (const u of this._units.values()) {
      if (u.unitType !== 'object' || u.classId !== DURANCE_STAIRS_OBJECT_CLASS) continue
      const dx = u.x - x
      const dy = u.y - y
      const dSq = dx * dx + dy * dy
      if (dSq < bestDistSq) {
        bestDistSq = dSq
        stairs = u
      }
    }
  }
  const target = orbMistTarget({ x, y }, stairs === null ? null : { x: Math.floor(stairs.x), y: Math.floor(stairs.y) })
  const row = ORB_MIST_MISSILE_ROWS.mist
  const mist = this.spawnMissileByKey(row.name, x, y, target.x, target.y, {
    classId: row.id,
    ownerType: 'monster',
    ownerId: orb.id,
    maxTicks: row.range,
    loopAnim: true,
    // UNVERIFIED: the initial unit seed of a client missile (unit+0x20) is not ported; the RAND steps are.
    missileSeed: { lo: d2Rand(this._questFxSeed, 0x7fffffff), hi: LIGHT_SEED_HI },
  })
  this.pushSoundRequest({ stingerSoundId: 4687 })
  return mist
}

export function spawnHoradricStaffAtOrificeImpl(this: ClientWorldInternal, orifice: ClientUnit): ClientUnit {
  if (orifice.unitType !== 'object' || orifice.classId !== HORADRIC_ORIFICE_OBJECT_CLASS) {
    throw new Error(`spawnHoradricStaffAtOrifice: unit ${orifice.key} is not objects.txt 152 orifice`)
  }
  const row = HORADRIC_MISSILE_ROWS.staff
  const x = Math.floor(orifice.x)
  const y = Math.floor(orifice.y)
  const staff = this.spawnMissileByKey(row.name, x, y, x, y, {
    classId: row.id,
    ownerType: 'player',
    ownerId: this.selfId || 1,
    maxTicks: row.range,
    loopAnim: true,
    // UNVERIFIED: the initial unit seed of a client missile (unit+0x20) is not ported; the RAND steps are.
    missileSeed: { lo: d2Rand(this._questFxSeed, 0x7fffffff), hi: LIGHT_SEED_HI },
  })
  staff.vx = 0
  staff.vy = 0
  staff.traj3d = staffTraj3d()
  staff.altitude = staff.traj3d.z >> TRAJ_FIXED_SHIFT
  if (this.attachServerOverlay(orifice, HORADRIC_ORIFICE_OVERLAY) === undefined) {
    throw new Error('spawnHoradricStaffAtOrifice: Overlay.txt 181 light_jet was not created')
  }
  this.pushSoundRequest({ stingerSoundId: 4690 })
  return staff
}

export function spawnHoradricStaffChildImpl(this: ClientWorldInternal, spawn: HoradricStaffSpawn, staff: ClientUnit): ClientUnit {
  const owner = { ownerType: staff.ownerType, ownerId: staff.ownerId }
  switch (spawn.kind) {
    case 'light': {
      const row = HORADRIC_MISSILE_ROWS.light
      const unit = this.spawnMissileByKey(row.name, spawn.x, spawn.y, spawn.x, spawn.y, {
        classId: row.id,
        ...owner,
        maxTicks: spawn.frames, // #10558 / #10970
        direction: spawn.dir, // #10706
        loopAnim: true,
      })
      unit.vx = 0
      unit.vy = 0
      unit.fixedDirection = true
      return unit
    }
    case 'lightning': {
      const row = HORADRIC_MISSILE_ROWS.lightning
      const unit = this.spawnMissileByKey(row.name, spawn.x, spawn.y, spawn.targetX, spawn.targetY, {
        classId: row.id,
        ...owner,
        maxTicks: row.range,
        direction: spawn.dir,
      })
      unit.direction = spawn.dir // #10706 after create; #10520(path, 0) keeps it
      unit.fixedDirection = true
      unit.traj3d = lightningTraj3d()
      unit.altitude = unit.traj3d.z >> TRAJ_FIXED_SHIFT
      return unit
    }
    case 'dust': {
      const row = HORADRIC_MISSILE_ROWS.dust
      const unit = this.spawnMissileByKey(row.name, spawn.x, spawn.y, spawn.targetX, spawn.targetY, {
        classId: row.id,
        ...owner,
        maxTicks: row.range,
      })
      unit.animSpeed = spawn.animSpeed // #10441(unit, 0x40)
      return unit
    }
  }
}

export function spawnCairnSkyBoltImpl(this: ClientWorldInternal, x: number, y: number, parent: ClientUnit): ClientUnit {
  const row384 = QUEST_FX_MISSILES_113C[384]!
  const descentTicks = Math.max(1, Math.trunc(row384.cltParam1 / Math.max(1, row384.cltParam2)))
  const bolt = this.spawnMissileByKey('cairn stones bolt', x, y, x, y, {
    classId: row384.id,
    ownerType: parent.ownerType,
    ownerId: parent.ownerId,
    maxTicks: descentTicks,
    altitude: row384.cltParam1,
    verticalDescentPerTick: row384.cltParam2,
    loopAnim: true,
    expandSubMissiles: false,
  })
  bolt.vx = 0
  bolt.vy = 0
  return bolt
}

/**
 * 0x6fb03220 (special quest event 14) once the forge is found: song override 0x1251, PlaySound(0x23, forge) and
 * client missile 373 `hfcontrol` at the forge with TargetX = forge id, TargetY = 0.
 */
export function spawnHellforgeShowAtForgeImpl(this: ClientWorldInternal, forge: ClientUnit): ClientUnit {
  if (forge.unitType !== 'object' || forge.classId !== HELLFORGE_OBJECT_CLASS) {
    throw new Error(`spawnHellforgeShowAtForge: unit ${forge.key} is not objects.txt 376 Hellforge`)
  }
  this.pushSoundRequest({ stingerSoundId: HELLFORGE_SONG_SOUND })
  this.pushSoundRequest({ soundId: HELLFORGE_SMASH_SOUND, unit: { unitType: forge.unitType, id: forge.id, x: forge.x, y: forge.y } })
  const x = Math.floor(forge.x)
  const y = Math.floor(forge.y)
  const ctl = this.spawnMissileByKey('hfcontrol', x, y, x, y, {
    classId: HF_CONTROL_MISSILE,
    ownerType: 'player',
    ownerId: this.selfId || 1,
  })
  ctl.vx = 0
  ctl.vy = 0
  ctl.cltCountdown = forge.id
  ctl.cltCountdownY = 0
  return ctl
}

/**
 * 0x6fb02c50 (special quest event 6) once the Tainted Sun altar (`Objects.txt` 149) is found:
 * spawns client missile 350 (`0x15e` `taintedsuncontrol`) at `(altarX, altarY)` with
 * `TargetX = altar.id`, `TargetY = 1` (`0x6fb02cae`).
 */
export function spawnTaintedSunShowAtAltarImpl(this: ClientWorldInternal, altar: ClientUnit): ClientUnit {
  if (altar.unitType !== 'object' || altar.classId !== TAINTED_SUN_ALTAR_OBJECT_CLASS) {
    throw new Error(`spawnTaintedSunShowAtAltar: unit ${altar.key} is not objects.txt 149 taintedsunaltar`)
  }
  const x = Math.floor(altar.x)
  const y = Math.floor(altar.y)
  const ctl = this.spawnMissileByKey('taintedsuncontrol', x, y, x, y, {
    classId: TAINTED_SUN_CONTROL_MISSILE,
    ownerType: 'player',
    ownerId: this.selfId || 1,
  })
  ctl.vx = 0
  ctl.vy = 0
  ctl.cltCountdown = altar.id
  ctl.cltCountdownY = 1
  return ctl
}

/**
 * 0x6fb02b70 (special quest event 16) once Frozen Anya (`Objects.txt` 460 or dynamic 558, #2020) is found:
 * spawns client missile 528 (`0x210` `anya center`) at `(anyaX, anyaY)` with
 * `TargetX = anya.id`, `TargetY = 25` (`0x19`, `0x6fb02bcd`).
 */
export function spawnAnyaRescueShowAtAnyaImpl(this: ClientWorldInternal, anya: ClientUnit): ClientUnit {
  if (
    anya.unitType !== 'object' ||
    (anya.classId !== FROZEN_ANYA_OBJECT_CLASS && anya.classId !== FROZEN_ANYA_INTERACT_OBJECT_CLASS)
  ) {
    throw new Error(`spawnAnyaRescueShowAtAnya: unit ${anya.key} is not objects.txt 460/558 FrozenAnya`)
  }
  const x = Math.floor(anya.x)
  const y = Math.floor(anya.y)
  const ctl = this.spawnMissileByKey('anya center', x, y, x, y, {
    classId: ANYA_CENTER_MISSILE,
    ownerType: 'player',
    ownerId: this.selfId || 1,
  })
  ctl.vx = 0
  ctl.vy = 0
  ctl.cltCountdown = anya.id
  ctl.cltCountdownY = ANYA_INITIAL_TARGET_Y
  return ctl
}
