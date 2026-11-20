/*
 * Standalone MinGW real-DLL differential vector emitter for K1r2 Iteration 6 Lane B:
 * - Batch B027 (15 D2Common.dll v1.13c hostImport functions in items.ts)
 * - Batch B030 (14 D2Common.dll v1.13c hostImport functions in items.ts)
 *
 * Loads the real Diablo II v1.13c Storm.dll, Fog.dll, and D2Common.dll (image base 0x6FD50000),
 * allocates a deterministic scratch arena at 0x20000000 and bump heap at 0x40000000 matching
 * SparseMemory113c.alloc(size), invokes each real D2Common.dll entry point via register-safe
 * assembly thunks, and emits b027-vectors.ndjson and b030-vectors.ndjson.
 */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <setjmp.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define ARENA_BASE         0x20000000u
#define ARENA_SIZE         0x00100000u
#define HEAP_BASE          0x40000000u
#define HEAP_SIZE          0x00100000u

/* Deterministic layout within ARENA_BASE (0x20000000) */
#define ADDR_BITMASKS      0x20000100u /* 128 bytes: 32 u32s from Fog gdwBitMasks */
#define ADDR_UNIT          0x20000300u /* 244 bytes: D2UnitStrc #1 */
#define ADDR_UNIT2         0x20000400u /* 244 bytes: D2UnitStrc #2 */
#define ADDR_UNIT3         0x20000500u /* 244 bytes: D2UnitStrc #3 */
#define ADDR_ITEM_DATA     0x20000680u /* 116 bytes: D2ItemDataStrc #1 */
#define ADDR_ITEM_DATA2    0x20000700u /* 116 bytes: D2ItemDataStrc #2 */
#define ADDR_ITEM_DATA3    0x20000780u /* 116 bytes: D2ItemDataStrc #3 */
#define ADDR_INV           0x20000800u /* 64 bytes:  D2InventoryStrc */
#define ADDR_STATLIST_EX   0x20000900u /* 100 bytes: D2StatListExStrc */
#define ADDR_STAT_ARR      0x20000A80u /* 64 bytes:  8 D2StatStrc entries */
#define ADDR_FULL_ARR      0x20000AC0u /* 64 bytes:  8 D2StatStrc entries */
#define ADDR_BITSTREAM     0x20000C00u /* 20 bytes:  D2BitBufferStrc */
#define ADDR_BITBUF        0x20000C40u /* 32 bytes:  bitstream byte buffer */
#define ADDR_OUT_COSTS     0x20000D00u /* 16 bytes:  cost1, cost2, cost3, sentinel */
#define ADDR_WARP_MASK_PTR 0x20000E00u /* 4 bytes:   pointer to ADDR_WARP_BITS */
#define ADDR_WARP_BITS     0x20000E40u /* 64 bytes:  bit array for DRLGWARP_TestRoomTileBit */
#define ADDR_LINK          0x20001800u /* 16 bytes:  D2LinkStrc header */
#define ADDR_LINK_COUNTS   0x20001840u /* 1024 bytes: 256 u32 bucket counts */
#define ADDR_LINK_BUCKETS  0x20001C40u /* 1024 bytes: 256 u32 bucket start indices */
#define ADDR_LINK_ENTRIES  0x20002040u /* 64 bytes:  4 * 16-byte link entries */
#define ADDR_DATATABLES    0x20002200u /* 0xD00 bytes: synthetic D2DataTablesStrc */
#define ADDR_DT_SLICE      0x20002DC0u /* ADDR_DATATABLES + 0xBC0 (80 bytes: +0xBC0..+0xC10) */
#define ADDR_ITEMS_TXT     0x20003000u /* 4 * 0x1A8 (424) = 1696 bytes */
#define ADDR_ITEMTYPES_TXT 0x20004000u /* 64 * 0xE4 (228) = 14592 bytes */
#define ADDR_EQUIV_MATRIX  0x20008000u /* 64 * 2 * 4 = 512 bytes (equivDwords = 2) */
#define ADDR_ISC_SINGLE    0x20008400u /* 324 bytes: single D2ItemStatCostTxt for 0x6FD79D90 */
#define ADDR_ISC_TABLE     0x20010000u /* 200 * 0x144 (324) = 64800 bytes */

/* D2Common.dll canonical VAs (ImageBase = 0x6FD50000) */
#define VA_SGPT_DATATABLES 0x6FDE9E1Cu
#define VA_GDWBITMASKS_IAT 0x6FDD90B0u
#define VA_ITEMS_TXT_COUNT 0x6FDEFB94u
#define VA_ITEMS_TXT_PTR   0x6FDEFB98u
#define VA_ITEMS_LINK_PTR  0x6FDEFF6Cu

typedef struct {
  uint32_t addr;
  uint32_t len;
} RangeSpec;

static inline void w32(uint32_t addr, uint32_t val) {
  *(uint32_t *)(uintptr_t)addr = val;
}
static inline void w16(uint32_t addr, uint16_t val) {
  *(uint16_t *)(uintptr_t)addr = val;
}
static inline void w8(uint32_t addr, uint8_t val) {
  *(uint8_t *)(uintptr_t)addr = val;
}

/* Bump allocator at 0x40000000 matching SparseMemory113c.alloc(size) */
static uint32_t g_heap_next = HEAP_BASE;

static void reset_heap(void) {
  memset((void *)(uintptr_t)HEAP_BASE, 0, 0x1000u);
  g_heap_next = HEAP_BASE;
}

static uint32_t bump_alloc(uint32_t size) {
  uint32_t ptr = (g_heap_next + 3u) & ~3u;
  g_heap_next = (ptr + size) & 0xFFFFFFFFu;
  memset((void *)(uintptr_t)ptr, 0, size);
  return ptr;
}

/* Assert interception via [0x6FDD90D4] (called by 0x6FD5921C after pushing line) */
static jmp_buf g_jmp_buf;
static volatile int g_in_test_call = 0;
static volatile uint32_t g_assert_line = 0;

static int __cdecl stub_fog_assert_line(uint32_t line) {
  if (g_in_test_call) {
    g_in_test_call = 0;
    g_assert_line = line;
    longjmp(g_jmp_buf, 1);
  }
  return 0;
}

/* Fog.#10045 (0x6FDD90D0): FOG_AllocServerMemory(ecx=pMemPool, edx=dwSize, szFile, nLine, nZero), ret 0xC */
static void *__fastcall stub_fog_10045(
  void *pMemPool,
  uint32_t dwSize,
  const char *szFile,
  int nLine,
  int nZero
) {
  (void)pMemPool;
  (void)szFile;
  (void)nLine;
  (void)nZero;
  return (void *)(uintptr_t)bump_alloc(dwSize);
}

/* =========================================================================
 * Custom LTCG & stdcall Assembly Thunks (Register-Only Constraints!)
 * ========================================================================= */

/* 1. eax=a0, plain ret -> eax (0x6FD722B0 ITEMS_GetItemDropSound) */
static __attribute__((noinline)) uint32_t call_eax_ret(uintptr_t fn, uint32_t a0) {
  uint32_t out;
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "=a"(out)
    : "a"(a0), [fn]"c"(fn)
    : "edx", "ebx", "esi", "edi", "memory", "cc"
  );
  return out;
}

/* 2. eax=a0, ecx=a1, plain ret -> eax (0x6FD95A40 ITEMS_GetItemsTxtRecordFromUnitOrAlt) */
static __attribute__((noinline)) uint32_t call_eax_ecx_ret(uintptr_t fn, uint32_t a0, uint32_t a1) {
  uint32_t out;
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "=a"(out), "+c"(a1)
    : "a"(a0), [fn]"d"(fn)
    : "ebx", "esi", "edi", "memory", "cc"
  );
  return out;
}

/* 3. esi=nBits, edx=nValue, [esp+4]=pBitStream, ret 4 -> void (0x6FD73DD0 ITEMS_WriteBitsClamped) */
static __attribute__((noinline)) void call_esi_edx_stack1_ret4(
  uintptr_t fn,
  uint32_t esi_in,
  uint32_t edx_in,
  uint32_t s0
) {
  uint32_t out;
  __asm__ volatile(
    "pushl %[s0]\n\t"
    "call *%[fn]\n\t"
    : "=a"(out), "+S"(esi_in), "+d"(edx_in), [s0]"+c"(s0)
    : [fn]"a"(fn)
    : "ebx", "edi", "memory", "cc"
  );
}

/* 4. eax=pItem, [esp+4]=s0, [esp+8]=s1, [esp+0xC]=s2, ret 0xC -> void (0x6FD74A50 ITEMS_AccumulateSocketedItemCosts) */
static __attribute__((noinline)) void call_eax_stack3_ret12(
  uintptr_t fn,
  uint32_t eax_in,
  uint32_t s0,
  uint32_t s1,
  uint32_t s2
) {
  uint32_t blk[5] = { eax_in, s0, s1, s2, (uint32_t)fn };
  const uint32_t *p = blk;
  __asm__ volatile(
    "pushl 12(%[p])\n\t"
    "pushl 8(%[p])\n\t"
    "pushl 4(%[p])\n\t"
    "movl 0(%[p]), %%eax\n\t"
    "call *16(%[p])\n\t"
    : [p]"+d"(p)
    :
    : "eax", "ebx", "ecx", "esi", "edi", "memory", "cc"
  );
}

/* 5. eax=nSaveSlot, ecx=nVersion, esi=pIscRec, [esp+4]=s0, [esp+8]=s1, [esp+0xC]=s2, ret 0xC -> void (0x6FD79D90) */
static __attribute__((noinline)) void call_eax_ecx_esi_stack3_ret12(
  uintptr_t fn,
  uint32_t eax_in,
  uint32_t ecx_in,
  uint32_t esi_in,
  uint32_t s0,
  uint32_t s1,
  uint32_t s2
) {
  uint32_t blk[7] = { eax_in, ecx_in, esi_in, s0, s1, s2, (uint32_t)fn };
  const uint32_t *p = blk;
  __asm__ volatile(
    "pushl 20(%[p])\n\t"
    "pushl 16(%[p])\n\t"
    "pushl 12(%[p])\n\t"
    "movl 0(%[p]), %%eax\n\t"
    "movl 4(%[p]), %%ecx\n\t"
    "movl 8(%[p]), %%esi\n\t"
    "call *24(%[p])\n\t"
    : [p]"+d"(p)
    :
    : "eax", "ebx", "ecx", "esi", "edi", "memory", "cc"
  );
}

