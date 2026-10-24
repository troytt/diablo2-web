/**
 * Canonical Diablo II v1.13c Object & Shrine Metadata (`Objects.txt`, `Shrines.txt`, `.tbl`).
 *
 * Extracted from authoritative 1.13c MPQ archives (`d2data.mpq`, `d2exp.mpq`, `Patch_D2.mpq`):
 * - `Objects.txt`: `Name`, `Selectable0..Selectable7`, `SubClass`, `OperateFn`, `Parm0`, `IsDoor`
 * - `Shrines.txt` & `patchstring.tbl[809..831]`: Shrine Type `Code 0..22` localized names
 */

export interface CanonicalObjectHitBox {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export interface CanonicalObjectMeta {
  readonly selectableMask: number
  readonly nameEn: string
  readonly nameZh: string
  readonly isShrine?: boolean | undefined
  readonly parm0?: number | undefined
  readonly isDoor?: boolean | undefined
  readonly token?: string | undefined
  readonly xOffset?: number | undefined
  readonly yOffset?: number | undefined
  readonly subClass?: number | undefined
  readonly sizeX?: number | undefined
  readonly sizeY?: number | undefined
  readonly hasCollisionMask?: number | undefined
  readonly blockMissile?: boolean | undefined
  readonly blocksVis?: boolean | undefined
  readonly collisionSubst?: boolean | undefined
  readonly left?: number | undefined
  readonly top?: number | undefined
  readonly width?: number | undefined
  readonly height?: number | undefined
  readonly hitBox?: CanonicalObjectHitBox | undefined
  readonly modeHitBoxes?: Readonly<Record<number, CanonicalObjectHitBox>> | undefined
  readonly start?: readonly number[] | undefined
  readonly frameCnt?: readonly number[] | undefined
  readonly frameDelta?: readonly number[] | undefined
  readonly cycleAnim?: readonly boolean[] | undefined
}

export interface LocalizedObjectName {
  readonly name: string
  readonly nameZh: string
}

export const CANONICAL_113C_SHRINES: Readonly<Record<number, LocalizedObjectName>> = Object.freeze({
  "0": {
    "name": "Shrine",
    "nameZh": "神殿"
  },
  "1": {
    "name": "Refilling Shrine",
    "nameZh": "回復神殿"
  },
  "2": {
    "name": "Health Shrine",
    "nameZh": "生命神殿"
  },
  "3": {
    "name": "Mana Shrine",
    "nameZh": "法力神殿"
  },
  "4": {
    "name": "Health Exchange Shrine",
    "nameZh": "生命交換神殿"
  },
  "5": {
    "name": "Mana Exchange Shrine",
    "nameZh": "法力交換神殿"
  },
  "6": {
    "name": "Armor Shrine",
    "nameZh": "裝甲神殿"
  },
  "7": {
    "name": "Combat Shrine",
    "nameZh": "作戰神殿"
  },
  "8": {
    "name": "Resist Fire Shrine",
    "nameZh": "抗火焰神殿"
  },
  "9": {
    "name": "Resist Cold Shrine",
    "nameZh": "抗冰凍神殿"
  },
  "10": {
    "name": "Resist Lightning Shrine",
    "nameZh": "抗閃電神殿"
  },
  "11": {
    "name": "Resist Poison Shrine",
    "nameZh": "抗毒素神殿"
  },
  "12": {
    "name": "Skill Shrine",
    "nameZh": "技能神殿"
  },
  "13": {
    "name": "Mana Recharge Shrine",
    "nameZh": "法力補充神殿"
  },
  "14": {
    "name": "Stamina Shrine",
    "nameZh": "耐力神殿"
  },
  "15": {
    "name": "Experience Shrine",
    "nameZh": "經驗神殿"
  },
  "16": {
    "name": "Enirhs Shrine",
    "nameZh": "辨視神殿"
  },
  "17": {
    "name": "Portal Shrine",
    "nameZh": "傳送神殿"
  },
  "18": {
    "name": "Gem Shrine",
    "nameZh": "寶石神殿"
  },
  "19": {
    "name": "Fire Shrine",
    "nameZh": "火焰神殿"
  },
  "20": {
    "name": "Monster Shrine",
    "nameZh": "怪物神殿"
  },
  "21": {
    "name": "Exploding Shrine",
    "nameZh": "爆裂神殿"
  },
  "22": {
    "name": "Poison Shrine",
    "nameZh": "毒素神殿"
  }
})

const RAW_CANONICAL_113C_OBJECTS: Record<number, CanonicalObjectMeta> = {
  "0": {
    "selectableMask": 0,
    "nameEn": "Expansion",
    "nameZh": "Expansion",
    "token": "NU0",
    "xOffset": 0,
    "yOffset": 0
  },
  "1": {
    "selectableMask": 1,
    "nameEn": "Casket",
    "nameZh": "棺材",
    "token": "C5",
    "xOffset": 0,
    "yOffset": 0
  },
  "2": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "SF",
    "xOffset": 0,
    "yOffset": 0
  },
  "3": {
    "selectableMask": 1,
    "nameEn": "Casket",
    "nameZh": "棺材",
    "token": "C6",
    "xOffset": 0,
    "yOffset": 0
  },
  "4": {
    "selectableMask": 1,
    "nameEn": "Large Urn",
    "nameZh": "大罈子",
    "token": "U1",
    "xOffset": 0,
    "yOffset": 0
  },
  "5": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "L1",
    "xOffset": 0,
    "yOffset": 0
  },
  "6": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "L2",
    "xOffset": 0,
    "yOffset": 0
  },
  "7": {
    "selectableMask": 249,
    "nameEn": "Barrel",
    "nameZh": "木桶",
    "token": "B1",
    "xOffset": 0,
    "yOffset": 0
  },
  "8": {
    "selectableMask": 7,
    "nameEn": "The Moldy Tome",
    "nameZh": "發霉的古書",
    "token": "TT",
    "xOffset": 0,
    "yOffset": 0
  },
  "9": {
    "selectableMask": 1,
    "nameEn": "Urn",
    "nameZh": "罈",
    "token": "U2",
    "xOffset": 0,
    "yOffset": 0
  },
  "10": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "BE",
    "xOffset": 0,
    "yOffset": 0
  },
  "11": {
    "selectableMask": 249,
    "nameEn": "Barrel",
    "nameZh": "木桶",
    "token": "BX",
    "xOffset": 0,
    "yOffset": 0
  },
  "12": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "FN",
    "xOffset": 0,
    "yOffset": 0
  },
  "13": {
    "selectableMask": 245,
    "nameEn": "Closed Door",
    "nameZh": "關閉的門",
    "isDoor": true,
    "token": "D1",
    "xOffset": 1,
    "yOffset": 4
  },
  "14": {
    "selectableMask": 245,
    "nameEn": "Closed Door",
    "nameZh": "關閉的門",
    "isDoor": true,
    "token": "D2",
    "xOffset": 1,
    "yOffset": 4
  },
  "15": {
    "selectableMask": 245,
    "nameEn": "Closed Door",
    "nameZh": "關閉的門",
    "isDoor": true,
    "token": "D3",
    "xOffset": 0,
    "yOffset": 4
  },
  "16": {
    "selectableMask": 245,
    "nameEn": "Closed Door",
    "nameZh": "關閉的門",
    "isDoor": true,
    "token": "D4",
    "xOffset": 1,
    "yOffset": 3
  },
  "17": {
    "selectableMask": 245,
    "nameEn": "Cairn Stone",
    "nameZh": "石塚",
    "token": "S1",
    "xOffset": 0,
    "yOffset": 0
  },
  "18": {
    "selectableMask": 245,
    "nameEn": "Cairn Stone",
    "nameZh": "石塚",
    "token": "S2",
    "xOffset": 0,
    "yOffset": 0
  },
  "19": {
    "selectableMask": 245,
    "nameEn": "Cairn Stone",
    "nameZh": "石塚",
    "token": "S3",
    "xOffset": 0,
    "yOffset": 0
  },
  "20": {
    "selectableMask": 245,
    "nameEn": "Cairn Stone",
    "nameZh": "石塚",
    "token": "S4",
    "xOffset": 0,
    "yOffset": 0
  },
  "21": {
    "selectableMask": 245,
    "nameEn": "Cairn Stone",
    "nameZh": "石塚",
    "token": "S5",
    "xOffset": 0,
    "yOffset": 0
  },
  "22": {
    "selectableMask": 0,
    "nameEn": "Cairn Stone",
    "nameZh": "石塚",
    "token": "S6",
    "xOffset": 0,
    "yOffset": 0
  },
  "23": {
    "selectableMask": 245,
    "nameEn": "Closed Door",
    "nameZh": "關閉的門",
    "isDoor": true,
    "token": "D5",
    "xOffset": 1,
    "yOffset": 1
  },
  "24": {
    "selectableMask": 245,
    "nameEn": "Closed Door",
    "nameZh": "關閉的門",
    "isDoor": true,
    "token": "D6",
    "xOffset": 1,
    "yOffset": 1
  },
  "25": {
    "selectableMask": 245,
    "nameEn": "Closed Door",
    "nameZh": "關閉的門",
    "isDoor": true,
    "token": "D7",
    "xOffset": 0,
    "yOffset": -11
  },
  "26": {
    "selectableMask": 1,
    "nameEn": "Cain's Gibbet",
    "nameZh": "凱恩的絞架",
    "token": "GI",
    "xOffset": -14,
    "yOffset": 15
  },
  "27": {
    "selectableMask": 245,
    "nameEn": "Closed Door",
    "nameZh": "關閉的門",
    "isDoor": true,
    "token": "D8",
    "xOffset": 1,
    "yOffset": 1
  },
  "28": {
    "selectableMask": 1,
    "nameEn": "Undefiled Grave",
    "nameZh": "不明的墓地",
    "token": "HI",
    "xOffset": 1,
    "yOffset": 1
  },
  "29": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "BR",
    "xOffset": 0,
    "yOffset": 0
  },
  "30": {
    "selectableMask": 1,
    "nameEn": "Tree of Inifuss",
    "nameZh": "艾尼弗斯之樹",
    "token": "IT",
    "xOffset": 0,
    "yOffset": 0
  },
  "31": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "BF",
    "xOffset": 0,
    "yOffset": 0
  },
  "32": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "CL",
    "xOffset": 0,
    "yOffset": 0
  },
  "33": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "A1",
    "xOffset": 0,
    "yOffset": 0
  },
  "34": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "A2",
    "xOffset": 0,
    "yOffset": 0
  },
  "35": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "N1",
    "xOffset": 0,
    "yOffset": 0
  },
  "36": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "N2",
    "xOffset": 0,
    "yOffset": 0
  },
  "37": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "TO",
    "xOffset": 0,
    "yOffset": 0
  },
  "38": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "WT",
    "xOffset": 0,
    "yOffset": 0
  },
  "39": {
    "selectableMask": 0,
    "nameEn": "Fire",
    "nameZh": "火焰",
    "token": "RB",
    "xOffset": 0,
    "yOffset": 0
  },
  "40": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "R1",
    "xOffset": 0,
    "yOffset": -9
  },
  "41": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "R2",
    "xOffset": 0,
    "yOffset": -9
  },
  "42": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "R3",
    "xOffset": 0,
    "yOffset": -9
  },
  "43": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "R4",
    "xOffset": 0,
    "yOffset": -9
  },
  "44": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "R5",
    "xOffset": 0,
    "yOffset": -9
  },
  "45": {
    "selectableMask": 0,
    "nameEn": "Ambient Sound",
    "nameZh": "環境聲音",
    "token": "S1",
    "xOffset": 0,
    "yOffset": 0
  },
  "46": {
    "selectableMask": 1,
    "nameEn": "Crate",
    "nameZh": "箱子",
    "token": "CT",
    "xOffset": 0,
    "yOffset": 0
  },
  "47": {
    "selectableMask": 245,
    "nameEn": "Closed Door",
    "nameZh": "關閉的門",
    "isDoor": true,
    "token": "AD",
    "xOffset": 1,
    "yOffset": 1
  },
  "48": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "T1",
    "xOffset": 0,
    "yOffset": 0
  },
  "49": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "T2",
    "xOffset": 0,
    "yOffset": 0
  },
  "50": {
    "selectableMask": 1,
    "nameEn": "Casket",
    "nameZh": "棺材",
    "token": "C1",
    "xOffset": 0,
    "yOffset": 9
  },
  "51": {
    "selectableMask": 1,
    "nameEn": "Casket",
    "nameZh": "棺材",
    "token": "C2",
    "xOffset": 0,
    "yOffset": 0
  },
  "52": {
    "selectableMask": 1,
    "nameEn": "Urn",
    "nameZh": "罈",
    "token": "U3",
    "xOffset": 0,
    "yOffset": 0
  },
  "53": {
    "selectableMask": 1,
    "nameEn": "Casket",
    "nameZh": "棺材",
    "token": "C4",
    "xOffset": 0,
    "yOffset": 4
  },
  "54": {
    "selectableMask": 1,
    "nameEn": "Dead Rogue",
    "nameZh": "死掉的蘿格",
    "token": "Z1",
    "xOffset": 0,
    "yOffset": 0
  },
  "55": {
    "selectableMask": 1,
    "nameEn": "Dead Rogue",
    "nameZh": "死掉的蘿格",
    "token": "Z2",
    "xOffset": 0,
    "yOffset": 0
  },
  "56": {
    "selectableMask": 1,
    "nameEn": "Dead Rogue",
    "nameZh": "死掉的蘿格",
    "token": "Z5",
    "xOffset": 0,
    "yOffset": 0
  },
  "57": {
    "selectableMask": 1,
    "nameEn": "Dead Rogue",
    "nameZh": "死掉的蘿格",
    "token": "Z3",
    "xOffset": 0,
    "yOffset": 0
  },
  "58": {
    "selectableMask": 1,
    "nameEn": "Dead Rogue",
    "nameZh": "死掉的蘿格",
    "token": "Z4",
    "xOffset": 0,
    "yOffset": 0
  },
  "59": {
    "selectableMask": 7,
    "nameEn": "Portal to",
    "nameZh": "傳送到",
    "token": "TP",
    "xOffset": 0,
    "yOffset": 0
  },
  "60": {
    "selectableMask": 7,
    "nameEn": "Portal to",
    "nameZh": "傳送到",
    "token": "PP",
    "xOffset": 0,
    "yOffset": 0
  },
  "61": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "62": {
    "selectableMask": 245,
    "nameEn": "Closed Door",
    "nameZh": "關閉的門",
    "isDoor": true,
    "token": "D9",
    "xOffset": 1,
    "yOffset": 1
  },
  "63": {
    "selectableMask": 245,
    "nameEn": "Closed Door",
    "nameZh": "關閉的門",
    "isDoor": true,
    "token": "DA",
    "xOffset": 1,
    "yOffset": 1
  },
  "64": {
    "selectableMask": 245,
    "nameEn": "Closed Door",
    "nameZh": "關閉的門",
    "isDoor": true,
    "token": "DB",
    "xOffset": -1,
    "yOffset": 4
  },
  "65": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "X1",
    "xOffset": 0,
    "yOffset": 0
  },
  "66": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "X2",
    "xOffset": 0,
    "yOffset": 0
  },
  "67": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "1R",
    "xOffset": 0,
    "yOffset": 0
  },
  "68": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "2R",
    "xOffset": 0,
    "yOffset": 0
  },
  "69": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "3R",
    "xOffset": 0,
    "yOffset": 0
  },
  "70": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "4R",
    "xOffset": 0,
    "yOffset": 0
  },
  "71": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "F1",
    "xOffset": 0,
    "yOffset": 0
  },
  "72": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "F2",
    "xOffset": 0,
    "yOffset": 0
  },
  "73": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "YD",
    "xOffset": 0,
    "yOffset": 0
  },
  "74": {
    "selectableMask": 5,
    "nameEn": "Trap Door",
    "nameZh": "陷阱門",
    "token": "TD",
    "xOffset": 0,
    "yOffset": 0
  },
  "75": {
    "selectableMask": 245,
    "nameEn": "Closed Door",
    "nameZh": "關閉的門",
    "isDoor": true,
    "token": "DD",
    "xOffset": 0,
    "yOffset": 0
  },
  "76": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SZ",
    "xOffset": 0,
    "yOffset": 0
  },
  "77": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 1,
    "token": "SH",
    "xOffset": 0,
    "yOffset": 0
  },
  "78": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "TA",
    "xOffset": 0,
    "yOffset": 0
  },
  "79": {
    "selectableMask": 1,
    "nameEn": "Casket",
    "nameZh": "棺材",
    "token": "C3",
    "xOffset": 0,
    "yOffset": -4
  },
  "80": {
    "selectableMask": 1,
    "nameEn": "Obelisk",
    "nameZh": "方尖石碑",
    "token": "OB",
    "xOffset": 0,
    "yOffset": 0
  },
  "81": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "AF",
    "xOffset": 0,
    "yOffset": 0
  },
  "82": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "B2",
    "xOffset": 0,
    "yOffset": 0
  },
  "83": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "HS",
    "xOffset": -20,
    "yOffset": 0
  },
  "84": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 1,
    "token": "HW",
    "xOffset": 0,
    "yOffset": 0
  },
  "85": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 1,
    "token": "BC",
    "xOffset": 0,
    "yOffset": 0
  },
  "86": {
    "selectableMask": 3,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SG",
    "xOffset": 0,
    "yOffset": 0
  },
  "87": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "CA",
    "xOffset": 0,
    "yOffset": 0
  },
  "88": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "CB",
    "xOffset": 0,
    "yOffset": 0
  },
  "89": {
    "selectableMask": 1,
    "nameEn": "Sarcophagus",
    "nameZh": "石棺",
    "token": "MC",
    "xOffset": 0,
    "yOffset": 0
  },
  "90": {
    "selectableMask": 1,
    "nameEn": "Obelisk",
    "nameZh": "方尖石碑",
    "token": "DO",
    "xOffset": 0,
    "yOffset": 0
  },
  "91": {
    "selectableMask": 245,
    "nameEn": "Closed Door",
    "nameZh": "關閉的門",
    "isDoor": true,
    "token": "TL",
    "xOffset": -11,
    "yOffset": -8
  },
  "92": {
    "selectableMask": 245,
    "nameEn": "Closed Door",
    "nameZh": "關閉的門",
    "isDoor": true,
    "token": "TR",
    "xOffset": 18,
    "yOffset": 2
  },
  "93": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 2,
    "token": "IZ",
    "xOffset": 0,
    "yOffset": 0
  },
  "94": {
    "selectableMask": 1,
    "nameEn": "Large Urn",
    "nameZh": "大罈子",
    "token": "U4",
    "xOffset": 0,
    "yOffset": 0
  },
  "95": {
    "selectableMask": 1,
    "nameEn": "Large Urn",
    "nameZh": "大罈子",
    "token": "U5",
    "xOffset": 0,
    "yOffset": 0
  },
  "96": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 1,
    "token": "IY",
    "xOffset": 0,
    "yOffset": 0
  },
  "97": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "IX",
    "xOffset": 0,
    "yOffset": 0
  },
  "98": {
    "selectableMask": 245,
    "nameEn": "Closed Door",
    "nameZh": "關閉的門",
    "isDoor": true,
    "token": "TS",
    "xOffset": 0,
    "yOffset": 0
  },
  "99": {
    "selectableMask": 245,
    "nameEn": "Closed Door",
    "nameZh": "關閉的門",
    "isDoor": true,
    "token": "TU",
    "xOffset": 0,
    "yOffset": 0
  },
  "100": {
    "selectableMask": 15,
    "nameEn": "Tal Rasha's Chamber",
    "nameZh": "都瑞爾的房間",
    "token": "SJ",
    "xOffset": -14,
    "yOffset": -38
  },
  "101": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "B3",
    "xOffset": 0,
    "yOffset": 0
  },
  "102": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "FB",
    "xOffset": 0,
    "yOffset": 0
  },
  "103": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "FL",
    "xOffset": 0,
    "yOffset": 0
  },
  "104": {
    "selectableMask": 1,
    "nameEn": "Armor Stand",
    "nameZh": "裝甲架",
    "token": "A3",
    "xOffset": 0,
    "yOffset": 0
  },
  "105": {
    "selectableMask": 1,
    "nameEn": "Armor Stand",
    "nameZh": "裝甲架",
    "token": "A4",
    "xOffset": 0,
    "yOffset": 0
  },
  "106": {
    "selectableMask": 1,
    "nameEn": "Weapon Rack",
    "nameZh": "武器架",
    "token": "W1",
    "xOffset": 0,
    "yOffset": 0
  },
  "107": {
    "selectableMask": 1,
    "nameEn": "Weapon Rack",
    "nameZh": "武器架",
    "token": "W2",
    "xOffset": 0,
    "yOffset": 0
  },
  "108": {
    "selectableMask": 1,
    "nameEn": "Horadric Malus",
    "nameZh": "赫拉迪克.馬勒斯",
    "token": "HM",
    "xOffset": 0,
    "yOffset": 0
  },
  "109": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 1,
    "token": "P2",
    "xOffset": 0,
    "yOffset": 0
  },
  "110": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "N5",
    "xOffset": -35,
    "yOffset": -10
  },
  "111": {
    "selectableMask": 3,
    "nameEn": "Well",
    "nameZh": "井",
    "token": "F3",
    "xOffset": 0,
    "yOffset": 0
  },
  "112": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "N6",
    "xOffset": 0,
    "yOffset": 10
  },
  "113": {
    "selectableMask": 3,
    "nameEn": "Well",
    "nameZh": "井",
    "token": "F4",
    "xOffset": 0,
    "yOffset": 0
  },
  "114": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "N7",
    "xOffset": -5,
    "yOffset": -5
  },
  "115": {
    "selectableMask": 3,
    "nameEn": "Well",
    "nameZh": "井",
    "token": "F5",
    "xOffset": 0,
    "yOffset": 0
  },
  "116": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "SN",
    "xOffset": 0,
    "yOffset": 0
  },
  "117": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "JT",
    "xOffset": 0,
    "yOffset": 0
  },
  "118": {
    "selectableMask": 3,
    "nameEn": "Well",
    "nameZh": "井",
    "token": "F6",
    "xOffset": 0,
    "yOffset": 0
  },
  "119": {
    "selectableMask": 5,
    "nameEn": "Waypoint",
    "nameZh": "傳送點",
    "token": "WP",
    "xOffset": 0,
    "yOffset": 0
  },
  "120": {
    "selectableMask": 1,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "DJ",
    "xOffset": 0,
    "yOffset": 0
  },
  "121": {
    "selectableMask": 0,
    "nameEn": "Jerhyn",
    "nameZh": "杰海因",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "122": {
    "selectableMask": 0,
    "nameEn": "Jerhyn",
    "nameZh": "杰海因",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "123": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "IW",
    "xOffset": 0,
    "yOffset": 0
  },
  "124": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "IV",
    "xOffset": 0,
    "yOffset": 0
  },
  "125": {
    "selectableMask": 1,
    "nameEn": "Hidden Stash",
    "nameZh": "隱藏的儲物箱",
    "token": "IU",
    "xOffset": 0,
    "yOffset": 0
  },
  "126": {
    "selectableMask": 1,
    "nameEn": "Skull Pile",
    "nameZh": "骷髏堆",
    "token": "IS",
    "xOffset": 0,
    "yOffset": 0
  },
  "127": {
    "selectableMask": 1,
    "nameEn": "Hidden Stash",
    "nameZh": "隱藏的儲物箱",
    "token": "IR",
    "xOffset": 0,
    "yOffset": 0
  },
  "128": {
    "selectableMask": 1,
    "nameEn": "Hidden Stash",
    "nameZh": "隱藏的儲物箱",
    "token": "HG",
    "xOffset": 0,
    "yOffset": 0
  },
  "129": {
    "selectableMask": 1,
    "nameEn": "Closed Door",
    "nameZh": "關閉的門",
    "token": "H2",
    "xOffset": 0,
    "yOffset": 0
  },
  "130": {
    "selectableMask": 3,
    "nameEn": "Well",
    "nameZh": "井",
    "token": "ZW",
    "xOffset": 0,
    "yOffset": 0
  },
  "131": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "9B",
    "xOffset": 0,
    "yOffset": 0
  },
  "132": {
    "selectableMask": 3,
    "nameEn": "Well",
    "nameZh": "井",
    "token": "ZC",
    "xOffset": 0,
    "yOffset": 0
  },
  "133": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "XX",
    "xOffset": 0,
    "yOffset": 0
  },
  "134": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "ZS",
    "xOffset": 0,
    "yOffset": 0
  },
  "135": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "ZR",
    "xOffset": 0,
    "yOffset": 0
  },
  "136": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "ZD",
    "xOffset": 0,
    "yOffset": 0
  },
  "137": {
    "selectableMask": 3,
    "nameEn": "Well",
    "nameZh": "井",
    "token": "ZL",
    "xOffset": 0,
    "yOffset": 0
  },
  "138": {
    "selectableMask": 3,
    "nameEn": "Well",
    "nameZh": "井",
    "token": "ZY",
    "xOffset": 0,
    "yOffset": 0
  },
  "139": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "Q1",
    "xOffset": 0,
    "yOffset": 0
  },
  "140": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "Q2",
    "xOffset": 0,
    "yOffset": 0
  },
  "141": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "Q3",
    "xOffset": 0,
    "yOffset": 0
  },
  "142": {
    "selectableMask": 1,
    "nameEn": "Jug",
    "nameZh": "水罐",
    "token": "Q4",
    "xOffset": 0,
    "yOffset": 0
  },
  "143": {
    "selectableMask": 1,
    "nameEn": "Jug",
    "nameZh": "水罐",
    "token": "Q5",
    "xOffset": 0,
    "yOffset": 0
  },
  "144": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "Q6",
    "xOffset": 0,
    "yOffset": 0
  },
  "145": {
    "selectableMask": 5,
    "nameEn": "Waypoint",
    "nameZh": "傳送點",
    "token": "WI",
    "xOffset": 0,
    "yOffset": 0
  },
  "146": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "Q9",
    "xOffset": 0,
    "yOffset": 0
  },
  "147": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "Q7",
    "xOffset": 0,
    "yOffset": 0
  },
  "148": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "Q8",
    "xOffset": 0,
    "yOffset": 0
  },
  "149": {
    "selectableMask": 1,
    "nameEn": "Tainted Sun Altar",
    "nameZh": "墮落的太陽神壇",
    "token": "ZA",
    "xOffset": 0,
    "yOffset": 0
  },
  "150": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "ZV",
    "xOffset": 0,
    "yOffset": 0
  },
  "151": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "ZE",
    "xOffset": 0,
    "yOffset": 0
  },
  "152": {
    "selectableMask": 7,
    "nameEn": "orifice",
    "nameZh": "開口",
    "token": "HA",
    "xOffset": 0,
    "yOffset": 0
  },
  "153": {
    "selectableMask": 0,
    "nameEn": "Closed Door",
    "nameZh": "關閉的門",
    "token": "DX",
    "xOffset": -8,
    "yOffset": -18
  },
  "154": {
    "selectableMask": 1,
    "nameEn": "Corpse",
    "nameZh": "屍體",
    "token": "GC",
    "xOffset": 0,
    "yOffset": 0
  },
  "155": {
    "selectableMask": 1,
    "nameEn": "Hidden Stash",
    "nameZh": "隱藏的儲物箱",
    "token": "C7",
    "xOffset": 0,
    "yOffset": 0
  },
  "156": {
    "selectableMask": 5,
    "nameEn": "Waypoint",
    "nameZh": "傳送點",
    "token": "WM",
    "xOffset": 0,
    "yOffset": 0
  },
  "157": {
    "selectableMask": 5,
    "nameEn": "Waypoint",
    "nameZh": "傳送點",
    "token": "WN",
    "xOffset": 0,
    "yOffset": 0
  },
  "158": {
    "selectableMask": 1,
    "nameEn": "Skeleton",
    "nameZh": "骷髏",
    "token": "CP",
    "xOffset": 0,
    "yOffset": 0
  },
  "159": {
    "selectableMask": 1,
    "nameEn": "Hidden Stash",
    "nameZh": "隱藏的儲物箱",
    "token": "CQ",
    "xOffset": 0,
    "yOffset": 0
  },
  "160": {
    "selectableMask": 0,
    "nameEn": "Fire",
    "nameZh": "火焰",
    "token": "FX",
    "xOffset": 0,
    "yOffset": 0
  },
  "161": {
    "selectableMask": 0,
    "nameEn": "Fire",
    "nameZh": "火焰",
    "token": "FY",
    "xOffset": 0,
    "yOffset": 0
  },
  "162": {
    "selectableMask": 0,
    "nameEn": "Fire",
    "nameZh": "火焰",
    "token": "FZ",
    "xOffset": 0,
    "yOffset": 0
  },
  "163": {
    "selectableMask": 1,
    "nameEn": "Hiding Spot",
    "nameZh": "隱藏的地點",
    "token": "CF",
    "xOffset": 0,
    "yOffset": 0
  },
  "164": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 2,
    "token": "MB",
    "xOffset": 0,
    "yOffset": 0
  },
  "165": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 2,
    "token": "MD",
    "xOffset": 0,
    "yOffset": 0
  },
  "166": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 2,
    "token": "MF",
    "xOffset": 0,
    "yOffset": 0
  },
  "167": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 2,
    "token": "MH",
    "xOffset": 0,
    "yOffset": 0
  },
  "168": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 2,
    "token": "MJ",
    "xOffset": 0,
    "yOffset": 0
  },
  "169": {
    "selectableMask": 1,
    "nameEn": "Hollow Log",
    "nameZh": "中空的木頭",
    "token": "CZ",
    "xOffset": 0,
    "yOffset": 0
  },
  "170": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 1,
    "token": "JH",
    "xOffset": 0,
    "yOffset": 0
  },
  "171": {
    "selectableMask": 1,
    "nameEn": "Skeleton",
    "nameZh": "骷髏",
    "token": "SX",
    "xOffset": 0,
    "yOffset": 0
  },
  "172": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 1,
    "token": "MK",
    "xOffset": 0,
    "yOffset": 0
  },
  "173": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 2,
    "token": "MI",
    "xOffset": 0,
    "yOffset": 0
  },
  "174": {
    "selectableMask": 1,
    "nameEn": "Loose Rock",
    "nameZh": "鬆動的石塊",
    "token": "RY",
    "xOffset": 0,
    "yOffset": 0
  },
  "175": {
    "selectableMask": 1,
    "nameEn": "Loose Boulder",
    "nameZh": "鬆動的圓石",
    "token": "RZ",
    "xOffset": 0,
    "yOffset": 0
  },
  "176": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "C8",
    "xOffset": 0,
    "yOffset": 0
  },
  "177": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "C9",
    "xOffset": 0,
    "yOffset": 0
  },
  "178": {
    "selectableMask": 1,
    "nameEn": "Guard Corpse",
    "nameZh": "警衛的死屍",
    "token": "GS",
    "xOffset": 0,
    "yOffset": 0
  },
  "179": {
    "selectableMask": 1,
    "nameEn": "Bookshelf",
    "nameZh": "書架",
    "token": "B4",
    "xOffset": 0,
    "yOffset": 0
  },
  "180": {
    "selectableMask": 1,
    "nameEn": "Bookshelf",
    "nameZh": "書架",
    "token": "B5",
    "xOffset": 0,
    "yOffset": 0
  },
  "181": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "JC",
    "xOffset": 0,
    "yOffset": 0
  },
  "182": {
    "selectableMask": 1,
    "nameEn": "Coffin",
    "nameZh": "棺木",
    "token": "TM",
    "xOffset": 0,
    "yOffset": 0
  },
  "183": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "JZ",
    "xOffset": 0,
    "yOffset": 0
  },
  "184": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "JY",
    "xOffset": 0,
    "yOffset": 0
  },
  "185": {
    "selectableMask": 1,
    "nameEn": "Stash",
    "nameZh": "儲藏箱",
    "token": "JX",
    "xOffset": 0,
    "yOffset": 0
  },
  "186": {
    "selectableMask": 1,
    "nameEn": "Stash",
    "nameZh": "儲藏箱",
    "token": "JW",
    "xOffset": 0,
    "yOffset": 0
  },
  "187": {
    "selectableMask": 1,
    "nameEn": "Stash",
    "nameZh": "儲藏箱",
    "token": "JV",
    "xOffset": 0,
    "yOffset": 0
  },
  "188": {
    "selectableMask": 1,
    "nameEn": "Stash",
    "nameZh": "儲藏箱",
    "token": "JU",
    "xOffset": 0,
    "yOffset": 0
  },
  "189": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "TP",
    "xOffset": 0,
    "yOffset": 0
  },
  "190": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "JS",
    "xOffset": 0,
    "yOffset": 0
  },
  "191": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "JR",
    "xOffset": 0,
    "yOffset": 0
  },
  "192": {
    "selectableMask": 1,
    "nameEn": "Teleport Pad",
    "nameZh": "傳送台",
    "token": "7H",
    "xOffset": 0,
    "yOffset": 0
  },
  "193": {
    "selectableMask": 1,
    "nameEn": "Lam Esen's Tome",
    "nameZh": "藍.依森之書",
    "token": "AB",
    "xOffset": 0,
    "yOffset": 0
  },
  "194": {
    "selectableMask": 5,
    "nameEn": "Stair",
    "nameZh": "樓梯",
    "token": "SL",
    "xOffset": 0,
    "yOffset": 0
  },
  "195": {
    "selectableMask": 5,
    "nameEn": "Stair",
    "nameZh": "樓梯",
    "token": "SV",
    "xOffset": 0,
    "yOffset": 0
  },
  "196": {
    "selectableMask": 0,
    "nameEn": "a Trap",
    "nameZh": "陷阱",
    "token": "A5",
    "xOffset": 2,
    "yOffset": -18
  },
  "197": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "JQ",
    "xOffset": 0,
    "yOffset": 0
  },
  "198": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "C0",
    "xOffset": 0,
    "yOffset": 0
  },
  "199": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "MZ",
    "xOffset": 0,
    "yOffset": 0
  },
  "200": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "MY",
    "xOffset": 0,
    "yOffset": 0
  },
  "201": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "MX",
    "xOffset": 0,
    "yOffset": 0
  },
  "202": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 2,
    "token": "MW",
    "xOffset": 0,
    "yOffset": 0
  },
  "203": {
    "selectableMask": 1,
    "nameEn": "Stash",
    "nameZh": "儲藏箱",
    "token": "MV",
    "xOffset": 0,
    "yOffset": 0
  },
  "204": {
    "selectableMask": 1,
    "nameEn": "Stash",
    "nameZh": "儲藏箱",
    "token": "MU",
    "xOffset": 0,
    "yOffset": 0
  },
  "205": {
    "selectableMask": 1,
    "nameEn": "Stash",
    "nameZh": "儲藏箱",
    "token": "MT",
    "xOffset": 0,
    "yOffset": 0
  },
  "206": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 1,
    "token": "MR",
    "xOffset": 0,
    "yOffset": 0
  },
  "207": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "RW",
    "xOffset": 0,
    "yOffset": 0
  },
  "208": {
    "selectableMask": 1,
    "nameEn": "Basket",
    "nameZh": "籃子",
    "token": "BD",
    "xOffset": 0,
    "yOffset": 0
  },
  "209": {
    "selectableMask": 1,
    "nameEn": "Basket",
    "nameZh": "籃子",
    "token": "BJ",
    "xOffset": 0,
    "yOffset": 0
  },
  "210": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "LW",
    "xOffset": 0,
    "yOffset": 0
  },
  "211": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "WB",
    "xOffset": 0,
    "yOffset": 0
  },
  "212": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "YB",
    "xOffset": 0,
    "yOffset": 0
  },
  "213": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "WD",
    "xOffset": 0,
    "yOffset": 0
  },
  "214": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "WC",
    "xOffset": 0,
    "yOffset": 0
  },
  "215": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "WE",
    "xOffset": 0,
    "yOffset": 0
  },
  "216": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "WY",
    "xOffset": 0,
    "yOffset": 0
  },
  "217": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "LX",
    "xOffset": 0,
    "yOffset": 0
  },
  "218": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "W3",
    "xOffset": 0,
    "yOffset": 0
  },
  "219": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "W4",
    "xOffset": 0,
    "yOffset": 0
  },
  "220": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "W5",
    "xOffset": 0,
    "yOffset": 0
  },
  "221": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "W6",
    "xOffset": 0,
    "yOffset": 0
  },
  "222": {
    "selectableMask": 1,
    "nameEn": "Pillar",
    "nameZh": "柱子",
    "token": "70",
    "xOffset": 0,
    "yOffset": 0
  },
  "223": {
    "selectableMask": 1,
    "nameEn": "Cocoon",
    "nameZh": "繭",
    "token": "CN",
    "xOffset": 0,
    "yOffset": 0
  },
  "224": {
    "selectableMask": 1,
    "nameEn": "Cocoon",
    "nameZh": "繭",
    "token": "CC",
    "xOffset": 0,
    "yOffset": 0
  },
  "225": {
    "selectableMask": 1,
    "nameEn": "Skullpile",
    "nameZh": "骷髏堆",
    "token": "IB",
    "xOffset": 0,
    "yOffset": 0
  },
  "226": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "IA",
    "xOffset": 0,
    "yOffset": 0
  },
  "227": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "QX",
    "xOffset": 0,
    "yOffset": 0
  },
  "228": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "QW",
    "xOffset": 0,
    "yOffset": 0
  },
  "229": {
    "selectableMask": 3,
    "nameEn": "Door",
    "nameZh": "門",
    "isDoor": true,
    "token": "SQ",
    "xOffset": 20,
    "yOffset": 5
  },
  "230": {
    "selectableMask": 3,
    "nameEn": "Door",
    "nameZh": "門",
    "isDoor": true,
    "token": "SY",
    "xOffset": -23,
    "yOffset": 3
  },
  "231": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "HT",
    "xOffset": 0,
    "yOffset": 0
  },
  "232": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "HQ",
    "xOffset": 0,
    "yOffset": 0
  },
  "233": {
    "selectableMask": 1,
    "nameEn": "Pillar",
    "nameZh": "柱子",
    "token": "HV",
    "xOffset": 0,
    "yOffset": 0
  },
  "234": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "QY",
    "xOffset": 0,
    "yOffset": 0
  },
  "235": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "QZ",
    "xOffset": 0,
    "yOffset": 0
  },
  "236": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 1,
    "token": "HO",
    "xOffset": 0,
    "yOffset": 0
  },
  "237": {
    "selectableMask": 5,
    "nameEn": "Waypoint",
    "nameZh": "傳送點",
    "token": "WZ",
    "xOffset": 0,
    "yOffset": 0
  },
  "238": {
    "selectableMask": 5,
    "nameEn": "Waypoint",
    "nameZh": "傳送點",
    "token": "WV",
    "xOffset": 0,
    "yOffset": 0
  },
  "239": {
    "selectableMask": 1,
    "nameEn": "Body",
    "nameZh": "屍體",
    "token": "BZ",
    "xOffset": 0,
    "yOffset": 0
  },
  "240": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "CY",
    "xOffset": 0,
    "yOffset": 0
  },
  "241": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "CX",
    "xOffset": 0,
    "yOffset": 0
  },
  "242": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "CU",
    "xOffset": 0,
    "yOffset": 0
  },
  "243": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "CD",
    "xOffset": 0,
    "yOffset": 0
  },
  "244": {
    "selectableMask": 1,
    "nameEn": "Rat's Nest",
    "nameZh": "老鼠窩",
    "token": "RN",
    "xOffset": 0,
    "yOffset": 0
  },
  "245": {
    "selectableMask": 0,
    "nameEn": "Body",
    "nameZh": "屍體",
    "token": "BY",
    "xOffset": 0,
    "yOffset": 0
  },
  "246": {
    "selectableMask": 1,
    "nameEn": "Rat's Nest",
    "nameZh": "老鼠窩",
    "token": "RA",
    "xOffset": 0,
    "yOffset": 0
  },
  "247": {
    "selectableMask": 1,
    "nameEn": "Bed",
    "nameZh": "床",
    "token": "QA",
    "xOffset": 0,
    "yOffset": 0
  },
  "248": {
    "selectableMask": 1,
    "nameEn": "Bed",
    "nameZh": "床",
    "token": "QB",
    "xOffset": 0,
    "yOffset": 0
  },
  "249": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 2,
    "token": "HN",
    "xOffset": 0,
    "yOffset": 0
  },
  "250": {
    "selectableMask": 1,
    "nameEn": "a Trap",
    "nameZh": "陷阱",
    "token": "EW",
    "xOffset": 0,
    "yOffset": 0
  },
  "251": {
    "selectableMask": 0,
    "nameEn": "Gidbinn Altar",
    "nameZh": "吉得賓祭壇",
    "token": "GA",
    "xOffset": 0,
    "yOffset": 0
  },
  "252": {
    "selectableMask": 1,
    "nameEn": "Gidbinn",
    "nameZh": "吉得賓",
    "token": "GD",
    "xOffset": 0,
    "yOffset": 0
  },
  "253": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "11",
    "xOffset": 0,
    "yOffset": 0
  },
  "254": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "12",
    "xOffset": 0,
    "yOffset": 0
  },
  "255": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "256": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "S9",
    "xOffset": 0,
    "yOffset": 0
  },
  "257": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "WG",
    "xOffset": 0,
    "yOffset": 0
  },
  "258": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "WH",
    "xOffset": 0,
    "yOffset": 0
  },
  "259": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "QS",
    "xOffset": 0,
    "yOffset": 0
  },
  "260": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "HL",
    "xOffset": 0,
    "yOffset": 0
  },
  "261": {
    "selectableMask": 0,
    "nameEn": "a Trap",
    "nameZh": "陷阱",
    "token": "A7",
    "xOffset": 5,
    "yOffset": -15
  },
  "262": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "S0",
    "xOffset": 0,
    "yOffset": 0
  },
  "263": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "JB",
    "xOffset": 0,
    "yOffset": 0
  },
  "264": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 1,
    "token": "JD",
    "xOffset": 0,
    "yOffset": 0
  },
  "265": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 2,
    "token": "JF",
    "xOffset": 0,
    "yOffset": 0
  },
  "266": {
    "selectableMask": 1,
    "nameEn": "Goo Pile",
    "nameZh": "黏液堆",
    "token": "GP",
    "xOffset": 0,
    "yOffset": 0
  },
  "267": {
    "selectableMask": 1,
    "nameEn": "Your Private Stash",
    "nameZh": "你的私人儲藏箱",
    "token": "B6",
    "xOffset": 0,
    "yOffset": 0
  },
  "268": {
    "selectableMask": 1,
    "nameEn": "Wirt's body",
    "nameZh": "維特的屍體",
    "token": "BP",
    "xOffset": 0,
    "yOffset": 0
  },
  "269": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "1G",
    "xOffset": 0,
    "yOffset": 0
  },
  "270": {
    "selectableMask": 1,
    "nameEn": "Corpse",
    "nameZh": "屍體",
    "token": "GF",
    "xOffset": 0,
    "yOffset": 0
  },
  "271": {
    "selectableMask": 1,
    "nameEn": "Corpse",
    "nameZh": "屍體",
    "token": "DG",
    "xOffset": 0,
    "yOffset": 0
  },
  "272": {
    "selectableMask": 1,
    "nameEn": "Corpse",
    "nameZh": "屍體",
    "token": "DF",
    "xOffset": 0,
    "yOffset": 0
  },
  "273": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "F8",
    "xOffset": 0,
    "yOffset": 0
  },
  "274": {
    "selectableMask": 1,
    "nameEn": "Hidden Stash",
    "nameZh": "隱藏的儲物箱",
    "token": "F9",
    "xOffset": 0,
    "yOffset": 0
  },
  "275": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 1,
    "token": "CE",
    "xOffset": 0,
    "yOffset": 0
  },
  "276": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 2,
    "token": "CG",
    "xOffset": 0,
    "yOffset": 0
  },
  "277": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "CG",
    "xOffset": 0,
    "yOffset": 0
  },
  "278": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 2,
    "token": "DE",
    "xOffset": 0,
    "yOffset": 0
  },
  "279": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "WJ",
    "xOffset": 0,
    "yOffset": 0
  },
  "280": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 1,
    "token": "WK",
    "xOffset": 0,
    "yOffset": 0
  },
  "281": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 2,
    "token": "WL",
    "xOffset": 0,
    "yOffset": 0
  },
  "282": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "WS",
    "xOffset": 0,
    "yOffset": 0
  },
  "283": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "BI",
    "xOffset": 0,
    "yOffset": 0
  },
  "284": {
    "selectableMask": 1,
    "nameEn": "Sarcophagus",
    "nameZh": "石棺",
    "token": "QC",
    "xOffset": 0,
    "yOffset": 0
  },
  "285": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "BM",
    "xOffset": 0,
    "yOffset": 0
  },
  "286": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "BO",
    "xOffset": 0,
    "yOffset": 0
  },
  "287": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "BQ",
    "xOffset": 0,
    "yOffset": 0
  },
  "288": {
    "selectableMask": 5,
    "nameEn": "Waypoint",
    "nameZh": "傳送點",
    "token": "W7",
    "xOffset": 0,
    "yOffset": 0
  },
  "289": {
    "selectableMask": 1,
    "nameEn": "Bed",
    "nameZh": "床",
    "token": "UB",
    "xOffset": 0,
    "yOffset": 0
  },
  "290": {
    "selectableMask": 245,
    "nameEn": "Door",
    "nameZh": "門",
    "isDoor": true,
    "token": "DV",
    "xOffset": -8,
    "yOffset": -5
  },
  "291": {
    "selectableMask": 245,
    "nameEn": "Door",
    "nameZh": "門",
    "isDoor": true,
    "token": "DN",
    "xOffset": 8,
    "yOffset": 0
  },
  "292": {
    "selectableMask": 245,
    "nameEn": "Door",
    "nameZh": "門",
    "isDoor": true,
    "token": "DP",
    "xOffset": -9,
    "yOffset": -5
  },
  "293": {
    "selectableMask": 245,
    "nameEn": "Door",
    "nameZh": "門",
    "isDoor": true,
    "token": "DT",
    "xOffset": 8,
    "yOffset": -3
  },
  "294": {
    "selectableMask": 245,
    "nameEn": "Door",
    "nameZh": "門",
    "isDoor": true,
    "token": "DK",
    "xOffset": -10,
    "yOffset": -3
  },
  "295": {
    "selectableMask": 245,
    "nameEn": "Door",
    "nameZh": "門",
    "isDoor": true,
    "token": "DL",
    "xOffset": 7,
    "yOffset": 0
  },
  "296": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "QD",
    "xOffset": 0,
    "yOffset": 0
  },
  "297": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "QE",
    "xOffset": 0,
    "yOffset": 0
  },
  "298": {
    "selectableMask": 5,
    "nameEn": "Portal to",
    "nameZh": "傳送到",
    "token": "AY",
    "xOffset": 0,
    "yOffset": 0
  },
  "299": {
    "selectableMask": 1,
    "nameEn": "Magic Shrine",
    "nameZh": "魔法神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "HB",
    "xOffset": 0,
    "yOffset": 0
  },
  "300": {
    "selectableMask": 1,
    "nameEn": "Magic Shrine",
    "nameZh": "魔法神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "HC",
    "xOffset": 0,
    "yOffset": 0
  },
  "301": {
    "selectableMask": 1,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "QF",
    "xOffset": 0,
    "yOffset": 0
  },
  "302": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 2,
    "token": "QG",
    "xOffset": 0,
    "yOffset": 0
  },
  "303": {
    "selectableMask": 1,
    "nameEn": "Magic Shrine",
    "nameZh": "魔法神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "HD",
    "xOffset": 0,
    "yOffset": 0
  },
  "304": {
    "selectableMask": 1,
    "nameEn": "Teleport Pad",
    "nameZh": "傳送台",
    "token": "7H",
    "xOffset": 0,
    "yOffset": 0
  },
  "305": {
    "selectableMask": 1,
    "nameEn": "Teleport Pad",
    "nameZh": "傳送台",
    "token": "AA",
    "xOffset": 0,
    "yOffset": 0
  },
  "306": {
    "selectableMask": 1,
    "nameEn": "Teleport Pad",
    "nameZh": "傳送台",
    "token": "AA",
    "xOffset": 0,
    "yOffset": 0
  },
  "307": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "7A",
    "xOffset": 0,
    "yOffset": 0
  },
  "308": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "7B",
    "xOffset": 0,
    "yOffset": 0
  },
  "309": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "7C",
    "xOffset": 0,
    "yOffset": 0
  },
  "310": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "7D",
    "xOffset": 0,
    "yOffset": 0
  },
  "311": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "7E",
    "xOffset": 0,
    "yOffset": 0
  },
  "312": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "7F",
    "xOffset": 0,
    "yOffset": 0
  },
  "313": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "7G",
    "xOffset": 0,
    "yOffset": 0
  },
  "314": {
    "selectableMask": 1,
    "nameEn": "Dead Guard",
    "nameZh": "死亡的警衛",
    "token": "QH",
    "xOffset": 0,
    "yOffset": 0
  },
  "315": {
    "selectableMask": 1,
    "nameEn": "Dead Guard",
    "nameZh": "死亡的警衛",
    "token": "QI",
    "xOffset": 0,
    "yOffset": 0
  },
  "316": {
    "selectableMask": 1,
    "nameEn": "Dead Guard",
    "nameZh": "死亡的警衛",
    "token": "QJ",
    "xOffset": 0,
    "yOffset": 0
  },
  "317": {
    "selectableMask": 1,
    "nameEn": "Dead Guard",
    "nameZh": "死亡的警衛",
    "token": "QK",
    "xOffset": 0,
    "yOffset": 0
  },
  "318": {
    "selectableMask": 0,
    "nameEn": "Eunuch",
    "nameZh": "去勢男子",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "319": {
    "selectableMask": 1,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "AX",
    "xOffset": 0,
    "yOffset": 0
  },
  "320": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 2,
    "token": "AU",
    "xOffset": 0,
    "yOffset": 0
  },
  "321": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "PP",
    "xOffset": 0,
    "yOffset": 0
  },
  "322": {
    "selectableMask": 3,
    "nameEn": "Well",
    "nameZh": "井",
    "token": "HU",
    "xOffset": 0,
    "yOffset": 0
  },
  "323": {
    "selectableMask": 5,
    "nameEn": "Waypoint",
    "nameZh": "傳送點",
    "token": "QM",
    "xOffset": 0,
    "yOffset": 0
  },
  "324": {
    "selectableMask": 5,
    "nameEn": "Waypoint",
    "nameZh": "傳送點",
    "token": "QL",
    "xOffset": 0,
    "yOffset": 0
  },
  "325": {
    "selectableMask": 1,
    "nameEn": "Magic Shrine",
    "nameZh": "魔法神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "QN",
    "xOffset": 0,
    "yOffset": 0
  },
  "326": {
    "selectableMask": 1,
    "nameEn": "Dead Body",
    "nameZh": "死亡屍體",
    "token": "QO",
    "xOffset": 0,
    "yOffset": 0
  },
  "327": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "V1",
    "xOffset": 0,
    "yOffset": 0
  },
  "328": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "V2",
    "xOffset": 0,
    "yOffset": 0
  },
  "329": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "XB",
    "xOffset": 0,
    "yOffset": 0
  },
  "330": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "XC",
    "xOffset": 0,
    "yOffset": 0
  },
  "331": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "XD",
    "xOffset": 0,
    "yOffset": 0
  },
  "332": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "XE",
    "xOffset": 0,
    "yOffset": 0
  },
  "333": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "XF",
    "xOffset": 0,
    "yOffset": 0
  },
  "334": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "XG",
    "xOffset": 0,
    "yOffset": 0
  },
  "335": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "XH",
    "xOffset": 0,
    "yOffset": 0
  },
  "336": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "XI",
    "xOffset": 0,
    "yOffset": 0
  },
  "337": {
    "selectableMask": 1,
    "nameEn": "",
    "nameZh": "",
    "token": "Y6",
    "xOffset": 0,
    "yOffset": 0
  },
  "338": {
    "selectableMask": 1,
    "nameEn": "",
    "nameZh": "",
    "token": "Y4",
    "xOffset": 0,
    "yOffset": 0
  },
  "339": {
    "selectableMask": 1,
    "nameEn": "",
    "nameZh": "",
    "token": "Y2",
    "xOffset": 0,
    "yOffset": 0
  },
  "340": {
    "selectableMask": 1,
    "nameEn": "",
    "nameZh": "",
    "token": "Y3",
    "xOffset": 0,
    "yOffset": 0
  },
  "341": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "XJ",
    "xOffset": -45,
    "yOffset": -20
  },
  "342": {
    "selectableMask": 4,
    "nameEn": "Portal to",
    "nameZh": "傳送到",
    "token": "1Y",
    "xOffset": 0,
    "yOffset": 0
  },
  "343": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 2,
    "token": "XL",
    "xOffset": 0,
    "yOffset": 0
  },
  "344": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 1,
    "token": "XM",
    "xOffset": 0,
    "yOffset": 0
  },
  "345": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "E3",
    "xOffset": 0,
    "yOffset": 0
  },
  "346": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "E4",
    "xOffset": 0,
    "yOffset": 0
  },
  "347": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "E5",
    "xOffset": 0,
    "yOffset": 0
  },
  "348": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "E6",
    "xOffset": 0,
    "yOffset": 0
  },
  "349": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "E7",
    "xOffset": 0,
    "yOffset": 0
  },
  "350": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "E8",
    "xOffset": 0,
    "yOffset": 0
  },
  "351": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "352": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "353": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "354": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "XK",
    "xOffset": 0,
    "yOffset": 0
  },
  "355": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "XK",
    "xOffset": 0,
    "yOffset": 0
  },
  "356": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "XK",
    "xOffset": 0,
    "yOffset": 0
  },
  "357": {
    "selectableMask": 7,
    "nameEn": "Horazon's Journal",
    "nameZh": "赫拉森的日記",
    "token": "TT",
    "xOffset": 0,
    "yOffset": 0
  },
  "358": {
    "selectableMask": 0,
    "nameEn": "Fire",
    "nameZh": "火焰",
    "token": "E1",
    "xOffset": 0,
    "yOffset": 0
  },
  "359": {
    "selectableMask": 0,
    "nameEn": "Fire",
    "nameZh": "火焰",
    "token": "E2",
    "xOffset": 0,
    "yOffset": 0
  },
  "360": {
    "selectableMask": 1,
    "nameEn": "Rock Pile",
    "nameZh": "石堆",
    "token": "XN",
    "xOffset": 0,
    "yOffset": 0
  },
  "361": {
    "selectableMask": 1,
    "nameEn": "Magic Shrine",
    "nameZh": "魔法神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "QO",
    "xOffset": 0,
    "yOffset": 0
  },
  "362": {
    "selectableMask": 1,
    "nameEn": "Basket",
    "nameZh": "籃子",
    "token": "XP",
    "xOffset": 0,
    "yOffset": 0
  },
  "363": {
    "selectableMask": 1,
    "nameEn": "Hung Skeleton",
    "nameZh": "吊掛的骷髏",
    "token": "JW",
    "xOffset": 0,
    "yOffset": 0
  },
  "364": {
    "selectableMask": 1,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "EA",
    "xOffset": 0,
    "yOffset": 0
  },
  "365": {
    "selectableMask": 1,
    "nameEn": "Casket",
    "nameZh": "棺材",
    "token": "VB",
    "xOffset": 0,
    "yOffset": 0
  },
  "366": {
    "selectableMask": 4,
    "nameEn": "Sewer Stairs",
    "nameZh": "下水道樓梯",
    "token": "VE",
    "xOffset": 0,
    "yOffset": 0
  },
  "367": {
    "selectableMask": 1,
    "nameEn": "Sewer Lever",
    "nameZh": "下水道拉柄",
    "token": "VF",
    "xOffset": 0,
    "yOffset": 0
  },
  "368": {
    "selectableMask": 0,
    "nameEn": "Dark Wanderer",
    "nameZh": "黑暗流浪者",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "369": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "370": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "VG",
    "xOffset": 0,
    "yOffset": 0
  },
  "371": {
    "selectableMask": 0,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "L1",
    "xOffset": 0,
    "yOffset": 0
  },
  "372": {
    "selectableMask": 1,
    "nameEn": "Bone Chest",
    "nameZh": "放骨箱",
    "token": "Y1",
    "xOffset": 0,
    "yOffset": 0
  },
  "373": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "QT",
    "xOffset": 0,
    "yOffset": 0
  },
  "374": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "UD",
    "xOffset": 0,
    "yOffset": 0
  },
  "375": {
    "selectableMask": 1,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "XX",
    "xOffset": 0,
    "yOffset": 0
  },
  "376": {
    "selectableMask": 5,
    "nameEn": "Hellforge",
    "nameZh": "地獄熔爐",
    "token": "UX",
    "xOffset": -10,
    "yOffset": 0
  },
  "377": {
    "selectableMask": 5,
    "nameEn": "",
    "nameZh": "",
    "token": "PP",
    "xOffset": 0,
    "yOffset": 0
  },
  "378": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "379": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "380": {
    "selectableMask": 1,
    "nameEn": "Trapped Soul",
    "nameZh": "被困的靈魂",
    "token": "UY",
    "xOffset": -3,
    "yOffset": 20
  },
  "381": {
    "selectableMask": 1,
    "nameEn": "Trapped Soul",
    "nameZh": "被困的靈魂",
    "token": "15",
    "xOffset": -3,
    "yOffset": 20
  },
  "382": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "383": {
    "selectableMask": 1,
    "nameEn": "Trapped Soul",
    "nameZh": "被困的靈魂",
    "token": "18",
    "xOffset": 0,
    "yOffset": 0
  },
  "384": {
    "selectableMask": 1,
    "nameEn": "Trapped Soul",
    "nameZh": "被困的靈魂",
    "token": "19",
    "xOffset": 0,
    "yOffset": 0
  },
  "385": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "386": {
    "selectableMask": 4,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SV",
    "xOffset": 0,
    "yOffset": 0
  },
  "387": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "Y7",
    "xOffset": 0,
    "yOffset": 0
  },
  "388": {
    "selectableMask": 1,
    "nameEn": "Casket",
    "nameZh": "棺材",
    "token": "Y8",
    "xOffset": 0,
    "yOffset": 0
  },
  "389": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "Y9",
    "xOffset": 0,
    "yOffset": 0
  },
  "390": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "YA",
    "xOffset": 0,
    "yOffset": 0
  },
  "391": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "YC",
    "xOffset": 0,
    "yOffset": 0
  },
  "392": {
    "selectableMask": 1,
    "nameEn": "Seal",
    "nameZh": "封印",
    "token": "30",
    "xOffset": 0,
    "yOffset": 0
  },
  "393": {
    "selectableMask": 1,
    "nameEn": "Seal",
    "nameZh": "封印",
    "token": "31",
    "xOffset": 0,
    "yOffset": 0
  },
  "394": {
    "selectableMask": 1,
    "nameEn": "Seal",
    "nameZh": "封印",
    "token": "32",
    "xOffset": 0,
    "yOffset": 0
  },
  "395": {
    "selectableMask": 1,
    "nameEn": "Seal",
    "nameZh": "封印",
    "token": "33",
    "xOffset": 0,
    "yOffset": 0
  },
  "396": {
    "selectableMask": 1,
    "nameEn": "Seal",
    "nameZh": "封印",
    "token": "34",
    "xOffset": 0,
    "yOffset": 0
  },
  "397": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "YF",
    "xOffset": 0,
    "yOffset": 0
  },
  "398": {
    "selectableMask": 5,
    "nameEn": "Waypoint",
    "nameZh": "傳送點",
    "token": "YG",
    "xOffset": 0,
    "yOffset": 0
  },
  "399": {
    "selectableMask": 0,
    "nameEn": "fissure",
    "nameZh": "裂縫",
    "token": "FH",
    "xOffset": 0,
    "yOffset": 0
  },
  "400": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "HE",
    "xOffset": 0,
    "yOffset": 0
  },
  "401": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "35",
    "xOffset": 0,
    "yOffset": 0
  },
  "402": {
    "selectableMask": 5,
    "nameEn": "Waypoint",
    "nameZh": "傳送點",
    "token": "YI",
    "xOffset": 0,
    "yOffset": 0
  },
  "403": {
    "selectableMask": 0,
    "nameEn": "Fire",
    "nameZh": "火焰",
    "token": "9F",
    "xOffset": 0,
    "yOffset": 0
  },
  "404": {
    "selectableMask": 1,
    "nameEn": "Compelling Orb",
    "nameZh": "強制球體",
    "token": "55",
    "xOffset": 0,
    "yOffset": 0
  },
  "405": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "XK",
    "xOffset": 0,
    "yOffset": 0
  },
  "406": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "XK",
    "xOffset": 0,
    "yOffset": 0
  },
  "407": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "XK",
    "xOffset": 0,
    "yOffset": 0
  },
  "408": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "98",
    "xOffset": 0,
    "yOffset": 0
  },
  "409": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "99",
    "xOffset": 0,
    "yOffset": 0
  },
  "410": {
    "selectableMask": 1,
    "nameEn": "Siege Control",
    "nameZh": "攻城控制",
    "token": "ZQ",
    "xOffset": 0,
    "yOffset": 0
  },
  "411": {
    "selectableMask": 0,
    "nameEn": "Torch Pit",
    "nameZh": "Torch Pit",
    "token": "PX",
    "xOffset": 0,
    "yOffset": 0
  },
  "412": {
    "selectableMask": 0,
    "nameEn": "Fire Pit",
    "nameZh": "Fire Pit",
    "token": "PY",
    "xOffset": 0,
    "yOffset": 0
  },
  "413": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "6Q",
    "xOffset": 0,
    "yOffset": 0
  },
  "414": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "6R",
    "xOffset": 0,
    "yOffset": 0
  },
  "415": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "6S",
    "xOffset": 0,
    "yOffset": 0
  },
  "416": {
    "selectableMask": 1,
    "nameEn": "Hidden Stash",
    "nameZh": "隱藏的儲物箱",
    "token": "3W",
    "xOffset": 0,
    "yOffset": 0
  },
  "417": {
    "selectableMask": 0,
    "nameEn": "Flag",
    "nameZh": "Flag",
    "token": "YM",
    "xOffset": 0,
    "yOffset": 0
  },
  "418": {
    "selectableMask": 1,
    "nameEn": "Barrel",
    "nameZh": "木桶",
    "token": "YN",
    "xOffset": 0,
    "yOffset": 0
  },
  "419": {
    "selectableMask": 1,
    "nameEn": "Barrel",
    "nameZh": "木桶",
    "token": "6T",
    "xOffset": 0,
    "yOffset": 0
  },
  "420": {
    "selectableMask": 1,
    "nameEn": "Wooden Chest",
    "nameZh": "木箱",
    "token": "YP",
    "xOffset": 0,
    "yOffset": 0
  },
  "421": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "YQ",
    "xOffset": 0,
    "yOffset": 0
  },
  "422": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 2,
    "token": "YR",
    "xOffset": 0,
    "yOffset": 0
  },
  "423": {
    "selectableMask": 1,
    "nameEn": "Health Shrine",
    "nameZh": "生命神殿",
    "isShrine": true,
    "parm0": 1,
    "token": "YS",
    "xOffset": 0,
    "yOffset": 0
  },
  "424": {
    "selectableMask": 1,
    "nameEn": "Burial Chest",
    "nameZh": "陪葬箱",
    "token": "YT",
    "xOffset": 0,
    "yOffset": 0
  },
  "425": {
    "selectableMask": 1,
    "nameEn": "Burial Chest",
    "nameZh": "陪葬箱",
    "token": "YS",
    "xOffset": 0,
    "yOffset": 0
  },
  "426": {
    "selectableMask": 3,
    "nameEn": "Well",
    "nameZh": "井",
    "token": "YV",
    "xOffset": 0,
    "yOffset": 0
  },
  "427": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "YW",
    "xOffset": 0,
    "yOffset": 0
  },
  "428": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "YX",
    "xOffset": 0,
    "yOffset": 0
  },
  "429": {
    "selectableMask": 5,
    "nameEn": "Waypoint",
    "nameZh": "傳送點",
    "token": "YY",
    "xOffset": 0,
    "yOffset": 0
  },
  "430": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "YZ",
    "xOffset": 0,
    "yOffset": 0
  },
  "431": {
    "selectableMask": 1,
    "nameEn": "Wooden Chest",
    "nameZh": "木箱",
    "token": "6A",
    "xOffset": 0,
    "yOffset": 0
  },
  "432": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "6B",
    "xOffset": 0,
    "yOffset": 0
  },
  "433": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "6C",
    "xOffset": 0,
    "yOffset": 0
  },
  "434": {
    "selectableMask": 0,
    "nameEn": "Torch",
    "nameZh": "火焰",
    "token": "6D",
    "xOffset": 0,
    "yOffset": 0
  },
  "435": {
    "selectableMask": 0,
    "nameEn": "Fire",
    "nameZh": "火焰",
    "token": "2W",
    "xOffset": 0,
    "yOffset": 0
  },
  "436": {
    "selectableMask": 0,
    "nameEn": "Torch",
    "nameZh": "火焰",
    "token": "2X",
    "xOffset": 0,
    "yOffset": 0
  },
  "437": {
    "selectableMask": 0,
    "nameEn": "Torch",
    "nameZh": "火焰",
    "token": "6E",
    "xOffset": 0,
    "yOffset": 0
  },
  "438": {
    "selectableMask": 0,
    "nameEn": "Pyre of Flesh",
    "nameZh": "Pyre of Flesh",
    "token": "6F",
    "xOffset": 0,
    "yOffset": 0
  },
  "439": {
    "selectableMask": 0,
    "nameEn": "Burning Pit",
    "nameZh": "Burning Pit",
    "token": "6G",
    "xOffset": 0,
    "yOffset": 0
  },
  "440": {
    "selectableMask": 0,
    "nameEn": "Tribal Flag",
    "nameZh": "Tribal Flag",
    "token": "6H",
    "xOffset": 0,
    "yOffset": 0
  },
  "441": {
    "selectableMask": 0,
    "nameEn": "Town Flag",
    "nameZh": "Town Flag",
    "token": "2Y",
    "xOffset": 0,
    "yOffset": 0
  },
  "442": {
    "selectableMask": 0,
    "nameEn": "Chandelier",
    "nameZh": "Chandelier",
    "token": "2Z",
    "xOffset": 0,
    "yOffset": -130
  },
  "443": {
    "selectableMask": 1,
    "nameEn": "Jar",
    "nameZh": "甕",
    "token": "6I",
    "xOffset": 0,
    "yOffset": 0
  },
  "444": {
    "selectableMask": 1,
    "nameEn": "Jar",
    "nameZh": "甕",
    "token": "6J",
    "xOffset": 0,
    "yOffset": 0
  },
  "445": {
    "selectableMask": 1,
    "nameEn": "Jar",
    "nameZh": "甕",
    "token": "6K",
    "xOffset": 0,
    "yOffset": 0
  },
  "446": {
    "selectableMask": 0,
    "nameEn": "Swinging Heads",
    "nameZh": "Swinging Heads",
    "token": "6L",
    "xOffset": 0,
    "yOffset": 0
  },
  "447": {
    "selectableMask": 0,
    "nameEn": "Pole",
    "nameZh": "Pole",
    "token": "6M",
    "xOffset": 0,
    "yOffset": 0
  },
  "448": {
    "selectableMask": 1,
    "nameEn": "Skulls and Rocks",
    "nameZh": "骷髏與石堆",
    "token": "6N",
    "xOffset": 0,
    "yOffset": 0
  },
  "449": {
    "selectableMask": 1,
    "nameEn": "Main Gate",
    "nameZh": "主門",
    "token": "2V",
    "xOffset": 0,
    "yOffset": 0
  },
  "450": {
    "selectableMask": 0,
    "nameEn": "Skulls and Rocks",
    "nameZh": "骷髏與石堆",
    "token": "6O",
    "xOffset": 0,
    "yOffset": 0
  },
  "451": {
    "selectableMask": 0,
    "nameEn": "Hell Gate",
    "nameZh": "Hell Gate",
    "token": "6P",
    "xOffset": 0,
    "yOffset": 0
  },
  "452": {
    "selectableMask": 0,
    "nameEn": "Banner",
    "nameZh": "Banner",
    "token": "AO",
    "xOffset": 0,
    "yOffset": 0
  },
  "453": {
    "selectableMask": 0,
    "nameEn": "Banner",
    "nameZh": "Banner",
    "token": "AP",
    "xOffset": 0,
    "yOffset": 0
  },
  "454": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "6T",
    "xOffset": 0,
    "yOffset": 0
  },
  "455": {
    "selectableMask": 1,
    "nameEn": "Chest",
    "nameZh": "箱子",
    "token": "6U",
    "xOffset": 0,
    "yOffset": 0
  },
  "456": {
    "selectableMask": 0,
    "nameEn": "Death Pole",
    "nameZh": "Death Pole",
    "token": "6V",
    "xOffset": 0,
    "yOffset": 0
  },
  "457": {
    "selectableMask": 0,
    "nameEn": "Death Pole",
    "nameZh": "Death Pole",
    "token": "6W",
    "xOffset": 0,
    "yOffset": 0
  },
  "458": {
    "selectableMask": 0,
    "nameEn": "Altar",
    "nameZh": "Altar",
    "token": "6X",
    "xOffset": 0,
    "yOffset": 0
  },
  "459": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "460": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "461": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "462": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "463": {
    "selectableMask": 1,
    "nameEn": "Hidden Stash",
    "nameZh": "隱藏的儲物箱",
    "token": "6Y",
    "xOffset": 0,
    "yOffset": 0
  },
  "464": {
    "selectableMask": 1,
    "nameEn": "Health Shrine",
    "nameZh": "生命神殿",
    "isShrine": true,
    "parm0": 1,
    "token": "8A",
    "xOffset": 0,
    "yOffset": 0
  },
  "465": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 2,
    "token": "8B",
    "xOffset": 0,
    "yOffset": 0
  },
  "466": {
    "selectableMask": 1,
    "nameEn": "Evil Urn",
    "nameZh": "邪惡之甕",
    "token": "8C",
    "xOffset": 0,
    "yOffset": 0
  },
  "467": {
    "selectableMask": 1,
    "nameEn": "Jar",
    "nameZh": "甕",
    "token": "8D",
    "xOffset": 0,
    "yOffset": 0
  },
  "468": {
    "selectableMask": 1,
    "nameEn": "Jar",
    "nameZh": "甕",
    "token": "8E",
    "xOffset": 0,
    "yOffset": 0
  },
  "469": {
    "selectableMask": 1,
    "nameEn": "Jar",
    "nameZh": "甕",
    "token": "8F",
    "xOffset": 0,
    "yOffset": 0
  },
  "470": {
    "selectableMask": 1,
    "nameEn": "Jar",
    "nameZh": "甕",
    "token": "8G",
    "xOffset": 0,
    "yOffset": 0
  },
  "471": {
    "selectableMask": 1,
    "nameEn": "Jar",
    "nameZh": "甕",
    "token": "8H",
    "xOffset": 0,
    "yOffset": 0
  },
  "472": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "8I",
    "xOffset": 0,
    "yOffset": 0
  },
  "473": {
    "selectableMask": 0,
    "nameEn": "Cage",
    "nameZh": "Cage",
    "token": "60",
    "xOffset": 0,
    "yOffset": 0
  },
  "474": {
    "selectableMask": 5,
    "nameEn": "Korlic the Protector",
    "nameZh": "守護者科力克",
    "token": "60",
    "xOffset": -5,
    "yOffset": -5
  },
  "475": {
    "selectableMask": 5,
    "nameEn": "Talic the Defender",
    "nameZh": "防衛者塔力克",
    "token": "61",
    "xOffset": -5,
    "yOffset": -5
  },
  "476": {
    "selectableMask": 5,
    "nameEn": "Madawc the Guardian",
    "nameZh": "守衛者馬道克",
    "token": "62",
    "xOffset": -8,
    "yOffset": -10
  },
  "477": {
    "selectableMask": 1,
    "nameEn": "Dead Barbarian",
    "nameZh": "死去的野蠻人",
    "token": "8J",
    "xOffset": 0,
    "yOffset": 0
  },
  "478": {
    "selectableMask": 0,
    "nameEn": "Smoke",
    "nameZh": "Smoke",
    "token": "OZ",
    "xOffset": 0,
    "yOffset": 0
  },
  "479": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "8K",
    "xOffset": 0,
    "yOffset": 0
  },
  "480": {
    "selectableMask": 0,
    "nameEn": "Torch",
    "nameZh": "火焰",
    "token": "8L",
    "xOffset": 0,
    "yOffset": 0
  },
  "481": {
    "selectableMask": 0,
    "nameEn": "Torch",
    "nameZh": "火焰",
    "token": "8M",
    "xOffset": 0,
    "yOffset": 0
  },
  "482": {
    "selectableMask": 0,
    "nameEn": "Torch",
    "nameZh": "火焰",
    "token": "2P",
    "xOffset": 0,
    "yOffset": 0
  },
  "483": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 2,
    "token": "8N",
    "xOffset": 0,
    "yOffset": 0
  },
  "484": {
    "selectableMask": 1,
    "nameEn": "Health Shrine",
    "nameZh": "生命神殿",
    "isShrine": true,
    "parm0": 1,
    "token": "8O",
    "xOffset": 0,
    "yOffset": 0
  },
  "485": {
    "selectableMask": 1,
    "nameEn": "Tomb",
    "nameZh": "古墓",
    "token": "8P",
    "xOffset": 0,
    "yOffset": 0
  },
  "486": {
    "selectableMask": 1,
    "nameEn": "Tomb",
    "nameZh": "古墓",
    "token": "8Q",
    "xOffset": 0,
    "yOffset": 0
  },
  "487": {
    "selectableMask": 1,
    "nameEn": "Tomb",
    "nameZh": "古墓",
    "token": "8R",
    "xOffset": 0,
    "yOffset": 0
  },
  "488": {
    "selectableMask": 1,
    "nameEn": "Magic Shrine",
    "nameZh": "魔法神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "8S",
    "xOffset": 0,
    "yOffset": 0
  },
  "489": {
    "selectableMask": 0,
    "nameEn": "Torch",
    "nameZh": "火焰",
    "token": "8T",
    "xOffset": 0,
    "yOffset": 0
  },
  "490": {
    "selectableMask": 0,
    "nameEn": "Torch",
    "nameZh": "火焰",
    "token": "8U",
    "xOffset": 0,
    "yOffset": 0
  },
  "491": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 2,
    "token": "8V",
    "xOffset": 0,
    "yOffset": 0
  },
  "492": {
    "selectableMask": 1,
    "nameEn": "Health Shrine",
    "nameZh": "生命神殿",
    "isShrine": true,
    "parm0": 1,
    "token": "8W",
    "xOffset": 0,
    "yOffset": 0
  },
  "493": {
    "selectableMask": 3,
    "nameEn": "Well",
    "nameZh": "井",
    "token": "8X",
    "xOffset": 0,
    "yOffset": 0
  },
  "494": {
    "selectableMask": 5,
    "nameEn": "Waypoint",
    "nameZh": "傳送點",
    "token": "8Y",
    "xOffset": 0,
    "yOffset": 0
  },
  "495": {
    "selectableMask": 1,
    "nameEn": "Magic Shrine",
    "nameZh": "魔法神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "8Z",
    "xOffset": 0,
    "yOffset": 0
  },
  "496": {
    "selectableMask": 5,
    "nameEn": "Waypoint",
    "nameZh": "傳送點",
    "token": "5A",
    "xOffset": 0,
    "yOffset": 0
  },
  "497": {
    "selectableMask": 1,
    "nameEn": "Magic Shrine",
    "nameZh": "魔法神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "5B",
    "xOffset": 0,
    "yOffset": 0
  },
  "498": {
    "selectableMask": 3,
    "nameEn": "Well",
    "nameZh": "井",
    "token": "5C",
    "xOffset": 0,
    "yOffset": 0
  },
  "499": {
    "selectableMask": 1,
    "nameEn": "Magic Shrine",
    "nameZh": "魔法神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "5D",
    "xOffset": 0,
    "yOffset": 0
  },
  "500": {
    "selectableMask": 1,
    "nameEn": "Hidden Stash",
    "nameZh": "隱藏的儲物箱",
    "token": "5E",
    "xOffset": 0,
    "yOffset": 0
  },
  "501": {
    "selectableMask": 1,
    "nameEn": "Wooden Chest",
    "nameZh": "木箱",
    "token": "5F",
    "xOffset": 0,
    "yOffset": 0
  },
  "502": {
    "selectableMask": 1,
    "nameEn": "Wooden Chest",
    "nameZh": "木箱",
    "token": "5G",
    "xOffset": 0,
    "yOffset": 0
  },
  "503": {
    "selectableMask": 1,
    "nameEn": "Magic Shrine",
    "nameZh": "魔法神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "5H",
    "xOffset": 0,
    "yOffset": 0
  },
  "504": {
    "selectableMask": 1,
    "nameEn": "Wooden Chest",
    "nameZh": "木箱",
    "token": "5F",
    "xOffset": 0,
    "yOffset": 0
  },
  "505": {
    "selectableMask": 1,
    "nameEn": "Wooden Chest",
    "nameZh": "木箱",
    "token": "5F",
    "xOffset": 0,
    "yOffset": 0
  },
  "506": {
    "selectableMask": 0,
    "nameEn": "Swinging Heads",
    "nameZh": "Swinging Heads",
    "token": "5K",
    "xOffset": 0,
    "yOffset": 0
  },
  "507": {
    "selectableMask": 0,
    "nameEn": "Debris",
    "nameZh": "Debris",
    "token": "5L",
    "xOffset": 0,
    "yOffset": 0
  },
  "508": {
    "selectableMask": 1,
    "nameEn": "Stash",
    "nameZh": "儲藏箱",
    "token": "2Q",
    "xOffset": 0,
    "yOffset": 0
  },
  "509": {
    "selectableMask": 1,
    "nameEn": "Magic Shrine",
    "nameZh": "魔法神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "5H",
    "xOffset": 0,
    "yOffset": 0
  },
  "510": {
    "selectableMask": 0,
    "nameEn": "Pole",
    "nameZh": "Pole",
    "token": "5K",
    "xOffset": 0,
    "yOffset": 0
  },
  "511": {
    "selectableMask": 5,
    "nameEn": "Waypoint",
    "nameZh": "傳送點",
    "token": "5A",
    "xOffset": 0,
    "yOffset": 0
  },
  "512": {
    "selectableMask": 1,
    "nameEn": "Magic Shrine",
    "nameZh": "魔法神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "5T",
    "xOffset": 0,
    "yOffset": 0
  },
  "513": {
    "selectableMask": 3,
    "nameEn": "Well",
    "nameZh": "井",
    "token": "5Q",
    "xOffset": 0,
    "yOffset": 0
  },
  "514": {
    "selectableMask": 0,
    "nameEn": "Torch",
    "nameZh": "火焰",
    "token": "5R",
    "xOffset": 0,
    "yOffset": 0
  },
  "515": {
    "selectableMask": 0,
    "nameEn": "Torch",
    "nameZh": "火焰",
    "token": "5S",
    "xOffset": 0,
    "yOffset": 0
  },
  "516": {
    "selectableMask": 1,
    "nameEn": "Hidden Stash",
    "nameZh": "隱藏的儲物箱",
    "token": "5U",
    "xOffset": 0,
    "yOffset": 0
  },
  "517": {
    "selectableMask": 1,
    "nameEn": "Hidden Stash",
    "nameZh": "隱藏的儲物箱",
    "token": "5V",
    "xOffset": 0,
    "yOffset": 0
  },
  "518": {
    "selectableMask": 1,
    "nameEn": "Box",
    "nameZh": "箱子",
    "token": "5W",
    "xOffset": 0,
    "yOffset": 0
  },
  "519": {
    "selectableMask": 3,
    "nameEn": "Well",
    "nameZh": "井",
    "token": "5X",
    "xOffset": 0,
    "yOffset": 0
  },
  "520": {
    "selectableMask": 1,
    "nameEn": "Magic Shrine",
    "nameZh": "魔法神殿",
    "isShrine": true,
    "parm0": 3,
    "token": "5Y",
    "xOffset": 0,
    "yOffset": 0
  },
  "521": {
    "selectableMask": 1,
    "nameEn": "Health Shrine",
    "nameZh": "生命神殿",
    "isShrine": true,
    "parm0": 1,
    "token": "5Z",
    "xOffset": 0,
    "yOffset": 0
  },
  "522": {
    "selectableMask": 1,
    "nameEn": "Shrine",
    "nameZh": "神殿",
    "isShrine": true,
    "parm0": 2,
    "token": "3A",
    "xOffset": 0,
    "yOffset": 0
  },
  "523": {
    "selectableMask": 0,
    "nameEn": "Red Light",
    "nameZh": "Red Light",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "524": {
    "selectableMask": 1,
    "nameEn": "Tomb",
    "nameZh": "古墓",
    "token": "3B",
    "xOffset": 0,
    "yOffset": 0
  },
  "525": {
    "selectableMask": 1,
    "nameEn": "Tomb",
    "nameZh": "古墓",
    "token": "3C",
    "xOffset": 0,
    "yOffset": 0
  },
  "526": {
    "selectableMask": 1,
    "nameEn": "Tomb",
    "nameZh": "古墓",
    "token": "3D",
    "xOffset": 0,
    "yOffset": 0
  },
  "527": {
    "selectableMask": 0,
    "nameEn": "Shrub",
    "nameZh": "Shrub",
    "token": "2U",
    "xOffset": 0,
    "yOffset": 0
  },
  "528": {
    "selectableMask": 0,
    "nameEn": "Shrub",
    "nameZh": "Shrub",
    "token": "2S",
    "xOffset": 0,
    "yOffset": 0
  },
  "529": {
    "selectableMask": 1,
    "nameEn": "Tomb",
    "nameZh": "古墓",
    "token": "3F",
    "xOffset": 0,
    "yOffset": 0
  },
  "530": {
    "selectableMask": 1,
    "nameEn": "Tomb",
    "nameZh": "古墓",
    "token": "3G",
    "xOffset": 0,
    "yOffset": 0
  },
  "531": {
    "selectableMask": 1,
    "nameEn": "Tomb",
    "nameZh": "古墓",
    "token": "3H",
    "xOffset": 0,
    "yOffset": 0
  },
  "532": {
    "selectableMask": 1,
    "nameEn": "Tomb",
    "nameZh": "古墓",
    "token": "3I",
    "xOffset": 0,
    "yOffset": 0
  },
  "533": {
    "selectableMask": 1,
    "nameEn": "Tomb",
    "nameZh": "古墓",
    "token": "3J",
    "xOffset": 0,
    "yOffset": 0
  },
  "534": {
    "selectableMask": 1,
    "nameEn": "Tomb",
    "nameZh": "古墓",
    "token": "3K",
    "xOffset": 0,
    "yOffset": 0
  },
  "535": {
    "selectableMask": 1,
    "nameEn": "Box",
    "nameZh": "箱子",
    "token": "3L",
    "xOffset": 0,
    "yOffset": 0
  },
  "536": {
    "selectableMask": 0,
    "nameEn": "Torch",
    "nameZh": "火焰",
    "token": "3M",
    "xOffset": 0,
    "yOffset": 0
  },
  "537": {
    "selectableMask": 0,
    "nameEn": "Torch",
    "nameZh": "火焰",
    "token": "3N",
    "xOffset": 0,
    "yOffset": 0
  },
  "538": {
    "selectableMask": 0,
    "nameEn": "Candles",
    "nameZh": "Candles",
    "token": "3O",
    "xOffset": 0,
    "yOffset": 0
  },
  "539": {
    "selectableMask": 5,
    "nameEn": "Waypoint",
    "nameZh": "傳送點",
    "token": "3P",
    "xOffset": 0,
    "yOffset": 0
  },
  "540": {
    "selectableMask": 1,
    "nameEn": "Corpse",
    "nameZh": "屍體",
    "token": "3Q",
    "xOffset": 0,
    "yOffset": 0
  },
  "541": {
    "selectableMask": 1,
    "nameEn": "Tomb",
    "nameZh": "古墓",
    "token": "3S",
    "xOffset": 0,
    "yOffset": 0
  },
  "542": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "543": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "544": {
    "selectableMask": 1,
    "nameEn": "Tomb",
    "nameZh": "古墓",
    "token": "3T",
    "xOffset": 0,
    "yOffset": 0
  },
  "545": {
    "selectableMask": 1,
    "nameEn": "Corpse",
    "nameZh": "屍體",
    "token": "3U",
    "xOffset": 0,
    "yOffset": 0
  },
  "546": {
    "selectableMask": 1,
    "nameEn": "Altar of the Heavens",
    "nameZh": "天堂祭壇",
    "token": "4A",
    "xOffset": 0,
    "yOffset": 0
  },
  "547": {
    "selectableMask": 5,
    "nameEn": "To The Worldstone Keep Level 1",
    "nameZh": "前往世界之石要塞第一層",
    "token": "4B",
    "xOffset": 17,
    "yOffset": -47
  },
  "548": {
    "selectableMask": 1,
    "nameEn": "Weapon Rack",
    "nameZh": "武器架",
    "token": "3X",
    "xOffset": 0,
    "yOffset": 0
  },
  "549": {
    "selectableMask": 1,
    "nameEn": "Weapon Rack",
    "nameZh": "武器架",
    "token": "3Y",
    "xOffset": 0,
    "yOffset": 0
  },
  "550": {
    "selectableMask": 1,
    "nameEn": "Armor Stand",
    "nameZh": "裝甲架",
    "token": "3Z",
    "xOffset": 0,
    "yOffset": 0
  },
  "551": {
    "selectableMask": 1,
    "nameEn": "Armor Stand",
    "nameZh": "裝甲架",
    "token": "4C",
    "xOffset": 0,
    "yOffset": 0
  },
  "552": {
    "selectableMask": 0,
    "nameEn": "Torch",
    "nameZh": "火焰",
    "token": "9G",
    "xOffset": 0,
    "yOffset": 0
  },
  "553": {
    "selectableMask": 0,
    "nameEn": "funeralpire",
    "nameZh": "funeralpire",
    "token": "9H",
    "xOffset": 0,
    "yOffset": 0
  },
  "554": {
    "selectableMask": 0,
    "nameEn": "burninglogs",
    "nameZh": "burninglogs",
    "token": "9I",
    "xOffset": 0,
    "yOffset": 0
  },
  "555": {
    "selectableMask": 0,
    "nameEn": "stma",
    "nameZh": "stma",
    "token": "2O",
    "xOffset": 0,
    "yOffset": 0
  },
  "556": {
    "selectableMask": 1,
    "nameEn": "Corpse",
    "nameZh": "屍體",
    "token": "3V",
    "xOffset": 0,
    "yOffset": 0
  },
  "557": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "558": {
    "selectableMask": 1,
    "nameEn": "Frozen Anya",
    "nameZh": "冰凍的安亞",
    "token": "2N",
    "xOffset": 0,
    "yOffset": 0
  },
  "559": {
    "selectableMask": 0,
    "nameEn": "BBQB",
    "nameZh": "BBQB",
    "token": "29",
    "xOffset": 0,
    "yOffset": 0
  },
  "560": {
    "selectableMask": 0,
    "nameEn": "btor",
    "nameZh": "btor",
    "token": "25",
    "xOffset": 0,
    "yOffset": 0
  },
  "561": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "562": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "563": {
    "selectableMask": 6,
    "nameEn": "The Worldstone Chamber",
    "nameZh": "世界之石大殿",
    "token": "4X",
    "xOffset": 0,
    "yOffset": 0
  },
  "564": {
    "selectableMask": 7,
    "nameEn": "The Ancients' Way",
    "nameZh": "遠古之路",
    "token": "4U",
    "xOffset": -33,
    "yOffset": 0
  },
  "565": {
    "selectableMask": 6,
    "nameEn": "DESTRUCTION'S END",
    "nameZh": "毀滅之終結",
    "token": "PP",
    "xOffset": 0,
    "yOffset": 0
  },
  "566": {
    "selectableMask": 6,
    "nameEn": "Harrogath",
    "nameZh": "哈洛加斯",
    "token": "PP",
    "xOffset": 0,
    "yOffset": 0
  },
  "567": {
    "selectableMask": 0,
    "nameEn": "Zoo",
    "nameZh": "Zoo",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "568": {
    "selectableMask": 0,
    "nameEn": "Keeper",
    "nameZh": "Keeper",
    "token": "7Z",
    "xOffset": 0,
    "yOffset": 0
  },
  "569": {
    "selectableMask": 6,
    "nameEn": "Throne of Destruction",
    "nameZh": "毀滅的王座",
    "token": "4X",
    "xOffset": 0,
    "yOffset": 0
  },
  "570": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "7Y",
    "xOffset": 0,
    "yOffset": 0
  },
  "571": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  },
  "572": {
    "selectableMask": 0,
    "nameEn": "an evil force",
    "nameZh": "一股邪惡力量",
    "token": "SS",
    "xOffset": 0,
    "yOffset": 0
  }
}

