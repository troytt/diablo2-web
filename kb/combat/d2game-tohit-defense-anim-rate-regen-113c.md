# 1.13c To-Hit, Defense, Physical Damage %, Anim-Rate (IAS/FCR/FHR/FBR) & Vitals Regen

Ground truth: `samples/d2/D2Game.dll` (base `0x6FC20000`), `samples/d2/D2Common.dll` (base `0x6FD50000`),
`ItemStatCost.txt` / `CharStats.txt` / `States.txt` (Patch_D2.mpq). Import ordinals resolved from the
D2Game IAT (e.g. `0x6FD18534 -> D2Common #10621`).

## 1. Attack rating (`D2Common #10621` @ `0x6FD81EA0`, players only)

```c
AR = stat(19 tohit) + stat(2 dex) * 5 - 35 + CharStats[class].ToHitFactor   // 0x6FD81F42..0x6FD81F84
```
No percentage is applied here. (`0x6FD82B10` is NOT an attack-rate function: it is the tail of
`UNITS_GetDefense`.) `dex` is the accrued unit stat (items, charms, sets, skills included).

## 2. Defense (`D2Common #10672` @ `0x6FD82890`)

```c
d   = stat(31 armorclass) + stat(2 dex) / 4               // cdq; and 3; sar 2 (trunc toward 0)
pct = stat(171 skill_armor_percent) + stat(16 item_armor_percent)
if (unit is player/monster && state 101 holyshield && shield)  pct += HolyShield bonus (stats 350/351 modifier list, 0x6FDA1BF0)
d  += trunc(d * pct / 100)                                // both signs
d  += trunc(d * stat(182 armor_override_percent) / 100)   // Berserk -100 => 0
```

## 3. Hit chance (`D2Game` `0x6FCFDE90`, `ret 0xC`; args: defender, extraToHitPct, bMissile)

```c
alvl = stat(attacker,12); dlvl = stat(defender,12)
def  = #10672(defender) + stat(defender, bMissile ? 32 armorclass_vs_missile : 33 armorclass_vs_hth)
ar   = #10621(attacker)
0x6FCFB1F0(attacker, defender, &ar, &def):
  if stat(attacker,115 item_ignoretargetac) && defender is monster && !(MonStats flags & 0xA)
     && !#10064(0,def) && !#11104(def)           -> def = 0
  p = stat(attacker,116 item_fractionaltargetac)   // "-x% target defense"
  if p > 0: if defender is player, or monster with #10064(0,def) / 0x6FC42A80(def,2) / #11104(def) (merc): p /= 2
            p = min(p,100); def -= trunc(def*p/100)
  if stat(attacker,123 item_demon_tohit)  && #10255(def) (demon)   ar += v
  if stat(attacker,124 item_undead_tohit) && #10239(def) (undead)  ar += v
pct = extraToHitPct + stat(attacker,119 item_tohit_percent)
    + (bMissile ? 0 : #10804(attacker, primaryWeapon, 0, 0))     // weapon mastery to-hit
    + sum(stat 179 attack_vs_montype layers matching defender MonType)  // defender monster only
ar  = ar + mulDiv(ar, pct, 100)                    // ONE additive percentage pool
if def < 0 { ar -= def; def = 0 }   if ar < 0 { def -= ar; ar = 0 }
f   = (ar + def) ? ar * 100 / (ar + def) : 100
hit = clamp(2 * alvl * f / (alvl + dlvl), 5, 95)  // then rand(100) < hit (0x6FCFE011)
```

## 4. Physical damage % pool (`SUnitDmg_FillPacket` `0x6FCFC530`)

```c
w     = primaryWeapon (0x6FC572C0); twoHand = #10051(unit,w) == 2
min   = stat(twoHand?23:21) << 8 ; max = stat(twoHand?24:22) << 8        // accrued: base+on-weapon ED+all flat +min/+max
min  += stat(111 item_normaldamage) << 8 ; max += same; min >= 256; max >= min + 256
pct   = callerSkillEd + stat(25 damagepercent)
      + str * #10213(w) / 100 + dex * #10120(w) / 100                     // Weapons.txt StrBonus/DexBonus
      + #10804(unit, w, 0, 1)                                             // weapon mastery ED
pct   = max(pct, -90)
phys  = roll( min*(100+pct+stat18)/100 , max*(100+pct+stat17)/100 ) * srcdam / 128
```
All ED sources are summed into ONE pool (no multiplicative stacking), applied once.

