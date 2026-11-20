/*
 * Standalone MinGW real-DLL differential vector emitter for K1r8 Iteration 11 Lane B:
 * - Sub-Batch I11B-1 (15 D2Common.dll v1.13c functions -> i11b-1-vectors.ndjson)
 * - Sub-Batch I11B-2 (15 D2Common.dll v1.13c functions -> i11b-2-vectors.ndjson)
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
#define VA_GDWINVBITMASKS_IAT 0x6FDD9078u /* 4B: Fog.dll!gdwInvBitMasks */
#define VA_GDWBITMASKS_IAT    0x6FDD90B0u /* 4B: Fog.dll!gdwBitMasks */
#define VA_SGPT_DATATABLES    0x6FDE9E1Cu /* 4B */
#define VA_GRID0_DEF          0x6FDED378u /* 32B: equipment grid0 + belt grid1 defs */
#define VA_ITEMS_TXT_COUNT    0x6FDEFB94u /* 8B: count + ptr */
#define VA_ITEMS_TXT_PTR      0x6FDEFB98u
#define VA_LVLPREST_PTR       0x6FDF0B3Cu /* 4B */
#define VA_SCRATCH_LOS        0x6FDF1F00u /* 20B scratch for SKILLS_CheckLineOfSight113c */

/* Arena layout */
#define ADDR_UNIT             0x20000100u /* 0x100: D2UnitStrc #1 */
#define ADDR_UNIT2            0x20000200u /* 0x100: D2UnitStrc #2 */
#define ADDR_UNIT3            0x20000300u /* 0x100: D2UnitStrc #3 */
#define ADDR_ITEMDATA1        0x20000400u /* 0x80:  D2ItemDataStrc #1 */
#define ADDR_ITEMDATA2        0x20000480u /* 0x80:  D2ItemDataStrc #2 */
#define ADDR_ITEMDATA3        0x20000500u /* 0x80:  D2ItemDataStrc #3 */
#define ADDR_INV1             0x20000580u /* 0x40:  D2InventoryStrc #1 */
#define ADDR_GRID_ARR         0x20000600u /* 0x40:  D2InventoryGridStrc[4] */
#define ADDR_GRID_ITEMS       0x20000640u /* 0x40:  uint32_t ppItems[16] */
#define ADDR_STATLIST1        0x20000700u /* 0x80:  D2StatListExStrc #1 */
#define ADDR_STATLIST2        0x20000780u /* 0x80:  D2StatListExStrc #2 */
#define ADDR_STATLIST3        0x20000800u /* 0x80:  D2StatListExStrc #3 */
#define ADDR_STAT_ARR1        0x20000880u /* 0x40:  D2StatStrc[8] #1 */
#define ADDR_STAT_ARR2        0x200008C0u /* 0x40:  D2StatStrc[8] #2 */
#define ADDR_STAT_ARR3        0x20000900u /* 0x40:  D2StatStrc[8] #3 */
#define ADDR_STATE_FLAGS      0x20000940u /* 0x40:  fStateMasks / disguise masks */
#define ADDR_SKILL_LIST       0x20000980u /* 0x20:  D2SkillListStrc */
#define ADDR_SKILL0           0x200009C0u /* 0x40:  D2SkillStrc #0 */
#define ADDR_SKILL1           0x20000A00u /* 0x40:  D2SkillStrc #1 */
#define ADDR_PATH1            0x20000A40u /* 0x40:  D2DynamicPathStrc / D2StaticPathStrc */
#define ADDR_ROOM1            0x20000A80u /* 0x80:  D2ActiveRoomStrc #1 */
#define ADDR_ROOMEX1          0x20000B00u /* 0x80:  D2RoomExStrc #1 */
#define ADDR_VERTEX_RING      0x20000B80u /* 0x80:  D2DrlgVertexStrc[4] (4 * 0x18) */
#define ADDR_LEVEL            0x20000C00u /* 0x200: D2DrlgLevelStrc */
#define ADDR_OUTDOORS         0x20000E00u /* 0x80:  D2DrlgOutdoorInfoStrc */
#define ADDR_DRLG             0x20000E80u /* 0x480: D2DrlgStrc */
#define ADDR_COLLGRID         0x20001300u /* 0x30:  D2RoomCollisionGridStrc */
#define ADDR_COLLMAP          0x20001340u /* 0x320: uint16_t collMap[20*20] */
#define ADDR_BITMASKS         0x20001680u /* 0x80:  gdwBitMasks[32] */
#define ADDR_INV_BITMASKS     0x20001700u /* 0x80:  gdwInvBitMasks[32] */
#define ADDR_SCRATCH          0x20001780u /* 0x80:  pOutDepleted / pCtx / pCubeMainTxt / costs */
#define ADDR_GRID0_ROWS       0x20001800u /* 0x40:  int32_t rowOffsets0[16] */
#define ADDR_GRID2_ROWS       0x20001840u /* 0x40:  int32_t rowOffsets2[16] */
#define ADDR_GRID0_CELLS      0x20001880u /* 0x400: int32_t cells0[256] */
#define ADDR_GRID2_CELLS      0x20001C80u /* 0x400: int32_t cells2[256] */

/* Data tables in 0x20002100..0x20150000 */
#define ADDR_DATATABLES       0x20002100u /* 0xD00: D2DataTablesStrc */
#define ADDR_ITEMS_TXT        0x20003000u /* 8 * 0x1A8 = 0xD40 */
#define ADDR_ITEMTYPES_TXT    0x20004000u /* 68 * 0xE4 = 0x3C90 */
#define ADDR_ITEMTYPES_EQUIV  0x20007D00u /* 68 * 12   = 0x330 */
#define ADDR_SKILLS_TXT       0x20008100u /* 8 * 0x23C = 0x11E0 */
#define ADDR_SKILLDESC_TXT    0x20009300u /* 4 * 0x120 = 0x480 */
#define ADDR_MISSILES_TXT     0x20009800u /* 4 * 0x1A4 = 0x690 */
#define ADDR_MISSILES_CODE    0x20009F00u /* 0x100: RPN bytecode buffer */
#define ADDR_STATES_TXT       0x2000A000u /* 105 * 0x3C = 0x189C */
#define ADDR_PROPERTIES_TXT   0x2000BA00u /* 8 * 0x2E = 0x170 */
#define ADDR_PASSIVE_STATES   0x2000BC00u /* 8 * 2 = 0x10 */
#define ADDR_SKILLS_CODE      0x2000BD00u /* 0x100: Skills RPN bytecode buffer */
#define ADDR_ISC_TXT          0x20010000u /* 220 * 0x144 = 0x1BD80 */
#define ADDR_LVLPREST_LOW     0x20030000u /* preset 24..53 (30 * 0x1B0 = 0x32A0) */
#define ADDR_LVLPREST_HIGH    0x20100000u /* preset 0x361..0x3DD (125 * 0x1B0 = 0x150F0) */

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
static uint32_t call_stdcall4(
  uintptr_t fn, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3
) {
  typedef uint32_t (__stdcall *F)(uint32_t, uint32_t, uint32_t, uint32_t);
  return ((F)fn)(a0, a1, a2, a3);
}
static uint32_t call_stdcall5(
  uintptr_t fn, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3, uint32_t a4
) {
  typedef uint32_t (__stdcall *F)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
  return ((F)fn)(a0, a1, a2, a3, a4);
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

/* B1-01: esi=pLevel -> void, ret */
static __attribute__((noinline)) void call_esi_void(uintptr_t fn, uint32_t esi_in) {
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "+S"(esi_in)
    : [fn]"c"(fn)
    : "eax", "ebx", "edx", "edi", "cc", "memory"
  );
}

/* B1-06: edi=pUnit, ebx=nStateId, [esp+4]=bCreate -> eax, ret 4 */
static __attribute__((noinline)) uint32_t call_edi_ebx_stack1_ret4(
  uintptr_t fn, uint32_t edi_in, uint32_t ebx_in, uint32_t s0
) {
  uint32_t out;
  __asm__ volatile(
    "pushl %[s0]\n\t"
    "call *%[fn]\n\t"
    : "=a"(out), "+D"(edi_in), "+b"(ebx_in)
    : [fn]"c"(fn), [s0]"d"(s0)
    : "esi", "cc", "memory"
  );
  return out;
}

/* B2-10: eax=pItem, [esp+4]=nBaseCost -> eax, ret 4 */
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

/* B2-13: eax=pItem, [esp+4]=pBuy, [esp+8]=pSell, [esp+0xC]=pRepair, [esp+0x10]=nDivisor -> void, ret 0x10 */
static __attribute__((noinline)) void call_eax_stack4_ret16_void(
  uintptr_t fn, uint32_t eax_in, uint32_t s0, uint32_t s1, uint32_t s2, uint32_t s3
) {
  __asm__ volatile(
    "pushl %[s3]\n\t"
    "pushl %[s2]\n\t"
    "pushl %[s1]\n\t"
    "pushl %[s0]\n\t"
    "call *%[fn]\n\t"
    : "+a"(eax_in)
    : [fn]"c"(fn), [s0]"d"(s0), [s1]"b"(s1), [s2]"S"(s2), [s3]"D"(s3)
    : "cc", "memory"
  );
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
  fflush(fp);
  for (int i = 0; i < s->n; i++) free(s->pre[i]);
  s->n = 0;
}

static void clear_base_arena(void) {
  memset((void *)(uintptr_t)ARENA_BASE, 0, 0x0002C000u);
  reset_heap();
  for (uint32_t i = 0; i < 32; i++) {
    w32(ADDR_BITMASKS + i * 4u, 1u << i);
    w32(ADDR_INV_BITMASKS + i * 4u, ~(1u << i));
  }
  w32(VA_GDWBITMASKS_IAT, ADDR_BITMASKS);
  w32(VA_GDWINVBITMASKS_IAT, ADDR_INV_BITMASKS);
  w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);
  for (uint32_t i = 0; i < 5u; i++) {
    w32(VA_SCRATCH_LOS + i * 4u, 0u);
  }
  w8(VA_GRID0_DEF, 10u);
  w8(VA_GRID0_DEF + 1u, 1u);
}

static void set_equiv_bit(uint32_t wType, uint32_t targetType) {
  uint32_t word_off = targetType >> 5u;
  uint32_t bit = 1u << (targetType & 31u);
  uint32_t addr = ADDR_ITEMTYPES_EQUIV + (wType * 3u + word_off) * 4u;
  w32(addr, (*(uint32_t *)(uintptr_t)addr) | bit);
}

static void setup_base_tables(void) {
  clear_base_arena();
  /* sgptDataTables */
  w32(ADDR_DATATABLES + 0x60u,  ADDR_MISSILES_CODE);
  w32(ADDR_DATATABLES + 0x64u,  0x100u);
  w32(ADDR_DATATABLES + 0xA4u,  ADDR_PROPERTIES_TXT);
  w32(ADDR_DATATABLES + 0xACu,  8u);
  w32(ADDR_DATATABLES + 0xBCu,  ADDR_STATES_TXT);
  w32(ADDR_DATATABLES + 0xC4u,  105u); /* nStatesTxtRecordCount */
  w32(ADDR_DATATABLES + 0x10Cu, ADDR_STATE_FLAGS); /* pDisguiseMasks */
  w32(ADDR_DATATABLES + 0x110u, ADDR_STATE_FLAGS); /* fStateMasks */
  w32(ADDR_DATATABLES + 0x17Cu, ADDR_PASSIVE_STATES);
  w16(ADDR_DATATABLES + 0x180u, 0u);
  w32(ADDR_DATATABLES + 0xB64u, ADDR_MISSILES_TXT);
  w32(ADDR_DATATABLES + 0xB6Cu, 4u);
  w32(ADDR_DATATABLES + 0xB8Cu, ADDR_SKILLDESC_TXT);
  w32(ADDR_DATATABLES + 0xB94u, 4u);
  w32(ADDR_DATATABLES + 0xB98u, ADDR_SKILLS_TXT);
  w32(ADDR_DATATABLES + 0xBA0u, 8u);
  w32(ADDR_DATATABLES + 0xBCCu, ADDR_ISC_TXT);
  w32(ADDR_DATATABLES + 0xBD4u, 220u);
  w32(ADDR_DATATABLES + 0xBF8u, ADDR_ITEMTYPES_TXT);
  w32(ADDR_DATATABLES + 0xBFCu, 68u);
  w32(ADDR_DATATABLES + 0xC00u, 3u);
  w32(ADDR_DATATABLES + 0xC04u, ADDR_ITEMTYPES_EQUIV);
  w32(ADDR_DATATABLES + 0xC68u, 1000u); /* nLvlPrestTxtRecordCount */
  w32(ADDR_DATATABLES + 0xC6Cu, 6u);    /* nSkillIdShift */
  w32(ADDR_DATATABLES + 0xC70u, 0x3Fu); /* nSkillLevelMask */

  w32(ADDR_STATLIST1 + 0x58u, ADDR_STATLIST1 + 0x60u); /* pStateFlags */

  w32(VA_ITEMS_TXT_COUNT, 8u);
  w32(VA_ITEMS_TXT_PTR, ADDR_ITEMS_TXT);
}

