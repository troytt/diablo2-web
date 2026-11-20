# P0 Audit — Server Determinism, RNG, Capture/Replay, Save Loading, Combat Map

Scope: TypeScript Diablo II 1.13c server reimplementation (`src/server`, plus the `src/common`
modules the server depends on). Branch `feat/oracle-diff`. All references are repo-relative
`file:line`. Read-only audit; no source was modified.

---

## 1. Server main loop

### 1.1 Engines that exist

| Engine | File | Role |
|---|---|---|
| `GameInstance` | `src/server/engine/game-instance.ts:96` (class body = `GameInstanceState` in `src/server/engine/game-instance/state.ts` + method mixins `Object.assign(...)` at `game-instance.ts:105`, one mixin per file in `src/server/engine/game-instance/*.ts`) | The authoritative 25 Hz game server. Used by `LocalLoopbackAdapter` (single player) and `MultiClientRoomHost` (multi-client). |
| `GameEngine` | `src/server/engine/game-engine.ts:335` (`tick(input)` at `:725`) | Older single-player "CombatWorld" simulation built on `src/server/ai/monster-ai.ts`. Still exported via the barrel (`src/server/engine.ts:5` → `game-engine.ts`) and used by many legacy tests (`tests/engine.test.ts`, `tests/attack-skill.test.ts`, …) but **not** used by the loopback adapter or room host. Out of scope for a replica runner; listed so nobody wires the wrong engine. |

`src/server/engine.ts` is a 5-line barrel; `src/server/index.ts` re-exports everything.

### 1.2 Tick rate and how frames advance

* Frame length constant: `SERVER_FRAME_MS = 40` (25 fps) and `MAX_CATCHUP_FRAMES = 5` —
  `src/server/loopback-adapter.ts:62-63`.
* The core engine is **purely frame-stepped**: `GameInstance.stepFrame()`
  (`src/server/engine/game-instance/frame-and-commands.ts:29`) advances exactly one frame;
  `stepFrames(n)` (`:354`) loops it. There is no internal timer, no `setInterval`, no clock read.
  Time inside the engine is `currentFrame` (`state.ts:42`), exposed as `tickCount`/`frame`
  (`state.ts:637-644`).
* Wall-clock → frames conversion happens **only in the adapters**, using an accumulator:
  * `LocalLoopbackAdapter.tick(dtMs)` — `src/server/loopback-adapter.ts:485-517`:
    accumulates `dtMs` (clamped to `MAX_CATCHUP_FRAMES * 40 = 200 ms`), steps whole 40 ms frames,
    max 5 per call; excess time is dropped. **Quirk:** if `dtMs` is an integer in `1..10` it is
    interpreted as a *frame count* (`:488-491`), not milliseconds. When paused it runs one
    "pause frame" and resets the accumulator (`:497-502`).
  * `LocalLoopbackAdapter.stepFrame()/stepFrames()` — `:465-483` (deterministic, frame-exact).
  * `MultiClientRoomHost.tick(dtMs)` — `src/server/room-host.ts:298-315` (same accumulator, no
    small-integer quirk); `stepFrame()/stepFrames()` at `:280-296`.
* Who supplies `dtMs` in the browser: `src/client/main.ts:2630-2641` runs a `LogicClock`
  (`src/client/loop/logic-clock.ts:71`) off `performance.now()`/rAF and calls
  `session.tick(dtMs, nowMs)` → `src/client/session/online-session.ts:1813-1819` →
  `adapter.tick(dtMs)`. So in production the number of server frames per wall interval, and
  which frame a command lands in, are wall-clock dependent; the engine itself is not.
* There is **no network listener** in `src/server` (no TCP/WS server). `RoomClientSession`
  (`src/server/net/session.ts`) speaks the D2GS wire protocol over an injected `ByteStream`
  (`[0xAF,0x01]` greeting, `0x68`, compressed `0x01/0x02`, `0x6B`, Huffman framing —
  header comment `session.ts:1-9`, `decodeD2gsC2sPacketToCommand` at `:51`).

### 1.3 Command intake

* `enqueueCommand(playerUnitId, cmd)` just pushes to `commandQueue`
  (`src/server/engine/game-instance/world-spawning-and-aoi.ts:1628-1631`). Callers:
  `LocalLoopbackAdapter.send` (`loopback-adapter.ts:454-462`), `MultiClientRoomHost.handleClientCommand`
  (`room-host.ts:235-250`; `Ping` answered immediately with `Pong` outside the frame,
  `LeaveGame` handled immediately).
* Commands are consumed at the start of the *next* `stepFrame()`, FIFO.

### 1.4 Exact per-frame order (`stepFrame`, `frame-and-commands.ts:29-351`)

