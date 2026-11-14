# Diablo II v1.13c `D2Game.dll` `MonUMod` Init, Resistances (`0x6FC41BE0`), and Event Tables

## 1. Binary Dispatch Tables (`D2Game.dll` `.data`)

### `fpInit[0..42]` (`0x6FD2E550`)
Invoked with `__fastcall (UnitAny* pMonster, int nUModId, BOOL bBoss)`:
- `1` (`rndname`): `0x6FC43020`
- `2` (`hpmultiply`): `0x6FC42FA0`
- `4` (`leveladd`): `0x6FC41E80`
- `5` (`strong`): `0x6FC42BC0`
- `6` (`fast`): `0x6FC42880`
- `8` (`resist`): `0x6FC41BE0` (`MONUMOD_ApplyResistances`)
- `9` (`fire`): `0x6FC42740` (`+66..100%` / `+33..50%` `firemindam`/`firemaxdam` -> tail-calls `0x6FC41BE0`)
- `16` (`champion`): `0x6FC42DA0`
- `17` (`lightning`): `0x6FC42600` (`+66..100%` / `+33..50%` `lightmindam`/`lightmaxdam` -> tail-calls `0x6FC41BE0`)
- `18` (`cold`): `0x6FC42490` (`+66..100%` / `+33..50%` `coldmindam`/`coldmaxdam` + `100 + 5 * mlvl` `coldlength` -> tail-calls `0x6FC41BE0`)
- `23` (`poisonhit`): `0x6FC42320` (`+66..100%` / `+33..50%` `poisonmindam`/`poisonmaxdam` + `(150 + 5 * mlvl) * 2` `poisonlength` -> tail-calls `0x6FC41BE0`)
- `25` (`manahit`): `0x6FC421D0` (`+66..100%` / `+33..50%` `<< 8` mana drain -> tail-calls `0x6FC41BE0`)
- `26` (`teleport`): `0x6FC441B0`
- `27` (`spectralhit`): `0x6FC41BE0` (`MONUMOD_ApplyResistances`)
- `28` (`stoneskin`): `0x6FC41BE0` (`MONUMOD_ApplyResistances`)
- `30` (`aura`): `0x6FC44CD0`
- `36` (`ghostly`): `0x6FC43850` (`STAT_DAMAGERESIST >= 80`, half velocity, `+20..30%` cold + `150` `coldlength`)
- `37` (`fanatic`): `0x6FC43810`
- `38` (`possessed`): `0x6FC437C0` (`nTypeFlags |= 0x20` curse immunity)
- `39` (`berserk`): `0x6FC42D00`
- `41` (`always_run_ai`): `0x6FC469F0`

### `fpEvent[0..42][6]` (`0x6FD2F448`, stride `24` bytes = `6` `DWORD`s per `MonUMod`)
- `ev[0]` (pre-melee swing): `27` (`spectralhit`) -> `0x6FC42B60`
- `ev[1]` (corpse/pre-death gate): `9` -> `0x6FC41BB0`, `10`/`18`/`31`/`32`/`42` -> `0x6FC41A90`, `17` -> `0x6FC41AD0`, `20` -> `0x6FC41B00`, `35` -> `0x6FC41A70`
- `ev[2]` (on-death FX/explosion): `9` -> `0x6FC466B0`, `10` -> `0x6FC46230`, `17` -> `0x6FC46320`, `18` -> `0x6FC462D0`, `20` -> `0x6FC460D0`, `31` -> `0x6FC465E0`, `32` -> `0x6FC44300`, `33` -> `0x6FC457D0`, `34` -> `0x6FC43E20`, `40` -> `0x6FC42B10`, `42` -> `0x6FC46520`
- `ev[3]` (on-melee/physical hit): `7` (`curse`) -> `0x6FC44250`, `15` -> `0x6FC43BF0`, `24` -> `0x6FC44440`
- `ev[4]` (on-struck): `14` -> `0x6FC418A0`, `17` -> `0x6FC468C0`, `20` -> `0x6FC43440`, `41` -> `0x6FC43320`
- `ev[5]` (on-missile spawn): `27` (`spectralhit`) -> `0x6FC43650`, `29` (`multishot`) -> `0x6FC45AD0`

