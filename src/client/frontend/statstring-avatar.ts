/**
 * Diablo II: Lord of Destruction v1.13c — MCP `0x19` (`MCP_CHARLIST2`) Statstring
 * Composite Avatar Parser & `TN` Mode Layer Descriptor (`D2Launch.dll` `0x6fa4a440`,
 * `D2Multi.dll` `0x6f9d2940`, `Composit.txt`, `Colors.txt`).
 *
 * Re-exports canonical 1.13c avatar statstring tables and parser from `src/common/units/char-appearance.ts`
 * alongside the `TN` (Town Neutral) COF draw layer order lookup (`TN_COF_LAYER_ORDERS`).
 */

import {
  AVATAR_COMPONENT_NAMES,
  D2WIN_COMPONENT_TABLE,
  D2_COLORS_TXT_PALETTE,
  parseMcpAvatarStatstring,
  type AvatarComponentLayerSpec,
  type AvatarComponentName,
  type D2WinComponentEntry,
  type ParsedMcpAvatarStatstring,
} from '../../common/units/char-appearance.ts'

export {
  AVATAR_COMPONENT_NAMES,
  D2WIN_COMPONENT_TABLE,
  D2_COLORS_TXT_PALETTE,
  parseMcpAvatarStatstring,
  type AvatarComponentLayerSpec,
  type AvatarComponentName,
  type D2WinComponentEntry,
  type ParsedMcpAvatarStatstring,
}

/**
 * Exact 1.13c `TN` (Town Neutral) COF draw layer orders (`COF.pOrder` for direction 0)
 * extracted from `d2char.mpq` and `d2exp.mpq` (`data/global/chars/<class>/cof/<class>tn<wclass>.cof`).
 */
