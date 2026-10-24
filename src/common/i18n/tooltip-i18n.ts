/**
 * Diablo II Tooltip Internationalization & Localization (Issue #122).
 *
 * Supports three display modes:
 * - 'en': 100% 1.13c English original (default, 0 regression to existing tests)
 * - 'zh': 100% Simplified Chinese localized
 * - 'bilingual': Bilingual title (English + Chinese) with Chinese property lines
 */

import { resolveSkillInfo, CANONICAL_SKILL_TABS, CANONICAL_REANIMATE_MONSTERS } from '../skills/skills-data.ts'
import { CANONICAL_ENG_TBL_DICT, CANONICAL_CHI_TBL_DICT } from '../data/canonical-tbl-strings.ts'

export type TooltipLocale = 'en' | 'zh' | 'bilingual'

let currentTooltipLocale: TooltipLocale = 'en'

export function getTooltipLocale(): TooltipLocale {
  return currentTooltipLocale
}

export function setTooltipLocale(locale: TooltipLocale): void {
  currentTooltipLocale = locale
}

/**
 * Item Base Names, Uniques, Sets, and Set Items (1,340+ entries).
 */
export const ITEM_NAMES_ZH: Record<string, string> = {
  "Cap": "帽子",
  "Cap/hat": "帽子",
  "Skull Cap": "骷髅帽",
  "Helm": "头盔",
  "Full Helm": "高级头盔",
  "Great Helm": "卓越头盔",
  "Crown": "皇冠",
  "Mask": "面具",
  "Quilted Armor": "布甲",
  "Leather Armor": "皮甲",
  "Hard Leather Armor": "硬皮甲",
  "Studded Leather": "镶嵌甲",
  "Ring Mail": "锁环甲",
  "Scale Mail": "鳞甲",
  "Chain Mail": "锁子甲",
  "Breast Plate": "胸甲",
  "Splint Mail": "板甲",
  "Plate Mail": "铠甲",
  "Field Plate": "实战铠甲",
  "Gothic Plate": "哥德战甲",
  "Full Plate Mail": "高级战甲",
  "Ancient Armor": "古代装甲",
  "Light Plate": "轻型装甲",
  "Buckler": "圆盾",
  "Small Shield": "小盾牌",
  "Large Shield": "大盾牌",
  "Kite Shield": "轻盾",
  "Tower Shield": "塔盾",
  "Gothic Shield": "哥德盾牌",
  "Leather Gloves": "皮手套",
  "Gloves(L)": "皮手套",
  "Heavy Gloves": "重手套",
  "Chain Gloves": "锁链手套",
  "Bracers(M)": "锁链手套",
  "Light Gauntlets": "轻型铁手套",
  "Gauntlets": "铁手套",
  "Gaunlets(H)": "铁手套",
  "Boots": "皮靴",
  "Leather Boots": "皮靴",
  "Heavy Boots": "重靴",
  "Chain Boots": "锁链靴",
  "Light Plated Boots": "轻型金属靴",
  "Light Plate Boots": "轻型金属靴",
  "Greaves": "护胫",
  "Plate Boots": "护胫",
  "Sash": "饰带",
  "Sash(L)": "饰带",
  "Light Belt": "轻扣带",
  "Belt": "扣带",
  "Belt(M)": "扣带",
  "Heavy Belt": "重扣带",
  "Plated Belt": "金属扣带",
  "Girdle(H)": "金属扣带",
  "Bone Helm": "白骨头盔",
  "Bone Shield": "白骨盾牌",
  "Spiked Shield": "尖刺盾牌",
  "War Hat": "战帽",
  "Sallet": "轻便头盔",
  "Casque": "无颊头盔",
  "Basinet": "轻钢灰",
  "Winged Helm": "翼盔",
  "Grand Crown": "巨皇冠",
  "Death Mask": "死亡面具",
  "Ghost Armor": "鬼魂战甲",
  "Serpentskin Armor": "海蛇皮甲",
  "Demonhide Armor": "魔皮战甲",
  "Trellised Armor": "攀绕战甲",
  "Linked Mail": "连扣战甲",
  "Tigulated Mail": "提格莱特战甲",
  "Mesh Armor": "织网战甲",
  "Cuirass": "护胸甲",
  "Russet Armor": "罗瑟战甲",
  "Templar Coat": "圣堂武士外袍",
  "Sharktooth Armor": "鲨齿战甲",
  "Embossed Plate": "凸纹战甲",
  "Chaos Armor": "混沌战甲",
  "Ornate Plate": "华丽战甲",
  "Ornate Armor": "华丽战甲",
  "Mage Plate": "法师铠甲",
  "Defender": "防御盾",
  "Round Shield": "圆型盾",
  "Scutum": "鳞盾",
  "Dragon Shield": "龙盾",
  "Pavise": "大盾",
  "Ancient Shield": "古代之盾",
  "Demonhide Gloves": "魔皮手套",
  "Sharkskin Gloves": "鲨鱼皮套",
  "Heavy Bracers": "重型手镯",
  "Battle Gauntlets": "战场手套",
  "War Gauntlets": "巨战手套",
  "Demonhide Boots": "魔皮靴",
  "Sharkskin Boots": "鲨皮之靴",
  "Mesh Boots": "织网之靴",
  "Battle Boots": "战场之靴",
  "War Boots": "巨战之靴",
  "Demonhide Sash": "魔皮勋带",
  "Sharkskin Belt": "鲨皮腰带",
  "Mesh Belt": "织网腰带",
  "Battle Belt": "战场腰带",
  "War Belt": "巨战腰带",
  "Grim Helm": "残酷头盔",
  "Grim Shield": "冷酷之盾",
  "Barbed Shield": "倒刺护盾",
  "Diadem": "权冠",
  "Ward": "保护盾牌",
  "Hellspawn Skull": "地狱爪牙之骨",
  "Hand Axe": "手斧",
  "Axe": "斧",
  "Double Axe": "双刃斧",
  "Military Pick": "军用锹",
  "War Axe": "巨战斧",
  "Large Axe": "巨斧",
  "Broad Axe": "阔斧",
  "Battle Axe": "战斗斧",
  "Great Axe": "卓越之斧",
  "Giant Axe": "大斧",
  "Wand": "法杖",
  "Yew Wand": "紫杉之杖",
  "Bone Wand": "骨杖",
  "Grim Wand": "残酷之杖",
  "Club": "木棒",
  "Scepter": "权杖",
  "Grand Scepter": "雄伟权杖",
  "War Scepter": "巨战权杖",
  "Spiked Club": "狼牙棒",
  "Mace": "钉头锤",
  "Morning Star": "流星锤",
  "Flail": "连枷",
  "War Hammer": "巨战铁锤",
  "Maul": "大木棍",
  "Great Maul": "卓越巨棍",
  "Short Sword": "短剑",
  "Scimitar": "弯刀",
  "Sabre": "军刀",
  "Saber": "军刀",
  "Falchion": "弯形大刀",
  "Crystal Sword": "水晶剑",
  "Broad Sword": "阔剑",
  "Long Sword": "长剑",
  "War Sword": "巨战之剑",
  "Two-Handed Sword": "双手剑",
  "Claymore": "双刃大刀",
  "Giant Sword": "大剑",
  "Bastard Sword": "巨剑",
  "Flamberge": "双手饰剑",
  "Great Sword": "卓越之剑",
  "Dagger": "匕首",
  "Dirk": "长匕首",
  "Kris": "波形刀",
  "Kriss": "波形刀",
  "Blade": "短刀",
  "Throwing Knife": "飞刀",
  "Throwing Axe": "飞斧",
  "Balanced Knife": "平衡小刀",
  "Balanced Axe": "平衡斧",
  "Javelin": "标枪",
  "Pilum": "短镖枪",
  "Short Spear": "短矛",
  "Glaive": "大长刀",
  "Throwing Spear": "飞矛",
  "Spear": "长矛",
  "Trident": "三叉戟",
  "Brandistock": "叉",
  "Spetum": "大战戟",
  "Pike": "矛",
  "Bardiche": "大砍刀",
  "Voulge": "钩镰枪",
  "Scythe": "镰刀",
  "Poleaxe": "长柄战斧",
  "Halberd": "长戟",
  "War Scythe": "巨战镰刀",
  "Short Staff": "短棍",
  "Long Staff": "长棍",
  "Gnarled Staff": "多节棍",
  "Battle Staff": "战斗法杖",
  "War Staff": "巨战法杖",
  "Short Bow": "短弓",
  "Hunter's Bow": "猎弓",
  "Long Bow": "长弓",
  "Composite Bow": "组合弓",
  "Short Battle Bow": "短战斗弓",
  "Long Battle Bow": "长战斗弓",
  "Short War Bow": "短巨战弓",
  "Long War Bow": "长巨战弓",
  "Light Crossbow": "轻十字弓",
  "Crossbow": "十字弓",
  "Heavy Crossbow": "重十字弓",
  "Repeating Crossbow": "连射十字弓",
  "Rancid Gas Potion": "恶臭瓦斯药剂",
  "Oil Potion": "油",
  "Choking Gas Potion": "窒息瓦斯药剂",
  "Exploding Potion": "爆炸药剂",
  "Strangling Gas Potion": "勒颈瓦斯药剂",
  "Fulminating Potion": "猛爆性药剂",
  "Decoy Gidbinn": "吉得宾诱饵",
  "decoy dagger": "吉得宾诱饵",
  "The Gidbinn": "吉得宾",
  "Gidbinn": "吉得宾",
  "Wirt's Leg": "维特之脚",
  "Horadric Malus": "赫拉迪克.马勒斯",
  "Hell Forge Hammer": "地狱熔炉铁锤",
  "Hellforge Hammer": "地狱熔炉铁锤",
  "HellforgeHammer": "地狱熔炉铁锤",
  "Horadric Staff": "赫拉迪克法杖",
  "The Horadric Staff": "赫拉迪克法杖",
  "HoradricStaff": "赫拉迪克法杖",
  "Shaft of the Horadric Staff": "赫拉迪克之杖的转轴",
  "Staff of the Kings": "赫拉迪克之杖的转轴",
  "Hatchet": "小斧",
  "Cleaver": "切肉斧",
  "Twin Axe": "强化双斧",
  "Crowbill": "喙钳",
  "Naga": "纳卡",
  "Military Axe": "军斧",
  "Bearded Axe": "钩斧",
  "Tabar": "斗战斧",
  "Gothic Axe": "哥德之斧",
  "Ancient Axe": "古代之斧",
  "Burnt Wand": "烧焦之杖",
  "Petrified Wand": "净化之杖",
  "Tomb Wand": "古墓之杖",
  "Grave Wand": "墓地之杖",
  "Cudgel": "棍棒",
  "Rune Scepter": "符文权杖",
  "Holy Water Sprinkler": "圣水喷杖",
  "Divine Scepter": "神属权杖",
  "Barbed Club": "倒钩锤",
  "Flanged Mace": "凸缘钉头锤",
  "Jagged Star": "锯齿流星锤",
  "Knout": "皮鞭",
  "Battle Hammer": "战斗铁锤",
  "War Club": "巨战木棍",
  "Martel de Fer": "战槌",
  "Gladius": "罗马短剑",
  "Cutlass": "微弯剑",
  "Shamshir": "虚伪之刃",
  "Tulwar": "圆月弯刀",
  "Dimensional Blade": "空间之刃",
  "Battle Sword": "战斗剑",
  "Rune Sword": "符文剑",
  "Ancient Sword": "古代之剑",
  "Espandon": "斩铁剑",
  "Espadon": "斩铁剑",
  "Dacian Falx": "双刃镰",
  "Tusk Sword": "长牙剑",
  "Gothic Sword": "哥德剑",
  "Zweihander": "瑞韩德",
  "Executioner Sword": "死刑之剑",
  "Poignard": "锐匕",
  "Rondel": "诗歌匕首",
  "Cinquedeas": "强波刀",
  "Stiletto": "小剑",
  "Stilleto": "小剑",
  "Battle Dart": "战斗飞镖",
  "Francisca": "法兰飞斧",
  "War Dart": "巨战飞标",
  "Hurlbat": "戟",
  "War Javelin": "巨战标枪",
  "Great Pilum": "卓越标枪",
  "Simbilan": "锐矛",
  "Spiculum": "阔针剑",
  "Harpoon": "鱼叉",
  "War Spear": "巨战长矛",
  "Fuscina": "弗斯西那",
  "War Fork": "巨战之叉",
  "Yari": "亚利",
  "Lance": "长枪",
  "Lochaber Axe": "罗佳柏斧",
  "Bill": "比尔",
  "Battle Scythe": "战斗镰刀",
  "Partizan": "战戟",
  "Bec-de-Corbin": "双锋战戟",
  "Grim Scythe": "残酷镰刀",
  "Jo Staff": "乔木棒",
  "Quarterstaff": "六尺棍",
  "Cedar Staff": "杉木之棍",
  "Gothic Staff": "哥德之棍",
  "Rune Staff": "符文之棍",
  "Edge Bow": "锋锐之弓",
  "Razor Bow": "剃刀之弓",
  "Cedar Bow": "杉木弓",
  "Double Bow": "双弓",
  "Short Siege Bow": "短攻城弓",
  "Large Siege Bow": "长攻城弓",
  "Long Siege Bow": "长攻城弓",
  "Rune Bow": "符文之弓",
  "Gothic Bow": "哥德弓",
  "Arbalest": "石弓",
  "Siege Crossbow": "攻城十字弓",
  "Ballista": "弩弓",
  "Balista": "弩弓",
  "Chu-Ko-Nu": "巧工弩",
  "Khalim's Flail": "克林姆的连枷",
  "KhalimFlail": "克林姆的连枷",
  "Khalim's Will": "克林姆的意志",
  "SuperKhalimFlail": "克林姆的意志",
  "Berserker Axe": "狂战士斧",
  "Elixir": "灵药",
  "elixir": "灵药",
  "Stamina Potion": "体力药剂",
  "Antidote Potion": "解毒药剂",
  "Rejuvenation Potion": "回复活力药剂",
  "Rejuv Potion": "回复活力药剂",
  "Full Rejuvenation Potion": "全面回复活力药剂",
  "Full Rejuv Potion": "全面回复活力药剂",
  "Thawing Potion": "融解药剂",
  "Tome of Town Portal": "城镇传送之书",
  "Town Portal Book": "城镇传送之书",
  "Tome of Identify": "辨视之书",
  "Identify Book": "辨视之书",
  "Amulet": "护身符",
  "amulet": "护身符",
  "Top of the Horadric Staff": "赫拉迪克之杖顶端",
  "viper amulet": "赫拉迪克之杖顶端",
  "Ring": "戒指",
  "ring": "戒指",
  "Gold": "黄金",
  "gold": "黄金",
  "Scroll of Inifuss": "艾尼弗斯卷轴",
  "Bark Scroll": "艾尼弗斯卷轴",
  "Key to the Cairn Stones": "石冢之钥",
  "deciphered Bark Scroll": "石冢之钥",
  "Arrows": "箭矢",
  "Torch": "火焰",
  "Bolts": "十字弓弹",
  "Scroll of Town Portal": "城镇传送卷轴",
  "Town Portal Scroll": "城镇传送卷轴",
  "Scroll of Identify": "辨视卷轴",
  "Identify Scroll": "辨视卷轴",
  "Heart": "一股邪恶力量",
  "Not used": "一股邪恶力量",
  "Brain": "一股邪恶力量",
  "Jawbone": "一股邪恶力量",
  "Eye": "一股邪恶力量",
  "Horn": "角",
  "Tail": "一股邪恶力量",
  "Flag": "一股邪恶力量",
  "Fang": "一股邪恶力量",
  "Quill": "一股邪恶力量",
  "Soul": "灵魂之",
  "Scalp": "一股邪恶力量",
  "Spleen": "一股邪恶力量",
  "Key": "钥匙",
  "Skeleton Key": "钥匙",
  "The Black Tower Key": "黑塔之钥",
  "Mephisto Key": "黑塔之钥",
  "Right Click to permanently add 20 to Life\nPotion of Life": "生命药剂",
  "Potion of Life": "生命药剂",
  "scroll of self resurrect": "生命药剂",
  "A Jade Figurine": "玉制小人",
  "jade figurine": "玉制小人",
  "The Golden Bird": "黄金鸟",
  "gold bird": "黄金鸟",
  "Lam Esen's Tome": "蓝.依森之书",
  "lam esen's tome": "蓝.依森之书",
  "Horadric Cube": "赫拉迪克方块",
  "Horadric Scroll": "赫拉迪克卷轴",
  "Scroll of Horadric Quest Info": "赫拉迪克卷轴",
  "Mephisto's Soulstone": "墨菲斯托的灵魂之石",
  "Mephisto SoulStone": "墨菲斯托的灵魂之石",
  "Right Click to learn skill of your choice\nBook of Skill": "技能之书",
  "Book of Skill": "技能之书",
  "Keep it to thaw Anya\nMalah's Potion": "玛拉的药剂",
  "Malah's Potion": "玛拉的药剂",
  "Maguffin": "玛拉的药剂",
  "Right Click to Cast\nScroll of Resistance": "抗性卷轴",
  "Scroll of Resistance": "抗性卷轴",
  "Scroll of Malah - Boost Resistances": "抗性卷轴",
  "Khalim's Eye": "克林姆的眼球",
  "KhalimEye": "克林姆的眼球",
  "Khalim's Heart": "克林姆的心脏",
  "KhalimHeart": "克林姆的心脏",
  "Khalim's Brain": "克林姆的大脑",
  "KhalimBrain": "克林姆的大脑",
  "Ear": "耳",
  "Player Ear": "耳",
  "Chipped Amethyst": "碎裂的紫宝石",
  "Flawed Amethyst": "裂开的紫宝石",
  "Amethyst": "紫宝石",
  "Flawless Amethyst": "无暇疵的紫宝石",
  "Perfect Amethyst": "完美的紫宝石",
  "Chipped Topaz": "碎裂的黄宝石",
  "Flawed Topaz": "裂开的黄宝石",
  "Topaz": "黄宝石",
  "Flawless Topaz": "无暇疵的黄宝石",
  "Perfect Topaz": "完美的黄宝石",
  "Chipped Sapphire": "碎裂的蓝宝石",
  "Chipped Saphire": "碎裂的蓝宝石",
  "Flawed Sapphire": "裂开的蓝宝石",
  "Flawed Saphire": "裂开的蓝宝石",
  "Sapphire": "蓝宝石",
  "Saphire": "蓝宝石",
  "Flawless Sapphire": "无暇疵的蓝宝石",
  "Flawless Saphire": "无暇疵的蓝宝石",
  "Perfect Sapphire": "完美的蓝宝石",
  "Perfect Saphire": "完美的蓝宝石",
  "Chipped Emerald": "碎裂的绿宝石",
  "Flawed Emerald": "裂开的绿宝石",
  "Emerald": "绿宝石",
  "Flawless Emerald": "无暇疵的绿宝石",
  "Perfect Emerald": "完美的绿宝石",
  "Chipped Ruby": "碎裂的红宝石",
  "Flawed Ruby": "裂开的红宝石",
  "Ruby": "红宝石",
  "Flawless Ruby": "无暇疵的红宝石",
  "Perfect Ruby": "完美的红宝石",
  "Chipped Diamond": "碎裂的钻石",
  "Flawed Diamond": "裂开的钻石",
  "Diamond": "钻石",
  "Flawless Diamond": "无暇疵的钻石",
  "Perfect Diamond": "完美的钻石",
  "Minor Healing Potion": "轻微治疗药剂",
  "Lesser Healing Potion": "轻微治疗药剂",
  "Light Healing Potion": "轻型治疗药剂",
  "Healing Potion": "治疗药剂",
  "Greater Healing Potion": "强力药剂",
  "Strong Healing Potion": "强力药剂",
  "Super Healing Potion": "超级治疗药剂",
  "Minor Mana Potion": "轻微法力药剂",
  "Lesser Mana Potion": "轻微法力药剂",
  "Light Mana Potion": "轻型法力药剂",
  "Mana Potion": "法力药剂",
  "Greater Mana Potion": "强力法力药剂",
  "Strong Mana Potion": "强力法力药剂",
  "Super Mana Potion": "超级法力药剂",
  "Chipped Skull": "碎裂的骷髅",
  "Flawed Skull": "裂开的骷髅",
  "Skull": "骷髅",
  "Flawless Skull": "无暇疵的骷髅",
  "Perfect Skull": "完美的骷髅",
  "Herb": "药草",
  "herb": "药草",
  "Shael Rune": "符文：夏",
  "Io Rune": "符文：破",
  "Jah Rune": "符文：乔",
  "Key of Terror": "恐惧之钥",
  "Pandemonium Key 1": "恐惧之钥",
  "Key of Hate": "憎恨之钥",
  "Pandemonium Key 2": "憎恨之钥",
  "Key of Destruction": "毁灭之钥",
  "Pandemonium Key 3": "毁灭之钥",
  "Diablo's Horn": "暗黑破坏神之角",
  "Baal's Eye": "巴尔之眼",
  "Mephisto's Brain": "曼菲斯托之脑",
  "Right-click to reset Stat/Skill Points\nToken of Absolution": "赦免徽章",
  "Token of Absolution": "赦免徽章",
  "Twisted Essence of Suffering": "扭曲的苦痛精华",
  "Charged Essence of Hatred": "充盈的憎恨精华",
  "Charged Essense of Hatred": "充盈的憎恨精华",
  "Burning Essence of Terror": "燃烧的恐惧精华",
  "Festering Essence of Destruction": "溃烂的毁灭精华",
  "Standard of Heroes": "英雄旗帜",
  "Standard": "英雄旗帜",
  "The Gnasher": "牙齿",
  "Deathspade": "死亡之铲",
  "Bladebone": "肩胛骨",
  "Mindrend": "切开骷髅",
  "Skull Splitter": "切开骷髅",
  "Rakescar": "火钩之伤",
  "Fechmars Axe": "费屈玛之斧",
  "Axe of Fechmar": "费屈玛之斧",
  "Goreshovel": "血块之铲",
  "The Chieftan": "族长",
  "The Chieftain": "族长",
  "Brainhew": "脑袋",
  "The Humongous": "巨大无比",
  "Humongous": "巨大无比",
  "Iros Torch": "衣洛的火炬",
  "Torch of Iro": "衣洛的火炬",
  "Maelstromwrath": "漩涡",
  "Maelstrom": "漩涡",
  "Gravenspine": "墓穴之脊",
  "Umes Lament": "乌米的恸哭",
  "Ume's Lament": "乌米的恸哭",
  "Felloak": "凶猛橡树",
  "Knell Striker": "敲击丧钟者",
  "Rusthandle": "生锈的把手",
  "Stormeye": "暴风眼",
  "Stoutnail": "坚硬的指甲",
  "Crushflange": "压碎的凸边",
  "Bloodrise": "血升",
  "The Generals Tan Do Li Ga": "坦-杜-里-嘎将军",
  "The General's Tan Do Li Ga": "坦-杜-里-嘎将军",
  "Ironstone": "铁石",
  "Bonesob": "碎骨",
  "Bonesnap": "碎骨",
  "Steeldriver": "铁制大锤",
  "Rixots Keen": "瑞克撒特的挽歌",
  "Rixot's Keen": "瑞克撒特的挽歌",
  "Blood Crescent": "血红新月",
  "Krintizs Skewer": "格林提斯的肉叉",
  "Skewer of Krintiz": "格林提斯的肉叉",
  "Gleamscythe": "闪耀的镰刀",
  "Azurewrath": "青色忿怒",
  "Griswolds Edge": "格理斯瓦得的锐利",
  "Griswold's Edge": "格理斯瓦得的锐利",
  "Hellplague": "地狱瘟疫",
  "Culwens Point": "库尔温的尖端",
  "Culwen's Point": "库尔温的尖端",
  "Shadowfang": "影之牙",
  "Soulflay": "剥皮灵魂",
  "Kinemils Awl": "金麦尔的锥子",
  "Kinemil's Awl": "金麦尔的锥子",
  "Blacktongue": "黑色之舌",
  "Ripsaw": "粗齿大锯",
  "The Patriarch": "族长",
  "Gull": "海鸥",
  "The Diggler": "迪格勒",
  "The Jade Tan Do": "坦杜之玉",
  "Irices Shard": "妖怪碎片",
  "Spectral Shard": "妖怪碎片",
  "The Dragon Chang": "张龙",
  "Razortine": "剃刀之叉",
  "Bloodthief": "血之偷",
  "Lance of Yaggai": "雅该长矛",
  "The Tannr Gorerod": "坦之血杖",
  "Dimoaks Hew": "迪马克之劈砍",
  "Dimoak's Hew": "迪马克之劈砍",
  "Steelgoad": "铁刺棒",
  "Soul Harvest": "灵魂采集者",
  "The Battlebranch": "战斗支系",
  "Woestave": "烦恼诗集",
  "The Grim Reaper": "冷酷开膛手",
  "Bane Ash": "祸根之灰",
  "Serpent Lord": "海蛇之王",
  "Lazarus Spire": "拉撒罗斯之螺旋",
  "Spire of Lazarus": "拉撒罗斯之螺旋",
  "The Salamander": "火精灵",
  "The Iron Jang Bong": "铁检棒",
  "Pluckeye": "勇气之眼",
  "Witherstring": "凋谢之戒",
  "Rimeraven": "渡鸟之爪",
  "Raven Claw": "渡鸟之爪",
  "Piercerib": "萝格之弓",
  "Rogue's Bow": "萝格之弓",
  "Pullspite": "暴风之击",
  "Stormstrike": "暴风之击",
  "Wizendraw": "凋谢之画",
  "Hellclap": "作响的地狱",
  "Blastbark": "爆裂的吠叫",
  "Leadcrow": "引导乌鸦",
  "Ichorsting": "灵液之刺",
  "Hellcast": "投掷地狱",
  "Doomspittle": "毁灭投石者",
  "Doomslinger": "毁灭投石者",
  "War Bonnet": "毕格因的软帽",
  "Biggin's Bonnet": "毕格因的软帽",
  "Tarnhelm": "塔因头盔",
  "Coif of Glory": "光荣布帽",
  "Duskdeep": "黄昏深处",
  "Wormskull": "温暖骷髅",
  "Howltusk": "怒号长牙",
  "Undead Crown": "不死皇冠",
  "The Face of Horror": "恐惧之脸",
  "Greyform": "薄暮外观",
  "Blinkbats Form": "眨眼蝙蝠的外观",
  "Blinkbat's Form": "眨眼蝙蝠的外观",
  "The Centurion": "百夫长",
  "Twitchthroe": "抽动的挣扎",
  "Darkglow": "扩散黑暗",
  "Hawkmail": "鹰甲",
  "Sparking Mail": "火花之甲",
  "Venomsward": "毒液牢房",
  "Venom Ward": "毒液牢房",
  "Iceblink": "冰雪眨眼",
  "Boneflesh": "骨肉",
  "Rockfleece": "石之毛",
  "Rattlecage": "作响之笼",
  "Goldskin": "黄金之皮",
  "Victors Silk": "胜利者之丝绸",
  "Silks of the Victor": "胜利者之丝绸",
  "Heavenly Garb": "天堂装束",
  "Pelta Lunata": "新月小盾",
  "Umbral Disk": "阴影圆盘",
  "Stormguild": "暴风公会",
  "Wall of the Eyeless": "无眼之墙",
  "Swordback Hold": "剑背之架",
  "Steelclash": "作响的金属",
  "Bverrit Keep": "贝弗提的纪念",
  "The Ward": "囚房",
  "The Hand of Broc": "柏克之手",
  "Bloodfist": "血拳",
  "Chance Guards": "运气守护",
  "Magefist": "法师之拳",
  "Frostburn": "霜燃",
  "Hotspur": "热靴刺",
  "Gorefoot": "血脚",
  "Treads of Cthon": "凯松的征服",
  "Goblin Toe": "小妖精脚趾",
  "Tearhaunch": "泪之臀",
  "Lenyms Cord": "雷尼摩",
  "Lenymo": "雷尼摩",
  "Snakecord": "蛇索",
  "Nightsmoke": "夜烟",
  "Goldwrap": "金色包里",
  "Bladebuckle": "锋利扣带",
  "Nokozan Relic": "诺科蓝遗物",
  "The Eye of Etlich": "艾利屈之眼",
  "The Mahim-Oak Curio": "玛哈姆橡木古董",
  "Nagelring": "拿各的戒指",
  "Manald Heal": "玛那得的治疗",
  "The Stone of Jordan": "乔丹之石",
  "Amulet of the Viper": "蝮蛇护符",
  "Staff of Kings": "国王之杖",
  "Whichwild String": "狂野之弦",
  "Witchwild String": "狂野之弦",
  "Cutthroat1": "巴特克的猛击",
  "Bartuc's Cut-Throat": "巴特克的猛击",
  "Hellfire Torch": "地狱火炬",
  "Civerb's Ward": "希弗柏的防护",
  "Civerb's Icon": "希弗伯的图案",
  "Civerb's Cudgel": "希弗伯的短棍",
  "Hsarus' Iron Heel": "哈斯拉柏的铁后跟",
  "Hsarus' Iron Fist": "哈斯拉柏的铁拳",
  "Hsarus' Iron Stay": "哈斯拉柏的铁胸衣",
  "Cleglaw's Tooth": "克雷得劳之牙",
  "Cleglaw's Claw": "克雷得劳之爪",
  "Cleglaw's Pincers": "克雷得劳之钳",
  "Iratha's Collar": "依雷撒的项圈",
  "Iratha's Cuff": "依雷撒的袖口",
  "Iratha's Coil": "依雷撒的线圈",
  "Iratha's Cord": "依雷撒之绳",
  "Isenhart's Lightbrand": "依森哈德的光之烙铁",
  "Isenhart's Parry": "依森哈德的闪避",
  "Isenhart's Case": "依森哈德的外壳",
  "Isenhart's Horns": "依森哈德的号角",
  "Vidala's Barb": "维达拉之倒刺",
  "Vidala's Fetlock": "维达拉的距毛",
  "Vidala's Ambush": "维达拉的突袭",
  "Vidala's Snare": "维达拉的陷阱",
  "Milabrega's Orb": "米拉伯佳之球",
  "Milabrega's Rod": "米拉伯佳之杖",
  "Milabrega's Diadem": "米拉伯佳的王冠",
  "Milabrega's Robe": "米拉伯佳之袍",
  "Cathan's Rule": "卡珊之尺",
  "Cathan's Mesh": "卡珊之网",
  "Cathan's Visage": "卡珊的容貌",
  "Cathan's Sigil": "卡珊的魔咒",
  "Cathan's Seal": "卡珊的封印",
  "Tancred's Crowbill": "坦克雷的鸦嘴钳",
  "Tancred's Spine": "坦克雷的脊柱",
  "Tancred's Hobnails": "坦克雷的平头钉",
  "Tancred's Weird": "坦克雷的怪诞",
  "Tancred's Skull": "坦克雷之骷髅",
  "Sigon's Gage": "西刚的挑战",
  "Sigon's Visor": "西刚之面甲",
  "Sigon's Shelter": "西刚的遮蔽",
  "Sigon's Sabot": "西刚的木鞋",
  "Sigon's Wrap": "西刚的披肩",
  "Sigon's Guard": "西刚的守护",
  "Infernal Cranium": "地狱头骨",
  "Infernal Torch": "地狱火炬",
  "Infernal Sign": "地狱符号",
  "Berserker's Headgear": "狂战士的头戴",
  "Berserker's Hauberk": "狂战士的锁子甲",
  "Berserker's Hatchet": "狂战士的手斧",
  "Death's Hand": "死亡之手",
  "Death's Guard": "死亡的守护",
  "Death's Touch": "死亡之触",
  "Angelic Sickle": "天使的镰刀",
  "Angelic Mantle": "天使的披风",
  "Angelic Halo": "天使之光",
  "Angelic Wings": "天使之翼",
  "Arctic Horn": "北极号角",
  "Arctic Furs": "北极毛皮",
  "Arctic Binding": "北极捆缚",
  "Arctic Mitts": "北极手套",
  "Arcanna's Sign": "阿卡娜的符号",
  "Arcanna's Deathwand": "阿卡娜的死亡之杖",
  "Arcanna's Head": "阿卡娜的头",
  "Arcanna's Flesh": "阿卡娜的血肉",
  "Civerb's Vestments": "希弗伯的法衣",
  "Hsarus' Defense": "哈斯拉柏的防御",
  "Cleglaw's Brace": "克雷得劳的支柱",
  "Iratha's Finery": "依雷撒的精铣炉",
  "Isenhart's Armory": "依森哈德的武器室",
  "Vidala's Rig": "维达拉的配备",
  "Milabrega's Regalia": "米拉伯佳的雪茄",
  "Cathan's Traps": "卡珊的陷阱",
  "Tancred's Battlegear": "坦克雷的战斗工具",
  "Sigon's Complete Steel": "西刚的全套刀剑",
  "Infernal Tools": "地狱的工具",
  "Berserker's Garb": "狂战士的军火库",
  "Berserker's Arsenal": "狂战士的军火库",
  "Death's Disguise": "死亡的伪装",
  "Angelical Raiment": "天上的衣服",
  "Angelic Raiment": "天上的衣服",
  "Arctic Gear": "北极装置",
  "Arcanna's Tricks": "卡阿娜的诡计",
  "Shako": "军帽",
  "Hydraskull": "九头蛇头盖骨盔",
  "Armet": "活动面甲",
  "Giant Conch": "巨型海螺",
  "Spired Helm": "螺旋头盔",
  "Corona": "皇冠之冠",
  "Demonhead": "恶魔头盖骨面具",
  "Bone Visage": "骸骨面罩",
  "Circlet": "头环",
  "Coronet": "宝冠",
  "Tiara": "三重冠",
  "Jawbone Cap": "颚骨帽",
  "Fanged Helm": "尖牙盔",
  "Horned Helm": "角盔",
  "Assault Helmet": "突击盔",
  "Avenger Guard": "复仇者之盔",
  "Jawbone Visor": "颚骨面甲",
  "Lion Helm": "狮头尖盔",
  "Rage Mask": "狂怒面具",
  "Savage Helmet": "野蛮人头盔",
  "Slayer Guard": "屠杀者护面",
  "Carnage Helm": "杀戮头盔",
  "Fury Visor": "狂暴面甲",
  "Destroyer Helm": "毁灭者头盔",
  "Conqueror Crown": "征服者皇冠",
  "Conquerer Crown": "征服者皇冠",
  "Guardian Crown": "守护者皇冠",
  "Wolf Head": "狼头",
  "Hawk Helm": "鹰盔",
  "Antlers": "鹿角",
  "Falcon Mask": "猎鹰面具",
  "Spirit Mask": "灵魂面具",
  "Alpha Helm": "阿尔法头盔",
  "Griffon Headdress": "狮鹫兽头饰",
  "Griffon Headress": "狮鹫兽头饰",
  "Hunter's Guise": "猎人的伪装",
  "Sacred Feathers": "神圣羽毛",
  "Totemic Mask": "图腾面具",
  "Blood Spirit": "鲜血之灵",
  "Blood Spirt": "鲜血之灵",
  "Sun Spirit": "太阳之灵",
  "Earth Spirit": "大地之灵",
  "Sky Spirit": "天空之灵",
  "Dream Spirit": "梦境之灵",
  "Dusk Shroud": "暮色寿衣",
  "Wyrmhide": "古龙皮",
  "Scarab Husk": "圣甲虫壳皮甲",
  "Wire Fleece": "线羊毛皮甲",
  "Diamond Mail": "钻石锁子甲",
  "Loricated Mail": "甲片甲",
  "Boneweave": "骸骨链甲",
  "Great Hauberk": "巨型鳞铠胸甲",
  "Balrog Skin": "炎魔皮板甲",
  "Hellforge Plate": "地狱锻甲",
  "Hellforged Plate": "地狱锻甲",
  "Kraken Shell": "海妖壳甲",
  "Lacquered Plate": "漆甲",
  "Shadow Plate": "阴影铠甲",
  "Sacred Armor": "神圣盔甲",
  "Archon Plate": "执政官铠甲",
  "Heater": "小圆盾",
  "Luna": "月精灵护盾",
  "Hyperion": "亥伯龙之盾",
  "Monarch": "统治者大盾",
  "Aegis": "宙斯之盾",
  "Troll Nest": "巨魔巢穴骨盾",
  "Blade Barrier": "刀刃刺盾",
  "Targe": "圆盾",
  "Rondache": "饰盾",
  "Heraldic Shield": "纹章盾",
  "Aerin Shield": "艾尔之盾",
  "Crown Shield": "皇冠之盾",
  "Akaran Targe": "阿卡拉圆盾",
  "Akaran Rondache": "阿卡拉饰盾",
  "Protector Shield": "保护者盾牌",
  "Gilded Shield": "饰金盾牌",
  "Guilded Shield": "饰金盾牌",
  "Royal Shield": "皇家盾牌",
  "Sacred Targe": "神圣小盾",
  "Sacred Rondache": "神圣轻圆盾",
  "Kurast Shield": "库拉斯特之盾",
  "Zakarum Shield": "撒卡兰姆盾牌",
  "Vortex Shield": "旋风盾",
  "Preserved Head": "防腐之首",
  "Zombie Head": "僵尸之首",
  "Unraveller Head": "揭露者之首",
  "Gargoyle Head": "石像鬼之首",
  "Demon Head": "恶魔之首",
  "Mummified Trophy": "木乃伊印记",
  "Fetish Trophy": "物神印记",
  "Sexton Trophy": "教堂司事印记",
  "Cantor Trophy": "领唱者印记",
  "Hierophant Trophy": "教皇印记",
  "Heirophant Trophy": "教皇印记",
  "Minion Skull": "仆从头骨",
  "Overseer Skull": "监督者头骨",
  "Succubus Skull": "女妖头骨",
  "Succubae Skull": "女妖头骨",
  "Bloodlord Skull": "血王头骨",
  "Gloves": "皮手套",
  "Bracers": "护腕",
  "Bramble Mitts": "荆棘连指手套",
  "Vampirebone Gloves": "吸血鬼骸骨手套",
  "Vambraces": "吸血鬼护腕",
  "Crusader Gauntlets": "十字军铁手套",
  "Ogre Gauntlets": "食人魔铁手套",
  "Wyrmhide Boots": "古龙皮靴",
  "Scarabshell Boots": "圣甲虫壳靴",
  "Boneweave Boots": "骸骨靴",
  "Mirrored Boots": "镜化靴",
  "Myrmidon Greaves": "急速靴",
  "Girdle": "金属扣带",
  "Spiderweb Sash": "蛛网腰带",
  "Vampirefang Belt": "吸血鬼獠牙腰带",
  "Mithril Coil": "秘银腰带",
  "Troll Belt": "巨魔腰带",
  "Colossus Girdle": "巨神腰带",
  "Phase Blade": "幻化之刃",
  "Colossus Volgue": "巨神之斧",
  "Colossus Voulge": "巨神之斧",
  "Thresher": "锐利之斧",
  "Giant Thresher": "巨型锐利之斧",
  "Cryptic Axe": "神秘之斧",
  "Great Poleaxe": "巨长斧",
  "Ogre Axe": "食人魔之斧",
  "Swirling Crystal": "涡流水晶",
  "Dimensional Shard": "次元碎片",
  "Unearthed Wand": "破隐法杖",
  "Ceremonial Javelin": "祭典标枪",
  "Matriarchal Bow": "女族长之弓",
  "Grand Matron Bow": "大院长之弓",
  "Matriarchal Spear": "女族长之矛",
  "Matriarchal Pike": "女族长之长矛",
  "Matriarchal Javelin": "女族长之标枪",
  "MatriarchalJavelin": "女族长之标枪",
  "Katar": "拳剑",
  "Wrist Blade": "腕刀",
  "Hatchet Hands": "手斧爪",
  "Cestus": "皮手甲",
  "Claws": "爪",
  "Blade Talons": "刃爪",
  "Scissors Katar": "剪咬刀",
  "Quhab": "格斗剪",
  "Wrist Spike": "腕刺",
  "Fascia": "格斗爪",
  "Hand Scythe": "手镰",
  "Greater Claws": "巨爪",
  "Greater Talons": "巨鹰爪",
  "Scissors Quhab": "近身剪",
  "Suwayyah": "近身刃",
  "Wrist Sword": "腕剑",
  "War Fist": "战拳",
  "Battle Cestus": "斗腰刀",
  "Feral Claws": "猛禽爪",
  "Runic Talons": "符纹爪",
  "Scissors Suwayyah": "近身剪刃",
  "Tomahawk": "印第安战斧",
  "Small Crescent": "小月斧",
  "Ettin Axe": "双头斧",
  "War Spike": "战刺",
  "Feral Axe": "狂野之斧",
  "Silver-edged Axe": "银刃斧",
  "Silver Edged Axe": "银刃斧",
  "Decapitator": "斩首斧",
  "Champion Axe": "冠军之斧",
  "Glorious Axe": "光荣之斧",
  "Polished Wand": "磨光法杖",
  "Ghost Wand": "鬼魂法杖",
  "Lich Wand": "巫妖法杖",
  "Truncheon": "短棒",
  "Mighty Scepter": "强威权杖",
  "Seraph Rod": "炽天使法杖",
  "Caduceus": "神使之杖",
  "Tyrant Club": "暴君之棒",
  "Reinforced Mace": "强化钉锤",
  "Devil Star": "恶魔流星锤",
  "Scourge": "天罚之锤",
  "Legendary Mallet": "传说之锤",
  "Ogre Maul": "食人魔之锤",
  "Thunder Maul": "雷霆之锤",
  "Falcata": "弯形大刀",
  "Ataghan": "土耳其剑",
  "Elegant Blade": "优雅之剑",
  "Hydra Edge": "九头蛇刃",
  "Conquest Sword": "征服之剑",
  "Cryptic Sword": "神秘之剑",
  "Mythical Sword": "神话之剑",
  "Legend Sword": "传说之剑",
  "Highland Blade": "高地之剑",
  "Balrog Blade": "炎魔之刃",
  "Champion Sword": "冠军之剑",
  "Colossus Sword": "巨神之剑",
  "Colossal Sword": "巨神之剑",
  "Colossus Blade": "巨神之刃",
  "Bone Knife": "骸骨小刀",
  "Mithril Point": "秘银小刀",
  "Mithral Point": "秘银小刀",
  "Fanged Knife": "尖牙小刀",
  "Legend Spike": "传说尖刺",
  "Flying Knife": "飞刀",
  "Flying Axe": "飞斧",
  "Winged Knife": "翼刀",
  "Winged Axe": "翼斧",
  "Hyperion Javelin": "亥伯龙标枪",
  "Stygian Pilum": "冥河标枪",
  "Balrog Spear": "炎魔长矛",
  "Ghost Glaive": "鬼魂尖枪",
  "Winged Harpoon": "翼鱼叉",
  "Hyperion Spear": "亥伯龙之矛",
  "Stygian Pike": "冥河长枪",
  "Mancatcher": "捕人叉",
  "Ghost Spear": "鬼魂之矛",
  "War Pike": "战枪",
  "Walking Stick": "手杖",
  "Stalagmite": "石笋之杖",
  "Elder Staff": "长老之杖",
  "Shillelagh": "橡木棍",
  "Shillelah": "橡木棍",
  "Archon Staff": "执政官之杖",
  "Spider Bow": "蜘蛛之弓",
  "Blade Bow": "刀锋之弓",
  "Shadow Bow": "阴影之弓",
  "Great Bow": "巨弓",
  "Diamond Bow": "钻石之弓",
  "Crusader Bow": "十字军之弓",
  "Ward Bow": "庇护之弓",
  "Hydra Bow": "九头蛇弓",
  "Pellet Bow": "弹丸弩",
  "Gorgon Crossbow": "蛇发女妖十字弓",
  "Colossus Crossbow": "巨神十字弓",
  "Demon Crossbow": "恶魔十字弓",
  "Eagle Orb": "鹰眼法珠",
  "Sacred Globe": "神圣天球",
  "Smoked Sphere": "烟雾法球",
  "Clasped Orb": "紧握法珠",
  "Dragon Stone": "龙石",
  "Jared's Stone": "贾瑞德之石",
  "Glowing Orb": "发光法珠",
  "Crystalline Globe": "水晶天球",
  "Cloudy Sphere": "云雾法球",
  "Sparkling Ball": "闪耀法球",
  "Heavenly Stone": "天堂之石",
  "Eldritch Orb": "怪异法球",
  "Demon Heart": "恶魔之心",
  "Vortex Orb": "漩涡法珠",
  "Stag Bow": "牡鹿之弓",
  "Reflex Bow": "反射之弓",
  "Maiden Spear": "少女之矛",
  "Maiden Pike": "少女长矛",
  "Maiden Javelin": "少女标枪",
  "Ashwood Bow": "白蜡木弓",
  "Ceremonial Bow": "祭典之弓",
  "Ceremonial Spear": "祭典之矛",
  "Ceremonial Pike": "祭典长矛",
  "Jewel": "珠宝",
  "Small Charm": "小护身符",
  "Charm Small": "小护身符",
  "Large Charm": "大型护身符",
  "Charm Medium": "大型护身符",
  "Grand Charm": "超大型护身符",
  "Charm Large": "超大型护身符",
  "Harlequin Crest": "谐角之冠",
  "Veil of Steel": "钢铁面纱",
  "The Gladiator's Bane": "角斗士的祸根",
  "Arkaine's Valor": "阿凯尼的荣耀",
  "Blackoak Shield": "黑橡树盾",
  "Stormshield": "暴风之盾",
  "Hellslayer": "地狱阔斧",
  "Messerschmidt's Reaver": "梅西施密特的劫掠者",
  "Baranar's Star": "巴拉那之星",
  "Schaefer's Hammer": "史恰佛之锤",
  "The Cranium Basher": "碎脑锤",
  "Lightsabre": "光之军刀",
  "Doombringer": "末日毁灭者",
  "The Grandfather": "祖父",
  "Wizardspike": "巫师之刺",
  "Constricting Ring": "束缚之戒",
  "Stormspire": "暴风尖塔",
  "Eaglehorn": "鹰号角",
  "Windforce": "风之力",
  "Bul-Kathos' Wedding Band": "布尔凯索之戒",
  "Bul Katho's Wedding Band": "布尔凯索之戒",
  "The Cat's Eye": "猫眼",
  "The Rising Sun": "旭日东升",
  "Crescent Moon": "新月",
  "Mara's Kaleidoscope": "马拉的万花筒",
  "Atma's Scarab": "阿特玛的圣甲虫",
  "Dwarf Star": "矮人之星",
  "Raven Frost": "乌鸦之霜",
  "Highlord's Wrath": "大君之怒",
  "Saracen's Chance": "萨拉森的机会",
  "Arreat's Face": "亚瑞特的面容",
  "Homunculus": "侏儒",
  "Titan's Revenge": "泰坦的复仇",
  "Lycander's Aim": "雷山德的指标",
  "Lycander's Flank": "雷山德的侧翼",
  "The Oculus": "眼球",
  "Herald of Zakarum": "撒卡兰姆使者",
  "Jalal's Mane": "加尔的长发",
  "The Scalper": "剥皮者",
  "Bloodmoon": "血月",
  "Djinnslayer": "斩魔刀",
  "Djinn Slayer": "斩魔刀",
  "Deathbit": "死亡碎片",
  "Warshrike": "战争翼刀",
  "Gutsiphon": "吸魂器",
  "Gut Siphon": "吸魂器",
  "Razoredge": "剃刀之刃",
  "Razor's Edge": "剃刀之刃",
  "Gore Ripper": "血肉撕裂者",
  "Demonlimb": "恶魔肢体",
  "Demon Limb": "恶魔肢体",
  "Steelshade": "钢铁鬼影",
  "Steel Shade": "钢铁鬼影",
  "Tomb Reaver": "盗墓者",
  "Deaths's Web": "死亡之网",
  "Death's Web": "死亡之网",
  "Nature's Peace": "大自然的和平",
  "Seraph's Hymn": "炽天使之韵",
  "Zakarum's Salvation": "撒卡兰姆的救赎",
  "Fleshripper": "裂肉者",
  "Odium": "憎恨",
  "Horizon's Tornado": "地平线的龙卷风",
  "Stone Crusher": "碎石者",
  "Jadetalon": "碧玉爪",
  "Jade Talon": "碧玉爪",
  "Shadowdancer": "影舞者",
  "Shadow Dancer": "影舞者",
  "Cerebus": "地狱犬之咬",
  "Cerebus' Bite": "地狱犬之咬",
  "Tyrael's Might": "泰瑞尔的力量",
  "Souldrain": "吸魂者",
  "Soul Drainer": "吸魂者",
  "Runemaster": "符文大师",
  "Rune Master": "符文大师",
  "Deathcleaver": "死亡之刀",
  "Death Cleaver": "死亡之刀",
  "Executioner's Justice": "刽子手的裁决",
  "Stoneraven": "石乌鸦",
  "Leviathan": "利维坦",
  "Larzuk's Champion": "拉苏克的冠军",
  "Wisp": "鬼火投射者",
  "Wisp Projector": "鬼火投射者",
  "Gargoyle's Bite": "石像鬼之噬",
  "Lacerator": "撕裂者",
  "Mang Song's Lesson": "梅格之歌的教训",
  "Viperfork": "毒蛇叉",
  "Ethereal Edge": "无形之刃",
  "Demonhorn's Edge": "恶魔号角的边缘",
  "The Reaper's Toll": "死神的丧钟",
  "Spiritkeeper": "灵魂看守者",
  "Spirit Keeper": "灵魂看守者",
  "Hellrack": "地狱刑具",
  "Alma Negra": "阿尔玛·尼格拉",
  "Darkforge Spawn": "黑暗力量之源",
  "Darkforce Spawn": "黑暗力量之源",
  "Widowmaker": "寡妇制造者",
  "Bloodraven's Charge": "血鸟的袭击",
  "Blood Raven's Charge": "血鸟的袭击",
  "Ghostflame": "鬼火焰",
  "Shadowkiller": "影杀者",
  "Shadow Killer": "影杀者",
  "Gimmershred": "碎片贪婪者",
  "Griffon's Eye": "格利风之眼",
  "Windhammer": "风之锤",
  "Thunderstroke": "雷击",
  "Giantmaimer": "巨人残害者",
  "Giant Maimer": "巨人残害者",
  "Demon's Arch": "恶魔之拱",
  "Boneflame": "骨焰",
  "Steelpillar": "钢柱",
  "Steel Pillar": "钢柱",
  "Nightwing's Veil": "夜翼面纱",
  "Crown of Ages": "年纪之冠",
  "Andariel's Visage": "安达利尔的面貌",
  "Darkfear": "黑暗恐惧",
  "Dragonscale": "龙鳞",
  "Steel Carapice": "钢铁甲壳",
  "Steel Carapace": "钢铁甲壳",
  "Medusa's Gaze": "美杜莎的凝视",
  "Ravenlore": "乌鸦之王",
  "Boneshade": "骨影",
  "Nethercrow": "冥界渡鸦",
  "Flamebellow": "火焰号角",
  "Fathom": "死亡深度",
  "Death's Fathom": "死亡深度",
  "Wolfhowl": "狼嚎",
  "Spirit Ward": "灵魂庇护",
  "Kira's Guardian": "奇拉的守护",
  "Ormus' Robes": "奥玛斯的长袍",
  "Gheed's Fortune": "基德的财运",
  "Stormlash": "暴风之结",
  "Halaberd's Reign": "哈拉伯德的统治",
  "Warriv's Warder": "瓦瑞夫的守护者",
  "Spike Thorn": "尖刺根源",
  "Dracul's Grasp": "卓古拉之握",
  "Frostwind": "冰霜之风",
  "Templar's Might": "圣堂武士的力量",
  "Eschuta's temper": "艾斯屈塔的脾气",
  "Eschuta's Temper": "艾斯屈塔的脾气",
  "Firelizard's Talons": "火蜥蜴之爪",
  "Sandstorm Trek": "沙暴之旅",
  "Marrowwalk": "骨髓行走",
  "Heaven's Light": "天堂之光",
  "Merman's Speed": "鱼人的链轮",
  "Merman's Sprocket": "鱼人的链轮",
  "Arachnid Mesh": "蜘蛛之网",
  "Nosferatu's Coil": "诺斯费拉图的线圈",
  "Metalgrid": "金属网格",
  "Verdugo's Hearty Cord": "维尔登戈的心结",
  "Verdungo's Hearty Cord": "维尔登戈的心结",
  "Sigurd's Staunch": "西格德的潜行",
  "Siggard's Stealth": "西格德的潜行",
  "Carrion Wind": "腐肉之风",
  "Giantskull": "巨骷髅",
  "Giant Skull": "巨骷髅",
  "Ironward": "阿斯特龙之铁的保护区",
  "Astreon's Iron Ward": "阿斯特龙之铁的保护区",
  "Annihilus": "毁灭小护身符",
  "Arioc's Needle": "阿里欧克之针",
  "Cranebeak": "鹤嘴",
  "Nord's Tenderizer": "诺德的制肉嫩化器",
  "Earthshifter": "大地变形者",
  "Earth Shifter": "大地变形者",
  "Wraithflight": "幽灵火焰",
  "Wraith Flight": "幽灵火焰",
  "Bonehew": "破骨",
  "Ondal's Wisdom": "奥达尔的智慧",
  "The Reedeemer": "救世主",
  "The Redeemer": "救世主",
  "Headhunter's Glory": "猎头人的荣耀",
  "Head Hunter's Glory": "猎头人的荣耀",
  "Steelrend": "碎钢",
  "Rainbow Facet": "彩虹刻面",
  "Coldkill": "冷酷杀手",
  "Butcher's Pupil": "屠夫的徒弟",
  "Islestrike": "岛屿击",
  "Pompe's Wrath": "庞贝之怒",
  "Pompeii's Wrath": "庞贝之怒",
  "Guardian Naga": "守护那迦",
  "Warlord's Trust": "战神的信任",
  "Spellsteel": "钢铁魔咒",
  "Stormrider": "暴风骑士",
  "Boneslayer Blade": "斩骨者之刃",
  "The Minataur": "米诺陶斯",
  "The Minotaur": "米诺陶斯",
  "Suicide Branch": "自杀支系",
  "Carin Shard": "凯恩碎片",
  "Arm of King Leoric": "李奥瑞克王的骨杖",
  "Blackhand Key": "黑手之钥",
  "Dark Clan Crusher": "暗族碎骨者",
  "Zakarum's Hand": "撒卡兰姆之手",
  "The Fetid Sprinkler": "恶臭洒水器",
  "Hand of Blessed Light": "祝福之光之手",
  "Fleshrender": "撕肉者",
  "Sureshrill Frost": "尖啸冰霜",
  "Moonfall": "落月",
  "Baezil's Vortex": "贝西尔的漩涡",
  "Earthshaker": "撼地者",
  "Bloodtree Stump": "血树残桩",
  "The Gavel of Pain": "痛苦木槌",
  "Bloodletter": "放血者",
  "Coldsteel Eye": "冷钢之眼",
  "Hexfire": "妖火",
  "Blade of Ali Baba": "阿里巴巴之刃",
  "Ginther's Rift": "金瑟的裂隙",
  "Headstriker": "击头者",
  "Plague Bearer": "瘟疫使者",
  "The Atlantian": "亚特兰提斯",
  "The Atlantean": "亚特兰提斯",
  "Crainte Vomir": "克林特·佛姆",
  "Bing Sz Wang": "冰之王",
  "The Vile Husk": "卑劣躯壳",
  "Cloudcrack": "裂云",
  "Todesfaelle Flamme": "死亡之火",
  "Swordguard": "剑卫",
  "Spineripper": "裂脊者",
  "Heart Carver": "刻心者",
  "Blackbog's Sharp": "黑沼之锋",
  "Stormspike": "暴风尖刺",
  "The Impaler": "穿刺者",
  "Kelpie Snare": "水魔陷阱",
  "Soulfeast Tine": "噬魂叉",
  "Hone Sundan": "宏·森丹",
  "Spire of Honor": "荣耀尖塔",
  "The Meat Scraper": "刮肉者",
  "Blackleach Blade": "黑水之刃",
  "Athena's Wrath": "雅典娜的愤怒",
  "Pierre Tombale Couant": "皮尔·通巴尔·库앙",
  "Husoldal Evo": "胡索达·伊佛",
  "Grim's Burning Dead": "格里姆的燃烧死者",
  "Razorswitch": "剃刀之枝",
  "Ribcracker": "肋骨粉碎者",
  "Chromatic Ire": "多彩之怒",
  "Warpspear": "扭曲之矛",
  "Skullcollector": "骷髅收集者",
  "Skull Collector": "骷髅收集者",
  "Skystrike": "天击",
  "Riphook": "裂钩",
  "Kuko Shakaku": "库寇沙卡库",
  "Endlesshail": "无尽冰雹",
  "Cliffkiller": "悬崖杀手",
  "Magewrath": "法师之怒",
  "Godstrike Arch": "金击圆弧",
  "Goldstrike Arch": "金击圆弧",
  "Langer Briser": "兰格·布里瑟",
  "Pus Spiter": "毒液喷射者",
  "Pus Spitter": "毒液喷射者",
  "Buriza-Do Kyanon": "布理撒-多·凯南 (大炮)",
  "Demon Machine": "恶魔机械",
  "Peasent Crown": "农夫王冠",
  "Peasant Crown": "农夫王冠",
  "Rockstopper": "岩石制动器",
  "Stealskull": "偷取骷髅",
  "Darksight Helm": "暗视之盔",
  "Valkiry Wing": "女武神之翼",
  "Valkyrie Wing": "女武神之翼",
  "Crown of Thieves": "盗贼皇冠",
  "Blackhorn's Face": "黑角面具",
  "Vampiregaze": "吸血鬼的凝视",
  "Vampire Gaze": "吸血鬼的凝视",
  "The Spirit Shroud": "灵魂帷幕",
  "Skin of the Vipermagi": "海蛇皮甲",
  "Skin of the Flayerd One": "剥皮者之皮",
  "Skin of the Flayed One": "剥皮者之皮",
  "Ironpelt": "铁皮",
  "Iron Pelt": "铁皮",
  "Spiritforge": "灵魂熔炉",
  "Spirit Forge": "灵魂熔炉",
  "Crow Caw": "乌鸦哀鸣",
  "Shaftstop": "谢夫特斯坦布 (物免甲)",
  "Duriel's Shell": "督瑞尔的壳",
  "Skullder's Ire": "斯库尔德的愤怒",
  "Guardian Angel": "守护天使",
  "Toothrow": "排齿",
  "Atma's Wail": "阿特玛的哭喊",
  "Black Hades": "黑色哈迪斯",
  "Corpsemourn": "尸体的哀伤",
  "Que-Hegan's Wisdon": "奎-黑刚的智慧",
  "Que-Hegan's Wisdom": "奎-黑刚的智慧",
  "Visceratuant": "维斯尔图特",
  "Mosers Blessed Circle": "摩西尔的祝福之环",
  "Moser's Blessed Circle": "摩西尔的祝福之环",
  "Stormchaser": "风暴追逐者",
  "Tiamat's Rebuke": "提亚玛特的训诫",
  "Kerke's Sanctuary": "杰尔克的圣堂",
  "Gerke's Sanctuary": "杰尔克的圣堂",
  "Radimant's Sphere": "罗达门特之球体",
  "Radament's Sphere": "罗达门特之球体",
  "Lidless Wall": "警戒之墙",
  "Lance Guard": "长枪守卫",
  "Venom Grip": "剧毒之握",
  "Gravepalm": "墓穴的抚弄",
  "Ghoulhide": "食尸鬼外皮",
  "Lavagout": "熔岩羊角",
  "Lava Gout": "熔岩羊角",
  "Hellmouth": "地狱之嘴",
  "Infernostride": "地狱阔步",
  "Waterwalk": "水上漂",
  "Silkweave": "丝绸之织",
  "Wartraveler": "战争旅者",
  "War Traveler": "战争旅者",
  "Gorerider": "蚀肉骑士",
  "Gore Rider": "蚀肉骑士",
  "String of Ears": "长串之耳",
  "Razortail": "穿刺腰带",
  "Gloomstrap": "阴暗陷阱",
  "Gloom's Trap": "阴暗陷阱",
  "Snowclash": "雪之冲突",
  "Thudergod's Vigor": "雷神之力",
  "Thundergod's Vigor": "雷神之力",
  "Natalya's Odium": "娜塔亚的非难",
  "Aldur's Watchtower": "艾尔多的守卫",
  "Immortal King": "不朽之王",
  "Tal Rasha's Wrappings": "塔·拉夏的外袍",
  "Griswold's Legacy": "格瑞斯华尔德的传奇",
  "Trang-Oul's Avatar": "塔格奥的化身",
  "M'avina's Battle Hymn": "马维娜的战斗诗歌",
  "The Disciple": "门徒",
  "Heaven's Brethren": "天堂的信徒",
  "Orphan's Call": "孤儿的呼唤",
  "Hwanin's Majesty": "桓因的威严",
  "Sazabi's Grand Tribute": "沙撒璧的宏伟贡品",
  "Bul-Kathos' Children": "布尔凯索的子嗣",
  "Cow King's Leathers": "牛魔王之皮甲",
  "Naj's Ancient Vestige": "娜吉的远古遗迹",
  "Sander's Folly": "山德的愚行",
  "Natalya's Totem": "娜塔亚的图腾",
  "Natalya's Mark": "娜塔亚的记号",
  "Natalya's Shadow": "娜塔亚的影子",
  "Natalya's Soul": "娜塔亚的灵魂",
  "Aldur's Stony Gaze": "艾尔多的冷酷凝视",
  "Aldur's Deception": "艾尔多的欺瞒",
  "Aldur's Gauntlet": "艾尔多的节奏",
  "Aldur's Rhythm": "艾尔多的节奏",
  "Aldur's Advance": "艾尔多的成长",
  "Immortal King's Will": "不朽之王的意志",
  "Immortal King's Soul Cage": "不朽之王的灵魂牢笼",
  "Immortal King's Soul Cage ": "不朽之王的灵魂牢笼",
  "Immortal King's Detail": "不朽之王的琐事",
  "Immortal King's Forge": "不朽之王的熔炉",
  "Immortal King's Pillar": "不朽之王的之柱",
  "Immortal King's Stone Crusher": "不朽之王的碎魂者",
  "Tal Rasha's Fire-Spun Cloth": "塔·拉夏的织细衣服",
  "Tal Rasha's Fine-Spun Cloth": "塔·拉夏的织细衣服",
  "Tal Rasha's Adjudication": "塔·拉夏的判决",
  "Tal Rasha's Lidless Eye": "塔·拉夏的无睑之眼",
  "Tal Rasha's Guardianship": "塔·拉夏的守护",
  "Tal Rasha's Horadric Crest": "塔·拉夏的赫拉迪克纹章",
  "Griswold's Valor": "格瑞斯华尔德的勇气",
  "Griswold's Heart": "格瑞斯华尔德的之心",
  "Griswold's Redemption": "格瑞斯华尔德的救赎",
  "Griswold's Honor": "格瑞斯华尔德的荣耀",
  "Trang-Oul's Guise": "塔格奥之外装",
  "Trang-Oul's Scales": "塔格奥之鳞",
  "Trang-Oul's Wing": "塔格奥之翼",
  "Trang-Oul's Claws": "塔格奥之爪",
  "Trang-Oul's Girth": "塔格奥之束带",
  "M'avina's True Sight": "马维娜的真实之眼",
  "M'avina's Embrace": "马维娜的拥抱",
  "M'avina's Icy Clutch": "马维娜的冰握",
  "M'avina's Tenet": "马维娜的教义",
  "M'avina's Caster": "马维娜的施展",
  "Telling of Beads": "珠串之语",
  "Laying of Hands": "安置手礼",
  "Rite of Passage": "脚踝之礼",
  "Dark Adherent": "幽暗信徒",
  "Credendum": "信条",
  "Dangoon's Teaching": "檀君的教导",
  "Taebaek's Glory": "太白的荣耀",
  "Haemosu's Adamant": "解慕漱的坚决",
  "Ondal's Almighty": "奥达尔的全能",
  "Guillaume's Face": "吉永之脸",
  "Wilhelm's Pride": "威廉的自尊",
  "Magnus' Skin": "马格纳斯之皮",
  "Whitstan's Guard": "维斯坦的武装",
  "Hwanin's Splendor": "桓因的光辉",
  "Hwanin's Refuge": "桓因的庇护",
  "Hwanin's Blessing": "桓因的祝福",
  "Hwanin's Justice": "桓因的正义",
  "Sazabi's Cobalt Redeemer": "沙撒璧的钴蓝救世主",
  "Sazabi's Ghost Liberator": "沙撒璧的鬼魂释放者",
  "Sazabi's Mental Sheath": "沙撒璧的精神之鞘",
  "Bul-Kathos' Sacred Charge": "布尔凯索的神圣代价",
  "Bul-Kathos' Tribal Guardian": "布尔凯索的部族守护",
  "Cow King's Horns": "牛魔王之角",
  "Cow King's Hide": "牛魔王之皮",
  "Cow King's Hooves": "牛魔王之蹄",
  "Naj's Puzzler": "娜吉的解谜杖",
  "Naj's Light Plate": "娜吉的轻凯甲",
  "Naj's Circlet": "娜吉的小环冠",
  "Sander's Paragon": "山德的模范",
  "Sander's Riprap": "山德的碎石",
  "Sander's Taboo": "山德的禁忌",
  "Sander's Superstition": "山德的迷信",
  "Tal Rasha's Howling Wind": "塔·拉夏的守护",
  "Griswolds's Redemption": "格瑞斯华尔德的救赎",
  "Spiritual Custodian": "幽暗信徒",
  "Heaven's Taebaek": "太白的荣耀",
  "Haemosu's Adament": "解慕漱的坚决",
  "Wihtstan's Guard": "维斯坦的武装",
  "Hwanin's Seal": "桓因的祝福",
  "Cow King's Hoofs": "牛魔王之蹄",
  "McAuley's Paragon": "山德的模范",
  "McAuley's Riprap": "山德的碎石",
  "McAuley's Taboo": "山德的禁忌",
  "McAuley's Superstition": "山德的迷信",
  "Runeword1": "远古誓言",
  "Ancients' Pledge": "远古誓言",
  "Ancient's Pledge": "远古誓言",
  "Runeword4": "野兽",
  "Beast": "野兽",
  "The Beast": "野兽",
  "Runeword6": "黑色",
  "Black": "黑色",
  "Runeword8": "骸骨",
  "Bone": "骸骨",
  "Runeword9": "野蔷薇",
  "Bramble": "野蔷薇",
  "Runeword10": "烙印",
  "Brand": "烙印",
  "Runeword11": "死亡呼吸",
  "Breath of the Dying": "死亡呼吸",
  "Runeword13": "战争召唤",
  "Call to Arms": "战争召唤",
  "Runeword14": "荣耀之链",
  "Chains of Honor": "荣耀之链",
  "Bound by Duty": "荣耀之链",
  "Runeword16": "混沌",
  "Chaos": "混沌",
  "Runeword17": "新月",
  "Runeword20": "死神",
  "Death": "死神",
  "Runeword22": "迪勒瑞姆",
  "Delirium": "迪勒瑞姆",
  "Runeword25": "毁灭",
  "Destruction": "毁灭",
  "Runeword26": "末日",
  "Doom": "末日",
  "Doomsayer": "末日",
  "Runeword27": "飞龙",
  "Dragon": "飞龙",
  "Runeword29": "梦境",
  "Dream": "梦境",
  "Runeword30": "强制",
  "Duress": "强制",
  "Runeword31": "边缘",
  "Edge": "边缘",
  "Runeword33": "谜团",
  "Enigma": "谜团",
  "Runeword34": "启迪",
  "Enlightenment": "启迪",
  "Runeword36": "永恒",
  "Eternity": "永恒",
  "Runeword37": "流亡",
  "Exile": "流亡",
  "Exile's Path": "流亡",
  "Runeword38": "信心",
  "Faith": "信心",
  "Runeword39": "饥荒",
  "Famine": "饥荒",
  "Runeword41": "刚毅",
  "Fortitude": "刚毅",
  "Runeword44": "狂怒",
  "Fury": "狂怒",
  "Runeword45": "幽暗",
  "Gloom": "幽暗",
  "Runeword47": "悔恨",
  "Grief": "悔恨",
  "Runeword48": "正义之手",
  "Hand of Justice": "正义之手",
  "Runeword49": "和谐",
  "Harmony": "和谐",
  "Runeword51": "橡树之心",
  "Heart of the Oak": "橡树之心",
  "Runeword54": "圣雷",
  "Holy Thunder": "圣雷",
  "Runeword55": "荣耀",
  "Honor": "荣耀",
  "Runeword59": "寒冰",
  "Ice": "寒冰",
  "Runeword60": "无限",
  "Infinity": "无限",
  "Runeword62": "眼光",
  "Insight": "眼光",
  "Runeword65": "国王之恩典",
  "King's Grace": "国王之恩典",
  "Runeword66": "弑君者",
  "Kingslayer": "弑君者",
  "Runeword69": "最后希望",
  "Last Wish": "最后希望",
  "Runeword71": "执法者",
  "Lawbringer": "执法者",
  "Runeword72": "叶",
  "Leaf": "叶",
  "Runeword74": "狮心",
  "Lionheart": "狮心",
  "Runeword75": "知识",
  "Lore": "知识",
  "Runeword81": "怨恨",
  "Malice": "怨恨",
  "Runeword82": "旋律",
  "Melody": "旋律",
  "Runeword83": "记忆",
  "Memory": "记忆",
  "Runeword87": "神话",
  "Myth": "神话",
  "Runeword88": "底韵",
  "Nadir": "底韵",
  "Runeword91": "誓约",
  "Oath": "誓约",
  "Runeword92": "遵从",
  "Obedience": "遵从",
  "Runeword95": "热情",
  "Passion": "热情",
  "Runeword98": "和平",
  "Peace": "和平",
  "Runeword99": "理性之声",
  "Voice of Reason": "理性之声",
  "Winter": "理性之声",
  "Runeword103": "凤凰",
  "Phoenix": "凤凰",
  "Runeword109": "骄傲",
  "Pride": "骄傲",
  "Runeword110": "原则",
  "Principle": "原则",
  "Runeword112": "审慎",
  "Prudence": "审慎",
  "Runeword116": "光辉",
  "Radiance": "光辉",
  "Runeword117": "雨",
  "Rain": "雨",
  "Runeword120": "押韵",
  "Rhyme": "押韵",
  "Runeword121": "裂隙",
  "Rift": "裂隙",
  "Runeword122": "圣堂",
  "Sanctuary": "圣堂",
  "Runeword126": "寂静",
  "Silence": "寂静",
  "Runeword128": "烟雾",
  "Smoke": "烟雾",
  "Runeword130": "精神",
  "Spirit": "精神",
  "Runeword131": "灿烂",
  "Splendor": "灿烂",
  "Runeword133": "隐秘",
  "Stealth": "隐秘",
  "Runeword134": "钢铁",
  "Steel": "钢铁",
  "Runeword137": "石块",
  "Stone": "石块",
  "Runeword139": "力量",
  "Strength": "力量",
  "Runeword148": "背信",
  "Treachery": "背信",
  "Runeword154": "毒液",
  "Venom": "毒液",
  "Runeword160": "财富",
  "Wealth": "财富",
  "Runeword162": "白色",
  "White": "白色",
  "Runeword163": "风",
  "Wind": "风",
  "Runeword168": "愤怒",
  "Wrath": "愤怒",
  "Runeword170": "和风",
  "Zephyr": "和风",
  "cap": "帽子",
  "skp": "骷髅帽",
  "hlm": "头盔",
  "fhl": "高级头盔",
  "ghm": "卓越头盔",
  "crn": "皇冠",
  "msk": "面具",
  "qui": "布甲",
  "lea": "皮甲",
  "hla": "硬皮甲",
  "stu": "镶嵌甲",
  "rng": "锁环甲",
  "scl": "鳞甲",
  "chn": "锁子甲",
  "brs": "胸甲",
  "spl": "板甲",
  "plt": "铠甲",
  "fld": "实战铠甲",
  "gth": "哥德战甲",
  "ful": "高级战甲",
  "aar": "古代装甲",
  "ltp": "轻型装甲",
  "buc": "圆盾",
  "sml": "小盾牌",
  "lrg": "大盾牌",
  "kit": "轻盾",
  "tow": "塔盾",
  "gts": "哥德盾牌",
  "lgl": "皮手套",
  "vgl": "重手套",
  "mgl": "锁链手套",
  "tgl": "轻型铁手套",
  "hgl": "铁手套",
  "lbt": "皮靴",
  "vbt": "重靴",
  "mbt": "锁链靴",
  "tbt": "轻型金属靴",
  "hbt": "护胫",
  "lbl": "饰带",
  "vbl": "轻扣带",
  "mbl": "扣带",
  "tbl": "重扣带",
  "hbl": "金属扣带",
  "bhm": "白骨头盔",
  "bsh": "白骨盾牌",
  "spk": "尖刺盾牌",
  "xap": "战帽",
  "xkp": "轻便头盔",
  "xlm": "无颊头盔",
  "xhl": "轻钢灰",
  "xhm": "翼盔",
  "xrn": "巨皇冠",
  "xsk": "死亡面具",
  "xui": "鬼魂战甲",
  "xea": "海蛇皮甲",
  "xla": "魔皮战甲",
  "xtu": "攀绕战甲",
  "xng": "连扣战甲",
  "xcl": "提格莱特战甲",
  "xhn": "织网战甲",
  "xrs": "护胸甲",
  "xpl": "罗瑟战甲",
  "xlt": "圣堂武士外袍",
  "xld": "鲨齿战甲",
  "xth": "凸纹战甲",
  "xul": "混沌战甲",
  "xar": "华丽战甲",
  "xtp": "法师铠甲",
  "xuc": "防御盾",
  "xml": "圆型盾",
  "xrg": "鳞盾",
  "xit": "龙盾",
  "xow": "大盾",
  "xts": "古代之盾",
  "xlg": "魔皮手套",
  "xvg": "鲨鱼皮套",
  "xmg": "重型手镯",
  "xtg": "战场手套",
  "xhg": "巨战手套",
  "xlb": "魔皮靴",
  "xvb": "鲨皮之靴",
  "xmb": "织网之靴",
  "xtb": "战场之靴",
  "xhb": "巨战之靴",
  "zlb": "魔皮勋带",
  "zvb": "鲨皮腰带",
  "zmb": "织网腰带",
  "ztb": "战场腰带",
  "zhb": "巨战腰带",
  "xh9": "残酷头盔",
  "xsh": "冷酷之盾",
  "xpk": "倒刺护盾",
  "dr1": "狼头",
  "dr2": "鹰盔",
  "dr3": "鹿角",
  "dr4": "猎鹰面具",
  "dr5": "灵魂面具",
  "ba1": "颚骨帽",
  "ba2": "尖牙盔",
  "ba3": "角盔",
  "ba4": "突击盔",
  "ba5": "复仇者之盔",
  "pa1": "圆盾",
  "pa2": "饰盾",
  "pa3": "纹章盾",
  "pa4": "艾尔之盾",
  "pa5": "皇冠之盾",
  "ne1": "防腐之首",
  "ne2": "僵尸之首",
  "ne3": "揭露者之首",
  "ne4": "石像鬼之首",
  "ne5": "恶魔之首",
  "ci0": "头环",
  "ci1": "宝冠",
  "ci2": "三重冠",
  "ci3": "权冠",
  "uap": "军帽",
  "ukp": "九头蛇头盖骨盔",
  "ulm": "活动面甲",
  "uhl": "巨型海螺",
  "uhm": "螺旋头盔",
  "urn": "皇冠之冠",
  "usk": "恶魔头盖骨面具",
  "uui": "暮色寿衣",
  "uea": "古龙皮",
  "ula": "圣甲虫壳皮甲",
  "utu": "线羊毛皮甲",
  "ung": "钻石锁子甲",
  "ucl": "甲片甲",
  "uhn": "骸骨链甲",
  "urs": "巨型鳞铠胸甲",
  "upl": "炎魔皮板甲",
  "ult": "地狱锻甲",
  "uld": "海妖壳甲",
  "uth": "漆甲",
  "uul": "阴影铠甲",
  "uar": "神圣盔甲",
  "utp": "执政官铠甲",
  "uuc": "小圆盾",
  "uml": "月精灵护盾",
  "urg": "亥伯龙之盾",
  "uit": "统治者大盾",
  "uow": "宙斯之盾",
  "uts": "保护盾牌",
  "ulg": "荆棘连指手套",
  "uvg": "吸血鬼骸骨手套",
  "umg": "吸血鬼护腕",
  "utg": "十字军铁手套",
  "uhg": "食人魔铁手套",
  "ulb": "古龙皮靴",
  "uvb": "圣甲虫壳靴",
  "umb": "骸骨靴",
  "utb": "镜化靴",
  "uhb": "急速靴",
  "ulc": "蛛网腰带",
  "uvc": "吸血鬼獠牙腰带",
  "umc": "秘银腰带",
  "utc": "巨魔腰带",
  "uhc": "巨神腰带",
  "uh9": "骸骨面罩",
  "ush": "巨魔巢穴骨盾",
  "upk": "刀刃刺盾",
  "dr6": "阿尔法头盔",
  "dr7": "狮鹫兽头饰",
  "dr8": "猎人的伪装",
  "dr9": "神圣羽毛",
  "dra": "图腾面具",
  "ba6": "颚骨面甲",
  "ba7": "狮头尖盔",
  "ba8": "狂怒面具",
  "ba9": "野蛮人头盔",
  "baa": "屠杀者护面",
  "pa6": "阿卡拉圆盾",
  "pa7": "阿卡拉饰盾",
  "pa8": "保护者盾牌",
  "pa9": "饰金盾牌",
  "paa": "皇家盾牌",
  "ne6": "木乃伊印记",
  "ne7": "物神印记",
  "ne8": "教堂司事印记",
  "ne9": "领唱者印记",
  "nea": "教皇印记",
  "drb": "鲜血之灵",
  "drc": "太阳之灵",
  "drd": "大地之灵",
  "dre": "天空之灵",
  "drf": "梦境之灵",
  "bab": "杀戮头盔",
  "bac": "狂暴面甲",
  "bad": "毁灭者头盔",
  "bae": "征服者皇冠",
  "baf": "守护者皇冠",
  "pab": "神圣小盾",
  "pac": "神圣轻圆盾",
  "pad": "库拉斯特之盾",
  "pae": "撒卡兰姆盾牌",
  "paf": "旋风盾",
  "neb": "仆从头骨",
  "neg": "地狱爪牙之骨",
  "ned": "监督者头骨",
  "nee": "女妖头骨",
  "nef": "血王头骨",
  "hax": "手斧",
  "axe": "斧",
  "2ax": "双刃斧",
  "mpi": "军用锹",
  "wax": "巨战斧",
  "lax": "巨斧",
  "bax": "阔斧",
  "btx": "战斗斧",
  "gax": "卓越之斧",
  "gix": "大斧",
  "wnd": "法杖",
  "ywn": "紫杉之杖",
  "bwn": "骨杖",
  "gwn": "残酷之杖",
  "clb": "木棒",
  "scp": "权杖",
  "gsc": "雄伟权杖",
  "wsp": "巨战权杖",
  "spc": "狼牙棒",
  "mac": "钉头锤",
  "mst": "流星锤",
  "fla": "连枷",
  "whm": "巨战铁锤",
  "mau": "大木棍",
  "gma": "卓越巨棍",
  "ssd": "短剑",
  "scm": "弯刀",
  "sbr": "军刀",
  "flc": "弯形大刀",
  "crs": "水晶剑",
  "bsd": "阔剑",
  "lsd": "长剑",
  "wsd": "巨战之剑",
  "2hs": "双手剑",
  "clm": "双刃大刀",
  "gis": "大剑",
  "bsw": "巨剑",
  "flb": "双手饰剑",
  "gsd": "卓越之剑",
  "dgr": "匕首",
  "dir": "长匕首",
  "kri": "波形刀",
  "bld": "短刀",
  "tkf": "飞刀",
  "tax": "飞斧",
  "bkf": "平衡小刀",
  "bal": "平衡斧",
  "jav": "标枪",
  "pil": "短镖枪",
  "ssp": "短矛",
  "glv": "大长刀",
  "tsp": "飞矛",
  "spr": "长矛",
  "tri": "三叉戟",
  "brn": "叉",
  "spt": "大战戟",
  "pik": "矛",
  "bar": "大砍刀",
  "vou": "钩镰枪",
  "scy": "镰刀",
  "pax": "长柄战斧",
  "hal": "长戟",
  "wsc": "巨战镰刀",
  "sst": "短棍",
  "lst": "长棍",
  "cst": "多节棍",
  "bst": "战斗法杖",
  "wst": "巨战法杖",
  "sbw": "短弓",
  "hbw": "猎弓",
  "lbw": "长弓",
  "cbw": "组合弓",
  "sbb": "短战斗弓",
  "lbb": "长战斗弓",
  "swb": "短巨战弓",
  "lwb": "长巨战弓",
  "lxb": "轻十字弓",
  "mxb": "十字弓",
  "hxb": "重十字弓",
  "rxb": "连射十字弓",
  "gps": "恶臭瓦斯药剂",
  "ops": "油",
  "gpm": "窒息瓦斯药剂",
  "opm": "爆炸药剂",
  "gpl": "勒颈瓦斯药剂",
  "opl": "猛爆性药剂",
  "d33": "吉得宾诱饵",
  "g33": "吉得宾",
  "leg": "维特之脚",
  "hdm": "赫拉迪克.马勒斯",
  "hfh": "地狱熔炉铁锤",
  "hst": "赫拉迪克之杖",
  "msf": "赫拉迪克之杖的转轴",
  "9ha": "小斧",
  "9ax": "切肉斧",
  "92a": "强化双斧",
  "9mp": "喙钳",
  "9wa": "纳卡",
  "9la": "军斧",
  "9ba": "钩斧",
  "9bt": "斗战斧",
  "9ga": "哥德之斧",
  "9gi": "古代之斧",
  "9wn": "烧焦之杖",
  "9yw": "净化之杖",
  "9bw": "古墓之杖",
  "9gw": "墓地之杖",
  "9cl": "棍棒",
  "9sc": "符文权杖",
  "9qs": "圣水喷杖",
  "9ws": "神属权杖",
  "9sp": "倒钩锤",
  "9ma": "凸缘钉头锤",
  "9mt": "锯齿流星锤",
  "9fl": "皮鞭",
  "9wh": "战斗铁锤",
  "9m9": "巨战木棍",
  "9gm": "战槌",
  "9ss": "罗马短剑",
  "9sm": "微弯剑",
  "9sb": "虚伪之刃",
  "9fc": "圆月弯刀",
  "9cr": "空间之刃",
  "9bs": "战斗剑",
  "9ls": "符文剑",
  "9wd": "古代之剑",
  "92h": "斩铁剑",
  "9cm": "双刃镰",
  "9gs": "长牙剑",
  "9b9": "哥德剑",
  "9fb": "瑞韩德",
  "9gd": "死刑之剑",
  "9dg": "锐匕",
  "9di": "诗歌匕首",
  "9kr": "强波刀",
  "9bl": "小剑",
  "9tk": "战斗飞镖",
  "9ta": "法兰飞斧",
  "9bk": "巨战飞标",
  "9b8": "戟",
  "9ja": "巨战标枪",
  "9pi": "卓越标枪",
  "9s9": "锐矛",
  "9gl": "阔针剑",
  "9ts": "鱼叉",
  "9sr": "巨战长矛",
  "9tr": "弗斯西那",
  "9br": "巨战之叉",
  "9st": "亚利",
  "9p9": "长枪",
  "9b7": "罗佳柏斧",
  "9vo": "比尔",
  "9s8": "战斗镰刀",
  "9pa": "战戟",
  "9h9": "双锋战戟",
  "9wc": "残酷镰刀",
  "8ss": "乔木棒",
  "8ls": "六尺棍",
  "8cs": "杉木之棍",
  "8bs": "哥德之棍",
  "8ws": "符文之棍",
  "8sb": "锋锐之弓",
  "8hb": "剃刀之弓",
  "8lb": "杉木弓",
  "8cb": "双弓",
  "8s8": "短攻城弓",
  "8l8": "长攻城弓",
  "8sw": "符文之弓",
  "8lw": "哥德弓",
  "8lx": "石弓",
  "8mx": "攻城十字弓",
  "8hx": "弩弓",
  "8rx": "巧工弩",
  "qf1": "克林姆的连枷",
  "qf2": "克林姆的意志",
  "ktr": "拳剑",
  "wrb": "腕刀",
  "axf": "手斧爪",
  "ces": "皮手甲",
  "clw": "爪",
  "btl": "刃爪",
  "skr": "剪咬刀",
  "9ar": "格斗剪",
  "9wb": "腕刺",
  "9xf": "格斗爪",
  "9cs": "手镰",
  "9lw": "巨爪",
  "9tw": "巨鹰爪",
  "9qr": "近身剪",
  "7ar": "近身刃",
  "7wb": "腕剑",
  "7xf": "战拳",
  "7cs": "斗腰刀",
  "7lw": "猛禽爪",
  "7tw": "符纹爪",
  "7qr": "近身剪刃",
  "7ha": "印第安战斧",
  "7ax": "小月斧",
  "72a": "双头斧",
  "7mp": "战刺",
  "7wa": "狂战士斧",
  "7la": "狂野之斧",
  "7ba": "银刃斧",
  "7bt": "斩首斧",
  "7ga": "冠军之斧",
  "7gi": "光荣之斧",
  "7wn": "磨光法杖",
  "7yw": "鬼魂法杖",
  "7bw": "巫妖法杖",
  "7gw": "破隐法杖",
  "7cl": "短棒",
  "7sc": "强威权杖",
  "7qs": "炽天使法杖",
  "7ws": "神使之杖",
  "7sp": "暴君之棒",
  "7ma": "强化钉锤",
  "7mt": "恶魔流星锤",
  "7fl": "天罚之锤",
  "7wh": "传说之锤",
  "7m7": "食人魔之锤",
  "7gm": "雷霆之锤",
  "7ss": "弯形大刀",
  "7sm": "土耳其剑",
  "7sb": "优雅之剑",
  "7fc": "九头蛇刃",
  "7cr": "幻化之刃",
  "7bs": "征服之剑",
  "7ls": "神秘之剑",
  "7wd": "神话之剑",
  "72h": "传说之剑",
  "7cm": "高地之剑",
  "7gs": "炎魔之刃",
  "7b7": "冠军之剑",
  "7fb": "巨神之剑",
  "7gd": "巨神之刃",
  "7dg": "骸骨小刀",
  "7di": "秘银小刀",
  "7kr": "尖牙小刀",
  "7bl": "传说尖刺",
  "7tk": "飞刀",
  "7ta": "飞斧",
  "7bk": "翼刀",
  "7b8": "翼斧",
  "7ja": "亥伯龙标枪",
  "7pi": "冥河标枪",
  "7s7": "炎魔长矛",
  "7gl": "鬼魂尖枪",
  "7ts": "翼鱼叉",
  "7sr": "亥伯龙之矛",
  "7tr": "冥河长枪",
  "7br": "捕人叉",
  "7st": "鬼魂之矛",
  "7p7": "战枪",
  "7o7": "食人魔之斧",
  "7vo": "巨神之斧",
  "7s8": "锐利之斧",
  "7pa": "神秘之斧",
  "7h7": "巨长斧",
  "7wc": "巨型锐利之斧",
  "6ss": "手杖",
  "6ls": "石笋之杖",
  "6cs": "长老之杖",
  "6bs": "橡木棍",
  "6ws": "执政官之杖",
  "6sb": "蜘蛛之弓",
  "6hb": "刀锋之弓",
  "6lb": "阴影之弓",
  "6cb": "巨弓",
  "6s7": "钻石之弓",
  "6l7": "十字军之弓",
  "6sw": "庇护之弓",
  "6lw": "九头蛇弓",
  "6lx": "弹丸弩",
  "6mx": "蛇发女妖十字弓",
  "6hx": "巨神十字弓",
  "6rx": "恶魔十字弓",
  "ob1": "鹰眼法珠",
  "ob2": "神圣天球",
  "ob3": "烟雾法球",
  "ob4": "紧握法珠",
  "ob5": "贾瑞德之石",
  "am1": "牡鹿之弓",
  "am2": "反射之弓",
  "am3": "少女之矛",
  "am4": "少女长矛",
  "am5": "少女标枪",
  "ob6": "发光法珠",
  "ob7": "水晶天球",
  "ob8": "云雾法球",
  "ob9": "闪耀法球",
  "oba": "涡流水晶",
  "am6": "白蜡木弓",
  "am7": "祭典之弓",
  "am8": "祭典之矛",
  "am9": "祭典长矛",
  "ama": "祭典标枪",
  "obb": "天堂之石",
  "obc": "怪异法球",
  "obd": "恶魔之心",
  "obe": "漩涡法珠",
  "obf": "次元碎片",
  "amb": "女族长之弓",
  "amc": "大院长之弓",
  "amd": "女族长之矛",
  "ame": "女族长之长矛",
  "amf": "女族长之标枪",
  "elx": "灵药",
  "vps": "体力药剂",
  "yps": "解毒药剂",
  "rvs": "回复活力药剂",
  "rvl": "全面回复活力药剂",
  "wms": "融解药剂",
  "tbk": "城镇传送之书",
  "ibk": "辨视之书",
  "amu": "护身符",
  "vip": "赫拉迪克之杖顶端",
  "rin": "戒指",
  "gld": "黄金",
  "bks": "艾尼弗斯卷轴",
  "bkd": "石冢之钥",
  "aqv": "箭矢",
  "tch": "火焰",
  "cqv": "十字弓弹",
  "tsc": "城镇传送卷轴",
  "isc": "辨视卷轴",
  "hrt": "一股邪恶力量",
  "brz": "一股邪恶力量",
  "jaw": "一股邪恶力量",
  "eyz": "一股邪恶力量",
  "hrn": "角",
  "tal": "一股邪恶力量",
  "flg": "一股邪恶力量",
  "fng": "一股邪恶力量",
  "qll": "一股邪恶力量",
  "sol": "灵魂之",
  "scz": "一股邪恶力量",
  "spe": "一股邪恶力量",
  "key": "钥匙",
  "luv": "黑塔之钥",
  "xyz": "生命药剂",
  "j34": "玉制小人",
  "g34": "黄金鸟",
  "bbb": "蓝.依森之书",
  "box": "赫拉迪克方块",
  "tr1": "赫拉迪克卷轴",
  "mss": "墨菲斯托的灵魂之石",
  "ass": "技能之书",
  "qey": "克林姆的眼球",
  "qhr": "克林姆的心脏",
  "qbr": "克林姆的大脑",
  "ear": "耳",
  "gcv": "碎裂的紫宝石",
  "gfv": "裂开的紫宝石",
  "gsv": "紫宝石",
  "gzv": "无暇疵的紫宝石",
  "gpv": "完美的紫宝石",
  "gcy": "碎裂的黄宝石",
  "gfy": "裂开的黄宝石",
  "gsy": "黄宝石",
  "gly": "无暇疵的黄宝石",
  "gpy": "完美的黄宝石",
  "gcb": "碎裂的蓝宝石",
  "gfb": "裂开的蓝宝石",
  "gsb": "蓝宝石",
  "glb": "无暇疵的蓝宝石",
  "gpb": "完美的蓝宝石",
  "gcg": "碎裂的绿宝石",
  "gfg": "裂开的绿宝石",
  "gsg": "绿宝石",
  "glg": "无暇疵的绿宝石",
  "gpg": "完美的绿宝石",
  "gcr": "碎裂的红宝石",
  "gfr": "裂开的红宝石",
  "gsr": "红宝石",
  "glr": "无暇疵的红宝石",
  "gpr": "完美的红宝石",
  "gcw": "碎裂的钻石",
  "gfw": "裂开的钻石",
  "gsw": "钻石",
  "glw": "无暇疵的钻石",
  "gpw": "完美的钻石",
  "hp1": "轻微治疗药剂",
  "hp2": "轻型治疗药剂",
  "hp3": "治疗药剂",
  "hp4": "强力药剂",
  "hp5": "超级治疗药剂",
  "mp1": "轻微法力药剂",
  "mp2": "轻型法力药剂",
  "mp3": "法力药剂",
  "mp4": "强力法力药剂",
  "mp5": "超级法力药剂",
  "skc": "碎裂的骷髅",
  "skf": "裂开的骷髅",
  "sku": "骷髅",
  "skl": "无暇疵的骷髅",
  "skz": "完美的骷髅",
  "hrb": "药草",
  "cm1": "小护身符",
  "cm2": "大型护身符",
  "cm3": "超大型护身符",
  "r13": "符文：夏",
  "r16": "符文：破",
  "r31": "符文：乔",
  "jew": "珠宝",
  "ice": "玛拉的药剂",
  "tr2": "抗性卷轴",
  "pk1": "恐惧之钥",
  "pk2": "憎恨之钥",
  "pk3": "毁灭之钥",
  "dhn": "暗黑破坏神之角",
  "bey": "巴尔之眼",
  "mbr": "曼菲斯托之脑",
  "toa": "赦免徽章",
  "tes": "扭曲的苦痛精华",
  "ceh": "充盈的憎恨精华",
  "bet": "燃烧的恐惧精华",
  "fed": "溃烂的毁灭精华",
  "std": "英雄旗帜",
  "Naj's Ancient Set": "娜吉的远古遗迹",
  "McAuley's Folly": "山德的愚行",
  "Crude": "粗制的",
  "Cracked": "破碎的",
  "Damaged": "损坏的",
  "Low Quality": "劣质的"
}

