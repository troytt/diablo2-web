/**
 * Auto-generated canonical Blizzard Diablo II 1.13c Vendor, Gambling, Books,
 * LowQualityItems, ItemStatCost, Properties, and Skill Cost tables.
 *
 * Ground truth extracted directly from Patch_D2.mpq / d2exp.mpq / d2data.mpq.
 */

export interface SkillCostEntry {
  readonly id: number
  readonly skill: string
  readonly costMult: number
  readonly costAdd: number
}

export const RAW_NPC: string = "npc\tbuy mult\tsell mult\trep mult\tquestflag A\tquestbuymult A\tquestsellmult A\tquestrepmult A\tquestflag B\tquestbuymult B\tquestsellmult B\tquestrepmult B\tquestflag C\tquestbuymult C\tquestsellmult C\tquestrepmult C\tmax buy\tmax buy (N)\tmax buy (H)\r\ngheed\t512\t1088\t128\t4\t1024\t922\t1024\t\t\t\t\t\t\t\t\t5000\t30000\t35000\r\ncharsi\t512\t960\t128\t4\t1024\t922\t1024\t\t\t\t\t\t\t\t\t5000\t30000\t35000\r\nakara\t512\t1024\t128\t4\t1024\t922\t1024\t\t\t\t\t\t\t\t\t5000\t30000\t35000\r\nlysander\t512\t1024\t128\t9\t1024\t922\t1024\t\t\t\t\t\t\t\t\t10000\t30000\t35000\r\ndrognan\t512\t1024\t128\t9\t1024\t922\t1024\t\t\t\t\t\t\t\t\t10000\t30000\t35000\r\nelzix\t512\t1024\t128\t9\t1024\t922\t1024\t\t\t\t\t\t\t\t\t10000\t30000\t35000\r\nfara\t512\t1024\t128\t9\t1024\t922\t1024\t\t\t\t\t\t\t\t\t10000\t30000\t35000\r\nhratli\t512\t1024\t128\t17\t1024\t922\t1024\t\t\t\t\t\t\t\t\t15000\t30000\t35000\r\nalkor\t512\t1024\t128\t17\t1024\t922\t1024\t\t\t\t\t\t\t\t\t15000\t30000\t35000\r\normus\t512\t1024\t128\t17\t1024\t922\t1024\t\t\t\t\t\t\t\t\t15000\t30000\t35000\r\nasheara\t512\t1024\t128\t17\t1024\t922\t1024\t\t\t\t\t\t\t\t\t15000\t30000\t35000\r\njamella\t512\t1024\t128\t41\t1024\t922\t1024\t\t\t\t\t\t\t\t\t20000\t30000\t35000\r\nhalbu\t512\t1024\t128\t41\t1024\t922\t1024\t\t\t\t\t\t\t\t\t20000\t30000\t35000\r\nmalah\t512\t2048\t128\t41\t1024\t922\t1024\t35\t1024\t512\t1024\t\t\t\t\t25000\t30000\t35000\r\ndrehya\t512\t2048\t128\t41\t1024\t922\t1024\t35\t1024\t512\t1024\t\t\t\t\t25000\t30000\t35000\r\nlarzuk\t512\t2048\t128\t41\t1024\t922\t1024\t35\t1024\t512\t922\t\t\t\t\t25000\t30000\t35000\r\nnihlathak\t512\t2048\t128\t41\t1024\t922\t1024\t35\t1024\t512\t1024\t\t\t\t\t25000\t30000\t35000\r\n"

export const RAW_GAMBLE: string = "name\tcode\r\namulet\tamu\r\nring\trin\r\nHand Axe\thax\r\nAxe\taxe\r\nDouble Axe\t2ax\r\nMilitary Pick\tmpi\r\nWar Axe\twax\r\nLarge Axe\tlax\r\nBroad Axe \tbax\r\nBattle Axe\tbtx\r\nGreat Axe\tgax\r\nGiant Axe\tgix\r\nClub\tclb\r\nSpiked Club\tspc\r\nMace\tmac\r\nMorning Star\tmst\r\nFlail\tfla\r\nWar Hammer\twhm\r\nMaul\tmau\r\nGreat Maul\tgma\r\nShort Sword\tssd\r\nScimitar\tscm\r\nSaber\tsbr\r\nFalchion\tflc\r\nCrystal Sword\tcrs\r\nBroad Sword\tbsd\r\nLong Sword \tlsd\r\nWar Sword\twsd\r\nTwo-Handed Sword\t2hs\r\nClaymore\tclm\r\nGiant Sword\tgis\r\nBastard Sword\tbsw\r\nFlamberge\tflb\r\nGreat Sword\tgsd\r\nDagger\tdgr\r\nDirk\tdir\r\nKriss\tkri\r\nBlade\tbld\r\nSpear\tspr\r\nTrident\ttri\r\nBrandistock\tbrn\r\nSpetum\tspt\r\nPike\tpik\r\nBardiche\tbar\r\nVoulge\tvou\r\nScythe\tscy\r\nPoleaxe\tpax\r\nHalberd\thal\r\nWar Scythe\twsc\r\nShort Bow\tsbw\r\nHunter's Bow\thbw\r\nLong Bow\tlbw\r\nComposite Bow\tcbw\r\nShort Battle Bow\tsbb\r\nLong Battle Bow\tlbb\r\nShort War Bow\tswb\r\nLong War Bow\tlwb\r\nLight Crossbow\tlxb\r\nCrossbow\tmxb\r\nHeavy Crossbow\thxb\r\nRepeating Crossbow\trxb\r\nCap/hat\tcap\r\nSkull Cap\tskp\r\nHelm\thlm\r\nFull Helm\tfhl\r\nGreat Helm\tghm\r\nCrown\tcrn\r\nMask\tmsk\r\nQuilted Armor\tqui\r\nLeather Armor\tlea\r\nHard Leather Armor\thla\r\nStudded Leather \tstu\r\nRing Mail\trng\r\nScale Mail\tscl\r\nChain Mail\tchn\r\nBreast Plate\tbrs\r\nSplint Mail\tspl\r\nPlate Mail\tplt\r\nField Plate\tfld\r\nGothic Plate\tgth\r\nFull Plate Mail\tful\r\nAncient Armor\taar\r\nLight Plate\tltp\r\nBuckler\tbuc\r\nSmall Shield\tsml\r\nLarge Shield\tlrg\r\nKite Shield\tkit\r\nTower Shield\ttow\r\nGothic Shield\tgts\r\nGloves(L)\tlgl\r\nHeavy Gloves\tvgl\r\nBracers(M)\tmgl\r\nLight Gauntlets\ttgl\r\nGaunlets(H)\thgl\r\nLeather Boots\tlbt\r\nHeavy Boots\tvbt\r\nChain Boots\tmbt\r\nLight Plate Boots\ttbt\r\nPlate Boots\thbt\r\nSash(L)\tlbl\r\nLight Belt\tvbl\r\nBelt(M)\tmbl\r\nHeavy Belt\ttbl\r\nGirdle(H)\thbl\r\nBone Helm\tbhm\r\nBone Shield\tbsh\r\nSpiked Shield\tspk\r\nExpansion\t\r\nThrowing Knife\ttkf\r\nThrowing Axe\ttax\r\nBalanced Knife\tbkf\r\nBalanced Axe\tbal\r\nJavelin\tjav\r\nPilum\tpil\r\nShort Spear\tssp\r\nGlaive\tglv\r\nThrowing Spear\ttsp\r\nKatar\tktr\r\nWrist Blade\twrb\r\nAxe Fist\taxf\r\nCestus\tces\r\nClaws\tclw\r\nBlade Talons\tbtl\r\nScissors Katar\tskr\r\nCirclet\tci0\r\nCoronet\tci1\r\n"

export const RAW_BOOKS: string = "Name\tNamco\tCompleted\tScrollSpellCode\tBookSpellCode\tpSpell\tSpellIcon\tScrollSkill\tBookSkill\tBaseCost\tCostPerCharge\r\nunused\tof Town Portal\t1\ttsc\ttbk\t2\t-1\tScroll of Townportal\tBook of Townportal\t250\t50\r\nunused\tof Identify\t1\tisc\tibk\t1\t0\tScroll of Identify\tBook of Identify\t200\t40\r\nunused\tof Ressurect\t0\t\t\t\t-1\t\t\t500\t100\r\n"

export const RAW_LOW_QUALITY_ITEMS: string = "Name\r\nCrude\r\nCracked\r\nDamaged\r\nLow Quality\r\n"

