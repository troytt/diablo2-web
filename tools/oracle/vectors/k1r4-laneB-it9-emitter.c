/*
 * Standalone MinGW real-DLL differential vector emitter for K1r4 Iteration 9 Lane B Part 2:
 * - Batch I9B-A (18 D2Common.dll v1.13c ItemTypes functions in src/d2kern-113c/common/items.ts)
 *
 * Loads the real Diablo II v1.13c Storm.dll, Fog.dll (image base 0x6FF50000) and D2Common.dll (image base
 * 0x6FD50000), stages deterministic synthetic records inside a scratch arena at 0x20000000, patches the
 * D2Common globals the functions read (sgptDataTables 0x6FDE9E1C, sgnItemsTxtCount 0x6FDEFB94,
 * sgpItemsTxt 0x6FDEFB98), invokes each real D2Common.dll entry point (all 18 are standard __stdcall;
 * ZERO inline-asm blocks and ZERO "m" constraints), and writes one NDJSON line per vector.
 *
 * Build (both -O2 and -O2 -fno-omit-frame-pointer must produce 100% SHA-256 byte-identical output):
 *   ~/.local/opt/d2oracle/mingw/usr/bin/i686-w64-mingw32-gcc-win32 -m32 -O2 -Wall -Wextra -Werror -Wno-cast-function-type -static-libgcc \
 *     tools/oracle/vectors/k1r4-laneB-it9-emitter.c -o ~/.cache/k1r4-laneB-it9/emit-o2.exe
 *   ~/.local/opt/d2oracle/mingw/usr/bin/i686-w64-mingw32-gcc-win32 -m32 -O2 -fno-omit-frame-pointer -Wall -Wextra -Werror -Wno-cast-function-type -static-libgcc \
 *     tools/oracle/vectors/k1r4-laneB-it9-emitter.c -o ~/.cache/k1r4-laneB-it9/emit-fp.exe
 */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define ARENA_BASE 0x20000000u
#define ARENA_SIZE 0x00100000u

/* ---- D2Common globals ---- */
#define VA_SGPT_DATATABLES   0x6FDE9E1Cu
#define VA_ITEMS_TXT_COUNT   0x6FDEFB94u
#define VA_ITEMS_TXT_PTR     0x6FDEFB98u

/* ---- sgptDataTables offsets ---- */
#define SGPT_OFF_ITEMTYPES_PTR   0xBF8u
#define SGPT_OFF_ITEMTYPES_COUNT 0xBFCu

/* ---- Struct sizes ---- */
#define SZ_ITEMS_TXT     0x1A8u
#define SZ_ITEMTYPES_TXT 0xE4u
#define SZ_UNIT_DUMP     0x20u
#define SZ_ITEMDATA_DUMP 0x30u

/* ---- Arena layout ---- */
#define ADDR_DATATABLES      0x20001000u /* 0xD00 bytes synthetic sgptDataTables block */
#define ADDR_ITEMS_TXT       0x20002000u /* 7 * 0x1A8 bytes */
#define ADDR_ITEMTYPES_TXT   0x20003000u /* 4 * 0xE4 bytes */
#define ADDR_UNIT            0x20004000u /* D2UnitStrc prefix (0x20 bytes) */
#define ADDR_ITEMDATA        0x20004200u /* D2ItemDataStrc prefix (0x30 bytes) */
#define ADDR_OUT_LOCS        0x20004400u /* 4 bytes output buffer for A01 */

/* ---- Function VAs (I9B-A A01..A18) ---- */
#define VA_A01_GET_ALLOWED_BODY_LOCS     0x6FD73130u
#define VA_A02_IS_NORMAL_ALLOWED         0x6FD73360u
#define VA_A03_IS_MAGIC_ALLOWED          0x6FD733B0u
#define VA_A04_IS_RARE_ALLOWED           0x6FD73400u
#define VA_A05_GET_VAR_INV_GFX           0x6FD73450u
#define VA_A06_GET_STORE_PAGE            0x6FD734A0u
#define VA_A07_IS_REEQUIP                0x6FD734F0u
#define VA_A08_IS_RELOAD                 0x6FD73540u
#define VA_A09_GET_CLASS_SPECIFIC_CLASS  0x6FD74280u
#define VA_A10_IS_CLASS_SPECIFIC         0x6FD742D0u
#define VA_A11_GET_MAX_SOCKETS_TYPE      0x6FD74610u
#define VA_A12_GET_STAFF_MODS_CLASS      0x6FD746A0u
#define VA_A13_IS_BELTABLE               0x6FD74BA0u
#define VA_A14_IS_AUTO_STACK             0x6FD74E10u
#define VA_A15_GET_SHOOTS_FROM_ITEM      0x6FD74E60u
#define VA_A16_GET_QUIVER_FROM_ITEM      0x6FD74EB0u
#define VA_A17_CAN_BE_EQUIPPED           0x6FD743B0u
#define VA_A18_CHECK_BODY_LOCATION       0x6FD74C80u

