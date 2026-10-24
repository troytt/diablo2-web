import { describe, expect, it } from 'vitest'
import {
  DURIEL_MAGGOT_HCIDX,
  DURIEL_MAGGOT_OFFSETS,
  ISO_GROUND_ASPECT_RATIO,
  MON_UMOD,
  calcBoneFetishDeathDamage,
  calcColdEnchantedDeathNova,
  calcFireEnchantedDeathDamage,
  computeChargedBolt8WayVectors,
  computeIsoRadialRingVectors,
  getBossDeathFxSpec,
  getFreezeShatterMissiles,
  getInnateMonsterDeathOverlays,
  hasMonsterUMod,
  isBoneFetishMonster,
  isDurielMonster,
  isMaggotSmallMonster,
  isPoisonDeadMonster,
  isScarabMonster,
  isSuicideMinionMonster,
  resolveMonsterUModIds,
} from '../../src/common/units/monster-death-fx.ts'
import { ACT_MONSTER_SPECS, MONSTER_ART_MAP } from '../../src/common/units/monster-mapping.ts'
import { CANONICAL_113C_MISSILES } from '../../src/common/skills/missiles-data.ts'
import { MISSILE_METAS } from '../../src/client/render/missiles-meta.ts'
import {
  AUTHENTIC_113C_OVERLAYS as AUTHENTIC_OVERLAY_TXT,
  OVERLAY_METAS,
} from '../../src/client/render/overlays-meta.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { buildSceneDrawables as buildUnitDrawables } from '../../src/client/view/unit-drawables.ts'
import { createWorld, damageMonster } from '../../src/server/ai/monster-ai.ts'

