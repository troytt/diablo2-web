# D2Game.dll & D2Common.dll — Knockback, Crushing Blow, and Slow Target (1.13c)

Binary ground truth from `samples/d2/D2Game.dll` (image base `0x6FC20000`) and `samples/d2/D2Common.dll` (image base `0x6FD50000`), cross-referenced with `samples/d2/excel/ItemStatCost.txt`, `Properties.txt`, `MonStats.txt`, `MonStats2.txt`, `Skills.txt`, and `States.txt`.

---

## 1. Item Knockback (`itemeventfunc 7`, `STAT_ITEM_KNOCKBACK = 81`)

- **Table Wiring**:
  - `ItemStatCost.txt`: `item_knockback` (`ID = 81`), `itemevent1 = DoMeleeDamage` (`6`), `itemeventfunc1 = 7`, `itemevent2 = DoMissileDamage` (`7`), `itemeventfunc2 = 7`.
- **Handler**: `D2Game.dll` `0x6FCCCE60..0x6FCCCF0B` (`ITEMEVENTS_ApplyKnockback`).

### Key Assembly (`0x6FCCCE60..0x6FCCCF0B`)

```asm
6fccce60: push 0x0
6fccce62: push 0x51                   ; statId = 81 (STAT_ITEM_KNOCKBACK)
6fccce64: push eax                    ; pAttacker
6fccce65: call 0x6fd1d1ae             ; D2Common.#10910 (STATLIST_GetUnitStatUnsigned)
6fccce6a: test eax, eax
6fccce6c: jle  0x6fcccf09             ; if item_knockback <= 0, return 0
...
6fccce78: mov  eax, [esi]             ; pDefender->dwUnitType
6fccce7a: mov  ebx, 0x40              ; default threshold = 64 / 128 (50%)
6fccce7f: cmp  eax, 0x1               ; UNIT_MONSTER?
6fccce82: jne  0x6fcccec2             ; UNIT_PLAYER uses default 64 / 128 (50%)
6fccce84: mov  ecx, [esi+0x4]         ; pDefender->dwClassId (hcIdx)
...
6fccceae: mov  al, [eax+0x5]          ; pMonStats2->fFlags[1] (MonStats2.txt flags byte +0x05)
6fccceb1: test al, 0x8                ; bit 3 (0x08) = MonStats2.large (sizeX >= 3)
6fccceb3: je   0x6fcccebc
6fccceb5: mov  ebx, 0x20              ; Large monster threshold = 32 / 128 (25%)
6fccceba: jmp  0x6fcccec2
6fcccebc: test al, 0x4                ; bit 2 (0x04) = MonStats2.small (sizeX <= 1)
6fcccebe: je   0x6fcccec2             ; if neither large nor small -> Medium (64 / 128 = 50%)
6fcccec0: mov  ebx, 0x80              ; Small monster threshold = 128 / 128 (100%)
6fcccec2: add  ebp, 0x20              ; &pAttacker->pSeed
...
6fcccedf: and  eax, 0x7f              ; roll = SUNITDMG_RollRandom(&pAttacker->pSeed) & 0x7F (0..127)
6fcccee2: cmp  eax, ebx               ; roll < threshold?
6fcccee4: jge  0x6fcccf09
6fcccee6: mov  eax, [esp+0x18]        ; pDamage
6fccceea: or   word ptr [eax+0x4], 0x8 ; pDamage->wResultFlags |= 0x08 (RESULTFLAG_KNOCKBACK)
```

### Rules Derived from `0x6FCCCE60`

