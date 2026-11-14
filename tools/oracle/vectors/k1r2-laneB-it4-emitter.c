/*
 * Standalone MinGW real-DLL differential vector emitter for K1r2 Iteration 4 Lane B (B015 + B018, 37 functions).
 *
 * Loads the real Diablo II v1.13c D2Common.dll (image base 0x6FD50000) under Wine, allocates a
 * deterministic scratch arena at 0x20000000, executes all 21 B015 functions and 16 B018 functions
 * across normal, boundary, negative/edge, and sentinel-padded inputs, and writes NDJSON records
 * to b015-vectors.ndjson and b018-vectors.ndjson.
 */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define EXPECTED_BASE 0x6FD50000u
#define ARENA_ADDR    0x20000000u
#define ARENA_SIZE    0x00080000u

static uintptr_t g_base = 0;
static uint8_t *g_arena = NULL;

#define RVA(va) (g_base - EXPECTED_BASE + (uint32_t)(va))
#define PTR(off) ((uint32_t)(ARENA_ADDR + (uint32_t)(off)))

static void w8(uint32_t addr, uint8_t v) { *(uint8_t *)(uintptr_t)addr = v; }
static void w16(uint32_t addr, uint16_t v) { *(uint16_t *)(uintptr_t)addr = v; }
static void w32(uint32_t addr, uint32_t v) { *(uint32_t *)(uintptr_t)addr = v; }

typedef struct {
  uint32_t addr;
  uint32_t len;
  uint8_t *pre;
  uint8_t *post;
} MemBlock;

#define MAX_BLOCKS 16
static MemBlock g_blocks[MAX_BLOCKS];
static int g_num_blocks = 0;

static void reset_arena(void) {
  memset(g_arena, 0, ARENA_SIZE);
  for (int i = 0; i < g_num_blocks; i++) {
    free(g_blocks[i].pre);
    free(g_blocks[i].post);
  }
  g_num_blocks = 0;
}

static void track_block(uint32_t addr, uint32_t len) {
  if (g_num_blocks >= MAX_BLOCKS) {
    fprintf(stderr, "Too many tracked blocks\n");
    ExitProcess(5);
  }
  MemBlock *b = &g_blocks[g_num_blocks++];
  b->addr = addr;
  b->len = len;
  b->pre = (uint8_t *)malloc(len);
  b->post = (uint8_t *)malloc(len);
  memcpy(b->pre, (const void *)(uintptr_t)addr, len);
}

static void snapshot_post(void) {
  for (int i = 0; i < g_num_blocks; i++) {
    memcpy(g_blocks[i].post, (const void *)(uintptr_t)g_blocks[i].addr, g_blocks[i].len);
  }
}

static void write_hex(FILE *fp, const uint8_t *buf, uint32_t len) {
  for (uint32_t i = 0; i < len; i++) {
    fprintf(fp, "%02x", buf[i]);
  }
}

static void emit_record(
  FILE *fp,
  uint32_t va,
  const char *name,
  const char *case_id,
  const uint32_t *args,
  int nargs,
  uint32_t eax,
  uint32_t ret_mask
) {
  snapshot_post();
  fprintf(fp, "{\"va\":\"0x%08X\",\"name\":\"%s\",\"caseId\":\"%s\",\"args\":[", va, name, case_id);
  for (int i = 0; i < nargs; i++) {
    if (i > 0) fputc(',', fp);
    fprintf(fp, "%u", args[i]);
  }
  fprintf(fp, "],\"retMask\":%u,\"eax\":%u,\"pre\":[", ret_mask, eax & ret_mask);
  for (int i = 0; i < g_num_blocks; i++) {
    if (i > 0) fputc(',', fp);
    fprintf(fp, "{\"addr\":%u,\"hex\":\"", g_blocks[i].addr);
    write_hex(fp, g_blocks[i].pre, g_blocks[i].len);
    fprintf(fp, "\"}");
  }
  fprintf(fp, "],\"post\":[");
  for (int i = 0; i < g_num_blocks; i++) {
    if (i > 0) fputc(',', fp);
    fprintf(fp, "{\"addr\":%u,\"hex\":\"", g_blocks[i].addr);
    write_hex(fp, g_blocks[i].post, g_blocks[i].len);
    fprintf(fp, "\"}");
  }
  fprintf(fp, "]}\n");
}

/* Standard calling convention typedefs */
typedef uint32_t(__stdcall *Std0)(void);
typedef uint32_t(__stdcall *Std1)(uint32_t);
typedef uint32_t(__stdcall *Std2)(uint32_t, uint32_t);
typedef uint32_t(__stdcall *Std3)(uint32_t, uint32_t, uint32_t);
typedef uint32_t(__fastcall *Fast1)(uint32_t);
typedef uint32_t(__fastcall *Fast2)(uint32_t, uint32_t);
typedef uint32_t(__fastcall *Fast3)(uint32_t, uint32_t, uint32_t);

/* Custom LTCG thunks */
/* eax=a0 -> eax (ret) */
static __attribute__((noinline)) uint32_t call_eax_ret(uintptr_t fn, uint32_t a0) {
  uint32_t r;
  __asm__ volatile(
    "call *%2"
    : "=a"(r)
    : "a"(a0), "c"(fn)
    : "edx", "memory", "cc"
  );
  return r;
}

/* eax=a0, ecx=a1 -> eax (ret) */
static __attribute__((noinline)) uint32_t call_eax_ecx_ret(uintptr_t fn, uint32_t a0, uint32_t a1) {
  uint32_t r;
  __asm__ volatile(
    "call *%3"
    : "=a"(r)
    : "a"(a0), "c"(a1), "d"(fn)
    : "memory", "cc"
  );
  return r;
}

/* eax=a0, ecx=a1, edx=a2 -> eax (ret) */
static __attribute__((noinline)) uint32_t call_eax_ecx_edx_ret(uintptr_t fn, uint32_t a0, uint32_t a1, uint32_t a2) {
  uint32_t r;
  __asm__ volatile(
    "call *%4"
    : "=a"(r)
    : "a"(a0), "c"(a1), "d"(a2), "b"(fn)
    : "esi", "memory", "cc"
  );
  return r;
}

/* 0x6FD5E430: eax=pLevel, esi=nOldPrestId, [esp+4]=nNewPrestId, [esp+8]=nNewOrient, [esp+0xC]=bClearBit1; ret 0xC */
static __attribute__((noinline)) uint32_t call_6FD5E430(
  uint32_t pLevel,
  uint32_t nOldPrestId,
  uint32_t nNewPrestId,
  uint32_t nNewOrient,
  uint32_t bClearBit1
) {
  uintptr_t fn = RVA(0x6FD5E430);
  uint32_t r;
  __asm__ volatile(
    "pushl %[c]\n\t"
    "pushl %[b]\n\t"
    "pushl %[a]\n\t"
    "call *%[fn]"
    : "=a"(r), "+S"(nOldPrestId), [a]"+c"(nNewPrestId), [b]"+d"(nNewOrient), [c]"+D"(bClearBit1)
    : "a"(pLevel), [fn]"b"(fn)
    : "memory", "cc"
  );
  return r;
}

