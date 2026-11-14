/*
 * Standalone MinGW real-DLL differential vector emitter for K1r9 Iteration 12 Lane B:
 * - Sub-Batch I12B-1 (16 D2Common.dll v1.13c functions -> i12b-1-vectors.ndjson)
 * - Sub-Batch I12B-2 (14 D2Common.dll v1.13c functions -> i12b-2-vectors.ndjson)
 *
 * Uses register-only inline assembly constraints (zero memory-operand asm constraints) and
 * verifies 100% SHA-256 parity between -O2 and -O2 -fno-omit-frame-pointer under Wine.
 */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define ARENA_BASE 0x20000000u
#define ARENA_SIZE 0x00200000u
#define HEAP_BASE  0x40000000u
#define HEAP_SIZE  0x00100000u

/* D2Common globals & IAT */
#define VA_GDWINVBITMASKS_IAT 0x6FDD9078u
#define VA_GDWBITMASKS_IAT    0x6FDD90B0u
#define VA_FOG_10047_IAT      0x6FDD90ACu
#define VA_FOG_10046_IAT      0x6FDD90CCu
#define VA_FOG_10045_IAT      0x6FDD90D0u
#define VA_SGPT_DATATABLES    0x6FDE9E1Cu
#define VA_GRID0_DEF          0x6FDED378u
#define VA_WEAP_CLASS_COUNT   0x6FDEF020u
#define VA_WEAP_CLASS_TBL     0x6FDEF028u
#define VA_ITEMS_TXT_COUNT    0x6FDEFB94u
#define VA_ITEMS_TXT_PTR      0x6FDEFB98u
#define VA_ITEMS_LINKER_PTR   0x6FDEFF6Cu
#define VA_MONSTATS_PTR       0x6FDF0950u
#define VA_MONSTATS_COUNT     0x6FDF0958u
#define VA_ANIMDATA_TABLE     0x6FDF0B4Cu
#define VA_EXPERIENCE_PTR     0x6FDF0B50u
#define VA_ANIM_MON_MCOUNT    0x6FDF13A4u
#define VA_ANIM_MON_MTBL      0x6FDF13B0u
#define VA_ANIM_OBJ_COUNT     0x6FDF13B4u
#define VA_ANIM_OBJ_TTBL      0x6FDF13BCu
#define VA_ANIM_OBJ_MTBL      0x6FDF13C0u
#define VA_ANIM_PLR_COUNT     0x6FDF13C4u
#define VA_ANIM_PLR_GUARD     0x6FDF13C8u
#define VA_ANIM_PLR_TTBL      0x6FDF13CCu
#define VA_ANIM_PLR_MTBL      0x6FDF13D0u

/* Arena layout */
#define ADDR_BITMASKS         0x20000000u /* 0x80 */
#define ADDR_INVBITMASKS      0x20000080u /* 0x80 */
#define ADDR_DATATABLES       0x20000100u /* 0x1000 */
#define ADDR_EXPERIENCE       0x20001100u /* 0x40 */
#define ADDR_RPN_CODE         0x20001200u /* 0x400 */
#define ADDR_CHARSTATS_TXT    0x20001800u /* 7 * 0xC4 */
#define ADDR_SKILLS_TXT       0x20002000u /* 16 * 0x23C */
#define ADDR_SKILLDESC_TXT    0x20005000u /* 16 * 0x120 */
#define ADDR_MISSILES_TXT     0x20007000u /* 16 * 0x1B8 */
#define ADDR_ITEMS_TXT        0x20009000u /* 16 * 0x1A8 */
#define ADDR_LINK             0x2000B000u /* 0x20 */
#define ADDR_LINK_ENTRIES     0x2000B040u /* 0x100 */
#define ADDR_ITEMTYPES_TXT    0x2000B200u /* 16 * 0xE4 */
#define ADDR_ITEMTYPES_EQUIV  0x2000C200u /* 0x200 */
#define ADDR_ISC_TXT          0x2000D000u /* 280 * 0x144 = 0xDE30 */
#define ADDR_MONSTATS_TXT     0x2001C000u /* 8 * 0x1A8 */
#define ADDR_MONSTATS2_TXT    0x2001D000u /* 8 * 0x134 */
#define ADDR_ANIM_TBL         0x2001E000u /* 0x420 */
#define ADDR_ANIM_BUCKETS     0x2001E500u /* 256 * 0x200 = 0x20000? use sparse 0x2000 bytes */
#define ADDR_PLR_TYPES        0x20021000u /* 8 * 0x34 */
#define ADDR_PLR_MODES        0x20021400u /* 24 * 0x34 */
#define ADDR_MON_MODES        0x20021A00u /* 20 * 0x34 */
#define ADDR_OBJ_TYPES        0x20022000u /* 8 * 0x34 */
#define ADDR_OBJ_MODES        0x20022400u /* 8 * 0x34 */
#define ADDR_STATE_MASK_TBL   0x20022800u /* 0x40 */
#define ADDR_STATES_TXT       0x20022900u /* 200 * 0x100 */
#define ADDR_UNIT             0x20030000u /* 0x100 */
#define ADDR_UNIT2            0x20030100u /* 0x100 */
#define ADDR_ITEM             0x20030200u /* 0x100 */
#define ADDR_ITEM2            0x20030300u /* 0x100 */
#define ADDR_ITEMDATA         0x20030400u /* 0x100 */
#define ADDR_ITEMDATA2        0x20030500u /* 0x100 */
#define ADDR_INV              0x20030600u /* 0x100 */
#define ADDR_GRID0            0x20030700u /* 0x100 */
#define ADDR_GRID0_ITEMS      0x20030800u /* 0x100 */
#define ADDR_SLISTEX          0x20030900u /* 0x100 */
#define ADDR_SLIST            0x20030A00u /* 0x100 */
#define ADDR_SLIST_STATS      0x20030B00u /* 0x200 */
#define ADDR_SLISTEX_ITEM     0x20030D00u /* 0x100 */
#define ADDR_SLIST_ITEM       0x20030E00u /* 0x100 */
#define ADDR_SLIST_ITEM_STATS 0x20030F00u /* 0x200 */
#define ADDR_SLISTEX_ALT      0x20031100u /* 0x100 */
#define ADDR_SLIST_ALT        0x20031200u /* 0x100 */
#define ADDR_SLIST_ALT_STATS  0x20031300u /* 0x200 */
#define ADDR_STATEFLAGS       0x20031500u /* 0x40 */
#define ADDR_SKILLS_HDR       0x20031600u /* 0x40 */
#define ADDR_SKILL1           0x20031700u /* 0x80 */
#define ADDR_SKILL2           0x20031780u /* 0x80 */
#define ADDR_ITEMPROP         0x20031800u /* 0x80 */
#define ADDR_CTX              0x20031900u /* 0x40 */
#define ADDR_OUTSTR           0x20032000u /* 0x100 */
#define ADDR_OUTDW            0x20032100u /* 0x40 */
#define ADDR_ITEM_BOOTS       0x20032200u /* 0x100 */
#define ADDR_ITEM_OTHER       0x20032300u /* 0x100 */
#define ADDR_ITEMDATA_OTHER   0x20032400u /* 0x100 */
#define ADDR_SLISTEX_OTHER    0x20032500u /* 0x100 */
#define ADDR_SLIST_OTHER      0x20032600u /* 0x100 */
#define ADDR_SLIST_FULL_ITEM  0x20032700u /* 0x200 */
#define ADDR_SLIST_FULL_OTHER 0x20032900u /* 0x200 */
#define ADDR_SCRATCH          0x20033000u /* 0x400 */

static inline void w32(uint32_t addr, uint32_t val) { *(uint32_t *)(uintptr_t)addr = val; }
static inline void w16(uint32_t addr, uint16_t val) { *(uint16_t *)(uintptr_t)addr = val; }
static inline void w8(uint32_t addr, uint8_t val) { *(uint8_t *)(uintptr_t)addr = val; }
static inline uint32_t r32(uint32_t addr) { return *(uint32_t *)(uintptr_t)addr; }

static uint32_t g_heap_next = HEAP_BASE;

static void reset_heap(void) {
  memset((void *)(uintptr_t)HEAP_BASE, 0, 0x4000u);
  g_heap_next = HEAP_BASE;
}

static uint32_t bump_alloc(uint32_t size) {
  uint32_t ptr = (g_heap_next + 3u) & ~3u;
  g_heap_next = (ptr + size) & 0xFFFFFFFFu;
  memset((void *)(uintptr_t)ptr, 0, size);
  return ptr;
}

static void *__fastcall stub_fog_10045(
  void *pMemPool, uint32_t dwSize, const char *szFile, int nLine, int nZero
) {
  (void)pMemPool; (void)szFile; (void)nLine; (void)nZero;
  return (void *)(uintptr_t)bump_alloc(dwSize);
}

static uint32_t __fastcall stub_fog_10046(
  void *pMemPool, void *pMem, const char *szFile, int nLine, int nZero
) {
  (void)pMemPool; (void)pMem; (void)szFile; (void)nLine; (void)nZero;
  return 1u;
}

static void *__fastcall stub_fog_10047(
  void *pMemPool, void *pOld, uint32_t dwSize, const char *szFile, int nLine, int nZero
) {
  (void)pMemPool; (void)szFile; (void)nLine; (void)nZero;
  void *n = (void *)(uintptr_t)bump_alloc(dwSize);
  if (pOld != NULL && dwSize > 0u) memcpy(n, pOld, dwSize);
  return n;
}

/* =========================================================================
 * Calling Convention Wrappers (Register-only constraints, zero "m"/"g"/"o")
 * ========================================================================= */

static uint32_t call_stdcall1(uintptr_t fn, uint32_t a0) {
  typedef uint32_t (__stdcall *F)(uint32_t);
  return ((F)fn)(a0);
}
static uint32_t call_stdcall2(uintptr_t fn, uint32_t a0, uint32_t a1) {
  typedef uint32_t (__stdcall *F)(uint32_t, uint32_t);
  return ((F)fn)(a0, a1);
}
static uint32_t call_stdcall3(uintptr_t fn, uint32_t a0, uint32_t a1, uint32_t a2) {
  typedef uint32_t (__stdcall *F)(uint32_t, uint32_t, uint32_t);
  return ((F)fn)(a0, a1, a2);
}
static uint32_t call_stdcall4(uintptr_t fn, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3) {
  typedef uint32_t (__stdcall *F)(uint32_t, uint32_t, uint32_t, uint32_t);
  return ((F)fn)(a0, a1, a2, a3);
}
static void call_stdcall9_void(
  uintptr_t fn, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3,
  uint32_t a4, uint32_t a5, uint32_t a6, uint32_t a7, uint32_t a8
) {
  typedef void (__stdcall *F)(
    uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t
  );
  ((F)fn)(a0, a1, a2, a3, a4, a5, a6, a7, a8);
}
static uint32_t call_fastcall2(uintptr_t fn, uint32_t ecx_in, uint32_t edx_in) {
  typedef uint32_t (__fastcall *F)(uint32_t, uint32_t);
  return ((F)fn)(ecx_in, edx_in);
}
static uint32_t call_fastcall4(
  uintptr_t fn, uint32_t ecx_in, uint32_t edx_in, uint32_t s0, uint32_t s1
) {
  typedef uint32_t (__fastcall *F)(uint32_t, uint32_t, uint32_t, uint32_t);
  return ((F)fn)(ecx_in, edx_in, s0, s1);
}
static uint32_t call_fastcall9(
  uintptr_t fn, uint32_t ecx_in, uint32_t edx_in,
  uint32_t s0, uint32_t s1, uint32_t s2, uint32_t s3,
  uint32_t s4, uint32_t s5, uint32_t s6
) {
  typedef uint32_t (__fastcall *F)(
    uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t
  );
  return ((F)fn)(ecx_in, edx_in, s0, s1, s2, s3, s4, s5, s6);
}
static uint32_t call_fastcall11(
  uintptr_t fn, uint32_t ecx_in, uint32_t edx_in,
  uint32_t s0, uint32_t s1, uint32_t s2, uint32_t s3, uint32_t s4,
  uint32_t s5, uint32_t s6, uint32_t s7, uint32_t s8
) {
  typedef uint32_t (__fastcall *F)(
    uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t,
    uint32_t, uint32_t, uint32_t, uint32_t, uint32_t
  );
  return ((F)fn)(ecx_in, edx_in, s0, s1, s2, s3, s4, s5, s6, s7, s8);
}

static __attribute__((noinline)) uint32_t call_eax_stack1_ret4(
  uintptr_t fn, uint32_t eax_in, uint32_t s0
) {
  uint32_t out = eax_in;
  uint32_t f_reg = (uint32_t)fn;
  uint32_t s0_reg = s0;
  __asm__ volatile(
    "pushl %[s0]\n\t"
    "call *%[fn]\n\t"
    : "+a"(out), [fn]"+c"(f_reg), [s0]"+d"(s0_reg)
    :
    : "ebx", "esi", "edi", "cc", "memory"
  );
  return out;
}

/* =========================================================================
 * NDJSON Snapshot Engine
 * ========================================================================= */

typedef struct { uint32_t addr; uint32_t len; } RangeSpec;

#define MAX_SNAP_RANGES 64
typedef struct {
  RangeSpec specs[MAX_SNAP_RANGES];
  uint8_t *pre[MAX_SNAP_RANGES];
  int count;
} Snap;

static void snap_reset(Snap *s) {
  for (int i = 0; i < s->count; i++) { free(s->pre[i]); s->pre[i] = NULL; }
  s->count = 0;
}
static void snap_add(Snap *s, uint32_t addr, uint32_t len) {
  if (s->count < MAX_SNAP_RANGES && len > 0u) {
    s->specs[s->count].addr = addr;
    s->specs[s->count].len = len;
    s->pre[s->count] = NULL;
    s->count++;
  }
}
static void snap_capture(Snap *s) {
  for (int i = 0; i < s->count; i++) {
    free(s->pre[i]);
    s->pre[i] = (uint8_t *)malloc(s->specs[i].len);
    memcpy(s->pre[i], (const void *)(uintptr_t)s->specs[i].addr, s->specs[i].len);
  }
}
static void write_hex(FILE *fp, const uint8_t *buf, uint32_t len) {
  static const char hx[] = "0123456789abcdef";
  for (uint32_t i = 0; i < len; i++) {
    fputc(hx[(buf[i] >> 4) & 0xFu], fp);
    fputc(hx[buf[i] & 0xFu], fp);
  }
}
static void emit_line(
  FILE *fp, uint32_t va, const char *name, const char *case_id,
  const uint32_t *args, int n_args, uint32_t ret_mask, uint32_t eax, Snap *s
) {
  fprintf(fp, "{\"va\":\"0x%08X\",\"name\":\"%s\",\"caseId\":\"%s\",\"args\":[", va, name, case_id);
  for (int i = 0; i < n_args; i++) {
    if (i > 0) fputc(',', fp);
    fprintf(fp, "%u", args[i]);
  }
  fprintf(fp, "],\"retMask\":%u,\"eax\":%u,\"pre\":[", ret_mask, eax);
  for (int i = 0; i < s->count; i++) {
    if (i > 0) fputc(',', fp);
    fprintf(fp, "{\"addr\":%u,\"hex\":\"", s->specs[i].addr);
    write_hex(fp, s->pre[i], s->specs[i].len);
    fprintf(fp, "\"}");
  }
  fprintf(fp, "],\"post\":[");
  int first_post = 1;
  for (int i = 0; i < s->count; i++) {
    const uint8_t *cur = (const uint8_t *)(uintptr_t)s->specs[i].addr;
    if (memcmp(cur, s->pre[i], s->specs[i].len) != 0) {
      if (!first_post) fputc(',', fp);
      first_post = 0;
      fprintf(fp, "{\"addr\":%u,\"hex\":\"", s->specs[i].addr);
      write_hex(fp, cur, s->specs[i].len);
      fprintf(fp, "\"}");
    }
  }
  fprintf(fp, "]}\n");
}