| # | Line | Step |
|---|---|---|
| 0a | 30-50 | Pending object spawns due (`pendingObjectSpawns`, iterated **reverse**), schedule mode transitions |
| 0b | 51-59 | Pending object mode transitions due |
| 0c | 60-62 | `stepPendingHellforgeDrops113c`, `stepShenkBombardments113c`, `stepTowerChestSpawners113c` |
| 1 | 66-93 | Drain `commandQueue` FIFO → `processPlayerCommand` (`:383`). `PauseGame` toggles pause; while paused only `/players` chat runs, others deferred and re-queued at head (`:95-97`). Exceptions are caught and turned into a system chat (`:85-92`). |
| 1b | 94 | `stepPendingInteractions()` |
| — | 99-105 | **If paused: return here.** Note steps 0a–1b ran anyway and `currentFrame` did not advance. |
| 2 | 107-108 | `currentFrame++`; **one throw-away roll `this.rng.nextUint32()` per frame** |
| 3 | 111-128 | For each player (Map insertion order): `ensureAdjacentAreasLoaded`, `streamWildernessRoomsForPlayer` (room activation/population), dead → reveal & skip; else `stepPlayerMovement`, `revealAreaRoomsNearPlayer`, `stepPlayerVitals`, `stepUnitStates` (timer-based states) |
| 4 | 131 | `stepPlayerAnimations113c()` (anim dispatcher windup/keyframes) |
| 5 | 134-141 | Trade tick, `stepPersistentCombatStates` (StateBus tick), `stepPlayerAuras`, `stepMercenaryAuras`, `stepGrimWards113c`, `stepBladeShields113c`, `stepBladeFuryChannels113c`, `stepPartyMemberPulses` |
| 6 | 144 | `stepMissiles()` (`missiles-step.ts:924`) |
| 7 | 150-162 | Ground item expiry (iterates a copy of `groundItems`) |
| 8 | 165-184 | Scheduled Diablo spawns |
| 9 | 187-208 | Objects: shrine reset, well charge regen |
| 10 | 211 | `stepMonsterOpenWounds113c()` |
| 11 | 212-339 | For each monster (copy of `monsters` Map, insertion order): dead-path (Baal minions, death explosion, delayed drops, self-resurrect roll `this.rng.rand(100)`); despawn; `stepUnitStates`; freeze/chill counters; `stepMonsterPoison`, `stepMonsterRegen`, `applyMonsterAura`; `stepMonsterAi` (only if in active AOI); AOI move sync; `stepPendingMonsterAttack`, `stepPendingAllyAttack`, `stepPendingResurrection` |
| 12 | 342-343 | `stepMercenaries()`, `stepSummonedPets()` |
| 13 | 345-350 | Copy per-player `outbox` into the returned map (does **not** drain). |

Packet flush is **outside** `stepFrame`: adapters call `drainEvents(pid)`
(`snapshots-and-d2s.ts:18-31`) after each frame — loopback `flushEvents()` before and after each
step (`loopback-adapter.ts:465-470`, `:536-547`); room host `flushAllClientEvents()` with AOI
filtering and per-session D2GS batching (`room-host.ts:317-345`).

---

## 2. Non-determinism inventory (`src/server`, `src/common`)

Search patterns: `Date.now`, `performance.now`, `Math.random`, `new Date`, `setTimeout`,
`setInterval`, `crypto`/`getRandomValues`, `queueMicrotask`, `requestAnimationFrame`, `hrtime`,
`async/await`, plus module-level RNG singletons and unseeded fallbacks.

### 2.1 Direct wall-clock / timers

| Pattern | `src/server` | `src/common` | Notes |
|---|---|---|---|
| `Date.now` | 0 | 0 | only in `src/server/README.md:23,101` (the rule forbidding it) |
| `performance.now` | 0 | 0 | client only (`online-session.ts:1801,1813`, `main.ts`) |
| `new Date` / `hrtime` | 0 | 0 | |
| `setTimeout` / `setInterval` | 0 | 0 | `src/netproto/core/clock.ts:22,31` has an injectable `Clock` (`Date.now`, `setInterval`) used by BNCS/D2GS *client* sessions (`src/netproto/bncs/session.ts:265`, `src/netproto/d2gs/session.ts:371`), not by the server |
| `async`/`await` | 10, all in `LocalLobbyProvider` (`loopback-adapter.ts:709-993`) lobby API | — | no async inside the frame loop |

### 2.2 Entropy sources (Math.random / crypto)

