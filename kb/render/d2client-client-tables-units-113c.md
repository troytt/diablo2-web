# D2Client.dll 1.13c — States, Objects ClientFn, Shrine and palette tables (client units audit)

Addresses are D2Client.dll (ImageBase `0x6FAB0000`) unless noted.

## 1. States.txt client callbacks

The compiled `states.bin` record is 0x3C bytes; `+0x1A` = `setfunc`, `+0x1C` = `remfunc`, `+0x30` / `+0x32` and
`+0x3A` / `+0x38` are the missile / skill words the set paths read.

- Set dispatcher `0x6FB225A6`: `movsx eax, word [state+0x1A]; cmp ax, 0x1F; call [eax*4 + 0x6FB92678]` — the
  `StateSetFunc` array starts at **`0x6FB92678`** and is indexed by the `setfunc` value itself (slot 0 is NULL).
- Remove dispatcher `0x6FB220EF`: `movsx ecx, word [state+0x1C]; cmp ax, 0x1E; call [ecx*4 + 0x6FB926F8]` —
  `StateRemFunc` at **`0x6FB926F8`**.

| setfunc | Function | States | Behaviour |
|---:|---|---|---|
| 1 | `0x6FB23410` | progressive_* 122..127 | `pgsvoverlay + charges - 1` |
| 2 | `0x6FB223D0` | cloak_of_shadows 153 | light fade (quest-fx-light.ts) |
| 3 | `0x6FB22320` | blaze 13 | non-local units: add skill stat 350 at level stat 351 (PlrSkills.cpp) |
| 4 | `0x6FB22040` | sourceunit 98 | stats 353/354 (source unit type/id), type < 6 → link |
| 5 | `0x6FB235B0` | changeclass 142 | |
| 6 | `0x6FB23230` | bonearmor 14 | orbiting bone pairs |
| 7 | `0x6FB22C20` | hurricane 144 | play Skills `+0x10E` (prgsound) of skill stat 350 |
| 8 | `0x6FB23000` | cyclonearmor 151 | staged overlays |
| 9 | `0x6FB21FC0` | shrine_skill 134 | D2Common refresh |
| 10 | `0x6FB239C0` | redeemed 99 | |
| 11 | `0x6FB22280` | vine_beast 150 | `unit+0xC8 \|= 0x40000` (no-draw flag; also set by the `mephistodonotdraw` CltHit `0x6FB607EB`) |
| 12 | `0x6FB22260` | invis 146 | `unit+0xC8 \|= 0x40000; unit+0xC4 \|= 0x20` |
| 13 | `0x6FB22970` | attached 143 | `0x6FB77B00`, path flag `\|= 0x10` |
| 14 | `0x6FB23AA0` | wolf 139 / bear 140 | shapeshift |
| 15 | `0x6FB23560` | revive 96 | clear `+0xC4` 0x40, mode 1, set `+0xC4` 0x80000000 |
| 16 | `0x6FB22E40` | maul 117 / feralrage 120 | staged charge orb |
| 17 | `0x6FB23930` | restinpeace 172 | client missile States `missile` (`redemption`) at the unit |
| 18 | `0x6FB23890` | corpseexp 173 | `0x6FAFC500(5)` + client missile (`corpseexplosion`) |
| 19 | `0x6FB21FA0` | skilldelay 121 | empty |

| remfunc | Function | States |
|---:|---|---|
| 1 | `0x6FB22770` | progressive_* |
| 2 | `0x6FB22030` | sourceunit |
| 3 | `0x6FB22A50` | bonearmor |
| 4 | `0x6FB22BB0` | hurricane (stops the prgsound loop, `0x6FB38C20`) |
| 5 | `0x6FB229A0` | cyclonearmor |
| 6 | `0x6FB21FB0` | shrine_skill |
| 7 | `0x6FB22290` | uninterruptable 54 |
| 8 | `0x6FB22240` | invis |
| 9 | `0x6FB22930` | attached |
| 10 | `0x6FB22BA0` | pregnant 110 (`0x6FAD0A60`) |
| 11 | `0x6FB22700` | maul / feralrage |
| 12 | `0x6FB21FA0` | skilldelay |

