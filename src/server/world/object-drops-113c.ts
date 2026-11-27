/**
 * Diablo II v1.13c specialized world-object drop & ambush generators (#1833, #1837, #1838, #1839):
 *
 * - `OperateFn 19` (`104, 105, 550, 551` Armor Stand): `D2Game.dll` `0x6FC8B2E0` -> `0x6FC31FB0` -> `D2Common.#11064` (`0x6FD72760`)
 * - `OperateFn 20` (`106, 107, 548, 549` Weapon Rack): `D2Game.dll` `0x6FC8B280` -> `0x6FC31E20` + `D2Common.#10731` (`isMetalItemCode113c`)
 * - `OperateFn 26` (`179, 180` Bookshelf): `D2Game.dll` `0x6FC8B340` (`10%` Tome `tbk`/`ibk`, `90%` Scroll `tsc`/`isc`)
 * - `OperateFn 24, 39..41, 57..59` (Act 2 & Act 3 Quest Chests): `5..9` gold piles (`0x6FC8AFA0`) + forced-Magic Chest TC drop (`0x6FC8B570`)
 * - `OperateFn 33` (`268` Wirt's Body): `Wirt's Leg` (`'leg'`, `ilvl = areaLvl`) + `15` gold piles (`0x6FC8D960`)
 * - `OperateFn 68` (`466` Act 5 Evil Urn): level monster pool Unique boss + minions (`80%`) or Champion pack (`20%`) (`0x6FC8EDB0`)
 */

import {
  createDroppedItem,
  executeDropPipeline,
  type DropTables,
} from '../../common/items/drop-tables.ts'
import { getEmbeddedDropTables } from '../../common/items/embedded-drop-tables.ts'
import type { Item, ItemBase } from '../../common/items/items.ts'
import { isMetalItemCode113c } from '../../common/items/metal-items-113c.ts'
import { D2Rng, Rng } from '../../common/rng/d2-rng.ts'
import {
  getCanonicalMonsterKinds,
  resolveEliteCandidates,
  rollEliteModifiers,
  selectLevelTypes,
  type Difficulty,
  type MonsterKind,
} from '../../common/units/monsters-data.ts'
import { getLevelMonsterPlan113c } from '../../common/world/level-monster-plans.ts'
import { getLevelMonsterLevel113c, getLevelsMonLvlRecord113c } from '../../common/world/levels-monlvl-113c.ts'
import { finalizeDroppedItem113c, resolveChestDropContext113c } from '../items/server-item-data.ts'

export interface RackCandidateBase113c {
  readonly code: string
  readonly base: ItemBase
  readonly level: number
  readonly rarity: number
}

let cachedArmorStandPool: readonly RackCandidateBase113c[] | null = null
let cachedWeaponRackPool: readonly RackCandidateBase113c[] | null = null

function getArmorStandPool(tables: DropTables): readonly RackCandidateBase113c[] {
  if (cachedArmorStandPool !== null) return cachedArmorStandPool
  const out: RackCandidateBase113c[] = []
  for (const base of tables.armor.all) {
    const rarity = Number(base.rarity ?? 0)
    const level = Math.max(1, Number(base.level ?? 1))
    if (base.spawnable === false || Boolean(base.quest) || rarity <= 0) continue
    out.push({ code: base.code.trim(), base, level, rarity })
  }
  cachedArmorStandPool = out
  return out
}

function getWeaponRackPool(tables: DropTables): readonly RackCandidateBase113c[] {
  if (cachedWeaponRackPool !== null) return cachedWeaponRackPool
  const out: RackCandidateBase113c[] = []
  for (const base of tables.weapons.all) {
    const cleanCode = base.code.trim()
    const rarity = Number(base.rarity ?? 0)
    const level = Math.max(1, Number(base.level ?? 1))
    if (base.spawnable === false || Boolean(base.quest) || rarity <= 0) continue
    let isMetal = false
    try {
      isMetal = isMetalItemCode113c(cleanCode)
    } catch {
      isMetal = false
    }
    if (!isMetal) continue
    out.push({ code: cleanCode, base, level, rarity })
  }
  cachedWeaponRackPool = out
  return out
}

