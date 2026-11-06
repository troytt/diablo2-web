# D2GS `0x5E` Party Button State Machine & `S2C 0x8B` / `0x8D` Handshake (1.13c)

## Scope

Authoritative reverse-engineering reference for the Diablo II: Lord of Destruction v1.13c multiplayer party invitation, cancellation, acceptance, leave/disband state machine, and hostility interaction across `samples/d2/D2Game.dll` (image base `0x6FC20000`) and `samples/d2/D2Client.dll` (image base `0x6FAB0000`).

---

## 1. C2S `0x5E` (`D2GS_PARTY`) Wire Format & Dispatch Table

- **Size**: 6 bytes (`samples/d2/D2Game.dll` packet table).
- **Layout**:
  - `offset +0x00` (`u8`): opcode `0x5E`
  - `offset +0x01` (`u8`): `nAction` (`0x06..0x09`)
  - `offset +0x02` (`u32 LE`): `dwTargetPlayerUnitId`

### Server Dispatcher: `D2Game.dll` `0x6FD10100` (`D2GAME_PACKET_Handler_0x5E_PartyButton`)

At `0x6FD10100..0x6FD1016A`, the server validates `pPlayer` (`sub_6FCBC160`), subtracts `6` from `pPacket[1]` (`add al, 0xfa`), checks `al <= 3`, and indexes into the 4-entry function pointer table at `0x6FD1A3B0`:

| `nAction` | Table Index (`nAction - 6`) | Handler VA (`D2Game.dll`) | Client Sender (`D2Client.dll`) | Meaning |
| :--- | :--- | :--- | :--- | :--- |
| `0x06` | `0` | `0x6FD10870` | `0x6FB4E5D0` (`state == 0` -> `push 6`) | Invite player (`inviter -> target`) |
| `0x07` | `1` | `0x6FD10900` | `0x6FB4E5D0` (`state == 4` -> `push 7`) | Cancel pending invitation (`inviter -> target`) |
| `0x08` | `2` | `0x6FD10D50` | `0x6FB4E5D0` (`state == 2` -> `push 8`) | Accept pending invitation (`invitee -> inviter`) |
| `0x09` | `3` | `0x6FD110F0` | `0x6FB4E3EF` (`push 9`) | Leave current party |

---

## 2. S2C `0x8B` (`PartyInvite` / Party Relationship) vs. S2C `0x8D` (`AssignPlayerToParty`)

### S2C `0x8B` (`6` bytes, sent via `D2Game.dll` `0x6FC3F250`)
- `offset +0x00` (`u8`): `0x8B`
- `offset +0x01` (`u32 LE`): `dwOtherPlayerUnitId` (the peer player ID relative to the recipient client)
- `offset +0x05` (`u8`): `nInviteOrPartyState`:
  - `0x00` (`0`): neutral / not in a party and no pending invite
  - `0x01` (`1`): in a party (either same party or another party)
  - `0x02` (`2`): `dwOtherPlayerUnitId` has invited the recipient (`"Invited you — click to Accept"`, client sends `0x5E 0x08`)
  - `0x04` (`4`): recipient has invited `dwOtherPlayerUnitId` (`"Invited by you — click to Cancel"`, client sends `0x5E 0x07`)

### S2C `0x8D` (`7` bytes, broadcast via `D2Game.dll` `0x6FCBC390` -> `0x6FC3F280`)
- `offset +0x00` (`u8`): `0x8D`
- `offset +0x01` (`u32 LE`): `dwPlayerUnitId`
- `offset +0x05` (`u16 LE`): `wPartyId` (`0xFFFF` = unpartied)

---

## 3. Detailed Handler Semantics in `D2Game.dll`

### 3.1 Action `0x06` — Invite (`0x6FD10870`)
1. Resolves both `pInviter` and `pTarget` (`dwTargetUnitId`). Rejects self-invite or missing/already-allied target (`wInviterPartyId != 0xFFFF && wInviterPartyId == wTargetPartyId`).
2. Sets directional relation flags via `0x6FCACFB0`:
   - `pInviter -> pTarget`: sets state `0x04` (`invited by me`)
   - `pTarget -> pInviter`: sets state `0x02` (`invited me`)
3. Sends `S2C 0x8B` (`0x6FC3F250`):
   - To `pInviter`: `unitId = dwTargetUnitId`, `state = 0x04`
   - To `pTarget`: `unitId = dwInviterUnitId`, `state = 0x02`
4. **Does NOT modify `wPartyId`** on either player (`0xFFFF` remains `0xFFFF` until `pTarget` sends `0x08`).

### 3.2 Action `0x07` — Cancel Invite (`0x6FD10900`)
1. Checks `0x6FCAD060(pPlayer, dwTargetUnitId, 4)` — verifies that `pPlayer` currently holds a pending outgoing invitation (`state == 4`) to `dwTargetUnitId`. If not set, returns immediately (`no-op`).
2. Clears `pPlayer -> pTarget` (`state = 4`) and `pTarget -> pPlayer` (`state = 2`) via `0x6FCACFB0(..., 0)`.
3. Sends `S2C 0x8B` (`0x6FC3F250`) to both players restoring `state = 0x01` (if the peer is in a party, `wPartyId != 0xFFFF`) or `state = 0x00` (if unpartied).
4. **Never removes `pPlayer` from an existing party** (`wPartyId` is untouched).

### 3.3 Action `0x08` — Accept Invite (`0x6FD10D50`)
1. Checks `0x6FCAD060(pInviter, dwInviteeUnitId, 4)` and `0x6FCAD060(pInvitee, dwInviterUnitId, 2)`. If `pInviter` has **not** invited `pInvitee`, returns immediately without joining any party.
2. Clears the pending invite bits (`4` and `2`) and clears hostility (`8`) between `pInvitee` and all members of the party.
3. Allocates or reuses `wPartyId`:
   - If `pInviter` has `wPartyId == 0xFFFF`, calls `PARTY_CreateParty` (`0x6FCBBEB0`) and assigns `pInviter` via `0x6FCBC3E0` (which broadcasts `S2C 0x8D` for `pInviter`).
   - Assigns `pInvitee` to `wPartyId` via `0x6FCBC3E0` (which broadcasts `S2C 0x8D` for `pInvitee`).
4. Sends `S2C 0x8B` (`state = 0x01`) between `pInvitee` and party members.

### 3.4 Action `0x09` — Leave Party (`0x6FD110F0` -> `0x6FCBC840` -> `0x6FCBC930`)
1. `0x6FD110F0` invokes `0x6FCBC840(pGame, pPlayer)`.
2. `0x6FCBC840` removes `pPlayer` from their party list, sets `pPlayer`'s `wPartyId = 0xFFFF`, and broadcasts `S2C 0x8D` (`dwUnitId = pPlayer->dwUnitId, wPartyId = 0xFFFF`) to all players (`0x6FCBC390`).
3. Sends `S2C 0x8B` (`state = 0x00`) between `pPlayer` and former party members (`0x6FCBC950`).
4. Calls `PARTY_CheckDisband` (`0x6FCBC930`):
   - `0x6FCBC930` checks `PARTY_GetMemberCount(pGame, wOldPartyId) <= 1` (`cmp eax, 1; jg`).
   - When only **1** member remains in `wOldPartyId`, `0x6FCBC840` is invoked on that lone remaining member as well, resetting their `wPartyId` to `0xFFFF` and broadcasting `S2C 0x8D` (`0xFFFF`) to all clients.
5. The same `0x6FCBC840` -> `0x6FCBC930` disband check runs when a party member disconnects or toggles hostility (`C2S 0x5D`).
