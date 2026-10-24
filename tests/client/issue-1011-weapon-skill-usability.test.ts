import { describe, expect, it, vi } from 'vitest'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import { SkillHotkeysHud } from '../../src/client/ui/hotkeys.ts'
import { canUseSkillWithWeapon } from '../../src/common/skills/skills-meta.ts'

describe('Issue #1011: Physical/weapon-gated skills show unusable (red) and block casting on weapon mismatch', () => {
  describe('1. Canonical 1.13c Skills.txt weapon & ammo validation (canUseSkillWithWeapon)', () => {
    it('Poison Dagger (#73) requires a knife/dagger or throwing knife (knif)', () => {
      // Unarmed -> false
      expect(canUseSkillWithWeapon(73, {})).toBe(false)
      // Holding a wand ('wnd') or sword ('ssd') -> false
      expect(canUseSkillWithWeapon(73, { rightHandCode: 'wnd' })).toBe(false)
      expect(canUseSkillWithWeapon(73, { rightHandCode: 'ssd' })).toBe(false)
      // Holding a dagger ('dgr') or kris ('kri') or throwing knife ('tkf') -> true
      expect(canUseSkillWithWeapon(73, { rightHandCode: 'dgr' })).toBe(true)
      expect(canUseSkillWithWeapon(73, { rightHandCode: 'kri' })).toBe(true)
      expect(canUseSkillWithWeapon(73, { rightHandCode: 'tkf' })).toBe(true)
    })

    it('Amazon Bow & Crossbow skills (#6, #7, #12, #22, #26, #31) require bow+arrows or crossbow+bolts', () => {
      const bowSkills = [6, 7, 11, 12, 16, 21, 22, 26, 27, 31]
      for (const skillId of bowSkills) {
        // Unarmed -> false
        expect(canUseSkillWithWeapon(skillId, {})).toBe(false)
        // Melee weapon ('ssd' Short Sword or 'jav' Javelin) -> false
        expect(canUseSkillWithWeapon(skillId, { rightHandCode: 'ssd' })).toBe(false)
        expect(canUseSkillWithWeapon(skillId, { rightHandCode: 'jav', leftHandCode: 'ucf' })).toBe(false)
        // Bow ('sbw' Short Bow) WITHOUT arrows quiver -> false
        expect(canUseSkillWithWeapon(skillId, { rightHandCode: 'sbw' })).toBe(false)
        // Bow ('sbw') WITH bolts ('cqv') -> false
        expect(canUseSkillWithWeapon(skillId, { rightHandCode: 'sbw', leftHandCode: 'cqv' })).toBe(false)
        // Bow ('sbw' or Amazon bow 'am1') WITH arrows ('aqv') -> true
        expect(canUseSkillWithWeapon(skillId, { rightHandCode: 'sbw', leftHandCode: 'aqv' })).toBe(true)
        expect(canUseSkillWithWeapon(skillId, { rightHandCode: 'am1', leftHandCode: 'aqv' })).toBe(true)
        // Crossbow ('lxb') WITHOUT bolts -> false
        expect(canUseSkillWithWeapon(skillId, { rightHandCode: 'lxb' })).toBe(false)
        // Crossbow ('lxb') WITH bolts ('cqv') -> true
        expect(canUseSkillWithWeapon(skillId, { rightHandCode: 'lxb', leftHandCode: 'cqv' })).toBe(true)
      }
    })

    it('Amazon Spear (#10 Jab, #24 Charged Strike) & Javelin (#15 Poison Javelin, #35 Lightning Fury) skills', () => {
      // Jab (#10) and Charged Strike (#24) accept spears ('spr', 'am3') and javelins ('jav', 'am5')
      expect(canUseSkillWithWeapon(10, { rightHandCode: 'spr' })).toBe(true)
      expect(canUseSkillWithWeapon(24, { rightHandCode: 'jav' })).toBe(true)
      expect(canUseSkillWithWeapon(24, { rightHandCode: 'am5' })).toBe(true)
      expect(canUseSkillWithWeapon(10, { rightHandCode: 'ssd' })).toBe(false)
      expect(canUseSkillWithWeapon(10, { rightHandCode: 'sbw', leftHandCode: 'aqv' })).toBe(false)

      // Lightning Fury (#35) requires Javelin ('jave'), rejects non-javelin spears ('spr')
      expect(canUseSkillWithWeapon(35, { rightHandCode: 'jav' })).toBe(true)
      expect(canUseSkillWithWeapon(35, { rightHandCode: 'am5' })).toBe(true)
      expect(canUseSkillWithWeapon(35, { rightHandCode: 'spr' })).toBe(false)
      expect(canUseSkillWithWeapon(35, { rightHandCode: 'ssd' })).toBe(false)
    })

    it('Paladin melee (#96 Sacrifice, #106 Zeal) & shield (#97 Smite, #117 Holy Shield) skills', () => {
      // Zeal (#106) requires melee weapon
      expect(canUseSkillWithWeapon(106, {})).toBe(false)
      expect(canUseSkillWithWeapon(106, { rightHandCode: 'sbw', leftHandCode: 'aqv' })).toBe(false)
      expect(canUseSkillWithWeapon(106, { rightHandCode: 'ssd' })).toBe(true)
      expect(canUseSkillWithWeapon(106, { rightHandCode: 'scp' })).toBe(true)

      // Smite (#97) & Holy Shield (#117) require a shield ('buc' Buckler or 'pa1' Targe)
      expect(canUseSkillWithWeapon(97, { rightHandCode: 'ssd' })).toBe(false)
      expect(canUseSkillWithWeapon(117, { rightHandCode: 'ssd' })).toBe(false)
      expect(canUseSkillWithWeapon(97, { rightHandCode: 'ssd', leftHandCode: 'buc' })).toBe(true)
      expect(canUseSkillWithWeapon(117, { rightHandCode: 'ssd', leftHandCode: 'pa1' })).toBe(true)
    })

    it('Barbarian dual-wield (#133 Double Swing, #147 Frenzy, #140 Double Throw) & Assassin claw skills (#259, #260)', () => {
      // Double Swing (#133) and Frenzy (#147) require two melee weapons
      expect(canUseSkillWithWeapon(133, { rightHandCode: 'ssd' })).toBe(false)
      expect(canUseSkillWithWeapon(133, { rightHandCode: 'ssd', leftHandCode: 'buc' })).toBe(false)
      expect(canUseSkillWithWeapon(133, { rightHandCode: 'ssd', leftHandCode: 'hax' })).toBe(true)
      expect(canUseSkillWithWeapon(147, { rightHandCode: 'ssd', leftHandCode: 'hax' })).toBe(true)

      // Double Throw (#140) requires two throwing weapons
      expect(canUseSkillWithWeapon(140, { rightHandCode: 'tkf', leftHandCode: 'ssd' })).toBe(false)
      expect(canUseSkillWithWeapon(140, { rightHandCode: 'tkf', leftHandCode: 'jav' })).toBe(true)

      // Fists of Fire (#259) requires at least one h2h claw ('ktr'); Dragon Claw (#260) requires two h2h claws
      expect(canUseSkillWithWeapon(259, { rightHandCode: 'ssd' })).toBe(false)
      expect(canUseSkillWithWeapon(259, { rightHandCode: 'ktr' })).toBe(true)
      expect(canUseSkillWithWeapon(260, { rightHandCode: 'ktr' })).toBe(false)
      expect(canUseSkillWithWeapon(260, { rightHandCode: 'ktr', leftHandCode: 'wrb' })).toBe(true)
    })

    it('Normal Attack (#0) is usable unarmed/melee, but unusable with bow/crossbow lacking matching quiver', () => {
      expect(canUseSkillWithWeapon(0, {})).toBe(true)
      expect(canUseSkillWithWeapon(0, { rightHandCode: 'ssd' })).toBe(true)
      expect(canUseSkillWithWeapon(0, { rightHandCode: 'sbw' })).toBe(false)
      expect(canUseSkillWithWeapon(0, { rightHandCode: 'sbw', leftHandCode: 'aqv' })).toBe(true)
      expect(canUseSkillWithWeapon(0, { rightHandCode: 'lxb' })).toBe(false)
      expect(canUseSkillWithWeapon(0, { rightHandCode: 'lxb', leftHandCode: 'cqv' })).toBe(true)
    })
  })

  describe('2. HUD rendering & speedbar visibility on weapon mismatch', () => {
    it('keeps learned weapon skills in speedbar popup and renders red unusable overlay when weapon mismatches', () => {
      const hud = new SkillHotkeysHud()
      hud.weaponEquipState = { rightHandCode: 'wnd' } // Holding a Wand (not a Dagger)
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
            skillId: 73,
            name: 'Poison Dagger',
            nameZh: '淬毒匕首',
            level: 1,
            manaCost: 3,
            leftUsable: true,
            rightUsable: true,
          },
        ],
        73,
        73,
      )

      // Learned Poison Dagger (#73) remains visible in both left and right speedbar popups
      expect(hud.getAvailableSkillsForSide('left').map(s => s.skillId)).toContain(73)
      expect(hud.getAvailableSkillsForSide('right').map(s => s.skillId)).toContain(73)
      expect(hud.isSkillWeaponUsable(73)).toBe(false)
      expect(hud.isSkillWeaponUsable(0)).toBe(true)

      // Verify canvas draw applies red tint rgba(180, 20, 20, 0.55) to left/right buttons for skill 73
      const fillRectCalls: Array<{ style: string; x: number; y: number; w: number; h: number }> = []
      const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        fillRect: vi.fn(function (this: any, x: number, y: number, w: number, h: number) {
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

      hud.draw(ctx, null, { drawText: () => {}, measureText: () => 20 } as any)
      const redTints = fillRectCalls.filter(
        c => c.style === 'rgba(180, 20, 20, 0.55)' && c.w === 46 && c.h === 46,
      )
      expect(redTints.length).toBeGreaterThanOrEqual(2)

      // Equipping a Dagger ('dgr') clears the red unusable state
      hud.weaponEquipState = { rightHandCode: 'dgr' }
      expect(hud.isSkillWeaponUsable(73)).toBe(true)
    })
  })

  describe('3. CommandMapper blocks casting weapon-mismatched skills', () => {
    it('prevents right-click, Shift+left-click, and monster left-click attack when weapon does not match skill', () => {
      const sent: any[] = []
      const hud = new SkillHotkeysHud()
      hud.weaponEquipState = { rightHandCode: 'ssd' } // Holding Short Sword ('ssd'), not Bow or Dagger
      hud.leftSkillId = 12 // Multiple Shot
      hud.rightSkillId = 73 // Poison Dagger

      const monster = {
        unitType: 'monster' as const,
        id: 99,
        classId: 0,
        mode: 1,
        x: 105,
        y: 105,
        hp: 100,
        maxHp: 100,
      } as any
      const world = {
        areaId: 2, // Blood Moor (outside town)
        difficulty: 0,
        selfId: 1,
        self: {
          id: 1,
          x: 100,
          y: 100,
          leftSkill: 12,
          rightSkill: 73,
          states: new Set<number>(),
        },
        npcInteraction: { npcId: null, unitType: null, stashOpen: false, cubeOpen: false },
        cancelPendingMeleeAttack: vi.fn(),
        noteOutgoingCommand: vi.fn(),
        getUnit: vi.fn(() => null),
      } as any

      const mapper = new CommandMapper({
        world,
        hudManager: {
          screenWidth: 800,
          screenHeight: 600,
          isRunning: true,
          hotkeys: hud,
          groundItemLabelBoxes: [],
          handleMouseMove: () => {},
          isPointInterceptedByHud: () => false,
          handleClick: () => false,
          syncPublishedState: () => {},
        } as any,
        sendCommand: cmd => sent.push(cmd),
      })

      // 1. Right-click with Poison Dagger (#73) while holding Sword -> blocked
      expect(mapper.triggerSecondaryWorldAction(105, 105, monster, 1000, false)).toBeNull()
      // 2. Quick-cast Poison Dagger (#73) -> blocked
      expect(mapper.quickCastSkillAtCursor(73, undefined, 1000)).toBe(false)
      // 3. Left-click monster with Multiple Shot (#12) while holding Sword -> blocked
      expect(mapper.triggerPrimaryWorldAction(105, 105, monster, 1000, false)).toBeNull()
      // 4. Shift + left-click ground with Multiple Shot (#12) while holding Sword -> blocked
      mapper.handleKeyDown({ key: 'Shift', shiftKey: true }, 1000)
      expect(mapper.triggerPrimaryWorldAction(105, 105, null, 1000, false)).toBeNull()
      expect(sent).toHaveLength(0)

      // Equip Bow + Arrows ('sbw' + 'aqv') -> Multiple Shot (#12) now dispatches!
      hud.weaponEquipState = { rightHandCode: 'sbw', leftHandCode: 'aqv' }
      const dispatched = mapper.triggerPrimaryWorldAction(105, 105, null, 2000, false)
      expect(dispatched?.command.type).toBe('SkillAt')
    })
  })
})
