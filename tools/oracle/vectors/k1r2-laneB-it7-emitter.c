/*
 * Standalone MinGW real-DLL differential vector emitter for K1r2 Iteration 7 Lane B:
 * - Batch B033 (18 D2Common.dll v1.13c hostImport functions in tables/datatbls-113c.ts)
 * - Batch B036 (24 net-new D2Common.dll v1.13c hostImport functions across common/skills.ts,
 *   tables/anim-tbls-113c.ts, tables/field-tbls-113c.ts, and tables/item-tbls-113c.ts)
 *
 * Loads the real Diablo II v1.13c Storm.dll, Fog.dll (image base 0x6FF50000), and D2Common.dll
 * (image base 0x6FD50000), allocates a deterministic scratch arena at 0x20000000 and bump heap
 * at 0x40000000 matching SparseMemory113c.alloc(size), invokes each real D2Common.dll entry
 * point via register-only inline assembly thunks (zero stack-memory constraints), and emits
 * b033-vectors.ndjson and b036-vectors.ndjson.
 */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define ARENA_BASE 0x20000000u
#define ARENA_SIZE 0x00100000u
#define HEAP_BASE  0x40000000u
#define HEAP_SIZE  0x00100000u

/* Deterministic layout within ARENA_BASE (0x20000000) */
#define ADDR_UNIT          0x20000100u /* 244 bytes: D2UnitStrc #1 */
#define ADDR_TARGET_UNIT   0x20000200u /* 244 bytes: D2UnitStrc #2 (target unit) */
#define ADDR_DYN_PATH      0x20000300u /* 512 bytes: D2DynamicPathStrc #1 */
#define ADDR_TARGET_PATH   0x20000500u /* 512 bytes: D2DynamicPathStrc / D2StaticPathStrc #2 */
#define ADDR_OUT_PAIR      0x20000700u /* 16 bytes:  out0, out1, coords, gridInfo */
#define ADDR_GRID_OUT      0x20000740u /* 24 bytes:  inventory grid info output */
#define ADDR_SKILL_LIST    0x20000800u /* 24 bytes:  D2SkillListStrc */
#define ADDR_SKILL0        0x20000840u /* 64 bytes:  D2SkillStrc #0 */
#define ADDR_SKILL1        0x20000880u /* 64 bytes:  D2SkillStrc #1 */
#define ADDR_SKILL2        0x200008C0u /* 64 bytes:  D2SkillStrc #2 */
#define ADDR_SKILL_OUTS    0x20000900u /* 16 bytes:  pOutItemGuid, pOutSkillId, pOutLevel, pOutCharges */
#define ADDR_STR1          0x20000940u /* 16 bytes:  string buffer 1 for 0x6FD91D00 */
#define ADDR_STR2          0x20000960u /* 16 bytes:  string buffer 2 for 0x6FD91D00 */
#define ADDR_FIELD         0x20000980u /* 16 bytes:  D2FieldStrc */
#define ADDR_FIELD_XY      0x200009A0u /* 8 bytes:   int32 X, int32 Y */
#define ADDR_LINK          0x20000A00u /* 16 bytes:  Fog.#10213 linker header */
#define ADDR_LINK_ENTRIES  0x20000A40u /* 24 bytes:  3 * 8-byte {dwCode, nIndex} entries */
#define ADDR_LVLSUB_LUT    0x20000AC0u /* 32 bytes:  8 int32 subtype -> row indices */
#define ADDR_DATATABLES    0x20001000u /* 0xD00 bytes: synthetic D2DataTablesStrc */
#define ADDR_MONSTATS_TXT  0x20002000u /* 4 * 0x1A8 (424) = 1696 bytes */
#define ADDR_ITEMS_TXT     0x20003000u /* 4 * 0x1A8 (424) = 1696 bytes */
#define ADDR_OBJGROUP_TXT  0x20004000u /* 4 * 0xB8  (184) = 736 bytes */
#define ADDR_LVLSUB_TXT    0x20004400u /* 6 * 0x15C (348) = 2088 bytes */
#define ADDR_LVLWARP_TXT   0x20005000u /* 4 * 0x30  (48)  = 192 bytes */
#define ADDR_BOOKS_TXT     0x20005200u /* 4 * 0x22  (34)  = 136 bytes */
#define ADDR_QUALITEMS_TXT 0x20005400u /* 4 * 0x20  (32)  = 128 bytes */
#define ADDR_GEMS_TXT      0x20005600u /* 4 * 0xC0  (192) = 768 bytes */
#define ADDR_BELTS_TXT     0x20005A00u /* 4 * 0x70  (112) = 448 bytes */
#define ADDR_MAGAFFIX_TXT  0x20005E00u /* 4 * 0x90  (144) = 576 bytes */
#define ADDR_ARENA_TXT     0x20006200u /* 4 * 0x1C  (28)  = 112 bytes (base at +2*0x1C) */
#define ADDR_CHARTMPL_TXT  0x20006400u /* 6 * 0xF0  (240) = 1440 bytes */
#define ADDR_INVENTORY_TXT 0x20007000u /* 20 * 0xF0 (240) = 4800 bytes */
#define ADDR_SKILLS_TXT    0x20009000u /* 4 * 0x23C (572) = 2288 bytes */
#define ADDR_FIELD_MATRIX  0x2000A000u /* 16 * 256        = 4096 bytes */

/* D2Common.dll & Fog.dll static globals */
#define VA_MONSTER_VEL_TBL      0x6FDE4E78u
#define VA_FIELD_DIR_DX         0x6FDE9BA0u
#define VA_FIELD_DIR_DY         0x6FDE9BC4u
#define VA_SGPT_DATATABLES      0x6FDE9E1Cu
#define VA_INVENTORY_TXT_MAX    0x6FDEFA58u
#define VA_INVENTORY_TXT_PTR    0x6FDEFA5Cu
#define VA_CHARTMPL_CLASS_START 0x6FDEFA60u
#define VA_ITEMS_TXT_COUNT      0x6FDEFB94u
#define VA_ITEMS_TXT_PTR        0x6FDEFB98u
#define VA_MAGICAFFIX_COUNT     0x6FDEFBB8u
#define VA_MAGICAFFIX_PTR       0x6FDEFBBCu
#define VA_GEMS_COUNT           0x6FDEFBCCu
#define VA_GEMS_PTR             0x6FDEFBD0u
#define VA_BELTS_COUNT          0x6FDEFD90u
#define VA_BELTS_PTR            0x6FDEFD94u
#define VA_BOOKS_COUNT          0x6FDEFD98u
#define VA_BOOKS_PTR            0x6FDEFD9Cu
#define VA_QUALITEMS_COUNT      0x6FDEFDA0u
#define VA_QUALITEMS_PTR        0x6FDEFDA4u
#define VA_ITEMS_LINKER_PTR     0x6FDEFF6Cu
#define VA_MONSTATS_PTR         0x6FDF0950u
#define VA_MONSTATS_COUNT       0x6FDF0958u
#define VA_OBJGROUP_PTR         0x6FDF0B8Cu
#define VA_OBJGROUP_COUNT       0x6FDF0B90u
#define VA_CHARTMPL_PTR         0x6FDF13F8u
#define VA_CHARTMPL_COUNT       0x6FDF13FCu
#define VA_ARENA_PTR            0x6FDF1400u
#define VA_FIELD_DATA_PTR       0x6FDF1404u
#define VA_FIELD_CENTER_X       0x6FDF1414u
#define VA_FIELD_CENTER_Y       0x6FDF1418u
#define VA_LVLWARP_PTR          0x6FDF142Cu
#define VA_LVLWARP_COUNT        0x6FDF1430u
#define VA_LVLSUB_PTR           0x6FDF143Cu
#define VA_LVLSUB_COUNT         0x6FDF1440u
#define VA_LVLSUB_LUT_PTR       0x6FDF1444u
#define VA_FOG_TRIG_LUT         0x6FF7F470u

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
 * Custom Register & Standard Calling Convention Wrappers (Zero stack-memory operands)
 * ========================================================================= */

