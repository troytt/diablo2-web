/**
 * Default (class-less) skills every 1.13c player unit owns.
 *
 * Ground truth: `D2Common.dll #10506` (`0x6FDA29E0`) runs when a player unit is created — on the server from
 * `D2Game 0x6FC58620` (player unit init, `0x6FC58659`) and on the client from `D2Client 0x6FAC91E0` (client unit
 * init for S2C player assignment, `0x6FAC9237`). Unless the skill list already holds a native skill 0 it adds
 * skill 0 (Attack, `0x6FDA2A43`), then the up to ten `CharStats.txt` `Skill 1..Skill 10` ids (word array at
 * CharStats record `+0xAE`, `0x6FDA2A48..0x6FDA2A79`), and selects Attack as left skill when none is set. The
 * original client lists them at level 1 (oracle P5.4, kb/ui/oracle-client-display-113c.md §8).
 *
 * The ids below are CharStats.txt `Skill 1..10` of the 1.13c MPQs resolved through Skills.txt
 * (tests/oracle/default-skills-113c.test.ts checks them against the MPQ data).
 */
import type { CharacterClassCode } from './classes.ts'

/** Skill 0 (Attack) followed by CharStats.txt `Skill 1..Skill 10` per class (Skills.txt ids). */
export const DEFAULT_SKILLS_113C: Readonly<Record<CharacterClassCode, readonly number[]>> = Object.freeze({
  // Throw, Kick, Scroll/Book of Identify, Scroll/Book of Townportal, Unsummon
  ama: [0, 2, 1, 217, 218, 219, 220, 3],
  sor: [0, 2, 1, 217, 218, 219, 220, 3],
  nec: [0, 2, 1, 217, 218, 219, 220, 3],
  pal: [0, 2, 1, 217, 218, 219, 220, 3],
  // ... + Left Hand Throw, Left Hand Swing
  bar: [0, 2, 1, 217, 218, 219, 220, 4, 5, 3],
  dru: [0, 2, 1, 217, 218, 219, 220, 3],
  // ... + Left Hand Swing
  ass: [0, 2, 1, 217, 218, 219, 220, 5, 3],
})
