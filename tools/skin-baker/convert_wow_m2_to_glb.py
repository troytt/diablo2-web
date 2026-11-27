#!/usr/bin/env python3
"""
World of Warcraft 3.3.5 character -> glTF binary converter with a paper-doll description
(`tools/skin-baker/convert_wow_m2_to_glb.py`).

Emits the same GLB layout as `convert_war3_mdx_to_glb.py` (one skin, pure-translation inverse
binds, one primitive per geoset layer, per-clip `extras`), plus a root `extras.paperdoll` block
that the runtime uses to dress the model:

    paperdoll = {
      "canvas": <image index of the composited body texture>,
      "hidden": [<geoset>, ...],                      # hidden unless an option shows them
      "slots": { <slot>: { <option>: {
          "show": [<geoset>, ...], "hide": [<geoset>, ...],
          "layers": [{"image": i, "x": .., "y": .., "w": .., "h": .., "order": n}, ...] } } },
      "defaults": { <slot>: <option> }
    }

Equipment that is a separate model in the game (weapons, shield, helmets) is merged into the GLB
as extra geosets bound rigidly to the character's attachment bone, so the runtime only toggles
geosets; armour is a set of texture layers composited onto the body texture regions.

The game archives are not part of this repository: they are read from `--wow-dir`
(`WOW_335_DIR`, default `<home>/d2-data/wow-335`).
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
from typing import Dict, List, Optional, Tuple

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import convert_war3_mdx_to_glb as glb  # noqa: E402
import wow_blp  # noqa: E402
import wow_dbc  # noqa: E402
import wow_m2  # noqa: E402
import wow_mpq  # noqa: E402

# Model units are yards; scale so one unit is about the size of a Warcraft III model unit.
MODEL_SCALE = 50.0
SAMPLE_HZ = 30.0
SIN_PITCH = 0.5
COS_PITCH = math.sqrt(1.0 - SIN_PITCH * SIN_PITCH)
BOX_MARGIN_PX = 8

# Body texture layout (512x512), `CharComponentTextureSections` of the 3.3.5 client.
REGIONS = {
    "AU": (0, 0, 256, 128), "AL": (0, 128, 256, 128), "HA": (0, 256, 256, 64),
    "FU": (0, 320, 256, 64), "FL": (0, 384, 256, 128),
    "TU": (256, 0, 256, 128), "TL": (256, 128, 256, 64),
    "LU": (256, 192, 256, 128), "LL": (256, 320, 256, 128), "FO": (256, 448, 256, 64),
}
REGION_DIRS = {
    "AU": "ArmUpperTexture", "AL": "ArmLowerTexture", "HA": "HandTexture", "TU": "TorsoUpperTexture",
    "TL": "TorsoLowerTexture", "LU": "LegUpperTexture", "LL": "LegLowerTexture", "FO": "FootTexture",
}
# Compositing order of armour pieces sharing a region (higher draws later).
PIECE_ORDER = {"pant": 10, "boot": 20, "sleeve": 30, "chest": 30, "robe": 30, "belt": 35, "glove": 40}

# Character attachment ids.
ATT_SHIELD, ATT_HAND_RIGHT, ATT_HAND_LEFT, ATT_HELM = 0, 1, 2, 11

# 3.3.5 `AnimationData` ids.
ANIM_STAND, ANIM_DEATH, ANIM_WALK, ANIM_RUN, ANIM_WOUND = 0, 1, 4, 5, 9
ANIM_ATTACK_UNARMED, ANIM_ATTACK_1H, ANIM_ATTACK_2H, ANIM_SHIELD_BLOCK = 16, 17, 18, 24
ANIM_ATTACK_2HL, ANIM_READY_1H, ANIM_READY_2H, ANIM_READY_2HL, ANIM_READY_BOW = 19, 26, 27, 28, 29
ANIM_ATTACK_BOW, ANIM_READY_RIFLE, ANIM_ATTACK_RIFLE, ANIM_CAST_DIRECTED = 46, 48, 49, 53
ANIM_ATTACK_THROWN, ANIM_READY_THROWN = 107, 108

# How a weapon is held: stance name -> (ready animation, attack animation).
STANCES = {
    "1h": (ANIM_READY_1H, ANIM_ATTACK_1H),
    "2h": (ANIM_READY_2H, ANIM_ATTACK_2H),
    "2hl": (ANIM_READY_2HL, ANIM_ATTACK_2HL),
    "bow": (ANIM_READY_BOW, ANIM_ATTACK_BOW),
    "xbow": (ANIM_READY_RIFLE, ANIM_ATTACK_RIFLE),
    "thrown": (ANIM_READY_THROWN, ANIM_ATTACK_THROWN),
}

_WEAPON_DIR = "Item\\ObjectComponents\\Weapon\\"
_SHIELD_DIR = "Item\\ObjectComponents\\Shield\\"

# Weapon slot option -> (model, texture, stance, attachment, scale). One generic (non-dungeon,
# non-raid) model per Diablo II weapon family; see `mesh-skin-paperdoll.ts` for the item mapping.
WEAPONS = {
    "axe": ("Axe_1H_Hatchet_A_01", "Axe_1H_Hatchet_A_01Red", "1h", ATT_HAND_RIGHT, 1.0),
    "pick": ("Axe_1H_Pick_A_01", "Axe_1H_Pick_A_01Black", "1h", ATT_HAND_RIGHT, 1.0),
    "axe2h": ("Axe_2H_Battle_B_01", "Axe_2H_Battle_B_01", "2h", ATT_HAND_RIGHT, 1.0),
    "club": ("Mace_1H_Spiked_A_01", "Mace_1H_Spiked_A_01_V01", "1h", ATT_HAND_RIGHT, 1.0),
    "mace": ("Mace_1H_Flanged_A_02", "Mace_1H_Flanged_A_02Blue", "1h", ATT_HAND_RIGHT, 1.0),
    "hammer": ("Hammer_1H_Standard_A_01", "Hammer_1H_Standard_A_01Silver", "1h", ATT_HAND_RIGHT, 1.0),
    "hammer2h": ("Hammer_2H_Maul_B_02", "Hammer_2H_Maul_B_02Red", "2h", ATT_HAND_RIGHT, 1.0),
    "scepter": ("Mace_1H_Flanged_A_02", "Mace_1H_Flanged_A_02Blue", "1h", ATT_HAND_RIGHT, 1.0),
    "sword": ("Sword_1H_Long_B_02", "Sword_1H_Long_B_02Silver", "1h", ATT_HAND_RIGHT, 1.0),
    "saber": ("Sword_1H_Sabre_B_01", "Knife_1H_Hunting_B_02Green", "1h", ATT_HAND_RIGHT, 1.0),
    "sword2h": ("Sword_2H_Claymore_A_01", "Sword_2H_Claymore_A_01Rusty", "2h", ATT_HAND_RIGHT, 1.0),
    "dagger": ("Knife_1H_Dagger_A_01", "Knife_1H_Dagger_A_01Copper", "1h", ATT_HAND_RIGHT, 1.0),
    "spear": ("Polearm_2H_Bladed_A_02", "Polearm_2H_Bladed_A_02Black", "2hl", ATT_HAND_RIGHT, 1.0),
    "trident": ("Polearm_2H_Trident_B_01", "Polearm_2H_Trident_A_02Black", "2hl", ATT_HAND_RIGHT, 1.0),
    "polearm": ("Polearm_2H_Bladed_C_01", "Polearm_2H_Bladed_C_01", "2hl", ATT_HAND_RIGHT, 1.0),
    "scythe": ("Stave_2H_Scythe_C_03", "Stave_2H_Other_B_01Blue", "2hl", ATT_HAND_RIGHT, 1.0),
    "claw": ("Hand_1H_Claw_B_01", "Hand_1H_Claw_B_01Brown", "1h", ATT_HAND_RIGHT, 1.0),
    "staff": ("Stave_2H_Long_A_03", "Stave_2H_Long_A_03Green", "2h", ATT_HAND_RIGHT, 1.0),
    "wand": ("Wand_1H_Horde_A_03", "Wand_1H_Horde_A_03Red", "1h", ATT_HAND_RIGHT, 1.0),
    "orb": ("Misc_1H_Orb_A_02", "Misc_1H_Orb_A_02Quest01", "1h", ATT_HAND_RIGHT, 1.0),
    "bow": ("Bow_1H_Standard_A_01", "Bow_1H_Standard_A_01Green", "bow", ATT_HAND_LEFT, 1.0),
    "crossbow": ("Bow_1H_Crossbow_A_01", "Bow_1H_Crossbow_A_01Silver", "xbow", ATT_HAND_RIGHT, 1.0),
    # The game has no javelin model; a plain spear at reduced size stands in for it.
    "javelin": ("Polearm_2H_Bladed_A_01", "Polearm_2H_Bladed_A_01", "thrown", ATT_HAND_RIGHT, 0.6),
    "tknife": ("Thrown_1H_Dagger_A_01", "Thrown_1H_Dagger_A_01Copper", "thrown", ATT_HAND_RIGHT, 1.0),
    "taxe": ("Thrown_1H_Axe_A_02", "Thrown_1H_Axe_A_02Blue", "thrown", ATT_HAND_RIGHT, 1.0),
    "tpotion": ("Misc_1H_Potion_B_01", "Misc_1H_Potion_B_01Blue", "thrown", ATT_HAND_RIGHT, 1.0),
}

# Elite unique weapons with a look of their own: `UniqueItems.txt` row id -> (model, texture,
# weapon family, class token or None). The family (see `WEAPONS`) gives the hand and the size
# rule; the class names the only class that can wield a class-only item. These models are not part
# of any skin: `--weapon-pack` writes one small GLB each, and the runtime attaches the one a player
# wields to the hand attachment of whatever character skin is worn (`paperdoll.attachments`).
UNIQUE_WEAPONS = {
    254: ("Axe_2H_OutlandRaid_D_02_Red", "Axe_2H_OutlandRaid_D_02", "axe2h", None),  # Hellslayer
    255: ("Axe_2H_Gorehowl_D_01", "Axe_2H_Gorehowl_C_01", "axe2h", None),  # Messerschmidt's Reaver
    256: ("Mace_1H_Hellfire_D_01", "Mace_1H_Hellfire_D_01", "mace", None),  # Baranar's Star
    257: ("mace_1h_doomhammer_d_01", "mace_1h_doomhammer_d_01", "hammer", None),  # Schaefer's Hammer
    258: ("Hammer_2H_Standard_E_01", "Hammer_2H_Standard_E_01", "hammer2h", None),  # The Cranium Basher
    259: ("Sword_1H_Long_D_01", "Sword_1H_Long_D_01_V01", "sword", None),  # Lightsabre
    260: ("Sword_2H_Frostmourne_D_01", "Sword_2H_Frostmourne_D_01", "sword2h", None),  # Doombringer
    261: ("Sword_2H_Ashbringer", "Sword_2H_Ashbringer", "sword2h", None),  # The Grandfather
    262: ("Knife_1H_Mage_D_01", "Knife_1H_Mage_D_01Blue", "dagger", None),  # Wizardspike
    264: ("PoleArm_2H_Northrend_D_03", "PoleArm_2H_Northrend_D_03", "scythe", None),  # Stormspire
    265: ("Bow_1H_Blood_C_01", "Bow_1H_Blood_C_01", "bow", None),  # Eaglehorn
    266: ("Bow_1H_Sunwell_D_02", "Bow_1H_Sunwell_D_02", "bow", None),  # Windforce
    289: ("Sword_1H_Raid_D_04", "Sword_1H_Raid_D_04", "saber", None),  # Bloodmoon
    290: ("Sword_1H_HaremMatron_D_01", "Sword_1H_HaremMatron_D_01", "saber", None),  # Djinnslayer
    292: ("Thrown_1H_Sunwell_D_01", "Thrown_1H_Sunwell_D_01Ice", "tknife", None),  # Warshrike
    293: ("bow_2h_crossbow_icecrownraid_d_01", "bow_2h_crossbow_icecrownraid_d_01orange", "crossbow", None),  # Gutsiphon
    294: ("Axe_1H_Northrend_D_01", "Axe_1H_Northrend_D_01Purple", "axe", None),  # Razoredge
    296: ("Mace_1H_BlackTemple_D_02", "Mace_1H_BlackTemple_D_02Red", "club", None),  # Demonlimb
    298: ("Polearm_2H_Northrend_C_02", "Polearm_2H_Northrend_C_02Black", "polearm", None),  # Tomb Reaver
    299: ("Wand_1H_AhnQiraj_D_01", "Wand_1H_AhnQiraj_D_01Green", "wand", None),  # Deaths's Web
    301: ("Sword_1H_Naxxramas_D_01", "Sword_1H_Naxxramas_D_01", "sword", None),  # Azurewrath
    304: ("Knife_1H_AhnQiraj_D_04", "Knife_1H_AhnQiraj_D04", "dagger", None),  # Fleshripper
    306: ("Mace_1H_Hyjal_D_01", "Mace_1H_Hyjal_D_01Blue", "mace", None),  # Horizon's Tornado
    307: ("Mace_1H_Northrend_C_01", "MACE_1H_NORTHREND_C_01GREEN", "hammer", None),  # Stone Crusher
    308: ("hand_1h_icecrownraid_d_02right", "hand_1h_icecrownraid_d_02black", "claw", "ai"),  # Jadetalon
    313: ("Axe_1H_OutlandRaid_D_02", "Axe_1H_OutlandRaid_D_02", "axe", None),  # Runemaster
    314: ("Axe_1H_ZulGurub_D_01", "Axe_1H_ZulGurub_D_01", "axe", None),  # Deathcleaver
    315: ("axe_2h_icecrownraid_e_01", "axe_2h_icecrownraid_e_01", "axe2h", None),  # Executioner's Justice
    316: ("Polearm_2H_Epic_D_01", "Polearm_2H_Epic_D_01", "spear", "am"),  # Stoneraven
    320: ("Polearm_2H_Utgarde_D_01", "Polearm_2H_Utgarde_D_01Blue", "javelin", None),  # Gargoyle's Bite
    321: ("Thrown_1H_Axe_B_01", "Thrown_1H_Axe_B_01Gold", "taxe", None),  # Lacerator
    322: ("Stave_2H_Long_EpicPriest01", "Stave_2H_Long_D_02Gold", "staff", None),  # Mang Song's Lesson
    323: ("Polearm_2H_Epic_D_06", "Polearm_2H_Epic_D_06", "spear", None),  # Viperfork
    324: ("Axe_2H_OutlandRaid_D_01", "Axe_2H_OutlandRaid_D_01", "axe2h", None),  # Ethereal Edge
    326: ("Stave_2H_Other_C_03", "Stave_2H_Other_C_03Dark", "scythe", None),  # The Reaper's Toll
    328: ("Bow_2H_Crossbow_OutlandRaid_D_05", "Bow_2H_Crossbow_OutlandRaid_D_05", "crossbow", None),  # Hellrack
    331: ("Bow_1H_Stratholme_D_01", "Bow_1h_Stratholme_D_01", "bow", None),  # Widowmaker
    332: ("Bow_1H_OutlandRaid_D_06", "Bow_1H_OutlandRaid_D_06", "bow", "am"),  # Bloodraven's Charge
    333: ("Knife_1H_Naxxramas_D_01", "Knife_1H_Naxxramas_D_01", "dagger", None),  # Ghostflame
    334: ("Hand_1H_Raid_D_01Right", "Hand_1H_Raid_D_01Violet", "claw", "ai"),  # Shadowkiller
    335: ("Glave_1H_Short_A_03", "Glave_1H_Short_A_03Green", "taxe", None),  # Gimmershred
    337: ("Mace_2H_OutlandRaid_D_06", "Mace_2H_OutlandRaid_D_06", "hammer2h", None),  # Windhammer
    338: ("Polearm_2H_FrostGiant", "WeaponSpec_Blue", "javelin", "am"),  # Thunderstroke
    340: ("Polearm_2H_Blood_Elf_D_01", "Polearm_2H_Blood_Elf_D_01", "javelin", None),  # Demon's Arch
    342: ("Polearm_2H_UlduarRaid_D_01", "Polearm_2H_UlduarRaid_D_01Gold", "spear", None),  # Steelpillar
    351: ("Wand_1H_ZulGurub_D_02", "Knife_1H_ZulGurub_D_02Peace", "wand", None),  # Boneshade
    353: ("Sword_2H_Raid_D_04", "Sword_2H_Raid_D_04", "sword2h", None),  # Flamebellow
    354: ("Offhand_OutlandRaid_D_02", "Offhand_OutlandRaid_D_02", "orb", "so"),  # Fathom
    360: ("Mace_1H_Nexus_D_01", "Mace_1H_Nexus_D_01", "mace", None),  # Stormlash
    365: ("Sword_1H_Crystal_C_01", "Sword_1H_Crystal_C_01Blue", "sword", None),  # Frostwind
    367: ("Offhand_Naxxramas_D_01", "Offhand_Naxxramas_D_01", "orb", "so"),  # Eschuta's temper
    368: ("Hand_1H_OutlandRaid_D_01Right", "Hand_1H_OutlandRaid_D_01 Red", "claw", "ai"),  # Firelizard's Talons
    371: ("Mace_1H_OutlandRaid_D_03", "Mace_1H_OutlandRaid_D_03", "scepter", None),  # Heaven's Light
    380: ("Mace_1H_UlduarRaid_D_01", "mace_1h_ulduarraid_d_01_dark", "scepter", None),  # Ironward
    382: ("Polearm_2H_BlackTemple_D_01", "Polearm_2H_BlackTemple_D_01", "spear", None),  # Arioc's Needle
    383: ("Axe_1H_OutlandRaid_D_06", "Axe_1H_OutlandRaid_D_06", "pick", None),  # Cranebeak
    384: ("Mace_1H_FrostGiant", "WeaponSpec_Blue", "club", None),  # Nord's Tenderizer
    385: ("Mace_2H_Northrend_C_01", "Mace_2H_Northrend_C_01Blue", "hammer2h", None),  # Earthshifter
    386: ("polearm_2h_icecrownraid_d_01", "polearm_2h_icecrownraid_d_01purple", "javelin", None),  # Wraithflight
    387: ("Polearm_2H_Northrend_C_01", "Polearm_2H_Northrend_C_01Blue", "polearm", None),  # Bonehew
    388: ("Stave_2H_Sunwell_D_01", "Stave_2H_Sunwell_D_01", "staff", None),  # Ondal's Wisdom
    389: ("Hammer_1H_War_D_01", "Hammer_1H_War_D_01_V01", "scepter", None),  # The Reedeemer
}
WEAPON_PACK_ID = "wow-weapons"
# Javelins have no model of their own: a polearm at this size stands in (as for the plain javelin).
UNIQUE_JAVELIN_SCALE = 0.6

# Off-hand slot option -> (directory, model, texture).
OFFHANDS = {
    "buckler": (_SHIELD_DIR, "Buckler_Round_A_01", "Buckler_Round_A_01Purple"),
    "shield": (_SHIELD_DIR, "Shield_Oval_A_01", "Shield_Oval_A_01Black"),
    "kite": (_SHIELD_DIR, "Shield_Crest_A_01", "Shield_Crest_A_01Silver"),
    "tower": (_SHIELD_DIR, "Shield_Rectangle_A_01", "Shield_Rectangle_A_01Purple"),
    "spiked": (_SHIELD_DIR, "Shield_Horde_B_01", "Shield_Horde_B_01"),
    "paladin": (_SHIELD_DIR, "Shield_Lion_A_01", "Shield_Lion_A_01"),
    "head": (_WEAPON_DIR, "Misc_1H_Skull_B_01", "Misc_1H_Skull_B_01Black"),
}


_HEAD_DIR = "Item\\ObjectComponents\\Head\\"

# Helmet slot option -> (model, texture, hide hair). One model per Diablo II helmet family;
# several come from dungeon / raid sets because the game has few generic helmet shapes.
HELMS = {
    "cap": ("Helm_Cloth_A_01", "Helm_Cloth_A_01Yellow", True),
    "skullcap": ("Helm_Mail_B_01", "Helm_Mail_B_01", True),
    "helm": ("Helm_Plate_A_02IronforgeGuard", "Helm_Plate_A_02Black", True),
    "fullhelm": ("Helm_Plate_B_01Stormwind", "Helm_Plate_B_01Green", True),
    "greathelm": ("Helm_Plate_DungeonWarrior_A_01", "Helm_Plate_DungeonWarrior_A_01Gold", True),
    "crown": ("Helm_Robe_AhnQiraj_A_01", "Helm_Robe_AhnQiraj_A_01Purple", False),
    "mask": ("Helm_Mask_A_01Troll", "Helm_Mask_A_01", False),
    "bone": ("Helm_Mask_ZulGurub_D_01", "Helm_Mask_ZulGurub_D_01Red", False),
    "circlet": ("Helm_Circlet_B_02", "Helm_Circlet_B_02SilverBlue", False),
    "pelt": ("Helm_Leather_DungeonDruid_A_01", "Helm_Leather_DungeonDruid_A_01_Purple", True),
    "barbarian": ("Helm_Plate_Viking_D_01", "Helm_Plate_Viking_D_01bronze", True),
}

# Body armour slot option `<family><tier>` -> (texture set prefix, robe, sleeve geoset or None).
# Tier 1 / 2 / 3 is the normal / exceptional / elite version of the Diablo II base item.
ARMORS = {
    "quilted1": ("Robe_A_03Brown", True, 802), "quilted2": ("Robe_A_02Gray", True, 803),
    "quilted3": ("Robe_A_01Blue", True, 802),
    "leather1": ("Leather_A_04Brown", False, None), "leather2": ("Leather_A_01Dark", False, None),
    "leather3": ("Leather_B_02Brown", False, None),
    "studded1": ("Leather_B_01Purple", False, None), "studded2": ("Leather_C_02Red", False, None),
    "studded3": ("Leather_C_03Red", False, None),
    "ring1": ("Mail_A_03Silver", False, None), "ring2": ("Mail_A_02Blue", False, None),
    "ring3": ("Mail_A_01", False, None),
    "scale1": ("Mail_B_01Red", False, None), "scale2": ("Mail_B_02Green", False, None),
    "scale3": ("Mail_C_01Silver", False, None),
    "breast1": ("Plate_A_01Silver", False, None), "breast2": ("Plate_A_02Bluish", False, None),
    "breast3": ("Plate_A_04Silver", False, None),
    "plate1": ("Plate_A_05_Red", False, None), "plate2": ("Plate_B_03Blue", False, None),
    "plate3": ("Plate_C_03", False, None),
    "gothic1": ("Plate_C_05_Blue", False, None), "gothic2": ("Plate_C_04Onyx", False, None),
    "gothic3": ("Plate_C_01Gold", False, None),
}
# Pieces of an armour set, in the order they are looked up: (kind, region).
ARMOR_PIECES = [("pant", "LU"), ("pant", "LL"), ("sleeve", "AU"), ("sleeve", "AL"), ("chest", "TU"),
                ("chest", "TL"), ("belt", "TL"), ("belt", "LU")]
# The feet always wear this one pair of boots, whatever the armour (boots are not a paper-doll slot).
BOOTS_SET = "Leather_A_04Brown"


def _helm_slot(suffix: str = "HuF") -> dict:
    """Helmet models exist once per race and sex; `suffix` is the model's race/sex code (`HuF`, `NiF`, ...)."""
    slot = {"none": {}}
    for name, (model, texture, hide_hair) in HELMS.items():
        slot[name] = {"object": _HEAD_DIR + model + "_" + suffix, "texture": _HEAD_DIR + texture + ".blp",
                      "attach": ATT_HELM, "hide_hair": hide_hair}
    return slot


