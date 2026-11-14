# D2GS C→S dispatch, size validation and S→C/C→S variable-length resolvers (1.13c)

Ground truth: `samples/d2/D2Net.dll` (SHA-1 `4b2579f3…`, base `0x6FBF0000`),
`samples/d2/D2Game.dll` (SHA-1 `b452c203…`, base `0x6FC20000`),
`samples/d2/D2Client.dll` (SHA-1 `26c2b536…`, base `0x6FAB0000`).

## 1. D2Net size tables (re-verified)

| Table | VA | Entries | Notes |
|---|---|---|---|
| S→C sizes | `0x6FBFA900` | 181 (`0x00..0xB4`) | `>0` fixed, `-1` variable, `0` invalid |
| C→S sizes | `0x6FBFABD8` | 113 (`0x00..0x70`) | same encoding |

Both tables match `src/netproto/d2gs/tables/s2c-sizes.ts` byte for byte.
D2Client's own handler table (`0x6FB8DE60`, 12-byte rows `{handler, size, unitHandler}`) differs from
D2Net only at `0x17` (client `-1`, D2Net `0` → never framed), `0x80` (client `4`, D2Net `0`) and `0xAF`.

## 2. S→C variable-length resolver `D2NET_10033` (`0x6FBF6750`)

Index byte table `0x6FBF6970` (opcode − `0x16`), jump table `0x6FBF6934`.
Each case first demands a minimum number of buffered bytes, then computes the size:

| Op | Case VA | Min bytes | Size |
|---|---|---|---|
| `0x16` | `0x6FBF67A4` | 13 | `u16 @1` |
| `0x26` | `0x6FBF67B8` | 10 (+`len1+11`) | `10 + strlen(@10)+1 + strlen(next)+1` |
| `0x3E` | `0x6FBF6834` | 2 | `u8 @1` |
| `0x5B` | `0x6FBF67F4` | 34 | `u16 @1` |
| `0x94` | `0x6FBF6808` | 9 | `(u8 @1 + 2) * 3` |
| `0x9C`/`0x9D` | `0x6FBF6820`/`0x6FBF6848` | 3 | `u8 @2` |
| `0xA6` | `0x6FBF685A` | 4 | `u16 @2` |
| `0xA8`/`0xAA` | `0x6FBF686E`/`0x6FBF6886` | 7 | `u8 @6` |
| `0xAC` | `0x6FBF689C` | 13 | `u8 @12` |
| `0xAE` | `0x6FBF68B4` | 3 | `(u16 @1 ≤ 0x1FD ? u16 @1 : 0) + 3` |
| `0xAF` | `0x6FBF68DB` | 2 | `u8 @1 == 0 ? 2 : u8 @1 + 1` |
| `0xB3` | `0x6FBF6907` | 8 | `u8 @1 + 7` |

## 3. C→S variable-length resolver `D2NET_10006` (`0x6FBF65D0`)

`0xFF` → always 16. Opcodes `≥ 0x71` → 0. Index table `0x6FBF66F0` (opcode − `0x14`), jump table `0x6FBF66E0`:

| Op | Case VA | Size |
|---|---|---|
| `0x14`, `0x15` | `0x6FBF663A` | `3 + (strlen(@3)+1) + (strlen(s2)+1) + 1 + (int8)b`, where `b` is the byte right after the second string's NUL |
| `0x66` | `0x6FBF6688` | `(u16 @1 ≤ 0x1FD ? u16 @1 : 0) + 3` |
| `0x6C` | `0x6FBF66AB` | needs ≥ 6 bytes; `u8 @1 + 7` |

`0x39` is a plain fixed entry: **5 bytes**.

## 4. D2Game C→S dispatch

