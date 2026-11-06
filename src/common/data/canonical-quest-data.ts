/**
 * Canonical Diablo II v1.13c Quest Data.
 * Ground-truth strings extracted directly from Blizzard's string.tbl,
 * expansionstring.tbl, and patchstring.tbl.
 */

export interface CanonicalQuestStage {
  readonly key: string
  readonly stage: number
  readonly textEn: string
  readonly textZh: string
}

export interface CanonicalQuestItem {
  readonly id: string
  readonly act: number
  readonly index: number
  readonly b1: number
  readonly iconKey: string
  readonly titleKey: string
  readonly titleEn: string
  readonly titleZh: string
  readonly objectiveKey: string
  readonly objectiveEn: string
  readonly objectiveZh: string
  readonly completedKey: string
  readonly completedEn: string
  readonly completedZh: string
  readonly rewardSummaryEn: string
  readonly rewardSummaryZh: string
  readonly stages: readonly CanonicalQuestStage[]
}

export const CANONICAL_QUEST_DATA: readonly CanonicalQuestItem[] = [
  {
    "id": "a1q1",
    "act": 1,
    "index": 0,
    "b1": 0,
    "iconKey": "a1q1",
    "titleKey": "qstsa1q1",
    "titleEn": "Den of Evil",
    "titleZh": "邪惡洞穴",
    "objectiveKey": "qstsa1q11",
    "objectiveEn": "Look for the Den in the wilderness outside the Rogues' Camp.",
    "objectiveZh": "在蘿格營地外面的荒野中，找尋一個洞穴。",
    "completedKey": "A1Q1SuccessfulAkara",
    "completedEn": "You have cleansed the Den of Evil. You've earned my trust and may yet restore my faith in humanity. Your reward is training in the skill of your choice.",
    "completedZh": "你已經清除了洞窟中的邪惡，也贏得了我 的信任，並回復了我對人類的信心。 你的報酬是自行選擇一項全新的技能。",
    "rewardSummaryEn": "+1 Skill Point, Stat/Skill Reset",
    "rewardSummaryZh": "+1 技能点，重置技能属性",
    "stages": [
      {
        "key": "qstsa1q11",
        "stage": 1,
        "textEn": "Look for the Den in the wilderness outside the Rogues' Camp.",
        "textZh": "在蘿格營地外面的荒野中，找尋一個洞穴。"
      },
      {
        "key": "qstsa1q12",
        "stage": 2,
        "textEn": "Kill all the monsters in the Den.",
        "textZh": "殺死所有盤踞在洞穴中的怪物。"
      },
      {
        "key": "qstsa1q15",
        "stage": 3,
        "textEn": "Return to Akara for a reward.",
        "textZh": "回去找阿卡拉領賞。"
      }
    ]
  },
  {
    "id": "a1q2",
    "act": 1,
    "index": 1,
    "b1": 1,
    "iconKey": "a1q2",
    "titleKey": "qstsa1q2",
    "titleEn": "Sisters' Burial Grounds",
    "titleZh": "修女埋骨之地",
    "objectiveKey": "qstsa1q21",
    "objectiveEn": "Look for Blood Raven in the Burial Grounds next to the Cold Plains.",
    "objectiveZh": "到冰冷之原旁邊的埋骨之所，找尋血鳥的蹤跡。",
    "completedKey": "A1Q2SuccessfulKashya",
    "completedEn": "I can hardly believe that you've defeated Blood Raven! Though she was once my closest friend, I pray that her tortured spirit remains banished forever. You have earned my respect, stranger... and the allegiance of the Rogues. I have placed several of my best warriors at your disposal.",
    "completedZh": "我幾乎不敢相信你殺死了血鳥！ 雖然她曾經是我最親密的朋友，我仍然祈 禱她飽受刑罰的靈魂被永遠的放逐。 你贏得了我的尊敬，冒險者...而且也得到所 有蘿格的忠誠。我已經把好幾位最好的戰 士派來供你驅策。",
    "rewardSummaryEn": "Rogue Mercenary hireling",
    "rewardSummaryZh": "罗格雇佣兵",
    "stages": [
      {
        "key": "qstsa1q21",
        "stage": 1,
        "textEn": "Look for Blood Raven in the Burial Grounds next to the Cold Plains.",
        "textZh": "到冰冷之原旁邊的埋骨之所，找尋血鳥的蹤跡。"
      },
      {
        "key": "qstsa1q22",
        "stage": 2,
        "textEn": "Kill Blood Raven.",
        "textZh": "殺了血鳥。"
      },
      {
        "key": "qstsa1q23",
        "stage": 3,
        "textEn": "Return to Kashya for a reward.",
        "textZh": "回去找卡夏領賞。"
      }
    ]
  },
  {
    "id": "a1q3",
    "act": 1,
    "index": 2,
    "b1": 3,
    "iconKey": "a1q4",
    "titleKey": "qstsa1q4",
    "titleEn": "The Search for Cain",
    "titleZh": "凱恩的搜尋",
    "objectiveKey": "qstsa1q41",
    "objectiveEn": "Go through the Underground Passage to the Dark Wood, search for the Tree of Inifuss, and recover the Scroll.",
    "objectiveZh": "穿過地底通道來到黑暗森林，找到艾尼弗斯之樹，並取回卷軸。",
    "completedKey": "A1Q4QuestSuccessfulWarriv",
    "completedEn": "Only a brave adventurer could return with Deckard Cain. Akara has a reward for your valor.",
    "completedZh": "只有最勇敢的冒險者能夠帶回迪卡．凱恩。 阿卡拉將因為你的英武而好好的獎勵你。",
    "rewardSummaryEn": "Free item identification by Cain, Magic Ring",
    "rewardSummaryZh": "凯恩免费辨识物品，魔法戒指",
    "stages": [
      {
        "key": "qstsa1q41",
        "stage": 1,
        "textEn": "Go through the Underground Passage to the Dark Wood, search for the Tree of Inifuss, and recover the Scroll.",
        "textZh": "穿過地底通道來到黑暗森林，找到艾尼弗斯之樹，並取回卷軸。"
      },
      {
        "key": "qstsa1q42",
        "stage": 2,
        "textEn": "Take the Scroll of Inifuss to Akara.",
        "textZh": "拿著艾尼弗斯的卷軸去找阿卡拉。"
      },
      {
        "key": "qstsa1q43",
        "stage": 3,
        "textEn": "Go to the Cairn Stones in the Stony Field. Touch the Stones in the order found on the Scroll of Inifuss. Enter the portal to Tristram, but beware the danger that lies ahead.",
        "textZh": "前往石塊曠野中的石塚，利用我寫在艾尼弗斯卷軸上面的順序觸碰石塊，然後進入傳送點前往崔斯特瑞姆。但是你們要小心面前的危險。"
      },
      {
        "key": "qstsa1q44",
        "stage": 4,
        "textEn": "Find and rescue Deckard Cain.",
        "textZh": "找到並救出迪卡．凱恩。"
      },
      {
        "key": "qstsa1q46b",
        "stage": 5,
        "textEn": "Talk to Akara for a reward.",
        "textZh": "去和阿卡拉談談並領賞。"
      }
    ]
  },
  {
    "id": "a1q4",
    "act": 1,
    "index": 3,
    "b1": 4,
    "iconKey": "a1q5",
    "titleKey": "qstsa1q5",
    "titleEn": "The Forgotten Tower",
    "titleZh": "遺忘之塔",
    "objectiveKey": "qstsa1q51",
    "objectiveEn": "Look for the Tower in the Black Marsh beyond the Dark Wood.",
    "objectiveZh": "在黑暗森林遠方的黑色荒地中，可以找到一個高塔。",
    "completedKey": "A1Q5SuccessfulKashya",
    "completedEn": "Your rewards are well-earned. To us, the tower was nothing more than a headstone looming over a long forgotten grave.",
    "completedZh": "你的獎賞十分豐富，對我們而言，這個高 塔不過是隱約出現在這個長久以來，被遺 忘墓場的巨大墓碑罷了。",
    "rewardSummaryEn": "Countess treasure cache and runes",
    "rewardSummaryZh": "女伯爵宝藏与符文",
    "stages": [
      {
        "key": "qstsa1q51",
        "stage": 1,
        "textEn": "Look for the Tower in the Black Marsh beyond the Dark Wood.",
        "textZh": "在黑暗森林遠方的黑色荒地中，可以找到一個高塔。"
      },
      {
        "key": "qstsa1q51a",
        "stage": 2,
        "textEn": "Explore the cellar dungeons beneath the Tower ruins.",
        "textZh": "探索高塔廢墟下面的地窖牢房。"
      },
      {
        "key": "qstsa1q52",
        "stage": 3,
        "textEn": "Dispose of the evil Countess.",
        "textZh": "打倒裡面的邪惡女伯爵。"
      }
    ]
  },
  {
    "id": "a1q5",
    "act": 1,
    "index": 4,
    "b1": 2,
    "iconKey": "a1q3",
    "titleKey": "qstsa1q3",
    "titleEn": "Tools of the Trade",
    "titleZh": "交易的工具",
    "objectiveKey": "qstsa1q31",
    "objectiveEn": "Look for the Horadric Malus in the Monastery Barracks. Beware of the Smith that guards it.",
    "objectiveZh": "在僧院的軍營中找尋赫拉迪克.馬勒斯。小心有個鐵匠在看守著它。",
    "completedKey": "A1Q3SuccessfulCharsi",
    "completedEn": "Oh! Thanks so much for returning the Horadric Malus! I will now imbue one of your items with magical powers.",
    "completedZh": "噢！你能把赫拉迪克．馬勒斯送回來實在 太棒了！我現在就可以把你的一項物品灌 入魔法的力量。",
    "rewardSummaryEn": "Item Imbue by Charsi",
    "rewardSummaryZh": "恰西铁匠注入魔法力量（灌魔）",
    "stages": [
      {
        "key": "qstsa1q31",
        "stage": 1,
        "textEn": "Look for the Horadric Malus in the Monastery Barracks. Beware of the Smith that guards it.",
        "textZh": "在僧院的軍營中找尋赫拉迪克.馬勒斯。小心有個鐵匠在看守著它。"
      },
      {
        "key": "qstsa1q32",
        "stage": 2,
        "textEn": "Return the Horadric Malus to Charsi.",
        "textZh": "把赫拉迪克.馬勒斯送回恰西的手中。"
      },
      {
        "key": "qstsa1q32b",
        "stage": 3,
        "textEn": "Charsi will imbue an item with magical power.",
        "textZh": "恰西會把你的一項物品灌入魔法力量。"
      }
    ]
  },
  {
    "id": "a1q6",
    "act": 1,
    "index": 5,
    "b1": 5,
    "iconKey": "a1q6",
    "titleKey": "qstsa1q6",
    "titleEn": "Sisters to the Slaughter",
    "titleZh": "屠殺的修女",
    "objectiveKey": "qstsa1q61",
    "objectiveEn": "Find Andariel's Lair in the depths of the Monastery Catacombs.",
    "objectiveZh": "在僧院的地下墓穴中，找到安達利爾的老巢。",
    "completedKey": "A1Q6SuccessfulWarriv",
    "completedEn": "The caravan is prepared. We may now journey eastward to Lut Gholein.",
    "completedZh": "商隊己經準備好了，我們可以前往東方的 魯．高因了。",
    "rewardSummaryEn": "Access to Act II (Lut Gholein)",
    "rewardSummaryZh": "开启前往第二幕（鲁·高因）的通道",
    "stages": [
      {
        "key": "qstsa1q61",
        "stage": 1,
        "textEn": "Find Andariel's Lair in the depths of the Monastery Catacombs.",
        "textZh": "在僧院的地下墓穴中，找到安達利爾的老巢。"
      },
      {
        "key": "qstsa1q62",
        "stage": 2,
        "textEn": "Kill Andariel.",
        "textZh": "殺了安達利爾。"
      },
      {
        "key": "qstsa1q62b",
        "stage": 3,
        "textEn": "Return to Warriv to take the Caravan East.",
        "textZh": "回去找瓦瑞夫，你可以和他一塊帶領商隊往東走。"
      }
    ]
  },
  {
    "id": "a2q1",
    "act": 2,
    "index": 0,
    "b1": 6,
    "iconKey": "a2q1",
    "titleKey": "qstsa2q1",
    "titleEn": "Radament's Lair",
    "titleZh": "羅達門特的巢穴",
    "objectiveKey": "qstsa2q11",
    "objectiveEn": "Find Radament's Lair in the Lut Gholein sewers.",
    "objectiveZh": "在魯.高因的下水道中，找到羅達門特的巢穴。",
    "completedKey": "A2Q1SuccessfulAtma",
    "completedEn": "They say that the taste of vengeance is bittersweet, but I find it to my liking. In addition to my undying gratitude, I have spoken on your behalf with the rest of the townspeople. The merchants have agreed to show their gratitude by offering their wares and services at lower rates. Oh... Jerhyn wants to see you, too. You'll find him in front of the palace.",
    "completedZh": "他們說復仇的味道嚐起來苦樂參半，但是 我覺得我還蠻喜歡的。 除了我永久的感謝之外，我已經把你的義 行告訴其他的鎮民。商人們都同意表達他 們的感謝，讓你以最低的折扣購買他們的 貨物。 噢...杰海因也想要見見你。你可以在皇宮的 前面找到他。",
    "rewardSummaryEn": "Book of Skill (+1 Skill Point), 10% Merchant Discount",
    "rewardSummaryZh": "技能之书（+1 技能点），商店价格九折优惠",
    "stages": [
      {
        "key": "qstsa2q11",
        "stage": 1,
        "textEn": "Find Radament's Lair in the Lut Gholein sewers.",
        "textZh": "在魯.高因的下水道中，找到羅達門特的巢穴。"
      },
      {
        "key": "qstsa2q12",
        "stage": 2,
        "textEn": "Kill Radament.",
        "textZh": "殺了羅達門特。"
      },
      {
        "key": "qstsa2q13",
        "stage": 3,
        "textEn": "Return to Atma for a reward.",
        "textZh": "回去找亞特瑪領取獎賞。"
      }
    ]
  },
  {
    "id": "a2q2",
    "act": 2,
    "index": 1,
    "b1": 7,
    "iconKey": "a2q2",
    "titleKey": "qstsa2q2",
    "titleEn": "The Horadric Staff",
    "titleZh": "赫拉迪克之杖",
    "objectiveKey": "qstsa2q22",
    "objectiveEn": "Search the Halls of the Dead under the Dry Hills for the Cube. Search the Maggot Lair under the Far Oasis for the Shaft. Search the Claw Viper Temple for the Headpiece.",
    "objectiveZh": "在乾燥的高地下面的死亡之殿中，好好找尋那個方塊。在遙遠的綠洲下面可以找到蛆蟲巢穴，裡面有木製的手柄。到利爪腹蛇神殿，可以找到金屬的花紋。",
    "completedKey": "A2Q2SuccessfulStaffCain",
    "completedEn": "Excellent! You have a Horadric Staff. Carry it with you into Tal Rasha's Tomb. Find within the Tomb the chamber whose floor is inset with the Circle of Seven Symbols. Place the Staff into the receptacle you find there. That will open the secret passage into Tal Rasha's Burial Chamber.",
    "completedZh": "赫拉迪克之杖已经由方块合成复原，可以用它开启塔·拉夏古墓中封印督瑞尔的密室大门。",
    "rewardSummaryEn": "Horadric Cube and Horadric Staff",
    "rewardSummaryZh": "赫拉迪克方块与合成赫拉迪克之杖",
    "stages": [
      {
        "key": "qstsa2q21",
        "stage": 1,
        "textEn": "Show the scroll to Cain in Lut Gholein.",
        "textZh": "把這個卷軸給魯.高因的凱恩看看。"
      },
      {
        "key": "qstsa2q22",
        "stage": 2,
        "textEn": "Search the Halls of the Dead under the Dry Hills for the Cube. Search the Maggot Lair under the Far Oasis for the Shaft. Search the Claw Viper Temple for the Headpiece.",
        "textZh": "在乾燥的高地下面的死亡之殿中，好好找尋那個方塊。在遙遠的綠洲下面可以找到蛆蟲巢穴，裡面有木製的手柄。到利爪腹蛇神殿，可以找到金屬的花紋。"
      },
      {
        "key": "qstsa2q23",
        "stage": 3,
        "textEn": "Use the Horadric Cube to restore the Staff.",
        "textZh": "利用赫拉迪克的方塊把法杖回復原狀。"
      },
      {
        "key": "qstsa2q24",
        "stage": 4,
        "textEn": "Take the Staff into Tal Rasha's Tomb.",
        "textZh": "拿著法杖進入塔.拉夏的古墓。"
      }
    ]
  },
  {
    "id": "a2q3",
    "act": 2,
    "index": 2,
    "b1": 8,
    "iconKey": "a2q3",
    "titleKey": "qstsa2q3",
    "titleEn": "Tainted Sun",
    "titleZh": "墮落的太陽",
    "objectiveKey": "qstsa2q32",
    "objectiveEn": "Destroy the Serpent Altar in the Claw Viper Temple beneath the Valley of Snakes.",
    "objectiveZh": "摧毀位於利爪腹蛇神殿的蛇形祭壇，它位於群蛇峽谷的下面。",
    "completedKey": "A2Q3SuccessfulDrognan",
    "completedEn": "You did well in destroying the Claw Vipers. We are all glad to see the sun returned to its former glory.",
    "completedZh": "你毀滅利爪腹蛇實在做得漂亮，我們都很 高興看到太陽回復原有的光輝。",
    "rewardSummaryEn": "Restores sunlight to Lut Gholein, Viper Amulet",
    "rewardSummaryZh": "恢复鲁·高因的光明，蝮蛇护符",
    "stages": [
      {
        "key": "qstsa2q31",
        "stage": 1,
        "textEn": "Look for the source of the darkness.",
        "textZh": "找尋黑暗之源。"
      },
      {
        "key": "qstsa2q31a",
        "stage": 2,
        "textEn": "Ask Drognan about the strange darkness.",
        "textZh": "問問卓格南對這片奇怪的黑暗有什麼看法。"
      },
      {
        "key": "qstsa2q32",
        "stage": 3,
        "textEn": "Destroy the Serpent Altar in the Claw Viper Temple beneath the Valley of Snakes.",
        "textZh": "摧毀位於利爪腹蛇神殿的蛇形祭壇，它位於群蛇峽谷的下面。"
      },
      {
        "key": "qstsa2q33",
        "stage": 4,
        "textEn": "Speak with the townsfolk in Lut Gholein.",
        "textZh": "和魯.高因中的居民談談。"
      }
    ]
  },
  {
    "id": "a2q4",
    "act": 2,
    "index": 3,
    "b1": 9,
    "iconKey": "a2q4",
    "titleKey": "qstsa2q4",
    "titleEn": "Arcane Sanctuary",
    "titleZh": "神秘庇難所",
    "objectiveKey": "qstsa2q41",
    "objectiveEn": "Look for the Arcane Sanctuary within the Palace.",
    "objectiveZh": "到宮殿中找尋神秘的庇難所。",
    "completedKey": "A2Q4SuccessfulDrognan",
    "completedEn": "You have found Horazon's Journal. Excellent... But, I must caution you. The mark of the True Tomb of Tal Rasha, is sought, if not already known, by Diablo. I needn't elaborate on the implications of that.",
    "completedZh": "你找到赫拉森的日記？太棒了。但是我必 須提醒你，你的確找到了塔．拉夏古墓的 真正符號，不過目前暗黑破壞神還不知道。 我想我不用暗示目前複雜的情況。",
    "rewardSummaryEn": "Access to Arcane Sanctuary and Canyon of the Magi",
    "rewardSummaryZh": "开启神秘避难所与术士峡谷",
    "stages": [
      {
        "key": "qstsa2q41",
        "stage": 1,
        "textEn": "Look for the Arcane Sanctuary within the Palace.",
        "textZh": "到宮殿中找尋神秘的庇難所。"
      },
      {
        "key": "qstsa2q41a",
        "stage": 2,
        "textEn": "Talk to Drognan.",
        "textZh": "和卓格南談談。"
      },
      {
        "key": "qstsa2q42",
        "stage": 3,
        "textEn": "Find Horazon's Journal.",
        "textZh": "找出赫拉森的日記。"
      },
      {
        "key": "qstsa2q43",
        "stage": 4,
        "textEn": "Continue the search for the Seventh Tomb.",
        "textZh": "繼續找尋第七個古墓。"
      }
    ]
  },
  {
    "id": "a2q5",
    "act": 2,
    "index": 4,
    "b1": 10,
    "iconKey": "a2q5",
    "titleKey": "qstsa2q5",
    "titleEn": "The Summoner",
    "titleZh": "召喚者",
    "objectiveKey": "qstsa2q51",
    "objectiveEn": "Beware the Summoner.",
    "objectiveZh": "小心召喚者。",
    "completedKey": "A2Q5SuccessfulDrognan",
    "completedEn": "Larger forces are moving inexorably towards us. You must now make haste to the Tombs.",
    "completedZh": "更強大的力量冷酷無情的逼近我們。你必 須儘快的前往墓地。",
    "rewardSummaryEn": "Red portal to Canyon of the Magi, True Tomb symbol",
    "rewardSummaryZh": "开启通往术士峡谷的红门，查明真正塔·拉夏古墓符号",
    "stages": [
      {
        "key": "qstsa2q51",
        "stage": 1,
        "textEn": "Beware the Summoner.",
        "textZh": "小心召喚者。"
      },
      {
        "key": "qstsa2q52",
        "stage": 2,
        "textEn": "Kill the Summoner.",
        "textZh": "殺了召喚者。"
      },
      {
        "key": "qstsa2q53",
        "stage": 3,
        "textEn": "Return to town for more information.",
        "textZh": "回到城鎮可以聽到更多的訊息。"
      }
    ]
  },
  {
    "id": "a2q6",
    "act": 2,
    "index": 5,
    "b1": 11,
    "iconKey": "a2q6",
    "titleKey": "qstsa2q6",
    "titleEn": "The Seven Tombs",
    "titleZh": "七個古墓",
    "objectiveKey": "qstsa2q61",
    "objectiveEn": "Find Tal Rasha's Tomb.",
    "objectiveZh": "找出塔.拉夏的古墓。",
    "completedKey": "A2Q6SuccessfulJerhyn",
    "completedEn": "You have done very well. Few could have come this far, let alone discover the True Tomb of Tal Rasha. Unfortunately, I hear that Diablo and Baal have eluded your grasp. This is most unfortunate... If you wish to travel East, I have authorized Meshif to give you passage by sea. I imagine he should be very anxious to leave by now. Good luck on your quest, and thank you again for saving my beloved city. You will always be welcome in Lut Gholein, my friend.",
    "completedZh": "你做得很好，能夠走到這一步的人的確不 多，尤其是找到塔．拉夏的古墓。不幸的 是，我聽說暗黑破壞神和巴爾已經擺脫了 你們的掌握，這是最不幸的事情... 如果你們想要繼續往東走，我已經授權給 馬席夫讓他帶你們穿越海洋。我可以想像 他已經非常急迫的想要出航。 祝你的任務好運，並且感謝你再度拯救了 我摰愛的城市。你在魯．高因會永遠受到 我們的歡迎，朋友。",
    "rewardSummaryEn": "Access to Act III (Kurast Docks)",
    "rewardSummaryZh": "开启前往第三幕（库拉斯特海港）的航线",
    "stages": [
      {
        "key": "qstsa2q61",
        "stage": 1,
        "textEn": "Find Tal Rasha's Tomb.",
        "textZh": "找出塔.拉夏的古墓。"
      },
      {
        "key": "qstsa2q62",
        "stage": 2,
        "textEn": "Kill Duriel.",
        "textZh": "殺了都瑞爾。"
      },
      {
        "key": "qstsa2q63",
        "stage": 3,
        "textEn": "Explore Tal Rasha'a Chamber.",
        "textZh": "探索都瑞爾的房間。"
      },
      {
        "key": "qstsa2q64",
        "stage": 4,
        "textEn": "Talk to Jerhyn.",
        "textZh": "和杰海因談談。"
      },
      {
        "key": "qstsa2q65",
        "stage": 5,
        "textEn": "Talk to Meshif.",
        "textZh": "和馬席夫談談。"
      }
    ]
  },
  {
    "id": "a3q1",
    "act": 3,
    "index": 0,
    "b1": 15,
    "iconKey": "a3q4",
    "titleKey": "qstsa3q4",
    "titleEn": "The Golden Bird",
    "titleZh": "黃金鳥",
    "objectiveKey": "qstsa3q41",
    "objectiveEn": "Ask Cain about the Jade Figurine.",
    "objectiveZh": "問問凱恩與玉製小人有關的事。",
    "completedKey": "A3Q4SuccessfulAlkor",
    "completedEn": "From the ashes of Ku Y'leh I have mixed for you a potion.",
    "completedZh": "從庫亞的骨灰中，我幫你混合出一份葯劑。",
    "rewardSummaryEn": "Potion of Life (+20 Permanent Max Life)",
    "rewardSummaryZh": "生命药剂（永久增加 20 点生命上限）",
    "stages": [
      {
        "key": "qstsa3q41",
        "stage": 1,
        "textEn": "Ask Cain about the Jade Figurine.",
        "textZh": "問問凱恩與玉製小人有關的事。"
      },
      {
        "key": "qstsa3q42",
        "stage": 2,
        "textEn": "Show Meshif the Figurine.",
        "textZh": "把小人給馬席夫看看。"
      },
      {
        "key": "qstsa3q43",
        "stage": 3,
        "textEn": "Ask Cain about the Golden Bird.",
        "textZh": "詢問凱恩與黃金鳥有關的消息。"
      },
      {
        "key": "qstsa3q44",
        "stage": 4,
        "textEn": "Give the Golden Bird to Alkor.",
        "textZh": "把黃金鳥交給艾柯。"
      },
      {
        "key": "qstsa3q45",
        "stage": 5,
        "textEn": "Return to Alkor for reward.",
        "textZh": "回去找艾柯，拿取你的獎賞。"
      }
    ]
  },
  {
    "id": "a3q2",
    "act": 3,
    "index": 1,
    "b1": 14,
    "iconKey": "a3q3",
    "titleKey": "qstsa3q3",
    "titleEn": "Blade of the Old Religion",
    "titleZh": "古代宗教之刃",
    "objectiveKey": "qstsa3q31",
    "objectiveEn": "Look for the Gidbinn in the Flayer Jungle.",
    "objectiveZh": "在剝皮叢林中找找吉得賓。",
    "completedKey": "A3Q3SuccessfulOrmus",
    "completedEn": "You have done well, noble hero. Ormus congratulates you. The old spirits of Skatsim will watch over you for returning their sacred blade. Now, after all these years, Ormus will once again use his powers to protect the innocent from the shadow. The spell that protects the dockside shall now be reinforced.",
    "completedZh": "你做得很好，高貴的英雄，奧瑪斯在此向 你致意。史卡辛的古老靈魂會因為你送回 了這把聖刀而看護著你。現在，在經過了 這麼多年之後，奧瑪斯將再度使用它的力 量，從黑暗的陰影中保護無辜之人。保護 港灣的力量現在已經全面強化了。",
    "rewardSummaryEn": "Iron Wolf Mercenary, Rare Ring from Ormus",
    "rewardSummaryZh": "铁狼法师雇佣兵，奥玛斯的稀有戒指",
    "stages": [
      {
        "key": "qstsa3q31",
        "stage": 1,
        "textEn": "Look for the Gidbinn in the Flayer Jungle.",
        "textZh": "在剝皮叢林中找找吉得賓。"
      },
      {
        "key": "qstsa3q32",
        "stage": 2,
        "textEn": "Pick up the Gidbinn.",
        "textZh": "取回吉得賓。"
      },
      {
        "key": "qstsa3q33",
        "stage": 3,
        "textEn": "Return the Gidbinn to Ormus.",
        "textZh": "把吉得賓送到奧瑪斯的手中。"
      },
      {
        "key": "qstsa3q34",
        "stage": 4,
        "textEn": "Talk to Asheara.",
        "textZh": "和艾席拉談談。"
      },
      {
        "key": "qstsa3q35",
        "stage": 5,
        "textEn": "Talk to Ormus.",
        "textZh": "和奧瑪斯談談。"
      }
    ]
  },
  {
    "id": "a3q3",
    "act": 3,
    "index": 2,
    "b1": 13,
    "iconKey": "a3q2",
    "titleKey": "qstsa3q2",
    "titleEn": "Khalim's Will",
    "titleZh": "克林姆的意志",
    "objectiveKey": "qstsa3q21",
    "objectiveEn": "Find Khalim's relics. Search for his Eye in the Spider Cavern.",
    "objectiveZh": "找出克林姆的遺骸。在蜘蛛洞窟中可以找到他的眼球。",
    "completedKey": "A3Q2SuccessfulCain",
    "completedEn": "Masterfully done, hero! You have crafted Khalim's Will. Employ it to destroy the Compelling Orb and open the way to Mephisto. May the true Light guide your way.",
    "completedZh": "盛氣凌人的大成功，英雄！你已經把克林 姆的意志實體化了。使用它摧毀強制球體， 就可以打開通往墨菲斯托的通路。願真正 的光明導引著你的道路。",
    "rewardSummaryEn": "Khalim's Will weapon to smash Compelling Orb",
    "rewardSummaryZh": "合成克林姆的意志击碎强制之球",
    "stages": [
      {
        "key": "qstsa3q21",
        "stage": 1,
        "textEn": "Find Khalim's relics. Search for his Eye in the Spider Cavern.",
        "textZh": "找出克林姆的遺骸。在蜘蛛洞窟中可以找到他的眼球。"
      },
      {
        "key": "qstsa3q22",
        "stage": 2,
        "textEn": "Search for Khalim's Brain in the Flayer Dungeon.",
        "textZh": "在剝皮地窖中找出克林姆的腦。"
      },
      {
        "key": "qstsa3q24",
        "stage": 3,
        "textEn": "Search for Khalim's Heart in the Sewers under the Kurast Bazaar.",
        "textZh": "在庫拉斯特商場底下的下水道中，找尋克林姆的心臟。"
      },
      {
        "key": "qstsa3q23",
        "stage": 4,
        "textEn": "Search for Khalim's Flail in Travincal. Beware the High Council.",
        "textZh": "在崔凡克找出克林姆的連枷。小心最高評議會。"
      },
      {
        "key": "qstsa3q25",
        "stage": 5,
        "textEn": "Transmute Khalim's relics - the Flail, Eye, Heart, and Brain - with the Horadric Cube.",
        "textZh": "轉換克林姆的遺骸-連枷、眼球、心臟、腦-放進赫拉迪克的方塊之中。"
      },
      {
        "key": "qstsa3q26",
        "stage": 6,
        "textEn": "Use Khalim's Will to smash the Compelling Orb.",
        "textZh": "利用克林姆的意志來摧毀強制球體。"
      }
    ]
  },
  {
    "id": "a3q4",
    "act": 3,
    "index": 3,
    "b1": 12,
    "iconKey": "a3q1",
    "titleKey": "qstsa3q1",
    "titleEn": "Lam Esen's Tome",
    "titleZh": "藍.依森的古書",
    "objectiveKey": "qstsa3q11",
    "objectiveEn": "Search the six temples in the Bazaar, Upper Kurast, and the Causeway for Lam Esen's Tome.",
    "objectiveZh": "你得在庫拉斯特商場、庫拉斯特上層，和庫拉斯特的堤道分布的六個古墓中，找到藍.依森之書。",
    "completedKey": "A3Q1SuccessfulAlkor",
    "completedEn": "You have found the Book! It should give all of us here some insight into the nature of the Prime Evils... Ah, but as for you...",
    "completedZh": "你找到書了！它應該可以讓我們更瞭解罪 惡之源的真正面孔... 啊，但是對你來說...",
    "rewardSummaryEn": "+5 Stat Points from Alkor",
    "rewardSummaryZh": "艾柯奖励 +5 属性点",
    "stages": [
      {
        "key": "qstsa3q11",
        "stage": 1,
        "textEn": "Search the six temples in the Bazaar, Upper Kurast, and the Causeway for Lam Esen's Tome.",
        "textZh": "你得在庫拉斯特商場、庫拉斯特上層，和庫拉斯特的堤道分布的六個古墓中，找到藍.依森之書。"
      },
      {
        "key": "qstsa3q12",
        "stage": 2,
        "textEn": "Talk to Alkor.",
        "textZh": "和艾柯談談。"
      }
    ]
  },
  {
    "id": "a3q5",
    "act": 3,
    "index": 4,
    "b1": 16,
    "iconKey": "a3q5",
    "titleKey": "qstsa3q5",
    "titleEn": "The Blackened Temple",
    "titleZh": "轉為黑暗的神殿",
    "objectiveKey": "qstsa3q51",
    "objectiveEn": "Find the Blackened Temple within Travincal.",
    "objectiveZh": "找到沈淪在黑暗的神殿，位於崔凡克之中。",
    "completedKey": "A3Q5SuccessfulOrmus",
    "completedEn": "Ormus is grateful to you, stranger. You have broken the long, dark reign of Zakarum and delivered the first paralyzing blow against the Three. Yet still, the true test lies ahead. For he whom the Council guarded still lives within the Blackened Tower.",
    "completedZh": "奧瑪斯感激你，陌生人。你打破了長久以 來的撒卡蘭姆黑暗統治，並且對三個罪惡 之源首度迎頭痛擊。不過，真正的考驗還 在你的面前。因為目前評議會所看守的東 西，仍然活著那個黑色的高塔中。",
    "rewardSummaryEn": "Breaks Zakarum Council corruption, opens Durance of Hate",
    "rewardSummaryZh": "铲除撒卡兰姆最高评议会，解除憎恨囚牢封印",
    "stages": [
      {
        "key": "qstsa3q51",
        "stage": 1,
        "textEn": "Find the Blackened Temple within Travincal.",
        "textZh": "找到沈淪在黑暗的神殿，位於崔凡克之中。"
      },
      {
        "key": "qstsa3q52",
        "stage": 2,
        "textEn": "Kill the High Council.",
        "textZh": "殺死所有的最高評議會成員。"
      },
      {
        "key": "qstsa3q53",
        "stage": 3,
        "textEn": "Ask Cain for help.",
        "textZh": "去找凱恩求援。"
      }
    ]
  },
  {
    "id": "a3q6",
    "act": 3,
    "index": 5,
    "b1": 17,
    "iconKey": "a3q6",
    "titleKey": "qstsa3q6",
    "titleEn": "The Guardian",
    "titleZh": "守護者",
    "objectiveKey": "qstsa3q61",
    "objectiveEn": "Smash the Compelling Orb with Khalim's Will to open the way to Mephisto's Durance.",
    "objectiveZh": "利用克林姆的意志把強制球體毀掉，可以打開前往墨菲斯托的牢籠。",
    "completedKey": "A3Q6SuccessfulOrmus",
    "completedEn": "You have defeated a Prime Evil in combat. Ormus is impressed beyond words. But staying here will not end this conflict. You must enter the Infernal Gate and stop Diablo once and for all.",
    "completedZh": "你在戰鬥中摧毀了罪惡之源。奧瑪斯對你 的感激無法用言語表達。但是在這個地方 獲勝並沒有結束這場抗爭，你必須進入永 恒之門，並永遠的阻止暗黑破壞神。",
    "rewardSummaryEn": "Mephisto's Soulstone, Red Portal to Act IV",
    "rewardSummaryZh": "墨菲斯托的灵魂石，前往第四幕地狱之门",
    "stages": [
      {
        "key": "qstsa3q61",
        "stage": 1,
        "textEn": "Smash the Compelling Orb with Khalim's Will to open the way to Mephisto's Durance.",
        "textZh": "利用克林姆的意志把強制球體毀掉，可以打開前往墨菲斯托的牢籠。"
      },
      {
        "key": "qstsa3q62",
        "stage": 2,
        "textEn": "Search for Mephisto in his Durance.",
        "textZh": "在他的囚牢中，找出墨菲斯托。"
      },
      {
        "key": "qstsa3q63",
        "stage": 3,
        "textEn": "Kill Mephisto.",
        "textZh": "殺了墨菲斯托。"
      }
    ]
  },
  {
    "id": "a4q1",
    "act": 4,
    "index": 0,
    "b1": 18,
    "iconKey": "a4q1",
    "titleKey": "qstsa4q1",
    "titleEn": "The Fallen Angel",
    "titleZh": "墮落的天使",
    "objectiveKey": "qstsa4q11",
    "objectiveEn": "Look for Izual in the Plains of Despair.",
    "objectiveZh": "在絕望平原找尋衣卒爾。",
    "completedKey": "A4Q1SuccessfulTyrael",
    "completedEn": "Thank you, hero, for putting Izual's tortured spirit to rest. May the Light protect you and the powers of Heaven shine upon your path. But, if what you tell me is true, then I fear that we have been played for fools all along. Izual helped Diablo and his Brothers trick me into using the Soulstones against them... Now the Stones' powers are corrupted. With the combined powers of the Soulstones under their control, the Prime Evils will be able to turn the mortal world into a permanent outpost of Hell!",
    "completedZh": "感謝你，英雄，讓衣卒爾飽受折磨的靈魂 得到休息。願光明保護你，而天堂之光導 引著你們的道路。但是，如果你告訴我的 事情屬實，那麼，我怕我們一直都被玩弄 在股掌之上。 衣卒爾幫助了暗黑破壞神以及他的兄弟， 騙我使用靈魂之石來對抗他們...現在石塊的 力量已經受到污染了。靠著融合靈魂之石 後所取得的力量，罪惡之源可以把人類的 世界，轉換成地獄的前哨站！",
    "rewardSummaryEn": "+2 Skill Points from Tyrael",
    "rewardSummaryZh": "泰瑞尔奖励 +2 技能点",
    "stages": [
      {
        "key": "qstsa4q11",
        "stage": 1,
        "textEn": "Look for Izual in the Plains of Despair.",
        "textZh": "在絕望平原找尋衣卒爾。"
      },
      {
        "key": "qstsa4q12",
        "stage": 2,
        "textEn": "Destroy the demon that holds Izual's soul.",
        "textZh": "摧毀控制衣卒爾靈魂的邪魔。"
      },
      {
        "key": "qstsa4q13",
        "stage": 3,
        "textEn": "See Tyrael for reward.",
        "textZh": "去找泰瑞爾，領取你的獎賞。"
      }
    ]
  },
  {
    "id": "a4q2",
    "act": 4,
    "index": 1,
    "b1": 19,
    "iconKey": "a4q2",
    "titleKey": "qstsa4q3",
    "titleEn": "Hell's Forge",
    "titleZh": "地獄熔爐",
    "objectiveKey": "qstsa4q31",
    "objectiveEn": "Take Mephisto's Soulstone to the Hellforge.",
    "objectiveZh": "拿著墨菲斯托的靈魂之石，前往地獄熔爐。",
    "completedKey": "A4Q3SuccessfulCain",
    "completedEn": "Congratulations, hero! Surely, even Diablo, himself, sensed the fury unleashed when you smashed his Brother's Soulstone.",
    "completedZh": "恭喜你，英雄！當然了...即使是暗黑破壞神本身，也可以感受到你打碎他兄弟的靈魂之石後，所釋放出來的怒氣。",
    "rewardSummaryEn": "High Runes and Perfect/Flawless Gems",
    "rewardSummaryZh": "高级符文与完美/无瑕宝石掉落",
    "stages": [
      {
        "key": "qstsa4q31",
        "stage": 1,
        "textEn": "Take Mephisto's Soulstone to the Hellforge.",
        "textZh": "拿著墨菲斯托的靈魂之石，前往地獄熔爐。"
      },
      {
        "key": "qstsa4q32",
        "stage": 2,
        "textEn": "Destroy Mephisto's Soulstone at the Hellforge.",
        "textZh": "在地獄熔爐中摧毀墨菲斯托的靈魂之石。"
      },
      {
        "key": "qstsa4q33",
        "stage": 3,
        "textEn": "Use the Hellforge Hammer on the Forge.",
        "textZh": "利用地獄熔爐旁邊的鐵鎚，敲打熔爐上的靈魂之石。"
      },
      {
        "key": "qstsa4q34",
        "stage": 4,
        "textEn": "Consult with Cain.",
        "textZh": "和凱恩請教一下。"
      }
    ]
  },
  {
    "id": "a4q3",
    "act": 4,
    "index": 2,
    "b1": 20,
    "iconKey": "a4q3",
    "titleKey": "qstsa4q2",
    "titleEn": "Terror's End",
    "titleZh": "恐怖的結局",
    "objectiveKey": "qstsa4q21",
    "objectiveEn": "Find Diablo in his Sanctuary.",
    "objectiveZh": "在他的庇難所中找出暗黑破壞神。",
    "completedKey": "A4Q2SuccessfulTyrael",
    "completedEn": "Praise be to the Light! You have accomplished the impossible! Diablo and Mephisto have been banished back into the Black Abyss that spawned them and the corrupted Soulstones are no more. You've done well, hero. For now, you should rejoice.",
    "completedZh": "光明的美讚！你完成了不可能的事情！ 暗黑破壞神和墨菲斯托已經被放逐到當年 他們誕生的黑暗地獄深淵，而墮落的靈魂 之石也不復存在。 你做的非常好，英雄。現在，你可以歡慶 和平了。",
    "rewardSummaryEn": "Title of Slayer/Champion/Matriarch, Access to Act V",
    "rewardSummaryZh": "获得称号，开启第五幕（哈洛加斯）",
    "stages": [
      {
        "key": "qstsa4q21",
        "stage": 1,
        "textEn": "Find Diablo in his Sanctuary.",
        "textZh": "在他的庇難所中找出暗黑破壞神。"
      },
      {
        "key": "qstsa4q23",
        "stage": 2,
        "textEn": "Break the remaining %d seals.",
        "textZh": "打破尚存的%d封印。"
      },
      {
        "key": "qstsa4q24",
        "stage": 3,
        "textEn": "Break the final seal.",
        "textZh": "打破最後一個封印。"
      },
      {
        "key": "qstsa4q22",
        "stage": 4,
        "textEn": "Kill Diablo.",
        "textZh": "殺死暗黑破壞神。"
      }
    ]
  },
  {
    "id": "a5q1",
    "act": 5,
    "index": 0,
    "b1": 21,
    "iconKey": "a5q1",
    "titleKey": "qstsa5q1",
    "titleEn": "Siege on Harrogath",
    "titleZh": "圍攻哈洛加斯",
    "objectiveKey": "qsta5q11",
    "objectiveEn": "Stop the Siege by killing Shenk the Overseer in the Bloody Foothills.",
    "objectiveZh": "在血腥丘陵擊敗督軍山克來阻止圍攻。",
    "completedKey": "A5Q1SuccessfulLarzuk",
    "completedEn": "You're an even greater warrior than I expected...Sorry for underestimating you. As a token of my appreciation, I will craft sockets into an item of your choosing, and from now on, you'll get the best price for all my wares.",
    "completedZh": "你比我預想的還要強大得多……抱歉我之前低估了你。 為了表達我的謝意，我會為你選定的一件裝備鑿出凹槽；而且從今往後，我這裡所有的商品都會給你最優惠的價格。",
    "rewardSummaryEn": "Item Socketing by Larzuk",
    "rewardSummaryZh": "拉苏克为一件装备打孔（最大孔数）",
    "stages": [
      {
        "key": "qsta5q11",
        "stage": 1,
        "textEn": "Stop the Siege by killing Shenk the Overseer in the Bloody Foothills.",
        "textZh": "在血腥丘陵擊敗督軍山克來阻止圍攻。"
      },
      {
        "key": "qsta5q12",
        "stage": 2,
        "textEn": "Kill Shenk the Overseer.",
        "textZh": "殺死督軍山克。"
      },
      {
        "key": "qsta5q13",
        "stage": 3,
        "textEn": "Go talk to Larzuk for your reward.",
        "textZh": "去和拉蘇克談談以領取你的獎賞。"
      },
      {
        "key": "qsta5q14",
        "stage": 4,
        "textEn": "Larzuk will add sockets to the item of your choice.",
        "textZh": "拉蘇克會幫你選定的物品加上凹槽。"
      }
    ]
  },
  {
    "id": "a5q2",
    "act": 5,
    "index": 1,
    "b1": 22,
    "iconKey": "a5q2",
    "titleKey": "qstsa5q2",
    "titleEn": "Rescue on Mount Arreat",
    "titleZh": "亞瑞特山救援行動",
    "objectiveKey": "qstsa5q21",
    "objectiveEn": "Find the Soldiers in the Frigid Highlands.",
    "objectiveZh": "在冰凍高地找尋士兵。",
    "completedKey": "A5Q2SuccessfulQualKehk",
    "completedEn": "Thank you for rescuing my men. They have spoken well of your bravery in battle. Perhaps there is hope for us after all. If you wish, you may hire some of my mercenaries that you saved. And please...take this set of runes. I had been saving them for a socketed shield, but I think you'll make better use of them. Be sure to set them in the right order for their fullest effect.",
    "completedZh": "感謝你救出了我的部下。他們對你在戰場上的英勇讚不絕口。或許我們終究還有一線希望。 如果你願意，可以僱傭我那些被你救回來的野蠻人戰士。另外，請收下這套符文。我原本打算把它們鑲在一面帶孔的盾牌上，但我想它們在你手裡能發揮更大的作用。 請務必按照正確的順序鑲嵌它們，以激發最完整的力量。",
    "rewardSummaryEn": "Ral, Ort, Tal runes and Barbarian Mercenaries",
    "rewardSummaryZh": "Ral, Ort, Tal 符文组合，解锁野蛮人雇佣兵",
    "stages": [
      {
        "key": "qstsa5q21",
        "stage": 1,
        "textEn": "Find the Soldiers in the Frigid Highlands.",
        "textZh": "在冰凍高地找尋士兵。"
      },
      {
        "key": "qstsa5q21a",
        "stage": 2,
        "textEn": "Free the soldiers from their prison and lead them back to town.",
        "textZh": "把士兵從牢籠中釋放出來並帶領他們回到城鎮。"
      },
      {
        "key": "qstsa5q22",
        "stage": 3,
        "textEn": "Rescue %d more Soldiers in the Frigid Highlands.",
        "textZh": "在冰凍高地再救出 %d 名士兵。"
      },
      {
        "key": "qstsa5q23",
        "stage": 4,
        "textEn": "Return to Qual-Kehk for your reward.",
        "textZh": "回去找夸爾凱克領取你的獎賞。"
      },
      {
        "key": "qstsa5q24",
        "stage": 5,
        "textEn": "Apply the Runes to a Socketed item in this order:",
        "textZh": "按照這個順序將符文鑲嵌到有凹槽的物品上："
      }
    ]
  },
  {
    "id": "a5q3",
    "act": 5,
    "index": 2,
    "b1": 23,
    "iconKey": "a5q3",
    "titleKey": "qstsa5q3",
    "titleEn": "Prison of Ice",
    "titleZh": "冰之囚",
    "objectiveKey": "qstsa5q31",
    "objectiveEn": "Look for Anya under the Crystalline Passage by the Frozen River.",
    "objectiveZh": "在冰河旁邊的水晶通道下方找尋安亞。",
    "completedKey": "A5Q3SuccessfulAnya",
    "completedEn": "Thank you, hero, for rescuing me. To show my personal gratitude, I give you this. I had it custom-made for you by Larzuk.",
    "completedZh": "謝謝你救了我，英雄。 為了表達我個人的感激之情，請收下這件禮物。這是我特意請拉蘇克為你量身打造的。",
    "rewardSummaryEn": "Scroll of Resistance (+10% All Resists), Class Rare Item",
    "rewardSummaryZh": "抵抗卷轴（+10% 全元素抗性），本职业专属稀有装备",
    "stages": [
      {
        "key": "qstsa5q31",
        "stage": 1,
        "textEn": "Look for Anya under the Crystalline Passage by the Frozen River.",
        "textZh": "在冰河旁邊的水晶通道下方找尋安亞。"
      },
      {
        "key": "qstsa5q31a",
        "stage": 2,
        "textEn": "Rescue Anya.",
        "textZh": "救出安亞。"
      },
      {
        "key": "qstsa5q32",
        "stage": 3,
        "textEn": "Talk to Malah.",
        "textZh": "和馬拉談談。"
      },
      {
        "key": "qstsa5q33",
        "stage": 4,
        "textEn": "Use the potion Malah gave you to thaw Anya.",
        "textZh": "使用馬拉給你的藥水替安亞解凍。"
      },
      {
        "key": "qstsa5q34",
        "stage": 5,
        "textEn": "Talk to Malah for your reward.",
        "textZh": "去和馬拉談談以領取你的獎賞。"
      },
      {
        "key": "qstsa5q35",
        "stage": 6,
        "textEn": "Talk to Anya.",
        "textZh": "和安亞談談。"
      }
    ]
  },
  {
    "id": "a5q4",
    "act": 5,
    "index": 3,
    "b1": 24,
    "iconKey": "a5q4",
    "titleKey": "qstsa5q4",
    "titleEn": "Betrayal of Harrogath",
    "titleZh": "哈洛加斯的背叛",
    "objectiveKey": "qstsa5q41",
    "objectiveEn": "Take Anya's portal to Nihlathak's Temple.",
    "objectiveZh": "穿過安亞的傳送門前往尼拉塞克的神殿。",
    "completedKey": "A5Q4SuccessfulAnya",
    "completedEn": "You have stopped Nihlathak, but he didn't have the Relic! He must have already given it to Baal. Now, Baal will not be tested when he reaches Arreat's summit. ...Damn Nihlathak! I do thank you for trying, though. Please, allow me to honor your courage by magically inscribing your name onto an item of your choosing. It's the least I can do.",
    "completedZh": "你雖然阻止了尼拉塞克，但遠古聖物卻不在他身上！他一定已經把聖物交給巴爾了。如此一來，當巴爾抵達亞瑞特山頂時，將不會受到先祖的考驗。 ……該死的尼拉塞克！ 不過我還是要感謝你的努力。請允許我用魔法將你的名字銘刻在你選定的一件裝備上，以表彰你的英勇。這是我唯一能做的了。",
    "rewardSummaryEn": "Personalize Item with your character name",
    "rewardSummaryZh": "安亚为一件装备刻上你的角色名字",
    "stages": [
      {
        "key": "qstsa5q41",
        "stage": 1,
        "textEn": "Take Anya's portal to Nihlathak's Temple.",
        "textZh": "穿過安亞的傳送門前往尼拉塞克的神殿。"
      },
      {
        "key": "qstsa5q42a",
        "stage": 2,
        "textEn": "Find Nihlathak in the Halls of Vaught.",
        "textZh": "在瓦特之廳找出尼拉塞克。"
      },
      {
        "key": "qstsa5q42",
        "stage": 3,
        "textEn": "Kill Nihlathak.",
        "textZh": "殺死尼拉塞克。"
      },
      {
        "key": "qstsa5q43",
        "stage": 4,
        "textEn": "Talk to Anya before you continue through the Crystalline Passage, past the Glacial Trail, to proceed up Mount Arreat to the Summit.",
        "textZh": "在繼續穿過水晶通道、經過冰河小徑前往亞瑞特山頂峰之前，先和安亞談談。"
      },
      {
        "key": "qstsa5q43a",
        "stage": 5,
        "textEn": "Anya will personalize an item for you.",
        "textZh": "安亞會替你把名字刻在物品上。"
      }
    ]
  },
  {
    "id": "a5q5",
    "act": 5,
    "index": 4,
    "b1": 25,
    "iconKey": "a5q5",
    "titleKey": "qstsa5q5",
    "titleEn": "Rite of Passage",
    "titleZh": "通過儀式的考驗",
    "objectiveKey": "qstsa5q51",
    "objectiveEn": "Travel through the Ancient's Way to find the Ancients at the Arreat Summit.",
    "objectiveZh": "穿過遠古之路，在亞瑞特山頂峰找到遠古野蠻人。",
    "completedKey": "A5Q5SuccessfulQualKehk",
    "completedEn": "Besting the Ancients in battle is a mighty feat indeed. I hope this means you're ready to battle Baal.",
    "completedZh": "能在戰鬥中擊敗遠古先祖，確實是了不起的偉業。希望這意味著你已經做好了迎戰巴爾的準備。",
    "rewardSummaryEn": "Massive Experience, Passage to Worldstone Keep",
    "rewardSummaryZh": "巨额角色经验值晋级，开启世界之石要塞通道",
    "stages": [
      {
        "key": "qstsa5q51",
        "stage": 1,
        "textEn": "Travel through the Ancient's Way to find the Ancients at the Arreat Summit.",
        "textZh": "穿過遠古之路，在亞瑞特山頂峰找到遠古野蠻人。"
      },
      {
        "key": "qstsa5q52",
        "stage": 2,
        "textEn": "Consult with the Ancients by activating the Altar of the Heavens.",
        "textZh": "啟動天堂祭壇向遠古野蠻人請教。"
      },
      {
        "key": "qstsa5q53",
        "stage": 3,
        "textEn": "Defeat all three Ancients without leaving Mount Arreat.",
        "textZh": "在不離開亞瑞特山的情況下擊敗全部三位遠古野蠻人。"
      }
    ]
  },
  {
    "id": "a5q6",
    "act": 5,
    "index": 5,
    "b1": 26,
    "iconKey": "a5q6",
    "titleKey": "qstsa5q6",
    "titleEn": "Eve of Destruction",
    "titleZh": "毀滅的前夕",
    "objectiveKey": "qstsa5q61a",
    "objectiveEn": "Find Baal's Throne Room.",
    "objectiveZh": "找出巴爾的王座廳。",
    "completedKey": "A5Q6SuccessfulTyrael",
    "completedEn": "I am impressed, mortal. You have overcome the greatest challenge this world has ever faced and defeated the last of the Prime Evils. However, we are too late to save the Worldstone. Baal's destructive touch has corrupted it completely. Given enough time, the Worldstone's energies will drain away and the barriers between the worlds will shatter -- the powers of Hell will flood into this...Sanctuary...and eradicate your people and everything you've labored to build. Therefore, I must destroy the corrupted Worldstone before the powers of Hell take root. This act will change your world forever -- with consequences even I cannot foresee. However, it is the only way to ensure mankind's survival. Go now, mortal. I have opened a portal that will lead you to safety. May the Eternal Light shine upon you and your descendants for what you've done this day. The continued survival of mankind is your legacy! Above all else, you have earned a rest from this endless battle.",
    "completedZh": "凡人，你令我深感欽佩。你克服了這個世界有史以來面臨的最大挑戰，擊敗了最後一位罪惡之源。然而，我們還是來晚了一步，無法挽救世界之石。巴爾毀滅性的觸碰已經徹底污染了它。 假以時日，世界之石的能量將會枯竭，各界之間的屏障也將隨之崩塌——地獄的力量將如洪水般湧入這片……庇護之地……將你的族人以及你們辛勤建立的一切徹底抹殺。 因此，我必須在地獄之力紮根之前摧毀這顆被污染的世界之石。此舉將永遠改變你的世界——其後果就連我也無法預料。但這是確保人類得以存續的唯一途徑。 去吧，凡人。我已經開啟了一道通往安全之地的傳送門。 願永恆的聖光因你今日的偉業而照耀你與你的後代。人類的延續便是你留下的不朽傳奇！最重要的是，在這場無休止的征戰之後，你終於贏得了應得的安寧。",
    "rewardSummaryEn": "Game Completion, Title of Slayer/Champion/Patriarch",
    "rewardSummaryZh": "通关本难度，获得救世主/先驱/宗师最高荣誉头衔",
    "stages": [
      {
        "key": "qstsa5q61a",
        "stage": 1,
        "textEn": "Find Baal's Throne Room.",
        "textZh": "找出巴爾的王座廳。"
      },
      {
        "key": "qstsa5q62b",
        "stage": 2,
        "textEn": "Kill Baal's Minions.",
        "textZh": "殺死巴爾的僕從。"
      },
      {
        "key": "qstsa5q62a",
        "stage": 3,
        "textEn": "Kill Baal in the Worldstone Chamber before he corrupts it.",
        "textZh": "在巴爾腐化世界之石大殿之前殺死他。"
      },
      {
        "key": "qstsa5q62",
        "stage": 4,
        "textEn": "Kill Baal.",
        "textZh": "殺死巴爾。"
      },
      {
        "key": "qstsa5q63",
        "stage": 5,
        "textEn": "Talk to Tyreal.",
        "textZh": "和泰瑞爾談談。"
      },
      {
        "key": "qstsa5q64",
        "stage": 6,
        "textEn": "Take Tyreal's Portal to Safety.",
        "textZh": "穿過泰瑞爾的傳送門前往安全之地。"
      }
    ]
  }
] as const