function pickRackBase113c(
  pool: readonly RackCandidateBase113c[],
  maxQlvl: number,
  rng: { rand(max: number): number },
): RackCandidateBase113c | undefined {
  let totalRarity = 0
  const eligible: RackCandidateBase113c[] = []
  for (const entry of pool) {
    if (entry.level <= maxQlvl) {
      eligible.push(entry)
      totalRarity += entry.rarity
    }
  }
  if (eligible.length === 0 || totalRarity <= 0) return undefined
  let roll = rng.rand(totalRarity)
  for (const entry of eligible) {
    if (roll < entry.rarity) return entry
    roll -= entry.rarity
  }
  return eligible[eligible.length - 1]
}

export interface RackDropOptions113c {
  readonly areaId: number
  readonly difficulty: 0 | 1 | 2
  readonly playerMf: number
  readonly rng: { rand(max: number): number }
  readonly spawnedUniqueIds?: Set<number> | undefined
}

function rollSelectedRackBaseDrop113c(
  chosen: RackCandidateBase113c,
  ilvl: number,
  options: RackDropOptions113c,
  tables: DropTables,
  forcedQuality?: number,
): Item[] {
  const rolled = executeDropPipeline(tables, {
    tcName: chosen.code,
    nLevel: ilvl,
    monsterType: 1,
    // Keep exact rack-selected base without a second normal->exceptional/elite upgrade pass:
    // D2Common.#11064 already includes all normal/exceptional/elite rows with `qlvl <= areaLvl - 1`.
    difficulty: 'normal',
    gamePlayers: 1,
    partyPlayers: 1,
    playerMf: options.playerMf,
    playerGf: 0,
    monsterRng: new D2Rng(options.rng.rand(0x7fffffff) || 1),
    ...(options.spawnedUniqueIds !== undefined ? { spawnedUniqueIds: options.spawnedUniqueIds } : {}),
    ...(forcedQuality !== undefined ? { forcedQuality } : {}),
  })
  return rolled.map((it) => finalizeDroppedItem113c(it))
}

/**
 * 1.13c `OperateFn 19` Armor Stand (`D2Game.dll` `0x6FC8B2E0` -> `0x6FC31FB0` -> `D2Common.#11064` `0x6FD72760`):
 * 100% drops one `Armor.txt` item (`spawnable`, non-quest, `Rarity > 0`, `qlvl <= max(1, areaLvl - 1)`).
 */
export function rollArmorStandDrop113c(options: RackDropOptions113c): Item[] {
  const tables = getEmbeddedDropTables()
  const areaLvl = Math.max(1, getLevelMonsterLevel113c(options.areaId, options.difficulty, true))
  const ilvl = Math.max(1, areaLvl - 1)
  const chosen = pickRackBase113c(getArmorStandPool(tables), ilvl, options.rng)
  if (!chosen) return []
  return rollSelectedRackBaseDrop113c(chosen, ilvl, options, tables)
}

/**
 * 1.13c `OperateFn 20` Weapon Rack (`D2Game.dll` `0x6FC8B280` -> `0x6FC31E20` + `D2Common.#10731`):
 * 100% drops one metal `Weapons.txt` item (`bitfield1 & 2 !== 0`, `Rarity > 0`, `qlvl <= max(1, areaLvl - 1)`),
 * never dropping bows, crossbows, wands, staves, orbs, potions, or gold.
 */
export function rollWeaponRackDrop113c(options: RackDropOptions113c): Item[] {
  const tables = getEmbeddedDropTables()
  const areaLvl = Math.max(1, getLevelMonsterLevel113c(options.areaId, options.difficulty, true))
  const ilvl = Math.max(1, areaLvl - 1)
  const chosen = pickRackBase113c(getWeaponRackPool(tables), ilvl, options.rng)
  if (!chosen) return []
  return rollSelectedRackBaseDrop113c(chosen, ilvl, options, tables)
}

/**
 * 1.13c `OperateFn 26` Monastery Bookshelf (`D2Game.dll` `0x6FC8B340`, `Objects.txt` `179, 180`):
 * 100% drops a Tome (`10%`: `50/50` `'ibk'` / `'tbk'`) or Scroll (`90%`: `50/50` `'isc'` / `'tsc'`).
 */
