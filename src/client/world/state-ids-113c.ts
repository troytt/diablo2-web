/**
 * 1.13c States.txt row ids (row index == `id` column) used by client-side skill prediction, plus the
 * Skills.txt-derived durations those predictions need. Every id below is the real States.txt row named in the
 * comment — never reuse a neighbouring row (Issues #1045 / #1047 / #1048: inferno 12, conviction 28 and
 * convicted 29 were written instead of blaze 13, stunned 21 and cold 11).
 */

import { compute3BandDuration, computeDiminishingReturns, computeLinearScaling } from '../../common/data/calc-ast.ts'

/** States.txt `cold` (id 11): elemental chill (overlay = none; colour shift via pgsvoverlay/colorpri). */
export const COLD_STATE_ID_113C = 11
/** States.txt `inferno` (id 12, nosend=1): Inferno channel — never triggers the Blaze trail. */
export const INFERNO_STATE_ID_113C = 12
/** States.txt `blaze` (id 13, setfunc=3): Skills.txt #46 Blaze `aurastate`. */
export const BLAZE_STATE_ID_113C = 13
/** States.txt `enchant` (id 16, castoverlay=enchant, itemtype=weap, itemtrans=cred). */
export const ENCHANT_STATE_ID_113C = 16
/** States.txt `chillingarmor` (id 20, cltevent=hitbymissile, clteventfunc=1). */
export const CHILLINGARMOR_STATE_ID_113C = 20
/** States.txt `stunned` (id 21, overlay1=stun). */
export const STUNNED_STATE_ID_113C = 21

/**
 * `Skills.txt` #41 (`Inferno`): `Param1 = 20` (Minimum Range), `Param2 = 3` (Range per level),
 * `calc1 = ln12/2` (Actual Range in frames, overriding `Missiles.txt` `infernoflame1/2` `Range = 30`).
 */
export function infernoFlameRangeFrames113c(skillLevel: number): number {
  const lvl = Number.isFinite(skillLevel) ? Math.max(1, Math.floor(skillLevel)) : 1
  return Math.max(1, Math.trunc(computeLinearScaling(20, 3, lvl) / 2))
}

/**
 * `Skills.txt` #230 (`Arctic Blast`): `Param1 = 35` (base ranged doubled), `Param2 = 6` (level range doubled),
 * `calc1 = ln12/2` (Actual Range in frames, overriding `Missiles.txt` `arcticblast1/2` `Range = 30`;
 * `aurarangecalc = ln12/4-2` is the attack range in sub-tiles).
 */
export function arcticBlastRangeFrames113c(skillLevel: number): number {
  const s = Number.isFinite(skillLevel) ? Math.max(1, Math.floor(skillLevel)) : 1
  return Math.max(1, Math.floor((35 + (s - 1) * 6) / 2))
}

/**
 * Canonical 1.13c `Missiles.txt` rows with `ReturnFire = 1` (used by `States.txt` row 20
 * `chillingarmor` `cltevent = hitbymissile` / `clteventfunc = 1`).
 * Note: `chillingarmorbolt` (#264) has `ReturnFire = 0` to prevent infinite retaliation loops.
 */