typedef struct {
  uint32_t addr;
  uint32_t len;
} RangeSpec;

static inline void w32(uint32_t addr, uint32_t val) { *(volatile uint32_t *)(uintptr_t)addr = val; }
static inline void w16(uint32_t addr, uint16_t val) { *(volatile uint16_t *)(uintptr_t)addr = val; }
static inline void w8(uint32_t addr, uint8_t val) { *(volatile uint8_t *)(uintptr_t)addr = val; }

/* ---- Calling-convention thunks (standard __stdcall, zero inline asm) ---- */
static uint32_t call_stdcall1(uintptr_t fn, uint32_t a0) {
  typedef uint32_t(__stdcall * F)(uint32_t);
  return ((F)fn)(a0);
}
static uint32_t call_stdcall2(uintptr_t fn, uint32_t a0, uint32_t a1) {
  typedef uint32_t(__stdcall * F)(uint32_t, uint32_t);
  return ((F)fn)(a0, a1);
}
static void call_stdcall3_void(uintptr_t fn, uint32_t a0, uint32_t a1, uint32_t a2) {
  typedef void(__stdcall * F)(uint32_t, uint32_t, uint32_t);
  ((F)fn)(a0, a1, a2);
}

/* ---- NDJSON emission ---- */
static void write_hex(FILE *fp, const uint8_t *buf, uint32_t len) {
  for (uint32_t i = 0; i < len; i++) fprintf(fp, "%02x", buf[i]);
}

#define MAX_RANGES 24

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

