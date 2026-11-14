/*
 * Standalone MinGW real-DLL differential vector emitter for Lane A Iteration-4
 * batches B020 (16 functions, 0x6FD515E0..0x6FD51930) and B023 (24 functions,
 * 0x6FD6A2D0, 0x6FDB9C60..0x6FDBA750).
 *
 * Loads the real Diablo II v1.13c Storm.dll, Fog.dll, and D2Common.dll at its
 * canonical image base 0x6FD50000, stages deterministic pre-call memory blocks
 * in a fixed VirtualAlloc arena at 0x20000000, invokes each real D2Common.dll
 * function entry point via exact x86 register/stack thunks, and emits:
 *   - <out_dir>/b020-vectors.ndjson
 *   - <out_dir>/b023-vectors.ndjson
 */
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#define ARENA_BASE        0x20000000u
#define ARENA_SIZE        0x00100000u

/* Deterministic layout within ARENA_BASE (0x20000000) */
#define ADDR_BITMASKS     0x20000100u /* 128 bytes: 32 u32s from Fog gdwBitMasks */
#define ADDR_UNIT_MISSILE 0x20000300u /* 244 bytes: D2UnitStrc (missile/monster) */
#define ADDR_UNIT_OWNER   0x20000400u /* 244 bytes: D2UnitStrc (owner) */
#define ADDR_MISSILE_DATA 0x20000500u /* 52 bytes: D2MissileDataStrc */
#define ADDR_DMG_DATA     0x20000600u /* 124 bytes: D2MissileDamageDataStrc */

#define ADDR_DATATABLES   0x20001000u /* 0xD00 bytes: synthetic D2DataTablesStrc */
#define ADDR_MONSTATS     0x20002000u /* 6 * 0x1A8 (424) = 2544 bytes */
#define ADDR_MISSILES     0x20003000u /* 4 * 0x1A4 (420) = 1680 bytes */
#define ADDR_SKILLS       0x20004000u /* 4 * 0x23C (572) = 2288 bytes */
#define ADDR_STATES       0x20005000u /* 4 * 0x3C  (60)  = 240 bytes */
#define ADDR_ISC          0x20005200u /* 4 * 0x144 (324) = 1296 bytes */
#define ADDR_SETS         0x20005800u /* 4 * 0x128 (296) = 1184 bytes */
#define ADDR_SETITEMS     0x20006000u /* 4 * 0x1B8 (440) = 1760 bytes */
#define ADDR_UNIQUEITEMS  0x20006800u /* 4 * 0x14C (332) = 1328 bytes */

/* D2Common.dll canonical VAs (ImageBase = 0x6FD50000) */
#define VA_SGPT_DATATABLES 0x6FDE9E1Cu
#define VA_GDWBITMASKS_IAT 0x6FDD90B0u

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

/* Assembly thunks for D2Common custom and stdcall conventions */
static __attribute__((noinline)) uint32_t call_eax(uintptr_t fn, uint32_t eax_in) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "=a"(out)
    : "a"(eax_in), [fn]"r"(fn)
    : "ecx", "edx", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) uint32_t call_eax_edx(uintptr_t fn, uint32_t eax_in, uint32_t edx_in) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "=a"(out), "+d"(edx_in)
    : "a"(eax_in), [fn]"r"(fn)
    : "ecx", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) uint32_t call_ecx_ebx(uintptr_t fn, uint32_t ecx_in, uint32_t ebx_in) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "=a"(out), "+c"(ecx_in), "+b"(ebx_in)
    : [fn]"D"(fn)
    : "edx", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) uint32_t call_ecx_esi(uintptr_t fn, uint32_t ecx_in, uint32_t esi_in) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "=a"(out), "+c"(ecx_in), "+S"(esi_in)
    : [fn]"r"(fn)
    : "edx", "memory", "cc"
  );
  return out;
}

static uint32_t call_stdcall1(uintptr_t fn, uint32_t a0) {
  typedef uint32_t (__stdcall *Fn1)(uint32_t);
  return ((Fn1)fn)(a0);
}

static uint32_t call_stdcall2(uintptr_t fn, uint32_t a0, uint32_t a1) {
  typedef uint32_t (__stdcall *Fn2)(uint32_t, uint32_t);
  return ((Fn2)fn)(a0, a1);
}

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
    if (i > 0) fprintf(fp, ",");
    fprintf(fp, "%u", args[i]);
  }
  fprintf(fp, "],\"retMask\":%u,\"eax\":%u,\"pre\":[", ret_mask, out_eax & ret_mask);
  for (int i = 0; i < n_pre; i++) {
    if (i > 0) fprintf(fp, ",");
    fprintf(fp, "{\"addr\":%u,\"hex\":\"", pre_ranges[i].addr);
    write_hex(fp, pre_bufs[i], pre_ranges[i].len);
    fprintf(fp, "\"}");
    free(pre_bufs[i]);
  }
  fprintf(fp, "],\"post\":[");
  for (int i = 0; i < n_post; i++) {
    if (i > 0) fprintf(fp, ",");
    fprintf(fp, "{\"addr\":%u,\"hex\":\"", post_ranges[i].addr);
    write_hex(fp, (const uint8_t *)(uintptr_t)post_ranges[i].addr, post_ranges[i].len);
    fprintf(fp, "\"}");
  }
  fprintf(fp, "]}\n");
}

