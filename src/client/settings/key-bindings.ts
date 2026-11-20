/**
 * Diablo II / Project Diablo 2 Configurable Control Actions & KeyBindings
 *
 * Mirrors D2Client.dll Configure Controls table (gmenu.cpp / Configure Controls)
 * with Primary & Secondary key slots, conflict resolution, and localStorage persistence.
 */

import { D2_CMD, defaultBindingCodesForCommand } from './default-key-113c.ts';

export type ControlActionId =
  | 'characterScreen'
  | 'inventoryScreen'
  | 'partyScreen'
  | 'hirelingScreen'
  | 'messageLog'
  | 'questLog'
  | 'helpScreen'
  | 'skillTree'
  | 'skillSpeedBar'
  | 'selectSkill1'
  | 'selectSkill2'
  | 'selectSkill3'
  | 'selectSkill4'
  | 'selectSkill5'
  | 'selectSkill6'
  | 'selectSkill7'
  | 'selectSkill8'
  | 'selectPreviousSkill'
  | 'selectNextSkill'
  | 'showBelt'
  | 'useBeltSlot1'
  | 'useBeltSlot2'
  | 'useBeltSlot3'
  | 'useBeltSlot4'
  | 'swapWeapons'
  | 'toggleRunWalk'
  | 'standStill'
  | 'showItems'
  | 'automap'
  | 'centerAutomap'
  | 'fadeAutomap'
  | 'partyOnAutomap'
  | 'namesOnAutomap'
  | 'toggleMiniMap'
  | 'say'
  | 'clearScreen'
  | 'run'
  | 'sayMessage1'
  | 'sayMessage2'
  | 'sayMessage3'
  | 'sayMessage4'
  | 'sayMessage5'
  | 'sayMessage6'
  | 'sayMessage7'
  | 'sayMessage8'
  | 'clearMessages'
  | 'showPortraits'
  | 'selectSkill9'
  | 'selectSkill10'
  | 'selectSkill11'
  | 'selectSkill12'
  | 'selectSkill13'
  | 'selectSkill14'
  | 'selectSkill15'
  | 'selectSkill16';

export interface KeyBindingSlot {
  primary: string | null;
  secondary: string | null;
}

export type KeyBindingsConfig = Record<ControlActionId, KeyBindingSlot>;

export interface ControlActionDefinition {
  id: ControlActionId;
  labelEn: string;
  labelZh: string;
  /** D2Client.dll command id (`0x6FBA4F10` handler table index). */
  cmdId: number;
  defaultPrimary: string | null;
  defaultSecondary: string | null;
}

/** Defaults come verbatim from the 1.13c `default.key` record of the command (see default-key-113c.ts). */
function def(id: ControlActionId, labelEn: string, labelZh: string, cmdId: number): ControlActionDefinition {
  const [defaultPrimary, defaultSecondary] = defaultBindingCodesForCommand(cmdId);
  return { id, labelEn, labelZh, cmdId, defaultPrimary, defaultSecondary };
}