export const RAW_ITEM_STAT_COST: string = "Stat\tID\tSend Other\tSigned\tSend Bits\tSend Param Bits\tUpdateAnimRate\tSaved\tCSvSigned\tCSvBits\tCSvParam\tfCallback\tfMin\tMinAccr\tEncode\tAdd\tMultiply\tDivide\tValShift\t1.09-Save Bits\t1.09-Save Add\tSave Bits\tSave Add\tSave Param Bits\tkeepzero\top\top param\top base\top stat1\top stat2\top stat3\tdirect\tmaxstat\titemspecific\tdamagerelated\titemevent1\titemeventfunc1\titemevent2\titemeventfunc2\tdescpriority\tdescfunc\tdescval\tdescstrpos\tdescstrneg\tdescstr2\tdgrp\tdgrpfunc\tdgrpval\tdgrpstrpos\tdgrpstrneg\tdgrpstr2\tstuff\t*eol\r\nstrength\t0\t1\t\t11\t\t\t1\t0\t10\t\t\t1\t1\t\t125\t55\t1024\t\t7\t32\t8\t32\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t67\t1\t1\tModStr1a\tModStr1a\t\t1\t1\t1\tModitem2allattrib\tModitem2allattrib\t\t6\t0\r\nenergy\t1\t\t\t11\t\t\t1\t0\t10\t\t\t1\t1\t\t100\t55\t1024\t\t7\t32\t7\t32\t\t\t8\t\t\tmaxmana\t\t\t\t\t\t\t\t\t\t\t61\t1\t1\tModStr1d\tModStr1d\t\t1\t1\t1\tModitem2allattrib\tModitem2allattrib\t\t\t0\r\ndexterity\t2\t1\t\t11\t\t\t1\t0\t10\t\t\t1\t1\t\t125\t55\t1024\t\t7\t32\t7\t32\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t65\t1\t1\tModStr1b\tModStr1b\t\t1\t1\t1\tModitem2allattrib\tModitem2allattrib\t\t\t0\r\nvitality\t3\t\t\t11\t\t\t1\t0\t10\t\t\t1\t1\t\t100\t55\t1024\t\t7\t32\t7\t32\t\t\t9\t\t\tmaxhp\tmaxstamina\t\t\t\t\t\t\t\t\t\t63\t1\t1\tModStr1c\tModStr1c\t\t1\t1\t1\tModitem2allattrib\tModitem2allattrib\t\t\t0\r\nstatpts\t4\t\t\t9\t\t\t1\t0\t10\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nnewskills\t5\t\t\t9\t\t\t1\t0\t8\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nhitpoints\t6\t\t\t32\t\t\t1\t0\t21\t\t\t\t\t\t\t\t1024\t8\t\t\t\t\t\t\t\t\t\t\t\t\t1\tmaxhp\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nmaxhp\t7\t\t\t32\t\t\t1\t0\t21\t\t1\t1\t1\t\t56\t20\t1024\t8\t8\t32\t9\t32\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t59\t1\t1\tModStr1u\tModStr1u\t\t\t\t\t\t\t\t\t0\r\nmana\t8\t\t\t32\t\t\t1\t0\t21\t\t\t\t\t\t\t\t1024\t8\t\t\t\t\t\t1\t\t\t\t\t\t\t1\tmaxmana\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nmaxmana\t9\t\t\t32\t\t\t1\t0\t21\t\t1\t1\t0\t\t81\t20\t1024\t8\t8\t32\t8\t32\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t55\t1\t1\tModStr1e\tModStr1e\t\t\t\t\t\t\t\t\t0\r\nstamina\t10\t\t\t32\t\t\t1\t0\t21\t\t\t\t\t\t\t\t1024\t8\t\t\t\t\t\t1\t\t\t\t\t\t\t1\tmaxstamina\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nmaxstamina\t11\t\t\t32\t\t\t1\t0\t21\t\t1\t1\t0\t\t75\t20\t1024\t8\t8\t32\t8\t32\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t51\t1\t1\tModStr5d\tModStr5d\t\t\t\t\t\t\t\t\t0\r\nlevel\t12\t\t\t9\t\t\t1\t0\t7\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nexperience\t13\t\t\t32\t\t\t1\t0\t32\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\ngold\t14\t\t\t32\t\t\t1\t0\t25\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\ngoldbank\t15\t\t\t32\t\t\t1\t0\t25\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_armor_percent\t16\t\t1\t11\t\t\t\t\t\t\t\t\t\t\t47\t20\t1024\t\t9\t0\t9\t0\t\t\t13\t\t\tarmorclass\t\t\t\t\t\t\t\t\t\t\t74\t4\t1\tModstr2v\tModstr2v\t\t\t\t\t\t\t\t\t0\r\nitem_maxdamage_percent\t17\t\t1\t11\t\t\t\t\t\t\t\t\t\t\t45\t20\t1024\t\t9\t0\t9\t0\t\t\t13\t\t\tmaxdamage\tsecondary_maxdamage\titem_throw_maxdamage\t\t\t\t1\t\t\t\t\t129\t3\t0\tModStr2j\tModStr2j\t\t\t\t\t\t\t\t\t0\r\nitem_mindamage_percent\t18\t\t1\t11\t\t\t\t\t\t\t\t\t\t\t45\t20\t1024\t\t9\t0\t9\t0\t\t\t13\t\t\tmindamage\tsecondary_mindamage\titem_throw_mindamage\t\t\t\t1\t\t\t\t\t130\t3\t0\tModStr2k\tModStr2k\t\t\t\t\t\t\t\t\t0\r\ntohit\t19\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t15\t10\t1024\t\t10\t\t10\t\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t115\t1\t1\tModStr1h\tModStr1h\t\t\t\t\t\t\t\t\t0\r\ntoblock\t20\t\t1\t10\t\t\t\t\t\t\t\t\t\t\t89\t204\t1024\t\t6\t0\t6\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t134\t2\t1\tModStr3g\tModStr3g\t\t\t\t\t\t\t\t\t0\r\nmindamage\t21\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t122\t25\t1024\t\t6\t0\t6\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t127\t1\t1\tModStr1g\tModStr1g\t\t\t\t\t\t\t\t\t0\r\nmaxdamage\t22\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t94\t16\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t126\t1\t1\tModStr1f\tModStr1f\t\t\t\t\t\t\t\t\t0\r\nsecondary_mindamage\t23\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t97\t15\t1024\t\t6\t0\t6\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t124\t1\t1\tModStr1g\tModStr1g\t\t\t\t\t\t\t\t\t0\r\nsecondary_maxdamage\t24\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t85\t11\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t123\t1\t1\tModStr1f\tModStr1f\t\t\t\t\t\t\t\t\t0\r\ndamagepercent\t25\t\t1\t12\t\t\t\t\t\t\t\t\t\t\t45\t40\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nmanarecovery\t26\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nmanarecoverybonus\t27\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t52\t2\t2\tModStr4g\tModStr4g\t\t\t\t\t\t\t\t\t0\r\nstaminarecoverybonus\t28\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t48\t2\t2\tModStr3v\tModStr3v\t\t\t\t\t\t\t\t\t0\r\nlastexp\t29\t\t\t32\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nnextexp\t30\t\t\t32\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\narmorclass\t31\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t17\t10\t1024\t\t10\t10\t11\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t71\t1\t1\tModStr1i\tModStr1i\t\t\t\t\t\t\t\t\t0\r\narmorclass_vs_missile\t32\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t11\t5\t1024\t\t8\t0\t9\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t69\t1\t1\tModStr6a\tModStr6a\t\t\t\t\t\t\t\t\t0\r\narmorclass_vs_hth\t33\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t13\t7\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t70\t1\t1\tModStr6b\tModStr6b\t\t\t\t\t\t\t\t\t0\r\nnormal_damage_reduction\t34\t\t1\t10\t\t\t\t\t\t\t\t\t\t\t188\t200\t1024\t\t6\t0\t6\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t22\t3\t2\tModStr2u\tModStr2u\t\t\t\t\t\t\t\t\t0\r\nmagic_damage_reduction\t35\t\t1\t10\t\t\t\t\t\t\t\t\t\t\t397\t340\t1024\t\t6\t0\t6\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t21\t3\t2\tModStr2t\tModStr2t\t\t\t\t\t\t\t\t\t0\r\ndamageresist\t36\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t152\t68\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t22\t2\t2\tModStr2u\tModStr2u\t\t\t\t\t\t\t\t\t0\r\nmagicresist\t37\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t164\t68\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t41\t4\t2\tModStr1m\tModStr1m\t\t\t\t\t\t\t\t\t0\r\nmaxmagicresist\t38\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t1091\t409\t1024\t\t5\t0\t5\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t46\t4\t1\tModStr5x\tModStr5x\t\t\t\t\t\t\t\t\t0\r\nfireresist\t39\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t43\t20\t1024\t\t8\t0\t8\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t36\t4\t2\tModStr1j\tModStr1j\t\t2\t19\t\tstrModAllResistances\tstrModAllResistances\t\t\t0\r\nmaxfireresist\t40\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t584\t256\t1024\t\t5\t0\t5\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t42\t4\t1\tModStr5u\tModStr5u\t\t\t\t\t\t\t\t\t0\r\nlightresist\t41\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t43\t20\t1024\t\t8\t0\t8\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t38\t4\t2\tModStr1l\tModStr1l\t\t2\t19\t\tstrModAllResistances\tstrModAllResistances\t\t\t0\r\nmaxlightresist\t42\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t584\t256\t1024\t\t5\t0\t5\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t43\t4\t1\tModStr5w\tModStr5w\t\t\t\t\t\t\t\t\t0\r\ncoldresist\t43\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t43\t20\t1024\t\t8\t0\t8\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t40\t4\t2\tModStr1k\tModStr1k\t\t2\t19\t\tstrModAllResistances\tstrModAllResistances\t\t\t0\r\nmaxcoldresist\t44\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t584\t256\t1024\t\t5\t0\t5\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t44\t4\t1\tModStr5v\tModStr5v\t\t\t\t\t\t\t\t\t0\r\npoisonresist\t45\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t43\t20\t1024\t\t8\t0\t8\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t34\t4\t2\tModStr1n\tModStr1n\t\t2\t19\t\tstrModAllResistances\tstrModAllResistances\t\t\t0\r\nmaxpoisonresist\t46\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t526\t256\t1024\t\t5\t0\t5\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t45\t4\t1\tModStr5y\tModStr5y\t\t\t\t\t\t\t\t\t0\r\ndamageaura\t47\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nfiremindam\t48\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t11\t10\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t102\t1\t1\tModStr1p\tModStr1p\t\t\t\t\t\t\t\t\t0\r\nfiremaxdam\t49\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t19\t10\t1024\t\t8\t0\t9\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t101\t1\t1\tModStr1o\tModStr1o\t\t\t\t\t\t\t\t\t0\r\nlightmindam\t50\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t12\t10\t1024\t\t6\t0\t6\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t99\t1\t1\tModStr1r\tModStr1r\t\t\t\t\t\t\t\t\t0\r\nlightmaxdam\t51\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t17\t10\t1024\t\t9\t0\t10\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t98\t1\t1\tModStr1q\tModStr1q\t\t\t\t\t\t\t\t\t0\r\nmagicmindam\t52\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t196\t20\t1024\t\t6\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t104\t1\t1\tstrModMagicDamage\tstrModMagicDamage\t\t\t\t\t\t\t\t\t0\r\nmagicmaxdam\t53\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t183\t20\t1024\t\t7\t0\t9\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t103\t1\t1\tstrModMagicDamage\tstrModMagicDamage\t\t\t\t\t\t\t\t\t0\r\ncoldmindam\t54\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t451\t512\t1024\t\t6\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t96\t1\t1\tModStr1t\tModStr1t\t\t\t\t\t\t\t\t\t0\r\ncoldmaxdam\t55\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t128\t340\t1024\t\t8\t0\t9\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t95\t1\t1\tModStr1s\tModStr1s\t\t\t\t\t\t\t\t\t0\r\ncoldlength\t56\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t77\t4\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\npoisonmindam\t57\t\t1\t19\t\t\t\t\t\t\t\t\t\t\t12\t28\t1024\t\t9\t0\t10\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t92\t1\t1\tModStr4i\tModStr4i\t\t\t\t\t\t\t\t\t0\r\npoisonmaxdam\t58\t\t1\t19\t\t\t\t\t\t\t\t\t\t\t11\t34\t1024\t\t9\t0\t10\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t91\t1\t1\tModStr4h\tModStr4h\t\t\t\t\t\t\t\t\t0\r\npoisonlength\t59\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t0\t4\t1024\t\t8\t0\t9\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nlifedrainmindam\t60\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t1044\t341\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t88\t2\t1\tModStr2z\tModStr2z\t\t\t\t\t\t\t\t\t0\r\nlifedrainmaxdam\t61\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nmanadrainmindam\t62\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t1179\t341\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t89\t2\t1\tModStr2y\tModStr2y\t\t\t\t\t\t\t\t\t0\r\nmanadrainmaxdam\t63\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nstamdrainmindam\t64\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nstamdrainmaxdam\t65\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nstunlength\t66\t\t\t16\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nvelocitypercent\t67\t1\t1\t10\t\t1\t\t\t\t\t\t\t\t\t\t\t1024\t\t7\t30\t7\t30\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nattackrate\t68\t1\t1\t10\t\t1\t\t\t\t\t\t\t\t\t\t\t1024\t\t7\t30\t7\t30\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nother_animrate\t69\t1\t1\t10\t\t1\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nquantity\t70\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nvalue\t71\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t8\t100\t8\t100\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\ndurability\t72\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t8\t0\t9\t0\t\t\t\t\t\t\t\t\t1\tmaxdurability\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nmaxdurability\t73\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t9\t4\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nhpregen\t74\t\t\t\t\t\t\t\t\t\t\t\t\t\t451\t410\t1024\t\t6\t30\t6\t30\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t56\t1\t2\tModStr2l\tModStr2w\t\t\t\t\t\t\t\t\t0\r\nitem_maxdurability_percent\t75\t\t1\t7\t\t\t\t\t\t\t\t\t\t\t117\t10\t1024\t\t7\t20\t7\t20\t\t\t13\t\t\tmaxdurability\t\t\t\t\t\t\t\t\t\t\t3\t2\t2\tModStr2i\tModStr2i\t\t\t\t\t\t\t\t\t0\r\nitem_maxhp_percent\t76\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t32093\t204\t1024\t\t6\t10\t6\t10\t\t\t11\t\t\tmaxhp\t\t\t\t\t\t\t\t\t\t\t58\t2\t2\tModStr2g\tModStr2g\t\t\t\t\t\t\t\t\t0\r\nitem_maxmana_percent\t77\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t56452\t204\t1024\t\t6\t10\t6\t10\t\t\t11\t\t\tmaxmana\t\t\t\t\t\t\t\t\t\t\t54\t2\t2\tModStr2h\tModStr2h\t\t\t\t\t\t\t\t\t0\r\nitem_attackertakesdamage\t78\t\t1\t16\t\t\t\t\t\t\t1\t\t\t\t112\t128\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t\tdamagedinmelee\t6\t\t\t13\t3\t2\tModStr1v\tModStr1v\t\t\t\t\t\t\t\t\t0\r\nitem_goldbonus\t79\t\t1\t10\t\t\t\t\t\t\t\t\t\t\t187\t34\t1024\t\t9\t100\t9\t100\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t10\t2\t1\tModStr1w\tModStr1w\t\t\t\t\t\t\t\t\t0\r\nitem_magicbonus\t80\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t577\t102\t1024\t\t8\t100\t8\t100\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t8\t2\t1\tModStr1x\tModStr1x\t\t\t\t\t\t\t\t\t0\r\nitem_knockback\t81\t\t1\t8\t\t\t\t\t\t\t1\t\t\t\t105\t0\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t1\tdomeleedamage\t7\tdomissiledamage\t7\t76\t3\t0\tModStr1y\tModStr1y\t\t\t\t\t\t\t\t\t0\r\nitem_timeduration\t82\t\t1\t10\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t9\t20\t9\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_addclassskills\t83\t\t1\t4\t3\t\t\t\t\t\t1\t\t\t\t49523\t1560\t1024\t\t3\t0\t3\t0\t3\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t150\t13\t1\tModStr3a\tModStr3a\t\t\t\t\t\t\t\t\t0\r\nunsentparam1\t84\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t3\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_addexperience\t85\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t36015\t519\t1024\t\t3\t0\t9\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t11\t4\t1\tModitem2ExpG\tModitem2ExpG\t\t\t\t\t\t\t\t\t0\r\nitem_healafterkill\t86\t\t1\t7\t\t\t\t\t\t\t1\t\t\t\t30\t101\t1024\t\t3\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t\tkill\t28\t\t\t16\t1\t1\tModitemHPaK\tModitemHPaK\t\t\t\t\t\t\t\t\t0\r\nitem_reducedprices\t87\t\t\t8\t\t\t\t\t\t\t\t\t\t\t18957\t203\t1024\t\t3\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t8\t2\t2\tModitemRedVendP\tModitemRedVendP\t\t\t\t\t\t\t\t\t0\r\nitem_doubleherbduration\t88\t\t1\t2\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t1\t0\t1\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_lightradius\t89\t\t1\t5\t\t\t\t\t\t\t1\t\t\t\t15\t51\t1024\t\t4\t4\t4\t4\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t6\t1\t1\tModStr3f\tModStr3f\t\t\t\t\t\t\t\t\t0\r\nitem_lightcolor\t90\t\t1\t24\t\t\t\t\t\t\t1\t\t\t\t155\t0\t1024\t\t5\t0\t24\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_req_percent\t91\t\t1\t8\t\t\t\t\t\t\t\t\t\t\t26\t-34\t1024\t\t8\t100\t8\t100\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\t4\t2\tModStr3h\tModStr3h\t\t\t\t\t\t\t\t\t0\r\nitem_levelreq\t92\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t6\t20\t7\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_fasterattackrate\t93\t1\t1\t9\t\t\t\t\t\t\t\t\t\t\t1042\t156\t1024\t\t7\t20\t7\t20\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t145\t4\t1\tModStr4m\tModStr4m\t\t\t\t\t\t\t\t\t0\r\nitem_levelreqpct\t94\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t7\t20\t7\t64\t\t\t13\t\t\titem_levelreq\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nlastblockframe\t95\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t6\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_fastermovevelocity\t96\t1\t1\t9\t\t\t\t\t\t\t\t\t\t\t4083\t156\t1024\t\t7\t20\t7\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t148\t4\t1\tModStr4s\tModStr4s\t\t\t\t\t\t\t\t\t0\r\nitem_nonclassskill\t97\t\t1\t15\t9\t\t\t\t\t\t1\t\t\t1\t181\t327\t1024\t\t7\t20\t6\t0\t9\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t81\t28\t\t\t\t\t\t\t\t\t\t\t\t0\r\nstate\t98\t1\t\t1\t8\t\t\t\t\t\t1\t\t\t\t415\t64\t1024\t\t6\t20\t1\t\t8\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_fastergethitrate\t99\t1\t1\t9\t\t\t\t\t\t\t\t\t\t\t1065\t72\t1024\t\t7\t20\t7\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t139\t4\t1\tModStr4p\tModStr4p\t\t\t\t\t\t\t\t\t0\r\nmonster_playercount\t100\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t7\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nskill_poison_override_length\t101\t\t\t8\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t6\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_fasterblockrate\t102\t1\t1\t9\t\t\t\t\t\t\t\t\t\t\t1484\t72\t1024\t\t7\t20\t7\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t136\t4\t1\tModStr4y\tModStr4y\t\t\t\t\t\t\t\t\t0\r\nskill_bypass_undead\t103\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t7\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nskill_bypass_demons\t104\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t6\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_fastercastrate\t105\t1\t1\t9\t\t\t\t\t\t\t\t\t\t\t3876\t156\t1024\t\t7\t20\t7\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t142\t4\t1\tModStr4v\tModStr4v\t\t\t\t\t\t\t\t\t0\r\nskill_bypass_beasts\t106\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t7\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_singleskill\t107\t\t1\t15\t9\t\t\t\t\t\t1\t\t\t1\t181\t256\t1024\t\t14\t0\t3\t0\t9\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t81\t27\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_restinpeace\t108\t\t\t1\t\t\t\t\t\t\t1\t\t\t\t1987\t0\t1024\t\t14\t0\t1\t0\t\t\t\t\t\t\t\t\t\t\t\t1\tkill\t29\t\t\t81\t3\t0\tModitemSMRIP\tModitemSMRIP\t\t\t\t\t\t\t\t\t0\r\ncurse_resistance\t109\t\t\t9\t\t\t\t\t\t\t\t\t\t\t159\t33\t1024\t\t14\t0\t9\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_poisonlengthresist\t110\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t27\t10\t1024\t\t8\t20\t8\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t18\t2\t2\tModStr3r\tModStr3r\t\t\t\t\t\t\t\t\t0\r\nitem_normaldamage\t111\t\t1\t8\t\t\t\t\t\t\t\t\t\t\t94\t100\t1024\t\t7\t20\t9\t20\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t122\t1\t2\tModStr5b\tModStr5b\t\t\t\t\t\t\t\t\t0\r\nitem_howl\t112\t\t1\t8\t\t\t\t\t\t\t1\t\t\t\t55\t10\t1024\t\t7\t-1\t7\t-1\t\t\t\t\t\t\t\t\t\t\t\t1\tdomeleedamage\t8\tdomissiledamage\t8\t79\t5\t2\tModStr3u\tModStr3u\t\t\t\t\t\t\t\t\t0\r\nitem_stupidity\t113\t\t1\t8\t\t\t\t\t\t\t1\t\t\t\t332\t1024\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t1\tdomeleedamage\t9\tdomissiledamage\t9\t80\t12\t2\tModStr6d\tModStr6d\t\t\t\t\t\t\t\t\t0\r\nitem_damagetomana\t114\t\t1\t7\t\t\t\t\t\t\t1\t\t\t\t43\t20\t1024\t\t6\t0\t6\t0\t\t\t\t\t\t\t\t\t\t\t\t\tdamagedinmelee\t13\tdamagedbymissile\t13\t11\t2\t1\tModStr3w\tModStr3w\t\t\t\t\t\t\t\t\t0\r\nitem_ignoretargetac\t115\t\t1\t2\t\t\t\t\t\t\t\t\t\t\t1088\t1024\t1024\t\t1\t0\t1\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t119\t3\t0\tModStr3y\tModStr3y\t\t\t\t\t\t\t\t\t0\r\nitem_fractionaltargetac\t116\t\t1\t8\t\t\t\t\t\t\t\t\t\t\t67\t20\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t118\t20\t1\tModStr5o\tModStr5o\t\t\t\t\t\t\t\t\t0\r\nitem_preventheal\t117\t\t1\t8\t\t\t\t\t\t\t\t\t\t\t48\t50\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t81\t3\t0\tModStr4a\tModStr4a\t\t\t\t\t\t\t\t\t0\r\nitem_halffreezeduration\t118\t\t1\t2\t\t\t\t\t\t\t\t\t\t\t5096\t988\t1024\t\t1\t0\t1\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t19\t3\t0\tModStr4b\tModStr4b\t\t\t\t\t\t\t\t\t0\r\nitem_tohit_percent\t119\t\t1\t12\t\t\t\t\t\t\t\t\t\t\t981\t40\t1024\t\t9\t20\t9\t20\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t117\t2\t1\tModStr4c\tModStr4c\t\t\t\t\t\t\t\t\t0\r\nitem_damagetargetac\t120\t\t1\t8\t\t\t\t\t\t\t\t\t\t\t24\t-20\t1024\t\t7\t128\t7\t128\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t75\t1\t1\tModStr4d\tModStr4d\t\t\t\t\t\t\t\t\t0\r\nitem_demondamage_percent\t121\t\t1\t12\t\t\t\t\t\t\t\t\t\t\t19\t12\t1024\t\t9\t20\t9\t20\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t112\t4\t1\tModStr4e\tModStr4e\t\t\t\t\t\t\t\t\t0\r\nitem_undeaddamage_percent\t122\t\t1\t12\t\t\t\t\t\t\t\t\t\t\t13\t12\t1024\t\t9\t20\t9\t20\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t108\t4\t1\tModStr4f\tModStr4f\t\t\t\t\t\t\t\t\t0\r\nitem_demon_tohit\t123\t\t1\t13\t\t\t\t\t\t\t\t\t\t\t15\t7\t1024\t\t10\t128\t10\t128\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t110\t1\t1\tModStr4j\tModStr4j\t\t\t\t\t\t\t\t\t0\r\nitem_undead_tohit\t124\t\t1\t13\t\t\t\t\t\t\t\t\t\t\t11\t7\t1024\t\t10\t128\t10\t128\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t106\t1\t1\tModStr4k\tModStr4k\t\t\t\t\t\t\t\t\t0\r\nitem_throwable\t125\t\t1\t2\t\t\t\t\t\t\t\t\t\t\t82\t1024\t1024\t\t1\t0\t1\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t5\t3\t0\tModStr5a\tModStr5a\t\t\t\t\t\t\t\t\t0\r\nitem_elemskill\t126\t\t1\t3\t3\t\t\t\t\t\t1\t\t\t\t76\t1024\t1024\t\t4\t0\t3\t0\t3\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t157\t1\t1\tModStr3i\tModStr3i\t\t\t\t\t\t\t\t\t0\r\nitem_allskills\t127\t\t1\t8\t\t\t\t\t\t\t1\t\t\t\t15123\t4096\t1024\t\t3\t0\t3\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t158\t1\t1\tModStr3k\tModStr3k\t\t\t\t\t\t\t\t\t0\r\nitem_attackertakeslightdamage\t128\t\t1\t6\t\t\t\t\t\t\t1\t\t\t\t4\t102\t1024\t\t5\t0\t5\t0\t\t\t\t\t\t\t\t\t\t\t\t\tdamagedinmelee\t10\t\t\t14\t3\t2\tModStr3j\tModStr3j\t\t\t\t\t\t\t\t\t0\r\nironmaiden_level\t129\t\t1\t10\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nlifetap_level\t130\t\t1\t10\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nthorns_percent\t131\t\t\t12\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nbonearmor\t132\t\t1\t32\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nbonearmormax\t133\t\t1\t32\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_freeze\t134\t\t1\t5\t\t\t\t\t\t\t1\t\t\t\t666\t12\t1024\t\t5\t0\t5\t0\t\t\t\t\t\t\t\t\t\t\t\t1\tdomeleedamage\t14\tdomissiledamage\t14\t78\t12\t2\tModStr3l\tModStr3l\t\t\t\t\t\t\t\t\t0\r\nitem_openwounds\t135\t\t1\t7\t\t\t\t\t\t\t1\t\t\t\t23\t10\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t1\tdomeleedamage\t15\tdomissiledamage\t15\t83\t2\t1\tModStr3m\tModStr3m\t\t\t\t\t\t\t\t\t0\r\nitem_crushingblow\t136\t\t1\t7\t\t\t\t\t\t\t1\t\t\t\t98\t40\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t1\tdomeleedamage\t16\tdomissiledamage\t16\t87\t2\t1\tModStr5c\tModStr5c\t\t\t\t\t\t\t\t\t0\r\nitem_kickdamage\t137\t\t1\t7\t\t\t\t\t\t\t\t\t\t\t77\t51\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t121\t1\t1\tModStr5e\tModStr5e\t\t\t\t\t\t\t\t\t0\r\nitem_manaafterkill\t138\t\t1\t7\t\t\t\t\t\t\t1\t\t\t\t17\t102\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t\tkill\t17\t\t\t16\t1\t1\tModStr5f\tModStr5f\t\t\t\t\t\t\t\t\t0\r\nitem_healafterdemonkill\t139\t\t1\t7\t\t\t\t\t\t\t1\t\t\t\t18\t102\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t\tkill\t18\t\t\t15\t1\t1\tModStr6c\tModStr6c\t\t\t\t\t\t\t\t\t0\r\nitem_extrablood\t140\t\t1\t7\t\t\t\t\t\t\t\t\t\t\t15\t10\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_deadlystrike\t141\t\t1\t7\t\t\t\t\t\t\t\t\t\t\t31\t25\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t85\t2\t1\tModStr5q\tModStr5q\t\t\t\t\t\t\t\t\t0\r\nitem_absorbfire_percent\t142\t\t1\t7\t\t\t\t\t\t\t\t\t\t\t5486\t102\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t23\t2\t2\tModStr5g\tModStr5g\t\t\t\t\t\t\t\t\t0\r\nitem_absorbfire\t143\t\t1\t7\t\t\t\t\t\t\t\t\t\t\t1739\t204\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t27\t1\t1\tModStr5h\tModStr5h\t\t\t\t\t\t\t\t\t0\r\nitem_absorblight_percent\t144\t\t1\t7\t\t\t\t\t\t\t\t\t\t\t5486\t102\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t24\t2\t2\tModStr5i\tModStr5i\t\t\t\t\t\t\t\t\t0\r\nitem_absorblight\t145\t\t1\t7\t\t\t\t\t\t\t\t\t\t\t1739\t204\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t29\t1\t1\tModStr5j\tModStr5j\t\t\t\t\t\t\t\t\t0\r\nitem_absorbmagic_percent\t146\t\t1\t7\t\t\t\t\t\t\t\t\t\t\t5486\t102\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t26\t2\t2\tModStr5k\tModStr5k\t\t\t\t\t\t\t\t\t0\r\nitem_absorbmagic\t147\t\t1\t7\t\t\t\t\t\t\t\t\t\t\t1739\t204\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t33\t1\t1\tModStr5l\tModStr5l\t\t\t\t\t\t\t\t\t0\r\nitem_absorbcold_percent\t148\t\t1\t7\t\t\t\t\t\t\t\t\t\t\t5486\t102\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t25\t2\t2\tModStr5m\tModStr5m\t\t\t\t\t\t\t\t\t0\r\nitem_absorbcold\t149\t\t1\t7\t\t\t\t\t\t\t\t\t\t\t1739\t204\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t31\t1\t1\tModStr5n\tModStr5n\t\t\t\t\t\t\t\t\t0\r\nitem_slow\t150\t\t1\t7\t\t\t\t\t\t\t1\t\t\t\t101\t40\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t1\tdomeleedamage\t19\tdomissiledamage\t19\t77\t2\t2\tModStr5r\tModStr5r\t\t\t\t\t\t\t\t\t0\r\nitem_aura\t151\t\t1\t\t\t\t\t\t\t\t1\t\t\t\t\t\t1024\t\t7\t0\t5\t0\t9\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t159\t16\t0\tModitemAura\tModitemAura\t\t\t\t\t\t\t\t\t0\r\nitem_indesctructible\t152\t\t1\t1\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t7\t0\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t160\t3\t0\tModStre9s\tModStre9s\t\t\t\t\t\t\t\t\t0\r\nitem_cannotbefrozen\t153\t\t1\t2\t\t\t\t\t\t\t\t\t\t\t15011\t2048\t1024\t\t1\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t20\t3\t0\tModStr5z\tModStr5z\t\t\t\t\t\t\t\t\t0\r\nitem_staminadrainpct\t154\t\t1\t7\t\t\t\t\t\t\t\t\t\t\t102\t20\t1024\t\t7\t20\t7\t20\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t49\t2\t1\tModStr6e\tModStr6e\t\t\t\t\t\t\t\t\t0\r\nitem_reanimate\t155\t\t\t7\t10\t\t\t\t\t\t1\t\t\t\t\t\t1024\t\t7\t0\t7\t0\t10\t\t\t\t\t\t\t\t\t\t\t1\tkill\t31\t\t\t17\t23\t1\tModitemreanimas\tModitemreanimas\t\t\t\t\t\t\t\t\t0\r\nitem_pierce\t156\t\t1\t7\t\t\t\t\t\t\t\t\t\t\t1924\t2048\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t132\t3\t0\tModStr6g\tModStr6g\t\t\t\t\t\t\t\t\t0\r\nitem_magicarrow\t157\t\t1\t7\t\t\t\t\t\t\t\t\t\t\t511\t1024\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t131\t3\t0\tModStr6h\tModStr6h\t\t\t\t\t\t\t\t\t0\r\nitem_explosivearrow\t158\t\t1\t7\t\t\t\t\t\t\t\t\t\t\t492\t1536\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t133\t3\t0\tModStr6i\tModStr6i\t\t\t\t\t\t\t\t\t0\r\nitem_throw_mindamage\t159\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t76\t128\t1024\t\t6\t0\t6\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_throw_maxdamage\t160\t\t1\t7\t\t\t\t\t\t\t\t\t\t\t88\t128\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nskill_handofathena\t161\t\t1\t12\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nskill_staminapercent\t162\t\t1\t13\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t1\t\t\tmaxstamina\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nskill_passive_staminapercent\t163\t\t1\t12\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t1\t\t\tmaxstamina\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nskill_concentration\t164\t\t1\t12\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nskill_enchant\t165\t\t1\t12\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nskill_pierce\t166\t\t1\t12\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nskill_conviction\t167\t\t1\t12\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nskill_chillingarmor\t168\t\t1\t12\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nskill_frenzy\t169\t\t1\t12\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nskill_decrepify\t170\t\t1\t12\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nskill_armor_percent\t171\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nalignment\t172\t1\t\t2\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\ntarget0\t173\t\t\t32\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\ntarget1\t174\t\t\t32\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\ngoldlost\t175\t\t\t24\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nconversion_level\t176\t\t\t8\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nconversion_maxhp\t177\t\t\t16\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nunit_dooverlay\t178\t\t\t16\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nattack_vs_montype\t179\t\t\t9\t10\t\t\t\t\t\t\t\t\t\t19\t14\t1024\t\t3\t0\t9\t\t10\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t108\t22\t1\tModitemAttratvsM\tModitemAttratvsM\t\t\t\t\t\t\t\t\t0\r\ndamage_vs_montype\t180\t\t\t9\t10\t\t\t\t\t\t\t\t\t\t27\t17\t1024\t\t3\t0\t9\t\t10\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t106\t22\t1\tModitemdamvsm\tModitemdamvsm\t\t\t\t\t\t\t\t\t0\r\nfade\t181\t1\t\t7\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t14\t0\t3\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\narmor_override_percent\t182\t1\t1\t8\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t14\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nunused183\t183\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t14\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nunused184\t184\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t14\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nunused185\t185\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t14\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nunused186\t186\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t14\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nunused187\t187\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t14\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_addskill_tab\t188\t\t1\t3\t6\t\t\t\t\t\t1\t\t\t\t11042\t768\t1024\t\t10\t0\t3\t0\t16\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t151\t14\t\tStrSklTabItem1\tStrSklTabItem1\t\t\t\t\t\t\t\t\t0\r\nunused189\t189\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t10\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nunused190\t190\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t10\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nunused191\t191\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t10\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nunused192\t192\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t10\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nunused193\t193\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t10\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_numsockets\t194\t\t1\t4\t\t\t\t\t\t\t\t\t\t\t38\t170\t1024\t\t4\t0\t4\t0\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_skillonattack\t195\t\t1\t7\t16\t\t\t\t\t\t1\t\t\t2\t190\t256\t1024\t\t21\t0\t7\t0\t16\t\t\t\t\t\t\t\t\t\t\t1\tdomeleeattack\t20\tdomissileattack\t20\t160\t15\t\tItemExpansiveChancX\tItemExpansiveChancX\t\t\t\t\t\t\t\t\t0\r\nitem_skillonkill\t196\t\t1\t7\t16\t\t\t\t\t\t1\t\t\t2\t85\t19\t1024\t\t21\t0\t7\t0\t16\t\t\t\t\t\t\t\t\t\t\t1\tkill\t20\t\t\t160\t15\t\tModitemskonKill\tModitemskonKill\t\t\t\t\t\t\t\t\t0\r\nitem_skillondeath\t197\t\t1\t7\t16\t\t\t\t\t\t1\t\t\t2\t11\t9\t1024\t\t21\t0\t7\t0\t16\t\t\t\t\t\t\t\t\t\t\t\tkilled\t30\t\t\t160\t15\t\tModitemskondeath\tModitemskondeath\t\t\t\t\t\t\t\t\t0\r\nitem_skillonhit\t198\t\t1\t7\t16\t\t\t\t\t\t1\t\t\t2\t190\t256\t1024\t\t21\t0\t7\t0\t16\t\t\t\t\t\t\t\t\t\t\t1\tdomeleedamage\t20\tdomissiledamage\t20\t160\t15\t\tItemExpansiveChanc1\tItemExpansiveChanc1\t\t\t\t\t\t\t\t\t0\r\nitem_skillonlevelup\t199\t\t1\t7\t16\t\t\t\t\t\t1\t\t\t2\t7\t6\t1024\t\t21\t0\t7\t0\t16\t\t\t\t\t\t\t\t\t\t\t\tlevelup\t30\t\t\t160\t15\t\tModitemskonLevel\tModitemskonLevel\t\t\t\t\t\t\t\t\t0\r\nunused200\t200\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t21\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_skillongethit\t201\t\t1\t7\t16\t\t\t\t\t\t1\t\t\t2\t190\t256\t1024\t\t21\t0\t7\t0\t16\t\t\t\t\t\t\t\t\t\t\t\tdamagedinmelee\t21\tdamagedbymissile\t21\t160\t15\t\tItemExpansiveChanc2\tItemExpansiveChanc2\t\t\t\t\t\t\t\t\t0\r\nunused202\t202\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t21\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nunused203\t203\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t21\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_charged_skill\t204\t\t1\t30\t\t\t\t\t\t\t1\t\t\t3\t401\t256\t1024\t\t30\t0\t16\t0\t16\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1\t24\t\tModStre10d\tModStre10d\t\t\t\t\t\t\t\t\t0\r\nunused204\t205\t\t1\t30\t\t\t\t\t\t\t\t\t\t3\t401\t256\t1024\t\t30\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nunused205\t206\t\t1\t30\t\t\t\t\t\t\t\t\t\t3\t401\t256\t1024\t\t30\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nunused206\t207\t\t1\t30\t\t\t\t\t\t\t\t\t\t3\t401\t256\t1024\t\t30\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nunused207\t208\t\t1\t30\t\t\t\t\t\t\t\t\t\t3\t401\t256\t1024\t\t30\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nunused208\t209\t\t1\t30\t\t\t\t\t\t\t\t\t\t3\t401\t256\t1024\t\t30\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nunused209\t210\t\t1\t30\t\t\t\t\t\t\t\t\t\t3\t401\t256\t1024\t\t30\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nunused210\t211\t\t1\t30\t\t\t\t\t\t\t\t\t\t3\t401\t256\t1024\t\t30\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nunused211\t212\t\t1\t30\t\t\t\t\t\t\t\t\t\t3\t401\t256\t1024\t\t30\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nunused212\t213\t\t1\t30\t\t\t\t\t\t\t\t\t\t3\t401\t256\t1024\t\t30\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_armor_perlevel\t214\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t43\t42\t1024\t\t6\t0\t6\t0\t\t\t4\t3\tlevel\tarmorclass\t\t\t\t\t\t\t\t\t\t\t72\t6\t1\tModStr1i\tModStr1i\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_armorpercent_perlevel\t215\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t87\t100\t1024\t\t6\t0\t6\t0\t\t\t5\t3\tlevel\tarmorclass\t\t\t\t\t\t\t\t\t\t\t73\t8\t1\tModstr2v\tModstr2v\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_hp_perlevel\t216\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t92\t64\t1024\t8\t6\t0\t6\t0\t\t\t2\t3\tlevel\tmaxhp\t\t\t\t\t\t\t\t\t\t\t57\t6\t1\tModStr1u\tModStr1u\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_mana_perlevel\t217\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t90\t128\t1024\t8\t6\t0\t6\t0\t\t\t2\t3\tlevel\tmaxmana\t\t\t\t\t\t\t\t\t\t\t53\t6\t1\tModStr1e\tModStr1e\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_maxdamage_perlevel\t218\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t54\t204\t1024\t\t6\t0\t6\t0\t\t\t4\t3\tlevel\tmaxdamage\tsecondary_maxdamage\titem_throw_maxdamage\t\t\t\t1\t\t\t\t\t125\t6\t1\tModStr1f\tModStr1f\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_maxdamage_percent_perlevel\t219\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t86\t100\t1024\t\t6\t0\t6\t0\t\t\t5\t3\tlevel\tmaxdamage\tsecondary_maxdamage\titem_throw_maxdamage\t\t\t\t1\t\t\t\t\t128\t8\t1\tModStr2j\tModStr2j\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_strength_perlevel\t220\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t132\t128\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\tstrength\t\t\t\t\t\t\t\t\t\t\t66\t6\t1\tModStr1a\tModStr1a\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_dexterity_perlevel\t221\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t132\t128\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\tdexterity\t\t\t\t\t\t\t\t\t\t\t64\t6\t1\tModStr1b\tModStr1b\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_energy_perlevel\t222\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t105\t128\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\tenergy\t\t\t\t\t\t\t\t\t\t\t60\t6\t1\tModStr1d\tModStr1d\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_vitality_perlevel\t223\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t105\t128\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\tvitality\t\t\t\t\t\t\t\t\t\t\t62\t6\t1\tModStr1c\tModStr1c\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_tohit_perlevel\t224\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t53\t20\t1024\t\t6\t0\t6\t0\t\t\t2\t1\tlevel\ttohit\t\t\t\t\t\t1\t\t\t\t\t114\t6\t1\tModStr1h\tModStr1h\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_tohitpercent_perlevel\t225\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t10\t256\t1024\t\t6\t0\t6\t0\t\t\t2\t1\tlevel\titem_tohit_percent\t\t\t\t\t\t1\t\t\t\t\t116\t7\t1\tModStr4c\tModStr4c\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_cold_damagemax_perlevel\t226\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t1058\t340\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\tcoldmaxdam\t\t\t\t\t\t1\t\t\t\t\t94\t6\t1\tModStr1s\tModStr1s\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_fire_damagemax_perlevel\t227\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t49\t128\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\tfiremaxdam\t\t\t\t\t\t1\t\t\t\t\t100\t6\t1\tModStr1o\tModStr1o\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_ltng_damagemax_perlevel\t228\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t49\t128\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\tlightmaxdam\t\t\t\t\t\t1\t\t\t\t\t97\t6\t1\tModStr1q\tModStr1q\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_pois_damagemax_perlevel\t229\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t49\t128\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\tpoisonmaxdam\t\t\t\t\t\t1\t\t\t\t\t90\t6\t1\tModStr4h\tModStr4h\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_resist_cold_perlevel\t230\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t101\t128\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\tcoldresist\t\t\t\t\t\t\t\t\t\t\t39\t7\t2\tModStr1k\tModStr1k\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_resist_fire_perlevel\t231\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t101\t128\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\tfireresist\t\t\t\t\t\t\t\t\t\t\t35\t7\t2\tModStr1j\tModStr1j\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_resist_ltng_perlevel\t232\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t101\t128\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\tlightresist\t\t\t\t\t\t\t\t\t\t\t37\t7\t2\tModStr1l\tModStr1l\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_resist_pois_perlevel\t233\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t101\t128\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\tpoisonresist\t\t\t\t\t\t\t\t\t\t\t33\t7\t2\tModStr1n\tModStr1n\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_absorb_cold_perlevel\t234\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t207\t340\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\titem_absorbcold\t\t\t\t\t\t\t\t\t\t\t32\t6\t1\tModStre9p\tModStre9p\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_absorb_fire_perlevel\t235\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t207\t340\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\titem_absorbfire\t\t\t\t\t\t\t\t\t\t\t28\t6\t1\tModStre9o\tModStre9o\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_absorb_ltng_perlevel\t236\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t207\t340\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\titem_absorblight\t\t\t\t\t\t\t\t\t\t\t30\t6\t1\tModStre9q\tModStre9q\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_absorb_pois_perlevel\t237\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t207\t340\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\titem_absorbmagic\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_thorns_perlevel\t238\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t55\t256\t1024\t\t6\t0\t5\t0\t\t\t2\t3\tlevel\titem_attackertakesdamage\t\t\t\t\t\t\t\t\t\t\t12\t9\t2\tModStr1v\tModStr1v\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_find_gold_perlevel\t239\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t42\t256\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\titem_goldbonus\t\t\t\t\t\t\t\t\t\t\t9\t7\t1\tModStr1w\tModStr1w\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_find_magic_perlevel\t240\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t814\t1024\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\titem_magicbonus\t\t\t\t\t\t\t\t\t\t\t7\t7\t1\tModStr1x\tModStr1x\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_regenstamina_perlevel\t241\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t79\t256\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\tstaminarecoverybonus\t\t\t\t\t\t\t\t\t\t\t47\t8\t2\tModStr3v\tModStr3v\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_stamina_perlevel\t242\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t104\t64\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\tmaxstamina\t\t\t\t\t\t\t\t\t\t\t50\t6\t1\tModStr5d\tModStr5d\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_damage_demon_perlevel\t243\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t56\t10\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\titem_demondamage_percent\t\t\t\t\t\t1\t\t\t\t\t111\t8\t1\tModStr4e\tModStr4e\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_damage_undead_perlevel\t244\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t91\t10\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\titem_undeaddamage_percent\t\t\t\t\t\t1\t\t\t\t\t107\t8\t1\tModStr4f\tModStr4f\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_tohit_demon_perlevel\t245\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t55\t10\t1024\t\t6\t0\t6\t0\t\t\t2\t1\tlevel\titem_demon_tohit\t\t\t\t\t\t1\t\t\t\t\t109\t6\t1\tModStr4j\tModStr4j\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_tohit_undead_perlevel\t246\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t12\t10\t1024\t\t6\t0\t6\t0\t\t\t2\t1\tlevel\titem_undead_tohit\t\t\t\t\t\t1\t\t\t\t\t105\t6\t1\tModStr4k\tModStr4k\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_crushingblow_perlevel\t247\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t213\t1024\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\titem_crushingblow\t\t\t\t\t\t1\t\t\t\t\t86\t7\t1\tModStr5c\tModStr5c\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_openwounds_perlevel\t248\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t181\t128\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\titem_openwounds\t\t\t\t\t\t1\t\t\t\t\t82\t7\t1\tModStr3m\tModStr3m\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_kick_damage_perlevel\t249\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t104\t128\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\titem_kickdamage\t\t\t\t\t\t1\t\t\t\t\t120\t6\t1\tModStr5e\tModStr5e\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_deadlystrike_perlevel\t250\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t118\t512\t1024\t\t6\t0\t6\t0\t\t\t2\t3\tlevel\titem_deadlystrike\t\t\t\t\t\t1\t\t\t\t\t84\t7\t1\tModStr5q\tModStr5q\tincreaseswithplaylevelX\t\t\t\t\t\t\t\t0\r\nitem_find_gems_perlevel\t251\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_replenish_durability\t252\t\t1\t5\t\t\t\t\t\t\t\t\t\t\t106\t256\t1024\t\t5\t0\t6\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1\t11\t0\tModStre9t\tModStre9t\t\t\t\t\t\t\t\t\t0\r\nitem_replenish_quantity\t253\t\t1\t5\t\t\t\t\t\t\t\t\t\t\t106\t256\t1024\t\t5\t0\t6\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t2\t3\t0\tModStre9v\tModStre9v\t\t\t\t\t\t\t\t\t0\r\nitem_extra_stack\t254\t\t1\t\t\t\t\t\t\t\t\t\t\t\t99\t10\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t4\t3\t0\tModStre9i\tModStre9i\t\t\t\t\t\t\t\t\t0\r\nitem_find_item\t255\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_slash_damage\t256\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_slash_damage_percent\t257\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_crush_damage\t258\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_crush_damage_percent\t259\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_thrust_damage\t260\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_thrust_damage_percent\t261\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_absorb_slash\t262\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_absorb_crush\t263\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_absorb_thrust\t264\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_absorb_slash_percent\t265\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_absorb_crush_percent\t266\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_absorb_thrust_percent\t267\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_armor_bytime\t268\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\tarmorclass\t\t\t\t\t\t\t\t\t\t\t180\t17\t1\tModStr1i\tModStr1i\t\t\t\t\t\t\t\t\t0\r\nitem_armorpercent_bytime\t269\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t7\t\t\tarmorclass\t\t\t\t\t\t\t\t\t\t\t180\t18\t1\tModstr2v\tModstr2v\t\t\t\t\t\t\t\t\t0\r\nitem_hp_bytime\t270\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\tmaxhp\t\t\t\t\t\t\t\t\t\t\t180\t17\t1\tModStr1u\tModStr1u\t\t\t\t\t\t\t\t\t0\r\nitem_mana_bytime\t271\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\tmaxmana\t\t\t\t\t\t\t\t\t\t\t180\t17\t1\tModStr1e\tModStr1e\t\t\t\t\t\t\t\t\t0\r\nitem_maxdamage_bytime\t272\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\tmaxdamage\tsecondary_maxdamage\titem_throw_maxdamage\t\t\t\t1\t\t\t\t\t180\t17\t1\tModStr1f\tModStr1f\t\t\t\t\t\t\t\t\t0\r\nitem_maxdamage_percent_bytime\t273\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t7\t\t\tmaxdamage\tsecondary_mindamage\titem_throw_mindamage\t\t\t\t1\t\t\t\t\t180\t18\t1\tModStr2j\tModStr2j\t\t\t\t\t\t\t\t\t0\r\nitem_strength_bytime\t274\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\tstrength\t\t\t\t\t\t\t\t\t\t\t180\t17\t1\tModStr1a\tModStr1a\t\t\t\t\t\t\t\t\t0\r\nitem_dexterity_bytime\t275\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\tdexterity\t\t\t\t\t\t\t\t\t\t\t180\t17\t1\tModStr1b\tModStr1b\t\t\t\t\t\t\t\t\t0\r\nitem_energy_bytime\t276\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\tenergy\t\t\t\t\t\t\t\t\t\t\t180\t17\t1\tModStr1d\tModStr1d\t\t\t\t\t\t\t\t\t0\r\nitem_vitality_bytime\t277\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\tvitality\t\t\t\t\t\t\t\t\t\t\t180\t17\t1\tModStr1c\tModStr1c\t\t\t\t\t\t\t\t\t0\r\nitem_tohit_bytime\t278\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\ttohit\t\t\t\t\t\t1\t\t\t\t\t180\t17\t1\tModStr1h\tModStr1h\t\t\t\t\t\t\t\t\t0\r\nitem_tohitpercent_bytime\t279\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\titem_tohit_percent\t\t\t\t\t\t1\t\t\t\t\t180\t18\t1\tModStr4c\tModStr4c\t\t\t\t\t\t\t\t\t0\r\nitem_cold_damagemax_bytime\t280\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\tcoldmaxdam\t\t\t\t\t\t1\t\t\t\t\t180\t17\t1\tModStr1s\tModStr1s\t\t\t\t\t\t\t\t\t0\r\nitem_fire_damagemax_bytime\t281\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\tfiremaxdam\t\t\t\t\t\t1\t\t\t\t\t180\t17\t1\tModStr1o\tModStr1o\t\t\t\t\t\t\t\t\t0\r\nitem_ltng_damagemax_bytime\t282\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\tlightmaxdam\t\t\t\t\t\t1\t\t\t\t\t180\t17\t1\tModStr1q\tModStr1q\t\t\t\t\t\t\t\t\t0\r\nitem_pois_damagemax_bytime\t283\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\tpoisonmaxdam\t\t\t\t\t\t1\t\t\t\t\t180\t17\t1\tModStr4h\tModStr4h\t\t\t\t\t\t\t\t\t0\r\nitem_resist_cold_bytime\t284\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\tcoldresist\t\t\t\t\t\t\t\t\t\t\t180\t18\t2\tModStr1k\tModStr1k\t\t\t\t\t\t\t\t\t0\r\nitem_resist_fire_bytime\t285\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\tfireresist\t\t\t\t\t\t\t\t\t\t\t180\t18\t2\tModStr1j\tModStr1j\t\t\t\t\t\t\t\t\t0\r\nitem_resist_ltng_bytime\t286\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\tlightresist\t\t\t\t\t\t\t\t\t\t\t180\t18\t2\tModStr1l\tModStr1l\t\t\t\t\t\t\t\t\t0\r\nitem_resist_pois_bytime\t287\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\tpoisonresist\t\t\t\t\t\t\t\t\t\t\t180\t18\t2\tModStr1n\tModStr1n\t\t\t\t\t\t\t\t\t0\r\nitem_absorb_cold_bytime\t288\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\titem_absorbcold\t\t\t\t\t\t\t\t\t\t\t180\t18\t1\tModStre9p\tModStre9p\t\t\t\t\t\t\t\t\t0\r\nitem_absorb_fire_bytime\t289\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\titem_absorbfire\t\t\t\t\t\t\t\t\t\t\t180\t18\t1\tModStre9o\tModStre9o\t\t\t\t\t\t\t\t\t0\r\nitem_absorb_ltng_bytime\t290\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\titem_absorblight\t\t\t\t\t\t\t\t\t\t\t180\t18\t1\tModStre9q\tModStre9q\t\t\t\t\t\t\t\t\t0\r\nitem_absorb_pois_bytime\t291\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\titem_absorbmagic\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_find_gold_bytime\t292\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\titem_goldbonus\t\t\t\t\t\t\t\t\t\t\t180\t18\t2\tModStr1w\tModStr1w\t\t\t\t\t\t\t\t\t0\r\nitem_find_magic_bytime\t293\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\titem_magicbonus\t\t\t\t\t\t\t\t\t\t\t180\t18\t1\tModStr1x\tModStr1x\t\t\t\t\t\t\t\t\t0\r\nitem_regenstamina_bytime\t294\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\tstaminarecoverybonus\t\t\t\t\t\t\t\t\t\t\t180\t18\t2\tModStr3v\tModStr3v\t\t\t\t\t\t\t\t\t0\r\nitem_stamina_bytime\t295\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\tmaxstamina\t\t\t\t\t\t\t\t\t\t\t180\t17\t1\tModStr5d\tModStr5d\t\t\t\t\t\t\t\t\t0\r\nitem_damage_demon_bytime\t296\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\titem_demondamage_percent\t\t\t\t\t\t1\t\t\t\t\t180\t18\t1\tModStr4e\tModStr4e\t\t\t\t\t\t\t\t\t0\r\nitem_damage_undead_bytime\t297\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\titem_undeaddamage_percent\t\t\t\t\t\t1\t\t\t\t\t180\t18\t1\tModStr4f\tModStr4f\t\t\t\t\t\t\t\t\t0\r\nitem_tohit_demon_bytime\t298\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\titem_demon_tohit\t\t\t\t\t\t1\t\t\t\t\t180\t17\t1\tModStr4j\tModStr4j\t\t\t\t\t\t\t\t\t0\r\nitem_tohit_undead_bytime\t299\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\titem_undead_tohit\t\t\t\t\t\t1\t\t\t\t\t180\t17\t1\tModStr4k\tModStr4k\t\t\t\t\t\t\t\t\t0\r\nitem_crushingblow_bytime\t300\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\titem_crushingblow\t\t\t\t\t\t1\t\t\t\t\t180\t18\t1\tModStr5c\tModStr5c\t\t\t\t\t\t\t\t\t0\r\nitem_openwounds_bytime\t301\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\titem_openwounds\t\t\t\t\t\t1\t\t\t\t\t180\t18\t1\tModStr3m\tModStr3m\t\t\t\t\t\t\t\t\t0\r\nitem_kick_damage_bytime\t302\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\titem_kickdamage\t\t\t\t\t\t1\t\t\t\t\t180\t17\t1\tModStr5e\tModStr5e\t\t\t\t\t\t\t\t\t0\r\nitem_deadlystrike_bytime\t303\t\t1\t22\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t22\t0\t22\t0\t\t\t6\t\t\titem_deadlystrike\t\t\t\t\t\t1\t\t\t\t\t180\t18\t1\tModStr5q\tModStr5q\t\t\t\t\t\t\t\t\t0\r\nitem_find_gems_bytime\t304\t\t1\t\t\t\t\t\t\t\t\t\t\t4\t\t0\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_pierce_cold\t305\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t1432\t513\t1024\t\t\t\t8\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t88\t20\t1\tModitemenrescoldsk\tModitemenrescoldsk\t\t\t\t\t\t\t\t\t0\r\nitem_pierce_fire\t306\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t1240\t497\t1024\t\t\t\t8\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t88\t20\t1\tModitemenresfiresk\tModitemenresfiresk\t\t\t\t\t\t\t\t\t0\r\nitem_pierce_ltng\t307\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t1187\t481\t1024\t\t\t\t8\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t88\t20\t1\tModitemenresltngsk\tModitemenresltngsk\t\t\t\t\t\t\t\t\t0\r\nitem_pierce_pois\t308\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t1322\t506\t1024\t\t\t\t8\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t88\t20\t1\tModitemenrespoissk\tModitemenrespoissk\t\t\t\t\t\t\t\t\t0\r\nitem_damage_vs_monster\t309\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_damage_percent_vs_monster\t310\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_tohit_vs_monster\t311\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_tohit_percent_vs_monster\t312\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_ac_vs_monster\t313\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_ac_percent_vs_monster\t314\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nfirelength\t315\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nburningmin\t316\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nburningmax\t317\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nprogressive_damage\t318\t\t1\t3\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nprogressive_steal\t319\t\t1\t3\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nprogressive_other\t320\t\t1\t3\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nprogressive_fire\t321\t\t1\t3\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nprogressive_cold\t322\t\t1\t3\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nprogressive_lightning\t323\t\t1\t3\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nitem_extra_charges\t324\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t6\t0\t6\t0\t\t\t\t\t\t\t\t\t\t\t1\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nprogressive_tohit\t325\t\t1\t16\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\npoison_count\t326\t\t1\t5\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\ndamage_framerate\t327\t\t1\t8\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\npierce_idx\t328\t\t1\t6\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\npassive_fire_mastery\t329\t\t1\t12\t\t\t\t\t\t\t\t\t\t\t1117\t415\t1024\t\t8\t0\t9\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t88\t4\t1\tModitemdamFiresk\tModitemdamFiresk\t\t\t\t\t\t\t\t\t0\r\npassive_ltng_mastery\t330\t\t1\t12\t\t\t\t\t\t\t\t\t\t\t1054\t408\t1024\t\t8\t0\t9\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t88\t4\t1\tModitemdamLtngsk\tModitemdamLtngsk\t\t\t\t\t\t\t\t\t0\r\npassive_cold_mastery\t331\t\t1\t12\t\t\t\t\t\t\t\t\t\t\t1295\t379\t1024\t\t8\t0\t9\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t88\t4\t1\tModitemdamColdsk\tModitemdamColdsk\t\t\t\t\t\t\t\t\t0\r\npassive_pois_mastery\t332\t\t1\t12\t\t\t\t\t\t\t\t\t\t\t978\t394\t1024\t\t8\t0\t9\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t88\t4\t1\tModitemdamPoissk\tModitemdamPoissk\t\t\t\t\t\t\t\t\t0\r\npassive_fire_pierce\t333\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t\t2578\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t88\t20\t1\tModitemenresfiresk\tModitemenresfiresk\t\t\t\t\t\t\t\t\t0\r\npassive_ltng_pierce\t334\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t\t2493\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t88\t20\t1\tModitemenresltngsk\tModitemenresltngsk\t\t\t\t\t\t\t\t\t0\r\npassive_cold_pierce\t335\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t\t1984\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t88\t20\t1\tModitemenrescoldsk\tModitemenrescoldsk\t\t\t\t\t\t\t\t\t0\r\npassive_pois_pierce\t336\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t\t2345\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t88\t20\t1\tModitemenrespoissk\tModitemenrespoissk\t\t\t\t\t\t\t\t\t0\r\npassive_critical_strike\t337\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\npassive_dodge\t338\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\npassive_avoid\t339\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\npassive_evade\t340\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t7\t0\t7\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\npassive_warmth\t341\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\npassive_mastery_melee_th\t342\t\t1\t11\t8\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\npassive_mastery_melee_dmg\t343\t\t1\t11\t8\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\npassive_mastery_melee_crit\t344\t\t1\t9\t8\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\npassive_mastery_throw_th\t345\t\t1\t11\t8\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\npassive_mastery_throw_dmg\t346\t\t1\t11\t8\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\npassive_mastery_throw_crit\t347\t\t1\t9\t8\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\npassive_weaponblock\t348\t\t1\t9\t8\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\npassive_summon_resist\t349\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nmodifierlist_skill\t350\t\t\t9\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nmodifierlist_level\t351\t\t\t8\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nlast_sent_hp_pct\t352\t\t1\t8\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nsource_unit_type\t353\t\t\t5\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nsource_unit_id\t354\t\t\t32\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nshortparam1\t355\t\t\t16\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nquestitemdifficulty\t356\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t1024\t\t\t\t2\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\npassive_mag_mastery\t357\t\t1\t12\t\t\t\t\t\t\t\t\t\t\t1211\t431\t1024\t\t8\t0\t9\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\npassive_mag_pierce\t358\t\t1\t9\t\t\t\t\t\t\t\t\t\t\t\t2812\t1024\t\t8\t0\t8\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\n"

