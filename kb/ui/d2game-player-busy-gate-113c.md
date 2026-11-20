# Server "busy" gate: why pick-ups and shrines silently stop working (1.13c, issue #920)

## Symptom

Ground items cannot be picked up and shrines / chests cannot be operated, while walking still works.
Picking an item up in the inventory (C2S `0x19`) and putting it down cures it.

## Server gate (1.13c `D2Game.dll`)

- `PLAYER_IsBusy(player)` (`Player.cpp`) = `SUNIT_GetInteractInfo(player)` (interact info set)
  **or** `INVENTORY_GetCursorItem(player)` **or** `pPlayerData->bBusy`.
- C2S `0x16` pick-up -> `sub_6FC828D0` -> `D2GAME_PickupItem_6FC43340` /
  `D2GAME_PickupItemEx_6FC42B80`: `if (cursor item || PLAYER_IsBusy) return;` — no reply.
- C2S `0x13` on an object -> `sub_6FC78B20` -> `OBJECTS_OperateHandler` (`0x6FC789C0`): the operate
  fn only runs when there is no interact info, `bBusy == 0` and no cursor item (stash excepted).
- Walk / run (`0x01..0x04`) are not gated by any of these.
- C2S `0x19` (`Rcv0x19_RemoveItemFromBuffer`) calls `sub_6FC7C3A0`, which **resets the interact info
  when the interact unit no longer exists** (e.g. its room was released after the player walked
  away). That is the "inventory pick-up fixes it" observation.

## Interact-info owners and how the client must end them

| Set by (server) | Interact unit | Client must send |
| --- | --- | --- |
| Waypoint operate (S2C `0x63`) | `UNIT_OBJECT` waypoint | `0x49 { waypoint GUID, level }` (`level 0` = close) |
| Stash operate (S2C `0x77 0x10`) | `UNIT_OBJECT` stash | `0x4F` button `0x12` |
| Cube use (S2C `0x77 0x15`, `SKILLITEM_pSpell07_OpenCube`) | `UNIT_ITEM` cube | `0x4F` button `0x17` |
| NPC interaction | `UNIT_MONSTER` NPC | `0x30` NpcCancel |
| Trade | `UNIT_PLAYER` | `0x4F` trade cancel |

## D2Client waypoint close `0x6fb5a380`

Every waypoint-UI close path ends here (`0x6fb5a4a0: jmp 0x6fb5a380`, plus 14 more call sites):

```
if (!byte[0x6fbacdd5] /*0x49 already sent*/ && gpPlayer[0x6fbcbbfc] && #10331 GetRoom(gpPlayer))
    SendPacket(9, { 0x49, dword[0x6fbacdcd] /*waypoint GUID from 0x63*/, 0 })
    byte[0x6fbacdd5] = 1
```

The stored GUID is not cleared by level changes, so a waypoint UI that closes because the player
walked into another level still sends `0x49 {wp, 0}`. The port's `HudModel` used to close the panel
silently in that case (`ClientWorld.areaId` setter drops `waypointOpen`), leaving the waypoint
interaction open on the server — fixed in #920 by routing it through `HudModel.closeWaypoint()`.