export const CONTROL_ACTION_DEFINITIONS: readonly ControlActionDefinition[] = [
  def('characterScreen', 'Character Screen', '角色視窗', D2_CMD.characterScreen),
  def('inventoryScreen', 'Inventory Screen', '物品欄視窗', D2_CMD.inventoryScreen),
  def('partyScreen', 'Party Screen', '組隊視窗', D2_CMD.partyScreen),
  def('hirelingScreen', 'Mercenary', '傭兵視窗', D2_CMD.hirelingScreen),
  def('messageLog', 'Message Log', '訊息紀錄', D2_CMD.messageLog),
  def('questLog', 'Quest Log', '任務日誌', D2_CMD.questLog),
  def('helpScreen', 'Help Screen', '說明視窗', D2_CMD.helpScreen),
  def('skillTree', 'Skill Tree', '技能樹視窗', D2_CMD.skillTree),
  def('skillSpeedBar', 'Skill Speed Bar', '技能快捷列', D2_CMD.skillSpeedBar),
  def('selectSkill1', 'Select Skill 1', '選擇技能 1', D2_CMD.selectSkill1 + 0),
  def('selectSkill2', 'Select Skill 2', '選擇技能 2', D2_CMD.selectSkill1 + 1),
  def('selectSkill3', 'Select Skill 3', '選擇技能 3', D2_CMD.selectSkill1 + 2),
  def('selectSkill4', 'Select Skill 4', '選擇技能 4', D2_CMD.selectSkill1 + 3),
  def('selectSkill5', 'Select Skill 5', '選擇技能 5', D2_CMD.selectSkill1 + 4),
  def('selectSkill6', 'Select Skill 6', '選擇技能 6', D2_CMD.selectSkill1 + 5),
  def('selectSkill7', 'Select Skill 7', '選擇技能 7', D2_CMD.selectSkill1 + 6),
  def('selectSkill8', 'Select Skill 8', '選擇技能 8', D2_CMD.selectSkill1 + 7),
  def('selectPreviousSkill', 'Select Previous Skill', '選擇上一個技能', D2_CMD.selectPreviousSkill),
  def('selectNextSkill', 'Select Next Skill', '選擇下一個技能', D2_CMD.selectNextSkill),
  def('showBelt', 'Show Belt', '顯示腰帶', D2_CMD.showBelt),
  def('useBeltSlot1', 'Use Belt Slot 1', '使用腰帶欄位 1', D2_CMD.useBeltSlot1 + 0),
  def('useBeltSlot2', 'Use Belt Slot 2', '使用腰帶欄位 2', D2_CMD.useBeltSlot1 + 1),
  def('useBeltSlot3', 'Use Belt Slot 3', '使用腰帶欄位 3', D2_CMD.useBeltSlot1 + 2),
  def('useBeltSlot4', 'Use Belt Slot 4', '使用腰帶欄位 4', D2_CMD.useBeltSlot1 + 3),
  def('swapWeapons', 'Swap Weapons', '切換武器', D2_CMD.swapWeapons),
  def('toggleRunWalk', 'Toggle Run/Walk', '切換跑步/行走', D2_CMD.toggleRunWalk),
  def('standStill', 'Stand Still', '原地站立', D2_CMD.standStill),
  def('showItems', 'Show Items', '顯示物品', D2_CMD.showItems),
  def('automap', 'Automap', '自動地圖', D2_CMD.automap),
  def('centerAutomap', 'Center Automap', '置中自動地圖', D2_CMD.centerAutomap),
  def('fadeAutomap', 'Fade Automap', '淡化自動地圖', D2_CMD.fadeAutomap),
  def('partyOnAutomap', 'Party on Automap', '地圖顯示隊友', D2_CMD.partyOnAutomap),
  def('namesOnAutomap', 'Names on Automap', '地圖顯示名稱', D2_CMD.namesOnAutomap),
  def('toggleMiniMap', 'Toggle MiniMap', '切換小地圖', D2_CMD.toggleMiniMap),
  def('say', 'Say', '交談', D2_CMD.chat),
  def('clearScreen', 'Clear Screen', '清除畫面視窗', D2_CMD.clearScreen),
  def('run', 'Run', '跑步', D2_CMD.run),
  def('clearMessages', 'Clear Messages', '清除訊息', D2_CMD.clearMessages),
  def('showPortraits', 'Show Portraits', '顯示頭像', D2_CMD.showPortraits),
  def('selectSkill9', 'Select Skill 9', '選擇技能 9', D2_CMD.selectSkill9 + 0),
  def('selectSkill10', 'Select Skill 10', '選擇技能 10', D2_CMD.selectSkill9 + 1),
  def('selectSkill11', 'Select Skill 11', '選擇技能 11', D2_CMD.selectSkill9 + 2),
  def('selectSkill12', 'Select Skill 12', '選擇技能 12', D2_CMD.selectSkill9 + 3),
  def('selectSkill13', 'Select Skill 13', '選擇技能 13', D2_CMD.selectSkill9 + 4),
  def('selectSkill14', 'Select Skill 14', '選擇技能 14', D2_CMD.selectSkill9 + 5),
  def('selectSkill15', 'Select Skill 15', '選擇技能 15', D2_CMD.selectSkill9 + 6),
  def('selectSkill16', 'Select Skill 16', '選擇技能 16', D2_CMD.selectSkill9 + 7),
  // Say commands 27..33 send C2S 0x3F phrase 0x19..0x1F, command 55 sends phrase 0x20.
  def('sayMessage1', 'Say Message 1', '快捷語 1', D2_CMD.sayHelp + 0),
  def('sayMessage2', 'Say Message 2', '快捷語 2', D2_CMD.sayHelp + 1),
  def('sayMessage3', 'Say Message 3', '快捷語 3', D2_CMD.sayHelp + 2),
  def('sayMessage4', 'Say Message 4', '快捷語 4', D2_CMD.sayHelp + 3),
  def('sayMessage5', 'Say Message 5', '快捷語 5', D2_CMD.sayHelp + 4),
  def('sayMessage6', 'Say Message 6', '快捷語 6', D2_CMD.sayHelp + 5),
  def('sayMessage7', 'Say Message 7', '快捷語 7', D2_CMD.sayHelp + 6),
  def('sayMessage8', 'Say Message 8', '快捷語 8', D2_CMD.sayRetreat),
];