static void emit_line(FILE *fp, uint32_t va, const char *name, const char *case_id, const uint32_t *args, int n_args,
                      uint32_t ret_mask, uint32_t eax, Snap *s) {
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

/*
 * Setup helper for ItemTypes fixtures:
 *   ItemsTxt rows (count = 7):
 *     row 0: wType1 = 0, bBelt(nGemSockets) = 6
 *     row 1: wType1 = 1, bBelt(nGemSockets) = 2
 *     row 2: wType1 = 2, bBelt(nGemSockets) = 5
 *     row 3: wType1 = 3, bBelt(nGemSockets) = 0
 *     row 4: wType1 = -1 (0xFFFF), bBelt = 4  (wType1 < 0 boundary)
 *     row 5: wType1 = 4, bBelt = 4            (wType1 == nItemTypesTxtCount boundary when count=4)
 *     row 6: wType1 = 5, bBelt = 4            (wType1 > nItemTypesTxtCount boundary when count=4)
 *
 *   ItemTypesTxt rows (count = 4):
 *     row 0 (rich active row):
 *       nBody=1, nBodyLoc1=4, nBodyLoc2=5,
 *       wQuiver(+0x0C)=321, wShoots(+0x0E)=322,
 *       nReload=1, nReEquip=1, nAutoStack=1,
 *       nMagic=1, nRare=1, nNormalAllowed=1, nBeltable=1,
 *       nMaxSock1=3, nMaxSock25=4, nMaxSock40=6,
 *       nStaffMods=5, nRarity(nClass,+0x21)=3,
 *       nStorePage=2, nVarInvGfx=4
 *     row 1 (zero / boundary 7 row):
 *       nBody=0, nBodyLoc1=3, nBodyLoc2=0,
 *       wQuiver=0, wShoots=0, nReload=0, nReEquip=0, nAutoStack=0,
 *       nMagic=0, nRare=0, nNormalAllowed=0, nBeltable=0,
 *       nMaxSock1=1, nMaxSock25=3, nMaxSock40=5,
 *       nStaffMods=0, nRarity(nClass,+0x21)=7,
 *       nStorePage=0, nVarInvGfx=0
 *     row 2 (high values / class 6 boundary):
 *       nBody=1, nBodyLoc1=0, nBodyLoc2=5,
 *       wQuiver=511, wShoots=512, nReload=2, nReEquip=3, nAutoStack=4,
 *       nMagic=2, nRare=3, nNormalAllowed=5, nBeltable=2,
 *       nMaxSock1=2, nMaxSock25=4, nMaxSock40=4,
 *       nStaffMods=7, nRarity(nClass,+0x21)=6 (< 7 boundary),
 *       nStorePage=0xFE, nVarInvGfx=6
 *     row 3 (negative signed 16-bit wQuiver/wShoots & class 8 > 7 boundary):
 *       nBody=2, nBodyLoc1=9, nBodyLoc2=10,
 *       wQuiver=0xFFFD (-3), wShoots=0xFFFE (-2),
 *       nStaffMods=1, nRarity(nClass,+0x21)=8 (> 7 boundary),
 *       nStorePage=0xFF, nVarInvGfx=1
 */
static void reset_standard_tables(uint32_t unit_type, uint32_t class_id, int32_t ilvl, int null_itemtypes_ptr) {
  memset((void *)(uintptr_t)ARENA_BASE, 0, 0x10000u);

  /* Global pointers */
  w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);
  w32(VA_ITEMS_TXT_COUNT, 7u);
  w32(VA_ITEMS_TXT_PTR,   ADDR_ITEMS_TXT);

  w32(ADDR_DATATABLES + SGPT_OFF_ITEMTYPES_PTR,   null_itemtypes_ptr ? 0u : ADDR_ITEMTYPES_TXT);
  w32(ADDR_DATATABLES + SGPT_OFF_ITEMTYPES_COUNT, 4u);

  /* ItemsTxt rows 0..6 */
  uint16_t wtype1_vals[7] = { 0u, 1u, 2u, 3u, 0xFFFFu, 4u, 5u };
  uint8_t  bbelt_vals[7]  = { 6u, 2u, 5u, 0u, 4u,      4u, 4u };
  for (int i = 0; i < 7; i++) {
    uint32_t rec = ADDR_ITEMS_TXT + (uint32_t)i * SZ_ITEMS_TXT;
    w16(rec + 0x11Eu, wtype1_vals[i]);
    w8(rec + 0x138u,  bbelt_vals[i]);
  }

  /* ItemTypesTxt row 0 */
  {
    uint32_t r = ADDR_ITEMTYPES_TXT + 0u * SZ_ITEMTYPES_TXT;
    w8(r + 0x09u, 1u);   /* nBody */
    w8(r + 0x0Au, 4u);   /* nBodyLoc1 */
    w8(r + 0x0Bu, 5u);   /* nBodyLoc2 */
    w16(r + 0x0Cu, 321u);/* wQuiver */
    w16(r + 0x0Eu, 322u);/* wShoots */
    w8(r + 0x10u, 1u);   /* nNormal */
    w8(r + 0x11u, 1u);   /* nReload */
    w8(r + 0x12u, 1u);   /* nReEquip */
    w8(r + 0x13u, 1u);   /* nAutoStack */
    w8(r + 0x14u, 1u);   /* nMagic */
    w8(r + 0x15u, 1u);   /* nRare */
    w8(r + 0x16u, 1u);   /* nNormalAllowed */
    w8(r + 0x19u, 1u);   /* nBeltable */
    w8(r + 0x1Au, 3u);   /* nMaxSock1 */
    w8(r + 0x1Bu, 4u);   /* nMaxSock25 */
    w8(r + 0x1Cu, 6u);   /* nMaxSock40 */
    w8(r + 0x1Fu, 5u);   /* nStaffMods */
    w8(r + 0x21u, 3u);   /* nRarity / nClass */
    w8(r + 0x22u, 2u);   /* nStorePage */
    w8(r + 0x23u, 4u);   /* nVarInvGfx */
  }

  /* ItemTypesTxt row 1 */
  {
    uint32_t r = ADDR_ITEMTYPES_TXT + 1u * SZ_ITEMTYPES_TXT;
    w8(r + 0x09u, 0u);   /* nBody */
    w8(r + 0x0Au, 3u);   /* nBodyLoc1 */
    w8(r + 0x0Bu, 0u);   /* nBodyLoc2 */
    w16(r + 0x0Cu, 0u);  /* wQuiver */
    w16(r + 0x0Eu, 0u);  /* wShoots */
    w8(r + 0x11u, 0u);   /* nReload */
    w8(r + 0x12u, 0u);   /* nReEquip */
    w8(r + 0x13u, 0u);   /* nAutoStack */
    w8(r + 0x14u, 0u);   /* nMagic */
    w8(r + 0x15u, 0u);   /* nRare */
    w8(r + 0x16u, 0u);   /* nNormalAllowed */
    w8(r + 0x19u, 0u);   /* nBeltable */
    w8(r + 0x1Au, 1u);   /* nMaxSock1 */
    w8(r + 0x1Bu, 3u);   /* nMaxSock25 */
    w8(r + 0x1Cu, 5u);   /* nMaxSock40 */
    w8(r + 0x1Fu, 0u);   /* nStaffMods */
    w8(r + 0x21u, 7u);   /* nRarity / nClass == 7 */
    w8(r + 0x22u, 0u);   /* nStorePage */
    w8(r + 0x23u, 0u);   /* nVarInvGfx */
  }

  /* ItemTypesTxt row 2 */
  {
    uint32_t r = ADDR_ITEMTYPES_TXT + 2u * SZ_ITEMTYPES_TXT;
    w8(r + 0x09u, 1u);   /* nBody */
    w8(r + 0x0Au, 0u);   /* nBodyLoc1 */
    w8(r + 0x0Bu, 5u);   /* nBodyLoc2 */
    w16(r + 0x0Cu, 511u);/* wQuiver */
    w16(r + 0x0Eu, 512u);/* wShoots */
    w8(r + 0x11u, 2u);   /* nReload */
    w8(r + 0x12u, 3u);   /* nReEquip */
    w8(r + 0x13u, 4u);   /* nAutoStack */
    w8(r + 0x14u, 2u);   /* nMagic */
    w8(r + 0x15u, 3u);   /* nRare */
    w8(r + 0x16u, 5u);   /* nNormalAllowed */
    w8(r + 0x19u, 2u);   /* nBeltable */
    w8(r + 0x1Au, 2u);   /* nMaxSock1 */
    w8(r + 0x1Bu, 4u);   /* nMaxSock25 */
    w8(r + 0x1Cu, 4u);   /* nMaxSock40 */
    w8(r + 0x1Fu, 7u);   /* nStaffMods */
    w8(r + 0x21u, 6u);   /* nRarity / nClass == 6 (< 7 boundary) */
    w8(r + 0x22u, 0xFEu);/* nStorePage */
    w8(r + 0x23u, 6u);   /* nVarInvGfx */
  }

  /* ItemTypesTxt row 3 */
  {
    uint32_t r = ADDR_ITEMTYPES_TXT + 3u * SZ_ITEMTYPES_TXT;
    w8(r + 0x09u, 2u);      /* nBody == 2 */
    w8(r + 0x0Au, 9u);      /* nBodyLoc1 */
    w8(r + 0x0Bu, 10u);     /* nBodyLoc2 */
    w16(r + 0x0Cu, 0xFFFDu);/* wQuiver == -3 (signed 16-bit) */
    w16(r + 0x0Eu, 0xFFFEu);/* wShoots == -2 (signed 16-bit) */
    w8(r + 0x1Fu, 1u);      /* nStaffMods */
    w8(r + 0x21u, 8u);      /* nRarity / nClass == 8 (> 7 boundary) */
    w8(r + 0x22u, 0xFFu);   /* nStorePage == 0xFF */
    w8(r + 0x23u, 1u);      /* nVarInvGfx */
  }

  /* Unit & ItemData */
  w32(ADDR_UNIT + 0x00u, unit_type);
  w32(ADDR_UNIT + 0x04u, class_id);
  w32(ADDR_UNIT + 0x14u, ADDR_ITEMDATA);

  w32(ADDR_ITEMDATA + 0x2Cu, (uint32_t)ilvl);

  /* Output buffer pre-filled with 0xAA to detect zero-writes */
  w8(ADDR_OUT_LOCS + 0u, 0xAAu);
  w8(ADDR_OUT_LOCS + 1u, 0xBBu);
  w8(ADDR_OUT_LOCS + 2u, 0xCCu);
  w8(ADDR_OUT_LOCS + 3u, 0xDDu);
}

