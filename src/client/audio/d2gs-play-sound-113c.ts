/**
 * Diablo II v1.13c D2GS `0x2C PlaySound` Event Code Resolver & `0xA4` Guard (`src/client/audio/d2gs-play-sound-113c.ts`, #944 F10 / D24).
 *
 * Ground Truth Disassembly (`D2Client.dll` v1.13c):
 * - `0x6fb5d740`: S2C `0x2C PlaySound` packet handler (`[0x2c, unitType:u8, unitId:u32, nSound:u16]`) -> calls `0x6fad3f20`.
 * - `0x6fb5d760`: S2C `0xA4 MonsterSpecialSkill` packet handler (`[0xa4, classId:u16]`) -> calls `0x6fb1a0c0(classId, 0)` (UI state only; plays ZERO sound).
 * - `0x6fad3f20`: Looks up `pUnit = D2CLIENT_FindClientSideUnit(unitId, unitType)` (`0x6fb54e20`) BEFORE switching on `nSound`.
 *   If `pUnit == NULL`, returns immediately (`0x6fad4043`) without playing any sound.
 *   Switches on `nSound` (`10..93`) via byte table `0x6fad425c` and jump table `0x6fad4218`.
 * - `0x6fad4037` -> `0x6fad3200`: Default branch of `0x6fad3f20`; checks `pUnit->dwUnitType == 0` (player only) and dispatches
 *   codes `1..83` using the 7-class `D2PlayerSoundTableStrc` at `0x6fba7694` (`7 * 44` bytes).
 */

import type { UnitRef, UnitTypeName } from '../../netproto/index.ts'
import { SKILLS_BY_ID } from '../../common/data/skills-catalog.ts'
import { getSoundIdByName113c } from '../../common/audio/sounds-113c.ts'
import { resolveNpcGreetingSoundId113c } from '../../common/audio/npc-speech-113c.ts'
import { resolveUnitMonSoundRow113c } from '../../common/audio/mon-sounds-113c.ts'

export interface WorldSoundUnitRef extends UnitRef {
  readonly x?: number | undefined
  readonly y?: number | undefined
  readonly isLocalPlayer?: boolean | undefined
  readonly getPos?: (() => { readonly x: number; readonly y: number }) | undefined
}

export interface WorldSoundRequest {
  readonly kind?:
    | 'sound'
    | 'skill-cast'
    | 'skill-cast-stop'
    | 'skill-keyframe'
    | 'missile-spawn'
    | 'missile-tick'
    | 'missile-destroy'
    | 'missile-impact'
    | 'unit-death'
    | 'unit-loop-start'
    | 'unit-loop-stop'
    | 'unit-sound-stop'
    | string
    | undefined
  readonly soundId?: number | undefined
  readonly speechSoundId?: number | undefined
  readonly stingerSoundId?: number | undefined
  readonly eventCode?: number | undefined
  readonly skillId?: number | undefined
  readonly charclass?: string | number | undefined
  readonly flag?: number | undefined
  readonly weaponSoundId?: number | undefined
  readonly missileId?: number | string | undefined
  readonly entityId?: number | undefined
  readonly prog?: boolean | undefined
  readonly local?: boolean | undefined
  readonly unitId?: number | undefined
  readonly unitType?: number | string | undefined
  readonly classId?: number | undefined
  readonly unit?: WorldSoundUnitRef | undefined
  readonly x?: number | undefined
  readonly y?: number | undefined
  readonly delayTicks?: number | undefined
  readonly volume?: number | undefined
  readonly volumeOverride?: number | undefined
}

/**
 * 7-class player sound table at `D2Client.dll` `0x6fba7694` (pointer table to 7 x 11 uint32 structs at `0x6fba7560..0x6fba7668`).
 * Indexed by `CharClassId` (`0=Amazon, 1=Sorceress, 2=Necromancer, 3=Paladin, 4=Barbarian, 5=Druid, 6=Assassin`).
 */
