# Milestone 34 (`[K3]`): Longitudinal Golden Replay Suite (`9 × p52-*`, `15,700` Frames)

Pure-kernel (`src/d2kern-113c/`) frame-by-frame longitudinal replay suite covering all 9 Milestone 34 (`[K3]`) class combat, passive defense, summon, curse, warcry, aura, mercenary, and elemental/DoT missile scenarios in `tests/fixtures/oracle/golden/p52-*.oracle.ndjson.gz`.

All **9 / 9** scenarios (`15,700` golden frames, `15,682 / 15,682` post-boot frames) run at **100% full-horizon strict zero divergence** (`firstDivergence = null`, `firstPosDivergence = null`), **`0` manifest unported VAs**, **`0` impure `kernFile` VAs**, and **`runtimeExecGap = 0` (`dllExecuted ⊆ tsExecuted`)** across both `D2Common.dll` (`780 / 780` union VAs) and `D2Game.dll` (`652 / 652` union VAs).

## Architecture & Paths

| Piece | Path |
|---|---|
| K3 replay runner, runtime execution gap analyzer & horizon updater | `tools/oracle/kern-replay/k3-replay.ts` |
| Shared pure replay kernel & memory sampler | `tools/oracle/kern-replay/replay-113c.ts` -> `src/d2kern-113c/game/replay-kernel-113c.ts` |
| Headless Wine recorder (`d2host-113c.exe` + `d2oracle.dll`) | `tools/oracle/kern-replay/record-boot-headless.sh` -> `tools/oracle/run-headless-oracle.sh` |
| K3 ratchet, purity & `dll ∩ ts` runtime coverage test suite | `tests/oracle/k3/replay-k3-p52-suite.test.ts` |
| K3 committed horizons (upward-only ratchet) | `tests/fixtures/oracle/k3/replay/horizons.json` |
| K3 `F2` boot snapshots & dynamic DLL coverage | `tests/fixtures/oracle/k3/replay/<scenario>.{snap-f002,coverage}.ndjson.gz` |
| Per-scenario divergence artifacts & closure notes | `docs/oracle/k3-replay/<scenario>.divergence.{json,md}` |
| Per-scenario `dll ∩ ts` & `runtimeExecGap` (`dll - ts`) reports | `docs/oracle/k3-replay/gap-<scenario>.md` |

Regenerate divergence artifacts, runtime execution gap lists, and upward-only horizons after a kernel change:

```bash
npx tsx tools/oracle/kern-replay/k3-replay.ts --write --update-horizons
```

Re-record `F2` boot snapshots or dynamic coverage on the original 1.13c DLLs via headless `d2host-113c.exe`:

```bash
tools/oracle/kern-replay/record-boot-headless.sh <scenario> snap
tools/oracle/kern-replay/record-boot-headless.sh <scenario> cover
```

All 18 headless recordings (`9 × snap` + `9 × cover`, `15,700` simulated frames each pass) verified **100% frame-by-frame identity** (`t0,t1,t3`) against the checked-in `Game.exe` goldens, aided by `d2host-113c.c`'s deterministic `25 fps` (`+40 ms/frame`) virtual `GetTickCount` IAT hook (`0x6FD18D10`) for `PLAYER_StepModeWalkOrRun` (`0x6FC99BE7`, `+25 ms` gate on `pPlayerData+0xA4` -> 20-entry breadcrumb ring `pPlayerData+0xA8` read by `NecroPet` `PetMove` state `1` `0x6FC3CE2A`).

---

## Live Verified Full-Horizon & Runtime Execution Coverage Table

Measured via `npx tsx tools/oracle/kern-replay/k3-replay.ts --write` and enforced in `tests/oracle/k3/replay-k3-p52-suite.test.ts` (`dllExecuted ⊆ tsExecuted` across all 9 scenarios):

