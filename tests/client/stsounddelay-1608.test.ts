/**
 * #1608 — stsounddelay start sound: max(0, (frames[hitClass] * 256 + 128) / animSpeed - 3) frames (D2Client.dll
 * 0x6FB5209C..0x6FB520CC, 0x6FAD2220, table 0x6FBA5538), not the flag value 1.
 */

import { describe, expect, it } from 'vitest'
import {
  HIT_CLASS_SOUND_TABLE_0x6FBA5538,
  hitClassIndex113c,
  resolvePlayerHitClassIndex113c,
  stSoundDelayFrames113c,
} from '../../src/common/audio/hit-class-sound-113c.ts'
import { getSkillSoundEntry113c } from '../../src/common/audio/skill-sounds-113c.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

describe('stsounddelay (#1608)', () => {
  it('table and formula', () => {
    expect(HIT_CLASS_SOUND_TABLE_0x6FBA5538[1]).toEqual([251, 6])
    expect(HIT_CLASS_SOUND_TABLE_0x6FBA5538[5]).toEqual([280, 8])
    expect(hitClassIndex113c('2hsl')).toBe(5)
    expect(stSoundDelayFrames113c(1, 256)).toBe(3) // (6*256+128)/256 = 6 -> 3
    expect(stSoundDelayFrames113c(5, 256)).toBe(5) // 8 -> 5
    expect(stSoundDelayFrames113c(1, 512)).toBe(0) // 3 -> 0
    expect(stSoundDelayFrames113c(10, 256)).toBe(0) // bow: 0 frames
    expect(stSoundDelayFrames113c(1, 0)).toBe(Math.floor((6 * 256 + 128) / 1) - 3)
  })

  it('unarmed player is hth (1); slot 4 weapon hit class wins', () => {
    expect(resolvePlayerHitClassIndex113c([])).toBe(1)
    expect(resolvePlayerHitClassIndex113c([{ code: 'axe', equippedSlot: 4 }])).toBe(hitClassIndex113c('1hsl'))
  })

  it('Bash (stsounddelay=1) by an unarmed Barbarian at animSpeed 256 delays the class sound 3 frames', () => {
    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 4, classId: 4, name: 'Bar', x: 100, y: 100 } as any)
    ;(world as any)._self.charClass = 'bar'
    const me = (world as any).getUnit('player', 1)
    me.animStepSpeed256 = 256
    world.drainWorldSoundRequests()
    world.emitSkillCastSound({ skillId: 126, charclass: 'bar', unitId: 1, unitType: 'player', x: 100, y: 100 })
    const e = getSkillSoundEntry113c(126)!
    const r = world.drainWorldSoundRequests().find(q => q.soundId === e.stsoundclass)
    expect(r?.delayTicks).toBe(3)
  })
})
