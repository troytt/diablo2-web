/**
 * Offline Skill Asset & Data Extraction Script.
 *
 * Extracts all 210 skill icons and 21 skill tree backgrounds from Diablo II MPQ archives
 * into public/skills/ and generates the comprehensive skill catalog.
 */

import { MpqArchive } from '../../common/mpq/archive.ts'
import { fileSource } from '../io/file-source.ts'
import { MountedArchives } from '../../common/mpq/mount.ts'
import { decodeDc6 } from '../../common/formats/dc6.ts'
import { decodePl2 } from '../../common/formats/pl2.ts'
import { loadActTables } from '../../common/world/acts.ts'
import { encodeIndexedPng } from '../io/png.ts'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CLASS_CODES = ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass'] as const

const CLASS_ICON_DC6: Record<string, string> = {
  ama: 'data\\global\\ui\\SPELLS\\AmSkillicon.DC6',
  sor: 'data\\global\\ui\\SPELLS\\SoSkillicon.DC6',
  nec: 'data\\global\\ui\\SPELLS\\NeSkillicon.DC6',
  pal: 'data\\global\\ui\\SPELLS\\PaSkillicon.DC6',
  bar: 'data\\global\\ui\\SPELLS\\BaSkillicon.DC6',
  dru: 'data\\global\\ui\\SPELLS\\DrSkillicon.dc6',
  ass: 'data\\global\\ui\\SPELLS\\AsSkillicon.dc6',
}

const CLASS_BACK_DC6: Record<string, string> = {
  ama: 'data\\global\\ui\\SPELLS\\skltree_a_back.DC6',
  sor: 'data\\global\\ui\\SPELLS\\skltree_s_back.DC6',
  nec: 'data\\global\\ui\\SPELLS\\skltree_n_back.DC6',
  pal: 'data\\global\\ui\\SPELLS\\skltree_p_back.DC6',
  bar: 'data\\global\\ui\\SPELLS\\skltree_b_back.DC6',
  dru: 'data\\global\\ui\\SPELLS\\skltree_d_back.dc6',
  ass: 'data\\global\\ui\\SPELLS\\skltree_i_back.dc6',
}