## 5. Damage-percent modifier (`0x6FCFAC10`), applied to all 12 channels (`0x6FCFC17E`)

- defender player and attacker = player, merc (`#11104 != 0`) or flagged player-owned unit: **17%**
- defender merc and attacker merc: **25%**
- attacker merc vs `#10064(0,def)` monster: `pGame+0x38` (UNVERIFIED semantics)
- `#10278(attacker)` and defender flag `+0xC4` bit31: `#11104(def) ? 200 : 400`
- otherwise 100 (no scaling)

## 6. Flat DR / MDR / resist / absorb per channel (`0x6FCFC0B0` -> `0x6FCFBD00`)

Descriptor table `0x6FD22AB0` (12 x `0x2C`), field `+0x18` selects the flat reducer:
`0` none, `1` = `stat34 << 8` (scaled by `pDmg+0x54 / 1024` when > 0), `2` = `stat35 << 8`.
Rows: Phys -> DR; Fire / Ltng / Cold / Magic -> MDR **each independently**; Poison/lengths/drain -> none.
Per channel: `dmg -= reducer` -> `if (dmg > 0 && res) dmg = mulDiv(dmg, 100 - min(res,100), 100)` ->
absorb (`0x6FCFAD00`). A channel driven negative by the flat reducer is stored negative and summed
into `pDmg+0x4C` total (observed in asm; end effect UNVERIFIED).

## 7. Animation rate (`D2Common UNITS_UpdateAnimRateAndVelocity`, `0x6FD83180..0x6FD835E0`)

Stat table `0x6FDE4608` `{bDiminish, base, stat}`: `0:{1,120,93 IAS}` `1:{1,120,99 FHR}`
`2:{1,120,105 FCR}` `3:{1,120,102 FBR}` `4:{1,150,96 FRW}`. `0x6FD823E0`: `v ? base*v/(base+v) : 0`
(applied to negative values too).

| Mode (player / monster) | Rate (percent of AnimData speed) | Clamp |
|---|---|---|
| cast (`0x6FD80B80`) | `100 + dFCR` | `<= 175` only |
| block 9 / 6 (`0x6FD7EF90`) | `50 + dFBR`, **`100 + dFBR` with state 101 holyshield** | speed >= 1 |
| gethit 4 / 3 (`0x6FD7EFC0`) | `50 + dFHR` | none |
| attack (`0x6FD80BD0`) | `stat68 + dIAS (+ dual-wield WSM average) (-30 if player mode 18)` | `[15, 175]` |
| walk/run | `GetBaseAnimSpeed * max(25, stat67 + dFRW) / 100` | `[0, 0x7FFF]` |
| other | `stat69` clamp `[15,175]` | |

Example: Amazon `AMGHHTH` (6 frames, speed 256) at 0% FHR: `256*50/100 = 128` -> 11 ticks.

## 8. Vitals per frame (`0x6FC99B10` per-frame event -> `0x6FC97CB0`, `0x6FC97A50`, `0x6FC97950`)

- Life `0x6FC97CB0`: only `stat74 hpregen` (1/256 HP); `hp = clamp(hp + v, 256, maxhp)`. **No base regen.**
- Stamina `0x6FC97A50`: `per = maxStam >> S; per += trunc(per * stat28 / 100)`:
  NU(1)/TN(5): `S=8`; TW(6): `S=9`; WL(2): `S=9` only while `stamina >= 256`;
  RN(3)/GH(4)/all other modes: recover only when `stat28 >= 1000` (stamina shrine).
- Mana `0x6FC97950`: unless state 85: `per = max(1, maxMana256 / (CharStats.ManaRegen*25 || 7500))`,
  `per = mulDiv(per, 100 + stat27, 100)`; then `per += stat26 manarecovery` (always); clamp to `[−mana, max−mana]`.

## 9. Per-level ops relevant here (`0x6FD8966B`)

`op 2`: `stat1 += (val * (opBase >> valShift)) >> opParam`: `224 item_tohit_perlevel` / `225
item_tohitpercent_perlevel` use `opParam = 1` (/2); `214/215` armor per level use `/8` (op 4/5).