const OBJECT_ANIM_OVERRIDES_113C: Readonly<Record<number, Partial<CanonicalObjectMeta>>> = {
  1: { subClass: 8, sizeX: 5, sizeY: 3, start: [0, 0, 6, 0, 0, 0, 0, 0], frameCnt: [1, 7, 1, 0, 0, 0, 0, 0], frameDelta: [0, 256, 0, 0, 0, 0, 0, 0], cycleAnim: [false, false, false, false, false, false, false, false] },
  3: { subClass: 8, sizeX: 5, sizeY: 3, start: [0, 0, 6, 0, 0, 0, 0, 0], frameCnt: [1, 7, 1, 0, 0, 0, 0, 0], frameDelta: [0, 256, 0, 0, 0, 0, 0, 0], cycleAnim: [false, false, false, false, false, false, false, false] },
  4: { subClass: 8, sizeX: 1, sizeY: 1, start: [0, 0, 8, 0, 0, 0, 0, 0], frameCnt: [1, 9, 1, 1, 1, 1, 1, 1], frameDelta: [256, 256, 256, 256, 256, 256, 256, 256], cycleAnim: [false, false, false, false, false, false, false, false] },
  5: { subClass: 8, sizeX: 1, sizeY: 2, start: [0, 1, 1, 0, 0, 0, 0, 0], frameCnt: [1, 1, 1, 1, 1, 1, 1, 1], frameDelta: [256, 256, 256, 256, 256, 256, 256, 256], cycleAnim: [false, false, false, false, false, false, false, false] },
  6: { subClass: 8, sizeX: 2, sizeY: 1, start: [0, 1, 1, 0, 0, 0, 0, 0], frameCnt: [1, 1, 1, 1, 1, 1, 1, 1], frameDelta: [256, 256, 256, 256, 256, 256, 256, 256], cycleAnim: [false, false, false, false, false, false, false, false] },
  7: { subClass: 0, sizeX: 1, sizeY: 1, start: [0, 0, 9, 0, 0, 0, 0, 0], frameCnt: [1, 10, 1, 0, 0, 0, 0, 0], frameDelta: [210, 160, 0, 256, 256, 256, 256, 256], cycleAnim: [false, false, false, false, false, false, false, false] },
  8: { subClass: 0, sizeX: 1, sizeY: 1, start: [0, 1, 3, 0, 0, 0, 0, 0], frameCnt: [1, 3, 1, 1, 0, 0, 0, 0], frameDelta: [256, 256, 128, 128, 128, 128, 128, 128], cycleAnim: [false, false, false, false, false, false, false, false] },
  9: { subClass: 0, sizeX: 1, sizeY: 1, start: [0, 0, 8, 0, 0, 0, 0, 0], frameCnt: [1, 9, 1, 1, 1, 1, 1, 1], frameDelta: [256, 256, 256, 256, 256, 256, 256, 256], cycleAnim: [false, false, false, false, false, false, false, false] },
  11: { subClass: 0, sizeX: 1, sizeY: 1, start: [0, 0, 9, 0, 0, 0, 0, 0], frameCnt: [1, 9, 1, 0, 0, 0, 0, 0], frameDelta: [210, 160, 0, 256, 256, 256, 256, 256], cycleAnim: [false, false, false, false, false, false, false, false] },
  13: { subClass: 0, sizeX: 1, sizeY: 3, frameCnt: [1, 1, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  14: { subClass: 0, sizeX: 3, sizeY: 1, frameCnt: [1, 1, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  15: { subClass: 0, sizeX: 1, sizeY: 3, frameCnt: [1, 1, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  16: { subClass: 0, sizeX: 3, sizeY: 1, frameCnt: [1, 1, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  17: { subClass: 0, sizeX: 3, sizeY: 3, start: [0, 0, 3, 0, 0, 0, 0, 0], frameCnt: [1, 3, 1, 0, 0, 0, 0, 0], frameDelta: [256, 256, 256, 0, 0, 0, 0, 0], cycleAnim: [false, false, false, false, false, false, false, false] },
  18: { subClass: 0, sizeX: 3, sizeY: 3, start: [0, 0, 3, 0, 0, 0, 0, 0], frameCnt: [1, 3, 1, 0, 0, 0, 0, 0], frameDelta: [256, 256, 256, 0, 0, 0, 0, 0], cycleAnim: [false, false, false, false, false, false, false, false] },
  19: { subClass: 0, sizeX: 3, sizeY: 3, start: [0, 0, 3, 0, 0, 0, 0, 0], frameCnt: [1, 3, 1, 0, 0, 0, 0, 0], frameDelta: [256, 256, 256, 0, 0, 0, 0, 0], cycleAnim: [false, false, false, false, false, false, false, false] },
  20: { subClass: 0, sizeX: 3, sizeY: 3, start: [0, 0, 3, 0, 0, 0, 0, 0], frameCnt: [1, 3, 1, 0, 0, 0, 0, 0], frameDelta: [256, 256, 256, 0, 0, 0, 0, 0], cycleAnim: [false, false, false, false, false, false, false, false] },
  21: { subClass: 0, sizeX: 3, sizeY: 3, start: [0, 0, 3, 0, 0, 0, 0, 0], frameCnt: [1, 3, 1, 0, 0, 0, 0, 0], frameDelta: [256, 256, 256, 0, 0, 0, 0, 0], cycleAnim: [false, false, false, false, false, false, false, false] },
  23: { subClass: 0, sizeX: 1, sizeY: 7, frameCnt: [1, 3, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  24: { subClass: 0, sizeX: 7, sizeY: 1, frameCnt: [1, 3, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  25: { subClass: 0, sizeX: 9, sizeY: 1, frameCnt: [1, 4, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  27: { subClass: 0, sizeX: 7, sizeY: 1, frameCnt: [1, 4, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  29: { subClass: 0, sizeX: 1, sizeY: 1, frameCnt: [1, 20, 20], frameDelta: [200, 200, 200], cycleAnim: [false, false, true] },
  37: { subClass: 0, sizeX: 1, sizeY: 1, frameCnt: [1, 10, 20], frameDelta: [200, 200, 200], cycleAnim: [false, false, true] },
  46: { subClass: 0, sizeX: 1, sizeY: 1, start: [0, 0, 8, 0, 0, 0, 0, 0], frameCnt: [1, 9, 1, 1, 1, 1, 1, 1], frameDelta: [256, 256, 256, 256, 256, 256, 256, 256], cycleAnim: [false, false, false, false, false, false, false, false] },
  47: { subClass: 0, sizeX: 7, sizeY: 1, frameCnt: [1, 4, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  50: { subClass: 8, sizeX: 5, sizeY: 3, start: [0, 1, 4, 0, 0, 0, 0, 0], frameCnt: [1, 4, 1, 1, 1, 1, 1, 1], frameDelta: [256, 80, 256, 256, 256, 256, 256, 256], cycleAnim: [false, false, false, false, false, false, false, false] },
  51: { subClass: 8, sizeX: 3, sizeY: 5, start: [0, 1, 4, 0, 0, 0, 0, 0], frameCnt: [1, 4, 1, 1, 1, 1, 1, 1], frameDelta: [256, 80, 256, 256, 256, 256, 256, 256], cycleAnim: [false, false, false, false, false, false, false, false] },
  52: { subClass: 8, sizeX: 1, sizeY: 1, start: [0, 0, 8, 0, 0, 0, 0, 0], frameCnt: [1, 9, 1, 1, 1, 1, 1, 1], frameDelta: [256, 256, 256, 256, 256, 256, 256, 256], cycleAnim: [false, false, false, false, false, false, false, false] },
  53: { subClass: 8, sizeX: 5, sizeY: 3, start: [0, 1, 4, 0, 0, 0, 0, 0], frameCnt: [1, 4, 1, 1, 1, 1, 1, 1], frameDelta: [256, 80, 256, 256, 256, 256, 256, 256], cycleAnim: [false, false, false, false, false, false, false, false] },
  56: { subClass: 0, sizeX: 1, sizeY: 1, start: [0, 1, 7, 0, 0, 0, 0, 0], frameCnt: [1, 7, 1, 0, 0, 0, 0, 0], frameDelta: [192, 128, 128, 0, 0, 0, 0, 0], cycleAnim: [false, false, false, false, false, false, false, false] },
  57: { subClass: 0, sizeX: 1, sizeY: 1, start: [0, 1, 9, 0, 0, 0, 0, 0], frameCnt: [1, 9, 1, 0, 0, 0, 0, 0], frameDelta: [192, 128, 128, 0, 0, 0, 0, 0], cycleAnim: [false, false, false, false, false, false, false, false] },
  58: { subClass: 0, sizeX: 1, sizeY: 1, start: [0, 1, 9, 0, 0, 0, 0, 0], frameCnt: [1, 9, 1, 0, 0, 0, 0, 0], frameDelta: [192, 128, 128, 0, 0, 0, 0, 0], cycleAnim: [false, false, false, false, false, false, false, false] },
  59: { subClass: 4, sizeX: 4, sizeY: 4, frameCnt: [0, 15, 15], frameDelta: [200, 200, 200], cycleAnim: [false, false, true] },
  60: { subClass: 4, sizeX: 1, sizeY: 1, frameCnt: [0, 15, 15], frameDelta: [200, 200, 200], cycleAnim: [false, false, true] },
  62: { subClass: 0, sizeX: 1, sizeY: 4, frameCnt: [1, 1, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  63: { subClass: 0, sizeX: 4, sizeY: 1, frameCnt: [1, 1, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  64: { subClass: 0, sizeX: 1, sizeY: 4, frameCnt: [1, 1, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  75: { subClass: 0, sizeX: 1, sizeY: 3, frameCnt: [1, 1, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  79: { subClass: 0, sizeX: 4, sizeY: 6, start: [0, 0, 6, 0, 0, 0, 0, 0], frameCnt: [1, 7, 1, 0, 0, 0, 0, 0], frameDelta: [0, 256, 0, 0, 0, 0, 0, 0], cycleAnim: [false, false, false, false, false, false, false, false] },
  91: { subClass: 0, sizeX: 1, sizeY: 7, frameCnt: [1, 8, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  92: { subClass: 0, sizeX: 7, sizeY: 1, frameCnt: [1, 8, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  98: { subClass: 0, sizeX: 1, sizeY: 7, frameCnt: [1, 8, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  99: { subClass: 0, sizeX: 7, sizeY: 1, frameCnt: [1, 8, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  102: { subClass: 0, sizeX: 1, sizeY: 1, frameCnt: [20, 20, 20], frameDelta: [200, 200, 200], cycleAnim: [true, false, true] },
  117: { subClass: 0, sizeX: 1, sizeY: 1, frameCnt: [1, 9, 29], frameDelta: [256, 256, 256], cycleAnim: [false, false, true] },
  119: { subClass: 64, sizeX: 5, sizeY: 5, frameCnt: [1, 15, 8], frameDelta: [200, 200, 200], cycleAnim: [false, false, true] },
  145: { subClass: 64, sizeX: 1, sizeY: 1, frameCnt: [1, 15, 15], frameDelta: [200, 200, 200], cycleAnim: [false, false, true] },
  156: { subClass: 64, sizeX: 1, sizeY: 1, frameCnt: [1, 15, 15], frameDelta: [200, 200, 160], cycleAnim: [false, false, true] },
  157: { subClass: 64, sizeX: 1, sizeY: 1, frameCnt: [1, 15, 15], frameDelta: [200, 200, 160], cycleAnim: [false, false, true] },
  160: { subClass: 0, sizeX: 0, sizeY: 0, start: [0, 0, 10, 0, 0, 0, 0, 0], frameCnt: [0, 9, 26], frameDelta: [0, 256, 256], cycleAnim: [false, false, true] },
  161: { subClass: 0, sizeX: 0, sizeY: 0, start: [0, 0, 10, 0, 0, 0, 0, 0], frameCnt: [0, 9, 26], frameDelta: [0, 256, 256], cycleAnim: [false, false, true] },
  162: { subClass: 0, sizeX: 0, sizeY: 0, start: [0, 0, 10, 0, 0, 0, 0, 0], frameCnt: [0, 9, 26], frameDelta: [0, 256, 256], cycleAnim: [false, false, true] },
  189: { subClass: 0, sizeX: 0, sizeY: 0, frameCnt: [1, 15, 9], frameDelta: [160, 200, 160], cycleAnim: [false, false, true] },
  193: { subClass: 0, sizeX: 1, sizeY: 1, start: [0, 1, 3, 0, 0, 0, 0, 0], frameCnt: [1, 3, 1, 0, 0, 0, 0, 0], frameDelta: [256, 256, 128, 128, 128, 128, 128, 128], cycleAnim: [false, false, false, false, false, false, false, false] },
  229: { subClass: 0, sizeX: 7, sizeY: 1, frameCnt: [1, 14, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  230: { subClass: 0, sizeX: 1, sizeY: 7, frameCnt: [1, 14, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  237: { subClass: 64, sizeX: 1, sizeY: 1, frameCnt: [1, 15, 15], frameDelta: [200, 200, 160], cycleAnim: [false, false, true] },
  238: { subClass: 64, sizeX: 1, sizeY: 1, frameCnt: [1, 15, 15], frameDelta: [200, 200, 160], cycleAnim: [false, false, true] },
  239: { subClass: 8, sizeX: 3, sizeY: 3, frameCnt: [0, 9, 14], frameDelta: [0, 640, 160], cycleAnim: [true, false, true] },
  251: { subClass: 0, sizeX: 3, sizeY: 1, frameCnt: [1, 12, 16], frameDelta: [0, 150, 150], cycleAnim: [false, false, true] },
  252: { subClass: 0, sizeX: 3, sizeY: 3, frameCnt: [1, 8, 19], frameDelta: [0, 150, 150], cycleAnim: [false, false, true] },
  288: { subClass: 64, sizeX: 1, sizeY: 1, frameCnt: [1, 15, 15], frameDelta: [200, 200, 160], cycleAnim: [false, false, true] },
  290: { subClass: 0, sizeX: 1, sizeY: 3, frameCnt: [1, 1, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  291: { subClass: 0, sizeX: 3, sizeY: 1, frameCnt: [1, 1, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  292: { subClass: 0, sizeX: 1, sizeY: 3, frameCnt: [1, 1, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  293: { subClass: 0, sizeX: 3, sizeY: 1, frameCnt: [1, 1, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  294: { subClass: 0, sizeX: 1, sizeY: 3, frameCnt: [1, 1, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  295: { subClass: 0, sizeX: 3, sizeY: 1, frameCnt: [1, 1, 1], frameDelta: [256, 256, 256], cycleAnim: [false, false, false] },
  298: { subClass: 16, sizeX: 5, sizeY: 2, frameCnt: [30, 30, 30], frameDelta: [200, 200, 200], cycleAnim: [true, false, true] },
  323: { subClass: 64, sizeX: 1, sizeY: 1, frameCnt: [1, 15, 15], frameDelta: [200, 200, 160], cycleAnim: [false, false, true] },
  324: { subClass: 64, sizeX: 1, sizeY: 1, frameCnt: [1, 15, 15], frameDelta: [200, 200, 160], cycleAnim: [false, false, true] },
  341: { subClass: 0, sizeX: 11, sizeY: 5, frameCnt: [1, 28, 1], frameDelta: [0, 256, 0], cycleAnim: [false, false, false] },
  342: { subClass: 16, sizeX: 2, sizeY: 3, frameCnt: [30, 30, 30], frameDelta: [128, 128, 128], cycleAnim: [true, false, true] },
  357: { subClass: 0, sizeX: 1, sizeY: 1, start: [0, 1, 3, 0, 0, 0, 0, 0], frameCnt: [1, 3, 1, 1, 0, 0, 0, 0], frameDelta: [256, 256, 128, 128, 128, 128, 128, 128], cycleAnim: [false, false, false, false, false, false, false, false] },
  364: { subClass: 128, sizeX: 2, sizeY: 1, frameCnt: [28, 15, 10], frameDelta: [128, 128, 128], cycleAnim: [true, false, true] },
  371: { subClass: 8, sizeX: 1, sizeY: 1, start: [0, 1, 1, 0, 0, 0, 0, 0], frameCnt: [1, 13, 1, 1, 1, 1, 1, 1], frameDelta: [256, 256, 256, 256, 256, 256, 256, 256], cycleAnim: [false, false, false, false, false, false, false, false] },
  376: { subClass: 0, sizeX: 3, sizeY: 3, frameCnt: [22, 22, 22, 22, 22, 0, 0, 0], frameDelta: [128, 128, 128, 128, 128, 128, 256, 256], cycleAnim: [true, false, true, false, true, true, false, false] },
  377: { subClass: 0, sizeX: 1, sizeY: 1, frameCnt: [15, 15, 15, 15, 0, 0, 0, 0], frameDelta: [100, 100, 100, 100, 0, 0, 0, 0], cycleAnim: [true, false, true, false, false, false, false, false] },
  380: { subClass: 0, sizeX: 2, sizeY: 2, frameCnt: [20, 8, 21, 7, 1, 8, 0, 0], frameDelta: [140, 120, 140, 120, 1, 140, 0, 0], cycleAnim: [true, false, true, false, false, false, false, false] },
  381: { subClass: 0, sizeX: 2, sizeY: 2, frameCnt: [20, 8, 21, 7, 1, 8, 0, 0], frameDelta: [140, 120, 140, 120, 1, 140, 0, 0], cycleAnim: [true, false, true, false, false, false, false, false] },
  392: { subClass: 0, sizeX: 5, sizeY: 5, frameCnt: [1, 20, 20], frameDelta: [0, 128, 128], cycleAnim: [false, false, true] },
  393: { subClass: 0, sizeX: 5, sizeY: 5, frameCnt: [1, 20, 20], frameDelta: [0, 128, 128], cycleAnim: [false, false, true] },
  394: { subClass: 0, sizeX: 5, sizeY: 5, frameCnt: [1, 20, 20], frameDelta: [0, 128, 128], cycleAnim: [false, false, true] },
  395: { subClass: 0, sizeX: 5, sizeY: 5, frameCnt: [1, 20, 20], frameDelta: [0, 128, 128], cycleAnim: [false, false, true] },
  396: { subClass: 0, sizeX: 5, sizeY: 5, frameCnt: [1, 20, 20], frameDelta: [0, 128, 128], cycleAnim: [false, false, true] },
  398: { subClass: 64, sizeX: 1, sizeY: 1, frameCnt: [1, 15, 15], frameDelta: [200, 200, 160], cycleAnim: [false, false, true] },
  399: { subClass: 0, sizeX: 0, sizeY: 0, frameCnt: [12, 49, 12], frameDelta: [256, 256, 0], cycleAnim: [true, false, true] },
  402: { subClass: 64, sizeX: 1, sizeY: 1, frameCnt: [1, 15, 15], frameDelta: [200, 200, 160], cycleAnim: [false, false, true] },
  429: { subClass: 64, sizeX: 5, sizeY: 5, frameCnt: [1, 15, 15], frameDelta: [200, 200, 100], cycleAnim: [false, false, true] },
  473: { subClass: 0, sizeX: 3, sizeY: 3, start: [0, 0, 28, 29, 0, 0, 0, 0], frameCnt: [1, 0, 0, 1, 0, 0, 0, 0], frameDelta: [0, 0, 0, 0, 128, 128, 128, 128], cycleAnim: [true, false, false, false, false, false, false, false] },
  474: { subClass: 0, sizeX: 3, sizeY: 3, start: [0, 0, 0, 0, 0, 0, 0, 0], frameCnt: [1, 20, 1, 16, 1, 0, 0, 0], frameDelta: [48, 128, 0, 128, 128, 128, 128, 128], cycleAnim: [true, false, false, false, false, false, false, false] },
  475: { subClass: 0, sizeX: 3, sizeY: 3, start: [0, 0, 0, 0, 0, 0, 0, 0], frameCnt: [1, 20, 1, 16, 1, 0, 0, 0], frameDelta: [48, 128, 0, 128, 128, 128, 128, 128], cycleAnim: [true, false, false, false, false, false, false, false] },
  476: { subClass: 0, sizeX: 3, sizeY: 3, start: [0, 0, 0, 0, 0, 0, 0, 0], frameCnt: [1, 20, 1, 16, 1, 0, 0, 0], frameDelta: [48, 128, 0, 128, 128, 128, 128, 128], cycleAnim: [true, false, false, false, false, false, false, false] },
  494: { subClass: 64, sizeX: 5, sizeY: 5, start: [0, 0, 0, 0, 0, 0, 0, 0], frameCnt: [1, 20, 20, 0, 0, 0, 0, 0], frameDelta: [200, 200, 100, 0, 0, 0, 0, 0], cycleAnim: [false, false, true, false, false, false, false, false] },
  496: { subClass: 64, sizeX: 5, sizeY: 5, start: [0, 0, 0, 0, 0, 0, 0, 0], frameCnt: [1, 20, 20, 0, 0, 0, 0, 0], frameDelta: [200, 200, 100, 0, 0, 0, 0, 0], cycleAnim: [false, false, true, false, false, false, false, false] },
  511: { subClass: 64, sizeX: 5, sizeY: 5, start: [0, 0, 0, 0, 0, 0, 0, 0], frameCnt: [1, 20, 20, 0, 0, 0, 0, 0], frameDelta: [200, 200, 100, 0, 0, 0, 0, 0], cycleAnim: [false, false, true, false, false, false, false, false] },
  539: { subClass: 64, sizeX: 5, sizeY: 5, start: [0, 0, 0, 0, 0, 0, 0, 0], frameCnt: [1, 20, 20, 0, 0, 0, 0, 0], frameDelta: [200, 200, 100, 0, 0, 0, 0, 0], cycleAnim: [false, false, true, false, false, false, false, false] },
  546: { subClass: 0, sizeX: 1, sizeY: 1, start: [0, 0, 0, 0, 0, 0, 0, 0], frameCnt: [1, 30, 1, 0, 0, 0, 0, 0], frameDelta: [0, 256, 0, 0, 0, 0, 0, 0], cycleAnim: [false, false, false, false, false, false, false, false] },
  547: { subClass: 0, sizeX: 5, sizeY: 8, start: [0, 0, 0, 0, 0, 0, 0, 0], frameCnt: [1, 50, 1, 0, 0, 0, 0, 0], frameDelta: [0, 256, 0, 0, 0, 0, 0, 0], cycleAnim: [false, false, false, false, false, false, false, false] },
  558: { subClass: 0, sizeX: 1, sizeY: 1, start: [0, 0, 0, 0, 0, 0, 0, 0], frameCnt: [20, 0, 1, 0, 0, 0, 0, 0], frameDelta: [128, 128, 128, 128, 128, 128, 128, 128], cycleAnim: [true, false, false, false, false, false, false, false] },
  563: { subClass: 0, sizeX: 1, sizeY: 1, start: [0, 0, 0, 0, 0, 0, 0, 0], frameCnt: [1, 50, 40, 0, 0, 0, 0, 0], frameDelta: [256, 256, 256, 0, 0, 0, 0, 0], cycleAnim: [false, false, true, false, false, false, false, false] },
  564: { subClass: 0, sizeX: 0, sizeY: 0, start: [0, 0, 0, 0, 0, 0, 0, 0], frameCnt: [1, 31, 1, 0, 0, 0, 0, 0], frameDelta: [128, 128, 256, 0, 0, 0, 0, 0], cycleAnim: [false, false, false, false, false, false, false, false] },
  565: { subClass: 0, sizeX: 0, sizeY: 0, start: [0, 0, 0, 0, 0, 0, 0, 0], frameCnt: [0, 15, 15, 0, 0, 0, 0, 0], frameDelta: [128, 128, 128, 0, 0, 0, 0, 0], cycleAnim: [false, false, true, false, false, false, false, false] },
  566: { subClass: 0, sizeX: 0, sizeY: 0, start: [0, 0, 0, 0, 0, 0, 0, 0], frameCnt: [0, 15, 15, 0, 0, 0, 0, 0], frameDelta: [128, 128, 128, 0, 0, 0, 0, 0], cycleAnim: [false, false, true, false, false, false, false, false] },
  569: { subClass: 0, sizeX: 1, sizeY: 1, start: [0, 0, 0, 0, 0, 0, 0, 0], frameCnt: [1, 50, 40, 0, 0, 0, 0, 0], frameDelta: [256, 256, 256, 0, 0, 0, 0, 0], cycleAnim: [false, false, true, false, false, false, false, false] },
}

const OBJECT_GEOMETRY_113C: Readonly<Record<number, Partial<CanonicalObjectMeta>>> = {
  0: { sizeX: 0, sizeY: 0, hasCollisionMask: 255 },
  1: { sizeX: 5, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -83, top: -61, width: 139, height: 121 } },
  2: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -59, top: -116, width: 100, height: 158 } },
  3: { sizeX: 5, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -65, top: -49, width: 135, height: 119 } },
  4: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -62, top: -39, width: 89, height: 83 } },
  5: { sizeX: 1, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -53, top: -36, width: 67, height: 81 } },
  6: { sizeX: 2, sizeY: 1, hasCollisionMask: 255, hitBox: { left: -49, top: -35, width: 68, height: 81 } },
  7: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -71, top: -35, width: 100, height: 112 } },
  8: { sizeX: 1, sizeY: 1, hasCollisionMask: 15, hitBox: { left: -45, top: -51, width: 57, height: 81 } },
  9: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -60, top: -32, width: 84, height: 77 } },
  10: { sizeX: 7, sizeY: 1, hasCollisionMask: 255 },
  11: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -71, top: -35, width: 100, height: 112 } },
  12: { sizeX: 3, sizeY: 3 },
  13: { sizeX: 1, sizeY: 3, hasCollisionMask: 67, left: -20, top: -80, width: 40, height: 40, hitBox: { left: -48, top: -91, width: 64, height: 135 } },
  14: { sizeX: 3, sizeY: 1, hasCollisionMask: 67, left: -20, top: -80, width: 40, height: 40, hitBox: { left: -47, top: -94, width: 64, height: 138 } },
  15: { sizeX: 1, sizeY: 3, hasCollisionMask: 67, blockMissile: true, blocksVis: true, left: -20, top: -80, width: 40, height: 40, hitBox: { left: -42, top: -86, width: 63, height: 132 } },
  16: { sizeX: 3, sizeY: 1, hasCollisionMask: 67, blockMissile: true, blocksVis: true, left: -20, top: -80, width: 40, height: 40, hitBox: { left: -54, top: -88, width: 65, height: 134 } },
  17: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -56, top: -118, width: 84, height: 177 } },
  18: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -58, top: -119, width: 88, height: 182 } },
  19: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -59, top: -116, width: 95, height: 177 } },
  20: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -60, top: -127, width: 93, height: 183 } },
  21: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -59, top: -108, width: 93, height: 174 } },
  22: { sizeX: 3, sizeY: 3, hasCollisionMask: 255 },
  23: { sizeX: 1, sizeY: 7, hasCollisionMask: 11, blockMissile: true, blocksVis: true, left: -20, top: -80, width: 40, height: 40, hitBox: { left: -115, top: -110, width: 156, height: 158 } },
  24: { sizeX: 7, sizeY: 1, hasCollisionMask: 11, blockMissile: true, blocksVis: true, left: -20, top: -80, width: 40, height: 40, hitBox: { left: -55, top: -129, width: 153, height: 156 } },
  25: { sizeX: 9, sizeY: 1, hasCollisionMask: 11, blockMissile: true, left: -20, top: -80, width: 40, height: 40, hitBox: { left: -80, top: -138, width: 167, height: 175 } },
  26: { sizeX: 3, sizeY: 3, hasCollisionMask: 127, hitBox: { left: -78, top: -141, width: 118, height: 207 } },
  27: { sizeX: 7, sizeY: 1, hasCollisionMask: 11, blockMissile: true, blocksVis: true, left: -20, top: -80, width: 40, height: 40, hitBox: { left: -59, top: -141, width: 84, height: 186 } },
  28: { sizeX: 5, sizeY: 3, hasCollisionMask: 7, hitBox: { left: -86, top: -29, width: 157, height: 91 } },
  29: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  30: { sizeX: 5, sizeY: 5, hasCollisionMask: 255, collisionSubst: true, left: -40, top: -40, width: 80, height: 80, hitBox: { left: -147, top: -202, width: 207, height: 266 } },
  31: { sizeX: 3, sizeY: 3, hasCollisionMask: 7 },
  32: { sizeX: 3, sizeY: 3, hasCollisionMask: 255 },
  33: { sizeX: 3, sizeY: 1, hasCollisionMask: 255 },
  34: { sizeX: 1, sizeY: 3, hasCollisionMask: 255 },
  35: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  36: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  37: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  38: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  39: { sizeX: 3, sizeY: 3 },
  40: { sizeX: 0, sizeY: 0, hasCollisionMask: 248 },
  41: { sizeX: 0, sizeY: 0 },
  42: { sizeX: 0, sizeY: 0 },
  43: { sizeX: 0, sizeY: 0 },
  44: { sizeX: 0, sizeY: 0 },
  45: { sizeX: 0, sizeY: 0 },
  46: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -42, top: -20, width: 59, height: 53 } },
  47: { sizeX: 7, sizeY: 1, hasCollisionMask: 11, blockMissile: true, blocksVis: true, left: -20, top: -80, width: 40, height: 40, hitBox: { left: -71, top: -190, width: 113, height: 241 } },
  48: { sizeX: 2, sizeY: 1, hasCollisionMask: 255 },
  49: { sizeX: 1, sizeY: 2, hasCollisionMask: 255 },
  50: { sizeX: 5, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -88, top: -64, width: 143, height: 123 } },
  51: { sizeX: 3, sizeY: 5, hasCollisionMask: 255, hitBox: { left: -86, top: -65, width: 142, height: 121 } },
  52: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -50, top: -17, width: 68, height: 59 } },
  53: { sizeX: 5, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -86, top: -71, width: 152, height: 135 } },
  54: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -63, top: -31, width: 106, height: 76 } },
  55: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -85, top: -28, width: 105, height: 77 } },
  56: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -64, top: -32, width: 108, height: 69 } },
  57: { sizeX: 1, sizeY: 1, hasCollisionMask: 255, hitBox: { left: -61, top: -83, width: 78, height: 121 } },
  58: { sizeX: 1, sizeY: 1, hasCollisionMask: 255, hitBox: { left: -54, top: -82, width: 82, height: 125 } },
  59: { sizeX: 4, sizeY: 4, hasCollisionMask: 7, collisionSubst: true, left: -40, top: -100, width: 80, height: 110, hitBox: { left: -121, top: -137, width: 212, height: 226 } },
  60: { sizeX: 1, sizeY: 1, hasCollisionMask: 7, collisionSubst: true, left: -40, top: -100, width: 80, height: 110, hitBox: { left: -87, top: -115, width: 143, height: 183 } },
  61: { sizeX: 5, sizeY: 5 },
  62: { sizeX: 1, sizeY: 4, hasCollisionMask: 3, blockMissile: true, blocksVis: true, left: -20, top: -80, width: 40, height: 40, hitBox: { left: -38, top: -84, width: 61, height: 122 } },
  63: { sizeX: 4, sizeY: 1, hasCollisionMask: 3, blockMissile: true, blocksVis: true, left: -20, top: -80, width: 40, height: 40, hitBox: { left: -54, top: -81, width: 60, height: 124 } },
  64: { sizeX: 1, sizeY: 4, hasCollisionMask: 3, blockMissile: true, blocksVis: true, left: -20, top: -80, width: 40, height: 40, hitBox: { left: -43, top: -86, width: 63, height: 132 } },
  65: { sizeX: 0, sizeY: 32 },
  66: { sizeX: 32, sizeY: 0 },
  67: { sizeX: 1, sizeY: 1 },
  68: { sizeX: 1, sizeY: 1 },
  69: { sizeX: 1, sizeY: 1 },
  70: { sizeX: 1, sizeY: 1 },
  71: { sizeX: 1, sizeY: 1 },
  72: { sizeX: 1, sizeY: 1 },
  73: { sizeX: 1, sizeY: 1, hasCollisionMask: 1 },
  74: { sizeX: 3, sizeY: 3, hasCollisionMask: 15, hitBox: { left: -98, top: -38, width: 156, height: 107 } },
  75: { sizeX: 1, sizeY: 3, hasCollisionMask: 3, left: -20, top: -80, width: 40, height: 40, hitBox: { left: -63, top: -109, width: 88, height: 158 } },
  76: { sizeX: 5, sizeY: 5 },
  77: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -61, top: -91, width: 104, height: 145 } },
  78: { sizeX: 0, sizeY: 0 },
  79: { sizeX: 4, sizeY: 6, hasCollisionMask: 255, hitBox: { left: -85, top: -66, width: 136, height: 126 } },
  80: { sizeX: 1, sizeY: 1, hasCollisionMask: 255, hitBox: { left: -54, top: -178, width: 82, height: 222 } },
  81: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -60, top: -93, width: 95, height: 145 } },
  82: { sizeX: 3, sizeY: 3, hasCollisionMask: 255 },
  83: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -52, top: -117, width: 78, height: 159 } },
  84: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -62, top: -84, width: 90, height: 134 } },
  85: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -57, top: -72, width: 89, height: 138 } },
  86: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -55, top: -96, width: 74, height: 133 }, modeHitBoxes: { 1: { left: -59, top: -120, width: 86, height: 162 } } },
  87: { sizeX: 1, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -52, top: -33, width: 68, height: 74 } },
  88: { sizeX: 3, sizeY: 1, hasCollisionMask: 255, hitBox: { left: -52, top: -33, width: 68, height: 74 } },
  89: { sizeX: 3, sizeY: 5, hasCollisionMask: 255, hitBox: { left: -81, top: -36, width: 124, height: 97 } },
  90: { sizeX: 1, sizeY: 1, hasCollisionMask: 255, hitBox: { left: -55, top: -186, width: 79, height: 230 } },
  91: { sizeX: 1, sizeY: 7, hasCollisionMask: 11, blockMissile: true, blocksVis: true, left: -20, top: -80, width: 40, height: 40, hitBox: { left: -62, top: -120, width: 87, height: 167 } },
  92: { sizeX: 7, sizeY: 1, hasCollisionMask: 11, blockMissile: true, blocksVis: true, left: -20, top: -80, width: 40, height: 40, hitBox: { left: -40, top: -113, width: 86, height: 167 } },
  93: { sizeX: 3, sizeY: 3, hasCollisionMask: 63, hitBox: { left: -71, top: -49, width: 115, height: 102 } },
  94: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -45, top: -28, width: 62, height: 68 } },
  95: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -46, top: -29, width: 55, height: 63 } },
  96: { sizeX: 3, sizeY: 3, hasCollisionMask: 63, hitBox: { left: -71, top: -49, width: 115, height: 102 } },
  97: { sizeX: 4, sizeY: 4, hasCollisionMask: 255, hitBox: { left: -101, top: -90, width: 158, height: 138 } },
  98: { sizeX: 1, sizeY: 7, hasCollisionMask: 11, blockMissile: true, blocksVis: true, left: -20, top: -80, width: 40, height: 40, hitBox: { left: -51, top: -112, width: 87, height: 167 } },
  99: { sizeX: 7, sizeY: 1, hasCollisionMask: 11, blockMissile: true, blocksVis: true, left: -20, top: -80, width: 40, height: 40, hitBox: { left: -58, top: -115, width: 86, height: 167 } },
  100: { sizeX: 1, sizeY: 3, hasCollisionMask: 1, blocksVis: true, hitBox: { left: -72, top: -105, width: 97, height: 132 }, modeHitBoxes: { 1: { left: -72, top: -105, width: 120, height: 144 }, 2: { left: -72, top: -102, width: 120, height: 141 } } },
  101: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  102: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  103: { sizeX: 1, sizeY: 1 },
  104: { sizeX: 2, sizeY: 1, hasCollisionMask: 255, hitBox: { left: -56, top: -47, width: 76, height: 102 } },
  105: { sizeX: 1, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -56, top: -48, width: 76, height: 103 } },
  106: { sizeX: 2, sizeY: 1, hasCollisionMask: 255, hitBox: { left: -61, top: -65, width: 83, height: 125 } },
  107: { sizeX: 1, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -63, top: -63, width: 94, height: 119 } },
  108: { sizeX: 2, sizeY: 1, hasCollisionMask: 255, hitBox: { left: -51, top: -74, width: 70, height: 113 } },
  109: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -47, top: -92, width: 68, height: 134 } },
  110: { sizeX: 0, sizeY: 0 },
  111: { sizeX: 3, sizeY: 3, hasCollisionMask: 7, hitBox: { left: -74, top: -22, width: 116, height: 90 } },
  112: { sizeX: 0, sizeY: 0 },
  113: { sizeX: 3, sizeY: 3, hasCollisionMask: 7, hitBox: { left: -90, top: -18, width: 148, height: 96 } },
  114: { sizeX: 0, sizeY: 0 },
  115: { sizeX: 3, sizeY: 3, hasCollisionMask: 7, hitBox: { left: -74, top: -22, width: 116, height: 90 } },
  116: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -115, top: -186, width: 194, height: 220 } },
  117: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  118: { sizeX: 3, sizeY: 3, hasCollisionMask: 7, hitBox: { left: -86, top: -61, width: 139, height: 113 } },
  119: { sizeX: 5, sizeY: 5, hitBox: { left: -99, top: -17, width: 155, height: 51 }, modeHitBoxes: { 1: { left: -105, top: -31, width: 169, height: 65 }, 2: { left: -99, top: -35, width: 155, height: 69 } } },
  120: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -64, top: -53, width: 88, height: 101 } },
  121: { sizeX: 1, sizeY: 1 },
  122: { sizeX: 1, sizeY: 1 },
  123: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -67, top: -111, width: 110, height: 166 } },
  124: { sizeX: 4, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -85, top: -108, width: 134, height: 158 } },
  125: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -46, top: -67, width: 65, height: 104 } },
  126: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -61, top: -25, width: 71, height: 63 } },
  127: { sizeX: 4, sizeY: 4, hasCollisionMask: 63, hitBox: { left: -109, top: -122, width: 176, height: 185 } },
  128: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -45, top: -34, width: 52, height: 67 } },
  129: { sizeX: 1, sizeY: 5, hasCollisionMask: 1, blockMissile: true, blocksVis: true, hitBox: { left: -61, top: -98, width: 85, height: 140 } },
  130: { sizeX: 3, sizeY: 3, hasCollisionMask: 7, hitBox: { left: -64, top: -22, width: 126, height: 87 } },
  131: { sizeX: 0, sizeY: 0, hasCollisionMask: 1 },
  132: { sizeX: 3, sizeY: 3, hasCollisionMask: 7, hitBox: { left: -72, top: -92, width: 117, height: 137 } },
  133: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -55, top: -97, width: 83, height: 140 } },
  134: { sizeX: 3, sizeY: 4, hasCollisionMask: 255, hitBox: { left: -79, top: -197, width: 135, height: 237 } },
  135: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -46, top: -98, width: 67, height: 133 } },
  136: { sizeX: 6, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -80, top: -52, width: 127, height: 115 } },
  137: { sizeX: 3, sizeY: 3, hasCollisionMask: 7, hitBox: { left: -89, top: -36, width: 147, height: 96 } },
  138: { sizeX: 4, sizeY: 4, hasCollisionMask: 7, hitBox: { left: -92, top: -68, width: 147, height: 116 } },
  139: { sizeX: 3, sizeY: 2, hasCollisionMask: 15, hitBox: { left: -50, top: -21, width: 71, height: 60 } },
  140: { sizeX: 1, sizeY: 1, hasCollisionMask: 15, hitBox: { left: -38, top: -20, width: 46, height: 55 } },
  141: { sizeX: 3, sizeY: 2, hasCollisionMask: 15, hitBox: { left: -41, top: -17, width: 55, height: 52 } },
  142: { sizeX: 1, sizeY: 1, hasCollisionMask: 3, hitBox: { left: -43, top: -14, width: 49, height: 50 } },
  143: { sizeX: 1, sizeY: 1, hasCollisionMask: 3, hitBox: { left: -41, top: -25, width: 50, height: 55 } },
  144: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -52, top: -20, width: 67, height: 61 } },
  145: { sizeX: 1, sizeY: 1, hitBox: { left: -97, top: -13, width: 152, height: 44 }, modeHitBoxes: { 1: { left: -105, top: -31, width: 169, height: 62 }, 2: { left: -97, top: -35, width: 153, height: 66 } } },
  146: { sizeX: 3, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -41, top: -13, width: 54, height: 48 } },
  147: { sizeX: 3, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -50, top: -20, width: 70, height: 56 } },
  148: { sizeX: 2, sizeY: 2, hasCollisionMask: 63, hitBox: { left: -52, top: -22, width: 68, height: 60 } },
  149: { sizeX: 4, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -87, top: -37, width: 109, height: 88 } },
  150: { sizeX: 5, sizeY: 5, hasCollisionMask: 255, hitBox: { left: -98, top: -74, width: 155, height: 128 } },
  151: { sizeX: 5, sizeY: 4, hasCollisionMask: 255, hitBox: { left: -94, top: -83, width: 156, height: 143 } },
  152: { sizeX: 3, sizeY: 3, hasCollisionMask: 15, hitBox: { left: -58, top: -26, width: 83, height: 69 } },
  153: { sizeX: 1, sizeY: 5, hasCollisionMask: 11, blockMissile: true, blocksVis: true },
  154: { sizeX: 3, sizeY: 3, hasCollisionMask: 1, hitBox: { left: -70, top: -21, width: 94, height: 69 } },
  155: { sizeX: 1, sizeY: 1, hasCollisionMask: 7, hitBox: { left: -56, top: -22, width: 78, height: 62 } },
  156: { sizeX: 1, sizeY: 1, hitBox: { left: -93, top: -14, width: 147, height: 48 }, modeHitBoxes: { 1: { left: -105, top: -31, width: 169, height: 65 }, 2: { left: -97, top: -35, width: 153, height: 69 } } },
  157: { sizeX: 1, sizeY: 1, hitBox: { left: -95, top: -17, width: 152, height: 46 }, modeHitBoxes: { 1: { left: -103, top: -41, width: 169, height: 70 }, 2: { left: -95, top: -45, width: 153, height: 75 } } },
  158: { sizeX: 3, sizeY: 3, hasCollisionMask: 1, hitBox: { left: -80, top: -15, width: 118, height: 72 } },
  159: { sizeX: 1, sizeY: 1, hasCollisionMask: 7, hitBox: { left: -56, top: -40, width: 79, height: 133 } },
  160: { sizeX: 0, sizeY: 0 },
  161: { sizeX: 0, sizeY: 0 },
  162: { sizeX: 0, sizeY: 0 },
  163: { sizeX: 1, sizeY: 1, hasCollisionMask: 7, hitBox: { left: -53, top: -57, width: 71, height: 106 } },
  164: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -62, top: -85, width: 91, height: 136 } },
  165: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -62, top: -94, width: 105, height: 149 } },
  166: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -57, top: -72, width: 89, height: 138 } },
  167: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -47, top: -92, width: 68, height: 134 } },
  168: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -63, top: -94, width: 95, height: 155 } },
  169: { sizeX: 5, sizeY: 1, hasCollisionMask: 7, hitBox: { left: -85, top: -43, width: 150, height: 117 } },
  170: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -63, top: -94, width: 95, height: 155 } },
  171: { sizeX: 3, sizeY: 3, hasCollisionMask: 1, hitBox: { left: -74, top: -3, width: 114, height: 51 } },
  172: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -49, top: -31, width: 65, height: 65 } },
  173: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -49, top: -31, width: 65, height: 65 } },
  174: { sizeX: 1, sizeY: 1, hasCollisionMask: 7, collisionSubst: true, left: -18, top: -20, width: 36, height: 30, hitBox: { left: -42, top: -14, width: 77, height: 130 } },
  175: { sizeX: 1, sizeY: 1, hasCollisionMask: 7, hitBox: { left: -53, top: -31, width: 62, height: 61 } },
  176: { sizeX: 1, sizeY: 1, hasCollisionMask: 15, hitBox: { left: -43, top: -17, width: 55, height: 52 } },
  177: { sizeX: 1, sizeY: 1, hasCollisionMask: 15, hitBox: { left: -48, top: -21, width: 60, height: 62 } },
  178: { sizeX: 1, sizeY: 1, hasCollisionMask: 7, hitBox: { left: -51, top: -98, width: 71, height: 143 } },
  179: { sizeX: 1, sizeY: 1, hasCollisionMask: 7, hitBox: { left: -63, top: -83, width: 84, height: 132 } },
  180: { sizeX: 1, sizeY: 1, hasCollisionMask: 7, hitBox: { left: -61, top: -85, width: 89, height: 132 } },
  181: { sizeX: 3, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -45, top: -23, width: 67, height: 67 } },
  182: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -47, top: -67, width: 60, height: 103 } },
  183: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -45, top: -21, width: 55, height: 58 } },
  184: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -59, top: -69, width: 89, height: 111 } },
  185: { sizeX: 2, sizeY: 2, hasCollisionMask: 63, hitBox: { left: -57, top: -51, width: 84, height: 89 } },
  186: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -52, top: -50, width: 63, height: 86 } },
  187: { sizeX: 2, sizeY: 2, hasCollisionMask: 63, hitBox: { left: -39, top: -27, width: 44, height: 61 } },
  188: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -49, top: -56, width: 54, height: 90 } },
  189: { sizeX: 0, sizeY: 0, hasCollisionMask: 7 },
  190: { sizeX: 3, sizeY: 4, hasCollisionMask: 255, hitBox: { left: -74, top: -77, width: 118, height: 138 } },
  191: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -59, top: -72, width: 99, height: 120 } },
  192: { sizeX: 1, sizeY: 1, hasCollisionMask: 254, collisionSubst: true, left: -30, top: -80, width: 60, height: 80, hitBox: { left: -104, top: -127, width: 161, height: 205 } },
  193: { sizeX: 1, sizeY: 1, hasCollisionMask: 15, hitBox: { left: -45, top: -51, width: 57, height: 81 } },
  194: { sizeX: 6, sizeY: 10, hasCollisionMask: 63, hitBox: { left: -120, top: -93, width: 208, height: 164 }, modeHitBoxes: { 1: { left: -120, top: -93, width: 208, height: 165 }, 2: { left: -120, top: -93, width: 208, height: 165 } } },
  195: { sizeX: 10, sizeY: 6, hasCollisionMask: 63, hitBox: { left: -120, top: -93, width: 208, height: 164 }, modeHitBoxes: { 1: { left: -120, top: -93, width: 208, height: 165 }, 2: { left: -120, top: -93, width: 208, height: 165 } } },
  196: { sizeX: 1, sizeY: 1 },
  197: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -55, top: -92, width: 88, height: 137 } },
  198: { sizeX: 1, sizeY: 1, hasCollisionMask: 15, hitBox: { left: -35, top: -24, width: 44, height: 59 } },
  199: { sizeX: 3, sizeY: 4, hasCollisionMask: 255, hitBox: { left: -67, top: -87, width: 100, height: 137 } },
  200: { sizeX: 5, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -73, top: -104, width: 129, height: 156 } },
  201: { sizeX: 4, sizeY: 4, hasCollisionMask: 255, hitBox: { left: -80, top: -105, width: 117, height: 155 } },
  202: { sizeX: 3, sizeY: 4, hasCollisionMask: 255, hitBox: { left: -57, top: -40, width: 81, height: 77 } },
  203: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -56, top: -67, width: 77, height: 107 } },
  204: { sizeX: 1, sizeY: 3, hasCollisionMask: 63, hitBox: { left: -62, top: -36, width: 86, height: 80 } },
  205: { sizeX: 2, sizeY: 2, hasCollisionMask: 63, hitBox: { left: -65, top: -72, width: 92, height: 117 } },
  206: { sizeX: 3, sizeY: 4, hasCollisionMask: 255, hitBox: { left: -57, top: -40, width: 81, height: 77 } },
  207: { sizeX: 1, sizeY: 1, hasCollisionMask: 63 },
  208: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -40, top: -11, width: 48, height: 54 } },
  209: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -39, top: -13, width: 49, height: 51 } },
  210: { sizeX: 1, sizeY: 1, hasCollisionMask: 63 },
  211: { sizeX: 1, sizeY: 1, hasCollisionMask: 63 },
  212: { sizeX: 1, sizeY: 1, hasCollisionMask: 63 },
  213: { sizeX: 1, sizeY: 1, hasCollisionMask: 63 },
  214: { sizeX: 1, sizeY: 1, hasCollisionMask: 63 },
  215: { sizeX: 1, sizeY: 1, hasCollisionMask: 63 },
  216: { sizeX: 1, sizeY: 1, hasCollisionMask: 63 },
  217: { sizeX: 1, sizeY: 1, hasCollisionMask: 63 },
  218: { sizeX: 3, sizeY: 9, hasCollisionMask: 57, blockMissile: true, blocksVis: true },
  219: { sizeX: 9, sizeY: 3, hasCollisionMask: 57, blockMissile: true, blocksVis: true },
  220: { sizeX: 3, sizeY: 3, hasCollisionMask: 57, blockMissile: true, blocksVis: true },
  221: { sizeX: 3, sizeY: 3, hasCollisionMask: 57, blockMissile: true, blocksVis: true },
  222: { sizeX: 2, sizeY: 2, hasCollisionMask: 63, hitBox: { left: -45, top: -61, width: 64, height: 101 } },
  223: { sizeX: 1, sizeY: 1, hasCollisionMask: 49, hitBox: { left: -57, top: -5, width: 78, height: 57 } },
  224: { sizeX: 1, sizeY: 1, hasCollisionMask: 49, hitBox: { left: -57, top: -5, width: 78, height: 57 } },
  225: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -53, top: -21, width: 71, height: 62 } },
  226: { sizeX: 3, sizeY: 4, hasCollisionMask: 255, hitBox: { left: -102, top: -90, width: 158, height: 138 } },
  227: { sizeX: 1, sizeY: 1, hasCollisionMask: 63 },
  228: { sizeX: 1, sizeY: 1, hasCollisionMask: 63 },
  229: { sizeX: 7, sizeY: 1, hasCollisionMask: 1, blockMissile: true, blocksVis: true, hitBox: { left: -41, top: -57, width: 88, height: 121 } },
  230: { sizeX: 1, sizeY: 7, hasCollisionMask: 1, blockMissile: true, blocksVis: true, hitBox: { left: -89, top: -60, width: 91, height: 120 } },
  231: { sizeX: 3, sizeY: 4, hasCollisionMask: 255, hitBox: { left: -67, top: -109, width: 109, height: 165 } },
  232: { sizeX: 4, sizeY: 4, hasCollisionMask: 255, hitBox: { left: -82, top: -101, width: 128, height: 151 } },
  233: { sizeX: 3, sizeY: 3, hasCollisionMask: 63, hitBox: { left: -83, top: -96, width: 123, height: 147 } },
  234: { sizeX: 1, sizeY: 1, hasCollisionMask: 63 },
  235: { sizeX: 1, sizeY: 1, hasCollisionMask: 63 },
  236: { sizeX: 3, sizeY: 3, hasCollisionMask: 63, hitBox: { left: -73, top: -50, width: 115, height: 102 } },
  237: { sizeX: 1, sizeY: 1, hitBox: { left: -94, top: -9, width: 150, height: 49 }, modeHitBoxes: { 1: { left: -105, top: -31, width: 169, height: 71 }, 2: { left: -97, top: -35, width: 153, height: 75 } } },
  238: { sizeX: 1, sizeY: 1, hitBox: { left: -97, top: -13, width: 152, height: 44 }, modeHitBoxes: { 1: { left: -105, top: -31, width: 169, height: 62 }, 2: { left: -97, top: -35, width: 153, height: 66 } } },
  239: { sizeX: 3, sizeY: 3, hasCollisionMask: 1, hitBox: { left: -57, top: -29, width: 93, height: 78 } },
  240: { sizeX: 1, sizeY: 3, hasCollisionMask: 63, hitBox: { left: -52, top: -22, width: 68, height: 60 } },
  241: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -38, top: -20, width: 44, height: 53 } },
  242: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -43, top: -14, width: 55, height: 51 } },
  243: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -45, top: -14, width: 54, height: 50 } },
  244: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -66, top: -25, width: 89, height: 71 } },
  245: { sizeX: 1, sizeY: 1 },
  246: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -52, top: -17, width: 72, height: 60 } },
  247: { sizeX: 4, sizeY: 2, hasCollisionMask: 63, hitBox: { left: -82, top: -39, width: 127, height: 102 } },
  248: { sizeX: 2, sizeY: 4, hasCollisionMask: 63, hitBox: { left: -95, top: -46, width: 126, height: 103 } },
  249: { sizeX: 3, sizeY: 3, hasCollisionMask: 63, hitBox: { left: -73, top: -50, width: 115, height: 102 } },
  250: { sizeX: 3, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -76, top: -33, width: 111, height: 73 } },
  251: { sizeX: 3, sizeY: 1, hasCollisionMask: 255 },
  252: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -66, top: -63, width: 104, height: 106 } },
  253: { sizeX: 0, sizeY: 0 },
  254: { sizeX: 0, sizeY: 0, hasCollisionMask: 4 },
  255: { sizeX: 0, sizeY: 0 },
  256: { sizeX: 3, sizeY: 1, hasCollisionMask: 63 },
  257: { sizeX: 3, sizeY: 1, hasCollisionMask: 63 },
  258: { sizeX: 3, sizeY: 1, hasCollisionMask: 63 },
  259: { sizeX: 1, sizeY: 1 },
  260: { sizeX: 1, sizeY: 1, hasCollisionMask: 15, hitBox: { left: -52, top: -82, width: 71, height: 125 } },
  261: { sizeX: 1, sizeY: 1 },
  262: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -76, top: -140, width: 120, height: 194 } },
  263: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -62, top: -45, width: 95, height: 90 } },
  264: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -55, top: -33, width: 79, height: 73 } },
  265: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -55, top: -33, width: 79, height: 73 } },
  266: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -69, top: -17, width: 103, height: 63 } },
  267: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -53, top: -26, width: 66, height: 67 } },
  268: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -58, top: -19, width: 78, height: 69 } },
  269: { sizeX: 0, sizeY: 0 },
  270: { sizeX: 3, sizeY: 3, hasCollisionMask: 1, hitBox: { left: -60, top: -23, width: 98, height: 87 } },
  271: { sizeX: 3, sizeY: 3, hasCollisionMask: 1, hitBox: { left: -74, top: -27, width: 101, height: 69 } },
  272: { sizeX: 3, sizeY: 3, hasCollisionMask: 1, hitBox: { left: -83, top: -47, width: 104, height: 101 } },
  273: { sizeX: 1, sizeY: 1, hasCollisionMask: 1 },
  274: { sizeX: 0, sizeY: 0, hitBox: { left: -31, top: 1, width: 32, height: 32 } },
  275: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -58, top: -43, width: 88, height: 92 } },
  276: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -58, top: -43, width: 88, height: 92 } },
  277: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -58, top: -43, width: 88, height: 92 } },
  278: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -64, top: -53, width: 88, height: 101 } },
  279: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -51, top: -38, width: 66, height: 77 } },
  280: { sizeX: 3, sizeY: 4, hasCollisionMask: 255, hitBox: { left: -50, top: -39, width: 65, height: 73 } },
  281: { sizeX: 3, sizeY: 4, hasCollisionMask: 255, hitBox: { left: -51, top: -39, width: 66, height: 74 } },
  282: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -68, top: -52, width: 106, height: 91 } },
  283: { sizeX: 1, sizeY: 1, hasCollisionMask: 1 },
  284: { sizeX: 3, sizeY: 5, hasCollisionMask: 255, hitBox: { left: -78, top: -73, width: 122, height: 131 } },
  285: { sizeX: 1, sizeY: 1, hasCollisionMask: 1 },
  286: { sizeX: 3, sizeY: 3, hasCollisionMask: 1 },
  287: { sizeX: 2, sizeY: 2, hasCollisionMask: 1 },
  288: { sizeX: 1, sizeY: 1, hitBox: { left: -95, top: -9, width: 149, height: 49 }, modeHitBoxes: { 1: { left: -105, top: -31, width: 169, height: 71 }, 2: { left: -97, top: -35, width: 153, height: 75 } } },
  289: { sizeX: 5, sizeY: 5, hasCollisionMask: 63, collisionSubst: true, left: -50, top: 0, width: 100, height: 80, hitBox: { left: -117, top: -132, width: 193, height: 226 } },
  290: { sizeX: 1, sizeY: 3, hasCollisionMask: 67, left: -20, top: -80, width: 40, height: 40, hitBox: { left: -56, top: -98, width: 63, height: 131 } },
  291: { sizeX: 3, sizeY: 1, hasCollisionMask: 67, left: -20, top: -80, width: 40, height: 40, hitBox: { left: -39, top: -93, width: 62, height: 130 } },
  292: { sizeX: 1, sizeY: 3, hasCollisionMask: 67, left: -20, top: -80, width: 40, height: 40, hitBox: { left: -59, top: -91, width: 61, height: 122 } },
  293: { sizeX: 3, sizeY: 1, hasCollisionMask: 67, left: -20, top: -80, width: 40, height: 40, hitBox: { left: -38, top: -87, width: 60, height: 121 } },
  294: { sizeX: 1, sizeY: 3, hasCollisionMask: 67, blockMissile: true, left: -20, top: -80, width: 40, height: 40, hitBox: { left: -55, top: -94, width: 57, height: 127 } },
  295: { sizeX: 3, sizeY: 1, hasCollisionMask: 67, blockMissile: true, left: -20, top: -80, width: 40, height: 40, hitBox: { left: -38, top: -91, width: 58, height: 128 } },
  296: { sizeX: 1, sizeY: 1, hasCollisionMask: 15 },
  297: { sizeX: 1, sizeY: 1, hasCollisionMask: 15 },
  298: { sizeX: 5, sizeY: 2, collisionSubst: true, left: -30, top: -80, width: 60, height: 80, hitBox: { left: -59, top: -140, width: 94, height: 180 } },
  299: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -71, top: -86, width: 114, height: 126 } },
  300: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -81, top: -51, width: 128, height: 107 } },
  301: { sizeX: 1, sizeY: 1, hasCollisionMask: 15, hitBox: { left: -58, top: -54, width: 78, height: 98 } },
  302: { sizeX: 1, sizeY: 1, hasCollisionMask: 15, hitBox: { left: -55, top: -50, width: 78, height: 90 } },
  303: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -68, top: -28, width: 102, height: 80 } },
  304: { sizeX: 1, sizeY: 1, hasCollisionMask: 254, collisionSubst: true, left: -30, top: -80, width: 60, height: 80, hitBox: { left: -104, top: -127, width: 161, height: 205 } },
  305: { sizeX: 1, sizeY: 1, hasCollisionMask: 254, collisionSubst: true, left: -30, top: -80, width: 60, height: 80, hitBox: { left: -80, top: -129, width: 159, height: 206 } },
  306: { sizeX: 1, sizeY: 1, hasCollisionMask: 254, collisionSubst: true, left: -30, top: -80, width: 60, height: 80, hitBox: { left: -80, top: -129, width: 159, height: 206 } },
  307: { sizeX: 1, sizeY: 1, hasCollisionMask: 14 },
  308: { sizeX: 1, sizeY: 1, hasCollisionMask: 14 },
  309: { sizeX: 1, sizeY: 1, hasCollisionMask: 14 },
  310: { sizeX: 1, sizeY: 1, hasCollisionMask: 14 },
  311: { sizeX: 1, sizeY: 1, hasCollisionMask: 14 },
  312: { sizeX: 1, sizeY: 1, hasCollisionMask: 14 },
  313: { sizeX: 1, sizeY: 1, hasCollisionMask: 14 },
  314: { sizeX: 1, sizeY: 1, hasCollisionMask: 15, hitBox: { left: -57, top: -67, width: 73, height: 122 } },
  315: { sizeX: 1, sizeY: 1, hasCollisionMask: 15, hitBox: { left: -43, top: -74, width: 73, height: 119 } },
  316: { sizeX: 1, sizeY: 1, hasCollisionMask: 15, hitBox: { left: -44, top: -64, width: 64, height: 116 } },
  317: { sizeX: 1, sizeY: 1, hasCollisionMask: 15, hitBox: { left: -53, top: -63, width: 71, height: 112 } },
  318: { sizeX: 1, sizeY: 7, hasCollisionMask: 1 },
  319: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -47, top: -36, width: 65, height: 65 } },
  320: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -47, top: -36, width: 65, height: 65 } },
  321: { sizeX: 0, sizeY: 0, hasCollisionMask: 255 },
  322: { sizeX: 3, sizeY: 3, hasCollisionMask: 7, hitBox: { left: -89, top: -45, width: 130, height: 96 } },
  323: { sizeX: 1, sizeY: 1, hitBox: { left: -94, top: -12, width: 148, height: 48 }, modeHitBoxes: { 1: { left: -105, top: -31, width: 169, height: 67 }, 2: { left: -97, top: -35, width: 153, height: 71 } } },
  324: { sizeX: 1, sizeY: 1, hitBox: { left: -87, top: -16, width: 143, height: 57 }, modeHitBoxes: { 1: { left: -87, top: -36, width: 143, height: 77 }, 2: { left: -87, top: -40, width: 143, height: 81 } } },
  325: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -75, top: -62, width: 121, height: 114 } },
  326: { sizeX: 3, sizeY: 1, hasCollisionMask: 15, hitBox: { left: -60, top: -21, width: 93, height: 69 } },
  327: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  328: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  329: { sizeX: 1, sizeY: 3, hasCollisionMask: 63, hitBox: { left: -55, top: -20, width: 69, height: 60 } },
  330: { sizeX: 1, sizeY: 3, hasCollisionMask: 63, hitBox: { left: -49, top: -17, width: 71, height: 52 } },
  331: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -47, top: -16, width: 55, height: 52 } },
  332: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -42, top: -14, width: 52, height: 46 } },
  333: { sizeX: 1, sizeY: 3, hasCollisionMask: 63, hitBox: { left: -52, top: -22, width: 68, height: 60 } },
  334: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -43, top: -14, width: 55, height: 51 } },
  335: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -38, top: -20, width: 44, height: 53 } },
  336: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -43, top: -14, width: 55, height: 51 } },
  337: { sizeX: 2, sizeY: 2, hasCollisionMask: 1, hitBox: { left: -47, top: -61, width: 62, height: 107 } },
  338: { sizeX: 3, sizeY: 3, hasCollisionMask: 1, hitBox: { left: -80, top: -147, width: 124, height: 195 } },
  339: { sizeX: 2, sizeY: 3, hasCollisionMask: 1, hitBox: { left: -71, top: -113, width: 102, height: 161 } },
  340: { sizeX: 2, sizeY: 3, hasCollisionMask: 1, hitBox: { left: -69, top: -69, width: 99, height: 120 } },
  341: { sizeX: 11, sizeY: 5, hasCollisionMask: 59 },
  342: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, collisionSubst: true, left: -40, top: -80, width: 80, height: 80, hitBox: { left: -105, top: -146, width: 179, height: 257 } },
  343: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -53, top: -23, width: 75, height: 64 } },
  344: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -53, top: -23, width: 75, height: 64 } },
  345: { sizeX: 0, sizeY: 0 },
  346: { sizeX: 0, sizeY: 0 },
  347: { sizeX: 0, sizeY: 0 },
  348: { sizeX: 0, sizeY: 0 },
  349: { sizeX: 0, sizeY: 0 },
  350: { sizeX: 0, sizeY: 0 },
  351: { sizeX: 0, sizeY: 0 },
  352: { sizeX: 0, sizeY: 0 },
  353: { sizeX: 0, sizeY: 0 },
  354: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -43, top: -21, width: 54, height: 54 } },
  355: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -43, top: -21, width: 54, height: 54 } },
  356: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -43, top: -21, width: 54, height: 54 } },
  357: { sizeX: 1, sizeY: 1, hasCollisionMask: 15, hitBox: { left: -45, top: -51, width: 57, height: 81 } },
  358: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, blockMissile: true, blocksVis: true },
  359: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, blockMissile: true, blocksVis: true },
  360: { sizeX: 2, sizeY: 2, hasCollisionMask: 63, hitBox: { left: -52, top: -22, width: 70, height: 59 } },
  361: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -60, top: -21, width: 93, height: 69 } },
  362: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -49, top: -12, width: 60, height: 50 } },
  363: { sizeX: 4, sizeY: 4, hasCollisionMask: 63, hitBox: { left: -52, top: -50, width: 63, height: 86 } },
  364: { sizeX: 2, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -75, top: -74, width: 101, height: 123 } },
  365: { sizeX: 5, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -78, top: -59, width: 134, height: 122 } },
  366: { sizeX: 5, sizeY: 5, hasCollisionMask: 255, hitBox: { left: -131, top: -44, width: 214, height: 119 } },
  367: { sizeX: 3, sizeY: 5, hasCollisionMask: 255, hitBox: { left: -86, top: -37, width: 151, height: 91 } },
  368: { sizeX: 0, sizeY: 0 },
  369: { sizeX: 0, sizeY: 0 },
  370: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  371: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  372: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -43, top: -35, width: 53, height: 67 } },
  373: { sizeX: 1, sizeY: 1 },
  374: { sizeX: 1, sizeY: 1 },
  375: { sizeX: 1, sizeY: 3, hasCollisionMask: 63 },
  376: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -91, top: -70, width: 145, height: 146 }, modeHitBoxes: { 1: { left: -91, top: -70, width: 149, height: 146 }, 2: { left: -91, top: -70, width: 149, height: 146 } } },
  377: { sizeX: 1, sizeY: 1, hitBox: { left: -87, top: -115, width: 143, height: 183 }, modeHitBoxes: { 1: { left: -129, top: -135, width: 228, height: 228 }, 2: { left: -85, top: -111, width: 139, height: 178 } } },
  378: { sizeX: 0, sizeY: 0 },
  379: { sizeX: 0, sizeY: 0 },
  380: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -59, top: -27, width: 101, height: 76 } },
  381: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -59, top: -27, width: 101, height: 76 } },
  382: { sizeX: 0, sizeY: 0 },
  383: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -50, top: -40, width: 121, height: 77 } },
  384: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -48, top: -42, width: 117, height: 85 } },
  385: { sizeX: 0, sizeY: 0 },
  386: { sizeX: 10, sizeY: 6, hasCollisionMask: 63, hitBox: { left: -120, top: -93, width: 208, height: 165 } },
  387: { sizeX: 1, sizeY: 3, hasCollisionMask: 63, hitBox: { left: -55, top: -30, width: 74, height: 69 } },
  388: { sizeX: 1, sizeY: 3, hasCollisionMask: 63, hitBox: { left: -67, top: -35, width: 92, height: 81 } },
  389: { sizeX: 3, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -49, top: -29, width: 74, height: 70 } },
  390: { sizeX: 1, sizeY: 2, hasCollisionMask: 63, hitBox: { left: -47, top: -18, width: 56, height: 53 } },
  391: { sizeX: 2, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -41, top: -18, width: 55, height: 53 } },
  392: { sizeX: 5, sizeY: 5, hasCollisionMask: 255, hitBox: { left: -99, top: -84, width: 163, height: 147 } },
  393: { sizeX: 5, sizeY: 5, hasCollisionMask: 255, hitBox: { left: -99, top: -84, width: 163, height: 147 } },
  394: { sizeX: 5, sizeY: 5, hasCollisionMask: 255, hitBox: { left: -99, top: -82, width: 163, height: 153 } },
  395: { sizeX: 5, sizeY: 5, hasCollisionMask: 255, hitBox: { left: -99, top: -82, width: 163, height: 153 } },
  396: { sizeX: 5, sizeY: 5, hasCollisionMask: 255, hitBox: { left: -99, top: -84, width: 163, height: 147 } },
  397: { sizeX: 2, sizeY: 2, hasCollisionMask: 63, hitBox: { left: -46, top: -24, width: 59, height: 62 } },
  398: { sizeX: 1, sizeY: 1, hitBox: { left: -95, top: -11, width: 148, height: 49 }, modeHitBoxes: { 1: { left: -105, top: -31, width: 169, height: 69 }, 2: { left: -97, top: -35, width: 153, height: 73 } } },
  399: { sizeX: 0, sizeY: 0, hasCollisionMask: 255 },
  400: { sizeX: 2, sizeY: 2, hasCollisionMask: 1 },
  401: { sizeX: 0, sizeY: 0 },
  402: { sizeX: 1, sizeY: 1, hitBox: { left: -61, top: -14, width: 91, height: 55 }, modeHitBoxes: { 1: { left: -64, top: -31, width: 97, height: 72 }, 2: { left: -61, top: -35, width: 91, height: 76 } } },
  403: { sizeX: 2, sizeY: 2, hasCollisionMask: 1 },
  404: { sizeX: 3, sizeY: 3, hasCollisionMask: 1, hitBox: { left: -62, top: -54, width: 94, height: 95 } },
  405: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -43, top: -21, width: 54, height: 54 } },
  406: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -43, top: -21, width: 54, height: 54 } },
  407: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -43, top: -21, width: 54, height: 54 } },
  408: { sizeX: 2, sizeY: 2, hasCollisionMask: 1 },
  409: { sizeX: 1, sizeY: 1, hasCollisionMask: 1 },
  410: { sizeX: 1, sizeY: 1, hasCollisionMask: 15, hitBox: { left: -57, top: -62, width: 73, height: 88 } },
  411: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  412: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  413: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -50, top: -22, width: 70, height: 66 } },
  414: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -60, top: -83, width: 91, height: 125 } },
  415: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -60, top: -135, width: 89, height: 178 } },
  416: { sizeX: 1, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -70, top: -53, width: 105, height: 100 } },
  417: { sizeX: 3, sizeY: 3, hasCollisionMask: 7 },
  418: { sizeX: 1, sizeY: 1, hasCollisionMask: 255, hitBox: { left: -43, top: -45, width: 54, height: 76 } },
  419: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -63, top: -44, width: 86, height: 88 } },
  420: { sizeX: 1, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -63, top: -44, width: 86, height: 88 } },
  421: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -60, top: -135, width: 89, height: 178 } },
  422: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -83, top: -39, width: 127, height: 99 } },
  423: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -81, top: -40, width: 127, height: 99 } },
  424: { sizeX: 2, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -81, top: -50, width: 127, height: 110 } },
  425: { sizeX: 3, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -81, top: -40, width: 127, height: 99 } },
  426: { sizeX: 4, sizeY: 4, hasCollisionMask: 7, hitBox: { left: -80, top: -91, width: 135, height: 147 } },
  427: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -114, top: -138, width: 179, height: 193 } },
  428: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -60, top: -83, width: 91, height: 125 } },
  429: { sizeX: 5, sizeY: 5, hitBox: { left: -80, top: -32, width: 122, height: 90 }, modeHitBoxes: { 1: { left: -91, top: -59, width: 143, height: 117 }, 2: { left: -86, top: -58, width: 130, height: 116 } } },
  430: { sizeX: 1, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -51, top: -22, width: 70, height: 67 } },
  431: { sizeX: 2, sizeY: 1, hasCollisionMask: 255, hitBox: { left: -56, top: -44, width: 88, height: 89 } },
  432: { sizeX: 1, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -54, top: -28, width: 70, height: 67 } },
  433: { sizeX: 2, sizeY: 1, hasCollisionMask: 255, hitBox: { left: -50, top: -27, width: 70, height: 67 } },
  434: { sizeX: 2, sizeY: 2, hasCollisionMask: 255 },
  435: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  436: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  437: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  438: { sizeX: 2, sizeY: 2, hasCollisionMask: 255 },
  439: { sizeX: 3, sizeY: 4, hasCollisionMask: 255 },
  440: { sizeX: 3, sizeY: 1, hasCollisionMask: 7 },
  441: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  442: { sizeX: 1, sizeY: 1, hasCollisionMask: 254 },
  443: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -38, top: -33, width: 44, height: 64 } },
  444: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -46, top: -33, width: 55, height: 61 } },
  445: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -33, top: -20, width: 53, height: 56 } },
  446: { sizeX: 5, sizeY: 2, hasCollisionMask: 7 },
  447: { sizeX: 4, sizeY: 4, hasCollisionMask: 7 },
  448: { sizeX: 5, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -79, top: -76, width: 156, height: 136 } },
  449: { sizeX: 1, sizeY: 7, hasCollisionMask: 1, hitBox: { left: -96, top: -156, width: 146, height: 213 } },
  450: { sizeX: 5, sizeY: 5, hasCollisionMask: 7 },
  451: { sizeX: 3, sizeY: 1, hasCollisionMask: 7 },
  452: { sizeX: 1, sizeY: 1, hasCollisionMask: 15 },
  453: { sizeX: 1, sizeY: 1, hasCollisionMask: 15 },
  454: { sizeX: 1, sizeY: 3, hasCollisionMask: 1, hitBox: { left: -63, top: -44, width: 86, height: 88 } },
  455: { sizeX: 2, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -50, top: -31, width: 73, height: 75 } },
  456: { sizeX: 3, sizeY: 1, hasCollisionMask: 7 },
  457: { sizeX: 3, sizeY: 1, hasCollisionMask: 7 },
  458: { sizeX: 2, sizeY: 3, hasCollisionMask: 7 },
  459: { sizeX: 1, sizeY: 1 },
  460: { sizeX: 1, sizeY: 1 },
  461: { sizeX: 1, sizeY: 1 },
  462: { sizeX: 1, sizeY: 1 },
  463: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -46, top: -66, width: 63, height: 107 } },
  464: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -52, top: -49, width: 72, height: 87 } },
  465: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -52, top: -49, width: 72, height: 87 } },
  466: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -45, top: -65, width: 53, height: 98 } },
  467: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -39, top: -22, width: 48, height: 56 } },
  468: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -39, top: -17, width: 46, height: 52 } },
  469: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -44, top: -17, width: 55, height: 51 } },
  470: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -41, top: -41, width: 48, height: 73 } },
  471: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -41, top: -30, width: 50, height: 62 } },
  472: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -66, top: -136, width: 103, height: 182 } },
  473: { sizeX: 3, sizeY: 3, hasCollisionMask: 64 },
  474: { sizeX: 3, sizeY: 3, hasCollisionMask: 15, hitBox: { left: -47, top: -119, width: 71, height: 152 }, modeHitBoxes: { 1: { left: -92, top: -119, width: 143, height: 165 }, 2: { left: -47, top: -119, width: 71, height: 151 } } },
  475: { sizeX: 3, sizeY: 3, hasCollisionMask: 15, hitBox: { left: -62, top: -113, width: 98, height: 140 }, modeHitBoxes: { 1: { left: -92, top: -113, width: 143, height: 165 }, 2: { left: -62, top: -113, width: 99, height: 139 } } },
  476: { sizeX: 3, sizeY: 3, hasCollisionMask: 15, hitBox: { left: -67, top: -102, width: 84, height: 129 }, modeHitBoxes: { 1: { left: -93, top: -111, width: 141, height: 155 } } },
  477: { sizeX: 2, sizeY: 3, hasCollisionMask: 63, hitBox: { left: -83, top: -17, width: 122, height: 76 } },
  478: { sizeX: 0, sizeY: 0 },
  479: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -50, top: -76, width: 59, height: 113 } },
  480: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  481: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  482: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  483: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -66, top: -81, width: 104, height: 133 } },
  484: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -68, top: -78, width: 104, height: 132 } },
  485: { sizeX: 5, sizeY: 3, hasCollisionMask: 63, hitBox: { left: -94, top: -84, width: 175, height: 149 } },
  486: { sizeX: 5, sizeY: 3, hasCollisionMask: 63, hitBox: { left: -85, top: -66, width: 156, height: 130 } },
  487: { sizeX: 5, sizeY: 3, hasCollisionMask: 63, hitBox: { left: -76, top: -83, width: 157, height: 152 } },
  488: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -67, top: -119, width: 105, height: 161 } },
  489: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  490: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  491: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -83, top: -39, width: 127, height: 99 } },
  492: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -81, top: -40, width: 127, height: 99 } },
  493: { sizeX: 4, sizeY: 4, hasCollisionMask: 7, hitBox: { left: -80, top: -91, width: 135, height: 147 } },
  494: { sizeX: 5, sizeY: 5, hitBox: { left: -94, top: -39, width: 145, height: 98 }, modeHitBoxes: { 1: { left: -99, top: -63, width: 155, height: 122 }, 2: { left: -94, top: -62, width: 145, height: 121 } } },
  495: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -60, top: -135, width: 89, height: 178 } },
  496: { sizeX: 5, sizeY: 5, hitBox: { left: -78, top: -20, width: 109, height: 77 }, modeHitBoxes: { 1: { left: -85, top: -46, width: 123, height: 103 }, 2: { left: -78, top: -45, width: 109, height: 102 } } },
  497: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -114, top: -138, width: 179, height: 193 } },
  498: { sizeX: 3, sizeY: 3, hasCollisionMask: 7, hitBox: { left: -78, top: -87, width: 126, height: 136 } },
  499: { sizeX: 2, sizeY: 4, hasCollisionMask: 255, hitBox: { left: -86, top: -105, width: 135, height: 162 } },
  500: { sizeX: 2, sizeY: 2, hasCollisionMask: 63, hitBox: { left: -70, top: -53, width: 105, height: 100 } },
  501: { sizeX: 1, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -63, top: -44, width: 95, height: 88 } },
  502: { sizeX: 3, sizeY: 1, hasCollisionMask: 255, hitBox: { left: -56, top: -44, width: 88, height: 89 } },
  503: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -73, top: -120, width: 112, height: 174 } },
  504: { sizeX: 2, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -63, top: -44, width: 95, height: 88 } },
  505: { sizeX: 3, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -63, top: -44, width: 95, height: 88 } },
  506: { sizeX: 5, sizeY: 2, hasCollisionMask: 7 },
  507: { sizeX: 4, sizeY: 4, hasCollisionMask: 7 },
  508: { sizeX: 1, sizeY: 7, hasCollisionMask: 1, hitBox: { left: -68, top: -77, width: 97, height: 121 } },
  509: { sizeX: 4, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -73, top: -120, width: 112, height: 174 } },
  510: { sizeX: 5, sizeY: 5, hasCollisionMask: 7 },
  511: { sizeX: 5, sizeY: 5, hitBox: { left: -78, top: -20, width: 109, height: 77 }, modeHitBoxes: { 1: { left: -85, top: -46, width: 123, height: 103 }, 2: { left: -78, top: -45, width: 109, height: 102 } } },
  512: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -63, top: -113, width: 96, height: 160 } },
  513: { sizeX: 4, sizeY: 4, hasCollisionMask: 7, hitBox: { left: -77, top: -60, width: 123, height: 99 } },
  514: { sizeX: 1, sizeY: 3, hasCollisionMask: 255 },
  515: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  516: { sizeX: 1, sizeY: 1, hasCollisionMask: 63, hitBox: { left: -44, top: -54, width: 57, height: 93 } },
  517: { sizeX: 2, sizeY: 2, hasCollisionMask: 63, hitBox: { left: -55, top: -64, width: 77, height: 109 } },
  518: { sizeX: 3, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -59, top: -33, width: 91, height: 76 } },
  519: { sizeX: 3, sizeY: 3, hasCollisionMask: 7, hitBox: { left: -63, top: -54, width: 96, height: 92 } },
  520: { sizeX: 2, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -65, top: -115, width: 92, height: 159 } },
  521: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -74, top: -47, width: 120, height: 94 } },
  522: { sizeX: 3, sizeY: 3, hasCollisionMask: 255, hitBox: { left: -74, top: -47, width: 120, height: 94 } },
  523: { sizeX: 0, sizeY: 0, hasCollisionMask: 255 },
  524: { sizeX: 3, sizeY: 5, hasCollisionMask: 63, hitBox: { left: -114, top: -89, width: 173, height: 150 } },
  525: { sizeX: 3, sizeY: 5, hasCollisionMask: 63, hitBox: { left: -109, top: -66, width: 158, height: 130 } },
  526: { sizeX: 3, sizeY: 5, hasCollisionMask: 63, hitBox: { left: -102, top: -88, width: 156, height: 152 } },
  527: { sizeX: 1, sizeY: 1 },
  528: { sizeX: 1, sizeY: 1 },
  529: { sizeX: 5, sizeY: 3, hasCollisionMask: 63, hitBox: { left: -93, top: -85, width: 175, height: 149 } },
  530: { sizeX: 3, sizeY: 5, hasCollisionMask: 63, hitBox: { left: -115, top: -89, width: 173, height: 150 } },
  531: { sizeX: 5, sizeY: 3, hasCollisionMask: 63, hitBox: { left: -85, top: -67, width: 156, height: 130 } },
  532: { sizeX: 3, sizeY: 5, hasCollisionMask: 63, hitBox: { left: -109, top: -65, width: 158, height: 130 } },
  533: { sizeX: 5, sizeY: 3, hasCollisionMask: 63, hitBox: { left: -83, top: -87, width: 157, height: 152 } },
  534: { sizeX: 3, sizeY: 5, hasCollisionMask: 63, hitBox: { left: -106, top: -94, width: 156, height: 152 } },
  535: { sizeX: 3, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -59, top: -32, width: 91, height: 76 } },
  536: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  537: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  538: { sizeX: 2, sizeY: 5, hasCollisionMask: 255 },
  539: { sizeX: 5, sizeY: 5, hitBox: { left: -94, top: -13, width: 156, height: 45 }, modeHitBoxes: { 1: { left: -103, top: -40, width: 174, height: 72 }, 2: { left: -94, top: -39, width: 156, height: 71 } } },
  540: { sizeX: 2, sizeY: 2, hasCollisionMask: 63, hitBox: { left: -40, top: -126, width: 57, height: 164 } },
  541: { sizeX: 5, sizeY: 3, hasCollisionMask: 63, hitBox: { left: -96, top: -37, width: 171, height: 108 } },
  542: { sizeX: 0, sizeY: 0 },
  543: { sizeX: 0, sizeY: 0 },
  544: { sizeX: 3, sizeY: 5, hasCollisionMask: 63, hitBox: { left: -106, top: -39, width: 174, height: 108 } },
  545: { sizeX: 2, sizeY: 2, hasCollisionMask: 63, hitBox: { left: -56, top: -76, width: 91, height: 120 } },
  546: { sizeX: 1, sizeY: 1, hasCollisionMask: 255, hitBox: { left: -56, top: -61, width: 86, height: 107 } },
  547: { sizeX: 5, sizeY: 8, hasCollisionMask: 1, collisionSubst: true, left: -30, top: -100, width: 70, height: 100, hitBox: { left: -43, top: -114, width: 89, height: 167 } },
  548: { sizeX: 2, sizeY: 1, hasCollisionMask: 255, hitBox: { left: -63, top: -80, width: 96, height: 128 } },
  549: { sizeX: 1, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -66, top: -92, width: 95, height: 142 } },
  550: { sizeX: 2, sizeY: 1, hasCollisionMask: 255, hitBox: { left: -59, top: -67, width: 90, height: 122 } },
  551: { sizeX: 1, sizeY: 2, hasCollisionMask: 255, hitBox: { left: -63, top: -64, width: 91, height: 121 } },
  552: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  553: { sizeX: 3, sizeY: 4, hasCollisionMask: 255 },
  554: { sizeX: 3, sizeY: 4, hasCollisionMask: 255 },
  555: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  556: { sizeX: 2, sizeY: 2, hasCollisionMask: 63, hitBox: { left: -70, top: -79, width: 87, height: 121 } },
  557: { sizeX: 0, sizeY: 0 },
  558: { sizeX: 1, sizeY: 1, hasCollisionMask: 1, hitBox: { left: -54, top: -59, width: 81, height: 102 } },
  559: { sizeX: 3, sizeY: 3, hasCollisionMask: 255 },
  560: { sizeX: 1, sizeY: 1, hasCollisionMask: 255 },
  561: { sizeX: 0, sizeY: 0 },
  562: { sizeX: 5, sizeY: 5, hasCollisionMask: 1 },
  563: { sizeX: 1, sizeY: 1, hasCollisionMask: 7, hitBox: { left: -129, top: -156, width: 212, height: 247 } },
  564: { sizeX: 0, sizeY: 0, hasCollisionMask: 240, hitBox: { left: -101, top: -84, width: 92, height: 132 }, modeHitBoxes: { 1: { left: -101, top: -88, width: 92, height: 136 }, 2: { left: -101, top: -86, width: 92, height: 134 } } },
  565: { sizeX: 0, sizeY: 0, hasCollisionMask: 246, hitBox: { left: -129, top: -135, width: 228, height: 228 }, modeHitBoxes: { 2: { left: -85, top: -111, width: 139, height: 178 } } },
  566: { sizeX: 0, sizeY: 0, hasCollisionMask: 247, hitBox: { left: -129, top: -135, width: 228, height: 228 }, modeHitBoxes: { 2: { left: -85, top: -111, width: 139, height: 178 } } },
  567: { sizeX: 0, sizeY: 0, hasCollisionMask: 255 },
  568: { sizeX: 2, sizeY: 2, hasCollisionMask: 255 },
  569: { sizeX: 1, sizeY: 1, hasCollisionMask: 6, hitBox: { left: -129, top: -156, width: 212, height: 247 } },
  570: { sizeX: 1, sizeY: 1, hasCollisionMask: 1 },
  571: { sizeX: 5, sizeY: 2, hasCollisionMask: 1 },
  572: { sizeX: 2, sizeY: 5, hasCollisionMask: 1 },
}