export const MISSILE_RETURN_FIRE_113C: ReadonlySet<string> = new Set<string>([
  'arrow', 'javelin', 'bighead1', 'bighead2', 'bighead3', 'bighead4', 'bighead5',
  'spike1', 'spike2', 'spike3', 'spike4', 'spike5', 'firearrow',
  'cr_arrow1', 'cr_arrow2', 'cr_arrow3', 'cr_arrow4', 'cr_arrow5',
  'shafire1', 'shafire2', 'shafire3', 'shafire4', 'shafire5',
  'magicarrow', 'icearrow', 'bolt', 'andarielspray', 'throwaxe', 'throwknife', 'glaive',
  'poisonjav', 'coldarrow', 'explodingarrow', 'plaguejavelin',
  'oilpotion', 'explosivepotion', 'fulminatingpotion',
  'rancidgasepotion', 'chokinggaspoition', 'stranglinggaspotion', 'notused50',
  'holybolt', 'chargedbolt', 'firebolt', 'icebolt', 'fireball',
  'goospit1', 'goospit2', 'goospit3', 'goospit4', 'goospit5', 'goosplat',
  'unholybolt1', 'unholybolt2', 'unholybolt3', 'unholybolt4',
  'immolationarrow', 'guidedarrow', 'freezingarrow', 'nova', 'iceblast',
  'blessedhammer', 'chainlightning', 'glacialspike', 'lightningbolt', 'meteorexplode',
  'monbliz1', 'monbliz2', 'monbliz3', 'monbliz4',
  'teeth', 'corpseexplosion', 'poisoncorpseexplosion', 'monstercorpseexplode',
  'poisonnova', 'frostnova', 'rogue1', 'rogue2', 'rogue3', 'bat lightning bolt',
  'skmage1', 'skmage2', 'skmage3', 'skmage4', 'vampirefireball', 'vampiremeteorexp',
  'raven1', 'raven2', 'amphibiangoo1', 'amphibiangoo2', 'tentaclegoo',
  'blizzard1', 'blizzard2', 'blizzard3', 'blizzard4',
  'thunderstorm1', 'thunderstorm2', 'thunderstorm3', 'thunderstorm4',
  'handofgod', 'fingermagespider', 'electric throwaxe', 'bonespear', 'bonespirit',
  'coldunique', 'lightunique', 'skbowarrow1', 'skbowarrow2', 'skbowarrow3', 'skbowarrow4', 'skbowarrow5',
  'nova1', 'nova2', 'andypoisonbolt', 'lightningjavelin', 'lightningfury',
  'necromage1', 'necromage2', 'necromage3', 'necromage4',
  'multipleshotarrow', 'multipleshotbolt', 'chargedstrikebolt', 'buglightning',
  'pantherjav1', 'pantherjav2', 'pantherjav3', 'pantherjav4',
  'furylightning', 'lightningstrike', 'fistoftheheavensbolt',
  'pantherpotorange', 'pantherpotgreen',
  'trap spike right', 'trap spike left', 'trap cursed skull right', 'trap cursed skull left',
  'trap poison ball right', 'trap poison ball left',
  'hydra', 'frozenorb', 'frozenorbbolt', 'frozenorbnova', 'blowgun', 'chainlightning2',
  'monglacialspike', 'mephisto', 'firehead', 'arcanelightningbolt',
  'frogfire', 'frogcold', 'frogpois', 'desertfireball', 'brdeathlightningbolt',
  'willowisplightningbolt', 'queenpoisoncloud',
  'undeadmissile1', 'undeadmissile2', 'undeadmissile3', 'undeadmissile4',
  'monbonespirit', 'regurgitatorcorpse', 'highpriestlightning', 'pilum',
  'cairn stones bolt', 'bomb on ground', 'bomb explosion', 'throwingstar', 'acidspray',
  'baallightningbolt', 'baallightningbolt2', 'impfireball', 'impfireballexplode',
  'catapultchargedballbolt', 'imp spawn monsters', 'catapult spike explosion',
  'suicidecorpseexplode', 'suicidefireexplode', 'suicideiceexplode',
  'explodingjavalin', 'lightingtrailingjavalin', 'lightjavalintrail', 'lightjavalinexplosion',
  'icejavalin', 'plaguejavelin2', 'advlighttrailingjav', 'advlighttrailingjav2', 'advlightjavexplode',
  'sucfireball', 'sucfireballtrail', 'sucshockfieldmissile', 'sucshockfield', 'imp charged bolt',
  'moltenboulder', 'moltenboulderexplode', 'erruption crack 1', 'erruption crack 2',
  'twister', 'tornado', 'volcano debris 2', 'volcano small fire', 'dragonbreath missile',
  'impmiss1', 'impmiss2', 'impmiss3', 'impmiss4', 'impmiss5',
  'frozenhorror arcticblast1', 'frozenhorror arcticblast2', 'sentrychargedbolt', 'recycler explosion',
  'bladefury1', 'bladefragment1', 'bladefury2', 'bladefragment2', 'bladefury3', 'bladefragment3',
  'shockwave', 'lightningtalons', 'tigerfury', 'ancient throwing axe', 'sentrylightningbolt',
  'dragonflight', 'dragonflightmaker', 'progressive radius damage',
  'vine beast walk 1 fade', 'vine beast walk 2 fade', 'vine beast neutral fade',
  'lightning charge up nova', 'chainlightningcharge up',
  'baal taunt lightning', 'baal taunt lightning trail', 'baal spawn monsters',
  'blade shield missile', 'baal nova', 'clawsofthunderbolt', 'clawsofthundernova',
  'royalstrikemeteorexplode', 'royalstrikechainlightning', 'royalstrikechaosice',
  'highpriestlightning2', 'baalcorpseexplodedelay', 'baalcorpseexplodeexpl',
  'baal cold maker', 'baal cold trail', 'baal spawn monsters exp',
  'impmiss21', 'impmiss22', 'impmiss23', 'impmiss24', 'impmiss25',
  'blessedhammerex', 'sentrylightningbolt2', 'lightningtowernova',
  'skbowarrow6', 'skbowarrow7', 'skbowarrow8', 'bighead6',
  'viper_poisjav', 'viper_fire', 'viper_bonespear', 'pantherjav5', 'spike6', 'cr_arrow6',
  'skmagepois', 'skmagecold', 'skmagefire', 'skmageltng', 'succubusmiss',
  'willowisplightningbolt2', 'goospitex', 'impmissex', 'trapfirebolt', 'trapnova',
  'mephfrostnova', 'strafearrow', 'strafebolt',
])

