# D2Win / D2Lang / D2Launch text, font and string-table ground truth (1.13c)

Scope: string `.tbl` lookup (`D2Lang.dll`, base `0x6FC00000`), font loading / metrics / colour codes
(`D2Win.dll`, base `0x6F8E0000`), and a few front-end facts (`D2Launch.dll` base `0x6FA40000`,
`D2Multi.dll` base `0x6F9D0000`). Data: `samples/d2/d2data.mpq`, `d2exp.mpq`, `Patch_D2.mpq`.

## 1. D2Lang string tables

Loader `#10008` (`0x6FC0A130`) loads, in order:

| global (table / node ptr array) | file | global index range |
|---|---|---|
| `0x6FC10A64` / `0x6FC10A68` | `data\local\lng\%s\string.tbl` | `0 .. 9999` |
| `0x6FC10A80` / `0x6FC10A6C` | `data\local\lng\%s\patchstring.tbl` | `10000 .. 19999` (required) |
| `0x6FC10A84` / `0x6FC10A70` | `data\local\lng\%s\expansionstring.tbl` | `20000 ..` (optional) |

File layout (verified on all three ENG tables, 0 mismatches): 21-byte header
`{u16 crc; u16 numElements; u32 hashSize; u8 version; u32 stringStart; u32 maxTries; u32 fileSize}`,
then `u16 elementIndex[numElements]` (string index -> node slot), then 17-byte nodes
`{u8 used; u16 index; u32 hash; u32 keyOff; u32 valOff; u16 valLen}`. Stored `hash` = ELF hash `% hashSize`.

* **Hash** `#10000` (`0x6FC08FE0`): ELF hash over the key using **signed** chars (`movsx`), then `% hashSize`.
  No shipped 1.13c key has a byte `>= 0x80`, so signed/unsigned give identical results on retail data.
* **Key lookup in one table** (`0x6FC09360`): start at `hash(key)`, probe linearly (`(slot+1) % hashSize`) for
  `maxTries` steps; **unused nodes are skipped (probing continues)**; match is a plain `strcmp` on the key (the
  stored hash is not compared). Returns `node.index` or `0xFFFF`.
* **Key lookup across tables** `#10010` (`0x6FC0A7B0`): empty key -> `""`/index 0; else patchstring (`+10000`)
  -> expansionstring (`+20000`, only if loaded) -> string. Not found -> `0x6FC09FB0` builds (and caches in a
  linked list) the text `"<key> -not xlated call ken w"` (suffix at `0x6FC10568`) and returns index 0.
* **Index lookup** `#10003` (`0x6FC09450`): `idx >= 20000`: expansion loaded -> `exp[idx-20000]`, else
  `idx = 11078` (patchstring 1078) and continue; `idx >= 10000` -> `patch[idx-10000]`; else `string[idx]`.
  Per-table helper `0x6FC09050`: **`idx >= numElements` is replaced by 500** (`mov edx,0x1F4`), so out-of-range
  ids show entry 500 of that table (ENG: string `AshearaGossip9` gossip text, patch `skillxname79` = `" "`,
  expansion `r06L` = `"Ith"`). A null slot is a fatal assert, never a null return.
* Language table `#10004` (`0x6FC09D00`, 13 x 24-byte records at `0x6FC0FDB4`): 0 ENG, 1 ESP, 2 DEU, 3 FRA,
  4 POR, 5 ITA, 6 JPN, 7 KOR, 8 SIN, 9 CHI, 10 POL, 11 RUS, 12 ENG(HAN).

## 2. D2Win fonts

