/*
 * Standalone MinGW real-DLL differential vector emitter for Lane B Iteration-2
 * batches B003 (14 functions in common/skills.ts) and B006 (17 functions in
 * tables/{lvl,item,missile}-tbls-113c.ts).
 *
 * Loads the real Diablo II v1.13c Storm.dll, Fog.dll, and D2Common.dll at its
 * canonical image base 0x6FD50000, stages deterministic pre-call memory blocks
 * in a fixed VirtualAlloc arena at 0x20000000, invokes each real D2Common.dll
 * function entry point via exact x86 register/stack thunks, and records:
 *   - tests/fixtures/oracle/k1/b003-vectors.json
 *   - tests/fixtures/oracle/k1/b006-vectors.json
 */
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#define ARENA_BASE            0x20000000u
#define ARENA_SIZE            0x00100000u

/* Deterministic layout within ARENA_BASE (0x20000000) */
#define ADDR_BITMASKS         0x20000100u /* 128 bytes: 32 u32s from Fog gdwBitMasks */
#define ADDR_DATATABLES       0x20001000u /* 0xD00 bytes: synthetic D2DataTablesStrc */
#define ADDR_ITYPE_EQUIV      0x20002000u /* 256 bytes: pItemTypesEquivMask */
#define ADDR_UNIT             0x20002200u /* 244 bytes: D2UnitStrc */
#define ADDR_STATLISTEX       0x20002400u /* 100 bytes: D2StatListExStrc */
#define ADDR_STATEFLAGS       0x20002500u /* 32 bytes: pStateFlags */
#define ADDR_COEFFS           0x20002600u /* 24 bytes: 6 int32s for 0x6FD9DDB0 */
#define ADDR_SKILLLIST        0x20002700u /* 24 bytes: D2SkillListStrc */
#define ADDR_SKILL_1          0x20002800u /* 64 bytes: D2SkillStrc */
#define ADDR_SKILL_2          0x20002880u /* 64 bytes: D2SkillStrc */
#define ADDR_SKILL_3          0x20002900u /* 64 bytes: D2SkillStrc */
#define ADDR_SKILLSTXT        0x20003000u /* 4 * 0x23C bytes: D2SkillsTxt[4] */
#define ADDR_CLASSSKILL_CNT   0x20004000u /* 28 bytes: pPlayerClassSkillCount[7] */
#define ADDR_CLASSSKILL_LST   0x20004100u /* 448 bytes: pPlayerClassSkillList */

#define ADDR_LVLTYPES         0x20005000u /* 36 * 0x1B0 bytes */
#define ADDR_LEVELDEF         0x20007000u /* 137 * 0x9C bytes */
#define ADDR_LEVELSTXT        0x2000B000u /* 137 * 0x220 bytes */

#define ADDR_ASTAR_CTX        0x20020000u /* 0x3300 bytes: D2AStarContextStrc */
#define ADDR_ASTAR_NODES      0x20024000u /* 8 * 0x38 bytes: D2AStarNodeStrc[8] */

#define ADDR_DRLG             0x20025000u /* 0x480 bytes: D2DrlgStrc (status sentinels at +0xA0..+0x364) */
#define ADDR_LEVEL            0x20025500u /* 0x230 bytes: D2DrlgLevelStrc */
#define ADDR_ROOM_A           0x20025800u /* 0xEC bytes: D2RoomExStrc */
#define ADDR_ROOM_B           0x20025900u /* 0xEC bytes: D2RoomExStrc */
#define ADDR_ROOM_C           0x20025A00u /* 0xEC bytes: D2RoomExStrc */
#define ADDR_ROOMS_NEAR_A     0x20025B00u /* 16 bytes: ppRoomsNear[4] */
#define ADDR_ROOMS_NEAR_B     0x20025B40u /* 16 bytes: ppRoomsNear[4] */
#define ADDR_MISSILESTXT      0x20026000u /* 4 * 0x1A4 bytes: D2MissilesTxt[4] */

#define ADDR_LINKDATA         0x20030000u /* 0x1F4 bytes: D2DrlgLevelLinkDataStrc */
#define ADDR_LINKARR          0x20030400u /* 64 bytes: D2LevelLinkStrc[4] */
#define ADDR_OUTDOORS         0x20031000u /* 0x268 bytes: D2DrlgOutdoorInfoStrc */
#define ADDR_VTX_RING         0x20031400u /* 6 * 0x18 bytes: D2DrlgVertexStrc[6] */
#define ADDR_GRID0_ROWS       0x20031600u /* 32 bytes: pGrid0RowOffsets[8] */
#define ADDR_GRID0_CELLS      0x20031700u /* 256 bytes: pGrid0Cells[64] */
#define ADDR_GRID2_ROWS       0x20031900u /* 32 bytes: pGrid2RowOffsets[8] */
#define ADDR_GRID2_CELLS      0x20031A00u /* 256 bytes: pGrid2Cells[64] */
#define ADDR_IO_PAIR          0x20031C00u /* 16 bytes: scratch out-params */
#define ADDR_HIRELING_TXT     0x20032000u /* 6 * 0x118 bytes: D2HirelingTxt[6] */
#define ADDR_SUPERUNIQUES     0x20033000u /* 6 * 0x34 bytes: D2SuperUniquesTxt[6] */
#define ADDR_TCEX             0x20033400u /* 6 * 0x2C bytes: D2TreasureClassExStrc[6] */
#define ADDR_MONSTATS_TXT     0x20034000u /* 4 * 0x1A8 bytes: D2MonStatsTxt[4] */
#define ADDR_MONSTATS2_TXT    0x20035000u /* 4 * 0x134 bytes: D2MonStats2Txt[4] */
#define ADDR_MONSEQ_TBL       0x20036000u /* 8 * 12 bytes: D2MonSeqTableStrc[8] */
#define ADDR_DYN_PATH         0x20036200u /* 32 bytes: D2DynamicPathStrc prefix */
#define ADDR_STATIC_PATH      0x20036300u /* 20 bytes: D2StaticPathStrc */

/* D2Common.dll canonical VAs (ImageBase = 0x6FD50000) */
#define VA_GDWBITMASKS_IAT    0x6FDD90B0u
#define VA_ASTAR_HASH_X       0x6FDDB458u
#define VA_ASTAR_HASH_Y       0x6FDDB658u
#define VA_SGPT_DATATABLES    0x6FDE9E1Cu
#define VA_ITEM_TABLES        0x6FDEFB94u
#define VA_MAGIC_TABLES       0x6FDEFBB8u
#define VA_RARE_TABLES        0x6FDEFBDCu
#define VA_GAMBLE_TABLES      0x6FDEFBF0u
#define VA_HIRELING_TXT_PTR   0x6FDF0078u
#define VA_HIRELING_TXT_CNT   0x6FDF007Cu
#define VA_HIRELING_SUB_LUT   0x6FDF0080u
#define VA_TCEX_PTR           0x6FDF0894u
#define VA_TCEX_CNT           0x6FDF0898u
#define VA_MONSTATS_TXT_PTR   0x6FDF0950u
#define VA_MONSTATS_TXT_CNT   0x6FDF0958u
#define VA_SUPERUNIQUES_PTR   0x6FDF09ACu
#define VA_SUPERUNIQUES_CNT   0x6FDF09B4u
#define VA_MISSILES_TXT_PTR   0x6FDF0A3Cu
#define VA_MISSILES_TXT_CNT   0x6FDF0A44u
#define VA_MONSEQ_PTR         0x6FDF0A5Cu
#define VA_MONSEQ_CNT         0x6FDF0A60u
#define VA_LEVELDEF_BIN_PTR   0x6FDF0B38u
#define VA_LVLTYPES_TXT_PTR   0x6FDF0B3Cu

/* Assembly thunks for D2Common custom and stdcall conventions */
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

static uint32_t call_fastcall3(uintptr_t fn, uint32_t ecx_in, uint32_t edx_in, uint32_t s0) {
  typedef uint32_t (__fastcall *Fast3)(uint32_t, uint32_t, uint32_t);
  return ((Fast3)fn)(ecx_in, edx_in, s0);
}

static uint32_t call_fastcall4(uintptr_t fn, uint32_t ecx_in, uint32_t edx_in, uint32_t s0, uint32_t s1) {
  typedef uint32_t (__fastcall *Fast4)(uint32_t, uint32_t, uint32_t, uint32_t);
  return ((Fast4)fn)(ecx_in, edx_in, s0, s1);
}

static __attribute__((noinline)) uint32_t call_eax_edi_s2(uintptr_t fn, uint32_t eax_in, uint32_t edi_in, uint32_t s0, uint32_t s1) {
  uint32_t out;
  __asm__ volatile (
    "pushl %[s1]\n\t"
    "pushl %[s0]\n\t"
    "call *%[fn]\n\t"
    : "=a"(out), "+D"(edi_in), [s0]"+c"(s0), [s1]"+d"(s1)
    : "a"(eax_in), [fn]"b"(fn)
    : "memory", "cc"
  );
  return out;
}

static uint32_t call_void0(uintptr_t fn) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "=a"(out)
    : [fn]"r"(fn)
    : "ecx", "edx", "memory", "cc"
  );
  return out;
}

static uint32_t call_eax(uintptr_t fn, uint32_t eax_in) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "=a"(out)
    : "a"(eax_in), [fn]"r"(fn)
    : "ecx", "edx", "memory", "cc"
  );
  return out;
}

static uint32_t call_ecx(uintptr_t fn, uint32_t ecx_in) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "=a"(out), "+c"(ecx_in)
    : [fn]"r"(fn)
    : "edx", "memory", "cc"
  );
  return out;
}

static uint32_t call_eax_ecx(uintptr_t fn, uint32_t eax_in, uint32_t ecx_in) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "=a"(out), "+c"(ecx_in)
    : "a"(eax_in), [fn]"r"(fn)
    : "edx", "memory", "cc"
  );
  return out;
}

static uint32_t call_eax_edx(uintptr_t fn, uint32_t eax_in, uint32_t edx_in) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "=a"(out), "+d"(edx_in)
    : "a"(eax_in), [fn]"r"(fn)
    : "ecx", "memory", "cc"
  );
  return out;
}

static uint32_t call_eax_esi(uintptr_t fn, uint32_t eax_in, uint32_t esi_in) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "=a"(out), "+S"(esi_in)
    : "a"(eax_in), [fn]"r"(fn)
    : "ecx", "edx", "memory", "cc"
  );
  return out;
}

static uint32_t call_eax_ebx(uintptr_t fn, uint32_t eax_in, uint32_t ebx_in) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "=a"(out), "+b"(ebx_in)
    : "a"(eax_in), [fn]"r"(fn)
    : "ecx", "edx", "memory", "cc"
  );
  return out;
}

static inline void w32(uint32_t addr, uint32_t val) {
  *(uint32_t *)(uintptr_t)addr = val;
}
static inline void w16(uint32_t addr, uint16_t val) {
  *(uint16_t *)(uintptr_t)addr = val;
}
static inline void w8(uint32_t addr, uint8_t val) {
  *(uint8_t *)(uintptr_t)addr = val;
}

static void write_hex(FILE *fp, const uint8_t *buf, uint32_t len) {
  for (uint32_t i = 0; i < len; i++) {
    fprintf(fp, "%02x", buf[i]);
  }
}

typedef struct {
  uint32_t addr;
  uint32_t len;
} RangeSpec;

static void capture_pre(const RangeSpec *ranges, int n, uint8_t **pre_bufs) {
  for (int i = 0; i < n; i++) {
    pre_bufs[i] = (uint8_t *)malloc(ranges[i].len);
    memcpy(pre_bufs[i], (const void *)(uintptr_t)ranges[i].addr, ranges[i].len);
  }
}

static void emit_case_json(
  FILE *fp,
  int *first_case,
  uint32_t va,
  const char *name,
  const char *case_id,
  const char *compare_mode,
  uint32_t eax_in,
  uint32_t ebx_in,
  uint32_t ecx_in,
  uint32_t edx_in,
  uint32_t esi_in,
  uint32_t edi_in,
  const uint32_t *stack_args,
  int n_stack,
  uint32_t out_eax,
  const RangeSpec *ranges,
  int n_ranges,
  uint8_t **pre_bufs
) {
  if (!*first_case) {
    fprintf(fp, ",\n");
  }
  *first_case = 0;

  uint32_t masked_eax = 0u;
  if (strcmp(compare_mode, "void") == 0) {
    masked_eax = 0u;
  } else if (strcmp(compare_mode, "al") == 0) {
    masked_eax = out_eax & 0xFFu;
  } else {
    masked_eax = out_eax;
  }

  fprintf(fp, "    {\n");
  fprintf(fp, "      \"va\": \"0x%08X\",\n", va);
  fprintf(fp, "      \"name\": \"%s\",\n", name);
  fprintf(fp, "      \"caseId\": \"%s\",\n", case_id);
  fprintf(fp, "      \"compareMode\": \"%s\",\n", compare_mode);
  fprintf(fp, "      \"regs\": { \"eax\": %u, \"ebx\": %u, \"ecx\": %u, \"edx\": %u, \"esi\": %u, \"edi\": %u },\n",
          eax_in, ebx_in, ecx_in, edx_in, esi_in, edi_in);
  fprintf(fp, "      \"stack\": [");
  for (int i = 0; i < n_stack; i++) {
    fprintf(fp, "%s%u", i > 0 ? ", " : "", stack_args[i]);
  }
  fprintf(fp, "],\n");
  fprintf(fp, "      \"outEax\": %u,\n", masked_eax);

  fprintf(fp, "      \"preBlocks\": [\n");
  for (int i = 0; i < n_ranges; i++) {
    fprintf(fp, "        { \"addr\": \"0x%08X\", \"hex\": \"", ranges[i].addr);
    write_hex(fp, pre_bufs[i], ranges[i].len);
    fprintf(fp, "\" }%s\n", (i + 1 < n_ranges) ? "," : "");
  }
  fprintf(fp, "      ],\n");

  fprintf(fp, "      \"postBlocks\": [\n");
  for (int i = 0; i < n_ranges; i++) {
    const uint8_t *post_ptr = (const uint8_t *)(uintptr_t)ranges[i].addr;
    fprintf(fp, "        { \"addr\": \"0x%08X\", \"hex\": \"", ranges[i].addr);
    write_hex(fp, post_ptr, ranges[i].len);
    fprintf(fp, "\" }%s\n", (i + 1 < n_ranges) ? "," : "");
    free(pre_bufs[i]);
  }
  fprintf(fp, "      ]\n");
  fprintf(fp, "    }");
}

