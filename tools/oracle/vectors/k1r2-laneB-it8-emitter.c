/*
 * Standalone MinGW real-DLL differential vector emitter for K1r2 Iteration 8 Lane B:
 * - Batch B039 (10 D2Common.dll v1.13c internalComposite functions across datatbls-113c.ts, items.ts, skills.ts)
 * - Batch B049 (16 D2Common.dll v1.13c hostImport functions across items.ts, datatbls-113c.ts, skills.ts)
 * - Batch B052 (17 D2Common.dll v1.13c internalComposite functions in items.ts + 3 temporary B043 callees)
 *
 * Uses register-only inline assembly constraints (zero stack-memory constraints) and verifies 100%
 * SHA-256 parity between -O2 and -O2 -fno-omit-frame-pointer builds under Wine.
 */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <setjmp.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define ARENA_BASE 0x20000000u
#define ARENA_SIZE 0x00100000u
#define HEAP_BASE  0x40000000u
#define HEAP_SIZE  0x00100000u

/* Arena layout within 0x20000100..0x20000FF0 */
#define ADDR_UNIT          0x20000100u /* 0x100: D2UnitStrc #1 */
#define ADDR_UNIT2         0x20000200u /* 0x100: D2UnitStrc #2 */
#define ADDR_UNIT3         0x20000300u /* 0x100: D2UnitStrc #3 */
#define ADDR_ITEMDATA1     0x20000400u /* 0x80:  D2ItemDataStrc #1 */
#define ADDR_ITEMDATA2     0x20000480u /* 0x80:  D2ItemDataStrc #2 */
#define ADDR_ITEMDATA3     0x20000500u /* 0x80:  D2ItemDataStrc #3 */
#define ADDR_INV1          0x20000580u /* 0x40:  D2InventoryStrc #1 */
#define ADDR_INV2          0x200005C0u /* 0x40:  D2InventoryStrc #2 */
#define ADDR_GRID_ARR      0x20000600u /* 0x40:  D2InventoryGridStrc[2] */
#define ADDR_GRID_ITEMS    0x20000640u /* 0x40:  uint32_t ppItems[16] */
#define ADDR_INV_NODE1     0x20000680u /* 0x20:  D2InventoryNodeStrc #1 */
#define ADDR_INV_NODE2     0x200006A0u /* 0x20:  D2InventoryNodeStrc #2 */
#define ADDR_INV_NODE3     0x200006C0u /* 0x20:  D2InventoryNodeStrc #3 */
#define ADDR_STATLIST1     0x20000700u /* 0x80:  D2StatListExStrc #1 */
#define ADDR_STATLIST2     0x20000780u /* 0x80:  D2StatListExStrc #2 */
#define ADDR_STAT_ARR1     0x20000800u /* 0x40:  D2StatStrc[8] #1 */
#define ADDR_STAT_ARR2     0x20000840u /* 0x40:  D2StatStrc[8] #2 */
#define ADDR_STATE_FLAGS   0x20000880u /* 0x20:  uint32_t pStateFlags[8] */
#define ADDR_STATE_MASKS   0x200008A0u /* 0x20:  uint32_t fStateMasks[8] */
#define ADDR_SKILL_LIST    0x20000900u /* 0x20:  D2SkillListStrc */
#define ADDR_SKILL0        0x20000940u /* 0x40:  D2SkillStrc #0 */
#define ADDR_SKILL1        0x20000980u /* 0x40:  D2SkillStrc #1 */
#define ADDR_SKILL2        0x200009C0u /* 0x40:  D2SkillStrc #2 */
#define ADDR_PATH1         0x20000A00u /* 0x40:  D2DynamicPathStrc / D2StaticPathStrc */
#define ADDR_BITSTREAM     0x20000A40u /* 0x20:  D2BitBufferStrc */
#define ADDR_BS_BUF        0x20000A60u /* 0x40:  bitstream byte buffer */
#define ADDR_LEVEL         0x20000AC0u /* 0x40:  D2DrlgLevelStrc */
#define ADDR_ROOM1         0x20000B00u /* 0x60:  D2RoomExStrc #1 */
#define ADDR_ROOM2         0x20000B60u /* 0x60:  D2RoomExStrc #2 */
#define ADDR_ROOM3         0x20000BC0u /* 0x60:  D2RoomExStrc #3 */
#define ADDR_CALC_BUF      0x20000C20u /* 0x40:  ItemsCode postfix buffer */
#define ADDR_BITMASKS      0x20000C60u /* 0x80:  gdwBitMasks[32] */
#define ADDR_EXP_TXT       0x20000CE0u /* 0x10:  D2ExperienceTxt */
#define ADDR_LINK          0x20000CF0u /* 0x10:  Fog.#10213 linker header */
#define ADDR_LINK_ENTRIES  0x20000D00u /* 0x40:  8 * 8-byte {dwCode, nIndex} */
#define ADDR_SCRATCH       0x20000D40u /* 0x40:  pCost0, pCost1, pCost2, pOutSum, ppItemCtx */
#define ADDR_MAGAFFIX_REC  0x20000D80u /* 0x90:  D2MagicAffixTxt record */

/* Data tables in 0x20001000..0x20030000 */
#define ADDR_DATATABLES       0x20001000u /* 0xD00: D2DataTablesStrc */
#define ADDR_ITEMS_TXT        0x20002000u /* 8 * 0x1A8 = 0xD40 */
#define ADDR_ITEMTYPES_TXT    0x20003000u /* 8 * 0xE4  = 0x720 */
#define ADDR_ITEMTYPES_EQUIV  0x20003800u /* 60 * 8    = 0x1E0 */
#define ADDR_SKILLS_TXT       0x20004000u /* 6 * 0x23C = 0xD68 */
#define ADDR_QUALITEMS_TXT    0x20005000u /* 4 * 0x20  = 0x80 */
#define ADDR_SETITEMS_TXT     0x20005100u /* 4 * 0x1B8 = 0x6E0 */
#define ADDR_SETS_TXT         0x20005800u /* 4 * 0x128 = 0x4A0 */
#define ADDR_RUNES_TXT        0x20006000u /* 4 * 0x120 = 0x480 */
#define ADDR_MONSTATS_TXT     0x20006800u /* 4 * 0x1A8 = 0x6A0 */
#define ADDR_MONSTATS2_TXT    0x20007000u /* 4 * 0x134 = 0x4D0 */
#define ADDR_ISC_TXT          0x20010000u /* 360 * 0x144 = 0x1C740 */

/* D2Common.dll static globals & IAT slots */
#define VA_GDWBITMASKS_IAT     0x6FDD90B0u
#define VA_SGPT_DATATABLES     0x6FDE9E1Cu
#define VA_ITEMCALC_TBL        0x6FDED354u /* 32B table + 4B count at 0x6FDED374 + 32B gridDef at 0x6FDED378 = 68B */
#define VA_WEAP_CLASS_COUNT    0x6FDEF020u /* 40B: count at 0x6FDEF020, inline table at 0x6FDEF028 */
#define VA_WEAP_CLASS_TBL      0x6FDEF028u
#define VA_ITEMS_TXT_COUNT     0x6FDEFB94u /* 8B: count + ptr */
#define VA_ITEMS_TXT_PTR       0x6FDEFB98u
#define VA_RUNES_TXT_COUNT     0x6FDEFBD4u /* 8B: count + ptr */
#define VA_RUNES_TXT_PTR       0x6FDEFBD8u
#define VA_QUALITEMS_COUNT     0x6FDEFDA0u /* 8B: count + ptr */
#define VA_QUALITEMS_PTR       0x6FDEFDA4u
#define VA_ITEMS_LINKER_PTR    0x6FDEFF6Cu /* 4B */
#define VA_MONSTATS_PTR        0x6FDF0950u /* 12B: ptr at +0, count at +8 */
#define VA_MONSTATS_COUNT      0x6FDF0958u
#define VA_EXPERIENCE_PTR      0x6FDF0B50u /* 4B */

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

static uint32_t __fastcall stub_fog_10046(
  void *pMemPool,
  void *pMem,
  const char *szFile,
  int nLine,
  int nZero
) {
  (void)pMemPool;
  (void)pMem;
  (void)szFile;
  (void)nLine;
  (void)nZero;
  return 1u;
}

/* =========================================================================
 * Calling Convention Wrappers (Zero stack-memory constraints)
 * ========================================================================= */

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

static uint32_t call_fastcall1(uintptr_t fn, uint32_t ecx_in) {
  typedef uint32_t (__fastcall *FnF1)(uint32_t);
  return ((FnF1)fn)(ecx_in);
}

static uint32_t call_fastcall4(
  uintptr_t fn,
  uint32_t ecx_in,
  uint32_t edx_in,
  uint32_t s0,
  uint32_t s1
) {
  typedef uint32_t (__fastcall *FnF4)(uint32_t, uint32_t, uint32_t, uint32_t);
  return ((FnF4)fn)(ecx_in, edx_in, s0, s1);
}

/* 0x6FD78850: ecx=pItem, [esp+4]=pCost0, [esp+8]=pCost1, [esp+0xC]=pCost2, [esp+0x10]=nDivisor, ret 0x10 */
static void call_ecx_stack4_ret16(
  uintptr_t fn,
  uint32_t ecx_in,
  uint32_t s0,
  uint32_t s1,
  uint32_t s2,
  uint32_t s3
) {
  typedef void (__fastcall *FnF5)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
  ((FnF5)fn)(ecx_in, 0u, s0, s1, s2, s3);
}

/* eax=a0 -> eax, plain ret */
static __attribute__((noinline)) uint32_t call_eax_ret(uintptr_t fn, uint32_t eax_in) {
  uint32_t out = eax_in;
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "+a"(out)
    : [fn]"d"(fn)
    : "ebx", "ecx", "esi", "edi", "cc", "memory"
  );
  return out;
}

/* esi=a0 -> eax, plain ret */
static __attribute__((noinline)) uint32_t call_esi_ret(uintptr_t fn, uint32_t esi_in) {
  uint32_t out;
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "=a"(out), "+S"(esi_in)
    : [fn]"d"(fn)
    : "ebx", "ecx", "edi", "cc", "memory"
  );
  return out;
}

/* eax=a0, ecx=a1 -> eax, plain ret */
static __attribute__((noinline)) uint32_t call_eax_ecx_ret(
  uintptr_t fn,
  uint32_t eax_in,
  uint32_t ecx_in
) {
  uint32_t out = eax_in;
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "+a"(out), "+c"(ecx_in)
    : [fn]"d"(fn)
    : "ebx", "esi", "edi", "cc", "memory"
  );
  return out;
}

/* eax=a0, ecx=a1, esi=a2 -> eax, plain ret */
static __attribute__((noinline)) uint32_t call_eax_ecx_esi_ret(
  uintptr_t fn,
  uint32_t eax_in,
  uint32_t ecx_in,
  uint32_t esi_in
) {
  uint32_t out = eax_in;
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "+a"(out), "+c"(ecx_in), "+S"(esi_in)
    : [fn]"d"(fn)
    : "ebx", "edi", "cc", "memory"
  );
  return out;
}

/* eax=a0, ecx=a1, edx=a2 -> eax, plain ret */
static __attribute__((noinline)) uint32_t call_eax_ecx_edx_ret(
  uintptr_t fn,
  uint32_t eax_in,
  uint32_t ecx_in,
  uint32_t edx_in
) {
  uint32_t out = eax_in;
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "+a"(out), "+c"(ecx_in), "+d"(edx_in)
    : [fn]"S"(fn)
    : "ebx", "edi", "cc", "memory"
  );
  return out;
}

/* eax=a0, [esp+4]=s0 -> eax, ret 4 */
static __attribute__((noinline)) uint32_t call_eax_stack1_ret4(
  uintptr_t fn,
  uint32_t eax_in,
  uint32_t s0
) {
  uint32_t out = eax_in;
  __asm__ volatile(
    "pushl %[s0]\n\t"
    "call *%[fn]\n\t"
    : "+a"(out), [s0]"+c"(s0)
    : [fn]"d"(fn)
    : "ebx", "esi", "edi", "cc", "memory"
  );
  return out;
}

/* eax=a0, esi=a1, [esp+4]=s0 -> eax, ret 4 */
static __attribute__((noinline)) uint32_t call_eax_esi_stack1_ret4(
  uintptr_t fn,
  uint32_t eax_in,
  uint32_t esi_in,
  uint32_t s0
) {
  uint32_t out = eax_in;
  __asm__ volatile(
    "pushl %[s0]\n\t"
    "call *%[fn]\n\t"
    : "+a"(out), "+S"(esi_in), [s0]"+c"(s0)
    : [fn]"d"(fn)
    : "ebx", "edi", "cc", "memory"
  );
  return out;
}

/* ebx=a0, [esp+4]=s0, [esp+8]=s1 -> void, ret 8 */
static __attribute__((noinline)) void call_ebx_stack2_ret8(
  uintptr_t fn,
  uint32_t ebx_in,
  uint32_t s0,
  uint32_t s1
) {
  __asm__ volatile(
    "pushl %[s1]\n\t"
    "pushl %[s0]\n\t"
    "call *%[fn]\n\t"
    : "+b"(ebx_in), [s0]"+c"(s0), [s1]"+d"(s1)
    : [fn]"a"(fn)
    : "esi", "edi", "cc", "memory"
  );
}