static void set_item_type_equiv_bit(uint32_t row_type, uint32_t match_type) {
  uint32_t word_off = match_type >> 5;
  uint32_t bit = 1u << (match_type & 31u);
  uint32_t addr = ADDR_ITEMTYPES_EQUIV + (row_type * 2u + word_off) * 4u;
  w32(addr, r32(addr) | bit);
}

static void init_isc_row(uint32_t stat_id, uint8_t flags, uint8_t shift, int32_t min_accr) {
  uint32_t rec = ADDR_ISC_TXT + stat_id * 0x144u;
  w16(rec + 0x00u, (uint16_t)stat_id);
  w8(rec + 0x05u, flags);
  w8(rec + 0x18u, shift);
  w8(rec + 0x19u, 8u);
  w32(rec + 0x2Cu, (uint32_t)min_accr);
  w16(rec + 0x58u, 0xFFFFu);
  w16(rec + 0x5Au, 0xFFFFu);
  w16(rec + 0x5Cu, 0xFFFFu);
  for (uint32_t j = 0u; j < 64u; j++) {
    w16(rec + 0x5Eu + j * 2u, 0xFFFFu);
  }
  for (uint32_t j = 0u; j < 16u; j++) {
    w16(rec + 0xDEu + j * 6u, 0xFFFFu);
  }
}

static void init_isc_op13_pair(uint16_t src_stat, uint16_t dst0, uint16_t dst1, uint16_t dst2) {
  uint32_t srec = ADDR_ISC_TXT + (uint32_t)src_stat * 0x144u;
  w8(srec + 0x51u, 1u);
  w8(srec + 0x54u, 13u);
  w16(srec + 0x58u, dst0);
  w16(srec + 0x5Au, dst1);
  w16(srec + 0x5Cu, dst2);
  uint16_t dsts[3] = { dst0, dst1, dst2 };
  for (int i = 0; i < 3; i++) {
    uint32_t drec = ADDR_ISC_TXT + (uint32_t)dsts[i] * 0x144u;
    w8(drec + 0x52u, 1u);
    w16(drec + 0xDEu, 0xFFFFu);
    w16(drec + 0xE0u, src_stat);
    w8(drec + 0xE2u, 13u);
    w8(drec + 0xE3u, 0u);
  }
}

static uint32_t g_anim_bucket_cursor = 0u;

static void add_anim_record(const char *code8, uint32_t frames, uint32_t speed) {
  uint32_t h = 0u;
  for (int i = 0; i < 8 && code8[i] != '\0'; i++) {
    uint8_t c = (uint8_t)code8[i];
    if ((int8_t)c >= 'a' && (int8_t)c <= 'z') c = (uint8_t)(c - 0x20);
    h = (h + c) & 0xFFu;
  }
  uint32_t bucket = r32(ADDR_ANIM_TBL + 4u + h * 4u);
  if (bucket == ADDR_ANIM_BUCKETS) {
    g_anim_bucket_cursor += 0x100u;
    bucket = ADDR_ANIM_BUCKETS + g_anim_bucket_cursor;
    w32(ADDR_ANIM_TBL + 4u + h * 4u, bucket);
    w32(bucket, 0u);
  }
  uint32_t count = r32(bucket);
  uint32_t rec = bucket + 4u + count * 0xA0u;
  memset((void *)(uintptr_t)rec, 0, 0xA0u);
  for (int i = 0; i < 8 && code8[i] != '\0'; i++) {
    uint8_t c = (uint8_t)code8[i];
    if ((int8_t)c >= 'a' && (int8_t)c <= 'z') c = (uint8_t)(c - 0x20);
    w8(rec + (uint32_t)i, c);
  }
  w32(rec + 0x08u, frames);
  w32(rec + 0x0Cu, speed);
  w8(rec + 0x10u + 2u, 1u); /* event on frame 2 */
  w32(bucket, count + 1u);
}