for (const [idStr, geom] of Object.entries(OBJECT_GEOMETRY_113C)) {
  const id = Number(idStr)
  const existing = RAW_CANONICAL_113C_OBJECTS[id]
  if (existing) {
    RAW_CANONICAL_113C_OBJECTS[id] = Object.freeze({ ...existing, ...geom })
  }
}

for (const [idStr, override] of Object.entries(OBJECT_ANIM_OVERRIDES_113C)) {
  const id = Number(idStr)
  const existing = RAW_CANONICAL_113C_OBJECTS[id]
  if (existing) {
    RAW_CANONICAL_113C_OBJECTS[id] = Object.freeze({ ...existing, ...override })
  }
}

export const CANONICAL_113C_OBJECTS: Readonly<Record<number, CanonicalObjectMeta>> = Object.freeze(
  RAW_CANONICAL_113C_OBJECTS,
)

export const WAYPOINT_CLASS_IDS_113C: ReadonlySet<number> = new Set([
  119, 145, 156, 157, 237, 238, 288, 323, 324, 398, 402, 429, 494, 496, 511, 539,
])

/**
 * Returns `true` if a 1.13c object (`classId`) is selectable/hoverable in animation `mode` (`0..7`).
 * Per `D2Common.dll` / `Objects.txt` `nSelectable[mode]`:
 * - Breakable objects (`Barrel`, `Urn`, `LargeUrn`, `Casket`, `Chest`) and Shrines have `Selectable0 = 1`
 *   in neutral mode (`0 = NU`) and `Selectable1 = 0, Selectable2 = 0` once opened/smashed/operated (`1 = OP, 2 = ON`).
 * - Decorative objects (`Dummy`, torches, braziers, bonfires) have `selectableMask = 0`.
 * - Town Portals / Permanent Portals (`classId 59, 60`) are selectable in `NU`, `OP`, and `ON`.
 * - Waypoints (`WAYPOINT_CLASS_IDS_113C`) are selectable across `NU (0)`, `OP (1)`, and `ON (2)`, and any
 *   object in transient `OP (1)` mode whose `ON (2)` bit is set in `selectableMask` remains selectable.
 */
