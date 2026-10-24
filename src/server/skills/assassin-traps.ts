/**
 * @fileoverview 1.13c Ground Truth calculators and constants for Assassin Traps
 * (#251-#277 and sentry sub-skills #281, #306, #311, #312, #313, #324).
 *
 * Strictly aligned with Skills.txt, Missiles.txt, MonStats.txt, and D2Game.dll.
 */

export const ASSASSIN_TRAP_SKILL_IDS = [
  251, // Fire Blast (Fire Trauma)
  256, // Shock Web
  257, // Blade Sentinel
  261, // Charged Bolt Sentry
  262, // Wake of Fire (Wake of Fire Sentry)
  266, // Blade Fury
  271, // Lightning Sentry
  272, // Wake of Inferno (Inferno Sentry)
  276, // Death Sentry
  277, // Blade Shield
] as const;

export const ASSASSIN_GROUND_SENTRY_SKILL_IDS = [261, 262, 271, 272, 276] as const;

export const ASSASSIN_MAX_ACTIVE_SENTRIES = 5;

export interface TrapBandCurve113c {
  hitShift: number;
  eMin: number;
  eMinLev: readonly [number, number, number, number, number];
  eMax: number;
  eMaxLev: readonly [number, number, number, number, number];
}

/**
 * Evaluates 1.13c 5-band progressive curve (1, 2-8, 9-16, 17-22, 23-28, 29+)
 * and applies HitShift: floor(raw * 2^hitShift / 256).
 */
export function evaluateTrapBand113c(
  base: number,
  bands: readonly [number, number, number, number, number],
  slvl: number,
  hitShift = 8,
): number {
  const lvl = Math.max(1, Math.floor(slvl));
  const [b1, b2, b3, b4, b5] = bands;
  let raw = base;
  if (lvl > 1) raw += Math.min(lvl - 1, 7) * b1;
  if (lvl > 8) raw += Math.min(lvl - 8, 8) * b2;
  if (lvl > 16) raw += Math.min(lvl - 16, 6) * b3;
  if (lvl > 22) raw += Math.min(lvl - 22, 6) * b4;
  if (lvl > 28) raw += (lvl - 28) * b5;
  const scale = hitShift >= 8 ? (1 << (hitShift - 8)) : 1 / (1 << (8 - hitShift));
  return Math.floor(raw * scale);
}

/**
 * 1.13c Skills.txt elementary curves for Assassin Traps & Sentry Sub-Skills.
 */