static void setup_base_tables(void) {
  memset((void *)(uintptr_t)ARENA_BASE, 0, 0x34000u);
  reset_heap();

  /* 1. Bitmasks */
  w32(VA_GDWBITMASKS_IAT, ADDR_BITMASKS);
  w32(VA_GDWINVBITMASKS_IAT, ADDR_INVBITMASKS);
  for (uint32_t i = 0; i < 32u; i++) {
    w32(ADDR_BITMASKS + i * 4u, 1u << i);
    w32(ADDR_INVBITMASKS + i * 4u, ~(1u << i));
  }

  /* 2. sgptDataTables & Experience */
  w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);
  w32(VA_EXPERIENCE_PTR, ADDR_EXPERIENCE);
  w32(ADDR_EXPERIENCE + 0x00u, 99u); /* nMaxLevel = 99 */

  w32(ADDR_DATATABLES + 0x40u, ADDR_RPN_CODE);
  w32(ADDR_DATATABLES + 0x44u, 0x400u);
  w32(ADDR_DATATABLES + 0xBCu, ADDR_STATES_TXT);
  w32(ADDR_DATATABLES + 0xC4u, 190u); /* > 0x79 */
  w32(ADDR_DATATABLES + 0xDCu, ADDR_STATE_MASK_TBL);
  w32(ADDR_DATATABLES + 0x164u, ADDR_STATE_MASK_TBL);
  w32(ADDR_DATATABLES + 0xBC4u, ADDR_CHARSTATS_TXT);
  w32(ADDR_DATATABLES + 0xBC8u, 7u);
  for (uint32_t cs = 0; cs < 7u; cs++) {
    w32(ADDR_CHARSTATS_TXT + cs * 0xC4u + 0x4Cu, 0x20687468u); /* 'hth ' */
  }

  /* State restrict mask for state 0x79 (disable skill test) & active mask */
  for (uint32_t st = 0; st < 190u; st++) {
    w16(ADDR_STATES_TXT + st * 0x100u, (uint16_t)st);
  }

  /* RPN scripts inside ADDR_RPN_CODE */
  /* off 0x00: imm 25 -> 25 */
  w8(ADDR_RPN_CODE + 0x00u, 7u); w8(ADDR_RPN_CODE + 0x01u, 25u); w8(ADDR_RPN_CODE + 0x02u, 0u);
  /* off 0x04: var(16=lvl) * 2 */
  w8(ADDR_RPN_CODE + 0x04u, 4u); w8(ADDR_RPN_CODE + 0x05u, 16u);
  w8(ADDR_RPN_CODE + 0x06u, 7u); w8(ADDR_RPN_CODE + 0x07u, 2u);
  w8(ADDR_RPN_CODE + 0x08u, 18u); w8(ADDR_RPN_CODE + 0x09u, 0u);
  /* off 0x10: skill(skillId=1, field=40=charLvl) -> fnIdx=3 (B1-15) */
  w8(ADDR_RPN_CODE + 0x10u, 7u); w8(ADDR_RPN_CODE + 0x11u, 1u);
  w8(ADDR_RPN_CODE + 0x12u, 7u); w8(ADDR_RPN_CODE + 0x13u, 40u);
  w8(ADDR_RPN_CODE + 0x14u, 1u); w8(ADDR_RPN_CODE + 0x15u, 3u); w8(ADDR_RPN_CODE + 0x16u, 0u);
  /* off 0x20: sklvl(skillId=1, field1=16, field2=0) -> fnIdx=6 (B1-14) */
  w8(ADDR_RPN_CODE + 0x20u, 7u); w8(ADDR_RPN_CODE + 0x21u, 1u);
  w8(ADDR_RPN_CODE + 0x22u, 7u); w8(ADDR_RPN_CODE + 0x23u, 16u);
  w8(ADDR_RPN_CODE + 0x24u, 7u); w8(ADDR_RPN_CODE + 0x25u, 0u);
  w8(ADDR_RPN_CODE + 0x26u, 1u); w8(ADDR_RPN_CODE + 0x27u, 6u); w8(ADDR_RPN_CODE + 0x28u, 0u);
  /* off 0x30: imm 40 */
  w8(ADDR_RPN_CODE + 0x30u, 7u); w8(ADDR_RPN_CODE + 0x31u, 40u); w8(ADDR_RPN_CODE + 0x32u, 0u);
  /* off 0x40: imm 0 */
  w8(ADDR_RPN_CODE + 0x40u, 7u); w8(ADDR_RPN_CODE + 0x41u, 0u); w8(ADDR_RPN_CODE + 0x42u, 0u);
  /* off 0x50: var(0=lin12) + 5 -> B1-16 callback */
  w8(ADDR_RPN_CODE + 0x50u, 4u); w8(ADDR_RPN_CODE + 0x51u, 0u);
  w8(ADDR_RPN_CODE + 0x52u, 7u); w8(ADDR_RPN_CODE + 0x53u, 5u);
  w8(ADDR_RPN_CODE + 0x54u, 16u); w8(ADDR_RPN_CODE + 0x55u, 0u);

  /* 3. ItemStatCostTxt */
  w32(ADDR_DATATABLES + 0xBCCu, ADDR_ISC_TXT);
  w32(ADDR_DATATABLES + 0xBD4u, 280u);
  init_isc_row(0x00u, 0x00u, 0u, 0);
  init_isc_row(0x02u, 0x00u, 0u, 0);
  init_isc_row(0x08u, 0x00u, 8u, 0);
  init_isc_row(0x09u, 0x00u, 8u, 0);
  init_isc_row(0x0Cu, 0x00u, 0u, 0);
  init_isc_row(0x11u, 0x04u, 0u, 10); /* fMin test in legacy */
  init_isc_row(0x12u, 0x04u, 0u, 12);
  init_isc_row(0x13u, 0x00u, 0u, 0);
  init_isc_row(0x15u, 0x00u, 0u, 0);
  init_isc_row(0x16u, 0x00u, 0u, 0);
  init_isc_row(0x17u, 0x00u, 0u, 0);
  init_isc_row(0x18u, 0x00u, 0u, 0);
  init_isc_row(0x19u, 0x00u, 0u, 0);
  init_isc_row(0x44u, 0x00u, 0u, 0);
  init_isc_row(0x5Du, 0x00u, 0u, 0);
  init_isc_row(0x89u, 0x04u, 0u, 5); /* item_kickdamage with fMin=5 */
  init_isc_row(0x9Fu, 0x00u, 0u, 0);
  init_isc_row(0xA0u, 0x00u, 0u, 0);
  init_isc_row(0xCCu, 0x00u, 0u, 0);
  init_isc_op13_pair(0x11u, 0x16u, 0x18u, 0xA0u);
  init_isc_op13_pair(0x12u, 0x15u, 0x17u, 0x9Fu);

  /* 4. ItemTypesTxt & Equiv Matrix */
  w32(ADDR_DATATABLES + 0xBF8u, ADDR_ITEMTYPES_TXT);
  w32(ADDR_DATATABLES + 0xBFCu, 64u); /* >= 0x33 so equiv checks for 0x2D/0x32 succeed */
  w32(ADDR_DATATABLES + 0xC00u, 2u);
  w32(ADDR_DATATABLES + 0xC04u, ADDR_ITEMTYPES_EQUIV);
  set_item_type_equiv_bit(1u, 0x2Du); /* Type 1: 1H/2H weapon (0x2D), not throw */
  set_item_type_equiv_bit(2u, 0x2Du); /* Type 2: throw weapon */
  w8(ADDR_ITEMTYPES_TXT + 2u * 0xE4u + 0x10u, 1u); /* nThrows = 1 */
  set_item_type_equiv_bit(3u, 0x1Bu); /* Type 3: bow (0x1B) */
  set_item_type_equiv_bit(3u, 0x2Du);
  set_item_type_equiv_bit(4u, 0x23u); /* Type 4: crossbow (0x23) */
  set_item_type_equiv_bit(4u, 0x2Du);
  set_item_type_equiv_bit(5u, 0x32u); /* Type 5: armor/boots (0x32), NOT weapon */

  /* 5. ItemsTxt + Linker */
  w32(VA_ITEMS_TXT_COUNT, 6u);
  w32(VA_ITEMS_TXT_PTR, ADDR_ITEMS_TXT);
  w32(VA_ITEMS_LINKER_PTR, ADDR_LINK);
  /* Row 0: 1H+2H weapon ('axe ') */
  {
    uint32_t r = ADDR_ITEMS_TXT + 0u * 0x1A8u;
    w32(r + 0x80u, 0x20657861u); /* 'axe ' */
    w32(r + 0xC0u, 0x20736831u); /* '1hs ' */
    w8(r + 0xFEu, 4u); w8(r + 0xFFu, 10u);
    w8(r + 0x100u, 0u); w8(r + 0x101u, 0u);
    w8(r + 0x102u, 6u); w8(r + 0x103u, 14u);
    w16(r + 0x106u, 100u); w16(r + 0x108u, 0u);
    w16(r + 0x11Eu, 1u);
    w8(r + 0x132u, 0u);
  }
  /* Row 1: Pure 2H weapon (1H min/max = 0, 2H min=12/max=22) ('maul') */
  {
    uint32_t r = ADDR_ITEMS_TXT + 1u * 0x1A8u;
    w32(r + 0x80u, 0x6C75616Du); /* 'maul' */
    w32(r + 0xC0u, 0x20736832u); /* '2hs ' */
    w8(r + 0xFEu, 0u); w8(r + 0xFFu, 0u);
    w8(r + 0x102u, 12u); w8(r + 0x103u, 22u);
    w16(r + 0x11Eu, 1u);
    w8(r + 0x132u, 1u);
  }
  /* Row 2: Throw weapon ('jav ') */
  {
    uint32_t r = ADDR_ITEMS_TXT + 2u * 0x1A8u;
    w32(r + 0x80u, 0x2076616Au); /* 'jav ' */
    w32(r + 0xC0u, 0x20746831u); /* '1ht ' */
    w8(r + 0xFEu, 3u); w8(r + 0xFFu, 8u);
    w8(r + 0x100u, 5u); w8(r + 0x101u, 11u);
    w8(r + 0x102u, 0u); w8(r + 0x103u, 0u);
    w16(r + 0x11Eu, 2u);
  }
  /* Row 3: Bow ('bow ') */
  {
    uint32_t r = ADDR_ITEMS_TXT + 3u * 0x1A8u;
    w32(r + 0x80u, 0x20776F62u); /* 'bow ' */
    w32(r + 0xC0u, 0x20776F62u); /* 'bow ' */
    w8(r + 0xFEu, 2u); w8(r + 0xFFu, 6u);
    w16(r + 0x11Eu, 3u);
    w8(r + 0x115u, 5u); /* bComponent = rarm (5) at +0x115 so COMPOSIT sees equipped bow */
  }
  /* Row 4: Boots ('boot') -> min/max kick dmg, StrBonus=120, DexBonus=80 */
  {
    uint32_t r = ADDR_ITEMS_TXT + 4u * 0x1A8u;
    w32(r + 0x80u, 0x746F6F62u); /* 'boot' */
    w8(r + 0xFEu, 10u); w8(r + 0xFFu, 18u);
    w16(r + 0x106u, 120u); w16(r + 0x108u, 80u);
    w16(r + 0x11Eu, 5u);
  }
  /* Row 5: Unique axe alt with base dwCode='axe ' and high dmg */
  {
    uint32_t r = ADDR_ITEMS_TXT + 5u * 0x1A8u;
    w32(r + 0x80u, 0x20657861u); /* 'axe ' */
    w32(r + 0xC0u, 0x20736831u);
    w8(r + 0xFEu, 20u); w8(r + 0xFFu, 50u);
    w8(r + 0x102u, 0u); w8(r + 0x103u, 0u);
    w16(r + 0x11Eu, 1u);
  }
  /* Sorted linker entries */
  w32(ADDR_LINK + 0x00u, 5u);
  w32(ADDR_LINK + 0x08u, ADDR_LINK_ENTRIES);
  w32(ADDR_LINK_ENTRIES + 0x00u, 0x20657861u); w32(ADDR_LINK_ENTRIES + 0x04u, 0u); /* 'axe ' */
  w32(ADDR_LINK_ENTRIES + 0x08u, 0x2076616Au); w32(ADDR_LINK_ENTRIES + 0x0Cu, 2u); /* 'jav ' */
  w32(ADDR_LINK_ENTRIES + 0x10u, 0x20776F62u); w32(ADDR_LINK_ENTRIES + 0x14u, 3u); /* 'bow ' */
  w32(ADDR_LINK_ENTRIES + 0x18u, 0x6C75616Du); w32(ADDR_LINK_ENTRIES + 0x1Cu, 1u); /* 'maul' */
  w32(ADDR_LINK_ENTRIES + 0x20u, 0x746F6F62u); w32(ADDR_LINK_ENTRIES + 0x24u, 4u); /* 'boot' */

  /* 6. MonStatsTxt & MonStats2Txt */
  w32(ADDR_DATATABLES + 0xA78u, ADDR_MONSTATS_TXT);
  w32(ADDR_DATATABLES + 0xA80u, 4u);
  w32(VA_MONSTATS_PTR, ADDR_MONSTATS_TXT);
  w32(VA_MONSTATS_COUNT, 4u);
  w32(ADDR_DATATABLES + 0xA90u, ADDR_MONSTATS2_TXT);
  w32(ADDR_DATATABLES + 0xA98u, 4u);
  w32(ADDR_MONSTATS_TXT + 0u * 0x1A8u + 0x10u, 0x20204941u); /* 'AI  ' */
  w16(ADDR_MONSTATS_TXT + 0u * 0x1A8u + 0x18u, 0u);
  w8(ADDR_MONSTATS2_TXT + 0u * 0x134u + 0x06u, 0x01u); /* bit 16 (0x10) = byte +6 bit 0 */
  w32(ADDR_MONSTATS2_TXT + 0u * 0x134u + 0x10u, 0x20687468u); /* 'hth ' */
  w32(ADDR_MONSTATS_TXT + 1u * 0x1A8u + 0x10u, 0x20204B53u); /* 'SK  ' */
  w16(ADDR_MONSTATS_TXT + 1u * 0x1A8u + 0x18u, 1u);
  w32(ADDR_MONSTATS2_TXT + 1u * 0x134u + 0x08u, 0x00u); /* no weapon bit */

  /* 7. Anim tables & AnimData */
  w32(VA_ANIM_PLR_COUNT, 20u);
  w32(VA_ANIM_PLR_GUARD, 1u);
  w32(VA_ANIM_PLR_TTBL, ADDR_PLR_TYPES);
  w32(VA_ANIM_PLR_MTBL, ADDR_PLR_MODES);
  w32(ADDR_PLR_TYPES + 0u * 0x34u + 0x20u, 0x20204D41u); /* 'AM  ' */
  w32(ADDR_PLR_TYPES + 1u * 0x34u + 0x20u, 0x20204F53u); /* 'SO  ' */
  w32(ADDR_PLR_MODES + 0u * 0x34u + 0x20u, 0x20204E54u); /* 'TN  ' */
  w32(ADDR_PLR_MODES + 7u * 0x34u + 0x20u, 0x20203141u); /* 'A1  ' */
  w32(ADDR_PLR_MODES + 11u * 0x34u + 0x20u, 0x20204444u); /* 'DD  ' */
  w32(ADDR_PLR_MODES + 18u * 0x34u + 0x20u, 0x20205858u); /* 'XX  ' overridden to 'gh' */

  w32(VA_ANIM_MON_MCOUNT, 16u);
  w32(VA_ANIM_MON_MTBL, ADDR_MON_MODES);
  w32(ADDR_MON_MODES + 0u * 0x34u + 0x20u, 0x2020554Eu); /* 'NU  ' */
  w32(ADDR_MON_MODES + 7u * 0x34u + 0x20u, 0x20203141u); /* 'A1  ' */
  w32(ADDR_MON_MODES + 13u * 0x34u + 0x20u, 0x20205959u); /* overridden to 'gh' */

  w32(VA_ANIM_OBJ_COUNT, 4u);
  w32(VA_ANIM_OBJ_TTBL, ADDR_OBJ_TYPES);
  w32(VA_ANIM_OBJ_MTBL, ADDR_OBJ_MODES);
  w32(ADDR_OBJ_TYPES + 0u * 0x34u + 0x20u, 0x2020314Fu); /* 'O1  ' */
  w32(ADDR_OBJ_MODES + 0u * 0x34u + 0x20u, 0x2020554Eu); /* 'NU  ' */

  w32(VA_ANIMDATA_TABLE, ADDR_ANIM_TBL);
  g_anim_bucket_cursor = 0u;
  w32(ADDR_ANIM_BUCKETS, 0u);
  for (uint32_t h = 0; h < 256u; h++) {
    w32(ADDR_ANIM_TBL + 4u + h * 4u, ADDR_ANIM_BUCKETS);
  }
  w32(ADDR_ANIM_TBL + 0x40Cu, 16u);
  w32(ADDR_ANIM_TBL + 0x410u, 256u);
  add_anim_record("AMA11HS", 16u, 256u);
  add_anim_record("AMA12HS", 20u, 200u);
  add_anim_record("AIA1HTH", 12u, 192u);
  add_anim_record("AIA1", 12u, 192u);
  add_anim_record("AMA1HTH", 0u, 128u); /* 0 frames for assert test! */

  /* 8. SkillsTxt, SkillDescTxt, MissilesTxt */
  w32(ADDR_DATATABLES + 0xB98u, ADDR_SKILLS_TXT);
  w32(ADDR_DATATABLES + 0xBA0u, 8u);
  w32(ADDR_DATATABLES + 0xB8Cu, ADDR_SKILLDESC_TXT);
  w32(ADDR_DATATABLES + 0xB94u, 4u);
  w32(ADDR_DATATABLES + 0xB64u, ADDR_MISSILES_TXT);
  w32(ADDR_DATATABLES + 0xB6Cu, 4u);

  /* SkillDesc 0 & 1: missile IDs 0, 1, 2 at +0x3c, +0x3e, +0x40 */
  w16(ADDR_SKILLDESC_TXT + 0x3Cu, 0u);
  w16(ADDR_SKILLDESC_TXT + 0x3Eu, 1u);
  w16(ADDR_SKILLDESC_TXT + 0x40u, 2u);
  w16(ADDR_SKILLDESC_TXT + 0x120u + 0x3Cu, 1u);

  /* Missiles 0 & 1 */
  for (uint32_t mid = 0; mid < 3u; mid++) {
    uint32_t pm = ADDR_MISSILES_TXT + mid * 0x1B8u;
    w16(pm + 0x00u, (uint16_t)mid);
    w16(pm + 0x96u, (uint16_t)(10u + mid * 5u)); /* range base */
    w16(pm + 0x98u, (uint16_t)(2u + mid));        /* range per lvl */
    w8(pm + 0xCCu, 8u);                            /* hitShift = 8 */
    w8(pm + 0xCDu, 1u);                            /* elemType = Fire */
    w32(pm + 0xE8u, 12u + mid * 4u);               /* EMin */
    w32(pm + 0xECu, 24u + mid * 6u);               /* EMax */
    w32(pm + 0xF0u, 3u);                           /* EMinLev1 */
    w32(pm + 0x104u, 5u);                          /* EMaxLev1 */
    w32(pm + 0x118u, 0xFFFFFFFFu);                 /* no dmg calc */
    w32(pm + 0x11Cu, 50u);                         /* ELen */
    w32(pm + 0x120u, 10u);                         /* ELenLev1 */
    w32(pm + 0x12Cu, 0xFFFFFFFFu);                 /* no len calc */
  }

  /* Skill 0: comprehensive calc fields + RPN */
  {
    uint32_t sk = ADDR_SKILLS_TXT + 0u * 0x23Cu;
    w16(sk + 0x00u, 0u);
    w32(sk + 0x04u, 0x0400u); /* bit 9+1? wait byte+5=0x04 -> bit2 inGame! */
    w8(sk + 0x14u, 2u);       /* bElemType = 2 (non-3) */
    /* RPN fields 54..72 -> [0x60, 0x138..0x144, 0x64..0x7c, 0xa4..0xb4, 0xc0, 0x170] */
    w32(sk + 0x60u, 0x00u);   /* case 54 -> 25 */
    w32(sk + 0x138u, 0x04u);  /* case 55 -> lvl*2 */
    w32(sk + 0x13Cu, 0x50u);  /* case 56 -> lin12 + 5 */
    w32(sk + 0x140u, 0x10u);  /* case 57 -> skill(1,40) via B1-15 */
    w32(sk + 0x144u, 0x20u);  /* case 58 -> sklvl(1,16,0) via B1-14 */
    w32(sk + 0x64u, 0x30u);   /* case 59 -> 40 */
    w32(sk + 0x68u, 0x00u);   w32(sk + 0x6Cu, 0x04u);   w32(sk + 0x70u, 0x30u);
    w32(sk + 0x74u, 0x00u);   w32(sk + 0x78u, 0x04u);   w32(sk + 0x7Cu, 0x30u);
    w16(sk + 0x98u, 0x156u);  w16(sk + 0x9Au, 0x157u);  w16(sk + 0x9Cu, 0x158u);
    w32(sk + 0xA4u, 0x00u);   /* grp0: 25 */
    w32(sk + 0xA8u, 0x04u);   /* grp1: lvl*2 */
    w32(sk + 0xACu, 0x30u);   /* grp2: 40 */
    w32(sk + 0xB0u, 0x00u);   w32(sk + 0xB4u, 0x04u);   w32(sk + 0xC0u, 0x30u);
    w16(sk + 0x12Cu, 20u);    /* wMaxLvl = 20 */
    w32(sk + 0x148u, 11u); w32(sk + 0x14Cu, 2u); /* P1, P2 */
    w32(sk + 0x150u, 21u); w32(sk + 0x154u, 3u); /* P3, P4 */
    w32(sk + 0x158u, 31u); w32(sk + 0x15Cu, 4u); /* P5, P6 */
    w32(sk + 0x160u, 41u); w32(sk + 0x164u, 5u); /* P7, P8 */
    w32(sk + 0x170u, 0x30u);  /* case 72 -> 40 */
    w16(sk + 0x174u, 6u);     /* wReqLevel = 6 */
    w8(sk + 0x188u, 8u);      /* costShift = 8 */
    w16(sk + 0x18Au, 10u);    /* mana = 10 */
    w16(sk + 0x18Cu, 2u);     /* lvlMana = 2 */
    w32(sk + 0x190u, 0x00u);  /* decr calc = 25 (>0) */
    w16(sk + 0x194u, 0u);     /* wSkillDesc = 0 */
    w32(sk + 0x198u, 20u); w32(sk + 0x19Cu, 5u); w32(sk + 0x1A0u, 0xFFFFFFFFu); /* tohit */
    w8(sk + 0x1A4u, 8u);      /* hitShift = 8 */
    w8(sk + 0x1A5u, 64u);     /* nSrcDmg = 64 (50%) */
    w32(sk + 0x1A8u, 8u); w32(sk + 0x1ACu, 16u); /* phys min/max */
    w32(sk + 0x1B0u, 2u); w32(sk + 0x1C4u, 4u);  /* phys lev1 */
    w32(sk + 0x1D8u, 0xFFFFFFFFu);               /* no phys calc */
    w8(sk + 0x1DCu, 1u);      /* elem type = Fire */
    w32(sk + 0x1E0u, 10u); w32(sk + 0x1E4u, 20u); /* elem min/max */
    w32(sk + 0x1E8u, 3u);  w32(sk + 0x1FCu, 5u);  /* elem lev1 */
    w32(sk + 0x210u, 0x00u);  /* +25% elem calc! */
    w32(sk + 0x214u, 50u); w32(sk + 0x218u, 10u); w32(sk + 0x21Cu, 20u); w32(sk + 0x220u, 30u);
    w32(sk + 0x224u, 0x00u);  /* +25% delay/len calc */
    w8(sk + 0x228u, 1u);      /* state restrict = 1 */
  }
  /* Skill 1: nElemType=3 (bow shot count), tohit calc, phys calc */
  {
    uint32_t sk = ADDR_SKILLS_TXT + 1u * 0x23Cu;
    w16(sk + 0x00u, 1u);
    w32(sk + 0x04u, 0x0400u);
    w8(sk + 0x14u, 3u);       /* bElemType = 3 */
    w16(sk + 0x12Cu, 25u);
    w32(sk + 0x148u, 15u); w32(sk + 0x14Cu, 3u);
    w16(sk + 0x174u, 18u);    /* wReqLevel = 18 */
    w32(sk + 0x190u, 0x40u);  /* 0 -> blocked in B2-13 */
    w16(sk + 0x194u, 1u);     /* wSkillDesc = 1 */
    w32(sk + 0x1A0u, 0x04u);  /* tohit calc = lvl*2 */
    w8(sk + 0x1A4u, 0u);      /* hitShift = 0 (direct units) */
    w8(sk + 0x1A5u, 128u);    /* nSrcDmg = 128 (100%) */
    w32(sk + 0x1A8u, 5u); w32(sk + 0x1ACu, 12u);
    w32(sk + 0x1B0u, 1u); w32(sk + 0x1C4u, 2u);
    w32(sk + 0x1D8u, 0x00u);  /* +25% phys calc */
    w8(sk + 0x1DCu, 1u);
    w32(sk + 0x1E0u, 100u); w32(sk + 0x1E4u, 200u);
    w32(sk + 0x210u, 0xFFFFFFFFu);
    w32(sk + 0x214u, 40u); w32(sk + 0x218u, 4u);
    w32(sk + 0x224u, 0xFFFFFFFFu);
    w8(sk + 0x228u, 1u);
  }
  /* Skill 2: dwFlags0 |= 0x0200 (base phys dmg) & wReqLevel = 30 */
  {
    uint32_t sk = ADDR_SKILLS_TXT + 2u * 0x23Cu;
    w16(sk + 0x00u, 2u);
    w32(sk + 0x04u, 0x0600u); /* bit 9 (0x200 base phys) + bit 10 (0x400) */
    w16(sk + 0x12Cu, 20u);
    w16(sk + 0x174u, 30u);
    w16(sk + 0x194u, 0xFFFFu); /* no skilldesc */
    w8(sk + 0x228u, 1u);
  }
  /* Skill 3: flagByte0 bit 0x20 (B2-14 -> 6) */
  {
    uint32_t sk = ADDR_SKILLS_TXT + 3u * 0x23Cu;
    w16(sk + 0x00u, 3u);
    w32(sk + 0x04u, 0x0420u);
    w8(sk + 0x228u, 1u);
  }
  /* Skill 4: flagByte0 bit 0x10 (B2-14 -> 5) */
  {
    uint32_t sk = ADDR_SKILLS_TXT + 4u * 0x23Cu;
    w16(sk + 0x00u, 4u);
    w32(sk + 0x04u, 0x0410u);
    w8(sk + 0x228u, 1u);
  }
  /* Skill 5: dwFlags0 = 0 (B2-14 -> 3) */
  {
    uint32_t sk = ADDR_SKILLS_TXT + 5u * 0x23Cu;
    w16(sk + 0x00u, 5u);
    w32(sk + 0x04u, 0x0000u);
  }
}