export function isObjectSelectableInMode(classId: number, mode = 0): boolean {
  if (
    classId === 59 ||
    classId === 60 ||
    classId === 342 ||
    classId === 563 ||
    classId === 565 ||
    classId === 566 ||
    classId === 569
  ) {
    return true
  }
  const m = Math.max(0, Math.min(7, Math.floor(mode || 0)))
  if (WAYPOINT_CLASS_IDS_113C.has(classId) && (m === 0 || m === 1 || m === 2)) {
    return true
  }
  const meta = CANONICAL_113C_OBJECTS[classId]
  if (!meta) {
    return false
  }
  if ((meta.selectableMask & (1 << m)) !== 0) {
    return true
  }
  if (m === 1 && (meta.selectableMask & (1 << 2)) !== 0) {
    return true
  }
  // Objects with FrameCnt0 = 0 (no NU frames, e.g. LastPortal 565, Zoo 566, Drehya 558)
  // that spawn in mode 0 before server/client mode promotion remain selectable if OP/ON is selectable.
  if (m === 0 && meta.frameCnt?.[0] === 0 && (meta.selectableMask & 0b110) !== 0) {
    return true
  }
  return false
}

/**
 * Resolves the localized hover display name (`ENG` and `CHI`) for a 1.13c object (`classId`)
 * in animation `mode`, using `flags` / `interactType` (`S2C 0x51 AssignObject` byte 13)
 * to resolve specific shrine types (`Shrines.txt` `Code 1..22`).
 * Returns `undefined` when the object is not selectable in `mode`.
 */