export const RAW_PROPERTIES: string = "code\t*done\tset1\tval1\tfunc1\tstat1\tset2\tval2\tfunc2\tstat2\tset3\tval3\tfunc3\tstat3\tset4\tval4\tfunc4\tstat4\tset5\tval5\tfunc5\tstat5\tset6\tval6\tfunc6\tstat6\tset7\tval7\tfunc7\tstat7\t*desc\t*param\t*min\t*max\t*notes\t*eol\r\nac\t1\t\t\t1\tarmorclass\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nac-miss\t1\t\t\t1\tarmorclass_vs_missile\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nac-hth\t1\t\t\t1\tarmorclass_vs_hth\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nred-dmg\t1\t\t\t1\tnormal_damage_reduction\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nred-dmg%\t1\t\t\t1\tdamageresist\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nac%\t1\t\t\t2\titem_armor_percent\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nred-mag\t1\t\t\t1\tmagic_damage_reduction\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nstr\t1\t\t\t1\tstrength\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ndex\t1\t\t\t1\tdexterity\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nvit\t1\t\t\t1\tvitality\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nenr\t1\t\t\t1\tenergy\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nmana\t1\t\t\t1\tmaxmana\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nmana%\t1\t\t\t1\titem_maxmana_percent\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nhp\t1\t\t\t1\tmaxhp\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nhp%\t1\t\t\t1\titem_maxhp_percent\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\natt\t1\t\t\t1\ttohit\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nblock\t1\t\t\t1\ttoblock\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ncold-min\t1\t\t\t1\tcoldmindam\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ncold-max\t1\t\t\t1\tcoldmaxdam\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ncold-len\t1\t\t\t1\tcoldlength\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nfire-min\t1\t\t\t1\tfiremindam\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nfire-max\t1\t\t\t1\tfiremaxdam\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nltng-min\t1\t\t\t1\tlightmindam\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nltng-max\t1\t\t\t1\tlightmaxdam\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\npois-min\t1\t\t\t1\tpoisonmindam\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\npois-max\t1\t\t\t1\tpoisonmaxdam\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\npois-len\t1\t\t\t1\tpoisonlength\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ndmg-min\t1\t\t\t5\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ndmg-max\t1\t\t\t6\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ndmg%\t1\t\t\t7\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ndmg-to-mana\t1\t\t\t1\titem_damagetomana\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nres-fire\t1\t\t\t1\tfireresist\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nres-fire-max\t1\t\t\t1\tmaxfireresist\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nres-ltng\t1\t\t\t1\tlightresist\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nres-ltng-max\t1\t\t\t1\tmaxlightresist\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nres-cold\t1\t\t\t1\tcoldresist\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nres-cold-max\t1\t\t\t1\tmaxcoldresist\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nres-mag\t1\t\t\t1\tmagicresist\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nres-mag-max\t1\t\t\t1\tmaxmagicresist\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nres-pois\t1\t\t\t1\tpoisonresist\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nres-pois-max\t1\t\t\t1\tmaxpoisonresist\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nres-all\t1\t\t\t1\tfireresist\t\t\t3\tlightresist\t\t\t3\tcoldresist\t\t\t3\tpoisonresist\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nres-all-max\t1\t\t\t1\tmaxfireresist\t\t\t3\tmaxlightresist\t\t\t3\tmaxcoldresist\t\t\t3\tmaxpoisonresist\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nabs-fire%\t1\t\t\t1\titem_absorbfire_percent\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nabs-fire\t1\t\t\t1\titem_absorbfire\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nabs-ltng%\t1\t\t\t1\titem_absorblight_percent\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nabs-ltng\t1\t\t\t1\titem_absorblight\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nabs-mag%\t1\t\t\t1\titem_absorbmagic_percent\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nabs-mag\t1\t\t\t1\titem_absorbmagic\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nabs-cold%\t1\t\t\t1\titem_absorbcold_percent\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nabs-cold\t1\t\t\t1\titem_absorbcold\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ndur\t1\t\t\t1\tmaxdurability\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ndur%\t1\t\t\t13\titem_maxdurability_percent\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nregen\t1\t\t\t1\thpregen\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nthorns\t1\t\t\t1\titem_attackertakesdamage\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nswing1\t1\t\t\t8\titem_fasterattackrate\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nswing2\t1\t\t\t8\titem_fasterattackrate\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nswing3\t1\t\t\t8\titem_fasterattackrate\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ngold%\t1\t\t\t1\titem_goldbonus\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nmag%\t1\t\t\t1\titem_magicbonus\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nknock\t1\t\t\t1\titem_knockback\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nregen-stam\t1\t\t\t1\tstaminarecoverybonus\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nregen-mana\t1\t\t\t1\tmanarecoverybonus\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nstam\t1\t\t\t1\tmaxstamina\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ntime\t1\t\t\t1\titem_timeduration\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nmanasteal\t1\t\t\t1\tmanadrainmindam\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nlifesteal\t1\t\t\t1\tlifedrainmindam\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nama\t1\t\t0\t21\titem_addclassskills\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\npal\t1\t\t3\t21\titem_addclassskills\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nnec\t1\t\t2\t21\titem_addclassskills\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nsor\t1\t\t1\t21\titem_addclassskills\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nbar\t1\t\t4\t21\titem_addclassskills\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nherb\t1\t\t\t1\titem_doubleherbduration\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nlight\t1\t\t\t1\titem_lightradius\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ncolor\t1\t1\t\t1\titem_lightcolor\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nease\t1\t\t\t1\titem_req_percent\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nmove1\t1\t\t\t8\titem_fastermovevelocity\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nmove2\t1\t\t\t8\titem_fastermovevelocity\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nmove3\t1\t\t\t8\titem_fastermovevelocity\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nbalance1\t1\t\t\t8\titem_fastergethitrate\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nbalance2\t1\t\t\t8\titem_fastergethitrate\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nbalance3\t1\t\t\t8\titem_fastergethitrate\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nblock1\t1\t\t\t8\titem_fasterblockrate\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nblock2\t1\t\t\t8\titem_fasterblockrate\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nblock3\t1\t\t\t8\titem_fasterblockrate\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ncast1\t1\t\t\t8\titem_fastercastrate\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ncast2\t1\t\t\t8\titem_fastercastrate\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ncast3\t1\t\t\t8\titem_fastercastrate\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nres-pois-len\t1\t\t\t1\titem_poisonlengthresist\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ndmg\t1\t\t\t1\titem_normaldamage\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nhowl\t1\t\t\t1\titem_howl\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nstupidity\t1\t\t\t1\titem_stupidity\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nignore-ac\t1\t\t\t1\titem_ignoretargetac\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nreduce-ac\t1\t\t\t1\titem_fractionaltargetac\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nnoheal\t1\t\t\t1\titem_preventheal\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nhalf-freeze\t1\t\t\t1\titem_halffreezeduration\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\natt%\t1\t\t\t1\titem_tohit_percent\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ndmg-ac\t1\t\t\t1\titem_damagetargetac\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ndmg-demon\t1\t\t\t1\titem_demondamage_percent\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ndmg-undead\t1\t\t\t1\titem_undeaddamage_percent\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\natt-demon\t1\t\t\t1\titem_demon_tohit\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\natt-undead\t1\t\t\t1\titem_undead_tohit\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nthrow\t1\t\t\t1\titem_throwable\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nfireskill\t1\t\t1\t21\titem_elemskill\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nallskills\t1\t\t\t1\titem_allskills\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nlight-thorns\t1\t\t\t1\titem_attackertakeslightdamage\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nfreeze\t1\t\t\t1\titem_freeze\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tchance in 128\tlength in frames\t\tnone\t0\r\nopenwounds\t1\t\t\t1\titem_openwounds\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ncrush\t1\t\t\t1\titem_crushingblow\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nkick\t1\t\t\t1\titem_kickdamage\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nmana-kill\t1\t\t\t1\titem_manaafterkill\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ndemon-heal\t1\t\t\t1\titem_healafterdemonkill\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nbloody\t1\t\t\t1\titem_extrablood\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ndeadly\t1\t\t\t1\titem_deadlystrike\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nslow\t1\t\t\t1\titem_slow\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nnofreeze\t1\t\t\t1\titem_cannotbefrozen\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nstamdrain\t1\t\t\t1\titem_staminadrainpct\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nreanimate\t1\t\t\t24\titem_reanimate\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\npierce\t1\t\t\t1\titem_pierce\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nmagicarrow\t1\t\t\t1\titem_magicarrow\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nexplosivearrow\t1\t\t\t1\titem_explosivearrow\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nExpansion\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\r\ndru\t1\t\t5\t21\titem_addclassskills\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAll Druid Skills\t\t\t\tnone\t0\r\nass\t1\t\t6\t21\titem_addclassskills\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAll Assassin Skills\t\t\t\tnone\t0\r\nskill\t1\t\t\t22\titem_singleskill\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nskilltab\t1\t\t\t10\titem_addskill_tab\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\naura\t1\t\t\t22\titem_aura\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\natt-skill\t1\t\t\t11\titem_skillonattack\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tProc Skill on Swing\tSkill #\t% Chance\tLevel\tnone\t0\r\nhit-skill\t1\t\t\t11\titem_skillonhit\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tProc Skill on Hit\tSkill #\t% Chance\tLevel\tnone\t0\r\ngethit-skill\t1\t\t\t11\titem_skillongethit\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tProc Skill on Get Hit\tSkill #\t% Chance\tLevel\tnone\t0\r\ngembonus\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tIncrease chance of finding Gems\t\t\t\tnone\t0\r\nregen-dur\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nfire-fx\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nltng-fx\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\nsock\t1\t\t\t14\titem_numsockets\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tnone\t0\r\ndmg-fire\t1\t\t\t15\tfiremindam\t\t\t16\tfiremaxdam\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tFire Damage\t\tMin\tMax\tnone\t0\r\ndmg-ltng\t1\t\t\t15\tlightmindam\t\t\t16\tlightmaxdam\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tLightning Damage\t\tMin\tMax\tnone\t0\r\ndmg-mag\t1\t\t\t15\tmagicmindam\t\t\t16\tmagicmaxdam\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tMagic Damge\t\tMin\tMax\tnone\t0\r\ndmg-cold\t1\t\t\t15\tcoldmindam\t\t\t16\tcoldmaxdam\t\t\t17\tcoldlength\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tCold Damage\tLength (Frames)\tMin\tMax\tnone\t0\r\ndmg-pois\t1\t\t\t15\tpoisonmindam\t\t\t16\tpoisonmaxdam\t\t\t17\tpoisonlength\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tPoison Damage\tLength (Frames)\tMin\tMax\tnone\t0\r\ndmg-throw\t1\t\t\t15\titem_throw_mindamage\t\t\t16\titem_throw_maxdamage\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tThrowing Damage\t\tMin\tMax\tnone\t0\r\ndmg-norm\t1\t\t\t15\tmindamage\t\t\t16\tmaxdamage\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tNormal Damage Modifier\t\tMin\tMax\tnone\t0\r\nac/lvl\t1\t\t\t17\titem_armor_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAC per Player Level\tac/lvl (8ths)\t\t\tnone\t0\r\nac%/lvl\t1\t\t\t17\titem_armorpercent_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAC% per Player Level\tac%/lvl (8ths)\t\t\tnone\t0\r\nhp/lvl\t1\t\t\t17\titem_hp_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tHP per Player Level\thp/lvl (8ths)\t\t\tnone\t0\r\nmana/lvl\t1\t\t\t17\titem_mana_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tMana per Player Level\t(8ths)\t\t\tnone\t0\r\ndmg/lvl\t1\t\t\t17\titem_maxdamage_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tMax Damage per Player Level\t(8ths)\t\t\tnone\t0\r\ndmg%/lvl\t1\t\t\t17\titem_maxdamage_percent_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tMax Damage % per Player Level\t(8ths)\t\t\tnone\t0\r\nstr/lvl\t1\t\t\t17\titem_strength_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tStrength per Player Level\t(8ths)\t\t\tnone\t0\r\ndex/lvl\t1\t\t\t17\titem_dexterity_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tDexterity per Player Level\t(8ths)\t\t\tnone\t0\r\nenr/lvl\t1\t\t\t17\titem_energy_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tEnergy per Player Level\t(8ths)\t\t\tnone\t0\r\nvit/lvl\t1\t\t\t17\titem_vitality_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tVitality per Player Level\t(8ths)\t\t\tnone\t0\r\natt/lvl\t1\t\t\t17\titem_tohit_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAttack per Player Level\tatt/lvl (1)\t\t\tnone\t0\r\natt%/lvl\t1\t\t\t17\titem_tohitpercent_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAttack% per Player Level\tatt%/lvl (8ths)\t\t\tnone\t0\r\ndmg-cold/lvl\t1\t\t\t17\titem_cold_damagemax_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tMax Cold Damage per Player Level\t(8ths)\t\t\tnone\t0\r\ndmg-fire/lvl\t1\t\t\t17\titem_fire_damagemax_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tMax Fire Damage per Player Level\t(8ths)\t\t\tnone\t0\r\ndmg-ltng/lvl\t1\t\t\t17\titem_ltng_damagemax_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tMax Lightning Dmg per Player Level\t(8ths)\t\t\tnone\t0\r\ndmg-pois/lvl\t1\t\t\t17\titem_pois_damagemax_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tMax Poison Dmg per Player Level\t(8ths)\t\t\tnone\t0\r\nres-cold/lvl\t1\t\t\t17\titem_resist_cold_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tResist Cold% per Player Level\t(8ths)\t\t\tnone\t0\r\nres-fire/lvl\t1\t\t\t17\titem_resist_fire_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tResist Fire% per Player Level\t(8ths)\t\t\tnone\t0\r\nres-ltng/lvl\t1\t\t\t17\titem_resist_ltng_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tResist Lightning% per Player Level\t(8ths)\t\t\tnone\t0\r\nres-pois/lvl\t1\t\t\t17\titem_resist_pois_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tResist Poison% per Player Level\t(8ths)\t\t\tnone\t0\r\nabs-cold/lvl\t1\t\t\t17\titem_absorb_cold_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAbsorb Cold Dmg per Player Level\t(8ths)\t\t\tnone\t0\r\nabs-fire/lvl\t1\t\t\t17\titem_absorb_fire_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAbsorb Fire Dmg per Player Level\t(8ths)\t\t\tnone\t0\r\nabs-ltng/lvl\t1\t\t\t17\titem_absorb_ltng_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAbsorb Lightning Dmg per Player Lvl\t(8ths)\t\t\tnone\t0\r\nabs-pois/lvl\t1\t\t\t17\titem_absorb_pois_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAbsorb Poison Dmg per Player Lvl\t(8ths)\t\t\tnone\t0\r\nthorns/lvl\t1\t\t\t17\titem_thorns_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tDamage to Attacker per Player Lvl\t(8ths)\t\t\tnone\t0\r\ngold%/lvl\t1\t\t\t17\titem_find_gold_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t+% Gold Dropped per Player Lvl\t(8ths)\t\t\tnone\t0\r\nmag%/lvl\t1\t\t\t17\titem_find_magic_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t+% Magical per Player Lvl\t(8ths)\t\t\tnone\t0\r\nregen-stam/lvl\t1\t\t\t17\titem_regenstamina_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t+% Stamina Regeneration per Player Lvl\t(8ths)\t\t\tnone\t0\r\nstam/lvl\t1\t\t\t17\titem_stamina_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tStamina per Player Level\t(8ths)\t\t\tnone\t0\r\ndmg-dem/lvl\t1\t\t\t17\titem_damage_demon_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tDamage to Demons % per Player Level\t(8ths)\t\t\tnone\t0\r\ndmg-und/lvl\t1\t\t\t17\titem_damage_undead_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tDamage to Undead % per Player Level\t(8ths)\t\t\tnone\t0\r\natt-dem/lvl\t1\t\t\t17\titem_tohit_demon_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAttack Demons + per Player Level\tatt/lvl (1)\t\t\tnone\t0\r\natt-und/lvl\t1\t\t\t17\titem_tohit_undead_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAttack Undead + per Player Level\tatt/lvl (1)\t\t\tnone\t0\r\ncrush/lvl\t1\t\t\t17\titem_crushingblow_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t+% Chance of Crushing Blow per Player Level\t(8ths)\t\t\tnone\t0\r\nwounds/lvl\t1\t\t\t17\titem_openwounds_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t+% Chance of Open Wounds per Player Level\t(8ths)\t\t\tnone\t0\r\nkick/lvl\t1\t\t\t17\titem_kick_damage_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tKick Damage per Player Level\t(8ths)\t\t\tnone\t0\r\ndeadly/lvl\t1\t\t\t17\titem_deadlystrike_perlevel\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t+% Chance of Deadly Strike per Player Level\t(8ths)\t\t\tnone\t0\r\ngems%/lvl\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t+% Chance of finding Gems per Player Level\t(8ths)\t\t\tnone\t0\r\nrep-dur\t1\t\t\t17\titem_replenish_durability\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tregenerates durability\tspeed (see note)\t\t\tregenerates 1 durability point per 100/lvl seconds\t0\r\nrep-quant\t1\t\t\t17\titem_replenish_quantity\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tregenerates quantity\tspeed (see note)\t\t\tregenerates 1 quantity per 100/lvl seconds\t0\r\nstack\t1\t\t\t1\titem_extra_stack\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tIncreased stack size\t\tmin count\tmax count\tnone\t0\r\nitem%\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t+% Chance of finding item\titem type\tmin chance\tmax chance\trandom chance from min to max is assigned to item\t0\r\ndmg-slash\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tSlashing Damage\t\tmin\tmax\trandom amount from min to max is assigned to item\t0\r\ndmg-slash%\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tSlashing Damage %\t\tmin %\tmax %\trandom amount from min to max is assigned to item\t0\r\ndmg-crush\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tCrush Damage\t\tmin\tmax\trandom amount from min to max is assigned to item\t0\r\ndmg-crush%\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tCrush Damage %\t\tmin %\tmax %\trandom amount from min to max is assigned to item\t0\r\ndmg-thrust\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tThrust Damage\t\tmin\tmax\trandom amount from min to max is assigned to item\t0\r\ndmg-thrust%\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tThrust Damage %\t\tmin %\tmax %\trandom amount from min to max is assigned to item\t0\r\nabs-slash\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAbsorb Slashing Damage\t\tmin amt\tmax amt\trandom amount from min to max is assigned to item\t0\r\nabs-crush\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAbsorb Crushing Damage\t\tmin amt\tmax amt\trandom amount from min to max is assigned to item\t0\r\nabs-thrust\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAbsorb Thrusting Damage\t\tmin amt\tmax amt\trandom amount from min to max is assigned to item\t0\r\nabs-slash%\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAbsorb Slashing Damage %\t\tmin %\tmax %\trandom amount from min to max is assigned to item\t0\r\nabs-crush%\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAbsorb Crushing Damage %\t\tmin %\tmax %\trandom amount from min to max is assigned to item\t0\r\nabs-thrust%\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAbsorb Thrusting Damage %\t\tmin %\tmax %\trandom amount from min to max is assigned to item\t0\r\nac/time\t1\t\t\t18\titem_armor_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\"AC / time increment (0=day, 1=dusk, 2=night, 3=dawn)\"\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\nac%/time\t1\t\t\t18\titem_armorpercent_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAC% / time increment (8 periods)\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\nhp/time\t1\t\t\t18\titem_hp_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tHP / time increment\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\nmana/time\t1\t\t\t18\titem_mana_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tMana / time increment\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\ndmg/time\t1\t\t\t18\titem_maxdamage_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tMax Damage / time increment\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\ndmg%/time\t1\t\t\t18\titem_maxdamage_percent_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tMax Damage % / time increment\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\nstr/time\t1\t\t\t18\titem_strength_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tStrength / time increment\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\ndex/time\t1\t\t\t18\titem_dexterity_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tDexterity / time increment\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\nenr/time\t1\t\t\t18\titem_energy_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tEnergy / time increment\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\nvit/time\t1\t\t\t18\titem_vitality_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tVitality / time increment\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\natt/time\t1\t\t\t18\titem_tohit_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tTo hit / time increment\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\natt%/time\t1\t\t\t18\titem_tohitpercent_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tTo Hit % / time increment\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\ndmg-cold/time\t1\t\t\t18\titem_cold_damagemax_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tCold Damage Max / time inc.\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\ndmg-fire/time\t1\t\t\t18\titem_fire_damagemax_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tFire Damage Max / time inc.\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\ndmg-ltng/time\t1\t\t\t18\titem_ltng_damagemax_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tLightning Damage Max / time inc.\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\ndmg-pois/time\t1\t\t\t18\titem_pois_damagemax_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tPoison Damage Max / time inc.\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\nres-cold/time\t1\t\t\t18\titem_resist_cold_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tResist Cold / time inc.\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\nres-fire/time\t1\t\t\t18\titem_resist_fire_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tResist Fire / time inc.\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\nres-ltng/time\t1\t\t\t18\titem_resist_ltng_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tResist Lightning / time inc\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\nres-pois/time\t1\t\t\t18\titem_resist_pois_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tResist Poison / time inc\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\nabs-cold/time\t1\t\t\t18\titem_absorb_cold_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAbsorb Cold / time inc.\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\nabs-fire/time\t1\t\t\t18\titem_absorb_fire_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAbsorb Fire / time inc.\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\nabs-ltng/time\t1\t\t\t18\titem_absorb_ltng_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAbsorb Lightning / time inc.\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\nabs-pois/time\t1\t\t\t18\titem_absorb_pois_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAbsorb Poison / time inc.\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\ngold%/time\t1\t\t\t18\titem_find_gold_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tFind Gold Amt % / time inc.\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\nmag%/time\t1\t\t\t18\titem_find_magic_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tFind Magic % / time inc.\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\nregen-stam/time\t1\t\t\t18\titem_regenstamina_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t% / time inc.\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\nstam/time\t1\t\t\t18\titem_stamina_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tStamina / time inc.\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\ndmg-dem/time\t1\t\t\t18\titem_damage_demon_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tDamage to Demons % / time inc.\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\ndmg-und/time\t1\t\t\t18\titem_damage_undead_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tDamage to Undead % / time inc.\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\natt-dem/time\t1\t\t\t18\titem_tohit_demon_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tTo Hit Demons % / time inc.\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\natt-und/time\t1\t\t\t18\titem_tohit_undead_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tTo Hit Undead % / time inc.\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\ncrush/time\t1\t\t\t18\titem_crushingblow_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t% chance of Crushing Blow / time inc.\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\nwounds/time\t1\t\t\t18\titem_openwounds_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t+% chance of Open Wounds / time inc.\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\nkick/time\t1\t\t\t18\titem_kick_damage_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tKick Damage / time inc.\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\ndeadly/time\t1\t\t\t18\titem_deadlystrike_bytime\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t+% chance of Deadly Strike / time inc.\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\ngems%/time\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t+% chance of finding Gems / time inc.\tcenter period\tmin\tmax\t\"max at center period, min at opposite period, linear progression\"\t0\r\npierce-fire\t1\t\t\t1\tpassive_fire_pierce\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tNegates % of Enemy Cold Resistance\t\tmin\tmax\tnone\t0\r\npierce-ltng\t1\t\t\t1\tpassive_ltng_pierce\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tNegates % of Enemy Fire Resistance\t\tmin\tmax\tnone\t0\r\npierce-cold\t1\t\t\t1\tpassive_cold_pierce\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tNegates % of Enemy Lightning Resistance\t\tmin\tmax\tnone\t0\r\npierce-pois\t1\t\t\t1\tpassive_pois_pierce\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tNegates % of Enemy Poison Resistance\t\tmin\tmax\tnone\t0\r\ndmg-mon\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tDamage vs. specific Monster Type\tmonster\tmin\tmax\tnone\t0\r\ndmg%-mon\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tDamage % vs. specific Monster Type\tmonster\tmin\tmax\tnone\t0\r\natt-mon\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tTo Hit vs. specific Monster Type\tmonster\tmin\tmax\tnone\t0\r\natt%-mon\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tTo Hit % vs. specific Monster Type\tmonster\tmin\tmax\tnone\t0\r\nac-mon\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAC vs. specific Monster Type\tmonster\tmin\tmax\tnone\t0\r\nac%-mon\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tAC% vs. specific Monster Type\tmonster\tmin\tmax\tnone\t0\r\nindestruct\t1\t\t\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tIndestructible\t\t\t\tnone\t0\r\ncharged\t1\t\t\t19\titem_charged_skill\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tCharged Skill\tskill\tcharges\tlevel\tnone\t0\r\nextra-fire\t1\t\t\t1\tpassive_fire_mastery\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nextra-ltng\t1\t\t\t1\tpassive_ltng_mastery\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nextra-cold\t1\t\t\t1\tpassive_cold_mastery\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nextra-pois\t1\t\t\t1\tpassive_pois_mastery\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\ndmg-elem\t1\t\t\t15\tfiremindam\t\t\t16\tfiremaxdam\t\t\t15\tlightmindam\t\t\t16\tlightmaxdam\t\t\t15\tcoldmindam\t\t\t16\tcoldmaxdam\t\t\t17\tcoldlength\t\t\t\t\t\t0\r\ndmg-elem-min\t1\t\t\t1\tfiremindam\t\t\t3\tlightmindam\t\t\t3\tcoldmindam\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\ndmg-elem-max\t1\t\t\t1\tfiremaxdam\t\t\t3\tlightmaxdam\t\t\t3\tcoldmaxdam\t\t\t17\tcoldlength\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nall-stats\t1\t\t\t1\tstrength\t\t\t3\tenergy\t\t\t3\tdexterity\t\t\t3\tvitality\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\naddxp\t1\t\t\t1\titem_addexperience\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tadditional xp gain\t\t\t\t\t0\r\nheal-kill\t1\t\t\t1\titem_healafterkill\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tlife gained after each kill\t\t\t\t\t0\r\ncheap\t1\t\t\t1\titem_reducedprices\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\treduces vendor prices\t\tmin\tmax\tnone\t0\r\nrip\t1\t\t\t1\titem_restinpeace\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tslain monsters' corpses can't be used\t\t1\t1\tnone\t0\r\natt-mon%\t1\t\t\t24\tattack_vs_montype\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tattack% vs. monster type\tmon type\tmin\tmax\t\t0\r\ndmg-mon%\t1\t\t\t24\tdamage_vs_montype\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tdamage% vs. monster type\tmon type\tmin\tmax\t\t0\r\nkill-skill\t1\t\t\t11\titem_skillonkill\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tProc Skill on killing something\tSkill #\t% Chance\tLevel\t\t0\r\ndeath-skill\t1\t\t\t11\titem_skillondeath\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tProc Skill on getting killed\tSkill #\t% Chance\tLevel\t\t0\r\nlevelup-skill\t1\t\t\t11\titem_skillonlevelup\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tProc Skill on level up\tSkill #\t% Chance\tLevel\t\t0\r\nskill-rand\t1\t\t\t12\titem_singleskill\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tBonus to random skill\tLevel\tmin Skill #\tmax Skill #\t\t0\r\nfade\t1\t\t\t17\tfade\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tonly use on monprop\tfade type\t\t\t\t0\r\nlevelreq\t1\t\t\t1\titem_levelreq\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nethereal\t1\t\t\t23\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\noskill\t1\t\t\t22\titem_nonclassskill\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tSkill\tmin level\tmax level\tnone\t0\r\nstate\t1\t\t\t24\tstate\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tstate\t1\t1\t\t0\r\nrandclassskill\t1\t\t3\t36\titem_addclassskills\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\r\n"

