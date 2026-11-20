import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { decodeD2gsS2cPacket } from '../../src/netproto/d2gs/registry.ts'
import { SKILLS_TXT_ROW_COUNT_113C } from '../../src/netproto/d2gs/s2c/skills.ts'

const pkt = (word: number) =>
  new Uint8Array([0x7b, 0x03, word & 0xff, (word >>> 8) & 0xff, 0x44, 0x33, 0x22, 0x11])

describe('S2C 0x7B AssignSkillHotkey (D2Client.dll 0x6fb5c6d0)', () => {
  it('masks the skill with 0xFFF and keeps bit 15 as the hand', () => {
    expect(decodeD2gsS2cPacket(pkt(0x8000 | 0x7036))).toMatchObject({ slot: 3, hand: 'left', skill: 0x36, itemId: 0x11223344 })
    expect(decodeD2gsS2cPacket(pkt(0x0105))).toMatchObject({ hand: 'right', skill: 0x105 })
  })

  it('maps ids above the Skills.txt record count to -1 (jle keeps id == count)', () => {
    expect(decodeD2gsS2cPacket(pkt(0xffff))).toMatchObject({ skill: -1, hand: 'left' })
    expect(decodeD2gsS2cPacket(pkt(SKILLS_TXT_ROW_COUNT_113C))).toMatchObject({ skill: SKILLS_TXT_ROW_COUNT_113C })
    expect(decodeD2gsS2cPacket(pkt(SKILLS_TXT_ROW_COUNT_113C + 1))).toMatchObject({ skill: -1 })
  })

  it('SKILLS_TXT_ROW_COUNT_113C matches the extracted Skills.txt', () => {
    const p = join(process.cwd(), 'samples', 'd2', 'excel', 'Skills.txt')
    if (!existsSync(p)) return
    const rows = readFileSync(p, 'latin1').split(/\r?\n/).filter((l) => l.length > 0).length - 1
    expect(rows).toBe(SKILLS_TXT_ROW_COUNT_113C)
  })
})