static void emit_b003(FILE *fp) {
  int first = 1;
  uint8_t *pre[8];

  /* 1. 0x6FD72820 ITEMS_CheckItemTypeIdEquivalent (__stdcall(nItemType1, nItemType2) -> eax) */
  {
    const uint32_t va = 0x6FD72820u;
    const char *nm = "ITEMS_CheckItemTypeIdEquivalent";
    memset((void *)ADDR_DATATABLES, 0, 0xD00);
    memset((void *)ADDR_ITYPE_EQUIV, 0, 256);
    w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);
    w32(ADDR_DATATABLES + 0xBFC, 80u); /* nItemTypesTxtRecordCount = 80 */
    w32(ADDR_DATATABLES + 0xC00, 3u);  /* nItemTypesIndexStride = 3 */
    w32(ADDR_DATATABLES + 0xC04, ADDR_ITYPE_EQUIV);
    /* Set bit (nItemType2=35 -> word 1, bit 3 -> 0x08) for nItemType1=2 (row index = 2*3 + 1 = 7) */
    w32(ADDR_ITYPE_EQUIV + 7 * 4, 1u << 3);
    /* Also set non-zero mask at row index 2*3 + (-1) = 5 so nItemType2 = -1 would read non-zero if unguarded */
    w32(ADDR_ITYPE_EQUIV + 5 * 4, 0xFFFFFFFFu);

    RangeSpec r_full[5] = {
      { VA_SGPT_DATATABLES, 4 },
      { VA_GDWBITMASKS_IAT, 4 },
      { ADDR_BITMASKS, 128 },
      { ADDR_DATATABLES + 0xBF8, 0x18 },
      { ADDR_ITYPE_EQUIV, 256 }
    };

    uint32_t s1[2] = { (uint32_t)-1, 2u };
    capture_pre(r_full, 5, pre);
    uint32_t eax = call_stdcall2(va, s1[0], s1[1]);
    emit_case_json(fp, &first, va, nm, "type1_neg1_returns_0", "eax", 0, 0, 0, 0, 0, 0, s1, 2, eax, r_full, 5, pre);

    uint32_t s2[2] = { 2u, (uint32_t)-5 };
    capture_pre(r_full, 5, pre);
    eax = call_stdcall2(va, s2[0], s2[1]);
    emit_case_json(fp, &first, va, nm, "type2_neg5_returns_0", "eax", 0, 0, 0, 0, 0, 0, s2, 2, eax, r_full, 5, pre);

    uint32_t s2b[2] = { 2u, (uint32_t)-1 };
    capture_pre(r_full, 5, pre);
    eax = call_stdcall2(va, s2b[0], s2b[1]);
    emit_case_json(fp, &first, va, nm, "type2_neg1_mask_non_zero_returns_0", "eax", 0, 0, 0, 0, 0, 0, s2b, 2, eax, r_full, 5, pre);

    uint32_t s3[2] = { 80u, 2u };
    capture_pre(r_full, 5, pre);
    eax = call_stdcall2(va, s3[0], s3[1]);
    emit_case_json(fp, &first, va, nm, "type1_oob_returns_0", "eax", 0, 0, 0, 0, 0, 0, s3, 2, eax, r_full, 5, pre);

    uint32_t s4[2] = { 2u, 80u };
    capture_pre(r_full, 5, pre);
    eax = call_stdcall2(va, s4[0], s4[1]);
    emit_case_json(fp, &first, va, nm, "type2_oob_returns_0", "eax", 0, 0, 0, 0, 0, 0, s4, 2, eax, r_full, 5, pre);

    uint32_t s5[2] = { 2u, 35u };
    capture_pre(r_full, 5, pre);
    eax = call_stdcall2(va, s5[0], s5[1]);
    emit_case_json(fp, &first, va, nm, "equiv_bit_set_returns_8", "eax", 0, 0, 0, 0, 0, 0, s5, 2, eax, r_full, 5, pre);

    uint32_t s6[2] = { 2u, 36u };
    capture_pre(r_full, 5, pre);
    eax = call_stdcall2(va, s6[0], s6[1]);
    emit_case_json(fp, &first, va, nm, "equiv_bit_clear_returns_0", "eax", 0, 0, 0, 0, 0, 0, s6, 2, eax, r_full, 5, pre);
  }

  /* 2. 0x6FD87DB0 STATES_CheckStateMaskOnUnitFast (eax=pUnit, ecx=nStateId -> eax) */
  {
    const uint32_t va = 0x6FD87DB0u;
    const char *nm = "STATES_CheckStateMaskOnUnitFast";
    RangeSpec r[5] = {
      { VA_GDWBITMASKS_IAT, 4 },
      { ADDR_BITMASKS, 128 },
      { ADDR_UNIT, 244 },
      { ADDR_STATLISTEX, 100 },
      { ADDR_STATEFLAGS, 32 }
    };

    /* Case 1: pUnit == 0 */
    memset((void *)ADDR_UNIT, 0, 244);
    memset((void *)ADDR_STATLISTEX, 0, 100);
    memset((void *)ADDR_STATEFLAGS, 0, 32);
    capture_pre(r, 5, pre);
    uint32_t eax = call_eax_ecx(va, 0u, 5u);
    emit_case_json(fp, &first, va, nm, "null_unit", "eax", 0u, 0, 5u, 0, 0, 0, NULL, 0, eax, r, 5, pre);

    /* Case 2: pStatListEx == 0 */
    capture_pre(r, 5, pre);
    eax = call_eax_ecx(va, ADDR_UNIT, 5u);
    emit_case_json(fp, &first, va, nm, "null_statlistex", "eax", ADDR_UNIT, 0, 5u, 0, 0, 0, NULL, 0, eax, r, 5, pre);

    /* Case 3: pStatListEx->dwFlags (+0x10) missing 0x80000000 */
    w32(ADDR_UNIT + 0x5C, ADDR_STATLISTEX);
    w32(ADDR_STATLISTEX + 0x10, 0x7FFFFFFFu);
    w32(ADDR_STATLISTEX + 0x58, ADDR_STATEFLAGS);
    w32(ADDR_STATEFLAGS + 0, 0xFFFFFFFFu);
    capture_pre(r, 5, pre);
    eax = call_eax_ecx(va, ADDR_UNIT, 5u);
    emit_case_json(fp, &first, va, nm, "not_extended_statlist", "eax", ADDR_UNIT, 0, 5u, 0, 0, 0, NULL, 0, eax, r, 5, pre);

    /* Case 4: nStateId = 2 (word 0, bit 2 -> 0x04) set */
    w32(ADDR_STATLISTEX + 0x10, 0x80000000u);
    memset((void *)ADDR_STATEFLAGS, 0, 32);
    w32(ADDR_STATEFLAGS + 0, 1u << 2);
    capture_pre(r, 5, pre);
    eax = call_eax_ecx(va, ADDR_UNIT, 2u);
    emit_case_json(fp, &first, va, nm, "state_2_bit_set", "eax", ADDR_UNIT, 0, 2u, 0, 0, 0, NULL, 0, eax, r, 5, pre);

    /* Case 5: nStateId = 37 (word 1, bit 5 -> 0x20) set */
    memset((void *)ADDR_STATEFLAGS, 0, 32);
    w32(ADDR_STATEFLAGS + 4, 1u << 5);
    capture_pre(r, 5, pre);
    eax = call_eax_ecx(va, ADDR_UNIT, 37u);
    emit_case_json(fp, &first, va, nm, "state_37_bit_set", "eax", ADDR_UNIT, 0, 37u, 0, 0, 0, NULL, 0, eax, r, 5, pre);

    /* Case 6: nStateId = 95 (word 2, bit 31 -> 0x80000000) set */
    memset((void *)ADDR_STATEFLAGS, 0, 32);
    w32(ADDR_STATEFLAGS + 8, 0x80000000u);
    capture_pre(r, 5, pre);
    eax = call_eax_ecx(va, ADDR_UNIT, 95u);
    emit_case_json(fp, &first, va, nm, "state_95_high_bit_set", "eax", ADDR_UNIT, 0, 95u, 0, 0, 0, NULL, 0, eax, r, 5, pre);

    /* Case 7: nStateId = 38 (word 1, bit 6) clear */
    capture_pre(r, 5, pre);
    eax = call_eax_ecx(va, ADDR_UNIT, 38u);
    emit_case_json(fp, &first, va, nm, "state_38_bit_clear", "eax", ADDR_UNIT, 0, 38u, 0, 0, 0, NULL, 0, eax, r, 5, pre);
  }

  /* 3. 0x6FD9DC30 SKILLS_CalcDiminishingReturns (__stdcall(nLevel, nMin, nMax) -> eax) */
  {
    const uint32_t va = 0x6FD9DC30u;
    const char *nm = "SKILLS_CalcDiminishingReturns";
    RangeSpec r[1] = { { ADDR_COEFFS, 4 } };
    w32(ADDR_COEFFS, 0u);

    uint32_t c_args[8][3] = {
      { 0u, 15u, 95u },
      { 1u, 10u, 100u },
      { 5u, 20u, 80u },
      { 20u, 0u, 100u },
      { 60u, 10u, 50u },
      { 100u, 10u, 50u },
      { (uint32_t)-1, 10u, 100u },
      { 1u, 100u, 10u }
    };
    const char *c_ids[8] = {
      "lvl_0_returns_min",
      "lvl_1_returns_23",
      "lvl_5_returns_50",
      "lvl_20_returns_84",
      "lvl_60_exact_max_50",
      "lvl_100_clamped_max_50",
      "lvl_neg1_sdiv_toward_zero",
      "min_gt_max_negative_delta_sdiv"
    };
    for (int i = 0; i < 8; i++) {
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall3(va, c_args[i][0], c_args[i][1], c_args[i][2]);
      emit_case_json(fp, &first, va, nm, c_ids[i], "eax", 0, 0, 0, 0, 0, 0, c_args[i], 3, eax, r, 1, pre);
    }
  }

  /* 4. 0x6FD9DDB0 SKILLS_Calc5BandLinear (eax=nLevel, ecx=pCoeffs -> eax) */
  {
    const uint32_t va = 0x6FD9DDB0u;
    const char *nm = "SKILLS_Calc5BandLinear";
    RangeSpec r[1] = { { ADDR_COEFFS, 20 } };
    w32(ADDR_COEFFS + 0, 10u);
    w32(ADDR_COEFFS + 4, 20u);
    w32(ADDR_COEFFS + 8, 30u);
    w32(ADDR_COEFFS + 12, 40u);
    w32(ADDR_COEFFS + 16, 50u);

    /* Case 1: pCoeffs == 0 */
    capture_pre(r, 1, pre);
    uint32_t eax = call_eax_ecx(va, 5u, 0u);
    emit_case_json(fp, &first, va, nm, "null_coeffs_returns_0", "eax", 5u, 0, 0u, 0, 0, 0, NULL, 0, eax, r, 1, pre);

    int32_t lvls[9] = { -5, 0, 1, 8, 9, 16, 22, 28, 30 };
    const char *c_ids[9] = {
      "lvl_neg5_returns_0",
      "lvl_0_returns_0",
      "lvl_1_returns_0",
      "lvl_8_band1_end",
      "lvl_9_band2_start",
      "lvl_16_band2_end",
      "lvl_22_band3_end",
      "lvl_28_band4_end",
      "lvl_30_band5"
    };
    for (int i = 0; i < 9; i++) {
      capture_pre(r, 1, pre);
      eax = call_eax_ecx(va, (uint32_t)lvls[i], ADDR_COEFFS);
      emit_case_json(fp, &first, va, nm, c_ids[i], "eax", (uint32_t)lvls[i], 0, ADDR_COEFFS, 0, 0, 0, NULL, 0, eax, r, 1, pre);
    }
  }

  /* 5. 0x6FD9E180 SKILLS_GetLeftSkillFromSkillList (__stdcall(pSkillList) -> eax) */
  {
    const uint32_t va = 0x6FD9E180u;
    const char *nm = "SKILLS_GetLeftSkillFromSkillList";
    RangeSpec r[1] = { { ADDR_SKILLLIST, 24 } };

    memset((void *)ADDR_SKILLLIST, 0, 24);
    uint32_t s1[1] = { 0u };
    capture_pre(r, 1, pre);
    uint32_t eax = call_stdcall1(va, s1[0]);
    emit_case_json(fp, &first, va, nm, "null_list", "eax", 0, 0, 0, 0, 0, 0, s1, 1, eax, r, 1, pre);

    uint32_t s2[1] = { ADDR_SKILLLIST };
    w32(ADDR_SKILLLIST + 0x08, 0u);
    capture_pre(r, 1, pre);
    eax = call_stdcall1(va, s2[0]);
    emit_case_json(fp, &first, va, nm, "left_skill_zero", "eax", 0, 0, 0, 0, 0, 0, s2, 1, eax, r, 1, pre);

    w32(ADDR_SKILLLIST + 0x08, ADDR_SKILL_1);
    capture_pre(r, 1, pre);
    eax = call_stdcall1(va, s2[0]);
    emit_case_json(fp, &first, va, nm, "left_skill_valid", "eax", 0, 0, 0, 0, 0, 0, s2, 1, eax, r, 1, pre);

    w32(ADDR_SKILLLIST + 0x08, 0xDEADBEEFu);
    capture_pre(r, 1, pre);
    eax = call_stdcall1(va, s2[0]);
    emit_case_json(fp, &first, va, nm, "left_skill_deadbeef", "eax", 0, 0, 0, 0, 0, 0, s2, 1, eax, r, 1, pre);
  }

  /* 6. 0x6FD9E1A0 SKILLS_SetSkillSlotIndex (__stdcall(pSkill, nSlotIndex) -> void) */
  {
    const uint32_t va = 0x6FD9E1A0u;
    const char *nm = "SKILLS_SetSkillSlotIndex";
    RangeSpec r[1] = { { ADDR_SKILL_1, 64 } };

    memset((void *)ADDR_SKILL_1, 0, 64);
    w32(ADDR_SKILL_1 + 0x08, 99u);
    uint32_t s1[2] = { 0u, 5u };
    capture_pre(r, 1, pre);
    uint32_t eax = call_stdcall2(va, s1[0], s1[1]);
    emit_case_json(fp, &first, va, nm, "null_skill_noop", "void", 0, 0, 0, 0, 0, 0, s1, 2, eax, r, 1, pre);

    uint32_t s2[2] = { ADDR_SKILL_1, (uint32_t)-1 };
    capture_pre(r, 1, pre);
    eax = call_stdcall2(va, s2[0], s2[1]);
    emit_case_json(fp, &first, va, nm, "slot_neg1_oob", "void", 0, 0, 0, 0, 0, 0, s2, 2, eax, r, 1, pre);

    uint32_t s3[2] = { ADDR_SKILL_1, 33u };
    capture_pre(r, 1, pre);
    eax = call_stdcall2(va, s3[0], s3[1]);
    emit_case_json(fp, &first, va, nm, "slot_33_oob", "void", 0, 0, 0, 0, 0, 0, s3, 2, eax, r, 1, pre);

    uint32_t s4[2] = { ADDR_SKILL_1, 0u };
    capture_pre(r, 1, pre);
    eax = call_stdcall2(va, s4[0], s4[1]);
    emit_case_json(fp, &first, va, nm, "slot_0_valid", "void", 0, 0, 0, 0, 0, 0, s4, 2, eax, r, 1, pre);

    uint32_t s5[2] = { ADDR_SKILL_1, 32u };
    capture_pre(r, 1, pre);
    eax = call_stdcall2(va, s5[0], s5[1]);
    emit_case_json(fp, &first, va, nm, "slot_32_upper_bound_valid", "void", 0, 0, 0, 0, 0, 0, s5, 2, eax, r, 1, pre);
  }

  /* 7. 0x6FD9E1C0 SKILLS_GetSkillsTxtFromSkill (ecx=pSkill -> eax) */
  {
    const uint32_t va = 0x6FD9E1C0u;
    const char *nm = "SKILLS_GetSkillsTxtFromSkill";
    RangeSpec r[1] = { { ADDR_SKILL_1, 64 } };

    memset((void *)ADDR_SKILL_1, 0, 64);
    capture_pre(r, 1, pre);
    uint32_t eax = call_ecx(va, 0u);
    emit_case_json(fp, &first, va, nm, "null_skill", "eax", 0, 0, 0u, 0, 0, 0, NULL, 0, eax, r, 1, pre);

    w32(ADDR_SKILL_1 + 0x00, 0u);
    capture_pre(r, 1, pre);
    eax = call_ecx(va, ADDR_SKILL_1);
    emit_case_json(fp, &first, va, nm, "field0_zero", "eax", 0, 0, ADDR_SKILL_1, 0, 0, 0, NULL, 0, eax, r, 1, pre);

    w32(ADDR_SKILL_1 + 0x00, ADDR_SKILLSTXT);
    capture_pre(r, 1, pre);
    eax = call_ecx(va, ADDR_SKILL_1);
    emit_case_json(fp, &first, va, nm, "field0_ptr", "eax", 0, 0, ADDR_SKILL_1, 0, 0, 0, NULL, 0, eax, r, 1, pre);

    w32(ADDR_SKILL_1 + 0x00, 0xCAFEBABEu);
    capture_pre(r, 1, pre);
    eax = call_ecx(va, ADDR_SKILL_1);
    emit_case_json(fp, &first, va, nm, "field0_cafebabe", "eax", 0, 0, ADDR_SKILL_1, 0, 0, 0, NULL, 0, eax, r, 1, pre);
  }

  /* 8. 0x6FD9E1D0 SKILLS_GetSkillIdFromSkill (__stdcall(pSkill, pFile, nLine) -> eax) */
  {
    const uint32_t va = 0x6FD9E1D0u;
    const char *nm = "SKILLS_GetSkillIdFromSkill";
    RangeSpec r[2] = { { ADDR_SKILL_1, 64 }, { ADDR_SKILLSTXT, 0x23C } };

    memset((void *)ADDR_SKILL_1, 0, 64);
    memset((void *)ADDR_SKILLSTXT, 0, 0x23C);
    uint32_t s1[3] = { 0u, 123u, 456u };
    capture_pre(r, 2, pre);
    uint32_t eax = call_stdcall3(va, s1[0], s1[1], s1[2]);
    emit_case_json(fp, &first, va, nm, "null_skill_returns_0", "eax", 0, 0, 0, 0, 0, 0, s1, 3, eax, r, 2, pre);

    w32(ADDR_SKILL_1 + 0x00, ADDR_SKILLSTXT);
    w16(ADDR_SKILLSTXT + 0x00, 0u);
    uint32_t s2[3] = { ADDR_SKILL_1, 0x1111u, 222u };
    capture_pre(r, 2, pre);
    eax = call_stdcall3(va, s2[0], s2[1], s2[2]);
    emit_case_json(fp, &first, va, nm, "skill_id_0_attack", "eax", 0, 0, 0, 0, 0, 0, s2, 3, eax, r, 2, pre);

    w16(ADDR_SKILLSTXT + 0x00, 54u);
    capture_pre(r, 2, pre);
    eax = call_stdcall3(va, s2[0], s2[1], s2[2]);
    emit_case_json(fp, &first, va, nm, "skill_id_54_teleport", "eax", 0, 0, 0, 0, 0, 0, s2, 3, eax, r, 2, pre);

    w16(ADDR_SKILLSTXT + 0x00, 0xFFFFu);
    capture_pre(r, 2, pre);
    eax = call_stdcall3(va, s2[0], s2[1], s2[2]);
    emit_case_json(fp, &first, va, nm, "skill_id_sign_extend_ffff", "eax", 0, 0, 0, 0, 0, 0, s2, 3, eax, r, 2, pre);

    w16(ADDR_SKILLSTXT + 0x00, 0x8001u);
    capture_pre(r, 2, pre);
    eax = call_stdcall3(va, s2[0], s2[1], s2[2]);
    emit_case_json(fp, &first, va, nm, "skill_id_sign_extend_8001", "eax", 0, 0, 0, 0, 0, 0, s2, 3, eax, r, 2, pre);
  }

  /* 9. 0x6FD9E3B0 SKILLS_GetNextSkill (__stdcall(pSkill) -> eax) */
  {
    const uint32_t va = 0x6FD9E3B0u;
    const char *nm = "SKILLS_GetNextSkill";
    RangeSpec r[1] = { { ADDR_SKILL_1, 64 } };

    memset((void *)ADDR_SKILL_1, 0, 64);
    uint32_t s1[1] = { 0u };
    capture_pre(r, 1, pre);
    uint32_t eax = call_stdcall1(va, s1[0]);
    emit_case_json(fp, &first, va, nm, "null_skill", "eax", 0, 0, 0, 0, 0, 0, s1, 1, eax, r, 1, pre);

    uint32_t s2[1] = { ADDR_SKILL_1 };
    w32(ADDR_SKILL_1 + 0x04, 0u);
    capture_pre(r, 1, pre);
    eax = call_stdcall1(va, s2[0]);
    emit_case_json(fp, &first, va, nm, "next_null", "eax", 0, 0, 0, 0, 0, 0, s2, 1, eax, r, 1, pre);

    w32(ADDR_SKILL_1 + 0x04, ADDR_SKILL_2);
    capture_pre(r, 1, pre);
    eax = call_stdcall1(va, s2[0]);
    emit_case_json(fp, &first, va, nm, "next_skill2", "eax", 0, 0, 0, 0, 0, 0, s2, 1, eax, r, 1, pre);

    w32(ADDR_SKILL_1 + 0x04, ADDR_SKILL_3);
    capture_pre(r, 1, pre);
    eax = call_stdcall1(va, s2[0]);
    emit_case_json(fp, &first, va, nm, "next_skill3", "eax", 0, 0, 0, 0, 0, 0, s2, 1, eax, r, 1, pre);
  }

  /* 10. 0x6FD9E3D0 SKILLS_GetFirstSkillFromSkillList (__stdcall(pSkillList) -> eax) */
  {
    const uint32_t va = 0x6FD9E3D0u;
    const char *nm = "SKILLS_GetFirstSkillFromSkillList";
    RangeSpec r[1] = { { ADDR_SKILLLIST, 24 } };

    memset((void *)ADDR_SKILLLIST, 0, 24);
    uint32_t s1[1] = { 0u };
    capture_pre(r, 1, pre);
    uint32_t eax = call_stdcall1(va, s1[0]);
    emit_case_json(fp, &first, va, nm, "null_list", "eax", 0, 0, 0, 0, 0, 0, s1, 1, eax, r, 1, pre);

    uint32_t s2[1] = { ADDR_SKILLLIST };
    w32(ADDR_SKILLLIST + 0x04, 0u);
    capture_pre(r, 1, pre);
    eax = call_stdcall1(va, s2[0]);
    emit_case_json(fp, &first, va, nm, "first_null", "eax", 0, 0, 0, 0, 0, 0, s2, 1, eax, r, 1, pre);

    w32(ADDR_SKILLLIST + 0x04, ADDR_SKILL_1);
    capture_pre(r, 1, pre);
    eax = call_stdcall1(va, s2[0]);
    emit_case_json(fp, &first, va, nm, "first_skill1", "eax", 0, 0, 0, 0, 0, 0, s2, 1, eax, r, 1, pre);

    w32(ADDR_SKILLLIST + 0x04, ADDR_SKILL_2);
    capture_pre(r, 1, pre);
    eax = call_stdcall1(va, s2[0]);
    emit_case_json(fp, &first, va, nm, "first_skill2", "eax", 0, 0, 0, 0, 0, 0, s2, 1, eax, r, 1, pre);
  }

  /* 11. 0x6FD9E460 SKILLS_GetSkillSlotIndex (__stdcall(pUnit, pSkill) -> eax) */
  {
    const uint32_t va = 0x6FD9E460u;
    const char *nm = "SKILLS_GetSkillSlotIndex";
    RangeSpec r[2] = { { ADDR_UNIT, 244 }, { ADDR_SKILL_1, 64 } };

    memset((void *)ADDR_UNIT, 0, 244);
    memset((void *)ADDR_SKILL_1, 0, 64);
    w32(ADDR_SKILL_1 + 0x08, 7u);

    uint32_t s1[2] = { 0u, ADDR_SKILL_1 };
    capture_pre(r, 2, pre);
    uint32_t eax = call_stdcall2(va, s1[0], s1[1]);
    emit_case_json(fp, &first, va, nm, "null_unit_returns_0", "eax", 0, 0, 0, 0, 0, 0, s1, 2, eax, r, 2, pre);

    uint32_t s2[2] = { ADDR_UNIT, 0u };
    capture_pre(r, 2, pre);
    eax = call_stdcall2(va, s2[0], s2[1]);
    emit_case_json(fp, &first, va, nm, "null_skill_returns_0", "eax", 0, 0, 0, 0, 0, 0, s2, 2, eax, r, 2, pre);

    uint32_t s3[2] = { 0u, 0u };
    capture_pre(r, 2, pre);
    eax = call_stdcall2(va, s3[0], s3[1]);
    emit_case_json(fp, &first, va, nm, "both_null_returns_0", "eax", 0, 0, 0, 0, 0, 0, s3, 2, eax, r, 2, pre);

    w32(ADDR_SKILL_1 + 0x08, 12u);
    uint32_t s4[2] = { ADDR_UNIT, ADDR_SKILL_1 };
    capture_pre(r, 2, pre);
    eax = call_stdcall2(va, s4[0], s4[1]);
    emit_case_json(fp, &first, va, nm, "both_valid_returns_12", "eax", 0, 0, 0, 0, 0, 0, s4, 2, eax, r, 2, pre);
  }

  /* 12. 0x6FD9E480 SKILLS_GetHighestLevelSkillFromUnitAndId (eax=pUnit, esi=nSkillId -> eax) */
  {
    const uint32_t va = 0x6FD9E480u;
    const char *nm = "SKILLS_GetHighestLevelSkillFromUnitAndId";
    RangeSpec r[6] = {
      { ADDR_UNIT, 244 },
      { ADDR_SKILLLIST, 24 },
      { ADDR_SKILL_1, 64 },
      { ADDR_SKILL_2, 64 },
      { ADDR_SKILL_3, 64 },
      { ADDR_SKILLSTXT, 0x23C }
    };

    memset((void *)ADDR_UNIT, 0, 244);
    memset((void *)ADDR_SKILLLIST, 0, 24);
    memset((void *)ADDR_SKILL_1, 0, 64);
    memset((void *)ADDR_SKILL_2, 0, 64);
    memset((void *)ADDR_SKILL_3, 0, 64);
    memset((void *)ADDR_SKILLSTXT, 0, 0x23C);

    /* Case 1: pUnit->pSkills == 0 */
    capture_pre(r, 6, pre);
    uint32_t eax = call_eax_esi(va, ADDR_UNIT, 42u);
    emit_case_json(fp, &first, va, nm, "null_pskills", "eax", ADDR_UNIT, 0, 0, 0, 42u, 0, NULL, 0, eax, r, 6, pre);

    /* Case 2: pSkills->pFirstSkill == 0 */
    w32(ADDR_UNIT + 0xA8, ADDR_SKILLLIST);
    w32(ADDR_SKILLLIST + 0x04, 0u);
    capture_pre(r, 6, pre);
    eax = call_eax_esi(va, ADDR_UNIT, 42u);
    emit_case_json(fp, &first, va, nm, "empty_skill_list", "eax", ADDR_UNIT, 0, 0, 0, 42u, 0, NULL, 0, eax, r, 6, pre);

    /* Case 3: Single skill with matching wSkillId=42, but dwFlags (+0x3C) = 1 -> skipped */
    w16(ADDR_SKILLSTXT + 0x00, 42u);
    w32(ADDR_SKILLLIST + 0x04, ADDR_SKILL_1);
    w32(ADDR_SKILL_1 + 0x00, ADDR_SKILLSTXT);
    w32(ADDR_SKILL_1 + 0x04, 0u);
    w32(ADDR_SKILL_1 + 0x28, 5u);
    w32(ADDR_SKILL_1 + 0x34, 0xFFFFFFFFu);
    w32(ADDR_SKILL_1 + 0x3C, 1u);
    capture_pre(r, 6, pre);
    eax = call_eax_esi(va, ADDR_UNIT, 42u);
    emit_case_json(fp, &first, va, nm, "nonzero_flags3c_skipped", "eax", ADDR_UNIT, 0, 0, 0, 42u, 0, NULL, 0, eax, r, 6, pre);

    /* Case 4: Two item-granted skills (+0x34 = 101, 102) with levels 3 and 7 -> returns skill 2 */
    w32(ADDR_SKILL_1 + 0x04, ADDR_SKILL_2);
    w32(ADDR_SKILL_1 + 0x28, 3u);
    w32(ADDR_SKILL_1 + 0x34, 101u);
    w32(ADDR_SKILL_1 + 0x3C, 0u);
    w32(ADDR_SKILL_2 + 0x00, ADDR_SKILLSTXT);
    w32(ADDR_SKILL_2 + 0x04, 0u);
    w32(ADDR_SKILL_2 + 0x28, 7u);
    w32(ADDR_SKILL_2 + 0x34, 102u);
    w32(ADDR_SKILL_2 + 0x3C, 0u);
    capture_pre(r, 6, pre);
    eax = call_eax_esi(va, ADDR_UNIT, 42u);
    emit_case_json(fp, &first, va, nm, "two_item_skills_picks_higher_level", "eax", ADDR_UNIT, 0, 0, 0, 42u, 0, NULL, 0, eax, r, 6, pre);

    /* Case 5: Two item-granted skills with equal level 7 -> keeps first (ADDR_SKILL_1) */
    w32(ADDR_SKILL_1 + 0x28, 7u);
    w32(ADDR_SKILL_1 + 0x34, 101u);
    w32(ADDR_SKILL_2 + 0x28, 7u);
    w32(ADDR_SKILL_2 + 0x34, 102u);
    capture_pre(r, 6, pre);
    eax = call_eax_esi(va, ADDR_UNIT, 42u);
    emit_case_json(fp, &first, va, nm, "two_item_skills_equal_level_keeps_first", "eax", ADDR_UNIT, 0, 0, 0, 42u, 0, NULL, 0, eax, r, 6, pre);

    /* Case 6: Two item-granted skills where first has higher level (10 vs 7) and mismatching skillId query (99) */
    w32(ADDR_SKILL_1 + 0x28, 10u);
    capture_pre(r, 6, pre);
    eax = call_eax_esi(va, ADDR_UNIT, 99u);
    emit_case_json(fp, &first, va, nm, "skill_id_mismatch_returns_0", "eax", ADDR_UNIT, 0, 0, 0, 99u, 0, NULL, 0, eax, r, 6, pre);

    /* Case 7: Item-granted skill (lvl 20) followed by native skill (+0x34 == -1, lvl 1) -> native wins */
    w32(ADDR_SKILL_1 + 0x28, 20u);
    w32(ADDR_SKILL_1 + 0x34, 101u);
    w32(ADDR_SKILL_2 + 0x28, 1u);
    w32(ADDR_SKILL_2 + 0x34, 0xFFFFFFFFu);
    capture_pre(r, 6, pre);
    eax = call_eax_esi(va, ADDR_UNIT, 42u);
    emit_case_json(fp, &first, va, nm, "native_skill_replaces_item_skill", "eax", ADDR_UNIT, 0, 0, 0, 42u, 0, NULL, 0, eax, r, 6, pre);

    /* Case 8: Native skill (+0x34 == -1, lvl 1) followed by item-granted skill (lvl 20) -> native kept */
    w32(ADDR_SKILL_1 + 0x28, 1u);
    w32(ADDR_SKILL_1 + 0x34, 0xFFFFFFFFu);
    w32(ADDR_SKILL_2 + 0x28, 20u);
    w32(ADDR_SKILL_2 + 0x34, 102u);
    capture_pre(r, 6, pre);
    eax = call_eax_esi(va, ADDR_UNIT, 42u);
    emit_case_json(fp, &first, va, nm, "native_skill_blocks_item_skill", "eax", ADDR_UNIT, 0, 0, 0, 42u, 0, NULL, 0, eax, r, 6, pre);
  }

  /* 13. 0x6FD9E520 SKILLS_GetClassSkillCount (__stdcall(nCharClass) -> eax) */
  {
    const uint32_t va = 0x6FD9E520u;
    const char *nm = "SKILLS_GetClassSkillCount";
    w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);
    w32(ADDR_DATATABLES + 0xBA4, ADDR_CLASSSKILL_CNT);
    uint32_t counts[7] = { 30u, 30u, 30u, 31u, 30u, 30u, 30u };
    for (int i = 0; i < 7; i++) w32(ADDR_CLASSSKILL_CNT + i * 4, counts[i]);

    RangeSpec r[3] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES + 0xBA0, 16 },
      { ADDR_CLASSSKILL_CNT, 28 }
    };

    uint32_t classes[5] = { (uint32_t)-1, 7u, 0u, 3u, 6u };
    const char *c_ids[5] = { "class_neg1_oob", "class_7_oob", "class_0_ama", "class_3_pal", "class_6_ass" };
    for (int i = 0; i < 5; i++) {
      uint32_t s[1] = { classes[i] };
      capture_pre(r, 3, pre);
      uint32_t eax = call_stdcall1(va, s[0]);
      emit_case_json(fp, &first, va, nm, c_ids[i], "eax", 0, 0, 0, 0, 0, 0, s, 1, eax, r, 3, pre);
    }
  }

  /* 14. 0x6FD9E550 SKILLS_GetClassSkillId (__stdcall(nCharClass, nIndex) -> eax) */
  {
    const uint32_t va = 0x6FD9E550u;
    const char *nm = "SKILLS_GetClassSkillId";
    w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);
    w32(ADDR_DATATABLES + 0xBA4, ADDR_CLASSSKILL_CNT);
    w32(ADDR_DATATABLES + 0xBA8, 30u); /* stride = 30 */
    w32(ADDR_DATATABLES + 0xBAC, ADDR_CLASSSKILL_LST);
    memset((void *)ADDR_CLASSSKILL_LST, 0, 448);
    w32(ADDR_CLASSSKILL_CNT + 0 * 4, 30u);
    w32(ADDR_CLASSSKILL_CNT + 1 * 4, 5u);
    w32(ADDR_CLASSSKILL_CNT + 2 * 4, 30u);
    w16(ADDR_CLASSSKILL_LST + (0 * 30 + 0) * 2, 6u);
    w16(ADDR_CLASSSKILL_LST + (2 * 30 + 4) * 2, 70u);

    RangeSpec r[4] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES + 0xBA0, 16 },
      { ADDR_CLASSSKILL_CNT, 28 },
      { ADDR_CLASSSKILL_LST, 448 }
    };

    uint32_t args[6][2] = {
      { (uint32_t)-1, 0u },
      { 7u, 0u },
      { 1u, (uint32_t)-1 },
      { 1u, 5u },
      { 0u, 0u },
      { 2u, 4u }
    };
    const char *c_ids[6] = {
      "class_neg1_oob",
      "class_7_oob",
      "index_neg1_oob",
      "index_5_ge_count",
      "ama_idx0_skill6",
      "nec_idx4_skill70"
    };
    for (int i = 0; i < 6; i++) {
      capture_pre(r, 4, pre);
      uint32_t eax = call_stdcall2(va, args[i][0], args[i][1]);
      emit_case_json(fp, &first, va, nm, c_ids[i], "eax", 0, 0, 0, 0, 0, 0, args[i], 2, eax, r, 4, pre);
    }
  }
}