1. **Size-Based Roll Scope**: The `128/128` (`100%` Small), `64/128` (`50%` Medium / Player), `32/128` (`25%` Large) roll in `0x6FCCCE60` applies **only** to the `item_knockback` (`stat 81`) item event (`itemeventfunc 7`).
2. **No Ranged Halving**: Both `itemevent1 = DoMeleeDamage` and `itemevent2 = DoMissileDamage` invoke `itemeventfunc 7` (`0x6FCCCE60`), which ignores `nEvent` and uses the exact same `128 / 64 / 32` out of `128` thresholds for melee and missile hits.
3. **Skill Knockback Bypasses `0x6FCCCE60`**: Skills that set `pDamage->wResultFlags |= 0x08` directly in their skill handlers or `Skills.txt` `ResultFlags = 8` (`#97 Smite`, `#107 Charge`, `#119 Sanctuary`, `#126 Bash`, `#132 Leap`, `#143 Leap Attack`, `#229 Molten Boulder` vs non-large, `#273 Mind Blast`, `#326 BearSmite`, `#43 Telekinesis` after its `35%` `Param2` roll at `0x6FC631C0`, `#253 Psychic Hammer` after its tier roll) do **not** roll the `128 / 64 / 32` size resistance in `knockbackMonster`.

---

## 2. Knockback Gating, Path Distance, and Animation Mode (`D2Game.dll` & `D2Common.dll`)

### 2.1 Post-Damage ResultFlags Gate (`0x6FCFD00E..0x6FCFD030`)

In `SUNITDMG_ExecuteEvents` (`0x6FCFCF30`):
- At `0x6FCFD00E`, when `pDamage->wResultFlags & 0x08` (`RESULTFLAG_KNOCKBACK`) is set on a monster target, `D2Game.dll` calls `0x6FC21560(pMonster, 13)` to check `MonStats2.txt` flag `13` (`mKB`, bit `0x2000` in the mode bitmask at `MONSTER_PATH_DATA[hcIdx * 16 + 12]`).
- If `mKB == 0`:
  ```asm
  6fcfd022: and eax, 0xfffffff7        ; clear 0x08 (RESULTFLAG_KNOCKBACK)
  6fcfd025: or  eax, 0x4               ; set 0x04 (RESULTFLAG_GETHIT)
  ```
- Otherwise (`mKB != 0`), at `0x6FCFD119`, `D2Game.dll` triggers mode `13` (`MONMODE_KNOCKBACK`) on a monster or mode `19` (`PLRMODE_KNOCKBACK`) on a player.

### 2.2 Monster Mode `13` (`MONMODE_KNOCKBACK`) Start (`0x6FC95160..0x6FC9526F`)

```asm
6fc95179: push 0x3                    ; MonStats2 flag 3 = mGH (bit 0x0008)
6fc9517b: push esi                    ; pMonster
6fc9517c: call 0x6fc21560
6fc95181: test eax, eax
6fc95183: je   0x6fc95267             ; abort if mGH == 0
6fc95189: push 0xd                    ; MonStats2 flag 13 = mKB (bit 0x2000)
6fc9518b: push esi                    ; pMonster
6fc9518c: call 0x6fc21560
6fc95191: test eax, eax
6fc95193: je   0x6fc95267             ; abort if mKB == 0
...
6fc951ee: push 0x8                    ; PATHTYPE_KNOCKBACK = 8
6fc951f0: push ebp                    ; pPath
6fc951f1: call 0x6fc2aafc             ; D2Common.#10190 (PATH_SetType)
6fc951f6: mov  ecx, esi
6fc951f8: call 0x6fc218a0             ; MONSTER_GetBaseId(pMonster) -> MonStats.txt BaseId
6fc951fd: xor  edx, edx
6fc951ff: cmp  eax, 0x4e              ; BaseId == 78 ('sandmaggot1', hcIdx 49..53)?
6fc95202: sete dl
6fc95205: push ebp                    ; pPath
6fc95206: dec  edx
6fc95207: and  edx, 0xfffffffb
6fc9520a: add  edx, 0xa               ; edx = (BaseId == 78) ? 10 : 5
6fc9520d: push edx
6fc9520e: call 0x6fd1d0ce             ; D2Common.#10198 (PATH_SetDistance)
...
6fc95226: mov  edx, 0xd               ; MONMODE_KNOCKBACK = 13
6fc9522b: mov  ecx, esi
6fc9522d: call 0x6fc95070             ; start mode 13 using GH animation sequence
```

