/**
 * Diablo II / Project Diablo 2 Configurable Control Actions & KeyBindings
 *
 * Mirrors D2Client.dll Configure Controls table (gmenu.cpp / Configure Controls)
 * with Primary & Secondary key slots, conflict resolution, and localStorage persistence.
 */

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
  | 'clearScreen';

export interface KeyBindingSlot {
  primary: string | null;
  secondary: string | null;
}

export type KeyBindingsConfig = Record<ControlActionId, KeyBindingSlot>;

export interface ControlActionDefinition {
  id: ControlActionId;
  labelEn: string;
  labelZh: string;
  defaultPrimary: string | null;
  defaultSecondary: string | null;
}

export const CONTROL_ACTION_DEFINITIONS: readonly ControlActionDefinition[] = [
  { id: 'characterScreen', labelEn: 'Character Screen', labelZh: '角色視窗', defaultPrimary: 'KeyA', defaultSecondary: 'KeyC' },
  { id: 'inventoryScreen', labelEn: 'Inventory Screen', labelZh: '物品欄視窗', defaultPrimary: 'KeyI', defaultSecondary: 'KeyB' },
  { id: 'partyScreen', labelEn: 'Party Screen', labelZh: '組隊視窗', defaultPrimary: 'KeyP', defaultSecondary: null },
  { id: 'hirelingScreen', labelEn: 'Mercenary', labelZh: '傭兵視窗', defaultPrimary: 'KeyO', defaultSecondary: null },
  { id: 'messageLog', labelEn: 'Message Log', labelZh: '訊息紀錄', defaultPrimary: 'KeyM', defaultSecondary: null },
  { id: 'questLog', labelEn: 'Quest Log', labelZh: '任務日誌', defaultPrimary: 'KeyQ', defaultSecondary: null },
  { id: 'helpScreen', labelEn: 'Help Screen', labelZh: '說明視窗', defaultPrimary: 'KeyH', defaultSecondary: null },
  { id: 'skillTree', labelEn: 'Skill Tree', labelZh: '技能樹視窗', defaultPrimary: 'KeyT', defaultSecondary: null },
  { id: 'skillSpeedBar', labelEn: 'Skill Speed Bar', labelZh: '技能快捷列', defaultPrimary: 'KeyS', defaultSecondary: null },
  { id: 'selectSkill1', labelEn: 'Select Skill 1', labelZh: '選擇技能 1', defaultPrimary: 'F1', defaultSecondary: null },
  { id: 'selectSkill2', labelEn: 'Select Skill 2', labelZh: '選擇技能 2', defaultPrimary: 'F2', defaultSecondary: null },
  { id: 'selectSkill3', labelEn: 'Select Skill 3', labelZh: '選擇技能 3', defaultPrimary: 'F3', defaultSecondary: null },
  { id: 'selectSkill4', labelEn: 'Select Skill 4', labelZh: '選擇技能 4', defaultPrimary: 'F4', defaultSecondary: null },
  { id: 'selectSkill5', labelEn: 'Select Skill 5', labelZh: '選擇技能 5', defaultPrimary: 'F5', defaultSecondary: null },
  { id: 'selectSkill6', labelEn: 'Select Skill 6', labelZh: '選擇技能 6', defaultPrimary: 'F6', defaultSecondary: null },
  { id: 'selectSkill7', labelEn: 'Select Skill 7', labelZh: '選擇技能 7', defaultPrimary: 'F7', defaultSecondary: null },
  { id: 'selectSkill8', labelEn: 'Select Skill 8', labelZh: '選擇技能 8', defaultPrimary: 'F8', defaultSecondary: null },
  { id: 'selectPreviousSkill', labelEn: 'Select Previous Skill', labelZh: '選擇上一個技能', defaultPrimary: 'WheelUp', defaultSecondary: null },
  { id: 'selectNextSkill', labelEn: 'Select Next Skill', labelZh: '選擇下一個技能', defaultPrimary: 'WheelDown', defaultSecondary: null },
  { id: 'showBelt', labelEn: 'Show Belt', labelZh: '顯示腰帶', defaultPrimary: 'Backquote', defaultSecondary: null },
  { id: 'useBeltSlot1', labelEn: 'Use Belt Slot 1', labelZh: '使用腰帶欄位 1', defaultPrimary: 'Digit1', defaultSecondary: null },
  { id: 'useBeltSlot2', labelEn: 'Use Belt Slot 2', labelZh: '使用腰帶欄位 2', defaultPrimary: 'Digit2', defaultSecondary: null },
  { id: 'useBeltSlot3', labelEn: 'Use Belt Slot 3', labelZh: '使用腰帶欄位 3', defaultPrimary: 'Digit3', defaultSecondary: null },
  { id: 'useBeltSlot4', labelEn: 'Use Belt Slot 4', labelZh: '使用腰帶欄位 4', defaultPrimary: 'Digit4', defaultSecondary: null },
  { id: 'swapWeapons', labelEn: 'Swap Weapons', labelZh: '切換武器', defaultPrimary: 'KeyW', defaultSecondary: null },
  { id: 'toggleRunWalk', labelEn: 'Toggle Run/Walk', labelZh: '切換跑步/行走', defaultPrimary: 'KeyR', defaultSecondary: null },
  { id: 'standStill', labelEn: 'Stand Still', labelZh: '原地站立', defaultPrimary: 'ShiftLeft', defaultSecondary: 'ShiftRight' },
  { id: 'showItems', labelEn: 'Show Items', labelZh: '顯示物品', defaultPrimary: 'AltLeft', defaultSecondary: 'AltRight' },
  { id: 'automap', labelEn: 'Automap', labelZh: '自動地圖', defaultPrimary: 'Tab', defaultSecondary: null },
  { id: 'centerAutomap', labelEn: 'Center Automap', labelZh: '置中自動地圖', defaultPrimary: 'Home', defaultSecondary: null },
  { id: 'fadeAutomap', labelEn: 'Fade Automap', labelZh: '淡化自動地圖', defaultPrimary: 'F9', defaultSecondary: null },
  { id: 'partyOnAutomap', labelEn: 'Party on Automap', labelZh: '地圖顯示隊友', defaultPrimary: 'F11', defaultSecondary: null },
  { id: 'namesOnAutomap', labelEn: 'Names on Automap', labelZh: '地圖顯示名稱', defaultPrimary: 'F12', defaultSecondary: null },
  { id: 'toggleMiniMap', labelEn: 'Toggle MiniMap', labelZh: '切換小地圖', defaultPrimary: 'KeyV', defaultSecondary: null },
  { id: 'say', labelEn: 'Say', labelZh: '交談', defaultPrimary: 'Enter', defaultSecondary: 'NumpadEnter' },
  { id: 'clearScreen', labelEn: 'Clear Screen', labelZh: '清除畫面視窗', defaultPrimary: 'Space', defaultSecondary: null },
];

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
      defaults[def.id] = {
        primary: hasPrimary ? sanitizeKeyBindingCode(slot.primary) : def.defaultPrimary,
        secondary: hasSecondary ? sanitizeKeyBindingCode(slot.secondary) : def.defaultSecondary,
      };
    }
  }
  return defaults;
}

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

function matchesSlotCode(
  boundCode: string | null,
  normalizedEventCode: string,
  event: { code?: string | undefined; key?: string | undefined },
): boolean {
  if (!boundCode) return false;
  if (boundCode === normalizedEventCode) return true;
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
