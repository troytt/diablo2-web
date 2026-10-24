/**
 * Pure Belt Potion Catalog & Compatibility Model (`src/common/items/belt-model.ts`).
 *
 * Shared across `src/common/`, `src/server/`, and `src/client/`.
 * Zero DOM or Node globals.
 */

export type BeltPotionKind = 'hp' | 'mana' | 'rejuv' | 'stamina' | 'antidote' | 'thawing' | 'scroll'

export type BeltPotionCategory = 'health' | 'mana' | 'rejuv' | 'stamina' | 'antidote' | 'thawing' | 'scroll'

export interface BeltPotion {
  readonly id: string
  readonly code: string
  readonly invFile: string
  readonly name: string
  readonly nameZh: string
  readonly kind: BeltPotionKind
  readonly category?: BeltPotionCategory
  readonly healHp: number
  readonly healMana: number
}

export const BELT_COLS = 4
export const BELT_ROWS = 4
export const BELT_BASE_X = 423
export const BELT_BASE_Y = 562
export const BELT_BASE_X_640 = 343
export const BELT_BASE_Y_640 = 441
export const BELT_PITCH = 31
export const BELT_PITCH_X = 31
export const BELT_PITCH_Y = 32
export const BELT_CELL_SIZE = 29

export function getBeltSlotBox(
  col: number,
  row: number,
  is640 = false,
): { x: number; y: number; width: number; height: number } {
  const baseX = is640 ? BELT_BASE_X_640 : BELT_BASE_X
  const baseY = is640 ? BELT_BASE_Y_640 : BELT_BASE_Y
  return {
    x: baseX + col * BELT_PITCH_X,
    y: baseY - row * BELT_PITCH_Y,
    width: BELT_CELL_SIZE,
    height: BELT_CELL_SIZE,
  }
}

/**
 * Rows (`Belts.txt numboxes / BELT_COLS`) shown and usable when no belt is equipped
 * (`Belts.txt` row 2 `default`, 4 boxes).
 */
export const NO_BELT_ROWS = 1

/**
 * Rows granted by equipped belt item code per 1.13c `Armor.txt` + `Belts.txt`.
 *
 * Derivation (cross-checked against the 1.13c MPQ tables by `tests/client/belt-rows-113c-parity.test.ts`):
 * `Armor.txt` `belt` is a row index into `Belts.txt` (7 rows per resolution set, identical `numboxes`
 * in both sets); capacity = `numboxes`, rows = `numboxes / 4`.
 *   idx 0 `belt` 12 (mbl) · idx 1 `sash` 8 (lbl) · idx 2 `default` 4 (no belt) · idx 3 `girdle` 16 (hbl)
 *   idx 4 `light belt` 8 (vbl) · idx 5 `heavy belt` 12 (tbl) · idx 6 `uber belt` 16 (all exceptional/elite)
 */
export const BELT_CODE_TO_ROWS: Readonly<Record<string, number>> = {
  // Normal belts
  lbl: 2, // Sash (8 boxes)
  vbl: 2, // Light Belt (8 boxes)
  mbl: 3, // Belt (12 boxes)
  tbl: 3, // Heavy Belt (12 boxes)
  hbl: 4, // Plated Belt / Girdle (16 boxes)
  // Exceptional belts
  zlb: 4, // Demonhide Sash (16 boxes)
  zvb: 4, // Sharkskin Belt (16 boxes)
  zmb: 4, // Mesh Belt (16 boxes)
  ztb: 4, // Battle Belt (16 boxes)
  zhb: 4, // War Belt (16 boxes)
  // Elite belts
  ulc: 4, // Spiderweb Sash (16 boxes)
  uvc: 4, // Vampirefang Belt (16 boxes)
  umc: 4, // Mithril Coil (16 boxes)
  utc: 4, // Troll Belt (16 boxes)
  uhc: 4, // Colossus Girdle (16 boxes)
}