async function main() {
  console.log('Mounting MPQ archives...')
  const archives = new MountedArchives()
  for (const m of ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
    archives.add(m, await MpqArchive.open(await fileSource(`samples/d2/${m}`)))
  }

  const tables = await loadActTables(archives)
  const skillsTable = tables.skills!
  const skillDescTable = tables.skilldesc!

  const pl2Data = await archives.read('data\\global\\palette\\ACT1\\pal.pl2')
  const pl2 = decodePl2(pl2Data)

  const outDir = join(process.cwd(), 'public', 'skills')
  mkdirSync(outDir, { recursive: true })

  console.log('Extracting skill tab backgrounds...')
  for (const cls of CLASS_CODES) {
    const backDc6 = decodeDc6(await archives.read(CLASS_BACK_DC6[cls]!))
    const W = 256, H = 432
    const baseTop = backDc6.groups[0]!.frames[0]!
    const baseBot = backDc6.groups[0]!.frames[2]!
    for (let tab = 0; tab < 3; tab++) {
      const topFrameIndex = 4 + tab * 4
      const botFrameIndex = 6 + tab * 4
      const topFrame = backDc6.groups[0]!.frames[topFrameIndex]!
      const botFrame = backDc6.groups[0]!.frames[botFrameIndex]!

      const pixels = new Uint8Array(W * H)
      for (let i = 0; i < 256 * 256; i++) {
        const p = topFrame.indices[i]!
        pixels[i] = p !== 0 ? p : baseTop.indices[i]!
      }
      for (let i = 0; i < 256 * 176; i++) {
        const p = botFrame.indices[i]!
        pixels[256 * 256 + i] = p !== 0 ? p : baseBot.indices[i]!
      }

      const png = encodeIndexedPng({
        width: W,
        height: H,
        pixels,
        palette: pl2.rgb,
      })
      writeFileSync(join(outDir, `bg_${cls}_${tab}.png`), png)
    }
  }
  console.log('All 21 skill tab backgrounds extracted!')

  console.log('Extracting skill icons...')
  const iconSheets: Record<string, any> = {}
  for (const cls of CLASS_CODES) {
    iconSheets[cls] = decodeDc6(await archives.read(CLASS_ICON_DC6[cls]!))
  }

  let totalIcons = 0
  for (const cls of CLASS_CODES) {
    const classSkills = skillsTable.rows.filter(r => r[2]?.toLowerCase() === cls)
    const sheet = iconSheets[cls]!

    for (const r of classSkills) {
      const skillId = Number(r[1])
      const descName = r[3]
      const descRow = skillDescTable.rows.find(d => d[0]?.toLowerCase() === descName?.toLowerCase())
      if (!descRow) continue

      const iconCel = Number(descRow[6])
      // Normal icon
      const frameNormal = sheet.groups[0].frames[iconCel]
      if (frameNormal) {
        const png = encodeIndexedPng({
          width: frameNormal.width,
          height: frameNormal.height,
          pixels: frameNormal.indices,
          palette: pl2.rgb,
          transparentIndex: 0,
        })
        writeFileSync(join(outDir, `icon_${skillId}.png`), png)
      }

      // Active / highlighted icon (iconCel + 1)
      const frameActive = sheet.groups[0].frames[iconCel + 1]
      if (frameActive) {
        const png = encodeIndexedPng({
          width: frameActive.width,
          height: frameActive.height,
          pixels: frameActive.indices,
          palette: pl2.rgb,
          transparentIndex: 0,
        })
        writeFileSync(join(outDir, `icon_${skillId}_active.png`), png)
      }

      totalIcons++
    }
  }

  console.log('Extracting generic skill icons (Attack, Fist, Sword, Kick, Throw, Unsummon, Left Hand Throw/Swing, Scrolls/Tomes)...')
  const genericSkillsDc6 = decodeDc6(await archives.read('data\\global\\ui\\SPELLS\\Skillicon.DC6'))
  const gsFrames = genericSkillsDc6.groups[0]!.frames
  const genericSkillItems = [
    { name: 'icon_0.png', frameIndex: 2 },
    { name: 'icon_0_active.png', frameIndex: 3 },
    { name: 'icon_0_sword.png', frameIndex: 2 },
    { name: 'icon_0_fist.png', frameIndex: 0 },
    { name: 'icon_1.png', frameIndex: 0 },
    { name: 'icon_1_active.png', frameIndex: 1 },
    { name: 'icon_2.png', frameIndex: 6 },
    { name: 'icon_2_active.png', frameIndex: 7 },
    { name: 'icon_3.png', frameIndex: 4 },
    { name: 'icon_3_active.png', frameIndex: 5 },
    { name: 'icon_4.png', frameIndex: 12 },
    { name: 'icon_4_active.png', frameIndex: 13 },
    { name: 'icon_5.png', frameIndex: 10 },
    { name: 'icon_5_active.png', frameIndex: 11 },
    { name: 'icon_217.png', frameIndex: 14 },
    { name: 'icon_217_active.png', frameIndex: 15 },
    { name: 'icon_218.png', frameIndex: 14 },
    { name: 'icon_218_active.png', frameIndex: 15 },
    { name: 'icon_219.png', frameIndex: 18 },
    { name: 'icon_219_active.png', frameIndex: 19 },
    { name: 'icon_220.png', frameIndex: 18 },
    { name: 'icon_220_active.png', frameIndex: 19 },
    { name: 'icon_350.png', frameIndex: 2 },
    { name: 'icon_350_active.png', frameIndex: 3 },
  ]
  for (const item of genericSkillItems) {
    const f = gsFrames[item.frameIndex]
    if (!f) continue
    const png = encodeIndexedPng({
      width: f.width,
      height: f.height,
      pixels: f.indices,
      palette: pl2.rgb,
      transparentIndex: 0,
    })
    writeFileSync(join(outDir, item.name), png)
  }

  const manifest = {
    schema: 1,
    classes: CLASS_CODES,
    backgrounds: 21,
    totalIcons,
  }
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`Extracted ${totalIcons} skill icons!`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