| Scenario | Golden Frames | Boot (`F2`) | `strict` / `pos` Horizon | Matched Kernel Frames | First Divergence | `D2Common` `dll ∩ ts` (`total TS`) | `D2Common` `runtimeExecGap` | `D2Game` `dll ∩ ts` (`total TS`) | `D2Game` `runtimeExecGap` |
|---|---:|---|---:|---:|---|---:|---:|---:|---:|
| `p52-amazon-defense` | `1800` | identical | `F1800` / `F1800` | `1798 / 1798` | `null` (`0` diff) | `520 / 520` (`641`) | `0` (`0 B`) | `438 / 438` (`508`) | `0` (`0 B`) |
| `p52-amazon-valkyrie` | `1500` | identical | `F1500` / `F1500` | `1498 / 1498` | `null` (`0` diff) | `641 / 641` (`747`) | `0` (`0 B`) | `491 / 491` (`564`) | `0` (`0 B`) |
| `p52-barbarian-warcries` | `1600` | identical | `F1600` / `F1600` | `1598 / 1598` | `null` (`0` diff) | `587 / 587` (`697`) | `0` (`0 B`) | `485 / 485` (`556`) | `0` (`0 B`) |
| `p52-necromancer-curses` | `2000` | identical | `F2000` / `F2000` | `1998 / 1998` | `null` (`0` diff) | `617 / 617` (`732`) | `0` (`0 B`) | `524 / 524` (`598`) | `0` (`0 B`) |
| `p52-necromancer-poison-golem` | `1800` | identical | `F1800` / `F1800` | `1798 / 1798` | `null` (`0` diff) | `615 / 615` (`732`) | `0` (`0 B`) | `516 / 516` (`594`) | `0` (`0 B`) |
| `p52-paladin-auras` | `1700` | identical | `F1700` / `F1700` | `1698 / 1698` | `null` (`0` diff) | `601 / 601` (`713`) | `0` (`0 B`) | `482 / 482` (`555`) | `0` (`0 B`) |
| `p52-paladin-merc-aura` | `1700` | identical | `F1700` / `F1700` | `1698 / 1698` | `null` (`0` diff) | `666 / 666` (`777`) | `0` (`0 B`) | `544 / 544` (`616`) | `0` (`0 B`) |
| `p52-sorceress-elemental` | `1800` | identical | `F1800` / `F1800` | `1798 / 1798` | `null` (`0` diff) | `552 / 552` (`671`) | `0` (`0 B`) | `434 / 434` (`507`) | `0` (`0 B`) |
| `p52-sorceress-fire-dot` | `1800` | identical | `F1800` / `F1800` | `1798 / 1798` | `null` (`0` diff) | `543 / 543` (`658`) | `0` (`0 B`) | `426 / 426` (`501`) | `0` (`0 B`) |
| **9-Scenario Union** | **`15,700`** | **9 / 9 identical** | **Full Horizons** | **`15,682 / 15,682`** | **`0` divergences** | **`780 / 780`** | **`0` (`0 B`)** | **`652 / 652`** | **`0` (`0 B`)** |

**Aggregate closure gates**:
- **Boot hydration**: `9 / 9` scenarios strictly match `F2` across every unit field, seed, level, stat, and `gs` (`bootCheck === null`), with per-scenario single-bit player `seedLo` negative controls.
- **Full-frame strict parity**: `15,682 / 15,682` stepped frames (`100.00%`) match strictly across `t0`, `t1`, `t3`, stats, seeds, levels, and `gs`.
- **Static & purity gap**: `0` `manifestGap` (`100.00%` `diff-verified` across all `4,810` closure VAs) and `0` impure `kernFile` imports (`src/d2kern-113c/` reaches zero legacy `src/common` / `src/server` modules).
- **Dynamic runtime execution gap (`dllExecuted - tsExecuted`)**: **`0`** on every scenario and across the 9-scenario union (`780 / 780` `D2Common` + `652 / 652` `D2Game` = **`1,432 / 1,432 = 100.00%`** DLL-executed VAs hit at runtime in TypeScript).

---

## Closed `[K3]` `D2Game.dll` Subsystems & Key Disassembly Fixes

All `15` previously unported `D2Game.dll` VAs (plus downstream skill/missile/summon/mercenary dispatchers) were ported to `src/d2kern-113c/game/`, verified against 1.13c PE32 disassembly, and locked in `dll ∩ ts`:

