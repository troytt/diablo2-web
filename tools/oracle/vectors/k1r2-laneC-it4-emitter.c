/*
 * k1r2-laneC-it4-emitter.c
 *
 * 32-bit MinGW executable that loads the real D2Common.dll v1.13c at its
 * preferred image base 0x6FD50000 under Wine and emits differential test
 * vectors (NDJSON) for Lane C Iteration 4:
 *   - B019 (10 functions in drlg-ver.ts) -> b019-vectors.ndjson
 *   - B022 (12 functions in out-place.ts) -> b022-vectors.ndjson
 *   - B025 (18 functions in path.ts)      -> b025-vectors.ndjson
 *
 * Build:
 *   i686-w64-mingw32-gcc-win32 -O2 -o k1r2-laneC-it4-emitter.exe \
 *     tools/oracle/vectors/k1r2-laneC-it4-emitter.c
 */

#include <windows.h>
#include <stdio.h>
#include <stdint.h>
#include <string.h>

#pragma GCC optimize("no-omit-frame-pointer")

typedef uint32_t u32;
typedef int32_t  s32;
typedef uint16_t u16;
typedef int16_t  s16;
typedef uint8_t  u8;

static void write_dword_entry(FILE *fp, int *first, u32 addr, u32 val) {
  if (!*first) fprintf(fp, ",");
  *first = 0;
  fprintf(fp, "\"0x%08x\":%u", addr, val);
}

static void write_byte_entry(FILE *fp, int *first, u32 addr, u8 val) {
  if (!*first) fprintf(fp, ",");
  *first = 0;
  fprintf(fp, "\"0x%08x\":%u", addr, (u32)val);
}

static void write_mem_dwords(FILE *fp, int *first, u32 base_addr, const void *buf, size_t byte_len) {
  const u32 *words = (const u32 *)buf;
  size_t count = byte_len / 4;
  for (size_t i = 0; i < count; i++) {
    write_dword_entry(fp, first, base_addr + (u32)(i * 4), words[i]);
  }
}

static void write_mem_bytes(FILE *fp, int *first, u32 base_addr, const void *buf, size_t byte_len) {
  const u8 *bytes = (const u8 *)buf;
  for (size_t i = 0; i < byte_len; i++) {
    write_byte_entry(fp, first, base_addr + (u32)i, bytes[i]);
  }
}

/* =========================================================================
 * B019 CALL WRAPPERS (10 functions)
 * ========================================================================= */

/* 1. 0x6FD67C80: custom eax=pHeadNode, ecx=pTargetCoord, esi=nCandX, ebx=nCandY, [esp+4]=pLevel, ret 4 */
static __attribute__((noinline, optimize("no-omit-frame-pointer")))
u32 call_6FD67C80(u32 pHeadNode, u32 pTargetCoord, s32 nCandX, s32 nCandY, u32 pLevel) {
  u32 fn = 0x6FD67C80u;
  u32 ret_eax = pHeadNode;
  u32 r_ecx = pTargetCoord;
  s32 r_esi = nCandX;
  s32 r_ebx = nCandY;
  u32 r_edx = pLevel;
  u32 r_edi = fn;
  __asm__ volatile (
    "pushl %4\n\t"
    "call *%5\n\t"
    : "+a"(ret_eax), "+c"(r_ecx), "+S"(r_esi), "+b"(r_ebx), "+d"(r_edx), "+D"(r_edi)
    :
    : "cc", "memory"
  );
  return ret_eax;
}

typedef void (__stdcall *fn_6FD681E0_t)(u32 pHoverMsg, u32 bUsed);
typedef u32  (__stdcall *fn_6FD681F0_t)(u32 pHoverMsg);
typedef s32  (__stdcall *fn_6FD6A610_t)(u32 pUnit);
typedef u32  (__stdcall *fn_6FD6A720_t)(u32 pUnit);
typedef s32  (__stdcall *fn_6FD6A770_t)(u32 pRoom1, s32 nClassId);
typedef s32  (__stdcall *fn_6FD6A990_t)(u32 pUnit, s32 nArg);
typedef s32  (__stdcall *fn_6FD6B880_t)(void);

/* 9. 0x6FD8D810: custom eax=pGrid, ecx=nY, edx=nX, esi=pOut9Dwords, ret */
static __attribute__((noinline, optimize("no-omit-frame-pointer")))
void call_6FD8D810(u32 pGrid, s32 nY, s32 nX, u32 pOut9Dwords) {
  u32 fn = 0x6FD8D810u;
  u32 r_eax = pGrid;
  s32 r_ecx = nY;
  s32 r_edx = nX;
  u32 r_esi = pOut9Dwords;
  u32 r_edi = fn;
  __asm__ volatile (
    "call *%4\n\t"
    : "+a"(r_eax), "+c"(r_ecx), "+d"(r_edx), "+S"(r_esi), "+D"(r_edi)
    :
    : "ebx", "cc", "memory"
  );
}

/* 10. 0x6FD8E230: custom eax=nX1, ecx=nY1, edx=nY2, [esp+4]=nX2, ret 4 */
static __attribute__((noinline, optimize("no-omit-frame-pointer")))
s32 call_6FD8E230(s32 nX1, s32 nY1, s32 nY2, s32 nX2) {
  u32 fn = 0x6FD8E230u;
  s32 r_eax = nX1;
  s32 r_ecx = nY1;
  s32 r_edx = nY2;
  s32 r_esi = nX2;
  u32 r_edi = fn;
  __asm__ volatile (
    "pushl %3\n\t"
    "call *%4\n\t"
    : "+a"(r_eax), "+c"(r_ecx), "+d"(r_edx), "+S"(r_esi), "+D"(r_edi)
    :
    : "ebx", "cc", "memory"
  );
  return r_eax;
}

/* =========================================================================
 * B022 CALL WRAPPERS (12 functions)
 * ========================================================================= */

/* 1. 0x6FD63F30: custom ebx=pDest, edi=nWidth, esi=nHeight, [esp+4]=pSrc, [esp+8]=nDir, ret 8 */
static __attribute__((noinline, optimize("no-omit-frame-pointer")))
void call_6FD63F30(u32 pDest, s32 nWidth, s32 nHeight, u32 pSrc, u32 nDir) {
  u32 fn = 0x6FD63F30u;
  u32 r_ebx = pDest;
  s32 r_edi = nWidth;
  s32 r_esi = nHeight;
  u32 r_eax = pSrc;
  u32 r_ecx = nDir;
  u32 r_edx = fn;
  __asm__ volatile (
    "pushl %4\n\t"
    "pushl %3\n\t"
    "call *%5\n\t"
    : "+b"(r_ebx), "+D"(r_edi), "+S"(r_esi), "+a"(r_eax), "+c"(r_ecx), "+d"(r_edx)
    :
    : "cc", "memory"
  );
}

typedef s32 (__fastcall *fn_link_check_t)(u32 pLinkData, s32 nIteration);
typedef s32 (__fastcall *fn_link_step_t)(u32 pLinkData);

/* 12. 0x6FD65840: custom eax=pLevel, ret */
static __attribute__((noinline, optimize("no-omit-frame-pointer")))
void call_6FD65840(u32 pLevel) {
  u32 fn = 0x6FD65840u;
  u32 r_eax = pLevel;
  u32 r_ecx = fn;
  __asm__ volatile (
    "call *%1\n\t"
    : "+a"(r_eax), "+c"(r_ecx)
    :
    : "ebx", "edx", "esi", "edi", "cc", "memory"
  );
}

/* =========================================================================
 * B025 CALL WRAPPERS (18 functions)
 * ========================================================================= */
typedef void (__stdcall *fn_path_set_u32_t)(u32 pPath, u32 val);
typedef void (__stdcall *fn_path_set_target_pos_t)(u32 pPath, s32 x, s32 y);
typedef void (__stdcall *fn_path_void_t)(u32 pPath);
typedef u32  (__stdcall *fn_path_get_u32_t)(u32 pPath);
typedef u32  (__stdcall *fn_path_get_pts_t)(u32 pPath, u32 ppPoints);

/* =========================================================================
 * EMIT B019 VECTORS
 * ========================================================================= */
