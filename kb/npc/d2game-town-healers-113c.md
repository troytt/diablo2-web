# 1.13c Town Healer NPCs (`0x6FCDD810` / `0x6FCDD490` / `0x6FCDCBE0` / `0x6FCDC920` / D2Common #10590)

## Overview & Architecture

In Diablo II: Lord of Destruction v1.13c, the 6 town healer NPCs (`Akara` `148` in Act 1, `Atma` `176` and `Fara` `178` in Act 2, `Ormus` `255` in Act 3, `Jamella` `405` in Act 4, and `Malah` `513` in Act 5) automatically restore **all three player vitals** (`STAT_HITPOINTS` `6`, `STAT_MANA` `8`, and `STAT_STAMINA` `10`) to their accrued maximums, cure poison/freeze/curable curses on the player, and heal HP + curable states on the player's mercenary and pets via `sub_6FCB6AF0(pPlayer, 0x6FCDCBE0, &bHealed)`.

## Binary Ground Truth

### 1. Healer NPC Class Dispatch: `D2Game.dll` `0x6FCDD810`

Disassembly from `samples/d2/D2Game.dll`:
```assembly
6fcdd826: mov    ecx, [eax+0x4]        ; pNpc->dwClassId (hcIdx)
6fcdd829: cmp    ecx, 0x94             ; 148 = Akara (Act 1)
6fcdd82f: je     0x6fcdd859
6fcdd831: cmp    ecx, 0x201            ; 513 = Malah (Act 5)
6fcdd837: je     0x6fcdd859
6fcdd839: cmp    ecx, 0xb0             ; 176 = Atma (Act 2)
6fcdd83f: je     0x6fcdd859
6fcdd841: cmp    ecx, 0xb2             ; 178 = Fara (Act 2)
6fcdd847: je     0x6fcdd859
6fcdd849: cmp    ecx, 0x195            ; 405 = Jamella (Act 4)
6fcdd84f: je     0x6fcdd859
6fcdd851: cmp    ecx, 0xff             ; 255 = Ormus (Act 3)
6fcdd857: jne    0x6fcdd867
6fcdd859: mov    ecx, [esp+0x4]        ; pGame
6fcdd85d: push   eax                   ; pNpc
6fcdd85e: mov    eax, [esp+0xc]        ; pPlayer
6fcdd862: call   0x6fcdd490            ; NPC_HealPlayerAndPets
6fcdd867: ret    0x8
```

### 2. Player Healer Execution Function: `D2Game.dll` `0x6FCDD490`

`0x6FCDD490` restores **HP (stat 6)**, **Mana (stat 8)**, and **Stamina (stat 10)** on the player using `D2Common_GetMaxLife` (`0x6FC2A3A0`), `D2Common_GetMaxMana` (`0x6FC2A4EA`), and `D2Common_GetMaxStamina` (`0x6FC2A460`), sends `D2GAME_SendStatToClient` (`0x6FCEC2F0`) for each restored vital, cures `STATE_POISON` (`2`), `STATE_FREEZE` (`1`), and `0x6FCDC920` curable states, and then invokes `0x6FCB6AF0` with ally callback `0x6FCDCBE0`:

```assembly
6fcdd4c4: call   0x6fc2a3a0            ; ebp = STATLIST_GetMaxLife(pPlayer)
6fcdd4c9: push   0
6fcdd4cb: push   6                     ; STAT_HITPOINTS (6)
6fcdd4cd: push   ebx
6fcdd4ce: mov    ebp, eax
6fcdd4d0: call   0x6fc2a42a            ; STATLIST_UnitGetStatValue(pPlayer, 6, 0)
6fcdd4d5: cmp    eax, ebp
6fcdd4dc: jae    0x6fcdd4fb
...
6fcdd4e4: call   0x6fc2a472            ; STATLIST_SetUnitStat(pPlayer, 6, maxHp, 0)
6fcdd4f2: call   0x6fcec2f0            ; D2GAME_SendStatToClient(pPlayer, 6, maxHp)

6fcdd4fc: call   0x6fc2a4ea            ; ebp = STATLIST_GetMaxMana(pPlayer)
6fcdd501: push   0
6fcdd503: push   8                     ; STAT_MANA (8)
6fcdd505: push   ebx
6fcdd506: mov    ebp, eax
6fcdd508: call   0x6fc2a42a            ; STATLIST_UnitGetStatValue(pPlayer, 8, 0)
6fcdd50d: cmp    eax, ebp
6fcdd50f: jae    0x6fcdd52e
...
6fcdd517: call   0x6fc2a472            ; STATLIST_SetUnitStat(pPlayer, 8, maxMana, 0)
6fcdd525: call   0x6fcec2f0            ; D2GAME_SendStatToClient(pPlayer, 8, maxMana)

6fcdd52f: call   0x6fc2a460            ; ebp = STATLIST_GetMaxStamina(pPlayer)
6fcdd534: push   0
6fcdd536: push   0xa                   ; STAT_STAMINA (10)
6fcdd538: push   ebx
6fcdd539: mov    ebp, eax
6fcdd53b: call   0x6fc2a42a            ; STATLIST_UnitGetStatValue(pPlayer, 10, 0)
6fcdd540: cmp    eax, ebp
6fcdd542: jae    0x6fcdd561
...
6fcdd54a: call   0x6fc2a472            ; STATLIST_SetUnitStat(pPlayer, 10, maxStamina, 0)
6fcdd558: call   0x6fcec2f0            ; D2GAME_SendStatToClient(pPlayer, 10, maxStamina)

6fcdd561: push   2                     ; STATE_POISON (2)
...
6fcdd580: push   1                     ; STATE_FREEZE (1)
...
6fcdd59e: call   0x6fcdc920            ; clearCurableStates(pPlayer)
...
6fcdd5b1: mov    ebx, 0x6fcdcbe0       ; NPC_HealAllyCallback (merc/pets)
6fcdd5b6: call   0x6fcb6af0            ; iterate player's merc & pets
6fcdd5c7: push   0xa                   ; event sound 0x0A if bHealed == 1
6fcdd5c9: call   0x6fcfffd0
```

