/**
 * Root-cause hypotheses for mismatch classes of the P5.3 function sweep, keyed by
 * class key (`category|function|argument|band`), a prefix of it (first 3 or 2 fields),
 * or `skills|*|<band>` as the fallback for the skill-level boundary bands.
 * Each entry cites the binary evidence (DLL + VA) it is based on.
 */

const LVL_CLAMP =
  'TS clamps the skill level (`evaluateSkillCore113c` `effLvl = clamp(slvl, 1, 99)`, calc-ast `lvl = max(0, slvl)`, ' +
  '`computeSkillManaCost256` clamp 1..99); D2Common passes the raw level through (`#10147` 0x6FDA1070 / `#10786` ' +
  '0x6FDA1BF0 only reject `lvl <= 0` in some codes, e.g. `ln12` 0x6FD51670, while `dm78` 0x6FDA1148, `#10090` ' +
  '0x6FD9EA00 and the MissCalc paths do not), and 32-bit `imul` wraps at extreme levels. Unreachable in normal ' +
  'play (levels are clamped to 0..99 by `SKILLS_GetSkillLevel` 0x6FDA05D0): boundary-only.'

const UNIMPLEMENTED_CODE = (what: string): string =>
  `SkillCalc code not implemented in \`calc-ast.ts\` \`resolveBuiltInIdentifier\` (falls through to 0). ` +
  `D2Common SkillCalc table 0x6FDA174C dispatches it to ${what}. Used by SkillDesc.txt tooltips and by calcs ` +
  `that reference other skills' columns.`

