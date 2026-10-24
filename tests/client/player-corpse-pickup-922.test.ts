/**
 * Issue #922: after dying outdoors and resurrecting in town, walking back to the death spot the player could not
 * hover or click their own corpse.
 *
 * 1.13c ground truth:
 * - D2Game `D2GAME_CORPSE_Handler_6FC7FBD0` allocates the body as a NEW `UNIT_PLAYER` (new GUID, owner's class and
 *   name, `PLRMODE_DEAD`, `STATE_PLAYERBODY`, `UNITFLAG_TARGETABLE`, `UNITFLAG_CANBEATTACKED` cleared). A client that
 *   sees the body's room gets `S2C 0x59 AssignPlayer` (body GUID / class / owner name / x, y), the mode-17 send
 *   `S2C 0x0D` (`stru_6FD30708[17]` = code 0x09, life %), then `S2C 0x74` (assign, owner GUID, body GUID)
 *   (`D2GAME_SUNITMSG_FirstFn_6FCC5520`).
 * - D2Client HoverUpdate `0x6fb01e80` only skips the local player unit itself (`cmp ebp, ebx` @0x6fb01fd7); it has no
 *   party / hostility filter, and a dead player gets the `+1` hover priority (`0x6fb55440` @0x6fb02075).
 * - D2Client click router `0x6facb7f0`: a non-attackable unit (the body has no `UNITFLAG_CANBEATTACKED`) that is not
 *   a monster goes to the interact handler `0x6facab20` (@0x6facbb55) whatever the left skill is; its player case
 *   `0x6facadba` sends `C2S 0x13` (unit type 0, body GUID) at `#10407 <= 4`, else walks and queues the `0x13`.
 * - D2Game `C2S 0x13` -> `sub_6FC828D0` player case: a `PLRMODE_DEAD` target within 8 is picked up
 *   (`sub_6FC80440`), farther (<= 50) the server walks the player there first.
 */
import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { CommandMapper, ViewportCamera } from '../../src/client/input/command-mapper.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { decodeD2gsS2cPacket, encodeD2gsC2sCommand } from '../../src/netproto/d2gs/registry.ts'

import type { ClientCommand } from '../../src/netproto/domain/client-command.ts'

const SELF_ID = 0x11
const CORPSE_ID = 0x2a
const RIVER_OF_FLAME = 107

function u16(v: number): number[] {
  return [v & 0xff, (v >>> 8) & 0xff]
}
function u32(v: number): number[] {
  return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]
}
function name16(name: string): number[] {
  const out = new Array<number>(16).fill(0)
  for (let i = 0; i < name.length && i < 15; i++) out[i] = name.charCodeAt(i)
  return out
}
/** S2C 0x59 AssignPlayer (26B): id u32 | class u8 | name[16] | x u16 | y u16 */
function pkt59(id: number, classId: number, name: string, x: number, y: number): Uint8Array {
  return Uint8Array.from([0x59, ...u32(id), classId, ...name16(name), ...u16(x), ...u16(y)])
}
/** S2C 0x0D PlayerStop (13B): type u8 | id u32 | code u8 | x u16 | y u16 | hitclass u8 | life% u8 */
function pkt0D(id: number, code: number, x: number, y: number, lifePct: number): Uint8Array {
  return Uint8Array.from([0x0d, 0, ...u32(id), code, ...u16(x), ...u16(y), 0, lifePct])
}
/** S2C 0x74 PlayerCorpseAssign (10B): assign u8 | owner u32 | corpse u32 */
function pkt74(assign: number, ownerId: number, corpseId: number): Uint8Array {
  return Uint8Array.from([0x74, assign, ...u32(ownerId), ...u32(corpseId)])
}