export function resolveObjectDisplayName(
  classId: number,
  mode = 0,
  flags?: number,
  interactType?: number,
  areaId?: number,
): LocalizedObjectName | undefined {
  if (!isObjectSelectableInMode(classId, mode)) {
    return undefined
  }
  if (classId === 342) {
    return {
      name: 'Portal to The Pandemonium Fortress',
      nameZh: '傳送到 群魔堡壘',
    }
  }
  // D2Client.dll 0x6fb55d90 (`UNITS_GetUnitHoverString` @ 0x6fb55dcc..0x6fb55e78):
  // Objects with `OpenWarp = 1` in `Objects.txt` (`74, 194, 195, 386`) display their
  // destination level's `LevelWarp` string when in `mode === 2` (`OBJ_MODE_OPENED` / `ON`).
  if (mode === 2) {
    if (classId === 386) {
      return {
        name: 'To The Durance of Hate Level 1',
        nameZh: '前往憎恨的囚牢第一層',
      }
    }
    if (classId === 74) {
      return {
        name: 'To The Sewers Level 1',
        nameZh: '前往下水道第一層',
      }
    }
    if (classId === 194) {
      if (areaId === 81) {
        return {
          name: 'To The Forgotten Reliquary',
          nameZh: '前往被遺忘的聖物室',
        }
      }
      if (areaId === 82) {
        return {
          name: 'To The Ruined Fane',
          nameZh: '前往荒廢的寺院',
        }
      }
      return {
        name: 'To The Ruined Temple',
        nameZh: '前往殘破的神殿',
      }
    }
    if (classId === 195) {
      if (areaId === 81) {
        return {
          name: 'To The Forgotten Temple',
          nameZh: '前往被遺忘的神殿',
        }
      }
      if (areaId === 82) {
        return {
          name: 'To The Disused Reliquary',
          nameZh: '前往被遺棄的聖物室',
        }
      }
      return {
        name: 'To The Disused Fane',
        nameZh: '前往廢棄的寺院',
      }
    }
  }
  const meta = CANONICAL_113C_OBJECTS[classId]
  if (!meta) {
    return undefined
  }
  if (meta.selectableMask === 0 || classId === 625 || meta.nameEn?.toLowerCase() === 'an evil force') {
    return undefined
  }
  if (meta.isShrine) {
    const shrineCode = interactType !== undefined && interactType > 0 ? interactType : flags
    if (shrineCode !== undefined && shrineCode >= 1 && shrineCode <= 22) {
      return CANONICAL_113C_SHRINES[shrineCode]
    }
    if (meta.parm0 === 1) {
      return CANONICAL_113C_SHRINES[2]
    }
    if (meta.parm0 === 2) {
      return CANONICAL_113C_SHRINES[3]
    }
    if (meta.nameEn && meta.nameEn.toLowerCase() !== "an evil force") {
      return { name: meta.nameEn, nameZh: meta.nameZh || "神殿" }
    }
    return CANONICAL_113C_SHRINES[0]
  }
  if (!meta.nameEn || meta.nameEn.toLowerCase() === "an evil force") {
    return undefined
  }
  return {
    name: meta.nameEn,
    nameZh: meta.nameZh || meta.nameEn,
  }
}