/* 6. esi=pItem, [esp+4]=nStatId, ret 4 -> void (0x6FD79F30, 0x6FD96E50) */
static __attribute__((noinline)) void call_esi_stack1_ret4(
  uintptr_t fn,
  uint32_t esi_in,
  uint32_t s0
) {
  uint32_t out;
  __asm__ volatile(
    "pushl %[s0]\n\t"
    "call *%[fn]\n\t"
    : "=a"(out), "+S"(esi_in), [s0]"+c"(s0)
    : [fn]"d"(fn)
    : "ebx", "edi", "memory", "cc"
  );
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

/* =========================================================================
 * NDJSON Emission Helpers
 * ========================================================================= */

static void write_hex(FILE *fp, const uint8_t *buf, uint32_t len) {
  for (uint32_t i = 0; i < len; i++) {
    fprintf(fp, "%02x", buf[i]);
  }
}

static void capture_pre(const RangeSpec *ranges, int n, uint8_t **pre_bufs) {
  for (int i = 0; i < n; i++) {
    pre_bufs[i] = (uint8_t *)malloc(ranges[i].len);
    memcpy(pre_bufs[i], (const void *)(uintptr_t)ranges[i].addr, ranges[i].len);
  }
}

static void emit_ndjson_line(
  FILE *fp,
  uint32_t va,
  const char *name,
  const char *case_id,
  const uint32_t *args,
  int n_args,
  uint32_t ret_mask,
  uint32_t out_eax,
  const RangeSpec *pre_ranges,
  int n_pre,
  uint8_t **pre_bufs,
  const RangeSpec *post_ranges,
  int n_post
) {
  fprintf(fp, "{\"va\":\"0x%08X\",\"name\":\"%s\",\"caseId\":\"%s\",\"args\":[", va, name, case_id);
  for (int i = 0; i < n_args; i++) {
    if (i > 0) fputc(',', fp);
    fprintf(fp, "%u", args[i]);
  }
  fprintf(fp, "],\"retMask\":%u,\"eax\":%u,\"pre\":[", ret_mask, out_eax & ret_mask);
  for (int i = 0; i < n_pre; i++) {
    if (i > 0) fputc(',', fp);
    fprintf(fp, "{\"addr\":%u,\"hex\":\"", pre_ranges[i].addr);
    write_hex(fp, pre_bufs[i], pre_ranges[i].len);
    fprintf(fp, "\"}");
  }
  fprintf(fp, "],\"post\":[");
  for (int i = 0; i < n_post; i++) {
    if (i > 0) fputc(',', fp);
    fprintf(fp, "{\"addr\":%u,\"hex\":\"", post_ranges[i].addr);
    write_hex(fp, (const uint8_t *)(uintptr_t)post_ranges[i].addr, post_ranges[i].len);
    fprintf(fp, "\"}");
  }
  fprintf(fp, "]}\n");
  for (int i = 0; i < n_pre; i++) {
    free(pre_bufs[i]);
  }
}

/* =========================================================================
 * Staging Helpers
 * ========================================================================= */

static void clear_arena(void) {
  memset((void *)(uintptr_t)ARENA_BASE, 0, 0x20000u);
  for (uint32_t i = 0; i < 32; i++) {
    w32(ADDR_BITMASKS + i * 4, 1u << i);
  }
  w32(VA_GDWBITMASKS_IAT, ADDR_BITMASKS);
  w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);
  w32(VA_ITEMS_TXT_COUNT, 4u);
  w32(VA_ITEMS_TXT_PTR, ADDR_ITEMS_TXT);
  w32(VA_ITEMS_LINK_PTR, ADDR_LINK);

  /* Populate 4 D2ItemsTxt records (stride 0x1A8 = 424) */
  /* Record 0: standard weapon (type1 = 0x2D = 45, type2 = 0, component = 0) */
  uint32_t r0 = ADDR_ITEMS_TXT + 0 * 0x1A8u;
  w32(r0 + 0x80, 0x20786168u); /* dwCode = 'hax ' */
  w32(r0 + 0x84, 0u);          /* dwAlternateGfx = 0 */
  w32(r0 + 0xD0, 0u);          /* nMinAc = 0 */
  w32(r0 + 0xDC, 1u);          /* dwBitField1 = 1 (throwable bit set) */
  w32(r0 + 0xE0, 400u);        /* dwCost = 400 */
  w32(r0 + 0xE4, 12500u);      /* dwGambleCost = 12500 */
  w32(r0 + 0xE8, 0xFFFFFFF6u); /* dwSpeed = -10 */
  w32(r0 + 0xEC, 0x00000005u); /* dwBitField2 = 5 */
  w8(r0 + 0xFE, 10u);          /* nMinDam = 10 */
  w8(r0 + 0xFF, 24u);          /* nMaxDam = 24 */
  w8(r0 + 0x100, 14u);         /* nMinMisDam = 14 */
  w8(r0 + 0x101, 30u);         /* nMaxMisDam = 30 */
  w8(r0 + 0x102, 18u);         /* n2HandMinDam = 18 */
  w8(r0 + 0x103, 42u);         /* n2HandMaxDam = 42 */
  w16(r0 + 0x11E, 0x002Du);    /* wType1 = 45 (weapon) */
  w16(r0 + 0x120, 0u);         /* wType2 = 0 */
  w8(r0 + 0x12A, 0u);          /* nComponent = 0 */
  w8(r0 + 0x132, 1u);          /* nTwoHanded = 1 */
  w8(r0 + 0x137, 3u);          /* nSubType = 3 */
  w8(r0 + 0x138, 2u);          /* bBelt = 2 */
  w8(r0 + 0x13C, 1u);          /* bQuest = 1 */
  w8(r0 + 0x13E, 0u);          /* nGemApplyType = 0 */
  w8(r0 + 0x143, 55u);         /* nDropSound = 55 */

  /* Record 1: armor with alternate gfx and component >= 1 (type1 = 0x32 = 50) */
  uint32_t r1 = ADDR_ITEMS_TXT + 1 * 0x1A8u;
  w32(r1 + 0x80, 0x20706163u); /* dwCode = 'cap ' */
  w32(r1 + 0x84, 0x206D6C68u); /* dwAlternateGfx = 'hlm ' */
  w32(r1 + 0xD0, 50u);         /* nMinAc = 50 */
  w32(r1 + 0xDC, 2u);          /* dwBitField1 = 2 (bit 0 clear) */
  w32(r1 + 0xE0, 251u);        /* dwCost = 251 (odd positive -> half = 125) */
  w32(r1 + 0xE4, 50000u);      /* dwGambleCost = 50000 */
  w32(r1 + 0xE8, 10u);         /* dwSpeed = 10 */
  w32(r1 + 0xEC, 0x12345678u); /* dwBitField2 */
  w16(r1 + 0x11E, 0x0032u);    /* wType1 = 50 (armor) */
  w16(r1 + 0x120, 0u);         /* wType2 = 0 */
  w8(r1 + 0x12A, 5u);          /* nComponent = 5 */
  w8(r1 + 0x132, 0u);          /* nTwoHanded = 0 */
  w8(r1 + 0x137, 7u);          /* nSubType = 7 */
  w8(r1 + 0x138, 4u);          /* bBelt = 4 */
  w8(r1 + 0x13C, 0u);          /* bQuest = 0 */
  w8(r1 + 0x13E, 1u);          /* nGemApplyType = 1 */
  w8(r1 + 0x143, 88u);         /* nDropSound = 88 */

  /* Record 2: quest/scroll/tome record with wType1 = 0x27 (39) and nComponent = 0 */
  uint32_t r2 = ADDR_ITEMS_TXT + 2 * 0x1A8u;
  w32(r2 + 0x80, 0x20637374u); /* dwCode = 'tsc ' */
  w32(r2 + 0x84, 0u);          /* dwAlternateGfx = 0 */
  w32(r2 + 0xD0, 0u);          /* nMinAc = 0 */
  w32(r2 + 0xDC, 0u);
  w32(r2 + 0xE0, (uint32_t)-9); /* dwCost = -9 (negative odd -> (-9 - (-1)) >> 1 = -4) */
  w32(r2 + 0xE4, 100u);
  w32(r2 + 0xE8, 0u);
  w32(r2 + 0xEC, 0u);
  w16(r2 + 0x11E, 0x0027u);    /* wType1 = 0x27 (39) */
  w16(r2 + 0x120, 0x002Du);    /* wType2 = 0x2D (45, secondary weapon type!) */
  w8(r2 + 0x12A, 0u);          /* nComponent = 0 */
  w8(r2 + 0x132, 0u);
  w8(r2 + 0x137, 0u);
  w8(r2 + 0x138, 0u);
  w8(r2 + 0x13C, 2u);
  w8(r2 + 0x13E, 2u);
  w8(r2 + 0x143, 12u);

  /* Record 3: negative wType1 (-1 = 0xFFFF) and zero damage/ac */
  uint32_t r3 = ADDR_ITEMS_TXT + 3 * 0x1A8u;
  w32(r3 + 0x80, 0x20787878u); /* dwCode = 'xxx ' */
  w16(r3 + 0x11E, 0xFFFFu);    /* wType1 = -1 */
  w16(r3 + 0x120, 0xFFFFu);    /* wType2 = -1 */

  /* Configure D2DataTablesStrc at ADDR_DATATABLES */
  w32(ADDR_DATATABLES + 0xBCC, ADDR_ISC_TABLE);
  w32(ADDR_DATATABLES + 0xBD4, 200u);
  w32(ADDR_DATATABLES + 0xBF8, ADDR_ITEMTYPES_TXT);
  w32(ADDR_DATATABLES + 0xBFC, 64u);
  w32(ADDR_DATATABLES + 0xC00, 2u); /* nItemTypesEquivDwords = 2 (covers types 0..63) */
  w32(ADDR_DATATABLES + 0xC04, ADDR_EQUIV_MATRIX);

  /* Configure D2ItemTypesTxt records:
   * - type 0x27 (39): nRarity = 7 (not < 7), nThrows = 0
   * - type 0x2D (45): nRarity = 3 (< 7), nThrows = 1 (+0x10 = 1)
   * - type 0x32 (50): nRarity = 6 (< 7), nThrows = 0
   */
  w8(ADDR_ITEMTYPES_TXT + 0x27u * 0xE4u + 0x21u, 7u);
  w8(ADDR_ITEMTYPES_TXT + 0x2Du * 0xE4u + 0x10u, 1u); /* nThrows = 1 */
  w8(ADDR_ITEMTYPES_TXT + 0x2Du * 0xE4u + 0x21u, 3u); /* nRarity = 3 */
  w8(ADDR_ITEMTYPES_TXT + 0x32u * 0xE4u + 0x21u, 6u); /* nRarity = 6 */

  /* Configure equivalence matrix:
   * - row 0x2D (45): bit 0x2D set (dword 1 bit 13)
   * - row 0x32 (50): bit 2 set (dword 0 bit 2 for Armor=2) and bit 0x32 set (dword 1 bit 18)
   */
  w32(ADDR_EQUIV_MATRIX + (0x2Du * 2u + 1u) * 4u, 1u << (0x2Du & 31u));
  w32(ADDR_EQUIV_MATRIX + (0x32u * 2u + 0u) * 4u, 1u << 2u);
  w32(ADDR_EQUIV_MATRIX + (0x32u * 2u + 1u) * 4u, 1u << (0x32u & 31u));

  /* Configure Fog.#10213 sorted code-to-index linker at ADDR_LINK:
   * +0x00 = nRecords (3), +0x08 = pCodeIndex (ADDR_LINK_ENTRIES).
   * Entries are sorted by unsigned dwCode:
   * - [0]: 'tsc ' (0x20637374) -> index 2
   * - [1]: 'cap ' (0x20706163) -> index 1
   * - [2]: 'hax ' (0x20786168) -> index 0
   */
  w32(ADDR_LINK + 0x00, 3u);
  w32(ADDR_LINK + 0x08, ADDR_LINK_ENTRIES);
  w32(ADDR_LINK_ENTRIES + 0 * 8u + 0x00u, 0x20637374u);
  w32(ADDR_LINK_ENTRIES + 0 * 8u + 0x04u, 2u);
  w32(ADDR_LINK_ENTRIES + 1 * 8u + 0x00u, 0x20706163u);
  w32(ADDR_LINK_ENTRIES + 1 * 8u + 0x04u, 1u);
  w32(ADDR_LINK_ENTRIES + 2 * 8u + 0x00u, 0x20786168u);
  w32(ADDR_LINK_ENTRIES + 2 * 8u + 0x04u, 0u);
}