export interface PlayerSoundClassEntry113c {
  readonly getHit1: number // +0x00 <class>_gethit_1
  readonly death1: number // +0x04 <class>_death_1
  readonly impossible1: number // +0x08 <class>_impossible_1 (0x2C code 19)
  readonly needMana1: number // +0x0c <class>_needmana_1 (0x2C code 21)
  readonly needKey1: number // +0x10 <class>_needkey_1 (0x2C code 22)
  readonly cantCarry1: number // +0x14 <class>_cantcarry_1 (0x2C code 23)
  readonly cantUseYet: number // +0x18 <class>_cantuseyet (0x2C code 20)
  readonly notInTown1: number // +0x1c <class>_not_in_town_1 (0x2C code 24)
  readonly chatBase: number // +0x20 <class>_chat_a_1 (0x2C codes 25..32: chatBase + 2*(code-25))
  readonly questBase: number // +0x24 <class>_act1_complete_andariel (0x2C codes 33..83: questBase + (code-33))
  readonly taunt1: number // +0x28 footstep base sound id (2768 light_dirt_1 / 2720 cloth_dirt_1 / 2816 heavy_dirt_1)
}

export const PLAYER_SOUND_TABLE_0x6FBA7694: readonly PlayerSoundClassEntry113c[] = [
  // 0: Amazon (0x6fba7560)
  {
    getHit1: 2878,
    death1: 2883,
    impossible1: 2953,
    needMana1: 2957,
    needKey1: 2955,
    cantCarry1: 2934,
    cantUseYet: 2936,
    notInTown1: 2959,
    chatBase: 2937,
    questBase: 2961,
    taunt1: 2768,
  },
  // 1: Sorceress (0x6fba7610)
  {
    getHit1: 2910,
    death1: 2915,
    impossible1: 3265,
    needMana1: 3269,
    needKey1: 3267,
    cantCarry1: 3246,
    cantUseYet: 3248,
    notInTown1: 3271,
    chatBase: 3249,
    questBase: 3273,
    taunt1: 2720,
  },
  // 2: Necromancer (0x6fba75b8)
  {
    getHit1: 2894,
    death1: 2899,
    impossible1: 3109,
    needMana1: 3113,
    needKey1: 3111,
    cantCarry1: 3090,
    cantUseYet: 3092,
    notInTown1: 3115,
    chatBase: 3093,
    questBase: 3117,
    taunt1: 2720,
  },
  // 3: Paladin (0x6fba75e4)
  {
    getHit1: 2886,
    death1: 2891,
    impossible1: 3187,
    needMana1: 3191,
    needKey1: 3189,
    cantCarry1: 3168,
    cantUseYet: 3170,
    notInTown1: 3193,
    chatBase: 3171,
    questBase: 3195,
    taunt1: 2768,
  },
  // 4: Barbarian (0x6fba758c)
  {
    getHit1: 2902,
    death1: 2907,
    impossible1: 3031,
    needMana1: 3035,
    needKey1: 3033,
    cantCarry1: 3012,
    cantUseYet: 3014,
    notInTown1: 3037,
    chatBase: 3015,
    questBase: 3039,
    taunt1: 2816,
  },
  // 5: Druid (0x6fba7668)
  {
    getHit1: 2926,
    death1: 2931,
    impossible1: 3421,
    needMana1: 3425,
    needKey1: 3423,
    cantCarry1: 3402,
    cantUseYet: 3404,
    notInTown1: 3427,
    chatBase: 3405,
    questBase: 3429,
    taunt1: 2720,
  },
  // 6: Assassin (0x6fba763c)
  {
    getHit1: 2918,
    death1: 2923,
    impossible1: 3343,
    needMana1: 3347,
    needKey1: 3345,
    cantCarry1: 3324,
    cantUseYet: 3326,
    notInTown1: 3349,
    chatBase: 3327,
    questBase: 3351,
    taunt1: 2720,
  },
]

/**
 * Quest completion `0x2C` codes (`33..83`) that also trigger a quest music stinger via `0x6faf5570`.
 */
