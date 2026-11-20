/*
 * k1r2-laneA-it6-emitter.c
 *
 * Real-DLL Wine differential vector emitter for Iteration 6 Lane A:
 *   - B032 (10 hostImport functions -> b032-vectors.ndjson)
 *   - B035 (20 hostImport functions -> b035-vectors.ndjson)
 *
 * Loads real Fog.dll (0x6FF50000) and D2Common.dll (0x6FD50000), maps deterministic
 * arena at 0x22000000 and bump-heap at 0x40000000, hooks Fog.#10045 (alloc),
 * Fog.#10046 (free), and Fog.#10265 (assert line capture + longjmp), executes
 * every target VA in-process, and emits NDJSON vectors.
 *
 * Build:
 *   i686-w64-mingw32-gcc -O2 -m32 -Wall -Wextra \
 *     -o /tmp/k1r2-laneA-it6-emitter.exe tools/oracle/vectors/k1r2-laneA-it6-emitter.c
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
#define ADDR_QUEST_REC     0x22002000u /* 20 bytes (D2BitBufferStrc) */
#define ADDR_QUEST_BUF     0x22002100u /* 96 bytes (0x60 quest bit buffer) */
#define ADDR_OUT_BUF       0x22002400u /* 512 bytes (output / copy buffer) */
#define ADDR_STATIC_PATH   0x22002800u /* 64 bytes (D2StaticPathStrc) */
#define ADDR_SKILL_LIST    0x22002A00u /* 32 bytes (D2SkillListStrc) */
#define ADDR_PLAYER_DATA   0x22003000u /* 364 bytes (0x16C D2PlayerDataStrc) */
#define ADDR_QUEST_REC0    0x22003200u /* 20 bytes */
#define ADDR_QUEST_BUF0    0x22003240u /* 96 bytes */
#define ADDR_QUEST_REC1    0x22003300u /* 20 bytes */
#define ADDR_QUEST_BUF1    0x22003340u /* 96 bytes */
#define ADDR_QUEST_REC2    0x22003400u /* 20 bytes */
#define ADDR_QUEST_BUF2    0x22003440u /* 96 bytes */
#define ADDR_WAYPOINT0     0x22003500u /* 16 bytes */
#define ADDR_WAYPOINT1     0x22003520u /* 16 bytes */
#define ADDR_WAYPOINT2     0x22003540u /* 16 bytes */
#define ADDR_INTRO_TBL     0x22003600u /* 32 bytes (8 u32s) */
#define ADDR_INV_TXT       0x22004000u /* 32 * 0x108 = 8448 bytes */
#define ADDR_INVENTORY     0x22007000u /* 64 bytes (D2InventoryStrc) */
#define ADDR_CORPSE0       0x22007100u /* 16 bytes (D2CorpseStrc) */
#define ADDR_CORPSE1       0x22007120u /* 16 bytes */
#define ADDR_CORPSE2       0x22007140u /* 16 bytes */
#define ADDR_NODE0         0x22007200u /* 16 bytes (D2InventoryNodeStrc) */
#define ADDR_NODE1         0x22007220u /* 16 bytes */
#define ADDR_DATATABLES    0x22008000u /* 0x1000 bytes (sgptDataTables) */
#define ADDR_ITEM_DATA     0x22009400u /* 116 bytes (D2ItemDataStrc) */
#define ADDR_BITSTREAM     0x22009600u /* 64 bytes (raw item bitstream) */
#define ADDR_ITEMS_TXT     0x2200A000u /* 8 * 0x1A8 = 3392 bytes */
#define ADDR_LINKER        0x2200B000u /* 16 bytes (D2TxtLinkStrc) */
#define ADDR_LINK_ENTRIES  0x2200B100u /* 64 bytes (D2TxtLinkEntryStrc[]) */

/* D2Common.dll .data / .bss VAs */
#define VA_SGPT_DATATABLES 0x6FDE9E1Cu
#define VA_WP_WORD_IDX     0x6FDE9C58u
#define VA_WP_MASK         0x6FDE9C5Au
#define VA_INTRO_TBL_PTR   0x6FDF1420u
#define VA_INTRO_TBL_CNT   0x6FDF1424u
#define VA_INV_TXT_PTR     0x6FDF13DCu
#define VA_ITEMS_TXT_CNT   0x6FDEFB94u
#define VA_ITEMS_TXT_PTR   0x6FDEFB98u
#define VA_WEAP_CLASS_CNT  0x6FDEF020u
#define VA_WEAP_CLASS_TBL  0x6FDEF028u
#define VA_ITEMS_CODE_LINK 0x6FDEFF6Cu

static inline void w8(uint32_t addr, uint8_t v)   { *(volatile uint8_t *)(uintptr_t)addr = v; }
static inline void w16(uint32_t addr, uint16_t v) { *(volatile uint16_t *)(uintptr_t)addr = v; }
static inline void w32(uint32_t addr, uint32_t v) { *(volatile uint32_t *)(uintptr_t)addr = v; }

static jmp_buf g_jmp_buf;
static int g_in_test_call = 0;
static uint32_t g_assert_line = 0;
static uint32_t g_heap_top = HEAP_BASE;
static int g_force_alloc_null = 0;

static void reset_heap(void) {
  g_heap_top = HEAP_BASE;
  g_force_alloc_null = 0;
  memset((void *)(uintptr_t)HEAP_BASE, 0, 0x2000u);
}

/* Hook for Fog.#10265 (0x6FD5921C -> IAT 0x6FDD90D4):
 * In D2Common assertion paths:
 *   push <line>
 *   call 0x6FD5921C (jmp [0x6FDD90D4])
 */
static void __cdecl stub_fog_assert_line(uint32_t line) {
  g_assert_line = line;
  if (g_in_test_call) {
    g_in_test_call = 0;
    longjmp(g_jmp_buf, 1);
  }
}