/**
 * Magic Prefixes.
 */
export const MAGIC_PREFIX_ZH: Record<string, string> = {
  "Accursed": "诅咒之",
  "Acrobat's": "杂技之",
  "Amber": "琥珀之",
  "Ambergris": "龙涎香之",
  "Amethyst": "紫水晶之",
  "Angel's": "天使之",
  "Antimagic": "防魔之",
  "Arcadian": "阿卡迪亚之",
  "Arch-Angel's": "大天使之",
  "Archer's": "弓箭手之",
  "Arcing": "电弧之",
  "Argent": "白银之",
  "Artificer's": "工匠之",
  "Assamic": "阿萨姆之",
  "Astral": "星界之",
  "Athlete": "运动之",
  "Athlete's": "运动之",
  "Aureolin": "钴黄之",
  "Azure": "天青之",
  "Bahamut's": "巴哈姆特之",
  "Beryl": "海蓝之",
  "Berserker's": "狂战士之",
  "Bishop's": "主教之",
  "Blanched": "漂白之",
  "Blank": "虚无之",
  "Blazing": "炽热之",
  "Blessed": "祝福之",
  "Blighting": "枯萎之",
  "Bloody": "血腥之",
  "Bone": "白骨之",
  "Boreal": "极北之",
  "Bowyer's": "弓箭手之",
  "Bright": "光明之",
  "Bronze": "青铜之",
  "Brown": "棕褐之",
  "Brutal": "残忍之",
  "Burgundy": "红棕之",
  "Burly": "魁梧之",
  "Burning": "燃烧之",
  "Buzzing": "嗡鸣之",
  "Calling": "呼唤之",
  "Camphor": "樟脑之",
  "Captain's": "领袖之",
  "Carbuncle": "痈肿之",
  "Caretaker's": "看顾者之",
  "Carmine": "洋红之",
  "Celestial": "天界之",
  "Charged": "充能之",
  "Chestnut": "栗色之",
  "Chilling": "严寒之",
  "Chromatic": "炫彩之",
  "Cinnabar": "朱砂之",
  "Cobalt": "钴之",
  "Commander's": "指挥官之",
  "Communal": "公社之",
  "Compact": "紧密之",
  "Consecrated": "奉献之",
  "Coral": "珊瑚之",
  "Corosive": "腐蚀之",
  "Crimson": "枣红之",
  "Cruel": "残忍之",
  "Cunning": "狡黠之",
  "Deadly": "致命之",
  "Dense": "致密之",
  "Devious": "迂回之",
  "Diamond": "钻石之",
  "Divine": "神圣之",
  "Dragon's": "龙之",
  "Drake's": "德尔克之",
  "Dun": "黑褐之",
  "Eagleeye": "雕眼之",
  "Earth": "大地之",
  "Eburin": "象牙之",
  "Echoing": "回音之",
  "Elysian": "极乐之",
  "Ember": "余烬之",
  "Emerald": "祖母绿之",
  "Entrapping": "陷阱之",
  "Envenomed": "腐烂之",
  "Eocene": "始新世之",
  "Expert's": "专家之",
  "Falconeye": "猎鹰之眼",
  "Fanatic": "狂热之",
  "Felicitous": "吉庆之",
  "Feral": "野性之",
  "Ferocious": "凶猛之",
  "Fine": "精良之",
  "Flaming": "烈焰之",
  "Fletcher's": "制箭者之",
  "Fool's": "胜者之",
  "Forked": "分叉之",
  "Fortified": "防御强化之",
  "Fortuitous": "偶然之",
  "Freezing": "冰冻之",
  "Fungal": "真菌之",
  "Furious": "狂怒之",
  "Gaea's": "大地之",
  "Gaia": "大地之",
  "Garnet": "深红之",
  "Glacial": "极冰之",
  "Glimmering": "微光之",
  "Glorious": "光荣之",
  "Glowing": "发光之",
  "Godly": "神圣之",
  "Gold": "金之",
  "Golemlord": "魔像领主之",
  "Golemlord's": "魔像领主之",
  "Grandmaster's": "宗师之",
  "Graverobber's": "盗墓者之",
  "Great Wyrm's": "大巨龙之",
  "Gritty": "坚韧之",
  "Guardian's": "护卫者之",
  "Gymnastic": "体操之",
  "Gymnast's": "体操之",
  "Hallowed": "神圣之",
  "Harpoonist's": "标枪之",
  "Hawk Branded": "鹰之烙印之",
  "Hawkeye": "鹰眼之",
  "Hexing": "诅咒之",
  "Hibernal": "极寒之",
  "Hierophant's": "教皇之",
  "Holy": "神圣之",
  "Howling": "咆哮之",
  "Iron": "铁之",
  "Ivory": "象牙之",
  "Jacinth": "风信子石之",
  "Jack's": "随从之",
  "Jade": "翠绿之",
  "Jagged": "锯齿之",
  "Jester's": "弄臣之",
  "Jeweler's": "珠宝匠之",
  "Joker's": "小丑之",
  "Kenshi's": "剑士之",
  "Keeper's": "守护者之",
  "King's": "国王之",
  "Knave's": "盗贼之",
  "Knight's": "骑士之",
  "Lancer's": "长矛手之",
  "Lapis": "天蓝之",
  "Lapis Lazuli": "青金石之",
  "Lion Branded": "狮子烙印之",
  "Lizard's": "蜥蜴之",
  "Lord's": "君王之",
  "Loud": "响亮之",
  "Lucky": "幸运之",
  "Magekiller's": "法师杀手之",
  "Maiden's": "处女之",
  "Maroon": "褐红之",
  "Marshal": "元帅之",
  "Marshal's": "元帅之",
  "Massive": "稳重之",
  "Master's": "大师之",
  "Mechanist's": "机械师之",
  "Mentalist": "通灵之",
  "Mentalist's": "通灵之",
  "Merciless": "绝情之",
  "Meteoric": "陨铁之",
  "Miocene": "中新世之",
  "Mnemonic": "记忆之",
  "Monk's": "僧人之",
  "Nature": "自然之",
  "Nature's": "自然之",
  "Necromancer": "死灵法师之",
  "Necromancer's": "死灵法师之",
  "Nickel": "白镍之",
  "Noxious": "有害之",
  "Null": "无效之",
  "Ocher": "赭黄之",
  "Oligocene": "渐新世之",
  "Paleocene": "忠诚信使之",
  "Paradox": "悖论之",
  "Patriarch's": "先知之",
  "Pearl": "珍珠之",
  "Pestilent": "瘟疫之",
  "Platinum": "白金之",
  "Powered": "能量之",
  "Preserver": "保护者之",
  "Preserver's": "保护者之",
  "Priest's": "牧师之",
  "Prismatic": "棱镜之",
  "Psychic": "心灵之",
  "Pure": "纯净之",
  "Raging": "暴怒之",
  "Rainbow": "彩虹之",
  "Realgar": "雄黄之",
  "Red": "红之",
  "Resonant": "共鸣之",
  "Robineye": "知更鸟眼之",
  "Rose Branded": "玫瑰烙印之",
  "Ruby": "红宝石之",
  "Rugged": "凹凸之",
  "Russet": "赤褐之",
  "Rusty": "生锈之",
  "Sacred": "圣洁之",
  "Saintly": "崇高之",
  "Sanguinary": "鲜血之",
  "Sapphire": "蔚蓝之",
  "Savage": "野蛮之",
  "Scarlet": "猩红之",
  "Scintillating": "闪烁之",
  "Scorching": "灼烧之",
  "Screaming": "尖叫之",
  "Sensei's": "老师之",
  "Septic": "腐臭之",
  "Serpent's": "海蛇之",
  "Serrated": "锯齿之",
  "Shadow": "阴影之",
  "Shaman's": "萨满之",
  "Sharp": "尖锐之",
  "Shimmering": "微光之",
  "Shivering": "寒颤之",
  "Shocking": "雷霆之",
  "Shogukusha's": "刺客之",
  "Shouting": "咆哮之",
  "Silver": "银之",
  "Slayer's": "屠杀者之",
  "Smoldering": "焖燃之",
  "Smoking": "烟雾之",
  "Snake's": "蛇之",
  "Snowflake": "雪花之",
  "Soldier's": "士兵之",
  "Sounding": "鸣响之",
  "Sparking": "火花之",
  "Sparroweye": "麻雀眼之",
  "Spearmaiden's": "标枪女郎之",
  "Spiritual": "精神之",
  "Stalwart": "健壮之",
  "Static": "静电之",
  "Steel": "钢之",
  "Stout": "坚固之",
  "Strange": "怪异之",
  "Strong": "强壮之",
  "Sturdy": "结实之",
  "Summoner's": "召唤者之",
  "Tangerine": "红柑之",
  "Terra's": "大地之",
  "Thin": "轻薄之",
  "Tin": "白铁之",
  "Tireless": "不倦之",
  "Topaz": "黄宝石之",
  "Toxic": "剧毒之",
  "Trainer's": "驯兽师之",
  "Trickster's": "戏法师之",
  "Triumphant": "成功之",
  "Trump": "胜者之",
  "Turquoise": "绿松石之",
  "Unearthly": "超凡之",
  "Valkyrie's": "女武神之",
  "Venomous": "剧毒之",
  "Vermillion": "朱砂之",
  "Veteran's": "老兵之",
  "Vicious": "恶毒之",
  "Victorious": "胜利之",
  "Vigorous": "强健之",
  "Viridian": "铭绿之",
  "Visionary": "梦幻之",
  "Vodoun": "伏都之",
  "Volcanic": "火山之",
  "Vulpine": "奸诈之",
  "Wailing": "哀嚎之",
  "Warden": "看守者之",
  "Warder's": "监视者之",
  "Warrior's": "战士之",
  "Weird": "怪异",
  "Witch-hunter's": "猎巫者之",
  "Wyrm's": "维特之",
  "Yelling": "呐喊之",
  "Zircon": "锆石之",
  "Eburine": "象牙之",
  "Void": "虚无之",
  "Vermilion": "朱砂之",
  "Aureolic": "钴黄之",
  "Mechanic's": "机械师之",
  "Artisan's": "工匠之",
  "Lunar": "阿萨姆之",
  "Acrobatic": "杂技之",
  "Athletic": "运动之",
  "Cursing": "诅咒之",
  "Mojo": "伏都之",
  "Warden's": "监视者之",
  "Natural": "自然之",
  "Terrene": "大地之",
  "Gaean": "大地之",
  "Enlightened": "中新世之",
  "Honorable": "渐新世之",
  "Righteous": "始新世之",
  "Faithful": "忠诚信使之",
  "Alarming": "响亮之",
  "Grinding": "坚韧之",
  "Snowy": "雪花之",
  "Fiery": "余烬之",
  "Condensing": "灼烧之",
  "Foul": "腐烂之",
  "Corrosive": "腐蚀之"
}

