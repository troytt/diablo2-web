# D2Game 1.13c — player modes started by combat (BL / dodge / GH) and skill modes vs. paths

TS: [`monster-melee-attacks.ts`](../../src/server/engine/game-instance/monster-melee-attacks.ts) (`resolveMonsterAttackOnPlayer`),
[`monster-damage.ts`](../../src/server/engine/game-instance/monster-damage.ts) (`maybeEnterPlayerHitRecovery`),
[`frame-and-commands.ts`](../../src/server/engine/game-instance/frame-and-commands.ts) (`stepPlayerMovement`).

## 1. `SUNITDMG_ExecuteEvents` (`0x6FCFCF20`) — player defender branch (`0x6FCFD1CE..0x6FCFD442`)

`ax = pDamage->wResultFlags` (set by `0x6FCFE5A0`: block `0x10`, dodge `0x80`, avoid `0x100`, weapon block `0x8000`;
`0x02` death, `0x04` GetHit, `0x08` knockback):

| Test | Address | Action |
|---|---|---|
| `al & 0x80` (dodge) | `0x6FCFD1D2..0x6FCFD1DA` | `push 0x41` (state 65 `dodge`) |
| `ah & 0x01` (avoid) | `0x6FCFD25B..0x6FCFD260` | `push 0x42` (state 66 `avoid`) |
| both → | `0x6FCFD1DC..0x6FCFD258` | `#10871(defender, state)` stat list, `#10680(list, 350)` = skill id, `#10630` the defender's skill; none -> return. `#10137(unit, #10397(unit) | 4)`; `PLRMODE_StartMode` `0x6FC98430(mode 13 = S1, skill, attacker type/id)` |
| `ah & 0x02` | `0x6FCFD26C..0x6FCFD2CF` | state 68 (`evade`) path, `0x6FCFFFD0(12, defender)` |
| `ax & 0x8010` (block / weapon block) | `0x6FCFD2D2..0x6FCFD343` | `ah & 0x40` -> return; `STAT 95` / `STAT 102` (FBR) check against `pGame->dwGameFrame`; `PLRMODE_SetMode(9 BL)` `0x6FC98550`; `STAT 95 = frame` |
| `al & 0x02` (death) | `0x6FCFD346` | `0x6FC98430(mode 0 DT)` unless already dead (`mode 0 / 17`) |
| `al & 0x08` (knockback) | `0x6FCFD3A6` | `0x6FC98430(mode 19 KB)` |
| `al & 0x04` (GetHit) | `0x6FCFD3EB` | `STATE 21` stunned or `!SUNITDMG_CheckSkipGetHit` -> `0x6FC98550(mode 4 GH, dwDmgTotal)` |

## 2. Mode length when started from a monster swing

`ExecuteEvents` runs inside the monster's update, after the player's own unit update of the frame; the new mode's
animation accumulator first advances on the next frame. A mode of `frames` AnimData frames at rate `speed` is
visible for `ceil(frames * 256 / speed)` frames (`computeOneShotTicks + 1`). Oracle `p52-amazon-defense`:
BL on F=916..921 (NU on F=922); dodge (S1) on F=1071..1079 (NU on F=1080). The same holds for a monster GH
started by a player hit (player pass before the monster pass): `a1-bloodmoor-melee` zombie #10 GH on F=1086..1102,
NU on F=1103 (`maybeEnterMonsterHitRecovery`).

## 3. Skill / attack modes end walking and running

A skill or attack mode started while the player walks / runs ends the path; when the animation finishes the player
is in NU at the cast position, the old run target is not resumed. Oracle `p52-barbarian-warcries`: War Cry cast
while running on F=910 (path target `5661,5801`), NU on F=923 at `5661,5806`. TS: `stepPlayerMovement` stops the
`D2DynamicPathStrc` path (`stopPlayer`) on the first anim-locked frame (oracle path only). Pending: locate the
`PLRMODE_StartMode` (`0x6FC98430`) path-stop instruction and the matching rule for GH / BL started while moving.

## 4. A new command during an attack restarts it

`PLRMODE_SetMode` (`0x6FC98550`): `0x6FC98340(player, newMode)` decides by the current mode (byte table `0x6FC98410`,
jump table `0x6FC983F4`): NU / WL / RN / TN / TW / S2 / S4 -> allowed; DT / GH / BL / DD -> refused; A1 / A2 / SC / TH ->
allowed while `0x6FC97E00` holds (`dwGameFrame <= first pending unit event of type 1 + 5`, event list `unit+0xDC`
scanned by `0x6FCAE490`), else only GH (4) / BL (9). Without the force flag `0x6FC97FA0` follows: current skill
interruptible (`SkillsTxt+0x07 & mask+0x1C`) -> with Concentration (state 42) `pPlayer->pSeed % 100 < STAT 164`
(`0x6FC9805E`) refuses (unless NU); otherwise allowed. The mode-start callback of the table `0x6FD1A3F8[mode]` then
restarts the animation.