Dispatcher `0x6FCEC550`: rejects opcode `0` and `≥ 0x67` (returns 3), then calls
`[op*8 + 0x6FD1A078]` as `handler(ecx=pGame, edx=pUnit, push pPacket, push nSize)`; a NULL slot returns 3.
Rows are 8 bytes `{pfnHandler, dword}` (the second dword's meaning was not confirmed).
`0x67..0x70` (game logon, ping, …) are handled outside this table.

Every handler checks `nSize` itself (`cmp [esp+8], N` → `mov eax,3; ret 8` on mismatch). The checks
agree with the D2Net C→S table for every opcode that has one.

NULL slots: `0x00, 0x2B, 0x4A, 0x4E, 0x55, 0x56, 0x57, 0x5A, 0x5B, 0x5C, 0x64, 0x65`.

Handlers that always reject (`mov eax,3; ret 8`): `0x2C` (`0x6FCEB1E0`), `0x2D` (`0x6FCEBDA0`),
**`0x39` (`0x6FCEB560`)**, `0x45` (`0x6FCEB550`), `0x52` (`0x6FCEB490`).

Handlers that accept and do nothing (`xor eax,eax; ret 8`): `0x2E` (`0x6FCEB1D0`), `0x42` (`0x6FCEB1C0`),
`0x43` (`0x6FCEB1B0`), `0x66` (`0x6FCEB190`).

Spot-checked layouts:
- `0x3A` (`0x6FCEC960`): size 3; `u8 stat @1` (`0..15`), `u8 count−1 @2` (count `1..100`); loops `0x6FD0AEE0`.
- `0x3B` (`0x6FCEDA20`): size 3; `u16 skill @1`.
- `0x4F` (`0x6FCF1470`): size 7; `u16 button @1`, `amount = (u16 @3 << 16) | u16 @5`.

## 5. S→C notes found during the audit

- `0x22` UpdateSkillStatus: built by D2Game `0x6FCAD570`: `@1` unit type, `@3` id, `@7` skill, `@9` quantity,
  `@0xB = D2Common #10494(unit, 7 /*playerbody*/) ? 1 : 0`. `@2` and `@0xA` are never written. D2Client
  `0x6FB5C800` **drops the whole packet when `@0xB != 0`** and otherwise sets the quantity
  (`D2Common` thunk `0x6FABC4E4`) on the player looked up by `@3`.
- `0x73` CreateMissile: built by D2Game `0x6FC8F740`: `@1..4` always zero, `@5` class (#10191), `@7/@0xB` x/y,
  `@0xF/@0x13` target (only when requested), `@0x17` = `D2Common #10737` (reads the missile data `i16 +0x10`),
  `@0x19/@0x1A` owner, `@0x1E` = #11029, `@0x1F` = stat `0x148`. The client writes `@0x17` back with
  `D2Common #10970` (clamped `i16` store to missile data `+0x10`) and sets stat `0x148` from `@0x1F`.
- `0x66`: D2Client handler `0x6FB5C040` is a bare `ret`.
- `0x01`: D2Client `0x6FB5FA90` stores `@1` as-is (no clamp), the dword `@2` in `0x6FB9264C`, `@6` and `@7` in
  `0x6FBC9854` / `0x6FBC9858`. The dword's bits read by D2Client getters are `0x1, 0x2, 0x40, 0x80, 0x100, 0x200`.
- Merc stat/exp `0x9E..0xA2` (D2Client `0x6FB5EA40`, jump table `0x6FB5EAF4`): `0x9E` u8 / `0x9F` u16 /
  `0xA0` u32 go through `D2Common #10887` (the same setter 0x73 uses for stat `0x148`), while `0xA1` u8 /
  `0xA2` u16 take the `ebp = 1` path to `D2Common #10551` (the add path; the name was not checked in
  D2Common). A value for stat 12 also refreshes the owner (`0x6FB5E3F0`).

## 6. Follow-up findings (parity fixes #1655, #1659..#1661, #1664, #1665)

- `0x73` `@0x17` = missile data `+0x10`, the **remaining-frames countdown** (#1664). D2Game sets `+0x0E`
  (range, D2Common `0x6FDBA710`) and `+0x10` (#10970, `0x6FDBA6D0`) to the same value at creation
  (e.g. `0x6FC8FCCF`/`0x6FC8FCD6`, `0x6FC59833`/`0x6FC5983A`), decrements `+0x10` once per tick
  (`0x6FC5F39E..0x6FC5F3A8`, the missile ends at `<= 0`), and D2Common `0x6FDBA240` returns the elapsed frames
  as `+0x0E - +0x10`. D2Client pushes `@0x17` zero-extended (`movzx ecx, word`, `0x6FB5EF83`) into #10970, which
  clamps to `0x7FFF`. `@0x1E` is missile data `+0x0C` (#11029, level) and goes unchanged into the create struct
  (`pParam+0x30`, used raw in `Range + LevRange * level` at `0x6FB63417..0x6FB63429`).
- `0x01` builder: D2Game `0x6FCAC420` (called with `mov cl,0x1` from `0x6FC4AC64`): `@1` = pGame `+0x6D`
  (difficulty), `@2` = `[[pGame+0x1D28]+8]` = game create flags `& 0x3179C7` (`0x6FCD258C..0x6FCD2598`),
  `@6` = pGame `+0x70 != 0` (expansion = create flag `0x100000`), `@7` = pGame `+0x74 != 0` (ladder = create
  flag `0x200000`). Arena flag `0x800` is the **hardcore game** flag (#1665): the character admission checks
  compare character status `0x04` (hardcore) with `test ah,0x8` on these flags (`0x6FC6BDA0..0x6FC6BDF6`,
  `0x6FD0BB7F..0x6FD0BBE7`). D2Client itself never reads bit `0x800` of its copy.
- `0x58` (D2Client `0x6FB50250`, jump table `0x6FB50300`): 0 open orifice, 1 close, 4 clear "please wait",
  5 consumed (sound 5/3) + close, 6 and 7 both close the UI and end the NPC interaction (`0x6FB502D4`);
  2, 3 and `> 7` are fatal (`0x6FB502DE`). No unit type is carried.
- `0x81` (D2Client `0x6FB5EBA0` -> `0x6FAD1D60`): `{u32 @0xC, u32 @0x10, 0}` is copied to the pet record
  (`+0x24/+0x28/+0x2C`); for kind `@1 == 7` the merc name setter `0x6FAFEF50` gets `{u32 @0xC, u16 @0x10}`.