/**
 * Magic Suffixes (canonical 1.13c CHI .tbl convention: '…的').
 */
export const MAGIC_SUFFIX_ZH: Record<string, string> = {
  "of Absorption": "吸收",
  "Absorption": "吸收",
  "of Acceleration": "加速的",
  "Acceleration": "加速的",
  "of Accuracy": "准确的",
  "Accuracy": "准确的",
  "of Ages": "万古的",
  "Ages": "万古的",
  "of Alacrity": "轻快的",
  "Alacrity": "轻快的",
  "of Amelioration": "演进的",
  "Amelioration": "演进的",
  "of Amianthus": "石棉的",
  "Amianthus": "石棉的",
  "of Amplify Damage": "伤害加深的",
  "Amplify Damage": "伤害加深的",
  "of Anima": "生灵的",
  "Anima": "生灵的",
  "of Anthrax": "炭疽的",
  "Anthrax": "炭疽的",
  "of Armageddon": "末日风暴的",
  "Armageddon": "末日风暴的",
  "of Atlus": "阿特拉斯的",
  "Atlus": "阿特拉斯的",
  "of Attraction": "吸引的",
  "Attraction": "吸引的",
  "of Avarice": "贪婪的",
  "Avarice": "贪婪的",
  "of Balance": "平衡的",
  "Balance": "平衡的",
  "of Bashing": "重击的",
  "Bashing": "重击的",
  "of Battle Command": "战斗指挥的",
  "Battle Command": "战斗指挥的",
  "of Battle Cry": "刺耳尖叫的",
  "Battle Cry": "刺耳尖叫的",
  "of Battle Orders": "战斗体制的",
  "Battle Orders": "战斗体制的",
  "of Blaze": "炽烈之径的",
  "Blaze": "炽烈之径的",
  "of Blazing": "炽烈之径的",
  "Blazing": "炽烈之径的",
  "of Blessed Hammers": "祝福之槌的",
  "Blessed Hammers": "祝福之槌的",
  "of Blight": "光明的",
  "Blight": "光明的",
  "of Bliss": "至福的",
  "Bliss": "至福的",
  "of Blizzard": "暴风雪的",
  "Blizzard": "暴风雪的",
  "of Blizzards": "暴风雪的",
  "Blizzards": "暴风雪的",
  "of Blocking": "格挡的",
  "Blocking": "格挡的",
  "of Blood Golem Summoning": "鲜血魔像的",
  "Blood Golem Summoning": "鲜血魔像的",
  "of Bone Armor": "白骨装甲的",
  "Bone Armor": "白骨装甲的",
  "of Bone Imprisonment": "骨牢的",
  "Bone Imprisonment": "骨牢的",
  "of Bone Spears": "骨矛的",
  "Bone Spears": "骨矛的",
  "of Bone Spirits": "白骨之魂的",
  "Bone Spirits": "白骨之魂的",
  "of Bone Walls": "骨墙的",
  "Bone Walls": "骨墙的",
  "of Brilliance": "才华的",
  "Brilliance": "才华的",
  "of Burning": "燃烧的",
  "Burning": "燃烧的",
  "of Butchery": "屠戮的",
  "Butchery": "屠戮的",
  "of Carnage": "屠杀的",
  "Carnage": "屠杀的",
  "of Chain Lightning": "连锁闪电的",
  "Chain Lightning": "连锁闪电的",
  "of Chance": "机会的",
  "Chance": "机会的",
  "of Charged Bolts": "充能弹的",
  "Charged Bolts": "充能弹的",
  "of Charged Shield": "充能护盾的",
  "Charged Shield": "充能护盾的",
  "of Charged Strike": "充能一击的",
  "Charged Strike": "充能一击的",
  "of Chilling Armor": "寒冰甲的",
  "Chilling Armor": "寒冰甲的",
  "of Clay Golem Summoning": "黏土魔像的",
  "Clay Golem Summoning": "黏土魔像的",
  "of Cold Arrows": "冰箭的",
  "Cold Arrows": "冰箭的",
  "of Concentration": "专注的",
  "Concentration": "专注的",
  "of Confusion": "迷乱的",
  "Confusion": "迷乱的",
  "of Conversion": "转化的",
  "Conversion": "转化的",
  "of Coolness": "清凉的",
  "Coolness": "清凉的",
  "of Corpse Explosions": "尸体爆炸的",
  "Corpse Explosions": "尸体爆炸的",
  "of Craftsmanship": "工匠的",
  "Craftsmanship": "工匠的",
  "of Cyclone Armor": "飓风装甲的",
  "Cyclone Armor": "飓风装甲的",
  "of Damage Amplification": "伤害加深的",
  "Damage Amplification": "伤害加深的",
  "of Daring": "果敢的",
  "Daring": "果敢的",
  "of Dawn": "黎明的",
  "Dawn": "黎明的",
  "of Decrepification": "衰老的",
  "Decrepification": "衰老的",
  "of Defiance": "反抗的",
  "Defiance": "反抗的",
  "of Deflecting": "偏向的",
  "Deflecting": "偏向的",
  "of Desire": "渴望的",
  "Desire": "渴望的",
  "of Destruction": "毁灭的",
  "Destruction": "毁灭的",
  "of Dexterity": "敏捷的",
  "Dexterity": "敏捷的",
  "of Dim Vision": "微暗灵视的",
  "Dim Vision": "微暗灵视的",
  "of Ease": "安逸的",
  "Ease": "安逸的",
  "of Enchant": "强化的",
  "Enchant": "强化的",
  "of Enchantment": "强化的",
  "Enchantment": "强化的",
  "of Energy": "能源的",
  "Energy": "能源的",
  "of Energy Shield": "能量护盾的",
  "Energy Shield": "能量护盾的",
  "of Enlightenment": "启迪的",
  "Enlightenment": "启迪的",
  "of Ennui": "厌倦的",
  "Ennui": "厌倦的",
  "of Envy": "嫉妒的",
  "Envy": "嫉妒的",
  "of Equilibrium": "均衡",
  "Equilibrium": "均衡",
  "of Eruption": "火山喷发的",
  "Eruption": "火山喷发的",
  "of Evisceration": "剖腹的",
  "Evisceration": "剖腹的",
  "of Excellence": "精灵的",
  "Excellence": "精灵的",
  "of Exploding Arrows": "爆裂箭的",
  "Exploding Arrows": "爆裂箭的",
  "of Faith": "信仰的",
  "Faith": "信仰的",
  "of Fast Repair": "快速修复的",
  "Fast Repair": "快速修复的",
  "of Fending": "击退的",
  "Fending": "击退的",
  "of Fervor": "狂热的",
  "Fervor": "狂热的",
  "of Fire": "火的",
  "Fire": "火的",
  "of Fire Arrows": "火箭的",
  "Fire Arrows": "火箭的",
  "of Fire Ball": "火球的",
  "Fire Ball": "火球的",
  "of Fire Balls": "火球的",
  "Fire Balls": "火球的",
  "of Fire Bolts": "火弹的",
  "Fire Bolts": "火弹的",
  "of Fire Golem Summoning": "火焰魔像的",
  "Fire Golem Summoning": "火焰魔像的",
  "of Fire Quenching": "灭火的",
  "Fire Quenching": "灭火的",
  "of Fire Wall": "火墙的",
  "Fire Wall": "火墙的",
  "of Fire Walls": "火墙的",
  "Fire Walls": "火墙的",
  "of Firebolt": "火弹的",
  "Firebolt": "火弹的",
  "of Firebolts": "火弹的",
  "Firebolts": "火弹的",
  "of Firestorms": "火风暴的",
  "Firestorms": "火风暴的",
  "of Fist of the Heavens": "天堂之拳的",
  "Fist of the Heavens": "天堂之拳的",
  "of Flame": "火焰的",
  "Flame": "火焰的",
  "of Fortune": "幸运的",
  "Fortune": "幸运的",
  "of Freedom": "自由的",
  "Freedom": "自由的",
  "of Freezing Arrows": "急冻箭的",
  "Freezing Arrows": "急冻箭的",
  "of Frigidity": "寒冷的",
  "Frigidity": "寒冷的",
  "of Frost": "霜的",
  "Frost": "霜的",
  "of Frost Novas": "冰霜新星的",
  "Frost Novas": "冰霜新星的",
  "of Frost Shield": "冰霜护盾的",
  "Frost Shield": "冰霜护盾的",
  "of Frostbite": "冻疮的",
  "Frostbite": "冻疮的",
  "of Frozen Armor": "冰封甲的",
  "Frozen Armor": "冰封甲的",
  "of Frozen Orb": "冰封球的",
  "Frozen Orb": "冰封球的",
  "of Frozen Orbs": "冰封球的",
  "Frozen Orbs": "冰封球的",
  "of Fumigation": "熏蒸的",
  "Fumigation": "熏蒸的",
  "of Glacial Spike": "冰尖柱的",
  "Glacial Spike": "冰尖柱的",
  "of Glacial Spikes": "冰尖柱的",
  "Glacial Spikes": "冰尖柱的",
  "of Good Luck": "好运的",
  "Good Luck": "好运的",
  "of Gore": "凝血的",
  "Gore": "凝血的",
  "of Grace": "优雅的",
  "Grace": "优雅的",
  "of Grace and Power": "优雅与力量的",
  "Grace and Power": "优雅与力量的",
  "of Greed": "贪婪的",
  "Greed": "贪婪的",
  "of Grim Ward": "残骸清理的",
  "Grim Ward": "残骸清理的",
  "of Grounding": "接地的",
  "Grounding": "接地的",
  "of Guarding": "守卫的",
  "Guarding": "守卫的",
  "of Guided Arrows": "追踪箭的",
  "Guided Arrows": "追踪箭的",
  "of Haste": "憎恨的",
  "Haste": "憎恨的",
  "of Health": "生命的",
  "Health": "生命的",
  "of Health Everlasting": "永恒健康的",
  "Health Everlasting": "永恒健康的",
  "of Holy Bolts": "圣光弹的",
  "Holy Bolts": "圣光弹的",
  "of Honor": "荣耀的",
  "Honor": "荣耀的",
  "of Hope": "希望的",
  "Hope": "希望的",
  "of Howling": "狂嚎的",
  "Howling": "狂嚎的",
  "of Hurricane": "飓风的",
  "Hurricane": "飓风的",
  "of Hydra Shield": "九头蛇护盾的",
  "Hydra Shield": "九头蛇护盾的",
  "of Hydras": "九头海蛇的",
  "Hydras": "九头海蛇的",
  "of Ice Arrows": "冻结箭的",
  "Ice Arrows": "冻结箭的",
  "of Ice Blast": "冰风暴的",
  "Ice Blast": "冰风暴的",
  "of Ice Blasts": "冰风暴的",
  "Ice Blasts": "冰风暴的",
  "of Ice Bolts": "冰弹的",
  "Ice Bolts": "冰弹的",
  "of Icebolt": "冰弹的",
  "Icebolt": "冰弹的",
  "of Immolating Arrows": "牺牲之箭的",
  "Immolating Arrows": "牺牲之箭的",
  "of Impaling Strike": "刺爆的",
  "Impaling Strike": "刺爆的",
  "of Incineration": "焚化的",
  "Incineration": "焚化的",
  "of Incombustibility": "不燃的",
  "Incombustibility": "不燃的",
  "of Inertia": "抗性的",
  "Inertia": "抗性的",
  "of Inner Sight": "内视的",
  "Inner Sight": "内视的",
  "of Insulation": "绝缘的",
  "Insulation": "绝缘的",
  "of Ire": "愤怒的",
  "Ire": "愤怒的",
  "of Iron Golem Creation": "钢铁魔像的",
  "Iron Golem Creation": "钢铁魔像的",
  "of Iron Maiden": "攻击反噬的",
  "Iron Maiden": "攻击反噬的",
  "of Item Finding": "寻找物品的",
  "Item Finding": "寻找物品的",
  "of Jabbing": "戳刺的",
  "Jabbing": "戳刺的",
  "of Joyfulness": "欢欣的",
  "Joyfulness": "欢欣的",
  "of Knowledge": "知识的",
  "Knowledge": "知识的",
  "of Life": "生命的",
  "Life": "生命的",
  "of Life Everlasting": "永恒生命的",
  "Life Everlasting": "永恒生命的",
  "of Life Tap": "偷取生命的",
  "Life Tap": "偷取生命的",
  "of Light": "光明的",
  "Light": "光明的",
  "of Lightning": "闪电的",
  "Lightning": "闪电的",
  "of Lightning Fury": "闪电之怒的",
  "Lightning Fury": "闪电之怒的",
  "of Lightning Javelin": "闪电标枪的",
  "Lightning Javelin": "闪电标枪的",
  "of Lightning Strike": "雷电一击的",
  "Lightning Strike": "雷电一击的",
  "of Lower Resistance": "降低抗性的",
  "Lower Resistance": "降低抗性的",
  "of Luck": "幸运的",
  "Luck": "幸运的",
  "of Magic Arrows": "魔法箭的",
  "Magic Arrows": "魔法箭的",
  "of Maiming": "残废的",
  "Maiming": "残废的",
  "of Malice": "恶意的",
  "Malice": "恶意的",
  "of Measure": "测量的",
  "Measure": "测量的",
  "of Memory": "记忆的",
  "Memory": "记忆的",
  "of Meteor": "陨石的",
  "Meteor": "陨石的",
  "of Meteors": "陨石的",
  "Meteors": "陨石的",
  "of Might": "武力的",
  "Might": "武力的",
  "of Mind": "心灵的",
  "Mind": "心灵的",
  "of Molten Boulders": "熔岩巨石的",
  "Molten Boulders": "熔岩巨石的",
  "of Multiple Shot": "多重箭的",
  "Multiple Shot": "多重箭的",
  "of Negation": "否定的",
  "Negation": "否定的",
  "of Nirvana": "涅槃的",
  "Nirvana": "涅槃的",
  "of Nova": "新星的",
  "Nova": "新星的",
  "of Nova Shield": "新星护盾的",
  "Nova Shield": "新星护盾的",
  "of Novas": "新星的",
  "Novas": "新星的",
  "of Pacing": "步伐的",
  "Pacing": "步伐的",
  "of Passing": "消逝的",
  "Passing": "消逝的",
  "of Passion": "激情的",
  "Passion": "激情的",
  "of Perfection": "完美的",
  "Perfection": "完美的",
  "of Performance": "表现的",
  "Performance": "表现的",
  "of Pestilence": "瘟疫的",
  "Pestilence": "瘟疫的",
  "of Piercing": "刺穿的",
  "Piercing": "刺穿的",
  "of Plague Jab": "瘟疫标枪的",
  "Plague Jab": "瘟疫标枪的",
  "of Poison Dagger": "毒匕首的",
  "Poison Dagger": "毒匕首的",
  "of Poison Explosion": "毒爆的",
  "Poison Explosion": "毒爆的",
  "of Poison Jab": "毒枪的",
  "Poison Jab": "毒枪的",
  "of Poison Novas": "剧毒新星的",
  "Poison Novas": "剧毒新星的",
  "of Potion Finding": "寻找药剂的",
  "Potion Finding": "寻找药剂的",
  "of Power": "力量的",
  "Power": "力量的",
  "of Power Strike": "威力一击的",
  "Power Strike": "威力一击的",
  "of Precision": "精密的",
  "Precision": "精密的",
  "of Propogation": "繁衍的",
  "Propogation": "繁衍的",
  "of Prosperity": "繁荣的",
  "Prosperity": "繁荣的",
  "of Protection": "保护的",
  "Protection": "保护的",
  "of Puncturing": "爆破的",
  "Puncturing": "爆破的",
  "of Quality": "品质的",
  "Quality": "品质的",
  "of Quickness": "快速的",
  "Quickness": "快速的",
  "of Radiance": "光彩的",
  "Radiance": "光彩的",
  "of Raise Skeletal Mages": "骷髅法师的",
  "Raise Skeletal Mages": "骷髅法师的",
  "of Raise Skeletons": "复生骷髅的",
  "Raise Skeletons": "复生骷髅的",
  "of Razors": "剃刀的",
  "Razors": "剃刀的",
  "of Readiness": "迅速的",
  "Readiness": "迅速的",
  "of Regeneration": "重造的",
  "Regeneration": "重造的",
  "of Regrowth": "重生的",
  "Regrowth": "重生的",
  "of Remedy": "医治的",
  "Remedy": "医治的",
  "of Replenishing": "充盈的",
  "Replenishing": "充盈的",
  "of Resistance": "抗性的",
  "Resistance": "抗性的",
  "of Revivification": "复苏的",
  "Revivification": "复苏的",
  "of Sacrifice": "牺牲的",
  "Sacrifice": "牺牲的",
  "of Self-Repair": "自我修复的",
  "Self-Repair": "自我修复的",
  "of Shiver Armor": "碎冰甲的",
  "Shiver Armor": "碎冰甲的",
  "of Shock": "冲击的",
  "Shock": "冲击的",
  "of Shouting": "大叫的",
  "Shouting": "大叫的",
  "of Simplicity": "简朴的",
  "Simplicity": "简朴的",
  "of Skill": "技能的",
  "Skill": "技能的",
  "of Slaughter": "残杀的",
  "Slaughter": "残杀的",
  "of Slaying": "屠杀的",
  "Slaying": "屠杀的",
  "of Slow Missiles": "慢速箭的",
  "Slow Missiles": "慢速箭的",
  "of Sniping": "狙击的",
  "Sniping": "狙击的",
  "of Sorcery": "幻术的",
  "Sorcery": "幻术的",
  "of Spark": "火花的",
  "Spark": "火花的",
  "of Speed": "速度的",
  "Speed": "速度的",
  "of Spikers": "尖刺的",
  "Spikers": "尖刺的",
  "of Spikes": "尖刺的",
  "Spikes": "尖刺的",
  "of Spirit": "精神的",
  "Spirit": "精神的",
  "of Stability": "稳定的",
  "Stability": "稳定的",
  "of Stamina": "耐力的",
  "Stamina": "耐力的",
  "of Static": "静电的",
  "Static": "静电的",
  "of Static Field": "静电场的",
  "Static Field": "静电场的",
  "of Stoicism": "坚忍的",
  "Stoicism": "坚忍的",
  "of Storms": "风暴的",
  "Storms": "风暴的",
  "of Strength": "力量的",
  "Strength": "力量的",
  "of Striding": "跨步的",
  "Striding": "跨步的",
  "of Stunning": "击晕的",
  "Stunning": "击晕的",
  "of Substinence": "生计的",
  "Substinence": "生计的",
  "of Sunlight": "阳光的",
  "Sunlight": "阳光的",
  "of Swiftness": "敏捷的",
  "Swiftness": "敏捷的",
  "of Swords": "剑刃的",
  "Swords": "剑刃的",
  "of Taunting": "嘲弄的",
  "Taunting": "嘲弄的",
  "of Teeth": "牙的",
  "Teeth": "牙的",
  "of Telekinesis": "心灵传动的",
  "Telekinesis": "心灵传动的",
  "of Teleport Shield": "传送护盾的",
  "Teleport Shield": "传送护盾的",
  "of Teleportation": "传送的",
  "Teleportation": "传送的",
  "of Terror": "恐惧的",
  "Terror": "恐惧的",
  "of Thawing": "融解的",
  "Thawing": "融解的",
  "of Thorns": "刺尖的",
  "Thorns": "刺尖的",
  "of Thunder": "雷电的",
  "Thunder": "雷电的",
  "of Thunder Storm": "雷暴的",
  "Thunder Storm": "雷暴的",
  "of Tornado": "暴风的",
  "Tornado": "暴风的",
  "of Transcendence": "卓越的",
  "Transcendence": "卓越的",
  "of Traveling": "旅行的",
  "Traveling": "旅行的",
  "of Truth": "真理的",
  "Truth": "真理的",
  "of Twister": "龙卷风的",
  "Twister": "龙卷风的",
  "of Vengeance": "复仇的",
  "Vengeance": "复仇的",
  "of Venom": "毒素的",
  "Venom": "毒素的",
  "of Vileness": "下流的",
  "Vileness": "下流的",
  "of Virility": "刚毅的",
  "Virility": "刚毅的",
  "of Vita": "活力的",
  "Vita": "活力的",
  "of Volcano": "火山的",
  "Volcano": "火山的",
  "of War Cry": "战鸣的",
  "War Cry": "战鸣的",
  "of Warding": "防避的",
  "Warding": "防避的",
  "of Warming": "保温的",
  "Warming": "保温的",
  "of Warmth": "融解的",
  "Warmth": "融解的",
  "of Weaken": "削弱的",
  "Weaken": "削弱的",
  "of Wealth": "财富的",
  "Wealth": "财富的",
  "of Winter": "严冬的",
  "Winter": "严冬的",
  "of Wizardry": "法术的",
  "Wizardry": "法术的",
  "of Worth": "价值的",
  "Worth": "价值的",
  "of Wrath": "盛怒的",
  "Wrath": "盛怒的",
  "of Zeal": "热诚的",
  "Zeal": "热诚的",
  "of the Apprentice": "学徒的",
  "the Apprentice": "学徒的",
  "of the Bat": "蝙蝠的",
  "the Bat": "蝙蝠的",
  "of the Bear": "熊的",
  "the Bear": "熊的",
  "of the Cobra": "眼镜蛇的",
  "the Cobra": "眼镜蛇的",
  "of the Colossus": "太阳神的",
  "the Colossus": "太阳神的",
  "of the Colosuss": "太阳神的",
  "the Colosuss": "太阳神的",
  "of the Dunes": "沙丘的",
  "the Dunes": "沙丘的",
  "of the Dynamo": "发电机的",
  "the Dynamo": "发电机的",
  "of the Efreeti": "火灵的",
  "the Efreeti": "火灵的",
  "of the Elements": "元素的",
  "the Elements": "元素的",
  "of the Elephant": "大象的",
  "the Elephant": "大象的",
  "of the Fox": "狐狸的",
  "the Fox": "狐狸的",
  "of the Ghoul": "食尸鬼的",
  "the Ghoul": "食尸鬼的",
  "of the Giant": "巨人的",
  "the Giant": "巨人的",
  "of the Glacier": "冰河的",
  "the Glacier": "冰河的",
  "of the Icicle": "冰柱的",
  "the Icicle": "冰柱的",
  "of the Jackal": "豺狼的",
  "the Jackal": "豺狼的",
  "of the Kraken": "海妖的",
  "the Kraken": "海妖的",
  "of the Lamprey": "八目鳗的",
  "the Lamprey": "八目鳗的",
  "of the Leech": "妖巫的",
  "the Leech": "妖巫的",
  "of the Locust": "蝗虫的",
  "the Locust": "蝗虫的",
  "of the Magus": "马格斯的",
  "the Magus": "马格斯的",
  "of the Mammoth": "巨大的",
  "the Mammoth": "巨大的",
  "of the Mind": "思想的",
  "the Mind": "思想的",
  "of the Ox": "公牛的",
  "the Ox": "公牛的",
  "of the Phoenix": "凤凰的",
  "the Phoenix": "凤凰的",
  "of the Sentinel": "步哨的",
  "the Sentinel": "步哨的",
  "of the Sirocco": "热风的",
  "the Sirocco": "热风的",
  "of the Squid": "乌贼的",
  "the Squid": "乌贼的",
  "of the Sun": "太阳的",
  "the Sun": "太阳的",
  "of the Tiger": "虎的",
  "the Tiger": "虎的",
  "of the Titan": "泰坦的",
  "the Titan": "泰坦的",
  "of the Vampire": "吸血鬼的",
  "the Vampire": "吸血鬼的",
  "of the Whale": "巨鲸的",
  "the Whale": "巨鲸的",
  "of the Wolf": "狼的",
  "the Wolf": "狼的",
  "of the Wraith": "死灵",
  "the Wraith": "死灵",
  "of the Yeti": "雪人的",
  "the Yeti": "雪人的",
  "of Craftmanship": "工匠的",
  "Craftmanship": "工匠的",
  "of Amicae": "生灵的",
  "Amicae": "生灵的",
  "of Inflammability": "不燃的",
  "Inflammability": "不燃的",
  "of Quenching": "灭火的",
  "Quenching": "灭火的",
  "of the Scirocco": "热风的",
  "the Scirocco": "热风的",
  "of Sustenance": "生计的",
  "Sustenance": "生计的",
  "of Atlas": "阿特拉斯的",
  "Atlas": "阿特拉斯的",
  "of Transportation": "旅行的",
  "Transportation": "旅行的",
  "of Restoration": "快速修复的",
  "Restoration": "快速修复的",
  "of the Centaur": "海妖的",
  "the Centaur": "海妖的",
  "of Charged Bolt": "充能弹的",
  "Charged Bolt": "充能弹的",
  "of Magic Arrow": "魔法箭的",
  "Magic Arrow": "魔法箭的",
  "of Fire Arrow": "火箭的",
  "Fire Arrow": "火箭的",
  "of Jab": "戳刺的",
  "Jab": "戳刺的",
  "of Cold Arrow": "冰箭的",
  "Cold Arrow": "冰箭的",
  "of Exploding Arrow": "爆裂箭的",
  "Exploding Arrow": "爆裂箭的",
  "of Slow Missile": "慢速箭的",
  "Slow Missile": "慢速箭的",
  "of Ice Arrow": "冻结箭的",
  "Ice Arrow": "冻结箭的",
  "of Guided Arrow": "追踪箭的",
  "Guided Arrow": "追踪箭的",
  "of Immolating Arrow": "牺牲之箭的",
  "Immolating Arrow": "牺牲之箭的",
  "of Freezing Arrow": "急冻箭的",
  "Freezing Arrow": "急冻箭的",
  "of Fire Bolt": "火弹的",
  "Fire Bolt": "火弹的",
  "of Ice Bolt": "冰弹的",
  "Ice Bolt": "冰弹的",
  "of Frost Nova": "冰霜新星的",
  "Frost Nova": "冰霜新星的",
  "of Hydra": "九头海蛇的",
  "Hydra": "九头海蛇的",
  "of Raise Skeleton": "复生骷髅的",
  "Raise Skeleton": "复生骷髅的",
  "of Corpse Explosion": "尸体爆炸的",
  "Corpse Explosion": "尸体爆炸的",
  "of Clay Golem": "黏土魔像的",
  "Clay Golem": "黏土魔像的",
  "of Bone Wall": "骨墙的",
  "Bone Wall": "骨墙的",
  "of Skeletal Mages": "骷髅法师的",
  "Skeletal Mages": "骷髅法师的",
  "of Bone Spear": "骨矛的",
  "Bone Spear": "骨矛的",
  "of Blood Golem": "鲜血魔像的",
  "Blood Golem": "鲜血魔像的",
  "of Attract": "吸引的",
  "Attract": "吸引的",
  "of Decrepify": "衰老的",
  "Decrepify": "衰老的",
  "of Bone Prison": "骨牢的",
  "Bone Prison": "骨牢的",
  "of Iron Golem": "钢铁魔像的",
  "Iron Golem": "钢铁魔像的",
  "of Poison Nova": "剧毒新星的",
  "Poison Nova": "剧毒新星的",
  "of Bone Spirit": "白骨之魂的",
  "Bone Spirit": "白骨之魂的",
  "of Fire Golem": "火焰魔像的",
  "Fire Golem": "火焰魔像的",
  "of Holy Bolt": "圣光弹的",
  "Holy Bolt": "圣光弹的",
  "of Blessed Hammer": "祝福之槌的",
  "Blessed Hammer": "祝福之槌的",
  "of Howl": "狂嚎的",
  "Howl": "狂嚎的",
  "of Find Potion": "寻找药剂的",
  "Find Potion": "寻找药剂的",
  "of Taunt": "嘲弄的",
  "Taunt": "嘲弄的",
  "of Shout": "大叫的",
  "Shout": "大叫的",
  "of Stun": "击晕的",
  "Stun": "击晕的",
  "of Find Item": "寻找物品的",
  "Find Item": "寻找物品的",
  "of Molten Boulder": "熔岩巨石的",
  "Molten Boulder": "熔岩巨石的",
  "of Fissure": "火山喷发的",
  "Fissure": "火山喷发的",
  "of the Gargantuan": "太阳神的",
  "the Gargantuan": "太阳神的"
}