static void init_status_sentinels(uint32_t pDrlg) {
  memset((void *)(uintptr_t)pDrlg, 0, 0x480);
  for (uint32_t s = 0; s < 4u; s++) {
    uint32_t sent = pDrlg + 0xA0u + s * 0xECu;
    w32(sent + 0x1Cu, sent);
    w32(sent + 0xE8u, sent);
  }
}

static void emit_b006(FILE *fp) {
  int first = 1;
  uint8_t *pre[8];

  /* 15. 0x6FDBC230 DATATBLS_UnusedStub10469 (__stdcall(a0, a1) -> void) */
  {
    const uint32_t va = 0x6FDBC230u;
    const char *nm = "DATATBLS_UnusedStub10469";
    RangeSpec r[1] = { { ADDR_COEFFS, 8 } };
    w32(ADDR_COEFFS, 0x11223344u);
    w32(ADDR_COEFFS + 4, 0x55667788u);

    uint32_t args[4][2] = {
      { 0u, 0u },
      { 1u, 2u },
      { 0xFFFFFFFFu, 0x7FFFFFFFu },
      { 0x12345678u, 0x9ABCDEF0u }
    };
    const char *c_ids[4] = { "zero_args", "small_args", "signed_extremes", "arbitrary_hex" };
    for (int i = 0; i < 4; i++) {
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall2(va, args[i][0], args[i][1]);
      emit_case_json(fp, &first, va, nm, c_ids[i], "void", 0, 0, 0, 0, 0, 0, args[i], 2, eax, r, 1, pre);
    }
  }

  /* 16. 0x6FDBC990 DATATBLS_GetLvlTypesTxtRecord (__stdcall(nLevelType) -> eax) */
  {
    const uint32_t va = 0x6FDBC990u;
    const char *nm = "DATATBLS_GetLvlTypesTxtRecord";
    w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);
    w32(ADDR_DATATABLES + 0xC68, 36u);
    w32(VA_LVLTYPES_TXT_PTR, ADDR_LVLTYPES);
    RangeSpec r[3] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES + 0xC58, 0x18 },
      { VA_LVLTYPES_TXT_PTR, 4 }
    };

    uint32_t ids[5] = { (uint32_t)-1, 0u, 1u, 35u, 36u };
    const char *c_ids[5] = { "neg1_oob", "zero_valid", "one_valid", "last_35_valid", "count_36_oob" };
    for (int i = 0; i < 5; i++) {
      uint32_t s[1] = { ids[i] };
      capture_pre(r, 3, pre);
      uint32_t eax = call_stdcall1(va, s[0]);
      emit_case_json(fp, &first, va, nm, c_ids[i], "eax", 0, 0, 0, 0, 0, 0, s, 1, eax, r, 3, pre);
    }
  }

  /* 17. 0x6FDBCB20 DATATBLS_GetLevelDefRecord (ecx=nLevelId -> eax) */
  {
    const uint32_t va = 0x6FDBCB20u;
    const char *nm = "DATATBLS_GetLevelDefRecord";
    w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);
    w32(ADDR_DATATABLES + 0xC5C, 137u);
    w32(VA_LEVELDEF_BIN_PTR, ADDR_LEVELDEF);
    RangeSpec r[3] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES + 0xC58, 0x18 },
      { VA_LEVELDEF_BIN_PTR, 4 }
    };

    uint32_t ids[5] = { (uint32_t)-1, 0u, 1u, 136u, 137u };
    const char *c_ids[5] = { "neg1_oob", "zero_valid", "one_valid", "last_136_valid", "count_137_oob" };
    for (int i = 0; i < 5; i++) {
      capture_pre(r, 3, pre);
      uint32_t eax = call_ecx(va, ids[i]);
      emit_case_json(fp, &first, va, nm, c_ids[i], "eax", 0, 0, ids[i], 0, 0, 0, NULL, 0, eax, r, 3, pre);
    }
  }

  /* 18. 0x6FDBCCC0 DATATBLS_GetLevelsTxtRecord (__stdcall(nLevelId) -> eax) */
  {
    const uint32_t va = 0x6FDBCCC0u;
    const char *nm = "DATATBLS_GetLevelsTxtRecord";
    w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);
    w32(ADDR_DATATABLES + 0xC58, ADDR_LEVELSTXT);
    w32(ADDR_DATATABLES + 0xC5C, 137u);
    RangeSpec r[2] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES + 0xC58, 0x18 }
    };

    uint32_t ids[5] = { (uint32_t)-1, 0u, 1u, 136u, 137u };
    const char *c_ids[5] = { "neg1_oob", "zero_jle_returns_0", "one_valid", "last_136_valid", "count_137_oob" };
    for (int i = 0; i < 5; i++) {
      uint32_t s[1] = { ids[i] };
      capture_pre(r, 2, pre);
      uint32_t eax = call_stdcall1(va, s[0]);
      emit_case_json(fp, &first, va, nm, c_ids[i], "eax", 0, 0, 0, 0, 0, 0, s, 1, eax, r, 2, pre);
    }
  }

  /* 19..22. 0x6FDC1280, 0x6FDC17E0, 0x6FDC1870, 0x6FDC1A40 (0-arg constant .data getters) */
  {
    const uint32_t vas[4] = { 0x6FDC1280u, 0x6FDC17E0u, 0x6FDC1870u, 0x6FDC1A40u };
    const char *nms[4] = {
      "DATATBLS_GetGambleDataTables",
      "DATATBLS_GetRareAffixDataTables",
      "DATATBLS_GetMagicAffixDataTables",
      "DATATBLS_GetItemDataTables"
    };
    const uint32_t g_addrs[4] = { VA_GAMBLE_TABLES, VA_RARE_TABLES, VA_MAGIC_TABLES, VA_ITEM_TABLES };
    const uint32_t seeds[4] = { 0u, 1u, 0x12345678u, 0xFFFFFFFFu };
    const char *c_ids[4] = { "mem_zero", "mem_one", "mem_12345678", "mem_ffffffff" };

    for (int f = 0; f < 4; f++) {
      RangeSpec r[1] = { { g_addrs[f], 8 } };
      for (int c = 0; c < 4; c++) {
        w32(g_addrs[f], seeds[c]);
        w32(g_addrs[f] + 4, seeds[c] ^ 0xA5A5A5A5u);
        capture_pre(r, 1, pre);
        uint32_t eax = call_void0(vas[f]);
        emit_case_json(fp, &first, vas[f], nms[f], c_ids[c], "eax", 0, 0, 0, 0, 0, 0, NULL, 0, eax, r, 1, pre);
      }
    }
  }

  /* 23. 0x6FDCAC50 PATH_AStar_PropagateNewFScoreToChildren (eax=pContext, edx=pNewNode -> void) */
  {
    const uint32_t va = 0x6FDCAC50u;
    const char *nm = "PATH_AStar_PropagateNewFScoreToChildren";
    RangeSpec r[3] = {
      { ADDR_ASTAR_CTX + 0x2FC8u, 64 },
      { ADDR_ASTAR_CTX + 0x32E8u, 4 },
      { ADDR_ASTAR_NODES, 10 * 0x38 }
    };

    /* Case 1: Single node with no children */
    memset((void *)ADDR_ASTAR_CTX, 0, 0x3300);
    memset((void *)ADDR_ASTAR_NODES, 0, 10 * 0x38);
    w16(ADDR_ASTAR_NODES + 0x00, 10);
    w16(ADDR_ASTAR_NODES + 0x02, 10);
    w16(ADDR_ASTAR_NODES + 0x08, 4);
    capture_pre(r, 3, pre);
    uint32_t eax = call_eax_edx(va, ADDR_ASTAR_CTX, ADDR_ASTAR_NODES);
    emit_case_json(fp, &first, va, nm, "leaf_node_no_children", "void", ADDR_ASTAR_CTX, 0, 0, ADDR_ASTAR_NODES, 0, 0, NULL, 0, eax, r, 3, pre);

    /* Case 2: Orthogonal child (10,11) improved from g=10 to g=6 (4+2), f=11 (h=5 + 6) */
    memset((void *)ADDR_ASTAR_CTX, 0, 0x3300);
    memset((void *)ADDR_ASTAR_NODES, 0, 10 * 0x38);
    uint32_t n0 = ADDR_ASTAR_NODES + 0 * 0x38;
    uint32_t n1 = ADDR_ASTAR_NODES + 1 * 0x38;
    w16(n0 + 0x00, 10); w16(n0 + 0x02, 10); w16(n0 + 0x08, 4);
    w32(n0 + 0x10, n1);
    w16(n1 + 0x00, 10); w16(n1 + 0x02, 11); w16(n1 + 0x04, 15); w16(n1 + 0x06, 5); w16(n1 + 0x08, 10);
    capture_pre(r, 3, pre);
    eax = call_eax_edx(va, ADDR_ASTAR_CTX, n0);
    emit_case_json(fp, &first, va, nm, "ortho_child_improved", "void", ADDR_ASTAR_CTX, 0, 0, n0, 0, 0, NULL, 0, eax, r, 3, pre);

    /* Case 3: Diagonal child (11,11) improved from g=10 to g=7 (4+3), f=12 (h=5 + 7) */
    memset((void *)ADDR_ASTAR_CTX, 0, 0x3300);
    memset((void *)ADDR_ASTAR_NODES, 0, 10 * 0x38);
    w16(n0 + 0x00, 10); w16(n0 + 0x02, 10); w16(n0 + 0x08, 4);
    w32(n0 + 0x10, n1);
    w16(n1 + 0x00, 11); w16(n1 + 0x02, 11); w16(n1 + 0x04, 15); w16(n1 + 0x06, 5); w16(n1 + 0x08, 10);
    capture_pre(r, 3, pre);
    eax = call_eax_edx(va, ADDR_ASTAR_CTX, n0);
    emit_case_json(fp, &first, va, nm, "diag_child_improved", "void", ADDR_ASTAR_CTX, 0, 0, n0, 0, 0, NULL, 0, eax, r, 3, pre);

    /* Case 4: Child already has better/equal g=6 <= newG(7) -> not updated */
    memset((void *)ADDR_ASTAR_CTX, 0, 0x3300);
    memset((void *)ADDR_ASTAR_NODES, 0, 10 * 0x38);
    w16(n0 + 0x00, 10); w16(n0 + 0x02, 10); w16(n0 + 0x08, 4);
    w32(n0 + 0x10, n1);
    w16(n1 + 0x00, 11); w16(n1 + 0x02, 11); w16(n1 + 0x04, 11); w16(n1 + 0x06, 5); w16(n1 + 0x08, 6);
    capture_pre(r, 3, pre);
    eax = call_eax_edx(va, ADDR_ASTAR_CTX, n0);
    emit_case_json(fp, &first, va, nm, "child_not_improved", "void", ADDR_ASTAR_CTX, 0, 0, n0, 0, 0, NULL, 0, eax, r, 3, pre);

    /* Case 5: Multi-level cascade (n0 -> n1 -> n2) + early break on NULL slot before n3 */
    memset((void *)ADDR_ASTAR_CTX, 0, 0x3300);
    memset((void *)ADDR_ASTAR_NODES, 0, 10 * 0x38);
    uint32_t n2 = ADDR_ASTAR_NODES + 2 * 0x38;
    uint32_t n3 = ADDR_ASTAR_NODES + 3 * 0x38;
    w16(n0 + 0x00, 10); w16(n0 + 0x02, 10); w16(n0 + 0x08, 2);
    w32(n0 + 0x10, n1);
    w32(n0 + 0x14, 0u); /* NULL slot at index 1 terminates loop before index 2! */
    w32(n0 + 0x18, n3);
    w16(n1 + 0x00, 10); w16(n1 + 0x02, 11); w16(n1 + 0x06, 4); w16(n1 + 0x08, 20);
    w32(n1 + 0x10, n2);
    w16(n2 + 0x00, 11); w16(n2 + 0x02, 12); w16(n2 + 0x06, 3); w16(n2 + 0x08, 20);
    w16(n3 + 0x00, 10); w16(n3 + 0x02, 12); w16(n3 + 0x06, 2); w16(n3 + 0x08, 20);
    capture_pre(r, 3, pre);
    eax = call_eax_edx(va, ADDR_ASTAR_CTX, n0);
    emit_case_json(fp, &first, va, nm, "cascade_and_null_slot_break", "void", ADDR_ASTAR_CTX, 0, 0, n0, 0, 0, NULL, 0, eax, r, 3, pre);

    /* Case 6: Full 8-child parent (slots 0..7) + multi-slot cascade covering all unrolled branch outcomes */
    memset((void *)ADDR_ASTAR_CTX, 0, 0x3300);
    memset((void *)ADDR_ASTAR_NODES, 0, 10 * 0x38);
    uint32_t n4 = ADDR_ASTAR_NODES + 4 * 0x38;
    uint32_t n5 = ADDR_ASTAR_NODES + 5 * 0x38;
    uint32_t n6 = ADDR_ASTAR_NODES + 6 * 0x38;
    uint32_t n7 = ADDR_ASTAR_NODES + 7 * 0x38;
    uint32_t n8 = ADDR_ASTAR_NODES + 8 * 0x38;
    uint32_t n9 = ADDR_ASTAR_NODES + 9 * 0x38;
    w16(n0 + 0x00, 10); w16(n0 + 0x02, 10); w16(n0 + 0x08, 2);
    w32(n0 + 0x10 + 0 * 4, n1);
    w32(n0 + 0x10 + 1 * 4, n2);
    w32(n0 + 0x10 + 2 * 4, n3);
    w32(n0 + 0x10 + 3 * 4, n4);
    w32(n0 + 0x10 + 4 * 4, n5);
    w32(n0 + 0x10 + 5 * 4, n6);
    w32(n0 + 0x10 + 6 * 4, n7);
    w32(n0 + 0x10 + 7 * 4, n8);
    /* n1..n4 improved across unrolled slots 0..3 (mix of X-eq, Y-eq, and diag) */
    w16(n1 + 0x00, 10); w16(n1 + 0x02, 11); w16(n1 + 0x06, 5); w16(n1 + 0x08, 20);
    w16(n2 + 0x00, 11); w16(n2 + 0x02, 10); w16(n2 + 0x06, 5); w16(n2 + 0x08, 20);
    w16(n3 + 0x00, 11); w16(n3 + 0x02, 11); w16(n3 + 0x06, 5); w16(n3 + 0x08, 20);
    w16(n4 + 0x00, 10); w16(n4 + 0x02, 9);  w16(n4 + 0x06, 5); w16(n4 + 0x08, 20);
    /* n5..n8 not improved in second 4-slot unrolled iteration (ebp=4..7), exercising jge in all 4 slots */
    w16(n5 + 0x00, 9);  w16(n5 + 0x02, 10); w16(n5 + 0x06, 5); w16(n5 + 0x08, 3);
    w16(n6 + 0x00, 10); w16(n6 + 0x02, 12); w16(n6 + 0x06, 5); w16(n6 + 0x08, 3);
    w16(n7 + 0x00, 10); w16(n7 + 0x02, 8);  w16(n7 + 0x06, 5); w16(n7 + 0x08, 3);
    w16(n8 + 0x00, 9);  w16(n8 + 0x02, 9);  w16(n8 + 0x06, 5); w16(n8 + 0x08, 3);
    /* n9 improved from n4 in slot 3 after n5..n7 in slots 0..2 */
    w16(n9 + 0x00, 9);  w16(n9 + 0x02, 8);  w16(n9 + 0x06, 4); w16(n9 + 0x08, 25);
    /* Sub-children on n4 (4 children: n5, n6, n7, n9), n3 (3 children: n5, n6, n7, NULL at slot 3), n2 (2 children: n5, n9, NULL at slot 2) */
    w32(n4 + 0x10 + 0 * 4, n5);
    w32(n4 + 0x10 + 1 * 4, n6);
    w32(n4 + 0x10 + 2 * 4, n7);
    w32(n4 + 0x10 + 3 * 4, n9);
    w32(n3 + 0x10 + 0 * 4, n5);
    w32(n3 + 0x10 + 1 * 4, n6);
    w32(n3 + 0x10 + 2 * 4, n7);
    w32(n2 + 0x10 + 0 * 4, n5);
    w32(n2 + 0x10 + 1 * 4, n9);
    capture_pre(r, 3, pre);
    eax = call_eax_edx(va, ADDR_ASTAR_CTX, n0);
    emit_case_json(fp, &first, va, nm, "all_8_children_and_unrolled_slots", "void", ADDR_ASTAR_CTX, 0, 0, n0, 0, 0, NULL, 0, eax, r, 3, pre);
  }

  /* 24 & 25. 0x6FDCAED0 (VisitedCache) & 0x6FDCAF20 (PendingCache) */
  {
    const uint32_t vas[2] = { 0x6FDCAED0u, 0x6FDCAF20u };
    const char *nms[2] = {
      "PATH_AStar_FindPointInVisitedCache",
      "PATH_AStar_GetNodeFromPendingCache"
    };
    const uint32_t cache_offs[2] = { 0x200u, 0x000u };

    RangeSpec r[4] = {
      { VA_ASTAR_HASH_X, 512 },
      { VA_ASTAR_HASH_Y, 512 },
      { ADDR_ASTAR_CTX, 0x400 },
      { ADDR_ASTAR_NODES, 3 * 0x38 }
    };

    uint16_t wX = 10u, wY = 20u;
    uint32_t packed = ((uint32_t)wY << 16) | (uint32_t)wX;
    uint32_t hx = *(const uint32_t *)(uintptr_t)(VA_ASTAR_HASH_X + ((wX & 0x7Fu) * 4u));
    uint32_t hy = *(const uint32_t *)(uintptr_t)(VA_ASTAR_HASH_Y + ((wY & 0x7Fu) * 4u));
    uint32_t bucket = (hx + hy) & 0x7Fu;
    uint32_t n0 = ADDR_ASTAR_NODES + 0 * 0x38;
    uint32_t n1 = ADDR_ASTAR_NODES + 1 * 0x38;
    uint32_t n2 = ADDR_ASTAR_NODES + 2 * 0x38;

    for (int f = 0; f < 2; f++) {
      uint32_t va = vas[f];
      const char *nm = nms[f];
      uint32_t my_off = cache_offs[f];
      uint32_t other_off = cache_offs[1 - f];
      uint32_t s[2] = { ADDR_ASTAR_CTX, packed };

      /* Case 1: Empty bucket */
      memset((void *)ADDR_ASTAR_CTX, 0, 0x400);
      memset((void *)ADDR_ASTAR_NODES, 0, 3 * 0x38);
      capture_pre(r, 4, pre);
      uint32_t eax = call_stdcall2(va, s[0], s[1]);
      emit_case_json(fp, &first, va, nm, "empty_bucket", "eax", 0, 0, 0, 0, 0, 0, s, 2, eax, r, 4, pre);

      /* Case 2: Head node matches (10, 20) */
      w16(n0 + 0x00, wX); w16(n0 + 0x02, wY); w32(n0 + 0x30, 0u);
      w32(ADDR_ASTAR_CTX + my_off + bucket * 4u, n0);
      capture_pre(r, 4, pre);
      eax = call_stdcall2(va, s[0], s[1]);
      emit_case_json(fp, &first, va, nm, "head_match", "eax", 0, 0, 0, 0, 0, 0, s, 2, eax, r, 4, pre);

      /* Case 3: Head node has matching X=10, mismatching Y=21 -> returns 0 */
      w16(n0 + 0x00, wX); w16(n0 + 0x02, 21u); w32(n0 + 0x30, 0u);
      capture_pre(r, 4, pre);
      eax = call_stdcall2(va, s[0], s[1]);
      emit_case_json(fp, &first, va, nm, "head_y_mismatch", "eax", 0, 0, 0, 0, 0, 0, s, 2, eax, r, 4, pre);

      /* Case 4: Collision chain n0 -> n1 -> match on n1 */
      w16(n1 + 0x00, wX); w16(n1 + 0x02, wY); w32(n1 + 0x30, 0u);
      w32(n0 + 0x30, n1);
      capture_pre(r, 4, pre);
      eax = call_stdcall2(va, s[0], s[1]);
      emit_case_json(fp, &first, va, nm, "chain_second_match", "eax", 0, 0, 0, 0, 0, 0, s, 2, eax, r, 4, pre);

      /* Case 5: Other cache has n2, my cache has n1 -> returns n1 (isolation between +0x00 and +0x200) */
      w16(n2 + 0x00, wX); w16(n2 + 0x02, wY); w32(n2 + 0x30, 0u);
      w32(ADDR_ASTAR_CTX + other_off + bucket * 4u, n2);
      w32(ADDR_ASTAR_CTX + my_off + bucket * 4u, n1);
      capture_pre(r, 4, pre);
      eax = call_stdcall2(va, s[0], s[1]);
      emit_case_json(fp, &first, va, nm, "cache_table_isolation", "eax", 0, 0, 0, 0, 0, 0, s, 2, eax, r, 4, pre);
    }
  }

  /* 26. 0x6FDCBB70 DRLGROOM_SetStatusLink (eax=pRoomEx, ebx=nNewStatus -> eax=pRoomEx) */
  {
    const uint32_t va = 0x6FDCBB70u;
    const char *nm = "DRLGROOM_SetStatusLink";
    RangeSpec r[4] = {
      { ADDR_DRLG, 0x480 },
      { ADDR_LEVEL, 0x230 },
      { ADDR_ROOM_A, 0xEC },
      { ADDR_ROOM_B, 0xEC }
    };

    /* Case 1: nRoomStatus already equals nNewStatus (2) -> no-op, preserves EAX = pRoomEx */
    init_status_sentinels(ADDR_DRLG);
    w32(ADDR_LEVEL + 0x1B4, ADDR_DRLG);
    memset((void *)ADDR_ROOM_A, 0, 0xEC);
    memset((void *)ADDR_ROOM_B, 0, 0xEC);
    w8(ADDR_ROOM_A + 0x44, 2u);
    w32(ADDR_ROOM_A + 0x58, ADDR_LEVEL);
    capture_pre(r, 4, pre);
    uint32_t eax = call_eax_ebx(va, ADDR_ROOM_A, 2u);
    emit_case_json(fp, &first, va, nm, "same_status_noop", "eax", ADDR_ROOM_A, 2u, 0, 0, 0, 0, NULL, 0, eax, r, 4, pre);

    /* Case 2: Unlinked room transitions 4 -> 2 (inserts after sentinel 2) */
    init_status_sentinels(ADDR_DRLG);
    memset((void *)ADDR_ROOM_A, 0, 0xEC);
    w8(ADDR_ROOM_A + 0x44, 4u);
    w32(ADDR_ROOM_A + 0x58, ADDR_LEVEL);
    capture_pre(r, 4, pre);
    eax = call_eax_ebx(va, ADDR_ROOM_A, 2u);
    emit_case_json(fp, &first, va, nm, "insert_into_status_2", "eax", ADDR_ROOM_A, 2u, 0, 0, 0, 0, NULL, 0, eax, r, 4, pre);

    /* Case 3: Linked room transitions 2 -> 0 (unlinks from sentinel 2, inserts into sentinel 0) */
    capture_pre(r, 4, pre);
    eax = call_eax_ebx(va, ADDR_ROOM_A, 0u);
    emit_case_json(fp, &first, va, nm, "move_status_2_to_0", "eax", ADDR_ROOM_A, 0u, 0, 0, 0, 0, NULL, 0, eax, r, 4, pre);

    /* Case 4: Linked room transitions 0 -> 4 (bl >= 4: unlinks, zeros prev/next, leaves +0x44 untouched) */
    capture_pre(r, 4, pre);
    eax = call_eax_ebx(va, ADDR_ROOM_A, 4u);
    emit_case_json(fp, &first, va, nm, "unlink_on_status_4", "eax", ADDR_ROOM_A, 4u, 0, 0, 0, 0, NULL, 0, eax, r, 4, pre);

    /* Case 5: Half-linked room (pNext != 0, pPrev == 0) transitions 4 -> 1 (skips unlink, inserts into sentinel 1) */
    init_status_sentinels(ADDR_DRLG);
    memset((void *)ADDR_ROOM_A, 0, 0xEC);
    w8(ADDR_ROOM_A + 0x44, 4u);
    w32(ADDR_ROOM_A + 0x58, ADDR_LEVEL);
    w32(ADDR_ROOM_A + 0xE8, ADDR_ROOM_B);
    w32(ADDR_ROOM_A + 0x1C, 0u);
    capture_pre(r, 4, pre);
    eax = call_eax_ebx(va, ADDR_ROOM_A, 1u);
    emit_case_json(fp, &first, va, nm, "half_linked_pnext_only_inserts_status_1", "eax", ADDR_ROOM_A, 1u, 0, 0, 0, 0, NULL, 0, eax, r, 4, pre);
  }

  /* 28, 29, 30. 0x6FDCBC60 (status 3), 0x6FDCBCD0 (status 1), 0x6FDCBD40 (status 0) */
  {
    const uint32_t vas[3] = { 0x6FDCBC60u, 0x6FDCBCD0u, 0x6FDCBD40u };
    const char *nms[3] = {
      "DRLGROOM_SetStatusLink3",
      "DRLGROOM_SetStatusLink1",
      "DRLGROOM_SetStatusLink0"
    };
    const uint8_t target_st[3] = { 3u, 1u, 0u };
    const uint8_t alt_st[3] = { 1u, 2u, 3u };

    RangeSpec r[4] = {
      { ADDR_DRLG, 0x480 },
      { ADDR_LEVEL, 0x230 },
      { ADDR_ROOM_A, 0xEC },
      { ADDR_ROOM_B, 0xEC }
    };

    for (int f = 0; f < 3; f++) {
      uint32_t va = vas[f];
      const char *nm = nms[f];
      uint8_t st = target_st[f];
      uint8_t alt = alt_st[f];

      /* Case 1: Already at target status -> no-op */
      init_status_sentinels(ADDR_DRLG);
      w32(ADDR_LEVEL + 0x1B4, ADDR_DRLG);
      memset((void *)ADDR_ROOM_A, 0, 0xEC);
      memset((void *)ADDR_ROOM_B, 0, 0xEC);
      w8(ADDR_ROOM_A + 0x44, st);
      w32(ADDR_ROOM_A + 0x58, ADDR_LEVEL);
      capture_pre(r, 4, pre);
      uint32_t eax = call_eax(va, ADDR_ROOM_A);
      emit_case_json(fp, &first, va, nm, "already_at_target_noop", "void", ADDR_ROOM_A, 0, 0, 0, 0, 0, NULL, 0, eax, r, 4, pre);

      /* Case 2: Unlinked room (status 4) inserted into empty target sentinel */
      init_status_sentinels(ADDR_DRLG);
      memset((void *)ADDR_ROOM_A, 0, 0xEC);
      w8(ADDR_ROOM_A + 0x44, 4u);
      w32(ADDR_ROOM_A + 0x58, ADDR_LEVEL);
      capture_pre(r, 4, pre);
      eax = call_eax(va, ADDR_ROOM_A);
      emit_case_json(fp, &first, va, nm, "insert_unlinked_room", "void", ADDR_ROOM_A, 0, 0, 0, 0, 0, NULL, 0, eax, r, 4, pre);

      /* Case 3: Second room B inserted ahead of room A in target sentinel */
      memset((void *)ADDR_ROOM_B, 0, 0xEC);
      w8(ADDR_ROOM_B + 0x44, 4u);
      w32(ADDR_ROOM_B + 0x58, ADDR_LEVEL);
      capture_pre(r, 4, pre);
      eax = call_eax(va, ADDR_ROOM_B);
      emit_case_json(fp, &first, va, nm, "insert_second_room_head", "void", ADDR_ROOM_B, 0, 0, 0, 0, 0, NULL, 0, eax, r, 4, pre);

      /* Case 4: Room A linked in alt status list moves to target status list */
      init_status_sentinels(ADDR_DRLG);
      memset((void *)ADDR_ROOM_A, 0, 0xEC);
      memset((void *)ADDR_ROOM_B, 0, 0xEC);
      w8(ADDR_ROOM_A + 0x44, 4u);
      w32(ADDR_ROOM_A + 0x58, ADDR_LEVEL);
      call_eax_ebx(0x6FDCBB70u, ADDR_ROOM_A, alt);
      capture_pre(r, 4, pre);
      eax = call_eax(va, ADDR_ROOM_A);
      emit_case_json(fp, &first, va, nm, "relink_from_alt_status", "void", ADDR_ROOM_A, 0, 0, 0, 0, 0, NULL, 0, eax, r, 4, pre);
    }
  }

  /* 31. 0x6FDCC4A0 DATATBLS_CalcMissileSubLoopFrames (__stdcall(nMissileId, nLevel) -> eax) */
  {
    const uint32_t va = 0x6FDCC4A0u;
    const char *nm = "DATATBLS_CalcMissileSubLoopFrames";
    memset((void *)ADDR_MISSILESTXT, 0, 4 * 0x1A4);
    w8(ADDR_MISSILESTXT + 2 * 0x1A4 + 0x9A, 10u);
    w8(ADDR_MISSILESTXT + 2 * 0x1A4 + 0x9B, 6u);
    w8(ADDR_MISSILESTXT + 3 * 0x1A4 + 0x9A, 10u);
    w8(ADDR_MISSILESTXT + 3 * 0x1A4 + 0x9B, 5u);

    RangeSpec r[3] = {
      { VA_MISSILES_TXT_PTR, 4 },
      { VA_MISSILES_TXT_CNT, 4 },
      { ADDR_MISSILESTXT, 4 * 0x1A4 }
    };

    /* Case 1: nMissileId = -1 */
    w32(VA_MISSILES_TXT_PTR, ADDR_MISSILESTXT);
    w32(VA_MISSILES_TXT_CNT, 4u);
    uint32_t s1[2] = { (uint32_t)-1, 5u };
    capture_pre(r, 3, pre);
    uint32_t eax = call_stdcall2(va, s1[0], s1[1]);
    emit_case_json(fp, &first, va, nm, "id_neg1_oob", "eax", 0, 0, 0, 0, 0, 0, s1, 2, eax, r, 3, pre);

    /* Case 2: nMissileId = 4 (== count) */
    uint32_t s2[2] = { 4u, 5u };
    capture_pre(r, 3, pre);
    eax = call_stdcall2(va, s2[0], s2[1]);
    emit_case_json(fp, &first, va, nm, "id_ge_count_oob", "eax", 0, 0, 0, 0, 0, 0, s2, 2, eax, r, 3, pre);

    /* Case 3: sgpMissilesTxt == 0 and nMissileId == 0 -> pRec == 0 returns 0 */
    w32(VA_MISSILES_TXT_PTR, 0u);
    uint32_t s3[2] = { 0u, 5u };
    capture_pre(r, 3, pre);
    eax = call_stdcall2(va, s3[0], s3[1]);
    emit_case_json(fp, &first, va, nm, "null_table_id0", "eax", 0, 0, 0, 0, 0, 0, s3, 2, eax, r, 3, pre);

    /* Case 4: id=2, level=4 -> (6*4)/8 + 10 = 13 */
    w32(VA_MISSILES_TXT_PTR, ADDR_MISSILESTXT);
    uint32_t s4[2] = { 2u, 4u };
    capture_pre(r, 3, pre);
    eax = call_stdcall2(va, s4[0], s4[1]);
    emit_case_json(fp, &first, va, nm, "exact_div8", "eax", 0, 0, 0, 0, 0, 0, s4, 2, eax, r, 3, pre);

    /* Case 5: id=3, level=3 -> (5*3)/8 + 10 = 11 */
    uint32_t s5[2] = { 3u, 3u };
    capture_pre(r, 3, pre);
    eax = call_stdcall2(va, s5[0], s5[1]);
    emit_case_json(fp, &first, va, nm, "pos_trunc_div8", "eax", 0, 0, 0, 0, 0, 0, s5, 2, eax, r, 3, pre);

    /* Case 6: id=3, level=-3 -> sdiv32(-15, 8) + 10 = -1 + 10 = 9 */
    uint32_t s6[2] = { 3u, (uint32_t)-3 };
    capture_pre(r, 3, pre);
    eax = call_stdcall2(va, s6[0], s6[1]);
    emit_case_json(fp, &first, va, nm, "neg_level_sdiv8_toward_zero", "eax", 0, 0, 0, 0, 0, 0, s6, 2, eax, r, 3, pre);
  }
}

