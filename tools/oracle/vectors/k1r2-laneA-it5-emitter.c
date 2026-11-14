/*
 * Standalone MinGW real-DLL differential vector emitter for Lane A Iteration-5
 * batches B026 (15 pureLeaf functions in unit.ts) and B029 (20 hostImport
 * functions across unit-finds.ts, logging.ts, text.ts, and statlist.ts).
 *
 * Loads the real Diablo II v1.13c Storm.dll, Fog.dll, and D2Common.dll at its
 * canonical image base 0x6FD50000, stages deterministic pre-call memory blocks
 * in a fixed VirtualAlloc arena at 0x20000000 (and bump heap at 0x40000000
 * matching SparseMemory113c.alloc), invokes each real D2Common.dll entry point
 * via exact x86 register/stack thunks, and emits:
 *   - <out_dir>/b026-vectors.ndjson
 *   - <out_dir>/b029-vectors.ndjson
 */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <setjmp.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define ARENA_BASE        0x20000000u
#define ARENA_SIZE        0x00100000u
#define HEAP_BASE         0x40000000u
#define HEAP_SIZE         0x00100000u

/* Deterministic layout within ARENA_BASE (0x20000000) */
#define ADDR_BITMASKS     0x20000100u /* 128 bytes: 32 u32s from Fog gdwBitMasks */
#define ADDR_UNIT         0x20000300u /* 244 bytes: D2UnitStrc */
#define ADDR_UNIT2        0x20000400u /* 244 bytes: D2UnitStrc #2 */
#define ADDR_UNIT3        0x20000500u /* 244 bytes: D2UnitStrc #3 */
#define ADDR_OBJ_DATA     0x20000600u /* 56 bytes: D2ObjectDataStrc */
#define ADDR_ITEM_DATA    0x20000680u /* 116 bytes: D2ItemDataStrc */
#define ADDR_OBJ_TXT      0x20000700u /* 448 bytes: D2ObjectsTxt */
#define ADDR_STATLIST_EX  0x20000900u /* 100 bytes: D2StatListExStrc */
#define ADDR_STATLIST_SUB 0x20000980u /* 60 bytes: D2StatListStrc child #1 */
#define ADDR_STATLIST_SB2 0x200009C0u /* 60 bytes: D2StatListStrc child #2 */
#define ADDR_STATE_FLAGS  0x20000A00u /* 48 bytes: 6 active + 6 gfx state dwords */
#define ADDR_STAT_ARR     0x20000A80u /* 64 bytes: 8 D2StatStrc entries */
#define ADDR_FULL_ARR     0x20000AC0u /* 64 bytes: 8 D2StatStrc entries */
#define ADDR_MOD_ARR      0x20000B00u /* 32 bytes: mod stat entries */
#define ADDR_OUT_BUF      0x20000C00u /* 512 bytes: output buffer */
#define ADDR_HOVER_MSG    0x20000E00u /* 272 bytes: D2HoverTextStrc */
#define ADDR_ROOM1        0x20001000u /* 128 bytes: D2ActiveRoomStrc #1 */
#define ADDR_ROOM2        0x20001080u /* 128 bytes: D2ActiveRoomStrc #2 */
#define ADDR_ROOM3        0x20001100u /* 128 bytes: D2ActiveRoomStrc #3 */
#define ADDR_ROOMS_LIST   0x20001180u /* 16 bytes: ppRoomsNear[4] */
#define ADDR_ROOM_EX      0x20001200u /* 128 bytes: D2RoomExStrc */
#define ADDR_LEVEL        0x20001300u /* 560 bytes: D2DrlgLevelStrc */
#define ADDR_ACT          0x20001580u /* 96 bytes: D2ActStrc */
#define ADDR_DRLG         0x20001600u /* 1164 bytes: D2DrlgStrc */
#define ADDR_FIND_DATA    0x20001B00u /* 48 bytes: D2UnitFindDataStrc */
#define ADDR_TEXT_HDR     0x20001B80u /* 12 bytes: D2TextHeaderStrc */
#define ADDR_TEXT_NODE1   0x20001BC0u /* 12 bytes: D2TextNodeStrc #1 */
#define ADDR_TEXT_NODE2   0x20001BE0u /* 12 bytes: D2TextNodeStrc #2 */
#define ADDR_TEXT_NODES8  0x20001C00u /* 108 bytes: 9 D2TextNodeStrc nodes */
#define ADDR_SCRATCH      0x20001D00u /* 256 bytes: scratch strings/args */

#define ADDR_DATATABLES   0x20002000u /* 0x1000 bytes: synthetic D2DataTablesStrc */
#define ADDR_MONSTATS     0x20003000u /* 4 * 0x1A8 (424) = 1696 bytes */
#define ADDR_CHARSTATS    0x20003800u /* 4 * 0xC4  (196) = 784 bytes */
#define ADDR_STATEMASKS   0x20003C00u /* 3 * 24 bytes: OnCurse(+0), Exp(+32), Aura(+64) */
#define ADDR_ISC_TABLE    0x20004000u /* 80 * 0x144 (324) = 25920 bytes */

/* D2Common.dll canonical VAs (ImageBase = 0x6FD50000) */
#define VA_SGPT_DATATABLES 0x6FDE9E1Cu
#define VA_GDWBITMASKS_IAT 0x6FDD90B0u
#define VA_WEAP_PLAYER     0x6FDDC608u
#define VA_WEAP_MON_CLAS   0x6FDDC788u
#define VA_WEAP_MON_EXP    0x6FDDC8C8u
#define VA_ACT_LEVEL_IDS   0x6FDE4084u
#define VA_LOG_ENABLED     0x6FDF1474u
#define VA_LANG_SHADOW     0x6FDF1478u
#define VA_GFX_CELL_CNT    0x6FDEEFA0u
#define VA_GFX_CELL_TBL    0x6FDEEFA4u

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

typedef struct {
  uint32_t addr;
  uint32_t size;
} HeapAllocRec;

static HeapAllocRec g_allocs[64];
static int g_num_allocs = 0;

static void reset_heap(void) {
  memset((void *)(uintptr_t)HEAP_BASE, 0, 0x10000u);
  g_heap_next = HEAP_BASE;
  g_num_allocs = 0;
}

static uint32_t bump_alloc(uint32_t size) {
  uint32_t ptr = (g_heap_next + 3u) & ~3u;
  g_heap_next = (ptr + size) & 0xFFFFFFFFu;
  memset((void *)(uintptr_t)ptr, 0, size);
  if (g_num_allocs < 64) {
    g_allocs[g_num_allocs].addr = ptr;
    g_allocs[g_num_allocs].size = size;
    g_num_allocs++;
  }
  return ptr;
}

static uint32_t find_alloc_size(uint32_t ptr) {
  for (int i = 0; i < g_num_allocs; i++) {
    if (g_allocs[i].addr == ptr) return g_allocs[i].size;
  }
  return 0;
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

/* Fog.#10046 (0x6FDD90CC): FOG_FreeServerMemory(ecx=pMemPool, edx=pMem, szFile, nLine, nZero), ret 0xC */
static int __fastcall stub_fog_10046(
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
  return 1;
}

/* Fog.#10047 (0x6FDD90AC): FOG_ReallocServerMemory(ecx=pMemPool, edx=pMem, dwSize, szFile, nLine, nZero), ret 0x10 */
static void *__fastcall stub_fog_10047(
  void *pMemPool,
  void *pMem,
  uint32_t dwSize,
  const char *szFile,
  int nLine,
  int nZero
) {
  (void)pMemPool;
  (void)szFile;
  (void)nLine;
  (void)nZero;
  uint32_t new_ptr = bump_alloc(dwSize);
  if (pMem != NULL) {
    uint32_t old_size = find_alloc_size((uint32_t)(uintptr_t)pMem);
    if (old_size == 0 && dwSize >= 60u) {
      old_size = dwSize - 60u;
    }
    uint32_t copy_len = old_size < dwSize ? old_size : dwSize;
    if (copy_len > 0) {
      memcpy((void *)(uintptr_t)new_ptr, pMem, copy_len);
    }
  }
  return (void *)(uintptr_t)new_ptr;
}

/* D2Lang.#10009 (0x6FDD904C): D2Lang_GetTblIndex(), stdcall 0 args -> eax */
static uint32_t __stdcall stub_d2lang_10009(void) {
  return (uint32_t)(*(uint8_t *)(uintptr_t)VA_LANG_SHADOW);
}

/* =========================================================================
 * Custom LTCG & stdcall Assembly Thunks (Register-Only Constraints!)
 * ========================================================================= */

/* eax=a0, ecx=a1, plain ret -> eax (0x6FD7EF90, 0x6FD7EFC0, 0x6FD7F010) */
static __attribute__((noinline)) uint32_t call_eax_ecx_ret(uintptr_t fn, uint32_t a0, uint32_t a1) {
  uint32_t out;
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "=a"(out), "+c"(a1)
    : "a"(a0), [fn]"d"(fn)
    : "memory", "cc"
  );
  return out;
}

/* eax=a0, ecx=a1, [esp+4]=a2, ret 4 -> eax (0x6FD7FAC0) */
static __attribute__((noinline)) uint32_t call_eax_ecx_stack1_ret4(
  uintptr_t fn,
  uint32_t a0,
  uint32_t a1,
  uint32_t a2
) {
  uint32_t out;
  __asm__ volatile(
    "pushl %[s0]\n\t"
    "call *%[fn]\n\t"
    : "=a"(out), "+c"(a1), [s0]"+d"(a2)
    : "a"(a0), [fn]"S"(fn)
    : "memory", "cc"
  );
  return out;
}

