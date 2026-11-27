/*
 * Standalone MinGW real-DLL differential vector emitter for Lane A Iteration-1
 * batches B002 (17 functions, 0x6FD51000..0x6FD515B0) and B005 (18 functions,
 * 0x6FD6E360..0x6FD73C50).
 *
 * Loads the real Diablo II v1.13c Storm.dll, Fog.dll, and D2Common.dll at its
 * canonical image base 0x6FD50000, stages deterministic pre-call memory blocks
 * in a fixed VirtualAlloc arena at 0x20000000, invokes each real D2Common.dll
 * function entry point via exact x86 register/stack thunks, and records:
 *   - tests/fixtures/oracle/k1/laneA/b002-vectors.json
 *   - tests/fixtures/oracle/k1/laneA/b005-vectors.json
 *   - tests/fixtures/oracle/k1/laneA/b005-gfx-cache-vectors.json
 *   - tests/fixtures/oracle/k1/laneA/laneA-b002-b005.d2tv
 */
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include "vector-format.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#define ARENA_BASE        0x20000000u
#define ARENA_SIZE        0x00100000u

/* Deterministic layout within ARENA_BASE (0x20000000) */
#define ADDR_BITMASKS     0x20000100u /* 128 bytes (32 u32s from Fog gdwBitMasks) */
#define ADDR_SEED         0x20000200u /* 8 bytes: D2SeedStrc */
#define ADDR_FLAGS_BOX    0x20000220u /* 16 bytes: target dword for ITEMS_SetOrClearFlagMask */
#define ADDR_UNIT_A       0x20000300u /* 244 bytes: D2UnitStrc */
#define ADDR_UNIT_B       0x20000400u /* 244 bytes: D2UnitStrc */
#define ADDR_UNIT_C       0x20000500u /* 244 bytes: D2UnitStrc */
#define ADDR_PLAYERDATA   0x20000600u /* 364 bytes: D2PlayerDataStrc */
#define ADDR_INVENTORY    0x20000800u /* 64 bytes: D2InventoryStrc */
#define ADDR_GRID         0x20000880u /* 16 bytes: D2InventoryGridStrc */
#define ADDR_GRID_CELLS   0x20000900u /* 256 bytes: grid cell array (with pre/post padding) */
#define ADDR_ITEMDATA_A   0x20000A00u /* 116 bytes: D2ItemDataStrc for UNIT_A */
#define ADDR_ITEMDATA_B   0x20000B00u /* 116 bytes: D2ItemDataStrc for UNIT_B */
#define ADDR_ITEMDATA_C   0x20000C00u /* 116 bytes: D2ItemDataStrc for UNIT_C */
#define ADDR_STATLIST_EX  0x20000D00u /* 100 bytes: D2StatListExStrc */
#define ADDR_STATLIST_A   0x20000D80u /* 60 bytes: D2StatListStrc A */
#define ADDR_STATLIST_B   0x20000DC0u /* 60 bytes: D2StatListStrc B */
#define ADDR_STATLIST_C   0x20000E00u /* 60 bytes: D2StatListStrc C */
#define ADDR_CORPSE_A     0x20000E40u /* 16 bytes: D2CorpseStrc A */
#define ADDR_CORPSE_B     0x20000E60u /* 16 bytes: D2CorpseStrc B */
#define ADDR_NODE_A       0x20000E80u /* 8 bytes: D2InventoryNodeStrc A */
#define ADDR_NODE_B       0x20000E90u /* 8 bytes: D2InventoryNodeStrc B */
#define ADDR_NODE_C       0x20000EA0u /* 8 bytes: D2InventoryNodeStrc C */
#define ADDR_STATE_MASK_PLAYER  0x20000EC0u /* 24 bytes: 6 dwords for pPlayerStateMaskExp */
#define ADDR_STATE_MASK_MONSTER 0x20000EE0u /* 24 bytes: 6 dwords for pMonsterStateMaskExp */

#define ADDR_DATATABLES   0x20001000u /* 0xD00 bytes: synthetic D2DataTablesStrc */
#define ADDR_MONSTATS     0x20002000u /* 4 * 0x1A8 bytes */
#define ADDR_MONSTATS2    0x20003000u /* 4 * 0x134 bytes */
#define ADDR_MISSILES     0x20004000u /* 4 * 0x1A4 bytes */
#define ADDR_SKILLS       0x20005000u /* 5 * 0x23C bytes */
#define ADDR_SKILLDESC    0x20006000u /* 4 * 0x120 bytes */
#define ADDR_CHARSTATS    0x20007000u /* 7 * 0xC4 bytes */
#define ADDR_ITEMTYPES    0x20008000u /* 4 * 0xE4 bytes */
#define ADDR_ITYPE_EQUIV  0x20009000u /* 80 * 16 bytes (80 types x 4 dwords) */
#define ADDR_ITEMSTXT     0x20010000u /* 260 * 0x1A8 bytes */

/* Lane A Iteration-3 (B011 + B017) arena regions */
#define ADDR_HOVER_MSG    0x20020000u /* 272 bytes: D2HoverTextStrc */
#define ADDR_HOVER_DEST   0x20020200u /* 256 bytes: szDest buffer */
#define ADDR_WARP         0x20020400u /* 72 bytes: D2DrlgWarpStrc */
#define ADDR_ANIMSEQ      0x20020500u /* 48 bytes: 8 * D2AnimSeqTxt (6 bytes each) */
#define ADDR_ANIM_OUT     0x20020600u /* 16 bytes: 4 output dwords (mode, frame, dir, event) */
#define ADDR_OBJDATA      0x20020700u /* 56 bytes: D2ObjectDataStrc */
#define ADDR_OBJTXT       0x20020800u /* 448 bytes: D2ObjectsTxt */
#define ADDR_VERTEX_SRC   0x20020A00u /* 20 bytes: D2DrlgVertexStrc (src) */
#define ADDR_VERTEX_DST   0x20020A40u /* 20 bytes: D2DrlgVertexStrc (dst) */
#define ADDR_DRLG_LEVEL   0x20020B00u /* 560 bytes: D2DrlgLevelStrc */
#define ADDR_LEVELS_TXT   0x20021000u /* 4 * 0x220 bytes: D2LevelsTxt[0..3] */
#define ADDR_WP_OUT       0x20021900u /* 16 bytes: uint16_t output box */
#define ADDR_STAT_ARRAY   0x20022000u /* 64 bytes: D2StatStrc[8] */
#define ADDR_STAT_OUT     0x20022100u /* 64 bytes: D2StatStrc[8] output buffer */
#define ADDR_ACT          0x20022200u /* 96 bytes: D2ActStrc */
#define ADDR_DRLG         0x20022300u /* 1164 bytes: D2DrlgStrc */

/* D2Common.dll canonical VAs (ImageBase = 0x6FD50000) */
#define VA_SGPT_DATATABLES    0x6FDE9E1Cu
#define VA_GDWBITMASKS_IAT    0x6FDD90B0u
#define VA_WEAPON_CLASS_TABLE 0x6FDE3368u
#define VA_STATIC_GFX_TABLE   0x6FDED888u
#define VA_ITEMS_TXT_COUNT    0x6FDEFB94u
#define VA_ITEMS_TXT_PTR      0x6FDEFB98u
#define VA_GFX_CACHE          0x6FDF0BA8u
#define VA_GFX_CACHE_COUNT    0x6FDF13A0u
#define VA_GFX_INIT_FLAG      0x6FDF1488u

#pragma pack(push, 1)
typedef struct {
  uint32_t va;
  uint32_t case_idx;
  uint32_t out_eax;
  uint32_t post_hash;
} LaneAD2TVRecord;
#pragma pack(pop)

static LaneAD2TVRecord g_d2tv_records[512];
static uint32_t g_d2tv_count = 0;
static int g_record_d2tv = 1;

static uint32_t fnv1a32(const void *data, size_t len, uint32_t h) {
  const uint8_t *p = (const uint8_t *)data;
  for (size_t i = 0; i < len; i++) {
    h ^= p[i];
    h *= 16777619u;
  }
  return h;
}

typedef struct {
  uint32_t addr;
  uint32_t len;
  uint8_t *pre;
  uint8_t *post;
} MemBlockSnap;

/* Assembly thunks for D2Common custom and stdcall conventions */
static uint32_t call_eax_stack3_ret0c(uintptr_t fn, uint32_t eax_in, uint32_t a0, uint32_t a1, uint32_t a2) {
  uint32_t out;
  __asm__ volatile (
    "pushl %[a2]\n\t"
    "pushl %[a1]\n\t"
    "pushl %[a0]\n\t"
    "call *%[fn]\n\t"
    : "=a"(out)
    : "a"(eax_in), [a0]"r"(a0), [a1]"r"(a1), [a2]"r"(a2), [fn]"r"(fn)
    : "ecx", "edx", "memory", "cc"
  );
  return out;
}

static uint32_t call_ecx_esi(uintptr_t fn, uint32_t ecx_in, uint32_t esi_in) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "=a"(out), "+c"(ecx_in), "+S"(esi_in)
    : [fn]"r"(fn)
    : "edx", "memory", "cc"
  );
  return out;
}

static uint32_t call_eax(uintptr_t fn, uint32_t eax_in) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "=a"(out)
    : "a"(eax_in), [fn]"r"(fn)
    : "ecx", "edx", "memory", "cc"
  );
  return out;
}

static uint32_t call_eax_ecx(uintptr_t fn, uint32_t eax_in, uint32_t ecx_in) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "=a"(out), "+c"(ecx_in)
    : "a"(eax_in), [fn]"r"(fn)
    : "edx", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) uint32_t call_eax_ecx_stack3_ret0c(uintptr_t fn, uint32_t eax_in, uint32_t ecx_in, uint32_t s0, uint32_t s1, uint32_t s2) {
  uint32_t out;
  uint32_t stk[3] = { s0, s1, s2 };
  __asm__ volatile (
    "pushl 8(%[stk])\n\t"
    "pushl 4(%[stk])\n\t"
    "pushl 0(%[stk])\n\t"
    "call *%[fn]\n\t"
    : "=a"(out), "+c"(ecx_in)
    : "a"(eax_in), [stk]"S"(stk), [fn]"D"(fn)
    : "edx", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) uint32_t call_eax_ecx_edx_stack3_ret0c(uintptr_t fn, uint32_t eax_in, uint32_t ecx_in, uint32_t edx_in, uint32_t s0, uint32_t s1, uint32_t s2) {
  uint32_t out;
  uint32_t stk[3] = { s0, s1, s2 };
  __asm__ volatile (
    "pushl 8(%[stk])\n\t"
    "pushl 4(%[stk])\n\t"
    "pushl 0(%[stk])\n\t"
    "call *%[fn]\n\t"
    : "=a"(out), "+c"(ecx_in), "+d"(edx_in)
    : "a"(eax_in), [stk]"S"(stk), [fn]"D"(fn)
    : "memory", "cc"
  );
  return out;
}

static uint32_t call_ecx_edi_eax(uintptr_t fn, uint32_t ecx_in, uint32_t edi_in, uint32_t eax_in) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "=a"(out), "+c"(ecx_in), "+D"(edi_in)
    : "a"(eax_in), [fn]"r"(fn)
    : "edx", "memory", "cc"
  );
  return out;
}

static uint32_t call_eax_edx(uintptr_t fn, uint32_t eax_in, uint32_t edx_in) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "=a"(out), "+d"(edx_in)
    : "a"(eax_in), [fn]"r"(fn)
    : "ecx", "memory", "cc"
  );
  return out;
}

static uint32_t call_grid_rect(uintptr_t fn, uint32_t eax_grid, uint32_t ecx_y, uint32_t edx_w, uint32_t s0_x, uint32_t s1_h) {
  uint32_t out;
  __asm__ volatile (
    "pushl %[s1]\n\t"
    "pushl %[s0]\n\t"
    "call *%[fn]\n\t"
    : "=a"(out), "+c"(ecx_y), "+d"(edx_w)
    : "a"(eax_grid), [s0]"r"(s0_x), [s1]"r"(s1_h), [fn]"r"(fn)
    : "memory", "cc"
  );
  return out;
}

static uint32_t call_ecx_esi_stack1_ret4(uintptr_t fn, uint32_t ecx_item, uint32_t esi_grid, uint32_t s0_inv) {
  uint32_t out;
  __asm__ volatile (
    "pushl %[s0]\n\t"
    "call *%[fn]\n\t"
    : "=a"(out), "+c"(ecx_item), "+S"(esi_grid)
    : [s0]"r"(s0_inv), [fn]"r"(fn)
    : "edx", "memory", "cc"
  );
  return out;
}

static uint32_t call_edx_esi(uintptr_t fn, uint32_t edx_item, uint32_t esi_list) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "=a"(out), "+d"(edx_item), "+S"(esi_list)
    : [fn]"r"(fn)
    : "ecx", "memory", "cc"
  );
  return out;
}

static uint32_t call_edx(uintptr_t fn, uint32_t edx_in) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "=a"(out), "+d"(edx_in)
    : [fn]"r"(fn)
    : "ecx", "memory", "cc"
  );
  return out;
}

static uint32_t call_ecx(uintptr_t fn, uint32_t ecx_in) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "=a"(out), "+c"(ecx_in)
    : [fn]"r"(fn)
    : "edx", "memory", "cc"
  );
  return out;
}

static uint32_t call_ecx_edx(uintptr_t fn, uint32_t ecx_in, uint32_t edx_in) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "=a"(out), "+c"(ecx_in), "+d"(edx_in)
    : [fn]"r"(fn)
    : "memory", "cc"
  );
  return out;
}

static uint32_t call_ecx_edx_esi(uintptr_t fn, uint32_t ecx_in, uint32_t edx_in, uint32_t esi_in) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "=a"(out), "+c"(ecx_in), "+d"(edx_in), "+S"(esi_in)
    : [fn]"r"(fn)
    : "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) uint32_t call_eax_ebx_ecx_stack1_ret4(
  uintptr_t fn,
  uint32_t eax_in,
  uint32_t ebx_in,
  uint32_t ecx_in,
  uint32_t s0
) {
  uint32_t out;
  __asm__ volatile (
    "pushl %[s0]\n\t"
    "call *%[fn]\n\t"
    : "=a"(out), "+b"(ebx_in), "+c"(ecx_in)
    : "a"(eax_in), [s0]"r"(s0), [fn]"D"(fn)
    : "edx", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) uint32_t call_eax_ebx(uintptr_t fn, uint32_t eax_in, uint32_t ebx_in) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "=a"(out), "+b"(ebx_in)
    : "a"(eax_in), [fn]"D"(fn)
    : "ecx", "edx", "memory", "cc"
  );
  return out;
}

static uint32_t call_stdcall1(uintptr_t fn, uint32_t a0) {
  typedef uint32_t (__stdcall *Fn1)(uint32_t);
  return ((Fn1)fn)(a0);
}

static uint32_t call_stdcall2(uintptr_t fn, uint32_t a0, uint32_t a1) {
  typedef uint32_t (__stdcall *Fn2)(uint32_t, uint32_t);
  return ((Fn2)fn)(a0, a1);
}

static uint32_t call_stdcall3(uintptr_t fn, uint32_t a0, uint32_t a1, uint32_t a2) {
  typedef uint32_t (__stdcall *Fn3)(uint32_t, uint32_t, uint32_t);
  return ((Fn3)fn)(a0, a1, a2);
}

static uint32_t call_stdcall7(uintptr_t fn, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3, uint32_t a4, uint32_t a5, uint32_t a6) {
  typedef uint32_t (__stdcall *Fn7)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
  return ((Fn7)fn)(a0, a1, a2, a3, a4, a5, a6);
}

static uint32_t call_stdcall8(uintptr_t fn, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3, uint32_t a4, uint32_t a5, uint32_t a6, uint32_t a7) {
  typedef uint32_t (__stdcall *Fn8)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
  return ((Fn8)fn)(a0, a1, a2, a3, a4, a5, a6, a7);
}

static uint32_t call_void0(uintptr_t fn) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "=a"(out)
    : [fn]"r"(fn)
    : "ecx", "edx", "memory", "cc"
  );
  return out;
}

static void write_hex(FILE *fp, const uint8_t *buf, uint32_t len) {
  for (uint32_t i = 0; i < len; i++) {
    fprintf(fp, "%02x", buf[i]);
  }
}

typedef struct {
  uint32_t addr;
  uint32_t len;
} RangeSpec;

static void capture_pre(const RangeSpec *ranges, int n, uint8_t **pre_bufs) {
  for (int i = 0; i < n; i++) {
    pre_bufs[i] = (uint8_t *)malloc(ranges[i].len);
    memcpy(pre_bufs[i], (const void *)(uintptr_t)ranges[i].addr, ranges[i].len);
  }
}

static void emit_case_json(
  FILE *fp,
  int *first_case,
  uint32_t va,
  const char *name,
  const char *case_id,
  const char *compare_mode,
  uint32_t eax_in,
  uint32_t ecx_in,
  uint32_t edx_in,
  uint32_t esi_in,
  uint32_t edi_in,
  const uint32_t *stack_args,
  int n_stack,
  uint32_t out_eax,
  const RangeSpec *ranges,
  int n_ranges,
  uint8_t **pre_bufs
) {
  if (!*first_case) {
    fprintf(fp, ",\n");
  }
  *first_case = 0;

  fprintf(fp, "    {\n");
  fprintf(fp, "      \"va\": \"0x%08X\",\n", va);
  fprintf(fp, "      \"name\": \"%s\",\n", name);
  fprintf(fp, "      \"caseId\": \"%s\",\n", case_id);
  fprintf(fp, "      \"compareMode\": \"%s\",\n", compare_mode);
  fprintf(fp, "      \"regs\": { \"eax\": %u, \"ecx\": %u, \"edx\": %u, \"esi\": %u, \"edi\": %u },\n",
          eax_in, ecx_in, edx_in, esi_in, edi_in);
  fprintf(fp, "      \"stack\": [");
  for (int i = 0; i < n_stack; i++) {
    fprintf(fp, "%s%u", i > 0 ? ", " : "", stack_args[i]);
  }
  fprintf(fp, "],\n");
  fprintf(fp, "      \"outEax\": %u,\n", strcmp(compare_mode, "void") == 0 ? 0u : out_eax);

  fprintf(fp, "      \"preBlocks\": [\n");
  for (int i = 0; i < n_ranges; i++) {
    fprintf(fp, "        { \"addr\": \"0x%08X\", \"hex\": \"", ranges[i].addr);
    write_hex(fp, pre_bufs[i], ranges[i].len);
    fprintf(fp, "\" }%s\n", (i + 1 < n_ranges) ? "," : "");
  }
  fprintf(fp, "      ],\n");

  uint32_t h = 2166136261u;
  fprintf(fp, "      \"postBlocks\": [\n");
  for (int i = 0; i < n_ranges; i++) {
    const uint8_t *post_ptr = (const uint8_t *)(uintptr_t)ranges[i].addr;
    h = fnv1a32(post_ptr, ranges[i].len, h);
    fprintf(fp, "        { \"addr\": \"0x%08X\", \"hex\": \"", ranges[i].addr);
    write_hex(fp, post_ptr, ranges[i].len);
    fprintf(fp, "\" }%s\n", (i + 1 < n_ranges) ? "," : "");
    free(pre_bufs[i]);
  }
  fprintf(fp, "      ]\n");
  fprintf(fp, "    }");

  if (g_record_d2tv && g_d2tv_count < 512) {
    g_d2tv_records[g_d2tv_count].va = va;
    g_d2tv_records[g_d2tv_count].case_idx = g_d2tv_count;
    g_d2tv_records[g_d2tv_count].out_eax = (strcmp(compare_mode, "void") == 0) ? 0u :
                                           (strcmp(compare_mode, "al") == 0 ? (out_eax & 0xFFu) : out_eax);
    g_d2tv_records[g_d2tv_count].post_hash = h;
    g_d2tv_count++;
  }
}

static inline void w32(uint32_t addr, uint32_t val) {
  *(uint32_t *)(uintptr_t)addr = val;
}
static inline void w16(uint32_t addr, uint16_t val) {
  *(uint16_t *)(uintptr_t)addr = val;
}
static inline void w8(uint32_t addr, uint8_t val) {
  *(uint8_t *)(uintptr_t)addr = val;
}

static void setup_synthetic_datatables(void) {
  memset((void *)(uintptr_t)ADDR_DATATABLES, 0, 0xD00);
  memset((void *)(uintptr_t)ADDR_MONSTATS, 0, 4 * 0x1A8);
  memset((void *)(uintptr_t)ADDR_MONSTATS2, 0, 4 * 0x134);
  memset((void *)(uintptr_t)ADDR_MISSILES, 0, 4 * 0x1A4);
  memset((void *)(uintptr_t)ADDR_SKILLS, 0, 5 * 0x23C);
  memset((void *)(uintptr_t)ADDR_SKILLDESC, 0, 4 * 0x120);
  memset((void *)(uintptr_t)ADDR_CHARSTATS, 0, 7 * 0xC4);
  memset((void *)(uintptr_t)ADDR_ITEMTYPES, 0, 4 * 0xE4);

  w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);

  w32(ADDR_DATATABLES + 0xA78, ADDR_MONSTATS);
  w32(ADDR_DATATABLES + 0xA80, 4u);
  w32(ADDR_DATATABLES + 0xA90, ADDR_MONSTATS2);
  w32(ADDR_DATATABLES + 0xA98, 3u);
  w32(ADDR_DATATABLES + 0xB64, ADDR_MISSILES);
  w32(ADDR_DATATABLES + 0xB6C, 4u);
  w32(ADDR_DATATABLES + 0xB8C, ADDR_SKILLDESC);
  w32(ADDR_DATATABLES + 0xB94, 3u);
  w32(ADDR_DATATABLES + 0xB98, ADDR_SKILLS);
  w32(ADDR_DATATABLES + 0xBA0, 5u);
  w32(ADDR_DATATABLES + 0xBC4, ADDR_CHARSTATS);
  w32(ADDR_DATATABLES + 0xBC8, 7u);
  w32(ADDR_DATATABLES + 0xBF8, ADDR_ITEMTYPES);
  w32(ADDR_DATATABLES + 0xBFC, 4u);

  /* MonStats[0..3].wMonStatsEx (+0x18): 0 -> 0, 1 -> 2, 2 -> -1 (0xFFFF), 3 -> 3 (out of bounds for count=3) */
  w16(ADDR_MONSTATS + 0 * 0x1A8 + 0x18, 0);
  w16(ADDR_MONSTATS + 1 * 0x1A8 + 0x18, 2);
  w16(ADDR_MONSTATS + 2 * 0x1A8 + 0x18, 0xFFFFu);
  w16(ADDR_MONSTATS + 3 * 0x1A8 + 0x18, 3);

  /* MonStats2[0] and MonStats2[2] flags (+0x04) and modeFlags (+0xF0) */
  /* Also populate bytes just before +0x04 and +0xF0 so negative bit/mode indices in [-8, -1] read deterministic bytes */
  w8(ADDR_MONSTATS2 + 0 * 0x134 + 0x03, 0x81u);
  w32(ADDR_MONSTATS2 + 0 * 0x134 + 0x04, 0xA55A0F12u);
  w8(ADDR_MONSTATS2 + 0 * 0x134 + 0xEF, 0x42u);
  w32(ADDR_MONSTATS2 + 0 * 0x134 + 0xF0, 0x800105AAu);

  w8(ADDR_MONSTATS2 + 2 * 0x134 + 0x03, 0xFFu);
  w32(ADDR_MONSTATS2 + 2 * 0x134 + 0x04, 0x80000001u);
  w8(ADDR_MONSTATS2 + 2 * 0x134 + 0xEF, 0x18u);
  w32(ADDR_MONSTATS2 + 2 * 0x134 + 0xF0, 0x00FF00FFu);

  /* Skills[0..4]: wMaxLvl (+0x12C), dwParam1..3 (+0x148..+0x150), wSkillDesc (+0x194) */
  w16(ADDR_SKILLS + 0 * 0x23C + 0x12C, 0);       /* <= 0 -> default 20 */
  w32(ADDR_SKILLS + 0 * 0x23C + 0x148, 100u);
  w32(ADDR_SKILLS + 0 * 0x23C + 0x14C, 200u);
  w32(ADDR_SKILLS + 0 * 0x23C + 0x150, 300u);
  w16(ADDR_SKILLS + 0 * 0x23C + 0x194, 0);

  w16(ADDR_SKILLS + 1 * 0x23C + 0x12C, 0xFFFFu); /* -1 <= 0 -> default 20 */
  w32(ADDR_SKILLS + 1 * 0x23C + 0x148, 0xFFFFFFFFu);
  w32(ADDR_SKILLS + 1 * 0x23C + 0x14C, 0x80000000u);
  w32(ADDR_SKILLS + 1 * 0x23C + 0x150, 0x7FFFFFFFu);
  w16(ADDR_SKILLS + 1 * 0x23C + 0x194, 2);

  w16(ADDR_SKILLS + 2 * 0x23C + 0x12C, 1);       /* > 0 -> 1 */
  w32(ADDR_SKILLS + 2 * 0x23C + 0x148, 0u);
  w32(ADDR_SKILLS + 2 * 0x23C + 0x14C, 42u);
  w32(ADDR_SKILLS + 2 * 0x23C + 0x150, 99u);
  w16(ADDR_SKILLS + 2 * 0x23C + 0x194, 0xFFFFu); /* -1 -> 0 */

  w16(ADDR_SKILLS + 3 * 0x23C + 0x12C, 30);      /* > 0 -> 30 */
  w16(ADDR_SKILLS + 3 * 0x23C + 0x194, 3);       /* == count(3) -> 0 */

  w16(ADDR_SKILLS + 4 * 0x23C + 0x12C, 0x7FFFu); /* 32767 */
  w16(ADDR_SKILLS + 4 * 0x23C + 0x194, 1);
}

