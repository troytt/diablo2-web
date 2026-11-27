# D2Game.dll 1.13c Missile `GetHit`/`SoftHit`/`KnockBack`, `DamageRate`, `NoMultiShot`/`NoUniqueMod`, and `SKILLS_SrvDo148` (`DoomKnightMissile`)

Authoritative disassembly and MPQ table cross-verification against Diablo II: Lord of Destruction v1.13c (`D2Game.dll`, `D2Common.dll`, and `Patch_D2.mpq` `Missiles.txt` / `Skills.txt` / `MonStats.txt` / `MonStats2.txt`).

---

## 1. `MISSILES_ApplyDamageInner` (`D2Game.dll` `0x6FC5AE80..0x6FC5AFDA`)

### 1.1 `GetHit`, `SoftHit`, and `KnockBack` (`0x6FC5AEAB..0x6FC5AEEB`)

- `ebx` points to the `MissilesTxt` record (`stride = 0x1A4`), `edi` points to `SUnitDmg` (`pDamage`), and `0x6FD18BE0` is the bitmask table `[1 << 0, 1 << 1, ..., 1 << 7]`.
- At `0x6FC5AEAB..0x6FC5AEC9`:
  - `BYTE PTR [ebx + 0x04]` bit 6 (`[0x6FD18BE0 + 0x18]` = `0x40`, `Missiles.txt` `GetHit`):
    - When `GetHit != 0`, sets `RESULTFLAG_GETHIT` (`or BYTE PTR [edi + 0x04], 0x04`).
    - When `GetHit == 0`, checks bit 7 (`[0x6FD18BE0 + 0x1C]` = `0x80`, `Missiles.txt` `SoftHit`); if non-zero, sets `RESULTFLAG_SOFTHIT` (`or BYTE PTR [edi + 0x05], 0x40`).
- At `0x6FC5AEC9..0x6FC5AEEB`:
  - Reads `BYTE PTR [ebx + 0xAE]` (`Missiles.txt` `KnockBack`, `0..100`).
  - When `KnockBack > 0`, rolls `SEED_RollLimitedRandomNumber(&pMissile->pSeed, 100)` (`0x6FC21180`) and if `roll < KnockBack`, sets `RESULTFLAG_KNOCKBACK` (`or BYTE PTR [edi + 0x04], 0x08`).
- Key `Missiles.txt` examples with `GetHit == 0`:
  - `#69 firewall` (`GetHit = 0`, `DamageRate = 100`)
  - `#144 fetishinferno1` (`GetHit = 0`, `DamageRate = 82`, `NoUniqueMod = 1`)
  - `#172 diablight` (`GetHit = 0`, `DamageRate = 82`)
  - `#176 diabfire` (`GetHit = 0`, `DamageRate = 0`, `NextHit = 1`, `NextDelay = 4`)
  - `#180 diabwall` (`GetHit = 0`, `DamageRate = 41`, `NextHit = 1`, `NextDelay = 4`)
  - `#675 megademoninferno` (`GetHit = 0`, `DamageRate = 82`, `NoUniqueMod = 1`)
  - Contrast with `#554 baal inferno` (`GetHit = 1`, `DamageRate = 0`, `NextHit = 1`, `NextDelay = 4`) and `#589 baal cold maker` (`GetHit = 1`, `KnockBack = 75`).

### 1.2 Block / Weapon-Block / Avoid Animation Suppression on `GetHit == 0 && KnockBack == 0` (`0x6FC5AF04..0x6FC5AF5A`)

- Calls `SUNITDMG_CheckBlockDodgeEvade` (`0x6FCFB790`), returning bitmask `al`:
  - `0x01`: Shield Block
  - `0x02`: Dodge
  - `0x04`: Evade
  - `0x08`: Avoid
  - `0x10`: Weapon Block
- At `0x6FC5AF09..0x6FC5AF3B`:
  - If `(al & 0x1F) != 0` AND `MissilesTxt.GetHit == 0` (`test BYTE PTR [ecx + 0x18], dl == 0`) AND `MissilesTxt.KnockBack == 0` (`BYTE PTR [ebx + 0xAE] == 0`):
    - Clears `RESULTFLAG_HIT` (`and edx, 0xFFFE`), sets `RESULTFLAG_SOFTHIT` (`or edx, 0x4000`), and masks `and eax, 0xFFFFFFE0`.
    - Because `al & 0x1F` is cleared before `0x6FC5AF3E..0x6FC5AF54`, `RESULTFLAG_BLOCK (0x0010)`, `RESULTFLAG_DODGE (0x0100)`, and `RESULTFLAG_AVOID (0x0200)` are NOT set, so blocking or avoiding a `GetHit == 0 && KnockBack == 0` stream negates the tick's damage without locking the defender into `PLRMODE_BLOCK` / `MONMODE_BLOCK`.

