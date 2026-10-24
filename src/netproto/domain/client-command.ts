/**
 * Protocol-neutral `ClientCommand` discriminated union (PROJECT.md § Interface Contracts).
 */

import type { Hand, Pt, UnitRef, UnitType } from './ids.ts'

export type ClientCommand =
  | {
      readonly type: 'Move'
      readonly run?: boolean | undefined
      readonly to?: Pt | undefined
      readonly x?: number | undefined
      readonly y?: number | undefined
    }
  | { readonly type: 'WalkToLocation'; readonly x: number; readonly y: number }
  | { readonly type: 'RunToLocation'; readonly x: number; readonly y: number }
  | { readonly type: 'MoveToUnit'; readonly run: boolean; readonly target: UnitRef }
  /** 0x59 MakeEntityMove: request target entity to move toward coordinates (used on NPC interaction within dist <= 25). */
  | {
      readonly type: 'MakeEntityMove'
      readonly target: UnitRef
      readonly to?: Pt | undefined
      readonly x?: number | undefined
      readonly y?: number | undefined
      readonly unitType?: number | undefined
      readonly unitId?: number | undefined
      readonly npcId?: number | undefined
    }
  | { readonly type: 'WalkToTarget'; readonly unitKind: UnitType; readonly unitId: number }
  | { readonly type: 'RunToTarget'; readonly unitKind: UnitType; readonly unitId: number }
  | { readonly type: 'UpdatePlayerPos'; readonly x: number; readonly y: number }
  /**
   * Skill on location, 1.13c D2Client 0x6faca060 SendSkillPacket(bOnUnit=0):
   * L 0x05 / L hold 0x08, R 0x0C / R hold 0x0F. Location packets have no shift variant.
   * `hold` = ClickInfo flag 0x8 (mouse-hold repeat tick), required.
   */
  | { readonly type: 'SkillAt'; readonly hand: Hand; readonly at: Pt; readonly hold: boolean }
  /** Press (non-hold) left skill on location: 0x05 (1.13c D2Client 0x6faca886). */
  | { readonly type: 'CastLeftSkillOnLocation'; readonly x: number; readonly y: number }
  /** Press (non-hold) right skill on location: 0x0C (1.13c D2Client 0x6facaa4a). */
  | { readonly type: 'CastRightSkillOnLocation'; readonly x: number; readonly y: number }
  | {
      readonly type: 'CastSkillAtLocation'
      readonly skillId: number
      readonly x: number
      readonly y: number
      readonly hand?: Hand | undefined
      readonly hold?: boolean | undefined
    }
  /**
   * Skill on unit, 1.13c D2Client 0x6faca060 SendSkillPacket(bOnUnit=1):
   * L 0x06 / shift 0x07 / hold 0x09 / shift+hold 0x0A; R 0x0D / 0x0E / 0x10 / 0x11.
   * `shift` = ClickInfo flag 0x20 (stand-still key), `hold` = ClickInfo flag 0x8; both required.
   */
  | {
      readonly type: 'SkillOn'
      readonly hand: Hand
      readonly target: UnitRef
      readonly shift: boolean
      readonly hold: boolean
    }
  | { readonly type: 'CastLeftSkillOnTarget'; readonly unitKind: UnitType; readonly unitId: number }
  | { readonly type: 'CastRightSkillOnTarget'; readonly unitKind: UnitType; readonly unitId: number }
  | {
      readonly type: 'CastSkillOnTarget'
      readonly skillId: number
      readonly targetType: UnitType
      readonly targetId: number
      readonly hand?: Hand | undefined
      readonly shift?: boolean | undefined
      readonly hold?: boolean | undefined
    }
  | {
      readonly type: 'SelectSkill'
      readonly hand: Hand
      readonly skill?: number | undefined
      readonly skillId?: number | undefined
      readonly itemId?: number | undefined
    }
  /** 0x51 AssignSkillHotkey (9B, D2Client.dll 0x6faed2b6): bind or unbind (skill=0xffff) a skill hotkey slot (0..15). */
  | {
      readonly type: 'AssignSkillHotkey'
      readonly slot: number
      readonly hand: Hand
      readonly skill: number
      readonly itemId?: number | undefined
    }
  /** 0x53 TurnOnRun / 0x54 TurnOffRun (1B, D2Client.dll 0x6faeae40 / 0x6faeadf0). */
  | { readonly type: 'RunToggle'; readonly run: boolean }
  | { readonly type: 'Interact'; readonly target: UnitRef }
  | {
      readonly type: 'InteractEntity'
      readonly targetType: UnitType | 'warp'
      readonly targetId: number
    }
  | { readonly type: 'OperateObject'; readonly objectId: number }
  | { readonly type: 'TakeWarp'; readonly warpId: number; readonly at?: Pt | undefined }
  | { readonly type: 'WarpTo'; readonly warpId: number; readonly unitType?: number | undefined }
  | { readonly type: 'ItemPickup'; readonly itemId: number; readonly toCursor?: boolean | undefined }
  | { readonly type: 'PickUpItem'; readonly itemId: number; readonly toCursor?: boolean | undefined }
  | { readonly type: 'ItemDrop'; readonly itemId: number }
  /** 0x50 DropGold: drop `amount` inventory gold of player `unitId` on the ground. */
  | { readonly type: 'DropGold'; readonly unitId: number; readonly amount: number }
  | { readonly type: 'ItemToCursor'; readonly itemId: number }
  | {
      readonly type: 'ItemPlace'
      readonly itemId: number
      readonly x: number
      readonly y: number
      readonly buffer: number
    }
  | {
      readonly type: 'ItemMove'
      readonly itemId: number
      readonly container: 'inventory' | 'stash' | 'cube' | 'belt'
      readonly x: number
      readonly y: number
    }
  | {
      readonly type: 'ItemEquip'
      readonly itemId: number
      readonly slot?: number | undefined
      readonly bodyLoc?: number | undefined
    }
  | { readonly type: 'ItemUnequip'; readonly slot: number }
  | { readonly type: 'ItemSwap'; readonly itemId: number; readonly slot: number }
  | { readonly type: 'ItemSwap2Handed'; readonly itemId: number; readonly slot: number }
  | { readonly type: 'ItemSwap2HandedDual'; readonly itemId: number; readonly slot: number }
  | {
      readonly type: 'SwapContainerItem'
      readonly cursorItemId: number
      readonly targetItemId?: number | undefined
      readonly replacedItemId?: number | undefined
      readonly x: number
      readonly y: number
    }
  | { readonly type: 'BeltPut'; readonly itemId: number; readonly slot: number }
  | { readonly type: 'BeltRemove'; readonly itemId: number }
  | { readonly type: 'BeltSwap'; readonly cursorItemId: number; readonly beltItemId: number }
  | {
      readonly type: 'BeltUse'
      readonly itemId: number
      readonly shift?: boolean | undefined
      readonly useOnMerc?: number | boolean | undefined
    }
  | { readonly type: 'ItemUse'; readonly itemId: number; readonly at: Pt }
  /** 0x3E SelectMainItem (5B, D2Client.dll 0x6fb2f20b -> D2Game.dll 0x6fc56070): use special quest scroll (`bkd`, `trs`). */
  | { readonly type: 'SelectMainItem'; readonly itemId: number }
  | { readonly type: 'SocketItem'; readonly itemId: number; readonly targetItemId: number }
  | { readonly type: 'IdentifyItem'; readonly itemId: number; readonly scrollId: number }
  | { readonly type: 'ScrollToBook'; readonly scrollId: number; readonly bookId: number }
  /** 0x2A ItemToCubeIndirect (9B, D2Client.dll 0x6fb4712a / D2Game.dll 0x6fc866e0): place cursor item directly into Horadric Cube item icon. */
  | { readonly type: 'ItemToCube'; readonly itemId: number; readonly cubeId: number }
  /** 0x63 ItemToBelt (5B, D2Client.dll 0x6fb46ff8 / D2Game.dll 0x6fc86530): Shift+Left-Click auto-place item from inventory into belt. */
  | { readonly type: 'ItemToBelt'; readonly itemId: number }
  | { readonly type: 'MercItem'; readonly slot: number }
  | { readonly type: 'NpcInit'; readonly target: UnitRef }
  | {
      readonly type: 'NpcCancel'
      readonly target?: UnitRef | undefined
      readonly npcId?: number | undefined
    }
  | { readonly type: 'QuestMessage'; readonly npcId: number; readonly messageId: number }
  /** 0x4D PlayNpcMessage (3B): u8 0x4D | u16 classId (MonStats hcIdx); 0x39 PlayNpcMessage (9B). */
  | {
      readonly type: 'PlayNpcMessage'
      readonly classId?: number | undefined
      readonly npcClassId?: number | undefined
      readonly hcIdx?: number | undefined
      readonly target?: UnitRef | undefined
      readonly unitType?: number | undefined
      readonly unitId?: number | undefined
      readonly npcId?: number | undefined
      readonly messageId?: number | undefined
    }
  /** 0x38 action 1: open the vendor trade window (server fills the shop with 0x9C AddToShop). */
  | { readonly type: 'NpcOpenTrade'; readonly npcId: number }
  /** 0x38 action 2: open the gamble window. */
  | { readonly type: 'NpcOpenGamble'; readonly npcId: number }
  | {
      readonly type: 'NpcEntityAction'
      readonly action: number
      readonly npcId: number
      readonly complement?: number | undefined
    }
  | {
      readonly type: 'NpcAction'
      readonly action: number | string
      readonly npcId: number
      readonly param?: number | undefined
      readonly complement?: number | undefined
    }
  | {
      /** 0x32 BuyItem; field3 = (itemMode << 16) | (gamble ? 2 : 0) | (shiftFill ? 0x80000000 : 0). */
      readonly type: 'NpcBuy'
      readonly npcId: number
      readonly itemId: number
      readonly itemMode?: number | undefined
      readonly buyType?: number | undefined
      readonly gamble?: boolean | undefined
      readonly shiftFill?: boolean | undefined
      readonly cost?: number | undefined
    }
  | {
      readonly type: 'NpcGamble'
      readonly npcId: number
      readonly itemId: number
      readonly cost?: number | undefined
    }
  | {
      /** 0x33 SellItem; field3 = itemMode. */
      readonly type: 'NpcSell'
      readonly npcId: number
      readonly itemId: number
      readonly itemMode?: number | undefined
      readonly cost?: number | undefined
    }
  | {
      /** 0x35 Repair one item: field3 = itemMode, field4 = current durability (stat 72). */
      readonly type: 'NpcRepairItem'
      readonly npcId: number
      readonly itemId: number
      readonly itemMode: number
      readonly durability: number
    }
  /** 0x35 Repair all: itemId 0, field3 0, field4 0x80000000. */
  | { readonly type: 'NpcRepairAll'; readonly npcId: number }
  | { readonly type: 'NpcHeal'; readonly npcId: number }
  | { readonly type: 'NpcIdentifyAll'; readonly npcId: number }
  /** 0x37 IdentifyFromGamble (5B): u8 0x37 | u32 itemId (D2Game 0x6fc86c30 -> 0x6fcca990). */
  | { readonly type: 'NpcIdentifyGamble'; readonly itemId: number }
  | { readonly type: 'NpcResurrectMerc'; readonly npcId: number }
  | { readonly type: 'MercResurrect'; readonly npcId: number }
  | { readonly type: 'HireMerc'; readonly npcId: number; readonly mercId: number }
  | { readonly type: 'MercHire'; readonly npcId: number; readonly mercId: number }
  | { readonly type: 'AddStatPoint'; readonly statId: number; readonly count?: number | undefined }
  | {
      readonly type: 'AllocateStat'
      readonly statId: number
      readonly amount?: number | undefined
      readonly count?: number | undefined
    }
  | { readonly type: 'AddSkillPoint'; readonly skillId: number }
  | { readonly type: 'AllocateSkill'; readonly skillId: number }
  | { readonly type: 'WaypointGo'; readonly waypointId: number; readonly destAreaId: number }
  | { readonly type: 'TownPortal' }
  /** 0x4F ClickButton: see `ClickButtonId` (0x12 close stash, 0x13 withdraw, 0x14 deposit, 0x18 transmute). */
  | {
      readonly type: 'ClickButton'
      readonly buttonId?: number | undefined
      readonly button?: number | undefined
      readonly amount?: number | undefined
      readonly complement?: number | undefined
    }
  | { readonly type: 'Party'; readonly action: number; readonly targetPlayerId: number }
  | { readonly type: 'PartyAction'; readonly action: number; readonly targetPlayerId: number }
  | {
      readonly type: 'Hostile'
      readonly targetPlayerId: number
      readonly hostile: boolean
      readonly button?: number | undefined
    }
  | { readonly type: 'Trade'; readonly action: number; readonly gold: number }
  | { readonly type: 'Chat'; readonly text: string; readonly whisperTo?: string | undefined }
  | { readonly type: 'OverheadChat'; readonly text: string }
  /** 0x3F Say (3B, D2Client.dll 0x6fae9c80..0x6fae9d60 -> 0x6fad9bf0): Numpad 0..7 voice emote phrase (25..32). */
  | { readonly type: 'Say'; readonly phraseId: number }
  | { readonly type: 'RequestQuestData' }
  | {
      /** 0x44 StaffInOrifice (17B, D2Client.dll 0x6fb4fd70): state 3 = confirm, state 2 = cancel. */
      readonly type: 'StaffInOrifice'
      readonly orificeObjectId: number
      readonly staffItemId: number
      readonly state: number
      readonly playerUnitId?: number | undefined
    }
  | { readonly type: 'Resurrect' }
  | { readonly type: 'Respawn' }
  | { readonly type: 'SwapWeapons' }
  | { readonly type: 'Ping' }
  | { readonly type: 'LeaveGame' }
  /** 0x48 CancelController (1B, D2Client.dll 0x6fb39a04 / D2Game.dll 0x6fceb4e0): clears pPlayerData->bBusy (+0x4c) on server upon act transition (S2C 0x61 CanGoToAct). */
  | { readonly type: 'CancelController' }
  | PauseGameCommand

export interface PauseGameCommand {
  readonly type: 'PauseGame'
  readonly kind?: 'pauseGame' | undefined
  readonly tick?: number | undefined
  readonly paused: boolean
}