/* eax=pack[0], [esp+4..0x14]=pack[1..5] -> void, ret 0x14 */
static __attribute__((noinline)) void call_eax_stack5_ret20(
  uintptr_t fn,
  const uint32_t *pack
) {
  uint32_t fn_reg = (uint32_t)fn;
  const uint32_t *p = pack;
  __asm__ volatile(
    "pushl 20(%[p])\n\t"
    "pushl 16(%[p])\n\t"
    "pushl 12(%[p])\n\t"
    "pushl 8(%[p])\n\t"
    "pushl 4(%[p])\n\t"
    "movl 0(%[p]), %%eax\n\t"
    "call *%[fn]\n\t"
    : [fn]"+d"(fn_reg), [p]"+S"(p)
    :
    : "eax", "ebx", "ecx", "edi", "cc", "memory"
  );
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
 * DLL assert capture (k1r3): Fog.#10265 (thunk 0x6FD5921C -> IAT 0x6FDD90D4) receives the assert
 * line as its only stack argument. The safe_* helpers point that IAT slot at stub_fog_assert_line for
 * the duration of one DLL call (restoring it afterwards) and longjmp out on an assert, so the vector
 * records `expectedAssert` instead of the process exiting.
 * ========================================================================= */
static jmp_buf g_assert_jmp;
static volatile int g_in_dll_call = 0;
static volatile uint32_t g_assert_line = 0;

static void __cdecl stub_fog_assert_line(uint32_t line) {
  g_assert_line = line;
  if (g_in_dll_call) {
    g_in_dll_call = 0;
    longjmp(g_assert_jmp, 1);
  }
}

#define SAFE_BODY(call_expr)                                        \
  volatile uint32_t r = 0;                                          \
  int * volatile out = pAsserted;                                   \
  volatile uint32_t savedIat = *(volatile uint32_t *)(uintptr_t)0x6FDD90D4u; \
  w32(0x6FDD90D4u, (uint32_t)(uintptr_t)&stub_fog_assert_line);    \
  g_assert_line = 0;                                                \
  if (setjmp(g_assert_jmp) == 0) {                                  \
    g_in_dll_call = 1;                                              \
    r = (call_expr);                                                \
    g_in_dll_call = 0;                                              \
    *out = 0;                                                       \
  } else {                                                          \
    *out = 1;                                                       \
  }                                                                 \
  w32(0x6FDD90D4u, savedIat);                                       \
  return r

static __attribute__((noinline)) uint32_t safe_stdcall1(uintptr_t fn, uint32_t a0, int *pAsserted) {
  SAFE_BODY(call_stdcall1(fn, a0));
}

static void emit_ndjson_assert(
  FILE *fp, uint32_t va, const char *name, const char *case_id, const uint32_t *args, int n_args,
  const RangeSpec *pre_ranges, int n_pre, uint8_t **pre_bufs, uint32_t line
) {
  fprintf(fp, "{\"va\":\"0x%08X\",\"name\":\"%s\",\"caseId\":\"%s\",\"args\":[", va, name, case_id);
  for (int i = 0; i < n_args; i++) {
    if (i > 0) fputc(',', fp);
    fprintf(fp, "%u", args[i]);
  }
  fprintf(fp, "],\"retMask\":0,\"eax\":0,\"pre\":[");
  for (int i = 0; i < n_pre; i++) {
    if (i > 0) fputc(',', fp);
    fprintf(fp, "{\"addr\":%u,\"hex\":\"", pre_ranges[i].addr);
    write_hex(fp, pre_bufs[i], pre_ranges[i].len);
    fprintf(fp, "\"}");
  }
  fprintf(fp, "],\"expectedAssert\":{\"line\":%u},\"post\":[]}\n", line);
  for (int i = 0; i < n_pre; i++) {
    free(pre_bufs[i]);
  }
}

/* =========================================================================
 * Common Arena Initialization
 * ========================================================================= */

static void set_item_type_equiv_bit(uint32_t row_type, uint32_t match_type) {
  uint32_t word_off = match_type >> 5;
  uint32_t bit = 1u << (match_type & 31u);
  uint32_t addr = ADDR_ITEMTYPES_EQUIV + (row_type * 2u + word_off) * 4u;
  w32(addr, *(uint32_t *)(uintptr_t)addr | bit);
}

static void init_isc_row(uint32_t stat_id, int32_t mult, int32_t add, uint8_t val_shift, uint8_t encode) {
  uint32_t rec = ADDR_ISC_TXT + stat_id * 0x144u;
  w16(rec + 0x00u, (uint16_t)stat_id);
  w32(rec + 0x10u, (uint32_t)mult);
  w32(rec + 0x14u, (uint32_t)add);
  w8(rec + 0x18u, val_shift);
  w8(rec + 0x19u, 8u);   /* nSaveBits */
  w32(rec + 0x1Cu, 0u);  /* dwSaveAdd */
  w8(rec + 0x30u, encode);
}

static void clear_arena(void) {
  memset((void *)(uintptr_t)ARENA_BASE, 0, 0x30000u);
  reset_heap();

  /* 1. Fog.gdwBitMasks[0..31] */
  w32(VA_GDWBITMASKS_IAT, ADDR_BITMASKS);
  for (uint32_t i = 0; i < 32u; i++) {
    w32(ADDR_BITMASKS + i * 4u, 1u << i);
  }

  /* 2. ExperienceTxt */
  w32(VA_EXPERIENCE_PTR, ADDR_EXP_TXT);
  w32(ADDR_EXP_TXT + 0x00u, 99u); /* nMaxLevel = 99 */

  /* 2a. Body grid definition at 0x6FDED378 (nGridX = 13, nGridY = 1) */
  w8(0x6FDED378u, 13u);
  w8(0x6FDED379u, 1u);

  /* 2b. WeapClass lookup table at 0x6FDEF020..0x6FDEF03F */
  w32(VA_WEAP_CLASS_COUNT, 3u);
  w32(VA_WEAP_CLASS_TBL + 0u * 8u, 0x20736831u); w16(VA_WEAP_CLASS_TBL + 0u * 8u + 4u, 2u); /* '1hs ' -> 2 */
  w32(VA_WEAP_CLASS_TBL + 1u * 8u, 0x20776232u); w16(VA_WEAP_CLASS_TBL + 1u * 8u + 4u, 5u); /* '2bw ' -> 5 */
  w32(VA_WEAP_CLASS_TBL + 2u * 8u, 0x20736832u); w16(VA_WEAP_CLASS_TBL + 2u * 8u + 4u, 3u); /* '2hs ' -> 3 */

  /* 3. sgptDataTables */
  w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);
  w32(ADDR_DATATABLES + 0x98u, ADDR_CALC_BUF);       /* pItemsCode */
  w32(ADDR_DATATABLES + 0x9Cu, 64u);                 /* dwItemsCodeSize */
  w32(ADDR_DATATABLES + 0xC4u, 64u);                 /* nStatesTxtRecordCount */
  w32(ADDR_DATATABLES + 0x110u, ADDR_STATE_MASKS);   /* fStateMasks */
  w32(ADDR_DATATABLES + 0xA78u, ADDR_MONSTATS_TXT);  /* pMonStatsTxt */
  w32(ADDR_DATATABLES + 0xA80u, 4u);                 /* nMonStatsTxtRecordCount */
  w32(ADDR_DATATABLES + 0xA90u, ADDR_MONSTATS2_TXT); /* pMonStats2Txt */
  w32(ADDR_DATATABLES + 0xA98u, 4u);                 /* nMonStats2TxtRecordCount */
  w32(ADDR_DATATABLES + 0xB98u, ADDR_SKILLS_TXT);    /* pSkillsTxt */
  w32(ADDR_DATATABLES + 0xBA0u, 6u);                 /* nSkillsTxtRecordCount */
  w32(ADDR_DATATABLES + 0xBCCu, ADDR_ISC_TXT);       /* pItemStatCostTxt */
  w32(ADDR_DATATABLES + 0xBD4u, 360u);               /* nItemStatCostTxtRecordCount */
  w32(ADDR_DATATABLES + 0xBF8u, ADDR_ITEMTYPES_TXT); /* pItemTypesTxt */
  w32(ADDR_DATATABLES + 0xBFCu, 60u);                /* nItemTypesTxtRecordCount */
  w32(ADDR_DATATABLES + 0xC00u, 2u);                 /* nItemTypesEquivDwords */
  w32(ADDR_DATATABLES + 0xC04u, ADDR_ITEMTYPES_EQUIV);
  w32(ADDR_DATATABLES + 0xC0Cu, ADDR_SETS_TXT);      /* pSetsTxt */
  w32(ADDR_DATATABLES + 0xC10u, 4u);                 /* nSetsTxtRecordCount */
  w32(ADDR_DATATABLES + 0xC18u, ADDR_SETITEMS_TXT);  /* pSetItemsTxt */
  w32(ADDR_DATATABLES + 0xC1Cu, 4u);                 /* nSetItemsTxtRecordCount */
  w8(ADDR_DATATABLES + 0xC6Cu, 6u);                  /* nSkillParamShift = 6 */
  w32(ADDR_DATATABLES + 0xC70u, 0x3Fu);              /* dwSkillParamMask = 0x3F */

  /* 4. ItemTypes equivalence matrix: every type 0..59 matches itself */
  for (uint32_t t = 0; t < 60u; t++) {
    set_item_type_equiv_bit(t, t);
  }
  /* Type 1: weapon (0x2D) + socket filler (0x35) + throwable (byte +0x10 = 1) */
  set_item_type_equiv_bit(1u, 0x2Du);
  set_item_type_equiv_bit(1u, 0x35u);
  set_item_type_equiv_bit(1u, 0x2Cu);
  w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x08u, 1u); /* nRepair = 1 */
  w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x09u, 1u); /* nBody = 1 */
  w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x0Au, 4u); /* nBodyLoc1 = 4 */
  w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x0Bu, 5u); /* nBodyLoc2 = 5 */
  w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x10u, 1u); /* bThrowable = 1 */
  w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x11u, 1u);
  w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x16u, 1u); /* bMagic = 1 */

  /* Type 2: armor (0x32) + non-repairable (nRepair = 0) */
  set_item_type_equiv_bit(2u, 0x32u);
  w8(ADDR_ITEMTYPES_TXT + 2u * 0xE4u + 0x08u, 0u);

  /* Type 3: scroll (0x16) */
  set_item_type_equiv_bit(3u, 0x16u);

  /* Type 4: gold (0x04) */
  set_item_type_equiv_bit(4u, 0x04u);

  /* Type 5: book (0x12) */
  set_item_type_equiv_bit(5u, 0x12u);

  /* Type 6: pure weapon (0x2D), non-throwable (+0x10 = 0), repairable (+0x08 = 1) */
  set_item_type_equiv_bit(6u, 0x2Du);
  w8(ADDR_ITEMTYPES_TXT + 6u * 0xE4u + 0x08u, 1u);
  w8(ADDR_ITEMTYPES_TXT + 6u * 0xE4u + 0x09u, 1u);
  w8(ADDR_ITEMTYPES_TXT + 6u * 0xE4u + 0x0Au, 4u);
  w8(ADDR_ITEMTYPES_TXT + 6u * 0xE4u + 0x0Bu, 5u);
  w8(ADDR_ITEMTYPES_TXT + 6u * 0xE4u + 0x10u, 0u);
  w8(ADDR_ITEMTYPES_TXT + 6u * 0xE4u + 0x16u, 1u);

  /* Type 7: pure armor (0x32), not in {0x02, 0x0F, 0x10, 0x13} */
  set_item_type_equiv_bit(7u, 0x32u);

  /* 5. ItemsTxt (8 records * 0x1A8) + Fog.#10213 linker */
  w32(VA_ITEMS_TXT_COUNT, 8u);
  w32(VA_ITEMS_TXT_PTR, ADDR_ITEMS_TXT);
  w32(VA_ITEMS_LINKER_PTR, ADDR_LINK);

  /* Row 0: 'hax ' (0x20786168), wType1=1, wType2=6, uber='9ha ' (row 4), ultra='7ha ' (row 5) */
  {
    uint32_t r0 = ADDR_ITEMS_TXT + 0u * 0x1A8u;
    w32(r0 + 0x80u, 0x20786168u); /* dwCode = 'hax ' */
    w32(r0 + 0x88u, 0x20616839u); /* dwUberCode = '9ha ' */
    w32(r0 + 0x8Cu, 0x20616837u); /* dwUltraCode = '7ha ' */
    w32(r0 + 0xC0u, 0x20736831u); /* dwWClass = '1hs ' */
    w32(r0 + 0xC4u, 0x20736832u); /* dw2HandedWClass = '2hs ' */
    w32(r0 + 0xD4u, 5000u);       /* gamble ring/amu cost */
    w32(r0 + 0xDCu, 1u);          /* dwBitField1 = 1 (throwable/imbueable bit) */
    w32(r0 + 0xE0u, 200u);        /* dwCost */
    w32(r0 + 0xE4u, 10u);         /* dwGambleCost / dwMinStack */
    w32(r0 + 0xE8u, 20u);         /* dwSpeed / dwMaxStack */
    w32(r0 + 0xECu, 0x1234u);     /* dwBitField2 */
    w16(r0 + 0xFAu, 7u);          /* wMissileType = 7 */
    w8(r0 + 0xFDu, 10u);          /* nLevel = 10 */
    w8(r0 + 0x104u, 3u);          /* nQuiverType = 3 */
    w8(r0 + 0x112u, 24u);         /* nDurability = 24 */
    w8(r0 + 0x113u, 0u);          /* bNoDurability = 0 */
    w8(r0 + 0x115u, 5u);          /* nComponent (hand slot) = 5 */
    w8(r0 + 0x11Cu, 2u);          /* nInvWidth = 2 */
    w16(r0 + 0x11Eu, 1u);         /* wType1 = 1 */
    w16(r0 + 0x120u, 6u);         /* wType2 = 6 */
    w8(r0 + 0x12Au, 0u);          /* nComponent / nQuest = 0 */
    w8(r0 + 0x12Bu, 0u);          /* nQuestDiffCheck = 0 */
    w8(r0 + 0x132u, 1u);          /* nTwoHanded = 1 */
    w8(r0 + 0x134u, 5u);          /* nMagicLevel = 5 */
    w8(r0 + 0x137u, 1u);          /* nSubType = 1 (gem socketable) */
    w8(r0 + 0x13Cu, 9u);          /* bQuest / nHitClass = 9 */
    w8(r0 + 0x13Eu, 2u);          /* nGemApplyType = 2 */
  }
  /* Row 1: 'rin ' (0x206E6972), wType1=3 (scroll), dwGambleCost(+0xD4)=50000 */
  {
    uint32_t r1 = ADDR_ITEMS_TXT + 1u * 0x1A8u;
    w32(r1 + 0x80u, 0x206E6972u); /* 'rin ' */
    w32(r1 + 0x88u, 0x20202030u); /* '0   ' */
    w32(r1 + 0x8Cu, 0x20202030u); /* '0   ' */
    w32(r1 + 0xC0u, 0x20776232u); /* '2bw ' */
    w32(r1 + 0xD4u, 50000u);
    w32(r1 + 0xDCu, 0u);          /* dwBitField1 = 0 */
    w32(r1 + 0xE0u, 1000u);
    w32(r1 + 0xE4u, 777u);
    w32(r1 + 0xE8u, 50u);
    w32(r1 + 0xECu, 0x5678u);
    w16(r1 + 0xFAu, 12u);
    w8(r1 + 0xFDu, 50u);
    w8(r1 + 0x104u, 1u);
    w8(r1 + 0x112u, 0u);
    w8(r1 + 0x113u, 1u);          /* bNoDurability = 1 */
    w8(r1 + 0x115u, 6u);          /* nComponent (hand slot) = 6 */
    w8(r1 + 0x11Cu, 1u);          /* nInvWidth = 1 */
    w16(r1 + 0x11Eu, 3u);         /* wType1 = 3 (scroll) */
    w8(r1 + 0x12Au, 1u);          /* nComponent = 1 (>= 1 -> IsScrollOrTome returns 0) */
    w8(r1 + 0x132u, 0u);          /* nTwoHanded = 0 */
    w8(r1 + 0x134u, 9u);
    w8(r1 + 0x137u, 0u);          /* nSubType = 0 */
    w8(r1 + 0x13Cu, 4u);
    w8(r1 + 0x13Eu, 1u);
  }
  /* Row 2: 'amu ' (0x20756D61), wType1=5 (book), dwGambleCost(+0xD4)=63000 */
  {
    uint32_t r2 = ADDR_ITEMS_TXT + 2u * 0x1A8u;
    w32(r2 + 0x80u, 0x20756D61u); /* 'amu ' */
    w32(r2 + 0x88u, 0x20202030u);
    w32(r2 + 0x8Cu, 0x20202030u);
    w32(r2 + 0xD4u, 63000u);
    w32(r2 + 0xDCu, 1u);
    w32(r2 + 0xE0u, 1200u);
    w8(r2 + 0xFDu, 60u);
    w8(r2 + 0x112u, 0u);          /* nDurability = 0, bNoDurability = 0 */
    w8(r2 + 0x113u, 0u);
    w16(r2 + 0x11Eu, 5u);         /* wType1 = 5 (book) */
    w8(r2 + 0x134u, 7u);
  }
  /* Row 3: 'leg ' (0x2067656C), wType1=4 (gold), nQuest=1, nQuestDiffCheck=1 */
  {
    uint32_t r3 = ADDR_ITEMS_TXT + 3u * 0x1A8u;
    w32(r3 + 0x80u, 0x2067656Cu); /* 'leg ' */
    w32(r3 + 0x88u, 0x20202030u);
    w32(r3 + 0x8Cu, 0x20202030u);
    w32(r3 + 0xDCu, 1u);
    w32(r3 + 0xE0u, 100u);
    w8(r3 + 0xFDu, 55u);
    w16(r3 + 0x11Eu, 4u);         /* wType1 = 4 (gold) */
    w8(r3 + 0x12Au, 1u);          /* nQuest = 1 */
    w8(r3 + 0x12Bu, 1u);          /* nQuestDiffCheck = 1 */
    w8(r3 + 0x132u, 0u);          /* nTwoHanded = 0 */
  }
  /* Row 4: '9ha ' (0x20616839), wType1=6 (pure weapon, non-throwable) */
  {
    uint32_t r4 = ADDR_ITEMS_TXT + 4u * 0x1A8u;
    w32(r4 + 0x80u, 0x20616839u);
    w32(r4 + 0x88u, 0x20202030u);
    w32(r4 + 0x8Cu, 0x20202030u);
    w32(r4 + 0xC0u, 0x20736831u);
    w32(r4 + 0xDCu, 1u);          /* dwBitField1 = 1 */
    w32(r4 + 0xE0u, 800u);
    w8(r4 + 0xFDu, 25u);          /* nLevel = 25 */
    w8(r4 + 0x112u, 30u);
    w8(r4 + 0x115u, 5u);
    w8(r4 + 0x11Cu, 2u);
    w16(r4 + 0x11Eu, 6u);         /* wType1 = 6 (pure weapon) */
    w8(r4 + 0x12Au, 0u);
    w8(r4 + 0x132u, 0u);          /* nTwoHanded = 0 */
    w8(r4 + 0x134u, 3u);
    w8(r4 + 0x137u, 1u);
  }
  /* Row 5: '7ha ' (0x20616837), wType1=7 (pure armor) */
  {
    uint32_t r5 = ADDR_ITEMS_TXT + 5u * 0x1A8u;
    w32(r5 + 0x80u, 0x20616837u);
    w32(r5 + 0x88u, 0x20202030u);
    w32(r5 + 0x8Cu, 0x20202030u);
    w32(r5 + 0xDCu, 1u);
    w32(r5 + 0xE0u, 2500u);
    w8(r5 + 0xFDu, 40u);          /* nLevel = 40 */
    w16(r5 + 0x11Eu, 7u);         /* wType1 = 7 (pure armor) */
    w8(r5 + 0x12Au, 1u);          /* nQuest = 1 (with code='leg ' in Row 7 below) */
    w8(r5 + 0x132u, 0u);
  }
  /* Row 6: 'cap ' (0x20706163), wType1=2 (armor, nRepair=0), uber=0, ultra=0 */
  {
    uint32_t r6 = ADDR_ITEMS_TXT + 6u * 0x1A8u;
    w32(r6 + 0x80u, 0x20706163u);
    w32(r6 + 0x88u, 0x20202030u);
    w32(r6 + 0x8Cu, 0x20202030u);
    w32(r6 + 0xDCu, 1u);
    w32(r6 + 0xE0u, 150u);
    w8(r6 + 0xFDu, 50u);          /* nLevel = 50 (> 0x2D) */
    w16(r6 + 0x11Eu, 2u);         /* wType1 = 2 */
    w8(r6 + 0x12Au, 1u);          /* nQuest = 1 (non-'leg ') */
  }
  /* Row 7: 'leg ' quest weapon (wType1=6, dwBitField1=1, nQuest=1, dwCode='leg ') */
  {
    uint32_t r7 = ADDR_ITEMS_TXT + 7u * 0x1A8u;
    w32(r7 + 0x80u, 0x2067656Cu); /* 'leg ' */
    w32(r7 + 0xDCu, 1u);
    w16(r7 + 0x11Eu, 6u);         /* wType1 = 6 */
    w8(r7 + 0x12Au, 1u);          /* nQuest = 1 */
  }

  /* Sorted linker entries in ascending unsigned dwCode order */
  w32(ADDR_LINK + 0x00u, 7u);
  w32(ADDR_LINK + 0x08u, ADDR_LINK_ENTRIES);
  w32(ADDR_LINK_ENTRIES + 0x00u, 0x20616837u); w32(ADDR_LINK_ENTRIES + 0x04u, 5u); /* '7ha ' -> 5 */
  w32(ADDR_LINK_ENTRIES + 0x08u, 0x20616839u); w32(ADDR_LINK_ENTRIES + 0x0Cu, 4u); /* '9ha ' -> 4 */
  w32(ADDR_LINK_ENTRIES + 0x10u, 0x2067656Cu); w32(ADDR_LINK_ENTRIES + 0x14u, 3u); /* 'leg ' -> 3 */
  w32(ADDR_LINK_ENTRIES + 0x18u, 0x206E6972u); w32(ADDR_LINK_ENTRIES + 0x1Cu, 1u); /* 'rin ' -> 1 */
  w32(ADDR_LINK_ENTRIES + 0x20u, 0x20706163u); w32(ADDR_LINK_ENTRIES + 0x24u, 6u); /* 'cap ' -> 6 */
  w32(ADDR_LINK_ENTRIES + 0x28u, 0x20756D61u); w32(ADDR_LINK_ENTRIES + 0x2Cu, 2u); /* 'amu ' -> 2 */
  w32(ADDR_LINK_ENTRIES + 0x30u, 0x20786168u); w32(ADDR_LINK_ENTRIES + 0x34u, 0u); /* 'hax ' -> 0 */

  /* 6. QualityItemsTxt (4 records * 0x20) */
  w32(VA_QUALITEMS_COUNT, 4u);
  w32(VA_QUALITEMS_PTR, ADDR_QUALITEMS_TXT);
  w8(ADDR_QUALITEMS_TXT + 0u * 0x20u + 0x02u, 11u);
  w8(ADDR_QUALITEMS_TXT + 1u * 0x20u + 0x02u, 22u);

  /* 7. SetItemsTxt (4 records * 0x1B8) & SetsTxt (4 records * 0x128) */
  w16(ADDR_SETITEMS_TXT + 0u * 0x1B8u + 0x2Cu, 1u);  /* wSetId = 1 */
  w16(ADDR_SETITEMS_TXT + 0u * 0x1B8u + 0x2Eu, 2u);  /* nSetItemIdx = 2 (bit 2 -> 4) */
  w16(ADDR_SETITEMS_TXT + 1u * 0x1B8u + 0x2Cu, 1u);  /* wSetId = 1 */
  w16(ADDR_SETITEMS_TXT + 1u * 0x1B8u + 0x2Eu, 4u);  /* nSetItemIdx = 4 (bit 4 -> 16) */
  w16(ADDR_SETITEMS_TXT + 2u * 0x1B8u + 0x2Cu, 2u);  /* wSetId = 2 (different set) */
  w16(ADDR_SETITEMS_TXT + 2u * 0x1B8u + 0x2Eu, 1u);

  /* 8. RunesTxt (4 records * 0x120) */
  w32(VA_RUNES_TXT_COUNT, 3u);
  w32(VA_RUNES_TXT_PTR, ADDR_RUNES_TXT);
  /* Row 0: bComplete = 0 (skipped) */
  w8(ADDR_RUNES_TXT + 0u * 0x120u + 0x80u, 0u);
  /* Row 1: bComplete = 1, runes = [1, 4, -1], wEType[0] = 3, wIType[0] = 1 */
  w8(ADDR_RUNES_TXT + 1u * 0x120u + 0x80u, 1u);
  w16(ADDR_RUNES_TXT + 1u * 0x120u + 0x86u, 1u);  /* wIType[0] = 1 */
  w16(ADDR_RUNES_TXT + 1u * 0x120u + 0x92u, 3u);  /* wEType[0] = 3 */
  w32(ADDR_RUNES_TXT + 1u * 0x120u + 0x98u, 1u);  /* dwRunes[0] = 1 */
  w32(ADDR_RUNES_TXT + 1u * 0x120u + 0x9Cu, 4u);  /* dwRunes[1] = 4 */
  w32(ADDR_RUNES_TXT + 1u * 0x120u + 0xA0u, 0xFFFFFFFFu);

  /* 9. MonStatsTxt & MonStats2Txt */
  w32(VA_MONSTATS_PTR, ADDR_MONSTATS_TXT);
  w32(VA_MONSTATS_COUNT, 4u);
  w16(ADDR_MONSTATS_TXT + 1u * 0x1A8u + 0x18u, 2u); /* Row 1 -> wMonStatsEx (+0x18) = 2 */
  w8(ADDR_MONSTATS2_TXT + 2u * 0x134u + 0x14u, 0x2Au); /* Row 2 -> nHitClass = 42 */

  /* 10. SkillsTxt (6 records * 0x23C) */
  for (uint32_t s = 0; s < 6u; s++) {
    uint32_t rec = ADDR_SKILLS_TXT + s * 0x23Cu;
    w16(rec + 0x00u, (uint16_t)s);
    w8(rec + 0x10u, (s == 1u) ? 7u : (s == 2u) ? 18u : 3u); /* nAnim */
    w8(rec + 0x168u, (uint8_t)s);                           /* nWeapSel */
    w32(rec + 0x234u, 128u);                                /* dwCostMult */
    w32(rec + 0x238u, 500u);                                /* dwCostAdd */
  }

  /* 11. Core ItemStatCost rows */
  init_isc_row(0x00u, 100, 50, 0u, 0u);   /* STR */
  init_isc_row(0x02u, 100, 50, 0u, 0u);   /* DEX */
  init_isc_row(0x0Cu, 100, 50, 0u, 0u);   /* LEVEL */
  init_isc_row(0x0Eu, 1, 0, 0u, 0u);      /* GOLD */
  init_isc_row(0x13u, 10, 20, 0u, 0u);    /* TOHIT */
  init_isc_row(0x15u, 10, 0, 0u, 0u);     /* MINDMG */
  init_isc_row(0x16u, 10, 0, 0u, 0u);     /* MAXDMG */
  init_isc_row(0x17u, 10, 0, 0u, 0u);     /* SEC_MINDMG */
  init_isc_row(0x18u, 10, 0, 0u, 0u);     /* SEC_MAXDMG */
  init_isc_row(0x49u, 10, 0, 0u, 0u);     /* MAXDURABILITY */
  init_isc_row(0x98u, 10, 0, 0u, 0u);     /* INDESTRUCTIBLE */
  init_isc_row(0x9Fu, 10, 0, 0u, 0u);     /* THROW_MINDMG */
  init_isc_row(0xA0u, 10, 0, 0u, 0u);     /* THROW_MAXDMG */
  init_isc_row(0xC2u, 10, 0, 0u, 0u);     /* NUMSOCKETS */
  init_isc_row(0xCCu, 64, 100, 0u, 2u);   /* CHARGED_SKILL (bEncode=2) */
  init_isc_row(0xFEu, 10, 0, 0u, 0u);     /* EXTRA_STACK */
  init_isc_row(0x149u, 10, 0, 0u, 0u);    /* FIRE_MASTERY */
  init_isc_row(0x14Au, 10, 0, 0u, 0u);    /* LTNG_MASTERY */
  init_isc_row(0x14Bu, 10, 0, 0u, 0u);    /* COLD_MASTERY */
  init_isc_row(0x14Cu, 10, 0, 0u, 0u);    /* POIS_MASTERY */
  init_isc_row(0x164u, 10, 0, 0u, 0u);    /* QUEST_DIFFICULTY */
  init_isc_row(0x6Bu, 80, 200, 0u, 1u);   /* SINGLE_SKILL (bEncode=1) */
  init_isc_row(0xC3u, 80, 200, 0u, 3u);   /* SKILL_ON_ATTACK (bEncode=3) */
  init_isc_row(0xD8u, 90, 300, 1u, 4u);   /* HP_PERLEVEL (bEncode=4, shift=1) */
}