/**
 * Rare Prefixes.
 */
export const RARE_PREFIX_ZH: Record<string, string> = {
  "Beast": "野兽之",
  "Eagle": "老鹰之",
  "Raven": "渡鸟之",
  "Viper": "蝮蛇之",
  "GhoulRI": "食尸鬼之",
  "Skull": "骷髅之",
  "Blood": "血之",
  "Dread": "恐惧之",
  "Doom": "毁灭之",
  "Grim": "冷酷之",
  "Bone": "白骨之",
  "Death": "死亡之",
  "Shadow": "阴影之",
  "Storm": "暴风之",
  "Rune": "符号之",
  "PlagueRI": "瘟疫之",
  "Stone": "石块之",
  "Wraithra": "忿怒",
  "Spirit": "精神之",
  "Demon": "恶魔之",
  "Cruel": "残忍之",
  "Empyrion": "埃之及",
  "Bramble": "野蔷薇之",
  "Pain": "痛苦之",
  "Loath": "不愿之",
  "Glyph": "绘画文字之",
  "Imp": "小恶魔之",
  "Fiendra": "魔鬼",
  "Hailstone": "霰之",
  "Gale": "狂风之",
  "Dire": "悲惨之",
  "Soul": "灵魂之",
  "Brimstone": "硫磺之",
  "Corpse": "尸体之",
  "Carrion": "腐尸之",
  "Holocaust": "世界末日之",
  "Havoc": "浩劫之",
  "Bitter": "受难之",
  "Entropy": "幽冥之",
  "Chaos": "混沌之",
  "Order": "秩序之",
  "Rule": "法规",
  "Warp": "扭曲之",
  "Rift": "破开之",
  "Corruption": "毁灭之",
  "Ghoul": "食尸鬼之",
  "Plague": "瘟疫之",
  "Wraith": "忿怒",
  "Empyrian": "埃之及",
  "Fiend": "魔鬼",
  "Armageddon": "世界末日之"
}

