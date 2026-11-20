# Client Display Oracle — What the 1.13c D2Client Shows (`D2Client.dll` / `D2Common.dll`)

Evidence for the client display-value oracle (phase P5.4): hook `tools/oracle/hook/clientui.dll.c`, runner
`tools/oracle/run-client-ui.sh`, comparison `tools/oracle/client-ui-compare.ts` (report
`docs/oracle/P5-client-display.md`). Image bases: `D2Client.dll` `0x6FAB0000`, `D2Common.dll` `0x6FD50000`,
`D2Game.dll` `0x6FC20000`. Listings: objdump of `samples/d2/*.dll` (Intel syntax).

## 1. Method

The hook reuses the oracle frame hook (`GAME_UpdateGameFrame` call sites `D2Game 0x6FC4E2DB` / `0x6FC72712`,
`kb/engine/oracle-hooks-113c.md` §1). In single player `D2Client` drives the server itself (`D2Game #10008` is
called from `D2Client 0x6FAF31ED` / `0x6FAF4D00`), so the hook runs on the client thread: the `meta` line of every
capture logs `hookTid == windowTid` (thread of the `Diablo II` window). 75 frames after the client player appears it:

1. reads the client player's stat list (what the client knows from S2C, not the server unit);
2. calls the computation functions the character sheet uses (§4);
3. calls the original **draw** functions — `UI_DrawCharSheet`, the per-skill attack block and the skill tree
   tooltip builders — with the D2Win text-draw imports of `D2Client` temporarily pointed at recorders and the two
   D2gfx draw imports at no-ops (§5). The recorded strings are exactly what the original renders; no OCR.

All calls go through a fault-recovering call stub (vectored exception handler); every `fault` field in the
captures of the five level-40 saves is `0`.

## 2. Client globals

| VA | Meaning | Evidence |
|---|---|---|
| `0x6FBCBBFC` | D2Client local player unit | `UI_DrawCharSheet 0x6FB6CEA6: mov eax,[0x6fbcbbfc]`; also `0x6FB6CBA3` (hit chance), `0x6FB6C524` (defense hover), `0x6FB6D743` (life clamp) |
| `0x6FBCC390` | byte: current difficulty | `0x6FB6D811: movzx edx,[0x6fbcc390]; push edx; call #10237` |
| `0x6FBC9854` | expansion game flag | resist penalty branch `0x6FB6D8F5`; block `0x6FB6C7F0: push [0x6fbc9854]; push unit; call #10212` |
| `0x6FBA2188` | MonStats row for the attack-rating hover | `0x6FB6CBE0..0x6FB6CC09` (row × 0x1A8, level word `+0xAA + diff*2`) |
| `0x6FBA218C` | MonStats row for the defense hover | `0x6FB6C57A..0x6FB6C5A5` |

## 3. `UI_DrawCharSheet` (`0x6FB6CEA0`, no arguments, plain `ret`)

Value loop `0x6FB6D6A0..0x6FB6DC10` over the 18-entry table `0x6FB8D6F0` (16 bytes: `xLeft, yBase, xRight,
statId`; panel origin `(0,0)` at 640×480):

| # | stat | xLeft..xRight, yBase | field |
|---|---|---|---|
| 0 | 12 | 13..53, 59 | level |
| 1 | 13 | 67..180, 59 | experience |
| 2 | 30 | 195..308, 59 | next level |
| 3 | 0 | 77..112, 99 | strength |
| 4 | 2 | 77..112, 161 | dexterity |
| 5 | 31 | 273..307, 209 | defense |
| 6 | 3 | 77..112, 247 | vitality |
| 7 | 11 | 232..267, 246 | max stamina |
| 8 | 10 | 273..308, 246 | stamina |
| 9 | 7 | 232..267, 270 | max life |
| 10 | 6 | 273..308, 270 | life |
| 11 | 1 | 77..112, 308 | energy |
| 12 | 9 | 232..267, 308 | max mana |
| 13 | 8 | 273..308, 308 | mana |
| 14 | 39 | 273..307, 348 | fire resistance |
| 15 | 43 | 273..307, 372 | cold resistance |
| 16 | 41 | 273..307, 396 | lightning resistance |
| 17 | 45 | 273..307, 420 | poison resistance |