export const ASSASSIN_TRAP_CURVES_113C: Record<number, TrapBandCurve113c> = {
  // #251 Fire Blast (Fire Trauma): HitShift=7, EMin=6, Lev=[3,8,20,38,58], EMax=8, Lev=[5,11,24,44,66]
  251: {
    hitShift: 7,
    eMin: 6,
    eMinLev: [3, 8, 20, 38, 58],
    eMax: 8,
    eMaxLev: [5, 11, 24, 44, 66],
  },
  // #256 Shock Web (Shock Field): HitShift=7, EMin=2, EMinLev=[0,0,0,0,0], EMax=20, EMaxLev=[6,12,20,30,42]
  256: {
    hitShift: 7,
    eMin: 2,
    eMinLev: [0, 0, 0, 0, 0],
    eMax: 20,
    eMaxLev: [6, 12, 20, 30, 42],
  },
  // #257 Blade Sentinel: HitShift=8, MinDam=6, MinLevDam=[3,4,5,5,5], MaxDam=10, MaxLevDam=[3,4,5,5,5]
  257: {
    hitShift: 8,
    eMin: 6,
    eMinLev: [3, 4, 5, 5, 5],
    eMax: 10,
    eMaxLev: [3, 4, 5, 5, 5],
  },
  // #261 Charged Bolt Sentry (sub-skill #306): HitShift=7, EMin=2, Lev=[0,0,0,0,0], EMax=14, Lev=[6,8,12,14,16]
  261: {
    hitShift: 7,
    eMin: 2,
    eMinLev: [0, 0, 0, 0, 0],
    eMax: 14,
    eMaxLev: [6, 8, 12, 14, 16],
  },
  // #262 Wake of Fire (sub-skill #281): HitShift=8, EMin=5, Lev=[2,3,5,7,9], EMax=10, Lev=[2,3,6,8,10]
  262: {
    hitShift: 8,
    eMin: 5,
    eMinLev: [2, 3, 5, 7, 9],
    eMax: 10,
    eMaxLev: [2, 3, 6, 8, 10],
  },
  // #266 Blade Fury: HitShift=8, MinDam=8, MinLevDam=[3,5,8,8,8], MaxDam=10, MaxLevDam=[3,5,8,8,8]
  266: {
    hitShift: 8,
    eMin: 8,
    eMinLev: [3, 5, 8, 8, 8],
    eMax: 10,
    eMaxLev: [3, 5, 8, 8, 8],
  },
  // #271 Lightning Sentry (sub-skill #313): HitShift=8, EMin=1, Lev=[0,0,0,0,0], EMax=20, Lev=[10,16,24,34,44]
  271: {
    hitShift: 8,
    eMin: 1,
    eMinLev: [0, 0, 0, 0, 0],
    eMax: 20,
    eMaxLev: [10, 16, 24, 34, 44],
  },
  // #272 Wake of Inferno (sub-skill #311): HitShift=4, EMin=20, Lev=[17,21,26,32,39], EMax=50, Lev=[19,23,28,34,41]
  272: {
    hitShift: 4,
    eMin: 20,
    eMinLev: [17, 21, 26, 32, 39],
    eMax: 50,
    eMaxLev: [19, 23, 28, 34, 41],
  },
  // #276 Death Sentry (sub-skill #324): HitShift=8, EMin=1, Lev=[0,0,0,0,0], EMax=50, Lev=[8,14,22,28,34]
  276: {
    hitShift: 8,
    eMin: 1,
    eMinLev: [0, 0, 0, 0, 0],
    eMax: 50,
    eMaxLev: [8, 14, 22, 28, 34],
  },
  // #277 Blade Shield: HitShift=8, MinDam=1, MinLevDam=[5,6,7,7,7], MaxDam=30, MaxLevDam=[5,6,7,7,7]
  277: {
    hitShift: 8,
    eMin: 1,
    eMinLev: [5, 6, 7, 7, 7],
    eMax: 30,
    eMaxLev: [5, 6, 7, 7, 7],
  },
};

export interface AssassinTrapSynergyBlvls {
  fireBlastBlvl?: number; // #251
  shockWebBlvl?: number; // #256
  chargedBoltSentryBlvl?: number; // #261
  wakeOfFireBlvl?: number; // #262
  lightningSentryBlvl?: number; // #271
  wakeOfInfernoBlvl?: number; // #272
  deathSentryBlvl?: number; // #276
}

/**
 * #251 Fire Blast (火焰爆震):
 * - Damage: Fire, +9% per blvl of #256, #261, #262, #271, #272, #276
 * - Explosion radius: 3 sub-tiles (2 yards)
 * - Mana: 3 + 0.125 * (slvl - 1)
 */
export function calcFireBlast113c(slvl: number, synergies: AssassinTrapSynergyBlvls = {}) {
  const c = ASSASSIN_TRAP_CURVES_113C[251];
  const baseMin = evaluateTrapBand113c(c.eMin, c.eMinLev, slvl, c.hitShift);
  const baseMax = evaluateTrapBand113c(c.eMax, c.eMaxLev, slvl, c.hitShift);
  const totalBlvl =
    (synergies.shockWebBlvl ?? 0) +
    (synergies.chargedBoltSentryBlvl ?? 0) +
    (synergies.wakeOfFireBlvl ?? 0) +
    (synergies.lightningSentryBlvl ?? 0) +
    (synergies.wakeOfInfernoBlvl ?? 0) +
    (synergies.deathSentryBlvl ?? 0);
  const synPct = totalBlvl * 9;
  const minDmg = Math.max(1, Math.floor((baseMin * (100 + synPct)) / 100));
  const maxDmg = Math.max(minDmg, Math.floor((baseMax * (100 + synPct)) / 100));
  return {
    minDmg,
    maxDmg,
    synPct,
    explosionRadiusSubtiles: 3,
    manaCost: 3 + 0.125 * Math.max(0, slvl - 1),
    cooldownTicks: 0,
  };
}

/**
 * #256 Shock Web (雷电网):
 * - Spike count: 6 + floor(slvl / 4) + floor(FireBlast.blvl / 3)
 * - Damage: Lightning, +11% per blvl of #261, #271, #276
 * - Ground duration: 90 frames (3.6s), NextDelay: 25 frames (1.0s)
 * - Cooldown: 15 frames (0.6s), Mana: 6
 */