/* 0x6FD645A0: ecx=pLevel, [esp+4]=bFlag -> eax; ret 4 */
static __attribute__((noinline)) uint32_t call_6FD645A0(uint32_t pLevel, uint32_t bFlag) {
  uintptr_t fn = RVA(0x6FD645A0);
  uint32_t r;
  __asm__ volatile(
    "pushl %[flag]\n\t"
    "call *%[fn]"
    : "=a"(r), "+c"(pLevel), [flag]"+d"(bFlag)
    : [fn]"a"(fn)
    : "memory", "cc"
  );
  return r;
}

/* Helper to set up an item unit at PTR(0x100) and sentinel-filled D2ItemDataStrc at PTR(0x200) */
static void setup_item_unit(int mode, uint32_t *out_unit, uint32_t *out_data) {
  uint32_t u = PTR(0x100);
  uint32_t d = PTR(0x200);
  memset((void *)(uintptr_t)u, 0, 0xF4);
  memset((void *)(uintptr_t)d, 0xA5, 0x74);
  if (mode == 0) {
    /* Valid item unit */
    w32(u + 0x00, 4u);
    w32(u + 0x14, d);
    *out_unit = u;
    *out_data = d;
  } else if (mode == 1) {
    /* NULL unit */
    *out_unit = 0u;
    *out_data = d;
  } else if (mode == 2) {
    /* Non-item unit (monster type 1) */
    w32(u + 0x00, 1u);
    w32(u + 0x14, d);
    *out_unit = u;
    *out_data = d;
  } else {
    /* Item unit with NULL pItemData */
    w32(u + 0x00, 4u);
    w32(u + 0x14, 0u);
    *out_unit = u;
    *out_data = d;
  }
}