export function rollBookshelfDrop113c(
  areaId: number,
  difficulty: 0 | 1 | 2,
  rng: { rand(max: number): number },
): Item[] {
  const tables = getEmbeddedDropTables()
  const ilvl = Math.max(1, getLevelMonsterLevel113c(areaId, difficulty, true))
  const isTome = rng.rand(10) === 0
  const isIdentify = rng.rand(2) === 0
  const code = isTome ? (isIdentify ? 'ibk' : 'tbk') : isIdentify ? 'isc' : 'tsc'
  const base = tables.getBase(code)
  if (!base) return []
  const seed = rng.rand(0x7fffffff) >>> 0
  const itemRng = new D2Rng(seed || 1)
  const item = createDroppedItem(base, 'normal', {
    itemTypes: tables.itemTypes,
    ilvl,
    dwInitSeed: seed,
    itemRng,
  })
  if (isTome) {
    const qty = 1 + itemRng.rand(5)
    return [{ ...item, stack: qty, quantity: qty }]
  }
  return [item]
}

/**
 * 1.13c `OBJECTS_DropGoldPiles` (`D2Game.dll` `0x6FC8AFA0` -> `0x6FC31490` -> `0x6FC31070`):
 * Generates `count` gold piles at `ilvl = max(1, areaLvl)` scaled by `playerGf`.
 */
export function createGoldPiles113c(
  count: number,
  areaLevel: number,
  playerGf: number,
  rng: { rand(max: number): number },
): Item[] {
  const tables = getEmbeddedDropTables()
  const base = tables.getBase('gld')
  if (!base || count <= 0) return []
  const ilvl = Math.max(1, areaLevel)
  const out: Item[] = []
  for (let i = 0; i < count; i++) {
    const seed = rng.rand(0x7fffffff) >>> 0
    const itemRng = new D2Rng(seed || 1)
    const item = createDroppedItem(base, 'normal', {
      itemTypes: tables.itemTypes,
      ilvl,
      dwInitSeed: seed,
      itemRng,
    })
    let amount = Math.max(1, itemRng.rand(5 * ilvl) + ilvl)
    if (playerGf !== 0) {
      amount = Math.max(0, Math.trunc((amount * (100 + playerGf)) / 100))
    }
    out.push({ ...item, stack: amount, quantity: amount })
  }
  return out
}

export interface QuestChestBonusDropOptions113c {
  readonly areaId: number
  readonly difficulty: 0 | 1 | 2
  readonly gamePlayers: number
  readonly partyPlayers: number
  readonly playerMf: number
  readonly playerGf: number
  readonly rng: { rand(max: number): number }
  readonly spawnedUniqueIds?: Set<number> | undefined
}

/**
 * 1.13c Act 2 & Act 3 Quest Chest bonus eruption (`D2Game.dll` `0x6FCE76B0`, `0x6FCEA050..0x6FCEA290`,
 * `0x6FD0A390..0x6FD0A5F0` for `OperateFn 24, 39..41, 57..59`):
 * - Erupts `5..9` gold piles (`0x6FC8AFA0`).
 * - Drops forced-Magic (`nQuality = 4`) Chest TC equipment (`0x6FC8B570`).
 */
export function rollQuestChestBonusDrops113c(options: QuestChestBonusDropOptions113c): Item[] {
  const tables = getEmbeddedDropTables()
  const ctx = resolveChestDropContext113c(options.areaId, options.difficulty)
  const ilvl = Math.max(1, ctx.monsterLevel)
  const goldCount = 5 + options.rng.rand(5)
  const out: Item[] = createGoldPiles113c(goldCount, ilvl, options.playerGf, options.rng)

  const diffName =
    options.difficulty === 2 ? 'hell' : options.difficulty === 1 ? 'nightmare' : 'normal'
  let magicEquip: Item | undefined
  for (let attempt = 0; attempt < 12; attempt++) {
    const rolled = executeDropPipeline(tables, {
      tcName: ctx.tcName,
      nLevel: ilvl,
      monsterType: 3,
      difficulty: diffName,
      gamePlayers: Math.max(8, options.gamePlayers),
      partyPlayers: Math.max(8, options.partyPlayers),
      playerMf: options.playerMf,
      playerGf: options.playerGf,
      monsterRng: new D2Rng(options.rng.rand(0x7fffffff) || 1),
      forcedQuality: 4,
      ...(options.spawnedUniqueIds !== undefined
        ? { spawnedUniqueIds: options.spawnedUniqueIds }
        : {}),
    })
    const found = rolled.find(
      (it) =>
        (it.base.kind === 'armor' || it.base.kind === 'weapon' || Number(it.quality ?? 0) >= 4) &&
        Number(it.quality ?? 0) >= 4,
    )
    if (found) {
      magicEquip = finalizeDroppedItem113c(found)
      break
    }
  }
  if (!magicEquip) {
    const fallbackBase = pickRackBase113c(getArmorStandPool(tables), ilvl, options.rng)
    if (fallbackBase) {
      const fb = rollSelectedRackBaseDrop113c(
        fallbackBase,
        ilvl,
        {
          areaId: options.areaId,
          difficulty: options.difficulty,
          playerMf: options.playerMf,
          rng: options.rng,
          spawnedUniqueIds: options.spawnedUniqueIds,
        },
        tables,
        4,
      )
      magicEquip = fb[0]
    }
  }
  if (magicEquip) out.push(magicEquip)
  return out
}