export const QUEST_STINGER_BY_0x2C_CODE_113C: Readonly<Record<number, number>> = {
  33: 4685, // music_quest_andariel
  34: 4686, // music_quest_bloodraven
  35: 4688, // music_quest_den
  50: 4693, // music_quest_radament
  52: 4694, // music_quest_tainted
  66: 4692, // music_quest_mephisto
  75: 4695, // music_quest_diablo
  80: 4698, // music_quest_shenk
  82: 4697, // music_quest_nihlathak
  83: 4696, // music_quest_baal
}

/**
 * `0x2C` quest monologue codes in `33..83` that schedule a 12-tick (`0x0c`) voice delay (`0x6fad35b4`).
 */
export const QUEST_VOICE_DELAY12_CODES: ReadonlySet<number> = new Set<number>([
  36, 39, 45, 48, 49, 51, 53, 54,
  57, 58, 59, 60, 61, 62, 63, 64, 65,
  67, 68, 69, 70, 71, 72, 73, 74,
  76, 77, 78, 79, 81,
])

/**
 * Monster `Taunt` (`MonSounds.txt` `+0x74`, `0x6fad411e`) by monster `classId` (`MonStats.txt` `hcIdx`).
 * All non-empty `Taunt` rows in `MonSounds.txt` are `Stream = 1` boss speech (#948).
 */
export const MONSTER_TAUNT_BY_CLASS_ID_113C: Readonly<Record<number, number>> = {
  156: 4629, // andariel -> monster_andariel_taunt_1
  211: 4641, // duriel -> monster_duriel_taunt_1
  229: 4647, // radament -> monster_radament_taunt_1
  242: 4645, // mephisto -> monster_mephisto_taunt_1
  250: 4651, // summoner -> monster_summoner_taunt_1
  256: 4643, // izual -> monster_izual_taunt_1
  267: 4634, // bloodraven -> monster_bloodraven_taunt_1
  402: 4650, // smith -> monster_smith_taunt_2
  409: 4649, // hephasto -> monster_smith_taunt_1
  526: 4653, // nihlathakboss -> monster_nihlathak_taunt_1
  543: 4631, // baalthrone -> monster_baal_taunt_1
  544: 4633, // baalcrab -> monster_baal_taunt_3
  559: 4631, // baalcrabstairs -> monster_baal_taunt_1
  570: 4631, // baalclone -> monster_baal_taunt_1
  704: 4645, // ubermephisto -> monster_mephisto_taunt_1
  706: 4643, // uberizual -> monster_izual_taunt_1
  707: 4629, // uberandariel -> monster_andariel_taunt_1
  708: 4641, // uberduriel -> monster_duriel_taunt_1
  709: 4633, // uberbaal -> monster_baal_taunt_3
}

/**
 * Monster `Flee` (`MonSounds.txt` `+0x78`, `0x6fad2c10`): only `fallen` (`MonStats.txt` rows `19..23`, `642..644`)
 * has a non-empty `Flee` (`917` `monster_fallen_flee_1`, `Stream = 0`).
 */
export const FALLEN_CLASS_IDS_113C: ReadonlySet<number> = new Set<number>([19, 20, 21, 22, 23, 642, 643, 644])

/**
 * Primary Town NPC greeting speech (`0x6fb4cce0` / `0x6fb4cad0` -> `0x6fb8f0dc..0x6fb8f37c`) by monster `classId`.
 * All 38 rows lie in `3480..4569` (`Stream = 1` NPC dialogue, #948 / #1234).
 */
