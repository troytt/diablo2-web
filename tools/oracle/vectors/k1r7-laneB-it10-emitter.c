/*
 * Standalone MinGW real-DLL differential vector emitter for K1r7 Iteration 10 Lane B:
 * - Sub-Batch I10B-1 (18 D2Common.dll v1.13c functions -> i10b-1-vectors.ndjson)
 * - Sub-Batch I10B-2 (17 D2Common.dll v1.13c functions -> i10b-2-vectors.ndjson)
 *
 * Uses register-only inline assembly constraints (zero memory-operand asm constraints) and verifies 100%
 * SHA-256 parity between -O2 and -O2 -fno-omit-frame-pointer builds under Wine.
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
#define VA_GDWBITMASKS_IAT   0x6FDD90B0u
#define VA_SGPT_DATATABLES   0x6FDE9E1Cu
#define VA_GRID0_DEF         0x6FDED378u /* 16B: equipment grid0 def */
#define VA_GRID1_DEF         0x6FDED390u /* 16B: belt grid1 def */
#define VA_ITEMS_TXT_COUNT   0x6FDEFB94u /* 8B: count + ptr */
#define VA_ITEMS_TXT_PTR     0x6FDEFB98u
#define VA_ITEMRATIO_COUNT   0x6FDEFD88u /* 8B: count + ptr */
#define VA_ITEMRATIO_PTR     0x6FDEFD8Cu
#define VA_LVLPREST_PTR      0x6FDF0B3Cu /* 4B */
#define VA_EXPERIENCE_PTR    0x6FDF0B50u /* 4B */
#define VA_SCRATCH_LOS       0x6FDF1F00u /* 16B scratch for B1-07 */
#define VA_SCRATCH_REQ       0x6FDF1F10u /* 4B scratch for B2-01 / B2-02 */

/* Arena layout */
#define ADDR_UNIT            0x20000100u /* 0x100: D2UnitStrc #1 */
#define ADDR_UNIT2           0x20000200u /* 0x100: D2UnitStrc #2 */
#define ADDR_UNIT3           0x20000300u /* 0x100: D2UnitStrc #3 */
#define ADDR_ITEMDATA1       0x20000400u /* 0x80:  D2ItemDataStrc #1 */
#define ADDR_ITEMDATA2       0x20000480u /* 0x80:  D2ItemDataStrc #2 */
#define ADDR_ITEMDATA3       0x20000500u /* 0x80:  D2ItemDataStrc #3 */
#define ADDR_INV1            0x20000580u /* 0x40:  D2InventoryStrc #1 */
#define ADDR_GRID_ARR        0x20000600u /* 0x40:  D2InventoryGridStrc[4] */
#define ADDR_GRID_ITEMS      0x20000640u /* 0x40:  uint32_t ppItems[16] */
#define ADDR_STATLIST1       0x20000700u /* 0x80:  D2StatListExStrc #1 */
#define ADDR_STATLIST2       0x20000780u /* 0x80:  D2StatListExStrc #2 */
#define ADDR_STATLIST3       0x20000800u /* 0x80:  D2StatListExStrc #3 */
#define ADDR_STAT_ARR1       0x20000880u /* 0x40:  D2StatStrc[8] #1 */
#define ADDR_STAT_ARR2       0x200008C0u /* 0x40:  D2StatStrc[8] #2 */
#define ADDR_STAT_ARR3       0x20000900u /* 0x40:  D2StatStrc[8] #3 */
#define ADDR_STATE_FLAGS     0x20000940u /* 0x20:  uint32_t fStateFlags[8] */
#define ADDR_SKILL_LIST      0x20000980u /* 0x20:  D2SkillListStrc */
#define ADDR_SKILL0          0x200009C0u /* 0x40:  D2SkillStrc #0 */
#define ADDR_SKILL1          0x20000A00u /* 0x40:  D2SkillStrc #1 */
#define ADDR_PATH1           0x20000A40u /* 0x40:  D2DynamicPathStrc */
#define ADDR_ROOM1           0x20000A80u /* 0x40:  D2ActiveRoomStrc #1 */
#define ADDR_ROOM2           0x20000AC0u /* 0x40:  D2ActiveRoomStrc #2 */
#define ADDR_ROOMS_NEAR      0x20000B00u /* 0x10:  D2ActiveRoomStrc*[4] */
#define ADDR_ROOMEX1         0x20000B20u /* 0x60:  D2RoomExStrc #1 */
#define ADDR_ROOMEX2         0x20000B80u /* 0x60:  D2RoomExStrc #2 */
#define ADDR_LEVEL           0x20000C00u /* 0x200: D2DrlgLevelStrc */
#define ADDR_OUTDOORS        0x20000E00u /* 0x80:  D2DrlgOutdoorInfoStrc */
#define ADDR_DRLG            0x20000E80u /* 0x480: D2DrlgStrc */
#define ADDR_COLLGRID        0x20001300u /* 0x30:  D2RoomCollisionGridStrc */
#define ADDR_COLLMAP         0x20001340u /* 0x320: uint16_t collMap[20*20] */
#define ADDR_BITMASKS        0x20001680u /* 0x80:  gdwBitMasks[32] */
#define ADDR_EXP_TXT         0x20001700u /* 0x10:  D2ExperienceTxt */
#define ADDR_SCRATCH         0x20001720u /* 0x40:  ppUnit / pModDef / pOutStr / pOutDex / pOutLvl */
#define ADDR_GRID0_ROWS      0x20001780u /* 0x40:  int32_t rowOffsets0[16] */
#define ADDR_GRID2_ROWS      0x200017C0u /* 0x40:  int32_t rowOffsets2[16] */
#define ADDR_GRID0_CELLS     0x20001800u /* 0x400: int32_t cells0[256] */
#define ADDR_GRID2_CELLS     0x20001C00u /* 0x400: int32_t cells2[256] */

/* Data tables in 0x20002000..0x20150000 */
#define ADDR_DATATABLES      0x20002000u /* 0xD00: D2DataTablesStrc */
#define ADDR_ITEMS_TXT       0x20003000u /* 8 * 0x1A8 = 0xD40 */
#define ADDR_ITEMTYPES_TXT   0x20004000u /* 60 * 0xE4 = 0x3570 */
#define ADDR_SKILLS_TXT      0x20008000u /* 8 * 0x23C = 0x11E0 */
#define ADDR_SKILLDESC_TXT   0x20009400u /* 4 * 0x120 = 0x480 */
#define ADDR_MAGAFFIX_TXT    0x20009A00u /* 6 * 0x90  = 0x360 */
#define ADDR_SETITEMS_TXT    0x2000A000u /* 4 * 0x1B8 = 0x6E0 */
#define ADDR_UNIQUEITEMS_TXT 0x2000A800u /* 4 * 0x14C = 0x530 */
#define ADDR_MONSTATS_TXT    0x2000B000u /* 565 * 0x1A8: we place base or small table */
#define ADDR_MONSTATS2_TXT   0x2000C000u /* 5 * 0x134 = 0x604 */
#define ADDR_ITEMRATIO_TXT   0x2000C800u /* 6 * 0x44  = 0x198 */
#define ADDR_ISC_TXT         0x20010000u /* 200 * 0x144 = 0x19500 */
#define ADDR_LVLPREST_LOW    0x20030000u /* preset 26..28 (3 * 0x1B0 = 0x510) */
#define ADDR_LVLPREST_HIGH   0x20100000u /* preset 0x361..0x3DA (122 * 0x1B0 = 0x149A0) */

typedef struct {
  uint32_t addr;
  uint32_t len;
} RangeSpec;

static inline void w32(uint32_t addr, uint32_t val) { *(uint32_t *)(uintptr_t)addr = val; }
static inline void w16(uint32_t addr, uint16_t val) { *(uint16_t *)(uintptr_t)addr = val; }
static inline void w8(uint32_t addr, uint8_t val)   { *(uint8_t *)(uintptr_t)addr = val; }

static uint32_t g_heap_next = HEAP_BASE;

static void reset_heap(void) {
  memset((void *)(uintptr_t)HEAP_BASE, 0, 0x400u);
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

/* =========================================================================
 * Calling Convention Wrappers (Register-only asm constraints)
 * ========================================================================= */
static uint32_t call_stdcall1(uintptr_t fn, uint32_t a0) {
  typedef uint32_t (__stdcall *F)(uint32_t);
  return ((F)fn)(a0);
}
static void call_stdcall1_void(uintptr_t fn, uint32_t a0) {
  typedef void (__stdcall *F)(uint32_t);
  ((F)fn)(a0);
}
static uint32_t call_stdcall2(uintptr_t fn, uint32_t a0, uint32_t a1) {
  typedef uint32_t (__stdcall *F)(uint32_t, uint32_t);
  return ((F)fn)(a0, a1);
}
static void call_stdcall2_void(uintptr_t fn, uint32_t a0, uint32_t a1) {
  typedef void (__stdcall *F)(uint32_t, uint32_t);
  ((F)fn)(a0, a1);
}
static uint32_t call_stdcall3(uintptr_t fn, uint32_t a0, uint32_t a1, uint32_t a2) {
  typedef uint32_t (__stdcall *F)(uint32_t, uint32_t, uint32_t);
  return ((F)fn)(a0, a1, a2);
}
static uint32_t call_stdcall6(
  uintptr_t fn, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3, uint32_t a4, uint32_t a5
) {
  typedef uint32_t (__stdcall *F)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
  return ((F)fn)(a0, a1, a2, a3, a4, a5);
}
static uint32_t call_stdcall7(
  uintptr_t fn, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3, uint32_t a4, uint32_t a5, uint32_t a6
) {
  typedef uint32_t (__stdcall *F)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
  return ((F)fn)(a0, a1, a2, a3, a4, a5, a6);
}
static uint32_t call_stdcall9(
  uintptr_t fn, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3, uint32_t a4,
  uint32_t a5, uint32_t a6, uint32_t a7, uint32_t a8
) {
  typedef uint32_t (__stdcall *F)(
    uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t
  );
  return ((F)fn)(a0, a1, a2, a3, a4, a5, a6, a7, a8);
}
static uint32_t call_fastcall1(uintptr_t fn, uint32_t ecx_in) {
  typedef uint32_t (__fastcall *F)(uint32_t);
  return ((F)fn)(ecx_in);
}
static uint32_t call_fastcall2(uintptr_t fn, uint32_t ecx_in, uint32_t edx_in) {
  typedef uint32_t (__fastcall *F)(uint32_t, uint32_t);
  return ((F)fn)(ecx_in, edx_in);
}
static uint32_t call_fastcall3_ecx_stack1(uintptr_t fn, uint32_t ecx_in, uint32_t s0) {
  typedef uint32_t (__fastcall *F)(uint32_t, uint32_t, uint32_t);
  return ((F)fn)(ecx_in, 0u, s0);
}
static uint32_t call_fastcall4(uintptr_t fn, uint32_t ecx_in, uint32_t edx_in, uint32_t s0, uint32_t s1) {
  typedef uint32_t (__fastcall *F)(uint32_t, uint32_t, uint32_t, uint32_t);
  return ((F)fn)(ecx_in, edx_in, s0, s1);
}

/* B1-10: eax=pUnit, ebx=nX, edi=nY -> eax, ret */
static __attribute__((noinline)) uint32_t call_eax_ebx_edi_ret(
  uintptr_t fn, uint32_t eax_in, uint32_t ebx_in, uint32_t edi_in
) {
  uint32_t out = eax_in;
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "+a"(out), "+b"(ebx_in), "+D"(edi_in)
    : [fn]"c"(fn)
    : "edx", "esi", "cc", "memory"
  );
  return out;
}

/* B1-11: eax=pSkill, ebx=pUnit -> eax, ret */
static __attribute__((noinline)) uint32_t call_eax_ebx_ret(
  uintptr_t fn, uint32_t eax_in, uint32_t ebx_in
) {
  uint32_t out = eax_in;
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "+a"(out), "+b"(ebx_in)
    : [fn]"c"(fn)
    : "edx", "esi", "edi", "cc", "memory"
  );
  return out;
}

/* B1-14: eax=nSlotIdx, [esp+4]=pPrimary, [esp+8]=pSecondary, [esp+0xC]=pSkillsTxt -> eax, ret 0xC */
static __attribute__((noinline)) uint32_t call_eax_stack3_ret12(
  uintptr_t fn, uint32_t eax_in, uint32_t s0, uint32_t s1, uint32_t s2
) {
  uint32_t out = eax_in;
  __asm__ volatile(
    "pushl %[s2]\n\t"
    "pushl %[s1]\n\t"
    "pushl %[s0]\n\t"
    "call *%[fn]\n\t"
    : "+a"(out)
    : [fn]"c"(fn), [s0]"d"(s0), [s1]"b"(s1), [s2]"S"(s2)
    : "edi", "cc", "memory"
  );
  return out;
}

/* B1-18: ebx=nGridX, edi=pLevel -> void, ret */
static __attribute__((noinline)) void call_ebx_edi_void(
  uintptr_t fn, uint32_t ebx_in, uint32_t edi_in
) {
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "+b"(ebx_in), "+D"(edi_in)
    : [fn]"c"(fn)
    : "eax", "edx", "esi", "cc", "memory"
  );
}

/* B2-04: eax=pSkill, esi=pUnit -> eax, ret */
static __attribute__((noinline)) uint32_t call_eax_esi_ret(
  uintptr_t fn, uint32_t eax_in, uint32_t esi_in
) {
  uint32_t out = eax_in;
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "+a"(out), "+S"(esi_in)
    : [fn]"c"(fn)
    : "ebx", "edx", "edi", "cc", "memory"
  );
  return out;
}

/* B2-07: eax=pSkill, ecx=pUnit -> eax, ret */
static __attribute__((noinline)) uint32_t call_eax_ecx_ret(
  uintptr_t fn, uint32_t eax_in, uint32_t ecx_in
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

/* B2-09: eax=pSkill, [esp+4]=pUnit -> eax, ret 4 */
static __attribute__((noinline)) uint32_t call_eax_stack1_ret4(
  uintptr_t fn, uint32_t eax_in, uint32_t s0
) {
  uint32_t out = eax_in;
  __asm__ volatile(
    "pushl %[s0]\n\t"
    "call *%[fn]\n\t"
    : "+a"(out)
    : [fn]"c"(fn), [s0]"d"(s0)
    : "ebx", "esi", "edi", "cc", "memory"
  );
  return out;
}

/* B2-11: ebx=pLevel -> void, ret */
static __attribute__((noinline)) void call_ebx_void(uintptr_t fn, uint32_t ebx_in) {
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "+b"(ebx_in)
    : [fn]"c"(fn)
    : "eax", "edx", "esi", "edi", "cc", "memory"
  );
}

/* B2-12: ecx=pLevel, edx=nGridX, esi=nGridY -> eax, ret */
static __attribute__((noinline)) uint32_t call_ecx_edx_esi_ret(
  uintptr_t fn, uint32_t ecx_in, uint32_t edx_in, uint32_t esi_in
) {
  uint32_t out;
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "=a"(out), "+c"(ecx_in), "+d"(edx_in), "+S"(esi_in)
    : [fn]"b"(fn)
    : "edi", "cc", "memory"
  );
  return out;
}

/* B2-14: edi=pLevel -> void, ret */
static __attribute__((noinline)) void call_edi_void(uintptr_t fn, uint32_t edi_in) {
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "+D"(edi_in)
    : [fn]"c"(fn)
    : "eax", "ebx", "edx", "esi", "cc", "memory"
  );
}

/* B2-16: eax=nGridX, ecx=pLevel -> void, ret */
static __attribute__((noinline)) void call_eax_ecx_void(
  uintptr_t fn, uint32_t eax_in, uint32_t ecx_in
) {
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "+a"(eax_in), "+c"(ecx_in)
    : [fn]"d"(fn)
    : "ebx", "esi", "edi", "cc", "memory"
  );
}

/* =========================================================================
 * NDJSON Snapshot Infrastructure
 * ========================================================================= */
static void write_hex(FILE *fp, const uint8_t *buf, uint32_t len) {
  for (uint32_t i = 0; i < len; i++) fprintf(fp, "%02x", buf[i]);
}

#define MAX_RANGES 32

typedef struct {
  RangeSpec r[MAX_RANGES];
  int n;
  uint8_t *pre[MAX_RANGES];
} Snap;

static void snap_add(Snap *s, uint32_t addr, uint32_t len) {
  if (s->n >= MAX_RANGES) {
    fprintf(stderr, "too many ranges\n");
    exit(9);
  }
  s->r[s->n].addr = addr;
  s->r[s->n].len = len;
  s->n++;
}

