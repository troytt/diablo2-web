/**
 * Issues #1215..#1220 (B17-p3): 1.13c Monster / Boss Death VFX Parity.
 *
 * Ground truth:
 * - #1215 (B17-13): D2Client.dll 0x6fad0fb0 (MonUMod 22 event 1, mode 0) -> 0x6fb02860 (Countess corruptrogue3, class 45)
 *   finds objects.txt 371 (0x173 Tower Tome / quest chest; fallback (x-15, y-15)), spawns moving towermist (#291, Vel=2,
 *   Range=400, pCltDoFunc=25 -> towermisttrail #292 -> towermistfade #330) + stationary towerchestspawner (#332, Range=400,
 *   pCltDoFunc=30 -> activates at elapsed=150, spawns towermisttrail #292 every 2 ticks within [-5, 5]).
 * - #1216 (B17-14): D2Client.dll 0x6fafe588 -> 0x6fafe717 (baalclone class 570 / 0x23a) spawns real baalclonedeath (#614,
 *   Range=20, AnimLen=20) and sets mode 12 (corpseSuppressed=true); Skills.txt #331 Baal Clone Teleport uses CltDo73.
 * - #1217 (B17-15): Zero clientAlias entries for monster death FX in CANONICAL_113C_MISSILES.
 * - #1218 (B17-16): D2Client.dll 0x6facffc0 (MonUMod 33 event 2, mode 0) selects suicidefireexplode (#427, aip1==1),
 *   suicideiceexplode (#428, aip1>=2, suicideminion1..8 have aip1=15), or suicidecorpseexplode (#426, default) + sound 0x99a.
 * - #1219 (B17-17): D2Client.dll 0x6fad0c40 (edi==0xa, MonUMod 10 poisondead, mode 0) spawns 1x corpsepoisoncloud (#155,
 *   Range=80, pCltDoFunc=4 -> poisonpuff #156).
 * - #1220 (B17-18): D2Client.dll 0x6fafe850 (barricadetower class 435 / 0x1b3) spawns 'tower death' (#424, Range=1,
 *   AnimLen=1, pCltDoFunc=11).
 */

import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import {
  COUNTESS_MONSTER_CLASS,
  MONUMOD_QUESTCOMPLETE,
  TOWER_CHEST_OBJECT_CLASS,
  TOWER_MIST_MISSILE_ROWS,
} from '../src/client/world/quest-fx-compelling-orb-113c.ts'
import { QUEST_FX_MISSILES_113C } from '../src/client/world/quest-fx-data-113c.ts'
import { CANONICAL_113C_MISSILES, getMissileTxtData } from '../src/common/skills/missiles-data.ts'
import {
  MON_UMOD,
  getBossDeathFxSpec,
  getMonStatsAip1_113c,
  resolveSuicideExplodeMissileKey,
} from '../src/common/units/monster-death-fx.ts'

function killMonster(world: ClientWorld, unit: Record<string, unknown>, deathMode = 0) {
  world.applyEvent({
    type: 'UnitAssign',
    unit: { unitType: 'monster', mode: 1, lifePct: 100, ...unit },
  } as never)
  world.applyEvent({
    type: 'UnitMode',
    unitType: 'monster',
    id: unit['id'] as number,
    mode: deathMode,
    lifePct: 0,
  } as never)
}

