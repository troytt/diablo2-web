/*
 * k1r2-laneA-it7-emitter.c
 *
 * Real-DLL Wine differential vector emitter for Iteration 7 Lane A:
 *   - B038 (30 hostImport functions -> b038-vectors.ndjson)
 *   - B041 (12 hostImport functions -> b041-vectors.ndjson)
 *
 * Loads real Storm.dll, Fog.dll (0x6FF50000), and D2Common.dll (0x6FD50000),
 * maps deterministic arena at 0x22000000 and bump-heap at 0x40000000, hooks
 * Fog.#10045 (alloc), Fog.#10046 (free), and Fog.#10265 (assert line capture + longjmp),
 * executes every target VA in-process, and emits NDJSON vectors.
 *
 * Build (must pass -Werror with 0 warnings under both -O2 and -O2 -fno-omit-frame-pointer):
 *   i686-w64-mingw32-gcc -O2 -m32 -Wall -Wextra -Werror \
 *     -o /tmp/k1r2-laneA-it7-emitter.exe tools/oracle/vectors/k1r2-laneA-it7-emitter.c
 */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <setjmp.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define ARENA_BASE         0x22000000u
#define ARENA_SIZE         0x00100000u
#define HEAP_BASE          0x40000000u
#define HEAP_SIZE          0x00100000u

/* Arena layout within 0x22000000..0x220FFFFF */
#define ADDR_UNIT          0x22001000u /* 244 bytes (D2UnitStrc) */
#define ADDR_UNIT2         0x22001200u /* 244 bytes (D2UnitStrc) */
#define ADDR_OBJECT_DATA   0x22001400u /* 56 bytes (D2ObjectDataStrc) */
#define ADDR_OBJECTS_TXT   0x22001600u /* 448 bytes (D2ObjectsTxt) */
#define ADDR_STATIC_PATH   0x22001A00u /* 32 bytes (D2StaticPathStrc) */
#define ADDR_DYNAMIC_PATH  0x22001C00u /* 512 bytes (D2DynamicPathStrc) */
#define ADDR_PLAYER_DATA   0x22002000u /* 364 bytes (D2PlayerDataStrc) */
#define ADDR_MISSILE_DATA  0x22002400u /* 52 bytes (D2MissileDataStrc) */
#define ADDR_SKILL_LIST    0x22002600u /* 24 bytes (D2SkillListStrc) */
#define ADDR_SKILL         0x22002700u /* 64 bytes (D2SkillStrc) */
#define ADDR_STATLIST_EX   0x22002800u /* 100 bytes (D2StatListExStrc) */
#define ADDR_FULL_STATS    0x22002A00u /* 32 bytes (D2StatStrc[4]) */
#define ADDR_WAYPOINT0     0x22002C00u /* 32 bytes (waypoint buffer src/rw) */
#define ADDR_WAYPOINT1     0x22002C40u /* 32 bytes (waypoint buffer dst) */
#define ADDR_OUT_A         0x22002D00u /* 4 bytes (u32 output slot A) */
#define ADDR_OUT_B         0x22002D04u /* 4 bytes (u32 output slot B) */
#define ADDR_STR_BUF       0x22002E00u /* 32 bytes (source string buffer) */
#define ADDR_DATATABLES    0x22004000u /* 0x1000 bytes (sgptDataTables) */
#define ADDR_MONSTATS_TXT  0x22006000u /* 4 * 0x1A8 = 1696 bytes */
#define ADDR_CHARSTATS_TXT 0x22007000u /* 7 * 0xC4 = 1372 bytes */
#define ADDR_ISC_TXT       0x22008000u /* 24 * 0x144 = 7776 bytes */

/* D2Common.dll .rdata / .data VAs */
#define VA_GDW_BITMASKS_IAT    0x6FDD90B0u
#define VA_PLAYER_MODE_SWITCH  0x6FDDC5F8u
#define VA_MON_MODE_SWITCH_LOW 0x6FDDC788u
#define VA_MON_MODE_SWITCH_HI  0x6FDDC8C8u
#define VA_WP_BIT_TABLE        0x6FDE9C58u
#define VA_WP_TABLE_COUNT      0x6FDE9E18u
#define VA_SGPT_DATATABLES     0x6FDE9E1Cu
#define VA_OBJECTS_TXT_PTR     0x6FDF0B94u
#define VA_OBJECTS_TXT_COUNT   0x6FDF0B98u

static inline void w8(uint32_t addr, uint8_t v)   { *(volatile uint8_t *)(uintptr_t)addr = v; }
static inline void w16(uint32_t addr, uint16_t v) { *(volatile uint16_t *)(uintptr_t)addr = v; }
static inline void w32(uint32_t addr, uint32_t v) { *(volatile uint32_t *)(uintptr_t)addr = v; }
static inline uint32_t r32(uint32_t addr)         { return *(volatile const uint32_t *)(uintptr_t)addr; }

static jmp_buf g_jmp_buf;
static int g_in_test_call = 0;
static uint32_t g_assert_line = 0;
static uint32_t g_heap_top = HEAP_BASE;
static int g_force_alloc_null = 0;

static void reset_heap(void) {
  g_heap_top = HEAP_BASE;
  g_force_alloc_null = 0;
  memset((void *)(uintptr_t)HEAP_BASE, 0xCC, 0x100u);
}

/* Hook for Fog.#10265 (0x6FD5921C -> IAT 0x6FDD90D4):
 *   push <line>
 *   call 0x6FD5921C
 */
static void __cdecl stub_fog_assert_line(uint32_t line) {
  g_assert_line = line;
  if (g_in_test_call) {
    g_in_test_call = 0;
    longjmp(g_jmp_buf, 1);
  }
}

/* Hook for Fog.#10045 (0x6FD59222 -> IAT 0x6FDD90D0):
 * __fastcall(ecx=pMemPool, edx=size, [esp+4]=szFile, [esp+8]=nLine, [esp+0xC]=0) -> eax=ptr (ret 0xC)
 */
static uint32_t __fastcall stub_fog_10045(
    uint32_t pMemPool, uint32_t size, const char *szFile, uint32_t nLine, uint32_t u0) {
  (void)pMemPool;
  (void)szFile;
  (void)nLine;
  (void)u0;
  if (g_force_alloc_null) {
    return 0u;
  }
  uint32_t p = (g_heap_top + 3u) & ~3u;
  memset((void *)(uintptr_t)p, 0, size);
  g_heap_top = p + size;
  return p;
}

/* Hook for Fog.#10046 (0x6FD59228 -> IAT 0x6FDD90CC):
 * __fastcall(ecx=pMemPool, edx=pMem, [esp+4]=szFile, [esp+8]=nLine, [esp+0xC]=0) -> ret 0xC
 */
static uint32_t __fastcall stub_fog_10046(
    uint32_t pMemPool, uint32_t pMem, const char *szFile, uint32_t nLine, uint32_t u0) {
  (void)pMemPool;
  (void)pMem;
  (void)szFile;
  (void)nLine;
  (void)u0;
  return 1u;
}

/* =========================================================================
 * Calling convention wrappers (register-only inline assembly constraints)
 * ========================================================================= */
static uint32_t call_stdcall1(uint32_t va, uint32_t a0) {
  typedef uint32_t (__stdcall *Fn)(uint32_t);
  return ((Fn)(uintptr_t)va)(a0);
}
static uint32_t call_stdcall2(uint32_t va, uint32_t a0, uint32_t a1) {
  typedef uint32_t (__stdcall *Fn)(uint32_t, uint32_t);
  return ((Fn)(uintptr_t)va)(a0, a1);
}
static uint32_t call_stdcall3(uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2) {
  typedef uint32_t (__stdcall *Fn)(uint32_t, uint32_t, uint32_t);
  return ((Fn)(uintptr_t)va)(a0, a1, a2);
}

/* __fastcall(ecx=a_ecx) -> eax (ret) */
static __attribute__((noinline)) uint32_t call_fastcall1(uint32_t va, uint32_t a_ecx) {
  uint32_t out_eax = 0;
  __asm__ volatile (
    "call *%2\n\t"
    : "=a"(out_eax), "+c"(a_ecx)
    : "r"(va)
    : "edx", "cc", "memory"
  );
  return out_eax;
}

/* __fastcall(ecx=a_ecx, edx=a_edx) -> void (ret) */
static __attribute__((noinline)) void call_fastcall2_void(uint32_t va, uint32_t a_ecx, uint32_t a_edx) {
  __asm__ volatile (
    "call *%2\n\t"
    : "+c"(a_ecx), "+d"(a_edx)
    : "r"(va)
    : "eax", "cc", "memory"
  );
}

/* Custom LTCG 0x6FD80C70: edx=dwUnitType, ecx=nMode, esi=dwClassId, [esp+4]=pUnit -> eax (ret 0x4) */
static __attribute__((noinline)) uint32_t call_6FD80C70(
    uint32_t va, uint32_t dwUnitType, uint32_t nMode, uint32_t dwClassId, uint32_t pUnit) {
  uint32_t io_eax = pUnit;
  __asm__ volatile (
    "pushl %%eax\n\t"
    "call *%4\n\t"
    : "+a"(io_eax), "+d"(dwUnitType), "+c"(nMode), "+S"(dwClassId)
    : "r"(va)
    : "edi", "cc", "memory"
  );
  return io_eax;
}

static __attribute__((noinline)) uint32_t safe_stdcall1(uint32_t va, uint32_t a0, int *out_asserted) {
  g_assert_line = 0;
  if (setjmp(g_jmp_buf) == 0) {
    g_in_test_call = 1;
    uint32_t r = call_stdcall1(va, a0);
    g_in_test_call = 0;
    *out_asserted = 0;
    return r;
  }
  *out_asserted = 1;
  return 0u;
}

static __attribute__((noinline)) uint32_t safe_stdcall2(uint32_t va, uint32_t a0, uint32_t a1, int *out_asserted) {
  g_assert_line = 0;
  if (setjmp(g_jmp_buf) == 0) {
    g_in_test_call = 1;
    uint32_t r = call_stdcall2(va, a0, a1);
    g_in_test_call = 0;
    *out_asserted = 0;
    return r;
  }
  *out_asserted = 1;
  return 0u;
}

static __attribute__((noinline)) uint32_t safe_stdcall3(uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2, int *out_asserted) {
  g_assert_line = 0;
  if (setjmp(g_jmp_buf) == 0) {
    g_in_test_call = 1;
    uint32_t r = call_stdcall3(va, a0, a1, a2);
    g_in_test_call = 0;
    *out_asserted = 0;
    return r;
  }
  *out_asserted = 1;
  return 0u;
}

static __attribute__((noinline)) uint32_t safe_fastcall1(uint32_t va, uint32_t a_ecx, int *out_asserted) {
  g_assert_line = 0;
  if (setjmp(g_jmp_buf) == 0) {
    g_in_test_call = 1;
    uint32_t r = call_fastcall1(va, a_ecx);
    g_in_test_call = 0;
    *out_asserted = 0;
    return r;
  }
  *out_asserted = 1;
  return 0u;
}

static __attribute__((noinline)) void safe_fastcall2_void(uint32_t va, uint32_t a_ecx, uint32_t a_edx, int *out_asserted) {
  g_assert_line = 0;
  if (setjmp(g_jmp_buf) == 0) {
    g_in_test_call = 1;
    call_fastcall2_void(va, a_ecx, a_edx);
    g_in_test_call = 0;
    *out_asserted = 0;
    return;
  }
  *out_asserted = 1;
}