/**
 * Rare Suffixes.
 */
export const RARE_SUFFIX_ZH: Record<string, string> = {
  "bite": "咬",
  "scratch": "抓",
  "scalpel": "小刀",
  "fang": "尖牙",
  "gutter": "槽",
  "thirst": "渴望",
  "razor": "剃刀",
  "scythe": "镰刀",
  "edge": "刃",
  "saw": "锯",
  "splitter": "劈裂",
  "cleaver": "切肉刀",
  "sever": "断裂者",
  "sunder": "撕碎者",
  "rend": "分裂",
  "mangler": "乱砍者",
  "slayer": "屠杀者",
  "reaver": "强夺者",
  "spawn": "重生的",
  "gnash": "咬牙",
  "star": "星",
  "blow": "吹",
  "smasher": "击碎者",
  "Bane": "克星",
  "crusher": "压碎者",
  "breaker": "破坏者",
  "grinder": "研磨者",
  "crack": "破裂",
  "mallet": "大头锤",
  "knell": "丧钟",
  "lance": "长枪",
  "spike": "钉",
  "impaler": "刺穿者",
  "skewer": "串列者",
  "prod": "刺",
  "scourge": "鞭",
  "wand": "杖",
  "wrack": "破灭",
  "barb": "倒钩",
  "needle": "针",
  "dart": "镖",
  "bolt": "弹",
  "quarrel": "争吵",
  "fletch": "箭羽",
  "flight": "翔",
  "nock": "搭弦",
  "horn": "角",
  "stinger": "有刺者",
  "quill": "羽",
  "goad": "刺棒",
  "branch": "枝",
  "spire": "螺旋",
  "song": "歌",
  "call": "呼减",
  "cry": "哭喊",
  "spell": "法术",
  "chant": "曲",
  "weaver": "编织者",
  "gnarl": "节",
  "visage": "脸",
  "crest": "顶饰",
  "circlet": "饰环",
  "veil": "面纱",
  "hood": "兜帽",
  "mask": "面具",
  "brow": "额头",
  "casque": "盔",
  "visor": "面甲",
  "cowl": "蒙头斗蓬",
  "hide": "隐藏",
  "Pelt": "投掷",
  "carapace": "甲壳",
  "coat": "外袍",
  "wrap": "包裹",
  "suit": "衣",
  "cloak": "斗蓬",
  "shroud": "寿衣",
  "jack": "水兵",
  "mantle": "披风",
  "guard": "守卫",
  "badge": "徽章",
  "rock": "石块",
  "aegis": "庇护",
  "ward": "保护",
  "tower": "塔",
  "shield": "盾护",
  "wing": "翼",
  "mark": "标记",
  "emblem": "象征",
  "hand": "手",
  "fist": "拳",
  "claw": "爪",
  "clutches": "手爪",
  "grip": "紧握",
  "grasp": "抓取",
  "hold": "握",
  "touch": "触碰",
  "finger": "手指",
  "knuckle": "指节",
  "shank": "小腿",
  "spur": "踢马刺",
  "tread": "踏步",
  "stalker": "潜行者",
  "greave": "油渣",
  "blazer": "发光体",
  "nails": "钉",
  "trample": "蹂躏",
  "Brogues": "粗皮鞋",
  "track": "追踪",
  "slippers": "便鞋",
  "clasp": "扣钩",
  "buckle": "扣带",
  "harness": "挽具",
  "lock": "锁",
  "fringe": "边饰",
  "winding": "卷烧",
  "chain": "链条",
  "strap": "皮带",
  "lash": "抽打",
  "cord": "捆绑",
  "knot": "结",
  "circle": "环",
  "loop": "圈",
  "eye": "眼",
  "turn": "转",
  "spiral": "螺旋",
  "coil": "盘绕",
  "gyre": "旋回",
  "band": "箍",
  "whorl": "螺层",
  "talisman": "护符",
  "heart": "心",
  "noose": "套索",
  "necklace": "项链",
  "collar": "项圈",
  "beads": "串珠",
  "torc": "金丝项圈",
  "gorget": "颈甲",
  "scarab": "圣甲虫",
  "wood": "木",
  "brand": "品牌",
  "bludgeon": "棍棒",
  "cudgel": "木棒",
  "loom": "织布机",
  "harp": "竖琴",
  "master": "专家",
  "barRI": "酒吧",
  "hew": "砍",
  "crook": "钩",
  "mar": "毁损",
  "shell": "壳",
  "stake": "棍子",
  "picket": "尖木",
  "pale": "苍白",
  "flange": "凸缘",
  "Bite": "咬",
  "Scratch": "抓",
  "Scalpel": "小刀",
  "Fang": "尖牙",
  "Gutter": "槽",
  "Thirst": "渴望",
  "Razor": "剃刀",
  "Scythe": "镰刀",
  "Edge": "刃",
  "Saw": "锯",
  "Splitter": "劈裂",
  "Cleaver": "切肉刀",
  "Sever": "断裂者",
  "Sunder": "撕碎者",
  "Rend": "分裂",
  "Mangler": "乱砍者",
  "Slayer": "屠杀者",
  "Reaver": "强夺者",
  "Spawn": "重生的",
  "Gnash": "咬牙",
  "Star": "星",
  "Blow": "吹",
  "Smasher": "击碎者",
  "bane": "克星",
  "Crusher": "压碎者",
  "Breaker": "破坏者",
  "Grinder": "研磨者",
  "Crack": "破裂",
  "Mallet": "大头锤",
  "Knell": "丧钟",
  "Lance": "长枪",
  "Spike": "钉",
  "Impaler": "刺穿者",
  "Skewer": "串列者",
  "Prod": "刺",
  "Scourge": "鞭",
  "Wand": "杖",
  "Wrack": "破灭",
  "Barb": "倒钩",
  "Needle": "针",
  "Dart": "镖",
  "Bolt": "弹",
  "Quarrel": "争吵",
  "Fletch": "箭羽",
  "Flight": "翔",
  "Nock": "搭弦",
  "Horn": "角",
  "Stinger": "有刺者",
  "Quill": "羽",
  "Goad": "刺棒",
  "Branch": "枝",
  "Spire": "螺旋",
  "Song": "歌",
  "Call": "呼减",
  "Cry": "哭喊",
  "Spell": "法术",
  "Chant": "曲",
  "Weaver": "编织者",
  "Gnarl": "节",
  "Visage": "脸",
  "Crest": "顶饰",
  "Circlet": "饰环",
  "Veil": "面纱",
  "Hood": "兜帽",
  "Mask": "面具",
  "Brow": "额头",
  "Casque": "盔",
  "Visor": "面甲",
  "Cowl": "蒙头斗蓬",
  "Hide": "隐藏",
  "pelt": "投掷",
  "Carapace": "甲壳",
  "Coat": "外袍",
  "Wrap": "包裹",
  "Suit": "衣",
  "Cloak": "斗蓬",
  "Shroud": "寿衣",
  "Jack": "水兵",
  "Mantle": "披风",
  "Guard": "守卫",
  "Badge": "徽章",
  "Rock": "石块",
  "Aegis": "庇护",
  "Ward": "保护",
  "Tower": "塔",
  "Shield": "盾护",
  "Wing": "翼",
  "Mark": "标记",
  "Emblem": "象征",
  "Hand": "手",
  "Fist": "拳",
  "Claw": "爪",
  "Clutches": "手爪",
  "Grip": "紧握",
  "Grasp": "抓取",
  "Hold": "握",
  "Touch": "触碰",
  "Finger": "手指",
  "Knuckle": "指节",
  "Shank": "小腿",
  "Spur": "踢马刺",
  "Tread": "踏步",
  "Stalker": "潜行者",
  "Greaves": "油渣",
  "greaves": "油渣",
  "Blazer": "发光体",
  "Nails": "钉",
  "Trample": "蹂躏",
  "brogues": "粗皮鞋",
  "Track": "追踪",
  "Slippers": "便鞋",
  "Clasp": "扣钩",
  "Buckle": "扣带",
  "Harness": "挽具",
  "Lock": "锁",
  "Fringe": "边饰",
  "Winding": "卷烧",
  "Chain": "链条",
  "Strap": "皮带",
  "Lash": "抽打",
  "Cord": "捆绑",
  "Knot": "结",
  "Circle": "环",
  "Loop": "圈",
  "Eye": "眼",
  "Turn": "转",
  "Spiral": "螺旋",
  "Coil": "盘绕",
  "Gyre": "旋回",
  "Band": "箍",
  "Whorl": "螺层",
  "Talisman": "护符",
  "Heart": "心",
  "Noose": "套索",
  "Necklace": "项链",
  "Collar": "项圈",
  "Beads": "串珠",
  "Torc": "金丝项圈",
  "Gorget": "颈甲",
  "Scarab": "圣甲虫",
  "Wood": "木",
  "Brand": "品牌",
  "Bludgeon": "棍棒",
  "Cudgel": "木棒",
  "Loom": "织布机",
  "Harp": "竖琴",
  "Master": "专家",
  "Bar": "酒吧",
  "bar": "酒吧",
  "Hew": "砍",
  "Crook": "钩",
  "Mar": "毁损",
  "Shell": "壳",
  "Stake": "棍子",
  "Picket": "尖木",
  "Pale": "苍白",
  "Flange": "凸缘"
}

/**
 * Skill Names (All 220+ Diablo II Skills).
 */
export const SKILL_NAMES_ZH: Record<string, string> = {
  "Attack": "攻击",
  "Kick": "脚踢",
  "Throw": "投掷",
  "Unsummon": "取消召唤",
  "Left Hand Throw": "左手投掷",
  "Left Hand Swing": "左手挥动",
  "Magic Arrow": "魔法箭",
  "Fire Arrow": "火箭",
  "Inner Sight": "內视",
  "Critical Strike": "致命攻击",
  "Jab": "戳刺",
  "Cold Arrow": "冰箭",
  "Multiple Shot": "多重箭",
  "Dodge": "闪避",
  "Power Strike": "威力一击",
  "Poison Javelin": "毒枪",
  "Exploding Arrow": "爆裂箭",
  "Slow Missiles": "慢速箭",
  "Avoid": "躲避",
  "Impale": "刺爆",
  "Lightning Bolt": "闪电球",
  "Ice Arrow": "急冻箭",
  "Guided Arrow": "导引箭",
  "Penetrate": "刺入",
  "Charged Strike": "充能一击",
  "Plague Javelin": "瘟疫标枪",
  "Strafe": "炮轰",
  "Immolation Arrow": "牺牲之箭",
  "Decoy": "诱饵",
  "Dopplezon": "诱饵",
  "Evade": "回避",
  "Fend": "击退",
  "Freezing Arrow": "冻结之箭",
  "Valkyrie": "女武神",
  "Pierce": "穿刺",
  "Lightning Strike": "闪电攻击",
  "Lightning Fury": "闪电之怒",
  "Fire Bolt": "火弹",
  "Warmth": "暖气",
  "Charged Bolt": "充能弹",
  "Ice Bolt": "冰弹",
  "Frozen Armor": "冰封装甲",
  "Inferno": "地狱之火",
  "Static Field": "静态力场",
  "Telekinesis": "心灵传动",
  "Frost Nova": "霜之新星",
  "Ice Blast": "冰风暴",
  "Blaze": "炽烈之径",
  "Fire Ball": "火球",
  "Nova": "新星",
  "Lightning": "闪电",
  "Shiver Armor": "碎冰甲",
  "Fire Wall": "火墙",
  "Enchant": "强化",
  "Chain Lightning": "连锁闪电",
  "Teleport": "传送",
  "Glacial Spike": "冰尖柱",
  "Meteor": "陨石",
  "Thunder Storm": "雷云风暴",
  "Energy Shield": "能量护盾",
  "Blizzard": "暴风雪",
  "Chilling Armor": "寒冰装甲",
  "Fire Mastery": "支配之焰",
  "Hydra": "九头蛇",
  "Lightning Mastery": "支配闪电",
  "Frozen Orb": "冰封球",
  "Cold Mastery": "支配冰冷",
  "Amplify Damage": "伤害加深",
  "Teeth": "牙",
  "Bone Armor": "白骨装甲",
  "Skeleton Mastery": "支配骷髅",
  "Raise Skeleton": "骷髅复苏",
  "Dim Vision": "微暗灵视",
  "Weaken": "削弱",
  "Poison Dagger": "淬毒匕首",
  "Corpse Explosion": "尸体爆炸",
  "Clay Golem": "黏土石魔",
  "Iron Maiden": "攻击反噬",
  "Terror": "恐惧",
  "Bone Wall": "骨墙",
  "Golem Mastery": "支配石魔",
  "Raise Skeletal Mage": "复苏骷髅法师",
  "Confuse": "迷乱",
  "Life Tap": "偷取生命",
  "Poison Explosion": "毒爆",
  "Bone Spear": "骨矛",
  "Blood Golem": "血石魔",
  "BloodGolem": "血石魔",
  "Attract": "吸引",
  "Decrepify": "衰老",
  "Bone Prison": "骨牢",
  "Summon Resist": "召唤反抗",
  "Iron Golem": "铁石魔",
  "IronGolem": "铁石魔",
  "Lower Resist": "降低抵抗",
  "Poison Nova": "剧毒新星",
  "Bone Spirit": "白骨之魂",
  "Fire Golem": "火石魔",
  "FireGolem": "火石魔",
  "Revive": "重生",
  "Sacrifice": "牺牲",
  "Smite": "重击",
  "Might": "力量",
  "Prayer": "祈祷",
  "Resist Fire": "抗火",
  "Holy Bolt": "圣光弹",
  "Holy Fire": "圣火",
  "Thorns": "刺针",
  "Defiance": "反抗",
  "Resist Cold": "抗冰冷",
  "Zeal": "白热",
  "Charge": "突击",
  "Blessed Aim": "祝福瞄准",
  "Cleansing": "净化",
  "Resist Lightning": "抵抗闪电",
  "Vengeance": "复仇",
  "Blessed Hammer": "祝福之锤",
  "Concentration": "专注",
  "Holy Freeze": "神圣冰冻",
  "Vigor": "精力",
  "Conversion": "转换",
  "Holy Shield": "神圣之盾",
  "Holy Shock": "神圣冲击",
  "Sanctuary": "庇护所",
  "Meditation": "冥思",
  "Fist of the Heavens": "天堂之拳",
  "Fanaticism": "狂热",
  "Conviction": "信念",
  "Redemption": "救赎",
  "Salvation": "救助",
  "Bash": "重击",
  "Sword Mastery": "支配长剑",
  "Axe Mastery": "支配斧头",
  "Mace Mastery": "支配钉头锤",
  "Howl": "狂嗥",
  "Find Potion": "找寻药剂",
  "Leap": "跳跃",
  "Double Swing": "双手挥击",
  "Pole Arm Mastery": "支配长棍",
  "Throwing Mastery": "支配飞掷",
  "Spear Mastery": "支配长矛",
  "Taunt": "嘲弄",
  "Shout": "大叫",
  "Stun": "击昏",
  "Double Throw": "双手投掷",
  "Increased Stamina": "增加耐力",
  "Find Item": "找寻物品",
  "Leap Attack": "跳跃攻击",
  "Concentrate": "专心",
  "Iron Skin": "铁布杉",
  "Battle Cry": "战嗥",
  "Frenzy": "狂乱",
  "Increased Speed": "加速",
  "Battle Orders": "战斗体制",
  "Grim Ward": "残酷吓阻",
  "Whirlwind": "旋风",
  "Berserk": "狂战士",
  "Natural Resistance": "自然抵抗",
  "War Cry": "战斗狂嗥",
  "Battle Command": "战斗指挥",
  "Scroll of Identify": "辨视卷轴",
  "Tome of Identify": "辨视之书",
  "Book of Identify": "辨识之书",
  "Scroll of Townportal": "城镇传送卷轴",
  "Tome of Townportal": "城镇传送之书",
  "Book of Townportal": "城镇传送之书",
  "Raven": "乌鸦",
  "Werewolf": "狼人变化",
  "Wearwolf": "狼人变化",
  "Maul": "撞槌",
  "Fissure": "裂缝",
  "Eruption": "裂缝",
  "Armageddon": "毁天灭地",
  "Venom": "剧毒",
  "Delirium": "迪勒瑞姆",
  "Delerium Change": "迪勒瑞姆",
  "Poison Creeper": "剧毒蔓藤",
  "Lycanthropy": "狼人变化",
  "Firestorm": "火风暴",
  "Oak Sage": "橡木智者",
  "Summon Spirit Wolf": "召唤鬼狼",
  "Werebear": "熊人变化",
  "Molten Boulder": "熔岩巨石",
  "Arctic Blast": "极地风暴",
  "Carrion Vine": "食尸蔓藤",
  "Feral Rage": "野性狂暴",
  "Cyclone Armor": "飓风装甲",
  "Heart of Wolverine": "狼獾之心",
  "Summon Dire Wolf": "召唤狂狼",
  "Rabies": "狂犬病",
  "Fire Claws": "焰爪",
  "Twister": "龙卷风",
  "Solar Creeper": "太阳蔓藤",
  "Hunger": "饥饿",
  "Shock Wave": "震波",
  "Volcano": "火山",
  "Tornado": "暴风",
  "Spirit of Barbs": "荆棘之灵",
  "Summon Grizzly": "召唤灰熊",
  "Fury": "狂怒",
  "Hurricane": "飓风",
  "Fire Blast": "火焰爆震",
  "Claw Mastery": "支配利爪",
  "Psychic Hammer": "心灵战锤",
  "Tiger Strike": "虎击",
  "Dragon Talon": "龙爪",
  "Shock Web": "电能网",
  "Blade Sentinel": "刃之守卫",
  "Burst of Speed": "加速",
  "Fists of Fire": "焰拳",
  "Dragon Claw": "双龙爪",
  "Charged Bolt Sentry": "电能守卫",
  "Wake of Fire": "复仇之火",
  "Weapon Block": "武器格挡",
  "Cloak of Shadows": "魔影密室",
  "Cobra Strike": "眼镜蛇击",
  "Blade Fury": "刃之怒",
  "Fade": "能量消解",
  "Shadow Warrior": "影子战士",
  "Claws of Thunder": "雷电爪",
  "Dragon Tail": "神龙摆尾",
  "Lightning Sentry": "雷电守卫",
  "Wake of Inferno": "复仇狱火",
  "Mind Blast": "心灵震爆",
  "Blades of Ice": "寒冰刃",
  "Dragon Flight": "飞龙在天",
  "Death Sentry": "亡者守卫",
  "Blade Shield": "刃之盾",
  "Shadow Master": "暗影宗师",
  "Phoenix Strike": "凤凰击"
}

/**
 * Canonical 1.13c Skill Tab Names in Chinese (par 0..20).
 */