static void emit_b002(FILE *fp) {
  int first = 1;
  uint8_t *pre[8];

  /* 1. 0x6FD51000 PLAYER_SetPlayerData150Params */
  {
    const uint32_t va = 0x6FD51000u;
    const char *nm = "PLAYER_SetPlayerData150Params";
    RangeSpec r[2] = { { ADDR_UNIT_A, 244 }, { ADDR_PLAYERDATA, 364 } };

    /* Case 1: NULL unit */
    memset((void *)ADDR_UNIT_A, 0, 244);
    memset((void *)ADDR_PLAYERDATA, 0xCC, 364);
    uint32_t s1[3] = { 11u, 22u, 33u };
    capture_pre(r, 2, pre);
    uint32_t eax = call_eax_stack3_ret0c(va, 0u, s1[0], s1[1], s1[2]);
    emit_case_json(fp, &first, va, nm, "null_unit", "void", 0u, 0, 0, 0, 0, s1, 3, eax, r, 2, pre);

    /* Case 2: Non-player unit (dwUnitType = 1) */
    memset((void *)ADDR_UNIT_A, 0, 244);
    memset((void *)ADDR_PLAYERDATA, 0, 364);
    w32(ADDR_UNIT_A + 0x00, 1u);
    w32(ADDR_UNIT_A + 0x14, ADDR_PLAYERDATA);
    capture_pre(r, 2, pre);
    eax = call_eax_stack3_ret0c(va, ADDR_UNIT_A, s1[0], s1[1], s1[2]);
    emit_case_json(fp, &first, va, nm, "monster_unit_noop", "void", ADDR_UNIT_A, 0, 0, 0, 0, s1, 3, eax, r, 2, pre);

    /* Case 3: Player unit with NULL pUnitData */
    memset((void *)ADDR_UNIT_A, 0, 244);
    memset((void *)ADDR_PLAYERDATA, 0, 364);
    w32(ADDR_UNIT_A + 0x00, 0u);
    w32(ADDR_UNIT_A + 0x14, 0u);
    capture_pre(r, 2, pre);
    eax = call_eax_stack3_ret0c(va, ADDR_UNIT_A, s1[0], s1[1], s1[2]);
    emit_case_json(fp, &first, va, nm, "null_playerdata_noop", "void", ADDR_UNIT_A, 0, 0, 0, 0, s1, 3, eax, r, 2, pre);

    /* Case 4: Valid player unit with extreme args (0, 0xFFFFFFFF, 0x80000000) */
    memset((void *)ADDR_UNIT_A, 0, 244);
    memset((void *)ADDR_PLAYERDATA, 0, 364);
    w32(ADDR_UNIT_A + 0x00, 0u);
    w32(ADDR_UNIT_A + 0x14, ADDR_PLAYERDATA);
    uint32_t s4[3] = { 0u, 0xFFFFFFFFu, 0x80000000u };
    capture_pre(r, 2, pre);
    eax = call_eax_stack3_ret0c(va, ADDR_UNIT_A, s4[0], s4[1], s4[2]);
    emit_case_json(fp, &first, va, nm, "valid_player_extremes", "void", ADDR_UNIT_A, 0, 0, 0, 0, s4, 3, eax, r, 2, pre);

    /* Case 5: Valid player unit with positive args */
    memset((void *)ADDR_PLAYERDATA, 0xAA, 364);
    uint32_t s5[3] = { 0x7FFFFFFFu, 42u, 999u };
    capture_pre(r, 2, pre);
    eax = call_eax_stack3_ret0c(va, ADDR_UNIT_A, s5[0], s5[1], s5[2]);
    emit_case_json(fp, &first, va, nm, "valid_player_overwrite", "void", ADDR_UNIT_A, 0, 0, 0, 0, s5, 3, eax, r, 2, pre);
  }

  /* 2. 0x6FD51100 SEED_RollRandomNumberInline */
  {
    const uint32_t va = 0x6FD51100u;
    const char *nm = "SEED_RollRandomNumberInline";
    RangeSpec r[1] = { { ADDR_SEED, 8 } };
    const uint32_t maxes[8] = { 0u, 0xFFFFFFFFu, 0x80000000u, 1u, 2u, 8u, 3u, 0x7FFFFFFFu };
    const char *cids[8] = { "max_zero", "max_neg1", "max_intmin", "max_one_pow2", "max_two_pow2", "max_eight_pow2", "max_three_div", "max_intmax_div" };
    for (int i = 0; i < 8; i++) {
      w32(ADDR_SEED + 0, (i == 7) ? 0xFFFFFFFFu : (0x12345678u + i * 17u));
      w32(ADDR_SEED + 4, (i == 7) ? 0xFFFFFFFFu : (0x9ABCDEF0u + i * 31u));
      capture_pre(r, 1, pre);
      uint32_t eax = call_ecx_esi(va, ADDR_SEED, maxes[i]);
      emit_case_json(fp, &first, va, nm, cids[i], "eax", 0, ADDR_SEED, 0, maxes[i], 0, NULL, 0, eax, r, 1, pre);
    }
  }

  /* 3. 0x6FD51150 DATATBLS_GetMissilesTxtRecordInline */
  setup_synthetic_datatables();
  {
    const uint32_t va = 0x6FD51150u;
    const char *nm = "DATATBLS_GetMissilesTxtRecordInline";
    RangeSpec r[2] = { { VA_SGPT_DATATABLES, 4 }, { ADDR_DATATABLES + 0xB60, 0x10 } };
    const uint32_t ids[6] = { 0xFFFFFFFFu, 0x80000000u, 0u, 3u, 4u, 0x7FFFFFFFu };
    const char *cids[6] = { "id_neg1", "id_intmin", "id_zero", "id_last", "id_count_oob", "id_intmax" };
    for (int i = 0; i < 6; i++) {
      capture_pre(r, 2, pre);
      uint32_t eax = call_eax(va, ids[i]);
      emit_case_json(fp, &first, va, nm, cids[i], "eax", ids[i], 0, 0, 0, 0, NULL, 0, eax, r, 2, pre);
    }
  }

  /* 4. 0x6FD51180 SEED_RollLimitedRandomNumberInline */
  {
    const uint32_t va = 0x6FD51180u;
    const char *nm = "SEED_RollLimitedRandomNumberInline";
    RangeSpec r[1] = { { ADDR_SEED, 8 } };
    struct { uint32_t min; uint32_t max; const char *id; } cases[8] = {
      { 10u, 10u, "min_eq_max" },
      { 20u, 5u, "min_gt_max" },
      { 0x80000000u, 0x7FFFFFFFu, "overflow_range_zero" },
      { 0xFFFFFFFFu, 0x7FFFFFFFu, "overflow_range_neg" },
      { 0u, 1u, "range_2_pow2" },
      { 0u, 3u, "range_4_pow2" },
      { 5u, 12u, "range_8_pow2" },
      { (uint32_t)-10, (uint32_t)-4, "neg_bounds_range_7_div" }
    };
    for (int i = 0; i < 8; i++) {
      w32(ADDR_SEED + 0, 0xCAFEBABEu + i * 101u);
      w32(ADDR_SEED + 4, 0x0BADF00Du + i * 257u);
      capture_pre(r, 1, pre);
      uint32_t eax = call_ecx_edi_eax(va, ADDR_SEED, cases[i].min, cases[i].max);
      emit_case_json(fp, &first, va, nm, cases[i].id, "eax", cases[i].max, ADDR_SEED, 0, 0, cases[i].min, NULL, 0, eax, r, 1, pre);
    }
  }

  /* 5. 0x6FD51250 DATATBLS_GetSkillsTxtRecordInline */
  setup_synthetic_datatables();
  {
    const uint32_t va = 0x6FD51250u;
    const char *nm = "DATATBLS_GetSkillsTxtRecordInline";
    RangeSpec r[2] = { { VA_SGPT_DATATABLES, 4 }, { ADDR_DATATABLES + 0xB98, 0x10 } };
    const uint32_t ids[6] = { 0xFFFFFFFFu, 0x80000000u, 0u, 4u, 5u, 0x7FFFFFFFu };
    const char *cids[6] = { "id_neg1", "id_intmin", "id_zero", "id_last", "id_count_oob", "id_intmax" };
    for (int i = 0; i < 6; i++) {
      capture_pre(r, 2, pre);
      uint32_t eax = call_eax(va, ids[i]);
      emit_case_json(fp, &first, va, nm, cids[i], "eax", ids[i], 0, 0, 0, 0, NULL, 0, eax, r, 2, pre);
    }
  }

  /* 6. 0x6FD51280 DATATBLS_ValidateMonStatsIdInline */
  {
    const uint32_t va = 0x6FD51280u;
    const char *nm = "DATATBLS_ValidateMonStatsIdInline";
    RangeSpec r[2] = { { VA_SGPT_DATATABLES, 4 }, { ADDR_DATATABLES + 0xA78, 0x10 } };
    const uint32_t ids[6] = { 0xFFFFFFFFu, 0x80000000u, 0u, 3u, 4u, 0x7FFFFFFFu };
    const char *cids[6] = { "id_neg1", "id_intmin", "id_zero", "id_last", "id_count_oob", "id_intmax" };
    for (int i = 0; i < 6; i++) {
      capture_pre(r, 2, pre);
      uint32_t eax = call_eax(va, ids[i]);
      emit_case_json(fp, &first, va, nm, cids[i], "eax", ids[i], 0, 0, 0, 0, NULL, 0, eax, r, 2, pre);
    }
  }

  /* 7. 0x6FD512A0 DATATBLS_GetMonStatsTxtRecordInline */
  {
    const uint32_t va = 0x6FD512A0u;
    const char *nm = "DATATBLS_GetMonStatsTxtRecordInline";
    RangeSpec r[2] = { { VA_SGPT_DATATABLES, 4 }, { ADDR_DATATABLES + 0xA78, 0x10 } };
    const uint32_t ids[6] = { 0xFFFFFFFFu, 0x80000000u, 0u, 3u, 4u, 0x7FFFFFFFu };
    const char *cids[6] = { "id_neg1", "id_intmin", "id_zero", "id_last", "id_count_oob", "id_intmax" };
    for (int i = 0; i < 6; i++) {
      capture_pre(r, 2, pre);
      uint32_t eax = call_eax(va, ids[i]);
      emit_case_json(fp, &first, va, nm, cids[i], "eax", ids[i], 0, 0, 0, 0, NULL, 0, eax, r, 2, pre);
    }
  }

  /* 8. 0x6FD512D0 DATATBLS_GetCharStatsTxtRecordInline */
  {
    const uint32_t va = 0x6FD512D0u;
    const char *nm = "DATATBLS_GetCharStatsTxtRecordInline";
    RangeSpec r[2] = { { VA_SGPT_DATATABLES, 4 }, { ADDR_DATATABLES + 0xBC0, 0x10 } };
    const uint32_t ids[6] = { 0xFFFFFFFFu, 0x80000000u, 0u, 6u, 7u, 0x7FFFFFFFu };
    const char *cids[6] = { "id_neg1", "id_intmin", "id_zero", "id_last", "id_count_oob", "id_intmax" };
    for (int i = 0; i < 6; i++) {
      capture_pre(r, 2, pre);
      uint32_t eax = call_eax(va, ids[i]);
      emit_case_json(fp, &first, va, nm, cids[i], "eax", ids[i], 0, 0, 0, 0, NULL, 0, eax, r, 2, pre);
    }
  }

  /* 9. 0x6FD51300 DATATBLS_GetItemTypesTxtRecordInline */
  {
    const uint32_t va = 0x6FD51300u;
    const char *nm = "DATATBLS_GetItemTypesTxtRecordInline";
    RangeSpec r[2] = { { VA_SGPT_DATATABLES, 4 }, { ADDR_DATATABLES + 0xBF8, 0x10 } };
    const uint32_t ids[6] = { 0xFFFFFFFFu, 0x80000000u, 0u, 3u, 4u, 0x7FFFFFFFu };
    const char *cids[6] = { "id_neg1", "id_intmin", "id_zero", "id_last", "id_count_oob", "id_intmax" };
    for (int i = 0; i < 6; i++) {
      capture_pre(r, 2, pre);
      uint32_t eax = call_eax(va, ids[i]);
      emit_case_json(fp, &first, va, nm, cids[i], "eax", ids[i], 0, 0, 0, 0, NULL, 0, eax, r, 2, pre);
    }
  }

  /* 10. 0x6FD513B0 DATATBLS_GetMonStats2TxtRecordFromMonStatsIdInline */
  {
    const uint32_t va = 0x6FD513B0u;
    const char *nm = "DATATBLS_GetMonStats2TxtRecordFromMonStatsIdInline";
    RangeSpec r[3] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES + 0xA78, 0x28 },
      { ADDR_MONSTATS, 4 * 0x1A8 }
    };
    const uint32_t ids[6] = { 0xFFFFFFFFu, 0u, 1u, 2u, 3u, 4u };
    const char *cids[6] = { "id_neg1", "id0_ex0_ok", "id1_ex2_ok", "id2_ex_neg1", "id3_ex3_oob", "id4_monstats_oob" };
    for (int i = 0; i < 6; i++) {
      capture_pre(r, 3, pre);
      uint32_t eax = call_eax(va, ids[i]);
      emit_case_json(fp, &first, va, nm, cids[i], "eax", ids[i], 0, 0, 0, 0, NULL, 0, eax, r, 3, pre);
    }
  }

  /* 11. 0x6FD51400 DATATBLS_CheckMonStats2ModeFlagInline */
  {
    const uint32_t va = 0x6FD51400u;
    const char *nm = "DATATBLS_CheckMonStats2ModeFlagInline";
    RangeSpec r[6] = {
      { VA_SGPT_DATATABLES, 4 },
      { VA_GDWBITMASKS_IAT, 4 },
      { ADDR_BITMASKS, 128 },
      { ADDR_DATATABLES + 0xA78, 0x28 },
      { ADDR_MONSTATS, 4 * 0x1A8 },
      { ADDR_MONSTATS2, 3 * 0x134 }
    };
    struct { uint32_t id; uint32_t mode; const char *cid; } cases[7] = {
      { 0xFFFFFFFFu, 1u, "id_neg1" },
      { 2u, 1u, "ex_neg1_null_rec" },
      { 0u, 0u, "id0_mode0_clear" },
      { 0u, 1u, "id0_mode1_set_mask2" },
      { 0u, 8u, "id0_mode8_set_mask1" },
      { 0u, 31u, "id0_mode31_set_mask128" },
      { 0u, (uint32_t)-7, "id0_mode_neg7_sar" }
    };
    for (int i = 0; i < 7; i++) {
      capture_pre(r, 6, pre);
      uint32_t eax = call_eax_edx(va, cases[i].id, cases[i].mode);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", cases[i].id, 0, cases[i].mode, 0, 0, NULL, 0, eax, r, 6, pre);
    }
  }

  /* 12. 0x6FD51470 DATATBLS_CheckMonStats2FlagInline */
  {
    const uint32_t va = 0x6FD51470u;
    const char *nm = "DATATBLS_CheckMonStats2FlagInline";
    RangeSpec r[6] = {
      { VA_SGPT_DATATABLES, 4 },
      { VA_GDWBITMASKS_IAT, 4 },
      { ADDR_BITMASKS, 128 },
      { ADDR_DATATABLES + 0xA78, 0x28 },
      { ADDR_MONSTATS, 4 * 0x1A8 },
      { ADDR_MONSTATS2, 3 * 0x134 }
    };
    struct { uint32_t id; uint32_t flag; const char *cid; } cases[7] = {
      { 0xFFFFFFFFu, 0u, "id_neg1" },
      { 3u, 0u, "ex_oob_null_rec" },
      { 0u, 1u, "id0_flag1_set_mask2" },
      { 0u, 2u, "id0_flag2_clear" },
      { 1u, 0u, "id1_ex2_flag0_set" },
      { 1u, 31u, "id1_ex2_flag31_set" },
      { 0u, (uint32_t)-1, "id0_flag_neg1_sar" }
    };
    for (int i = 0; i < 7; i++) {
      capture_pre(r, 6, pre);
      uint32_t eax = call_eax_edx(va, cases[i].id, cases[i].flag);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", cases[i].id, 0, cases[i].flag, 0, 0, NULL, 0, eax, r, 6, pre);
    }
  }

  /* 13. 0x6FD514D0 DATATBLS_GetSkillsTxtMaxLvlInline */
  {
    const uint32_t va = 0x6FD514D0u;
    const char *nm = "DATATBLS_GetSkillsTxtMaxLvlInline";
    RangeSpec r[3] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES + 0xB98, 0x10 },
      { ADDR_SKILLS, 5 * 0x23C }
    };
    const uint32_t ids[7] = { 0xFFFFFFFFu, 5u, 0u, 1u, 2u, 3u, 4u };
    const char *cids[7] = { "id_neg1_def20", "id_oob_def20", "w_zero_def20", "w_neg1_def20", "w_one", "w_thirty", "w_int16max" };
    for (int i = 0; i < 7; i++) {
      capture_pre(r, 3, pre);
      uint32_t eax = call_eax(va, ids[i]);
      emit_case_json(fp, &first, va, nm, cids[i], "eax", ids[i], 0, 0, 0, 0, NULL, 0, eax, r, 3, pre);
    }
  }

  /* 14. 0x6FD51500 DATATBLS_GetSkillDescTxtRecordFromSkillIdInline */
  {
    const uint32_t va = 0x6FD51500u;
    const char *nm = "DATATBLS_GetSkillDescTxtRecordFromSkillIdInline";
    RangeSpec r[3] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES + 0xB8C, 0x18 },
      { ADDR_SKILLS, 5 * 0x23C }
    };
    const uint32_t ids[6] = { 0xFFFFFFFFu, 5u, 0u, 1u, 2u, 3u };
    const char *cids[6] = { "id_neg1", "id_oob", "id0_desc0", "id1_desc2", "id2_desc_neg1", "id3_desc_oob" };
    for (int i = 0; i < 6; i++) {
      capture_pre(r, 3, pre);
      uint32_t eax = call_eax(va, ids[i]);
      emit_case_json(fp, &first, va, nm, cids[i], "eax", ids[i], 0, 0, 0, 0, NULL, 0, eax, r, 3, pre);
    }
  }

  /* 15..17. 0x6FD51550 / 0x6FD51580 / 0x6FD515B0 DATATBLS_GetSkillsTxtParam1/2/3Inline */
  {
    const uint32_t vas[3] = { 0x6FD51550u, 0x6FD51580u, 0x6FD515B0u };
    const char *nms[3] = {
      "DATATBLS_GetSkillsTxtParam1Inline",
      "DATATBLS_GetSkillsTxtParam2Inline",
      "DATATBLS_GetSkillsTxtParam3Inline"
    };
    RangeSpec r[3] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES + 0xB98, 0x10 },
      { ADDR_SKILLS, 5 * 0x23C }
    };
    const uint32_t ids[5] = { 0xFFFFFFFFu, 5u, 0u, 1u, 2u };
    const char *cids[5] = { "id_neg1", "id_oob", "id0_pos", "id1_extremes", "id2_mixed" };
    for (int f = 0; f < 3; f++) {
      for (int i = 0; i < 5; i++) {
        capture_pre(r, 3, pre);
        uint32_t eax = call_eax(vas[f], ids[i]);
        emit_case_json(fp, &first, vas[f], nms[f], cids[i], "eax", ids[i], 0, 0, 0, 0, NULL, 0, eax, r, 3, pre);
      }
    }
  }
}

static void init_item_unit(uint32_t unit_addr, uint32_t itemdata_addr, uint32_t owner_inv) {
  memset((void *)(uintptr_t)unit_addr, 0, 244);
  memset((void *)(uintptr_t)itemdata_addr, 0, 116);
  w32(unit_addr + 0x00, 4u); /* UNIT_ITEM */
  w32(unit_addr + 0x14, itemdata_addr);
  w32(itemdata_addr + 0x5C, owner_inv);
}