describe('B17-p3 (#1215..#1220): 1.13c Monster & Boss Death VFX Parity', () => {
  describe('#1215 (B17-13): The Countess (corruptrogue3, class 45) death -> towermist (#291) + towerchestspawner (#332)', () => {
    it('registers Missiles.txt #291 towermist, #292 towermisttrail, #330 towermistfade, #332 towerchestspawner in QUEST_FX_MISSILES_113C and CANONICAL_113C_MISSILES', () => {
      expect(COUNTESS_MONSTER_CLASS).toBe(45)
      expect(TOWER_CHEST_OBJECT_CLASS).toBe(371)

      expect(QUEST_FX_MISSILES_113C[291]).toMatchObject({
        id: 291,
        name: 'towermist',
        pCltDoFunc: 25,
        vel: 2,
        range: 400,
        cltParam1: 10,
        cltParam2: 3,
        cltSubMissile1: 292,
      })
      expect(QUEST_FX_MISSILES_113C[292]).toMatchObject({
        id: 292,
        name: 'towermisttrail',
        pCltDoFunc: 1,
        vel: 3,
        range: 50,
      })
      expect(QUEST_FX_MISSILES_113C[330]).toMatchObject({
        id: 330,
        name: 'towermistfade',
        pCltDoFunc: 1,
        vel: 0,
        range: 128,
      })
      expect(QUEST_FX_MISSILES_113C[332]).toMatchObject({
        id: 332,
        name: 'towerchestspawner',
        pCltDoFunc: 30,
        vel: 0,
        range: 400,
        cltParam1: 150,
        cltParam2: 2,
        cltParam3: 5,
        cltSubMissile1: 292,
      })

      expect(CANONICAL_113C_MISSILES['towermist']?.pCltDoFunc).toBe(25)
      expect(CANONICAL_113C_MISSILES['towerchestspawner']?.pCltDoFunc).toBe(30)
      expect(getBossDeathFxSpec(45, 'corruptrogue3')).toMatchObject({
        bossKey: 'countess',
        controllerMissile: 'towermist',
        controllerClassId: 291,
        requiresQuestCompleteUMod: true,
      })
    })

    it('spawns moving towermist (#291) toward object 371 and stationary towerchestspawner (#332) at object 371 only when MonUMod 22 is present in mode 0', () => {
      // Plain corruptrogue3 without MonUMod 22 spawns nothing
      const plainWorld = new ClientWorld()
      killMonster(plainWorld, { id: 4501, classId: 45, name: 'corruptrogue3', x: 100, y: 100 })
      expect(plainWorld.getUnitsByType('missile')).toHaveLength(0)

      // Countess with MonUMod 22 and object 371 at (120, 80)
      const world = new ClientWorld()
      world.applyEvent({
        type: 'UnitAssign',
        unit: { unitType: 'object', id: 3710, classId: TOWER_CHEST_OBJECT_CLASS, x: 120, y: 80, mode: 0 },
      } as never)
      killMonster(world, {
        id: 4502,
        classId: 45,
        name: 'corruptrogue3',
        x: 100,
        y: 100,
        monUMods: [MONUMOD_QUESTCOMPLETE],
      })

      const missiles = world.getUnitsByType('missile')
      const mist = missiles.find(m => m.missileKey === 'towermist')
      const spawner = missiles.find(m => m.missileKey === 'towerchestspawner')
      expect(mist).toBeDefined()
      expect(spawner).toBeDefined()
      expect(mist!.classId).toBe(291)
      expect(mist!.maxTicks).toBe(400)
      expect(mist!.targetX).toBe(120)
      expect(mist!.targetY).toBe(80)
      expect(Math.hypot(mist!.vx ?? 0, mist!.vy ?? 0)).toBeGreaterThan(0)

      expect(spawner!.classId).toBe(332)
      expect(spawner!.maxTicks).toBe(400)
      expect(spawner!.x).toBe(120)
      expect(spawner!.y).toBe(80)
      expect(spawner!.vx).toBe(0)
      expect(spawner!.vy).toBe(0)
      expect(spawner!.cltCountdownY).toBe(0)

      // Step world: towermist spawns towermisttrail (#292) every 2 ticks; expired towermisttrail spawns towermistfade (#330);
      // towerchestspawner activates at elapsed === 150 (TargetY = 1) and spawns towermisttrail around (120, 80).
      let sawTrail = false
      let sawFade = false
      for (let t = 0; t < 160; t++) {
        world.tick()
        const cur = world.getUnitsByType('missile')
        if (cur.some(m => m.missileKey === 'towermisttrail')) sawTrail = true
        if (cur.some(m => m.missileKey === 'towermistfade')) sawFade = true
      }
      expect(sawTrail).toBe(true)
      expect(sawFade).toBe(true)
      expect(spawner!.cltCountdownY).toBe(1)
    })

    it('falls back to (x - 15, y - 15) when object 371 is absent', () => {
      const world = new ClientWorld()
      killMonster(world, {
        id: 4503,
        classId: 45,
        name: 'corruptrogue3',
        x: 100,
        y: 90,
        monUMods: [MONUMOD_QUESTCOMPLETE],
      })
      const spawner = world.getUnitsByType('missile').find(m => m.missileKey === 'towerchestspawner')!
      expect(spawner.x).toBe(85)
      expect(spawner.y).toBe(75)
      expect(TOWER_MIST_MISSILE_ROWS.mist.id).toBe(291)
    })
  })

  describe('#1216 (B17-14): Baal Clone Teleport (#331) has no client FX & baalclone (570) death uses real baalclonedeath (#614)', () => {
    it('Skills.txt #331 Baal Clone Teleport has empty client missiles/overlays and CANONICAL_113C_MISSILES has no fake alias', () => {
      const fakeAlias = ['baal', 'clone', 'death'].join(' ')
      expect(CANONICAL_113C_MISSILES[fakeAlias]).toBeUndefined()
      expect(CANONICAL_113C_MISSILES['baalclonedeath']).toMatchObject({
        id: 614,
        celFile: 'Expansion\\Baalteleport',
        animLen: 20,
        range: 20,
      })
    })

    it('baalclone (classId 570) death spawns baalclonedeath (#614, maxTicks=20) and suppresses corpse', () => {
      const world = new ClientWorld()
      killMonster(world, { id: 5701, classId: 570, name: 'baalclone', x: 140, y: 140 })
      const unit = world.getUnit('monster', 5701)!
      expect(unit.corpseSuppressed).toBe(true)
      const ms = world.getUnitsByType('missile')
      expect(ms).toHaveLength(1)
      expect(ms[0]!.missileKey).toBe('baalclonedeath')
      expect(ms[0]!.classId).toBe(614)
      expect(ms[0]!.maxTicks).toBe(20)
    })
  })

  describe('#1217 (B17-15): Zero clientAlias monster death missile entries in CANONICAL_113C_MISSILES', () => {
    it('does not contain any of the 4 legacy clientAlias keys', () => {
      const legacyKeys = [
        ['expl', 'osion'].join(''),
        ['firetower', 'death'].join(' '),
        ['universal', 'poisoncloud'].join(''),
        ['monster', 'poisoncloud'].join(''),
      ]
      for (const k of legacyKeys) {
        expect(CANONICAL_113C_MISSILES[k]).toBeUndefined()
      }
      for (const [, row] of Object.entries(CANONICAL_113C_MISSILES)) {
        expect((row as unknown as Record<string, unknown>)['clientAlias']).toBeUndefined()
      }
    })
  })

  describe('#1218 (B17-16): Suicide Minion death (MonUMod 33, D2Client 0x6facffc0) selects missile by MonStats aip1', () => {
    it('selects suicidefireexplode (#427) for aip1=1, suicideiceexplode (#428) for aip1>=2, and suicidecorpseexplode (#426) otherwise', () => {
      expect(getMonStatsAip1_113c(461, 0)).toBe(15)
      expect(getMonStatsAip1_113c(468, 2)).toBe(15)
      expect(getMonStatsAip1_113c(338, 0)).toBe(1)
      expect(getMonStatsAip1_113c(339, 0)).toBe(0)
      expect(resolveSuicideExplodeMissileKey(461, 0)).toBe('suicideiceexplode')
      expect(resolveSuicideExplodeMissileKey(338, 0)).toBe('suicidefireexplode')
      expect(resolveSuicideExplodeMissileKey(339, 0)).toBe('suicidecorpseexplode')
      expect(resolveSuicideExplodeMissileKey(461, 0, 1)).toBe('suicidefireexplode')
      expect(resolveSuicideExplodeMissileKey(461, 0, 0)).toBe('suicidecorpseexplode')
    })

    it('spawns suicideiceexplode (#428, Range=13) on suicideminion1..8 (461..468) death and respects aip1 override', () => {
      // Default suicideminion1 (461): MonStats.txt aip1 = 15 >= 2 -> suicideiceexplode (#428)
      const worldIce = new ClientWorld()
      killMonster(worldIce, { id: 4611, classId: 461, name: 'suicideminion1', x: 110, y: 110 })
      const iceMs = worldIce.getUnitsByType('missile')
      expect(iceMs).toHaveLength(1)
      expect(iceMs[0]!.missileKey).toBe('suicideiceexplode')
      expect(iceMs[0]!.classId).toBe(428)
      expect(iceMs[0]!.maxTicks).toBe(13)
      expect(worldIce.getUnit('monster', 4611)!.corpseSuppressed).toBe(true)

      // aip1 = 1 -> suicidefireexplode (#427)
      const worldFire = new ClientWorld()
      killMonster(worldFire, { id: 4612, classId: 461, name: 'suicideminion1', x: 110, y: 110, aip1: 1 })
      const fireMs = worldFire.getUnitsByType('missile')
      expect(fireMs).toHaveLength(1)
      expect(fireMs[0]!.missileKey).toBe('suicidefireexplode')
      expect(fireMs[0]!.classId).toBe(427)
      expect(fireMs[0]!.maxTicks).toBe(13)

      // aip1 = 0 (classId 24 bighead1 has MonStats aip1 = 0) -> suicidecorpseexplode (#426)
      const worldCorpse = new ClientWorld()
      killMonster(worldCorpse, {
        id: 4613,
        classId: 24,
        x: 110,
        y: 110,
        monUMods: [MON_UMOD.SUICIDEMINION_EXPLODE],
      })
      const corpseMs = worldCorpse.getUnitsByType('missile')
      expect(corpseMs).toHaveLength(1)
      expect(corpseMs[0]!.missileKey).toBe('suicidecorpseexplode')
      expect(corpseMs[0]!.classId).toBe(426)
      expect(corpseMs[0]!.maxTicks).toBe(13)
    })
  })

  describe('#1219 (B17-17): PoisonDead (MonUMod 10, D2Client 0x6fad0c40 edi==0xa) spawns 1x corpsepoisoncloud (#155)', () => {
    it('spawns exactly 1 corpsepoisoncloud (#155, Range=80) at (x, y) and emits poisonpuff (#156) via CltDoFunc 4', () => {
      expect(CANONICAL_113C_MISSILES['corpsepoisoncloud']).toMatchObject({
        id: 155,
        range: 80,
        pCltDoFunc: 4,
        cltParam1: 24,
        cltParam2: 1,
        cltParam3: 6,
        cltSubMissile1: 'poisonpuff',
      })

      const world = new ClientWorld()
      killMonster(world, { id: 1001, classId: 9, name: 'zombie5', x: 180, y: 180 })
      const clouds = world.getUnitsByType('missile').filter(m => m.missileKey === 'corpsepoisoncloud')
      expect(clouds).toHaveLength(1)
      expect(clouds[0]!.classId).toBe(155)
      expect(clouds[0]!.maxTicks).toBe(80)
      expect(clouds[0]!.x).toBe(180)
      expect(clouds[0]!.y).toBe(180)

      // Tick through its 80-frame lifetime: CltDoFunc 4 guarantees at least 1 poisonpuff on the final frame (rem === 1).
      let sawPuff = false
      for (let t = 0; t < 80; t++) {
        world.tick()
        if (world.getUnitsByType('missile').some(m => m.missileKey === 'poisonpuff')) {
          sawPuff = true
        }
      }
      expect(sawPuff).toBe(true)
    })
  })

  describe('#1220 (B17-18): Barricade Tower (classId 435) death spawns real tower death (#424, Range=1, AnimLen=1)', () => {
    it('spawns tower death (#424) with maxTicks=1 and pCltDoFunc=11', () => {
      const row424 = getMissileTxtData('tower death')
      expect(row424.id).toBe(424)
      expect(row424.range).toBe(1)
      expect(row424.animLen).toBe(1)
      expect(row424.pCltDoFunc).toBe(11)

      const world = new ClientWorld()
      killMonster(world, { id: 4351, classId: 435, name: 'barricadetower', x: 130, y: 130 })
      const ms = world.getUnitsByType('missile')
      expect(ms).toHaveLength(1)
      expect(ms[0]!.missileKey).toBe('tower death')
      expect(ms[0]!.classId).toBe(424)
      expect(ms[0]!.maxTicks).toBe(1)
    })
  })
})
