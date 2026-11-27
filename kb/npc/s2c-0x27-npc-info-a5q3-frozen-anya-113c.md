# 1.13c S2C `0x27` (`NPCInfo`) Wire Layout, Uninitialized Stack Padding, & Act 5 Quest 3 Frozen Anya

## Overview

In Diablo II: Lord of Destruction v1.13c, server-to-client packet `0x27` (`D2GS_NPCINFO`, 40 bytes) delivers up to 8 NPC/object dialog or overhead speech entries (`D2MessageStrc[8]`) to the client. Because several server packet builders allocate `uint8_t pkt[40]` on the C stack (`sub esp, 0x50` / `0x5c`) without calling `memset`, strict adherence to `D2Common.#10485` (`count = pkt[6]`, `nMenu = u8` at `+0`, `wStringId = u16LE` at `+2`, ignoring alignment bytes `pkt[7]` and `pkt[8 + i*4 + 1]`) is mandatory to avoid misinterpreting residual stack words as dialog `stringId`s.

---

## 1. Binary Wire Layout (`D2Common.dll` `#10619` & `#10485`)

### Struct Layout (40 bytes)

| Offset | Type | Field | Notes |
| --- | --- | --- | --- |
| `+0x00` | `u8` | `nHeader` | `0x27` |
| `+0x01` | `u8` | `nUnitType` | `1` = `UNIT_MONSTER` (NPC), `2` = `UNIT_OBJECT` |
| `+0x02` | `u32LE` | `dwUnitGUID` | Server unit GUID |
| `+0x06` | `u8` | `nCount` | Active slot count (`0..8`) |
| `+0x07` | `u8` | `_pad7` | Compiler struct alignment byte (**uninitialized** on stack in `0x6fc54b80` / `0x6fc68cd1` / `0x6fd118b0`) |
| `+0x08..+0x27` | `D2MessageStrc[8]` | `aMsg[8]` | Eight 4-byte message slots (`off = 8 + i * 4`) |

Each 4-byte `D2MessageStrc` at `off = 8 + i * 4`:
- `pkt[off + 0]` (`u8`): `nMenu` (`0` = primary scroll / auto-pop, `1..2` = Talk submenu, `3` = empty sentinel when `wStringId == 0` OR overhead chat bubble when `nCount == 1`)
- `pkt[off + 1]` (`u8`): `_pad1` (16-bit struct alignment padding — **uninitialized** in single-slot stack builders)
- `pkt[off + 2..3]` (`u16LE`): `wStringId` (index into `0x6fb8f398` scrolling speech table / canonical NPC dialog table)

### `D2Common.#10619` (`0x6fd8d060`) & `D2Common.#10485` (`0x6fd8d380`)

From `samples/d2/D2Common.dll`:
- `#10619` (`0x6fd8d060`) initializes a `D2MessageListStrc` in town NPC menu builders (`0x6fc54be0`): sets `nCount = 0` and fills all 8 slots with `nMenu = 3` (`u8`) and `wStringId = 0` (`u16LE`).
- `#10485` (`0x6fd8d380`) copies messages from packet `pkt + 6` into client `D2UnitStrc->pMessageList`:
  - Reads `count = pkt[6]` (`movzx eax, byte ptr [esi]`).
  - Loops strictly `i = 0 .. count - 1` (`0 .. pkt[6] - 1`), reading `mov cl, [esi + i*4 + 2]` (`pkt[8 + i*4]`, `u8` ONLY) and `mov dx, [esi + i*4 + 4]` (`pkt[10 + i*4]`, `u16LE`).
  - Never inspects `pkt[7]`, `pkt[9]`, or any slot `i >= count`.

---

## 2. Server Stack Builders (`D2Game.dll`)

### A. `QUESTS_NPCMessage` (`0x6fc54b80`) — Single-Message Scroll