static uint32_t call_stdcall0(uintptr_t fn) {
  typedef uint32_t (__stdcall *Fn0)(void);
  return ((Fn0)fn)();
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

static uint32_t call_stdcall5(
  uintptr_t fn,
  uint32_t a0,
  uint32_t a1,
  uint32_t a2,
  uint32_t a3,
  uint32_t a4
) {
  typedef uint32_t (__stdcall *Fn5)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
  return ((Fn5)fn)(a0, a1, a2, a3, a4);
}

static uint32_t call_fastcall1(uintptr_t fn, uint32_t ecx_in) {
  typedef uint32_t (__fastcall *FnF1)(uint32_t);
  return ((FnF1)fn)(ecx_in);
}

static uint32_t call_fastcall2(uintptr_t fn, uint32_t ecx_in, uint32_t edx_in) {
  typedef uint32_t (__fastcall *FnF2)(uint32_t, uint32_t);
  return ((FnF2)fn)(ecx_in, edx_in);
}

/* 0x6FD8E310: edx=pDynamicPath, edi=pOutCoordsWordPair, plain ret -> void */
static __attribute__((noinline)) void call_edx_edi_ret(
  uintptr_t fn,
  uint32_t edx_in,
  uint32_t edi_in
) {
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "+d"(edx_in), "+D"(edi_in)
    : [fn]"a"(fn)
    : "ecx", "ebx", "esi", "cc", "memory", "st"
  );
}

/* 0x6FDBC4D0: edx=nSubType, plain ret -> eax */
static __attribute__((noinline)) uint32_t call_edx_ret(uintptr_t fn, uint32_t edx_in) {
  uint32_t out;
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "=a"(out), "+d"(edx_in)
    : [fn]"c"(fn)
    : "ebx", "esi", "edi", "cc", "memory"
  );
  return out;
}

/* 0x6FDBC5D0: ebx=nWarpId, dl=cDirection, plain ret -> eax */
static __attribute__((noinline)) uint32_t call_ebx_edx_ret(
  uintptr_t fn,
  uint32_t ebx_in,
  uint32_t edx_in
) {
  uint32_t out;
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "=a"(out), "+b"(ebx_in), "+d"(edx_in)
    : [fn]"c"(fn)
    : "esi", "edi", "cc", "memory"
  );
  return out;
}

/* 0x6FD9EB40: eax=pUnit, ecx=pSkillsTxt, plain ret -> eax */
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
 * Common Arena Initialization
 * ========================================================================= */

static void clear_arena(void) {
  memset((void *)(uintptr_t)ARENA_BASE, 0, 0x18000u);
  reset_heap();

  /* 1. MonStatsTxt (4 records * 0x1A8) */
  w32(VA_MONSTATS_PTR, ADDR_MONSTATS_TXT);
  w32(VA_MONSTATS_COUNT, 4u);
  for (uint32_t i = 0; i < 4; i++) {
    w8(ADDR_MONSTATS_TXT + i * 0x1A8u + 0x4Bu, (uint8_t)i);
  }

  /* 2. ItemsTxt (4 records * 0x1A8) + Fog.#10213 linker */
  w32(VA_ITEMS_TXT_COUNT, 4u);
  w32(VA_ITEMS_TXT_PTR, ADDR_ITEMS_TXT);
  w32(VA_ITEMS_LINKER_PTR, ADDR_LINK);

  /* Record 0: 'hax ' */
  w32(ADDR_ITEMS_TXT + 0 * 0x1A8u + 0x80u, 0x20786168u);
  w32(ADDR_ITEMS_TXT + 0 * 0x1A8u + 0xC4u, 0x20736831u); /* dw2HandedWClass = '1hs ' */
  w8(ADDR_ITEMS_TXT + 0 * 0x1A8u + 0xFDu, 12u);           /* nLevel = 12 */
  w8(ADDR_ITEMS_TXT + 0 * 0x1A8u + 0x11Du, 0u);           /* nUseable = 0 */
  w8(ADDR_ITEMS_TXT + 0 * 0x1A8u + 0x129u, 0u);           /* nUnique = 0 */

  /* Record 1: 'cap ' */
  w32(ADDR_ITEMS_TXT + 1 * 0x1A8u + 0x80u, 0x20706163u);
  w32(ADDR_ITEMS_TXT + 1 * 0x1A8u + 0xC4u, 0x20736832u); /* dw2HandedWClass = '2hs ' */
  w8(ADDR_ITEMS_TXT + 1 * 0x1A8u + 0xFDu, 85u);           /* nLevel = 85 */
  w8(ADDR_ITEMS_TXT + 1 * 0x1A8u + 0x11Du, 1u);           /* nUseable = 1 */
  w8(ADDR_ITEMS_TXT + 1 * 0x1A8u + 0x129u, 1u);           /* nUnique = 1 */

  /* Record 2: 'tsc ' */
  w32(ADDR_ITEMS_TXT + 2 * 0x1A8u + 0x80u, 0x20637374u);
  w32(ADDR_ITEMS_TXT + 2 * 0x1A8u + 0xC4u, 0x20667473u); /* dw2HandedWClass = 'stf ' */
  w8(ADDR_ITEMS_TXT + 2 * 0x1A8u + 0xFDu, 250u);          /* nLevel = 250 */
  w8(ADDR_ITEMS_TXT + 2 * 0x1A8u + 0x11Du, 1u);           /* nUseable = 1 */
  w8(ADDR_ITEMS_TXT + 2 * 0x1A8u + 0x129u, 255u);         /* nUnique = 255 */

  /* Sorted linker entries: [0]='tsc '->2, [1]='cap '->1, [2]='hax '->0 */
  w32(ADDR_LINK + 0x00u, 3u);
  w32(ADDR_LINK + 0x08u, ADDR_LINK_ENTRIES);
  w32(ADDR_LINK_ENTRIES + 0x00u, 0x20637374u);
  w32(ADDR_LINK_ENTRIES + 0x04u, 2u);
  w32(ADDR_LINK_ENTRIES + 0x08u, 0x20706163u);
  w32(ADDR_LINK_ENTRIES + 0x0Cu, 1u);
  w32(ADDR_LINK_ENTRIES + 0x10u, 0x20786168u);
  w32(ADDR_LINK_ENTRIES + 0x14u, 0u);

  /* 3. ObjGroupTxt (4 records * 0xB8) */
  w32(VA_OBJGROUP_PTR, ADDR_OBJGROUP_TXT);
  w32(VA_OBJGROUP_COUNT, 4u);

  /* 4. LvlSubTxt (6 records * 0x15C) + LvlSubTypeStart LUT */
  w32(VA_LVLSUB_PTR, ADDR_LVLSUB_TXT);
  w32(VA_LVLSUB_COUNT, 6u);
  w32(VA_LVLSUB_LUT_PTR, ADDR_LVLSUB_LUT);
  w32(ADDR_LVLSUB_LUT + 0 * 4u, 2u);
  w32(ADDR_LVLSUB_LUT + 1 * 4u, 0u);
  w32(ADDR_LVLSUB_LUT + 2 * 4u, 4u);
  w32(ADDR_LVLSUB_LUT + 3 * 4u, 5u);

  /* 5. LvlWarpTxt (4 records * 0x30) */
  w32(VA_LVLWARP_PTR, ADDR_LVLWARP_TXT);
  w32(VA_LVLWARP_COUNT, 4u);
  w32(ADDR_LVLWARP_TXT + 0 * 0x30u + 0x00u, 10u);
  w8(ADDR_LVLWARP_TXT + 0 * 0x30u + 0x2Cu, (uint8_t)'l');
  w32(ADDR_LVLWARP_TXT + 1 * 0x30u + 0x00u, 20u);
  w8(ADDR_LVLWARP_TXT + 1 * 0x30u + 0x2Cu, (uint8_t)'b');
  w32(ADDR_LVLWARP_TXT + 2 * 0x30u + 0x00u, 30u);
  w8(ADDR_LVLWARP_TXT + 2 * 0x30u + 0x2Cu, (uint8_t)'l');
  w32(ADDR_LVLWARP_TXT + 3 * 0x30u + 0x00u, 30u);
  w8(ADDR_LVLWARP_TXT + 3 * 0x30u + 0x2Cu, (uint8_t)'r');

  /* 6. Books, QualityItems, Gems, Belts, MagicAffix */
  w32(VA_BOOKS_COUNT, 4u);
  w32(VA_BOOKS_PTR, ADDR_BOOKS_TXT);
  w32(VA_QUALITEMS_COUNT, 4u);
  w32(VA_QUALITEMS_PTR, ADDR_QUALITEMS_TXT);
  w32(VA_GEMS_COUNT, 4u);
  w32(VA_GEMS_PTR, ADDR_GEMS_TXT);
  w32(VA_BELTS_COUNT, 4u);
  w32(VA_BELTS_PTR, ADDR_BELTS_TXT);
  w32(VA_MAGICAFFIX_COUNT, 4u);
  w32(VA_MAGICAFFIX_PTR, ADDR_MAGAFFIX_TXT);

  /* 7. ArenaTxt (set base to ADDR_ARENA_TXT + 2 * 0x1C so negative indices -1, -2 stay in buffer) */
  w32(VA_ARENA_PTR, ADDR_ARENA_TXT + 2u * 0x1Cu);

  /* 8. CharTemplateTxt (6 records * 0xF0) + class start LUT */
  w32(VA_CHARTMPL_PTR, ADDR_CHARTMPL_TXT);
  w32(VA_CHARTMPL_COUNT, 6u);
  w32(VA_CHARTMPL_CLASS_START + 0 * 4u, 0u);
  w32(VA_CHARTMPL_CLASS_START + 1 * 4u, 2u);
  w32(VA_CHARTMPL_CLASS_START + 2 * 4u, 4u);
  w8(ADDR_CHARTMPL_TXT + 0 * 0xF0u + 0x1Eu, 1u);
  w8(ADDR_CHARTMPL_TXT + 1 * 0xF0u + 0x1Eu, 15u);
  w8(ADDR_CHARTMPL_TXT + 2 * 0xF0u + 0x1Eu, 20u);
  w8(ADDR_CHARTMPL_TXT + 3 * 0xF0u + 0x1Eu, 33u);
  w8(ADDR_CHARTMPL_TXT + 4 * 0xF0u + 0x1Eu, 45u);
  w8(ADDR_CHARTMPL_TXT + 5 * 0xF0u + 0x1Eu, 60u);

  /* 9. InventoryTxt (20 records * 0xF0) */
  w32(VA_INVENTORY_TXT_MAX, 19u);
  w32(VA_INVENTORY_TXT_PTR, ADDR_INVENTORY_TXT);
  for (uint32_t r = 0; r < 20; r++) {
    for (uint32_t k = 0; k < 6; k++) {
      w32(ADDR_INVENTORY_TXT + r * 0xF0u + 0x10u + k * 4u, (r + 1u) * 100u + k + 1u);
    }
  }

  /* 10. sgptDataTables + SkillsTxt (4 records * 0x23C) */
  w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);
  w32(ADDR_DATATABLES + 0xB98u, ADDR_SKILLS_TXT);
  w32(ADDR_DATATABLES + 0xBA0u, 4u);
  /* Skill 0: wSkillId=0, nManaShift=8, wMana=10, wLvlMana=2 */
  w16(ADDR_SKILLS_TXT + 0 * 0x23Cu + 0x00u, 0u);
  w8(ADDR_SKILLS_TXT + 0 * 0x23Cu + 0x188u, 8u);
  w16(ADDR_SKILLS_TXT + 0 * 0x23Cu + 0x18Au, 10u);
  w16(ADDR_SKILLS_TXT + 0 * 0x23Cu + 0x18Cu, 2u);
  /* Skill 1: wSkillId=1, nManaShift=7, wMana=15, wLvlMana=3 */
  w16(ADDR_SKILLS_TXT + 1 * 0x23Cu + 0x00u, 1u);
  w8(ADDR_SKILLS_TXT + 1 * 0x23Cu + 0x188u, 7u);
  w16(ADDR_SKILLS_TXT + 1 * 0x23Cu + 0x18Au, 15u);
  w16(ADDR_SKILLS_TXT + 1 * 0x23Cu + 0x18Cu, 3u);
  /* Skill 2: wSkillId=2, nManaShift=8, wMana=-10, wLvlMana=-2 (negative mana clamps to 0) */
  w16(ADDR_SKILLS_TXT + 2 * 0x23Cu + 0x00u, 2u);
  w8(ADDR_SKILLS_TXT + 2 * 0x23Cu + 0x188u, 8u);
  w16(ADDR_SKILLS_TXT + 2 * 0x23Cu + 0x18Au, (uint16_t)-10);
  w16(ADDR_SKILLS_TXT + 2 * 0x23Cu + 0x18Cu, (uint16_t)-2);

  /* 11. Field globals */
  w32(VA_FIELD_DATA_PTR, ADDR_FIELD_MATRIX);
  w32(VA_FIELD_CENTER_X, 4u);
  w32(VA_FIELD_CENTER_Y, 4u);
}