## 2. `MONUMOD_ApplyResistances` (`0x6FC41BE0..0x6FC41E78`)

1. **Boss-Only Gate (`0x6FC41BFD..0x6FC41C03`)**:
   - `mov eax, [esp+0x14]; test eax, eax; je 0x6FC41E74`
   - Whenever `bBoss == 0` (`rank === 'minion'`), returns immediately without modifying armor or any resistance.
2. **`Stone Skin (#28)` Armor Doubling (`0x6FC41C09..0x6FC41C20`)**:
   - Executed *before* the 2-immunity count check: `STAT_ARMORCLASS (0x1f)` is shifted left by 1 (`2x`).
3. **6-Stat Immunity Count & `>= 2` Gate (`0x6FC41C28..0x6FC41CBF`)**:
   - Reads `STAT_FIRERESIST (0x27)`, `STAT_LIGHTRESIST (0x29)`, `STAT_COLDRESIST (0x2b)`, `STAT_POISONRESIST (0x2d)`, `STAT_DAMAGERESIST (0x24)`, and `STAT_MAGICRESIST (0x25)`.
   - Counts how many are `>= 100` (`0x64`) into `[esp+0x20]`.
   - `cmp [esp+0x20], 2; jge 0x6FC41E71` — once total immunities `>= 2`, skips all UMod resistance bonuses (`#8`, `#9`, `#17`, `#18`, `#23`, `#25`, `#27`, `#28`).
4. **Per-Modifier Resistance Additions (`0x6FC41CC9..0x6FC41E6C`)**:
   - `#8` (`resist`): sequentially checks `cold < 100` (`+40`), `immunities < 2`, `fire < 100` (`+40`), `immunities < 2`, `light < 100` (`+40`).
   - `#9` (`fire`): `fire += 75`.
   - `#18` (`cold`): `cold += 75`.
   - `#17` (`lightning`): `light += 75`.
   - `#23` (`poisonhit`): `poison += 75`.
   - `#25` (`manahit`): `magic += 20`.
   - `#27` (`spectralhit`): sequentially checks `cold < 75` (`+20`), `immunities < 2`, `fire < 75` (`+20`), `immunities < 2`, `light < 75` (`+20`).
   - `#28` (`stoneskin`): `damageresist += 50`.

## 3. `Spectral Hit (#27)` 1-of-5 Element Roll (`0x6FC42B60`, `0x6FC43650`, `0x6FC41FE0`, `.data` `0x6FD1CE00`)

- Boss-only (`bBoss != 0` at `0x6FC42B60`).
- Rolls `rand % 5` into `.data` `0x6FD1CE00` (`5` entries of `3` `DWORD`s: `(minStatId, maxStatId, lenStatId)`):
  - `0`: `(48 firemindam, 49 firemaxdam, -1)`
  - `1`: `(50 lightmindam, 51 lightmaxdam, -1)`
  - `2`: `(52 magicmindam, 53 magicmaxdam, -1)`
  - `3`: `(54 coldmindam, 55 coldmaxdam, 56 coldlength)` (`+0x28` = `+40` frames)
  - `4`: `(57 poisonmindam, 58 poisonmaxdam, 59 poisonlength)` (`+0x28` = `+40` frames)
- Damage range uses `MonUMod.txt` constants `[28] = 66%` (`+0x380` at `0x6FC420DA`) to `[31] = 100%` (`+0x3E0` at `0x6FC4210D`) of `MonLvl.txt` `L-DM`.
- For projectiles (`[ebp+0x0] == 3` `UNIT_MISSILE` at `0x6FC41FEB..0x6FC42032`), pure elemental spell missiles do not inherit monster weapon/melee enchant stats.