Disassembly from `samples/d2/D2Game.dll`:
```assembly
6fc54b80: sub esp, 0x50
6fc54b86: test edx, edx                        ; pPlayer
6fc54b88: mov [esp+0x4c], ecx                  ; pGame
6fc54b8e: je 0x6fc54bd4
6fc54b90: mov eax, [esp+0x5c]                  ; pTargetUnit (NPC or Object)
6fc54b94: test eax, eax
6fc54b96: je 0x6fc54bd4
6fc54b98: mov ecx, [eax]                       ; pTargetUnit->dwUnitType (1 or 2)
6fc54b9a: mov [esp+0x09], cl                   ; pkt[1] = nUnitType
6fc54b9e: mov eax, [eax+0x0c]                  ; pTargetUnit->dwUnitId
6fc54ba1: mov cx, [esp+0x60]                   ; wStringId
6fc54ba6: mov byte ptr [esp+0x08], 0x27        ; pkt[0] = 0x27
6fc54bab: mov [esp+0x0a], eax                  ; pkt[2..5] = dwUnitId
6fc54baf: mov byte ptr [esp+0x0e], 0x01        ; pkt[6] = nCount = 1
6fc54bb4: mov byte ptr [esp+0x10], 0x00        ; pkt[8] = aMsg[0].nMenu = 0
6fc54bb9: mov [esp+0x12], cx                   ; pkt[10..11] = aMsg[0].wStringId
; NOTE: pkt[7] ([esp+0x0f]), pkt[9] ([esp+0x11]), and pkt[12..39] ([esp+0x14..0x2f]) are UNINITIALIZED!
```

All 6 call sites of `0x6fc54b80` in `D2Game.dll`:
1. `0x6fc78df1`: Act 5 Quest 5 Ancients Altar (`Objects.txt 546`) -> `wStringId = 20002` (`AncientsAltar5`)
2. `0x6fc7cdb3`: Act 5 Quest 3 Frozen Anya (`Objects.txt 558` `fana`, `OperateFn 67`) -> `push 0x4ea3` (`wStringId = 20131` `A5Q3FoundAnyaAnya`)
3. `0x6fc7d117`: Act 5 Quest 3 town NPC hook -> quest scroll message
4. `0x6fc7d15e`: Act 5 Quest 3 town NPC hook -> quest scroll message
5. `0x6fc88df3`: Act 1 Quest 4 Forgotten Tower Tome (`Objects.txt 61`) -> `wStringId = 127` (`Tome1`)
6. `0x6fce9b05`: Act 2 Quest 2 Horadric Orifice (`Objects.txt 152`) -> `wStringId = 396` (`HoradricOrifice`)

### B. Overhead Speech (`0x6fc68cd1` / `0x6fd118b0`)

When a monster or quest NPC utters an overhead speech bubble without opening a modal scroll (e.g., Countess, Smith, Radament, Hephasto, Shenk, Baal waves, rescued soldiers), `D2Game.dll` writes:
- `pkt[0] = 0x27`, `pkt[1] = 1` (`UNIT_MONSTER`), `pkt[2..5] = dwUnitId`, `pkt[6] = 1` (`nCount = 1`)
- `pkt[8] = 3` (`nMenu = 3`), `pkt[10..11] = wStringId`
- Again without zeroing `pkt[7]`, `pkt[9]`, or `pkt[12..39]`.

### C. Why Uninitialized Stack Bytes Triggered `512` (`AlkorGossip10`) on Frozen Anya

