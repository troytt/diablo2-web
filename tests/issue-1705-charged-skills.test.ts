import { describe, expect, it } from 'vitest'
import { createRolledAffix } from '../src/common/items/affix-generator.ts'
import type { MagicAffix } from '../src/common/items/affixes.ts'
import {
  chargedSkillChargesOf,
  decodeStat204ChargedSkill113c,
  encodeChargedSkillValue,
  formatChargedSkill,
  resolveChargedSkillId113c,
  resolveChargedSkillRoll113c,
} from '../src/common/items/charged-skill.ts'
import { rolledPropsToItemStats } from '../src/common/items/item-bridge.ts'
import { formatPropertyCodeI18n } from '../src/common/i18n/tooltip-i18n.ts'
import { D2Rng } from '../src/common/rng/d2-rng.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { HudModel } from '../src/client/ui-model/hud-model.ts'
import { GameInstance } from '../src/server/engine/game-instance.ts'
import type { ClientCommand, ItemData } from '../src/netproto/index.ts'

describe('Issue #1705: Charged skills (1.13c D2Common 0x6FD97420, D2Game 0x6FCF9A21/0x6FCBF4F8, D2Client Row 4)', () => {
  it('resolves negative/zero min & max in D2Common.dll 0x6FD97420 (of Teleportation min=-30, max=-6)', () => {
    // Teleport (skillId 54) has reqLvl = 18.
    // MagicSuffix.txt "of Teleportation": mod1code=charged, mod1param=54, mod1min=-30, mod1max=-6.
    // span = 99 - 18 = 81, step = trunc(81 / 6) = 13.
    const r31 = resolveChargedSkillRoll113c(-30, -6, { skillId: 54, ilvl: 31 })
    expect(r31.slvl).toBe(1) // trunc((31 - 18) / 13) = 1
    expect(r31.maxCharges).toBe(33) // 30 + trunc(30 * 1 / 8) = 33

    const r44 = resolveChargedSkillRoll113c(-30, -6, { skillId: 54, ilvl: 44 })
    expect(r44.slvl).toBe(2) // trunc((44 - 18) / 13) = 2
    expect(r44.maxCharges).toBe(37) // 30 + trunc(30 * 2 / 8) = 37

    const r99 = resolveChargedSkillRoll113c(-30, -6, { skillId: 54, ilvl: 99 })
    expect(r99.slvl).toBe(6) // trunc((99 - 18) / 13) = 6
    expect(r99.maxCharges).toBe(52) // 30 + trunc(30 * 6 / 8) = 52

    // Affix generator rolls positive charges and positive slvl for negative MagicSuffix rows
    const suffixRow: MagicAffix = {
      name: 'of Teleportation',
      isPrefix: false,
      version: 100,
      spawnable: true,
      rare: true,
      level: 24,
      maxlevel: 0,
      levelreq: 18,
      frequency: 2,
      group: 114,
      mods: [{ code: 'charged', param: '54', min: -30, max: -6 }],
      transform: false,
      itypes: ['staf', 'orb', 'wand', 'amul', 'circ'],
      etypes: [],
    }
    const rolled = createRolledAffix(suffixRow, new D2Rng(12345), 44)
    expect(rolled.mods).toHaveLength(1)
    expect(rolled.mods[0]!.code).toBe('charged')
    expect(rolled.mods[0]!.max).toBe(2)
    expect(rolled.mods[0]!.min).toBe(37)
    expect(rolled.mods[0]!.value).toBe(37)

    // Even if an unmigrated prop still carries negative min/max, tooltip formatters resolve positive slvl/charges
    expect(formatChargedSkill(-6, 'Teleport', chargedSkillChargesOf(-30, -30, 1), 'en')).toBe(
      'Level 1 Teleport (33/33 Charges)',
    )
    expect(formatPropertyCodeI18n('charged', -30, -30, -6, '54', 'zh')).toBe(
      '等级 1 传送 （33/33 次聚气）',
    )
  })

  it('resolves both numeric and string skill names in rolledPropsToItemStats for charged, oskill, aura, and proc skills', () => {
    expect(resolveChargedSkillId113c('Teleport')).toBe(54)
    expect(resolveChargedSkillId113c('54')).toBe(54)
    expect(resolveChargedSkillId113c(54)).toBe(54)
    expect(resolveChargedSkillId113c('Heart of Wolverine')).toBe(236)
    expect(resolveChargedSkillId113c('IronGolem')).toBe(90)

    const stats = rolledPropsToItemStats([
      { code: 'charged', param: 'Teleport', min: 69, max: 11, value: 69 },
      { code: 'oskill', param: 'Teleport', min: 1, max: 1, value: 1 },
      { code: 'aura', param: 'Conviction', min: 12, max: 12, value: 12 },
      { code: 'hit-skill', param: 'Chain Lightning', min: 10, max: 17, value: 10 },
    ])
    const stat204 = stats.find((s) => s.statId === 204)
    expect(stat204).toBeDefined()
    expect(stat204!.param).toBe((54 << 6) | 11)
    expect(stat204!.value).toBe(encodeChargedSkillValue(69, 69))

    const stat97 = stats.find((s) => s.statId === 97)
    expect(stat97).toEqual({ statId: 97, param: 54, value: 1 })

    const stat151 = stats.find((s) => s.statId === 151)
    expect(stat151).toEqual({ statId: 151, param: 123, value: 12 })

    const stat198 = stats.find((s) => s.statId === 198)
    expect(stat198).toEqual({ statId: 198, param: (53 << 6) | 17, value: 10 })
  })

  it('syncs equipped charged skills into HUD Speedbar Row 4, handles selection/hotkeys, and hides unidentified/broken items', () => {
    const world = new ClientWorld()
    world.self.unitId = 1
    world.self.name = 'TelePala'
    world.self.charClass = 3 // Paladin (does not natively own Teleport)
    world.self.level = 24

    const sentCommands: ClientCommand[] = []
    const hud = new HudManager()
    hud.setCharacterClass('pal')
    const model = new HudModel({
      world,
      hudManager: hud,
      onCommand: (cmd) => sentCommands.push(cmd),
    })

    const staffId = 777
    const packedParam = (54 << 6) | 2 // Level 2 Teleport
    const packedValue = encodeChargedSkillValue(33, 37)

    // 1. Unidentified staff does NOT grant charged skills (D2Common.#10731 0x6FD98395)
    world.containers.applyItemEvent(
      0x06,
      {
        id: staffId,
        itemId: staffId,
        code: 'bst',
        location: 1,
        container: 'equipment',
        bodyLoc: 4,
        equippedSlot: 4,
        quality: 4,
        identified: false,
        flags: 0,
        rawFlags: 0,
        durability: 35,
        maxDurability: 35,
        stats: [{ statId: 204, param: packedParam, value: packedValue }],
      } as unknown as ItemData,
      'equipment',
      1,
    )
    model.syncFromWorld()
    expect(
      hud.hotkeys.availableSkills.find((s) => s.skillId === 54 && s.itemId === staffId),
    ).toBeUndefined()

    // 2. Identified staff grants Level 2 Teleport (33/37 Charges) on Speedbar Row 4
    world.containers.applyItemEvent(
      0x06,
      {
        id: staffId,
        itemId: staffId,
        code: 'bst',
        location: 1,
        container: 'equipment',
        bodyLoc: 4,
        equippedSlot: 4,
        quality: 4,
        identified: true,
        flags: 0x10,
        rawFlags: 0x10,
        durability: 35,
        maxDurability: 35,
        stats: [{ statId: 204, param: packedParam, value: packedValue }],
      } as unknown as ItemData,
      'equipment',
      1,
    )
    model.syncFromWorld()
    const teleEntry = hud.hotkeys.availableSkills.find(
      (s) => s.skillId === 54 && s.itemId === staffId,
    )
    expect(teleEntry).toBeDefined()
    expect(teleEntry!.listRow).toBe(4)
    expect(teleEntry!.isItemSkill).toBe(true)
    expect(teleEntry!.level).toBe(2)
    expect(teleEntry!.charges).toBe(33)
    expect(teleEntry!.maxCharges).toBe(37)
    expect(teleEntry!.rightUsable).toBe(true)
    expect(world.self.skillCharges?.get(54)).toBe(33)
    expect(hud.hotkeys.getSkillCharges(54)).toBe(33)
    expect(hud.hotkeys.getSkillMaxCharges(54)).toBe(37)

    // 3. Selecting charged Teleport from the speedbar emits SelectSkill with itemId = staffId
    hud.hotkeys.requestSelect('right', 54, staffId)
    expect(sentCommands).toContainEqual({
      type: 'SelectSkill',
      hand: 'right',
      skill: 54,
      itemId: staffId,
    })

    // 4. Binding F1 to hovered charged Teleport stores itemId and pressing F1 selects it with itemId
    hud.hotkeys.openPopup = 'right'
    hud.hotkeys.hoveredPopupSkill = {
      side: 'right',
      skillId: 54,
      itemId: staffId,
    }
    expect(hud.hotkeys.handleKeyDown('F1')).toBe(true)
    expect(sentCommands).toContainEqual({
      type: 'AssignSkillHotkey',
      slot: 0,
      hand: 'right',
      skill: 54,
      itemId: staffId,
    })

    sentCommands.length = 0
    hud.hotkeys.openPopup = null
    expect(hud.hotkeys.triggerFunctionKey('F1')).toEqual({
      side: 'right',
      skillId: 54,
      itemId: staffId,
    })
    expect(sentCommands).toContainEqual({
      type: 'SelectSkill',
      hand: 'right',
      skill: 54,
      itemId: staffId,
    })

    // 5. Broken staff (durability = 0) removes charged skill and resets right hand to Attack (0)
    world.containers.applyItemEvent(
      0x06,
      {
        id: staffId,
        itemId: staffId,
        code: 'bst',
        location: 1,
        container: 'equipment',
        bodyLoc: 4,
        equippedSlot: 4,
        quality: 4,
        identified: true,
        broken: true,
        flags: 0x110,
        rawFlags: 0x110,
        durability: 0,
        maxDurability: 35,
        stats: [{ statId: 204, param: packedParam, value: packedValue }],
      } as unknown as ItemData,
      'equipment',
      1,
    )
    model.syncFromWorld()
    expect(
      hud.hotkeys.availableSkills.find((s) => s.skillId === 54 && s.itemId === staffId),
    ).toBeUndefined()
    expect(hud.hotkeys.rightSkillId).toBe(0)
  })

  it('executes full server-client E2E flow: equip Teleport staff -> select -> cast (StatSet 204) -> weapon swap (W) -> charge depletion -> NPC repair', () => {
    const game = new GameInstance({ seed: 424242, areaId: 1 })
    const pid = game.connectPlayer({
      name: 'ChargeHero',
      classId: 3, // Paladin
      level: 30,
      areaId: 1,
    })
    const player = (game as any).players.get(pid)
    expect(player).toBeDefined()
    player.gold = 500000

    // Add a gnarled staff with Level 2 Teleport (2/3 Charges) equipped in primary hand (bodyLoc 4)
    const staffUnitId = 9001
    const packedParam = (54 << 6) | 2
    const initialPackedValue = encodeChargedSkillValue(2, 3)
    const staffItemData = {
      id: staffUnitId,
      itemId: staffUnitId,
      opcode: 0x9c as const,
      action: 0x06,
      category: 0,
      ownerType: 0,
      ownerId: pid,
      flags: 0x10,
      rawFlags: 0x10,
      version: 101,
      location: 1,
      container: 'equipment' as const,
      bodyLoc: 4,
      equippedSlot: 4,
      gridX: 0,
      gridY: 0,
      storePage: 0,
      storagePage: 0,
      worldX: 0,
      worldY: 0,
      x: 0,
      y: 0,
      code: 'cst',
      rawCode: 'cst ',
      compact: false,
      simple: false,
      identified: true,
      socketed: false,
      ethereal: false,
      runeword: false,
      personalized: false,
      isEar: false,
      newItem: false,
      starterItem: false,
      broken: false,
      inSocket: false,
      equipped: true,
      socketedChildCount: 0,
      usedSockets: 0,
      totalSockets: 0,
      ilvl: 35,
      quality: 4 as const,
      graphicIndex: 0,
      durability: 35,
      curDurability: 35,
      maxDurability: 35,
      quantity: 1,
      invWidth: 1,
      invHeight: 3,
      stats: [{ statId: 204, param: packedParam, value: initialPackedValue }],
      setBonusStats: [],
      runewordStats: [],
    }
    player.items.push((game as any).itemDataToServerEntry(staffItemData, pid, 1))
    game.drainEvents(pid)

    const world = new ClientWorld()
    world.self.unitId = pid
    world.self.name = 'ChargeHero'
    world.self.charClass = 3
    world.self.level = 30
    world.containers.applyItemEvent(0x06, staffItemData as unknown as ItemData, 'equipment', pid)

    const hud = new HudManager()
    hud.setCharacterClass('pal')
    const model = new HudModel({
      world,
      hudManager: hud,
      onCommand: (cmd) => game.enqueueCommand(pid, cmd),
    })

    const flushServerToClient = () => {
      game.stepFrame()
      const events = game.drainEvents(pid)
      for (const ev of events) {
        world.applyEvent(ev)
      }
      model.syncFromWorld()
      return events
    }

    model.syncFromWorld()
    expect(
      hud.hotkeys.availableSkills.find((s) => s.skillId === 54 && s.itemId === staffUnitId)?.charges,
    ).toBe(2)

    // 1. Select charged Teleport on right hand
    hud.hotkeys.requestSelect('right', 54, staffUnitId)
    const selectEvents = flushServerToClient()
    expect(selectEvents).toContainEqual({
      type: 'ActiveSkill',
      unitId: pid,
      hand: 'right',
      skill: 54,
      itemId: staffUnitId,
    })
    expect(player.rightSkill).toBe(54)
    expect(player.rightSkillItemId).toBe(staffUnitId)
    expect(world.self.rightSkill).toBe(54)
    expect(world.self.rightSkillItemId).toBe(staffUnitId)

    // 2. Press W (SwapWeapons) -> staff moves to bodyLoc 11, right hand resets to 0, Teleport leaves availableSkills
    game.enqueueCommand(pid, { type: 'SwapWeapons' })
    const swapOutEvents = flushServerToClient()
    expect(swapOutEvents.some((e) => e.type === 'WeaponSwitch')).toBe(true)
    expect(player.rightSkill).toBe(0)
    expect(world.self.rightSkill).toBe(0)
    expect(hud.hotkeys.rightSkillId).toBe(0)
    expect(
      hud.hotkeys.availableSkills.find((s) => s.skillId === 54 && s.itemId === staffUnitId),
    ).toBeUndefined()

    // 3. Press W (SwapWeapons) again -> staff moves back to bodyLoc 4, Teleport returns to availableSkills
    game.enqueueCommand(pid, { type: 'SwapWeapons' })
    flushServerToClient()
    expect(
      hud.hotkeys.availableSkills.find((s) => s.skillId === 54 && s.itemId === staffUnitId)?.charges,
    ).toBe(2)

    // Re-select Teleport on right hand
    hud.hotkeys.requestSelect('right', 54, staffUnitId)
    flushServerToClient()
    expect(player.rightSkill).toBe(54)

    // Move player to Blood Moor (areaId 2) so Teleport (inTown = 0) can be cast
    player.areaId = 2
    const manaBefore = player.manaFixed

    // 4. First cast of charged Teleport: spends 1 charge (2 -> 1), 0 mana, emits StatSet(204, value=1)
    game.enqueueCommand(pid, {
      type: 'CastRightSkillOnLocation',
      x: player.x + 10,
      y: player.y + 10,
    })
    const cast1Events = flushServerToClient()
    expect(player.manaFixed).toBe(manaBefore)
    expect(cast1Events).toContainEqual({
      type: 'StatSet',
      unit: { unitType: 4, id: staffUnitId },
      stat: 204,
      param: packedParam,
      value: 1,
    })
    expect(
      hud.hotkeys.availableSkills.find((s) => s.skillId === 54 && s.itemId === staffUnitId)?.charges,
    ).toBe(1)
    expect(player.rightSkill).toBe(54)

    // 5. Second cast of charged Teleport: spends last charge (1 -> 0), auto-resets rightSkill to 0 (Attack)
    game.enqueueCommand(pid, {
      type: 'CastRightSkillOnLocation',
      x: player.x + 15,
      y: player.y + 15,
    })
    const cast2Events = flushServerToClient()
    expect(cast2Events).toContainEqual({
      type: 'StatSet',
      unit: { unitType: 4, id: staffUnitId },
      stat: 204,
      param: packedParam,
      value: 0,
    })
    expect(cast2Events).toContainEqual({
      type: 'ActiveSkill',
      unitId: pid,
      hand: 'right',
      skill: 0,
      itemId: 0xffffffff,
    })
    expect(player.rightSkill).toBe(0)
    expect(world.self.rightSkill).toBe(0)
    expect(hud.hotkeys.rightSkillId).toBe(0)

    // 6. Repair at Charsi in Rogue Encampment refills charges back to 3/3
    player.areaId = 1
    const charsiId = game.spawnMonster({
      hcIdx: 154,
      x: Math.round(player.x),
      y: Math.round(player.y),
      areaId: 1,
      isNpc: true,
      isVendor: true,
    })
    game.enqueueCommand(pid, {
      type: 'NpcRepairItem',
      npcId: charsiId,
      itemId: staffUnitId,
      itemMode: 1,
      durability: 35,
    })
    game.stepFrame()
    const repairEvents = flushServerToClient()
    expect(repairEvents).toContainEqual({
      type: 'StatSet',
      unit: { unitType: 4, id: staffUnitId },
      stat: 204,
      param: packedParam,
      value: 3,
    })
    const repairedEntry = player.items.find((i: any) => i.unitId === staffUnitId)!
    const decodedAfterRepair = decodeStat204ChargedSkill113c(
      repairedEntry.rawItemData.stats[0],
      repairedEntry.level,
    )
    expect(decodedAfterRepair).toMatchObject({
      skillId: 54,
      level: 2,
      slvl: 2,
      charges: 3,
      maxCharges: 3,
      param: packedParam,
    })
    expect(world.self.skillCharges?.get(54)).toBe(3)
    expect(
      hud.hotkeys.availableSkills.find((s) => s.skillId === 54 && s.itemId === staffUnitId)?.charges,
    ).toBe(3)
  })
})