| VA (`D2Game.dll`) | Size (B) | Subsystem / Role | Scenarios Hitting VA (First Frame) |
|---|---:|---|---|
| `0x6FC3DD40` | `1018` | `AI_Hireable` (`MonAI` entry for hired mercenaries, e.g. Act 1 Rogue Scout `hcIdx = 271`) | `p52-paladin-merc-aura` (`F3`) |
| `0x6FC3D3C0` | `1890` | `AI_Hireable_Sub` (mercenary town walk, owner follow, target selection, `#8 Inner Sight` / `#11 Cold Arrow` cast) | `p52-paladin-merc-aura` (`F3`) |
| `0x6FC49720` | `148` | `SKILLS_SrvDo068_BasicShout` (`Shout` `#138`, `Battle Orders` `#149`, `War Cry` `#154`, `Battle Command` `#155` radial missile ring) | `p52-barbarian-warcries` (`F638`) |
| `0x6FC5EA60` | `118` | `MISSMODE_SrvHit18_Shout_BattleCommand_BattleOrders` (`pSrvHitFunc = 18`: applies BO state `32`, BC state `51`, Shout state `26`) | `p52-barbarian-warcries` (`F653` / self-hit `F638`) |
| `0x6FC6D710` | `425` | `SKILLS_SrvDo016_Valkyrie` (skill `#32`: summons `valkyrie` `#357`, `MonEquip` rare gear, synergy passives, `+20f` AI think) | `p52-amazon-valkyrie` (`F642`) |
| `0x6FC71750` | `346` | `SKILLS_SrvDo056_Golem` (skill `#75` `Clay Golem`: summons `claygolem` `#289` in `S1`, Golem Mastery stats, `+25f` AI think) | `p52-necromancer-poison-golem` (`F637`) |
| `0x6FC70070` | `48` | Golem Mastery passive stat helper called by `SKILLS_SrvDo056_Golem` | `p52-necromancer-poison-golem` (`F637`) |
| `0x6FC718B0` | `476` | `SKILLS_SrvDo031_RaiseSkeleton_Mage` (skill `#70` `Raise Skeleton`: consumes corpse `#10`, spawns `necroskeleton` `#363`) | `p52-necromancer-curses` (`F1517`) |
| `0x6FCC3610` | `448` | `D2GAME_SummonPet` (shared summon unit spawner, cap enforcement, initial mode & `frame + 25` AI event) | `p52-necromancer-poison-golem` (`F637`), `p52-amazon-valkyrie` (`F642`), `p52-necromancer-curses` (`F1517`) |
| `0x6FCC3090` | `129` | Pet count / cap roster helper for `D2GAME_SummonPet` | `p52-necromancer-poison-golem` (`F637`), `p52-amazon-valkyrie` (`F642`), `p52-necromancer-curses` (`F1517`) |
| `0x6FCB7F50` | `273` | Player pet-owner table registration (`PetType.txt` linkage & S2C pet sync) | `p52-necromancer-poison-golem` (`F637`), `p52-amazon-valkyrie` (`F642`), `p52-necromancer-curses` (`F1517`) |
| `0x6FC3E900` | `81` | `AI_NecroPet` (`MonAI` `#67` top-level dispatcher for Golems, Valkyrie, Skeletons) | `p52-amazon-valkyrie` (`F662`), `p52-necromancer-poison-golem` (`F662`), `p52-necromancer-curses` (`F1542`) |
| `0x6FC3E640` | `693` | `AI_NecroPet_Melee` (owner distance check, target acquisition, `80%` `A1` swing vs approach/idle) | `p52-amazon-valkyrie` (`F662`), `p52-necromancer-poison-golem` (`F662`), `p52-necromancer-curses` (`F1542`) |
| `0x6FC3E140` | `655` | `AIPET_CheckFollow` (computes follow threshold & state `0..5` from owner mode/zone/warp pos) | `p52-amazon-valkyrie` (`F662`), `p52-necromancer-poison-golem` (`F662`), `p52-necromancer-curses` (`F1542`) |
| `0x6FC3CAE0` | `2234` | `AIPET_PetMove` (jump-table `0x6FC3D39C` states `0..5`: lead-ahead, `pPlayerData+0xA8` breadcrumb ring, idle wander, leash teleport) | `p52-amazon-valkyrie` (`F662`), `p52-necromancer-poison-golem` (`F662`), `p52-necromancer-curses` (`F1576`) |

### Per-Scenario Closure Summary (`F3..FN` Zero Divergence)