static void emit_b005_leaves(FILE *fp) {
  int first = 1;
  uint8_t *pre[8];

  /* 1. 0x6FD6E360 INVENTORY_IsGridRectEmpty */
  {
    const uint32_t va = 0x6FD6E360u;
    const char *nm = "INVENTORY_IsGridRectEmpty";
    RangeSpec r[2] = { { ADDR_GRID, 16 }, { ADDR_GRID_CELLS, 256 } };
    memset((void *)(uintptr_t)ADDR_GRID, 0, 16);
    memset((void *)(uintptr_t)ADDR_GRID_CELLS, 0, 256);
    /* Place grid base at ADDR_GRID_CELLS + 64 so negative x/y still land inside ADDR_GRID_CELLS */
    uint32_t pp_items = ADDR_GRID_CELLS + 64u;
    w8(ADDR_GRID + 0x08, 4u); /* nGridWidth = 4 */
    w32(ADDR_GRID + 0x0C, pp_items);

    struct { uint32_t y; uint32_t w; uint32_t x; uint32_t h; int occ_cell; const char *cid; } cases[7] = {
      { 0u, 2u, 0u, 0u, -1, "height_zero_empty" },
      { 0u, 0u, 0u, 2u, -1, "width_zero_empty" },
      { 0u, 2u, 0u, 2u, -1, "rect_2x2_all_empty" },
      { 0u, 2u, 0u, 2u, 0,  "rect_2x2_top_left_occupied" },
      { 0u, 2u, 0u, 2u, 5,  "rect_2x2_bottom_right_occupied" },
      { 0u, 2u, 0u, 2u, 6,  "rect_2x2_outside_occupied_still_empty" },
      { (uint32_t)-1, 2u, (uint32_t)-1, 2u, -5, "negative_xy_occupied" }
    };
    for (int i = 0; i < 7; i++) {
      memset((void *)(uintptr_t)ADDR_GRID_CELLS, 0, 256);
      if (cases[i].occ_cell != -1) {
        w32((uint32_t)((int32_t)pp_items + cases[i].occ_cell * 4), ADDR_UNIT_A);
      }
      uint32_t st[2] = { cases[i].x, cases[i].h };
      capture_pre(r, 2, pre);
      uint32_t eax = call_grid_rect(va, ADDR_GRID, cases[i].y, cases[i].w, cases[i].x, cases[i].h);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", ADDR_GRID, cases[i].y, cases[i].w, 0, 0, st, 2, eax, r, 2, pre);
    }
  }

  /* 2. 0x6FD6E400 INVENTORY_UnitIsItem */
  {
    const uint32_t va = 0x6FD6E400u;
    const char *nm = "INVENTORY_UnitIsItem";
    RangeSpec r[1] = { { ADDR_UNIT_A, 244 } };
    uint32_t types[5] = { 0u, 1u, 4u, 5u, 0xFFFFFFFFu };
    const char *cids[5] = { "type_player", "type_monster", "type_item_match", "type_tile", "type_neg1" };
    /* NULL case */
    memset((void *)(uintptr_t)ADDR_UNIT_A, 0, 244);
    uint32_t st0[1] = { 0u };
    capture_pre(r, 1, pre);
    uint32_t eax0 = call_stdcall1(va, 0u);
    emit_case_json(fp, &first, va, nm, "null_unit", "eax", 0, 0, 0, 0, 0, st0, 1, eax0, r, 1, pre);
    for (int i = 0; i < 5; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT_A, 0, 244);
      w32(ADDR_UNIT_A + 0x00, types[i]);
      uint32_t st[1] = { ADDR_UNIT_A };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, ADDR_UNIT_A);
      emit_case_json(fp, &first, va, nm, cids[i], "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 1, pre);
    }
  }

  /* 3. 0x6FD6E790 INVENTORY_GetItemExtraData */
  {
    const uint32_t va = 0x6FD6E790u;
    const char *nm = "INVENTORY_GetItemExtraData";
    RangeSpec r[2] = { { ADDR_UNIT_A, 244 }, { ADDR_ITEMDATA_A, 116 } };
    /* NULL */
    init_item_unit(ADDR_UNIT_A, ADDR_ITEMDATA_A, 0u);
    capture_pre(r, 2, pre);
    uint32_t eax = call_eax(va, 0u);
    emit_case_json(fp, &first, va, nm, "null_unit", "eax", 0u, 0, 0, 0, 0, NULL, 0, eax, r, 2, pre);
    /* Non-item */
    w32(ADDR_UNIT_A + 0x00, 1u);
    capture_pre(r, 2, pre);
    eax = call_eax(va, ADDR_UNIT_A);
    emit_case_json(fp, &first, va, nm, "non_item_unit", "eax", ADDR_UNIT_A, 0, 0, 0, 0, NULL, 0, eax, r, 2, pre);
    /* NULL pItemData */
    w32(ADDR_UNIT_A + 0x00, 4u);
    w32(ADDR_UNIT_A + 0x14, 0u);
    capture_pre(r, 2, pre);
    eax = call_eax(va, ADDR_UNIT_A);
    emit_case_json(fp, &first, va, nm, "null_itemdata", "eax", ADDR_UNIT_A, 0, 0, 0, 0, NULL, 0, eax, r, 2, pre);
    /* Valid item */
    w32(ADDR_UNIT_A + 0x14, ADDR_ITEMDATA_A);
    capture_pre(r, 2, pre);
    eax = call_eax(va, ADDR_UNIT_A);
    emit_case_json(fp, &first, va, nm, "valid_item", "eax", ADDR_UNIT_A, 0, 0, 0, 0, NULL, 0, eax, r, 2, pre);
  }

  /* 4. 0x6FD6E880 INVENTORY_GetItemIfOwnedByInventory */
  {
    const uint32_t va = 0x6FD6E880u;
    const char *nm = "INVENTORY_GetItemIfOwnedByInventory";
    RangeSpec r[2] = { { ADDR_UNIT_A, 244 }, { ADDR_ITEMDATA_A, 116 } };
    init_item_unit(ADDR_UNIT_A, ADDR_ITEMDATA_A, ADDR_INVENTORY);

    struct { uint32_t inv; uint32_t item; uint32_t utype; uint32_t idata; uint32_t owner; const char *cid; } cases[6] = {
      { 0u, ADDR_UNIT_A, 4u, ADDR_ITEMDATA_A, ADDR_INVENTORY, "null_inventory" },
      { ADDR_INVENTORY, 0u, 4u, ADDR_ITEMDATA_A, ADDR_INVENTORY, "null_item" },
      { ADDR_INVENTORY, ADDR_UNIT_A, 0u, ADDR_ITEMDATA_A, ADDR_INVENTORY, "non_item_unit" },
      { ADDR_INVENTORY, ADDR_UNIT_A, 4u, 0u, ADDR_INVENTORY, "null_itemdata" },
      { ADDR_INVENTORY, ADDR_UNIT_A, 4u, ADDR_ITEMDATA_A, ADDR_INVENTORY + 4u, "owner_mismatch" },
      { ADDR_INVENTORY, ADDR_UNIT_A, 4u, ADDR_ITEMDATA_A, ADDR_INVENTORY, "owner_match" }
    };
    for (int i = 0; i < 6; i++) {
      w32(ADDR_UNIT_A + 0x00, cases[i].utype);
      w32(ADDR_UNIT_A + 0x14, cases[i].idata);
      w32(ADDR_ITEMDATA_A + 0x5C, cases[i].owner);
      uint32_t st[2] = { cases[i].inv, cases[i].item };
      capture_pre(r, 2, pre);
      uint32_t eax = call_stdcall2(va, cases[i].inv, cases[i].item);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 2, eax, r, 2, pre);
    }
  }

  /* 5. 0x6FD6E8C0 INVENTORY_GetItemNodePositionOther */
  {
    const uint32_t va = 0x6FD6E8C0u;
    const char *nm = "INVENTORY_GetItemNodePositionOther";
    RangeSpec r[2] = { { ADDR_UNIT_A, 244 }, { ADDR_ITEMDATA_A, 116 } };
    init_item_unit(ADDR_UNIT_A, ADDR_ITEMDATA_A, ADDR_INVENTORY);
    uint32_t st0[1] = { 0u };
    capture_pre(r, 2, pre);
    uint32_t eax0 = call_stdcall1(va, 0u);
    emit_case_json(fp, &first, va, nm, "null_item", "eax", 0, 0, 0, 0, 0, st0, 1, eax0, r, 2, pre);

    uint8_t bytes[4] = { 0x00u, 0x7Fu, 0x80u, 0xFFu };
    const char *cids[4] = { "byte_0x00", "byte_0x7f_pos", "byte_0x80_neg128", "byte_0xff_neg1" };
    for (int i = 0; i < 4; i++) {
      w8(ADDR_ITEMDATA_A + 0x5C + 0x0D, bytes[i]);
      uint32_t st[1] = { ADDR_UNIT_A };
      capture_pre(r, 2, pre);
      uint32_t eax = call_stdcall1(va, ADDR_UNIT_A);
      emit_case_json(fp, &first, va, nm, cids[i], "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 2, pre);
    }
  }

  /* 6. 0x6FD6E8F0 INVENTORY_GetNextItem */
  {
    const uint32_t va = 0x6FD6E8F0u;
    const char *nm = "INVENTORY_GetNextItem";
    RangeSpec r[2] = { { ADDR_UNIT_A, 244 }, { ADDR_ITEMDATA_A, 116 } };
    init_item_unit(ADDR_UNIT_A, ADDR_ITEMDATA_A, ADDR_INVENTORY);
    uint32_t st0[1] = { 0u };
    capture_pre(r, 2, pre);
    uint32_t eax0 = call_stdcall1(va, 0u);
    emit_case_json(fp, &first, va, nm, "null_item", "eax", 0, 0, 0, 0, 0, st0, 1, eax0, r, 2, pre);

    uint32_t nexts[3] = { 0u, ADDR_UNIT_B, 0xDEADBEEFu };
    const char *cids[3] = { "next_null", "next_unit_b", "next_sentinel" };
    for (int i = 0; i < 3; i++) {
      w32(ADDR_ITEMDATA_A + 0x5C + 0x08, nexts[i]);
      uint32_t st[1] = { ADDR_UNIT_A };
      capture_pre(r, 2, pre);
      uint32_t eax = call_stdcall1(va, ADDR_UNIT_A);
      emit_case_json(fp, &first, va, nm, cids[i], "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 2, pre);
    }
  }

  /* 7. 0x6FD6F630 INVENTORY_LinkItemToGridList */
  {
    const uint32_t va = 0x6FD6F630u;
    const char *nm = "INVENTORY_LinkItemToGridList";
    RangeSpec r[5] = {
      { ADDR_GRID, 16 },
      { ADDR_UNIT_A, 244 },
      { ADDR_ITEMDATA_A, 116 },
      { ADDR_UNIT_B, 244 },
      { ADDR_ITEMDATA_B, 116 }
    };

    /* Case 1: Empty grid list -> sets pFirstItem and pLastItem to UNIT_A */
    memset((void *)(uintptr_t)ADDR_GRID, 0, 16);
    init_item_unit(ADDR_UNIT_A, ADDR_ITEMDATA_A, ADDR_INVENTORY);
    init_item_unit(ADDR_UNIT_B, ADDR_ITEMDATA_B, ADDR_INVENTORY);
    uint32_t st[1] = { ADDR_INVENTORY };
    capture_pre(r, 5, pre);
    uint32_t eax = call_ecx_esi_stack1_ret4(va, ADDR_UNIT_A, ADDR_GRID, ADDR_INVENTORY);
    emit_case_json(fp, &first, va, nm, "empty_grid_list", "void", 0, ADDR_UNIT_A, 0, ADDR_GRID, 0, st, 1, eax, r, 5, pre);

    /* Case 2: Append second item UNIT_B to non-empty grid list (tail = UNIT_A) */
    capture_pre(r, 5, pre);
    eax = call_ecx_esi_stack1_ret4(va, ADDR_UNIT_B, ADDR_GRID, ADDR_INVENTORY);
    emit_case_json(fp, &first, va, nm, "append_second_item", "void", 0, ADDR_UNIT_B, 0, ADDR_GRID, 0, st, 1, eax, r, 5, pre);

    /* Case 3: Owner inventory mismatch -> no-op */
    uint32_t st_bad[1] = { ADDR_INVENTORY + 4u };
    capture_pre(r, 5, pre);
    eax = call_ecx_esi_stack1_ret4(va, ADDR_UNIT_A, ADDR_GRID, ADDR_INVENTORY + 4u);
    emit_case_json(fp, &first, va, nm, "owner_mismatch_noop", "void", 0, ADDR_UNIT_A, 0, ADDR_GRID, 0, st_bad, 1, eax, r, 5, pre);

    /* Case 4: Tail is a non-item unit (dwUnitType != 4) -> updates pPrevGridItem & pLastItem without writing tail extra */
    memset((void *)(uintptr_t)ADDR_GRID, 0, 16);
    init_item_unit(ADDR_UNIT_A, ADDR_ITEMDATA_A, ADDR_INVENTORY);
    init_item_unit(ADDR_UNIT_B, ADDR_ITEMDATA_B, ADDR_INVENTORY);
    w32(ADDR_UNIT_A + 0x00, 1u); /* non-item tail */
    w32(ADDR_GRID + 0x00, ADDR_UNIT_A);
    w32(ADDR_GRID + 0x04, ADDR_UNIT_A);
    capture_pre(r, 5, pre);
    eax = call_ecx_esi_stack1_ret4(va, ADDR_UNIT_B, ADDR_GRID, ADDR_INVENTORY);
    emit_case_json(fp, &first, va, nm, "non_item_tail_edge", "void", 0, ADDR_UNIT_B, 0, ADDR_GRID, 0, st, 1, eax, r, 5, pre);
  }

  /* 8. 0x6FD6F690 INVENTORY_LinkItemToInventoryList */
  {
    const uint32_t va = 0x6FD6F690u;
    const char *nm = "INVENTORY_LinkItemToInventoryList";
    RangeSpec r[5] = {
      { ADDR_INVENTORY, 64 },
      { ADDR_UNIT_A, 244 },
      { ADDR_ITEMDATA_A, 116 },
      { ADDR_UNIT_B, 244 },
      { ADDR_ITEMDATA_B, 116 }
    };

    /* Case 1: Empty inventory list */
    memset((void *)(uintptr_t)ADDR_INVENTORY, 0, 64);
    init_item_unit(ADDR_UNIT_A, ADDR_ITEMDATA_A, 0u);
    init_item_unit(ADDR_UNIT_B, ADDR_ITEMDATA_B, 0u);
    capture_pre(r, 5, pre);
    uint32_t eax = call_ecx_esi(va, ADDR_UNIT_A, ADDR_INVENTORY);
    emit_case_json(fp, &first, va, nm, "empty_inv_list", "void", 0, ADDR_UNIT_A, 0, ADDR_INVENTORY, 0, NULL, 0, eax, r, 5, pre);

    /* Case 2: Append second item UNIT_B */
    capture_pre(r, 5, pre);
    eax = call_ecx_esi(va, ADDR_UNIT_B, ADDR_INVENTORY);
    emit_case_json(fp, &first, va, nm, "append_second_item", "void", 0, ADDR_UNIT_B, 0, ADDR_INVENTORY, 0, NULL, 0, eax, r, 5, pre);

    /* Case 3: NULL item -> no-op */
    capture_pre(r, 5, pre);
    eax = call_ecx_esi(va, 0u, ADDR_INVENTORY);
    emit_case_json(fp, &first, va, nm, "null_item_noop", "void", 0, 0u, 0, ADDR_INVENTORY, 0, NULL, 0, eax, r, 5, pre);

    /* Case 4: Non-item tail */
    memset((void *)(uintptr_t)ADDR_INVENTORY, 0, 64);
    init_item_unit(ADDR_UNIT_A, ADDR_ITEMDATA_A, 0u);
    init_item_unit(ADDR_UNIT_B, ADDR_ITEMDATA_B, 0u);
    w32(ADDR_UNIT_A + 0x00, 1u);
    w32(ADDR_INVENTORY + 0x0C, ADDR_UNIT_A);
    w32(ADDR_INVENTORY + 0x10, ADDR_UNIT_A);
    capture_pre(r, 5, pre);
    eax = call_ecx_esi(va, ADDR_UNIT_B, ADDR_INVENTORY);
    emit_case_json(fp, &first, va, nm, "non_item_tail_edge", "void", 0, ADDR_UNIT_B, 0, ADDR_INVENTORY, 0, NULL, 0, eax, r, 5, pre);
  }

  /* 9. 0x6FD6F6E0 INVENTORY_IsItemOwnedByInventory */
  {
    const uint32_t va = 0x6FD6F6E0u;
    const char *nm = "INVENTORY_IsItemOwnedByInventory";
    RangeSpec r[2] = { { ADDR_UNIT_A, 244 }, { ADDR_ITEMDATA_A, 116 } };
    init_item_unit(ADDR_UNIT_A, ADDR_ITEMDATA_A, ADDR_INVENTORY);

    struct { uint32_t inv; uint32_t item; uint32_t utype; uint32_t owner; const char *cid; } cases[5] = {
      { 0u, ADDR_UNIT_A, 4u, ADDR_INVENTORY, "null_inventory" },
      { ADDR_INVENTORY, 0u, 4u, ADDR_INVENTORY, "null_item" },
      { ADDR_INVENTORY, ADDR_UNIT_A, 1u, ADDR_INVENTORY, "non_item" },
      { ADDR_INVENTORY, ADDR_UNIT_A, 4u, ADDR_INVENTORY + 4u, "owner_mismatch_0" },
      { ADDR_INVENTORY, ADDR_UNIT_A, 4u, ADDR_INVENTORY, "owner_match_1" }
    };
    for (int i = 0; i < 5; i++) {
      w32(ADDR_UNIT_A + 0x00, cases[i].utype);
      w32(ADDR_ITEMDATA_A + 0x5C, cases[i].owner);
      uint32_t st[2] = { cases[i].inv, cases[i].item };
      capture_pre(r, 2, pre);
      uint32_t eax = call_stdcall2(va, cases[i].inv, cases[i].item);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 2, eax, r, 2, pre);
    }
  }

  /* 10. 0x6FD6F8F0 INVENTORY_UnlinkItemFromList */
  {
    const uint32_t va = 0x6FD6F8F0u;
    const char *nm = "INVENTORY_UnlinkItemFromList";
    const uint32_t hdr = ADDR_INVENTORY + 0x0Cu;
    RangeSpec r[7] = {
      { ADDR_INVENTORY, 64 },
      { ADDR_UNIT_A, 244 },
      { ADDR_ITEMDATA_A, 116 },
      { ADDR_UNIT_B, 244 },
      { ADDR_ITEMDATA_B, 116 },
      { ADDR_UNIT_C, 244 },
      { ADDR_ITEMDATA_C, 116 }
    };

    /* Build a 3-item list A <-> B <-> C using INVENTORY_LinkItemToInventoryList (0x6FD6F690), then unlink middle (B), head (A), and only/tail (C) */
    memset((void *)(uintptr_t)ADDR_INVENTORY, 0, 64);
    init_item_unit(ADDR_UNIT_A, ADDR_ITEMDATA_A, ADDR_INVENTORY);
    init_item_unit(ADDR_UNIT_B, ADDR_ITEMDATA_B, ADDR_INVENTORY);
    init_item_unit(ADDR_UNIT_C, ADDR_ITEMDATA_C, ADDR_INVENTORY);
    call_ecx_esi(0x6FD6F690u, ADDR_UNIT_A, ADDR_INVENTORY);
    call_ecx_esi(0x6FD6F690u, ADDR_UNIT_B, ADDR_INVENTORY);
    call_ecx_esi(0x6FD6F690u, ADDR_UNIT_C, ADDR_INVENTORY);

    /* Case 1: Unlink middle item B */
    capture_pre(r, 7, pre);
    uint32_t eax = call_edx_esi(va, ADDR_UNIT_B, hdr);
    emit_case_json(fp, &first, va, nm, "unlink_middle_item", "void", 0, 0, ADDR_UNIT_B, hdr, 0, NULL, 0, eax, r, 7, pre);

    /* Case 2: Unlink head item A (leaving C) */
    capture_pre(r, 7, pre);
    eax = call_edx_esi(va, ADDR_UNIT_A, hdr);
    emit_case_json(fp, &first, va, nm, "unlink_head_item", "void", 0, 0, ADDR_UNIT_A, hdr, 0, NULL, 0, eax, r, 7, pre);

    /* Case 3: Unlink sole remaining item C (list becomes empty) */
    capture_pre(r, 7, pre);
    eax = call_edx_esi(va, ADDR_UNIT_C, hdr);
    emit_case_json(fp, &first, va, nm, "unlink_only_item", "void", 0, 0, ADDR_UNIT_C, hdr, 0, NULL, 0, eax, r, 7, pre);

    /* Case 4: Unlink tail item from 2-element list A <-> B */
    call_ecx_esi(0x6FD6F690u, ADDR_UNIT_A, ADDR_INVENTORY);
    call_ecx_esi(0x6FD6F690u, ADDR_UNIT_B, ADDR_INVENTORY);
    capture_pre(r, 7, pre);
    eax = call_edx_esi(va, ADDR_UNIT_B, hdr);
    emit_case_json(fp, &first, va, nm, "unlink_tail_item", "void", 0, 0, ADDR_UNIT_B, hdr, 0, NULL, 0, eax, r, 7, pre);

    /* Case 5: NULL pItem -> no-op */
    capture_pre(r, 7, pre);
    eax = call_edx_esi(va, 0u, hdr);
    emit_case_json(fp, &first, va, nm, "null_item_noop", "void", 0, 0, 0u, hdr, 0, NULL, 0, eax, r, 7, pre);

    /* Case 6: Non-item pItem (dwUnitType != 4) -> no-op */
    init_item_unit(ADDR_UNIT_A, ADDR_ITEMDATA_A, ADDR_INVENTORY);
    w32(ADDR_UNIT_A + 0x00, 1u);
    capture_pre(r, 7, pre);
    eax = call_edx_esi(va, ADDR_UNIT_A, hdr);
    emit_case_json(fp, &first, va, nm, "non_item_unit_noop", "void", 0, 0, ADDR_UNIT_A, hdr, 0, NULL, 0, eax, r, 7, pre);

    /* Case 7: Item with pItemData == 0 -> no-op */
    init_item_unit(ADDR_UNIT_A, ADDR_ITEMDATA_A, ADDR_INVENTORY);
    w32(ADDR_UNIT_A + 0x14, 0u);
    capture_pre(r, 7, pre);
    eax = call_edx_esi(va, ADDR_UNIT_A, hdr);
    emit_case_json(fp, &first, va, nm, "null_itemdata_noop", "void", 0, 0, ADDR_UNIT_A, hdr, 0, NULL, 0, eax, r, 7, pre);

    /* Case 8: pPrev == 0 and pNext == 0, but head/tail pointers in hdr do NOT match pItem */
    memset((void *)(uintptr_t)ADDR_INVENTORY, 0, 64);
    init_item_unit(ADDR_UNIT_A, ADDR_ITEMDATA_A, ADDR_INVENTORY);
    init_item_unit(ADDR_UNIT_B, ADDR_ITEMDATA_B, ADDR_INVENTORY);
    init_item_unit(ADDR_UNIT_C, ADDR_ITEMDATA_C, ADDR_INVENTORY);
    w32(hdr + 0x00, ADDR_UNIT_B); /* pFirstItem != UNIT_A */
    w32(hdr + 0x04, ADDR_UNIT_C); /* pLastItem != UNIT_A */
    w32(ADDR_ITEMDATA_A + 0x5C + 0x04, 0u); /* pPrevItem = 0 */
    w32(ADDR_ITEMDATA_A + 0x5C + 0x08, 0u); /* pNextItem = 0 */
    capture_pre(r, 7, pre);
    eax = call_edx_esi(va, ADDR_UNIT_A, hdr);
    emit_case_json(fp, &first, va, nm, "head_and_tail_mismatch_preserves_hdr", "void", 0, 0, ADDR_UNIT_A, hdr, 0, NULL, 0, eax, r, 7, pre);

    /* Case 9: Middle item B where pPrev (A) is non-item (dwUnitType = 1) and pNext (C) has pItemData == 0 */
    memset((void *)(uintptr_t)ADDR_INVENTORY, 0, 64);
    init_item_unit(ADDR_UNIT_A, ADDR_ITEMDATA_A, ADDR_INVENTORY);
    init_item_unit(ADDR_UNIT_B, ADDR_ITEMDATA_B, ADDR_INVENTORY);
    init_item_unit(ADDR_UNIT_C, ADDR_ITEMDATA_C, ADDR_INVENTORY);
    call_ecx_esi(0x6FD6F690u, ADDR_UNIT_A, ADDR_INVENTORY);
    call_ecx_esi(0x6FD6F690u, ADDR_UNIT_B, ADDR_INVENTORY);
    call_ecx_esi(0x6FD6F690u, ADDR_UNIT_C, ADDR_INVENTORY);
    w32(ADDR_UNIT_A + 0x00, 1u); /* pPrev is non-item */
    w32(ADDR_UNIT_C + 0x14, 0u); /* pNext has NULL pItemData */
    capture_pre(r, 7, pre);
    eax = call_edx_esi(va, ADDR_UNIT_B, hdr);
    emit_case_json(fp, &first, va, nm, "prev_non_item_and_next_null_itemdata", "void", 0, 0, ADDR_UNIT_B, hdr, 0, NULL, 0, eax, r, 7, pre);

    /* Case 10: Middle item B where pPrev (A) has pItemData == 0 and pNext (C) is non-item (dwUnitType = 1) */
    memset((void *)(uintptr_t)ADDR_INVENTORY, 0, 64);
    init_item_unit(ADDR_UNIT_A, ADDR_ITEMDATA_A, ADDR_INVENTORY);
    init_item_unit(ADDR_UNIT_B, ADDR_ITEMDATA_B, ADDR_INVENTORY);
    init_item_unit(ADDR_UNIT_C, ADDR_ITEMDATA_C, ADDR_INVENTORY);
    call_ecx_esi(0x6FD6F690u, ADDR_UNIT_A, ADDR_INVENTORY);
    call_ecx_esi(0x6FD6F690u, ADDR_UNIT_B, ADDR_INVENTORY);
    call_ecx_esi(0x6FD6F690u, ADDR_UNIT_C, ADDR_INVENTORY);
    w32(ADDR_UNIT_A + 0x14, 0u); /* pPrev has NULL pItemData */
    w32(ADDR_UNIT_C + 0x00, 1u); /* pNext is non-item */
    capture_pre(r, 7, pre);
    eax = call_edx_esi(va, ADDR_UNIT_B, hdr);
    emit_case_json(fp, &first, va, nm, "prev_null_itemdata_and_next_non_item", "void", 0, 0, ADDR_UNIT_B, hdr, 0, NULL, 0, eax, r, 7, pre);
  }

  /* 11. 0x6FD71F60 ITEMS_NoOpReturnZero */
  {
    const uint32_t va = 0x6FD71F60u;
    const char *nm = "ITEMS_NoOpReturnZero";
    RangeSpec r[1] = { { ADDR_FLAGS_BOX, 16 } };
    memset((void *)(uintptr_t)ADDR_FLAGS_BOX, 0, 16);
    uint32_t pairs[3][2] = { { 0u, 0u }, { 0xFFFFFFFFu, 0x80000000u }, { ADDR_UNIT_A, 12345u } };
    const char *cids[3] = { "zeros", "extremes", "ptr_and_val" };
    for (int i = 0; i < 3; i++) {
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall2(va, pairs[i][0], pairs[i][1]);
      emit_case_json(fp, &first, va, nm, cids[i], "eax", 0, 0, 0, 0, 0, pairs[i], 2, eax, r, 1, pre);
    }
  }

  /* 12. 0x6FD71FB0 ITEMS_SetOrClearFlagMask */
  {
    const uint32_t va = 0x6FD71FB0u;
    const char *nm = "ITEMS_SetOrClearFlagMask";
    RangeSpec r[1] = { { ADDR_FLAGS_BOX, 16 } };
    memset((void *)(uintptr_t)ADDR_FLAGS_BOX, 0, 16);
    struct { uint32_t init; uint32_t mask; uint32_t bset; const char *cid; } cases[5] = {
      { 0x00000000u, 0x00000010u, 1u, "set_single_bit" },
      { 0x12345678u, 0x80000001u, 0x80000000u, "set_highbit_bset" },
      { 0xFFFFFFFFu, 0x00000010u, 0u, "clear_single_bit" },
      { 0xA5A5A5A5u, 0xFFFFFFFFu, 0u, "clear_all_bits" },
      { 0x00000000u, 0xFFFFFFFFu, 1u, "set_all_bits" }
    };
    for (int i = 0; i < 5; i++) {
      w32(ADDR_FLAGS_BOX, cases[i].init);
      uint32_t st[3] = { ADDR_FLAGS_BOX, cases[i].mask, cases[i].bset };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall3(va, ADDR_FLAGS_BOX, cases[i].mask, cases[i].bset);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 3, eax, r, 1, pre);
    }
  }

  /* 13. 0x6FD71FE0 ITEMS_TestFlagMask */
  {
    const uint32_t va = 0x6FD71FE0u;
    const char *nm = "ITEMS_TestFlagMask";
    RangeSpec r[1] = { { ADDR_FLAGS_BOX, 16 } };
    uint32_t pairs[5][2] = {
      { 0u, 0xFFFFFFFFu },
      { 0xFFFFFFFFu, 0x80000001u },
      { 0xA5A5A5A5u, 0x5A5A5A5Au },
      { 0x80000000u, 0x80000000u },
      { 0x12345678u, 0x0000FF00u }
    };
    const char *cids[5] = { "zero_and_all", "all_and_edges", "disjoint_masks", "high_bit", "middle_byte" };
    for (int i = 0; i < 5; i++) {
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall2(va, pairs[i][0], pairs[i][1]);
      emit_case_json(fp, &first, va, nm, cids[i], "eax", 0, 0, 0, 0, 0, pairs[i], 2, eax, r, 1, pre);
    }
  }

  /* 14 & 15. 0x6FD72210 ITEMS_ApplyClassManaPotionScale & 0x6FD72260 ITEMS_ApplyClassLifePotionScale */
  {
    const uint32_t vas[2] = { 0x6FD72210u, 0x6FD72260u };
    const char *nms[2] = { "ITEMS_ApplyClassManaPotionScale", "ITEMS_ApplyClassLifePotionScale" };
    RangeSpec r[1] = { { ADDR_UNIT_A, 244 } };

    for (int f = 0; f < 2; f++) {
      /* NULL unit */
      memset((void *)(uintptr_t)ADDR_UNIT_A, 0, 244);
      uint32_t st_null[2] = { 0u, 100u };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall2(vas[f], 0u, 100u);
      emit_case_json(fp, &first, vas[f], nms[f], "null_unit", "eax", 0, 0, 0, 0, 0, st_null, 2, eax, r, 1, pre);

      /* Monster unit (dwUnitType = 1) */
      w32(ADDR_UNIT_A + 0x00, 1u);
      w32(ADDR_UNIT_A + 0x04, 0u);
      uint32_t st_mon[2] = { ADDR_UNIT_A, 100u };
      capture_pre(r, 1, pre);
      eax = call_stdcall2(vas[f], ADDR_UNIT_A, 100u);
      emit_case_json(fp, &first, vas[f], nms[f], "monster_unit", "eax", 0, 0, 0, 0, 0, st_mon, 2, eax, r, 1, pre);

      /* Player classes 0..7 and 0xFFFFFFFF with positive & negative values */
      uint32_t classes[9] = { 0u, 1u, 2u, 3u, 4u, 5u, 6u, 7u, 0xFFFFFFFFu };
      int32_t vals[9] = { 101, 100, -15, 0x40000000, -3, 77, 1, 50, 0x7FFFFFFF };
      const char *cids[9] = {
        "class0_ama_odd", "class1_sor", "class2_nec_neg", "class3_pal_large",
        "class4_bar_neg_odd", "class5_dru", "class6_ass_one", "class7_oob", "class_neg1_oob"
      };
      w32(ADDR_UNIT_A + 0x00, 0u);
      for (int i = 0; i < 9; i++) {
        w32(ADDR_UNIT_A + 0x04, classes[i]);
        uint32_t st[2] = { ADDR_UNIT_A, (uint32_t)vals[i] };
        capture_pre(r, 1, pre);
        eax = call_stdcall2(vas[f], ADDR_UNIT_A, (uint32_t)vals[i]);
        emit_case_json(fp, &first, vas[f], nms[f], cids[i], "eax", 0, 0, 0, 0, 0, st, 2, eax, r, 1, pre);
      }
    }
  }

  /* 16. 0x6FD737A0 ITEMS_SetInvPage */
  {
    const uint32_t va = 0x6FD737A0u;
    const char *nm = "ITEMS_SetInvPage";
    RangeSpec r[2] = { { ADDR_UNIT_A, 244 }, { ADDR_ITEMDATA_A, 116 } };
    init_item_unit(ADDR_UNIT_A, ADDR_ITEMDATA_A, ADDR_INVENTORY);

    /* NULL unit */
    uint32_t st0[2] = { 0u, 3u };
    capture_pre(r, 2, pre);
    uint32_t eax = call_stdcall2(va, 0u, 3u);
    emit_case_json(fp, &first, va, nm, "null_item", "void", 0, 0, 0, 0, 0, st0, 2, eax, r, 2, pre);

    /* Non-item */
    w32(ADDR_UNIT_A + 0x00, 1u);
    uint32_t st1[2] = { ADDR_UNIT_A, 3u };
    capture_pre(r, 2, pre);
    eax = call_stdcall2(va, ADDR_UNIT_A, 3u);
    emit_case_json(fp, &first, va, nm, "non_item_noop", "void", 0, 0, 0, 0, 0, st1, 2, eax, r, 2, pre);

    /* Valid item, low byte truncation (0x12FF -> 0xFF, 0x00 -> 0x00, 0x04 -> 0x04) */
    w32(ADDR_UNIT_A + 0x00, 4u);
    uint32_t pages[3] = { 0x12FFu, 0x00u, 0x04u };
    const char *cids[3] = { "page_0xff_trunc", "page_0x00", "page_0x04" };
    for (int i = 0; i < 3; i++) {
      uint32_t st[2] = { ADDR_UNIT_A, pages[i] };
      capture_pre(r, 2, pre);
      eax = call_stdcall2(va, ADDR_UNIT_A, pages[i]);
      emit_case_json(fp, &first, va, nm, cids[i], "void", 0, 0, 0, 0, 0, st, 2, eax, r, 2, pre);
    }
  }

  /* 17. 0x6FD73C50 ITEMS_GetBodyLocation */
  {
    const uint32_t va = 0x6FD73C50u;
    const char *nm = "ITEMS_GetBodyLocation";
    RangeSpec r[2] = { { ADDR_UNIT_A, 244 }, { ADDR_ITEMDATA_A, 116 } };
    init_item_unit(ADDR_UNIT_A, ADDR_ITEMDATA_A, ADDR_INVENTORY);

    uint32_t st0[1] = { 0u };
    capture_pre(r, 2, pre);
    uint32_t eax = call_stdcall1(va, 0u);
    emit_case_json(fp, &first, va, nm, "null_item", "al", 0, 0, 0, 0, 0, st0, 1, eax, r, 2, pre);

    uint8_t locs[4] = { 0u, 1u, 4u, 0xFFu };
    const char *cids[4] = { "bodyloc_0", "bodyloc_1_head", "bodyloc_4_rarm", "bodyloc_0xff" };
    for (int i = 0; i < 4; i++) {
      w8(ADDR_ITEMDATA_A + 0x44, locs[i]);
      uint32_t st[1] = { ADDR_UNIT_A };
      capture_pre(r, 2, pre);
      eax = call_stdcall1(va, ADDR_UNIT_A);
      emit_case_json(fp, &first, va, nm, cids[i], "al", 0, 0, 0, 0, 0, st, 1, eax, r, 2, pre);
    }
  }
}

