# Diablo II 1.13c Sound Tables and the Sound-Record Layer (`D2Client.dll` / `D2sound.dll` / `D2Common.dll`)

Reverse-engineering notes behind Gitea #943 (M21-P1): the generated tables `src/common/audio/sounds-113c.ts` /
`sound-environ-113c.ts` (baked by `src/baker/packers/pack-sound-tables.ts`), the product record layer
`src/client/audio/sound-records-113c.ts` and the `tables` section of `npm run verify:audio`
(`src/baker/audit/verify-audio-113c.ts`). Every address below was read from the raw 1.13c DLLs with `objdump`.

## 1. Tables (load post-processing)

- `Sounds.txt` (4,699 rows, ids 0..4698), `SoundEnviron.txt` (50 rows) and `Levels.txt` `SoundEnv` (136 levels) all
  resolve from `Patch_D2.mpq` (the overlay winner of `d2data → d2char → d2exp → Patch_D2`).
- Load loop `0x6fb0e8e1–0x6fb0e952` runs over ids 1..count−1 (row 0 is the `""` / `none.wav` sentinel):
  - `groupBase` is assigned **before** the row's own `Group Size` is read (`0x6fb0e900–0x6fb0e914`, then
    `0x6fb0e91d`): a leader nested inside the previous group keeps that group's leader as `groupBase` but leads its
    own group (rows 134→133, 138→134, 991→986, 1139→1136, 1201→1198, 1288→1284, 2065→2061).
  - `Group Size` 0 → 1 (`0x6fb0e91d–0x6fb0e924`); `nBlocks` = number of leading `Block 1..3` ≠ −1
    (`0x6fb0e927–0x6fb0e946`). Histogram over ids 1..4698: 4,608 / 86 / 4 / 0.
