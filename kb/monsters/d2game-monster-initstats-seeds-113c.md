# `D2Game.dll` / `D2Common.dll` v1.13c — Game Seed, Per-Unit `D2SeedStrc`, Act Outfit Palette & `MONSTER_InitStats`

Image bases: `D2Game.dll = 0x6FC20000`, `D2Common.dll = 0x6FD50000`.
Cross-verified against MPQ `monstats.bin` / `monstats2.bin` / `monlvl.bin` / `skills.bin` and in-process `d2oracle` frame traces.

---

## 1. Game Seed & Per-Unit `D2SeedStrc` Allocation

### 1.1 `GAME_InitSeed` (`D2Game.dll` `0x6FC4A900`)
- Override path (`Game.exe -seed N`, `[0x6FD2E354] != -1` at `0x6FC4A96A..0x6FC4A98C`):
  1. `SEED_InitSeed(&pGame->tSeed)` (`D2Common #10936` `0x6FD86750`: `lo = 1, hi = 0x29A`).
  2. `SEED_InitLowSeed(&pGame->tSeed, N)` (`D2Common #10614` `0x6FD86740`: `lo = N, hi = 0x29A`).
  3. `pGame->dwInitSeed (+0x7C) = N`, `pGame->bSeedOverride (+0x84) = 1`.
- Game creation draws `4` inline steps (`lo * 0x6AC690C5 + hi`) on `pGame->tSeed (+0xD0)` before the first player enters (verified on frame 1: `-seed 12345` -> `[4008788125, 674806599]`).

### 1.2 `SUNIT_AllocUnitData` (`D2Game.dll` `0x6FD01D90` -> `0x6FD00110` / `0x6FD000C0`)
- Non-player units (`dwType != 0` at `0x6FD01E72`):
  - `0x6FD00110`: `SEED_InitSeed(&pUnit->tSeed)`, advances `pGame->tSeed` once (`0x6FD00142..0x6FD00159`), stores `pUnit->dwInitSeed (+0x28) = lo`, calls `SEED_InitLowSeed(&pUnit->tSeed, lo)` (`{lo, 0x29A}`).
  - Item units (`dwType == 4` at `0x6FD01E81`): `0x6FD000C0` advances `pGame->tSeed` a **second** time (`2` draws per item).
- Player units (`dwType == 0`): draw `1` step from `pGame->tSeed` on creation (`{draw, 0x29A}`), followed by `CharStats.txt` `item1..item10` starting items (`2` draws per item unit).
- DRLG room activation (`0x6FC4CBE0` -> `0x6FD01430`):
  - Activating `[currentRoom, ...ppRoomsNearWithoutCurrent]` pushes onto the Act's new-room singly-linked list (head insertion -> processed in reverse order).
  - Per room, `0x6FD01430` spawns preset objects (including `Objects.txt` `Sync == 0` server-only markers such as `385` `CainStart`), then preset monsters, then warp tiles.

---

## 2. Bounded Unit-Seed Roll (`0x6FC21180` / `0x6FC211D0`)

- If `limit <= 0`: returns `0` **without** advancing `pSeed`.
- Else advances `pSeed` once (`uint64 prod = uint64(lo) * 0x6AC690C5 + uint64(hi); lo = uint32(prod); hi = uint32(prod >> 32)`):
  - If `(limit & (limit - 1)) == 0`: returns `lo & (limit - 1)`.
  - Else: returns `uint32(lo) % uint32(limit)`.

---

## 3. Per-Act Monster Component Palette (`0x6FCEA5F0` -> `0x6FCFF1A0`) & `MONSTER_ChooseOutfit` (`0x6FCCF730`)

- Binary table layout (`Patch_D2.mpq`):
  - `monstats.bin`: stride `0x1A8`, `int16 wMonStatsEx` at `+0x18`.
  - `monstats2.bin`: stride `0x134`, `uint8 nComponentVariants[16]` at `+0x15..+0x24`, `uint8 nTotalPieces` at `+0xEC`.
- `0x6FCEA5F0(pGame, pUnit)` (called in `MONSTER_AllocMonsterData` `0x6FCD0320` at `0x6FCD0442`):
  1. `dwClassId` in `{195, 196, 294, 296}` (`0x6FCEA620..0x6FCEA63D`, jump table `0x6FCEA6F8`) -> returns `NULL` (`0` rolls).
  2. Searches the Act's 13-slot monster palette (`pGame->pMonReg[nAct]`, max `13` distinct `dwClassId`s):
     - If already registered: returns cached entry (`0` rolls here).
     - If `slotsUsed >= 13`: returns `NULL`.
  3. Checks `MonStats2.nTotalPieces > 2` (`0x6FCEA6C7`):
     - If `<= 2` (e.g. `kashya` 150, `warriv1` 155, `akara` 148, `charsi` 154 have `nTotalPieces = 1`): does **not** consume a palette slot; returns an empty entry (`outfits = []`, `0` rolls here).
     - If `> 2` (e.g. `rogue1` 152 has `nTotalPieces = 8`, `variants = [1,1,1,1,1,0,2,0,2,2,...]`): allocates one of the 13 Act slots and calls `0x6FCFF1A0(&pUnit->tSeed, entry, 3)`:
       - Collects indices `multi = [i for i in 0..15 if variants[i] > 1]`.
       - `req = min(3, 1 << multi.length)`.
       - Outfit `0`: for `i = 0..15`, `variants[i] > 1 ? randLim(&pUnit->tSeed, variants[i]) : 0`; `req--`.
       - If `req > 0 && multi.length > 0`:
         - If `multi.length == 1`: `c1 = c2 = multi[0]`.
         - Else picks two distinct component indices without replacement from `multi`:
           `i1 = randLim(seed, multi.length); c1 = multi[i1]; multi[i1] = multi[last]; multi.pop(); i2 = randLim(seed, multi.length); c2 = multi[i2]`.
         - Repeats `req` times: copies outfit `0`, runs `retries = 3` do-while loop rolling `cand[c1] = randLim(seed, variants[c1])` (and `cand[c2] = randLim(seed, variants[c2])` when `c1 != c2`); if `cand` equals any already-generated outfit in `entry`, decrements `retries` and re-rolls while `retries != 0`; appends `cand`.
