import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../src/baker/mpq-archive-source.ts'
import { OVERLAY_TXT_ROWS } from '../src/common/data/overlay-txt-rows.ts'
import {
  SKILL_OVERLAY_ROWS_113C,
  STATE_OVERLAY_ROWS_113C,
} from '../src/common/skills/skill-state-overlays-113c.ts'
import {
  CANONICAL_113C_OVERLAYS,
  SORCERESS_SKILL_CAST_OVERLAYS,
  getOverlayTxtData,
  getSkillCastOverlay,
  getSkillOverlayRow113c,
} from '../src/common/skills/missiles-data.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { buildSceneDrawables } from '../src/client/view/unit-drawables.ts'
import {
  isStateCastOverlayPlaying113c,
  stateCastOverlay113c,
} from '../src/client/world/state-cast-overlay-113c.ts'
import { UnitStatList } from '../src/server/engine/stat-list.ts'
import { StateBus } from '../src/server/engine/state-bus.ts'

describe('[B5-p1] Spell VFX Parity: States.txt castoverlay, Skills.txt castoverlay/prgoverlay, and Overlay.txt 293-row parity (#1063-#1068)', () => {
  it('#1063: StateSet plays States.txt castoverlay on inactive->active transition, holds back persistent state overlays while castoverlay plays, and cleans up on StateEnd', async () => {
    const registry = await getSharedDataRegistry()

    // 1. Verify States.txt castoverlay table matches all 185 States.txt rows (0..184)
    expect(STATE_OVERLAY_ROWS_113C).toHaveLength(185)
    expect(stateCastOverlay113c({ states: new Set([16]) }, 16)).toBe('enchant')
    expect(stateCastOverlay113c({ states: new Set([26]) }, 26)).toBe('shoutstart')
    expect(stateCastOverlay113c({ states: new Set([32]) }, 32)).toBe('battleorderscast')
    expect(stateCastOverlay113c({ states: new Set([38]) }, 38)).toBe('thunderstormcast')
    expect(stateCastOverlay113c({ states: new Set([51]) }, 51)).toBe('battlecommandcast')
    expect(stateCastOverlay113c({ states: new Set([93]) }, 93)).toBe('valkyriestart')
    for (const curseState of [9, 19, 23, 55, 56, 57, 58, 59, 60, 61]) {
      expect(stateCastOverlay113c({ states: new Set([curseState]) }, curseState)).toBe('curse_hit')
    }

    // 2. StateBus.getActiveOverlays() excludes one-shot castoverlay
    const stats = new UnitStatList()
    const bus = new StateBus(stats, registry)
    bus.applyState({ stateNameOrId: 38, slvl: 5, durationFrames: 1000 }) // thunderstorm
    expect(bus.getActiveOverlays()).toContain('thunderstormback')
    expect(bus.getActiveOverlays()).not.toContain('thunderstormcast')
    bus.applyState({ stateNameOrId: 16, slvl: 5, durationFrames: 1000 }) // enchant
    expect(bus.getActiveOverlays()).not.toContain('enchant')

    // 3. ClientWorld StateSet (inactive -> active) attaches castoverlay; active -> active refresh does NOT re-attach
    const world = new ClientWorld()
    world.apply({
      type: 'PlayerAssign',
      unitId: 1,
      charClass: 1,
      name: 'Sorc',
      x: 100,
      y: 100,
    })
    const sorc = world.getUnit('player', 1)!
    world.apply({
      type: 'StateSet',
      unit: { unitType: 'player', id: 1 },
      state: 38,
      complete: true,
      states: [{ state: 38, complete: true, stats: [] }],
    })
    const tsCastOverlays = sorc.overlays.filter((o) => o.token === 'thunderstormcast')
    expect(tsCastOverlays).toHaveLength(1)
    expect(tsCastOverlays[0]!.loop).toBe(false)
    expect(tsCastOverlays[0]!.castForStateId).toBe(38)
    expect(isStateCastOverlayPlaying113c(sorc.overlays, 38)).toBe(true)

    // While thunderstormcast is playing, unit-drawables holds back persistent state overlay thunderstormback
    const drawablesDuringCast = buildSceneDrawables(world.listUnits())
    const sorcDrDuringCast = drawablesDuringCast.unitDrawables.find(
      (d) => d.unitKind === 'player' && d.id === 1,
    )!
    expect(sorcDrDuringCast.overlays.some((o) => o.token === 'thunderstormcast')).toBe(true)
    expect(sorcDrDuringCast.overlays.some((o) => o.token === 'thunderstormback')).toBe(false)

    // Refreshing active StateSet(38) does NOT duplicate thunderstormcast
    const prevOverlayId = tsCastOverlays[0]!.overlayId
    world.apply({
      type: 'StateSet',
      unit: { unitType: 'player', id: 1 },
      state: 38,
      complete: true,
      states: [{ state: 38, complete: true, stats: [] }],
    })
    expect(sorc.overlays.filter((o) => o.token === 'thunderstormcast')).toHaveLength(1)
    expect(sorc.overlays.find((o) => o.token === 'thunderstormcast')!.overlayId).toBe(prevOverlayId)

    // Once thunderstormcast finishes, persistent thunderstormback renders
    for (let t = 0; t < 40; t++) {
      world.tick(40)
    }
    expect(isStateCastOverlayPlaying113c(sorc.overlays, 38)).toBe(false)
    const drawablesAfterCast = buildSceneDrawables(world.listUnits())
    const sorcDrAfterCast = drawablesAfterCast.unitDrawables.find(
      (d) => d.unitKind === 'player' && d.id === 1,
    )!
    expect(sorcDrAfterCast.overlays.some((o) => o.token === 'thunderstormback')).toBe(true)

    // StateSet(16 enchant) and StateSet(93 valkyrie) attach enchant and valkyriestart
    world.apply({
      type: 'StateSet',
      unit: { unitType: 'player', id: 1 },
      state: 16,
      complete: true,
      states: [
        { state: 16, complete: true, stats: [] },
        { state: 93, complete: true, stats: [] },
      ],
    })
    expect(sorc.overlays.some((o) => o.token === 'enchant' && o.castForStateId === 16)).toBe(true)
    expect(sorc.overlays.some((o) => o.token === 'valkyriestart' && o.castForStateId === 93)).toBe(true)

    // StateEnd(93) removes in-flight valkyriestart castoverlay
    world.apply({
      type: 'StateEnd',
      unit: { unitType: 'player', id: 1 },
      state: 93,
    })
    expect(sorc.overlays.some((o) => o.token === 'valkyriestart')).toBe(false)
  })

  it('#1064: War Cry (#154), Fissure (#234), Volcano (#244), and Armageddon (#249) attach their castoverlay exactly once per cast', () => {
    for (const [skillId, expectedCastOverlay] of [
      [154, 'warcry'],
      [234, 'druid_fire_cast_2'],
      [244, 'druid_fire_cast_2'],
      [249, 'druid_fire_cast_2'],
    ] as const) {
      const world = new ClientWorld()
      world.apply({
        type: 'PlayerAssign',
        unitId: 1,
        charClass: skillId === 154 ? 4 : 5,
        name: 'Caster',
        x: 100,
        y: 100,
      })
      const caster = world.getUnit('player', 1)!
      let attachCount = 0
      const origAttach = world.attachUnitOverlay.bind(world)
      world.attachUnitOverlay = ((unit, token, loop) => {
        if (unit === caster && token.trim().toLowerCase() === expectedCastOverlay) {
          attachCount++
        }
        return origAttach(unit, token, loop)
      }) as typeof world.attachUnitOverlay

      world.apply({
        type: 'SkillCast',
        caster: { unitType: 'player', id: 1 },
        skillId,
        level: 5,
        target: { x: 104, y: 100 },
      } as any)
      // Step through action frame so spawnMissilesForSkill also fires
      for (let i = 0; i < 20; i++) {
        world.tick(40)
      }
      expect(attachCount, `skillId=${skillId} (${expectedCastOverlay})`).toBe(1)
    }
  })

  it('#1065: Arctic Blast (#230) has empty castoverlay, stores arctic_blast_cast in prgoverlay (cltstfunc=15), and attaches it once on cast start', () => {
    expect(getSkillCastOverlay(230)).toBeUndefined()
    expect(SORCERESS_SKILL_CAST_OVERLAYS[230]).toBeUndefined()
    const row230 = getSkillOverlayRow113c(230)
    expect(row230).toBeDefined()
    expect(row230!.castOverlay).toBe('')
    expect(row230!.prgOverlay).toBe('arctic_blast_cast')
    expect(row230!.cltStFunc).toBe(15)

    const world = new ClientWorld()
    world.apply({
      type: 'PlayerAssign',
      unitId: 1,
      charClass: 5,
      name: 'Druid',
      x: 100,
      y: 100,
    })
    const druid = world.getUnit('player', 1)!
    let prgAttachCount = 0
    const origAttach = world.attachUnitOverlay.bind(world)
    world.attachUnitOverlay = ((unit, token, loop) => {
      if (unit === druid && token.trim().toLowerCase() === 'arctic_blast_cast') {
        prgAttachCount++
      }
      return origAttach(unit, token, loop)
    }) as typeof world.attachUnitOverlay

    world.apply({
      type: 'SkillCast',
      caster: { unitType: 'player', id: 1 },
      skillId: 230,
      level: 5,
      target: { x: 106, y: 100 },
    } as any)
    for (let i = 0; i < 20; i++) {
      world.tick(40)
    }
    expect(prgAttachCount).toBe(1)
  })

  it('#1066: getSkillCastOverlay covers all 357 Skills.txt rows including all monster castoverlay entries', async () => {
    const registry = await getSharedDataRegistry()
    expect(SKILL_OVERLAY_ROWS_113C).toHaveLength(54)

    const expectedMonsterCastOverlays: ReadonlyArray<readonly [number, string]> = [
      [171, 'fire_cast_2'],      // VampireMeteor
      [179, 'healing'],          // ZakarumHeal
      [181, 'healing'],          // Resurrect
      [184, 'teleport'],         // MonTeleport
      [205, 'ice_cast_2'],       // MonBlizzard
      [209, 'ice_cast_3'],       // MonFrozenArmor
      [283, 'fire_cast_2'],      // Imp Fireball
      [299, 'fist_will_cast'],   // Imp Fire Missile
      [301, 'siege_beast_dust'], // Siege Beast Stomp
      [312, 'death_sentry'],     // mon death sentry
      [316, 'fire_cast_2'],      // Baal Nova
      [327, 'healing'],          // Resurrect2
      [332, 'light_cast_1'],     // ZakarumLightning
      [353, 'light_cast_1'],     // Trap Nova
      [356, 'fist_will_cast'],   // Imp Fire Missile Ex
    ]
    for (const [skillId, expected] of expectedMonsterCastOverlays) {
      expect(getSkillCastOverlay(skillId), `skill #${skillId}`).toBe(expected)
    }

    // Verify every single Skills.txt row (all 357 rows) matches getSkillCastOverlay
    let checkedSkillCount = 0
    for (const row of registry.skillsTable.rows) {
      const idStr = (row['Id'] ?? '').trim()
      if (idStr === '') continue
      const id = Number(idStr)
      checkedSkillCount++
      const castOv = (row['castoverlay'] ?? '').trim().toLowerCase()
      if (castOv !== '') {
        expect(getSkillCastOverlay(id), `skill #${id} ${row['skill']}`).toBe(castOv)
        expect(getSkillCastOverlay(row['skill'] ?? ''), `skill name ${row['skill']}`).toBe(castOv)
      } else {
        expect(getSkillCastOverlay(id), `skill #${id} ${row['skill']}`).toBeUndefined()
      }
    }
    expect(checkedSkillCount).toBe(357)
  })

  it('#1067 & #1068: CANONICAL_113C_OVERLAYS contains all 293 Overlay.txt rows with exact field parity and getOverlayTxtData throws on unknown overlays', () => {
    expect(OVERLAY_TXT_ROWS).toHaveLength(293)
    expect(Object.keys(CANONICAL_113C_OVERLAYS)).toHaveLength(293)

    for (let i = 0; i < OVERLAY_TXT_ROWS.length; i++) {
      const row = OVERLAY_TXT_ROWS[i]!
      const key = row.name.toLowerCase()
      const entry = CANONICAL_113C_OVERLAYS[key]
      expect(entry, `Overlay.txt row #${i} ${row.name}`).toBeDefined()
      expect(entry!.id).toBe(i)
      expect(entry!.overlay.toLowerCase()).toBe(key)
      expect(entry!.filename).toBe(row.filename)
      expect(entry!.frames).toBe(row.frames)
      expect(entry!.preDraw).toBe(row.preDraw !== 0)
      expect(entry!.xOffset).toBe(row.xOffset)
      expect(entry!.yOffset).toBe(row.yOffset)
      expect([entry!.height1, entry!.height2, entry!.height3, entry!.height4]).toEqual(row.height)
      expect(entry!.animRate).toBe(row.animRate)
      expect(entry!.trans).toBe(row.trans)
      expect(entry!.initRadius).toBe(row.initRadius)
      expect(entry!.radius).toBe(row.radius)
      expect(entry!.red).toBe(row.red)
      expect(entry!.green).toBe(row.green)
      expect(entry!.blue).toBe(row.blue)
      expect(entry!.numDirections).toBe(row.numDirections)
    }

    // Specific spot checks from #1067 & #1068
    expect(getOverlayTxtData('curseamplifydamage')).toMatchObject({
      frames: 24,
      radius: 6,
      red: 255,
      green: 64,
      blue: 64,
    })
    expect(getOverlayTxtData('cursedimvision').frames).toBe(24)
    expect(getOverlayTxtData('curseweaken').frames).toBe(24)
    expect(getOverlayTxtData('curseterror').frames).toBe(20)
    expect(getOverlayTxtData('curse_hit')).toMatchObject({
      frames: 10,
      trans: 3,
      initRadius: 1,
      radius: 10,
      red: 255,
      green: 193,
      blue: 103,
    })
    expect(getOverlayTxtData('frozenarmor')).toMatchObject({
      frames: 24,
      preDraw: false,
      trans: 3,
      initRadius: 1,
      radius: 13,
      red: 200,
      green: 200,
      blue: 255,
    })
    expect(getOverlayTxtData('thunderstormcast')).toBeDefined()
    expect(getOverlayTxtData('valkyriestart')).toBeDefined()
    expect(getOverlayTxtData('shoutstart')).toBeDefined()
    expect(getOverlayTxtData('battleorderscast')).toBeDefined()
    expect(getOverlayTxtData('battlecommandcast')).toBeDefined()
    expect(getOverlayTxtData('siege_beast_dust')).toBeDefined()

    // No silent fallback for unknown overlay names
    expect(() => getOverlayTxtData('nonexistent_fake_overlay_12345')).toThrow(
      /not a 1\.13c Overlay\.txt row/,
    )
    expect(() => getOverlayTxtData('shout_cast')).toThrow(/not a 1\.13c Overlay\.txt row/)
  })
})