static void snap_capture(Snap *s) {
  for (int i = 0; i < s->n; i++) {
    s->pre[i] = (uint8_t *)malloc(s->r[i].len);
    memcpy(s->pre[i], (const void *)(uintptr_t)s->r[i].addr, s->r[i].len);
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
  fprintf(fp, "],\"retMask\":%u,\"eax\":%u,\"pre\":[", ret_mask, eax & ret_mask);
  for (int i = 0; i < s->n; i++) {
    if (i > 0) fputc(',', fp);
    fprintf(fp, "{\"addr\":%u,\"hex\":\"", s->r[i].addr);
    write_hex(fp, s->pre[i], s->r[i].len);
    fprintf(fp, "\"}");
  }
  fprintf(fp, "],\"post\":[");
  for (int i = 0; i < s->n; i++) {
    if (i > 0) fputc(',', fp);
    fprintf(fp, "{\"addr\":%u,\"hex\":\"", s->r[i].addr);
    write_hex(fp, (const uint8_t *)(uintptr_t)s->r[i].addr, s->r[i].len);
    fprintf(fp, "\"}");
  }
  fprintf(fp, "]}\n");
  for (int i = 0; i < s->n; i++) free(s->pre[i]);
  s->n = 0;
}

static void clear_base_arena(void) {
  memset((void *)(uintptr_t)ARENA_BASE, 0, 0x0002A000u);
  reset_heap();
  for (uint32_t i = 0; i < 32; i++) {
    w32(ADDR_BITMASKS + i * 4u, 1u << i);
  }
  w32(VA_GDWBITMASKS_IAT, ADDR_BITMASKS);
  w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);
  w32(VA_EXPERIENCE_PTR, ADDR_EXP_TXT);
  w32(ADDR_EXP_TXT, 99u);
  w32(VA_SCRATCH_LOS, 0u);
  w32(VA_SCRATCH_LOS + 4u, 0u);
  w32(VA_SCRATCH_LOS + 8u, 0u);
  w32(VA_SCRATCH_LOS + 12u, 0u);
  w32(VA_SCRATCH_REQ, 0u);
  w8(VA_GRID0_DEF, 10u);
  w8(VA_GRID0_DEF + 1u, 1u);
  w8(VA_GRID1_DEF, 4u);
  w8(VA_GRID1_DEF + 1u, 4u);
}

#define VA_MAGAFFIX_COUNT    0x6FDEFBB8u /* 8B: count + ptr */
#define VA_MAGAFFIX_PTR      0x6FDEFBBCu
#define ADDR_ITEMTYPES_EQUIV 0x20007800u /* 68 * 12 = 0x330 */
#define ADDR_CHARSTATS_TXT   0x2000CC00u /* 7 * 0xC4 = 0x55C */

static void set_equiv_bit(uint32_t wType, uint32_t targetType) {
  uint32_t word_off = targetType >> 5u;
  uint32_t bit = 1u << (targetType & 31u);
  uint32_t addr = ADDR_ITEMTYPES_EQUIV + (wType * 3u + word_off) * 4u;
  w32(addr, (*(uint32_t *)(uintptr_t)addr) | bit);
}

static void setup_base_tables(void) {
  clear_base_arena();
  /* sgptDataTables */
  w32(ADDR_DATATABLES + 0xC4u,  185u); /* nStatesTxtRecordCount */
  w32(ADDR_DATATABLES + 0x110u, ADDR_STATE_FLAGS); /* fStateMasks[17] read by 0x6FD83F40 */
  w32(ADDR_DATATABLES + 0xA78u, ADDR_MONSTATS_TXT);
  w32(ADDR_DATATABLES + 0xA80u, 5u);
  w32(ADDR_DATATABLES + 0xA90u, ADDR_MONSTATS2_TXT);
  w32(ADDR_DATATABLES + 0xA98u, 5u);
  w32(ADDR_DATATABLES + 0xB8Cu, ADDR_SKILLDESC_TXT);
  w32(ADDR_DATATABLES + 0xB94u, 4u);
  w32(ADDR_DATATABLES + 0xB98u, ADDR_SKILLS_TXT);
  w32(ADDR_DATATABLES + 0xBA0u, 8u);
  w32(ADDR_DATATABLES + 0xBC4u, ADDR_CHARSTATS_TXT);
  w32(ADDR_DATATABLES + 0xBC8u, 7u);
  w32(ADDR_DATATABLES + 0xBCCu, ADDR_ISC_TXT);
  w32(ADDR_DATATABLES + 0xBD4u, 200u);
  w32(ADDR_DATATABLES + 0xBF8u, ADDR_ITEMTYPES_TXT);
  w32(ADDR_DATATABLES + 0xBFCu, 68u);
  w32(ADDR_DATATABLES + 0xC00u, 3u);
  w32(ADDR_DATATABLES + 0xC04u, ADDR_ITEMTYPES_EQUIV);
  w32(ADDR_DATATABLES + 0xC18u, ADDR_SETITEMS_TXT);
  w32(ADDR_DATATABLES + 0xC1Cu, 4u);
  w32(ADDR_DATATABLES + 0xC24u, ADDR_UNIQUEITEMS_TXT);
  w32(ADDR_DATATABLES + 0xC28u, 4u);
  w32(ADDR_DATATABLES + 0xC68u, 1000u); /* nLvlPrestTxtRecordCount */

  w32(ADDR_STATLIST1 + 0x58u, ADDR_STATLIST1 + 0x64u); /* pStateFlags -> +0x64..0x7B */

  w32(VA_ITEMS_TXT_COUNT, 8u);
  w32(VA_ITEMS_TXT_PTR, ADDR_ITEMS_TXT);
  w32(VA_MAGAFFIX_COUNT, 6u);
  w32(VA_MAGAFFIX_PTR, ADDR_MAGAFFIX_TXT);
  w32(VA_ITEMRATIO_COUNT, 6u);
  w32(VA_ITEMRATIO_PTR, ADDR_ITEMRATIO_TXT);
}

static void stage_core(Snap *s) {
  snap_add(s, VA_GDWBITMASKS_IAT, 4u);
  snap_add(s, VA_SGPT_DATATABLES, 4u);
  snap_add(s, VA_GRID0_DEF, 32u);
  snap_add(s, VA_ITEMS_TXT_COUNT, 8u);
  snap_add(s, VA_MAGAFFIX_COUNT, 8u);
  snap_add(s, VA_ITEMRATIO_COUNT, 8u);
  snap_add(s, VA_LVLPREST_PTR, 4u);
  snap_add(s, VA_EXPERIENCE_PTR, 4u);
  snap_add(s, VA_SCRATCH_LOS, 20u);
  snap_add(s, ADDR_UNIT, 0x1680u); /* 0x20000100..0x2000177F */
  snap_add(s, ADDR_DATATABLES, 0xD00u);
}

static void stage_isc(Snap *s, const uint32_t *ids, int n) {
  for (int i = 0; i < n; i++) {
    snap_add(s, ADDR_ISC_TXT + ids[i] * 0x144u, 0x144u);
  }
}

static void setup_drlg_grid_fixture(uint32_t gw, uint32_t gh, uint32_t lvl_id, uint32_t flags) {
  reset_heap();
  memset((void *)(uintptr_t)ADDR_LEVEL, 0, 0x200u);
  memset((void *)(uintptr_t)ADDR_OUTDOORS, 0, 0x80u);
  memset((void *)(uintptr_t)ADDR_GRID0_ROWS, 0, 0x880u);
  w32(ADDR_LEVEL + 0x14u,  ADDR_OUTDOORS);
  w32(ADDR_LEVEL + 0x24u,  gw * 8u);
  w32(ADDR_LEVEL + 0x28u,  gh * 8u);
  w32(ADDR_LEVEL + 0x1B4u, ADDR_DRLG);
  w32(ADDR_LEVEL + 0x1C4u, 0x12345678u);
  w32(ADDR_LEVEL + 0x1C8u, 0x000006ACu);
  w32(ADDR_LEVEL + 0x1CCu, 0u);
  w32(ADDR_LEVEL + 0x1D0u, lvl_id);
  w32(ADDR_OUTDOORS + 0x00u, flags);
  w32(ADDR_OUTDOORS + 0x04u, ADDR_GRID0_CELLS);
  w32(ADDR_OUTDOORS + 0x08u, ADDR_GRID0_ROWS);
  w32(ADDR_OUTDOORS + 0x2Cu, ADDR_GRID2_CELLS);
  w32(ADDR_OUTDOORS + 0x30u, ADDR_GRID2_ROWS);
  w32(ADDR_OUTDOORS + 0x5Cu, gw);
  w32(ADDR_OUTDOORS + 0x60u, gh);
  for (uint32_t y = 0; y < 16u; y++) {
    w32(ADDR_GRID0_ROWS + y * 4u, y * 16u);
    w32(ADDR_GRID2_ROWS + y * 4u, y * 16u);
  }
}