static void stage_common(Snap *s) {
  snap_reset(s);
  snap_add(s, VA_GDWINVBITMASKS_IAT, 4u);
  snap_add(s, VA_GDWBITMASKS_IAT, 4u);
  snap_add(s, VA_SGPT_DATATABLES, 4u);
  snap_add(s, VA_WEAP_CLASS_COUNT, 40u);
  snap_add(s, VA_ITEMS_TXT_COUNT, 8u);
  snap_add(s, VA_ITEMS_LINKER_PTR, 4u);
  snap_add(s, VA_MONSTATS_PTR, 12u);
  snap_add(s, VA_ANIMDATA_TABLE, 4u);
  snap_add(s, VA_EXPERIENCE_PTR, 4u);
  snap_add(s, VA_ANIM_MON_MCOUNT, 48u);
  snap_add(s, VA_GRID0_DEF, 32u);
  snap_add(s, 0x6FDE3368u, 112u);
  snap_add(s, ADDR_GRID0, 0x40u);
  snap_add(s, ADDR_GRID0_ITEMS, 0x40u);
  snap_add(s, ADDR_BITMASKS, 0x100u);
  snap_add(s, ADDR_DATATABLES, 0xCA0u);
  snap_add(s, ADDR_EXPERIENCE, 0x20u);
  snap_add(s, ADDR_RPN_CODE, 0x80u);
  snap_add(s, ADDR_CHARSTATS_TXT, 7u * 0xC4u);
  snap_add(s, ADDR_ISC_TXT, 280u * 0x144u);
  snap_add(s, ADDR_ITEMTYPES_TXT, 6u * 0xE4u);
  snap_add(s, ADDR_ITEMTYPES_EQUIV, 12u * 8u);
  snap_add(s, ADDR_ITEMS_TXT, 6u * 0x1A8u);
  snap_add(s, ADDR_LINK, 0x18u);
  snap_add(s, ADDR_LINK_ENTRIES, 0x40u);
  snap_add(s, ADDR_MONSTATS_TXT, 2u * 0x1A8u);
  snap_add(s, ADDR_MONSTATS2_TXT, 2u * 0x134u);
  snap_add(s, ADDR_STATE_MASK_TBL, 0x20u);
  snap_add(s, ADDR_STATES_TXT, 190u * 0x100u);
  snap_add(s, ADDR_SKILLS_TXT, 6u * 0x23Cu);
  snap_add(s, ADDR_SKILLDESC_TXT, 2u * 0x120u);
  snap_add(s, ADDR_MISSILES_TXT, 3u * 0x1B8u);
}

static void init_player_unit(uint32_t u, uint32_t sl_ex, uint32_t sl, uint32_t stats, uint32_t inv) {
  memset((void *)(uintptr_t)u, 0, 0x100u);
  w32(u + 0x00u, 0u); /* UNIT_PLAYER */
  w32(u + 0x04u, 0u); /* Amazon */
  w32(u + 0x0Cu, 1001u); /* dwUnitId */
  w32(u + 0x20u, 0x12345678u); /* seed lo */
  w32(u + 0x24u, 0x00000001u); /* seed hi */
  w32(u + 0x5Cu, sl_ex);
  w32(u + 0x60u, inv);
  w32(u + 0xA8u, ADDR_SKILLS_HDR);
  w32(sl_ex + 0x10u, 0x80000000u); /* unit stat list ex flag */
  w32(sl_ex + 0x34u, 0u);
  w32(sl_ex + 0x3Cu, sl);
  w32(sl_ex + 0x40u, sl);
  w32(sl_ex + 0x44u, u);
  w32(sl_ex + 0x48u, stats); /* fullStats.pStat */
  w32(sl_ex + 0x24u, stats + 0x100u); /* baseStats.pStat (separate from child sl) */
  w16(sl_ex + 0x2Au, 16u);
  w16(sl_ex + 0x4Eu, 16u);
  w32(sl_ex + 0x58u, ADDR_STATEFLAGS);
  w32(sl + 0x10u, 0x40u);
  w32(sl + 0x24u, stats);
  w16(sl + 0x2Au, 16u);
  w32(sl + 0x34u, sl_ex);
  w32(sl + 0x44u, u);
  if (inv != 0u) {
    w32(inv + 0x00u, 0x01020304u);
    w32(inv + 0x04u, 0u); /* pMemPool = NULL */
    w32(inv + 0x14u, ADDR_GRID0);
    w32(inv + 0x18u, 1u);
    w32(inv + 0x1Cu, 0xFFFFFFFFu);
    w8(ADDR_GRID0 + 0x08u, 13u);
    w8(ADDR_GRID0 + 0x09u, 1u);
    w32(ADDR_GRID0 + 0x0Cu, ADDR_GRID0_ITEMS);
  }
}

static void set_stat_pair(uint32_t sl_or_ex, uint32_t stats_arr, int idx, uint16_t stat_id, uint16_t layer, int32_t val) {
  uint32_t key = ((uint32_t)stat_id << 16) | layer;
  w32(stats_arr + (uint32_t)idx * 8u + 0u, key);
  w32(stats_arr + (uint32_t)idx * 8u + 4u, (uint32_t)val);
  w16(sl_or_ex + 0x28u, (uint16_t)(idx + 1));
  w16(sl_or_ex + 0x2Au, 16u);
  w16(sl_or_ex + 0x4Cu, (uint16_t)(idx + 1));
  w16(sl_or_ex + 0x4Eu, 16u);
}

static void init_item_unit(uint32_t it, uint32_t data, uint32_t sl_ex, uint32_t sl, uint32_t stats, uint32_t full_stats, uint32_t class_id, uint16_t fmt, uint8_t ilvl, uint8_t body_loc, uint32_t uid) {
  memset((void *)(uintptr_t)it, 0, 0x100u);
  memset((void *)(uintptr_t)data, 0, 0x100u);
  w32(it + 0x00u, 4u); /* UNIT_ITEM */
  w32(it + 0x04u, class_id);
  w32(it + 0x0Cu, uid);
  w32(it + 0x14u, data);
  w32(it + 0x20u, 0x55AA1234u);
  w32(it + 0x24u, 0x00000001u);
  w32(it + 0x5Cu, sl_ex);
  w16(data + 0x30u, fmt);
  w8(data + 0x2Cu, ilvl);
  w8(data + 0x44u, body_loc);
  w32(sl_ex + 0x04u, it);
  w32(sl_ex + 0x08u, 4u);
  w32(sl_ex + 0x10u, 0x80000000u);
  w32(sl_ex + 0x34u, 0u);
  w32(sl_ex + 0x3Cu, sl);
  w32(sl_ex + 0x40u, sl);
  w32(sl_ex + 0x44u, it);
  w32(sl_ex + 0x24u, stats + 0x100u);
  w16(sl_ex + 0x2Au, 16u);
  w32(sl_ex + 0x48u, full_stats);
  w16(sl_ex + 0x4Eu, 16u);
  w32(sl + 0x04u, it);
  w32(sl + 0x08u, 4u);
  w32(sl + 0x10u, 0x40u);
  w32(sl + 0x24u, stats);
  w16(sl + 0x2Au, 16u);
  w32(sl + 0x34u, sl_ex);
  w32(sl + 0x44u, it);
}

static void stage_anim_tables(Snap *s) {
  snap_add(s, ADDR_PLR_TYPES, 2u * 0x34u);
  snap_add(s, ADDR_PLR_MODES, 20u * 0x34u);
  snap_add(s, ADDR_MON_MODES, 16u * 0x34u);
  snap_add(s, ADDR_OBJ_TYPES, 2u * 0x34u);
  snap_add(s, ADDR_OBJ_MODES, 2u * 0x34u);
  snap_add(s, ADDR_ANIM_TBL, 0x420u);
  snap_add(s, ADDR_ANIM_BUCKETS, 0x600u);
}

static void stage_item_tree(Snap *s) {
  snap_add(s, ADDR_ITEM, 0x100u);
  snap_add(s, ADDR_ITEMDATA, 0x100u);
  snap_add(s, ADDR_SLISTEX_ITEM, 0x100u);
  snap_add(s, ADDR_SLIST_ITEM, 0x100u);
  snap_add(s, ADDR_SLIST_ITEM_STATS, 0x200u);
  snap_add(s, ADDR_SLIST_FULL_ITEM, 0x100u);
  snap_add(s, ADDR_ITEMPROP, 0x40u);
}