| # | Site | Reached by server? | Effect |
|---|---|---|---|
| 1 | `src/common/data/mon-equip-113c.ts:170` `const rng = options.rng ?? Math.random` (used at `:180`, `:191`) | **Yes**, three paths with no rng passed: (a) Valkyrie: `src/server/ai/summon-manager.ts:714` → `calculateValkyrieStats` → `src/common/skills/amazon-passive.ts:421` `generateValkyrieEquipment(lvl)` (no rng) → `:481`; (b) Shadow Warrior/Master: `src/server/ai/summon-manager.ts:890` `generateShadowEquipment(skillId, slvl)` → `src/server/skills/assassin-shadow.ts:781-785` (`rng: opts.rng` = undefined); (c) same via `src/server/skills/skills.ts:7250` | Summon equipment rolls are truly random → state divergence. **Must fix.** (`src/server/ai/monequip-helper-113c.ts:136-144` is the correct, seeded pattern.) |
| 2 | `src/common/audio/npc-speech-113c.ts:1884` `options?.rng ?? Math.random` | No (no server importer) | client-side greeting choice only |
| 3 | `src/server/loopback-adapter.ts:621-623` `globalThis.crypto.getRandomValues` in `generateD2sMapSeed()` when no `rng` arg | Yes: `LocalLobbyProvider` constructor `:663-670` when neither `defaultMapSeed` nor `seed` is configured | Non-deterministic **map seed** for new SP games. Deterministic if `defaultMapSeed`/`seedGenerator` is supplied or `GameInstance` is constructed directly with `mapSeed`. |

Total hard entropy leaks reachable from the server frame loop: **1 function, 3 call paths**
(item 1). Plus 1 lobby-level seed source (item 3).

### 2.3 Hidden shared / constant-seeded RNG state

| Site | Kind | Risk |
|---|---|---|
| `src/server/loopback-adapter.ts:606` `const defaultMapSeedRng = new D2Rng(0x6fd5f2a9)` | module singleton | process-global state; seeds depend on how many games were created earlier in the process |
| `src/common/skills/formulas.ts:45-46` `fallbackFormulaRng` (default `randomFn` of `calculateAttack` & co., `:188,444,743,870,944,1155,1334`) | module singleton | server only imports XP tables from this file (`constants-and-helpers.ts:9`, `game-engine.ts:19`), so not reached by `GameInstance` today |
| `src/server/skills/registry.ts:111-143` `fallbackSkillRngByCtx` (WeakMap → `new D2Rng(1)` per ctx) | per-call fallback | deterministic but not the game stream; used when a skill ctx carries neither `ctx.rng` nor `caster.rng` |
| `src/server/engine/missile-engine.ts:1171` `private readonly rng = new D2Rng(0x4d534c45)` | per-`MissileEngine` instance, constant seed | deterministic, independent of game seed; `m.doFuncRng` per missile seeded from `0`, `floor(m.x)`, `hashString32(caster.id)` (`:1842`, `:2307`, `:2371`), `:5430` `new D2Rng(0,666)` per call |
| `src/server/engine/aura-scanner.ts:130` default seed `0x13579bdf`; instantiated per pulse with `mapSeed ^ unitId ^ 0x9e3779b9` (`player-auras-and-states.ts:1054`) | per-instance | deterministic |
| `src/server/engine/game-instance/monster-damage.ts:1047` `new D2Rng(0)` | per-call constant | deterministic |
| `src/common/items/item-ratio.ts:352` `context.rng ?? new D2Rng()` | **degenerate**: `new D2Rng()` is lo=0, hi=0, a fixed point of the LCG → always returns 0 | deterministic but wrong if hit |
| `src/common/data/calc-ast.ts:895-898` `rand(a,b)` in `Skills.txt` calc → `ctx.randFn ?? trunc((a+b)/2)` | midpoint fallback | deterministic; the missile engine passes a game-rng `randFn` (`missile-engine.ts:1709`) |

### 2.4 Iteration-order / timing dependence

All engine containers are `Map`/`Set` (`state.ts:70-120` etc.), iterated in insertion order —
deterministic **given the same sequence of inserts**. The timing-dependent inputs are:

* **`commandQueue` order and frame assignment** — commands are enqueued on arrival
  (`world-spawning-and-aoi.ts:1630`) and consumed at the next `stepFrame`; which frame a command
  lands in depends on the wall-clock accumulator (§1.2) and, in the room host, on socket arrival
  interleaving between clients.
* **`players` Map order** = connect order (`area-and-session.ts:984`), drives per-player step
  order and therefore RNG consumption order.
* `monsters`, `missiles`, `groundItems`, `objects` orders follow spawn order, which is
  deterministic once the above two are fixed.
* `outbox` per player; room-host flush iterates `sessionsByPlayerId` (`room-host.ts:322`).
* Paused frames still run object spawn/transition steps and command processing (§1.4 rows 0–1b)
  without advancing `currentFrame`.

### 2.5 Floating point

~713 `Math.sin/cos/atan2/sqrt/pow/exp/log/hypot` uses in `src/server`; positions are doubles
(state hash rounds `x*100`, `snapshots-and-d2s.ts:783-835`). Deterministic run-to-run on one JS
engine, but not bit-identical to 1.13c's fixed-point math — relevant to oracle diffing, not to
replica determinism.

---

## 3. RNG

### 3.1 Implementations

`src/common/rng/d2-rng.ts` contains two APIs over the **same recurrence**
`state64 = lo * 0x6AC690C5 + hi; lo' = low32; hi' = high32; value = lo'`
(64-bit multiply-with-carry, `D2_PRNG_MULTIPLIER` at `:20`):

