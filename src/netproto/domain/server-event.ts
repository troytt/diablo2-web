/**
 * Protocol-neutral `ServerEvent` discriminated union (PROJECT.md § Interface Contracts).
 */

import type {
  Hand,
  ItemContainer,
  ItemData,
  ItemStat,
  Pt,
  SkillLevel,
  UnitRef,
  UnitSnapshot,
  UnitType,
} from './ids.ts'

/**
 * The `int s[7]` a D2Client 1.13c NPC unit handler (S2C 0x67..0x6D) builds before calling
 * `0x6FADA750` → monster command function `0x6FAFDC70`, plus the server position it hands to the
 * drift check `0x6FADA1B0` first. `s[6]` is `null` where the original leaves that stack slot
 * uninitialised (0x6A / 0x6C).
 */
export interface NpcCommandArgs {
  readonly opcode: 0x67 | 0x68 | 0x69 | 0x6a | 0x6b | 0x6c | 0x6d
  /** Monster command 0..0x1D (cmd → mode table 0x6FB82E68); 0x6D always issues 7. */
  readonly cmd: number
  readonly s: readonly [number, number, number, number, number, number, number | null]
  /** `(x, y)` passed to 0x6FADA1B0 before the command (0x68 / 0x6B / 0x6C / 0x6D only). */
  readonly driftCheckAt?: Pt | null | undefined
}

export type NpcCommandPayload113c = NpcCommandArgs

/** One state of an S2C 0xAA AddUnitState packet (D2Client 0x6fb5db90, loop 0x6fb5dbd7-0x6fb5dd14). */
export interface StateSetEntry {
  readonly state: number
  /** The stats after the state's `hasStats` bit; absent when the bit is clear. */
  readonly stats?: readonly ItemStat[] | undefined
  /** The stats ended with the 0x1ff terminator (or there were none), so the set function ran (0x6fb5dcfa). */
  readonly complete: boolean
}