const TOWER_CHEST_HEAL_POTION_CODES_113C = ['hp1', 'hp2', 'hp3', 'hp4'] as const
const TOWER_CHEST_MANA_POTION_CODES_113C = ['mp1', 'mp2', 'mp3', 'mp4'] as const

/**
 * 1.13c Act 1 Quest 4 (`a1q4`) Countess Tower Chest (`Objects.txt 371`, `D2Game.dll` `OBJECTS_OpenTowerChest`
 * @ `0x6FC8DBF0..0x6FC8DD02`, #1988):
 * - Calls `OBJECTS_DropFromChestTC(pArg, 4)` (`0x6FC8B570`) **3 times** (`0x6FC8DC25`, `0x6FC8DC2D`, `0x6FC8DC35`)
 *   to drop 3 forced-Magic (`nQuality = 4`) Chest TC items.
 * - Drops **2** Healing Potions (`0x6FC2E390` @ `0x6FD2F884`: `['hp1','hp2','hp3','hp4'][min(3, act + (diff > 0 ? 2 : 0))]`)
 *   and **2** Mana Potions (`0x6FC2E310` @ `0x6FD2F870`: `['mp1','mp2','mp3','mp4'][min(3, act + (diff > 0 ? 2 : 0))]`).
 */
export function rollCountessTowerChestDrops113c(options: QuestChestBonusDropOptions113c): Item[] {
  const tables = getEmbeddedDropTables()
  const ctx = resolveChestDropContext113c(options.areaId, options.difficulty)
  const ilvl = Math.max(1, ctx.monsterLevel)
  const diffName =
    options.difficulty === 2 ? 'hell' : options.difficulty === 1 ? 'nightmare' : 'normal'
  const out: Item[] = []

  for (let i = 0; i < 3; i++) {
    let magicEquip: Item | undefined
    for (let attempt = 0; attempt < 12; attempt++) {
      const rolled = executeDropPipeline(tables, {
        tcName: ctx.tcName,
        nLevel: ilvl,
        monsterType: 3,
        difficulty: diffName,
        gamePlayers: Math.max(8, options.gamePlayers),
        partyPlayers: Math.max(8, options.partyPlayers),
        playerMf: options.playerMf,
        playerGf: options.playerGf,
        monsterRng: new D2Rng(options.rng.rand(0x7fffffff) || 1),
        forcedQuality: 4,
        ...(options.spawnedUniqueIds !== undefined
          ? { spawnedUniqueIds: options.spawnedUniqueIds }
          : {}),
      })
      const found = rolled.find(
        (it) =>
          (it.base.kind === 'armor' || it.base.kind === 'weapon' || Number(it.quality ?? 0) >= 4) &&
          Number(it.quality ?? 0) >= 4,
      )
      if (found) {
        magicEquip = finalizeDroppedItem113c(found)
        break
      }
    }
    if (!magicEquip) {
      const fallbackBase = pickRackBase113c(getArmorStandPool(tables), ilvl, options.rng)
      if (fallbackBase) {
        const fb = rollSelectedRackBaseDrop113c(
          fallbackBase,
          ilvl,
          {
            areaId: options.areaId,
            difficulty: options.difficulty,
            playerMf: options.playerMf,
            rng: options.rng,
            spawnedUniqueIds: options.spawnedUniqueIds,
          },
          tables,
          4,
        )
        magicEquip = fb[0]
      }
    }
    if (magicEquip) out.push(magicEquip)
  }

  const act = getLevelsMonLvlRecord113c(options.areaId).act
  const tierIdx = Math.min(3, Math.max(0, act + (options.difficulty > 0 ? 2 : 0)))
  const hpCode = TOWER_CHEST_HEAL_POTION_CODES_113C[tierIdx]!
  const mpCode = TOWER_CHEST_MANA_POTION_CODES_113C[tierIdx]!
  for (const code of [hpCode, hpCode, mpCode, mpCode]) {
    const base = tables.getBase(code)
    if (!base) continue
    const seed = options.rng.rand(0x7fffffff) >>> 0
    const itemRng = new D2Rng(seed || 1)
    out.push(
      createDroppedItem(base, 'normal', {
        itemTypes: tables.itemTypes,
        ilvl,
        dwInitSeed: seed,
        itemRng,
      }),
    )
  }
  return out
}