export const CANONICAL_SKILL_COSTS: readonly SkillCostEntry[] = [
  {
    "id": 0,
    "skill": "Attack",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 1,
    "skill": "Kick",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 2,
    "skill": "Throw",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 3,
    "skill": "Unsummon",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 4,
    "skill": "Left Hand Throw",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 5,
    "skill": "Left Hand Swing",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 6,
    "skill": "Magic Arrow",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 7,
    "skill": "Fire Arrow",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 8,
    "skill": "Inner Sight",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 9,
    "skill": "Critical Strike",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 10,
    "skill": "Jab",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 11,
    "skill": "Cold Arrow",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 12,
    "skill": "Multiple Shot",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 13,
    "skill": "Dodge",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 14,
    "skill": "Power Strike",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 15,
    "skill": "Poison Javelin",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 16,
    "skill": "Exploding Arrow",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 17,
    "skill": "Slow Missiles",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 18,
    "skill": "Avoid",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 19,
    "skill": "Impale",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 20,
    "skill": "Lightning Bolt",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 21,
    "skill": "Ice Arrow",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 22,
    "skill": "Guided Arrow",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 23,
    "skill": "Penetrate",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 24,
    "skill": "Charged Strike",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 25,
    "skill": "Plague Javelin",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 26,
    "skill": "Strafe",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 27,
    "skill": "Immolation Arrow",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 28,
    "skill": "Dopplezon",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 29,
    "skill": "Evade",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 30,
    "skill": "Fend",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 31,
    "skill": "Freezing Arrow",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 32,
    "skill": "Valkyrie",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 33,
    "skill": "Pierce",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 34,
    "skill": "Lightning Strike",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 35,
    "skill": "Lightning Fury",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 36,
    "skill": "Fire Bolt",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 37,
    "skill": "Warmth",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 38,
    "skill": "Charged Bolt",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 39,
    "skill": "Ice Bolt",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 40,
    "skill": "Frozen Armor",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 41,
    "skill": "Inferno",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 42,
    "skill": "Static Field",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 43,
    "skill": "Telekinesis",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 44,
    "skill": "Frost Nova",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 45,
    "skill": "Ice Blast",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 46,
    "skill": "Blaze",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 47,
    "skill": "Fire Ball",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 48,
    "skill": "Nova",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 49,
    "skill": "Lightning",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 50,
    "skill": "Shiver Armor",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 51,
    "skill": "Fire Wall",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 52,
    "skill": "Enchant",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 53,
    "skill": "Chain Lightning",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 54,
    "skill": "Teleport",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 55,
    "skill": "Glacial Spike",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 56,
    "skill": "Meteor",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 57,
    "skill": "Thunder Storm",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 58,
    "skill": "Energy Shield",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 59,
    "skill": "Blizzard",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 60,
    "skill": "Chilling Armor",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 61,
    "skill": "Fire Mastery",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 62,
    "skill": "Hydra",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 63,
    "skill": "Lightning Mastery",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 64,
    "skill": "Frozen Orb",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 65,
    "skill": "Cold Mastery",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 66,
    "skill": "Amplify Damage",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 67,
    "skill": "Teeth",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 68,
    "skill": "Bone Armor",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 69,
    "skill": "Skeleton Mastery",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 70,
    "skill": "Raise Skeleton",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 71,
    "skill": "Dim Vision",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 72,
    "skill": "Weaken",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 73,
    "skill": "Poison Dagger",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 74,
    "skill": "Corpse Explosion",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 75,
    "skill": "Clay Golem",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 76,
    "skill": "Iron Maiden",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 77,
    "skill": "Terror",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 78,
    "skill": "Bone Wall",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 79,
    "skill": "Golem Mastery",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 80,
    "skill": "Raise Skeletal Mage",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 81,
    "skill": "Confuse",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 82,
    "skill": "Life Tap",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 83,
    "skill": "Poison Explosion",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 84,
    "skill": "Bone Spear",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 85,
    "skill": "BloodGolem",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 86,
    "skill": "Attract",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 87,
    "skill": "Decrepify",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 88,
    "skill": "Bone Prison",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 89,
    "skill": "Summon Resist",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 90,
    "skill": "IronGolem",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 91,
    "skill": "Lower Resist",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 92,
    "skill": "Poison Nova",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 93,
    "skill": "Bone Spirit",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 94,
    "skill": "FireGolem",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 95,
    "skill": "Revive",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 96,
    "skill": "Sacrifice",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 97,
    "skill": "Smite",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 98,
    "skill": "Might",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 99,
    "skill": "Prayer",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 100,
    "skill": "Resist Fire",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 101,
    "skill": "Holy Bolt",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 102,
    "skill": "Holy Fire",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 103,
    "skill": "Thorns",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 104,
    "skill": "Defiance",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 105,
    "skill": "Resist Cold",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 106,
    "skill": "Zeal",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 107,
    "skill": "Charge",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 108,
    "skill": "Blessed Aim",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 109,
    "skill": "Cleansing",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 110,
    "skill": "Resist Lightning",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 111,
    "skill": "Vengeance",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 112,
    "skill": "Blessed Hammer",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 113,
    "skill": "Concentration",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 114,
    "skill": "Holy Freeze",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 115,
    "skill": "Vigor",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 116,
    "skill": "Conversion",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 117,
    "skill": "Holy Shield",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 118,
    "skill": "Holy Shock",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 119,
    "skill": "Sanctuary",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 120,
    "skill": "Meditation",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 121,
    "skill": "Fist of the Heavens",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 122,
    "skill": "Fanaticism",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 123,
    "skill": "Conviction",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 124,
    "skill": "Redemption",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 125,
    "skill": "Salvation",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 126,
    "skill": "Bash",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 127,
    "skill": "Sword Mastery",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 128,
    "skill": "Axe Mastery",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 129,
    "skill": "Mace Mastery",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 130,
    "skill": "Howl",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 131,
    "skill": "Find Potion",
    "costMult": 256,
    "costAdd": 3000
  },
  {
    "id": 132,
    "skill": "Leap",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 133,
    "skill": "Double Swing",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 134,
    "skill": "Pole Arm Mastery",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 135,
    "skill": "Throwing Mastery",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 136,
    "skill": "Spear Mastery",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 137,
    "skill": "Taunt",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 138,
    "skill": "Shout",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 139,
    "skill": "Stun",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 140,
    "skill": "Double Throw",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 141,
    "skill": "Increased Stamina",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 142,
    "skill": "Find Item",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 143,
    "skill": "Leap Attack",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 144,
    "skill": "Concentrate",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 145,
    "skill": "Iron Skin",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 146,
    "skill": "Battle Cry",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 147,
    "skill": "Frenzy",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 148,
    "skill": "Increased Speed",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 149,
    "skill": "Battle Orders",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 150,
    "skill": "Grim Ward",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 151,
    "skill": "Whirlwind",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 152,
    "skill": "Berserk",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 153,
    "skill": "Natural Resistance",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 154,
    "skill": "War Cry",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 155,
    "skill": "Battle Command",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 156,
    "skill": "Fire Hit",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 157,
    "skill": "UnHolyBolt",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 158,
    "skill": "SkeletonRaise",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 159,
    "skill": "MaggotEgg",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 160,
    "skill": "ShamanFire",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 161,
    "skill": "MagottUp",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 162,
    "skill": "MagottDown",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 163,
    "skill": "MagottLay",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 164,
    "skill": "AndrialSpray",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 165,
    "skill": "Jump",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 166,
    "skill": "Swarm Move",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 167,
    "skill": "Nest",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 168,
    "skill": "Quick Strike",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 169,
    "skill": "VampireFireball",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 170,
    "skill": "VampireFirewall",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 171,
    "skill": "VampireMeteor",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 172,
    "skill": "GargoyleTrap",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 173,
    "skill": "SpiderLay",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 174,
    "skill": "VampireHeal",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 175,
    "skill": "VampireRaise",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 176,
    "skill": "Submerge",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 177,
    "skill": "FetishAura",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 178,
    "skill": "FetishInferno",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 179,
    "skill": "ZakarumHeal",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 180,
    "skill": "Emerge",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 181,
    "skill": "Resurrect",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 182,
    "skill": "Bestow",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 183,
    "skill": "MissileSkill1",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 184,
    "skill": "MonTeleport",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 185,
    "skill": "PrimeLightning",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 186,
    "skill": "PrimeBolt",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 187,
    "skill": "PrimeBlaze",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 188,
    "skill": "PrimeFirewall",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 189,
    "skill": "PrimeSpike",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 190,
    "skill": "PrimeIceNova",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 191,
    "skill": "PrimePoisonball",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 192,
    "skill": "PrimePoisonNova",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 193,
    "skill": "DiabLight",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 194,
    "skill": "DiabCold",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 195,
    "skill": "DiabFire",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 196,
    "skill": "FingerMageSpider",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 197,
    "skill": "DiabWall",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 198,
    "skill": "DiabRun",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 199,
    "skill": "DiabPrison",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 200,
    "skill": "PoisonBallTrap",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 201,
    "skill": "AndyPoisonBolt",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 202,
    "skill": "HireableMissile",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 203,
    "skill": "DesertTurret",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 204,
    "skill": "ArcaneTower",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 205,
    "skill": "MonBlizzard",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 206,
    "skill": "Mosquito",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 207,
    "skill": "CursedBallTrapRight",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 208,
    "skill": "CursedBallTrapLeft",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 209,
    "skill": "MonFrozenArmor",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 210,
    "skill": "MonBoneArmor",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 211,
    "skill": "MonBoneSpirit",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 212,
    "skill": "MonCurseCast",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 213,
    "skill": "HellMeteor",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 214,
    "skill": "RegurgitatorEat",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 215,
    "skill": "MonFrenzy",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 216,
    "skill": "QueenDeath",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 217,
    "skill": "Scroll of Identify",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 218,
    "skill": "Book of Identify",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 219,
    "skill": "Scroll of Townportal",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 220,
    "skill": "Book of Townportal",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 221,
    "skill": "Raven",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 222,
    "skill": "Plague Poppy",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 223,
    "skill": "Wearwolf",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 224,
    "skill": "Shape Shifting",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 225,
    "skill": "Firestorm",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 226,
    "skill": "Oak Sage",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 227,
    "skill": "Summon Spirit Wolf",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 228,
    "skill": "Wearbear",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 229,
    "skill": "Molten Boulder",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 230,
    "skill": "Arctic Blast",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 231,
    "skill": "Cycle of Life",
    "costMult": 512,
    "costAdd": 3000
  },
  {
    "id": 232,
    "skill": "Feral Rage",
    "costMult": 512,
    "costAdd": 3000
  },
  {
    "id": 233,
    "skill": "Maul",
    "costMult": 512,
    "costAdd": 3000
  },
  {
    "id": 234,
    "skill": "Eruption",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 235,
    "skill": "Cyclone Armor",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 236,
    "skill": "Heart of Wolverine",
    "costMult": 640,
    "costAdd": 8000
  },
  {
    "id": 237,
    "skill": "Summon Fenris",
    "costMult": 640,
    "costAdd": 8000
  },
  {
    "id": 238,
    "skill": "Rabies",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 239,
    "skill": "Fire Claws",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 240,
    "skill": "Twister",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 241,
    "skill": "Vines",
    "costMult": 768,
    "costAdd": 16000
  },
  {
    "id": 242,
    "skill": "Hunger",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 243,
    "skill": "Shock Wave",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 244,
    "skill": "Volcano",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 245,
    "skill": "Tornado",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 246,
    "skill": "Spirit of Barbs",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 247,
    "skill": "Summon Grizzly",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 248,
    "skill": "Fury",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 249,
    "skill": "Armageddon",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 250,
    "skill": "Hurricane",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 251,
    "skill": "Fire Trauma",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 252,
    "skill": "Claw Mastery",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 253,
    "skill": "Psychic Hammer",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 254,
    "skill": "Tiger Strike",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 255,
    "skill": "Dragon Talon",
    "costMult": 256,
    "costAdd": 1000
  },
  {
    "id": 256,
    "skill": "Shock Field",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 257,
    "skill": "Blade Sentinel",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 258,
    "skill": "Quickness",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 259,
    "skill": "Fists of Fire",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 260,
    "skill": "Dragon Claw",
    "costMult": 384,
    "costAdd": 3000
  },
  {
    "id": 261,
    "skill": "Charged Bolt Sentry",
    "costMult": 512,
    "costAdd": 3000
  },
  {
    "id": 262,
    "skill": "Wake of Fire Sentry",
    "costMult": 512,
    "costAdd": 3000
  },
  {
    "id": 263,
    "skill": "Weapon Block",
    "costMult": 512,
    "costAdd": 3000
  },
  {
    "id": 264,
    "skill": "Cloak of Shadows",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 265,
    "skill": "Cobra Strike",
    "costMult": 512,
    "costAdd": 8000
  },
  {
    "id": 266,
    "skill": "Blade Fury",
    "costMult": 640,
    "costAdd": 8000
  },
  {
    "id": 267,
    "skill": "Fade",
    "costMult": 640,
    "costAdd": 8000
  },
  {
    "id": 268,
    "skill": "Shadow Warrior",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 269,
    "skill": "Claws of Thunder",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 270,
    "skill": "Dragon Tail",
    "costMult": 640,
    "costAdd": 16000
  },
  {
    "id": 271,
    "skill": "Lightning Sentry",
    "costMult": 768,
    "costAdd": 16000
  },
  {
    "id": 272,
    "skill": "Inferno Sentry",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 273,
    "skill": "Mind Blast",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 274,
    "skill": "Blades of Ice",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 275,
    "skill": "Dragon Flight",
    "costMult": 768,
    "costAdd": 32000
  },
  {
    "id": 276,
    "skill": "Death Sentry",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 277,
    "skill": "Blade Shield",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 278,
    "skill": "Venom",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 279,
    "skill": "Shadow Master",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 280,
    "skill": "Royal Strike",
    "costMult": 896,
    "costAdd": 64000
  },
  {
    "id": 281,
    "skill": "Wake Of Destruction Sentry",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 282,
    "skill": "Imp Inferno",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 283,
    "skill": "Imp Fireball",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 284,
    "skill": "Baal Taunt",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 285,
    "skill": "Baal Corpse Explode",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 286,
    "skill": "Baal Monster Spawn",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 287,
    "skill": "Catapult Charged Ball",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 288,
    "skill": "Catapult Spike Ball",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 289,
    "skill": "Suck Blood",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 290,
    "skill": "Cry Help",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 291,
    "skill": "Healing Vortex",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 292,
    "skill": "Teleport 2",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 293,
    "skill": "Self-resurrect",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 294,
    "skill": "Vine Attack",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 295,
    "skill": "Overseer Whip",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 296,
    "skill": "Barbs Aura",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 297,
    "skill": "Wolverine Aura",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 298,
    "skill": "Oak Sage Aura",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 299,
    "skill": "Imp Fire Missile",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 300,
    "skill": "Impregnate",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 301,
    "skill": "Siege Beast Stomp",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 302,
    "skill": "MinionSpawner",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 303,
    "skill": "CatapultBlizzard",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 304,
    "skill": "CatapultPlague",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 305,
    "skill": "CatapultMeteor",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 306,
    "skill": "BoltSentry",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 307,
    "skill": "CorpseCycler",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 308,
    "skill": "DeathMaul",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 309,
    "skill": "Defense Curse",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 310,
    "skill": "Blood Mana",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 311,
    "skill": "mon inferno sentry",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 312,
    "skill": "mon death sentry",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 313,
    "skill": "sentry lightning",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 314,
    "skill": "fenris rage",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 315,
    "skill": "Baal Tentacle",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 316,
    "skill": "Baal Nova",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 317,
    "skill": "Baal Inferno",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 318,
    "skill": "Baal Cold Missiles",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 319,
    "skill": "MegademonInferno",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 320,
    "skill": "EvilHutSpawner",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 321,
    "skill": "CountessFirewall",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 322,
    "skill": "ImpBolt",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 323,
    "skill": "Horror Arctic Blast",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 324,
    "skill": "death sentry ltng",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 325,
    "skill": "VineCycler",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 326,
    "skill": "BearSmite",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 327,
    "skill": "Resurrect2",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 328,
    "skill": "BloodLordFrenzy",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 329,
    "skill": "Baal Teleport",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 330,
    "skill": "Imp Teleport",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 331,
    "skill": "Baal Clone Teleport",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 332,
    "skill": "ZakarumLightning",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 333,
    "skill": "VampireMissile",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 334,
    "skill": "MephistoMissile",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 335,
    "skill": "DoomKnightMissile",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 336,
    "skill": "RogueMissile",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 337,
    "skill": "HydraMissile",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 338,
    "skill": "NecromageMissile",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 339,
    "skill": "MonBow",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 340,
    "skill": "MonFireArrow",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 341,
    "skill": "MonColdArrow",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 342,
    "skill": "MonExplodingArrow",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 343,
    "skill": "MonFreezingArrow",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 344,
    "skill": "MonPowerStrike",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 345,
    "skill": "SuccubusBolt",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 346,
    "skill": "MephFrostNova",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 347,
    "skill": "MonIceSpear",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 348,
    "skill": "ShamanIce",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 349,
    "skill": "Diablogeddon",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 350,
    "skill": "Delerium Change",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 351,
    "skill": "NihlathakCorpseExplosion",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 352,
    "skill": "SerpentCharge",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 353,
    "skill": "Trap Nova",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 354,
    "skill": "UnHolyBoltEx",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 355,
    "skill": "ShamanFireEx",
    "costMult": 0,
    "costAdd": 0
  },
  {
    "id": 356,
    "skill": "Imp Fire Missile Ex",
    "costMult": 0,
    "costAdd": 0
  }
]