static void setup_it4_datatables(void) {
  memset((void *)(uintptr_t)ADDR_DATATABLES, 0, 0xD00);
  memset((void *)(uintptr_t)ADDR_MONSTATS, 0, 6 * 0x1A8);
  memset((void *)(uintptr_t)ADDR_MISSILES, 0, 4 * 0x1A4);
  memset((void *)(uintptr_t)ADDR_SKILLS, 0, 4 * 0x23C);
  memset((void *)(uintptr_t)ADDR_STATES, 0, 4 * 0x3C);
  memset((void *)(uintptr_t)ADDR_ISC, 0, 4 * 0x144);
  memset((void *)(uintptr_t)ADDR_SETS, 0, 4 * 0x128);
  memset((void *)(uintptr_t)ADDR_SETITEMS, 0, 4 * 0x1B8);
  memset((void *)(uintptr_t)ADDR_UNIQUEITEMS, 0, 4 * 0x14C);

  w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);

  /* Ground-truth D2DataTablesStrc offsets verified against D2Common.dll */
  w32(ADDR_DATATABLES + 0x0BC, ADDR_STATES);       /* pStatesTxt */
  w32(ADDR_DATATABLES + 0x0C4, 4u);                /* nStatesTxtRecordCount */
  w32(ADDR_DATATABLES + 0xA78, ADDR_MONSTATS);     /* pMonStatsTxt */
  w32(ADDR_DATATABLES + 0xA80, 6u);                /* nMonStatsTxtRecordCount */
  w32(ADDR_DATATABLES + 0xB64, ADDR_MISSILES);     /* pMissilesTxt */
  w32(ADDR_DATATABLES + 0xB6C, 4u);                /* nMissilesTxtRecordCount */
  w32(ADDR_DATATABLES + 0xB94, 10u);               /* nSkillDescTxtRecordCount */
  w32(ADDR_DATATABLES + 0xB98, ADDR_SKILLS);       /* pSkillsTxt */
  w32(ADDR_DATATABLES + 0xBA0, 4u);                /* nSkillsTxtRecordCount */
  w32(ADDR_DATATABLES + 0xBCC, ADDR_ISC);          /* pItemStatCostTxt */
  w32(ADDR_DATATABLES + 0xBD4, 4u);                /* nItemStatCostTxtRecordCount */
  w32(ADDR_DATATABLES + 0xC0C, ADDR_SETS);         /* pSetsTxt */
  w32(ADDR_DATATABLES + 0xC10, 4u);                /* nSetsTxtRecordCount */
  w32(ADDR_DATATABLES + 0xC18, ADDR_SETITEMS);     /* pSetItemsTxt */
  w32(ADDR_DATATABLES + 0xC1C, 4u);                /* nSetItemsTxtRecordCount */
  w32(ADDR_DATATABLES + 0xC24, ADDR_UNIQUEITEMS);  /* pUniqueItemsTxt */
  w32(ADDR_DATATABLES + 0xC28, 4u);                /* nUniqueItemsTxtRecordCount */

  /* Populate Skills[0..3] with distinct dwParam1..8 (+0x148..+0x164) and wSkillDesc (+0x194) */
  /* Skill 0: wSkillDesc = -1 (0xFFFF) */
  w32(ADDR_SKILLS + 0 * 0x23C + 0x148, 10u);  /* Param1 */
  w32(ADDR_SKILLS + 0 * 0x23C + 0x14C, 3u);   /* Param2 */
  w32(ADDR_SKILLS + 0 * 0x23C + 0x150, 20u);  /* Param3 */
  w32(ADDR_SKILLS + 0 * 0x23C + 0x154, 404u); /* Param4 */
  w32(ADDR_SKILLS + 0 * 0x23C + 0x158, 505u); /* Param5 */
  w32(ADDR_SKILLS + 0 * 0x23C + 0x15C, 606u); /* Param6 */
  w32(ADDR_SKILLS + 0 * 0x23C + 0x160, 707u); /* Param7 */
  w32(ADDR_SKILLS + 0 * 0x23C + 0x164, 8u);   /* Param8 */
  w16(ADDR_SKILLS + 0 * 0x23C + 0x194, 0xFFFFu);

  /* Skill 1: positive linear params, wSkillDesc = 10 (== count 10, out of range) */
  w32(ADDR_SKILLS + 1 * 0x23C + 0x148, 100u); /* Param1 */
  w32(ADDR_SKILLS + 1 * 0x23C + 0x14C, 15u);  /* Param2 */
  w32(ADDR_SKILLS + 1 * 0x23C + 0x150, 250u); /* Param3 */
  w32(ADDR_SKILLS + 1 * 0x23C + 0x154, 25u);  /* Param4 */
  w32(ADDR_SKILLS + 1 * 0x23C + 0x158, 400u); /* Param5 */
  w32(ADDR_SKILLS + 1 * 0x23C + 0x15C, 35u);  /* Param6 */
  w32(ADDR_SKILLS + 1 * 0x23C + 0x160, 600u); /* Param7 */
  w32(ADDR_SKILLS + 1 * 0x23C + 0x164, 45u);  /* Param8 */
  w16(ADDR_SKILLS + 1 * 0x23C + 0x194, 10u);

  /* Skill 2: negative step / signed params, wSkillDesc = 0 (valid) */
  w32(ADDR_SKILLS + 2 * 0x23C + 0x148, 50u);          /* Param1 */
  w32(ADDR_SKILLS + 2 * 0x23C + 0x14C, (uint32_t)-7); /* Param2 */
  w32(ADDR_SKILLS + 2 * 0x23C + 0x150, 80u);          /* Param3 */
  w32(ADDR_SKILLS + 2 * 0x23C + 0x154, (uint32_t)-12);/* Param4 */
  w32(ADDR_SKILLS + 2 * 0x23C + 0x158, (uint32_t)-30);/* Param5 */
  w32(ADDR_SKILLS + 2 * 0x23C + 0x15C, 9u);           /* Param6 */
  w32(ADDR_SKILLS + 2 * 0x23C + 0x160, 0x80000005u);  /* Param7 */
  w32(ADDR_SKILLS + 2 * 0x23C + 0x164, (uint32_t)-4); /* Param8 */
  w16(ADDR_SKILLS + 2 * 0x23C + 0x194, 0u);

  /* Skill 3: wSkillDesc = 7 (valid) */
  w32(ADDR_SKILLS + 3 * 0x23C + 0x154, 0x7FFFFFFFu);
  w32(ADDR_SKILLS + 3 * 0x23C + 0x158, 0u);
  w32(ADDR_SKILLS + 3 * 0x23C + 0x15C, 9999u);
  w16(ADDR_SKILLS + 3 * 0x23C + 0x194, 7u);

  /* Populate MonStats[0..5]: wBaseId (+0x02), wNextInClass (+0x04), dwMonStatsFlags (+0x0C) */
  /* Chain 0 -> 1 -> 2 -> 3 -> -1 (0xFFFF) */
  w16(ADDR_MONSTATS + 0 * 0x1A8 + 0x02, 100u);
  w16(ADDR_MONSTATS + 0 * 0x1A8 + 0x04, 1u);
  w32(ADDR_MONSTATS + 0 * 0x1A8 + 0x0C, 0x00000000u);

  w16(ADDR_MONSTATS + 1 * 0x1A8 + 0x02, 0x0123u);
  w16(ADDR_MONSTATS + 1 * 0x1A8 + 0x04, 2u);
  w32(ADDR_MONSTATS + 1 * 0x1A8 + 0x0C, 0x80042005u); /* byte0=0x05 (bits 0,2), byte1=0x20 (bit 13), byte2=0x04 (bit 18), byte3=0x80 (bit 31) */

  w16(ADDR_MONSTATS + 2 * 0x1A8 + 0x02, 0xFFFEu); /* -2 */
  w16(ADDR_MONSTATS + 2 * 0x1A8 + 0x04, 3u);
  w32(ADDR_MONSTATS + 2 * 0x1A8 + 0x0C, 0x01020408u);

  w16(ADDR_MONSTATS + 3 * 0x1A8 + 0x02, 100u);
  w16(ADDR_MONSTATS + 3 * 0x1A8 + 0x04, 0xFFFFu); /* -1 end of chain */

  /* MonStats[4]: wBaseId = 400, wNextInClass = 50 (>= count 6) */
  w16(ADDR_MONSTATS + 4 * 0x1A8 + 0x02, 400u);
  w16(ADDR_MONSTATS + 4 * 0x1A8 + 0x04, 50u);

  /* MonStats[5]: wBaseId = -10 (0xFFF6), wNextInClass = 2 */
  w16(ADDR_MONSTATS + 5 * 0x1A8 + 0x02, 0xFFF6u);
  w16(ADDR_MONSTATS + 5 * 0x1A8 + 0x04, 2u);

  /* Populate Missiles[0..3]: dwMissileFlags (+0x04), nActivate (+0x94), nHitShift (+0xE4) */
  /* Missile 0: bit 0 of dwMissileFlags CLEAR (0xFE) */
  w8(ADDR_MISSILES + 0 * 0x1A4 + 0x04, 0xFEu);
  w8(ADDR_MISSILES + 0 * 0x1A4 + 0x94, 0u);
  w8(ADDR_MISSILES + 0 * 0x1A4 + 0xE4, 0u);

  /* Missile 1: bit 0 of dwMissileFlags SET (0x01), nActivate = 15, nHitShift = 8 */
  w8(ADDR_MISSILES + 1 * 0x1A4 + 0x04, 0x01u);
  w8(ADDR_MISSILES + 1 * 0x1A4 + 0x94, 15u);
  w8(ADDR_MISSILES + 1 * 0x1A4 + 0xE4, 8u);

  /* Missile 2: bit 0 of dwMissileFlags SET (0x85), nActivate = 250, nHitShift = 0xAB */
  w8(ADDR_MISSILES + 2 * 0x1A4 + 0x04, 0x85u);
  w8(ADDR_MISSILES + 2 * 0x1A4 + 0x94, 250u);
  w8(ADDR_MISSILES + 2 * 0x1A4 + 0xE4, 0xABu);
}