static void set_equiv_bit(uint32_t type_id, uint32_t bit_k) {
  /* w = 4 dwords per type at ADDR_ITYPE_EQUIV */
  uint32_t dword_idx = bit_k >> 5;
  uint32_t bit_idx = bit_k & 31u;
  uint32_t addr = ADDR_ITYPE_EQUIV + (type_id * 4u + dword_idx) * 4u;
  w32(addr, (*(uint32_t *)(uintptr_t)addr) | (1u << bit_idx));
}

static void put_item_rec(uint32_t idx, uint32_t dwCode, uint32_t dwAltGfx, int16_t wType0) {
  uint32_t base = ADDR_ITEMSTXT + idx * 0x1A8u;
  memset((void *)(uintptr_t)base, 0, 0x1A8);
  w32(base + 0x80, dwCode);
  w32(base + 0x90, dwAltGfx);
  w16(base + 0x11E, (uint16_t)wType0);
}

static void emit_b005_gfx_cache(FILE *fp) {
  int first = 1;
  uint8_t *pre[10];

  const uint32_t va = 0x6FD6E920u;
  const char *nm = "INVENTORY_InitItemGfxCodeTable";

  /* Prepare synthetic ItemTypes equivalence matrix at ADDR_ITYPE_EQUIV (80 types, 4 dwords/type):
   *   type 1: body armor (bit 3) and any armor (bit 50)
   *   type 3: body armor (bit 3) and any armor (bit 50)
   *   type 37: helm (bit 37) and any armor (bit 50)
   *   type 45: weapon (bit 45)
   *   type 51: shield (bit 51) and any armor (bit 50)
   *   type 60: helm + circlet (bit 37 + bit 75 -> excluded by circlet check!)
   *   type 61: misc non-matching type (no 3/37/45/51 bit)
   */
  memset((void *)(uintptr_t)ADDR_ITYPE_EQUIV, 0, 80 * 16);
  set_equiv_bit(1, 3);   set_equiv_bit(1, 50);
  set_equiv_bit(3, 3);   set_equiv_bit(3, 50);
  set_equiv_bit(37, 37); set_equiv_bit(37, 50);
  set_equiv_bit(45, 45);
  set_equiv_bit(50, 50);
  set_equiv_bit(51, 51); set_equiv_bit(51, 50);
  set_equiv_bit(60, 37); set_equiv_bit(60, 75);

  setup_synthetic_datatables();
  w32(ADDR_DATATABLES + 0xBFC, 80u); /* nItemTypesTxtRecordCount = 80 (> 75) */
  w32(ADDR_DATATABLES + 0xC00, 4u);  /* nItemTypesEquivDwords = 4 */
  w32(ADDR_DATATABLES + 0xC04, ADDR_ITYPE_EQUIV);
  w32(VA_ITEMS_TXT_PTR, ADDR_ITEMSTXT);

  /* Case 1: Init flag already set -> complete no-op */
  {
    RangeSpec r[2] = { { VA_GFX_INIT_FLAG, 4 }, { VA_GFX_CACHE, 0x7FC } };
    memset((void *)(uintptr_t)VA_GFX_CACHE, 0x55, 0x7FC);
    w32(VA_GFX_INIT_FLAG, 1u);
    capture_pre(r, 2, pre);
    uint32_t eax = call_void0(va);
    emit_case_json(fp, &first, va, nm, "already_initialized_noop", "void", 0, 0, 0, 0, 0, NULL, 0, eax, r, 2, pre);
  }

  /* Case 2: nItemsTxtRecordCount == 0 -> zeroes cache, seeds lit/med/hvy, sets 0x6FDF13A0 = 0xFF */
  {
    RangeSpec r[4] = {
      { VA_GFX_INIT_FLAG, 4 },
      { VA_ITEMS_TXT_COUNT, 8 },
      { VA_GFX_CACHE, 0x7FC },
      { VA_SGPT_DATATABLES, 4 }
    };
    memset((void *)(uintptr_t)VA_GFX_CACHE, 0xAA, 0x7FC);
    w32(VA_GFX_INIT_FLAG, 0u);
    w32(VA_ITEMS_TXT_COUNT, 0u);
    capture_pre(r, 4, pre);
    uint32_t eax = call_void0(va);
    emit_case_json(fp, &first, va, nm, "zero_items_seeds_defaults", "void", 0, 0, 0, 0, 0, NULL, 0, eax, r, 4, pre);
  }

  /* Case 3: Mixed items (altGfx fallback, duplicate code, negative wType, circlet exclusion, weapon/armor collision vs static table) */
  {
    put_item_rec(0, 0x31706577u, 0u, 45);          /* 'wep1', weapon (45): static[4].itype=37 (armor, not weapon) -> placed at slot 4 */
    put_item_rec(1, 0x306D6C68u, 0x316D6C68u, 37); /* altGfx 'hlm1', helm (37, armor 50): static[4..14] are armor (37/3) -> skips until first non-armor slot in static table! */
    put_item_rec(2, 0x31706577u, 0u, 45);          /* duplicate 'wep1' -> skipped */
    put_item_rec(3, 0x31726963u, 0u, 60);          /* circlet (60: 37+75) -> excluded by 75 gate */
    put_item_rec(4, 0x3167656Eu, 0u, -1);          /* negative wType (-1) -> excluded */
    put_item_rec(5, 0x3163736Du, 0u, 61);          /* non-matching type 61 -> excluded */
    put_item_rec(6, 0x31646873u, 0u, 51);          /* 'shd1', shield (51, armor 50) */
    put_item_rec(7, 0x32706577u, 0u, 45);          /* 'wep2', weapon (45) */

    RangeSpec r[9] = {
      { VA_SGPT_DATATABLES, 4 },
      { VA_GDWBITMASKS_IAT, 4 },
      { ADDR_BITMASKS, 128 },
      { ADDR_DATATABLES + 0xBF8, 0x10 },
      { ADDR_ITYPE_EQUIV, 80 * 16 },
      { VA_STATIC_GFX_TABLE, 0x840 },
      { VA_ITEMS_TXT_COUNT, 8 },
      { ADDR_ITEMSTXT, 8 * 0x1A8 },
      { VA_GFX_CACHE, 0x6FDF148Cu - VA_GFX_CACHE }
    };
    memset((void *)(uintptr_t)VA_GFX_CACHE, 0, 0x6FDF148Cu - VA_GFX_CACHE);
    w32(VA_GFX_INIT_FLAG, 0u);
    w32(VA_ITEMS_TXT_COUNT, 8u);
    capture_pre(r, 9, pre);
    uint32_t eax = call_void0(va);
    emit_case_json(fp, &first, va, nm, "mixed_items_and_static_table_collisions", "void", 0, 0, 0, 0, 0, NULL, 0, eax, r, 9, pre);
  }

  /* Case 4: Negative nItemsTxtRecordCount (-5) -> skips loop, sets 0x6FDF13A0 = 0xFF */
  {
    RangeSpec r[4] = {
      { VA_GFX_INIT_FLAG, 4 },
      { VA_ITEMS_TXT_COUNT, 8 },
      { VA_GFX_CACHE, 0x7FC },
      { VA_SGPT_DATATABLES, 4 }
    };
    memset((void *)(uintptr_t)VA_GFX_CACHE, 0x33, 0x7FC);
    w32(VA_GFX_INIT_FLAG, 0u);
    w32(VA_ITEMS_TXT_COUNT, (uint32_t)-5);
    capture_pre(r, 4, pre);
    uint32_t eax = call_void0(va);
    emit_case_json(fp, &first, va, nm, "negative_items_count_skips_loop", "void", 0, 0, 0, 0, 0, NULL, 0, eax, r, 4, pre);
  }

  /* Case 5: NT boundary gates (NT = 45 -> weapon 45 excluded because gate requires NT > 45; helm 37 included because 45 > 37) */
  {
    w32(ADDR_DATATABLES + 0xBFC, 45u); /* NT == 45: blocks weapon (45), shield (51), armor (50), circlet (75), allows helm (37) and body armor (3) */
    put_item_rec(0, 0x39706577u, 0u, 44); /* type 44 with weapon bit 45 set -> blocked by NT <= 45 */
    set_equiv_bit(44, 45);
    put_item_rec(1, 0x396D6C68u, 0u, 37); /* helm 37 -> allowed since NT(45) > 37, and armor collision check (NT > 50) is also bypassed! */

    RangeSpec r[9] = {
      { VA_SGPT_DATATABLES, 4 },
      { VA_GDWBITMASKS_IAT, 4 },
      { ADDR_BITMASKS, 128 },
      { ADDR_DATATABLES + 0xBF8, 0x10 },
      { ADDR_ITYPE_EQUIV, 80 * 16 },
      { VA_STATIC_GFX_TABLE, 0x840 },
      { VA_ITEMS_TXT_COUNT, 8 },
      { ADDR_ITEMSTXT, 2 * 0x1A8 },
      { VA_GFX_CACHE, 0x6FDF148Cu - VA_GFX_CACHE }
    };
    memset((void *)(uintptr_t)VA_GFX_CACHE, 0, 0x6FDF148Cu - VA_GFX_CACHE);
    w32(VA_GFX_INIT_FLAG, 0u);
    w32(VA_ITEMS_TXT_COUNT, 2u);
    capture_pre(r, 9, pre);
    uint32_t eax = call_void0(va);
    emit_case_json(fp, &first, va, nm, "nt_boundary_gate_45", "void", 0, 0, 0, 0, 0, NULL, 0, eax, r, 9, pre);
    w32(ADDR_DATATABLES + 0xBFC, 80u);
  }

  /* Case 6: 250 distinct armor items -> skips static armor slots, reaches s >= 255 and clamps back to nextFree! */
  {
    for (uint32_t i = 0; i < 250u; i++) {
      uint32_t code = 0x41000000u | ((i + 1u) & 0xFFFFu);
      put_item_rec(i, code, 0u, 3); /* body armor (3, any armor 50) */
    }
    RangeSpec r[9] = {
      { VA_SGPT_DATATABLES, 4 },
      { VA_GDWBITMASKS_IAT, 4 },
      { ADDR_BITMASKS, 128 },
      { ADDR_DATATABLES + 0xBF8, 0x10 },
      { ADDR_ITYPE_EQUIV, 80 * 16 },
      { VA_STATIC_GFX_TABLE, 0x840 },
      { VA_ITEMS_TXT_COUNT, 8 },
      { ADDR_ITEMSTXT, 250 * 0x1A8 },
      { VA_GFX_CACHE, 0x6FDF148Cu - VA_GFX_CACHE }
    };
    memset((void *)(uintptr_t)VA_GFX_CACHE, 0, 0x6FDF148Cu - VA_GFX_CACHE);
    w32(VA_GFX_INIT_FLAG, 0u);
    w32(VA_ITEMS_TXT_COUNT, 250u);
    capture_pre(r, 9, pre);
    uint32_t eax = call_void0(va);
    emit_case_json(fp, &first, va, nm, "overflow_255_clamp_backfills_nextfree", "void", 0, 0, 0, 0, 0, NULL, 0, eax, r, 9, pre);
  }

  /* Case 7: Weapon/weapon static-slot collision (0x6FD6EB42..0x6FD6EB59) and item with dwCode == 0 */
  {
    /* Set weapon bit 45 on static-table type 37 so static[4..] (type 37) weapon-collide with weapon item before landing on type 3 */
    set_equiv_bit(37, 45);
    put_item_rec(0, 0u, 0u, 45);          /* dwCode == 0, dwAltGfx == 0 -> matches slot 0 (dup=true) and is skipped */
    put_item_rec(1, 0x37706577u, 0u, 45); /* 'wep7', weapon (45): collides with static[4..] where tt==37 has bit 45 */

    RangeSpec r[9] = {
      { VA_SGPT_DATATABLES, 4 },
      { VA_GDWBITMASKS_IAT, 4 },
      { ADDR_BITMASKS, 128 },
      { ADDR_DATATABLES + 0xBF8, 0x10 },
      { ADDR_ITYPE_EQUIV, 80 * 16 },
      { VA_STATIC_GFX_TABLE, 0x840 },
      { VA_ITEMS_TXT_COUNT, 8 },
      { ADDR_ITEMSTXT, 2 * 0x1A8 },
      { VA_GFX_CACHE, 0x6FDF148Cu - VA_GFX_CACHE }
    };
    memset((void *)(uintptr_t)VA_GFX_CACHE, 0, 0x6FDF148Cu - VA_GFX_CACHE);
    w32(VA_GFX_INIT_FLAG, 0u);
    w32(VA_ITEMS_TXT_COUNT, 2u);
    capture_pre(r, 9, pre);
    uint32_t eax = call_void0(va);
    emit_case_json(fp, &first, va, nm, "weapon_static_collision_and_dwcode_zero", "void", 0, 0, 0, 0, 0, NULL, 0, eax, r, 9, pre);

    /* Restore ADDR_ITYPE_EQUIV */
    memset((void *)(uintptr_t)ADDR_ITYPE_EQUIV, 0, 80 * 16);
    set_equiv_bit(1, 3);   set_equiv_bit(1, 50);
    set_equiv_bit(3, 3);   set_equiv_bit(3, 50);
    set_equiv_bit(37, 37); set_equiv_bit(37, 50);
    set_equiv_bit(45, 45);
    set_equiv_bit(50, 50);
    set_equiv_bit(51, 51); set_equiv_bit(51, 50);
    set_equiv_bit(60, 37); set_equiv_bit(60, 75);
  }

  /* Cases 8..10: NT boundary gates NT = 3, NT = 37, NT = 51 */
  {
    const uint32_t nts[3] = { 3u, 37u, 51u };
    const char *nt_cids[3] = { "nt_boundary_gate_3", "nt_boundary_gate_37", "nt_boundary_gate_51" };
    set_equiv_bit(2, 3);    /* type 2 has body armor bit 3 */
    set_equiv_bit(36, 37);  /* type 36 has helm bit 37 */
    set_equiv_bit(48, 51);  /* type 48 has shield bit 51 */
    put_item_rec(0, 0x326D7261u, 0u, 2);  /* type 2 (body armor bit 3): blocked when NT=3, allowed when NT=37,51 */
    put_item_rec(1, 0x366D6C68u, 0u, 36); /* type 36 (helm bit 37): blocked when NT=3,37, allowed when NT=51 */
    put_item_rec(2, 0x38646873u, 0u, 48); /* type 48 (shield bit 51): blocked when NT=3,37,51 */

    RangeSpec r[9] = {
      { VA_SGPT_DATATABLES, 4 },
      { VA_GDWBITMASKS_IAT, 4 },
      { ADDR_BITMASKS, 128 },
      { ADDR_DATATABLES + 0xBF8, 0x10 },
      { ADDR_ITYPE_EQUIV, 80 * 16 },
      { VA_STATIC_GFX_TABLE, 0x840 },
      { VA_ITEMS_TXT_COUNT, 8 },
      { ADDR_ITEMSTXT, 3 * 0x1A8 },
      { VA_GFX_CACHE, 0x6FDF148Cu - VA_GFX_CACHE }
    };
    for (int k = 0; k < 3; k++) {
      w32(ADDR_DATATABLES + 0xBFC, nts[k]);
      memset((void *)(uintptr_t)VA_GFX_CACHE, 0, 0x6FDF148Cu - VA_GFX_CACHE);
      w32(VA_GFX_INIT_FLAG, 0u);
      w32(VA_ITEMS_TXT_COUNT, 3u);
      capture_pre(r, 9, pre);
      uint32_t eax = call_void0(va);
      emit_case_json(fp, &first, va, nm, nt_cids[k], "void", 0, 0, 0, 0, 0, NULL, 0, eax, r, 9, pre);
    }
    w32(ADDR_DATATABLES + 0xBFC, 80u);
  }
}

