# D2GS S2C `0x1A`..`0x1F` Experience & Attribute Packets (1.13c Ground Truth)

## Binary Evidence

- **Client Handler Table**: `D2Client.dll` S2C packet dispatch table (`0x6fb5edf0` = `D2Client_RecvPacket_1A_1B_1C`, `0x6fb5efb0` = `D2Client_RecvPacket_1D_1E_1F`)
- **Server Senders**: `D2Game.dll` player stat sync (`0x6fcabda0` = `D2Game_SyncPlayerStats`)

### `0x1A` (`ExpByte`), `0x1B` (`ExpWord`), `0x1C` (`ExpDword`)

Disassembly of `D2Client.dll` @ `0x6fb5edf0` (`D2Client_RecvPacket_1A_1B_1C`):

```asm
6fb5edf0: mov eax, [0x6fbcbbfc]       ; pPlayer = D2Client_GetPlayerUnit()
6fb5edf5: test eax, eax
6fb5edf7: jz 6fb5eeae
6fb5edfd: push ebx
6fb5edfe: push ebp
6fb5edff: push esi
6fb5ee00: push edi
6fb5ee01: mov edi, ecx                ; pPacket
6fb5ee03: push 0
6fb5ee05: push 13                     ; STAT_EXPERIENCE (13)
6fb5ee07: push eax
6fb5ee08: mov ebx, eax
6fb5ee0a: call D2Common_GetUnitStat   ; ebp = current experience
6fb5ee0f: mov al, [edi]               ; packet opcode
6fb5ee11: sub al, 0x1A
6fb5ee13: mov ebp, eax
6fb5ee15: jz 6fb5ee89                 ; case 0x1A (ExpByte):
                                      ;   movzx esi, byte [edi+1]
                                      ;   add esi, ebp
6fb5ee17: sub al, 1
6fb5ee19: jz 6fb5ee84                 ; case 0x1B (ExpWord):
                                      ;   movzx esi, word [edi+1]
                                      ;   add esi, ebp
6fb5ee1b: sub al, 1
6fb5ee1d: jnz 6fb5eea9
6fb5ee80: mov esi, [edi+1]            ; case 0x1C (ExpDword):
                                      ;   esi = dword [edi+1] (ABSOLUTE total experience, NOT delta!)
6fb5ee82: jmp 6fb5ee94
6fb5ee84: movzx esi, word [edi+1]
6fb5ee88: jmp 6fb5ee92
6fb5ee89: movzx esi, byte [edi+1]
6fb5ee92: add esi, ebp                ; 0x1A and 0x1B add delta to current STAT_EXPERIENCE
6fb5ee94: push 0
6fb5ee96: push esi
6fb5ee97: push 13                     ; STAT_EXPERIENCE (13)
6fb5ee99: push ebx
6fb5ee9a: call D2Common_SetUnitStat   ; sets STAT_EXPERIENCE = esi
```

Disassembly of `D2Game.dll` @ `0x6fcabda0` (`D2Game_SyncPlayerStats`):

- Computes `delta = currentExp - lastSentExp`:
  - If `0 < delta < 256` (`0x100`): sends `0x1A` (`u8` delta).
  - If `256 <= delta < 65536` (`0x10000`): sends `0x1B` (`u16` delta).
  - Otherwise (`delta >= 65536` or negative / initial full sync): loads `edx = currentExp` (`0x6fcabdd6: mov edx, esi; mov ecx, eax; call D2Game_SendPacket0x1C`) and sends `0x1C` with the **absolute 32-bit total experience**.

### Summary Table

| Opcode | Name | Payload | Client Semantics (`STAT_EXPERIENCE = 13`) |
| --- | --- | --- | --- |
| `0x1A` | `ExpByte` | `u8 exp` | `isDelta = true` (`curExp + u8`) |
| `0x1B` | `ExpWord` | `u16le exp` | `isDelta = true` (`curExp + u16`) |
| `0x1C` | `ExpDword` | `u32le exp` | `isDelta = false` (`curExp = u32` absolute total) |