1. **`class D2Rng`** (`:31-218`, aliases `UnitSeed`/`Rng` at `:233-235`) — BigInt `step()` (`:100-105`).
   * `rand(max)` (`:121-130`) = `SEED_RollLimitedRandomNumber` semantics (`max<=0 → 0` no roll;
     power of 2 → `lo & (max-1)`; else `lo % max`).
   * `randRange(min,max)` (`:144-151`), `nextUint32()` (`:164-167`).
   * Float helpers **not in D2**: `next()` = `nextUint32()/2^32` (`:171`), `range()` (`:191`),
     `chance()` (`:205`), `int()`, `pick()`, `fork(label)` (FNV-1a + golden-ratio mix, `:215-217`).
   * Constructor (`:41-49`): `new D2Rng(n)` with `n != 0` and no `hi` → **hi = 0** (unlike
     `SEED_InitLowSeed`, which sets hi = 666); `new D2Rng(0)` → hi = 666; `new D2Rng()` → lo = hi = 0
     (degenerate).
2. **D2SeedStrc functions** (`:237-373`) — D2MOO-faithful, exact 64-bit math with 16-bit limbs,
   global trace sink (`setD2SeedTraceSink`, `:265-267`):
   `SEED_InitSeed` (lo 1, hi 666), `SEED_InitLowSeed` (hi 666), `SEED_SetSeeds`,
   `SEED_RollRandomNumber`, `SEED_RollRandomNumberMod64`, `SEED_RollLimitedRandomNumber`,
   `SEED_RollPercentage` (mod over full 64-bit state), `D2SEED_AdvanceInline` (untraced).

Both match D2's multiply-with-carry. The D2SeedStrc API is used by the DRLG port
(`src/common/drlg/drlg-drlg.ts:62,109,180,250`, `drlg-room.ts:59`, `drlg-roomtile.ts:1497`,
`drlg-maze.ts`, `drlg-outdoors.ts`, `drlg-act-links.ts`) and much of the client; the server uses
`D2Rng`.

Other PRNGs / inline LCG copies:

* `src/common/rng/splitmix64.ts:23` `SplitMix64Rng extends D2Rng` — SplitMix64 mixes the seed into
  the initial `lo/hi`, then behaves as D2Rng; `nextUint64()` is a true SplitMix stream. Used for
  tile variant hashing (`src/common/rng/variants.ts`), not server combat.
* Inline 0x6AC690C5 steps (same recurrence): `src/common/path/path-compute.ts:1155,2370`
  (pathing / missile seed), `src/common/drlg/light-grid.ts:1182`, `src/common/units/monsters-data.ts:5171`,
  `src/common/units/hireling-table.ts:8476,8486,8619`.
* Hash-style seed derivations (not PRNGs): `Math.imul(x, 0x9e3779b9)` mixes in
  `src/server/ai/monster-ai.ts:430,468,541`, `src/server/engine/state-hash.ts:882,992`,
  `npc-vendors-and-artisans.ts:931,1286,1321`, `area-bootstrap.ts:411`, `pandemonium-113c.ts:199`,
  `src/common/units/monster-rooms.ts:564,637`, `monsters-data.ts:2755,2858`.

### 3.2 Who holds seeds in the server

| Entity | Seed | Where |
|---|---|---|
| Game | `currentMapSeed = (config.mapSeed ?? config.seed ?? 0x12345678) || 1`; `rng = new D2Rng(currentMapSeed)` (hi = 0) | `state.ts:604-607` |
| Game (re-seed) | on `connectPlayer` with a `.d2s` whose header `mapSeed != 0`, if map-seed persistence allowed and no explicit seed: `currentMapSeed = d2s.mapSeed; rng = new D2Rng(...)` | `area-and-session.ts:991-1003` |
| Cairn stone order | `new D2Rng((mapSeed ^ 0x6a09e667) || 1)` Fisher–Yates | `state.ts:608-618` |
| Items | per-drop `dwInitSeed`, usually `this.rng.rand(0x7fffffff) || 1` → `new D2Rng(seed)`; `monsterRng: new D2Rng(this.rng.rand(0x7fffffff)||1)` | `item-stats-and-drops.ts:1023,1883,1922,2044,2094,2127,2152`; `object-drops-113c.ts:125,176,207,260,330,376,407,560`; `npc-vendors-and-artisans.ts:140,249,810,2874`; `player-death-and-shrines.ts:224,1183` |
| Monsters | **no per-unit RNG**. Only `statSeed` (HP roll) and `nameSeed` (`types.ts:155-158,677-678`), equipment seed `(statSeed ?? unitId) ^ (hcIdx*0x9e37)` (`world-spawning-and-aoi.ts:305`) | |
| Missiles | `MissileEngine` instance rng + optional `m.doFuncRng` | `missile-engine.ts:1171,1842,2307,2371` |
| Rooms / DRLG | not owned by the server: geometry comes from an injected `AreaLevelSource` / `resolveAreaBootstrap` (`area-bootstrap.ts:490-500`, `loopback-adapter.ts:376-378,986`); room seeds arrive in `level.roomRects[].seed`; room population uses `new Rng((room.seed ^ levelId*0x01000193))` (`src/server/ai/room-streamer.ts:288,348`) | |
| Vendors | `mapSeed ^ imul(unitId,0x9e3779b9) ^ imul(act,0x85ebca6b)` | `npc-vendors-and-artisans.ts:1286,1321` |

