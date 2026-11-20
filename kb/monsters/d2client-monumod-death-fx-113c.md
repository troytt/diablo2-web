# D2Client 1.13c — MonUMod / innate monster death FX (issues #1209..#1221)

D2Client.dll 1.13c (ImageBase 0x6FAB0000). All handlers below are MonUMod "event 2" callbacks; they
only act when the unit mode (`[unit+0x10]`) is 0 (MONMODE_DEATH). Several also require the second
value returned by 0x6fabc5ec to be 4.

## MonUMod ids (`MonUMod.txt` / 1.13c `D2Client.dll` & `D2Game.dll`)

| id | name | notes |
|----|------|-------|
| 9  | FIRECHANT | client 0x6fad0d20 |
| 10 | POISONDEAD | client 0x6fad0c40 `edi==0xa` -> 1x `0x9b` (`corpsepoisoncloud` #155) |
| 15 | KILLMINIONSDEATH | server `0x6fc6fd10` (`MONSTERUNIQUE_KillMinions`) |
| 18 | COLDCHANT | client 0x6fad0c40 `edi==0x12` |
| 20 | CHARGEDBOLTS | client 0x6fad0b70 (when struck) |
| 21 | TEMPSUMMON | timed summons (`QUESTSFX_MainHandler`); NOT kill-minions |
| 31 | CORPSEBOOMDEATH | client 0x6fad0e60 |
| 33 | SUICIDEMINION_EXPLODE | client 0x6facffc0 (`aip1==1` -> #427 `suicidefireexplode`, `aip1>=2` -> #428 `suicideiceexplode`, else #426 `suicidecorpseexplode`) |
| 40 | PAINWORMDEATH | client 0x6fad0fa0 -> 0x6fad0a60 |
| 42 | NOVADEATH | client 0x6fad0c40 `edi==0x2a` |

## Handlers

- **0x6fad0d20 (umod 9 fire enchanted)**: unit sub-tile (x,y) via 0x6fab1630/0x6fab1660; 0x6fb5ff10
  creates missile 0x75 (117 `monstercorpseexplode`) at (x,y),(x+1,y+1),(x+1,y-1),(x-1,y+1),(x-1,y-1),
  then 0x52 (82 `fireexplosion`) at the same five points, then sound 0x99a (2458
  `necromancer_corpseexp_1`). No overlay.
- **0x6fad0e60 (umod 31 corpseboom)**: same five points, 5x 0x52 `fireexplosion`, sound 0x99a.
- **0x6fad0c40**: `edi==0x2a` (umod 42) and mode 0 -> velocity = 0x6fabcb5c(0x5a, 0), level = stat 12
  (0x6fabc1c6(unit, 0xc, 0)), 0x6fb51020(missile 0x5a `nova`, -1, …). `edi==0x12` (umod 18) with param 4
  -> velocity = 0x6fabcb5c(0x77 `frostnova`), 0x6fb51020(missile 0xc2 = 194 `coldunique`, -1, …).
  `edi==0xa` (umod 10) -> 0x6fb60450(0x9b `corpsepoisoncloud` #155, Range 80, CltDoFunc 4 with CltParam1=24, CltParam2=1, CltParam3=6, CltSubMissile1=`poisonpuff`).
- **0x6fb51020 -> 0x6fb50db0**: velocity override passed in ebx sets flag 4 + param. With the `-1` argument
  it loops `i = 0..63`, setting params+0x1c = X[i] (.rdata 0x6fb84390) and params+0x20 = Y[i]
  (.rdata 0x6fb84290) and calling 0x6fb630f0 — 64 missiles, radius 30 ring
  (`D2CLIENT_NOVA_RING_X/Y` in `src/common/units/monster-death-fx.ts`). Otherwise each entry is kept
  only when `seed % 6 != 0`.
- **0x6facffc0 (umod 33 suicideminion_explode)**: checks `mode == 0`; reads `MonStats.txt` `aip1` (`+0x18e`, `+2*difficulty`): `aip1 == 1` -> `0x1ab` (`427` `suicidefireexplode`), `aip1 >= 2` -> `0x1ac` (`428` `suicideiceexplode`), else `0x1aa` (`426` `suicidecorpseexplode`), then plays sound `0x99a`.
- **0x6fad0a60 (umod 40 painworm)**: 0x6fb630f0 creates 0x75 `monstercorpseexplode` and 0x221 (545
  `pain worm appear`, CelFile Revive, Range 25) at the unit; sound 0x99a.
- **0x6fafe850 (classId `0x1b3` = 435 `barricadetower`)**: creates `0x1a8` (`424` `'tower death'`, Range 1, AnimLen 1, `pCltDoFunc = 11` `0x6fb62dc0`).
- **0x6fafe588 -> 0x6fafe717 (classId `0x23a` = 570 `baalclone`)**: creates `0x266` (`614` `'baalclonedeath'`, `CelFile = Expansion\Baalteleport`, `Range = 20`, `AnimLen = 20`, `AnimSpeed = 24`, `pCltDoFunc = 1`) and sets `mode = 0xc` (`MONMODE_DEAD`) with `UNITFLAGEX_ISDEAD` (`0x40000`, `corpseSuppressed = true`).

## Bone Fetish

In 1.13c `D2Game.dll`, units whose `MonStats.txt` has `DEATHDMG` and `nBaseId == bonefetish1` create
exactly one `MISSILE_MONSTERCORPSEEXPLODE` at the unit. No 1.13c path creates `undeadmissile1-4`
(those belong to #335 `DoomKnightMissile`).