def _armor_slot() -> dict:
    slot = {"none": {}}
    for name, (prefix, robe, sleeve) in ARMORS.items():
        slot[name] = {"auto_set": prefix, "robe": robe,
                      "geosets": ([1302] if robe else []) + ([sleeve] if sleeve else []),
                      "hide": [1301] if robe else []}
    return slot


# Dual wielding (Barbarian, Assassin): the second weapon is an off-hand option `w-<weapon>` in the
# left hand. A two-handed sword held in one hand next to it is the weapon option `sword2h1`.
ONE_HANDED_GREATSWORD = "sword2h1"
OFFHAND_WEAPON_PREFIX = "w-"


def _dual_wieldable() -> list:
    return [name for name, (_m, _t, stance, attach, _s) in WEAPONS.items()
            if (stance in ("1h", "thrown") and attach == ATT_HAND_RIGHT) or name == "sword2h"]


# Small pack weapons (wands, throwing weapons, some orbs) all but vanish at game size: a model
# shorter than the minimum length (yards) is enlarged up to it, by at most the maximum factor.
UNIQUE_MIN_LENGTH = 0.95
UNIQUE_MAX_ENLARGE = 1.6


def _unique_scale(family: str, item: "wow_m2.M2Model") -> float:
    if family == "javelin":
        return UNIQUE_JAVELIN_SCALE
    length = float((item.positions.max(axis=0) - item.positions.min(axis=0)).max())
    if length <= 0.0 or length >= UNIQUE_MIN_LENGTH:
        return 1.0
    return round(min(UNIQUE_MAX_ENLARGE, UNIQUE_MIN_LENGTH / length), 3)