static void add_state_ranges(
  Snap *s,
  int include_unit,
  uint32_t class_id,
  int include_itemdata,
  int include_out_locs,
  int null_itemtypes_ptr
) {
  snap_add(s, VA_SGPT_DATATABLES, 4u);
  snap_add(s, VA_ITEMS_TXT_COUNT, 8u);
  snap_add(s, ADDR_DATATABLES + SGPT_OFF_ITEMTYPES_PTR, 8u);

  if (include_unit) {
    snap_add(s, ADDR_UNIT, SZ_UNIT_DUMP);
    if (class_id < 7u) {
      snap_add(s, ADDR_ITEMS_TXT + class_id * SZ_ITEMS_TXT, SZ_ITEMS_TXT);
      if (!null_itemtypes_ptr && class_id < 4u) {
        snap_add(s, ADDR_ITEMTYPES_TXT + class_id * SZ_ITEMTYPES_TXT, SZ_ITEMTYPES_TXT);
      }
    }
  }
  if (include_itemdata) {
    snap_add(s, ADDR_ITEMDATA, SZ_ITEMDATA_DUMP);
  }
  if (include_out_locs) {
    snap_add(s, ADDR_OUT_LOCS, 4u);
  }
}

static void emit_a01_vectors(FILE *out) {
  const char *fname = "ITEMS_GetAllowedBodyLocations";
  struct {
    const char *label;
    int is_null_unit;
    uint32_t unit_type;
    uint32_t class_id;
    int null_itemtypes;
  } cases[] = {
    { "null_unit_zeros_locs",          1, 4u, 0u, 0 },
    { "non_item_unit_zeros_locs",      0, 1u, 0u, 0 },
    { "neg_wtype1_zeros_locs",         0, 4u, 4u, 0 },
    { "oob_wtype1_eq_count_zeros",     0, 4u, 5u, 0 },
    { "oob_wtype1_gt_count_zeros",     0, 4u, 6u, 0 },
    { "null_itemtypes_ptr_t0_zeros",   0, 4u, 0u, 1 },
    { "valid_type0_locs_4_5",          0, 4u, 0u, 0 },
    { "valid_type1_locs_3_0",          0, 4u, 1u, 0 },
    { "valid_type2_locs_0_5",          0, 4u, 2u, 0 },
  };
  Snap s = {0};
  for (size_t i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
    reset_standard_tables(cases[i].unit_type, cases[i].class_id, 10, cases[i].null_itemtypes);
    uint32_t p_item = cases[i].is_null_unit ? 0u : ADDR_UNIT;
    uint32_t args[3] = { p_item, ADDR_OUT_LOCS, ADDR_OUT_LOCS + 1u };
    add_state_ranges(&s, !cases[i].is_null_unit, cases[i].class_id, 0, 1, cases[i].null_itemtypes);
    snap_capture(&s);
    call_stdcall3_void(VA_A01_GET_ALLOWED_BODY_LOCS, args[0], args[1], args[2]);
    emit_line(out, VA_A01_GET_ALLOWED_BODY_LOCS, fname, cases[i].label, args, 3, 0u, 0u, &s);
  }
}