export const CANONICAL_SKILL_TABS_ZH: Record<number, string> = {
  0: '弓和十字弓技能 (限亚马逊使用)',
  1: '被动和魔法技能 (限亚马逊使用)',
  2: '标枪和长矛技能 (限亚马逊使用)',
  3: '火焰技能 (限法师使用)',
  4: '闪电技能 (限法师使用)',
  5: '冰冻技能 (限法师使用)',
  6: '诅咒 (限死灵法师使用)',
  7: '毒素和白骨技能 (限死灵法师使用)',
  8: '召唤技能 (限死灵法师使用)',
  9: '战斗技能 (限圣骑士使用)',
  10: '攻击灵气 (限圣骑士使用)',
  11: '防御灵气 (限圣骑士使用)',
  12: '战斗技能 (限野蛮人使用)',
  13: '战斗专家 (限野蛮人使用)',
  14: '呐喊 (限野蛮人使用)',
  15: '召唤技能 (限德鲁伊使用)',
  16: '变形技能 (限德鲁伊使用)',
  17: '元素技能 (限德鲁伊使用)',
  18: '陷阱 (限刺客使用)',
  19: '暗影修行 (限刺客使用)',
  20: '武学艺术 (限刺客使用)',
}

/**
 * Canonical 1.13c MonStats.txt hcIdx -> Chinese Monster Name for reanimate.
 */
export const CANONICAL_REANIMATE_MONSTERS_ZH: Record<number, string> = {
  0: '骷髅',
  1: '复生者',
  2: '白骨战士',
  3: '燃烧亡者',
  4: '恐怖尸怪',
  5: '僵尸',
}

/**
 * Class Restriction Suffixes in Chinese.
 */
export const CLASS_RESTRICTION_SUFFIX_ZH: Record<string, string> = {
  ama: '(限亚马逊使用)',
  sor: '(限法师使用)',
  nec: '(限死灵法师使用)',
  pal: '(限圣骑士使用)',
  bar: '(限野蛮人使用)',
  dru: '(限德鲁伊使用)',
  ass: '(限刺客使用)',
}

/**
 * Class Skill Names in Chinese.
 */
export const CLASS_SKILL_NAMES_ZH: Record<string, string> = {
  ama: '亚马逊技能等级',
  sor: '法师技能等级',
  nec: '死灵法师技能等级',
  pal: '圣骑士技能等级',
  bar: '野蛮人技能等级',
  dru: '德鲁伊技能等级',
  ass: '刺客技能等级',
}

/**
 * Item Quality Labels in Chinese.
 */
export const QUALITY_LABELS_ZH: Record<string, string> = {
  unique: '暗金',
  set: '套装',
  rare: '亮金',
  magic: '魔法',
  superior: '超强',
  low: '劣质',
  normal: '普通',
  rune: '符文',
}

/**
 * Base Stat Item Labels in Chinese.
 */
export const BASE_STAT_LABELS_ZH: Record<string, string> = {
  defense: '防御',
  oneHandDamage: '单手伤害',
  twoHandDamage: '双手伤害',
  durability: '耐久度',
  reqLevel: '需要等级',
  reqStr: '需要力量',
  reqDex: '需要敏捷',
  ilvl: '物品等级',
}

/**
 * Runes r01..r33 in Chinese.
 */
export const RUNE_INFO_ZH: Record<string, { num: number; nameZh: string; nameEn: string; lvl: number; weaponZh: string; armorZh: string }> = {
  r01: { num: 1, nameZh: '艾尔', nameEn: 'El Rune', lvl: 11, weaponZh: '+50 准确率, +1 光照范围', armorZh: '+15 防御, +1 光照范围' },
  r02: { num: 2, nameZh: '艾德', nameEn: 'Eld Rune', lvl: 11, weaponZh: '+75% 对不死生物的伤害, +50 对不死生物的准确率', armorZh: '减慢体力消耗 15% (盾牌: +7% 增加格挡几率)' },
  r03: { num: 3, nameZh: '特尔', nameEn: 'Tir Rune', lvl: 13, weaponZh: '+2 每击杀一个怪物获得法力', armorZh: '+2 每击杀一个怪物获得法力' },
  r04: { num: 4, nameZh: '那夫', nameEn: 'Nef Rune', lvl: 13, weaponZh: '击退', armorZh: '+30 对远距离武器的防御' },
  r05: { num: 5, nameZh: '爱斯', nameEn: 'Eth Rune', lvl: 15, weaponZh: '-25% 目标防御', armorZh: '法力恢复速度 15%' },
  r06: { num: 6, nameZh: '伊司', nameEn: 'Ith Rune', lvl: 15, weaponZh: '+9 最大伤害', armorZh: '15% 伤害转化为法力' },
  r07: { num: 7, nameZh: '塔尔', nameEn: 'Tal Rune', lvl: 17, weaponZh: '在 5 秒内造成 75 点毒素伤害', armorZh: '抗毒 +30% (盾牌: 抗毒 +35%)' },
  r08: { num: 8, nameZh: '拉尔', nameEn: 'Ral Rune', lvl: 19, weaponZh: '增加 5-30 火焰伤害', armorZh: '抗火 +30% (盾牌: 抗火 +35%)' },
  r09: { num: 9, nameZh: '欧特', nameEn: 'Ort Rune', lvl: 21, weaponZh: '增加 1-50 闪电伤害', armorZh: '抗电 +30% (盾牌: 抗电 +35%)' },
  r10: { num: 10, nameZh: '书尔', nameEn: 'Thul Rune', lvl: 23, weaponZh: '增加 3-14 冰冻伤害 (持续 3 秒)', armorZh: '抗寒 +30% (盾牌: 抗寒 +35%)' },
  r11: { num: 11, nameZh: '安姆', nameEn: 'Amn Rune', lvl: 25, weaponZh: '每次命中偷取 7% 生命', armorZh: '攻击者受到伤害 14' },
  r12: { num: 12, nameZh: '索尔', nameEn: 'Sol Rune', lvl: 27, weaponZh: '+9 最小伤害', armorZh: '伤害减少 7' },
  r13: { num: 13, nameZh: '夏', nameEn: 'Shael Rune', lvl: 29, weaponZh: '+20% 增加攻击速度', armorZh: '+20% 快速打击恢复 (盾牌: +20% 快速格挡率)' },
  r14: { num: 14, nameZh: '多尔', nameEn: 'Dol Rune', lvl: 31, weaponZh: '击中时使怪物逃跑 25%', armorZh: '生命恢复 +7' },
  r15: { num: 15, nameZh: '海尔', nameEn: 'Hel Rune', lvl: 0, weaponZh: '装备需求 -20%', armorZh: '装备需求 -15%' },
  r16: { num: 16, nameZh: '艾欧', nameEn: 'Io Rune', lvl: 35, weaponZh: '+10 体力', armorZh: '+10 体力' },
  r17: { num: 17, nameZh: '卢姆', nameEn: 'Lum Rune', lvl: 37, weaponZh: '+10 精力', armorZh: '+10 精力' },
  r18: { num: 18, nameZh: '科', nameEn: 'Ko Rune', lvl: 39, weaponZh: '+10 敏捷', armorZh: '+10 敏捷' },
  r19: { num: 19, nameZh: '法尔', nameEn: 'Fal Rune', lvl: 41, weaponZh: '+10 力量', armorZh: '+10 力量' },
  r20: { num: 20, nameZh: '蓝姆', nameEn: 'Lem Rune', lvl: 43, weaponZh: '+75% 从怪物获得额外金钱', armorZh: '+50% 从怪物获得额外金钱' },
  r21: { num: 21, nameZh: '普尔', nameEn: 'Pul Rune', lvl: 45, weaponZh: '+75% 对恶魔的伤害, +100 对恶魔的准确率', armorZh: '+30% 强化防御' },
  r22: { num: 22, nameZh: '乌姆', nameEn: 'Um Rune', lvl: 47, weaponZh: '25% 几率撕开伤口', armorZh: '所有抗性 +15 (盾牌: 所有抗性 +22)' },
  r23: { num: 23, nameZh: '马尔', nameEn: 'Mal Rune', lvl: 49, weaponZh: '防止怪物自愈', armorZh: '魔法伤害减少 7' },
  r24: { num: 24, nameZh: '伊斯特', nameEn: 'Ist Rune', lvl: 51, weaponZh: '+30% 获得魔法装备几率', armorZh: '+25% 获得魔法装备几率' },
  r25: { num: 25, nameZh: '古尔', nameEn: 'Gul Rune', lvl: 53, weaponZh: '+20% 准确率加成', armorZh: '+5% 最大抗毒' },
  r26: { num: 26, nameZh: '伐克斯', nameEn: 'Vex Rune', lvl: 55, weaponZh: '每次命中偷取 7% 法力', armorZh: '+5% 最大抗火' },
  r27: { num: 27, nameZh: '欧姆', nameEn: 'Ohm Rune', lvl: 57, weaponZh: '+50% 增强伤害', armorZh: '+5% 最大抗寒' },
  r28: { num: 28, nameZh: '罗', nameEn: 'Lo Rune', lvl: 59, weaponZh: '20% 致命打击', armorZh: '+5% 最大抗电' },
  r29: { num: 29, nameZh: '瑟', nameEn: 'Sur Rune', lvl: 61, weaponZh: '致盲目标', armorZh: '提升法力上限 5% (盾牌: +50 法力)' },
  r30: { num: 30, nameZh: '贝', nameEn: 'Ber Rune', lvl: 63, weaponZh: '20% 几率造成压碎打击', armorZh: '伤害减少 8%' },
  r31: { num: 31, nameZh: '乔', nameEn: 'Jah Rune', lvl: 65, weaponZh: '无视目标防御', armorZh: '提升生命上限 5% (盾牌: +50 生命)' },
  r32: { num: 32, nameZh: '查姆', nameEn: 'Cham Rune', lvl: 67, weaponZh: '冻结目标 +3', armorZh: '无法冻结' },
  r33: { num: 33, nameZh: '萨德', nameEn: 'Zod Rune', lvl: 69, weaponZh: '无法破坏', armorZh: '无法破坏' },
}

/**
 * Maps internal .txt item names (where misc.txt/weapons.txt/armor.txt `name` differs from `namestr` in .tbl)
 * to their canonical `namestr` key in string.tbl / expansionstring.tbl / patchstring.tbl.
 */
const TXT_NAME_TO_TBL_KEY: Readonly<Record<string, string>> = {
  'Lesser Healing Potion': 'hp1',
  'Lesser Mana Potion': 'mp1',
  'Strong Healing Potion': 'hp4',
  'Strong Mana Potion': 'mp4',
  'Rejuv Potion': 'rvs',
  'Full Rejuv Potion': 'rvl',
  'Town Portal Book': 'tbk',
  'Identify Book': 'ibk',
  'Town Portal Scroll': 'tsc',
  'Identify Scroll': 'isc',
  'Scroll of Horadric Quest Info': 'tr1',
  'Bark Scroll': 'bks',
  'deciphered Bark Scroll': 'bkd',
  'viper amulet': 'vip',
  'Staff of the Kings': 'msf',
  'Mephisto SoulStone': 'mss',
  'KhalimEye': 'qey',
  'KhalimHeart': 'qhr',
  'KhalimBrain': 'qbr',
  'KhalimFlail': 'qf1',
  'SuperKhalimFlail': 'qf2',
  'decoy dagger': 'd33',
  'Gidbinn': 'g33',
  'jade figurine': 'j34',
  'gold bird': 'g34',
  'scroll of self resurrect': 'xyz',
  "lam esen's tome": 'bbb',
  'Scroll of Malah - Boost Resistances': 'tr2',
  'Maguffin': 'ice',
  'Charm Small': 'cm1',
  'Charm Medium': 'cm2',
  'Charm Large': 'cm3',
}

/**
 * Maps canonical 1.13c base item codes (`armor.txt`, `weapons.txt`, `misc.txt`) to their raw `.txt` `name` column
 * so that `resolveBaseItemNameEn(baseName, baseCode)` can distinguish a base item's internal `.txt` name
 * (e.g. `pad` `Ancient Shield` -> `Kurast Shield`, `hp5` `Greater Healing Potion` -> `Super Healing Potion`)
 * from a Unique/Set item index passed alongside `baseCode`.
 */
export const BASE_CODE_TO_TXT_NAME: Readonly<Record<string, string>> = {
  "cap": "Cap/hat",
  "skp": "Skull Cap",
  "hlm": "Helm",
  "fhl": "Full Helm",
  "ghm": "Great Helm",
  "crn": "Crown",
  "msk": "Mask",
  "qui": "Quilted Armor",
  "lea": "Leather Armor",
  "hla": "Hard Leather Armor",
  "stu": "Studded Leather",
  "rng": "Ring Mail",
  "scl": "Scale Mail",
  "chn": "Chain Mail",
  "brs": "Breast Plate",
  "spl": "Splint Mail",
  "plt": "Plate Mail",
  "fld": "Field Plate",
  "gth": "Gothic Plate",
  "ful": "Full Plate Mail",
  "aar": "Ancient Armor",
  "ltp": "Light Plate",
  "buc": "Buckler",
  "sml": "Small Shield",
  "lrg": "Large Shield",
  "kit": "Kite Shield",
  "tow": "Tower Shield",
  "gts": "Gothic Shield",
  "lgl": "Gloves(L)",
  "vgl": "Heavy Gloves",
  "mgl": "Bracers(M)",
  "tgl": "Light Gauntlets",
  "hgl": "Gaunlets(H)",
  "lbt": "Leather Boots",
  "vbt": "Heavy Boots",
  "mbt": "Chain Boots",
  "tbt": "Light Plate Boots",
  "hbt": "Plate Boots",
  "lbl": "Sash(L)",
  "vbl": "Light Belt",
  "mbl": "Belt(M)",
  "tbl": "Heavy Belt",
  "hbl": "Girdle(H)",
  "bhm": "Bone Helm",
  "bsh": "Bone Shield",
  "spk": "Spiked Shield",
  "xap": "War Hat",
  "xkp": "Sallet",
  "xlm": "Casque",
  "xhl": "Basinet",
  "xhm": "Winged Helm",
  "xrn": "Grand Crown",
  "xsk": "Death Mask",
  "xui": "Ghost Armor",
  "xea": "Serpentskin Armor",
  "xla": "Demonhide Armor",
  "xtu": "Trellised Armor",
  "xng": "Linked Mail",
  "xcl": "Tigulated Mail",
  "xhn": "Mesh Armor",
  "xrs": "Cuirass",
  "xpl": "Russet Armor",
  "xlt": "Templar Coat",
  "xld": "Sharktooth Armor",
  "xth": "Embossed Plate",
  "xul": "Chaos Armor",
  "xar": "Ornate Armor",
  "xtp": "Mage Plate",
  "xuc": "Defender",
  "xml": "Round Shield",
  "xrg": "Scutum",
  "xit": "Dragon Shield",
  "xow": "Pavise",
  "xts": "Ancient Shield",
  "xlg": "Demonhide Gloves",
  "xvg": "Sharkskin Gloves",
  "xmg": "Heavy Bracers",
  "xtg": "Battle Gauntlets",
  "xhg": "War Gauntlets",
  "xlb": "Demonhide Boots",
  "xvb": "Sharkskin Boots",
  "xmb": "Mesh Boots",
  "xtb": "Battle Boots",
  "xhb": "War Boots",
  "zlb": "Demonhide Sash",
  "zvb": "Sharkskin Belt",
  "zmb": "Mesh Belt",
  "ztb": "Battle Belt",
  "zhb": "War Belt",
  "xh9": "Grim Helm",
  "xsh": "Grim Shield",
  "xpk": "Barbed Shield",
  "dr1": "Wolf Head",
  "dr2": "Hawk Helm",
  "dr3": "Antlers",
  "dr4": "Falcon Mask",
  "dr5": "Spirit Mask",
  "ba1": "Jawbone Cap",
  "ba2": "Fanged Helm",
  "ba3": "Horned Helm",
  "ba4": "Assault Helmet",
  "ba5": "Avenger Guard",
  "pa1": "Targe",
  "pa2": "Rondache",
  "pa3": "Heraldic Shield",
  "pa4": "Aerin Shield",
  "pa5": "Crown Shield",
  "ne1": "Preserved Head",
  "ne2": "Zombie Head",
  "ne3": "Unraveller Head",
  "ne4": "Gargoyle Head",
  "ne5": "Demon Head",
  "ci0": "Circlet",
  "ci1": "Coronet",
  "ci2": "Tiara",
  "ci3": "Diadem",
  "uap": "Shako",
  "ukp": "Hydraskull",
  "ulm": "Armet",
  "uhl": "Giant Conch",
  "uhm": "Spired Helm",
  "urn": "Corona",
  "usk": "Demonhead",
  "uui": "Dusk Shroud",
  "uea": "Wyrmhide",
  "ula": "Scarab Husk",
  "utu": "Wire Fleece",
  "ung": "Diamond Mail",
  "ucl": "Loricated Mail",
  "uhn": "Boneweave",
  "urs": "Great Hauberk",
  "upl": "Balrog Skin",
  "ult": "Hellforged Plate",
  "uld": "Kraken Shell",
  "uth": "Lacquered Plate",
  "uul": "Shadow Plate",
  "uar": "Sacred Armor",
  "utp": "Archon Plate",
  "uuc": "Heater",
  "uml": "Luna",
  "urg": "Hyperion",
  "uit": "Monarch",
  "uow": "Aegis",
  "uts": "Ward",
  "ulg": "Bramble Mitts",
  "uvg": "Vampirebone Gloves",
  "umg": "Vambraces",
  "utg": "Crusader Gauntlets",
  "uhg": "Ogre Gauntlets",
  "ulb": "Wyrmhide Boots",
  "uvb": "Scarabshell Boots",
  "umb": "Boneweave Boots",
  "utb": "Mirrored Boots",
  "uhb": "Myrmidon Greaves",
  "ulc": "Spiderweb Sash",
  "uvc": "Vampirefang Belt",
  "umc": "Mithril Coil",
  "utc": "Troll Belt",
  "uhc": "Colossus Girdle",
  "uh9": "Bone Visage",
  "ush": "Troll Nest",
  "upk": "Blade Barrier",
  "dr6": "Alpha Helm",
  "dr7": "Griffon Headress",
  "dr8": "Hunter's Guise",
  "dr9": "Sacred Feathers",
  "dra": "Totemic Mask",
  "ba6": "Jawbone Visor",
  "ba7": "Lion Helm",
  "ba8": "Rage Mask",
  "ba9": "Savage Helmet",
  "baa": "Slayer Guard",
  "pa6": "Akaran Targe",
  "pa7": "Akaran Rondache",
  "pa8": "Protector Shield",
  "pa9": "Guilded Shield",
  "paa": "Royal Shield",
  "ne6": "Mummified Trophy",
  "ne7": "Fetish Trophy",
  "ne8": "Sexton Trophy",
  "ne9": "Cantor Trophy",
  "nea": "Heirophant Trophy",
  "drb": "Blood Spirt",
  "drc": "Sun Spirit",
  "drd": "Earth Spirit",
  "dre": "Sky Spirit",
  "drf": "Dream Spirit",
  "bab": "Carnage Helm",
  "bac": "Fury Visor",
  "bad": "Destroyer Helm",
  "bae": "Conquerer Crown",
  "baf": "Guardian Crown",
  "pab": "Sacred Targe",
  "pac": "Sacred Rondache",
  "pad": "Ancient Shield",
  "pae": "Zakarum Shield",
  "paf": "Vortex Shield",
  "neb": "Minion Skull",
  "neg": "Hellspawn Skull",
  "ned": "Overseer Skull",
  "nee": "Succubae Skull",
  "nef": "Bloodlord Skull",
  "hax": "Hand Axe",
  "axe": "Axe",
  "2ax": "Double Axe",
  "mpi": "Military Pick",
  "wax": "War Axe",
  "lax": "Large Axe",
  "bax": "Broad Axe",
  "btx": "Battle Axe",
  "gax": "Great Axe",
  "gix": "Giant Axe",
  "wnd": "Wand",
  "ywn": "Yew Wand",
  "bwn": "Bone Wand",
  "gwn": "Grim Wand",
  "clb": "Club",
  "scp": "Scepter",
  "gsc": "Grand Scepter",
  "wsp": "War Scepter",
  "spc": "Spiked Club",
  "mac": "Mace",
  "mst": "Morning Star",
  "fla": "Flail",
  "whm": "War Hammer",
  "mau": "Maul",
  "gma": "Great Maul",
  "ssd": "Short Sword",
  "scm": "Scimitar",
  "sbr": "Saber",
  "flc": "Falchion",
  "crs": "Crystal Sword",
  "bsd": "Broad Sword",
  "lsd": "Long Sword",
  "wsd": "War Sword",
  "2hs": "Two-Handed Sword",
  "clm": "Claymore",
  "gis": "Giant Sword",
  "bsw": "Bastard Sword",
  "flb": "Flamberge",
  "gsd": "Great Sword",
  "dgr": "Dagger",
  "dir": "Dirk",
  "kri": "Kriss",
  "bld": "Blade",
  "tkf": "Throwing Knife",
  "tax": "Throwing Axe",
  "bkf": "Balanced Knife",
  "bal": "Balanced Axe",
  "jav": "Javelin",
  "pil": "Pilum",
  "ssp": "Short Spear",
  "glv": "Glaive",
  "tsp": "Throwing Spear",
  "spr": "Spear",
  "tri": "Trident",
  "brn": "Brandistock",
  "spt": "Spetum",
  "pik": "Pike",
  "bar": "Bardiche",
  "vou": "Voulge",
  "scy": "Scythe",
  "pax": "Poleaxe",
  "hal": "Halberd",
  "wsc": "War Scythe",
  "sst": "Short Staff",
  "lst": "Long Staff",
  "cst": "Gnarled Staff",
  "bst": "Battle Staff",
  "wst": "War Staff",
  "sbw": "Short Bow",
  "hbw": "Hunter's Bow",
  "lbw": "Long Bow",
  "cbw": "Composite Bow",
  "sbb": "Short Battle Bow",
  "lbb": "Long Battle Bow",
  "swb": "Short War Bow",
  "lwb": "Long War Bow",
  "lxb": "Light Crossbow",
  "mxb": "Crossbow",
  "hxb": "Heavy Crossbow",
  "rxb": "Repeating Crossbow",
  "gps": "Rancid Gas Potion",
  "ops": "Oil Potion",
  "gpm": "Choking Gas Potion",
  "opm": "Exploding Potion",
  "gpl": "Strangling Gas Potion",
  "opl": "Fulminating Potion",
  "d33": "decoy dagger",
  "g33": "Gidbinn",
  "leg": "Wirt's Leg",
  "hdm": "Horadric Malus",
  "hfh": "Hellforge Hammer",
  "hst": "Horadric Staff",
  "msf": "Staff of the Kings",
  "9ha": "Hatchet",
  "9ax": "Cleaver",
  "92a": "Twin Axe",
  "9mp": "Crowbill",
  "9wa": "Naga",
  "9la": "Military Axe",
  "9ba": "Bearded Axe",
  "9bt": "Tabar",
  "9ga": "Gothic Axe",
  "9gi": "Ancient Axe",
  "9wn": "Burnt Wand",
  "9yw": "Petrified Wand",
  "9bw": "Tomb Wand",
  "9gw": "Grave Wand",
  "9cl": "Cudgel",
  "9sc": "Rune Scepter",
  "9qs": "Holy Water Sprinkler",
  "9ws": "Divine Scepter",
  "9sp": "Barbed Club",
  "9ma": "Flanged Mace",
  "9mt": "Jagged Star",
  "9fl": "Knout",
  "9wh": "Battle Hammer",
  "9m9": "War Club",
  "9gm": "Martel de Fer",
  "9ss": "Gladius",
  "9sm": "Cutlass",
  "9sb": "Shamshir",
  "9fc": "Tulwar",
  "9cr": "Dimensional Blade",
  "9bs": "Battle Sword",
  "9ls": "Rune Sword",
  "9wd": "Ancient Sword",
  "92h": "Espadon",
  "9cm": "Dacian Falx",
  "9gs": "Tusk Sword",
  "9b9": "Gothic Sword",
  "9fb": "Zweihander",
  "9gd": "Executioner Sword",
  "9dg": "Poignard",
  "9di": "Rondel",
  "9kr": "Cinquedeas",
  "9bl": "Stilleto",
  "9tk": "Battle Dart",
  "9ta": "Francisca",
  "9bk": "War Dart",
  "9b8": "Hurlbat",
  "9ja": "War Javelin",
  "9pi": "Great Pilum",
  "9s9": "Simbilan",
  "9gl": "Spiculum",
  "9ts": "Harpoon",
  "9sr": "War Spear",
  "9tr": "Fuscina",
  "9br": "War Fork",
  "9st": "Yari",
  "9p9": "Lance",
  "9b7": "Lochaber Axe",
  "9vo": "Bill",
  "9s8": "Battle Scythe",
  "9pa": "Partizan",
  "9h9": "Bec-de-Corbin",
  "9wc": "Grim Scythe",
  "8ss": "Jo Staff",
  "8ls": "Quarterstaff",
  "8cs": "Cedar Staff",
  "8bs": "Gothic Staff",
  "8ws": "Rune Staff",
  "8sb": "Edge Bow",
  "8hb": "Razor Bow",
  "8lb": "Cedar Bow",
  "8cb": "Double Bow",
  "8s8": "Short Siege Bow",
  "8l8": "Long Siege Bow",
  "8sw": "Rune Bow",
  "8lw": "Gothic Bow",
  "8lx": "Arbalest",
  "8mx": "Siege Crossbow",
  "8hx": "Balista",
  "8rx": "Chu-Ko-Nu",
  "qf1": "KhalimFlail",
  "qf2": "SuperKhalimFlail",
  "ktr": "Katar",
  "wrb": "Wrist Blade",
  "axf": "Hatchet Hands",
  "ces": "Cestus",
  "clw": "Claws",
  "btl": "Blade Talons",
  "skr": "Scissors Katar",
  "9ar": "Quhab",
  "9wb": "Wrist Spike",
  "9xf": "Fascia",
  "9cs": "Hand Scythe",
  "9lw": "Greater Claws",
  "9tw": "Greater Talons",
  "9qr": "Scissors Quhab",
  "7ar": "Suwayyah",
  "7wb": "Wrist Sword",
  "7xf": "War Fist",
  "7cs": "Battle Cestus",
  "7lw": "Feral Claws",
  "7tw": "Runic Talons",
  "7qr": "Scissors Suwayyah",
  "7ha": "Tomahawk",
  "7ax": "Small Crescent",
  "72a": "Ettin Axe",
  "7mp": "War Spike",
  "7wa": "Berserker Axe",
  "7la": "Feral Axe",
  "7ba": "Silver Edged Axe",
  "7bt": "Decapitator",
  "7ga": "Champion Axe",
  "7gi": "Glorious Axe",
  "7wn": "Polished Wand",
  "7yw": "Ghost Wand",
  "7bw": "Lich Wand",
  "7gw": "Unearthed Wand",
  "7cl": "Truncheon",
  "7sc": "Mighty Scepter",
  "7qs": "Seraph Rod",
  "7ws": "Caduceus",
  "7sp": "Tyrant Club",
  "7ma": "Reinforced Mace",
  "7mt": "Devil Star",
  "7fl": "Scourge",
  "7wh": "Legendary Mallet",
  "7m7": "Ogre Maul",
  "7gm": "Thunder Maul",
  "7ss": "Falcata",
  "7sm": "Ataghan",
  "7sb": "Elegant Blade",
  "7fc": "Hydra Edge",
  "7cr": "Phase Blade",
  "7bs": "Conquest Sword",
  "7ls": "Cryptic Sword",
  "7wd": "Mythical Sword",
  "72h": "Legend Sword",
  "7cm": "Highland Blade",
  "7gs": "Balrog Blade",
  "7b7": "Champion Sword",
  "7fb": "Colossal Sword",
  "7gd": "Colossus Blade",
  "7dg": "Bone Knife",
  "7di": "Mithral Point",
  "7kr": "Fanged Knife",
  "7bl": "Legend Spike",
  "7tk": "Flying Knife",
  "7ta": "Flying Axe",
  "7bk": "Winged Knife",
  "7b8": "Winged Axe",
  "7ja": "Hyperion Javelin",
  "7pi": "Stygian Pilum",
  "7s7": "Balrog Spear",
  "7gl": "Ghost Glaive",
  "7ts": "Winged Harpoon",
  "7sr": "Hyperion Spear",
  "7tr": "Stygian Pike",
  "7br": "Mancatcher",
  "7st": "Ghost Spear",
  "7p7": "War Pike",
  "7o7": "Ogre Axe",
  "7vo": "Colossus Voulge",
  "7s8": "Thresher",
  "7pa": "Cryptic Axe",
  "7h7": "Great Poleaxe",
  "7wc": "Giant Thresher",
  "6ss": "Walking Stick",
  "6ls": "Stalagmite",
  "6cs": "Elder Staff",
  "6bs": "Shillelah",
  "6ws": "Archon Staff",
  "6sb": "Spider Bow",
  "6hb": "Blade Bow",
  "6lb": "Shadow Bow",
  "6cb": "Great Bow",
  "6s7": "Diamond Bow",
  "6l7": "Crusader Bow",
  "6sw": "Ward Bow",
  "6lw": "Hydra Bow",
  "6lx": "Pellet Bow",
  "6mx": "Gorgon Crossbow",
  "6hx": "Colossus Crossbow",
  "6rx": "Demon Crossbow",
  "ob1": "Eagle Orb",
  "ob2": "Sacred Globe",
  "ob3": "Smoked Sphere",
  "ob4": "Clasped Orb",
  "ob5": "Dragon Stone",
  "am1": "Stag Bow",
  "am2": "Reflex Bow",
  "am3": "Maiden Spear",
  "am4": "Maiden Pike",
  "am5": "Maiden Javelin",
  "ob6": "Glowing Orb",
  "ob7": "Crystalline Globe",
  "ob8": "Cloudy Sphere",
  "ob9": "Sparkling Ball",
  "oba": "Swirling Crystal",
  "am6": "Ashwood Bow",
  "am7": "Ceremonial Bow",
  "am8": "Ceremonial Spear",
  "am9": "Ceremonial Pike",
  "ama": "Ceremonial Javelin",
  "obb": "Heavenly Stone",
  "obc": "Eldritch Orb",
  "obd": "Demon Heart",
  "obe": "Vortex Orb",
  "obf": "Dimensional Shard",
  "amb": "Matriarchal Bow",
  "amc": "Grand Matron Bow",
  "amd": "Matriarchal Spear",
  "ame": "Matriarchal Pike",
  "amf": "MatriarchalJavelin",
  "elx": "elixir",
  "hpo": "Healing Potion",
  "mpo": "Mana Potion",
  "hpf": "Full Healing Potion",
  "mpf": "Full Mana Potion",
  "vps": "Stamina Potion",
  "yps": "Antidote Potion",
  "rvs": "Rejuv Potion",
  "rvl": "Full Rejuv Potion",
  "wms": "Thawing Potion",
  "tbk": "Town Portal Book",
  "ibk": "Identify Book",
  "amu": "amulet",
  "vip": "viper amulet",
  "rin": "ring",
  "gld": "gold",
  "bks": "Bark Scroll",
  "bkd": "deciphered Bark Scroll",
  "aqv": "Arrows",
  "tch": "Torch",
  "cqv": "Bolts",
  "tsc": "Town Portal Scroll",
  "isc": "Identify Scroll",
  "hrt": "Not used",
  "brz": "Not used",
  "jaw": "Not used",
  "eyz": "Not used",
  "hrn": "Not used",
  "tal": "Not used",
  "flg": "Not used",
  "fng": "Not used",
  "qll": "Not used",
  "sol": "Not used",
  "scz": "Not used",
  "spe": "Not used",
  "key": "Skeleton Key",
  "luv": "Mephisto Key",
  "xyz": "scroll of self resurrect",
  "j34": "jade figurine",
  "g34": "gold bird",
  "bbb": "lam esen's tome",
  "box": "Horadric Cube",
  "tr1": "Scroll of Horadric Quest Info",
  "mss": "Mephisto SoulStone",
  "ass": "Book of Skill",
  "qey": "KhalimEye",
  "qhr": "KhalimHeart",
  "qbr": "KhalimBrain",
  "ear": "Player Ear",
  "gcv": "Chipped Amethyst",
  "gfv": "Flawed Amethyst",
  "gsv": "Amethyst",
  "gzv": "Flawless Amethyst",
  "gpv": "Perfect Amethyst",
  "gcy": "Chipped Topaz",
  "gfy": "Flawed Topaz",
  "gsy": "Topaz",
  "gly": "Flawless Topaz",
  "gpy": "Perfect Topaz",
  "gcb": "Chipped Saphire",
  "gfb": "Flawed Saphire",
  "gsb": "Saphire",
  "glb": "Flawless Saphire",
  "gpb": "Perfect Saphire",
  "gcg": "Chipped Emerald",
  "gfg": "Flawed Emerald",
  "gsg": "Emerald",
  "glg": "Flawless Emerald",
  "gpg": "Perfect Emerald",
  "gcr": "Chipped Ruby",
  "gfr": "Flawed Ruby",
  "gsr": "Ruby",
  "glr": "Flawless Ruby",
  "gpr": "Perfect Ruby",
  "gcw": "Chipped Diamond",
  "gfw": "Flawed Diamond",
  "gsw": "Diamond",
  "glw": "Flawless Diamond",
  "gpw": "Perfect Diamond",
  "hp1": "Lesser Healing Potion",
  "hp2": "Light Healing Potion",
  "hp3": "Healing Potion",
  "hp4": "Strong Healing Potion",
  "hp5": "Greater Healing Potion",
  "mp1": "Lesser Mana Potion",
  "mp2": "Light Mana Potion",
  "mp3": "Mana Potion",
  "mp4": "Strong Mana Potion",
  "mp5": "Greater Mana Potion",
  "skc": "Chipped Skull",
  "skf": "Flawed Skull",
  "sku": "Skull",
  "skl": "Flawless Skull",
  "skz": "Perfect Skull",
  "hrb": "herb",
  "cm1": "Charm Small",
  "cm2": "Charm Medium",
  "cm3": "Charm Large",
  "rps": "Small Red Potion",
  "rpl": "Large Red Potion",
  "bps": "Small Blue Potion",
  "bpl": "Large Blue Potion",
  "r01": "El Rune",
  "r02": "Eld Rune",
  "r03": "Tir Rune",
  "r04": "Nef Rune",
  "r05": "Eth Rune",
  "r06": "Ith Rune",
  "r07": "Tal Rune",
  "r08": "Ral Rune",
  "r09": "Ort Rune",
  "r10": "Thul Rune",
  "r11": "Amn Rune",
  "r12": "Sol Rune",
  "r13": "Shael Rune",
  "r14": "Dol Rune",
  "r15": "Hel Rune",
  "r16": "Io Rune",
  "r17": "Lum Rune",
  "r18": "Ko Rune",
  "r19": "Fal Rune",
  "r20": "Lem Rune",
  "r21": "Pul Rune",
  "r22": "Um Rune",
  "r23": "Mal Rune",
  "r24": "Ist Rune",
  "r25": "Gul Rune",
  "r26": "Vex Rune",
  "r27": "Ohm Rune",
  "r28": "Lo Rune",
  "r29": "Sur Rune",
  "r30": "Ber Rune",
  "r31": "Jah Rune",
  "r32": "Cham Rune",
  "r33": "Zod Rune",
  "jew": "Jewel",
  "ice": "Maguffin",
  "0sc": "Scroll",
  "tr2": "Scroll of Malah - Boost Resistances",
  "pk1": "Pandemonium Key 1",
  "pk2": "Pandemonium Key 2",
  "pk3": "Pandemonium Key 3",
  "dhn": "Diablo's Horn",
  "bey": "Baal's Eye",
  "mbr": "Mephisto's Brain",
  "toa": "Token of Absolution",
  "tes": "Twisted Essence of Suffering",
  "ceh": "Charged Essense of Hatred",
  "bet": "Burning Essence of Terror",
  "fed": "Festering Essence of Destruction",
  "std": "Standard"
}

