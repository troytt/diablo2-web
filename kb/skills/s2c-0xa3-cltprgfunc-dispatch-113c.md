# S2C 0xA3 → Skills.txt `cltprgfunc` dispatch (D2Client.dll 1.13c)

## Handler `0x6FB5EFB0`
- Packet: `u8 0xA3, u8 flag, i16 skill, i16 level, u8 casterType, u32 casterId, u8 targetType, u32 targetId, u32 x, u32 y`.
- Caster lookup `0x6FB54E20`; `test eax,eax; je` at `0x6FB5EFD7` drops the packet only when the **caster** is unknown.
  The target lookup result is passed on unchecked (may be NULL).
- `test byte [skill+4], gdwBitMasks[2]` (`0x6FB5F03E`, Skills.txt `progressive`) → `0x6FB52950`, else `0x6FB51B10`.
  Both receive `(caster, target, skill, level, x, y, flag)`.

## Non-progressive `0x6FB51B10`
1. Saves the caster's target, then sets it to the packet target (`0x6FABC62E`) or to `(x, y)` when both are non-zero
   (`0x6FABC3EE`).
2. `slot = cltprgfunc1` (`[skill+0xF6]`), bounds `[0x6FB8EC50]` (=130), `call [slot*4 + 0x6FB8EA48]`.
   Slot 0 is NULL → nothing else happens (skills without cltprgfunc1, e.g. Charged Bolt / curses / resurrect, are no-ops).
3. If the slot returns non-zero: `dosound` (+0x100) on the caster, `tgtsound` (+0x10A) on the target unit
   (`0x6FB55F70`), `tgtoverlay` (+0x108) on the target unit (`0x6FB1B300(target, 2)`).
4. Restores the caster's target.

## Progressive `0x6FB52950`
1. Requires `aurastate` (+0x80) and `aurastat1` (+0x54). If the caster lacks the state, creates a statlist for it
   (`0x6FABC442` / `0x6FABC2F2` / `0x6FABC36A`) and sets `aurastat1 = flag` (the charge count).
2. `idx = flag - 1`. With `prgstack` (`byte [skill+4] & gdwBitMasks[7]`, `0x6FB52A97`) runs `cltprgfunc[i]` for
   `i < idx`, setting `aurastat1 = i + 1` before each call, then sets it to `flag`.
3. `slot = cltprgfunc[idx]`; if `cltmissile` (+0xE8) > 0 it is spawned toward the target first (lob → `0x6FB69A80`,
   else `0x6FB515C0`). Calls the slot; on success the same dosound / tgtsound / tgtoverlay tail as above.

## Slots reached from 1.13c Skills.txt
| Slot | VA | Skills | Effect |
|---|---|---|---|
| 9 | `0x6FAF1780` | 259 / 274 prg2+3 | release disk (`cltmissileb/c`) |
| 10 | `0x6FAF07C0` | 269 prg2 (and ItemCltEffect of 44 / 48) | 64-entry nova ring |
| 11 | `0x6FAF1690` | 269 prg3 | 16 charged bolts |
| 12 | `0x6FAF0B60` | 254 prg1..3 | needs target; `prgoverlay + charge-1` on **target**, `prgsound + charge-1` on caster (charge = aurastat1 clamped 1..3) |
| 13 | `0x6FAF0A70` | 265 prg1..3 | same, overlay on **caster** |
| 14 / 83 / 15 | `0x6FAF0880` / `0x6FAF15A0` / `0x6FAF14F0` | 280 prg1 / 2 / 3 | meteor / 7 chain lightning / 16 chaos ice |
| 84 | `0x6FB24350` | 57 | `thunderstorm1` over the target + `prgoverlay` |
| 91 | `0x6FB794E0` | 244 | `cltmissilea` + `cltmissileb` at the target coordinates |
| 92 | `0x6FB795F0` | 249 / 349 | `frames = cltcalc1`, `fall = cltcalc2`, `slide = cltcalc3` (all > 0); tail + rock with `UNIT_Set3DTrajectory(0x6FB77E30)` offset `(frames*slide, frames*fall)` and velocity `(-slide<<11, 0, -fall<<11)` |
| 93 | `0x6FB75670` | 307 / 325 | needs target (corpse); `0x6FAFC500(corpse, 3)` then `cltmissileb` (`recycler delay`) from the corpse. `0x6FAFC500` (monster corpse effect, seed-gated) is not yet modelled in TS. |

TS: `src/client/world/skill-prg-dispatch-113c.ts`, data `src/common/skills/skill-client-113c.ts`
(packer `src/baker/packers/pack-skill-client-113c.ts`).

## Client Do tail `0x6FB52C90` (keyframe)
- After `CltDoFunc` (or `ItemCltEffect` when item-cast) succeeds (`[esp+0x18]`, `0x6FB52E4B`): `dosound` (+0x100) on the
  caster (`0x6FB52E5F`), `tgtsound` (+0x10A) on the target unit (`0x6FB52E7A`, `0x6FB55F70`), `tgtoverlay` (+0x108) on
  the target unit (`0x6FB52EA4`). The cast start `0x6FB51CF0` reads neither tgtsound nor tgtoverlay.
- 1.13c rows: tgtoverlay 179 / 253 / 254 / 273 / 275; tgtsound 74 / 83 / 95 / 131 / 150 / 253 / 351.
- TS: `ClientWorld.spawnMissilesForSkill` (the Do) → `runSkillDoTargetTail113c` (not for the Double Throw second hand).