/* Hook for Fog.#10045 (0x6FD5922E -> IAT 0x6FDD90D0):
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
 * Calling convention wrappers
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
static uint32_t call_stdcall4(uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3) {
  typedef uint32_t (__stdcall *Fn)(uint32_t, uint32_t, uint32_t, uint32_t);
  return ((Fn)(uintptr_t)va)(a0, a1, a2, a3);
}
static __attribute__((noinline)) uint32_t call_stdcall4_zero_eax(
    uint32_t va, const uint32_t *args) {
  uint32_t out_eax = 0;
  __asm__ volatile (
    "pushl 12(%2)\n\t"
    "pushl 8(%2)\n\t"
    "pushl 4(%2)\n\t"
    "pushl 0(%2)\n\t"
    "call *%1\n\t"
    : "+a"(out_eax)
    : "c"(va), "d"(args)
    : "cc", "memory"
  );
  return out_eax;
}
static uint32_t call_stdcall5(uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3, uint32_t a4) {
  typedef uint32_t (__stdcall *Fn)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
  return ((Fn)(uintptr_t)va)(a0, a1, a2, a3, a4);
}

/* Custom LTCG wrapper for 0x6FD6E420: eax=pItem, ecx=pOutPageLimits6, ret (void) */
static __attribute__((noinline)) void call_eax_ecx_ret_void(uint32_t va, uint32_t a_eax, uint32_t a_ecx) {
  __asm__ volatile (
    "call *%2\n\t"
    : "+a"(a_eax), "+c"(a_ecx)
    : "r"(va)
    : "edx", "cc", "memory"
  );
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

static __attribute__((noinline)) uint32_t safe_stdcall4(uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3, int *out_asserted) {
  g_assert_line = 0;
  if (setjmp(g_jmp_buf) == 0) {
    g_in_test_call = 1;
    uint32_t r = call_stdcall4(va, a0, a1, a2, a3);
    g_in_test_call = 0;
    *out_asserted = 0;
    return r;
  }
  *out_asserted = 1;
  return 0u;
}

static __attribute__((noinline)) void safe_eax_ecx_ret_void(uint32_t va, uint32_t a_eax, uint32_t a_ecx, int *out_asserted) {
  g_assert_line = 0;
  if (setjmp(g_jmp_buf) == 0) {
    g_in_test_call = 1;
    call_eax_ecx_ret_void(va, a_eax, a_ecx);
    g_in_test_call = 0;
    *out_asserted = 0;
    return;
  }
  *out_asserted = 1;
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
 * B032 EMITTER (10 hostImport functions -> b032-vectors.ndjson)
 * ========================================================================= */
static void emit_b032(FILE *fp) {
  uint8_t *pre[16];

  /* 1. 0x6FD7CF40: QUESTRECORD_CopyRecordToBuffer */
  {
    const uint32_t va = 0x6FD7CF40u;
    const char *nm = "QUESTRECORD_CopyRecordToBuffer";
    RangeSpec r[3] = {
      { ADDR_QUEST_REC, 20 },
      { ADDR_QUEST_BUF, 96 },
      { ADDR_OUT_BUF,   96 },
    };
    RangeSpec post_r[1] = { { ADDR_OUT_BUF, 96 } };
    for (int i = 0; i < 6; i++) {
      memset((void *)(uintptr_t)ADDR_QUEST_REC, 0, 20);
      for (int k = 0; k < 24; k++) {
        w32(ADDR_QUEST_BUF + k * 4, 0x10203000u + (uint32_t)k);
        w32(ADDR_OUT_BUF + k * 4, 0xCCCCCCCCu);
      }
      w32(ADDR_QUEST_REC + 0x00, ADDR_QUEST_BUF);
      w32(ADDR_QUEST_REC + 0x04, 0x300u);

      uint32_t qd = ADDR_QUEST_REC;
      uint32_t dst = ADDR_OUT_BUF;
      uint32_t wsz = 0x60u;
      const char *cid = "valid_copy_96_bytes";
      if (i == 0) {
        cid = "bad_size_0x5f_asserts";
        wsz = 0x5Fu;
      } else if (i == 1) {
        cid = "bad_size_0_asserts";
        wsz = 0u;
      } else if (i == 2) {
        cid = "bad_size_0x61_asserts";
        wsz = 0x61u;
      } else if (i == 3) {
        cid = "valid_copy_96_bytes";
        wsz = 0x60u;
      } else if (i == 4) {
        cid = "valid_copy_alt_pattern";
        for (int k = 0; k < 24; k++) {
          w32(ADDR_QUEST_BUF + k * 4, 0xA5A50000u ^ (uint32_t)(k * 0x1111u));
        }
        wsz = 0x60u;
      } else {
        cid = "valid_copy_high_word_ignored";
        wsz = 0xABCD0060u;
      }
      uint32_t args[4] = { qd, dst, wsz, 1u };
      capture_pre(r, 3, pre);
      int asserted = 0;
      safe_stdcall4(va, args[0], args[1], args[2], args[3], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 4, 0u, 0u, asserted, g_assert_line, r, 3, pre, post_r, 1);
    }
  }

  /* 2. 0x6FD7CFC0: QUESTRECORD_AllocRecord */
  {
    const uint32_t va = 0x6FD7CFC0u;
    const char *nm = "QUESTRECORD_AllocRecord";
    RangeSpec post_r[1] = { { HEAP_BASE, 116 } };
    uint32_t pools[2] = { 0u, 0xCAFE0010u };
    const char *cids[2] = { "alloc_record_null_pool", "alloc_record_custom_pool" };
    for (int i = 0; i < 2; i++) {
      reset_heap();
      uint32_t args[1] = { pools[i] };
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line_ex(fp, va, nm, cids[i], args, 1, 0xFFFFFFFFu, eax, 0, 0u, NULL, 0, pre, post_r, 1);
    }
  }

  /* 3. 0x6FD7D020: QUESTRECORD_ClearQuestStateBits2To11 */
  {
    const uint32_t va = 0x6FD7D020u;
    const char *nm = "QUESTRECORD_ClearQuestStateBits2To11";
    RangeSpec r[2] = {
      { ADDR_QUEST_REC, 20 },
      { ADDR_QUEST_BUF, 96 },
    };
    RangeSpec post_r[1] = { { ADDR_QUEST_BUF, 96 } };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_QUEST_REC, 0, 20);
      memset((void *)(uintptr_t)ADDR_QUEST_BUF, 0xFF, 96);
      w32(ADDR_QUEST_REC + 0x00, ADDR_QUEST_BUF);
      w32(ADDR_QUEST_REC + 0x04, 0x300u);
      uint32_t qd = (i == 0) ? 0u : ADDR_QUEST_REC;
      uint32_t nq = (i == 1) ? 0u : (i == 2) ? 5u : 40u;
      const char *cid = (i == 0) ? "null_quest_data_asserts"
                      : (i == 1) ? "clear_bits_quest_0"
                      : (i == 2) ? "clear_bits_quest_5"
                                 : "clear_bits_quest_40";
      uint32_t args[2] = { qd, nq };
      capture_pre(r, 2, pre);
      int asserted = 0;
      safe_stdcall2(va, args[0], args[1], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 2, 0u, 0u, asserted, g_assert_line, r, 2, pre, post_r, 1);
    }
  }

  /* 4. 0x6FD7D070: QUESTRECORD_ClearQuestState */
  {
    const uint32_t va = 0x6FD7D070u;
    const char *nm = "QUESTRECORD_ClearQuestState";
    RangeSpec r[2] = {
      { ADDR_QUEST_REC, 20 },
      { ADDR_QUEST_BUF, 96 },
    };
    RangeSpec post_r[1] = { { ADDR_QUEST_BUF, 96 } };
    struct { uint32_t qd; uint32_t nq; uint32_t ns; const char *cid; } cases[5] = {
      { 0u,             0u,  0u,  "null_quest_data_asserts" },
      { ADDR_QUEST_REC, 0u,  0u,  "clear_q0_s0" },
      { ADDR_QUEST_REC, 0u,  7u,  "clear_q0_s7" },
      { ADDR_QUEST_REC, 3u,  13u, "clear_q3_s13" },
      { ADDR_QUEST_REC, 47u, 15u, "clear_q47_s15_last_bit" },
    };
    for (int i = 0; i < 5; i++) {
      memset((void *)(uintptr_t)ADDR_QUEST_REC, 0, 20);
      memset((void *)(uintptr_t)ADDR_QUEST_BUF, 0xFF, 96);
      w32(ADDR_QUEST_REC + 0x00, ADDR_QUEST_BUF);
      w32(ADDR_QUEST_REC + 0x04, 0x300u);
      uint32_t args[3] = { cases[i].qd, cases[i].nq, cases[i].ns };
      capture_pre(r, 2, pre);
      int asserted = 0;
      safe_stdcall3(va, args[0], args[1], args[2], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 3, 0u, 0u, asserted, g_assert_line, r, 2, pre, post_r, 1);
    }
  }

  /* 5. 0x6FD7D0B0: QUESTRECORD_SetQuestState */
  {
    const uint32_t va = 0x6FD7D0B0u;
    const char *nm = "QUESTRECORD_SetQuestState";
    RangeSpec r[2] = {
      { ADDR_QUEST_REC, 20 },
      { ADDR_QUEST_BUF, 96 },
    };
    RangeSpec post_r[1] = { { ADDR_QUEST_BUF, 96 } };
    struct { uint32_t qd; uint32_t nq; uint32_t ns; const char *cid; } cases[5] = {
      { 0u,             0u,  0u,  "null_quest_data_asserts" },
      { ADDR_QUEST_REC, 0u,  0u,  "set_q0_s0" },
      { ADDR_QUEST_REC, 0u,  7u,  "set_q0_s7" },
      { ADDR_QUEST_REC, 3u,  13u, "set_q3_s13" },
      { ADDR_QUEST_REC, 47u, 15u, "set_q47_s15_last_bit" },
    };
    for (int i = 0; i < 5; i++) {
      memset((void *)(uintptr_t)ADDR_QUEST_REC, 0, 20);
      memset((void *)(uintptr_t)ADDR_QUEST_BUF, 0x00, 96);
      w32(ADDR_QUEST_REC + 0x00, ADDR_QUEST_BUF);
      w32(ADDR_QUEST_REC + 0x04, 0x300u);
      uint32_t args[3] = { cases[i].qd, cases[i].nq, cases[i].ns };
      capture_pre(r, 2, pre);
      int asserted = 0;
      safe_stdcall3(va, args[0], args[1], args[2], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 3, 0u, 0u, asserted, g_assert_line, r, 2, pre, post_r, 1);
    }
  }

  /* 6. 0x6FD7FED0: UNITS_InitStaticPathCoords */
  {
    const uint32_t va = 0x6FD7FED0u;
    const char *nm = "UNITS_InitStaticPathCoords";
    RangeSpec r[2] = {
      { ADDR_UNIT, 244 },
      { ADDR_STATIC_PATH, 32 },
    };
    RangeSpec post_r[1] = { { ADDR_STATIC_PATH, 32 } };
    struct { uint32_t u; uint32_t rm; uint32_t x; uint32_t y; const char *cid; } cases[4] = {
      { 0u,        0x22005000u, 100u, 50u,         "null_unit_asserts" },
      { ADDR_UNIT, 0x22005000u, 100u, 50u,         "pos_x_gt_y" },
      { ADDR_UNIT, 0u,          20u,  80u,         "pos_x_lt_y_negative_iso_x" },
      { ADDR_UNIT, 0x22005100u, (uint32_t)-10, 5u, "signed_negative_x" },
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_STATIC_PATH, 0xAA, 32);
      w32(ADDR_UNIT + 0x2C, ADDR_STATIC_PATH);
      uint32_t args[4] = { cases[i].u, cases[i].rm, cases[i].x, cases[i].y };
      capture_pre(r, 2, pre);
      int asserted = 0;
      safe_stdcall4(va, args[0], args[1], args[2], args[3], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 4, 0u, 0u, asserted, g_assert_line, r, 2, pre, post_r, 1);
    }
  }

  /* 7. 0x6FD80420: UNITS_GetRightSkill & 8. 0x6FD80460: UNITS_GetLeftSkill */
  {
    struct { uint32_t va; const char *nm; } fns[2] = {
      { 0x6FD80420u, "UNITS_GetRightSkill" },
      { 0x6FD80460u, "UNITS_GetLeftSkill" },
    };
    RangeSpec r[2] = {
      { ADDR_UNIT, 244 },
      { ADDR_SKILL_LIST, 24 },
    };
    for (int f = 0; f < 2; f++) {
      for (int i = 0; i < 4; i++) {
        memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
        memset((void *)(uintptr_t)ADDR_SKILL_LIST, 0, 24);
        w32(ADDR_SKILL_LIST + 0x08, 0x2200AA08u);
        w32(ADDR_SKILL_LIST + 0x0C, 0x2200BB0Cu);
        uint32_t u = ADDR_UNIT;
        const char *cid = "null_unit_asserts";
        if (i == 0) {
          u = 0u;
        } else if (i == 1) {
          cid = "null_skill_list_asserts";
          w32(ADDR_UNIT + 0xA8, 0u);
        } else if (i == 2) {
          cid = "valid_skill_ptr";
          w32(ADDR_UNIT + 0xA8, ADDR_SKILL_LIST);
        } else {
          cid = "valid_null_skill_slot";
          w32(ADDR_UNIT + 0xA8, ADDR_SKILL_LIST);
          w32(ADDR_SKILL_LIST + 0x08, 0u);
          w32(ADDR_SKILL_LIST + 0x0C, 0u);
        }
        uint32_t args[1] = { u };
        capture_pre(r, 2, pre);
        int asserted = 0;
        uint32_t eax = safe_stdcall1(fns[f].va, args[0], &asserted);
        emit_ndjson_line_ex(fp, fns[f].va, fns[f].nm, cid, args, 1, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 2, pre, NULL, 0);
      }
    }
  }

  /* 9. 0x6FD80880: UNITS_FreePlayerData */
  {
    const uint32_t va = 0x6FD80880u;
    const char *nm = "UNITS_FreePlayerData";
    RangeSpec r[11] = {
      { ADDR_UNIT, 244 },
      { ADDR_PLAYER_DATA, 364 },
      { ADDR_QUEST_REC0, 20 },
      { ADDR_QUEST_BUF0, 96 },
      { ADDR_QUEST_REC1, 20 },
      { ADDR_QUEST_BUF1, 96 },
      { ADDR_QUEST_REC2, 20 },
      { ADDR_QUEST_BUF2, 96 },
      { ADDR_WAYPOINT0, 16 },
      { ADDR_WAYPOINT1, 16 },
      { ADDR_WAYPOINT2, 16 },
    };
    RangeSpec post_r[4] = {
      { ADDR_UNIT, 244 },
      { ADDR_WAYPOINT0, 16 },
      { ADDR_WAYPOINT1, 16 },
      { ADDR_WAYPOINT2, 16 },
    };
    for (int i = 0; i < 6; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_PLAYER_DATA, 0, 364);
      memset((void *)(uintptr_t)ADDR_QUEST_REC0, 0, 20);
      memset((void *)(uintptr_t)ADDR_QUEST_REC1, 0, 20);
      memset((void *)(uintptr_t)ADDR_QUEST_REC2, 0, 20);
      memset((void *)(uintptr_t)ADDR_WAYPOINT0, 0, 16);
      memset((void *)(uintptr_t)ADDR_WAYPOINT1, 0, 16);
      memset((void *)(uintptr_t)ADDR_WAYPOINT2, 0, 16);

      w32(ADDR_QUEST_REC0 + 0x00, ADDR_QUEST_BUF0);
      w32(ADDR_QUEST_REC1 + 0x00, ADDR_QUEST_BUF1);
      w32(ADDR_QUEST_REC2 + 0x00, ADDR_QUEST_BUF2);
      w32(ADDR_PLAYER_DATA + 0x10, ADDR_QUEST_REC0);
      w32(ADDR_PLAYER_DATA + 0x14, ADDR_QUEST_REC1);
      w32(ADDR_PLAYER_DATA + 0x18, ADDR_QUEST_REC2);
      w32(ADDR_PLAYER_DATA + 0x1C, ADDR_WAYPOINT0);
      w32(ADDR_PLAYER_DATA + 0x20, ADDR_WAYPOINT1);
      w32(ADDR_PLAYER_DATA + 0x24, ADDR_WAYPOINT2);
      w16(ADDR_WAYPOINT0 + 0x00, 0x0102u);
      w16(ADDR_WAYPOINT1 + 0x00, 0x0102u);
      w16(ADDR_WAYPOINT2 + 0x00, 0x0102u);
      w32(ADDR_UNIT + 0x14, ADDR_PLAYER_DATA);

      uint32_t u = ADDR_UNIT;
      const char *cid = "null_player_asserts";
      if (i == 0) {
        u = 0u;
      } else if (i == 1) {
        cid = "null_player_data_asserts";
        w32(ADDR_UNIT + 0x14, 0u);
      } else if (i == 2) {
        cid = "valid_all_quests_and_wp_0102";
      } else if (i == 3) {
        cid = "null_quest_slot1_and_legacy_wp_0_and_0101";
        w32(ADDR_PLAYER_DATA + 0x14, 0u);
        w16(ADDR_WAYPOINT0 + 0x00, 0x0000u);
        w16(ADDR_WAYPOINT1 + 0x00, 0x0101u);
      } else if (i == 4) {
        cid = "all_null_quests_valid_wps";
        w32(ADDR_PLAYER_DATA + 0x10, 0u);
        w32(ADDR_PLAYER_DATA + 0x14, 0u);
        w32(ADDR_PLAYER_DATA + 0x18, 0u);
      } else {
        cid = "invalid_waypoint_magic_asserts";
        w16(ADDR_WAYPOINT2 + 0x00, 0x9999u);
      }
      uint32_t args[2] = { 0xCAFE0020u, u };
      capture_pre(r, 11, pre);
      int asserted = 0;
      safe_stdcall2(va, args[0], args[1], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 2, 0u, 0u, asserted, g_assert_line, r, 11, pre, post_r, 4);
    }
  }

  /* 10. 0x6FD80970: UNITS_InitPlayerData */
  {
    const uint32_t va = 0x6FD80970u;
    const char *nm = "UNITS_InitPlayerData";
    RangeSpec r[5] = {
      { VA_WP_WORD_IDX, 4 },
      { VA_INTRO_TBL_PTR, 8 },
      { ADDR_INTRO_TBL, 32 },
      { ADDR_UNIT, 244 },
      { ADDR_PLAYER_DATA, 32 },
    };
    RangeSpec post_r[2] = {
      { ADDR_UNIT, 244 },
      { HEAP_BASE, 760 },
    };
    for (int i = 0; i < 6; i++) {
      reset_heap();
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_INTRO_TBL, 0, 32);
      w32(ADDR_UNIT + 0x08, 0xCAFE0030u);
      w16(VA_WP_WORD_IDX, 1u);
      w16(VA_WP_MASK, 0x0001u);
      w32(VA_INTRO_TBL_PTR, ADDR_INTRO_TBL);

      uint32_t u = ADDR_UNIT;
      const char *cid = "null_player_asserts";
      if (i == 0) {
        u = 0u;
      } else if (i == 1) {
        cid = "non_null_player_data_asserts";
        w32(ADDR_UNIT + 0x14, ADDR_PLAYER_DATA);
      } else if (i == 2) {
        cid = "intro_count_zero_flag_0";
        w32(VA_INTRO_TBL_CNT, 0u);
      } else if (i == 3) {
        cid = "intro_match_at_idx_0_flag_1";
        w32(VA_INTRO_TBL_CNT, 4u);
        w32(ADDR_INTRO_TBL + 0, 1u);
      } else if (i == 4) {
        cid = "intro_match_at_idx_2_flag_4";
        w32(VA_INTRO_TBL_CNT, 4u);
        w32(ADDR_INTRO_TBL + 0, 5u);
        w32(ADDR_INTRO_TBL + 4, 2u);
        w32(ADDR_INTRO_TBL + 8, 1u);
        w16(VA_WP_WORD_IDX, 2u);
        w16(VA_WP_MASK, 0x0010u);
      } else {
        cid = "intro_no_match_in_table_flag_0";
        w32(VA_INTRO_TBL_CNT, 3u);
        w32(ADDR_INTRO_TBL + 0, 2u);
        w32(ADDR_INTRO_TBL + 4, 3u);
        w32(ADDR_INTRO_TBL + 8, 4u);
      }
      uint32_t args[1] = { u };
      capture_pre(r, 5, pre);
      int asserted = 0;
      safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 1, 0u, 0u, asserted, g_assert_line, r, 5, pre, post_r, 2);
    }
  }
}