/* ecx=a0, eax=a1, edx=a2, plain ret -> eax (0x6FD7FB10) */
static __attribute__((noinline)) uint32_t call_ecx_eax_edx_ret(
  uintptr_t fn,
  uint32_t ecx_in,
  uint32_t eax_in,
  uint32_t edx_in
) {
  uint32_t out;
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "=a"(out), "+c"(ecx_in), "+d"(edx_in)
    : "a"(eax_in), [fn]"S"(fn)
    : "memory", "cc"
  );
  return out;
}

/* ecx=a0, eax=a1, plain ret -> eax (0x6FD80D50) */
static __attribute__((noinline)) uint32_t call_ecx_eax_ret(
  uintptr_t fn,
  uint32_t ecx_in,
  uint32_t eax_in
) {
  uint32_t out;
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "=a"(out), "+c"(ecx_in)
    : "a"(eax_in), [fn]"S"(fn)
    : "edx", "memory", "cc"
  );
  return out;
}

/* esi=a0, plain ret -> eax (0x6FD620F0) */
static __attribute__((noinline)) uint32_t call_esi_ret(uintptr_t fn, uint32_t esi_in) {
  uint32_t out;
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "=a"(out), "+S"(esi_in)
    : [fn]"c"(fn)
    : "edx", "ebx", "edi", "memory", "cc"
  );
  return out;
}

/* eax=a0, [esp+4]=a1, ret 4 -> void (0x6FD82E10) */
static __attribute__((noinline)) void call_eax_stack1_ret4(
  uintptr_t fn,
  uint32_t eax_in,
  uint32_t stack0
) {
  uint32_t out;
  __asm__ volatile(
    "pushl %[s0]\n\t"
    "call *%[fn]\n\t"
    : "=a"(out), [s0]"+c"(stack0)
    : "a"(eax_in), [fn]"d"(fn)
    : "ebx", "esi", "edi", "memory", "cc"
  );
}