static void emit_b019(FILE *fp) {
  /* 1. 0x6FD67C80: DRLGOUTPLACE_CanStepMazeLinkNode113c
   * Branches:
   * - target match (candX == target[0] && candY == target[1]) -> 1
   * - candX == target[0] && candY != target[1] -> checks bounds
   * - candX < nMinX -> 0
   * - candY < nMinY -> 0
   * - candX >= nMinX + nGridWidth -> 0
   * - candY >= nMinY + nGridHeight -> 0
   * - (cell & 0x200) != 0 -> 0
   * - pHeadNode == 0 -> 1
   * - pHeadNode != 0, node 0 matches (candX, candY) -> 0
   * - pHeadNode != 0, node 0 matches X only, node 1 matches (candX, candY) -> 0
   * - pHeadNode != 0, 2 nodes, neither matches -> 1
   */
  {
    static u8 level_buf[0x20];
    static u8 outdoors_buf[0x70];
    static u32 cells[16];
    static u32 target[2] = { 12, 13 };
    static u8 node0[0x24];
    static u8 node1[0x24];
    static u32 row_off16[16];
    static u32 cells64[64];

    struct {
      const char *note;
      s32 candX;
      s32 candY;
      u32 cell_flag;
      int use_nodes;
      s32 n0x, n0y, n1x, n1y;
    } cases[10] = {
      { "target_coord_exact_match", 12, 13, 0, 0, 0, 0, 0, 0 },
      { "target_x_match_y_mismatch_valid_no_head", 12, 11, 0, 0, 0, 0, 0, 0 },
      { "cand_x_below_min_x", 9, 11, 0, 0, 0, 0, 0, 0 },
      { "cand_y_below_min_y", 11, 9, 0, 0, 0, 0, 0, 0 },
      { "cand_x_ge_max_x", 14, 11, 0, 0, 0, 0, 0, 0 },
      { "cand_y_ge_max_y", 11, 14, 0, 0, 0, 0, 0, 0 },
      { "grid_cell_bit_0x200_blocked", 1, 1, 0x200, 0, 0, 0, 0, 0 },
      { "linked_list_first_node_collision", 1, 2, 0, 1, 1, 2, 3, 3 },
      { "linked_list_second_node_collision_x_match_first", 2, 2, 0, 2, 2, 1, 2, 2 },
      { "linked_list_two_nodes_no_collision_returns_1", 2, 1, 0x1FF, 2, 1, 1, 2, 3 },
    };

    for (int c = 0; c < 10; c++) {
      memset(level_buf, 0, sizeof(level_buf));
      memset(outdoors_buf, 0, sizeof(outdoors_buf));
      memset(cells, 0, sizeof(cells));
      memset(node0, 0, sizeof(node0));
      memset(node1, 0, sizeof(node1));

      s32 minX = (c < 6) ? 10 : 0;
      s32 minY = (c < 6) ? 10 : 0;
      for (int r = 0; r < 16; r++) row_off16[r] = (u32)(r * 4);
      for (int i = 0; i < 64; i++) cells64[i] = 0;
      if (cases[c].candY >= 0 && cases[c].candY < 16 && cases[c].candX >= 0 && cases[c].candX < 16) {
        u32 idx = row_off16[cases[c].candY] + (u32)cases[c].candX;
        if (idx < 64) cells64[idx] = cases[c].cell_flag;
      }

      *(u32 *)(level_buf + 0x14) = (u32)(uintptr_t)outdoors_buf;
      *(u32 *)(outdoors_buf + 0x2C) = (u32)(uintptr_t)cells64;
      *(u32 *)(outdoors_buf + 0x30) = (u32)(uintptr_t)row_off16;
      *(s32 *)(outdoors_buf + 0x54) = minX;
      *(s32 *)(outdoors_buf + 0x58) = minY;
      *(s32 *)(outdoors_buf + 0x5C) = 4;
      *(s32 *)(outdoors_buf + 0x60) = 4;

      *(s32 *)(node0 + 0x0C) = cases[c].n0x;
      *(s32 *)(node0 + 0x10) = cases[c].n0y;
      *(u32 *)(node0 + 0x20) = (cases[c].use_nodes == 2) ? (u32)(uintptr_t)node1 : 0;
      *(s32 *)(node1 + 0x0C) = cases[c].n1x;
      *(s32 *)(node1 + 0x10) = cases[c].n1y;
      *(u32 *)(node1 + 0x20) = 0;

      u32 pHead = (cases[c].use_nodes > 0) ? (u32)(uintptr_t)node0 : 0;
      u32 pTarget = (u32)(uintptr_t)target;
      u32 pLevel = (u32)(uintptr_t)level_buf;

      fprintf(fp, "{\"va\":\"0x6fd67c80\",\"case\":%d,\"note\":\"%s\",\"in\":{\"args\":[%u,%u,%d,%d,%u],\"mem\":{",
              c, cases[c].note, pHead, pTarget, cases[c].candX, cases[c].candY, pLevel);
      int first = 1;
      write_mem_dwords(fp, &first, pTarget, target, sizeof(target));
      write_mem_dwords(fp, &first, pLevel, level_buf, sizeof(level_buf));
      write_mem_dwords(fp, &first, (u32)(uintptr_t)outdoors_buf, outdoors_buf, sizeof(outdoors_buf));
      write_mem_dwords(fp, &first, (u32)(uintptr_t)row_off16, row_off16, sizeof(row_off16));
      write_mem_dwords(fp, &first, (u32)(uintptr_t)cells64, cells64, sizeof(cells64));
      if (cases[c].use_nodes >= 1) write_mem_dwords(fp, &first, (u32)(uintptr_t)node0, node0, sizeof(node0));
      if (cases[c].use_nodes >= 2) write_mem_dwords(fp, &first, (u32)(uintptr_t)node1, node1, sizeof(node1));

      u32 eax = call_6FD67C80(pHead, pTarget, cases[c].candX, cases[c].candY, pLevel);
      fprintf(fp, "}},\"out\":{\"eax\":%u,\"mem\":{}}}\n", eax);
    }
  }

  /* 2. 0x6FD681E0: CHAT_SetUsed113c(pHoverMsg, bUsed) */
  {
    fn_6FD681E0_t fn = (fn_6FD681E0_t)0x6FD681E0u;
    static u8 hover[16];
    u32 vals[4] = { 0, 1, 0x100, 0xABCD007Fu };
    for (int c = 0; c < 4; c++) {
      memset(hover, 0xAA, sizeof(hover));
      hover[8] = (c == 0) ? 1 : 0;
      u32 pHover = (u32)(uintptr_t)hover;
      fprintf(fp, "{\"va\":\"0x6fd681e0\",\"case\":%d,\"note\":\"set_used_%u\",\"in\":{\"args\":[%u,%u],\"mem\":{",
              c, vals[c], pHover, vals[c]);
      int first = 1;
      write_mem_bytes(fp, &first, pHover + 4, hover + 4, 8);
      fn(pHover, vals[c]);
      fprintf(fp, "}},\"out\":{\"eax\":0,\"mem\":{");
      first = 1;
      write_mem_bytes(fp, &first, pHover + 4, hover + 4, 8);
      fprintf(fp, "}}}\n");
    }
  }

  /* 3. 0x6FD681F0: CHAT_GetUsed113c(pHoverMsg) */
  {
    fn_6FD681F0_t fn = (fn_6FD681F0_t)0x6FD681F0u;
    static u8 hover[16];
    u8 vals[4] = { 0, 1, 0x7F, 0xFF };
    for (int c = 0; c < 4; c++) {
      memset(hover, 0x55, sizeof(hover));
      hover[8] = vals[c];
      u32 pHover = (u32)(uintptr_t)hover;
      fprintf(fp, "{\"va\":\"0x6fd681f0\",\"case\":%d,\"note\":\"get_used_%u\",\"in\":{\"args\":[%u],\"mem\":{",
              c, vals[c], pHover);
      int first = 1;
      write_mem_bytes(fp, &first, pHover + 4, hover + 4, 8);
      u32 eax = fn(pHover) & 0xFFu;
      fprintf(fp, "}},\"out\":{\"eax\":%u,\"mem\":{}}}\n", eax);
    }
  }

  /* 4. 0x6FD6A610: MONSTER_CheckMonTypeFlag0x20_113c(pUnit) */
  /* 5. 0x6FD6A720: MONSTER_GetMonStatsInteractBit113c(pUnit) */
  {
    fn_6FD6A610_t fn1 = (fn_6FD6A610_t)0x6FD6A610u;
    fn_6FD6A720_t fn2 = (fn_6FD6A720_t)0x6FD6A720u;
    static u8 monstats[4 * 0x1A8];
    static u8 unit[16];
    memset(monstats, 0, sizeof(monstats));
    /* rec 0: nBitField1 (+0x0C) = 0x80, nBitField2 (+0x0D) = 0x20 */
    monstats[0 * 0x1A8 + 0x0C] = 0x80;
    monstats[0 * 0x1A8 + 0x0D] = 0x20;
    /* rec 1: nBitField1 (+0x0C) = 0x7F, nBitField2 (+0x0D) = 0xDF */
    monstats[1 * 0x1A8 + 0x0C] = 0x7F;
    monstats[1 * 0x1A8 + 0x0D] = 0xDF;

    u32 gpDataTables = *(u32 *)0x6FDE9E1Cu;
    u32 saved_mon_ptr = *(u32 *)(gpDataTables + 0xA78);
    u32 saved_mon_cnt = *(u32 *)(gpDataTables + 0xA80);
    *(u32 *)(gpDataTables + 0xA78) = (u32)(uintptr_t)monstats;
    *(u32 *)(gpDataTables + 0xA80) = 4;
    u32 pBitMasks = *(u32 *)0x6FDD90B0u;

    struct {
      const char *note;
      int is_null;
      u32 unit_type;
      s32 class_id;
    } cases[6] = {
      { "null_unit", 1, 0, 0 },
      { "non_monster_unit_type_0", 0, 0, 0 },
      { "negative_class_id", 0, 1, -1 },
      { "oob_class_id_ge_count", 0, 1, 4 },
      { "monster_bit_set", 0, 1, 0 },
      { "monster_bit_clear", 0, 1, 1 },
    };

    for (int which = 0; which < 2; which++) {
      const char *va = (which == 0) ? "0x6fd6a610" : "0x6fd6a720";
      for (int c = 0; c < 6; c++) {
        memset(unit, 0, sizeof(unit));
        *(u32 *)(unit + 0) = cases[c].unit_type;
        *(s32 *)(unit + 4) = cases[c].class_id;
        u32 pUnit = cases[c].is_null ? 0 : (u32)(uintptr_t)unit;

        fprintf(fp, "{\"va\":\"%s\",\"case\":%d,\"note\":\"%s\",\"in\":{\"args\":[%u],\"mem\":{",
                va, c, cases[c].note, pUnit);
        int first = 1;
        write_dword_entry(fp, &first, 0x6FDE9E1Cu, gpDataTables);
        write_dword_entry(fp, &first, gpDataTables + 0xA78, (u32)(uintptr_t)monstats);
        write_dword_entry(fp, &first, gpDataTables + 0xA80, 4);
        write_dword_entry(fp, &first, 0x6FDD90B0u, pBitMasks);
        write_mem_dwords(fp, &first, pBitMasks, (const void *)(uintptr_t)pBitMasks, 32 * 4);
        if (!cases[c].is_null) {
          write_mem_dwords(fp, &first, pUnit, unit, sizeof(unit));
        }
        write_mem_dwords(fp, &first, (u32)(uintptr_t)monstats + 0 * 0x1A8, monstats + 0 * 0x1A8, 16);
        write_mem_dwords(fp, &first, (u32)(uintptr_t)monstats + 1 * 0x1A8, monstats + 1 * 0x1A8, 16);

        u32 eax = (which == 0) ? (u32)fn1(pUnit) : fn2(pUnit);
        fprintf(fp, "}},\"out\":{\"eax\":%u,\"mem\":{}}}\n", eax);
      }
    }

    *(u32 *)(gpDataTables + 0xA78) = saved_mon_ptr;
    *(u32 *)(gpDataTables + 0xA80) = saved_mon_cnt;
  }

  /* 6. 0x6FD6A770: DRLG_ResolveMonsterSubClassIdForRoom113c(pRoom1, nClassId) */
  {
    fn_6FD6A770_t fn = (fn_6FD6A770_t)0x6FD6A770u;
    static u8 room1[0x20];
    static u8 roomEx[0x60];
    static u8 level[0x1E0];
    static u8 levelsTxt[3 * 0x220];
    static u8 monstats[8 * 0x1A8];

    u32 gpDataTables = *(u32 *)0x6FDE9E1Cu;
    u32 saved_mon_ptr = *(u32 *)(gpDataTables + 0xA78);
    u32 saved_mon_cnt = *(u32 *)(gpDataTables + 0xA80);
    u32 saved_lvl_ptr = *(u32 *)(gpDataTables + 0xC58);
    u32 saved_lvl_cnt = *(u32 *)(gpDataTables + 0xC5C);
    u32 saved_bss_mon_ptr = *(u32 *)0x6FDF0950u;
    u32 saved_bss_mon_cnt = *(u32 *)0x6FDF0958u;

    *(u32 *)(gpDataTables + 0xA78) = (u32)(uintptr_t)monstats;
    *(u32 *)(gpDataTables + 0xA80) = 8;
    *(u32 *)(gpDataTables + 0xC58) = (u32)(uintptr_t)levelsTxt;
    *(u32 *)(gpDataTables + 0xC5C) = 3;
    *(u32 *)0x6FDF0950u = (u32)(uintptr_t)monstats;
    *(u32 *)0x6FDF0958u = 8;

    memset(monstats, 0, sizeof(monstats));
    *(s16 *)(monstats + 0 * 0x1A8 + 0x02) = 0;
    *(s16 *)(monstats + 0 * 0x1A8 + 0x04) = 1;
    *(u8  *)(monstats + 0 * 0x1A8 + 0x4A) = 3;
    *(s16 *)(monstats + 0 * 0x1A8 + 0xAA) = 5;

    *(s16 *)(monstats + 1 * 0x1A8 + 0x02) = 0;
    *(s16 *)(monstats + 1 * 0x1A8 + 0x04) = 2;
    *(u8  *)(monstats + 1 * 0x1A8 + 0x4A) = 3;
    *(s16 *)(monstats + 1 * 0x1A8 + 0xAA) = 10;

    *(s16 *)(monstats + 2 * 0x1A8 + 0x02) = 0;
    *(s16 *)(monstats + 2 * 0x1A8 + 0x04) = 3;
    *(u8  *)(monstats + 2 * 0x1A8 + 0x4A) = 3;
    *(s16 *)(monstats + 2 * 0x1A8 + 0xAA) = 20;

    *(s16 *)(monstats + 3 * 0x1A8 + 0x02) = 0;
    *(s16 *)(monstats + 3 * 0x1A8 + 0x04) = -1;
    *(u8  *)(monstats + 3 * 0x1A8 + 0x4A) = 3;
    *(s16 *)(monstats + 3 * 0x1A8 + 0xAA) = 25;

    *(s16 *)(monstats + 4 * 0x1A8 + 0x02) = 4;
    *(s16 *)(monstats + 4 * 0x1A8 + 0x04) = 5;
    *(u8  *)(monstats + 4 * 0x1A8 + 0x4A) = 2;
    *(s16 *)(monstats + 4 * 0x1A8 + 0xAA) = 5;

    *(s16 *)(monstats + 5 * 0x1A8 + 0x02) = 4;
    *(s16 *)(monstats + 5 * 0x1A8 + 0x04) = -1;
    *(u8  *)(monstats + 5 * 0x1A8 + 0x4A) = 2;
    *(s16 *)(monstats + 5 * 0x1A8 + 0xAA) = 8;

    *(s16 *)(monstats + 6 * 0x1A8 + 0x02) = -1;
    *(s16 *)(monstats + 6 * 0x1A8 + 0x04) = -1;
    *(u8  *)(monstats + 6 * 0x1A8 + 0x4A) = 0;
    *(s16 *)(monstats + 6 * 0x1A8 + 0xAA) = 1;

    *(s16 *)(monstats + 7 * 0x1A8 + 0x02) = 0;
    *(s16 *)(monstats + 7 * 0x1A8 + 0x04) = 1;
    *(u8  *)(monstats + 7 * 0x1A8 + 0x4A) = 0;
    *(s16 *)(monstats + 7 * 0x1A8 + 0xAA) = 5;

    memset(levelsTxt, 0, sizeof(levelsTxt));
    levelsTxt[1 * 0x220 + 0x33] = 0;
    levelsTxt[2 * 0x220 + 0x33] = 2;
    *(s16 *)(levelsTxt + 2 * 0x220 + 0x16) = 12;
    *(s16 *)(levelsTxt + 2 * 0x220 + 0x36) = 99;
    *(s16 *)(levelsTxt + 2 * 0x220 + 0x38) = 5;

    struct {
      const char *note;
      s32 level_id;
      s16 mon_lv;
      s32 class_id;
    } cases[7] = {
      { "num_mon_zero_returns_class_id", 1, 10, 2 },
      { "negative_class_id_returns_negative", 2, 12, -3 },
      { "oob_class_id_returns_oob", 2, 12, 12 },
      { "invalid_wBaseId_negative_returns_class_id", 2, 12, 6 },
      { "level_wMon_matches_base_id_4_returns_5", 2, 12, 4 },
      { "walk_next_in_class_stops_at_mon_lv_plus_1", 2, 12, 0 },
      { "walk_next_in_class_all_steps_within_level", 2, 30, 0 },
    };

    for (int c = 0; c < 7; c++) {
      memset(room1, 0, sizeof(room1));
      memset(roomEx, 0, sizeof(roomEx));
      memset(level, 0, sizeof(level));
      *(u32 *)(room1 + 0x10) = (u32)(uintptr_t)roomEx;
      *(u32 *)(roomEx + 0x58) = (u32)(uintptr_t)level;
      *(s32 *)(level + 0x1D0) = cases[c].level_id;
      *(s16 *)(levelsTxt + 2 * 0x220 + 0x16) = cases[c].mon_lv;

      u32 pRoom1 = (u32)(uintptr_t)room1;
      fprintf(fp, "{\"va\":\"0x6fd6a770\",\"case\":%d,\"note\":\"%s\",\"in\":{\"args\":[%u,%d],\"mem\":{",
              c, cases[c].note, pRoom1, cases[c].class_id);
      int first = 1;
      write_dword_entry(fp, &first, 0x6FDE9E1Cu, gpDataTables);
      write_dword_entry(fp, &first, gpDataTables + 0xA78, (u32)(uintptr_t)monstats);
      write_dword_entry(fp, &first, gpDataTables + 0xA80, 8);
      write_dword_entry(fp, &first, gpDataTables + 0xC58, (u32)(uintptr_t)levelsTxt);
      write_dword_entry(fp, &first, gpDataTables + 0xC5C, 3);
      write_dword_entry(fp, &first, 0x6FDF0950u, (u32)(uintptr_t)monstats);
      write_dword_entry(fp, &first, 0x6FDF0958u, 8);
      write_mem_dwords(fp, &first, pRoom1, room1, sizeof(room1));
      write_mem_dwords(fp, &first, (u32)(uintptr_t)roomEx, roomEx, sizeof(roomEx));
      write_mem_dwords(fp, &first, (u32)(uintptr_t)level + 0x1C0, level + 0x1C0, 0x20);
      write_mem_dwords(fp, &first, (u32)(uintptr_t)levelsTxt + 1 * 0x220, levelsTxt + 1 * 0x220, 0x40);
      write_mem_dwords(fp, &first, (u32)(uintptr_t)levelsTxt + 2 * 0x220, levelsTxt + 2 * 0x220, 0x40);
      for (int m_idx = 0; m_idx < 8; m_idx++) {
        u32 mb = (u32)(uintptr_t)monstats + (u32)(m_idx * 0x1A8);
        write_mem_dwords(fp, &first, mb, monstats + m_idx * 0x1A8, 8);
        write_mem_dwords(fp, &first, mb + 0x48, monstats + m_idx * 0x1A8 + 0x48, 4);
        write_mem_dwords(fp, &first, mb + 0xA8, monstats + m_idx * 0x1A8 + 0xA8, 4);
      }

      u32 eax = (u32)fn(pRoom1, cases[c].class_id);
      fprintf(fp, "}},\"out\":{\"eax\":%u,\"mem\":{}}}\n", eax);
    }

    /* Adversarial cases 7..10: negative wMon[0]=-1, OOB wMon[1]=99, wLevel==wMonLv+1 exact equality (kills C07),
     * wNextInClass=-1, wNextInClass=99, nSubClassCount=0 */
    {
      static u8 adv_room1[0x20], adv_room2[0x60], adv_level[0x200], adv_levels_txt[2 * 0x220], adv_monstats_txt[6 * 0x1A8];
      for (int adv = 0; adv < 4; adv++) {
        memset(adv_room1, 0, sizeof(adv_room1));
        memset(adv_room2, 0, sizeof(adv_room2));
        memset(adv_level, 0, sizeof(adv_level));
        memset(adv_levels_txt, 0, sizeof(adv_levels_txt));
        memset(adv_monstats_txt, 0, sizeof(adv_monstats_txt));

        *(u32 *)(adv_room1 + 0x10) = (u32)(uintptr_t)adv_room2;
        *(u32 *)(adv_room2 + 0x58) = (u32)(uintptr_t)adv_level;
        *(s32 *)(adv_level + 0x1D0) = 1;

        u8 *lvl1 = adv_levels_txt + 1 * 0x220;
        lvl1[0x33] = 2;
        *(s16 *)(lvl1 + 0x16) = 10;
        if (adv == 0) {
          *(s16 *)(lvl1 + 0x36 + 0) = -1; /* negative wMon[0] */
          *(s16 *)(lvl1 + 0x36 + 2) = 99; /* OOB wMon[1] */
        } else {
          *(s16 *)(lvl1 + 0x36 + 0) = 4;
          *(s16 *)(lvl1 + 0x36 + 2) = 4;
        }

        for (int m = 0; m < 6; m++) {
          *(s16 *)(adv_monstats_txt + m * 0x1A8 + 0x02) = (s16)m;
          *(s16 *)(adv_monstats_txt + m * 0x1A8 + 0x04) = -1;
        }
        *(s16 *)(adv_monstats_txt + 1 * 0x1A8 + 0x02) = 1;
        *(s16 *)(adv_monstats_txt + 1 * 0x1A8 + 0x04) = (adv == 1) ? -1 : (adv == 2) ? 99 : 2;
        adv_monstats_txt[1 * 0x1A8 + 0x4A] = (adv == 3) ? 0 : 3;
        *(s16 *)(adv_monstats_txt + 2 * 0x1A8 + 0x04) = 3;
        *(s16 *)(adv_monstats_txt + 2 * 0x1A8 + 0xAA) = 11; /* exact equality wLevel == wMonLv + 1 (11 == 10 + 1) */
        *(s16 *)(adv_monstats_txt + 3 * 0x1A8 + 0xAA) = 25; /* > wMonLv + 1 */

        *(u32 *)(gpDataTables + 0xC5C) = 2;
        *(u32 *)(gpDataTables + 0xC58) = (u32)(uintptr_t)adv_levels_txt;
        *(u32 *)(gpDataTables + 0xA80) = 6;
        *(u32 *)(gpDataTables + 0xA78) = (u32)(uintptr_t)adv_monstats_txt;
        *(u32 *)0x6FDF0958u = 6;
        *(u32 *)0x6FDF0950u = (u32)(uintptr_t)adv_monstats_txt;

        u32 pR1 = (u32)(uintptr_t)adv_room1;
        fprintf(fp, "{\"va\":\"0x6fd6a770\",\"case\":%d,\"note\":\"adv_mon_%d\",\"in\":{\"args\":[%u,1],\"mem\":{",
                7 + adv, adv, pR1);
        int first = 1;
        write_dword_entry(fp, &first, 0x6FDE9E1Cu, gpDataTables);
        write_dword_entry(fp, &first, gpDataTables + 0xC5C, 2);
        write_dword_entry(fp, &first, gpDataTables + 0xC58, (u32)(uintptr_t)adv_levels_txt);
        write_dword_entry(fp, &first, gpDataTables + 0xA80, 6);
        write_dword_entry(fp, &first, gpDataTables + 0xA78, (u32)(uintptr_t)adv_monstats_txt);
        write_dword_entry(fp, &first, 0x6FDF0958u, 6);
        write_dword_entry(fp, &first, 0x6FDF0950u, (u32)(uintptr_t)adv_monstats_txt);
        write_mem_dwords(fp, &first, pR1, adv_room1, sizeof(adv_room1));
        write_mem_dwords(fp, &first, (u32)(uintptr_t)adv_room2, adv_room2, sizeof(adv_room2));
        write_dword_entry(fp, &first, (u32)(uintptr_t)adv_level + 0x1D0, 1);
        write_mem_bytes(fp, &first, (u32)(uintptr_t)lvl1 + 0x14, lvl1 + 0x14, 0x30);
        for (int m = 0; m < 6; m++) {
          u32 mb = (u32)(uintptr_t)(adv_monstats_txt + m * 0x1A8);
          write_mem_bytes(fp, &first, mb, adv_monstats_txt + m * 0x1A8, 8);
          write_mem_bytes(fp, &first, mb + 0x48, adv_monstats_txt + m * 0x1A8 + 0x48, 4);
          write_mem_bytes(fp, &first, mb + 0xA8, adv_monstats_txt + m * 0x1A8 + 0xA8, 4);
        }
        s32 eax = fn(pR1, 1);
        fprintf(fp, "}},\"out\":{\"eax\":%u,\"mem\":{}}}\n", (u32)eax);
      }
    }

    *(u32 *)(gpDataTables + 0xA78) = saved_mon_ptr;
    *(u32 *)(gpDataTables + 0xA80) = saved_mon_cnt;
    *(u32 *)(gpDataTables + 0xC58) = saved_lvl_ptr;
    *(u32 *)(gpDataTables + 0xC5C) = saved_lvl_cnt;
    *(u32 *)0x6FDF0950u = saved_bss_mon_ptr;
    *(u32 *)0x6FDF0958u = saved_bss_mon_cnt;
  }

  /* 7. 0x6FD6A990: MONSTER_IsSarcophagusBaseAndZeroArg113c(pUnit, nArg) */
  {
    fn_6FD6A990_t fn = (fn_6FD6A990_t)0x6FD6A990u;
    static u8 monstats[4 * 0x1A8];
    static u8 unit[16];
    memset(monstats, 0, sizeof(monstats));
    *(s16 *)(monstats + 0 * 0x1A8 + 0x02) = 0x4E;
    *(s16 *)(monstats + 1 * 0x1A8 + 0x02) = 0x10;

    u32 gpDataTables = *(u32 *)0x6FDE9E1Cu;
    u32 saved_mon_ptr = *(u32 *)(gpDataTables + 0xA78);
    u32 saved_mon_cnt = *(u32 *)(gpDataTables + 0xA80);
    *(u32 *)(gpDataTables + 0xA78) = (u32)(uintptr_t)monstats;

    struct {
      const char *note;
      int is_null;
      u32 unit_type;
      s32 class_id;
      s32 mon_count;
      s32 arg2;
    } cases[7] = {
      { "sarcophagus_base_78_and_arg_zero_returns_1", 0, 1, 0, 100, 0 },
      { "sarcophagus_base_78_and_arg_nonzero_returns_0", 0, 1, 0, 100, 1 },
      { "non_sarcophagus_base_returns_0", 0, 1, 1, 100, 0 },
      { "null_unit_with_mon_count_gt_78_returns_0", 1, 0, 0, 100, 0 },
      { "null_unit_with_mon_count_le_78_and_arg_0_returns_1", 1, 0, 0, 50, 0 },
      { "non_monster_unit_type_2_with_mon_count_100_returns_0", 0, 2, 0, 100, 0 },
      { "sarcophagus_base_78_at_exact_mon_count_79_returns_1", 0, 1, 0, 79, 0 },
    };

    for (int c = 0; c < 7; c++) {
      *(u32 *)(gpDataTables + 0xA80) = (u32)cases[c].mon_count;
      memset(unit, 0, sizeof(unit));
      *(u32 *)(unit + 0) = cases[c].unit_type;
      *(s32 *)(unit + 4) = cases[c].class_id;
      u32 pUnit = cases[c].is_null ? 0 : (u32)(uintptr_t)unit;

      fprintf(fp, "{\"va\":\"0x6fd6a990\",\"case\":%d,\"note\":\"%s\",\"in\":{\"args\":[%u,%d],\"mem\":{",
              c, cases[c].note, pUnit, cases[c].arg2);
      int first = 1;
      write_dword_entry(fp, &first, 0x6FDE9E1Cu, gpDataTables);
      write_dword_entry(fp, &first, gpDataTables + 0xA78, (u32)(uintptr_t)monstats);
      write_dword_entry(fp, &first, gpDataTables + 0xA80, (u32)cases[c].mon_count);
      if (!cases[c].is_null) write_mem_dwords(fp, &first, pUnit, unit, sizeof(unit));
      write_mem_dwords(fp, &first, (u32)(uintptr_t)monstats + 0 * 0x1A8, monstats + 0 * 0x1A8, 8);
      write_mem_dwords(fp, &first, (u32)(uintptr_t)monstats + 1 * 0x1A8, monstats + 1 * 0x1A8, 8);

      u32 eax = (u32)fn(pUnit, cases[c].arg2);
      fprintf(fp, "}},\"out\":{\"eax\":%u,\"mem\":{}}}\n", eax);
    }

    *(u32 *)(gpDataTables + 0xA78) = saved_mon_ptr;
    *(u32 *)(gpDataTables + 0xA80) = saved_mon_cnt;
  }

  /* 8. 0x6FD6B880: DATATBLS_GetCubemainTxtRecordCount113c() */
  {
    fn_6FD6B880_t fn = (fn_6FD6B880_t)0x6FD6B880u;
    u32 saved = *(u32 *)0x6FDF1468u;
    u32 vals[3] = { 0, 149, 1024 };
    for (int c = 0; c < 3; c++) {
      *(u32 *)0x6FDF1468u = vals[c];
      fprintf(fp, "{\"va\":\"0x6fd6b880\",\"case\":%d,\"note\":\"cubemain_count_%u\",\"in\":{\"args\":[],\"mem\":{",
              c, vals[c]);
      int first = 1;
      write_dword_entry(fp, &first, 0x6FDF1468u, vals[c]);
      u32 eax = (u32)fn();
      fprintf(fp, "}},\"out\":{\"eax\":%u,\"mem\":{}}}\n", eax);
    }
    *(u32 *)0x6FDF1468u = saved;
  }

  /* 9. 0x6FD8D810: DRLGGRID_Get3x3Neighborhood113c(pGrid, nY, nX, pOut9Dwords) */
  {
    static u32 grid[2];
    static u32 row_offsets[5] = { 0, 5, 10, 15, 20 };
    static u32 cells[25];
    static u32 out[9];
    for (int i = 0; i < 25; i++) cells[i] = (u32)(0x1000 + i * 17);
    grid[0] = (u32)(uintptr_t)cells;
    grid[1] = (u32)(uintptr_t)row_offsets;

    s32 coords[3][2] = { { 1, 1 }, { 2, 2 }, { 3, 3 } };
    for (int c = 0; c < 3; c++) {
      memset(out, 0, sizeof(out));
      s32 nY = coords[c][0];
      s32 nX = coords[c][1];
      u32 pGrid = (u32)(uintptr_t)grid;
      u32 pOut = (u32)(uintptr_t)out;

      fprintf(fp, "{\"va\":\"0x6fd8d810\",\"case\":%d,\"note\":\"neighborhood_y%d_x%d\",\"in\":{\"args\":[%u,%d,%d,%u],\"mem\":{",
              c, nY, nX, pGrid, nY, nX, pOut);
      int first = 1;
      write_mem_dwords(fp, &first, pGrid, grid, sizeof(grid));
      write_mem_dwords(fp, &first, (u32)(uintptr_t)row_offsets, row_offsets, sizeof(row_offsets));
      write_mem_dwords(fp, &first, (u32)(uintptr_t)cells, cells, sizeof(cells));
      write_mem_dwords(fp, &first, pOut, out, sizeof(out));

      call_6FD8D810(pGrid, nY, nX, pOut);

      fprintf(fp, "}},\"out\":{\"eax\":0,\"mem\":{");
      first = 1;
      write_mem_dwords(fp, &first, pOut, out, sizeof(out));
      fprintf(fp, "}}}\n");
    }
  }

  /* 10. 0x6FD8E230: PATH_QuantizeDeltaIndex25_113c(nX1, nY1, nY2, nX2) */
  {
    struct {
      const char *note;
      s32 x1, y1, y2, x2;
    } cases[16] = {
      { "zero_delta_center_12", 10, 20, 20, 10 },
      { "absX_ge_2absY_pos_dx_gt_1_pos_dy_even", 15, 22, 20, 10 },
      { "absX_ge_2absY_neg_dx_lt_m1_neg_dy", 5, 19, 20, 10 },
      { "absX_ge_2absY_dx_eq_1_pos_dy_odd", 11, 20, 20, 10 },
      { "absY_ge_2absX_pos_dy_gt_1_pos_dx_odd", 11, 25, 20, 10 },
      { "absY_ge_2absX_neg_dy_lt_m1_neg_dx", 9, 15, 20, 10 },
      { "absY_ge_2absX_dy_eq_m1_dx_zero", 10, 19, 20, 10 },
      { "diagonal_pos_dx_gt_1_pos_dy_gt_1", 14, 24, 20, 10 },
      { "diagonal_neg_dx_lt_m1_neg_dy_lt_m1", 6, 16, 20, 10 },
      { "diagonal_unit_step_m1_p1", 9, 21, 20, 10 },
      { "adv_quant_0", 0, 0, 2, 4 },
      { "adv_quant_1", 0, 0, -2, -4 },
      { "adv_quant_2", 0, 0, 4, 2 },
      { "adv_quant_3", 0, 0, -4, 2 },
      { "adv_quant_4", 10, 10, 9, 7 },
      { "adv_quant_5", -100, 100, 100, -100 },
    };

    for (int c = 0; c < 16; c++) {
      s32 eax = call_6FD8E230(cases[c].x1, cases[c].y1, cases[c].y2, cases[c].x2);
      fprintf(fp, "{\"va\":\"0x6fd8e230\",\"case\":%d,\"note\":\"%s\",\"in\":{\"args\":[%d,%d,%d,%d],\"mem\":{}},\"out\":{\"eax\":%u,\"mem\":{}}}\n",
              c, cases[c].note, cases[c].x1, cases[c].y1, cases[c].y2, cases[c].x2, (u32)eax);
    }
  }
}