### 1.3 `DamageRate` (`STAT_DAMAGE_FRAMERATE = 327`, `0x6FC5AFAB..0x6FC5AFB6` -> `0x6FCFC13B`)

- Copies `STATLIST_UnitGetStatValue(pMissile, STAT_DAMAGE_FRAMERATE = 0x147, 0)` (initialized from `Missiles.txt` `DamageRate`) into `pDamage->dwFrameRate` (`+0x54`).
- In `SUNITDMG_CalculateTotalDamage` (`0x6FCFC13B..0x6FCFC177`), defender integer PDR (`STAT_NORMAL_DAMAGE_REDUCTION = 34`) and integer MDR (`STAT_MAGIC_DAMAGE_REDUCTION = 35`) are scaled in `1/256` fixed-point by `mulDiv(dwFrameRate, stat << 8, 1024)`.

---

## 2. `NoMultiShot` & `NoUniqueMod` (`D2Game.dll` `0x6FC45AD0` & `0x6FC41FE0`)

- `MONUMOD_Ev5_Multishot` (`0x6FC45AD0`, specifically `0x6FC45B67..0x6FC45B72`):
  - Invoked from `MISSILES_Create` (`0x6FC8F930` -> `0x6FC41880` -> `MONUMOD_DispatchEvent` `0x6FC468E0` with `ev = 5`).
  - Tests `(pMissile->dwFlags2 & 0x400) != 0` (`0x6FC45AFB..0x6FC45B13`) and `MissilesTxt` byte `+0x05` against `[0x6FD18BE0 + 0x10]` (`0x10`, `Missiles.txt` `NoMultiShot`). When `NoMultiShot != 0`, immediately aborts Multishot fan duplication (`jne 0x6FC45CAF`).
  - Notably, in 1.13c `Patch_D2.mpq` `Missiles.txt`, `#195 lightunique` (`MonUMod #17 Lightning Enchanted` on-struck bolts from `0x6FC46320`) carries `NoMultiShot = 1` (added in 1.10 to eliminate 1.09's 24-bolt MSLE duplication), capping `#17 + #29` on-struck bursts at `8` `#195` bolts while normal `NoMultiShot = 0` projectiles still fire `3` fan bolts.
- `MONUMOD_ApplyElementalEnchantMissile` (`0x6FC41FE0`, specifically `0x6FC42026..0x6FC42032`):
  - Tests `MissilesTxt` byte `+0x05` against `[0x6FD18BE0 + 0x14]` (`0x20`, `Missiles.txt` `NoUniqueMod`). When non-zero, immediately aborts Unique monster modifier riders (`jne 0x6FC421BD`).
  - Note: `MonProp.txt` stats (such as `extra-fire` -> `STAT_PASSIVE_FIRE_MASTERY = 329` on Nightmare/Hell `doomknight3`) are unit stats evaluated on the monster stat list, distinct from `MonUMod` riders.

---

## 3. `SKILLS_SrvDo148` (`#335 DoomKnightMissile`, `D2Game.dll` `0x6FCD4C20..0x6FCD4D25`)

- Used by `Abyss Knight` (`doomknight2`, `hcIdx = 311`) and `Oblivion Knight` (`doomknight3`, `hcIdx = 312`, plus `BaseId = doomknight3` clones `701`, `702`, `713`).
- `MonStats2.txt` defines `S3v = "pos,fir,col,unh"` (4 visual hand/cast variants).
- In `MONMODE_ChangeAnimMode` (`0x6FC3F573..0x6FC3F5BE`), when `hcIdx == 0x137 (311)` or `hcIdx == 0x138 (312)`, `D2Game.dll` copies `[edx + 0x4C]` (the rolled `0..3` component variant index) into `pMonsterData->byte_0E` (`+0x0E`).
- In `SKILLS_SrvDo148` (`0x6FCD4C75..0x6FCD4D19`):
  - Loads `edi = pSkillsTxt->wSrvMissileA` (`323`, `undeadmissile1`).
  - Adds `pMonsterData->byte_0E` (`0..3`), spawning missile ID `323 + variant`:
    - `323` `undeadmissile1`: `EType = pois`, `HitShift = 4`, `EMin..EMax = 12..16`, `ELen = 350`
    - `324` `undeadmissile2`: `EType = fire`, `HitShift = 8`, `EMin..EMax = 8..13`
    - `325` `undeadmissile3`: `EType = cold`, `HitShift = 8`, `EMin..EMax = 6..10`, `ELen = 40`
    - `326` `undeadmissile4`: physical/unholy (`EType = ""`, `HitShift = 8`, `MinDamage..MaxDamage = 7..11`)