export function getBeltRowsForCode(beltCode: string | null | undefined): number {
  if (!beltCode) return NO_BELT_ROWS
  const code = beltCode.trim().toLowerCase()
  const rows = BELT_CODE_TO_ROWS[code]
  if (rows === undefined) {
    throw new Error(`belt-model: '${code}' is not an Armor.txt belt code (no Belts.txt numboxes)`)
  }
  return rows
}

/** Item code of a belt-slot item (`UiInventoryItem`, `ItemData`, `Item`, or raw code string). */
function beltCodeOf(beltItemOrCode: unknown): string | null {
  if (beltItemOrCode === null || beltItemOrCode === undefined) return null
  if (typeof beltItemOrCode === 'string') return beltItemOrCode.trim().toLowerCase()
  const item = beltItemOrCode as Record<string, any>
  const code = item.code ?? item.base?.id ?? item.baseId
  if (typeof code !== 'string' || code.trim().length === 0) {
    throw new Error('belt-model: equipped belt item carries no item code')
  }
  return code.trim().toLowerCase()
}

/**
 * Authoritative Diablo II v1.13c `misc.txt` belt-compatible potion & scroll definitions (`belt = 1`).
 * Icon filenames (invfile) strictly match misc.txt definitions:
 * - vps (Stamina): invwps
 * - yps (Antidote): invnps
 * - wms (Thawing): invyps
 * - tsc (Town Portal Scroll): invbsc
 * - isc (Identify Scroll): invrsc
 */
export const BELT_POTION_CATALOG: Readonly<Record<string, Omit<BeltPotion, 'id'>>> = {
  hp1: { code: 'hp1', invFile: 'invhp1', name: 'Minor Healing Potion', nameZh: '轻微治疗药剂', kind: 'hp', category: 'health', healHp: 30, healMana: 0 },
  hp2: { code: 'hp2', invFile: 'invhp2', name: 'Light Healing Potion', nameZh: '轻度治疗药剂', kind: 'hp', category: 'health', healHp: 60, healMana: 0 },
  hp3: { code: 'hp3', invFile: 'invhp3', name: 'Healing Potion', nameZh: '治疗药剂', kind: 'hp', category: 'health', healHp: 100, healMana: 0 },
  hp4: { code: 'hp4', invFile: 'invhp4', name: 'Greater Healing Potion', nameZh: '强效治疗药剂', kind: 'hp', category: 'health', healHp: 180, healMana: 0 },
  hp5: { code: 'hp5', invFile: 'invhp5', name: 'Super Healing Potion', nameZh: '超级治疗药剂', kind: 'hp', category: 'health', healHp: 320, healMana: 0 },
  mp1: { code: 'mp1', invFile: 'invmp1', name: 'Minor Mana Potion', nameZh: '轻微法力药剂', kind: 'mana', category: 'mana', healHp: 0, healMana: 20 },
  mp2: { code: 'mp2', invFile: 'invmp2', name: 'Light Mana Potion', nameZh: '轻度法力药剂', kind: 'mana', category: 'mana', healHp: 0, healMana: 40 },
  mp3: { code: 'mp3', invFile: 'invmp3', name: 'Mana Potion', nameZh: '法力药剂', kind: 'mana', category: 'mana', healHp: 0, healMana: 80 },
  mp4: { code: 'mp4', invFile: 'invmp4', name: 'Greater Mana Potion', nameZh: '强效法力药剂', kind: 'mana', category: 'mana', healHp: 0, healMana: 150 },
  mp5: { code: 'mp5', invFile: 'invmp5', name: 'Super Mana Potion', nameZh: '超级法力药剂', kind: 'mana', category: 'mana', healHp: 0, healMana: 250 },
  rvs: { code: 'rvs', invFile: 'invvps', name: 'Rejuvenation Potion', nameZh: '回复活力药剂', kind: 'rejuv', category: 'rejuv', healHp: 35, healMana: 35 },
  rvl: { code: 'rvl', invFile: 'invvpl', name: 'Full Rejuvenation Potion', nameZh: '全面回复活力药剂', kind: 'rejuv', category: 'rejuv', healHp: 100, healMana: 100 },
  vps: { code: 'vps', invFile: 'invwps', name: 'Stamina Potion', nameZh: '耐力药剂', kind: 'stamina', category: 'stamina', healHp: 0, healMana: 0 },
  yps: { code: 'yps', invFile: 'invnps', name: 'Antidote Potion', nameZh: '解毒药剂', kind: 'antidote', category: 'antidote', healHp: 0, healMana: 0 },
  wms: { code: 'wms', invFile: 'invyps', name: 'Thawing Potion', nameZh: '融冰药剂', kind: 'thawing', category: 'thawing', healHp: 0, healMana: 0 },
  // Classic potions (1.13c misc.txt)
  hpo: { code: 'hpo', invFile: 'invhpo', name: 'Minor Healing Potion', nameZh: '轻微治疗药剂', kind: 'hp', category: 'health', healHp: 30, healMana: 0 },
  mpo: { code: 'mpo', invFile: 'invmpo', name: 'Minor Mana Potion', nameZh: '轻微法力药剂', kind: 'mana', category: 'mana', healHp: 0, healMana: 20 },
  hpf: { code: 'hpf', invFile: 'invhpf', name: 'Healing Potion', nameZh: '治疗药剂', kind: 'hp', category: 'health', healHp: 100, healMana: 0 },
  mpf: { code: 'mpf', invFile: 'invmpf', name: 'Mana Potion', nameZh: '法力药剂', kind: 'mana', category: 'mana', healHp: 0, healMana: 80 },
  // Scrolls with belt=1 in Misc.txt
  tsc: { code: 'tsc', invFile: 'invbsc', name: 'Scroll of Town Portal', nameZh: '城镇传送卷轴', kind: 'scroll', category: 'scroll', healHp: 0, healMana: 0 },
  isc: { code: 'isc', invFile: 'invrsc', name: 'Scroll of Identify', nameZh: '辨识卷轴', kind: 'scroll', category: 'scroll', healHp: 0, healMana: 0 },
}