/**
 * 1.13c `OperateFn 33` Wirt's Body (`D2Game.dll` `0x6FC8D960`, `Objects.txt` `268` in Tristram `Area 38`):
 * Spawns `Wirt's Leg` (`'leg'`, white blunt weapon at `ilvl = max(1, areaLvl)`) + `15` gold piles!
 */
export function rollWirtsBodyDrops113c(
  areaId: number,
  difficulty: 0 | 1 | 2,
  playerGf: number,
  includeLeg: boolean,
  rng: { rand(max: number): number },
): Item[] {
  const tables = getEmbeddedDropTables()
  const ilvl = Math.max(1, getLevelMonsterLevel113c(areaId, difficulty, true))
  const out: Item[] = []
  if (includeLeg) {
    const legBase = tables.getBase('leg')
    if (legBase) {
      const seed = rng.rand(0x7fffffff) >>> 0
      const itemRng = new D2Rng(seed || 1)
      out.push(
        createDroppedItem(legBase, 'normal', {
          itemTypes: tables.itemTypes,
          ilvl,
          dwInitSeed: seed,
          itemRng,
          ethereal: false,
        }),
      )
    }
  }
  out.push(...createGoldPiles113c(15, ilvl, playerGf, rng))
  return out
}

export interface EvilUrnMemberSpec113c {
  readonly defId: string
  readonly hcIdx: number | undefined
  readonly rank: 'unique' | 'minion' | 'champion'
  readonly modifiers: readonly string[]
  readonly dx: number
  readonly dy: number
}

const EVIL_URN_RING_OFFSETS: readonly (readonly [number, number])[] = [
  [2, 0],
  [-2, 0],
  [0, 2],
  [0, -2],
  [2, 2],
  [-2, 2],
  [2, -2],
  [-2, -2],
  [3, 0],
  [-3, 0],
  [0, 3],
  [0, -3],
]

/**
 * 1.13c `OperateFn 68` Act 5 Evil Urn (`D2Game.dll` `0x6FC8EDB0`, `Objects.txt` `466`, `Parm7 = 255` -> 100%):
 * Spawns a Unique boss + minions (`80%`) or Champion pack (`20%`) from the level's elite monster pool.
 */