def _pack_weapons_in_reach(cls: str, dual: bool) -> list:
    """(model, attachment id, weapon family, mirrored) of every pack weapon a class can hold, for its box."""
    out = []
    wieldable = set(_dual_wieldable())
    for model, _texture, family, only in UNIQUE_WEAPONS.values():
        if only is not None and only != cls:
            continue
        out.append((_WEAPON_DIR + model, WEAPONS[family][3], family, False))
        if dual and family in wieldable:
            out.append((_WEAPON_DIR + model, ATT_HAND_LEFT, family, True))
    return out


def _weapon_slot(dual: bool = False) -> dict:
    slot = {"none": {}}
    for name, (model, texture, _stance, attach, scale) in WEAPONS.items():
        slot[name] = {"object": _WEAPON_DIR + model, "texture": _WEAPON_DIR + texture + ".blp",
                      "attach": attach, "scale": scale}
    if dual:
        slot[ONE_HANDED_GREATSWORD] = dict(slot["sword2h"])
    return slot


def _offhand_slot(dual: bool = False) -> dict:
    slot = {"none": {}}
    for name, (folder, model, texture) in OFFHANDS.items():
        slot[name] = {"object": folder + model, "texture": folder + texture + ".blp", "attach": ATT_SHIELD}
    if dual:
        for name in _dual_wieldable():
            model, texture, _stance, _attach, scale = WEAPONS[name]
            # The left hand holds the mirror image of the right-hand model.
            slot[OFFHAND_WEAPON_PREFIX + name] = {
                "object": _WEAPON_DIR + model, "texture": _WEAPON_DIR + texture + ".blp",
                "attach": ATT_HAND_LEFT, "scale": scale, "mirror": True}
    return slot


