# 1.13c C2S 0x5D SetPlayerRelationship & S2C 0x8C RelationshipUpdate Protocol

## 1. Ground Truth Binary Verification

### D2Client.dll Sender
In `samples/d2/D2Client.dll` sender at `0x6fac4850`:
```asm
6fac486b: mov byte [esp], 0x5d       ; opcode C2S 0x5D
6fac486f: mov byte [esp+1], cl       ; button
6fac4873: mov dword [esp+3], edx     ; target playerId (u32 LE)
6fac4879: mov byte [esp+2], 1        ; state (1 when toggled on, 0 when toggled off)
6fac4884: mov ebx, 7                 ; packet size = 7 bytes
```

### D2Client.dll Party Screen UI Buttons
- `0x6fb4dfd0`: Button 1 (`mov $0x1, %ebx`), tests bit `0x01` (`0x6fb4e059`). Squelch / Mute toggle.
- `0x6fb4df30`: Button 2 (`mov $0x2, %ebx`), tests bit `0x02` (`0x6fb4dfba`). Allow Loot (corpse looting permit).
- `0x6fb4dede`: Button 3 (`movb $0x3, 0x9(%esp)`), tests bit `0x04` (`0x6fb4df1b`). Hostile.
- `0x6fb4e595`: Button 4 (`push $0x4`), Hostile toggle (PvP mutual hostility bit `0x08`).

### D2Game.dll Dispatch Table `0x6FD1A3B0`
Dispatched from `0x6fd10ac6` (`mov 0x6fd1a3b0(,%ebx,4), %eax`, where `%ebx` is `button`):
- `[button=1]` `0x6fd10f40`: Mute toggle (bit `0x01`). Squelches chat messages from target.
- `[button=2]` `0x6fd10ee0`: Allow Loot toggle (bit `0x02`). Permits target to loot corpse items on death.
- `[button=3]` `0x6fd10e80`: Hostile declaration (bit `0x04`).
- `[button=4]` `0x6fd11130`: Hostile toggle (bit `0x08`).
  - Checks `player.level >= 9` and `target.level >= 9` via `STATLIST_GetUnitStat(pPlayer, STAT_LEVEL)` at `0x6fd11153..0x6fd11177`. If either player is under level 9, the request is aborted.
  - Automatically leaves any shared party (`0x6fcbc840`).
  - Broadcasts `S2C 0x8C` (`RelationshipUpdate`) with bit 8.

## 2. Server Event & State Invariants
- `policy.allowPvpHostile`: when `false`, hostile requests (button 3 / 4) are rejected immediately.
- `PartyManager.setMuted`: maintains `mutedPairs: Set<string>` and broadcasts S2C 0x8C with bit 1. Incoming chat in `handleChatCommand` drops messages from muted players.
- `PartyManager.setLootPermission`: maintains `lootPermitPairs: Set<string>` and broadcasts S2C 0x8C with bit 2. Corpse interaction verifies `hasLootPermission` before transferring items.