/** C2S 0x3F phrase id of each say command (0x6FAE9D60..0x6FAE9CA0 -> 0x19..0x1F, 0x6FAE9C80 -> 0x20). */
export const SAY_MESSAGE_PHRASE_113C: Readonly<Partial<Record<ControlActionId, number>>> = {
  sayMessage1: 0x19,
  sayMessage2: 0x1a,
  sayMessage3: 0x1b,
  sayMessage4: 0x1c,
  sayMessage5: 0x1d,
  sayMessage6: 0x1e,
  sayMessage7: 0x1f,
  sayMessage8: 0x20,
};

export const CONTROL_ACTION_IDS: readonly ControlActionId[] = CONTROL_ACTION_DEFINITIONS.map((d) => d.id);

export function createDefaultKeyBindings(): KeyBindingsConfig {
  const result = {} as KeyBindingsConfig;
  for (const def of CONTROL_ACTION_DEFINITIONS) {
    result[def.id] = {
      primary: def.defaultPrimary,
      secondary: def.defaultSecondary,
    };
  }
  return result;
}

export const DEFAULT_KEY_BINDINGS: KeyBindingsConfig = createDefaultKeyBindings();

export function cloneKeyBindings(source: KeyBindingsConfig): KeyBindingsConfig {
  const copy = {} as KeyBindingsConfig;
  for (const def of CONTROL_ACTION_DEFINITIONS) {
    const slot = source[def.id] ?? { primary: def.defaultPrimary, secondary: def.defaultSecondary };
    copy[def.id] = {
      primary: slot.primary,
      secondary: slot.secondary,
    };
  }
  return copy;
}

export function sanitizeKeyBindingCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'None' || trimmed === 'NONE') return null;
  return trimmed;
}

export function sanitizeKeyBindings(raw: unknown): KeyBindingsConfig {
  const defaults = createDefaultKeyBindings();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }
  const record = raw as Record<string, unknown>;
  for (const def of CONTROL_ACTION_DEFINITIONS) {
    const entry = record[def.id];
    if (entry && typeof entry === 'object') {
      const slot = entry as Record<string, unknown>;
      const hasPrimary = 'primary' in slot;
      const hasSecondary = 'secondary' in slot;
      const primary = hasPrimary ? sanitizeKeyBindingCode(slot.primary) : def.defaultPrimary;
      const secondary = hasSecondary ? sanitizeKeyBindingCode(slot.secondary) : def.defaultSecondary;
      const legacy = LEGACY_PRE_DEFAULT_KEY_SLOTS[def.id];
      if (legacy && legacy[0] === primary && legacy[1] === secondary) {
        // Untouched pre-default.key default persisted by older builds -> migrate to the 1.13c default.
        continue;
      }
      defaults[def.id] = { primary, secondary };
    }
  }
  return defaults;
}