Per row: `esi = D2Common #10973(unit, stat, 0)` (accrued, thunk `0x6FABC1C6`, IAT `0x6FB7E478`), `eax = #10587(unit,
stat, 0)` (base, thunk `0x6FABC250`, IAT `0x6FB7E4D4`), then `switch(stat - 6)` (byte map `0x6FB6DC50`, jump table
`0x6FB6DC24`):

| Case | Function/logic |
|---|---|
| 6 life `0x6FB6D743` | `>> 8`; if `0 <= v <= 1` and the client player is a player (`[eax]==0`) and mode `!= 17` → `1` |
| 7/9/11 max vitals `0x6FB6D6EB` / `0x6FB6D77E` / `0x6FB6D7D8` | `>> 8`; colour blue if accrued > base, red if < |
| 8/10 mana/stamina | `>> 8`, white |
| 13 experience `0x6FB6DA7C` | `D2Lang #10006` (thunk `0x6FABD1F2`) thousands-separated (`18,000,000`) |
| 30 next level `0x6FB6DA04` | level = `#10587(unit,12,0)`; if level `!= #10066(class)` (max level) → `#10399(class, level)`, same formatting |
| 31 defense `0x6FB6D97A` | `D2Common #10672(unit)` (`UNITS_GetDefense`, `0x6FD82890`) |
| 39/41/43/45 resistances `0x6FB6D811` | penalty: expansion → `[#10237(difficulty) + 0]` (DifficultyLevels ResistPenalty), classic → −20 / −50 (`0x6FB6D8F5..0x6FB6D91C`); cap = `min(75 + accrued(stat+1), 95)`; shown = `clamp(accrued + penalty, −100, cap)`; gold when at cap |
| others (level, attributes) `0x6FB6DAF9` | accrued value, blue/red vs base |

The skill part (`0x6FB6D394..0x6FB6D402`):

```
6fb6d39d: call 0x6fabc5bc        ; D2Common #10828 -> pSkills+0x08 (left)
6fb6d3a6: call 0x6fadfd30        ; (unit, left, slot 0)   top block
6fb6d3ac: call 0x6fabc5ce        ; D2Common #10507 -> pSkills+0x0C (right)
6fb6d3b5: call 0x6fadfd30        ; (unit, right, slot 6)  bottom block
6fb6d3c4: call 0x6fade350        ; (unit, 1) -> AR of the left skill
6fb6d3ca: call 0x6fb6cb90        ;   -> hit chance
6fb6d3d4: call 0x6fade350        ; (unit, 0) -> AR of the right skill
6fb6d3e1: call 0x6fb6c520        ; monster hit chance (defense hover)
6fb6d3f5: call 0x6fb6c8f0 / 0x6fb6c760   ; hover tooltips (only drawn under the mouse)
```

Left/right: `#10828` (`0x6FD80460`) returns `pSkills+0x08`, `#10507` (`0x6FD80420`) returns `pSkills+0x0C`. The
necromancer save's header right skill (`.d2s +0x7C` = 70, Raise Skeleton) is found at `pSkills+0x0C` in the
capture (`calc.rightSkill = 70`), so `+0x08` = left, `+0x0C` = right; the top block is the left skill.

## 4. Computation functions called directly (`calc` line)