1. **`p52-amazon-defense` (`F1800 / F1800`)**: Fixed `D2Common.#10309` (`0x6FD80D50` @ `0x6FD80D7B`) monster `MONMODE_RUN (15)` velocity to read `MonStats.Velocity << 8` (`+0x32`) instead of `MonStats.Run` (`+0x34`), hydrated Amazon `.d2s` passives (`Dodge` state `64` `stat 338`, `Avoid` state `65` `stat 339`, `Evade` state `66` `stat 340`, `Critical Strike` state `68` `stat 337`), and wired `SUNITDMG` defender evade (`S1`) + attacker `stat 337` crit rolls (`0x6FCFDE90` / `0x6FC98610` / `0x6FCFD450`).
2. **`p52-amazon-valkyrie` (`F1500 / F1500`)**: Wired `SKILLS_SrvDo016_Valkyrie` (`0x6FC6D710`), `D2GAME_SummonPet` (`0x6FCC3610`), `MonEquip.txt` rare gear generation (`0x6FCCFCE0`), synergy passives, `+20f` initial AI think, and `NecroPet` AI (`0x6FC3E900`..`0x6FC3CAE0`) including `pPlayerData+0xA8` breadcrumb-ring follow (`0x6FC99B90`).
3. **`p52-barbarian-warcries` (`F1600 / F1600`)**: Wired `SKILLS_SrvDo068_BasicShout` (`0x6FC49720`), `MISSMODE_SrvHit18_Shout_BattleCommand_BattleOrders` (`0x6FC5EA60`) for `Battle Orders` (`#149` state `32`), `Battle Command` (`#155` state `51`), `Shout` (`#138` state `26`), and `War Cry` (`#154` missile `#235` -> `MISSMODE_SrvDmg07_Warcry_ShockWave` `0x6FC59600` stun state `21`).
4. **`p52-necromancer-curses` (`F2000 / F2000`)**: Wired `C2S 0x0D` (`0x6FCEE870` -> `0x6FC98840`), `SKILLS_SrvDo030_Curse` (`0x6FC705D0` -> `0x6FC70250` + `0x6FCB0F30`) for `Amplify Damage` (`#66`), `Decrepify` (`#87`), `Lower Resist` (`#91`), and `Weaken` (`#72`), plus `Raise Skeleton` (`#70`, `0x6FC6EF20` / `0x6FC718B0` / `0x6FC6E960` / `0x6FC6EB50`) and `NecroPet` AI.
5. **`p52-necromancer-poison-golem` (`F1800 / F1800`)**: Wired `SKILLS_SrvDo056_Golem` (`0x6FC71750`), Golem Mastery bonus (`0x6FC70070`), `EventFunc27_SlowTarget` (`0x6FC6EF70` slow state `24`), `NecroPet` AI, and `Poison Nova` (`#92`, `0x6FC63AA0`) + `Event 3` poison DoT (`0x6FC96740`).
6. **`p52-paladin-auras` (`F1700 / F1700`)**: Enforced the `0x6FCEE9D0 -> 0x6FC983A0` mid-swing `PLRMODE_ATTACK1` restart guard before `UNITFLAG_SKSRVDOFUNC` and wired player `Event 6` periodic aura ticks (`0x6FCC00B0` -> `SKILLS_SrvDo065_BasicAura` `0x6FCBA8D0`) for `Concentration` (`#113` state `42`) and `Fanaticism` (`#122` state `49`).
7. **`p52-paladin-merc-aura` (`F1700 / F1700`)**: Wired `AI_Hireable` (`0x6FC3DD40` / `0x6FC3D3C0`), Act 1 Rogue Scout `#8 Inner Sight` (`0x6FC6C2A0`) and `#11 Cold Arrow` (`0x6FCD49F0` -> `0x6FC59CE0`), shared mercenary kill XP (`0x6FCFDCB0`), and Paladin radial party aura (`Concentration` + `Fanaticism`) onto friendly mercenary `#1`.
8. **`p52-sorceress-elemental` (`F1800 / F1800`)**: Wired `C2S 0x0D` + missile `SrvDo`/`SrvHit` handlers for `Fire Ball` (`#47` -> `0x6FC5B990`), `Chain Lightning` (`#53` `0x6FC63720` -> `0x6FC5D020`), `Frozen Orb` (`#64` `0x6FC60CA0` / `0x6FC5C850` -> `frozenorbnova` `0x6FC60BD0`), and `Glacial Spike` (`#55` -> `0x6FC5B3E0`).
9. **`p52-sorceress-fire-dot` (`F1800 / F1800`)**: Wired `SKILLS_SrvDo024_FireWall` (`0x6FC637D0` + `skilldelay` state `121`), `FireWallMaker` / `FireWall` (`0x6FC61850`, `0x6FC61980`, `0x6FC59670`), and `PLRMODE_SEQUENCE (14)` `Inferno` (`#41`, `0x6FC64550` / `0x6FC64390` `STATE_INFERNO` `85` + per-tick mana drain).