/**
 * Defaults shipped before they were derived from `default.key` (#1553). A persisted slot that still
 * holds exactly this value was never customised by the player and is migrated to the real default.
 */
const LEGACY_PRE_DEFAULT_KEY_SLOTS: Partial<Record<ControlActionId, readonly [string | null, string | null]>> = {
  centerAutomap: ['Home', null],
  fadeAutomap: ['F9', null],
  standStill: ['ShiftLeft', 'ShiftRight'],
  showItems: ['AltLeft', 'AltRight'],
  say: ['Enter', 'NumpadEnter'],
};

/**
 * Formats a normalized key binding code (KeyboardEvent.code or 'WheelUp'/'WheelDown')
 * into a classic Diablo II display label for the Configure Controls table.
 */
export function formatKeyBindingCode(code: string | null, locale: 'en' | 'zh' = 'en'): string {
  if (!code) {
    return locale === 'zh' ? '無' : 'None';
  }
  if (code.startsWith('Key') && code.length === 4) {
    return code.slice(3).toUpperCase();
  }
  if (code.startsWith('Digit') && code.length === 6) {
    return code.slice(5);
  }
  if (code.startsWith('Numpad')) {
    const rest = code.slice(6);
    return `Num ${rest}`;
  }
  switch (code) {
    case 'Backquote':
      return '~';
    case 'Minus':
      return '-';
    case 'Equal':
      return '=';
    case 'BracketLeft':
      return '[';
    case 'BracketRight':
      return ']';
    case 'Backslash':
      return '\\';
    case 'Semicolon':
      return ';';
    case 'Quote':
      return "'";
    case 'Comma':
      return ',';
    case 'Period':
      return '.';
    case 'Slash':
      return '/';
    case 'Space':
      return locale === 'zh' ? '空白鍵' : 'Space';
    case 'Tab':
      return 'Tab';
    case 'Enter':
      return 'Enter';
    case 'ShiftLeft':
      return 'L-Shift';
    case 'ShiftRight':
      return 'R-Shift';
    case 'Shift':
      return 'Shift';
    case 'AltLeft':
      return 'L-Alt';
    case 'AltRight':
      return 'R-Alt';
    case 'Alt':
      return 'Alt';
    case 'ControlLeft':
      return 'L-Ctrl';
    case 'ControlRight':
      return 'R-Ctrl';
    case 'Control':
      return 'Ctrl';
    case 'WheelUp':
      return locale === 'zh' ? '滾輪向上' : 'Mouse Wheel Up';
    case 'WheelDown':
      return locale === 'zh' ? '滾輪向下' : 'Mouse Wheel Down';
    case 'ArrowUp':
      return 'Up Arrow';
    case 'ArrowDown':
      return 'Down Arrow';
    case 'ArrowLeft':
      return 'Left Arrow';
    case 'ArrowRight':
      return 'Right Arrow';
    default:
      return code;
  }
}

/**
 * Normalizes a DOM KeyboardEvent into a canonical binding code string.
 * Returns null for reserved system keys (e.g., Escape).
 */
export function normalizeKeyEventToBindingCode(event: {
  code?: string | undefined;
  key?: string | undefined;
}): string | null {
  const code = typeof event.code === 'string' ? event.code.trim() : '';
  const key = typeof event.key === 'string' ? event.key.trim() : '';

  if (code === 'Escape' || key === 'Escape') {
    return null;
  }
  if (code) {
    return code;
  }
  if (!key) {
    return null;
  }
  if (key.length === 1) {
    const upper = key.toUpperCase();
    if (upper >= 'A' && upper <= 'Z') {
      return `Key${upper}`;
    }
    if (upper >= '0' && upper <= '9') {
      return `Digit${upper}`;
    }
    if (key === '`' || key === '~') return 'Backquote';
    if (key === ' ') return 'Space';
  }
  if (key === 'Shift') return 'ShiftLeft';
  if (key === 'Alt') return 'AltLeft';
  if (key === 'Control') return 'ControlLeft';
  return key;
}