static void emit_b020(FILE *fp) {
  uint8_t *pre[8];

  /* 1..3: 0x6FD515E0 (Param4), 0x6FD51610 (Param5), 0x6FD51640 (Param6) */
  {
    const struct { uint32_t va; const char *nm; } fns[3] = {
      { 0x6FD515E0u, "DATATBLS_GetSkillsTxtParam4Inline113c" },
      { 0x6FD51610u, "DATATBLS_GetSkillsTxtParam5Inline113c" },
      { 0x6FD51640u, "DATATBLS_GetSkillsTxtParam6Inline113c" },
    };
    const struct { uint32_t id; int null_tbl; const char *cid; } cases[6] = {
      { (uint32_t)-1, 0, "neg_id" },
      { 4u,           0, "ge_count" },
      { 0u,           1, "null_skills_table" },
      { 0u,           0, "valid_skill_0" },
      { 2u,           0, "valid_skill_2" },
      { 3u,           0, "valid_skill_3" },
    };
    RangeSpec r[3] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES, 0xD00 },
      { ADDR_SKILLS, 4 * 0x23C },
    };
    for (int f = 0; f < 3; f++) {
      for (int i = 0; i < 6; i++) {
        setup_it4_datatables();
        if (cases[i].null_tbl) w32(ADDR_DATATABLES + 0xB98, 0u);
        uint32_t args[1] = { cases[i].id };
        capture_pre(r, 3, pre);
        uint32_t eax = call_eax(fns[f].va, cases[i].id);
        emit_ndjson_line(fp, fns[f].va, fns[f].nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, r, 3, pre, NULL, 0);
      }
    }
  }

  /* 4..7: 0x6FD51670 (Param12), 0x6FD516B0 (Param34), 0x6FD516F0 (Param56), 0x6FD51730 (Param78) */
  {
    const struct { uint32_t va; const char *nm; } fns[4] = {
      { 0x6FD51670u, "DATATBLS_CalcSkillLinearParam12Inline113c" },
      { 0x6FD516B0u, "DATATBLS_CalcSkillLinearParam34Inline113c" },
      { 0x6FD516F0u, "DATATBLS_CalcSkillLinearParam56Inline113c" },
      { 0x6FD51730u, "DATATBLS_CalcSkillLinearParam78Inline113c" },
    };
    const struct { uint32_t id; uint32_t lvl; int null_tbl; const char *cid; } cases[8] = {
      { (uint32_t)-1, 5u,           0, "neg_skill_id" },
      { 4u,           5u,           0, "ge_count_skill_id" },
      { 0u,           5u,           1, "null_skills_table" },
      { 1u,           0u,           0, "level_zero" },
      { 1u,           (uint32_t)-3, 0, "level_neg" },
      { 1u,           1u,           0, "level_one_base_only" },
      { 1u,           5u,           0, "level_five_pos_step" },
      { 2u,           8u,           0, "level_eight_neg_step" },
    };
    RangeSpec r[3] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES, 0xD00 },
      { ADDR_SKILLS, 4 * 0x23C },
    };
    for (int f = 0; f < 4; f++) {
      for (int i = 0; i < 8; i++) {
        setup_it4_datatables();
        if (cases[i].null_tbl) w32(ADDR_DATATABLES + 0xB98, 0u);
        uint32_t args[2] = { cases[i].id, cases[i].lvl };
        capture_pre(r, 3, pre);
        uint32_t eax = call_eax_edx(fns[f].va, cases[i].id, cases[i].lvl);
        emit_ndjson_line(fp, fns[f].va, fns[f].nm, cases[i].cid, args, 2, 0xFFFFFFFFu, eax, r, 3, pre, NULL, 0);
      }
    }
  }

  /* 8..12: Txt record lookups (0x6FD51770, 0x6FD517A0, 0x6FD517D0, 0x6FD51800, 0x6FD51830) */
  {
    const struct { uint32_t va; const char *nm; } fns[5] = {
      { 0x6FD51770u, "DATATBLS_GetStatesTxtRecordInline113c" },
      { 0x6FD517A0u, "DATATBLS_GetItemStatCostTxtRecordInline113c" },
      { 0x6FD517D0u, "DATATBLS_GetSetsTxtRecordInline113c" },
      { 0x6FD51800u, "DATATBLS_GetSetItemsTxtRecordInline113c" },
      { 0x6FD51830u, "DATATBLS_GetUniqueItemsTxtRecordInline113c" },
    };
    const struct { uint32_t id; const char *cid; } cases[6] = {
      { (uint32_t)-1,    "neg_id" },
      { (uint32_t)-100,  "neg_large_id" },
      { 0u,              "id_zero" },
      { 2u,              "id_two" },
      { 3u,              "id_three_last" },
      { 4u,              "id_ge_count" },
    };
    RangeSpec r[2] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES, 0xD00 },
    };
    for (int f = 0; f < 5; f++) {
      for (int i = 0; i < 6; i++) {
        setup_it4_datatables();
        uint32_t args[1] = { cases[i].id };
        capture_pre(r, 2, pre);
        uint32_t eax = call_eax(fns[f].va, cases[i].id);
        emit_ndjson_line(fp, fns[f].va, fns[f].nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, r, 2, pre, NULL, 0);
      }
    }
  }

  /* 13. 0x6FD51860 MONSTERS_GetBaseIdFromMonsterUnitInline113c */
  {
    const uint32_t va = 0x6FD51860u;
    const char *nm = "MONSTERS_GetBaseIdFromMonsterUnitInline113c";
    const struct {
      uint32_t uptr;
      uint32_t utype;
      uint32_t cid_val;
      int null_tbl;
      const char *cid;
    } cases[8] = {
      { 0u,                1u, 1u,            0, "null_unit" },
      { ADDR_UNIT_MISSILE, 0u, 1u,            0, "wrong_type_player" },
      { ADDR_UNIT_MISSILE, 2u, 1u,            0, "wrong_type_object" },
      { ADDR_UNIT_MISSILE, 1u, (uint32_t)-5,  0, "neg_class_id_returns_class_id" },
      { ADDR_UNIT_MISSILE, 1u, 99u,           0, "ge_count_class_id_returns_class_id" },
      { ADDR_UNIT_MISSILE, 1u, 0u,            1, "null_monstats_table_returns_class_id" },
      { ADDR_UNIT_MISSILE, 1u, 1u,            0, "valid_pos_base_id" },
      { ADDR_UNIT_MISSILE, 1u, 2u,            0, "valid_neg_base_id" },
    };
    RangeSpec r[4] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES, 0xD00 },
      { ADDR_MONSTATS, 6 * 0x1A8 },
      { ADDR_UNIT_MISSILE, 244 },
    };
    for (int i = 0; i < 8; i++) {
      setup_it4_datatables();
      if (cases[i].null_tbl) w32(ADDR_DATATABLES + 0xA78, 0u);
      memset((void *)(uintptr_t)ADDR_UNIT_MISSILE, 0, 244);
      w32(ADDR_UNIT_MISSILE + 0x00, cases[i].utype);
      w32(ADDR_UNIT_MISSILE + 0x04, cases[i].cid_val);
      uint32_t args[1] = { cases[i].uptr };
      capture_pre(r, 4, pre);
      uint32_t eax = call_eax(va, cases[i].uptr);
      emit_ndjson_line(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, r, 4, pre, NULL, 0);
    }
  }

  /* 14. 0x6FD518A0 DATATBLS_CheckMonStatsFlagInline113c */
  {
    const uint32_t va = 0x6FD518A0u;
    const char *nm = "DATATBLS_CheckMonStatsFlagInline113c";
    const struct {
      uint32_t id;
      uint32_t flag;
      int null_tbl;
      const char *cid;
    } cases[8] = {
      { (uint32_t)-1, 0u,  0, "neg_monstats_id" },
      { 6u,           0u,  0, "ge_count_monstats_id" },
      { 0u,           0u,  1, "null_monstats_table" },
      { 1u,           0u,  0, "flag_bit0_set" },
      { 1u,           1u,  0, "flag_bit1_clear" },
      { 1u,           13u, 0, "flag_byte1_bit5_set" },
      { 1u,           18u, 0, "flag_byte2_bit2_set" },
      { 1u,           31u, 0, "flag_byte3_bit7_set" },
    };
    RangeSpec r[5] = {
      { VA_SGPT_DATATABLES, 4 },
      { VA_GDWBITMASKS_IAT, 4 },
      { ADDR_BITMASKS, 128 },
      { ADDR_DATATABLES, 0xD00 },
      { ADDR_MONSTATS, 6 * 0x1A8 },
    };
    for (int i = 0; i < 8; i++) {
      setup_it4_datatables();
      if (cases[i].null_tbl) w32(ADDR_DATATABLES + 0xA78, 0u);
      uint32_t args[2] = { cases[i].id, cases[i].flag };
      capture_pre(r, 5, pre);
      uint32_t eax = call_eax_edx(va, cases[i].id, cases[i].flag);
      emit_ndjson_line(fp, va, nm, cases[i].cid, args, 2, 0xFFFFFFFFu, eax, r, 5, pre, NULL, 0);
    }
  }

  /* 15. 0x6FD518F0 DATATBLS_HasValidSkillDescInline113c */
  {
    const uint32_t va = 0x6FD518F0u;
    const char *nm = "DATATBLS_HasValidSkillDescInline113c";
    const struct {
      uint32_t id;
      int null_tbl;
      const char *cid;
    } cases[7] = {
      { (uint32_t)-1, 0, "neg_skill_id" },
      { 4u,           0, "ge_skill_count" },
      { 0u,           1, "null_skills_table" },
      { 0u,           0, "skilldesc_neg" },
      { 1u,           0, "skilldesc_ge_count" },
      { 2u,           0, "skilldesc_zero_valid" },
      { 3u,           0, "skilldesc_seven_valid" },
    };
    RangeSpec r[3] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES, 0xD00 },
      { ADDR_SKILLS, 4 * 0x23C },
    };
    for (int i = 0; i < 7; i++) {
      setup_it4_datatables();
      if (cases[i].null_tbl) w32(ADDR_DATATABLES + 0xB98, 0u);
      uint32_t args[1] = { cases[i].id };
      capture_pre(r, 3, pre);
      uint32_t eax = call_eax(va, cases[i].id);
      emit_ndjson_line(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, r, 3, pre, NULL, 0);
    }
  }

  /* 16. 0x6FD51930 DATATBLS_WalkMonsterClassChainInline113c */
  {
    const uint32_t va = 0x6FD51930u;
    const char *nm = "DATATBLS_WalkMonsterClassChainInline113c";
    const struct {
      uint32_t id;
      uint32_t steps;
      int null_tbl;
      const char *cid;
    } cases[9] = {
      { (uint32_t)-1, 2u,           0, "neg_monstats_id" },
      { 6u,           2u,           0, "ge_count_monstats_id" },
      { 0u,           2u,           1, "null_monstats_table" },
      { 0u,           0u,           0, "steps_zero_returns_base_id" },
      { 5u,           (uint32_t)-2, 0, "steps_neg_returns_neg_base_id" },
      { 0u,           1u,           0, "steps_one_hop" },
      { 0u,           3u,           0, "steps_three_hops" },
      { 0u,           5u,           0, "steps_stops_on_neg_next" },
      { 4u,           3u,           0, "steps_stops_on_ge_count_next" },
    };
    RangeSpec r[3] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES, 0xD00 },
      { ADDR_MONSTATS, 6 * 0x1A8 },
    };
    for (int i = 0; i < 9; i++) {
      setup_it4_datatables();
      if (cases[i].null_tbl) w32(ADDR_DATATABLES + 0xA78, 0u);
      uint32_t args[2] = { cases[i].id, cases[i].steps };
      capture_pre(r, 3, pre);
      uint32_t eax = call_ecx_ebx(va, cases[i].id, cases[i].steps);
      emit_ndjson_line(fp, va, nm, cases[i].cid, args, 2, 0xFFFFFFFFu, eax, r, 3, pre, NULL, 0);
    }
  }
}