export function isReturnFireMissile113c(missileKey: string | undefined): boolean {
  if (!missileKey) return false
  return MISSILE_RETURN_FIRE_113C.has(missileKey.trim().toLowerCase())
}

/** Skills.txt #46 Blaze Param1 / Param2 (auralencalc = dm12). */
const BLAZE_PARAM1_113C = 50
const BLAZE_PARAM2_113C = 500

/** Blaze state duration in frames: Skills.txt #46 auralencalc `dm12` = diminishing(Param1=50, Param2=500, lvl). */
export function blazeStateDurationFrames113c(skillLevel: number): number {
  const lvl = Number.isFinite(skillLevel) ? Math.max(1, Math.floor(skillLevel)) : 1
  return computeDiminishingReturns(BLAZE_PARAM1_113C, BLAZE_PARAM2_113C, lvl)
}

/** Skills.txt #154 War Cry Param1 / Param2: stun length = Param1 + (lvl - 1) * Param2 frames. */
const WARCRY_STUN_PARAM1_113C = 25
const WARCRY_STUN_PARAM2_113C = 5

/**
 * War Cry stun length in frames (D2MOO MissMode.cpp SrvDmg07_Warcry_ShockWave:
 * `dwStunLen = Param1 + (lvl - 1) * Param2`, 25 + 5/lvl).
 */
export function warCryStunFrames113c(skillLevel: number): number {
  const lvl = Number.isFinite(skillLevel) ? Math.max(1, Math.floor(skillLevel)) : 1
  return computeLinearScaling(WARCRY_STUN_PARAM1_113C, WARCRY_STUN_PARAM2_113C, lvl)
}

/** Hurricane (#250) cold length: Skills.txt ELen=50, ELevLen1..3 empty (3-band elemental length). */
export function hurricaneColdFrames113c(skillLevel: number): number {
  const lvl = Number.isFinite(skillLevel) ? Math.max(1, Math.floor(skillLevel)) : 1
  return compute3BandDuration(lvl, 50, 0, 0, 0)
}

/** Arctic Blast (#230) cold length: Skills.txt ELen=100, ELevLen1..3 = 15 (3-band elemental length). */
export function arcticBlastColdFrames113c(skillLevel: number): number {
  const lvl = Number.isFinite(skillLevel) ? Math.max(1, Math.floor(skillLevel)) : 1
  return compute3BandDuration(lvl, 100, 15, 15, 15)
}

interface PredictedStateUnit {
  readonly states: { has(stateId: number): boolean; add(stateId: number): void; remove(stateId: number): void }
  predictedStateUntilTick?: Map<number, number> | undefined
}

/**
 * Sets a client-predicted timed state ending at `untilTick`. A state the server already set (present without a
 * prediction entry) keeps its server-owned lifetime and is left untouched.
 */
export function addPredictedTimedState113c(unit: PredictedStateUnit, stateId: number, untilTick: number): void {
  const predicted = unit.predictedStateUntilTick
  if (unit.states.has(stateId) && !(predicted?.has(stateId) ?? false)) return
  const map = predicted ?? new Map<number, number>()
  unit.predictedStateUntilTick = map
  map.set(stateId, Math.max(map.get(stateId) ?? 0, untilTick))
  unit.states.add(stateId)
}

/** Ends every predicted state whose frame budget elapsed. */
export function expirePredictedStates113c(unit: PredictedStateUnit, frameCount: number): void {
  const map = unit.predictedStateUntilTick
  if (map === undefined || map.size === 0) return
  for (const [stateId, until] of map) {
    if (frameCount >= until) {
      map.delete(stateId)
      unit.states.remove(stateId)
    }
  }
}

/** Server 0xA8 / 0xA9 for `stateId`: the server owns the lifetime from now on. */
export function releasePredictedState113c(unit: PredictedStateUnit, stateId: number): void {
  unit.predictedStateUntilTick?.delete(stateId)
}