export const NPC_GREETING_BY_CLASS_ID_113C: Readonly<Record<number, number>> = {
  146: 3644, // deckardcain (Act 1) -> npc_cain_greeting_1
  147: 3910, // gheed -> npc_gheed_greeting_1
  148: 3480, // akara -> npc_akara_greeting_1
  150: 4077, // kashya -> npc_kashya_greeting_1
  154: 3737, // charsi -> npc_charsi_greeting_1
  155: 4320, // warriv (Act 1) -> npc_warriv_greeting_1
  175: 4320, // warriv (Act 2) -> npc_warriv_greeting_1
  176: 3613, // atma -> npc_atma_greeting_1
  177: 3776, // drognan -> npc_drognan_greeting_1
  178: 3844, // fara -> npc_fara_greeting_1
  198: 3949, // greiz -> npc_greiz_greeting_1
  199: 3811, // elzix -> npc_elzix_greeting_1
  200: 3877, // geglash -> npc_geglash_greeting_1
  201: 4049, // jerhyn -> npc_jerhyn_greeting_1
  202: 4118, // lysander -> npc_lysander_greeting_1
  210: 4150, // meshif (Act 2) -> npc_meshif_greeting_1
  244: 3644, // cain (Act 2) -> npc_cain_greeting_1
  245: 3644, // cain (Act 3) -> npc_cain_greeting_1
  246: 3644, // cain (Act 4) -> npc_cain_greeting_1
  251: 4303, // tyrael (Act 2) -> npc_tyrael_greeting_1
  252: 3571, // asheara -> npc_asheara_greeting_1
  253: 3992, // hratli -> npc_hratli_greeting_1
  254: 3523, // alkor -> npc_alkor_greeting_1
  255: 4248, // ormus -> npc_ormus_greeting_1
  257: 3989, // halbu -> npc_halbu_greeting_1
  264: 4150, // meshif2 (Act 3) -> npc_meshif_greeting_1
  265: 3644, // cain (Act 1) -> npc_cain_greeting_1
  297: 4217, // natalya -> npc_natalya_greeting_1
  367: 4303, // tyrael2 (Act 4) -> npc_tyrael_greeting_1
  405: 4043, // jamella -> npc_jamella_greeting_1
  511: 4449, // larzuk -> npc_larzuk_greeting_1
  512: 4382, // drehya (anya) -> npc_drehya_greeting_1
  513: 4489, // malah -> npc_malah_greeting_1
  514: 4533, // nihlathak (town) -> npc_nihlathak_greeting_1
  515: 4563, // qual-kehk -> npc_qualkehk_greeting_1
  520: 3644, // cain (Act 5) -> npc_cain_greeting_1
  521: 4303, // tyrael3 (Act 5) -> npc_tyrael_greeting_1
  527: 4382, // drehyaiced (Act 5) -> npc_drehya_greeting_1
}

export interface PlaySoundUnitContext113c {
  readonly unitType: UnitTypeName
  readonly id: number
  readonly classId: number
  readonly x: number
  readonly y: number
  readonly mode?: number | undefined
  readonly isLocalPlayer?: boolean | undefined
  readonly modifierListSkillId?: number | undefined
  readonly hasSkill?: ((skillId: number) => boolean) | undefined
  readonly isUnique?: boolean | undefined
  readonly isChampion?: boolean | undefined
  readonly isSuperUnique?: boolean | undefined
  readonly superUniqueId?: number | undefined
  readonly name?: string | undefined
}

export interface PlaySoundWorldContext113c {
  readonly localPlayerId: number
  readonly localPlayerX: number
  readonly localPlayerY: number
  readonly fleeDelayTicks?: number | undefined
  readonly greetingOptions?:
    | {
        readonly mode?: 0 | 1 | 2 | undefined
        readonly timeOfDay?: 0 | 1 | 2 | undefined
        readonly rng?: (() => number) | undefined
      }
    | undefined
}

/**
 * Resolves a D2GS `0x2C PlaySound` packet (`D2Client.dll` `0x6fb5d740` -> `0x6fad3f20` -> `0x6fad3200`)
 * for an already-located client unit (`0x6fad3f2c: call D2CLIENT_FindClientSideUnit`).
 *
 * Returns `null` when `0x6fad3f20` / `0x6fad3200` plays no sound (e.g. non-player unit with a default-branch
 * code, unknown code, dead local player, or timer-only code `92`).
 */