/* =========================================================================
 * EMIT B022 VECTORS
 * ========================================================================= */
static void emit_b022(FILE *fp) {
  /* 1. 0x6FD63F30: DRLGOUTPLACE_InitRoomExCoordByDir113c(pDest, nWidth, nHeight, pSrc, nDir) */
  {
    static u32 src[4] = { 100, 200, 40, 60 };
    static u32 dest[5];
    u32 dirs[6] = { 0, 1, 2, 3, 4, 5 };
    s32 heights[6] = { 30, 30, 33, -30, 30, 30 };
    for (int c = 0; c < 6; c++) {
      memset(dest, 0xCC, sizeof(dest));
      u32 pDest = (u32)(uintptr_t)dest;
      u32 pSrc = (u32)(uintptr_t)src;
      s32 w = 24;
      s32 h = heights[c];
      u32 dir = dirs[c];

      fprintf(fp, "{\"va\":\"0x6fd63f30\",\"case\":%d,\"note\":\"dir_%u_h_%d\",\"in\":{\"args\":[%u,%d,%d,%u,%u],\"mem\":{",
              c, dir, h, pDest, w, h, pSrc, dir);
      int first = 1;
      write_mem_dwords(fp, &first, pSrc, src, sizeof(src));
      write_mem_dwords(fp, &first, pDest, dest, sizeof(dest));

      call_6FD63F30(pDest, w, h, pSrc, dir);

      fprintf(fp, "}},\"out\":{\"eax\":0,\"mem\":{");
      first = 1;
      write_mem_dwords(fp, &first, pDest, dest, sizeof(dest));
      fprintf(fp, "}}}\n");
    }
  }

  /* 2. 0x6FD64900: DRLGOUTPLACE_CheckAct2LinkOverlap113c(pLinkData, nIteration) */
  {
    fn_link_check_t fn = (fn_link_check_t)0x6FD64900u;
    static u8 link_data[0x1F4];
    for (int c = 0; c < 4; c++) {
      memset(link_data, 0, sizeof(link_data));
      s32 iter = (c == 0) ? 0 : 2;
      *(s32 *)(link_data + 0x08 + 0 * 16 + 0) = 100;
      *(s32 *)(link_data + 0x08 + 0 * 16 + 4) = 500;
      *(s32 *)(link_data + 0x08 + 0 * 16 + 8) = 50;
      *(s32 *)(link_data + 0x08 + 0 * 16 + 12) = 50;
      *(s32 *)(link_data + 0x08 + 1 * 16 + 0) = 300;
      *(s32 *)(link_data + 0x08 + 1 * 16 + 4) = 500;
      *(s32 *)(link_data + 0x08 + 1 * 16 + 8) = 50;
      *(s32 *)(link_data + 0x08 + 1 * 16 + 12) = 50;
      if (c == 1) {
        *(s32 *)(link_data + 0x08 + 2 * 16 + 0) = 310;
        *(s32 *)(link_data + 0x08 + 2 * 16 + 4) = 510;
      } else if (c == 2) {
        *(s32 *)(link_data + 0x08 + 2 * 16 + 0) = 110;
        *(s32 *)(link_data + 0x08 + 2 * 16 + 4) = 510;
      } else {
        *(s32 *)(link_data + 0x08 + 2 * 16 + 0) = 110;
        *(s32 *)(link_data + 0x08 + 2 * 16 + 4) = 350;
      }
      *(s32 *)(link_data + 0x08 + 2 * 16 + 8) = 40;
      *(s32 *)(link_data + 0x08 + 2 * 16 + 12) = 40;

      u32 pLink = (u32)(uintptr_t)link_data;
      fprintf(fp, "{\"va\":\"0x6fd64900\",\"case\":%d,\"note\":\"act2_overlap_case_%d\",\"in\":{\"args\":[%u,%d],\"mem\":{",
              c, c, pLink, iter);
      int first = 1;
      write_mem_dwords(fp, &first, 0x6FDDCCD8u, (const void *)(uintptr_t)0x6FDDCCD8u, 15 * 16);
      write_mem_dwords(fp, &first, pLink, link_data, 0x40);

      u32 eax = (u32)fn(pLink, iter);

      fprintf(fp, "}},\"out\":{\"eax\":%u,\"mem\":{", eax);
      first = 1;
      write_mem_dwords(fp, &first, pLink, link_data, 0x40);
      fprintf(fp, "}}}\n");
    }
  }

  /* 3. 0x6FD64A00: DRLGOUTPLACE_CheckAct1LinkOverlap113c(pLinkData, nIteration) */
  {
    fn_link_check_t fn = (fn_link_check_t)0x6FD64A00u;
    static u8 link_data[0x1F4];
    for (int c = 0; c < 6; c++) {
      memset(link_data, 0, sizeof(link_data));
      for (int i = 0; i < 15; i++) {
        *(s32 *)(link_data + 0x08 + i * 16 + 0) = i * 200;
        *(s32 *)(link_data + 0x08 + i * 16 + 4) = i * 200;
        *(s32 *)(link_data + 0x08 + i * 16 + 8) = 50;
        *(s32 *)(link_data + 0x08 + i * 16 + 12) = 50;
      }
      s32 iter = 1;
      if (c == 1) {
        iter = 2;
        *(s32 *)(link_data + 0x08 + 2 * 16 + 0) = 10;
        *(s32 *)(link_data + 0x08 + 2 * 16 + 4) = 10;
      } else if (c == 2) {
        iter = 3;
        *(s32 *)(link_data + 0xFC + 2 * 4) = 0;
        *(s32 *)(link_data + 0x174 + 2 * 4) = 0;
        *(s32 *)(link_data + 0x174 + 3 * 4) = 0;
        *(s32 *)(link_data + 0xFC + 3 * 4) = 0;
      } else if (c == 3) {
        iter = 3;
        *(s32 *)(link_data + 0xFC + 2 * 4) = 0;
        *(s32 *)(link_data + 0x174 + 2 * 4) = 0;
        *(s32 *)(link_data + 0x174 + 3 * 4) = 0;
        *(s32 *)(link_data + 0xFC + 3 * 4) = 2;
      } else if (c == 4) {
        iter = 4;
        *(s32 *)(link_data + 0xFC + 2 * 4) = 3;
        *(s32 *)(link_data + 0xFC + 4 * 4) = 3;
      } else if (c == 5) {
        iter = 4;
        *(s32 *)(link_data + 0xFC + 2 * 4) = 1;
        *(s32 *)(link_data + 0xFC + 4 * 4) = 3;
      }

      u32 pLink = (u32)(uintptr_t)link_data;
      fprintf(fp, "{\"va\":\"0x6fd64a00\",\"case\":%d,\"note\":\"act1_overlap_case_%d\",\"in\":{\"args\":[%u,%d],\"mem\":{",
              c, c, pLink, iter);
      int first = 1;
      write_mem_dwords(fp, &first, 0x6FDDCBE8u, (const void *)(uintptr_t)0x6FDDCBE8u, 15 * 16);
      write_mem_dwords(fp, &first, 0x6FDE54B8u, (const void *)(uintptr_t)0x6FDE54B8u, 64 * 4);
      write_mem_dwords(fp, &first, pLink, link_data, sizeof(link_data));

      u32 eax = (u32)fn(pLink, iter);
      fprintf(fp, "}},\"out\":{\"eax\":%u,\"mem\":{}}}\n", eax);
    }
  }

  /* 4..10: Link placement step functions */
  {
    u32 vas[7] = {
      0x6FD64B00u, 0x6FD64D00u, 0x6FD64E30u, 0x6FD64F90u,
      0x6FD65250u, 0x6FD65480u, 0x6FD65680u
    };
    const char *va_strs[7] = {
      "0x6fd64b00", "0x6fd64d00", "0x6fd64e30", "0x6fd64f90",
      "0x6fd65250", "0x6fd65480", "0x6fd65680"
    };
    static u8 link_data[0x1F4];
    static u32 link_defs[4 * 4];
    u32 saved_act4_flag = *(u32 *)0x6FDF146Cu;

    for (int f = 0; f < 7; f++) {
      fn_link_step_t fn = (fn_link_step_t)vas[f];
      int num_cases = (f == 0) ? 4 : 9;
      for (int c = 0; c < num_cases; c++) {
        memset(link_data, 0, sizeof(link_data));
        memset(link_defs, 0, sizeof(link_defs));
        *(u32 *)0x6FDF146Cu = 0;

        *(u32 *)(link_data + 0x00) = (u32)(1000 + c * 3);
        *(u32 *)(link_data + 0x04) = (u32)(c & 1);
        *(s32 *)(link_data + 0x08 + 0 * 16 + 0) = 200;
        *(s32 *)(link_data + 0x08 + 0 * 16 + 4) = 300;
        *(s32 *)(link_data + 0x08 + 0 * 16 + 8) = 64;
        *(s32 *)(link_data + 0x08 + 0 * 16 + 12) = 80;
        *(s32 *)(link_data + 0x08 + 1 * 16 + 0) = 0;
        *(s32 *)(link_data + 0x08 + 1 * 16 + 4) = 0;
        *(s32 *)(link_data + 0x08 + 1 * 16 + 8) = 48;
        *(s32 *)(link_data + 0x08 + 1 * 16 + 12) = 64;

        link_defs[1 * 4 + 2] = 0;
        *(u32 *)(link_data + 0xF8) = (u32)(uintptr_t)link_defs;
        *(s32 *)(link_data + 0x1EC) = 1;

        if (c == 0 || c == 1 || f == 0) {
          *(s32 *)(link_data + 0x138 + 1 * 4) = -1;
          *(s32 *)(link_data + 0xFC + 1 * 4) = -1;
          *(s32 *)(link_data + 0x174 + 1 * 4) = -1;
          *(s32 *)(link_data + 0x1B0 + 1 * 4) = -1;
        } else if (c == num_cases - 1) {
          if (f == 2) {
            *(s32 *)(link_data + 0xFC + 1 * 4) = 1;
            *(s32 *)(link_data + 0x138 + 1 * 4) = 2;
          } else if (f == 3 || f == 4) {
            *(s32 *)(link_data + 0xFC + 1 * 4) = 1;
            *(s32 *)(link_data + 0x174 + 1 * 4) = 1;
            *(s32 *)(link_data + 0x138 + 1 * 4) = 2;
            *(s32 *)(link_data + 0x1B0 + 1 * 4) = 0;
          } else if (f == 6) {
            *(s32 *)(link_data + 0xFC + 1 * 4) = 3;
            *(s32 *)(link_data + 0x138 + 1 * 4) = 0;
          } else {
            *(s32 *)(link_data + 0xFC + 1 * 4) = 7;
            *(s32 *)(link_data + 0x138 + 1 * 4) = 0;
          }
        } else {
          if (f == 2) {
            *(s32 *)(link_data + 0xFC + 1 * 4) = (c & 1) ? 1 : 2;
            *(s32 *)(link_data + 0x138 + 1 * 4) = 99;
          } else if (f == 3 || f == 4) {
            *(s32 *)(link_data + 0xFC + 1 * 4) = (c - 2) & 3;
            *(s32 *)(link_data + 0x174 + 1 * 4) = ((c - 2) >> 2) & 1;
            *(s32 *)(link_data + 0x138 + 1 * 4) = 99;
            *(s32 *)(link_data + 0x1B0 + 1 * 4) = 99;
          } else {
            *(s32 *)(link_data + 0xFC + 1 * 4) = c - 2;
            *(s32 *)(link_data + 0x138 + 1 * 4) = 99;
          }
        }

        u32 pLink = (u32)(uintptr_t)link_data;
        fprintf(fp, "{\"va\":\"%s\",\"case\":%d,\"note\":\"step_case_%d\",\"in\":{\"args\":[%u],\"mem\":{",
                va_strs[f], c, c, pLink);
        int first = 1;
        if (f == 0) write_dword_entry(fp, &first, 0x6FDF146Cu, 0);
        write_mem_dwords(fp, &first, (u32)(uintptr_t)link_defs, link_defs, sizeof(link_defs));
        write_mem_dwords(fp, &first, pLink, link_data, sizeof(link_data));

        u32 eax = (u32)fn(pLink);

        fprintf(fp, "}},\"out\":{\"eax\":%u,\"mem\":{", eax);
        first = 1;
        if (f == 0) write_dword_entry(fp, &first, 0x6FDF146Cu, *(u32 *)0x6FDF146Cu);
        write_mem_dwords(fp, &first, pLink, link_data, sizeof(link_data));
        fprintf(fp, "}}}\n");
      }

      /* Additional adversarial cases for f == 0 (0x6FD64B00: odd LCG -> 0x800000 killing C14 + nIteration=45 aliasing) */
      if (f == 0) {
        static u32 adv_link_defs[64 * 4];
        for (int a = 0; a < 2; a++) {
          memset(link_data, 0, sizeof(link_data));
          memset(adv_link_defs, 0, sizeof(adv_link_defs));
          *(u32 *)0x6FDF146Cu = 0;
          /* lcg_lo = 1, lcg_hi = 0 -> newLo = 0x6AC690C5 (odd!) */
          *(u32 *)(link_data + 0x00) = 1u;
          *(u32 *)(link_data + 0x04) = 0u;
          *(s32 *)(link_data + 0x08 + 0 * 16 + 0) = 200;
          *(s32 *)(link_data + 0x08 + 0 * 16 + 4) = 300;
          *(s32 *)(link_data + 0x08 + 0 * 16 + 8) = 64;
          *(s32 *)(link_data + 0x08 + 0 * 16 + 12) = 80;
          *(s32 *)(link_data + 0x08 + 1 * 16 + 8) = 48;
          *(s32 *)(link_data + 0x08 + 1 * 16 + 12) = 64;
          *(s32 *)(link_data + 0x08 + 3 * 16 + 8) = 48;
          *(s32 *)(link_data + 0x08 + 3 * 16 + 12) = 64;
          *(u32 *)(link_data + 0xF8) = (u32)(uintptr_t)adv_link_defs;
          *(s32 *)(link_data + 0x1EC) = (a == 0) ? 1 : 45;
          *(s32 *)(link_data + 0xFC + 3 * 4) = 2;

          u32 pLink = (u32)(uintptr_t)link_data;
          fprintf(fp, "{\"va\":\"0x6fd64b00\",\"case\":%d,\"note\":\"adv_act4_%d\",\"in\":{\"args\":[%u],\"mem\":{",
                  4 + a, a, pLink);
          int first = 1;
          write_dword_entry(fp, &first, 0x6FDF146Cu, 0);
          write_mem_dwords(fp, &first, (u32)(uintptr_t)adv_link_defs, adv_link_defs, sizeof(adv_link_defs));
          write_mem_dwords(fp, &first, pLink, link_data, sizeof(link_data));
          u32 eax = (u32)fn(pLink);
          fprintf(fp, "}},\"out\":{\"eax\":%u,\"mem\":{", eax);
          first = 1;
          write_dword_entry(fp, &first, 0x6FDF146Cu, *(u32 *)0x6FDF146Cu);
          write_mem_dwords(fp, &first, pLink, link_data, sizeof(link_data));
          fprintf(fp, "}}}\n");
        }
      }

      /* Additional adversarial cases for f in {1, 3, 4, 5, 6} (negative nRand0=-3 + partial match) */
      if (f == 1 || f == 3 || f == 4 || f == 5 || f == 6) {
        int modes = (f == 3 || f == 4) ? 2 : 1;
        for (int m = 0; m < modes; m++) {
          memset(link_data, 0, sizeof(link_data));
          memset(link_defs, 0, sizeof(link_defs));
          *(s32 *)(link_data + 0x08 + 0 * 16 + 0) = 200;
          *(s32 *)(link_data + 0x08 + 0 * 16 + 4) = 300;
          *(s32 *)(link_data + 0x08 + 0 * 16 + 8) = 64;
          *(s32 *)(link_data + 0x08 + 0 * 16 + 12) = 80;
          *(s32 *)(link_data + 0x08 + 1 * 16 + 8) = 48;
          *(s32 *)(link_data + 0x08 + 1 * 16 + 12) = 64;
          *(u32 *)(link_data + 0xF8) = (u32)(uintptr_t)link_defs;
          *(s32 *)(link_data + 0x1EC) = 1;

          if (m == 0) {
            *(s32 *)(link_data + 0x138 + 1 * 4) = 99;
            *(s32 *)(link_data + 0xFC + 1 * 4) = -3;
            *(s32 *)(link_data + 0x174 + 1 * 4) = -2;
            *(s32 *)(link_data + 0x1B0 + 1 * 4) = 99;
          } else {
            *(s32 *)(link_data + 0xFC + 1 * 4) = 1;
            *(s32 *)(link_data + 0x174 + 1 * 4) = 1;
            *(s32 *)(link_data + 0x138 + 1 * 4) = 2;
            *(s32 *)(link_data + 0x1B0 + 1 * 4) = 1;
          }

          u32 pLink = (u32)(uintptr_t)link_data;
          fprintf(fp, "{\"va\":\"%s\",\"case\":%d,\"note\":\"adv_neg_or_partial_%d\",\"in\":{\"args\":[%u],\"mem\":{",
                  va_strs[f], 9 + m, m, pLink);
          int first = 1;
          write_mem_dwords(fp, &first, (u32)(uintptr_t)link_defs, link_defs, sizeof(link_defs));
          write_mem_dwords(fp, &first, pLink, link_data, sizeof(link_data));
          u32 eax = (u32)fn(pLink);
          fprintf(fp, "}},\"out\":{\"eax\":%u,\"mem\":{", eax);
          first = 1;
          write_mem_dwords(fp, &first, pLink, link_data, sizeof(link_data));
          fprintf(fp, "}}}\n");
        }
      }
    }
    *(u32 *)0x6FDF146Cu = saved_act4_flag;
  }

  /* 11. 0x6FD657D0: DRLGOUTPLACE_LinkFromLevelDef113c(pLinkData) */
  {
    fn_link_step_t fn = (fn_link_step_t)0x6FD657D0u;
    static u8 link_data[0x1F4];
    static u8 level_defs[3 * 0x9C];
    u32 gpDataTables = *(u32 *)0x6FDE9E1Cu;
    u32 saved_lvl_cnt = *(u32 *)(gpDataTables + 0xC5C);
    u32 saved_ldef_ptr = *(u32 *)0x6FDF0B38u;

    memset(level_defs, 0, sizeof(level_defs));
    *(u32 *)(level_defs + 1 * 0x9C + 0x24) = 440;
    *(u32 *)(level_defs + 1 * 0x9C + 0x28) = 880;
    *(u32 *)(level_defs + 2 * 0x9C + 0x24) = 1234;
    *(u32 *)(level_defs + 2 * 0x9C + 0x28) = 5678;

    *(u32 *)(gpDataTables + 0xC5C) = 3;
    *(u32 *)0x6FDF0B38u = (u32)(uintptr_t)level_defs;

    for (int c = 0; c < 3; c++) {
      memset(link_data, 0, sizeof(link_data));
      *(s32 *)(link_data + 0x1EC) = 1;
      *(s32 *)(link_data + 0x1F0) = (c == 0) ? 1 : 2;
      *(s32 *)(link_data + 0x138 + 1 * 4) = (c == 0) ? -1 : 5;
      *(s32 *)(link_data + 0xFC + 1 * 4) = 77;

      u32 pLink = (u32)(uintptr_t)link_data;
      fprintf(fp, "{\"va\":\"0x6fd657d0\",\"case\":%d,\"note\":\"leveldef_case_%d\",\"in\":{\"args\":[%u],\"mem\":{",
              c, c, pLink);
      int first = 1;
      write_dword_entry(fp, &first, 0x6FDE9E1Cu, gpDataTables);
      write_dword_entry(fp, &first, gpDataTables + 0xC5C, 3);
      write_dword_entry(fp, &first, 0x6FDF0B38u, (u32)(uintptr_t)level_defs);
      write_mem_dwords(fp, &first, (u32)(uintptr_t)level_defs + 1 * 0x9C + 0x20, level_defs + 1 * 0x9C + 0x20, 16);
      write_mem_dwords(fp, &first, (u32)(uintptr_t)level_defs + 2 * 0x9C + 0x20, level_defs + 2 * 0x9C + 0x20, 16);
      write_mem_dwords(fp, &first, pLink, link_data, sizeof(link_data));

      u32 eax = (u32)fn(pLink);

      fprintf(fp, "}},\"out\":{\"eax\":%u,\"mem\":{", eax);
      first = 1;
      write_mem_dwords(fp, &first, pLink, link_data, sizeof(link_data));
      fprintf(fp, "}}}\n");
    }

    *(u32 *)(gpDataTables + 0xC5C) = saved_lvl_cnt;
    *(u32 *)0x6FDF0B38u = saved_ldef_ptr;
  }

  /* 12. 0x6FD65840: DRLGOUTPLACE_MarkBorderGridCells113c(pLevel) */
  {
    static u8 level_buf[0x20];
    static u8 outdoors_buf[0x70];
    static u32 row_offsets[4] = { 0, 4, 8, 12 };
    static u32 cells[16];

    for (int c = 0; c < 3; c++) {
      memset(level_buf, 0, sizeof(level_buf));
      memset(outdoors_buf, 0, sizeof(outdoors_buf));
      *(u32 *)(level_buf + 0x14) = (u32)(uintptr_t)outdoors_buf;
      *(u32 *)(outdoors_buf + 0x2C) = (u32)(uintptr_t)cells;
      *(u32 *)(outdoors_buf + 0x30) = (u32)(uintptr_t)row_offsets;
      *(s32 *)(outdoors_buf + 0x5C) = 4;
      *(s32 *)(outdoors_buf + 0x60) = 4;

      if (c == 0) {
        for (int i = 0; i < 16; i++) cells[i] = 1;
      } else if (c == 1) {
        u32 init1[16] = {
          0x00, 0x01, 0x01, 0x00,
          0x01, 0x01, 0x01, 0x01,
          0x01, 0x01, 0x01, 0x01,
          0x00, 0x01, 0x01, 0x00
        };
        memcpy(cells, init1, sizeof(cells));
      } else {
        u32 init2[16] = {
          0x02, 0x04, 0x01, 0x08,
          0x10, 0x01, 0x01, 0x01,
          0x01, 0x01, 0x01, 0x20,
          0x40, 0x01, 0x80, 0x00
        };
        memcpy(cells, init2, sizeof(cells));
      }

      u32 pLevel = (u32)(uintptr_t)level_buf;
      fprintf(fp, "{\"va\":\"0x6fd65840\",\"case\":%d,\"note\":\"mark_border_case_%d\",\"in\":{\"args\":[%u],\"mem\":{",
              c, c, pLevel);
      int first = 1;
      write_dword_entry(fp, &first, 0x6FDEB244u, *(u32 *)0x6FDEB244u);
      write_mem_dwords(fp, &first, pLevel, level_buf, sizeof(level_buf));
      write_mem_dwords(fp, &first, (u32)(uintptr_t)outdoors_buf, outdoors_buf, sizeof(outdoors_buf));
      write_mem_dwords(fp, &first, (u32)(uintptr_t)row_offsets, row_offsets, sizeof(row_offsets));
      write_mem_dwords(fp, &first, (u32)(uintptr_t)cells, cells, sizeof(cells));

      call_6FD65840(pLevel);

      fprintf(fp, "}},\"out\":{\"eax\":0,\"mem\":{");
      first = 1;
      write_mem_dwords(fp, &first, (u32)(uintptr_t)cells, cells, sizeof(cells));
      fprintf(fp, "}}}\n");
    }
  }
}