function setup(leftSkill: number) {
  const world = new ClientWorld()
  world.apply({ type: 'LoadAct', act: 3, mapSeed: 1, areaId: RIVER_OF_FLAME } as any)
  world.apply(decodeD2gsS2cPacket(Uint8Array.from([0x0b, 0, ...u32(SELF_ID)])))
  world.apply(decodeD2gsS2cPacket(pkt59(SELF_ID, 0, 'Amazona', 5000, 5000)))
  // The body lies a few sub-tiles away (D2GAME_SUNITMSG_FirstFn_6FCC5520 order: 0x59, mode send, 0x74).
  world.apply(decodeD2gsS2cPacket(pkt59(CORPSE_ID, 0, 'Amazona', 5003, 5001)))
  world.apply(decodeD2gsS2cPacket(pkt0D(CORPSE_ID, 0x09, 5003, 5001, 0)))
  world.apply(decodeD2gsS2cPacket(pkt74(1, SELF_ID, CORPSE_ID)))
  world.self.leftSkill = leftSkill
  world.self.rightSkill = 0
  const camera = new ViewportCamera()
  const hudModel = new HudModel({ world } as any)
  const sent: ClientCommand[] = []
  const mapper = new CommandMapper({ world, camera, hudModel, sendCommand: (c: ClientCommand) => { sent.push(c) } })
  camera.update(world.self.x, world.self.y)
  return { world, camera, mapper, sent }
}

describe('Issue #922: own player corpse is hoverable and clickable (1.13c)', () => {
  it('the body arrives as a separate dead player unit owned by self', () => {
    const { world } = setup(0)
    expect(world.areaId).toBe(RIVER_OF_FLAME)
    expect(world.selfId).toBe(SELF_ID)
    const corpse = world.getUnit('player', CORPSE_ID)
    expect(corpse).toBeDefined()
    expect(corpse!.dead).toBe(true)
    expect(corpse!.mode).toBe(17)
    expect(world.corpses.get(CORPSE_ID)).toBe(SELF_ID)
  })

  for (const leftSkill of [0, 10 /* Jab */]) {
    it(`hovers the body and left-click sends C2S 0x13 interact (left skill ${leftSkill})`, () => {
      const { world, camera, mapper, sent } = setup(leftSkill)
      const corpse = world.getUnit('player', CORPSE_ID)!
      const p = camera.subtileToScreen(corpse.x, corpse.y)
      const hovered = mapper.findUnitAtScreenPoint(p.x, p.y - 8)
      expect(hovered?.unitType).toBe('player')
      expect(hovered?.id).toBe(CORPSE_ID)

      mapper.triggerPrimaryWorldAction(corpse.x, corpse.y, hovered, 1000)
      const interact = sent.find(c => c.type === 'Interact')
      expect(interact).toBeDefined()
      expect((interact as { target: { unitType: number; id: number } }).target).toEqual({ unitType: 0, id: CORPSE_ID })
      expect(sent.some(c => c.type === 'SkillOn' || c.type === 'SkillAt')).toBe(false)
      const wire = encodeD2gsC2sCommand(interact!)
      expect(Array.from(wire)).toEqual([0x13, ...u32(0), ...u32(CORPSE_ID)])
    })
  }

  it("keeps the body hoverable even when the owner is flagged non-hostile in the party roster", () => {
    const { world, camera, mapper } = setup(10)
    const corpse = world.getUnit("player", CORPSE_ID)!
    ;(corpse as { hostile?: boolean }).hostile = false
    const p = camera.subtileToScreen(corpse.x, corpse.y)
    expect(mapper.findUnitAtScreenPoint(p.x, p.y - 8)?.id).toBe(CORPSE_ID)
    expect(mapper.pickUnitAtSubtile(corpse.x, corpse.y, 2.5)?.id).toBe(CORPSE_ID)
  })

  it("never casts a skill on the body (not attackable)", () => {
    const { world, mapper } = setup(10)
    const corpse = world.getUnit("player", CORPSE_ID)!
    for (const skill of [0, 10, 52, 101]) expect(mapper.isValidSkillTargetUnit(corpse, skill)).toBe(false)
  })

  it("does not prune the body as a stale corpse while it is within the active window", () => {
    const { world } = setup(0)
    const corpse = world.getUnit("player", CORPSE_ID)!
    world.pruneStaleUnitsOutsideArea(corpse.x + 100, corpse.y)
    expect(world.getUnit("player", CORPSE_ID)).toBeDefined()
  })
})