- **Tick & Completion (`0x6FC96A10` & `0x6FC965E0`)**:
  - `0x6FC96A10` ticks the monster's `PATHTYPE_KNOCKBACK` movement each frame; once the step path completes and the `GH` animation finishes, `0x6FC965E0` transitions the monster back to `MONMODE_NEUTRAL = 1` and refreshes AI (`0x6FC61E90`).
  - **No `States.txt` `'knockback'` State**: `States.txt` has no `knockback` row. Knockback is strictly a unit animation/movement mode (`MONMODE_KNOCKBACK = 13` / `PLRMODE_KNOCKBACK = 19`), never a `StateBus` state with a hardcoded 10-frame timer.

### 2.3 `D2Common.dll` Knockback Trajectory & Collision (`0x6FDB7390` & `0x6FDB6C20`)

In `D2Common.dll` `0x6FDB7390` (`PATH_BuildKnockbackServer`, `PATHTYPE_KNOCKBACK = 8`):

```asm
6fdb73a3: movzx ecx, byte ptr [edi+0x36] ; ecx = pPath->nDist (5 standard, 10 sandmaggot1)
6fdb73a7: shr  ecx, 0x1
6fdb73a9: add  ecx, 0x1                  ; stepDist = (nDist >> 1) + 1  (3 or 6 sub-tiles)
...
6fdb73ea: cmp  ebx, ebp                  ; maxDelta = max(abs(dx), abs(dy))
6fdb73ec: jle  0x6fdb7406
6fdb73ee: imul eax, ecx                  ; stepDist * dx
6fdb73f1: cdq
6fdb73f2: idiv ebx                       ; trunc((stepDist * dx) / maxDelta)
```

1. **Deterministic Distance**:
   - `stepDist = (nDist >> 1) + 1`:
     - Standard monster or player (`nDist = 5`): `(5 >> 1) + 1 = 3` sub-tiles.
     - Sand Maggot family (`BaseId == 78`, `hcIdx 49..53`, `nDist = 10`): `(10 >> 1) + 1 = 6` sub-tiles.
   - There is no random `2 + rand(2)` distance roll.
2. **Chebyshev Scaling**:
   - Given `dx = targetX - sourceX`, `dy = targetY - sourceY`, and `maxDelta = Math.max(Math.abs(dx), Math.abs(dy))`:
     - `destX = targetX + Math.trunc((stepDist * dx) / maxDelta)`
     - `destY = targetY + Math.trunc((stepDist * dy) / maxDelta)`
3. **Bresenham Obstacle Raycast (`0x6FDB6C20`)**:
   - Steps along the line from `(targetX, targetY)` toward `(destX, destY)` testing walkability at each sub-tile; stops at the last clear sub-tile before any wall/obstacle. If the very first step is blocked, knockback aborts (`0x6FDB742C`).

---

## 3. Crushing Blow (`itemeventfunc 16`, `STAT_ITEM_CRUSHINGBLOW = 136`)

- **Table Wiring**:
  - `ItemStatCost.txt`: `item_crushingblow` (`ID = 136`), `itemevent1 = DoMeleeDamage` (`6`), `itemeventfunc1 = 16`, `itemevent2 = DoMissileDamage` (`7`), `itemeventfunc2 = 16`.
- **Handler**: `D2Game.dll` `0x6FCCCC30..0x6FCCCD93` (`ITEMEVENTS_ApplyCrushingBlow`).

### Key Assembly (`0x6FCCCC30..0x6FCCCD93`)