static void emit_b015(FILE *fp) {
  /* 1. 0x6FD71F70: ITEMS_CheckQualityTradable */
  {
    const uint32_t vals[8] = { 0u, (uint32_t)-1, 1u, 3u, 4u, 6u, 9u, 10u };
    const char *cids[8] = { "qual_0", "qual_neg1", "qual_1", "qual_3", "qual_4", "qual_6", "qual_9", "qual_10" };
    for (int i = 0; i < 8; i++) {
      reset_arena();
      uint32_t a[1] = { vals[i] };
      uint32_t r = call_eax_ret(RVA(0x6FD71F70), a[0]);
      emit_record(fp, 0x6FD71F70, "ITEMS_CheckQualityTradable", cids[i], a, 1, r, 0xFFFFFFFFu);
    }
  }

  /* 2. 0x6FD71F90: ITEMS_PackColorIndex */
  {
    const uint32_t g[8] = { 0u, (uint32_t)-1, 9u, 1u, 1u, 1u, 7u, 8u };
    const uint32_t s[8] = { 5u, 5u, 5u, (uint32_t)-1, 21u, 0u, 20u, 20u };
    const char *cids[8] = {
      "group_zero", "group_neg", "group_9_oob", "sub_neg", "sub_21_oob", "group_1_0", "group_7_20", "group_8_20_u8_wrap"
    };
    for (int i = 0; i < 8; i++) {
      reset_arena();
      uint32_t a[2] = { g[i], s[i] };
      uint32_t r = call_eax_ecx_ret(RVA(0x6FD71F90), a[0], a[1]);
      emit_record(fp, 0x6FD71F90, "ITEMS_PackColorIndex", cids[i], a, 2, r, 0xFFu);
    }
  }

  /* 3. 0x6FD71FF0: ITEMS_ReturnZero */
  {
    Std0 fn = (Std0)RVA(0x6FD71FF0);
    const char *cids[4] = { "call_0", "call_1", "call_2", "call_3" };
    for (int i = 0; i < 4; i++) {
      reset_arena();
      uint32_t r = fn();
      emit_record(fp, 0x6FD71FF0, "ITEMS_ReturnZero", cids[i], NULL, 0, r, 0xFFFFFFFFu);
    }
  }

  /* 4. 0x6FD72590: ITEMS_GetAutoAffixData */
  {
    Std3 fn = (Std3)RVA(0x6FD72590);
    const char *cids[5] = { "valid_1", "valid_2", "null_unit", "non_item", "null_data" };
    for (int i = 0; i < 5; i++) {
      reset_arena();
      uint32_t u = 0, d = 0;
      setup_item_unit(i <= 1 ? 0 : (i - 1), &u, &d);
      w32(d + 0x1C, i == 0 ? 0x11223344u : 0xCAFEBABEu);
      w32(d + 0x20, i == 0 ? 0x55667788u : 0x87654321u);
      uint32_t out1C = PTR(0x500), out20 = PTR(0x504);
      w32(out1C, 0xDEAD1111u);
      w32(out20, 0xBEEF2222u);
      track_block(PTR(0x100), 0x20);
      track_block(d, 0x30);
      track_block(out1C, 8);
      uint32_t a[3] = { u, out1C, out20 };
      fn(a[0], a[1], a[2]);
      emit_record(fp, 0x6FD72590, "ITEMS_GetAutoAffixData", cids[i], a, 3, 0, 0);
    }
  }

  /* 6. 0x6FD72F80: ITEMS_GetItemTypeNormal */
  {
    Std1 fn = (Std1)RVA(0x6FD72F80);
    uint32_t *pSgpt = (uint32_t *)RVA(0x6FDE9E1C);
    uint32_t savedSgpt = *pSgpt;
    const char *cids[5] = { "neg_id", "oob_id", "valid_normal_1", "valid_normal_0", "null_table" };
    for (int i = 0; i < 5; i++) {
      reset_arena();
      uint32_t dt = PTR(0x1000);
      uint32_t tbl = (i == 4) ? 0u : PTR(0x2000);
      *pSgpt = dt;
      w32(dt + 0xBF8, tbl);
      w32(dt + 0xBFC, 4u);
      if (tbl != 0) {
        w8(tbl + 2u * 0xE4u + 0x10u, 1u);
        w8(tbl + 1u * 0xE4u + 0x10u, 0u);
      }
      uint32_t arg = 0;
      if (i == 0) arg = (uint32_t)-1;
      else if (i == 1) arg = 4u;
      else if (i == 2) arg = 2u;
      else if (i == 3) arg = 1u;
      else arg = 0u;

      track_block((uint32_t)RVA(0x6FDE9E1C), 4);
      track_block(dt + 0xBF8, 8);
      if (tbl != 0) track_block(tbl, 4u * 0xE4u);
      uint32_t a[1] = { arg };
      uint32_t r = fn(a[0]);
      emit_record(fp, 0x6FD72F80, "ITEMS_GetItemTypeNormal", cids[i], a, 1, r, 0xFFFFFFFFu);
    }
    *pSgpt = savedSgpt;
  }

  /* 7. 0x6FD72FC0: ITEMS_AccumulateItemLevelReq */
  {
    const char *cids[6] = {
      "null_txt",
      "no_class_use_base",
      "null_unit_use_base",
      "class_mismatch_use_base",
      "class_match_use_class_req",
      "cur_higher_kept"
    };
    for (int i = 0; i < 6; i++) {
      reset_arena();
      uint32_t txt = (i == 0) ? 0u : PTR(0x100);
      uint32_t unit = (i <= 2) ? 0u : PTR(0x300);
      uint32_t curReq = (i == 5) ? 40u : 12u;
      if (txt != 0) {
        w8(txt + 0x65, 25u);
        w8(txt + 0x67, (i == 1) ? 0xFFu : 3u);
        w8(txt + 0x68, 18u);
        track_block(txt + 0x60, 0x10);
      }
      if (unit != 0) {
        w32(unit + 0x04, (i == 3) ? 2u : 3u);
        track_block(unit, 0x10);
      }
      uint32_t a[3] = { curReq, txt, unit };
      uint32_t r = call_eax_ecx_edx_ret(RVA(0x6FD72FC0), a[0], a[1], a[2]);
      emit_record(fp, 0x6FD72FC0, "ITEMS_AccumulateItemLevelReq", cids[i], a, 3, r, 0xFFFFFFFFu);
    }
  }

  /* 8. 0x6FD735D0: ITEMS_GetItemTypeShoots */
  {
    Std1 fn = (Std1)RVA(0x6FD735D0);
    uint32_t *pSgpt = (uint32_t *)RVA(0x6FDE9E1C);
    uint32_t savedSgpt = *pSgpt;
    const char *cids[5] = { "neg_id", "oob_id", "shoots_neg1", "shoots_35", "null_table" };
    for (int i = 0; i < 5; i++) {
      reset_arena();
      uint32_t dt = PTR(0x1000);
      uint32_t tbl = (i == 4) ? 0u : PTR(0x2000);
      *pSgpt = dt;
      w32(dt + 0xBF8, tbl);
      w32(dt + 0xBFC, 4u);
      if (tbl != 0) {
        w16(tbl + 2u * 0xE4u + 0x0Eu, 0xFFFFu);
        w16(tbl + 1u * 0xE4u + 0x0Eu, 35u);
      }
      uint32_t arg = 0;
      if (i == 0) arg = (uint32_t)-1;
      else if (i == 1) arg = 4u;
      else if (i == 2) arg = 2u;
      else if (i == 3) arg = 1u;
      else arg = 0u;

      track_block((uint32_t)RVA(0x6FDE9E1C), 4);
      track_block(dt + 0xBF8, 8);
      if (tbl != 0) track_block(tbl, 4u * 0xE4u);
      uint32_t a[1] = { arg };
      uint32_t r = fn(a[0]);
      emit_record(fp, 0x6FD735D0, "ITEMS_GetItemTypeShoots", cids[i], a, 1, r, 0xFFFFFFFFu);
    }
    *pSgpt = savedSgpt;
  }

  /* 9. 0x6FD73650: ITEMS_SetVarGfxIndex */
  {
    Std2 fn = (Std2)RVA(0x6FD73650);
    const char *cids[5] = { "valid_ab", "valid_00", "null_unit", "non_item", "null_data" };
    for (int i = 0; i < 5; i++) {
      reset_arena();
      uint32_t u = 0, d = 0;
      setup_item_unit(i <= 1 ? 0 : (i - 1), &u, &d);
      track_block(PTR(0x100), 0x20);
      track_block(d, 0x74);
      uint32_t a[2] = { u, (i == 0) ? 0x1ABu : 0u };
      fn(a[0], a[1]);
      emit_record(fp, 0x6FD73650, "ITEMS_SetVarGfxIndex", cids[i], a, 2, 0, 0);
    }
  }

  /* 10. 0x6FD73690: ITEMS_SetEarLevel */
  {
    Std2 fn = (Std2)RVA(0x6FD73690);
    const char *cids[5] = { "valid_85", "valid_00", "null_unit", "non_item", "null_data" };
    for (int i = 0; i < 5; i++) {
      reset_arena();
      uint32_t u = 0, d = 0;
      setup_item_unit(i <= 1 ? 0 : (i - 1), &u, &d);
      track_block(PTR(0x100), 0x20);
      track_block(d, 0x74);
      uint32_t a[2] = { u, (i == 0) ? 85u : 0u };
      fn(a[0], a[1]);
      emit_record(fp, 0x6FD73690, "ITEMS_SetEarLevel", cids[i], a, 2, 0, 0);
    }
  }

  /* 11. 0x6FD736B0: ITEMS_GetEarLevel */
  {
    Std1 fn = (Std1)RVA(0x6FD736B0);
    const char *cids[5] = { "valid_99", "valid_00", "null_unit", "non_item", "null_data" };
    for (int i = 0; i < 5; i++) {
      reset_arena();
      uint32_t u = 0, d = 0;
      setup_item_unit(i <= 1 ? 0 : (i - 1), &u, &d);
      w8(d + 0x48, (i == 0) ? 99u : 0u);
      track_block(PTR(0x100), 0x20);
      track_block(d, 0x74);
      uint32_t a[1] = { u };
      uint32_t r = fn(a[0]);
      emit_record(fp, 0x6FD736B0, "ITEMS_GetEarLevel", cids[i], a, 1, r, 0xFFu);
    }
  }

  /* 12. 0x6FD736D0: ITEMS_SetEarName */
  {
    Std2 fn = (Std2)RVA(0x6FD736D0);
    const char *cids[5] = { "valid_hero", "valid_empty", "null_unit", "non_item", "null_data" };
    for (int i = 0; i < 5; i++) {
      reset_arena();
      uint32_t u = 0, d = 0;
      setup_item_unit(i <= 1 ? 0 : (i - 1), &u, &d);
      uint32_t sz = PTR(0x500);
      if (i == 1) {
        strcpy((char *)(uintptr_t)sz, "");
      } else {
        strcpy((char *)(uintptr_t)sz, "Hero");
      }
      track_block(PTR(0x100), 0x20);
      track_block(d, 0x74);
      track_block(sz, 16);
      uint32_t a[2] = { u, sz };
      fn(a[0], a[1]);
      emit_record(fp, 0x6FD736D0, "ITEMS_SetEarName", cids[i], a, 2, 0, 0);
    }
  }

  /* 13. 0x6FD73700: ITEMS_GetEarName */
  {
    Std1 fn = (Std1)RVA(0x6FD73700);
    const char *cids[4] = { "valid_item", "null_unit", "non_item", "null_data" };
    for (int i = 0; i < 4; i++) {
      reset_arena();
      uint32_t u = 0, d = 0;
      setup_item_unit(i, &u, &d);
      track_block(PTR(0x100), 0x20);
      track_block(d, 0x74);
      uint32_t a[1] = { u };
      uint32_t r = fn(a[0]);
      emit_record(fp, 0x6FD73700, "ITEMS_GetEarName", cids[i], a, 1, r, 0xFFFFFFFFu);
    }
  }

  /* 14. 0x6FD73720: ITEMS_SetNodePage */
  {
    Std2 fn = (Std2)RVA(0x6FD73720);
    const char *cids[5] = { "valid_3", "valid_0", "null_unit", "non_item", "null_data" };
    for (int i = 0; i < 5; i++) {
      reset_arena();
      uint32_t u = 0, d = 0;
      setup_item_unit(i <= 1 ? 0 : (i - 1), &u, &d);
      track_block(PTR(0x100), 0x20);
      track_block(d, 0x74);
      uint32_t a[2] = { u, (i == 0) ? 3u : 0u };
      fn(a[0], a[1]);
      emit_record(fp, 0x6FD73720, "ITEMS_SetNodePage", cids[i], a, 2, 0, 0);
    }
  }

  /* 15. 0x6FD73740: ITEMS_GetNodePage */
  {
    Std1 fn = (Std1)RVA(0x6FD73740);
    const char *cids[5] = { "valid_2", "valid_0", "null_unit", "non_item", "null_data" };
    for (int i = 0; i < 5; i++) {
      reset_arena();
      uint32_t u = 0, d = 0;
      setup_item_unit(i <= 1 ? 0 : (i - 1), &u, &d);
      w8(d + 0x47, (i == 0) ? 2u : 0u);
      track_block(PTR(0x100), 0x20);
      track_block(d, 0x74);
      uint32_t a[1] = { u };
      uint32_t r = fn(a[0]);
      emit_record(fp, 0x6FD73740, "ITEMS_GetNodePage", cids[i], a, 1, r, 0xFFu);
    }
  }

  /* 16. 0x6FD73760: ITEMS_SetCmdFlagsByte */
  {
    Std2 fn = (Std2)RVA(0x6FD73760);
    const char *cids[5] = { "valid_5a", "valid_00", "null_unit", "non_item", "null_data" };
    for (int i = 0; i < 5; i++) {
      reset_arena();
      uint32_t u = 0, d = 0;
      setup_item_unit(i <= 1 ? 0 : (i - 1), &u, &d);
      track_block(PTR(0x100), 0x20);
      track_block(d, 0x74);
      uint32_t a[2] = { u, (i == 0) ? 0x5Au : 0u };
      fn(a[0], a[1]);
      emit_record(fp, 0x6FD73760, "ITEMS_SetCmdFlagsByte", cids[i], a, 2, 0, 0);
    }
  }

  /* 17. 0x6FD737C0: ITEMS_GetInvPage */
  {
    Std1 fn = (Std1)RVA(0x6FD737C0);
    const char *cids[5] = { "valid_4", "valid_0", "null_unit", "non_item", "null_data" };
    for (int i = 0; i < 5; i++) {
      reset_arena();
      uint32_t u = 0, d = 0;
      setup_item_unit(i <= 1 ? 0 : (i - 1), &u, &d);
      w8(d + 0x45, (i == 0) ? 4u : 0u);
      track_block(PTR(0x100), 0x20);
      track_block(d, 0x74);
      uint32_t a[1] = { u };
      uint32_t r = fn(a[0]);
      emit_record(fp, 0x6FD737C0, "ITEMS_GetInvPage", cids[i], a, 1, r, 0xFFu);
    }
  }

  /* 18. 0x6FD737E0: ITEMS_SetItemLevel */
  {
    Std2 fn = (Std2)RVA(0x6FD737E0);
    const char *cids[7] = { "valid_85", "valid_1", "clamp_0", "clamp_neg", "null_unit", "non_item", "null_data" };
    const uint32_t lvls[7] = { 85u, 1u, 0u, (uint32_t)-5, 50u, 50u, 50u };
    for (int i = 0; i < 7; i++) {
      reset_arena();
      uint32_t u = 0, d = 0;
      setup_item_unit(i <= 3 ? 0 : (i - 3), &u, &d);
      track_block(PTR(0x100), 0x20);
      track_block(d, 0x74);
      uint32_t a[2] = { u, lvls[i] };
      fn(a[0], a[1]);
      emit_record(fp, 0x6FD737E0, "ITEMS_SetItemLevel", cids[i], a, 2, 0, 0);
    }
  }

  /* 19. 0x6FD73810: ITEMS_GetItemLevel */
  {
    Std1 fn = (Std1)RVA(0x6FD73810);
    const char *cids[7] = { "valid_50", "valid_1", "clamp_0", "clamp_neg", "null_unit", "non_item", "null_data" };
    const uint32_t lvls[7] = { 50u, 1u, 0u, (uint32_t)-10, 50u, 50u, 50u };
    for (int i = 0; i < 7; i++) {
      reset_arena();
      uint32_t u = 0, d = 0;
      setup_item_unit(i <= 3 ? 0 : (i - 3), &u, &d);
      w32(d + 0x2C, lvls[i]);
      track_block(PTR(0x100), 0x20);
      track_block(d, 0x74);
      uint32_t a[1] = { u };
      uint32_t r = fn(a[0]);
      emit_record(fp, 0x6FD73810, "ITEMS_GetItemLevel", cids[i], a, 1, r, 0xFFFFFFFFu);
    }
  }

  /* 20. 0x6FD73870: ITEMS_SetItemFlag */
  {
    Std3 fn = (Std3)RVA(0x6FD73870);
    const char *cids[5] = { "set_bit", "clear_bit", "null_unit", "non_item", "null_data" };
    for (int i = 0; i < 5; i++) {
      reset_arena();
      uint32_t u = 0, d = 0;
      setup_item_unit(i <= 1 ? 0 : (i - 1), &u, &d);
      w32(d + 0x14, (i == 0) ? 0x01u : 0x11u);
      track_block(PTR(0x100), 0x20);
      track_block(d, 0x74);
      uint32_t a[3] = { u, 0x10u, (i == 0) ? 1u : 0u };
      fn(a[0], a[1], a[2]);
      emit_record(fp, 0x6FD73870, "ITEMS_SetItemFlag", cids[i], a, 3, 0, 0);
    }
  }

  /* 21. 0x6FD738B0: ITEMS_CheckItemFlag */
  {
    Std2 fn = (Std2)RVA(0x6FD738B0);
    const char *cids[5] = { "flag_hit", "flag_miss", "null_unit", "non_item", "null_data" };
    for (int i = 0; i < 5; i++) {
      reset_arena();
      uint32_t u = 0, d = 0;
      setup_item_unit(i <= 1 ? 0 : (i - 1), &u, &d);
      w32(d + 0x14, 0x00400010u);
      track_block(PTR(0x100), 0x20);
      track_block(d, 0x74);
      uint32_t a[2] = { u, (i == 1) ? 0x20u : 0x10u };
      uint32_t r = fn(a[0], a[1]);
      emit_record(fp, 0x6FD738B0, "ITEMS_CheckItemFlag", cids[i], a, 2, r, 0xFFFFFFFFu);
    }
  }

  /* 22. 0x6FD738E0: ITEMS_GetCommandFlags */
  {
    Std1 fn = (Std1)RVA(0x6FD738E0);
    const char *cids[5] = { "valid_nonzero", "valid_zero", "null_unit", "non_item", "null_data" };
    for (int i = 0; i < 5; i++) {
      reset_arena();
      uint32_t u = 0, d = 0;
      setup_item_unit(i <= 1 ? 0 : (i - 1), &u, &d);
      w32(d + 0x18, (i == 0) ? 0x12345678u : 0u);
      track_block(PTR(0x100), 0x20);
      track_block(d, 0x74);
      uint32_t a[1] = { u };
      uint32_t r = fn(a[0]);
      emit_record(fp, 0x6FD738E0, "ITEMS_GetCommandFlags", cids[i], a, 1, r, 0xFFFFFFFFu);
    }
  }
}