export function resolve0x2CPlaySound113c(
  codeRaw: number,
  unit: PlaySoundUnitContext113c,
  worldCtx: PlaySoundWorldContext113c,
): WorldSoundRequest | null {
  const code = codeRaw & 0xffff
  const unitRef: UnitRef = { unitType: unit.unitType, id: unit.id }

  // Outer switch 0x6fad3f20 (codes 10..93 via 0x6fad425c / 0x6fad4218)
  switch (code) {
    case 10: {
      // 0x6fad3f7e: PlaySound(2673 /* shrine_refill */, pUnit, 0, 0, 0) + 0x6fb37ed0(handle, 120)
      return {
        soundId: 2673,
        unit: unitRef,
        x: unit.x,
        y: unit.y,
        volume: 120,
        volumeOverride: 120,
      }
    }

    case 12: {
      // 0x6fad3fba: Delayed skill stsound via StatList(flag=0x44) stat 350 (modifierlist_skill) -> Skills.txt +0xfc stsound
      const skillId = unit.modifierListSkillId ?? 0
      if (skillId <= 0) return null
      if (unit.hasSkill && !unit.hasSkill(skillId)) return null
      const skillRow = SKILLS_BY_ID[skillId]
      const stSoundName = (skillRow as { readonly stsound?: string } | undefined)?.stsound
      const stSoundId = stSoundName ? (getSoundIdByName113c(stSoundName) ?? 0) : 0
      if (stSoundId <= 0) return null
      return {
        soundId: stSoundId,
        unit: unitRef,
        x: unit.x,
        y: unit.y,
      }
    }

    case 13: {
      // 0x6fad4195: PlaySound(2634 /* object_trap_trigger */, pUnit, 0, 0, 0)
      return {
        soundId: 2634,
        unit: unitRef,
        x: unit.x,
        y: unit.y,
      }
    }

    case 14: {
      // 0x6fad41ad: PlaySound(2635 /* object_trap_release */, pUnit, 0, 0, 0)
      return {
        soundId: 2635,
        unit: unitRef,
        x: unit.x,
        y: unit.y,
      }
    }

    case 15: {
      // 0x6fad40f4: if (pUnit->dwTxtFileNo == 271 /* roguehire */) PlaySound(4290 /* rogue_confirm_a_1 */, pUnit, 0, 0, 0)
      if (unit.classId !== 271) return null
      return {
        speechSoundId: 4290,
        eventCode: code,
        unit: unitRef,
        x: unit.x,
        y: unit.y,
      }
    }

    case 16: {
      // 0x6fad411e -> 0x6fad2a70: Monster Taunt (MonSounds.txt +0x74 via SuperUniques / UMonSound / MonSound, Stream=1 boss speech)
      if (unit.unitType !== 'monster') return null
      const tauntId =
        resolveUnitMonSoundRow113c(unit)?.taunt ||
        MONSTER_TAUNT_BY_CLASS_ID_113C[unit.classId] ||
        0
      if (tauntId <= 0) return null
      return {
        speechSoundId: tauntId,
        eventCode: code,
        unit: unitRef,
        x: unit.x,
        y: unit.y,
      }
    }

    case 17: {
      // 0x6fad4163 -> 0x6fad2c10 -> 0x6fad2a70: Monster Flee (MonSounds.txt +0x78, row 917 fallen_flee_1, delay 6..8 ticks)
      if (unit.unitType !== 'monster') return null
      const fleeId =
        resolveUnitMonSoundRow113c(unit)?.flee ||
        (FALLEN_CLASS_IDS_113C.has(unit.classId) ? 917 : 0)
      if (fleeId <= 0) return null
      return {
        soundId: fleeId,
        unit: unitRef,
        x: unit.x,
        y: unit.y,
        delayTicks: worldCtx.fleeDelayTicks ?? 6,
      }
    }

    case 18: {
      // 0x6fad4171 -> 0x6fb4cce0: Town NPC Greeting (0x6fb8f0dc..0x6fb8f37c, Stream=1 NPC speech)
      const greetingId =
        resolveNpcGreetingSoundId113c(
          unit.classId,
          worldCtx.greetingOptions ?? { mode: 0, rng: () => 0.9 },
        ) ||
        NPC_GREETING_BY_CLASS_ID_113C[unit.classId] ||
        0
      if (greetingId <= 0) return null
      return {
        speechSoundId: greetingId,
        eventCode: code,
        unit: unitRef,
        x: unit.x,
        y: unit.y,
      }
    }

    case 84: {
      // 0x6fad400f: Hireling "Thank you" (271 roguehire -> 4615, else 4625)
      return {
        speechSoundId: unit.classId === 271 ? 4615 : 4625,
        eventCode: code,
        unit: unitRef,
        x: unit.x,
        y: unit.y,
      }
    }

    case 85: {
      // 0x6fad4058: Hireling "Can't use ever" (271 roguehire -> 4612, else 4616)
      return {
        speechSoundId: unit.classId === 271 ? 4612 : 4616,
        eventCode: code,
        unit: unitRef,
        x: unit.x,
        y: unit.y,
      }
    }

    case 86: {
      // 0x6fad4089: Hireling "Can't use yet" (271 roguehire -> 4613, else 4619)
      return {
        speechSoundId: unit.classId === 271 ? 4613 : 4619,
        eventCode: code,
        unit: unitRef,
        x: unit.x,
        y: unit.y,
      }
    }

    case 87: {
      // 0x6fad40bd: Hireling "Good use" (271 roguehire -> 4614, else 4622)
      return {
        speechSoundId: unit.classId === 271 ? 4614 : 4622,
        eventCode: code,
        unit: unitRef,
        x: unit.x,
        y: unit.y,
      }
    }

    case 90: {
      // 0x6fad3f66: PlaySound(4379 /* ancient_act5_reward_spiel */, pUnit, 0, 0, 0)
      return {
        speechSoundId: 4379,
        eventCode: code,
        unit: unitRef,
        x: unit.x,
        y: unit.y,
      }
    }

    case 91: {
      // 0x6fad41f8: PlaySound(8 /* cursor_level_up_hireling */, localPlayer, 0, 0, 0)
      const localRef: UnitRef = { unitType: 'player', id: worldCtx.localPlayerId }
      return {
        soundId: 8,
        unit: localRef,
        x: worldCtx.localPlayerX,
        y: worldCtx.localPlayerY,
      }
    }

    case 92: {
      // 0x6fad41c5: Updates quest music stinger timer globals only; plays no sound
      return null
    }

    case 93: {
      // 0x6fad3fa2: PlaySound(2553 /* object_corpse_loot */, pUnit, 0, 0, 0)
      return {
        soundId: 2553,
        unit: unitRef,
        x: unit.x,
        y: unit.y,
      }
    }

    default:
      break
  }

  // Default branch 0x6fad4037: cmpl $0x0, (%edi); jne 0x6fad4043 -> player units ONLY!
  if (unit.unitType !== 'player') {
    return null
  }
  const cls = PLAYER_SOUND_TABLE_0x6FBA7694[unit.classId]
  if (!cls) {
    return null
  }
  // 0x6fad3245: Dead local player guard (mode == 17 PLRMODE_DEAD)
  if (unit.isLocalPlayer && unit.mode === 17) {
    return null
  }

  // Player sound handler 0x6fad3200 (codes 1..83)
  switch (code) {
    case 1:
      // 0x6fad3541: 235 item_pickup (positional on player unit)
      return { soundId: 235, unit: unitRef, x: unit.x, y: unit.y }
    case 2:
      // 0x6fad3548: 7 cursor_level_up (xor edx, edx -> non-positional)
      return { soundId: 7 }
    case 3:
      // 0x6fad3553: 10 cursor_convert_ready (non-positional)
      return { soundId: 10 }
    case 4:
      // 0x6fad355e: 11 cursor_convert_item (non-positional)
      return { soundId: 11 }
    case 5:
      // 0x6fad3569: 12 cursor_identify_ready (non-positional)
      return { soundId: 12 }
    case 6:
      // 0x6fad3574: 13 cursor_identify_item (non-positional)
      return { soundId: 13 }
    case 7:
      // 0x6fad3582: 2230 player_townportal_cast (positional on player unit)
      return { soundId: 2230, unit: unitRef, x: unit.x, y: unit.y }
    case 8:
      // 0x6fad358c: 2231 player_townportal_enter (positional on player unit)
      return { soundId: 2231, unit: unitRef, x: unit.x, y: unit.y }
    case 9:
      // 0x6fad3596: 9 cursor_durability_break (positional on player unit)
      return { soundId: 9, unit: unitRef, x: unit.x, y: unit.y }
    case 11:
      // 0x6fad35a0: 228 item_key_used (positional on player unit)
      return { soundId: 228, unit: unitRef, x: unit.x, y: unit.y }
    case 19:
      return { speechSoundId: cls.impossible1, eventCode: code, unit: unitRef, x: unit.x, y: unit.y }
    case 20:
      return { speechSoundId: cls.cantUseYet, eventCode: code, unit: unitRef, x: unit.x, y: unit.y }
    case 21:
      return { speechSoundId: cls.needMana1, eventCode: code, unit: unitRef, x: unit.x, y: unit.y }
    case 22:
      return { speechSoundId: cls.needKey1, eventCode: code, unit: unitRef, x: unit.x, y: unit.y }
    case 23:
      return { speechSoundId: cls.cantCarry1, eventCode: code, unit: unitRef, x: unit.x, y: unit.y }
    case 24:
      return { speechSoundId: cls.notInTown1, eventCode: code, unit: unitRef, x: unit.x, y: unit.y }
    default:
      break
  }

  // Codes 25..32 (0x6fad3270..0x6fad3296): per-class numpad chat wheel speech
  if (code >= 25 && code <= 32) {
    return {
      speechSoundId: cls.chatBase + 2 * (code - 25),
      eventCode: code,
      unit: unitRef,
      x: unit.x,
      y: unit.y,
    }
  }

  // Codes 33..83 (0x6fad3297..0x6fad34a6): per-class quest monologues (+ quest music stingers)
  if (code >= 33 && code <= 83) {
    const speechSoundId = cls.questBase + (code - 33)
    const stingerSoundId = QUEST_STINGER_BY_0x2C_CODE_113C[code]
    const delayTicks = QUEST_VOICE_DELAY12_CODES.has(code) ? 12 : undefined
    return {
      speechSoundId,
      ...(stingerSoundId !== undefined ? { stingerSoundId } : {}),
      eventCode: code,
      unit: unitRef,
      x: unit.x,
      y: unit.y,
      ...(delayTicks !== undefined ? { delayTicks } : {}),
    }
  }

  return null
}