/* =========================================================================
 * Batch B033 Vector Emission (18 Functions)
 * ========================================================================= */

static void emit_b033(FILE *fp) {
  uint8_t *pre_bufs[16];

  /* 1. 0x6FD6A330 MONSTER_GetSubClassVelocityInfo (stdcall pUnit, pOut0, pOut1) */
  {
    const uint32_t va = 0x6FD6A330u;
    const char *nm = "MONSTER_GetSubClassVelocityInfo";
    struct {
      const char *id;
      int32_t class_id;
    } cases[] = {
      { "class_neg1_fallback_idx0", -1 },
      { "class_ge_count_fallback_idx0", 5 },
      { "class_0_subclass_idx0", 0 },
      { "class_1_subclass_idx1", 1 },
      { "class_2_subclass_idx2", 2 },
      { "class_3_subclass_idx3", 3 }
    };
    for (int i = 0; i < 6; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 1u);
      w32(ADDR_UNIT + 0x04u, (uint32_t)cases[i].class_id);
      w32(ADDR_OUT_PAIR + 0x00u, 0xAAAAAAAAu);
      w32(ADDR_OUT_PAIR + 0x04u, 0xBBBBBBBBu);
      RangeSpec pre[] = {
        { VA_MONSTATS_PTR, 12 },
        { VA_MONSTER_VEL_TBL, 32 },
        { ADDR_MONSTATS_TXT, 4 * 0x1A8u },
        { ADDR_UNIT, 8 },
        { ADDR_OUT_PAIR, 8 }
      };
      uint32_t args[3] = { ADDR_UNIT, ADDR_OUT_PAIR, ADDR_OUT_PAIR + 4u };
      capture_pre(pre, 5, pre_bufs);
      call_stdcall3(va, args[0], args[1], args[2]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 3, 0u, 0u, pre, 5, pre_bufs, pre, 5);
    }
  }

  /* 2. 0x6FD72C20 ITEMS_CheckIfUnique (stdcall pItem -> eax) */
  {
    const uint32_t va = 0x6FD72C20u;
    const char *nm = "ITEMS_CheckIfUnique";
    struct {
      const char *id;
      uint32_t class_id;
    } cases[] = {
      { "item_class0_not_unique", 0u },
      { "item_class1_unique_1", 1u },
      { "item_class2_unique_255", 2u }
    };
    for (int i = 0; i < 3; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 4u);
      w32(ADDR_UNIT + 0x04u, cases[i].class_id);
      RangeSpec pre[] = {
        { VA_ITEMS_TXT_COUNT, 8 },
        { ADDR_ITEMS_TXT, 3 * 0x1A8u },
        { ADDR_UNIT, 8 }
      };
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, 3, pre_bufs);
      uint32_t eax = call_stdcall1(va, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 1, 0xFFFFFFFFu, eax, pre, 3, pre_bufs, pre, 3);
    }
  }

  /* 3. 0x6FD72C80 ITEMS_CheckIfUseable (stdcall pItem -> eax) */
  {
    const uint32_t va = 0x6FD72C80u;
    const char *nm = "ITEMS_CheckIfUseable";
    struct {
      const char *id;
      uint32_t p_item;
      uint32_t unit_type;
      uint32_t class_id;
    } cases[] = {
      { "null_item_returns_0", 0u, 4u, 0u },
      { "non_item_unit_type_1_returns_0", ADDR_UNIT, 1u, 1u },
      { "item_class0_useable_0", ADDR_UNIT, 4u, 0u },
      { "item_class1_useable_1", ADDR_UNIT, 4u, 1u }
    };
    for (int i = 0; i < 4; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, cases[i].unit_type);
      w32(ADDR_UNIT + 0x04u, cases[i].class_id);
      RangeSpec pre[] = {
        { VA_ITEMS_TXT_COUNT, 8 },
        { ADDR_ITEMS_TXT, 3 * 0x1A8u },
        { ADDR_UNIT, 8 }
      };
      uint32_t args[1] = { cases[i].p_item };
      capture_pre(pre, 3, pre_bufs);
      uint32_t eax = call_stdcall1(va, cases[i].p_item);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 1, 0xFFFFFFFFu, eax, pre, 3, pre_bufs, pre, 3);
    }
  }

  /* 4. 0x6FD73050 ITEMS_GetBaseLevel (stdcall pItem -> al, retMask 0xFF) */
  {
    const uint32_t va = 0x6FD73050u;
    const char *nm = "ITEMS_GetBaseLevel";
    struct {
      const char *id;
      uint32_t class_id;
    } cases[] = {
      { "item_class0_lvl_12", 0u },
      { "item_class1_lvl_85", 1u },
      { "item_class2_lvl_250", 2u }
    };
    for (int i = 0; i < 3; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 4u);
      w32(ADDR_UNIT + 0x04u, cases[i].class_id);
      RangeSpec pre[] = {
        { VA_ITEMS_TXT_COUNT, 8 },
        { ADDR_ITEMS_TXT, 3 * 0x1A8u },
        { ADDR_UNIT, 8 }
      };
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, 3, pre_bufs);
      uint32_t eax = call_stdcall1(va, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 1, 0xFFu, eax, pre, 3, pre_bufs, pre, 3);
    }
  }

  /* 5. 0x6FD732E0 ITEMS_Get2HandedWClass (stdcall pItem -> eax) */
  {
    const uint32_t va = 0x6FD732E0u;
    const char *nm = "ITEMS_Get2HandedWClass";
    struct {
      const char *id;
      uint32_t class_id;
    } cases[] = {
      { "item_class0_2hand_1hs", 0u },
      { "item_class1_2hand_2hs", 1u },
      { "item_class2_2hand_stf", 2u }
    };
    for (int i = 0; i < 3; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0x00u, 4u);
      w32(ADDR_UNIT + 0x04u, cases[i].class_id);
      RangeSpec pre[] = {
        { VA_ITEMS_TXT_COUNT, 8 },
        { ADDR_ITEMS_TXT, 3 * 0x1A8u },
        { ADDR_UNIT, 8 }
      };
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, 3, pre_bufs);
      uint32_t eax = call_stdcall1(va, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 1, 0xFFFFFFFFu, eax, pre, 3, pre_bufs, pre, 3);
    }
  }

  /* 6. 0x6FD8E310 PATH_GetTargetUnitCoordsWithTrigOffset (edx=pDynamicPath, edi=pOutCoordsWordPair) */
  {
    const uint32_t va = 0x6FD8E310u;
    const char *nm = "PATH_GetTargetUnitCoordsWithTrigOffset";
    struct {
      const char *id;
      uint32_t target_type;
      uint32_t target_path_ptr;
      uint16_t dyn_x;
      uint16_t dyn_y;
      uint32_t static_x;
      uint32_t static_y;
      uint8_t target_dir;
      uint8_t dist;
    } cases[] = {
      { "type2_static_dist0", 2u, ADDR_TARGET_PATH, 0u, 0u, 5100u, 5200u, 0u, 0u },
      { "type4_static_dist5_dir12", 4u, ADDR_TARGET_PATH, 0u, 0u, 6100u, 6200u, 12u, 5u },
      { "type5_static_dist7_dir45", 5u, ADDR_TARGET_PATH, 0u, 0u, 7100u, 7200u, 45u, 7u },
      { "type0_dyn_null_path_dist3", 0u, 0u, 0u, 0u, 0u, 0u, 0u, 3u },
      { "type1_dyn_valid_path_dist0", 1u, ADDR_TARGET_PATH, 1234u, 2345u, 0u, 0u, 16u, 0u },
      { "type6_dyn_valid_path_dist4_dir32", 6u, ADDR_TARGET_PATH, 3000u, 4000u, 0u, 0u, 32u, 4u }
    };
    for (int i = 0; i < 6; i++) {
      clear_arena();
      w32(ADDR_DYN_PATH + 0x58u, ADDR_TARGET_UNIT);
      w8(ADDR_DYN_PATH + 0x68u, cases[i].dist);
      w32(ADDR_TARGET_UNIT + 0x00u, cases[i].target_type);
      w32(ADDR_TARGET_UNIT + 0x2Cu, cases[i].target_path_ptr);
      w16(ADDR_TARGET_PATH + 0x02u, cases[i].dyn_x);
      w16(ADDR_TARGET_PATH + 0x06u, cases[i].dyn_y);
      w32(ADDR_TARGET_PATH + 0x0Cu, cases[i].static_x);
      w32(ADDR_TARGET_PATH + 0x10u, cases[i].static_y);
      w8(ADDR_TARGET_PATH + 0x64u, cases[i].target_dir);
      w32(ADDR_OUT_PAIR, 0xFFFFEEEEu);
      RangeSpec pre[] = {
        { VA_FOG_TRIG_LUT, 512 * 4 },
        { ADDR_DYN_PATH, 0x70 },
        { ADDR_TARGET_UNIT, 0x30 },
        { ADDR_TARGET_PATH, 0x70 },
        { ADDR_OUT_PAIR, 4 }
      };
      uint32_t args[2] = { ADDR_DYN_PATH, ADDR_OUT_PAIR };
      capture_pre(pre, 5, pre_bufs);
      call_edx_edi_ret(va, args[0], args[1]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 2, 0u, 0u, pre, 5, pre_bufs, pre, 5);
    }
  }

  /* 7. 0x6FD8E910 DATATBLS_GetObjGroupTxtRecord (stdcall nIndex -> eax) */
  {
    const uint32_t va = 0x6FD8E910u;
    const char *nm = "DATATBLS_GetObjGroupTxtRecord";
    uint32_t idxs[3] = { 0u, 2u, 3u };
    const char *ids[3] = { "index_0", "index_2", "index_3" };
    for (int i = 0; i < 3; i++) {
      clear_arena();
      RangeSpec pre[] = { { VA_OBJGROUP_PTR, 8 } };
      uint32_t args[1] = { idxs[i] };
      capture_pre(pre, 1, pre_bufs);
      uint32_t eax = call_stdcall1(va, idxs[i]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFFFFFFFu, eax, pre, 1, pre_bufs, pre, 1);
    }
  }

  /* 8. 0x6FDBC4D0 DATATBLS_GetLvlSubTxtRecordBySubType (edx=nSubType -> eax) */
  {
    const uint32_t va = 0x6FDBC4D0u;
    const char *nm = "DATATBLS_GetLvlSubTxtRecordBySubType";
    uint32_t subs[3] = { 0u, 1u, 3u };
    const char *ids[3] = { "subtype_0_row2", "subtype_1_row0", "subtype_3_row5" };
    for (int i = 0; i < 3; i++) {
      clear_arena();
      RangeSpec pre[] = {
        { VA_LVLSUB_PTR, 12 },
        { ADDR_LVLSUB_LUT, 16 }
      };
      uint32_t args[1] = { subs[i] };
      capture_pre(pre, 2, pre_bufs);
      uint32_t eax = call_edx_ret(va, subs[i]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFFFFFFFu, eax, pre, 2, pre_bufs, pre, 2);
    }
  }

  /* 9. 0x6FDBC5D0 DATATBLS_GetLvlWarpTxtRecordByIdAndDir (ebx=nWarpId, dl=cDirection -> eax) */
  {
    const uint32_t va = 0x6FDBC5D0u;
    const char *nm = "DATATBLS_GetLvlWarpTxtRecordByIdAndDir";
    struct {
      const char *id;
      uint32_t warp_id;
      uint32_t dir_ch;
    } cases[] = {
      { "match_exact_after_id_and_dir_mismatch", 30u, (uint32_t)'r' },
      { "match_query_dir_b", 10u, (uint32_t)'b' },
      { "match_record_dir_b", 20u, (uint32_t)'r' }
    };
    for (int i = 0; i < 3; i++) {
      clear_arena();
      RangeSpec pre[] = {
        { VA_LVLWARP_PTR, 8 },
        { ADDR_LVLWARP_TXT, 4 * 0x30u }
      };
      uint32_t args[2] = { cases[i].warp_id, cases[i].dir_ch };
      capture_pre(pre, 2, pre_bufs);
      uint32_t eax = call_ebx_edx_ret(va, args[0], args[1]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 2, 0xFFFFFFFFu, eax, pre, 2, pre_bufs, pre, 2);
    }
  }

  /* 10. 0x6FDC1430 DATATBLS_GetBooksTxtRecord (stdcall nIndex -> eax) */
  {
    const uint32_t va = 0x6FDC1430u;
    const char *nm = "DATATBLS_GetBooksTxtRecord";
    int32_t idxs[4] = { 0, 2, -1, 4 };
    const char *ids[4] = { "valid_index_0", "valid_index_2", "minus1_returns_0", "ge_count_returns_0" };
    for (int i = 0; i < 4; i++) {
      clear_arena();
      RangeSpec pre[] = { { VA_BOOKS_COUNT, 8 } };
      uint32_t args[1] = { (uint32_t)idxs[i] };
      capture_pre(pre, 1, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFFFFFFFu, eax, pre, 1, pre_bufs, pre, 1);
    }
  }

  /* 11. 0x6FDC14D0 DATATBLS_GetQualityItemsTxtRecord (stdcall nIndex -> eax) */
  {
    const uint32_t va = 0x6FDC14D0u;
    const char *nm = "DATATBLS_GetQualityItemsTxtRecord";
    int32_t idxs[4] = { 0, 3, -1, 4 };
    const char *ids[4] = { "valid_index_0", "valid_index_3", "minus1_returns_0", "ge_count_returns_0" };
    for (int i = 0; i < 4; i++) {
      clear_arena();
      RangeSpec pre[] = { { VA_QUALITEMS_COUNT, 8 } };
      uint32_t args[1] = { (uint32_t)idxs[i] };
      capture_pre(pre, 1, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFFFFFFFu, eax, pre, 1, pre_bufs, pre, 1);
    }
  }

  /* 12. 0x6FDC1570 DATATBLS_GetGemsTxtRecord (stdcall nIndex -> eax) */
  {
    const uint32_t va = 0x6FDC1570u;
    const char *nm = "DATATBLS_GetGemsTxtRecord";
    int32_t idxs[4] = { 0, 2, -1, 4 };
    const char *ids[4] = { "valid_index_0", "valid_index_2", "minus1_returns_0", "ge_count_returns_0" };
    for (int i = 0; i < 4; i++) {
      clear_arena();
      RangeSpec pre[] = { { VA_GEMS_COUNT, 8 } };
      uint32_t args[1] = { (uint32_t)idxs[i] };
      capture_pre(pre, 1, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFFFFFFFu, eax, pre, 1, pre_bufs, pre, 1);
    }
  }

  /* 13. 0x6FDC1610 DATATBLS_GetBeltsTxtRecord (stdcall nIndex -> eax) */
  {
    const uint32_t va = 0x6FDC1610u;
    const char *nm = "DATATBLS_GetBeltsTxtRecord";
    int32_t idxs[4] = { 0, 2, -1, 4 };
    const char *ids[4] = { "valid_index_0", "valid_index_2", "minus1_returns_0", "ge_count_returns_0" };
    for (int i = 0; i < 4; i++) {
      clear_arena();
      RangeSpec pre[] = { { VA_BELTS_COUNT, 8 } };
      uint32_t args[1] = { (uint32_t)idxs[i] };
      capture_pre(pre, 1, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFFFFFFFu, eax, pre, 1, pre_bufs, pre, 1);
    }
  }

  /* 14. 0x6FDC1820 DATATBLS_GetMagicAffixTxtRecord (stdcall nIndex1Based -> eax) */
  {
    const uint32_t va = 0x6FDC1820u;
    const char *nm = "DATATBLS_GetMagicAffixTxtRecord";
    int32_t idxs[5] = { 1, 4, 0, -2, 5 };
    const char *ids[5] = {
      "index_1_returns_row0",
      "index_4_returns_row3",
      "index_0_returns_0",
      "index_neg2_returns_0",
      "index_gt_count_returns_0"
    };
    for (int i = 0; i < 5; i++) {
      clear_arena();
      RangeSpec pre[] = { { VA_MAGICAFFIX_COUNT, 8 } };
      uint32_t args[1] = { (uint32_t)idxs[i] };
      capture_pre(pre, 1, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFFFFFFFu, eax, pre, 1, pre_bufs, pre, 1);
    }
  }

  /* 15. 0x6FDC1960 DATATBLS_GetItemsTxtRecordByCode (stdcall dwCode, pOutIndex -> eax) */
  {
    const uint32_t va = 0x6FDC1960u;
    const char *nm = "DATATBLS_GetItemsTxtRecordByCode";
    uint32_t codes[3] = { 0x20706163u, 0x20786168u, 0x207A7A7Au };
    const char *ids[3] = { "found_cap_row1", "found_hax_row0", "missing_code_returns_0" };
    for (int i = 0; i < 3; i++) {
      clear_arena();
      w32(ADDR_OUT_PAIR, 0xCCCCCCCCu);
      RangeSpec pre[] = {
        { VA_ITEMS_TXT_COUNT, 8 },
        { VA_ITEMS_LINKER_PTR, 4 },
        { ADDR_LINK, 16 },
        { ADDR_LINK_ENTRIES, 24 },
        { ADDR_OUT_PAIR, 4 }
      };
      uint32_t args[2] = { codes[i], ADDR_OUT_PAIR };
      capture_pre(pre, 5, pre_bufs);
      uint32_t eax = call_stdcall2(va, args[0], args[1]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 2, 0xFFFFFFFFu, eax, pre, 5, pre_bufs, pre, 5);
    }
  }

  /* 16. 0x6FDCFF80 DATATBLS_GetArenaTxtRecord (fastcall ecx=nArenaType -> eax) */
  {
    const uint32_t va = 0x6FDCFF80u;
    const char *nm = "DATATBLS_GetArenaTxtRecord";
    int32_t types[3] = { 0, -1, -2 };
    const char *ids[3] = { "arena_0", "arena_neg1", "arena_neg2" };
    for (int i = 0; i < 3; i++) {
      clear_arena();
      RangeSpec pre[] = { { VA_ARENA_PTR, 4 } };
      uint32_t args[1] = { (uint32_t)types[i] };
      capture_pre(pre, 1, pre_bufs);
      uint32_t eax = call_fastcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFFFFFFFu, eax, pre, 1, pre_bufs, pre, 1);
    }
  }

  /* 17. 0x6FDCFFB0 DATATBLS_GetCharTemplateStartLevel (fastcall ecx=nTemplate, edx=nClass -> eax) */
  {
    const uint32_t va = 0x6FDCFFB0u;
    const char *nm = "DATATBLS_GetCharTemplateStartLevel";
    struct {
      const char *id;
      uint32_t tmpl;
      uint32_t cls;
    } cases[] = {
      { "class0_tmpl1", 1u, 0u },
      { "class0_tmpl2", 2u, 0u },
      { "class1_tmpl2", 2u, 1u },
      { "class2_tmpl2", 2u, 2u }
    };
    for (int i = 0; i < 4; i++) {
      clear_arena();
      RangeSpec pre[] = {
        { VA_CHARTMPL_CLASS_START, 12 },
        { VA_CHARTMPL_PTR, 8 },
        { ADDR_CHARTMPL_TXT, 6 * 0xF0u }
      };
      uint32_t args[2] = { cases[i].tmpl, cases[i].cls };
      capture_pre(pre, 3, pre_bufs);
      uint32_t eax = call_fastcall2(va, args[0], args[1]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 2, 0xFFFFFFFFu, eax, pre, 3, pre_bufs, pre, 3);
    }
  }

  /* 18. 0x6FDD1FB0 DATATBLS_GetInventoryGridInfo (stdcall nIndex, nMode, pOutGridInfo) */
  {
    const uint32_t va = 0x6FDD1FB0u;
    const char *nm = "DATATBLS_GetInventoryGridInfo";
    struct {
      const char *id;
      uint32_t idx;
      uint32_t mode;
    } cases[] = {
      { "idx0_mode0", 0u, 0u },
      { "idx2_mode0", 2u, 0u },
      { "idx1_mode1", 1u, 1u }
    };
    for (int i = 0; i < 3; i++) {
      clear_arena();
      memset((void *)(uintptr_t)ADDR_GRID_OUT, 0xEE, 24);
      RangeSpec pre[] = {
        { VA_INVENTORY_TXT_MAX, 8 },
        { ADDR_INVENTORY_TXT, 20 * 0xF0u },
        { ADDR_GRID_OUT, 24 }
      };
      uint32_t args[3] = { cases[i].idx, cases[i].mode, ADDR_GRID_OUT };
      capture_pre(pre, 3, pre_bufs);
      call_stdcall3(va, args[0], args[1], args[2]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 3, 0u, 0u, pre, 3, pre_bufs, pre, 3);
    }
  }
}