export const resolveObjectName = resolveObjectDisplayName

export interface ShrineOverlayPair113c {
  readonly icon: string
  readonly shimmer: 'shrine_shimmer00' | 'shrine_shimmer01'
}

/**
 * Canonical 1.13c `D2Client.dll @ 0x6fb82f60` (23-entry shrine client table, 20 bytes/entry)
 * & `0x6fad5950` (`ObjMode0` shrine overlay init):
 * ONLY the 10 duration Booster shrines (`Code 6..15`) attach overhead overlays (`nOverlay1` + `nOverlay2`).
 * `Code 0..5` (None / Recharge, including `Code = 3` Mana Shrine / Mana Well) and `Code 16..22`
 * (Magic, including `Code = 19` Fire Shrine, `20` Monster, `21` Exploding, `22` Poison) have
 * `pfnInit = NULL, nOverlay1 = -1, nOverlay2 = -1` and NEVER display an overhead icon.
 */
export const SHRINE_CODE_TO_OVERLAYS_113C: Readonly<Record<number, ShrineOverlayPair113c>> = Object.freeze({
  6: { icon: 'shrine_armor', shimmer: 'shrine_shimmer00' }, // Armor Shrine (nOverlay1=59, nOverlay2=57)
  7: { icon: 'shrine_combat', shimmer: 'shrine_shimmer00' }, // Combat Shrine (nOverlay1=60, nOverlay2=57)
  8: { icon: 'shrine_resist_fire', shimmer: 'shrine_shimmer00' }, // Resist Fire Shrine (nOverlay1=62, nOverlay2=57)
  9: { icon: 'shrine_resist_cold', shimmer: 'shrine_shimmer01' }, // Resist Cold Shrine (nOverlay1=63, nOverlay2=58)
  10: { icon: 'shrine_resist_lightning', shimmer: 'shrine_shimmer01' }, // Resist Lightning Shrine (nOverlay1=61, nOverlay2=58)
  11: { icon: 'shrine_resist_poison', shimmer: 'shrine_shimmer01' }, // Resist Poison Shrine (nOverlay1=64, nOverlay2=58)
  12: { icon: 'shrine_skill', shimmer: 'shrine_shimmer00' }, // Skill Shrine (nOverlay1=65, nOverlay2=57)
  13: { icon: 'shrine_mana_regen', shimmer: 'shrine_shimmer01' }, // Mana Recharge Shrine (nOverlay1=66, nOverlay2=58)
  14: { icon: 'shrine_stamina', shimmer: 'shrine_shimmer01' }, // Stamina Shrine (nOverlay1=67, nOverlay2=58)
  15: { icon: 'shrine_experience', shimmer: 'shrine_shimmer00' }, // Experience Shrine (nOverlay1=68, nOverlay2=57)
})