function extractTblTitleLine(s: string): string {
  const trimmed = s.trim()
  if (!trimmed.includes('\n')) return trimmed
  const parts = trimmed
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
  return parts[parts.length - 1] ?? trimmed
}

/**
 * Resolves a base item's canonical 1.13c English display name via `.tbl` (`CANONICAL_ENG_TBL_DICT`).
 * For multi-line `.tbl` strings (`xyz`, `ass`, `ice`, `tr2`, `toa`) where line 0 is the right-click
 * instruction and line 1 is the item name, returns the item name (last non-empty line).
 */
export function resolveBaseItemNameEn(baseName: string, baseCode?: string): string {
  const trimmed = (baseName || '').trim()
  const code = (baseCode || '').trim()
  if (
    code &&
    CANONICAL_ENG_TBL_DICT[code] &&
    (!trimmed ||
      trimmed.toLowerCase() === code.toLowerCase() ||
      trimmed in TXT_NAME_TO_TBL_KEY ||
      BASE_CODE_TO_TXT_NAME[code] === trimmed)
  ) {
    return extractTblTitleLine(CANONICAL_ENG_TBL_DICT[code])
  }
  if (!trimmed) return ''
  const mappedKey = TXT_NAME_TO_TBL_KEY[trimmed]
  if (mappedKey && CANONICAL_ENG_TBL_DICT[mappedKey]) {
    return extractTblTitleLine(CANONICAL_ENG_TBL_DICT[mappedKey])
  }
  if (CANONICAL_ENG_TBL_DICT[trimmed]) {
    return extractTblTitleLine(CANONICAL_ENG_TBL_DICT[trimmed])
  }
  if (CANONICAL_ENG_TBL_DICT[trimmed + ' ']) {
    return extractTblTitleLine(CANONICAL_ENG_TBL_DICT[trimmed + ' '])
  }
  return extractTblTitleLine(trimmed)
}

/**
 * Resolves a Rare item's canonical 1.13c English name via `.tbl` (`RarePrefix.txt` + `RareSuffix.txt` keys
 * such as `GhoulRI` -> `Ghoul`, `barRI` -> `Bar`, `bite` -> `Bite`).
 */
export function resolveRareNameEn(rareName: string, prefixKey?: string, suffixKey?: string): string {
  if (prefixKey && suffixKey) {
    const preEn = (CANONICAL_ENG_TBL_DICT[prefixKey.trim()] ?? prefixKey.trim()).trim()
    const sufEn = (CANONICAL_ENG_TBL_DICT[suffixKey.trim()] ?? suffixKey.trim()).trim()
    return `${preEn} ${sufEn}`
  }
  if (!rareName) return ''
  const parts = rareName.trim().split(/\s+/)
  if (parts.length >= 2) {
    const pre = parts[0]
    const suf = parts.slice(1).join(' ')
    const preEn = (CANONICAL_ENG_TBL_DICT[pre] ?? pre).trim()
    const sufEn = (CANONICAL_ENG_TBL_DICT[suf] ?? suf).trim()
    return `${preEn} ${sufEn}`
  }
  return (CANONICAL_ENG_TBL_DICT[rareName.trim()] ?? rareName.trim()).trim()
}

/**
 * Resolves a Magic item's canonical 1.13c English name via `.tbl` (`MagicPrefix.txt` + `MagicSuffix.txt` keys
 * such as `Mechanist's` -> `Mechanic's`, `of the Colosuss` -> `of the Colossus`, `of Warmth` -> `of Thawing`).
 */
export function resolveMagicNameEn(
  magicName: string,
  baseName?: string,
  prefixKey?: string,
  suffixKey?: string,
  baseCode?: string,
): string {
  if (!magicName && !baseName) return ''
  let pre = prefixKey?.trim() || ''
  let suf = suffixKey?.trim() || ''
  let base = baseName?.trim() || ''
  const resolvedBaseCandidate = base ? resolveBaseItemNameEn(base, baseCode) : ''

  if (!pre && !suf && magicName) {
    if (magicName.includes(' of ')) {
      const ofParts = magicName.split(' of ')
      suf = 'of ' + ofParts.slice(1).join(' of ').trim()
      const left = ofParts[0].trim()
      if (resolvedBaseCandidate && left.endsWith(resolvedBaseCandidate)) {
        pre = left.slice(0, left.length - resolvedBaseCandidate.length).trim()
        base = resolvedBaseCandidate
      } else if (base && left.endsWith(base)) {
        pre = left.slice(0, left.length - base.length).trim()
      } else {
        const words = left.split(/\s+/)
        if (words.length > 1) {
          pre = words[0]
          base = words.slice(1).join(' ')
        } else {
          base = left
        }
      }
    } else if (resolvedBaseCandidate && magicName.endsWith(resolvedBaseCandidate)) {
      pre = magicName.slice(0, magicName.length - resolvedBaseCandidate.length).trim()
      base = resolvedBaseCandidate
    } else if (base && magicName.endsWith(base)) {
      pre = magicName.slice(0, magicName.length - base.length).trim()
    }
  }

  const resolvedBase = resolveBaseItemNameEn(base || magicName, baseCode)
  const resolvedPre = pre ? (CANONICAL_ENG_TBL_DICT[pre] ?? pre).trim() : ''
  const resolvedSuf = suf ? (CANONICAL_ENG_TBL_DICT[suf] ?? suf).trim() : ''

  if (resolvedPre && resolvedSuf) {
    return `${resolvedPre} ${resolvedBase} ${resolvedSuf}`
  }
  if (resolvedPre) {
    return `${resolvedPre} ${resolvedBase}`
  }
  if (resolvedSuf) {
    return `${resolvedBase} ${resolvedSuf}`
  }
  return magicName ? resolveBaseItemNameEn(magicName, baseCode) : resolvedBase
}

/**
 * Translates an item name (base, unique, set item, set name, rune) into Chinese.
 */
export function translateItemName(enName: string, baseCode?: string): string {
  if (!enName && !baseCode) return ''
  const trimmed = (enName || '').trim()
  const code = (baseCode || '').trim()

  // Superior prefix
  if (trimmed.startsWith('Superior ')) {
    const sub = trimmed.slice('Superior '.length).trim()
    return '超强的' + translateItemName(sub, code)
  }
  // Gemmed prefix (socketed non-runeword base items)
  if (trimmed.startsWith('Gemmed ')) {
    const sub = trimmed.slice('Gemmed '.length).trim()
    return '镶嵌的' + translateItemName(sub, code)
  }
  // Low quality prefixes (LowQualityItems.txt -> CHI string.tbl: 劣质的, 损坏的, 破碎的, 粗制的)
  if (trimmed.startsWith('Cracked ')) {
    const sub = trimmed.slice('Cracked '.length).trim()
    return (ITEM_NAMES_ZH['Cracked'] ?? '破碎的') + translateItemName(sub, code)
  }
  if (trimmed.startsWith('Crude ')) {
    const sub = trimmed.slice('Crude '.length).trim()
    return (ITEM_NAMES_ZH['Crude'] ?? '粗制的') + translateItemName(sub, code)
  }
  if (trimmed.startsWith('Low Quality ')) {
    const sub = trimmed.slice('Low Quality '.length).trim()
    return (ITEM_NAMES_ZH['Low Quality'] ?? '劣质的') + translateItemName(sub, code)
  }
  if (trimmed.startsWith('Damaged ')) {
    const sub = trimmed.slice('Damaged '.length).trim()
    return (ITEM_NAMES_ZH['Damaged'] ?? '损坏的') + translateItemName(sub, code)
  }

  // If baseCode is provided and trimmed is the .txt internal name (which differs from .tbl English name),
  // resolve to the canonical .tbl English name first so collisions like "Greater Healing Potion" (hp5 vs hp4)
  // or "Ancient Shield" (pad vs xts) use the .tbl name for baseCode.
  if (code) {
    const tblEnWithCode = resolveBaseItemNameEn(trimmed, code)
    if (tblEnWithCode !== trimmed && ITEM_NAMES_ZH[tblEnWithCode]) {
      return ITEM_NAMES_ZH[tblEnWithCode]
    }
  }

  if (ITEM_NAMES_ZH[trimmed]) return ITEM_NAMES_ZH[trimmed]

  const tblEn = resolveBaseItemNameEn(trimmed, code)
  if (tblEn !== trimmed && ITEM_NAMES_ZH[tblEn]) {
    return ITEM_NAMES_ZH[tblEn]
  }
  if (code && ITEM_NAMES_ZH[code]) {
    return ITEM_NAMES_ZH[code]
  }
  if (CANONICAL_CHI_TBL_DICT[trimmed]) {
    return CANONICAL_CHI_TBL_DICT[trimmed].trim()
  }

  // Rune check
  for (const r of Object.values(RUNE_INFO_ZH)) {
    if (r.nameEn.toLowerCase() === trimmed.toLowerCase()) {
      return r.nameZh + '符文'
    }
  }

  return trimmed
}

/**
 * Translates skill name into Chinese.
 */
export function translateSkillName(enSkill: string): string {
  if (!enSkill) return ''
  const trimmed = enSkill.trim()
  if (SKILL_NAMES_ZH[trimmed]) return SKILL_NAMES_ZH[trimmed]
  if (SKILL_NAMES_ZH[trimmed.toLowerCase()]) return SKILL_NAMES_ZH[trimmed.toLowerCase()]
  return trimmed
}

/**
 * Translates Rare Item Name (e.g. "Shadow Brow" -> "阴影之额", "GhoulRI barRI" -> "食尸鬼之棒").
 */
export function translateRareName(rareName: string, prefixKey?: string, suffixKey?: string): string {
  if (prefixKey && suffixKey) {
    const pre = prefixKey.trim()
    const suf = suffixKey.trim()
    const preEn = (CANONICAL_ENG_TBL_DICT[pre] ?? pre).trim()
    const sufEn = (CANONICAL_ENG_TBL_DICT[suf] ?? suf).trim()
    const preZh =
      RARE_PREFIX_ZH[pre] ??
      RARE_PREFIX_ZH[preEn] ??
      RARE_PREFIX_ZH[pre.toLowerCase()] ??
      RARE_PREFIX_ZH[preEn.toLowerCase()] ??
      CANONICAL_CHI_TBL_DICT[pre]?.trim() ??
      preEn
    const sufZh =
      RARE_SUFFIX_ZH[suf] ??
      RARE_SUFFIX_ZH[sufEn] ??
      RARE_SUFFIX_ZH[suf.toLowerCase()] ??
      RARE_SUFFIX_ZH[sufEn.toLowerCase()] ??
      CANONICAL_CHI_TBL_DICT[suf]?.trim() ??
      sufEn
    return preZh + sufZh
  }
  if (!rareName) return ''
  const parts = rareName.trim().split(/\s+/)
  if (parts.length >= 2) {
    const pre = parts[0]
    const suf = parts.slice(1).join(' ')
    const preEn = (CANONICAL_ENG_TBL_DICT[pre] ?? pre).trim()
    const sufEn = (CANONICAL_ENG_TBL_DICT[suf] ?? suf).trim()
    const preZh =
      RARE_PREFIX_ZH[pre] ??
      RARE_PREFIX_ZH[preEn] ??
      RARE_PREFIX_ZH[pre.toLowerCase()] ??
      RARE_PREFIX_ZH[preEn.toLowerCase()] ??
      CANONICAL_CHI_TBL_DICT[pre]?.trim() ??
      preEn
    const sufZh =
      RARE_SUFFIX_ZH[suf] ??
      RARE_SUFFIX_ZH[sufEn] ??
      RARE_SUFFIX_ZH[suf.toLowerCase()] ??
      RARE_SUFFIX_ZH[sufEn.toLowerCase()] ??
      CANONICAL_CHI_TBL_DICT[suf]?.trim() ??
      sufEn
    return preZh + sufZh
  }
  return rareName
}

/**
 * Translates Magic Item Name (e.g. "Sturdy Leather Armor of Life" -> "结实之生命的皮甲").
 */
export function translateMagicName(
  magicName: string,
  baseName?: string,
  prefixKey?: string,
  suffixKey?: string,
  baseCode?: string,
): string {
  if (!magicName && !baseName) return ''
  let pre = prefixKey?.trim() || ''
  let suf = suffixKey?.trim() || ''
  let base = baseName?.trim() || ''
  const resolvedBaseCandidate = base ? resolveBaseItemNameEn(base, baseCode) : ''

  if (!pre && !suf && magicName) {
    if (magicName.includes(' of ')) {
      const ofParts = magicName.split(' of ')
      suf = 'of ' + ofParts.slice(1).join(' of ').trim()
      const left = ofParts[0].trim()
      if (resolvedBaseCandidate && left.endsWith(resolvedBaseCandidate)) {
        pre = left.slice(0, left.length - resolvedBaseCandidate.length).trim()
        base = resolvedBaseCandidate
      } else if (base && left.endsWith(base)) {
        pre = left.slice(0, left.length - base.length).trim()
      } else {
        const words = left.split(/\s+/)
        if (words.length > 1) {
          pre = words[0]
          base = words.slice(1).join(' ')
        } else {
          base = left
        }
      }
    } else if (resolvedBaseCandidate && magicName.endsWith(resolvedBaseCandidate)) {
      pre = magicName.slice(0, magicName.length - resolvedBaseCandidate.length).trim()
      base = resolvedBaseCandidate
    } else if (base && magicName.endsWith(base)) {
      pre = magicName.slice(0, magicName.length - base.length).trim()
    } else {
      const words = magicName.split(/\s+/)
      if (words.length > 1) {
        pre = words[0]
        base = words.slice(1).join(' ')
      } else {
        base = magicName
      }
    }
  }

  const preEn = pre ? (CANONICAL_ENG_TBL_DICT[pre] ?? pre).trim() : ''
  const sufEn = suf ? (CANONICAL_ENG_TBL_DICT[suf] ?? suf).trim() : ''
  const preZh = pre
    ? (MAGIC_PREFIX_ZH[pre] ??
      MAGIC_PREFIX_ZH[preEn] ??
      CANONICAL_CHI_TBL_DICT[pre]?.trim() ??
      (preEn.endsWith('之') ? preEn : preEn + '之'))
    : ''
  const sufKey = suf.startsWith('of ') ? suf : 'of ' + suf
  const sufEnKey = sufEn.startsWith('of ') ? sufEn : 'of ' + sufEn
  const sufZh = suf
    ? (MAGIC_SUFFIX_ZH[suf] ??
      MAGIC_SUFFIX_ZH[sufKey] ??
      MAGIC_SUFFIX_ZH[sufEn] ??
      MAGIC_SUFFIX_ZH[sufEnKey] ??
      MAGIC_SUFFIX_ZH[suf.replace(/^of\s+/, '')] ??
      MAGIC_SUFFIX_ZH[sufEn.replace(/^of\s+/, '')] ??
      CANONICAL_CHI_TBL_DICT[suf]?.trim() ??
      (sufEn.endsWith('的') || sufEn.endsWith('之') ? sufEn : sufEn + '的'))
    : ''
  const baseZh = translateItemName(base || magicName, baseCode)

  if (preZh && sufZh) {
    return `${preZh}${sufZh}${baseZh}`
  }
  if (preZh) {
    return `${preZh}${baseZh}`
  }
  if (sufZh) {
    return `${sufZh}${baseZh}`
  }
  return translateItemName(magicName, baseCode)
}

/**
 * Formats property code into Simplified Chinese (or English if locale === 'en').
 */
export function formatPropertyCodeI18n(
  code: string,
  valueOrMin: number,
  minOrMax?: number,
  maxOrPar?: number | string,
  maybePar?: string | number,
  locale: TooltipLocale = getTooltipLocale(),
  charLevel = 1,
): string {
  let value: number
  let min: number
  let max: number
  let par: string | number | undefined

  if (typeof maxOrPar === 'number') {
    value = valueOrMin
    min = minOrMax ?? valueOrMin
    max = maxOrPar
    par = maybePar
  } else if (typeof minOrMax === 'number') {
    if (typeof maxOrPar === 'string') {
      min = valueOrMin
      max = minOrMax
      value = min
      par = maxOrPar
    } else {
      min = valueOrMin
      max = minOrMax
      value = valueOrMin
    }
  } else {
    value = valueOrMin
    min = valueOrMin
    max = valueOrMin
    if (typeof minOrMax === 'string') {
      par = minOrMax
    }
  }

  if (maybePar !== undefined && maybePar !== '') {
    par = maybePar
  }

  const effectiveVal =
    value === 0 && min === 0 && max === 0 && par !== undefined && par !== '' && !Number.isNaN(Number(par))
      ? Number(par)
      : value

  const plusVal = effectiveVal >= 0 ? `+${effectiveVal}` : `${effectiveVal}`

  if (locale === 'en') {
    // Return standard 1.13c English
    return formatPropertyCodeEn(code, value, min, max, par, effectiveVal, plusVal, charLevel)
  }

  // --- Chinese Formatter (locale === 'zh' or 'bilingual') ---
  return formatPropertyCodeZh(code, value, min, max, par, effectiveVal, plusVal, charLevel)
}

/**
 * Ground Truth (`D2Client.dll` `0x6FB046E0` + `0x6FB04E10` `descFunc` 6..10 & `ItemStatCost.txt` `op` 2..5):
 * Per-level properties (`op` 2..5, `op param = 3`) compute `(clvl * rawEighths) >> 3` as an integer
 * for the current character level (`clvl >= 1`). Stats 216 (`hp/lvl`) and 217 (`mana/lvl`) have
 * `ValShift = 8` on the wire (`<< 8`), which is normalized before shifting by `op param = 3`.
 */
function formatPerLevelVal(rawEighths: number, charLevel = 1, isValShift8 = false): string {
  const eighths =
    isValShift8 && Math.abs(rawEighths) >= 256 && (rawEighths & 0xff) === 0
      ? rawEighths >> 8
      : rawEighths
  const clvl = charLevel > 0 && Number.isFinite(charLevel) ? Math.max(1, Math.trunc(charLevel)) : 1
  return `${Math.floor((eighths * clvl) / 8)}`
}

function resolveSkillInfoZh(par: string | number | undefined): { name: string; classOnly?: string } {
  if (par === undefined || par === '') {
    return { name: '未知技能' }
  }
  const info = resolveSkillInfo(par)
  const nameZh = translateSkillName(info.name)
  let classOnlyZh: string | undefined
  if (info.classOnly) {
    if (info.classOnly.includes('Amazon')) classOnlyZh = '(限亚马逊使用)'
    else if (info.classOnly.includes('Sorceress')) classOnlyZh = '(限法师使用)'
    else if (info.classOnly.includes('Necromancer')) classOnlyZh = '(限死灵法师使用)'
    else if (info.classOnly.includes('Paladin')) classOnlyZh = '(限圣骑士使用)'
    else if (info.classOnly.includes('Barbarian')) classOnlyZh = '(限野蛮人使用)'
    else if (info.classOnly.includes('Druid')) classOnlyZh = '(限德鲁伊使用)'
    else if (info.classOnly.includes('Assassin')) classOnlyZh = '(限刺客使用)'
    else classOnlyZh = info.classOnly
  }
  return classOnlyZh ? { name: nameZh, classOnly: classOnlyZh } : { name: nameZh }
}