def _stance_clips() -> list:
    clips = []
    for stance, (ready, attack) in STANCES.items():
        clips.append((f"nu:{stance}", ready, True, 0.0))
        clips.append((f"a1:{stance}", attack, False, 0.0))
    return clips


def _weapon_clip_aliases(dual: bool = False) -> dict:
    """`<mode>:<weapon option>` -> the stance clip it plays."""
    out = {}
    for name, (_model, _texture, stance, _attach, _scale) in WEAPONS.items():
        out[f"nu:{name}"] = f"nu:{stance}"
        out[f"a1:{name}"] = f"a1:{stance}"
    if dual:
        out[f"nu:{ONE_HANDED_GREATSWORD}"] = "nu:1h"
        out[f"a1:{ONE_HANDED_GREATSWORD}"] = "a1:1h"
    return out

# Diablo II mode token -> (animation id, loop, ground speed in yards/s) for every character model.
HERO_CLIPS = [
    ("nu", ANIM_STAND, True, 0.0),
    ("wl", ANIM_WALK, True, 2.5),
    ("rn", ANIM_RUN, True, 7.0),
    ("sc", ANIM_CAST_DIRECTED, False, 0.0),
    ("a1", ANIM_ATTACK_UNARMED, False, 0.0),
    ("th", ANIM_ATTACK_THROWN, False, 0.0),
    ("gh", ANIM_WOUND, False, 0.0),
    ("bl", ANIM_SHIELD_BLOCK, False, 0.0),
    ("dt", ANIM_DEATH, False, 0.0),
]

# Shape-shift forms: creature models with one fixed look. Clip keys are Diablo II player mode tokens;
# a tuple of animation ids means "the first one the model has".
MORPH_CLIPS = [
    ("nu", ANIM_STAND, True, 0.0),
    ("wl", ANIM_WALK, True, 2.5),
    ("rn", ANIM_RUN, True, 7.0),
    ("a1", (ANIM_ATTACK_UNARMED, ANIM_ATTACK_1H), False, 0.0),
    ("a2", (ANIM_ATTACK_1H, ANIM_ATTACK_UNARMED), False, 0.0),
    ("sc", (ANIM_CAST_DIRECTED, ANIM_ATTACK_UNARMED), False, 0.0),
    ("gh", ANIM_WOUND, False, 0.0),
    ("dt", ANIM_DEATH, False, 0.0),
]

RACE_IDS = {"Human": 1, "Orc": 2, "Dwarf": 3, "NightElf": 4, "Scourge": 5, "Tauren": 6, "Gnome": 7, "Troll": 8,
            "BloodElf": 10, "Draenei": 11}
RACE_CODES = {"Human": "Hu", "Orc": "Or", "Dwarf": "Dw", "NightElf": "Ni", "Scourge": "Sc", "Tauren": "Ta",
              "Gnome": "Gn", "Troll": "Tr", "BloodElf": "Be", "Draenei": "Dr"}
# On-screen height (scene pixels) every character is scaled to before its own `height` factor.
CHARACTER_HEIGHT_PX = 81.5

SKINS = {
    "so-wow-human-mage": {
        "model": "Character\\Human\\Female\\HumanFemale",
        "px": 0.84,
        "skin": [
            ("Character\\Human\\Female\\HumanFemaleSkin00_00.blp", None),
            ("Character\\Human\\Female\\HumanFemaleFaceLower00_00.blp", "FL"),
            ("Character\\Human\\Female\\HumanFemaleFaceUpper00_00.blp", "FU"),
            ("Character\\Human\\Female\\HumanFemaleNakedPelvisSkin00_00.blp", "LU"),
            ("Character\\Human\\Female\\HumanFemaleNakedTorsoSkin00_00.blp", "TU"),
        ],
        "hair_geoset": 9,
        "hair_texture": "Character\\Human\\Hair00_03.blp",
        # Geoset ids always drawn (body, ears, bare feet/hands/legs are handled by the slots below).
        "base_geosets": [0, 702],
        # (slot, option) -> what the option wears. `geosets`/`hide` are game geoset ids.
        "slots": {
            "armor": _armor_slot(),
            "helm": _helm_slot(),
            "weapon": _weapon_slot(),
            "offhand": _offhand_slot(),
        },
        "pack_weapons": _pack_weapons_in_reach("so", False),
        "default_geosets": [401, 501, 1301],
        # Diablo II mode token -> (animation id, loop, ground speed in yards/s). `<token>:<stance>`
        # clips are added per weapon stance and aliased to every weapon option of that stance.
        "clips": HERO_CLIPS,
    },
    "dz-wow-nightelf": {
        # Appearance indices as in the game's character creation: skin colour, hair style, hair colour.
        "character": {"cls": "dz", "race": "NightElf", "sex": "Female", "skin": 2, "hair": 3, "hair_colour": 4, "height": 1.05},
        # Diablo II morph token -> creature model: werewolf (`40`) and werebear (`tg`).
        "morphs": {
            "40": {"model": "Creature\\Worgen\\Worgen", "height_px": 92.0,
                   "textures": {11: "Creature\\Worgen\\WargenSkinBlack.blp"}},
            "tg": {"model": "Creature\\Furbolg\\Furbolg", "height_px": 92.0,
                   "textures": {11: "Creature\\Furbolg\\FurbolgSkinWhite.blp",
                                12: "Creature\\Furbolg\\FurbolgStuffWhite.blp"}},
        },
    },
    "am-wow-bloodelf": {
        "character": {"cls": "am", "race": "BloodElf", "sex": "Female", "skin": 4, "hair": 0, "hair_colour": 2, "height": 1.0},
    },
    "ne-wow-undead": {
        "character": {"cls": "ne", "race": "Scourge", "sex": "Male", "skin": 5, "hair": 3, "hair_colour": 2, "height": 1.0},
    },
    "pa-wow-dwarf": {
        "character": {"cls": "pa", "race": "Dwarf", "sex": "Male", "skin": 5, "hair": 8, "hair_colour": 2, "height": 0.88},
    },
    "ba-wow-orc": {
        "character": {"cls": "ba", "race": "Orc", "sex": "Male", "skin": 3, "hair": 3, "hair_colour": 7, "height": 1.06,
                      "dual_wield": True},
    },
    "ai-wow-draenei": {
        "character": {"cls": "ai", "race": "Draenei", "sex": "Female", "skin": 0, "hair": 6, "hair_colour": 6, "height": 1.05,
                      "dual_wield": True},
        # Her swings are fast enough that 30 Hz sampling lets the tip of a long weapon drift.
        "sample_hz": 60.0,
    },
}


def character_spec(data: wow_mpq.WowData, race: str, sex: str, skin: int, hair: int, hair_colour: int,
                   height: float = 1.0, dual_wield: bool = False, cls: str = "") -> dict:
    """Skin description of a playable race, looked up in `CharSections` / `CharHairGeosets`."""
    race_id, sex_id = RACE_IDS[race], (0 if sex == "Male" else 1)
    sections, text = wow_dbc.parse_dbc(data.read("DBFilesClient\\CharSections.dbc"))
    hair_rows, _ = wow_dbc.parse_dbc(data.read("DBFilesClient\\CharHairGeosets.dbc"))

    def section(kind: int, variation: int, colour: int) -> List[str]:
        for r in sections:
            if r[1] == race_id and r[2] == sex_id and r[3] == kind and r[8] == variation and r[9] == colour:
                return [text(r[4]), text(r[5]), text(r[6])]
        raise SystemExit(f"{race} {sex}: no CharSections row kind={kind} variation={variation} colour={colour}")

    # Hair styles in creation order (bald "styles" excluded): (variation, geoset id).
    styles = sorted((r[3], r[4]) for r in hair_rows if r[1] == race_id and r[2] == sex_id and r[5] == 0 and r[4] > 0)
    if not 0 <= hair < len(styles):
        raise SystemExit(f"{race} {sex}: hair style {hair} outside 0..{len(styles) - 1}")
    variation, hair_geoset = styles[hair]
    body, face, underwear = section(0, 0, skin), section(1, 0, skin), section(4, 0, skin)
    hair_tex = section(3, variation, hair_colour)
    layers = [(body[0], None), (face[0], "FL")]
    for name, region in ((face[1], "FU"), (underwear[0], "LU"), (underwear[1], "TU")):
        if name:
            layers.append((name, region))
    # Scalp textures under the hair: some rows name files the client does not ship; those are skipped.
    for name, region in ((hair_tex[1], "FL"), (hair_tex[2], "FU")):
        if name and data.has(name):
            layers.append((name, region))
    for name, _region in layers + [(hair_tex[0], None)]:
        if not data.has(name):
            raise SystemExit(f"{race} {sex}: texture {name} is missing")
    base = f"Character\\{race}\\{sex}\\{race}{sex}"
    model = load_model(data, base)
    present = {sm.geoset_id for sm in model.submeshes}
    model_height = float(model.positions[:, 2].max()) * MODEL_SCALE
    return {
        "model": base,
        "px": round(CHARACTER_HEIGHT_PX * height / model_height, 3),
        "skin": layers,
        "sex": "M" if sex == "Male" else "F",
        "hair_geoset": hair_geoset,
        "hair_texture": hair_tex[0],
        # Body, default facial-feature pieces and ears, as far as this race has them.
        "base_geosets": [0] + [g for g in (101, 201, 301, 702) if g in present],
        "slots": {"armor": _armor_slot(), "helm": _helm_slot(RACE_CODES[race] + ("M" if sex == "Male" else "F")),
                  "weapon": _weapon_slot(dual_wield), "offhand": _offhand_slot(dual_wield)},
        "pack_weapons": _pack_weapons_in_reach(cls, dual_wield),
        "dual_wield": dual_wield,
        "default_geosets": [g for g in (401, 501, 1301) if g in present],
        "clips": HERO_CLIPS,
    }