/* ecx=a0, plain ret -> void (0x6FD8A9F0) */
static __attribute__((noinline)) void call_ecx_ret_void(uintptr_t fn, uint32_t ecx_in) {
  uint32_t out;
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "=a"(out), "+c"(ecx_in)
    : [fn]"d"(fn)
    : "ebx", "esi", "edi", "memory", "cc"
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

static uint32_t call_stdcall4(uintptr_t fn, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3) {
  typedef uint32_t (__stdcall *Fn4)(uint32_t, uint32_t, uint32_t, uint32_t);
  return ((Fn4)fn)(a0, a1, a2, a3);
}

static uint32_t call_stdcall8(
  uintptr_t fn,
  uint32_t a0,
  uint32_t a1,
  uint32_t a2,
  uint32_t a3,
  uint32_t a4,
  uint32_t a5,
  uint32_t a6,
  uint32_t a7
) {
  typedef uint32_t (__stdcall *Fn8)(
    uint32_t, uint32_t, uint32_t, uint32_t,
    uint32_t, uint32_t, uint32_t, uint32_t
  );
  return ((Fn8)fn)(a0, a1, a2, a3, a4, a5, a6, a7);
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

static void emit_ndjson_line_ex(
  FILE *fp,
  uint32_t va,
  const char *name,
  const char *case_id,
  const uint32_t *args,
  int n_args,
  uint32_t ret_mask,
  uint32_t out_eax,
  int asserted,
  uint32_t assert_line,
  const RangeSpec *pre_ranges,
  int n_pre,
  uint8_t **pre_bufs,
  const RangeSpec *post_ranges,
  int n_post
) {
  fprintf(fp, "{\"va\":\"0x%08X\",\"name\":\"%s\",\"caseId\":\"%s\",\"args\":[", va, name, case_id);
  for (int i = 0; i < n_args; i++) {
    if (i > 0) fprintf(fp, ",");
    fprintf(fp, "%u", args[i]);
  }
  fprintf(
    fp,
    "],\"retMask\":%u,\"eax\":%u,\"asserted\":%d,\"assertLine\":%u,\"pre\":[",
    ret_mask,
    asserted ? 0u : (out_eax & ret_mask),
    asserted,
    asserted ? assert_line : 0u
  );
  for (int i = 0; i < n_pre; i++) {
    if (i > 0) fprintf(fp, ",");
    fprintf(fp, "{\"addr\":%u,\"hex\":\"", pre_ranges[i].addr);
    write_hex(fp, pre_bufs[i], pre_ranges[i].len);
    fprintf(fp, "\"}");
    free(pre_bufs[i]);
  }
  fprintf(fp, "],\"post\":[");
  if (!asserted) {
    for (int i = 0; i < n_post; i++) {
      if (i > 0) fprintf(fp, ",");
      fprintf(fp, "{\"addr\":%u,\"hex\":\"", post_ranges[i].addr);
      write_hex(fp, (const uint8_t *)(uintptr_t)post_ranges[i].addr, post_ranges[i].len);
      fprintf(fp, "\"}");
    }
  }
  fprintf(fp, "]}\n");
}

static void setup_it5_datatables(void) {
  memset((void *)(uintptr_t)ADDR_DATATABLES, 0, 0x1000u);
  memset((void *)(uintptr_t)ADDR_MONSTATS, 0, 4 * 0x1A8u);
  memset((void *)(uintptr_t)ADDR_CHARSTATS, 0, 4 * 0xC4u);
  memset((void *)(uintptr_t)ADDR_STATEMASKS, 0, 96u);
  memset((void *)(uintptr_t)ADDR_ISC_TABLE, 0, 80 * 0x144u);

  w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);

  w32(ADDR_DATATABLES + 0x0C4, 185u);                   /* nStatesTxtRecordCount */
  w32(ADDR_DATATABLES + 0x0F8, ADDR_STATEMASKS + 64u);  /* fStateMasksAura */
  w32(ADDR_DATATABLES + 0x0FC, ADDR_STATEMASKS + 32u);  /* fStateMasksExp */
  w32(ADDR_DATATABLES + 0x144, ADDR_STATEMASKS + 0u);   /* fStateMasksOnCurse */
  w32(ADDR_DATATABLES + 0xA78, ADDR_MONSTATS);          /* pMonStatsTxt */
  w32(ADDR_DATATABLES + 0xA80, 4u);                     /* nMonStatsTxtRecordCount */
  w32(ADDR_DATATABLES + 0xBC4, ADDR_CHARSTATS);         /* pCharStatsTxt */
  w32(ADDR_DATATABLES + 0xBC8, 4u);                     /* nCharStatsTxtRecordCount */
  w32(ADDR_DATATABLES + 0xBCC, ADDR_ISC_TABLE);         /* pItemStatCostTxt */
  w32(ADDR_DATATABLES + 0xBD4, 80u);                    /* nItemStatCostTxtRecordCount */

  /* MonStats[0..3]: wVelocity (+0x32), wSeqVelocity (+0x36), wRun (+0x38) */
  w16(ADDR_MONSTATS + 0 * 0x1A8 + 0x32, 6u);
  w16(ADDR_MONSTATS + 0 * 0x1A8 + 0x36, 9u);
  w16(ADDR_MONSTATS + 0 * 0x1A8 + 0x38, 13u);

  w16(ADDR_MONSTATS + 1 * 0x1A8 + 0x32, 8u);
  w16(ADDR_MONSTATS + 1 * 0x1A8 + 0x36, 12u);
  w16(ADDR_MONSTATS + 1 * 0x1A8 + 0x38, 18u);

  w16(ADDR_MONSTATS + 2 * 0x1A8 + 0x32, (uint16_t)-3);
  w16(ADDR_MONSTATS + 2 * 0x1A8 + 0x36, (uint16_t)-5);
  w16(ADDR_MONSTATS + 2 * 0x1A8 + 0x38, (uint16_t)-2);

  /* CharStats[0..3]: nWalkSpeed (+0x40), nRunSpeed (+0x41) */
  w8(ADDR_CHARSTATS + 0 * 0xC4 + 0x40, 6u);
  w8(ADDR_CHARSTATS + 0 * 0xC4 + 0x41, 9u);

  w8(ADDR_CHARSTATS + 1 * 0xC4 + 0x40, 8u);
  w8(ADDR_CHARSTATS + 1 * 0xC4 + 0x41, 12u);

  w8(ADDR_CHARSTATS + 2 * 0xC4 + 0x40, 0u);  /* nWalkSpeed == 0 */
  w8(ADDR_CHARSTATS + 2 * 0xC4 + 0x41, 10u);

  /* StateMasks: OnCurse (+0), Exp (+32), Aura (+64) */
  w32(ADDR_STATEMASKS + 0u + 0u,  0x00000202u); /* bits 1, 9 */
  w32(ADDR_STATEMASKS + 0u + 4u,  0x80000001u); /* bits 32, 63 */
  w32(ADDR_STATEMASKS + 32u + 0u, 0x00000014u); /* bits 2, 4 */
  w32(ADDR_STATEMASKS + 32u + 8u, 0x00010000u); /* bit 80 */
  w32(ADDR_STATEMASKS + 64u + 0u, 0x00000108u); /* bits 3, 8 */
  w32(ADDR_STATEMASKS + 64u + 20u, 0x01000000u); /* bit 184 */
}

/* =========================================================================
 * B026 EMITTER (15 pureLeaf functions in unit.ts)
 * ========================================================================= */
static void emit_b026(FILE *fp) {
  uint8_t *pre[8];
  setup_it5_datatables();

  /* 1. 0x6FD7EE60: UNITS_GetFrameAndFrameCount */
  {
    const uint32_t va = 0x6FD7EE60u;
    const char *nm = "UNITS_GetFrameAndFrameCount";
    RangeSpec r[4] = {
      { ADDR_UNIT, 244 },
      { ADDR_OBJ_DATA, 56 },
      { ADDR_OBJ_TXT, 448 },
      { ADDR_OUT_BUF, 16 },
    };
    RangeSpec post_r[1] = { { ADDR_OUT_BUF, 16 } };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_OBJ_DATA, 0, 56);
      memset((void *)(uintptr_t)ADDR_OBJ_TXT, 0, 448);
      w32(ADDR_OUT_BUF + 0, 0xDEADBEEFu);
      w32(ADDR_OUT_BUF + 4, 0xCAFEBABEu);
      uint32_t uptr = ADDR_UNIT;
      const char *cid = "null_unit";
      if (i == 0) {
        uptr = 0u;
      } else if (i == 1) {
        cid = "player_unit";
        w32(ADDR_UNIT + 0x00, 0u);
        w32(ADDR_UNIT + 0x44, 0x00000580u);
        w32(ADDR_UNIT + 0x48, 0x00001000u);
      } else if (i == 2) {
        cid = "monster_unit";
        w32(ADDR_UNIT + 0x00, 1u);
        w32(ADDR_UNIT + 0x44, 0x00000340u);
        w32(ADDR_UNIT + 0x48, 0x00000C00u);
      } else {
        cid = "object_unit_mode2";
        w32(ADDR_UNIT + 0x00, 2u);
        w32(ADDR_UNIT + 0x10, 2u);
        w32(ADDR_UNIT + 0x14, ADDR_OBJ_DATA);
        w32(ADDR_UNIT + 0x44, 0x00000200u);
        w32(ADDR_UNIT + 0x48, 0x00009999u);
        w32(ADDR_OBJ_DATA + 0x00, ADDR_OBJ_TXT);
        w32(ADDR_OBJ_TXT + 0xD8 + 2 * 4, 0x00000800u);
      }
      uint32_t args[3] = { uptr, ADDR_OUT_BUF, ADDR_OUT_BUF + 4u };
      capture_pre(r, 4, pre);
      call_stdcall3(va, args[0], args[1], args[2]);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 3, 0u, 0u, 0, 0u, r, 4, pre, post_r, 1);
    }
  }

  /* 2..4: 0x6FD7EF90, 0x6FD7EFC0, 0x6FD7F010 */
  {
    struct {
      uint32_t va;
      const char *nm;
      uint32_t p_mode;
      uint32_t m_mode;
    } fns[3] = {
      { 0x6FD7EF90u, "UNITS_IsWalkModeForType",   9u,    6u    },
      { 0x6FD7EFC0u, "UNITS_IsGetHitModeForType", 4u,    3u    },
      { 0x6FD7F010u, "UNITS_IsRunModeForType",    0x13u, 0x0Du },
    };
    for (int f = 0; f < 3; f++) {
      struct { uint32_t ut; uint32_t m; const char *cid; } cases[6] = {
        { 0u, fns[f].p_mode, "player_match" },
        { 0u, 1u,            "player_mismatch" },
        { 1u, fns[f].m_mode, "monster_match" },
        { 1u, 1u,            "monster_mismatch" },
        { 2u, fns[f].p_mode, "object_type" },
        { (uint32_t)-1, fns[f].m_mode, "neg_type" },
      };
      for (int i = 0; i < 6; i++) {
        uint32_t args[2] = { cases[i].ut, cases[i].m };
        uint32_t eax = call_eax_ecx_ret(fns[f].va, args[0], args[1]);
        emit_ndjson_line_ex(fp, fns[f].va, fns[f].nm, cases[i].cid, args, 2, 0xFFFFFFFFu, eax, 0, 0u, NULL, 0, pre, NULL, 0);
      }
    }
  }

  /* 5. 0x6FD7F1B0: UNITS_GetAnimOrSeqMode */
  {
    const uint32_t va = 0x6FD7F1B0u;
    const char *nm = "UNITS_GetAnimOrSeqMode";
    RangeSpec r[1] = { { ADDR_UNIT, 244 } };
    struct { uint32_t uptr; uint32_t ut; uint32_t anim; uint32_t seqp; uint32_t seqm; const char *cid; } cases[6] = {
      { 0u,        0u, 5u, 0u,        9u,  "null_unit" },
      { ADDR_UNIT, 0u, 5u, 0x123456u, 9u,  "player_with_seq" },
      { ADDR_UNIT, 0u, 5u, 0u,        9u,  "player_no_seq" },
      { ADDR_UNIT, 1u, 6u, 0x123456u, 11u, "monster_with_seq" },
      { ADDR_UNIT, 1u, 6u, 0u,        11u, "monster_no_seq" },
      { ADDR_UNIT, 2u, 3u, 0x123456u, 12u, "object_ignores_seq" },
    };
    for (int i = 0; i < 6; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x10, cases[i].anim);
      w32(ADDR_UNIT + 0x30, cases[i].seqp);
      w32(ADDR_UNIT + 0x40, cases[i].seqm);
      uint32_t args[1] = { cases[i].uptr };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, 0, 0u, r, 1, pre, NULL, 0);
    }
  }

  /* 6. 0x6FD7FAC0: UNITS_GetWeaponSpeedAnimRate */
  {
    const uint32_t va = 0x6FD7FAC0u;
    const char *nm = "UNITS_GetWeaponSpeedAnimRate";
    RangeSpec r[3] = {
      { VA_WEAP_PLAYER,   380 },
      { VA_WEAP_MON_CLAS, 320 },
      { VA_WEAP_MON_EXP,  320 },
    };
    struct { uint32_t ut; uint32_t wc; uint32_t cid; const char *name; } cases[6] = {
      { 0u, 0u, 0u,     "player_wc0" },
      { 0u, 5u, 2u,     "player_wc5" },
      { 1u, 0u, 100u,   "mon_classic_wc0" },
      { 1u, 3u, 0x199u, "mon_classic_409" },
      { 1u, 3u, 0x19Au, "mon_exp_410" },
      { 2u, 1u, 0u,     "object_returns_0" },
    };
    for (int i = 0; i < 6; i++) {
      uint32_t args[3] = { cases[i].ut, cases[i].wc, cases[i].cid };
      capture_pre(r, 3, pre);
      uint32_t eax = call_eax_ecx_stack1_ret4(va, args[0], args[1], args[2]);
      emit_ndjson_line_ex(fp, va, nm, cases[i].name, args, 3, 0xFFFFFFFFu, eax, 0, 0u, r, 3, pre, NULL, 0);
    }
  }

  /* 7. 0x6FD7FB10: UNITS_GetBaseAnimSpeed */
  {
    const uint32_t va = 0x6FD7FB10u;
    const char *nm = "UNITS_GetBaseAnimSpeed";
    setup_it5_datatables();
    RangeSpec r[3] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES, 0xD00 },
      { ADDR_MONSTATS, 4 * 0x1A8 },
    };
    struct { uint32_t ut; uint32_t cid; uint32_t mode; const char *name; } cases[6] = {
      { 0u, 0u, 3u,    "player_mode3_walk" },
      { 0u, 0u, 2u,    "player_mode2_other" },
      { 1u, 0u, 0x0Fu, "mon0_mode15_run" },
      { 1u, 1u, 2u,    "mon1_mode2_seqvel" },
      { 1u, 2u, 0x0Fu, "mon2_neg_run" },
      { 2u, 0u, 0u,    "object_type_0" },
    };
    for (int i = 0; i < 6; i++) {
      uint32_t args[3] = { cases[i].ut, cases[i].cid, cases[i].mode };
      capture_pre(r, 3, pre);
      uint32_t eax = call_ecx_eax_edx_ret(va, args[0], args[1], args[2]);
      emit_ndjson_line_ex(fp, va, nm, cases[i].name, args, 3, 0xFFFFFFFFu, eax, 0, 0u, r, 3, pre, NULL, 0);
    }
  }

  /* 8. 0x6FD80D50: UNITS_GetBaseWalkVelocity */
  {
    const uint32_t va = 0x6FD80D50u;
    const char *nm = "UNITS_GetBaseWalkVelocity";
    setup_it5_datatables();
    RangeSpec r[4] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES, 0xD00 },
      { ADDR_CHARSTATS, 4 * 0xC4 },
      { ADDR_MONSTATS, 4 * 0x1A8 },
    };
    struct { uint32_t ut; uint32_t cid; const char *name; } cases[5] = {
      { 0u, 0u, "player_cls0" },
      { 0u, 1u, "player_cls1" },
      { 1u, 0u, "mon_cls0" },
      { 1u, 2u, "mon_cls2_neg" },
      { 2u, 0u, "object_type_0" },
    };
    for (int i = 0; i < 5; i++) {
      uint32_t args[2] = { cases[i].ut, cases[i].cid };
      capture_pre(r, 4, pre);
      uint32_t eax = call_ecx_eax_ret(va, args[0], args[1]);
      emit_ndjson_line_ex(fp, va, nm, cases[i].name, args, 2, 0xFFFFFFFFu, eax, 0, 0u, r, 4, pre, NULL, 0);
    }
  }

  /* 9..11: 0x6FD83A70, 0x6FD83B00, 0x6FD83B40 */
  {
    setup_it5_datatables();
    RangeSpec r[5] = {
      { VA_SGPT_DATATABLES, 4 },
      { VA_GDWBITMASKS_IAT, 4 },
      { ADDR_BITMASKS, 128 },
      { ADDR_DATATABLES, 0x200 },
      { ADDR_STATEMASKS, 96 },
    };
    struct { uint32_t va; const char *nm; uint32_t hit1; uint32_t hit2; } fns[3] = {
      { 0x6FD83A70u, "UNITS_CheckStateMaskOnCurse", 1u, 63u  },
      { 0x6FD83B00u, "UNITS_CheckStateMaskExp",     2u, 80u  },
      { 0x6FD83B40u, "UNITS_CheckStateMaskAura",    3u, 184u },
    };
    for (int f = 0; f < 3; f++) {
      uint32_t states[5] = { (uint32_t)-1, 185u, 0u, fns[f].hit1, fns[f].hit2 };
      const char *cids[5] = { "neg_state", "oob_state_185", "clear_bit_0", "set_bit_low", "set_bit_high" };
      for (int i = 0; i < 5; i++) {
        uint32_t args[1] = { states[i] };
        capture_pre(r, 5, pre);
        uint32_t eax = call_stdcall1(fns[f].va, args[0]);
        emit_ndjson_line_ex(fp, fns[f].va, fns[f].nm, cids[i], args, 1, 0xFFFFFFFFu, eax, 0, 0u, r, 5, pre, NULL, 0);
      }
    }
  }

  /* 12. 0x6FD83B80: UNITS_IsShapeshifted */
  {
    const uint32_t va = 0x6FD83B80u;
    const char *nm = "UNITS_IsShapeshifted";
    RangeSpec r[1] = { { ADDR_UNIT, 244 } };
    struct { uint32_t uptr; uint32_t fl2; const char *cid; } cases[4] = {
      { 0u,        0x08u,       "null_unit" },
      { ADDR_UNIT, 0x00u,       "not_shapeshifted" },
      { ADDR_UNIT, 0x08u,       "shapeshifted_bit3" },
      { ADDR_UNIT, 0xFFFFFFF7u, "other_bits_only" },
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      w32(ADDR_UNIT + 0xC8, cases[i].fl2);
      uint32_t args[1] = { cases[i].uptr };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, 0, 0u, r, 1, pre, NULL, 0);
    }
  }

  /* 13. 0x6FD83CA0: UNITS_GetStateFlagsPtr */
  {
    const uint32_t va = 0x6FD83CA0u;
    const char *nm = "UNITS_GetStateFlagsPtr";
    RangeSpec r[2] = {
      { ADDR_UNIT, 244 },
      { ADDR_STATLIST_EX, 100 },
    };
    struct { uint32_t uptr; uint32_t slptr; uint32_t fl; const char *cid; } cases[4] = {
      { 0u,        ADDR_STATLIST_EX, 0x80000000u, "null_unit" },
      { ADDR_UNIT, 0u,               0x80000000u, "null_statlist" },
      { ADDR_UNIT, ADDR_STATLIST_EX, 0x00000040u, "non_extended_statlist" },
      { ADDR_UNIT, ADDR_STATLIST_EX, 0x80000000u, "extended_statlist" },
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_STATLIST_EX, 0, 100);
      w32(ADDR_UNIT + 0x5C, cases[i].slptr);
      w32(ADDR_STATLIST_EX + 0x10, cases[i].fl);
      w32(ADDR_STATLIST_EX + 0x58, ADDR_STATE_FLAGS);
      uint32_t args[1] = { cases[i].uptr };
      capture_pre(r, 2, pre);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, 0, 0u, r, 2, pre, NULL, 0);
    }
  }

  /* 14. 0x6FD84330: UNITS_HasAnyGfxStateFlag */
  {
    const uint32_t va = 0x6FD84330u;
    const char *nm = "UNITS_HasAnyGfxStateFlag";
    setup_it5_datatables();
    RangeSpec r[5] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES, 0x100 },
      { ADDR_UNIT, 244 },
      { ADDR_STATLIST_EX, 100 },
      { ADDR_STATE_FLAGS, 48 },
    };
    for (int i = 0; i < 6; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_STATLIST_EX, 0, 100);
      memset((void *)(uintptr_t)ADDR_STATE_FLAGS, 0, 48);
      uint32_t uptr = ADDR_UNIT;
      const char *cid = "null_unit";
      if (i == 0) {
        uptr = 0u;
      } else if (i == 1) {
        cid = "null_statlist";
      } else if (i == 2) {
        cid = "non_extended";
        w32(ADDR_UNIT + 0x5C, ADDR_STATLIST_EX);
        w32(ADDR_STATLIST_EX + 0x10, 0x00000001u);
      } else if (i == 3) {
        cid = "all_gfx_words_zero_active_nonzero";
        w32(ADDR_UNIT + 0x5C, ADDR_STATLIST_EX);
        w32(ADDR_STATLIST_EX + 0x10, 0x80000000u);
        w32(ADDR_STATLIST_EX + 0x58, ADDR_STATE_FLAGS);
        w32(ADDR_STATE_FLAGS + 0, 0xFFFFFFFFu);
      } else if (i == 4) {
        cid = "first_gfx_word_nonzero";
        w32(ADDR_UNIT + 0x5C, ADDR_STATLIST_EX);
        w32(ADDR_STATLIST_EX + 0x10, 0x80000000u);
        w32(ADDR_STATLIST_EX + 0x58, ADDR_STATE_FLAGS);
        w32(ADDR_STATE_FLAGS + 24, 0x00000001u);
      } else {
        cid = "last_gfx_word_nonzero";
        w32(ADDR_UNIT + 0x5C, ADDR_STATLIST_EX);
        w32(ADDR_STATLIST_EX + 0x10, 0x80000000u);
        w32(ADDR_STATLIST_EX + 0x58, ADDR_STATE_FLAGS);
        w32(ADDR_STATE_FLAGS + 44, 0x80000000u);
      }
      uint32_t args[1] = { uptr };
      capture_pre(r, 5, pre);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 1, 0xFFFFFFFFu, eax, 0, 0u, r, 5, pre, NULL, 0);
    }
  }

  /* 15. 0x6FD84390: UNITS_ClearGfxStateFlags */
  {
    const uint32_t va = 0x6FD84390u;
    const char *nm = "UNITS_ClearGfxStateFlags";
    setup_it5_datatables();
    RangeSpec r[5] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES, 0x100 },
      { ADDR_UNIT, 244 },
      { ADDR_STATLIST_EX, 100 },
      { ADDR_STATE_FLAGS, 48 },
    };
    RangeSpec post_r[1] = { { ADDR_STATE_FLAGS, 48 } };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_STATLIST_EX, 0, 100);
      for (int w = 0; w < 12; w++) {
        w32(ADDR_STATE_FLAGS + w * 4, 0xA5A50000u + (uint32_t)w);
      }
      uint32_t uptr = ADDR_UNIT;
      const char *cid = "null_unit";
      if (i == 0) {
        uptr = 0u;
      } else if (i == 1) {
        cid = "null_statlist";
      } else if (i == 2) {
        cid = "non_extended";
        w32(ADDR_UNIT + 0x5C, ADDR_STATLIST_EX);
        w32(ADDR_STATLIST_EX + 0x10, 0x00000001u);
        w32(ADDR_STATLIST_EX + 0x58, ADDR_STATE_FLAGS);
      } else {
        cid = "extended_clears_gfx_preserves_active";
        w32(ADDR_UNIT + 0x5C, ADDR_STATLIST_EX);
        w32(ADDR_STATLIST_EX + 0x10, 0x80000000u);
        w32(ADDR_STATLIST_EX + 0x58, ADDR_STATE_FLAGS);
      }
      uint32_t args[1] = { uptr };
      capture_pre(r, 5, pre);
      call_stdcall1(va, args[0]);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 1, 0u, 0u, 0, 0u, r, 5, pre, post_r, 1);
    }
  }
}

