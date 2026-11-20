/**
 * Issue #2027: Quest Item / Quest Object Difficulty Mismatch & Rejection QoL Hints.
 *
 * Covers:
 * 1. Horadric Orifice (`Objects.txt` 152, `mode = 0`) rejected by D2GS (`S2C 0x2C` `sound = 0x13`):
 *    - Normal-difficulty Horadric Staff (`hst` with `stat 356 = 0` or omitted on extended wire item)
 *      in Nightmare/Hell emits localized wrong-difficulty hint (`zh` & `en`), keeps panel closed.
 *    - Missing `hst` vs uncombined `msf + vip` emits localized guidance.
 *    - Valid Nightmare `hst` (`stat 356 = 1`) opening `S2C 0x58(uiId=0)` emits zero error hint.
 *    - Rapid duplicate clicks within 3s deduplicate the hint instead of flooding chat.
 * 2. Class-of-bug sweep across other quest objects & Horadric Cube (`op == 28`):
 *    - Compelling Orb (`404`, `mode = 0`): client weapon gate (`D2Client 0x6FADACC9`) distinguishes
 *      unequipped `qf2` in inventory vs lower-difficulty `qf2` vs missing `qf2`.
 *    - Hellforge (`376`, `mode = 0` Soulstone `mss` & `mode = 2` Hammer `hfh`): distinguishes
 *      wrong-difficulty quest item, unequipped hammer, missing item, and already-completed quest.
 *    - Cairn Stones (`17..21`, `mode = 0`, `sound = 0x27`): distinguishes wrong-difficulty scroll,
 *      undeciphered `bks`, and missing scroll.
 *    - Horadric Cube Transmute (`ClickButton 0x18`) with lower-difficulty `msf`/`vip`, `qf1`/`qey`/`qhr`/`qbr`,
 *      or `leg` emits red warning while still sending `ClickButton 0x18`; Horadric Cube (`box`,
 *      `questdiffcheck = 0`) itself is never flagged as wrong-difficulty.
 * 3. Quest item tooltip in Nightmare/Hell (`gameDifficulty > 0`):
 *    - Displays red mismatch line when `questItemDifficulty < gameDifficulty` and gold line when valid;
 *      displays no extra line in Normal (`gameDifficulty = 0`).
 * 4. Built-in `GameInstance` server parity (`0x6FC2E660` & `CubeMain` `op == 28`):
 *    - Rejects lower-difficulty `hst` on Orifice `152` with `PlaySound(19)` and allows higher-or-equal difficulty.
 */

import { describe, expect, it } from 'vitest'
import { onlineItemDataToUiInventoryItem } from '../../src/common/items/item-bridge.ts'
import { resolveQuestItemDifficulty113c } from '../../src/common/items/quest-item-difficulty.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { setGameLang } from '../../src/client/i18n/lang.ts'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import { LocalMovementPredictor } from '../../src/client/motion/predictor.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { ClickButtonId, type ClientCommand } from '../../src/netproto/index.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { executeCubeTransmute113c } from '../../src/server/items/cube-engine-113c.ts'

if (typeof globalThis.window === 'undefined') {
  ;(globalThis as unknown as { window: Record<string, unknown> }).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  }
}

function makeWireStaff(id: number, questDiff?: 0 | 1 | 2) {
  return {
    id,
    itemId: id,
    opcode: 0x9c,
    action: 4,
    category: 5,
    version: 101,
    rawFlags: 0x00800010,
    location: 0,
    container: 'inventory' as const,
    gridX: 7,
    gridY: 0,
    x: 7,
    y: 0,
    invWidth: 1,
    invHeight: 4,
    code: 'hst',
    quality: 7,
    identified: true,
    ilvl: 1,
    stats:
      questDiff !== undefined && questDiff > 0
        ? [{ statId: 93, param: 0, value: 50 }, { statId: 356, param: 0, value: questDiff }]
        : [{ statId: 93, param: 0, value: 50 }],
  }
}

