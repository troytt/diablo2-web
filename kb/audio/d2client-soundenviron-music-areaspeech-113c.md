# Diablo II 1.13c Ambience / Weather Audio / Music Selection / Area-Entry Speech (`D2Client.dll`)

Round-2 parity audit notes. Every address was read from the raw 1.13c `D2Client.dll` (image base `0x6FAB0000`)
with `objdump`. Data facts come from `samples/d2` `Patch_D2.mpq` `SoundEnviron.txt`, `Levels.txt`, `Sounds.txt`.
Complements `audio/sound-records-113c.md` (record layer, channels, D2sound output).

## 1. SoundEnviron.txt in memory

Table `[0x6fbcc254]`, count `[0x6fbcc258]` (50), stride `0x58`: `+0x00 Song`, `+0x04 Day Ambience`,
`+0x08 Night Ambience`, `+0x0C Day Event`, `+0x10 Night Event`, `+0x14 Event Delay`, `+0x18 Indoors`,
`+0x1C Material1`, `+0x20 Material2`, `+0x24..+0x54` EAX block. A level's environment is
`byte [LevelsTxt + 0x21C]` (`SoundEnv`, reached through the player's room, `0x6faff8ec–0x6faff8f2`).

## 2. SoundEnvironTick `0x6faff860` (25 Hz, `ret 4` = `now`)

Runs only when `[0x6fbcc280]` != 0 and the local player has a room.

- Day / night: `#10396(pAct)` (D2Common `0x6fd87427`: `[[act+4]+0]`) = the environment **cycle index**
  (0 sunrise 320°, 1 morning 340°, 2 noon, 3 afternoon 160°, 4 sunset 180°, 5 night). Day iff `1 ≤ idx ≤ 3`
  (`0x6faff8af–0x6faff8c2`, same as `0x6faff700`). Sunrise and sunset are therefore **night** for audio.
- `amb = night ? +0x08 : +0x04`, `ev = night ? +0x10 : +0x0C` (`0x6faff921–0x6faff937`).
- Rain gate: `rainId = 0x6fb30450() ? 64 : 0` where `0x6fb30450` = Levels.txt `Rain` of the player's level
  (D2Common `#10215`, `0x6fb30478`) and not `[0x6fbcbf78]`. Rain volume `= ftol(0x6faff770() * 255.0)`;
  `0x6faff770` returns the weather intensity float `[0x6fbc38f4]` (0.0 when the level is not rainable). No act /
  snow test anywhere on this path.
- Ambience change only when `amb != cur` (`[0x6fbcc31c]`, `0x6faff979`):
  - swap = `(amb == day && cur == night) || (amb == night && cur == day)` of the CURRENT row.
  - swap: Fade(old handle `[0x6fbcc314]`, 250 ticks, target 0) (`0x6faff9ae–0x6faff9b8`); the new handle gets
    SetVolume 0 then Fade(250 ticks, target 255) (`0x6faff9f9–0x6faffa0d`).
  - no swap: `0x6fb38810(amb, rainId)` StopWithFade every record with id 52..71 whose groupBase is neither,
    then `0x6fb38770(ev, 0)` StopWithFade every record with id 72..201 whose groupBase is neither (row Fade Out
    applies; nothing is hard-stopped).
  - `amb != 0` → PlaySound(amb) (a2 = 0), else handle/cur = 0.
- Rain (`0x6faffa28–0x6faffab4`): `rainId == 0` → StopSound(rain handle) (StopWithFade) and clear. Otherwise if
  `vol != 0` and no handle → PlaySound(64) (a2 = 0, row Fade In) and SetVolume(vol) at once; with a handle, the
  record volume steps toward `vol` by at most 6 per tick; reaching 0 → StopSound.
- EAX `0x6fb0cf90(envIdx)` (only when `envIdx` changed and D2sound `#10059` mode == 2): D2sound `#10058` with the
  row's EAX values (×0.001 scale for the float members, `0x6fb87540`).
- Event (`0x6faffabd–0x6faffbaa`), only when `ev != 0`:
  - `ev != [0x6fbcc324]`: `j = EventDelay/6` (unsigned), `delay = EventDelay − j + rand(2j+1)`,
    `last = now − rand(delay)`, cur = ev. `ev == 0` leaves cur / timer untouched.
  - `(u32)(now − last) ≥ delay` → PlaySound(ev); on a non-zero handle: `x = ±(450 + rand(301))` (sign from
    `rand(2)`), `y = rand(201) − 100`, SetSoundPos(h, x, y, 0) → record z = 640; then `last = now`, new delay.
    A failed PlaySound keeps the timer (retries next tick). There is no "previous event still playing" check.
- Env change (`[0x6fbcc310]`): 0x6faff750 / 0x6faff720 reload the Material1/Material2 footstep sound sets.

## 3. Thunder `0x6fb30648–0x6fb306b5` (weather driver)

On the second flash of a pair: countdown `500 + rand(1500)`; if `[0x6fb91380]` (armed) →
PlaySound(202, unit 0, delay = 25 + rand(50)), then on a handle SetSoundPos(h, x = −200 + rand(400),
y = −200 + rand(400), 0) (y drawn first). All draws use the weather/player seed (`0x6fab18d0`). Unarmed → arm only.
No SoundEnviron Indoors test.

## 4. Music `0x6faf5660` (per tick, `ret 4` = `now`)

- Room change (`[0x6fbcc34c]`) stamps `[0x6fbcc340] = now`.
- `song = SoundEnviron[SoundEnv].Song`, forced to 0 outside `[0x6fbcc25c, 0x6fbcc260]` (4657..4684).
- `enabled` = D2sound `#10001` && `#10011`.
- The current song `[0x6fbcc348]` changes to `song` only if cur == 0, or music disabled, or
  `now − roomStamp ≥ 75` (`0x6faf574a`) — a 3 s debounce inside the new room.
- Disabled or cur == 0 → `0x6fb388b0`: every record with id in 4657..4684 gets stop and, if its row Fade Out != 0
  and it plays, Fade(Fade Out, 0); Fade Out 0 → just the stop flag.
- Scripted override (`0x6faf5570`, called from the 0x2C quest-voice handler 0x6fad32xx): saves the current song's
  resume point, fades out music, plays the stinger after a delay, optional second sound, end time.
- Start (`0x6faf5849–0x6faf58a8`): song not already playing (`0x6fb37d20`) → `resume = table[song − 4657]`
  (`[0x6fbc75b8]`); `a2 = (no other music record alive (0x6fb37af0) && resume == 0) ? 2 : 0`; fade out others;
  PlaySound(song, 0, 0, a2, a3 = resume).
- Every 125 ticks (`0x6faf58e2`): `pos` = stream position of the playing song (`0x6fb37de0`); the saved resume point
  is the first `Block n` (`+0x54/+0x58/+0x5C`) greater than `pos`, else 0 — music returning to a song resumes at
  its next block marker.

## 5. Area-entry player speech `0x6fad3e20` (called from the music tick, `0x6faf58c7`)

When the player's level differs from `[0x6fbcc374]` and `now − roomStamp ≥ 62`: for a level not yet flagged in
`[0x6fbca7e8 + 4·lvl]` that is listed in one of the 14 entries at `0x6fba76b0` (stride 0x30: 10 level ids,
`+0x28` quest index checked by `0x6facd740` (client quest flags `0x6fbc5590`), `+0x2C` player voice slot), all
listed levels get flagged; then if `now − [player+0x7c] > 62` and no speech record (ids 2934..4656) is alive
(`0x6fb37b30`), `0x6fad3200(player, slot)` plays the class monologue.

| entry | levels | quest | slot |
|---|---|---|---|
| 0x6fba76b0 | 17 | 2 | 38 |
| 0x6fba76e0 | 34–37 | 6 | 40 |
| 0x6fba7710 | 8 | 1 | 41 |
| 0x6fba7740 | 29–31 | 6 | 42 |
| 0x6fba7770 | 26, 27 | 3 | 43 |
| 0x6fba77a0 | 20–25 | 5 | 44 |
| 0x6fba77d0 | 38 | 6 | 46 |
| 0x6fba7800 | 2–7 | 1 | 47 |
| 0x6fba7830 | 74 | 12 | 55 |
| 0x6fba7860 | 58 | 13 | 56 |
| 0x6fba7890 | 110 | 31 | 76 |
| 0x6fba78c0 | 120 | 35 | 78 |
| 0x6fba78f0 | 121 | 34 | 77 |
| 0x6fba7920 | 132 | 36 | 79 |