static void emit_aabb_helper(FILE *fp, uint32_t va, const char *name, uint32_t tableVa, int linkedAt3) {
  Fast2 fn = (Fast2)RVA(va);
  const char *cids[9] = {
    "iter_zero",
    "skip_linked_overlap",
    "no_overlap_lt_lt",
    "no_overlap_ge_ge_touch_y",
    "overlap_lt_ge",
    "overlap_ge_lt",
    "no_overlap_lt_touch_x",
    "no_overlap_ge_touch_x",
    "no_overlap_lt_touch_y"
  };
  for (int c = 0; c < 9; c++) {
    reset_arena();
    uint32_t pLinkData = PTR(0x100);
    uint32_t nIter = (c == 0) ? 0u : 3u;
    /* Set up boxes 0, 1, 2 at safe non-overlapping coordinates by default */
    for (int i = 0; i < 4; i++) {
      uint32_t box = pLinkData + 0x08 + (uint32_t)i * 16u;
      w32(box + 0x00, (uint32_t)(i * 200));
      w32(box + 0x04, (uint32_t)(i * 200));
      w32(box + 0x08, 20u);
      w32(box + 0x0C, 20u);
    }
    uint32_t curBox = pLinkData + 0x08 + 3u * 16u;
    uint32_t nonLinked = (linkedAt3 == 1) ? 0u : 1u;
    uint32_t b = pLinkData + 0x08 + nonLinked * 16u;
    if (c == 1) {
      uint32_t lBox = pLinkData + 0x08 + (uint32_t)linkedAt3 * 16u;
      w32(curBox + 0x00, *(uint32_t *)(uintptr_t)(lBox + 0x00));
      w32(curBox + 0x04, *(uint32_t *)(uintptr_t)(lBox + 0x04));
      w32(curBox + 0x08, 20u);
      w32(curBox + 0x0C, 20u);
    } else if (c == 2) {
      /* xCur < xOther, yCur < yOther, no overlap */
      w32(curBox + 0x00, 10u);
      w32(curBox + 0x04, 10u);
      w32(curBox + 0x08, 10u);
      w32(curBox + 0x0C, 10u);
      for (int i = 0; i < 3; i++) {
        uint32_t bi = pLinkData + 0x08 + (uint32_t)i * 16u;
        w32(bi + 0x00, (uint32_t)(50 + i * 50));
        w32(bi + 0x04, (uint32_t)(50 + i * 50));
        w32(bi + 0x08, 10u);
        w32(bi + 0x0C, 10u);
      }
    } else if (c == 3) {
      /* xCur >= xOther, yCur >= yOther, gapX < 0, gapY == 0 (touching Y edge -> no overlap) */
      w32(b + 0x00, 100u);
      w32(b + 0x04, 100u);
      w32(b + 0x08, 30u);
      w32(b + 0x0C, 20u);
      w32(curBox + 0x00, 110u); /* xCur >= xOther, gapX = 110 - 30 - 100 = -20 < 0 */
      w32(curBox + 0x04, 120u); /* yCur >= yOther, gapY = 120 - 20 - 100 = 0 >= 0 */
      w32(curBox + 0x08, 20u);
      w32(curBox + 0x0C, 20u);
    } else if (c == 4) {
      /* Overlap on non-linked box with xCur < xOther, yCur >= yOther */
      w32(b + 0x00, 110u);
      w32(b + 0x04, 100u);
      w32(b + 0x08, 30u);
      w32(b + 0x0C, 30u);
      w32(curBox + 0x00, 100u); /* xCur < xOther, gapX = 110 - 30 - 100 = -20 < 0 */
      w32(curBox + 0x04, 110u); /* yCur >= yOther, gapY = 110 - 30 - 100 = -20 < 0 */
      w32(curBox + 0x08, 30u);
      w32(curBox + 0x0C, 30u);
    } else if (c == 5) {
      /* Overlap on non-linked box with xCur >= xOther, yCur < yOther */
      w32(b + 0x00, 100u);
      w32(b + 0x04, 110u);
      w32(b + 0x08, 30u);
      w32(b + 0x0C, 30u);
      w32(curBox + 0x00, 110u); /* xCur >= xOther, gapX = -20 < 0 */
      w32(curBox + 0x04, 100u); /* yCur < yOther, gapY = -20 < 0 */
      w32(curBox + 0x08, 30u);
      w32(curBox + 0x0C, 30u);
    } else if (c == 6) {
      /* xCur < xOther, gapX == 0 (touching X edge -> no overlap) */
      w32(b + 0x00, 120u);
      w32(b + 0x04, 100u);
      w32(b + 0x08, 20u);
      w32(b + 0x0C, 20u);
      w32(curBox + 0x00, 100u); /* xCur < xOther, gapX = 120 - 20 - 100 = 0 */
      w32(curBox + 0x04, 100u);
      w32(curBox + 0x08, 20u);
      w32(curBox + 0x0C, 20u);
    } else if (c == 7) {
      /* xCur >= xOther, gapX == 0 (touching X edge -> no overlap) */
      w32(b + 0x00, 100u);
      w32(b + 0x04, 100u);
      w32(b + 0x08, 20u);
      w32(b + 0x0C, 20u);
      w32(curBox + 0x00, 120u); /* xCur >= xOther, gapX = 120 - 20 - 100 = 0 */
      w32(curBox + 0x04, 100u);
      w32(curBox + 0x08, 20u);
      w32(curBox + 0x0C, 20u);
    } else if (c == 8) {
      /* yCur < yOther, gapX < 0, gapY == 0 (touching Y edge -> no overlap) */
      w32(b + 0x00, 100u);
      w32(b + 0x04, 120u);
      w32(b + 0x08, 20u);
      w32(b + 0x0C, 20u);
      w32(curBox + 0x00, 100u); /* xCur == xOther -> gapX = -20 < 0 */
      w32(curBox + 0x04, 100u); /* yCur < yOther -> gapY = 120 - 20 - 100 = 0 */
      w32(curBox + 0x08, 20u);
      w32(curBox + 0x0C, 20u);
    }
    track_block((uint32_t)RVA(tableVa), 240);
    track_block(pLinkData, 0x60);
    uint32_t a[2] = { pLinkData, nIter };
    uint32_t r = fn(a[0], a[1]);
    emit_record(fp, va, name, cids[c], a, 2, r, 0xFFFFFFFFu);
  }
}