export function planEvilUrnPack113c(
  areaId: number,
  difficulty: 0 | 1 | 2,
  rng: { rand(max: number): number },
): readonly EvilUrnMemberSpec113c[] {
  const diffName: Difficulty =
    difficulty === 2 ? 'hell' : difficulty === 1 ? 'nightmare' : 'normal'
  const kinds = getCanonicalMonsterKinds(diffName)
  const plan = getLevelMonsterPlan113c(areaId, diffName) ?? getLevelMonsterPlan113c(115, diffName)

  const rollSeed = (rng.rand(0x7fffffff) || 1) >>> 0
  const packRng = new Rng(rollSeed)

  let candidates: MonsterKind[] = []
  if (plan) {
    const selected = selectLevelTypes(plan, kinds, packRng, diffName)
    candidates = resolveEliteCandidates(plan, selected, kinds, diffName)
    if (candidates.length === 0) {
      const fallbackNames =
        difficulty === 0 ? [...plan.elitePool, ...plan.pool] : [...plan.elitePool, ...plan.nightmarePool, ...plan.pool]
      for (const name of fallbackNames) {
        const k = kinds.get(name)
        if (k && !k.npc && k.killable) candidates.push(k)
      }
    }
  }
  if (candidates.length === 0) {
    const fallback = kinds.get('deathmauler1') ?? kinds.get('imp1') ?? kinds.get('snowyeti1')
    if (fallback) candidates = [fallback]
  }
  if (candidates.length === 0) return []

  const chosenKind = candidates[rng.rand(candidates.length)]!
  const isUnique = rng.rand(100) < 80

  if (isUnique) {
    const bossMods = rollEliteModifiers('unique', packRng, diffName, chosenKind)
    const minionCount =
      difficulty === 2 ? 4 + rng.rand(2) : difficulty === 1 ? 3 + rng.rand(2) : 2 + rng.rand(2)
    const out: EvilUrnMemberSpec113c[] = [
      {
        defId: chosenKind.id,
        hcIdx: chosenKind.hcIdx,
        rank: 'unique',
        modifiers: bossMods,
        dx: EVIL_URN_RING_OFFSETS[0]![0],
        dy: EVIL_URN_RING_OFFSETS[0]![1],
      },
    ]
    for (let i = 0; i < minionCount; i++) {
      const off = EVIL_URN_RING_OFFSETS[(i + 1) % EVIL_URN_RING_OFFSETS.length]!
      out.push({
        defId: chosenKind.id,
        hcIdx: chosenKind.hcIdx,
        rank: 'minion',
        modifiers: [],
        dx: off[0],
        dy: off[1],
      })
    }
    return out
  }

  const champCount = 2 + rng.rand(2)
  const out: EvilUrnMemberSpec113c[] = []
  for (let i = 0; i < champCount; i++) {
    const champMods = rollEliteModifiers('champion', packRng, diffName, chosenKind)
    const off = EVIL_URN_RING_OFFSETS[i % EVIL_URN_RING_OFFSETS.length]!
    out.push({
      defId: chosenKind.id,
      hcIdx: chosenKind.hcIdx,
      rank: 'champion',
      modifiers: champMods,
      dx: off[0],
      dy: off[1],
    })
  }
  return out
}

const TRAPPED_SOUL_POTIONS_BY_DIFFICULTY: Readonly<Record<0 | 1 | 2, readonly string[]>> = {
  0: ['hp2', 'hp3', 'mp2', 'mp3'],
  1: ['hp3', 'hp4', 'mp3', 'mp4'],
  2: ['hp4', 'hp5', 'mp4', 'mp5'],
}

/**
 * 1.13c Act 4 Trapped Soul (`Objects.txt 380, 381`, `OperateFn 48`, `D2Game.dll` `0x6FC8CE10`, #1957):
 * drops `1..2` healing/mana potions or gold piles (`'gld'`) and NEVER rolls `Act 4 Chest A/B/C` equipment TCs.
 */
export function rollTrappedSoulDrops113c(
  areaId: number,
  difficulty: 0 | 1 | 2,
  playerGf: number,
  rng: { rand(max: number): number },
): Item[] {
  const tables = getEmbeddedDropTables()
  const ilvl = Math.max(1, getLevelMonsterLevel113c(areaId, difficulty, true))
  const potionPool = TRAPPED_SOUL_POTIONS_BY_DIFFICULTY[difficulty]
  const count = 1 + rng.rand(2)
  const out: Item[] = []
  for (let i = 0; i < count; i++) {
    if (rng.rand(2) === 0) {
      out.push(...createGoldPiles113c(1, ilvl, playerGf, rng))
    } else {
      const code = potionPool[rng.rand(potionPool.length)]!
      const base = tables.getBase(code)
      if (!base) continue
      const seed = rng.rand(0x7fffffff) >>> 0
      const itemRng = new D2Rng(seed || 1)
      out.push(
        createDroppedItem(base, 'normal', {
          itemTypes: tables.itemTypes,
          ilvl,
          dwInitSeed: seed,
          itemRng,
        }),
      )
    }
  }
  return out
}