static __attribute__((noinline)) uint32_t safe_6FD80C70(
    uint32_t va, uint32_t dwUnitType, uint32_t nMode, uint32_t dwClassId, uint32_t pUnit, int *out_asserted) {
  g_assert_line = 0;
  if (setjmp(g_jmp_buf) == 0) {
    g_in_test_call = 1;
    uint32_t r = call_6FD80C70(va, dwUnitType, nMode, dwClassId, pUnit);
    g_in_test_call = 0;
    *out_asserted = 0;
    return r;
  }
  *out_asserted = 1;
  return 0u;
}

/* =========================================================================
 * NDJSON serialization helpers
 * ========================================================================= */
typedef struct {
  uint32_t addr;
  uint32_t len;
} RangeSpec;

static void fprint_hex_bytes(FILE *fp, const uint8_t *buf, uint32_t len) {
  for (uint32_t i = 0; i < len; i++) {
    fprintf(fp, "%02x", buf[i]);
  }
}

static void capture_pre(const RangeSpec *ranges, int nranges, uint8_t **pre_bufs) {
  for (int i = 0; i < nranges; i++) {
    if (ranges[i].len > 0) {
      pre_bufs[i] = (uint8_t *)malloc(ranges[i].len);
      memcpy(pre_bufs[i], (const void *)(uintptr_t)ranges[i].addr, ranges[i].len);
    } else {
      pre_bufs[i] = NULL;
    }
  }
}

static void emit_ndjson_line_ex(
    FILE *fp,
    uint32_t va,
    const char *name,
    const char *case_id,
    const uint32_t *args,
    int nargs,
    uint32_t ret_mask,
    uint32_t eax_after,
    int asserted,
    uint32_t assert_line,
    const RangeSpec *pre_ranges,
    int n_pre,
    uint8_t **pre_bufs,
    const RangeSpec *post_ranges,
    int n_post) {
  fprintf(fp, "{\"va\":\"0x%08X\",\"name\":\"%s\",\"caseId\":\"%s\",\"args\":[", va, name, case_id);
  for (int i = 0; i < nargs; i++) {
    if (i > 0) fputc(',', fp);
    fprintf(fp, "%u", args[i]);
  }
  fprintf(fp, "],\"retMask\":\"0x%X\",\"pre\":{\"mem\":{", ret_mask);
  for (int i = 0; i < n_pre; i++) {
    if (i > 0) fputc(',', fp);
    fprintf(fp, "\"0x%08X\":\"", pre_ranges[i].addr);
    fprint_hex_bytes(fp, pre_bufs[i], pre_ranges[i].len);
    fputc('"', fp);
  }
  if (asserted) {
    fprintf(fp, "}},\"expectedAssert\":{\"line\":%u},\"post\":{\"eax\":0,\"mem\":{}}}\n", assert_line);
  } else {
    fprintf(fp, "}},\"post\":{\"eax\":%u,\"mem\":{", eax_after & ret_mask);
    for (int i = 0; i < n_post; i++) {
      if (i > 0) fputc(',', fp);
      fprintf(fp, "\"0x%08X\":\"", post_ranges[i].addr);
      fprint_hex_bytes(fp, (const uint8_t *)(uintptr_t)post_ranges[i].addr, post_ranges[i].len);
      fputc('"', fp);
    }
    fprintf(fp, "}}}\n");
  }
  for (int i = 0; i < n_pre; i++) {
    free(pre_bufs[i]);
  }
}

/* =========================================================================
 * B038 EMITTER (30 hostImport functions -> b038-vectors.ndjson)
 * ========================================================================= */