static void stage_item_unit(uint32_t unit_addr, uint32_t data_addr, uint32_t class_id) {
  w32(unit_addr + 0x00, 4u); /* UNIT_ITEM */
  w32(unit_addr + 0x04, class_id);
  w32(unit_addr + 0x14, data_addr);
}

/* =========================================================================
 * B027 Vector Suite (15 functions)
 * ========================================================================= */

static void emit_b027(FILE *fp) {
  uint8_t *pre_bufs[16];

  /* 1. 0x6FD721C0 ITEMS_GetItemFormat */
  {
    const uint32_t va = 0x6FD721C0u;
    const char *nm = "ITEMS_GetItemFormat";
    const uint16_t fmts[4] = { 0u, 1u, 101u, 0xABCDu };
    const char *ids[4] = { "fmt_0", "fmt_1", "fmt_101", "fmt_abcd" };
    for (int i = 0; i < 4; i++) {
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, 0u);
      w16(ADDR_ITEM_DATA + 0x30, fmts[i]);
      RangeSpec pre[] = { { ADDR_UNIT, 244 }, { ADDR_ITEM_DATA, 116 } };
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, 2, pre_bufs);
      uint32_t eax = call_stdcall1(va, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFFFu, eax, pre, 2, pre_bufs, pre, 2);
    }
  }

  /* 2. 0x6FD722B0 ITEMS_GetItemDropSound (eax = pItem) */
  {
    const uint32_t va = 0x6FD722B0u;
    const char *nm = "ITEMS_GetItemDropSound";
    for (uint32_t cid = 0; cid < 3; cid++) {
      char cid_name[32];
      snprintf(cid_name, sizeof(cid_name), "class_%u", cid);
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, cid);
      RangeSpec pre[] = {
        { VA_ITEMS_TXT_COUNT, 8 },
        { ADDR_UNIT, 244 },
        { ADDR_ITEMS_TXT, 4 * 424 }
      };
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, 3, pre_bufs);
      uint32_t eax = call_eax_ret(va, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, cid_name, args, 1, 0xFFFFFFFFu, eax, pre, 3, pre_bufs, pre, 3);
    }
  }

  /* 3. 0x6FD72380 ITEMS_GetQuestItemByte */
  {
    const uint32_t va = 0x6FD72380u;
    const char *nm = "ITEMS_GetQuestItemByte";
    for (uint32_t cid = 0; cid < 3; cid++) {
      char cid_name[32];
      snprintf(cid_name, sizeof(cid_name), "class_%u", cid);
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, cid);
      RangeSpec pre[] = {
        { VA_ITEMS_TXT_COUNT, 8 },
        { ADDR_UNIT, 244 },
        { ADDR_ITEMS_TXT, 4 * 424 }
      };
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, 3, pre_bufs);
      uint32_t eax = call_stdcall1(va, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, cid_name, args, 1, 0xFFu, eax, pre, 3, pre_bufs, pre, 3);
    }
  }

  /* 4. 0x6FD72640 ITEMS_GetItemCell */
  {
    const uint32_t va = 0x6FD72640u;
    const char *nm = "ITEMS_GetItemCell";
    const uint32_t cells[4] = { 0u, 7u, 42u, 0x80000001u };
    const char *ids[4] = { "cell_0", "cell_7", "cell_42", "cell_high" };
    for (int i = 0; i < 4; i++) {
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, 0u);
      w32(ADDR_ITEM_DATA + 0x28, cells[i]);
      RangeSpec pre[] = { { ADDR_UNIT, 244 }, { ADDR_ITEM_DATA, 116 } };
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, 2, pre_bufs);
      uint32_t eax = call_stdcall1(va, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFFFFFFFu, eax, pre, 2, pre_bufs, pre, 2);
    }
  }

  /* 5. 0x6FD72690 ITEMS_IsScrollOrTome */
  {
    const uint32_t va = 0x6FD72690u;
    const char *nm = "ITEMS_IsScrollOrTome";
    const char *ids[4] = { "comp0_not27_true", "comp5_false", "comp0_type27_false", "comp0_neg_true" };
    for (uint32_t cid = 0; cid < 4; cid++) {
      clear_arena();
      RangeSpec pre[] = { { VA_ITEMS_TXT_COUNT, 8 }, { ADDR_ITEMS_TXT, 4 * 424 } };
      uint32_t args[1] = { cid };
      capture_pre(pre, 2, pre_bufs);
      uint32_t eax = call_stdcall1(va, cid);
      emit_ndjson_line(fp, va, nm, ids[cid], args, 1, 0xFFFFFFFFu, eax, pre, 2, pre_bufs, pre, 2);
    }
  }

  /* 6. 0x6FD727C0 ITEMS_IsThrowableBit */
  {
    const uint32_t va = 0x6FD727C0u;
    const char *nm = "ITEMS_IsThrowableBit";
    const char *ids[3] = { "bit0_set", "bit0_clear_even", "bit0_zero" };
    for (uint32_t cid = 0; cid < 3; cid++) {
      clear_arena();
      RangeSpec pre[] = { { VA_ITEMS_TXT_COUNT, 8 }, { ADDR_ITEMS_TXT, 4 * 424 } };
      uint32_t args[1] = { cid };
      capture_pre(pre, 2, pre_bufs);
      uint32_t eax = call_stdcall1(va, cid);
      emit_ndjson_line(fp, va, nm, ids[cid], args, 1, 0xFFFFFFFFu, eax, pre, 2, pre_bufs, pre, 2);
    }
  }

  /* 7. 0x6FD72880 ITEMS_GetGemApplyType */
  {
    const uint32_t va = 0x6FD72880u;
    const char *nm = "ITEMS_GetGemApplyType";
    const char *ids[3] = { "apply_0", "apply_1", "apply_2" };
    for (uint32_t cid = 0; cid < 3; cid++) {
      clear_arena();
      RangeSpec pre[] = { { VA_ITEMS_TXT_COUNT, 8 }, { ADDR_ITEMS_TXT, 4 * 424 } };
      uint32_t args[1] = { cid };
      capture_pre(pre, 2, pre_bufs);
      uint32_t eax = call_stdcall1(va, cid);
      emit_ndjson_line(fp, va, nm, ids[cid], args, 1, 0xFFFFFFFFu, eax, pre, 2, pre_bufs, pre, 2);
    }
  }

  /* 8. 0x6FD728D0 ITEMS_GetBeltTypeIndex */
  {
    const uint32_t va = 0x6FD728D0u;
    const char *nm = "ITEMS_GetBeltTypeIndex";
    const uint32_t cids[5] = { 0u, 1u, 2u, 4u, 0xFFFFFFFFu };
    const char *ids[5] = { "belt_2", "belt_4", "belt_0", "oob_eq_count", "oob_neg1" };
    for (int i = 0; i < 5; i++) {
      clear_arena();
      RangeSpec pre[] = { { VA_ITEMS_TXT_COUNT, 8 }, { ADDR_ITEMS_TXT, 4 * 424 } };
      uint32_t args[1] = { cids[i] };
      capture_pre(pre, 2, pre_bufs);
      uint32_t eax = call_stdcall1(va, cids[i]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFu, eax, pre, 2, pre_bufs, pre, 2);
    }
  }

  /* 9. 0x6FD72920 ITEMS_GetSubTypeByte */
  {
    const uint32_t va = 0x6FD72920u;
    const char *nm = "ITEMS_GetSubTypeByte";
    const uint32_t cids[5] = { 0u, 1u, 2u, 4u, 0xFFFFFFFFu };
    const char *ids[5] = { "sub_3", "sub_7", "sub_0", "oob_eq_count", "oob_neg1" };
    for (int i = 0; i < 5; i++) {
      clear_arena();
      RangeSpec pre[] = { { VA_ITEMS_TXT_COUNT, 8 }, { ADDR_ITEMS_TXT, 4 * 424 } };
      uint32_t args[1] = { cids[i] };
      capture_pre(pre, 2, pre_bufs);
      uint32_t eax = call_stdcall1(va, cids[i]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFFFFFFFu, eax, pre, 2, pre_bufs, pre, 2);
    }
  }

  /* 10. 0x6FD72AD0 ITEMS_GetGambleCost */
  {
    const uint32_t va = 0x6FD72AD0u;
    const char *nm = "ITEMS_GetGambleCost";
    const char *ids[3] = { "gamble_12500", "gamble_50000", "gamble_100" };
    for (uint32_t cid = 0; cid < 3; cid++) {
      clear_arena();
      RangeSpec pre[] = { { VA_ITEMS_TXT_COUNT, 8 }, { ADDR_ITEMS_TXT, 4 * 424 } };
      uint32_t args[1] = { cid };
      capture_pre(pre, 2, pre_bufs);
      uint32_t eax = call_stdcall1(va, cid);
      emit_ndjson_line(fp, va, nm, ids[cid], args, 1, 0xFFFFFFFFu, eax, pre, 2, pre_bufs, pre, 2);
    }
  }

  /* 11. 0x6FD72B20 ITEMS_GetBitField2 */
  {
    const uint32_t va = 0x6FD72B20u;
    const char *nm = "ITEMS_GetBitField2";
    const char *ids[3] = { "bf2_5", "bf2_12345678", "bf2_0" };
    for (uint32_t cid = 0; cid < 3; cid++) {
      clear_arena();
      RangeSpec pre[] = { { VA_ITEMS_TXT_COUNT, 8 }, { ADDR_ITEMS_TXT, 4 * 424 } };
      uint32_t args[1] = { cid };
      capture_pre(pre, 2, pre_bufs);
      uint32_t eax = call_stdcall1(va, cid);
      emit_ndjson_line(fp, va, nm, ids[cid], args, 1, 0xFFFFFFFFu, eax, pre, 2, pre_bufs, pre, 2);
    }
  }

  /* 12. 0x6FD72B70 ITEMS_GetBaseSpeed */
  {
    const uint32_t va = 0x6FD72B70u;
    const char *nm = "ITEMS_GetBaseSpeed";
    const char *ids[3] = { "speed_neg10", "speed_pos10", "speed_0" };
    for (uint32_t cid = 0; cid < 3; cid++) {
      clear_arena();
      RangeSpec pre[] = { { VA_ITEMS_TXT_COUNT, 8 }, { ADDR_ITEMS_TXT, 4 * 424 } };
      uint32_t args[1] = { cid };
      capture_pre(pre, 2, pre_bufs);
      uint32_t eax = call_stdcall1(va, cid);
      emit_ndjson_line(fp, va, nm, ids[cid], args, 1, 0xFFFFFFFFu, eax, pre, 2, pre_bufs, pre, 2);
    }
  }

  /* 13. 0x6FD72BC0 ITEMS_GetComponentByte */
  {
    const uint32_t va = 0x6FD72BC0u;
    const char *nm = "ITEMS_GetComponentByte";
    for (uint32_t cid = 0; cid < 3; cid++) {
      char cid_name[32];
      snprintf(cid_name, sizeof(cid_name), "class_%u", cid);
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, cid);
      RangeSpec pre[] = {
        { VA_ITEMS_TXT_COUNT, 8 },
        { ADDR_UNIT, 244 },
        { ADDR_ITEMS_TXT, 4 * 424 }
      };
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, 3, pre_bufs);
      uint32_t eax = call_stdcall1(va, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, cid_name, args, 1, 0xFFFFFFFFu, eax, pre, 3, pre_bufs, pre, 3);
    }
  }

  /* 14. 0x6FD72E20 ITEMS_GetTwoHandedFlag */
  {
    const uint32_t va = 0x6FD72E20u;
    const char *nm = "ITEMS_GetTwoHandedFlag";
    /* Case A: NULL pItem */
    {
      clear_arena();
      RangeSpec pre[] = { { ADDR_UNIT, 244 } };
      uint32_t args[1] = { 0u };
      capture_pre(pre, 1, pre_bufs);
      uint32_t eax = call_stdcall1(va, 0u);
      emit_ndjson_line(fp, va, nm, "null_unit", args, 1, 0xFFFFFFFFu, eax, pre, 1, pre_bufs, pre, 1);
    }
    /* Case B: non-item unit (dwUnitType = 0) */
    {
      clear_arena();
      w32(ADDR_UNIT + 0x00, 0u);
      RangeSpec pre[] = { { ADDR_UNIT, 244 } };
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, 1, pre_bufs);
      uint32_t eax = call_stdcall1(va, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, "non_item_unit", args, 1, 0xFFFFFFFFu, eax, pre, 1, pre_bufs, pre, 1);
    }
    /* Cases C & D: valid items (2H = 1, 2H = 0) */
    for (uint32_t cid = 0; cid < 2; cid++) {
      char cid_name[32];
      snprintf(cid_name, sizeof(cid_name), "item_class_%u", cid);
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, cid);
      RangeSpec pre[] = {
        { VA_ITEMS_TXT_COUNT, 8 },
        { ADDR_UNIT, 244 },
        { ADDR_ITEMS_TXT, 4 * 424 }
      };
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, 3, pre_bufs);
      uint32_t eax = call_stdcall1(va, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, cid_name, args, 1, 0xFFFFFFFFu, eax, pre, 3, pre_bufs, pre, 3);
    }
  }

  /* 15. 0x6FD72FF0 ITEMS_GetAltGfxOrBaseCode */
  {
    const uint32_t va = 0x6FD72FF0u;
    const char *nm = "ITEMS_GetAltGfxOrBaseCode";
    const char *ids[3] = { "alt_zero_returns_code", "alt_nonzero_returns_alt", "alt_zero_tsc" };
    for (uint32_t cid = 0; cid < 3; cid++) {
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, cid);
      RangeSpec pre[] = {
        { VA_ITEMS_TXT_COUNT, 8 },
        { ADDR_UNIT, 244 },
        { ADDR_ITEMS_TXT, 4 * 424 }
      };
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, 3, pre_bufs);
      uint32_t eax = call_stdcall1(va, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, ids[cid], args, 1, 0xFFFFFFFFu, eax, pre, 3, pre_bufs, pre, 3);
    }
  }
}

