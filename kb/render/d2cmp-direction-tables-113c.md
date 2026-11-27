# D2CMP 64-direction → COF / DCC direction tables (1.13c)

Ground truth: `samples/d2/D2CMP.dll` (ImageBase `0x6FE10000`), `.rdata`. Each table is 64 little-endian
`u32` entries indexed by the engine's 64-direction value (0..63), one table per direction count
4 / 8 / 16 / 32 / 64, laid out 0x100 bytes apart.

| Table | VA (4, 8, 16, 32, 64 dirs) |
|---|---|
| DCC (direction order inside a `.dcc`, permuted) | `0x6FE2E7D8`, `0x6FE2E8D8`, `0x6FE2E9D8`, `0x6FE2EAD8`, `0x6FE2EBD8` |
| COF (priority-table direction, sequential) | `0x6FE2F7D8`, `0x6FE2F8D8`, `0x6FE2F9D8`, `0x6FE2FAD8`, `0x6FE2FBD8` |

First entries (64-dir index 0..15):

- DCC 8: `4 4 4 4 0 0 0 0 0 0 0 0 5 5 5 5`
- DCC 16: `4 4 8 8 8 8 0 0 0 0 9 9 9 9 5 5`
- DCC 32: `4 16 16 8 8 17 17 0 0 18 18 9 9 19 19 5`
- DCC 64: `4 32 16 33 8 34 17 35 0 36 18 37 9 38 19 39`
- COF 8: `0 0 0 0 1 1 1 1 1 1 1 1 2 2 2 2`; COF 16: `0 0 1 1 1 1 2 2 2 2 3 3 3 3 4 4`

The 4-direction DCC and COF tables are identical (`0×8, 1×16, 2×16, 3×16, 0×8`).

Port: `src/common/units/character.ts` `DIR64_TO_DCC` / `DIR64_TO_COF` (`dir64ToDcc` / `dir64ToCof`) were
compared entry-by-entry against all ten binary tables: all 640 entries match.
