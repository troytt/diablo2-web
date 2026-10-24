/**
 * Diablo II 1.13c v96 `.d2s` Character Save Binary Writer (`src/server/save/d2s-writer.ts`).
 * Zero DOM or Node dependencies, and zero wall-clock or Math.random() calls.
 */

import {
  D2S_MAGIC,
  D2S_VERSION,
  encodeGfStatSection,
  writeD2sChecksum,
} from '../../common/formats/d2s.ts'
import {
  encodeItemBitstream,
  type ItemData,
  type ItemDataTables,
} from '../../netproto/index.ts'
import {
  getServerItemDataTables,
  type D2sCharacterData,
  type D2sCharacterSave,
  type D2sItemInput,
} from './d2s-reader.ts'

export function createDefaultQuestData(): Uint8Array {
  const buf = new Uint8Array(298)
  buf[0] = 0x57 // 'W'
  buf[1] = 0x6f // 'o'
  buf[2] = 0x6f // 'o'
  buf[3] = 0x21 // '!'
  const view = new DataView(buf.buffer)
  view.setUint32(4, 6, true)
  view.setUint16(8, 298, true)
  return buf
}

export function createDefaultWaypointData(): Uint8Array {
  const buf = new Uint8Array(80)
  buf[0] = 0x57 // 'W'
  buf[1] = 0x53 // 'S'
  const view = new DataView(buf.buffer)
  view.setUint32(2, 1, true)
  view.setUint16(6, 80, true)
  for (let diff = 0; diff < 3; diff++) {
    const base = 8 + diff * 24
    buf[base] = 0x02
    buf[base + 1] = 0x01
    buf[base + 2] = 0x01 // Rogue Encampment WP unlocked by default
  }
  return buf
}

export function createDefaultNpcIntroData(): Uint8Array {
  const buf = new Uint8Array(52)
  buf[0] = 0x01
  buf[1] = 0x77
  const view = new DataView(buf.buffer)
  view.setUint16(2, 52, true)
  return buf
}

export function writeItemListSection(
  items: readonly D2sItemInput[],
  tables: ItemDataTables,
): Uint8Array {
  const chunks: Uint8Array[] = []
  let topLevelCount = 0

  for (let i = 0; i < items.length; i++) {
    const item = items[i]! as ItemData
    const isSocketChild = item.location === 6 || Boolean(item.inSocket)
    if (!isSocketChild) {
      topLevelCount++
      // Count how many flat socketed children immediately follow this host item in `items`
      let flatFollowingChildren = 0
      for (let j = i + 1; j < items.length; j++) {
        const nextItem = items[j]!
        if (nextItem.location === 6 || Boolean(nextItem.inSocket)) {
          flatFollowingChildren++
        } else {
          break
        }
      }
      const nestedChildren = item.socketedItems ?? []
      const useNested = flatFollowingChildren === 0 && nestedChildren.length > 0
      const childCount = useNested
        ? nestedChildren.length
        : flatFollowingChildren > 0
          ? flatFollowingChildren
          : item.socketedChildCount ?? 0

      const normalizedHost: ItemData =
        childCount > 0
          ? {
              ...item,
              socketed: true,
              socketedChildCount: childCount,
              usedSockets: childCount,
              totalSockets: Math.max(item.totalSockets ?? 0, childCount),
            }
          : item

      chunks.push(
        encodeItemBitstream(normalizedHost, tables, {
          saveFormat: true,
          expectJmHeader: true,
        }),
      )

      if (useNested) {
        for (const child of nestedChildren) {
          const normalizedChild: ItemData = {
            ...(child as ItemData),
            location: 6,
            inSocket: true,
          }
          chunks.push(
            encodeItemBitstream(normalizedChild, tables, {
              saveFormat: true,
              expectJmHeader: true,
            }),
          )
        }
      }
    } else {
      chunks.push(
        encodeItemBitstream(item, tables, {
          saveFormat: true,
          expectJmHeader: true,
        }),
      )
    }
  }

  let payloadBytes = 0
  for (const c of chunks) payloadBytes += c.byteLength

  const out = new Uint8Array(4 + payloadBytes)
  out[0] = 0x4a // 'J'
  out[1] = 0x4d // 'M'
  new DataView(out.buffer).setUint16(2, topLevelCount & 0xffff, true)
  let offset = 4
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return out
}