export function calcShockWeb113c(slvl: number, synergies: AssassinTrapSynergyBlvls = {}) {
  const c = ASSASSIN_TRAP_CURVES_113C[256];
  const baseMin = evaluateTrapBand113c(c.eMin, c.eMinLev, slvl, c.hitShift);
  const baseMax = evaluateTrapBand113c(c.eMax, c.eMaxLev, slvl, c.hitShift);
  const totalBlvl =
    (synergies.chargedBoltSentryBlvl ?? 0) +
    (synergies.lightningSentryBlvl ?? 0) +
    (synergies.deathSentryBlvl ?? 0);
  const synPct = totalBlvl * 11;
  const minDmg = Math.max(1, Math.floor((baseMin * (100 + synPct)) / 100));
  const maxDmg = Math.max(minDmg, Math.floor((baseMax * (100 + synPct)) / 100));
  const spikeCount =
    6 + Math.floor(Math.max(1, slvl) / 4) + Math.floor((synergies.fireBlastBlvl ?? 0) / 3);
  return {
    minDmg,
    maxDmg,
    synPct,
    spikeCount,
    durationFrames: 90,
    nextDelayFrames: 25,
    cooldownTicks: 15,
    manaCost: 6,
  };
}

/**
 * #257 Blade Sentinel (刀刃守卫):
 * - Weapon fraction: SrcDam = 48 (3/8 1H), Half2HSrc = 1 -> SrcDam = 24 (3/16 2H)
 * - descdam = 5: both weapon physical and flat skill physical are scaled by effectiveSrcDam / 128
 * - Patrol duration: 100 frames (4s), NextDelay: 25 frames (1.0s), Cooldown: 50 frames (2.0s), Mana: 7
 */
export function calcBladeSentinel113c(
  slvl: number,
  weaponPhysMin = 0,
  weaponPhysMax = 0,
  isTwoHanded = false,
) {
  const c = ASSASSIN_TRAP_CURVES_113C[257];
  const rawFlatMin = evaluateTrapBand113c(c.eMin, c.eMinLev, slvl, c.hitShift);
  const rawFlatMax = evaluateTrapBand113c(c.eMax, c.eMaxLev, slvl, c.hitShift);
  const effectiveSrcDam = isTwoHanded ? 24 : 48;
  const scaledFlatMin = Math.floor((rawFlatMin * effectiveSrcDam) / 128);
  const scaledFlatMax = Math.floor((rawFlatMax * effectiveSrcDam) / 128);
  const totalMin = Math.floor(((weaponPhysMin + rawFlatMin) * effectiveSrcDam) / 128);
  const totalMax = Math.floor(((weaponPhysMax + rawFlatMax) * effectiveSrcDam) / 128);
  return {
    rawFlatMin,
    rawFlatMax,
    scaledFlatMin,
    scaledFlatMax,
    totalMin,
    totalMax,
    effectiveSrcDam,
    rangeFrames: 100,
    nextDelayFrames: 25,
    cooldownTicks: 50,
    manaCost: 7,
    missileName: 'blade creeper' as const,
    missileId: 392,
    hcIdx: 413,
  };
}

/**
 * #261 Charged Bolt Sentry (充能弹哨卫, sub-skill #306):
 * - Bolts per shot: 5 + floor(ShockWeb.blvl / 3)
 * - Shots: 5 + floor(LightningSentry.blvl / 4)
 * - Damage: Lightning, +6% per blvl of #251, #271, #276
 * - Missile: 'sentrychargedbolt' (#522, Vel=10, Range=80)
 * - MonStats hcIdx = 411 ('chargeboltsentry'), Mana: 13
 */