def build_creature(data: wow_mpq.WowData, cdef: dict) -> "BuiltSkin":
    """A creature model with one fixed look (`textures`: texture type -> file) and the morph clips."""
    out = BuiltSkin()
    m = load_model(data, cdef["model"])
    out.m2 = m
    unit = out.unit
    for i, bone in enumerate(m.bones):
        if bone.parent >= i:
            raise SystemExit(f"{m.name}: bone {i} precedes its parent")
        unit.add_node(f"bone{i}", bone.parent, bone.pivot * MODEL_SCALE)
    images = {tex_type: unit.add_image(load_texture(data, name)) for tex_type, name in cdef["textures"].items()}
    for si, sm in enumerate(m.submeshes):
        if sm.n_triangles == 0:
            continue
        layers = []
        for tu in sorted((tu for tu in m.tex_units if tu.submesh == si), key=lambda tu: tu.layer):
            tex = m.textures[tu.texture] if 0 <= tu.texture < len(m.textures) else None
            if tex is None:
                continue
            if tex.type in images:
                image = images[tex.type]
            elif tex.type == 0 and tex.filename and data.has(tex.filename):
                image = unit.add_image(load_texture(data, tex.filename))
            else:
                raise SystemExit(f"{m.name}: no texture given for texture type {tex.type}")
            layers.append(glb.Layer(filter_mode(tu.blend), bool(tu.render_flags & 0x1), image))
        if not layers:
            continue
        verts, tris = submesh_arrays(m, sm)
        unit.geosets.append(glb.Geoset(
            m.positions[verts] * MODEL_SCALE, m.normals[verts], m.uvs[verts],
            m.bone_indices[verts], m.bone_weights[verts], tris, layers))
        out.sources.append((m, verts, None, np.zeros(3), 1.0))
    if not unit.geosets:
        raise SystemExit(f"{m.name}: nothing to draw")
    add_clips(out, MORPH_CLIPS)
    return out


# ============================================================================
# Loading
# ============================================================================

def load_model(data: wow_mpq.WowData, base: str) -> wow_m2.M2Model:
    def read_anim(anim_id: int, sub_id: int) -> Optional[bytes]:
        name = "%s%04d-%02d.anim" % (base, anim_id, sub_id)
        return data.read(name) if data.has(name) else None

    return wow_m2.parse_m2(data.read(base + ".m2"), data.read(base + "00.skin"), read_anim)


def load_texture(data: wow_mpq.WowData, name: str) -> np.ndarray:
    return wow_blp.decode_blp(data.read(name))


def component_texture(data: wow_mpq.WowData, set_name: str, piece: str) -> Tuple[str, np.ndarray]:
    """`piece` is `<kind>_<region>`; female textures win over unisex ones."""
    kind, region = piece.split("_")
    for suffix in ("F", "U"):
        name = f"Item\\TextureComponents\\{REGION_DIRS[region]}\\{set_name}_{kind}_{region}_{suffix}.blp"
        if data.has(name):
            return region, load_texture(data, name)
    raise FileNotFoundError(f"component texture {set_name} {piece}")


def find_component_texture(data: wow_mpq.WowData, set_name: str, kind: str, region: str,
                           sex: str = "F") -> Optional[np.ndarray]:
    """Texture of one armour piece (the model's sex first, then unisex), or None when the set has no such piece."""
    for suffix in (sex, "U"):
        name = f"Item\\TextureComponents\\{REGION_DIRS[region]}\\{set_name}_{kind}_{region}_{suffix}.blp"
        if data.has(name):
            return load_texture(data, name)
    return None


def resize_rgba(img: np.ndarray, w: int, h: int) -> np.ndarray:
    if img.shape[1] == w and img.shape[0] == h:
        return img
    return np.asarray(Image.fromarray(img, "RGBA").resize((w, h), Image.LANCZOS))


def blend_over(dst: np.ndarray, src: np.ndarray, x: int, y: int) -> None:
    """Source-over composite of `src` onto the opaque canvas `dst` at (x, y)."""
    h, w = src.shape[:2]
    a = src[:, :, 3:4].astype(np.float32) / 255.0
    region = dst[y:y + h, x:x + w, :3].astype(np.float32)
    dst[y:y + h, x:x + w, :3] = np.clip(src[:, :, :3].astype(np.float32) * a + region * (1.0 - a) + 0.5, 0, 255).astype(np.uint8)
    dst[y:y + h, x:x + w, 3] = 255


# ============================================================================
# Model assembly
# ============================================================================

class BuiltSkin:
    def __init__(self) -> None:
        self.unit = glb.UnitModel()
        self.m2: wow_m2.M2Model
        # (source model, vertex index array into the source, joint override or None) per GLB geoset
        self.sources: List[Tuple[wow_m2.M2Model, np.ndarray, Optional[int], np.ndarray, float]] = []
        self.paperdoll: dict = {}
        self.clip_sequences: Dict[str, wow_m2.M2Sequence] = {}


def filter_mode(blend: int) -> int:
    # 0 opaque, 1 alpha key, 2 alpha blend, 3 no-alpha add, 4 add
    return {0: 0, 1: 1, 2: 2, 3: 3, 4: 4}.get(blend, 2)


def submesh_arrays(m: wow_m2.M2Model, sm: wow_m2.M2Submesh) -> Tuple[np.ndarray, np.ndarray]:
    """(global vertex indices, local triangle indices) of one sub-mesh."""
    verts = m.vertex_lookup[sm.start_vertex:sm.start_vertex + sm.n_vertices].astype(np.int64)
    tris = m.triangles[sm.start_triangle:sm.start_triangle + sm.n_triangles].astype(np.int64) - sm.start_vertex
    if len(tris) and (tris.min() < 0 or tris.max() >= sm.n_vertices):
        raise SystemExit(f"{m.name}: sub-mesh {sm.geoset_id} triangles leave its vertex range")
    return verts, tris


def add_clips(out: "BuiltSkin", clip_defs, sample_hz: float = SAMPLE_HZ) -> None:
    """Sample `(key, animation id or candidate ids, loop, ground speed in yards/s)` clips into `out`."""
    m, unit = out.m2, out.unit
    for key, anim_ids, loop, speed in clip_defs:
        candidates = [anim_ids] if isinstance(anim_ids, int) else list(anim_ids)
        seq = next((s for s in (m.find_sequence(a) for a in candidates) if s is not None), None)
        if seq is None:
            raise SystemExit(f"{m.name}: no animation of {candidates} for clip {key!r}")
        anim_id = seq.anim_id
        seq = m.resolve_alias(seq)
        if seq.length_ms <= 0:
            raise SystemExit(f"{m.name}: animation {anim_id} for clip {key!r} is empty")
        clip = glb.Clip(key, f"anim{anim_id}", float(seq.length_ms), loop, speed * MODEL_SCALE)
        n = max(2, int(round(seq.length_ms / 1000.0 * sample_hz)) + 1)
        times = [seq.length_ms * i / (n - 1) for i in range(n)]
        for bi, bone in enumerate(m.bones):
            animated = [
                bone.translation.global_seq < 0 and bone.translation.has_keys(seq.index),
                bone.rotation.global_seq < 0 and bone.rotation.has_keys(seq.index),
                bone.scale.global_seq < 0 and bone.scale.has_keys(seq.index),
            ]
            if not any(animated):
                continue
            samples = [wow_m2.bone_local(m, bone, seq.index, t) for t in times]
            rest = unit.rest_translation(bi)
            if animated[0]:
                clip.node[(bi, "translation")] = (times, [[float(v) for v in rest + s[0] * MODEL_SCALE] for s in samples], "LINEAR")
            if animated[1]:
                rot = [s[1].astype(np.float64) for s in samples]
                for i in range(1, len(rot)):
                    if float(np.dot(rot[i - 1], rot[i])) < 0:
                        rot[i] = -rot[i]
                clip.node[(bi, "rotation")] = (times, [[float(v) for v in r] for r in rot], "LINEAR")
            if animated[2]:
                clip.node[(bi, "scale")] = (times, [[float(v) for v in s[2]] for s in samples], "LINEAR")
        unit.clips.append(clip)
        out.clip_sequences[key] = seq