static void emit_b008(FILE *fp) {
  int first = 1;
  uint8_t *pre[8];

  /* 1. 0x6FD73970 ITEMS_SetRareSuffix */
  {
    const uint32_t va = 0x6FD73970u;
    const char *nm = "ITEMS_SetRareSuffix";
    RangeSpec r[2] = { { ADDR_UNIT_A, 244 }, { ADDR_ITEMDATA_A, 116 } };
    init_item_unit(ADDR_UNIT_A, ADDR_ITEMDATA_A, ADDR_INVENTORY);

    struct { uint32_t pItem; uint32_t utype; uint32_t pData; uint32_t val; const char *cid; } cases[6] = {
      { 0u, 4u, ADDR_ITEMDATA_A, 0x1234u, "null_item" },
      { ADDR_UNIT_A, 1u, ADDR_ITEMDATA_A, 0x1234u, "non_item_unit" },
      { ADDR_UNIT_A, 4u, 0u, 0x1234u, "null_itemdata" },
      { ADDR_UNIT_A, 4u, ADDR_ITEMDATA_A, 0xABCD5678u, "valid_0x5678_trunc" },
      { ADDR_UNIT_A, 4u, ADDR_ITEMDATA_A, 0x00000000u, "valid_0x0000" },
      { ADDR_UNIT_A, 4u, ADDR_ITEMDATA_A, 0xFFFFFFFFu, "valid_0xffff" }
    };
    for (int i = 0; i < 6; i++) {
      w32(ADDR_UNIT_A + 0x00, cases[i].utype);
      w32(ADDR_UNIT_A + 0x14, cases[i].pData);
      uint32_t st[2] = { cases[i].pItem, cases[i].val };
      capture_pre(r, 2, pre);
      uint32_t eax = call_stdcall2(va, cases[i].pItem, cases[i].val);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "void", 0, 0, 0, 0, 0, st, 2, eax, r, 2, pre);
    }
  }

  /* 2. 0x6FD739C0 ITEMS_SetRarePrefix */
  {
    const uint32_t va = 0x6FD739C0u;
    const char *nm = "ITEMS_SetRarePrefix";
    RangeSpec r[2] = { { ADDR_UNIT_A, 244 }, { ADDR_ITEMDATA_A, 116 } };
    init_item_unit(ADDR_UNIT_A, ADDR_ITEMDATA_A, ADDR_INVENTORY);

    struct { uint32_t pItem; uint32_t utype; uint32_t pData; uint32_t val; const char *cid; } cases[6] = {
      { 0u, 4u, ADDR_ITEMDATA_A, 0x1357u, "null_item" },
      { ADDR_UNIT_A, 0u, ADDR_ITEMDATA_A, 0x1357u, "non_item_unit" },
      { ADDR_UNIT_A, 4u, 0u, 0x1357u, "null_itemdata" },
      { ADDR_UNIT_A, 4u, ADDR_ITEMDATA_A, 0xCAFE1357u, "valid_0x1357_trunc" },
      { ADDR_UNIT_A, 4u, ADDR_ITEMDATA_A, 0x00000000u, "valid_0x0000" },
      { ADDR_UNIT_A, 4u, ADDR_ITEMDATA_A, 0xFFFFFFFFu, "valid_0xffff" }
    };
    for (int i = 0; i < 6; i++) {
      w32(ADDR_UNIT_A + 0x00, cases[i].utype);
      w32(ADDR_UNIT_A + 0x14, cases[i].pData);
      uint32_t st[2] = { cases[i].pItem, cases[i].val };
      capture_pre(r, 2, pre);
      uint32_t eax = call_stdcall2(va, cases[i].pItem, cases[i].val);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "void", 0, 0, 0, 0, 0, st, 2, eax, r, 2, pre);
    }
  }

  /* 3. 0x6FD73A10 ITEMS_SetMagicSuffix */
  {
    const uint32_t va = 0x6FD73A10u;
    const char *nm = "ITEMS_SetMagicSuffix";
    RangeSpec r[2] = { { ADDR_UNIT_A, 244 }, { ADDR_ITEMDATA_A, 116 } };
    init_item_unit(ADDR_UNIT_A, ADDR_ITEMDATA_A, ADDR_INVENTORY);

    struct { uint32_t pItem; uint32_t utype; uint32_t pData; uint32_t val; uint32_t idx; const char *cid; } cases[6] = {
      { 0u, 4u, ADDR_ITEMDATA_A, 0x1111u, 0u, "null_item" },
      { ADDR_UNIT_A, 1u, ADDR_ITEMDATA_A, 0x1111u, 0u, "non_item_unit" },
      { ADDR_UNIT_A, 4u, 0u, 0x1111u, 0u, "null_itemdata" },
      { ADDR_UNIT_A, 4u, ADDR_ITEMDATA_A, 0x1111u, 0u, "idx0_set" },
      { ADDR_UNIT_A, 4u, ADDR_ITEMDATA_A, 0x2222u, 1u, "idx1_set" },
      { ADDR_UNIT_A, 4u, ADDR_ITEMDATA_A, 0xDEAD3333u, 2u, "idx2_set_trunc" }
    };
    for (int i = 0; i < 6; i++) {
      w32(ADDR_UNIT_A + 0x00, cases[i].utype);
      w32(ADDR_UNIT_A + 0x14, cases[i].pData);
      uint32_t st[3] = { cases[i].pItem, cases[i].val, cases[i].idx };
      capture_pre(r, 2, pre);
      uint32_t eax = call_stdcall3(va, cases[i].pItem, cases[i].val, cases[i].idx);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "void", 0, 0, 0, 0, 0, st, 3, eax, r, 2, pre);
    }
  }

  /* 4. 0x6FD73AC0 ITEMS_SetMagicPrefix */
  {
    const uint32_t va = 0x6FD73AC0u;
    const char *nm = "ITEMS_SetMagicPrefix";
    RangeSpec r[2] = { { ADDR_UNIT_A, 244 }, { ADDR_ITEMDATA_A, 116 } };
    init_item_unit(ADDR_UNIT_A, ADDR_ITEMDATA_A, ADDR_INVENTORY);

    struct { uint32_t pItem; uint32_t utype; uint32_t pData; uint32_t val; uint32_t idx; const char *cid; } cases[6] = {
      { 0u, 4u, ADDR_ITEMDATA_A, 0x4444u, 0u, "null_item" },
      { ADDR_UNIT_A, 2u, ADDR_ITEMDATA_A, 0x4444u, 0u, "non_item_unit" },
      { ADDR_UNIT_A, 4u, 0u, 0x4444u, 0u, "null_itemdata" },
      { ADDR_UNIT_A, 4u, ADDR_ITEMDATA_A, 0x4444u, 0u, "idx0_set" },
      { ADDR_UNIT_A, 4u, ADDR_ITEMDATA_A, 0x5555u, 1u, "idx1_set" },
      { ADDR_UNIT_A, 4u, ADDR_ITEMDATA_A, 0xBEEF6666u, 2u, "idx2_set_trunc" }
    };
    for (int i = 0; i < 6; i++) {
      w32(ADDR_UNIT_A + 0x00, cases[i].utype);
      w32(ADDR_UNIT_A + 0x14, cases[i].pData);
      uint32_t st[3] = { cases[i].pItem, cases[i].val, cases[i].idx };
      capture_pre(r, 2, pre);
      uint32_t eax = call_stdcall3(va, cases[i].pItem, cases[i].val, cases[i].idx);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "void", 0, 0, 0, 0, 0, st, 3, eax, r, 2, pre);
    }
  }

  /* 5. 0x6FD83AB0 STATES_CheckStateMaskExpOnUnit */
  {
    const uint32_t va = 0x6FD83AB0u;
    const char *nm = "STATES_CheckStateMaskExpOnUnit";
    setup_synthetic_datatables();
    w32(ADDR_DATATABLES + 0xC4, 185u);
    w32(ADDR_DATATABLES + 0x100, ADDR_STATE_MASK_PLAYER);
    w32(ADDR_DATATABLES + 0x104, ADDR_STATE_MASK_MONSTER);
    memset((void *)(uintptr_t)ADDR_STATE_MASK_PLAYER, 0, 24);
    memset((void *)(uintptr_t)ADDR_STATE_MASK_MONSTER, 0, 24);
    w32(ADDR_STATE_MASK_PLAYER + 0x00, 0x80000005u); /* states 0, 2, 31 */
    w32(ADDR_STATE_MASK_PLAYER + 0x04, 0x00000002u); /* state 33 */
    w32(ADDR_STATE_MASK_PLAYER + 0x14, 0x01000000u); /* state 184 */
    w32(ADDR_STATE_MASK_MONSTER + 0x00, 0x0000000Au); /* states 1, 3 */
    w32(ADDR_STATE_MASK_MONSTER + 0x08, 0x00000001u); /* state 64 */
    memset((void *)(uintptr_t)ADDR_UNIT_A, 0, 244);

    RangeSpec r[7] = {
      { VA_SGPT_DATATABLES, 4 },
      { VA_GDWBITMASKS_IAT, 4 },
      { ADDR_BITMASKS, 128 },
      { ADDR_DATATABLES + 0xC0, 0x48 },
      { ADDR_STATE_MASK_PLAYER, 24 },
      { ADDR_STATE_MASK_MONSTER, 24 },
      { ADDR_UNIT_A, 244 }
    };

    struct { uint32_t pUnit; uint32_t utype; uint32_t state; const char *cid; } cases[11] = {
      { ADDR_UNIT_A, 0u, (uint32_t)-1, "state_neg1" },
      { ADDR_UNIT_A, 0u, 185u, "state_oob_185" },
      { 0u, 0u, 2u, "null_unit_uses_player_mask_set" },
      { 0u, 0u, 1u, "null_unit_uses_player_mask_clear" },
      { ADDR_UNIT_A, 0u, 31u, "player_state31_highbit" },
      { ADDR_UNIT_A, 0u, 33u, "player_state33_word1" },
      { ADDR_UNIT_A, 0u, 184u, "player_state184_last" },
      { ADDR_UNIT_A, 1u, 1u, "monster_state1_set" },
      { ADDR_UNIT_A, 1u, 2u, "monster_state2_clear" },
      { ADDR_UNIT_A, 1u, 64u, "monster_state64_word2" },
      { ADDR_UNIT_A, 4u, 0u, "item_unit_uses_player_mask" }
    };
    for (int i = 0; i < 11; i++) {
      w32(ADDR_UNIT_A + 0x00, cases[i].utype);
      uint32_t st[2] = { cases[i].pUnit, cases[i].state };
      capture_pre(r, 7, pre);
      uint32_t eax = call_stdcall2(va, cases[i].pUnit, cases[i].state);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 2, eax, r, 7, pre);
    }
  }

  /* 6. 0x6FD87D30 STATLIST_GetSkillLevel */
  {
    const uint32_t va = 0x6FD87D30u;
    const char *nm = "STATLIST_GetSkillLevel";
    RangeSpec r[1] = { { ADDR_STATLIST_A, 60 } };
    memset((void *)(uintptr_t)ADDR_STATLIST_A, 0, 60);

    struct { uint32_t ptr; uint32_t val; const char *cid; } cases[4] = {
      { ADDR_STATLIST_A, 0u, "level_0" },
      { ADDR_STATLIST_A, 20u, "level_20" },
      { ADDR_STATLIST_A, 0x7FFFFFFFu, "level_max_pos" },
      { ADDR_STATLIST_A, 0xFFFFFFFFu, "level_neg1" }
    };
    for (int i = 0; i < 4; i++) {
      w32(ADDR_STATLIST_A + 0x20, cases[i].val);
      uint32_t st[1] = { cases[i].ptr };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, cases[i].ptr);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 1, pre);
    }
  }

  /* 7. 0x6FD87D40 STATLIST_SetSkillLevel */
  {
    const uint32_t va = 0x6FD87D40u;
    const char *nm = "STATLIST_SetSkillLevel";
    RangeSpec r[1] = { { ADDR_STATLIST_A, 60 } };
    memset((void *)(uintptr_t)ADDR_STATLIST_A, 0, 60);
    w32(ADDR_STATLIST_A + 0x1C, 0x11223344u);

    struct { uint32_t ptr; uint32_t val; const char *cid; } cases[4] = {
      { ADDR_STATLIST_A, 15u, "set_level_15" },
      { ADDR_STATLIST_A, 0u, "set_level_0" },
      { ADDR_STATLIST_A, 99u, "set_level_99" },
      { ADDR_STATLIST_A, 0xFFFFFFFFu, "set_level_max" }
    };
    for (int i = 0; i < 4; i++) {
      uint32_t st[2] = { cases[i].ptr, cases[i].val };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall2(va, cases[i].ptr, cases[i].val);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "void", 0, 0, 0, 0, 0, st, 2, eax, r, 1, pre);
    }
  }

  /* 8. 0x6FD87D50 STATLIST_GetSkillId */
  {
    const uint32_t va = 0x6FD87D50u;
    const char *nm = "STATLIST_GetSkillId";
    RangeSpec r[1] = { { ADDR_STATLIST_A, 60 } };
    memset((void *)(uintptr_t)ADDR_STATLIST_A, 0, 60);

    struct { uint32_t ptr; uint32_t val; const char *cid; } cases[4] = {
      { ADDR_STATLIST_A, 0u, "skill_0" },
      { ADDR_STATLIST_A, 54u, "skill_54_teleport" },
      { ADDR_STATLIST_A, 356u, "skill_356" },
      { ADDR_STATLIST_A, 0xFFFFFFFFu, "skill_neg1" }
    };
    for (int i = 0; i < 4; i++) {
      w32(ADDR_STATLIST_A + 0x1C, cases[i].val);
      uint32_t st[1] = { cases[i].ptr };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, cases[i].ptr);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 1, pre);
    }
  }

  /* 9. 0x6FD87D60 STATLIST_SetSkillId */
  {
    const uint32_t va = 0x6FD87D60u;
    const char *nm = "STATLIST_SetSkillId";
    RangeSpec r[1] = { { ADDR_STATLIST_A, 60 } };
    memset((void *)(uintptr_t)ADDR_STATLIST_A, 0, 60);
    w32(ADDR_STATLIST_A + 0x20, 0x55667788u);

    struct { uint32_t ptr; uint32_t val; const char *cid; } cases[4] = {
      { ADDR_STATLIST_A, 106u, "set_skill_106_zeal" },
      { ADDR_STATLIST_A, 0u, "set_skill_0" },
      { ADDR_STATLIST_A, 0x7FFFFFFFu, "set_skill_max_pos" },
      { ADDR_STATLIST_A, 0xFFFFFFFFu, "set_skill_0xffffffff" }
    };
    for (int i = 0; i < 4; i++) {
      uint32_t st[2] = { cases[i].ptr, cases[i].val };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall2(va, cases[i].ptr, cases[i].val);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "void", 0, 0, 0, 0, 0, st, 2, eax, r, 1, pre);
    }
  }

  /* 10. 0x6FD87D70 STATLIST_SetStatRemoveProc */
  {
    const uint32_t va = 0x6FD87D70u;
    const char *nm = "STATLIST_SetStatRemoveProc";
    RangeSpec r[1] = { { ADDR_STATLIST_A, 60 } };
    memset((void *)(uintptr_t)ADDR_STATLIST_A, 0, 60);

    struct { uint32_t ptr; uint32_t val; const char *cid; } cases[4] = {
      { 0u, 0x6FC12340u, "null_list_noop" },
      { ADDR_STATLIST_A, 0x6FC12340u, "set_proc_ptr" },
      { ADDR_STATLIST_A, 0u, "clear_proc_null" },
      { ADDR_STATLIST_A, 0xFFFFFFFFu, "set_proc_max" }
    };
    for (int i = 0; i < 4; i++) {
      uint32_t st[2] = { cases[i].ptr, cases[i].val };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall2(va, cases[i].ptr, cases[i].val);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "void", 0, 0, 0, 0, 0, st, 2, eax, r, 1, pre);
    }
  }

  /* 11. 0x6FD87DE0 STATLIST_CheckUnitStatListFlag100 */
  {
    const uint32_t va = 0x6FD87DE0u;
    const char *nm = "STATLIST_CheckUnitStatListFlag100";
    RangeSpec r[2] = { { ADDR_UNIT_A, 244 }, { ADDR_STATLIST_EX, 100 } };
    memset((void *)(uintptr_t)ADDR_UNIT_A, 0, 244);
    memset((void *)(uintptr_t)ADDR_STATLIST_EX, 0, 100);

    struct { uint32_t pUnit; uint32_t pSlex; uint32_t flags; const char *cid; } cases[6] = {
      { 0u, ADDR_STATLIST_EX, 0x00000100u, "null_unit" },
      { ADDR_UNIT_A, 0u, 0x00000100u, "unit_null_statlistex_returns_0" },
      { ADDR_UNIT_A, ADDR_STATLIST_EX, 0x00000100u, "flag_set_exact" },
      { ADDR_UNIT_A, ADDR_STATLIST_EX, 0x8000FEFFu, "flag_clear_all_others_set" },
      { ADDR_UNIT_A, ADDR_STATLIST_EX, 0xFFFFFFFFu, "flag_set_all_ones" },
      { ADDR_UNIT_A, ADDR_STATLIST_EX, 0x00000000u, "flag_clear_zero" }
    };
    for (int i = 0; i < 6; i++) {
      w32(ADDR_UNIT_A + 0x5C, cases[i].pSlex);
      w32(ADDR_STATLIST_EX + 0x10, cases[i].flags);
      uint32_t st[1] = { cases[i].pUnit };
      capture_pre(r, 2, pre);
      uint32_t eax = call_stdcall1(va, cases[i].pUnit);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 2, pre);
    }
  }

  /* 12. 0x6FD87E70 STATLIST_GetOwnerAndDynamicFlag */
  {
    const uint32_t va = 0x6FD87E70u;
    const char *nm = "STATLIST_GetOwnerAndDynamicFlag";
    RangeSpec r[4] = {
      { ADDR_UNIT_A, 244 },
      { ADDR_STATLIST_A, 60 },
      { ADDR_STATLIST_EX, 100 },
      { ADDR_FLAGS_BOX, 16 }
    };
    memset((void *)(uintptr_t)ADDR_UNIT_A, 0, 244);
    memset((void *)(uintptr_t)ADDR_STATLIST_A, 0, 60);
    memset((void *)(uintptr_t)ADDR_STATLIST_EX, 0, 100);
    memset((void *)(uintptr_t)ADDR_FLAGS_BOX, 0, 16);

    struct {
      uint32_t pUnit;
      uint32_t pList;
      uint32_t listFlags;
      uint32_t pParent;
      uint32_t parentFlags;
      uint32_t owner;
      uint32_t pOut;
      const char *cid;
    } cases[6] = {
      { ADDR_UNIT_A, ADDR_STATLIST_A, 0x00000000u, ADDR_STATLIST_EX, 0x80000000u, 0x12345678u, ADDR_FLAGS_BOX, "valid_not_merged_1" },
      { ADDR_UNIT_A, ADDR_STATLIST_A, 0x40000000u, ADDR_STATLIST_EX, 0x80000000u, 0xAABBCCDDu, ADDR_FLAGS_BOX, "valid_merged_bit30_0" },
      { ADDR_UNIT_A, ADDR_STATLIST_A, 0x00000000u, ADDR_STATLIST_EX, 0x80000000u, 0x12345678u, 0u, "valid_null_out_ptr" },
      { ADDR_UNIT_A, ADDR_STATLIST_A, 0x00000000u, ADDR_STATLIST_EX, 0x7FFFFFFFu, 0x12345678u, ADDR_FLAGS_BOX, "parent_not_extended_clears_out" },
      { 0u, ADDR_STATLIST_A, 0x00000000u, ADDR_STATLIST_EX, 0x80000000u, 0x12345678u, ADDR_FLAGS_BOX, "null_unit_clears_out" },
      { ADDR_UNIT_A, 0u, 0x00000000u, ADDR_STATLIST_EX, 0x80000000u, 0x12345678u, ADDR_FLAGS_BOX, "null_list_clears_out" }
    };
    for (int i = 0; i < 6; i++) {
      w32(ADDR_FLAGS_BOX, 0x99u);
      w32(ADDR_UNIT_A + 0x5C, cases[i].pList);
      w32(ADDR_STATLIST_A + 0x10, cases[i].listFlags);
      w32(ADDR_STATLIST_A + 0x34, cases[i].pParent);
      w32(ADDR_STATLIST_EX + 0x10, cases[i].parentFlags);
      w32(ADDR_STATLIST_EX + 0x44, cases[i].owner);
      uint32_t st[2] = { cases[i].pUnit, cases[i].pOut };
      capture_pre(r, 4, pre);
      uint32_t eax = call_stdcall2(va, cases[i].pUnit, cases[i].pOut);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 2, eax, r, 4, pre);
    }
  }

  /* 13. 0x6FD87EC0 STATLIST_GetStatListFromUnitStateAndFlag */
  {
    const uint32_t va = 0x6FD87EC0u;
    const char *nm = "STATLIST_GetStatListFromUnitStateAndFlag";
    RangeSpec r[5] = {
      { ADDR_UNIT_A, 244 },
      { ADDR_STATLIST_EX, 100 },
      { ADDR_STATLIST_A, 60 },
      { ADDR_STATLIST_B, 60 },
      { ADDR_STATLIST_C, 60 }
    };
    memset((void *)(uintptr_t)ADDR_UNIT_A, 0, 244);
    memset((void *)(uintptr_t)ADDR_STATLIST_EX, 0, 100);
    memset((void *)(uintptr_t)ADDR_STATLIST_A, 0, 60);
    memset((void *)(uintptr_t)ADDR_STATLIST_B, 0, 60);
    memset((void *)(uintptr_t)ADDR_STATLIST_C, 0, 60);

    /* pMyLastList chain: A (state=12, flags=0x10) -> B (state=12, flags=0x40) -> 0 */
    w32(ADDR_STATLIST_A + 0x10, 0x00000010u);
    w32(ADDR_STATLIST_A + 0x14, 12u);
    w32(ADDR_STATLIST_A + 0x2C, ADDR_STATLIST_B);

    w32(ADDR_STATLIST_B + 0x10, 0x00000040u);
    w32(ADDR_STATLIST_B + 0x14, 12u);
    w32(ADDR_STATLIST_B + 0x2C, 0u);

    /* pMyStats chain: C (state=8, flags=0x08) -> 0 */
    w32(ADDR_STATLIST_C + 0x10, 0x00000008u);
    w32(ADDR_STATLIST_C + 0x14, 8u);
    w32(ADDR_STATLIST_C + 0x2C, 0u);

    struct {
      uint32_t pSlex;
      uint32_t exFlags;
      uint32_t pLastList;
      uint32_t pMyStats;
      uint32_t state;
      uint32_t filter;
      const char *cid;
    } cases[11] = {
      { ADDR_STATLIST_EX, 0x80000000u, ADDR_STATLIST_A, ADDR_STATLIST_C, 12u, 0u, "filter0_my_last_list_first_match" },
      { ADDR_STATLIST_EX, 0x80000000u, ADDR_STATLIST_A, ADDR_STATLIST_C, 12u, 0x0040u, "filter_0x40_my_last_list_second_match" },
      { ADDR_STATLIST_EX, 0x80000000u, ADDR_STATLIST_A, ADDR_STATLIST_C, 8u, 0x2000u, "filter_0x2000_my_stats_any_flag" },
      { ADDR_STATLIST_EX, 0x80000000u, ADDR_STATLIST_A, ADDR_STATLIST_C, 8u, 0x2008u, "filter_0x2008_my_stats_flag_0x08" },
      { ADDR_STATLIST_EX, 0x80000000u, ADDR_STATLIST_A, ADDR_STATLIST_C, 8u, 0x2040u, "filter_0x2040_my_stats_flag_mismatch" },
      { ADDR_STATLIST_EX, 0x80000000u, 0u, ADDR_STATLIST_C, 12u, 0u, "my_last_list_head_null" },
      { ADDR_STATLIST_EX, 0x80000000u, ADDR_STATLIST_A, 0u, 8u, 0x2000u, "my_stats_head_null" },
      { ADDR_STATLIST_EX, 0x80000000u, ADDR_STATLIST_A, ADDR_STATLIST_C, 99u, 0u, "state_mismatch_my_last_list" },
      { ADDR_STATLIST_EX, 0x80000000u, ADDR_STATLIST_A, ADDR_STATLIST_C, 99u, 0x2008u, "state_mismatch_my_stats" },
      { ADDR_STATLIST_EX, 0x00000000u, ADDR_STATLIST_A, ADDR_STATLIST_C, 12u, 0u, "non_extended_statlist" },
      { 0u, 0x80000000u, ADDR_STATLIST_A, ADDR_STATLIST_C, 12u, 0u, "null_statlistex" }
    };
    for (int i = 0; i < 11; i++) {
      w32(ADDR_UNIT_A + 0x5C, cases[i].pSlex);
      w32(ADDR_STATLIST_EX + 0x10, cases[i].exFlags);
      w32(ADDR_STATLIST_EX + 0x3C, cases[i].pLastList);
      w32(ADDR_STATLIST_EX + 0x40, cases[i].pMyStats);
      uint32_t st[3] = { ADDR_UNIT_A, cases[i].state, cases[i].filter };
      capture_pre(r, 5, pre);
      uint32_t eax = call_stdcall3(va, ADDR_UNIT_A, cases[i].state, cases[i].filter);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 3, eax, r, 5, pre);
    }
  }

  /* 14. 0x6FD87F40 STATLIST_GetStatListFromFlag */
  {
    const uint32_t va = 0x6FD87F40u;
    const char *nm = "STATLIST_GetStatListFromFlag";
    RangeSpec r[4] = {
      { ADDR_STATLIST_EX, 100 },
      { ADDR_STATLIST_A, 60 },
      { ADDR_STATLIST_B, 60 },
      { ADDR_STATLIST_C, 60 }
    };
    memset((void *)(uintptr_t)ADDR_STATLIST_EX, 0, 100);
    memset((void *)(uintptr_t)ADDR_STATLIST_A, 0, 60);
    memset((void *)(uintptr_t)ADDR_STATLIST_B, 0, 60);
    memset((void *)(uintptr_t)ADDR_STATLIST_C, 0, 60);

    w32(ADDR_STATLIST_EX + 0x10, 0x80000000u);
    w32(ADDR_STATLIST_EX + 0x3C, ADDR_STATLIST_A);
    w32(ADDR_STATLIST_EX + 0x40, ADDR_STATLIST_C);

    w32(ADDR_STATLIST_A + 0x10, 0x00000008u);
    w32(ADDR_STATLIST_A + 0x2C, ADDR_STATLIST_B);

    w32(ADDR_STATLIST_B + 0x10, 0x00000020u);
    w32(ADDR_STATLIST_B + 0x2C, 0u);

    /* Give node C both 0x2000 and 0x0040 so filter=0x2000 would match C if &0xFFFFDFFF were omitted! */
    w32(ADDR_STATLIST_C + 0x10, 0x00002040u);
    w32(ADDR_STATLIST_C + 0x2C, 0u);

    struct { uint32_t pList; uint32_t filter; const char *cid; } cases[7] = {
      { 0u, 0x20u, "null_list" },
      { ADDR_STATLIST_EX, 0x0020u, "extended_my_last_list_match_b" },
      { ADDR_STATLIST_EX, 0x2040u, "extended_my_stats_match_c" },
      { ADDR_STATLIST_A, 0x0008u, "non_extended_matches_self" },
      { ADDR_STATLIST_A, 0x0020u, "non_extended_walks_prev_to_b" },
      { ADDR_STATLIST_EX, 0x2000u, "filter_0x2000_only_mask_zero_returns_0" },
      { ADDR_STATLIST_C, 0x2000u, "non_extended_node_has_0x2000_filter_0x2000_masked_to_0" }
    };
    for (int i = 0; i < 7; i++) {
      capture_pre(r, 4, pre);
      uint32_t eax = call_eax_ecx(va, cases[i].pList, cases[i].filter);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", cases[i].pList, cases[i].filter, 0, 0, 0, NULL, 0, eax, r, 4, pre);
    }
  }
}