/* =========================================================================
 * EMIT B025 VECTORS
 * ========================================================================= */
static void emit_b025(FILE *fp) {
  static u8 path_buf[0x100];
  static u32 out_ptr_cell[2];

  /* 1. 0x6FD84990: PATH_SetCurrentRoomInvalid113c(pPath, bInvalid) */
  {
    fn_path_set_u32_t fn = (fn_path_set_u32_t)0x6FD84990u;
    u32 init_flags[3] = { 0x00000000u, 0x00000007u, 0xFFFFFFFDu };
    u32 b_inval[3]    = { 1u,          0u,          5u };
    for (int c = 0; c < 3; c++) {
      memset(path_buf, 0xAA, sizeof(path_buf));
      *(u32 *)(path_buf + 0x34) = init_flags[c];
      u32 pPath = (u32)(uintptr_t)path_buf;
      fprintf(fp, "{\"va\":\"0x6fd84990\",\"case\":%d,\"note\":\"set_room_invalid_%u\",\"in\":{\"args\":[%u,%u],\"mem\":{",
              c, b_inval[c], pPath, b_inval[c]);
      int first = 1;
      write_mem_dwords(fp, &first, pPath + 0x30, path_buf + 0x30, 12);
      fn(pPath, b_inval[c]);
      fprintf(fp, "}},\"out\":{\"eax\":0,\"mem\":{");
      first = 1;
      write_mem_dwords(fp, &first, pPath + 0x30, path_buf + 0x30, 12);
      fprintf(fp, "}}}\n");
    }
  }

  /* 2. 0x6FD849D0: PATH_SetTargetPos113c(pPath, nTargetX, nTargetY) */
  {
    fn_path_set_target_pos_t fn = (fn_path_set_target_pos_t)0x6FD849D0u;
    for (int c = 0; c < 3; c++) {
      memset(path_buf, 0xAA, sizeof(path_buf));
      *(u32 *)(path_buf + 0x58) = 0xDEADBEEFu;
      u32 pPath = (c == 0) ? 0 : (u32)(uintptr_t)path_buf;
      s32 tx = (c == 1) ? 0x1234 : 0x12345678;
      s32 ty = (c == 1) ? 0x5678 : -17;
      fprintf(fp, "{\"va\":\"0x6fd849d0\",\"case\":%d,\"note\":\"set_target_pos_case_%d\",\"in\":{\"args\":[%u,%d,%d],\"mem\":{",
              c, c, pPath, tx, ty);
      int first = 1;
      if (pPath != 0) {
        write_mem_bytes(fp, &first, pPath + 0x0C, path_buf + 0x0C, 12);
        write_mem_dwords(fp, &first, pPath + 0x54, path_buf + 0x54, 12);
      }
      fn(pPath, tx, ty);
      fprintf(fp, "}},\"out\":{\"eax\":0,\"mem\":{");
      first = 1;
      if (pPath != 0) {
        write_mem_bytes(fp, &first, pPath + 0x0C, path_buf + 0x0C, 12);
        write_mem_dwords(fp, &first, pPath + 0x54, path_buf + 0x54, 12);
      }
      fprintf(fp, "}}}\n");
    }
  }

  /* 3. 0x6FD84A00: PATH_ClearNextRoom113c(pPath) */
  {
    fn_path_void_t fn = (fn_path_void_t)0x6FD84A00u;
    u32 vals[3] = { 0x11223344u, 0xFFFFFFFFu, 0x00000000u };
    for (int c = 0; c < 3; c++) {
      memset(path_buf, 0xAA, sizeof(path_buf));
      *(u32 *)(path_buf + 0x20) = vals[c];
      u32 pPath = (u32)(uintptr_t)path_buf;
      fprintf(fp, "{\"va\":\"0x6fd84a00\",\"case\":%d,\"note\":\"clear_next_room_%d\",\"in\":{\"args\":[%u],\"mem\":{",
              c, c, pPath);
      int first = 1;
      write_mem_dwords(fp, &first, pPath + 0x1C, path_buf + 0x1C, 12);
      fn(pPath);
      fprintf(fp, "}},\"out\":{\"eax\":0,\"mem\":{");
      first = 1;
      write_mem_dwords(fp, &first, pPath + 0x1C, path_buf + 0x1C, 12);
      fprintf(fp, "}}}\n");
    }
  }

  /* 4. 0x6FD84A10: PATH_GetNextRoom113c(pPath) */
  {
    fn_path_get_u32_t fn = (fn_path_get_u32_t)0x6FD84A10u;
    u32 vals[3] = { 0u, 0x05001234u, 0x89ABCDEFu };
    for (int c = 0; c < 3; c++) {
      memset(path_buf, 0xAA, sizeof(path_buf));
      *(u32 *)(path_buf + 0x20) = vals[c];
      u32 pPath = (u32)(uintptr_t)path_buf;
      fprintf(fp, "{\"va\":\"0x6fd84a10\",\"case\":%d,\"note\":\"get_next_room_%d\",\"in\":{\"args\":[%u],\"mem\":{",
              c, c, pPath);
      int first = 1;
      write_mem_dwords(fp, &first, pPath + 0x1C, path_buf + 0x1C, 12);
      u32 eax = fn(pPath);
      fprintf(fp, "}},\"out\":{\"eax\":%u,\"mem\":{}}}\n", eax);
    }
  }

  /* 5. 0x6FD84A40: PATH_GetLastPointY113c(pPath) & 6. 0x6FD84A60: PATH_GetLastPointX113c(pPath) */
  {
    fn_path_get_u32_t fnY = (fn_path_get_u32_t)0x6FD84A40u;
    fn_path_get_u32_t fnX = (fn_path_get_u32_t)0x6FD84A60u;
    u32 counts[4] = { 0, 1, 3, 5 };
    for (int which = 0; which < 2; which++) {
      const char *va = (which == 0) ? "0x6fd84a40" : "0x6fd84a60";
      for (int c = 0; c < 4; c++) {
        memset(path_buf, 0, sizeof(path_buf));
        *(u32 *)(path_buf + 0x28) = counts[c];
        for (int i = 0; i < 6; i++) {
          *(u16 *)(path_buf + 0x9C + i * 4 + 0) = (u16)(0x1100 + i * 0x11);
          *(u16 *)(path_buf + 0x9C + i * 4 + 2) = (u16)(0x8200 + i * 0x23);
        }
        u32 pPath = (u32)(uintptr_t)path_buf;
        fprintf(fp, "{\"va\":\"%s\",\"case\":%d,\"note\":\"count_%u\",\"in\":{\"args\":[%u],\"mem\":{",
                va, c, counts[c], pPath);
        int first = 1;
        write_dword_entry(fp, &first, pPath + 0x28, counts[c]);
        write_mem_dwords(fp, &first, pPath + 0x98, path_buf + 0x98, 28);
        u32 eax = (which == 0) ? fnY(pPath) : fnX(pPath);
        fprintf(fp, "}},\"out\":{\"eax\":%u,\"mem\":{}}}\n", eax);
      }
    }
  }

  /* 7..10: 0x6FD84A80 (+0x1A), 0x6FD84A90 (+0x18), 0x6FD84AA0 (+0x12), 0x6FD84AB0 (+0x10) */
  {
    u32 vas[4] = { 0x6FD84A80u, 0x6FD84A90u, 0x6FD84AA0u, 0x6FD84AB0u };
    const char *va_strs[4] = { "0x6fd84a80", "0x6fd84a90", "0x6fd84aa0", "0x6fd84ab0" };
    u32 offs[4] = { 0x1A, 0x18, 0x12, 0x10 };
    u16 vals[3] = { 0, 0x1234, 0xFEDC };
    for (int f = 0; f < 4; f++) {
      fn_path_get_u32_t fn = (fn_path_get_u32_t)vas[f];
      for (int c = 0; c < 3; c++) {
        memset(path_buf, 0xAA, sizeof(path_buf));
        *(u16 *)(path_buf + offs[f]) = vals[c];
        u32 pPath = (u32)(uintptr_t)path_buf;
        fprintf(fp, "{\"va\":\"%s\",\"case\":%d,\"note\":\"val_0x%04x\",\"in\":{\"args\":[%u],\"mem\":{",
                va_strs[f], c, vals[c], pPath);
        int first = 1;
        write_mem_bytes(fp, &first, pPath + 0x10, path_buf + 0x10, 16);
        u32 eax = fn(pPath);
        fprintf(fp, "}},\"out\":{\"eax\":%u,\"mem\":{}}}\n", eax);
      }
    }
  }

  /* 11. 0x6FD84BE0: PATH_ForceDirection113c(pPath, nDir) */
  {
    fn_path_set_u32_t fn = (fn_path_set_u32_t)0x6FD84BE0u;
    u32 dirs[4] = { 0, 15, 0x3F, 0xFF };
    for (int c = 0; c < 4; c++) {
      memset(path_buf, 0xAA, sizeof(path_buf));
      u32 pPath = (c == 0) ? 0 : (u32)(uintptr_t)path_buf;
      fprintf(fp, "{\"va\":\"0x6fd84be0\",\"case\":%d,\"note\":\"force_dir_case_%d\",\"in\":{\"args\":[%u,%u],\"mem\":{",
              c, c, pPath, dirs[c]);
      int first = 1;
      if (pPath != 0) write_mem_bytes(fp, &first, pPath + 0x60, path_buf + 0x60, 12);
      fn(pPath, dirs[c]);
      fprintf(fp, "}},\"out\":{\"eax\":0,\"mem\":{");
      first = 1;
      if (pPath != 0) write_mem_bytes(fp, &first, pPath + 0x60, path_buf + 0x60, 12);
      fprintf(fp, "}}}\n");
    }
  }

  /* 12. 0x6FD84C00: PATH_GetNewDirection113c(pPath) */
  {
    fn_path_get_u32_t fn = (fn_path_get_u32_t)0x6FD84C00u;
    u8 vals[3] = { 0, 31, 63 };
    for (int c = 0; c < 3; c++) {
      memset(path_buf, 0x55, sizeof(path_buf));
      path_buf[0x65] = vals[c];
      u32 pPath = (u32)(uintptr_t)path_buf;
      fprintf(fp, "{\"va\":\"0x6fd84c00\",\"case\":%d,\"note\":\"get_new_dir_%u\",\"in\":{\"args\":[%u],\"mem\":{",
              c, vals[c], pPath);
      int first = 1;
      write_mem_bytes(fp, &first, pPath + 0x60, path_buf + 0x60, 12);
      u32 eax = fn(pPath) & 0xFFu;
      fprintf(fp, "}},\"out\":{\"eax\":%u,\"mem\":{}}}\n", eax);
    }
  }

  /* 13. 0x6FD84C10: PATH_GetDirection113c(pPath) */
  {
    fn_path_get_u32_t fn = (fn_path_get_u32_t)0x6FD84C10u;
    u8 vals[4] = { 0, 0, 17, 63 };
    for (int c = 0; c < 4; c++) {
      memset(path_buf, 0x55, sizeof(path_buf));
      path_buf[0x64] = vals[c];
      u32 pPath = (c == 0) ? 0 : (u32)(uintptr_t)path_buf;
      fprintf(fp, "{\"va\":\"0x6fd84c10\",\"case\":%d,\"note\":\"get_dir_case_%d\",\"in\":{\"args\":[%u],\"mem\":{",
              c, c, pPath);
      int first = 1;
      if (pPath != 0) write_mem_bytes(fp, &first, pPath + 0x60, path_buf + 0x60, 12);
      u32 eax = fn(pPath) & 0xFFu;
      fprintf(fp, "}},\"out\":{\"eax\":%u,\"mem\":{}}}\n", eax);
    }
  }

  /* 14. 0x6FD84C30: PATH_GetPathPoints113c(pPath, ppPathPoints) */
  {
    fn_path_get_pts_t fn = (fn_path_get_pts_t)0x6FD84C30u;
    u32 counts[3] = { 0, 7, 42 };
    for (int c = 0; c < 3; c++) {
      memset(path_buf, 0xAA, sizeof(path_buf));
      *(u32 *)(path_buf + 0x28) = counts[c];
      out_ptr_cell[0] = 0xDEADBEEFu;
      out_ptr_cell[1] = 0xAAAAAAAAu;
      u32 pPath = (u32)(uintptr_t)path_buf;
      u32 ppPts = (u32)(uintptr_t)out_ptr_cell;
      fprintf(fp, "{\"va\":\"0x6fd84c30\",\"case\":%d,\"note\":\"get_path_points_%u\",\"in\":{\"args\":[%u,%u],\"mem\":{",
              c, counts[c], pPath, ppPts);
      int first = 1;
      write_dword_entry(fp, &first, pPath + 0x28, counts[c]);
      write_mem_dwords(fp, &first, ppPts, out_ptr_cell, sizeof(out_ptr_cell));
      u32 eax = fn(pPath, ppPts);
      fprintf(fp, "}},\"out\":{\"eax\":%u,\"mem\":{", eax);
      first = 1;
      write_mem_dwords(fp, &first, ppPts, out_ptr_cell, sizeof(out_ptr_cell));
      fprintf(fp, "}}}\n");
    }
  }

  /* 15. 0x6FD84C60: PATH_GetNumberOfPathPoints113c(pPath) */
  {
    fn_path_get_u32_t fn = (fn_path_get_u32_t)0x6FD84C60u;
    u32 counts[3] = { 0, 12, 77 };
    for (int c = 0; c < 3; c++) {
      memset(path_buf, 0xAA, sizeof(path_buf));
      *(u32 *)(path_buf + 0x28) = counts[c];
      u32 pPath = (u32)(uintptr_t)path_buf;
      fprintf(fp, "{\"va\":\"0x6fd84c60\",\"case\":%d,\"note\":\"get_num_pts_%u\",\"in\":{\"args\":[%u],\"mem\":{",
              c, counts[c], pPath);
      int first = 1;
      write_dword_entry(fp, &first, pPath + 0x28, counts[c]);
      u32 eax = fn(pPath);
      fprintf(fp, "}},\"out\":{\"eax\":%u,\"mem\":{}}}\n", eax);
    }
  }

  /* 16. 0x6FD84CB0: PATH_ClearPathPointsAndFlag0x20_113c(pPath) */
  {
    fn_path_void_t fn = (fn_path_void_t)0x6FD84CB0u;
    u32 flags[3] = { 0xFFFFFFFFu, 0x00000020u, 0x00000055u };
    for (int c = 0; c < 3; c++) {
      memset(path_buf, 0xAA, sizeof(path_buf));
      *(u32 *)(path_buf + 0x28) = (u32)(c + 5);
      *(u32 *)(path_buf + 0x34) = flags[c];
      u32 pPath = (u32)(uintptr_t)path_buf;
      fprintf(fp, "{\"va\":\"0x6fd84cb0\",\"case\":%d,\"note\":\"clear_pts_flag0x20_%d\",\"in\":{\"args\":[%u],\"mem\":{",
              c, c, pPath);
      int first = 1;
      write_mem_dwords(fp, &first, pPath + 0x24, path_buf + 0x24, 24);
      fn(pPath);
      fprintf(fp, "}},\"out\":{\"eax\":0,\"mem\":{");
      first = 1;
      write_mem_dwords(fp, &first, pPath + 0x24, path_buf + 0x24, 24);
      fprintf(fp, "}}}\n");
    }
  }

  /* 17. 0x6FD84CE0: PATH_SetAcceleration113c(pPath, nAcceleration) */
  /* 18. 0x6FD84D10: PATH_SetMaxVelocity113c(pPath, nMaxVelocity) */
  {
    fn_path_set_u32_t fnAcc = (fn_path_set_u32_t)0x6FD84CE0u;
    fn_path_set_u32_t fnVel = (fn_path_set_u32_t)0x6FD84D10u;
    u32 vals[3] = { 0, 256, 0x80001234u };
    for (int which = 0; which < 2; which++) {
      const char *va = (which == 0) ? "0x6fd84ce0" : "0x6fd84d10";
      for (int c = 0; c < 3; c++) {
        memset(path_buf, 0xAA, sizeof(path_buf));
        u32 pPath = (u32)(uintptr_t)path_buf;
        fprintf(fp, "{\"va\":\"%s\",\"case\":%d,\"note\":\"val_%u\",\"in\":{\"args\":[%u,%u],\"mem\":{",
                va, c, vals[c], pPath, vals[c]);
        int first = 1;
        write_mem_dwords(fp, &first, pPath + 0x80, path_buf + 0x80, 16);
        if (which == 0) fnAcc(pPath, vals[c]);
        else fnVel(pPath, vals[c]);
        fprintf(fp, "}},\"out\":{\"eax\":0,\"mem\":{");
        first = 1;
        write_mem_dwords(fp, &first, pPath + 0x80, path_buf + 0x80, 16);
        fprintf(fp, "}}}\n");
      }
    }
  }
}