- musicRange `0x6fb0e954–0x6fb0e990` = [min, max] of `SoundEnviron.Song > 0` = 4657..4684.
- BuildSoundPath `0x6fb0db30`: `DATA\LOCAL` for ids `0xb76..0x1230` (2934..4656, the localized speech), else
  `DATA\GLOBAL`; `\MUSIC\` for `0x1231..0x125a`, else `\SFX\`; `strlen(path) < 0x50` is asserted (`0x6fb0dc1e`).
- Data facts (ids 1..4698): 590 rows use Compound (49 negative); 1,765 Stream; 44 Stereo (all Stream = 1);
  4,208 Tracking; 356 Async Only; 1,273 Solo; 187 Loop; 86 `nBlocks == 1` (70 non-streamed loops, e.g. 423
  `monster_chargedbolt_1`, Block 1 = 14427); 69 Volume 0; Falloff always 0..4; the 1,723 speech rows are all
  Defer Inst xor Stop Inst; 157 rows (incl. row 0) are `none.wav`, 107 of them with Volume > 0.

## 2. PlaySound `0x6fb38a70` (`id, unit, delay, a2, a3`) and the record pool

- Returns 0 for `id ≤ 0` (`0x6fb38a81`), Volume 0 (`0x6fb38ab7`) or a full pool. A `none.wav` row with Volume > 0
  **does** get a record; its start fails later (§4).
- Compound `0x6fb38ac8 → 0x6fb37fe0`: reuse the FIRST active record (list order, any state) of the same `groupBase`
  with `stop == 0` and `Compound < 0` or `(u32)(now − start) ≤ Compound`; the unit is then attached (`0x6fb38b6a`).
- AllocRec `0x6fb37d80`: first free record of `0x6fbbf2f8..0x6fbc3880` (stride `0x59`, 200 records), prepended to the
  active list `[0x6fbcbf30]` (D2sound #10034 prepends). Fields: `+0x1c vol = 255` (`0x6fb38b17`), `+0x24 a3`,
  `+0x34 start = now + delay`, `+0x38 a2`, `+0x3c priority` (byte).
- Position: no unit → SetPos(0, 0, 320) (`0x6fb38b47–0x6fb38b65`); a unit → `0x6fb37f30` (§3).
- Local player (`unit == [0x6fbcbbfc]`, `0x6fb38b6a`): `add byte ptr [esi+0x3c], 0x50` (`0x6fb38b72`) — a byte add
  that wraps (255 → 79) and is applied again on every Compound reuse. The unit is then prepended to the record's unit
  list (#10034 at `0x6f9b8710`, no de-duplication).
- MonSounds weapon volumes are applied by the caller with SetVolume `0x6fb37ed0` after PlaySound (`0x6fad446c`); the
  port therefore has no "volume override" option. GetVolume `0x6fb37f00` returns 0 for an unknown handle.
- SetSoundPos `0x6fb38ba0`: integer arguments (`fild`), `pos = (x, y, z + 640.0f)` on ANY record (no unit check, no
  channel update); handle 0 is ignored (`0x6fb38ba3`). SetPos `0x6fb38350` stores f32 and dist² with x / y clamped to
  ±2000 (`0x6fb87574` / `0x6fb87548`).

## 3. Unit positions `0x6fb37f30` (relative to the local player)

- `pos = (Δcx, 2·Δcy, 640.0f)` from D2Common #10628 (`0x6fd7ffe0`) client coordinates:
  dynamic paths `X32 = precise >> 11 = ⌊subtile·32⌋`, `cx = (X32 − Y32) >> 1`, `cy = (X32 + Y32) >> 2`
  (`0x6fd5da71–0x6fd5da93`); static paths store `16·(x − y)` / `8·(x + y)` (`0x6fd7ff0e–0x6fd7ff22`).
  One sub-tile east is therefore `(16, 16, 640)`, not 32 px.
- Sound `0xa27` (2599 `object_river`) projects the listener onto the river (`0x6fb37f54–0x6fb37fa2`, x87, f32
  constants `0x6fb8756c` = −2.0, `0x6fb87568` = 0.5, `0x6fb87564` = −0.4, `_ftol` truncation):
  `t = (pcx·−2 − ucx·0.5 + pcy − ucy)·−0.4`, `ucx' = trunc(t)`, `ucy' = trunc(pcx·−2 − t·−2 + pcy)`.
  (`0x6fb8757c` ≈ 9.54e−7 is unrelated; it is not a 32.0 scale.)
- `0x6fb381b0` is a separate "unit within hearing range" helper (Δ² ≤ 490,000 = 700²) — relevant for #948.

## 4. SoundUpdate `0x6fb38dd0` (once per SoundTick, 25 Hz)

Order of one update:

1. Bubble sort of the active list `0x6fb38e00–0x6fb38e6c`: priority desc, dist² asc, start desc (u32), record
   address desc.
2. Stop pass `0x6fb38e6e–0x6fb38ead`: `stop && (!fading || ft ≠ 0)` → pending records become state 2, playing ones
   are stopped (StopChannel `0x6fb380e0`).
3. `canPlay = master > 0` (`0x6fb38eaf–0x6fb38ebd`).
4. Per record:
   - state 2 (`0x6fb38f28–0x6fb38f6a`): a loop with Duration 0 and `stop == 0` goes back to pending (an unfinished
     fade jumps to its target); anything else goes to the local free list.
   - Tracking `0x6fb38f6f–0x6fb39066`: the closest attached unit (strict <, list order). In 1.13c this block only runs
     once `[0x6fbcc3a0]` is set by the 0x04 LoadDone handler `0x6fb5dfe0` — not modelled by the port (it always runs).
   - Fade `0x6fb390cb–0x6fb3910e` (u32 compares; `+0x45 fading`, `+0x49 from`, `+0x4d target`, `+0x51 start`,
     `+0x55 end`): past the end → vol = target, fading cleared.
   - maxDist per Falloff, jump table `0x6fb39590`: 400 / 700 / 1000 / 1500 / 2000 (other → 700).
   - Pending start `0x6fb3917a–0x6fb391ac`: state 0, `now ≥ start` (u32), **vol ≠ 0** (`0x6fb39189`), `canPlay`,
     `dist² ≤ maxDist²` — otherwise the drop path.
   - Defer / Stop Inst `0x6fb391bd–0x6fb392ac`: FindGroupConflict `0x6fb37c30` (same groupBase, playing, earliest
     start, unit-filtered by #10053) when either flag is set; FindSpeechConflict `0x6fb37bd0` (ids 2934..4656,
     `0x6fb39236`) whenever the record has exactly ONE unit, whatever the flags. A Defer row without units at a
     non-zero position skips the check (`0x6fb3924c–0x6fb3925c`). On a conflict, Stop Inst flags ONE conflicting record
     stop and frees it (after the pass; its channel is still busy during this start), otherwise the NEW record is
     flagged stop and freed (`0x6fb3929e–0x6fb392ac`) — a Defer request is dropped, never deferred.
   - Restart setup `0x6fb39279–0x6fb392c9`: a saved position (`+0x41`) moves to `+0x24` and fades in over 3 ticks,
     else the row's Fade In (unless fading or `a2 & 2`). The volume is zeroed **before** StartSound
     (`0x6fb392c6–0x6fb392c9`) and the fade is only armed on success: a looped record whose fade-in start fails keeps
     vol 0 and is never started again (pending check `vol ≠ 0`) until StopSound frees it.
   - Drop path `0x6fb3932a–0x6fb3934e`: a record that did not start is freed unless it holds a channel, is a loop, or
     is Async Only while its sample is still loading (row `+0x86 == 1`).
   - Playing `0x6fb39359–0x6fb393f7`: Duration exceeded, `!canPlay` or `dist² > maxDist²` → StopChannel, else
     UpdateChannel `0x6fb0d1d0`.
5. Free list `0x6fb3940f–0x6fb3943e`: off the active list, units released (`0x6fb38150`), StopChannel, freed.
6. Ducks `0x6fb39449–0x6fb3957e`, only when `now > [0x6fbcbf3c]`: pause duck `[0x6fb91374]` ∓5 (0..100), solo duck
   `[0x6fb91378]` −2 to 70 while a Solo row is active, else +2 to 100. The solo scan (`0x6fb394c0–0x6fb394fa`) counts
   `Solo && (!fading || target ≠ 0)`: the update in which a fade-out ends clears `fading` before the scan while the
   record is only stopped and freed by the next update's stop pass, so a fading-out Solo row ducks once more.

Fn_6fb0d080 runs right after SoundUpdate (one-shot channels whose buffer ended → stopped, state 2, freed by the next
update), then the clock `[0x6fbcc268]` increments.

## 5. StartSound `0x6fb0d7a0`

1. Variant pick (skipped for `a2 & 1`, `0x6fb0d7d1`), stored in the record at once (`0x6fb0d7dd`).
2. Same-id debounce `0x6fb0d7e4–0x6fb0d808`: FindChannel `0x6fb0cc10` returns the earliest-start record of that id on a
   channel whose buffer is playing (#10044); the start fails iff `other.stop == 0 && (u32)(rec.start − other.start) < 2
   && other.priority ≥ rec.priority` — the SCHEDULED start ticks are compared, not `now`.
3. Recent picks of the REQUESTED row updated (`0x6fb0d82e–0x6fb0d837`), before the sample check.
4. Sample: `none.wav` → LoadSound `0x6fb0ebc0` fails → row `+0x81 = 1` → start fails (`0x6fb0d867`).
5. Channel flags = `Stereo ? 1 : 0` (`0x6fb0d87c–0x6fb0d8a7`) → AllocChannel `0x6fb0ce70` (§6).
6. A non-streamed buffer always starts at position 0 (#10005 / #10069); a stream opens at `+0x24` (#10039,
   `0x6fb0d97c`). `nBlocks == 1` rows loop from Block 1: #10050(handle, `Block1 << 1`) — a byte offset of 16-bit PCM
   (`0x6fb0d8d4–0x6fb0d8e4`).

Variant pick `0x6fb0ee70` (RNG `0x6fb39640` on the local player's seed): `g = GroupSize(id)` (byte `+0x3d`,
`0x6fb0eea1`); `avoid = min(g − 1, 2)`; for `g ≤ 3`, `rand(g + 1) == 0` lowers `avoid` by one; then
`pick = id + rand(g)` until it is not among the first `avoid` recent picks. It never reads `groupBase`.

## 6. Channels, stealing and StopChannel

- 16 channels: 0..3 stereo (flags 1), 4..15 2D mono (flags 0) (init `0x6fb0d577`).
- AllocChannel `0x6fb0ce70`: a free channel of the SAME partition (`0x6fb0ce80–0x6fb0ce95`), else the victim of that
  partition — min priority → max dist² → min start (u32) → min record address (`0x6fb0ceb0–0x6fb0cf03`) — is stolen
  iff `request.priority > victim.priority`, or equal and `victim.address < request.address` (`0x6fb0cf14–0x6fb0cf33`).
  The victim is stopped and left in state 2 (not freed): a loop goes back to pending in the next state-2 branch.
- StopChannel `0x6fb380e0`: #10032 saves the stream position; it returns 0 for non-streamed buffers, so only streamed
  rows resume (with the 3-tick fade).

## 7. UpdateChannel `0x6fb0d1d0` → D2sound output

- `v = master·vol/100` (`0x6fb0d269–0x6fb0d288`); pause duck unless the id is 1–15, 52–71 or `0x1231–0x125a`
  (`0x6fb0d293–0x6fb0d2ba`); solo duck unless the row is Solo (`0x6fb0d2eb`); falloff past minDist
  (`0x6fb0d428–0x6fb0d450`, minDist `0x6fb0dce0`: 60 / 60 / 200 / 400 / 2000, other → 60); `v2 = Volume·v/255`.
- A stereo channel skips #10047 / #10028 (`0x6fb0d4a5–0x6fb0d4c7`): no attenuation, centred pan.
- 2D channel: #10047 (`0x6f9b8b50`) attenuation / pan from the position scaled by 0.003125 (`0x6fb87580`),
  `v2 = att·v2/255`, then #10008 (`0x6f9b6e20`) volume and #10028 (`0x6f9b6d80`) pan in millibels (`2000·log10`,
  clamps −10000 / 0, `0x6f9b8830`).

## 8. Fades, stops and unit removal

- Fade `0x6fb38230` does nothing for a record with two or more units (`0x6fb38266 → 0x6fb37e90`).
- StopWithFade `0x6fb38550`: stop flag (`0x6fb3857a`), then a Fade Out fade if the record plays
  (`0x6fb3857d–0x6fb38594`). StopSound `0x6fb38bf0` ignores handle 0 / unknown handles.
- Unit free `0x6fb56d61 → 0x6fad3120 → 0x6fb38c20` (flag 0): the unit leaves every record; a record left without
  units keeps playing if it is a one-shot or a fading-out loop (`0x6fb38c98–0x6fb38cb1`), an active loop gets
  StopWithFade (`0x6fb38cc8`). The port detects removal through `alive === false` / `getPos() === null` at the start of
  `update()`.
- Game exit StopAll `0x6fb38d20`; per-game init `0x6fb0ef90` reloads Sounds.txt (recent picks zeroed) and resets the
  handle counter and the clock. The duck values (`.data` 100) are never reset.

## 9. Port decisions

- The record layer never synthesizes a duration: the facts of the ORIGINAL WAV (frames / rate / channels) are injected
  (`sampleFacts`); a missing source or entry throws at StartSound; `none.wav` and source-declared unavailable samples
  fail the start explicitly and are counted.
- Variant groups need the local player's RNG and unit sounds need the listener position; both fail fast when absent.
- `asyncPending` is a port hold for callers that load a sample themselves; the faithful Async Only mechanism is the
  `sampleState` load state.