static void emit_b018(FILE *fp) {
  /* 1. 0x6FD5E430: DRLG_ReplacePresetRoom */
  {
    const char *cids[5] = { "empty_list", "match_second_set_bit1", "match_second_clear_bit1", "no_match", "match_first" };
    for (int c = 0; c < 5; c++) {
      reset_arena();
      uint32_t lvl = PTR(0x100);
      uint32_t r1 = PTR(0x400), d1 = PTR(0x500);
      uint32_t r2 = PTR(0x600), d2 = PTR(0x700);
      w32(r1 + 0x20, d1);
      w32(r1 + 0x24, r2);
      w32(r2 + 0x20, d2);
      w32(r2 + 0x24, 0u);
      if (c == 0) {
        w32(lvl + 0x10, 0u);
      } else if (c == 1 || c == 2) {
        w32(lvl + 0x10, r1);
        w32(d1 + 0x00, 0x2C5u);
        w32(d1 + 0x0C, 0x02u); /* bit 1 set -> skipped */
        w32(d2 + 0x00, 0x2C5u);
        w32(d2 + 0x0C, 0x04u); /* bit 1 clear -> matched */
      } else if (c == 3) {
        w32(lvl + 0x10, r1);
        w32(d1 + 0x00, 0x100u);
        w32(d1 + 0x0C, 0u);
        w32(d2 + 0x00, 0x101u);
        w32(d2 + 0x0C, 0u);
      } else {
        w32(lvl + 0x10, r1);
        w32(d1 + 0x00, 0x2C5u);
        w32(d1 + 0x0C, 0u);
      }
      track_block(lvl, 0x30);
      track_block(r1, 0x30);
      track_block(d1, 0x18);
      track_block(r2, 0x30);
      track_block(d2, 0x18);
      uint32_t a[5] = { lvl, 0x2C5u, 0x2DFu, 0xFFFFFFFFu, (c == 2) ? 1u : 0u };
      uint32_t r = call_6FD5E430(a[0], a[1], a[2], a[3], a[4]);
      emit_record(fp, 0x6FD5E430, "DRLG_ReplacePresetRoom", cids[c], a, 5, r, 0xFFFFFFFFu);
    }
  }

  /* 2. 0x6FD5E700: DRLG_RandomizePresetRooms */
  {
    Fast1 fn = (Fast1)RVA(0x6FD5E700);
    const uint32_t ltypes[15] = { 2u, 26u, 5u, 3u, 3u, 3u, 4u, 7u, 8u, 10u, 13u, 17u, 22u, 24u, 25u };
    const uint32_t bases[15] = { 0u, 0u, 0u, 0x34u, 0x34u, 0x34u, 0x6Cu, 0xA7u, 0xCDu, 0x101u, 0x12Du, 0x19Du, 0x2F1u, 0x298u, 0x2C0u };
    const char *cids[15] = {
      "lt_2_oob", "lt_26_oob", "lt_5_default", "lt_3_lvl8_skip", "lt_3_zero_rooms",
      "lt_3_replace", "lt_4_exhaust_attempts", "lt_7", "lt_8",
      "lt_10", "lt_13", "lt_17", "lt_22", "lt_24", "lt_25"
    };
    for (int c = 0; c < 15; c++) {
      reset_arena();
      uint32_t lvl = PTR(0x100);
      w32(lvl + 0x1C0, ltypes[c]);
      w32(lvl + 0x1C4, 1u);
      w32(lvl + 0x1C8, 0u);
      w32(lvl + 0x1D0, (c == 3) ? 8u : 2u);
      if (c == 4) {
        w32(lvl + 0x08, 0u);
        w32(lvl + 0x10, 0u);
      } else if (c == 6) {
        w32(lvl + 0x08, 1u);
        w32(lvl + 0x10, 0u);
      } else {
        w32(lvl + 0x08, 5u);
        uint32_t r0 = PTR(0x400), d0 = PTR(0x500);
        uint32_t r1 = PTR(0x600), d1 = PTR(0x700);
        uint32_t r2 = PTR(0x800), d2 = PTR(0x900);
        w32(lvl + 0x10, r0);
        w32(r0 + 0x20, d0);
        w32(r0 + 0x24, r1);
        w32(d0 + 0x00, bases[c] + 0u);
        w32(d0 + 0x0C, 2u); /* bit 1 already set -> skipped */
        w32(r1 + 0x20, d1);
        w32(r1 + 0x24, r2);
        w32(d1 + 0x00, bases[c] + 0u); /* matches curIdx=0 (arr[0]=0) */
        w32(d1 + 0x0C, 0u);
        w32(r2 + 0x20, d2);
        w32(r2 + 0x24, 0u);
        w32(d2 + 0x00, bases[c] + 12u); /* matches curIdx=1 (arr[1]=12) */
        w32(d2 + 0x0C, 0u);
        track_block(r0, 0x30);
        track_block(d0, 0x18);
        track_block(r1, 0x30);
        track_block(d1, 0x18);
        track_block(r2, 0x30);
        track_block(d2, 0x18);
      }
      track_block(lvl, 0x1E0);
      uint32_t a[1] = { lvl };
      fn(a[0]);
      emit_record(fp, 0x6FD5E700, "DRLG_RandomizePresetRooms", cids[c], a, 1, 0, 0);
    }
  }

  /* 3. 0x6FD63FD0: DRLG_ApplyOutdoorVertexFlags */
  {
    Fast3 fn = (Fast3)RVA(0x6FD63FD0);
    const uint32_t drlgTypes[7] = { 1u, 3u, 3u, 3u, 3u, 3u, 3u };
    const uint32_t lvlIds[7]    = { 4u, 4u, 2u, 17u, 2u, 2u, 2u };
    const uint32_t dir0s[7]     = { 1u, 1u, 1u, 2u, 2u, 0u, 3u };
    const uint32_t dir1s[7]     = { 0u, 0u, 0u, 1u, 2u, 1u, 2u };
    const char *cids[7] = {
      "non_outdoor", "rule0_hit", "rule0_excl1", "rule2_excl2", "rules_7_13_hit", "rule10_hit", "rules_9_14_hit"
    };
    for (int c = 0; c < 7; c++) {
      reset_arena();
      uint32_t lvl = PTR(0x100);
      uint32_t outInfo = PTR(0x400);
      uint32_t dirArr = PTR(0x500);
      w32(lvl + 0x00, drlgTypes[c]);
      w32(lvl + 0x14, outInfo);
      w32(lvl + 0x1D0, lvlIds[c]);
      w32(outInfo + 0x00, 0x01u);
      w32(dirArr + 2u * 4u, dir0s[c]);
      w32(dirArr + 3u * 4u, dir1s[c]);
      track_block((uint32_t)RVA(0x6FDE5350), 360);
      track_block(lvl, 0x1E0);
      track_block(outInfo, 0x10);
      track_block(dirArr, 0x20);
      uint32_t a[3] = { lvl, 2u, dirArr };
      fn(a[0], a[1], a[2]);
      emit_record(fp, 0x6FD63FD0, "DRLG_ApplyOutdoorVertexFlags", cids[c], a, 3, 0, 0);
    }
  }

  /* 4. 0x6FD644C0: DRLG_LinkOutdoorLevels */
  {
    Fast1 fn = (Fast1)RVA(0x6FD644C0);
    const char *cids[6] = { "iter_2_dir0", "iter_1_dir0", "alias_dir1", "alias_dir2", "alias_dir3", "alias_dir4_gt3" };
    for (int c = 0; c < 6; c++) {
      reset_arena();
      uint32_t ld = PTR(0x100);
      uint32_t pLink = PTR(0x400);
      w32(ld + 0xF8, pLink);
      /* Box 0 (at ld + 0x08) and Box 1 (at ld + 0x18) and Box 2 (at ld + 0x28) */
      w32(ld + 0x08 + 0x00, 10u); w32(ld + 0x08 + 0x04, 20u); w32(ld + 0x08 + 0x08, 30u); w32(ld + 0x08 + 0x0C, 40u);
      w32(ld + 0x18 + 0x00, 100u); w32(ld + 0x18 + 0x04, 200u); w32(ld + 0x18 + 0x08, 50u); w32(ld + 0x18 + 0x0C, 60u);
      w32(ld + 0x28 + 0x00, 300u); w32(ld + 0x28 + 0x04, 400u); w32(ld + 0x28 + 0x08, 70u); w32(ld + 0x28 + 0x0C, 80u);
      w32(pLink + 0u * 16u + 0x08, 1u);
      w32(pLink + 1u * 16u + 0x08, 0u);
      w32(pLink + 2u * 16u + 0x08, 1u);
      if (c == 0) {
        w32(ld + 0x1EC, 2u);
        w32(ld + 0xFC + 2u * 4u, 99u);
        w32(ld + 0x138 + 2u * 4u, 88u);
      } else if (c == 1) {
        w32(ld + 0x1EC, 1u);
        w32(ld + 0xFC + 1u * 4u, 77u);
        w32(ld + 0x138 + 1u * 4u, 66u);
      } else {
        /* nIteration = 45 (0x2D) aliases ld + 45*4 + 0x138 == ld + 0x1EC, zeroing nIteration on first write
           so second read uses nIter=0 and copies nRand1[0] into nRand0[0] */
        w32(ld + 0x1EC, 45u);
        w32(ld + 0x138 + 0u, (uint32_t)(c - 1)); /* 1, 2, 3, 4 */
      }
      track_block(ld, 0x200);
      track_block(pLink, 0x40);
      uint32_t a[1] = { ld };
      uint32_t r = fn(a[0]);
      emit_record(fp, 0x6FD644C0, "DRLG_LinkOutdoorLevels", cids[c], a, 1, r, 0xFFFFFFFFu);
    }
  }

  /* 5. 0x6FD645A0: DRLG_GetLevelBorderStyle */
  {
    const uint32_t ltypes[10] = { 2u, 2u, 2u, 16u, 27u, 31u, 31u, 3u, 1u, 32u };
    const uint32_t lids[10]   = { 2u, 2u, 2u, 2u, 2u, 0x75u, 115u, 2u, 2u, 2u };
    const uint32_t flags[10]  = { 0u, 1u, 0x100u, 0u, 0u, 0u, 0u, 0u, 0u, 0u };
    const char *cids[10] = {
      "lt2_flag0", "lt2_flag1", "lt2_flag0x100_low0", "lt16", "lt27", "lt31_id117", "lt31_id115", "lt3_default", "lt1_oob", "lt32_oob"
    };
    for (int c = 0; c < 10; c++) {
      reset_arena();
      uint32_t lvl = PTR(0x100);
      w32(lvl + 0x1C0, ltypes[c]);
      w32(lvl + 0x1D0, lids[c]);
      track_block(lvl, 0x1E0);
      uint32_t a[2] = { lvl, flags[c] };
      uint32_t r = call_6FD645A0(a[0], a[1]);
      emit_record(fp, 0x6FD645A0, "DRLG_GetLevelBorderStyle", cids[c], a, 2, r, 0xFFFFFFFFu);
    }
  }

  /* 6..10. 0x6FD64630..0x6FD64870: 5 AABB overlap callbacks */
  emit_aabb_helper(fp, 0x6FD64630, "DRLG_CheckAct1LinkOverlap", 0x6FDDD190u, 0);
  emit_aabb_helper(fp, 0x6FD646C0, "DRLG_CheckAct1WildLinkOverlap", 0x6FDDD0A0u, 2);
  emit_aabb_helper(fp, 0x6FD64750, "DRLG_CheckAct2LinkOverlap", 0x6FDDCFB0u, 0);
  emit_aabb_helper(fp, 0x6FD647E0, "DRLG_CheckAct4LinkOverlap", 0x6FDDCEC0u, 0);
  emit_aabb_helper(fp, 0x6FD64870, "DRLG_CheckMonasteryLinkOverlap", 0x6FDDCDD0u, 2);

  /* 11. 0x6FD6A270: DATATBLS_GetDirectionOffset */
  {
    Std3 fn = (Std3)RVA(0x6FD6A270);
    const uint32_t dirs[5] = { 0u, 1u, 10u, 25u, 31u };
    const char *cids[5] = { "dir_0", "dir_1", "dir_10", "dir_25", "dir_31" };
    for (int c = 0; c < 5; c++) {
      reset_arena();
      uint32_t outX = PTR(0x100), outY = PTR(0x104);
      w32(outX, 0xDEADu);
      w32(outY, 0xBEEFu);
      track_block((uint32_t)RVA(0x6FDE4EC4), 64);
      track_block(outX, 8);
      uint32_t a[3] = { dirs[c], outX, outY };
      fn(a[0], a[1], a[2]);
      emit_record(fp, 0x6FD6A270, "DATATBLS_GetDirectionOffset", cids[c], a, 3, 0, 0);
    }
  }

  /* 12. 0x6FD6A2B0: DATATBLS_NormalizeDirection */
  {
    Std1 fn = (Std1)RVA(0x6FD6A2B0);
    const uint32_t dirs[7] = { 0u, 5u, 15u, 22u, 30u, 32u, 0x105u };
    const char *cids[7] = { "dir_0", "dir_5", "dir_15", "dir_22", "dir_30", "dir_32", "dir_0x105_u8_mask" };
    for (int c = 0; c < 7; c++) {
      reset_arena();
      track_block((uint32_t)RVA(0x6FDEF0B0), 64);
      uint32_t a[1] = { dirs[c] };
      uint32_t r = fn(a[0]);
      emit_record(fp, 0x6FD6A2B0, "DATATBLS_NormalizeDirection", cids[c], a, 1, r, 0xFFu);
    }
  }

  /* 13. 0x6FD6A3C0: DATATBLS_UnusedStub10182 */
  {
    Std2 fn = (Std2)RVA(0x6FD6A3C0);
    const uint32_t a0s[4] = { 0u, 1u, 0x1234u, 0xFFFFFFFFu };
    const uint32_t a1s[4] = { 0u, 2u, 0x5678u, 0x80000000u };
    const char *cids[4] = { "stub_0", "stub_1", "stub_2", "stub_3" };
    for (int c = 0; c < 4; c++) {
      reset_arena();
      uint32_t a[2] = { a0s[c], a1s[c] };
      fn(a[0], a[1]);
      emit_record(fp, 0x6FD6A3C0, "DATATBLS_UnusedStub10182", cids[c], a, 2, 0, 0);
    }
  }

  /* 14. 0x6FD6A520: MONSTERS_IsDead */
  {
    Std1 fn = (Std1)RVA(0x6FD6A520);
    const char *cids[5] = { "null_unit", "non_monster", "mode_0_death", "mode_12_dead", "mode_1_alive" };
    for (int c = 0; c < 5; c++) {
      reset_arena();
      uint32_t u = (c == 0) ? 0u : PTR(0x100);
      if (u != 0) {
        w32(u + 0x00, (c == 1) ? 0u : 1u);
        w32(u + 0x10, (c == 3) ? 12u : (c == 4) ? 1u : 0u);
      }
      track_block(PTR(0x100), 0x20);
      uint32_t a[1] = { u };
      uint32_t r = fn(a[0]);
      emit_record(fp, 0x6FD6A520, "MONSTERS_IsDead", cids[c], a, 1, r, 0xFFFFFFFFu);
    }
  }

  /* 15. 0x6FD6A550: MONSTERS_CheckMonStatsFlagBit6 */
  {
    Std2 fn = (Std2)RVA(0x6FD6A550);
    uint32_t *pSgpt = (uint32_t *)RVA(0x6FDE9E1C);
    uint32_t savedSgpt = *pSgpt;
    const char *cids[9] = {
      "null_unit", "non_monster", "direct_txt_set", "direct_txt_clear",
      "neg_class", "oob_class", "lookup_set", "lookup_clear", "null_base"
    };
    for (int c = 0; c < 9; c++) {
      reset_arena();
      uint32_t dt = PTR(0x1000);
      uint32_t tbl = (c == 8) ? 0u : PTR(0x2000);
      *pSgpt = dt;
      w32(dt + 0xA78, tbl);
      w32(dt + 0xA80, 4u);
      if (tbl != 0) {
        w8(tbl + 2u * 0x1A8u + 0x0Cu, 0x40u);
        w8(tbl + 3u * 0x1A8u + 0x0Cu, 0xBFu);
      }
      uint32_t u = (c == 0) ? 0u : PTR(0x100);
      uint32_t directTxt = (c == 2 || c == 3) ? PTR(0x300) : 0u;
      if (directTxt != 0) {
        w8(directTxt + 0x0C, (c == 2) ? 0x40u : 0xBFu);
        track_block(directTxt, 0x20);
      }
      if (u != 0) {
        w32(u + 0x00, (c == 1) ? 0u : 1u);
        uint32_t cid = 2u;
        if (c == 4) cid = (uint32_t)-1;
        else if (c == 5) cid = 4u;
        else if (c == 7) cid = 3u;
        else if (c == 8) cid = 0u;
        w32(u + 0x04, cid);
      }
      uint32_t bm_ptr = *(uint32_t *)(uintptr_t)RVA(0x6FDD90B0);
      track_block((uint32_t)RVA(0x6FDE9E1C), 4);
      track_block((uint32_t)RVA(0x6FDD90B0), 4);
      track_block(bm_ptr, 32);
      track_block(dt + 0xA78, 12);
      if (tbl != 0) track_block(tbl, 4u * 0x1A8u);
      track_block(PTR(0x100), 0x20);
      uint32_t a[2] = { directTxt, u };
      uint32_t r = fn(a[0], a[1]);
      emit_record(fp, 0x6FD6A550, "MONSTERS_CheckMonStatsFlagBit6", cids[c], a, 2, r, 0xFFFFFFFFu);
    }
    *pSgpt = savedSgpt;
  }

  /* 16. 0x6FD6A5B0: MONSTERS_IsDemonOrUndead */
  {
    Std1 fn = (Std1)RVA(0x6FD6A5B0);
    uint32_t *pSgpt = (uint32_t *)RVA(0x6FDE9E1C);
    uint32_t savedSgpt = *pSgpt;
    const char *cids[8] = {
      "null_unit", "non_monster", "neg_class", "oob_class", "null_base", "bit3_demon", "bit4_undead", "neither_bit"
    };
    for (int c = 0; c < 8; c++) {
      reset_arena();
      uint32_t dt = PTR(0x1000);
      uint32_t tbl = (c == 4) ? 0u : PTR(0x2000);
      *pSgpt = dt;
      w32(dt + 0xA78, tbl);
      w32(dt + 0xA80, 4u);
      if (tbl != 0) {
        w8(tbl + 1u * 0x1A8u + 0x0Du, 0x08u);
        w8(tbl + 2u * 0x1A8u + 0x0Du, 0x10u);
        w8(tbl + 3u * 0x1A8u + 0x0Du, 0xE7u);
      }
      uint32_t u = (c == 0) ? 0u : PTR(0x100);
      if (u != 0) {
        w32(u + 0x00, (c == 1) ? 0u : 1u);
        uint32_t cid = 0u;
        if (c == 2) cid = (uint32_t)-1;
        else if (c == 3) cid = 4u;
        else if (c == 4) cid = 0u;
        else if (c == 5) cid = 1u;
        else if (c == 6) cid = 2u;
        else cid = 3u;
        w32(u + 0x04, cid);
      }
      uint32_t bm_ptr = *(uint32_t *)(uintptr_t)RVA(0x6FDD90B0);
      track_block((uint32_t)RVA(0x6FDE9E1C), 4);
      track_block((uint32_t)RVA(0x6FDD90B0), 4);
      track_block(bm_ptr, 32);
      track_block(dt + 0xA78, 12);
      if (tbl != 0) track_block(tbl, 4u * 0x1A8u);
      track_block(PTR(0x100), 0x20);
      uint32_t a[1] = { u };
      uint32_t r = fn(a[0]);
      emit_record(fp, 0x6FD6A5B0, "MONSTERS_IsDemonOrUndead", cids[c], a, 1, r, 0xFFFFFFFFu);
    }
    *pSgpt = savedSgpt;
  }
}