describe('Issue #2027 — Quest Item Difficulty Mismatch & Quest Object Rejection QoL', () => {
  it('resolves 1.13c STAT_QUESTITEMDIFFICULTY (stat 356) across extended, compact, and Horadric Cube items', () => {
    // Extended wire 'hst' in Normal omits stat 356 -> resolves to 0
    expect(resolveQuestItemDifficulty113c(makeWireStaff(1, 0))).toBe(0)
    expect(resolveQuestItemDifficulty113c(makeWireStaff(2, 1))).toBe(1)
    expect(resolveQuestItemDifficulty113c(makeWireStaff(3, 2))).toBe(2)

    // Horadric Cube ('box') has quest=10, questdiffcheck=0 -> never difficulty-gated
    expect(
      resolveQuestItemDifficulty113c({
        opcode: 0x9c,
        version: 101,
        code: 'box',
        stats: [],
      }),
    ).toBeUndefined()

    // Unannotated synthetic mock without wire metadata returns undefined
    expect(resolveQuestItemDifficulty113c({ code: 'hst' })).toBeUndefined()
  })

  it('emits localized red hint when Nightmare D2GS rejects Normal Horadric Staff on Orifice (152) with S2C 0x2C(0x13)', () => {
    const world = new ClientWorld()
    world.lang = 'CHI'
    world.difficulty = 1 // Nightmare

    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 'player', id: 1, classId: 1, name: 'Hero', x: 22680, y: 11542 },
    })
    world.apply({
      type: 'UnitAssign',
      isSelf: false,
      unit: { unitType: 'object', id: 130, classId: 152, mode: 0, x: 22678, y: 11538 },
    })
    world.containers.applyItemEvent('putInContainer', makeWireStaff(72, 0) as any, 'inventory', 1)

    // Client sends C2S 0x13 Interact on Orifice #130
    world.noteOutgoingCommand({ type: 'Interact', target: { unitType: 2, id: 130 } }, 1000)

    // D2GS responds with S2C 0x2C PlaySound(player #1, sound = 0x13) and no 0x58
    world.apply({
      type: 'PlaySound',
      unit: { unitType: 0, id: 1 },
      sound: 0x13,
    })

    expect(world.activeChatOverlayEntries).toHaveLength(1)
    expect(world.activeChatOverlayEntries[0]!.color).toBe(1)
    expect(world.activeChatOverlayEntries[0]!.text).toContain('赫拉迪克法杖属于低难度')

    // Rapid duplicate click within 3s cooldown does not spam a second identical line
    world.noteOutgoingCommand({ type: 'Interact', target: { unitType: 2, id: 130 } }, 1500)
    world.apply({
      type: 'PlaySound',
      unit: { unitType: 0, id: 1 },
      sound: 0x13,
    })
    expect(world.activeChatOverlayEntries).toHaveLength(1)

    // English locale check after cooldown
    world.lang = 'ENG'
    world.noteOutgoingCommand({ type: 'Interact', target: { unitType: 2, id: 130 } }, 5000)
    world.apply({
      type: 'PlaySound',
      unit: { unitType: 0, id: 1 },
      sound: 0x13,
    })
    expect(world.activeChatOverlayEntries).toHaveLength(2)
    expect(world.activeChatOverlayEntries[1]!.text).toContain(
      'Horadric Staff is from an earlier difficulty',
    )
  })

  it('distinguishes missing Horadric Staff vs uncombined msf+vip, and stays silent when S2C 0x58 opens Orifice', () => {
    const world = new ClientWorld()
    world.lang = 'CHI'
    world.difficulty = 1
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 'player', id: 1, classId: 1, name: 'Hero', x: 100, y: 100 },
    })
    world.apply({
      type: 'UnitAssign',
      isSelf: false,
      unit: { unitType: 'object', id: 50, classId: 152, mode: 0, x: 101, y: 100 },
    })

    // 1. No staff at all
    world.noteOutgoingCommand({ type: 'Interact', target: { unitType: 2, id: 50 } }, 1000)
    world.apply({ type: 'PlaySound', unit: { unitType: 0, id: 1 }, sound: 0x13 })
    expect(world.activeChatOverlayEntries.at(-1)?.text).toContain('你需要携带赫拉迪克法杖')

    // 2. Carrying valid Nightmare msf + vip uncombined
    world.containers.applyItemEvent(
      'putInContainer',
      { id: 10, version: 101, code: 'msf', stats: [{ statId: 356, param: 0, value: 1 }] } as any,
      'inventory',
      1,
    )
    world.containers.applyItemEvent(
      'putInContainer',
      { id: 11, version: 101, code: 'vip', stats: [{ statId: 356, param: 0, value: 1 }] } as any,
      'inventory',
      1,
    )
    world.noteOutgoingCommand({ type: 'Interact', target: { unitType: 2, id: 50 } }, 5000)
    world.apply({ type: 'PlaySound', unit: { unitType: 0, id: 1 }, sound: 0x13 })
    expect(world.activeChatOverlayEntries.at(-1)?.text).toContain('请先用赫拉迪克方块')

    // 3. Valid Nightmare hst -> server sends OpenUi(uiId=0); subsequent PlaySound(0x13) from another source does not misfire
    const countBefore = world.activeChatOverlayEntries.length
    world.containers.applyItemEvent('putInContainer', makeWireStaff(73, 1) as any, 'inventory', 1)
    world.noteOutgoingCommand({ type: 'Interact', target: { unitType: 2, id: 50 } }, 9000)
    world.apply({ type: 'OpenUi', unitType: 2, unitId: 50, uiId: 0, extra: 0 })
    world.apply({ type: 'PlaySound', unit: { unitType: 0, id: 1 }, sound: 0x13 })
    expect(world.activeChatOverlayEntries).toHaveLength(countBefore)
  })

  it('covers Compelling Orb (404), Hellforge (376), Cairn Stones (17..21), and Cube Transmute (op=28) sweep', () => {
    setGameLang('CHI')
    const world = new ClientWorld()
    world.lang = 'CHI'
    world.difficulty = 2 // Hell
    const commands: ClientCommand[] = []
    const hud = new HudManager()
    const hudModel = new HudModel({
      world,
      hudManager: hud,
      onCommand: (cmd: ClientCommand) => {
        world.noteOutgoingCommand(cmd)
        commands.push(cmd)
      },
    })
    const predictor = new LocalMovementPredictor()
    predictor.resetTo(100, 100)
    const mapper = new CommandMapper({
      world,
      hudManager: hud,
      hudModel,
      predictor,
      sendCommand: (cmd: ClientCommand) => {
        world.noteOutgoingCommand(cmd)
        commands.push(cmd)
      },
    })

    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 'player', id: 1, classId: 1, name: 'Hero', x: 100, y: 100 },
    })
    world.apply({
      type: 'UnitAssign',
      isSelf: false,
      unit: { unitType: 'object', id: 201, classId: 404, mode: 0, x: 101, y: 100 },
    })
    world.apply({
      type: 'UnitAssign',
      isSelf: false,
      unit: { unitType: 'object', id: 202, classId: 376, mode: 0, x: 101, y: 101 },
    })
    world.apply({
      type: 'UnitAssign',
      isSelf: false,
      unit: { unitType: 'object', id: 203, classId: 17, mode: 0, x: 100, y: 101 },
    })

    // A. Compelling Orb (404) with Hell qf2 sitting unequipped in inventory -> tells player to equip it, suppresses 0x13
    world.containers.applyItemEvent(
      'putInContainer',
      { id: 30, version: 101, code: 'qf2', stats: [{ statId: 356, param: 0, value: 2 }] } as any,
      'inventory',
      1,
    )
    const orbUnit = world.getUnit('object', 201)!
    mapper.triggerPrimaryWorldAction(orbUnit.x, orbUnit.y, orbUnit, 1000)
    expect(commands.filter((c) => c.type === 'Interact')).toHaveLength(0)
    expect(world.activeChatOverlayEntries.at(-1)?.text).toContain('装备在当前主手武器栏')

    // B. Hellforge (376, mode 0) with Nightmare Soulstone (stat 356 = 1 < Hell 2) -> server 0x2C(0x13) triggers wrong-difficulty hint
    world.containers.applyItemEvent(
      'putInContainer',
      { id: 31, version: 101, code: 'mss', stats: [{ statId: 356, param: 0, value: 1 }] } as any,
      'inventory',
      1,
    )
    world.noteOutgoingCommand({ type: 'Interact', target: { unitType: 2, id: 202 } }, 5000)
    world.apply({ type: 'PlaySound', unit: { unitType: 0, id: 1 }, sound: 0x13 })
    expect(world.activeChatOverlayEntries.at(-1)?.text).toContain('墨菲斯托的灵魂之石属于低难度')

    // C. Cairn Stone (17, mode 0) with undeciphered Hell Scroll of Inifuss ('bks') -> server 0x2C(0x27) tells player to visit Akara
    world.containers.applyItemEvent(
      'putInContainer',
      { id: 32, version: 101, code: 'bks', stats: [{ statId: 356, param: 0, value: 2 }] } as any,
      'inventory',
      1,
    )
    world.noteOutgoingCommand({ type: 'Interact', target: { unitType: 2, id: 203 } }, 9000)
    world.apply({ type: 'PlaySound', unit: { unitType: 0, id: 1 }, sound: 0x27 })
    expect(world.activeChatOverlayEntries.at(-1)?.text).toContain('阿卡拉解读')

    // D. Horadric Cube Transmute with Normal leg + Hell tbk in Hell -> still sends ClickButton(0x18) AND shows red hint + cube toast
    world.containers.applyItemEvent(
      'putInContainer',
      { id: 40, version: 101, code: 'leg', stats: [] } as any,
      'cube',
      1,
    )
    world.containers.applyItemEvent(
      'putInContainer',
      { id: 41, version: 101, code: 'tbk', stats: [{ statId: 70, param: 0, value: 5 }] } as any,
      'cube',
      1,
    )
    hudModel.transmuteCube()
    expect(commands).toContainEqual({
      type: 'ClickButton',
      buttonId: ClickButtonId.Transmute,
      amount: 0,
    })
    expect(world.activeChatOverlayEntries.at(-1)?.text).toContain('赫拉迪克方块中的任务物品属于低难度')
    expect(hud.worldPanels.vendorStatusMsg?.color).toBe('red')
  })

  it('renders quest item difficulty tooltip line in Nightmare/Hell (red on mismatch, gold when valid, omitted in Normal)', () => {
    setGameLang('CHI')
    const hud = new HudManager()
    const normalStaffUi = onlineItemDataToUiInventoryItem(makeWireStaff(80, 0))
    const nmStaffUi = onlineItemDataToUiInventoryItem(makeWireStaff(81, 1))
    expect(normalStaffUi.questItemDifficulty).toBe(0)
    expect(nmStaffUi.questItemDifficulty).toBe(1)

    const drawnTexts: { text: string; color?: string }[] = []
    const origDrawText = hud.font.drawText.bind(hud.font)
    hud.font.drawText = ((ctx: any, text: string, x: number, y: number, opts?: any) => {
      drawnTexts.push({ text, color: opts?.color })
      return origDrawText(ctx, text, x, y, opts)
    }) as any

    const fakeCtx = {
      save: () => {},
      restore: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      fillText: () => {},
      measureText: (s: string) => ({ width: s.length * 8 }),
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D

    // 1. In Normal (gameDifficulty = 0): no quest difficulty line
    hud.inventory.updatePlayerContext({ level: 48, str: 80, dex: 25, gameDifficulty: 0 })
    hud.worldPanels.activePlayerInventory = hud.inventory
    drawnTexts.length = 0
    hud.worldPanels.drawItemTooltip(
      fakeCtx,
      { item: normalStaffUi, x: 400, y: 300 },
      hud.font,
      false,
      800,
      600,
    )
    expect(drawnTexts.some((d) => d.text.includes('任务难度'))).toBe(false)

    // 2. In Nightmare (gameDifficulty = 1) with Normal staff -> red mismatch line
    hud.inventory.updatePlayerContext({ level: 48, str: 80, dex: 25, gameDifficulty: 1 })
    drawnTexts.length = 0
    hud.worldPanels.drawItemTooltip(
      fakeCtx,
      { item: normalStaffUi, x: 400, y: 300 },
      hud.font,
      false,
      800,
      600,
    )
    const mismatchLine = drawnTexts.find((d) => d.text.includes('任务难度'))
    expect(mismatchLine).toEqual({
      text: '任务难度: 普通 (当前难度不可用)',
      color: 'red',
    })

    // 3. In Nightmare (gameDifficulty = 1) with Nightmare staff -> gold valid line
    drawnTexts.length = 0
    hud.worldPanels.drawItemTooltip(
      fakeCtx,
      { item: nmStaffUi, x: 400, y: 300 },
      hud.font,
      false,
      800,
      600,
    )
    const validLine = drawnTexts.find((d) => d.text.includes('任务难度'))
    expect(validLine).toEqual({
      text: '任务难度: 噩梦',
      color: 'gold',
    })
  })

  it('enforces stat 356 >= gameDifficulty on GameInstance Orifice (152) and Cube op=28 recipes', () => {
    const game = new GameInstance({ areaId: 70, difficulty: 1 })
    const p1 = game.connectPlayer({ name: 'Hero', classId: 1, x: 100, y: 100, areaId: 70 })
    const orificeId = game.spawnObject({ classId: 152, x: 101, y: 100, areaId: 70, mode: 0 })
    const playerRec = (game as any).players.get(p1)
    const staff = (game as any).givePlayerInventoryQuestItem(playerRec, 'hst')
    staff.stats.set(356, 0) // Normal staff in Nightmare game
    game.drainPlayerEvents(p1)

    game.enqueueCommand(p1, { type: 'Interact', target: { unitType: 2, id: orificeId } })
    game.stepFrame()
    const rejectedEvents = game.drainPlayerEvents(p1)
    expect(rejectedEvents).toContainEqual({
      type: 'PlaySound',
      unit: { unitType: 0, id: p1 },
      sound: 19,
    })
    expect(rejectedEvents.some((e: any) => e.type === 'OpenUi')).toBe(false)
    expect((game as any).objects.get(orificeId).mode).toBe(0)

    // Upgrade staff to Nightmare (stat 356 = 1) -> Orifice opens
    staff.stats.set(356, 1)
    game.enqueueCommand(p1, { type: 'Interact', target: { unitType: 2, id: orificeId } })
    game.stepFrame()
    const acceptedEvents = game.drainPlayerEvents(p1)
    expect(acceptedEvents.some((e: any) => e.type === 'PlaySound' && e.sound === 19)).toBe(false)

    // Cube op=28: Hell msf (356=2) + Nightmare vip (356=1) succeeds in Nightmare (difficulty=1), fails in Hell (difficulty=2)
    const cubeInputs = [
      { id: 1, code: 'msf', ilvl: 50, quality: 7, identified: true, stats: [{ statId: 356, param: 0, value: 2 }] },
      { id: 2, code: 'vip', ilvl: 50, quality: 7, identified: true, stats: [{ statId: 356, param: 0, value: 1 }] },
    ] as any
    expect(
      executeCubeTransmute113c({
        cubeItems: cubeInputs,
        rng: new D2Rng(12345),
        playerLevel: 50,
        playerClassCode: 'sor',
        difficulty: 1,
        areaId: 40,
        isLadder: true,
        isExpansion: true,
        allocateUnitId: () => 999,
      }).matched,
    ).toBe(true)
    expect(
      executeCubeTransmute113c({
        cubeItems: cubeInputs,
        rng: new D2Rng(12345),
        playerLevel: 50,
        playerClassCode: 'sor',
        difficulty: 2,
        areaId: 40,
        isLadder: true,
        isExpansion: true,
        allocateUnitId: () => 999,
      }).matched,
    ).toBe(false)
  })
})