def build_skin(data: wow_mpq.WowData, spec: dict) -> BuiltSkin:
    out = BuiltSkin()
    m = load_model(data, spec["model"])
    out.m2 = m
    unit = out.unit
    for i, bone in enumerate(m.bones):
        if bone.parent >= i:
            raise SystemExit(f"{m.name}: bone {i} precedes its parent")
        unit.add_node(f"bone{i}", bone.parent, bone.pivot * MODEL_SCALE)

    # ---- body texture (the paper-doll canvas) ----------------------------------
    canvas: Optional[np.ndarray] = None
    for name, region in spec["skin"]:
        img = load_texture(data, name)
        if region is None:
            canvas = resize_rgba(img, 512, 512).copy()
            canvas[:, :, 3] = 255
        else:
            assert canvas is not None
            x, y, w, h = REGIONS[region]
            blend_over(canvas, resize_rgba(img, w, h), x, y)
    assert canvas is not None
    for kind, region in (("boot", "LL"), ("boot", "FO")):
        boots = find_component_texture(data, BOOTS_SET, kind, region, spec.get("sex", "F"))
        if boots is None:
            raise SystemExit(f"boots set {BOOTS_SET!r} has no {region} texture")
        x, y, w, h = REGIONS[region]
        blend_over(canvas, resize_rgba(boots, w, h), x, y)
    canvas_image = unit.add_image(canvas)
    hair_image = unit.add_image(load_texture(data, spec["hair_texture"]))

    # ---- character geosets -----------------------------------------------------
    wanted = set(spec["base_geosets"]) | set(spec["default_geosets"]) | {spec["hair_geoset"], 1}
    for options in spec["slots"].values():
        for opt in options.values():
            wanted |= set(opt.get("geosets", [])) | set(opt.get("hide", []))
    by_game_id: Dict[int, List[int]] = {}
    for si, sm in enumerate(m.submeshes):
        if sm.geoset_id not in wanted or sm.n_triangles == 0:
            continue
        units = sorted((tu for tu in m.tex_units if tu.submesh == si), key=lambda tu: tu.layer)
        layers = []
        for tu in units:
            tex = m.textures[tu.texture] if 0 <= tu.texture < len(m.textures) else None
            if tex is None or tex.type not in (1, 6):
                continue
            mode = filter_mode(tu.blend)
            layers.append(glb.Layer(mode, bool(tu.render_flags & 0x1), canvas_image if tex.type == 1 else hair_image))
        if not layers:
            continue
        verts, tris = submesh_arrays(m, sm)
        unit.geosets.append(glb.Geoset(
            m.positions[verts] * MODEL_SCALE, m.normals[verts], m.uvs[verts],
            m.bone_indices[verts], m.bone_weights[verts], tris, layers))
        out.sources.append((m, verts, None, np.zeros(3), 1.0))
        by_game_id.setdefault(sm.geoset_id, []).append(len(unit.geosets) - 1)

    def game_geosets(ids) -> List[int]:
        res: List[int] = []
        for gid in ids:
            if gid not in by_game_id:
                raise SystemExit(f"{m.name}: geoset {gid} not present")
            res += by_game_id[gid]
        return res

    hair = game_geosets([spec["hair_geoset"]])
    # Not every race has a separate bald scalp geoset; without one the head geoset already covers it.
    bald = game_geosets([1]) if 1 in by_game_id else []
    hidden = set(bald)
    for options in spec["slots"].values():
        for opt in options.values():
            hidden |= set(game_geosets(opt.get("geosets", [])))

    # Item textures are stored once however many options use them (both hands, shared models).
    item_images: Dict[str, int] = {}

    def item_image(name: str) -> int:
        key = name.lower()
        if key not in item_images:
            item_images[key] = unit.add_image(load_texture(data, name))
        return item_images[key]

    # ---- slots -------------------------------------------------------------------
    slots: Dict[str, Dict[str, dict]] = {}
    for slot, options in spec["slots"].items():
        slots[slot] = {}
        for name, opt in options.items():
            show = game_geosets(opt.get("geosets", []))
            hide = game_geosets(opt.get("hide", []))
            layers = []
            if "auto_set" in opt:
                # Every piece the set has (female texture first, then unisex). Robes keep their leg
                # textures on the skirt; other sets get the fixed boots over the trouser legs.
                for kind, region in ARMOR_PIECES + ([] if opt["robe"] else [("boot", "LL")]):
                    prefix = BOOTS_SET if kind == "boot" else opt["auto_set"]
                    found = find_component_texture(data, prefix, kind, region, spec.get("sex", "F"))
                    if found is None:
                        continue
                    x, y, w, h = REGIONS[region]
                    layers.append({"image": unit.add_image(resize_rgba(found, w, h)), "x": x, "y": y,
                                   "w": w, "h": h, "order": PIECE_ORDER[kind]})
                if not any(layer["x"] == REGIONS["TU"][0] and layer["y"] == REGIONS["TU"][1] for layer in layers):
                    raise SystemExit(f"armour set {opt['auto_set']!r} has no chest texture")
            for piece in opt.get("pieces", []):
                region, img = component_texture(data, opt["set"], piece)
                x, y, w, h = REGIONS[region]
                layers.append({"image": unit.add_image(resize_rgba(img, w, h)), "x": x, "y": y, "w": w, "h": h,
                               "order": PIECE_ORDER[piece.split("_")[0]]})
            if "object" in opt:
                item = load_model(data, opt["object"])
                att = m.attachment(opt["attach"])
                tex_image = item_image(opt["texture"])
                for si, sm in enumerate(item.submeshes):
                    units = sorted((tu for tu in item.tex_units if tu.submesh == si), key=lambda tu: tu.layer)
                    item_layers = []
                    for tu in units:
                        tex = item.textures[tu.texture] if 0 <= tu.texture < len(item.textures) else None
                        if tex is None:
                            continue
                        if tex.type == 2:
                            image = tex_image
                        elif tex.type == 0 and tex.filename and data.has(tex.filename):
                            image = item_image(tex.filename)
                        else:
                            continue
                        item_layers.append(glb.Layer(filter_mode(tu.blend), bool(tu.render_flags & 0x1), image))
                    if not item_layers or sm.n_triangles == 0:
                        continue
                    verts, tris = submesh_arrays(item, sm)
                    offset = att.position.astype(np.float64)
                    item_scale = float(opt.get("scale", 1.0))
                    normals = item.normals[verts]
                    if opt.get("mirror"):
                        # Mirror across the model's XZ plane; the winding flips with it.
                        item_scale = np.array([item_scale, -item_scale, item_scale])
                        normals = normals * np.array([1.0, -1.0, 1.0], dtype=normals.dtype)
                        tris = np.asarray(tris).reshape(-1, 3)[:, ::-1].reshape(-1)
                    joints = np.zeros((len(verts), 4), dtype=np.uint16)
                    joints[:, 0] = att.bone
                    weights = np.zeros((len(verts), 4), dtype=np.float32)
                    weights[:, 0] = 1.0
                    unit.geosets.append(glb.Geoset(
                        (item.positions[verts] * item_scale + offset) * MODEL_SCALE, normals,
                        item.uvs[verts], joints, weights, tris, item_layers))
                    out.sources.append((item, verts, att.bone, offset, item_scale))
                    show.append(len(unit.geosets) - 1)
                    hidden.add(len(unit.geosets) - 1)
                if opt.get("hide_hair"):
                    hide += hair
                    show += bald
            slots[slot][name] = {"show": sorted(set(show)), "hide": sorted(set(hide)), "layers": layers}
    # Where the runtime attaches a weapon of the shared pack: joint and offset (model units) per hand.
    hands = {}
    for hand, att_id in (("right", ATT_HAND_RIGHT), ("left", ATT_HAND_LEFT)):
        att = m.attachment(att_id)
        hands[hand] = {"joint": int(att.bone), "offset": [float(v) * MODEL_SCALE for v in att.position]}
    out.paperdoll = {
        "canvas": canvas_image,
        "hidden": sorted(hidden),
        "slots": slots,
        "defaults": {slot: "none" for slot in slots},
        "attachments": {"pack": WEAPON_PACK_ID, **hands},
    }
    # The pack's weapons are not in this model, but the impostor box must have room for them.
    for path, att_id, family, mirror in spec.get("pack_weapons", []):
        item = load_model(data, path)
        att = m.attachment(att_id)
        item_scale = _unique_scale(family, item)
        scale3 = np.array([item_scale, -item_scale if mirror else item_scale, item_scale])
        out.sources.append((item, np.arange(len(item.positions), dtype=np.int64), att.bone,
                            att.position.astype(np.float64), scale3))
    unit.extras = {"paperdoll": out.paperdoll}

    add_clips(out, list(spec["clips"]) + _stance_clips(), float(spec.get("sample_hz", SAMPLE_HZ)))
    return out


# ============================================================================
# Reference skinning, verification, box, preview
# ============================================================================