static void emit_b038(FILE *fp) {
  uint8_t *pre[16];

  /* 1. 0x6FD7EDA0: UNITS_IsDoor */
  {
    const uint32_t va = 0x6FD7EDA0u;
    const char *nm = "UNITS_IsDoor";
    RangeSpec r[3] = {
      { ADDR_UNIT,        244 },
      { ADDR_OBJECT_DATA,  56 },
      { ADDR_OBJECTS_TXT, 448 },
    };
    struct { uint32_t u; uint32_t ut; uint8_t door; const char *cid; } cases[4] = {
      { 0u,        2u, 1u, "null_unit_asserts_e10" },
      { ADDR_UNIT, 0u, 1u, "non_object_unit_returns_0" },
      { ADDR_UNIT, 2u, 0u, "object_not_door_returns_0" },
      { ADDR_UNIT, 2u, 1u, "object_is_door_returns_1" },
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_OBJECT_DATA, 0, 56);
      memset((void *)(uintptr_t)ADDR_OBJECTS_TXT, 0, 448);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x14, ADDR_OBJECT_DATA);
      w32(ADDR_OBJECT_DATA + 0x00, ADDR_OBJECTS_TXT);
      w8(ADDR_OBJECTS_TXT + 0x13A, cases[i].door);
      uint32_t args[1] = { cases[i].u };
      capture_pre(r, 3, pre);
      int asserted = 0;
      uint32_t eax = safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 3, pre, NULL, 0);
    }
  }

  /* 2. 0x6FD7EEC0: UNITS_GetShiftedFrameMetrics */
  {
    const uint32_t va = 0x6FD7EEC0u;
    const char *nm = "UNITS_GetShiftedFrameMetrics";
    RangeSpec r[5] = {
      { ADDR_UNIT,        244 },
      { ADDR_OBJECT_DATA,  56 },
      { ADDR_OBJECTS_TXT, 448 },
      { ADDR_OUT_A,         4 },
      { ADDR_OUT_B,         4 },
    };
    RangeSpec post_r[2] = {
      { ADDR_OUT_A, 4 },
      { ADDR_OUT_B, 4 },
    };
    struct { uint32_t u; uint32_t ut; uint32_t mode; uint32_t fp; uint32_t fcp; const char *cid; } cases[4] = {
      { 0u,        2u, 0u, 0x0580u,     0x1000u,     "null_unit_asserts_d8f" },
      { ADDR_UNIT, 2u, 3u, 0x0580u,     0x1000u,     "object_unit_reads_objectstxt_framecnt" },
      { ADDR_UNIT, 1u, 0u, 0x0740u,     0x1280u,     "monster_unit_shifts_frame_and_framecount" },
      { ADDR_UNIT, 0u, 0u, 0xFFFFFF00u, 0xFFFFFE00u, "player_unit_negative_sar8" },
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_OBJECT_DATA, 0, 56);
      memset((void *)(uintptr_t)ADDR_OBJECTS_TXT, 0, 448);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x10, cases[i].mode);
      w32(ADDR_UNIT + 0x14, ADDR_OBJECT_DATA);
      w32(ADDR_UNIT + 0x44, cases[i].fp);
      w32(ADDR_UNIT + 0x48, cases[i].fcp);
      w32(ADDR_OBJECT_DATA + 0x00, ADDR_OBJECTS_TXT);
      w32(ADDR_OBJECTS_TXT + 0xD8 + 3 * 4, 14u);
      w32(ADDR_OUT_A, 0xCCCCCCCCu);
      w32(ADDR_OUT_B, 0xCCCCCCCCu);
      uint32_t args[3] = { cases[i].u, ADDR_OUT_A, ADDR_OUT_B };
      capture_pre(r, 5, pre);
      int asserted = 0;
      safe_stdcall3(va, args[0], args[1], args[2], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 3, 0u, 0u, asserted, g_assert_line, r, 5, pre, post_r, 2);
    }
  }

  /* 3. 0x6FD7EF30: UNITS_HasAnimFinished */
  {
    const uint32_t va = 0x6FD7EF30u;
    const char *nm = "UNITS_HasAnimFinished";
    RangeSpec r[1] = { { ADDR_UNIT, 244 } };
    struct { uint32_t u; uint32_t seq; uint32_t fp; uint32_t fcp; int16_t spd; const char *cid; } cases[5] = {
      { 0u,        0u,          0u,   0u,   0,  "null_unit_asserts_d81" },
      { ADDR_UNIT, 0x22005000u, 100u, 0u,   16, "animseq_framecount_le_0_returns_1" },
      { ADDR_UNIT, 0x22005000u, 100u, 256u, 16, "animseq_framecount_gt_0_returns_0" },
      { ADDR_UNIT, 0u,          200u, 256u, 64, "no_seq_frame_plus_speed_ge_count_returns_1" },
      { ADDR_UNIT, 0u,          200u, 256u, 32, "no_seq_frame_plus_speed_lt_count_returns_0" },
    };
    for (int i = 0; i < 5; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      w32(ADDR_UNIT + 0x30, cases[i].seq);
      w32(ADDR_UNIT + 0x44, cases[i].fp);
      w32(ADDR_UNIT + 0x48, cases[i].fcp);
      w16(ADDR_UNIT + 0x4C, (uint16_t)cases[i].spd);
      uint32_t args[1] = { cases[i].u };
      capture_pre(r, 1, pre);
      int asserted = 0;
      uint32_t eax = safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 1, pre, NULL, 0);
    }
  }

  /* 4. 0x6FD7F0C0: UNITS_SetSeqFrameFromLowByte */
  {
    const uint32_t va = 0x6FD7F0C0u;
    const char *nm = "UNITS_SetSeqFrameFromLowByte";
    RangeSpec r[1] = { { ADDR_UNIT, 244 } };
    struct { uint32_t u; uint32_t init38; uint32_t nFrame; const char *cid; } cases[3] = {
      { 0u,        0x123456ABu, 7u,        "null_unit_asserts_ace" },
      { ADDR_UNIT, 0x123456ABu, 7u,        "preserves_low_byte_ab_and_shifts_frame_7" },
      { ADDR_UNIT, 0xFFFFFFFFu, 0x010203u, "preserves_low_byte_ff_and_shifts_large_frame" },
    };
    for (int i = 0; i < 3; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      w32(ADDR_UNIT + 0x38, cases[i].init38);
      uint32_t args[2] = { cases[i].u, cases[i].nFrame };
      capture_pre(r, 1, pre);
      int asserted = 0;
      safe_stdcall2(va, args[0], args[1], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 2, 0u, 0u, asserted, g_assert_line, r, 1, pre, r, 1);
    }
  }

  /* 5. 0x6FD7F3E0: UNITS_FreeStaticPath */
  {
    const uint32_t va = 0x6FD7F3E0u;
    const char *nm = "UNITS_FreeStaticPath";
    RangeSpec r[1] = { { ADDR_UNIT, 244 } };
    uint32_t paths[2] = { 0u, ADDR_STATIC_PATH };
    const char *cids[2] = { "null_path_noop", "non_null_path_frees_without_clearing_ptr" };
    for (int i = 0; i < 2; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      w32(ADDR_UNIT + 0x08, 0xCAFE0001u);
      w32(ADDR_UNIT + 0x2C, paths[i]);
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(r, 1, pre);
      int asserted = 0;
      safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cids[i], args, 1, 0u, 0u, asserted, g_assert_line, r, 1, pre, r, 1);
    }
  }

  /* 6. 0x6FD7F410: UNITS_AllocStaticPath */
  {
    const uint32_t va = 0x6FD7F410u;
    const char *nm = "UNITS_AllocStaticPath";
    RangeSpec r[1] = { { ADDR_UNIT, 244 } };
    /* Case 1: existing pPath != 0 */
    {
      reset_heap();
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      w32(ADDR_UNIT + 0x08, 0xCAFE0002u);
      w32(ADDR_UNIT + 0x2C, ADDR_STATIC_PATH);
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(r, 1, pre);
      int asserted = 0;
      safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, "existing_path_preserved", args, 1, 0u, 0u, asserted, g_assert_line, r, 1, pre, r, 1);
    }
    /* Case 2: pPath == 0 -> allocates 0x20 bytes at HEAP_BASE and zeroes them */
    {
      RangeSpec post_r[2] = {
        { ADDR_UNIT, 244 },
        { HEAP_BASE,  32 },
      };
      reset_heap();
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      w32(ADDR_UNIT + 0x08, 0xCAFE0002u);
      w32(ADDR_UNIT + 0x2C, 0u);
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(r, 1, pre);
      int asserted = 0;
      safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, "null_path_allocates_and_zeroes_32_bytes", args, 1, 0u, 0u, asserted, g_assert_line, r, 1, pre, post_r, 2);
    }
  }

  /* 7. 0x6FD7F460: UNITS_GetInteractItemGuid */
  {
    const uint32_t va = 0x6FD7F460u;
    const char *nm = "UNITS_GetInteractItemGuid";
    RangeSpec r[2] = {
      { ADDR_UNIT,        244 },
      { ADDR_PLAYER_DATA, 364 },
    };
    struct { uint32_t u; uint32_t ut; uint32_t pd; uint32_t guid; const char *cid; } cases[5] = {
      { 0u,        0u, ADDR_PLAYER_DATA, 0xCAFEBABEu, "null_unit_asserts_fb4" },
      { ADDR_UNIT, 1u, ADDR_PLAYER_DATA, 0xCAFEBABEu, "non_player_asserts_fb6" },
      { ADDR_UNIT, 0u, 0u,               0xCAFEBABEu, "null_playerdata_asserts_14d7" },
      { ADDR_UNIT, 0u, ADDR_PLAYER_DATA, 0xCAFEBABEu, "valid_player_returns_guid" },
      { ADDR_UNIT, 0u, ADDR_PLAYER_DATA, 0u,          "valid_player_returns_zero" },
    };
    for (int i = 0; i < 5; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_PLAYER_DATA, 0, 364);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x14, cases[i].pd);
      w32(ADDR_PLAYER_DATA + 0x90, cases[i].guid);
      uint32_t args[1] = { cases[i].u };
      capture_pre(r, 2, pre);
      int asserted = 0;
      uint32_t eax = safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 2, pre, NULL, 0);
    }
  }

  /* 8. 0x6FD7F4B0: UNITS_SetInteractItem */
  {
    const uint32_t va = 0x6FD7F4B0u;
    const char *nm = "UNITS_SetInteractItem";
    RangeSpec r[3] = {
      { ADDR_UNIT,        244 },
      { ADDR_UNIT2,       244 },
      { ADDR_PLAYER_DATA, 364 },
    };
    struct { uint32_t pPlayer; uint32_t pType; uint32_t pd; uint32_t pItem; uint32_t iType; uint32_t iGuid; const char *cid; } cases[6] = {
      { 0u,        0u, ADDR_PLAYER_DATA, ADDR_UNIT2, 4u, 0x12345678u, "null_player_noop" },
      { ADDR_UNIT, 1u, ADDR_PLAYER_DATA, ADDR_UNIT2, 4u, 0x12345678u, "non_player_noop" },
      { ADDR_UNIT, 0u, 0u,               ADDR_UNIT2, 4u, 0x12345678u, "null_playerdata_asserts_14c5" },
      { ADDR_UNIT, 0u, ADDR_PLAYER_DATA, 0u,         4u, 0u,          "null_item_clears_guid" },
      { ADDR_UNIT, 0u, ADDR_PLAYER_DATA, ADDR_UNIT2, 1u, 0x12345678u, "non_item_target_asserts_14c9" },
      { ADDR_UNIT, 0u, ADDR_PLAYER_DATA, ADDR_UNIT2, 4u, 0x12345678u, "valid_item_stores_guid" },
    };
    for (int i = 0; i < 6; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_UNIT2, 0, 244);
      memset((void *)(uintptr_t)ADDR_PLAYER_DATA, 0, 364);
      w32(ADDR_UNIT + 0x00, cases[i].pType);
      w32(ADDR_UNIT + 0x14, cases[i].pd);
      w32(ADDR_UNIT2 + 0x00, cases[i].iType);
      w32(ADDR_UNIT2 + 0x0C, cases[i].iGuid);
      w32(ADDR_PLAYER_DATA + 0x90, 0x99999999u);
      uint32_t args[2] = { cases[i].pPlayer, cases[i].pItem };
      capture_pre(r, 3, pre);
      int asserted = 0;
      safe_stdcall2(va, args[0], args[1], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 2, 0u, 0u, asserted, g_assert_line, r, 3, pre, r, 3);
    }
  }

  /* 9. 0x6FD7F5C0: UNITS_GetPlayerSubtargetLeft */
  {
    const uint32_t va = 0x6FD7F5C0u;
    const char *nm = "UNITS_GetPlayerSubtargetLeft";
    RangeSpec r[4] = {
      { ADDR_UNIT,        244 },
      { ADDR_PLAYER_DATA, 364 },
      { ADDR_OUT_A,         4 },
      { ADDR_OUT_B,         4 },
    };
    RangeSpec post_r[2] = { { ADDR_OUT_A, 4 }, { ADDR_OUT_B, 4 } };
    struct { uint32_t u; uint32_t ut; uint32_t pd; const char *cid; } cases[4] = {
      { 0u,        0u, ADDR_PLAYER_DATA, "null_unit_outputs_defaults" },
      { ADDR_UNIT, 1u, ADDR_PLAYER_DATA, "non_player_outputs_defaults" },
      { ADDR_UNIT, 0u, 0u,               "null_playerdata_asserts_1499" },
      { ADDR_UNIT, 0u, ADDR_PLAYER_DATA, "valid_player_reads_left_subtarget" },
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_PLAYER_DATA, 0, 364);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x14, cases[i].pd);
      w32(ADDR_PLAYER_DATA + 0x80, 2u);
      w32(ADDR_PLAYER_DATA + 0x88, 0x11223344u);
      w32(ADDR_OUT_A, 0xCCCCCCCCu);
      w32(ADDR_OUT_B, 0xCCCCCCCCu);
      uint32_t args[3] = { cases[i].u, ADDR_OUT_A, ADDR_OUT_B };
      capture_pre(r, 4, pre);
      int asserted = 0;
      safe_stdcall3(va, args[0], args[1], args[2], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 3, 0u, 0u, asserted, g_assert_line, r, 4, pre, post_r, 2);
    }
  }

  /* 10. 0x6FD7F630: UNITS_GetPlayerSubtargetRight */
  {
    const uint32_t va = 0x6FD7F630u;
    const char *nm = "UNITS_GetPlayerSubtargetRight";
    RangeSpec r[4] = {
      { ADDR_UNIT,        244 },
      { ADDR_PLAYER_DATA, 364 },
      { ADDR_OUT_A,         4 },
      { ADDR_OUT_B,         4 },
    };
    RangeSpec post_r[2] = { { ADDR_OUT_A, 4 }, { ADDR_OUT_B, 4 } };
    struct { uint32_t u; uint32_t ut; uint32_t pd; const char *cid; } cases[4] = {
      { 0u,        0u, ADDR_PLAYER_DATA, "null_unit_outputs_defaults" },
      { ADDR_UNIT, 1u, ADDR_PLAYER_DATA, "non_player_outputs_defaults" },
      { ADDR_UNIT, 0u, 0u,               "null_playerdata_asserts_1487" },
      { ADDR_UNIT, 0u, ADDR_PLAYER_DATA, "valid_player_reads_right_subtarget" },
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_PLAYER_DATA, 0, 364);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x14, cases[i].pd);
      w32(ADDR_PLAYER_DATA + 0x84, 3u);
      w32(ADDR_PLAYER_DATA + 0x8C, 0x55667788u);
      w32(ADDR_OUT_A, 0xCCCCCCCCu);
      w32(ADDR_OUT_B, 0xCCCCCCCCu);
      uint32_t args[3] = { cases[i].u, ADDR_OUT_A, ADDR_OUT_B };
      capture_pre(r, 4, pre);
      int asserted = 0;
      safe_stdcall3(va, args[0], args[1], args[2], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 3, 0u, 0u, asserted, g_assert_line, r, 4, pre, post_r, 2);
    }
  }

  /* 11. 0x6FD7F6A0: UNITS_PopPlayerSubtargetRight */
  {
    const uint32_t va = 0x6FD7F6A0u;
    const char *nm = "UNITS_PopPlayerSubtargetRight";
    RangeSpec r[4] = {
      { ADDR_UNIT,        244 },
      { ADDR_PLAYER_DATA, 364 },
      { ADDR_OUT_A,         4 },
      { ADDR_OUT_B,         4 },
    };
    RangeSpec post_r[3] = {
      { ADDR_PLAYER_DATA, 364 },
      { ADDR_OUT_A,         4 },
      { ADDR_OUT_B,         4 },
    };
    struct { uint32_t u; uint32_t ut; uint32_t pd; const char *cid; } cases[4] = {
      { 0u,        0u, ADDR_PLAYER_DATA, "null_unit_outputs_defaults" },
      { ADDR_UNIT, 1u, ADDR_PLAYER_DATA, "non_player_outputs_defaults" },
      { ADDR_UNIT, 0u, 0u,               "null_playerdata_asserts_1470" },
      { ADDR_UNIT, 0u, ADDR_PLAYER_DATA, "valid_player_pops_right_subtarget" },
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_PLAYER_DATA, 0, 364);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x14, cases[i].pd);
      w32(ADDR_PLAYER_DATA + 0x74, 5u);
      w32(ADDR_PLAYER_DATA + 0x7C, 6u);
      w32(ADDR_PLAYER_DATA + 0x84, 1u);
      w32(ADDR_PLAYER_DATA + 0x8C, 0x99AABBCCu);
      w32(ADDR_PLAYER_DATA + 0x90, 7u);
      w32(ADDR_PLAYER_DATA + 0x94, 8u);
      w32(ADDR_OUT_A, 0xCCCCCCCCu);
      w32(ADDR_OUT_B, 0xCCCCCCCCu);
      uint32_t args[3] = { cases[i].u, ADDR_OUT_A, ADDR_OUT_B };
      capture_pre(r, 4, pre);
      int asserted = 0;
      safe_stdcall3(va, args[0], args[1], args[2], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 3, 0u, 0u, asserted, g_assert_line, r, 4, pre, post_r, 3);
    }
  }

  /* 12. 0x6FD7F720: UNITS_PopPlayerSubtargetLeft */
  {
    const uint32_t va = 0x6FD7F720u;
    const char *nm = "UNITS_PopPlayerSubtargetLeft";
    RangeSpec r[4] = {
      { ADDR_UNIT,        244 },
      { ADDR_PLAYER_DATA, 364 },
      { ADDR_OUT_A,         4 },
      { ADDR_OUT_B,         4 },
    };
    RangeSpec post_r[3] = {
      { ADDR_PLAYER_DATA, 364 },
      { ADDR_OUT_A,         4 },
      { ADDR_OUT_B,         4 },
    };
    struct { uint32_t u; uint32_t ut; uint32_t pd; const char *cid; } cases[4] = {
      { 0u,        0u, ADDR_PLAYER_DATA, "null_unit_outputs_defaults" },
      { ADDR_UNIT, 1u, ADDR_PLAYER_DATA, "non_player_outputs_defaults" },
      { ADDR_UNIT, 0u, 0u,               "null_playerdata_asserts_145a" },
      { ADDR_UNIT, 0u, ADDR_PLAYER_DATA, "valid_player_pops_left_subtarget" },
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_PLAYER_DATA, 0, 364);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x14, cases[i].pd);
      w32(ADDR_PLAYER_DATA + 0x70, 5u);
      w32(ADDR_PLAYER_DATA + 0x78, 6u);
      w32(ADDR_PLAYER_DATA + 0x80, 2u);
      w32(ADDR_PLAYER_DATA + 0x88, 0xDDEEFF00u);
      w32(ADDR_PLAYER_DATA + 0x90, 7u);
      w32(ADDR_PLAYER_DATA + 0x94, 8u);
      w32(ADDR_OUT_A, 0xCCCCCCCCu);
      w32(ADDR_OUT_B, 0xCCCCCCCCu);
      uint32_t args[3] = { cases[i].u, ADDR_OUT_A, ADDR_OUT_B };
      capture_pre(r, 4, pre);
      int asserted = 0;
      safe_stdcall3(va, args[0], args[1], args[2], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 3, 0u, 0u, asserted, g_assert_line, r, 4, pre, post_r, 3);
    }
  }

  /* 13. 0x6FD7F7A0: UNITS_GetPlayerTargetRight */
  {
    const uint32_t va = 0x6FD7F7A0u;
    const char *nm = "UNITS_GetPlayerTargetRight";
    RangeSpec r[4] = {
      { ADDR_UNIT,        244 },
      { ADDR_PLAYER_DATA, 364 },
      { ADDR_OUT_A,         4 },
      { ADDR_OUT_B,         4 },
    };
    RangeSpec post_r[2] = { { ADDR_OUT_A, 4 }, { ADDR_OUT_B, 4 } };
    struct { uint32_t u; uint32_t ut; uint32_t pd; const char *cid; } cases[4] = {
      { 0u,        0u, ADDR_PLAYER_DATA, "null_unit_outputs_defaults" },
      { ADDR_UNIT, 1u, ADDR_PLAYER_DATA, "non_player_outputs_defaults" },
      { ADDR_UNIT, 0u, 0u,               "null_playerdata_asserts_1449" },
      { ADDR_UNIT, 0u, ADDR_PLAYER_DATA, "valid_player_reads_right_target" },
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_PLAYER_DATA, 0, 364);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x14, cases[i].pd);
      w32(ADDR_PLAYER_DATA + 0x74, 10u);
      w32(ADDR_PLAYER_DATA + 0x7C, 0x42u);
      w32(ADDR_OUT_A, 0xCCCCCCCCu);
      w32(ADDR_OUT_B, 0xCCCCCCCCu);
      uint32_t args[3] = { cases[i].u, ADDR_OUT_A, ADDR_OUT_B };
      capture_pre(r, 4, pre);
      int asserted = 0;
      safe_stdcall3(va, args[0], args[1], args[2], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 3, 0u, 0u, asserted, g_assert_line, r, 4, pre, post_r, 2);
    }
  }

  /* 14. 0x6FD7F800: UNITS_GetPlayerTargetLeft */
  {
    const uint32_t va = 0x6FD7F800u;
    const char *nm = "UNITS_GetPlayerTargetLeft";
    RangeSpec r[4] = {
      { ADDR_UNIT,        244 },
      { ADDR_PLAYER_DATA, 364 },
      { ADDR_OUT_A,         4 },
      { ADDR_OUT_B,         4 },
    };
    RangeSpec post_r[2] = { { ADDR_OUT_A, 4 }, { ADDR_OUT_B, 4 } };
    struct { uint32_t u; uint32_t ut; uint32_t pd; const char *cid; } cases[4] = {
      { 0u,        0u, ADDR_PLAYER_DATA, "null_unit_outputs_defaults" },
      { ADDR_UNIT, 1u, ADDR_PLAYER_DATA, "non_player_outputs_defaults" },
      { ADDR_UNIT, 0u, 0u,               "null_playerdata_asserts_1438" },
      { ADDR_UNIT, 0u, ADDR_PLAYER_DATA, "valid_player_reads_left_target" },
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_PLAYER_DATA, 0, 364);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x14, cases[i].pd);
      w32(ADDR_PLAYER_DATA + 0x70, 20u);
      w32(ADDR_PLAYER_DATA + 0x78, 0x84u);
      w32(ADDR_OUT_A, 0xCCCCCCCCu);
      w32(ADDR_OUT_B, 0xCCCCCCCCu);
      uint32_t args[3] = { cases[i].u, ADDR_OUT_A, ADDR_OUT_B };
      capture_pre(r, 4, pre);
      int asserted = 0;
      safe_stdcall3(va, args[0], args[1], args[2], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 3, 0u, 0u, asserted, g_assert_line, r, 4, pre, post_r, 2);
    }
  }

  /* 15. 0x6FD7F9B0: UNITS_SetOwner */
  {
    const uint32_t va = 0x6FD7F9B0u;
    const char *nm = "UNITS_SetOwner";
    RangeSpec r[2] = {
      { ADDR_UNIT,  244 },
      { ADDR_UNIT2, 244 },
    };
    RangeSpec post_r[1] = { { ADDR_UNIT, 244 } };
    struct { uint32_t u; uint32_t owner; uint32_t flags2; const char *cid; } cases[3] = {
      { 0u,        ADDR_UNIT2, 0x00000001u, "null_unit_asserts_ee7" },
      { ADDR_UNIT, ADDR_UNIT2, 0x00000001u, "non_null_owner_sets_type_id_and_flag2" },
      { ADDR_UNIT, 0u,         0x0003FFFFu, "null_owner_clears_type_id_and_flag2" },
    };
    for (int i = 0; i < 3; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_UNIT2, 0, 244);
      w32(ADDR_UNIT + 0x9C, 5u);
      w32(ADDR_UNIT + 0xA0, 99u);
      w32(ADDR_UNIT + 0xC8, cases[i].flags2);
      w32(ADDR_UNIT2 + 0x00, 1u);
      w32(ADDR_UNIT2 + 0x0C, 0x777u);
      uint32_t args[2] = { cases[i].u, cases[i].owner };
      capture_pre(r, 2, pre);
      int asserted = 0;
      safe_stdcall2(va, args[0], args[1], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 2, 0u, 0u, asserted, g_assert_line, r, 2, pre, post_r, 1);
    }
  }

  /* 16. 0x6FD7FC50: UNITS_SetPathRoomRefreshFlag */
  {
    const uint32_t va = 0x6FD7FC50u;
    const char *nm = "UNITS_SetPathRoomRefreshFlag";
    RangeSpec r[3] = {
      { ADDR_UNIT,         244 },
      { ADDR_STATIC_PATH,   32 },
      { ADDR_DYNAMIC_PATH, 512 },
    };
    RangeSpec post_r[2] = {
      { ADDR_STATIC_PATH,   32 },
      { ADDR_DYNAMIC_PATH, 512 },
    };
    struct { uint32_t u; uint32_t ut; uint32_t bSet; const char *cid; } cases[6] = {
      { 0u,        2u, 1u, "null_unit_asserts_9fe" },
      { ADDR_UNIT, 2u, 5u, "object_static_path_sets_byte_1d_to_1" },
      { ADDR_UNIT, 4u, 0u, "item_static_path_clears_byte_1d_to_0" },
      { ADDR_UNIT, 5u, 1u, "tile_static_path_sets_byte_1d_to_1" },
      { ADDR_UNIT, 0u, 1u, "player_dynamic_path_sets_bit_2" },
      { ADDR_UNIT, 1u, 0u, "monster_dynamic_path_clears_bit_2" },
    };
    for (int i = 0; i < 6; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_STATIC_PATH, 0, 32);
      memset((void *)(uintptr_t)ADDR_DYNAMIC_PATH, 0, 512);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      int is_static = (cases[i].ut == 2u || cases[i].ut == 4u || cases[i].ut == 5u);
      w32(ADDR_UNIT + 0x2C, is_static ? ADDR_STATIC_PATH : ADDR_DYNAMIC_PATH);
      w8(ADDR_STATIC_PATH + 0x1D, cases[i].bSet ? 0u : 1u);
      w32(ADDR_DYNAMIC_PATH + 0x34, cases[i].bSet ? 0x10u : 0x12u);
      uint32_t args[2] = { cases[i].u, cases[i].bSet };
      capture_pre(r, 3, pre);
      int asserted = 0;
      safe_stdcall2(va, args[0], args[1], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 2, 0u, 0u, asserted, g_assert_line, r, 3, pre, post_r, 2);
    }
  }

  /* 17. 0x6FD7FCC0: UNITS_GetPathRoomRefreshFlag */
  {
    const uint32_t va = 0x6FD7FCC0u;
    const char *nm = "UNITS_GetPathRoomRefreshFlag";
    RangeSpec r[3] = {
      { ADDR_UNIT,         244 },
      { ADDR_STATIC_PATH,   32 },
      { ADDR_DYNAMIC_PATH, 512 },
    };
    struct { uint32_t u; uint32_t ut; uint32_t path; const char *cid; } cases[5] = {
      { 0u,        2u, ADDR_STATIC_PATH,  "null_unit_asserts_9ec" },
      { ADDR_UNIT, 2u, ADDR_STATIC_PATH,  "object_reads_static_byte_1d" },
      { ADDR_UNIT, 4u, ADDR_STATIC_PATH,  "item_reads_static_byte_1d_zero" },
      { ADDR_UNIT, 0u, ADDR_DYNAMIC_PATH, "player_reads_dynamic_flags_bit2" },
      { ADDR_UNIT, 5u, ADDR_DYNAMIC_PATH, "tile_falls_through_to_dynamic_flags_bit2" },
    };
    for (int i = 0; i < 5; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_STATIC_PATH, 0, 32);
      memset((void *)(uintptr_t)ADDR_DYNAMIC_PATH, 0, 512);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x2C, cases[i].path);
      w8(ADDR_STATIC_PATH + 0x1D, (i == 2) ? 0u : 1u);
      w32(ADDR_DYNAMIC_PATH + 0x34, 0x06u);
      uint32_t args[1] = { cases[i].u };
      capture_pre(r, 3, pre);
      int asserted = 0;
      uint32_t eax = safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 3, pre, NULL, 0);
    }
  }

  /* 18. 0x6FD7FE10: UNITS_GetRoom */
  {
    const uint32_t va = 0x6FD7FE10u;
    const char *nm = "UNITS_GetRoom";
    RangeSpec r[3] = {
      { ADDR_UNIT,         244 },
      { ADDR_STATIC_PATH,   32 },
      { ADDR_DYNAMIC_PATH, 512 },
    };
    struct { uint32_t u; uint32_t ut; uint32_t path; const char *cid; } cases[5] = {
      { 0u,        0u, ADDR_DYNAMIC_PATH, "null_unit_asserts_896" },
      { ADDR_UNIT, 2u, ADDR_STATIC_PATH,  "object_static_path_reads_offset_0" },
      { ADDR_UNIT, 4u, ADDR_STATIC_PATH,  "item_static_path_reads_offset_0" },
      { ADDR_UNIT, 0u, 0u,                "player_null_dynamic_path_returns_0" },
      { ADDR_UNIT, 1u, ADDR_DYNAMIC_PATH, "monster_dynamic_path_reads_offset_1c" },
    };
    for (int i = 0; i < 5; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_STATIC_PATH, 0, 32);
      memset((void *)(uintptr_t)ADDR_DYNAMIC_PATH, 0, 512);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x2C, cases[i].path);
      w32(ADDR_STATIC_PATH + 0x00, 0x50001000u);
      w32(ADDR_DYNAMIC_PATH + 0x1C, 0x50003000u);
      uint32_t args[1] = { cases[i].u };
      capture_pre(r, 3, pre);
      int asserted = 0;
      uint32_t eax = safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 3, pre, NULL, 0);
    }
  }

  /* 19. 0x6FD7FE70: UNITS_ClearRoom */
  {
    const uint32_t va = 0x6FD7FE70u;
    const char *nm = "UNITS_ClearRoom";
    RangeSpec r[3] = {
      { ADDR_UNIT,         244 },
      { ADDR_STATIC_PATH,   32 },
      { ADDR_DYNAMIC_PATH, 512 },
    };
    RangeSpec post_r[2] = {
      { ADDR_STATIC_PATH,   32 },
      { ADDR_DYNAMIC_PATH, 512 },
    };
    struct { uint32_t u; uint32_t ut; uint32_t path; const char *cid; } cases[5] = {
      { 0u,        0u, ADDR_DYNAMIC_PATH, "null_unit_asserts_87d" },
      { ADDR_UNIT, 2u, ADDR_STATIC_PATH,  "object_static_path_clears_offset_0" },
      { ADDR_UNIT, 4u, ADDR_STATIC_PATH,  "item_static_path_clears_offset_0" },
      { ADDR_UNIT, 0u, 0u,                "player_null_dynamic_path_noop" },
      { ADDR_UNIT, 1u, ADDR_DYNAMIC_PATH, "monster_dynamic_path_clears_offset_1c" },
    };
    for (int i = 0; i < 5; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_STATIC_PATH, 0, 32);
      memset((void *)(uintptr_t)ADDR_DYNAMIC_PATH, 0, 512);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x2C, cases[i].path);
      w32(ADDR_STATIC_PATH + 0x00, 0x50001000u);
      w32(ADDR_DYNAMIC_PATH + 0x1C, 0x50003000u);
      uint32_t args[1] = { cases[i].u };
      capture_pre(r, 3, pre);
      int asserted = 0;
      safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 1, 0u, 0u, asserted, g_assert_line, r, 3, pre, post_r, 2);
    }
  }

  /* 20. 0x6FD7FF30: UNITS_GetCollisionMask (__fastcall ecx=pUnit) */
  {
    const uint32_t va = 0x6FD7FF30u;
    const char *nm = "UNITS_GetCollisionMask";
    RangeSpec r[4] = {
      { ADDR_UNIT,         244 },
      { ADDR_OBJECT_DATA,   56 },
      { ADDR_OBJECTS_TXT,  448 },
      { ADDR_DYNAMIC_PATH, 512 },
    };
    struct {
      uint32_t u;
      uint32_t ut;
      uint32_t path;
      uint8_t door;
      uint8_t vis;
      uint8_t sub;
      uint8_t light;
      const char *cid;
    } cases[11] = {
      { 0u,        0u, ADDR_DYNAMIC_PATH, 0u, 0u, 0u, 0u, "null_unit_asserts_80e" },
      { ADDR_UNIT, 2u, 0u,                1u, 1u, 0u, 0u, "object_door_blocks_vis_returns_0x806" },
      { ADDR_UNIT, 2u, 0u,                1u, 0u, 0u, 1u, "object_door_blocks_light_returns_0x804" },
      { ADDR_UNIT, 2u, 0u,                1u, 0u, 0u, 0u, "object_door_no_vis_no_light_returns_0x400" },
      { ADDR_UNIT, 2u, 0u,                0u, 0u, 4u, 0u, "object_non_door_subclass_bit2_returns_0x8000" },
      { ADDR_UNIT, 2u, 0u,                0u, 0u, 0u, 1u, "object_non_door_blocks_light_returns_0x404" },
      { ADDR_UNIT, 2u, 0u,                0u, 0u, 0u, 0u, "object_non_door_plain_returns_0x400" },
      { ADDR_UNIT, 4u, 0u,                0u, 0u, 0u, 0u, "item_unit_returns_0x200" },
      { ADDR_UNIT, 5u, 0u,                0u, 0u, 0u, 0u, "tile_unit_returns_0x1" },
      { ADDR_UNIT, 0u, 0u,                0u, 0u, 0u, 0u, "dynamic_unit_null_path_returns_0xffff" },
      { ADDR_UNIT, 1u, ADDR_DYNAMIC_PATH, 0u, 0u, 0u, 0u, "dynamic_unit_reads_footprint_mask" },
    };
    for (int i = 0; i < 11; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_OBJECT_DATA, 0, 56);
      memset((void *)(uintptr_t)ADDR_OBJECTS_TXT, 0, 448);
      memset((void *)(uintptr_t)ADDR_DYNAMIC_PATH, 0, 512);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x14, ADDR_OBJECT_DATA);
      w32(ADDR_UNIT + 0x2C, cases[i].path);
      w32(ADDR_OBJECT_DATA + 0x00, ADDR_OBJECTS_TXT);
      w8(ADDR_OBJECTS_TXT + 0x13A, cases[i].door);
      w8(ADDR_OBJECTS_TXT + 0x13B, cases[i].vis);
      w8(ADDR_OBJECTS_TXT + 0x167, cases[i].sub);
      w8(ADDR_OBJECTS_TXT + 0x1B6, cases[i].light);
      w32(ADDR_DYNAMIC_PATH + 0x4C, 0x101u);
      uint32_t args[1] = { cases[i].u };
      capture_pre(r, 4, pre);
      int asserted = 0;
      uint32_t eax = safe_fastcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 4, pre, NULL, 0);
    }
  }

  /* 21. 0x6FD80C70: UNITS_CanSwitchToModeDuringAnim (custom LTCG edx=dwUnitType, ecx=nMode, esi=dwClassId, [esp+4]=pUnit) */
  {
    const uint32_t va = 0x6FD80C70u;
    const char *nm = "UNITS_CanSwitchToModeDuringAnim";
    uint32_t gdw_bitmasks_ptr = r32(VA_GDW_BITMASKS_IAT);
    RangeSpec r[11] = {
      { VA_PLAYER_MODE_SWITCH,  400 },
      { VA_MON_MODE_SWITCH_LOW, 320 },
      { VA_MON_MODE_SWITCH_HI,  320 },
      { VA_GDW_BITMASKS_IAT,      4 },
      { gdw_bitmasks_ptr,         4 },
      { VA_SGPT_DATATABLES,       4 },
      { ADDR_DATATABLES + 0xA78, 12 },
      { ADDR_MONSTATS_TXT,      848 },
      { ADDR_UNIT,              244 },
      { ADDR_SKILL_LIST,         24 },
      { ADDR_SKILL,              64 },
    };
    struct {
      uint32_t ut;
      uint32_t mode;
      uint32_t cls;
      uint32_t monPtr;
      uint8_t monBit0;
      uint32_t hasSkills;
      uint32_t hasUsedSkill;
      uint32_t skillFlags;
      const char *cid;
    } cases[14] = {
      { 2u, 0u,  0u,          ADDR_MONSTATS_TXT, 0u, 1u, 1u, 1u,      "invalid_unit_type_2_asserts_bd2" },
      { 0u, 2u,  0u,          ADDR_MONSTATS_TXT, 0u, 0u, 0u, 0u,      "player_mode_2_always_switch_returns_1" },
      { 0u, 0u,  0u,          ADDR_MONSTATS_TXT, 0u, 0u, 0u, 0u,      "player_mode_0_never_switch_returns_0" },
      { 0u, 13u, 0u,          ADDR_MONSTATS_TXT, 0u, 0u, 0u, 0u,      "player_mode_13_null_skills_returns_0" },
      { 0u, 13u, 0u,          ADDR_MONSTATS_TXT, 0u, 1u, 1u, 0u,      "player_mode_13_skill_flag_bit0_clear_returns_0" },
      { 0u, 13u, 0u,          ADDR_MONSTATS_TXT, 0u, 1u, 1u, 0x0001u, "player_mode_13_skill_flag_bit0_set_returns_1" },
      { 0u, 13u, 0u,          ADDR_MONSTATS_TXT, 0u, 1u, 1u, 0x1001u, "player_mode_13_skill_flag_bit12_blocks_returns_0" },
      { 1u, 2u,  0u,          ADDR_MONSTATS_TXT, 1u, 0u, 0u, 0u,      "monster_flag_bit0_mode_2_returns_1" },
      { 1u, 15u, 0u,          ADDR_MONSTATS_TXT, 1u, 0u, 0u, 0u,      "monster_flag_bit0_mode_15_returns_1" },
      { 1u, 8u,  0u,          ADDR_MONSTATS_TXT, 1u, 0u, 0u, 0u,      "monster_flag_bit0_mode_8_returns_0" },
      { 1u, 8u,  1u,          ADDR_MONSTATS_TXT, 0u, 0u, 0u, 0u,      "monster_low_class_mode_8_always_switch_returns_1" },
      { 1u, 8u,  415u,        ADDR_MONSTATS_TXT, 0u, 0u, 0u, 0u,      "monster_high_class_mode_8_no_skills_returns_0" },
      { 1u, 2u,  0xFFFFFFFFu, ADDR_MONSTATS_TXT, 0u, 0u, 0u, 0u,      "monster_negative_classid_uses_low_table" },
      { 1u, 2u,  0u,          0u,                0u, 0u, 0u, 0u,      "monster_null_monstats_ptr_falls_back_to_table" },
    };
    for (int i = 0; i < 14; i++) {
      memset((void *)(uintptr_t)ADDR_DATATABLES, 0, 0x1000u);
      memset((void *)(uintptr_t)ADDR_MONSTATS_TXT, 0, 848);
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_SKILL_LIST, 0, 24);
      memset((void *)(uintptr_t)ADDR_SKILL, 0, 64);
      w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);
      w32(ADDR_DATATABLES + 0xA78, cases[i].monPtr);
      w32(ADDR_DATATABLES + 0xA80, 2u);
      w8(ADDR_MONSTATS_TXT + 0x0D, cases[i].monBit0);
      w32(ADDR_UNIT + 0xA8, cases[i].hasSkills ? ADDR_SKILL_LIST : 0u);
      w32(ADDR_SKILL_LIST + 0x10, cases[i].hasUsedSkill ? ADDR_SKILL : 0u);
      w32(ADDR_SKILL + 0x0C, cases[i].skillFlags);
      uint32_t args[4] = { cases[i].ut, cases[i].mode, cases[i].cls, ADDR_UNIT };
      capture_pre(r, 11, pre);
      int asserted = 0;
      uint32_t eax = safe_6FD80C70(va, args[0], args[1], args[2], args[3], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 4, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 11, pre, NULL, 0);
    }
  }

  /* 22. 0x6FD80E80: UNITS_SetTargetUnitForDynamicUnit */
  {
    const uint32_t va = 0x6FD80E80u;
    const char *nm = "UNITS_SetTargetUnitForDynamicUnit";
    RangeSpec r[3] = {
      { ADDR_UNIT,         244 },
      { ADDR_UNIT2,        244 },
      { ADDR_DYNAMIC_PATH, 512 },
    };
    RangeSpec post_r[1] = { { ADDR_DYNAMIC_PATH, 512 } };
    struct { uint32_t u; uint32_t ut; uint32_t target; const char *cid; } cases[6] = {
      { 0u,        0u, ADDR_UNIT2, "null_unit_asserts_8ac" },
      { ADDR_UNIT, 2u, ADDR_UNIT2, "object_unit_asserts_8ae" },
      { ADDR_UNIT, 4u, ADDR_UNIT2, "item_unit_asserts_8ae" },
      { ADDR_UNIT, 0u, 0u,         "player_unit_null_target_clears_ptr_only" },
      { ADDR_UNIT, 1u, ADDR_UNIT2, "monster_unit_sets_target_ptr_type_and_id" },
      { ADDR_UNIT, 3u, ADDR_UNIT2, "missile_unit_sets_target_ptr_type_and_id" },
    };
    for (int i = 0; i < 6; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_UNIT2, 0, 244);
      memset((void *)(uintptr_t)ADDR_DYNAMIC_PATH, 0, 512);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x2C, ADDR_DYNAMIC_PATH);
      w32(ADDR_UNIT2 + 0x00, 1u);
      w32(ADDR_UNIT2 + 0x0C, 0x44u);
      w32(ADDR_DYNAMIC_PATH + 0x58, 0x99999999u);
      w32(ADDR_DYNAMIC_PATH + 0x5C, 0x88888888u);
      w32(ADDR_DYNAMIC_PATH + 0x60, 0x77777777u);
      uint32_t args[2] = { cases[i].u, cases[i].target };
      capture_pre(r, 3, pre);
      int asserted = 0;
      safe_stdcall2(va, args[0], args[1], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 2, 0u, 0u, asserted, g_assert_line, r, 3, pre, post_r, 1);
    }
  }

  /* 23. 0x6FD81EA0: UNITS_GetPlayerBaseToHit */
  {
    const uint32_t va = 0x6FD81EA0u;
    const char *nm = "UNITS_GetPlayerBaseToHit";
    uint32_t gdw_bitmasks_ptr = r32(VA_GDW_BITMASKS_IAT);
    RangeSpec r[9] = {
      { VA_GDW_BITMASKS_IAT,      4 },
      { gdw_bitmasks_ptr,        12 },
      { VA_SGPT_DATATABLES,       4 },
      { ADDR_DATATABLES + 0xBC4, 20 },
      { ADDR_CHARSTATS_TXT,    1372 },
      { ADDR_ISC_TXT,          7776 },
      { ADDR_UNIT,              244 },
      { ADDR_STATLIST_EX,       100 },
      { ADDR_FULL_STATS,         32 },
    };
    struct {
      uint32_t u;
      uint32_t ut;
      uint32_t cls;
      uint32_t hasSlex;
      uint32_t iscCnt;
      uint32_t charCnt;
      uint32_t charPtr;
      const char *cid;
    } cases[8] = {
      { 0u,        0u, 0u,          1u, 24u, 7u, ADDR_CHARSTATS_TXT, "null_unit_asserts_107f" },
      { ADDR_UNIT, 1u, 0u,          1u, 24u, 7u, ADDR_CHARSTATS_TXT, "non_player_asserts_107f" },
      { ADDR_UNIT, 0u, 0u,          0u, 24u, 7u, ADDR_CHARSTATS_TXT, "null_statlist_returns_neg35_plus_factor" },
      { ADDR_UNIT, 0u, 1u,          1u, 24u, 7u, ADDR_CHARSTATS_TXT, "with_tohit_and_dex_and_charstats" },
      { ADDR_UNIT, 0u, 10u,         1u, 24u, 7u, ADDR_CHARSTATS_TXT, "classid_ge_count_skips_charstats_factor" },
      { ADDR_UNIT, 0u, 0xFFFFFFFFu, 1u, 24u, 7u, ADDR_CHARSTATS_TXT, "negative_classid_skips_charstats_factor" },
      { ADDR_UNIT, 0u, 0u,          1u, 2u,  7u, ADDR_CHARSTATS_TXT, "isc_count_2_skips_both_stat_lookups" },
      { ADDR_UNIT, 0u, 0u,          1u, 10u, 7u, 0u,                 "isc_count_10_reads_dex_only_and_null_charstats_ptr" },
    };
    for (int i = 0; i < 8; i++) {
      memset((void *)(uintptr_t)ADDR_DATATABLES, 0, 0x1000u);
      memset((void *)(uintptr_t)ADDR_CHARSTATS_TXT, 0, 1372);
      memset((void *)(uintptr_t)ADDR_ISC_TXT, 0, 7776);
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_STATLIST_EX, 0, 100);
      memset((void *)(uintptr_t)ADDR_FULL_STATS, 0, 32);

      w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);
      w32(ADDR_DATATABLES + 0xBC4, cases[i].charPtr);
      w32(ADDR_DATATABLES + 0xBC8, cases[i].charCnt);
      w32(ADDR_DATATABLES + 0xBCC, ADDR_ISC_TXT);
      w32(ADDR_DATATABLES + 0xBD4, cases[i].iscCnt);

      /* CharStats[0].nToHitFactor = 20, CharStats[1].nToHitFactor = 15 */
      w32(ADDR_CHARSTATS_TXT + 0 * 0xC4 + 0x3C, 20u);
      w32(ADDR_CHARSTATS_TXT + 1 * 0xC4 + 0x3C, 15u);

      /* ItemStatCost[2] (dexterity): fMin bit (0x04 at +0x05) and dwMinAccr = 1 (+0x2C) */
      w8(ADDR_ISC_TXT + 2 * 0x144 + 0x05, 0x04u);
      w32(ADDR_ISC_TXT + 2 * 0x144 + 0x2C, 1u);

      /* FullStats sorted by signed dwKey: [0] = (stat 2 << 16, val 20), [1] = (stat 19 << 16, val 50) */
      w32(ADDR_FULL_STATS + 0x00, 0x00020000u);
      w32(ADDR_FULL_STATS + 0x04, 20u);
      w32(ADDR_FULL_STATS + 0x08, 0x00130000u);
      w32(ADDR_FULL_STATS + 0x0C, 50u);

      w32(ADDR_STATLIST_EX + 0x10, 0x80000000u);
      w32(ADDR_STATLIST_EX + 0x44, ADDR_UNIT);
      w32(ADDR_STATLIST_EX + 0x48, ADDR_FULL_STATS);
      w16(ADDR_STATLIST_EX + 0x4C, 2u);
      w16(ADDR_STATLIST_EX + 0x4E, 4u);

      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x04, cases[i].cls);
      w32(ADDR_UNIT + 0x5C, cases[i].hasSlex ? ADDR_STATLIST_EX : 0u);

      uint32_t args[1] = { cases[i].u };
      capture_pre(r, 9, pre);
      int asserted = 0;
      uint32_t eax = safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 9, pre, NULL, 0);
    }
  }

  /* 24. 0x6FD842D0: UNITS_GetGfxStateFlagsPtr */
  {
    const uint32_t va = 0x6FD842D0u;
    const char *nm = "UNITS_GetGfxStateFlagsPtr";
    RangeSpec r[4] = {
      { VA_SGPT_DATATABLES,      4 },
      { ADDR_DATATABLES + 0xC4,  4 },
      { ADDR_UNIT,             244 },
      { ADDR_STATLIST_EX,      100 },
    };
    struct { uint32_t u; uint32_t slex; uint32_t flags; uint32_t nStates; const char *cid; } cases[4] = {
      { 0u,        ADDR_STATLIST_EX, 0x80000000u, 185u, "null_unit_asserts_99" },
      { ADDR_UNIT, 0u,               0x80000000u, 185u, "null_statlist_returns_0" },
      { ADDR_UNIT, ADDR_STATLIST_EX, 0x00000000u, 185u, "non_extended_statlist_returns_0" },
      { ADDR_UNIT, ADDR_STATLIST_EX, 0x80000000u, 185u, "extended_statlist_returns_gfx_flags_ptr" },
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_DATATABLES, 0, 0x1000u);
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_STATLIST_EX, 0, 100);
      w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);
      w32(ADDR_DATATABLES + 0xC4, cases[i].nStates);
      w32(ADDR_UNIT + 0x5C, cases[i].slex);
      w32(ADDR_STATLIST_EX + 0x10, cases[i].flags);
      w32(ADDR_STATLIST_EX + 0x58, 0x50004000u);
      uint32_t args[1] = { cases[i].u };
      capture_pre(r, 4, pre);
      int asserted = 0;
      uint32_t eax = safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 4, pre, NULL, 0);
    }
  }

  /* 25. 0x6FD8E980: DATATBLS_GetObjectsTxtRecord */
  {
    const uint32_t va = 0x6FD8E980u;
    const char *nm = "DATATBLS_GetObjectsTxtRecord";
    RangeSpec r[1] = { { VA_OBJECTS_TXT_PTR, 8 } };
    struct { uint32_t id; const char *cid; } cases[4] = {
      { 10u,         "id_ge_count_asserts_dd" },
      { 0xFFFFFFFFu, "negative_id_asserts_de" },
      { 0u,          "valid_id_0_returns_base" },
      { 3u,          "valid_id_3_returns_base_plus_3_strides" },
    };
    for (int i = 0; i < 4; i++) {
      w32(VA_OBJECTS_TXT_PTR, 0x50010000u);
      w32(VA_OBJECTS_TXT_COUNT, 10u);
      uint32_t args[1] = { cases[i].id };
      capture_pre(r, 1, pre);
      int asserted = 0;
      uint32_t eax = safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 1, pre, NULL, 0);
    }
  }

  /* 26. 0x6FDB7C20: WAYPOINT_ActivateWaypoint */
  {
    const uint32_t va = 0x6FDB7C20u;
    const char *nm = "WAYPOINT_ActivateWaypoint";
    RangeSpec r[2] = {
      { VA_WP_BIT_TABLE, 452 },
      { ADDR_WAYPOINT0,   32 },
    };
    RangeSpec post_r[1] = { { ADDR_WAYPOINT0, 32 } };
    struct { uint32_t wpPtr; uint32_t tblCnt; uint32_t wpIdx; const char *cid; } cases[5] = {
      { 0u,             0x70u, 0u,     "null_waypoint_data_asserts_ed" },
      { ADDR_WAYPOINT0, 0x6Fu, 0u,     "bad_table_count_asserts_ee" },
      { ADDR_WAYPOINT0, 0x70u, 0x70u,  "oob_waypoint_idx_asserts_f1" },
      { ADDR_WAYPOINT0, 0x70u, 0u,     "activate_waypoint_0" },
      { ADDR_WAYPOINT0, 0x70u, 19u,    "activate_waypoint_19_in_second_word" },
    };
    for (int i = 0; i < 5; i++) {
      memset((void *)(uintptr_t)ADDR_WAYPOINT0, 0, 32);
      w16(ADDR_WAYPOINT0 + 0, 0x0102u);
      w16(ADDR_WAYPOINT0 + 4, 0x0002u);
      w32(VA_WP_TABLE_COUNT, cases[i].tblCnt);
      uint32_t args[2] = { cases[i].wpPtr, cases[i].wpIdx };
      capture_pre(r, 2, pre);
      int asserted = 0;
      safe_stdcall2(va, args[0], args[1], &asserted);
      w32(VA_WP_TABLE_COUNT, 0x70u);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 2, 0u, 0u, asserted, g_assert_line, r, 2, pre, post_r, 1);
    }
  }

  /* 27. 0x6FDB7C90: WAYPOINT_GetWaypointState */
  {
    const uint32_t va = 0x6FDB7C90u;
    const char *nm = "WAYPOINT_GetWaypointState";
    RangeSpec r[2] = {
      { VA_WP_BIT_TABLE, 452 },
      { ADDR_WAYPOINT0,   32 },
    };
    struct { uint32_t wpPtr; uint32_t tblCnt; uint32_t wpIdx; uint16_t wordVal; const char *cid; } cases[5] = {
      { 0u,             0x70u, 0u,    0x0020u, "null_waypoint_data_asserts_dd" },
      { ADDR_WAYPOINT0, 0x6Fu, 0u,    0x0020u, "bad_table_count_asserts_de" },
      { ADDR_WAYPOINT0, 0x70u, 0x70u, 0x0020u, "oob_waypoint_idx_asserts_e1" },
      { ADDR_WAYPOINT0, 0x70u, 5u,    0x0020u, "waypoint_5_active_returns_mask" },
      { ADDR_WAYPOINT0, 0x70u, 5u,    0xFFDFu, "waypoint_5_inactive_returns_0" },
    };
    for (int i = 0; i < 5; i++) {
      memset((void *)(uintptr_t)ADDR_WAYPOINT0, 0, 32);
      w16(ADDR_WAYPOINT0 + 0, 0x0102u);
      w16(ADDR_WAYPOINT0 + 2, cases[i].wordVal);
      w32(VA_WP_TABLE_COUNT, cases[i].tblCnt);
      uint32_t args[2] = { cases[i].wpPtr, cases[i].wpIdx };
      capture_pre(r, 2, pre);
      int asserted = 0;
      uint32_t eax = safe_stdcall2(va, args[0], args[1], &asserted);
      w32(VA_WP_TABLE_COUNT, 0x70u);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 2, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 2, pre, NULL, 0);
    }
  }

  /* 28. 0x6FDB7D00: WAYPOINT_CopyAndValidateWaypointData */
  {
    const uint32_t va = 0x6FDB7D00u;
    const char *nm = "WAYPOINT_CopyAndValidateWaypointData";
    RangeSpec r[2] = {
      { ADDR_WAYPOINT0, 16 },
      { ADDR_WAYPOINT1, 16 },
    };
    struct { uint16_t magic; const char *cid; } cases[4] = {
      { 0x9999u, "invalid_magic_asserts_113" },
      { 0x0102u, "valid_magic_0102_copies_16_bytes" },
      { 0x0000u, "zero_magic_upgrades_to_0102_and_copies" },
      { 0x0101u, "legacy_magic_0101_upgrades_to_0102_and_copies" },
    };
    for (int i = 0; i < 4; i++) {
      for (int k = 0; k < 4; k++) {
        w32(ADDR_WAYPOINT0 + k * 4, 0x11223300u + (uint32_t)k);
        w32(ADDR_WAYPOINT1 + k * 4, 0xCCCCCCCCu);
      }
      w16(ADDR_WAYPOINT0 + 0, cases[i].magic);
      uint32_t args[2] = { ADDR_WAYPOINT0, ADDR_WAYPOINT1 };
      capture_pre(r, 2, pre);
      int asserted = 0;
      safe_stdcall2(va, args[0], args[1], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 2, 0u, 0u, asserted, g_assert_line, r, 2, pre, r, 2);
    }
  }

  /* 29. 0x6FDBA350: MISSILE_FreeMissileData */
  {
    const uint32_t va = 0x6FDBA350u;
    const char *nm = "MISSILE_FreeMissileData";
    RangeSpec r[1] = { { ADDR_UNIT, 244 } };
    struct { uint32_t u; uint32_t ut; uint32_t md; const char *cid; } cases[4] = {
      { 0u,        3u, ADDR_MISSILE_DATA, "null_unit_noop" },
      { ADDR_UNIT, 1u, ADDR_MISSILE_DATA, "non_missile_unit_noop" },
      { ADDR_UNIT, 3u, 0u,                "null_missile_data_noop" },
      { ADDR_UNIT, 3u, ADDR_MISSILE_DATA, "valid_missile_frees_and_clears_ptr" },
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x08, 0xCAFE0003u);
      w32(ADDR_UNIT + 0x14, cases[i].md);
      uint32_t args[1] = { cases[i].u };
      capture_pre(r, 1, pre);
      int asserted = 0;
      safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 1, 0u, 0u, asserted, g_assert_line, r, 1, pre, r, 1);
    }
  }

  /* 30. 0x6FDBA390: MISSILE_AllocMissileData */
  {
    const uint32_t va = 0x6FDBA390u;
    const char *nm = "MISSILE_AllocMissileData";
    RangeSpec r[1] = { { ADDR_UNIT, 244 } };
    struct { uint32_t u; uint32_t ut; uint32_t md; const char *cid; } noop_cases[3] = {
      { 0u,        3u, 0u,                "null_unit_noop" },
      { ADDR_UNIT, 1u, 0u,                "non_missile_unit_noop" },
      { ADDR_UNIT, 3u, ADDR_MISSILE_DATA, "existing_missile_data_noop" },
    };
    for (int i = 0; i < 3; i++) {
      reset_heap();
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      w32(ADDR_UNIT + 0x00, noop_cases[i].ut);
      w32(ADDR_UNIT + 0x08, 0xCAFE0004u);
      w32(ADDR_UNIT + 0x14, noop_cases[i].md);
      uint32_t args[1] = { noop_cases[i].u };
      capture_pre(r, 1, pre);
      int asserted = 0;
      safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, noop_cases[i].cid, args, 1, 0u, 0u, asserted, g_assert_line, r, 1, pre, r, 1);
    }
    /* Case 4: valid missile with pUnitData == 0 -> allocates 52B at HEAP_BASE and sets +0x1C = 0xFFFFFFFF */
    {
      RangeSpec post_r[2] = {
        { ADDR_UNIT, 244 },
        { HEAP_BASE,  52 },
      };
      reset_heap();
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      w32(ADDR_UNIT + 0x00, 3u);
      w32(ADDR_UNIT + 0x08, 0xCAFE0004u);
      w32(ADDR_UNIT + 0x14, 0u);
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(r, 1, pre);
      int asserted = 0;
      safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, "allocates_52_bytes_and_inits_owner_id_neg1", args, 1, 0u, 0u, asserted, g_assert_line, r, 1, pre, post_r, 2);
    }
  }
}