/* =========================================================================
 * B029 EMITTER (20 hostImport functions)
 * ========================================================================= */
static void emit_b029(FILE *fp) {
  uint8_t *pre[8];
  setup_it5_datatables();

  /* 1. 0x6FD62000: UNITFINDS_FreeUnitFindData */
  {
    const uint32_t va = 0x6FD62000u;
    const char *nm = "UNITFINDS_FreeUnitFindData";
    RangeSpec r[1] = { { ADDR_FIND_DATA, 48 } };
    RangeSpec post_r[1] = { { ADDR_FIND_DATA, 48 } };
    for (int i = 0; i < 3; i++) {
      reset_heap();
      memset((void *)(uintptr_t)ADDR_FIND_DATA, 0, 48);
      w32(ADDR_FIND_DATA + 0x00, 0x11112222u);
      w32(ADDR_FIND_DATA + 0x1C, 15u);
      uint32_t ptr = ADDR_FIND_DATA;
      const char *cid = "null_ptr";
      if (i == 0) {
        ptr = 0u;
      } else if (i == 1) {
        cid = "null_units_array";
        w32(ADDR_FIND_DATA + 0x04, 0u);
      } else {
        cid = "valid_units_array_freed_and_zeroed";
        w32(ADDR_FIND_DATA + 0x04, HEAP_BASE);
      }
      uint32_t args[1] = { ptr };
      capture_pre(r, 1, pre);
      call_stdcall1(va, args[0]);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 1, 0u, 0u, 0, 0u, r, 1, pre, post_r, 1);
    }
  }

  /* 2. 0x6FD62030: UNITFINDS_InitUnitFindData */
  {
    const uint32_t va = 0x6FD62030u;
    const char *nm = "UNITFINDS_InitUnitFindData";
    RangeSpec r[1] = { { ADDR_FIND_DATA, 48 } };
    RangeSpec post_r[2] = {
      { ADDR_FIND_DATA, 48 },
      { HEAP_BASE, 60 },
    };
    for (int i = 0; i < 2; i++) {
      reset_heap();
      memset((void *)(uintptr_t)ADDR_FIND_DATA, 0xAA, 48);
      uint32_t pData = (i == 0) ? 0u : ADDR_FIND_DATA;
      const char *cid = (i == 0) ? "null_find_data_asserts" : "valid_init_allocs_0x3c";
      uint32_t args[8] = {
        0xCAFE0001u, pData, ADDR_ROOM1, ADDR_UNIT, 0x6FD60000u, 7u, 120u, 240u
      };
      capture_pre(r, 1, pre);
      g_assert_line = 0;
      int asserted = 0;
      if (setjmp(g_jmp_buf) == 0) {
        g_in_test_call = 1;
        call_stdcall8(va, args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7]);
        g_in_test_call = 0;
      } else {
        asserted = 1;
      }
      emit_ndjson_line_ex(fp, va, nm, cid, args, 8, 0u, 0u, asserted, g_assert_line, r, 1, pre, post_r, 2);
    }
  }

  /* 3. 0x6FD620F0: UNITFINDS_GrowUnitsArray (custom esi=pUnitFindData) */
  {
    const uint32_t va = 0x6FD620F0u;
    const char *nm = "UNITFINDS_GrowUnitsArray";
    RangeSpec r[2] = {
      { ADDR_FIND_DATA, 48 },
      { ADDR_OUT_BUF, 60 },
    };
    RangeSpec post_r[2] = {
      { ADDR_FIND_DATA, 48 },
      { HEAP_BASE, 120 },
    };
    for (int i = 0; i < 2; i++) {
      reset_heap();
      memset((void *)(uintptr_t)ADDR_FIND_DATA, 0, 48);
      for (int k = 0; k < 15; k++) {
        w32(ADDR_OUT_BUF + k * 4, 0x1000u + (uint32_t)k);
      }
      w32(ADDR_FIND_DATA + 0x00, 0xCAFE0002u);
      w32(ADDR_FIND_DATA + 0x04, ADDR_OUT_BUF);
      w32(ADDR_FIND_DATA + 0x1C, 15u);
      uint32_t pData = (i == 0) ? 0u : ADDR_FIND_DATA;
      const char *cid = (i == 0) ? "null_find_data_asserts" : "grow_from_15_to_30";
      uint32_t args[1] = { pData };
      capture_pre(r, 2, pre);
      g_assert_line = 0;
      int asserted = 0;
      uint32_t eax = 0;
      if (setjmp(g_jmp_buf) == 0) {
        g_in_test_call = 1;
        eax = call_esi_ret(va, args[0]);
        g_in_test_call = 0;
      } else {
        asserted = 1;
      }
      emit_ndjson_line_ex(fp, va, nm, cid, args, 1, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 2, pre, post_r, 2);
    }
  }

  /* 4. 0x6FD622B0: UNITFINDS_FindUnitInAdjacentRooms */
  {
    const uint32_t va = 0x6FD622B0u;
    const char *nm = "UNITFINDS_FindUnitInAdjacentRooms";
    RangeSpec r[7] = {
      { ADDR_ROOM1, 128 },
      { ADDR_ROOM2, 128 },
      { ADDR_ROOM3, 128 },
      { ADDR_ROOMS_LIST, 16 },
      { ADDR_UNIT, 244 },
      { ADDR_UNIT2, 244 },
      { ADDR_UNIT3, 244 },
    };
    for (int i = 0; i < 5; i++) {
      memset((void *)(uintptr_t)ADDR_ROOM1, 0, 128);
      memset((void *)(uintptr_t)ADDR_ROOM2, 0, 128);
      memset((void *)(uintptr_t)ADDR_ROOM3, 0, 128);
      memset((void *)(uintptr_t)ADDR_ROOMS_LIST, 0, 16);
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_UNIT2, 0, 244);
      memset((void *)(uintptr_t)ADDR_UNIT3, 0, 244);

      w32(ADDR_ROOM1 + 0x00, ADDR_ROOMS_LIST);
      w32(ADDR_ROOM1 + 0x24, 2u);
      w32(ADDR_ROOMS_LIST + 0, ADDR_ROOM2);
      w32(ADDR_ROOMS_LIST + 4, ADDR_ROOM3);

      /* Room2 has UNIT (type 1, class 10) -> UNIT2 (type 2, class 20) */
      w32(ADDR_ROOM2 + 0x74, ADDR_UNIT);
      w32(ADDR_UNIT + 0x00, 1u);
      w32(ADDR_UNIT + 0x04, 10u);
      w32(ADDR_UNIT + 0xE8, ADDR_UNIT2);
      w32(ADDR_UNIT2 + 0x00, 2u);
      w32(ADDR_UNIT2 + 0x04, 20u);

      /* Room3 has UNIT3 (type 2, class 35) */
      w32(ADDR_ROOM3 + 0x74, ADDR_UNIT3);
      w32(ADDR_UNIT3 + 0x00, 2u);
      w32(ADDR_UNIT3 + 0x04, 35u);

      uint32_t room_arg = ADDR_ROOM1;
      uint32_t ut_arg = 2u;
      uint32_t cls_arg = 35u;
      const char *cid = "null_room_asserts";
      if (i == 0) {
        room_arg = 0u;
      } else if (i == 1) {
        cid = "zero_near_rooms";
        w32(ADDR_ROOM1 + 0x24, 0u);
      } else if (i == 2) {
        cid = "found_in_first_room";
        ut_arg = 1u;
        cls_arg = 10u;
      } else if (i == 3) {
        cid = "found_in_second_room_after_type_match_class_mismatch";
        ut_arg = 2u;
        cls_arg = 35u;
      } else {
        cid = "not_found";
        ut_arg = 2u;
        cls_arg = 99u;
      }
      uint32_t args[3] = { room_arg, ut_arg, cls_arg };
      capture_pre(r, 7, pre);
      g_assert_line = 0;
      int asserted = 0;
      uint32_t eax = 0;
      if (setjmp(g_jmp_buf) == 0) {
        g_in_test_call = 1;
        eax = call_stdcall3(va, args[0], args[1], args[2]);
        g_in_test_call = 0;
      } else {
        asserted = 1;
      }
      emit_ndjson_line_ex(fp, va, nm, cid, args, 3, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 7, pre, NULL, 0);
    }
  }

  /* 5. 0x6FD62AF0: LOGGING_WriteFormattedEntry */
  {
    const uint32_t va = 0x6FD62AF0u;
    const char *nm = "LOGGING_WriteFormattedEntry";
    RangeSpec r[2] = {
      { VA_LOG_ENABLED, 4 },
      { ADDR_SCRATCH, 64 },
    };
    for (int i = 0; i < 2; i++) {
      memset((void *)(uintptr_t)ADDR_SCRATCH, 0, 64);
      strcpy((char *)(uintptr_t)(ADDR_SCRATCH + 0), "Test.cpp");
      strcpy((char *)(uintptr_t)(ADDR_SCRATCH + 16), "val=%d");
      w32(ADDR_SCRATCH + 32, 42u);
      w32(VA_LOG_ENABLED, (i == 0) ? 0u : 1u);
      const char *cid = (i == 0) ? "log_disabled_early_return" : "log_enabled_formats_and_flushes";
      uint32_t args[8] = {
        1u, 2u, 3u, 4u, ADDR_SCRATCH + 0u, 100u, ADDR_SCRATCH + 16u, ADDR_SCRATCH + 32u
      };
      capture_pre(r, 2, pre);
      call_stdcall8(va, args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7]);
      w32(VA_LOG_ENABLED, 0u);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 8, 0u, 0u, 0, 0u, r, 2, pre, NULL, 0);
    }
  }

  /* 6. 0x6FD68260: CHAT_FreeHoverMsg */
  {
    const uint32_t va = 0x6FD68260u;
    const char *nm = "CHAT_FreeHoverMsg";
    for (int i = 0; i < 2; i++) {
      reset_heap();
      uint32_t pMsg = (i == 0) ? 0u : ADDR_HOVER_MSG;
      const char *cid = (i == 0) ? "null_hover_msg" : "valid_hover_msg";
      uint32_t args[2] = { 0xCAFE0003u, pMsg };
      call_stdcall2(va, args[0], args[1]);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 2, 0u, 0u, 0, 0u, NULL, 0, pre, NULL, 0);
    }
  }

  /* 7. 0x6FD68280: CHAT_AllocHoverMsg */
  {
    const uint32_t va = 0x6FD68280u;
    const char *nm = "CHAT_AllocHoverMsg";
    RangeSpec r[2] = {
      { VA_LANG_SHADOW, 4 },
      { ADDR_SCRATCH, 260 },
    };
    RangeSpec post_r[1] = { { HEAP_BASE, 272 } };
    for (int i = 0; i < 3; i++) {
      reset_heap();
      memset((void *)(uintptr_t)ADDR_SCRATCH, 0, 260);
      w8(VA_LANG_SHADOW, 3u);
      const char *cid = "empty_string_returns_null";
      if (i == 1) {
        cid = "short_string_allocs_hover_msg";
        strcpy((char *)(uintptr_t)ADDR_SCRATCH, "Hello World!");
      } else if (i == 2) {
        cid = "long_string_255_clamped_to_254";
        memset((void *)(uintptr_t)ADDR_SCRATCH, 'A', 256);
        w8(ADDR_SCRATCH + 256, 0u);
      }
      uint32_t args[3] = { 0xCAFE0004u, ADDR_SCRATCH, 500u };
      capture_pre(r, 2, pre);
      uint32_t eax = call_stdcall3(va, args[0], args[1], args[2]);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 3, 0xFFFFFFFFu, eax, 0, 0u, r, 2, pre, post_r, (i == 0) ? 0 : 1);
    }
  }

  /* 8. 0x6FD725F0: ITEMS_SetItemCell */
  {
    const uint32_t va = 0x6FD725F0u;
    const char *nm = "ITEMS_SetItemCell";
    RangeSpec r[2] = {
      { ADDR_UNIT, 244 },
      { ADDR_ITEM_DATA, 116 },
    };
    RangeSpec post_r[1] = { { ADDR_ITEM_DATA, 116 } };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_ITEM_DATA, 0, 116);
      uint32_t uptr = ADDR_UNIT;
      const char *cid = "null_item_asserts";
      if (i == 0) {
        uptr = 0u;
      } else if (i == 1) {
        cid = "non_item_type_asserts";
        w32(ADDR_UNIT + 0x00, 1u);
        w32(ADDR_UNIT + 0x14, ADDR_ITEM_DATA);
      } else if (i == 2) {
        cid = "null_item_data_asserts";
        w32(ADDR_UNIT + 0x00, 4u);
        w32(ADDR_UNIT + 0x14, 0u);
      } else {
        cid = "valid_item_sets_cell";
        w32(ADDR_UNIT + 0x00, 4u);
        w32(ADDR_UNIT + 0x14, ADDR_ITEM_DATA);
      }
      uint32_t args[2] = { uptr, 7u };
      capture_pre(r, 2, pre);
      g_assert_line = 0;
      int asserted = 0;
      if (setjmp(g_jmp_buf) == 0) {
        g_in_test_call = 1;
        call_stdcall2(va, args[0], args[1]);
        g_in_test_call = 0;
      } else {
        asserted = 1;
      }
      emit_ndjson_line_ex(fp, va, nm, cid, args, 2, 0u, 0u, asserted, g_assert_line, r, 2, pre, post_r, 1);
    }
  }

  /* 9. 0x6FD82E10: UNITS_ApplyRunWalkStatListInline (eax=nCharClassId, [esp+4]=pUnit, ret 4) */
  {
    const uint32_t va = 0x6FD82E10u;
    const char *nm = "UNITS_ApplyRunWalkStatListInline";
    setup_it5_datatables();
    RangeSpec r[6] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES, 0xD00 },
      { ADDR_CHARSTATS, 4 * 0xC4 },
      { ADDR_ISC_TABLE, 80 * 0x144 },
      { ADDR_UNIT, 244 },
      { ADDR_STATLIST_EX, 100 },
    };
    RangeSpec post_r[2] = {
      { ADDR_STATLIST_EX, 100 },
      { HEAP_BASE, 128 },
    };
    for (int i = 0; i < 3; i++) {
      reset_heap();
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_STATLIST_EX, 0, 100);
      w32(ADDR_UNIT + 0x00, 0u);
      w32(ADDR_UNIT + 0x0C, 42u);
      w32(ADDR_UNIT + 0x5C, ADDR_STATLIST_EX);
      w32(ADDR_STATLIST_EX + 0x08, 0u);
      w32(ADDR_STATLIST_EX + 0x0C, 42u);
      w32(ADDR_STATLIST_EX + 0x10, 0x80000000u);
      w32(ADDR_STATLIST_EX + 0x40, ADDR_UNIT);
      w32(ADDR_STATLIST_EX + 0x58, ADDR_STATE_FLAGS);

      uint32_t cls = 0u;
      uint32_t uptr = ADDR_UNIT;
      const char *cid = "valid_class0_walk6_run9";
      if (i == 1) {
        cid = "class2_zero_walk_skips_merge";
        cls = 2u;
      } else if (i == 2) {
        cid = "null_unit_class2_zero_walk";
        cls = 2u;
        uptr = 0u;
      }
      uint32_t args[2] = { cls, uptr };
      post_r[1].len = (i == 0) ? 124u : 60u;
      capture_pre(r, 6, pre);
      call_eax_stack1_ret4(va, args[0], args[1]);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 2, 0u, 0u, 0, 0u, r, 6, pre, post_r, 2);
    }
  }

  /* 10. 0x6FD87E20: STATLIST_FreeModStats */
  {
    const uint32_t va = 0x6FD87E20u;
    const char *nm = "STATLIST_FreeModStats";
    RangeSpec r[2] = {
      { ADDR_UNIT, 244 },
      { ADDR_STATLIST_EX, 100 },
    };
    RangeSpec post_r[1] = { { ADDR_STATLIST_EX, 100 } };
    for (int i = 0; i < 4; i++) {
      reset_heap();
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_STATLIST_EX, 0, 100);
      uint32_t uptr = ADDR_UNIT;
      const char *cid = "null_unit";
      if (i == 0) {
        uptr = 0u;
      } else if (i == 1) {
        cid = "non_extended_statlist";
        w32(ADDR_UNIT + 0x5C, ADDR_STATLIST_EX);
        w32(ADDR_STATLIST_EX + 0x10, 0x00000001u);
        w32(ADDR_STATLIST_EX + 0x50, ADDR_MOD_ARR);
        w16(ADDR_STATLIST_EX + 0x54, 3u);
        w16(ADDR_STATLIST_EX + 0x56, 4u);
      } else if (i == 2) {
        cid = "extended_with_modstats_freed";
        w32(ADDR_UNIT + 0x5C, ADDR_STATLIST_EX);
        w32(ADDR_STATLIST_EX + 0x10, 0x80000000u);
        w32(ADDR_STATLIST_EX + 0x50, ADDR_MOD_ARR);
        w16(ADDR_STATLIST_EX + 0x54, 3u);
        w16(ADDR_STATLIST_EX + 0x56, 4u);
      } else {
        cid = "extended_null_modstat_ptr";
        w32(ADDR_UNIT + 0x5C, ADDR_STATLIST_EX);
        w32(ADDR_STATLIST_EX + 0x10, 0x80000000u);
        w32(ADDR_STATLIST_EX + 0x50, 0u);
        w16(ADDR_STATLIST_EX + 0x54, 2u);
        w16(ADDR_STATLIST_EX + 0x56, 4u);
      }
      uint32_t args[1] = { uptr };
      capture_pre(r, 2, pre);
      call_stdcall1(va, args[0]);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 1, 0u, 0u, 0, 0u, r, 2, pre, post_r, 1);
    }
  }

  /* 11. 0x6FD8A9F0: STATLIST_FreeStatListImpl (custom ecx=pStatList) */
  {
    const uint32_t va = 0x6FD8A9F0u;
    const char *nm = "STATLIST_FreeStatListImpl";
    RangeSpec r[3] = {
      { ADDR_STATLIST_EX, 100 },
      { ADDR_STATLIST_SUB, 60 },
      { ADDR_STATLIST_SB2, 60 },
    };
    RangeSpec post_r[3] = {
      { ADDR_STATLIST_EX, 100 },
      { ADDR_STATLIST_SUB, 60 },
      { ADDR_STATLIST_SB2, 60 },
    };
    for (int i = 0; i < 2; i++) {
      reset_heap();
      memset((void *)(uintptr_t)ADDR_STATLIST_EX, 0, 100);
      memset((void *)(uintptr_t)ADDR_STATLIST_SUB, 0, 60);
      memset((void *)(uintptr_t)ADDR_STATLIST_SB2, 0, 60);
      uint32_t target = ADDR_STATLIST_SUB;
      const char *cid = "non_extended_statlist";
      if (i == 0) {
        w32(ADDR_STATLIST_SUB + 0x00, 0xCAFE0005u);
        w32(ADDR_STATLIST_SUB + 0x10, 0x00000004u);
        w32(ADDR_STATLIST_SUB + 0x24, ADDR_STAT_ARR);
      } else {
        cid = "extended_statlist_with_children";
        target = ADDR_STATLIST_EX;
        w32(ADDR_STATLIST_EX + 0x00, 0xCAFE0005u);
        w32(ADDR_STATLIST_EX + 0x10, 0x80000000u);
        w32(ADDR_STATLIST_EX + 0x24, ADDR_STAT_ARR);
        w32(ADDR_STATLIST_EX + 0x3C, ADDR_STATLIST_SUB);
        w32(ADDR_STATLIST_EX + 0x48, ADDR_FULL_ARR);
        w32(ADDR_STATLIST_EX + 0x50, ADDR_MOD_ARR);
        w32(ADDR_STATLIST_EX + 0x58, ADDR_STATE_FLAGS);

        w32(ADDR_STATLIST_SUB + 0x04, ADDR_UNIT);
        w32(ADDR_STATLIST_SUB + 0x10, 0x00000004u);
        w32(ADDR_STATLIST_SUB + 0x2C, ADDR_STATLIST_SB2);
        w32(ADDR_STATLIST_SUB + 0x34, ADDR_STATLIST_EX);

        w32(ADDR_STATLIST_SB2 + 0x04, ADDR_UNIT);
        w32(ADDR_STATLIST_SB2 + 0x10, 0x80000000u);
        w32(ADDR_STATLIST_SB2 + 0x34, ADDR_STATLIST_EX);
      }
      uint32_t args[1] = { target };
      capture_pre(r, 3, pre);
      call_ecx_ret_void(va, args[0]);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 1, 0u, 0u, 0, 0u, r, 3, pre, post_r, 3);
    }
  }

  /* 12. 0x6FD8B0A0: STATLIST_GetUnitType */
  {
    const uint32_t va = 0x6FD8B0A0u;
    const char *nm = "STATLIST_GetUnitType";
    RangeSpec r[1] = { { ADDR_STATLIST_EX, 60 } };
    for (int i = 0; i < 2; i++) {
      memset((void *)(uintptr_t)ADDR_STATLIST_EX, 0, 60);
      w32(ADDR_STATLIST_EX + 0x08, 4u);
      uint32_t sptr = (i == 0) ? 0u : ADDR_STATLIST_EX;
      const char *cid = (i == 0) ? "null_statlist_asserts" : "valid_statlist_returns_ownertype";
      uint32_t args[1] = { sptr };
      capture_pre(r, 1, pre);
      g_assert_line = 0;
      int asserted = 0;
      uint32_t eax = 0;
      if (setjmp(g_jmp_buf) == 0) {
        g_in_test_call = 1;
        eax = call_stdcall1(va, args[0]);
        g_in_test_call = 0;
      } else {
        asserted = 1;
      }
      emit_ndjson_line_ex(fp, va, nm, cid, args, 1, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 1, pre, NULL, 0);
    }
  }

  /* 13. 0x6FD8B1A0: DUNGEON_GetRoomTileSubtypesPtr */
  {
    const uint32_t va = 0x6FD8B1A0u;
    const char *nm = "DUNGEON_GetRoomTileSubtypesPtr";
    RangeSpec r[2] = {
      { ADDR_ROOM1, 128 },
      { ADDR_ROOM_EX, 128 },
    };
    for (int i = 0; i < 2; i++) {
      memset((void *)(uintptr_t)ADDR_ROOM1, 0, 128);
      memset((void *)(uintptr_t)ADDR_ROOM_EX, 0, 128);
      w32(ADDR_ROOM1 + 0x10, ADDR_ROOM_EX);
      w32(ADDR_ROOM_EX + 0x58, ADDR_LEVEL);
      uint32_t rptr = (i == 0) ? 0u : ADDR_ROOM1;
      const char *cid = (i == 0) ? "null_room_asserts" : "valid_room_returns_level_plus_0x1e0";
      uint32_t args[1] = { rptr };
      capture_pre(r, 2, pre);
      g_assert_line = 0;
      int asserted = 0;
      uint32_t eax = 0;
      if (setjmp(g_jmp_buf) == 0) {
        g_in_test_call = 1;
        eax = call_stdcall1(va, args[0]);
        g_in_test_call = 0;
      } else {
        asserted = 1;
      }
      emit_ndjson_line_ex(fp, va, nm, cid, args, 1, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 2, pre, NULL, 0);
    }
  }

  /* 14. 0x6FD8B1E0: DUNGEON_GetActLevelId */
  {
    const uint32_t va = 0x6FD8B1E0u;
    const char *nm = "DUNGEON_GetActLevelId";
    RangeSpec r[1] = { { VA_ACT_LEVEL_IDS, 20 } };
    uint32_t acts[6] = { 0u, 1u, 2u, 3u, 4u, 5u };
    const char *cids[6] = { "act0", "act1", "act2", "act3", "act4", "act5_oob_asserts" };
    for (int i = 0; i < 6; i++) {
      uint32_t args[1] = { acts[i] };
      capture_pre(r, 1, pre);
      g_assert_line = 0;
      int asserted = 0;
      uint32_t eax = 0;
      if (setjmp(g_jmp_buf) == 0) {
        g_in_test_call = 1;
        eax = call_stdcall1(va, args[0]);
        g_in_test_call = 0;
      } else {
        asserted = 1;
      }
      emit_ndjson_line_ex(fp, va, nm, cids[i], args, 1, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 1, pre, NULL, 0);
    }
  }

  /* 15. 0x6FD8D060: TEXT_BuildMessageList */
  {
    const uint32_t va = 0x6FD8D060u;
    const char *nm = "TEXT_BuildMessageList";
    RangeSpec r[5] = {
      { ADDR_TEXT_HDR, 12 },
      { ADDR_TEXT_NODE1, 12 },
      { ADDR_TEXT_NODE2, 12 },
      { ADDR_TEXT_NODES8, 108 },
      { ADDR_OUT_BUF, 36 },
    };
    RangeSpec post_r[1] = { { ADDR_OUT_BUF, 36 } };
    for (int i = 0; i < 5; i++) {
      memset((void *)(uintptr_t)ADDR_TEXT_HDR, 0, 12);
      memset((void *)(uintptr_t)ADDR_TEXT_NODE1, 0, 12);
      memset((void *)(uintptr_t)ADDR_TEXT_NODE2, 0, 12);
      memset((void *)(uintptr_t)ADDR_TEXT_NODES8, 0, 108);
      memset((void *)(uintptr_t)ADDR_OUT_BUF, 0xCC, 36);

      uint32_t hdr_arg = ADDR_TEXT_HDR;
      uint32_t out_arg = ADDR_OUT_BUF;
      const char *cid = "null_header_asserts";
      if (i == 0) {
        hdr_arg = 0u;
      } else if (i == 1) {
        cid = "null_out_list_asserts";
        out_arg = 0u;
      } else if (i == 2) {
        cid = "empty_node_list";
        w16(ADDR_TEXT_HDR + 0x04, 0u);
        w32(ADDR_TEXT_HDR + 0x08, 0u);
      } else if (i == 3) {
        cid = "two_nodes_copied";
        w16(ADDR_TEXT_HDR + 0x04, 2u);
        w32(ADDR_TEXT_HDR + 0x08, ADDR_TEXT_NODE1);
        w16(ADDR_TEXT_NODE1 + 0x00, 0x1234u);
        w32(ADDR_TEXT_NODE1 + 0x04, 3u);
        w32(ADDR_TEXT_NODE1 + 0x08, ADDR_TEXT_NODE2);
        w16(ADDR_TEXT_NODE2 + 0x00, 0x5678u);
        w32(ADDR_TEXT_NODE2 + 0x04, 7u);
        w32(ADDR_TEXT_NODE2 + 0x08, 0u);
      } else {
        cid = "nine_nodes_asserts_at_idx_8";
        w16(ADDR_TEXT_HDR + 0x04, 9u);
        w32(ADDR_TEXT_HDR + 0x08, ADDR_TEXT_NODES8);
        for (int n = 0; n < 9; n++) {
          uint32_t np = ADDR_TEXT_NODES8 + (uint32_t)(n * 12);
          w16(np + 0x00, (uint16_t)(100 + n));
          w32(np + 0x04, (uint32_t)n);
          w32(np + 0x08, (n < 8) ? (np + 12u) : 0u);
        }
      }
      uint32_t args[2] = { hdr_arg, out_arg };
      capture_pre(r, 5, pre);
      g_assert_line = 0;
      int asserted = 0;
      if (setjmp(g_jmp_buf) == 0) {
        g_in_test_call = 1;
        call_stdcall2(va, args[0], args[1]);
        g_in_test_call = 0;
      } else {
        asserted = 1;
      }
      emit_ndjson_line_ex(fp, va, nm, cid, args, 2, 0u, 0u, asserted, g_assert_line, r, 5, pre, post_r, 1);
    }
  }

  /* 16. 0x6FD8D210: TEXT_AddNodeToTextList */
  {
    const uint32_t va = 0x6FD8D210u;
    const char *nm = "TEXT_AddNodeToTextList";
    RangeSpec r[1] = { { ADDR_TEXT_HDR, 12 } };
    RangeSpec post_r[2] = {
      { ADDR_TEXT_HDR, 12 },
      { HEAP_BASE, 12 },
    };
    for (int i = 0; i < 2; i++) {
      reset_heap();
      memset((void *)(uintptr_t)ADDR_TEXT_HDR, 0, 12);
      w32(ADDR_TEXT_HDR + 0x00, 0xCAFE0006u);
      w16(ADDR_TEXT_HDR + 0x04, (i == 0) ? 0u : 2u);
      w32(ADDR_TEXT_HDR + 0x08, (i == 0) ? 0u : ADDR_TEXT_NODE1);
      const char *cid = (i == 0) ? "add_to_empty_list" : "add_to_existing_list";
      uint32_t args[3] = { ADDR_TEXT_HDR, 0x1357u, 5u };
      capture_pre(r, 1, pre);
      call_stdcall3(va, args[0], args[1], args[2]);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 3, 0u, 0u, 0, 0u, r, 1, pre, post_r, 2);
    }
  }

  /* 17. 0x6FD8D280: TEXT_AllocTextList */
  {
    const uint32_t va = 0x6FD8D280u;
    const char *nm = "TEXT_AllocTextList";
    RangeSpec post_r[1] = { { HEAP_BASE, 12 } };
    uint32_t pools[2] = { 0u, 0xCAFE0007u };
    const char *cids[2] = { "null_pool", "valid_pool" };
    for (int i = 0; i < 2; i++) {
      reset_heap();
      uint32_t args[1] = { pools[i] };
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line_ex(fp, va, nm, cids[i], args, 1, 0xFFFFFFFFu, eax, 0, 0u, NULL, 0, pre, post_r, 1);
    }
  }

  /* 18. 0x6FD8D450: TEXT_FreeTextList */
  {
    const uint32_t va = 0x6FD8D450u;
    const char *nm = "TEXT_FreeTextList";
    RangeSpec r[3] = {
      { ADDR_TEXT_HDR, 12 },
      { ADDR_TEXT_NODE1, 12 },
      { ADDR_TEXT_NODE2, 12 },
    };
    RangeSpec post_r[1] = { { ADDR_TEXT_HDR, 12 } };
    for (int i = 0; i < 2; i++) {
      reset_heap();
      memset((void *)(uintptr_t)ADDR_TEXT_HDR, 0, 12);
      memset((void *)(uintptr_t)ADDR_TEXT_NODE1, 0, 12);
      memset((void *)(uintptr_t)ADDR_TEXT_NODE2, 0, 12);
      w32(ADDR_TEXT_HDR + 0x00, 0xCAFE0008u);
      if (i == 0) {
        w16(ADDR_TEXT_HDR + 0x04, 0u);
        w32(ADDR_TEXT_HDR + 0x08, 0u);
      } else {
        w16(ADDR_TEXT_HDR + 0x04, 2u);
        w32(ADDR_TEXT_HDR + 0x08, ADDR_TEXT_NODE1);
        w32(ADDR_TEXT_NODE1 + 0x08, ADDR_TEXT_NODE2);
        w32(ADDR_TEXT_NODE2 + 0x08, 0u);
      }
      const char *cid = (i == 0) ? "free_empty_list" : "free_two_node_list";
      uint32_t args[1] = { ADDR_TEXT_HDR };
      capture_pre(r, 3, pre);
      call_stdcall1(va, args[0]);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 1, 0u, 0u, 0, 0u, r, 3, pre, post_r, 1);
    }
  }

  /* 19. 0x6FD95780: STATLIST_UnpackSkillStatParam */
  {
    const uint32_t va = 0x6FD95780u;
    const char *nm = "STATLIST_UnpackSkillStatParam";
    RangeSpec r[1] = { { ADDR_OUT_BUF, 16 } };
    RangeSpec post_r[1] = { { ADDR_OUT_BUF, 16 } };
    struct { uint32_t param; uint32_t p0; uint32_t p1; uint32_t p2; const char *cid; } cases[6] = {
      { 0u,     0u,                ADDR_OUT_BUF + 4u, ADDR_OUT_BUF + 8u, "null_out0_asserts" },
      { 0u,     ADDR_OUT_BUF + 0u, 0u,                ADDR_OUT_BUF + 8u, "null_out1_asserts" },
      { 0u,     ADDR_OUT_BUF + 0u, ADDR_OUT_BUF + 4u, 0u,                "null_out2_asserts" },
      { 0u,     ADDR_OUT_BUF + 0u, ADDR_OUT_BUF + 4u, ADDR_OUT_BUF + 8u, "param_0" },
      { 0x1B7u, ADDR_OUT_BUF + 0u, ADDR_OUT_BUF + 4u, ADDR_OUT_BUF + 8u, "param_0x1b7" },
      { 0x3FFu, ADDR_OUT_BUF + 0u, ADDR_OUT_BUF + 4u, ADDR_OUT_BUF + 8u, "param_0x3ff_max" },
    };
    for (int i = 0; i < 6; i++) {
      memset((void *)(uintptr_t)ADDR_OUT_BUF, 0, 16);
      uint32_t args[4] = { cases[i].param, cases[i].p0, cases[i].p1, cases[i].p2 };
      capture_pre(r, 1, pre);
      g_assert_line = 0;
      int asserted = 0;
      if (setjmp(g_jmp_buf) == 0) {
        g_in_test_call = 1;
        call_stdcall4(va, args[0], args[1], args[2], args[3]);
        g_in_test_call = 0;
      } else {
        asserted = 1;
      }
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 4, 0u, 0u, asserted, g_assert_line, r, 1, pre, post_r, 1);
    }
  }

  /* 20. 0x6FD96920: STATLIST_RollRandomItemGraphicStat */
  {
    const uint32_t va = 0x6FD96920u;
    const char *nm = "STATLIST_RollRandomItemGraphicStat";
    setup_it5_datatables();
    RangeSpec r[8] = {
      { VA_SGPT_DATATABLES, 4 },
      { VA_GFX_CELL_CNT, 4 },
      { VA_GFX_CELL_TBL, 32 },
      { ADDR_DATATABLES, 0xD00 },
      { ADDR_ISC_TABLE, 80 * 0x144 },
      { ADDR_UNIT, 244 },
      { ADDR_ITEM_DATA, 116 },
      { ADDR_STATLIST_EX, 100 },
    };
    RangeSpec post_r[2] = {
      { ADDR_ITEM_DATA, 116 },
      { ADDR_STATLIST_EX, 100 },
    };
    for (int i = 0; i < 6; i++) {
      reset_heap();
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_ITEM_DATA, 0, 116);
      memset((void *)(uintptr_t)ADDR_STATLIST_EX, 0, 100);

      w32(ADDR_UNIT + 0x00, 4u);
      w32(ADDR_UNIT + 0x0C, 77u);
      w32(ADDR_UNIT + 0x14, ADDR_ITEM_DATA);
      w32(ADDR_UNIT + 0x5C, ADDR_STATLIST_EX);
      w32(ADDR_ITEM_DATA + 0x04, (i == 0) ? 0x12345678u : (i == 1) ? 0x00000001u : 0xCAFEBABEu);
      w32(ADDR_ITEM_DATA + 0x08, 666u);
      w32(ADDR_STATLIST_EX + 0x08, 4u);
      w32(ADDR_STATLIST_EX + 0x0C, 77u);
      w32(ADDR_STATLIST_EX + 0x10, 0x80000000u);
      w32(ADDR_STATLIST_EX + 0x40, ADDR_UNIT);
      w32(ADDR_STATLIST_EX + 0x58, ADDR_STATE_FLAGS);

      uint32_t uptr = ADDR_UNIT;
      const char *cid = "cell_non_7_9_sets_stat_1";
      if (i == 0) {
        w32(VA_GFX_CELL_CNT, 6u);
        w32(VA_GFX_CELL_TBL + 0,  3u);
        w32(VA_GFX_CELL_TBL + 4,  3u);
        w32(VA_GFX_CELL_TBL + 8,  3u);
        w32(VA_GFX_CELL_TBL + 12, 3u);
        w32(VA_GFX_CELL_TBL + 16, 3u);
        w32(VA_GFX_CELL_TBL + 20, 3u);
      } else if (i == 1) {
        cid = "cell_9_rolls_secondary_seed";
        w32(VA_GFX_CELL_CNT, 6u);
        for (int k = 0; k < 6; k++) w32(VA_GFX_CELL_TBL + k * 4, 9u);
      } else if (i == 2) {
        cid = "cell_7_power_of_two_count_4";
        w32(VA_GFX_CELL_CNT, 4u);
        for (int k = 0; k < 4; k++) w32(VA_GFX_CELL_TBL + k * 4, 7u);
      } else if (i == 3) {
        cid = "count_zero_uses_idx_0";
        w32(VA_GFX_CELL_CNT, 0u);
        w32(VA_GFX_CELL_TBL + 0, 2u);
      } else if (i == 4) {
        cid = "null_item_with_zero_count_asserts";
        w32(VA_GFX_CELL_CNT, 0u);
        w32(VA_GFX_CELL_TBL + 0, 2u);
        uptr = 0u;
      } else {
        cid = "non_item_type_with_zero_count_asserts";
        w32(VA_GFX_CELL_CNT, 0u);
        w32(VA_GFX_CELL_TBL + 0, 2u);
        w32(ADDR_UNIT + 0x00, 1u);
      }
      uint32_t args[1] = { uptr };
      capture_pre(r, 8, pre);
      g_assert_line = 0;
      int asserted = 0;
      if (setjmp(g_jmp_buf) == 0) {
        g_in_test_call = 1;
        call_stdcall1(va, args[0]);
        g_in_test_call = 0;
      } else {
        asserted = 1;
      }
      w32(VA_GFX_CELL_CNT, 6u);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 1, 0u, 0u, asserted, g_assert_line, r, 8, pre, post_r, 2);
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
  void *heap = VirtualAlloc((void *)(uintptr_t)HEAP_BASE, HEAP_SIZE, MEM_RESERVE | MEM_COMMIT, PAGE_READWRITE);
  if (heap != (void *)(uintptr_t)HEAP_BASE) {
    fprintf(stderr, "VirtualAlloc at 0x%08X failed (got %p, err=%lu)\n", HEAP_BASE, heap, GetLastError());
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
  VirtualProtect((void *)(uintptr_t)0x6FDD9000u, 0x1000u, PAGE_READWRITE, &old_prot);
  VirtualProtect((void *)(uintptr_t)0x6FDE4000u, 0x10000u, PAGE_READWRITE, &old_prot);
  VirtualProtect((void *)(uintptr_t)0x6FD52000u, 0x1000u, PAGE_EXECUTE_READWRITE, &old_prot);

  w32(VA_GDWBITMASKS_IAT, ADDR_BITMASKS);
  w32(0x6FDD90D4u, (uint32_t)(uintptr_t)&stub_fog_assert_line);
  w32(0x6FDD90D0u, (uint32_t)(uintptr_t)&stub_fog_10045);
  w32(0x6FDD90CCu, (uint32_t)(uintptr_t)&stub_fog_10046);
  w32(0x6FDD90ACu, (uint32_t)(uintptr_t)&stub_fog_10047);
  w32(0x6FDD904Cu, (uint32_t)(uintptr_t)&stub_d2lang_10009);

  /* Stub internal MSVCRT fwrite (0x6FD5215D) and fflush (0x6FD529CB) for 0x6FD62AF0 */
  w8(0x6FD5215Du, 0xC3u);
  w8(0x6FD529CBu, 0x33u);
  w8(0x6FD529CCu, 0xC0u);
  w8(0x6FD529CDu, 0xC3u);

  char path[512];

  snprintf(path, sizeof(path), "%s/b026-vectors.ndjson", out_dir);
  FILE *fp26 = fopen(path, "wb");
  if (!fp26) { perror("fopen b026"); return 5; }
  emit_b026(fp26);
  fclose(fp26);

  snprintf(path, sizeof(path), "%s/b029-vectors.ndjson", out_dir);
  FILE *fp29 = fopen(path, "wb");
  if (!fp29) { perror("fopen b029"); return 6; }
  emit_b029(fp29);
  fclose(fp29);

  printf("Emitted real-DLL vectors for B026 and B029 into %s\n", out_dir);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