static void emit_b1_01_to_07(FILE *fp) {
  Snap s = {0};

  /* B1-01: 0x6FD93C30 UNITS_GetAnimDataStringOrPath (stdcall9 void, retMask=0) */
  {
    const uint32_t va = 0x6FD93C30u;
    const char *nm = "UNITS_GetAnimDataStringOrPath113c";
    const struct {
      const char *id; uint32_t ut, cls, mode, initW, incPath, chkW;
    } cases[] = {
      {"plr_path_checkw", 0u, 0u, 7u, 0u, 1u, 1u},
      {"plr_mode18_gh",   0u, 1u, 18u, 0x20736831u, 0u, 0u},
      {"plr_mode0b_hth",  0u, 0u, 11u, 0x20776F62u, 0u, 0u},
      {"mon_mode7_path",  1u, 0u, 7u, 0u, 1u, 0u},
      {"obj_mode0_path",  2u, 0u, 0u, 0u, 1u, 0u},
    };
    for (int i = 0; i < 5; i++) {
      setup_base_tables();
      init_player_unit(ADDR_UNIT, ADDR_SLISTEX, ADDR_SLIST, ADDR_SLIST_STATS, ADDR_INV);
      w32(ADDR_OUTDW, cases[i].initW);
      stage_common(&s);
      stage_anim_tables(&s);
      snap_add(&s, ADDR_UNIT, 0x100u);
      snap_add(&s, ADDR_INV, 0x100u);
      snap_add(&s, ADDR_GRID0, 0x40u);
      snap_add(&s, ADDR_GRID0_ITEMS, 0x40u);
      snap_add(&s, ADDR_OUTSTR, 0x80u);
      snap_add(&s, ADDR_OUTDW, 0x10u);
      snap_capture(&s);
      uint32_t a[9] = {
        ADDR_UNIT, cases[i].cls, cases[i].mode, cases[i].ut, ADDR_INV,
        ADDR_OUTSTR, ADDR_OUTDW, cases[i].incPath, cases[i].chkW
      };
      call_stdcall9_void(va, a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8]);
      emit_line(fp, va, nm, cases[i].id, a, 9, 0u, 0u, &s);
    }
  }

  /* B1-02: 0x6FD767F0 ITEMS_CalcWeaponAttackSpeed (stdcall2 -> i32) */
  {
    const uint32_t va = 0x6FD767F0u;
    const char *nm = "ITEMS_CalcWeaponAttackSpeed113c";
    const struct {
      const char *id; uint32_t ut, ucls, itemCls, s44, s5d;
    } cases[] = {
      {"plr_axe_1hs_ias",   0u, 0u, 0u, 20u, 10u},
      {"plr_maul_2hs",      0u, 0u, 1u, 0u, 0u},
      {"plr_bow_miss_45",   0u, 0u, 3u, 0u, 0u},
      {"mon_axe_aia1hth",   1u, 0u, 0u, 25u, 0u},
    };
    for (int i = 0; i < 4; i++) {
      setup_base_tables();
      init_player_unit(ADDR_UNIT, ADDR_SLISTEX, ADDR_SLIST, ADDR_SLIST_STATS, ADDR_INV);
      w32(ADDR_UNIT + 0x00u, cases[i].ut);
      w32(ADDR_UNIT + 0x04u, cases[i].ucls);
      init_item_unit(ADDR_ITEM, ADDR_ITEMDATA, ADDR_SLISTEX_ITEM, ADDR_SLIST_ITEM, ADDR_SLIST_ITEM_STATS, ADDR_SLIST_FULL_ITEM, cases[i].itemCls, 100u, 20u, 4u, 200u);
      int idx = 0;
      if (cases[i].s44 != 0u) set_stat_pair(ADDR_SLISTEX_ITEM, ADDR_SLIST_FULL_ITEM, idx++, 0x44u, 0u, (int32_t)cases[i].s44);
      if (cases[i].s5d != 0u) set_stat_pair(ADDR_SLISTEX_ITEM, ADDR_SLIST_FULL_ITEM, idx++, 0x5Du, 0u, (int32_t)cases[i].s5d);
      stage_common(&s);
      stage_anim_tables(&s);
      stage_item_tree(&s);
      snap_add(&s, ADDR_UNIT, 0x100u);
      snap_add(&s, ADDR_INV, 0x100u);
      snap_capture(&s);
      uint32_t a[2] = { ADDR_UNIT, ADDR_ITEM };
      uint32_t r = call_stdcall2(va, a[0], a[1]);
      emit_line(fp, va, nm, cases[i].id, a, 2, 0xFFFFFFFFu, r, &s);
    }
  }

  /* B1-03: 0x6FDA0CE0 SKILLS_CalcUnitVelocityDivided (stdcall1 -> i32) */
  {
    const uint32_t va = 0x6FDA0CE0u;
    const char *nm = "SKILLS_CalcUnitVelocityDivided113c";

    /* v0: null pUnit -> 0 */
    setup_base_tables(); stage_common(&s); snap_capture(&s);
    uint32_t a0[1] = { 0u };
    emit_line(fp, va, nm, "null_unit", a0, 1, 0xFFFFFFFFu, call_stdcall1(va, a0[0]), &s);

    /* v1: dwFlags2 bit 8 unset -> 0 */
    setup_base_tables();
    init_player_unit(ADDR_UNIT, ADDR_SLISTEX, ADDR_SLIST, ADDR_SLIST_STATS, 0u);
    w32(ADDR_UNIT + 0x48u, 0x1300u);
    stage_common(&s); snap_add(&s, ADDR_UNIT, 0x100u); snap_capture(&s);
    uint32_t a1[1] = { ADDR_UNIT };
    emit_line(fp, va, nm, "no_flag8_ret_0", a1, 1, 0xFFFFFFFFu, call_stdcall1(va, a1[0]), &s);

    /* v2: flag 8 set, no active weapon -> vel/19 */
    setup_base_tables();
    init_player_unit(ADDR_UNIT, ADDR_SLISTEX, ADDR_SLIST, ADDR_SLIST_STATS, 0u);
    w32(ADDR_UNIT + 0xC8u, 0x08u);
    w32(ADDR_UNIT + 0x48u, 0x2655u); /* & ~0xff = 0x2600 */
    stage_common(&s); snap_add(&s, ADDR_UNIT, 0x100u); snap_capture(&s);
    emit_line(fp, va, nm, "flag8_unarmed_div19", a1, 1, 0xFFFFFFFFu, call_stdcall1(va, a1[0]), &s);

    /* v3: flag 8 set, active axe in grid0 slot 4 -> denom from B1-02 */
    setup_base_tables();
    init_player_unit(ADDR_UNIT, ADDR_SLISTEX, ADDR_SLIST, ADDR_SLIST_STATS, ADDR_INV);
    w32(ADDR_UNIT + 0xC8u, 0x08u);
    w32(ADDR_UNIT + 0x48u, 0x4000u);
    init_item_unit(ADDR_ITEM, ADDR_ITEMDATA, ADDR_SLISTEX_ITEM, ADDR_SLIST_ITEM, ADDR_SLIST_ITEM_STATS, ADDR_SLIST_FULL_ITEM, 0u, 100u, 10u, 4u, 200u);
    w32(ADDR_INV + 0x1Cu, 200u);
    w32(ADDR_INV + 0x14u, ADDR_GRID0);
    w32(ADDR_INV + 0x18u, 1u);
    w32(ADDR_GRID0 + 0x00u, ADDR_ITEM);
    w32(ADDR_GRID0 + 0x04u, ADDR_ITEM);
    w8(ADDR_GRID0 + 0x08u, 13u); w8(ADDR_GRID0 + 0x09u, 1u);
    w32(ADDR_GRID0 + 0x0Cu, ADDR_GRID0_ITEMS);
    w32(ADDR_GRID0_ITEMS + 4u * 4u, ADDR_ITEM);
    stage_common(&s); stage_anim_tables(&s); stage_item_tree(&s);
    snap_add(&s, ADDR_UNIT, 0x100u); snap_add(&s, ADDR_INV, 0x100u);
    snap_add(&s, ADDR_GRID0, 0x40u); snap_add(&s, ADDR_GRID0_ITEMS, 0x40u);
    snap_capture(&s);
    emit_line(fp, va, nm, "flag8_equipped_axe", a1, 1, 0xFFFFFFFFu, call_stdcall1(va, a1[0]), &s);
  }

  /* B1-04: 0x6FD98340 ITEMMODS_ApplyChargedSkillProperty (fastcall11: 0, pAlt, [9]) */
  {
    const uint32_t va = 0x6FD98340u;
    const char *nm = "ITEMMODS_ApplyChargedSkillProperty113c";
    const struct {
      const char *id; uint32_t prop; uint32_t skId, charges; int32_t maxParam; uint8_t ilvl; uint32_t bSet;
    } cases[] = {
      {"null_prop",          0u,            0u, 0u,  0, 20u, 0u},
      {"invalid_skill",      ADDR_ITEMPROP, 99u, 10u, 0, 20u, 0u},
      {"auto_lvl_ilvl30",    ADDR_ITEMPROP, 0u, 12u, 0, 30u, 1u},
      {"neg_max_param",      ADDR_ITEMPROP, 1u, 0u, -4, 50u, 1u},
      {"pos_max_param",      ADDR_ITEMPROP, 2u, 8u,  7, 40u, 1u},
    };
    for (int i = 0; i < 5; i++) {
      setup_base_tables();
      init_item_unit(ADDR_ITEM, ADDR_ITEMDATA, ADDR_SLISTEX_ITEM, ADDR_SLIST_ITEM, ADDR_SLIST_ITEM_STATS, ADDR_SLIST_FULL_ITEM, 0u, 100u, cases[i].ilvl, 4u, 200u);
      if (cases[i].prop != 0u) {
        w32(ADDR_ITEMPROP + 0x04u, cases[i].skId);
        w32(ADDR_ITEMPROP + 0x08u, cases[i].charges);
        w32(ADDR_ITEMPROP + 0x0Cu, (uint32_t)cases[i].maxParam);
      }
      stage_common(&s); stage_item_tree(&s); snap_capture(&s);
      uint32_t a[10] = { 0u, ADDR_ITEM, cases[i].prop, cases[i].bSet, 0xCCu, 0u, 0u, 0u, 0x40u, 0u };
      uint32_t r = call_fastcall11(va, 0u, a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9]);
      emit_line(fp, va, nm, cases[i].id, a, 10, 0xFFFFFFFFu, r, &s);
    }
  }

  /* B1-05: 0x6FD98630 ITEMMODS_ApplyMaxDamagePercentProperty */
  {
    const uint32_t va = 0x6FD98630u;
    const char *nm = "ITEMMODS_ApplyMaxDamagePercentProperty113c";
    const struct {
      const char *id; uint32_t cls; uint32_t pAlt; int32_t rolled;
    } cases[] = {
      {"axe_pos_15",       0u, 0u, 15},
      {"axe_neg_clamp",    0u, 0u, -25},
      {"maul_2h_only",     1u, 0u, 30},
      {"jav_throw_neg",    2u, 0u, -20},
      {"boots_nonweap",    4u, 0u, 9},
    };
    for (int i = 0; i < 5; i++) {
      setup_base_tables();
      init_item_unit(ADDR_ITEM, ADDR_ITEMDATA, ADDR_SLISTEX_ITEM, ADDR_SLIST_ITEM, ADDR_SLIST_ITEM_STATS, ADDR_SLIST_FULL_ITEM, cases[i].cls, 100u, 20u, 4u, 200u);
      w32(ADDR_ITEMPROP + 0x08u, 5u); w32(ADDR_ITEMPROP + 0x0Cu, 10u);
      stage_common(&s); stage_item_tree(&s); snap_capture(&s);
      uint32_t a[10] = { cases[i].pAlt, ADDR_ITEM, ADDR_ITEMPROP, 0u, 0x16u, 0u, (uint32_t)cases[i].rolled, 0u, 0x40u, 0u };
      uint32_t r = call_fastcall11(va, 0u, a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9]);
      emit_line(fp, va, nm, cases[i].id, a, 10, 0xFFFFFFFFu, r, &s);
    }
  }

  /* B1-06: 0x6FD987C0 ITEMMODS_ApplyMinDamagePercentProperty */
  {
    const uint32_t va = 0x6FD987C0u;
    const char *nm = "ITEMMODS_ApplyMinDamagePercentProperty113c";
    const struct {
      const char *id; uint32_t cls; int32_t rolled;
    } cases[] = {
      {"axe_pos_12",       0u, 12},
      {"axe_neg_clamp1",   0u, -20},
      {"maul_2h_only",     1u, 18},
      {"jav_throw_clamp",  2u, -10},
      {"rolled_zero_seed", 0u, 0},
    };
    for (int i = 0; i < 5; i++) {
      setup_base_tables();
      init_item_unit(ADDR_ITEM, ADDR_ITEMDATA, ADDR_SLISTEX_ITEM, ADDR_SLIST_ITEM, ADDR_SLIST_ITEM_STATS, ADDR_SLIST_FULL_ITEM, cases[i].cls, 100u, 20u, 4u, 200u);
      w32(ADDR_ITEMPROP + 0x08u, 3u); w32(ADDR_ITEMPROP + 0x0Cu, 9u);
      stage_common(&s); stage_item_tree(&s); snap_capture(&s);
      uint32_t a[10] = { 0u, ADDR_ITEM, ADDR_ITEMPROP, 0u, 0x15u, 0u, (uint32_t)cases[i].rolled, 0u, 0x40u, 0u };
      uint32_t r = call_fastcall11(va, 0u, a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9]);
      emit_line(fp, va, nm, cases[i].id, a, 10, 0xFFFFFFFFu, r, &s);
    }
  }

  /* B1-07: 0x6FD997E0 ITEMMODS_ApplyEnhancedDamageProperty (fastcall9: bForceRoll, pAlt, [7]) */
  {
    const uint32_t va = 0x6FD997E0u;
    const char *nm = "ITEMMODS_ApplyEnhancedDamageProperty113c";
    const struct {
      const char *id; uint16_t fmt; uint32_t cls, pAlt; int32_t mn, mx; uint32_t nVal, bNeg;
    } cases[] = {
      {"modern_normal_100pct", 100u, 0u, 0u, 50, 100, 77u, 0u},
      {"modern_small_flat1",   100u, 2u, 0u, 1, 2, 55u, 0u},
      {"modern_alt_item",      100u, 0u, ADDR_ITEM2, 10, 20, 33u, 0u},
      {"legacy_fmt0_add",        0u, 0u, 0u, 20, 40, 44u, 0u},
      {"legacy_fmt0_negate",     0u, 2u, 0u, 20, 40, 66u, 1u},
    };
    for (int i = 0; i < 5; i++) {
      setup_base_tables();
      init_item_unit(ADDR_ITEM, ADDR_ITEMDATA, ADDR_SLISTEX_ITEM, ADDR_SLIST_ITEM, ADDR_SLIST_ITEM_STATS, ADDR_SLIST_FULL_ITEM, cases[i].cls, cases[i].fmt, 20u, 4u, 200u);
      set_stat_pair(ADDR_SLIST_ITEM, ADDR_SLIST_ITEM_STATS, 0, 0x11u, 0u, 15);
      set_stat_pair(ADDR_SLIST_ITEM, ADDR_SLIST_ITEM_STATS, 1, 0x12u, 0u, 18);
      if (cases[i].pAlt != 0u) {
        init_item_unit(ADDR_ITEM2, ADDR_ITEMDATA2, ADDR_SLISTEX_ALT, ADDR_SLIST_ALT, ADDR_SLIST_ALT_STATS, ADDR_SLIST_FULL_OTHER, 5u, 100u, 20u, 0u, 201u);
      }
      w32(ADDR_ITEMPROP + 0x08u, (uint32_t)cases[i].mn);
      w32(ADDR_ITEMPROP + 0x0Cu, (uint32_t)cases[i].mx);
      stage_common(&s); stage_item_tree(&s);
      snap_add(&s, ADDR_ITEM2, 0x100u); snap_add(&s, ADDR_ITEMDATA2, 0x100u);
      snap_add(&s, ADDR_SLISTEX_ALT, 0x100u); snap_add(&s, ADDR_SLIST_ALT, 0x100u);
      snap_add(&s, ADDR_SLIST_ALT_STATS, 0x200u); snap_add(&s, ADDR_SLIST_FULL_OTHER, 0x100u);
      snap_capture(&s);
      uint32_t a[9] = { 0u, cases[i].pAlt, ADDR_ITEM, ADDR_ITEMPROP, cases[i].nVal, cases[i].bNeg, 0u, 0x40u, 0u };
      uint32_t r = call_fastcall9(va, a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8]);
      emit_line(fp, va, nm, cases[i].id, a, 9, 0xFFFFFFFFu, r, &s);
    }
  }
}

static void setup_unit_with_skill(uint32_t lvl1, uint32_t guid, uint32_t lvl2) {
  init_player_unit(ADDR_UNIT, ADDR_SLISTEX, ADDR_SLIST, ADDR_SLIST_STATS, 0u);
  set_stat_pair(ADDR_SLISTEX, ADDR_SLIST_STATS, 0, 0x0Cu, 0u, 27); /* level 27 */
  w32(ADDR_SKILLS_HDR + 0x04u, ADDR_SKILL1);
  w32(ADDR_SKILL1 + 0x00u, ADDR_SKILLS_TXT + 1u * 0x23Cu); /* skillId=1 */
  w32(ADDR_SKILL1 + 0x04u, ADDR_SKILL2);
  w32(ADDR_SKILL1 + 0x28u, lvl1);
  w32(ADDR_SKILL1 + 0x34u, guid);
  w32(ADDR_SKILL2 + 0x00u, ADDR_SKILLS_TXT + 0u * 0x23Cu); /* skillId=0 */
  w32(ADDR_SKILL2 + 0x04u, 0u);
  w32(ADDR_SKILL2 + 0x28u, lvl2);
  w32(ADDR_SKILL2 + 0x34u, 0xFFFFFFFFu);
}

static void stage_skill_unit(Snap *s) {
  snap_add(s, ADDR_UNIT, 0x100u);
  snap_add(s, ADDR_SLISTEX, 0x100u);
  snap_add(s, ADDR_SLIST, 0x100u);
  snap_add(s, ADDR_SLIST_STATS, 0x200u);
  snap_add(s, ADDR_STATEFLAGS, 0x40u);
  snap_add(s, ADDR_SKILLS_HDR, 0x40u);
  snap_add(s, ADDR_SKILL1, 0x80u);
  snap_add(s, ADDR_SKILL2, 0x80u);
  snap_add(s, ADDR_CTX, 0x40u);
}