/**
 * Resolve weapon physical + elemental hit impact sound IDs (`Sounds.txt` rows) from `hitClass` byte
 * (`D2Client.dll` `0x6fad27e0` `UNIT_ResolveHitClassSound`, called from `0x6fad3630`).
 *
 * - Base nibble `base = hitClass & 0x0F` (jump table `0x6fad2968` for `base = 1..12`):
 *   - `0x01`: `321` (`0x141`, `impact_punch_1`)
 *   - `0x02..0x05`: `341` (`0x155`, `impact_blade_swing_1`)
 *   - `0x06..0x07`: `335` (`0x14f`, `impact_blade_thrust_1`)
 *   - `0x08..0x09`: `329` (`0x149`, `impact_blunt_1`)
 *   - `0x0A..0x0B`: `347` (`0x15b`, `impact_arrow_1`)
 *   - `0x0C`: `325` (`0x145`, `impact_claw_1`)
 * - Elemental / special upper nibble `elem = hitClass & 0xF0` (jump table `0x6fad2998` via `0x6fad29c0`):
 *   - `0x10` (Double): `379` (`0x17b`, `impact_double_1`) when `baseSound !== 0`
 *   - `0x20` (Fire): `356` (`0x164`, `impact_fire_layer_1`) when `baseSound !== 0`, else `353` (`0x161`, `impact_fire_1`)
 *   - `0x30` (Cold): `362` (`0x16a`, `impact_cold_layer_1`) when `baseSound !== 0`, else `359` (`0x167`, `impact_cold_1`)
 *   - `0x40` (Lightning): `372` (`0x174`, `impact_lightning_layer_1`) when `baseSound !== 0`, else `368` (`0x170`, `impact_lightning_1`)
 *   - `0x50` (Poison): `376` (`0x178`, `impact_poison_1`)
 *   - `0x60` (Stun): `382` (`0x17e`, `impact_stun_1`)
 *   - `0x70` (Bash): `395` (`0x18b`, `impact_bash`)
 *   - `0x80` (Thorns): `2390` (`0x956`, `paladin_thorns_hit`)
 *   - `0xB0` (Goo): `391` (`0x187`, `impact_goo_1`)
 */