static void stage_core(Snap *s) {
  snap_add(s, VA_GDWINVBITMASKS_IAT, 4u);
  snap_add(s, VA_GDWBITMASKS_IAT, 4u);
  snap_add(s, VA_SGPT_DATATABLES, 4u);
  snap_add(s, VA_GRID0_DEF, 32u);
  snap_add(s, VA_ITEMS_TXT_COUNT, 8u);
  snap_add(s, VA_LVLPREST_PTR, 4u);
  snap_add(s, VA_SCRATCH_LOS, 20u);
  snap_add(s, ADDR_UNIT, 0x1700u); /* 0x20000100..0x200017FF */
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

static void emit_i11b_1(FILE *fp) {
  Snap s = {0};

  /* 1. B1-01: 0x6FDCEF60 DRLGOUTWILD_SpawnAllRiversAndBridges (esi=pLevel -> void) */
  {
    const uint32_t va = 0x6FDCEF60u;
    const char *nm = "DRLGOUTWILD_SpawnAllRiversAndBridges113c";

    /* v0: Secret Cow Level (levelId=0x27) -> immediate return */
    setup_base_tables();
    setup_drlg_grid_fixture(8u, 8u, 0x27u, 0x3Cu);
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_capture(&s);
    uint32_t a0[1] = { ADDR_LEVEL };
    call_esi_void(va, a0[0]);
    emit_line(fp, va, nm, "cow_level_27_early_exit", a0, 1, 0u, 0u, &s);

    /* v1: flag 0x20 set (bit=1 seed: 1 * 0x6AC690C5 + 0 -> odd), cell (outer=1, inner=2) -> row=inner=2, col=outer=1 has 0x10 -> spawns preset 25 */
    setup_base_tables();
    setup_drlg_grid_fixture(8u, 8u, 3u, 0x20u);
    w32(ADDR_LEVEL + 0x1C4u, 1u);
    w32(ADDR_LEVEL + 0x1C8u, 0u);
    w32(VA_LVLPREST_PTR, ADDR_LVLPREST_LOW - 24u * 0x1B0u);
    memset((void *)(uintptr_t)ADDR_LVLPREST_LOW, 0, 30u * 0x1B0u);
    for (uint32_t i = 0; i < 30u; i++) {
      w32(ADDR_LVLPREST_LOW + i * 0x1B0u + 0x00u, 24u + i);
      w32(ADDR_LVLPREST_LOW + i * 0x1B0u + 0x28u, 8u);
      w32(ADDR_LVLPREST_LOW + i * 0x1B0u + 0x2Cu, 8u);
      w32(ADDR_LVLPREST_LOW + i * 0x1B0u + 0x40u, 2u);
    }
    w32(ADDR_GRID0_CELLS + (2u * 16u + 1u) * 4u, 0x10u);
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_add(&s, ADDR_LVLPREST_LOW, 2u * 0x1B0u);
    snap_capture(&s);
    call_esi_void(va, a0[0]);
    emit_line(fp, va, nm, "flag20_odd_seed_spawns_preset25", a0, 1, 0u, 0u, &s);

    /* v2: flag 0x20 set (bit=0 seed: 2 * 0x6AC690C5 + 0 -> even), cell (row=outer=1, col=inner=3) has 0x11 -> spawns preset 24 */
    setup_base_tables();
    setup_drlg_grid_fixture(8u, 8u, 3u, 0x20u);
    w32(ADDR_LEVEL + 0x1C4u, 2u);
    w32(ADDR_LEVEL + 0x1C8u, 0u);
    w32(VA_LVLPREST_PTR, ADDR_LVLPREST_LOW - 24u * 0x1B0u);
    memset((void *)(uintptr_t)ADDR_LVLPREST_LOW, 0, 30u * 0x1B0u);
    for (uint32_t i = 0; i < 30u; i++) {
      w32(ADDR_LVLPREST_LOW + i * 0x1B0u + 0x00u, 24u + i);
      w32(ADDR_LVLPREST_LOW + i * 0x1B0u + 0x28u, 8u);
      w32(ADDR_LVLPREST_LOW + i * 0x1B0u + 0x2Cu, 8u);
      w32(ADDR_LVLPREST_LOW + i * 0x1B0u + 0x40u, 2u);
    }
    w32(ADDR_GRID0_CELLS + (1u * 16u + 3u) * 4u, 0x11u);
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_add(&s, ADDR_LVLPREST_LOW, 2u * 0x1B0u);
    snap_capture(&s);
    call_esi_void(va, a0[0]);
    emit_line(fp, va, nm, "flag20_even_seed_spawns_preset24", a0, 1, 0u, 0u, &s);

    /* v3: flag 0x10 set (Cairn/Tree preset on Blood Moor levelId=2 -> preset 0x34=52) */
    setup_base_tables();
    setup_drlg_grid_fixture(10u, 10u, 2u, 0x10u);
    w32(ADDR_LEVEL + 0x1C4u, 0u);
    w32(ADDR_LEVEL + 0x1C8u, 0u);
    w32(VA_LVLPREST_PTR, ADDR_LVLPREST_LOW - 24u * 0x1B0u);
    memset((void *)(uintptr_t)ADDR_LVLPREST_LOW, 0, 30u * 0x1B0u);
    for (uint32_t i = 27u; i < 30u; i++) {
      w32(ADDR_LVLPREST_LOW + i * 0x1B0u + 0x00u, 24u + i);
      w32(ADDR_LVLPREST_LOW + i * 0x1B0u + 0x28u, 8u);
      w32(ADDR_LVLPREST_LOW + i * 0x1B0u + 0x2Cu, 8u);
      w32(ADDR_LVLPREST_LOW + i * 0x1B0u + 0x40u, 2u);
    }
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_add(&s, ADDR_LVLPREST_LOW + 27u * 0x1B0u, 2u * 0x1B0u);
    snap_capture(&s);
    call_esi_void(va, a0[0]);
    emit_line(fp, va, nm, "flag10_bloodmoor_spawns_preset52", a0, 1, 0u, 0u, &s);
  }

  /* 2. B1-02: 0x6FD74FF0 ITEMS_HasUsedCharges (stdcall pItem, pOutDepleted -> eax) */
  {
    const uint32_t va = 0x6FD74FF0u;
    const char *nm = "ITEMS_HasUsedCharges113c";

    /* v0: item without statlist and non-null pOutDepleted -> sets *pOutDepleted=1 and returns 0 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x5Cu, 0u);
    w32(ADDR_SCRATCH, 0xDEADu);
    stage_core(&s);
    snap_capture(&s);
    uint32_t a0[2] = { ADDR_UNIT, ADDR_SCRATCH };
    uint32_t r0 = call_stdcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "no_statlist_sets_out1_ret_0", a0, 2, 0xFFFFFFFFu, r0, &s);

    /* v1: item with charged skill (0xCC) partially depleted (cur=2 < max=5) -> sets *pOutDepleted=0 and returns 1 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x48u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x4Cu, 1u);
    w16(ADDR_STAT_ARR1 + 0x00u, 0x41u); /* layer */
    w16(ADDR_STAT_ARR1 + 0x02u, 0xCCu); /* statId = 204 */
    w32(ADDR_STAT_ARR1 + 0x04u, (5u << 8) | 2u); /* cur=2, max=5 */
    stage_core(&s);
    snap_capture(&s);
    uint32_t a1[2] = { ADDR_UNIT, ADDR_SCRATCH };
    uint32_t r1 = call_stdcall2(va, a1[0], a1[1]);
    emit_line(fp, va, nm, "partially_used_charges_sets_out0_ret_1", a1, 2, 0xFFFFFFFFu, r1, &s);

    /* v2: item with charged skill at full charges (cur=5 == max=5) -> *pOutDepleted stays 1 and returns 1 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x48u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x4Cu, 1u);
    w16(ADDR_STAT_ARR1 + 0x00u, 0x41u);
    w16(ADDR_STAT_ARR1 + 0x02u, 0xCCu);
    w32(ADDR_STAT_ARR1 + 0x04u, (5u << 8) | 5u);
    stage_core(&s);
    snap_capture(&s);
    uint32_t r2 = call_stdcall2(va, a1[0], a1[1]);
    emit_line(fp, va, nm, "full_charges_keeps_out1_ret_1", a1, 2, 0xFFFFFFFFu, r2, &s);
  }

  /* 3. B1-03: 0x6FD7A5C0 ITEMS_RemoveFromSocketedOwner (stdcall pMemPool, pItem -> void) */
  {
    const uint32_t va = 0x6FD7A5C0u;
    const char *nm = "ITEMS_RemoveFromSocketedOwner113c";

    /* v0: null item -> no-op */
    setup_base_tables();
    stage_core(&s);
    snap_capture(&s);
    uint32_t a0[2] = { 0u, 0u };
    call_stdcall2_void(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "null_item_noop", a0, 2, 0u, 0u, &s);

    /* v1: valid item in cursor of inventory -> removes from inventory and clears pExtra */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w32(ADDR_UNIT + 0x0Cu, 77u);
    w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
    w32(ADDR_ITEMDATA1 + 0x5Cu, ADDR_INV1); /* pParentInv */
    w8(ADDR_ITEMDATA1 + 0x68u, 0u);         /* nNodePos = 0 */
    w32(ADDR_INV1 + 0x00u, 0x01020304u);
    w32(ADDR_INV1 + 0x1Cu, 77u);            /* dwCursorGuid == itemGuid */
    w32(ADDR_INV1 + 0x20u, ADDR_UNIT);      /* pCursorItem == pItem */
    stage_core(&s);
    snap_capture(&s);
    uint32_t a1[2] = { 0u, ADDR_UNIT };
    call_stdcall2_void(va, a1[0], a1[1]);
    emit_line(fp, va, nm, "cursor_item_unlinked_from_inv", a1, 2, 0u, 0u, &s);
  }

  /* 4. B1-04: 0x6FD7A170 ITEMS_EnsureThrowableOrStackableQuantity (stdcall pItem -> eax) */
  {
    const uint32_t va = 0x6FD7A170u;
    const char *nm = "ITEMS_EnsureThrowableOrStackableQuantity113c";
    const uint32_t isc_ids[2] = { 0x46u, 0x7Du };

    /* v0: null item -> 0 */
    setup_base_tables();
    stage_core(&s);
    stage_isc(&s, isc_ids, 2);
    snap_capture(&s);
    uint32_t a0[1] = { 0u };
    uint32_t r0 = call_stdcall1(va, a0[0]);
    emit_line(fp, va, nm, "null_item_ret_0", a0, 1, 0xFFFFFFFFu, r0, &s);

    /* v1: item with quantity (0x46) > 0 -> returns 1 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x48u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x4Cu, 1u);
    w16(ADDR_STAT_ARR1 + 0x00u, 0u);
    w16(ADDR_STAT_ARR1 + 0x02u, 0x46u);
    w32(ADDR_STAT_ARR1 + 0x04u, 5u);
    stage_core(&s);
    stage_isc(&s, isc_ids, 2);
    snap_capture(&s);
    uint32_t a1[1] = { ADDR_UNIT };
    uint32_t r1 = call_stdcall1(va, a1[0]);
    emit_line(fp, va, nm, "positive_quantity_ret_1", a1, 1, 0xFFFFFFFFu, r1, &s);

    /* v2: quantity == 0, non-throwable, stackable item with maxStack=20 > 0 -> returns 0 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w8(ADDR_ITEMS_TXT + 0x131u, 1u);   /* bStackable = 1 */
    w32(ADDR_ITEMS_TXT + 0xE8u, 20u);  /* dwMaxStack = 20 */
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    stage_isc(&s, isc_ids, 2);
    snap_capture(&s);
    uint32_t r2 = call_stdcall1(va, a1[0]);
    emit_line(fp, va, nm, "zero_qty_stackable_ret_0", a1, 1, 0xFFFFFFFFu, r2, &s);

    /* v3: quantity == 0, non-stackable item (maxStack == 0) -> returns 1 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w8(ADDR_ITEMS_TXT + 0x131u, 0u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    stage_isc(&s, isc_ids, 2);
    snap_capture(&s);
    uint32_t r3 = call_stdcall1(va, a1[0]);
    emit_line(fp, va, nm, "non_stackable_item_ret_1", a1, 1, 0xFFFFFFFFu, r3, &s);
  }

  /* 5. B1-05: 0x6FD740D0 ITEMS_CanItemBeDroppedOrSold (stdcall pItem -> eax) */
  {
    const uint32_t va = 0x6FD740D0u;
    const char *nm = "ITEMS_CanItemBeDroppedOrSold113c";

    /* v0: Unique item (dwQuality == 7) -> returns 0 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
    w32(ADDR_ITEMDATA1 + 0x00u, 7u); /* Unique */
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_capture(&s);
    uint32_t a0[1] = { ADDR_UNIT };
    uint32_t r0 = call_stdcall1(va, a0[0]);
    emit_line(fp, va, nm, "unique_quality_ret_0", a0, 1, 0xFFFFFFFFu, r0, &s);

    /* v1: Normal item (dwQuality == 2), no disallow flags, pItemsTxt[+0x145] == 1 -> returns 1 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
    w32(ADDR_ITEMDATA1 + 0x00u, 2u);
    w8(ADDR_ITEMS_TXT + 0x145u, 1u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_capture(&s);
    uint32_t r1 = call_stdcall1(va, a0[0]);
    emit_line(fp, va, nm, "normal_droppable_flag145_ret_1", a0, 1, 0xFFFFFFFFu, r1, &s);

    /* v2: Normal item, pItemsTxt[+0x145] == 0 -> returns 0 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
    w32(ADDR_ITEMDATA1 + 0x00u, 2u);
    w8(ADDR_ITEMS_TXT + 0x145u, 0u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_capture(&s);
    uint32_t r2 = call_stdcall1(va, a0[0]);
    emit_line(fp, va, nm, "normal_flag145_zero_ret_0", a0, 1, 0xFFFFFFFFu, r2, &s);
  }

  /* 6. B1-06: 0x6FDA22C0 SKILLS_GetOrCreateSkillStatList (edi=pUnit, ebx=nStateId, [esp+4]=bCreate -> eax) */
  {
    const uint32_t va = 0x6FDA22C0u;
    const char *nm = "SKILLS_GetOrCreateSkillStatList113c";

    /* v0: existing sub-list for state 10 with bCreate=1 -> returns ADDR_STATLIST2 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 0u);
    w32(ADDR_UNIT + 0x0Cu, 11u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x3Cu, ADDR_STATLIST2);
    w32(ADDR_STATLIST2 + 0x10u, 0u);
    w32(ADDR_STATLIST2 + 0x14u, 10u);
    stage_core(&s);
    snap_capture(&s);
    uint32_t a0[3] = { ADDR_UNIT, 10u, 1u };
    uint32_t r0 = call_edi_ebx_stack1_ret4(va, a0[0], a0[1], a0[2]);
    emit_line(fp, va, nm, "existing_sublist_bcreate1_returns_sub", a0, 3, 0xFFFFFFFFu, r0, &s);

    /* v1: existing sub-list for state 10 with bCreate=0 -> unlinks and frees sub-list, returns 0 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 0u);
    w32(ADDR_UNIT + 0x0Cu, 11u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x3Cu, ADDR_STATLIST2);
    w32(ADDR_STATLIST2 + 0x10u, 0u);
    w32(ADDR_STATLIST2 + 0x14u, 10u);
    w32(ADDR_STATLIST2 + 0x34u, ADDR_STATLIST1);
    stage_core(&s);
    snap_capture(&s);
    uint32_t a1[3] = { ADDR_UNIT, 10u, 0u };
    uint32_t r1 = call_edi_ebx_stack1_ret4(va, a1[0], a1[1], a1[2]);
    emit_line(fp, va, nm, "existing_sublist_bcreate0_removes_ret_0", a1, 3, 0xFFFFFFFFu, r1, &s);

    /* v2: missing sub-list for state 10 with bCreate=1 -> allocates at HEAP_BASE and merges into pUnit */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 0u);
    w32(ADDR_UNIT + 0x08u, 0x1122u);
    w32(ADDR_UNIT + 0x0Cu, 11u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    stage_core(&s);
    snap_add(&s, HEAP_BASE, 0x40u);
    snap_capture(&s);
    uint32_t r2 = call_edi_ebx_stack1_ret4(va, a0[0], a0[1], a0[2]);
    emit_line(fp, va, nm, "missing_sublist_bcreate1_allocates_heap", a0, 3, 0xFFFFFFFFu, r2, &s);
  }

  /* 7. B1-07: 0x6FD9F160 SKILLS_TestLineOfSightFromUnitToTarget (stdcall nTargetX, nTargetY, pUnit, dwMask -> eax) */
  {
    const uint32_t va = 0x6FD9F160u;
    const char *nm = "SKILLS_TestLineOfSightFromUnitToTarget113c";

    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 0u); /* player: dynamic path */
    w32(ADDR_UNIT + 0x2Cu, ADDR_PATH1);
    w16(ADDR_PATH1 + 0x02u, 102u); /* unitX */
    w16(ADDR_PATH1 + 0x06u, 102u); /* unitY */
    w32(ADDR_PATH1 + 0x1Cu, ADDR_ROOM1);
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
    w16(ADDR_COLLMAP + (5u * 20u + 5u) * 2u, 0x0004u);

    /* v0: clear ray (mask 0x0001) -> 1 */
    stage_core(&s);
    snap_capture(&s);
    uint32_t a0[4] = { 108u, 108u, ADDR_UNIT, 0x0001u };
    uint32_t r0 = call_stdcall4(va, a0[0], a0[1], a0[2], a0[3]);
    emit_line(fp, va, nm, "dynamic_unit_clear_ray_ret_1", a0, 4, 0xFFFFFFFFu, r0, &s);

    /* v1: blocked ray (mask 0x0004 hits cell (105,105)) -> 0 */
    stage_core(&s);
    snap_capture(&s);
    uint32_t a1[4] = { 108u, 108u, ADDR_UNIT, 0x0004u };
    uint32_t r1 = call_stdcall4(va, a1[0], a1[1], a1[2], a1[3]);
    emit_line(fp, va, nm, "dynamic_unit_blocked_ray_ret_0", a1, 4, 0xFFFFFFFFu, r1, &s);

    /* v2: static unit (dwUnitType == 2, object) clear ray -> 1 */
    w32(ADDR_UNIT + 0x00u, 2u);
    w32(ADDR_PATH1 + 0x00u, ADDR_ROOM1);
    w32(ADDR_PATH1 + 0x0Cu, 102u);
    w32(ADDR_PATH1 + 0x10u, 102u);
    stage_core(&s);
    snap_capture(&s);
    uint32_t r2 = call_stdcall4(va, a0[0], a0[1], a0[2], a0[3]);
    emit_line(fp, va, nm, "static_object_clear_ray_ret_1", a0, 4, 0xFFFFFFFFu, r2, &s);
  }

  /* 8. B1-08: 0x6FD83020 STATES_UpdateOrClearState98Transform (stdcall pUnit, pOwner -> void) */
  {
    const uint32_t va = 0x6FD83020u;
    const char *nm = "STATES_UpdateOrClearState98Transform113c";

    /* v0: pOwner != 0 -> delegates to STATES_SetUnitSourceUnit113c(pUnit, pOwner->dwUnitType, pOwner->dwUnitId) */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 1u);
    w32(ADDR_UNIT + 0xC8u, 0u);
    w32(ADDR_UNIT2 + 0x00u, 0u);
    w32(ADDR_UNIT2 + 0x0Cu, 0x7788u);
    stage_core(&s);
    snap_capture(&s);
    uint32_t a0[2] = { ADDR_UNIT, ADDR_UNIT2 };
    call_stdcall2_void(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "with_owner_sets_source_unit", a0, 2, 0u, 0u, &s);

    /* v1: pOwner == 0 -> clears owner fields (+0x94/+0x98), toggles state 0x62 off, removes sub-list, clears 0x400 in dwFlags2 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 1u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_UNIT + 0x94u, 2u);
    w32(ADDR_UNIT + 0x98u, 0x9999u);
    w32(ADDR_UNIT + 0xC8u, 0x0408u);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x3Cu, ADDR_STATLIST2);
    w32(ADDR_STATLIST1 + 0x6Cu, 1u << (0x62u & 31u)); /* state 0x62 bit set in dword 3 (+0x60 + 3*4 = +0x6C) */
    w32(ADDR_STATLIST2 + 0x10u, 0u);
    w32(ADDR_STATLIST2 + 0x14u, 0x62u);
    w32(ADDR_STATLIST2 + 0x34u, ADDR_STATLIST1);
    stage_core(&s);
    snap_add(&s, ADDR_STATES_TXT + 0x62u * 0x3Cu, 0x3Cu);
    snap_capture(&s);
    uint32_t a1[2] = { ADDR_UNIT, 0u };
    call_stdcall2_void(va, a1[0], a1[1]);
    emit_line(fp, va, nm, "null_owner_clears_state98_and_sublist", a1, 2, 0u, 0u, &s);
  }

  /* 9. B1-09: 0x6FDBA3E0 MISSILE_EvaluateElementalMaxDamage (stdcall pMissile, pOwner, nMissileId, nLevel -> eax) */
  {
    const uint32_t va = 0x6FDBA3E0u;
    const char *nm = "MISSILE_EvaluateElementalMaxDamage113c";

    /* v0: invalid pMissile type (dwUnitType != 3) -> returns 0 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 1u);
    stage_core(&s);
    snap_capture(&s);
    uint32_t a0[4] = { ADDR_UNIT, 0u, 0u, 1u };
    uint32_t r0 = call_stdcall4(va, a0[0], a0[1], a0[2], a0[3]);
    emit_line(fp, va, nm, "non_missile_unit_ret_0", a0, 4, 0xFFFFFFFFu, r0, &s);

    /* v1: valid missile 0 at level 3, dwEMax(+0xEC)=10, EMaxLev0(+0x104)=4, EDmgSymPerCalc(+0x118)=-1, HitShift(+0x196)=8 -> (10+8)<<8 = 4608 */
    setup_base_tables();
    w32(ADDR_MISSILES_TXT + 0xECu, 10u);
    w32(ADDR_MISSILES_TXT + 0x104u, 4u);
    w32(ADDR_MISSILES_TXT + 0x118u, 0xFFFFFFFFu);
    w8(ADDR_MISSILES_TXT + 0x196u, 8u);
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_capture(&s);
    uint32_t a1[4] = { 0u, 0u, 0u, 3u };
    uint32_t r1 = call_stdcall4(va, a1[0], a1[1], a1[2], a1[3]);
    emit_line(fp, va, nm, "lvl3_no_symcalc_hitshift8", a1, 4, 0xFFFFFFFFu, r1, &s);

    /* v2: with EDmgSymPerCalc(+0x118)=0 evaluating constant +50% ([0x07, 50, 0x00]) -> (18 + 9) << 8 = 6912 */
    w32(ADDR_MISSILES_TXT + 0x118u, 0u);
    w8(ADDR_MISSILES_CODE + 0u, 7u);
    w8(ADDR_MISSILES_CODE + 1u, 50u);
    w8(ADDR_MISSILES_CODE + 2u, 0u);
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_add(&s, ADDR_MISSILES_CODE, 16u);
    snap_capture(&s);
    uint32_t r2 = call_stdcall4(va, a1[0], a1[1], a1[2], a1[3]);
    emit_line(fp, va, nm, "lvl3_with_50pct_symcalc_hitshift8", a1, 4, 0xFFFFFFFFu, r2, &s);
  }

  /* 10. B1-10: 0x6FDBA4B0 MISSILE_EvaluatePhysMaxDamage (stdcall pMissile, pOwner, nMissileId, nLevel -> eax) */
  {
    const uint32_t va = 0x6FDBA4B0u;
    const char *nm = "MISSILE_EvaluatePhysMaxDamage113c";

    /* v0: out-of-range missileId (-1 with pMissile=0) -> returns 0 */
    setup_base_tables();
    stage_core(&s);
    snap_capture(&s);
    uint32_t a0[4] = { 0u, 0u, 0xFFFFFFFFu, 1u };
    uint32_t r0 = call_stdcall4(va, a0[0], a0[1], a0[2], a0[3]);
    emit_line(fp, va, nm, "neg_missile_id_null_unit_ret_0", a0, 4, 0xFFFFFFFFu, r0, &s);

    /* v1: missile 0 at level 4, dwMaxDamage(+0xB4)=20, MaxLevDam0(+0xCC)=5, DmgSymPerCalc(+0xE0)=-1, HitShift=8 -> (20+15)<<8 = 8960 */
    setup_base_tables();
    w32(ADDR_MISSILES_TXT + 0xB4u, 20u);
    w32(ADDR_MISSILES_TXT + 0xCCu, 5u);
    w32(ADDR_MISSILES_TXT + 0xE0u, 0xFFFFFFFFu);
    w8(ADDR_MISSILES_TXT + 0x196u, 8u);
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_capture(&s);
    uint32_t a1[4] = { 0u, 0u, 0u, 4u };
    uint32_t r1 = call_stdcall4(va, a1[0], a1[1], a1[2], a1[3]);
    emit_line(fp, va, nm, "lvl4_phys_max_hitshift8", a1, 4, 0xFFFFFFFFu, r1, &s);

    /* v2: resolve missileId and level from pMissile (dwClassId=0, pMissileData->wLevel=4) + 20% symCalc */
    w32(ADDR_UNIT + 0x00u, 3u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
    w16(ADDR_ITEMDATA1 + 0x0Cu, 4u);
    w32(ADDR_MISSILES_TXT + 0xE0u, 0u);
    w8(ADDR_MISSILES_CODE + 0u, 7u);
    w8(ADDR_MISSILES_CODE + 1u, 20u);
    w8(ADDR_MISSILES_CODE + 2u, 0u);
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_add(&s, ADDR_MISSILES_CODE, 16u);
    snap_capture(&s);
    uint32_t a2[4] = { ADDR_UNIT, 0u, 0xFFFFFFFFu, 0u };
    uint32_t r2 = call_stdcall4(va, a2[0], a2[1], a2[2], a2[3]);
    emit_line(fp, va, nm, "from_missile_unit_with_symcalc", a2, 4, 0xFFFFFFFFu, r2, &s);
  }

  /* 11. B1-11: 0x6FDBA580 MISSILE_EvaluatePhysMinDamage (stdcall pMissile, pOwner, nMissileId, nLevel -> eax) */
  {
    const uint32_t va = 0x6FDBA580u;
    const char *nm = "MISSILE_EvaluatePhysMinDamage113c";

    /* v0: out-of-range missileId (10 >= count 4) -> returns 0 */
    setup_base_tables();
    stage_core(&s);
    snap_capture(&s);
    uint32_t a0[4] = { 0u, 0u, 10u, 1u };
    uint32_t r0 = call_stdcall4(va, a0[0], a0[1], a0[2], a0[3]);
    emit_line(fp, va, nm, "oob_missile_id_ret_0", a0, 4, 0xFFFFFFFFu, r0, &s);

    /* v1: missile 0 at level 2, dwMinDamage(+0xB0)=8, MinLevDam0(+0xB8)=3, DmgSymPerCalc(+0xE0)=-1, HitShift=8 -> (8+3)<<8 = 2816 */
    setup_base_tables();
    w32(ADDR_MISSILES_TXT + 0xB0u, 8u);
    w32(ADDR_MISSILES_TXT + 0xB8u, 3u);
    w32(ADDR_MISSILES_TXT + 0xE0u, 0xFFFFFFFFu);
    w8(ADDR_MISSILES_TXT + 0x196u, 8u);
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_capture(&s);
    uint32_t a1[4] = { 0u, 0u, 0u, 2u };
    uint32_t r1 = call_stdcall4(va, a1[0], a1[1], a1[2], a1[3]);
    emit_line(fp, va, nm, "lvl2_phys_min_hitshift8", a1, 4, 0xFFFFFFFFu, r1, &s);

    /* v2: with +100% DmgSymPerCalc -> (11 + 11) << 8 = 5632 */
    w32(ADDR_MISSILES_TXT + 0xE0u, 0u);
    w8(ADDR_MISSILES_CODE + 0u, 7u);
    w8(ADDR_MISSILES_CODE + 1u, 100u);
    w8(ADDR_MISSILES_CODE + 2u, 0u);
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_add(&s, ADDR_MISSILES_CODE, 16u);
    snap_capture(&s);
    uint32_t r2 = call_stdcall4(va, a1[0], a1[1], a1[2], a1[3]);
    emit_line(fp, va, nm, "lvl2_phys_min_with_100pct_symcalc", a1, 4, 0xFFFFFFFFu, r2, &s);
  }

  /* 12. B1-12: 0x6FDBA790 MISSILE_EvaluateMissCalcFormula (stdcall pMissile, pOwner, nParamId, nMissileId, nLevel -> eax) */
  {
    const uint32_t va = 0x6FDBA790u;
    const char *nm = "MISSILE_EvaluateMissCalcFormula113c";

    setup_base_tables();
    w32(ADDR_MISSILES_TXT + 0x38u, 10u);  /* Param1 */
    w32(ADDR_MISSILES_TXT + 0x3Cu, 50u);  /* Param2 */
    w16(ADDR_MISSILES_TXT + 0x96u, 12u);  /* wRange */
    w16(ADDR_MISSILES_TXT + 0x98u, 3u);   /* wLevRange */
    w32(ADDR_MISSILES_TXT + 0xB0u, 8u);   /* dwMinDamage */
    w32(ADDR_MISSILES_TXT + 0xB8u, 2u);   /* dwMinLevDam0 */
    w32(ADDR_MISSILES_TXT + 0xE0u, 0xFFFFFFFFu);
    w32(ADDR_MISSILES_TXT + 0x118u, 0xFFFFFFFFu);
    w8(ADDR_MISSILES_TXT + 0x196u, 8u);

    /* v0: case 0 (Param1 at +0x38) -> 10 */
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_capture(&s);
    uint32_t a0[5] = { 0u, 0u, 0u, 0u, 4u };
    uint32_t r0 = call_stdcall5(va, a0[0], a0[1], a0[2], a0[3], a0[4]);
    emit_line(fp, va, nm, "case0_param1_field", a0, 5, 0xFFFFFFFFu, r0, &s);

    /* v1: case 28 (wRange + wLevRange * nLevel = 12 + 3 * 4 = 24) */
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_capture(&s);
    uint32_t a1[5] = { 0u, 0u, 28u, 0u, 4u };
    uint32_t r1 = call_stdcall5(va, a1[0], a1[1], a1[2], a1[3], a1[4]);
    emit_line(fp, va, nm, "case28_range_linear", a1, 5, 0xFFFFFFFFu, r1, &s);

    /* v2: case 29 (linear Param1 + (lvl-1)*Param2 = 10 + 3*50 = 160) */
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_capture(&s);
    uint32_t a2[5] = { 0u, 0u, 29u, 0u, 4u };
    uint32_t r2 = call_stdcall5(va, a2[0], a2[1], a2[2], a2[3], a2[4]);
    emit_line(fp, va, nm, "case29_param12_linear", a2, 5, 0xFFFFFFFFu, r2, &s);

    /* v3: case 30 (diminishing returns on Param1=10, Param2=50 at lvl=4) */
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_capture(&s);
    uint32_t a3[5] = { 0u, 0u, 30u, 0u, 4u };
    uint32_t r3 = call_stdcall5(va, a3[0], a3[1], a3[2], a3[3], a3[4]);
    emit_line(fp, va, nm, "case30_param12_diminishing", a3, 5, 0xFFFFFFFFu, r3, &s);

    /* v4: case 24 (PhysMinDamage >> 8 = (8 + 3*2) = 14) */
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_capture(&s);
    uint32_t a4[5] = { 0u, 0u, 24u, 0u, 4u };
    uint32_t r4 = call_stdcall5(va, a4[0], a4[1], a4[2], a4[3], a4[4]);
    emit_line(fp, va, nm, "case24_phys_min_shifted", a4, 5, 0xFFFFFFFFu, r4, &s);
  }

  /* 13. B1-13: 0x6FDBB160 MISSILE_EvalMissCalcParamCallback (fastcall ecx=nParamId, edx=pCtx -> eax) */
  {
    const uint32_t va = 0x6FDBB160u;
    const char *nm = "MISSILE_EvalMissCalcParamCallback113c";

    /* v0: null pCtx -> returns 0 */
    setup_base_tables();
    stage_core(&s);
    snap_capture(&s);
    uint32_t a0[2] = { 0u, 0u };
    uint32_t r0 = call_fastcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "null_ctx_ret_0", a0, 2, 0xFFFFFFFFu, r0, &s);

    /* v1: valid pCtx with nMissileId=0, nLevel=5, nParamId=18 (returns nLevel=5) */
    setup_base_tables();
    w32(ADDR_SCRATCH + 0x00u, 0u); /* pMissile */
    w32(ADDR_SCRATCH + 0x04u, 0u); /* pOwner */
    w32(ADDR_SCRATCH + 0x08u, 0u); /* nMissileId */
    w32(ADDR_SCRATCH + 0x0Cu, 5u); /* nLevel */
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_capture(&s);
    uint32_t a1[2] = { 18u, ADDR_SCRATCH };
    uint32_t r1 = call_fastcall2(va, a1[0], a1[1]);
    emit_line(fp, va, nm, "param18_returns_ctx_level", a1, 2, 0xFFFFFFFFu, r1, &s);

    /* v2: valid pCtx with nParamId=0 -> returns Param1 (+0x38) = 42 */
    w32(ADDR_MISSILES_TXT + 0x38u, 42u);
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_capture(&s);
    uint32_t a2[2] = { 0u, ADDR_SCRATCH };
    uint32_t r2 = call_fastcall2(va, a2[0], a2[1]);
    emit_line(fp, va, nm, "param0_returns_missile_param1", a2, 2, 0xFFFFFFFFu, r2, &s);
  }

  /* 14. B1-14: 0x6FDBB2B0 MISSILE_ResolveSkillIdByCodeOrRef (stdcall pMissile, pOwner, dwCalcOffset, nMissileId, nLevel -> eax) */
  {
    const uint32_t va = 0x6FDBB2B0u;
    const char *nm = "MISSILE_ResolveSkillIdByCodeOrRef113c";

    /* v0: dwCalcOffset >= nMissilesCodeSize (0x200 >= 0x100) -> returns 0 */
    setup_base_tables();
    stage_core(&s);
    snap_capture(&s);
    uint32_t a0[5] = { 0u, 0u, 0x200u, 0u, 3u };
    uint32_t r0 = call_stdcall5(va, a0[0], a0[1], a0[2], a0[3], a0[4]);
    emit_line(fp, va, nm, "oob_calc_offset_ret_0", a0, 5, 0xFFFFFFFFu, r0, &s);

    /* v1: RPN expression: var(18=level) * imm8(10) + var(0=Param1=7) at level 3 -> 3*10 + 7 = 37 */
    setup_base_tables();
    w32(ADDR_MISSILES_TXT + 0x38u, 7u);
    /* bytecode: [0x04, 18, 0x07, 10, 0x12 (*), 0x04, 0, 0x10 (+), 0x00] */
    w8(ADDR_MISSILES_CODE + 0u, 0x04u);
    w8(ADDR_MISSILES_CODE + 1u, 18u);
    w8(ADDR_MISSILES_CODE + 2u, 0x07u);
    w8(ADDR_MISSILES_CODE + 3u, 10u);
    w8(ADDR_MISSILES_CODE + 4u, 0x12u);
    w8(ADDR_MISSILES_CODE + 5u, 0x04u);
    w8(ADDR_MISSILES_CODE + 6u, 0u);
    w8(ADDR_MISSILES_CODE + 7u, 0x10u);
    w8(ADDR_MISSILES_CODE + 8u, 0x00u);
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_add(&s, ADDR_MISSILES_CODE, 16u);
    snap_capture(&s);
    uint32_t a1[5] = { 0u, 0u, 0u, 0u, 3u };
    uint32_t r1 = call_stdcall5(va, a1[0], a1[1], a1[2], a1[3], a1[4]);
    emit_line(fp, va, nm, "rpn_level_mul10_plus_param1", a1, 5, 0xFFFFFFFFu, r1, &s);

    /* v2: RPN expression with fn1 (max(15, 25)) -> 25 */
    w8(ADDR_MISSILES_CODE + 16u, 0x07u);
    w8(ADDR_MISSILES_CODE + 17u, 15u);
    w8(ADDR_MISSILES_CODE + 18u, 0x07u);
    w8(ADDR_MISSILES_CODE + 19u, 25u);
    w8(ADDR_MISSILES_CODE + 20u, 0x01u);
    w8(ADDR_MISSILES_CODE + 21u, 1u);
    w8(ADDR_MISSILES_CODE + 22u, 0x00u);
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_add(&s, ADDR_MISSILES_CODE, 32u);
    snap_capture(&s);
    uint32_t a2[5] = { 0u, 0u, 16u, 0u, 3u };
    uint32_t r2 = call_stdcall5(va, a2[0], a2[1], a2[2], a2[3], a2[4]);
    emit_line(fp, va, nm, "rpn_fn_max_15_25", a2, 5, 0xFFFFFFFFu, r2, &s);

    /* v3: RPN op=20 integer exponentiation: 2 ^ 5 = 32 */
    setup_base_tables();
    w8(ADDR_MISSILES_CODE + 0u, 0x07u);
    w8(ADDR_MISSILES_CODE + 1u, 2u);
    w8(ADDR_MISSILES_CODE + 2u, 0x07u);
    w8(ADDR_MISSILES_CODE + 3u, 5u);
    w8(ADDR_MISSILES_CODE + 4u, 0x14u);
    w8(ADDR_MISSILES_CODE + 5u, 0x00u);
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_add(&s, ADDR_MISSILES_CODE, 32u);
    snap_capture(&s);
    uint32_t a3[5] = { 0u, 0u, 0u, 0u, 3u };
    uint32_t r3 = call_stdcall5(va, a3[0], a3[1], a3[2], a3[3], a3[4]);
    emit_line(fp, va, nm, "rpn_pow_2_5", a3, 5, 0xFFFFFFFFu, r3, &s);

    /* v4: RPN op=20 exponent <= 0 returns 1: 7^0 + 9^(-2) = 1 + 1 = 2 */
    w8(ADDR_MISSILES_CODE + 0u, 0x07u);
    w8(ADDR_MISSILES_CODE + 1u, 7u);
    w8(ADDR_MISSILES_CODE + 2u, 0x07u);
    w8(ADDR_MISSILES_CODE + 3u, 0u);
    w8(ADDR_MISSILES_CODE + 4u, 0x14u);
    w8(ADDR_MISSILES_CODE + 5u, 0x07u);
    w8(ADDR_MISSILES_CODE + 6u, 9u);
    w8(ADDR_MISSILES_CODE + 7u, 0x07u);
    w8(ADDR_MISSILES_CODE + 8u, 0xFEu); /* -2 */
    w8(ADDR_MISSILES_CODE + 9u, 0x14u);
    w8(ADDR_MISSILES_CODE + 10u, 0x10u);
    w8(ADDR_MISSILES_CODE + 11u, 0x00u);
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_add(&s, ADDR_MISSILES_CODE, 32u);
    snap_capture(&s);
    uint32_t r4 = call_stdcall5(va, a3[0], a3[1], a3[2], a3[3], a3[4]);
    emit_line(fp, va, nm, "rpn_pow_exp_le_zero", a3, 5, 0xFFFFFFFFu, r4, &s);

    /* v5: RPN op=1 fnIdx=2 rand(10, 20) with seeded pMissile (stack seed=(0, 3) -> 13, pMissile untouched) */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 3u);
    w32(ADDR_UNIT + 0x20u, 0x12345678u);
    w32(ADDR_UNIT + 0x24u, 666u);
    w8(ADDR_MISSILES_CODE + 0u, 0x07u);
    w8(ADDR_MISSILES_CODE + 1u, 10u);
    w8(ADDR_MISSILES_CODE + 2u, 0x07u);
    w8(ADDR_MISSILES_CODE + 3u, 20u);
    w8(ADDR_MISSILES_CODE + 4u, 0x01u);
    w8(ADDR_MISSILES_CODE + 5u, 2u);
    w8(ADDR_MISSILES_CODE + 6u, 0x00u);
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_add(&s, ADDR_MISSILES_CODE, 32u);
    snap_capture(&s);
    uint32_t a5[5] = { ADDR_UNIT, 0u, 0u, 0u, 3u };
    uint32_t r5 = call_stdcall5(va, a5[0], a5[1], a5[2], a5[3], a5[4]);
    emit_line(fp, va, nm, "rpn_fn_rand_with_missile", a5, 5, 0xFFFFFFFFu, r5, &s);

    /* v6: RPN op=1 fnIdx=2 double rand(10, 20) + rand(10, 20) with pMissile=0, nMissileId=100, nLevel=7 */
    w8(ADDR_MISSILES_CODE + 0u, 0x07u);
    w8(ADDR_MISSILES_CODE + 1u, 10u);
    w8(ADDR_MISSILES_CODE + 2u, 0x07u);
    w8(ADDR_MISSILES_CODE + 3u, 20u);
    w8(ADDR_MISSILES_CODE + 4u, 0x01u);
    w8(ADDR_MISSILES_CODE + 5u, 2u);
    w8(ADDR_MISSILES_CODE + 6u, 0x07u);
    w8(ADDR_MISSILES_CODE + 7u, 10u);
    w8(ADDR_MISSILES_CODE + 8u, 0x07u);
    w8(ADDR_MISSILES_CODE + 9u, 20u);
    w8(ADDR_MISSILES_CODE + 10u, 0x01u);
    w8(ADDR_MISSILES_CODE + 11u, 2u);
    w8(ADDR_MISSILES_CODE + 12u, 0x10u);
    w8(ADDR_MISSILES_CODE + 13u, 0x00u);
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_add(&s, ADDR_MISSILES_CODE, 32u);
    snap_capture(&s);
    uint32_t a6[5] = { 0u, 0u, 0u, 100u, 7u };
    uint32_t r6 = call_stdcall5(va, a6[0], a6[1], a6[2], a6[3], a6[4]);
    emit_line(fp, va, nm, "rpn_fn_rand_null_missile_double", a6, 5, 0xFFFFFFFFu, r6, &s);

    /* v7: RPN op=1 fnIdx=3 skill(1, 8) with pOwner=0 -> returns Skills[1].Param1 = 42 */
    setup_base_tables();
    w32(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x148u, 42u); /* Param1 */
    w8(ADDR_MISSILES_CODE + 0u, 0x07u);
    w8(ADDR_MISSILES_CODE + 1u, 1u);
    w8(ADDR_MISSILES_CODE + 2u, 0x07u);
    w8(ADDR_MISSILES_CODE + 3u, 8u);
    w8(ADDR_MISSILES_CODE + 4u, 0x01u);
    w8(ADDR_MISSILES_CODE + 5u, 3u);
    w8(ADDR_MISSILES_CODE + 6u, 0x00u);
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_add(&s, ADDR_MISSILES_CODE, 32u);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    snap_capture(&s);
    uint32_t a7[5] = { 0u, 0u, 0u, 0u, 3u };
    uint32_t r7 = call_stdcall5(va, a7[0], a7[1], a7[2], a7[3], a7[4]);
    emit_line(fp, va, nm, "rpn_fn_skill_null_owner_param1", a7, 5, 0xFFFFFFFFu, r7, &s);

    /* v8: RPN op=1 fnIdx=3 skill(1, 0) with pOwner having skill 1 @ level 5 -> Param1(10) + 4*Param2(7) = 38 */
    setup_base_tables();
    w32(0x6FDF0B50u, ADDR_SCRATCH);
    w32(ADDR_SCRATCH, 99u);
    w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x00u, 1u);  /* wSkillId */
    w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x194u, 0u); /* wSkillDesc = 0 */
    w32(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x148u, 10u); /* Param1 */
    w32(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x14Cu, 7u);  /* Param2 */
    w32(ADDR_UNIT2 + 0x00u, 0u);
    w32(ADDR_UNIT2 + 0xA8u, ADDR_SKILL_LIST);
    w32(ADDR_SKILL_LIST + 0x04u, ADDR_SKILL0);
    w32(ADDR_SKILL0 + 0x00u, ADDR_SKILLS_TXT + 1u * 0x23Cu);
    w32(ADDR_SKILL0 + 0x28u, 5u);
    w32(ADDR_SKILL0 + 0x34u, 0xFFFFFFFFu);
    w8(ADDR_MISSILES_CODE + 0u, 0x07u);
    w8(ADDR_MISSILES_CODE + 1u, 1u);
    w8(ADDR_MISSILES_CODE + 2u, 0x07u);
    w8(ADDR_MISSILES_CODE + 3u, 0u);
    w8(ADDR_MISSILES_CODE + 4u, 0x01u);
    w8(ADDR_MISSILES_CODE + 5u, 3u);
    w8(ADDR_MISSILES_CODE + 6u, 0x00u);
    stage_core(&s);
    snap_add(&s, 0x6FDF0B50u, 4u);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_add(&s, ADDR_MISSILES_CODE, 32u);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    snap_add(&s, ADDR_SKILLDESC_TXT, 0x120u);
    snap_capture(&s);
    uint32_t a8[5] = { 0u, ADDR_UNIT2, 0u, 0u, 3u };
    uint32_t r8 = call_stdcall5(va, a8[0], a8[1], a8[2], a8[3], a8[4]);
    emit_line(fp, va, nm, "rpn_fn_skill_with_owner_lvl5", a8, 5, 0xFFFFFFFFu, r8, &s);

    /* v9..v13: stat(7, 2), stat(7, 0) clamped, stat(7, 0) raw, stat(7, 1) base, and case 40 (stat 0x0c) */
    for (int mcase = 0; mcase < 5; mcase++) {
      setup_base_tables();
      w32(ADDR_DATATABLES + 0x40u, ADDR_SKILLS_CODE);
      w32(ADDR_DATATABLES + 0x44u, 0x100u);
      w32(0x6FDF0B50u, ADDR_SCRATCH);
      w32(ADDR_SCRATCH, 99u);
      w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x00u, 1u);
      w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x194u, 0u);
      w32(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x60u, 0u); /* calc1 offset = 0 */
      w32(ADDR_UNIT2 + 0x00u, 0u); /* PLAYER */
      w32(ADDR_UNIT2 + 0x5Cu, ADDR_STATLIST1);
      w32(ADDR_UNIT2 + 0xA8u, ADDR_SKILL_LIST);
      w32(ADDR_SKILL_LIST + 0x04u, ADDR_SKILL0);
      w32(ADDR_SKILL0 + 0x00u, ADDR_SKILLS_TXT + 1u * 0x23Cu);
      w32(ADDR_SKILL0 + 0x28u, 5u);
      w32(ADDR_SKILL0 + 0x34u, 0xFFFFFFFFu);

      w32(ADDR_STATLIST1 + 0x10u, 0x80000000u); /* extended */
      w32(ADDR_STATLIST1 + 0x44u, ADDR_UNIT2);
      w32(ADDR_STATLIST1 + 0x58u, ADDR_STATE_FLAGS);
      w32(ADDR_STATLIST1 + 0x24u, ADDR_STAT_ARR1);
      w16(ADDR_STATLIST1 + 0x28u, 2u);
      w16(ADDR_STATLIST1 + 0x2Au, 4u);
      w32(ADDR_STATLIST1 + 0x48u, ADDR_STAT_ARR2);
      w16(ADDR_STATLIST1 + 0x4Cu, 2u);
      w16(ADDR_STATLIST1 + 0x4Eu, 4u);

      /* base stats (pStat): stat 7 = 8, stat 12 (0x0c) = 3 */
      w16(ADDR_STAT_ARR1 + 0x00u, 0u);
      w16(ADDR_STAT_ARR1 + 0x02u, 7u);
      w32(ADDR_STAT_ARR1 + 0x04u, 8u);
      w16(ADDR_STAT_ARR1 + 0x08u, 0u);
      w16(ADDR_STAT_ARR1 + 0x0Au, 12u);
      w32(ADDR_STAT_ARR1 + 0x0Cu, 3u);

      /* full stats (pFullStat): stat 7 = 10, stat 12 (0x0c) = 3 */
      w16(ADDR_STAT_ARR2 + 0x00u, 0u);
      w16(ADDR_STAT_ARR2 + 0x02u, 7u);
      w32(ADDR_STAT_ARR2 + 0x04u, 10u);
      w16(ADDR_STAT_ARR2 + 0x08u, 0u);
      w16(ADDR_STAT_ARR2 + 0x0Au, 12u);
      w32(ADDR_STAT_ARR2 + 0x0Cu, 3u);

      if (mcase == 0 || mcase == 1) {
        w8(ADDR_ISC_TXT + 7u * 0x144u + 0x05u, 0x04u); /* Direct */
        w32(ADDR_ISC_TXT + 7u * 0x144u + 0x2Cu, 50u);  /* minaccr */
      } else if (mcase == 4) {
        w8(ADDR_ISC_TXT + 12u * 0x144u + 0x05u, 0x04u); /* Direct */
        w32(ADDR_ISC_TXT + 12u * 0x144u + 0x2Cu, 15u);  /* minaccr */
      }

      uint8_t field = 54u;
      uint8_t mode = (mcase == 0) ? 2u : (mcase == 3) ? 1u : 0u;
      if (mcase == 4) {
        field = 40u;
      } else {
        w8(ADDR_SKILLS_CODE + 0u, 0x07u);
        w8(ADDR_SKILLS_CODE + 1u, 7u);
        w8(ADDR_SKILLS_CODE + 2u, 0x07u);
        w8(ADDR_SKILLS_CODE + 3u, mode);
        w8(ADDR_SKILLS_CODE + 4u, 0x01u);
        w8(ADDR_SKILLS_CODE + 5u, 5u);
        w8(ADDR_SKILLS_CODE + 6u, 0x00u);
      }

      w8(ADDR_MISSILES_CODE + 0u, 0x07u);
      w8(ADDR_MISSILES_CODE + 1u, 1u);
      w8(ADDR_MISSILES_CODE + 2u, 0x07u);
      w8(ADDR_MISSILES_CODE + 3u, field);
      w8(ADDR_MISSILES_CODE + 4u, 0x01u);
      w8(ADDR_MISSILES_CODE + 5u, 3u);
      w8(ADDR_MISSILES_CODE + 6u, 0x00u);

      const uint32_t isc_ids[2] = { 7u, 12u };
      stage_core(&s);
      snap_add(&s, 0x6FDF0B50u, 4u);
      snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
      snap_add(&s, ADDR_MISSILES_CODE, 32u);
      snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
      snap_add(&s, ADDR_SKILLS_CODE, 32u);
      snap_add(&s, ADDR_SKILLDESC_TXT, 0x120u);
      stage_isc(&s, isc_ids, 2);
      snap_capture(&s);

      const char *cnames[5] = {
        "rpn_fn_skill_calc1_stat_mode2_minaccr",
        "rpn_fn_skill_calc1_stat_mode0_minaccr",
        "rpn_fn_skill_calc1_stat_mode0_raw",
        "rpn_fn_skill_calc1_stat_mode1_base",
        "rpn_fn_skill_case40_stat12_minaccr",
      };
      uint32_t rm = call_stdcall5(va, a8[0], a8[1], a8[2], a8[3], a8[4]);
      emit_line(fp, va, nm, cnames[mcase], a8, 5, 0xFFFFFFFFu, rm, &s);
    }
  }

  /* 15. B1-15: 0x6FDBB360 MISSILE_EvaluateElementalMinDamage (stdcall pMissile, pOwner, nMissileId, nLevel -> eax) */
  {
    const uint32_t va = 0x6FDBB360u;
    const char *nm = "MISSILE_EvaluateElementalMinDamage113c";

    /* v0: invalid pMissile type (dwUnitType != 3) -> returns 0 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 0u);
    stage_core(&s);
    snap_capture(&s);
    uint32_t a0[4] = { ADDR_UNIT, 0u, 0u, 1u };
    uint32_t r0 = call_stdcall4(va, a0[0], a0[1], a0[2], a0[3]);
    emit_line(fp, va, nm, "non_missile_unit_ret_0", a0, 4, 0xFFFFFFFFu, r0, &s);

    /* v1: missile 0 at level 3, dwEMin(+0xE8)=6, EMinLev0(+0xF0)=2, EDmgSymPerCalc(+0x118)=-1, HitShift=8 -> (6+4)<<8 = 2560 */
    setup_base_tables();
    w32(ADDR_MISSILES_TXT + 0xE8u, 6u);
    w32(ADDR_MISSILES_TXT + 0xF0u, 2u);
    w32(ADDR_MISSILES_TXT + 0x118u, 0xFFFFFFFFu);
    w8(ADDR_MISSILES_TXT + 0x196u, 8u);
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_capture(&s);
    uint32_t a1[4] = { 0u, 0u, 0u, 3u };
    uint32_t r1 = call_stdcall4(va, a1[0], a1[1], a1[2], a1[3]);
    emit_line(fp, va, nm, "lvl3_elem_min_hitshift8", a1, 4, 0xFFFFFFFFu, r1, &s);

    /* v2: with +50% EDmgSymPerCalc -> (10 + 5) << 8 = 3840 */
    w32(ADDR_MISSILES_TXT + 0x118u, 0u);
    w8(ADDR_MISSILES_CODE + 0u, 0x07u);
    w8(ADDR_MISSILES_CODE + 1u, 50u);
    w8(ADDR_MISSILES_CODE + 2u, 0x00u);
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_add(&s, ADDR_MISSILES_CODE, 16u);
    snap_capture(&s);
    uint32_t r2 = call_stdcall4(va, a1[0], a1[1], a1[2], a1[3]);
    emit_line(fp, va, nm, "lvl3_elem_min_with_50pct_symcalc", a1, 4, 0xFFFFFFFFu, r2, &s);
  }
}