const H: Record<string, string> = {
  'skills|*|lvl<=0': LVL_CLAMP,
  'skills|*|lvl61-99':
    'Same root cause as the 1..60 band of this function/code (reachable with +skills).',
  'skills|*|lvl>=100': LVL_CLAMP,

  // ---- SkillCalc codes missing in calc-ast
  'skills|skcalc|pets': UNIMPLEMENTED_CODE('`pets` 0x6FDA16E3 -> evaluates `petmax` (skill record +0xC0)'),
  'skills|skcalc|skpt': UNIMPLEMENTED_CODE('`skpt` 0x6FDA16EB -> evaluates `skpoints` (+0x170)'),
  'skills|skcalc|m1rn': UNIMPLEMENTED_CODE('`m1rn..m3rn` 0x6FDA1430 -> `Range + LevRange*lvl` of SkillDesc descmissileN'),
  'skills|skcalc|m2rn': UNIMPLEMENTED_CODE('`m1rn..m3rn` 0x6FDA1430'),
  'skills|skcalc|m3rn': UNIMPLEMENTED_CODE('`m1rn..m3rn` 0x6FDA1430'),
  'skills|skcalc|m1en': UNIMPLEMENTED_CODE('`mNen` 0x6FDA1325 -> descmissile #edmn (0x6FDBB360) >> 8'),
  'skills|skcalc|m2en': UNIMPLEMENTED_CODE('`mNen` 0x6FDA1325'),
  'skills|skcalc|m3en': UNIMPLEMENTED_CODE('`mNen` 0x6FDA1325'),
  'skills|skcalc|m1ex': UNIMPLEMENTED_CODE('`mNex` 0x6FDA137F -> descmissile #edmx (0x6FDBA3E0) >> 8'),
  'skills|skcalc|m2ex': UNIMPLEMENTED_CODE('`mNex` 0x6FDA137F'),
  'skills|skcalc|m3ex': UNIMPLEMENTED_CODE('`mNex` 0x6FDA137F'),
  'skills|skcalc|m1el': UNIMPLEMENTED_CODE('`mNel` 0x6FDA13D9 -> missile elemental length 0x6FDB9DC0'),
  'skills|skcalc|m2el': UNIMPLEMENTED_CODE('`mNel` 0x6FDA13D9'),
  'skills|skcalc|m3el': UNIMPLEMENTED_CODE('`mNel` 0x6FDA13D9'),
  'skills|skcalc|m1eo': UNIMPLEMENTED_CODE('`m1eo/m2eo/me3o` 0x6FDA1538 (descmissile min, 256ths)'),
  'skills|skcalc|m2eo': UNIMPLEMENTED_CODE('`m1eo/m2eo/me3o` 0x6FDA1538'),
  'skills|skcalc|me3o': UNIMPLEMENTED_CODE('`m1eo/m2eo/me3o` 0x6FDA1538'),
  'skills|skcalc|m1ey': UNIMPLEMENTED_CODE('`m1ey/m2ey/me3y` 0x6FDA158F (descmissile max, 256ths)'),
  'skills|skcalc|m2ey': UNIMPLEMENTED_CODE('`m1ey/m2ey/me3y` 0x6FDA158F'),
  'skills|skcalc|me3y': UNIMPLEMENTED_CODE('`m1ey/m2ey/me3y` 0x6FDA158F'),

  // ---- mana
  'skills|skcalc|mana':
    'SkillCalc `mana` (0x6FDA1264) is `((lvl-1)*lvlmana + mana) << manashift >> 8` with no `minmana` floor and ' +
    'no `max(0)`; calc-ast maps `mana`/`usmc` to `computeSkillManaCost256` (minmana floor, level clamp). ' +
    'Visible for skills with negative `lvlmana` (Double Swing, Guided Arrow, ...).',
  'skills|skcalc|usmc': 'SkillCalc `usmc` (0x6FDA1507) has no `minmana` floor and no `max(0)`; see `mana`.',
  'skills|rawmana':
    '`#10090` (0x6FD9EA00) returns `((lvl-1)*lvlmana + mana) << manashift` signed, without level clamp; TS ' +
    '`rawManaCost256 = max(0, raw)` at clamp(lvl,1,99). Negative raw cost (negative lvlmana) is reachable at ' +
    'normal levels (Double Swing lvl 10 -> -32/256).',

  // ---- elemental damage: mulDiv shortcut
  'skills|elmin|mastery1':
    'Caster mastery is added through `0x6FD9F870`, which tail-calls the D2Common mulDiv `0x6FD511E0` ' +
    '(0x6FD9F8DA..0x6FD9F8E1, edx = damage256); for damage256 > 0x100000 the mulDiv shortcut computes ' +
    '`(v / 100) * pct` and drops the remainder. calc-ast `mastered()` uses `trunc(v * pct / 100)`. Reachable ' +
    'above 4096 damage (high synergy/mastery builds).',
  'skills|elmax|mastery1': 'Same root cause as elmin mastery1 (`0x6FD9F870` -> mulDiv `0x6FD511E0` shortcut).',
  'skills|skcalc|enms': 'Same as elmin mastery1 (mulDiv `0x6FD511E0` shortcut in the mastery add).',
  'skills|skcalc|exms': 'Same as elmin mastery1 (mulDiv `0x6FD511E0` shortcut in the mastery add).',
  'skills|skcalc|enma': 'Same as elmin mastery1 (mulDiv `0x6FD511E0` shortcut in the mastery add).',
  'skills|skcalc|exma': 'Same as elmin mastery1 (mulDiv `0x6FD511E0` shortcut in the mastery add).',
  'skills|elmin|mastery0':
    'The EDmgSymPerCalc synergy is applied as `v += mulDiv(v, syn, 100)` (`#10121` 0x6FDA0524..0x6FDA0530, ' +
    '`#11091` likewise); mulDiv `0x6FD511E0` takes the `(v/100)*syn` shortcut for v > 0x100000. TS ' +
    '`trunc(v * (100 + syn) / 100)` is exact. Only above 4096 damage (Meteor / Claws of Thunder with synergies).',
  'skills|elmax|mastery0': 'Same as elmin mastery0 (synergy via mulDiv `0x6FD511E0` shortcut).',
  'skills|skcalc|edns': 'Same as elmin mastery0 (synergy via mulDiv `0x6FD511E0` shortcut).',
  'skills|skcalc|edxs': 'Same as elmin mastery0 (synergy via mulDiv `0x6FD511E0` shortcut).',
  'skills|skcalc|edmn': 'Same as elmin mastery0 (synergy via mulDiv `0x6FD511E0` shortcut).',
  'skills|skcalc|edmx': 'Same as elmin mastery0 (synergy via mulDiv `0x6FD511E0` shortcut).',
  'skills|elen': 'ELenSymPerCalc is applied with mulDiv `0x6FD511E0` (`#10510` 0x6FD9E9EC); see elmin mastery0.',

  // ---- physical damage
  'skills|phmin':
    '`#10297` (0x6FDA1FF0) is not the flat skill damage only: skills whose Skills.txt flag byte (+0x05) matches ' +
    'the mask at `[0x6FDD90B0]+4` are delegated to `0x6FD9F930` (weapon/kick based damage, 0x6FDA2025..0x6FDA2037), ' +
    'and the `bStrBonus` path adds `stat21/22 * byte[+0x1A5] / 128`. `evaluateSkill113c().minPhysDmg` is the ' +
    'band-scaled MinDam only (Kick lvl 1: oracle 10<<8, TS 0). The TS damage pipeline adds weapon damage ' +
    'elsewhere, so this is a field-semantics difference; verify per skill before changing TS.',
  'skills|phmax': 'Same as phmin (`#10567` 0x6FDA2100, flag path 0x6FDA2138 -> `0x6FD9F930(…, 1)`).',
  'skilleval|eval.minElemDmg256':
    '`evaluateSkill113c` falls back to the srvmissile EMin/EMax when the skill row has none ' +
    '(`registry.ts` `primaryMissileName` fallback, e.g. monster skill UnHolyBolt); `#10121`/`#11091` read only ' +
    'the skill row (0x6FDA049E..0x6FDA04C0) and return 0 — missile damage comes from MissCalc (`0x6FDBB360`). ' +
    'Field-semantics difference (TS merges skill and missile damage); also inherits the mulDiv shortcut of elmin mastery0.',
  'skilleval|eval.maxElemDmg256': 'Same as eval.minElemDmg256 (srvmissile fallback in TS only).',

  // ---- calc parser edge cases
  'skills|skform|calc2:plain':
    'Bone Wall calc2 is the literal `par34`: the original evaluates it to a non-zero value (8 at lvl 1), so the ' +
    'compiled calc is not "unknown identifier -> 0" as calc-ast edge case #2 assumes. Needs the compiled ' +
    'Skills.bin calc buffer to confirm how `par34` was tokenised.',
  'skills|skcalc|clc2': 'Bone Wall `clc2` -> calc2 `par34`; see skform calc2.',
  'skills|skform|calc1:plain':
    'Imp Inferno calc1 is `"rand(par3,par4)"`: the original `rand` (0x6FDA0CB0 -> 0x6FD51180) draws from the ' +
    'caster seed, TS uses the midpoint without `randFn`. RNG-dependent, not a formula bug.',
  'skills|skform|passivecalc2:plain': 'Holy Shock passivecalc2 is `exms*par5/256`: inherits the `exms` mulDiv shortcut (see elmin mastery1).',
  'skills|skcalc|clc1': 'Imp Inferno `clc1` -> `rand(par3,par4)`; see skform calc1 (RNG).',

  // ---- primitives
  'primitives|band5':
    '`0x6FD9DDB0` computes the 5-band sum with 32-bit `imul`/`lea` (wraps); `compute5BandScaling` uses JS ' +
    'doubles. Only for |inputs| > 2^20 (boundary).',
  'primitives|dimret':
    '`#10115` (0x6FD9DC30) multiplies `x * (b - a)` with 32-bit `imul` (wraps) and then caps at `b`; ' +
    '`computeDiminishingReturnsRaw` uses doubles. `lvl = -6` divides by zero (oracle "fault"). Boundary only.',
  'primitives|muldiv':
    'The 64-bit path of `0x6FD511E0` (0x6FD51227 -> lldiv 0x6FDD7080) returns only the low dword; ' +
    '`mulDiv113c` returns the full quotient (`fogMulDiv113c` already wraps with `BigInt.asIntN(32, …)` and agrees).',
  'primitives|muldiv.game': 'D2Game `0x6FC214D0` has the same body as `0x6FD511E0`; see muldiv.',

  // ---- stats / block
  'stats|vit.maxhp':
    '`calculateVitalsAtLevel` clamps added vitality to >= 0; `0x6FD0AD10` applies negative counts (respec path ' +
    '`0x6FD0AF80`), shrinking max life by `(LifePerVitality*n) << 6`.',
  'stats|vit.maxstamina': 'Same as vit.maxhp (StaminaPerVitality, `0x6FD0ADC7`).',
  'stats|ene.maxmana': 'Same as vit.maxhp for energy (`0x6FD0AE20`).',
  'stats|ar|ar<0':
    'TS `computePlayerBaseToHit113c` returns `max(0, ar)`; `#10621` (0x6FD81F42..0x6FD81F89) returns ' +
    '`5*dex + tohit - 35 + ToHitFactor` unclamped (negative for low dex / negative tohit).',
  'stats|ar|ar>=0': '32-bit wrap of `5*dex + tohit` (`lea` at 0x6FD81F42) for extreme tohit; boundary only.',
  'stats|def|override':
    '`UnitStatList.getDefense` applies `armor_override_percent` (182) before the armor % pool; `#10672` ' +
    '(0x6FD82890, kb combat/d2game-tohit-defense §2) applies `skill_armor_percent + item_armor_percent` first ' +
    'and the override afterwards -> off-by-one truncation differences.',
  'stats|def|pct': 'TS clamps the defense at 0 (`Math.max(0, …)`); `#10672` returns negative totals.',
  'stats|def|flat': 'TS clamps the defense at 0 (`Math.max(0, …)`); `#10672` returns negative totals.',
  'stats|def|dex<0': 'TS uses `dex >> 2` (floor) while `#10672` uses `cdq; and 3; add; sar 2` (trunc toward 0).',
  'block|block':
    '`#10212` clamps only the upper bound (`cmp edi,0x4b; jge` at 0x6FD81E7F) and returns negative block ' +
    'rates (dex < 15, negative toblock, clvl <= 0 -> divisor 2); `computeBlockRate113c` clamps to [0, 75]. ' +
    'No gameplay effect (rand(100) < negative is never true). Note CharStats BlockFactor is read at +0x49 ' +
    '(0x6FD81E41), not +0x35 as kb/combat/d2common-10212-block-rate.md states.',

  // ---- hit
  'hit|hit|lvl<=0':
    '`computeToHitChance` clamps attacker/defender level to >= 1; `0x6FCFDE90` uses the raw levels ' +
    '(`2*alvl*f/(alvl+dlvl)` at 0x6FCFDFEA..0x6FCFDFFA; dlvl 0 doubles the factor, alvl+dlvl == 0 faults). ' +
    'Town NPCs / some summons have level 0.',
  'hit|hit':
    '32-bit overflow: `0x6FCFDFE4 imul eax,eax,0x64` (AR*100) and the AR% mulDiv wrap for AR above ~21.4M or ' +
    'huge negative defense; TS uses doubles. Boundary only.',

  // ---- resist
  'resist|resist':
    'Monster branch: `computeEffectiveResistance` reports res >= 100 as `effectiveRes = 100` (+`isImmune`), the ' +
    'resolver `0x6FCFB3C0` returns the raw value (no upper cap, immunity is tested by the caller). Negative ' +
    'pierce: TS `Math.max(0, passiveEnemyPierce)`, binary subtracts the signed stat (0x6FCFB3F3..0x6FCFB3FC). ' +
    'The `res >= 100` classes are representation-only; negative pierce is boundary-only.',

  // ---- steal
  'steal|steal.life':
    'Negative or zero results: `0x6FCFB570` (life) / `0x6FCFAE70` (mana, `test ebx,ebx; jg` at 0x6FCFAE75) ' +
    'add nothing for amounts <= 0, while `computeLifeManaSteal113c` returns the signed amount (negative ' +
    'leech % or non-positive physical damage). Caller-dependent; boundary.',
  'steal|steal.mana': 'Same as steal.life (`0x6FCFAE70` ignores amounts <= 0).',

  // ---- anim
  'anim|diminish':
    '`0x6FD823E0` computes `base*v/(base+v)` with 32-bit `imul`/`idiv` (0x6FD82444..0x6FD8244D): v = -120 ' +
    'divides by zero (oracle "fault"), v < -120 gives large positive rates, |v| > ~17.9M wraps; ' +
    '`computeDiminishingRate113c` returns -100 for `120 + v <= 0` and uses doubles. Boundary only.',

  // ---- exp
  'exp|expratio|exp>2^20':
    '`0x6FCFA9E0` guards the multiply: if `exp > 0x7FFFFFFF >> (shift + (ratio >> shift))` it returns ' +
    '`(exp >> shift) * ratio` (0x6FCFAA08..0x6FCFAA1F), dropping the low 10 bits; `applyExpRatio113c` uses ' +
    '`floor(exp * ratio / 1024)`. GAMEPLAY-RELEVANT: any kill worth more than 1,048,575 experience after the ' +
    'level-difference step (Hell bosses) gets up to 1023 exp less in the original.',
  'exp|explvl|exp>2^20':
    '`0x6FCFAA40` scales through mulDiv `0x6FC214D0` (tail jump at 0x6FCFAA81) with `edx = exp`; for exp > ' +
    '0x100000 the shortcut is `(exp / 256) * factor` or `(exp / mlvl) * clvl`. `computeMonsterExpGrant113c` uses ' +
    'exact `floor(exp * factor / 256)`. GAMEPLAY-RELEVANT for big kills, same range as expratio. (kb ' +
    'combat/d2game-experience-pipeline-113c.md lists `exp` as `[esp+4]`; it is `edx`.)',
  'exp|expratio|normal':
    'clvl 99: `#10989` (D2Common 0x6FDAE840, imported by D2Game thunk 0x6FC2A784) returns 0 for `level > MaxLvl` ' +
    'and otherwise the ExpRatio column of row `[0x6FDF0B50] + 0x20*(level+1)`; the original yields 0 exp at ' +
    'clvl 99 while `applyExpRatio113c` returns the input unchanged (ratio 1024). Unreachable in practice (the ' +
    'pipeline returns 0 at max level, 0x6FCFC053..0x6FCFC069).',
  'exp|explvl|exp>cap': 'Same mulDiv shortcut as `exp>2^20` (inputs above the 0x7FFFFF pipeline cap).',
  'exp|expratio|exp>cap': 'Same overflow guard as `exp>2^20` (inputs above the 0x7FFFFF pipeline cap).',
  'exp|explvl|exp<=0': 'TS returns 0 for exp <= 0; the binary scales negative values (the pipeline guards exp <= 0 earlier, 0x6FCFC03A).',
  'exp|expratio|exp<=0': 'TS returns 0 for exp <= 0; the binary returns the input unchanged (`test edi,edi; jle` at 0x6FCFA9E3).',
  'exp|explvl|lvl<=0': 'TS clamps clvl/mlvl to >= 1; binary indexes the tables with the raw difference (boundary).',
  'exp|expratio|clvl-out-of-range': 'TS clamps clvl to 1..99; the binary reads Experience.txt ExpRatio via D2Common for the raw level (boundary).',

  // ---- damage pipeline 0x6FCFC0B0 -> 0x6FCFBD00 -> 0x6FCFB3C0 / 0x6FCFAD00
  'dmg|*|absorb':
    'Argument order of the absorb mulDiv: D2Game `0x6FCFAD2A..0x6FCFAD40` calls mulDiv `0x6FC214D0` with ' +
    '`edx = damage256`, `eax = absorb%`, so the shortcut only triggers for damage256 > 0x100000; TS ' +
    '`applyElementalAbsorb113c` calls `mulDiv113c(remaining256, absorbPct, 100)`, i.e. damage in the `eax` ' +
    'slot, so its `(a / 100) * pct` shortcut fires for any channel above 0x10000 (256 damage) and absorbs up to ' +
    '`pct - 1` 256ths too little (e.g. 135883 cold, 9% -> original 12229, TS 12222). GAMEPLAY-RELEVANT for every ' +
    'absorb% item against hits above 256 damage; one-line fix (swap the first two arguments).',
  'dmg|*|dr/mdr<0':
    'Negative DR/MDR: the reducers are `stat34 << 8` / `stat35 << 8` taken signed (0x6FCFC125..0x6FCFC177; the ' +
    '`> 0` test only gates the frame-rate scaling) and subtracted per channel at 0x6FCFBD41, so negative values ' +
    'ADD damage; TS clamps both with `Math.max(0, …)`. Boundary (negative DR/MDR does not occur on normal gear).',
  'dmg|*|pierce<0':
    'Negative pierce: the resolver subtracts the signed attacker stat (0x6FCFB3F3..0x6FCFB3FC); TS clamps ' +
    '`passiveEnemyPierce` at 0 (see resist classes). Boundary.',
  'dmg|*|absorb%<0': 'Negative absorb%: same absorb-step differences as `absorb` (flat part still applies).',
  'dmg|*|big':
    'Channels above 0x100000 (4096 damage): the resistance step is `mulDiv(edx = dmg, eax = 100 - res, 100)` ' +
    '(0x6FCFBD57..0x6FCFBD65) whose shortcut computes `(dmg / 100) * (100 - res)`; TS truncates the exact product.',
  'dmg|*|mdr>=elem':
    'Flat reducer >= channel: the original stores the negative remainder, skips resist/absorb ' +
    '(`test esi,esi; jle` at 0x6FCFBD47) and sums the negative value into the total (0x6FCFC50A); TS models the ' +
    'MDR spill (#1795) but differs in the per-channel value it reports.',
  'dmg|*|dr>=phys':
    'DR >= physical damage: the physical channel goes negative and is kept (0x6FCFBD41..0x6FCFBD47, stored at ' +
    '0x6FCFBD80) and summed into the total. TS now subtracts the overflow from `totalDamage256` (the ' +
    'gameplay value), but still reports `physDamage256 = 0` instead of the negative channel, and a negative ' +
    'original total is reported as 0 by TS (no damage either way). Representation-only remainder.',
  'dmg|*|rate':
    'Frame-rate scaled DR/MDR (`pDamage+0x54`): `mulDiv(reducer, rate, 0x400)` at 0x6FCFC142..0x6FCFC147 / ' +
    '0x6FCFC16B..0x6FCFC170 (only when reducer > 0 and rate > 0); TS `scaleFlatDrByFrameRate` uses ' +
    '`trunc(dr * rate / 1024)` (and treats rate < 1 as a fraction).',
  'dmg|*|res>=100':
    'Same per-channel arithmetic as `plain` with resist >= 100 (original: `100 - min(res, 100)` -> 0 damage; TS ' +
    'immunity branch) — see `plain` / `absorb` for the arithmetic differences.',
  'dmg|*|res<0': 'Negative resist amplifies through mulDiv (0x6FCFBD65); differences come from the absorb argument order / mulDiv shortcut.',
  'dmg|*|plain':
    'Remaining plain-case differences: resistance applied with mulDiv `0x6FC214D0` (shortcut above 0x100000) and ' +
    'the DifficultyLevels ResistPenalty for player defenders (TS needs `CombatUnitContext.resistPenalty`, which the ' +
    'sweep supplies via `difficultyResistPenalty`).',

  // ---- animation frames (#10819 / #10385)
  'frames|*|ts-no-event':
    'Representation: `#10385` (D2Common 0x6FD91EF0) returns the first non-zero event index and `framesPerDir` ' +
    'when the record has no event (scan 0x6FD91F20..0x6FD91F35); TS `CharAnimClip113c.actionFrame` is 0 for ' +
    'clips without events. Not a timing bug by itself.',
  'frames|animdata.action':
    'TS hard-coded `CHAR_ANIM_CLIPS_113C` / `CHAR_WCLASS_ANIM_CLIPS_113C` (char-anim-speed.ts) disagree with ' +
    'AnimData.d2 as read by `#10385` (0x6FD91EF0, lookup by 7-char COF name, no fallback) — e.g. AMSCHTH first ' +
    'event 11 (TS 13). `getCharAnimClip113c` also falls back to the base clip for weapon classes it does not ' +
    'list. Data-table mismatch; regenerate the TS tables from animdata.d2.',
  'frames|animdata.frames': 'Same as animdata.action: TS clip table frame counts differ from AnimData.d2 (e.g. DZTNHTH 10 frames, TS 16).',
  'frames|animdata.speed': 'Same as animdata.action: TS clip table speeds differ from AnimData.d2 (e.g. PARN1HT 184, TS 256).',
  'frames|*|stat<0':
    'Negative rate: `#10819` multiplies `AnimData.speed * rate` and divides by 100 with the UNSIGNED magic ' +
    '`mul 0x51EB851F` (0x6FD831B4..0x6FD831BE, 0x6FD8325C..0x6FD83267), so a negative rate becomes huge and is ' +
    'clamped to 0x7FFF (0x6FD831C5); TS `computeStepSpeed256` clamps to >= 1. Walk/run use a signed divide ' +
    '(0x6FD83372..0x6FD83384) and `max(25, stat67 + dFRW)`. Boundary (needs FHR/FBR/FCR far below 0).',
  'frames|*|stat>1000': 'Large stat values: 32-bit `imul` in `0x6FD823E0` and the 175 cap of the attack rate (0x6FD834xx) vs TS doubles; boundary.',
  'frames|*|stat0-1000':
    'In-range stat values: the attack path of `#10819` (0x6FD833DE..) uses `stat68 + dIAS` plus the weapon ' +
    'speed of the equipped weapon (0x6FD82EF0) with the [15, 175] clamp; remaining differences are in the TS ' +
    '`computeEffectiveAnimRate113c` IAS composition or the TS clip table (see animdata classes).',
}