/* Helper to set up a unit's D2StatListExStrc with sorted base & full stat arrays */
static void setup_unit_stats(
  uint32_t unit_addr,
  uint32_t sl_addr,
  uint32_t base_arr_addr,
  const uint32_t *base_keys,
  const int32_t *base_vals,
  int n_base,
  uint32_t full_arr_addr,
  const uint32_t *full_keys,
  const int32_t *full_vals,
  int n_full
) {
  w32(unit_addr + 0x5Cu, sl_addr);
  w32(sl_addr + 0x10u, 0x80000000u); /* STATLIST_EXTENDED */
  w32(sl_addr + 0x44u, unit_addr);   /* pOwner */
  w32(sl_addr + 0x24u, base_arr_addr);
  w16(sl_addr + 0x28u, (uint16_t)n_base);
  w16(sl_addr + 0x2Au, (uint16_t)n_base);
  for (int i = 0; i < n_base; i++) {
    w32(base_arr_addr + (uint32_t)i * 8u, base_keys[i]);
    w32(base_arr_addr + (uint32_t)i * 8u + 4u, (uint32_t)base_vals[i]);
  }
  w32(sl_addr + 0x48u, full_arr_addr);
  w16(sl_addr + 0x4Cu, (uint16_t)n_full);
  w16(sl_addr + 0x4Eu, (uint16_t)n_full);
  for (int i = 0; i < n_full; i++) {
    w32(full_arr_addr + (uint32_t)i * 8u, full_keys[i]);
    w32(full_arr_addr + (uint32_t)i * 8u + 4u, (uint32_t)full_vals[i]);
  }
}

/* Standard RangeSpec list for item/skill/stat functions */
static int build_std_ranges(RangeSpec *out, const uint32_t *isc_ids, int n_isc, uint32_t extra_addr, uint32_t extra_len) {
  int k = 0;
  out[k++] = (RangeSpec){ VA_GDWBITMASKS_IAT, 4u };
  out[k++] = (RangeSpec){ VA_SGPT_DATATABLES, 4u };
  out[k++] = (RangeSpec){ VA_ITEMCALC_TBL, 68u };
  out[k++] = (RangeSpec){ VA_WEAP_CLASS_COUNT, 40u };
  out[k++] = (RangeSpec){ VA_ITEMS_TXT_COUNT, 8u };
  out[k++] = (RangeSpec){ VA_RUNES_TXT_COUNT, 8u };
  out[k++] = (RangeSpec){ VA_QUALITEMS_COUNT, 8u };
  out[k++] = (RangeSpec){ VA_ITEMS_LINKER_PTR, 4u };
  out[k++] = (RangeSpec){ VA_MONSTATS_PTR, 12u };
  out[k++] = (RangeSpec){ VA_EXPERIENCE_PTR, 4u };
  out[k++] = (RangeSpec){ ADDR_UNIT, 0xD10u }; /* 0x20000100..0x20000E10: all units, invs, statlists, skills, scratch */
  out[k++] = (RangeSpec){ ADDR_DATATABLES + 0x98u, 8u };
  out[k++] = (RangeSpec){ ADDR_DATATABLES + 0xC4u, 4u };
  out[k++] = (RangeSpec){ ADDR_DATATABLES + 0x110u, 4u };
  out[k++] = (RangeSpec){ ADDR_DATATABLES + 0xA78u, 36u };
  out[k++] = (RangeSpec){ ADDR_DATATABLES + 0xB98u, 0xE0u };
  out[k++] = (RangeSpec){ ADDR_ITEMS_TXT, 8u * 0x1A8u };
  out[k++] = (RangeSpec){ ADDR_ITEMTYPES_TXT, 8u * 0xE4u };
  out[k++] = (RangeSpec){ ADDR_ITEMTYPES_EQUIV, 60u * 8u };
  out[k++] = (RangeSpec){ ADDR_SKILLS_TXT, 6u * 0x23Cu };
  for (int i = 0; i < n_isc; i++) {
    out[k++] = (RangeSpec){ ADDR_ISC_TXT + isc_ids[i] * 0x144u, 0x34u };
  }
  if (extra_len > 0u) {
    out[k++] = (RangeSpec){ extra_addr, extra_len };
  }
  return k;
}

#define TBL_ITEMS  (1u << 0)
#define TBL_TYPES  (1u << 1)
#define TBL_SKILLS (1u << 2)
#define TBL_QUAL   (1u << 3)
#define TBL_SET    (1u << 4)
#define TBL_RUNES  (1u << 5)
#define TBL_MON    (1u << 6)
#define TBL_HEAP   (1u << 7)

static int build_ranges(
  RangeSpec *out,
  uint32_t tbl_flags,
  const uint32_t *isc_ids,
  int n_isc
) {
  int k = 0;
  out[k++] = (RangeSpec){ VA_GDWBITMASKS_IAT, 4u };
  out[k++] = (RangeSpec){ VA_SGPT_DATATABLES, 4u };
  out[k++] = (RangeSpec){ VA_ITEMCALC_TBL, 68u };
  out[k++] = (RangeSpec){ VA_WEAP_CLASS_COUNT, 40u };
  out[k++] = (RangeSpec){ VA_ITEMS_TXT_COUNT, 8u };
  out[k++] = (RangeSpec){ VA_RUNES_TXT_COUNT, 8u };
  out[k++] = (RangeSpec){ VA_QUALITEMS_COUNT, 8u };
  out[k++] = (RangeSpec){ VA_ITEMS_LINKER_PTR, 4u };
  out[k++] = (RangeSpec){ VA_MONSTATS_PTR, 12u };
  out[k++] = (RangeSpec){ VA_EXPERIENCE_PTR, 4u };
  out[k++] = (RangeSpec){ ADDR_UNIT, 0xD10u };
  out[k++] = (RangeSpec){ ADDR_DATATABLES + 0x98u, 8u };
  out[k++] = (RangeSpec){ ADDR_DATATABLES + 0xC4u, 4u };
  out[k++] = (RangeSpec){ ADDR_DATATABLES + 0x110u, 4u };
  out[k++] = (RangeSpec){ ADDR_DATATABLES + 0xA78u, 36u };
  out[k++] = (RangeSpec){ ADDR_DATATABLES + 0xB98u, 0xE0u };
  if (tbl_flags & TBL_ITEMS) {
    out[k++] = (RangeSpec){ ADDR_ITEMS_TXT, 8u * 0x1A8u };
  }
  if (tbl_flags & TBL_TYPES) {
    out[k++] = (RangeSpec){ ADDR_ITEMTYPES_TXT, 8u * 0xE4u };
    out[k++] = (RangeSpec){ ADDR_ITEMTYPES_EQUIV, 60u * 8u };
  }
  if (tbl_flags & TBL_SKILLS) {
    out[k++] = (RangeSpec){ ADDR_SKILLS_TXT, 6u * 0x23Cu };
  }
  if (tbl_flags & TBL_QUAL) {
    out[k++] = (RangeSpec){ ADDR_QUALITEMS_TXT, 4u * 0x20u };
  }
  if (tbl_flags & TBL_SET) {
    out[k++] = (RangeSpec){ ADDR_SETITEMS_TXT, 4u * 0x1B8u };
    out[k++] = (RangeSpec){ ADDR_SETS_TXT, 4u * 0x128u };
  }
  if (tbl_flags & TBL_RUNES) {
    out[k++] = (RangeSpec){ ADDR_RUNES_TXT, 4u * 0x120u };
  }
  if (tbl_flags & TBL_MON) {
    out[k++] = (RangeSpec){ ADDR_MONSTATS_TXT, 4u * 0x1A8u };
    out[k++] = (RangeSpec){ ADDR_MONSTATS2_TXT, 4u * 0x134u };
  }
  if (tbl_flags & TBL_HEAP) {
    out[k++] = (RangeSpec){ HEAP_BASE, 0x80u };
  }
  for (int i = 0; i < n_isc; i++) {
    out[k++] = (RangeSpec){ ADDR_ISC_TXT + isc_ids[i] * 0x144u, 0x34u };
  }
  return k;
}

/* =========================================================================
 * Batch B039 Vector Emission (10 Functions)
 * ========================================================================= */

