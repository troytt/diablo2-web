/**
 * Offline Missile Asset & Data Baking Script.
 *
 * Extracts authentic Diablo II v1.13c missile DCC sprites from MPQ archives:
 * - Fire: Firebolt, Fireball, FireArrowExplode2
 * - Cold: Icebolt, IceBlast, GlacialSpike, IceArrowExplode, FreezeExplodeCenter
 * - Lightning: ChargedBolt
 * - Necromancer: teethMissile, teethexplode, BoneSpear, BoneSpirit, BoneSpiritExplode, poisonNova
 * - Paladin: HolyBoltMissile, blessedhammer
 * - Amazon: SafeArrow, FireArrow, IceArrow, Arrow, LightningJavelin
 *
 * Bakes them into indexed-color PNG atlases and JSON metadata under:
 * - public/missiles/
 * - samples/d2-packs/missiles/
 *
 * And generates typed metadata in src/render/missiles-meta.ts.
 * Enforces Zero Runtime MPQ/DLL Architectural Invariant.
 */

import { copyFileSync, linkSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { MpqArchive } from '../../common/mpq/archive.ts'
import { fileSource } from '../io/file-source.ts'
import { decodeDcc } from '../../common/formats/dcc.ts'
import { decodePl2 } from '../../common/formats/pl2.ts'
import { encodeRgbaPng } from '../io/png.ts'
import type { SpriteFrame, SpriteSheet } from '../../common/formats/sprite.ts'
import { missileTransToDrawBlend } from '../../common/gfx/draw-mode.ts'
import { CANONICAL_113C_MISSILES } from '../../common/skills/missiles-data.ts'

export interface MissileFrameMeta {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly anchorX: number
  readonly anchorY: number
}

export type MissileFrameTuple = readonly [
  x: number,
  y: number,
  width: number,
  height: number,
  anchorX: number,
  anchorY: number,
]

export interface MissileMeta {
  readonly name: string
  readonly celFile: string
  readonly width: number
  readonly height: number
  readonly directions: number
  readonly framesPerDirection: number
  readonly animSpeed: number
  readonly trans?: number
  readonly blendMode?: string
  readonly groups: readonly (readonly MissileFrameTuple[])[]
}

const MISSILE_TARGETS = [
  // Fire spells & explosions
  { name: 'firebolt', celFile: 'Firebolt', animSpeed: 16, trans: 1 },
  { name: 'fireball', celFile: 'Fireball', animSpeed: 16, trans: 1 },
  { name: 'fireexplode', celFile: 'FireArrowExplode2', animSpeed: 16, trans: 1 },

  // Ice spells & explosions
  { name: 'icebolt', celFile: 'Icebolt', animSpeed: 16, trans: 1 },
  { name: 'iceblast', celFile: 'IceBlast', animSpeed: 16, trans: 1 },
  { name: 'glacialspike', celFile: 'GlacialSpike', animSpeed: 16, trans: 1 },
  { name: 'iceexplode', celFile: 'IceArrowExplode', animSpeed: 16, trans: 1 },
  { name: 'freezingarrowexp1', celFile: 'FreezeExplodeCenter', animSpeed: 16, trans: 1 },
  { name: 'frozenorb', celFile: 'IceOrb', animSpeed: 16, trans: 1 },
  { name: 'frozenorbexplode', celFile: 'IceOrbExplode', animSpeed: 16, trans: 1 },
  { name: 'blizzard1', celFile: 'icestormfallvar01', animSpeed: 16, trans: 1 },
  { name: 'blizzard2', celFile: 'icestormfallvar02', animSpeed: 16, trans: 1 },
  { name: 'blizzard3', celFile: 'Blizzard', animSpeed: 16, trans: 1 },
  { name: 'blizzardexplode1', celFile: 'icestormimpactvar01', animSpeed: 16, trans: 1 },
  { name: 'blizzardexplode2', celFile: 'icestormimpactvar02', animSpeed: 16, trans: 1 },
  { name: 'icebreaksmall', celFile: 'IceBreakSmall', animSpeed: 16, trans: 1 },
  { name: 'icebreaksmallmelt', celFile: 'IceBreakSmallMelt', animSpeed: 16, trans: 1 },

  // Lightning
  { name: 'chargedbolt', celFile: 'ChargedBolt', animSpeed: 16, trans: 1 },

  // Necromancer
  { name: 'teeth', celFile: 'teethMissile', animSpeed: 16, trans: 1 },
  { name: 'teethexplode', celFile: 'teethexplode', animSpeed: 16, trans: 1 },
  { name: 'bonespear', celFile: 'BoneSpear', animSpeed: 16, trans: 1 }, // Missiles.txt #192 Trans=1 (Issue #993 item 9)
  { name: 'bonespirit', celFile: 'BoneSpirit', animSpeed: 16, trans: 1 },
  { name: 'bonespiritexplode', celFile: 'BoneSpiritExplode', animSpeed: 16, trans: 1 },
  { name: 'poisonnova', celFile: 'poisonNova', animSpeed: 16, trans: 1 },
  { name: 'corpseexplosion', celFile: 'CorpseExplodeGuts', animSpeed: 16, trans: 0 },
  { name: 'poisoncorpseexplosion', celFile: 'CorpseExplodeGutsPoison', animSpeed: 16, trans: 0 },
  { name: 'poisonexplosioncloud', celFile: 'PoisonSparks', animSpeed: 16, trans: 1 },
  { name: 'poisonpuff', celFile: 'PoisonSmokePuff', animSpeed: 16, trans: 1 },
  { name: 'cursecast', celFile: 'CurseCast', animSpeed: 16, trans: 1 },
  { name: 'curseall', celFile: 'CurseArea', animSpeed: 16, trans: 1 },
  { name: 'bonecast', celFile: 'BoneCast', animSpeed: 16, trans: 1 },
  { name: 'bonespeartrail', celFile: 'BoneSpearTrail', animSpeed: 16, trans: 1 },
  { name: 'revive', celFile: 'Revive', animSpeed: 16, trans: 1 },
  // Missiles.txt 1.13c #208..#211 CelFile (elements poison/cold/fire/lightning, all Trans=1).
  { name: 'necromage1', celFile: 'poisonNova', animSpeed: 16, trans: 1 },
  { name: 'necromage2', celFile: 'Icebolt', animSpeed: 16, trans: 1 },
  { name: 'necromage3', celFile: 'Firebolt', animSpeed: 16, trans: 1 },
  { name: 'necromage4', celFile: 'ChargedBolt', animSpeed: 16, trans: 1 },
  { name: 'bigblood1', celFile: 'BloodLarge01', animSpeed: 16, trans: 0 },
  { name: 'bigblood2', celFile: 'BloodLarge02', animSpeed: 16, trans: 0 },

  // Paladin
  { name: 'holybolt', celFile: 'HolyBoltMissile', animSpeed: 16, trans: 1 },
  { name: 'blessedhammer', celFile: 'blessedhammer', animSpeed: 16, trans: 1 },
  { name: 'fistoftheheavensbolt', celFile: 'HolyBoltMissile', animSpeed: 16, trans: 1 },
  { name: 'fistofares', celFile: 'FOAorbiter', animSpeed: 16, trans: 1 },
  { name: 'blessedhammerex', celFile: 'blessedhammer', animSpeed: 16, trans: 1 },
  { name: 'blood1', celFile: 'BloodSmall01', animSpeed: 16, trans: 0 },
  { name: 'blood2', celFile: 'BloodSmall02', animSpeed: 16, trans: 0 },
  { name: 'redemption', celFile: 'RedemptionGhost', animSpeed: 16, trans: 1 },
  { name: 'handofgod', celFile: 'LightningBolt', animSpeed: 16, trans: 1 },

  // Amazon
  { name: 'magicarrow', celFile: 'SafeArrow', animSpeed: 16, trans: 1 },
  { name: 'firearrow', celFile: 'FireArrow', animSpeed: 16, trans: 1 },
  { name: 'icearrow', celFile: 'IceArrow', animSpeed: 16, trans: 1 },
  { name: 'arrow', celFile: 'Arrow', animSpeed: 16, trans: 0 },
  { name: 'bolt', celFile: 'XBowBolt', animSpeed: 16, trans: 0 },

  // Inherent throw skills (2/4): weapon-dependent missiles, Trans 0 (physical).
  // Plain 'javelin' is already served by the 'poisonjav' entry's Javelin celFile alias.
  { name: 'throwknife', celFile: 'MissileDagger', animSpeed: 16, trans: 0 },
  { name: 'throwaxe', celFile: 'MissileHandAxe', animSpeed: 16, trans: 0 },

  // Throwing potions (Weapons.txt tpot, Missiles.txt ids 44..49; Trans 0 physical)
  { name: 'oilpotion', celFile: 'mslops', animSpeed: 16, trans: 0 },
  { name: 'explosivepotion', celFile: 'mslopm', animSpeed: 16, trans: 0 },
  { name: 'fulminatingpotion', celFile: 'mslopl', animSpeed: 16, trans: 0 },
  { name: 'rancidgasepotion', celFile: 'mslgps', animSpeed: 16, trans: 0 },
  { name: 'chokinggaspoition', celFile: 'mslgpm', animSpeed: 16, trans: 0 },
  { name: 'stranglinggaspotion', celFile: 'mslgpl', animSpeed: 16, trans: 0 },

  // Amazon
  { name: 'lightningjavelin', celFile: 'LightningJavelin', animSpeed: 16, trans: 1 },
  { name: 'coldarrow', celFile: 'IceArrow', animSpeed: 16, trans: 1 },
  { name: 'explodingarrow', celFile: 'FireArrow', animSpeed: 16, trans: 1 },
  { name: 'explodingarrowexp', celFile: 'ExpArrowExplode', animSpeed: 16, trans: 1 },
  { name: 'icearrowexplode', celFile: 'IceArrowExplode', animSpeed: 16, trans: 1 },
  { name: 'freezingarrow', celFile: 'IceArrow', animSpeed: 16, trans: 1 },
  { name: 'guidedarrow', celFile: 'SafeArrow', animSpeed: 16, trans: 1 },
  { name: 'strafearrow', celFile: 'Arrow', animSpeed: 16, trans: 0 },
  { name: 'strafebolt', celFile: 'XBowBolt', animSpeed: 16, trans: 0 },
  { name: 'immolationarrow', celFile: 'FireArrow', animSpeed: 16, trans: 1 },
  { name: 'immolationfire', celFile: 'groundFireBig', animSpeed: 16, trans: 1 },
  { name: 'poisonjav', celFile: 'Javelin', animSpeed: 16, trans: 0 },
  { name: 'poisonjavcloud', celFile: 'PoisonSparks', animSpeed: 16, trans: 1 },
  { name: 'chargedstrikebolt', celFile: 'ChargedBolt', animSpeed: 16, trans: 1 },
  { name: 'plaguejavelin', celFile: 'Javelin', animSpeed: 16, trans: 0 },
  { name: 'plaguejavcloud', celFile: 'PoisonSparks', animSpeed: 16, trans: 1 },
  { name: 'lightningfury', celFile: 'LightningJavelin', animSpeed: 16, trans: 1 },
  { name: 'furylightning', celFile: 'LightningStrike', animSpeed: 16, trans: 1 },

  // Meteor (Skill 56)
  { name: 'meteor', celFile: 'Meteor', animSpeed: 16, trans: 0 },
  { name: 'meteortail', celFile: 'MeteorTail', animSpeed: 16, trans: 1 },
  { name: 'meteorcenter', celFile: 'MeteorTargetIndicator', animSpeed: 16, trans: 1 },
  { name: 'meteorexplode', celFile: 'ExpArrowExplode', animSpeed: 16, trans: 1 },
  { name: 'meteorfire', celFile: 'groundFireMedium', animSpeed: 16, trans: 1 },
  { name: 'firesmall', celFile: 'groundFireSmall', animSpeed: 16, trans: 1 },

  // 18 Sorceress Skills Missiles (v1.13c Parity)
  { name: 'nova', celFile: 'ElectricNova', animSpeed: 16, trans: 1 },
  { name: 'lightningstrike', celFile: 'LightningStrike', animSpeed: 16, trans: 1 },
  { name: 'thunderstorm1', celFile: 'LightningboltBig', animSpeed: 16, trans: 1 },
  { name: 'sparkle', celFile: 'Gleam', animSpeed: 16, trans: 1 },
  { name: 'freezingarrowexp2', celFile: 'FreezeExplodeEjecta', animSpeed: 16, trans: 1 },
  { name: 'firewall', celFile: 'groundFireBig', animSpeed: 16, trans: 1 },
  { name: 'infernoflame1', celFile: 'Flamethrower', animSpeed: 16, trans: 1 },
  { name: 'infernoflame2', celFile: 'Flamethrower2', animSpeed: 16, trans: 1 },
  { name: 'frostnova', celFile: 'FrostNova', animSpeed: 16, trans: 1 },

  // Barbarian
  { name: 'howl', celFile: 'BAYellShockWave01', animSpeed: 16, trans: 1 },
  { name: 'shout', celFile: 'BAYellShockWave01', animSpeed: 16, trans: 1 },
  { name: 'battlecry', celFile: 'BAYellShockWave01', animSpeed: 16, trans: 1 },
  { name: 'battleorders', celFile: 'BAYellShockWave01', animSpeed: 16, trans: 1 },
  { name: 'battlecommand', celFile: 'BAYellShockWave01', animSpeed: 16, trans: 1 },
  { name: 'warcry', celFile: 'WarcryShockwave', animSpeed: 16, trans: 1 },
  { name: 'grimwardsmallstart', celFile: 'GrimWardSmallStart', animSpeed: 16, trans: 0 },
  { name: 'grimwardsmall', celFile: 'GrimWardSmall', animSpeed: 16, trans: 0 },
  { name: 'grimwardsmallstop', celFile: 'GrimWardSmallStop', animSpeed: 16, trans: 0 },
  { name: 'grimwardmediumstart', celFile: 'GrimWardMediumStart', animSpeed: 16, trans: 0 },
  { name: 'grimwardmedium', celFile: 'GrimWardMedium', animSpeed: 16, trans: 0 },
  { name: 'grimwardmediumstop', celFile: 'GrimWardMediumStop', animSpeed: 16, trans: 0 },
  { name: 'grimwardlargestart', celFile: 'GrimWardLargeStart', animSpeed: 16, trans: 0 },
  { name: 'grimwardlarge', celFile: 'GrimWardLarge', animSpeed: 16, trans: 0 },
  { name: 'grimwardlargestop', celFile: 'GrimWardLargeStop', animSpeed: 16, trans: 0 },

  // Druid
  { name: 'moltenboulder', celFile: 'expansion/MoltenBoulderRoll', animSpeed: 16, trans: 0 },
  { name: 'moltenboulderemerge', celFile: 'expansion/MoltenBoulderEmerge', animSpeed: 16, trans: 0 },
  { name: 'moltenboulder-flyingrocks', celFile: 'expansion/MoltenFragmentD', animSpeed: 16, trans: 0 },
  { name: 'firestormmaker', celFile: 'expansion/FirestormEmitter', animSpeed: 16, trans: 1 },
  { name: 'firestorm', celFile: 'groundFireSmall', animSpeed: 16, trans: 1 },
  { name: 'firespikes', celFile: 'expansion/FireSpikes', animSpeed: 16, trans: 1 },
  { name: 'firespikesground', celFile: 'expansion/FireSpikesGround', animSpeed: 16, trans: 1 },
  { name: 'arcticblast1', celFile: 'expansion/ArcticBlastIce', animSpeed: 16, trans: 1 },
  { name: 'arcticblast2', celFile: 'expansion/ArcticBlastIce_2', animSpeed: 16, trans: 1 },
  { name: 'twister', celFile: 'expansion/twister', animSpeed: 16, trans: 1 },
  { name: 'tornado', celFile: 'expansion/tornado', animSpeed: 16, trans: 1 },
  { name: 'volcano', celFile: 'Expansion/volcano_base', animSpeed: 16, trans: 0 },
  { name: 'volcano overlay fire', celFile: 'Expansion/volcano_Fire', animSpeed: 16, trans: 1 },
  { name: 'volcano debris 2', celFile: 'expansion/volcano_rock', animSpeed: 16, trans: 1 },
  { name: 'shockwave', celFile: 'expansion/shockwave', animSpeed: 8, trans: 1 },
  { name: 'armageddonrock', celFile: 'expansion/armageddon_rock', animSpeed: 16, trans: 0 },
  { name: 'armageddontail', celFile: 'expansion/armageddon_fire', animSpeed: 16, trans: 1 },
  { name: 'hurricaneswoosh', celFile: 'expansion/hurricane_swoosh', animSpeed: 8, trans: 1 },
  { name: 'hurricanerock', celFile: 'expansion/hurricane_rocks', animSpeed: 16, trans: 0 },
  { name: 'hurricanetree', celFile: 'expansion/hurricane_tree', animSpeed: 16, trans: 0 },
  { name: 'vines trail', celFile: 'Expansion/vines', animSpeed: 16, trans: 0 },
  { name: 'vines wither', celFile: 'Expansion/Vines_Death', animSpeed: 16, trans: 0 },
  { name: 'erruption crack 1', celFile: 'expansion/EruptionCrack', animSpeed: 16, trans: 0 },
  { name: 'erruption smoke 1', celFile: 'expansion/EruptionSmoke', animSpeed: 16, trans: 1 },
  { name: 'volcano explosion', celFile: 'Expansion/rock_lava_explosion', animSpeed: 16, trans: 1 },
  { name: 'volcano small fire', celFile: 'Expansion/rock_lava_pool', animSpeed: 16, trans: 0 },

  // Assassin Traps & Martial Arts
  { name: 'bomb in air', celFile: 'expansion/FireTraumaMissile', animSpeed: 16, trans: 0 },
  { name: 'bomb on ground', celFile: 'expansion/FireTraumaGround', animSpeed: 16, trans: 0 },
  { name: 'bomb explosion', celFile: 'expansion/FireTraumaXplosion', animSpeed: 16, trans: 1 },
  { name: 'shock field in air', celFile: 'expansion/caltrops', animSpeed: 16, trans: 0 },
  { name: 'shock field on ground', celFile: 'Expansion/ShockField', animSpeed: 16, trans: 1 },
  { name: 'bladefragment1', celFile: 'Expansion/bladefury', animSpeed: 16, trans: 0 },
  { name: 'bladefragment2', celFile: 'Expansion/bladefury_B', animSpeed: 32, trans: 0 },
  { name: 'bladefragment3', celFile: 'Expansion/bladefury_C', animSpeed: 32, trans: 0 },
  { name: 'deathsentryexplode', celFile: 'Expansion/dethsentry02', animSpeed: 16, trans: 0 },
  { name: 'blade shield missile', celFile: 'Expansion/blade_shield_missile', animSpeed: 16, trans: 1 },
  { name: 'throwingstar', celFile: 'expansion/ThrowingStarMissile', animSpeed: 16, trans: 1 },
  { name: 'mindblast', celFile: 'Expansion/Mindblast', animSpeed: 16, trans: 1 },

  // Quest FX Client Missiles (Issue #873)
  { name: 'denofevillight', celFile: 'LightBeams', animSpeed: 16, trans: 1 },
  // A2Q6 staff in orifice (Issue #915): Missiles.txt 338 horadricstaff / 340 horadriclight CelFile. 339
  // horadriclightning (LightningStrike) and 150 dust (FireSmoke) reuse atlases baked above / below.
  { name: 'horadricstaff', celFile: 'HoradricStaff', animSpeed: 16, trans: 1 },
  { name: 'horadriclight', celFile: 'HoradricLightBeamstreaks', animSpeed: 16, trans: 1 },

  // Monster & Boss Death FX Missiles (Issue #872 - 1.13c Ground Truth)
  { name: 'suicidefireexplode', celFile: 'Fsexplode', animSpeed: 16, trans: 1 },
  { name: 'icebreaklarge', celFile: 'IceBreakLarge', animSpeed: 16, trans: 1 },
  { name: 'icebreaklargemelt', celFile: 'IceBreakLargeMelt', animSpeed: 16, trans: 1 },
  { name: 'icebreaksmoke', celFile: 'IceBreakSmoke', animSpeed: 16, trans: 1 },
  { name: 'brdeathspirits1', celFile: 'BRSpiritS1', animSpeed: 16, trans: 1 },
  { name: 'brspiritnu', celFile: 'BRSpiritNU', animSpeed: 16, trans: 1 },
  { name: 'brspiritdt', celFile: 'BRSpiritDT', animSpeed: 16, trans: 1 },
  { name: 'brsmokes1', celFile: 'BRSmokeS1', animSpeed: 16, trans: 1 },
  { name: 'brsmokenu', celFile: 'BRSmokeNU', animSpeed: 16, trans: 1 },
  { name: 'brsmokedt', celFile: 'BRSmokeDT', animSpeed: 16, trans: 1 },
  { name: 'towermisttrail', celFile: 'mist', animSpeed: 16, trans: 1 },
  { name: 'towermistfade', celFile: 'Mist_fade', animSpeed: 16, trans: 1 },
  { name: 'andycolumnfire', celFile: 'AndarielFlameDeath', animSpeed: 16, trans: 1 },
  { name: 'andyfallingdebris1', celFile: 'CeilingChunkFall01', animSpeed: 16, trans: 0 },
  { name: 'andyfallingdebris2', celFile: 'CeilingChunkFall02', animSpeed: 16, trans: 0 },
  { name: 'andyfallingdebris3', celFile: 'CeilingChunkFall03', animSpeed: 16, trans: 0 },
  { name: 'andydebrisexplosion1', celFile: 'CeilingChunkVanish01', animSpeed: 16, trans: 0 },
  { name: 'andydebrisexplosion2', celFile: 'CeilingChunkVanish02', animSpeed: 16, trans: 0 },
  { name: 'andydebrisexplosion3', celFile: 'CeilingChunkRemain01', animSpeed: 16, trans: 0 },
  { name: 'andydebrisexplosion4', celFile: 'CeilingChunkRemain02', animSpeed: 16, trans: 0 },
  { name: 'andydebrisexplosion5', celFile: 'CeilingChunkRemain03', animSpeed: 16, trans: 0 },
  { name: 'radamenthandofgod', celFile: 'HandOfGod', animSpeed: 24, trans: 1 },
  { name: 'taintedsunflash', celFile: 'yellowBallGlowIntro', animSpeed: 16, trans: 1 },
  { name: 'taintedsunball', celFile: 'yellowBallGlow2', animSpeed: 16, trans: 1 },
  { name: 'queendeathglob', celFile: 'QueenDeathGuts', animSpeed: 12, trans: 0 },
  { name: 'queendeathsplat1', celFile: 'QueenDeathPuddle', animSpeed: 16, trans: 0 },
  { name: 'queendeathsplat2', celFile: 'QueenDeathPuddle2', animSpeed: 16, trans: 0 },
  { name: 'mephistoflyingrockssmall', celFile: 'ExplosionSparkSmall', animSpeed: 16, trans: 0 },
  // Missiles.txt #302 mephistoflyingrocksbig: CelFile ExplosionSpark, AnimSpeed 16, Trans 0 (Issue #1208).
  { name: 'mephistoflyingrocksbig', celFile: 'ExplosionSpark', animSpeed: 16, trans: 0 },
  { name: 'mephistoholebirth', celFile: 'smithholebirth', animSpeed: 16, trans: 0 },
  { name: 'mephistoholeneutral', celFile: 'smithholeneutral', animSpeed: 16, trans: 0 },
  { name: 'mephistoholedeath', celFile: 'smithholedeath', animSpeed: 16, trans: 0 },
  { name: 'mephistoholedead', celFile: 'smithholedead', animSpeed: 16, trans: 0 },
  { name: 'durieldeathrock', celFile: 'Rock_large', animSpeed: 16, trans: 0 },
  { name: 'durieldeathdebris', celFile: 'Rock_small', animSpeed: 16, trans: 0 },
  { name: 'durieldeathsmoke', celFile: 'FireSmoke', animSpeed: 16, trans: 1 },
  { name: 'orbmisttrail', celFile: 'mist_Fade_Orb_Loop', animSpeed: 16, trans: 1 },
  { name: 'orbmistfade', celFile: 'mist_Fade_Orb', animSpeed: 16, trans: 1 },
  { name: 'izual mist loop', celFile: 'IzualDeathClouds', animSpeed: 16, trans: 1 },
  { name: 'izual lightning', celFile: 'IzualDeathParticles', animSpeed: 16, trans: 1 },
  { name: 'dopplezonexplode', celFile: 'DopplezonExplode', animSpeed: 16, trans: 1 },
  { name: 'catapult spike explosion', celFile: 'expansion/FireSpikeExplode', animSpeed: 16, trans: 1 },
  { name: 'tower death', celFile: 'expansion/TowerDebris', animSpeed: 16, trans: 0 },
  { name: 'ancient death cloud', celFile: 'expansion/AncientDeathMissile', animSpeed: 16, trans: 1 },
  { name: 'healing vortex', celFile: 'expansion/overseer_missile', animSpeed: 16, trans: 1 },
  { name: 'nihlithak1', celFile: 'expansion/Nihlathak A', animSpeed: 8, trans: 0 },
  { name: 'nihlithak2', celFile: 'expansion/Nihlathak B', animSpeed: 8, trans: 0 },
  { name: 'nihlithak3', celFile: 'expansion/Nihlathak C', animSpeed: 8, trans: 0 },
  { name: 'nehlithakswoosh', celFile: 'expansion/nehlthak_Swoosh', animSpeed: 8, trans: 1 },
  { name: 'nehlithakdebris1', celFile: 'expansion/Skeleton_pieces_A', animSpeed: 16, trans: 0 },
  { name: 'nehlithakdebris2', celFile: 'expansion/Skeleton_pieces_B', animSpeed: 16, trans: 0 },
  { name: 'nehlithakdebris3', celFile: 'expansion/Skeleton_pieces_C', animSpeed: 16, trans: 0 },
  { name: 'nehlithakdebris4', celFile: 'expansion/Skeleton_pieces_D', animSpeed: 16, trans: 0 },
  { name: 'baalteleport', celFile: 'Expansion/Baalsummonoverlay', animSpeed: 24, trans: 1 },
  { name: 'baalclonedeath', celFile: 'Expansion/Baalteleport', animSpeed: 24, trans: 1 },
  // Missiles.txt #555 'baal nova' (Baal Nova #316 CltDoFunc 25 ring): CelFile Expansion\baalsummonmissile, AnimSpeed 12.
  { name: 'baal nova', celFile: 'Expansion/baalsummonmissile', animSpeed: 12, trans: 1 },
  { name: 'nehlithakhole', celFile: 'expansion/nehlthak_Hole', animSpeed: 16, trans: 0 },
  { name: 'nehlithakholelight', celFile: 'expansion/nehlthak_Hole_light', animSpeed: 16, trans: 1 },
  { name: 'nehlithakglow2', celFile: 'expansion/NehlithakGlow', animSpeed: 16, trans: 1 },
  { name: 'nehlithakbonechips', celFile: 'expansion/BonePieces', animSpeed: 16, trans: 0 },
  { name: 'baalfx spirit 1', celFile: 'expansion/baaldeathghostie02', animSpeed: 6, trans: 1 },
  { name: 'baalfx spirit 2', celFile: 'expansion/baaldeathghostie01', animSpeed: 6, trans: 1 },
  { name: 'baalfx baal head appear', celFile: 'expansion/baaldeathswirl', animSpeed: 16, trans: 1 },
  { name: 'baalfx baal head 1', celFile: 'expansion/baaldeathhead01', animSpeed: 12, trans: 1 },
  { name: 'baalfx baal head 2', celFile: 'expansion/baaldeathhead02', animSpeed: 12, trans: 1 },
  { name: 'baalfx baal head 3', celFile: 'expansion/baaldeathhead03', animSpeed: 12, trans: 1 },
  { name: 'baalfx tyreal debris 1', celFile: 'expansion/BCeilingChunkFall1', animSpeed: 16, trans: 0 },
  { name: 'baalfx tyreal debris 2', celFile: 'expansion/BCeilingChunkFall2', animSpeed: 16, trans: 0 },
  { name: 'baalfx tyreal debris 3', celFile: 'expansion/BCeilingChunkFall3', animSpeed: 16, trans: 0 },
  { name: 'baalfx tyreal debris break', celFile: 'expansion/BCeilingChunkBreak', animSpeed: 12, trans: 0 },

  // 1.13c Missiles.txt remaining distinct CelFiles (Issues #1100, #1101, #1102, #1103)
  { name: 'bighead1', celFile: 'BigheadLightningMissile', animSpeed: 16, trans: 1 },
  { name: 'spike1', celFile: 'SpikeFiendMissle', animSpeed: 16, trans: 0 },
  { name: 'shafire1', celFile: 'ShamanFireball', animSpeed: 16, trans: 1 },
  { name: 'andarielspray', celFile: 'AndarielSpell', animSpeed: 16, trans: 1 },
  { name: 'bigheadexp', celFile: 'BigheadLightningExplosion', animSpeed: 16, trans: 1 },
  { name: 'shamanexp', celFile: 'ShamanFireballExplodeFinal', animSpeed: 16, trans: 1 },
  { name: 'glaive', celFile: 'Glaive', animSpeed: 16, trans: 0 },
  { name: 'explosivepotionexp', celFile: 'PotionExplode', animSpeed: 16, trans: 1 },
  { name: 'explosivepotiondebris1', celFile: 'PotionExplodeDebris01', animSpeed: 16, trans: 0 },
  { name: 'explosivepotiondebris2', celFile: 'PotionExplodeDebris02', animSpeed: 16, trans: 0 },
  { name: 'explosivepotiondebris3', celFile: 'PotionExplodeDebris03', animSpeed: 16, trans: 0 },
  { name: 'mummy1', celFile: 'GreaterMummyBreath', animSpeed: 16, trans: 1 },
  { name: 'goospit1', celFile: 'SandMaggotGooSpit', animSpeed: 16, trans: 0 },
  { name: 'goosplat', celFile: 'GooHit', animSpeed: 16, trans: 0 },
  { name: 'sand pile', celFile: 'SandMaggotSandPile', animSpeed: 16, trans: 0 },
  { name: 'unholybolt1', celFile: 'UnholyBolt', animSpeed: 16, trans: 2 },
  { name: 'sanctuarycenter', celFile: 'sanctuary', animSpeed: 16, trans: 0 },
  { name: 'stuckarrow', celFile: 'ArrowInGround', animSpeed: 16, trans: 0 },
  { name: 'footprint', celFile: 'Footsteps01', animSpeed: 16, trans: 0 },
  { name: 'chillblood', celFile: 'ChillBlood', animSpeed: 16, trans: 1 },
  { name: 'teleport', celFile: 'Teleport', animSpeed: 16, trans: 1 },
  { name: 'monbliz3', celFile: 'icestormfallvar03', animSpeed: 16, trans: 1 },
  { name: 'monbliz4', celFile: 'icestormfallvar04', animSpeed: 16, trans: 1 },
  { name: 'amphibiangoo1', celFile: 'FrogPoisonMissile', animSpeed: 16, trans: 1 },
  { name: 'spidergoolay', celFile: 'Spider_Goo_Missile', animSpeed: 16, trans: 1 },
  { name: 'spidergoo', celFile: 'Spider_Goo_Disappear', animSpeed: 16, trans: 1 },
  { name: 'chillbloodpuff', celFile: 'ChillBloodPuff', animSpeed: 16, trans: 1 },
  { name: 'diablight', celFile: 'DiabloLightning', animSpeed: 16, trans: 1 },
  { name: 'fingermagespider', celFile: 'FingerMageSpider', animSpeed: 16, trans: 1 },
  { name: 'trap spike right', celFile: 'SpikeRight', animSpeed: 16, trans: 0 },
  { name: 'trap spike left', celFile: 'SpikeLeft', animSpeed: 16, trans: 0 },
  { name: 'trap cursed skull right', celFile: 'SkullRight', animSpeed: 16, trans: 0 },
  { name: 'trap cursed skull left', celFile: 'SkullLeft', animSpeed: 16, trans: 0 },
  { name: 'trap poison ball right', celFile: 'PoisonRight', animSpeed: 16, trans: 0 },
  { name: 'trap poison ball left', celFile: 'PoisonLeft', animSpeed: 16, trans: 0 },
  { name: 'blowgun', celFile: 'Blowdart', animSpeed: 16, trans: 0 },
  { name: 'mephisto', celFile: 'MephistoMissile', animSpeed: 16, trans: 1 },
  { name: 'firehead', celFile: 'VampireMissile', animSpeed: 16, trans: 1 },
  { name: 'dirt pile', celFile: 'SandMaggotDirtPile', animSpeed: 16, trans: 0 },
  { name: 'undeadmissile1', celFile: 'SkullPoison', animSpeed: 16, trans: 1 },
  { name: 'undeadmissile2', celFile: 'SkullFire', animSpeed: 16, trans: 1 },
  { name: 'undeadmissile3', celFile: 'SkullIce', animSpeed: 16, trans: 1 },
  { name: 'undeadmissile4', celFile: 'SkullUnholy', animSpeed: 16, trans: 1 },
  { name: 'hellmeteorlaunch1', celFile: 'meteorlavaburst', animSpeed: 16, trans: 0 },
  { name: 'hellmeteorlaunch2', celFile: 'meteorlavaburst2', animSpeed: 16, trans: 1 },
  { name: 'hellmeteorup', celFile: 'meteorlavaup', animSpeed: 16, trans: 1 },
  { name: 'hellmeteordown', celFile: 'meteorlavadown', animSpeed: 16, trans: 1 },
  { name: 'hellmeteorball', celFile: 'meteorlavarock', animSpeed: 16, trans: 0 },
  { name: 'regurgitatorcorpse', celFile: 'SlugMissile', animSpeed: 16, trans: 1 },
  { name: 'regurgitatorcorpseexpl', celFile: 'Slug Missile Explode', animSpeed: 16, trans: 1 },
  { name: 'highpriestlightning', celFile: 'HighPriestLightning', animSpeed: 16, trans: 1 },
  { name: 'mephistoexplosion', celFile: 'MephistoMissileExplosion', animSpeed: 16, trans: 1 },
  { name: 'pilum', celFile: 'Pilum', animSpeed: 16, trans: 0 },
  { name: 'hffragment1', celFile: 'SoulForgeShard', animSpeed: 16, trans: 1 },
  { name: 'hfspirit1', celFile: 'SoulForgeRisingSoul', animSpeed: 16, trans: 1 },
  { name: 'baallightningtrail', celFile: 'expansion/lightningpiece', animSpeed: 16, trans: 1 },
  { name: 'impfireball', celFile: 'expansion/ImpFireball', animSpeed: 16, trans: 1 },
  { name: 'catapult plague ball on', celFile: 'expansion/catapultpoisonbomb', animSpeed: 16, trans: 1 },
  { name: 'imp teleport', celFile: 'expansion/impteleport', animSpeed: 16, trans: 1 },
  { name: 'vine beast walk 1', celFile: 'expansion/Pod_walk_1', animSpeed: 16, trans: 0 },
  { name: 'vine beast walk 2', celFile: 'expansion/Pod_walk_2', animSpeed: 16, trans: 0 },
  { name: 'vine beast neutral', celFile: 'expansion/Pod_neutral_1', animSpeed: 16, trans: 0 },
  { name: 'vine beast attack', celFile: 'expansion/Pod_attack_1', animSpeed: 16, trans: 0 },
  { name: 'vine beast death', celFile: 'expansion/Pod_death_1', animSpeed: 16, trans: 0 },
  { name: 'dragonbreath missile', celFile: 'Expansion/firenova', animSpeed: 16, trans: 1 },
  { name: 'lurecenter', celFile: 'Expansion/LureCloud', animSpeed: 16, trans: 1 },
  { name: 'impmiss1', celFile: 'Expansion/impmissile01', animSpeed: 16, trans: 1 },
  { name: 'death mauler', celFile: 'expansion/deathmaulerfingers', animSpeed: 16, trans: 0 },
  { name: 'death mauler trail', celFile: 'expansion/deathmaulermissile', animSpeed: 16, trans: 0 },
  { name: 'death mauler trail fade', celFile: 'expansion/deathmaulerfadeout', animSpeed: 16, trans: 0 },
  { name: 'anya icicle', celFile: 'expansion/icicle', animSpeed: 16, trans: 1 },
  { name: 'anya iceimpact', celFile: 'expansion/iceimpact', animSpeed: 16, trans: 1 },
  { name: 'anya icesteam', celFile: 'expansion/icecavequest_steam', animSpeed: 16, trans: 1 },
  { name: 'anya icemagic', celFile: 'expansion/icecavequest_magic', animSpeed: 16, trans: 1 },
  { name: 'vine beast walk 1 fade', celFile: 'expansion/Pod_Jump_FadeOut', animSpeed: 16, trans: 0 },
  { name: 'vine beast neutral fade', celFile: 'expansion/Pod_Neutral_FadeOut', animSpeed: 16, trans: 0 },
  { name: 'baal spawn monsters', celFile: 'Expansion/baalsummonmissile2', animSpeed: 8, trans: 1 },
  { name: 'baal inferno', celFile: 'Expansion/baalmissile', animSpeed: 12, trans: 1 },
  { name: 'world stone chip 1', celFile: 'expansion/wstonechips1', animSpeed: 12, trans: 0 },
  { name: 'world stone chip 2', celFile: 'expansion/wstonechips2', animSpeed: 12, trans: 0 },
  { name: 'world stone chip 3', celFile: 'expansion/wstonechips3', animSpeed: 12, trans: 0 },
  { name: 'world stone chip 4', celFile: 'expansion/wstonechips4', animSpeed: 12, trans: 0 },
  { name: 'hurricanecart', celFile: 'expansion/hurricane_cart', animSpeed: 16, trans: 0 },
  { name: 'hurricanesack', celFile: 'expansion/hurricane_sack', animSpeed: 16, trans: 0 },
  { name: 'hurricanevase', celFile: 'expansion/hurricane_vase', animSpeed: 16, trans: 0 },
  { name: 'baalcorpseexplodeexpl', celFile: 'expansion/CEBaal', animSpeed: 16, trans: 0 },
  { name: 'baal cold maker', celFile: 'BlueNovaB', animSpeed: 8, trans: 1 },
  { name: 'baal spawn monsters exp', celFile: 'Expansion/baalsummonsmall', animSpeed: 15, trans: 1 },
  { name: 'impmiss21', celFile: 'Expansion/impmissile2', animSpeed: 16, trans: 1 },
  { name: 'anyasteamvent', celFile: 'expansion/IceCaveEruption', animSpeed: 8, trans: 1 },
  { name: 'anyasteam', celFile: 'expansion/Ice_Smoke', animSpeed: 8, trans: 1 },
  { name: 'volcanofiretrail', celFile: 'expansion/wallfire_low_Tiny', animSpeed: 16, trans: 1 },
  { name: 'baalcorpseexplodefade', celFile: 'expansion/CEBaalFade', animSpeed: 4, trans: 0 },
  { name: 'icesparkle', celFile: 'expansion/iceglint', animSpeed: 12, trans: 1 },
] as const

const PAGE_SIZE = 4096

/**
 * The Missiles.txt Trans of a bake target. A target named after a real (non-alias) Missiles.txt row must carry that
 * row's Trans (fail fast on drift); other targets keep their declared value.
 */
export function missileTargetTrans(target: { readonly name: string; readonly trans: number }): number {
  const row = CANONICAL_113C_MISSILES[target.name.toLowerCase()]
  if (row !== undefined && row.name.toLowerCase() === target.name.toLowerCase()) {
    const rowTrans = row.trans ?? 0
    if (rowTrans !== target.trans) {
      throw new Error(`pack-missiles target '${target.name}' trans ${String(target.trans)} != Missiles.txt Trans ${String(rowTrans)}`)
    }
    return rowTrans
  }
  return target.trans
}

/** Meta blend label (canvas composite name) of a Missiles.txt Trans: eDrawMode 5 opaque / 3 lighter / 4 multiply. */
export function missileMetaBlendMode(trans: number): 'opaque' | 'lighter' | 'multiply' {
  const mode = missileTransToDrawBlend(trans)
  return mode === 'additive' ? 'lighter' : mode === 'burn' ? 'multiply' : 'opaque'
}

/**
 * Shelf-pack all frames of a missile / overlay SpriteSheet into a 32-bit RGBA PNG buffer.
 *
 * 1.13c draws every cel with palette index 0 as the only transparent texel, whatever the eDrawMode
 * (D2Direct3D 0x6F886B90; kb/render/d2gfx-draw-mode-113c.md). Black is never colour-keyed: under the additive
 * mode (Missiles Trans 1 / Overlay Trans 3) a black texel adds nothing, while under NORMAL (Missiles Trans 0,
 * Overlay Trans 5/8) and multiply (Missiles Trans 2) it is drawn. The atlas is therefore independent of Trans and
 * the draw mode is applied only by the runtime blend.
 */
export function packMissileSheetToRgbaPng(
  sheet: SpriteSheet,
  palette: Uint8Array,
): {
  png: Uint8Array
  width: number
  height: number
  groups: [number, number, number, number, number, number][][]
} {
  const frames = sheet.groups.flatMap(g => g.frames)
  const widest = Math.max(1, ...frames.map(f => f.width))
  const area = frames.reduce((sum, f) => sum + (f.width + 1) * (f.height + 1), 0)
  let pageWidth = Math.min(PAGE_SIZE, Math.max(widest + 2, 512))
  while (pageWidth < PAGE_SIZE && pageWidth * pageWidth < area * 1.15) {
    pageWidth *= 2
  }
  pageWidth = Math.min(PAGE_SIZE, pageWidth)

  let cursorX = 0
  let shelfY = 0
  let shelfHeight = 0
  const placements: { x: number; y: number; width: number; height: number }[] = []

  for (const frame of frames) {
    const w = Math.max(1, Math.min(frame.width, pageWidth))
    const h = Math.max(1, Math.min(frame.height, PAGE_SIZE))
    if (cursorX + w > pageWidth) {
      shelfY += shelfHeight + 1
      shelfHeight = 0
      cursorX = 0
    }
    placements.push({ x: cursorX, y: shelfY, width: w, height: h })
    cursorX += w + 1
    shelfHeight = Math.max(shelfHeight, h)
  }

  const pageHeight = Math.max(1, shelfY + shelfHeight)
  const rgba = new Uint8Array(pageWidth * pageHeight * 4)

  let idx = 0
  for (const frame of frames) {
    const place = placements[idx]!
    idx += 1
    for (let row = 0; row < place.height; row += 1) {
      const fromRow = row * frame.width
      const toRow = (place.y + row) * pageWidth + place.x
      for (let col = 0; col < place.width; col += 1) {
        const srcAt = fromRow + col
        const dst = (toRow + col) * 4
        if (frame.mask[srcAt] === 0) {
          rgba[dst] = 0
          rgba[dst + 1] = 0
          rgba[dst + 2] = 0
          rgba[dst + 3] = 0
        } else {
          const val = frame.indices[srcAt]!
          if (val === 0) {
            rgba[dst] = 0
            rgba[dst + 1] = 0
            rgba[dst + 2] = 0
            rgba[dst + 3] = 0
          } else {
            const r = palette[val * 3]!
            const g = palette[val * 3 + 1]!
            const b = palette[val * 3 + 2]!
            rgba[dst] = r
            rgba[dst + 1] = g
            rgba[dst + 2] = b
            rgba[dst + 3] = 255
          }
        }
      }
    }
  }

  const groups: [number, number, number, number, number, number][][] = []
  let consumed = 0
  for (const group of sheet.groups) {
    const gList: [number, number, number, number, number, number][] = []
    for (let i = 0; i < group.frames.length; i += 1) {
      const p = placements[consumed]!
      const f = group.frames[i]!
      consumed += 1
      gList.push([p.x, p.y, p.width, p.height, f.anchorX ?? 0, f.anchorY ?? 0])
    }
    groups.push(gList)
  }

  const png = encodeRgbaPng({ width: pageWidth, height: pageHeight, pixels: rgba })
  return { png, width: pageWidth, height: pageHeight, groups }
}

/** TS const name of a target's meta; Missiles.txt row names may contain spaces ('baal nova' -> BAAL_NOVA_META). */
function metaConstName(name: string): string {
  return `${name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}_META`
}

function formatMetaTs(meta: MissileMeta): string {
  const groupsStr = meta.groups
    .map(group => `    [${group.map(f => `[${f.join(', ')}]`).join(', ')}]`)
    .join(',\n')
  const trans = meta.trans ?? 1
  const blendMode = meta.blendMode ?? missileMetaBlendMode(trans)
  return `{\n  name: ${JSON.stringify(meta.name)}, celFile: ${JSON.stringify(meta.celFile)}, width: ${meta.width}, height: ${meta.height}, directions: ${meta.directions}, framesPerDirection: ${meta.framesPerDirection}, animSpeed: ${meta.animSpeed}, trans: ${trans}, blendMode: ${JSON.stringify(blendMode)},\n  groups: [\n${groupsStr}\n  ],\n}`
}

export async function bakeMissiles(projectRoot: string = process.cwd()): Promise<Record<string, MissileMeta>> {
  const fallbackDir = process.env.D2_DATA_DIR ?? join(projectRoot, 'samples', 'd2')
  const archivePaths = [
    join(projectRoot, 'samples', 'd2', 'Patch_D2.mpq'),
    join(projectRoot, 'samples', 'd2', 'd2exp.mpq'),
    join(projectRoot, 'samples', 'd2', 'd2data.mpq'),
    join(fallbackDir, 'Patch_D2.mpq'),
    join(fallbackDir, 'd2exp.mpq'),
    join(fallbackDir, 'd2data.mpq'),
  ]
  const archives: MpqArchive[] = []
  for (const p of archivePaths) {
    try {
      archives.push(await MpqArchive.open(await fileSource(p)))
    } catch {
      // ignore
    }
  }

  async function readMpqFile(path: string): Promise<Uint8Array | null> {
    for (const a of archives) {
      const f = a.find(path)
      if (f) return a.read(f)
    }
    return null
  }

  const palBytes = await readMpqFile('data/global/palette/ACT1/pal.pl2')
  if (!palBytes) throw new Error('data/global/palette/ACT1/pal.pl2 not found in MPQ archives')
  const pl2 = decodePl2(palBytes)

  const publicOutDir = join(projectRoot, 'public', 'missiles')
  mkdirSync(publicOutDir, { recursive: true })

  const metaRecord: Record<string, MissileMeta> = {}
  const pngByName = new Map<string, Uint8Array>()

  const linkOrWritePng = (srcPath: string, destPath: string, pngBytes?: Uint8Array): void => {
    if (srcPath === destPath) return
    if (srcPath.toLowerCase() === destPath.toLowerCase()) {
      if (pngBytes !== undefined) writeFileSync(destPath, pngBytes)
      else copyFileSync(srcPath, destPath)
      return
    }
    rmSync(destPath, { force: true })
    try {
      linkSync(srcPath, destPath)
    } catch {
      if (pngBytes !== undefined) {
        writeFileSync(destPath, pngBytes)
      } else {
        copyFileSync(srcPath, destPath)
      }
    }
  }

  for (const target of MISSILE_TARGETS) {
    const raw = await readMpqFile(`data/global/missiles/${target.celFile}.dcc`)
    if (!raw) throw new Error(`Missile DCC not found: data/global/missiles/${target.celFile}.dcc`)

    const dcc = decodeDcc(raw)
    const groups = dcc.directions.map(dir => ({
      frames: dir.frames.map(
        (frame): SpriteFrame => ({
          width: frame.frame.width,
          height: frame.frame.height,
          indices: frame.frame.indices,
          mask: frame.frame.mask,
          anchorX: dir.box.left,
          anchorY: dir.box.top,
        }),
      ),
    }))

    const sheet: SpriteSheet = { groups, width: null }
    const trans = missileTargetTrans(target)
    const blendMode = missileMetaBlendMode(trans)
    const packed = packMissileSheetToRgbaPng(sheet, pl2.rgb)

    const meta: MissileMeta = {
      name: target.name,
      celFile: target.celFile,
      width: packed.width,
      height: packed.height,
      directions: dcc.directions.length,
      framesPerDirection: dcc.directions[0]?.frames.length ?? 0,
      animSpeed: target.animSpeed,
      trans,
      blendMode,
      groups: packed.groups,
    }

    const primaryName = target.name.toLowerCase()
    const jsonStr = JSON.stringify(meta, null, 2)
    const primaryPngPath = join(publicOutDir, `${primaryName}.png`)
    if (primaryName !== 'curseall') {
      metaRecord[target.name] = meta
      metaRecord[primaryName] = meta
      pngByName.set(target.name, packed.png)
      pngByName.set(primaryName, packed.png)

      // Write PNG and JSON to public/missiles/ (strictly lowercase)
      rmSync(primaryPngPath, { force: true })
      writeFileSync(primaryPngPath, packed.png)
      writeFileSync(join(publicOutDir, `${primaryName}.json`), jsonStr, 'utf-8')
    } else {
      metaRecord[target.name] = meta
      pngByName.set(target.name, packed.png)
    }

    const baseCel = target.celFile.split(/[/\\]/).pop()!.toLowerCase()
    const STEM_COLLISIONS = new Set(['baalteleport', 'handofgod', 'lightningbolt', 'nehlithakglow', 'vines'])
    if (!metaRecord[baseCel] && !STEM_COLLISIONS.has(baseCel)) {
      metaRecord[baseCel] = meta
      if (baseCel !== primaryName) {
        pngByName.set(baseCel, packed.png)
        if (primaryName === 'curseall') {
          writeFileSync(join(publicOutDir, `${baseCel}.png`), packed.png)
        } else {
          linkOrWritePng(primaryPngPath, join(publicOutDir, `${baseCel}.png`), packed.png)
        }
        writeFileSync(join(publicOutDir, `${baseCel}.json`), jsonStr, 'utf-8')
      }
    }

    console.log(`[Missile Packer] Baked ${target.name} (${target.celFile}.dcc): ${packed.width}x${packed.height}, ${packed.png.byteLength} bytes PNG`)
  }

  // Aliases for missiles
  const copyAlias = (aliasNameRaw: string, sourceNameRaw: string) => {
    const aliasName = aliasNameRaw.toLowerCase()
    const sourceName = sourceNameRaw.toLowerCase()
    const srcMeta = metaRecord[sourceName] ?? metaRecord[sourceNameRaw]
    if (!srcMeta) return
    const aliasMeta: MissileMeta = { ...srcMeta, name: aliasName }
    metaRecord[aliasName] = aliasMeta
    metaRecord[aliasNameRaw] = aliasMeta
    if (!aliasName.includes('/') && !aliasName.includes('\\')) {
      const jsonStr = JSON.stringify(aliasMeta, null, 2)
      writeFileSync(join(publicOutDir, `${aliasName}.json`), jsonStr, 'utf-8')
      const srcPngPath = join(publicOutDir, `${sourceName}.png`)
      const srcPngBytes = pngByName.get(sourceName) ?? pngByName.get(sourceNameRaw)
      if (srcPngBytes !== undefined) {
        pngByName.set(aliasName, srcPngBytes)
        pngByName.set(aliasNameRaw, srcPngBytes)
      }
      linkOrWritePng(srcPngPath, join(publicOutDir, `${aliasName}.png`), srcPngBytes)
    }
    console.log(`[Missile Packer] Aliased ${aliasName} -> ${sourceName}`)
  }
  copyAlias('blizzard4', 'blizzard3')
  copyAlias('blizzardexplode3', 'blizzardexplode2')
  copyAlias('firemedium', 'meteorfire')
  copyAlias('hydra', 'firebolt')

  // 18 Sorceress Skills Missiles aliases
  copyAlias('chainlightning', 'lightningstrike')
  copyAlias('lightninghit', 'lightningstrike')
  copyAlias('cairn stones bolt', 'thunderstorm1')
  copyAlias('blaze', 'firewall')
  copyAlias('coldunique', 'frostnova')
  copyAlias('mephfrostnova', 'frostnova')
  copyAlias('chillingarmorbolt', 'icebolt')

  // Necromancer aliases
  copyAlias('revivesmall', 'revive')
  copyAlias('revivemedium', 'revive')
  copyAlias('revivelarge', 'revive')
  copyAlias('bonespearexplode', 'teethexplode')
  copyAlias('curseamplifydamage', 'cursearea')
  copyAlias('cursedimvision', 'cursearea')
  copyAlias('curseweaken', 'cursearea')
  copyAlias('curseironmaiden', 'cursearea')
  copyAlias('curseterror', 'cursearea')
  copyAlias('curseconfuse', 'cursearea')
  copyAlias('cursereversevampire', 'cursearea')
  copyAlias('curseattract', 'cursearea')
  copyAlias('cursedecrepify', 'cursearea')
  copyAlias('curselowerresist', 'cursearea')

  // Druid aliases
  copyAlias('moltenboulderfirepath', 'firesmall')
  copyAlias('armageddonfire', 'firesmall')

  // Assassin aliases
  copyAlias('clawsofthunderbolt', 'chargedstrikebolt')
  copyAlias('clawsofthundernova', 'nova')
  copyAlias('bladesoficeexplode', 'iceexplode')
  copyAlias('bladesoficecubes', 'icebreaksmall')
  copyAlias('bladesoficecubesmelt', 'icebreaksmallmelt')
  copyAlias('royalstrikemeteor', 'meteor')
  copyAlias('royalstrikemeteorcenter', 'meteorcenter')
  copyAlias('royalstrikemeteortail', 'meteortail')
  copyAlias('royalstrikemeteorexplode', 'meteorexplode')
  copyAlias('royalstrikemeteorfire', 'firesmall')
  copyAlias('royalstrikechainlightning', 'lightningstrike')
  copyAlias('royalstrikechaosice', 'icebolt')
  copyAlias('fistsoffireexplode', 'meteorexplode')
  copyAlias('fistsoffirefirewall', 'firesmall')
  copyAlias('sentrychargedbolt', 'chargedbolt')

  // Monster & Boss Death FX aliases (Issue #872)
  copyAlias('monstercorpseexplode', 'corpseexplosion')
  copyAlias('suicidecorpseexplode', 'corpseexplosion')
  copyAlias('suicideiceexplode', 'freezingarrowexp1')
  copyAlias('fireexplosion', 'fireexplode')
  copyAlias('lightunique', 'chargedbolt')
  copyAlias('buglightning', 'chargedbolt')
  copyAlias('corpsepoisoncloud', 'poisonexplosioncloud')
  copyAlias('queenpoisoncloud', 'poisonnova')
  copyAlias('brdeathlightninghit', 'lightningstrike')
  copyAlias('mephistofirewall', 'firesmall')
  copyAlias('mephistoexplosionbig', 'fireexplode')
  copyAlias('mephistoexplosionsmall', 'fireexplode')
  copyAlias('andyfirewall', 'firesmall')
  copyAlias('andycolumnfirebase', 'meteorfire')
  copyAlias('radamentholybolt', 'holybolt')

  // Generate src/render/missiles-meta.ts
  const EXPORTED_MISSILE_META_CONSTS = new Set<string>([
    'FIREBOLT_META',
    'ICEBOLT_META',
    'ICEBLAST_META',
    'GLACIALSPIKE_META',
    'FREEZINGARROWEXP1_META',
    'FREEZEEXPLODE_META',
    'BLIZZARD1_META',
    'BLIZZARD2_META',
    'BLIZZARD3_META',
    'BLIZZARDEXPLODE1_META',
    'BLIZZARDEXPLODE2_META',
    'CHARGEDBOLT_META',
    'THROWKNIFE_META',
    'THROWAXE_META',
    'METEOR_META',
    'METEORTAIL_META',
    'METEORCENTER_META',
    'METEOREXPLODE_META',
    'METEORFIRE_META',
    'LIGHTNINGSTRIKE_META',
    'THUNDERSTORM1_META',
    'FIREWALL_META',
    'INFERNOFLAME1_META',
    'INFERNOFLAME2_META',
    'FROSTNOVA_META',
    'NOVA_META',
    'BLIZZARD4_META',
    'BLIZZARDEXPLODE3_META',
    'HYDRA_META',
    'HYDRAFIRE_META',
    'CHAINLIGHTNING_META',
    'FREEZINGARROWEXP2_META',
    'BLAZE_META',
    'GROUNDFIREBIG_META',
  ])

  const metaExports = MISSILE_TARGETS.map(t => {
    const constName = metaConstName(t.name)
    const prefix = EXPORTED_MISSILE_META_CONSTS.has(constName) ? 'export const' : 'const'
    return `${prefix} ${constName}: MissileMeta = ${formatMetaTs(metaRecord[t.name]!)}`
  }).join('\n')

  const NON_ROW_TARGET_NAMES = new Set<string>([
    'curseall',
    'revive',
    'icearrowexplode',
    'firespikes',
    'firespikesground',
    'mindblast',
    'brspiritnu',
    'brspiritdt',
    'brsmokes1',
    'brsmokenu',
    'brsmokedt',
  ])

  const mapEntries = MISSILE_TARGETS
    .filter(t => !NON_ROW_TARGET_NAMES.has(t.name))
    .map(t => `  '${t.name}': ${metaConstName(t.name)},`)
    .join('\n')

  const metaTsContent = `/**
 * Authentic Diablo II v1.13c Missile Atlas Metadata.
 * Auto-generated by scripts/pack-missiles.ts.
 * Enforces Zero Runtime MPQ/DLL Architectural Invariant.
 */

export interface MissileFrameMeta {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly anchorX: number
  readonly anchorY: number
}

export type MissileFrameTuple = readonly [
  x: number,
  y: number,
  width: number,
  height: number,
  anchorX: number,
  anchorY: number,
]

export interface MissileMeta {
  readonly name: string
  readonly celFile: string
  readonly width: number
  readonly height: number
  readonly directions: number
  readonly framesPerDirection: number
  readonly animSpeed: number
  readonly trans?: number
  readonly blendMode?: string
  readonly groups: readonly (readonly MissileFrameTuple[])[]
}

import { dir64ToDcc } from '../../common/units/character.ts'
import { dir64FromPoints } from '../../common/units/direction.ts'

/**
 * Calculate DCC direction index for a missile based on 2D velocity vector.
 *
 * In Diablo II's 64-direction space:
 * - South (0, +y) is dir 0
 * - West (-x, 0) is dir 16
 * - North (0, -y) is dir 32
 * - East (+x, 0) is dir 48
 */
export function velocityToDccDirection(vx: number, vy: number, directions = 16): number {
  if (directions <= 1) return 0
  if (vx === 0 && vy === 0) return 0
  const angle = Math.atan2(vy, vx) // -PI to PI
  // Map angle so that South (PI/2) is 0, turning clockwise
  const fraction = (angle - Math.PI / 2) / (2 * Math.PI)
  const dir64 = Math.round((((fraction % 1) + 1) % 1) * 64) % 64
  return dir64ToDcc(dir64, directions)
}

/**
 * Calculate DCC direction index from start to target coordinates using
 * Diablo II 1.13c integer path direction calculation (0x6FD5CF40).
 */
export function pointsToDccDirection(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  directions = 16,
  fallback = 0,
): number {
  if (directions <= 1) return 0
  const dir64 = dir64FromPoints(startX, startY, targetX, targetY, fallback)
  return dir64ToDcc(dir64, directions)
}

${metaExports}

export const FREEZEEXPLODE_META: MissileMeta = FREEZINGARROWEXP1_META
export const BLIZZARD4_META: MissileMeta = { ...BLIZZARD3_META, name: 'blizzard4' }
export const BLIZZARDEXPLODE3_META: MissileMeta = { ...BLIZZARDEXPLODE2_META, name: 'blizzardexplode3' }
export const HYDRA_META: MissileMeta = { ...FIREBOLT_META, name: 'hydra' }
export const HYDRAFIRE_META: MissileMeta = HYDRA_META
const FIREMEDIUM_META: MissileMeta = { ...METEORFIRE_META, name: 'firemedium' }
export const CHAINLIGHTNING_META: MissileMeta = { ...LIGHTNINGSTRIKE_META, name: 'chainlightning' }
const LIGHTNINGHIT_META: MissileMeta = { ...LIGHTNINGSTRIKE_META, name: 'lightninghit' }
export const BLAZE_META: MissileMeta = { ...FIREWALL_META, name: 'blaze' }
export const GROUNDFIREBIG_META: MissileMeta = { ...FIREWALL_META, name: 'groundfirebig' }
const COLDUNIQUE_META: MissileMeta = { ...FROSTNOVA_META, name: 'coldunique' }
const MEPHFROSTNOVA_META: MissileMeta = { ...FROSTNOVA_META, name: 'mephfrostnova' }
const REVIVESMALL_META: MissileMeta = { ...REVIVE_META, name: 'revivesmall' }
const REVIVEMEDIUM_META: MissileMeta = { ...REVIVE_META, name: 'revivemedium' }
const REVIVELARGE_META: MissileMeta = { ...REVIVE_META, name: 'revivelarge' }
const BONESPEAREXPLODE_META: MissileMeta = { ...TEETHEXPLODE_META, name: 'bonespearexplode' }

export const MISSILE_METAS: Readonly<Record<string, MissileMeta>> = Object.freeze({
${mapEntries}
  'revivesmall': REVIVESMALL_META,
  'revivemedium': REVIVEMEDIUM_META,
  'revivelarge': REVIVELARGE_META,
  'bonespearexplode': BONESPEAREXPLODE_META,
  'chillingarmorbolt': ICEBOLT_META,
  'blizzard4': BLIZZARD4_META,
  'blizzardexplode3': BLIZZARDEXPLODE3_META,
  'hydra': HYDRA_META,
  'firemedium': FIREMEDIUM_META,
  'chainlightning': CHAINLIGHTNING_META,
  'lightninghit': LIGHTNINGHIT_META,
  'blaze': BLAZE_META,
  'coldunique': COLDUNIQUE_META,
  'mephfrostnova': MEPHFROSTNOVA_META,

  // Necromancer skill & missile rows
  'curseamplifydamage': CURSEALL_META,
  'cursedimvision': CURSEALL_META,
  'curseweaken': CURSEALL_META,
  'curseironmaiden': CURSEALL_META,
  'curseterror': CURSEALL_META,
  'curseconfuse': CURSEALL_META,
  'cursereversevampire': CURSEALL_META,
  'curseattract': CURSEALL_META,
  'cursedecrepify': CURSEALL_META,
  'curselowerresist': CURSEALL_META,

  // Druid skill & missile rows
  'moltenboulderfirepath': FIRESMALL_META,
  'armageddonfire': FIRESMALL_META,
  'catapult spike in air': FIRESPIKES_META,
  'catapult spike on ground': FIRESPIKESGROUND_META,
  'lureprojectile': FIRESPIKES_META,
  'sentryspikeinair': FIRESPIKES_META,
  'sentryspikeonground': FIRESPIKESGROUND_META,
  'frozenorbbolt': ICEBOLT_META,
  'frozenorbnova': ICEBOLT_META,

  // Assassin skill & missile rows
  'clawsofthunderbolt': CHARGEDSTRIKEBOLT_META,
  'clawsofthundernova': NOVA_META,
  'bladesoficeexplode': ICEEXPLODE_META,
  'bladesoficecubes': ICEBREAKSMALL_META,
  'bladesoficecubesmelt': ICEBREAKSMALLMELT_META,
  'royalstrikemeteor': METEOR_META,
  'royalstrikemeteorcenter': METEORCENTER_META,
  'royalstrikemeteortail': METEORTAIL_META,
  'royalstrikemeteorexplode': METEOREXPLODE_META,
  'royalstrikemeteorfire': FIRESMALL_META,
  'royalstrikechainlightning': LIGHTNINGSTRIKE_META,
  'royalstrikechaosice': ICEBOLT_META,
  'fistsoffireexplode': METEOREXPLODE_META,
  'fistsoffirefirewall': FIRESMALL_META,
  'sentrychargedbolt': CHARGEDBOLT_META,
  'mindblast hit': MINDBLAST_META,
  'mindblast center': MINDBLAST_META,

  // Amazon & Quest FX missile rows
  'javelin': POISONJAV_META,
  'cairn stones bolt': THUNDERSTORM1_META,

  // Monster & Boss Death FX missile rows (Issue #872)
  'monstercorpseexplode': CORPSEEXPLOSION_META,
  'suicidecorpseexplode': CORPSEEXPLOSION_META,
  'suicideiceexplode': FREEZINGARROWEXP1_META,
  'fireexplosion': FIREEXPLODE_META,
  'fireexplosion2': FIREEXPLODE_META,
  'lightunique': CHARGEDBOLT_META,
  'buglightning': CHARGEDBOLT_META,
  'corpsepoisoncloud': POISONEXPLOSIONCLOUD_META,
  'queenpoisoncloud': POISONNOVA_META,
  'brdeathlightninghit': LIGHTNINGSTRIKE_META,
  'brdeathspiritnu': BRSPIRITNU_META,
  'brdeathspiritdt': BRSPIRITDT_META,
  'brdeathsmokes1': BRSMOKES1_META,
  'brdeathsmokenu': BRSMOKENU_META,
  'brdeathsmokedt': BRSMOKEDT_META,
  'mephistofirewall': FIRESMALL_META,
  'mephistoexplosionbig': FIREEXPLODE_META,
  'mephistoexplosionsmall': FIREEXPLODE_META,
  'andyfirewall': FIRESMALL_META,
  'andycolumnfirebase': METEORFIRE_META,
  'radamentholybolt': HOLYBOLT_META,
})
`

  const manifestStr = JSON.stringify(
    {
      schema: 1,
      totalMissiles: Object.keys(metaRecord).length,
      missiles: metaRecord,
    },
    null,
    2,
  )
  writeFileSync(join(publicOutDir, 'missiles-manifest.json'), manifestStr, 'utf-8')

  if (process.argv.includes('--write-meta-ts')) {
    const outTsPath = join(projectRoot, 'src', 'client', 'render', 'missiles-meta.ts')
    writeFileSync(outTsPath, metaTsContent, 'utf-8')
    console.log(`[Missile Packer] Wrote ${outTsPath}`)
  }

  return metaRecord
}

// Direct invocation via tsx
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  bakeMissiles()
    .then(() => {
      console.log('[Missile Packer] All missile assets baked successfully.')
      process.exit(0)
    })
    .catch(err => {
      console.error('[Missile Packer] Failed:', err)
      process.exit(1)
    })
}