int main(int argc, char **argv) {
  HMODULE hMod = LoadLibraryA("samples\\d2\\D2Common.dll");
  if (!hMod) {
    hMod = LoadLibraryA("D2Common.dll");
  }
  if (!hMod) {
    fprintf(stderr, "Failed to load D2Common.dll (err=%lu)\n", GetLastError());
    return 1;
  }
  if ((uintptr_t)hMod != 0x6FD50000u) {
    fprintf(stderr, "D2Common.dll loaded at unexpected base %p (expected 0x6FD50000)\n", (void *)hMod);
    return 1;
  }

  const char *p19 = (argc > 1) ? argv[1] : "tests\\fixtures\\oracle\\k1\\b019-vectors.ndjson";
  const char *p22 = (argc > 2) ? argv[2] : "tests\\fixtures\\oracle\\k1\\b022-vectors.ndjson";
  const char *p25 = (argc > 3) ? argv[3] : "tests\\fixtures\\oracle\\k1\\b025-vectors.ndjson";

  FILE *f19 = fopen(p19, "wb");
  FILE *f22 = fopen(p22, "wb");
  FILE *f25 = fopen(p25, "wb");
  if (!f19 || !f22 || !f25) {
    fprintf(stderr, "Failed to open output NDJSON files\n");
    return 1;
  }

  emit_b019(f19);
  emit_b022(f22);
  emit_b025(f25);

  fclose(f19);
  fclose(f22);
  fclose(f25);
  printf("Successfully emitted B019, B022, and B025 vectors from real D2Common.dll!\n");
  return 0;
}