static void emit_b039(FILE *fp) {
  RangeSpec pre[40];
  uint8_t *pre_bufs[40];
  RangeSpec post_empty[1] = { { ADDR_UNIT, 0u } };
  (void)build_std_ranges;

  /* 1. 0x6FD72F20 ITEMS_GetQuiverType (stdcall pItem -> u8, retMask 0xFF) */
  {
    const uint32_t va = 0x6FD72F20u;
    const char *nm = "ITEMS_GetQuiverType";
    uint32_t unit_types[3] = { 0u, 1u, 4u };
    uint32_t ptrs[3] = { 0u, ADDR_UNIT, ADDR_UNIT };
    const char *ids[3] = { "null_returns_0", "non_item_returns_0", "valid_item_returns_quiver_3" };
    for (int i = 0; i < 3; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, unit_types[i]);
      w32(ADDR_UNIT + 0x04u, 0u);
      int n = build_ranges(pre, TBL_ITEMS, NULL, 0);
      uint32_t args[1] = { ptrs[i] };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 2. 0x6FD72F50 ITEMS_GetMissileType (stdcall pItem -> i32) */
  {
    const uint32_t va = 0x6FD72F50u;
    const char *nm = "ITEMS_GetMissileType";
    uint32_t unit_types[3] = { 0u, 1u, 4u };
    uint32_t ptrs[3] = { 0u, ADDR_UNIT, ADDR_UNIT };
    const char *ids[3] = { "null_returns_minus1", "non_item_returns_minus1", "valid_item_returns_7" };
    for (int i = 0; i < 3; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, unit_types[i]);
      w32(ADDR_UNIT + 0x04u, 0u);
      int n = build_ranges(pre, TBL_ITEMS, NULL, 0);
      uint32_t args[1] = { ptrs[i] };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 3. 0x6FD73330 ITEMS_GetWeaponClassCode (stdcall pItem -> u32) */
  {
    const uint32_t va = 0x6FD73330u;
    const char *nm = "ITEMS_GetWeaponClassCode";
    struct {
      const char *id;
      uint32_t ptr;
      uint32_t utype;
      uint32_t cid;
    } cases[] = {
      { "null_returns_0", 0u, 4u, 0u },
      { "non_item_returns_0", ADDR_UNIT, 1u, 0u },
      { "out_of_range_cid_returns_0", ADDR_UNIT, 4u, 99u },
      { "valid_item_returns_1hs", ADDR_UNIT, 4u, 0u }
    };
    for (int i = 0; i < 4; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, cases[i].utype);
      w32(ADDR_UNIT + 0x04u, cases[i].cid);
      int n = build_ranges(pre, TBL_ITEMS, NULL, 0);
      uint32_t args[1] = { cases[i].ptr };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 1, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 4. 0x6FD745C0 ITEMS_CheckIfSocketFiller (stdcall pItem -> BOOL) */
  {
    const uint32_t va = 0x6FD745C0u;
    const char *nm = "ITEMS_CheckIfSocketFiller";
    struct {
      const char *id;
      uint32_t ptr;
      uint32_t cid;
    } cases[] = {
      { "null_returns_0", 0u, 0u },
      { "socket_filler_type1_returns_1", ADDR_UNIT, 0u },
      { "non_filler_type3_returns_0", ADDR_UNIT, 1u },
      /* k1r3: 0x6FD74430 falls back to wType[1] (+0x120) and returns the raw row&mask dword */
      { "wtype1_row1_has_0x35_returns_raw_mask", ADDR_UNIT, 1u },
      /* k1r3: classId >= nItemsTxtRecordCount -> 0x6FD730A0 asserts 0x68E */
      { "classid_out_of_range_asserts_68e", ADDR_UNIT, 8u }
    };
    for (int i = 0; i < 5; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 4u);
      w32(ADDR_UNIT + 0x04u, cases[i].cid);
      if (i == 3) w16(ADDR_ITEMS_TXT + 1u * 0x1A8u + 0x120u, 1u);
      int n = build_ranges(pre, TBL_ITEMS | TBL_TYPES, NULL, 0);
      uint32_t args[1] = { cases[i].ptr };
      capture_pre(pre, n, pre_bufs);
      int asserted = 0;
      uint32_t eax = safe_stdcall1(va, args[0], &asserted);
      if (asserted) {
        emit_ndjson_assert(fp, va, nm, cases[i].id, args, 1, pre, n, pre_bufs, g_assert_line);
      } else {
        emit_ndjson_line(fp, va, nm, cases[i].id, args, 1, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
      }
    }
  }

  /* 5. 0x6FD81B90 ITEMS_GetActiveWeaponForAttack (stdcall pUnit, bCheckSkill -> pItem) */
  {
    const uint32_t va = 0x6FD81B90u;
    const char *nm = "ITEMS_GetActiveWeaponForAttack";
    struct {
      const char *id;
      uint32_t has_inv;
      uint32_t class_id;
      uint32_t weap_sel;
      uint32_t flags2;
      uint32_t seq_frame;
      uint32_t check_skill;
      uint32_t skill_flags;
      uint32_t slot6_cmd_flags;
    } cases[] = {
      { "no_inventory_returns_0", 0u, 4u, 0u, 0u, 0u, 0u, 0u, 0u },
      { "non_dual_wield_sorc_returns_active", 1u, 1u, 1u, 0u, 0u, 0u, 0u, 0u },
      { "barb_weapsel_1_returns_slot6", 1u, 4u, 1u, 0u, 0u, 0u, 0u, 0u },
      { "barb_weapsel_1_broken_slot6_falls_back_to_slot5", 1u, 4u, 1u, 0u, 0u, 0u, 0u, 0x100u },
      { "barb_weapsel_2_no_flag2000_returns_slot5", 1u, 4u, 2u, 0u, 0u, 0u, 0u, 0u },
      { "barb_weapsel_2_with_flag2000_returns_slot6", 1u, 4u, 2u, 0u, 0u, 0u, 0x2000u, 0u },
      { "barb_weapsel_3_seq0_returns_slot5", 1u, 4u, 3u, 0u, 0u, 1u, 0u, 0u },
      { "barb_weapsel_3_flag26_odd_frame_returns_slot6", 1u, 4u, 3u, (1u << 26), (3u << 8), 1u, 0u, 0u },
      { "barb_weapsel_3_no_flag26_frame6_returns_slot6", 1u, 4u, 3u, 0u, (6u << 8), 1u, 0u, 0u },
      { "barb_weapsel_3_no_flag26_frame5_check1_returns_slot5", 1u, 4u, 3u, 0u, (5u << 8), 1u, 0u, 0u },
      { "barb_weapsel_3_no_flag26_frame2_check1_returns_slot5", 1u, 4u, 3u, 0u, (2u << 8), 1u, 0u, 0u },
      { "barb_weapsel_4_returns_0", 1u, 4u, 4u, 0u, 0u, 0u, 0u, 0u },
      { "barb_weapsel_0_default_returns_slot5", 1u, 4u, 0u, 0u, 0u, 0u, 0u, 0u }
    };
    for (int i = 0; i < 13; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 0u); /* UNIT_PLAYER */
      w32(ADDR_UNIT + 0x04u, cases[i].class_id);
      w32(ADDR_UNIT + 0x38u, cases[i].seq_frame);
      w32(ADDR_UNIT + 0xC8u, cases[i].flags2);
      if (cases[i].has_inv) {
        w32(ADDR_UNIT + 0x60u, ADDR_INV1);
        w32(ADDR_INV1 + 0x00u, 0x01020304u);
        w32(ADDR_INV1 + 0x14u, ADDR_GRID_ARR);
        w32(ADDR_INV1 + 0x18u, 1u);
        w32(ADDR_INV1 + 0x1Cu, 101u); /* dwLeftItemGuid = 101 (ADDR_UNIT2) */
        w8(ADDR_GRID_ARR + 0x08u, 13u);
        w8(ADDR_GRID_ARR + 0x09u, 1u);
        w32(ADDR_GRID_ARR + 0x0Cu, ADDR_GRID_ITEMS);
        /* Slot 4 (RARM): ADDR_UNIT2 (row 0, '1hs ' -> wClassIdx=2, guid=101) */
        w32(ADDR_GRID_ITEMS + 0x10u, ADDR_UNIT2);
        w32(ADDR_UNIT2 + 0x00u, 4u);
        w32(ADDR_UNIT2 + 0x04u, 0u);
        w32(ADDR_UNIT2 + 0x0Cu, 101u);
        w32(ADDR_UNIT2 + 0x14u, ADDR_ITEMDATA2);
        w8(ADDR_ITEMDATA2 + 0x44u, 4u);
        /* Slot 5 (LARM): ADDR_UNIT3 (row 0, '1hs ' -> wClassIdx=2, guid=102) */
        w32(ADDR_GRID_ITEMS + 0x14u, ADDR_UNIT3);
        w32(ADDR_UNIT3 + 0x00u, 4u);
        w32(ADDR_UNIT3 + 0x04u, 0u);
        w32(ADDR_UNIT3 + 0x0Cu, 102u);
        w32(ADDR_UNIT3 + 0x14u, ADDR_ITEMDATA3);
        w32(ADDR_ITEMDATA3 + 0x18u, cases[i].slot6_cmd_flags);
        w8(ADDR_ITEMDATA3 + 0x44u, 5u);
      }
      w32(ADDR_UNIT + 0xA8u, ADDR_SKILL_LIST);
      w32(ADDR_SKILL_LIST + 0x10u, ADDR_SKILL0);
      w32(ADDR_SKILL0 + 0x00u, ADDR_SKILLS_TXT + cases[i].weap_sel * 0x23Cu);
      w32(ADDR_SKILL0 + 0x0Cu, cases[i].skill_flags);
      w32(ADDR_SKILL0 + 0x3Cu, cases[i].skill_flags);
      int n = build_ranges(pre, TBL_ITEMS | TBL_TYPES | TBL_SKILLS, NULL, 0);
      uint32_t args[2] = { ADDR_UNIT, cases[i].check_skill };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall2(va, args[0], args[1]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 2, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 6. 0x6FD83F40 STATES_CheckUnitAnyActiveStateMask (stdcall pUnit -> BOOL) */
  {
    const uint32_t va = 0x6FD83F40u;
    const char *nm = "STATES_CheckUnitAnyActiveStateMask";
    struct {
      const char *id;
      uint32_t ptr;
      uint32_t has_sl;
      uint32_t sl_flags;
      uint32_t state_word;
      uint32_t mask_word;
      uint32_t oob_word;
    } cases[] = {
      { "null_unit_returns_0", 0u, 0u, 0u, 0u, 0u, 0u },
      { "no_statlist_returns_0", ADDR_UNIT, 0u, 0u, 0u, 0u, 0u },
      { "non_extended_statlist_returns_0", ADDR_UNIT, 1u, 0u, 1u, 1u, 0u },
      { "no_matching_state_bit_returns_0", ADDR_UNIT, 1u, 0x80000000u, 2u, 1u, 0u },
      { "oob_dword_index_2_ignored_returns_0", ADDR_UNIT, 1u, 0x80000000u, 0u, 0u, 1u },
      { "matching_state_bit_returns_1", ADDR_UNIT, 1u, 0x80000000u, 3u, 2u, 0u }
    };
    for (int i = 0; i < 6; i++) {
      clear_arena();
      if (cases[i].has_sl) {
        w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
        w32(ADDR_STATLIST1 + 0x10u, cases[i].sl_flags);
        w32(ADDR_STATLIST1 + 0x58u, ADDR_STATE_FLAGS);
        w32(ADDR_STATE_FLAGS + 0x04u, cases[i].state_word);
        w32(ADDR_STATE_MASKS + 0x04u, cases[i].mask_word);
        w32(ADDR_STATE_FLAGS + 0x08u, cases[i].oob_word);
        w32(ADDR_STATE_MASKS + 0x08u, cases[i].oob_word);
      }
      int n = build_ranges(pre, 0u, NULL, 0);
      uint32_t args[1] = { cases[i].ptr };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 1, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 7. 0x6FD9EBF0 SKILLS_GetWeaponFromArmSlot (eax=nArmCode, ecx=pInventory -> pItem) */
  {
    const uint32_t va = 0x6FD9EBF0u;
    const char *nm = "SKILLS_GetWeaponFromArmSlot";
    struct {
      const char *id;
      uint32_t arm;
      uint32_t inv;
    } cases[] = {
      { "arm5_null_inv_returns_0", 5u, 0u },
      { "arm6_null_inv_returns_0", 6u, 0u },
      { "arm5_returns_rarm_slot4", 5u, ADDR_INV1 },
      { "arm6_returns_larm_slot5", 6u, ADDR_INV1 }
    };
    for (int i = 0; i < 4; i++) {
      clear_arena();
      w32(ADDR_INV1 + 0x00u, 0x01020304u);
      w32(ADDR_INV1 + 0x14u, ADDR_GRID_ARR);
      w32(ADDR_INV1 + 0x18u, 1u);
      w8(ADDR_GRID_ARR + 0x08u, 13u);
      w8(ADDR_GRID_ARR + 0x09u, 1u);
      w32(ADDR_GRID_ARR + 0x0Cu, ADDR_GRID_ITEMS);
      w32(ADDR_GRID_ITEMS + 0x10u, ADDR_UNIT2);
      w32(ADDR_GRID_ITEMS + 0x14u, ADDR_UNIT3);
      int n = build_ranges(pre, 0u, NULL, 0);
      uint32_t args[2] = { cases[i].arm, cases[i].inv };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_eax_ecx_ret(va, args[0], args[1]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 2, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 8. 0x6FD9F870 SKILLS_ApplyElementalMasteryBonus (eax=pUnit, ecx=nElemType, esi=nDamage -> i32) */
  {
    const uint32_t va = 0x6FD9F870u;
    const char *nm = "SKILLS_ApplyElementalMasteryBonus";
    uint32_t isc_ids[4] = { 0x149u, 0x14Au, 0x14Bu, 0x14Cu };
    uint32_t fkeys[4] = { 0x149u << 16, 0x14Au << 16, 0x14Bu << 16, 0x14Cu << 16 };
    int32_t fvals[4] = { 50, 75, 40, 25 };
    struct {
      const char *id;
      uint32_t unit;
      uint32_t elem;
      uint32_t dmg;
      uint32_t has_sl;
      uint32_t isc_cnt;
    } cases[] = {
      { "elem0_default_returns_0", ADDR_UNIT, 0u, 200u, 1u, 360u },
      { "elem1_fire_50pct_of_200_returns_100", ADDR_UNIT, 1u, 200u, 1u, 360u },
      { "elem2_ltng_75pct_of_200_returns_150", ADDR_UNIT, 2u, 200u, 1u, 360u },
      { "elem3_magic_default_returns_0", ADDR_UNIT, 3u, 200u, 1u, 360u },
      { "elem4_cold_40pct_of_200_returns_80", ADDR_UNIT, 4u, 200u, 1u, 360u },
      { "elem5_pois_25pct_of_200_returns_50", ADDR_UNIT, 5u, 200u, 1u, 360u },
      { "elem12_freeze_40pct_of_200_returns_80", ADDR_UNIT, 12u, 200u, 1u, 360u },
      { "elem1_null_unit_returns_0", 0u, 1u, 200u, 1u, 360u },
      { "elem1_no_statlist_returns_0", ADDR_UNIT, 1u, 200u, 0u, 360u },
      { "elem1_isc_count_0x14b_returns_100", ADDR_UNIT, 1u, 200u, 1u, 0x14Bu }
    };
    for (int i = 0; i < 10; i++) {
      clear_arena();
      w32(ADDR_DATATABLES + 0xBD4u, cases[i].isc_cnt);
      if (cases[i].has_sl) {
        setup_unit_stats(ADDR_UNIT, ADDR_STATLIST1, ADDR_STAT_ARR1, fkeys, fvals, 4, ADDR_STAT_ARR2, fkeys, fvals, 4);
      }
      int n = build_ranges(pre, 0u, isc_ids, 4);
      uint32_t args[3] = { cases[i].unit, cases[i].elem, cases[i].dmg };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_eax_ecx_esi_ret(va, args[0], args[1], args[2]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 3, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 9. 0x6FD9F930 SKILLS_GetBasePhysDamageMinOrMax (eax=pUnit, [esp+4]=bIsMin -> i32) */
  {
    const uint32_t va = 0x6FD9F930u;
    const char *nm = "SKILLS_GetBasePhysDamageMinOrMax";
    uint32_t isc_ids[3] = { 0x00u, 0x02u, 0x0Cu };
    struct {
      const char *id;
      uint32_t unit;
      uint32_t utype;
      int32_t str_val;
      int32_t dex_val;
      int32_t lvl_val;
      uint32_t is_min;
      uint32_t has_sl;
      uint32_t isc_cnt;
    } cases[] = {
      { "null_unit_min_clamped_to_1_div4", 0u, 0u, 0, 0, 0, 1u, 1u, 360u },
      { "null_unit_max_clamped_to_1_div3", 0u, 0u, 0, 0, 0, 0u, 1u, 360u },
      { "player_no_statlist_returns_0", ADDR_UNIT, 0u, 40, 30, 1, 1u, 0u, 360u },
      { "player_isc_count_2_skips_dex_min", ADDR_UNIT, 0u, 40, 40, 1, 1u, 1u, 2u },
      { "player_low_stats_clamped_min", ADDR_UNIT, 0u, 5, 5, 1, 1u, 1u, 360u },
      { "player_high_stats_min", ADDR_UNIT, 0u, 40, 30, 1, 1u, 1u, 360u },
      { "player_high_stats_max", ADDR_UNIT, 0u, 40, 30, 1, 0u, 1u, 360u },
      { "monster_lvl10_min", ADDR_UNIT, 1u, 0, 0, 10, 1u, 1u, 360u },
      { "monster_lvl10_max", ADDR_UNIT, 1u, 0, 0, 10, 0u, 1u, 360u }
    };
    for (int i = 0; i < 9; i++) {
      clear_arena();
      w32(ADDR_DATATABLES + 0xBD4u, cases[i].isc_cnt);
      w32(ADDR_UNIT + 0x00u, cases[i].utype);
      if (cases[i].has_sl) {
        uint32_t fkeys[3] = { 0x00u << 16, 0x02u << 16, 0x0Cu << 16 };
        int32_t fvals[3] = { cases[i].str_val, cases[i].dex_val, cases[i].lvl_val };
        setup_unit_stats(ADDR_UNIT, ADDR_STATLIST1, ADDR_STAT_ARR1, fkeys, fvals, 3, ADDR_STAT_ARR2, fkeys, fvals, 3);
      }
      int n = build_ranges(pre, 0u, isc_ids, 3);
      uint32_t args[2] = { cases[i].unit, cases[i].is_min };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_eax_stack1_ret4(va, args[0], args[1]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 2, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 10. 0x6FDA0870 SKILLS_CheckItemChargedSkillHasCharges (ecx=pUnit, eax=pSkill -> BOOL) */
  {
    const uint32_t va = 0x6FDA0870u;
    const char *nm = "SKILLS_CheckItemChargedSkillHasCharges";
    uint32_t isc_ids[1] = { 0xCCu };
    struct {
      const char *id;
      uint32_t unit;
      uint32_t skill;
      uint32_t has_inv;
      uint32_t owner_guid;
      int32_t charges_val;
    } cases[] = {
      { "null_unit_returns_0", 0u, ADDR_SKILL0, 0u, 0u, 0 },
      { "null_skill_returns_0", ADDR_UNIT, 0u, 0u, 0u, 0 },
      { "no_inventory_returns_1", ADDR_UNIT, ADDR_SKILL0, 0u, 55u, 0 },
      { "owner_guid_minus1_returns_1", ADDR_UNIT, ADDR_SKILL0, 1u, 0xFFFFFFFFu, 0 },
      { "matching_item_positive_charges_returns_1", ADDR_UNIT, ADDR_SKILL0, 1u, 202u, 0x0A05 },
      { "matching_item_zero_charges_returns_0", ADDR_UNIT, ADDR_SKILL0, 1u, 202u, 0x0A00 },
      { "non_matching_item_chain_returns_1", ADDR_UNIT, ADDR_SKILL0, 1u, 999u, 0 }
    };
    for (int i = 0; i < 7; i++) {
      clear_arena();
      w32(ADDR_SKILL0 + 0x00u, ADDR_SKILLS_TXT + 1u * 0x23Cu); /* wSkillId = 1 */
      w32(ADDR_SKILL0 + 0x28u, 3u);                            /* nSkillLevel = 3 -> wLayer = (1<<6)|3 = 67 */
      w32(ADDR_SKILL0 + 0x34u, cases[i].owner_guid);
      if (cases[i].has_inv) {
        w32(ADDR_UNIT + 0x60u, ADDR_INV1);
        w32(ADDR_INV1 + 0x00u, 0x01020304u);
        w32(ADDR_INV1 + 0x0Cu, ADDR_UNIT2);
        w32(ADDR_UNIT2 + 0x00u, 4u);
        w32(ADDR_UNIT2 + 0x0Cu, 101u);
        w32(ADDR_UNIT2 + 0x14u, ADDR_ITEMDATA2);
        w32(ADDR_ITEMDATA2 + 0x64u, ADDR_UNIT3);
        w32(ADDR_UNIT3 + 0x00u, 4u);
        w32(ADDR_UNIT3 + 0x0Cu, 202u);
        w32(ADDR_UNIT3 + 0x14u, ADDR_ITEMDATA3);
        uint32_t fkeys[1] = { (0xCCu << 16) | 67u };
        int32_t fvals[1] = { cases[i].charges_val };
        setup_unit_stats(ADDR_UNIT3, ADDR_STATLIST2, ADDR_STAT_ARR1, fkeys, fvals, 1, ADDR_STAT_ARR2, fkeys, fvals, 1);
      }
      int n = build_ranges(pre, TBL_SKILLS, isc_ids, 1);
      uint32_t args[2] = { cases[i].unit, cases[i].skill };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_eax_ecx_ret(va, args[1], args[0]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 2, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }
}

/* =========================================================================
 * Batch B049 Vector Emission (16 Functions)
 * ========================================================================= */

static void emit_b049(FILE *fp) {
  RangeSpec pre[40];
  uint8_t *pre_bufs[40];
  RangeSpec post_empty[1] = { { ADDR_UNIT, 0u } };

  /* 1. 0x6FD730F0 ITEMS_GetItemTypeFromItem (stdcall pItem -> i32) */
  {
    const uint32_t va = 0x6FD730F0u;
    const char *nm = "ITEMS_GetItemTypeFromItem";
    uint32_t utypes[2] = { 1u, 4u };
    const char *ids[2] = { "non_item_returns_0", "valid_item_returns_wtype1" };
    for (int i = 0; i < 2; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, utypes[i]);
      w32(ADDR_UNIT + 0x04u, 0u);
      int n = build_ranges(pre, TBL_ITEMS, NULL, 0);
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 2. 0x6FD73CE0 ITEMS_EvalItemCalc (stdcall pItem, pOwner, dwCalcOffset -> i32) */
  {
    const uint32_t va = 0x6FD73CE0u;
    const char *nm = "ITEMS_EvalItemCalc";
    struct {
      const char *id;
      uint32_t offset;
      uint32_t code_buf;
      uint32_t code_size;
      uint8_t code[16];
      uint32_t code_len;
    } cases[] = {
      { "null_code_buf_returns_0", 0u, 0u, 64u, { 7, 10, 0 }, 3u },
      { "offset_equal_codesize_16_returns_0", 16u, ADDR_CALC_BUF, 16u, { 7, 42, 0 }, 3u },
      { "offset_out_of_range_returns_0", 100u, ADDR_CALC_BUF, 64u, { 0 }, 0u },
      /* 7, 10, 7, 20, 16 (+), 0 -> 30 */
      { "postfix_add_10_plus_20_returns_30", 0u, ADDR_CALC_BUF, 64u, { 7, 10, 7, 20, 16, 0 }, 6u },
      { "nonzero_offset_4_postfix_add_returns_30", 4u, ADDR_CALC_BUF, 64u, { 7, 10, 7, 20, 16, 0 }, 6u },
      /* 7, 5, 7, 12, 1, 1 (max), 0 -> 12 */
      { "postfix_fn1_max_5_12_returns_12", 0u, ADDR_CALC_BUF, 64u, { 7, 5, 7, 12, 1, 1, 0 }, 7u },
      /* 7, 0, 7, 1, 1, 3 (stat 0 base), 0 -> 45 */
      { "postfix_fn3_stat0_mode1_returns_45", 0u, ADDR_CALC_BUF, 64u, { 7, 0, 7, 1, 1, 3, 0 }, 7u }
    };
    uint32_t isc_ids[1] = { 0x00u };
    for (int i = 0; i < 7; i++) {
      clear_arena();
      w32(ADDR_DATATABLES + 0x98u, cases[i].code_buf);
      w32(ADDR_DATATABLES + 0x9Cu, cases[i].code_size);
      w32(ADDR_UNIT + 0x00u, 4u);
      uint32_t fkeys[1] = { 0u };
      int32_t fvals[1] = { 45 };
      setup_unit_stats(ADDR_UNIT, ADDR_STATLIST1, ADDR_STAT_ARR1, fkeys, fvals, 1, ADDR_STAT_ARR2, fkeys, fvals, 1);
      uint32_t dst_off = (cases[i].offset <= 16u) ? cases[i].offset : 0u;
      memcpy((void *)(uintptr_t)(ADDR_CALC_BUF + dst_off), cases[i].code, cases[i].code_len);
      int n = build_ranges(pre, 0u, isc_ids, 1);
      uint32_t args[3] = { ADDR_UNIT, ADDR_UNIT2, cases[i].offset };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall3(va, args[0], args[1], args[2]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 3, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 3. 0x6FD745D0 ITEMS_GetGemApplyTypeFromItem (stdcall pItem -> u8) */
  {
    const uint32_t va = 0x6FD745D0u;
    const char *nm = "ITEMS_GetGemApplyTypeFromItem";
    uint32_t cids[2] = { 0u, 1u };
    const char *ids[2] = { "row0_returns_2", "row1_returns_1" };
    for (int i = 0; i < 2; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 4u);
      w32(ADDR_UNIT + 0x04u, cids[i]);
      int n = build_ranges(pre, TBL_ITEMS, NULL, 0);
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 4. 0x6FD74710 ITEMS_GetMagicLevelFromItem (stdcall pItem -> i32) */
  {
    const uint32_t va = 0x6FD74710u;
    const char *nm = "ITEMS_GetMagicLevelFromItem";
    struct {
      const char *id;
      uint32_t cid;
      uint16_t suffix0;
    } cases[] = {
      { "normal_weapon_row0_returns_5", 0u, 0u },
      { "scroll_row1_valid_qual_returns_22", 1u, 1u },
      { "book_row2_invalid_qual_returns_minus1", 2u, 99u }
    };
    for (int i = 0; i < 3; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 4u);
      w32(ADDR_UNIT + 0x04u, cases[i].cid);
      w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
      w16(ADDR_ITEMDATA1 + 0x3Eu, cases[i].suffix0);
      int n = build_ranges(pre, TBL_ITEMS | TBL_TYPES | TBL_QUAL, NULL, 0);
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 1, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 5. 0x6FD747C0 ITEMS_GetGambleCostFromItem (stdcall pItem -> u32) */
  {
    const uint32_t va = 0x6FD747C0u;
    const char *nm = "ITEMS_GetGambleCostFromItem";
    uint32_t cids[2] = { 0u, 1u };
    const char *ids[2] = { "row0_returns_10", "row1_returns_777" };
    for (int i = 0; i < 2; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 4u);
      w32(ADDR_UNIT + 0x04u, cids[i]);
      int n = build_ranges(pre, TBL_ITEMS, NULL, 0);
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 6. 0x6FD74800 ITEMS_GetBitField2FromItem (stdcall pItem -> u32) */
  {
    const uint32_t va = 0x6FD74800u;
    const char *nm = "ITEMS_GetBitField2FromItem";
    uint32_t cids[2] = { 0u, 1u };
    const char *ids[2] = { "row0_returns_0x1234", "row1_returns_0x5678" };
    for (int i = 0; i < 2; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 4u);
      w32(ADDR_UNIT + 0x04u, cids[i]);
      int n = build_ranges(pre, TBL_ITEMS, NULL, 0);
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 7. 0x6FD74840 ITEMS_ComputeGambleBaseCost (eax=pItem, [esp+4]=nUnitLevel -> i32) */
  {
    const uint32_t va = 0x6FD74840u;
    const char *nm = "ITEMS_ComputeGambleBaseCost";
    struct {
      const char *id;
      uint32_t cid;
      uint32_t ulvl;
      int zero_uber_in_linker;
    } cases[] = {
      { "ring_row1_returns_fixed_50000", 1u, 30u, 0 },
      { "amulet_row2_returns_fixed_63000", 2u, 30u, 0 },
      { "hax_row0_with_uber_ultra_ulvl3", 0u, 3u, 0 },
      { "hax_row0_with_uber_ultra_ulvl50", 0u, 50u, 0 },
      { "cap_row6_no_uber_ultra_high_baselvl", 6u, 60u, 0 },
      { "cap_row6_uber_0x20202030_in_linker_still_skipped", 6u, 60u, 1 }
    };
    for (int i = 0; i < 6; i++) {
      clear_arena();
      if (cases[i].zero_uber_in_linker) {
        w32(ADDR_LINK + 0x00u, 8u);
        w32(ADDR_LINK_ENTRIES + 0x00u, 0x20202030u); w32(ADDR_LINK_ENTRIES + 0x04u, 4u);
        w32(ADDR_LINK_ENTRIES + 0x08u, 0x20616837u); w32(ADDR_LINK_ENTRIES + 0x0Cu, 5u);
        w32(ADDR_LINK_ENTRIES + 0x10u, 0x20616839u); w32(ADDR_LINK_ENTRIES + 0x14u, 4u);
        w32(ADDR_LINK_ENTRIES + 0x18u, 0x2067656Cu); w32(ADDR_LINK_ENTRIES + 0x1Cu, 3u);
        w32(ADDR_LINK_ENTRIES + 0x20u, 0x206E6972u); w32(ADDR_LINK_ENTRIES + 0x24u, 1u);
        w32(ADDR_LINK_ENTRIES + 0x28u, 0x20706163u); w32(ADDR_LINK_ENTRIES + 0x2Cu, 6u);
        w32(ADDR_LINK_ENTRIES + 0x30u, 0x20756D61u); w32(ADDR_LINK_ENTRIES + 0x34u, 2u);
        w32(ADDR_LINK_ENTRIES + 0x38u, 0x20786168u); w32(ADDR_LINK_ENTRIES + 0x3Cu, 0u);
      }
      w32(ADDR_UNIT + 0x00u, 4u);
      w32(ADDR_UNIT + 0x04u, cases[i].cid);
      int n = build_ranges(pre, TBL_ITEMS, NULL, 0);
      uint32_t args[2] = { ADDR_UNIT, cases[i].ulvl };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_eax_stack1_ret4(va, args[0], args[1]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 2, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 8. 0x6FD74F00 ITEMS_CanItemBePersonalizedOrRepaired (esi=pItem -> BOOL) */
  {
    const uint32_t va = 0x6FD74F00u;
    const char *nm = "ITEMS_CanItemBePersonalizedOrRepaired";
    struct {
      const char *id;
      uint32_t utype;
      uint32_t cid;
      uint32_t cmd_flags;
      int use_type0;
    } cases[] = {
      { "non_item_unit_returns_0", 1u, 0u, 0u, 0 },
      { "non_repairable_type2_returns_0", 4u, 6u, 0u, 0 },
      { "non_throwable_type6_returns_0", 4u, 4u, 0u, 0 },
      { "ethereal_item_returns_0", 4u, 0u, 0x400000u, 0 },
      { "valid_2h_throwable_non_ethereal_returns_1", 4u, 0u, 0u, 0 },
      { "type0_repairable_returns_1", 4u, 0u, 0u, 1 }
    };
    for (int i = 0; i < 6; i++) {
      clear_arena();
      if (cases[i].use_type0) {
        w16(ADDR_ITEMS_TXT + 0u * 0x1A8u + 0x11Eu, 0u);
        w8(ADDR_ITEMTYPES_TXT + 0u * 0xE4u + 0x08u, 1u);
        w8(ADDR_ITEMTYPES_TXT + 0u * 0xE4u + 0x10u, 1u);
      }
      w32(ADDR_UNIT + 0x00u, cases[i].utype);
      w32(ADDR_UNIT + 0x04u, cases[i].cid);
      w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
      w32(ADDR_ITEMDATA1 + 0x18u, cases[i].cmd_flags);
      int n = build_ranges(pre, TBL_ITEMS | TBL_TYPES, NULL, 0);
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_esi_ret(va, args[0]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 1, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 9. 0x6FD750B0 ITEMS_CheckIfImbueable (stdcall pItem -> BOOL) */
  {
    const uint32_t va = 0x6FD750B0u;
    const char *nm = "ITEMS_CheckIfImbueable";
    struct {
      const char *id;
      uint32_t cid;
      uint32_t cmd_flags;
      uint32_t flags2;
      uint32_t has_sock;
      uint32_t qual;
    } cases[] = {
      { "gold_type4_returns_0", 3u, 0u, 0u, 0u, 2u },
      { "ear_flag_returns_0", 4u, 0x1000u, 0u, 0u, 2u },
      { "non_imbueable_bitfield1_0_returns_0", 1u, 0u, 0u, 0u, 2u },
      { "throwable_without_flag25_returns_0", 0u, 0u, 0u, 0u, 2u },
      { "non_leg_quest_item_returns_0", 6u, 0u, (1u << 25), 0u, 2u },
      { "has_socketed_item_returns_0", 4u, 0u, 0u, 1u, 2u },
      { "socketed_flag_returns_0", 4u, 0x800u, 0u, 0u, 2u },
      { "magic_quality4_returns_0", 4u, 0u, 0u, 0u, 4u },
      { "valid_normal_weapon_row4_returns_1", 4u, 0u, 0u, 0u, 2u },
      { "valid_wirts_leg_row7_returns_1", 7u, 0u, 0u, 0u, 2u }
    };
    for (int i = 0; i < 10; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 4u);
      w32(ADDR_UNIT + 0x04u, cases[i].cid);
      w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
      w32(ADDR_UNIT + 0xC8u, cases[i].flags2);
      w32(ADDR_ITEMDATA1 + 0x00u, cases[i].qual);
      w32(ADDR_ITEMDATA1 + 0x18u, cases[i].cmd_flags);
      if (cases[i].has_sock) {
        w32(ADDR_UNIT + 0x60u, ADDR_INV1);
        w32(ADDR_INV1 + 0x00u, 0x01020304u);
        w32(ADDR_INV1 + 0x0Cu, ADDR_UNIT2);
        w32(ADDR_UNIT2 + 0x00u, 4u);
      }
      int n = build_ranges(pre, TBL_ITEMS | TBL_TYPES, NULL, 0);
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 1, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 10. 0x6FD75C10 ITEMS_EncodeCompactAndBasicItemStream (ebx=pBitStream, [esp+4]=pItem, [esp+8]=bWriteAutoAffix -> void) */
  {
    const uint32_t va = 0x6FD75C10u;
    const char *nm = "ITEMS_EncodeCompactAndBasicItemStream";
    uint32_t isc_ids[2] = { 0x0Eu, 0x164u };
    struct {
      const char *id;
      uint32_t cid;
      uint32_t anim_mode;
      uint32_t cmd_flags;
      int32_t gold_val;
      uint32_t write_auto;
      uint32_t auto_f20;
    } cases[] = {
      { "ground_mode3_normal_item_no_auto", 0u, 3u, 0u, 0, 0u, 0u },
      { "inv_mode0_ear_item_with_auto_zero", 0u, 0u, 0x10000u, 0, 1u, 0u },
      { "inv_mode0_gold_small_pile_and_quest_diff_with_auto_nonzero", 3u, 0u, 0u, 500, 1u, 77u },
      { "ground_mode5_gold_big_pile", 3u, 5u, 0u, 5000, 0u, 0u }
    };
    RangeSpec post_bs[2] = {
      { ADDR_BITSTREAM, 0x20u },
      { ADDR_BS_BUF, 0x40u }
    };
    for (int i = 0; i < 4; i++) {
      clear_arena();
      w32(ADDR_BITSTREAM + 0x00u, ADDR_BS_BUF);
      w32(ADDR_BITSTREAM + 0x04u, 512u); /* 64 bytes * 8 bits */
      w32(ADDR_UNIT + 0x00u, 4u);
      w32(ADDR_UNIT + 0x04u, cases[i].cid);
      w32(ADDR_UNIT + 0x10u, cases[i].anim_mode);
      w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
      w32(ADDR_UNIT + 0x2Cu, ADDR_PATH1);
      w32(ADDR_PATH1 + 0x0Cu, 12u);
      w32(ADDR_PATH1 + 0x10u, 34u);
      w32(ADDR_ITEMDATA1 + 0x18u, cases[i].cmd_flags);
      w32(ADDR_ITEMDATA1 + 0x1Cu, 0x11223344u);
      w32(ADDR_ITEMDATA1 + 0x20u, cases[i].auto_f20);
      w32(ADDR_ITEMDATA1 + 0x28u, 3u);
      w16(ADDR_ITEMDATA1 + 0x30u, 101u);
      w8(ADDR_ITEMDATA1 + 0x44u, 4u);
      w8(ADDR_ITEMDATA1 + 0x45u, 1u);
      w8(ADDR_ITEMDATA1 + 0x48u, 42u);
      w8(ADDR_ITEMDATA1 + 0x4Au, (uint8_t)'A');
      w8(ADDR_ITEMDATA1 + 0x4Bu, (uint8_t)'B');
      w8(ADDR_ITEMDATA1 + 0x4Cu, 0u);
      uint32_t fkeys[2] = { 0x0Eu << 16, 0x164u << 16 };
      int32_t fvals[2] = { cases[i].gold_val, 2 };
      setup_unit_stats(ADDR_UNIT, ADDR_STATLIST1, ADDR_STAT_ARR1, fkeys, fvals, 2, ADDR_STAT_ARR2, fkeys, fvals, 2);
      int n = build_ranges(pre, TBL_ITEMS | TBL_TYPES, isc_ids, 2);
      uint32_t args[3] = { ADDR_BITSTREAM, ADDR_UNIT, cases[i].write_auto };
      capture_pre(pre, n, pre_bufs);
      call_ebx_stack2_ret8(va, args[0], args[1], args[2]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 3, 0u, 0u, pre, n, pre_bufs, post_bs, 2);
    }
  }

  /* 11. 0x6FD760F0 ITEMS_GetTotalMaxStack (stdcall pItem -> i32) */
  {
    const uint32_t va = 0x6FD760F0u;
    const char *nm = "ITEMS_GetTotalMaxStack";
    uint32_t isc_ids[1] = { 0xFEu };
    int32_t extra_vals[4] = { 0, 50, 600, 50 };
    uint32_t isc_cnts[4] = { 360u, 360u, 360u, 0xFEu };
    const char *ids[4] = {
      "no_extra_returns_20",
      "with_extra_50_returns_70",
      "clamped_to_511",
      "isc_count_0xfe_returns_base_20"
    };
    for (int i = 0; i < 4; i++) {
      clear_arena();
      w32(ADDR_DATATABLES + 0xBD4u, isc_cnts[i]);
      w32(ADDR_UNIT + 0x00u, 4u);
      w32(ADDR_UNIT + 0x04u, 0u);
      if (i > 0) {
        uint32_t fkeys[1] = { 0xFEu << 16 };
        int32_t fvals[1] = { extra_vals[i] };
        setup_unit_stats(ADDR_UNIT, ADDR_STATLIST1, ADDR_STAT_ARR1, fkeys, fvals, 1, ADDR_STAT_ARR2, fkeys, fvals, 1);
      }
      int n = build_ranges(pre, TBL_ITEMS, isc_ids, 1);
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 12. 0x6FD78850 ITEMS_CalculateAdditionalCostsForBonusStats */
  {
    const uint32_t va = 0x6FD78850u;
    const char *nm = "ITEMS_CalculateAdditionalCostsForBonusStats";
    uint32_t isc_ids[5] = { 0x00u, 0x6Bu, 0xC3u, 0xCCu, 0xD8u };
    RangeSpec post_costs[1] = { { ADDR_SCRATCH, 16u } };
    struct {
      const char *id;
      int has_stats;
      int32_t c0;
    } cases[] = {
      { "no_stats_adds_zero", 0, 100 },
      { "all_encode_branches_small_c0", 1, 100 },
      { "all_encode_branches_large_c0_over_0xffff", 1, 20000 },
      /* k1r3 (reviewer cx): non-extended list -> 0x6FD88410 returns 0 (no stats read) */
      { "flag_clear_nonextended_adds_zero", 1, 100 },
      /* k1r3 (reviewer cx): wFullStatCount = 0xFFFF -> movsx -1 -> signed jle skips the loop */
      { "fullcount_negative_adds_zero", 1, 100 }
    };
    for (int i = 0; i < 5; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 4u);
      w32(ADDR_SCRATCH + 0x00u, (uint32_t)cases[i].c0);
      w32(ADDR_SCRATCH + 0x04u, 200u);
      w32(ADDR_SCRATCH + 0x08u, 300u);
      if (cases[i].has_stats) {
        uint32_t bkeys[1] = { 0x00u << 16 };
        int32_t bvals[1] = { 5 };
        uint32_t fkeys[5] = {
          (0x00u << 16) | 0u,
          (0x6Bu << 16) | 1u,
          (0xC3u << 16) | ((1u << 6) | 4u),
          (0xCCu << 16) | ((2u << 6) | 5u),
          (0xD8u << 16) | 0u
        };
        int32_t fvals[5] = { 25, 3, 10, 8, 0x20800 };
        setup_unit_stats(ADDR_UNIT, ADDR_STATLIST1, ADDR_STAT_ARR1, bkeys, bvals, 1, ADDR_STAT_ARR2, fkeys, fvals, 5);
        if (i == 3) { w32(ADDR_STATLIST1 + 0x10u, 0u); w32(ADDR_STATLIST1 + 0x24u, ADDR_STAT_ARR2); w16(ADDR_STATLIST1 + 0x28u, 5u); }
        if (i == 4) { w16(ADDR_STATLIST1 + 0x4Cu, 0xFFFFu); }
      }
      int n = build_ranges(pre, TBL_SKILLS, isc_ids, 5);
      uint32_t args[5] = { ADDR_UNIT, ADDR_SCRATCH, ADDR_SCRATCH + 4u, ADDR_SCRATCH + 8u, 2u };
      capture_pre(pre, n, pre_bufs);
      call_ecx_stack4_ret16(va, args[0], args[1], args[2], args[3], args[4]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 5, 0u, 0u, pre, n, pre_bufs, post_costs, 1);
    }
  }

  /* 13. 0x6FD7D660 DRLG_ValidateAndRebaseLevelRooms (stdcall pLevel -> void) */
  {
    const uint32_t va = 0x6FD7D660u;
    const char *nm = "DRLG_ValidateAndRebaseLevelRooms";
    RangeSpec post_rooms[3] = {
      { ADDR_ROOM1, 0x60u },
      { ADDR_ROOM2, 0x60u },
      { ADDR_ROOM3, 0x60u }
    };
    clear_arena();
    w32(ADDR_LEVEL + 0x10u, ADDR_ROOM1);
    w32(ADDR_LEVEL + 0x1Cu, 100u); /* nPosX */
    w32(ADDR_LEVEL + 0x20u, 200u); /* nPosY */
    w32(ADDR_LEVEL + 0x24u, 50u);  /* nWidth */
    w32(ADDR_LEVEL + 0x28u, 60u);  /* nHeight */
    /* Room 1: x=10, y=20, w=8, h=10 -> next=ADDR_ROOM2 */
    w32(ADDR_ROOM1 + 0x24u, ADDR_ROOM2);
    w32(ADDR_ROOM1 + 0x34u, 10u);
    w32(ADDR_ROOM1 + 0x38u, 20u);
    w32(ADDR_ROOM1 + 0x3Cu, 8u);
    w32(ADDR_ROOM1 + 0x40u, 10u);
    /* Room 2: x=12, y=22, w=2, h=2 (interior room) -> next=ADDR_ROOM3 */
    w32(ADDR_ROOM2 + 0x24u, ADDR_ROOM3);
    w32(ADDR_ROOM2 + 0x34u, 12u);
    w32(ADDR_ROOM2 + 0x38u, 22u);
    w32(ADDR_ROOM2 + 0x3Cu, 2u);
    w32(ADDR_ROOM2 + 0x40u, 2u);
    /* Room 3: x=6, y=15, w=20, h=25 (expands min & max) -> next=0 */
    w32(ADDR_ROOM3 + 0x24u, 0u);
    w32(ADDR_ROOM3 + 0x34u, 6u);
    w32(ADDR_ROOM3 + 0x38u, 15u);
    w32(ADDR_ROOM3 + 0x3Cu, 20u);
    w32(ADDR_ROOM3 + 0x40u, 25u);
    int n = build_ranges(pre, 0u, NULL, 0);
    uint32_t args[1] = { ADDR_LEVEL };
    capture_pre(pre, n, pre_bufs);
    call_stdcall1(va, args[0]);
    emit_ndjson_line(fp, va, nm, "three_rooms_rebase_to_level_origin", args, 1, 0u, 0u, pre, n, pre_bufs, post_rooms, 3);

    /* k1r3: 0x6FD7D3C0 seeds the box from the first room (negative coords), plus every assert path */
    const char *ids2[5] = {
      "negative_room_rebases_to_level_origin",
      "null_level_asserts_2e3",
      "no_rooms_asserts_2e4",
      "level_too_narrow_asserts_2eb",
      "level_too_short_asserts_2ec"
    };
    for (int i = 0; i < 5; i++) {
      clear_arena();
      w32(ADDR_LEVEL + 0x10u, (i == 2) ? 0u : ADDR_ROOM1);
      w32(ADDR_LEVEL + 0x1Cu, 7u);                         /* nPosX */
      w32(ADDR_LEVEL + 0x20u, 9u);                         /* nPosY */
      w32(ADDR_LEVEL + 0x24u, (i == 3) ? 4u : 5u);         /* nWidth */
      w32(ADDR_LEVEL + 0x28u, (i == 4) ? 4u : 5u);         /* nHeight */
      w32(ADDR_ROOM1 + 0x24u, 0u);
      w32(ADDR_ROOM1 + 0x34u, (uint32_t)-10);
      w32(ADDR_ROOM1 + 0x38u, (uint32_t)-10);
      w32(ADDR_ROOM1 + 0x3Cu, 5u);
      w32(ADDR_ROOM1 + 0x40u, 5u);
      int n2 = build_ranges(pre, 0u, NULL, 0);
      uint32_t args2[1] = { (i == 1) ? 0u : ADDR_LEVEL };
      capture_pre(pre, n2, pre_bufs);
      int asserted = 0;
      (void)safe_stdcall1(va, args2[0], &asserted);
      if (asserted) {
        emit_ndjson_assert(fp, va, nm, ids2[i], args2, 1, pre, n2, pre_bufs, g_assert_line);
      } else {
        emit_ndjson_line(fp, va, nm, ids2[i], args2, 1, 0u, 0u, pre, n2, pre_bufs, post_rooms, 1);
      }
    }
  }

  /* 14. 0x6FD95BE0 ITEMS_CheckQualityItemMatch (stdcall pItem, pQualityItemTxt -> BOOL) */
  {
    const uint32_t va = 0x6FD95BE0u;
    const char *nm = "ITEMS_CheckQualityItemMatch";
    struct {
      const char *id;
      uint32_t cid;
      uint8_t b_armor;
      uint8_t b_weapon;
      uint8_t b_shield;
    } cases[] = {
      { "weapon_row4_matches_bweapon", 4u, 0u, 1u, 0u },
      { "armor_row5_matches_barmor", 5u, 1u, 0u, 0u },
      { "armor_row6_wtype2_excluded_by_barmor_matches_table0", 6u, 1u, 0u, 1u },
      { "armor_row6_wtype2_misses_when_table0_is_0", 6u, 1u, 0u, 0u }
    };
    for (int i = 0; i < 4; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 4u);
      w32(ADDR_UNIT + 0x04u, cases[i].cid);
      w8(ADDR_QUALITEMS_TXT + 0x00u, cases[i].b_armor);
      w8(ADDR_QUALITEMS_TXT + 0x01u, cases[i].b_weapon);
      w8(ADDR_QUALITEMS_TXT + 0x02u, cases[i].b_shield);
      int n = build_ranges(pre, TBL_ITEMS | TBL_TYPES | TBL_QUAL, NULL, 0);
      uint32_t args[2] = { ADDR_UNIT, ADDR_QUALITEMS_TXT };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall2(va, args[0], args[1]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 2, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 15. 0x6FD95D30 ITEMS_CheckAffixAssignableToItem (stdcall pItem, pMagicAffixTxt -> BOOL) */
  {
    const uint32_t va = 0x6FD95D30u;
    const char *nm = "ITEMS_CheckAffixAssignableToItem";
    struct {
      const char *id;
      uint32_t cid;
      uint16_t item_fmt;
      uint16_t affix_ver;
      int16_t etype0;
      int16_t itype0;
    } cases[] = {
      { "classic_fmt_rejects_2h_row0", 0u, 50u, 1u, 0, 1 },
      { "lod_affix_rejects_classic_item", 4u, 50u, 100u, 0, 6 },
      { "etype_match_rejects_item", 4u, 100u, 100u, 6, 6 },
      { "itype_miss_returns_0", 4u, 100u, 100u, 3, 3 },
      { "itype_match_returns_1", 4u, 100u, 100u, 3, 6 }
    };
    for (int i = 0; i < 5; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 4u);
      w32(ADDR_UNIT + 0x04u, cases[i].cid);
      w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
      w16(ADDR_ITEMDATA1 + 0x30u, cases[i].item_fmt);
      w16(ADDR_MAGAFFIX_REC + 0x0Eu, cases[i].affix_ver);
      w16(ADDR_MAGAFFIX_REC + 0x10u, (uint16_t)cases[i].itype0);
      w16(ADDR_MAGAFFIX_REC + 0x1Eu, (uint16_t)cases[i].etype0);
      int n = build_ranges(pre, TBL_ITEMS | TBL_TYPES, NULL, 0);
      uint32_t args[2] = { ADDR_UNIT, ADDR_MAGAFFIX_REC };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall2(va, args[0], args[1]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 2, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 16. 0x6FD9EE00 SKILLS_AddOrRemoveItemChargedSkill */
  {
    const uint32_t va = 0x6FD9EE00u;
    const char *nm = "SKILLS_AddOrRemoveItemChargedSkill";
    RangeSpec post_sk[5] = {
      { ADDR_SKILL_LIST, 0x20u },
      { ADDR_SKILL0, 0x40u },
      { ADDR_SKILL1, 0x40u },
      { ADDR_SKILL2, 0x40u },
      { HEAP_BASE, 0x40u }
    };
    /* Case 0: invalid unit/level/skillId no-op */
    {
      clear_arena();
      int n = build_ranges(pre, TBL_SKILLS | TBL_HEAP, NULL, 0);
      uint32_t args[6] = { 1u, 0u, 55u, 3u, 10u, 0u };
      capture_pre(pre, n, pre_bufs);
      call_eax_stack5_ret20(va, args);
      emit_ndjson_line(fp, va, nm, "null_unit_noop", args, 6, 0u, 0u, pre, n, pre_bufs, post_sk, 5);
    }
    /* Case 0b: skillId == nSkillsTxtRecordCount (6) no-op */
    {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 0u);
      w32(ADDR_UNIT + 0xA8u, ADDR_SKILL_LIST);
      int n = build_ranges(pre, TBL_SKILLS | TBL_HEAP, NULL, 0);
      uint32_t args[6] = { 6u, ADDR_UNIT, 55u, 3u, 10u, 0u };
      capture_pre(pre, n, pre_bufs);
      call_eax_stack5_ret20(va, args);
      emit_ndjson_line(fp, va, nm, "skill_id_equal_count_6_noop", args, 6, 0u, 0u, pre, n, pre_bufs, post_sk, 5);
    }
    /* Case 1: add new charged skill to empty pFirstSkill (nAnim = 7 -> dwSkillMode = 7) */
    {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 0u);
      w32(ADDR_UNIT + 0xA8u, ADDR_SKILL_LIST);
      int n = build_ranges(pre, TBL_SKILLS | TBL_HEAP, NULL, 0);
      uint32_t args[6] = { 1u, ADDR_UNIT, 55u, 3u, 10u, 0u };
      capture_pre(pre, n, pre_bufs);
      call_eax_stack5_ret20(va, args);
      emit_ndjson_line(fp, va, nm, "add_new_skill_empty_list_anim7", args, 6, 0u, 0u, pre, n, pre_bufs, post_sk, 5);
    }
    /* Case 2: add new charged skill at tail of non-empty list (nAnim = 3 -> default dwSkillMode = 10) */
    {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 0u);
      w32(ADDR_UNIT + 0xA8u, ADDR_SKILL_LIST);
      w32(ADDR_SKILL_LIST + 0x04u, ADDR_SKILL0);
      w32(ADDR_SKILL0 + 0x00u, ADDR_SKILLS_TXT + 1u * 0x23Cu);
      w32(ADDR_SKILL0 + 0x34u, 44u);
      int n = build_ranges(pre, TBL_SKILLS | TBL_HEAP, NULL, 0);
      uint32_t args[6] = { 3u, ADDR_UNIT, 55u, 4u, 12u, 0u };
      capture_pre(pre, n, pre_bufs);
      call_eax_stack5_ret20(va, args);
      emit_ndjson_line(fp, va, nm, "add_new_skill_append_tail_default_anim10", args, 6, 0u, 0u, pre, n, pre_bufs, post_sk, 5);
    }
    /* Case 3: update existing matching charged skill node */
    {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 0u);
      w32(ADDR_UNIT + 0xA8u, ADDR_SKILL_LIST);
      w32(ADDR_SKILL_LIST + 0x04u, ADDR_SKILL0);
      w32(ADDR_SKILL0 + 0x00u, ADDR_SKILLS_TXT + 1u * 0x23Cu);
      w32(ADDR_SKILL0 + 0x34u, 55u);
      int n = build_ranges(pre, TBL_SKILLS | TBL_HEAP, NULL, 0);
      uint32_t args[6] = { 1u, ADDR_UNIT, 55u, 7u, 25u, 0u };
      capture_pre(pre, n, pre_bufs);
      call_eax_stack5_ret20(va, args);
      emit_ndjson_line(fp, va, nm, "update_existing_charged_skill", args, 6, 0u, 0u, pre, n, pre_bufs, post_sk, 5);
    }
    /* Case 4: remove charged skill that is currently left, right, and used skill */
    {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 0u);
      w32(ADDR_UNIT + 0xA8u, ADDR_SKILL_LIST);
      w32(ADDR_SKILL_LIST + 0x04u, ADDR_SKILL0);
      w32(ADDR_SKILL_LIST + 0x08u, ADDR_SKILL1); /* pLeftSkill */
      w32(ADDR_SKILL_LIST + 0x0Cu, ADDR_SKILL1); /* pRightSkill */
      w32(ADDR_SKILL_LIST + 0x10u, ADDR_SKILL1); /* pUsedSkill */
      /* Skill 0: basic attack (skillId = 0, ownerGuid = -1) -> next = ADDR_SKILL1 */
      w32(ADDR_SKILL0 + 0x00u, ADDR_SKILLS_TXT + 0u * 0x23Cu);
      w32(ADDR_SKILL0 + 0x04u, ADDR_SKILL1);
      w32(ADDR_SKILL0 + 0x34u, 0xFFFFFFFFu);
      /* Skill 1: charged skill (skillId = 1, ownerGuid = 55) */
      w32(ADDR_SKILL1 + 0x00u, ADDR_SKILLS_TXT + 1u * 0x23Cu);
      w32(ADDR_SKILL1 + 0x04u, 0u);
      w32(ADDR_SKILL1 + 0x34u, 55u);
      int n = build_ranges(pre, TBL_SKILLS | TBL_HEAP, NULL, 0);
      uint32_t args[6] = { 1u, ADDR_UNIT, 55u, 3u, 10u, 1u };
      capture_pre(pre, n, pre_bufs);
      call_eax_stack5_ret20(va, args);
      emit_ndjson_line(fp, va, nm, "remove_charged_skill_resets_active_and_unlinks", args, 6, 0u, 0u, pre, n, pre_bufs, post_sk, 5);
    }
  }
}

/* =========================================================================
 * Batch B052 Vector Emission (17 B052 Functions + 3 Temporary B043 Callees)
 * ========================================================================= */

static void emit_b052(FILE *fp) {
  RangeSpec pre[40];
  uint8_t *pre_bufs[40];
  RangeSpec post_empty[1] = { { ADDR_UNIT, 0u } };

  /* 1. 0x6FD73D70 ITEMS_GetSetItemsSetId (stdcall pItem -> i32) */
  {
    const uint32_t va = 0x6FD73D70u;
    const char *nm = "ITEMS_GetSetItemsSetId";
    struct {
      const char *id;
      uint32_t ptr;
      uint32_t has_data;
      uint32_t qual;
      uint32_t cell;
      uint32_t set_cnt;
    } cases[] = {
      { "null_returns_minus1", 0u, 1u, 5u, 0u, 4u },
      { "null_itemdata_returns_minus1", ADDR_UNIT, 0u, 5u, 0u, 4u },
      { "non_set_quality_returns_minus1", ADDR_UNIT, 1u, 2u, 0u, 4u },
      { "cell_equal_count_3_returns_minus1", ADDR_UNIT, 1u, 5u, 3u, 3u },
      { "out_of_range_cell_returns_minus1", ADDR_UNIT, 1u, 5u, 99u, 4u },
      { "valid_set_item_returns_2", ADDR_UNIT, 1u, 5u, 0u, 4u }
    };
    for (int i = 0; i < 6; i++) {
      clear_arena();
      w32(ADDR_DATATABLES + 0xC1Cu, cases[i].set_cnt);
      w16(ADDR_SETITEMS_TXT + 3u * 0x1B8u + 0x2Cu, 2u);
      w32(ADDR_UNIT + 0x00u, 4u);
      w32(ADDR_UNIT + 0x14u, cases[i].has_data ? ADDR_ITEMDATA1 : 0u);
      w32(ADDR_ITEMDATA1 + 0x00u, cases[i].qual);
      w32(ADDR_ITEMDATA1 + 0x28u, cases[i].cell);
      int n = build_ranges(pre, TBL_SET, NULL, 0);
      uint32_t args[1] = { cases[i].ptr };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 1, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 2. 0x6FD73F40 ITEMS_GetSetItemsTxtRecordFromItem (stdcall pItem -> ptr) */
  {
    const uint32_t va = 0x6FD73F40u;
    const char *nm = "ITEMS_GetSetItemsTxtRecordFromItem";
    struct {
      const char *id;
      uint32_t ptr;
      uint32_t has_data;
      uint32_t qual;
      uint32_t cell;
      uint32_t set_cnt;
    } cases[] = {
      { "null_returns_0", 0u, 1u, 5u, 0u, 4u },
      { "null_itemdata_returns_0", ADDR_UNIT, 0u, 5u, 0u, 4u },
      { "non_set_quality_returns_0", ADDR_UNIT, 1u, 4u, 0u, 4u },
      { "cell_equal_count_3_returns_0", ADDR_UNIT, 1u, 5u, 3u, 3u },
      { "valid_set_item_returns_record_ptr", ADDR_UNIT, 1u, 5u, 1u, 4u }
    };
    for (int i = 0; i < 5; i++) {
      clear_arena();
      w32(ADDR_DATATABLES + 0xC1Cu, cases[i].set_cnt);
      w32(ADDR_UNIT + 0x00u, 4u);
      w32(ADDR_UNIT + 0x14u, cases[i].has_data ? ADDR_ITEMDATA1 : 0u);
      w32(ADDR_ITEMDATA1 + 0x00u, cases[i].qual);
      w32(ADDR_ITEMDATA1 + 0x28u, cases[i].cell);
      int n = build_ranges(pre, TBL_SET, NULL, 0);
      uint32_t args[1] = { cases[i].ptr };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 1, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 3. 0x6FD73F90 ITEMS_GetEquippedSetItemsMask (stdcall pPlayer, pSetItem, bIncludeSelf -> u32) */
  {
    const uint32_t va = 0x6FD73F90u;
    const char *nm = "ITEMS_GetEquippedSetItemsMask";
    struct {
      const char *id;
      uint32_t plr;
      uint32_t item;
      uint32_t inc_self;
      uint32_t item1_qual;
    } cases[] = {
      { "null_player_returns_0", 0u, ADDR_UNIT2, 1u, 5u },
      { "null_item_returns_0", ADDR_UNIT, 0u, 1u, 5u },
      { "non_set_item_returns_0", ADDR_UNIT, ADDR_UNIT2, 1u, 2u },
      { "invalid_set_id_returns_0", ADDR_UNIT, ADDR_UNIT2, 1u, 5u },
      { "include_self_0_returns_other_piece_mask_16", ADDR_UNIT, ADDR_UNIT2, 0u, 5u },
      { "include_self_1_returns_combined_mask_20", ADDR_UNIT, ADDR_UNIT2, 1u, 5u }
    };
    for (int i = 0; i < 6; i++) {
      clear_arena();
      if (i == 3) {
        w16(ADDR_SETITEMS_TXT + 0u * 0x1B8u + 0x2Cu, 99u);
      }
      w32(ADDR_UNIT + 0x00u, 0u);
      w32(ADDR_UNIT + 0x60u, ADDR_INV1);
      w32(ADDR_INV1 + 0x00u, 0x01020304u);
      w32(ADDR_INV1 + 0x0Cu, ADDR_UNIT2);
      /* Item 1 (ADDR_UNIT2): set item cell 0 (set 1, bit 2 -> 4), equipped (nodePos=3) */
      w32(ADDR_UNIT2 + 0x00u, 4u);
      w32(ADDR_UNIT2 + 0x14u, ADDR_ITEMDATA2);
      w32(ADDR_ITEMDATA2 + 0x00u, cases[i].item1_qual);
      w32(ADDR_ITEMDATA2 + 0x28u, 0u);
      w32(ADDR_ITEMDATA2 + 0x64u, ADDR_UNIT3);
      w8(ADDR_ITEMDATA2 + 0x69u, 3u);
      /* Item 2 (ADDR_UNIT3): set item cell 1 (set 1, bit 4 -> 16), equipped (nodePos=3) */
      w32(ADDR_UNIT3 + 0x00u, 4u);
      w32(ADDR_UNIT3 + 0x14u, ADDR_ITEMDATA3);
      w32(ADDR_ITEMDATA3 + 0x00u, 5u);
      w32(ADDR_ITEMDATA3 + 0x28u, 1u);
      w8(ADDR_ITEMDATA3 + 0x69u, 3u);
      int n = build_ranges(pre, TBL_SET, NULL, 0);
      uint32_t args[3] = { cases[i].plr, cases[i].item, cases[i].inc_self };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall3(va, args[0], args[1], args[2]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 3, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 4. 0x6FD741D0 ITEMS_CanItemBeShownInTradeOrStash (stdcall pItem -> BOOL) */
  {
    const uint32_t va = 0x6FD741D0u;
    const char *nm = "ITEMS_CanItemBeShownInTradeOrStash";
    struct {
      const char *id;
      uint32_t cid;
      uint32_t has_data;
      uint32_t cmd_flags;
    } cases[] = {
      { "ear_flag_returns_0", 0u, 1u, 0x1000u },
      { "row1_ncomponent1_returns_0", 1u, 1u, 0u },
      { "null_itemdata_row0_returns_1", 0u, 0u, 0u },
      { "row0_normal_returns_1", 0u, 1u, 0u }
    };
    for (int i = 0; i < 4; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 4u);
      w32(ADDR_UNIT + 0x04u, cases[i].cid);
      w32(ADDR_UNIT + 0x14u, cases[i].has_data ? ADDR_ITEMDATA1 : 0u);
      w32(ADDR_ITEMDATA1 + 0x18u, cases[i].cmd_flags);
      int n = build_ranges(pre, TBL_ITEMS, NULL, 0);
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 1, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 5. 0x6FD74500 ITEMS_CheckItemIdMatchesItemType (stdcall nItemId, nItemType -> u32) */
  {
    const uint32_t va = 0x6FD74500u;
    const char *nm = "ITEMS_CheckItemIdMatchesItemType";
    struct {
      const char *id;
      uint32_t item_id;
      uint32_t item_type;
      uint32_t type_cnt;
    } cases[] = {
      { "negative_type_returns_0", 0u, 0xFFFFFFFFu, 60u },
      { "out_of_range_type_returns_0", 0u, 99u, 60u },
      { "invalid_item_id_returns_0", 99u, 1u, 60u },
      { "wtype1_equal_typecount_returns_0", 6u, 0u, 2u },
      { "wtype2_zero_does_not_check_type0_returns_0", 6u, 0u, 60u },
      { "wtype1_match_returns_1", 0u, 1u, 60u },
      { "wtype2_match_returns_bitmask", 0u, 6u, 60u },
      { "neither_matches_returns_0", 0u, 3u, 60u }
    };
    for (int i = 0; i < 8; i++) {
      clear_arena();
      if (i == 3) {
        set_item_type_equiv_bit(2u, 0u);
      }
      w32(ADDR_DATATABLES + 0xBFCu, cases[i].type_cnt);
      int n = build_ranges(pre, TBL_ITEMS | TBL_TYPES, NULL, 0);
      uint32_t args[2] = { cases[i].item_id, cases[i].item_type };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall2(va, args[0], args[1]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 2, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 6. 0x6FD746F0 ITEMS_GetSubTypeFromItem (stdcall pItem -> u8) */
  {
    const uint32_t va = 0x6FD746F0u;
    const char *nm = "ITEMS_GetSubTypeFromItem";
    uint32_t ptrs[3] = { 0u, ADDR_UNIT, ADDR_UNIT };
    uint32_t utypes[3] = { 4u, 1u, 4u };
    const char *ids[3] = { "null_returns_0", "non_item_returns_0", "row0_returns_1" };
    for (int i = 0; i < 3; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, utypes[i]);
      w32(ADDR_UNIT + 0x04u, 0u);
      int n = build_ranges(pre, TBL_ITEMS, NULL, 0);
      uint32_t args[1] = { ptrs[i] };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 7. 0x6FD74BF0 ITEMS_GetInvWidthFromItem (stdcall pItem -> u8) */
  {
    const uint32_t va = 0x6FD74BF0u;
    const char *nm = "ITEMS_GetInvWidthFromItem";
    uint32_t ptrs[3] = { 0u, ADDR_UNIT, ADDR_UNIT };
    uint32_t utypes[3] = { 4u, 1u, 4u };
    const char *ids[3] = { "null_returns_0", "non_item_returns_0", "row0_returns_2" };
    for (int i = 0; i < 3; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, utypes[i]);
      w32(ADDR_UNIT + 0x04u, 0u);
      int n = build_ranges(pre, TBL_ITEMS, NULL, 0);
      uint32_t args[1] = { ptrs[i] };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 8. 0x6FD74F90 ITEMS_CountSocketedItemsInGemSocketable (eax=pItem -> i32) */
  {
    const uint32_t va = 0x6FD74F90u;
    const char *nm = "ITEMS_CountSocketedItemsInGemSocketable";
    struct {
      const char *id;
      uint32_t ptr;
      uint32_t cid;
      uint32_t n_sock;
    } cases[] = {
      { "null_returns_0", 0u, 0u, 0u },
      { "non_socketable_subtype0_returns_0", ADDR_UNIT, 1u, 0u },
      { "empty_inventory_returns_0", ADDR_UNIT, 0u, 0u },
      { "two_socketed_items_returns_2", ADDR_UNIT, 0u, 2u }
    };
    for (int i = 0; i < 4; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 4u);
      w32(ADDR_UNIT + 0x04u, cases[i].cid);
      if (cases[i].n_sock > 0u) {
        w32(ADDR_UNIT + 0x60u, ADDR_INV1);
        w32(ADDR_INV1 + 0x00u, 0x01020304u);
        w32(ADDR_INV1 + 0x0Cu, ADDR_UNIT2);
        w32(ADDR_UNIT2 + 0x00u, 4u);
        w32(ADDR_UNIT2 + 0x14u, ADDR_ITEMDATA2);
        w32(ADDR_ITEMDATA2 + 0x64u, ADDR_UNIT3);
        w32(ADDR_UNIT3 + 0x00u, 4u);
        w32(ADDR_UNIT3 + 0x14u, ADDR_ITEMDATA3);
      }
      int n = build_ranges(pre, TBL_ITEMS, NULL, 0);
      uint32_t args[1] = { cases[i].ptr };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_eax_ret(va, args[0]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 1, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 9. 0x6FD766E0 ITEMS_SumStatAcrossSocketedItems (stdcall pItem, nStatId, pOutSum -> void) */
  {
    const uint32_t va = 0x6FD766E0u;
    const char *nm = "ITEMS_SumStatAcrossSocketedItems";
    uint32_t isc_ids[2] = { 0x00u, 0x02u };
    RangeSpec post_sum[1] = { { ADDR_SCRATCH, 4u } };
    struct {
      const char *id;
      uint32_t ptr;
      uint32_t anim_mode;
      uint32_t stat_id;
      uint32_t isc_cnt;
    } cases[] = {
      { "null_item_zeroes_out_sum", 0u, 1u, 0u, 360u },
      { "unequipped_mode0_writes_0", ADDR_UNIT, 0u, 0u, 360u },
      { "stat_equal_isccount_writes_0", ADDR_UNIT, 1u, 2u, 2u },
      { "equipped_mode1_sums_two_socketed_items", ADDR_UNIT, 1u, 0u, 360u },
      { "equipped_mode1_nonzero_stat2_sums_40", ADDR_UNIT, 1u, 2u, 360u }
    };
    for (int i = 0; i < 5; i++) {
      clear_arena();
      w32(ADDR_DATATABLES + 0xBD4u, cases[i].isc_cnt);
      w32(ADDR_SCRATCH, 0xDEADBEEFu);
      w32(ADDR_UNIT + 0x00u, 4u);
      w32(ADDR_UNIT + 0x04u, 0u);
      w32(ADDR_UNIT + 0x10u, cases[i].anim_mode);
      w32(ADDR_UNIT + 0x60u, ADDR_INV1);
      w32(ADDR_INV1 + 0x00u, 0x01020304u);
      w32(ADDR_INV1 + 0x0Cu, ADDR_UNIT2);
      w32(ADDR_UNIT2 + 0x00u, 4u);
      w32(ADDR_UNIT2 + 0x14u, ADDR_ITEMDATA2);
      w32(ADDR_ITEMDATA2 + 0x64u, ADDR_UNIT3);
      w32(ADDR_UNIT3 + 0x00u, 4u);
      w32(ADDR_UNIT3 + 0x14u, ADDR_ITEMDATA3);
      uint32_t fkeys[1] = { cases[i].stat_id << 16 };
      int32_t fvals1[1] = { 15 };
      int32_t fvals2[1] = { 25 };
      setup_unit_stats(ADDR_UNIT2, ADDR_STATLIST1, ADDR_STAT_ARR1, fkeys, fvals1, 1, ADDR_STAT_ARR1, fkeys, fvals1, 1);
      setup_unit_stats(ADDR_UNIT3, ADDR_STATLIST2, ADDR_STAT_ARR2, fkeys, fvals2, 1, ADDR_STAT_ARR2, fkeys, fvals2, 1);
      int n = build_ranges(pre, TBL_ITEMS, isc_ids, 2);
      uint32_t args[3] = { cases[i].ptr, cases[i].stat_id, ADDR_SCRATCH };
      capture_pre(pre, n, pre_bufs);
      call_stdcall3(va, args[0], args[1], args[2]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 3, 0u, 0u, pre, n, pre_bufs, post_sum, 1);
    }
  }

  /* 10. 0x6FD767C0 ITEMS_RollRandomInRangeCallback (fastcall ecx=nMin, edx=nMax, [esp+4]=_u0, [esp+8]=ppItemCtx -> i32) */
  {
    const uint32_t va = 0x6FD767C0u;
    const char *nm = "ITEMS_RollRandomInRangeCallback";
    RangeSpec post_seed[1] = { { ADDR_UNIT + 0x20u, 8u } };
    clear_arena();
    w32(ADDR_SCRATCH, ADDR_UNIT);
    w32(ADDR_UNIT + 0x20u, 0x12345678u);
    w32(ADDR_UNIT + 0x24u, 0x0000029Au);
    int n = build_ranges(pre, 0u, NULL, 0);
    uint32_t args_null[4] = { 5u, 15u, 0u, 0u };
    capture_pre(pre, n, pre_bufs);
    uint32_t eax0 = call_fastcall4(va, args_null[0], args_null[1], args_null[2], args_null[3]);
    emit_ndjson_line(fp, va, nm, "null_ctx_returns_0", args_null, 4, 0xFFFFFFFFu, eax0, pre, n, pre_bufs, post_empty, 0);

    uint32_t args_valid[4] = { 5u, 25u, 0u, ADDR_SCRATCH };
    capture_pre(pre, n, pre_bufs);
    uint32_t eax1 = call_fastcall4(va, args_valid[0], args_valid[1], args_valid[2], args_valid[3]);
    emit_ndjson_line(fp, va, nm, "valid_ctx_rolls_unit_seed", args_valid, 4, 0xFFFFFFFFu, eax1, pre, n, pre_bufs, post_seed, 1);
  }

  /* 11. 0x6FD76930 ITEMS_AreStackableWeaponsCompatible (stdcall pItem1, pItem2 -> BOOL) */
  {
    const uint32_t va = 0x6FD76930u;
    const char *nm = "ITEMS_AreStackableWeaponsCompatible";
    uint32_t isc_ids[7] = { 0x15u, 0x16u, 0x17u, 0x18u, 0x9Fu, 0xA0u, 0xC2u };
    struct {
      const char *id;
      uint32_t cid2;
      uint32_t qual1;
      uint32_t qual2;
      uint32_t cell2;
      uint32_t cid1;
      uint32_t cmd2;
      int32_t dmg2;
      int32_t sock2;
    } cases[] = {
      { "superior_quality3_compatible_returns_1", 0u, 3u, 3u, 0u, 0u, 0u, 10, 0 },
      { "class_id_mismatch_returns_0", 1u, 2u, 2u, 0u, 0u, 0u, 10, 0 },
      { "quality_mismatch_returns_0", 0u, 2u, 3u, 0u, 0u, 0u, 10, 0 },
      { "item_cell_mismatch_returns_0", 0u, 2u, 2u, 1u, 0u, 0u, 10, 0 },
      { "non_two_handed_flag_returns_0", 4u, 2u, 2u, 0u, 4u, 0u, 10, 0 },
      { "ethereal_mismatch_returns_0", 0u, 2u, 2u, 0u, 0u, 0x400000u, 10, 0 },
      { "non_tradable_quality4_returns_0", 0u, 4u, 4u, 0u, 0u, 0u, 10, 0 },
      { "damage_stat_mismatch_returns_0", 0u, 2u, 2u, 0u, 0u, 0u, 99, 0 },
      { "nonzero_max_sockets_returns_0", 0u, 2u, 2u, 0u, 0u, 0u, 10, 2 },
      { "compatible_stackable_weapons_returns_1", 0u, 2u, 2u, 0u, 0u, 0u, 10, 0 },
      { "second_unit_non_item_qual1_3_returns_0", 0u, 3u, 3u, 0u, 0u, 0u, 10, 0 }
    };
    for (int i = 0; i < 11; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 4u);
      w32(ADDR_UNIT + 0x04u, cases[i].cid1);
      w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
      w32(ADDR_ITEMDATA1 + 0x00u, cases[i].qual1);
      w32(ADDR_ITEMDATA1 + 0x28u, 0u);

      w32(ADDR_UNIT2 + 0x00u, i == 10 ? 1u : 4u);
      w32(ADDR_UNIT2 + 0x04u, cases[i].cid2);
      w32(ADDR_UNIT2 + 0x14u, ADDR_ITEMDATA2);
      w32(ADDR_ITEMDATA2 + 0x00u, cases[i].qual2);
      w32(ADDR_ITEMDATA2 + 0x18u, cases[i].cmd2);
      w32(ADDR_ITEMDATA2 + 0x28u, cases[i].cell2);

      uint32_t fkeys1[1] = { 0x15u << 16 };
      int32_t fvals1[1] = { 10 };
      uint32_t fkeys2[2] = { 0x15u << 16, 0xC2u << 16 };
      int32_t fvals2[2] = { cases[i].dmg2, cases[i].sock2 };
      setup_unit_stats(ADDR_UNIT, ADDR_STATLIST1, ADDR_STAT_ARR1, fkeys1, fvals1, 1, ADDR_STAT_ARR1, fkeys1, fvals1, 1);
      setup_unit_stats(ADDR_UNIT2, ADDR_STATLIST2, ADDR_STAT_ARR2, fkeys2, fvals2, 2, ADDR_STAT_ARR2, fkeys2, fvals2, 2);
      int n = build_ranges(pre, TBL_ITEMS, isc_ids, 7);
      uint32_t args[2] = { ADDR_UNIT, ADDR_UNIT2 };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall2(va, args[0], args[1]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 2, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 12. 0x6FD76BA0 ITEMS_FindMatchingRunesTxtRecord (stdcall pItem -> ptr) */
  {
    const uint32_t va = 0x6FD76BA0u;
    const char *nm = "ITEMS_FindMatchingRunesTxtRecord";
    uint32_t isc_ids[1] = { 0xC2u };
    struct {
      const char *id;
      uint32_t ptr;
      uint32_t qual;
      uint32_t cid;
      int32_t max_sock;
      uint32_t rune2_cid;
    } cases[] = {
      { "null_returns_0", 0u, 2u, 0u, 2, 4u },
      { "magic_quality4_returns_0", ADDR_UNIT, 4u, 0u, 2, 4u },
      { "quest_item_row3_returns_0", ADDR_UNIT, 2u, 3u, 2, 4u },
      { "socket_count_mismatch_returns_0", ADDR_UNIT, 2u, 0u, 3, 4u },
      { "rune_sequence_mismatch_returns_0", ADDR_UNIT, 2u, 0u, 2, 1u },
      { "matching_runeword_returns_row1_ptr", ADDR_UNIT, 2u, 0u, 2, 4u }
    };
    for (int i = 0; i < 6; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 4u);
      w32(ADDR_UNIT + 0x04u, cases[i].cid);
      w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
      w32(ADDR_ITEMDATA1 + 0x00u, cases[i].qual);
      w32(ADDR_UNIT + 0x60u, ADDR_INV1);
      w32(ADDR_INV1 + 0x00u, 0x01020304u);
      w32(ADDR_INV1 + 0x0Cu, ADDR_UNIT2);
      w32(ADDR_UNIT2 + 0x00u, 4u);
      w32(ADDR_UNIT2 + 0x04u, 1u);
      w32(ADDR_UNIT2 + 0x14u, ADDR_ITEMDATA2);
      w32(ADDR_ITEMDATA2 + 0x64u, ADDR_UNIT3);
      w32(ADDR_UNIT3 + 0x00u, 4u);
      w32(ADDR_UNIT3 + 0x04u, cases[i].rune2_cid);
      w32(ADDR_UNIT3 + 0x14u, ADDR_ITEMDATA3);
      uint32_t fkeys[1] = { 0xC2u << 16 };
      int32_t fvals[1] = { cases[i].max_sock };
      setup_unit_stats(ADDR_UNIT, ADDR_STATLIST1, ADDR_STAT_ARR1, fkeys, fvals, 1, ADDR_STAT_ARR1, fkeys, fvals, 1);
      int n = build_ranges(pre, TBL_ITEMS | TBL_TYPES | TBL_RUNES, isc_ids, 1);
      uint32_t args[1] = { cases[i].ptr };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 1, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 13. 0x6FD76D40 ITEMS_CanItemLoseDurability (stdcall pItem -> BOOL) */
  {
    const uint32_t va = 0x6FD76D40u;
    const char *nm = "ITEMS_CanItemLoseDurability";
    uint32_t isc_ids[2] = { 0x49u, 0x98u };
    struct {
      const char *id;
      uint32_t ptr;
      uint32_t cid;
      int32_t max_dur;
      int32_t indestruct;
    } cases[] = {
      { "null_returns_0", 0u, 0u, 20, 0 },
      { "no_durability_flag_row1_returns_0", ADDR_UNIT, 1u, 20, 0 },
      { "zero_durability_row2_returns_0", ADDR_UNIT, 2u, 20, 0 },
      { "zero_maxdur_stat_returns_0", ADDR_UNIT, 0u, 0, 0 },
      { "indestructible_stat_returns_0", ADDR_UNIT, 0u, 25, 1 },
      { "normal_durable_item_returns_1", ADDR_UNIT, 0u, 25, 0 }
    };
    for (int i = 0; i < 6; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 4u);
      w32(ADDR_UNIT + 0x04u, cases[i].cid);
      uint32_t fkeys[2] = { 0x49u << 16, 0x98u << 16 };
      int32_t fvals[2] = { cases[i].max_dur, cases[i].indestruct };
      setup_unit_stats(ADDR_UNIT, ADDR_STATLIST1, ADDR_STAT_ARR1, fkeys, fvals, 2, ADDR_STAT_ARR2, fkeys, fvals, 2);
      int n = build_ranges(pre, TBL_ITEMS, isc_ids, 2);
      uint32_t args[1] = { cases[i].ptr };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 1, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 14. 0x6FD77120 ITEMS_EvalItemStatCallback (fastcall ecx=nStatId, edx=nMode, [esp+4]=_u0, [esp+8]=ppItemCtx -> i32) */
  {
    const uint32_t va = 0x6FD77120u;
    const char *nm = "ITEMS_EvalItemStatCallback";
    uint32_t isc_ids[3] = { 0x00u, 0x02u, 0x13u };
    struct {
      const char *id;
      uint32_t stat_id;
      uint32_t mode;
      uint32_t ctx;
    } cases[] = {
      { "null_ctx_returns_0", 0u, 0u, 0u },
      { "out_of_range_stat_returns_0", 500u, 0u, ADDR_SCRATCH },
      { "stat_0x13_tohit_uses_player_base_tohit", 0x13u, 0u, ADDR_SCRATCH },
      { "mode1_reads_base_stat", 0x00u, 1u, ADDR_SCRATCH },
      { "mode2_reads_total_stat_fast", 0x00u, 2u, ADDR_SCRATCH },
      { "mode0_reads_total_stat", 0x00u, 0u, ADDR_SCRATCH }
    };
    for (int i = 0; i < 6; i++) {
      clear_arena();
      w32(ADDR_SCRATCH, ADDR_UNIT);
      w32(ADDR_UNIT + 0x00u, 0u); /* UNIT_PLAYER, class 0 (Amazon) */
      uint32_t bkeys[3] = { 0x00u << 16, 0x02u << 16, 0x13u << 16 };
      int32_t bvals[3] = { 12, 20, 30 };
      int32_t fvals[3] = { 35, 20, 30 };
      setup_unit_stats(ADDR_UNIT, ADDR_STATLIST1, ADDR_STAT_ARR1, bkeys, bvals, 3, ADDR_STAT_ARR2, bkeys, fvals, 3);
      int n = build_ranges(pre, 0u, isc_ids, 3);
      uint32_t args[4] = { cases[i].stat_id, cases[i].mode, 0u, cases[i].ctx };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_fastcall4(va, args[0], args[1], args[2], args[3]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 4, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 15. 0x6FD821C0 ITEMS_GetActiveWeaponClassCodeIdx (fastcall ecx=pUnit -> u16) */
  {
    const uint32_t va = 0x6FD821C0u;
    const char *nm = "ITEMS_GetActiveWeaponClassCodeIdx";
    clear_arena();
    w32(ADDR_UNIT + 0x00u, 0u);
    int n0 = build_ranges(pre, TBL_ITEMS, NULL, 0);
    uint32_t args0[1] = { ADDR_UNIT };
    capture_pre(pre, n0, pre_bufs);
    uint32_t eax0 = call_fastcall1(va, args0[0]);
    emit_ndjson_line(fp, va, nm, "no_weapon_returns_0", args0, 1, 0xFFFFFFFFu, eax0, pre, n0, pre_bufs, post_empty, 0);

    clear_arena();
    w32(ADDR_UNIT + 0x00u, 0u);
    w32(ADDR_UNIT + 0x60u, ADDR_INV1);
    w32(ADDR_INV1 + 0x00u, 0x01020304u);
    w32(ADDR_INV1 + 0x14u, ADDR_GRID_ARR);
    w32(ADDR_INV1 + 0x18u, 1u);
    w32(ADDR_INV1 + 0x1Cu, 101u);
    w8(ADDR_GRID_ARR + 0x08u, 13u);
    w8(ADDR_GRID_ARR + 0x09u, 1u);
    w32(ADDR_GRID_ARR + 0x0Cu, ADDR_GRID_ITEMS);
    w32(ADDR_GRID_ITEMS + 0x10u, ADDR_UNIT2);
    w32(ADDR_UNIT2 + 0x00u, 4u);
    w32(ADDR_UNIT2 + 0x04u, 0u);
    w32(ADDR_UNIT2 + 0x0Cu, 101u);
    w32(ADDR_UNIT2 + 0x14u, ADDR_ITEMDATA2);
    w8(ADDR_ITEMDATA2 + 0x44u, 4u);
    int n1 = build_ranges(pre, TBL_ITEMS | TBL_TYPES, NULL, 0);
    capture_pre(pre, n1, pre_bufs);
    uint32_t eax1 = call_fastcall1(va, args0[0]);
    emit_ndjson_line(fp, va, nm, "equipped_1hs_returns_idx_2", args0, 1, 0xFFFFFFFFu, eax1, pre, n1, pre_bufs, post_empty, 0);
  }

  /* 16. 0x6FD821E0 ITEMS_GetUnitHitClass (fastcall ecx=pUnit -> u8) */
  {
    const uint32_t va = 0x6FD821E0u;
    const char *nm = "ITEMS_GetUnitHitClass";
    struct {
      const char *id;
      uint32_t ptr;
      uint32_t utype;
      uint32_t cid;
      uint32_t has_weap;
    } cases[] = {
      { "null_returns_0", 0u, 0u, 0u, 0u },
      { "player_unarmed_returns_1", ADDR_UNIT, 0u, 0u, 0u },
      { "player_with_weapon_returns_9", ADDR_UNIT, 0u, 0u, 1u },
      { "monster_row1_returns_42", ADDR_UNIT, 1u, 1u, 0u },
      { "object_unit_returns_0", ADDR_UNIT, 2u, 0u, 0u }
    };
    for (int i = 0; i < 5; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, cases[i].utype);
      w32(ADDR_UNIT + 0x04u, cases[i].cid);
      if (cases[i].has_weap) {
        w32(ADDR_UNIT + 0x60u, ADDR_INV1);
        w32(ADDR_INV1 + 0x00u, 0x01020304u);
        w32(ADDR_INV1 + 0x14u, ADDR_GRID_ARR);
        w32(ADDR_INV1 + 0x18u, 1u);
        w32(ADDR_INV1 + 0x1Cu, 101u);
        w8(ADDR_GRID_ARR + 0x08u, 13u);
        w8(ADDR_GRID_ARR + 0x09u, 1u);
        w32(ADDR_GRID_ARR + 0x0Cu, ADDR_GRID_ITEMS);
        w32(ADDR_GRID_ITEMS + 0x10u, ADDR_UNIT2);
        w32(ADDR_UNIT2 + 0x00u, 4u);
        w32(ADDR_UNIT2 + 0x04u, 0u);
        w32(ADDR_UNIT2 + 0x0Cu, 101u);
        w32(ADDR_UNIT2 + 0x14u, ADDR_ITEMDATA2);
        w8(ADDR_ITEMDATA2 + 0x44u, 4u);
      }
      int n = build_ranges(pre, TBL_ITEMS | TBL_TYPES | TBL_MON, NULL, 0);
      uint32_t args[1] = { cases[i].ptr };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_fastcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 1, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_empty, 0);
    }
  }

  /* 17. 0x6FD965B0 ITEMS_RollItemOrUnitSeedRange (eax=nMax, ecx=nMin, edx=pUnit -> i32) */
  {
    const uint32_t va = 0x6FD965B0u;
    const char *nm = "ITEMS_RollItemOrUnitSeedRange";
    RangeSpec post_seeds[2] = {
      { ADDR_UNIT + 0x20u, 8u },
      { ADDR_ITEMDATA1 + 0x04u, 8u }
    };
    struct {
      const char *id;
      int32_t max_v;
      int32_t min_v;
      uint32_t utype;
    } cases[] = {
      { "equal_min_max_returns_min", 10, 10, 4u },
      { "item_unit_rolls_itemdata_seed", 50, 10, 4u },
      { "swapped_min_max_player_unit_rolls_unit_seed", 5, 30, 0u }
    };
    for (int i = 0; i < 3; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, cases[i].utype);
      w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
      w32(ADDR_UNIT + 0x20u, 0x13579BDFu);
      w32(ADDR_UNIT + 0x24u, 0x0000029Au);
      w32(ADDR_ITEMDATA1 + 0x04u, 0x2468ACE0u);
      w32(ADDR_ITEMDATA1 + 0x08u, 0x0000029Au);
      int n = build_ranges(pre, 0u, NULL, 0);
      uint32_t args[3] = { (uint32_t)cases[i].max_v, (uint32_t)cases[i].min_v, ADDR_UNIT };
      capture_pre(pre, n, pre_bufs);
      uint32_t eax = call_eax_ecx_edx_ret(va, args[0], args[1], args[2]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 3, 0xFFFFFFFFu, eax, pre, n, pre_bufs, post_seeds, 2);
    }
  }

  /* 18 (B043-1). 0x6FD88FF0 ITEMS_B043_GetMaxDurabilityFromUnit (stdcall pUnit -> i32) */
  {
    const uint32_t va = 0x6FD88FF0u;
    const char *nm = "ITEMS_B043_GetMaxDurabilityFromUnit";
    uint32_t isc_ids[1] = { 0x49u };
    clear_arena();
    uint32_t bkeys[1] = { 0x49u << 16 };
    int32_t bvals[1] = { 20 };
    int32_t fvals[1] = { 35 };
    setup_unit_stats(ADDR_UNIT, ADDR_STATLIST1, ADDR_STAT_ARR1, bkeys, bvals, 1, ADDR_STAT_ARR2, bkeys, fvals, 1);
    int n = build_ranges(pre, 0u, isc_ids, 1);
    uint32_t args0[1] = { 0u };
    capture_pre(pre, n, pre_bufs);
    uint32_t eax0 = call_stdcall1(va, args0[0]);
    emit_ndjson_line(fp, va, nm, "null_returns_0", args0, 1, 0xFFFFFFFFu, eax0, pre, n, pre_bufs, post_empty, 0);

    uint32_t args1[1] = { ADDR_UNIT };
    capture_pre(pre, n, pre_bufs);
    uint32_t eax1 = call_stdcall1(va, args1[0]);
    emit_ndjson_line(fp, va, nm, "valid_unit_returns_total_maxdur_35", args1, 1, 0xFFFFFFFFu, eax1, pre, n, pre_bufs, post_empty, 0);

    clear_arena();
    w32(ADDR_DATATABLES + 0xBD4u, 0x49u);
    setup_unit_stats(ADDR_UNIT, ADDR_STATLIST1, ADDR_STAT_ARR1, bkeys, bvals, 1, ADDR_STAT_ARR2, bkeys, fvals, 1);
    int n2 = build_ranges(pre, 0u, isc_ids, 1);
    capture_pre(pre, n2, pre_bufs);
    uint32_t eax2 = call_stdcall1(va, args1[0]);
    emit_ndjson_line(fp, va, nm, "isc_count_0x49_returns_0", args1, 1, 0xFFFFFFFFu, eax2, pre, n2, pre_bufs, post_empty, 0);
  }

  /* 19 (B043-2). 0x6FD89380 ITEMS_B043_GetStatDiffAfterClear (eax=pStatList, esi=nStatId, [esp+4]=wLayer -> i32) */
  {
    const uint32_t va = 0x6FD89380u;
    const char *nm = "ITEMS_B043_GetStatDiffAfterClear";
    uint32_t isc_ids[2] = { 0x00u, 0x02u };
    clear_arena();
    uint32_t bkeys[2] = { 0x00u << 16, (0x02u << 16) | 3u };
    int32_t bvals[2] = { 10, 12 };
    int32_t fvals[2] = { 28, 37 };
    setup_unit_stats(ADDR_UNIT, ADDR_STATLIST1, ADDR_STAT_ARR1, bkeys, bvals, 2, ADDR_STAT_ARR2, bkeys, fvals, 2);
    int n = build_ranges(pre, 0u, isc_ids, 2);
    uint32_t args0[3] = { 0u, 0u, 0u };
    capture_pre(pre, n, pre_bufs);
    uint32_t eax0 = call_eax_esi_stack1_ret4(va, args0[0], args0[1], args0[2]);
    emit_ndjson_line(fp, va, nm, "null_statlist_returns_0", args0, 3, 0xFFFFFFFFu, eax0, pre, n, pre_bufs, post_empty, 0);

    uint32_t args1[3] = { ADDR_STATLIST1, 0u, 0u };
    capture_pre(pre, n, pre_bufs);
    uint32_t eax1 = call_eax_esi_stack1_ret4(va, args1[0], args1[1], args1[2]);
    emit_ndjson_line(fp, va, nm, "returns_total_minus_base_18", args1, 3, 0xFFFFFFFFu, eax1, pre, n, pre_bufs, post_empty, 0);

    uint32_t args2[3] = { ADDR_STATLIST1, 2u, 3u };
    capture_pre(pre, n, pre_bufs);
    uint32_t eax2 = call_eax_esi_stack1_ret4(va, args2[0], args2[1], args2[2]);
    emit_ndjson_line(fp, va, nm, "nonzero_stat2_layer3_returns_25", args2, 3, 0xFFFFFFFFu, eax2, pre, n, pre_bufs, post_empty, 0);

    uint32_t args3[3] = { ADDR_STATLIST1, 360u, 0u };
    capture_pre(pre, n, pre_bufs);
    uint32_t eax3 = call_eax_esi_stack1_ret4(va, args3[0], args3[1], args3[2]);
    emit_ndjson_line(fp, va, nm, "stat_equal_isccount_returns_0", args3, 3, 0xFFFFFFFFu, eax3, pre, n, pre_bufs, post_empty, 0);
  }

  /* 20 (B043-3). 0x6FD89430 ITEMS_B043_GetTotalStatFromUnitFast (stdcall pUnit, nStatId, wLayer -> i32) */
  {
    const uint32_t va = 0x6FD89430u;
    const char *nm = "ITEMS_B043_GetTotalStatFromUnitFast";
    uint32_t isc_ids[2] = { 0x00u, 0x02u };
    clear_arena();
    uint32_t bkeys[2] = { 0x00u << 16, (0x02u << 16) | 3u };
    int32_t bvals[2] = { 10, 15 };
    int32_t fvals[2] = { 42, 65 };
    setup_unit_stats(ADDR_UNIT, ADDR_STATLIST1, ADDR_STAT_ARR1, bkeys, bvals, 2, ADDR_STAT_ARR2, bkeys, fvals, 2);
    int n = build_ranges(pre, 0u, isc_ids, 2);
    uint32_t args0[3] = { ADDR_UNIT2, 0u, 0u };
    capture_pre(pre, n, pre_bufs);
    uint32_t eax0 = call_stdcall3(va, args0[0], args0[1], args0[2]);
    emit_ndjson_line(fp, va, nm, "no_statlist_returns_0", args0, 3, 0xFFFFFFFFu, eax0, pre, n, pre_bufs, post_empty, 0);

    uint32_t args1[3] = { ADDR_UNIT, 0u, 0u };
    capture_pre(pre, n, pre_bufs);
    uint32_t eax1 = call_stdcall3(va, args1[0], args1[1], args1[2]);
    emit_ndjson_line(fp, va, nm, "valid_unit_returns_42", args1, 3, 0xFFFFFFFFu, eax1, pre, n, pre_bufs, post_empty, 0);

    uint32_t args2[3] = { ADDR_UNIT, 2u, 3u };
    capture_pre(pre, n, pre_bufs);
    uint32_t eax2 = call_stdcall3(va, args2[0], args2[1], args2[2]);
    emit_ndjson_line(fp, va, nm, "nonzero_stat2_layer3_returns_65", args2, 3, 0xFFFFFFFFu, eax2, pre, n, pre_bufs, post_empty, 0);
  }
}

int main(int argc, char **argv) {
  const char *dll_dir = (argc > 1) ? argv[1] : ".";
  const char *out_b039 = (argc > 2) ? argv[2] : "b039-vectors.ndjson";
  const char *out_b049 = (argc > 3) ? argv[3] : "b049-vectors.ndjson";
  const char *out_b052 = (argc > 4) ? argv[4] : "b052-vectors.ndjson";

  SetDllDirectoryA(dll_dir);
  LoadLibraryA("Storm.dll");
  HMODULE hFog = LoadLibraryA("Fog.dll");
  HMODULE hD2Common = LoadLibraryA("D2Common.dll");
  if (!hFog || !hD2Common) {
    fprintf(stderr, "Failed to load Fog.dll / D2Common.dll from %s\n", dll_dir);
    return 1;
  }
  if ((uintptr_t)hFog != 0x6FF50000u || (uintptr_t)hD2Common != 0x6FD50000u) {
    fprintf(stderr, "Unexpected DLL base: Fog=%p D2Common=%p\n", (void *)hFog, (void *)hD2Common);
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

  DWORD old_prot = 0;
  VirtualProtect((void *)(uintptr_t)0x6FDD9000u, 0x19000u, PAGE_READWRITE, &old_prot);
  w32(0x6FDD90D0u, (uint32_t)(uintptr_t)&stub_fog_10045);
  w32(0x6FDD90CCu, (uint32_t)(uintptr_t)&stub_fog_10046);

  FILE *fp39 = fopen(out_b039, "wb");
  FILE *fp49 = fopen(out_b049, "wb");
  FILE *fp52 = fopen(out_b052, "wb");
  if (!fp39 || !fp49 || !fp52) {
    fprintf(stderr, "Failed to open output files\n");
    return 4;
  }

  emit_b039(fp39);
  emit_b049(fp49);
  emit_b052(fp52);

  fclose(fp39);
  fclose(fp49);
  fclose(fp52);
  printf("Successfully emitted %s, %s, and %s\n", out_b039, out_b049, out_b052);
  return 0;
}