def reference_positions(built: BuiltSkin, geoset: int, seq_index: int, t_ms: float, mats=None) -> np.ndarray:
    """Positions of one GLB geoset skinned straight from the source models (scaled)."""
    m = built.m2
    if mats is None:
        mats = wow_m2.bone_matrices(m, seq_index, t_ms)
    src, verts, joint, offset, item_scale = built.sources[geoset]
    pos = src.positions[verts].astype(np.float64) * item_scale + offset
    homo = np.concatenate([pos, np.ones((len(pos), 1))], axis=1)
    if joint is not None:
        return (homo @ mats[joint].T)[:, :3] * MODEL_SCALE
    res = np.zeros((len(pos), 3))
    bi, bw = src.bone_indices[verts], src.bone_weights[verts].astype(np.float64)
    for k in range(4):
        res += bw[:, k:k + 1] * np.einsum("vij,vj->vi", mats[bi[:, k]], homo)[:, :3]
    return res * MODEL_SCALE


def verify(built: BuiltSkin, glb_path: str) -> float:
    gltf, blob = glb.read_glb(glb_path)
    prims = gltf["meshes"][0]["primitives"]
    first_prim = {}
    for pi, prim in enumerate(prims):
        first_prim.setdefault(prim["extras"]["geoset"], pi)
    worst = 0.0
    for key, seq in built.clip_sequences.items():
        for frac in (0.0, 0.21, 0.5, 0.77, 1.0):
            t = seq.length_ms * frac
            mats = wow_m2.bone_matrices(built.m2, seq.index, t)
            for gi, pi in first_prim.items():
                ref = reference_positions(built, gi, seq.index, t, mats)
                got = glb.glb_skinned_positions(gltf, blob, key, t, pi)
                worst = max(worst, float(np.abs(ref - got).max()))
    return worst


def compute_box(built: BuiltSkin, px: float) -> dict:
    reach, z_lo, z_hi = 1.0, 0.0, 1.0
    for seq in built.clip_sequences.values():
        for t in np.linspace(0.0, seq.length_ms, 9):
            mats = wow_m2.bone_matrices(built.m2, seq.index, float(t))
            # Every source: the model's own geosets and the shared pack's weapons it can hold.
            for gi in range(len(built.sources)):
                pts = reference_positions(built, gi, seq.index, float(t), mats)
                reach = max(reach, float(np.hypot(pts[:, 0], pts[:, 1]).max()))
                z_lo = min(z_lo, float(pts[:, 2].min()))
                z_hi = max(z_hi, float(pts[:, 2].max()))
    half_w = math.ceil(reach * px) + BOX_MARGIN_PX
    above = math.ceil((reach * SIN_PITCH + z_hi * COS_PITCH) * px) + BOX_MARGIN_PX
    below = math.ceil((reach * SIN_PITCH - z_lo * COS_PITCH) * px) + BOX_MARGIN_PX
    return {"width": int(half_w * 2), "height": int(above + below), "footX": int(half_w), "footY": int(above)}


def resolve_look(paperdoll: dict, n_geosets: int, images: List[np.ndarray], selection: Dict[str, str]):
    """Offline mirror of the runtime paper-doll resolution: (visible mask, composited canvas)."""
    visible = np.ones(n_geosets, dtype=bool)
    visible[paperdoll["hidden"]] = False
    layers = []
    chosen = [paperdoll["slots"][slot][selection.get(slot, paperdoll["defaults"][slot])] for slot in sorted(paperdoll["slots"])]
    for opt in chosen:
        visible[opt["hide"]] = False
    for opt in chosen:
        visible[opt["show"]] = True
        layers += opt["layers"]
    canvas = images[paperdoll["canvas"]].copy()
    for layer in sorted(layers, key=lambda l: l["order"]):
        blend_over(canvas, images[layer["image"]], layer["x"], layer["y"])
    return visible, canvas


def render(built: BuiltSkin, selection: Dict[str, str], clip_key: str, frac: float, yaw_deg: float,
           size: Tuple[int, int], zoom: float, center_z: float) -> np.ndarray:
    """Small software rasteriser used for the preview image and offline look sheets."""
    unit = built.unit
    visible, canvas = resolve_look(built.paperdoll, len(unit.geosets), unit.images, selection)
    seq = built.clip_sequences[clip_key]
    mats = wow_m2.bone_matrices(built.m2, seq.index, seq.length_ms * frac)
    w, h = size
    color = np.zeros((h, w, 4), dtype=np.float32)
    depth = np.full((h, w), -1e9, dtype=np.float32)
    yaw = math.radians(yaw_deg)
    cy, sy = math.cos(yaw), math.sin(yaw)
    light = np.array([0.35, -0.45, 0.82])
    for gi, geo in enumerate(unit.geosets):
        if not visible[gi]:
            continue
        p = reference_positions(built, gi, seq.index, 0.0, mats)
        # rotate about Z, then view from +X with a slight downward pitch
        x = p[:, 0] * cy - p[:, 1] * sy
        y = p[:, 0] * sy + p[:, 1] * cy
        z = p[:, 2]
        sx = w / 2 + y * zoom
        szv = h / 2 - ((z - center_z) * 0.966 - x * 0.259) * zoom
        d = x * 0.966 + (z - center_z) * 0.259
        layer = geo.layers[0]
        tex = canvas if layer.image == built.paperdoll["canvas"] else unit.images[layer.image]
        th, tw = tex.shape[:2]
        tris = np.asarray(geo.indices).reshape(-1, 3)
        for a, b, c in tris:
            xs = np.array([sx[a], sx[b], sx[c]])
            ys = np.array([szv[a], szv[b], szv[c]])
            x0, x1 = int(max(0, math.floor(xs.min()))), int(min(w - 1, math.ceil(xs.max())))
            y0, y1 = int(max(0, math.floor(ys.min()))), int(min(h - 1, math.ceil(ys.max())))
            if x0 > x1 or y0 > y1:
                continue
            den = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
            if abs(den) < 1e-9:
                continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            l0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / den
            l1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / den
            l2 = 1.0 - l0 - l1
            inside = (l0 >= 0) & (l1 >= 0) & (l2 >= 0)
            if not inside.any():
                continue
            dd = l0 * d[a] + l1 * d[b] + l2 * d[c]
            uv = l0[..., None] * geo.uvs[a] + l1[..., None] * geo.uvs[b] + l2[..., None] * geo.uvs[c]
            tx = np.clip((uv[..., 0] % 1.0) * tw, 0, tw - 1).astype(np.int64)
            ty = np.clip((uv[..., 1] % 1.0) * th, 0, th - 1).astype(np.int64)
            texel = tex[ty, tx].astype(np.float32) / 255.0
            nrm = np.cross(p[b] - p[a], p[c] - p[a])
            nl = np.linalg.norm(nrm)
            shade = 1.0 if layer.unshaded or nl < 1e-9 else min(1.2, 0.55 + 0.6 * abs(float(np.dot(nrm / nl, light))))
            sub_d = depth[y0:y1 + 1, x0:x1 + 1]
            sub_c = color[y0:y1 + 1, x0:x1 + 1]
            ok = inside & (dd > sub_d)
            if layer.filter_mode == 1:
                ok &= texel[..., 3] >= 0.65
            elif layer.filter_mode >= 2:
                ok &= texel[..., 3] > 0.05
            sub_d[ok] = dd[ok]
            sub_c[ok, :3] = np.clip(texel[ok, :3] * shade, 0, 1)
            sub_c[ok, 3] = 1.0
    return (color * 255.0 + 0.5).astype(np.uint8)


# ============================================================================
# Entry point
# ============================================================================