| Field | Function | Convention |
|---|---|---|
| `defense` | `D2Common #10672` `0x6FD82890` | stdcall(unit) |
| `block` | `D2Common #10212` `0x6FD81D20` | stdcall(unit, bExpansion) — used by the defense hover `0x6FB6C7FE` |
| `weaponBlock` | `D2Client 0x6FB6C430` | `eax = unit` — fallback of the hover when #10212 ≤ 0 |
| `arLeft` / `arRight` | `D2Client 0x6FADE350` | stdcall(unit, sel), `ret 8`; `sel != 0` → left (#10828), `sel == 0` → right (#10507); returns the first output of `0x6FBA52A0[SkillDesc+0x14]` (`descatt`, < 0x48), `0` when the skill has none |
| `hitLeft` / `hitRight` | `D2Client 0x6FB6CB90` | stdcall(ar), `ret 4`: `clamp(5, 95, 200·ar·alvl / ((ar+def)·(alvl+mlvl)))` against MonStats row `[0x6FBA2188]` |
| `monHitPct` | `D2Client 0x6FB6C520` | no args: monster AR from row `[0x6FBA218C]` vs defense + stat 33 |
| `maxLevel` / `nextExp` | `D2Common #10066` `0x6FDAE7E0` / `#10399` `0x6FDAE810` | stdcall(class) / (class, level) |
| `resPenalty` | `D2Common #10237` `0x6FDB03C0` | stdcall(difficulty) → DifficultyLevels row, `+0` ResistPenalty |
| skill levels | `D2Common #10306` (IAT `0x6FB7E804`) | stdcall(unit, pSkill, bTotal) |

Skill list walk: `unit+0xA8` → `+0x04` first skill; skill `+0x00` pSkillsTxt (word id), `+0x04` next.

## 5. Per-skill attack block and tooltips

`0x6FADFD30` stdcall(unit, pSkill, slot), `ret 0xC`:

* name: SkillDesc `+0x0E` string id (`str alt`; the record holds str name / short / long / alt / mana at
  `+0x08/+0x0A/+0x0C/+0x0E/+0x10`, then descdam `+0x12`, descatt `+0x14`) → `D2Lang #10003` → upper-cased in place by `0x6FB6E800`
  (D2Lang case table, IAT `0x6FB7EB04`), drawn centred in layout row `0x6FBA52E8 + slot*12`;
* attack rating box: handler `0x6FBA52A0[SkillDesc+0x14]` (only if non-null);
* damage row: handler `0x6FBA5210[SkillDesc+0x12]` (`descdam`, < 0x90; skipped when null, `0x6FADFEA4..0x6FADFEC6`);
  it draws the "Damage"/label strings (`D2Lang` 0xFDD / 0xFDF / 0xFE1) and `min-max` via `0x6FADD3C0`, or a single
  value via `0x6FADD300`; nothing when both outputs are 0.

The hook calls it with slot 0 (top/left layout) for every skill in the client skill list. Damage values are drawn
at `y < 140`, attack ratings at `y >= 140` (panel coordinates), which is how `parseSkillBlock` splits them.

Skill tree tooltip (caller `0x6FB28820`):

* `0x6FAE3B50` — skill has a level: `ecx = skillId`, stdcall(unit, lvl, 0, x, y), `ret 0x14` (call site `0x6FB289C0`);
* `0x6FAE3550` — no level: stdcall(unit, skillId, lvl, 0, x, y), `ret 0x18` (call site `0x6FB289D8`).

Both build one wide-string buffer through the SkillDesc line dispatcher `0x6FAE16C0` and draw it with `D2Win
#10085` at the end (`0x6FAE40D8` / `0x6FAE3B37`). The buffer is stored bottom line first (strcat order), so the
comparison reverses the `\n`-split lines; colour escapes `ÿc<n>` are stripped. The hook passes `lvl = #10306(unit,
pSkill, 1)` (total level). Scroll/tome skills (217..220) first draw their quantity box with the same import; the
builder's own text is the last `#10085` record.

## 6. Redirected imports during a capture

Static call-graph closure from `0x6FB6CEA0` (plus the two handler tables) and from `0x6FAE3550` reaches these
D2Win/D2gfx imports (ret sizes from the export bodies):

| IAT slot | Import | Convention | During capture |
|---|---|---|---|
| `0x6FB7EBC4` | D2Win #10150 DrawText | fastcall(text, x \| y, color, flag), `ret 0xC` | recorded |
| `0x6FB7EBC8` | D2Win #10085 framed text | fastcall(text, x \| y, color, flag), `ret 0xC` | recorded |
| `0x6FB7EBA4` | D2Win #10013 text | fastcall(text, x \| y, a, b, c), `ret 0x10` | recorded |
| `0x6FB7EBA8` | D2Win #10184 SetFont | fastcall(font) → old | passed through, font id recorded |
| `0x6FB7EBF4` | D2gfx #10041 cel draw | stdcall, 6 args, `ret 0x18` | no-op |
| `0x6FB7EC2C` | D2gfx #10014 rectangle | stdcall, 6 args, `ret 0x18` | no-op |

Not redirected (pure lookups): D2Win #10028 text width, #10177 text size, #10190 palette index, #10016; D2CMP
#10006 / #10070 (lazy cel load of `0x6FBCB9C4` at `0x6FB6D43A`).

## 7. Output (`C:\oracle\out\ui.ndjson`)

One JSON object per line:

* `meta`: frame, `hookTid`, `windowTid`, player id, class, difficulty, expansion, MonStats rows, mode;
* `stats`: non-zero `accrued` / `base` values of ids 0..358 on the client player;
* `calc`: §4 values, resistances (`raw`, `maxStat`, `cap`, `shown`), `leftSkill` / `rightSkill`;
* `charsheet`: `texts` = `[import, x, y, color, font, text]` for every string `UI_DrawCharSheet` drew;
* `skill` (per skill in the client list): `hard`, `total`, left-hand `ar`, `texts` of `0x6FADFD30`;
* `tooltip` (per skill): builder VA and `texts`.

## 8. Observations from the level-40 captures

* Character sheet strings match the client stat list exactly (e.g. barbarian: level `40`, experience `18,000,000`,
  next level `19,235,252`, life `533`/`533` = stat 7 `136448 >> 8`).
* The client skill list of every class contains, besides the class skills, Skills.txt rows 0..3 (+4, 5 for the
  barbarian) and 217..220 at level 1.
* Buff/aura/curse skills (descdam = 0) draw no damage row; Kick draws `0-1`; Throw / Left Hand Throw / Left Hand
  Swing draw only the name when the needed item is not equipped; Smite draws `1-5` (paladin with shield).

## 9. Specific `descdam` & `descline` VAs verified in Phase 1

* `descdam = 2` (`Kick #1`, `0x6FAE0AE0..0x6FAE0B2E`): computes `val = ((MinDam << HitShift) >> 8) + STATLIST_UnitGetStatValue(unit, STAT_ITEM_KICKDAMAGE /* 137 */, 0)` and formats via `0x6FADF0A0(min, max)` (`if (min >= max) max = min + 1`), ignoring weapon, boot, Str/Dex, and elemental stats (`0-1` when stat 137 is 0). Assassin kicks (`#255, #270, #275`) use `descdam = 15/16` (`0x6FAE0340` / `0x6FAE2BF0`).
* `descdam = 10` (`Smite #97`, `0x6FAE05D0..0x6FAE07AB`): inspects the equipped shield (`Armor.txt` item in arm slot matching `shld`). Returns nothing if no shield is equipped; otherwise sums shield `mindam..maxdam` + active `STATE_HOLYSHIELD (101)` `#117` 5-band `MinDam..MaxDam` (`3..6`, `[+2,+3,+4,+4,+4]`), scales by `max(-90, ddamCalc1 + Str*StrBonus/100 + Dex*DexBonus/100 + stat(25)) + stat(18|17)`, and emits physical-only `min-max` (`1-5` on starter Buckler with Str 75 and Smite L1).
* `descdam = 5` (`0x6FAE5270` → `D2Common #10121` `0x6FDA0460` / `#11091` `0x6FDA0510` with `bMastery = 1`): evaluates `EDmgSymPerCalc` and caster elemental mastery (`0x6FD9F870`) in 256ths before `>> 8` (`Fire Bolt #36` L2 = `15-25`, `Ice Blast #45` L1 = `12-18`).
* `0x6FAE3B50` (`lvl > 0` tooltip builder): stores `[esp+0x18] = lvl + 1` at `0x6FAE3C67..0x6FAE3C78` and evaluates `dsc2` (`slot 6..9`) at `lvl + 1` (`0x6FAE3EA0`), whereas `0x6FAE3550` (`lvl <= 0`) evaluates `dsc2` at `1` (`0x6FAE37D4`). For `Raise Skeleton #70` at `lvl = 16` (`Skeleton Mastery` L10), `descline 34` (`0x6FADE410`) in `dsc2` evaluates at `lvl = 17` → `Damage: 61-63`.
* `descline 39` (`0x6FAE2155` → `0x6FADE900`, Golems `#75, #85, #90`) & `descline 41` (`0x6FAE2251` → `0x6FADE770`, `Fire Golem #94`): read difficulty-indexed `MonStats.txt` `A1MinD`/`A1MaxD` via `0x6FABC244`; `0x6FADE900` scales by `aurastat`/`passivestat` `STAT_DAMAGEPERCENT (25)` formulas (`max(-90, pct)`), while `0x6FADE770` adds `calcA..calcB` to `A1MinD..A1MaxD` with `EType` prefix (`StrSkill5`).
* `descline 53..56` (`217..220` Scrolls/Tomes, `0x6FAE24FB..0x6FAE25A8` → `0x6FADC950`): `0x6FADC950` draws the quantity side-box separately at `(x - 128, y - 52)` via `D2Win #10085` without appending to the main tooltip `outBuf`, while returning `1` so `0x6FAE3B50` still emits the `"Current Skill Level: N"` and `"Next Level"` headers.