/* =========================================================================
 * B030 Vector Suite (14 functions)
 * ========================================================================= */

static void emit_b030(FILE *fp) {
  uint8_t *pre_bufs[16];

  /* 1. 0x6FD730A0 ITEMS_IsTome */
  {
    const uint32_t va = 0x6FD730A0u;
    const char *nm = "ITEMS_IsTome";
    const char *ids[4] = { "wtype_45", "wtype_50", "wtype_39", "wtype_neg1" };
    for (uint32_t cid = 0; cid < 4; cid++) {
      clear_arena();
      RangeSpec pre[] = { { VA_ITEMS_TXT_COUNT, 8 }, { ADDR_ITEMS_TXT, 4 * 424 } };
      uint32_t args[1] = { cid };
      capture_pre(pre, 2, pre_bufs);
      uint32_t eax = call_stdcall1(va, cid);
      emit_ndjson_line(fp, va, nm, ids[cid], args, 1, 0xFFFFFFFFu, eax, pre, 2, pre_bufs, pre, 2);
    }
  }

  /* 2. 0x6FD73290 ITEMS_GetBaseCode */
  {
    const uint32_t va = 0x6FD73290u;
    const char *nm = "ITEMS_GetBaseCode";
    const char *ids[3] = { "code_hax", "code_cap", "code_tsc" };
    for (uint32_t cid = 0; cid < 3; cid++) {
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, cid);
      RangeSpec pre[] = {
        { VA_ITEMS_TXT_COUNT, 8 },
        { ADDR_UNIT, 244 },
        { ADDR_ITEMS_TXT, 4 * 424 }
      };
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, 3, pre_bufs);
      uint32_t eax = call_stdcall1(va, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, ids[cid], args, 1, 0xFFFFFFFFu, eax, pre, 3, pre_bufs, pre, 3);
    }
  }

  /* 3. 0x6FD73B70 ITEMS_SetOwnerGuid */
  {
    const uint32_t va = 0x6FD73B70u;
    const char *nm = "ITEMS_SetOwnerGuid";
    const uint32_t guids[3] = { 0u, 0x12345678u, 0xFFFFFFFFu };
    const char *ids[3] = { "guid_0", "guid_12345678", "guid_ffffffff" };
    for (int i = 0; i < 3; i++) {
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, 0u);
      w32(ADDR_ITEM_DATA + 0x10, 0xDEADBEEFu);
      RangeSpec pre[] = { { ADDR_UNIT, 244 }, { ADDR_ITEM_DATA, 116 } };
      uint32_t args[2] = { ADDR_UNIT, guids[i] };
      capture_pre(pre, 2, pre_bufs);
      uint32_t eax = call_stdcall2(va, ADDR_UNIT, guids[i]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 2, 0u, eax, pre, 2, pre_bufs, pre, 2);
    }
  }

  /* 4. 0x6FD73C70 ITEMS_AllocItemData (stdcall pMemPool, pItem) */
  {
    const uint32_t va = 0x6FD73C70u;
    const char *nm = "ITEMS_AllocItemData";
    /* Case A: NULL pItem */
    {
      clear_arena();
      reset_heap();
      RangeSpec pre[] = { { ADDR_UNIT, 244 } };
      uint32_t args[2] = { 0u, 0u };
      capture_pre(pre, 1, pre_bufs);
      uint32_t eax = call_stdcall2(va, 0u, 0u);
      emit_ndjson_line(fp, va, nm, "null_item", args, 2, 0u, eax, pre, 1, pre_bufs, pre, 1);
    }
    /* Case B: non-item unit (dwUnitType = 1) */
    {
      clear_arena();
      reset_heap();
      w32(ADDR_UNIT + 0x00, 1u);
      RangeSpec pre[] = { { ADDR_UNIT, 244 } };
      uint32_t args[2] = { 0u, ADDR_UNIT };
      capture_pre(pre, 1, pre_bufs);
      uint32_t eax = call_stdcall2(va, 0u, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, "non_item_unit", args, 2, 0u, eax, pre, 1, pre_bufs, pre, 1);
    }
    /* Case C: valid item unit -> allocates 0x74 bytes at HEAP_BASE (0x40000000), sets dwInitSeed = -1 */
    {
      clear_arena();
      reset_heap();
      w32(ADDR_UNIT + 0x00, 4u);
      RangeSpec pre[] = { { ADDR_UNIT, 244 } };
      RangeSpec post[] = { { ADDR_UNIT, 244 }, { HEAP_BASE, 116 } };
      uint32_t args[2] = { 0u, ADDR_UNIT };
      capture_pre(pre, 1, pre_bufs);
      uint32_t eax = call_stdcall2(va, 0u, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, "valid_item_alloc", args, 2, 0u, eax, pre, 1, pre_bufs, post, 2);
    }
  }

  /* 5. 0x6FD73DD0 ITEMS_WriteBitsClamped (esi=nBits, edx=nValue, [esp+4]=pBitStream) */
  {
    const uint32_t va = 0x6FD73DD0u;
    const char *nm = "ITEMS_WriteBitsClamped";
    struct {
      const char *id;
      uint32_t bits;
      uint32_t val;
      uint32_t init_pos;
      uint32_t init_bit;
    } cases[] = {
      { "normal_5bits", 5u, 19u, 0u, 0u },
      { "clamp_negative_to_0", 6u, (uint32_t)-15, 0u, 3u },
      { "clamp_overflow_to_max", 4u, 99u, 1u, 2u },
      { "full_32bits_unclamped", 32u, 0xCAFEBABEu, 0u, 0u },
      { "buffer_overflow_sets_bfull", 16u, 0x1234u, 31u, 0u }
    };
    for (int i = 0; i < 5; i++) {
      clear_arena();
      w32(ADDR_BITSTREAM + 0x00, ADDR_BITBUF);
      w32(ADDR_BITSTREAM + 0x04, 32u); /* nMaxBytes = 32 */
      w32(ADDR_BITSTREAM + 0x08, cases[i].init_pos);
      w32(ADDR_BITSTREAM + 0x0C, cases[i].init_bit);
      w32(ADDR_BITSTREAM + 0x10, 0u);
      RangeSpec pre[] = { { ADDR_BITSTREAM, 20 }, { ADDR_BITBUF, 32 } };
      uint32_t args[3] = { cases[i].bits, cases[i].val, ADDR_BITSTREAM };
      capture_pre(pre, 2, pre_bufs);
      call_esi_edx_stack1_ret4(va, cases[i].bits, cases[i].val, ADDR_BITSTREAM);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 3, 0u, 0u, pre, 2, pre_bufs, pre, 2);
    }
  }

  /* 6. 0x6FD74320 ITEMS_CheckItemTypeRarityUnder7 */
  {
    const uint32_t va = 0x6FD74320u;
    const char *nm = "ITEMS_CheckItemTypeRarityUnder7";
    /* Cases 0..3: class 0 (rarity 3 -> 1), class 1 (rarity 6 -> 1), class 2 (rarity 7 -> 0), class 3 (wType1 = -1 -> 0) */
    const char *ids[4] = { "rarity_3_true", "rarity_6_true", "rarity_7_false", "wtype_neg1_false" };
    for (uint32_t cid = 0; cid < 4; cid++) {
      clear_arena();
      RangeSpec pre[] = {
        { VA_ITEMS_TXT_COUNT, 8 },
        { VA_SGPT_DATATABLES, 4 },
        { ADDR_DT_SLICE, 80 },
        { ADDR_ITEMS_TXT, 4 * 424 },
        { ADDR_ITEMTYPES_TXT + 0x27u * 0xE4u, 16 * 0xE4u }
      };
      uint32_t args[1] = { cid };
      capture_pre(pre, 5, pre_bufs);
      uint32_t eax = call_stdcall1(va, cid);
      emit_ndjson_line(fp, va, nm, ids[cid], args, 1, 0xFFFFFFFFu, eax, pre, 5, pre_bufs, pre, 5);
    }
    /* Case 4: wType1 >= nItemTypesTxtRecordCount -> 0 */
    {
      clear_arena();
      w32(ADDR_DATATABLES + 0xBFC, 10u); /* count = 10 <= wType1 (45) */
      RangeSpec pre[] = {
        { VA_ITEMS_TXT_COUNT, 8 },
        { VA_SGPT_DATATABLES, 4 },
        { ADDR_DT_SLICE, 80 },
        { ADDR_ITEMS_TXT, 4 * 424 }
      };
      uint32_t args[1] = { 0u };
      capture_pre(pre, 4, pre_bufs);
      uint32_t eax = call_stdcall1(va, 0u);
      emit_ndjson_line(fp, va, nm, "wtype_ge_count_false", args, 1, 0xFFFFFFFFu, eax, pre, 4, pre_bufs, pre, 4);
    }
  }

  /* 7. 0x6FD74A50 ITEMS_AccumulateSocketedItemCosts */
  {
    const uint32_t va = 0x6FD74A50u;
    const char *nm = "ITEMS_AccumulateSocketedItemCosts";
    /* Case A: pInventory == 0 -> early return without modifying costs */
    {
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, 0u);
      w32(ADDR_UNIT + 0x60, 0u);
      w32(ADDR_OUT_COSTS + 0, 100u);
      w32(ADDR_OUT_COSTS + 4, 200u);
      w32(ADDR_OUT_COSTS + 8, 300u);
      RangeSpec pre[] = { { ADDR_UNIT, 244 }, { ADDR_OUT_COSTS, 16 } };
      uint32_t args[4] = { ADDR_UNIT, ADDR_OUT_COSTS + 0, ADDR_OUT_COSTS + 4, ADDR_OUT_COSTS + 8 };
      capture_pre(pre, 2, pre_bufs);
      call_eax_stack3_ret12(va, ADDR_UNIT, ADDR_OUT_COSTS + 0, ADDR_OUT_COSTS + 4, ADDR_OUT_COSTS + 8);
      emit_ndjson_line(fp, va, nm, "no_inventory", args, 4, 0u, 0u, pre, 2, pre_bufs, pre, 2);
    }
    /* Case B: bad inventory signature -> adds 0 */
    {
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, 0u);
      w32(ADDR_UNIT + 0x60, ADDR_INV);
      w32(ADDR_INV + 0x00, 0xDEADBEEFu);
      w32(ADDR_OUT_COSTS + 0, 100u);
      w32(ADDR_OUT_COSTS + 4, 200u);
      w32(ADDR_OUT_COSTS + 8, 300u);
      RangeSpec pre[] = { { ADDR_UNIT, 244 }, { ADDR_INV, 64 }, { ADDR_OUT_COSTS, 16 } };
      uint32_t args[4] = { ADDR_UNIT, ADDR_OUT_COSTS + 0, ADDR_OUT_COSTS + 4, ADDR_OUT_COSTS + 8 };
      capture_pre(pre, 3, pre_bufs);
      call_eax_stack3_ret12(va, ADDR_UNIT, ADDR_OUT_COSTS + 0, ADDR_OUT_COSTS + 4, ADDR_OUT_COSTS + 8);
      emit_ndjson_line(fp, va, nm, "bad_inv_sig", args, 4, 0u, 0u, pre, 3, pre_bufs, pre, 3);
    }
    /* Case C: empty inventory (pFirstItem == 0) */
    {
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, 0u);
      w32(ADDR_UNIT + 0x60, ADDR_INV);
      w32(ADDR_INV + 0x00, 0x01020304u);
      w32(ADDR_INV + 0x0C, 0u);
      w32(ADDR_OUT_COSTS + 0, 50u);
      w32(ADDR_OUT_COSTS + 4, 60u);
      w32(ADDR_OUT_COSTS + 8, 70u);
      RangeSpec pre[] = { { ADDR_UNIT, 244 }, { ADDR_INV, 64 }, { ADDR_OUT_COSTS, 16 } };
      uint32_t args[4] = { ADDR_UNIT, ADDR_OUT_COSTS + 0, ADDR_OUT_COSTS + 4, ADDR_OUT_COSTS + 8 };
      capture_pre(pre, 3, pre_bufs);
      call_eax_stack3_ret12(va, ADDR_UNIT, ADDR_OUT_COSTS + 0, ADDR_OUT_COSTS + 4, ADDR_OUT_COSTS + 8);
      emit_ndjson_line(fp, va, nm, "empty_inv", args, 4, 0u, 0u, pre, 3, pre_bufs, pre, 3);
    }
    /* Case D: 2 chained socketed items (class 0 cost=400 -> 200, class 1 cost=251 -> 125; sum = 325) */
    {
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, 0u);
      stage_item_unit(ADDR_UNIT2, ADDR_ITEM_DATA2, 0u);
      stage_item_unit(ADDR_UNIT3, ADDR_ITEM_DATA3, 1u);
      w32(ADDR_UNIT + 0x60, ADDR_INV);
      w32(ADDR_INV + 0x00, 0x01020304u);
      w32(ADDR_INV + 0x0C, ADDR_UNIT2);
      w32(ADDR_ITEM_DATA2 + 0x5C + 0x08, ADDR_UNIT3);
      w32(ADDR_ITEM_DATA3 + 0x5C + 0x08, 0u);
      w32(ADDR_OUT_COSTS + 0, 1000u);
      w32(ADDR_OUT_COSTS + 4, 2000u);
      w32(ADDR_OUT_COSTS + 8, 3000u);
      RangeSpec pre[] = {
        { VA_ITEMS_TXT_COUNT, 8 },
        { ADDR_UNIT, 244 },
        { ADDR_UNIT2, 244 },
        { ADDR_UNIT3, 244 },
        { ADDR_ITEM_DATA2, 116 },
        { ADDR_ITEM_DATA3, 116 },
        { ADDR_INV, 64 },
        { ADDR_ITEMS_TXT, 4 * 424 },
        { ADDR_OUT_COSTS, 16 }
      };
      uint32_t args[4] = { ADDR_UNIT, ADDR_OUT_COSTS + 0, ADDR_OUT_COSTS + 4, ADDR_OUT_COSTS + 8 };
      capture_pre(pre, 9, pre_bufs);
      call_eax_stack3_ret12(va, ADDR_UNIT, ADDR_OUT_COSTS + 0, ADDR_OUT_COSTS + 4, ADDR_OUT_COSTS + 8);
      emit_ndjson_line(fp, va, nm, "two_socketed_items", args, 4, 0u, 0u, pre, 9, pre_bufs, pre, 9);
    }
    /* Case E: first node in chain is non-item (dwUnitType = 1) -> terminates loop */
    {
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, 0u);
      w32(ADDR_UNIT2 + 0x00, 1u);
      w32(ADDR_UNIT + 0x60, ADDR_INV);
      w32(ADDR_INV + 0x00, 0x01020304u);
      w32(ADDR_INV + 0x0C, ADDR_UNIT2);
      w32(ADDR_OUT_COSTS + 0, 10u);
      w32(ADDR_OUT_COSTS + 4, 20u);
      w32(ADDR_OUT_COSTS + 8, 30u);
      RangeSpec pre[] = {
        { VA_ITEMS_TXT_COUNT, 8 },
        { ADDR_UNIT, 244 },
        { ADDR_UNIT2, 244 },
        { ADDR_INV, 64 },
        { ADDR_OUT_COSTS, 16 }
      };
      uint32_t args[4] = { ADDR_UNIT, ADDR_OUT_COSTS + 0, ADDR_OUT_COSTS + 4, ADDR_OUT_COSTS + 8 };
      capture_pre(pre, 5, pre_bufs);
      call_eax_stack3_ret12(va, ADDR_UNIT, ADDR_OUT_COSTS + 0, ADDR_OUT_COSTS + 4, ADDR_OUT_COSTS + 8);
      emit_ndjson_line(fp, va, nm, "non_item_in_chain", args, 4, 0u, 0u, pre, 5, pre_bufs, pre, 5);
    }
  }

  /* 8. 0x6FD76080 ITEMS_GetMaxSockets */
  {
    const uint32_t va = 0x6FD76080u;
    const char *nm = "ITEMS_GetMaxSockets";
    /* Case A: pStatListEx == 0 -> 0 */
    {
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, 0u);
      w32(ADDR_UNIT + 0x5C, 0u);
      RangeSpec pre[] = { { ADDR_UNIT, 244 } };
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, 1, pre_bufs);
      uint32_t eax = call_stdcall1(va, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, "no_statlist", args, 1, 0xFFFFFFFFu, eax, pre, 1, pre_bufs, pre, 1);
    }
    /* Case B: iscCount <= 0xC2 -> 0 */
    {
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, 0u);
      w32(ADDR_UNIT + 0x5C, ADDR_STATLIST_EX);
      w32(ADDR_DATATABLES + 0xBD4, 0xC2u);
      RangeSpec pre[] = {
        { VA_SGPT_DATATABLES, 4 },
        { ADDR_DT_SLICE, 80 },
        { ADDR_UNIT, 244 }
      };
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, 3, pre_bufs);
      uint32_t eax = call_stdcall1(va, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, "isc_count_too_small", args, 1, 0xFFFFFFFFu, eax, pre, 3, pre_bufs, pre, 3);
    }
    /* Case C: stat 0xC2 present (= 4) in base stat array */
    {
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, 0u);
      w32(ADDR_UNIT + 0x5C, ADDR_STATLIST_EX);
      w32(ADDR_STATLIST_EX + 0x24, ADDR_STAT_ARR);
      w16(ADDR_STATLIST_EX + 0x28, 1u);
      w16(ADDR_STATLIST_EX + 0x2A, 8u);
      w32(ADDR_STAT_ARR + 0, 0x00C20000u);
      w32(ADDR_STAT_ARR + 4, 4u);
      RangeSpec pre[] = {
        { VA_SGPT_DATATABLES, 4 },
        { ADDR_DT_SLICE, 80 },
        { ADDR_UNIT, 244 },
        { ADDR_STATLIST_EX, 100 },
        { ADDR_STAT_ARR, 64 }
      };
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, 5, pre_bufs);
      uint32_t eax = call_stdcall1(va, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, "sockets_4", args, 1, 0xFFFFFFFFu, eax, pre, 5, pre_bufs, pre, 5);
    }
  }

  /* 9. 0x6FD79D90 ITEMS_DecodeAndSetSaveStat */
  {
    const uint32_t va = 0x6FD79D90u;
    const char *nm = "ITEMS_DecodeAndSetSaveStat";
    struct {
      const char *id;
      uint32_t slot;
      uint32_t ver;
      uint32_t stat_id;
      uint8_t val_shift;
      uint8_t save_bits;
      uint32_t save_add;
      uint32_t param_bits;
      uint32_t raw_stream;
      uint32_t use_list;
    } cases[] = {
      /* Default path (> 0x6A) with paramBits = 4, saveBits = 6, saveAdd = 10, shift = 0 */
      { "default_with_param", 0u, 100u, 0x70u, 0u, 6u, 10u, 4u, (35u << 4) | 7u, 1u },
      /* Case 0: stat 0x17, ver <= 0x59 -> saveBits = 5 */
      { "stat_17_old_ver", 0u, 0x59u, 0x17u, 0u, 8u, 0u, 0u, 0xFFu, 1u },
      /* Case 1: stat 0x18, ver <= 0x59 -> saveBits = 6, and ver > 0x59 -> saveBits from ISC */
      { "stat_18_old_ver", 1u, 0x59u, 0x18u, 0u, 8u, 0u, 0u, 0xFFu, 1u },
      { "stat_18_new_ver", 1u, 100u, 0x18u, 0u, 6u, 3u, 0u, 22u, 1u },
      /* Case 2: stat 0x4A, ver <= 0x59 -> saveBits = 5, saveAdd = 10, and ver > 0x59 */
      { "stat_4a_old_ver", 0u, 0x59u, 0x4Au, 0u, 8u, 0u, 0u, 25u, 1u },
      { "stat_4a_new_ver", 0u, 100u, 0x4Au, 0u, 6u, 5u, 0u, 25u, 1u },
      /* Case 3: stat 0x4F, ver <= 0x59 -> saveBits = 8, saveAdd = 20, and ver > 0x59 */
      { "stat_4f_old_ver", 0u, 0x59u, 0x4Fu, 0u, 6u, 0u, 0u, 100u, 1u },
      { "stat_4f_new_ver", 0u, 100u, 0x4Fu, 0u, 6u, 10u, 0u, 40u, 1u },
      /* Case 4: stat 0x50, ver <= 0x59 -> saveBits = 7, saveAdd = 20, and ver > 0x59 */
      { "stat_50_old_ver", 0u, 0x59u, 0x50u, 0u, 6u, 0u, 0u, 80u, 1u },
      { "stat_50_new_ver", 0u, 100u, 0x50u, 0u, 6u, 10u, 0u, 45u, 1u },
      /* Case 5: stat 0x5C, ver < 0x5D -> statId = 0x5D, and ver >= 0x5D */
      { "stat_5c_remap_5d", 0u, 0x5Cu, 0x5Cu, 1u, 5u, 0u, 0u, 12u, 1u },
      { "stat_5c_new_ver", 0u, 0x5Du, 0x5Cu, 1u, 5u, 0u, 0u, 12u, 1u },
      /* Case 6: stat 0x5D, ver <= 0x57 -> saveBits = 6, and ver > 0x57 */
      { "stat_5d_ver57", 0u, 0x57u, 0x5Du, 0u, 8u, 0u, 0u, 0xFFu, 1u },
      { "stat_5d_new_ver", 0u, 100u, 0x5Du, 0u, 6u, 0u, 0u, 33u, 1u },
      /* Case 7: stat 0x5F, ver < 0x5D -> statId = 0x60 */
      { "stat_5f_remap_60", 0u, 0x50u, 0x5Fu, 0u, 5u, 0u, 0u, 9u, 1u },
      /* Case 8: stat 0x62, ver < 0x5D -> statId = 0x63 */
      { "stat_62_remap_63", 0u, 0x50u, 0x62u, 0u, 5u, 0u, 0u, 11u, 1u },
      /* Case 9: stat 0x65, ver < 0x5D -> statId = 0x66 */
      { "stat_65_remap_66", 0u, 0x50u, 0x65u, 0u, 5u, 0u, 0u, 13u, 1u },
      /* Case 10: stat 0x68, ver < 0x5D -> statId = 0x69 */
      { "stat_68_remap_69", 0u, 0x50u, 0x68u, 0u, 5u, 0u, 0u, 15u, 1u },
      /* pStatList == 0 -> consumes bits but skips STATLIST_SetStat */
      { "null_statlist", 0u, 100u, 0x17u, 0u, 6u, 2u, 0u, 19u, 0u }
    };
    for (int i = 0; i < 19; i++) {
      clear_arena();
      w8(ADDR_ISC_SINGLE + 0x18, cases[i].val_shift);
      w8(ADDR_ISC_SINGLE + 0x19 + cases[i].slot, cases[i].save_bits);
      w32(ADDR_ISC_SINGLE + 0x1C + cases[i].slot * 4u, cases[i].save_add);
      w32(ADDR_ISC_SINGLE + 0x24 + cases[i].slot * 4u, cases[i].param_bits);

      w32(ADDR_BITSTREAM + 0x00, ADDR_BITBUF);
      w32(ADDR_BITSTREAM + 0x04, 32u);
      w32(ADDR_BITSTREAM + 0x08, 0u);
      w32(ADDR_BITSTREAM + 0x0C, 0u);
      w32(ADDR_BITSTREAM + 0x10, 0u);
      w32(ADDR_BITBUF + 0, cases[i].raw_stream);

      w32(ADDR_STATLIST_EX + 0x24, ADDR_STAT_ARR);
      w16(ADDR_STATLIST_EX + 0x28, 0u);
      w16(ADDR_STATLIST_EX + 0x2A, 8u);

      uint32_t plist = cases[i].use_list ? ADDR_STATLIST_EX : 0u;
      RangeSpec pre[] = {
        { ADDR_ISC_SINGLE, 324 },
        { ADDR_BITSTREAM, 20 },
        { ADDR_BITBUF, 32 },
        { ADDR_STATLIST_EX, 100 },
        { ADDR_STAT_ARR, 64 }
      };
      uint32_t args[6] = {
        cases[i].slot,
        cases[i].ver,
        ADDR_ISC_SINGLE,
        ADDR_BITSTREAM,
        plist,
        cases[i].stat_id
      };
      capture_pre(pre, 5, pre_bufs);
      call_eax_ecx_esi_stack3_ret12(
        va,
        cases[i].slot,
        cases[i].ver,
        ADDR_ISC_SINGLE,
        ADDR_BITSTREAM,
        plist,
        cases[i].stat_id
      );
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 6, 0u, 0u, pre, 5, pre_bufs, pre, 5);
    }
  }

  /* 10. 0x6FD79F30 ITEMS_EnsureMinimumBaseDamageAndACStats (esi=pItem, [esp+4]=nStatId) */
  {
    const uint32_t va = 0x6FD79F30u;
    const char *nm = "ITEMS_EnsureMinimumBaseDamageAndACStats";
    struct {
      const char *id;
      uint32_t class_id;
      uint32_t stat_id;
      uint32_t pre_stat_val;
    } cases[] = {
      /* Case A: armor (class 1, nMinAc=50) with statId=0x10 and existing AC=20 -> sets 0x1F to 51 */
      { "armor_raise_to_min_plus_1", 1u, 0x10u, 20u },
      /* Case B: armor (class 1, nMinAc=50) with statId=0x1F and existing AC=60 -> increments 0x1F to 61 */
      { "armor_inc_existing_above_min", 1u, 0x1Fu, 60u },
      /* Case C: weapon (class 0, throwable) with statId=0x11 and low max damages -> raises 0x16, 0x18, 0xA0 */
      { "weapon_maxdam_raise_all", 0u, 0x11u, 5u },
      /* Case D: weapon (class 0, throwable) with statId=0x16 and already high max damages -> keeps existing */
      { "weapon_maxdam_already_high", 0u, 0x16u, 50u },
      /* Case E: weapon (class 0, throwable) with statId=0x12 and low min damages -> raises 0x15, 0x17, 0x9F */
      { "weapon_mindam_raise_all", 0u, 0x12u, 2u },
      /* Case F: weapon (class 0, throwable) with statId=0x15 and already high min damages -> keeps existing */
      { "weapon_mindam_already_high", 0u, 0x15u, 50u },
      /* Case G: non-throwable weapon (class 2) with statId=0x11 -> skips 0xA0 */
      { "weapon_nonthrow_maxdam", 2u, 0x11u, 5u },
      /* Case H: non-throwable weapon (class 2) with statId=0x12 -> skips 0x9F */
      { "weapon_nonthrow_mindam", 2u, 0x12u, 2u },
      /* Case I: non-armor item (class 0) with statId=0x10 -> no-op */
      { "non_armor_stat_10_noop", 0u, 0x10u, 20u },
      /* Case J: non-weapon item (class 1) with statId=0x11 -> no-op */
      { "non_weapon_stat_11_noop", 1u, 0x11u, 5u },
      /* Case K: non-weapon item (class 1) with statId=0x12 -> no-op */
      { "non_weapon_stat_12_noop", 1u, 0x12u, 2u },
      /* Case L: default switch case inside range (statId=0x13) -> no-op */
      { "default_stat_13_noop", 0u, 0x13u, 2u },
      /* Case M: statId outside jump table range (statId=0xFF) -> no-op */
      { "stat_oob_ff_noop", 0u, 0xFFu, 2u },
      /* Case N: code not found in pItemsLink (class 3 'xxx ') -> early return */
      { "unlinked_code_noop", 3u, 0x11u, 5u }
    };
    const uint32_t keys[7] = {
      0x00150000u, 0x00160000u, 0x00170000u, 0x00180000u, 0x001F0000u, 0x009F0000u, 0x00A00000u
    };
    for (int i = 0; i < 14; i++) {
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, cases[i].class_id);
      w32(ADDR_UNIT + 0x5C, ADDR_STATLIST_EX);
      w32(ADDR_STATLIST_EX + 0x24, ADDR_STAT_ARR);
      w16(ADDR_STATLIST_EX + 0x28, 7u);
      w16(ADDR_STATLIST_EX + 0x2A, 8u);
      for (int k = 0; k < 7; k++) {
        w32(ADDR_STAT_ARR + k * 8u + 0u, keys[k]);
        w32(ADDR_STAT_ARR + k * 8u + 4u, cases[i].pre_stat_val);
      }

      RangeSpec pre[] = {
        { VA_ITEMS_TXT_COUNT, 8 },
        { VA_ITEMS_LINK_PTR, 4 },
        { VA_SGPT_DATATABLES, 4 },
        { VA_GDWBITMASKS_IAT, 4 },
        { ADDR_BITMASKS, 128 },
        { ADDR_DT_SLICE, 80 },
        { ADDR_LINK, 16 },
        { ADDR_LINK_ENTRIES, 24 },
        { ADDR_ITEMS_TXT, 4 * 424 },
        { ADDR_ITEMTYPES_TXT + 0x27u * 0xE4u, 16 * 0xE4u },
        { ADDR_EQUIV_MATRIX, 512 },
        { ADDR_UNIT, 244 },
        { ADDR_STATLIST_EX, 100 },
        { ADDR_STAT_ARR, 64 }
      };
      uint32_t args[2] = { ADDR_UNIT, cases[i].stat_id };
      capture_pre(pre, 14, pre_bufs);
      call_esi_stack1_ret4(va, ADDR_UNIT, cases[i].stat_id);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 2, 0u, 0u, pre, 14, pre_bufs, pre, 14);
    }
  }

  /* 11. 0x6FD7D0F0 DRLGWARP_TestRoomTileBit */
  {
    const uint32_t va = 0x6FD7D0F0u;
    const char *nm = "DRLGWARP_TestRoomTileBit";
    struct {
      const char *id;
      uint32_t x;
      uint32_t y;
    } cases[] = {
      { "bit_0_0_set", 0u, 0u },
      { "bit_0_1_clear", 0u, 1u },
      { "bit_2_5_set", 2u, 5u },
      { "bit_3_7_clear", 3u, 7u }
    };
    for (int i = 0; i < 4; i++) {
      clear_arena();
      w32(ADDR_WARP_MASK_PTR, ADDR_WARP_BITS);
      w8(ADDR_WARP_BITS + 0, 0x01u); /* bit 0 (x=0, y=0) set */
      /* x=2, y=5 -> bitIdx = 37 -> byte 4, bit 5 (0x20) */
      w8(ADDR_WARP_BITS + 4, 0x20u);
      RangeSpec pre[] = { { ADDR_WARP_MASK_PTR, 4 }, { ADDR_WARP_BITS, 64 } };
      uint32_t args[3] = { ADDR_WARP_MASK_PTR, cases[i].x, cases[i].y };
      capture_pre(pre, 2, pre_bufs);
      uint32_t eax = call_stdcall3(va, ADDR_WARP_MASK_PTR, cases[i].x, cases[i].y);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 3, 0xFFFFFFFFu, eax, pre, 2, pre_bufs, pre, 2);
    }
  }

  /* 12. 0x6FD95A40 ITEMS_GetItemsTxtRecordFromUnitOrAlt (eax=pUnit1, ecx=pUnit2) */
  {
    const uint32_t va = 0x6FD95A40u;
    const char *nm = "ITEMS_GetItemsTxtRecordFromUnitOrAlt";
    /* Case A: pUnit1 is valid item (class 1) -> returns record 1 */
    {
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, 1u);
      stage_item_unit(ADDR_UNIT2, ADDR_ITEM_DATA2, 2u);
      RangeSpec pre[] = { { VA_ITEMS_TXT_COUNT, 8 }, { ADDR_UNIT, 244 }, { ADDR_UNIT2, 244 } };
      uint32_t args[2] = { ADDR_UNIT, ADDR_UNIT2 };
      capture_pre(pre, 3, pre_bufs);
      uint32_t eax = call_eax_ecx_ret(va, ADDR_UNIT, ADDR_UNIT2);
      emit_ndjson_line(fp, va, nm, "unit1_is_item", args, 2, 0xFFFFFFFFu, eax, pre, 3, pre_bufs, pre, 3);
    }
    /* Case B: pUnit1 is NULL, pUnit2 is non-NULL (class 2) -> returns record 2 */
    {
      clear_arena();
      w32(ADDR_UNIT2 + 0x00, 0u);
      w32(ADDR_UNIT2 + 0x04, 2u);
      RangeSpec pre[] = { { VA_ITEMS_TXT_COUNT, 8 }, { ADDR_UNIT2, 244 } };
      uint32_t args[2] = { 0u, ADDR_UNIT2 };
      capture_pre(pre, 2, pre_bufs);
      uint32_t eax = call_eax_ecx_ret(va, 0u, ADDR_UNIT2);
      emit_ndjson_line(fp, va, nm, "unit1_null_fallback_unit2", args, 2, 0xFFFFFFFFu, eax, pre, 2, pre_bufs, pre, 2);
    }
    /* Case C: pUnit1 is non-item, pUnit2 is NULL -> nItemId = -1 -> returns 0 */
    {
      clear_arena();
      w32(ADDR_UNIT + 0x00, 0u);
      RangeSpec pre[] = { { VA_ITEMS_TXT_COUNT, 8 }, { ADDR_UNIT, 244 } };
      uint32_t args[2] = { ADDR_UNIT, 0u };
      capture_pre(pre, 2, pre_bufs);
      uint32_t eax = call_eax_ecx_ret(va, ADDR_UNIT, 0u);
      emit_ndjson_line(fp, va, nm, "unit1_nonitem_unit2_null", args, 2, 0xFFFFFFFFu, eax, pre, 2, pre_bufs, pre, 2);
    }
  }

  /* 13. 0x6FD96A40 ITEMS_ApplyEtherealBonusStats */
  {
    const uint32_t va = 0x6FD96A40u;
    const char *nm = "ITEMS_ApplyEtherealBonusStats";
    /* Case A: weapon (class 0) scales 0x15, 0x16, 0x17, 0x18, 0x9F, 0xA0 by 3/2 and sets 0x400000 flag */
    {
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, 0u);
      w32(ADDR_ITEM_DATA + 0x18, 0x00000001u);
      w32(ADDR_UNIT + 0x5C, ADDR_STATLIST_EX);
      w32(ADDR_STATLIST_EX + 0x24, ADDR_STAT_ARR);
      w16(ADDR_STATLIST_EX + 0x28, 6u);
      w16(ADDR_STATLIST_EX + 0x2A, 8u);
      /* Sorted by dwKey: 0x15, 0x16, 0x17, 0x18, 0x9F, 0xA0 */
      w32(ADDR_STAT_ARR + 0 * 8 + 0, 0x00150000u); w32(ADDR_STAT_ARR + 0 * 8 + 4, 10u);
      w32(ADDR_STAT_ARR + 1 * 8 + 0, 0x00160000u); w32(ADDR_STAT_ARR + 1 * 8 + 4, 21u);
      w32(ADDR_STAT_ARR + 2 * 8 + 0, 0x00170000u); w32(ADDR_STAT_ARR + 2 * 8 + 4, 30u);
      w32(ADDR_STAT_ARR + 3 * 8 + 0, 0x00180000u); w32(ADDR_STAT_ARR + 3 * 8 + 4, 45u);
      w32(ADDR_STAT_ARR + 4 * 8 + 0, 0x009F0000u); w32(ADDR_STAT_ARR + 4 * 8 + 4, 12u);
      w32(ADDR_STAT_ARR + 5 * 8 + 0, 0x00A00000u); w32(ADDR_STAT_ARR + 5 * 8 + 4, 25u);

      RangeSpec pre[] = {
        { VA_ITEMS_TXT_COUNT, 8 },
        { VA_SGPT_DATATABLES, 4 },
        { VA_GDWBITMASKS_IAT, 4 },
        { ADDR_BITMASKS, 128 },
        { ADDR_DT_SLICE, 80 },
        { ADDR_ITEMS_TXT, 4 * 424 },
        { ADDR_EQUIV_MATRIX, 512 },
        { ADDR_UNIT, 244 },
        { ADDR_ITEM_DATA, 116 },
        { ADDR_STATLIST_EX, 100 },
        { ADDR_STAT_ARR, 64 }
      };
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, 11, pre_bufs);
      call_stdcall1(va, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, "weapon_scales_6_damage_stats", args, 1, 0u, 0u, pre, 11, pre_bufs, pre, 11);
    }
    /* Case B: armor (class 1) scales 0x1F (AC = 51 -> 76) and sets 0x400000 flag */
    {
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, 1u);
      w32(ADDR_ITEM_DATA + 0x18, 0u);
      w32(ADDR_UNIT + 0x5C, ADDR_STATLIST_EX);
      w32(ADDR_STATLIST_EX + 0x24, ADDR_STAT_ARR);
      w16(ADDR_STATLIST_EX + 0x28, 1u);
      w16(ADDR_STATLIST_EX + 0x2A, 8u);
      w32(ADDR_STAT_ARR + 0, 0x001F0000u);
      w32(ADDR_STAT_ARR + 4, 51u);

      RangeSpec pre[] = {
        { VA_ITEMS_TXT_COUNT, 8 },
        { VA_SGPT_DATATABLES, 4 },
        { VA_GDWBITMASKS_IAT, 4 },
        { ADDR_BITMASKS, 128 },
        { ADDR_DT_SLICE, 80 },
        { ADDR_ITEMS_TXT, 4 * 424 },
        { ADDR_EQUIV_MATRIX, 512 },
        { ADDR_UNIT, 244 },
        { ADDR_ITEM_DATA, 116 },
        { ADDR_STATLIST_EX, 100 },
        { ADDR_STAT_ARR, 64 }
      };
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, 11, pre_bufs);
      call_stdcall1(va, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, "armor_scales_ac_stat", args, 1, 0u, 0u, pre, 11, pre_bufs, pre, 11);
    }
    /* Case C: secondary weapon type via wType2 (class 2 has wType1=0x27, wType2=0x2D) */
    {
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, 2u);
      w32(ADDR_UNIT + 0x5C, ADDR_STATLIST_EX);
      w32(ADDR_STATLIST_EX + 0x24, ADDR_STAT_ARR);
      w16(ADDR_STATLIST_EX + 0x28, 1u);
      w16(ADDR_STATLIST_EX + 0x2A, 8u);
      w32(ADDR_STAT_ARR + 0, 0x00150000u);
      w32(ADDR_STAT_ARR + 4, (uint32_t)-7); /* negative stat: (-7 * 3) / 2 = -10 */

      RangeSpec pre[] = {
        { VA_ITEMS_TXT_COUNT, 8 },
        { VA_SGPT_DATATABLES, 4 },
        { VA_GDWBITMASKS_IAT, 4 },
        { ADDR_BITMASKS, 128 },
        { ADDR_DT_SLICE, 80 },
        { ADDR_ITEMS_TXT, 4 * 424 },
        { ADDR_EQUIV_MATRIX, 512 },
        { ADDR_UNIT, 244 },
        { ADDR_ITEM_DATA, 116 },
        { ADDR_STATLIST_EX, 100 },
        { ADDR_STAT_ARR, 64 }
      };
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, 11, pre_bufs);
      call_stdcall1(va, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, "weapon_via_wtype2_negative", args, 1, 0u, 0u, pre, 11, pre_bufs, pre, 11);
    }
    /* Case D: neither weapon nor armor (class 3, wType1=-1, wType2=-1) -> sets 0x400000 flag only */
    {
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, 3u);
      w32(ADDR_ITEM_DATA + 0x18, 0x00000002u);

      RangeSpec pre[] = {
        { VA_ITEMS_TXT_COUNT, 8 },
        { VA_SGPT_DATATABLES, 4 },
        { VA_GDWBITMASKS_IAT, 4 },
        { ADDR_BITMASKS, 128 },
        { ADDR_DT_SLICE, 80 },
        { ADDR_ITEMS_TXT, 4 * 424 },
        { ADDR_EQUIV_MATRIX - 8, 520 },
        { ADDR_UNIT, 244 },
        { ADDR_ITEM_DATA, 116 }
      };
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, 9, pre_bufs);
      call_stdcall1(va, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, "non_weapon_non_armor_sets_flag_only", args, 1, 0u, 0u, pre, 9, pre_bufs, pre, 9);
    }
  }

  /* 14. 0x6FD96E50 ITEMS_ResetBaseDamageOrACStatFromTxt (esi=pItem, [esp+4]=nStatId) */
  {
    const uint32_t va = 0x6FD96E50u;
    const char *nm = "ITEMS_ResetBaseDamageOrACStatFromTxt";
    struct {
      const char *id;
      uint32_t class_id;
      uint32_t stat_id;
      uint32_t pre_stat_key;
      uint32_t pre_stat_val;
    } cases[] = {
      /* Case A: armor (class 1, nMinAc=50) with statId=0x10 and existing AC=20 -> sets 0x1F to 51 */
      { "armor_reset_min_ac", 1u, 0x10u, 0x001F0000u, 20u },
      /* Case B: weapon (class 0, throwable) with statId=0x11 and existing 0x16=99 -> resets 0x16=24, 0x18=42, 0xA0=30 */
      { "weapon_reset_maxdam_unconditional", 0u, 0x11u, 0x00160000u, 99u },
      /* Case C: weapon (class 0, throwable) with statId=0x12 and existing 0x15=99 -> resets 0x15=10, 0x17=18, 0x9F=14 */
      { "weapon_reset_mindam_unconditional", 0u, 0x12u, 0x00150000u, 99u },
      /* Case D: non-throwable weapon (class 2) with statId=0x11 -> resets 0x16 and 0x18, skips 0xA0 */
      { "weapon_nonthrow_reset_maxdam", 2u, 0x11u, 0x00160000u, 99u },
      /* Case E: non-throwable weapon (class 2) with statId=0x12 -> resets 0x15 and 0x17, skips 0x9F */
      { "weapon_nonthrow_reset_mindam", 2u, 0x12u, 0x00150000u, 99u },
      /* Case F: non-armor (class 0) with statId=0x10 -> no-op */
      { "non_armor_stat_10_noop", 0u, 0x10u, 0x001F0000u, 20u },
      /* Case G: non-weapon (class 1) with statId=0x11 -> no-op */
      { "non_weapon_stat_11_noop", 1u, 0x11u, 0x00160000u, 99u },
      /* Case H: non-weapon (class 1) with statId=0x12 -> no-op */
      { "non_weapon_stat_12_noop", 1u, 0x12u, 0x00150000u, 99u },
      /* Case I: default switch case inside range (statId=0x14) -> no-op */
      { "default_stat_14_noop", 0u, 0x14u, 0x00150000u, 99u },
      /* Case J: statId outside jump table range (statId=0xFF) -> no-op */
      { "stat_oob_ff_noop", 0u, 0xFFu, 0x00150000u, 99u },
      /* Case K: unlinked code (class 3) -> early return */
      { "unlinked_code_noop", 3u, 0x11u, 0x00160000u, 99u }
    };
    for (int i = 0; i < 11; i++) {
      clear_arena();
      stage_item_unit(ADDR_UNIT, ADDR_ITEM_DATA, cases[i].class_id);
      w32(ADDR_UNIT + 0x5C, ADDR_STATLIST_EX);
      w32(ADDR_STATLIST_EX + 0x24, ADDR_STAT_ARR);
      w16(ADDR_STATLIST_EX + 0x28, 1u);
      w16(ADDR_STATLIST_EX + 0x2A, 8u);
      w32(ADDR_STAT_ARR + 0, cases[i].pre_stat_key);
      w32(ADDR_STAT_ARR + 4, cases[i].pre_stat_val);

      RangeSpec pre[] = {
        { VA_ITEMS_TXT_COUNT, 8 },
        { VA_ITEMS_LINK_PTR, 4 },
        { VA_SGPT_DATATABLES, 4 },
        { VA_GDWBITMASKS_IAT, 4 },
        { ADDR_BITMASKS, 128 },
        { ADDR_DT_SLICE, 80 },
        { ADDR_LINK, 16 },
        { ADDR_LINK_ENTRIES, 24 },
        { ADDR_ITEMS_TXT, 4 * 424 },
        { ADDR_ITEMTYPES_TXT + 0x27u * 0xE4u, 16 * 0xE4u },
        { ADDR_EQUIV_MATRIX, 512 },
        { ADDR_UNIT, 244 },
        { ADDR_STATLIST_EX, 100 },
        { ADDR_STAT_ARR, 64 }
      };
      uint32_t args[2] = { ADDR_UNIT, cases[i].stat_id };
      capture_pre(pre, 14, pre_bufs);
      call_esi_stack1_ret4(va, ADDR_UNIT, cases[i].stat_id);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 2, 0u, 0u, pre, 14, pre_bufs, pre, 14);
    }
  }
}