static void init_missile_unit(uint32_t utype, uint32_t class_id, uint32_t data_ptr) {
  memset((void *)(uintptr_t)ADDR_UNIT_MISSILE, 0, 244);
  memset((void *)(uintptr_t)ADDR_MISSILE_DATA, 0xA5, 52);
  w32(ADDR_UNIT_MISSILE + 0x00, utype);
  w32(ADDR_UNIT_MISSILE + 0x04, class_id);
  w32(ADDR_UNIT_MISSILE + 0x14, data_ptr);
}

static void emit_b023(FILE *fp) {
  uint8_t *pre[8];

  /* 1. 0x6FD6A2D0 MONSTERS_GetHirelingTypeId113c */
  {
    const uint32_t va = 0x6FD6A2D0u;
    const char *nm = "MONSTERS_GetHirelingTypeId113c";
    const struct {
      uint32_t uptr;
      uint32_t utype;
      uint32_t class_id;
      const char *cid;
    } cases[9] = {
      { 0u,                1u, 0x10Fu, "null_unit" },
      { ADDR_UNIT_MISSILE, 0u, 0x10Fu, "wrong_type_player" },
      { ADDR_UNIT_MISSILE, 1u, 0x10Fu, "rogue_0x10f_type1" },
      { ADDR_UNIT_MISSILE, 1u, 0x152u, "desert_merc_0x152_type2" },
      { ADDR_UNIT_MISSILE, 1u, 0x167u, "iron_wolf_0x167_type3" },
      { ADDR_UNIT_MISSILE, 1u, 0x230u, "barb_0x230_type4" },
      { ADDR_UNIT_MISSILE, 1u, 0x231u, "barb_0x231_type4" },
      { ADDR_UNIT_MISSILE, 1u, 0x22Fu, "below_barb_0x22f_type0" },
      { ADDR_UNIT_MISSILE, 1u, 0x232u, "above_barb_0x232_type0" },
    };
    RangeSpec r[1] = { { ADDR_UNIT_MISSILE, 244 } };
    for (int i = 0; i < 9; i++) {
      init_missile_unit(cases[i].utype, cases[i].class_id, 0u);
      uint32_t args[1] = { cases[i].uptr };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, r, 1, pre, NULL, 0);
    }
  }

  /* 2. 0x6FDB9C60 MISSILE_ScaleDamageDataBy128thsInline113c */
  {
    const uint32_t va = 0x6FDB9C60u;
    const char *nm = "MISSILE_ScaleDamageDataBy128thsInline113c";
    const struct { uint32_t scale; const char *cid; } cases[6] = {
      { 128u,           "scale_128_noop" },
      { 64u,            "scale_64_half_pos_and_neg" },
      { 256u,           "scale_256_double" },
      { 0u,             "scale_0_zero" },
      { 192u,           "scale_192_one_and_half" },
      { (uint32_t)-64,  "scale_neg_64_flip_sign" },
    };
    const uint32_t offs[17] = {
      0x0Cu, 0x10u, 0x18u, 0x1Cu, 0x20u, 0x24u, 0x28u, 0x2Cu, 0x30u,
      0x34u, 0x38u, 0x40u, 0x44u, 0x4Cu, 0x60u, 0x64u, 0x68u
    };
    const int32_t init_vals[17] = {
      256,   513,   -256,  -513,  127,   -127,  1,     -1,    1000,
      -1000, 333,   -333,  64,    -64,   192,   -192,  4095
    };
    RangeSpec r[1] = { { ADDR_DMG_DATA, 124 } };
    for (int i = 0; i < 6; i++) {
      memset((void *)(uintptr_t)ADDR_DMG_DATA, 0xA5, 124);
      for (int k = 0; k < 17; k++) {
        w32(ADDR_DMG_DATA + offs[k], (uint32_t)init_vals[k]);
      }
      uint32_t args[2] = { ADDR_DMG_DATA, cases[i].scale };
      capture_pre(r, 1, pre);
      call_ecx_esi(va, args[0], args[1]);
      emit_ndjson_line(fp, va, nm, cases[i].cid, args, 2, 0u, 0u, r, 1, pre, r, 1);
    }
  }

  /* 3. 0x6FDB9E70 MISSILE_GetHitShiftFromId113c */
  {
    const uint32_t va = 0x6FDB9E70u;
    const char *nm = "MISSILE_GetHitShiftFromId113c";
    const struct { uint32_t id; int null_tbl; const char *cid; } cases[5] = {
      { (uint32_t)-1, 0, "neg_id" },
      { 4u,           0, "ge_count" },
      { 0u,           1, "null_missiles_table" },
      { 1u,           0, "valid_hitshift_8" },
      { 2u,           0, "valid_hitshift_0xab" },
    };
    RangeSpec r[3] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES, 0xD00 },
      { ADDR_MISSILES, 4 * 0x1A4 },
    };
    for (int i = 0; i < 5; i++) {
      setup_it4_datatables();
      if (cases[i].null_tbl) w32(ADDR_DATATABLES + 0xB64, 0u);
      uint32_t args[1] = { cases[i].id };
      capture_pre(r, 3, pre);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, cases[i].cid, args, 1, 0xFFu, eax, r, 3, pre, NULL, 0);
    }
  }

  /* 4, 6: u32 target coord getters on D2MissileDataStrc
   *   0x6FDB9F50 MISSILE_GetTargetY113c (+0x2C)
   *   0x6FDB9F90 MISSILE_GetTargetX113c (+0x28)
   */
  {
    const struct { uint32_t va; uint32_t off; const char *nm; } fns[2] = {
      { 0x6FDB9F50u, 0x2Cu, "MISSILE_GetTargetY113c" },
      { 0x6FDB9F90u, 0x28u, "MISSILE_GetTargetX113c" },
    };
    const struct { uint32_t uptr; uint32_t utype; uint32_t dptr; uint32_t val; const char *cid; } cases[5] = {
      { 0u,                3u, ADDR_MISSILE_DATA, 0x12345678u, "null_unit" },
      { ADDR_UNIT_MISSILE, 1u, ADDR_MISSILE_DATA, 0x12345678u, "wrong_type" },
      { ADDR_UNIT_MISSILE, 3u, 0u,                0x12345678u, "null_data" },
      { ADDR_UNIT_MISSILE, 3u, ADDR_MISSILE_DATA, 0x00001357u, "valid_pos_coord" },
      { ADDR_UNIT_MISSILE, 3u, ADDR_MISSILE_DATA, 0xFFFFFFECu, "valid_neg_coord" },
    };
    RangeSpec r[2] = {
      { ADDR_UNIT_MISSILE, 244 },
      { ADDR_MISSILE_DATA, 52 },
    };
    for (int f = 0; f < 2; f++) {
      for (int i = 0; i < 5; i++) {
        init_missile_unit(cases[i].utype, 1u, cases[i].dptr);
        w32(ADDR_MISSILE_DATA + fns[f].off, cases[i].val);
        uint32_t args[1] = { cases[i].uptr };
        capture_pre(r, 2, pre);
        uint32_t eax = call_stdcall1(fns[f].va, args[0]);
        emit_ndjson_line(fp, fns[f].va, fns[f].nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, r, 2, pre, NULL, 0);
      }
    }
  }

  /* 5, 7: u32 target coord setters on D2MissileDataStrc
   *   0x6FDB9F70 MISSILE_SetTargetY113c (+0x2C)
   *   0x6FDB9FB0 MISSILE_SetTargetX113c (+0x28)
   */
  {
    const struct { uint32_t va; const char *nm; } fns[2] = {
      { 0x6FDB9F70u, "MISSILE_SetTargetY113c" },
      { 0x6FDB9FB0u, "MISSILE_SetTargetX113c" },
    };
    const struct { uint32_t uptr; uint32_t utype; uint32_t dptr; uint32_t val; const char *cid; } cases[5] = {
      { 0u,                3u, ADDR_MISSILE_DATA, 0x13572468u, "null_unit" },
      { ADDR_UNIT_MISSILE, 1u, ADDR_MISSILE_DATA, 0x13572468u, "wrong_type" },
      { ADDR_UNIT_MISSILE, 3u, 0u,                0x13572468u, "null_data" },
      { ADDR_UNIT_MISSILE, 3u, ADDR_MISSILE_DATA, 0x00001357u, "valid_pos_coord" },
      { ADDR_UNIT_MISSILE, 3u, ADDR_MISSILE_DATA, 0xFFFFFF80u, "valid_neg_coord" },
    };
    RangeSpec r[2] = {
      { ADDR_UNIT_MISSILE, 244 },
      { ADDR_MISSILE_DATA, 52 },
    };
    RangeSpec post_r[1] = { { ADDR_MISSILE_DATA, 52 } };
    for (int f = 0; f < 2; f++) {
      for (int i = 0; i < 5; i++) {
        init_missile_unit(cases[i].utype, 1u, cases[i].dptr);
        uint32_t args[2] = { cases[i].uptr, cases[i].val };
        capture_pre(r, 2, pre);
        call_stdcall2(fns[f].va, args[0], args[1]);
        emit_ndjson_line(fp, fns[f].va, fns[f].nm, cases[i].cid, args, 2, 0u, 0u, r, 2, pre, post_r, 1);
      }
    }
  }

  /* 8, 14, 15, 16, 17: s16 getters returning 0 on invalid unit
   *   0x6FDBA030 MISSILE_GetActivateFrame113c (+0x08)
   *   0x6FDBA270 MISSILE_GetRemainingFrames113c (+0x10)
   *   0x6FDBA290 MISSILE_GetTotalFrames113c (+0x0E)
   *   0x6FDBA2B0 MISSILE_GetSkill113c (+0x0A)
   *   0x6FDBA2D0 MISSILE_GetLevel113c (+0x0C)
   */
  {
    const struct { uint32_t va; uint32_t off; const char *nm; } fns[5] = {
      { 0x6FDBA030u, 0x08u, "MISSILE_GetActivateFrame113c" },
      { 0x6FDBA270u, 0x10u, "MISSILE_GetRemainingFrames113c" },
      { 0x6FDBA290u, 0x0Eu, "MISSILE_GetTotalFrames113c" },
      { 0x6FDBA2B0u, 0x0Au, "MISSILE_GetSkill113c" },
      { 0x6FDBA2D0u, 0x0Cu, "MISSILE_GetLevel113c" },
    };
    const struct { uint32_t uptr; uint32_t utype; uint32_t dptr; uint16_t val; const char *cid; } cases[5] = {
      { 0u,                3u, ADDR_MISSILE_DATA, 0x1234u, "null_unit" },
      { ADDR_UNIT_MISSILE, 1u, ADDR_MISSILE_DATA, 0x1234u, "wrong_type" },
      { ADDR_UNIT_MISSILE, 3u, 0u,                0x1234u, "null_data" },
      { ADDR_UNIT_MISSILE, 3u, ADDR_MISSILE_DATA, 0x1234u, "valid_pos_s16" },
      { ADDR_UNIT_MISSILE, 3u, ADDR_MISSILE_DATA, 0xFFECu, "valid_neg_s16" },
    };
    RangeSpec r[2] = {
      { ADDR_UNIT_MISSILE, 244 },
      { ADDR_MISSILE_DATA, 52 },
    };
    for (int f = 0; f < 5; f++) {
      for (int i = 0; i < 5; i++) {
        init_missile_unit(cases[i].utype, 1u, cases[i].dptr);
        w16(ADDR_MISSILE_DATA + fns[f].off, cases[i].val);
        uint32_t args[1] = { cases[i].uptr };
        capture_pre(r, 2, pre);
        uint32_t eax = call_stdcall1(fns[f].va, args[0]);
        emit_ndjson_line(fp, fns[f].va, fns[f].nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, r, 2, pre, NULL, 0);
      }
    }
  }

  /* 9. 0x6FDBA050 MISSILE_GetActivateFrameFromUnit113c */
  {
    const uint32_t va = 0x6FDBA050u;
    const char *nm = "MISSILE_GetActivateFrameFromUnit113c";
    const struct {
      uint32_t uptr;
      uint32_t utype;
      uint32_t cid_val;
      int null_tbl;
      const char *cid;
    } cases[7] = {
      { 0u,                3u, 1u,            0, "null_unit" },
      { ADDR_UNIT_MISSILE, 1u, 1u,            0, "wrong_unit_type" },
      { ADDR_UNIT_MISSILE, 3u, (uint32_t)-1,  0, "neg_class_id" },
      { ADDR_UNIT_MISSILE, 3u, 99u,           0, "ge_count_class_id" },
      { ADDR_UNIT_MISSILE, 3u, 0u,            1, "null_missiles_table" },
      { ADDR_UNIT_MISSILE, 3u, 1u,            0, "valid_activate_15" },
      { ADDR_UNIT_MISSILE, 3u, 2u,            0, "valid_activate_250" },
    };
    RangeSpec r[4] = {
      { VA_SGPT_DATATABLES, 4 },
      { ADDR_DATATABLES, 0xD00 },
      { ADDR_MISSILES, 4 * 0x1A4 },
      { ADDR_UNIT_MISSILE, 244 },
    };
    for (int i = 0; i < 7; i++) {
      setup_it4_datatables();
      if (cases[i].null_tbl) w32(ADDR_DATATABLES + 0xB64, 0u);
      init_missile_unit(cases[i].utype, cases[i].cid_val, ADDR_MISSILE_DATA);
      uint32_t args[1] = { cases[i].uptr };
      capture_pre(r, 4, pre);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, r, 4, pre, NULL, 0);
    }
  }

  /* 18. 0x6FDBA2F0 MISSILE_SetLevel113c (unclamped u16 setter at +0x0C) */
  {
    const uint32_t va = 0x6FDBA2F0u;
    const char *nm = "MISSILE_SetLevel113c";
    const struct { uint32_t uptr; uint32_t utype; uint32_t dptr; uint32_t val; const char *cid; } cases[5] = {
      { 0u,                3u, ADDR_MISSILE_DATA, 0x1357u,     "null_unit" },
      { ADDR_UNIT_MISSILE, 1u, ADDR_MISSILE_DATA, 0x1357u,     "wrong_type" },
      { ADDR_UNIT_MISSILE, 3u, 0u,                0x1357u,     "null_data" },
      { ADDR_UNIT_MISSILE, 3u, ADDR_MISSILE_DATA, 0x1357u,     "valid_16bit" },
      { ADDR_UNIT_MISSILE, 3u, ADDR_MISSILE_DATA, 0xDEADCAFEu, "valid_unclamped_truncation" },
    };
    RangeSpec r[2] = {
      { ADDR_UNIT_MISSILE, 244 },
      { ADDR_MISSILE_DATA, 52 },
    };
    RangeSpec post_r[1] = { { ADDR_MISSILE_DATA, 52 } };
    for (int i = 0; i < 5; i++) {
      init_missile_unit(cases[i].utype, 1u, cases[i].dptr);
      uint32_t args[2] = { cases[i].uptr, cases[i].val };
      capture_pre(r, 2, pre);
      call_stdcall2(va, args[0], args[1]);
      emit_ndjson_line(fp, va, nm, cases[i].cid, args, 2, 0u, 0u, r, 2, pre, post_r, 1);
    }
  }

  /* 10. 0x6FDBA130 MISSILE_IsOwnedByUnit113c */
  {
    const uint32_t va = 0x6FDBA130u;
    const char *nm = "MISSILE_IsOwnedByUnit113c";
    const struct {
      uint32_t mptr;
      uint32_t mtype;
      uint32_t mcid;
      uint32_t dptr;
      int null_tbl;
      uint32_t optr;
      uint32_t otype;
      uint32_t oid;
      uint32_t dtype;
      uint32_t did;
      const char *cid;
    } cases[11] = {
      { 0u,                3u, 1u,            ADDR_MISSILE_DATA, 0, ADDR_UNIT_OWNER, 0u, 42u, 0u, 42u, "null_missile" },
      { ADDR_UNIT_MISSILE, 3u, 1u,            ADDR_MISSILE_DATA, 0, 0u,              0u, 42u, 0u, 42u, "null_owner" },
      { ADDR_UNIT_MISSILE, 1u, 1u,            ADDR_MISSILE_DATA, 0, ADDR_UNIT_OWNER, 0u, 42u, 0u, 42u, "wrong_missile_type" },
      { ADDR_UNIT_MISSILE, 3u, (uint32_t)-1,  ADDR_MISSILE_DATA, 0, ADDR_UNIT_OWNER, 0u, 42u, 0u, 42u, "neg_missile_class" },
      { ADDR_UNIT_MISSILE, 3u, 99u,           ADDR_MISSILE_DATA, 0, ADDR_UNIT_OWNER, 0u, 42u, 0u, 42u, "ge_count_missile_class" },
      { ADDR_UNIT_MISSILE, 3u, 0u,            ADDR_MISSILE_DATA, 1, ADDR_UNIT_OWNER, 0u, 42u, 0u, 42u, "null_missiles_table" },
      { ADDR_UNIT_MISSILE, 3u, 0u,            ADDR_MISSILE_DATA, 0, ADDR_UNIT_OWNER, 0u, 42u, 0u, 42u, "flag_bit0_clear" },
      { ADDR_UNIT_MISSILE, 3u, 1u,            0u,                0, ADDR_UNIT_OWNER, 0u, 42u, 0u, 42u, "null_missile_data" },
      { ADDR_UNIT_MISSILE, 3u, 1u,            ADDR_MISSILE_DATA, 0, ADDR_UNIT_OWNER, 1u, 42u, 0u, 42u, "owner_type_mismatch" },
      { ADDR_UNIT_MISSILE, 3u, 1u,            ADDR_MISSILE_DATA, 0, ADDR_UNIT_OWNER, 0u, 42u, 0u, 43u, "owner_id_mismatch" },
      { ADDR_UNIT_MISSILE, 3u, 1u,            ADDR_MISSILE_DATA, 0, ADDR_UNIT_OWNER, 0u, 42u, 0u, 42u, "owner_match" },
    };
    RangeSpec r8[8] = {
      { VA_SGPT_DATATABLES, 4 },
      { VA_GDWBITMASKS_IAT, 4 },
      { ADDR_BITMASKS, 128 },
      { ADDR_DATATABLES, 0xD00 },
      { ADDR_MISSILES, 4 * 0x1A4 },
      { ADDR_UNIT_MISSILE, 244 },
      { ADDR_UNIT_OWNER, 244 },
      { ADDR_MISSILE_DATA, 52 },
    };
    for (int i = 0; i < 11; i++) {
      setup_it4_datatables();
      if (cases[i].null_tbl) w32(ADDR_DATATABLES + 0xB64, 0u);
      init_missile_unit(cases[i].mtype, cases[i].mcid, cases[i].dptr);
      w32(ADDR_MISSILE_DATA + 0x18, cases[i].dtype);
      w32(ADDR_MISSILE_DATA + 0x1C, cases[i].did);
      memset((void *)(uintptr_t)ADDR_UNIT_OWNER, 0, 244);
      w32(ADDR_UNIT_OWNER + 0x00, cases[i].otype);
      w32(ADDR_UNIT_OWNER + 0x0C, cases[i].oid);
      uint32_t args[2] = { cases[i].mptr, cases[i].optr };
      capture_pre(r8, 8, pre);
      uint32_t eax = call_stdcall2(va, args[0], args[1]);
      emit_ndjson_line(fp, va, nm, cases[i].cid, args, 2, 0xFFFFFFFFu, eax, r8, 8, pre, NULL, 0);
    }
  }

  /* 11. 0x6FDBA1B0 MISSILE_SetOwner113c */
  {
    const uint32_t va = 0x6FDBA1B0u;
    const char *nm = "MISSILE_SetOwner113c";
    const struct {
      uint32_t mptr;
      uint32_t mtype;
      uint32_t mcid;
      uint32_t dptr;
      int null_tbl;
      uint32_t optr;
      uint32_t otype;
      uint32_t oid;
      const char *cid;
    } cases[9] = {
      { 0u,                3u, 1u,            ADDR_MISSILE_DATA, 0, ADDR_UNIT_OWNER, 1u, 777u, "null_missile" },
      { ADDR_UNIT_MISSILE, 2u, 1u,            ADDR_MISSILE_DATA, 0, ADDR_UNIT_OWNER, 1u, 777u, "wrong_missile_type" },
      { ADDR_UNIT_MISSILE, 3u, 1u,            0u,                0, ADDR_UNIT_OWNER, 1u, 777u, "null_missile_data" },
      { ADDR_UNIT_MISSILE, 3u, (uint32_t)-1,  ADDR_MISSILE_DATA, 0, ADDR_UNIT_OWNER, 1u, 777u, "neg_missile_class" },
      { ADDR_UNIT_MISSILE, 3u, 99u,           ADDR_MISSILE_DATA, 0, ADDR_UNIT_OWNER, 1u, 777u, "ge_count_missile_class" },
      { ADDR_UNIT_MISSILE, 3u, 0u,            ADDR_MISSILE_DATA, 1, ADDR_UNIT_OWNER, 1u, 777u, "null_missiles_table" },
      { ADDR_UNIT_MISSILE, 3u, 0u,            ADDR_MISSILE_DATA, 0, ADDR_UNIT_OWNER, 1u, 777u, "flag_bit0_clear" },
      { ADDR_UNIT_MISSILE, 3u, 1u,            ADDR_MISSILE_DATA, 0, 0u,              1u, 777u, "null_owner_sets_id_neg1" },
      { ADDR_UNIT_MISSILE, 3u, 1u,            ADDR_MISSILE_DATA, 0, ADDR_UNIT_OWNER, 1u, 0x12345678u, "valid_owner_sets_type_and_id" },
    };
    RangeSpec r8[8] = {
      { VA_SGPT_DATATABLES, 4 },
      { VA_GDWBITMASKS_IAT, 4 },
      { ADDR_BITMASKS, 128 },
      { ADDR_DATATABLES, 0xD00 },
      { ADDR_MISSILES, 4 * 0x1A4 },
      { ADDR_UNIT_MISSILE, 244 },
      { ADDR_UNIT_OWNER, 244 },
      { ADDR_MISSILE_DATA, 52 },
    };
    RangeSpec post_r[1] = { { ADDR_MISSILE_DATA, 52 } };
    for (int i = 0; i < 9; i++) {
      setup_it4_datatables();
      if (cases[i].null_tbl) w32(ADDR_DATATABLES + 0xB64, 0u);
      init_missile_unit(cases[i].mtype, cases[i].mcid, cases[i].dptr);
      w32(ADDR_MISSILE_DATA + 0x18, 0x55555555u);
      w32(ADDR_MISSILE_DATA + 0x1C, 0x66666666u);
      memset((void *)(uintptr_t)ADDR_UNIT_OWNER, 0, 244);
      w32(ADDR_UNIT_OWNER + 0x00, cases[i].otype);
      w32(ADDR_UNIT_OWNER + 0x0C, cases[i].oid);
      uint32_t args[2] = { cases[i].mptr, cases[i].optr };
      capture_pre(r8, 8, pre);
      call_stdcall2(va, args[0], args[1]);
      emit_ndjson_line(fp, va, nm, cases[i].cid, args, 2, 0u, 0u, r8, 8, pre, post_r, 1);
    }
  }

  /* 12. 0x6FDBA220 MISSILE_GetClassId113c */
  {
    const uint32_t va = 0x6FDBA220u;
    const char *nm = "MISSILE_GetClassId113c";
    const struct { uint32_t uptr; uint32_t utype; uint32_t cid_val; const char *cid; } cases[5] = {
      { 0u,                3u, 42u,            "null_unit" },
      { ADDR_UNIT_MISSILE, 1u, 42u,            "wrong_type" },
      { ADDR_UNIT_MISSILE, 3u, 0u,             "valid_zero_class" },
      { ADDR_UNIT_MISSILE, 3u, 275u,           "valid_pos_class" },
      { ADDR_UNIT_MISSILE, 3u, 0x80001234u,    "valid_high_bit_class" },
    };
    RangeSpec r[1] = { { ADDR_UNIT_MISSILE, 244 } };
    for (int i = 0; i < 5; i++) {
      init_missile_unit(cases[i].utype, cases[i].cid_val, 0u);
      uint32_t args[1] = { cases[i].uptr };
      capture_pre(r, 1, pre);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, r, 1, pre, NULL, 0);
    }
  }

  /* 13. 0x6FDBA240 MISSILE_GetElapsedFrames113c (s16(nTotalFrames +0x0E) - s16(nRemainingFrames +0x10)) */
  {
    const uint32_t va = 0x6FDBA240u;
    const char *nm = "MISSILE_GetElapsedFrames113c";
    const struct { uint32_t uptr; uint32_t utype; uint32_t dptr; uint16_t tot; uint16_t rem; const char *cid; } cases[6] = {
      { 0u,                3u, ADDR_MISSILE_DATA, 100u,    40u,     "null_unit" },
      { ADDR_UNIT_MISSILE, 1u, ADDR_MISSILE_DATA, 100u,    40u,     "wrong_type" },
      { ADDR_UNIT_MISSILE, 3u, 0u,                100u,    40u,     "null_data" },
      { ADDR_UNIT_MISSILE, 3u, ADDR_MISSILE_DATA, 100u,    35u,     "pos_elapsed_65" },
      { ADDR_UNIT_MISSILE, 3u, ADDR_MISSILE_DATA, 50u,     80u,     "neg_elapsed_neg30" },
      { ADDR_UNIT_MISSILE, 3u, ADDR_MISSILE_DATA, 0xFFF6u, 0xFFCEu, "signed_s16_sub" },
    };
    RangeSpec r[2] = {
      { ADDR_UNIT_MISSILE, 244 },
      { ADDR_MISSILE_DATA, 52 },
    };
    for (int i = 0; i < 6; i++) {
      init_missile_unit(cases[i].utype, 1u, cases[i].dptr);
      w16(ADDR_MISSILE_DATA + 0x0E, cases[i].tot);
      w16(ADDR_MISSILE_DATA + 0x10, cases[i].rem);
      uint32_t args[1] = { cases[i].uptr };
      capture_pre(r, 2, pre);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, r, 2, pre, NULL, 0);
    }
  }

  /* 19. 0x6FDBA310 MISSILE_SetStreamFlags113c */
  {
    const uint32_t va = 0x6FDBA310u;
    const char *nm = "MISSILE_SetStreamFlags113c";
    const struct { uint32_t uptr; uint32_t utype; uint32_t dptr; uint32_t val; const char *cid; } cases[5] = {
      { 0u,                3u, ADDR_MISSILE_DATA, 0x12345678u,    "null_unit" },
      { ADDR_UNIT_MISSILE, 1u, ADDR_MISSILE_DATA, 0x12345678u,    "wrong_type" },
      { ADDR_UNIT_MISSILE, 3u, 0u,                0x12345678u,    "null_data" },
      { ADDR_UNIT_MISSILE, 3u, ADDR_MISSILE_DATA, 0x12345678u,    "valid_pos_flags" },
      { ADDR_UNIT_MISSILE, 3u, ADDR_MISSILE_DATA, 0xCAFEBABEu,    "valid_high_bit_flags" },
    };
    RangeSpec r[2] = {
      { ADDR_UNIT_MISSILE, 244 },
      { ADDR_MISSILE_DATA, 52 },
    };
    RangeSpec post_r[1] = { { ADDR_MISSILE_DATA, 52 } };
    for (int i = 0; i < 5; i++) {
      init_missile_unit(cases[i].utype, 1u, cases[i].dptr);
      uint32_t args[2] = { cases[i].uptr, cases[i].val };
      capture_pre(r, 2, pre);
      call_stdcall2(va, args[0], args[1]);
      emit_ndjson_line(fp, va, nm, cases[i].cid, args, 2, 0u, 0u, r, 2, pre, post_r, 1);
    }
  }

  /* 20. 0x6FDBA330 MISSILE_GetStreamFlags113c */
  {
    const uint32_t va = 0x6FDBA330u;
    const char *nm = "MISSILE_GetStreamFlags113c";
    const struct { uint32_t uptr; uint32_t utype; uint32_t dptr; uint32_t val; const char *cid; } cases[5] = {
      { 0u,                3u, ADDR_MISSILE_DATA, 0x12345678u, "null_unit" },
      { ADDR_UNIT_MISSILE, 1u, ADDR_MISSILE_DATA, 0x12345678u, "wrong_type" },
      { ADDR_UNIT_MISSILE, 3u, 0u,                0x12345678u, "null_data" },
      { ADDR_UNIT_MISSILE, 3u, ADDR_MISSILE_DATA, 0x12345678u, "valid_pos_flags" },
      { ADDR_UNIT_MISSILE, 3u, ADDR_MISSILE_DATA, 0x89ABCDEFu, "valid_high_bit_flags" },
    };
    RangeSpec r[2] = {
      { ADDR_UNIT_MISSILE, 244 },
      { ADDR_MISSILE_DATA, 52 },
    };
    for (int i = 0; i < 5; i++) {
      init_missile_unit(cases[i].utype, 1u, cases[i].dptr);
      w32(ADDR_MISSILE_DATA + 0x14, cases[i].val);
      uint32_t args[1] = { cases[i].uptr };
      capture_pre(r, 2, pre);
      uint32_t eax = call_stdcall1(va, args[0]);
      emit_ndjson_line(fp, va, nm, cases[i].cid, args, 1, 0xFFFFFFFFu, eax, r, 2, pre, NULL, 0);
    }
  }

  /* 21..23: clamped [-32768, 32767] u16 setters (0x6FDBA690, 0x6FDBA6D0, 0x6FDBA710) */
  {
    const struct { uint32_t va; const char *nm; } fns[3] = {
      { 0x6FDBA690u, "MISSILE_SetActivateFrame113c" },
      { 0x6FDBA6D0u, "MISSILE_SetRemainingFrames113c" },
      { 0x6FDBA710u, "MISSILE_SetTotalFrames113c" },
    };
    const struct { uint32_t uptr; uint32_t utype; uint32_t dptr; uint32_t val; const char *cid; } cases[7] = {
      { 0u,                3u, ADDR_MISSILE_DATA, 50u,              "null_unit" },
      { ADDR_UNIT_MISSILE, 1u, ADDR_MISSILE_DATA, 50u,              "wrong_type" },
      { ADDR_UNIT_MISSILE, 3u, 0u,                50u,              "null_data" },
      { ADDR_UNIT_MISSILE, 3u, ADDR_MISSILE_DATA, 1234u,            "in_range_pos" },
      { ADDR_UNIT_MISSILE, 3u, ADDR_MISSILE_DATA, (uint32_t)-1234,  "in_range_neg" },
      { ADDR_UNIT_MISSILE, 3u, ADDR_MISSILE_DATA, 50000u,           "clamp_above_32767" },
      { ADDR_UNIT_MISSILE, 3u, ADDR_MISSILE_DATA, (uint32_t)-50000, "clamp_below_neg32768" },
    };
    RangeSpec r[2] = {
      { ADDR_UNIT_MISSILE, 244 },
      { ADDR_MISSILE_DATA, 52 },
    };
    RangeSpec post_r[1] = { { ADDR_MISSILE_DATA, 52 } };
    for (int f = 0; f < 3; f++) {
      for (int i = 0; i < 7; i++) {
        init_missile_unit(cases[i].utype, 1u, cases[i].dptr);
        uint32_t args[2] = { cases[i].uptr, cases[i].val };
        capture_pre(r, 2, pre);
        call_stdcall2(fns[f].va, args[0], args[1]);
        emit_ndjson_line(fp, fns[f].va, fns[f].nm, cases[i].cid, args, 2, 0u, 0u, r, 2, pre, post_r, 1);
      }
    }
  }

  /* 24. 0x6FDBA750 MISSILE_SetSkill113c (clamped [0, 32767]) */
  {
    const uint32_t va = 0x6FDBA750u;
    const char *nm = "MISSILE_SetSkill113c";
    const struct { uint32_t uptr; uint32_t utype; uint32_t dptr; uint32_t val; const char *cid; } cases[7] = {
      { 0u,                3u, ADDR_MISSILE_DATA, 50u,           "null_unit" },
      { ADDR_UNIT_MISSILE, 1u, ADDR_MISSILE_DATA, 50u,           "wrong_type" },
      { ADDR_UNIT_MISSILE, 3u, 0u,                50u,           "null_data" },
      { ADDR_UNIT_MISSILE, 3u, ADDR_MISSILE_DATA, 245u,          "in_range_pos" },
      { ADDR_UNIT_MISSILE, 3u, ADDR_MISSILE_DATA, 0u,            "in_range_zero" },
      { ADDR_UNIT_MISSILE, 3u, ADDR_MISSILE_DATA, 40000u,        "clamp_above_32767" },
      { ADDR_UNIT_MISSILE, 3u, ADDR_MISSILE_DATA, (uint32_t)-5,  "clamp_negative_to_zero" },
    };
    RangeSpec r[2] = {
      { ADDR_UNIT_MISSILE, 244 },
      { ADDR_MISSILE_DATA, 52 },
    };
    RangeSpec post_r[1] = { { ADDR_MISSILE_DATA, 52 } };
    for (int i = 0; i < 7; i++) {
      init_missile_unit(cases[i].utype, 1u, cases[i].dptr);
      uint32_t args[2] = { cases[i].uptr, cases[i].val };
      capture_pre(r, 2, pre);
      call_stdcall2(va, args[0], args[1]);
      emit_ndjson_line(fp, va, nm, cases[i].cid, args, 2, 0u, 0u, r, 2, pre, post_r, 1);
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
  VirtualProtect((void *)(uintptr_t)VA_SGPT_DATATABLES, 4, PAGE_READWRITE, &old_prot);

  char path[512];

  snprintf(path, sizeof(path), "%s/b020-vectors.ndjson", out_dir);
  FILE *fp20 = fopen(path, "wb");
  if (!fp20) { perror("fopen b020"); return 5; }
  emit_b020(fp20);
  fclose(fp20);

  snprintf(path, sizeof(path), "%s/b023-vectors.ndjson", out_dir);
  FILE *fp23 = fopen(path, "wb");
  if (!fp23) { perror("fopen b023"); return 6; }
  emit_b023(fp23);
  fclose(fp23);

  printf("Emitted real-DLL vectors for B020 and B023 into %s\n", out_dir);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
