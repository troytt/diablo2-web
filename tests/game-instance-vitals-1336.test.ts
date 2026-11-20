/**
 * Issue #1336 — server-side 1.13c stamina drain/recovery and life/mana regeneration.
 *
 * The authoritative GameInstance must step the same per-frame vitals the client HUD sees:
 * running drains stamina, walking/idle recovers it, mana regenerates over CharStats
 * `ManaRegen` seconds, and life regenerates from `maxhp/65536` + `hpregen`.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../src/server/engine/game-instance.ts'

interface MutablePlayer {
  maxStaminaFixed: number
  staminaFixed: number
  stamina: number
  maxStamina: number
  staminaExhausted: boolean
  items: any[]
  maxManaFixed: number
  manaFixed: number
  mana: number
  maxMana: number
  maxHpFixed: number
  hpFixed: number
  hp: number
  maxHp: number
  run: boolean
  targetX: number
  targetY: number
}

function playerRecord(game: GameInstance, id: number): MutablePlayer {
  return (game as unknown as { players: Map<number, MutablePlayer> }).players.get(id)!
}

// Outdoors (Blood Moor): 1.13c never drains stamina while running in town (D2Game 0x6FC97BB0).
function makeRunner(areaId = 2): { game: GameInstance; id: number; record: MutablePlayer } {
  const game = new GameInstance({ seed: 1336, difficulty: 0, areaId })
  const id = game.connectPlayer({ charClass: 'bar', name: 'Runner', x: 100, y: 100, areaId })
  game.drainEvents(id)
  const record = playerRecord(game, id)
  record.maxStaminaFixed = 200 * 256
  record.staminaFixed = 200 * 256
  record.stamina = 200
  record.maxStamina = 200
  record.maxManaFixed = 500 * 256
  record.manaFixed = 0
  record.mana = 0
  record.maxMana = 500
  record.maxHpFixed = 1000 * 256
  record.hpFixed = 500 * 256
  record.hp = 500
  record.maxHp = 1000
  return { game, id, record }
}

describe('issue #1336: server player vitals', () => {
  it('drains stamina while running and regenerates life/mana every tick', () => {
    const { game, id, record } = makeRunner()
    record.items.push({
      unitId: 9000,
      code: 'rin',
      name: 'rin',
      quality: 0,
      level: 1,
      location: 'equipped',
      bodyLoc: 6,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      areaId: 1,
      ownerId: id,
      storePage: 0,
      cost: 0,
      gamble: false,
      identified: true,
      ethereal: false,
      socketed: false,
      totalSockets: 0,
      durability: 10,
      maxDurability: 10,
      quantity: 1,
      stats: new Map([[74, 10]]),
      socketedItems: [],
    })
    game.enqueueCommand(id, { type: 'Move', to: { x: 300, y: 100 }, run: true })
    game.stepFrames(100)

    const after = game.getPlayerState(id)!
    expect(after.stamina).toBeLessThan(200)
    expect(after.mana).toBeGreaterThan(0)
    expect(after.hp).toBeGreaterThan(500)
  })

  it('does not drain stamina while running in town (D2Game 0x6FC97BB0 DUNGEON_IsRoomInTown)', () => {
    const { game, id, record } = makeRunner(1)
    game.enqueueCommand(id, { type: 'Move', to: { x: 140, y: 100 }, run: true })
    game.stepFrames(20)
    expect(record.staminaFixed).toBe(200 * 256)
  })

  it('recovers stamina when walking/idle after the run stops', () => {
    const { game, id } = makeRunner()
    game.enqueueCommand(id, { type: 'Move', to: { x: 140, y: 100 }, run: true })
    game.stepFrames(40)
    const drained = game.getPlayerState(id)!.stamina
    expect(drained).toBeLessThan(200)

    game.stepFrames(100)
    expect(game.getPlayerState(id)!.stamina).toBeGreaterThan(drained)
  })

  it('adds chest/shield Armor.txt speed to the run drain', () => {
    const runWith = (armorCode?: string): number => {
      const { game, id, record } = makeRunner()
      if (armorCode !== undefined) {
        record.items.push({
          unitId: 9001,
          code: armorCode,
          name: armorCode,
          quality: 0,
          level: 1,
          location: 'equipped',
          bodyLoc: 3,
          x: 0,
          y: 0,
          width: 2,
          height: 2,
          areaId: 1,
          ownerId: id,
          storePage: 0,
          cost: 0,
          gamble: false,
          identified: true,
          ethereal: false,
          socketed: false,
          totalSockets: 0,
          durability: 10,
          maxDurability: 10,
          quantity: 1,
          stats: new Map(),
          socketedItems: [],
        })
      }
      game.enqueueCommand(id, { type: 'Move', to: { x: 300, y: 100 }, run: true })
      game.stepFrames(10)
      return record.staminaFixed
    }
    expect(runWith('plt')).toBeLessThan(runWith())
  })

  it('recovers at full rate (S=8) while standing in town or outdoors, and half rate (S=9) while walking (#1632)', () => {
    const standingGain = (areaId: number): number => {
      const game = new GameInstance({ seed: 1336, difficulty: 0, areaId })
      const id = game.connectPlayer({ charClass: 'bar', name: 'Stand', x: 100, y: 100, areaId })
      const record = playerRecord(game, id)
      record.maxStaminaFixed = 200 * 256
      record.staminaFixed = 100 * 256
      record.stamina = 100
      record.maxStamina = 200
      game.stepFrames(10)
      return record.staminaFixed - 100 * 256
    }
    expect(standingGain(1)).toBe(standingGain(2))
    expect(standingGain(2)).toBe(10 * ((200 * 256) >> 8))
  })

  it('recovers stamina at half rate (S=9) while walking outdoors above 1 stamina, and 0 when exhausted (#1632)', () => {
    const game = new GameInstance({ seed: 1336, difficulty: 0, areaId: 2 })
    const id = game.connectPlayer({ charClass: 'bar', name: 'Walk', x: 100, y: 100, areaId: 2 })
    const record = playerRecord(game, id)
    record.maxStaminaFixed = 200 * 256
    record.staminaFixed = 100 * 256
    record.stamina = 100
    record.maxStamina = 200
    game.enqueueCommand(id, { type: 'Move', to: { x: 140, y: 100 }, run: false })
    game.stepFrames(10)
    expect(record.staminaFixed).toBe(100 * 256 + 10 * ((200 * 256) >> 9))

    // When staminaFixed < 256 and exhausted outdoors, walking does not recover stamina.
    record.staminaFixed = 128
    record.staminaExhausted = true
    game.enqueueCommand(id, { type: 'Move', to: { x: 180, y: 100 }, run: false })
    game.stepFrames(10)
    expect(record.staminaFixed).toBe(128)
  })

  it('locks running until stamina recovers to the 25% threshold', () => {
    const { game, record } = makeRunner()
    record.staminaFixed = 0
    record.stamina = 0
    record.staminaExhausted = true
    record.run = true
    game.stepFrames(1)
    expect(record.staminaExhausted).toBe(true)
    expect(record.run).toBe(false)
    expect(record.stamina).toBe(0)
    game.stepFrames(65)
    expect(record.staminaExhausted).toBe(false)
    expect(record.stamina).toBeGreaterThanOrEqual(50)
  })

  it('uses Holy Freeze slowPct instead of a hardcoded 50', () => {
    const { game, record } = makeRunner()
    const internal = game as unknown as {
      playerCombatContext: (p: unknown) => {
        stateBus: { applyState: (s: { stateNameOrId: string; slvl: number; durationFrames: number }) => void }
      }
      getPlayerMotion: (p: unknown) => { mover: { slowPercent?: number } }
      applyPlayerVelocityModifiers: (p: unknown, mover: unknown) => void
    }
    // Caster's own Holy Freeze aura state (`holywind` #43) must not slow the caster (#1409).
    internal.playerCombatContext(record).stateBus.applyState({
      stateNameOrId: 'holywind',
      slvl: 1,
      durationFrames: 100,
    })
    const motion = internal.getPlayerMotion(record)
    internal.applyPlayerVelocityModifiers(record, motion.mover)
    expect(motion.mover.slowPercent).toBe(0)
    // Enemy Holy Freeze target state `holywindcold` (#44) applies dm34(25,60) slow.
    internal.playerCombatContext(record).stateBus.applyState({
      stateNameOrId: 'holywindcold',
      slvl: 1,
      durationFrames: 100,
    })
    internal.applyPlayerVelocityModifiers(record, motion.mover)
    expect(motion.mover.slowPercent).toBe(30)
  })
})