/**
 * Checks whether a KeyboardEvent or normalized code matches the specified action's Primary or Secondary slot.
 */
export function matchesKeyBinding(
  bindings: KeyBindingsConfig | undefined | null,
  actionId: ControlActionId,
  event: { code?: string | undefined; key?: string | undefined },
): boolean {
  const table = bindings ?? DEFAULT_KEY_BINDINGS;
  const slot = table[actionId] ?? DEFAULT_KEY_BINDINGS[actionId];
  if (!slot) return false;
  const normalized = normalizeKeyEventToBindingCode(event);
  if (!normalized) return false;

  return matchesSlotCode(slot.primary, normalized, event) || matchesSlotCode(slot.secondary, normalized, event);
}

const GENERIC_VK_EVENT_CODES: Readonly<Record<string, readonly string[]>> = {
  Shift: ['ShiftLeft', 'ShiftRight'],
  Alt: ['AltLeft', 'AltRight'],
  Control: ['ControlLeft', 'ControlRight'],
  Enter: ['NumpadEnter'],
};

function matchesSlotCode(
  boundCode: string | null,
  normalizedEventCode: string,
  event: { code?: string | undefined; key?: string | undefined },
): boolean {
  if (!boundCode) return false;
  if (boundCode === normalizedEventCode) return true;
  // Win32 virtual keys from default.key are side-agnostic: VK_SHIFT / VK_MENU / VK_CONTROL fire for
  // either physical key and VK_RETURN covers the keypad Enter as well.
  const generic = GENERIC_VK_EVENT_CODES[boundCode];
  if (generic && (generic.includes(normalizedEventCode) || (!event.code && event.key === boundCode))) {
    return true;
  }
  // Also allow matching by physical key character when event.code is missing in synthetic tests
  if (!event.code && event.key) {
    const fromKey = normalizeKeyEventToBindingCode({ key: event.key });
    if (fromKey && boundCode === fromKey) return true;
  }
  // Treat generic Shift/Alt/Control interchangeably if user bound one side and synthetic event only supplies 'Shift'/'Alt'
  if (
    (boundCode === 'ShiftLeft' || boundCode === 'ShiftRight') &&
    (normalizedEventCode === 'ShiftLeft' || normalizedEventCode === 'ShiftRight' || event.key === 'Shift') &&
    !event.code
  ) {
    return true;
  }
  if (
    (boundCode === 'AltLeft' || boundCode === 'AltRight') &&
    (normalizedEventCode === 'AltLeft' || normalizedEventCode === 'AltRight' || event.key === 'Alt') &&
    !event.code
  ) {
    return true;
  }
  return false;
}

/**
 * Assigns a key code to an action's primary or secondary slot and clears any conflicting
 * bindings across all actions (authentic D2 conflict resolution).
 */
export function assignKeyBinding(
  bindings: KeyBindingsConfig,
  actionId: ControlActionId,
  slotType: 'primary' | 'secondary',
  code: string,
): KeyBindingsConfig {
  const next = cloneKeyBindings(bindings);
  // Clear conflicts across all actions
  for (const id of CONTROL_ACTION_IDS) {
    const slot = next[id];
    if (slot.primary === code) {
      slot.primary = null;
    }
    if (slot.secondary === code) {
      slot.secondary = null;
    }
  }
  next[actionId][slotType] = code;
  return next;
}

/**
 * Clears an action's primary or secondary key binding slot.
 */
export function clearKeyBindingSlot(
  bindings: KeyBindingsConfig,
  actionId: ControlActionId,
  slotType: 'primary' | 'secondary',
): KeyBindingsConfig {
  const next = cloneKeyBindings(bindings);
  next[actionId][slotType] = null;
  return next;
}