**Single game-wide stream:** essentially all combat/AI/drop randomness draws from one
`GameInstance.rng` — 233 `this.rng` references in `src/server` (148 `rand`, 9 `range`, 1
`nextUint32`, 1 `getSeed`, rest passed as objects, e.g. `executeSUnitDmg(..., this.rng)`);
heaviest users: `monster-combat-ai.ts` (30), `monster-damage.ts` (22),
`player-death-and-shrines.ts` (20), `player-skills-aoe-and-corpse.ts` (15), `missile-engine.ts`
(14), `mercenaries.ts` (14), `boss-encounters-ai.ts` (14), `summon-manager.ts` (12).
This is deterministic, but **structurally unlike 1.13c**, where each unit owns its own
`D2SeedStrc` and the game seed only seeds them. Consequences for oracle diffing: any extra or
missing roll anywhere shifts every later roll for every unit; plus the extra per-frame
`nextUint32()` (`frame-and-commands.ts:108`) has no D2 counterpart. `mercenaries.ts:480,727-770,896,910,1559`
use float `range()` (not a D2 roll shape).

---

## 4. Capture / replay infrastructure

### 4.1 `.d2cap` format (reader + writer)

`src/netproto/core/packet-tap.ts`:

* JSONL. Line 1 header `D2CapHeader` (`:28-35`): `{format:'d2cap-v1', createdAt, server, account?, character?, scenario?}`.
* Records `D2CapRecord` (`:37-45`): `{t: ms epoch, conn: 'bnet'|'realm'|'game'|'ts', dir: 'c2s'|'s2c', hex, packetId?, packetName?, stream?}`.
* Writer: `PacketTap` interface (`:24`), `InMemoryPacketTap` (`:89-117`, ring buffer 10 000) →
  `toD2CapJsonl(header)`; `formatD2CapEntry` (`:75-87`).
* Reader: `parseD2CapJsonl` (`:119-158`) — accepts aliases (`channel`, `ts`, `d2gs`, `mcp`), skips `#` lines.
* **No game seed, no frame/tick index, no server-side state** in the schema. Only wall-clock `t`.

### 4.2 Consumers

* `tools/netproto-replay.ts` (427 lines) — offline decoder/coverage verifier: frames BNCS/MCP/D2GS,
  decodes every S2C into `ServerEvent`, validates C2S sizes, feeds a `ClientWorld`, `--strict`
  reports unknown/opaque packets. Client-side only; does not drive `GameInstance`.
* `src/client/session/session-d2cap-replay.ts` + `OnlineSession.loadD2CapReplay/stepD2CapReplay`
  (`online-session.ts:1835-1851`) — client replays S2C into the UI.
* Tests (client/netproto decode): `tests/client/vendor-stash-ui.test.ts`, `hud-session-play.test.ts`,
  `vendor-stash-replay.test.ts`, `client-world.test.ts`, `tests/netproto/d2gs-codecs-items.test.ts`,
  etc.; `tests/server/p0-net-wave1-1777-1783.test.ts:111` and `p1-net-c2s-s2c-wave3.test.ts:1588`
  build synthetic d2cap snippets to round-trip encoder output through the framer.
* **No existing path replays captured C2S into the TS server and compares S2C.**

### 4.3 Fixtures (`tests/fixtures/netproto/*.d2cap`)

All captured by `tools/d2-bot.ts` against a real 1.13c D2GS (header `server: "127.0.0.1 (via=mixed)"`).
Game S2C stored as already-decompressed logical packets (`stream` never set). Every file has the
same 6+6 BNCS and 6+5 MCP records.

| File | scenario | game s2c | game c2s | duration |
|---|---|---|---|---|
| 01-bncs-mcp-lobby | join | 151 | 5 | 7.2 s |
| 02-d2gs-town-walk-chat | town | 179 | 11 | 9.1 s |
| 03-d2gs-items-npc-skills | full | 202 | 22 | 14.1 s |
| 04-d2gs-idle-60s | idle | 271 | 16 | 62.7 s |
| 05-d2gs-vendor-open | vendor-open | 217 | 25 | 14.5 s |
| 06-d2gs-vendor-buy-sell | vendor-buy-sell | 276 | 36 | 20.6 s |
| 07-d2gs-vendor-repair | vendor-repair | 240 | 30 | 18.8 s |
| 08-d2gs-stash-gold | stash-gold | 174 | 14 | 13.6 s |
| 09-d2gs-gamble | gamble | 193 | 31 | 17.7 s |
| 10-d2gs-spawn-seed-{0c44f15e,4f05dacb,52e4e6ff,72a1c4f0,7e5d403f} | join | 142–167 | 4 | 4.6–5.8 s |
| 11-d2gs-vendor-sell-cursor | vendor-sell-cursor | 324 | 61 | 49.2 s |
| 11-d2gs-waypoint-teleport | waypoint-teleport | 338 | 27 | 18.8 s |