/**
 * Canonical 1.13c `Shrines.txt` `Code` (`6..15`) -> primary overhead shrine icon overlay token (`nOverlay1`).
 * `Code 0..5` and `Code 16..22` strictly have no overhead icon (`nOverlay1 = -1`).
 */
export const SHRINE_CODE_TO_OVERLAY_TOKEN: Readonly<Record<number, string>> = Object.freeze({
  6: 'shrine_armor',
  7: 'shrine_combat',
  8: 'shrine_resist_fire',
  9: 'shrine_resist_cold',
  10: 'shrine_resist_lightning',
  11: 'shrine_resist_poison',
  12: 'shrine_skill',
  13: 'shrine_mana_regen',
  14: 'shrine_stamina',
  15: 'shrine_experience',
})

/**
 * Resolves the exact 1.13c dual-layer `{ icon, shimmer }` overhead overlay pair per
 * `D2Client.dll @ 0x6fb82f60` & `0x6fad5950` for an unactivated (`mode === 0`) shrine object.
 * Strictly returns `undefined` for `Code 0..5`, `Code 16..22`, Mana Wells (`Parm0 = 2`),
 * non-shrine objects, and missing/invalid codes (`< 6` or `> 15`). Never guesses by name or `parm0`.
 */
export function resolveShrineOverlays113c(
  classId: number,
  interactType?: number,
  flags?: number,
): ShrineOverlayPair113c | undefined {
  const meta = CANONICAL_113C_OBJECTS[classId]
  if (!meta?.isShrine) return undefined
  if (meta.selectableMask === 0 || classId === 625 || meta.nameEn?.toLowerCase() === 'an evil force') {
    return undefined
  }
  const rawCode = interactType !== undefined && interactType > 0 ? interactType : flags
  if (rawCode === undefined || rawCode < 6 || rawCode > 15) {
    return undefined
  }
  return SHRINE_CODE_TO_OVERLAYS_113C[rawCode]
}