int main(int argc, char **argv) {
  const char *dll_dir = (argc > 1) ? argv[1] : ".";
  const char *out_b027 = (argc > 2) ? argv[2] : "b027-vectors.ndjson";
  const char *out_b030 = (argc > 3) ? argv[3] : "b030-vectors.ndjson";

  SetDllDirectoryA(dll_dir);
  LoadLibraryA("Storm.dll");
  LoadLibraryA("Fog.dll");
  HMODULE hD2Common = LoadLibraryA("D2Common.dll");
  if (!hD2Common) {
    fprintf(stderr, "Failed to load D2Common.dll from %s\n", dll_dir);
    return 1;
  }
  if ((uintptr_t)hD2Common != 0x6FD50000u) {
    fprintf(stderr, "D2Common.dll loaded at unexpected base %p\n", (void *)hD2Common);
    return 2;
  }

  void *arena = VirtualAlloc(
    (void *)(uintptr_t)ARENA_BASE,
    ARENA_SIZE,
    MEM_RESERVE | MEM_COMMIT,
    PAGE_READWRITE
  );
  void *heap = VirtualAlloc(
    (void *)(uintptr_t)HEAP_BASE,
    HEAP_SIZE,
    MEM_RESERVE | MEM_COMMIT,
    PAGE_READWRITE
  );
  if (!arena || !heap) {
    fprintf(stderr, "VirtualAlloc failed\n");
    return 3;
  }

  /* Unprotect D2Common .rdata/.data/.bss so we can hook IAT slots and stage globals */
  DWORD old_prot = 0;
  VirtualProtect((void *)(uintptr_t)0x6FDD9000u, 0x18000u, PAGE_READWRITE, &old_prot);
  w32(0x6FDD90D4u, (uint32_t)(uintptr_t)&stub_fog_assert_line);
  w32(0x6FDD90D0u, (uint32_t)(uintptr_t)&stub_fog_10045);

  FILE *fp27 = fopen(out_b027, "wb");
  FILE *fp30 = fopen(out_b030, "wb");
  if (!fp27 || !fp30) {
    fprintf(stderr, "Failed to open output files\n");
    return 4;
  }

  emit_b027(fp27);
  emit_b030(fp30);

  fclose(fp27);
  fclose(fp30);
  printf("Successfully emitted %s and %s\n", out_b027, out_b030);
  return 0;
}