C2S opcodes present across all fixtures: `01 03 04 0f 13 14 15 18 19 2f 30 32 33 35 38 3c 49 4f 60 68 69 6b 6d`
(walk/run, pickup/drop, NPC interact/trade/buy/sell/repair/gamble, stash gold, waypoint, ping `6d`).
54 distinct S2C opcodes (top: `51` 335, `6d` 320, `1d` 291, `9c` 276, `0e` 227, `8a` 226, `07` 198,
`aa` 168, `ac` 152). **No combat** (no `0c`/`05`/`06`-family skill casts against monsters), no
multi-player, no .d2s attached; the seed in the `10-*` file names is the only seed metadata.

### 4.4 `tools/d2-bot.ts`

Headless online client (1651 lines): commands `register | login | chars | create-char | games |
create-game | join | idle | record | walk | audit-levels` (`:5-6`); transports `--via=mixed|wss|tcp`
(defaults to a remote BNCS host / WS bridge, overridable with `--host`, `--ws-host`,
`D2_BNET_HOST`); `--capture=<out.d2cap>` writes via `InMemoryPacketTap`; scripted scenarios
`town|combat|items|npc|chat|full` (`:204-300`) and vendor scenarios
(`tools/lib/vendor-scenarios.ts`); uses `ClientWorld`, a Node `MapService`
(`tools/lib/node-map-loader.ts`) and client pathfinding for walking; can unlock `.d2s` files
(`tools/d2s-unlock.ts`). Account passwords use `node:crypto randomBytes` (`:105-119`). It talks
only to an external D2GS — it cannot target the TS server (no listener exists).

### 4.5 Related prior art: DRLG oracle diff

`tools/drlg-diff.ts` + `tools/lib/drlg-oracle.ts` diff the TS DRLG port against a native D2MOO
oracle binary stage by stage, with full RNG trace comparison via `setD2SeedTraceSink`
(`d2-rng.ts:249-267`, trace writer `src/common/drlg/drlg-dump.ts:401`). Golden outputs live in
`tests/fixtures/d2moo/*.json` and `tests/fixtures/d2moo-oracle/act1-seed-*.json.gz`. The oracle
source directory `tools/d2moo-oracle/` is referenced but **not tracked** in this repo;
`tools/oracle/setup-wine.sh` (present in the worktree but currently untracked) sets up a rootless
Wine + i686 mingw toolchain for running the original 1.13c binaries.

---

## 5. `.d2s` loading in the server

Yes — a 1.13c `.d2s` can be loaded directly into a player:

* Reader: `readD2sSave113c(buf, tables)` — `src/server/save/d2s-reader.ts:436` (aliases `readD2s`,
  `readD2sSave` at `:704-705`). Requires magic `0xaa55aa55`, `version === D2S_VERSION` (96),
  matching file size and checksum (`:440-460`). Decodes header, attributes, skills, items,
  corpse items, merc + merc items, iron golem, quests, waypoints, NPC intro, hotkeys, map seed.
* Entry point: `GameInstance.connectPlayer({ d2s | d2sBytes, restoreMercenary, ... })` —
  `src/server/engine/game-instance/area-and-session.ts:984`. Uses the parsed save for: map
  seed override (`:996-1002`), name, status flags/hardcore/dead (`:1018-1027`), class, level,
  act town (`:1030-1041`), attributes & stat/skill points (`:1057-1069`), max HP/mana/stamina
  fixed-point (`:1093-1100`), skills (`:1151`), items (`:1171`), corpse items (`:1209`),
  iron golem (`:1214`), waypoints & quests for current difficulty (`:1220`, `:1236`),
  skill bindings/hotkeys/weapon set (`:1295-1301`), NPC intro, timestamps (constant fallback
  `1_700_000_000` if absent, `:1307`), and mercenary restore (`:1499-1530`).
* Adapter path: `new LocalLoopbackAdapter({ d2s })` (`loopback-adapter.ts:384-395`) and
  `LocalLobbyProvider.enterGame/enterSinglePlayerGame` (`:899`, `:993`). Writer:
  `writeD2sSave113c` (`src/server/save/d2s-writer.ts`), export via `exportPlayerD2s`.

---

## 6. Combat / stat / state code map

### 6.1 Stat lists