/**
 * Checks whether two belt items belong to the same column family per `D2Common.dll` `BELT_CheckPotionType`.
 * Scrolls require identical item code; potions match by kind family.
 */
export function areBeltPotionsCompatible(a: BeltPotion, b: BeltPotion): boolean {
  if (a.kind === 'scroll' || b.kind === 'scroll') {
    return a.code === b.code
  }
  return a.kind === b.kind
}

/**
 * Converts a raw `Item`, `UiInventoryItem`, `BeltPotion`, or item-like object into a `BeltPotion`
 * if and only if it is an authentic belt-compatible item (potions and scrolls with `belt = 1`).
 * Excludes throwing potions (`gpm`, `opm`, `gpl`, `opl`, `gps`, `ops` which are weapons with `beltable=0`).
 */
export function itemToBeltPotion(item: unknown): BeltPotion | null {
  if (!item || typeof item !== 'object') return null
  const raw = item as Record<string, any>

  // Unwrap GroundItemEntity or nested item object
  const inner = raw.item && typeof raw.item === 'object' && !raw.kind ? (raw.item as Record<string, any>) : raw

  // Already a valid BeltPotion
  if (
    typeof inner.kind === 'string' &&
    ['hp', 'mana', 'rejuv', 'stamina', 'antidote', 'thawing', 'scroll'].includes(inner.kind) &&
    typeof inner.code === 'string'
  ) {
    const code = inner.code.trim().toLowerCase()
    const catalogEntry = BELT_POTION_CATALOG[code]
    return {
      id: typeof inner.id === 'string' ? inner.id : `pot-${code}`,
      code,
      invFile: inner.invFile || catalogEntry?.invFile || `inv${code}`,
      name: typeof inner.name === 'string' ? inner.name : (catalogEntry?.name ?? 'Potion'),
      nameZh: typeof inner.nameZh === 'string' ? inner.nameZh : (catalogEntry?.nameZh ?? inner.name ?? '药剂'),
      kind: inner.kind as BeltPotionKind,
      category: inner.category ?? catalogEntry?.category ?? (inner.kind === 'hp' ? 'health' : (inner.kind as BeltPotionCategory)),
      healHp: typeof inner.healHp === 'number' ? inner.healHp : (catalogEntry?.healHp ?? 0),
      healMana: typeof inner.healMana === 'number' ? inner.healMana : (catalogEntry?.healMana ?? 0),
    }
  }

  const base = inner.base && typeof inner.base === 'object' ? (inner.base as Record<string, any>) : undefined
  // Exclude weapon items (e.g. throwing gas/oil potions have kind === 'weapon')
  if (base?.kind === 'weapon' || inner.kind === 'weapon') {
    return null
  }

  const rawCode = String(inner.code ?? base?.id ?? '').trim().toLowerCase()
  if (!rawCode || ['gpm', 'opm', 'gpl', 'opl', 'gps', 'ops'].includes(rawCode)) {
    return null
  }

  const catalogEntry = BELT_POTION_CATALOG[rawCode]
  if (catalogEntry) {
    const idStr = String(inner.id ?? raw.id ?? `pot-${rawCode}`)
    return {
      ...catalogEntry,
      id: idStr,
      ...(typeof inner.invFile === 'string' && inner.invFile.length > 0 ? { invFile: inner.invFile } : {}),
      ...(typeof inner.name === 'string' && inner.name.length > 0 ? { name: inner.name } : {}),
      ...(typeof inner.nameZh === 'string' && inner.nameZh.length > 0 ? { nameZh: inner.nameZh } : {}),
    }
  }

  // Check if item has explicit beltable property from misc.txt
  if (inner.beltable === 1 || inner.belt === 1 || base?.beltable === 1 || base?.belt === 1) {
    const idStr = String(inner.id ?? raw.id ?? `pot-${rawCode}`)
    return {
      id: idStr,
      code: rawCode,
      invFile: typeof inner.invFile === 'string' && inner.invFile.length > 0 ? inner.invFile : (base?.invFile ?? `inv${rawCode}`),
      name: typeof inner.name === 'string' ? inner.name : (base?.name ?? rawCode),
      nameZh: typeof inner.nameZh === 'string' ? inner.nameZh : (base?.nameZh ?? inner.name ?? rawCode),
      kind: 'hp',
      category: 'health',
      healHp: 0,
      healMana: 0,
    }
  }

  return null
}

