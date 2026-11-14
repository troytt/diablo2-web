export const REGISTRY_TABLES = ['Skills', 'SkillDesc', 'Missiles', 'States', 'ItemStatCost', 'CharStats', 'MonStats', 'MonStats2', 'Overlay', 'PetType', 'ElemTypes', 'HitClass', 'Events', 'SkillCalc', 'MissCalc'] as const

export const REGISTRY_FILES: ReadonlyMap<string, string> = new Map([
  ...REGISTRY_TABLES.map((table) => [`${table}.txt`, `data\\global\\excel\\${table}.txt`] as const),
  ['AnimData.d2', 'data\\global\\AnimData.d2'],
])

export const REGISTRY_PACK_DIR = 'packs/excel'

export const registryFileOf = (archivePath: string): string => archivePath.split('\\').at(-1) ?? archivePath