* `UnitStatList` — `src/server/engine/stat-list.ts:496`. Layers: `baseStats` Map, skill level maps
  (base/bonus/charged/elem), `allSkills/classSkills` bonuses, `modifiers: SkillStatModifier[]`
  (state/aura-sourced, with expiry), parent/child attachment (`attachStatList` `:559`).
  Key methods: `setBaseStat :597`, `addStat :610`, `getBaseStat :622`, `getEffectiveSkillLevel :720`,
  `getModifierBonus :854`, `getAccruedStat :1103`, `getDefense :1224`, `getEffectiveMaxResistance :1289`,
  `addOrUpdateModifier :1307`, `removeModifiersByState :1332`, `expireAtFrame :1365`, `getHp/getMaxHp/getMana :1380-1404`.
  Fixed point `FIXED_ONE = 256` (`:223-224`), by-time stats `encodeByTimeStat113c`/`evaluateByTime113c` (`:187-199`).
* Player layering: `playerCombatContext` (`src/server/engine/game-instance/player-auras-and-states.ts:37`)
  lazily creates `statList` (owner) + attached `itemStatList` (owner `'item'`) + `StateBus`,
  stored in `playerCombat` Map, then **re-populates base stats from the plain player record and
  `sumPlayerItemStat` on every call** (`:65-100+`). Monsters: `monsterCombatContext :233`;
  mercs: `mercCombatContext :277`. Pool helpers `getPlayerAccruedMax*Fixed :163-181`,
  `refreshPlayerAccruedMaxPools :190`.
* The plain records (`InternalPlayerRecord` etc., `src/server/engine/game-instance/types.ts`) also
  hold authoritative scalars (`strength`, `hpFixed`, `maxHpFixed`, …) — i.e. stats live in two places.

### 6.2 States / buffs with durations — two parallel systems

1. **Set + countdown timers** on each record: `states: Set<number>`, `stateTimers: Map<number, number>`
   (`types.ts:572-573, 900-901, 1029-1030`). Decremented in `stepUnitStates`
   (`player-death-and-shrines.ts:1043`), which on expiry also removes from the StateBus and
   broadcasts `UnitState active:false`.
2. **`StateBus`** — `src/server/engine/state-bus.ts:158`: `applyState :182`, `removeState :615`,
   `tick(currentFrame) :665` (frame-based expiry), `hasState :687`,
   `reduceCurseAndPoisonDurations :764`, `triggerReactiveEvents :800`; applies stat modifiers to
   its `UnitStatList`. Ticked in `stepPersistentCombatStates` (`player-auras-and-states.ts:478`)
   which also reconciles aura states against the Set (`:488-500`); `mirrorPersistentStates :353`,
   `evaluateSkillStateStats :374`.
* Auras: `AuraScanner` (`src/server/engine/aura-scanner.ts:130`), `stepPlayerAuras :1236`,
  item auras `syncPlayerItemAuras113c :1004`, `pulsePlayerItemAuraRuntime113c :1084`.

### 6.3 Damage application

* Core: `executeSUnitDmg` — `src/server/engine/combat-pipeline.ts:1502-1520` (requires a `CombatRng`,
  throws otherwise), `executeNormalAttack :3707`. Helpers: `rollDamageRange256 :64`,
  `computeEffectiveResistance :326`, `computeToHitChance :402`, `computeBlockRate113c :526`,
  `evaluateAvoidanceAndBlock :545`, `computeLifeManaSteal113c :1225`, `shouldEnterGetHit113c :1385`,
  `calculateOpenWounds113c :1032`, `calculateCrushingBlow113c :3903`, knockback `:3951-3982`.
* Monster side: `applyDamageToMonster` (`game-instance/monster-damage.ts:31`), `finishMonsterDamage :1226`,
  `applyMonsterDeath :1452`, `attackMonsterTarget :2072`, hit recovery `:1804-2009`, poison
  `applyMonsterPoisonDot :966`.
* Player side: `applyDamageToPlayer` (`game-instance/player-death-and-shrines.ts:37`);
  monster melee `resolveMonsterAttackOnPlayer` (`monster-melee-attacks.ts:569`),
  `stepPendingMonsterAttack :237`; monster missiles `applyMonsterMissileToDefender`
  (`missiles-step.ts:27`).
* Missiles: `stepMissiles` (`missiles-step.ts:924`) + `MissileEngine`
  (`src/server/engine/missile-engine.ts`, 9 137 lines; calls `executeSUnitDmg` at `:1891`, `:2286`).
* Player attacks/skills: `executeSkillOnTarget` (`player-skills-target-and-melee.ts:796`),
  `executeSkillAtLocation :600`, `executeStandardSkillMeleeHit113c :1788`; damage rolls
  `rollPlayerSkillPhysDamage/rollPlayerSkillDamage` (`player-combat-and-vitals.ts:349,421`),
  `resolvePlayerWeaponDamage :127`, `commitPlayerSkillCast :282`, `launchPlayerSkillMissile :489`;
  effects `applyPlayerSkillEffect` (`player-skills-aoe-and-corpse.ts:38`).
* Mercs: `mercenaries.ts` (float `rng.range` damage, see §3.2).

### 6.4 Skill calc evaluation

