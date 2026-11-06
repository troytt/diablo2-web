# D2Common 1.13c SkillCalc / MissCalc callbacks, diminishing returns, elemental damage, skill-level bonus

Ground truth: `samples/d2/D2Common.dll` (image base `0x6FD50000`), `samples/d2/Fog.dll` (base `0x6FF50000`),
`samples/d2/D2Game.dll` (base `0x6FC20000`), `SkillCalc.txt` / `MissCalc.txt` / `Skills.txt` / `Missiles.txt`.

## 1. Calc bytecode evaluator (`Fog.dll #10253` @ `0x6FF69E90`)

Imported by D2Common through IAT slot `0x6FDD9098`. Stack machine (64 slots), opcode byte `op-1` dispatched via
`0x6FF6A440[22]`:

| op | VA | semantics |
|---|---|---|
| 1 | `0x6FF69FF8` | call function `#idx` from the caller's function table (arg count 1/2/3 from table) |
| 4/5/6 | `0x6FF69EED/F27/F63` | push callback(code u8 / s16 / s32) — SkillCalc/MissCalc code lookup |
| 7/8/9 | `0x6FF69F9E/FC0/FDE` | push constant s8 / s16 / s32 |
| 16 `+` `17` `-` `18` `*` | `0x6FF6A0C2/0FE/13A` | 32-bit int |
| 19 `/` | `0x6FF6A177` | `idiv`; **divisor 0 pushes 0** (`0x6FF6A19F -> 0x6FF6A008`) |
| 20 `^` | `0x6FF6A234` | exponent `<= 0` -> `1`, else repeated `imul` |
| 21 neg | `0x6FF6A1BC` | |
| 22 `?:` | `0x6FF6A1E4` | cond == 0 -> false branch |

D2Common function table `0x6FDE9E24` (fn, argc): `min` `0x6FD9F0D0`(2), `max` `0x6FD9F0C0`(2),
`rand` `0x6FDA0CB0`(2; `a>=b -> a`, else `a + seed % (b-a+1)` via `0x6FD51180`), `skill` `0x6FDA1AF0`(2),
`miss` `0x6FDA0C90`(2), `stat` `0x6FDA0C30`(2), `sklvl` `0x6FDA1AB0`(3).

## 2. SkillCalc callback (`0x6FDA1070`, switch `0x6FDA10AB`, table `0x6FDA174C[73]`)

Code index = `SkillCalc.txt` row order. Skill record stride `0x23C`.

| code | target | semantics |
|---|---|---|
| ln12/34/56/78 | `0x6FD51670/16B0/16F0/1730` | `lvl <= 0 ? 0 : parA + (lvl-1)*parB` |
| dm12/34/56 | `0x6FD9E680/E630/E5E0` -> `0x6FD9DC30` | see §3 |
| dm78 | `0x6FDA1148` -> `0x6FD9DC30(lvl, par7, par8)` | see §3 |
| par1..8 | | raw `Param1..8` (`+0x148..+0x164`) |
| edmn / edmx | `#10121` `0x6FDA0460` / `#11091` `0x6FDA0360` (flag 0) `>> 8` | see §4 (**synergy always applied**) |
| edln / edma | `#10510` `0x6FD9E900` | 3-band `ELen` + **`ELenSymPerCalc` always applied**; flag ignored |
| toht | `0x6FD9EA50` | `ToHitCalc` if present else `ToHit + (lvl-1)*LevToHit` |
| mana | `0x6FDA1264` | `lvl<=0 ? 0 : ((lvl-1)*lvlmana + mana) << manashift >> 8` (no `minmana`) |
| mps | `0x6FDA1298` | `lvl<=0 ? 0 : ((((lvl-1)*lvlmana + mana) * 25) / 2 << manashift) >> 8` (integer) |
| math / madm / macr | `0x6FD9E7A0(unit, skill, lvl, 0/1/2)` | evaluate the skill's own `passivecalcN` whose `passivestatN` is `passive_mastery_{melee,throw}_th` (342/345) / `_dmg` (343/346) / `_crit` (344/347). For weapon masteries = `ln12` / `ln34` / `dm56` |
| m1en..m3ex, m1eo.. | `0x6FDA1325`/`137F`/`1538`/`158F` | `SkillDesc` descmissileN -> missile `#edmn/#edmx` (`0x6FDBB360`/`0x6FDBA3E0`) |
| m1el..m3el | `0x6FDA13D9` -> `0x6FDB9DC0` | missile elemental length |
| m1rn..m3rn | `0x6FDA1430` | `Range + LevRange*lvl` of descmissile (**not** `lvl-1`) |
| edns / edxs | `0x6FDA1471/148C` | like edmn/edmx without `>> 8` |
| ulvl | `0x6FDA14A7` | unit stat 12 |
| blvl | `0x6FDA14C6` | `clamp(pSkill->hardLvl, 0, Experience.txt[MaxLvl].col0 = 99)` |
| usmc | `0x6FDA1507` | `((lvl-1)*lvlmana + mana) << manashift` |
| enma / exma / enms / exms | flag = 1 | edmn/edmx **+ caster elemental mastery** (§4) |
| len, clc1..4, rng | `+0x60`, `+0x138..+0x144`, `+0x64` | evaluate `auralencalc`, `calc1..4`, `aurarangecalc` |
| ast1..6, pst1..5, pets, skpt | `+0x68..+0x7C`, `+0xA4..+0xB4`, `+0xC0`, `+0x170` | evaluate `aurastatcalcN`, `passivecalcN`, `petmax`, `skpoints` |