export const CANONICAL_QUEST_BY_ID: Readonly<Record<string, CanonicalQuestItem>> = Object.fromEntries(
  CANONICAL_QUEST_DATA.map(q => [q.id, q])
)

export const CANONICAL_QUESTS_BY_ACT: Readonly<Record<number, readonly CanonicalQuestItem[]>> = {
  1: CANONICAL_QUEST_DATA.filter(q => q.act === 1),
  2: CANONICAL_QUEST_DATA.filter(q => q.act === 2),
  3: CANONICAL_QUEST_DATA.filter(q => q.act === 3),
  4: CANONICAL_QUEST_DATA.filter(q => q.act === 4),
  5: CANONICAL_QUEST_DATA.filter(q => q.act === 5),
}

export interface CanonicalQuestStateSlot {
  readonly speech: string
  readonly text: string
}

/**
 * Canonical 1.13c Quest State Tables (`D2Client.dll` `0x6fba8188`, 27 active quests keyed by `bitIdx`).
 * Each table has 16 slots (`0..15`): slot 0 stores `{ speech: titleKey, text: completedSpeechKey }`,
 * and slots `1..15` store `{ speech, text }` for server status byte `1..15` (`0x52` QuestHistory).
 */
export const CANONICAL_QUEST_STATE_TABLES: Readonly<Record<number, readonly CanonicalQuestStateSlot[]>> = {
  "1": [
    {
      "speech": "qstsa1q1",
      "text": "A1Q1SuccessfulAkara"
    },
    {
      "speech": "WarrivGossip3",
      "text": "qstsa1q11"
    },
    {
      "speech": "A1Q1InitAkara",
      "text": "qstsa1q12"
    },
    {
      "speech": "A1Q1InitAkara",
      "text": "qstsa1q13"
    },
    {
      "speech": "A1Q1InitAkara",
      "text": "qstsa1q14"
    },
    {
      "speech": "A1Q1InitAkara",
      "text": "qstsa1q15"
    },
    {
      "speech": "A1Q1InitAkara",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa1q15"
    },
    {
      "speech": "A1Q1InitAkara",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "A1Q1InitAkara",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "2": [
    {
      "speech": "qstsa1q2",
      "text": "A1Q2SuccessfulKashya"
    },
    {
      "speech": "WarrivGossip1",
      "text": "qstsa1q21"
    },
    {
      "speech": "A1Q2InitKashya",
      "text": "qstsa1q22"
    },
    {
      "speech": "A1Q2InitKashya",
      "text": "qstsa1q23"
    },
    {
      "speech": "A1Q2InitKashya",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa1q23"
    },
    {
      "speech": "A1Q2InitKashya",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "A1Q2InitKashya",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "3": [
    {
      "speech": "qstsa1q3",
      "text": "A1Q3SuccessfulCharsi"
    },
    {
      "speech": "NONE",
      "text": "qstsa1q31"
    },
    {
      "speech": "A1Q3InitCharsi",
      "text": "qstsa1q32"
    },
    {
      "speech": "A1Q3InitCharsi",
      "text": "qstsa1q3x"
    },
    {
      "speech": "A1Q3InitCharsi",
      "text": "Qstsyouarenot8"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa1q32b"
    },
    {
      "speech": "A1Q3SuccessfulCharsi",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "A1Q3InitCharsi",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "4": [
    {
      "speech": "qstsa1q4",
      "text": "A1Q4QuestSuccessfulCain"
    },
    {
      "speech": "NONE",
      "text": "qstsa1q41"
    },
    {
      "speech": "A1Q4InitAkara",
      "text": "qstsa1q42"
    },
    {
      "speech": "A1Q4InitAkara",
      "text": "qstsa1q43"
    },
    {
      "speech": "A1Q4InitAkara",
      "text": "qstsa1q44"
    },
    {
      "speech": "A1Q4InitAkara",
      "text": "qstsa1q45"
    },
    {
      "speech": "A1Q4InitAkara",
      "text": "qstsa1q46"
    },
    {
      "speech": "A1Q4InitAkara",
      "text": "qstsa1q4x"
    },
    {
      "speech": "A1Q4InitAkara",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa1q46b"
    },
    {
      "speech": "A1Q4InitAkara",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "A1Q4InitAkara",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "5": [
    {
      "speech": "qstsa1q5",
      "text": "A1Q5InitQuestTome"
    },
    {
      "speech": "NONE",
      "text": "qstsa1q51"
    },
    {
      "speech": "A1Q5InitQuestTome",
      "text": "qstsa1q52"
    },
    {
      "speech": "A1Q5InitQuestTome",
      "text": "qstsa1q51a"
    },
    {
      "speech": "A1Q5InitQuestTome",
      "text": "qstsa1q51b"
    },
    {
      "speech": "A1Q5InitQuestTome",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "A1Q5InitQuestTome",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "6": [
    {
      "speech": "qstsa1q6",
      "text": "A1Q6SuccessfulCain"
    },
    {
      "speech": "WarrivGossip8",
      "text": "qstsa1q61"
    },
    {
      "speech": "A1Q6InitCain",
      "text": "qstsa1q62"
    },
    {
      "speech": "A1Q6InitCain",
      "text": "qstsa1q63"
    },
    {
      "speech": "A1Q6InitCain",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa1q62b"
    },
    {
      "speech": "A1Q6InitCain",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "A1Q6SuccessfulCain",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "9": [
    {
      "speech": "qstsa2q1",
      "text": "A2Q1SuccessfulAtma"
    },
    {
      "speech": "WarrivGossip1",
      "text": "qstsa2q11"
    },
    {
      "speech": "A2Q1InitAtma",
      "text": "qstsa2q12"
    },
    {
      "speech": "A2Q1InitAtma",
      "text": "qstsa2q13"
    },
    {
      "speech": "A2Q1InitAtma",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa2q13"
    },
    {
      "speech": "qstsnull",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "A2Q1InitAtma",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "10": [
    {
      "speech": "qstsa2q2",
      "text": "A2Q2SuccessfulStaffCain"
    },
    {
      "speech": "NONE",
      "text": "qstsa2q21"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa2q22"
    },
    {
      "speech": "A2Q2EarlyReturnScrollCain",
      "text": "qstsa2q23"
    },
    {
      "speech": "A2Q2EarlyReturnCubeCain",
      "text": "qstsa2q25"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa2q24"
    },
    {
      "speech": "A2Q2SuccessfulStaffCain",
      "text": "qstsa2q24"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsThankYouComeAgainMulti"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa2q24"
    },
    {
      "speech": "qstsnull",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "A2Q2SuccessfulStaffCain",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "11": [
    {
      "speech": "qstsa2q3",
      "text": "qstsnull"
    },
    {
      "speech": "NONE",
      "text": "qstsa2q31a"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa2q32"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa2q33"
    },
    {
      "speech": "A2Q3AfterInitDrognan",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa2q33"
    },
    {
      "speech": "qstsnull",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "qstsnull",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "12": [
    {
      "speech": "qstsa2q4",
      "text": "qstsnull"
    },
    {
      "speech": "NONE",
      "text": "qstsa2q41a"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa2q41"
    },
    {
      "speech": "A2Q4InitDrognan",
      "text": "qstsa2q41"
    },
    {
      "speech": "A2Q4AfterInitJerhyn",
      "text": "qstsa2q42"
    },
    {
      "speech": "A2Q4AfterInitJerhyn",
      "text": "qstsa2q43"
    },
    {
      "speech": "A2Q4SuccessfulNarrator",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa2q43"
    },
    {
      "speech": "A2Q4SuccessfulNarrator",
      "text": "qstsprevious"
    },
    {
      "speech": "A2Q4SuccessfulNarrator",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "A2Q4SuccessfulNarrator",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "13": [
    {
      "speech": "qstsa2q5",
      "text": "qstsnull"
    },
    {
      "speech": "NONE",
      "text": "qstsa2q51"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa2q52"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa2q53"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa2q53"
    },
    {
      "speech": "qstsnull",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "qstsnull",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "14": [
    {
      "speech": "qstsa2q6",
      "text": "A2Q6SuccessfulJerhyn"
    },
    {
      "speech": "WarrivGossip3",
      "text": "qstsa2q61"
    },
    {
      "speech": "A2Q6InitJerhyn",
      "text": "qstsa2q62"
    },
    {
      "speech": "A2Q6AfterInitJerhyn",
      "text": "qstsa2q63f"
    },
    {
      "speech": "A2Q6AfterInitJerhyn",
      "text": "qstsa2q63a"
    },
    {
      "speech": "A2Q6AfterInitJerhyn",
      "text": "qstsa2q64"
    },
    {
      "speech": "TyraelGossip1",
      "text": "qstsa2q65"
    },
    {
      "speech": "A2Q6SuccessfulJerhyn",
      "text": "qstsa2q61a"
    },
    {
      "speech": "A2Q4SuccessfulNarrator",
      "text": "qstsThankYouComeAgain"
    },
    {
      "speech": "qstsnull",
      "text": "qstsThankYouComeAgainMulti"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa2q64"
    },
    {
      "speech": "qstsnull",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "A2Q6SuccessfulJerhyn",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "17": [
    {
      "speech": "qstsa3q1",
      "text": "A3Q1SuccessfulAlkor"
    },
    {
      "speech": "NONE",
      "text": "qstsa3q11"
    },
    {
      "speech": "A3Q1InitAlkor",
      "text": "qstsa3q12"
    },
    {
      "speech": "A3Q1InitAlkor",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsThankYouComeAgainMulti"
    },
    {
      "speech": "qstsnull",
      "text": "qstsThankYouComeAgain"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "qstsnull",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "18": [
    {
      "speech": "qstsa3q2",
      "text": "A3Q2SuccessfulCain"
    },
    {
      "speech": "NONE",
      "text": "qstsa3q21"
    },
    {
      "speech": "A3Q2InitCain",
      "text": "qstsa3q22"
    },
    {
      "speech": "A3Q2InitCain",
      "text": "qstsa3q23"
    },
    {
      "speech": "A3Q2InitCain",
      "text": "qstsa3q24"
    },
    {
      "speech": "A3Q2InitCain",
      "text": "qstsa3q25"
    },
    {
      "speech": "A3Q2InitCain",
      "text": "qstsa3q26"
    },
    {
      "speech": "A3Q2SuccessfulCain",
      "text": "qstsa3q21a"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "qstsnull",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "19": [
    {
      "speech": "qstsa3q3",
      "text": "A3Q3SuccessfulOrmus"
    },
    {
      "speech": "NONE",
      "text": "qstsa3q31a"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa3q31"
    },
    {
      "speech": "A3Q3InitHratli",
      "text": "qstsa3q32"
    },
    {
      "speech": "A3Q3InitHratli",
      "text": "qstsa3q33"
    },
    {
      "speech": "A3Q3InitHratli",
      "text": "qstsa3q34"
    },
    {
      "speech": "A3Q3SuccessfulOrmus",
      "text": "qstsa3q35"
    },
    {
      "speech": "A3Q3SuccessfulOrmus",
      "text": "qstsThankYouComeAgainMulti"
    },
    {
      "speech": "qstsnull",
      "text": "qstsThankYouComeAgain"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "A3Q3SuccessfulOrmus",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "20": [
    {
      "speech": "qstsa3q4",
      "text": "qstsnull"
    },
    {
      "speech": "WarrivGossip3",
      "text": "qstsa3q41"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa3q42"
    },
    {
      "speech": "A3Q4Init1CainAct3",
      "text": "qstsa3q43"
    },
    {
      "speech": "A3Q4Init2MeshifAct3",
      "text": "qstsa3q44"
    },
    {
      "speech": "A3Q4Init3CainAct3",
      "text": "qstsa3q45"
    },
    {
      "speech": "A3Q4AfterInitAlkor",
      "text": "qstsThankYouComeAgain"
    },
    {
      "speech": "qstsnull",
      "text": "qstsThankYouComeAgainMulti"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa3q45"
    },
    {
      "speech": "A3Q4AfterInitAlkor",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "qstsnull",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "21": [
    {
      "speech": "qstsa3q5",
      "text": "qstsnull"
    },
    {
      "speech": "WarrivGossip2",
      "text": "qstsa3q51a"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa3q51"
    },
    {
      "speech": "A3Q5InitOrmus",
      "text": "qstsa3q52"
    },
    {
      "speech": "A3Q5InitOrmus",
      "text": "qstsa3q53"
    },
    {
      "speech": "A3Q5InitOrmus",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa3q53"
    },
    {
      "speech": "A3Q5InitOrmus",
      "text": "qstsprevious"
    },
    {
      "speech": "A3Q5SuccessfulCainAct3",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "A3Q5SuccessfulCainAct3",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "22": [
    {
      "speech": "qstsa3q6",
      "text": "qstsnull"
    },
    {
      "speech": "WarrivGossip3",
      "text": "qstsa3q61a"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa3q61"
    },
    {
      "speech": "A3Q6InitOrmus",
      "text": "qstsa3q62"
    },
    {
      "speech": "A3Q6InitOrmus",
      "text": "qstsa3q63"
    },
    {
      "speech": "A3Q6InitOrmus",
      "text": "qstsa3q6"
    },
    {
      "speech": "A3Q6InitOrmus",
      "text": "qstsThankYouComeAgain"
    },
    {
      "speech": "qstsnull",
      "text": "qstsThankYouComeAgainMulti"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "qstsnull",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "25": [
    {
      "speech": "qstsa4q1",
      "text": "A4Q1SuccessfulIzual"
    },
    {
      "speech": "NONE",
      "text": "qstsa4q11"
    },
    {
      "speech": "A4Q1InitTyrael",
      "text": "qstsa4q12"
    },
    {
      "speech": "A4Q1InitTyrael",
      "text": "qstsa4q13a"
    },
    {
      "speech": "A4Q1InitTyrael",
      "text": "qstsa4q13"
    },
    {
      "speech": "A4Q1SuccessfulIzual",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa4q13"
    },
    {
      "speech": "qstsnull",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "A4Q1SuccessfulTyrael",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "26": [
    {
      "speech": "qstsa4q2",
      "text": "qstsnull"
    },
    {
      "speech": "NONE",
      "text": "qstsa4q21"
    },
    {
      "speech": "A4Q2InitTyrael",
      "text": "qstsa4q22"
    },
    {
      "speech": "A4Q2InitTyrael",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "qstsnull",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "27": [
    {
      "speech": "qstsa4q3",
      "text": "qstsnull"
    },
    {
      "speech": "NONE",
      "text": "qstsa4q31"
    },
    {
      "speech": "A4Q3InitHasStoneCain",
      "text": "qstsa4q32"
    },
    {
      "speech": "A4Q3InitHasStoneCain",
      "text": "qstsa4q33"
    },
    {
      "speech": "A4Q3InitHasStoneCain",
      "text": "qstsa4q31"
    },
    {
      "speech": "A4Q3InitNoStoneCain",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsThankYouComeAgain"
    },
    {
      "speech": "qstsnull",
      "text": "qstsThankYouComeAgainMulti"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "qstsnull",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "35": [
    {
      "speech": "qstsa5q1",
      "text": "A5Q1SuccessfulLarzuk"
    },
    {
      "speech": "NONE",
      "text": "qsta5q11"
    },
    {
      "speech": "A5Q1InitLarzuk",
      "text": "qsta5q12"
    },
    {
      "speech": "A5Q1InitLarzuk",
      "text": "qsta5q13"
    },
    {
      "speech": "A5Q1InitLarzuk",
      "text": "qsta5q14"
    },
    {
      "speech": "A5Q1SuccessfulLarzuk",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsThankYouComeAgain"
    },
    {
      "speech": "qstsnull",
      "text": "qstsThankYouComeAgainMulti"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qsta5q14"
    },
    {
      "speech": "A5Q1SuccessfulLarzuk",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "qstsnull",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "36": [
    {
      "speech": "qstsa5q2",
      "text": "A5Q2SuccessfulQualKehk"
    },
    {
      "speech": "NONE",
      "text": "qstsa5q21"
    },
    {
      "speech": "A5Q2InitQualKehk",
      "text": "qstsa5q22"
    },
    {
      "speech": "A5Q2EarlyReturnQualKehkMan",
      "text": "qstsa5q23"
    },
    {
      "speech": "A5Q2InitQualKehk",
      "text": "qstsa5q24"
    },
    {
      "speech": "A5Q2InitQualKehk",
      "text": "qstsa5q21a"
    },
    {
      "speech": "A5Q2InitQualKehk",
      "text": "qstsThankYouComeAgain"
    },
    {
      "speech": "qstsnull",
      "text": "qstsThankYouComeAgainMulti"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa5q23"
    },
    {
      "speech": "A5Q2InitQualKehk",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "qstsnull",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "37": [
    {
      "speech": "qstsa5q3",
      "text": "A5Q3SuccessfulAnya"
    },
    {
      "speech": "NONE",
      "text": "qstsa5q31"
    },
    {
      "speech": "A5Q3InitMalah",
      "text": "qstsa5q31a"
    },
    {
      "speech": "A5Q3InitMalah",
      "text": "qstsa5q32"
    },
    {
      "speech": "A5Q3InitMalah",
      "text": "qstsa5q33"
    },
    {
      "speech": "A5Q3InitMalah",
      "text": "qstsa5q34"
    },
    {
      "speech": "A5Q3InitMalah",
      "text": "qstsa5q35"
    },
    {
      "speech": "A5Q3InitMalah",
      "text": "qstsThankYouComeAgainMulti"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa5q34"
    },
    {
      "speech": "A5Q3InitMalah",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "qstsnull",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "38": [
    {
      "speech": "qstsa5q4",
      "text": "A5Q4SuccessfulAnya"
    },
    {
      "speech": "NONE",
      "text": "qstsa5q41"
    },
    {
      "speech": "A5Q4InitAnya",
      "text": "qstsa5q42a"
    },
    {
      "speech": "A5Q4InitAnya",
      "text": "qstsa5q42"
    },
    {
      "speech": "A5Q4InitAnya",
      "text": "qstsa5q43"
    },
    {
      "speech": "A5Q4InitAnya",
      "text": "qstsa5q43a"
    },
    {
      "speech": "A5Q4SuccessfulAnya",
      "text": "qstsThankYouComeAgain"
    },
    {
      "speech": "qstsnull",
      "text": "qstsThankYouComeAgainMulti"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa5q43a"
    },
    {
      "speech": "qstsnull",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "qstsnull",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "39": [
    {
      "speech": "qstsa5q5",
      "text": "A5Q5SuccessfulQualKehk"
    },
    {
      "speech": "WarrivGossip2",
      "text": "qstsa5q51"
    },
    {
      "speech": "A5Q5InitQualKehk",
      "text": "qstsa5q52"
    },
    {
      "speech": "A5Q5InitQualKehk",
      "text": "qstsa5q53"
    },
    {
      "speech": "AncientsAct5IntroGossip1",
      "text": "qstsa5q52"
    },
    {
      "speech": "AncientsAct5IntroGossip1",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsThankYouComeAgain"
    },
    {
      "speech": "qstsnull",
      "text": "qstsThankYouComeAgainMulti"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsa5q52"
    },
    {
      "speech": "AncientsAct5IntroGossip1",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "qstsnull",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ],
  "40": [
    {
      "speech": "qstsa5q6",
      "text": "A5Q6SuccessfulTyrael"
    },
    {
      "speech": "NONE",
      "text": "qstsa5q61a"
    },
    {
      "speech": "A5Q6InitAncients",
      "text": "qstsa5q62b"
    },
    {
      "speech": "A5Q6InitAncients",
      "text": "qstsa5q62"
    },
    {
      "speech": "A5Q6InitAncients",
      "text": "qstsa5q63"
    },
    {
      "speech": "A5Q6InitAncients",
      "text": "qstsa5q64"
    },
    {
      "speech": "A5Q6InitAncients",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsnull"
    },
    {
      "speech": "qstsnull",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsprevious"
    },
    {
      "speech": "qstsnull",
      "text": "qstsother"
    },
    {
      "speech": "qstsnull",
      "text": "qstsComplete"
    },
    {
      "speech": "qstsnull",
      "text": "WarrivAct1IntroGossip1"
    },
    {
      "speech": "WarrivAct1IntroGossip1",
      "text": "WarrivAct1IntroGossip1"
    }
  ]
}

/**
 * Canonical 1.13c Quest Log `.tbl` Strings (`string.tbl`, `expansionstring.tbl`, `patchstring.tbl`).
 */
export const CANONICAL_QUEST_TBL_STRINGS: Readonly<Record<string, { readonly zh: string; readonly en: string }>> = {
  "A1Q1SuccessfulAkara": {
    "zh": "65\n你已經清除了洞窟中的邪惡，也贏得了我\n的信任，並回復了我對人類的信心。\n \n你的報酬是自行選擇一項全新的技能。",
    "en": "65\nYou have cleansed the Den of Evil. \nYou've earned my trust and may yet \nrestore my faith in humanity.\n \nYour reward is training in the skill of \nyour choice."
  },
  "A1Q2SuccessfulKashya": {
    "zh": "55\n我幾乎不敢相信你殺死了血鳥！\n \n雖然她曾經是我最親密的朋友，我仍然祈\n禱她飽受刑罰的靈魂被永遠的放逐。\n \n你贏得了我的尊敬，冒險者...而且也得到所\n有蘿格的忠誠。我已經把好幾位最好的戰\n士派來供你驅策。",
    "en": "55\nI can hardly believe that you've defeated \nBlood Raven!\n \nThough she was once my closest friend, \nI pray that her tortured spirit remains \nbanished forever.\n \nYou have earned my respect, stranger... \nand the allegiance of the Rogues. I \nhave placed several of my best \nwarriors at your disposal."
  },
  "A1Q3SuccessfulCharsi": {
    "zh": "72\n噢！你能把赫拉迪克．馬勒斯送回來實在\n太棒了！我現在就可以把你的一項物品灌\n入魔法的力量。",
    "en": "72\nOh! Thanks so much for returning the \nHoradric Malus! I will now imbue one of \nyour items with magical powers."
  },
  "A1Q4QuestSuccessfulCain": {
    "zh": "74\n就當做我對你的感謝吧！我將免費為你鑑\n定物品。",
    "en": "74\nAs a token of my gratitude, I will \nidentify items for you at no charge."
  },
  "A1Q5InitQuestTome": {
    "zh": "36\n...所以它是有意圖去找女伯爵的，那個曾經\n想用處女的鮮血來返老還童，被活埋的女\n子...而且她的城堡在各種殘暴的行為下，很\n快的崩塌成為一個廢墟。一個人跡罕至的\n高塔豎立在諸神遺忘的荒野上面，像是某\n種邪惡的紀念碑。\n \n女伯爵的財富相信是由神職人員所瓜分，\n雖然有些財富仍然沒有被找出來，仍然埋\n藏在腐朽的骷髏身邊，這些是唯一目睹城\n堡中不人道行為的無聲見證者。",
    "en": "36\n...And so it came to pass that the \nCountess, who once bathed in the \nrejuvenating blood of a hundred \nvirgins, was buried alive... And her \ncastle in which so many cruel deeds \ntook place fell rapidly into ruin. Rising \nover the buried dungeons in that \ngod-forsaken wilderness, a solitary \ntower, like some monument to Evil, is \nall that remains.\n \nThe Countess' fortune was believed to \nbe divided among the clergy, although \nsome say that more remains unfound, \nstill buried alongside the rotting skulls \nthat bear mute witness to the \ninhumanity of the human creature."
  },
  "A1Q6SuccessfulCain": {
    "zh": "38\n這是個偉大的勝利，但是面前還有更多的\n戰鬥在等著。我會在你的旅程中與之為伴，\n儘我可能的提供協助... \n \n記住...暗黑破壞神還是在外面游走，在沙漠\n中找尋一些我們不知道的東西。直到你們\n找到他正在搜尋的東西之前，我很害怕這\n個惡夢永遠不會結束。",
    "en": "38\nThis is a great victory indeed, but many \nmore battles await. I will accompany \nyou on your journey, lending what \nassistance I can... \n \nRemember... Diablo is still out there, \nseeking something in the desert. I'm \nafraid that this nightmare will not end \nuntil you find what it is that he seeks."
  },
  "A2Q1SuccessfulAtma": {
    "zh": "50\n他們說復仇的味道嚐起來苦樂參半，但是\n我覺得我還蠻喜歡的。\n \n除了我永久的感謝之外，我已經把你的義\n行告訴其他的鎮民。商人們都同意表達他\n們的感謝，讓你以最低的折扣購買他們的\n貨物。\n \n噢...杰海因也想要見見你。你可以在皇宮的\n前面找到他。",
    "en": "50\nThey say that the taste of vengeance is \nbittersweet, but I find it to my liking. \n \nIn addition to my undying gratitude, I \nhave spoken on your behalf with the \nrest of the townspeople. The \nmerchants have agreed to show their \ngratitude by offering their wares and \nservices at lower rates.\n \nOh... Jerhyn wants to see you, too. \nYou'll find him in front of the palace."
  },
  "A2Q2SuccessfulStaffCain": {
    "zh": "46\n太棒了！你現在擁有赫拉迪克之杖了。\n \n帶著它前往塔．拉夏的墓地，在裡面找到\n一個房間，地面鑲著七個符號的圓環。把\n木杖放在那個地方的插槽中，這樣就可以\n打開通往塔．拉夏的埋骨之處。\n \n但是，你得準備迎接一場戰鬥-你很可能要\n殺死塔．拉夏，才能夠摧毀巴爾。",
    "en": "46\nExcellent! You have a Horadric Staff.\n \nCarry it with you into Tal Rasha's Tomb. \nFind within the Tomb the chamber \nwhose floor is inset with the Circle of \nSeven Symbols.\n \nPlace the Staff into the receptacle you \nfind there. That will open the secret \npassage into Tal Rasha's Burial \nChamber.\n \nBut, be prepared for a fight - you'll \nlikely have to kill Tal Rasha to destroy \nBaal."
  },
  "A2Q6SuccessfulJerhyn": {
    "zh": "48\n你做得很好，能夠走到這一步的人的確不\n多，尤其是找到塔．拉夏的古墓。不幸的\n是，我聽說暗黑破壞神和巴爾已經擺脫了\n你們的掌握，這是最不幸的事情...\n \n如果你們想要繼續往東走，我已經授權給\n馬席夫讓他帶你們穿越海洋。我可以想像\n他已經非常急迫的想要出航。\n \n祝你的任務好運，並且感謝你再度拯救了\n我摰愛的城市。你在魯．高因會永遠受到\n我們的歡迎，朋友。",
    "en": "47\nYou have done very well. Few could have \ncome this far, let alone discover the \nTrue Tomb of Tal Rasha. Unfortunately, \nI hear that Diablo and Baal have eluded \nyour grasp. This is most unfortunate...\n \nIf you wish to travel East, I have \nauthorized Meshif to give you passage \nby sea. I imagine he should be very \nanxious to leave by now.\n \nGood luck on your quest, and thank you \nagain for saving my beloved city. You \nwill always be welcome in Lut Gholein, \nmy friend."
  },
  "A3Q1SuccessfulAlkor": {
    "zh": "83\n你找到書了！它應該可以讓我們更瞭解罪\n惡之源的真正面孔...\n \n啊，但是對你來說...",
    "en": "83\nYou have found the Book! It should give \nall of us here some insight into the \nnature of the Prime Evils...\n \nAh, but as for you..."
  },
  "A3Q2SuccessfulCain": {
    "zh": "54\n盛氣凌人的大成功，英雄！你已經把克林\n姆的意志實體化了。使用它摧毀強制球體，\n就可以打開通往墨菲斯托的通路。願真正\n的光明導引著你的道路。",
    "en": "54\nMasterfully done, hero! You have \ncrafted Khalim's Will. Employ it to \ndestroy the Compelling Orb and open \nthe way to Mephisto. \n \nMay the true Light guide your way."
  },
  "A3Q3SuccessfulOrmus": {
    "zh": "41\n你做得很好，高貴的英雄，奧瑪斯在此向\n你致意。史卡辛的古老靈魂會因為你送回\n了這把聖刀而看護著你。現在，在經過了\n這麼多年之後，奧瑪斯將再度使用它的力\n量，從黑暗的陰影中保護無辜之人。保護\n港灣的力量現在已經全面強化了。",
    "en": "41\nYou have done well, noble hero. Ormus \ncongratulates you. The old spirits of \nSkatsim will watch over you for \nreturning their sacred blade.\n \nNow, after all these years, Ormus will \nonce again use his powers to protect \nthe innocent from the shadow. The \nspell that protects the dockside shall \nnow be reinforced."
  },
  "A4Q1InitTyrael": {
    "zh": "有一個黑暗、飽受折磨的靈魂，在很久以前就被困在這個被遺忘的世界中。人們稱它為衣卒爾，而隨著時間的流逝，他成為我最信任的左右手。接下來他違背了我的意願，領導一次注定失敗的突擊行動，目標是火紅的地獄熔爐。雖然他有著英勇和力量，衣卒爾仍被罪惡之源所捕獲，並利用他們邪惡的力量轉變他的心智。他們逼他背叛他自己，並吐露許多天堂之中最機要的秘密。他成為他自己墮落的影子，一個不被天堂也不被地獄信任的墮落天使。由於他的罪，衣卒爾的靈魂被困在一個外型可怖，從虛無召喚出來的生物之中。他的瘋狂靈魂留在這個飽受折磨的外殼之中，已經有很長的一段時間了。對我而言，他已經受了夠久的痛苦了。我懇求你找到衣卒爾，並讓他從可怖的囚禁之中釋放出來。把他的罪惡和痛苦劃上休止符吧。",
    "en": "There is a dark, tortured soul who was trapped within this forsaken realm long ago. He was called Izual by mortal men, and in ages past he was my most trusted Lieutenant. Yet, against my wishes he led an ill-fated assault upon the fiery Hellforge, itself. Despite his valor and strength, Izual was captured by the Prime Evils and twisted by their perverse power. They forced him to betray his own kind and give up Heaven's most guarded secrets. He became a corrupt shadow of his former self - a fallen angel trusted neither by Heaven nor Hell. For his transgressions, Izual's spirit was bound within the form of a terrible creature which was summoned from the Abyss. His maddened spirit has resided within that tortured husk for many ages now. It seems to me that he has suffered long enough. I implore you, hero, find Izual and release him from his cruel imprisonment. Put an end to his guilt and suffering."
  },
  "A4Q1SuccessfulIzual": {
    "zh": "47\n泰瑞爾是個信任我的笨蛋！\n \n你看，我就是那個告訴暗黑破壞神和他的\n兄弟，有關靈魂之石和如何摧毀它的人！\n就是我幫助罪惡之源，策畫出如何把他們\n的靈魂放逐到你們的世界之中！\n \n這個計畫啟動的時間太長久，任何人類都\n無法加以阻止。地獄必須對你們世界溢出\n潮水般的鮮血及惡夢，才能夠獲得平衡！\n\n \n你和所有你的種族...將全面毀滅。",
    "en": "47\nTyrael was a fool to have trusted me!\n \nYou see, it was I who told Diablo and his \nBrothers about the Soulstones and how \nto corrupt them. It was I who helped \nthe Prime Evils mastermind their own \nexile to your world.\n \nThe plan we set in motion so long ago \ncannot be stopped by any mortal \nagency.  Hell, itself, is poised to spill \nforth into your world like a tidal wave \nof blood and nightmares.\n \nYou and all your kind... are doomed."
  },
  "A4Q1SuccessfulTyrael": {
    "zh": "感謝你，英雄，讓衣卒爾飽受折磨的靈魂得到休息。願光明保護你，而天堂之光導引著你們的道路。但是，如果你告訴我的事情屬實，那麼，我怕我們一直都被玩弄在股掌之上。衣卒爾幫助了暗黑破壞神以及他的兄弟，騙我使用靈魂之石來對抗他們...現在石塊的力量已經受到污染了。靠著融合靈魂之石後所取得的力量，罪惡之源可以把人類的世界，轉換成地獄的前哨站！",
    "en": "Thank you, hero, for putting Izual's tortured spirit to rest. May the Light protect you and the powers of Heaven shine upon your path. But, if what you tell me is true, then I fear that we have been played for fools all along. Izual helped Diablo and his Brothers trick me into using the Soulstones against them... Now the Stones' powers are corrupted. With the combined powers of the Soulstones under their control, the Prime Evils will be able to turn the mortal world into a permanent outpost of Hell!"
  },
  "A4Q2ExpansionSuccessCain": {
    "zh": "我就知道你潜力非凡，我的朋友。你完成了一项伟大的壮举。虽然我的先祖世代与三大罪恶之源及其爪牙抗争，但我一生都过着闭门治学的学者生活。很高兴我的知识能助你一臂之力。现在，我想离开这个地方了。尽管天堂之门壮丽非凡，但我希望很多很多年都不用再见到它了。快去和泰瑞尔谈谈，让我们离开这里吧！",
    "en": "I knew there was great potential in you, my friend. You've done a fantastic job. Though my ancestors often struggled against the Three Evils and their minions, I've always lived a shut-in, scholarly life. I'm glad that my wisdom aided you. Now, I wish to leave this place. Though Heaven's Gates are a marvel to behold, I hope I won't have to see them again for many, many years. Please talk to Tyrael about leaving this place now!"
  },
  "A4Q2ExpansionSuccessTyrael": {
    "zh": "赞美圣光！你完成了几乎不可能的壮举！暗黑破坏神与墨菲斯托已被放逐回孕育他们的黑暗深渊，被污染的灵魂之石也已彻底粉碎。然而，当你在地狱奋战之时，巴尔却留在了凡间，集结了一支庞大的地狱大军。如今，巴尔的军团正四处搜寻世界之石——所有灵魂之石及其力量的远古本源，沿途只留下一片毁灭。他们已经深入野蛮人的故土，直扑亚瑞特山的巅峰！凡人英雄，巴尔已经知道了！那里正是神圣世界之石的所在地！现在，踏入我为你开启的传送门吧。它将把你送往野蛮人要塞哈洛加斯——亚瑞特山坡上秩序的最后堡垒。",
    "en": "Praise be to the Light! You have accomplished the impossible! Diablo and Mephisto have been banished back into the Black Abyss that spawned them, and the corrupted Soulstones are no more. However, while you were fighting here, Baal remained behind in the mortal realm, building an army of hellish minions. Now, Baal's army is searching for the Worldstone, the ancient source of all the Soulstones and their power, while leaving behind a wake of destruction. They have forged deeply into the Barbarian homelands, heading directly for the summit of Mount Arreat! Baal knows, mortal hero! That is the very site of the blessed Worldstone! Now, enter the portal I have opened for you. It will take you to the Barbarian city of Harrogath, the last bastion of Order on the slopes of Arreat."
  },
  "A4Q2InitTyrael": {
    "zh": "該是獵殺並摧毀暗黑破壞神的時候了。但你得小心，恐怖之王並不容忽視。他幾乎只用單手就摧毀了崔斯特瑞姆，並讓尊貴而試著阻止他的英雄墮落並為他所用。這一次，你必須永遠地摧毀他。只有摧毀他身上的靈魂之石，才能永遠的放逐他的靈魂。祝你好運。雖然這可能是我們最黑暗的時刻，但是也可能是你最光榮的瞬間！",
    "en": "The time has come to hunt down and destroy Diablo, himself. But beware, the Lord of Terror is not to be underestimated. He single-handedly destroyed the town of Tristram and corrupted the last noble hero who tried to stop him. This time, you must defeat him for good. Only by destroying the Soulstone which he carries will his spirit be banished forever. Good luck! Though this be our darkest hour, it may yet be your greatest moment."
  },
  "A4Q2SuccessfulTyrael": {
    "zh": "光明的美讚！你完成了不可能的事情！暗黑破壞神和墨菲斯托已經被放逐到當年他們誕生的黑暗地獄深淵，而墮落的靈魂之石也不復存在。你做的非常好，英雄。現在，你可以歡慶和平了。",
    "en": "Praise be to the Light! You have accomplished the impossible! Diablo and Mephisto have been banished back into the Black Abyss that spawned them and the corrupted Soulstones are no more. You've done well, hero. For now, you should rejoice."
  },
  "A4Q3InitHasStoneCain": {
    "zh": "該是你摧毀墨菲斯托靈魂之石的時候了！拿著石塊前往地獄熔爐，把它放在熔爐上面並大力的使用鐵鎚敲擊。只有這樣做才能夠阻止墨菲斯托再度出現於這個世界之中。",
    "en": "The time has come for you to destroy Mephisto's Soulstone! Take the Stone to the Hellforge. Place it upon the forge and strike it soundly with the Hammer. Only by doing this can you prevent Mephisto from manifesting in this world ever again."
  },
  "A4Q3InitNoStoneCain": {
    "zh": "該你是摧毀墨菲斯托靈魂之石的時候了！雖然我在進入地獄之門以前就拿過它，但我相信只有你才能進行這個決定性的任務。拿著石塊前往地獄熔爐，把它放在熔爐上面並大力的使用鐵鎚敲擊。只有這樣做才能夠阻止墨菲斯托再度出現於這個世界之中。",
    "en": "The time has come to destroy Mephisto's Soulstone! Although I picked it up before entering the Infernal Gate, I believe you should carry out this crucial mission. Take the Stone to the Hellforge. Place it upon the forge and strike it soundly with the Hammer. Only by doing this can you prevent Mephisto from manifesting in this world ever again."
  },
  "A4Q3SuccessfulCain": {
    "zh": "恭喜你，英雄！當然了...即使是暗黑破壞神本身，也可以感受到你打碎他兄弟的靈魂之石後，所釋放出來的怒氣。",
    "en": "Congratulations, hero! Surely, even Diablo, himself, sensed the fury unleashed when you smashed his Brother's Soulstone."
  },
  "A5Q1AfterInitAnya": {
    "zh": "84\n你已经证明了自己解救弱女子的本事……但不知你斩杀凶残魔物的本领又如何呢？\n",
    "en": "84\nYou've proven your skill at rescuing fair \nmaidens...but how are you at killing \nvicious beasts?\n"
  },
  "A5Q1AfterInitCain": {
    "zh": "83\n我认为，解除哈洛加斯之围是你赢得这里族人信任的唯一途径。\n",
    "en": "83\nI believe that stopping the siege on \nHarrogath is the only way for you to \nearn the trust of these people.\n"
  },
  "A5Q1AfterInitLarzuk": {
    "zh": "150\n呃……我刚才提到城外有投石车了吗？\n",
    "en": "150\nUh...Did I mention there were catapults?\n"
  },
  "A5Q1AfterInitMalah": {
    "zh": "77\n夸尔凯克和他的部下为了打破围城已经苦战多时。在众多勇士折戟之处，或许你能取得成功。\n",
    "en": "77\nQual-Kehk and his men have been \nfighting to break the siege for some \ntime. Where many have failed, you may \nsucceed.\n"
  },
  "A5Q1AfterInitNihlathak": {
    "zh": "70\n在那么多勇士阵亡之后，你凭什么以为自己能做到我们骄傲的战士都没能做到的事？\n",
    "en": "70\nAfter so many have died, who are you \nto think you can accomplish what our \nproud warriors could not?\n"
  },
  "A5Q1AfterInitQualKehk": {
    "zh": "66\n打算去迎战督军山克、解除围城了吗？外乡人，出发前你最好先请玛拉为你做个临终祷告。\n",
    "en": "66\nAbout to face Shenk the Overseer and \nstop the siege, are you? You should \nask Malah to perform your last rites \nbefore you go, stranger.\n"
  },
  "A5Q1EarlyReturnAnya": {
    "zh": "66\n在你抵达之前，那些恶魔就已经盘踞在城外了。难道你也没办法阻止它们吗？\n \n勇士，你的任务很简单：找到山克，然后消灭他。\n",
    "en": "66\nThose demons have been out there \nsince before your arrival. Can you do \nnothing to stop them?\n \nYour task is a simple one, warrior. Find \nShenk and destroy him.\n"
  },
  "A5Q1EarlyReturnCain": {
    "zh": "105\n我理解你的顾虑，但现在正是出击的时刻。\n",
    "en": "105\nI understand your reluctance, but now \nis the time to strike.\n"
  },
  "A5Q1EarlyReturnLarzuk": {
    "zh": "90\n怎么了，英雄？开始怀疑自己的勇气了吗？反正我们是挺怀疑的。\n",
    "en": "90\nWhat's the matter, hero? Questioning \nyour fortitude? I know we are.\n"
  },
  "A5Q1EarlyReturnMalah": {
    "zh": "64\n这话听起来或许算不上什么鼓励，但比起其他走出那道城门的人，你的表现已经好太多了。\n \n至于督军山克，请记住：没有了士卒的将军什么都不是。\n",
    "en": "64\nThis may not be very encouraging, but \nyou have fared better than the others \nwho passed through those gates.\n \nIn regards to Shenk the Overseer, \nremember: a general is nothing without \nhis men.\n"
  },
  "A5Q1EarlyReturnNihlathak": {
    "zh": "78\n你还留在这里干什么？我还以为你已经出城送死了呢。\n \n快去吧……动作利索点。\n",
    "en": "78\nWhat are you still doing here? I thought \nyou were going off to die.\n \nGo...Be quick about it.\n"
  },
  "A5Q1EarlyReturnQualKehk": {
    "zh": "93\n噢，你还活着。看来你不是身手敏捷，就是个胆小鬼。\n",
    "en": "93\nSo, you still live. You're either quick or a \ncoward.\n"
  },
  "A5Q1InitLarzuk": {
    "zh": "45\n如果你是为了击败巴尔而来，就必须先证明你的实力！\n \n就在我们交谈之际，哈洛加斯正遭受巴尔恶魔大军的围攻，投石车在城墙外降下死亡的火雨。\n \n巴尔本人已经向圣山进发，留下他最凶残的将领之一——督军山克坐镇指挥。这个冷酷无情的监工在战场上鞭笞着自己的爪牙，驱使它们发起自杀式的疯狂冲锋。\n \n如果你想向我们证明自己，就去消灭在哈洛加斯城外指挥那些地狱投石车的魔头山克。要是你能办到，再回来见我。\n",
    "en": "45\nIf you're here to defeat Baal, you must \nprove it!\n \nAs we speak, Harrogath is under siege \nby Baal's demons. Catapults rain death \njust outside the town walls.\n \nBaal himself travels up the sacred \nmountain, having left in charge here \none of his most vicious generals, Shenk \nthe Overseer. A ruthless taskmaster, \nhe lashes his own minions into suicidal \nfrenzies on the battlefield.\n \nIf you wish to prove yourself to us, \ndestroy the monster, Shenk, that \ncommands those infernal catapults \noutside Harrogath.  If you manage to \ndo this, return to me.\n"
  },
  "A5Q1SuccessfulAnya": {
    "zh": "108\n我刚才还在想，你到底要花多长时间才能解决那些魔物呢。\n \n干得漂亮。\n",
    "en": "108\nI was starting to wonder how long it \nwould take you to stop those beasts.\n \nGood job.\n"
  },
  "A5Q1SuccessfulCain": {
    "zh": "60\n那些地狱投石车真是闻所未闻。我的朋友，你虽然战胜了山克，但巴尔依然走在你前头很远的地方。\n",
    "en": "60\nThose catapults were like nothing I have \never seen before. You have prevailed \nagainst Shenk, my friend, but Baal is \nstill far ahead of you.\n"
  },
  "A5Q1SuccessfulLarzuk": {
    "zh": "63\n你比我预想的还要强大得多……抱歉我之前低估了你。\n \n为了表达我的谢意，我会为你选定的一件装备凿出凹槽；而且从今往后，我这里所有的商品都会给你最优惠的价格。\n",
    "en": "63\nYou're an even greater warrior than I \nexpected...Sorry for underestimating \nyou.\n \nAs a token of my appreciation, I will \ncraft sockets into an item of your \nchoosing, and from now on, you'll get \nthe best price for all my wares.\n"
  },
  "A5Q1SuccessfulMalah": {
    "zh": "94\n啊……围城终于解除了。你真是一位救苦救难的天使。\n \n谢谢你。\n",
    "en": "94\nOh...At last, the siege is ended. You \ntruly are an angel.\n \nI thank you.\n"
  },
  "A5Q1SuccessfulNihlathak": {
    "zh": "65\n外乡人，仅仅解除围城可没法让你立刻赢得尊重。\n \n唯有牺牲才能换来敬意——而我敢肯定，你对牺牲一无所知。\n",
    "en": "65\nEnding the siege does not earn \nimmediate respect, outsider.\n \nRespect only comes with sacrifice -- \nsomething I'm sure you know nothing \nof.\n"
  },
  "A5Q1SuccessfulQualKehk": {
    "zh": "68\n原来如此……你真的设法解除了围城。\n \n你的实力远超我的预料。你当之无愧地赢得了我的敬意。\n",
    "en": "68\nSo...You managed to stop the siege.\n \nYou are more powerful than I gave you \ncredit for. You have rightfully earned \nmy respect.\n"
  },
  "A5Q2AfterInitAnya": {
    "zh": "85\n如果那些士兵遭受着和我当初一样的折磨，你就必须尽快找到他们，他们撑不了多久了。\n",
    "en": "85\nIf those men are being treated like I \nwas, you must find them. They won't \nsurvive much longer.\n"
  },
  "A5Q2AfterInitCain": {
    "zh": "74\n我亲身经历过被囚禁的滋味，那对任何人而言都是悲惨的命运。快去找到他们吧。\n",
    "en": "74\nI know firsthand that captivity is a sad \nfate for a man. Find them quickly.\n"
  },
  "A5Q2AfterInitLarzuk": {
    "zh": "73\n夸尔凯克部下所用的刀剑和盔甲都是我亲手打造的。他们情同我的手足，我无法想象他们正在遭受怎样的痛苦。\n \n请一定要救出他们！\n",
    "en": "73\nI crafted the swords and armor for \nQual-Kehk's men. They were like \nbrothers to me. I can't imagine the pain \nthey must be suffering.\n \nSave them if you can!\n"
  },
  "A5Q2AfterInitMalah": {
    "zh": "84\n夸尔凯克的部下已经被囚禁了一段时间，肯定已经疲惫虚弱到了极点。\n \n把他们放出来之后，你一定要护送他们安全离开。\n",
    "en": "84\nQual-Kehk's men have been imprisoned \nfor some time. They are certain to be \ntired and weak.\n \nYou must protect them once you free \nthem.\n"
  },
  "A5Q2AfterInitNihlathak": {
    "zh": "94\n勇士，你已经证明了自己懂得如何夺取性命，但你懂得如何拯救性命吗？\n",
    "en": "94\nYou have proven you can take life, \nwarrior, but can you save it as well?\n"
  },
  "A5Q2AfterInitQualKehk": {
    "zh": "85\n那些侥幸逃回来的部下告诉我，俘虏们被关押在冰冻高地与高原一带。\n",
    "en": "85\nThose of my men fortunate enough to \nescape on their own told me that they \nwere held captive in the highlands and \nplateaus.\n"
  },
  "A5Q2EarlyReturnAnya": {
    "zh": "115\n既然你能在圣山上找到我，我相信你也一定能找到他们。\n",
    "en": "115\nWell, you found me on the mountain; I'm \nsure you'll find them too.\n"
  },
  "A5Q2EarlyReturnCain": {
    "zh": "63\n如果你在寻找夸尔凯克的士兵时遇到困难，不妨去问问玛拉。之前逃回来的士兵都是她救治的，或许她能给你一些建议。\n",
    "en": "63\nIf you are having trouble finding \nQual-Kehk's soldiers, you should talk to \nMalah. She healed those who made it \nback before. Perhaps she would have \nsome advice.\n"
  },
  "A5Q2EarlyReturnLarzuk": {
    "zh": "76\n我小时候常在山上的路障工事间玩打仗游戏。想要穿过那片迷宫般的围墙可绝非易事。\n",
    "en": "76\nAs a kid, I used to play soldier among \nthe barricades on the mountain. \nThere's no easy way through that maze \nof walls.\n"
  },
  "A5Q2EarlyReturnMalah": {
    "zh": "67\n逃回来的士兵提到山道间布有一片路障工事群，他们说俘虏们就被关押在那里。\n",
    "en": "67\nSoldiers who made it back told of a \nsystem of barricades placed among the \nmountain passes. They said that is \nwhere the prisoners are held.\n"
  },
  "A5Q2EarlyReturnNihlathak": {
    "zh": "52\n你有没有停下来想过，那些恶魔为什么要抓走夸尔凯克的部下？它们为什么要进攻我们？你考虑过巴尔打这座圣山的什么主意吗？\n \n不，你根本没想过。你根本不知道自己面对的是什么。\n",
    "en": "52\nDid you ever stop to think why these \ndemons are capturing Qual-Kehk's \nmen? Why they are attacking us? Have \nyou considered what Baal wants with \nthe mountain?\n \nNo. You've not. You have no idea what \nyou are dealing with.\n"
  },
  "A5Q2EarlyReturnQualKehk": {
    "zh": "95\n俗话说谨慎是勇敢的美德，但拖延可不是。\n",
    "en": "95\nThey say that discretion, not \nprocrastination, is the better part of \nvalor.\n"
  },
  "A5Q2EarlyReturnQualKehkMan": {
    "zh": "78\n外面肯定还有更多我的部下活着，我对此深信不疑！\n \n找到他们，把他们从牢笼里解救出来，带回我身边。\n",
    "en": "78\nMore of my men are still alive out there. \nI am certain of it!\n \nFind them. Free them from their cages \nand bring them back to me.\n"
  },
  "A5Q2InitQualKehk": {
    "zh": "58\n现在我最挂心的是那些在战场上被巴尔恶魔俘虏的部下。我简直不敢想象他们正遭受怎样的折磨。\n \n当你向山上进发时，请留意寻找我的士兵，尽可能把他们安全带回来。\n",
    "en": "58\nMy concerns have turned to my men \ntaken prisoner on the battlefield by \nBaal's demons. I hate to think what's \nhappened to them.\n \nAs you journey up the mountain, keep \nyour eyes open for my soldiers and \nbring them back to me if you can.\n"
  },
  "A5Q2SuccessfulAnya": {
    "zh": "107\n我相信那些士兵一定和我一样，衷心感激你赐予他们的自由。\n",
    "en": "107\nI'm sure those men appreciate the \nfreedom you gave them...as much as I \ndo.\n"
  },
  "A5Q2SuccessfulCain": {
    "zh": "80\n我的朋友，你已经成为这座城镇的英雄了。自从你把光明带到哈洛加斯，笼罩此地的阴霾便消散了许多。\n",
    "en": "80\nYou've become a hero to this town, my \nfriend. The shadows have lifted ever \nsince you brought the Light to \nHarrogath.\n"
  },
  "A5Q2SuccessfulLarzuk": {
    "zh": "55\n自从你来到这里，凯恩就经常讲起你在南方诸国的壮举——击败墨菲斯托与暗黑破坏神。起初我还对他的故事嗤之以鼻，但如今每过一天，我就越发相信所言非虚。\n",
    "en": "55\nSince your arrival, Cain has spoken of \nyour deeds in the Southern Kingdoms, \ndefeating both Mephisto and Diablo. At \nfirst, I scoffed at his tales, but I'm \nfinding them more believable with every \npassing day.\n"
  },
  "A5Q2SuccessfulMalah": {
    "zh": "73\n你鼓舞了全城的族人——不仅是那些被你解救的士兵，还有所有受过你帮助的人。\n",
    "en": "73\nYou have inspired the people in this \ntown -- not only those you rescued, but \nthose you've helped in other ways as \nwell.\n"
  },
  "A5Q2SuccessfulNihlathak": {
    "zh": "72\n哟，你把迷途的羔羊带回牧羊人身边了。干得不错嘛。\n",
    "en": "72\nSo. You brought the lost sheep home to \nthe shepherd. Well done.\n"
  },
  "A5Q2SuccessfulQualKehk": {
    "zh": "51\n感谢你救出了我的部下。他们对你在战场上的英勇赞不绝口。或许我们终究还有一线希望。\n \n如果你愿意，可以雇佣我那些被你救回来的野蛮人战士。另外，请收下这套符文。我原本打算把它们镶在一面带孔的盾牌上，但我想它们在你手里能发挥更大的作用。\n \n请务必按照正确的顺序镶嵌它们，以激发最完整的力量。\n",
    "en": "51\nThank you for rescuing my men. They \nhave spoken well of your bravery in \nbattle. Perhaps there is hope for us \nafter all. \n \nIf you wish, you may hire some of my \nmercenaries that you saved. And \nplease...take this set of runes. I had \nbeen saving them for a socketed shield, \nbut I think you'll make better use of \nthem.\n \nBe sure to set them in the right order \nfor their fullest effect.\n"
  },
  "A5Q3AfterInitCain": {
    "zh": "59\n我建议你听从玛拉的忠告。尼拉塞克言辞刻薄，而且表现得仿佛全城的存亡都系于他一人之身。\n \n或许这里隐藏着某些我们尚不知晓的阴谋。\n",
    "en": "59\nI would listen to Malah. Nihlathak \nspeaks with a venomous tongue and \nacts as if the entire weight of this town \nrests upon his shoulders.\n \nPerhaps there is more going on here \nthan we know.\n"
  },
  "A5Q3AfterInitLarzuk": {
    "zh": "57\n安雅是一位才华横溢的炼金术士，何况她还那么年轻。在我认识她的岁月里，从来没有任何事能阻止她追求自己坚信的正道。\n \n我毫不怀疑尼拉塞克与此事有关。自从她父亲去世后，他们两人就一直水火不容。\n",
    "en": "57\nAnya is an amazing alchemist, \nespecially for her young age. As long \nas I've known her, she's never let \nanything stop her from pursuing what \nshe believed in. \n \nI wouldn't doubt that Nihlathak is \ninvolved. Ever since her father died, \nthey haven't gotten along.\n"
  },
  "A5Q3AfterInitMalah": {
    "zh": "94\n和尼拉塞克交谈时务必小心，谁也说不准他会说出什么话、做出什么事来。\n",
    "en": "94\nWhen you talk to Nihlathak, be careful. \nThere is no telling what he will say or \ndo.\n"
  },
  "A5Q3AfterInitNihlathak": {
    "zh": "41\n安雅！你到底听谁胡说了些什么？八成又是那个多管闲事的玛拉。\n \n好吧，我来告诉你真相。安雅在幻觉中看到她的母亲和幼弟被困在冰雪洞窟彼端的荒原，于是跑来向我请教，并决意亲自前去营救。\n \n我劝她不要做这种愚蠢的尝试，留在城墙之内才最安全。但她是个任性的丫头，根本听不进我的劝告。\n \n第二天一早她就不见了。失去她之后，没有任何人比我更痛心疾首。\n \n不过，如果你非要给玛拉当跑腿的童子，我也不会拦着你。\n",
    "en": "41\nAnya! Who have you been talking to? \nLikely it was that meddling Malah. \n \nWell, I'll tell you what really happened. \nAnya came to me for guidance, after \nreceiving a vision that her mother and \nyounger brother were trapped in the \nlands beyond the Ice Caves. She had \ndecided to go rescue them. \n \nI told her that her quest was a foolish \none and that she would be safer \nstaying within the city walls. However, \nshe is a willful girl and would not listen \nto me. \n \nThe next morning, she was gone. No \none is more distraught than I over \nlosing her. \n \nHowever, if you feel the need to be \nMalah's errand child, I won't try to stop \nyou.\n"
  },
  "A5Q3AfterInitQualKehk": {
    "zh": "43\n安雅的父亲奥斯特曾是我们最睿智的长老。他与其他长老一同在守护城市的结界仪式中献出了生命。那道结界虽将巴尔的恶魔挡在哈洛加斯城外，却也付出了惨痛的牺牲。\n \n反观尼拉塞克，却是唯一从恶魔手中逃脱的长老。当其他长老纷纷倒在他身旁时，不知怎的，唯独他一人逃出生天。\n \n从那天起，尼拉塞克和安雅便结下了梁子。\n",
    "en": "43\nAnya's father, Aust, was our wisest \nElder. He was killed along with the \nother Elders who erected the ward that \nprotects this city. The ward has kept \nBaal's demons out of Harrogath, but at \na costly sacrifice. \n \nNihlathak, on the other hand, was the \nonly Elder to escape the demons. \nSomehow, he alone managed to find \nsanctuary, while the others died \naround him.\n \nEver since that day, Nihlathak and Anya \nhave been at odds.\n"
  },
  "A5Q3EarlyReturnCain": {
    "zh": "60\n结合我所听闻的安雅的性格，尼拉塞克的说法听起来似乎合情合理。然而，最高明的谎言往往就隐藏在半真半假之中。\n",
    "en": "60\nNihlathak's story does sound \nreasonable, considering what I've \nheard about Anya. However, the best \nlies are often hidden within truth.\n"
  },
  "A5Q3EarlyReturnLarzuk": {
    "zh": "56\n作为奥斯特长老的女儿，除了尼拉塞克之外，全城只有安雅真正知晓亚瑞特山的秘密。我可不愿看到我们的命运完全掌握在尼拉塞克一人手里。\n",
    "en": "56\nAs the daughter of Elder Aust, Anya is \nthe only person, besides Nihlathak, \nwho has any real knowledge of Mount \nArreat's secrets. I'd hate to see our \nfate in the hands of Nihlathak alone.\n"
  },
  "A5Q3EarlyReturnMalah": {
    "zh": "52\n如果换作旁人，我或许会以为她已经遇害。但安雅绝不会轻易屈服，我深信她一定还活着。\n",
    "en": "52\nIf it were anyone else, I would assume \nher dead. However, Anya is not so \neasily beaten. I know she must be alive.\n"
  },
  "A5Q3EarlyReturnNihlathak": {
    "zh": "46\n听着，我已经告诉过你了！她已经死了！如果你识相的话，就该把精力集中在保卫哈洛加斯上——而不是浪费在安雅这种毫无希望的事情上。\n",
    "en": "46\nLook, I've told you! She's dead! If you \nknew what was good for you, you'd \nconcentrate your efforts on saving \nHarrogath -- not on lost causes like \nAnya.\n"
  },
  "A5Q3EarlyReturnQualKehk": {
    "zh": "81\n看来人人都觉得尼拉塞克与安雅的失踪脱不了干系。\n \n他为什么要做出这种事呢？\n",
    "en": "81\nIt seems like everyone feels Nihlathak \nplayed a part in Anya's disappearance.\n \nWhy would he do such a thing?\n"
  },
  "A5Q3FoundAnyaAnya": {
    "zh": "50\n英雄，是尼拉塞克害我落得这般境地！\n \n如果你是来救我的，我唯一的希望就在玛拉身上了。\n \n求求你……快去告诉她你找到我了……\n",
    "en": "50\nHero. Nihlathak did this to me!\n \nIf you've come to help me, my only hope \nlies with Malah.\n \nPlease...Tell her you've found me...\n"
  },
  "A5Q3FoundAnyaCain": {
    "zh": "54\n天哪！安雅竟然被尼拉塞克那个堕落的叛徒冰封了……我虽然束手无策，但玛拉或许有办法帮你。\n",
    "en": "54\nGoodness! Anya frozen by that fallen \nBarbarian, Nihlathak...Perhaps Malah \ncan help you where I cannot.\n"
  },
  "A5Q3FoundAnyaLarzuk": {
    "zh": "80\n可怜的安雅！我早该看出尼拉塞克是个叛徒……\n \n要是你撞见他活着，替我宰了他！\n",
    "en": "80\nPoor Anya! I should've known Nihlathak \nwas a traitor...\n \nIf you find him alive, kill him for me!\n"
  },
  "A5Q3FoundAnyaMalah": {
    "zh": "56\n果然！尼拉塞克这条毒蛇就是安雅失踪的幕后黑手……他竟用冰封诅咒困住了她。\n \n拿着，把这瓶解冻药剂带去给安雅服下，应该就能解除她身上的寒冰诅咒。\n",
    "en": "56\nSo! That snake Nihlathak was behind \nAnya's disappearance...and he trapped \nher with a freezing curse.\n \nHere. Take this potion to Anya and give \nit to her. That should release her.\n"
  },
  "A5Q3FoundAnyaQualKehk": {
    "zh": "70\n那条毒蛇从我们眼皮底下溜走了！趁你外出的时候，尼拉塞克失踪了。\n \n我敢打赌安雅一定知道怎么追查他的下落。\n",
    "en": "70\nThe snake has slipped our grasp! While \nyou were gone, Nihlathak disappeared.\n \nI'll bet Anya knows how to track him \ndown.\n"
  },
  "A5Q3InitMalah": {
    "zh": "43\n有一件事我本不愿轻易启齿，但我相信现在只有你能帮我了。\n \n年轻的炼金术士安雅——我们一位遇害长老的女儿——已经失踪一段时间了。她是个坚强而聪慧的姑娘，有着非凡的勇气。\n \n就在你抵达前不久的一个夜晚，我无意中听到她和尼拉塞克就她父亲的死因发生了激烈争执。第二天清晨，她就不见了踪影。\n \n关于她的去向和原因，尼拉塞克有一套自己的说辞。千万别信他的鬼话！我担心正是他一手造成了安雅的失踪。\n \n求求你，如果可以的话，请寻找安雅并把她带回我们身边。她一定知道该如何处置尼拉塞克。\n",
    "en": "43\nThere is a matter which I hesitate to \nshare, but I believe you are the only \none who can help me now.\n \nAnya, the young alchemist and \ndaughter to one of our slain Elders, \nhas been missing for some time. She is \na strong, crafty woman with a spirit \nlike no other.\n \nOne night, just before your arrival, I \noverheard her and Nihlathak arguing \nabout her father's death. The next \nmorning she was gone.\n \nNihlathak has his own tale as to where \nshe went and why. Don't believe him! I \nfear he is at the root of her \ndisappearance.\n \nPlease, if you can, search for Anya and \nbring her back to us. She'll know what \nto do about Nihlathak.\n"
  },
  "A5Q3SuccessfulAnya": {
    "zh": "80\n谢谢你救了我，英雄。\n \n为了表达我个人的感激之情，请收下这件礼物。这是我特意请拉苏克为你量身打造的。\n",
    "en": "80\nThank you, hero, for rescuing me.\n \nTo show my personal gratitude, I give \nyou this. I had it custom-made for you \nby Larzuk.\n"
  },
  "A5Q3SuccessfulCain": {
    "zh": "62\n安雅虽然年纪轻轻，却极具威望。既然她已经平安归来，我一定要向她请教关于亚瑞特山的秘密。\n \n你也应该去和她谈谈。\n",
    "en": "62\nFor one so young, Anya commands \ngreat respect. Now that she is here, I \nwill make it a point to talk to her about \nMount Arreat.\n \nYou should do the same.\n"
  },
  "A5Q3SuccessfulLarzuk": {
    "zh": "67\n我向来不喜欢尼拉塞克，但万万没想到他竟会背叛我们！我真想不通一位长老怎么会做出这种事。\n",
    "en": "67\nI never liked Nihlathak, but I never \nsuspected that he'd betray us! I just \ncan't understand how an Elder could do \nsuch a thing.\n"
  },
  "A5Q3SuccessfulMalah": {
    "zh": "48\n非常感谢你把安雅平安带回我们身边。我特意研制了这张能够提升你元素抗性的卷轴，聊表我的谢意。虽然算不上什么厚礼，但希望能对你有所帮助。\n \n请快去和安雅谈谈吧，她有关于尼拉塞克的紧急消息要告诉你。\n",
    "en": "48\nThank you so much for bringing Anya \nback to us. I have devised this spell to \nincrease your resistances as a token of \nmy thanks. I know it isn't much, but I \nhope you find it helpful.\n \nPlease go talk to Anya. She has urgent \nnews concerning Nihlathak.\n"
  },
  "A5Q3SuccessfulQualKehk": {
    "zh": "140\n你能救出安雅，真是立下了一件大功。\n",
    "en": "140\nYour rescue of Anya was quite an \naccomplishment.\n"
  },
  "A5Q4AfterInitAnya": {
    "zh": "90\n不管尼拉塞克的初衷有多么高尚，都绝不能成为他背叛行径的借口。\n",
    "en": "90\nAs noble as Nihlathak's intentions are, \nnothing can excuse his actions.\n"
  },
  "A5Q4AfterInitCain": {
    "zh": "50\n遗憾的是，我对这件远古圣物知之甚少。但如果其他人所言非虚，就绝不能让巴尔得到它。\n \n赶在一切无可挽回之前……阻止尼拉塞克。\n",
    "en": "50\nRegretfully, I know very little about this \nRelic. However, if what the others say \nis true, then Baal must not gain \npossession of it.\n \nStop Nihlathak...before all is lost.\n"
  },
  "A5Q4AfterInitLarzuk": {
    "zh": "56\n听着，救出安雅——这是大好事；可当尼拉塞克正把远古圣物拱手送给巴尔的时候你还在这儿跟我闲聊——呃……这可就太糟了！\n",
    "en": "56\nNow, rescuing Anya -- that's good. \nTalking to me while Nihlathak hands \nover the Relic to Baal -- uh...that's bad!\n"
  },
  "A5Q4AfterInitMalah": {
    "zh": "65\n我最担心的事还是成真了，尼拉塞克已经彻底疯了。\n \n赶在他把远古圣物交给毁灭之王之前，你必须阻止他！\n",
    "en": "65\nMy worst fear has come true. Nihlathak \nhas gone mad.\n \nYou must stop him, before he gives the \nRelic to the Lord of Destruction!\n"
  },
  "A5Q4AfterInitQualKehk": {
    "zh": "60\n就在你找到安雅之前，我看到尼拉塞克离开了城镇。他必须为自己的罪行付出代价。\n \n找到他，如果可以的话把他抓回来。不过他多半不会束手就擒，届时你只能将他当场击毙。\n \n那就按规矩办吧。\n",
    "en": "60\nI saw Nihlathak leave town just before \nyou found Anya. He must be held \naccountable for his criminal deeds.\n \nFind him and bring him back, if you can. \nLikely, he won't come willingly, and \nyou'll be forced to kill him.\n \nSo be it.\n"
  },
  "A5Q4EarlyReturnAnya": {
    "zh": "55\n尼拉塞克是个彻头彻尾的叛徒！一旦巴尔拿到远古圣物，就能长驱直入圣山内部大肆破坏！\n \n我真不敢相信尼拉塞克竟会拿远古圣物跟巴尔做交易。他要是以为能跟毁灭之王讲信用，那真是疯得不轻。\n",
    "en": "55\nNihlathak is a traitor! If Baal gets the \nRelic, he shall enter the mountain and \nwreak havoc there!\n \nI cannot believe that Nihlathak would \ngive the Relic to Baal in any kind of \ntrade. He's truly insane if he believes \nthat he can deal with the Lord of \nDestruction.\n"
  },
  "A5Q4EarlyReturnCain": {
    "zh": "58\n唉……事态的发展真是太糟糕了。\n \n我的朋友，我知道你似乎总是慢了恶魔一步。但换个角度想……正是你逼得邪恶势力四处逃窜。\n",
    "en": "58\nOhh...This is a truly horrible turn of \nevents.\n \nI know it seems you have always been \none step behind, my friend. But look at \nit this way...You have evil on the run.\n"
  },
  "A5Q4EarlyReturnLarzuk": {
    "zh": "160\n……还有什么好说的？\n \n去宰了尼拉塞克！\n",
    "en": "160\n...What's there to talk about?\n \nKill Nihlathak!\n"
  },
  "A5Q4EarlyReturnMalah": {
    "zh": "63\n尼拉塞克向来不是什么仁慈之人，但他竟敢背叛整个世界……\n \n唉……他的灵魂最终能安息于何处呢？\n",
    "en": "63\nNihlathak was never the kindest man. \nBut for him to betray the whole world...\n \nAhh...Where shall his soul finally rest?\n"
  },
  "A5Q4EarlyReturnQualKehk": {
    "zh": "65\n我的建议是速战速决、迎头痛击。尼拉塞克再厉害，也绝比不上你在外面交手过的那些凶残魔物。\n",
    "en": "65\nMy advice is to go in quick and hit hard. \nNihlathak can't be half as tough as the \nbeasts you've faced out there.\n"
  },
  "A5Q4InitAnya": {
    "zh": "43\n尼拉塞克告诉我，他为了保全哈洛加斯竟与巴尔达成了交易。为了换取恶魔的仁慈，那个糊涂的蠢货打算把我们最神圣的图腾——远古圣物献给巴尔！\n \n一旦那样做，巴尔就能在不受远古先祖考验的情况下直接进入亚瑞特山内部。我试图阻止尼拉塞克，却被他囚禁在那座冰封陵墓中。\n \n必须在尼拉塞克毁掉整个世界之前阻止他。虽然我恨不得亲手掐死他，但我恐怕力不从心。\n \n你必须穿过我开启的这道传送门进入他的巢穴，除掉他，并把远古圣物带回来。\n \n阻止尼拉塞克毁掉我们世代守护的圣物！\n",
    "en": "43\nNihlathak told me he struck a deal with \nBaal to protect Harrogath. In exchange \nfor the demon's mercy, the misguided \nfool plans to give Baal the Relic of the \nAncients, our most holy totem!\n \nDoing so will allow Baal to enter Mount \nArreat unchallenged by the Ancients. I \ntried to stop Nihlathak, but he \nimprisoned me in that icy tomb.\n \nNihlathak must be stopped before he \ndooms the whole world. As much as I \nwould love to strangle the life out of \nhim, I'm afraid I haven't the strength.\n \nYou must go to his lair through this \nportal I've opened, kill him, and then \nbring back the Relic of the Ancients.\n \nStop Nihlathak from destroying what we \nhave striven for eons to protect.\n"
  },
  "A5Q4SuccessfulAnya": {
    "zh": "55\n你虽然阻止了尼拉塞克，但远古圣物却不在他身上！他一定已经把圣物交给巴尔了。如此一来，当巴尔抵达亚瑞特山顶时，将不会受到先祖的考验。\n \n……该死的尼拉塞克！\n \n不过我还是要感谢你的努力。请允许我用魔法将你的名字铭刻在你选定的一件装备上，以表彰你的英勇。这是我唯一能做的了。\n",
    "en": "55\nYou have stopped Nihlathak, but he \ndidn't have the Relic! He must have \nalready given it to Baal. Now, Baal will \nnot be tested when he reaches Arreat's \nsummit.\n \n...Damn Nihlathak!\n \nI do thank you for trying, though. \nPlease, allow me to honor your courage \nby magically inscribing your name onto \nan item of your choosing. It's the least \nI can do.\n"
  },
  "A5Q4SuccessfulCain": {
    "zh": "90\n千万当心！每过一刻，巴尔的力量都在变得更加强大。\n",
    "en": "90\nBeware! Baal grows stronger with every \npassing moment.\n"
  },
  "A5Q4SuccessfulLarzuk": {
    "zh": "93\n唔……巴尔进入亚瑞特山内部究竟打算干什么？\n",
    "en": "93\nHmmm...What does Baal plan to do \ninside Mount Arreat?\n"
  },
  "A5Q4SuccessfulMalah": {
    "zh": "65\n看来远古圣物已经遗失了。不要沉湎于过去的失利，你的未来才更加重要。\n",
    "en": "65\nSo, the Relic is lost. Do not dwell on \nfailures past. It is your future that \nmatters more.\n"
  },
  "A5Q4SuccessfulQualKehk": {
    "zh": "57\n尼拉塞克是个卑劣的恶徒，他终将在地狱受尽折磨的爪牙中找到自己的归宿！\n \n你毫无畏惧地迎战黑暗，我由衷赞叹你的武艺与勇气。\n",
    "en": "57\nNihlathak was a vile demon that shall \nfind his home among the tortured \nminions of Hell!\n \nYou battled the Darkness without fear. I \nlaud your skill and courage.\n"
  },
  "A5Q5AfterInitAnya": {
    "zh": "72\n要不是尼拉塞克的背叛，你本不必接受远古先祖的试炼。他是个蠢货，活该在永恒的痛苦中煎熬。\n",
    "en": "72\nYou wouldn't have to test yourself \nagainst the Ancients if it weren't for \nNihlathak's treachery. He was a fool \nand deserves to suffer for eternity.\n"
  },
  "A5Q5AfterInitCain": {
    "zh": "90\n对于一位野蛮人英雄而言，勇气与实力的试炼正是恰如其分的成年洗礼。\n",
    "en": "90\nA test of mettle is a fitting rite of \npassage for a Barbarian hero.\n"
  },
  "A5Q5AfterInitLarzuk": {
    "zh": "75\n每个夜晚，我都向远古先祖祈祷和平降临……可现在你却不得不与他们交战。\n \n呵……勇士，今后我该向谁祈祷才好呢？\n",
    "en": "75\nEvery night, I've prayed to the Ancients \nto bring us peace...and now you must \nfight them.\n \nHuh...Who shall I pray to now, warrior?\n"
  },
  "A5Q5AfterInitMalah": {
    "zh": "65\n当你抵达圣山之巅时，你就不再只是一名普通的战士了。等你归来之时，你将蜕变得无比强大。\n",
    "en": "65\nBy reaching the summit, you cease \nbeing just a simple warrior. When you \ncome back, you will be far more.\n"
  },
  "A5Q5AfterInitQualKehk": {
    "zh": "63\n远古先祖并非我们的敌人。切记这一点！他们是我们的祖先——我们的神明。\n",
    "en": "63\nThe Ancients are not our enemies. \nRemember that! They are our \nancestors -- our gods.\n"
  },
  "A5Q5EarlyReturnAnya": {
    "zh": "71\n听着，我必须向你道歉。\n \n我对你眼前的困境深感自责。如果当初我能阻止尼拉塞克把远古圣物交给巴尔，你就不必与先祖的英灵交战了。\n",
    "en": "71\nLook. I must apologize.\n \nI feel responsible for your current \nstruggle. If I had only stopped \nNihlathak from giving Baal the Relic, \nyou would not have to fight those \nghosts.\n"
  },
  "A5Q5EarlyReturnCain": {
    "zh": "52\n我的朋友，我们已经走了这么远，绝不能在此功亏一篑。我亲眼见证你完成了许多艰巨的任务，尽管这或许是你面临的最大考验，但绝非遥不可及。\n",
    "en": "52\nWe have come too far to be defeated \nnow, my friend. I have seen you \ncomplete many difficult quests. Though \nthis may be your greatest trial, it is not \nbeyond your reach.\n"
  },
  "A5Q5EarlyReturnLarzuk": {
    "zh": "70\n你踏上了我们先祖最神圣的陵寝之地。我真不知道自己是该向你顶礼膜拜，还是斥责你亵渎神明。\n \n与神明同行之时，务必谨言慎行。\n",
    "en": "70\nYou've walked on the burial grounds of \nour greatest ancestors. I'm not sure \nwhether I should bow before you or \nrevile you for committing sacrilege.\n \nTread lightly when you walk with gods.\n"
  },
  "A5Q5EarlyReturnMalah": {
    "zh": "68\n不要怀疑自己。我相信你配得上穿过远古先祖的大门，但你自己也必须坚信这一点。\n",
    "en": "68\nDo not doubt yourself. I believe you are \nworthy to pass through the Ancients' \ngates, but you must believe, as well.\n"
  },
  "A5Q5EarlyReturnQualKehk": {
    "zh": "114\n我早警告过你了！\n \n远古先祖可不像你平时对付的那些恶魔。\n",
    "en": "114\nI warned you!\n \nThe Ancients are not like the demons \nyou're accustomed to fighting.\n"
  },
  "A5Q5InitQualKehk": {
    "zh": "37\n勇士，每次听到关于你的消息，你的事迹都越发富有传奇色彩。\n \n但请务必当心。你正一步步接近亚瑞特山的绝顶。我从未敢踏足那里，那是我们最神圣的禁地。传说山顶由远古先祖守护，他们会阻挡一切不够格之人的去路。\n \n你在这里的威望毫无意义……唯有远古先祖才能裁定你是否配得上通过试炼。\n \n祝你好运。\n",
    "en": "37\nEvery time I hear of you, warrior, your \ndeeds become more legendary.\n \nBut take heed. You are approaching the \nvery summit of Mount Arreat. I have \nnever dared venture there. It is sacred \n-- our most holy place. The legends say \nit is guarded by the Ancient Ones, who \nblock the path of all who are unworthy.\n \nYour reputation here does not \nmatter...It will be the Ancients who \ndetermine your worthiness.\n \nGood luck.\n"
  },
  "A5Q5SuccessfulAnya": {
    "zh": "82\n站在我面前的是一位当之无愧的英雄——我们全族最后的希望就寄托在你的肩上。\n \n勇往直前吧，勇士。\n",
    "en": "82\nYou stand before me a worthy hero -- \nand on you rests the last hope of our \npeople.\n \nBear it well, warrior.\n"
  },
  "A5Q5SuccessfulCain": {
    "zh": "67\n你已经向这里的族人证明了自己。他们将你视为他们的勇士、他们的救世主。\n",
    "en": "67\nYou have proven yourself to these \npeople. They look to you as their \nwarrior, their champion.\n"
  },
  "A5Q5SuccessfulLarzuk": {
    "zh": "82\n远古先祖认可了你的荣耀，我们也同样向你致敬。现在我对你再无半点怀疑了。\n",
    "en": "82\nThe Ancients have honored you, and in \nturn, so do we. I have no remaining \ndoubts about you, now.\n"
  },
  "A5Q5SuccessfulMalah": {
    "zh": "60\n我就知道远古先祖会认可你配得上亚瑞特山的秘密。现在，赶在巴尔毁掉一切神圣之物前阻止他吧。\n",
    "en": "60\nI knew the Ancients would find you \nworthy of Mount Arreat's secrets. Now, \nstop Baal before he destroys all that is \nsacred.\n"
  },
  "A5Q5SuccessfulQualKehk": {
    "zh": "75\n能在战斗中击败远古先祖，确实是了不起的伟业。希望这意味着你已经做好了迎战巴尔的准备。\n",
    "en": "75\nBesting the Ancients in battle is a \nmighty feat indeed. I hope this means \nyou're ready to battle Baal.\n"
  },
  "A5Q6EarlyReturnAnya": {
    "zh": "60\n巴尔竟然阻挡了泰瑞尔进入世界之石大殿？这已真正成为一场对抗地狱的决战。\n \n无论这是否是高阶天堂的旨意，现在这都是属于你的战斗——你的宿命。\n",
    "en": "60\nBaal has blocked Tyrael from entering \nthe Worldstone Chamber? This truly \nhas become a battle against Hell.\n \nWhether or not it was the Heavens' \ndecree, this is your fight now -- your \ndestiny.\n"
  },
  "A5Q6EarlyReturnCain": {
    "zh": "51\n切记这一点：巴尔曾附身于塔·拉夏——远古赫拉迪姆中最强大的法师之一。\n \n你此前与墨菲斯托和暗黑破坏神的战斗，与即将面对巴尔的决战相比都将相形见绌。\n \n拥有塔·拉夏渊博知识的毁灭之王……当你们交锋之时，整座圣山都将为之颤抖。\n",
    "en": "51\nRemember this. Baal once possessed Tal \nRasha, one of the most powerful of the \nancient Horadrim.\n \nYour battles with Mephisto and Diablo \nwill pale in comparison to your battle \nwith Baal.\n \nThe Lord of Destruction aided by Tal \nRasha's knowledge...The mountain \nitself will tremble when you clash.\n"
  },
  "A5Q6EarlyReturnLarzuk": {
    "zh": "59\n我虽然只是个铁匠，但有一点我再清楚不过……巴尔企图利用深藏在圣山中的秘密毁灭整个世界。就算不是天才也明白必须阻止他。\n",
    "en": "59\nI may be just an armorer, but I know \nthis...Baal plans to destroy the world \nwith the secrets contained in that \nmountain. It doesn't take a genius to \nknow he has to be stopped.\n"
  },
  "A5Q6EarlyReturnMalah": {
    "zh": "70\n你早知道终究会迎来这一战。杀掉巴尔！终结这场浩劫！\n",
    "en": "70\nYou knew it would eventually come down \nto this. Kill Baal! Finish the game!\n"
  },
  "A5Q6EarlyReturnQualKehk": {
    "zh": "63\n你已经踏入了超越传说的领域，正奔赴一场常人难以想象的邪恶决战。\n \n千万保重，我的朋友，愿圣光庇佑着你。\n",
    "en": "63\nYou have ventured to a place beyond \nlegend. You rush to face an evil few \ncan even imagine.\n \nBe careful, my friend, and may the Light \nwatch over you.\n"
  },
  "A5Q6InitAncients": {
    "zh": "31\n你是一位当之无愧的英雄！我们将强化你的技艺，并准许你进入亚瑞特山内部——世界之石的所在地。\n \n千万当心，你并非孤身一人。毁灭之王巴尔已经在里面了。\n \n大天使泰瑞尔向来是我们的恩人，但如今就连他也爱莫能助，因为巴尔阻断了泰瑞尔的灵体进入世界之石大殿。凡人，现在只有你拥有击败巴尔的力量。\n \n巴尔正威胁着世界之石——并借此威胁着整个凡间。你必须在巴尔完全控制圣石之前阻止他。一旦世界之石落入他的掌控，巴尔就能震碎凡间与燃烧地狱之间的界限，让三大罪恶之源的魔军如不可阻挡的狂潮般涌入凡间！\n \n如果你软弱退缩，你所熟知的世界就将万劫不复。你绝不能失败！\n",
    "en": "31\nYou are a worthy hero! We augment \nyour skill and grant you entry to the \ninterior of Mount Arreat, wherein lies \nthe Worldstone.\n \nBeware. You will not be alone. Baal the \nLord of Destruction is already inside. \n \nThe Archangel Tyrael has always been \nour benefactor, but even he cannot \nhelp us now. For Baal blocks Tyrael's \nspiritual presence from entering the \nchamber of the Worldstone. Only you, \nmortal, have the power to defeat Baal \nnow.\n \nBaal threatens the Worldstone -- and \nthrough it, the mortal realm, itself. You \nmust stop him before he gains full \ncontrol of the sacred stone. With it \nunder his control, Baal could shatter \nthe boundaries between this world and \nthe Burning Hells, thus allowing the \nhordes of the Prime Evils to pour forth \ninto the mortal realm like an \nunstoppable tide!\n \nIf you are weak, the world as you know \nit could be lost forever. You must NOT \nfail!\n"
  },
  "A5Q6SuccessfulAnya": {
    "zh": "53\n英雄，你完成了不可能的壮举。你击败了三大罪恶之源中的最后一位，为圣光赢得了伟大的胜利。\n \n奇怪的是，你竟说世界之石必须被摧毁。古老的预言中可从未提及此事。\n \n或许我们苦战守护的一切都将不复存在……又或许，我们从此再也不必征战了！\n",
    "en": "53\nYou have done the impossible, hero. \nYour defeat of the last of the three \nPrime Evils is a great victory for the \nLight. \n \nStrange that you say that the \nWorldstone must be destroyed. The \nprophecies said nothing about that.\n \nPerhaps all we have fought for will be \nlost...or perhaps we'll never need fight \nagain!\n"
  },
  "A5Q6SuccessfulCain": {
    "zh": "40\n我就知道你终将击败巴尔。我的朋友，你已经完成了自己肩负的一切使命。\n \n自从你在崔斯特瑞姆将我救出，我就一直坚信着你。能在这段旅途中助你一臂之力，是我至高无上的荣耀。\n \n原来如此……世界之石已被巴尔污染，如今泰瑞尔不得不将其摧毁。不必担忧，无论前方等待我们的是什么，我深信圣光都会指引我们前行。\n \n去吧，回到世界之石大殿，踏入泰瑞尔为你开启的传送门吧。\n",
    "en": "40\nI knew in time you would defeat Baal. \nYou have done everything you set out \nto do, my friend.\n \nEver since you rescued me from \nTristram, I have believed in you. It has \nbeen a supreme honor to aid you along \nthe way. \n \nSo...The Worldstone was corrupted by \nBaal. And now Tyrael must destroy it. \nWorry not. Through whatever lies \nahead I have faith that the Light will \nguide us both.\n \nGo, now, back to the Worldstone \nchamber, and enter the portal Tyrael \nhas opened for you.\n"
  },
  "A5Q6SuccessfulLarzuk": {
    "zh": "74\n就连远古先祖也会羡慕我们为你谱写的赞歌。\n \n请千万别忘了我们！再会了，我的朋友。\n",
    "en": "74\nThe Ancients themselves will envy our \nsongs about you.\n \nPlease, don't forget about us! Farewell, \nmy friend.\n"
  },
  "A5Q6SuccessfulMalah": {
    "zh": "48\n既然泰瑞尔说世界之石必须被摧毁，那就只能如此。我们绝不能让巴尔的腐化得逞！\n \n诚然，世界将会改变——但谁又能断定这不是向着更好的方向改变呢？\n",
    "en": "48\nIf Tyrael says the Worldstone must be \ndestroyed, then it must. We cannot let \nBaal's corruption prevail!\n \nThe world will change, true -- but who is \nto say it isn't for the better?\n"
  },
  "A5Q6SuccessfulQualKehk": {
    "zh": "60\n世界之石的毁灭对我们的世界而言并非吉兆，但我会尽量不去多想……\n \n毕竟，我们有像你这样的勇士为我们、为圣光而战。\n \n珍重，再会！\n",
    "en": "60\nThe destruction of the Worldstone does \nnot bode well for our world. But I'll try \nnot to worry...\n \nAfter all, we have warriors like you \nfighting for us and for the Light.\n \nFarewell!\n"
  },
  "A5Q6SuccessfulTyrael": {
    "zh": "40\n凡人，你令我深感钦佩。你克服了这个世界有史以来面临的最大挑战，击败了最后一位罪恶之源。然而，我们还是来晚了一步，无法挽救世界之石。巴尔毁灭性的触碰已经彻底污染了它。\n \n假以时日，世界之石的能量将会枯竭，各界之间的屏障也将随之崩塌——地狱的力量将如洪水般涌入这片……庇护之地……将你的族人以及你们辛勤建立的一切彻底抹杀。\n \n因此，我必须在地狱之力扎根之前摧毁这颗被污染的世界之石。此举将永远改变你的世界——其后果就连我也无法预料。但这是确保人类得以存续的唯一途径。\n \n去吧，凡人。我已经开启了一道通往安全之地的传送门。\n \n愿永恒的圣光因你今日的伟业而照耀你与你的后代。人类的延续便是你留下的不朽传奇！最重要的是，在这场无休止的征战之后，你终于赢得了应得的安宁。\n",
    "en": "40\nI am impressed, mortal. You have \novercome the greatest challenge this \nworld has ever faced and defeated the \nlast of the Prime Evils. However, we are \ntoo late to save the Worldstone. Baal's \ndestructive touch has corrupted it \ncompletely.\n \nGiven enough time, the Worldstone's \nenergies will drain away and the \nbarriers between the worlds will \nshatter -- the powers of Hell will flood \ninto this...Sanctuary...and eradicate \nyour people and everything you've \nlabored to build.\n \nTherefore, I must destroy the corrupted \nWorldstone before the powers of Hell \ntake root. This act will change your \nworld forever -- with consequences \neven I cannot foresee. However, it is \nthe only way to ensure mankind's \nsurvival.\n \nGo now, mortal. I have opened a portal \nthat will lead you to safety.\n \nMay the Eternal Light shine upon you \nand your descendants for what you've \ndone this day. The continued survival \nof mankind is your legacy! Above all \nelse, you have earned a rest from this \nendless battle.\n"
  },
  "AncientsAct5IntroGossip1": {
    "zh": "35\n我们是奈非天的英灵，远古的先祖。我们被选中守护神圣的亚瑞特山，世界之石便安眠于此。极少有人配得上站在它的面前，更少有人能领悟它的真正意义。\n \n在你进入之前，必须先击败我们。\n",
    "en": "35\nWe are the spirits of the Nephalem, the \nAncient Ones. We have been chosen to \nguard sacred Mount Arreat, wherein \nthe Worldstone rests. Few are worthy \nto stand in its presence; fewer still can \ncomprehend its true purpose.\n \nBefore you enter, you must defeat us.\n"
  },
  "Ort": {
    "zh": "歐特",
    "en": "Ort"
  },
  "Qstsyouarenot8": {
    "zh": "你必須到達第八級才能完成這個任務。你可以在你等級昇到第八級時，創造一場新的遊戲或是加入另一場遊戲來完成它。",
    "en": "You must be level 8 to complete this quest. You can complete it by creating a new game or joining a different game when you are at least level 8."
  },
  "Ral": {
    "zh": "拉爾",
    "en": "Ral"
  },
  "Tal": {
    "zh": "塔爾",
    "en": "Tal"
  },
  "qsta5q11": {
    "zh": "在血腥丘陵擊敗督軍山克來阻止圍攻。",
    "en": "Stop the Siege by killing Shenk the Overseer in the Bloody Foothills."
  },
  "qsta5q12": {
    "zh": "殺死督軍山克。",
    "en": "Kill Shenk the Overseer."
  },
  "qsta5q13": {
    "zh": "去和拉蘇克談談以領取你的獎賞。",
    "en": "Go talk to Larzuk for your reward."
  },
  "qsta5q14": {
    "zh": "拉蘇克會幫你選定的物品加上凹槽。",
    "en": "Larzuk will add sockets to the item of your choice."
  },
  "qstsComplete": {
    "zh": "任務結束。",
    "en": "Quest completed."
  },
  "qstsThankYouComeAgain": {
    "zh": "你無法在這場遊戲中完成這個任務。你可以創造一場新的遊戲來完成它。",
    "en": "You cannot complete this quest in this game. You can complete it by creating a new game."
  },
  "qstsThankYouComeAgainMulti": {
    "zh": "你無法在這場遊戲中完成這個任務。你可以創造一場新的遊戲或是加入另一場遊戲來完成它。",
    "en": "You cannot complete this quest in this game. You can complete it by creating a new game or joining a different game."
  },
  "qstsa1q1": {
    "zh": "邪惡洞穴",
    "en": "Den of Evil"
  },
  "qstsa1q11": {
    "zh": "在蘿格營地外面的荒野中，找尋一個洞穴。",
    "en": "Look for the Den in the wilderness outside the Rogues' Camp."
  },
  "qstsa1q12": {
    "zh": "殺死所有盤踞在洞穴中的怪物。",
    "en": "Kill all the monsters in the Den."
  },
  "qstsa1q13": {
    "zh": "",
    "en": ""
  },
  "qstsa1q14": {
    "zh": "剩下的怪物：",
    "en": "Monsters remaining:"
  },
  "qstsa1q140": {
    "zh": "還有一個怪物。",
    "en": "One monster left."
  },
  "qstsa1q15": {
    "zh": "回去找阿卡拉領賞。",
    "en": "Return to Akara for a reward."
  },
  "qstsa1q2": {
    "zh": "修女埋骨之地",
    "en": "Sisters' Burial Grounds"
  },
  "qstsa1q21": {
    "zh": "到冰冷之原旁邊的埋骨之所，找尋血鳥的蹤跡。",
    "en": "Look for Blood Raven in the Burial Grounds next to the Cold Plains."
  },
  "qstsa1q22": {
    "zh": "殺了血鳥。",
    "en": "Kill Blood Raven."
  },
  "qstsa1q23": {
    "zh": "回去找卡夏領賞。",
    "en": "Return to Kashya for a reward."
  },
  "qstsa1q3": {
    "zh": "交易的工具",
    "en": "Tools of the Trade"
  },
  "qstsa1q31": {
    "zh": "在僧院的軍營中找尋赫拉迪克.馬勒斯。小心有個鐵匠在看守著它。",
    "en": "Look for the Horadric Malus in the Monastery Barracks. Beware of the Smith that guards it."
  },
  "qstsa1q32": {
    "zh": "把赫拉迪克.馬勒斯送回恰西的手中。",
    "en": "Return the Horadric Malus to Charsi."
  },
  "qstsa1q32b": {
    "zh": "恰西會把你的一項物品灌入魔法力量。",
    "en": "Charsi will imbue an item with magical power."
  },
  "qstsa1q3x": {
    "zh": "拿著赫拉迪克.馬勒斯的人離開遊戲了。",
    "en": "The person with the malus quit the game."
  },
  "qstsa1q4": {
    "zh": "凱恩的搜尋",
    "en": "The Search for Cain"
  },
  "qstsa1q41": {
    "zh": "穿過地底通道來到黑暗森林，找到艾尼弗斯之樹，並取回卷軸。",
    "en": "Go through the Underground Passage to the Dark Wood, search for the Tree of Inifuss, and recover the Scroll."
  },
  "qstsa1q42": {
    "zh": "拿著艾尼弗斯的卷軸去找阿卡拉。",
    "en": "Take the Scroll of Inifuss to Akara."
  },
  "qstsa1q43": {
    "zh": "前往石塊曠野中的石塚，利用我寫在艾尼弗斯卷軸上面的順序觸碰石塊，然後進入傳送點前往崔斯特瑞姆。但是你們要小心面前的危險。",
    "en": "Go to the Cairn Stones in the Stony Field. Touch the Stones in the order found on the Scroll of Inifuss. Enter the portal to Tristram, but beware the danger that lies ahead."
  },
  "qstsa1q44": {
    "zh": "找到並救出迪卡．凱恩。",
    "en": "Find and rescue Deckard Cain."
  },
  "qstsa1q45": {
    "zh": "凱恩已經被救回來了，現在回到了蘿格營地之中。",
    "en": "Cain has been rescued and is now at the Rogue Encampment."
  },
  "qstsa1q46": {
    "zh": "回到蘿格營地，見見凱恩和阿卡拉。",
    "en": "Visit Cain and Akara in the Rogue Encampment."
  },
  "qstsa1q46b": {
    "zh": "去和阿卡拉談談並領賞。",
    "en": "Talk to Akara for a reward."
  },
  "qstsa1q4x": {
    "zh": "拿著赫拉迪克卷軸的人離開了遊戲。",
    "en": "The person with the horadric scroll quit the game."
  },
  "qstsa1q5": {
    "zh": "遺忘之塔",
    "en": "The Forgotten Tower"
  },
  "qstsa1q51": {
    "zh": "在黑暗森林遠方的黑色荒地中，可以找到一個高塔。",
    "en": "Look for the Tower in the Black Marsh beyond the Dark Wood."
  },
  "qstsa1q51a": {
    "zh": "探索高塔廢墟下面的地窖牢房。",
    "en": "Explore the cellar dungeons beneath the Tower ruins."
  },
  "qstsa1q51b": {
    "zh": "探索高塔廢墟下面的地窖牢房。",
    "en": "Explore the cellar dungeons beneath the Tower ruins."
  },
  "qstsa1q52": {
    "zh": "打倒裡面的邪惡女伯爵。",
    "en": "Dispose of the evil Countess."
  },
  "qstsa1q6": {
    "zh": "屠殺的修女",
    "en": "Sisters to the Slaughter"
  },
  "qstsa1q61": {
    "zh": "在僧院的地下墓穴中，找到安達利爾的老巢。",
    "en": "Find Andariel's Lair in the depths of the Monastery Catacombs."
  },
  "qstsa1q62": {
    "zh": "殺了安達利爾。",
    "en": "Kill Andariel."
  },
  "qstsa1q62b": {
    "zh": "回去找瓦瑞夫，你可以和他一塊帶領商隊往東走。",
    "en": "Return to Warriv to take the Caravan East."
  },
  "qstsa1q63": {
    "zh": "回去找瓦瑞夫，你可以和他一塊帶領商隊往東走。",
    "en": "Return to Warriv to take the Caravan East."
  },
  "qstsa2q1": {
    "zh": "羅達門特的巢穴",
    "en": "Radament's Lair"
  },
  "qstsa2q11": {
    "zh": "在魯.高因的下水道中，找到羅達門特的巢穴。",
    "en": "Find Radament's Lair in the Lut Gholein sewers."
  },
  "qstsa2q12": {
    "zh": "殺了羅達門特。",
    "en": "Kill Radament."
  },
  "qstsa2q13": {
    "zh": "回去找亞特瑪領取獎賞。",
    "en": "Return to Atma for a reward."
  },
  "qstsa2q2": {
    "zh": "赫拉迪克之杖",
    "en": "The Horadric Staff"
  },
  "qstsa2q21": {
    "zh": "把這個卷軸給魯.高因的凱恩看看。",
    "en": "Show the scroll to Cain in Lut Gholein."
  },
  "qstsa2q22": {
    "zh": "在乾燥的高地下面的死亡之殿中，好好找尋那個方塊。在遙遠的綠洲下面可以找到蛆蟲巢穴，裡面有木製的手柄。到利爪腹蛇神殿，可以找到金屬的花紋。",
    "en": "Search the Halls of the Dead under the Dry Hills for the Cube. Search the Maggot Lair under the Far Oasis for the Shaft. Search the Claw Viper Temple for the Headpiece."
  },
  "qstsa2q23": {
    "zh": "利用赫拉迪克的方塊把法杖回復原狀。",
    "en": "Use the Horadric Cube to restore the Staff."
  },
  "qstsa2q24": {
    "zh": "拿著法杖進入塔.拉夏的古墓。",
    "en": "Take the Staff into Tal Rasha's Tomb."
  },
  "qstsa2q25": {
    "zh": "拿著這個古物，前去找魯.高因中的凱恩。",
    "en": "Take the artifacts to Cain in Lut Gholein."
  },
  "qstsa2q3": {
    "zh": "墮落的太陽",
    "en": "Tainted Sun"
  },
  "qstsa2q31a": {
    "zh": "問問卓格南對這片奇怪的黑暗有什麼看法。",
    "en": "Ask Drognan about the strange darkness."
  },
  "qstsa2q32": {
    "zh": "摧毀位於利爪腹蛇神殿的蛇形祭壇，它位於群蛇峽谷的下面。",
    "en": "Destroy the Serpent Altar in the Claw Viper Temple beneath the Valley of Snakes."
  },
  "qstsa2q33": {
    "zh": "和魯.高因中的居民談談。",
    "en": "Speak with the townsfolk in Lut Gholein."
  },
  "qstsa2q4": {
    "zh": "神秘庇難所",
    "en": "Arcane Sanctuary"
  },
  "qstsa2q41": {
    "zh": "到宮殿中找尋神秘的庇難所。",
    "en": "Look for the Arcane Sanctuary within the Palace."
  },
  "qstsa2q41a": {
    "zh": "和卓格南談談。",
    "en": "Talk to Drognan."
  },
  "qstsa2q42": {
    "zh": "找出赫拉森的日記。",
    "en": "Find Horazon's Journal."
  },
  "qstsa2q43": {
    "zh": "繼續找尋第七個古墓。",
    "en": "Continue the search for the Seventh Tomb."
  },
  "qstsa2q5": {
    "zh": "召喚者",
    "en": "The Summoner"
  },
  "qstsa2q51": {
    "zh": "小心召喚者。",
    "en": "Beware the Summoner."
  },
  "qstsa2q52": {
    "zh": "殺了召喚者。",
    "en": "Kill the Summoner."
  },
  "qstsa2q53": {
    "zh": "回到城鎮可以聽到更多的訊息。",
    "en": "Return to town for more information."
  },
  "qstsa2q6": {
    "zh": "七個古墓",
    "en": "The Seven Tombs"
  },
  "qstsa2q61": {
    "zh": "找出塔.拉夏的古墓。",
    "en": "Find Tal Rasha's Tomb."
  },
  "qstsa2q61a": {
    "zh": "這的符號標示出真正的塔.拉夏古墓。",
    "en": "The Symbol of the True Tomb of Tal Rasha."
  },
  "qstsa2q62": {
    "zh": "殺了都瑞爾。",
    "en": "Kill Duriel."
  },
  "qstsa2q63a": {
    "zh": "和杰海因談談。",
    "en": "Talk to Jerhyn."
  },
  "qstsa2q63f": {
    "zh": "探索塔.拉夏的墓穴",
    "en": "Explore Tal Rasha's Tomb"
  },
  "qstsa2q64": {
    "zh": "和杰海因談談。",
    "en": "Talk to Jerhyn."
  },
  "qstsa2q65": {
    "zh": "和馬席夫談談。",
    "en": "Talk to Meshif."
  },
  "qstsa3q1": {
    "zh": "藍.依森的古書",
    "en": "Lam Esen's Tome"
  },
  "qstsa3q11": {
    "zh": "你得在庫拉斯特商場、庫拉斯特上層，和庫拉斯特的堤道分布的六個古墓中，找到藍.依森之書。",
    "en": "Search the six temples in the Bazaar, Upper Kurast, and the Causeway for Lam Esen's Tome."
  },
  "qstsa3q12": {
    "zh": "和艾柯談談。",
    "en": "Talk to Alkor."
  },
  "qstsa3q2": {
    "zh": "克林姆的意志",
    "en": "Khalim's Will"
  },
  "qstsa3q21": {
    "zh": "找出克林姆的遺骸。在蜘蛛洞窟中可以找到他的眼球。",
    "en": "Find Khalim's relics. Search for his Eye in the Spider Cavern."
  },
  "qstsa3q21a": {
    "zh": "問問凱恩與克林姆遺骸有關的事情。",
    "en": "Ask Cain about Khalim's relics."
  },
  "qstsa3q22": {
    "zh": "在剝皮地窖中找出克林姆的腦。",
    "en": "Search for Khalim's Brain in the Flayer Dungeon."
  },
  "qstsa3q23": {
    "zh": "在崔凡克找出克林姆的連枷。小心最高評議會。",
    "en": "Search for Khalim's Flail in Travincal. Beware the High Council."
  },
  "qstsa3q24": {
    "zh": "在庫拉斯特商場底下的下水道中，找尋克林姆的心臟。",
    "en": "Search for Khalim's Heart in the Sewers under the Kurast Bazaar."
  },
  "qstsa3q25": {
    "zh": "轉換克林姆的遺骸-連枷、眼球、心臟、腦-放進赫拉迪克的方塊之中。",
    "en": "Transmute Khalim's relics - the Flail, Eye, Heart, and Brain - with the Horadric Cube."
  },
  "qstsa3q26": {
    "zh": "利用克林姆的意志來摧毀強制球體。",
    "en": "Use Khalim's Will to smash the Compelling Orb."
  },
  "qstsa3q3": {
    "zh": "古代宗教之刃",
    "en": "Blade of the Old Religion"
  },
  "qstsa3q31": {
    "zh": "在剝皮叢林中找找吉得賓。",
    "en": "Look for the Gidbinn in the Flayer Jungle."
  },
  "qstsa3q31a": {
    "zh": "在海港附近打聽吉得賓的事情。",
    "en": "Ask around the Docks about the Gidbinn."
  },
  "qstsa3q32": {
    "zh": "取回吉得賓。",
    "en": "Pick up the Gidbinn."
  },
  "qstsa3q33": {
    "zh": "把吉得賓送到奧瑪斯的手中。",
    "en": "Return the Gidbinn to Ormus."
  },
  "qstsa3q34": {
    "zh": "和艾席拉談談。",
    "en": "Talk to Asheara."
  },
  "qstsa3q35": {
    "zh": "和奧瑪斯談談。",
    "en": "Talk to Ormus."
  },
  "qstsa3q4": {
    "zh": "黃金鳥",
    "en": "The Golden Bird"
  },
  "qstsa3q41": {
    "zh": "問問凱恩與玉製小人有關的事。",
    "en": "Ask Cain about the Jade Figurine."
  },
  "qstsa3q42": {
    "zh": "把小人給馬席夫看看。",
    "en": "Show Meshif the Figurine."
  },
  "qstsa3q43": {
    "zh": "詢問凱恩與黃金鳥有關的消息。",
    "en": "Ask Cain about the Golden Bird."
  },
  "qstsa3q44": {
    "zh": "把黃金鳥交給艾柯。",
    "en": "Give the Golden Bird to Alkor."
  },
  "qstsa3q45": {
    "zh": "回去找艾柯，拿取你的獎賞。",
    "en": "Return to Alkor for reward."
  },
  "qstsa3q5": {
    "zh": "轉為黑暗的神殿",
    "en": "The Blackened Temple"
  },
  "qstsa3q51": {
    "zh": "找到沈淪在黑暗的神殿，位於崔凡克之中。",
    "en": "Find the Blackened Temple within Travincal."
  },
  "qstsa3q51a": {
    "zh": "問問奧瑪斯黑暗神殿有關的消息。",
    "en": "Ask Ormus about the Blackened Temple."
  },
  "qstsa3q52": {
    "zh": "殺死所有的最高評議會成員。",
    "en": "Kill the High Council."
  },
  "qstsa3q53": {
    "zh": "去找凱恩求援。",
    "en": "Ask Cain for help."
  },
  "qstsa3q6": {
    "zh": "守護者",
    "en": "The Guardian"
  },
  "qstsa3q61": {
    "zh": "利用克林姆的意志把強制球體毀掉，可以打開前往墨菲斯托的牢籠。",
    "en": "Smash the Compelling Orb with Khalim's Will to open the way to Mephisto's Durance."
  },
  "qstsa3q61a": {
    "zh": "奧瑪斯對守護者有新的消息。",
    "en": "Ormus has news about the Guardian."
  },
  "qstsa3q62": {
    "zh": "在他的囚牢中，找出墨菲斯托。",
    "en": "Search for Mephisto in his Durance."
  },
  "qstsa3q63": {
    "zh": "殺了墨菲斯托。",
    "en": "Kill Mephisto."
  },
  "qstsa4q1": {
    "zh": "墮落的天使",
    "en": "The Fallen Angel"
  },
  "qstsa4q11": {
    "zh": "在絕望平原找尋衣卒爾。",
    "en": "Look for Izual in the Plains of Despair."
  },
  "qstsa4q12": {
    "zh": "摧毀控制衣卒爾靈魂的邪魔。",
    "en": "Destroy the demon that holds Izual's soul."
  },
  "qstsa4q13": {
    "zh": "去找泰瑞爾，領取你的獎賞。",
    "en": "See Tyrael for reward."
  },
  "qstsa4q13a": {
    "zh": "和衣卒爾的靈魂交談。",
    "en": "Talk to Izual's Spirit."
  },
  "qstsa4q2": {
    "zh": "恐怖的結局",
    "en": "Terror's End"
  },
  "qstsa4q21": {
    "zh": "在他的庇難所中找出暗黑破壞神。",
    "en": "Find Diablo in his Sanctuary."
  },
  "qstsa4q22": {
    "zh": "殺死暗黑破壞神。",
    "en": "Kill Diablo."
  },
  "qstsa4q23": {
    "zh": "打破尚存的%d封印。",
    "en": "Break the remaining %d seals."
  },
  "qstsa4q24": {
    "zh": "打破最後一個封印。",
    "en": "Break the final seal."
  },
  "qstsa4q3": {
    "zh": "地獄熔爐",
    "en": "Hell's Forge"
  },
  "qstsa4q31": {
    "zh": "拿著墨菲斯托的靈魂之石，前往地獄熔爐。",
    "en": "Take Mephisto's Soulstone to the Hellforge."
  },
  "qstsa4q32": {
    "zh": "在地獄熔爐中摧毀墨菲斯托的靈魂之石。",
    "en": "Destroy Mephisto's Soulstone at the Hellforge."
  },
  "qstsa4q33": {
    "zh": "利用地獄熔爐旁邊的鐵鎚，敲打熔爐上的靈魂之石。",
    "en": "Use the Hellforge Hammer on the Forge."
  },
  "qstsa4q34": {
    "zh": "和凱恩請教一下。",
    "en": "Consult with Cain."
  },
  "qstsa5q1": {
    "zh": "圍攻哈洛加斯",
    "en": "Siege on Harrogath"
  },
  "qstsa5q2": {
    "zh": "亞瑞特山救援行動",
    "en": "Rescue on Mount Arreat"
  },
  "qstsa5q21": {
    "zh": "在冰凍高地找尋士兵。",
    "en": "Find the Soldiers in the Frigid Highlands."
  },
  "qstsa5q21a": {
    "zh": "把士兵從牢籠中釋放出來並帶領他們回到城鎮。",
    "en": "Free the soldiers from their prison and lead them back to town."
  },
  "qstsa5q22": {
    "zh": "在冰凍高地再救出 %d 名士兵。",
    "en": "Rescue %d more Soldiers in the Frigid Highlands."
  },
  "qstsa5q22a": {
    "zh": "",
    "en": ""
  },
  "qstsa5q23": {
    "zh": "回去找夸爾凱克領取你的獎賞。",
    "en": "Return to Qual-Kehk for your reward."
  },
  "qstsa5q24": {
    "zh": "按照這個順序將符文鑲嵌到有凹槽的物品上：",
    "en": "Apply the Runes to a Socketed item in this order:"
  },
  "qstsa5q3": {
    "zh": "冰之囚",
    "en": "Prison of Ice"
  },
  "qstsa5q31": {
    "zh": "在冰河旁邊的水晶通道下方找尋安亞。",
    "en": "Look for Anya under the Crystalline Passage by the Frozen River."
  },
  "qstsa5q31a": {
    "zh": "救出安亞。",
    "en": "Rescue Anya."
  },
  "qstsa5q32": {
    "zh": "和馬拉談談。",
    "en": "Talk to Malah."
  },
  "qstsa5q33": {
    "zh": "使用馬拉給你的藥水替安亞解凍。",
    "en": "Use the potion Malah gave you to thaw Anya."
  },
  "qstsa5q34": {
    "zh": "去和馬拉談談以領取你的獎賞。",
    "en": "Talk to Malah for your reward."
  },
  "qstsa5q35": {
    "zh": "和安亞談談。",
    "en": "Talk to Anya."
  },
  "qstsa5q4": {
    "zh": "哈洛加斯的背叛",
    "en": "Betrayal of Harrogath"
  },
  "qstsa5q41": {
    "zh": "穿過安亞的傳送門前往尼拉塞克的神殿。",
    "en": "Take Anya's portal to Nihlathak's Temple."
  },
  "qstsa5q42": {
    "zh": "殺死尼拉塞克。",
    "en": "Kill Nihlathak."
  },
  "qstsa5q42a": {
    "zh": "在瓦特之廳找出尼拉塞克。",
    "en": "Find Nihlathak in the Halls of Vaught."
  },
  "qstsa5q43": {
    "zh": "在繼續穿過水晶通道、經過冰河小徑前往亞瑞特山頂峰之前，先和安亞談談。",
    "en": "Talk to Anya before you continue through the Crystalline Passage, past the Glacial Trail, to proceed up Mount Arreat to the Summit."
  },
  "qstsa5q43a": {
    "zh": "安亞會替你把名字刻在物品上。",
    "en": "Anya will personalize an item for you."
  },
  "qstsa5q5": {
    "zh": "通過儀式的考驗",
    "en": "Rite of Passage"
  },
  "qstsa5q51": {
    "zh": "穿過遠古之路，在亞瑞特山頂峰找到遠古野蠻人。",
    "en": "Travel through the Ancient's Way to find the Ancients at the Arreat Summit."
  },
  "qstsa5q52": {
    "zh": "啟動天堂祭壇向遠古野蠻人請教。",
    "en": "Consult with the Ancients by activating the Altar of the Heavens."
  },
  "qstsa5q53": {
    "zh": "在不離開亞瑞特山的情況下擊敗全部三位遠古野蠻人。",
    "en": "Defeat all three Ancients without leaving Mount Arreat."
  },
  "qstsa5q6": {
    "zh": "毀滅的前夕",
    "en": "Eve of Destruction"
  },
  "qstsa5q61": {
    "zh": "向遠古野蠻人請教。",
    "en": "Consult with the Ancients."
  },
  "qstsa5q61a": {
    "zh": "找出巴爾的王座廳。",
    "en": "Find Baal's Throne Room."
  },
  "qstsa5q62": {
    "zh": "殺死巴爾。",
    "en": "Kill Baal."
  },
  "qstsa5q62a": {
    "zh": "在巴爾腐化世界之石大殿之前殺死他。",
    "en": "Kill Baal in the Worldstone Chamber before he corrupts it."
  },
  "qstsa5q62b": {
    "zh": "殺死巴爾的僕從。",
    "en": "Kill Baal's Minions."
  },
  "qstsa5q63": {
    "zh": "和泰瑞爾談談。",
    "en": "Talk to Tyreal."
  },
  "qstsa5q64": {
    "zh": "穿過泰瑞爾的傳送門前往安全之地。",
    "en": "Take Tyreal's Portal to Safety."
  },
  "qstsnull": {
    "zh": "狀況不合法",
    "en": "Invalid State"
  },
  "qstsother": {
    "zh": "你無法在這場遊戲中完成這個任務。一位玩者已經先把這個任務解決了。",
    "en": "You cannot complete this quest in this game. Another player completed it first."
  },
  "qstsprevious": {
    "zh": "你在先前的遊戲之中完成這個任務了。",
    "en": "You completed this quest in a previous game."
  },
  "strClose": {
    "zh": "關閉",
    "en": "Close"
  },
  "strplaylast": {
    "zh": "語音",
    "en": "Speech"
  }
}