/* =========================================================================
 * Batch B036 Vector Emission (24 Net-New Functions)
 * ========================================================================= */

static void emit_b036(FILE *fp) {
  uint8_t *pre_bufs[16];

  /* 1. 0x6FD91D00 ANIMTBLS_CompareCode8 (fastcall ecx=pStr1, edx=pStr2 -> eax) */
  {
    const uint32_t va = 0x6FD91D00u;
    const char *nm = "ANIMTBLS_CompareCode8";
    struct {
      const char *id;
      const char *s1;
      const char *s2;
    } cases[] = {
      { "both_empty_equal", "", "" },
      { "nonempty_len3_equal", "1hs", "1hs" },
      { "first_dword_diff", "1hs", "2hs" },
      { "second_dword_diff_len8", "abcd1111", "abcd2222" },
      { "len8_both_dwords_equal", "abcd1111", "abcd1111" }
    };
    for (int i = 0; i < 5; i++) {
      clear_arena();
      strcpy((char *)(uintptr_t)ADDR_STR1, cases[i].s1);
      strcpy((char *)(uintptr_t)ADDR_STR2, cases[i].s2);
      RangeSpec pre[] = {
        { ADDR_STR1, 16 },
        { ADDR_STR2, 16 }
      };
      uint32_t args[2] = { ADDR_STR1, ADDR_STR2 };
      capture_pre(pre, 2, pre_bufs);
      uint32_t eax = call_fastcall2(va, args[0], args[1]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 2, 0xFFFFFFFFu, eax, pre, 2, pre_bufs, pre, 2);
    }
  }

  /* 2..7. 6 D2SkillStrc Setters (stdcall pSkill, nVal -> void) */
  {
    struct {
      uint32_t va;
      const char *nm;
    } setters[6] = {
      { 0x6FD9DD30u, "SKILLS_SetCharges" },
      { 0x6FD9DE60u, "SKILLS_SetParam0C" },
      { 0x6FD9DEA0u, "SKILLS_SetParam4" },
      { 0x6FD9DEE0u, "SKILLS_SetParam3" },
      { 0x6FD9DF20u, "SKILLS_SetParam2" },
      { 0x6FD9DF60u, "SKILLS_SetParam1" }
    };
    uint32_t vals[3] = { 0u, 123456u, 0x80000001u };
    const char *ids[3] = { "val_zero", "val_positive", "val_highbit" };
    for (int s = 0; s < 6; s++) {
      for (int i = 0; i < 3; i++) {
        clear_arena();
        memset((void *)(uintptr_t)ADDR_SKILL0, 0x55, 64);
        RangeSpec pre[] = { { ADDR_SKILL0, 64 } };
        uint32_t args[2] = { ADDR_SKILL0, vals[i] };
        capture_pre(pre, 1, pre_bufs);
        call_stdcall2(setters[s].va, args[0], args[1]);
        emit_ndjson_line(fp, setters[s].va, setters[s].nm, ids[i], args, 2, 0u, 0u, pre, 1, pre_bufs, pre, 1);
      }
    }
  }

  /* 8..12. 5 D2SkillStrc Getters (stdcall pSkill -> eax) */
  {
    struct {
      uint32_t va;
      const char *nm;
      uint32_t off;
    } getters[5] = {
      { 0x6FD9DD70u, "SKILLS_GetCharges", 0x30u },
      { 0x6FD9DFA0u, "SKILLS_GetParam4", 0x24u },
      { 0x6FD9DFD0u, "SKILLS_GetParam3", 0x20u },
      { 0x6FD9E000u, "SKILLS_GetParam2", 0x1Cu },
      { 0x6FD9E030u, "SKILLS_GetParam1", 0x18u }
    };
    uint32_t vals[3] = { 0u, 777u, 0xFFFFFFFEu };
    const char *ids[3] = { "get_zero", "get_positive", "get_negative" };
    for (int g = 0; g < 5; g++) {
      for (int i = 0; i < 3; i++) {
        clear_arena();
        w32(ADDR_SKILL0 + getters[g].off, vals[i]);
        RangeSpec pre[] = { { ADDR_SKILL0, 64 } };
        uint32_t args[1] = { ADDR_SKILL0 };
        capture_pre(pre, 1, pre_bufs);
        uint32_t eax = call_stdcall1(getters[g].va, args[0]);
        emit_ndjson_line(fp, getters[g].va, getters[g].nm, ids[i], args, 1, 0xFFFFFFFFu, eax, pre, 1, pre_bufs, pre, 1);
      }
    }
  }

  /* 13. 0x6FD9E240 SKILLS_GetItemSkillInfo (stdcall pSkill, pOutItemGuid, pOutSkillId, pOutLvl, pOutCharges -> eax) */
  {
    const uint32_t va = 0x6FD9E240u;
    const char *nm = "SKILLS_GetItemSkillInfo";
    struct {
      const char *id;
      uint32_t owner_guid;
      uint16_t skill_id;
      uint32_t skill_lvl;
      uint32_t charges;
      uint32_t out_guid;
      uint32_t out_skill;
      uint32_t out_lvl;
      uint32_t out_chg;
    } cases[] = {
      {
        "non_item_skill_guid_minus1",
        0xFFFFFFFFu, 54u, 7u, 25u,
        ADDR_SKILL_OUTS, ADDR_SKILL_OUTS + 4u, ADDR_SKILL_OUTS + 8u, ADDR_SKILL_OUTS + 12u
      },
      {
        "item_skill_all_outputs_non_null",
        0x12345678u, 54u, 7u, 25u,
        ADDR_SKILL_OUTS, ADDR_SKILL_OUTS + 4u, ADDR_SKILL_OUTS + 8u, ADDR_SKILL_OUTS + 12u
      },
      {
        "item_skill_negative_skill_id",
        99u, (uint16_t)-3, 1u, 5u,
        ADDR_SKILL_OUTS, ADDR_SKILL_OUTS + 4u, ADDR_SKILL_OUTS + 8u, ADDR_SKILL_OUTS + 12u
      },
      {
        "item_skill_all_outputs_null",
        42u, 10u, 3u, 9u,
        0u, 0u, 0u, 0u
      }
    };
    for (int i = 0; i < 4; i++) {
      clear_arena();
      w16(ADDR_SKILLS_TXT + 0x00u, cases[i].skill_id);
      w32(ADDR_SKILL0 + 0x00u, ADDR_SKILLS_TXT);
      w32(ADDR_SKILL0 + 0x28u, cases[i].skill_lvl);
      w32(ADDR_SKILL0 + 0x34u, cases[i].owner_guid);
      w32(ADDR_SKILL0 + 0x38u, cases[i].charges);
      memset((void *)(uintptr_t)ADDR_SKILL_OUTS, 0xCC, 16);
      RangeSpec pre[] = {
        { ADDR_SKILLS_TXT, 4 },
        { ADDR_SKILL0, 64 },
        { ADDR_SKILL_OUTS, 16 }
      };
      uint32_t args[5] = {
        ADDR_SKILL0,
        cases[i].out_guid,
        cases[i].out_skill,
        cases[i].out_lvl,
        cases[i].out_chg
      };
      capture_pre(pre, 3, pre_bufs);
      uint32_t eax = call_stdcall5(va, args[0], args[1], args[2], args[3], args[4]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 5, 0xFFFFFFFFu, eax, pre, 3, pre_bufs, pre, 3);
    }
  }

  /* 14. 0x6FD9E2B0 SKILLS_GetOwnerItemGuid (stdcall pSkill -> eax) */
  {
    const uint32_t va = 0x6FD9E2B0u;
    const char *nm = "SKILLS_GetOwnerItemGuid";
    uint32_t guids[3] = { 0xFFFFFFFFu, 0xABCDE001u, 0u };
    const char *ids[3] = { "guid_minus1", "guid_valid", "guid_zero" };
    for (int i = 0; i < 3; i++) {
      clear_arena();
      w32(ADDR_SKILL0 + 0x34u, guids[i]);
      RangeSpec pre[] = { { ADDR_SKILL0, 64 } };
      uint32_t args[1] = { ADDR_SKILL0 };
      capture_pre(pre, 1, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFFFFFFFu, eax, pre, 1, pre_bufs, pre, 1);
    }
  }

  /* 15. 0x6FD9E3F0 SKILLS_AllocSkillList (stdcall pMemPool -> eax) */
  {
    const uint32_t va = 0x6FD9E3F0u;
    const char *nm = "SKILLS_AllocSkillList";
    uint32_t pools[2] = { 0u, 0xDEADBEEFu };
    const char *ids[2] = { "pool_0", "pool_nonzero" };
    for (int i = 0; i < 2; i++) {
      clear_arena();
      RangeSpec pre[] = { { HEAP_BASE, 24 } };
      uint32_t args[1] = { pools[i] };
      capture_pre(pre, 1, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFFFFFFFu, eax, pre, 1, pre_bufs, pre, 1);
    }
  }

  /* 16. 0x6FD9E6D0 SKILLS_EvaluateSkillManaCost (stdcall nSkillId, nLevel -> eax) */
  {
    const uint32_t va = 0x6FD9E6D0u;
    const char *nm = "SKILLS_EvaluateSkillManaCost";
    struct {
      const char *id;
      uint32_t skill_id;
      uint32_t lvl;
    } cases[] = {
      { "skill0_lvl1_base_mana", 0u, 1u },
      { "skill0_lvl5_scaled", 0u, 5u },
      { "skill1_shift7_fractional", 1u, 4u },
      { "skill2_negative_clamped_to_0", 2u, 5u }
    };
    for (int i = 0; i < 4; i++) {
      clear_arena();
      RangeSpec pre[] = {
        { VA_SGPT_DATATABLES, 4 },
        { ADDR_DATATABLES + 0xB98u, 12 },
        { ADDR_SKILLS_TXT, 3 * 0x23Cu }
      };
      uint32_t args[2] = { cases[i].skill_id, cases[i].lvl };
      capture_pre(pre, 3, pre_bufs);
      uint32_t eax = call_stdcall2(va, args[0], args[1]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 2, 0xFFFFFFFFu, eax, pre, 3, pre_bufs, pre, 3);
    }
  }

  /* 17. 0x6FD9EB40 SKILLS_HasSkillByTxtRecord (eax=pUnit, ecx=pSkillsTxt -> eax) */
  {
    const uint32_t va = 0x6FD9EB40u;
    const char *nm = "SKILLS_HasSkillByTxtRecord";
    uint32_t targets[3] = {
      ADDR_SKILLS_TXT + 0 * 0x23Cu,
      ADDR_SKILLS_TXT + 1 * 0x23Cu,
      ADDR_SKILLS_TXT + 2 * 0x23Cu
    };
    const char *ids[3] = { "match_first_node", "match_second_node", "no_match_in_list" };
    for (int i = 0; i < 3; i++) {
      clear_arena();
      w32(ADDR_UNIT + 0xA8u, ADDR_SKILL_LIST);
      w32(ADDR_SKILL_LIST + 0x04u, ADDR_SKILL0);
      w32(ADDR_SKILL0 + 0x00u, ADDR_SKILLS_TXT + 0 * 0x23Cu);
      w32(ADDR_SKILL0 + 0x04u, ADDR_SKILL1);
      w32(ADDR_SKILL1 + 0x00u, ADDR_SKILLS_TXT + 1 * 0x23Cu);
      w32(ADDR_SKILL1 + 0x04u, 0u);
      RangeSpec pre[] = {
        { ADDR_UNIT, 0xB0 },
        { ADDR_SKILL_LIST, 24 },
        { ADDR_SKILL0, 64 },
        { ADDR_SKILL1, 64 }
      };
      uint32_t args[2] = { ADDR_UNIT, targets[i] };
      capture_pre(pre, 4, pre_bufs);
      uint32_t eax = call_eax_ecx_ret(va, args[0], args[1]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 2, 0xFFFFFFFFu, eax, pre, 4, pre_bufs, pre, 4);
    }
  }

  /* 18 & 19. 0x6FD9ECC0 SKILLS_SetRightSkill & 0x6FD9ED60 SKILLS_SetLeftSkill */
  {
    struct {
      uint32_t va;
      const char *nm;
    } fns[2] = {
      { 0x6FD9ECC0u, "SKILLS_SetRightSkill" },
      { 0x6FD9ED60u, "SKILLS_SetLeftSkill" }
    };
    for (int f = 0; f < 2; f++) {
      /* Case 0: pUnit->pSkills == 0 */
      {
        clear_arena();
        w32(ADDR_UNIT + 0xA8u, 0u);
        RangeSpec pre[] = {
          { VA_SGPT_DATATABLES, 4 },
          { ADDR_DATATABLES + 0xB98u, 12 },
          { ADDR_UNIT, 0xB0 }
        };
        uint32_t args[3] = { ADDR_UNIT, 1u, 100u };
        capture_pre(pre, 3, pre_bufs);
        call_stdcall3(fns[f].va, args[0], args[1], args[2]);
        emit_ndjson_line(fp, fns[f].va, fns[f].nm, "null_skill_list_noop", args, 3, 0u, 0u, pre, 3, pre_bufs, pre, 3);
      }
      /* Case 1: pUnit->pSkills != 0, pFirstSkill == 0 */
      {
        clear_arena();
        w32(ADDR_UNIT + 0xA8u, ADDR_SKILL_LIST);
        w32(ADDR_SKILL_LIST + 0x04u, 0u);
        w32(ADDR_SKILL_LIST + 0x08u, 0x11111111u);
        w32(ADDR_SKILL_LIST + 0x0Cu, 0x22222222u);
        RangeSpec pre[] = {
          { VA_SGPT_DATATABLES, 4 },
          { ADDR_DATATABLES + 0xB98u, 12 },
          { ADDR_UNIT, 0xB0 },
          { ADDR_SKILL_LIST, 24 }
        };
        uint32_t args[3] = { ADDR_UNIT, 1u, 100u };
        capture_pre(pre, 4, pre_bufs);
        call_stdcall3(fns[f].va, args[0], args[1], args[2]);
        emit_ndjson_line(fp, fns[f].va, fns[f].nm, "empty_first_skill_noop", args, 3, 0u, 0u, pre, 4, pre_bufs, pre, 4);
      }
      /* Case 2: 3-node list -> node 0 wrong txt, node 1 right txt wrong owner, node 2 matches */
      {
        clear_arena();
        w32(ADDR_UNIT + 0xA8u, ADDR_SKILL_LIST);
        w32(ADDR_SKILL_LIST + 0x04u, ADDR_SKILL0);
        w32(ADDR_SKILL_LIST + 0x08u, 0x11111111u);
        w32(ADDR_SKILL_LIST + 0x0Cu, 0x22222222u);
        w32(ADDR_SKILL0 + 0x00u, ADDR_SKILLS_TXT + 0 * 0x23Cu);
        w32(ADDR_SKILL0 + 0x04u, ADDR_SKILL1);
        w32(ADDR_SKILL0 + 0x34u, 100u);
        w32(ADDR_SKILL1 + 0x00u, ADDR_SKILLS_TXT + 1 * 0x23Cu);
        w32(ADDR_SKILL1 + 0x04u, ADDR_SKILL2);
        w32(ADDR_SKILL1 + 0x34u, 999u);
        w32(ADDR_SKILL2 + 0x00u, ADDR_SKILLS_TXT + 1 * 0x23Cu);
        w32(ADDR_SKILL2 + 0x04u, 0u);
        w32(ADDR_SKILL2 + 0x34u, 100u);
        RangeSpec pre[] = {
          { VA_SGPT_DATATABLES, 4 },
          { ADDR_DATATABLES + 0xB98u, 12 },
          { ADDR_UNIT, 0xB0 },
          { ADDR_SKILL_LIST, 24 },
          { ADDR_SKILL0, 64 },
          { ADDR_SKILL1, 64 },
          { ADDR_SKILL2, 64 }
        };
        uint32_t args[3] = { ADDR_UNIT, 1u, 100u };
        capture_pre(pre, 7, pre_bufs);
        call_stdcall3(fns[f].va, args[0], args[1], args[2]);
        emit_ndjson_line(fp, fns[f].va, fns[f].nm, "match_third_node", args, 3, 0u, 0u, pre, 7, pre_bufs, pre, 7);
      }
      /* Case 3: 2-node list, no match */
      {
        clear_arena();
        w32(ADDR_UNIT + 0xA8u, ADDR_SKILL_LIST);
        w32(ADDR_SKILL_LIST + 0x04u, ADDR_SKILL0);
        w32(ADDR_SKILL_LIST + 0x08u, 0x11111111u);
        w32(ADDR_SKILL_LIST + 0x0Cu, 0x22222222u);
        w32(ADDR_SKILL0 + 0x00u, ADDR_SKILLS_TXT + 0 * 0x23Cu);
        w32(ADDR_SKILL0 + 0x04u, ADDR_SKILL1);
        w32(ADDR_SKILL0 + 0x34u, 100u);
        w32(ADDR_SKILL1 + 0x00u, ADDR_SKILLS_TXT + 1 * 0x23Cu);
        w32(ADDR_SKILL1 + 0x04u, 0u);
        w32(ADDR_SKILL1 + 0x34u, 999u);
        RangeSpec pre[] = {
          { VA_SGPT_DATATABLES, 4 },
          { ADDR_DATATABLES + 0xB98u, 12 },
          { ADDR_UNIT, 0xB0 },
          { ADDR_SKILL_LIST, 24 },
          { ADDR_SKILL0, 64 },
          { ADDR_SKILL1, 64 }
        };
        uint32_t args[3] = { ADDR_UNIT, 1u, 100u };
        capture_pre(pre, 6, pre_bufs);
        call_stdcall3(fns[f].va, args[0], args[1], args[2]);
        emit_ndjson_line(fp, fns[f].va, fns[f].nm, "no_matching_node", args, 3, 0u, 0u, pre, 6, pre_bufs, pre, 6);
      }
    }
  }

  /* 20. 0x6FD9F000 SKILLS_FreeSkillList (stdcall pUnit -> void) */
  {
    const uint32_t va = 0x6FD9F000u;
    const char *nm = "SKILLS_FreeSkillList";
    /* Case 0: pUnit == 0 */
    {
      clear_arena();
      RangeSpec pre[] = { { ADDR_UNIT, 0xB0 } };
      uint32_t args[1] = { 0u };
      capture_pre(pre, 1, pre_bufs);
      call_stdcall1(va, 0u);
      emit_ndjson_line(fp, va, nm, "null_unit_noop", args, 1, 0u, 0u, pre, 1, pre_bufs, pre, 1);
    }
    /* Case 1: pUnit->pSkills == 0 */
    {
      clear_arena();
      w32(ADDR_UNIT + 0xA8u, 0u);
      RangeSpec pre[] = { { ADDR_UNIT, 0xB0 } };
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, 1, pre_bufs);
      call_stdcall1(va, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, "null_pskills_noop", args, 1, 0u, 0u, pre, 1, pre_bufs, pre, 1);
    }
    /* Case 2: empty skill list (pFirstSkill == 0) */
    {
      clear_arena();
      w32(ADDR_UNIT + 0x08u, 0xCAFEBABEu);
      w32(ADDR_UNIT + 0xA8u, ADDR_SKILL_LIST);
      w32(ADDR_SKILL_LIST + 0x04u, 0u);
      RangeSpec pre[] = {
        { ADDR_UNIT, 0xB0 },
        { ADDR_SKILL_LIST, 24 }
      };
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, 2, pre_bufs);
      call_stdcall1(va, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, "empty_skill_list_frees_header", args, 1, 0u, 0u, pre, 2, pre_bufs, pre, 2);
    }
    /* Case 3: 2 skill nodes in pFirstSkill */
    {
      clear_arena();
      w32(ADDR_UNIT + 0x08u, 0xCAFEBABEu);
      w32(ADDR_UNIT + 0xA8u, ADDR_SKILL_LIST);
      w32(ADDR_SKILL_LIST + 0x04u, ADDR_SKILL0);
      w32(ADDR_SKILL0 + 0x04u, ADDR_SKILL1);
      w32(ADDR_SKILL1 + 0x04u, 0u);
      RangeSpec pre[] = {
        { ADDR_UNIT, 0xB0 },
        { ADDR_SKILL_LIST, 24 },
        { ADDR_SKILL0, 64 },
        { ADDR_SKILL1, 64 }
      };
      uint32_t args[1] = { ADDR_UNIT };
      capture_pre(pre, 4, pre_bufs);
      call_stdcall1(va, ADDR_UNIT);
      emit_ndjson_line(fp, va, nm, "two_skills_frees_nodes_and_header", args, 1, 0u, 0u, pre, 4, pre_bufs, pre, 4);
    }
  }

  /* 21. 0x6FDC1940 DATATBLS_GetItemIdFromItemCode (stdcall dwCode -> eax) */
  {
    const uint32_t va = 0x6FDC1940u;
    const char *nm = "DATATBLS_GetItemIdFromItemCode";
    uint32_t codes[4] = { 0x20637374u, 0x20706163u, 0x20786168u, 0x207A7A7Au };
    const char *ids[4] = { "found_tsc_row2", "found_cap_row1", "found_hax_row0", "missing_code_returns_minus1" };
    for (int i = 0; i < 4; i++) {
      clear_arena();
      RangeSpec pre[] = {
        { VA_ITEMS_LINKER_PTR, 4 },
        { ADDR_LINK, 16 },
        { ADDR_LINK_ENTRIES, 24 }
      };
      uint32_t args[1] = { codes[i] };
      capture_pre(pre, 3, pre_bufs);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0xFFFFFFFFu, eax, pre, 3, pre_bufs, pre, 3);
    }
  }

  /* 22. 0x6FDCE290 FIELD_StepFieldCoords (stdcall pField, pX, pY -> eax) */
  {
    const uint32_t va = 0x6FDCE290u;
    const char *nm = "FIELD_StepFieldCoords";
    struct {
      const char *id;
      int32_t fx;
      int32_t fy;
      int32_t x;
      int32_t y;
      uint8_t dir1;
      int32_t dx1;
      int32_t dy1;
      uint8_t dir2;
    } cases[] = {
      /* dir=1 -> dx=1, dy=-1; dir2=3 != 8 -> returns 1 */
      { "dir1_steps_to_non_center_returns_1", 10, 20, 11, 21, 1u, 1, -1, 3u },
      /* dir=0 -> dx=0, dy=-1; dir2=8 -> returns 0 */
      { "dir0_steps_to_center_dir8_returns_0", 10, 20, 10, 21, 0u, 0, -1, 8u },
      /* dir=5 -> dx=-1, dy=1; dir2=2 != 8 -> returns 1 */
      { "dir5_steps_diag_down_left_returns_1", 10, 20, 12, 19, 5u, -1, 1, 2u },
      /* dir=8 -> dx=0, dy=0; dir2=8 -> returns 0 */
      { "dir8_stationary_at_center_returns_0", 10, 20, 10, 20, 8u, 0, 0, 8u }
    };
    for (int i = 0; i < 4; i++) {
      clear_arena();
      w32(ADDR_FIELD + 0x00u, (uint32_t)cases[i].fx);
      w32(ADDR_FIELD + 0x04u, (uint32_t)cases[i].fy);
      w32(ADDR_FIELD_XY + 0x00u, (uint32_t)cases[i].x);
      w32(ADDR_FIELD_XY + 0x04u, (uint32_t)cases[i].y);
      uint32_t off1 = (uint32_t)(((cases[i].y - cases[i].fy + 4) << 8) + (cases[i].x - cases[i].fx + 4));
      uint32_t off2 = (uint32_t)(((cases[i].y + cases[i].dy1 - cases[i].fy + 4) << 8) + (cases[i].x + cases[i].dx1 - cases[i].fx + 4));
      w8(ADDR_FIELD_MATRIX + off1, cases[i].dir1);
      w8(ADDR_FIELD_MATRIX + off2, cases[i].dir2);
      RangeSpec pre[] = {
        { VA_FIELD_DIR_DX, 36 },
        { VA_FIELD_DIR_DY, 36 },
        { VA_FIELD_DATA_PTR, 24 },
        { ADDR_FIELD_MATRIX, 10 * 256 },
        { ADDR_FIELD, 8 },
        { ADDR_FIELD_XY, 8 }
      };
      uint32_t args[3] = { ADDR_FIELD, ADDR_FIELD_XY, ADDR_FIELD_XY + 4u };
      capture_pre(pre, 6, pre_bufs);
      uint32_t eax = call_stdcall3(va, args[0], args[1], args[2]);
      emit_ndjson_line(fp, va, nm, cases[i].id, args, 3, 0xFFFFFFFFu, eax, pre, 6, pre_bufs, pre, 6);
    }
  }

  /* 23. 0x6FDCE3D0 FIELD_FreeField (stdcall pField -> void) */
  {
    const uint32_t va = 0x6FDCE3D0u;
    const char *nm = "FIELD_FreeField";
    uint32_t ptrs[2] = { ADDR_FIELD, ADDR_FIELD + 8u };
    const char *ids[2] = { "free_valid_field_1", "free_valid_field_2" };
    for (int i = 0; i < 2; i++) {
      clear_arena();
      RangeSpec pre[] = { { ADDR_FIELD, 16 } };
      uint32_t args[1] = { ptrs[i] };
      capture_pre(pre, 1, pre_bufs);
      call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, ids[i], args, 1, 0u, 0u, pre, 1, pre_bufs, pre, 1);
    }
  }

  /* 24. 0x6FDCE410 FIELD_AllocField (stdcall 0-arg -> eax) */
  {
    const uint32_t va = 0x6FDCE410u;
    const char *nm = "FIELD_AllocField";
    clear_arena();
    RangeSpec pre[] = { { HEAP_BASE, 8 } };
    uint32_t args[1] = { 0u };
    capture_pre(pre, 1, pre_bufs);
    uint32_t eax = call_stdcall0(va);
    emit_ndjson_line(fp, va, nm, "alloc_field_zeroes_8_bytes", args, 0, 0xFFFFFFFFu, eax, pre, 1, pre_bufs, pre, 1);
  }
}

int main(int argc, char **argv) {
  const char *dll_dir = (argc > 1) ? argv[1] : ".";
  const char *out_b033 = (argc > 2) ? argv[2] : "b033-vectors.ndjson";
  const char *out_b036 = (argc > 3) ? argv[3] : "b036-vectors.ndjson";

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

  /* Unprotect D2Common .rdata/.data/.bss so we can hook IAT slots and stage globals */
  DWORD old_prot = 0;
  VirtualProtect((void *)(uintptr_t)0x6FDD9000u, 0x19000u, PAGE_READWRITE, &old_prot);
  w32(0x6FDD90D0u, (uint32_t)(uintptr_t)&stub_fog_10045);
  w32(0x6FDD90CCu, (uint32_t)(uintptr_t)&stub_fog_10046);

  FILE *fp33 = fopen(out_b033, "wb");
  FILE *fp36 = fopen(out_b036, "wb");
  if (!fp33 || !fp36) {
    fprintf(stderr, "Failed to open output files\n");
    return 4;
  }

  emit_b033(fp33);
  emit_b036(fp36);

  fclose(fp33);
  fclose(fp36);
  printf("Successfully emitted %s and %s\n", out_b033, out_b036);
  return 0;
}