```asm
6fcccc3d: push 0x0
6fcccc3f: push 0x88                   ; statId = 136 (STAT_ITEM_CRUSHINGBLOW)
6fcccc44: push eax                    ; pAttacker
6fcccc45: call 0x6fd1d1ae             ; D2Common.#10910
6fcccc4a: mov  edi, eax
6fcccc4c: test edi, edi
6fcccc4e: jle  0x6fcccc82             ; return 0 if cbChance <= 0
...
6fcccc6f: edx = SUNITDMG_RollRandom(&pAttacker->pSeed) % 100
6fcccc76: cmp  edx, edi
6fcccc78: jge  0x6fcccc82             ; return 0 if roll >= cbChance
...
6fcccc86: mov  eax, [esi]             ; pDefender->dwUnitType
6fcccc88: mov  ebx, 0x4               ; default divisor ebx = 4 (1/4 HP)
6fcccc8d: test eax, eax               ; UNIT_PLAYER (0)?
6fcccc8f: jne  0x6fcccc98
6fcccc91: mov  ebx, 0xa               ; UNIT_PLAYER -> ebx = 10 (1/10 HP)
6fcccc96: jmp  0x6fcccce8
6fcccc98: cmp  eax, 0x1               ; UNIT_MONSTER (1)?
6fcccc9b: jne  0x6fcccce8
6fcccc9d: push esi
6fcccc9e: call 0x6fd1cd88             ; D2Common.#11104 (MONSTERS_GetHirelingTypeId)
6fcccca3: test eax, eax
6fcccca5: je   0x6fccccae
6fcccca7: mov  ebx, 0xa               ; Hireling (mercenary) -> ebx = 10 (1/10 HP)
6fccccac: jmp  0x6fcccce8
6fccccae: push esi
6fccccaf: push 0x0
6fccccb1: call 0x6fd1cd82             ; D2Common.#10064 (MonStats.txt boss == 1)
6fccccb6: test eax, eax
6fccccb8: jne  0x6fccccca
6fccccba: mov  edx, 0x2               ; MONFLAG_SUPERUNIQUE = 0x02 (Unique / SuperUnique boss)
6fccccbf: mov  ecx, esi
6fccccc1: call 0x6fc42a80             ; MONSTER_CheckTypeFlag (pMonsterData->fTypeFlags & 0x02)
6fccccc6: test eax, eax
6fccccc8: je   0x6fcccccf             ; Normal (0x00), Minion (0x10), Champion (0x04) keep ebx = 4!
6fccccca: mov  ebx, 0x8               ; Boss / Unique / SuperUnique -> ebx = 8 (1/8 HP)
6fcccccf: push 0x0
6fccccd1: push 0x64                   ; statId = 100 (STAT_MONSTER_PLAYERCOUNT)
6fccccd3: push esi                    ; pDefender
6fccccd4: call 0x6fd1d1ae             ; D2Common.#10910
...
6fcccce1: call 0x6fccf5f0             ; scale ebx by /players N HP bonus table (0x6FD1B614)
6fcccce6: mov  ebx, eax
6fcccce8: cmp  dword ptr [esp+0x20], 0x6 ; nEvent == 6 (ITEMEVENT_DOMISSILEDAMAGE)?
6fcccced: jne  0x6fccccf1
6fccccef: add  ebx, ebx               ; Ranged attack doubles divisor (4->8, 8->16, 10->20)
```

### Rules Derived from `0x6FCCCC30`

1. **Base Divisor (`ebx`) by Target Classification**:
   - **Normal Monster, Minion (`0x10`), and Champion (`0x04`)**: `ebx = 4` (`1/4` melee, `1/8` ranged).
     - In `D2Game.dll`, `pMonsterData->fTypeFlags` (`+0x16`) sets bit `0x04` for Champions (`0x6FC3F784`) and bit `0x02` for Uniques/SuperUniques (`0x6FC429F0`). Because `0x6FCCCCBA` only tests `0x02` (`call 0x6FC42A80(pDefender, 2)`) and `D2Common.#10064` (`MonStats.txt` `boss == 1`), **Champion monsters (`rank === 'champion'`) use divisor `4` (`1/4`), NOT `8` (`1/8`)**!
   - **Boss (`MonStats.txt` `boss == 1`) and Unique / SuperUnique (`fTypeFlags & 0x02`)**: `ebx = 8` (`1/8` melee, `1/16` ranged).
   - **Player (`UNIT_PLAYER`) and Hireling / Mercenary (`D2Common.#11104 != 0`)**: `ebx = 10` (`1/10` melee, `1/20` ranged).