for (let i = 1; i <= 6; i++) {
  H[`skills|skcalc|ast${i}`] = UNIMPLEMENTED_CODE(`\`ast${i}\` (0x6FDA169D..0x6FDA16B6) -> evaluates \`aurastatcalc${i}\` (+0x${(0x68 + 4 * (i - 1)).toString(16).toUpperCase()})`)
}
for (let i = 1; i <= 5; i++) {
  H[`skills|skcalc|pst${i}`] = UNIMPLEMENTED_CODE(`\`pst${i}\` (0x6FDA16BB..0x6FDA16DB) -> evaluates \`passivecalc${i}\` (+0x${(0xa4 + 4 * (i - 1)).toString(16).toUpperCase()})`)
}

export const HYPOTHESES: Readonly<Record<string, string>> = H

/** TS fixes driven by this sweep (rendered into the report). */
export const FIX_LOG: readonly string[] = [
  'Shared bit-exact `mulDiv113c` (`src/common/data/mul-div-113c.ts`, D2Common 0x6FD511E0 = D2Game 0x6FC214D0: ' +
    'divide-first shortcuts, low-dword 64-bit path); `combat-pipeline.ts` re-exports it.',
  'Absorb: `applyElementalAbsorb113c` passes `(pct, damage)` in the original register order (0x6FCFAD2A..0x6FCFAD40).',
  'Resist step: `applyResist113c` = `mulDiv(100 - min(res, 100), dmg, 100)` (0x6FCFBD45..0x6FCFBD6A) at every TS call site.',
  'Frame-rate scaled DR/MDR: `mulDiv(rate, dr256, 0x400)` (0x6FCFC13B..0x6FCFC177).',
  'DR overflow: a physical channel driven below 0 by DR lowers the signed total (0x6FCFC4F7..0x6FCFC519).',
  'Skill synergy / mastery / ELenSym: `v + mulDiv(pct, v, 100)` in calc-ast and `evaluateSkillCore113c` ' +
    '(0x6FDA0524, 0x6FDA041D, 0x6FDBB40F, 0x6FDA20D6, 0x6FD9E9EC, 0x6FD9F8DA).',
  'SkillCalc `mana` / `usmc`: no minmana floor, raw level (0x6FDA1264 / 0x6FDA1507).',
  'Experience: level-difference scaling through mulDiv (0x6FCFAA40, `edx = exp`), ExpRatio overflow guard ' +
    '(0x6FCFAA04..0x6FCFAA2C), `item_addexperience` through mulDiv (0x6FCFC090), Experience.txt row 99 ExpRatio parsed.',
  'Player AnimData clips generated from AnimData.D2 (`src/baker/extract/gen-char-anim-clips-113c.ts` -> ' +
    '`char-anim-clips-113c.generated.ts`); `CHAR_ANIM_CLIPS_113C` = HTH records, `CHAR_WCLASS_ANIM_CLIPS_113C` = every ' +
    'existing weapon class, so the weapon-class fallback of `getCharAnimClip113c` only applies to COFs that do not exist.',
]
