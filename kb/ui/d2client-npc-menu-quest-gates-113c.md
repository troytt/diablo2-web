# D2Client 1.13c — NPC menu quest-gated items (Travel / Hire / Imbue …)

Source: `D2Client.dll` / `D2Game.dll` / `D2Common.dll` 1.13c (image bases `0x6FAB0000` / `0x6FC20000` / `0x6FD50000`).

## Static NPC menu table

`0x6fba3ba0`, stride `0x27`, count `0x6fba42f0` (48). Record:

| off | type | meaning |
|---|---|---|
| +0x00 | u32 | MonStats hcIdx |
| +0x04 | u32 | item count (incl. trailing cancel) |
| +0x08 | u16[5] | string ids (`0xd35` talk, `0xd44` trade, `0xd45` hire, …) |
| +0x12 | u32[5] | click callbacks |
| +0x26 | u8 | flag |

Tyrael (367) statically has only `talk`; travel is appended dynamically.

## Quest-gated item table

`0x6fba2330`, stride `0x14`, count `0x6fba23e4` (9), walked by `0x6faf5cc0` (called from `0x6fafa5db` when
the NPC menu opens). Record `{u32 npc, u32 questId, u32 bit, u32 wantSet, fn}`; for `wantSet == 1` the callback
runs when D2Common **#10174** (`QUESTRECORD_GetQuestState(rec, quest, bit)` → bit `quest*16+bit`) is set on the
**player quest record** `0x6fbc973b` (filled from S2C 0x52 updateType 6 at `0x6fafb8bc`, 96 bytes).

| npc | quest | bit | wantSet | fn | effect |
|---|---|---|---|---|---|
| 155 Warriv (A1) | 6 | 0 | 1 | `0x6faf9060` | add `0xd36` go east |
| 210 Meshif (A2) | 14 | 0 | 1 | `0x6faf9030` | add `0xd38` sail east |
| 150 Kashya | 2 | 0 | 1 | `0x6fafa210` | add hire |
| 154 Charsi | 3 | 1 | 1 | `0x6fafbe40` | imbue |
| 148 Akara | 1 | 0 | 1 | `0x6fafa3a0` | |
| 511 Larzuk | 35 | 1 | 1 | `0x6fafbe10` | sockets |
| 512 Anya | 38 | 1 | 1 | `0x6fafbde0` | personalize |
| 515 Qual-Kehk | 36 | 0 | 1 | `0x6fafa030` | add hire |
| **367 Tyrael (A4)** | **28** | **0** | 1 | **`0x6faf9000`** | add `0x58d2` "travel to harrogath" **iff** expansion flag `0x6fbc9854` |

`0x6fbc9854` is written by the S2C 0x01 GameFlags handler `0x6fb5fa90` from packet byte 6 (expansion).

## Where quest 28 bit 0 comes from (server)

D2Game `0x6fcdb550`: requires `pGame+0x70` (expansion), player's level in act index 3 (Act 4), quest 26
(Terror's End) bit 0 or bit 13, and quest 28 bit 0 clear → D2Common #10003 sets quest 28 bits 0 and 13.
D2Game `0x6fc56890` (Tyrael travel request, npc 367) also sets them when expansion. Quest 27 (Hell's Forge) is
never consulted, and S2C 0x61 (handler `0x6fb5f940` → `0x6fb399a0`, act-transition/cinematic) is not part of
any menu gate.

D2Common quest record exports: #10003 set bit, #10593 clear bit, #10174 get bit, #10495 clear quest.