- `MONSTER_ChooseOutfit` (`0x6FCCF730`, called from `MONSTER_InitStats` at `0x6FCCFDFD`):
  - If `entry != NULL && entry.outfits.length > 0`: `idx = randLim(&pUnit->tSeed, entry.outfits.length)` (**1 roll**), copies `entry.outfits[idx]`.
  - Else: for `i = 0..15`, if `variants[i] > 0`, rolls `randLim(&pUnit->tSeed, variants[i])` (**rolls even when `variants[i] == 1`**!), else `0`.

---

## 4. `MONSTER_InitStats` (`0x6FCCFDB0`), `D2Common #11089` (`0x6FDA4A00`) & `0xAC` `lifePct` (`0x6FC97060`)

- **Level (`STAT_LEVEL = 12`, `0x6FCCFE7F..0x6FCCFF2C`)**:
  - In Normal (`nDifficulty == 0`), or when `MonStats.boss` or `MonStats.noRatio`: uses `MonStats.Level[0]` directly (**not** clamped to `1`; town NPCs and `rogue1` remain `level = 0`).
  - On Nightmare/Hell (`nDifficulty > 0`) when `!boss && !noRatio`: uses area `MonLvlEx[nDifficulty]`.
- **Base HP Roll (`0x6FDA4A00` + `0x6FCD0036..0x6FCD0080`) & Sparse `STATLIST_SetStat` (`0x6FD8A280`)**:
  - `D2Common #11089` (`0x6FDA4A00`): looks up `MonLvl.bin[clamp(level, 0, nMonLvl - 1)]` (`MonLvl[0].L-HP = [1, 1, 1]`). Unless `noRatio`, scales `minHP = (rawMinHP * lHp) / 100`, `maxHP = (rawMaxHP * lHp) / 100`.
  - `0x6FCD0043`: rolls `hp = minHP + randLim(&pUnit->tSeed, maxHP - minHP + 1)` — **inclusive `+1`**, so `pUnit->tSeed` always advances once even when `minHP == 0 && maxHP == 0` (yielding `hp = 0, maxHp = 0` for Akara/Charsi/Kashya/Warriv and `1..2` HP for `rogue1`).
  - `D2Common.dll` `STATLIST_SetStat` (`0x6FD8A280..0x6FD8A324`): when `nValue == 0`, `BaseStats` never inserts a zero stat (`0x6FD8A2BC: test eax, eax; jz ret`) and removes any existing entry (`0x6FD8A2ED: call 0x6FD881A0`). Thus `0`-HP town NPCs (`MONSTER_InitStats` passing `0` to `STAT_MAXHP = 7` at `0x6FCD0075`) have no `'maxhp'` entry in `BaseStats` or `FullStats`, so `STATLIST_UnitGetStatValue(pUnit, 7, 0)` returns `0` without applying `ItemStatCost` `minAccr = 1`.
- **`S2C 0xAC` `MonsterAssign` `lifePct` (`D2Game.dll` `0x6FC97060`)**:
  - Returns `0` when the monster is dead; returns `0x80` (`128`) whenever `maxHp <= 0 || hp >= maxHp`, so live `0`-HP town NPCs always transmit `lifePct = 128` (`0x80`).

---

## 5. `SUNIT_SetAlignment` (`0x6FD004B0`) & `SKILLS_RefreshPassiveSkills` (`0x6FCBA1A0`)

- `SUNIT_SetAlignment` (`0x6FD004B0..0x6FD0055F`): sets `STATE_ALIGNMENT = 105` (`States.txt` row `105` `alignment`, `remondeath = 0`) on every player (`dwType == 0`) and monster (`dwType == 1`), persisting across death.
- `Skills.txt` `passivestate` -> `States.txt` row IDs (`29` skills):
  `9->64`, `13->65`, `18->66`, `23->67`, `29->68`, `33->69`, `37->70`, `61->71`, `63->72`, `65->73`, `69->97` (`skel_mastery`), `79->111` (`golem_mastery`), `89->160`, `100->181`, `105->182`, `108->67`, `110->183`, `127->74`, `128->75`, `129->76`, `134->77`, `135->78`, `136->79`, `141->80`, `145->81`, `148->82`, `153->83`, `252->152`, `263->155`.