static void emit_b014(FILE *fp) {
  int first = 1;
  uint8_t *pre[8];

  /* 1. 0x6FD6DC70 INVENTORY_GetCorpseUnitId */
  {
    const uint32_t va = 0x6FD6DC70u;
    const char *nm = "INVENTORY_GetCorpseUnitId";
    RangeSpec r[1] = { { ADDR_CORPSE_A, 16 } };
    memset((void *)(uintptr_t)ADDR_CORPSE_A, 0, 16);

    struct { uint32_t ptr; uint32_t uid; const char *cid; } cases[4] = {
      { 0u, 42u, "null_corpse" },
      { ADDR_CORPSE_A, 0u, "corpse_id_0" },
      { ADDR_CORPSE_A, 0x42u, "corpse_id_0x42" },
      { ADDR_CORPSE_A, 0xFFFFFFFFu, "corpse_id_ffffffff" }
    };
    for (int i = 0; i < 4; i++) {
      w32(ADDR_CORPSE_A + 0x04, cases[i].uid);
      uint32_t st[1] = { cases[i].ptr };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, cases[i].ptr);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 1, pre);
    }
  }

  /* 2. 0x6FD6DC90 INVENTORY_GetNextCorpse */
  {
    const uint32_t va = 0x6FD6DC90u;
    const char *nm = "INVENTORY_GetNextCorpse";
    RangeSpec r[1] = { { ADDR_CORPSE_A, 16 } };
    memset((void *)(uintptr_t)ADDR_CORPSE_A, 0, 16);

    struct { uint32_t ptr; uint32_t nxt; const char *cid; } cases[4] = {
      { 0u, ADDR_CORPSE_B, "null_corpse" },
      { ADDR_CORPSE_A, 0u, "next_null" },
      { ADDR_CORPSE_A, ADDR_CORPSE_B, "next_corpse_b" },
      { ADDR_CORPSE_A, 0xDEADBEEFu, "next_corpse_deadbeef" }
    };
    for (int i = 0; i < 4; i++) {
      w32(ADDR_CORPSE_A + 0x0C, cases[i].nxt);
      uint32_t st[1] = { cases[i].ptr };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, cases[i].ptr);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 1, pre);
    }
  }

  /* 3. 0x6FD6DCB0 INVENTORY_GetCorpseCount */
  {
    const uint32_t va = 0x6FD6DCB0u;
    const char *nm = "INVENTORY_GetCorpseCount";
    RangeSpec r[1] = { { ADDR_INVENTORY, 64 } };
    memset((void *)(uintptr_t)ADDR_INVENTORY, 0, 64);

    struct { uint32_t ptr; uint32_t sig; uint32_t cnt; const char *cid; } cases[4] = {
      { 0u, 0x01020304u, 5u, "null_inv" },
      { ADDR_INVENTORY, 0xDEADBEEFu, 5u, "bad_sig" },
      { ADDR_INVENTORY, 0x01020304u, 0u, "valid_0" },
      { ADDR_INVENTORY, 0x01020304u, 3u, "valid_3" }
    };
    for (int i = 0; i < 4; i++) {
      w32(ADDR_INVENTORY + 0x00, cases[i].sig);
      w32(ADDR_INVENTORY + 0x3C, cases[i].cnt);
      uint32_t st[1] = { cases[i].ptr };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, cases[i].ptr);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 1, pre);
    }
  }

  /* 4. 0x6FD6DD20 INVENTORY_GetFirstCorpse */
  {
    const uint32_t va = 0x6FD6DD20u;
    const char *nm = "INVENTORY_GetFirstCorpse";
    RangeSpec r[1] = { { ADDR_INVENTORY, 64 } };
    memset((void *)(uintptr_t)ADDR_INVENTORY, 0, 64);

    struct { uint32_t ptr; uint32_t sig; uint32_t first_c; const char *cid; } cases[4] = {
      { 0u, 0x01020304u, ADDR_CORPSE_A, "null_inv" },
      { ADDR_INVENTORY, 0u, ADDR_CORPSE_A, "bad_sig" },
      { ADDR_INVENTORY, 0x01020304u, 0u, "valid_null" },
      { ADDR_INVENTORY, 0x01020304u, ADDR_CORPSE_A, "valid_corpse_a" }
    };
    for (int i = 0; i < 4; i++) {
      w32(ADDR_INVENTORY + 0x00, cases[i].sig);
      w32(ADDR_INVENTORY + 0x34, cases[i].first_c);
      uint32_t st[1] = { cases[i].ptr };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, cases[i].ptr);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 1, pre);
    }
  }

  /* 5. 0x6FD6DE50 INVENTORY_GetLeftItemGuid */
  {
    const uint32_t va = 0x6FD6DE50u;
    const char *nm = "INVENTORY_GetLeftItemGuid";
    RangeSpec r[1] = { { ADDR_INVENTORY, 64 } };
    memset((void *)(uintptr_t)ADDR_INVENTORY, 0, 64);

    struct { uint32_t ptr; uint32_t sig; uint32_t guid; const char *cid; } cases[5] = {
      { 0u, 0x01020304u, 0x12345678u, "null_inv" },
      { ADDR_INVENTORY, 0x01020305u, 0x77u, "bad_sig" },
      { ADDR_INVENTORY, 0x01020304u, 0u, "valid_0" },
      { ADDR_INVENTORY, 0x01020304u, 0x12345678u, "valid_guid" },
      { ADDR_INVENTORY, 0x01020304u, 0xFFFFFFFFu, "valid_ffffffff" }
    };
    for (int i = 0; i < 5; i++) {
      w32(ADDR_INVENTORY + 0x00, cases[i].sig);
      w32(ADDR_INVENTORY + 0x24, cases[i].guid);
      uint32_t st[1] = { cases[i].ptr };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, cases[i].ptr);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 1, pre);
    }
  }

  /* 6. 0x6FD6DE70 INVENTORY_SetLeftItemGuid */
  {
    const uint32_t va = 0x6FD6DE70u;
    const char *nm = "INVENTORY_SetLeftItemGuid";
    RangeSpec r[1] = { { ADDR_INVENTORY, 64 } };
    memset((void *)(uintptr_t)ADDR_INVENTORY, 0, 64);

    struct { uint32_t ptr; uint32_t sig; uint32_t guid; const char *cid; } cases[4] = {
      { 0u, 0x01020304u, 0xCAFEBABEu, "null_inv_noop" },
      { ADDR_INVENTORY, 0xBAD00000u, 0xCAFEBABEu, "bad_sig_noop" },
      { ADDR_INVENTORY, 0x01020304u, 0xCAFEBABEu, "valid_set_guid" },
      { ADDR_INVENTORY, 0x01020304u, 0u, "valid_clear_guid" }
    };
    for (int i = 0; i < 4; i++) {
      w32(ADDR_INVENTORY + 0x00, cases[i].sig);
      uint32_t st[2] = { cases[i].ptr, cases[i].guid };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall2(va, cases[i].ptr, cases[i].guid);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "void", 0, 0, 0, 0, 0, st, 2, eax, r, 1, pre);
    }
  }

  /* 7. 0x6FD6DE90 INVENTORY_GetItemCount */
  {
    const uint32_t va = 0x6FD6DE90u;
    const char *nm = "INVENTORY_GetItemCount";
    RangeSpec r[1] = { { ADDR_INVENTORY, 64 } };
    memset((void *)(uintptr_t)ADDR_INVENTORY, 0, 64);

    struct { uint32_t ptr; uint32_t sig; uint32_t cnt; const char *cid; } cases[4] = {
      { 0u, 0x01020304u, 17u, "null_inv" },
      { ADDR_INVENTORY, 0u, 17u, "bad_sig" },
      { ADDR_INVENTORY, 0x01020304u, 0u, "valid_0" },
      { ADDR_INVENTORY, 0x01020304u, 17u, "valid_17" }
    };
    for (int i = 0; i < 4; i++) {
      w32(ADDR_INVENTORY + 0x00, cases[i].sig);
      w32(ADDR_INVENTORY + 0x28, cases[i].cnt);
      uint32_t st[1] = { cases[i].ptr };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, cases[i].ptr);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 1, pre);
    }
  }

  /* 8. 0x6FD6DEB0 INVENTORY_GetNodeItemGuid */
  {
    const uint32_t va = 0x6FD6DEB0u;
    const char *nm = "INVENTORY_GetNodeItemGuid";
    RangeSpec r[1] = { { ADDR_NODE_A, 8 } };
    memset((void *)(uintptr_t)ADDR_NODE_A, 0, 8);

    struct { uint32_t ptr; uint32_t guid; const char *cid; } cases[4] = {
      { 0u, 999u, "null_node" },
      { ADDR_NODE_A, 0u, "node_guid_0" },
      { ADDR_NODE_A, 999u, "node_guid_999" },
      { ADDR_NODE_A, 0xFFFFFFFFu, "node_guid_max" }
    };
    for (int i = 0; i < 4; i++) {
      w32(ADDR_NODE_A + 0x00, cases[i].guid);
      uint32_t st[1] = { cases[i].ptr };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, cases[i].ptr);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 1, pre);
    }
  }

  /* 9. 0x6FD6DEC0 INVENTORY_GetNextNode */
  {
    const uint32_t va = 0x6FD6DEC0u;
    const char *nm = "INVENTORY_GetNextNode";
    RangeSpec r[1] = { { ADDR_NODE_A, 8 } };
    memset((void *)(uintptr_t)ADDR_NODE_A, 0, 8);

    struct { uint32_t ptr; uint32_t nxt; const char *cid; } cases[4] = {
      { 0u, ADDR_NODE_B, "null_node" },
      { ADDR_NODE_A, 0u, "next_null" },
      { ADDR_NODE_A, ADDR_NODE_B, "next_node_b" },
      { ADDR_NODE_A, 0xCAFEBABEu, "next_node_cafebabe" }
    };
    for (int i = 0; i < 4; i++) {
      w32(ADDR_NODE_A + 0x04, cases[i].nxt);
      uint32_t st[1] = { cases[i].ptr };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, cases[i].ptr);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 1, pre);
    }
  }

  /* 10. 0x6FD6DEE0 INVENTORY_CheckNodeExists */
  {
    const uint32_t va = 0x6FD6DEE0u;
    const char *nm = "INVENTORY_CheckNodeExists";
    RangeSpec r[4] = {
      { ADDR_INVENTORY, 64 },
      { ADDR_NODE_A, 8 },
      { ADDR_NODE_B, 8 },
      { ADDR_NODE_C, 8 }
    };
    memset((void *)(uintptr_t)ADDR_INVENTORY, 0, 64);
    w32(ADDR_NODE_A + 0x00, 101u); w32(ADDR_NODE_A + 0x04, ADDR_NODE_B);
    w32(ADDR_NODE_B + 0x00, 202u); w32(ADDR_NODE_B + 0x04, ADDR_NODE_C);
    w32(ADDR_NODE_C + 0x00, 303u); w32(ADDR_NODE_C + 0x04, 0u);

    struct { uint32_t ptr; uint32_t sig; uint32_t head; uint32_t id; const char *cid; } cases[7] = {
      { 0u, 0x01020304u, ADDR_NODE_A, 101u, "null_inv" },
      { ADDR_INVENTORY, 0x1234u, ADDR_NODE_A, 101u, "bad_sig" },
      { ADDR_INVENTORY, 0x01020304u, 0u, 101u, "empty_list" },
      { ADDR_INVENTORY, 0x01020304u, ADDR_NODE_A, 101u, "match_head_101" },
      { ADDR_INVENTORY, 0x01020304u, ADDR_NODE_A, 202u, "match_mid_202" },
      { ADDR_INVENTORY, 0x01020304u, ADDR_NODE_A, 303u, "match_tail_303" },
      { ADDR_INVENTORY, 0x01020304u, ADDR_NODE_A, 404u, "not_found_404" }
    };
    for (int i = 0; i < 7; i++) {
      w32(ADDR_INVENTORY + 0x00, cases[i].sig);
      w32(ADDR_INVENTORY + 0x2C, cases[i].head);
      uint32_t st[2] = { cases[i].ptr, cases[i].id };
      capture_pre(r, 4, pre);
      uint32_t eax = call_stdcall2(va, cases[i].ptr, cases[i].id);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 2, eax, r, 4, pre);
    }
  }

  /* 11. 0x6FD6DF70 INVENTORY_GetFirstNode */
  {
    const uint32_t va = 0x6FD6DF70u;
    const char *nm = "INVENTORY_GetFirstNode";
    RangeSpec r[1] = { { ADDR_INVENTORY, 64 } };
    memset((void *)(uintptr_t)ADDR_INVENTORY, 0, 64);

    struct { uint32_t ptr; uint32_t sig; uint32_t head; const char *cid; } cases[4] = {
      { 0u, 0x01020304u, ADDR_NODE_A, "null_inv" },
      { ADDR_INVENTORY, 0u, ADDR_NODE_A, "bad_sig" },
      { ADDR_INVENTORY, 0x01020304u, 0u, "valid_null" },
      { ADDR_INVENTORY, 0x01020304u, ADDR_NODE_A, "valid_node_a" }
    };
    for (int i = 0; i < 4; i++) {
      w32(ADDR_INVENTORY + 0x00, cases[i].sig);
      w32(ADDR_INVENTORY + 0x2C, cases[i].head);
      uint32_t st[1] = { cases[i].ptr };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, cases[i].ptr);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 1, pre);
    }
  }

  /* 12. 0x6FD6DF90 INVENTORY_NoOpRet8A */
  {
    const uint32_t va = 0x6FD6DF90u;
    const char *nm = "INVENTORY_NoOpRet8A";
    RangeSpec r[1] = { { ADDR_INVENTORY, 64 } };
    uint32_t pairs[4][2] = {
      { 0u, 0u },
      { ADDR_INVENTORY, 1u },
      { 0xFFFFFFFFu, 0xFFFFFFFFu },
      { 0x12345678u, 0x9ABCDEF0u }
    };
    const char *cids[4] = { "zeros", "inv_and_1", "all_ones", "alternating" };
    for (int i = 0; i < 4; i++) {
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall2(va, pairs[i][0], pairs[i][1]);
      emit_case_json(fp, &first, va, nm, cids[i], "void", 0, 0, 0, 0, 0, pairs[i], 2, eax, r, 1, pre);
    }
  }

  /* 13. 0x6FD6DFB0 INVENTORY_GetCursorItem */
  {
    const uint32_t va = 0x6FD6DFB0u;
    const char *nm = "INVENTORY_GetCursorItem";
    RangeSpec r[1] = { { ADDR_INVENTORY, 64 } };
    memset((void *)(uintptr_t)ADDR_INVENTORY, 0, 64);

    struct { uint32_t ptr; uint32_t sig; uint32_t cur; const char *cid; } cases[4] = {
      { 0u, 0x01020304u, ADDR_UNIT_A, "null_inv" },
      { ADDR_INVENTORY, 0xFFFFFFFFu, ADDR_UNIT_A, "bad_sig" },
      { ADDR_INVENTORY, 0x01020304u, 0u, "valid_null" },
      { ADDR_INVENTORY, 0x01020304u, ADDR_UNIT_A, "valid_cursor_item" }
    };
    for (int i = 0; i < 4; i++) {
      w32(ADDR_INVENTORY + 0x00, cases[i].sig);
      w32(ADDR_INVENTORY + 0x20, cases[i].cur);
      uint32_t st[1] = { cases[i].ptr };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, cases[i].ptr);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 1, pre);
    }
  }

  /* 14. 0x6FD6DFD0 INVENTORY_NoOpRet8B */
  {
    const uint32_t va = 0x6FD6DFD0u;
    const char *nm = "INVENTORY_NoOpRet8B";
    RangeSpec r[1] = { { ADDR_INVENTORY, 64 } };
    uint32_t pairs[4][2] = {
      { 0u, 0u },
      { ADDR_INVENTORY, 1u },
      { 0xFFFFFFFFu, 0xFFFFFFFFu },
      { 0x12345678u, 0x9ABCDEF0u }
    };
    const char *cids[4] = { "zeros", "inv_and_1", "all_ones", "alternating" };
    for (int i = 0; i < 4; i++) {
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall2(va, pairs[i][0], pairs[i][1]);
      emit_case_json(fp, &first, va, nm, cids[i], "void", 0, 0, 0, 0, 0, pairs[i], 2, eax, r, 1, pre);
    }
  }

  /* 15. 0x6FD6DFF0 INVENTORY_NoOpRet20 */
  {
    const uint32_t va = 0x6FD6DFF0u;
    const char *nm = "INVENTORY_NoOpRet20";
    RangeSpec r[1] = { { ADDR_INVENTORY, 64 } };
    uint32_t args[4][8] = {
      { 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u },
      { ADDR_INVENTORY, 1u, 2u, 3u, 4u, 5u, 6u, 7u },
      { 0xFFFFFFFFu, 0xFFFFFFFFu, 0xFFFFFFFFu, 0xFFFFFFFFu, 0xFFFFFFFFu, 0xFFFFFFFFu, 0xFFFFFFFFu, 0xFFFFFFFFu },
      { 0xAAAAAAAAu, 0x55555555u, 0x12345678u, 0x9ABCDEF0u, 10u, 20u, 30u, 40u }
    };
    const char *cids[4] = { "all_zeros", "seq_inv_to_7", "all_ones", "alternating" };
    for (int i = 0; i < 4; i++) {
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall8(va, args[i][0], args[i][1], args[i][2], args[i][3], args[i][4], args[i][5], args[i][6], args[i][7]);
      emit_case_json(fp, &first, va, nm, cids[i], "void", 0, 0, 0, 0, 0, args[i], 8, eax, r, 1, pre);
    }
  }

  /* 16. 0x6FD6E010 INVENTORY_ScoreGridRectPlacement */
  {
    const uint32_t va = 0x6FD6E010u;
    const char *nm = "INVENTORY_ScoreGridRectPlacement";
    RangeSpec r[2] = { { ADDR_GRID, 16 }, { ADDR_GRID_CELLS, 256 } };
    memset((void *)(uintptr_t)ADDR_GRID, 0, 16);
    memset((void *)(uintptr_t)ADDR_GRID_CELLS, 0, 256);
    w8(ADDR_GRID + 0x08, 10u); /* nGridWidth = 10 */
    w8(ADDR_GRID + 0x09, 4u);  /* nGridHeight = 4 */
    w32(ADDR_GRID + 0x0C, ADDR_GRID_CELLS);

    struct { uint32_t y; uint32_t h; uint32_t x; uint32_t w; int mode; const char *cid; } cases[6] = {
      { 1u, 2u, 2u, 2u, 0, "interior_2x2_empty_returns_0" },
      { 0u, 3u, 0u, 2u, 0, "top_left_2x3_empty_returns_5" },
      { 2u, 2u, 8u, 2u, 0, "bottom_right_2x2_empty_returns_4" },
      { 1u, 2u, 2u, 2u, 1, "interior_2x2_partial_neighbors_returns_4" },
      { 0u, 1u, 0u, 1u, 2, "top_left_1x1_enclosed_clamps_0xff" },
      { 0u, 4u, 0u, 10u, 0, "full_grid_10x4_clamps_0xff" }
    };
    for (int i = 0; i < 6; i++) {
      memset((void *)(uintptr_t)ADDR_GRID_CELLS, 0, 256);
      if (cases[i].mode == 1) {
        w32(ADDR_GRID_CELLS + (1 * 10 + 1) * 4, ADDR_UNIT_A); /* left (1,1) */
        w32(ADDR_GRID_CELLS + (2 * 10 + 4) * 4, ADDR_UNIT_A); /* right (4,2) */
        w32(ADDR_GRID_CELLS + (0 * 10 + 2) * 4, ADDR_UNIT_B); /* top (2,0) */
        w32(ADDR_GRID_CELLS + (3 * 10 + 3) * 4, ADDR_UNIT_C); /* bottom (3,3) */
      } else if (cases[i].mode == 2) {
        w32(ADDR_GRID_CELLS + (0 * 10 + 1) * 4, ADDR_UNIT_A); /* right (1,0) */
        w32(ADDR_GRID_CELLS + (1 * 10 + 0) * 4, ADDR_UNIT_B); /* bottom (0,1) */
      }
      uint32_t st[3] = { ADDR_GRID, cases[i].x, cases[i].w };
      capture_pre(r, 2, pre);
      uint32_t eax = call_eax_ecx_stack3_ret0c(va, cases[i].y, cases[i].h, ADDR_GRID, cases[i].x, cases[i].w);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", cases[i].y, cases[i].h, 0, 0, 0, st, 3, eax, r, 2, pre);
    }
  }

  /* 17. 0x6FD6E190 INVENTORY_GetFirstItem */
  {
    const uint32_t va = 0x6FD6E190u;
    const char *nm = "INVENTORY_GetFirstItem";
    RangeSpec r[1] = { { ADDR_INVENTORY, 64 } };
    memset((void *)(uintptr_t)ADDR_INVENTORY, 0, 64);

    struct { uint32_t ptr; uint32_t sig; uint32_t item; const char *cid; } cases[4] = {
      { 0u, 0x01020304u, ADDR_UNIT_A, "null_inv" },
      { ADDR_INVENTORY, 0x01020300u, ADDR_UNIT_A, "bad_sig" },
      { ADDR_INVENTORY, 0x01020304u, 0u, "valid_null" },
      { ADDR_INVENTORY, 0x01020304u, ADDR_UNIT_A, "valid_item_a" }
    };
    for (int i = 0; i < 4; i++) {
      w32(ADDR_INVENTORY + 0x00, cases[i].sig);
      w32(ADDR_INVENTORY + 0x0C, cases[i].item);
      uint32_t st[1] = { cases[i].ptr };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, cases[i].ptr);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 1, pre);
    }
  }

  /* 18. 0x6FD6E310 INVENTORY_FillGridRect */
  {
    const uint32_t va = 0x6FD6E310u;
    const char *nm = "INVENTORY_FillGridRect";
    RangeSpec r[2] = { { ADDR_GRID, 16 }, { ADDR_GRID_CELLS, 128 } };
    memset((void *)(uintptr_t)ADDR_GRID, 0, 16);
    memset((void *)(uintptr_t)ADDR_GRID_CELLS, 0, 128);
    w8(ADDR_GRID + 0x08, 6u); /* nGridWidth = 6 */
    w8(ADDR_GRID + 0x09, 4u); /* nGridHeight = 4 */
    w32(ADDR_GRID + 0x0C, ADDR_GRID_CELLS);

    struct { uint32_t h; uint32_t y; uint32_t x; uint32_t w; uint32_t item; const char *cid; } cases[5] = {
      { 0u, 1u, 1u, 2u, ADDR_UNIT_A, "height_zero_noop" },
      { 2u, 1u, 1u, 0u, ADDR_UNIT_A, "width_zero_noop" },
      { 3u, 1u, 2u, 2u, ADDR_UNIT_A, "fill_2x3_rect" },
      { 2u, 1u, 2u, 2u, 0u, "clear_2x2_subrect_to_zero" },
      { 0xFF01u, 0u, 0u, 0xFF02u, ADDR_UNIT_B, "high_bytes_in_h_and_w_masked" }
    };
    for (int i = 0; i < 5; i++) {
      uint32_t st[3] = { ADDR_GRID, cases[i].w, cases[i].item };
      capture_pre(r, 2, pre);
      uint32_t eax = call_eax_ecx_edx_stack3_ret0c(va, cases[i].h, cases[i].y, cases[i].x, ADDR_GRID, cases[i].w, cases[i].item);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "void", cases[i].h, cases[i].y, cases[i].x, 0, 0, st, 3, eax, r, 2, pre);
    }
  }
}