static void emit_i10b_1(FILE *fp) {
  Snap s = {0};

  /* 1. B1-01: 0x6FD74B20 ITEMS_CanItemBeAutoBeltOrStacked (stdcall pInv, pItem -> eax) */
  {
    const uint32_t va = 0x6FD74B20u;
    const char *nm = "ITEMS_CanItemBeAutoBeltOrStacked";

    /* v0: stackable item (bStackable=1), pInventory=0 -> returns 1 without touching pInventory */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w8(ADDR_ITEMS_TXT + 0x131u, 1u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 2u * 0x1A8u);
    snap_capture(&s);
    uint32_t args0[2] = { 0x20090000u, ADDR_UNIT }; /* unstaged pInventory kills bStackable !== 0 -> === 0 mutant! */
    uint32_t eax0 = call_stdcall2(va, args0[0], args0[1]);
    emit_line(fp, va, nm, "stackable_item_skips_inv_ret_1", args0, 2, 0xFFFFFFFFu, eax0, &s);

    /* v1: non-stackable item (bStackable=0), pInventory=0 -> returns 1 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 1u);
    w8(ADDR_ITEMS_TXT + 1u * 0x1A8u + 0x131u, 0u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 2u * 0x1A8u);
    snap_capture(&s);
    uint32_t args1[2] = { 0u, ADDR_UNIT };
    uint32_t eax1 = call_stdcall2(va, args1[0], args1[1]);
    emit_line(fp, va, nm, "nonstackable_null_inv_ret_1", args1, 2, 0xFFFFFFFFu, eax1, &s);

    /* v2: non-stackable item, valid pInventory with lazy grid1 (nGridCount=2, ppItems=0) -> initializes grid1 at HEAP_BASE */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 1u);
    w32(ADDR_ITEMS_TXT + 1u * 0x1A8u + 0x80u, 0x31746F70u);
    w8(ADDR_ITEMS_TXT + 1u * 0x1A8u + 0x131u, 0u);
    w32(ADDR_INV1 + 0x00u, 0x01020304u);
    w32(ADDR_INV1 + 0x14u, ADDR_GRID_ARR);
    w32(ADDR_INV1 + 0x18u, 2u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 2u * 0x1A8u);
    snap_add(&s, HEAP_BASE, 0x40u);
    snap_capture(&s);
    uint32_t args2[2] = { ADDR_INV1, ADDR_UNIT };
    uint32_t eax2 = call_stdcall2(va, args2[0], args2[1]);
    emit_line(fp, va, nm, "nonstackable_lazy_grid1_init_ret_1", args2, 2, 0xFFFFFFFFu, eax2, &s);
  }

  /* 2. B1-02: 0x6FD74D00 ITEMS_IsUberOrUltraArmorOrWeapon (stdcall nItemId -> eax) */
  {
    const uint32_t va = 0x6FD74D00u;
    const char *nm = "ITEMS_IsUberOrUltraArmorOrWeapon";
    setup_base_tables();
    /* Type 1 = armor (0x32), Type 2 = weapon (0x2d), Type 3 = misc (neither), Type 0x26 (38) = missile potion with weapon equiv */
    set_equiv_bit(1u, 0x32u);
    set_equiv_bit(2u, 0x2Du);
    set_equiv_bit(0x26u, 0x2Du);

    /* Item 0: uber armor (dwCode == dwUberCode, nComponent == 0) -> 1 */
    w16(ADDR_ITEMS_TXT + 0u * 0x1A8u + 0x11Eu, 1u);
    w32(ADDR_ITEMS_TXT + 0u * 0x1A8u + 0x80u, 0x31726178u);
    w32(ADDR_ITEMS_TXT + 0u * 0x1A8u + 0x88u, 0x31726178u);
    w32(ADDR_ITEMS_TXT + 0u * 0x1A8u + 0x8Cu, 0x32726178u);
    w8(ADDR_ITEMS_TXT  + 0u * 0x1A8u + 0x12Au, 0u);

    /* Item 1: ultra weapon (dwCode == dwUltraCode, nComponent == 0) -> 1 */
    w16(ADDR_ITEMS_TXT + 1u * 0x1A8u + 0x11Eu, 2u);
    w32(ADDR_ITEMS_TXT + 1u * 0x1A8u + 0x80u, 0x32707778u);
    w32(ADDR_ITEMS_TXT + 1u * 0x1A8u + 0x88u, 0x31707778u);
    w32(ADDR_ITEMS_TXT + 1u * 0x1A8u + 0x8Cu, 0x32707778u);
    w8(ADDR_ITEMS_TXT  + 1u * 0x1A8u + 0x12Au, 0u);

    /* Item 2: normal weapon (dwCode != uber/ultra) -> 0 */
    w16(ADDR_ITEMS_TXT + 2u * 0x1A8u + 0x11Eu, 2u);
    w32(ADDR_ITEMS_TXT + 2u * 0x1A8u + 0x80u, 0x30707778u);
    w32(ADDR_ITEMS_TXT + 2u * 0x1A8u + 0x88u, 0x31707778u);
    w32(ADDR_ITEMS_TXT + 2u * 0x1A8u + 0x8Cu, 0x32707778u);

    /* Item 3: non-armor/non-weapon (wType1 = 3) -> 0 */
    w16(ADDR_ITEMS_TXT + 3u * 0x1A8u + 0x11Eu, 3u);
    w32(ADDR_ITEMS_TXT + 3u * 0x1A8u + 0x80u, 0x31726178u);
    w32(ADDR_ITEMS_TXT + 3u * 0x1A8u + 0x88u, 0x31726178u);

    /* Item 4: wType1 = 0x26 (missile potion) with weapon equiv -> 0 */
    w16(ADDR_ITEMS_TXT + 4u * 0x1A8u + 0x11Eu, 0x26u);
    w32(ADDR_ITEMS_TXT + 4u * 0x1A8u + 0x80u, 0x31707778u);
    w32(ADDR_ITEMS_TXT + 4u * 0x1A8u + 0x88u, 0x31707778u);
    w8(ADDR_ITEMS_TXT  + 4u * 0x1A8u + 0x12Au, 0u);

    /* Item 5: uber armor but nComponent = 2 (!= 0) -> 0 */
    w16(ADDR_ITEMS_TXT + 5u * 0x1A8u + 0x11Eu, 1u);
    w32(ADDR_ITEMS_TXT + 5u * 0x1A8u + 0x80u, 0x31726178u);
    w32(ADDR_ITEMS_TXT + 5u * 0x1A8u + 0x88u, 0x31726178u);
    w8(ADDR_ITEMS_TXT  + 5u * 0x1A8u + 0x12Au, 2u);

    const char *labels[7] = {
      "uber_armor_ret_1",
      "ultra_weapon_ret_1",
      "normal_weapon_ret_0",
      "neither_armor_nor_weapon_ret_0",
      "type_0x26_missile_potion_ret_0",
      "nonzero_component_ret_0",
      "out_of_range_id8_ret_0"
    };
    uint32_t ids[7] = { 0u, 1u, 2u, 3u, 4u, 5u, 8u };
    for (int i = 0; i < 7; i++) {
      stage_core(&s);
      snap_add(&s, ADDR_ITEMS_TXT, 8u * 0x1A8u);
      snap_add(&s, ADDR_ITEMTYPES_EQUIV, 0x330u);
      snap_capture(&s);
      uint32_t a[1] = { ids[i] };
      uint32_t r = call_stdcall1(va, a[0]);
      emit_line(fp, va, nm, labels[i], a, 1, 0xFFFFFFFFu, r, &s);
    }
  }

  /* 3. B1-03: 0x6FD76190 ITEMS_EvaluateRequiredLevel (fastcall ecx=pItem, edx=pUnit -> eax) */
  {
    const uint32_t va = 0x6FD76190u;
    const char *nm = "ITEMS_EvaluateRequiredLevel";
    uint32_t isc_ids[1] = { 0x5Cu };

    /* Setup shared tables for B1-03 */
    setup_base_tables();
    w8(ADDR_ITEMS_TXT + 0u * 0x1A8u + 0x13Fu, 12u); /* item 0 base req = 12 */
    w8(ADDR_ITEMS_TXT + 1u * 0x1A8u + 0x13Fu, 33u); /* item 1 (socketed child) base req = 33 */
    /* Affix 1 (index 0): nLevelReq=15, nClass=0xFF */
    w8(ADDR_MAGAFFIX_TXT + 0u * 0x90u + 0x65u, 15u);
    w8(ADDR_MAGAFFIX_TXT + 0u * 0x90u + 0x67u, 0xFFu);
    /* Affix 2 (index 1): nLevelReq=28, nClass=2, nClassLevelReq=20 */
    w8(ADDR_MAGAFFIX_TXT + 1u * 0x90u + 0x65u, 28u);
    w8(ADDR_MAGAFFIX_TXT + 1u * 0x90u + 0x67u, 2u);
    w8(ADDR_MAGAFFIX_TXT + 1u * 0x90u + 0x68u, 20u);
    /* Affix 3 (index 2): nLevelReq=90, nClass=0xFF */
    w8(ADDR_MAGAFFIX_TXT + 2u * 0x90u + 0x65u, 90u);
    w8(ADDR_MAGAFFIX_TXT + 2u * 0x90u + 0x67u, 0xFFu);
    /* SetItemsTxt[1]: wLvlReq (+0x32) = 29 */
    w16(ADDR_SETITEMS_TXT + 1u * 0x1B8u + 0x32u, 29u);
    /* UniqueItemsTxt[1]: wLvlReq (+0x36) = 42 */
    w16(ADDR_UNIQUEITEMS_TXT + 1u * 0x14Cu + 0x36u, 42u);
    /* SkillsTxt[1]: wReqLevel (+0x174) = 24, nCharClass (+0x0C) = 3 */
    w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x174u, 24u);
    w8(ADDR_SKILLS_TXT  + 1u * 0x23Cu + 0x0Cu,  3u);

    /* v0: quality 2 normal item -> baseReq 12 */
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
    w32(ADDR_ITEMDATA1 + 0x00u, 2u);
    w32(ADDR_UNIT2 + 0x00u, 0u);
    w32(ADDR_UNIT2 + 0x04u, 2u);
    w32(ADDR_UNIT2 + 0xC8u, 0x02000000u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 2u * 0x1A8u);
    snap_add(&s, ADDR_MAGAFFIX_TXT, 3u * 0x90u);
    snap_add(&s, ADDR_SETITEMS_TXT, 2u * 0x1B8u);
    snap_add(&s, ADDR_UNIQUEITEMS_TXT, 2u * 0x14Cu);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t a0[2] = { ADDR_UNIT, ADDR_UNIT2 };
    uint32_t r0 = call_fastcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "normal_quality2_base_ret_12", a0, 2, 0xFFFFFFFFu, r0, &s);

    /* v1: quality 4 magic item with class-matching affix 2 -> 20 */
    w32(ADDR_ITEMDATA1 + 0x00u, 4u);
    w16(ADDR_ITEMDATA1 + 0x38u, 1u);
    w16(ADDR_ITEMDATA1 + 0x3Eu, 2u);
    w16(ADDR_ITEMDATA1 + 0x36u, 0u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 2u * 0x1A8u);
    snap_add(&s, ADDR_MAGAFFIX_TXT, 3u * 0x90u);
    snap_add(&s, ADDR_SETITEMS_TXT, 2u * 0x1B8u);
    snap_add(&s, ADDR_UNIQUEITEMS_TXT, 2u * 0x14Cu);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t r1 = call_fastcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "magic_quality4_class_match_ret_20", a0, 2, 0xFFFFFFFFu, r1, &s);

    /* v2: quality 5 set item -> 29 */
    w32(ADDR_ITEMDATA1 + 0x00u, 5u);
    w32(ADDR_ITEMDATA1 + 0x28u, 1u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 2u * 0x1A8u);
    snap_add(&s, ADDR_MAGAFFIX_TXT, 3u * 0x90u);
    snap_add(&s, ADDR_SETITEMS_TXT, 2u * 0x1B8u);
    snap_add(&s, ADDR_UNIQUEITEMS_TXT, 2u * 0x14Cu);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t r2 = call_fastcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "set_quality5_ret_29", a0, 2, 0xFFFFFFFFu, r2, &s);

    /* v3: quality 6 rare item non-matching class (unit class=1 vs affix class=2) -> 28 */
    w32(ADDR_ITEMDATA1 + 0x00u, 6u);
    w32(ADDR_UNIT2 + 0x04u, 1u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 2u * 0x1A8u);
    snap_add(&s, ADDR_MAGAFFIX_TXT, 3u * 0x90u);
    snap_add(&s, ADDR_SETITEMS_TXT, 2u * 0x1B8u);
    snap_add(&s, ADDR_UNIQUEITEMS_TXT, 2u * 0x14Cu);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t r3 = call_fastcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "rare_quality6_nonmatch_class_ret_28", a0, 2, 0xFFFFFFFFu, r3, &s);

    /* v4: quality 7 unique expansion -> 42 */
    w32(ADDR_ITEMDATA1 + 0x00u, 7u);
    w32(ADDR_ITEMDATA1 + 0x28u, 1u);
    w16(ADDR_ITEMDATA1 + 0x30u, 101u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 2u * 0x1A8u);
    snap_add(&s, ADDR_MAGAFFIX_TXT, 3u * 0x90u);
    snap_add(&s, ADDR_SETITEMS_TXT, 2u * 0x1B8u);
    snap_add(&s, ADDR_UNIQUEITEMS_TXT, 2u * 0x14Cu);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t r4 = call_fastcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "unique_quality7_expansion_ret_42", a0, 2, 0xFFFFFFFFu, r4, &s);

    /* v5: quality 7 unique classic pre-1.07 (dwFlags2=0, wItemFormat=0) -> skips unique wLvlReq, returns base 12 */
    w32(ADDR_UNIT2 + 0xC8u, 0u);
    w16(ADDR_ITEMDATA1 + 0x30u, 0u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 2u * 0x1A8u);
    snap_add(&s, ADDR_MAGAFFIX_TXT, 3u * 0x90u);
    snap_add(&s, ADDR_SETITEMS_TXT, 2u * 0x1B8u);
    snap_add(&s, ADDR_UNIQUEITEMS_TXT, 2u * 0x14Cu);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t r5 = call_fastcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "unique_quality7_classic_fmt0_ret_12", a0, 2, 0xFFFFFFFFu, r5, &s);

    /* v6: quality 8 crafted item capped at maxLvl - 1 (98) */
    w32(ADDR_ITEMDATA1 + 0x00u, 8u);
    w16(ADDR_ITEMDATA1 + 0x38u, 3u); /* affix 3 req 90 + 10 + 6 = 106 -> capped to 98 */
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 2u * 0x1A8u);
    snap_add(&s, ADDR_MAGAFFIX_TXT, 3u * 0x90u);
    snap_add(&s, ADDR_SETITEMS_TXT, 2u * 0x1B8u);
    snap_add(&s, ADDR_UNIQUEITEMS_TXT, 2u * 0x14Cu);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t r6 = call_fastcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "crafted_quality8_capped_ret_98", a0, 2, 0xFFFFFFFFu, r6, &s);

    /* v7: socketed child + oskill 0x61 cross-class (+6) + stat 0x5C delta */
    w32(ADDR_ITEMDATA1 + 0x00u, 2u);
    w32(ADDR_UNIT + 0x60u, ADDR_INV1);
    w32(ADDR_INV1 + 0x00u, 0x01020304u);
    w32(ADDR_INV1 + 0x0Cu, ADDR_UNIT3);
    w32(ADDR_UNIT3 + 0x00u, 4u);
    w32(ADDR_UNIT3 + 0x04u, 1u); /* base req 33 */
    w32(ADDR_UNIT3 + 0x14u, ADDR_ITEMDATA3);
    w32(ADDR_ITEMDATA3 + 0x00u, 2u);
    /* StatList on ADDR_UNIT: stat 0x5C = 4, stat 0x61 (param 1) = 2, stat 0x6B (param 1) = 1 */
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x08u, 4u);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x48u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x4Cu, 3u);
    w16(ADDR_STATLIST1 + 0x4Eu, 8u);
    w32(ADDR_STAT_ARR1 + 0u,  (0x5Cu << 16));      w32(ADDR_STAT_ARR1 + 4u,  4u);
    w32(ADDR_STAT_ARR1 + 8u,  (0x61u << 16) | 1u); w32(ADDR_STAT_ARR1 + 12u, 2u);
    w32(ADDR_STAT_ARR1 + 16u, (0x6Bu << 16) | 1u); w32(ADDR_STAT_ARR1 + 20u, 1u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 2u * 0x1A8u);
    snap_add(&s, ADDR_MAGAFFIX_TXT, 3u * 0x90u);
    snap_add(&s, ADDR_SETITEMS_TXT, 2u * 0x1B8u);
    snap_add(&s, ADDR_UNIQUEITEMS_TXT, 2u * 0x14Cu);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t r7 = call_fastcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "socketed_child_and_skills_delta_ret_37", a0, 2, 0xFFFFFFFFu, r7, &s);
  }

  /* 4. B1-04: 0x6FD7A3D0 ITEMS_AddSockets (stdcall pItem, nSockets -> void) */
  {
    const uint32_t va = 0x6FD7A3D0u;
    const char *nm = "ITEMS_AddSockets";

    /* v0: null item -> no-op */
    setup_base_tables();
    stage_core(&s);
    snap_capture(&s);
    uint32_t a0[2] = { 0u, 3u };
    call_stdcall2_void(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "null_item_noop_void", a0, 2, 0u, 0u, &s);

    /* v1: valid 2x3 item, nSockets=0 -> clamped to 1, ilvl 0 -> clamped to 1, sets 0x800 and stat 0xC2=1 */
    setup_base_tables();
    w8(ADDR_ITEMS_TXT + 0x10Fu, 2u); /* nInvWidth = 2 */
    w8(ADDR_ITEMS_TXT + 0x110u, 3u); /* nInvHeight = 3 */
    w16(ADDR_ITEMS_TXT + 0x11Eu, 0u); /* wType1 = 0 */
    w8(ADDR_ITEMS_TXT + 0x123u, 5u); /* nGemSockets = 5 */
    w8(ADDR_ITEMTYPES_TXT + 0x1Du, 4u); /* nMaxSock1 = 4 */
    w8(ADDR_ITEMTYPES_TXT + 0x1Eu, 5u); /* nMaxSock25 = 5 */
    w8(ADDR_ITEMTYPES_TXT + 0x1Fu, 6u); /* nMaxSock40 = 6 */
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_DATATABLES + 0xBD4u, 0u); /* skip propagate ISC lookup */
    w32(ADDR_STATLIST1 + 0x08u, 4u);
    w32(ADDR_STATLIST1 + 0x24u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x28u, 1u);
    w16(ADDR_STATLIST1 + 0x2Au, 4u);
    w32(ADDR_STAT_ARR1 + 0u, 0x00C20000u);
    w32(ADDR_STAT_ARR1 + 4u, 99u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 0xE4u);
    snap_capture(&s);
    uint32_t a1[2] = { ADDR_UNIT, 0u };
    call_stdcall2_void(va, a1[0], a1[1]);
    emit_line(fp, va, nm, "clamp_min1_and_ilvl1_void", a1, 2, 0u, 0u, &s);

    /* v2: nSockets=6 capped by nMaxSock1=4 (when ilvl=10) -> stat 0xC2=4 */
    w32(ADDR_ITEMDATA1 + 0x18u, 0u);
    w32(ADDR_ITEMDATA1 + 0x2Cu, 10u);
    w32(ADDR_STAT_ARR1 + 4u, 99u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 0xE4u);
    snap_capture(&s);
    uint32_t a2[2] = { ADDR_UNIT, 6u };
    call_stdcall2_void(va, a2[0], a2[1]);
    emit_line(fp, va, nm, "cap_by_maxsock4_void", a2, 2, 0u, 0u, &s);
  }

  /* 5. B1-05: 0x6FD97290 ITEMS_CraftModMakeEthereal (stdcall 9-arg -> eax) */
  {
    const uint32_t va = 0x6FD97290u;
    const char *nm = "ITEMS_CraftModMakeEthereal";
    uint32_t isc_ids[3] = { 0x1Fu, 0x49u, 0x98u };

    /* v0: bApply = 0 -> 0 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    stage_core(&s);
    snap_capture(&s);
    uint32_t a0[9] = { ADDR_UNIT, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u };
    uint32_t r0 = call_stdcall9(va, a0[0], a0[1], a0[2], a0[3], a0[4], a0[5], a0[6], a0[7], a0[8]);
    emit_line(fp, va, nm, "bApply_zero_ret_0", a0, 9, 0xFFFFFFFFu, r0, &s);

    /* v1: already ethereal -> 0 */
    w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
    w32(ADDR_ITEMDATA1 + 0x18u, 0x400000u);
    stage_core(&s);
    snap_capture(&s);
    uint32_t a1[9] = { ADDR_UNIT, 1u, 0u, 0u, 0u, 0u, 0u, 0u, 0u };
    uint32_t r1 = call_stdcall9(va, a1[0], a1[1], a1[2], a1[3], a1[4], a1[5], a1[6], a1[7], a1[8]);
    emit_line(fp, va, nm, "already_ethereal_ret_0", a1, 9, 0xFFFFFFFFu, r1, &s);

    /* v2: bNoDurability = 1 -> 0 */
    w32(ADDR_ITEMDATA1 + 0x18u, 0u);
    w32(ADDR_ITEMDATA1 + 0x00u, 2u);
    w8(ADDR_ITEMS_TXT + 0x112u, 20u);
    w8(ADDR_ITEMS_TXT + 0x113u, 1u);
    w8(ADDR_ITEMS_TXT + 0x11Du, 1u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_capture(&s);
    uint32_t r2 = call_stdcall9(va, a1[0], a1[1], a1[2], a1[3], a1[4], a1[5], a1[6], a1[7], a1[8]);
    emit_line(fp, va, nm, "nodurability_ret_0", a1, 9, 0xFFFFFFFFu, r2, &s);

    /* v3: valid armor -> sets 0x400000, scales stat 0x1F (100->150), and returns 1 */
    set_equiv_bit(1u, 0x32u);
    w8(ADDR_ITEMS_TXT + 0x112u, 20u);
    w8(ADDR_ITEMS_TXT + 0x113u, 0u);
    w8(ADDR_ITEMS_TXT + 0x11Du, 0u);
    w16(ADDR_ITEMS_TXT + 0x11Eu, 1u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x08u, 4u);
    w32(ADDR_STATLIST1 + 0x24u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x28u, 2u);
    w16(ADDR_STATLIST1 + 0x2Au, 4u);
    w32(ADDR_STAT_ARR1 + 0u,  0x1Fu << 16); w32(ADDR_STAT_ARR1 + 4u,  100u);
    w32(ADDR_STAT_ARR1 + 8u,  0x49u << 16); w32(ADDR_STAT_ARR1 + 12u, 20u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_EQUIV, 0x330u);
    stage_isc(&s, isc_ids, 3);
    snap_capture(&s);
    uint32_t r3 = call_stdcall9(va, a1[0], a1[1], a1[2], a1[3], a1[4], a1[5], a1[6], a1[7], a1[8]);
    emit_line(fp, va, nm, "valid_armor_ethereal_ret_1", a1, 9, 0xFFFFFFFFu, r3, &s);
  }

  /* 6. B1-06: 0x6FD81200 SKILLS_CanMonsterReviveInMode2 (fastcall ecx=nMonsterId -> eax) */
  {
    const uint32_t va = 0x6FD81200u;
    const char *nm = "SKILLS_CanMonsterReviveInMode2";
    setup_base_tables();
    /* Mon 0: mode2 flag clear -> 0 */
    w16(ADDR_MONSTATS_TXT + 0u * 0x1A8u + 0x18u, 0u);
    w32(ADDR_MONSTATS2_TXT + 0u * 0x134u + 0xF0u, 0u);
    /* Mon 1: mode2 set, bitfield1 bit6 (0x40) set -> 0 */
    w16(ADDR_MONSTATS_TXT + 1u * 0x1A8u + 0x18u, 1u);
    w8(ADDR_MONSTATS_TXT  + 1u * 0x1A8u + 0x0Cu, 0x40u);
    w8(ADDR_MONSTATS_TXT  + 1u * 0x1A8u + 0x0Eu, 0x01u);
    w32(ADDR_MONSTATS2_TXT + 1u * 0x134u + 0xF0u, 4u);
    /* Mon 2: mode2 set, bitfield1=0, bitfield3 bit0 clear -> 0 */
    w16(ADDR_MONSTATS_TXT + 2u * 0x1A8u + 0x18u, 1u);
    w8(ADDR_MONSTATS_TXT  + 2u * 0x1A8u + 0x0Cu, 0x00u);
    w8(ADDR_MONSTATS_TXT  + 2u * 0x1A8u + 0x0Eu, 0x02u);
    /* Mon 3: mode2 set, bitfield1=0x3F, bitfield3=0x01 -> 1 */
    w16(ADDR_MONSTATS_TXT + 3u * 0x1A8u + 0x18u, 1u);
    w8(ADDR_MONSTATS_TXT  + 3u * 0x1A8u + 0x0Cu, 0x3Fu);
    w8(ADDR_MONSTATS_TXT  + 3u * 0x1A8u + 0x0Eu, 0x01u);

    uint32_t ids[6] = { 0xFFFFFFFFu, 5u, 0u, 1u, 2u, 3u };
    const char *labels[6] = {
      "neg_id_ret_0", "ge_count_ret_0", "mode2_clear_ret_0",
      "bitfield1_bit6_set_ret_0", "bitfield3_bit0_clear_ret_0", "revivable_ret_1"
    };
    for (int i = 0; i < 6; i++) {
      stage_core(&s);
      snap_add(&s, ADDR_MONSTATS_TXT, 5u * 0x1A8u);
      snap_add(&s, ADDR_MONSTATS2_TXT, 2u * 0x134u);
      snap_capture(&s);
      uint32_t a[1] = { ids[i] };
      uint32_t r = call_fastcall1(va, a[0]);
      emit_line(fp, va, nm, labels[i], a, 1, 0xFFFFFFFFu, r, &s);
    }
  }

  /* 7. B1-07: 0x6FD9E750 SKILLS_CheckLineOfSight (stdcall x1, y1, x2, y2, pRoom, dwMask -> eax) */
  {
    const uint32_t va = 0x6FD9E750u;
    const char *nm = "SKILLS_CheckLineOfSight";
    setup_base_tables();
    w32(ADDR_ROOM1 + 0x20u, ADDR_COLLGRID);
    w32(ADDR_ROOM1 + 0x4Cu, 100u);
    w32(ADDR_ROOM1 + 0x50u, 100u);
    w32(ADDR_ROOM1 + 0x54u, 20u);
    w32(ADDR_ROOM1 + 0x58u, 20u);
    w32(ADDR_COLLGRID + 0x00u, 100u);
    w32(ADDR_COLLGRID + 0x04u, 100u);
    w32(ADDR_COLLGRID + 0x08u, 20u);
    w32(ADDR_COLLGRID + 0x0Cu, 20u);
    w32(ADDR_COLLGRID + 0x20u, ADDR_COLLMAP);
    /* Block cell (105, 105) with mask 0x0004 */
    w16(ADDR_COLLMAP + (5u * 20u + 5u) * 2u, 0x0004u);

    /* v0: clear path (mask 0x0001) -> 1 */
    stage_core(&s);
    snap_capture(&s);
    uint32_t a0[6] = { 102u, 102u, 108u, 108u, ADDR_ROOM1, 0x0001u };
    uint32_t r0 = call_stdcall6(va, a0[0], a0[1], a0[2], a0[3], a0[4], a0[5]);
    emit_line(fp, va, nm, "clear_ray_ret_1", a0, 6, 0xFFFFFFFFu, r0, &s);

    /* v1: blocked path (mask 0x0004 hits cell (105,105)) -> 0 */
    stage_core(&s);
    snap_capture(&s);
    uint32_t a1[6] = { 102u, 102u, 108u, 108u, ADDR_ROOM1, 0x0004u };
    uint32_t r1 = call_stdcall6(va, a1[0], a1[1], a1[2], a1[3], a1[4], a1[5]);
    emit_line(fp, va, nm, "blocked_ray_ret_0", a1, 6, 0xFFFFFFFFu, r1, &s);
  }

  /* 8. B1-08: 0x6FD9EBA0 SKILLS_GetShrineSkillBonus (stdcall pUnit -> eax) */
  {
    const uint32_t va = 0x6FD9EBA0u;
    const char *nm = "SKILLS_GetShrineSkillBonus";
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 0u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);

    /* v0: null unit -> 0 */
    stage_core(&s);
    snap_capture(&s);
    uint32_t a0[1] = { 0u };
    uint32_t r0 = call_stdcall1(va, a0[0]);
    emit_line(fp, va, nm, "null_unit_ret_0", a0, 1, 0xFFFFFFFFu, r0, &s);

    /* v1: state 0x86 (134: word 4, bit 6 = 0x40) active -> 2 */
    w32(ADDR_STATLIST1 + 0x64u + 4u * 4u, 0x40u);
    stage_core(&s);
    snap_capture(&s);
    uint32_t a1[1] = { ADDR_UNIT };
    uint32_t r1 = call_stdcall1(va, a1[0]);
    emit_line(fp, va, nm, "shrine_active_ret_2", a1, 1, 0xFFFFFFFFu, r1, &s);

    /* v2: unit type 2 (OBJECT) -> 0 */
    w32(ADDR_UNIT + 0x00u, 2u);
    stage_core(&s);
    snap_capture(&s);
    uint32_t r2 = call_stdcall1(va, a1[0]);
    emit_line(fp, va, nm, "object_unit_type2_ret_0", a1, 1, 0xFFFFFFFFu, r2, &s);
  }

  /* 9. B1-09: 0x6FD9EC50 SKILLS_GetUnitSkillRequiredOrMonLevel (fastcall ecx=pUnit, edx=pSkill -> eax) */
  {
    const uint32_t va = 0x6FD9EC50u;
    const char *nm = "SKILLS_GetUnitSkillRequiredOrMonLevel";
    setup_base_tables();
    w32(ADDR_SKILL0 + 0x00u, ADDR_SKILLS_TXT);
    w16(ADDR_SKILLS_TXT + 0x00u, 42u);
    w8(ADDR_SKILLS_TXT + 0x13u, 7u);
    w16(ADDR_MONSTATS_TXT + 0x170u + 3u * 2u, 42u);
    w16(ADDR_MONSTATS_TXT + 0x188u + 3u * 2u, 14u);

    /* v0: null unit -> 0 */
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 0x23Cu);
    snap_add(&s, ADDR_MONSTATS_TXT, 0x1A8u);
    snap_capture(&s);
    uint32_t a0[2] = { 0u, ADDR_SKILL0 };
    uint32_t r0 = call_fastcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "null_unit_ret_0", a0, 2, 0xFFFFFFFFu, r0, &s);

    /* v1: player returns SkillsTxt+0x13 (7) */
    w32(ADDR_UNIT + 0x00u, 0u);
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 0x23Cu);
    snap_add(&s, ADDR_MONSTATS_TXT, 0x1A8u);
    snap_capture(&s);
    uint32_t a1[2] = { ADDR_UNIT, ADDR_SKILL0 };
    uint32_t r1 = call_fastcall2(va, a1[0], a1[1]);
    emit_line(fp, va, nm, "player_seqnum_ret_7", a1, 2, 0xFFFFFFFFu, r1, &s);

    /* v2: monster matched slot 3 -> 14 */
    w32(ADDR_UNIT + 0x00u, 1u);
    w32(ADDR_UNIT + 0x04u, 0u);
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 0x23Cu);
    snap_add(&s, ADDR_MONSTATS_TXT, 0x1A8u);
    snap_capture(&s);
    uint32_t r2 = call_fastcall2(va, a1[0], a1[1]);
    emit_line(fp, va, nm, "monster_slot3_ret_14", a1, 2, 0xFFFFFFFFu, r2, &s);

    /* v3: monster skill 0xC7 (199) -> 0 */
    w16(ADDR_SKILLS_TXT + 0x00u, 0xC7u);
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 0x23Cu);
    snap_add(&s, ADDR_MONSTATS_TXT, 0x1A8u);
    snap_capture(&s);
    uint32_t r3 = call_fastcall2(va, a1[0], a1[1]);
    emit_line(fp, va, nm, "monster_skill_199_ret_0", a1, 2, 0xFFFFFFFFu, r3, &s);
  }

  /* 10. B1-10: 0x6FD9F120 SKILLS_IsUnitPosNotInTown (eax=pUnit, ebx=nX, edi=nY -> eax) */
  {
    const uint32_t va = 0x6FD9F120u;
    const char *nm = "SKILLS_IsUnitPosNotInTown";
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 0u);
    w32(ADDR_UNIT + 0x2Cu, ADDR_PATH1);
    w32(ADDR_PATH1 + 0x1Cu, ADDR_ROOM1);
    w32(ADDR_ROOM1 + 0x10u, ADDR_ROOMEX1);
    w32(ADDR_ROOM1 + 0x4Cu, 100u);
    w32(ADDR_ROOM1 + 0x50u, 100u);
    w32(ADDR_ROOM1 + 0x54u, 20u);
    w32(ADDR_ROOM1 + 0x58u, 20u);
    w32(ADDR_ROOMEX1 + 0x58u, ADDR_LEVEL);

    /* v0: town level 1 -> 0 */
    w32(ADDR_LEVEL + 0x1D0u, 1u);
    stage_core(&s);
    snap_capture(&s);
    uint32_t a0[3] = { ADDR_UNIT, 105u, 105u };
    uint32_t r0 = call_eax_ebx_edi_ret(va, a0[0], a0[1], a0[2]);
    emit_line(fp, va, nm, "town_level1_ret_0", a0, 3, 0xFFFFFFFFu, r0, &s);

    /* v1: blood moor level 2 -> 1 */
    w32(ADDR_LEVEL + 0x1D0u, 2u);
    stage_core(&s);
    snap_capture(&s);
    uint32_t r1 = call_eax_ebx_edi_ret(va, a0[0], a0[1], a0[2]);
    emit_line(fp, va, nm, "wilderness_level2_ret_1", a0, 3, 0xFFFFFFFFu, r1, &s);

    /* v2: pos outside room -> 0 */
    stage_core(&s);
    snap_capture(&s);
    uint32_t a2[3] = { ADDR_UNIT, 50u, 50u };
    uint32_t r2 = call_eax_ebx_edi_ret(va, a2[0], a2[1], a2[2]);
    emit_line(fp, va, nm, "outside_room_ret_0", a2, 3, 0xFFFFFFFFu, r2, &s);
  }

  /* 11. B1-11: 0x6FD9F590 SKILLS_CheckSkillStateRestriction (eax=pSkill, ebx=pUnit -> eax) */
  {
    const uint32_t va = 0x6FD9F590u;
    const char *nm = "SKILLS_CheckSkillStateRestriction";
    setup_base_tables();
    w32(ADDR_SKILL0 + 0x00u, ADDR_SKILLS_TXT);
    w32(ADDR_UNIT + 0x00u, 0u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);

    /* v0: restrict 0, no active state mask -> 1 */
    w8(ADDR_SKILLS_TXT + 0x228u, 0u);
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 0x23Cu);
    snap_capture(&s);
    uint32_t a0[2] = { ADDR_SKILL0, ADDR_UNIT };
    uint32_t r0 = call_eax_ebx_ret(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "restrict0_no_state_ret_1", a0, 2, 0xFFFFFFFFu, r0, &s);

    /* v1: restrict 0, active state in fStateMasks -> 0 */
    w32(ADDR_STATLIST1 + 0x64u, 0x20u); /* state 5 active */
    w32(ADDR_STATE_FLAGS, 0x20u);
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 0x23Cu);
    snap_capture(&s);
    uint32_t r1 = call_eax_ebx_ret(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "restrict0_active_state_ret_0", a0, 2, 0xFFFFFFFFu, r1, &s);

    /* v2: restrict 2, wState[0]=1, wState[1]=5 (active) -> 1 */
    w8(ADDR_SKILLS_TXT + 0x228u, 2u);
    w16(ADDR_SKILLS_TXT + 0x22Au, 1u);
    w16(ADDR_SKILLS_TXT + 0x22Cu, 5u);
    w16(ADDR_SKILLS_TXT + 0x22Eu, 0xFFFFu);
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 0x23Cu);
    snap_capture(&s);
    uint32_t r2 = call_eax_ebx_ret(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "restrict2_matched_state5_ret_1", a0, 2, 0xFFFFFFFFu, r2, &s);

    /* v3: restrict 2, wState[0]=-1 early break -> 0 */
    w16(ADDR_SKILLS_TXT + 0x22Au, 0xFFFFu);
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 0x23Cu);
    snap_capture(&s);
    uint32_t r3 = call_eax_ebx_ret(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "restrict2_neg_slot0_ret_0", a0, 2, 0xFFFFFFFFu, r3, &s);
  }

  /* 12. B1-12: 0x6FD9F610 SKILLS_AssignItemChargedSkillStdcall (stdcall 6-arg -> void) */
  {
    const uint32_t va = 0x6FD9F610u;
    const char *nm = "SKILLS_AssignItemChargedSkillStdcall";
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 0u);
    w32(ADDR_UNIT + 0xA8u, ADDR_SKILL_LIST);
    w32(ADDR_SKILL_LIST + 0x04u, ADDR_SKILL0);
    w32(ADDR_SKILL_LIST + 0x08u, ADDR_SKILL1);
    w32(ADDR_SKILL_LIST + 0x0Cu, ADDR_SKILL1);
    w32(ADDR_SKILL1 + 0x00u, ADDR_SKILLS_TXT);
    w16(ADDR_SKILLS_TXT, 0u);
    w32(ADDR_SKILL0 + 0x00u, ADDR_SKILLS_TXT + 2u * 0x23Cu);
    w16(ADDR_SKILLS_TXT + 2u * 0x23Cu, 2u);
    w32(ADDR_SKILL0 + 0x34u, 0x55u);

    /* v0: null unit -> void */
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 3u * 0x23Cu);
    snap_capture(&s);
    uint32_t a0[6] = { 0u, 0x55u, 2u, 4u, 10u, 0u };
    uint32_t r0 = call_stdcall6(va, a0[0], a0[1], a0[2], a0[3], a0[4], a0[5]);
    emit_line(fp, va, nm, "null_unit_noop", a0, 6, 0u, r0, &s);

    /* v1: update existing skill -> void */
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 3u * 0x23Cu);
    snap_capture(&s);
    uint32_t a1[6] = { ADDR_UNIT, 0x55u, 2u, 4u, 10u, 0u };
    uint32_t r1 = call_stdcall6(va, a1[0], a1[1], a1[2], a1[3], a1[4], a1[5]);
    emit_line(fp, va, nm, "update_existing_charged", a1, 6, 0u, r1, &s);

    /* v2: remove existing charged skill (bRemove=1) -> void */
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 3u * 0x23Cu);
    snap_capture(&s);
    uint32_t a2[6] = { ADDR_UNIT, 0x55u, 2u, 4u, 10u, 1u };
    uint32_t r2 = call_stdcall6(va, a2[0], a2[1], a2[2], a2[3], a2[4], a2[5]);
    emit_line(fp, va, nm, "remove_existing_charged", a2, 6, 0u, r2, &s);
  }

  /* 13. B1-13: 0x6FD9FDC0 SKILLS_CheckSkillStartMana (stdcall pUnit, pSkill -> eax) */
  {
    const uint32_t va = 0x6FD9FDC0u;
    const char *nm = "SKILLS_CheckSkillStartMana";
    uint32_t isc_ids[1] = { 8u };
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 0u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x48u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x4Cu, 1u);
    w16(ADDR_STATLIST1 + 0x4Eu, 4u);
    w32(ADDR_STAT_ARR1 + 0u, 8u << 16);
    w32(ADDR_STAT_ARR1 + 4u, 1000u);
    w32(ADDR_SKILL0 + 0x00u, ADDR_SKILLS_TXT);
    w16(ADDR_SKILLS_TXT + 0x184u, 5u); /* wStartMana = 5 (5<<8 = 1280) */

    /* v0: insufficient mana (1000 < 1280) and no state 12 -> 0 */
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t a0[2] = { ADDR_UNIT, ADDR_SKILL0 };
    uint32_t r0 = call_stdcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "insufficient_mana_ret_0", a0, 2, 0xFFFFFFFFu, r0, &s);

    /* v1: state 12 (inferno) active -> 1 */
    w32(ADDR_STATLIST1 + 0x64u, 1u << 12);
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t r1 = call_stdcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "state12_inferno_override_ret_1", a0, 2, 0xFFFFFFFFu, r1, &s);

    /* v2: sufficient mana (1280 >= 1280) -> 1 */
    w32(ADDR_STATLIST1 + 0x64u, 0u);
    w32(ADDR_STAT_ARR1 + 4u, 1280u);
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t r2 = call_stdcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "sufficient_mana_1280_ret_1", a0, 2, 0xFFFFFFFFu, r2, &s);
  }

  /* 14. B1-14: 0x6FDA0610 SKILLS_CheckWeaponPairMatchesSkill (eax=nSlotIdx, [esp+4]=pPrimary, [esp+8]=pSecondary, [esp+0xC]=pSkillsTxt -> eax) */
  {
    const uint32_t va = 0x6FDA0610u;
    const char *nm = "SKILLS_CheckWeaponPairMatchesSkill";
    uint32_t isc_ids[2] = { 0x46u, 0x9Du };
    setup_base_tables();
    set_equiv_bit(1u, 0x2Du); /* type 1 = melee sword */
    set_equiv_bit(2u, 0x2Du); /* type 2 = bow (wQuiver = 3) */
    set_equiv_bit(3u, 3u);    /* type 3 = arrow quiver */
    w16(ADDR_ITEMS_TXT + 0u * 0x1A8u + 0x11Eu, 1u);
    w16(ADDR_ITEMS_TXT + 1u * 0x1A8u + 0x11Eu, 2u);
    w16(ADDR_ITEMS_TXT + 2u * 0x1A8u + 0x11Eu, 3u);
    w8(ADDR_ITEMS_TXT + 2u * 0x1A8u + 0x131u, 1u); /* stackable */
    w32(ADDR_ITEMS_TXT + 2u * 0x1A8u + 0xE8u, 250u); /* dwMaxStack (+0xE8) */
    w16(ADDR_ITEMTYPES_TXT + 2u * 0xE4u + 0x0Cu, 3u); /* bow wQuiver = 3 */

    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
    w32(ADDR_UNIT2 + 0x00u, 4u);
    w32(ADDR_UNIT2 + 0x04u, 1u); /* bow */
    w32(ADDR_UNIT2 + 0x14u, ADDR_ITEMDATA2);
    w32(ADDR_UNIT3 + 0x00u, 4u);
    w32(ADDR_UNIT3 + 0x04u, 2u); /* quiver */
    w32(ADDR_UNIT3 + 0x14u, ADDR_ITEMDATA3);
    w32(ADDR_UNIT3 + 0x5Cu, ADDR_STATLIST3);
    w32(ADDR_STATLIST3 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST3 + 0x48u, ADDR_STAT_ARR3);
    w16(ADDR_STATLIST3 + 0x4Cu, 1u);
    w16(ADDR_STATLIST3 + 0x4Eu, 4u);
    w32(ADDR_STAT_ARR3 + 0u, 0x46u << 16);
    w32(ADDR_STAT_ARR3 + 4u, 5u);

    /* v0: unarmed punch allowed when wITypeA1=0x2D, wITypeB1=0, pSecondary=0 -> 1 */
    w16(ADDR_SKILLS_TXT + 0x00u, 1u);
    w16(ADDR_SKILLS_TXT + 0x18u, 0x2Du);
    w16(ADDR_SKILLS_TXT + 0x1Eu, 0u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 3u * 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 4u * 0xE4u);
    snap_add(&s, ADDR_ITEMTYPES_EQUIV, 0x330u);
    snap_add(&s, ADDR_SKILLS_TXT, 0x23Cu);
    stage_isc(&s, isc_ids, 2);
    snap_capture(&s);
    uint32_t a0[4] = { 0u, 0u, 0u, ADDR_SKILLS_TXT };
    uint32_t r0 = call_eax_stack3_ret12(va, a0[0], a0[1], a0[2], a0[3]);
    emit_line(fp, va, nm, "unarmed_punch_no_secondary_ret_1", a0, 4, 0xFFFFFFFFu, r0, &s);

    /* v1: unarmed blocked when pSecondary is a weapon -> 0 */
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 3u * 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 4u * 0xE4u);
    snap_add(&s, ADDR_ITEMTYPES_EQUIV, 0x330u);
    snap_add(&s, ADDR_SKILLS_TXT, 0x23Cu);
    stage_isc(&s, isc_ids, 2);
    snap_capture(&s);
    uint32_t a1[4] = { 0u, 0u, ADDR_UNIT, ADDR_SKILLS_TXT };
    uint32_t r1 = call_eax_stack3_ret12(va, a1[0], a1[1], a1[2], a1[3]);
    emit_line(fp, va, nm, "unarmed_blocked_by_secondary_ret_0", a1, 4, 0xFFFFFFFFu, r1, &s);

    /* v2: bow + quiver with quantity 5 > 0 -> 1 */
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 3u * 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 4u * 0xE4u);
    snap_add(&s, ADDR_ITEMTYPES_EQUIV, 0x330u);
    snap_add(&s, ADDR_SKILLS_TXT, 0x23Cu);
    stage_isc(&s, isc_ids, 2);
    snap_capture(&s);
    uint32_t a2[4] = { 0u, ADDR_UNIT2, ADDR_UNIT3, ADDR_SKILLS_TXT };
    uint32_t r2 = call_eax_stack3_ret12(va, a2[0], a2[1], a2[2], a2[3]);
    emit_line(fp, va, nm, "bow_with_quiver_qty5_ret_1", a2, 4, 0xFFFFFFFFu, r2, &s);

    /* v3: bow + quiver with quantity 0 -> 0 */
    w32(ADDR_STAT_ARR3 + 4u, 0u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 3u * 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 4u * 0xE4u);
    snap_add(&s, ADDR_ITEMTYPES_EQUIV, 0x330u);
    snap_add(&s, ADDR_SKILLS_TXT, 0x23Cu);
    stage_isc(&s, isc_ids, 2);
    snap_capture(&s);
    uint32_t r3 = call_eax_stack3_ret12(va, a2[0], a2[1], a2[2], a2[3]);
    emit_line(fp, va, nm, "bow_with_quiver_qty0_ret_0", a2, 4, 0xFFFFFFFFu, r3, &s);
  }

  /* 15. B1-15: 0x6FDA0930 SKILLS_CheckSkillWeaponAndQuantity (ecx=pSkill, [esp+4]=pUnit -> eax, ret 4) */
  {
    const uint32_t va = 0x6FDA0930u;
    const char *nm = "SKILLS_CheckSkillWeaponAndQuantity";
    uint32_t isc_ids[1] = { 0x7Du };
    setup_base_tables();
    set_equiv_bit(1u, 0x2Du);
    w16(ADDR_ITEMS_TXT + 0u * 0x1A8u + 0x11Eu, 1u);
    w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x10u, 1u); /* nNormal (bThrowable) = 1 */

    w32(ADDR_UNIT + 0x00u, 0u);
    w32(ADDR_UNIT + 0x04u, 4u); /* Barbarian (canDualWield=1) */
    w32(ADDR_UNIT + 0x60u, ADDR_INV1);
    w32(ADDR_INV1 + 0x00u, 0x01020304u);
    w32(ADDR_INV1 + 0x14u, ADDR_GRID_ARR);
    w32(ADDR_INV1 + 0x18u, 1u);
    w32(ADDR_INV1 + 0x1Cu, 0x77u); /* dwLeftItemGuid == ADDR_UNIT2->dwUnitId */
    w8(ADDR_GRID_ARR + 0x08u, 10u);
    w8(ADDR_GRID_ARR + 0x09u, 1u);
    w32(ADDR_GRID_ARR + 0x0Cu, ADDR_GRID_ITEMS);
    w32(ADDR_GRID_ITEMS + 0x10u, ADDR_UNIT2); /* right arm slot 4 */
    w32(ADDR_UNIT2 + 0x00u, 4u);
    w32(ADDR_UNIT2 + 0x04u, 0u);
    w32(ADDR_UNIT2 + 0x0Cu, 0x77u);
    w32(ADDR_UNIT2 + 0x14u, ADDR_ITEMDATA2);
    w32(ADDR_SKILL0 + 0x00u, ADDR_SKILLS_TXT);

    /* v0: decquant flag set (bFlags4 & 0x10), nQuantity = 0 -> 0 */
    w8(ADDR_SKILLS_TXT + 0x08u, 0x10u);
    w32(ADDR_SKILL0 + 0x30u, 0u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 2u * 0xE4u);
    snap_add(&s, ADDR_ITEMTYPES_EQUIV, 0x330u);
    snap_add(&s, ADDR_SKILLS_TXT, 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t a0[2] = { ADDR_SKILL0, ADDR_UNIT };
    uint32_t r0 = call_fastcall3_ecx_stack1(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "decquant_zero_qty_ret_0", a0, 2, 0xFFFFFFFFu, r0, &s);

    /* v1: decquant flag set, nQuantity = 3 -> 1 */
    w32(ADDR_SKILL0 + 0x30u, 3u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 2u * 0xE4u);
    snap_add(&s, ADDR_ITEMTYPES_EQUIV, 0x330u);
    snap_add(&s, ADDR_SKILLS_TXT, 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t r1 = call_fastcall3_ecx_stack1(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "decquant_pos_qty_ret_1", a0, 2, 0xFFFFFFFFu, r1, &s);

    /* v2: skill 2 (Throw) with throwable right weapon -> 1 */
    w8(ADDR_SKILLS_TXT + 0x08u, 0u);
    w16(ADDR_SKILLS_TXT + 0x00u, 2u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 2u * 0xE4u);
    snap_add(&s, ADDR_ITEMTYPES_EQUIV, 0x330u);
    snap_add(&s, ADDR_SKILLS_TXT, 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t r2 = call_fastcall3_ecx_stack1(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "skill2_throw_throwable_ret_1", a0, 2, 0xFFFFFFFFu, r2, &s);
  }

  /* 16. B1-16: 0x6FDA0C30 SKILLS_EvalUnitStatFormulaHelper (fastcall ecx=nStatId, edx=nMode, [esp+4]=_u, [esp+8]=ppUnit -> eax) */
  {
    const uint32_t va = 0x6FDA0C30u;
    const char *nm = "SKILLS_EvalUnitStatFormulaHelper";
    uint32_t isc_ids[3] = { 2u, 7u, 0x13u };
    setup_base_tables();
    w32(ADDR_SCRATCH, ADDR_UNIT);
    w32(ADDR_UNIT + 0x00u, 0u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x24u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x28u, 1u);
    w16(ADDR_STATLIST1 + 0x2Au, 4u);
    w32(ADDR_STAT_ARR1 + 0u, 7u << 16);
    w32(ADDR_STAT_ARR1 + 4u, 15u);
    w32(ADDR_STATLIST1 + 0x48u, ADDR_STAT_ARR2);
    w16(ADDR_STATLIST1 + 0x4Cu, 2u);
    w16(ADDR_STATLIST1 + 0x4Eu, 4u);
    w32(ADDR_STAT_ARR2 + 0u, 2u << 16);
    w32(ADDR_STAT_ARR2 + 4u, 10u);
    w32(ADDR_STAT_ARR2 + 8u, 7u << 16);
    w32(ADDR_STAT_ARR2 + 12u, 42u);
    w32(ADDR_CHARSTATS_TXT + 0x3Cu, 20u); /* nToHitFactor (+0x3C) = 20 */

    /* v0: mode 0 total stat 7 -> 42 */
    stage_core(&s);
    snap_add(&s, ADDR_CHARSTATS_TXT, 0xC4u);
    stage_isc(&s, isc_ids, 3);
    snap_capture(&s);
    uint32_t a0[4] = { 7u, 0u, 0u, ADDR_SCRATCH };
    uint32_t r0 = call_fastcall4(va, a0[0], a0[1], a0[2], a0[3]);
    emit_line(fp, va, nm, "mode0_total_stat7_ret_42", a0, 4, 0xFFFFFFFFu, r0, &s);

    /* v1: mode 1 base stat 7 -> 15 */
    stage_core(&s);
    snap_add(&s, ADDR_CHARSTATS_TXT, 0xC4u);
    stage_isc(&s, isc_ids, 3);
    snap_capture(&s);
    uint32_t a1[4] = { 7u, 1u, 0u, ADDR_SCRATCH };
    uint32_t r1 = call_fastcall4(va, a1[0], a1[1], a1[2], a1[3]);
    emit_line(fp, va, nm, "mode1_base_stat7_ret_15", a1, 4, 0xFFFFFFFFu, r1, &s);

    /* v2: stat 0x13 (tohit) -> 0 + 10*5 - 35 + 20 = 35 */
    stage_core(&s);
    snap_add(&s, ADDR_CHARSTATS_TXT, 0xC4u);
    stage_isc(&s, isc_ids, 3);
    snap_capture(&s);
    uint32_t a2[4] = { 0x13u, 0u, 0u, ADDR_SCRATCH };
    uint32_t r2 = call_fastcall4(va, a2[0], a2[1], a2[2], a2[3]);
    emit_line(fp, va, nm, "stat19_player_base_tohit_ret_35", a2, 4, 0xFFFFFFFFu, r2, &s);
  }

  /* 17. B1-17: 0x6FDA0CB0 SKILLS_EvalUnitRandFormulaHelper (fastcall ecx=nMin, edx=nMax, [esp+4]=_u, [esp+8]=ppUnit -> eax) */
  {
    const uint32_t va = 0x6FDA0CB0u;
    const char *nm = "SKILLS_EvalUnitRandFormulaHelper";
    setup_base_tables();
    w32(ADDR_SCRATCH, ADDR_UNIT);
    w32(ADDR_UNIT + 0x20u, 0x12345678u);
    w32(ADDR_UNIT + 0x24u, 0x000006ACu);

    /* v0: null ppUnit -> 0 */
    stage_core(&s);
    snap_capture(&s);
    uint32_t a0[4] = { 5u, 20u, 0u, 0u };
    uint32_t r0 = call_fastcall4(va, a0[0], a0[1], a0[2], a0[3]);
    emit_line(fp, va, nm, "null_ppunit_ret_0", a0, 4, 0xFFFFFFFFu, r0, &s);

    /* v1: roll [5, 20] on unit seed */
    stage_core(&s);
    snap_capture(&s);
    uint32_t a1[4] = { 5u, 20u, 0u, ADDR_SCRATCH };
    uint32_t r1 = call_fastcall4(va, a1[0], a1[1], a1[2], a1[3]);
    emit_line(fp, va, nm, "roll_range_5_20", a1, 4, 0xFFFFFFFFu, r1, &s);
  }

  /* 18. B1-18: 0x6FDCEB40 DRLGOUTWILD_PlaceRandomRiverBridge (ebx=nGridX, edi=pLevel -> void) */
  {
    const uint32_t va = 0x6FDCEB40u;
    const char *nm = "DRLGOUTWILD_PlaceRandomRiverBridge";
    setup_base_tables();
    w32(VA_LVLPREST_PTR, ADDR_LVLPREST_LOW - 26u * 0x1B0u);
    /* Preset 28 (0x1C): nSizeX=8, nSizeY=8 -> 1x1 cell */
    w32(ADDR_LVLPREST_LOW + 2u * 0x1B0u + 0x28u, 8u);
    w32(ADDR_LVLPREST_LOW + 2u * 0x1B0u + 0x2Cu, 8u);

    /* v0: span <= 0 (nGridHeight = 2) -> early return */
    setup_drlg_grid_fixture(6u, 2u, 2u, 0u);
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_add(&s, ADDR_LVLPREST_LOW, 3u * 0x1B0u);
    snap_capture(&s);
    uint32_t a0[2] = { 2u, ADDR_LEVEL };
    call_ebx_edi_void(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "height2_span0_noop_void", a0, 2, 0u, 0u, &s);

    /* v1: height=4 (span=2), row 1 & 2 valid river cells ((cell2>>16)&0xF == 3), flag04=0 -> places bridge with pick 1 & 2 */
    setup_drlg_grid_fixture(6u, 4u, 2u, 0u);
    for (uint32_t y = 1u; y <= 2u; y++) {
      w32(ADDR_GRID2_CELLS + (y * 16u + 2u) * 4u, 0x00030000u);
      w32(ADDR_GRID2_CELLS + (y * 16u + 3u) * 4u, 0x00030000u);
    }
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_add(&s, ADDR_LVLPREST_LOW, 3u * 0x1B0u);
    snap_capture(&s);
    call_ebx_edi_void(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "places_bridge_flag0_pick2_void", a0, 2, 0u, 0u, &s);

    /* v2: flag04=4 -> places bridge with pick 1 & 3 even when gx+2 has 0x1B81 set */
    setup_drlg_grid_fixture(6u, 4u, 2u, 4u);
    for (uint32_t y = 1u; y <= 2u; y++) {
      w32(ADDR_GRID2_CELLS + (y * 16u + 2u) * 4u, 0x00030000u);
      w32(ADDR_GRID2_CELLS + (y * 16u + 3u) * 4u, 0x00030000u);
      w32(ADDR_GRID2_CELLS + (y * 16u + 4u) * 4u, 0x00000001u); /* blocked at gx+2, ignored when flag04 != 0 */
    }
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_add(&s, ADDR_LVLPREST_LOW, 3u * 0x1B0u);
    snap_capture(&s);
    call_ebx_edi_void(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "places_bridge_flag4_pick3_void", a0, 2, 0u, 0u, &s);
  }
}

/* =========================================================================
 * Batch I10B-2 (17 functions: B2-01 .. B2-17)
 * ========================================================================= */
static void emit_i10b_2(FILE *fp) {
  Snap s = {0};

  /* 1. B2-01: 0x6FD76DB0 ITEMS_CheckRequirements (stdcall pItem, pUnit, bEquip, pOutStr, pOutDex, pOutLvl -> eax) */
  {
    const uint32_t va = 0x6FD76DB0u;
    const char *nm = "ITEMS_CheckRequirements";
    uint32_t isc_ids[4] = { 0u, 2u, 0x0Cu, 0x5Bu };
    setup_base_tables();
    w16(ADDR_ITEMS_TXT + 0x10Au, 50u); /* wReqStr = 50 */
    w16(ADDR_ITEMS_TXT + 0x10Cu, 40u); /* wReqDex = 40 */
    w8(ADDR_ITEMS_TXT  + 0xFFu,  10u); /* nItemLevelReq = 10 */
    w16(ADDR_ITEMS_TXT + 0x11Eu, 1u);  /* wType[0] = 1 */
    w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x1Cu, 7u); /* nClass = 7 (any class) */

    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
    w32(ADDR_ITEMDATA1 + 0x04u, 2u); /* normal quality */
    w32(ADDR_ITEMDATA1 + 0x18u, 0x10u); /* identified */

    w32(ADDR_UNIT2 + 0x00u, 0u);
    w32(ADDR_UNIT2 + 0x04u, 0u);
    w32(ADDR_UNIT2 + 0x5Cu, ADDR_STATLIST2);
    w32(ADDR_STATLIST2 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST2 + 0x48u, ADDR_STAT_ARR2);
    w16(ADDR_STATLIST2 + 0x4Cu, 3u);
    w16(ADDR_STATLIST2 + 0x4Eu, 4u);
    w32(ADDR_STAT_ARR2 + 0u,  0u << 16);    w32(ADDR_STAT_ARR2 + 4u,  60u); /* str=60 */
    w32(ADDR_STAT_ARR2 + 8u,  2u << 16);    w32(ADDR_STAT_ARR2 + 12u, 50u); /* dex=50 */
    w32(ADDR_STAT_ARR2 + 16u, 0x0Cu << 16); w32(ADDR_STAT_ARR2 + 20u, 20u); /* lvl=20 */

    /* v0: null item zeroes out-pointers and returns 0 */
    w32(ADDR_SCRATCH + 0u, 99u);
    w32(ADDR_SCRATCH + 4u, 99u);
    w32(ADDR_SCRATCH + 8u, 99u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 2u * 0xE4u);
    stage_isc(&s, isc_ids, 4);
    snap_capture(&s);
    uint32_t a0[6] = { 0u, ADDR_UNIT2, 0u, ADDR_SCRATCH, ADDR_SCRATCH + 4u, ADDR_SCRATCH + 8u };
    uint32_t r0 = call_stdcall6(va, a0[0], a0[1], a0[2], a0[3], a0[4], a0[5]);
    emit_line(fp, va, nm, "null_item_zeroes_outs_ret_0", a0, 6, 0xFFFFFFFFu, r0, &s);

    /* v1: all requirements met (str=60>=50, dex=50>=40, lvl=20>=10, identified, class=7) -> 1 */
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 2u * 0xE4u);
    stage_isc(&s, isc_ids, 4);
    snap_capture(&s);
    uint32_t a1[6] = { ADDR_UNIT, ADDR_UNIT2, 0u, ADDR_SCRATCH, ADDR_SCRATCH + 4u, ADDR_SCRATCH + 8u };
    uint32_t r1 = call_stdcall6(va, a1[0], a1[1], a1[2], a1[3], a1[4], a1[5]);
    emit_line(fp, va, nm, "all_reqs_met_ret_1", a1, 6, 0xFFFFFFFFu, r1, &s);

    /* v2: insufficient str (str=30 < 50) -> 0 (outStr=0, outDex=1, outLvl=1) */
    w32(ADDR_STAT_ARR2 + 4u, 30u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 2u * 0xE4u);
    stage_isc(&s, isc_ids, 4);
    snap_capture(&s);
    uint32_t r2 = call_stdcall6(va, a1[0], a1[1], a1[2], a1[3], a1[4], a1[5]);
    emit_line(fp, va, nm, "low_str_ret_0", a1, 6, 0xFFFFFFFFu, r2, &s);

    /* v3: ethereal item (-10 str/dex req -> strReq=40) with str=42 -> 1 */
    w32(ADDR_STAT_ARR2 + 4u, 42u);
    w32(ADDR_ITEMDATA1 + 0x18u, 0x400010u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 2u * 0xE4u);
    stage_isc(&s, isc_ids, 4);
    snap_capture(&s);
    uint32_t r3 = call_stdcall6(va, a1[0], a1[1], a1[2], a1[3], a1[4], a1[5]);
    emit_line(fp, va, nm, "ethereal_reduced_req_ret_1", a1, 6, 0xFFFFFFFFu, r3, &s);
  }

  /* 2. B2-02: 0x6FD787D0 ITEMS_CanUseCharmInInventory (stdcall pItem, pUnit -> eax) */
  {
    const uint32_t va = 0x6FD787D0u;
    const char *nm = "ITEMS_CanUseCharmInInventory";
    uint32_t isc_ids[4] = { 0u, 2u, 0x0Cu, 0x5Bu };
    setup_base_tables();
    set_equiv_bit(0x0Du, 0x0Du);
    w16(ADDR_ITEMS_TXT + 0x11Eu, 0x0Du); /* type 0x0D = charm */
    w8(ADDR_ITEMS_TXT  + 0xFFu,  5u);
    w8(ADDR_ITEMTYPES_TXT + 0x0Du * 0xE4u + 0x1Cu, 7u);

    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
    w32(ADDR_ITEMDATA1 + 0x04u, 2u);
    w32(ADDR_ITEMDATA1 + 0x18u, 0x10u); /* identified */
    w8(ADDR_ITEMDATA1 + 0x45u, 0u);     /* nInvPage = 0 */

    w32(ADDR_UNIT2 + 0x00u, 0u);
    w32(ADDR_UNIT2 + 0x5Cu, ADDR_STATLIST2);
    w32(ADDR_STATLIST2 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST2 + 0x48u, ADDR_STAT_ARR2);
    w16(ADDR_STATLIST2 + 0x4Cu, 3u);
    w16(ADDR_STATLIST2 + 0x4Eu, 4u);
    w32(ADDR_STAT_ARR2 + 0u,  0u << 16);    w32(ADDR_STAT_ARR2 + 4u,  20u);
    w32(ADDR_STAT_ARR2 + 8u,  2u << 16);    w32(ADDR_STAT_ARR2 + 12u, 20u);
    w32(ADDR_STAT_ARR2 + 16u, 0x0Cu << 16); w32(ADDR_STAT_ARR2 + 20u, 20u);

    /* v0: valid charm in page 0 -> 1 */
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 15u * 0xE4u);
    snap_add(&s, ADDR_ITEMTYPES_EQUIV, 0x330u);
    stage_isc(&s, isc_ids, 4);
    snap_capture(&s);
    uint32_t a0[2] = { ADDR_UNIT, ADDR_UNIT2 };
    uint32_t r0 = call_stdcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "valid_charm_page0_ret_1", a0, 2, 0xFFFFFFFFu, r0, &s);

    /* v1: charm in stash page 4 -> 0 */
    w8(ADDR_ITEMDATA1 + 0x45u, 4u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 15u * 0xE4u);
    snap_add(&s, ADDR_ITEMTYPES_EQUIV, 0x330u);
    stage_isc(&s, isc_ids, 4);
    snap_capture(&s);
    uint32_t r1 = call_stdcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "charm_stash_page4_ret_0", a0, 2, 0xFFFFFFFFu, r1, &s);

    /* v2: broken flag 0x100 set -> 0 */
    w8(ADDR_ITEMDATA1 + 0x45u, 0u);
    w32(ADDR_ITEMDATA1 + 0x18u, 0x110u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 15u * 0xE4u);
    snap_add(&s, ADDR_ITEMTYPES_EQUIV, 0x330u);
    stage_isc(&s, isc_ids, 4);
    snap_capture(&s);
    uint32_t r2 = call_stdcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "broken_charm_ret_0", a0, 2, 0xFFFFFFFFu, r2, &s);
  }

  /* 3. B2-03: 0x6FD97DC0 ITEMS_CraftModAddSockets (stdcall 7-arg -> eax) */
  {
    const uint32_t va = 0x6FD97DC0u;
    const char *nm = "ITEMS_CraftModAddSockets";
    uint32_t isc_ids[1] = { 0xC2u };
    setup_base_tables();
    w8(ADDR_ITEMS_TXT + 0x10Fu, 2u);
    w8(ADDR_ITEMS_TXT + 0x110u, 3u);
    w8(ADDR_ITEMS_TXT + 0x12Eu, 4u);
    w16(ADDR_ITEMS_TXT + 0x11Eu, 1u);
    w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x22u, 1u);
    w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x25u, 4u);

    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_ITEMDATA1 + 0x2Cu, 50u);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x24u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x28u, 1u);
    w16(ADDR_STATLIST1 + 0x2Au, 4u);
    w32(ADDR_STAT_ARR1 + 0u, 0xC2u << 16);
    w32(ADDR_STAT_ARR1 + 4u, 0u);
    w32(ADDR_STATLIST1 + 0x48u, ADDR_STAT_ARR2);
    w16(ADDR_STATLIST1 + 0x4Cu, 1u);
    w16(ADDR_STATLIST1 + 0x4Eu, 4u);

    /* pModDef at ADDR_SCRATCH with nSockets at +0x04 = 3 */
    w32(ADDR_SCRATCH + 0u, 1u);
    w32(ADDR_SCRATCH + 4u, 3u);

    /* v0: adds 3 sockets and sets flag 0x800 -> 1 */
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 2u * 0xE4u);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t a0[7] = { ADDR_UNIT, ADDR_SCRATCH, 0u, 0u, 0u, 0u, 0u };
    uint32_t r0 = call_stdcall7(va, a0[0], a0[1], a0[2], a0[3], a0[4], a0[5], a0[6]);
    emit_line(fp, va, nm, "craft_add_3_sockets_ret_1", a0, 7, 0xFFFFFFFFu, r0, &s);

    /* v1: null item with valid pModDef -> 1 */
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 2u * 0xE4u);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t a1[7] = { 0u, ADDR_SCRATCH, 0u, 0u, 0u, 0u, 0u };
    uint32_t r1 = call_stdcall7(va, a1[0], a1[1], a1[2], a1[3], a1[4], a1[5], a1[6]);
    emit_line(fp, va, nm, "null_item_valid_mod_ret_1", a1, 7, 0xFFFFFFFFu, r1, &s);
  }

  /* 4. B2-04: 0x6FD9FCB0 SKILLS_GetSkillBonusLevel (eax=pSkill, esi=pUnit -> eax) */
  {
    const uint32_t va = 0x6FD9FCB0u;
    const char *nm = "SKILLS_GetSkillBonusLevel";
    uint32_t isc_ids[5] = { 0x53u, 0x61u, 0x6Bu, 0x7Eu, 0x7Fu };
    setup_base_tables();
    w32(ADDR_SKILL0 + 0x00u, ADDR_SKILLS_TXT + 1u * 0x23Cu);
    w32(ADDR_SKILL0 + 0x28u, 2u); /* nSkillLevel = 2 */
    w32(ADDR_SKILL0 + 0x2Cu, 1u); /* dwBonusLevels = 1 */
    w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x00u, 1u);
    w8(ADDR_SKILLS_TXT  + 1u * 0x23Cu + 0x0Cu, 0u); /* charclass = 0 (Amazon) */
    w8(ADDR_SKILLS_TXT  + 1u * 0x23Cu + 0x1DCu, 1u); /* nEType = 1 (fire) */

    w32(ADDR_UNIT + 0x00u, 0u);
    w32(ADDR_UNIT + 0x04u, 0u); /* Amazon */
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x48u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x4Cu, 5u);
    w16(ADDR_STATLIST1 + 0x4Eu, 8u);
    w32(ADDR_STAT_ARR1 + 0u,  0x53u << 16);        w32(ADDR_STAT_ARR1 + 4u,  2u); /* +2 Amazon */
    w32(ADDR_STAT_ARR1 + 8u,  (0x61u << 16) | 1u); w32(ADDR_STAT_ARR1 + 12u, 5u); /* +5 oskill (capped at 3) */
    w32(ADDR_STAT_ARR1 + 16u, (0x6Bu << 16) | 1u); w32(ADDR_STAT_ARR1 + 20u, 2u); /* +2 single skill */
    w32(ADDR_STAT_ARR1 + 24u, (0x7Eu << 16) | 1u); w32(ADDR_STAT_ARR1 + 28u, 1u); /* +1 elem fire */
    w32(ADDR_STAT_ARR1 + 32u, 0x7Fu << 16);        w32(ADDR_STAT_ARR1 + 36u, 1u); /* +1 all skills */

    /* v0: null pSkill -> 0 */
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    snap_add(&s, ADDR_SKILLDESC_TXT, 2u * 0x120u);
    stage_isc(&s, isc_ids, 5);
    snap_capture(&s);
    uint32_t a0[2] = { 0u, ADDR_UNIT };
    uint32_t r0 = call_eax_esi_ret(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "null_skill_ret_0", a0, 2, 0xFFFFFFFFu, r0, &s);

    /* v1: matching player class + allskills(1) + dwBonus(1) + class(2) + oskill_cap(3) + elem(1) + single(2) = 10 */
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    snap_add(&s, ADDR_SKILLDESC_TXT, 2u * 0x120u);
    stage_isc(&s, isc_ids, 5);
    snap_capture(&s);
    uint32_t a1[2] = { ADDR_SKILL0, ADDR_UNIT };
    uint32_t r1 = call_eax_esi_ret(va, a1[0], a1[1]);
    emit_line(fp, va, nm, "same_class_oskill_capped_ret_10", a1, 2, 0xFFFFFFFFu, r1, &s);

    /* v2: different player class (Sorceress=1) -> oskill NOT capped (5), no class bonus -> 1+1+5+1+2 = 10 */
    w32(ADDR_UNIT + 0x04u, 1u);
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    snap_add(&s, ADDR_SKILLDESC_TXT, 2u * 0x120u);
    stage_isc(&s, isc_ids, 5);
    snap_capture(&s);
    uint32_t r2 = call_eax_esi_ret(va, a1[0], a1[1]);
    emit_line(fp, va, nm, "diff_class_oskill_uncapped_ret_10", a1, 2, 0xFFFFFFFFu, r2, &s);
  }

  /* 5. B2-05: 0x6FDA0560 SKILLS_GetUnitSkillBonusBySkillId (stdcall pUnit, nSkillId -> eax) */
  {
    const uint32_t va = 0x6FDA0560u;
    const char *nm = "SKILLS_GetUnitSkillBonusBySkillId";
    uint32_t isc_ids[1] = { 0x7Fu };
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 1u); /* monster */
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_UNIT + 0xA8u, ADDR_SKILL_LIST);
    w32(ADDR_SKILL_LIST + 0x04u, ADDR_SKILL0);
    w32(ADDR_SKILL0 + 0x00u, ADDR_SKILLS_TXT + 2u * 0x23Cu);
    w32(ADDR_SKILL0 + 0x2Cu, 4u); /* dwBonusLevels = 4 */
    w32(ADDR_SKILL0 + 0x34u, 0xFFFFFFFFu); /* non-charged */
    w16(ADDR_SKILLS_TXT + 2u * 0x23Cu + 0x00u, 2u);

    /* v0: null unit -> 0 */
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 3u * 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t a0[2] = { 0u, 2u };
    uint32_t r0 = call_stdcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "null_unit_ret_0", a0, 2, 0xFFFFFFFFu, r0, &s);

    /* v1: matched non-charged skill 2 -> 4 */
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 3u * 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t a1[2] = { ADDR_UNIT, 2u };
    uint32_t r1 = call_stdcall2(va, a1[0], a1[1]);
    emit_line(fp, va, nm, "matched_noncharged_ret_4", a1, 2, 0xFFFFFFFFu, r1, &s);

    /* v2: charged skill (nOwnerItemGuid != -1) skipped -> 0 */
    w32(ADDR_SKILL0 + 0x34u, 0x123u);
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 3u * 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t r2 = call_stdcall2(va, a1[0], a1[1]);
    emit_line(fp, va, nm, "charged_skipped_ret_0", a1, 2, 0xFFFFFFFFu, r2, &s);
  }

  /* 6. B2-06: 0x6FDA05C0 SKILLS_EvaluateSkillLevel (stdcall pUnit, pSkill, bBonus -> eax) */
  {
    const uint32_t va = 0x6FDA05C0u;
    const char *nm = "SKILLS_EvaluateSkillLevel";
    uint32_t isc_ids[1] = { 0x7Fu };
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 1u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_SKILL0 + 0x00u, ADDR_SKILLS_TXT + 1u * 0x23Cu);
    w32(ADDR_SKILL0 + 0x28u, 5u); /* nSkillLevel = 5 */
    w32(ADDR_SKILL0 + 0x2Cu, 3u); /* dwBonusLevels = 3 */
    w32(ADDR_SKILL0 + 0x34u, 0xFFFFFFFFu);
    w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x00u, 1u);

    /* v0: null unit -> 0 */
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t a0[3] = { 0u, ADDR_SKILL0, 1u };
    uint32_t r0 = call_stdcall3(va, a0[0], a0[1], a0[2]);
    emit_line(fp, va, nm, "null_unit_ret_0", a0, 3, 0xFFFFFFFFu, r0, &s);

    /* v1: bBonus=0 -> base level 5 */
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t a1[3] = { ADDR_UNIT, ADDR_SKILL0, 0u };
    uint32_t r1 = call_stdcall3(va, a1[0], a1[1], a1[2]);
    emit_line(fp, va, nm, "no_bonus_flag_ret_5", a1, 3, 0xFFFFFFFFu, r1, &s);

    /* v2: bBonus=1 -> 5 + 3 = 8 */
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t a2[3] = { ADDR_UNIT, ADDR_SKILL0, 1u };
    uint32_t r2 = call_stdcall3(va, a2[0], a2[1], a2[2]);
    emit_line(fp, va, nm, "with_bonus_ret_8", a2, 3, 0xFFFFFFFFu, r2, &s);
  }

  /* 7. B2-07: 0x6FDA0AF0 SKILLS_CheckSkillManaOrCharges (eax=pSkill, ecx=pUnit -> eax) */
  {
    const uint32_t va = 0x6FDA0AF0u;
    const char *nm = "SKILLS_CheckSkillManaOrCharges";
    uint32_t isc_ids[2] = { 6u, 8u };
    setup_base_tables();
    w32(ADDR_SKILL0 + 0x00u, ADDR_SKILLS_TXT + 1u * 0x23Cu);
    w32(ADDR_SKILL0 + 0x28u, 3u);
    w32(ADDR_SKILL0 + 0x2Cu, 0u);
    w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x00u, 1u);
    w8(ADDR_SKILLS_TXT  + 1u * 0x23Cu + 0x188u, 8u); /* nManaShift = 8 */
    w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x18Au, 10u); /* wMana = 10 */
    w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x18Cu, 2u);  /* wLvlMana = 2 -> (10 + 2*2)<<8 = 3584 */

    w32(ADDR_UNIT + 0x00u, 0u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x48u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x4Cu, 2u);
    w16(ADDR_STATLIST1 + 0x4Eu, 4u);
    w32(ADDR_STAT_ARR1 + 0u, 6u << 16); w32(ADDR_STAT_ARR1 + 4u, 5000u); /* hitpoints=5000 */
    w32(ADDR_STAT_ARR1 + 8u, 8u << 16); w32(ADDR_STAT_ARR1 + 12u, 4000u); /* mana=4000 */

    /* v0: charged skill with charges=2 > 0 -> 1 */
    w32(ADDR_SKILL0 + 0x34u, 0x99u);
    w32(ADDR_SKILL0 + 0x38u, 2u);
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    stage_isc(&s, isc_ids, 2);
    snap_capture(&s);
    uint32_t a0[2] = { ADDR_SKILL0, ADDR_UNIT };
    uint32_t r0 = call_eax_ecx_ret(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "charged_pos_ret_1", a0, 2, 0xFFFFFFFFu, r0, &s);

    /* v1: charged skill with charges=0 -> 0 */
    w32(ADDR_SKILL0 + 0x38u, 0u);
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    stage_isc(&s, isc_ids, 2);
    snap_capture(&s);
    uint32_t r1 = call_eax_ecx_ret(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "charged_zero_ret_0", a0, 2, 0xFFFFFFFFu, r1, &s);

    /* v2: non-charged skill, mana=4000 >= 3584 -> 1 */
    w32(ADDR_SKILL0 + 0x34u, 0xFFFFFFFFu);
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    snap_add(&s, ADDR_SKILLDESC_TXT, 0x120u);
    stage_isc(&s, isc_ids, 2);
    snap_capture(&s);
    uint32_t r2 = call_eax_ecx_ret(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "noncharged_mana_ok_ret_1", a0, 2, 0xFFFFFFFFu, r2, &s);

    /* v3: non-charged skill, mana=1000 < 3584 -> 0 */
    w32(ADDR_STAT_ARR1 + 12u, 1000u);
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    snap_add(&s, ADDR_SKILLDESC_TXT, 0x120u);
    stage_isc(&s, isc_ids, 2);
    snap_capture(&s);
    uint32_t r3 = call_eax_ecx_ret(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "noncharged_low_mana_ret_0", a0, 2, 0xFFFFFFFFu, r3, &s);
  }

  /* 8. B2-08: 0x6FDA0EA0 SKILLS_GetSkillLevelByIdWithBonus (stdcall pUnit, nSkillId -> eax) */
  {
    const uint32_t va = 0x6FDA0EA0u;
    const char *nm = "SKILLS_GetSkillLevelByIdWithBonus";
    uint32_t isc_ids[1] = { 0x7Fu };
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 1u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_UNIT + 0xA8u, ADDR_SKILL_LIST);
    w32(ADDR_SKILL_LIST + 0x04u, ADDR_SKILL0);
    w32(ADDR_SKILL0 + 0x00u, ADDR_SKILLS_TXT + 2u * 0x23Cu);
    w32(ADDR_SKILL0 + 0x28u, 6u);
    w32(ADDR_SKILL0 + 0x2Cu, 2u);
    w32(ADDR_SKILL0 + 0x34u, 0xFFFFFFFFu);
    w16(ADDR_SKILLS_TXT + 2u * 0x23Cu + 0x00u, 2u);

    /* v0: null unit -> 0 */
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 3u * 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t a0[2] = { 0u, 2u };
    uint32_t r0 = call_stdcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "null_unit_ret_0", a0, 2, 0xFFFFFFFFu, r0, &s);

    /* v1: found non-charged skill 2 -> 6 + 2 = 8 */
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 3u * 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t a1[2] = { ADDR_UNIT, 2u };
    uint32_t r1 = call_stdcall2(va, a1[0], a1[1]);
    emit_line(fp, va, nm, "found_noncharged_ret_8", a1, 2, 0xFFFFFFFFu, r1, &s);

    /* v2: missing skill 3 -> 0 */
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 3u * 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t a2[2] = { ADDR_UNIT, 3u };
    uint32_t r2 = call_stdcall2(va, a2[0], a2[1]);
    emit_line(fp, va, nm, "missing_skill_ret_0", a2, 2, 0xFFFFFFFFu, r2, &s);
  }

  /* 9. B2-09: 0x6FDA0F00 SKILLS_CheckUnitEquippedWeaponsMatchSkill (eax=pSkill, [esp+4]=pUnit -> eax, ret 4) */
  {
    const uint32_t va = 0x6FDA0F00u;
    const char *nm = "SKILLS_CheckUnitEquippedWeaponsMatchSkill";
    setup_base_tables();
    set_equiv_bit(1u, 0x2Du);
    w16(ADDR_ITEMS_TXT + 0u * 0x1A8u + 0x11Eu, 1u);
    w32(ADDR_SKILL0 + 0x00u, ADDR_SKILLS_TXT + 1u * 0x23Cu);
    w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x00u, 1u);

    w32(ADDR_UNIT + 0x00u, 0u);
    w32(ADDR_UNIT + 0x60u, ADDR_INV1);
    w32(ADDR_INV1 + 0x00u, 0x01020304u);
    w32(ADDR_INV1 + 0x14u, ADDR_GRID_ARR);
    w32(ADDR_INV1 + 0x18u, 1u);
    w8(ADDR_GRID_ARR + 0x08u, 10u);
    w8(ADDR_GRID_ARR + 0x09u, 1u);
    w32(ADDR_GRID_ARR + 0x0Cu, ADDR_GRID_ITEMS);
    w32(ADDR_GRID_ITEMS + 0x10u, ADDR_UNIT2);
    w32(ADDR_UNIT2 + 0x00u, 4u);
    w32(ADDR_UNIT2 + 0x04u, 0u);
    w32(ADDR_UNIT2 + 0x14u, ADDR_ITEMDATA2);

    /* v0: null skill -> 0 */
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 2u * 0xE4u);
    snap_add(&s, ADDR_ITEMTYPES_EQUIV, 0x330u);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    snap_capture(&s);
    uint32_t a0[2] = { 0u, ADDR_UNIT };
    uint32_t r0 = call_eax_stack1_ret4(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "null_skill_ret_0", a0, 2, 0xFFFFFFFFu, r0, &s);

    /* v1: wITypeA1 <= 0 && wETypeA1 <= 0 -> 1 */
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 2u * 0xE4u);
    snap_add(&s, ADDR_ITEMTYPES_EQUIV, 0x330u);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    snap_capture(&s);
    uint32_t a1[2] = { ADDR_SKILL0, ADDR_UNIT };
    uint32_t r1 = call_eax_stack1_ret4(va, a1[0], a1[1]);
    emit_line(fp, va, nm, "no_weapon_req_ret_1", a1, 2, 0xFFFFFFFFu, r1, &s);

    /* v2: wITypeA1 = 0x2D matched by right-hand weapon -> 1 */
    w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x18u, 0x2Du);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 2u * 0xE4u);
    snap_add(&s, ADDR_ITEMTYPES_EQUIV, 0x330u);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    snap_capture(&s);
    uint32_t r2 = call_eax_stack1_ret4(va, a1[0], a1[1]);
    emit_line(fp, va, nm, "matched_right_weapon_ret_1", a1, 2, 0xFFFFFFFFu, r2, &s);
  }

  /* 10. B2-10: 0x6FD91070 DRLGOUTROOM_SpawnAct5BarricadeWallStrip (stdcall pLevel -> void) */
  {
    const uint32_t va = 0x6FD91070u;
    const char *nm = "DRLGOUTROOM_SpawnAct5BarricadeWallStrip";
    setup_base_tables();
    w32(VA_LVLPREST_PTR, ADDR_LVLPREST_HIGH - 0x361u * 0x1B0u);
    memset((void *)(uintptr_t)ADDR_LVLPREST_HIGH, 0, 122u * 0x1B0u);
    for (uint32_t i = 0; i < 122u; i++) {
      uint32_t rec = ADDR_LVLPREST_HIGH + i * 0x1B0u;
      w32(rec + 0x00u, 0x361u + i);
      w32(rec + 0x28u, 8u);
      w32(rec + 0x2Cu, 8u);
      w32(rec + 0x40u, 3u);
    }

    /* v0: width=16, step=1 -> spawns presets 0x361..0x36F across x=15..1 at y=0 */
    setup_drlg_grid_fixture(16u, 4u, 0x6Fu, 0u);
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_add(&s, ADDR_LVLPREST_HIGH, 15u * 0x1B0u);
    snap_capture(&s);
    uint32_t a0[1] = { ADDR_LEVEL };
    call_stdcall1_void(va, a0[0]);
    emit_line(fp, va, nm, "barricade_strip_15_presets_void", a0, 1, 0u, 0u, &s);

    /* v1: width=15, step=1 -> spawns presets 0x361..0x36F across x=14..0 at y=0 */
    setup_drlg_grid_fixture(15u, 4u, 0x6Fu, 0u);
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_add(&s, ADDR_LVLPREST_HIGH, 15u * 0x1B0u);
    snap_capture(&s);
    call_stdcall1_void(va, a0[0]);
    emit_line(fp, va, nm, "barricade_strip_exact_fit_void", a0, 1, 0u, 0u, &s);
  }

  /* 11. B2-11: 0x6FD91120 DRLGOUTROOM_SpawnFrigidHighlandsCorner (ebx=pLevel -> void) */
  {
    const uint32_t va = 0x6FD91120u;
    const char *nm = "DRLGOUTROOM_SpawnFrigidHighlandsCorner";
    setup_base_tables();
    w32(VA_LVLPREST_PTR, ADDR_LVLPREST_HIGH - 0x361u * 0x1B0u);
    memset((void *)(uintptr_t)ADDR_LVLPREST_HIGH, 0, 122u * 0x1B0u);
    for (uint32_t i = 0; i < 122u; i++) {
      uint32_t rec = ADDR_LVLPREST_HIGH + i * 0x1B0u;
      w32(rec + 0x00u, 0x361u + i);
      w32(rec + 0x28u, 16u);
      w32(rec + 0x2Cu, 16u);
      w32(rec + 0x40u, 3u);
    }

    /* v0: level 0x6F (111), width=8, height=8 -> spawns 0x370 at (6,6) and 0x380 at (6,4) */
    setup_drlg_grid_fixture(8u, 8u, 0x6Fu, 0u);
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_add(&s, ADDR_LVLPREST_HIGH + (0x370u - 0x361u) * 0x1B0u, 0x1B0u);
    snap_add(&s, ADDR_LVLPREST_HIGH + (0x380u - 0x361u) * 0x1B0u, 0x1B0u);
    snap_add(&s, HEAP_BASE, 0x40u);
    snap_capture(&s);
    uint32_t a0[1] = { ADDR_LEVEL };
    call_ebx_void(va, a0[0]);
    emit_line(fp, va, nm, "frigid_corner_8x8_void", a0, 1, 0u, 0u, &s);

    /* v1: level 0x6F, width=10, height=6 -> spawns 0x370 at (8,4) and 0x380 at (8,2) */
    setup_drlg_grid_fixture(10u, 6u, 0x6Fu, 0u);
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_add(&s, ADDR_LVLPREST_HIGH + (0x370u - 0x361u) * 0x1B0u, 0x1B0u);
    snap_add(&s, ADDR_LVLPREST_HIGH + (0x380u - 0x361u) * 0x1B0u, 0x1B0u);
    snap_add(&s, HEAP_BASE, 0x40u);
    snap_capture(&s);
    call_ebx_void(va, a0[0]);
    emit_line(fp, va, nm, "frigid_corner_10x6_void", a0, 1, 0u, 0u, &s);
  }

  /* 12. B2-12: 0x6FD911E0 DRLGOUTROOM_TryUpgradeBorderPreset (ecx=pLevel, edx=nGridX, esi=nGridY -> eax) */
  {
    const uint32_t va = 0x6FD911E0u;
    const char *nm = "DRLGOUTROOM_TryUpgradeBorderPreset";
    setup_base_tables();
    w32(VA_LVLPREST_PTR, ADDR_LVLPREST_HIGH - 0x361u * 0x1B0u);
    memset((void *)(uintptr_t)ADDR_LVLPREST_HIGH, 0, 122u * 0x1B0u);
    for (uint32_t i = 0; i < 122u; i++) {
      uint32_t rec = ADDR_LVLPREST_HIGH + i * 0x1B0u;
      w32(rec + 0x00u, 0x361u + i);
      w32(rec + 0x28u, 8u);
      w32(rec + 0x2Cu, 8u);
      w32(rec + 0x40u, 3u);
    }

    /* v0: cell2 missing bit 0x200 -> 0 */
    setup_drlg_grid_fixture(6u, 6u, 0x6Fu, 0u);
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_capture(&s);
    uint32_t a0[3] = { ADDR_LEVEL, 2u, 2u };
    uint32_t r0 = call_ecx_edx_esi_ret(va, a0[0], a0[1], a0[2]);
    emit_line(fp, va, nm, "no_0x200_flag_ret_0", a0, 3, 0xFFFFFFFFu, r0, &s);

    /* v1: cell2 has 0x200, cell0=0x390 (< 0x393) -> 0 */
    setup_drlg_grid_fixture(6u, 6u, 0x6Fu, 0u);
    w32(ADDR_GRID2_CELLS + (2u * 16u + 2u) * 4u, 0x00000200u);
    w32(ADDR_GRID0_CELLS + (2u * 16u + 2u) * 4u, 0x390u);
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_capture(&s);
    uint32_t r1 = call_ecx_edx_esi_ret(va, a0[0], a0[1], a0[2]);
    emit_line(fp, va, nm, "preset_below_0x393_ret_0", a0, 3, 0xFFFFFFFFu, r1, &s);

    /* v2: cell2 has 0x200, cell0=0x395 (in 0x393..0x39A) -> upgrades to 0x3A5 and returns 1 */
    setup_drlg_grid_fixture(6u, 6u, 0x6Fu, 0u);
    w32(ADDR_GRID2_CELLS + (2u * 16u + 2u) * 4u, 0x00000200u);
    w32(ADDR_GRID0_CELLS + (2u * 16u + 2u) * 4u, 0x395u);
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_add(&s, ADDR_LVLPREST_HIGH + (0x3A5u - 0x361u) * 0x1B0u, 0x1B0u);
    snap_add(&s, HEAP_BASE, 0x40u);
    snap_capture(&s);
    uint32_t r2 = call_ecx_edx_esi_ret(va, a0[0], a0[1], a0[2]);
    emit_line(fp, va, nm, "upgrades_0x395_to_0x3a5_ret_1", a0, 3, 0xFFFFFFFFu, r2, &s);
  }

  /* 13. B2-13: 0x6FD91230 DRLGOUTROOM_TraceAndSpawnPlateauPerimeter (stdcall pLevel -> void) */
  {
    const uint32_t va = 0x6FD91230u;
    const char *nm = "DRLGOUTROOM_TraceAndSpawnPlateauPerimeter";
    setup_base_tables();
    w32(VA_LVLPREST_PTR, ADDR_LVLPREST_HIGH - 0x361u * 0x1B0u);
    memset((void *)(uintptr_t)ADDR_LVLPREST_HIGH, 0, 122u * 0x1B0u);
    for (uint32_t i = 0; i < 122u; i++) {
      uint32_t rec = ADDR_LVLPREST_HIGH + i * 0x1B0u;
      w32(rec + 0x00u, 0x361u + i);
      w32(rec + 0x28u, 16u);
      w32(rec + 0x2Cu, 16u);
      w32(rec + 0x40u, 3u);
    }

    /* v0: non-tundra (level 0x70): 6x6 grid, path (4,0)->(2,0)->(0,0)->(0,2)->(0,4) */
    setup_drlg_grid_fixture(6u, 6u, 0x70u, 0u);
    w32(ADDR_GRID0_CELLS + (0u * 16u + 4u) * 4u, 0x371u + 0u); /* dx=-1, dy=0 -> (2,0) */
    w32(ADDR_GRID0_CELLS + (0u * 16u + 2u) * 4u, 0x371u + 7u); /* dx=-1, dy=0 -> (0,0) */
    w32(ADDR_GRID0_CELLS + (0u * 16u + 0u) * 4u, 0x371u + 3u); /* dx=0,  dy=1 -> (0,2) */
    w32(ADDR_GRID0_CELLS + (2u * 16u + 0u) * 4u, 0x371u + 6u); /* dx=0,  dy=1 -> (0,4) */
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_add(&s, ADDR_LVLPREST_HIGH + (0x37Du - 0x361u) * 0x1B0u, 14u * 0x1B0u);
    snap_add(&s, HEAP_BASE, 0x80u);
    snap_capture(&s);
    uint32_t a0[1] = { ADDR_LEVEL };
    call_stdcall1_void(va, a0[0]);
    emit_line(fp, va, nm, "plateau_perimeter_non_tundra_void", a0, 1, 0u, 0u, &s);

    /* v1: tundra (level 0x75): 6x6 grid, path (4,0)->(2,0)->(0,0)->(0,2)->(0,4) */
    setup_drlg_grid_fixture(6u, 6u, 0x75u, 0u);
    w32(ADDR_GRID0_CELLS + (0u * 16u + 4u) * 4u, 0x3BDu + 0u);
    w32(ADDR_GRID0_CELLS + (0u * 16u + 2u) * 4u, 0x3BDu + 7u);
    w32(ADDR_GRID0_CELLS + (0u * 16u + 0u) * 4u, 0x3BDu + 3u);
    w32(ADDR_GRID0_CELLS + (2u * 16u + 0u) * 4u, 0x3BDu + 6u);
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_add(&s, ADDR_LVLPREST_HIGH + (0x3C9u - 0x361u) * 0x1B0u, 14u * 0x1B0u);
    snap_add(&s, HEAP_BASE, 0x80u);
    snap_capture(&s);
    call_stdcall1_void(va, a0[0]);
    emit_line(fp, va, nm, "plateau_perimeter_tundra_117_void", a0, 1, 0u, 0u, &s);
  }

  /* 14. B2-14: 0x6FD916B0 DRLGOUTROOM_SpawnHellAct5SpecialCorners (edi=pLevel -> void) */
  {
    const uint32_t va = 0x6FD916B0u;
    const char *nm = "DRLGOUTROOM_SpawnHellAct5SpecialCorners";
    setup_base_tables();
    w32(VA_LVLPREST_PTR, ADDR_LVLPREST_HIGH - 0x361u * 0x1B0u);
    memset((void *)(uintptr_t)ADDR_LVLPREST_HIGH, 0, 122u * 0x1B0u);
    for (uint32_t i = 0; i < 122u; i++) {
      uint32_t rec = ADDR_LVLPREST_HIGH + i * 0x1B0u;
      w32(rec + 0x00u, 0x361u + i);
      w32(rec + 0x28u, 16u);
      w32(rec + 0x2Cu, 16u);
      w32(rec + 0x40u, 3u);
    }

    /* v0: level 0x70, sizeX (40) > sizeY (20) -> spawns 0x392 at (0, 2) */
    setup_drlg_grid_fixture(8u, 8u, 0x70u, 0u);
    w32(ADDR_LEVEL + 0x24u, 40u);
    w32(ADDR_LEVEL + 0x28u, 20u);
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_add(&s, ADDR_LVLPREST_HIGH + (0x391u - 0x361u) * 0x1B0u, 2u * 0x1B0u);
    snap_capture(&s);
    uint32_t a0[1] = { ADDR_LEVEL };
    call_edi_void(va, a0[0]);
    emit_line(fp, va, nm, "lvl112_wide_spawns_0x392_void", a0, 1, 0u, 0u, &s);

    /* v1: level 0x75, sizeX (20) <= sizeY (40) -> spawns 0x3D7 at (2, 6) and 0x3D9 at (2, 0) */
    setup_drlg_grid_fixture(8u, 8u, 0x75u, 0u);
    w32(ADDR_LEVEL + 0x24u, 20u);
    w32(ADDR_LEVEL + 0x28u, 40u);
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_add(&s, ADDR_LVLPREST_HIGH + (0x3D7u - 0x361u) * 0x1B0u, 4u * 0x1B0u);
    snap_capture(&s);
    call_edi_void(va, a0[0]);
    emit_line(fp, va, nm, "lvl117_tall_spawns_0x3d7_0x3d9_void", a0, 1, 0u, 0u, &s);
  }

  /* 15. B2-15: 0x6FD91B50 DRLGOUTROOM_SpawnAct5EdgeTransitions (stdcall pLevel -> void) */
  {
    const uint32_t va = 0x6FD91B50u;
    const char *nm = "DRLGOUTROOM_SpawnAct5EdgeTransitions";
    setup_base_tables();
    w32(VA_LVLPREST_PTR, ADDR_LVLPREST_HIGH - 0x361u * 0x1B0u);
    memset((void *)(uintptr_t)ADDR_LVLPREST_HIGH, 0, 122u * 0x1B0u);
    for (uint32_t i = 0; i < 122u; i++) {
      uint32_t rec = ADDR_LVLPREST_HIGH + i * 0x1B0u;
      w32(rec + 0x00u, 0x361u + i);
      w32(rec + 0x28u, 8u);
      w32(rec + 0x2Cu, 8u);
      w32(rec + 0x40u, 3u);
    }

    /* v0: level 0x6E (110 -> pick=1), all 4 edges have bit 0x400 set */
    setup_drlg_grid_fixture(6u, 6u, 0x6Eu, 0u);
    w32(ADDR_GRID2_CELLS + (0u * 16u + 2u) * 4u, 0x00000400u); /* top edge (2,0) -> 0x38D */
    w32(ADDR_GRID2_CELLS + (4u * 16u + 3u) * 4u, 0x00000400u); /* bottom edge (3,4) -> 0x38C */
    w32(ADDR_GRID2_CELLS + (1u * 16u + 0u) * 4u, 0x00000400u); /* left edge (0,1) -> 0x38E */
    w32(ADDR_GRID2_CELLS + (2u * 16u + 4u) * 4u, 0x00000400u); /* right edge (4,2) -> 0x38B */
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_add(&s, ADDR_LVLPREST_HIGH + (0x38Bu - 0x361u) * 0x1B0u, 4u * 0x1B0u);
    snap_capture(&s);
    uint32_t a0[1] = { ADDR_LEVEL };
    call_stdcall1_void(va, a0[0]);
    emit_line(fp, va, nm, "lvl110_all_4_edges_pick1_void", a0, 1, 0u, 0u, &s);

    /* v1: level 0x6F (111 -> pick=-1), all 4 edges have bit 0x400 set */
    setup_drlg_grid_fixture(6u, 6u, 0x6Fu, 0u);
    w32(ADDR_GRID2_CELLS + (0u * 16u + 2u) * 4u, 0x00000400u);
    w32(ADDR_GRID2_CELLS + (4u * 16u + 3u) * 4u, 0x00000400u);
    w32(ADDR_GRID2_CELLS + (1u * 16u + 0u) * 4u, 0x00000400u);
    w32(ADDR_GRID2_CELLS + (2u * 16u + 4u) * 4u, 0x00000400u);
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_add(&s, ADDR_LVLPREST_HIGH + (0x38Bu - 0x361u) * 0x1B0u, 4u * 0x1B0u);
    snap_add(&s, HEAP_BASE, 0x60u);
    snap_capture(&s);
    call_stdcall1_void(va, a0[0]);
    emit_line(fp, va, nm, "lvl111_all_4_edges_pick_neg1_void", a0, 1, 0u, 0u, &s);
  }

  /* 16. B2-16: 0x6FDCECC0 DRLGOUTWILD_SpawnRiverColumnAndBridge (eax=nGridX, ecx=pLevel -> void) */
  {
    const uint32_t va = 0x6FDCECC0u;
    const char *nm = "DRLGOUTWILD_SpawnRiverColumnAndBridge";
    setup_base_tables();
    w32(VA_LVLPREST_PTR, ADDR_LVLPREST_LOW - 26u * 0x1B0u);
    memset((void *)(uintptr_t)ADDR_LVLPREST_LOW, 0, 3u * 0x1B0u);
    for (uint32_t i = 0; i < 3u; i++) {
      w32(ADDR_LVLPREST_LOW + i * 0x1B0u + 0x00u, 26u + i);
      w32(ADDR_LVLPREST_LOW + i * 0x1B0u + 0x28u, 8u);
      w32(ADDR_LVLPREST_LOW + i * 0x1B0u + 0x2Cu, 8u);
      w32(ADDR_LVLPREST_LOW + i * 0x1B0u + 0x40u, 3u);
    }

    /* v0: height=3, exercises cell0==0 (with/without 0x100), cell0==7 (with/without 0x30000), cell0==5, flags=0 */
    setup_drlg_grid_fixture(6u, 3u, 2u, 0u);
    w32(ADDR_GRID0_CELLS + (0u * 16u + 2u) * 4u, 0u);
    w32(ADDR_GRID2_CELLS + (0u * 16u + 2u) * 4u, 0x00000100u); /* cell0=0 & 0x100 -> pick 0 */
    w32(ADDR_GRID0_CELLS + (0u * 16u + 3u) * 4u, 0u);
    w32(ADDR_GRID2_CELLS + (0u * 16u + 3u) * 4u, 0u);          /* cell0=0 & !0x100 -> pick 3 */
    w32(ADDR_GRID0_CELLS + (1u * 16u + 2u) * 4u, 7u);
    w32(ADDR_GRID2_CELLS + (1u * 16u + 2u) * 4u, 0x00030000u); /* cell0=7 & 0x30000 -> pick 3 */
    w32(ADDR_GRID0_CELLS + (1u * 16u + 3u) * 4u, 7u);
    w32(ADDR_GRID2_CELLS + (1u * 16u + 3u) * 4u, 0x00010000u); /* cell0=7 & !0x30000 -> table[7] */
    w32(ADDR_GRID0_CELLS + (2u * 16u + 2u) * 4u, 5u);          /* cell0=5 -> table[5] */
    w32(ADDR_GRID0_CELLS + (2u * 16u + 3u) * 4u, 6u);          /* cell0=6 -> table[6] */
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_add(&s, ADDR_LVLPREST_LOW, 3u * 0x1B0u);
    snap_capture(&s);
    uint32_t a0[2] = { 2u, ADDR_LEVEL };
    call_eax_ecx_void(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "river_column_no_bridge_void", a0, 2, 0u, 0u, &s);

    /* v1: flags=0x10 (bit 0x14 set) -> spawns river column AND places random bridge */
    setup_drlg_grid_fixture(6u, 3u, 2u, 0x10u);
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_add(&s, ADDR_LVLPREST_LOW, 3u * 0x1B0u);
    snap_capture(&s);
    call_eax_ecx_void(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "river_column_with_bridge_void", a0, 2, 0u, 0u, &s);
  }

  /* 17. B2-17: 0x6FDC4000 DATATBLS_GetItemRatioTxtRecord (stdcall nItemId, _unused, wVersion -> eax) */
  {
    const uint32_t va = 0x6FDC4000u;
    const char *nm = "DATATBLS_GetItemRatioTxtRecord";
    setup_base_tables();
    w32(VA_ITEMRATIO_COUNT, 3u);
    w32(VA_ITEMRATIO_PTR, ADDR_ITEMRATIO_TXT);
    set_equiv_bit(1u, 0x32u);
    set_equiv_bit(2u, 0x32u);
    /* Item 0: normal non-class (dwCode != dwUberCode, wType1=1 with nClass=7) */
    w32(ADDR_ITEMS_TXT + 0u * 0x1A8u + 0x80u, 0x30726178u);
    w32(ADDR_ITEMS_TXT + 0u * 0x1A8u + 0x88u, 0x31726178u);
    w32(ADDR_ITEMS_TXT + 0u * 0x1A8u + 0x8Cu, 0x32726178u);
    w16(ADDR_ITEMS_TXT + 0u * 0x1A8u + 0x11Eu, 1u);
    /* Item 1: uber class-specific (dwCode == dwUberCode, nComponent=0, wType1=2 with nClass=3) */
    w32(ADDR_ITEMS_TXT + 1u * 0x1A8u + 0x80u, 0x31726178u);
    w32(ADDR_ITEMS_TXT + 1u * 0x1A8u + 0x88u, 0x31726178u);
    w32(ADDR_ITEMS_TXT + 1u * 0x1A8u + 0x8Cu, 0x32726178u);
    w16(ADDR_ITEMS_TXT + 1u * 0x1A8u + 0x11Eu, 2u);
    w8(ADDR_ITEMS_TXT  + 1u * 0x1A8u + 0x12Au, 0u);
    w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x21u, 7u); /* not class-specific */
    w8(ADDR_ITEMTYPES_TXT + 2u * 0xE4u + 0x21u, 3u); /* class-specific (< 7) */

    /* Record 0: wVersion=0, bUber=0, bClassSpecific=0 */
    w16(ADDR_ITEMRATIO_TXT + 0u * 0x44u + 0x40u, 0u);
    w8(ADDR_ITEMRATIO_TXT  + 0u * 0x44u + 0x42u, 0u);
    w8(ADDR_ITEMRATIO_TXT  + 0u * 0x44u + 0x43u, 0u);
    /* Record 1: wVersion=100, bUber=0, bClassSpecific=0 */
    w16(ADDR_ITEMRATIO_TXT + 1u * 0x44u + 0x40u, 100u);
    w8(ADDR_ITEMRATIO_TXT  + 1u * 0x44u + 0x42u, 0u);
    w8(ADDR_ITEMRATIO_TXT  + 1u * 0x44u + 0x43u, 0u);
    /* Record 2: wVersion=100, bUber=1, bClassSpecific=1 */
    w16(ADDR_ITEMRATIO_TXT + 2u * 0x44u + 0x40u, 100u);
    w8(ADDR_ITEMRATIO_TXT  + 2u * 0x44u + 0x42u, 1u);
    w8(ADDR_ITEMRATIO_TXT  + 2u * 0x44u + 0x43u, 1u);

    /* v0: normal non-class item (0) with wVersion=100 -> picks record 1 (highest <= 100) */
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 2u * 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 3u * 0xE4u);
    snap_add(&s, ADDR_ITEMTYPES_EQUIV, 0x330u);
    snap_add(&s, ADDR_ITEMRATIO_TXT, 3u * 0x44u);
    snap_capture(&s);
    uint32_t a0[3] = { 0u, 0u, 100u };
    uint32_t r0 = call_stdcall3(va, a0[0], a0[1], a0[2]);
    emit_line(fp, va, nm, "normal_nonclass_v100_ret_rec1", a0, 3, 0xFFFFFFFFu, r0, &s);

    /* v1: normal non-class item (0) with wVersion=0 -> picks record 0 */
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 2u * 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 3u * 0xE4u);
    snap_add(&s, ADDR_ITEMTYPES_EQUIV, 0x330u);
    snap_add(&s, ADDR_ITEMRATIO_TXT, 3u * 0x44u);
    snap_capture(&s);
    uint32_t a1[3] = { 0u, 0u, 0u };
    uint32_t r1 = call_stdcall3(va, a1[0], a1[1], a1[2]);
    emit_line(fp, va, nm, "normal_nonclass_v0_ret_rec0", a1, 3, 0xFFFFFFFFu, r1, &s);

    /* v2: uber class-specific item (1) with wVersion=100 -> picks record 2 */
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 2u * 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 3u * 0xE4u);
    snap_add(&s, ADDR_ITEMTYPES_EQUIV, 0x330u);
    snap_add(&s, ADDR_ITEMRATIO_TXT, 3u * 0x44u);
    snap_capture(&s);
    uint32_t a2[3] = { 1u, 0u, 100u };
    uint32_t r2 = call_stdcall3(va, a2[0], a2[1], a2[2]);
    emit_line(fp, va, nm, "uber_class_v100_ret_rec2", a2, 3, 0xFFFFFFFFu, r2, &s);

    /* v3: uber class-specific item (1) with wVersion=0 -> no match -> 0 */
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 2u * 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 3u * 0xE4u);
    snap_add(&s, ADDR_ITEMTYPES_EQUIV, 0x330u);
    snap_add(&s, ADDR_ITEMRATIO_TXT, 3u * 0x44u);
    snap_capture(&s);
    uint32_t a3[3] = { 1u, 0u, 0u };
    uint32_t r3 = call_stdcall3(va, a3[0], a3[1], a3[2]);
    emit_line(fp, va, nm, "uber_class_v0_no_match_ret_0", a3, 3, 0xFFFFFFFFu, r3, &s);
  }
}