export function calcChargedBoltSentry113c(slvl: number, synergies: AssassinTrapSynergyBlvls = {}) {
  const c = ASSASSIN_TRAP_CURVES_113C[261];
  const baseMin = evaluateTrapBand113c(c.eMin, c.eMinLev, slvl, c.hitShift);
  const baseMax = evaluateTrapBand113c(c.eMax, c.eMaxLev, slvl, c.hitShift);
  const totalBlvl =
    (synergies.fireBlastBlvl ?? 0) +
    (synergies.lightningSentryBlvl ?? 0) +
    (synergies.deathSentryBlvl ?? 0);
  const synPct = totalBlvl * 6;
  const minDmg = Math.max(1, Math.floor((baseMin * (100 + synPct)) / 100));
  const maxDmg = Math.max(minDmg, Math.floor((baseMax * (100 + synPct)) / 100));
  const boltsPerShot = 5 + Math.floor((synergies.shockWebBlvl ?? 0) / 3);
  const totalShots = 5 + Math.floor((synergies.lightningSentryBlvl ?? 0) / 4);
  return {
    minDmg,
    maxDmg,
    synPct,
    boltsPerShot,
    totalShots,
    missileName: 'sentrychargedbolt' as const,
    hcIdx: 411,
    manaCost: 13,
  };
}

/**
 * #262 Wake of Fire (火焰复苏, sub-skill #281):
 * - Shots: 5 + floor(FireBlast.blvl / 3)
 * - Damage: Fire (HitShift=7), +8% per blvl of #251, #272
 * - Missiles: 'wake of destruction maker' (#517) -> 'wake of destruction' (#518, NextDelay=4)
 * - MonStats hcIdx = 410 ('wakeofdestruction'), Mana: 13
 */
export function calcWakeOfFire113c(slvl: number, synergies: AssassinTrapSynergyBlvls = {}) {
  const c = ASSASSIN_TRAP_CURVES_113C[262];
  const baseMin = evaluateTrapBand113c(c.eMin, c.eMinLev, slvl, c.hitShift);
  const baseMax = evaluateTrapBand113c(c.eMax, c.eMaxLev, slvl, c.hitShift);
  const totalBlvl = (synergies.fireBlastBlvl ?? 0) + (synergies.wakeOfInfernoBlvl ?? 0);
  const synPct = totalBlvl * 8;
  const minDmg = Math.max(1, Math.floor((baseMin * (100 + synPct)) / 100));
  const maxDmg = Math.max(minDmg, Math.floor((baseMax * (100 + synPct)) / 100));
  const totalShots = 5 + Math.floor((synergies.fireBlastBlvl ?? 0) / 3);
  return {
    minDmg,
    maxDmg,
    synPct,
    totalShots,
    nextDelayFrames: 4,
    missileName: 'wake of destruction' as const,
    makerMissileName: 'wake of destruction maker' as const,
    hcIdx: 410,
    manaCost: 13,
  };
}

/**
 * #266 Blade Fury (刀刃之怒):
 * - Weapon fraction: SrcDam = 96 (3/4 1H), Half2HSrc = 1 -> SrcDam = 48 (3/8 2H)
 * - descdam = 24: weapon physical is scaled by effectiveSrcDam / 128, then flat skill physical is added at 100% (unscaled!)
 * - Missile: single stream srvmissilea='bladefragment1' (#506), cltmissilea='bladefragment2' (#508), fire rate every 6 frames
 * - Mana: 1 + 0.125 * (slvl - 1) per shuriken
 */
export function calcBladeFury113c(
  slvl: number,
  weaponPhysMin = 0,
  weaponPhysMax = 0,
  isTwoHanded = false,
) {
  const c = ASSASSIN_TRAP_CURVES_113C[266];
  const flatMin = evaluateTrapBand113c(c.eMin, c.eMinLev, slvl, c.hitShift);
  const flatMax = evaluateTrapBand113c(c.eMax, c.eMaxLev, slvl, c.hitShift);
  const effectiveSrcDam = isTwoHanded ? 48 : 96;
  const weaponScaledMin = Math.floor((weaponPhysMin * effectiveSrcDam) / 128);
  const weaponScaledMax = Math.floor((weaponPhysMax * effectiveSrcDam) / 128);
  const totalMin = weaponScaledMin + flatMin;
  const totalMax = weaponScaledMax + flatMax;
  return {
    flatMin,
    flatMax,
    weaponScaledMin,
    weaponScaledMax,
    totalMin,
    totalMax,
    effectiveSrcDam,
    firePeriodFrames: 6,
    manaCost: 1 + 0.125 * Math.max(0, slvl - 1),
  };
}

/**
 * #271 Lightning Sentry (闪电哨卫, sub-skill #313):
 * - Shots: 10
 * - Damage: Lightning, +12% per blvl of #256, #261, #276
 * - Missile: 'sentrylightningbolt' (#526, Pierce = 1, NextDelay = 4)
 * - MonStats hcIdx = 412 ('lightningsentry'), Mana: 20
 */