int main(int argc, char **argv) {
  const char *out_b015 = (argc > 1) ? argv[1] : "b015-vectors.ndjson";
  const char *out_b018 = (argc > 2) ? argv[2] : "b018-vectors.ndjson";

  g_arena = (uint8_t *)VirtualAlloc((void *)ARENA_ADDR, ARENA_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if (!g_arena || (uintptr_t)g_arena != ARENA_ADDR) {
    fprintf(stderr, "VirtualAlloc at 0x%08X failed (got %p, err=%lu)\n", ARENA_ADDR, (void *)g_arena, GetLastError());
    return 2;
  }

  HMODULE hMod = LoadLibraryA("D2Common.dll");
  if (!hMod) {
    fprintf(stderr, "LoadLibraryA(D2Common.dll) failed: %lu\n", GetLastError());
    return 1;
  }
  g_base = (uintptr_t)hMod;

  FILE *fp15 = fopen(out_b015, "wb");
  if (!fp15) {
    fprintf(stderr, "fopen(%s) failed\n", out_b015);
    return 3;
  }
  emit_b015(fp15);
  fclose(fp15);

  FILE *fp18 = fopen(out_b018, "wb");
  if (!fp18) {
    fprintf(stderr, "fopen(%s) failed\n", out_b018);
    return 4;
  }
  emit_b018(fp18);
  fclose(fp18);

  printf("Emitted Lane B It4 vectors: %s and %s (D2Common base=0x%08X)\n", out_b015, out_b018, (unsigned)g_base);
  fflush(stdout);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