export function resolveHitClassSoundIds113c(hitClass: number): readonly number[] {
  const h = (hitClass | 0) & 0xff
  if (h === 0) return []
  const baseNibble = h & 0x0f
  const elemNibble = h & 0xf0

  let baseSound = 0
  switch (baseNibble) {
    case 0x01:
      baseSound = 321 // 0x141 impact_punch_1
      break
    case 0x02:
    case 0x03:
    case 0x04:
    case 0x05:
      baseSound = 341 // 0x155 impact_blade_swing_1
      break
    case 0x06:
    case 0x07:
      baseSound = 335 // 0x14f impact_blade_thrust_1
      break
    case 0x08:
    case 0x09:
      baseSound = 329 // 0x149 impact_blunt_1
      break
    case 0x0a:
    case 0x0b:
      baseSound = 347 // 0x15b impact_arrow_1
      break
    case 0x0c:
      baseSound = 325 // 0x145 impact_claw_1
      break
    default:
      baseSound = 0
      break
  }

  let elemSound = 0
  switch (elemNibble) {
    case 0x10:
      elemSound = baseSound !== 0 ? 379 : 0 // 0x17b impact_double_1
      break
    case 0x20:
      elemSound = baseSound !== 0 ? 356 : 353 // 0x164 impact_fire_layer_1 : 0x161 impact_fire_1
      break
    case 0x30:
      elemSound = baseSound !== 0 ? 362 : 359 // 0x16a impact_cold_layer_1 : 0x167 impact_cold_1
      break
    case 0x40:
      elemSound = baseSound !== 0 ? 372 : 368 // 0x174 impact_lightning_layer_1 : 0x170 impact_lightning_1
      break
    case 0x50:
      elemSound = 376 // 0x178 impact_poison_1
      break
    case 0x60:
      elemSound = 382 // 0x17e impact_stun_1
      break
    case 0x70:
      elemSound = 395 // 0x18b impact_bash
      break
    case 0x80:
      elemSound = 2390 // 0x956 paladin_thorns_hit
      break
    case 0xb0:
      elemSound = 391 // 0x187 impact_goo_1
      break
    default:
      elemSound = 0
      break
  }

  if (baseSound > 0 && elemSound > 0) return [baseSound, elemSound]
  if (baseSound > 0) return [baseSound]
  if (elemSound > 0) return [elemSound]
  return []
}

/**
 * Resolve shield / weapon block sound ID (`Sounds.txt` row) from `hitClass` byte
 * (`D2Client.dll` `0x6fad21c0` `UNIT_ResolveBlockSound`, called from `0x6fad2d60`).
 * - `base = 0x0A..0x0B` (Bow / Crossbow): `401` (`0x191`, `block_arrow_1`)
 * - `base = 0x01..0x09` (or default `0x00`): `398` (`0x18e`, `block_weapon_1`)
 */
export function resolveBlockSoundId113c(hitClass: number): number {
  const baseNibble = (hitClass | 0) & 0x0f
  if (baseNibble === 0x0a || baseNibble === 0x0b) {
    return 401 // 0x191 block_arrow_1
  }
  return 398 // 0x18e block_weapon_1
}