static void emit_b011(FILE *fp) {
  int first = 1;
  uint8_t *pre[8];

  /* 1. 0x6FD68220 CHAT_CopyHoverMsg (__stdcall(pHoverMsg, szDest), void) */
  {
    const uint32_t va = 0x6FD68220u;
    const char *nm = "CHAT_CopyHoverMsg";
    RangeSpec r[2] = { { ADDR_HOVER_MSG, 272 }, { ADDR_HOVER_DEST, 64 } };
    const char *msgs[4] = {
      "",
      "Hi!",
      "Stay awhile and listen!",
      "Diablo II Lord of Destruction v1.13c Hover Message Test String!"
    };
    const char *cids[4] = { "empty_string", "short_hi", "stay_awhile", "long_63_chars" };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_HOVER_MSG, 0, 272);
      memset((void *)(uintptr_t)ADDR_HOVER_DEST, 0xCC, 64);
      w32(ADDR_HOVER_MSG + 0x00, 100u);
      w32(ADDR_HOVER_MSG + 0x04, 350u);
      w8(ADDR_HOVER_MSG + 0x08, 0u);
      w32(ADDR_HOVER_MSG + 0x0C, 1u);
      strcpy((char *)(uintptr_t)(ADDR_HOVER_MSG + 0x10), msgs[i]);
      uint32_t st[2] = { ADDR_HOVER_MSG, ADDR_HOVER_DEST };
      capture_pre(r, 2, pre);
      uint32_t eax = call_stdcall2(va, ADDR_HOVER_MSG, ADDR_HOVER_DEST);
      emit_case_json(fp, &first, va, nm, cids[i], "void", 0, 0, 0, 0, 0, st, 2, eax, r, 2, pre);
    }
  }

  /* 2. 0x6FD68240 CHAT_GetTimeoutFromHoverMsg (__stdcall(pHoverMsg) -> eax) */
  {
    const uint32_t va = 0x6FD68240u;
    const char *nm = "CHAT_GetTimeoutFromHoverMsg";
    RangeSpec r[1] = { { ADDR_HOVER_MSG, 32 } };
    uint32_t timeouts[4] = { 0u, 125u, 0x7FFFFFFFu, 0xDEADBEEFu };
    const char *cids[4] = { "timeout_0", "timeout_125", "timeout_max_pos", "timeout_deadbeef" };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_HOVER_MSG, 0, 32);
      w32(ADDR_HOVER_MSG + 0x00, 50u);
      w32(ADDR_HOVER_MSG + 0x04, timeouts[i]);
      uint32_t st[1] = { ADDR_HOVER_MSG };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, ADDR_HOVER_MSG);
      emit_case_json(fp, &first, va, nm, cids[i], "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 1, pre);
    }
  }

  /* 3. 0x6FD6A660 MONSTERS_IsTownOrFriendlyUnit (edx = pUnit -> eax) */
  {
    const uint32_t va = 0x6FD6A660u;
    const char *nm = "MONSTERS_IsTownOrFriendlyUnit";
    setup_synthetic_datatables();
    /* Configure MonStats[0..3].bFlags1 (+0x0D) */
    w8(ADDR_MONSTATS + 0 * 0x1A8 + 0x0D, 0x00u); /* neither bit 0 nor bit 2 */
    w8(ADDR_MONSTATS + 1 * 0x1A8 + 0x0D, 0x01u); /* bit 0 set (gdwBitMasks[0]) */
    w8(ADDR_MONSTATS + 2 * 0x1A8 + 0x0D, 0x04u); /* bit 2 set (gdwBitMasks[2]) */
    w8(ADDR_MONSTATS + 3 * 0x1A8 + 0x0D, 0xFB0u & 0xFFu); /* bits 0 and 2 clear */

    RangeSpec r[5] = {
      { VA_SGPT_DATATABLES, 4 },
      { VA_GDWBITMASKS_IAT, 4 },
      { ADDR_BITMASKS, 16 },
      { ADDR_DATATABLES + 0xA78, 12 },
      { ADDR_UNIT_A, 244 }
    };
    struct { uint32_t ptr; uint32_t utype; uint32_t cid; uint32_t uflags; const char *name; } cases[8] = {
      { 0u, 1u, 0u, 0u, "null_unit" },
      { ADDR_UNIT_A, 0u, 1u, 0u, "non_monster_type_0" },
      { ADDR_UNIT_A, 1u, 0xFFFFFFFFu, 0u, "negative_class_id" },
      { ADDR_UNIT_A, 1u, 4u, 0u, "oob_class_id_4" },
      { ADDR_UNIT_A, 1u, 1u, 0u, "monstats_bflags1_bit0_set" },
      { ADDR_UNIT_A, 1u, 2u, 0u, "monstats_bflags1_bit2_set" },
      { ADDR_UNIT_A, 1u, 0u, 0x80000000u, "unit_flags_bit31_set" },
      { ADDR_UNIT_A, 1u, 3u, 0x7FFFFFFFu, "hostile_monster_returns_0" }
    };
    RangeSpec r_full[6] = {
      { VA_SGPT_DATATABLES, 4 },
      { VA_GDWBITMASKS_IAT, 4 },
      { ADDR_BITMASKS, 128 },
      { ADDR_DATATABLES + 0xA78, 12 },
      { ADDR_MONSTATS, 4 * 0x1A8 },
      { ADDR_UNIT_A, 244 }
    };
    (void)r;
    for (int i = 0; i < 8; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT_A, 0, 244);
      w32(ADDR_UNIT_A + 0x00, cases[i].utype);
      w32(ADDR_UNIT_A + 0x04, cases[i].cid);
      w32(ADDR_UNIT_A + 0xC4, cases[i].uflags);
      capture_pre(r_full, 6, pre);
      uint32_t eax = call_edx(va, cases[i].ptr);
      emit_case_json(fp, &first, va, nm, cases[i].name, "eax", 0, 0, cases[i].ptr, 0, 0, NULL, 0, eax, r_full, 6, pre);
    }
  }

  /* 4. 0x6FD7C990 HIRELING_GetExpForLevel (__stdcall(nLevel, nExpPerLvl) -> eax) */
  {
    const uint32_t va = 0x6FD7C990u;
    const char *nm = "HIRELING_GetExpForLevel";
    RangeSpec r[1] = { { ADDR_FLAGS_BOX, 4 } };
    uint32_t pairs[5][2] = {
      { 0u, 100u },
      { 1u, 110u },
      { 10u, 120u },
      { 98u, 150u },
      { 500u, 100000u }
    };
    const char *cids[5] = { "level_0", "level_1", "level_10", "level_98", "level_500_wrap32" };
    for (int i = 0; i < 5; i++) {
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall2(va, pairs[i][0], pairs[i][1]);
      emit_case_json(fp, &first, va, nm, cids[i], "eax", 0, 0, 0, 0, 0, pairs[i], 2, eax, r, 1, pre);
    }
  }

  /* 5. 0x6FD7D210 DRLG_SetWarpId (eax = pWarp, ebx = nVis, ecx = nIndex, [esp+4] = nWarpId, ret 4, void)
   * Note: ebx (nVis) is recorded in regs.edx in the JSON vector.
   * Captures [ADDR_WARP - 0x10, ADDR_WARP + 0x60] (112 bytes) so out-of-range writes (nIndex = -1, -2, 9) are verified byte-for-byte.
   */
  {
    const uint32_t va = 0x6FD7D210u;
    const char *nm = "DRLG_SetWarpId";
    RangeSpec r[1] = { { ADDR_WARP - 0x10u, 0x70u } };
    struct { uint32_t vis; uint32_t idx; uint32_t warp_id; int setup_mode; const char *cid; } cases[12] = {
      { 3u, 0xFFFFFFFFu, 42u, 0, "update_existing_vis_slot_0" },
      { 7u, 0xFFFFFFFFu, 99u, 0, "update_existing_vis_slot_5" },
      { 5u, 0xFFFFFFFFu, 17u, 0, "insert_first_empty_slot_1" },
      { 8u, 0xFFFFFFFFu, 88u, 1, "insert_second_unrolled_chunk_slot_6" },
      { 4u, 3u, 55u, 0, "explicit_index_3_override" },
      { 6u, 0xFFFFFFFFu, 60u, 2, "free_slot_mod4_eq_0_slot_0" },
      { 6u, 0xFFFFFFFFu, 61u, 3, "reserved_slot_0_skips_to_free_slot_1" },
      { 6u, 0xFFFFFFFFu, 62u, 4, "free_slot_mod4_eq_2_slot_2" },
      { 6u, 0xFFFFFFFFu, 63u, 5, "free_slot_mod4_eq_3_slot_3" },
      { 99u, 0xFFFFFFFFu, 777u, 6, "full_array_idx_neg1_clobbers_select_and_vis7" },
      { 11u, 9u, 222u, 0, "explicit_index_9_oob_high" },
      { 12u, (uint32_t)-2, 333u, 0, "explicit_index_neg2_oob_low" }
    };
    for (int i = 0; i < 12; i++) {
      memset((void *)(uintptr_t)(ADDR_WARP - 0x10u), 0xCC, 0x70u);
      memset((void *)(uintptr_t)ADDR_WARP, 0, 72);
      w32(ADDR_WARP + 0x00, 0x11111111u); /* nSelect */
      for (int k = 0; k < 8; k++) {
        w32(ADDR_WARP + 0x04 + k * 4, 0u);
        w32(ADDR_WARP + 0x24 + k * 4, 0xFFFFFFFFu);
      }
      if (cases[i].setup_mode == 0) {
        w32(ADDR_WARP + 0x04 + 0 * 4, 3u);
        w32(ADDR_WARP + 0x24 + 0 * 4, 10u);
        w32(ADDR_WARP + 0x04 + 5 * 4, 7u);
        w32(ADDR_WARP + 0x24 + 5 * 4, 50u);
      } else if (cases[i].setup_mode == 1) {
        /* Fill slots 0..5 so first empty is slot 6 */
        for (int k = 0; k < 6; k++) {
          w32(ADDR_WARP + 0x04 + k * 4, (uint32_t)(k + 1));
          w32(ADDR_WARP + 0x24 + k * 4, (uint32_t)(100 + k));
        }
      } else if (cases[i].setup_mode == 2) {
        /* All slots empty (slot 0 is first free, k % 4 == 0) */
      } else if (cases[i].setup_mode == 3) {
        /* Slot 0 is reserved: nVis[0] == 0 && nWarp[0] != -1 (25), so scan skips slot 0 and picks slot 1 (k % 4 == 1) */
        w32(ADDR_WARP + 0x04 + 0 * 4, 0u);
        w32(ADDR_WARP + 0x24 + 0 * 4, 25u);
      } else if (cases[i].setup_mode == 4) {
        /* Slot 0 occupied, slot 1 reserved -> picks slot 2 (k % 4 == 2) */
        w32(ADDR_WARP + 0x04 + 0 * 4, 1u);
        w32(ADDR_WARP + 0x24 + 0 * 4, 10u);
        w32(ADDR_WARP + 0x04 + 1 * 4, 0u);
        w32(ADDR_WARP + 0x24 + 1 * 4, 25u);
      } else if (cases[i].setup_mode == 5) {
        /* Slots 0..2 occupied/reserved -> picks slot 3 (k % 4 == 3) */
        for (int k = 0; k < 3; k++) {
          w32(ADDR_WARP + 0x04 + k * 4, (uint32_t)(k + 1));
          w32(ADDR_WARP + 0x24 + k * 4, (uint32_t)(10 + k));
        }
      } else if (cases[i].setup_mode == 6) {
        /* All 8 slots full (nVis[0..7] = 1..8) -> idx stays -1, writes to pWarp + 0 and pWarp + 0x20 */
        for (int k = 0; k < 8; k++) {
          w32(ADDR_WARP + 0x04 + k * 4, (uint32_t)(k + 1));
          w32(ADDR_WARP + 0x24 + k * 4, (uint32_t)(100 + k));
        }
      }
      uint32_t st[1] = { cases[i].warp_id };
      capture_pre(r, 1, pre);
      uint32_t eax = call_eax_ebx_ecx_stack1_ret4(va, ADDR_WARP, cases[i].vis, cases[i].idx, cases[i].warp_id);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "void", ADDR_WARP, cases[i].idx, cases[i].vis, 0, 0, st, 1, eax, r, 1, pre);
    }
  }

  /* 6. 0x6FD7E6B0 ANIMSEQ_GetEventAtFrame (__stdcall(pSeqRecord, dwFrameFp8, pEventOut), void) */
  {
    const uint32_t va = 0x6FD7E6B0u;
    const char *nm = "ANIMSEQ_GetEventAtFrame";
    RangeSpec r[2] = { { ADDR_ANIMSEQ, 48 }, { ADDR_ANIM_OUT, 16 } };
    memset((void *)(uintptr_t)ADDR_ANIMSEQ, 0, 48);
    for (int k = 0; k < 8; k++) {
      uint32_t rec = ADDR_ANIMSEQ + k * 6;
      w16(rec + 0, (uint16_t)(k + 1));
      w8(rec + 2, (uint8_t)(k + 10));
      w8(rec + 3, (uint8_t)(k * 2));
      w8(rec + 4, (uint8_t)(k & 7));
      w8(rec + 5, (uint8_t)(k == 2 ? 1 : (k == 5 ? 4 : (k == 6 ? 0x85u : 0))));
    }
    struct { uint32_t seq; uint32_t fp8; const char *cid; } cases[6] = {
      { 0u, 0x0200u, "null_seq_record" },
      { ADDR_ANIMSEQ, 0x0000u, "frame_0_event_0" },
      { ADDR_ANIMSEQ, 0x0280u, "frame_2_event_1" },
      { ADDR_ANIMSEQ, 0x05FFu, "frame_5_event_4" },
      { ADDR_ANIMSEQ + 18u, 0xFFFFFF80u, "negative_frame_minus_1_reads_slot_2" },
      { ADDR_ANIMSEQ, 0x0600u, "frame_6_event_0x85_unsigned_movzx" }
    };
    for (int i = 0; i < 6; i++) {
      w32(ADDR_ANIM_OUT, 0xDEADBEEFu);
      uint32_t st[3] = { cases[i].seq, cases[i].fp8, ADDR_ANIM_OUT };
      capture_pre(r, 2, pre);
      uint32_t eax = call_stdcall3(va, cases[i].seq, cases[i].fp8, ADDR_ANIM_OUT);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "void", 0, 0, 0, 0, 0, st, 3, eax, r, 2, pre);
    }
  }

  /* 7. 0x6FD7E6E0 ANIMSEQ_EvaluateSequenceFrame (__stdcall 7 args, void) */
  {
    const uint32_t va = 0x6FD7E6E0u;
    const char *nm = "ANIMSEQ_EvaluateSequenceFrame";
    RangeSpec r[2] = { { ADDR_ANIMSEQ, 48 }, { ADDR_ANIM_OUT, 16 } };
    memset((void *)(uintptr_t)ADDR_ANIMSEQ, 0, 48);
    /* Populate 8 records: events at idx 1 -> 2, idx 2 -> 0, idx 3 -> 0, idx 4 -> 3, idx 5 -> 0 */
    uint8_t evs[8] = { 1, 2, 0, 0, 3, 0, 4, 0 };
    for (int k = 0; k < 8; k++) {
      uint32_t rec = ADDR_ANIMSEQ + k * 6;
      w16(rec + 0, (uint16_t)k);
      w8(rec + 2, (uint8_t)(k + 1));       /* nMode */
      w8(rec + 3, (uint8_t)(k * 3 + 2));   /* nFrame */
      w8(rec + 4, (uint8_t)((k + 5) & 7)); /* nDir */
      w8(rec + 5, evs[k]);                 /* nEvent */
    }
    struct { uint32_t seq; uint32_t curr; uint32_t prev; const char *cid; } cases[6] = {
      { 0u, 0x0400u, 0x0100u, "null_seq_zeros_all_outputs" },
      { ADDR_ANIMSEQ, 0x0180u, 0x0180u, "same_curr_and_prev_fp8_reads_direct" },
      { ADDR_ANIMSEQ, 0x01FFu, 0x0100u, "same_frame_idx_diff_subframe_event_0" },
      { ADDR_ANIMSEQ, 0x0140u, 0x0080u, "advance_0_to_1_event_2" },
      { ADDR_ANIMSEQ, 0x0520u, 0x0000u, "advance_0_to_5_picks_last_nonzero_event_3" },
      { ADDR_ANIMSEQ, 0x0380u, 0x0180u, "advance_1_to_3_all_zero_events" }
    };
    for (int i = 0; i < 6; i++) {
      w32(ADDR_ANIM_OUT + 0x00, 0xAAAAAAAAu);
      w32(ADDR_ANIM_OUT + 0x04, 0xBBBBBBBBu);
      w32(ADDR_ANIM_OUT + 0x08, 0xCCCCCCCCu);
      w32(ADDR_ANIM_OUT + 0x0C, 0xDDDDDDDDu);
      uint32_t st[7] = {
        cases[i].seq,
        cases[i].curr,
        cases[i].prev,
        ADDR_ANIM_OUT + 0x00,
        ADDR_ANIM_OUT + 0x04,
        ADDR_ANIM_OUT + 0x08,
        ADDR_ANIM_OUT + 0x0C
      };
      capture_pre(r, 2, pre);
      uint32_t eax = call_stdcall7(va, st[0], st[1], st[2], st[3], st[4], st[5], st[6]);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "void", 0, 0, 0, 0, 0, st, 7, eax, r, 2, pre);
    }
  }

  /* 8. 0x6FD7E9C0 UNITS_GetStashGoldLimit (__stdcall(pUnit) -> eax) */
  {
    const uint32_t va = 0x6FD7E9C0u;
    const char *nm = "UNITS_GetStashGoldLimit";
    RangeSpec r[1] = { { ADDR_UNIT_A, 32 } };
    uint32_t arg0s[4] = { 0u, ADDR_UNIT_A, ADDR_UNIT_B, 0xFFFFFFFFu };
    const char *cids[4] = { "null_unit", "unit_a", "unit_b", "max_u32" };
    for (int i = 0; i < 4; i++) {
      uint32_t st[1] = { arg0s[i] };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, arg0s[i]);
      emit_case_json(fp, &first, va, nm, cids[i], "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 1, pre);
    }
  }

  /* 9. 0x6FD7ED30 UNITS_HasObjectSubClassBit0 (__stdcall(pUnit) -> eax) */
  {
    const uint32_t va = 0x6FD7ED30u;
    const char *nm = "UNITS_HasObjectSubClassBit0";
    RangeSpec r[3] = { { ADDR_UNIT_A, 32 }, { ADDR_OBJDATA, 56 }, { ADDR_OBJTXT, 448 } };
    struct { uint32_t utype; uint8_t sub; const char *cid; } cases[5] = {
      { 0u, 0x01u, "unit_type_0_player_returns_0" },
      { 1u, 0xFFu, "unit_type_1_monster_returns_0" },
      { 2u, 0x00u, "object_subclass_0x00_returns_0" },
      { 2u, 0x01u, "object_subclass_0x01_returns_1" },
      { 2u, 0xFEu, "object_subclass_0xfe_returns_0" }
    };
    for (int i = 0; i < 5; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT_A, 0, 32);
      memset((void *)(uintptr_t)ADDR_OBJDATA, 0, 56);
      memset((void *)(uintptr_t)ADDR_OBJTXT, 0, 448);
      w32(ADDR_UNIT_A + 0x00, cases[i].utype);
      w32(ADDR_UNIT_A + 0x14, ADDR_OBJDATA);
      w32(ADDR_OBJDATA + 0x00, ADDR_OBJTXT);
      w8(ADDR_OBJTXT + 0x167, cases[i].sub);
      uint32_t st[1] = { ADDR_UNIT_A };
      capture_pre(r, 3, pre);
      uint32_t eax = call_stdcall1(va, ADDR_UNIT_A);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 3, pre);
    }
  }

  /* 10. 0x6FD80B40 UNITS_SetAnimSpeed (__stdcall(pUnit, nSpeed), void) */
  {
    const uint32_t va = 0x6FD80B40u;
    const char *nm = "UNITS_SetAnimSpeed";
    RangeSpec r[1] = { { ADDR_UNIT_A + 0x40, 32 } };
    uint32_t speeds[5] = { (uint32_t)-100, 0u, 256u, 0x7FFEu, 0x10000u };
    const char *cids[5] = { "neg_100_clamps_0", "zero_clamps_0", "speed_256", "speed_0x7ffe", "speed_0x10000_clamps_0x7fff" };
    for (int i = 0; i < 5; i++) {
      memset((void *)(uintptr_t)(ADDR_UNIT_A + 0x40), 0, 32);
      w16(ADDR_UNIT_A + 0x4C, 0x1234u);
      uint32_t st[2] = { ADDR_UNIT_A, speeds[i] };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall2(va, ADDR_UNIT_A, speeds[i]);
      emit_case_json(fp, &first, va, nm, cids[i], "void", 0, 0, 0, 0, 0, st, 2, eax, r, 1, pre);
    }
  }

  /* 11. 0x6FD86740 SEED_InitLowSeed (ecx = pSeed, edx = nLowSeed, void) */
  {
    const uint32_t va = 0x6FD86740u;
    const char *nm = "SEED_InitLowSeed";
    RangeSpec r[1] = { { ADDR_SEED, 8 } };
    uint32_t lows[4] = { 0u, 1u, 0x12345678u, 0xFFFFFFFFu };
    const char *cids[4] = { "low_0", "low_1", "low_0x12345678", "low_all_ones" };
    for (int i = 0; i < 4; i++) {
      w32(ADDR_SEED + 0x00, 0xAAAAAAAAu);
      w32(ADDR_SEED + 0x04, 0xBBBBBBBBu);
      capture_pre(r, 1, pre);
      uint32_t eax = call_ecx_edx(va, ADDR_SEED, lows[i]);
      emit_case_json(fp, &first, va, nm, cids[i], "void", 0, ADDR_SEED, lows[i], 0, 0, NULL, 0, eax, r, 1, pre);
    }
  }

  /* 12. 0x6FD86750 SEED_InitSeed (ecx = pSeed, void) */
  {
    const uint32_t va = 0x6FD86750u;
    const char *nm = "SEED_InitSeed";
    RangeSpec r[1] = { { ADDR_SEED, 8 } };
    uint32_t init_vals[4][2] = {
      { 0u, 0u },
      { 0xFFFFFFFFu, 0xFFFFFFFFu },
      { 0x12345678u, 0x9ABCDEF0u },
      { 1u, 0x29Au }
    };
    const char *cids[4] = { "from_zeros", "from_all_ones", "from_arbitrary", "from_already_init" };
    for (int i = 0; i < 4; i++) {
      w32(ADDR_SEED + 0x00, init_vals[i][0]);
      w32(ADDR_SEED + 0x04, init_vals[i][1]);
      capture_pre(r, 1, pre);
      uint32_t eax = call_ecx(va, ADDR_SEED);
      emit_case_json(fp, &first, va, nm, cids[i], "void", 0, ADDR_SEED, 0, 0, 0, NULL, 0, eax, r, 1, pre);
    }
  }

  /* 13. 0x6FD8D4A0 DRLGVER_SnapAndOffsetVertex (ecx = pDstVertex, edx = pSrcVertex, esi = pLevel, void) */
  {
    const uint32_t va = 0x6FD8D4A0u;
    const char *nm = "DRLGVER_SnapAndOffsetVertex";
    RangeSpec r[3] = { { ADDR_VERTEX_SRC, 20 }, { ADDR_VERTEX_DST, 20 }, { ADDR_DRLG_LEVEL, 40 } };
    struct { uint32_t sx; uint32_t sy; uint8_t dir; uint32_t lx; uint32_t ly; int alias; const char *cid; } cases[7] = {
      { 125u, 230u, 0u, 100u, 200u, 0, "dir_0_snaps_x_plus_11" },
      { 125u, 230u, 1u, 100u, 200u, 0, "dir_1_snaps_y_plus_11" },
      { 125u, 230u, 2u, 100u, 200u, 0, "dir_2_snaps_x_minus_5" },
      { 125u, 230u, 3u, 100u, 200u, 0, "dir_3_snaps_y_minus_5" },
      { 85u, 170u, 0u, 100u, 200u, 0, "dir_0_negative_rel_x" },
      { 125u, 230u, 4u, 100u, 200u, 0, "dir_4_no_snap" },
      { 143u, 259u, 2u, 100u, 200u, 1, "aliased_dst_eq_src_dir_2" }
    };
    for (int i = 0; i < 7; i++) {
      memset((void *)(uintptr_t)ADDR_VERTEX_SRC, 0, 20);
      memset((void *)(uintptr_t)ADDR_VERTEX_DST, 0, 20);
      memset((void *)(uintptr_t)ADDR_DRLG_LEVEL, 0, 40);
      w32(ADDR_VERTEX_SRC + 0x00, cases[i].sx);
      w32(ADDR_VERTEX_SRC + 0x04, cases[i].sy);
      w8(ADDR_VERTEX_SRC + 0x08, cases[i].dir);
      w32(ADDR_DRLG_LEVEL + 0x1C, cases[i].lx);
      w32(ADDR_DRLG_LEVEL + 0x20, cases[i].ly);
      uint32_t dst_ptr = cases[i].alias ? ADDR_VERTEX_SRC : ADDR_VERTEX_DST;
      capture_pre(r, 3, pre);
      uint32_t eax = call_ecx_edx_esi(va, dst_ptr, ADDR_VERTEX_SRC, ADDR_DRLG_LEVEL);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "void", 0, dst_ptr, ADDR_VERTEX_SRC, ADDR_DRLG_LEVEL, 0, NULL, 0, eax, r, 3, pre);
    }
  }

  /* 14. 0x6FD937F0 COMPOSIT_GetWeaponClassIdFromCode (__stdcall(dwWeaponClassCode) -> eax) */
  {
    const uint32_t va = 0x6FD937F0u;
    const char *nm = "COMPOSIT_GetWeaponClassIdFromCode";
    RangeSpec r[1] = { { VA_WEAPON_CLASS_TABLE, 104 } };
    uint32_t codes[6] = {
      0x20736831u, /* '1hs ' -> 2 */
      0x20776F62u, /* 'bow ' -> 1 */
      0x20667473u, /* 'stf ' -> 4 */
      0x20327468u, /* 'ht2 ' -> 13 */
      0x20787878u, /* 'xxx ' -> 0 */
      0u           /* 0 -> 0 */
    };
    const char *cids[6] = { "code_1hs", "code_bow", "code_stf", "code_ht2_last", "code_unknown", "code_zero" };
    for (int i = 0; i < 6; i++) {
      uint32_t st[1] = { codes[i] };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, codes[i]);
      emit_case_json(fp, &first, va, nm, cids[i], "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 1, pre);
    }
  }

  /* 15. 0x6FDB7E50 WAYPOINT_GetWaypointNoFromLevelId (__stdcall(nLevelId, pWaypointNoOut) -> eax) */
  {
    const uint32_t va = 0x6FDB7E50u;
    const char *nm = "WAYPOINT_GetWaypointNoFromLevelId";
    setup_synthetic_datatables();
    memset((void *)(uintptr_t)ADDR_LEVELS_TXT, 0, 4 * 0x220);
    w32(ADDR_DATATABLES + 0xC58, ADDR_LEVELS_TXT);
    w32(ADDR_DATATABLES + 0xC5C, 4u);
    w8(ADDR_LEVELS_TXT + 1 * 0x220 + 0xE4, 0u);    /* Level 1 -> waypoint 0 */
    w8(ADDR_LEVELS_TXT + 2 * 0x220 + 0xE4, 0xFFu); /* Level 2 -> no waypoint (0xFF) */
    w8(ADDR_LEVELS_TXT + 3 * 0x220 + 0xE4, 27u);   /* Level 3 -> waypoint 27 */

    RangeSpec r[4] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES + 0xC58, 8 },
      { ADDR_LEVELS_TXT, 4 * 0x220 },
      { ADDR_WP_OUT, 4 }
    };
    uint32_t lvls[6] = { (uint32_t)-1, 0u, 4u, 1u, 2u, 3u };
    const char *cids[6] = {
      "level_neg_1_returns_0",
      "level_0_returns_0",
      "level_4_oob_returns_0",
      "level_1_wp_0_returns_1",
      "level_2_wp_0xff_returns_0",
      "level_3_wp_27_returns_1"
    };
    for (int i = 0; i < 6; i++) {
      w32(ADDR_WP_OUT, 0x12345678u);
      uint32_t st[2] = { lvls[i], ADDR_WP_OUT };
      capture_pre(r, 4, pre);
      uint32_t eax = call_stdcall2(va, lvls[i], ADDR_WP_OUT);
      emit_case_json(fp, &first, va, nm, cids[i], "eax", 0, 0, 0, 0, 0, st, 2, eax, r, 4, pre);
    }
  }
}