Oracle: `a1-bloodmoor-melee` attack started on arrival F=1075, the F=1080 attack command restarts it (hit F=1086,
NU F=1095 = 1080 + the standing 6 / 15 offsets); `p52-necromancer-curses` arrival F=933, restart F=940 (hit F=948,
NU F=958). TS: `isPlayerActionAnimLocked113c` lets an attack command (skill 0) through for an interruptible current
skill without a successful Concentration roll and `schedulePlayerSkillWindup113c` drops the old animation and its
pending action. Not yet generalised to non-attack skills (needs the `0x6FC97E00` event-frame rule).

## 5. Sequence (SQ, mode 18) animation length

Player mode table `0x6FD1A498 + 16 * mode` (`0x6FC94A8A`): `{start, per-frame, ?, flag}`. Mode 10 SC:
start `0x6FC94C90`, per-frame `0x6FC959B0` (`#10853` advance at `0x6FC959BE`, then `#10426` at `0x6FC959C4`; finished -> `0x6FCFA750`, `#?(unit, 0xB)` at `0x6FC959D8`).
Mode 18 SQ: start `0x6FC95510`, per-frame `0x6FC95CE0` (the same per-frame pointer is stored for modes 4, 5, 7, 8, 9, 16..20).

Sequence state in the unit (`D2Common`):

| Field | Set at | Meaning |
|---|---|---|
| `+0x30` | `0x6FD82820` (`[0x6FDECF40 + 4 * seqNum]` row for the weapon class, 12-byte `{frames*, len, count}`) | sequence table pointer (non-zero = sequence anim) |
| `+0x34` | `0x6FD8284E` | `len << 8` (wrap length) |
| `+0x38` / `+0x3C` | `0x6FD82853` / `0x6FD8285A`, then `#10819` `0x6FD831DE` | position 0 / speed `0x100`, rewritten to the AnimData speed `* (100 + dFCR) / 100` when `0x6FD80B80` says cast mode (SQ with `skills.seqtrans == SC`); there is no `xxSQ` AnimData row, `0x6FD91F70` falls back to the default record (`0x6FD91EC7`: frames `0x800`, speed `0x100`) |
| `+0x48` | `0x6FD82872` | remaining `count << 8` |

`#10853` (`0x6FD82460`) for a sequence: `pos += speed` (wrapped by `len`), `remaining -= speed` (`0x6FD8249B..0x6FD824A1`),
then `0x6FD7F100` reads frame/dir/event (`+0x44`/`+0x40`/`+0x4E`) from the table. `#10426` (`0x6FD7EF5E`):
sequence finished iff `remaining <= 0` (non-sequence: `frame + speed >= frames`, `0x6FD7EF6D`).

The binary table counts equal the TS `PLAYER_SEQUENCES_113C` lengths for every seqNum 1..23 (checked against
`0x6FDEB3F8..0x6FDECE98`). Observed: the SQ mode ends one advance before `remaining` reaches 0, i.e. at the same
point as the non-sequence predictive rule: `p52-sorceress-elemental` Chain Lightning (seq 12, 19 entries, speed 256)
is mode 18 on F=910..927 and NU on F=928 (a 14-frame SC Fire Ball is 13 frames, F=720..732). TS: the sequence
branch of `AnimDispatcher.tick` completes when `acc + speed >= count * 256`. **Address pending**: where the SQ
per-frame handler `0x6FC95CE0` (skill-present path `0x6FC95CF4..0x6FC95D4E` has no `#10426` call) ends the mode.

## 6. Monster GetHit vs. a pending AI event (DRLG path, oracle-observed)

- An **idle** monster that already has a type-2 AI event pending keeps it through a GetHit. When the event
  fires, its think replaces the GH mode. Oracle `p52-necromancer-poison-golem` zombie #9: A2 ends F818,
  event at F833 (= 818 + aidel 15), GH from F823, A2 starts on F833, although the 17-frame GH would run to F840.
- A **walking** monster has no event pending. It re-arms `aidel` after the full GH. Oracle
  `a1-bloodmoor-melee` zombie #10: GH F1086..F1102, no think through F1105.

TS: `maybeEnterMonsterHitRecovery` (`wasIdleWithPendingAi`, `monster-damage.ts`) and
`drlgAiEventInterruptsGh` (`monster-combat-ai.ts`). **Address pending**: the event-queue code that makes the
pending event survive `MONSTER_StartMode(GH)`.