export const TN_COF_LAYER_ORDERS: Readonly<Record<string, readonly AvatarComponentName[]>> = {
  AMTN1HS: ['LG', 'TR', 'LA', 'S2', 'HD', 'RA', 'S1', 'SH', 'RH'],
  AMTN1HT: ['LG', 'TR', 'LA', 'S2', 'HD', 'RA', 'S1', 'SH', 'RH'],
  AMTN2HS: ['LG', 'TR', 'S2', 'LA', 'HD', 'RH', 'RA', 'S1'],
  AMTN2HT: ['LG', 'TR', 'LA', 'S2', 'HD', 'RH', 'RA', 'S1'],
  AMTNBOW: ['LH', 'LG', 'LA', 'RA', 'TR', 'S2', 'HD', 'S1'],
  AMTNHTH: ['LG', 'TR', 'LA', 'S2', 'HD', 'RA', 'S1', 'SH'],
  AMTNSTF: ['LG', 'TR', 'LA', 'S2', 'HD', 'RH', 'RA', 'S1'],
  AMTNXBW: ['LG', 'LA', 'TR', 'S2', 'S1', 'HD', 'RH', 'RA'],
  SOTN1HS: ['LG', 'LA', 'RA', 'TR', 'HD', 'S1', 'S2', 'RH', 'SH'],
  SOTN1HT: ['LG', 'LA', 'RA', 'TR', 'HD', 'S1', 'S2', 'RH', 'SH'],
  SOTN2HS: ['LG', 'LA', 'TR', 'HD', 'S1', 'S2', 'RH', 'RA'],
  SOTN2HT: ['LG', 'LA', 'RA', 'TR', 'HD', 'S1', 'S2', 'RH'],
  SOTNBOW: ['LH', 'LG', 'LA', 'RA', 'TR', 'HD', 'S1', 'S2'],
  SOTNHTH: ['LG', 'LA', 'RA', 'TR', 'HD', 'S1', 'S2', 'SH'],
  SOTNSTF: ['LG', 'LA', 'RA', 'TR', 'HD', 'S1', 'S2', 'RH'],
  SOTNXBW: ['LG', 'LA', 'TR', 'S1', 'S2', 'HD', 'RH', 'RA'],
  NETN1HS: ['LG', 'TR', 'RA', 'S1', 'LA', 'S2', 'HD', 'RH', 'SH', 'S3'],
  NETN1HT: ['LG', 'TR', 'RA', 'S1', 'LA', 'S2', 'HD', 'RH', 'SH', 'S3'],
  NETN2HS: ['LG', 'TR', 'LA', 'S2', 'HD', 'S1', 'RH', 'RA'],
  NETN2HT: ['LG', 'TR', 'LA', 'S2', 'S1', 'HD', 'RH', 'RA'],
  NETNBOW: ['LH', 'LG', 'TR', 'LA', 'S2', 'HD', 'RA', 'S1'],
  NETNHTH: ['LG', 'TR', 'RA', 'S1', 'LA', 'S2', 'HD', 'SH', 'S3'],
  NETNSTF: ['LG', 'TR', 'LA', 'S2', 'S1', 'HD', 'RH', 'RA'],
  NETNXBW: ['LG', 'TR', 'LA', 'S2', 'S1', 'HD', 'RH', 'RA'],
  PATN1HS: ['LG', 'LA', 'TR', 'S2', 'HD', 'RA', 'S1', 'RH', 'SH'],
  PATN1HT: ['LG', 'LA', 'TR', 'S2', 'HD', 'RA', 'S1', 'RH', 'SH'],
  PATN2HS: ['LG', 'TR', 'S2', 'LA', 'HD', 'S1', 'RH', 'RA'],
  PATN2HT: ['LG', 'LA', 'TR', 'S2', 'HD', 'S1', 'RH', 'RA'],
  PATNBOW: ['LH', 'LG', 'LA', 'TR', 'S2', 'HD', 'S1', 'RA'],
  PATNHTH: ['LG', 'LA', 'TR', 'S2', 'HD', 'RA', 'S1', 'SH'],
  PATNSTF: ['LG', 'LA', 'TR', 'S2', 'HD', 'S1', 'RH', 'RA'],
  PATNXBW: ['LG', 'LA', 'TR', 'S2', 'S1', 'HD', 'RH', 'RA'],
  BATN1HS: ['LG', 'RA', 'TR', 'S1', 'LA', 'S2', 'HD', 'RH', 'SH'],
  BATN1HT: ['LG', 'RA', 'TR', 'S1', 'LA', 'S2', 'HD', 'RH', 'SH'],
  BATN1JS: ['LG', 'RA', 'TR', 'S1', 'LA', 'S2', 'HD', 'RH', 'LH'],
  BATN1JT: ['LG', 'RA', 'TR', 'S1', 'LA', 'S2', 'HD', 'RH', 'LH'],
  BATN1SS: ['LG', 'RA', 'TR', 'S1', 'LA', 'S2', 'HD', 'RH', 'LH'],
  BATN1ST: ['LG', 'RA', 'TR', 'S1', 'LA', 'S2', 'HD', 'RH', 'LH'],
  BATN2HS: ['LG', 'RA', 'TR', 'S1', 'LA', 'S2', 'HD', 'RH'],
  BATN2HT: ['LG', 'TR', 'LA', 'S1', 'S2', 'HD', 'RH', 'RA'],
  BATNBOW: ['LH', 'LG', 'RA', 'TR', 'S1', 'LA', 'S2', 'HD'],
  BATNHTH: ['LG', 'RA', 'TR', 'S1', 'LA', 'S2', 'HD', 'SH'],
  BATNSTF: ['LG', 'TR', 'LA', 'S1', 'S2', 'HD', 'RH', 'RA'],
  BATNXBW: ['LG', 'LA', 'TR', 'S2', 'S1', 'HD', 'RH', 'RA'],
  DZTN1HS: ['LG', 'LA', 'TR', 'S2', 'RA', 'S1', 'HD', 'RH', 'SH'],
  DZTN1HT: ['LG', 'LA', 'TR', 'S2', 'RA', 'S1', 'HD', 'RH', 'SH'],
  DZTN2HS: ['LG', 'LA', 'TR', 'S2', 'S1', 'HD', 'RH', 'RA'],
  DZTN2HT: ['LG', 'LA', 'TR', 'S2', 'S1', 'HD', 'RH', 'RA'],
  DZTNBOW: ['LH', 'LG', 'LA', 'TR', 'S2', 'RA', 'S1', 'HD'],
  DZTNHTH: ['LG', 'LA', 'TR', 'S2', 'RA', 'S1', 'HD', 'SH'],
  DZTNSTF: ['LG', 'LA', 'TR', 'S2', 'S1', 'HD', 'RH', 'RA'],
  DZTNXBW: ['LG', 'LA', 'TR', 'S2', 'S1', 'HD', 'RH', 'RA'],
  AITN1HS: ['LG', 'TR', 'LA', 'S2', 'HD', 'RA', 'S1', 'RH', 'SH'],
  AITN1HT: ['LG', 'TR', 'LA', 'S2', 'HD', 'RA', 'S1', 'RH', 'SH'],
  AITN2HS: ['LG', 'TR', 'S2', 'LA', 'HD', 'RH', 'RA', 'S1'],
  AITN2HT: ['LG', 'TR', 'LA', 'S2', 'HD', 'RH', 'RA', 'S1'],
  AITNBOW: ['LH', 'LG', 'LA', 'RA', 'TR', 'S2', 'HD', 'S1'],
  AITNHT1: ['LG', 'TR', 'LA', 'S2', 'HD', 'RA', 'S1', 'RH', 'SH'],
  AITNHT2: ['LG', 'TR', 'LA', 'S2', 'HD', 'RA', 'S1', 'LH', 'RH'],
  AITNHTH: ['LG', 'TR', 'LA', 'S2', 'HD', 'RA', 'S1', 'SH'],
  AITNSTF: ['LG', 'TR', 'LA', 'S2', 'HD', 'RH', 'RA', 'S1'],
  AITNXBW: ['LG', 'LA', 'TR', 'S2', 'S1', 'HD', 'RH', 'RA'],
}
