import { describe, expect, it, vi } from 'vitest'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import { SkillHotkeysHud } from '../../src/client/ui/hotkeys.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { STAT_MANA, STAT_MAXMANA } from '../../src/client/world/stat-list.ts'

function createRecordingCanvasContext(): {
  ctx: CanvasRenderingContext2D
  fillRectCalls: Array<{ style: string; x: number; y: number; w: number; h: number }>
} {
  const fillRectCalls: Array<{ style: string; x: number; y: number; w: number; h: number }> = []
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    fillRect: vi.fn(function (x: number, y: number, w: number, h: number) {
      fillRectCalls.push({ style: String(ctx.fillStyle), x, y, w, h })
    }),
    strokeRect: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    measureText: vi.fn(() => ({ width: 20 })),
    fillText: vi.fn(),
  } as unknown as CanvasRenderingContext2D
  return { ctx, fillRectCalls }
}

describe('Issue #1302: Insufficient mana blocks spell casting, plays NeedMana voice prompt, and tints skill icons red', () => {
  describe('1. HUD active skill slots & Speedbar popup red tint (`D2Client.dll` 0x6faeda60 / 0x6faee7f0)', () => {
    it('tints bottom-bar active skill buttons and Speedbar popup icons red (rgba(180, 20, 20, 0.55)) when mana is insufficient', () => {
      const hud = new SkillHotkeysHud()
      hud.setAvailableSkills(
        [
          {
            skillId: 0,
            name: 'Attack',
            nameZh: '攻击',
            level: 1,
            manaCost: 0,
            leftUsable: true,
            rightUsable: false,
          },
          {
            skillId: 36,
            name: 'Fire Bolt',
            nameZh: '火弹',
            level: 1,
            manaCost: 2.5,
            leftUsable: true,
            rightUsable: true,
          },
          {
            skillId: 47,
            name: 'Fire Ball',
            nameZh: '火球',
            level: 1,
            manaCost: 5,
            leftUsable: true,
            rightUsable: true,
          },
        ],
        36, // Left slot: Fire Bolt (costs 2.5)
        47, // Right slot: Fire Ball (costs 5)
      )

      // 1) Insufficient mana (1 mana < 2.5 for Fire Bolt and < 5 for Fire Ball)
      hud.currentMana = 1
      expect(hud.hasEnoughMana(0)).toBe(true)
      expect(hud.hasEnoughMana(36)).toBe(false)
      expect(hud.hasEnoughMana(47)).toBe(false)

      // Open right-side Speedbar popup (contains Fire Bolt #36 and Fire Ball #47)
      hud.openPopup = 'right'
      const { ctx, fillRectCalls } = createRecordingCanvasContext()
      hud.draw(ctx, null, { drawText: () => {}, measureText: () => 20 } as any)

      const redTints = fillRectCalls.filter(
        c => c.style === 'rgba(180, 20, 20, 0.55)' && c.w === 46 && c.h === 46,
      )
      const blueTints = fillRectCalls.filter(
        c => c.style === 'rgba(24, 60, 180, 0.42)' && c.w === 46 && c.h === 46,
      )
      // Left active button (#36) + Right active button (#47) + 2 Speedbar popup buttons (#36, #47) = 4 red tints
      expect(redTints).toHaveLength(4)
      expect(blueTints).toHaveLength(0)

      // 2) Partial mana (3 mana >= 2.5 for Fire Bolt, < 5 for Fire Ball)
      hud.currentMana = 3
      expect(hud.hasEnoughMana(36)).toBe(true)
      expect(hud.hasEnoughMana(47)).toBe(false)
      fillRectCalls.length = 0
      hud.draw(ctx, null, { drawText: () => {}, measureText: () => 20 } as any)

      const redTintsPartial = fillRectCalls.filter(
        c => c.style === 'rgba(180, 20, 20, 0.55)' && c.w === 46 && c.h === 46,
      )
      // Only Fire Ball (#47) on right active button + right Speedbar popup = 2 red tints
      expect(redTintsPartial).toHaveLength(2)

      // 3) Sufficient mana (10 mana >= 5) -> 0 red tints
      hud.currentMana = 10
      fillRectCalls.length = 0
      hud.draw(ctx, null, { drawText: () => {}, measureText: () => 20 } as any)
      const redTintsFull = fillRectCalls.filter(
        c => c.style === 'rgba(180, 20, 20, 0.55)' && c.w === 46 && c.h === 46,
      )
      expect(redTintsFull).toHaveLength(0)
    })

    it('exempts item-charged skills, scrolls/tomes, and Druid Werewolf/Werebear unshift from mana cost (`0x6fda0b17` / `0x6fda0beb`)', () => {
      const hud = new SkillHotkeysHud()
      hud.currentMana = 0
      // Scrolls / Tomes (#217..#220) cost 0 mana
      expect(hud.hasEnoughMana(217)).toBe(true)
      expect(hud.hasEnoughMana(218)).toBe(true)
      expect(hud.hasEnoughMana(219)).toBe(true)
      expect(hud.hasEnoughMana(220)).toBe(true)

      // Teleport (#54) normally costs mana, but when granted by item charges it costs 0 mana
      expect(hud.hasEnoughMana(54)).toBe(false)
      hud.setSkillCharges(54, 15, 20)
      expect(hud.hasEnoughMana(54)).toBe(true)

      // Werewolf (#223) costs mana in human form, but unshifting while in state 139 costs 0 mana
      expect(hud.hasEnoughMana(223)).toBe(false)
      hud.setActiveStates([139])
      expect(hud.hasEnoughMana(223)).toBe(true)
    })
  })

  describe('2. World-to-HUD mana synchronization (`hud-world-sync.ts`)', () => {
    it('syncs `hud.hotkeys.currentMana` from `world.self.mana` during `syncFromWorld` and `syncVitalsFromWorld` (including 0 mana)', () => {
      const world = new ClientWorld()
      const hudManager = new HudManager(null)
      const hudModel = new HudModel({ world, hudManager })

      world.self.charClass = 1 // Sorceress
      world.self.applyStat(STAT_MAXMANA, 50 << 8)
      world.self.applyStat(STAT_MANA, 0)
      expect(world.self.hasManaState).toBe(true)

      hudModel.syncFromWorld()
      expect(hudManager.hotkeys.currentMana).toBe(0)
      expect(hudManager.hotkeys.hasEnoughMana(36)).toBe(false)

      // Fast-path vitals update (`0x18` / `0x95` LifeMana)
      world.self.applyLifeMana?.(50, 12, 80, 100, 100)
      hudModel.syncVitalsFromWorld()
      expect(hudManager.hotkeys.currentMana).toBe(12)
      expect(hudManager.hotkeys.hasEnoughMana(36)).toBe(true)
    })
  })

  describe('3. CommandMapper blocks spell casting and plays `<class>_needmana_1` voice prompt (`0x6fac8f90` -> `0x6fad3200`)', () => {
    it('blocks right-click, Shift+left-click, monster left-click, and Quick Cast when mana is insufficient, while allowing ground walk', () => {
      const world = new ClientWorld()
      world.areaId = 2 // Blood Moor (outside town)
      world.selfId = 1
      world.self.unitId = 1
      world.self.charClass = 1 // Sorceress (`sor_needmana_1` = 3269)
      world.self.x = 100
      world.self.y = 100
      world.self.maxMana = 35
      world.self.mana = 1 // Insufficient for Fire Bolt (#36, cost 2.5) and Fire Ball (#47, cost 5)
      world.self.leftSkill = 36
      world.self.rightSkill = 47
      ;(world.self.skills as Map<number, number>).set(36, 1)
      ;(world.self.skills as Map<number, number>).set(47, 1)

      const monster = {
        unitType: 'monster' as const,
        id: 42,
        classId: 0,
        mode: 1,
        x: 106,
        y: 106,
        lifePct: 100,
      } as any

      const hud = new SkillHotkeysHud()
      hud.leftSkillId = 36
      hud.rightSkillId = 47
      hud.currentMana = 1

      const sent: any[] = []
      const uiSounds: number[] = []
      const mapper = new CommandMapper({
        world,
        hudManager: {
          screenWidth: 800,
          screenHeight: 600,
          isRunning: true,
          mana: 1,
          maxMana: 35,
          hotkeys: hud,
          groundItemLabelBoxes: [],
          handleMouseMove: () => {},
          isPointInterceptedByHud: () => false,
          handleClick: () => false,
          syncPublishedState: () => {},
          onPlayUiSound: (id: number) => uiSounds.push(id),
        } as any,
        sendCommand: cmd => sent.push(cmd),
      })

      // 1. Right-click spell cast (`triggerSecondaryWorldAction` & `fromMouseDown`) -> blocked + plays 3269
      expect(mapper.triggerSecondaryWorldAction(106, 106, null, 1000, false)).toBeNull()
      expect(sent).toHaveLength(0)
      expect(world.self.castState).toBeUndefined()
      const soundReqs1 = world.drainWorldSoundRequests()
      expect(soundReqs1).toEqual([
        {
          soundId: 3269,
          speechSoundId: 3269,
          eventCode: 21,
          local: true,
        },
      ])
      expect(uiSounds).toEqual([3269])

      // 2. Duplicate attempt within 75 ticks (3000ms) at t=2500ms -> still blocked, speech suppressed by 3000ms cooldown
      expect(
        mapper.fromMouseDown(
          { button: 'right', worldX: 106, worldY: 106 },
          world,
          2500,
        ),
      ).toBeNull()
      expect(world.drainWorldSoundRequests()).toHaveLength(0)

      // 3. Attempt after 3000ms cooldown expires (t=4100ms) -> blocked + plays 3269 again
      expect(mapper.quickCastSkillAtCursor(47, undefined, 4100)).toBe(false)
      expect(sent).toHaveLength(0)
      expect(world.drainWorldSoundRequests()).toEqual([
        {
          soundId: 3269,
          speechSoundId: 3269,
          eventCode: 21,
          local: true,
        },
      ])

      // 4. Left-click on hostile monster with Fire Bolt (#36) -> blocked
      expect(mapper.triggerPrimaryWorldAction(106, 106, monster, 5000, false)).toBeNull()
      expect(
        mapper.fromMouseDown(
          { button: 'left', worldX: 106, worldY: 106, hoveredUnit: monster },
          world,
          5000,
        ),
      ).toBeNull()
      expect(sent).toHaveLength(0)

      // 5. Shift + left-click on ground with Fire Bolt (#36) -> blocked
      mapper.handleKeyDown({ key: 'Shift', shiftKey: true }, 5000)
      expect(mapper.triggerPrimaryWorldAction(106, 106, null, 5000, false)).toBeNull()
      mapper.handleKeyUp({ key: 'Shift', shiftKey: false }, 5000)
      expect(sent).toHaveLength(0)

      // 6. Unshifted left-click on empty ground -> still walks/runs (`Move`) normally without playing NeedMana!
      world.drainWorldSoundRequests()
      const moveRes = mapper.triggerPrimaryWorldAction(110, 110, null, 8000, false)
      expect(moveRes?.command.type).toBe('Move')
      expect(world.drainWorldSoundRequests()).toHaveLength(0)

      // 7. Restore mana (`mana = 20`) -> right-click Fire Ball (#47) now dispatches `SkillAt`!
      world.self.mana = 20
      hud.currentMana = 20
      const castRes = mapper.triggerSecondaryWorldAction(106, 106, null, 9000, false)
      expect(castRes?.command).toEqual({
        type: 'SkillAt',
        hand: 'right',
        at: { x: 106, y: 106 },
        hold: false,
      })
    })
  })
})
