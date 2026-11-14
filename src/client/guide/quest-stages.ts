export type FindKey = number | string
export type Find = FindKey | readonly FindKey[]

export interface Stage {
  readonly level: number | 'town' | 'tomb'
  readonly hint: string
  readonly find: readonly Find[]
  readonly unless?: readonly string[]
  readonly bring?: string
}

export interface Objective {
  readonly row: number
  readonly name: string
  readonly start?: string
  readonly required?: true
}

const at = (level: number | 'town' | 'tomb', hint: string, ...find: Find[]): Stage => ({ level, hint, find })
const ORIFICE = 152
const TO_THE_TOMB: Stage = { ...at('tomb', "Take the Staff to Tal Rasha's Tomb", ORIFICE), bring: 'hst' }
const talk = (name: string, npc: string, hint = `Talk to ${name}`): Stage => at('town', hint, npc)
const SEALS: Find = [392, 393, 394, 395, 396]

export const OBJECTIVES: readonly (readonly Objective[])[] = [
  [
    { row: 1, name: 'Den of Evil', start: 'qstsa1q11' },
    { row: 2, name: "Sisters' Burial Grounds", start: 'qstsa1q21' },
    { row: 4, name: 'The Search for Cain', start: 'start:a1q4' },
    { row: 5, name: 'The Forgotten Tower', start: 'qstsa1q51' },
    { row: 3, name: 'Tools of the Trade', start: 'qstsa1q31' },
    { row: 6, name: 'Sisters to the Slaughter', start: 'qstsa1q61', required: true },
  ],
  [
    { row: 9, name: "Radament's Lair", start: 'qstsa2q11' },
    { row: 10, name: 'The Horadric Staff', start: 'qstsa2q22', required: true },
    { row: 11, name: 'The Tainted Sun', start: 'qstsa2q32', required: true },
    { row: 12, name: 'Arcane Sanctuary', start: 'qstsa2q41a', required: true },
    { row: 13, name: 'The Summoner', start: 'qstsa2q51', required: true },
    { row: 14, name: 'The Seven Tombs', start: 'qstsa2q61', required: true },
  ],
  [
    { row: 19, name: 'Blade of the Old Religion', start: 'qstsa3q31' },
    { row: 20, name: 'The Golden Bird' },
    { row: 17, name: "Lam Esen's Tome", start: 'qstsa3q11' },
    { row: 18, name: "Khalim's Will", start: 'qstsa3q21a', required: true },
    { row: 21, name: 'The Blackened Temple', start: 'qstsa3q51', required: true },
    { row: 22, name: 'The Guardian', start: 'qstsa3q61', required: true },
  ],
  [
    { row: 25, name: 'The Fallen Angel', start: 'qstsa4q11' },
    { row: 27, name: "Hell's Forge", start: 'start:a4q3' },
    { row: 26, name: "Terror's End", start: 'qstsa4q21', required: true },
  ],
  [
    { row: 35, name: 'Siege on Harrogath', start: 'qsta5q11' },
    { row: 36, name: 'Rescue on Mount Arreat', start: 'qstsa5q21' },
    { row: 37, name: 'Prison of Ice', start: 'qstsa5q31' },
    { row: 38, name: 'Betrayal of Harrogath' },
    { row: 39, name: 'Rite of Passage', start: 'qstsa5q51', required: true },
    { row: 40, name: 'Eve of Destruction', start: 'qstsa5q61a', required: true },
  ],
]