static void emit_i11b_2(FILE *fp) {
  Snap s = {0};

  /* 1. B2-01: 0x6FDA0C90 SKILLS_EvalMissileParamCallback (fastcall ecx=nMissileId, edx=nParamId, [esp+4]=_u, [esp+8]=pCtx -> eax) */
  {
    const uint32_t va = 0x6FDA0C90u;
    const char *nm = "SKILLS_EvalMissileParamCallback113c";

    /* v0: null pCtx -> returns 0 */
    setup_base_tables();
    stage_core(&s);
    snap_capture(&s);
    uint32_t a0[4] = { 0u, 0u, 0u, 0u };
    uint32_t r0 = call_fastcall4(va, a0[0], a0[1], a0[2], a0[3]);
    emit_line(fp, va, nm, "null_ctx_ret_0", a0, 4, 0xFFFFFFFFu, r0, &s);

    /* v1: valid pCtx ({pUnit=0, nSkillId=1, nLevel=6}), nMissileId=0, nParamId=18 -> returns 6 */
    setup_base_tables();
    w32(ADDR_SCRATCH + 0x00u, 0u);
    w32(ADDR_SCRATCH + 0x04u, 1u);
    w32(ADDR_SCRATCH + 0x08u, 6u);
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_capture(&s);
    uint32_t a1[4] = { 0u, 18u, 0u, ADDR_SCRATCH };
    uint32_t r1 = call_fastcall4(va, a1[0], a1[1], a1[2], a1[3]);
    emit_line(fp, va, nm, "valid_ctx_param18_returns_level", a1, 4, 0xFFFFFFFFu, r1, &s);

    /* v2: valid pCtx, nMissileId=0, nParamId=0 -> returns Param1 (+0x38) = 99 */
    w32(ADDR_MISSILES_TXT + 0x38u, 99u);
    stage_core(&s);
    snap_add(&s, ADDR_MISSILES_TXT, 0x1A4u);
    snap_capture(&s);
    uint32_t a2[4] = { 0u, 0u, 0u, ADDR_SCRATCH };
    uint32_t r2 = call_fastcall4(va, a2[0], a2[1], a2[2], a2[3]);
    emit_line(fp, va, nm, "valid_ctx_param0_returns_param1", a2, 4, 0xFFFFFFFFu, r2, &s);
  }

  /* 2. B2-02: 0x6FD77090 ITEMS_CanItemBeRepairedByNpc (stdcall pItem -> eax) */
  {
    const uint32_t va = 0x6FD77090u;
    const char *nm = "ITEMS_CanItemBeRepairedByNpc113c";

    /* v0: unidentified item (dwCommandFlags lacks 0x10) -> returns 0 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
    w32(ADDR_ITEMDATA1 + 0x18u, 0u);
    stage_core(&s);
    snap_capture(&s);
    uint32_t a0[1] = { ADDR_UNIT };
    uint32_t r0 = call_stdcall1(va, a0[0]);
    emit_line(fp, va, nm, "unidentified_item_ret_0", a0, 1, 0xFFFFFFFFu, r0, &s);

    /* v1: identified non-ethereal item with partially depleted charged skill -> returns 1 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
    w32(ADDR_ITEMDATA1 + 0x18u, 0x10u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x48u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x4Cu, 1u);
    w16(ADDR_STAT_ARR1 + 0x00u, 0x41u);
    w16(ADDR_STAT_ARR1 + 0x02u, 0xCCu);
    w32(ADDR_STAT_ARR1 + 0x04u, (5u << 8) | 1u);
    stage_core(&s);
    snap_capture(&s);
    uint32_t r1 = call_stdcall1(va, a0[0]);
    emit_line(fp, va, nm, "depleted_charged_skill_ret_1", a0, 1, 0xFFFFFFFFu, r1, &s);

    /* v2: identified item, no charged skills, bRepair(+0x08)=1, nDurability(+0x112)=20, bNoDurability(+0x113)=0, STAT_MAXDURABILITY(0x49)=20 -> returns 1 */
    setup_base_tables();
    const uint32_t isc_dur[2] = { 0x49u, 0x98u };
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
    w32(ADDR_ITEMDATA1 + 0x18u, 0x10u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x24u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x28u, 1u);
    w32(ADDR_STATLIST1 + 0x48u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x4Cu, 1u);
    w16(ADDR_STAT_ARR1 + 0x00u, 0u);
    w16(ADDR_STAT_ARR1 + 0x02u, 0x49u);
    w32(ADDR_STAT_ARR1 + 0x04u, 20u);
    w16(ADDR_ITEMS_TXT + 0x11Eu, 1u); /* wType1 = 1 */
    w8(ADDR_ITEMS_TXT + 0x112u, 20u); /* nDurability = 20 */
    w8(ADDR_ITEMS_TXT + 0x113u, 0u);  /* bNoDurability = 0 */
    w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x08u, 1u); /* bRepair = 1 */
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 2u * 0xE4u);
    stage_isc(&s, isc_dur, 2);
    snap_capture(&s);
    uint32_t r2 = call_stdcall1(va, a0[0]);
    emit_line(fp, va, nm, "repairable_durability_item_ret_1", a0, 1, 0xFFFFFFFFu, r2, &s);
  }

  /* 3. B2-03: 0x6FD76AD0 ITEMS_CanItemBeSocketedByQuest (stdcall pItem -> eax) */
  {
    const uint32_t va = 0x6FD76AD0u;
    const char *nm = "ITEMS_CanItemBeSocketedByQuest113c";
    const uint32_t isc_ids[1] = { 0xC2u };

    /* v0: already socketed item (IFLAG_SOCKETED 0x800) -> returns 0 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
    w32(ADDR_ITEMDATA1 + 0x18u, 0x800u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_capture(&s);
    uint32_t a0[1] = { ADDR_UNIT };
    uint32_t r0 = call_stdcall1(va, a0[0]);
    emit_line(fp, va, nm, "already_socketed_flag_ret_0", a0, 1, 0xFFFFFFFFu, r0, &s);

    /* v1: clean normal item with maxSockets > 0 and current sockets == 0 -> returns 1 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
    w32(ADDR_ITEMDATA1 + 0x2Cu, 30u); /* ilvl = 30 -> threshold tier 1 */
    w8(ADDR_ITEMS_TXT + 0x10Fu, 2u);  /* invW = 2 */
    w8(ADDR_ITEMS_TXT + 0x110u, 3u);  /* invH = 3 */
    w16(ADDR_ITEMS_TXT + 0x11Eu, 1u); /* wType1 = 1 */
    w8(ADDR_ITEMS_TXT + 0x138u, 4u);  /* nGemSockets = 4 */
    w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x1Bu, 4u); /* MaxSock25 = 4 */
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 2u * 0xE4u);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t r1 = call_stdcall1(va, a0[0]);
    emit_line(fp, va, nm, "unsocketed_socketable_item_ret_1", a0, 1, 0xFFFFFFFFu, r1, &s);
  }

  /* 4. B2-04: 0x6FD96830 ITEMS_CraftModRollSockets (stdcall 9 args -> eax) */
  {
    const uint32_t va = 0x6FD96830u;
    const char *nm = "ITEMS_CraftModRollSockets113c";
    const uint32_t isc_ids[1] = { 0xC2u };

    /* v0: null pCubeInput -> returns 0 */
    setup_base_tables();
    stage_core(&s);
    snap_capture(&s);
    uint32_t a0[9] = { ADDR_UNIT, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u };
    uint32_t r0 = call_stdcall9(va, a0[0], a0[1], a0[2], a0[3], a0[4], a0[5], a0[6], a0[7], a0[8]);
    emit_line(fp, va, nm, "null_cube_input_ret_0", a0, 9, 0xFFFFFFFFu, r0, &s);

    /* v1: valid item (2x3, typeMax=4) with nSocketsOverride=3 -> sets IFLAG_SOCKETED + STAT_ITEM_NUMSOCKETS=3, returns 3 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x24u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x28u, 0u);
    w16(ADDR_STATLIST1 + 0x2Au, 4u);
    w32(ADDR_STATLIST1 + 0x48u, ADDR_STAT_ARR2);
    w16(ADDR_STATLIST1 + 0x4Cu, 0u);
    w16(ADDR_STATLIST1 + 0x4Eu, 4u);
    w32(ADDR_ITEMDATA1 + 0x2Cu, 30u);
    w8(ADDR_ITEMS_TXT + 0x10Fu, 2u);
    w8(ADDR_ITEMS_TXT + 0x110u, 3u);
    w16(ADDR_ITEMS_TXT + 0x11Eu, 1u);
    w8(ADDR_ITEMS_TXT + 0x138u, 4u);
    w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x1Bu, 4u);
    w32(ADDR_SCRATCH + 0x04u, 2u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 2u * 0xE4u);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t a1[9] = { ADDR_UNIT, ADDR_SCRATCH, 0u, 0u, 0u, 3u, 0u, 0u, 0u };
    uint32_t r1 = call_stdcall9(va, a1[0], a1[1], a1[2], a1[3], a1[4], a1[5], a1[6], a1[7], a1[8]);
    emit_line(fp, va, nm, "override_3_sockets_applied_ret_3", a1, 9, 0xFFFFFFFFu, r1, &s);

    /* v2: nSocketsOverride=0, rolls from pCubeInput (min=2, max=2) -> sets 2 sockets, returns 2 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x24u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x28u, 0u);
    w16(ADDR_STATLIST1 + 0x2Au, 4u);
    w32(ADDR_STATLIST1 + 0x48u, ADDR_STAT_ARR2);
    w16(ADDR_STATLIST1 + 0x4Cu, 0u);
    w16(ADDR_STATLIST1 + 0x4Eu, 4u);
    w32(ADDR_ITEMDATA1 + 0x2Cu, 30u);
    w8(ADDR_ITEMS_TXT + 0x10Fu, 2u);
    w8(ADDR_ITEMS_TXT + 0x110u, 3u);
    w16(ADDR_ITEMS_TXT + 0x11Eu, 1u);
    w8(ADDR_ITEMS_TXT + 0x138u, 4u);
    w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x1Bu, 4u);
    w32(ADDR_SCRATCH + 0x04u, 2u);
    w32(ADDR_SCRATCH + 0x08u, 2u); /* min */
    w32(ADDR_SCRATCH + 0x0Cu, 2u); /* max */
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 2u * 0xE4u);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t a2[9] = { ADDR_UNIT, ADDR_SCRATCH, 0u, 0u, 0u, 0u, 0u, 0u, 0u };
    uint32_t r2 = call_stdcall9(va, a2[0], a2[1], a2[2], a2[3], a2[4], a2[5], a2[6], a2[7], a2[8]);
    emit_line(fp, va, nm, "rolled_2_sockets_applied_ret_2", a2, 9, 0xFFFFFFFFu, r2, &s);
  }

  /* 5. B2-05: 0x6FD9FE80 SKILLS_ScaleValueByMasteryAndSkillParam1 (stdcall pUnit, nSkillId -> eax) */
  {
    const uint32_t va = 0x6FD9FE80u;
    const char *nm = "SKILLS_ScaleValueByMasteryAndSkillParam1113c";
    const uint32_t isc_ids[1] = { 0x19u };

    /* v0: null pUnit -> returns 0 */
    setup_base_tables();
    stage_core(&s);
    snap_capture(&s);
    uint32_t a0[2] = { 0u, 1u };
    uint32_t r0 = call_stdcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "null_unit_ret_0", a0, 2, 0xFFFFFFFFu, r0, &s);

    /* v1: player with state 0x2A active, sublist has stat 0x19 = 80, skill 1 has param1(+0x148) = 4 -> (80*4)/8 = 40 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 0u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x3Cu, ADDR_STATLIST2);
    w32(ADDR_STATLIST1 + 0x64u, 1u << (0x2Au & 31u)); /* state 42 in dword 1 (+0x60 + 4 = +0x64) */
    w32(ADDR_STATLIST2 + 0x10u, 0u);
    w32(ADDR_STATLIST2 + 0x14u, 0x2Au);
    w32(ADDR_STATLIST2 + 0x24u, ADDR_STAT_ARR2);
    w16(ADDR_STATLIST2 + 0x28u, 1u);
    w16(ADDR_STAT_ARR2 + 0x00u, 0u);
    w16(ADDR_STAT_ARR2 + 0x02u, 0x19u);
    w32(ADDR_STAT_ARR2 + 0x04u, 80u);
    w32(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x148u, 4u);
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t a1[2] = { ADDR_UNIT, 1u };
    uint32_t r1 = call_stdcall2(va, a1[0], a1[1]);
    emit_line(fp, va, nm, "state42_active_scales_80_by_4_div8", a1, 2, 0xFFFFFFFFu, r1, &s);
  }

  /* 6. B2-06: 0x6FD9FA30 SKILLS_CanUnitAllocateSkillPoint (stdcall pUnit, nSkillId -> eax) */
  {
    const uint32_t va = 0x6FD9FA30u;
    const char *nm = "SKILLS_CanUnitAllocateSkillPoint113c";
    const uint32_t isc_ids[5] = { 0u, 1u, 2u, 3u, 0x0Cu };

    /* v0: skill lacks flag bit 2 at +0x05 -> returns 0 */
    setup_base_tables();
    w8(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x05u, 0u);
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    snap_capture(&s);
    uint32_t a0[2] = { ADDR_UNIT, 1u };
    uint32_t r0 = call_stdcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "missing_flag_bit2_ret_0", a0, 2, 0xFFFFFFFFu, r0, &s);

    /* v1: flag bit 2 set, unit level 10 >= reqLvl 6, all 4 stat reqs met -> returns 1 */
    setup_base_tables();
    w8(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x05u, 0x04u);
    w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x174u, 6u);  /* wReqLevel = 6 */
    w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x176u, 15u); /* wReqStr = 15 */
    w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x178u, 10u); /* wReqDex = 10 */
    w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x17Au, 5u);  /* wReqInt = 5 */
    w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x17Cu, 12u); /* wReqVit = 12 */
    w32(ADDR_UNIT + 0x00u, 0u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x48u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x4Cu, 5u);
    /* sorted stats: 0 (Str=20), 1 (Int=10), 2 (Dex=15), 3 (Vit=20), 12 (Lvl=10) */
    w16(ADDR_STAT_ARR1 + 0u * 8u + 2u, 0u);    w32(ADDR_STAT_ARR1 + 0u * 8u + 4u, 20u);
    w16(ADDR_STAT_ARR1 + 1u * 8u + 2u, 1u);    w32(ADDR_STAT_ARR1 + 1u * 8u + 4u, 10u);
    w16(ADDR_STAT_ARR1 + 2u * 8u + 2u, 2u);    w32(ADDR_STAT_ARR1 + 2u * 8u + 4u, 15u);
    w16(ADDR_STAT_ARR1 + 3u * 8u + 2u, 3u);    w32(ADDR_STAT_ARR1 + 3u * 8u + 4u, 20u);
    w16(ADDR_STAT_ARR1 + 4u * 8u + 2u, 0x0Cu); w32(ADDR_STAT_ARR1 + 4u * 8u + 4u, 10u);
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    stage_isc(&s, isc_ids, 5);
    snap_capture(&s);
    uint32_t r1 = call_stdcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "all_reqs_satisfied_ret_1", a0, 2, 0xFFFFFFFFu, r1, &s);

    /* v2: wReqStr=30 > unit Str=20 -> returns 0 */
    w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x176u, 30u);
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    stage_isc(&s, isc_ids, 5);
    snap_capture(&s);
    uint32_t r2 = call_stdcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "insufficient_str_ret_0", a0, 2, 0xFFFFFFFFu, r2, &s);
  }

  /* 7. B2-07: 0x6FDA1ED0 SKILLS_RemoveAllCurseAndDebuffStatesFromUnit (stdcall pUnit -> eax) */
  {
    const uint32_t va = 0x6FDA1ED0u;
    const char *nm = "SKILLS_RemoveAllCurseAndDebuffStatesFromUnit113c";

    /* v0: unit without dwFlags2 bit 0x08 -> returns 0 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 0u);
    w32(ADDR_UNIT + 0xC8u, 0u);
    stage_core(&s);
    snap_capture(&s);
    uint32_t a0[1] = { ADDR_UNIT };
    uint32_t r0 = call_stdcall1(va, a0[0]);
    emit_line(fp, va, nm, "no_flag08_ret_0", a0, 1, 0xFFFFFFFFu, r0, &s);

    /* v1: unit with dwFlags2 bit 0x08, passive state 9 active with sublist -> removes sublist, toggles state 9 off, returns 1 */
    setup_base_tables();
    w16(ADDR_DATATABLES + 0x180u, 2u);
    w16(ADDR_PASSIVE_STATES + 0u, 9u);
    w16(ADDR_PASSIVE_STATES + 2u, 15u);
    w32(ADDR_UNIT + 0x00u, 0u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_UNIT + 0xC8u, 0x08u);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x3Cu, ADDR_STATLIST2);
    w32(ADDR_STATLIST1 + 0x60u, 1u << 9u); /* state 9 active in dword 0 */
    w32(ADDR_STATLIST2 + 0x10u, 0u);
    w32(ADDR_STATLIST2 + 0x14u, 9u);
    w32(ADDR_STATLIST2 + 0x34u, ADDR_STATLIST1);
    w8(ADDR_STATES_TXT + 9u * 0x3Cu + 0x12u, 1u); /* disguise bit so it clears 0x08 */
    stage_core(&s);
    snap_add(&s, ADDR_PASSIVE_STATES, 16u);
    snap_add(&s, ADDR_STATES_TXT + 9u * 0x3Cu, 0x3Cu);
    snap_capture(&s);
    uint32_t r1 = call_stdcall1(va, a0[0]);
    emit_line(fp, va, nm, "clears_active_curse_state9_ret_1", a0, 1, 0xFFFFFFFFu, r1, &s);
  }

  /* 8. B2-08: 0x6FD7A480 ITEMS_GetMissileWeaponVelocity (stdcall pItem, nSockets -> void) */
  {
    const uint32_t va = 0x6FD7A480u;
    const char *nm = "ITEMS_GetMissileWeaponVelocity113c";
    const uint32_t isc_ids[1] = { 0xC2u };

    /* v0: Magic item (quality=4, cap=4) on 2x3 item (typeMax=5), requesting 6 sockets -> clamps to 4 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x24u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x28u, 0u);
    w16(ADDR_STATLIST1 + 0x2Au, 4u);
    w32(ADDR_STATLIST1 + 0x48u, ADDR_STAT_ARR2);
    w16(ADDR_STATLIST1 + 0x4Cu, 0u);
    w16(ADDR_STATLIST1 + 0x4Eu, 4u);
    w32(ADDR_ITEMDATA1 + 0x00u, 4u);  /* Magic */
    w32(ADDR_ITEMDATA1 + 0x2Cu, 30u); /* ilvl 30 */
    w8(ADDR_ITEMS_TXT + 0x10Fu, 2u);
    w8(ADDR_ITEMS_TXT + 0x110u, 3u);
    w16(ADDR_ITEMS_TXT + 0x11Eu, 1u);
    w8(ADDR_ITEMS_TXT + 0x138u, 5u);
    w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x1Bu, 5u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 2u * 0xE4u);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t a0[2] = { ADDR_UNIT, 6u };
    call_stdcall2_void(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "magic_quality_clamps_6_to_4", a0, 2, 0u, 0u, &s);

    /* v1: Rare item (quality=6, cap=2) requesting 5 sockets -> clamps to 2 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x24u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x28u, 0u);
    w16(ADDR_STATLIST1 + 0x2Au, 4u);
    w32(ADDR_STATLIST1 + 0x48u, ADDR_STAT_ARR2);
    w16(ADDR_STATLIST1 + 0x4Cu, 0u);
    w16(ADDR_STATLIST1 + 0x4Eu, 4u);
    w32(ADDR_ITEMDATA1 + 0x00u, 6u); /* Rare */
    w32(ADDR_ITEMDATA1 + 0x2Cu, 30u);
    w8(ADDR_ITEMS_TXT + 0x10Fu, 2u);
    w8(ADDR_ITEMS_TXT + 0x110u, 3u);
    w16(ADDR_ITEMS_TXT + 0x11Eu, 1u);
    w8(ADDR_ITEMS_TXT + 0x138u, 5u);
    w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x1Bu, 5u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 2u * 0xE4u);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t a1[2] = { ADDR_UNIT, 5u };
    call_stdcall2_void(va, a1[0], a1[1]);
    emit_line(fp, va, nm, "rare_quality_clamps_5_to_2", a1, 2, 0u, 0u, &s);
  }

  /* 9. B2-09: 0x6FD95E50 ITEMS_EvalItemPropertyList (stdcall pItem, pCubeMainTxt -> eax) */
  {
    const uint32_t va = 0x6FD95E50u;
    const char *nm = "ITEMS_EvalItemPropertyList113c";

    /* v0: expansion item (wVersion=100), subType=1, maxSockets=3, matches include type 1 -> returns 1 */
    setup_base_tables();
    set_equiv_bit(1u, 1u);
    set_equiv_bit(1u, 2u);
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA1);
    w32(ADDR_ITEMDATA1 + 0x2Cu, 30u);
    w16(ADDR_ITEMDATA1 + 0x30u, 100u); /* wVersion = 100 */
    w8(ADDR_ITEMS_TXT + 0x10Fu, 2u);
    w8(ADDR_ITEMS_TXT + 0x110u, 2u);
    w16(ADDR_ITEMS_TXT + 0x11Eu, 1u);  /* wType1 = 1 */
    w8(ADDR_ITEMS_TXT + 0x138u, 3u);   /* nGemSockets = 3 */
    w8(ADDR_ITEMS_TXT + 0x137u, 1u);   /* subType = 1 */
    w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x1Bu, 3u);
    w16(ADDR_SCRATCH + 0x6Au, 1u);     /* include type[0] = 1 */
    w16(ADDR_SCRATCH + 0x78u, 0u);     /* exclude type[0] = 0 */
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 2u * 0xE4u);
    snap_add(&s, ADDR_ITEMTYPES_EQUIV, 0x330u);
    snap_capture(&s);
    uint32_t a0[2] = { ADDR_UNIT, ADDR_SCRATCH };
    uint32_t r0 = call_stdcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "matches_include_type_ret_1", a0, 2, 0xFFFFFFFFu, r0, &s);

    /* v1: matches exclude type 2 -> returns 0 */
    w16(ADDR_SCRATCH + 0x78u, 2u); /* exclude type[0] = 2 */
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 2u * 0xE4u);
    snap_add(&s, ADDR_ITEMTYPES_EQUIV, 0x330u);
    snap_capture(&s);
    uint32_t r1 = call_stdcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "matches_exclude_type_ret_0", a0, 2, 0xFFFFFFFFu, r1, &s);
  }

  /* 10. B2-10: 0x6FD75810 ITEMS_AddChargedSkillsCostContribution (eax=pItem, [esp+4]=nBaseCost -> eax) */
  {
    const uint32_t va = 0x6FD75810u;
    const char *nm = "ITEMS_AddChargedSkillsCostContribution113c";

    /* v0: item with no statlist -> returns 0 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x5Cu, 0u);
    stage_core(&s);
    snap_capture(&s);
    uint32_t a0[2] = { ADDR_UNIT, 1000u };
    uint32_t r0 = call_eax_stack1_ret4(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "no_statlist_ret_0", a0, 2, 0xFFFFFFFFu, r0, &s);

    /* v1: item with 1 partially used charged skill (skillId=1, lvl=3, cur=1, max=4), nBaseCost=1000 */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x48u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x4Cu, 1u);
    w16(ADDR_STAT_ARR1 + 0x00u, (1u << 6) | 3u); /* skillId=1, lvl=3 */
    w16(ADDR_STAT_ARR1 + 0x02u, 0xCCu);
    w32(ADDR_STAT_ARR1 + 0x04u, (4u << 8) | 1u); /* cur=1, max=4 */
    w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x174u, 12u); /* wReqLevel = 12 */
    w32(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x234u, 256u); /* dwCostMult = 256 */
    w32(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x238u, 100u); /* dwCostAdd = 100 */
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    snap_capture(&s);
    uint32_t r1 = call_eax_stack1_ret4(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "depleted_charged_skill_cost", a0, 2, 0xFFFFFFFFu, r1, &s);
  }

  /* 11. B2-11: 0x6FDA0D40 SKILLS_GetWeaponMasteryPassiveStatId (stdcall pUnit, pOutValue -> eax) */
  {
    const uint32_t va = 0x6FDA0D40u;
    const char *nm = "SKILLS_GetWeaponMasteryPassiveStatId113c";
    const uint32_t isc_ids[2] = { 0x9Du, 0x9Eu };

    /* v0: monster (dwUnitType=1) with stat 0x9D (Magic Arrow) = 5 -> writes *pOutValue=5 and returns 0x1B (27) */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 1u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x48u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x4Cu, 1u);
    w16(ADDR_STAT_ARR1 + 0x00u, 0u);
    w16(ADDR_STAT_ARR1 + 0x02u, 0x9Du);
    w32(ADDR_STAT_ARR1 + 0x04u, 5u);
    stage_core(&s);
    stage_isc(&s, isc_ids, 2);
    snap_capture(&s);
    uint32_t a0[2] = { ADDR_UNIT, ADDR_SCRATCH };
    uint32_t r0 = call_stdcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "monster_magic_arrow_ret_27", a0, 2, 0xFFFFFFFFu, r0, &s);

    /* v1: monster with stat 0x9E (Explosive Arrow) = 3 -> writes *pOutValue=3 and returns 0x29 (41) */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 1u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x48u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x4Cu, 1u);
    w16(ADDR_STAT_ARR1 + 0x00u, 0u);
    w16(ADDR_STAT_ARR1 + 0x02u, 0x9Eu);
    w32(ADDR_STAT_ARR1 + 0x04u, 3u);
    stage_core(&s);
    stage_isc(&s, isc_ids, 2);
    snap_capture(&s);
    uint32_t r1 = call_stdcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "monster_explosive_arrow_ret_41", a0, 2, 0xFFFFFFFFu, r1, &s);

    /* v2: player (dwUnitType=0) with no inventory -> returns -1 (0xFFFFFFFF) */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 0u);
    w32(ADDR_UNIT + 0x60u, 0u);
    stage_core(&s);
    stage_isc(&s, isc_ids, 2);
    snap_capture(&s);
    uint32_t r2 = call_stdcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "player_no_weapon_ret_neg1", a0, 2, 0xFFFFFFFFu, r2, &s);
  }

  /* 12. B2-12: 0x6FD9FB30 SKILLS_CheckSkillLevelAndPrereqs (stdcall pUnit, nSkillId -> eax) */
  {
    const uint32_t va = 0x6FD9FB30u;
    const char *nm = "SKILLS_CheckSkillLevelAndPrereqs113c";
    const uint32_t isc_ids[1] = { 0x0Cu };

    /* v0: unit level 2 < skill reqLevel 6 -> returns 0 */
    setup_base_tables();
    w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x174u, 6u);
    w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x17Eu, 0xFFFFu);
    w32(ADDR_UNIT + 0x00u, 0u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x48u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x4Cu, 1u);
    w16(ADDR_STAT_ARR1 + 0x02u, 0x0Cu);
    w32(ADDR_STAT_ARR1 + 0x04u, 2u);
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t a0[2] = { ADDR_UNIT, 1u };
    uint32_t r0 = call_stdcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "below_req_level_ret_0", a0, 2, 0xFFFFFFFFu, r0, &s);

    /* v1: unit level 10 >= reqLevel 6, wReqSkill1=0 learned at base level 2, wReqSkill2=-1 -> returns 1 */
    w32(ADDR_STAT_ARR1 + 0x04u, 10u);
    w16(ADDR_SKILLS_TXT + 0u * 0x23Cu + 0x00u, 0u);
    w16(ADDR_SKILLS_TXT + 0u * 0x23Cu + 0x174u, 1u);
    w16(ADDR_SKILLS_TXT + 0u * 0x23Cu + 0x17Eu, 0xFFFFu);
    w16(ADDR_SKILLS_TXT + 0u * 0x23Cu + 0x180u, 0xFFFFu);
    w16(ADDR_SKILLS_TXT + 0u * 0x23Cu + 0x182u, 0xFFFFu);
    w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x00u, 1u);
    w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x17Eu, 0u);      /* wReqSkill1 = 0 */
    w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x180u, 0xFFFFu); /* wReqSkill2 = -1 */
    w16(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x182u, 0xFFFFu); /* wReqSkill3 = -1 */
    w32(ADDR_UNIT + 0xA8u, ADDR_SKILL_LIST);
    w32(ADDR_SKILL_LIST + 0x04u, ADDR_SKILL0);
    w32(ADDR_SKILL0 + 0x00u, ADDR_SKILLS_TXT + 0u * 0x23Cu);
    w32(ADDR_SKILL0 + 0x28u, 2u); /* nSkillLevel = 2 */
    w32(ADDR_SKILL0 + 0x34u, 0xFFFFFFFFu); /* dwItemId = -1 */
    w32(ADDR_SKILL0 + 0x3Cu, 0u); /* dwFlags = 0 */
    stage_core(&s);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    stage_isc(&s, isc_ids, 1);
    snap_capture(&s);
    uint32_t r1 = call_stdcall2(va, a0[0], a0[1]);
    emit_line(fp, va, nm, "prereq_skill0_learned_ret_1", a0, 2, 0xFFFFFFFFu, r1, &s);
  }

  /* 13. B2-13: 0x6FD75970 ITEMS_AddSingleSkillStatsCostContribution (eax=pItem, [esp+4]=pBuy, [esp+8]=pSell, [esp+0xC]=pRepair, [esp+0x10]=nDivisor -> void) */
  {
    const uint32_t va = 0x6FD75970u;
    const char *nm = "ITEMS_AddSingleSkillStatsCostContribution113c";

    /* v0: non-class-specific item (pItemTypeTxt->nClass(+0x1F) == 7) -> no-op */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w16(ADDR_ITEMS_TXT + 0x11Eu, 1u);
    w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x1Fu, 7u);
    w32(ADDR_SCRATCH + 0x00u, 1000u);
    w32(ADDR_SCRATCH + 0x04u, 500u);
    w32(ADDR_SCRATCH + 0x08u, 200u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 2u * 0xE4u);
    snap_capture(&s);
    uint32_t a0[5] = { ADDR_UNIT, ADDR_SCRATCH, ADDR_SCRATCH + 4u, ADDR_SCRATCH + 8u, 2u };
    call_eax_stack4_ret16_void(va, a0[0], a0[1], a0[2], a0[3], a0[4]);
    emit_line(fp, va, nm, "non_class_item_noop", a0, 5, 0u, 0u, &s);

    /* v1: class-specific item (nClass=3) with single skill (stat 0x6B: skillId=1, lvl=2), buy<=0xFFFF -> adds cost contributions */
    setup_base_tables();
    w32(ADDR_UNIT + 0x00u, 4u);
    w32(ADDR_UNIT + 0x04u, 0u);
    w32(ADDR_UNIT + 0x5Cu, ADDR_STATLIST1);
    w32(ADDR_STATLIST1 + 0x10u, 0x80000000u);
    w32(ADDR_STATLIST1 + 0x48u, ADDR_STAT_ARR1);
    w16(ADDR_STATLIST1 + 0x4Cu, 1u);
    w16(ADDR_STAT_ARR1 + 0x00u, 1u);    /* skillId = 1 */
    w16(ADDR_STAT_ARR1 + 0x02u, 0x6Bu); /* STAT_ITEM_SINGLESKILL */
    w32(ADDR_STAT_ARR1 + 0x04u, 2u);    /* level = 2 -> mult = 3 */
    w16(ADDR_ITEMS_TXT + 0x11Eu, 1u);
    w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x1Fu, 3u);
    w32(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x234u, 512u); /* costMult = 512 */
    w32(ADDR_SKILLS_TXT + 1u * 0x23Cu + 0x238u, 40u);  /* costAdd = 40 */
    w32(ADDR_SCRATCH + 0x00u, 2000u);
    w32(ADDR_SCRATCH + 0x04u, 1000u);
    w32(ADDR_SCRATCH + 0x08u, 400u);
    stage_core(&s);
    snap_add(&s, ADDR_ITEMS_TXT, 0x1A8u);
    snap_add(&s, ADDR_ITEMTYPES_TXT, 2u * 0xE4u);
    snap_add(&s, ADDR_SKILLS_TXT, 2u * 0x23Cu);
    snap_capture(&s);
    call_eax_stack4_ret16_void(va, a0[0], a0[1], a0[2], a0[3], a0[4]);
    emit_line(fp, va, nm, "class_item_single_skill_adds_costs", a0, 5, 0u, 0u, &s);
  }

  /* 14. B2-14: 0x6FD91730 DRLGOUTPLACE_SpawnAct5Barricade421Preset (edi=pLevel -> void) */
  {
    const uint32_t va = 0x6FD91730u;
    const char *nm = "DRLGOUTPLACE_SpawnAct5Barricade421Preset113c";

    /* v0: non-Frigid Highlands level (levelId=1 != 0x6F) -> immediate return */
    setup_base_tables();
    setup_drlg_grid_fixture(8u, 8u, 1u, 0u);
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_capture(&s);
    uint32_t a0[1] = { ADDR_LEVEL };
    call_edi_void(va, a0[0]);
    emit_line(fp, va, nm, "non_act5_level_early_exit", a0, 1, 0u, 0u, &s);

    /* v1: levelId=0x6F (111), all even cells have pGrid2=0x200 and pGrid0=0x393 -> places 3 presets in Phase 1 */
    setup_base_tables();
    setup_drlg_grid_fixture(8u, 8u, 0x6Fu, 0u);
    w32(VA_LVLPREST_PTR, ADDR_LVLPREST_HIGH - 0x361u * 0x1B0u);
    memset((void *)(uintptr_t)ADDR_LVLPREST_HIGH, 0, 125u * 0x1B0u);
    for (uint32_t i = 0; i < 125u; i++) {
      w32(ADDR_LVLPREST_HIGH + i * 0x1B0u + 0x00u, 0x361u + i);
      w32(ADDR_LVLPREST_HIGH + i * 0x1B0u + 0x28u, 8u);
      w32(ADDR_LVLPREST_HIGH + i * 0x1B0u + 0x2Cu, 8u);
      w32(ADDR_LVLPREST_HIGH + i * 0x1B0u + 0x40u, 2u);
    }
    for (uint32_t y = 0; y < 8u; y++) {
      for (uint32_t x = 0; x < 8u; x++) {
        w32(ADDR_GRID2_CELLS + (y * 16u + x) * 4u, 0x200u);
        w32(ADDR_GRID0_CELLS + (y * 16u + x) * 4u, 0x393u);
      }
    }
    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_add(&s, ADDR_LVLPREST_HIGH + (0x3A3u - 0x361u) * 0x1B0u, 2u * 0x1B0u);
    snap_capture(&s);
    call_edi_void(va, a0[0]);
    emit_line(fp, va, nm, "act5_barricade_spawns_3_presets", a0, 1, 0u, 0u, &s);
  }

  /* 15. B2-15: 0x6FD91340 DRLGOUTPLACE_ConnectOutdoorsRoomsAndPlaceWalls (stdcall pLevel -> void) */
  {
    const uint32_t va = 0x6FD91340u;
    const char *nm = "DRLGOUTPLACE_ConnectOutdoorsRoomsAndPlaceWalls113c";

    /* Setup a 4-vertex rectangle (0,0)->(4,0)->(4,4)->(0,4) in ADDR_VERTEX_RING */
    /* v0: levelId=0x70 (112, Arreat Plateau), vertex[0] has dwFlags=1 (places 0x400), vertices[1..3] have dwFlags=2 (skip wall segments) */
    setup_base_tables();
    setup_drlg_grid_fixture(8u, 8u, 0x70u, 0u);
    w32(VA_LVLPREST_PTR, ADDR_LVLPREST_HIGH - 0x361u * 0x1B0u);
    memset((void *)(uintptr_t)ADDR_LVLPREST_HIGH, 0, 125u * 0x1B0u);
    for (uint32_t i = 0; i < 125u; i++) {
      w32(ADDR_LVLPREST_HIGH + i * 0x1B0u + 0x00u, 0x361u + i);
      w32(ADDR_LVLPREST_HIGH + i * 0x1B0u + 0x28u, 8u);
      w32(ADDR_LVLPREST_HIGH + i * 0x1B0u + 0x2Cu, 8u);
      w32(ADDR_LVLPREST_HIGH + i * 0x1B0u + 0x40u, 2u);
    }
    w32(ADDR_OUTDOORS + 0x64u, ADDR_VERTEX_RING);
    /* V0: (0,0) -> V1 (4,0), flags=1 */
    w32(ADDR_VERTEX_RING + 0x00u + 0x00u, 0u);
    w32(ADDR_VERTEX_RING + 0x00u + 0x04u, 0u);
    w32(ADDR_VERTEX_RING + 0x00u + 0x0Cu, 1u);
    w32(ADDR_VERTEX_RING + 0x00u + 0x10u, ADDR_VERTEX_RING + 0x18u);
    /* V1: (4,0) -> V2 (4,4), flags=2 */
    w32(ADDR_VERTEX_RING + 0x18u + 0x00u, 4u);
    w32(ADDR_VERTEX_RING + 0x18u + 0x04u, 0u);
    w32(ADDR_VERTEX_RING + 0x18u + 0x0Cu, 2u);
    w32(ADDR_VERTEX_RING + 0x18u + 0x10u, ADDR_VERTEX_RING + 0x30u);
    /* V2: (4,4) -> V3 (0,4), flags=2 */
    w32(ADDR_VERTEX_RING + 0x30u + 0x00u, 4u);
    w32(ADDR_VERTEX_RING + 0x30u + 0x04u, 4u);
    w32(ADDR_VERTEX_RING + 0x30u + 0x0Cu, 2u);
    w32(ADDR_VERTEX_RING + 0x30u + 0x10u, ADDR_VERTEX_RING + 0x48u);
    /* V3: (0,4) -> V0 (0,0), flags=2 */
    w32(ADDR_VERTEX_RING + 0x48u + 0x00u, 0u);
    w32(ADDR_VERTEX_RING + 0x48u + 0x04u, 4u);
    w32(ADDR_VERTEX_RING + 0x48u + 0x0Cu, 2u);
    w32(ADDR_VERTEX_RING + 0x48u + 0x10u, ADDR_VERTEX_RING + 0x00u);

    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_add(&s, ADDR_LVLPREST_HIGH + (0x371u - 0x361u) * 0x1B0u, 18u * 0x1B0u);
    snap_capture(&s);
    uint32_t a0[1] = { ADDR_LEVEL };
    call_stdcall1_void(va, a0[0]);
    emit_line(fp, va, nm, "level112_vertex_ring_places_walls_and_corners", a0, 1, 0u, 0u, &s);

    /* v1: levelId=0x6F (111, Frigid Highlands) -> also sets 0x400 on bottom-right pGrid2 cells (w-2, h-4) and (w-2, h-3) */
    setup_base_tables();
    setup_drlg_grid_fixture(8u, 8u, 0x6Fu, 0u);
    w32(VA_LVLPREST_PTR, ADDR_LVLPREST_HIGH - 0x361u * 0x1B0u);
    memset((void *)(uintptr_t)ADDR_LVLPREST_HIGH, 0, 125u * 0x1B0u);
    for (uint32_t i = 0; i < 125u; i++) {
      w32(ADDR_LVLPREST_HIGH + i * 0x1B0u + 0x00u, 0x361u + i);
      w32(ADDR_LVLPREST_HIGH + i * 0x1B0u + 0x28u, 8u);
      w32(ADDR_LVLPREST_HIGH + i * 0x1B0u + 0x2Cu, 8u);
      w32(ADDR_LVLPREST_HIGH + i * 0x1B0u + 0x40u, 2u);
    }
    w32(ADDR_OUTDOORS + 0x64u, ADDR_VERTEX_RING);
    w32(ADDR_VERTEX_RING + 0x00u + 0x00u, 0u);
    w32(ADDR_VERTEX_RING + 0x00u + 0x04u, 0u);
    w32(ADDR_VERTEX_RING + 0x00u + 0x0Cu, 2u);
    w32(ADDR_VERTEX_RING + 0x00u + 0x10u, ADDR_VERTEX_RING + 0x18u);
    w32(ADDR_VERTEX_RING + 0x18u + 0x00u, 4u);
    w32(ADDR_VERTEX_RING + 0x18u + 0x04u, 0u);
    w32(ADDR_VERTEX_RING + 0x18u + 0x0Cu, 2u);
    w32(ADDR_VERTEX_RING + 0x18u + 0x10u, ADDR_VERTEX_RING + 0x30u);
    w32(ADDR_VERTEX_RING + 0x30u + 0x00u, 4u);
    w32(ADDR_VERTEX_RING + 0x30u + 0x04u, 4u);
    w32(ADDR_VERTEX_RING + 0x30u + 0x0Cu, 2u);
    w32(ADDR_VERTEX_RING + 0x30u + 0x10u, ADDR_VERTEX_RING + 0x48u);
    w32(ADDR_VERTEX_RING + 0x48u + 0x00u, 0u);
    w32(ADDR_VERTEX_RING + 0x48u + 0x04u, 4u);
    w32(ADDR_VERTEX_RING + 0x48u + 0x0Cu, 2u);
    w32(ADDR_VERTEX_RING + 0x48u + 0x10u, ADDR_VERTEX_RING + 0x00u);

    stage_core(&s);
    snap_add(&s, ADDR_GRID0_ROWS, 0x880u);
    snap_add(&s, ADDR_LVLPREST_HIGH + (0x371u - 0x361u) * 0x1B0u, 18u * 0x1B0u);
    snap_capture(&s);
    call_stdcall1_void(va, a0[0]);
    emit_line(fp, va, nm, "level111_sets_bottom_right_grid2_flags", a0, 1, 0u, 0u, &s);
  }
}

int main(int argc, char **argv) {
  if (argc < 3) {
    fprintf(stderr, "Usage: %s <i11b-1.ndjson> <i11b-2.ndjson>\n", argv[0]);
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
  emit_i11b_1(fp1);
  fclose(fp1);

  FILE *fp2 = fopen(argv[2], "wb");
  if (!fp2) {
    fprintf(stderr, "Cannot open %s\n", argv[2]);
    return 6;
  }
  emit_i11b_2(fp2);
  fclose(fp2);

  return 0;
}