static void emit_b017(FILE *fp) {
  int first = 1;
  uint8_t *pre[8];

  /* 1. 0x6FD88000 STATLIST_GetExpireFrame (__stdcall(pStatList) -> eax) */
  {
    const uint32_t va = 0x6FD88000u;
    const char *nm = "STATLIST_GetExpireFrame";
    RangeSpec r[1] = { { ADDR_STATLIST_A, 60 } };
    struct { uint32_t ptr; uint32_t val; const char *cid; } cases[4] = {
      { 0u, 100u, "null_statlist" },
      { ADDR_STATLIST_A, 0u, "expire_frame_0" },
      { ADDR_STATLIST_A, 500u, "expire_frame_500" },
      { ADDR_STATLIST_A, 0xFFFFFFFFu, "expire_frame_all_ones" }
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_STATLIST_A, 0, 60);
      w32(ADDR_STATLIST_A + 0x18, cases[i].val);
      uint32_t st[1] = { cases[i].ptr };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, cases[i].ptr);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 1, pre);
    }
  }

  /* 2. 0x6FD88020 STATLIST_SetExpireFrame (__stdcall(pStatList, nExpireFrame), void) */
  {
    const uint32_t va = 0x6FD88020u;
    const char *nm = "STATLIST_SetExpireFrame";
    RangeSpec r[1] = { { ADDR_STATLIST_A, 60 } };
    struct { uint32_t ptr; uint32_t init_flags; uint32_t frame; const char *cid; } cases[5] = {
      { 0u, 0u, 100u, "null_statlist_noop" },
      { ADDR_STATLIST_A, 0u, (uint32_t)-5, "negative_frame_no_flag_0x2" },
      { ADDR_STATLIST_A, 0u, 0u, "zero_frame_no_flag_0x2" },
      { ADDR_STATLIST_A, 0u, 120u, "positive_frame_sets_flag_0x2" },
      { ADDR_STATLIST_A, 0x80000100u, 300u, "positive_frame_ors_flag_0x2" }
    };
    for (int i = 0; i < 5; i++) {
      memset((void *)(uintptr_t)ADDR_STATLIST_A, 0, 60);
      w32(ADDR_STATLIST_A + 0x10, cases[i].init_flags);
      w32(ADDR_STATLIST_A + 0x18, 0x11111111u);
      uint32_t st[2] = { cases[i].ptr, cases[i].frame };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall2(va, cases[i].ptr, cases[i].frame);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "void", 0, 0, 0, 0, 0, st, 2, eax, r, 1, pre);
    }
  }

  /* 3. 0x6FD88040 STATLIST_GetState (__stdcall(pStatList) -> eax) */
  {
    const uint32_t va = 0x6FD88040u;
    const char *nm = "STATLIST_GetState";
    RangeSpec r[1] = { { ADDR_STATLIST_A, 60 } };
    struct { uint32_t ptr; uint32_t val; const char *cid; } cases[4] = {
      { 0u, 10u, "null_statlist" },
      { ADDR_STATLIST_A, 0u, "state_0" },
      { ADDR_STATLIST_A, 32u, "state_32" },
      { ADDR_STATLIST_A, 184u, "state_184" }
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_STATLIST_A, 0, 60);
      w32(ADDR_STATLIST_A + 0x14, cases[i].val);
      uint32_t st[1] = { cases[i].ptr };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, cases[i].ptr);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 1, pre);
    }
  }

  /* 4. 0x6FD88060 STATLIST_SetState (__stdcall(pStatList, nState), void) */
  {
    const uint32_t va = 0x6FD88060u;
    const char *nm = "STATLIST_SetState";
    RangeSpec r[1] = { { ADDR_STATLIST_A, 60 } };
    struct { uint32_t ptr; uint32_t state; const char *cid; } cases[4] = {
      { 0u, 15u, "null_statlist_noop" },
      { ADDR_STATLIST_A, 0u, "set_state_0" },
      { ADDR_STATLIST_A, 23u, "set_state_23" },
      { ADDR_STATLIST_A, 0xFFFFFFFFu, "set_state_all_ones" }
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_STATLIST_A, 0, 60);
      w32(ADDR_STATLIST_A + 0x14, 99u);
      uint32_t st[2] = { cases[i].ptr, cases[i].state };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall2(va, cases[i].ptr, cases[i].state);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "void", 0, 0, 0, 0, 0, st, 2, eax, r, 1, pre);
    }
  }

  /* 5. 0x6FD88080 STATLIST_GetOwnerId (__stdcall(pStatList) -> eax) */
  {
    const uint32_t va = 0x6FD88080u;
    const char *nm = "STATLIST_GetOwnerId";
    RangeSpec r[1] = { { ADDR_STATLIST_A, 60 } };
    struct { uint32_t ptr; uint32_t val; const char *cid; } cases[4] = {
      { 0u, 42u, "null_statlist" },
      { ADDR_STATLIST_A, 0u, "owner_id_0" },
      { ADDR_STATLIST_A, 42u, "owner_id_42" },
      { ADDR_STATLIST_A, 0xDEADBEEFu, "owner_id_deadbeef" }
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_STATLIST_A, 0, 60);
      w32(ADDR_STATLIST_A + 0x0C, cases[i].val);
      uint32_t st[1] = { cases[i].ptr };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, cases[i].ptr);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 1, pre);
    }
  }

  /* 6. 0x6FD880A0 STATLIST_GetUnitFullStatsCount (__stdcall(pUnit) -> eax) */
  {
    const uint32_t va = 0x6FD880A0u;
    const char *nm = "STATLIST_GetUnitFullStatsCount";
    RangeSpec r[2] = { { ADDR_UNIT_A, 244 }, { ADDR_STATLIST_EX, 100 } };
    struct { uint32_t uptr; uint32_t sptr; uint16_t cnt; const char *cid; } cases[5] = {
      { 0u, ADDR_STATLIST_EX, 5u, "null_unit" },
      { ADDR_UNIT_A, 0u, 5u, "unit_null_statlistex" },
      { ADDR_UNIT_A, ADDR_STATLIST_EX, 0u, "full_stats_count_0" },
      { ADDR_UNIT_A, ADDR_STATLIST_EX, 12u, "full_stats_count_12" },
      { ADDR_UNIT_A, ADDR_STATLIST_EX, 0xFFFEu, "full_stats_count_neg_2_sign_ext" }
    };
    for (int i = 0; i < 5; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT_A, 0, 244);
      memset((void *)(uintptr_t)ADDR_STATLIST_EX, 0, 100);
      w32(ADDR_UNIT_A + 0x5C, cases[i].sptr);
      w16(ADDR_STATLIST_EX + 0x4C, cases[i].cnt);
      uint32_t st[1] = { cases[i].uptr };
      capture_pre(r, 2, pre);
      uint32_t eax = call_stdcall1(va, cases[i].uptr);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 2, pre);
    }
  }

  /* 7. 0x6FD880E0 STATLIST_GetOwnerType (__stdcall(pStatList) -> eax) */
  {
    const uint32_t va = 0x6FD880E0u;
    const char *nm = "STATLIST_GetOwnerType";
    RangeSpec r[1] = { { ADDR_STATLIST_A, 60 } };
    struct { uint32_t ptr; uint32_t val; const char *cid; } cases[5] = {
      { 0u, 0u, "null_statlist_returns_6" },
      { ADDR_STATLIST_A, 0u, "owner_type_0_player" },
      { ADDR_STATLIST_A, 1u, "owner_type_1_monster" },
      { ADDR_STATLIST_A, 4u, "owner_type_4_item" },
      { ADDR_STATLIST_A, 6u, "owner_type_6_none" }
    };
    for (int i = 0; i < 5; i++) {
      memset((void *)(uintptr_t)ADDR_STATLIST_A, 0, 60);
      w32(ADDR_STATLIST_A + 0x08, cases[i].val);
      uint32_t st[1] = { cases[i].ptr };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, cases[i].ptr);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 1, pre);
    }
  }

  /* 8. 0x6FD88220 STATLIST_FindStatFirstIndexOrLowerBound (eax = pStatArrayHdr, ebx = dwKey -> eax)
   * Note: ebx (dwKey) is recorded in regs.edx in the JSON vector.
   */
  {
    const uint32_t va = 0x6FD88220u;
    const char *nm = "STATLIST_FindStatFirstIndexOrLowerBound";
    uint32_t hdr_addr = ADDR_STATLIST_A + 0x24;
    RangeSpec r[2] = { { ADDR_STATLIST_A, 60 }, { ADDR_STAT_ARRAY, 64 } };
    /* Sorted signed 32-bit keys: [-0x00100000, 0x00010000, 0x00050000, 0x000A0000, 0x00140000] */
    uint32_t keys[5] = { 0xFFF00000u, 0x00010000u, 0x00050000u, 0x000A0000u, 0x00140000u };
    struct { uint16_t cnt; uint32_t search_key; const char *cid; } cases[7] = {
      { 0u, 0x00050000u, "empty_array_returns_minus_1" },
      { 5u, 0xFFE00000u, "before_first_negative_returns_0" },
      { 5u, 0xFFF00000u, "exact_match_first_negative_returns_0" },
      { 5u, 0x00050000u, "exact_match_middle_returns_2" },
      { 5u, 0x00070000u, "between_elements_returns_lower_bound_3" },
      { 5u, 0x00140000u, "exact_match_last_returns_4" },
      { 5u, 0x00200000u, "after_last_returns_minus_1" }
    };
    for (int i = 0; i < 7; i++) {
      memset((void *)(uintptr_t)ADDR_STATLIST_A, 0, 60);
      memset((void *)(uintptr_t)ADDR_STAT_ARRAY, 0, 64);
      for (int k = 0; k < 5; k++) {
        w32(ADDR_STAT_ARRAY + k * 8 + 0, keys[k]);
        w32(ADDR_STAT_ARRAY + k * 8 + 4, (uint32_t)((k + 1) * 10));
      }
      w32(hdr_addr + 0x00, ADDR_STAT_ARRAY);
      w16(hdr_addr + 0x04, cases[i].cnt);
      w16(hdr_addr + 0x06, 8u);
      capture_pre(r, 2, pre);
      uint32_t eax = call_eax_ebx(va, hdr_addr, cases[i].search_key);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", hdr_addr, 0, cases[i].search_key, 0, 0, NULL, 0, eax, r, 2, pre);
    }
  }

  /* 9. 0x6FD88380 STATLIST_SetExpireFrameEx (__stdcall(pStatList, nExpireFrame), void) */
  {
    const uint32_t va = 0x6FD88380u;
    const char *nm = "STATLIST_SetExpireFrameEx";
    RangeSpec r[1] = { { ADDR_STATLIST_EX, 100 } };
    struct { uint32_t ptr; uint32_t init_flags; uint32_t frame; const char *cid; } cases[5] = {
      { 0u, 0u, 250u, "null_statlist_noop" },
      { ADDR_STATLIST_EX, 0x80000000u, (uint32_t)-1, "negative_frame_no_flag_0x2" },
      { ADDR_STATLIST_EX, 0x80000000u, 0u, "zero_frame_no_flag_0x2" },
      { ADDR_STATLIST_EX, 0x80000000u, 250u, "positive_frame_sets_flag_0x2" },
      { ADDR_STATLIST_EX, 0x80002000u, 999u, "positive_frame_ors_flag_0x2" }
    };
    for (int i = 0; i < 5; i++) {
      memset((void *)(uintptr_t)ADDR_STATLIST_EX, 0, 100);
      w32(ADDR_STATLIST_EX + 0x10, cases[i].init_flags);
      w32(ADDR_STATLIST_EX + 0x18, 0x22222222u);
      uint32_t st[2] = { cases[i].ptr, cases[i].frame };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall2(va, cases[i].ptr, cases[i].frame);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "void", 0, 0, 0, 0, 0, st, 2, eax, r, 1, pre);
    }
  }

  /* 10. 0x6FD883A0 STATLIST_GetExpireFrameEx (__stdcall(pStatList) -> eax) */
  {
    const uint32_t va = 0x6FD883A0u;
    const char *nm = "STATLIST_GetExpireFrameEx";
    RangeSpec r[1] = { { ADDR_STATLIST_EX, 100 } };
    struct { uint32_t ptr; uint32_t val; const char *cid; } cases[4] = {
      { 0u, 250u, "null_statlist" },
      { ADDR_STATLIST_EX, 0u, "expire_frame_ex_0" },
      { ADDR_STATLIST_EX, 250u, "expire_frame_ex_250" },
      { ADDR_STATLIST_EX, 0x80000000u, "expire_frame_ex_high_bit" }
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_STATLIST_EX, 0, 100);
      w32(ADDR_STATLIST_EX + 0x18, cases[i].val);
      uint32_t st[1] = { cases[i].ptr };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, cases[i].ptr);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 1, pre);
    }
  }

  /* 11. 0x6FD883C0 STATLIST_CopyBaseStatsToBuffer (__stdcall(pStatList, pOutStats, nMaxStats) -> eax) */
  {
    const uint32_t va = 0x6FD883C0u;
    const char *nm = "STATLIST_CopyBaseStatsToBuffer";
    RangeSpec r[3] = { { ADDR_STATLIST_A, 60 }, { ADDR_STAT_ARRAY, 32 }, { ADDR_STAT_OUT, 32 } };
    struct { uint32_t ptr; uint16_t cnt; uint32_t max_s; const char *cid; } cases[5] = {
      { 0u, 3u, 4u, "null_statlist_returns_0" },
      { ADDR_STATLIST_A, 0u, 4u, "empty_statlist_count_0" },
      { ADDR_STATLIST_A, 3u, 4u, "copy_all_3_stats_max_4" },
      { ADDR_STATLIST_A, 4u, 2u, "clamped_by_max_2_of_4" },
      { ADDR_STATLIST_A, 3u, 0u, "max_0_copies_none" }
    };
    for (int i = 0; i < 5; i++) {
      memset((void *)(uintptr_t)ADDR_STATLIST_A, 0, 60);
      memset((void *)(uintptr_t)ADDR_STAT_ARRAY, 0, 32);
      memset((void *)(uintptr_t)ADDR_STAT_OUT, 0xCC, 32);
      for (int k = 0; k < 4; k++) {
        w32(ADDR_STAT_ARRAY + k * 8 + 0, (uint32_t)((k + 1) << 16));
        w32(ADDR_STAT_ARRAY + k * 8 + 4, (uint32_t)((k + 1) * 100));
      }
      w32(ADDR_STATLIST_A + 0x24, ADDR_STAT_ARRAY);
      w16(ADDR_STATLIST_A + 0x28, cases[i].cnt);
      w16(ADDR_STATLIST_A + 0x2A, 4u);
      uint32_t st[3] = { cases[i].ptr, ADDR_STAT_OUT, cases[i].max_s };
      capture_pre(r, 3, pre);
      uint32_t eax = call_stdcall3(va, st[0], st[1], st[2]);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 3, eax, r, 3, pre);
    }
  }

  /* 12. 0x6FD88410 STATLIST_CopyUnitFullStatsToBuffer (__stdcall(pUnit, pOutStats, nMaxStats) -> eax) */
  {
    const uint32_t va = 0x6FD88410u;
    const char *nm = "STATLIST_CopyUnitFullStatsToBuffer";
    RangeSpec r[4] = {
      { ADDR_UNIT_A, 244 },
      { ADDR_STATLIST_EX, 100 },
      { ADDR_STAT_ARRAY, 32 },
      { ADDR_STAT_OUT, 32 }
    };
    struct { uint32_t uptr; uint32_t sptr; uint32_t flags; uint16_t cnt; uint32_t max_s; const char *cid; } cases[6] = {
      { 0u, ADDR_STATLIST_EX, 0x80000000u, 3u, 4u, "null_unit_returns_0" },
      { ADDR_UNIT_A, 0u, 0x80000000u, 3u, 4u, "unit_null_statlistex_returns_0" },
      { ADDR_UNIT_A, ADDR_STATLIST_EX, 0x00000000u, 3u, 4u, "non_extended_statlist_returns_0" },
      { ADDR_UNIT_A, ADDR_STATLIST_EX, 0x80000000u, 0u, 4u, "extended_count_0" },
      { ADDR_UNIT_A, ADDR_STATLIST_EX, 0x80000000u, 3u, 4u, "extended_copy_all_3_stats" },
      { ADDR_UNIT_A, ADDR_STATLIST_EX, 0x80000000u, 4u, 2u, "extended_clamped_by_max_2_of_4" }
    };
    for (int i = 0; i < 6; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT_A, 0, 244);
      memset((void *)(uintptr_t)ADDR_STATLIST_EX, 0, 100);
      memset((void *)(uintptr_t)ADDR_STAT_ARRAY, 0, 32);
      memset((void *)(uintptr_t)ADDR_STAT_OUT, 0xDD, 32);
      for (int k = 0; k < 4; k++) {
        w32(ADDR_STAT_ARRAY + k * 8 + 0, (uint32_t)((k + 7) << 16));
        w32(ADDR_STAT_ARRAY + k * 8 + 4, (uint32_t)((k + 1) * 250));
      }
      w32(ADDR_UNIT_A + 0x5C, cases[i].sptr);
      w32(ADDR_STATLIST_EX + 0x10, cases[i].flags);
      w32(ADDR_STATLIST_EX + 0x48, ADDR_STAT_ARRAY);
      w16(ADDR_STATLIST_EX + 0x4C, cases[i].cnt);
      w16(ADDR_STATLIST_EX + 0x4E, 4u);
      uint32_t st[3] = { cases[i].uptr, ADDR_STAT_OUT, cases[i].max_s };
      capture_pre(r, 4, pre);
      uint32_t eax = call_stdcall3(va, st[0], st[1], st[2]);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 3, eax, r, 4, pre);
    }
  }

  /* 13. 0x6FD8B080 DRLGLOGIC_GetBossTombLevel (__stdcall(pAct) -> eax) */
  {
    const uint32_t va = 0x6FD8B080u;
    const char *nm = "DRLGLOGIC_GetBossTombLevel";
    RangeSpec r[2] = { { ADDR_ACT, 96 }, { ADDR_DRLG, 160 } };
    struct { uint32_t aptr; uint32_t dptr; uint32_t tomb; const char *cid; } cases[4] = {
      { 0u, ADDR_DRLG, 69u, "null_act_returns_0" },
      { ADDR_ACT, 0u, 69u, "act_null_drlg_returns_0" },
      { ADDR_ACT, ADDR_DRLG, 69u, "valid_boss_tomb_level_69" },
      { ADDR_ACT, ADDR_DRLG, 72u, "valid_boss_tomb_level_72" }
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_ACT, 0, 96);
      memset((void *)(uintptr_t)ADDR_DRLG, 0, 160);
      w32(ADDR_ACT + 0x48, cases[i].dptr);
      w32(ADDR_DRLG + 0x94, cases[i].tomb);
      uint32_t st[1] = { cases[i].aptr };
      capture_pre(r, 2, pre);
      uint32_t eax = call_stdcall1(va, cases[i].aptr);
      emit_case_json(fp, &first, va, nm, cases[i].cid, "eax", 0, 0, 0, 0, 0, st, 1, eax, r, 2, pre);
    }
  }
}

int main(int argc, char **argv) {
  const char *out_dir = ".";
  if (argc > 1) out_dir = argv[1];

  void *arena = VirtualAlloc((void *)(uintptr_t)ARENA_BASE, ARENA_SIZE, MEM_RESERVE | MEM_COMMIT, PAGE_READWRITE);
  if (arena != (void *)(uintptr_t)ARENA_BASE) {
    fprintf(stderr, "VirtualAlloc at 0x%08X failed (got %p, err=%lu)\n", ARENA_BASE, arena, GetLastError());
    return 2;
  }

  LoadLibraryA("Storm.dll");
  HMODULE hFog = LoadLibraryA("Fog.dll");
  if (hFog) {
    typedef void (__fastcall *FogInitSysFn)(int, void *);
    FogInitSysFn pInitSys = (FogInitSysFn)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10089));
    if (pInitSys) pInitSys(1, NULL);
  }
  HMODULE hD2Common = LoadLibraryA("D2Common.dll");
  if (!hD2Common) {
    fprintf(stderr, "Failed to load D2Common.dll (err=%lu)\n", GetLastError());
    return 3;
  }
  if ((uintptr_t)hD2Common != 0x6FD50000u) {
    fprintf(stderr, "Unexpected D2Common.dll base %p (expected 0x6FD50000)\n", (void *)hD2Common);
    return 4;
  }

  /* Copy real Fog gdwBitMasks into deterministic ADDR_BITMASKS and point IAT 0x6FDD90B0 to ADDR_BITMASKS */
  uint32_t real_bm_ptr = *(uint32_t *)(uintptr_t)VA_GDWBITMASKS_IAT;
  memcpy((void *)(uintptr_t)ADDR_BITMASKS, (const void *)(uintptr_t)real_bm_ptr, 128);
  DWORD old_prot = 0;
  VirtualProtect((void *)(uintptr_t)VA_GDWBITMASKS_IAT, 4, PAGE_READWRITE, &old_prot);
  w32(VA_GDWBITMASKS_IAT, ADDR_BITMASKS);

  char path[512];

  snprintf(path, sizeof(path), "%s/b002-vectors.json", out_dir);
  FILE *fp2 = fopen(path, "wb");
  if (!fp2) { perror("fopen b002"); return 5; }
  fprintf(fp2, "{\n  \"batch\": \"B002\",\n  \"module\": \"D2Common\",\n  \"cases\": [\n");
  emit_b002(fp2);
  fprintf(fp2, "\n  ]\n}\n");
  fclose(fp2);

  snprintf(path, sizeof(path), "%s/b005-vectors.json", out_dir);
  FILE *fp5 = fopen(path, "wb");
  if (!fp5) { perror("fopen b005"); return 6; }
  fprintf(fp5, "{\n  \"batch\": \"B005\",\n  \"module\": \"D2Common\",\n  \"cases\": [\n");
  emit_b005_leaves(fp5);
  fprintf(fp5, "\n  ]\n}\n");
  fclose(fp5);

  snprintf(path, sizeof(path), "%s/b005-gfx-cache-vectors.json", out_dir);
  FILE *fp5g = fopen(path, "wb");
  if (!fp5g) { perror("fopen b005-gfx-cache"); return 7; }
  fprintf(fp5g, "{\n  \"batch\": \"B005-gfx-cache\",\n  \"module\": \"D2Common\",\n  \"cases\": [\n");
  emit_b005_gfx_cache(fp5g);
  fprintf(fp5g, "\n  ]\n}\n");
  fclose(fp5g);

  snprintf(path, sizeof(path), "%s/laneA-b002-b005.d2tv", out_dir);
  FILE *fptv = fopen(path, "wb");
  if (!fptv) { perror("fopen d2tv"); return 8; }
  D2TVHeader hdr;
  d2tv_init_header(&hdr, "LANEA_1", sizeof(LaneAD2TVRecord), g_d2tv_count, 0x113C0025ULL);
  fwrite(&hdr, 1, sizeof(hdr), fptv);
  fwrite(g_d2tv_records, sizeof(LaneAD2TVRecord), g_d2tv_count, fptv);
  fclose(fptv);

  g_record_d2tv = 0;

  snprintf(path, sizeof(path), "%s/b008-vectors.json", out_dir);
  FILE *fp8 = fopen(path, "wb");
  if (!fp8) { perror("fopen b008"); return 9; }
  fprintf(fp8, "{\n  \"batch\": \"B008\",\n  \"module\": \"D2Common\",\n  \"cases\": [\n");
  emit_b008(fp8);
  fprintf(fp8, "\n  ]\n}\n");
  fclose(fp8);

  snprintf(path, sizeof(path), "%s/b014-vectors.json", out_dir);
  FILE *fp14 = fopen(path, "wb");
  if (!fp14) { perror("fopen b014"); return 10; }
  fprintf(fp14, "{\n  \"batch\": \"B014\",\n  \"module\": \"D2Common\",\n  \"cases\": [\n");
  emit_b014(fp14);
  fprintf(fp14, "\n  ]\n}\n");
  fclose(fp14);

  snprintf(path, sizeof(path), "%s/b011-vectors.json", out_dir);
  FILE *fp11 = fopen(path, "wb");
  if (!fp11) { perror("fopen b011"); return 11; }
  fprintf(fp11, "{\n  \"batch\": \"B011\",\n  \"module\": \"D2Common\",\n  \"cases\": [\n");
  emit_b011(fp11);
  fprintf(fp11, "\n  ]\n}\n");
  fclose(fp11);

  snprintf(path, sizeof(path), "%s/b017-vectors.json", out_dir);
  FILE *fp17 = fopen(path, "wb");
  if (!fp17) { perror("fopen b017"); return 12; }
  fprintf(fp17, "{\n  \"batch\": \"B017\",\n  \"module\": \"D2Common\",\n  \"cases\": [\n");
  emit_b017(fp17);
  fprintf(fp17, "\n  ]\n}\n");
  fclose(fp17);

  printf("Emitted real-DLL vectors across B002, B005, B008, B014, B011, and B017 into %s\n", out_dir);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}


