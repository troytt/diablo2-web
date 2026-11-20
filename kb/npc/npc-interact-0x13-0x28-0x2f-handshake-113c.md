# NPC Interaction 3-Way Handshake (`C2S 0x13` -> `S2C 0x28` -> `C2S 0x2F` -> `C2S 0x38`) — v1.13c

## Authoritative Binary Sources

- `D2Client.dll` v1.13c (imagebase `0x6fab0000`)
- `D2Game.dll` v1.13c (imagebase `0x6fc20000`)

## Why Optimistic Client `C2S 0x2F` Causes Empty Vendor Shops

When client predicted coordinates (`ClientMovementPredictor`) place the player within `D2Common.#10407 <= 2` of an NPC while the authoritative server still sees `UNITS_GetDistanceToOtherUnit > 6`:

1. If the client optimistically opens the NPC dialog menu (`npcInteraction.npcId = npcId`) and sends `C2S 0x2F` (`NpcInit`) alongside `C2S 0x13` (`Interact`), the server has not yet called `MONSTER_Interact` (`0x6fc687a0`), so `pMonsterData->pInteract` is still `NULL` (either `6 < dist < 9` where the server is still walking the player via `0x6fcee120`, or `dist >= 9` where `0x13` was dropped).
2. `D2Game` `0x6fcee440 -> 0x6fceccf0 -> 0x6fc68b60` (`C2S 0x2F`) requires an active `D2MonsterInteractStrc` entry in `state == 0`, so the premature `0x2F` is silently ignored.
3. When the player clicks **Trade** or **Gamble** in the prematurely opened menu, the client clears `containers.shop` and sends `C2S 0x38` (`NpcEntityAction`), which `D2Game` `0x6fcefb30 -> 0x6fce00c0` (`0x6fce0163`) rejects because `pMonsterData->pInteract` is missing or not in `state == 1`, leaving an empty shop panel (`containers.shop.length === 0`).

## Exact Binary State Machine

### 1. Client Click or Deferred Walk Arrival (`D2Client.dll`)

- **Direct click in melee range** (`0x6fadac80..0x6fadadda`):
  - Checks `D2Common.#10407(pPlayer, pHoveredMonster) <= 2`.
  - Checks per-monster `200ms` (`0xC8`) throttle stored in `pMonster[+0xD4]` (`0x6fadadbc..0x6fadadda`).
  - Sends `C2S 0x59` (`MakeEntityMove`, 17 bytes) when Euclidean distance `<= 25` (`0x6fadad34..0x6fadad83`).
  - Sends **`C2S 0x13` (`Interact`, 9 bytes `[0x13, 1, npcId]`)** via `0x6fadad88 -> 0x6fac8e90`.
  - **Does NOT** open the NPC menu locally and **does NOT** send `C2S 0x2F` (`NpcInit`).
- **Deferred arrival during walk-to-NPC** (`0x6fac9ef0..0x6fac9fff`):
  - Once `D2Common.#10407 <= 2` and `0x804` LOS check succeed, stops local movement and sends **`C2S 0x13` (`Interact`)**.
  - **Does NOT** open the NPC menu locally and **does NOT** send `C2S 0x2F` (`NpcInit`).

### 2. Server `C2S 0x13` Handler (`D2Game.dll` `0x6fcf0910 -> 0x6fcf01d0 -> 0x6fcf03d0`)

- Computes `dist = UNITS_GetDistanceToOtherUnit(pPlayer, pNpc)` (`0x6fc2a538`):
  - `dist <= 6` (`0x6fcf0488`): invokes `MONSTER_Interact` (`0x6fc687a0`):
    - Allocates `D2MonsterInteractStrc` in `pMonsterData->pInteract` with `state = 0` (`mov [ebx+0x4], 0` at `0x6fc688c4`).
    - Marks `pPlayer->bInteract = 1` (`0x6fcffae0`).
    - Emits `S2C 0x27` (`NPCInfo`), `S2C 0x61` (`CanGoToAct`), and **`S2C 0x28` (`UpdateQuestInfo`, `updateType = 1`, `unitId = npcId`, 96-byte quest buffer)** (`0x6fc6892e..0x6fc68932`).
  - `6 < dist < 9` (`0x6fcf048d..0x6fcf04ae`): calls `0x6fcee120` to server-walk the player toward the NPC and invokes `MONSTER_Interact` upon arrival (which then emits `S2C 0x28`).
  - `dist >= 9`: drops `0x13`.

### 3. Client `S2C 0x28` Handler (`D2Client.dll` `0x6fafb8a0`)

- Validates `0 <= updateType <= 5` and `unitId > 0`:
  - **Unit found in client world (`0x6fafb955..0x6fafb9b7`)**:
    - Clears the `!` quest attention marker (`wantsInteract`) at `0x6fafb977` while capturing quest greeting state.
    - Opens the NPC menu when `updateType == 1` (`0x6fafb98b..0x6fafb99a`).
    - Emits **`C2S 0x2F` (`NpcInit`, 9 bytes `[0x2f, unitType, unitId]`)** (`0x6fafb9a5..0x6fafb9b7`) — the **sole** `0x2F` call site in `D2Client.dll`.
  - **Unit missing in client world (`0x6fafb923..0x6fafb93f`)**:
    - Clears active NPC interaction state and sends **`C2S 0x30` (`NpcCancel`)** so the server releases `pMonsterData->pInteract`.

### 4. Server `C2S 0x2F` & `C2S 0x38` Transitions (`D2Game.dll`)

- `C2S 0x2F` (`NpcInit`, `0x6fcee440 -> 0x6fceccf0 -> 0x6fc68b60`):
  - Verifies `|dx| <= 10 && |dy| <= 10` and `pInteract.state == 0`.
  - Transitions `pInteract.state: 0 -> 1` (`0x6fc68b80`) and runs `0x6fcdd810` (town healer HP/MP/stamina/poison/curse restore + quest init callbacks).
- `C2S 0x38` (`NpcEntityAction`, `0x6fcefb30 -> 0x6fce00c0`):
  - Verifies `pMonsterData->pInteract` exists (`0x6fce0163`), transitions `pInteract.state: 1 -> 2` (`0x6fc68710`), generates vendor inventory if needed (`0x6fcdf810`), and replicates shop items via `S2C 0x9C` (`AddToShop`, `0x6fcdcd90`).