### 3. Mercenary & Pet Callback: `D2Game.dll` `0x6FCDCBE0`

`0x6FCDCBE0` is the **ally/pet callback** passed to `sub_6FCB6AF0` (monsters/mercenaries/summons only possess `STAT_HITPOINTS` `6`, not player Mana/Stamina):
```assembly
6fcdcbe0: push ebx
6fcdcbe1: mov ebx, [esp+8]             ; Unit* pAlly (mercenary or pet)
6fcdcbe5: push esi
6fcdcbe6: push edi
6fcdcbe7: push 0
6fcdcbe9: push 6                       ; STAT_HITPOINTS (stat 6)
6fcdcbeb: push ebx
6fcdcbec: call 0x6fc2a42a              ; STATLIST_UnitGetStatValue(pAlly, 6, 0) -> current HP
6fcdcbf1: push ebx
6fcdcbf2: mov esi, eax
6fcdcbf4: call 0x6fc2a3a0              ; STATLIST_GetMaxLife(pAlly) -> max HP
6fcdcbf9: cmp esi, eax
6fcdcbfb: mov edi, [esp+0x14]          ; BOOL* pbUsed
6fcdcbff: jge 0x6fcdcc0f
6fcdcc01: push 0
6fcdcc03: push eax                     ; max HP
6fcdcc04: push 6                       ; STAT_HITPOINTS
6fcdcc06: push ebx
6fcdcc07: call 0x6fc2a472              ; STATLIST_SetUnitStat(pAlly, 6, maxHp, 0)
6fcdcc0c: mov byte ptr [edi], 1        ; *pbUsed = 1
6fcdcc0f: call 0x6fcdc920              ; clearCurableStates(pAlly)
...
```

Key observations:
1. **Player Full Vital Restoration (`0x6FCDD490`)**: Town healers restore **all three player vitals** (`STAT_HITPOINTS` `6`, `STAT_MANA` `8`, and `STAT_STAMINA` `10`) to their accrued maximums (including item/charm/skill bonuses), and send stat updates (`0x6FCEC2F0`) to the client whenever `current < max`.
2. **Mercenary & Pet Healing (`0x6FCDCBE0`)**: `0x6FCDD490` dispatches `0x6FCDCBE0` via `sub_6FCB6AF0` to heal `STAT_HITPOINTS` (`6`) and clear curable states on the player's active mercenary and summons.
3. **Curable States Dispatch (`0x6FCDC920`)**: `0x6FCDC920` iterates all states in `States.txt` and calls D2Common ordinal #10590 (`curable == 1`), in addition to explicit removal of `STATE_POISON` (`2`) and `STATE_FREEZE` (`1`).

### 4. Curable States Bitmask: D2Common Ordinal #10590 & `States.txt`

D2Common #10590 checks the bitmask compiled from the `curable` column in `States.txt`:
```
stateId >> 5, bit (stateId & 0x1F) in sgptDataTables->pStatesCurableBitmask
```

In 1.13c `States.txt`, exactly 13 states have `curable == 1`:
- `9` (`amplifydamage`)
- `19` (`weaken`)
- `23` (`dimvision`)
- `27` (`taunt`)
- `55` (`ironmaiden`)
- `56` (`terror`)
- `57` (`attract`)
- `58` (`lifetap`)
- `59` (`confuse`)
- `60` (`decrepify`)
- `61` (`lowerresist`)
- `113` (`defense_curse`)
- `114` (`blood_mana`)

Combined with `STATE_FREEZE` (1) and `STATE_POISON` (2), the complete set of states cured by 1.13c healers and wells is:
`[1, 2, 9, 19, 23, 27, 55, 56, 57, 58, 59, 60, 61, 113, 114]`.

Non-curable states (such as `11` Cold slow, `17` Inner Sight, `28`/`29` Conviction, `89` Battle Cry, `156` Cloaked) are NOT cleared by town healers.