export function isAutoBeltablePotion(item: unknown): boolean {
  return itemToBeltPotion(item) !== null
}

export class BeltModel {
  /** 4 columns × 4 rows (`grid[row][col]`, row 0 is bottom visible row). */
  readonly grid: (BeltPotion | null)[][] = Array.from({ length: BELT_ROWS }, () =>
    Array.from({ length: BELT_COLS }, () => null),
  )
  /** Whether `~` key locked the 4×4 popup belt open. */
  lockedOpen = false
  /** Whether mouse is hovering over the belt area. */
  hovered = false
  /** Currently hovered slot `(row, col)`. */
  hoveredSlot: { row: number; col: number } | null = null

  private _equippedBeltCode: string | null = null
  private _equippedBeltSource: (() => unknown) | null = null

  /**
   * Rows usable / shown for the currently equipped belt (`Belts.txt numboxes / 4`).
   * No belt equipped = `NO_BELT_ROWS` (Belts.txt `default`, 4 boxes); never a silent 16-slot default.
   */
  get maxRows(): number {
    const code = this._equippedBeltSource ? beltCodeOf(this._equippedBeltSource()) : this._equippedBeltCode
    return getBeltRowsForCode(code)
  }

  /**
   * Bind a live getter for the item in the belt body location (`BODYLOC_BELT`), so the drawn grid,
   * hit-testing and local placement always follow the current equipment without a separate publish step.
   */
  bindEquippedBeltSource(source: () => unknown): void {
    this._equippedBeltSource = source
  }