export type ServerEvent =
  | { readonly type: 'GameLoading' }
  | { readonly type: 'UnloadAct' }
  | {
      readonly type: 'GameLogonAck'
      readonly playerUnitId: number
      readonly mapSeed: number
      readonly difficulty: 0 | 1 | 2
      readonly act?: number | undefined
      readonly areaId?: number | undefined
    }
  | {
      readonly type: 'PlayerAssign'
      readonly unitId: number
      readonly classId?: number | undefined
      readonly charClass?: number | undefined
      readonly charName?: string | undefined
      readonly name?: string | undefined
      readonly x: number
      readonly y: number
      readonly areaId?: number | undefined
    }
  | {
      readonly type: 'ProtocolSync'
      readonly opcode: number
      readonly byteLength: number
      readonly entries?:
        | readonly {
            readonly unitType: UnitType
            readonly id: number
            readonly x: number
            readonly y: number
          }[]
        | undefined
      readonly monsterEnchant?:
        | {
            readonly monsterId: number
            readonly enchantType: number
            readonly textId: number
            readonly prefix: number
            readonly suffix: number
            readonly field10: number
          }
        | undefined
      readonly npcGossip?:
        | {
            readonly npcId: number
            readonly flag: number
          }
        | undefined
    }
  | {
      readonly type: 'MonsterSpecial'
      readonly classId: number
    }
  | {
      readonly type: 'CreateMissile'
      readonly missileId?: number | undefined
      readonly missileClassId: number
      readonly at: Pt
      readonly target: Pt
      readonly x?: number | undefined
      readonly y?: number | undefined
      readonly targetX?: number | undefined
      readonly targetY?: number | undefined
      readonly skillId?: number | undefined
      readonly level: number
      readonly owner?: UnitRef | undefined
      readonly ownerType?: UnitType | undefined
      readonly ownerId?: number | undefined
      readonly velocity?: number | undefined
      readonly range?: number | undefined
      readonly unk?: number | undefined
      readonly cltDoFuncArg?: number | undefined
      readonly pierceIdx?: number | undefined
      readonly areaId?: number | undefined
    }
  | {
      readonly type: 'GameFlags'
      readonly difficulty: 0 | 1 | 2
      readonly hardcore: boolean
      readonly expansion: boolean
      readonly ladder: boolean
    }
  | {
      readonly type: 'LoadAct'
      readonly act: number
      readonly mapSeed: number
      readonly areaId: number
      readonly objectSeed?: number | undefined
    }
  | {
      /**
       * S2C 0x53 (D2Client 0x6fb5e9c0): the server's act environment clock, applied with
       * D2Common #10358 `InitializeEnvironment(pAct, playerRoom, cycleIndex, ticks, eclipse)`.
       */
      readonly type: 'EnvironmentSync'
      /** Environment cycle row 0..5 (D2DrlgEnvironmentStrc +0x00). */
      readonly cycleIndex: number
      /** Signed tick counter (D2DrlgEnvironmentStrc +0x08). */
      readonly ticks: number
      /** Tainted Sun eclipse flag (D2DrlgEnvironmentStrc +0x30). */
      readonly eclipse: boolean
    }
  | { readonly type: 'LoadComplete' }
  | { readonly type: 'UnloadComplete' }
  | { readonly type: 'GameLogout'; readonly reason?: number | undefined }
  | {
      readonly type: 'CanGoToAct'
      readonly act: number
    }
  | {
      readonly type: 'OpenUi'
      readonly unitType: number
      readonly unitId: number
      readonly uiId: number
      readonly extra?: number | undefined
    }
  | {
      readonly type: 'RoomReveal'
      readonly areaId: number
      readonly tileX: number
      readonly tileY: number
      readonly tileW?: number | undefined
      readonly tileH?: number | undefined
      readonly roomSeed?: number | undefined
    }
  | {
      readonly type: 'RoomHide'
      readonly areaId: number
      readonly tileX: number
      readonly tileY: number
    }
  | {
      readonly type: 'UnitAssign'
      readonly unit: UnitSnapshot
      readonly unitType?: UnitType | undefined
      readonly unitId?: number | undefined
      readonly classId?: number | any
      readonly x?: number | undefined
      readonly y?: number | undefined
      readonly areaId?: number | undefined
      readonly name?: string | undefined
      readonly isSelf?: boolean | undefined
    }
  | {
      readonly type: 'UnitRemove'
      readonly unitType: UnitType
      readonly id: number
      readonly unitId?: number | undefined
      readonly areaId?: number | undefined
    }
  | {
      readonly type: 'UnitMove'
      readonly unitType: UnitType
      readonly id: number
      readonly unitId?: number | undefined
      readonly mode: 'walk' | 'run' | 'knockback' | 'stop'
      readonly from?: Pt | undefined
      readonly to: Pt
      readonly x?: number | undefined
      readonly y?: number | undefined
      readonly currentX?: number | undefined
      readonly currentY?: number | undefined
      readonly targetX?: number | undefined
      readonly targetY?: number | undefined
      readonly moveType?: number | undefined
      readonly areaId?: number | undefined
      readonly target?: UnitRef | undefined
      readonly velocityPercent?: number | undefined
      readonly pathType?: number | undefined
      /** Monster NPC packets 0x67 / 0x68 / 0x6D. */
      readonly npc?: NpcCommandArgs | undefined
    }
  | {
      readonly type: 'UnitReassign'
      readonly unitType: UnitType
      readonly id: number
      readonly unitId?: number | undefined
      readonly at: Pt
      readonly x?: number | undefined
      readonly y?: number | undefined
      readonly areaId?: number | undefined
      readonly snap: boolean
    }
  | {
      readonly type: 'UnitStatUpdate'
      readonly unitType: UnitType
      readonly unitId: number
      readonly statId?: number | undefined
      readonly value?: number | undefined
      readonly stats?: Readonly<Record<string, number>> | undefined
      readonly areaId?: number | undefined
    }
  | {
      readonly type: 'UnitState'
      readonly unitType: UnitType
      readonly unitId: number
      readonly state: number | string
      readonly active: boolean
      readonly mode?: number | undefined
      readonly areaId?: number | undefined
    }
  | {
      readonly type: 'SkillUpdate'
      readonly unitId: number
      readonly skillId: number
      readonly level: number
      readonly bonus?: number | undefined
    }
  | {
      readonly type: 'UnitMode'
      readonly unitType: UnitType
      readonly id: number
      readonly mode?: number | undefined
      readonly at?: Pt | undefined
      readonly hitClass?: number | undefined
      readonly lifePct?: number | undefined
      /** Monster NPC packets 0x69 / 0x6A / 0x6B / 0x6C. */
      readonly npc?: NpcCommandArgs | undefined
      /**
       * S2C 0x0E only: `pkt[6]`, the object event of ObjectEvent 0x6fad5ce0 (3 = set mode and light,
       * 0x15 = operate fx without a mode change, anything else fatal). Absent for every other producer.
       */
      readonly eventCode?: number | undefined
      /** S2C 0x0E only: `pkt[7]` (door path for doors, player id for event 0x15). */
      readonly eventFlag?: number | undefined
    }
  | {
      /**
       * S2C 0x11 (D2Client 0x6FB5DAA0): put Overlay.txt record `overlayIndex` on unit (`rawUnitType`, `id`).
       * Never changes mode / HP / death / position. `rawUnitType` is the wire byte (6 = no unit).
       */
      readonly type: 'UnitOverlay'
      readonly rawUnitType: number
      readonly id: number
      readonly overlayIndex: number
    }
  | {
      /**
       * S2C 0x76 (D2Client 0x6FB5D370): find unit (`rawUnitType`, `id`) and free its overhead hover message
       * (unit+0xA4, D2Common #10422 CHAT_FreeHoverMsg). Sent by D2Game `sub_6FCC5FA0` when a unit's hover
       * text expired or was freed (e.g. at death, `sub_6FC63E80`). Never changes mode / HP / ISDEAD.
       * `rawUnitType` is the wire byte (6 / id 0xFFFFFFFF = no unit).
       */
      readonly type: 'UnitHoverTextClear'
      readonly rawUnitType: number
      readonly id: number
    }
  | {
      readonly type: 'CorpseAssign'
      readonly assign: number
      readonly ownerId: number
      readonly corpseId: number
    }
  | {
      readonly type: 'SkillCast'
      readonly caster: UnitRef
      readonly skill: number
      readonly skillId?: number | undefined
      readonly level: number
      readonly target: UnitRef | Pt
      readonly at?: Pt | undefined
      readonly owner?: UnitRef | undefined
    }
  | {
      /**
       * S2C 0xA3 (24 B, D2Client 0x6FB5EFB0; serializer D2Game 0x6FCABA90): run Skills.txt row `skill`'s
       * client function `cltprgfunc1` for caster → target (0x6FB51B10). Thunder Storm strikes use it
       * (fn #84 → ForceLightning). Unit types are the raw wire bytes: the handler looks units up
       * without a type range check (0x6FB54E20).
       */
      readonly type: 'UnitSkillEvent'
      /** `@1`: stored at caster+0x28 when a target unit exists (0x6FB51B10); meaning not analysed. */
      readonly flag: number
      /** `@2` i16 Skills.txt row. */
      readonly skill: number
      /** `@4` i16 skill level. */
      readonly level: number
      /** `@6` u8 type, `@7` u32 id. */
      readonly caster: { readonly rawUnitType: number; readonly id: number }
      /** `@11` u8 type, `@12` u32 id. */
      readonly target: { readonly rawUnitType: number; readonly id: number }
      /** `@16` / `@20` u32 path X / Y, used only without a target unit (0 for Thunder Storm). */
      readonly x: number
      readonly y: number
    }
  | {
      readonly type: 'StatSet'
      readonly stat: number
      readonly value: number
      readonly param?: number | undefined
      readonly flag?: number | undefined
      readonly unit?: UnitRef | undefined
    }
  | {
      readonly type: 'LifeMana'
      readonly life: number
      readonly mana: number
      readonly stamina: number
      readonly lifeRegen?: number | undefined
      readonly manaRegen?: number | undefined
      readonly at?: Pt | undefined
      readonly vx?: number | undefined
      readonly vy?: number | undefined
    }
  | {
      readonly type: 'Experience'
      readonly value: number
      readonly isDelta?: boolean | undefined
    }
  | {
      readonly type: 'StateSet'
      readonly unit: UnitRef
      /** The (first) state set. */
      readonly state: number
      /** Its stats (the first state's for 0xAA). */
      readonly stats?: readonly ItemStat[] | undefined
      /** S2C packet that carried the state: 0xA5, 0xA7, 0xA8 or 0xAA (absent for synthetic events). */
      readonly origin?: 0xa5 | 0xa7 | 0xa8 | 0xaa | undefined
      /**
       * 0xA8: the stat list ended with the 0x1ff terminator, so D2Client 0x6fb5dd70 reached the state
       * set-function dispatch 0x6fb22530 (0x6fb5dea3); a bail-out (unknown stat, Send Bits 0, exhausted
       * bits) skips it.
       */
      readonly complete?: boolean | undefined
      /**
       * 0xAA: every state of the packet in order (D2Client 0x6fb5db90 sets each one, 0x6fb5dc03). A state
       * whose stats bailed out is `complete: false` and ends the packet (0x6fb5db90 returns).
       */
      readonly states?: readonly StateSetEntry[] | undefined
    }
  | {
      readonly type: 'StateEnd'
      readonly unit: UnitRef
      readonly state: number
    }
  | {
      /** 0xA5 StateSkillEffect (8B, D2Client.dll 0x6fb5f7f0 -> 0x6fb227a0). */
      readonly type: 'StateSkillEffect'
      readonly unit: UnitRef
      readonly skillId: number
    }
  | {
      readonly type: 'ItemEvent'
      readonly action: number | string
      readonly item?: ItemData | any
      readonly itemId?: number | any
      readonly code?: string | undefined
      readonly x?: number | undefined
      readonly y?: number | undefined
      readonly container: ItemContainer
      readonly quality?: number | undefined
      readonly itemLevel?: number | undefined
      readonly identified?: boolean | undefined
      readonly rawBytes?: Uint8Array | undefined
      readonly ownerId?: number | undefined
      readonly bodyLoc?: number | undefined
      readonly areaId?: number | undefined
      readonly at?: Pt | undefined
    }
  | {
      /**
       * 0x97 WeaponSwitch (1B, header only; D2MOO D2Game `GAME/SCmd.cpp:2361-2369`
       * `D2GAME_PACKETS_SendPacket0x97_6FC3FB60`). The swap handler (`ITEMS/ItemMode.cpp` `sub_6FC46840`
       * 3173-3224) physically moves the items 4<->11 / 5<->12, toggles the client's switch flag and sends
       * 0x97; each moved item then arrives as a 0x9D action 0x17 `ItemEvent` carrying its NEW body loc
       * (`INVENTORY/InvMode.cpp:178-181`). Also sent once at join when the saved tab is II
       * (`PLAYER/PlrSave2.cpp:1549-1551`). It flips only the I/II tab (#765).
       */
      readonly type: 'WeaponSwitch'
    }
  | {
      /** 0x42 ClearCursor (6B, D2Client.dll 0x6fb5db70 -> 0x6fb32f50). */
      readonly type: 'CursorClear'
      readonly unitType: UnitType
      readonly id: number
    }
  | {
      /**
       * 0x7C UseSpecialItem (6B, D2Client.dll 0x6fb5d2a0 -> 0x6fb31aa0):
       * Sent by D2Game.dll (0x6fcac3b0) after using a Tome (`tbk`/`ibk`) or item spell.
       * Looks up existing unit `(unitType, id)` via `D2CLIENT_FindClientSideUnit` (0x6fb54e20)
       * and expires temporary StatList 0x36 (`STATLIST_GetStatListFromUnitAndFlag(pUnit, 0x36)`).
       * Never modifies `eMode` and never spawns a ground/world unit.
       */
      readonly type: 'UseSpecialItem'
      readonly unitType: UnitType
      readonly id: number
    }
  | {
      /**
       * 0x7D SetItemState (18B, D2Client.dll 0x6fb5e1f0 -> 0x6fb34df0; D2Game.dll 0x6FC3EFC0).
       * Wire: `[0x7D, u8 ownerType, u32 ownerId, u32 itemId, u32 flag, u32 enabled]`.
       * Sent only from InvMode.cpp with `flag = IFLAG_BROKEN (0x100)` or `IFLAG_REPAIRED (0x200)`.
       * The client handler only ever toggles IFLAG_BROKEN: 0x100 -> SetItemFlag(0x100, enabled),
       * 0x200 -> SetItemFlag(0x100, 0); any other flag is ignored. It never touches IFLAG_IDENTIFIED.
       */
      readonly type: 'ItemFlagUpdate'
      readonly ownerType: number
      readonly ownerId: number
      readonly itemId: number
      readonly flag: number
      readonly enabled: number
    }
  | {
      /**
       * 0x47 Relator1 / 0x48 Relator2 (11B, D2Client.dll 0x6fb5e2b0 / 0x6fb5e260):
       * Looks up the unit `(pkt[1], u32 @3)` via 0x6fb54e20 and only refreshes it (0x6fb32fe0).
       * Carries no item stat or flag update.
       */
      readonly type: 'ItemRelate'
      readonly opcode: 0x47 | 0x48
      readonly param: number
      readonly itemId: number
      readonly value: number
    }
  | {
      readonly type: 'SkillList'
      readonly unitId: number
      readonly unitType?: UnitType | undefined
      readonly flag?: number | undefined
      readonly skills: readonly SkillLevel[]
    }
  | {
      readonly type: 'ActiveSkill'
      readonly unitId: number
      readonly hand: Hand
      readonly skill: number
      readonly itemId?: number | undefined
    }
  | {
      readonly type: 'Npc'
      readonly kind: 'info' | 'menu' | 'heal' | 'setTalk' | 'assign' | 'wantsInteract'
      readonly npcId?: number | undefined
      readonly unitId?: number | undefined
      readonly unitType?: number | undefined
      readonly count?: number | undefined
      readonly classId?: number | undefined
      readonly x?: number | undefined
      readonly y?: number | undefined
      readonly messages?: readonly { readonly menu: number; readonly stringId: number }[] | undefined
      readonly allMessages?: readonly { readonly menu: number; readonly stringId: number }[] | undefined
      readonly act?: number | undefined
      readonly npcFlags?: readonly number[] | undefined
      readonly result?: number | undefined
      readonly raw?: Uint8Array | undefined
    }
  | {
      readonly type: 'NpcInfo'
      readonly kind?: 'info' | undefined
      readonly unitType?: number | undefined
      readonly unitId?: number | undefined
      readonly npcId?: number | undefined
      readonly count?: number | undefined
      readonly messages?: readonly any[] | undefined
      readonly allMessages?: readonly any[] | undefined
      readonly raw?: Uint8Array | undefined
    }
  | {
      /** 0x2A NPCTransaction result (D2Game 0x6fcaac90). `itemId` 0xFFFFFFFF = none. */
      readonly type: 'NpcTransaction'
      readonly result: number
      readonly flag: number
      readonly itemId: number
      /** Server's stat 14 at send time; informational only (the client uses stat 14 updates). */
      readonly gold: number
    }
  | {
      readonly type: 'WaypointMenu'
      readonly unitId: number
      readonly open: readonly number[]
    }
  | {
      readonly type: 'QuestState'
      readonly kind?:
        | 'log'
        | 'update'
        | 'item'
        | 'player'
        | 'history'
        | 'status'
        | 'availability'
        | 'special'
        | undefined
      readonly source?: 0x28 | 0x29 | 0x50 | 0x52 | 0x5d | 0x5e | 0x89 | undefined
      readonly quests: Uint16Array
      readonly flags?: readonly number[] | undefined
      readonly updateType?: number | undefined
      readonly unitId?: number | undefined
      readonly timer?: number | undefined
      readonly historyBytes?: Uint8Array | undefined
      readonly statusBytes?: Uint8Array | undefined
      readonly availabilityBytes?: Uint8Array | undefined
      readonly questStatus?: {
        readonly questId: number
        readonly alertFlags: number
        readonly filterStatus: number
        /** Signed 16-bit integer (`movsx eax, WORD PTR [ecx+0x4]` in `0x6face160`). */
        readonly extra: number
      } | undefined
      readonly specialEventId?: number | undefined
    }
  | {
      readonly type: 'Party'
      readonly kind: 'roster' | 'relation' | 'memberState' | 'memberPos'
      readonly action?: 'join' | 'leave' | 'update' | undefined
      readonly source?: 0x5b | 0x5c | 0x65 | 0x66 | 0x75 | 0x7f | 0x8b | 0x8c | 0x8d | 0x90 | undefined
      readonly unitId?: number | undefined
      readonly playerId?: number | undefined
      readonly otherId?: number | undefined
      readonly partyId?: number | undefined
      readonly relation?: number | undefined
      readonly lifePct?: number | undefined
      readonly areaId?: number | undefined
      readonly at?: Pt | undefined
      readonly charName?: string | undefined
      readonly charClass?: number | undefined
      readonly charLevel?: number | undefined
      readonly isPlayer?: boolean | undefined
      readonly inParty?: boolean | undefined
      readonly members?:
        | readonly {
            readonly playerUnitId: number
            readonly charName: string
            readonly classId: number
            readonly level: number
            readonly areaId: number
            readonly partyId: number
          }[]
        | undefined
    }
  | {
      readonly type: 'Trade'
      readonly action: number
      readonly partnerId?: number | undefined
      readonly partnerName?: string | undefined
      readonly gold?: number | undefined
    }
  | {
      readonly type: 'Chat'
      readonly kind: 'say' | 'whisper' | 'overhead' | 'system' | 'event'
      readonly from?: string | undefined
      readonly speaker?: string | undefined
      readonly unit?: UnitRef | undefined
      readonly text: string
      readonly color?: number | undefined
      readonly eventType?: number | undefined
      readonly arg?: number | undefined
      readonly subType?: number | undefined
      readonly name1?: string | undefined
      readonly name2?: string | undefined
    }
  | {
      readonly type: 'PlaySound'
      readonly unit?: UnitRef | undefined
      readonly sound: number
    }
  | {
      readonly type: 'Merc'
      readonly kind: 'assign' | 'hireList' | 'stat' | 'exp'
      readonly ownerId?: number | undefined
      readonly mercId?: number | undefined
      readonly classId?: number | undefined
      readonly nameId?: number | undefined
      readonly seed?: number | undefined
      readonly stat?: number | undefined
      readonly value?: number | undefined
      readonly isSummonAction?: boolean | undefined
      readonly summonAction?: number | undefined
      readonly petType?: number | undefined
    }
  | {
      readonly type: 'Portal'
      readonly portalId?: number | any
      readonly ownerName?: string | undefined
      readonly ownerId?: number | undefined
      readonly areaId: number
      readonly destAreaId?: number | undefined
      readonly x?: number | undefined
      readonly y?: number | undefined
      readonly localId: number
      readonly remoteId?: number | undefined
      readonly flags?: number | undefined
    }
  | {
      readonly type: 'Pong'
      readonly rttMs: number
      readonly tickCount: number
    }
  | {
      readonly type: 'Warden'
      readonly payload: Uint8Array
    }
  | {
      readonly type: 'SaveChunk'
      readonly isFirst: boolean
      readonly totalSize: number
      readonly chunk: Uint8Array
    }
  | {
      readonly type: 'Opaque'
      readonly proto: string
      readonly id: number
      readonly raw: Uint8Array
    }