static void emit_b1_08_to_16(FILE *fp) {
  Snap s = {0};

  /* B1-08: 0x6FD9E7A0 SKILLS_EvalSkillSynergyOrMasteryCalc (stdcall4 -> i32) */
  {
    const uint32_t va = 0x6FD9E7A0u;
    const char *nm = "SKILLS_EvalSkillSynergyOrMasteryCalc113c";
    const struct { const char *id; uint32_t sk, lvl, grp; } cases[] = {
      {"grp0_imm25",   0u, 5u, 0u},
      {"grp1_lvlx2",   0u, 7u, 1u},
      {"grp2_imm40",   0u, 5u, 2u},
      {"grp3_invalid", 0u, 5u, 3u},
      {"lvl0_ret0",    0u, 0u, 0u},
    };
    for (int i = 0; i < 5; i++) {
      setup_base_tables(); stage_common(&s); snap_capture(&s);
      uint32_t a[4] = { 0u, cases[i].sk, cases[i].lvl, cases[i].grp };
      emit_line(fp, va, nm, cases[i].id, a, 4, 0xFFFFFFFFu, call_stdcall4(va, a[0], a[1], a[2], a[3]), &s);
    }
  }

  /* B1-09: 0x6FD9E900 SKILLS_GetSkillPeriodicDelayOrLength (stdcall4 -> i32) */
  {
    const uint32_t va = 0x6FD9E900u;
    const char *nm = "SKILLS_GetSkillPeriodicDelayOrLength113c";
    const struct { const char *id; uint32_t sk, lvl; } cases[] = {
      {"sk0_band1_lvl4",  0u, 4u},
      {"sk0_band2_lvl12", 0u, 12u},
      {"sk0_band3_lvl20", 0u, 20u},
      {"sk1_nocalc_lvl6", 1u, 6u},
      {"lvl0_ret0",       0u, 0u},
    };
    for (int i = 0; i < 5; i++) {
      setup_base_tables(); stage_common(&s); snap_capture(&s);
      uint32_t a[4] = { 0u, cases[i].sk, cases[i].lvl, 0u };
      emit_line(fp, va, nm, cases[i].id, a, 4, 0xFFFFFFFFu, call_stdcall4(va, a[0], a[1], a[2], a[3]), &s);
    }
  }

  /* B1-10: 0x6FD9EA50 SKILLS_GetSkillToHitBonus (stdcall3 -> i32) */
  {
    const uint32_t va = 0x6FD9EA50u;
    const char *nm = "SKILLS_GetSkillToHitBonus113c";
    const struct { const char *id; uint32_t sk, lvl; } cases[] = {
      {"sk0_linear_lvl5", 0u, 5u},
      {"sk1_rpn_lvl8",    1u, 8u},
      {"invalid_lvl0",    0u, 0u},
    };
    for (int i = 0; i < 3; i++) {
      setup_base_tables(); stage_common(&s); snap_capture(&s);
      uint32_t a[3] = { 0u, cases[i].sk, cases[i].lvl };
      emit_line(fp, va, nm, cases[i].id, a, 3, 0xFFFFFFFFu, call_stdcall3(va, a[0], a[1], a[2]), &s);
    }
  }

  /* B1-11: 0x6FDA0360 SKILLS_GetSkillElemMaxDamage (stdcall4 -> i32) */
  {
    const uint32_t va = 0x6FDA0360u;
    const char *nm = "SKILLS_GetSkillElemMaxDamage113c";
    const struct { const char *id; uint32_t u, sk, lvl, mast; } cases[] = {
      {"sk0_calc25_lvl6",     0u,        0u, 6u, 0u},
      {"sk1_nocalc_lvl4",     0u,        1u, 4u, 0u},
      {"sk0_with_owner_mast", ADDR_UNIT, 0u, 6u, 1u},
      {"lvl0_ret0",           0u,        0u, 0u, 0u},
    };
    for (int i = 0; i < 4; i++) {
      setup_base_tables(); setup_unit_with_skill(5u, 0xFFFFFFFFu, 3u);
      stage_common(&s); stage_skill_unit(&s); snap_capture(&s);
      uint32_t a[4] = { cases[i].u, cases[i].sk, cases[i].lvl, cases[i].mast };
      emit_line(fp, va, nm, cases[i].id, a, 4, 0xFFFFFFFFu, call_stdcall4(va, a[0], a[1], a[2], a[3]), &s);
    }
  }

  /* B1-12: 0x6FDA0460 SKILLS_GetSkillElemMinDamage (stdcall4 -> i32) */
  {
    const uint32_t va = 0x6FDA0460u;
    const char *nm = "SKILLS_GetSkillElemMinDamage113c";
    const struct { const char *id; uint32_t u, sk, lvl, mast; } cases[] = {
      {"sk0_calc25_lvl6",     0u,        0u, 6u, 0u},
      {"sk1_nocalc_lvl4",     0u,        1u, 4u, 0u},
      {"sk0_with_owner_mast", ADDR_UNIT, 0u, 6u, 1u},
      {"lvl0_ret0",           0u,        0u, 0u, 0u},
    };
    for (int i = 0; i < 4; i++) {
      setup_base_tables(); setup_unit_with_skill(5u, 0xFFFFFFFFu, 3u);
      stage_common(&s); stage_skill_unit(&s); snap_capture(&s);
      uint32_t a[4] = { cases[i].u, cases[i].sk, cases[i].lvl, cases[i].mast };
      emit_line(fp, va, nm, cases[i].id, a, 4, 0xFFFFFFFFu, call_stdcall4(va, a[0], a[1], a[2], a[3]), &s);
    }
  }

  /* B1-13: 0x6FDA1070 SKILLS_GetSkillCalcFieldById (stdcall4: pUnit, nField, nSkillId, nLevel) */
  {
    const uint32_t va = 0x6FDA1070u;
    const char *nm = "SKILLS_GetSkillCalcFieldById113c";
    const uint32_t fields[] = {
      0u, 1u, 7u, 8u, 14u, 16u, 17u, 18u, 19u, 20u, 21u, 22u, 23u,
      26u, 27u, 28u, 35u, 38u, 40u, 41u, 42u, 43u, 44u, 49u, 52u,
      54u, 55u, 56u, 57u, 58u, 72u, 73u
    };
    int n_f = (int)(sizeof(fields) / sizeof(fields[0]));
    for (int i = 0; i < n_f; i++) {
      char cid[32];
      sprintf(cid, "field_%u", fields[i]);
      setup_base_tables(); setup_unit_with_skill(11u, 0xFFFFFFFFu, 6u);
      stage_common(&s); stage_skill_unit(&s); snap_capture(&s);
      uint32_t a[4] = { ADDR_UNIT, fields[i], 0u, 8u };
      emit_line(fp, va, nm, cid, a, 4, 0xFFFFFFFFu, call_stdcall4(va, a[0], a[1], a[2], a[3]), &s);
    }
    /* High-byte mask (0x110 -> 16) and entry skill-id bounds (-1 / OOB -> 0) */
    {
      const struct { const char *id; uint32_t fld, sk, lvl; } extra[] = {
        {"field_0x110_mask", 0x110u, 0u,          8u},
        {"neg_skill_f16",    16u,    0xFFFFFFFFu, 8u},
        {"neg_skill_f40",    40u,    0xFFFFFFFFu, 8u},
        {"neg_skill_f41",    41u,    0xFFFFFFFFu, 8u},
        {"oob_skill_f16",    16u,    999u,        8u},
      };
      for (int i = 0; i < 5; i++) {
        setup_base_tables(); setup_unit_with_skill(11u, 0xFFFFFFFFu, 6u);
        stage_common(&s); stage_skill_unit(&s); snap_capture(&s);
        uint32_t a[4] = { ADDR_UNIT, extra[i].fld, extra[i].sk, extra[i].lvl };
        emit_line(fp, va, nm, extra[i].id, a, 4, 0xFFFFFFFFu, call_stdcall4(va, a[0], a[1], a[2], a[3]), &s);
      }
    }
  }

  /* B1-14: 0x6FDA1AB0 SKILLS_EvalCalcSkillFieldPair (fastcall4: f2, f1, skId, pCtx) */
  {
    const uint32_t va = 0x6FDA1AB0u;
    const char *nm = "SKILLS_EvalCalcSkillFieldPair113c";
    setup_base_tables(); stage_common(&s); snap_capture(&s);
    uint32_t a0[4] = { 0u, 16u, 0u, 0u };
    emit_line(fp, va, nm, "null_ctx", a0, 4, 0xFFFFFFFFu, call_fastcall4(va, a0[0], a0[1], a0[2], a0[3]), &s);

    setup_base_tables(); setup_unit_with_skill(9u, 0xFFFFFFFFu, 4u);
    w32(ADDR_CTX + 0x00u, ADDR_UNIT); w32(ADDR_CTX + 0x04u, 0u); w32(ADDR_CTX + 0x08u, 5u);
    stage_common(&s); stage_skill_unit(&s); snap_capture(&s);
    uint32_t a1[4] = { 0u, 16u, 0u, ADDR_CTX }; /* field1=16->lvl=5, field2=0->lin12(0,5) */
    emit_line(fp, va, nm, "ctx_f1_16_f2_0", a1, 4, 0xFFFFFFFFu, call_fastcall4(va, a1[0], a1[1], a1[2], a1[3]), &s);

    uint32_t a2[4] = { 20u, 8u, 1u, ADDR_CTX }; /* field1=8->P1=11, field2=20->tohit(1,11) */
    emit_line(fp, va, nm, "ctx_f1_8_f2_20", a2, 4, 0xFFFFFFFFu, call_fastcall4(va, a2[0], a2[1], a2[2], a2[3]), &s);
  }

  /* B1-15: 0x6FDA1AF0 SKILLS_EvalCalcUnitSkillFieldByCtx (fastcall4: skId, fId, _u, pCtx) */
  {
    const uint32_t va = 0x6FDA1AF0u;
    const char *nm = "SKILLS_EvalCalcUnitSkillFieldByCtx113c";
    setup_base_tables(); stage_common(&s); snap_capture(&s);
    uint32_t a0[4] = { 1u, 16u, 0u, 0u };
    emit_line(fp, va, nm, "null_ctx", a0, 4, 0xFFFFFFFFu, call_fastcall4(va, a0[0], a0[1], a0[2], a0[3]), &s);

    setup_base_tables(); setup_unit_with_skill(14u, 0xFFFFFFFFu, 7u);
    w32(ADDR_CTX + 0x00u, ADDR_UNIT); w32(ADDR_CTX + 0x04u, 0u); w32(ADDR_CTX + 0x08u, 3u);
    stage_common(&s); stage_skill_unit(&s); snap_capture(&s);
    uint32_t a1[4] = { 1u, 16u, 0u, ADDR_CTX }; /* skill 1 effective lvl = 14 */
    emit_line(fp, va, nm, "unit_sk1_lvl14", a1, 4, 0xFFFFFFFFu, call_fastcall4(va, a1[0], a1[1], a1[2], a1[3]), &s);

    uint32_t a2[4] = { 0u, 19u, 0u, ADDR_CTX }; /* skill 0 effective lvl = 7 -> delay */
    emit_line(fp, va, nm, "unit_sk0_delay", a2, 4, 0xFFFFFFFFu, call_fastcall4(va, a2[0], a2[1], a2[2], a2[3]), &s);

    setup_base_tables(); setup_unit_with_skill(150u, 1234u, 3u); /* >99 clamped, owner!= -1 skips bonus */
    w32(ADDR_CTX + 0x00u, ADDR_UNIT);
    stage_common(&s); stage_skill_unit(&s); snap_capture(&s);
    emit_line(fp, va, nm, "clamped_maxlvl_99", a1, 4, 0xFFFFFFFFu, call_fastcall4(va, a1[0], a1[1], a1[2], a1[3]), &s);
  }

  /* B1-16: 0x6FDA1B60 SKILLS_SkillCalcVarCallback (fastcall2: nVarId, pCtx) */
  {
    const uint32_t va = 0x6FDA1B60u;
    const char *nm = "SKILLS_SkillCalcVarCallback113c";
    setup_base_tables(); stage_common(&s); snap_capture(&s);
    uint32_t a0[2] = { 16u, 0u };
    emit_line(fp, va, nm, "null_ctx", a0, 2, 0xFFFFFFFFu, call_fastcall2(va, a0[0], a0[1]), &s);

    setup_base_tables(); setup_unit_with_skill(6u, 0xFFFFFFFFu, 4u);
    w32(ADDR_CTX + 0x00u, ADDR_UNIT); w32(ADDR_CTX + 0x04u, 0u); w32(ADDR_CTX + 0x08u, 10u);
    stage_common(&s); stage_skill_unit(&s); snap_capture(&s);
    uint32_t a1[2] = { 16u, ADDR_CTX };
    emit_line(fp, va, nm, "var16_lvl10", a1, 2, 0xFFFFFFFFu, call_fastcall2(va, a1[0], a1[1]), &s);
    uint32_t a2[2] = { 40u, ADDR_CTX };
    emit_line(fp, va, nm, "var40_charlvl27", a2, 2, 0xFFFFFFFFu, call_fastcall2(va, a2[0], a2[1]), &s);
  }
}

static void emit_i12b_1(FILE *fp) {
  emit_b1_01_to_07(fp);
  emit_b1_08_to_16(fp);
}

static void setup_grid0_item(uint32_t slot, uint32_t itemPtr) {
  w32(ADDR_INV + 0x00u, 0x01020304u);
  w32(ADDR_INV + 0x04u, 0u);
  w32(ADDR_INV + 0x14u, ADDR_GRID0);
  w32(ADDR_INV + 0x18u, 1u);
  w32(ADDR_GRID0 + 0x00u, itemPtr);
  w32(ADDR_GRID0 + 0x04u, itemPtr);
  w8(ADDR_GRID0 + 0x08u, 13u);
  w8(ADDR_GRID0 + 0x09u, 1u);
  w32(ADDR_GRID0 + 0x0Cu, ADDR_GRID0_ITEMS);
  w32(ADDR_GRID0_ITEMS + slot * 4u, itemPtr);
}