describe('Issue #872: Authentic 1.13c Monster Affix & Boss Death FX System', () => {
  describe('1. Asset Pipeline: Authentic MPQ Missiles, Overlays & Maggot (MA) Registration', () => {
    it('registers all newly baked death FX missiles in MISSILE_METAS and CANONICAL_113C_MISSILES', () => {
      const requiredMissiles = [
        'frostnova',
        'lightunique',
        'buglightning',
        'corpsepoisoncloud',
        'icebreaksmall',
        'icebreaklarge',
        'icebreaksmoke',
        'andycolumnfirebase',
        'andyfirewall',
        'andycolumnfire',
        'andyfallingdebris1',
        'durieldeathrock',
        'durieldeathdebris',
        'durieldeathsmoke',
        'radamenthandofgod',
        'radamentholybolt',
        'horadriclight',
        'taintedsunflash',
        'taintedsunball',
        'queenpoisoncloud',
        // mephistodeathcontrol (#299) has CelFile null: no art entry (Issue #1208 removed its alias).
        'mephistofirewall',
        'mephistoflyingrocksbig',
        'mephistoflyingrockssmall',
        'izual mist loop',
        'izual lightning',
        'firemedium',
        'towermisttrail',
        'towermistfade',
        'healing vortex',
        'ancient death cloud',
        'nihlithak1',
        'nihlithak2',
        'nihlithak3',
        'nehlithakswoosh',
        'nehlithakdebris1',
        'nehlithakdebris2',
        'nehlithakdebris3',
        'nehlithakdebris4',
        'nehlithakglow2',
        'baalteleport',
        'baalclonedeath',
        'baalfx spirit 1',
        'baalfx spirit 2',
        'baalfx baal head appear',
        'baalfx baal head 1',
        'baalfx baal head 2',
        'baalfx baal head 3',
      ]
      for (const token of requiredMissiles) {
        expect(
          MISSILE_METAS[token] ?? MISSILE_METAS[token.toLowerCase()],
          `Missing MISSILE_METAS for ${token}`,
        ).toBeDefined()
        expect(
          CANONICAL_113C_MISSILES[token] ?? CANONICAL_113C_MISSILES[token.toLowerCase()],
          `Missing CANONICAL_113C_MISSILES for ${token}`,
        ).toBeDefined()
      }
    })

    it('registers all 18 newly baked death overlays in OVERLAY_METAS and AUTHENTIC_OVERLAY_TXT', () => {
      const requiredOverlays = [
        'fire_explode',
        'durieldead_fwd',
        'durieldead_rear',
        'zakarumpriest_death',
        'thornedhulk_death',
        'frogdemon_death',
        'fingermagespiderexplode',
        'willowispdeath',
        'megademondeath',
        'undeadhorrordeath',
        'fetishdeath1',
        'fetishdeath2',
        'siege_beast_dust',
        'spawnedminion',
        'suicide_death',
        'catapult_death_s',
        'catapult_death_e',
        'succubae_death',
      ]
      for (const token of requiredOverlays) {
        expect(OVERLAY_METAS[token], `Missing OVERLAY_METAS for ${token}`).toBeDefined()
        expect(AUTHENTIC_OVERLAY_TXT[token], `Missing AUTHENTIC_OVERLAY_TXT for ${token}`).toBeDefined()
      }
    })

    it('registers Duriel small maggot (MA / hcIdx=227) in Act 2 monster specs', () => {
      expect(DURIEL_MAGGOT_HCIDX).toBe(227)
      expect(ACT_MONSTER_SPECS[2]?.some(s => s.token === 'MA' && s.weapon === 'hth')).toBe(true)
      const spec = MONSTER_ART_MAP['maggot']!
      expect(spec).toBeDefined()
      expect(spec.token).toBe('MA')
      expect(spec.weapon).toBe('hth')
    })
  })

  describe('2. Fire Enchanted (MonUMod #9) & Bone Fetish (MonUMod #31) Death Damage & Minion Guard', () => {
    it('calculates Fire Enchanted 1.13c death explosion damage (50% Phys + 50% Fire) with difficulty scaling and blocks minions', () => {
      const norm = calcFireEnchantedDeathDamage(1000, 'normal', false)
      expect(norm.radiusSubTiles).toBe(4)
      expect(norm.minPhys).toBeGreaterThan(0)
      expect(norm.maxPhys).toBeGreaterThan(norm.minPhys)
      expect(norm.minFire).toBe(norm.minPhys)
      expect(norm.maxFire).toBe(norm.maxPhys)

      const nm = calcFireEnchantedDeathDamage(1000, 'nightmare', false)
      const hell = calcFireEnchantedDeathDamage(1000, 'hell', false)
      // Nightmare (35% base) > Hell/Normal (20% base) at identical HP per 1.13c MonUMod.txt
      expect(nm.maxPhys).toBeGreaterThan(hell.maxPhys)
      expect(hell.maxPhys).toBe(norm.maxPhys)

      const minionDmg = calcFireEnchantedDeathDamage(1000, 'hell', true)
      expect(minionDmg.minPhys).toBe(0)
      expect(minionDmg.maxPhys).toBe(0)
      expect(minionDmg.minFire).toBe(0)
      expect(minionDmg.maxFire).toBe(0)
    })

    it('spawns monstercorpseexplode + fireexplosion (no fire_explode overlay, D2Client 0x6fad0d20) on Fire Enchanted boss death and suppresses it on minions', () => {
      const world = new ClientWorld()
      world.applyEvent({
        type: 'UnitAssign',
        unit: {
          unitType: 'monster',
          id: 5001,
          classId: 1,
          x: 100,
          y: 100,
          mode: 1,
          lifePct: 100,
          isMinion: false,
          monUMods: [MON_UMOD.FIRE_ENCHANTED],
        },
      })
      world.applyEvent({
        type: 'UnitMode',
        unitType: 'monster',
        id: 5001,
        mode: 0,
        lifePct: 0,
      })
      const bossUnit = world.getUnit('monster', 5001)!
      expect(bossUnit.overlays.some(ov => ov.token === 'fire_explode')).toBe(false)
      expect(world.getUnitsByType('missile').filter(m => m.ownerId === 5001 && m.missileKey === 'fireexplosion').length).toBe(5)

      // Minion with inherited Fire Enchanted must NOT trigger the death explosion
      world.applyEvent({
        type: 'UnitAssign',
        unit: {
          unitType: 'monster',
          id: 5002,
          classId: 1,
          x: 104,
          y: 104,
          mode: 1,
          lifePct: 100,
          isMinion: true,
          monUMods: [MON_UMOD.FIRE_ENCHANTED],
        },
      })
      world.applyEvent({
        type: 'UnitMode',
        unitType: 'monster',
        id: 5002,
        mode: 0,
        lifePct: 0,
      })
      expect(world.getUnitsByType('missile').some(m => m.ownerId === 5002)).toBe(false)
    })

    it('calculates Bone Fetish (goboom #31) 100% physical splash damage and suppresses corpse + attaches fetishdeath1/2 overlays', () => {
      const bfDmg = calcBoneFetishDeathDamage(800, 'hell', false)
      expect(bfDmg.minPhys).toBeGreaterThan(0)
      expect(bfDmg.maxPhys).toBeGreaterThan(bfDmg.minPhys)
      expect(bfDmg.minFire).toBe(0)
      expect(bfDmg.maxFire).toBe(0)

      const bfMinionDmg = calcBoneFetishDeathDamage(800, 'hell', true)
      expect(bfMinionDmg.maxPhys).toBe(0)

      const world = new ClientWorld()
      // classId 212 = bonefetish1
      world.applyEvent({
        type: 'UnitAssign',
        unit: {
          unitType: 'monster',
          id: 5010,
          classId: 212,
          x: 120,
          y: 120,
          mode: 1,
          lifePct: 100,
        },
      })
      world.applyEvent({
        type: 'UnitMode',
        unitType: 'monster',
        id: 5010,
        mode: 0,
        lifePct: 0,
      })
      const bfUnit = world.getUnit('monster', 5010)!
      expect(bfUnit.corpseSuppressed).toBe(true)
      const ovTokens = bfUnit.overlays.map(o => o.token)
      expect(ovTokens).toContain('fetishdeath1')
      expect(ovTokens).toContain('fetishdeath2')
    })
  })

  describe('3. Cold Enchanted (MonUMod #18) coldunique 64-ring & Isometric 2:1 Projection', () => {
    it('computes Cold Enchanted nova sLvl = max(1, floor(mlvl/2)) and isometric radial vectors', () => {
      expect(ISO_GROUND_ASPECT_RATIO).toBe(0.5)
      const nova = calcColdEnchantedDeathNova(24, 'nightmare', false)
      expect(nova.triggered).toBe(true)
      expect(nova.sLvl).toBe(12)
      expect(nova.directions).toBe(64)
      expect(nova.chillFrames).toBeGreaterThan(0)

      const minionNova = calcColdEnchantedDeathNova(24, 'nightmare', true)
      expect(minionNova.triggered).toBe(false)

      const ring = computeIsoRadialRingVectors(32, 16)
      expect(ring).toHaveLength(32)
      // At index 0 (dx=16, dy=0), isoScreenDx = 256, isoScreenDy = 128 (ratio 0.5)
      const zero = ring[0]!
      expect(zero.isoScreenDy / zero.isoScreenDx).toBeCloseTo(ISO_GROUND_ASPECT_RATIO, 4)
    })

    it('spawns 64 coldunique missiles on Cold Enchanted boss death and 0 on minions', () => {
      const world = new ClientWorld()
      world.applyEvent({
        type: 'UnitAssign',
        unit: {
          unitType: 'monster',
          id: 5020,
          classId: 10,
          x: 200,
          y: 200,
          mode: 1,
          lifePct: 100,
          isMinion: false,
          monUMods: [MON_UMOD.COLD_ENCHANTED],
        },
      })
      world.applyEvent({
        type: 'UnitMode',
        unitType: 'monster',
        id: 5020,
        mode: 0,
        lifePct: 0,
      })
      const frostNovas = world.getUnitsByType('missile').filter(m => m.missileKey === 'coldunique')
      expect(frostNovas.length).toBe(64)

      const worldMinion = new ClientWorld()
      worldMinion.applyEvent({
        type: 'UnitAssign',
        unit: {
          unitType: 'monster',
          id: 5021,
          classId: 10,
          x: 200,
          y: 200,
          mode: 1,
          lifePct: 100,
          isMinion: true,
          monUMods: [MON_UMOD.COLD_ENCHANTED],
        },
      })
      worldMinion.applyEvent({
        type: 'UnitMode',
        unitType: 'monster',
        id: 5021,
        mode: 0,
        lifePct: 0,
      })
      expect(worldMinion.getUnitsByType('missile').filter(m => m.missileKey === 'coldunique').length).toBe(0)
    })
  })

  describe('4. Lightning Enchanted (#17), Scarab (#20) Charged Bolts & PoisonDead (#10)', () => {
    it('emits 8-way Charged Bolts (lightunique / buglightning) on MONMODE_GETHIT (mode=3) and death', () => {
      const vectors = computeChargedBolt8WayVectors(12)
      expect(vectors).toHaveLength(8)

      const world = new ClientWorld()
      // Lightning Enchanted GetHit (mode=3)
      world.applyEvent({
        type: 'UnitAssign',
        unit: {
          unitType: 'monster',
          id: 5030,
          classId: 15,
          x: 150,
          y: 150,
          mode: 1,
          lifePct: 100,
          monUMods: [MON_UMOD.LIGHTNING_ENCHANTED],
        },
      })
      world.applyEvent({
        type: 'UnitMode',
        unitType: 'monster',
        id: 5030,
        mode: 3,
        lifePct: 80,
      })
      const leBoltsOnHit = world.getUnitsByType('missile').filter(m => m.missileKey === 'lightunique')
      expect(leBoltsOnHit.length).toBe(8)

      // Scarab (classId 91 = scarab1) GetHit (mode=3) -> buglightning
      world.applyEvent({
        type: 'UnitAssign',
        unit: {
          unitType: 'monster',
          id: 5031,
          classId: 91,
          x: 160,
          y: 160,
          mode: 1,
          lifePct: 100,
        },
      })
      world.applyEvent({
        type: 'UnitMode',
        unitType: 'monster',
        id: 5031,
        mode: 3,
        lifePct: 75,
      })
      const scarabBolts = world.getUnitsByType('missile').filter(m => m.missileKey === 'buglightning')
      expect(scarabBolts.length).toBe(8)
    })

    it('spawns corpsepoisoncloud on PoisonDead monster death (zombie5 / mummy / MonUMod #10)', () => {
      expect(isPoisonDeadMonster(9, 'zombie5')).toBe(true)
      expect(isPoisonDeadMonster(96, 'mummy2')).toBe(true)

      const world = new ClientWorld()
      world.applyEvent({
        type: 'UnitAssign',
        unit: {
          unitType: 'monster',
          id: 5040,
          classId: 9, // zombie5 (Plague Bearer)
          x: 180,
          y: 180,
          mode: 1,
          lifePct: 100,
        },
      })
      world.applyEvent({
        type: 'UnitMode',
        unitType: 'monster',
        id: 5040,
        mode: 0,
        lifePct: 0,
      })
      const clouds = world.getUnitsByType('missile').filter(m => m.missileKey === 'corpsepoisoncloud')
      expect(clouds).toHaveLength(1)
    })
  })

  describe('5. Freeze Shatter (STATE_FREEZE #1) & Corpse Suppression', () => {
    it('spawns icebreaksmall/large + icebreaksmoke and suppresses DD corpse drawable and Redemption consumption', () => {
      const shatterSmall = getFreezeShatterMissiles(1)
      expect(shatterSmall).toContain('icebreaksmall')
      expect(shatterSmall).toContain('icebreaksmoke')

      const world = new ClientWorld()
      world.applyEvent({
        type: 'UnitAssign',
        unit: {
          unitType: 'monster',
          id: 5050,
          classId: 1,
          x: 100,
          y: 100,
          mode: 1,
          lifePct: 50,
          states: [1], // STATE_FREEZE
        },
      })
      world.applyEvent({
        type: 'UnitMode',
        unitType: 'monster',
        id: 5050,
        mode: 12,
        lifePct: 0,
      })
      const shatteredUnit = world.getUnit('monster', 5050)!
      expect(shatteredUnit.corpseSuppressed).toBe(true)
      const missiles = world.getUnitsByType('missile')
      expect(
        missiles.some(m => m.missileKey === 'icebreaksmall' || m.missileKey === 'icebreaklarge'),
      ).toBe(true)
      expect(missiles.some(m => m.missileKey === 'icebreaksmoke')).toBe(true)

      // buildUnitDrawables must skip corpse (mode 12) when corpseSuppressed === true
      const { unitDrawables } = buildUnitDrawables([shatteredUnit])
      expect(unitDrawables.some(d => d.id === 5050)).toBe(false)

      // Server combat & Redemption check: frozen monster death sets corpseSuppressed = true
      const serverWorld = createWorld(0, 0, 100, 50)
      serverWorld.monsters.push({
        index: 0,
        stats: {
          id: 'fallen1',
          name: 'Fallen',
          hp: 20,
          damage: 2,
          cooldownTicks: 20,
          reach: 30,
          aggroRadius: 200,
          speed: 100,
          xp: 10,
        },
        x: 10,
        y: 10,
        hp: 10,
        cooldown: 0,
        state: 'idle',
        facing: 0,
        hitFlash: 0,
        corpseTicks: 0,
        frozenTicks: 50,
      })
      damageMonster(serverWorld, 0, 25)
      expect(serverWorld.monsters[0]!.state).toBe('dead')
      expect(serverWorld.monsters[0]!.corpseSuppressed).toBe(true)
    })
  })

  describe('6. Andariel (classId=156) Death Sequence: Fire Pillar, Screen Shake & Area Purge', () => {
    it('spawns andycontrol0 (#307), purges nearby monsters within 35 sub-tiles, activates screen shake, and spawns fire pillars & debris', () => {
      const world = new ClientWorld()
      // Spawn nearby minion within 35 sub-tiles and far monster outside 35 sub-tiles
      world.applyEvent({
        type: 'UnitAssign',
        unit: {
          unitType: 'monster',
          id: 6001,
          classId: 1,
          x: 110,
          y: 110,
          mode: 1,
          lifePct: 100,
        },
      })
      world.applyEvent({
        type: 'UnitAssign',
        unit: {
          unitType: 'monster',
          id: 6002,
          classId: 1,
          x: 200,
          y: 200,
          mode: 1,
          lifePct: 100,
        },
      })
      // Andariel spawns and dies at (100, 100)
      world.applyEvent({
        type: 'UnitAssign',
        unit: {
          unitType: 'monster',
          id: 6000,
          classId: 156,
          x: 100,
          y: 100,
          mode: 1,
          lifePct: 100,
        },
      })
      world.applyEvent({
        type: 'UnitMode',
        unitType: 'monster',
        id: 6000,
        mode: 0,
        lifePct: 0,
      })

      // Controller missile andycontrol0 is spawned
      expect(world.getUnitsByType('missile').some(m => m.missileKey === 'andycontrol0')).toBe(true)

      // Advance 65 ticks and verify screen shake, sub-missiles, and surrounding monster purge
      let sawNonZeroShake = false
      let sawFireBase = false
      let sawFirewallMaker = false
      let sawDebris = false
      for (let i = 0; i < 65; i++) {
        world.tick()
        const shake = world.screenShake
        if (shake.active && (shake.offsetX !== 0 || shake.offsetY !== 0)) {
          sawNonZeroShake = true
        }
        const activeMissiles = world.getUnitsByType('missile')
        if (activeMissiles.some(m => m.missileKey === 'andycolumnfirebase')) sawFireBase = true
        if (activeMissiles.some(m => m.missileKey === 'andyfirewallmaker')) sawFirewallMaker = true
        if (activeMissiles.some(m => m.missileKey?.startsWith('andyfallingdebris'))) sawDebris = true
      }

      // Nearby monster (dist ~14.14 <= 35) is purged; far monster (dist ~141.4 > 35) stays alive
      const nearMon = world.getUnit('monster', 6001)!
      const farMon = world.getUnit('monster', 6002)!
      expect(nearMon.dead).toBe(true)
      expect(farMon.dead).toBe(false)

      expect(sawNonZeroShake).toBe(true)
      expect(sawFireBase).toBe(true)
      expect(sawFirewallMaker).toBe(true)
      expect(sawDebris).toBe(true)
    })
  })

  describe('7. Duriel (classId=211) Death Sequence: Overlays, 5 Maggots & Walkover Stomp', () => {
    it('attaches durieldead_fwd/rear overlays, spawns 5 maggots (hcIdx=227), and stomps maggots when player walks within 1.5 sub-tiles', () => {
      const world = new ClientWorld()
      world.applyEvent({
        type: 'UnitAssign',
        isSelf: true,
        unit: {
          unitType: 'player',
          id: 1,
          classId: 0,
          x: 50,
          y: 50,
          mode: 1,
          lifePct: 100,
        },
      })

      // Duriel spawns and dies at (100, 100)
      world.applyEvent({
        type: 'UnitAssign',
        unit: {
          unitType: 'monster',
          id: 7000,
          classId: 211,
          x: 100,
          y: 100,
          mode: 1,
          lifePct: 100,
        },
      })
      world.applyEvent({
        type: 'UnitMode',
        unitType: 'monster',
        id: 7000,
        mode: 0,
        lifePct: 0,
      })

      const duriel = world.getUnit('monster', 7000)!
      const ovTokens = duriel.overlays.map(o => o.token)
      expect(ovTokens).toContain('durieldead_fwd')
      expect(ovTokens).toContain('durieldead_rear')

      // 5 maggots spawned around (100, 100)
      const maggots = world
        .getUnitsByType('monster')
        .filter(u => u.classId === DURIEL_MAGGOT_HCIDX)
      expect(maggots.length).toBe(DURIEL_MAGGOT_OFFSETS.length)
      expect(maggots.every(m => !m.dead)).toBe(true)

      // Move self player onto the first maggot's coordinates and tick
      const firstMaggot = maggots[0]!
      world.applyEvent({
        type: 'UnitAssign',
        isSelf: true,
        unit: {
          unitType: 'player',
          id: 1,
          classId: 0,
          x: firstMaggot.x,
          y: firstMaggot.y,
          mode: 2,
          lifePct: 100,
        },
      })
      world.tick()

      expect(firstMaggot.dead).toBe(true)
      expect(firstMaggot.mode).toBe(12)
    })
  })

  describe('8. Act/Quest Boss Death Specs & Temporary Summon tempsummon (#21)', () => {
    it('resolves all Act Boss and Quest Boss death FX specs per 1.13c D2Client/D2Game', () => {
      expect(getBossDeathFxSpec(156, 'andariel')?.controllerMissile).toBe('andycontrol0')
      expect(getBossDeathFxSpec(211, 'duriel')?.controllerMissile).toBe('durieldeathcontrol')
      expect(getBossDeathFxSpec(267, 'bloodraven')?.controllerMissile).toBe('brdeathcontrol')
      expect(getBossDeathFxSpec(229, 'radament')?.controllerMissile).toBe('radamentdeath')
      expect(getBossDeathFxSpec(284, 'coldworm')?.controllerMissile).toBe('queendeathcenter')
      // 1.13c 0x6fad0fb0 has no Summoner (250) case (#1206).
      expect(getBossDeathFxSpec(250, 'summoner')).toBeNull()
      expect(getBossDeathFxSpec(242, 'mephisto')?.controllerMissile).toBe('mephistodeathcontrol')
      expect(getBossDeathFxSpec(256, 'izual')?.controllerMissile).toBe('izual control')
      // 1.13c Diablo handler 0x6fb02600 creates no missile (#1205).
      expect(getBossDeathFxSpec(243, 'diablo')?.controllerMissile).toBeNull()
      expect(getBossDeathFxSpec(479, 'shenk')?.controllerMissile).toBe('overseercontrol')
      expect(getBossDeathFxSpec(526, 'nihlathak')?.controllerMissile).toBe('nehlithakcontrol')
      expect(getBossDeathFxSpec(540, 'ancientbarb1')?.controllerMissile).toBe('ancient death center')
      expect(getBossDeathFxSpec(544, 'baalcrab')?.controllerMissile).toBe('baalfx control')
    })

    it('expires temporary summons with tempsummon (MonUMod #21) and attaches spawnedminion (#202) overlay', () => {
      const world = new ClientWorld()
      world.applyEvent({
        type: 'UnitAssign',
        unit: {
          unitType: 'monster',
          id: 8001,
          classId: 58,
          x: 120,
          y: 120,
          mode: 1,
          lifePct: 100,
          monUMods: [MON_UMOD.TEMPSUMMON],
        },
      })
      const summon = world.getUnit('monster', 8001)!
      expect(summon.tempSummonExpireTick).toBeDefined()
      // Force expiration on next tick
      summon.tempSummonExpireTick = world.frameCount + 1
      world.tick()
      expect(summon.dead).toBe(true)
      expect(summon.overlays.some(o => o.token === 'spawnedminion')).toBe(true)
    })
  })
})