---

## Committed Fixtures (`tests/fixtures/oracle/k3/replay/`)

| File | Gzip Bytes | Raw Bytes | SHA-256 (Gzip) |
|---|---:|---:|---|
| `p52-amazon-defense.snap-f002.ndjson.gz` | `28,156` | `620,631` | `ceef3e26ea4964bb0d7838f388d6ff9529ef24d411f948196d48ba056b0c1a2a` |
| `p52-amazon-valkyrie.snap-f002.ndjson.gz` | `28,155` | `620,631` | `bf35615693a5030adaa54db144020ee10cc8e4e207aed3839ce9376747d101c3` |
| `p52-barbarian-warcries.snap-f002.ndjson.gz` | `27,828` | `619,235` | `ea6f058c2adf6e348754dd1d579e0feb8037fb9a6dc427443cd5cafe2cd404af` |
| `p52-necromancer-curses.snap-f002.ndjson.gz` | `27,610` | `616,396` | `4a6c992f7d31ea272c3d75b064192a94d05b1bafc1d1afabfd80777ad610e3dd` |
| `p52-necromancer-poison-golem.snap-f002.ndjson.gz` | `27,624` | `616,396` | `105ac71370143a464cb6a63c44362d21d476623d930c7d31f08db785e9105329` |
| `p52-paladin-auras.snap-f002.ndjson.gz` | `27,946` | `619,765` | `5d754d364d1670994a40e024caa16d03bb35d669f0d75d44a4defe70933a2445` |
| `p52-paladin-merc-aura.snap-f002.ndjson.gz` | `28,354` | `624,013` | `71e7118af1fe355e1bc90c3ea43e9e213ef78ef1e74b055d921fdddf7522412b` |
| `p52-sorceress-elemental.snap-f002.ndjson.gz` | `27,754` | `616,757` | `b62c41888d8595debd4241123fef29ef4c83411dc3bd9fa4aeedaaa6827eae5d` |
| `p52-sorceress-fire-dot.snap-f002.ndjson.gz` | `27,709` | `616,492` | `aed7b57697fcf7cb1e61e7b97b622bfb43926f7dafa213ee5f790a6bbdb5c663` |
| `p52-amazon-defense.coverage.ndjson.gz` | `3,792` | `39,775` | `74e41c65e0835700d14d88d89308d8b015c3f47ba5f6c545ac9094853b4f64f0` |
| `p52-amazon-valkyrie.coverage.ndjson.gz` | `4,390` | `46,992` | `c8240307a1b36ab0de6464ff86ea7bf08a641ad471c7515e59ecb8720368ee86` |
| `p52-barbarian-warcries.coverage.ndjson.gz` | `4,274` | `44,596` | `9430f6dc66f6e44b7dfc082d8dedb74df3e45c01c15f0ff8c8e679f4a905446f` |
| `p52-necromancer-curses.coverage.ndjson.gz` | `4,537` | `47,371` | `22c5b52ba8d571d8ce43d56ae069f72d523082e1eb3900ff52913b18af9dbf92` |
| `p52-necromancer-poison-golem.coverage.ndjson.gz` | `4,491` | `46,894` | `53d35acbb923a05dfcb767618ba594838582a2d4dc9c6c1f565b38e3b2184c41` |
| `p52-paladin-auras.coverage.ndjson.gz` | `4,198` | `44,918` | `f8f47ec494f53ca0c6cdd4c938831b77df028caea37e704ad74b4565b26ec35e` |
| `p52-paladin-merc-aura.coverage.ndjson.gz` | `4,735` | `50,171` | `d80ae2c55fa801878e4ee0f3a4d952d61e7971f00375c854a2e16e6204485be7` |
| `p52-sorceress-elemental.coverage.ndjson.gz` | `3,868` | `40,852` | `b0bc6875ce3d3e134e2db4610d62de8caf858d18228a99890d56a3194abdff07` |
| `p52-sorceress-fire-dot.coverage.ndjson.gz` | `3,759` | `40,103` | `448fbe2523f648d8f66a603c2db5f1b6aaa82422acde9e4c2a577e4afc8bb51f` |