/* =========================================================================
 * B035 EMITTER (20 hostImport functions -> b035-vectors.ndjson)
 * ========================================================================= */
static void emit_b035(FILE *fp) {
  uint8_t *pre[16];

  /* 1. 0x6FD632A0: DATATBLS_GetInventoryTxtRecord */
  {
    const uint32_t va = 0x6FD632A0u;
    const char *nm = "DATATBLS_GetInventoryTxtRecord";
    for (int idx = 0; idx < 16; idx++) {
      for (int w = 0; w < 66; w++) {
        w32(ADDR_INV_TXT + (uint32_t)(idx * 0x108 + w * 4), 0x50000000u + (uint32_t)(idx * 0x100 + w));
      }
    }
    RangeSpec r[3] = {
      { VA_INV_TXT_PTR, 4 },
      { ADDR_INV_TXT, 16 * 0x108 },
      { ADDR_OUT_BUF, 0x108 },
    };
    RangeSpec post_r[1] = { { ADDR_OUT_BUF, 0x108 } };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_OUT_BUF, 0, 0x108);
      w32(VA_INV_TXT_PTR, (i == 0) ? 0u : ADDR_INV_TXT);
      uint32_t inv_id = (i == 0) ? 0u : (i == 1) ? 0u : (i == 2) ? 3u : 2u;
      uint32_t hi_res = (i == 3) ? 1u : 0u;
      const char *cid = (i == 0) ? "null_table_id0_asserts"
                      : (i == 1) ? "low_res_id0"
                      : (i == 2) ? "low_res_id3"
                                 : "high_res_id2_selects_row9";
      uint32_t args[3] = { inv_id, hi_res, ADDR_OUT_BUF };
      capture_pre(r, 3, pre);
      int asserted = 0;
      safe_stdcall3(va, args[0], args[1], args[2], &asserted);
      w32(VA_INV_TXT_PTR, ADDR_INV_TXT);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 3, 0u, 0u, asserted, g_assert_line, r, 3, pre, post_r, 1);
    }
  }

  /* 2. 0x6FD6DD40: INVENTORY_FreeCorpse */
  {
    const uint32_t va = 0x6FD6DD40u;
    const char *nm = "INVENTORY_FreeCorpse";
    RangeSpec r[4] = {
      { ADDR_INVENTORY, 64 },
      { ADDR_CORPSE0, 16 },
      { ADDR_CORPSE1, 16 },
      { ADDR_CORPSE2, 16 },
    };
    RangeSpec post_r[4] = {
      { ADDR_INVENTORY, 64 },
      { ADDR_CORPSE0, 16 },
      { ADDR_CORPSE1, 16 },
      { ADDR_CORPSE2, 16 },
    };
    for (int i = 0; i < 8; i++) {
      memset((void *)(uintptr_t)ADDR_INVENTORY, 0, 64);
      memset((void *)(uintptr_t)ADDR_CORPSE0, 0, 16);
      memset((void *)(uintptr_t)ADDR_CORPSE1, 0, 16);
      memset((void *)(uintptr_t)ADDR_CORPSE2, 0, 16);

      w32(ADDR_INVENTORY + 0x00, 0x01020304u);
      w32(ADDR_INVENTORY + 0x04, 0xCAFE0040u);

      uint32_t inv_arg = ADDR_INVENTORY;
      uint32_t uid_arg = 101u;
      uint32_t cnt_arg = 1u;
      const char *cid = "null_inventory";
      if (i == 0) {
        inv_arg = 0u;
      } else if (i == 1) {
        cid = "bad_signature";
        w32(ADDR_INVENTORY + 0x00, 0xDEADBEEFu);
      } else if (i == 2) {
        cid = "empty_corpse_list";
      } else if (i == 3) {
        cid = "single_corpse_head_tail_counted";
        w32(ADDR_INVENTORY + 0x34, ADDR_CORPSE0);
        w32(ADDR_INVENTORY + 0x38, ADDR_CORPSE0);
        w32(ADDR_INVENTORY + 0x3C, 1u);
        w32(ADDR_CORPSE0 + 0x00, 1u);
        w32(ADDR_CORPSE0 + 0x04, 101u);
        w32(ADDR_CORPSE0 + 0x0C, 0u);
      } else if (i == 4) {
        cid = "head_of_two_uncounted";
        w32(ADDR_INVENTORY + 0x34, ADDR_CORPSE0);
        w32(ADDR_INVENTORY + 0x38, ADDR_CORPSE1);
        w32(ADDR_INVENTORY + 0x3C, 5u);
        w32(ADDR_CORPSE0 + 0x00, 0u);
        w32(ADDR_CORPSE0 + 0x04, 101u);
        w32(ADDR_CORPSE0 + 0x0C, ADDR_CORPSE1);
        w32(ADDR_CORPSE1 + 0x00, 1u);
        w32(ADDR_CORPSE1 + 0x04, 202u);
        w32(ADDR_CORPSE1 + 0x0C, 0u);
        cnt_arg = 0u;
      } else if (i == 5) {
        cid = "middle_of_three_counted";
        w32(ADDR_INVENTORY + 0x34, ADDR_CORPSE0);
        w32(ADDR_INVENTORY + 0x38, ADDR_CORPSE2);
        w32(ADDR_INVENTORY + 0x3C, 2u);
        w32(ADDR_CORPSE0 + 0x00, 1u);
        w32(ADDR_CORPSE0 + 0x04, 100u);
        w32(ADDR_CORPSE0 + 0x0C, ADDR_CORPSE1);
        w32(ADDR_CORPSE1 + 0x00, 1u);
        w32(ADDR_CORPSE1 + 0x04, 101u);
        w32(ADDR_CORPSE1 + 0x0C, ADDR_CORPSE2);
        w32(ADDR_CORPSE2 + 0x00, 0u);
        w32(ADDR_CORPSE2 + 0x04, 102u);
        w32(ADDR_CORPSE2 + 0x0C, 0u);
      } else if (i == 6) {
        cid = "tail_of_two_updates_last_corpse";
        w32(ADDR_INVENTORY + 0x34, ADDR_CORPSE0);
        w32(ADDR_INVENTORY + 0x38, ADDR_CORPSE1);
        w32(ADDR_INVENTORY + 0x3C, 2u);
        w32(ADDR_CORPSE0 + 0x00, 1u);
        w32(ADDR_CORPSE0 + 0x04, 100u);
        w32(ADDR_CORPSE0 + 0x0C, ADDR_CORPSE1);
        w32(ADDR_CORPSE1 + 0x00, 1u);
        w32(ADDR_CORPSE1 + 0x04, 101u);
        w32(ADDR_CORPSE1 + 0x0C, 0u);
      } else {
        cid = "not_found_after_id_match_flag_mismatch";
        w32(ADDR_INVENTORY + 0x34, ADDR_CORPSE0);
        w32(ADDR_INVENTORY + 0x38, ADDR_CORPSE0);
        w32(ADDR_INVENTORY + 0x3C, 1u);
        w32(ADDR_CORPSE0 + 0x00, 0u);
        w32(ADDR_CORPSE0 + 0x04, 101u);
        w32(ADDR_CORPSE0 + 0x0C, 0u);
        cnt_arg = 1u;
      }
      uint32_t args[3] = { inv_arg, uid_arg, cnt_arg };
      capture_pre(r, 4, pre);
      uint32_t eax = call_stdcall3(va, args[0], args[1], args[2]);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 3, 0xFFFFFFFFu, eax, 0, 0u, r, 4, pre, post_r, 4);
    }
  }

  /* 3. 0x6FD6DDD0: INVENTORY_AllocCorpse */
  {
    const uint32_t va = 0x6FD6DDD0u;
    const char *nm = "INVENTORY_AllocCorpse";
    RangeSpec r[2] = {
      { ADDR_INVENTORY, 64 },
      { ADDR_CORPSE0, 16 },
    };
    RangeSpec post_r[3] = {
      { ADDR_INVENTORY, 64 },
      { ADDR_CORPSE0, 16 },
      { HEAP_BASE, 16 },
    };
    for (int i = 0; i < 5; i++) {
      reset_heap();
      memset((void *)(uintptr_t)ADDR_INVENTORY, 0, 64);
      memset((void *)(uintptr_t)ADDR_CORPSE0, 0, 16);
      w32(ADDR_INVENTORY + 0x00, 0x01020304u);
      w32(ADDR_INVENTORY + 0x04, 0xCAFE0041u);

      uint32_t inv_arg = ADDR_INVENTORY;
      uint32_t cnt_arg = 1u;
      const char *cid = "null_inventory_returns_0";
      if (i == 0) {
        inv_arg = 0u;
      } else if (i == 1) {
        cid = "bad_signature_returns_0";
        w32(ADDR_INVENTORY + 0x00, 0x11111111u);
      } else if (i == 2) {
        cid = "alloc_first_corpse_counted";
      } else if (i == 3) {
        cid = "alloc_append_corpse_uncounted";
        w32(ADDR_INVENTORY + 0x34, ADDR_CORPSE0);
        w32(ADDR_INVENTORY + 0x38, ADDR_CORPSE0);
        w32(ADDR_INVENTORY + 0x3C, 3u);
        cnt_arg = 0u;
      } else {
        cid = "alloc_append_corpse_counted";
        w32(ADDR_INVENTORY + 0x34, ADDR_CORPSE0);
        w32(ADDR_INVENTORY + 0x38, ADDR_CORPSE0);
        w32(ADDR_INVENTORY + 0x3C, 3u);
        cnt_arg = 1u;
      }
      uint32_t args[4] = { inv_arg, 777u, 2u, cnt_arg };
      capture_pre(r, 2, pre);
      uint32_t eax = call_stdcall4_zero_eax(va, args);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 4, 0xFFFFFFFFu, eax, 0, 0u, r, 2, pre, post_r, (i < 2) ? 2 : 3);
    }
  }

  /* 4. 0x6FD6DF20: INVENTORY_FreeAllNodes */
  {
    const uint32_t va = 0x6FD6DF20u;
    const char *nm = "INVENTORY_FreeAllNodes";
    RangeSpec r[3] = {
      { ADDR_INVENTORY, 64 },
      { ADDR_NODE0, 16 },
      { ADDR_NODE1, 16 },
    };
    RangeSpec post_r[1] = { { ADDR_INVENTORY, 64 } };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_INVENTORY, 0, 64);
      memset((void *)(uintptr_t)ADDR_NODE0, 0, 16);
      memset((void *)(uintptr_t)ADDR_NODE1, 0, 16);
      w32(ADDR_INVENTORY + 0x00, 0x01020304u);
      w32(ADDR_INVENTORY + 0x04, 0xCAFE0042u);

      uint32_t inv_arg = ADDR_INVENTORY;
      const char *cid = "null_inventory";
      if (i == 0) {
        inv_arg = 0u;
      } else if (i == 1) {
        cid = "bad_signature";
        w32(ADDR_INVENTORY + 0x00, 0x99999999u);
        w32(ADDR_INVENTORY + 0x2C, ADDR_NODE0);
        w32(ADDR_INVENTORY + 0x30, ADDR_NODE0);
      } else if (i == 2) {
        cid = "empty_node_list";
      } else {
        cid = "two_nodes_freed_and_zeroed";
        w32(ADDR_INVENTORY + 0x2C, ADDR_NODE0);
        w32(ADDR_INVENTORY + 0x30, ADDR_NODE1);
        w32(ADDR_NODE0 + 0x04, ADDR_NODE1);
        w32(ADDR_NODE1 + 0x04, 0u);
      }
      uint32_t args[1] = { inv_arg };
      capture_pre(r, 3, pre);
      call_stdcall1(va, args[0]);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 1, 0u, 0u, 0, 0u, r, 3, pre, post_r, 1);
    }
  }

  /* Populate shared ADDR_ITEMS_TXT (4 records * 0x1A8) */
  memset((void *)(uintptr_t)ADDR_ITEMS_TXT, 0, 4 * 0x1A8);
  /* Record 0: page limits +0x116..+0x11B = {1,2,3,4,5,6}, dwWeapClass (+0xC0) = 0x20316831 ('1h1 '),
     dwBitField1 (+0xDC) = 0x00, nInvWidth (+0x11C) = 2, nComponent (+0x115) = 5, nBelt (+0x130) = 4, n2Handed (+0x13D) = 0 */
  w8(ADDR_ITEMS_TXT + 0 * 0x1A8 + 0x116, 1u);
  w8(ADDR_ITEMS_TXT + 0 * 0x1A8 + 0x117, 2u);
  w8(ADDR_ITEMS_TXT + 0 * 0x1A8 + 0x118, 3u);
  w8(ADDR_ITEMS_TXT + 0 * 0x1A8 + 0x119, 4u);
  w8(ADDR_ITEMS_TXT + 0 * 0x1A8 + 0x11A, 5u);
  w8(ADDR_ITEMS_TXT + 0 * 0x1A8 + 0x11B, 6u);
  w32(ADDR_ITEMS_TXT + 0 * 0x1A8 + 0xC0, 0x20316831u);
  w32(ADDR_ITEMS_TXT + 0 * 0x1A8 + 0xDC, 0x00u);
  w8(ADDR_ITEMS_TXT + 0 * 0x1A8 + 0x11C, 2u);
  w8(ADDR_ITEMS_TXT + 0 * 0x1A8 + 0x115, 5u);
  w8(ADDR_ITEMS_TXT + 0 * 0x1A8 + 0x130, 4u);
  w8(ADDR_ITEMS_TXT + 0 * 0x1A8 + 0x13D, 0u);

  /* Record 1: page limits +0x116..+0x11B = {10,20,30,40,50,60}, dwWeapClass (+0xC0) = 0x20776232 ('2bw '),
     dwBitField1 (+0xDC) = 0x02 (compact save bit), nInvWidth (+0x11C) = 1, nComponent (+0x115) = 9, nBelt (+0x130) = 16, n2Handed (+0x13D) = 1 */
  w8(ADDR_ITEMS_TXT + 1 * 0x1A8 + 0x116, 10u);
  w8(ADDR_ITEMS_TXT + 1 * 0x1A8 + 0x117, 20u);
  w8(ADDR_ITEMS_TXT + 1 * 0x1A8 + 0x118, 30u);
  w8(ADDR_ITEMS_TXT + 1 * 0x1A8 + 0x119, 40u);
  w8(ADDR_ITEMS_TXT + 1 * 0x1A8 + 0x11A, 50u);
  w8(ADDR_ITEMS_TXT + 1 * 0x1A8 + 0x11B, 60u);
  w32(ADDR_ITEMS_TXT + 1 * 0x1A8 + 0xC0, 0x20776232u);
  w32(ADDR_ITEMS_TXT + 1 * 0x1A8 + 0xDC, 0x02u);
  w8(ADDR_ITEMS_TXT + 1 * 0x1A8 + 0x11C, 1u);
  w8(ADDR_ITEMS_TXT + 1 * 0x1A8 + 0x115, 9u);
  w8(ADDR_ITEMS_TXT + 1 * 0x1A8 + 0x130, 16u);
  w8(ADDR_ITEMS_TXT + 1 * 0x1A8 + 0x13D, 1u);

  /* Record 2: unmatched dwWeapClass (+0xC0) = 0xdeadbeef */
  w32(ADDR_ITEMS_TXT + 2 * 0x1A8 + 0xC0, 0xDEADBEEFu);

  w32(VA_ITEMS_TXT_CNT, 4u);
  w32(VA_ITEMS_TXT_PTR, ADDR_ITEMS_TXT);

  /* 5. 0x6FD6E420: INVENTORY_GetItemSaveGridPageLimits (custom eax=pItem, ecx=pOutPageLimits6) */
  {
    const uint32_t va = 0x6FD6E420u;
    const char *nm = "INVENTORY_GetItemSaveGridPageLimits";
    RangeSpec r[4] = {
      { VA_ITEMS_TXT_CNT, 8 },
      { ADDR_ITEMS_TXT, 4 * 0x1A8 },
      { ADDR_UNIT, 244 },
      { ADDR_OUT_BUF, 8 },
    };
    RangeSpec post_r[1] = { { ADDR_OUT_BUF, 8 } };
    for (int i = 0; i < 5; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_OUT_BUF, 0xCC, 8);
      w32(VA_ITEMS_TXT_CNT, 4u);
      w32(VA_ITEMS_TXT_PTR, ADDR_ITEMS_TXT);

      uint32_t item_arg = ADDR_UNIT;
      const char *cid = "null_item_zeroes_6_bytes";
      if (i == 0) {
        item_arg = 0u;
      } else if (i == 1) {
        cid = "valid_item_0_copies_6_bytes";
        w32(ADDR_UNIT + 0x04, 0u);
      } else if (i == 2) {
        cid = "valid_item_1_copies_6_bytes";
        w32(ADDR_UNIT + 0x04, 1u);
      } else if (i == 3) {
        cid = "oob_class_id_asserts";
        w32(ADDR_UNIT + 0x04, 99u);
      } else {
        cid = "null_items_txt_ptr_asserts";
        w32(ADDR_UNIT + 0x04, 0u);
        w32(VA_ITEMS_TXT_PTR, 0u);
      }
      uint32_t args[2] = { item_arg, ADDR_OUT_BUF };
      capture_pre(r, 4, pre);
      int asserted = 0;
      safe_eax_ecx_ret_void(va, args[0], args[1], &asserted);
      w32(VA_ITEMS_TXT_PTR, ADDR_ITEMS_TXT);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 2, 0u, 0u, asserted, g_assert_line, r, 4, pre, post_r, 1);
    }
  }

  /* 6. 0x6FD6E710: INVENTORY_AllocInventory */
  {
    const uint32_t va = 0x6FD6E710u;
    const char *nm = "INVENTORY_AllocInventory";
    RangeSpec r[1] = { { ADDR_UNIT, 244 } };
    RangeSpec post_r[2] = {
      { ADDR_UNIT, 244 },
      { HEAP_BASE, 64 },
    };
    for (int i = 0; i < 4; i++) {
      reset_heap();
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      w32(ADDR_UNIT + 0x08, 0xCAFE0051u); /* pOwnerUnit->pMemPool */
      w32(ADDR_UNIT + 0x0C, 0x12345678u); /* pOwnerUnit->dwUnitId */
      uint32_t pool = (i == 0 || i == 2) ? 0u : 0xCAFE0050u;
      uint32_t owner = (i < 2) ? 0u : ADDR_UNIT;
      const char *cid = (i == 0) ? "null_pool_and_null_owner"
                      : (i == 1) ? "explicit_pool_and_null_owner"
                      : (i == 2) ? "null_pool_uses_owner_pool_and_links"
                                 : "explicit_pool_overrides_owner_pool_and_links";
      uint32_t args[2] = { pool, owner };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall2(va, args[0], args[1]);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 2, 0xFFFFFFFFu, eax, 0, 0u, r, 1, pre, post_r, 2);
    }
  }

  /* 7. 0x6FD72000: ITEMS_DecodeItemCompactBitstream */
  {
    const uint32_t va = 0x6FD72000u;
    const char *nm = "ITEMS_DecodeItemCompactBitstream";
    /* Stage D2TxtLinkStrc at ADDR_LINKER and 5 sorted entries at ADDR_LINK_ENTRIES
     * (Fog.#10213 0x6FF61F00 uses unsigned binary search on dwCode!) */
    memset((void *)(uintptr_t)ADDR_LINKER, 0, 16);
    memset((void *)(uintptr_t)ADDR_LINK_ENTRIES, 0, 40);
    w32(ADDR_LINKER + 0x00, 5u);
    w32(ADDR_LINKER + 0x08, ADDR_LINK_ENTRIES);
    /* Entry 0: 'nec ' (0x2063656E) -> 11 */
    w32(ADDR_LINK_ENTRIES + 0 * 8 + 0, 0x2063656Eu);
    w32(ADDR_LINK_ENTRIES + 0 * 8 + 4, 11u);
    /* Entry 1: 'neg ' (0x2067656E) -> 22 */
    w32(ADDR_LINK_ENTRIES + 1 * 8 + 0, 0x2067656Eu);
    w32(ADDR_LINK_ENTRIES + 1 * 8 + 4, 22u);
    /* Entry 2: 'cap ' (0x20706163) -> 33 */
    w32(ADDR_LINK_ENTRIES + 2 * 8 + 0, 0x20706163u);
    w32(ADDR_LINK_ENTRIES + 2 * 8 + 4, 33u);
    /* Entry 3: 'ear ' (0x20726165) -> 44 */
    w32(ADDR_LINK_ENTRIES + 3 * 8 + 0, 0x20726165u);
    w32(ADDR_LINK_ENTRIES + 3 * 8 + 4, 44u);
    /* Entry 4: 'amu ' (0x20756D61) -> 55 */
    w32(ADDR_LINK_ENTRIES + 4 * 8 + 0, 0x20756D61u);
    w32(ADDR_LINK_ENTRIES + 4 * 8 + 4, 55u);
    w32(VA_ITEMS_CODE_LINK, ADDR_LINKER);

    RangeSpec r[5] = {
      { VA_ITEMS_CODE_LINK, 4 },
      { ADDR_LINKER, 16 },
      { ADDR_LINK_ENTRIES, 40 },
      { ADDR_BITSTREAM, 32 },
      { ADDR_OUT_BUF, 24 },
    };
    RangeSpec post_r[1] = { { ADDR_OUT_BUF, 24 } };
    for (int i = 0; i < 9; i++) {
      memset((void *)(uintptr_t)ADDR_BITSTREAM, 0, 32);
      memset((void *)(uintptr_t)ADDR_OUT_BUF, 0xCC, 24);

      uint32_t buf_arg = ADDR_BITSTREAM;
      uint32_t sz_arg = 24u;
      uint32_t chk_arg = 1u;
      uint32_t ver_arg = 100u;
      const char *cid = "zero_size_check_hdr_returns_0";
      int bp = 0;
      #define PACK_BITS(val, nbits) do { \
        uint32_t _v = (uint32_t)(val); \
        for (int _b = 0; _b < (nbits); _b++) { \
          if ((_v >> _b) & 1u) { \
            uint32_t _bo = (uint32_t)(bp >> 3); \
            uint8_t _bi = (uint8_t)(bp & 7); \
            uint8_t _cur = *(volatile uint8_t *)(uintptr_t)(ADDR_BITSTREAM + _bo); \
            w8(ADDR_BITSTREAM + _bo, (uint8_t)(_cur | (uint8_t)(1u << _bi))); \
          } \
          bp++; \
        } \
      } while (0)

      if (i == 0) {
        sz_arg = 0u;
      } else if (i == 1) {
        cid = "bad_jm_magic_returns_0";
        PACK_BITS(0x1234u, 16);
      } else if (i == 2) {
        cid = "jm_mode3_ground_pos16_regular_code_with_sockets";
        PACK_BITS(0x4D4Au, 16);
        PACK_BITS(0x00000010u, 32); /* edi flags (no ear, no compact) */
        PACK_BITS(101u, 10);        /* discarded 10-bit format */
        PACK_BITS(3u, 3);           /* mode = 3 (on ground -> 16-bit x,y) */
        PACK_BITS(0x1234u, 16);     /* posX */
        PACK_BITS(0x5678u, 16);     /* posY */
        PACK_BITS(0x20706163u, 32); /* 'cap ' -> index 33 */
        PACK_BITS(6u, 3);           /* gemSockets = 6 */
      } else if (i == 3) {
        cid = "no_jm_mode5_dropping_pos16_compact_flag_zero_sockets";
        chk_arg = 0u;
        PACK_BITS(0x00200000u, 32); /* edi flags: compact bit 0x00200000 set -> sockets=0 */
        PACK_BITS(101u, 10);
        PACK_BITS(5u, 3);           /* mode = 5 (dropping -> 16-bit x,y) */
        PACK_BITS(300u, 16);
        PACK_BITS(400u, 16);
        PACK_BITS(0x20756D61u, 32); /* 'amu ' -> index 55 */
      } else if (i == 4) {
        cid = "no_jm_mode0_grid_ver_le_5c_remaps_nec_to_neg";
        chk_arg = 0u;
        ver_arg = 0x5Cu;
        PACK_BITS(0x02000000u, 32); /* edi flags: bit 0x02000000 set -> sockets=0 */
        PACK_BITS(101u, 10);
        PACK_BITS(0u, 3);           /* mode = 0 (grid) */
        PACK_BITS(4u, 4);           /* bodyLoc = 4 */
        PACK_BITS(9u, 4);           /* gridX = 9 */
        PACK_BITS(3u, 4);           /* gridY = 3 */
        PACK_BITS(1u, 3);           /* invPage raw = 1 -> stored as 0 */
        PACK_BITS(0x2063656Eu, 32); /* 'nec ' remapped to 'neg ' -> index 22 */
      } else if (i == 5) {
        cid = "no_jm_mode1_equipped_ver_gt_5c_keeps_nec";
        chk_arg = 0u;
        ver_arg = 0x5Du;
        PACK_BITS(0x00000000u, 32);
        PACK_BITS(101u, 10);
        PACK_BITS(1u, 3);           /* mode = 1 */
        PACK_BITS(3u, 4);           /* bodyLoc = 3 */
        PACK_BITS(0u, 4);           /* gridX = 0 */
        PACK_BITS(0u, 4);           /* gridY = 0 */
        PACK_BITS(0u, 3);           /* invPage raw = 0 -> stored as 0xFF */
        PACK_BITS(0x2063656Eu, 32); /* 'nec ' kept -> index 11 */
        PACK_BITS(5u, 3);           /* gemSockets = 5 */
      } else if (i == 6) {
        cid = "no_jm_mode2_ear_flag_uses_ear_code";
        chk_arg = 0u;
        PACK_BITS(0x00010000u, 32); /* ITEMFLAG_EAR -> uses 'ear ' (0x20726165) -> index 44 */
        PACK_BITS(101u, 10);
        PACK_BITS(2u, 3);           /* mode = 2 */
        PACK_BITS(0u, 4);           /* bodyLoc = 0 */
        PACK_BITS(2u, 4);           /* gridX = 2 */
        PACK_BITS(1u, 4);           /* gridY = 1 */
        PACK_BITS(4u, 3);           /* invPage raw = 4 -> stored as 3 */
        PACK_BITS(3u, 3);           /* gemSockets = 3 */
      } else if (i == 7) {
        cid = "no_jm_unknown_code_stores_neg1_classid";
        chk_arg = 0u;
        PACK_BITS(0x00000000u, 32);
        PACK_BITS(101u, 10);
        PACK_BITS(0u, 3);
        PACK_BITS(1u, 4);
        PACK_BITS(2u, 4);
        PACK_BITS(3u, 4);
        PACK_BITS(2u, 3);
        PACK_BITS(0x7A7A7A7Au, 32); /* 'zzzz' -> -1 */
        PACK_BITS(2u, 3);
      } else {
        cid = "jm_partial_overflow_truncated_buffer";
        chk_arg = 1u;
        sz_arg = 7u; /* 56 bits total: 16b magic + 32b edi + 8b partial format */
        PACK_BITS(0x4D4Au, 16);
        PACK_BITS(0x11223344u, 32);
        PACK_BITS(0x3FFu, 10);
      }
      #undef PACK_BITS

      uint32_t args[5] = { buf_arg, sz_arg, chk_arg, ADDR_OUT_BUF, ver_arg };
      capture_pre(r, 5, pre);
      uint32_t eax = call_stdcall5(va, args[0], args[1], args[2], args[3], args[4]);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 5, 0xFFFFFFFFu, eax, 0, 0u, r, 5, pre, post_r, 1);
    }
  }

  /* 8. 0x6FD72170: ITEMS_SetItemFormat */
  {
    const uint32_t va = 0x6FD72170u;
    const char *nm = "ITEMS_SetItemFormat";
    RangeSpec r[2] = {
      { ADDR_UNIT, 244 },
      { ADDR_ITEM_DATA, 116 },
    };
    RangeSpec post_r[1] = { { ADDR_ITEM_DATA, 116 } };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_ITEM_DATA, 0, 116);
      uint32_t u = ADDR_UNIT;
      const char *cid = "null_item_asserts";
      if (i == 0) {
        u = 0u;
      } else if (i == 1) {
        cid = "non_item_unit_asserts";
        w32(ADDR_UNIT + 0x00, 1u);
        w32(ADDR_UNIT + 0x14, ADDR_ITEM_DATA);
      } else if (i == 2) {
        cid = "null_item_data_asserts";
        w32(ADDR_UNIT + 0x00, 4u);
        w32(ADDR_UNIT + 0x14, 0u);
      } else {
        cid = "valid_sets_format";
        w32(ADDR_UNIT + 0x00, 4u);
        w32(ADDR_UNIT + 0x14, ADDR_ITEM_DATA);
      }
      uint32_t args[2] = { u, 0x12345678u };
      capture_pre(r, 2, pre);
      int asserted = 0;
      safe_stdcall2(va, args[0], args[1], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 2, 0u, 0u, asserted, g_assert_line, r, 2, pre, post_r, 1);
    }
  }

  /* 9. 0x6FD72310: ITEMS_CanPlayerClassUseItem */
  {
    const uint32_t va = 0x6FD72310u;
    const char *nm = "ITEMS_CanPlayerClassUseItem";
    RangeSpec r[4] = {
      { VA_ITEMS_TXT_CNT, 8 },
      { ADDR_ITEMS_TXT, 4 * 0x1A8 },
      { ADDR_UNIT, 244 },
      { ADDR_UNIT2, 244 },
    };
    for (int i = 0; i < 7; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_UNIT2, 0, 244);
      w32(ADDR_UNIT + 0x00, 0u);  /* player */
      w32(ADDR_UNIT + 0x04, 4u);  /* class 4 (Barbarian) */
      w32(ADDR_UNIT2 + 0x00, 4u); /* item */
      w32(ADDR_UNIT2 + 0x04, 1u); /* item classId 1 (n2Handed = 1) */

      uint32_t p_arg = ADDR_UNIT;
      uint32_t i_arg = ADDR_UNIT2;
      const char *cid = "null_item_asserts";
      if (i == 0) {
        i_arg = 0u;
      } else if (i == 1) {
        cid = "null_player_asserts";
        p_arg = 0u;
      } else if (i == 2) {
        cid = "non_player_unit_type_returns_0";
        w32(ADDR_UNIT + 0x00, 1u);
      } else if (i == 3) {
        cid = "non_barbarian_class_2_returns_0";
        w32(ADDR_UNIT + 0x04, 2u);
      } else if (i == 4) {
        cid = "barbarian_oob_item_class_asserts";
        w32(ADDR_UNIT2 + 0x04, 10u);
      } else if (i == 5) {
        cid = "barbarian_item_0_n2handed_0_returns_0";
        w32(ADDR_UNIT2 + 0x04, 0u);
      } else {
        cid = "barbarian_item_1_n2handed_1_returns_1";
        w32(ADDR_UNIT2 + 0x04, 1u);
      }
      uint32_t args[2] = { p_arg, i_arg };
      capture_pre(r, 4, pre);
      int asserted = 0;
      uint32_t eax = safe_stdcall2(va, args[0], args[1], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 2, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 4, pre, NULL, 0);
    }
  }

  /* 10. 0x6FD72430: ITEMS_GetWeaponClassCodeIdx */
  {
    const uint32_t va = 0x6FD72430u;
    const char *nm = "ITEMS_GetWeaponClassCodeIdx";
    memset((void *)(uintptr_t)VA_WEAP_CLASS_TBL, 0, 32);
    w32(VA_WEAP_CLASS_TBL + 0 * 8 + 0, 0x20316831u);
    w16(VA_WEAP_CLASS_TBL + 0 * 8 + 4, 0x1111u);
    w32(VA_WEAP_CLASS_TBL + 1 * 8 + 0, 0x20776232u);
    w16(VA_WEAP_CLASS_TBL + 1 * 8 + 4, 0x2222u);
    w32(VA_WEAP_CLASS_CNT, 2u);

    RangeSpec r[5] = {
      { VA_ITEMS_TXT_CNT, 8 },
      { VA_WEAP_CLASS_CNT, 4 },
      { VA_WEAP_CLASS_TBL, 32 },
      { ADDR_ITEMS_TXT, 4 * 0x1A8 },
      { ADDR_UNIT, 244 },
    };
    for (int i = 0; i < 6; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      w32(ADDR_UNIT + 0x00, 4u);
      w32(VA_WEAP_CLASS_CNT, 2u);
      uint32_t u = ADDR_UNIT;
      const char *cid = "null_item_asserts";
      if (i == 0) {
        u = 0u;
      } else if (i == 1) {
        cid = "oob_class_id_asserts";
        w32(ADDR_UNIT + 0x04, 10u);
      } else if (i == 2) {
        cid = "zero_weap_class_count_returns_0";
        w32(ADDR_UNIT + 0x04, 0u);
        w32(VA_WEAP_CLASS_CNT, 0u);
      } else if (i == 3) {
        cid = "matching_weap_class_0_returns_0x1111";
        w32(ADDR_UNIT + 0x04, 0u);
      } else if (i == 4) {
        cid = "matching_weap_class_1_returns_0x2222";
        w32(ADDR_UNIT + 0x04, 1u);
      } else {
        cid = "unmatched_weap_class_2_returns_0";
        w32(ADDR_UNIT + 0x04, 2u);
      }
      uint32_t args[1] = { u };
      capture_pre(r, 5, pre);
      int asserted = 0;
      uint32_t eax = safe_stdcall1(va, args[0], &asserted);
      w32(VA_WEAP_CLASS_CNT, 2u);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 1, 0xFFFFu, eax, asserted, g_assert_line, r, 5, pre, NULL, 0);
    }
  }

  /* 11. 0x6FD724C0: ITEMS_GetCellOverwrite */
  {
    const uint32_t va = 0x6FD724C0u;
    const char *nm = "ITEMS_GetCellOverwrite";
    RangeSpec r[2] = {
      { ADDR_UNIT, 244 },
      { ADDR_ITEM_DATA, 116 },
    };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_ITEM_DATA, 0, 116);
      w32(ADDR_ITEM_DATA + 0x0C, 0xCAFE1234u);
      uint32_t u = ADDR_UNIT;
      const char *cid = "null_item_asserts";
      if (i == 0) {
        u = 0u;
      } else if (i == 1) {
        cid = "non_item_type_asserts";
        w32(ADDR_UNIT + 0x00, 1u);
      } else if (i == 2) {
        cid = "null_item_data_asserts";
        w32(ADDR_UNIT + 0x00, 4u);
        w32(ADDR_UNIT + 0x14, 0u);
      } else {
        cid = "valid_item_data_returns_cell_overwrite";
        w32(ADDR_UNIT + 0x00, 4u);
        w32(ADDR_UNIT + 0x14, ADDR_ITEM_DATA);
      }
      uint32_t args[1] = { u };
      capture_pre(r, 2, pre);
      int asserted = 0;
      uint32_t eax = safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 1, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 2, pre, NULL, 0);
    }
  }

  /* 12. 0x6FD72510: ITEMS_SetCellOverwrite */
  {
    const uint32_t va = 0x6FD72510u;
    const char *nm = "ITEMS_SetCellOverwrite";
    RangeSpec r[2] = {
      { ADDR_UNIT, 244 },
      { ADDR_ITEM_DATA, 116 },
    };
    RangeSpec post_r[1] = { { ADDR_ITEM_DATA, 116 } };
    for (int i = 0; i < 4; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      memset((void *)(uintptr_t)ADDR_ITEM_DATA, 0, 116);
      uint32_t u = ADDR_UNIT;
      const char *cid = "null_item_asserts";
      if (i == 0) {
        u = 0u;
      } else if (i == 1) {
        cid = "non_item_type_asserts";
        w32(ADDR_UNIT + 0x00, 1u);
      } else if (i == 2) {
        cid = "null_item_data_asserts";
        w32(ADDR_UNIT + 0x00, 4u);
        w32(ADDR_UNIT + 0x14, 0u);
      } else {
        cid = "valid_item_data_sets_cell_overwrite";
        w32(ADDR_UNIT + 0x00, 4u);
        w32(ADDR_UNIT + 0x14, ADDR_ITEM_DATA);
      }
      uint32_t args[2] = { u, 42u };
      capture_pre(r, 2, pre);
      int asserted = 0;
      safe_stdcall2(va, args[0], args[1], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 2, 0u, 0u, asserted, g_assert_line, r, 2, pre, post_r, 1);
    }
  }

  /* 13. 0x6FD72760: ITEMS_CheckItemFlagCompactSaveByClassId & 14. 0x6FD72E70: ITEMS_GetInvWidthFromId */
  {
    struct { uint32_t va; const char *nm; } fns[2] = {
      { 0x6FD72760u, "ITEMS_CheckItemFlagCompactSaveByClassId" },
      { 0x6FD72E70u, "ITEMS_GetInvWidthFromId" },
    };
    RangeSpec r[2] = {
      { VA_ITEMS_TXT_CNT, 8 },
      { ADDR_ITEMS_TXT, 4 * 0x1A8 },
    };
    uint32_t ids[4] = { (uint32_t)-1, 10u, 0u, 1u };
    const char *cids[4] = { "neg_id_asserts", "oob_id_asserts", "valid_id_0", "valid_id_1" };
    for (int f = 0; f < 2; f++) {
      for (int i = 0; i < 4; i++) {
        uint32_t args[1] = { ids[i] };
        capture_pre(r, 2, pre);
        int asserted = 0;
        uint32_t eax = safe_stdcall1(fns[f].va, args[0], &asserted);
        emit_ndjson_line_ex(fp, fns[f].va, fns[f].nm, cids[i], args, 1, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 2, pre, NULL, 0);
      }
    }
  }

  /* 15. 0x6FD731E0: ITEMS_GetComponentFromItem */
  {
    const uint32_t va = 0x6FD731E0u;
    const char *nm = "ITEMS_GetComponentFromItem";
    RangeSpec r[3] = {
      { VA_ITEMS_TXT_CNT, 8 },
      { ADDR_ITEMS_TXT, 4 * 0x1A8 },
      { ADDR_UNIT, 244 },
    };
    for (int i = 0; i < 5; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      w32(ADDR_UNIT + 0x00, 4u);
      uint32_t u = ADDR_UNIT;
      const char *cid = "null_item_asserts";
      if (i == 0) {
        u = 0u;
      } else if (i == 1) {
        cid = "non_item_type_asserts";
        w32(ADDR_UNIT + 0x00, 1u);
      } else if (i == 2) {
        cid = "oob_class_id_asserts";
        w32(ADDR_UNIT + 0x04, 99u);
      } else if (i == 3) {
        cid = "valid_item_0_component_5";
        w32(ADDR_UNIT + 0x04, 0u);
      } else {
        cid = "valid_item_1_component_9";
        w32(ADDR_UNIT + 0x04, 1u);
      }
      uint32_t args[1] = { u };
      capture_pre(r, 3, pre);
      int asserted = 0;
      uint32_t eax = safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 1, 0xFFu, eax, asserted, g_assert_line, r, 3, pre, NULL, 0);
    }
  }

  /* 16. 0x6FD7F270: UNITS_SetStaticPathPosY & 17. 0x6FD7F2C0: UNITS_SetStaticPathPosX */
  {
    struct { uint32_t va; const char *nm; } fns[2] = {
      { 0x6FD7F270u, "UNITS_SetStaticPathPosY" },
      { 0x6FD7F2C0u, "UNITS_SetStaticPathPosX" },
    };
    RangeSpec r[2] = {
      { ADDR_UNIT, 244 },
      { ADDR_STATIC_PATH, 32 },
    };
    RangeSpec post_r[1] = { { ADDR_STATIC_PATH, 32 } };
    for (int f = 0; f < 2; f++) {
      for (int i = 0; i < 7; i++) {
        memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
        memset((void *)(uintptr_t)ADDR_STATIC_PATH, 0, 32);
        w32(ADDR_UNIT + 0x2C, ADDR_STATIC_PATH);
        uint32_t u = ADDR_UNIT;
        const char *cid = "null_unit_asserts";
        if (i == 0) {
          u = 0u;
        } else if (i == 1) {
          cid = "invalid_unit_type_0_player_asserts";
          w32(ADDR_UNIT + 0x00, 0u);
        } else if (i == 2) {
          cid = "invalid_unit_type_3_missile_asserts";
          w32(ADDR_UNIT + 0x00, 3u);
        } else if (i == 3) {
          cid = "invalid_unit_type_6_asserts";
          w32(ADDR_UNIT + 0x00, 6u);
        } else if (i == 4) {
          cid = "unit_object_type_2_sets_pos";
          w32(ADDR_UNIT + 0x00, 2u);
        } else if (i == 5) {
          cid = "unit_item_type_4_sets_pos";
          w32(ADDR_UNIT + 0x00, 4u);
        } else {
          cid = "unit_tile_type_5_sets_pos";
          w32(ADDR_UNIT + 0x00, 5u);
        }
        uint32_t args[2] = { u, 321u };
        capture_pre(r, 2, pre);
        int asserted = 0;
        safe_stdcall2(fns[f].va, args[0], args[1], &asserted);
        emit_ndjson_line_ex(fp, fns[f].va, fns[f].nm, cid, args, 2, 0u, 0u, asserted, g_assert_line, r, 2, pre, post_r, 1);
      }
    }
  }

  /* 18. 0x6FD7F8A0: UNITS_GetBeltTypeFromItem */
  {
    const uint32_t va = 0x6FD7F8A0u;
    const char *nm = "UNITS_GetBeltTypeFromItem";
    RangeSpec r[3] = {
      { VA_ITEMS_TXT_CNT, 8 },
      { ADDR_ITEMS_TXT, 4 * 0x1A8 },
      { ADDR_UNIT, 244 },
    };
    for (int i = 0; i < 5; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      w32(ADDR_UNIT + 0x00, 4u);
      uint32_t u = ADDR_UNIT;
      const char *cid = "null_item_asserts";
      if (i == 0) {
        u = 0u;
      } else if (i == 1) {
        cid = "non_item_unit_asserts";
        w32(ADDR_UNIT + 0x00, 0u);
      } else if (i == 2) {
        cid = "item_oob_class_id_asserts";
        w32(ADDR_UNIT + 0x04, 20u);
      } else if (i == 3) {
        cid = "item_0_nbelt_4";
        w32(ADDR_UNIT + 0x04, 0u);
      } else {
        cid = "item_1_nbelt_16";
        w32(ADDR_UNIT + 0x04, 1u);
      }
      uint32_t args[1] = { u };
      capture_pre(r, 3, pre);
      int asserted = 0;
      uint32_t eax = safe_stdcall1(va, args[0], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cid, args, 1, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 3, pre, NULL, 0);
    }
  }

  /* 19. 0x6FD7FB60: UNITS_GetInventoryRecordId */
  {
    const uint32_t va = 0x6FD7FB60u;
    const char *nm = "UNITS_GetInventoryRecordId";
    RangeSpec r[2] = {
      { 0x6FDEEFE4u, 60 },
      { ADDR_UNIT, 244 },
    };
    struct { uint32_t u; uint32_t ut; uint32_t cls; uint32_t pg; uint32_t lod; const char *cid; } cases[15] = {
      { 0u,        0u, 0u,     0u,   0u, "null_unit_asserts" },
      { ADDR_UNIT, 0u, 0u,     1u,   0u, "player_page1_returns_6" },
      { ADDR_UNIT, 0u, 0u,     2u,   0u, "player_page2_returns_7" },
      { ADDR_UNIT, 0u, 0u,     3u,   0u, "player_page3_returns_9" },
      { ADDR_UNIT, 0u, 0u,     4u,   0u, "player_page4_classic_returns_8" },
      { ADDR_UNIT, 0u, 0u,     4u,   1u, "player_page4_lod_returns_12" },
      { ADDR_UNIT, 0u, 0u,     0u,   0u, "player_page0_amazon_lookup" },
      { ADDR_UNIT, 0u, 3u,     0u,   1u, "player_page0_paladin_lookup" },
      { ADDR_UNIT, 0u, 6u,     255u, 1u, "player_page_ff_assassin_lookup" },
      { ADDR_UNIT, 0u, 99u,    0u,   0u, "player_page0_unmatched_class_returns_neg1" },
      { ADDR_UNIT, 1u, 0u,     0u,   0u, "monster_unit_returns_5" },
      { ADDR_UNIT, 2u, 0x152u, 0u,   0u, "object_class_0x152_returns_10" },
      { ADDR_UNIT, 2u, 0x153u, 0u,   0u, "object_class_0x153_returns_11" },
      { ADDR_UNIT, 2u, 0x100u, 0u,   0u, "object_other_class_returns_neg1" },
      { ADDR_UNIT, 3u, 0u,     0u,   0u, "missile_unit_returns_neg1" },
    };
    for (int i = 0; i < 15; i++) {
      memset((void *)(uintptr_t)ADDR_UNIT, 0, 244);
      w32(ADDR_UNIT + 0x00, cases[i].ut);
      w32(ADDR_UNIT + 0x04, cases[i].cls);
      uint32_t args[3] = { cases[i].u, cases[i].pg, cases[i].lod };
      capture_pre(r, 2, pre);
      int asserted = 0;
      uint32_t eax = safe_stdcall3(va, args[0], args[1], args[2], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 3, 0xFFFFFFFFu, eax, asserted, g_assert_line, r, 2, pre, NULL, 0);
    }
  }

  /* 20. 0x6FD93710: COMPOSIT_GetItemPageLimitByBodyLoc (arg0 = nBodyLoc, arg1 = pPageLimits6) */
  {
    const uint32_t va = 0x6FD93710u;
    const char *nm = "COMPOSIT_GetItemPageLimitByBodyLoc";
    RangeSpec r[1] = { { ADDR_OUT_BUF, 8 } };
    struct { uint32_t loc; uint32_t ptr; const char *cid; } cases[9] = {
      { 16u, ADDR_OUT_BUF, "oob_bodyloc_16_asserts_613" },
      { 0u,  ADDR_OUT_BUF, "bodyloc_0_default_asserts_628" },
      { 5u,  ADDR_OUT_BUF, "bodyloc_5_default_asserts_628" },
      { 1u,  ADDR_OUT_BUF, "bodyloc_1_case0_reads_byte2" },
      { 2u,  ADDR_OUT_BUF, "bodyloc_2_case1_reads_byte3" },
      { 3u,  ADDR_OUT_BUF, "bodyloc_3_case2_reads_byte0" },
      { 4u,  ADDR_OUT_BUF, "bodyloc_4_case3_reads_byte1" },
      { 8u,  ADDR_OUT_BUF, "bodyloc_8_case7_reads_byte4" },
      { 9u,  ADDR_OUT_BUF, "bodyloc_9_case8_reads_byte5" },
    };
    for (int i = 0; i < 9; i++) {
      memset((void *)(uintptr_t)ADDR_OUT_BUF, 0, 8);
      w8(ADDR_OUT_BUF + 0, 11u);
      w8(ADDR_OUT_BUF + 1, 22u);
      w8(ADDR_OUT_BUF + 2, 33u);
      w8(ADDR_OUT_BUF + 3, 44u);
      w8(ADDR_OUT_BUF + 4, 55u);
      w8(ADDR_OUT_BUF + 5, 66u);
      uint32_t args[2] = { cases[i].loc, cases[i].ptr };
      capture_pre(r, 1, pre);
      int asserted = 0;
      uint32_t eax = safe_stdcall2(va, args[0], args[1], &asserted);
      emit_ndjson_line_ex(fp, va, nm, cases[i].cid, args, 2, 0xFFu, eax, asserted, g_assert_line, r, 1, pre, NULL, 0);
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

  snprintf(path, sizeof(path), "%s/b032-vectors.ndjson", out_dir);
  FILE *fp32 = fopen(path, "wb");
  if (!fp32) { perror("fopen b032"); return 5; }
  emit_b032(fp32);
  fclose(fp32);

  snprintf(path, sizeof(path), "%s/b035-vectors.ndjson", out_dir);
  FILE *fp35 = fopen(path, "wb");
  if (!fp35) { perror("fopen b035"); return 6; }
  emit_b035(fp35);
  fclose(fp35);

  printf("Emitted real-DLL vectors for B032 and B035 into %s\n", out_dir);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