static void emit_simple_1arg_vectors(
  FILE *out,
  uint32_t va,
  const char *fname,
  uint32_t ret_mask
) {
  struct {
    const char *label;
    int is_null_unit;
    uint32_t unit_type;
    uint32_t class_id;
    int null_itemtypes;
  } cases[] = {
    { "null_unit",                 1, 4u, 0u, 0 },
    { "non_item_unit_t1",          0, 1u, 0u, 0 },
    { "non_item_unit_t3",          0, 3u, 0u, 0 },
    { "non_item_unit_t5",          0, 5u, 0u, 0 },
    { "neg_wtype1",                0, 4u, 4u, 0 },
    { "oob_wtype1_eq_count",       0, 4u, 5u, 0 },
    { "oob_wtype1_gt_count",       0, 4u, 6u, 0 },
    { "null_itemtypes_ptr_t0",     0, 4u, 0u, 1 },
    { "valid_row0_active",         0, 4u, 0u, 0 },
    { "valid_row1_zero_or_seven",  0, 4u, 1u, 0 },
    { "valid_row2_high_values",    0, 4u, 2u, 0 },
    { "valid_row3_boundary",       0, 4u, 3u, 0 },
  };
  Snap s = {0};
  for (size_t i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
    reset_standard_tables(cases[i].unit_type, cases[i].class_id, 10, cases[i].null_itemtypes);
    uint32_t p_item = cases[i].is_null_unit ? 0u : ADDR_UNIT;
    uint32_t args[1] = { p_item };
    add_state_ranges(&s, !cases[i].is_null_unit, cases[i].class_id, 0, 0, cases[i].null_itemtypes);
    snap_capture(&s);
    uint32_t eax = call_stdcall1(va, args[0]);
    emit_line(out, va, fname, cases[i].label, args, 1, ret_mask, eax, &s);
  }
}