const SINGLE: Readonly<Record<string, Stage>> = {
  qstsa1q11: at(8, 'Find the Den of Evil'),
  qstsa1q12: at(8, 'Kill every monster in the Den'),
  qstsa1q13: at(8, 'Kill every monster in the Den'),
  qstsa1q14: at(8, '{n} monsters left in the Den'),
  qstsa1q15: talk('Akara', 'akara'),
  qstsa1q21: at(17, 'Find Blood Raven', 'bloodraven'),
  qstsa1q22: at(17, 'Kill Blood Raven', 'bloodraven'),
  qstsa1q23: talk('Kashya', 'kashya'),
  qstsa1q31: at(28, 'Take the Horadric Malus', 108),
  qstsa1q32: talk('Charsi', 'charsi', 'Bring the Malus to Charsi'),
  qstsa1q32b: talk('Charsi', 'charsi', 'Charsi will imbue an item'),
  'start:a1q4': talk('Akara', 'akara'),
  qstsa1q41: at(5, 'Click the Tree of Inifuss', 30),
  qstsa1q42: talk('Akara', 'akara', 'Bring the scroll to Akara'),
  qstsa1q43: at(38, "Find Cain's cage in Tristram", 26),
  qstsa1q44: at(38, "Open Cain's cage", 26),
  qstsa1q45: talk('Cain', 'cain1'),
  qstsa1q46: talk('Akara', 'akara'),
  qstsa1q46b: talk('Akara', 'akara'),
  qstsa1q51: at(25, 'Find the Forgotten Tower in the Black Marsh'),
  qstsa1q51a: at(25, 'Go down to the bottom cellar'),
  qstsa1q51b: at(25, 'Go down to the bottom cellar'),
  qstsa1q52: at(25, 'Kill the Countess'),
  qstsa1q61: at(37, "Find Andariel's lair"),
  qstsa1q62: at(37, 'Kill Andariel', 'andariel'),
  qstsa1q62b: at(40, 'Talk to Warriv to head east'),
  qstsa1q63: at(40, 'Talk to Warriv to head east'),
  qstsa2q11: at(49, "Find Radament's lair in the sewers"),
  qstsa2q12: at(49, 'Kill Radament', 'radament'),
  qstsa2q13: talk('Atma', 'atma'),
  qstsa2q21: talk('Cain', 'cain2', 'Show the scroll to Cain'),
  qstsa2q25: talk('Cain', 'cain2', 'Show the artifacts to Cain'),
  qstsa2q24: TO_THE_TOMB,
  qstsa2q31a: talk('Drognan', 'drognan'),
  qstsa2q32: at(61, 'Destroy the Serpent Altar', 149),
  qstsa2q33: talk('Drognan', 'drognan'),
  qstsa2q41a: talk('Drognan', 'drognan'),
  qstsa2q41: at(74, 'Find the portal in the Palace Cellar'),
  qstsa2q42: at(74, "Read Horazon's Journal", 357, 'summoner'),
  qstsa2q43: { ...at('tomb', 'Find the true tomb in the Canyon', ORIFICE), bring: 'hst' },
  qstsa2q51: at(74, 'Find the Summoner', 'summoner'),
  qstsa2q52: at(74, 'Kill the Summoner', 'summoner'),
  qstsa2q53: at('town', 'Return to town'),
  qstsa2q61: at(73, "Find Tal Rasha's true tomb"),
  qstsa2q61a: at(73, "Find Tal Rasha's true tomb"),
  qstsa2q62: at(73, 'Kill Duriel', 'duriel'),
  qstsa2q63f: at(73, "Talk to Tyrael", 'tyrael1'),
  qstsa2q63a: talk('Jerhyn', 'jerhyn'),
  qstsa2q64: talk('Jerhyn', 'jerhyn'),
  qstsa2q65: at(75, 'Talk to Meshif to sail east'),
  qstsa3q11: at(80, 'Search the Kurast temples for the Tome', 193),
  qstsa3q12: talk('Alkor', 'alkor'),
  qstsa3q21a: talk('Cain', 'cain3', "Ask Cain about Khalim's relics"),
  qstsa3q21: at(85, "Find Khalim's Eye in the Spider Cavern"),
  qstsa3q22: at(91, "Find Khalim's Brain in the Flayer Dungeon"),
  qstsa3q23: at(83, "Take Khalim's Flail from the High Council"),
  qstsa3q24: at(93, "Find Khalim's Heart in the sewers"),
  qstsa3q25: at('town', "Combine Khalim's relics in the Cube"),
  qstsa3q26: at(83, 'Smash the Compelling Orb', 404),
  qstsa3q31a: talk('Ormus', 'ormus', 'Ask around the docks about the Gidbinn'),
  qstsa3q31: at(78, 'Find the Gidbinn altar', 252),
  qstsa3q32: at(78, 'Pick up the Gidbinn', 252),
  qstsa3q33: talk('Ormus', 'ormus', 'Bring the Gidbinn to Ormus'),
  qstsa3q34: talk('Asheara', 'asheara'),
  qstsa3q35: talk('Ormus', 'ormus'),
  qstsa3q41: talk('Cain', 'cain3', 'Ask Cain about the Jade Figurine'),
  qstsa3q42: talk('Meshif', 'meshif2', 'Show Meshif the Figurine'),
  qstsa3q43: talk('Cain', 'cain3', 'Ask Cain about the Golden Bird'),
  qstsa3q44: talk('Alkor', 'alkor', 'Give the Golden Bird to Alkor'),
  qstsa3q45: talk('Alkor', 'alkor'),
  qstsa3q51a: talk('Ormus', 'ormus'),
  qstsa3q51: at(83, 'Find the Blackened Temple'),
  qstsa3q52: at(83, 'Kill the High Council'),
  qstsa3q53: talk('Cain', 'cain3'),
  qstsa3q61a: talk('Ormus', 'ormus'),
  qstsa3q61: at(83, 'Smash the Compelling Orb', 404),
  qstsa3q62: at(102, 'Find Mephisto', 'mephisto'),
  qstsa3q63: at(102, 'Kill Mephisto', 'mephisto'),
  qstsa4q11: at(105, 'Find Izual', 'izual'),
  qstsa4q12: at(105, 'Kill Izual', 'izual'),
  qstsa4q13a: at(105, "Talk to Izual's spirit", 'izualghost'),
  qstsa4q13: talk('Tyrael', 'tyrael2'),
  'start:a4q3': talk('Cain', 'cain4'),
  qstsa4q31: at(107, 'Take the Soulstone to the Hellforge', 376),
  qstsa4q32: at(107, 'Smash the Soulstone at the Hellforge', 376),
  qstsa4q33: at(107, 'Use the Hellforge Hammer on the forge', 376),
  qstsa4q21: at(108, 'Find Diablo in the Chaos Sanctuary', SEALS),
  qstsa4q22: at(108, 'Open the five seals and kill Diablo', SEALS, 'diablo'),
  qsta5q11: at(110, 'Kill Shenk the Overseer'),
  qsta5q12: at(110, 'Kill Shenk the Overseer'),
  qsta5q13: talk('Larzuk', 'larzuk'),
  qsta5q14: talk('Larzuk', 'larzuk', 'Larzuk will socket an item'),
  qstsa5q21: at(111, 'Find the captured soldiers', 473),
  qstsa5q21a: at(111, 'Free the soldiers', 473),
  qstsa5q22: at(111, 'Free {n} more soldiers', 473),
  qstsa5q23: talk('Qual-Kehk', 'qual-kehk'),
  qstsa5q31: at(114, 'Find Anya in the Frozen River', 558),
  qstsa5q31a: at(114, 'Free Anya', 558),
  qstsa5q32: talk('Malah', 'malah'),
  qstsa5q33: at(114, "Thaw Anya with Malah's potion", 558),
  qstsa5q34: talk('Malah', 'malah'),
  qstsa5q35: talk('Anya', 'drehya'),
  qstsa5q41: at(121, "Take Anya's portal to Nihlathak"),
  qstsa5q42a: at(124, 'Find Nihlathak in the Halls of Vaught', 'nihlathakboss'),
  qstsa5q42: at(124, 'Kill Nihlathak', 'nihlathakboss'),
  qstsa5q43: talk('Anya', 'drehya'),
  qstsa5q43a: talk('Anya', 'drehya', 'Anya will personalize an item'),
  qstsa5q51: at(120, 'Climb to the Arreat Summit', 546),
  qstsa5q52: at(120, 'Touch the Altar of the Heavens', 546),
  qstsa5q53: at(120, 'Defeat the three Ancients'),
  qstsa5q61a: at(131, "Find Baal's Throne Room"),
  qstsa5q62b: at(131, "Kill Baal's minions"),
  qstsa5q62: at(132, 'Kill Baal'),
  qstsa5q63: at(132, 'Talk to Tyrael', 'tyrael3'),
  qstsa5q64: at(132, "Take Tyrael's portal to safety"),
}

export const STAGES: Readonly<Record<string, readonly Stage[]>> = {
  ...Object.fromEntries(Object.entries(SINGLE).map(([key, stage]) => [key, [stage]])),
  qstsa2q22: [
    { ...at(60, 'Open the chest with the Horadric Cube in the Halls of the Dead', 354), unless: ['box'] },
    { ...at(64, 'Open the chest with the Staff of Kings in the Maggot Lair', 356), unless: ['msf', 'hst'] },
    { ...at(61, 'Take the Viper Amulet from the altar in the Claw Viper Temple', 149), unless: ['vip', 'hst'] },
    { ...at('town', 'Combine the Staff and Amulet in the Cube'), unless: ['hst'] },
    TO_THE_TOMB,
  ],
  qstsa2q23: [{ ...at('town', 'Combine the Staff and Amulet in the Cube'), unless: ['hst'] }, TO_THE_TOMB],
}