Holy Shield (state 101) has **no** setfunc: its `hsh ` shield art comes from the component resolver
(`0x6FB1E289`: `cmp ebx, 7` COMP_SH, state `0x65`, `mov eax, 0x20687368`).

## 2. Objects.txt `ClientFn`

`0x6FAD4680` (called by the per-object update `0x6FAD5B40`): `al = objects.bin[+0x1B4]`, `cmp al, 0x13`,
`jmp [eax*4 + 0x6FBA54E8]` (1-based; the dword at `0x6FBA54E0` = 0x17 belongs to the shrine table). Handlers share
`[unit+0xD4]` (timer, 0 for a new unit) and `[unit+0xC8]` (init flag).

| ClientFn | Function | Objects | Notes |
|---:|---|---|---|
| 1 | `0x6FAD46D0` | 45 AmbientSound | empty |
| 2 | `0x6FAD4870` | 67..70 light rays 1R..4R | seeded 0→1(→2)→0 cycle |
| 3 | `0x6FAD4AE0` | — | ClientFn 2 + `0x6FAD37E0` |
| 4 / 5 | `0x6FAD4FA0` / `0x6FAD4ED0` | 110 / 112 | object sounds |
| 6 | `0x6FAD4E30` | 114 | |
| 7 | `0x6FAD4DA0` | 259 QS, 373 QT | 10 s → mode 1, 4.5..7.5 s → 0 |
| 8 | `0x6FAD4C50` | 152 orifice | preload MonStats 211 once |
| 9 | `0x6FAD58F0` | 478 clientsmoke | removed when #10522 distance > 25 |
| 10 | `0x6FAD4D10` | 528 shrub | 3 s → mode 1, 2.5..7.5 s → 0 |
| 11 | `0x6FAD46E0` | 557 | empty |
| 12 | `0x6FAD4C80` | 546 ancientsaltar | preload 537..539 once |
| 13 | `0x6FAD61F0` | 561 | |
| 14 | `0x6FAD53D0` | 39 fire | EnvEffect poll (env-effect.ts) |
| 15 | `0x6FAD5890` | 558 Frozen Anya | npcalert overlay (72) while mode 0 |
| 16 | `0x6FAD4CD0` | 563 / 569 Baal portals | mode 1 at frame Start1<<8 → mode 2 |
| 17 | `0x6FAD5D30` | 567 Zoo | |
| 18 | `0x6FAD49E0` | 568 Keeper | 10 % chance Sounds 2505 every 0..59 s |

`objects.bin +0x16F` is 0 in every 1.13c record (checked against the compiled bin).

## 3. Shrine client table `0x6FB82F60`

23 rows of 20 bytes `{idleFn, operateFn, overlayIcon, overlayShimmer, soundId}`:
- `idleFn` = `0x6FAD5950` for shrines 6..15: while the shrine is in mode 0 it carries Overlay.txt rows `overlayIcon`
  (59..68) and `overlayShimmer` (57/58).
- `operateFn` (S2C 0x0E event 0x15 → `0x6FAD4B90`): 16 `0x6FAD4750` Enirhs (strrev of the player name),
  19 `0x6FAD6060` fire (16 × missile 0x3E), 21 `0x6FAD5F10` exploding (6 × 0x2D), 22 `0x6FAD5DC0` poison (6 × 0x30).
- `soundId` = Sounds.txt rows 0xA68..0xA78.

## 4. Monster palette index and colormap

Create path `0x6FB57A5A..0x6FB57B5B` (MonStats `TransLvl` + 2, unique roll `0x6FB039E0`, MonStats2 Utrans,
SuperUniques Utrans, ≥ 30 → 2), selection `0x6FB03A30`, per-class `\Cof\palshift.dat` loader `0x6FB03C30` (no file →
no colormap at all), RandTransforms loader `0x6FB038F0`.

## 5. Monster sounds

- `0x6FAD3C00` (player frame update `0x6FACC150`, monster frame update `0x6FAFF4A0`): footsteps.
- `0x6FAD37E0` (monster branch `0x6FAD3905..0x6FAD3A20`): Neutral sounds.
- `0x6FAD3A30`: stops / fades a playing Neutral sound (compares Sounds `+0x60` with MonSounds `+0x68`).