static void emit_a11_vectors(FILE *out) {
  const char *fname = "ITEMS_GetMaxSocketsFromItemType";
  struct {
    const char *label;
    int is_null_unit;
    uint32_t unit_type;
    uint32_t class_id;
    int32_t ilvl;
    int null_itemdata;
    int null_itemtypes;
    uint8_t belt_override;
    int use_belt_override;
  } cases[] = {
    { "null_unit",                     1, 4u, 0u, 10, 0, 0, 0u, 0 },
    { "non_item_unit",                 0, 2u, 0u, 10, 0, 0, 0u, 0 },
    { "neg_wtype1",                    0, 4u, 4u, 10, 0, 0, 0u, 0 },
    { "oob_wtype1_eq_count",           0, 4u, 5u, 10, 0, 0, 0u, 0 },
    { "null_itemtypes_ptr_t0",         0, 4u, 0u, 10, 0, 1, 0u, 0 },
    { "ilvl_neg5_tier1_clamps_ilvl",   0, 4u, 0u, -5, 0, 0, 0u, 0 },
    { "ilvl_0_tier1_clamps_ilvl",      0, 4u, 0u, 0,  0, 0, 0u, 0 },
    { "ilvl_1_tier1_null_itemdata",    0, 4u, 0u, 50, 1, 0, 0u, 0 },
    { "ilvl_25_tier1_boundary",        0, 4u, 0u, 25, 0, 0, 0u, 0 },
    { "ilvl_26_tier25_boundary",       0, 4u, 0u, 26, 0, 0, 0u, 0 },
    { "ilvl_40_tier25_boundary",       0, 4u, 0u, 40, 0, 0, 0u, 0 },
    { "ilvl_41_tier40_boundary",       0, 4u, 0u, 41, 0, 0, 0u, 0 },
    { "ilvl_99_tier40_capped_by_belt", 0, 4u, 1u, 99, 0, 0, 0u, 0 }, /* row1: nMaxSock40=5, belt=2 -> 2 */
    { "ilvl_99_tier40_capped_by_type", 0, 4u, 2u, 99, 0, 0, 0u, 0 }, /* row2: nMaxSock40=4, belt=5 -> 4 */
    { "ilvl_99_equal_belt_and_type",   0, 4u, 0u, 99, 0, 0, 6u, 1 }, /* row0: nMaxSock40=6, belt=6 -> 6 */
    { "ilvl_25_capped_by_belt1",       0, 4u, 0u, 25, 0, 0, 1u, 1 }, /* row0: nMaxSock1=3, belt=1 -> 1 */
    { "ilvl_30_capped_by_belt3",       0, 4u, 0u, 30, 0, 0, 3u, 1 }, /* row0: nMaxSock25=4, belt=3 -> 3 */
  };
  Snap s = {0};
  for (size_t i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
    reset_standard_tables(cases[i].unit_type, cases[i].class_id, cases[i].ilvl, cases[i].null_itemtypes);
    if (cases[i].null_itemdata) {
      w32(ADDR_UNIT + 0x14u, 0u);
    }
    if (cases[i].use_belt_override && cases[i].class_id < 7u) {
      w8(ADDR_ITEMS_TXT + cases[i].class_id * SZ_ITEMS_TXT + 0x138u, cases[i].belt_override);
    }
    uint32_t p_item = cases[i].is_null_unit ? 0u : ADDR_UNIT;
    uint32_t args[1] = { p_item };
    add_state_ranges(&s, !cases[i].is_null_unit, cases[i].class_id, !cases[i].null_itemdata, 0, cases[i].null_itemtypes);
    snap_capture(&s);
    uint32_t eax = call_stdcall1(VA_A11_GET_MAX_SOCKETS_TYPE, args[0]);
    emit_line(out, VA_A11_GET_MAX_SOCKETS_TYPE, fname, cases[i].label, args, 1, 0xFFu, eax, &s);
  }
}