/**
 * Serializes a `D2sCharacterSave` (`D2sCharacterData`) into a complete 1.13c v96 `.d2s` binary buffer
 * with exact header size (`0x08`) and rotating checksum (`0x0C`).
 */
export function writeD2sSave113c(
  save: D2sCharacterSave | D2sCharacterData,
  tables: ItemDataTables = getServerItemDataTables(),
): Uint8Array {
  const header = new Uint8Array(0x2fd)
  const headerView = new DataView(header.buffer)

  // 0x00: magic (0xaa55aa55) & 0x04: version (96)
  headerView.setUint32(0x00, D2S_MAGIC, true)
  headerView.setUint32(0x04, D2S_VERSION, true)
  // 0x08: fileSize and 0x0C: checksum filled at the end
  headerView.setUint32(0x10, (save.activeWeapon ?? 0) >>> 0, true)

  // 0x14..0x23: 16-byte null-padded ASCII character name
  const trimmedName = (save.name ?? 'Hero').slice(0, 15)
  for (let i = 0; i < trimmedName.length; i++) {
    header[0x14 + i] = trimmedName.charCodeAt(i) & 0x7f
  }

  // 0x24: statusFlags
  let statusFlags = save.statusFlags
  if (statusFlags === undefined) {
    statusFlags = save.isExpansion === false ? 0x00 : 0x20
    if (save.isHardcore) statusFlags |= 0x04
    if (save.isDead) statusFlags |= 0x08
  }
  header[0x24] = statusFlags & 0xff
  header[0x25] = (save.progression ?? 0) & 0xff
  header[0x28] = Number(save.classId ?? save.charClass ?? 0) & 0xff
  header[0x29] = 0x10
  header[0x2a] = 0x1e
  header[0x2b] = Math.max(1, save.level ?? save.attributes?.level ?? 1) & 0xff

  const createdTs = (save.createdTimestamp ?? save.timestampSec ?? save.timestamp ?? 0) >>> 0
  const lastPlayedTs = (save.lastPlayedTimestamp ?? save.timestampSec ?? save.timestamp ?? createdTs) >>> 0
  headerView.setUint32(0x2c, createdTs, true)
  headerView.setUint32(0x30, lastPlayedTs, true)
  headerView.setUint32(0x34, 0xffffffff, true)

  // 0x38..0x77: 16 u32LE assigned skill hotkeys
  const hotkeys = save.hotkeys ?? save.assignedSkills
  for (let i = 0; i < 16; i++) {
    const val = hotkeys && i < hotkeys.length ? hotkeys[i]! : 0xffff
    headerView.setUint32(0x38 + i * 4, val >>> 0, true)
  }

  // 0x78..0x87: active skills
  const lrs = save.leftRightSkills
  headerView.setUint32(0x78, (lrs?.[0] ?? save.leftSkill ?? 0) >>> 0, true)
  headerView.setUint32(0x7c, (lrs?.[1] ?? save.rightSkill ?? 0) >>> 0, true)
  headerView.setUint32(0x80, (lrs?.[2] ?? save.altLeftSkill ?? 0) >>> 0, true)
  headerView.setUint32(0x84, (lrs?.[3] ?? save.altRightSkill ?? 0) >>> 0, true)

  // 0x88..0xA7: 32-byte character menu appearance
  const appearance = save.appearance ?? save.menuAppearance
  if (appearance && appearance.byteLength >= 32) {
    header.set(appearance.subarray(0, 32), 0x88)
  } else {
    header.fill(0xff, 0x88, 0xa8)
  }

  // 0xA8..0xAA: 3-byte difficulty/act location
  if (save.difficultyLocation && save.difficultyLocation.byteLength >= 3) {
    header.set(save.difficultyLocation.subarray(0, 3), 0xa8)
  } else if (save.difficultyTowns && save.difficultyTowns.length >= 3) {
    header[0xa8] = save.difficultyTowns[0]! & 0xff
    header[0xa9] = save.difficultyTowns[1]! & 0xff
    header[0xaa] = save.difficultyTowns[2]! & 0xff
  } else {
    const diff = save.activeDifficulty ?? save.difficulty ?? 0
    const act = save.activeAct ?? save.act ?? 0
    header[0xa8 + diff] = 0x80 | (act & 0x07)
  }
  if (
    save.activeDifficulty !== undefined ||
    save.difficulty !== undefined ||
    save.activeAct !== undefined ||
    save.act !== undefined
  ) {
    let encodedDiff = -1
    let encodedAct = 0
    for (let d = 0; d < 3; d++) {
      const b = header[0xa8 + d]!
      if ((b & 0x80) !== 0) {
        encodedDiff = d
        encodedAct = b & 0x07
        break
      }
    }
    const targetDiff = save.activeDifficulty ?? save.difficulty ?? (encodedDiff >= 0 ? encodedDiff : 0)
    const targetAct = save.activeAct ?? save.act ?? encodedAct
    if (encodedDiff !== targetDiff || encodedAct !== targetAct) {
      header[0xa8] = header[0xa8]! & 0x7f
      header[0xa9] = header[0xa9]! & 0x7f
      header[0xaa] = header[0xaa]! & 0x7f
      header[0xa8 + targetDiff] = 0x80 | (targetAct & 0x07)
    }
  }

  // 0xAB: u32LE mapSeed
  headerView.setUint32(0xab, (save.mapSeed ?? 0) >>> 0, true)

  // 0xB1..0xBE: Mercenary header
  const merc = save.merc ?? save.mercenary ?? null
  const rawMercDead = merc ? (merc.dead ?? merc.flags ?? (merc.isDead ? 1 : 0)) : 0
  const mercDead = typeof rawMercDead === 'boolean' ? (rawMercDead ? 1 : 0) : Number(rawMercDead)
  const mercSeed = merc ? ((merc.seed ?? merc.guid ?? 0) >>> 0) : 0
  const mercNameId = merc ? (merc.nameId ?? 0) : 0
  const mercTypeId = merc ? (merc.typeId ?? 0) : 0
  const mercExp = merc ? ((merc.experience ?? 0) >>> 0) : 0

  headerView.setUint16(0xb1, mercDead & 0xffff, true)
  headerView.setUint32(0xb3, mercSeed, true)
  headerView.setUint16(0xb7, mercNameId & 0xffff, true)
  headerView.setUint16(0xb9, mercTypeId & 0xffff, true)
  headerView.setUint32(0xbb, mercExp, true)

  // 0x14F..0x278: 298-byte "Woo!" quest data
  let questsBuf: Uint8Array
  if (Array.isArray(save.quests)) {
    questsBuf = createDefaultQuestData()
    const qView = new DataView(questsBuf.buffer, questsBuf.byteOffset, questsBuf.byteLength)
    for (let d = 0; d < 3; d++) {
      const diffQuests = save.quests[d]
      if (!diffQuests) continue
      const base = 10 + d * 96
      const count = Math.min(48, diffQuests.length)
      for (let q = 0; q < count; q++) {
        qView.setUint16(base + q * 2, (diffQuests[q] ?? 0) & 0xffff, true)
      }
    }
  } else if (save.quests instanceof Uint8Array && save.quests.byteLength === 298) {
    questsBuf = save.quests
  } else if (save.questsRaw instanceof Uint8Array && save.questsRaw.byteLength === 298) {
    questsBuf = save.questsRaw
  } else {
    questsBuf = createDefaultQuestData()
  }
  header.set(questsBuf, 0x14f)

  // 0x279..0x2C8: 80-byte "WS" waypoint data
  let waypointsBuf: Uint8Array
  if (Array.isArray(save.waypoints)) {
    waypointsBuf = createDefaultWaypointData()
    for (let d = 0; d < 3; d++) {
      const diffWp = save.waypoints[d]
      const base = 8 + d * 24
      waypointsBuf.fill(0, base, base + 24)
      if (diffWp) {
        waypointsBuf.set(diffWp.subarray(0, Math.min(24, diffWp.byteLength)), base)
      }
    }
  } else if (save.waypoints instanceof Uint8Array && save.waypoints.byteLength === 80) {
    waypointsBuf = save.waypoints
  } else if (save.waypointsRaw instanceof Uint8Array && save.waypointsRaw.byteLength === 80) {
    waypointsBuf = save.waypointsRaw
  } else {
    waypointsBuf = createDefaultWaypointData()
  }
  header.set(waypointsBuf, 0x279)

  // 0x2C9..0x2FC: 52-byte NPC intro data
  const npcIntroRaw = save.npcIntros ?? save.npcIntro
  const npcIntro =
    npcIntroRaw && npcIntroRaw.byteLength === 52 ? npcIntroRaw : createDefaultNpcIntroData()
  header.set(npcIntro, 0x2c9)

  // 0x2FD: "gf" character attributes bitstream
  const gfBytes = encodeGfStatSection({
    ...save.attributes,
    level: save.attributes?.level ?? save.level ?? 1,
  })

  // "if" + 30-byte skills section
  const ifBytes = new Uint8Array(32)
  ifBytes[0] = 0x69 // 'i'
  ifBytes[1] = 0x66 // 'f'
  const skillBytes = save.skillLevels ?? save.skills
  if (skillBytes) {
    ifBytes.set(skillBytes.subarray(0, 30), 2)
  }

  // Player "JM" item list
  const playerJmBytes = writeItemListSection(save.items ?? [], tables)

  // Corpse "JM" section
  const corpseItems = save.corpseItems ?? []
  let corpseSectionBytes: Uint8Array
  if (corpseItems.length === 0) {
    corpseSectionBytes = new Uint8Array([0x4a, 0x4d, 0x00, 0x00])
  } else {
    const corpseListBytes = writeItemListSection(corpseItems, tables)
    corpseSectionBytes = new Uint8Array(4 + 12 + corpseListBytes.byteLength)
    corpseSectionBytes[0] = 0x4a // 'J'
    corpseSectionBytes[1] = 0x4d // 'M'
    corpseSectionBytes[2] = 0x01
    corpseSectionBytes[3] = 0x00
    // 12-byte corpse header (unknown=0, x=0, y=0) at bytes 4..15
    corpseSectionBytes.set(corpseListBytes, 16)
  }

  // Expansion sections: "jf" mercenary items and "kf" Iron Golem
  const isExpansion = (statusFlags & 0x20) !== 0
  const tailChunks: Uint8Array[] = []
  if (isExpansion) {
    tailChunks.push(new Uint8Array([0x6a, 0x66])) // "jf"
    if (mercSeed !== 0) {
      const mercItemList = merc?.items ?? save.mercItems ?? []
      tailChunks.push(writeItemListSection(mercItemList, tables))
    }
    const ironGolem = save.ironGolem ?? save.ironGolemItem ?? null
    if (ironGolem) {
      tailChunks.push(new Uint8Array([0x6b, 0x66, 0x01])) // "kf" + hasGolem=1
      const golemChildren = ironGolem.socketedItems ?? []
      const normalizedGolem: ItemData = (
        golemChildren.length > 0
          ? {
              ...ironGolem,
              socketed: true,
              socketedChildCount: golemChildren.length,
              usedSockets: golemChildren.length,
              totalSockets: Math.max(ironGolem.totalSockets ?? 0, golemChildren.length),
            }
          : ironGolem
      ) as ItemData
      tailChunks.push(
        encodeItemBitstream(normalizedGolem, tables, {
          saveFormat: true,
          expectJmHeader: true,
        }),
      )
      for (const child of golemChildren) {
        tailChunks.push(
          encodeItemBitstream(
            { ...(child as ItemData), location: 6, inSocket: true },
            tables,
            {
              saveFormat: true,
              expectJmHeader: true,
            },
          ),
        )
      }
    } else {
      tailChunks.push(new Uint8Array([0x6b, 0x66, 0x00])) // "kf" + hasGolem=0
    }
  }

  const allParts: Uint8Array[] = [
    header,
    gfBytes,
    ifBytes,
    playerJmBytes,
    corpseSectionBytes,
    ...tailChunks,
  ]
  let totalSize = 0
  for (const part of allParts) totalSize += part.byteLength

  const out = new Uint8Array(totalSize)
  let writeCursor = 0
  for (const part of allParts) {
    out.set(part, writeCursor)
    writeCursor += part.byteLength
  }

  const outView = new DataView(out.buffer)
  outView.setUint32(0x08, totalSize >>> 0, true)
  writeD2sChecksum(out)
  return out
}

export const writeD2s = writeD2sSave113c
export const writeD2sSave = writeD2sSave113c