* `evaluateCalc(expr, ctx)` — `src/common/data/calc-ast.ts:694` (Skills.txt `calc1..4`, `clc`,
  `ln/dm/par`, `rand(a,b)` with injectable `randFn`, midpoint fallback `:895-898`), band helpers
  `compute5BandScaling :53`, `compute3BandDuration :94`, `computeSkillManaCost256 :208`.
* `evaluateSkill113c` — `src/server/skills/registry.ts:298`; `executeSkill113c :589`; skill RNG
  resolution `resolveSkillRng :114-143`. Per-skill modules under `src/server/skills/impl/**`
  plus large legacy `src/server/skills/skills.ts` (`castSkill :656-671`).
* CTC procs: `aggregateCtcProcs113c`/`rollCtcProcs113c` (`src/server/skills/passives-procs-113c.ts`,
  imported at `frame-and-commands.ts:17`).

---

## 7. Blockers for determinism & minimal change list

### 7.1 Blockers

1. **`Math.random` reachable from summons** (`mon-equip-113c.ts:170` via Valkyrie / Shadow
   Warrior / Shadow Master — §2.2 #1).
2. **Wall-clock frame assignment**: `tick(dtMs)` accumulators (`loopback-adapter.ts:485`,
   `room-host.ts:298`) decide how many frames run and therefore which frame a queued command is
   processed in. Commands carry no frame number.
3. **Unseeded lobby map seed** via `crypto.getRandomValues` (`loopback-adapter.ts:621`) and the
   process-global `defaultMapSeedRng` (`:606`).
4. **`.d2s` silently re-seeds the game** (`area-and-session.ts:996-1002`) unless an explicit seed is
   given — a replica must always pass `mapSeed`.
5. **Level geometry is external**: without an injected `resolveAreaBootstrap`/level source the
   server uses a test grid; a replica must use the same DRLG source (e.g. the Node `MapService`
   from `tools/lib/node-map-loader.ts`) to get identical rooms/population.
6. Paused frames still execute command processing/object timers without advancing the frame (§1.4).
7. `.d2cap` lacks seed, frame index and initial character state; existing fixtures contain no combat.

Not blockers for *replica* determinism but blockers for *1.13c oracle* parity: single game-wide RNG
stream instead of per-unit seeds; extra per-frame roll (`frame-and-commands.ts:108`);
`new D2Rng(n)` → hi = 0 vs D2's hi = 666; float `next()/range()` rolls; double-precision positions.

### 7.2 Recommended minimal change list (headless deterministic replica runner)

1. **Fixed step only.** The runner calls `GameInstance.stepFrame()` directly (or
   `adapter.stepFrame()`/`roomHost.stepFrame()`); never `tick(dtMs)`. No code change needed.
2. **Frame-stamped input log.** Record `{frame, playerUnitId, ClientCommand | raw C2S hex}` at
   `enqueueCommand` time (hook in `world-spawning-and-aoi.ts:1628` or wrap the adapter's `send`),
   and replay by enqueuing exactly before stepping frame `frame`. Extend `D2CapRecord` with an
   optional `frame` field and the header with `mapSeed`, `difficulty`, `expansion`, and the
   player's initial `.d2s` (base64) so captures are self-contained.
3. **Inject RNG everywhere it is optional**: pass a game-derived rng into
   `generateValkyrieEquipment` (`amazon-passive.ts:421`) and `generateShadowEquipment`
   (`summon-manager.ts:890`, `skills.ts:7250`), e.g. `() => this.rng.int(0, 0xffff) / 0x10000`
   as `monequip-helper-113c.ts:144` does; then change the `?? Math.random` fallbacks in
   `mon-equip-113c.ts:170` and `npc-speech-113c.ts:1884` to throw (fail fast).
4. **Injectable map seed**: runner always passes `mapSeed` to `GameInstance` (or
   `defaultMapSeed`/`seedGenerator` to `LocalLobbyProvider`); optionally make
   `generateD2sMapSeed()` require an rng and remove the `crypto` branch.
5. **Injectable clock** is only needed at adapter level: add an optional `clock` (frame source)
   to `LocalLoopbackAdapter`/`MultiClientRoomHost`, or simply have the runner own the frame loop.
   The engine already has no clock reads.
6. **Pin the level source**: runner constructs `createAreaBootstrapResolver(nodeLevelSource)` with the
   same DRLG data, and passes it via `resolveAreaBootstrap`.
7. **Determinism gate**: run each scenario twice (and across two processes) and compare
   `computeFrameLockstepHash()` (`snapshots-and-d2s.ts:759`) per frame plus the drained
   `ServerEvent` streams; extend the hash with states/StateBus entries and per-player item
   digests, which it currently omits.
8. **Optional (oracle parity, later):** move to per-unit `D2SeedStrc` seeds seeded from the game
   seed, drop the per-frame throw-away roll, and route rolls through the traced `SEED_*` API so the
   existing `setD2SeedTraceSink` mechanism (as used by `tools/drlg-diff.ts`) can diff RNG
   consumption against the native oracle.