export function calcLightningSentry113c(slvl: number, synergies: AssassinTrapSynergyBlvls = {}) {
  const c = ASSASSIN_TRAP_CURVES_113C[271];
  const baseMin = evaluateTrapBand113c(c.eMin, c.eMinLev, slvl, c.hitShift);
  const baseMax = evaluateTrapBand113c(c.eMax, c.eMaxLev, slvl, c.hitShift);
  const totalBlvl =
    (synergies.shockWebBlvl ?? 0) +
    (synergies.chargedBoltSentryBlvl ?? 0) +
    (synergies.deathSentryBlvl ?? 0);
  const synPct = totalBlvl * 12;
  const minDmg = Math.max(1, Math.floor((baseMin * (100 + synPct)) / 100));
  const maxDmg = Math.max(minDmg, Math.floor((baseMax * (100 + synPct)) / 100));
  return {
    minDmg,
    maxDmg,
    synPct,
    totalShots: 10,
    pierce: true,
    nextDelayFrames: 4,
    missileName: 'sentrylightningbolt' as const,
    hcIdx: 412,
    manaCost: 20,
  };
}

/**
 * #272 Wake of Inferno (地狱火复苏, sub-skill #311):
 * - Shots: 10
 * - Damage: Fire (HitShift=5), +10% per blvl of #251 Fire Blast & #276 Death Sentry (par7=10), +7% per blvl of #262 Wake of Fire (par8=7)
 * - Missile: 'inferno sentry 1' (#503)
 * - MonStats hcIdx = 415 ('infernosentry'), Mana: 20
 */
export function calcWakeOfInferno113c(slvl: number, synergies: AssassinTrapSynergyBlvls = {}) {
  const c = ASSASSIN_TRAP_CURVES_113C[272];
  const baseMin = evaluateTrapBand113c(c.eMin, c.eMinLev, slvl, c.hitShift);
  const baseMax = evaluateTrapBand113c(c.eMax, c.eMaxLev, slvl, c.hitShift);
  const synPct =
    ((synergies.fireBlastBlvl ?? 0) + (synergies.deathSentryBlvl ?? 0)) * 10 +
    (synergies.wakeOfFireBlvl ?? 0) * 7;
  const minDmg = Math.max(1, Math.floor((baseMin * (100 + synPct)) / 100));
  const maxDmg = Math.max(minDmg, Math.floor((baseMax * (100 + synPct)) / 100));
  return {
    minDmg,
    maxDmg,
    synPct,
    totalShots: 10,
    missileName: 'inferno sentry 1' as const,
    hcIdx: 415,
    manaCost: 20,
  };
}

/**
 * #276 Death Sentry (死亡哨卫, sub-skills #312 Sentry Corpse Explosion & #324 Death Sentry Ltng):
 * - Shots: 5 + floor(FireBlast.blvl / 3)
 * - Lightning Damage: +12% per blvl of #271 Lightning Sentry
 * - Corpse Explosion (#312): 70%–120% of corpse base max HP (50% Physical + 50% Fire),
 *   radius sub-tiles = floor((8 + slvl - 1) / 2)
 * - MonStats hcIdx = 416 ('deathsentry'), Mana: 20
 */
export function calcDeathSentry113c(slvl: number, synergies: AssassinTrapSynergyBlvls = {}) {
  const c = ASSASSIN_TRAP_CURVES_113C[276];
  const baseMin = evaluateTrapBand113c(c.eMin, c.eMinLev, slvl, c.hitShift);
  const baseMax = evaluateTrapBand113c(c.eMax, c.eMaxLev, slvl, c.hitShift);
  const synPct = (synergies.lightningSentryBlvl ?? 0) * 12;
  const minDmg = Math.max(1, Math.floor((baseMin * (100 + synPct)) / 100));
  const maxDmg = Math.max(minDmg, Math.floor((baseMax * (100 + synPct)) / 100));
  const totalShots = 5 + Math.floor((synergies.fireBlastBlvl ?? 0) / 3);
  const corpseExplosionRadiusSubtiles = Math.floor((8 + Math.max(1, slvl) - 1) / 2);
  return {
    minDmg,
    maxDmg,
    synPct,
    totalShots,
    corpseExplosionRadiusSubtiles,
    corpseHpPctMin: 70,
    corpseHpPctMax: 120,
    pierce: true,
    nextDelayFrames: 4,
    missileName: 'sentrylightningbolt' as const,
    hcIdx: 416,
    manaCost: 20,
  };
}