static void emit_b009(FILE *fp) {
  int first = 1;
  uint8_t *pre[8];

  /* 1. 0x6FD90E10 DRLGOUTROOM_LinkLevelsByOffsetCoords (ecx=pLinkData -> eax) */
  {
    const uint32_t va = 0x6FD90E10u;
    const char *nm = "DRLGOUTROOM_LinkLevelsByOffsetCoords";
    RangeSpec r[2] = { { ADDR_LINKDATA, 0x1F4 }, { ADDR_LINKARR, 64 } };

    /* Case 1: nRand1[1] == -1, seedLo=2, seedHi=0 -> newLo=0xD58D218A (bit=0), nRand0[0]=0 -> pairIdx=0 (0,-160) */
    memset((void *)ADDR_LINKDATA, 0, 0x1F4);
    memset((void *)ADDR_LINKARR, 0, 64);
    w32(ADDR_LINKDATA + 0x00, 2u);
    w32(ADDR_LINKDATA + 0x04, 0u);
    w32(ADDR_LINKDATA + 0x08 + 0 * 16 + 0, 1000u);
    w32(ADDR_LINKDATA + 0x08 + 0 * 16 + 4, 2000u);
    w32(ADDR_LINKDATA + 0xF8, ADDR_LINKARR);
    w32(ADDR_LINKDATA + 0xFC + 0 * 4, 0u);
    w32(ADDR_LINKDATA + 0x138 + 1 * 4, 0xFFFFFFFFu);
    w32(ADDR_LINKDATA + 0x1EC, 1u);
    w32(ADDR_LINKARR + 1 * 16 + 8, 0u);
    capture_pre(r, 2, pre);
    uint32_t eax = call_ecx(va, ADDR_LINKDATA);
    emit_case_json(fp, &first, va, nm, "first_roll_even_bit0_pair0", "eax", 0, 0, ADDR_LINKDATA, 0, 0, 0, NULL, 0, eax, r, 2, pre);

    /* Case 2: nRand1[1] == -1, seedLo=1, seedHi=0 -> newLo=0x6AC690C5 (bit=1), nRand0[0]=1 -> pairIdx=3 (-160,0) */
    memset((void *)ADDR_LINKDATA, 0, 0x1F4);
    w32(ADDR_LINKDATA + 0x00, 1u);
    w32(ADDR_LINKDATA + 0x04, 0u);
    w32(ADDR_LINKDATA + 0x08 + 0 * 16 + 0, 1000u);
    w32(ADDR_LINKDATA + 0x08 + 0 * 16 + 4, 2000u);
    w32(ADDR_LINKDATA + 0xF8, ADDR_LINKARR);
    w32(ADDR_LINKDATA + 0xFC + 0 * 4, 1u);
    w32(ADDR_LINKDATA + 0x138 + 1 * 4, 0xFFFFFFFFu);
    w32(ADDR_LINKDATA + 0x1EC, 1u);
    capture_pre(r, 2, pre);
    eax = call_ecx(va, ADDR_LINKDATA);
    emit_case_json(fp, &first, va, nm, "first_roll_odd_bit1_pair3", "eax", 0, 0, ADDR_LINKDATA, 0, 0, 0, NULL, 0, eax, r, 2, pre);

    /* Case 3: Retry when nRand1[1]=0, nRand0[1]=0 -> flips nRand0[1] to 1, nRand0[0]=0 -> pairIdx=1 (-96,-64) */
    memset((void *)ADDR_LINKDATA, 0, 0x1F4);
    w32(ADDR_LINKDATA + 0x08 + 0 * 16 + 0, 500u);
    w32(ADDR_LINKDATA + 0x08 + 0 * 16 + 4, 600u);
    w32(ADDR_LINKDATA + 0xF8, ADDR_LINKARR);
    w32(ADDR_LINKDATA + 0xFC + 0 * 4, 0u);
    w32(ADDR_LINKDATA + 0xFC + 1 * 4, 0u);
    w32(ADDR_LINKDATA + 0x138 + 1 * 4, 0u);
    w32(ADDR_LINKDATA + 0x1EC, 1u);
    capture_pre(r, 2, pre);
    eax = call_ecx(va, ADDR_LINKDATA);
    emit_case_json(fp, &first, va, nm, "retry_flip_0_to_1_pair1", "eax", 0, 0, ADDR_LINKDATA, 0, 0, 0, NULL, 0, eax, r, 2, pre);

    /* Case 4: Exhausted retry when nRand1[1]=0, nRand0[1]=1 -> flipped==0==nRand1[1] -> returns 0 */
    w32(ADDR_LINKDATA + 0xFC + 1 * 4, 1u);
    w32(ADDR_LINKDATA + 0x138 + 1 * 4, 0u);
    capture_pre(r, 2, pre);
    eax = call_ecx(va, ADDR_LINKDATA);
    emit_case_json(fp, &first, va, nm, "exhausted_returns_0", "eax", 0, 0, ADDR_LINKDATA, 0, 0, 0, NULL, 0, eax, r, 2, pre);

    /* Case 5: Retry when nRand1[1]=1, nRand0[1]=1 -> flips nRand0[1] to 0 (!= 1), nRand0[0]=1 -> pairIdx=2 (-64,-96) */
    memset((void *)ADDR_LINKDATA, 0, 0x1F4);
    w32(ADDR_LINKDATA + 0x08 + 0 * 16 + 0, 500u);
    w32(ADDR_LINKDATA + 0x08 + 0 * 16 + 4, 600u);
    w32(ADDR_LINKDATA + 0xF8, ADDR_LINKARR);
    w32(ADDR_LINKDATA + 0xFC + 0 * 4, 1u);
    w32(ADDR_LINKDATA + 0xFC + 1 * 4, 1u);
    w32(ADDR_LINKDATA + 0x138 + 1 * 4, 1u);
    w32(ADDR_LINKDATA + 0x1EC, 1u);
    capture_pre(r, 2, pre);
    eax = call_ecx(va, ADDR_LINKDATA);
    emit_case_json(fp, &first, va, nm, "retry_flip_1_to_0_pair2", "eax", 0, 0, ADDR_LINKDATA, 0, 0, 0, NULL, 0, eax, r, 2, pre);
  }

  /* 2. 0x6FD90F00 DRLGOUTROOM_LinkLevelsByLevelDef (ecx=pLinkData -> eax) */
  {
    const uint32_t va = 0x6FD90F00u;
    const char *nm = "DRLGOUTROOM_LinkLevelsByLevelDef";
    w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);
    w32(ADDR_DATATABLES + 0xC5C, 10u);
    w32(VA_LEVELDEF_BIN_PTR, ADDR_LEVELDEF);
    memset((void *)ADDR_LEVELDEF, 0, 4 * 0x9C);
    w32(ADDR_LEVELDEF + 1 * 0x9C + 0x24, 320u);
    w32(ADDR_LEVELDEF + 1 * 0x9C + 0x28, 640u);
    w32(ADDR_LEVELDEF + 2 * 0x9C + 0x24, 1280u);
    w32(ADDR_LEVELDEF + 2 * 0x9C + 0x28, 960u);

    RangeSpec r[5] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES + 0xC58, 0x10 },
      { VA_LEVELDEF_BIN_PTR, 4 },
      { ADDR_LEVELDEF, 4 * 0x9C },
      { ADDR_LINKDATA, 0x1F4 }
    };

    /* Case 1: seedLo=2 -> bit=0 (64x160), level=1 -> (320, 640) */
    memset((void *)ADDR_LINKDATA, 0, 0x1F4);
    w32(ADDR_LINKDATA + 0x00, 2u);
    w32(ADDR_LINKDATA + 0x04, 0u);
    w32(ADDR_LINKDATA + 0x1EC, 0u);
    w32(ADDR_LINKDATA + 0x1F0, 1u);
    capture_pre(r, 5, pre);
    uint32_t eax = call_ecx(va, ADDR_LINKDATA);
    emit_case_json(fp, &first, va, nm, "bit0_lvl1_coords", "eax", 0, 0, ADDR_LINKDATA, 0, 0, 0, NULL, 0, eax, r, 5, pre);

    /* Case 2: seedLo=1 -> bit=1 (160x64), level=2 -> (1280, 960) */
    memset((void *)ADDR_LINKDATA, 0, 0x1F4);
    w32(ADDR_LINKDATA + 0x00, 1u);
    w32(ADDR_LINKDATA + 0x04, 0u);
    w32(ADDR_LINKDATA + 0x1EC, 2u);
    w32(ADDR_LINKDATA + 0x1F0, 2u);
    capture_pre(r, 5, pre);
    eax = call_ecx(va, ADDR_LINKDATA);
    emit_case_json(fp, &first, va, nm, "bit1_lvl2_coords", "eax", 0, 0, ADDR_LINKDATA, 0, 0, 0, NULL, 0, eax, r, 5, pre);

    /* Case 3: seedLo=3, seedHi=5 -> bit=0, iteration=3, level=1 */
    memset((void *)ADDR_LINKDATA, 0, 0x1F4);
    w32(ADDR_LINKDATA + 0x00, 3u);
    w32(ADDR_LINKDATA + 0x04, 5u);
    w32(ADDR_LINKDATA + 0x1EC, 3u);
    w32(ADDR_LINKDATA + 0x1F0, 1u);
    capture_pre(r, 5, pre);
    eax = call_ecx(va, ADDR_LINKDATA);
    emit_case_json(fp, &first, va, nm, "carry_seed_it3_lvl1", "eax", 0, 0, ADDR_LINKDATA, 0, 0, 0, NULL, 0, eax, r, 5, pre);

    /* Case 4: seedLo=4, seedHi=1 -> bit=1, iteration=1, level=2 */
    memset((void *)ADDR_LINKDATA, 0, 0x1F4);
    w32(ADDR_LINKDATA + 0x00, 4u);
    w32(ADDR_LINKDATA + 0x04, 1u);
    w32(ADDR_LINKDATA + 0x1EC, 1u);
    w32(ADDR_LINKDATA + 0x1F0, 2u);
    capture_pre(r, 5, pre);
    eax = call_ecx(va, ADDR_LINKDATA);
    emit_case_json(fp, &first, va, nm, "odd_carry_it1_lvl2", "eax", 0, 0, ADDR_LINKDATA, 0, 0, 0, NULL, 0, eax, r, 5, pre);
  }

  /* 3. 0x6FD90FC0 DRLGOUTROOM_LinkLevelsByLevelCoords (ecx=pLinkData -> eax) */
  {
    const uint32_t va = 0x6FD90FC0u;
    const char *nm = "DRLGOUTROOM_LinkLevelsByLevelCoords";
    RangeSpec r[2] = { { ADDR_LINKDATA, 0x1F4 }, { ADDR_LINKARR, 64 } };

    uint32_t seeds[4][2] = { { 2u, 0u }, { 1u, 0u }, { 4u, 1u }, { 3u, 5u } };
    const char *c_ids[4] = { "bit0_64x160", "bit1_160x64", "odd_carry_160x64", "even_carry_64x160" };
    for (int i = 0; i < 4; i++) {
      memset((void *)ADDR_LINKDATA, 0, 0x1F4);
      memset((void *)ADDR_LINKARR, 0, 64);
      w32(ADDR_LINKDATA + 0x00, seeds[i][0]);
      w32(ADDR_LINKDATA + 0x04, seeds[i][1]);
      w32(ADDR_LINKDATA + 0x08 + 0 * 16 + 0, 500u);
      w32(ADDR_LINKDATA + 0x08 + 0 * 16 + 4, 600u);
      w32(ADDR_LINKDATA + 0x08 + 0 * 16 + 8, 64u);
      w32(ADDR_LINKDATA + 0x08 + 0 * 16 + 12, 160u);
      w32(ADDR_LINKDATA + 0xF8, ADDR_LINKARR);
      w32(ADDR_LINKDATA + 0x1EC, 1u);
      w32(ADDR_LINKARR + 1 * 16 + 8, 0u);
      capture_pre(r, 2, pre);
      uint32_t eax = call_ecx(va, ADDR_LINKDATA);
      emit_case_json(fp, &first, va, nm, c_ids[i], "eax", 0, 0, ADDR_LINKDATA, 0, 0, 0, NULL, 0, eax, r, 2, pre);
    }
  }

  /* 4. 0x6FD9D8A0 DUNGEON_GameTileToSubtileCoords (__stdcall(pX, pY) -> void) */
  {
    const uint32_t va = 0x6FD9D8A0u;
    const char *nm = "DUNGEON_GameTileToSubtileCoords";
    RangeSpec r[1] = { { ADDR_IO_PAIR, 8 } };
    uint32_t s[2] = { ADDR_IO_PAIR, ADDR_IO_PAIR + 4u };

    uint32_t vals[4][2] = {
      { 0u, 0u },
      { 12u, 34u },
      { (uint32_t)-7, (uint32_t)-20 },
      { 1000u, 2000u }
    };
    const char *c_ids[4] = { "zeros", "positive_coords", "negative_coords", "large_coords" };
    for (int i = 0; i < 4; i++) {
      w32(ADDR_IO_PAIR, vals[i][0]);
      w32(ADDR_IO_PAIR + 4, vals[i][1]);
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall2(va, s[0], s[1]);
      emit_case_json(fp, &first, va, nm, c_ids[i], "void", 0, 0, 0, 0, 0, 0, s, 2, eax, r, 1, pre);
    }
  }

  /* 5. 0x6FDCE8C0 DRLGOUTWILD_MarkCliffBorderVertices (eax=pLevel -> void) */
  {
    const uint32_t va = 0x6FDCE8C0u;
    const char *nm = "DRLGOUTWILD_MarkCliffBorderVertices";
    RangeSpec r[3] = {
      { ADDR_LEVEL, 0x20 },
      { ADDR_OUTDOORS, 0x68 },
      { ADDR_VTX_RING, 6 * 0x18 }
    };

    uint32_t v0 = ADDR_VTX_RING + 0 * 0x18;
    uint32_t v1 = ADDR_VTX_RING + 1 * 0x18;
    uint32_t v2 = ADDR_VTX_RING + 2 * 0x18;
    uint32_t v3 = ADDR_VTX_RING + 3 * 0x18;
    uint32_t v4 = ADDR_VTX_RING + 4 * 0x18;

    /* Case 1: Clockwise rectangle v0(0,0)->v1(10,0)->v2(10,10)->v3(0,10)->v0, with non-zero bytes at +0x09..+0x0B */
    memset((void *)ADDR_LEVEL, 0, 0x20);
    memset((void *)ADDR_OUTDOORS, 0, 0x68);
    memset((void *)ADDR_VTX_RING, 0, 6 * 0x18);
    w32(ADDR_LEVEL + 0x14, ADDR_OUTDOORS);
    w32(ADDR_OUTDOORS + 0x64, v0);
    w32(v0 + 0, 0);  w32(v0 + 4, 0);  w8(v0 + 9, 0xAAu); w8(v0 + 10, 0xBBu); w8(v0 + 11, 0xCCu); w32(v0 + 0x10, v1);
    w32(v1 + 0, 10); w32(v1 + 4, 0);  w32(v1 + 0x10, v2);
    w32(v2 + 0, 10); w32(v2 + 4, 10); w32(v2 + 0x10, v3);
    w32(v3 + 0, 0);  w32(v3 + 4, 10); w32(v3 + 0x10, v0);
    capture_pre(r, 3, pre);
    uint32_t eax = call_eax(va, ADDR_LEVEL);
    emit_case_json(fp, &first, va, nm, "rect_marks_v0_sets_flag20", "void", ADDR_LEVEL, 0, 0, 0, 0, 0, NULL, 0, eax, r, 3, pre);

    /* Case 2: Same rectangle but v0 has dwFlags=1 -> blocked, no vertex marked */
    memset((void *)ADDR_OUTDOORS, 0, 0x68);
    memset((void *)ADDR_VTX_RING, 0, 6 * 0x18);
    w32(ADDR_OUTDOORS + 0x64, v0);
    w32(v0 + 0, 0);  w32(v0 + 4, 0);  w32(v0 + 0x0C, 1u); w32(v0 + 0x10, v1);
    w32(v1 + 0, 10); w32(v1 + 4, 0);  w32(v1 + 0x10, v2);
    w32(v2 + 0, 10); w32(v2 + 4, 10); w32(v2 + 0x10, v3);
    w32(v3 + 0, 0);  w32(v3 + 4, 10); w32(v3 + 0x10, v0);
    capture_pre(r, 3, pre);
    eax = call_eax(va, ADDR_LEVEL);
    emit_case_json(fp, &first, va, nm, "v0_flag1_blocks_cliff", "void", ADDR_LEVEL, 0, 0, 0, 0, 0, NULL, 0, eax, r, 3, pre);

    /* Case 3: Head at v1 (10,0), so cliff corner v0 (0,0) is reached at end of ring and wraps past head */
    memset((void *)ADDR_OUTDOORS, 0, 0x68);
    memset((void *)ADDR_VTX_RING, 0, 6 * 0x18);
    w32(ADDR_OUTDOORS + 0x64, v1);
    w32(v0 + 0, 0);  w32(v0 + 4, 0);  w32(v0 + 0x10, v1);
    w32(v1 + 0, 10); w32(v1 + 4, 0);  w32(v1 + 0x10, v2);
    w32(v2 + 0, 10); w32(v2 + 4, 10); w32(v2 + 0x10, v3);
    w32(v3 + 0, 0);  w32(v3 + 4, 10); w32(v3 + 0x10, v0);
    capture_pre(r, 3, pre);
    eax = call_eax(va, ADDR_LEVEL);
    emit_case_json(fp, &first, va, nm, "wrap_across_head_v1", "void", ADDR_LEVEL, 0, 0, 0, 0, 0, NULL, 0, eax, r, 3, pre);

    /* Case 4: Stepped top-left corner v0(0,5)->v1(5,0)->v2(10,0)->v3(10,10)->v0 with non-zero +0x09..+0x0B */
    memset((void *)ADDR_OUTDOORS, 0, 0x68);
    memset((void *)ADDR_VTX_RING, 0, 6 * 0x18);
    w32(ADDR_OUTDOORS + 0x64, v0);
    w32(v0 + 0, 0);  w32(v0 + 4, 5);  w8(v0 + 9, 0xAAu); w8(v0 + 10, 0xBBu); w8(v0 + 11, 0xCCu); w32(v0 + 0x10, v1);
    w32(v1 + 0, 5);  w32(v1 + 4, 0);  w8(v1 + 9, 0xDDu); w8(v1 + 10, 0xEEu); w8(v1 + 11, 0xFFu); w32(v1 + 0x10, v2);
    w32(v2 + 0, 10); w32(v2 + 4, 0);  w32(v2 + 0x10, v3);
    w32(v3 + 0, 10); w32(v3 + 4, 10); w32(v3 + 0x10, v0);
    capture_pre(r, 3, pre);
    eax = call_eax(va, ADDR_LEVEL);
    emit_case_json(fp, &first, va, nm, "two_step_cliff_marks_v0_v1", "void", ADDR_LEVEL, 0, 0, 0, 0, 0, NULL, 0, eax, r, 3, pre);

    /* Case 5: Horizontal dy==0 step v0(0,0)->v1(5,0)->v2(10,0)->v3(5,0)->v4(0,10)->v0 (endCond2 requires curY > nextY) */
    memset((void *)ADDR_OUTDOORS, 0, 0x68);
    memset((void *)ADDR_VTX_RING, 0, 6 * 0x18);
    w32(ADDR_OUTDOORS + 0x64, v0);
    w32(v0 + 0, 0);  w32(v0 + 4, 0);  w32(v0 + 0x10, v1);
    w32(v1 + 0, 5);  w32(v1 + 4, 0);  w32(v1 + 0x10, v2);
    w32(v2 + 0, 10); w32(v2 + 4, 0);  w32(v2 + 0x10, v3);
    w32(v3 + 0, 5);  w32(v3 + 4, 0);  w32(v3 + 0x10, v4);
    w32(v4 + 0, 0);  w32(v4 + 4, 10); w32(v4 + 0x10, v0);
    capture_pre(r, 3, pre);
    eax = call_eax(va, ADDR_LEVEL);
    emit_case_json(fp, &first, va, nm, "horizontal_dy0_step_not_end_corner", "void", ADDR_LEVEL, 0, 0, 0, 0, 0, NULL, 0, eax, r, 3, pre);

    /* Case 6: condB entry at v1(0,5) (prev=v0(10,5), next=v2(0,0)), endCond2 match at v1, and inner flag exit on v3 */
    memset((void *)ADDR_OUTDOORS, 0, 0x68);
    memset((void *)ADDR_VTX_RING, 0, 6 * 0x18);
    w32(ADDR_OUTDOORS + 0x64, v1);
    w32(v0 + 0, 10); w32(v0 + 4, 5);  w32(v0 + 0x10, v1);
    w32(v1 + 0, 0);  w32(v1 + 4, 5);  w8(v1 + 9, 0x55u); w32(v1 + 0x10, v2);
    w32(v2 + 0, 0);  w32(v2 + 4, 0);  w32(v2 + 0x10, v3);
    w32(v3 + 0, 10); w32(v3 + 4, 0);  w32(v3 + 0x0C, 1u); w32(v3 + 0x10, v4);
    w32(v4 + 0, 10); w32(v4 + 4, 10); w32(v4 + 0x10, v0);
    capture_pre(r, 3, pre);
    eax = call_eax(va, ADDR_LEVEL);
    emit_case_json(fp, &first, va, nm, "condb_entry_and_endcond2_marks_v1", "void", ADDR_LEVEL, 0, 0, 0, 0, 0, NULL, 0, eax, r, 3, pre);

    /* Case 7: Single-vertex self-loop v0->pNext = v0 */
    memset((void *)ADDR_OUTDOORS, 0, 0x68);
    memset((void *)ADDR_VTX_RING, 0, 6 * 0x18);
    w32(ADDR_OUTDOORS + 0x64, v0);
    w32(v0 + 0, 0);  w32(v0 + 4, 0);  w32(v0 + 0x10, v0);
    capture_pre(r, 3, pre);
    eax = call_eax(va, ADDR_LEVEL);
    emit_case_json(fp, &first, va, nm, "single_vertex_self_loop", "void", ADDR_LEVEL, 0, 0, 0, 0, 0, NULL, 0, eax, r, 3, pre);

    /* Case 8: Flag-blocked prev in condA (v4.dwFlags=1) and flag-blocked cur in condB (v2.dwFlags=1) */
    memset((void *)ADDR_OUTDOORS, 0, 0x68);
    memset((void *)ADDR_VTX_RING, 0, 6 * 0x18);
    w32(ADDR_OUTDOORS + 0x64, v0);
    w32(v0 + 0, 0);  w32(v0 + 4, 0);  w32(v0 + 0x10, v1);
    w32(v1 + 0, 10); w32(v1 + 4, 5);  w32(v1 + 0x10, v2);
    w32(v2 + 0, 0);  w32(v2 + 4, 5);  w32(v2 + 0x0C, 1u); w32(v2 + 0x10, v3);
    w32(v3 + 0, 0);  w32(v3 + 4, 0);  w32(v3 + 0x10, v4);
    w32(v4 + 0, 0);  w32(v4 + 4, 10); w32(v4 + 0x0C, 1u); w32(v4 + 0x10, v0);
    capture_pre(r, 3, pre);
    eax = call_eax(va, ADDR_LEVEL);
    emit_case_json(fp, &first, va, nm, "flag_blocks_conda_prev_and_condb_cur", "void", ADDR_LEVEL, 0, 0, 0, 0, 0, NULL, 0, eax, r, 3, pre);
  }

  /* 6. 0x6FDCE9F0 DRLGOUTWILD_TestSpawnRiver (eax=pLevel, edx=nX -> eax) */
  {
    const uint32_t va = 0x6FDCE9F0u;
    const char *nm = "DRLGOUTWILD_TestSpawnRiver";
    RangeSpec r[4] = {
      { ADDR_LEVEL, 0x20 },
      { ADDR_OUTDOORS, 0x68 },
      { ADDR_GRID2_ROWS, 16 },
      { ADDR_GRID2_CELLS, 64 }
    };

    memset((void *)ADDR_LEVEL, 0, 0x20);
    memset((void *)ADDR_OUTDOORS, 0, 0x68);
    memset((void *)ADDR_GRID2_ROWS, 0, 16);
    memset((void *)ADDR_GRID2_CELLS, 0, 64);
    w32(ADDR_LEVEL + 0x14, ADDR_OUTDOORS);
    w32(ADDR_OUTDOORS + 0x2C, ADDR_GRID2_CELLS);
    w32(ADDR_OUTDOORS + 0x30, ADDR_GRID2_ROWS);
    w32(ADDR_OUTDOORS + 0x60, 3u);
    for (uint32_t y = 0; y < 3u; y++) w32(ADDR_GRID2_ROWS + y * 4u, y * 4u);

    /* Case 1: All clear -> returns 1 */
    capture_pre(r, 4, pre);
    uint32_t eax = call_eax_edx(va, ADDR_LEVEL, 1u);
    emit_case_json(fp, &first, va, nm, "all_clear_returns_1", "eax", ADDR_LEVEL, 0, 0, 1u, 0, 0, NULL, 0, eax, r, 4, pre);

    /* Case 2: Row 1 col nX (idx = 4 + 1 = 5) has bit 0x02 -> returns 0 */
    w32(ADDR_GRID2_CELLS + 5 * 4, 0x02u);
    capture_pre(r, 4, pre);
    eax = call_eax_edx(va, ADDR_LEVEL, 1u);
    emit_case_json(fp, &first, va, nm, "blocked_at_nx_returns_0", "eax", ADDR_LEVEL, 0, 0, 1u, 0, 0, NULL, 0, eax, r, 4, pre);

    /* Case 3: Row 2 col nX+1 (idx = 8 + 1 + 1 = 10) has bit 0x02 -> returns 0 */
    w32(ADDR_GRID2_CELLS + 5 * 4, 0u);
    w32(ADDR_GRID2_CELLS + 10 * 4, 0x02u);
    capture_pre(r, 4, pre);
    eax = call_eax_edx(va, ADDR_LEVEL, 1u);
    emit_case_json(fp, &first, va, nm, "blocked_at_nx_plus_1_returns_0", "eax", ADDR_LEVEL, 0, 0, 1u, 0, 0, NULL, 0, eax, r, 4, pre);

    /* Case 4: Other bits (0xFD) set -> returns 1 */
    w32(ADDR_GRID2_CELLS + 10 * 4, 0xFDu);
    capture_pre(r, 4, pre);
    eax = call_eax_edx(va, ADDR_LEVEL, 1u);
    emit_case_json(fp, &first, va, nm, "non_0x02_bits_ignored_returns_1", "eax", ADDR_LEVEL, 0, 0, 1u, 0, 0, NULL, 0, eax, r, 4, pre);
  }

  /* 7. 0x6FDCEA40 DRLGOUTWILD_GetBridgeCoords (eax=pLevel, edi=nX, [esp+4]=pOutX, [esp+8]=pOutY -> void) */
  {
    const uint32_t va = 0x6FDCEA40u;
    const char *nm = "DRLGOUTWILD_GetBridgeCoords";
    RangeSpec r[7] = {
      { ADDR_LEVEL, 0x20 },
      { ADDR_OUTDOORS, 0x68 },
      { ADDR_GRID0_ROWS, 20 },
      { ADDR_GRID0_CELLS, 80 },
      { ADDR_GRID2_ROWS, 20 },
      { ADDR_GRID2_CELLS, 80 },
      { ADDR_IO_PAIR, 8 }
    };
    uint32_t s[2] = { ADDR_IO_PAIR, ADDR_IO_PAIR + 4u };

    memset((void *)ADDR_LEVEL, 0, 0x20);
    memset((void *)ADDR_OUTDOORS, 0, 0x68);
    memset((void *)ADDR_GRID0_ROWS, 0, 20);
    memset((void *)ADDR_GRID0_CELLS, 0, 80);
    memset((void *)ADDR_GRID2_ROWS, 0, 20);
    memset((void *)ADDR_GRID2_CELLS, 0, 80);
    w32(ADDR_LEVEL + 0x14, ADDR_OUTDOORS);
    w32(ADDR_OUTDOORS + 0x04, ADDR_GRID0_CELLS);
    w32(ADDR_OUTDOORS + 0x08, ADDR_GRID0_ROWS);
    w32(ADDR_OUTDOORS + 0x2C, ADDR_GRID2_CELLS);
    w32(ADDR_OUTDOORS + 0x30, ADDR_GRID2_ROWS);
    w32(ADDR_OUTDOORS + 0x5C, 5u);
    for (uint32_t y = 0; y < 5u; y++) {
      w32(ADDR_GRID0_ROWS + y * 4u, y * 4u);
      w32(ADDR_GRID2_ROWS + y * 4u, y * 4u);
    }

    /* Case 1: Match at y=2, nX=1 (idx = 8 + 1 = 9) */
    w32(ADDR_GRID0_CELLS + 9 * 4, 0x1Cu);
    w32(ADDR_GRID2_CELLS + 9 * 4, 0x00010000u);
    w32(ADDR_IO_PAIR, 0u); w32(ADDR_IO_PAIR + 4, 0u);
    capture_pre(r, 7, pre);
    uint32_t eax = call_eax_edi_s2(va, ADDR_LEVEL, 1u, s[0], s[1]);
    emit_case_json(fp, &first, va, nm, "match_at_y2_nx1", "void", ADDR_LEVEL, 0, 0, 0, 0, 1u, s, 2, eax, r, 7, pre);

    /* Case 2: Grid0 is 0x1C at y=2, but Grid2 nibble is 2 -> writes (-1, -1) */
    w32(ADDR_GRID2_CELLS + 9 * 4, 0x00020000u);
    w32(ADDR_IO_PAIR, 0u); w32(ADDR_IO_PAIR + 4, 0u);
    capture_pre(r, 7, pre);
    eax = call_eax_edi_s2(va, ADDR_LEVEL, 1u, s[0], s[1]);
    emit_case_json(fp, &first, va, nm, "nibble_mismatch_writes_neg1", "void", ADDR_LEVEL, 0, 0, 0, 0, 1u, s, 2, eax, r, 7, pre);

    /* Case 3: Only y=0 and y=4 (boundaries) have 0x1C -> skipped by loop y=1..3 -> writes (-1, -1) */
    memset((void *)ADDR_GRID0_CELLS, 0, 80);
    memset((void *)ADDR_GRID2_CELLS, 0, 80);
    w32(ADDR_GRID0_CELLS + (0 * 4 + 1) * 4, 0x1Cu);
    w32(ADDR_GRID2_CELLS + (0 * 4 + 1) * 4, 0x00010000u);
    w32(ADDR_GRID0_CELLS + (4 * 4 + 1) * 4, 0x1Cu);
    w32(ADDR_GRID2_CELLS + (4 * 4 + 1) * 4, 0x00010000u);
    w32(ADDR_IO_PAIR, 0u); w32(ADDR_IO_PAIR + 4, 0u);
    capture_pre(r, 7, pre);
    eax = call_eax_edi_s2(va, ADDR_LEVEL, 1u, s[0], s[1]);
    emit_case_json(fp, &first, va, nm, "boundary_rows_0_and_4_skipped", "void", ADDR_LEVEL, 0, 0, 0, 0, 1u, s, 2, eax, r, 7, pre);

    /* Case 4: Match at y=3, nX=2 (idx = 12 + 2 = 14) with upper bits 0xF1 in byte2 */
    w32(ADDR_GRID0_CELLS + 14 * 4, 0x1Cu);
    w32(ADDR_GRID2_CELLS + 14 * 4, 0x00F10000u);
    w32(ADDR_IO_PAIR, 0u); w32(ADDR_IO_PAIR + 4, 0u);
    capture_pre(r, 7, pre);
    eax = call_eax_edi_s2(va, ADDR_LEVEL, 2u, s[0], s[1]);
    emit_case_json(fp, &first, va, nm, "match_at_y3_nx2_masked_nibble", "void", ADDR_LEVEL, 0, 0, 0, 0, 2u, s, 2, eax, r, 7, pre);
  }

  /* Prepare shared 4-record HirelingTxt table for 0x6FDA3050..0x6FDA32C0 */
  memset((void *)ADDR_HIRELING_TXT, 0, 5 * 0x118);
  w32(VA_HIRELING_TXT_PTR, ADDR_HIRELING_TXT);
  w32(VA_HIRELING_TXT_CNT, 4u);
  /* rec 0: wVersion=0, Id=1, Class=271, Act=1, Diff=1, Seller=150, Level=1, NameFirst=10, NameLast=15 */
  w16(ADDR_HIRELING_TXT + 0 * 0x118 + 0x00, 0u);
  w32(ADDR_HIRELING_TXT + 0 * 0x118 + 0x04, 1u);
  w32(ADDR_HIRELING_TXT + 0 * 0x118 + 0x08, 271u);
  w32(ADDR_HIRELING_TXT + 0 * 0x118 + 0x0C, 1u);
  w32(ADDR_HIRELING_TXT + 0 * 0x118 + 0x10, 1u);
  w32(ADDR_HIRELING_TXT + 0 * 0x118 + 0x14, 150u);
  w32(ADDR_HIRELING_TXT + 0 * 0x118 + 0x1C, 1u);
  w16(ADDR_HIRELING_TXT + 0 * 0x118 + 0x114, 10u);
  w16(ADDR_HIRELING_TXT + 0 * 0x118 + 0x116, 15u);
  /* rec 1: wVersion=100, Id=1, Class=271, Act=1, Diff=1, Seller=150, Level=1, NameFirst=10, NameLast=15 */
  w16(ADDR_HIRELING_TXT + 1 * 0x118 + 0x00, 100u);
  w32(ADDR_HIRELING_TXT + 1 * 0x118 + 0x04, 1u);
  w32(ADDR_HIRELING_TXT + 1 * 0x118 + 0x08, 271u);
  w32(ADDR_HIRELING_TXT + 1 * 0x118 + 0x0C, 1u);
  w32(ADDR_HIRELING_TXT + 1 * 0x118 + 0x10, 1u);
  w32(ADDR_HIRELING_TXT + 1 * 0x118 + 0x14, 150u);
  w32(ADDR_HIRELING_TXT + 1 * 0x118 + 0x1C, 1u);
  w16(ADDR_HIRELING_TXT + 1 * 0x118 + 0x114, 10u);
  w16(ADDR_HIRELING_TXT + 1 * 0x118 + 0x116, 15u);
  /* rec 2: wVersion=100, Id=1, Class=271, Act=1, Diff=1, Seller=150, Level=10, NameFirst=16, NameLast=20 */
  w16(ADDR_HIRELING_TXT + 2 * 0x118 + 0x00, 100u);
  w32(ADDR_HIRELING_TXT + 2 * 0x118 + 0x04, 1u);
  w32(ADDR_HIRELING_TXT + 2 * 0x118 + 0x08, 271u);
  w32(ADDR_HIRELING_TXT + 2 * 0x118 + 0x0C, 1u);
  w32(ADDR_HIRELING_TXT + 2 * 0x118 + 0x10, 1u);
  w32(ADDR_HIRELING_TXT + 2 * 0x118 + 0x14, 150u);
  w32(ADDR_HIRELING_TXT + 2 * 0x118 + 0x1C, 10u);
  w16(ADDR_HIRELING_TXT + 2 * 0x118 + 0x114, 16u);
  w16(ADDR_HIRELING_TXT + 2 * 0x118 + 0x116, 20u);
  /* rec 3: wVersion=100, Id=2, Class=338, Act=1, Diff=1, Seller=150, Level=1, NameFirst=10, NameLast=15 */
  w16(ADDR_HIRELING_TXT + 3 * 0x118 + 0x00, 100u);
  w32(ADDR_HIRELING_TXT + 3 * 0x118 + 0x04, 2u);
  w32(ADDR_HIRELING_TXT + 3 * 0x118 + 0x08, 338u);
  w32(ADDR_HIRELING_TXT + 3 * 0x118 + 0x0C, 1u);
  w32(ADDR_HIRELING_TXT + 3 * 0x118 + 0x10, 1u);
  w32(ADDR_HIRELING_TXT + 3 * 0x118 + 0x14, 150u);
  w32(ADDR_HIRELING_TXT + 3 * 0x118 + 0x1C, 1u);
  w16(ADDR_HIRELING_TXT + 3 * 0x118 + 0x114, 10u);
  w16(ADDR_HIRELING_TXT + 3 * 0x118 + 0x116, 15u);

  /* 8. 0x6FDA3050 DATATBLS_GetHirelingTxtRecordFromActAndDifficulty */
  {
    const uint32_t va = 0x6FDA3050u;
    const char *nm = "DATATBLS_GetHirelingTxtRecordFromActAndDifficulty";
    RangeSpec r[3] = {
      { VA_HIRELING_TXT_PTR, 4 },
      { VA_HIRELING_TXT_CNT, 4 },
      { ADDR_HIRELING_TXT, 4 * 0x118 }
    };
    uint32_t args[4][4] = {
      { 1u, 0u, 0u, 0u },
      { 1u, 0u, 0u, ADDR_HIRELING_TXT + 1 * 0x118 },
      { 0u, 0u, 0u, 0u },
      { 1u, 2u, 0u, 0u }
    };
    const char *c_ids[4] = {
      "exp_first_match_rec1",
      "exp_next_same_lvl_skips_rec2_matches_rec3",
      "classic_matches_rec0",
      "no_match_returns_0"
    };
    for (int i = 0; i < 4; i++) {
      capture_pre(r, 3, pre);
      uint32_t eax = call_stdcall4(va, args[i][0], args[i][1], args[i][2], args[i][3]);
      emit_case_json(fp, &first, va, nm, c_ids[i], "eax", 0, 0, 0, 0, 0, 0, args[i], 4, eax, r, 3, pre);
    }
  }

  /* 9. 0x6FDA30F0 DATATBLS_GetHirelingTxtRecordFromVendorAndDifficulty */
  {
    const uint32_t va = 0x6FDA30F0u;
    const char *nm = "DATATBLS_GetHirelingTxtRecordFromVendorAndDifficulty";
    RangeSpec r[3] = {
      { VA_HIRELING_TXT_PTR, 4 },
      { VA_HIRELING_TXT_CNT, 4 },
      { ADDR_HIRELING_TXT, 4 * 0x118 }
    };
    uint32_t args[4][4] = {
      { 1u, 150u, 0u, 0u },
      { 1u, 150u, 0u, ADDR_HIRELING_TXT + 1 * 0x118 },
      { 0u, 150u, 0u, 0u },
      { 1u, 999u, 0u, 0u }
    };
    const char *c_ids[4] = {
      "exp_seller150_rec1",
      "exp_seller150_after_rec1_returns_rec2",
      "classic_seller150_rec0",
      "wrong_seller_returns_0"
    };
    for (int i = 0; i < 4; i++) {
      capture_pre(r, 3, pre);
      uint32_t eax = call_stdcall4(va, args[i][0], args[i][1], args[i][2], args[i][3]);
      emit_case_json(fp, &first, va, nm, c_ids[i], "eax", 0, 0, 0, 0, 0, 0, args[i], 4, eax, r, 3, pre);
    }
  }

  /* 10. 0x6FDA3190 DATATBLS_GetHirelingTxtRecordFromClassId */
  {
    const uint32_t va = 0x6FDA3190u;
    const char *nm = "DATATBLS_GetHirelingTxtRecordFromClassId";
    RangeSpec r[3] = {
      { VA_HIRELING_TXT_PTR, 4 },
      { VA_HIRELING_TXT_CNT, 4 },
      { ADDR_HIRELING_TXT, 4 * 0x118 }
    };
    uint32_t args[5][3] = {
      { 1u, 271u, 0u },
      { 1u, 271u, ADDR_HIRELING_TXT + 1 * 0x118 },
      { 1u, 338u, 0u },
      { 0u, 271u, 0u },
      { 1u, 999u, 0u }
    };
    const char *c_ids[5] = {
      "exp_class271_rec1",
      "exp_class271_after_rec1_returns_rec2",
      "exp_class338_rec3",
      "classic_class271_rec0",
      "no_match_returns_0"
    };
    for (int i = 0; i < 5; i++) {
      capture_pre(r, 3, pre);
      uint32_t eax = call_stdcall3(va, args[i][0], args[i][1], args[i][2]);
      emit_case_json(fp, &first, va, nm, c_ids[i], "eax", 0, 0, 0, 0, 0, 0, args[i], 3, eax, r, 3, pre);
    }
  }

  /* 11. 0x6FDA3220 DATATBLS_GetHirelingTxtRecordFromNameId */
  {
    const uint32_t va = 0x6FDA3220u;
    const char *nm = "DATATBLS_GetHirelingTxtRecordFromNameId";
    RangeSpec r[3] = {
      { VA_HIRELING_TXT_PTR, 4 },
      { VA_HIRELING_TXT_CNT, 4 },
      { ADDR_HIRELING_TXT, 4 * 0x118 }
    };
    uint32_t args[5][3] = {
      { 1u, 10u, 0u },
      { 1u, 15u, ADDR_HIRELING_TXT + 1 * 0x118 },
      { 0u, 12u, 0u },
      { 1u, 9u, 0u },
      { 1u, 21u, 0u }
    };
    const char *c_ids[5] = {
      "lower_bound_10_rec1",
      "upper_bound_15_after_rec1_returns_rec3",
      "classic_name12_rec0",
      "below_first_returns_0",
      "above_last_returns_0"
    };
    for (int i = 0; i < 5; i++) {
      capture_pre(r, 3, pre);
      uint32_t eax = call_stdcall3(va, args[i][0], args[i][1], args[i][2]);
      emit_case_json(fp, &first, va, nm, c_ids[i], "eax", 0, 0, 0, 0, 0, 0, args[i], 3, eax, r, 3, pre);
    }
  }

  /* 12. 0x6FDA32C0 DATATBLS_GetHirelingTxtRecordFromIdAndLevel */
  {
    const uint32_t va = 0x6FDA32C0u;
    const char *nm = "DATATBLS_GetHirelingTxtRecordFromIdAndLevel";
    for (int i = 0; i < 512; i++) w32(VA_HIRELING_SUB_LUT + i * 4, (uint32_t)-1);
    w32(VA_HIRELING_SUB_LUT + (0 + 1) * 4, 0u);
    w32(VA_HIRELING_SUB_LUT + (256 + 1) * 4, 1u);
    w32(VA_HIRELING_SUB_LUT + (256 + 2) * 4, 3u);

    RangeSpec r[4] = {
      { VA_HIRELING_TXT_PTR, 4 },
      { VA_HIRELING_TXT_CNT, 4 },
      { VA_HIRELING_SUB_LUT, 512 * 4 },
      { ADDR_HIRELING_TXT, 4 * 0x118 }
    };
    uint32_t args[6][3] = {
      { 1u, 256u, 10u },
      { 1u, 5u, 10u },
      { 1u, 1u, 5u },
      { 1u, 1u, 10u },
      { 1u, 1u, 12u },
      { 0u, 1u, 1u }
    };
    const char *c_ids[6] = {
      "subtype_ge_256_returns_0",
      "unmapped_lut_neg1_returns_0",
      "exp_id1_lvl5_picks_rec1",
      "exp_id1_lvl10_equal_rec2",
      "exp_id1_lvl12_advances_to_rec2",
      "classic_id1_lvl1_picks_rec0"
    };
    for (int i = 0; i < 6; i++) {
      capture_pre(r, 4, pre);
      uint32_t eax = call_stdcall3(va, args[i][0], args[i][1], args[i][2]);
      emit_case_json(fp, &first, va, nm, c_ids[i], "eax", 0, 0, 0, 0, 0, 0, args[i], 3, eax, r, 4, pre);
    }
  }

  /* 13. 0x6FDA3360 DATATBLS_GetSuperUniquesTxtRecordCount */
  {
    const uint32_t va = 0x6FDA3360u;
    const char *nm = "DATATBLS_GetSuperUniquesTxtRecordCount";
    RangeSpec r[1] = { { VA_SUPERUNIQUES_CNT, 4 } };
    uint32_t cnts[4] = { 0u, 66u, 1u, 1234u };
    const char *c_ids[4] = { "count_0", "count_66", "count_1", "count_1234" };
    for (int i = 0; i < 4; i++) {
      w32(VA_SUPERUNIQUES_CNT, cnts[i]);
      capture_pre(r, 1, pre);
      uint32_t eax = call_void0(va);
      emit_case_json(fp, &first, va, nm, c_ids[i], "eax", 0, 0, 0, 0, 0, 0, NULL, 0, eax, r, 1, pre);
    }
  }

  /* 14. 0x6FDA3370 DATATBLS_GetSuperUniquesTxtRecord */
  {
    const uint32_t va = 0x6FDA3370u;
    const char *nm = "DATATBLS_GetSuperUniquesTxtRecord";
    w32(VA_SUPERUNIQUES_PTR, ADDR_SUPERUNIQUES + 0x34u);
    w32(VA_SUPERUNIQUES_CNT, 4u);
    RangeSpec r[2] = {
      { VA_SUPERUNIQUES_PTR, 4 },
      { VA_SUPERUNIQUES_CNT, 4 }
    };
    uint32_t ids[4] = { 0u, 2u, 4u, 10u };
    const char *c_ids[4] = { "id_0_valid", "id_2_valid", "id_4_eq_count_returns_0", "id_10_gt_count_returns_0" };
    for (int i = 0; i < 4; i++) {
      uint32_t s[1] = { ids[i] };
      capture_pre(r, 2, pre);
      uint32_t eax = call_stdcall1(va, s[0]);
      emit_case_json(fp, &first, va, nm, c_ids[i], "eax", 0, 0, 0, 0, 0, 0, s, 1, eax, r, 2, pre);
    }
  }

  /* 15. 0x6FDA3420 DATATBLS_GetTreasureClassExRecordFromIdAndLevel */
  {
    const uint32_t va = 0x6FDA3420u;
    const char *nm = "DATATBLS_GetTreasureClassExRecordFromIdAndLevel";
    memset((void *)ADDR_TCEX, 0, 6 * 0x2C);
    w32(VA_TCEX_PTR, ADDR_TCEX);
    w32(VA_TCEX_CNT, 5u);
    /* rec 1: wGroup=2, wLevel=10 */
    w16(ADDR_TCEX + 1 * 0x2C + 0x00, 2u); w16(ADDR_TCEX + 1 * 0x2C + 0x02, 10u);
    /* rec 2: wGroup=2, wLevel=20 */
    w16(ADDR_TCEX + 2 * 0x2C + 0x00, 2u); w16(ADDR_TCEX + 2 * 0x2C + 0x02, 20u);
    /* rec 3: wGroup=2, wLevel=30 */
    w16(ADDR_TCEX + 3 * 0x2C + 0x00, 2u); w16(ADDR_TCEX + 3 * 0x2C + 0x02, 30u);
    /* rec 4: wGroup=0, wLevel=1 (ungrouped) */
    w16(ADDR_TCEX + 4 * 0x2C + 0x00, 0u); w16(ADDR_TCEX + 4 * 0x2C + 0x02, 1u);

    RangeSpec r[3] = {
      { VA_TCEX_PTR, 4 },
      { VA_TCEX_CNT, 4 },
      { ADDR_TCEX, 6 * 0x2C }
    };
    uint32_t args[6][2] = {
      { 0u, 10u },
      { 5u, 10u },
      { 1u, 20u },
      { 1u, 25u },
      { 1u, 0u },
      { 4u, 50u }
    };
    const char *c_ids[6] = {
      "tcid_0_returns_0",
      "tcid_ge_count_returns_0",
      "group2_lvl20_equal_rec2",
      "group2_lvl25_advances_to_rec2",
      "group2_lvl0_returns_base_rec1",
      "ungrouped_rec4_returns_rec4"
    };
    for (int i = 0; i < 6; i++) {
      capture_pre(r, 3, pre);
      uint32_t eax = call_stdcall2(va, args[i][0], args[i][1]);
      emit_case_json(fp, &first, va, nm, c_ids[i], "eax", 0, 0, 0, 0, 0, 0, args[i], 2, eax, r, 3, pre);
    }
  }

  /* 16. 0x6FDA3850 DATATBLS_GetMonsterChainInfo */
  {
    const uint32_t va = 0x6FDA3850u;
    const char *nm = "DATATBLS_GetMonsterChainInfo";
    memset((void *)ADDR_MONSTATS_TXT, 0, 3 * 0x1A8);
    w32(VA_MONSTATS_TXT_PTR, ADDR_MONSTATS_TXT);
    w32(VA_MONSTATS_TXT_CNT, 3u);
    w8(ADDR_MONSTATS_TXT + 1 * 0x1A8 + 0x4A, 5u);
    w8(ADDR_MONSTATS_TXT + 1 * 0x1A8 + 0x4B, 2u);
    w8(ADDR_MONSTATS_TXT + 2 * 0x1A8 + 0x4A, 4u);
    w8(ADDR_MONSTATS_TXT + 2 * 0x1A8 + 0x4B, 3u);

    RangeSpec r[4] = {
      { VA_MONSTATS_TXT_PTR, 4 },
      { VA_MONSTATS_TXT_CNT, 4 },
      { ADDR_MONSTATS_TXT, 3 * 0x1A8 },
      { ADDR_IO_PAIR, 8 }
    };

    /* Case 1: valid id=1, both out pointers non-null */
    w32(ADDR_IO_PAIR, 99u); w32(ADDR_IO_PAIR + 4, 99u);
    uint32_t s1[3] = { 1u, ADDR_IO_PAIR, ADDR_IO_PAIR + 4u };
    capture_pre(r, 4, pre);
    uint32_t eax = call_stdcall3(va, s1[0], s1[1], s1[2]);
    emit_case_json(fp, &first, va, nm, "valid_id1_writes_5_and_2", "eax", 0, 0, 0, 0, 0, 0, s1, 3, eax, r, 4, pre);

    /* Case 2: valid id=2, null out pointers */
    uint32_t s2[3] = { 2u, 0u, 0u };
    capture_pre(r, 4, pre);
    eax = call_stdcall3(va, s2[0], s2[1], s2[2]);
    emit_case_json(fp, &first, va, nm, "valid_id2_null_out_ptrs", "eax", 0, 0, 0, 0, 0, 0, s2, 3, eax, r, 4, pre);

    /* Case 3: negative id=-1 zeroes out pointers */
    w32(ADDR_IO_PAIR, 99u); w32(ADDR_IO_PAIR + 4, 88u);
    uint32_t s3[3] = { (uint32_t)-1, ADDR_IO_PAIR, ADDR_IO_PAIR + 4u };
    capture_pre(r, 4, pre);
    eax = call_stdcall3(va, s3[0], s3[1], s3[2]);
    emit_case_json(fp, &first, va, nm, "neg_id_zeroes_out_ptrs", "eax", 0, 0, 0, 0, 0, 0, s3, 3, eax, r, 4, pre);

    /* Case 4: oob id=3 zeroes out pointers */
    w32(ADDR_IO_PAIR, 77u); w32(ADDR_IO_PAIR + 4, 66u);
    uint32_t s4[3] = { 3u, ADDR_IO_PAIR, ADDR_IO_PAIR + 4u };
    capture_pre(r, 4, pre);
    eax = call_stdcall3(va, s4[0], s4[1], s4[2]);
    emit_case_json(fp, &first, va, nm, "oob_id_zeroes_out_ptrs", "eax", 0, 0, 0, 0, 0, 0, s4[0] ? s4 : s4, 3, eax, r, 4, pre);
  }
}