int main(int argc, char **argv) {
  if (argc < 3) {
    fprintf(stderr, "Usage: %s <i10b-1.ndjson> <i10b-2.ndjson>\n", argv[0]);
    return 1;
  }

  HMODULE hStorm = LoadLibraryA("Storm.dll");
  HMODULE hFog = LoadLibraryA("Fog.dll");
  HMODULE hD2Common = LoadLibraryA("D2Common.dll");
  if (!hStorm || !hFog || !hD2Common || (uintptr_t)hD2Common != 0x6FD50000u) {
    fprintf(stderr, "Failed to load D2Common.dll at 0x6FD50000 (got %p)\n", (void *)hD2Common);
    return 2;
  }

  void *arena = VirtualAlloc(
    (void *)(uintptr_t)ARENA_BASE, ARENA_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE
  );
  void *heap = VirtualAlloc(
    (void *)(uintptr_t)HEAP_BASE, HEAP_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE
  );
  if (arena != (void *)(uintptr_t)ARENA_BASE || heap != (void *)(uintptr_t)HEAP_BASE) {
    fprintf(stderr, "VirtualAlloc failed: arena=%p heap=%p\n", arena, heap);
    return 3;
  }

  DWORD oldProt = 0;
  if (!VirtualProtect((void *)(uintptr_t)0x6FD50000u, 0xA9000u, PAGE_EXECUTE_READWRITE, &oldProt)) {
    fprintf(stderr, "VirtualProtect failed\n");
    return 4;
  }
  w32(0x6FDD90D0u, (uint32_t)(uintptr_t)&stub_fog_10045);
  w32(0x6FDD90CCu, (uint32_t)(uintptr_t)&stub_fog_10046);

  FILE *fp1 = fopen(argv[1], "wb");
  if (!fp1) {
    fprintf(stderr, "Cannot open %s\n", argv[1]);
    return 5;
  }
  emit_i10b_1(fp1);
  fclose(fp1);

  FILE *fp2 = fopen(argv[2], "wb");
  if (!fp2) {
    fprintf(stderr, "Cannot open %s\n", argv[2]);
    return 6;
  }
  emit_i10b_2(fp2);
  fclose(fp2);

  return 0;
}