/**
 * Resolves the primary overhead icon overlay token (`nOverlay1`) to render above an unactivated
 * (`mode === 0`) shrine object per 1.13c `D2Client.dll @ 0x6fb82f60` (`Code 6..15` only).
 * Zero name-guessing, zero `parm0` fallbacks, and zero default `'shrine_shimmer00'` fallback.
 */
export function resolveShrineOverlayToken(
  classId: number,
  interactType?: number,
  flags?: number,
  _resolvedName?: string,
): string | undefined {
  return resolveShrineOverlays113c(classId, interactType, flags)?.icon
}

/**
 * 1.13c `D2Common.dll` `#10594` (`0x6fd81000`, `UNITS_IsObjectInInteractRange`):
 * Checks whether an actor at subtile `(unitX, unitY)` with `unitSizeX` (`2` for players)
 * is within the canonical object interaction range of an object (`classId`) at `(objX, objY)`.
 *
 * Used identically by `D2Client.dll` (`0x6facab9a` on left-click `UNIT_OBJECT`) and
 * `D2Game.dll` (`0x6fcf0251` in `SUNIT_InteractWithObject` and `0x6fc8a765` in `OBJECTS_OperateObject`).
 */
export function isObjectInInteractRange113c(
  unitX: number,
  unitY: number,
  unitSizeX: number,
  objX: number,
  objY: number,
  classId: number,
): boolean {
  const ux = Math.round(unitX)
  const uy = Math.round(unitY)
  const ox = Math.round(objX)
  const oy = Math.round(objY)
  if (ux === ox && uy === oy) {
    return true
  }
  const meta = CANONICAL_113C_OBJECTS[classId]
  const rawSizeX = meta?.sizeX ?? 0
  const rawSizeY = meta?.sizeY ?? 0
  // Selectable objects with SizeX/SizeY === 0 in Objects.txt (274, 564, 565 LastPortal, 566 Zoo)
  // use a minimum 1x1 footprint so adjacent walkable sub-tiles satisfy #10594 when center tile is blocked.
  const hasSelectableMode = Boolean(meta && meta.selectableMask !== 0)
  const objSizeX = hasSelectableMode ? Math.max(1, rawSizeX) : rawSizeX
  const objSizeY = hasSelectableMode ? Math.max(1, rawSizeY) : rawSizeY
  const minX = ox - Math.trunc(objSizeX / 2)
  const minY = oy - Math.trunc(objSizeY / 2)

  if (objSizeX < 1 || objSizeY < 1) {
    return ux >= minX - 1 && ux <= minX + 1 && uy >= minY - 1 && uy <= minY + 1
  }

  if (ux < minX - 2 || ux > minX + objSizeX + 2) {
    return false
  }
  if (uy < minY - 2 || uy > minY + objSizeY + 2) {
    return false
  }
  if (unitSizeX > 2) {
    return true
  }
  if (uy < minY - 1) {
    return ux >= minX - 1 && ux <= minX + objSizeX + 1
  }
  if (uy <= minY + objSizeY + 1) {
    return true
  }
  return ux >= minX - 1 && ux <= minX + objSizeX + 1
}

/**
 * 1.13c `D2Client.dll` `HitTest` (`0x6fb568e0` at `0x6fb56bd5..0x6fb56d43`):
 * Resolves the screen-space cursor hit-testing bounding box for a `UNIT_OBJECT` (`classId`, `mode`):
 * - Open doors (`IsDoor != 0` in modes `2, 4, 5`) and objects with `CollisionSubst != 0` (`+0x19d`)
 *   use `HitTestFixedBox` (`0x6fb55720`) against `(Left, Top, Width, Height)` from `Objects.txt`.
 * - All other objects (`CollisionSubst == 0`) use `GetUnitFrameBounds` (`0x6fb56730`):
 *   `(anchorX + xOffset - 12, anchorY + yOffset - 12, max(32, frameWidth + 24), max(32, frameHeight + 24))`.
 */
export function getObjectHitBox113c(
  classId: number,
  mode = 0,
): { left: number; top: number; width: number; height: number } {
  const meta = CANONICAL_113C_OBJECTS[classId]
  if (meta) {
    const m = Math.max(0, Math.min(7, Math.floor(mode || 0)))
    if (
      meta.isDoor &&
      (m === 2 || m === 4 || m === 5) &&
      meta.width !== undefined &&
      meta.width > 0 &&
      meta.height !== undefined &&
      meta.height > 0
    ) {
      return {
        left: meta.left ?? -20,
        top: meta.top ?? -80,
        width: meta.width,
        height: meta.height,
      }
    }
    if (
      meta.collisionSubst &&
      meta.width !== undefined &&
      meta.width > 0 &&
      meta.height !== undefined &&
      meta.height > 0
    ) {
      return {
        left: meta.left ?? -40,
        top: meta.top ?? -40,
        width: meta.width,
        height: meta.height,
      }
    }
    const modeHb = meta.modeHitBoxes?.[m]
    if (modeHb) {
      return {
        left: modeHb.left,
        top: modeHb.top,
        width: modeHb.width,
        height: modeHb.height,
      }
    }
    if (meta.hitBox) {
      return {
        left: meta.hitBox.left,
        top: meta.hitBox.top,
        width: meta.hitBox.width,
        height: meta.hitBox.height,
      }
    }
    if (meta.isDoor) {
      return {
        left: -36 + (meta.xOffset || 0),
        top: -64 + (meta.yOffset || 0),
        width: 72,
        height: 96,
      }
    }
  }
  return { left: -24, top: -48, width: 48, height: 48 }
}

/**
 * 1.13c Ground Truth: Objects.txt IDs that act as static map placeholders for dynamic NPCs (#900).
 * In Diablo II 1.13c, certain NPCs exist both as static DS1 map object presets (Objects.txt Token=ss)
 * with specific InitFunctions and as dynamic monster/NPC entities (MonPreset.txt).
 * When the server assigns an active dynamic NPC entity (0xAC AssignNPC), the static placeholder
 * object (0x51 AssignObject) must be suppressed/hidden to avoid duplicate rendering.
 *
 * - Object ID 121: Jerhyn outside palace (InitFn 18, Token=ss, DS1 ID 16 -> 121:JE:NU:d1:m)
 * - Object ID 122: Jerhyn inside palace (InitFn 19, Token=ss, DS1 ID 17 -> 122:JE:NU:d7:m)
 * - Object ID 378: Hratli at docks (Objects.txt InitFn 18, DS1 ID 109 -> 378:HR:NU:d1:m)
 * - Object ID 379: Hratli near town exit (Objects.txt InitFn 19, DS1 ID 110 -> 379:HR:NU:d7:m)
 * - Object ID 461: Qual-Kehk (Objects.txt InitFn 18, DS1 ID 55 -> 461:0J:NU:d1:m)
 * - Object ID 462: Qual-Kehk alternate (Objects.txt InitFn 19, DS1 ID 56 -> 462:0J:NU:d7:m)
 * - Object ID 542: Anya (Objects.txt InitFn 18, DS1 ID 125 -> 542:XR:NU:d1:m)
 * - Object ID 543: Anya alternate (Objects.txt InitFn 19, DS1 ID 126 -> 543:XR:NU:m)
 */
export const NPC_PLACEHOLDER_OBJECTS: Readonly<Record<number, number>> = Object.freeze({
  121: 201, // Jerhyn (Act 2 Lut Gholein)
  122: 201, // Jerhyn (Act 2 Lut Gholein)
  378: 253, // Hratli (Act 3 Kurast Docks)
  379: 253, // Hratli (Act 3 Kurast Docks)
  461: 515, // Qual-Kehk (Act 5 Harrogath)
  462: 515, // Qual-Kehk (Act 5 Harrogath)
  542: 512, // Anya (Act 5 Harrogath)
  543: 512, // Anya (Act 5 Harrogath)
})

export function getNpcPlaceholderHcIdx(objectClassId: number): number | undefined {
  return NPC_PLACEHOLDER_OBJECTS[objectClassId]
}