static void emit_b012(FILE *fp) {
  int first = 1;
  uint8_t *pre[8];

  /* Prepare shared sgptDataTables->pSkillsTxt (3 records) */
  memset((void *)ADDR_DATATABLES, 0, 0xD00);
  memset((void *)ADDR_SKILLSTXT, 0, 3 * 0x23C);
  w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);
  w32(ADDR_DATATABLES + 0xB98, ADDR_SKILLSTXT);
  w32(ADDR_DATATABLES + 0xBA0, 3u);
  /* skill 0: wSkillId=0, nCharClass=-1 (0xFF), wPassiveState=-1, wReqLevel=1, nManaShift=8, wMana=10, wLvlMana=2 */
  w16(ADDR_SKILLSTXT + 0 * 0x23C + 0x00, 0u);
  w8(ADDR_SKILLSTXT + 0 * 0x23C + 0x0C, 0xFFu);
  w16(ADDR_SKILLSTXT + 0 * 0x23C + 0x94, 0xFFFFu);
  w16(ADDR_SKILLSTXT + 0 * 0x23C + 0x174, 1u);
  w8(ADDR_SKILLSTXT + 0 * 0x23C + 0x188, 8u);
  w16(ADDR_SKILLSTXT + 0 * 0x23C + 0x18A, 10u);
  w16(ADDR_SKILLSTXT + 0 * 0x23C + 0x18C, 2u);
  /* skill 1: wSkillId=36, nCharClass=1 (Sor), wPassiveState=23, wReqLevel=18, nManaShift=7, wMana=20, wLvlMana=-1 */
  w16(ADDR_SKILLSTXT + 1 * 0x23C + 0x00, 36u);
  w8(ADDR_SKILLSTXT + 1 * 0x23C + 0x0C, 1u);
  w16(ADDR_SKILLSTXT + 1 * 0x23C + 0x94, 23u);
  w16(ADDR_SKILLSTXT + 1 * 0x23C + 0x174, 18u);
  w8(ADDR_SKILLSTXT + 1 * 0x23C + 0x188, 7u);
  w16(ADDR_SKILLSTXT + 1 * 0x23C + 0x18A, 20u);
  w16(ADDR_SKILLSTXT + 1 * 0x23C + 0x18C, 0xFFFFu);
  /* skill 2: wSkillId=54, nCharClass=5 (Dru), wPassiveState=0, wReqLevel=30, nManaShift=8, wMana=15, wLvlMana=0 */
  w16(ADDR_SKILLSTXT + 2 * 0x23C + 0x00, 54u);
  w8(ADDR_SKILLSTXT + 2 * 0x23C + 0x0C, 5u);
  w16(ADDR_SKILLSTXT + 2 * 0x23C + 0x94, 0u);
  w16(ADDR_SKILLSTXT + 2 * 0x23C + 0x174, 30u);
  w8(ADDR_SKILLSTXT + 2 * 0x23C + 0x188, 8u);
  w16(ADDR_SKILLSTXT + 2 * 0x23C + 0x18A, 15u);
  w16(ADDR_SKILLSTXT + 2 * 0x23C + 0x18C, 0u);

  /* 17. 0x6FD9E8C0 SKILLS_GetClassIdFromSkillId */
  {
    const uint32_t va = 0x6FD9E8C0u;
    const char *nm = "SKILLS_GetClassIdFromSkillId";
    RangeSpec r[3] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES + 0xB98, 12 },
      { ADDR_SKILLSTXT, 3 * 0x23C }
    };
    uint32_t ids[4] = { 1u, 0u, (uint32_t)-1, 5u };
    const char *c_ids[4] = { "valid_sor_class1", "unassigned_neg1_returns_7", "neg_id_returns_7", "oob_id_returns_7" };
    for (int i = 0; i < 4; i++) {
      uint32_t s[1] = { ids[i] };
      capture_pre(r, 3, pre);
      uint32_t eax = call_stdcall1(va, s[0]);
      emit_case_json(fp, &first, va, nm, c_ids[i], "eax", 0, 0, 0, 0, 0, 0, s, 1, eax, r, 3, pre);
    }
  }

  /* 18. 0x6FD9EA00 SKILLS_EvaluateManaCost256ths */
  {
    const uint32_t va = 0x6FD9EA00u;
    const char *nm = "SKILLS_EvaluateManaCost256ths";
    RangeSpec r[3] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES + 0xB98, 12 },
      { ADDR_SKILLSTXT, 3 * 0x23C }
    };
    uint32_t args[4][2] = {
      { 0u, 1u },
      { 0u, 10u },
      { 1u, 6u },
      { (uint32_t)-1, 5u }
    };
    const char *c_ids[4] = { "lvl1_base_mana", "lvl10_scaled_mana", "negative_lvlmana_reduction", "invalid_skill_returns_0" };
    for (int i = 0; i < 4; i++) {
      capture_pre(r, 3, pre);
      uint32_t eax = call_stdcall2(va, args[i][0], args[i][1]);
      emit_case_json(fp, &first, va, nm, c_ids[i], "eax", 0, 0, 0, 0, 0, 0, args[i], 2, eax, r, 3, pre);
    }
  }

  /* 19. 0x6FD9EB00 SKILLS_GetReqLevel */
  {
    const uint32_t va = 0x6FD9EB00u;
    const char *nm = "SKILLS_GetReqLevel";
    RangeSpec r[3] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES + 0xB98, 12 },
      { ADDR_SKILLSTXT, 3 * 0x23C }
    };
    uint32_t ids[4] = { 1u, 2u, (uint32_t)-1, 10u };
    const char *c_ids[4] = { "valid_req18", "valid_req30", "neg_id_returns_maxint", "oob_id_returns_maxint" };
    for (int i = 0; i < 4; i++) {
      uint32_t s[1] = { ids[i] };
      capture_pre(r, 3, pre);
      uint32_t eax = call_stdcall1(va, s[0]);
      emit_case_json(fp, &first, va, nm, c_ids[i], "eax", 0, 0, 0, 0, 0, 0, s, 1, eax, r, 3, pre);
    }
  }

  /* 20. 0x6FD9F080 SKILLS_GetSkillById (ecx=pUnit, edx=nSkillId, [esp+4]=nOwnerItemGuid -> eax) */
  {
    const uint32_t va = 0x6FD9F080u;
    const char *nm = "SKILLS_GetSkillById";
    RangeSpec r[5] = {
      { ADDR_UNIT, 244 },
      { ADDR_SKILLLIST, 24 },
      { ADDR_SKILL_1, 64 },
      { ADDR_SKILL_2, 64 },
      { ADDR_SKILLSTXT, 3 * 0x23C }
    };
    memset((void *)ADDR_UNIT, 0, 244);
    memset((void *)ADDR_SKILLLIST, 0, 24);
    memset((void *)ADDR_SKILL_1, 0, 64);
    memset((void *)ADDR_SKILL_2, 0, 64);

    /* Case 1: pUnit->pSkills == 0 */
    uint32_t s1[1] = { 0xFFFFFFFFu };
    capture_pre(r, 5, pre);
    uint32_t eax = call_fastcall3(va, ADDR_UNIT, 36u, s1[0]);
    emit_case_json(fp, &first, va, nm, "null_skill_list", "eax", 0, 0, ADDR_UNIT, 36u, 0, 0, s1, 1, eax, r, 5, pre);

    /* Setup chain: SKILL_1 (wSkillId=36, guid=0x1111, lvl=5) -> SKILL_2 (wSkillId=36, guid=-1, lvl=8) */
    w32(ADDR_UNIT + 0xA8, ADDR_SKILLLIST);
    w32(ADDR_SKILLLIST + 0x04, ADDR_SKILL_1);
    w32(ADDR_SKILL_1 + 0x00, ADDR_SKILLSTXT + 1 * 0x23C);
    w32(ADDR_SKILL_1 + 0x04, ADDR_SKILL_2);
    w32(ADDR_SKILL_1 + 0x28, 5u);
    w32(ADDR_SKILL_1 + 0x34, 0x1111u);
    w32(ADDR_SKILL_2 + 0x00, ADDR_SKILLSTXT + 1 * 0x23C);
    w32(ADDR_SKILL_2 + 0x04, 0u);
    w32(ADDR_SKILL_2 + 0x28, 8u);
    w32(ADDR_SKILL_2 + 0x34, 0xFFFFFFFFu);

    /* Case 2: match guid=-1 (SKILL_2) */
    capture_pre(r, 5, pre);
    eax = call_fastcall3(va, ADDR_UNIT, 36u, s1[0]);
    emit_case_json(fp, &first, va, nm, "match_base_skill_guid_neg1", "eax", 0, 0, ADDR_UNIT, 36u, 0, 0, s1, 1, eax, r, 5, pre);

    /* Case 3: match guid=0x1111 (SKILL_1) */
    uint32_t s3[1] = { 0x1111u };
    capture_pre(r, 5, pre);
    eax = call_fastcall3(va, ADDR_UNIT, 36u, s3[0]);
    emit_case_json(fp, &first, va, nm, "match_item_skill_guid_1111", "eax", 0, 0, ADDR_UNIT, 36u, 0, 0, s3, 1, eax, r, 5, pre);

    /* Case 4: skillId=99 not found -> 0 */
    capture_pre(r, 5, pre);
    eax = call_fastcall3(va, ADDR_UNIT, 99u, s1[0]);
    emit_case_json(fp, &first, va, nm, "not_found_returns_0", "eax", 0, 0, ADDR_UNIT, 99u, 0, 0, s1, 1, eax, r, 5, pre);
  }

  /* 21. 0x6FD9F0C0 SKILLS_CalcMaxCallback & 22. 0x6FD9F0D0 SKILLS_CalcMinCallback */
  {
    const uint32_t vas[2] = { 0x6FD9F0C0u, 0x6FD9F0D0u };
    const char *nms[2] = { "SKILLS_CalcMaxCallback", "SKILLS_CalcMinCallback" };
    RangeSpec r[1] = { { ADDR_COEFFS, 4 } };
    w32(ADDR_COEFFS, 0u);
    uint32_t pairs[4][2] = {
      { 10u, 5u },
      { (uint32_t)-10, (uint32_t)-5 },
      { (uint32_t)-3, 4u },
      { 7u, 7u }
    };
    const char *c_ids[4] = { "pos_10_vs_5", "neg_10_vs_neg_5", "neg_3_vs_pos_4", "equal_7_vs_7" };
    uint32_t s[2] = { 0u, 0u };
    for (int f = 0; f < 2; f++) {
      for (int i = 0; i < 4; i++) {
        capture_pre(r, 1, pre);
        uint32_t eax = call_fastcall4(vas[f], pairs[i][0], pairs[i][1], s[0], s[1]);
        emit_case_json(fp, &first, vas[f], nms[f], c_ids[i], "eax", 0, 0, pairs[i][0], pairs[i][1], 0, 0, s, 2, eax, r, 1, pre);
      }
    }
  }

  /* 23. 0x6FD9F0E0 SKILLS_GetPassiveState */
  {
    const uint32_t va = 0x6FD9F0E0u;
    const char *nm = "SKILLS_GetPassiveState";
    RangeSpec r[3] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES + 0xB98, 12 },
      { ADDR_SKILLSTXT, 3 * 0x23C }
    };
    uint32_t ids[4] = { 1u, 0u, 2u, (uint32_t)-1 };
    const char *c_ids[4] = { "pos_passive_23", "neg1_passive_returns_0", "zero_passive_returns_0", "oob_returns_0" };
    for (int i = 0; i < 4; i++) {
      uint32_t s[1] = { ids[i] };
      capture_pre(r, 3, pre);
      uint32_t eax = call_stdcall1(va, s[0]);
      emit_case_json(fp, &first, va, nm, c_ids[i], "eax", 0, 0, 0, 0, 0, 0, s, 1, eax, r, 3, pre);
    }
  }

  /* 24. 0x6FD9F4C0 SKILLS_GetBaseSkillLevelById (eax=pUnit, edx=nSkillId -> eax) */
  {
    const uint32_t va = 0x6FD9F4C0u;
    const char *nm = "SKILLS_GetBaseSkillLevelById";
    RangeSpec r[5] = {
      { ADDR_UNIT, 244 },
      { ADDR_SKILLLIST, 24 },
      { ADDR_SKILL_1, 64 },
      { ADDR_SKILL_2, 64 },
      { ADDR_SKILLSTXT, 3 * 0x23C }
    };

    /* Case 1: pUnit == 0 */
    capture_pre(r, 5, pre);
    uint32_t eax = call_eax_edx(va, 0u, 36u);
    emit_case_json(fp, &first, va, nm, "null_unit_returns_0", "eax", 0u, 0, 0, 36u, 0, 0, NULL, 0, eax, r, 5, pre);

    /* Case 2: finds SKILL_2 (guid=-1, lvl=8) skipping SKILL_1 (guid=0x1111, lvl=5) */
    capture_pre(r, 5, pre);
    eax = call_eax_edx(va, ADDR_UNIT, 36u);
    emit_case_json(fp, &first, va, nm, "finds_base_skill_lvl8", "eax", ADDR_UNIT, 0, 0, 36u, 0, 0, NULL, 0, eax, r, 5, pre);

    /* Case 3: skillId=54 not in unit skill list -> 0 */
    capture_pre(r, 5, pre);
    eax = call_eax_edx(va, ADDR_UNIT, 54u);
    emit_case_json(fp, &first, va, nm, "skill_not_found_returns_0", "eax", ADDR_UNIT, 0, 0, 54u, 0, 0, NULL, 0, eax, r, 5, pre);

    /* Case 4: pUnit->pSkills == 0 -> 0 */
    w32(ADDR_UNIT + 0xA8, 0u);
    capture_pre(r, 5, pre);
    eax = call_eax_edx(va, ADDR_UNIT, 36u);
    emit_case_json(fp, &first, va, nm, "null_skill_list_returns_0", "eax", ADDR_UNIT, 0, 0, 36u, 0, 0, NULL, 0, eax, r, 5, pre);
  }

  /* 25. 0x6FD9F510 SKILLS_GetRequiredLevelForNextRank (__stdcall(pUnit, nSkillId) -> eax) */
  {
    const uint32_t va = 0x6FD9F510u;
    const char *nm = "SKILLS_GetRequiredLevelForNextRank";
    /* Restore unit skill list and set skill 1 wSkillId = 1 so nSkillId=1 matches both table index 1 and wSkillId=1! */
    w16(ADDR_SKILLSTXT + 1 * 0x23C + 0x00, 1u);
    w32(ADDR_UNIT + 0xA8, ADDR_SKILLLIST);

    RangeSpec r[7] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES + 0xB98, 12 },
      { ADDR_SKILLSTXT, 3 * 0x23C },
      { ADDR_UNIT, 244 },
      { ADDR_SKILLLIST, 24 },
      { ADDR_SKILL_1, 64 },
      { ADDR_SKILL_2, 64 }
    };

    /* Case 1: invalid skillId = -1 -> 0x7FFFFFFF */
    uint32_t s1[2] = { ADDR_UNIT, (uint32_t)-1 };
    capture_pre(r, 7, pre);
    uint32_t eax = call_stdcall2(va, s1[0], s1[1]);
    emit_case_json(fp, &first, va, nm, "invalid_skill_returns_maxint", "eax", 0, 0, 0, 0, 0, 0, s1, 2, eax, r, 7, pre);

    /* Case 2: skillId = 2 (wReqLevel=30, not owned by unit) -> 30 */
    uint32_t s2[2] = { ADDR_UNIT, 2u };
    capture_pre(r, 7, pre);
    eax = call_stdcall2(va, s2[0], s2[1]);
    emit_case_json(fp, &first, va, nm, "unowned_skill_returns_base_req30", "eax", 0, 0, 0, 0, 0, 0, s2, 2, eax, r, 7, pre);

    /* Case 3: skillId = 1 (wReqLevel=18, owned base skill lvl=8) -> 26 */
    uint32_t s3[2] = { ADDR_UNIT, 1u };
    capture_pre(r, 7, pre);
    eax = call_stdcall2(va, s3[0], s3[1]);
    emit_case_json(fp, &first, va, nm, "owned_base_skill_adds_lvl8_to_18", "eax", 0, 0, 0, 0, 0, 0, s3, 2, eax, r, 7, pre);

    /* Case 4: pUnit->pSkills == 0, skillId = 1 -> 18 */
    w32(ADDR_UNIT + 0xA8, 0u);
    capture_pre(r, 7, pre);
    eax = call_stdcall2(va, s3[0], s3[1]);
    emit_case_json(fp, &first, va, nm, "null_skill_list_returns_base_req18", "eax", 0, 0, 0, 0, 0, 0, s3, 2, eax, r, 7, pre);
  }

  /* 26. 0x6FD9F780 SKILLS_MapPlayerAnimModeToMonsterMode (__stdcall(nPlrMode, nMonClassId) -> eax) */
  {
    const uint32_t va = 0x6FD9F780u;
    const char *nm = "SKILLS_MapPlayerAnimModeToMonsterMode";
    memset((void *)ADDR_MONSTATS_TXT, 0, 4 * 0x1A8);
    memset((void *)ADDR_MONSTATS2_TXT, 0, 2 * 0x134);
    w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);
    w32(ADDR_DATATABLES + 0xA78, ADDR_MONSTATS_TXT);
    w32(ADDR_DATATABLES + 0xA80, 4u);
    w32(ADDR_DATATABLES + 0xA90, ADDR_MONSTATS2_TXT);
    w32(ADDR_DATATABLES + 0xA98, 2u);
    /* mon 0 -> monstats2 0: has mode 10 (+0xF1 bit 2 = 0x04), mode 8 (+0xF1 bit 0 = 0x01), mode 4 (+0xF0 bit 4 = 0x10), mode 3 (+0xF0 bit 3 = 0x08) */
    w16(ADDR_MONSTATS_TXT + 0 * 0x1A8 + 0x18, 0u);
    w8(ADDR_MONSTATS2_TXT + 0 * 0x134 + 0xF0, 0x18u);
    w8(ADDR_MONSTATS2_TXT + 0 * 0x134 + 0xF1, 0x05u);
    /* mon 1 -> monstats2 1: has 0 mode bits set (falls back all the way to 1) */
    w16(ADDR_MONSTATS_TXT + 1 * 0x1A8 + 0x18, 1u);
    /* mon 2 -> wMonStatsEx = -1 (0xFFFF) < 0 */
    w16(ADDR_MONSTATS_TXT + 2 * 0x1A8 + 0x18, 0xFFFFu);
    /* mon 3 -> wMonStatsEx = 5 >= nMonStats2TxtRecordCount (2) */
    w16(ADDR_MONSTATS_TXT + 3 * 0x1A8 + 0x18, 5u);

    RangeSpec r[7] = {
      { VA_SGPT_DATATABLES, 4 },
      { VA_GDWBITMASKS_IAT, 4 },
      { ADDR_BITMASKS, 128 },
      { 0x6FDE3088u, 136 },
      { ADDR_DATATABLES + 0xA78, 0x28 },
      { ADDR_MONSTATS_TXT, 4 * 0x1A8 },
      { ADDR_MONSTATS2_TXT, 2 * 0x134 }
    };
    uint32_t args[14][2] = {
      { 15u, 0u },
      { 16u, 0u },
      { 3u, 1u },
      { 9u, 0u },
      { 10u, 0u },
      { 8u, 0u },
      { 0u, 0u },
      { 31u, 0u },
      { 22u, 0u },
      { 23u, 0u },
      { 15u, (uint32_t)-1 },
      { 15u, 5u },
      { 15u, 2u },
      { 15u, 3u }
    };
    const char *c_ids[14] = {
      "direct_hit_mode10",
      "fallback_11_to_8",
      "fallback_15_to_2_to_1",
      "fallback_6_to_3",
      "fallback_7_to_4",
      "fallback_5_to_4",
      "plrmode_0_maps_to_0_falls_back_to_1",
      "plrmode_31_maps_to_16_gt_15_falls_back_to_1",
      "plrmode_22_past_20_maps_to_2_falls_back_to_1",
      "plrmode_23_past_20_maps_to_3",
      "invalid_mon_falls_back_to_1",
      "oob_mon_ge_count_falls_back_to_1",
      "neg_monstatsex_falls_back_to_1",
      "oob_monstatsex_ge_count_falls_back_to_1"
    };
    for (int i = 0; i < 14; i++) {
      capture_pre(r, 7, pre);
      uint32_t eax = call_stdcall2(va, args[i][0], args[i][1]);
      emit_case_json(fp, &first, va, nm, c_ids[i], "eax", 0, 0, 0, 0, 0, 0, args[i], 2, eax, r, 7, pre);
    }

    /* Case 15: pMonStats2Txt == 0 with wMonStatsEx == 0 -> pMonStats2 == 0 falls back to 1 */
    w32(ADDR_DATATABLES + 0xA90, 0u);
    uint32_t s15[2] = { 15u, 0u };
    capture_pre(r, 7, pre);
    uint32_t eax15 = call_stdcall2(va, s15[0], s15[1]);
    emit_case_json(fp, &first, va, nm, "null_monstats2_base_wmonstatsex0_falls_back_to_1", "eax", 0, 0, 0, 0, 0, 0, s15, 2, eax15, r, 7, pre);
    w32(ADDR_DATATABLES + 0xA90, ADDR_MONSTATS2_TXT);
  }

  /* 27. 0x6FDA2E00 DATATBLS_GetMonSeqTableRecord */
  {
    const uint32_t va = 0x6FDA2E00u;
    const char *nm = "DATATBLS_GetMonSeqTableRecord";
    w32(VA_MONSEQ_PTR, ADDR_MONSEQ_TBL);
    w32(VA_MONSEQ_CNT, 8u);
    RangeSpec r[2] = { { VA_MONSEQ_PTR, 4 }, { VA_MONSEQ_CNT, 4 } };
    uint32_t ids[4] = { 0u, 5u, (uint32_t)-1, 8u };
    const char *c_ids[4] = { "seq_0_valid", "seq_5_valid", "seq_neg1_oob", "seq_8_oob" };
    for (int i = 0; i < 4; i++) {
      uint32_t s[1] = { ids[i] };
      capture_pre(r, 2, pre);
      uint32_t eax = call_stdcall1(va, s[0]);
      emit_case_json(fp, &first, va, nm, c_ids[i], "eax", 0, 0, 0, 0, 0, 0, s[0] ? s : s, 1, eax, r, 2, pre);
    }
  }

  /* 28. 0x6FDB9DC0 MISSILE_EvaluateElementalLength */
  {
    const uint32_t va = 0x6FDB9DC0u;
    const char *nm = "MISSILE_EvaluateElementalLength";
    memset((void *)ADDR_MISSILESTXT, 0, 2 * 0x1A4);
    w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);
    w32(ADDR_DATATABLES + 0xB64, ADDR_MISSILESTXT);
    w32(ADDR_DATATABLES + 0xB6C, 2u);
    w32(ADDR_MISSILESTXT + 1 * 0x1A4 + 0x11C, 25u);
    w32(ADDR_MISSILESTXT + 1 * 0x1A4 + 0x120, 10u);
    w32(ADDR_MISSILESTXT + 1 * 0x1A4 + 0x124, 20u);
    w32(ADDR_MISSILESTXT + 1 * 0x1A4 + 0x128, 30u);

    RangeSpec r[3] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES + 0xB64, 12 },
      { ADDR_MISSILESTXT, 2 * 0x1A4 }
    };
    uint32_t args[6][4] = {
      { 0u, 0u, (uint32_t)-1, 5u },
      { 0u, 0u, 2u, 5u },
      { 0u, 0u, 1u, 0u },
      { 0u, 0u, 1u, 5u },
      { 0u, 0u, 1u, 12u },
      { 0u, 0u, 1u, 20u }
    };
    const char *c_ids[6] = {
      "invalid_missile_returns_0",
      "oob_missile_ge_count_returns_0",
      "lvl0_returns_base_25",
      "band1_lvl5_returns_65",
      "band2_lvl12_returns_175",
      "band3_lvl20_returns_375"
    };
    for (int i = 0; i < 6; i++) {
      capture_pre(r, 3, pre);
      uint32_t eax = call_stdcall4(va, args[i][0], args[i][1], args[i][2], args[i][3]);
      emit_case_json(fp, &first, va, nm, c_ids[i], "eax", 0, 0, 0, 0, 0, 0, args[i], 4, eax, r, 3, pre);
    }

    /* Case 7: pMissilesTxt == 0 with nMissileId == 0 -> pRec == 0 returns 0 */
    w32(ADDR_DATATABLES + 0xB64, 0u);
    uint32_t s7[4] = { 0u, 0u, 0u, 5u };
    capture_pre(r, 3, pre);
    uint32_t eax7 = call_stdcall4(va, s7[0], s7[1], s7[2], s7[3]);
    emit_case_json(fp, &first, va, nm, "null_missilestxt_id0_returns_0", "eax", 0, 0, 0, 0, 0, 0, s7, 4, eax7, r, 3, pre);
    w32(ADDR_DATATABLES + 0xB64, ADDR_MISSILESTXT);
  }

  /* 29. 0x6FDCF5E0 UNITS_GetUnitDistanceToCoordinates */
  {
    const uint32_t va = 0x6FDCF5E0u;
    const char *nm = "UNITS_GetUnitDistanceToCoordinates";
    RangeSpec r[3] = {
      { ADDR_UNIT, 244 },
      { ADDR_DYN_PATH, 32 },
      { ADDR_STATIC_PATH, 20 }
    };

    memset((void *)ADDR_UNIT, 0, 244);
    memset((void *)ADDR_DYN_PATH, 0, 32);
    memset((void *)ADDR_STATIC_PATH, 0, 20);
    w16(ADDR_DYN_PATH + 0x02, 100u);
    w16(ADDR_DYN_PATH + 0x06, 200u);
    w32(ADDR_STATIC_PATH + 0x0C, 500u);
    w32(ADDR_STATIC_PATH + 0x10, 500u);

    /* Case 1: dynamic path player (dwUnitType=0) at (100,200), target (106,208) -> 11 */
    w32(ADDR_UNIT + 0x00, 0u);
    w32(ADDR_UNIT + 0x2C, ADDR_DYN_PATH);
    uint32_t s1[3] = { ADDR_UNIT, 106u, 208u };
    capture_pre(r, 3, pre);
    uint32_t eax = call_stdcall3(va, s1[0], s1[1], s1[2]);
    emit_case_json(fp, &first, va, nm, "dyn_path_player_dist11", "eax", 0, 0, 0, 0, 0, 0, s1, 3, eax, r, 3, pre);

    /* Case 2: static path object (dwUnitType=2) at (500,500), target (490,503) -> 11 */
    w32(ADDR_UNIT + 0x00, 2u);
    w32(ADDR_UNIT + 0x2C, ADDR_STATIC_PATH);
    uint32_t s2[3] = { ADDR_UNIT, 490u, 503u };
    capture_pre(r, 3, pre);
    eax = call_stdcall3(va, s2[0], s2[1], s2[2]);
    emit_case_json(fp, &first, va, nm, "static_path_object_dist11", "eax", 0, 0, 0, 0, 0, 0, s2, 3, eax, r, 3, pre);

    /* Case 3: dynamic path monster (dwUnitType=1) with null pPath -> unit at (0,0), target (10,20) -> 25 */
    w32(ADDR_UNIT + 0x00, 1u);
    w32(ADDR_UNIT + 0x2C, 0u);
    uint32_t s3[3] = { ADDR_UNIT, 10u, 20u };
    capture_pre(r, 3, pre);
    eax = call_stdcall3(va, s3[0], s3[1], s3[2]);
    emit_case_json(fp, &first, va, nm, "dyn_path_null_dist25", "eax", 0, 0, 0, 0, 0, 0, s3, 3, eax, r, 3, pre);

    /* Case 4: static path tile (dwUnitType=5) at (500,500), target (500,500) -> 0 */
    w32(ADDR_UNIT + 0x00, 5u);
    w32(ADDR_UNIT + 0x2C, ADDR_STATIC_PATH);
    uint32_t s4[3] = { ADDR_UNIT, 500u, 500u };
    capture_pre(r, 3, pre);
    eax = call_stdcall3(va, s4[0], s4[1], s4[2]);
    emit_case_json(fp, &first, va, nm, "static_path_tile_same_pos_dist0", "eax", 0, 0, 0, 0, 0, 0, s4, 3, eax, r, 3, pre);

    /* Case 5: static path item (dwUnitType=4) at (500,500), target (510,500) -> 10 (kills M20) */
    w32(ADDR_UNIT + 0x00, 4u);
    w32(ADDR_UNIT + 0x2C, ADDR_STATIC_PATH);
    uint32_t s5[3] = { ADDR_UNIT, 510u, 500u };
    capture_pre(r, 3, pre);
    eax = call_stdcall3(va, s5[0], s5[1], s5[2]);
    emit_case_json(fp, &first, va, nm, "static_path_item_type4_dist10", "eax", 0, 0, 0, 0, 0, 0, s5, 3, eax, r, 3, pre);

    /* Case 6: dynamic path missile (dwUnitType=3) at (100,200), target (106,192) -> dy < 0 -> 11 */
    w32(ADDR_UNIT + 0x00, 3u);
    w32(ADDR_UNIT + 0x2C, ADDR_DYN_PATH);
    uint32_t s6[3] = { ADDR_UNIT, 106u, 192u };
    capture_pre(r, 3, pre);
    eax = call_stdcall3(va, s6[0], s6[1], s6[2]);
    emit_case_json(fp, &first, va, nm, "dyn_path_missile_type3_neg_dy_dist11", "eax", 0, 0, 0, 0, 0, 0, s6, 3, eax, r, 3, pre);

    /* Case 7: dynamic path dwUnitType=6 (> 5) at (100,200), target (94,192) -> dx < 0, dy < 0 -> 11 */
    w32(ADDR_UNIT + 0x00, 6u);
    w32(ADDR_UNIT + 0x2C, ADDR_DYN_PATH);
    uint32_t s7[3] = { ADDR_UNIT, 94u, 192u };
    capture_pre(r, 3, pre);
    eax = call_stdcall3(va, s7[0], s7[1], s7[2]);
    emit_case_json(fp, &first, va, nm, "dyn_path_type6_gt5_dist11", "eax", 0, 0, 0, 0, 0, 0, s7, 3, eax, r, 3, pre);

    /* Case 8: dynamic path null pPath at (0,0), target (INT_MIN, INT_MIN) -> neg overflow clamped to 0 (kills M25) */
    w32(ADDR_UNIT + 0x00, 1u);
    w32(ADDR_UNIT + 0x2C, 0u);
    uint32_t s8[3] = { ADDR_UNIT, 0x80000000u, 0x80000000u };
    capture_pre(r, 3, pre);
    eax = call_stdcall3(va, s8[0], s8[1], s8[2]);
    emit_case_json(fp, &first, va, nm, "int_min_target_clamps_to_0", "eax", 0, 0, 0, 0, 0, 0, s8, 3, eax, r, 3, pre);
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
  VirtualProtect((void *)(uintptr_t)VA_GDWBITMASKS_IAT, 4, PAGE_READWRITE, &old_prot);
  w32(VA_GDWBITMASKS_IAT, ADDR_BITMASKS);

  char path[512];

  snprintf(path, sizeof(path), "%s/b003-vectors.json", out_dir);
  FILE *fp3 = fopen(path, "wb");
  if (!fp3) { perror("fopen b003"); return 5; }
  fprintf(fp3, "{\n  \"batch\": \"B003\",\n  \"module\": \"D2Common\",\n  \"cases\": [\n");
  emit_b003(fp3);
  fprintf(fp3, "\n  ]\n}\n");
  fclose(fp3);

  snprintf(path, sizeof(path), "%s/b006-vectors.json", out_dir);
  FILE *fp6 = fopen(path, "wb");
  if (!fp6) { perror("fopen b006"); return 6; }
  fprintf(fp6, "{\n  \"batch\": \"B006\",\n  \"module\": \"D2Common\",\n  \"cases\": [\n");
  emit_b006(fp6);
  fprintf(fp6, "\n  ]\n}\n");
  fclose(fp6);

  snprintf(path, sizeof(path), "%s/b009-vectors.json", out_dir);
  FILE *fp9 = fopen(path, "wb");
  if (!fp9) { perror("fopen b009"); return 7; }
  fprintf(fp9, "{\n  \"batch\": \"B009\",\n  \"module\": \"D2Common\",\n  \"cases\": [\n");
  emit_b009(fp9);
  fprintf(fp9, "\n  ]\n}\n");
  fclose(fp9);

  snprintf(path, sizeof(path), "%s/b012-vectors.json", out_dir);
  FILE *fp12 = fopen(path, "wb");
  if (!fp12) { perror("fopen b012"); return 8; }
  fprintf(fp12, "{\n  \"batch\": \"B012\",\n  \"module\": \"D2Common\",\n  \"cases\": [\n");
  emit_b012(fp12);
  fprintf(fp12, "\n  ]\n}\n");
  fclose(fp12);

  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