/* =========================================================================
 * B041 EMITTER (12 hostImport functions -> b041-vectors.ndjson)
 * ========================================================================= */
static void emit_b041(FILE *fp) {
  uint8_t *pre[8];

  /* 1. 0x6FD7E960: UNITS_GetField7C (__fastcall ecx=pUnit) */
  {
    const uint32_t va = 0x6FD7E960u;
    const char *nm = "UNITS_GetField7C";
    RangeSpec r[1] = { { ADDR_UNIT, 244 } };
    struct { uint32_t u; uint32_t val; const char *cid; } cases[3] = {
      { 0u,        0x13579BDFu, "null_unit_asserts_1513" },
      { ADDR_UNIT, 0x13579BDFu, "valid_unit_returns_field7c" },
      { ADDR_UNIT, 0u,          "valid_unit_returns_zero" },
    };
    for (int i = 0; i < 3; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      w32(ADDR_UNIT + 0x7C, cases[i].val);
      uint32_t args[1] = { cases[i].u };
      capture_pre(r, 1, pre);
      int asserted = 0;
      uint32_t eax = safe_fastcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 1, pre, NULL, 0);
    }
  }

  /* 2. 0x6FD7E990: UNITS_SetField7C (__fastcall ecx=pUnit, edx=dwValue) */
  {
    const uint32_t va = 0x6FD7E990u;
    const char *nm = "UNITS_SetField7C";
    RangeSpec r[1] = { { ADDR_UNIT, 244 } };
    struct { uint32_t u; uint32_t val; const char *cid; } cases[3] = {
      { 0u,        0x2468ACE0u, "null_unit_asserts_150b" },
      { ADDR_UNIT, 0x2468ACE0u, "valid_unit_writes_field7c" },
      { ADDR_UNIT, 0u,          "valid_unit_clears_field7c" },
    };
    for (int i = 0; i < 3; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      w32(ADDR_UNIT + 0x7C, 0x99999999u);
      uint32_t args[2] = { cases[i].u, cases[i].val };
      capture_pre(r, 1, pre);
      int asserted = 0;
      safe_fastcall2_void(va, args[0], args[1], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 2, 0u, 0u, asserted, g_assert_line, r, 1, pre, r, 1);
    }
  }

  /* 3. 0x6FD7EA30: UNITS_SetObjectPortalFlags */
  {
    const uint32_t va = 0x6FD7EA30u;
    const char *nm = "UNITS_SetObjectPortalFlags";
    RangeSpec r[2] = {
      { ADDR_UNIT,        244 },
      { ADDR_OBJECT_DATA,  56 },
    };
    RangeSpec post_r[1] = { { ADDR_OBJECT_DATA, 56 } };
    struct { uint32_t u; uint32_t ut; uint32_t fl; const char *cid; } cases[4] = {
      { 0u,        2u, 0xABu,   "null_unit_asserts_fef" },
      { ADDR_UNIT, 0u, 0xABu,   "non_object_asserts_ff0" },
      { ADDR_UNIT, 2u, 0xABu,   "valid_object_writes_portal_flags_ab" },
      { ADDR_UNIT, 2u, 0x1234u, "valid_object_masks_low_byte_34" },
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_OBJECT_DATA, 0xEE, 56);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x14, ADDR_OBJECT_DATA);
      uint32_t args[2] = { cases[i].u, cases[i].fl };
      capture_pre(r, 2, pre);
      int asserted = 0;
      safe_stdcall2(va, args[0], args[1], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 2, 0u, 0u, asserted, g_assert_line, r, 2, pre, post_r, 1);
    }
  }

  /* 4. 0x6FD7EA70: UNITS_GetObjectPortalFlags (retMask 0xFF) */
  {
    const uint32_t va = 0x6FD7EA70u;
    const char *nm = "UNITS_GetObjectPortalFlags";
    RangeSpec r[2] = {
      { ADDR_UNIT,        244 },
      { ADDR_OBJECT_DATA,  56 },
    };
    struct { uint32_t u; uint32_t ut; uint8_t fl; const char *cid; } cases[4] = {
      { 0u,        2u, 0x5Au, "null_unit_asserts_fe4" },
      { ADDR_UNIT, 1u, 0x5Au, "non_object_asserts_fe5" },
      { ADDR_UNIT, 2u, 0x5Au, "valid_object_returns_5a" },
      { ADDR_UNIT, 2u, 0xFFu, "valid_object_returns_ff" },
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_OBJECT_DATA, 0, 56);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x14, ADDR_OBJECT_DATA);
      w8(ADDR_OBJECT_DATA + 0x05, cases[i].fl);
      uint32_t args[1] = { cases[i].u };
      capture_pre(r, 2, pre);
      int asserted = 0;
      uint32_t eax = safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 1, 0xFFu, eax, asserted, g_assert_line, r, 2, pre, NULL, 0);
    }
  }

  /* 5. 0x6FD7EAF0: UNITS_GetPlayerActiveWeaponFlags */
  {
    const uint32_t va = 0x6FD7EAF0u;
    const char *nm = "UNITS_GetPlayerActiveWeaponFlags";
    RangeSpec r[2] = {
      { ADDR_UNIT,        244 },
      { ADDR_PLAYER_DATA, 364 },
    };
    struct { uint32_t u; uint32_t ut; uint32_t fl; const char *cid; } cases[4] = {
      { 0u,        0u, 1u,          "null_unit_asserts_fc9" },
      { ADDR_UNIT, 1u, 1u,          "non_player_asserts_fca" },
      { ADDR_UNIT, 0u, 1u,          "valid_player_returns_1" },
      { ADDR_UNIT, 0u, 0x80000002u, "valid_player_returns_high_bit" },
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_PLAYER_DATA, 0, 364);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x14, ADDR_PLAYER_DATA);
      w32(ADDR_PLAYER_DATA + 0x2C, cases[i].fl);
      uint32_t args[1] = { cases[i].u };
      capture_pre(r, 2, pre);
      int asserted = 0;
      uint32_t eax = safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 2, pre, NULL, 0);
    }
  }

  /* 6. 0x6FD7EB30: UNITS_SetPlayerActiveWeaponFlags */
  {
    const uint32_t va = 0x6FD7EB30u;
    const char *nm = "UNITS_SetPlayerActiveWeaponFlags";
    RangeSpec r[2] = {
      { ADDR_UNIT,        244 },
      { ADDR_PLAYER_DATA, 364 },
    };
    RangeSpec post_r[1] = { { ADDR_PLAYER_DATA, 364 } };
    struct { uint32_t u; uint32_t ut; uint32_t fl; const char *cid; } cases[4] = {
      { 0u,        0u, 1u,          "null_unit_asserts_fbf" },
      { ADDR_UNIT, 1u, 1u,          "non_player_asserts_fc0" },
      { ADDR_UNIT, 0u, 1u,          "valid_player_writes_1" },
      { ADDR_UNIT, 0u, 0xDEADBEEFu, "valid_player_writes_deadbeef" },
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_PLAYER_DATA, 0, 364);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x14, ADDR_PLAYER_DATA);
      uint32_t args[2] = { cases[i].u, cases[i].fl };
      capture_pre(r, 2, pre);
      int asserted = 0;
      safe_stdcall2(va, args[0], args[1], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 2, 0u, 0u, asserted, g_assert_line, r, 2, pre, post_r, 1);
    }
  }

  /* 7. 0x6FD7EB70: UNITS_GetPlayerData */
  {
    const uint32_t va = 0x6FD7EB70u;
    const char *nm = "UNITS_GetPlayerData";
    RangeSpec r[1] = { { ADDR_UNIT, 244 } };
    struct { uint32_t u; uint32_t ut; uint32_t pd; const char *cid; } cases[4] = {
      { 0u,        0u, ADDR_PLAYER_DATA, "null_unit_asserts_fb4" },
      { ADDR_UNIT, 2u, ADDR_PLAYER_DATA, "non_player_asserts_fb6" },
      { ADDR_UNIT, 0u, ADDR_PLAYER_DATA, "valid_player_returns_playerdata_ptr" },
      { ADDR_UNIT, 0u, 0u,               "valid_player_returns_null_playerdata_ptr" },
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x14, cases[i].pd);
      uint32_t args[1] = { cases[i].u };
      capture_pre(r, 1, pre);
      int asserted = 0;
      uint32_t eax = safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 1, pre, NULL, 0);
    }
  }

  /* 8. 0x6FD7EBB0: UNITS_GetPlayerName */
  {
    const uint32_t va = 0x6FD7EBB0u;
    const char *nm = "UNITS_GetPlayerName";
    RangeSpec r[1] = { { ADDR_UNIT, 244 } };
    struct { uint32_t u; uint32_t ut; uint32_t pd; const char *cid; } cases[4] = {
      { 0u,        0u, ADDR_PLAYER_DATA, "null_unit_asserts_fa5" },
      { ADDR_UNIT, 0u, 0u,               "null_playerdata_asserts_fa7" },
      { ADDR_UNIT, 1u, ADDR_PLAYER_DATA, "non_player_asserts_fa8" },
      { ADDR_UNIT, 0u, ADDR_PLAYER_DATA, "valid_player_returns_name_ptr" },
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x14, cases[i].pd);
      uint32_t args[1] = { cases[i].u };
      capture_pre(r, 1, pre);
      int asserted = 0;
      uint32_t eax = safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 1, pre, NULL, 0);
    }
  }

  /* 9. 0x6FD7EC00: UNITS_SetPlayerName */
  {
    const uint32_t va = 0x6FD7EC00u;
    const char *nm = "UNITS_SetPlayerName";
    RangeSpec r[3] = {
      { ADDR_UNIT,        244 },
      { ADDR_PLAYER_DATA,  32 },
      { ADDR_STR_BUF,      32 },
    };
    RangeSpec post_r[1] = { { ADDR_PLAYER_DATA, 32 } };
    struct { uint32_t u; uint32_t ut; uint32_t pd; uint32_t sz; const char *str; const char *cid; } cases[6] = {
      { 0u,        0u, ADDR_PLAYER_DATA, ADDR_STR_BUF, "Hero",        "null_unit_asserts_f97" },
      { ADDR_UNIT, 0u, 0u,               ADDR_STR_BUF, "Hero",        "null_playerdata_asserts_f99" },
      { ADDR_UNIT, 1u, ADDR_PLAYER_DATA, ADDR_STR_BUF, "Hero",        "non_player_asserts_f9a" },
      { ADDR_UNIT, 0u, ADDR_PLAYER_DATA, ADDR_STR_BUF, "Hero",        "copies_short_name_without_zero_padding_tail" },
      { ADDR_UNIT, 0u, ADDR_PLAYER_DATA, ADDR_STR_BUF, "",            "copies_empty_string_terminator_only" },
      { ADDR_UNIT, 0u, ADDR_PLAYER_DATA, 0u,           "Hero",        "null_szname_leaves_playerdata_unchanged" },
    };
    for (int i = 0; i < 6; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_PLAYER_DATA, 0xAA, 32);
      memset((void *)(uintptr_t)ADDR_STR_BUF, 0, 32);
      strcpy((char *)(uintptr_t)ADDR_STR_BUF, cases[i].str);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x14, cases[i].pd);
      uint32_t args[2] = { cases[i].u, cases[i].sz };
      capture_pre(r, 3, pre);
      int asserted = 0;
      safe_stdcall2(va, args[0], args[1], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 2, 0u, 0u, asserted, g_assert_line, r, 3, pre, post_r, 1);
    }
  }

  /* 10. 0x6FD7EC60: UNITS_SetObjectShrineTxt */
  {
    const uint32_t va = 0x6FD7EC60u;
    const char *nm = "UNITS_SetObjectShrineTxt";
    RangeSpec r[2] = {
      { ADDR_UNIT,        244 },
      { ADDR_OBJECT_DATA,  56 },
    };
    RangeSpec post_r[1] = { { ADDR_OBJECT_DATA, 56 } };
    struct { uint32_t u; uint32_t ut; uint32_t ptr; const char *cid; } cases[4] = {
      { 0u,        2u, 0x50009000u, "null_unit_asserts_e60" },
      { ADDR_UNIT, 0u, 0x50009000u, "non_object_asserts_e67" },
      { ADDR_UNIT, 2u, 0x50009000u, "valid_object_sets_shrine_txt_ptr" },
      { ADDR_UNIT, 2u, 0u,          "valid_object_clears_shrine_txt_ptr" },
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_OBJECT_DATA, 0, 56);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x14, ADDR_OBJECT_DATA);
      w32(ADDR_OBJECT_DATA + 0x08, 0x99999999u);
      uint32_t args[2] = { cases[i].u, cases[i].ptr };
      capture_pre(r, 2, pre);
      int asserted = 0;
      safe_stdcall2(va, args[0], args[1], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 2, 0u, 0u, asserted, g_assert_line, r, 2, pre, post_r, 1);
    }
  }

  /* 11. 0x6FD7ECB0: UNITS_GetObjectShrineTxt */
  {
    const uint32_t va = 0x6FD7ECB0u;
    const char *nm = "UNITS_GetObjectShrineTxt";
    RangeSpec r[2] = {
      { ADDR_UNIT,        244 },
      { ADDR_OBJECT_DATA,  56 },
    };
    struct { uint32_t u; uint32_t ut; uint32_t ptr; const char *cid; } cases[4] = {
      { 0u,        2u, 0x50009000u, "null_unit_asserts_e4e" },
      { ADDR_UNIT, 1u, 0x50009000u, "non_object_asserts_e55" },
      { ADDR_UNIT, 2u, 0x50009000u, "valid_object_returns_shrine_txt_ptr" },
      { ADDR_UNIT, 2u, 0u,          "valid_object_returns_null_shrine_txt_ptr" },
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_OBJECT_DATA, 0, 56);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x14, ADDR_OBJECT_DATA);
      w32(ADDR_OBJECT_DATA + 0x08, cases[i].ptr);
      uint32_t args[1] = { cases[i].u };
      capture_pre(r, 2, pre);
      int asserted = 0;
      uint32_t eax = safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 2, pre, NULL, 0);
    }
  }

  /* 12. 0x6FD7ECF0: UNITS_GetObjectTxt */
  {
    const uint32_t va = 0x6FD7ECF0u;
    const char *nm = "UNITS_GetObjectTxt";
    RangeSpec r[2] = {
      { ADDR_UNIT,        244 },
      { ADDR_OBJECT_DATA,  56 },
    };
    struct { uint32_t u; uint32_t ut; uint32_t ptr; const char *cid; } cases[4] = {
      { 0u,        2u, 0x5000A000u, "null_unit_asserts_e3c" },
      { ADDR_UNIT, 1u, 0x5000A000u, "non_object_asserts_e43" },
      { ADDR_UNIT, 2u, 0x5000A000u, "valid_object_returns_object_txt_ptr" },
      { ADDR_UNIT, 2u, 0u,          "valid_object_returns_null_object_txt_ptr" },
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_OBJECT_DATA, 0, 56);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x14, ADDR_OBJECT_DATA);
      w32(ADDR_OBJECT_DATA + 0x00, cases[i].ptr);
      uint32_t args[1] = { cases[i].u };
      capture_pre(r, 2, pre);
      int asserted = 0;
      uint32_t eax = safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 2, pre, NULL, 0);
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

  DWORD old_prot = 0;
  VirtualProtect((void *)(uintptr_t)0x6FDD9000u, 0x1000u, PAGE_READWRITE, &old_prot);
  VirtualProtect((void *)(uintptr_t)0x6FDE4000u, 0x10000u, PAGE_READWRITE, &old_prot);

  w32(0x6FDD90D4u, (uint32_t)(uintptr_t)&stub_fog_assert_line);
  w32(0x6FDD90D0u, (uint32_t)(uintptr_t)&stub_fog_10045);
  w32(0x6FDD90CCu, (uint32_t)(uintptr_t)&stub_fog_10046);

  char path[512];

  snprintf(path, sizeof(path), "%s/b038-vectors.ndjson", out_dir);
  FILE *fp38 = fopen(path, "wb");
  if (!fp38) { perror("fopen b038"); return 5; }
  emit_b038(fp38);
  fclose(fp38);

  snprintf(path, sizeof(path), "%s/b041-vectors.ndjson", out_dir);
  FILE *fp41 = fopen(path, "wb");
  if (!fp41) { perror("fopen b041"); return 6; }
  emit_b041(fp41);
  fclose(fp41);

  printf("Emitted real-DLL vectors for B038 and B041 into %s\n", out_dir);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