In `ACT5Q3` (`0x6fc7c480..0x6fc7cf50`):
- Town Anya (`drehya`) is `MonStats.txt hcIdx = 512` (`0x0200`, pushed at `0x6fc7c779`), while Frozen Anya (`drehyaiced`) is `hcIdx = 527` (`0x020f`, pushed at `0x6fc7c739`) paired with `Objects.txt 558` (`fana`, `OperateFn 67` at `0x6fc7cd50`).
- When `0x6fc7cdb3` invokes `QUESTS_NPCMessage(..., 0x4EA3)`:
  1. Uninitialized `pkt[9]` (`aMsg[0]._pad1`) is frequently non-zero (`word0 = u16LE(pkt, 8) > 3`), which caused any decoder reading `u16LE` for `nMenu` to drop slot 0 (`20131` `A5Q3FoundAnyaAnya`).
  2. Uninitialized `pkt[12..39]` (`slots 1..7`, beyond `nCount = 1`) retains stack dwords from prior `ACT5Q3` calls such as `0x00000200` (`512` `drehya` `hcIdx`) at `pkt[12..15]`. A word-swap heuristic (`word0 > 3 && word1 <= 3`) turned `(word0 = 512, word1 = 0)` into `{ menu: 0, stringId: 512 }`, which collides with `CANONICAL_NPC_MSG_ID_TO_TBL_KEY[512] = 'AlkorGossip10'` (Act 3 Alkor `hcIdx 254`, `Sounds.txt 3539`).

---

## 3. Client Handler (`D2Client.dll 0x6fb2de50..0x6fb2dfac`)

Disassembly of `D2Client.dll` S2C `0x27` handler (`0x6fb2de50`):
1. Calls `D2Common.#10485(pUnit->pMessageList, pkt + 6)` to copy `pkt[6]` entries.
2. **Branch 1 (`0x6fb2dedb`): `nUnitType == 1 && count == 1 && aMsg[0].nMenu == 3`**:
   - Formats overhead chat bubble above the unit (`D2Common.#10893`) and plays the corresponding voice line without opening a modal NPC scroll or overwriting vendor/town dialog menus.
3. **Branch 2 (`0x6fb2df5c`): `nUnitType == 2 && count == 1 && aMsg[0].nMenu == 0`**:
   - Calls `0x6fb2d200(aMsg[0].wStringId)` (`Object_OpenScrollingSpeech`), immediately popping the standalone quest scroll and playing `0x6fb8f398[wStringId]` (`20131` -> `Sounds.txt 4406` `anya_act5_q3_init` for Frozen Anya). Repeating the object click re-sends `0x27` and re-opens the scroll every time prior to thawing.
4. **Branch 3 (`0x6fb2df6f`): Town / Interactive NPC (`nUnitType == 1`)**:
   - Stores `pMessageList` on the NPC unit for `NPCMenu` (`0x6fb2d3c0`) and quest/intro auto-play.

---

## 4. Act 5 Quest 3 (`Prison of Ice`) Dialog & Audio Matrix

| Stage | Unit / `hcIdx` / Object | `wStringId` | `.tbl` Key | `Sounds.txt` ID (`Stream=1`) |
| --- | --- | --- | --- | --- |
| Click Frozen Anya without `'ice'` | `Objects.txt 558` (`fana`) / `hcIdx 527` (`drehyaiced`) | `20131` (`0x4EA3`) | `A5Q3FoundAnyaAnya` | `4406` (`anya_act5_q3_init`) |
| Talk to Malah after finding Anya | `hcIdx 513` (`malah`) | `20132` | `A5Q3AfterAnyaMalah` (grants `'ice'`) | `4518` (`malah_act5_q3_afteranya`) |
| Click Frozen Anya with `'ice'` | `Objects.txt 558` / `hcIdx 527` | *(consumes `'ice'`, thaws Anya, sets reward pending)* | — | — |
| Return to Malah | `hcIdx 513` (`malah`) | `20135` | `A5Q3SuccessfulMalah` (grants `'tr2'`) | `4521` (`malah_act5_q3_complete`) |
| Talk to Rescued Anya in Town | `hcIdx 512` (`drehya`) | `20136` | `A5Q3SuccessfulAnya` (grants class item) | `4407` (`anya_act5_q3_complete`) |
| Town Anya Intro | `hcIdx 512` (`drehya`) | `20014` | `AnyaAct5IntroGossip1` | `4399` (`anya_act5_intro`) |
| Town Anya Gossip 1..10 | `hcIdx 512` (`drehya`) | `20015..20024` | `AnyaGossip1..AnyaGossip10` | `4389..4398` |