  /** Set a fixed equipped belt (item or code); `null` = no belt. Drops any bound live source. */
  setEquippedBelt(beltItemOrCode: unknown | string | null): void {
    this._equippedBeltSource = null
    const code = beltCodeOf(beltItemOrCode)
    if (code !== null) getBeltRowsForCode(code)
    this._equippedBeltCode = code
  }

  get isExpanded(): boolean {
    return (this.lockedOpen || this.hovered) && this.maxRows > 1
  }

  get activeRows(): number {
    return this.isExpanded ? this.maxRows : 1
  }

  togglePopup(): void {
    this.lockedOpen = !this.lockedOpen
  }

  /**
   * Drink the potion in column `col` (0..3) at `row` (default 0) and shift upper rows down.
   */
  useSlot(col: number, row = 0): BeltPotion | null {
    if (col < 0 || col >= BELT_COLS || row < 0 || row >= this.maxRows) return null
    const consumed = this.grid[row]?.[col] ?? null
    if (!consumed) return null
    for (let r = row; r < BELT_ROWS - 1; r++) {
      this.grid[r]![col] = this.grid[r + 1]![col] ?? null
    }
    this.grid[BELT_ROWS - 1]![col] = null
    return consumed
  }

  /**
   * Place a potion into the first empty row in column `col`, or into a specific `(row, col)`.
   */
  placePotion(potion: BeltPotion, col: number, row?: number): BeltPotion | null {
    if (col < 0 || col >= BELT_COLS) return potion
    if (row !== undefined) {
      if (row < 0 || row >= this.maxRows) return potion
      const prev = this.grid[row]![col] ?? null
      this.grid[row]![col] = potion
      return prev
    }
    for (let r = 0; r < this.maxRows; r++) {
      if (this.grid[r]![col] === null) {
        this.grid[r]![col] = potion
        return null
      }
    }
    return potion
  }

  /**
   * Clear all slots in the belt.
   */
  clear(): void {
    for (let r = 0; r < BELT_ROWS; r++) {
      for (let c = 0; c < BELT_COLS; c++) {
        this.grid[r]![c] = null
      }
    }
  }

  get slots(): (BeltPotion | null)[][] {
    return this.grid
  }

  /**
   * Consume the base potion (row 0) in column `col` (`0..3`) and shift upper rows down.
   */
  consumeSlot(col: number): BeltPotion | null {
    return this.useSlot(col, 0)
  }

  /**
   * Set or clear a belt slot by `(col, row)` (`0..3`, `0..3`).
   */
  setSlot(col: number, row: number, item: BeltPotion | unknown | null): boolean {
    if (col < 0 || col >= BELT_COLS || row < 0 || row >= this.maxRows) return false
    if (item === null || item === undefined) {
      this.grid[row]![col] = null
      return true
    }
    const potion = itemToBeltPotion(item)
    if (!potion) return false
    this.grid[row]![col] = potion
    return true
  }

  /**
   * Read a belt slot by `(col, row)` (`0..3`, `0..3`).
   */
  getSlot(col: number, row: number): BeltPotion | null {
    if (col < 0 || col >= BELT_COLS || row < 0 || row >= BELT_ROWS) return null
    return this.grid[row]![col] ?? null
  }