static void emit_a17_vectors(FILE *out) {
  const char *fname = "ITEMS_CanBeEquipped";
  struct {
    const char *label;
    int is_null_unit;
    uint32_t unit_type;
    uint32_t class_id;
    int null_itemtypes;
    uint8_t nbody;
    uint8_t loc1;
    uint8_t loc2;
    int custom_locs;
  } cases[] = {
    { "null_unit",                 1, 4u, 0u, 0, 0u, 0u, 0u, 0 },
    { "non_item_unit",             0, 1u, 0u, 0, 0u, 0u, 0u, 0 },
    { "neg_wtype1",                0, 4u, 4u, 0, 0u, 0u, 0u, 0 },
    { "oob_wtype1_eq_count",       0, 4u, 5u, 0, 0u, 0u, 0u, 0 },
    { "null_itemtypes_ptr_t0",     0, 4u, 0u, 1, 0u, 0u, 0u, 0 },
    { "nbody0_locs_3_3_returns_0", 0, 4u, 1u, 0, 0u, 3u, 3u, 1 },
    { "nbody1_locs_0_0_returns_0", 0, 4u, 0u, 0, 1u, 0u, 0u, 1 },
    { "nbody1_locs_0_5_returns_1", 0, 4u, 0u, 0, 1u, 0u, 5u, 1 },
    { "nbody1_locs_4_0_returns_1", 0, 4u, 0u, 0, 1u, 4u, 0u, 1 },
    { "nbody1_locs_1_1_returns_1", 0, 4u, 0u, 0, 1u, 1u, 1u, 1 },
    { "nbody2_locs_4_5_returns_2", 0, 4u, 0u, 0, 2u, 4u, 5u, 1 },
  };
  Snap s = {0};
  for (size_t i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
    reset_standard_tables(cases[i].unit_type, cases[i].class_id, 10, cases[i].null_itemtypes);
    if (cases[i].custom_locs && cases[i].class_id < 4u) {
      uint32_t r = ADDR_ITEMTYPES_TXT + cases[i].class_id * SZ_ITEMTYPES_TXT;
      w8(r + 0x09u, cases[i].nbody);
      w8(r + 0x0Au, cases[i].loc1);
      w8(r + 0x0Bu, cases[i].loc2);
    }
    uint32_t p_item = cases[i].is_null_unit ? 0u : ADDR_UNIT;
    uint32_t args[1] = { p_item };
    add_state_ranges(&s, !cases[i].is_null_unit, cases[i].class_id, 0, 0, cases[i].null_itemtypes);
    snap_capture(&s);
    uint32_t eax = call_stdcall1(VA_A17_CAN_BE_EQUIPPED, args[0]);
    emit_line(out, VA_A17_CAN_BE_EQUIPPED, fname, cases[i].label, args, 1, 0xFFFFFFFFu, eax, &s);
  }
}

static void emit_a18_vectors(FILE *out) {
  const char *fname = "ITEMS_CheckBodyLocation";
  struct {
    const char *label;
    int is_null_unit;
    uint32_t unit_type;
    uint32_t class_id;
    uint32_t body_loc;
    uint8_t b1;
    uint8_t b2;
    int custom;
  } cases[] = {
    { "null_unit_loc0",            1, 4u, 0u, 0u,        4u, 5u, 0 },
    { "null_unit_loc4",            1, 4u, 0u, 4u,        4u, 5u, 0 },
    { "non_item_unit_loc0",        0, 1u, 0u, 0u,        4u, 5u, 0 },
    { "non_item_unit_loc4",        0, 1u, 0u, 4u,        4u, 5u, 0 },
    { "neg_wtype1_loc0",           0, 4u, 4u, 0u,        0u, 0u, 0 },
    { "neg_wtype1_loc4",           0, 4u, 4u, 4u,        0u, 0u, 0 },
    { "match_loc1_exact",          0, 4u, 0u, 4u,        4u, 5u, 1 },
    { "match_loc2_exact",          0, 4u, 0u, 5u,        4u, 5u, 1 },
    { "mismatch_loc_neither",      0, 4u, 0u, 3u,        4u, 5u, 1 },
    { "swap_loc11_b1_is_4",        0, 4u, 0u, 11u,       4u, 0u, 1 },
    { "swap_loc11_b2_is_4",        0, 4u, 0u, 11u,       0u, 4u, 1 },
    { "swap_loc11_b1_is_5",        0, 4u, 0u, 11u,       5u, 0u, 1 },
    { "swap_loc11_b2_is_5",        0, 4u, 0u, 11u,       0u, 5u, 1 },
    { "swap_loc12_b1_is_4",        0, 4u, 0u, 12u,       4u, 0u, 1 },
    { "swap_loc12_b2_is_4",        0, 4u, 0u, 12u,       0u, 4u, 1 },
    { "swap_loc12_b1_is_5",        0, 4u, 0u, 12u,       5u, 0u, 1 },
    { "swap_loc12_b2_is_5",        0, 4u, 0u, 12u,       0u, 5u, 1 },
    { "swap_loc11_neither_4_5",    0, 4u, 0u, 11u,       3u, 6u, 1 },
    { "swap_loc12_neither_4_5",    0, 4u, 0u, 12u,       3u, 6u, 1 },
    { "swap_loc10_b1_is_4",        0, 4u, 0u, 10u,       4u, 5u, 1 },
    { "swap_loc13_b1_is_4",        0, 4u, 0u, 13u,       4u, 5u, 1 },
    { "mismatch_high_byte_low4",   0, 4u, 0u, 0x000104u, 4u, 5u, 1 },
  };
  Snap s = {0};
  for (size_t i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
    reset_standard_tables(cases[i].unit_type, cases[i].class_id, 10, 0);
    if (cases[i].custom && cases[i].class_id < 4u) {
      uint32_t r = ADDR_ITEMTYPES_TXT + cases[i].class_id * SZ_ITEMTYPES_TXT;
      w8(r + 0x0Au, cases[i].b1);
      w8(r + 0x0Bu, cases[i].b2);
    }
    uint32_t p_item = cases[i].is_null_unit ? 0u : ADDR_UNIT;
    uint32_t args[2] = { p_item, cases[i].body_loc };
    add_state_ranges(&s, !cases[i].is_null_unit, cases[i].class_id, 0, 0, 0);
    snap_capture(&s);
    uint32_t eax = call_stdcall2(VA_A18_CHECK_BODY_LOCATION, args[0], args[1]);
    emit_line(out, VA_A18_CHECK_BODY_LOCATION, fname, cases[i].label, args, 2, 0xFFFFFFFFu, eax, &s);
  }
}