static void emit_b2_01_to_07(FILE *fp) {
  Snap s = {0};

  /* B2-01: 0x6FD98E70 ITEMMODS_ApplyDmgMaxProperty (fastcall9 -> 1) */
  {
    const uint32_t va = 0x6FD98E70u;
    const char *nm = "ITEMMODS_ApplyDmgMaxProperty113c";
    const struct { const char *id; uint32_t cls, altCls, pAlt; int32_t mn, mx; } cases[] = {
      {"axe_add_5_10",  0u, 0u, ADDR_ITEM2, 5, 10},
      {"jav_throw_20",  2u, 2u, ADDR_ITEM2, 20, 20},
      {"maul_2h_only",  1u, 1u, ADDR_ITEM2, 12, 16},
      {"axe_null_alt",  0u, 0u, 0u,         5, 10},
      {"maul_null_alt", 1u, 1u, 0u,         12, 16},
    };
    for (int i = 0; i < 5; i++) {
      setup_base_tables();
      init_item_unit(ADDR_ITEM, ADDR_ITEMDATA, ADDR_SLISTEX_ITEM, ADDR_SLIST_ITEM, ADDR_SLIST_ITEM_STATS, ADDR_SLIST_FULL_ITEM, cases[i].cls, 100u, 20u, 4u, 200u);
      init_item_unit(ADDR_ITEM2, ADDR_ITEMDATA2, ADDR_SLISTEX_ALT, ADDR_SLIST_ALT, ADDR_SLIST_ALT_STATS, ADDR_SLIST_FULL_OTHER, cases[i].altCls, 100u, 20u, 0u, 201u);
      w32(ADDR_ITEMPROP + 0x08u, (uint32_t)cases[i].mn);
      w32(ADDR_ITEMPROP + 0x0Cu, (uint32_t)cases[i].mx);
      stage_common(&s); stage_item_tree(&s);
      snap_add(&s, ADDR_ITEM2, 0x100u); snap_add(&s, ADDR_ITEMDATA2, 0x100u);
      snap_add(&s, ADDR_SLISTEX_ALT, 0x100u); snap_add(&s, ADDR_SLIST_ALT, 0x100u);
      snap_add(&s, ADDR_SLIST_ALT_STATS, 0x200u); snap_add(&s, ADDR_SLIST_FULL_OTHER, 0x100u);
      snap_capture(&s);
      uint32_t a[9] = { 0u, cases[i].pAlt, ADDR_ITEM, ADDR_ITEMPROP, 0u, 0u, 0u, 0x40u, 0u };
      uint32_t r = call_fastcall9(va, a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8]);
      emit_line(fp, va, nm, cases[i].id, a, 9, 0xFFFFFFFFu, r, &s);
    }
  }

  /* B2-02: 0x6FD98FC0 ITEMMODS_ApplyDmgMinProperty (fastcall9 -> 1) */
  {
    const uint32_t va = 0x6FD98FC0u;
    const char *nm = "ITEMMODS_ApplyDmgMinProperty113c";
    const struct { const char *id; uint32_t cls, altCls, pAlt; int32_t mn, mx; } cases[] = {
      {"axe_add_3_8",   0u, 0u, ADDR_ITEM2, 3, 8},
      {"jav_throw_15",  2u, 2u, ADDR_ITEM2, 15, 15},
      {"maul_2h_only",  1u, 1u, ADDR_ITEM2, 10, 14},
      {"axe_null_alt",  0u, 0u, 0u,         3, 8},
      {"maul_null_alt", 1u, 1u, 0u,         10, 14},
    };
    for (int i = 0; i < 5; i++) {
      setup_base_tables();
      init_item_unit(ADDR_ITEM, ADDR_ITEMDATA, ADDR_SLISTEX_ITEM, ADDR_SLIST_ITEM, ADDR_SLIST_ITEM_STATS, ADDR_SLIST_FULL_ITEM, cases[i].cls, 100u, 20u, 4u, 200u);
      init_item_unit(ADDR_ITEM2, ADDR_ITEMDATA2, ADDR_SLISTEX_ALT, ADDR_SLIST_ALT, ADDR_SLIST_ALT_STATS, ADDR_SLIST_FULL_OTHER, cases[i].altCls, 100u, 20u, 0u, 201u);
      w32(ADDR_ITEMPROP + 0x08u, (uint32_t)cases[i].mn);
      w32(ADDR_ITEMPROP + 0x0Cu, (uint32_t)cases[i].mx);
      stage_common(&s); stage_item_tree(&s);
      snap_add(&s, ADDR_ITEM2, 0x100u); snap_add(&s, ADDR_ITEMDATA2, 0x100u);
      snap_add(&s, ADDR_SLISTEX_ALT, 0x100u); snap_add(&s, ADDR_SLIST_ALT, 0x100u);
      snap_add(&s, ADDR_SLIST_ALT_STATS, 0x200u); snap_add(&s, ADDR_SLIST_FULL_OTHER, 0x100u);
      snap_capture(&s);
      uint32_t a[9] = { 0u, cases[i].pAlt, ADDR_ITEM, ADDR_ITEMPROP, 0u, 0u, 0u, 0x40u, 0u };
      uint32_t r = call_fastcall9(va, a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8]);
      emit_line(fp, va, nm, cases[i].id, a, 9, 0xFFFFFFFFu, r, &s);
    }
  }

  /* B2-03: 0x6FD991C0 ITEMMODS_ApplyStatRolledProperty */
  {
    const uint32_t va = 0x6FD991C0u;
    const char *nm = "ITEMMODS_ApplyStatRolledProperty113c";
    const struct { const char *id; uint32_t prop, statId; int32_t mn, mx, val; } cases[] = {
      {"null_prop",      0u,            0x16u, 5, 10, 0},
      {"stat16_deleg",   ADDR_ITEMPROP, 0x16u, 5, 10, 14},
      {"stat19_direct",  ADDR_ITEMPROP, 0x19u, 5, 10, 22},
      {"rolled0_seed",   ADDR_ITEMPROP, 0x19u, 8, 16, 0},
    };
    for (int i = 0; i < 4; i++) {
      setup_base_tables();
      init_item_unit(ADDR_ITEM, ADDR_ITEMDATA, ADDR_SLISTEX_ITEM, ADDR_SLIST_ITEM, ADDR_SLIST_ITEM_STATS, ADDR_SLIST_FULL_ITEM, 0u, 100u, 20u, 4u, 200u);
      w32(ADDR_ITEMPROP + 0x08u, (uint32_t)cases[i].mn);
      w32(ADDR_ITEMPROP + 0x0Cu, (uint32_t)cases[i].mx);
      stage_common(&s); stage_item_tree(&s); snap_capture(&s);
      uint32_t a[10] = { 0u, ADDR_ITEM, cases[i].prop, 0u, cases[i].statId, 0u, (uint32_t)cases[i].val, 0u, 0x40u, 0u };
      uint32_t r = call_fastcall11(va, 0u, a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9]);
      emit_line(fp, va, nm, cases[i].id, a, 10, 0xFFFFFFFFu, r, &s);
    }
  }

  /* B2-04: 0x6FD99260 ITEMMODS_ApplyStatMaxProperty */
  {
    const uint32_t va = 0x6FD99260u;
    const char *nm = "ITEMMODS_ApplyStatMaxProperty113c";
    const struct { const char *id; uint32_t prop, statId; int32_t mx; } cases[] = {
      {"null_prop",      0u,            0x16u, 0},
      {"stat16_max25",   ADDR_ITEMPROP, 0x16u, 25},
      {"stat19_max33",   ADDR_ITEMPROP, 0x19u, 33},
    };
    for (int i = 0; i < 3; i++) {
      setup_base_tables();
      init_item_unit(ADDR_ITEM, ADDR_ITEMDATA, ADDR_SLISTEX_ITEM, ADDR_SLIST_ITEM, ADDR_SLIST_ITEM_STATS, ADDR_SLIST_FULL_ITEM, 0u, 100u, 20u, 4u, 200u);
      w32(ADDR_ITEMPROP + 0x08u, 5u); w32(ADDR_ITEMPROP + 0x0Cu, (uint32_t)cases[i].mx);
      stage_common(&s); stage_item_tree(&s); snap_capture(&s);
      uint32_t a[10] = { 0u, ADDR_ITEM, cases[i].prop, 0u, cases[i].statId, 0u, 0u, 0u, 0x40u, 0u };
      uint32_t r = call_fastcall11(va, 0u, a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9]);
      emit_line(fp, va, nm, cases[i].id, a, 10, 0xFFFFFFFFu, r, &s);
    }
  }

  /* B2-05: 0x6FD992D0 ITEMMODS_ApplyStatMinProperty */
  {
    const uint32_t va = 0x6FD992D0u;
    const char *nm = "ITEMMODS_ApplyStatMinProperty113c";
    const struct { const char *id; uint32_t prop, statId; int32_t mn; } cases[] = {
      {"null_prop",      0u,            0x15u, 0},
      {"stat15_min11",   ADDR_ITEMPROP, 0x15u, 11},
      {"stat19_min19",   ADDR_ITEMPROP, 0x19u, 19},
    };
    for (int i = 0; i < 3; i++) {
      setup_base_tables();
      init_item_unit(ADDR_ITEM, ADDR_ITEMDATA, ADDR_SLISTEX_ITEM, ADDR_SLIST_ITEM, ADDR_SLIST_ITEM_STATS, ADDR_SLIST_FULL_ITEM, 0u, 100u, 20u, 4u, 200u);
      w32(ADDR_ITEMPROP + 0x08u, (uint32_t)cases[i].mn); w32(ADDR_ITEMPROP + 0x0Cu, 40u);
      stage_common(&s); stage_item_tree(&s); snap_capture(&s);
      uint32_t a[10] = { 0u, ADDR_ITEM, cases[i].prop, 0u, cases[i].statId, 0u, 0u, 0u, 0x40u, 0u };
      uint32_t r = call_fastcall11(va, 0u, a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9]);
      emit_line(fp, va, nm, cases[i].id, a, 10, 0xFFFFFFFFu, r, &s);
    }
  }

  /* B2-06: 0x6FD99340 ITEMMODS_ApplyEnhancedDamagePercentProperty */
  {
    const uint32_t va = 0x6FD99340u;
    const char *nm = "ITEMMODS_ApplyEnhancedDamagePercentProperty113c";
    const struct { const char *id; uint32_t prop, pItem, cls; int32_t mn, mx, val; } cases[] = {
      {"null_prop",      0u,            ADDR_ITEM, 0u, 10, 20, 10},
      {"non_item_unit",  ADDR_ITEMPROP, ADDR_UNIT, 0u, 10, 20, 25},
      {"small_pct_flat", ADDR_ITEMPROP, ADDR_ITEM, 2u,  1,  2,  1},
      {"axe_large_ed",   ADDR_ITEMPROP, ADDR_ITEM, 0u, 50, 80, 75},
      {"rolled0_seed",   ADDR_ITEMPROP, ADDR_ITEM, 0u, 40, 60, 0},
    };
    for (int i = 0; i < 5; i++) {
      setup_base_tables();
      init_player_unit(ADDR_UNIT, ADDR_SLISTEX, ADDR_SLIST, ADDR_SLIST_STATS, 0u);
      init_item_unit(ADDR_ITEM, ADDR_ITEMDATA, ADDR_SLISTEX_ITEM, ADDR_SLIST_ITEM, ADDR_SLIST_ITEM_STATS, ADDR_SLIST_FULL_ITEM, cases[i].cls, 100u, 20u, 4u, 200u);
      w32(ADDR_ITEMPROP + 0x08u, (uint32_t)cases[i].mn);
      w32(ADDR_ITEMPROP + 0x0Cu, (uint32_t)cases[i].mx);
      stage_common(&s); stage_item_tree(&s); snap_add(&s, ADDR_UNIT, 0x100u); snap_add(&s, ADDR_SLISTEX, 0x100u); snap_add(&s, ADDR_SLIST, 0x100u); snap_add(&s, ADDR_SLIST_STATS, 0x200u); snap_capture(&s);
      uint32_t a[10] = { 0u, cases[i].pItem, cases[i].prop, 0u, 0x11u, 0u, (uint32_t)cases[i].val, 0u, 0x40u, 0u };
      uint32_t r = call_fastcall11(va, 0u, a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9]);
      emit_line(fp, va, nm, cases[i].id, a, 10, 0xFFFFFFFFu, r, &s);
    }
  }

  /* B2-07: 0x6FDA1000 SKILLS_GetSkillNumTargetsOrShots (stdcall2 -> i32) */
  {
    const uint32_t va = 0x6FDA1000u;
    const char *nm = "SKILLS_GetSkillNumTargetsOrShots113c";

    /* v0: null skill -> 0 */
    setup_base_tables(); stage_common(&s); snap_capture(&s);
    uint32_t a0[2] = { ADDR_UNIT, 0u };
    emit_line(fp, va, nm, "null_skill", a0, 2, 0xFFFFFFFFu, call_stdcall2(va, a0[0], a0[1]), &s);

    /* v1: elemType = 2 -> 2 */
    setup_base_tables();
    w32(ADDR_SKILL1 + 0x00u, ADDR_SKILLS_TXT + 0u * 0x23Cu);
    stage_common(&s); snap_add(&s, ADDR_SKILL1, 0x80u); snap_capture(&s);
    uint32_t a1[2] = { ADDR_UNIT, ADDR_SKILL1 };
    emit_line(fp, va, nm, "elem2_ret_2", a1, 2, 0xFFFFFFFFu, call_stdcall2(va, a1[0], a1[1]), &s);

    /* v2: elemType = 3, unarmed -> 1 */
    setup_base_tables();
    init_player_unit(ADDR_UNIT, ADDR_SLISTEX, ADDR_SLIST, ADDR_SLIST_STATS, ADDR_INV);
    w32(ADDR_SKILL1 + 0x00u, ADDR_SKILLS_TXT + 1u * 0x23Cu);
    stage_common(&s); snap_add(&s, ADDR_UNIT, 0x100u); snap_add(&s, ADDR_INV, 0x100u); snap_add(&s, ADDR_SKILL1, 0x80u); snap_capture(&s);
    emit_line(fp, va, nm, "elem3_unarmed_1", a1, 2, 0xFFFFFFFFu, call_stdcall2(va, a1[0], a1[1]), &s);

    /* v3: elemType = 3, bow equipped -> 2 */
    setup_base_tables();
    init_player_unit(ADDR_UNIT, ADDR_SLISTEX, ADDR_SLIST, ADDR_SLIST_STATS, ADDR_INV);
    w32(ADDR_UNIT + 0x10u, 1u); /* PLRMODE_NU (non-0/non-0x11 so COMPOSIT reads weapon) */
    init_item_unit(ADDR_ITEM, ADDR_ITEMDATA, ADDR_SLISTEX_ITEM, ADDR_SLIST_ITEM, ADDR_SLIST_ITEM_STATS, ADDR_SLIST_FULL_ITEM, 3u, 100u, 20u, 4u, 200u);
    setup_grid0_item(4u, ADDR_ITEM);
    w32(ADDR_INV + 0x1Cu, 200u);
    w32(ADDR_SKILL1 + 0x00u, ADDR_SKILLS_TXT + 1u * 0x23Cu);
    stage_common(&s); stage_item_tree(&s);
    snap_add(&s, ADDR_UNIT, 0x100u); snap_add(&s, ADDR_INV, 0x100u); snap_add(&s, ADDR_GRID0, 0x40u); snap_add(&s, ADDR_GRID0_ITEMS, 0x40u); snap_add(&s, ADDR_SKILL1, 0x80u);
    snap_add(&s, ADDR_SLISTEX, 0x100u); snap_add(&s, ADDR_STATEFLAGS, 0x40u);
    snap_capture(&s);
    emit_line(fp, va, nm, "elem3_bow_2", a1, 2, 0xFFFFFFFFu, call_stdcall2(va, a1[0], a1[1]), &s);

    /* v4: elemType = 3, bow equipped, active state mask -> clamped to 1 */
    w32(ADDR_STATE_MASK_TBL + 0u, 1u);
    w32(ADDR_STATEFLAGS + 0u, 1u);
    snap_add(&s, ADDR_STATEFLAGS, 0x40u);
    snap_capture(&s);
    emit_line(fp, va, nm, "elem3_bow_statemask_1", a1, 2, 0xFFFFFFFFu, call_stdcall2(va, a1[0], a1[1]), &s);
  }
}