  /**
   * Non-mutating query for the target belt slot of an auto-placed potion (`D2Common.dll` `INVENTORY_GetFreeBeltSlot`).
   */
  findAutoPlacePotionSlot(potionOrItem: BeltPotion | unknown): { row: number; col: number; potion: BeltPotion } | null {
    const potion = itemToBeltPotion(potionOrItem)
    if (!potion) return null

    // Pass 1: Match existing potion family in row 0, fill lowest empty upper row (1..maxRows-1)
    for (let col = 0; col < BELT_COLS; col++) {
      const basePot = this.grid[0]![col]
      if (basePot !== null && areBeltPotionsCompatible(basePot, potion)) {
        for (let row = 1; row < this.maxRows; row++) {
          if (this.grid[row]![col] === null) {
            return { row, col, potion }
          }
        }
      }
    }

    // Pass 2: Place into the first empty base column (row 0)
    for (let col = 0; col < BELT_COLS; col++) {
      if (this.grid[0]![col] === null) {
        return { row: 0, col, potion }
      }
    }

    return null
  }

  canAutoPlacePotion(potionOrItem: BeltPotion | unknown): boolean {
    return this.findAutoPlacePotionSlot(potionOrItem) !== null
  }

  /**
   * Authentic Diablo II v1.13c two-pass belt auto-placement (`D2Game.dll` `D2GAME_PickupPotionItem` / `INVENTORY_AutoPlaceBelt`).
   */
  autoPlacePotionSlot(potionOrItem: BeltPotion | unknown): { row: number; col: number; potion: BeltPotion } | null {
    const found = this.findAutoPlacePotionSlot(potionOrItem)
    if (!found) return null
    this.grid[found.row]![found.col] = found.potion
    return found
  }

  /**
   * Automatically places a picked-up potion into the belt following D2 1.13c `INVENTORY_GetFreeBeltSlot`.
   */
  autoPlacePotion(potionOrItem: BeltPotion | unknown): boolean {
    return this.autoPlacePotionSlot(potionOrItem) !== null
  }

  /**
   * Boolean alias around `autoPlacePotion` for ground pickup callers.
   */
  tryAutoStore(potionOrItem: BeltPotion | unknown): boolean {
    return this.autoPlacePotionSlot(potionOrItem) !== null
  }

  countTotalPotions(): number {
    let count = 0
    for (let r = 0; r < BELT_ROWS; r++) {
      for (let c = 0; c < BELT_COLS; c++) {
        if (this.grid[r]![c] !== null) count++
      }
    }
    return count
  }

  is640 = false

  getBeltSlotBox(col: number, row: number): { x: number; y: number; width: number; height: number } {
    return getBeltSlotBox(col, row, this.is640)
  }

  slotAtPoint(logicalX: number, logicalY: number): { row: number; col: number } | null {
    const visibleRows = this.isExpanded ? this.maxRows : 1
    for (let row = 0; row < visibleRows; row++) {
      for (let col = 0; col < BELT_COLS; col++) {
        const box = getBeltSlotBox(col, row, this.is640)
        if (
          logicalX >= box.x &&
          logicalX <= box.x + box.width &&
          logicalY >= box.y &&
          logicalY <= box.y + box.height
        ) {
          return { row, col }
        }
      }
    }
    return null
  }

  handleMouseMove(logicalX: number, logicalY: number): void {
    const visibleRows = this.maxRows
    const baseX = this.is640 ? BELT_BASE_X_640 : BELT_BASE_X
    const baseY = this.is640 ? BELT_BASE_Y_640 : BELT_BASE_Y
    const topY = this.isExpanded
      ? baseY - (visibleRows - 1) * BELT_PITCH_Y - 4
      : baseY - 2
    this.hovered =
      logicalX >= baseX - 4 &&
      logicalX <= baseX + BELT_COLS * BELT_PITCH_X + 4 &&
      logicalY >= topY &&
      logicalY <= baseY + BELT_CELL_SIZE + 4
    this.hoveredSlot = this.slotAtPoint(logicalX, logicalY)
  }
}