function formatPropertyCodeZh(
  code: string,
  _value: number,
  min: number,
  max: number,
  par: string | number | undefined,
  effectiveVal: number,
  plusVal: string,
  charLevel = 1,
): string {
  switch (code.trim().toLowerCase().replace(/^\*/, '')) {
    // --- Skills & Class Skills ---
    case 'allskills':
      return `${plusVal} 所有技能`
    case 'ama':
      return `${plusVal} 亚马逊技能等级`
    case 'sor':
      return `${plusVal} 法师技能等级`
    case 'nec':
      return `${plusVal} 死灵法师技能等级`
    case 'pal':
      return `${plusVal} 圣骑士技能等级`
    case 'bar':
      return `${plusVal} 野蛮人技能等级`
    case 'dru':
      return `${plusVal} 德鲁伊技能等级`
    case 'ass':
      return `${plusVal} 刺客技能等级`
    case 'randclassskill':
      return `+${effectiveVal || 3} 随机职业技能等级`
    case 'classskills': {
      const clsKey = String(par || '').trim().toLowerCase()
      const clsName = CLASS_SKILL_NAMES_ZH[clsKey] || `${par} 技能等级`
      return `${plusVal} ${clsName}`
    }
    case 'fireskill':
      return `${plusVal} 火焰技能`
    case 'skilltab': {
      const tabId = Number(par)
      if (!Number.isNaN(tabId) && CANONICAL_SKILL_TABS_ZH[tabId]) {
        return `${plusVal} ${CANONICAL_SKILL_TABS_ZH[tabId]}`
      }
      return `${plusVal} ${par ?? '技能系'}`
    }
    case 'skill': {
      const sk = resolveSkillInfoZh(par)
      return `${plusVal} ${sk.name}${sk.classOnly ? ` ${sk.classOnly}` : ''}`
    }
    case 'skill-rand': {
      const slvl = Number(par) || effectiveVal || 3
      const sk = resolveSkillInfoZh(min)
      return `+${slvl} ${sk.name}`
    }
    case 'oskill': {
      const sk = resolveSkillInfoZh(par)
      return `${plusVal} ${sk.name}`
    }
    case 'aura': {
      const sk = resolveSkillInfoZh(par)
      return `赋予等级 ${effectiveVal} ${sk.name} 灵气`
    }

    // --- Procs & Charges ---
    case 'hit-skill': {
      const sk = resolveSkillInfoZh(par)
      const chance = min || effectiveVal || 5
      const slvl = max || 1
      return `击中时有 ${chance}% 几率施展等级 ${slvl} ${sk.name}`
    }
    case 'att-skill': {
      const sk = resolveSkillInfoZh(par)
      const chance = min || effectiveVal || 5
      const slvl = max || 1
      return `攻击时有 ${chance}% 几率施展等级 ${slvl} ${sk.name}`
    }
    case 'gethit-skill': {
      const sk = resolveSkillInfoZh(par)
      const chance = min || effectiveVal || 5
      const slvl = max || 1
      return `受击时有 ${chance}% 几率施展等级 ${slvl} ${sk.name}`
    }
    case 'kill-skill': {
      const sk = resolveSkillInfoZh(par)
      const chance = min || effectiveVal || 5
      const slvl = max || 1
      return `击杀敌人时有 ${chance}% 几率施展等级 ${slvl} ${sk.name}`
    }
    case 'death-skill': {
      const sk = resolveSkillInfoZh(par)
      const chance = min || effectiveVal || 100
      const slvl = max || 1
      return `死亡时有 ${chance}% 几率施展等级 ${slvl} ${sk.name}`
    }
    case 'levelup-skill': {
      const sk = resolveSkillInfoZh(par)
      const chance = min || effectiveVal || 100
      const slvl = max || 1
      return `升级时有 ${chance}% 几率施展等级 ${slvl} ${sk.name}`
    }
    case 'charged': {
      const sk = resolveSkillInfoZh(par)
      const charges = Math.abs(min || effectiveVal || 10)
      const slvl = Math.abs(max || 1)
      return `等级 ${slvl} ${sk.name} (${charges}/${charges} 次充能)`
    }

    // --- Attributes & Life / Mana / Stamina ---
    case 'str':
      return `${plusVal} 力量`
    case 'dex':
      return `${plusVal} 敏捷`
    case 'vit':
      return `${plusVal} 体力`
    case 'enr':
      return `${plusVal} 精力`
    case 'all-stats':
      return `${plusVal} 所有属性`
    case 'hp':
      return `${plusVal} 生命`
    case 'hp%':
      return `提升生命上限 ${effectiveVal}%`
    case 'mana':
      return `${plusVal} 法力`
    case 'mana%':
      return `提升法力上限 ${effectiveVal}%`
    case 'stam':
      return `${plusVal} 体力上限`
    case 'regen-stam':
      return `恢复体力速度 +${effectiveVal}%`
    case 'stamdrain':
      return `减慢体力消耗 ${effectiveVal}%`

    // --- Per Level Scaling ---
    case 'hp/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel, true)} 生命 (依角色等级提升)`
    case 'mana/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel, true)} 法力 (依角色等级提升)`
    case 'stam/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} 体力上限 (依角色等级提升)`
    case 'regen-stam/lvl':
      return `恢复体力速度 +${formatPerLevelVal(effectiveVal, charLevel)}% (依角色等级提升)`
    case 'str/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} 力量 (依角色等级提升)`
    case 'dex/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} 敏捷 (依角色等级提升)`
    case 'vit/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} 体力 (依角色等级提升)`
    case 'enr/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} 精力 (依角色等级提升)`
    case 'ac/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} 防御 (依角色等级提升)`
    case 'ac%/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)}% 强化防御 (依角色等级提升)`
    case 'dmg/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} 最大伤害 (依角色等级提升)`
    case 'dmg%/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)}% 增强最大伤害 (依角色等级提升)`
    case 'att/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} 准确率 (依角色等级提升)`
    case 'att%/lvl':
      return `${formatPerLevelVal(effectiveVal, charLevel)}% 准确率加成 (依角色等级提升)`
    case 'dmg-cold/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} 冰冻最大伤害 (依角色等级提升)`
    case 'dmg-fire/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} 火焰最大伤害 (依角色等级提升)`
    case 'dmg-ltng/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} 闪电最大伤害 (依角色等级提升)`
    case 'dmg-pois/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} 毒素最大伤害 (依角色等级提升)`
    case 'dmg-dem/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)}% 对恶魔的伤害 (依角色等级提升)`
    case 'dmg-und/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)}% 对不死生物的伤害 (依角色等级提升)`
    case 'att-dem/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} 对恶魔的准确率 (依角色等级提升)`
    case 'att-und/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} 对不死生物的准确率 (依角色等级提升)`
    case 'deadly/lvl':
      return `${formatPerLevelVal(effectiveVal, charLevel)}% 致命打击 (依角色等级提升)`
    case 'crush/lvl':
      return `${formatPerLevelVal(effectiveVal, charLevel)}% 几率造成压碎打击 (依角色等级提升)`
    case 'wounds/lvl':
      return `${formatPerLevelVal(effectiveVal, charLevel)}% 几率撕开伤口 (依角色等级提升)`
    case 'kick/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} 踢击伤害 (依角色等级提升)`
    case 'thorns/lvl':
      return `攻击者受到伤害 ${formatPerLevelVal(effectiveVal, charLevel)} (依角色等级提升)`
    case 'mag%/lvl':
      return `${formatPerLevelVal(effectiveVal, charLevel)}% 获得魔法装备几率 (依角色等级提升)`
    case 'gold%/lvl':
      return `${formatPerLevelVal(effectiveVal, charLevel)}% 从怪物获得额外金钱 (依角色等级提升)`
    case 'res-cold/lvl':
      return `抗寒 +${formatPerLevelVal(effectiveVal, charLevel)}% (依角色等级提升)`
    case 'res-fire/lvl':
      return `抗火 +${formatPerLevelVal(effectiveVal, charLevel)}% (依角色等级提升)`
    case 'res-ltng/lvl':
      return `抗电 +${formatPerLevelVal(effectiveVal, charLevel)}% (依角色等级提升)`
    case 'res-pois/lvl':
      return `抗毒 +${formatPerLevelVal(effectiveVal, charLevel)}% (依角色等级提升)`
    case 'abs-cold/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} 吸收冰冻伤害 (依角色等级提升)`
    case 'abs-fire/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} 吸收火焰伤害 (依角色等级提升)`
    case 'abs-ltng/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} 吸收闪电伤害 (依角色等级提升)`
    case 'abs-pois/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} 吸收毒素伤害 (依角色等级提升)`
    case 'ac/time':
      return `${plusVal} 防御 (在夜晚时提升)`

    // --- Defense & Damage Modifiers ---
    case 'ac':
      return `${plusVal} 防御`
    case 'ac%':
      return `${plusVal}% 强化防御`
    case 'ac-miss':
      return `${plusVal} 对远距离武器的防御`
    case 'ac-hth':
      return `${plusVal} 对近战的防御`
    case 'dmg%':
      return `${plusVal}% 增强伤害`
    case 'dmg':
      return `伤害 ${plusVal}`
    case 'dmg-min':
      return `${plusVal} 最小伤害`
    case 'dmg-max':
      return `${plusVal} 最大伤害`
    case 'dmg-norm':
      return min > 0 && max > min ? `增加 ${min}-${max} 伤害` : `${plusVal} 最小伤害`
    case 'dmg-ac':
      return `每次命中 ${plusVal} 怪物防御`
    case 'reduce-ac':
      return `-${Math.abs(effectiveVal)}% 目标防御`
    case 'dmg-demon':
      return `${plusVal}% 对恶魔的伤害`
    case 'dmg-undead':
      return `${plusVal}% 对不死生物的伤害`
    case 'att-demon':
      return `${plusVal} 对恶魔的准确率`
    case 'att-undead':
      return `${plusVal} 对不死生物的准确率`
    case 'demon-heal':
      return `每击杀一个恶魔获得 ${plusVal} 生命`

    // --- Resistances & Max Resistances ---
    case 'res-all':
      return `所有抗性 ${plusVal}`
    case 'res-all-max':
      return `${plusVal}% 最大所有抗性`
    case 'res-fire':
    case 'fireresist':
      return `抗火 ${plusVal}%`
    case 'res-fire-max':
      return `${plusVal}% 最大抗火`
    case 'res-cold':
    case 'coldresist':
      return `抗寒 ${plusVal}%`
    case 'res-cold-max':
      return `${plusVal}% 最大抗寒`
    case 'res-ltng':
    case 'lightresist':
      return `抗电 ${plusVal}%`
    case 'res-ltng-max':
      return `${plusVal}% 最大抗电`
    case 'res-pois':
    case 'poisonresist':
      return `抗毒 ${plusVal}%`
    case 'res-pois-max':
      return `${plusVal}% 最大抗毒`
    case 'res-pois-len':
      return `毒素持续时间减少 ${Math.abs(effectiveVal)}%`
    case 'extra-fire':
      return `${plusVal}% 火焰技能伤害`
    case 'extra-cold':
      return `${plusVal}% 冰冻技能伤害`
    case 'extra-ltng':
      return `${plusVal}% 闪电技能伤害`
    case 'extra-pois':
      return `${plusVal}% 毒素技能伤害`
    case 'pierce-fire':
      return `-${Math.abs(effectiveVal)}% 敌人火焰抗性`
    case 'pierce-cold':
      return `-${Math.abs(effectiveVal)}% 敌人冰冻抗性`
    case 'pierce-ltng':
      return `-${Math.abs(effectiveVal)}% 敌人闪电抗性`
    case 'pierce-pois':
      return `-${Math.abs(effectiveVal)}% 敌人毒素抗性`

    // --- Absorbs ---
    case 'abs-fire':
      return `${plusVal} 吸收火焰伤害`
    case 'abs-fire%':
      return `吸收火焰伤害 ${effectiveVal}%`
    case 'abs-cold':
      return `${plusVal} 吸收冰冻伤害`
    case 'abs-cold%':
      return `吸收冰冻伤害 ${effectiveVal}%`
    case 'abs-ltng':
      return `${plusVal} 吸收闪电伤害`
    case 'abs-ltng%':
      return `吸收闪电伤害 ${effectiveVal}%`
    case 'abs-mag':
      return `${plusVal} 吸收魔法伤害`
    case 'abs-pois':
      return `${plusVal} 吸收毒素伤害`

    // --- Rates & Speeds ---
    case 'fcr':
    case 'cast1':
    case 'cast2':
    case 'cast3':
      return `${plusVal}% 快速施法速度`
    case 'fhr':
    case 'balance1':
    case 'balance2':
    case 'balance3':
      return `${plusVal}% 快速打击恢复`
    case 'ias':
    case 'swing1':
    case 'swing2':
    case 'swing3':
      return `${plusVal}% 增加攻击速度`
    case 'frw':
    case 'move1':
    case 'move2':
    case 'move3':
      return `${plusVal}% 快速移动/奔跑`
    case 'fbr':
    case 'block1':
    case 'block2':
    case 'block3':
      return `${plusVal}% 快速格挡率`
    case 'block':
      return `${effectiveVal}% 增加格挡几率`

    // --- Leech & Combat ---
    case 'mag%':
      return `${effectiveVal}% 获得魔法装备几率`
    case 'gold%':
      return `${effectiveVal}% 从怪物获得额外金钱`
    case 'lifesteal':
    case 'leech':
      return `每次命中偷取 ${effectiveVal}% 生命`
    case 'manasteal':
      return `每次命中偷取 ${effectiveVal}% 法力`
    case 'crush':
      return `${effectiveVal}% 几率造成压碎打击`
    case 'openwounds':
      return `${effectiveVal}% 几率撕开伤口`
    case 'deadly':
      return `${effectiveVal}% 致命打击`
    case 'dmag':
    case 'red-dmg%':
      return `伤害减少 ${effectiveVal}%`
    case 'dmag-ac':
    case 'red-dmg':
      return `伤害减少 ${effectiveVal}`
    case 'mag-ac':
    case 'red-mag':
      return `魔法伤害减少 ${effectiveVal}`
    case 'dmg-to-mana':
      return `${effectiveVal}% 伤害转化为法力`
    case 'thorns':
      return `攻击者受到伤害 ${effectiveVal}`
    case 'light-thorns':
      return `攻击者受到闪电伤害 ${effectiveVal}`
    case 'mana-kill':
      return `每击杀一个怪物获得 ${plusVal} 法力`
    case 'heal-kill':
    case 'hp-kill':
      return `每击杀一个怪物获得 ${plusVal} 生命`

    // --- Durability, Sockets, Flags ---
    case 'rep-dur': {
      const rate = Number(par) || effectiveVal || 1
      const seconds = Math.floor(100 / rate)
      return seconds <= 1
        ? '每秒恢复 1 点耐久度'
        : `每 ${seconds} 秒恢复 1 点耐久度`
    }
    case 'rep-quant':
      return '自动回复数量'
    case 'ease':
      return `装备需求 ${effectiveVal > 0 ? `+${effectiveVal}` : effectiveVal}%`
    case 'ethereal':
      return '无形 (无法修复)'
    case 'indestruct':
      return '无法破坏'
    case 'sock':
      return `凹槽 (${effectiveVal})`
    case 'stack':
      return '增加堆叠数量'
    case 'dur':
      return `${plusVal} 最大耐久度`
    case 'dur%':
      return `提升最大耐久度 ${effectiveVal}%`
    case 'no-freeze':
    case 'nofreeze':
      return '无法冻结'
    case 'half-freeze':
      return '冻结时间减半'
    case 'noheal':
    case 'no-heal':
      return '防止怪物自愈'
    case 'rip':
      return '消灭的怪物得以安息'
    case 'knock':
      return '击退'
    case 'howl':
      return `击中使怪物逃跑 ${effectiveVal}%`
    case 'stupidity':
    case 'blind':
      return effectiveVal > 1 ? `击中使目标致盲 +${effectiveVal}` : '击中使目标致盲'
    case 'rep-life':
    case 'regen':
      return effectiveVal >= 0 ? `生命恢复 +${effectiveVal}` : `生命流失 ${effectiveVal}`
    case 'regen-mana':
    case 'manaregen':
      return `法力恢复速度 ${effectiveVal}%`
    case 'pierce':
      return effectiveVal > 0 ? `穿刺攻击 (${effectiveVal}%)` : '穿刺攻击'
    case 'ignore-ac':
      return '无视目标防御'
    case 'freeze':
      return effectiveVal > 1 ? `冻结目标 +${effectiveVal}` : '冻结目标'
    case 'slow':
      return `使目标减速 ${effectiveVal}%`
    case 'light':
      return `${plusVal} 光照范围`
    case 'cheap':
      return `降低所有商人价格 ${effectiveVal}%`
    case 'addxp':
      return `${plusVal}% 获得经验值`
    case 'magicarrow':
      return '发射魔法箭'
    case 'explosivearrow':
      return '发射爆炸箭矢或弩箭'
    case 'reanimate': {
      const monId = Number(par)
      const monName = !Number.isNaN(monId) && CANONICAL_REANIMATE_MONSTERS_ZH[monId]
        ? CANONICAL_REANIMATE_MONSTERS_ZH[monId]
        : (par || '复生者')
      return `${effectiveVal}% 几率唤醒为: ${monName}`
    }
    case 'bloody':
      return '额外鲜血'
    case 'fade':
      return '渐隐'
    case 'state':
      return String(par).toLowerCase() === 'monsterset' ? '变身吸血鬼' : '显示灵气'

    // --- Attack Rating & Elemental Damage ---
    case 'att':
      return `${plusVal} 准确率`
    case 'att%':
      return `${effectiveVal}% 准确率加成`
    case 'dmg-fire':
      return min > 0 && max > min ? `增加 ${min}-${max} 火焰伤害` : `增加 ${effectiveVal} 火焰伤害`
    case 'fire-min':
      return `${plusVal} 最小火焰伤害`
    case 'fire-max':
      return `${plusVal} 最大火焰伤害`
    case 'dmg-cold':
      return min > 0 && max > min ? `增加 ${min}-${max} 冰冻伤害` : `增加 ${effectiveVal} 冰冻伤害`
    case 'cold-min':
      return `${plusVal} 最小冰冻伤害`
    case 'cold-max':
      return `${plusVal} 最大冰冻伤害`
    case 'cold-len':
      return `冰冻持续时间: ${Math.max(1, Math.round(effectiveVal / 25))} 秒`
    case 'dmg-ltng':
      return min > 0 && max > min ? `增加 ${min}-${max} 闪电伤害` : `增加 ${effectiveVal} 闪电伤害`
    case 'ltng-min':
      return `${plusVal} 最小闪电伤害`
    case 'ltng-max':
      return `${plusVal} 最大闪电伤害`
    case 'dmg-pois':
      return `在 ${Math.round(Number(par || max) / 25) || 3} 秒内造成 ${min || effectiveVal} 点毒素伤害`
    case 'pois-min':
      return `${plusVal} 最小毒素伤害`
    case 'pois-max':
      return `${plusVal} 最大毒素伤害`
    case 'pois-len':
      return `毒素持续时间: ${Math.max(1, Math.round(effectiveVal / 25))} 秒`
    case 'dmg-mag':
      return min > 0 && max > min ? `增加 ${min}-${max} 魔法伤害` : `增加 ${effectiveVal} 魔法伤害`
    case 'dmg-elem':
      return min > 0 && max > min ? `增加 ${min}-${max} 元素伤害` : `增加 ${effectiveVal} 元素伤害`
    default:
      return `${code}: ${plusVal}${par ? ` (${par})` : ''}`
  }
}

function formatPropertyCodeEn(
  code: string,
  _value: number,
  min: number,
  max: number,
  par: string | number | undefined,
  effectiveVal: number,
  plusVal: string,
  charLevel = 1,
): string {
  switch (code.trim().toLowerCase().replace(/^\*/, '')) {
    case 'allskills': return `${plusVal} to All Skills`
    case 'ama': return `${plusVal} to Amazon Skill Levels`
    case 'sor': return `${plusVal} to Sorceress Skill Levels`
    case 'nec': return `${plusVal} to Necromancer Skill Levels`
    case 'pal': return `${plusVal} to Paladin Skill Levels`
    case 'bar': return `${plusVal} to Barbarian Skill Levels`
    case 'dru': return `${plusVal} to Druid Skills`
    case 'ass': return `${plusVal} to Assassin Skills`
    case 'randclassskill': return `+${effectiveVal || 3} to Random Class Skill Levels`
    case 'classskills': return `${plusVal} to ${par ? `${par} ` : ''}Skill Levels`
    case 'fireskill': return `${plusVal} to Fire Skills`
    case 'skilltab': {
      const tabId = Number(par)
      if (!Number.isNaN(tabId) && CANONICAL_SKILL_TABS[tabId]) {
        return `${plusVal} to ${CANONICAL_SKILL_TABS[tabId]}`
      }
      return `${plusVal} to ${par ?? 'Skill Tab'}`
    }
    case 'skill': {
      const sk = resolveSkillInfo(par)
      return `${plusVal} to ${sk.name}${sk.classOnly ? ` ${sk.classOnly}` : ''}`
    }
    case 'skill-rand': {
      const slvl = Number(par) || effectiveVal || 3
      const sk = resolveSkillInfo(min)
      return `+${slvl} to ${sk.name}${sk.classOnly ? ` ${sk.classOnly}` : ' (Sorceress Only)'}`
    }
    case 'oskill': {
      const sk = resolveSkillInfo(par)
      return `${plusVal} to ${sk.name}`
    }
    case 'aura': {
      const sk = resolveSkillInfo(par)
      return `Level ${effectiveVal} ${sk.name} Aura When Equipped`
    }
    case 'hit-skill': {
      const sk = resolveSkillInfo(par)
      return `${min || effectiveVal || 5}% Chance to cast level ${max || 1} ${sk.name} on striking`
    }
    case 'att-skill': {
      const sk = resolveSkillInfo(par)
      return `${min || effectiveVal || 5}% Chance to cast level ${max || 1} ${sk.name} on attack`
    }
    case 'gethit-skill': {
      const sk = resolveSkillInfo(par)
      return `${min || effectiveVal || 5}% Chance to cast level ${max || 1} ${sk.name} when struck`
    }
    case 'kill-skill': {
      const sk = resolveSkillInfo(par)
      return `${min || effectiveVal || 5}% Chance to cast level ${max || 1} ${sk.name} when you Kill an Enemy`
    }
    case 'death-skill': {
      const sk = resolveSkillInfo(par)
      return `${min || effectiveVal || 100}% Chance to cast level ${max || 1} ${sk.name} when you Die`
    }
    case 'levelup-skill': {
      const sk = resolveSkillInfo(par)
      return `${min || effectiveVal || 100}% Chance to cast level ${max || 1} ${sk.name} when you Level-Up`
    }
    case 'charged': {
      const sk = resolveSkillInfo(par)
      const c = Math.abs(min || effectiveVal || 10)
      const l = Math.abs(max || 1)
      return `Level ${l} ${sk.name} (${c}/${c} Charges)`
    }
    case 'str': return `${plusVal} to Strength`
    case 'dex': return `${plusVal} to Dexterity`
    case 'vit': return `${plusVal} to Vitality`
    case 'enr': return `${plusVal} to Energy`
    case 'all-stats': return `${plusVal} to All Attributes`
    case 'hp': return `${plusVal} to Life`
    case 'hp%': return `Increase Maximum Life ${effectiveVal}%`
    case 'mana': return `${plusVal} to Mana`
    case 'mana%': return `Increase Maximum Mana ${effectiveVal}%`
    case 'stam': return `${plusVal} Maximum Stamina`
    case 'regen-stam': return `Heal Stamina Plus ${effectiveVal}%`
    case 'stamdrain': return `${effectiveVal}% Slower Stamina Drain`
    case 'hp/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel, true)} to Life (Based on Character Level)`
    case 'mana/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel, true)} to Mana (Based on Character Level)`
    case 'stam/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel)} Maximum Stamina (Based on Character Level)`
    case 'regen-stam/lvl': return `Heal Stamina Plus +${formatPerLevelVal(effectiveVal, charLevel)}% (Based on Character Level)`
    case 'str/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel)} to Strength (Based on Character Level)`
    case 'dex/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel)} to Dexterity (Based on Character Level)`
    case 'vit/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel)} to Vitality (Based on Character Level)`
    case 'enr/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel)} to Energy (Based on Character Level)`
    case 'ac/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel)} Defense (Based on Character Level)`
    case 'ac%/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel)}% Enhanced Defense (Based on Character Level)`
    case 'dmg/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel)} to Maximum Damage (Based on Character Level)`
    case 'dmg%/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel)}% Enhanced Maximum Damage (Based on Character Level)`
    case 'att/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel)} to Attack Rating (Based on Character Level)`
    case 'att%/lvl': return `${formatPerLevelVal(effectiveVal, charLevel)}% Bonus to Attack Rating (Based on Character Level)`
    case 'dmg-cold/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel)} to Maximum Cold Damage (Based on Character Level)`
    case 'dmg-fire/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel)} to Maximum Fire Damage (Based on Character Level)`
    case 'dmg-ltng/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel)} to Maximum Lightning Damage (Based on Character Level)`
    case 'dmg-pois/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel)} to Maximum Poison Damage (Based on Character Level)`
    case 'dmg-dem/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel)}% Damage to Demons (Based on Character Level)`
    case 'dmg-und/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel)}% Damage to Undead (Based on Character Level)`
    case 'att-dem/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel)} to Attack Rating against Demons (Based on Character Level)`
    case 'att-und/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel)} to Attack Rating against Undead (Based on Character Level)`
    case 'deadly/lvl': return `${formatPerLevelVal(effectiveVal, charLevel)}% Deadly Strike (Based on Character Level)`
    case 'crush/lvl': return `${formatPerLevelVal(effectiveVal, charLevel)}% Chance of Crushing Blow (Based on Character Level)`
    case 'wounds/lvl': return `${formatPerLevelVal(effectiveVal, charLevel)}% Chance of Open Wounds (Based on Character Level)`
    case 'kick/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel)} Kick Damage (Based on Character Level)`
    case 'thorns/lvl': return `Attacker Takes Damage of ${formatPerLevelVal(effectiveVal, charLevel)} (Based on Character Level)`
    case 'mag%/lvl': return `${formatPerLevelVal(effectiveVal, charLevel)}% Better Chance of Getting Magic Items (Based on Character Level)`
    case 'gold%/lvl': return `${formatPerLevelVal(effectiveVal, charLevel)}% Extra Gold from Monsters (Based on Character Level)`
    case 'res-cold/lvl': return `Cold Resist +${formatPerLevelVal(effectiveVal, charLevel)}% (Based on Character Level)`
    case 'res-fire/lvl': return `Fire Resist +${formatPerLevelVal(effectiveVal, charLevel)}% (Based on Character Level)`
    case 'res-ltng/lvl': return `Lightning Resist +${formatPerLevelVal(effectiveVal, charLevel)}% (Based on Character Level)`
    case 'res-pois/lvl': return `Poison Resist +${formatPerLevelVal(effectiveVal, charLevel)}% (Based on Character Level)`
    case 'abs-cold/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel)} Absorbs Cold Damage (Based on Character Level)`
    case 'abs-fire/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel)} Absorbs Fire Damage (Based on Character Level)`
    case 'abs-ltng/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel)} Absorbs Lightning Damage (Based on Character Level)`
    case 'abs-pois/lvl': return `+${formatPerLevelVal(effectiveVal, charLevel)} Absorbs Poison Damage (Based on Character Level)`
    case 'ac/time': return `${plusVal} Defense (Increases During Nighttime)`
    case 'ac': return `${plusVal} Defense`
    case 'ac%': return `${plusVal}% Enhanced Defense`
    case 'ac-miss': return `${plusVal} Defense vs. Missile`
    case 'ac-hth': return `${plusVal} Defense vs. Melee`
    case 'dmg%': return `${plusVal}% Enhanced Damage`
    case 'dmg': return `Damage ${plusVal}`
    case 'dmg-min': return `${plusVal} to Minimum Damage`
    case 'dmg-max': return `${plusVal} to Maximum Damage`
    case 'dmg-norm': return min > 0 && max > min ? `Adds ${min}-${max} Damage` : `${plusVal} to Minimum Damage`
    case 'dmg-ac': return `${plusVal} to Monster Defense Per Hit`
    case 'reduce-ac': return `-${Math.abs(effectiveVal)}% Target Defense`
    case 'dmg-demon': return `${plusVal}% Damage to Demons`
    case 'dmg-undead': return `${plusVal}% Damage to Undead`
    case 'att-demon': return `${plusVal} to Attack Rating against Demons`
    case 'att-undead': return `${plusVal} to Attack Rating against Undead`
    case 'demon-heal': return `${plusVal} Life after each Demon Kill`
    case 'res-all': return `All Resistances ${plusVal}`
    case 'res-all-max': return `${plusVal}% to Maximum All Resistances`
    case 'res-fire': case 'fireresist': return `Fire Resist ${plusVal}%`
    case 'res-fire-max': return `${plusVal}% to Maximum Fire Resist`
    case 'res-cold': case 'coldresist': return `Cold Resist ${plusVal}%`
    case 'res-cold-max': return `${plusVal}% to Maximum Cold Resist`
    case 'res-ltng': case 'lightresist': return `Lightning Resist ${plusVal}%`
    case 'res-ltng-max': return `${plusVal}% to Maximum Lightning Resist`
    case 'res-pois': case 'poisonresist': return `Poison Resist ${plusVal}%`
    case 'res-pois-max': return `${plusVal}% to Maximum Poison Resist`
    case 'res-pois-len': return `Poison Length Reduced by ${Math.abs(effectiveVal)}%`
    case 'extra-fire': return `${plusVal}% to Fire Skill Damage`
    case 'extra-cold': return `${plusVal}% to Cold Skill Damage`
    case 'extra-ltng': return `${plusVal}% to Lightning Skill Damage`
    case 'extra-pois': return `${plusVal}% to Poison Skill Damage`
    case 'pierce-fire': return `-${Math.abs(effectiveVal)}% to Enemy Fire Resistance`
    case 'pierce-cold': return `-${Math.abs(effectiveVal)}% to Enemy Cold Resistance`
    case 'pierce-ltng': return `-${Math.abs(effectiveVal)}% to Enemy Lightning Resistance`
    case 'pierce-pois': return `-${Math.abs(effectiveVal)}% to Enemy Poison Resistance`
    case 'abs-fire': return `${plusVal} Fire Absorb`
    case 'abs-fire%': return `Fire Absorb ${effectiveVal}%`
    case 'abs-cold': return `${plusVal} Cold Absorb`
    case 'abs-cold%': return `Cold Absorb ${effectiveVal}%`
    case 'abs-ltng': return `${plusVal} Lightning Absorb`
    case 'abs-ltng%': return `Lightning Absorb ${effectiveVal}%`
    case 'abs-mag': return `${plusVal} Magic Absorb`
    case 'abs-pois': return `${plusVal} Poison Absorb`
    case 'fcr': case 'cast1': case 'cast2': case 'cast3': return `${plusVal}% Faster Cast Rate`
    case 'fhr': case 'balance1': case 'balance2': case 'balance3': return `${plusVal}% Faster Hit Recovery`
    case 'ias': case 'swing1': case 'swing2': case 'swing3': return `${plusVal}% Increased Attack Speed`
    case 'frw': case 'move1': case 'move2': case 'move3': return `${plusVal}% Faster Run/Walk`
    case 'fbr': case 'block1': case 'block2': case 'block3': return `${plusVal}% Faster Block Rate`
    case 'block': return `${effectiveVal}% Increased Chance of Blocking`
    case 'mag%': return `${effectiveVal}% Better Chance of Getting Magic Items`
    case 'gold%': return `${effectiveVal}% Extra Gold from Monsters`
    case 'lifesteal': case 'leech': return `${effectiveVal}% Life stolen per hit`
    case 'manasteal': return `${effectiveVal}% Mana stolen per hit`
    case 'crush': return `${effectiveVal}% Chance of Crushing Blow`
    case 'openwounds': return `${effectiveVal}% Chance of Open Wounds`
    case 'deadly': return `${effectiveVal}% Deadly Strike`
    case 'dmag': case 'red-dmg%': return `Damage Reduced by ${effectiveVal}%`
    case 'dmag-ac': case 'red-dmg': return `Damage Reduced by ${effectiveVal}`
    case 'mag-ac': case 'red-mag': return `Magic Damage Reduced by ${effectiveVal}`
    case 'dmg-to-mana': return `${effectiveVal}% Damage Taken Goes To Mana`
    case 'thorns': return `Attacker Takes Damage of ${effectiveVal}`
    case 'light-thorns': return `Attacker Takes Lightning Damage of ${effectiveVal}`
    case 'mana-kill': return `${plusVal} to Mana after each Kill`
    case 'heal-kill': case 'hp-kill': return `${plusVal} Life after each Kill`
    case 'rep-dur': {
      const rate = Number(par) || effectiveVal || 1
      const seconds = Math.floor(100 / rate)
      return seconds <= 1 ? 'Repairs 1 durability per second' : `Repairs 1 durability in ${seconds} seconds`
    }
    case 'rep-quant': return 'Replenishes quantity'
    case 'ease': return `Requirements ${effectiveVal > 0 ? `+${effectiveVal}` : effectiveVal}%`
    case 'ethereal': return 'Ethereal (Cannot be Repaired)'
    case 'indestruct': return 'Indestructible'
    case 'sock': return `Socketed (${effectiveVal})`
    case 'stack': return 'Increased Stack Size'
    case 'dur': return `${plusVal} Maximum Durability`
    case 'dur%': return `Increase Maximum Durability ${effectiveVal}%`
    case 'no-freeze': case 'nofreeze': return 'Cannot Be Frozen'
    case 'half-freeze': return 'Half Freeze Duration'
    case 'noheal': case 'no-heal': return 'Prevent Monster Heal'
    case 'rip': return 'Slain Monsters Rest in Peace'
    case 'knock': return 'Knockback'
    case 'howl': return `Hit Causes Monster to Flee ${effectiveVal}%`
    case 'stupidity': case 'blind': return effectiveVal > 1 ? `Hit Blinds Target +${effectiveVal}` : 'Hit Blinds Target'
    case 'rep-life': case 'regen': return effectiveVal >= 0 ? `Replenish Life +${effectiveVal}` : `Drain Life ${effectiveVal}`
    case 'regen-mana': case 'manaregen': return `Regenerate Mana ${effectiveVal}%`
    case 'pierce': return effectiveVal > 0 ? `Piercing Attack (${effectiveVal}%)` : 'Piercing Attack'
    case 'ignore-ac': return "Ignore Target's Defense"
    case 'freeze': return effectiveVal > 1 ? `Freezes target +${effectiveVal}` : 'Freezes target'
    case 'slow': return `Slows Target by ${effectiveVal}%`
    case 'light': return `${plusVal} to Light Radius`
    case 'cheap': return `Reduces all Vendor Prices ${effectiveVal}%`
    case 'addxp': return `${plusVal}% to Experience Gained`
    case 'magicarrow': return 'Fires Magic Arrows'
    case 'explosivearrow': return 'Fires Explosive Arrows or Bolts'
    case 'reanimate': {
      const monId = Number(par)
      const monName = !Number.isNaN(monId) && CANONICAL_REANIMATE_MONSTERS[monId]
        ? CANONICAL_REANIMATE_MONSTERS[monId]
        : (par || 'Returned')
      return `${effectiveVal}% Reanimate as: ${monName}`
    }
    case 'bloody': return 'Extra Blood'
    case 'fade': return 'Fade'
    case 'state': return String(par).toLowerCase() === 'monsterset' ? 'Transforms into Vampire' : 'Display Aura'
    case 'att': return `${plusVal} to Attack Rating`
    case 'att%': return `${effectiveVal}% Bonus to Attack Rating`
    case 'dmg-fire': return min > 0 && max > min ? `Adds ${min}-${max} Fire Damage` : `Adds ${effectiveVal} Fire Damage`
    case 'fire-min': return `${plusVal} to Minimum Fire Damage`
    case 'fire-max': return `${plusVal} to Maximum Fire Damage`
    case 'dmg-cold': return min > 0 && max > min ? `Adds ${min}-${max} Cold Damage` : `Adds ${effectiveVal} Cold Damage`
    case 'cold-min': return `${plusVal} to Minimum Cold Damage`
    case 'cold-max': return `${plusVal} to Maximum Cold Damage`
    case 'cold-len': return `Cold Duration: ${Math.max(1, Math.round(effectiveVal / 25))} Seconds`
    case 'dmg-ltng': return min > 0 && max > min ? `Adds ${min}-${max} Lightning Damage` : `Adds ${effectiveVal} Lightning Damage`
    case 'ltng-min': return `${plusVal} to Minimum Lightning Damage`
    case 'ltng-max': return `${plusVal} to Maximum Lightning Damage`
    case 'dmg-pois': return `+${min || effectiveVal} Poison Damage Over ${Math.round(Number(par || max) / 25) || 3} Seconds`
    case 'pois-min': return `${plusVal} to Minimum Poison Damage`
    case 'pois-max': return `${plusVal} to Maximum Poison Damage`
    case 'pois-len': return `Poison Duration: ${Math.max(1, Math.round(effectiveVal / 25))} Seconds`
    case 'dmg-mag': return min > 0 && max > min ? `Adds ${min}-${max} Magic Damage` : `Adds ${effectiveVal} Magic Damage`
    case 'dmg-elem': return min > 0 && max > min ? `Adds ${min}-${max} Elemental Damage` : `Adds ${effectiveVal} Elemental Damage`
    default: return `${code}: ${plusVal}${par ? ` (${par})` : ''}`
  }
}