2. **`/players N` Scaling on Monster Targets (`0x6FCCF5F0` & `0x6FD1B614`)**:
   - Reads defender's `STAT_MONSTER_PLAYERCOUNT` (`stat 100`, clamped `>= 1`).
   - Looks up the monster HP bonus percentage from `0x6FD1B614`: `hpBonusPct = (playerCount - 1) * 50` (`0, 50, 100, 150, 200, 250, 300, 350` for `playerCount = 1..8`, or `+50%` per additional player above `8`).
   - Scales the divisor before the ranged doubling:
     `ebx = ebx + Math.trunc((ebx * hpBonusPct) / 100)`.
3. **Ranged Doubling (`nEvent == 6`)**:
   - When triggered from `DoMissileDamage` (`nEvent == 6`), `ebx *= 2`.
4. **Physical Resistance Mitigation (`0x6FCCCD31..0x6FCCCD6A`)**:
   - `cbDmg = Math.trunc(defenderHp / ebx)` (computed in `1/256` fixed-point HP and converted to integer damage).
   - Queries `STAT_DAMAGERESIST` (`stat 36`), capped at `100`.
   - **Only when `physRes > 0`**: `cbDmg -= Math.trunc((cbDmg * physRes) / 100)`. Negative `STAT_DAMAGERESIST` (e.g., from Amplify Damage or Decrepify) does **not** increase Crushing Blow damage.

---

## 4. Slow Target (`itemeventfunc 19`, `STAT_ITEM_SLOW = 150` & Clay Golem `#75`)

- **Handlers**:
  - `D2Game.dll` `0x6FCCD2C0..0x6FCCD460` (`ITEMEVENTS_ApplySlow`, `itemeventfunc 19`).
  - `D2Game.dll` `0x6FD13E10` (`EventFunc 27` for Clay Golem `#75`, `aurastat1 = item_slow = dm34`), which writes `STAT_ITEM_SLOW` (`stat 150`) on the Golem and delegates to `0x6FCCD2C0`.
- **Target Cap (`edi`) in `0x6FCCD2C0`**:
  - Default `edi = 90` (`90%` vs normal monsters).
  - `UNIT_PLAYER` (`dwUnitType == 0`): `edi = 50` (`50%`).
  - `UNIT_MONSTER` (`dwUnitType == 1`):
    - If `D2Common.#10064 != 0` (`boss == 1`), `D2Common.#11104 != 0` (Hireling), or `0x6FC42A80(pDefender, 0x0E) != 0` (Unique `0x02`, Champion `0x04`, or Boss `0x08`): `edi = 50` (`50%`).
    - Else if `D2Common.#10062 != 0` (`SuperUnique`): `edi = 75` (`75%`).
- **Duration**: `750` frames (`0x2EE` = `30` seconds at `25` fps).

---

## 5. Grizzly (`druidbear` `#428`) `BearSmite` (`#326`) AI Roll

- In `MonStats.txt`, `druidbear` (`hcIdx = 428`) has:
  - `Skill1 = BearSmite` (`#326`), `Skill1Mode = A2`
  - `aip1 = 65`, `aip2 = 35`, `aip3 = 50` (`50%` across Normal/Nightmare/Hell)
- In `Skills.txt`, `BearSmite` (`#326`) has `ResultFlags = 8` (`RESULTFLAG_KNOCKBACK`), `HitFlags = 2`, `SrcDam = 128`, `calc1 = ln12` (`%ED`), `len = dm34` (stun length).
- In `D2Game.dll` `AITHINK_Fn112_DruidBear`, when the Grizzly is in melee range and decides to attack, it rolls `aip3` (`50%`) to choose `Skill1` (`BearSmite #326`, which applies knockback + stun) versus a normal melee attack (`A1`/`A2`, which does not knock back).