## 3. Diminishing returns `0x6FD9DC30(lvl, a, b)` (stdcall, `ret 0xC`)

```
x = (lvl * 110) / (lvl + 6)            ; idiv, truncated FIRST
r = (x * (b - a)) / 100 + a            ; magic 0x51EB851F, truncated toward zero
if (r > b) r = b                       ; cap at b
```

The cap means `r <= b` always (for `a > b` the result is pinned to `b`). The SkillCalc/MissCalc `*desc` text
`((110*lvl)*(b-a))/(100*(lvl+6))+a` is NOT the executed order: the binary truncates `110*lvl/(lvl+6)` before
multiplying by `b-a`, which gives 1 less than the single-division form at many levels (e.g. Pierce `dm12(10,100)`
lvl 1 = 23, Lower Resist `dm56(25,70)` lvl 1 = 31, Blaze `dm12(50,500)` lvl 1 = 117). Same helper is used by
MissCalc `sd12/sd34/cd12/cd34/shd1/chd1/dd12` (`0x6FDBA964..0x6FDBAA54`).

## 4. Elemental damage `#10121` min `0x6FDA0460` / `#11091` max `0x6FDA0360` (unit, skill, lvl, bMastery)

```
v = band5(lvl, EMin/EMax, EMinLev1..5) << HitShift   ; band5 = 0x6FD9DDB0 (2-8, 9-16, 17-22, 23-28, 29+)
if EDmgSymPerCalc != -1:
    (min only) if v > 256 || EMinLev1 != 0:          ; 0x6FDA04C7..0x6FDA04D3
        v += v * eval(EDmgSymPerCalc) / 100          ; 0x6FD511E0
if bMastery && unit: v += 0x6FD9F870(unit, EType)     ; elemental mastery %
```

`0x6FD9F870`: EType fire -> stat 329 `passive_fire_mastery`, ltng -> 330, cold -> 331 (via special list lookup),
pois -> 332; returns `v * stat / 100`. The min-damage exception keeps the flat `1` minimum of 13 lightning skills
(Power Strike, Lightning Bolt, Charged Strike, Lightning Strike, Lightning Fury, Lightning, Chain Lightning, Holy Shock,
Shock Field, Charged Bolt Sentry, Claws of Thunder, Lightning Sentry, Death Sentry) un-synergised at every level.

## 5. MissCalc callback (`0x6FDBA790`, table `0x6FDBAA70[43]`)

Missile record stride `0x1A4`. `rang` = `Range(+0x96) + LevRange(+0x98) * lvl`; `sl12/sl34/cl12/cl34/shl1/chl1/dl12`
= `a + (lvl-1)*b` (no `lvl<=0` guard); `sd*/cd*/shd1/chd1/dd12` -> `0x6FD9DC30`; `damn/damx/dmns/dmxs` -> `0x6FDBA580/0x6FDBA4B0`.

## 6. Mana

- `SKILLS_CheckSkillMana` (`0x6FDA0AF0`): `STAT_MANA >= ((mana + lvlmana*(clamp(lvl,0,99)-1)) << manashift)` — no `minmana`.
- `D2Game` `SKILLS_ConsumeMana` (`0x6FCBF850`): `mana == 0 && lvlmana == 0` -> consume nothing;
  else `cost = max(minmana << 8, (mana + lvlmana*max(lvl-1,0)) << manashift)`; under state 114 `blood_mana` the cost is paid
  through `0x6FC2BE20` instead of stat 8.

## 7. Skill level bonus (`0x6FD9FCB0`, unit in `esi`, skill in `ebx`)

```
bonus = stat127 allskills + (state 134 ? 2 : 0) + pSkill->+0x2C
if unit is player:
    if Skills.charclass == player class:
        bonus += stat83[class] + stat188[class*8 + SkillDesc.SkillPage - 1] (page != 0) + min(stat97[skill], 3)
    else:
        bonus += stat97[skill]                       ; uncapped
else:
    bonus += hardLvl > 0 ? min(stat97[skill], 3) : stat97[skill]
bonus += stat126[EType]  (item_elemskill, e.g. "+3 to Fire Skills")   ; only when EType != 0
bonus += stat107[skill]  (item_singleskill)
```

`SKILLS_GetSkillLevel` (`0x6FDA05D0`): `clamp(hardLvl + bonus, 0, 99)`.