/**
 * #277 Blade Shield (刀刃之盾):
 * - Weapon fraction: SrcDam = 32 (1/4), Half2HSrc = 0 (always 1/4 for both 1H and 2H)
 * - descdam = 5: both weapon physical and flat skill physical are scaled by 32 / 128
 * - Duration: 500 + 125 * (slvl - 1) frames (20s + 5s per level)
 * - Periodic pulse: perdelay = 25 frames (1.0s), radius = `aurarangecalc = par4` = 6 sub-tiles
 *   (`samples/d2/excel/Skills.txt` #277 Param4; SrvDo054 0x6FCB3508 reads `[skill+0x64]`)
 * - Mana: 27 + 2 * (slvl - 1)
 */
export function calcBladeShield113c(
  slvl: number,
  weaponPhysMin = 0,
  weaponPhysMax = 0,
) {
  const c = ASSASSIN_TRAP_CURVES_113C[277];
  const rawFlatMin = evaluateTrapBand113c(c.eMin, c.eMinLev, slvl, c.hitShift);
  const rawFlatMax = evaluateTrapBand113c(c.eMax, c.eMaxLev, slvl, c.hitShift);
  const effectiveSrcDam = 32;
  const scaledFlatMin = Math.floor((rawFlatMin * effectiveSrcDam) / 128);
  const scaledFlatMax = Math.floor((rawFlatMax * effectiveSrcDam) / 128);
  const totalMin = Math.floor(((weaponPhysMin + rawFlatMin) * effectiveSrcDam) / 128);
  const totalMax = Math.floor(((weaponPhysMax + rawFlatMax) * effectiveSrcDam) / 128);
  return {
    rawFlatMin,
    rawFlatMax,
    scaledFlatMin,
    scaledFlatMax,
    totalMin,
    totalMax,
    effectiveSrcDam,
    durationFrames: 500 + 125 * Math.max(0, slvl - 1),
    perDelayFrames: 25,
    radiusSubtiles: 6,
    manaCost: 27 + 2 * Math.max(0, slvl - 1),
  };
}

/**
 * Helper to compute sentry sub-skill damage from owner base skill levels (1.13c).
 */
export function calcSentrySubSkillDamage113c(
  subSkillId: number,
  slvl: number,
  getOwnerBlvl: (skillId: number) => number,
): { minDmg: number; maxDmg: number; elemType: 'fire' | 'ltng' } {
  const synergies: AssassinTrapSynergyBlvls = {
    fireBlastBlvl: getOwnerBlvl(251),
    shockWebBlvl: getOwnerBlvl(256),
    chargedBoltSentryBlvl: getOwnerBlvl(261),
    wakeOfFireBlvl: getOwnerBlvl(262),
    lightningSentryBlvl: getOwnerBlvl(271),
    wakeOfInfernoBlvl: getOwnerBlvl(272),
    deathSentryBlvl: getOwnerBlvl(276),
  };
  switch (subSkillId) {
    case 306: // Charged Bolt Sentry
    case 261: {
      const r = calcChargedBoltSentry113c(slvl, synergies);
      return { minDmg: r.minDmg, maxDmg: r.maxDmg, elemType: 'ltng' };
    }
    case 281: // Wake of Fire
    case 262: {
      const r = calcWakeOfFire113c(slvl, synergies);
      return { minDmg: r.minDmg, maxDmg: r.maxDmg, elemType: 'fire' };
    }
    case 313: // Lightning Sentry
    case 271: {
      const r = calcLightningSentry113c(slvl, synergies);
      return { minDmg: r.minDmg, maxDmg: r.maxDmg, elemType: 'ltng' };
    }
    case 311: // Wake of Inferno
    case 272: {
      const r = calcWakeOfInferno113c(slvl, synergies);
      return { minDmg: r.minDmg, maxDmg: r.maxDmg, elemType: 'fire' };
    }
    case 324: // Death Sentry Lightning
    case 276: {
      const r = calcDeathSentry113c(slvl, synergies);
      return { minDmg: r.minDmg, maxDmg: r.maxDmg, elemType: 'ltng' };
    }
    default:
      return { minDmg: 1, maxDmg: 10, elemType: 'ltng' };
  }
}
