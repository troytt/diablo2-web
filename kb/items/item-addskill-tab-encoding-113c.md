# `item_addskill_tab` (stat 188) param encoding — 1.13c

Binaries: `samples/d2/D2Common.dll`, `D2Client.dll` (1.13c), read with `objdump -d -M intel`. Issue #925.

## Data
- `MagicPrefix.txt` / runes / uniques `skilltab` **par** is linear `class * 3 + tab` (0..20), e.g. Sorceress orb
  prefixes Burning/Blazing/Volcanic = 3 (Fire), Sparking/Charged/Powered = 4, Chilling/Freezing/Glacial = 5.
- `Properties.txt` `skilltab`: func1 = 10, stat1 = `item_addskill_tab`.
- `ItemStatCost.txt` `item_addskill_tab`: ID 188, Send Bits 3, Send Param Bits 6, Save Bits 3,
  **Save Param Bits 16**, descfunc 14, descstrpos `StrSklTabItem1`.

## Encoding (par -> stat param)
`D2Common.dll` property func 10 @ `0x6fd98470`:
```
6fd984b0: mov eax,[esi+0x4]     ; pProperty->nLayer (par)
6fd984b4: cdq ; mov ebp,3 ; idiv ebp
6fd984bc: lea eax,[edx+eax*8]   ; par % 3 + 8 * (par / 3)
```
So the stat list (`.d2s`, D2GS `0x9C/0x9D` item stat list) carries `tab + 8 * class`, low 3 bits = tab, upper bits =
class. Sorceress Fire = 8, Lightning = 9, Cold = 10; Necromancer = 16..18; Paladin = 24..26 ...
(The 1.13c binary explicitly computes `(nLayer % 3) + 8 * (nLayer / 3)` via `idiv 3` followed by `lea eax, [edx+eax*8]`.)

## Decoding
- `D2Client.dll` descfunc 14 @ `0x6fb052e2`: `class = param >> 3` (`sar eax,3`), `tab = param & 7` (`and ebp,7`),
  CharStats record of `class`; `tab < 0 || tab >= 3` -> no line; string = `CharStats.wStrSkillTab[tab]`
  (`[rec + tab*2 + 0x54]`, i.e. `StrSkillTab1..3`) + `StrClassOnly`.
- `D2Common SKILLS_GetSkillLevel`: reads stat 188 layer `SkillDesc.SkillPage - 1 + 8 * classId`.

## Port
`src/common/skills/skills-data.ts` `encodeSkillTabParam` / `decodeSkillTabParam` / `skillTabStatParam`; the linear
display tables `CANONICAL_SKILL_TABS` / `CANONICAL_SKILL_TABS_ZH` are keyed by the decoded `class * 3 + tab`
(= CharStats StrSkillTab ordering, asserted against the MPQ in `tests/issue-925-skilltab-encoding.test.ts`).