int main(int argc, char **argv) {
  const char *dll_dir = (argc > 1) ? argv[1] : ".";
  const char *out_path = (argc > 2) ? argv[2] : "i9b-a-vectors.ndjson";

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
  if (!arena) {
    fprintf(stderr, "VirtualAlloc failed\n");
    return 3;
  }
  /* Unprotect D2Common .rdata/.data/.bss so the synthetic globals can be staged. */
  DWORD old_prot = 0;
  VirtualProtect((void *)(uintptr_t)0x6FDD9000u, 0x19000u, PAGE_READWRITE, &old_prot);

  FILE *out = fopen(out_path, "wb");
  if (!out) {
    fprintf(stderr, "Failed to open output file: %s\n", out_path);
    return 4;
  }

  emit_a01_vectors(out);
  emit_simple_1arg_vectors(out, VA_A02_IS_NORMAL_ALLOWED,        "ITEMS_IsNormalQualityAllowed",        0xFFFFFFFFu);
  emit_simple_1arg_vectors(out, VA_A03_IS_MAGIC_ALLOWED,         "ITEMS_IsMagicQualityAllowed",         0xFFFFFFFFu);
  emit_simple_1arg_vectors(out, VA_A04_IS_RARE_ALLOWED,          "ITEMS_IsRareQualityAllowed",          0xFFFFFFFFu);
  emit_simple_1arg_vectors(out, VA_A05_GET_VAR_INV_GFX,          "ITEMS_GetVarInvGfxCount",             0xFFu);
  emit_simple_1arg_vectors(out, VA_A06_GET_STORE_PAGE,           "ITEMS_GetStorePage",                  0xFFu);
  emit_simple_1arg_vectors(out, VA_A07_IS_REEQUIP,               "ITEMS_IsReEquip",                     0xFFFFFFFFu);
  emit_simple_1arg_vectors(out, VA_A08_IS_RELOAD,                "ITEMS_IsReload",                      0xFFFFFFFFu);
  emit_simple_1arg_vectors(out, VA_A09_GET_CLASS_SPECIFIC_CLASS, "ITEMS_GetClassOfClassSpecificItem",   0xFFFFFFFFu);
  emit_simple_1arg_vectors(out, VA_A10_IS_CLASS_SPECIFIC,        "ITEMS_IsClassSpecific",               0xFFFFFFFFu);
  emit_a11_vectors(out);
  emit_simple_1arg_vectors(out, VA_A12_GET_STAFF_MODS_CLASS,     "ITEMS_GetStaffModsClass",             0xFFFFFFFFu);
  emit_simple_1arg_vectors(out, VA_A13_IS_BELTABLE,              "ITEMS_IsBeltable",                    0xFFFFFFFFu);
  emit_simple_1arg_vectors(out, VA_A14_IS_AUTO_STACK,            "ITEMS_IsAutoStack",                   0xFFFFFFFFu);
  emit_simple_1arg_vectors(out, VA_A15_GET_SHOOTS_FROM_ITEM,     "ITEMS_GetItemTypeShootsFromItem",     0xFFFFFFFFu);
  emit_simple_1arg_vectors(out, VA_A16_GET_QUIVER_FROM_ITEM,     "ITEMS_GetItemTypeQuiverFromItem",     0xFFFFFFFFu);
  emit_a17_vectors(out);
  emit_a18_vectors(out);

  fclose(out);
  printf("Successfully emitted %s\n", out_path);
  return 0;
}