Font id -> file (`%s%s%s.dc6/.tbl`, name pointer table `0x6F8FC588`):
0 Font8, 1 Font16, 2 Font30, 3 Font42, 4 FontFormal10, 5 FontFormal12, 6 Font6, 7 Font24, 8 FontFormal11,
9 FontExocet10, 10 FontRidiculous, 11 FontExocet8, 12 ReallyTheLastSucker, 13 FontInGameChat.
`#10184` (`0x6F8F2FE0`) = SetFont(ecx = id), returns the previous id; current id in `0x6F8FFD34`.
All 14 exist under `data\local\font\latin\` in the 1.13c MPQs.

D2Client SetFont call sites by id (immediate `mov ecx,id` before `call 0x6FABD3A8`): 0 x11, 1 x24, 2 x3,
3 x2 (`0x6FAF344D`, `0x6FAF3E58`), 4 x2 (`0x6FB28A43`, `0x6FB3E894`), 5 x3, 6 x15, 8 x5 (`0x6FACF5ED`,
`0x6FB2BB75`, `0x6FB2C6DB`, `0x6FB2D2BE`, `0x6FB2D526`), 9 x2, 13 x12 (e.g. `0x6FAC1639`, `0x6FB2D61F`); 50 more
sites pass a computed id. Quest log (`0x6FACF1E0..`): title + description in **FontFormal11 (8)**
(`0x6FACF5E8`), button hover labels (`0x1030`, `0xE88`) in **FontExocet10 (9)** (`0x6FACF7EC`, `0x6FACF89C`).

`.tbl` (`Woo!`): header 12 bytes (`u16@4 = 1`, `u16@8 = glyph count = 256`, `u8@10` = font height, `u8@11`),
then 14-byte glyph records `{u16 code; u8 ?; u8 advance; u8 height; ...; u16 frame @+8; ...}` searched by
binary search on `code` (`0x6F8F2150`). Draw (`0x6F8F19F5`/`0x6F8F1A09`) uses `frame = rec+8` and
`x += rec+3` verbatim (a 0 advance stays 0; only FontExocet8 has zero-advance glyphs: 0xAA 0xAC 0xB1 0xBA 0xF7).

Metrics: GetFontHeight `0x6F8F1E60` = `tbl[10]`. Locale init `0x6F8F3110`:

| lang | line advance `0x6F8FFD38` | block mult `0x6F8FFD3C` | baseline `0x6F8FFD40` |
|---|---|---|---|
| 0..5, 11, 12 | 16 | 16 (11: 17) | 3 |
| 6 JPN | 14 | 15 | 5 |
| 7 KOR | 16 | 17 | 5 |
| 8 SIN, 9 CHI | 14 | 14 | 2 |
| 10 POL | 13 | 13 | 3 |

All uses are `height * k / 10` with **truncating** division (`imul 0x66666667; sar 2; +sign`) at `0x6F8F1ED7`
(block height), `0x6F8F2ADB` (multi-line advance), `0x6F8F352A` (baseline).

Colour codes (draw `0x6F8F2800`): `0xFF` followed by `'c'` (`0x6F9AA670`) selects colour `next - '0'`;
values `>= 13` become 0 (signed compare). `0xFF` not followed by `'c'` is drawn as a glyph. Width helpers:
`0x6F8F1F20` always consumes `0xFF` + 2 chars with no advance; the partial-width helper `0x6F8F20C0` only skips
`ÿc0..ÿc6`. 13 colours = `pal.pl2` TextColors (`#ffffff #ff4d4d #00ff00 #6969ff #c7b377 #696969 #000000
#d0c27d #ffa800 #ffff64 #008000 #ae00ff #00c800`); colour 0 is drawn without a shift (its PL2 shift row is all 0).

## 3. Front end

* Class-select campfire table `0x6FA60C08` (16-byte `{cell*, overlayCell*, drawMode, rate}`): Amazon loads only
  `amnu1/amnu2/amfw/amnu3/ambw` (`0x6FA51400..`), rates 3/3/1/2/1, **no overlay** (D2Launch has no `amfws`
  string). Overlays exist only for Paladin `pafws`, Barbarian `bafws`, Necromancer `nebws/nenu3s/nefws`,
  Sorceress `sobws/sonu3s/sofws`.
* Character-name key filter `0x6FA52360`: letters always; `'-'`/`'_'` only when the box is non-empty and holds
  no `'-'`/`'_'` yet.
* Difficulty gate `D2Multi.dll 0x6F9E5182..0x6F9E52CD`: `prog = byte[+0x1EC] & 0x1F`, expansion =
  `byte[+0x1EB] & 0x20`; Hell iff `prog >= (exp ? 10 : 8)`, Nightmare iff `prog >= (exp ? 5 : 4)`.