static void emit_b2_08_to_14(FILE *fp) {
  Snap s = {0};

  /* B2-08: 0x6FDA1C60 SKILLS_CalcKickBootDamage (stdcall4 void, retMask=0) */
  {
    const uint32_t va = 0x6FDA1C60u;
    const char *nm = "SKILLS_CalcKickBootDamage113c";

    /* v0: null pUnit -> noop */
    setup_base_tables(); w32(ADDR_OUTDW + 0x00u, 10u); w32(ADDR_OUTDW + 0x04u, 20u); w32(ADDR_OUTDW + 0x08u, 30u);
    stage_common(&s); snap_add(&s, ADDR_OUTDW, 0x20u); snap_capture(&s);
    uint32_t a0[4] = { 0u, ADDR_OUTDW, ADDR_OUTDW + 4u, ADDR_OUTDW + 8u };
    call_stdcall4(va, a0[0], a0[1], a0[2], a0[3]);
    emit_line(fp, va, nm, "null_unit", a0, 4, 0u, 0u, &s);

    /* v1: unit with kickPct=15, no inventory */
    setup_base_tables();
    init_player_unit(ADDR_UNIT, ADDR_SLISTEX, ADDR_SLIST, ADDR_SLIST_STATS, 0u);
    set_stat_pair(ADDR_SLISTEX, ADDR_SLIST_STATS, 0, 0x89u, 0u, 15);
    w32(ADDR_OUTDW + 0x00u, 10u); w32(ADDR_OUTDW + 0x04u, 20u); w32(ADDR_OUTDW + 0x08u, 5u);
    stage_common(&s); stage_skill_unit(&s); snap_add(&s, ADDR_OUTDW, 0x20u); snap_capture(&s);
    uint32_t a1[4] = { ADDR_UNIT, ADDR_OUTDW, ADDR_OUTDW + 4u, ADDR_OUTDW + 8u };
    call_stdcall4(va, a1[0], a1[1], a1[2], a1[3]);
    emit_line(fp, va, nm, "no_inv_kickpct", a1, 4, 0u, 0u, &s);

    /* v2: unit with boots in grid0 slot 9, Str=100, Dex=50, offED=25, skillED=40 */
    setup_base_tables();
    init_player_unit(ADDR_UNIT, ADDR_SLISTEX, ADDR_SLIST, ADDR_SLIST_STATS, ADDR_INV);
    set_stat_pair(ADDR_SLISTEX, ADDR_SLIST_STATS, 0, 0x00u, 0u, 100);
    set_stat_pair(ADDR_SLISTEX, ADDR_SLIST_STATS, 1, 0x02u, 0u, 50);
    set_stat_pair(ADDR_SLISTEX, ADDR_SLIST_STATS, 2, 0x11u, 0u, 40);
    set_stat_pair(ADDR_SLISTEX, ADDR_SLIST_STATS, 3, 0x19u, 0u, 25);
    set_stat_pair(ADDR_SLISTEX, ADDR_SLIST_STATS, 4, 0x89u, 0u, 8);
    init_item_unit(ADDR_ITEM_BOOTS, ADDR_ITEMDATA2, ADDR_SLISTEX_ITEM, ADDR_SLIST_ITEM, ADDR_SLIST_ITEM_STATS, ADDR_SLIST_FULL_ITEM, 4u, 100u, 20u, 9u, 300u);
    setup_grid0_item(9u, ADDR_ITEM_BOOTS);
    w32(ADDR_OUTDW + 0x00u, 0u); w32(ADDR_OUTDW + 0x04u, 0u); w32(ADDR_OUTDW + 0x08u, 0u);
    stage_common(&s); stage_skill_unit(&s);
    snap_add(&s, VA_GRID0_DEF, 32u);
    snap_add(&s, ADDR_INV, 0x100u); snap_add(&s, ADDR_GRID0, 0x40u); snap_add(&s, ADDR_GRID0_ITEMS, 0x40u);
    snap_add(&s, ADDR_ITEM_BOOTS, 0x100u); snap_add(&s, ADDR_ITEMDATA2, 0x100u);
    snap_add(&s, ADDR_OUTDW, 0x20u); snap_capture(&s);
    call_stdcall4(va, a1[0], a1[1], a1[2], a1[3]);
    emit_line(fp, va, nm, "boots_str_dex_ed", a1, 4, 0u, 0u, &s);

    /* v3: clamp -90 pct & boots min>max clamp */
    setup_base_tables();
    init_player_unit(ADDR_UNIT, ADDR_SLISTEX, ADDR_SLIST, ADDR_SLIST_STATS, ADDR_INV);
    set_stat_pair(ADDR_SLISTEX, ADDR_SLIST_STATS, 0, 0x19u, 0u, -200);
    set_stat_pair(ADDR_SLISTEX, ADDR_SLIST_STATS, 1, 0x89u, 0u, 5);
    init_item_unit(ADDR_ITEM_BOOTS, ADDR_ITEMDATA2, ADDR_SLISTEX_ITEM, ADDR_SLIST_ITEM, ADDR_SLIST_ITEM_STATS, ADDR_SLIST_FULL_ITEM, 4u, 100u, 20u, 9u, 300u);
    setup_grid0_item(9u, ADDR_ITEM_BOOTS);
    w32(ADDR_OUTDW + 0x00u, 0u); w32(ADDR_OUTDW + 0x04u, 0u); w32(ADDR_OUTDW + 0x08u, 0u);
    stage_common(&s); stage_skill_unit(&s);
    snap_add(&s, VA_GRID0_DEF, 32u);
    snap_add(&s, ADDR_INV, 0x100u); snap_add(&s, ADDR_GRID0, 0x40u); snap_add(&s, ADDR_GRID0_ITEMS, 0x40u);
    snap_add(&s, ADDR_ITEM_BOOTS, 0x100u); snap_add(&s, ADDR_ITEMDATA2, 0x100u);
    snap_add(&s, ADDR_OUTDW, 0x20u); snap_capture(&s);
    call_stdcall4(va, a1[0], a1[1], a1[2], a1[3]);
    emit_line(fp, va, nm, "boots_clamp_neg90", a1, 4, 0u, 0u, &s);
  }

  /* B2-09: 0x6FDBB430 MISSILE_EvalCalcOwnerSkillFieldByCtx (fastcall4: skId, fId, _u, pCtx) */
  {
    const uint32_t va = 0x6FDBB430u;
    const char *nm = "MISSILE_EvalCalcOwnerSkillFieldByCtx113c";
    setup_base_tables(); stage_common(&s); snap_capture(&s);
    uint32_t a0[4] = { 1u, 16u, 0u, 0u };
    emit_line(fp, va, nm, "null_ctx", a0, 4, 0xFFFFFFFFu, call_fastcall4(va, a0[0], a0[1], a0[2], a0[3]), &s);

    setup_base_tables(); setup_unit_with_skill(17u, 0xFFFFFFFFu, 5u);
    w32(ADDR_CTX + 0x00u, 0u); w32(ADDR_CTX + 0x04u, ADDR_UNIT); /* owner at +4! */
    stage_common(&s); stage_skill_unit(&s); snap_capture(&s);
    uint32_t a1[4] = { 1u, 16u, 0u, ADDR_CTX };
    emit_line(fp, va, nm, "owner_sk1_lvl17", a1, 4, 0xFFFFFFFFu, call_fastcall4(va, a1[0], a1[1], a1[2], a1[3]), &s);

    uint32_t a2[4] = { 0u, 19u, 0u, ADDR_CTX };
    emit_line(fp, va, nm, "owner_sk0_delay", a2, 4, 0xFFFFFFFFu, call_fastcall4(va, a2[0], a2[1], a2[2], a2[3]), &s);
  }

  /* B2-10: 0x6FDA1BF0 SKILLS_EvalCalcByOffset (stdcall4: dwOff, pOwner, skId, lvl) */
  {
    const uint32_t va = 0x6FDA1BF0u;
    const char *nm = "SKILLS_EvalCalcByOffset113c";
    const struct { const char *id; uint32_t off, lvl; } cases[] = {
      {"oob_offset_0",  0x1000u, 5u},
      {"imm_25",        0x00u,   5u},
      {"lvl_times_2",   0x04u,   9u},
      {"fn3_skill_b15", 0x10u,   4u},
      {"fn6_sklvl_b14", 0x20u,   4u},
      {"var0_plus_5",   0x50u,   6u},
    };
    for (int i = 0; i < 6; i++) {
      setup_base_tables(); setup_unit_with_skill(12u, 0xFFFFFFFFu, 4u);
      stage_common(&s); stage_skill_unit(&s); snap_capture(&s);
      uint32_t a[4] = { ADDR_UNIT, cases[i].off, 0u, cases[i].lvl };
      emit_line(fp, va, nm, cases[i].id, a, 4, 0xFFFFFFFFu, call_stdcall4(va, a[0], a[1], a[2], a[3]), &s);
    }
  }

  /* B2-11: 0x6FDA1FF0 SKILLS_GetSkillPhysMaxDamage (stdcall4) */
  {
    const uint32_t va = 0x6FDA1FF0u;
    const char *nm = "SKILLS_GetSkillPhysMaxDamage113c";
    setup_base_tables(); stage_common(&s); snap_capture(&s);
    uint32_t a0[4] = { ADDR_UNIT, 99u, 5u, 1u };
    emit_line(fp, va, nm, "invalid_sk_ret_2", a0, 4, 0xFFFFFFFFu, call_stdcall4(va, a0[0], a0[1], a0[2], a0[3]), &s);

    setup_base_tables();
    init_player_unit(ADDR_UNIT, ADDR_SLISTEX, ADDR_SLIST, ADDR_SLIST_STATS, ADDR_INV);
    set_stat_pair(ADDR_SLISTEX, ADDR_SLIST_STATS, 0, 0x16u, 0u, 64);
    stage_common(&s); stage_skill_unit(&s); snap_add(&s, ADDR_INV, 0x100u); snap_capture(&s);
    uint32_t a1[4] = { ADDR_UNIT, 0u, 5u, 1u };
    emit_line(fp, va, nm, "sk0_with_srcdmg", a1, 4, 0xFFFFFFFFu, call_stdcall4(va, a1[0], a1[1], a1[2], a1[3]), &s);
    uint32_t a2[4] = { ADDR_UNIT, 0u, 5u, 0u };
    emit_line(fp, va, nm, "sk0_no_srcdmg", a2, 4, 0xFFFFFFFFu, call_stdcall4(va, a2[0], a2[1], a2[2], a2[3]), &s);
    uint32_t a3[4] = { ADDR_UNIT, 1u, 5u, 1u };
    emit_line(fp, va, nm, "sk1_with_calc25", a3, 4, 0xFFFFFFFFu, call_stdcall4(va, a3[0], a3[1], a3[2], a3[3]), &s);
    uint32_t a4[4] = { ADDR_UNIT, 2u, 5u, 1u };
    emit_line(fp, va, nm, "sk2_base_phys", a4, 4, 0xFFFFFFFFu, call_stdcall4(va, a4[0], a4[1], a4[2], a4[3]), &s);
  }

  /* B2-12: 0x6FDA2100 SKILLS_GetSkillPhysMinDamage (stdcall4) */
  {
    const uint32_t va = 0x6FDA2100u;
    const char *nm = "SKILLS_GetSkillPhysMinDamage113c";
    setup_base_tables(); stage_common(&s); snap_capture(&s);
    uint32_t a0[4] = { ADDR_UNIT, 99u, 5u, 1u };
    emit_line(fp, va, nm, "invalid_sk_ret_1", a0, 4, 0xFFFFFFFFu, call_stdcall4(va, a0[0], a0[1], a0[2], a0[3]), &s);

    setup_base_tables();
    init_player_unit(ADDR_UNIT, ADDR_SLISTEX, ADDR_SLIST, ADDR_SLIST_STATS, ADDR_INV);
    set_stat_pair(ADDR_SLISTEX, ADDR_SLIST_STATS, 0, 0x15u, 0u, 32);
    stage_common(&s); stage_skill_unit(&s); snap_add(&s, ADDR_INV, 0x100u); snap_capture(&s);
    uint32_t a1[4] = { ADDR_UNIT, 0u, 5u, 1u };
    emit_line(fp, va, nm, "sk0_with_srcdmg", a1, 4, 0xFFFFFFFFu, call_stdcall4(va, a1[0], a1[1], a1[2], a1[3]), &s);
    uint32_t a2[4] = { ADDR_UNIT, 0u, 5u, 0u };
    emit_line(fp, va, nm, "sk0_no_srcdmg", a2, 4, 0xFFFFFFFFu, call_stdcall4(va, a2[0], a2[1], a2[2], a2[3]), &s);
    uint32_t a3[4] = { ADDR_UNIT, 1u, 5u, 1u };
    emit_line(fp, va, nm, "sk1_with_calc25", a3, 4, 0xFFFFFFFFu, call_stdcall4(va, a3[0], a3[1], a3[2], a3[3]), &s);
    uint32_t a4[4] = { ADDR_UNIT, 2u, 5u, 1u };
    emit_line(fp, va, nm, "sk2_base_phys", a4, 4, 0xFFFFFFFFu, call_stdcall4(va, a4[0], a4[1], a4[2], a4[3]), &s);
  }

  /* B2-13: 0x6FDA2210 SKILLS_IsSkillBlockedByState (eax=pUnit, [esp+4]=pSkill, ret 4) */
  {
    const uint32_t va = 0x6FDA2210u;
    const char *nm = "SKILLS_IsSkillBlockedByState113c";

    /* v0: null unit -> 1 */
    setup_base_tables(); stage_common(&s); snap_capture(&s);
    uint32_t a0[2] = { 0u, ADDR_SKILL1 };
    emit_line(fp, va, nm, "null_unit_1", a0, 2, 0xFFFFFFFFu, call_eax_stack1_ret4(va, a0[0], a0[1]), &s);

    /* v1: player without state 0x79 -> 1 */
    setup_base_tables(); setup_unit_with_skill(5u, 0xFFFFFFFFu, 5u);
    stage_common(&s); stage_skill_unit(&s); snap_capture(&s);
    uint32_t a1[2] = { ADDR_UNIT, ADDR_SKILL2 };
    emit_line(fp, va, nm, "no_state79_1", a1, 2, 0xFFFFFFFFu, call_eax_stack1_ret4(va, a1[0], a1[1]), &s);

    /* v2: player WITH state 0x79 (dword 3 bit 25 = 1<<25), skill0 calc=25 (>0) -> 0 */
    w32(ADDR_STATEFLAGS + 3u * 4u, 1u << 25);
    snap_capture(&s);
    emit_line(fp, va, nm, "state79_calc_pos_0", a1, 2, 0xFFFFFFFFu, call_eax_stack1_ret4(va, a1[0], a1[1]), &s);

    /* v3: player WITH state 0x79, skill1 calc=0 (<=0) -> 1 */
    uint32_t a3[2] = { ADDR_UNIT, ADDR_SKILL1 };
    snap_capture(&s);
    emit_line(fp, va, nm, "state79_calc_zero_1", a3, 2, 0xFFFFFFFFu, call_eax_stack1_ret4(va, a3[0], a3[1]), &s);
  }

  /* B2-14: 0x6FDA2340 SKILLS_GetSkillUseFailReason (stdcall2 -> 0..8) */
  {
    const uint32_t va = 0x6FDA2340u;
    const char *nm = "SKILLS_GetSkillUseFailReason113c";

    /* v0: inGame=0 (skill 5) -> 3 */
    setup_base_tables(); setup_unit_with_skill(5u, 0xFFFFFFFFu, 5u);
    w32(ADDR_SKILL1 + 0x00u, ADDR_SKILLS_TXT + 5u * 0x23Cu);
    stage_common(&s); stage_skill_unit(&s); snap_capture(&s);
    uint32_t a1[2] = { ADDR_UNIT, ADDR_SKILL1 };
    emit_line(fp, va, nm, "not_ingame_3", a1, 2, 0xFFFFFFFFu, call_stdcall2(va, a1[0], a1[1]), &s);

    /* v1: lvl=0 -> 7 */
    setup_base_tables(); setup_unit_with_skill(0u, 0xFFFFFFFFu, 0u);
    stage_common(&s); stage_skill_unit(&s); snap_capture(&s);
    uint32_t a2[2] = { ADDR_UNIT, ADDR_SKILL2 };
    emit_line(fp, va, nm, "lvl0_ret_7", a2, 2, 0xFFFFFFFFu, call_stdcall2(va, a2[0], a2[1]), &s);

    /* v2: passive/town-disallowed flag 0x20 (skill 3) -> 6 */
    setup_base_tables(); setup_unit_with_skill(5u, 0xFFFFFFFFu, 5u);
    w32(ADDR_SKILL1 + 0x00u, ADDR_SKILLS_TXT + 3u * 0x23Cu);
    stage_common(&s); stage_skill_unit(&s); snap_capture(&s);
    emit_line(fp, va, nm, "flag20_ret_6", a1, 2, 0xFFFFFFFFu, call_stdcall2(va, a1[0], a1[1]), &s);

    /* v3: flag 0x10 (skill 4) -> 5 */
    w32(ADDR_SKILL1 + 0x00u, ADDR_SKILLS_TXT + 4u * 0x23Cu);
    snap_capture(&s);
    emit_line(fp, va, nm, "flag10_ret_5", a1, 2, 0xFFFFFFFFu, call_stdcall2(va, a1[0], a1[1]), &s);

    /* v4: out of mana (skill 0, manaCost>0, unit mana=0) -> 1 */
    setup_base_tables(); setup_unit_with_skill(5u, 0xFFFFFFFFu, 5u);
    stage_common(&s); stage_skill_unit(&s); snap_capture(&s);
    emit_line(fp, va, nm, "no_mana_ret_1", a2, 2, 0xFFFFFFFFu, call_stdcall2(va, a2[0], a2[1]), &s);

    /* v5: full mana (stat 8 = 100<<8) & no state restriction -> 0 (allowed!) */
    set_stat_pair(ADDR_SLISTEX, ADDR_SLIST_STATS, 0, 0x08u, 0u, 100 << 8);
    set_stat_pair(ADDR_SLISTEX, ADDR_SLIST_STATS, 1, 0x0Cu, 0u, 27);
    snap_capture(&s);
    emit_line(fp, va, nm, "all_ok_ret_0", a2, 2, 0xFFFFFFFFu, call_stdcall2(va, a2[0], a2[1]), &s);

    /* v6: full mana + state 0x79 active -> blocked -> 8 */
    w32(ADDR_STATEFLAGS + 3u * 4u, 1u << 25);
    snap_capture(&s);
    emit_line(fp, va, nm, "state79_blocked_8", a2, 2, 0xFFFFFFFFu, call_stdcall2(va, a2[0], a2[1]), &s);
  }
}

static void emit_i12b_2(FILE *fp) {
  emit_b2_01_to_07(fp);
  emit_b2_08_to_14(fp);
}

int main(int argc, char **argv) {
  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX);
  const char *dll_dir = (argc > 1) ? argv[1] : ".";
  const char *out1 = (argc > 2) ? argv[2] : "i12b-1-vectors.ndjson";
  const char *out2 = (argc > 3) ? argv[3] : "i12b-2-vectors.ndjson";

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

  void *arena = VirtualAlloc((void *)(uintptr_t)ARENA_BASE, ARENA_SIZE, MEM_RESERVE | MEM_COMMIT, PAGE_READWRITE);
  void *heap = VirtualAlloc((void *)(uintptr_t)HEAP_BASE, HEAP_SIZE, MEM_RESERVE | MEM_COMMIT, PAGE_READWRITE);
  if (!arena || !heap) {
    fprintf(stderr, "VirtualAlloc failed\n");
    return 3;
  }

  DWORD old_prot = 0;
  VirtualProtect((void *)(uintptr_t)0x6FDD9000u, 0x19000u, PAGE_READWRITE, &old_prot);
  w32(VA_FOG_10045_IAT, (uint32_t)(uintptr_t)&stub_fog_10045);
  w32(VA_FOG_10046_IAT, (uint32_t)(uintptr_t)&stub_fog_10046);
  w32(VA_FOG_10047_IAT, (uint32_t)(uintptr_t)&stub_fog_10047);

  FILE *f1 = fopen(out1, "wb");
  FILE *f2 = fopen(out2, "wb");
  if (!f1 || !f2) {
    fprintf(stderr, "Failed to open output files\n");
    return 4;
  }

  emit_i12b_1(f1);
  emit_i12b_2(f2);

  fclose(f1);
  fclose(f2);
  printf("Successfully emitted %s and %s\n", out1, out2);
  return 0;
}