def convert(wow_dir: str, out_dir: str, do_verify: bool, skin: str, sheet: Optional[str]) -> None:
    spec = SKINS[skin]
    os.makedirs(out_dir, exist_ok=True)
    data = wow_mpq.WowData(wow_dir)
    if "character" in spec:
        spec = {**character_spec(data, **spec["character"]), **{k: v for k, v in spec.items() if k != "character"}}
    built = build_skin(data, spec)
    glb_path = os.path.join(out_dir, "hero.glb")
    glb.write_glb(built.unit, glb_path)
    px = spec["px"]
    msg = (f"[convert_wow_m2_to_glb] {skin}: {os.path.getsize(glb_path) / 1024:.0f} KB, "
           f"{len(built.unit.geosets)} geosets, {len(built.unit.images)} textures, {len(built.unit.clips)} clips")
    if do_verify:
        err = verify(built, glb_path)
        msg += f", max playback error {err:.4f} units"
        if err > 1.0:
            raise SystemExit(f"{skin}: GLB playback deviates from source skinning by {err:.4f} units")
    print(msg)

    showcase = {"armor": "quilted3", "weapon": "staff"}
    tall = float(built.m2.positions[:, 2].max()) * MODEL_SCALE
    preview = render(built, showcase, "nu", 0.0, 25.0, (256, 256), 256 / (tall * 0.4536), tall * 0.763)
    with open(os.path.join(out_dir, "preview.png"), "wb") as f:
        f.write(glb.png_bytes(np.asarray(Image.fromarray(preview, "RGBA").resize((128, 128), Image.LANCZOS))))
    with open(os.path.join(out_dir, "portrait-hero.png"), "wb") as f:
        f.write(glb.png_bytes(np.asarray(Image.fromarray(preview, "RGBA").resize((92, 92), Image.LANCZOS))[5:87]))

    units = {"hero": {
        "glb": "hero.glb",
        "portrait": "portrait-hero.png",
        "pxPerUnit": px,
        "box": compute_box(built, px),
        "clips": {c.name: {"durationMs": round(c.duration_ms, 2), "loop": c.loop, "source": c.source,
                           "moveSpeed": round(c.move_speed, 2)} for c in built.unit.clips},
        "aliases": _weapon_clip_aliases(bool(spec.get("dual_wield"))),
    }}
    morphs = {}
    for token, cdef in (spec.get("morphs") or {}).items():
        creature = build_creature(data, cdef)
        name = f"morph-{token}.glb"
        path = os.path.join(out_dir, name)
        glb.write_glb(creature.unit, path)
        creature_px = round(cdef["height_px"] / (float(creature.m2.positions[:, 2].max()) * MODEL_SCALE), 3)
        msg = (f"[convert_wow_m2_to_glb] {skin} morph {token}: {os.path.getsize(path) / 1024:.0f} KB, "
               f"{len(creature.unit.geosets)} geosets, {len(creature.unit.clips)} clips")
        if do_verify:
            err = verify(creature, path)
            msg += f", max playback error {err:.4f} units"
            if err > 1.0:
                raise SystemExit(f"{skin} morph {token}: GLB playback deviates from source skinning by {err:.4f} units")
        print(msg)
        morphs[token] = {
            "glb": name,
            "pxPerUnit": creature_px,
            "box": compute_box(creature, creature_px),
            "clips": {c.name: {"durationMs": round(c.duration_ms, 2), "loop": c.loop, "source": c.source,
                               "moveSpeed": round(c.move_speed, 2)} for c in creature.unit.clips},
        }
    with open(os.path.join(out_dir, "units.json"), "w", encoding="utf-8") as f:
        json.dump({"preview": "preview.png", "units": units, "morphs": morphs}, f, indent=1)

    if sheet:
        looks = [
            {}, {"armor": "quilted1"}, {"armor": "leather1", "helm": "cap"}, {"armor": "ring1", "helm": "helm"},
            {"armor": "gothic3", "helm": "greathelm", "weapon": "sword", "offhand": "kite"},
            {"armor": "quilted2", "helm": "circlet", "weapon": "staff"}, {"armor": "plate2", "helm": "crown"},
            {"armor": "studded2", "helm": "mask", "weapon": "bow"},
        ]
        if spec.get("dual_wield"):
            looks[5] = {"armor": "leather2", "weapon": "claw", "offhand": OFFHAND_WEAPON_PREFIX + "claw"}
            looks[6] = {"armor": "plate2", "helm": "barbarian", "weapon": ONE_HANDED_GREATSWORD,
                        "offhand": OFFHAND_WEAPON_PREFIX + "axe"}
        cw, ch = 220, 300
        img = np.zeros((ch * 2, cw * len(looks), 4), dtype=np.uint8)
        img[:, :, :3] = 28
        img[:, :, 3] = 255
        for i, look in enumerate(looks):
            for row, yaw in enumerate((25.0, 205.0)):
                cell = render(built, look, "nu", 0.0, yaw, (cw, ch), ch / (tall * 1.29), tall * 0.536)
                a = cell[:, :, 3:4].astype(np.float32) / 255.0
                dst = img[row * ch:(row + 1) * ch, i * cw:(i + 1) * cw, :3]
                dst[:] = (cell[:, :, :3] * a + dst * (1 - a)).astype(np.uint8)
        poses = [
            ({"armor": "quilted1", "weapon": "staff"}, "nu:2h", 0.3), ({"armor": "quilted1", "weapon": "staff"}, "a1:2h", 0.45),
            ({"armor": "quilted1", "weapon": "staff"}, "sc", 0.5), ({"armor": "quilted1", "weapon": "staff"}, "rn", 0.3),
            ({"armor": "ring1", "weapon": "bow"}, "nu:bow", 0.3),
            ({"armor": "scale1", "weapon": "spear", "offhand": "kite"}, "a1:2hl", 0.45),
            ({"armor": "breast1", "weapon": "orb", "offhand": "kite"}, "bl", 0.5), ({"armor": "plate1"}, "dt", 1.0),
        ]
        pose_img = np.zeros((ch, cw * len(poses), 4), dtype=np.uint8)
        pose_img[:, :, :3] = 28
        pose_img[:, :, 3] = 255
        for i, (look, key, frac) in enumerate(poses):
            cell = render(built, look, key, frac, 25.0, (cw, ch), ch / (tall * 1.29), tall * 0.536)
            a = cell[:, :, 3:4].astype(np.float32) / 255.0
            dst = pose_img[:, i * cw:(i + 1) * cw, :3]
            dst[:] = (cell[:, :, :3] * a + dst * (1 - a)).astype(np.uint8)
        img = np.concatenate([img, pose_img], axis=0)
        Image.fromarray(img, "RGBA").save(sheet)
        print(f"[convert_wow_m2_to_glb] look sheet -> {sheet}")


def convert_weapon_pack(wow_dir: str, out_dir: str, do_verify: bool) -> None:
    """One GLB per `UNIQUE_WEAPONS` entry (weapon-local model units, a single joint) plus `weapons.json`."""
    os.makedirs(out_dir, exist_ok=True)
    data = wow_mpq.WowData(wow_dir)
    index = {}
    total = 0
    for uid, (model, texture, family, _only) in sorted(UNIQUE_WEAPONS.items()):
        item = load_model(data, _WEAPON_DIR + model)
        scale = _unique_scale(family, item) * MODEL_SCALE
        unit = glb.UnitModel()
        unit.add_node("weapon", -1, np.zeros(3))
        images: Dict[str, int] = {}

        def image(name: str) -> int:
            if name.lower() not in images:
                images[name.lower()] = unit.add_image(load_texture(data, name))
            return images[name.lower()]

        expected = []
        for si, sm in enumerate(item.submeshes):
            layers = []
            for tu in sorted((tu for tu in item.tex_units if tu.submesh == si), key=lambda tu: tu.layer):
                tex = item.textures[tu.texture] if 0 <= tu.texture < len(item.textures) else None
                if tex is None:
                    continue
                if tex.type == 2:
                    img = image(_WEAPON_DIR + texture + ".blp")
                elif tex.type == 0 and tex.filename and data.has(tex.filename):
                    img = image(tex.filename)
                else:
                    continue
                layers.append(glb.Layer(filter_mode(tu.blend), bool(tu.render_flags & 0x1), img))
            if not layers or sm.n_triangles == 0:
                continue
            verts, tris = submesh_arrays(item, sm)
            joints = np.zeros((len(verts), 4), dtype=np.uint16)
            weights = np.zeros((len(verts), 4), dtype=np.float32)
            weights[:, 0] = 1.0
            unit.geosets.append(glb.Geoset(item.positions[verts] * scale, item.normals[verts], item.uvs[verts],
                                           joints, weights, tris, layers))
            expected.append(item.positions[verts].astype(np.float64) * scale)
        if not unit.geosets:
            raise SystemExit(f"unique weapon {uid} ({model}): nothing to draw")
        # The model format wants one animation; a weapon has a single still pose.
        unit.clips.append(glb.Clip("nu", "still", 1000.0, True, 0.0))
        name = f"u-{uid}.glb"
        path = os.path.join(out_dir, name)
        glb.write_glb(unit, path)
        if do_verify:
            gltf, blob = glb.read_glb(path)
            first_prim = {}
            for pi, prim in enumerate(gltf["meshes"][0]["primitives"]):
                first_prim.setdefault(prim["extras"]["geoset"], pi)
            for gi, pi in first_prim.items():
                err = float(np.abs(glb.glb_skinned_positions(gltf, blob, "nu", 0.0, pi) - expected[gi]).max())
                if err > 1e-3:
                    raise SystemExit(f"unique weapon {uid}: GLB deviates from the source by {err:.4f} units")
        total += os.path.getsize(path)
        index[str(uid)] = {"glb": name, "hand": "left" if WEAPONS[family][3] == ATT_HAND_LEFT else "right"}
    with open(os.path.join(out_dir, "weapons.json"), "w", encoding="utf-8") as f:
        json.dump({"pack": WEAPON_PACK_ID, "weapons": index}, f, indent=1)
    print(f"[convert_wow_m2_to_glb] {WEAPON_PACK_ID}: {len(index)} weapons, {total / 1024:.0f} KB"
          + (", verified" if do_verify else ""))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--wow-dir", default=os.environ.get(
        "WOW_335_DIR", os.path.join(os.path.expanduser("~"), "d2-data", "wow-335")))
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--verify", action="store_true")
    ap.add_argument("--skin", default="so-wow-human-mage", choices=sorted(SKINS))
    ap.add_argument("--sheet", help="also write an offline look sheet PNG (debugging aid)")
    ap.add_argument("--weapon-pack", action="store_true",
                    help="write the shared unique weapon pack instead of a character skin")
    args = ap.parse_args()
    if args.weapon_pack:
        convert_weapon_pack(args.wow_dir, args.out_dir, args.verify)
        return
    convert(args.wow_dir, args.out_dir, args.verify, args.skin, args.sheet)


if __name__ == "__main__":
    main()
