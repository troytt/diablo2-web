/*
 * Standalone MinGW real-DLL differential vector emitter for K1r3 Iteration 9 Lane B:
 * - Batch I9B-B (17 D2Common.dll v1.13c functions in tables/anim-tbls-113c.ts, tables/missile-tbls-113c.ts,
 *   tables/datatbls-113c.ts and common/skills.ts)
 *
 * Loads the real Diablo II v1.13c Storm.dll, Fog.dll (image base 0x6FF50000) and D2Common.dll (image base
 * 0x6FD50000), stages deterministic synthetic records inside a scratch arena at 0x20000000, patches the
 * D2Common globals the functions read (sgptDataTables 0x6FDE9E1C, sgpAnimDataTable 0x6FDF0B4C), invokes each
 * real D2Common.dll entry point (register-only inline-asm thunks for the custom-register ABIs; no "m"
 * constraints) and writes one NDJSON line per vector: args, eax (masked), and the bytes of every staged range
 * before ("pre") and after ("post") the call.
 *
 * Build/run: tools/oracle/vectors/k1r3-laneB-it9-emit.sh
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
#define VA_ANIMDATA_TABLE    0x6FDF0B4Cu
#define VA_GDWBITMASKS_IAT   0x6FDD90B0u

/* ---- Arena layout ---- */
#define ADDR_DATATABLES      0x20001000u /* 0xD00 bytes synthetic sgptDataTables block */
/* AnimData */
#define ADDR_ANIM_TABLE      0x20010000u /* 0x4A4 bytes D2AnimDataTableStrc */
#define ADDR_ANIM_BUCKET     0x20011000u /* bucket: int32 count + 3 * 0xA0 records */
#define ADDR_ANIM_EMPTY      0x20011F00u /* empty bucket (count 0) for all other hashes */
#define ADDR_ANIM_STR        0x20012000u /* 16-byte code buffer */
#define ADDR_ANIM_OUT        0x20012100u /* 3 dwords: frames, speed, firstEvent */
/* RoomEx status lists */
#define ADDR_ROOM            0x20013000u /* D2RoomExStrc (0xEC) */
#define ADDR_LEVEL           0x20013100u /* D2DrlgLevelStrc (pDrlg at +0x1B4) */
#define ADDR_DRLG            0x20013300u /* D2DrlgStrc: +0xA0 + 5 * 0xEC sentinel nodes */
#define ADDR_OTHER_ROOM      0x20013900u /* neighbour node in the current list */
#define ADDR_TAILS           0x20013A00u /* 4 tail nodes (stride 0x100) after each sentinel */
/* Player */
#define ADDR_PUNIT           0x20014000u /* D2UnitStrc (0xF4) */
#define ADDR_PDATA           0x20014100u /* D2PlayerDataStrc (0x16C) */
/* Skills */
#define ADDR_SKILLS_TXT      0x20015000u /* 4 * 0x23C */
#define ADDR_SUNIT           0x20016000u /* D2UnitStrc (pSkills at +0xA8) */
#define ADDR_SKILL_LIST      0x20016100u /* D2SkillListStrc (0x18) */
#define ADDR_SKILLS          0x20016200u /* 3 * 0x40 D2SkillStrc */
/* Corpse predicates */
#define ADDR_MUNIT           0x20017000u /* D2UnitStrc (0xF4) */
#define ADDR_STATLISTEX      0x20017100u /* D2StatListExStrc prefix (0x60) */
#define ADDR_STATEFLAGS      0x20017200u /* 12 dwords */
#define ADDR_STATEMASK       0x20017300u /* 6 dwords at [sgpt+0x150] */
#define ADDR_MONSTATS_TXT    0x20018000u /* 4 * 0x1A8 */
#define ADDR_MONSTATS2_TXT   0x20019000u /* 4 * 0x134 */

typedef struct {
  uint32_t addr;
  uint32_t len;
} RangeSpec;

static inline void w32(uint32_t addr, uint32_t val) { *(volatile uint32_t *)(uintptr_t)addr = val; }
static inline void w16(uint32_t addr, uint16_t val) { *(volatile uint16_t *)(uintptr_t)addr = val; }
static inline void w8(uint32_t addr, uint8_t val) { *(volatile uint8_t *)(uintptr_t)addr = val; }
static inline uint32_t r32(uint32_t addr) { return *(volatile uint32_t *)(uintptr_t)addr; }

/* ---- Calling-convention thunks ---- */
static uint32_t call_stdcall1(uintptr_t fn, uint32_t a0) {
  typedef uint32_t(__stdcall * F)(uint32_t);
  return ((F)fn)(a0);
}
static uint32_t call_stdcall2(uintptr_t fn, uint32_t a0, uint32_t a1) {
  typedef uint32_t(__stdcall * F)(uint32_t, uint32_t);
  return ((F)fn)(a0, a1);
}
static uint32_t call_stdcall4(uintptr_t fn, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3) {
  typedef uint32_t(__stdcall * F)(uint32_t, uint32_t, uint32_t, uint32_t);
  return ((F)fn)(a0, a1, a2, a3);
}
static uint32_t call_fastcall1(uintptr_t fn, uint32_t ecx_in) {
  typedef uint32_t(__fastcall * F)(uint32_t);
  return ((F)fn)(ecx_in);
}
static uint32_t call_fastcall2(uintptr_t fn, uint32_t ecx_in, uint32_t edx_in) {
  typedef uint32_t(__fastcall * F)(uint32_t, uint32_t);
  return ((F)fn)(ecx_in, edx_in);
}
static uint32_t call_fastcall4(uintptr_t fn, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3) {
  typedef uint32_t(__fastcall * F)(uint32_t, uint32_t, uint32_t, uint32_t);
  return ((F)fn)(a0, a1, a2, a3);
}

/* 0x6FD91DD0: ebx = szCode, plain ret -> eax (esi/edi preserved by the callee). */
static __attribute__((noinline)) uint32_t call_ebx_ret(uintptr_t fn, uint32_t ebx_in) {
  uint32_t out;
  uint32_t fnv = (uint32_t)fn;
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "=a"(out), "+b"(ebx_in), [fn] "+c"(fnv)
    :
    : "edx", "esi", "edi", "cc", "memory"
  );
  return out;
}

/* 0x6FDCBC20: eax = pRoomEx, plain ret -> eax (ebx saved/restored by the callee). */
static __attribute__((noinline)) uint32_t call_eax_ret(uintptr_t fn, uint32_t eax_in) {
  uint32_t out = eax_in;
  uint32_t fnv = (uint32_t)fn;
  __asm__ volatile(
    "call *%[fn]\n\t"
    : "+a"(out), [fn] "+c"(fnv)
    :
    : "edx", "ebx", "esi", "edi", "cc", "memory"
  );
  return out;
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

static void clear_arena(void) {
  memset((void *)(uintptr_t)ARENA_BASE, 0, 0x20000u);
  w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);
}

/* Fog gdwBitMasks: IAT slot + the 32-dword table it points at (read by 0x6FD51470). */
static void snap_add_bitmasks(Snap *s) {
  snap_add(s, VA_GDWBITMASKS_IAT, 4);
  snap_add(s, r32(VA_GDWBITMASKS_IAT), 32 * 4);
}

/* =========================================================================
 * AnimData (0x6FD91DD0 / 0x6FD91EF0)
 * ========================================================================= */

typedef struct {
  char code[8];
  uint32_t frames;
  uint32_t speed;
  int event_at; /* -1: no event byte */
} AnimRec;

/* Hash of the upper-cased code exactly as 0x6FD91DD0 computes it. */
static uint32_t anim_hash(const unsigned char *s) {
  unsigned char tmp[16];
  memset(tmp, 0, sizeof tmp);
  memcpy(tmp, s, 15);
  uint32_t h = 0;
  for (int i = 0; tmp[i] != 0; i++) {
    signed char c = (signed char)tmp[i];
    if (c >= 'a' && c <= 'z') tmp[i] = (unsigned char)(c - 0x20);
    h += tmp[i];
  }
  return h & 0xFFu;
}

/*
 * Stages the table + one bucket. `bucket_count` is written raw (may be negative); `recs` fill the bucket.
 * Every hash slot points at the empty bucket except slot `hash(str)`, which points at ADDR_ANIM_BUCKET.
 */
static void setup_anim(const unsigned char *str, int str_len, int32_t bucket_count, const AnimRec *recs, int n_recs) {
  clear_arena();
  w32(VA_ANIMDATA_TABLE, ADDR_ANIM_TABLE);
  for (uint32_t i = 0; i < 256; i++) w32(ADDR_ANIM_TABLE + 4 + i * 4, ADDR_ANIM_EMPTY);
  w32(ADDR_ANIM_TABLE + 0x40C, 0x800);
  w32(ADDR_ANIM_TABLE + 0x410, 0x100);
  w32(ADDR_ANIM_EMPTY, 0);
  for (int i = 0; i < str_len; i++) w8(ADDR_ANIM_STR + i, str[i]);
  w32(ADDR_ANIM_TABLE + 4 + anim_hash(str) * 4, ADDR_ANIM_BUCKET);
  w32(ADDR_ANIM_BUCKET, (uint32_t)bucket_count);
  for (int k = 0; k < n_recs; k++) {
    uint32_t rec = ADDR_ANIM_BUCKET + 4 + k * 0xA0;
    memcpy((void *)(uintptr_t)rec, recs[k].code, 8);
    w32(rec + 8, recs[k].frames);
    w32(rec + 0xC, recs[k].speed);
    if (recs[k].event_at >= 0) w8(rec + 0x10 + recs[k].event_at, 1);
  }
  w32(ADDR_ANIM_OUT + 0, 0xAAAAAAAAu);
  w32(ADDR_ANIM_OUT + 4, 0xBBBBBBBBu);
  w32(ADDR_ANIM_OUT + 8, 0xCCCCCCCCu);
}

static void snap_anim(Snap *s) {
  snap_add(s, VA_ANIMDATA_TABLE, 4);
  snap_add(s, ADDR_ANIM_TABLE, 0x4A4);
  snap_add(s, ADDR_ANIM_EMPTY, 4);
  snap_add(s, ADDR_ANIM_BUCKET, 4 + 3 * 0xA0);
  snap_add(s, ADDR_ANIM_STR, 16);
  snap_add(s, ADDR_ANIM_OUT, 12);
}

static void emit_anim(FILE *fp) {
  Snap s = {0};
  const AnimRec R3[3] = {
    {"A1NUHTH", 12, 256, 5},
    {"\xE1" "BC", 7, 128, -1},
    {"A1NUHTX", 10, 200, 3},
  };

  /* ---- 0x6FD91DD0 ANIMDATA_FindRecordByCode (ebx = szCode) ---- */
  {
    const uint32_t va = 0x6FD91DD0u;
    const char *nm = "ANIMDATA_FindRecordByCode";
    struct {
      const char *id;
      const char *str;
      int32_t count;
      int nrec;
    } cases[] = {
      {"lowercase_match_rec0", "a1nuhth", 3, 3},
      {"mixedcase_match_rec2", "A1nUhTx", 3, 3},
      {"highbit_byte_match_rec1", "\xE1" "bc", 3, 3},
      {"backtick_brace_boundaries_nomatch", "`a{z@", 3, 3},
      {"nomatch_count2", "a1nuhtq", 2, 3},
      {"match_beyond_count_ignored", "a1nuhtx", 2, 3},
      {"count_zero", "a1nuhth", 0, 3},
      {"count_negative", "a1nuhth", -1, 3},
      {"empty_string_nomatch", "", 3, 3},
      {"exact8_uppercase_nomatch", "ABCDEFGH", 3, 3},
    };
    for (unsigned i = 0; i < sizeof cases / sizeof cases[0]; i++) {
      const unsigned char *str = (const unsigned char *)cases[i].str;
      setup_anim(str, (int)strlen(cases[i].str), cases[i].count, R3, cases[i].nrec);
      snap_anim(&s);
      snap_capture(&s);
      uint32_t args[1] = {ADDR_ANIM_STR};
      uint32_t eax = call_ebx_ret(va, ADDR_ANIM_STR);
      emit_line(fp, va, nm, cases[i].id, args, 1, 0xFFFFFFFFu, eax, &s);
    }
    /* exact-8 code that matches, and an empty code matching an all-zero record code */
    {
      /* frames = 0 keeps strlen(record code) == 8 (CompareCode8 asserts above 8). */
      const AnimRec R8[1] = {{{'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'}, 0, 64, -1}};
      setup_anim((const unsigned char *)"abcdefgh", 8, 1, R8, 1);
      snap_anim(&s);
      snap_capture(&s);
      uint32_t args[1] = {ADDR_ANIM_STR};
      uint32_t eax = call_ebx_ret(va, ADDR_ANIM_STR);
      emit_line(fp, va, nm, "exact8_lowercase_match", args, 1, 0xFFFFFFFFu, eax, &s);
    }
    {
      const AnimRec RZ[2] = {{"XX", 1, 1, -1}, {{0}, 9, 9, -1}};
      setup_anim((const unsigned char *)"", 0, 2, RZ, 2);
      snap_anim(&s);
      snap_capture(&s);
      uint32_t args[1] = {ADDR_ANIM_STR};
      uint32_t eax = call_ebx_ret(va, ADDR_ANIM_STR);
      emit_line(fp, va, nm, "empty_string_matches_zero_code_rec1", args, 1, 0xFFFFFFFFu, eax, &s);
    }
  }

  /* ---- 0x6FD91EF0 #10385 ANIMDATA_GetAnimDataInfo (stdcall szCode, pFrames, pSpeed, pFirstEvent) ---- */
  {
    const uint32_t va = 0x6FD91EF0u;
    const char *nm = "ANIMDATA_GetAnimDataInfo";
    struct {
      const char *id;
      uint32_t frames;
      int event_at;
    } found[] = {
      {"found_frames0", 0, 0},
      {"found_frames5_event0", 5, 0},
      {"found_frames5_noevent", 5, -1},
      {"found_frames256_noevent_cap90", 0x100, -1},
      {"found_frames10_event3", 10, 3},
      {"found_frames2_event3", 2, 3},
      {"found_frames_max_event143", 0xFFFFFFFFu, 0x8F},
      {"found_frames1_event1", 1, 1},
    };
    for (unsigned i = 0; i < sizeof found / sizeof found[0]; i++) {
      AnimRec r[1] = {{"S1HTH", found[i].frames, 0x77, found[i].event_at}};
      setup_anim((const unsigned char *)"s1hth", 5, 1, r, 1);
      snap_anim(&s);
      snap_capture(&s);
      uint32_t args[4] = {ADDR_ANIM_STR, ADDR_ANIM_OUT, ADDR_ANIM_OUT + 4, ADDR_ANIM_OUT + 8};
      uint32_t eax = call_stdcall4(va, args[0], args[1], args[2], args[3]);
      emit_line(fp, va, nm, found[i].id, args, 4, 0xFFFFFFFFu, eax, &s);
    }
    struct {
      const char *id;
      uint32_t pf, ps, pe;
      int found;
    } alias[] = {
      {"notfound_defaults", ADDR_ANIM_OUT, ADDR_ANIM_OUT + 4, ADDR_ANIM_OUT + 8, 0},
      {"notfound_firstevent_aliases_frames", ADDR_ANIM_OUT, ADDR_ANIM_OUT + 4, ADDR_ANIM_OUT, 0},
      {"notfound_speed_aliases_frames", ADDR_ANIM_OUT, ADDR_ANIM_OUT, ADDR_ANIM_OUT + 8, 0},
      {"found_speed_aliases_frames", ADDR_ANIM_OUT, ADDR_ANIM_OUT, ADDR_ANIM_OUT + 8, 1},
      {"found_firstevent_aliases_speed", ADDR_ANIM_OUT, ADDR_ANIM_OUT + 4, ADDR_ANIM_OUT + 4, 1},
    };
    for (unsigned i = 0; i < sizeof alias / sizeof alias[0]; i++) {
      AnimRec r[1] = {{"S1HTH", 6, 0x99, 4}};
      setup_anim((const unsigned char *)(alias[i].found ? "s1hth" : "s1htx"), 5, alias[i].found ? 1 : 0, r, 1);
      snap_anim(&s);
      snap_capture(&s);
      uint32_t args[4] = {ADDR_ANIM_STR, alias[i].pf, alias[i].ps, alias[i].pe};
      uint32_t eax = call_stdcall4(va, args[0], args[1], args[2], args[3]);
      emit_line(fp, va, nm, alias[i].id, args, 4, 0xFFFFFFFFu, eax, &s);
    }
  }
}

/* =========================================================================
 * RoomEx status helpers (0x6FDCBC20, 0x6FDCBE10, 0x6FDCBE50, 0x6FDCBE90, 0x6FDCBED0)
 * ========================================================================= */

#define SENTINEL(k) (ADDR_DRLG + 0xA0u + (uint32_t)(k) * 0xECu)
#define TAIL(k) (ADDR_TAILS + (uint32_t)(k) * 0x100u)

/* link_mode: 0 unlinked, 1 linked into list `status` (needs status < 4), 2 half-linked (next only) */
static void setup_room(uint8_t status, const uint16_t counts[4], int link_mode) {
  clear_arena();
  w32(ADDR_ROOM + 0x58, ADDR_LEVEL);
  w32(ADDR_LEVEL + 0x1B4, ADDR_DRLG);
  for (int k = 0; k < 4; k++) {
    w32(SENTINEL(k) + 0xE8, TAIL(k));
    w32(TAIL(k) + 0x1C, SENTINEL(k));
  }
  for (int k = 0; k < 4; k++) w16(ADDR_ROOM + 0xC + k * 2, counts[k]);
  w8(ADDR_ROOM + 0x44, status);
  if (link_mode == 1) {
    /* sentinel(status) -> room -> other -> tail(status) */
    w32(SENTINEL(status) + 0xE8, ADDR_ROOM);
    w32(ADDR_ROOM + 0x1C, SENTINEL(status));
    w32(ADDR_ROOM + 0xE8, ADDR_OTHER_ROOM);
    w32(ADDR_OTHER_ROOM + 0x1C, ADDR_ROOM);
    w32(ADDR_OTHER_ROOM + 0xE8, TAIL(status));
    w32(TAIL(status) + 0x1C, ADDR_OTHER_ROOM);
  } else if (link_mode == 2) {
    w32(ADDR_ROOM + 0xE8, ADDR_OTHER_ROOM);
  }
}

static void snap_room(Snap *s) {
  snap_add(s, ADDR_ROOM, 0xEC);
  snap_add(s, ADDR_LEVEL + 0x1B4, 4);
  snap_add(s, ADDR_DRLG + 0xA0, 5 * 0xEC);
  snap_add(s, ADDR_OTHER_ROOM, 0xEC);
  snap_add(s, ADDR_TAILS, 4 * 0x100);
}

static void emit_room(FILE *fp) {
  Snap s = {0};
  struct {
    const char *id;
    uint8_t status;
    uint16_t counts[4];
    int link;
  } cases[] = {
    {"s0_count_nonzero_early", 0, {2, 0, 0, 0}, 1},
    {"s3_count_nonzero_early", 3, {0, 0, 0, 1}, 1},
    {"s2_zero_moves_to_1", 2, {0, 3, 0, 0}, 1},
    {"s1_all_zero_unlinks_to_4", 1, {0, 0, 0, 0}, 1},
    {"s7_unlinked_inserts_2", 7, {0, 0, 5, 0}, 0},
    {"s4_unlinked_inserts_0", 4, {1, 1, 1, 1}, 0},
    {"s2_unlinked_all_zero_to_4", 2, {0, 0, 0, 0}, 0},
    {"s0_zero_moves_to_3", 0, {0, 0, 0, 9}, 1},
    {"s1_half_linked_all_zero", 1, {0, 0, 0, 0}, 2},
    {"s255_counts_ffff_inserts_0", 0xFF, {0xFFFF, 0, 0, 0}, 0},
  };
  const struct {
    uint32_t va;
    const char *nm;
    int eax_abi;
  } fns[] = {
    {0x6FDCBC20u, "DRLGROOM_RefreshStatusFromCountsEax", 1},
    {0x6FDCBE10u, "DRLGROOM_RefreshStatusFromCountsA", 0},
    {0x6FDCBE50u, "DRLGROOM_RefreshStatusFromCountsB", 0},
    {0x6FDCBE90u, "DRLGROOM_RefreshStatusFromCounts", 0},
  };
  for (unsigned f = 0; f < sizeof fns / sizeof fns[0]; f++) {
    for (unsigned i = 0; i < sizeof cases / sizeof cases[0]; i++) {
      setup_room(cases[i].status, cases[i].counts, cases[i].link);
      snap_room(&s);
      snap_capture(&s);
      uint32_t args[1] = {ADDR_ROOM};
      uint32_t eax = fns[f].eax_abi ? call_eax_ret(fns[f].va, ADDR_ROOM) : call_fastcall1(fns[f].va, ADDR_ROOM);
      emit_line(fp, fns[f].va, fns[f].nm, cases[i].id, args, 1, 0xFFFFFFFFu, eax, &s);
    }
  }

  /* 0x6FDCBED0: fastcall ecx = pRoomEx -> tail-jumps to SetStatusLink0 (void). */
  {
    const uint32_t va = 0x6FDCBED0u;
    const char *nm = "DRLGROOM_SetStatusLink0Fastcall";
    struct {
      const char *id;
      uint8_t status;
      int link;
    } c0[] = {
      {"s2_linked_moves_to_0", 2, 1},
      {"s0_linked_noop", 0, 1},
      {"s4_unlinked_inserts_0", 4, 0},
      {"s3_half_linked_inserts_0", 3, 2},
    };
    const uint16_t z[4] = {0, 0, 0, 0};
    for (unsigned i = 0; i < sizeof c0 / sizeof c0[0]; i++) {
      setup_room(c0[i].status, z, c0[i].link);
      snap_room(&s);
      snap_capture(&s);
      uint32_t args[1] = {ADDR_ROOM};
      uint32_t eax = call_fastcall1(va, ADDR_ROOM);
      emit_line(fp, va, nm, c0[i].id, args, 1, 0u, eax, &s);
    }
  }
}

/* =========================================================================
 * 0x6FDCF670 #10329 PLAYER_SetPlayerData150ParamsExport (fastcall pUnit, a0, [a1], [a2])
 * ========================================================================= */

static void emit_player(FILE *fp) {
  Snap s = {0};
  const uint32_t va = 0x6FDCF670u;
  const char *nm = "PLAYER_SetPlayerData150ParamsExport";
  struct {
    const char *id;
    int null_unit;
    uint32_t type;
    int has_pd;
    uint32_t a0, a1, a2;
  } cases[] = {
    {"null_unit", 1, 0, 1, 1, 2, 3},
    {"type1_monster_noop", 0, 1, 1, 4, 5, 6},
    {"type0_pdata_null", 0, 0, 0, 7, 8, 9},
    {"type0_pdata_valid", 0, 0, 1, 0x11, 0x22, 0x33},
    {"type0_pdata_valid_negative_args", 0, 0, 1, 0xFFFFFFFFu, 0x80000000u, 0x7FFFFFFFu},
    {"type4_item_noop", 0, 4, 1, 1, 1, 1},
  };
  for (unsigned i = 0; i < sizeof cases / sizeof cases[0]; i++) {
    clear_arena();
    w32(ADDR_PUNIT + 0x0, cases[i].type);
    w32(ADDR_PUNIT + 0x14, cases[i].has_pd ? ADDR_PDATA : 0u);
    for (uint32_t k = 0; k < 4; k++) w32(ADDR_PDATA + 0x150 + k * 4, 0xDEAD0000u + k);
    snap_add(&s, ADDR_PUNIT, 0xF4);
    snap_add(&s, ADDR_PDATA, 0x16C);
    snap_capture(&s);
    uint32_t pu = cases[i].null_unit ? 0u : ADDR_PUNIT;
    uint32_t args[4] = {pu, cases[i].a0, cases[i].a1, cases[i].a2};
    uint32_t eax = call_fastcall4(va, args[0], args[1], args[2], args[3]);
    emit_line(fp, va, nm, cases[i].id, args, 4, 0u, eax, &s);
  }
}

/* =========================================================================
 * Skills: 0x6FD9E5E0 / 0x6FD9E630 / 0x6FD9E680 (stdcall nLevel, nSkillId) and 0x6FD9F070 (fastcall)
 * ========================================================================= */

static void setup_skills_txt(uint32_t base) {
  clear_arena();
  w32(ADDR_DATATABLES + 0xB98, base);
  w32(ADDR_DATATABLES + 0xBA0, 4u);
  const int32_t params[4][6] = {
    {10, 50, 1, 9, -5, 25},
    {-20, 30, 7, 7, 100, 200},
    {100, 5, 0, 1000, 3, -3},
    {0, 0, 40, 60, 0x7FFFFFFF, -1},
  };
  for (uint32_t r = 0; r < 4; r++) {
    w16(ADDR_SKILLS_TXT + r * 0x23C, (uint16_t)(r + 10));
    for (uint32_t k = 0; k < 6; k++) w32(ADDR_SKILLS_TXT + r * 0x23C + 0x148 + k * 4, (uint32_t)params[r][k]);
  }
}

static void snap_skills_txt(Snap *s) {
  snap_add(s, VA_SGPT_DATATABLES, 4);
  snap_add(s, ADDR_DATATABLES + 0xB98, 0xC);
  for (uint32_t r = 0; r < 4; r++) snap_add(s, ADDR_SKILLS_TXT + r * 0x23C + 0x148, 0x18);
}

static void emit_skills_params(FILE *fp) {
  Snap s = {0};
  const struct {
    uint32_t va;
    const char *nm;
  } fns[] = {
    {0x6FD9E5E0u, "SKILLS_EvalParam56DimReturns"},
    {0x6FD9E630u, "SKILLS_EvalParam34DimReturns"},
    {0x6FD9E680u, "SKILLS_EvalParam12DimReturns"},
  };
  struct {
    const char *id;
    int32_t lvl;
    int32_t id_;
    int null_base;
  } cases[] = {
    {"skill_neg1", 5, -1, 0},
    {"skill_eq_count", 5, 4, 0},
    {"rec_null_base0_id0", 5, 0, 1},
    {"lvl0", 0, 0, 0},
    {"lvl_neg1", -1, 1, 0},
    {"lvl_neg6_gated", -6, 2, 0},
    {"lvl1_rec0", 1, 0, 0},
    {"lvl5_rec1", 5, 1, 0},
    {"lvl20_rec2", 20, 2, 0},
    {"lvl100_rec3", 100, 3, 0},
    {"lvl1000000_rec0_overflow", 1000000, 0, 0},
    {"lvl7_rec3", 7, 3, 0},
  };
  for (unsigned f = 0; f < sizeof fns / sizeof fns[0]; f++) {
    for (unsigned i = 0; i < sizeof cases / sizeof cases[0]; i++) {
      setup_skills_txt(cases[i].null_base ? 0u : ADDR_SKILLS_TXT);
      snap_skills_txt(&s);
      snap_capture(&s);
      uint32_t args[2] = {(uint32_t)cases[i].lvl, (uint32_t)cases[i].id_};
      uint32_t eax = call_stdcall2(fns[f].va, args[0], args[1]);
      emit_line(fp, fns[f].va, fns[f].nm, cases[i].id, args, 2, 0xFFFFFFFFu, eax, &s);
    }
  }

  /* 0x6FD9F070 #10630 fastcall(ecx = pUnit, edx = nSkillId) -> 0x6FD9E480 */
  {
    const uint32_t va = 0x6FD9F070u;
    const char *nm = "SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall";
    struct {
      const char *id;
      int has_list;
      int32_t skill_id;
    } c[] = {
      {"no_skill_list", 0, 10},
      {"highest_level_of_two", 1, 10},
      {"owner_guid_neg1_wins", 1, 11},
      {"not_found", 1, 13},
      {"single_match_flagged_skipped", 1, 12},
    };
    for (unsigned i = 0; i < sizeof c / sizeof c[0]; i++) {
      setup_skills_txt(ADDR_SKILLS_TXT);
      w32(ADDR_SUNIT + 0xA8, c[i].has_list ? ADDR_SKILL_LIST : 0u);
      w32(ADDR_SKILL_LIST + 4, ADDR_SKILLS);
      /* skill0: txt rec0 (id 10), lvl 3, guid 5 ; skill1: rec0 (id 10), lvl 8, guid 6 ;
         skill2: rec1 (id 11), lvl 1, guid -1 ; skill3: rec1 (id 11), lvl 9, guid 7 ;
         skill4: rec2 (id 12) flagged */
      const uint32_t txt[5] = {0, 0, 1, 1, 2};
      const uint32_t lvl[5] = {3, 8, 1, 9, 4};
      const uint32_t guid[5] = {5, 6, 0xFFFFFFFFu, 7, 0xFFFFFFFFu};
      const uint32_t flags[5] = {0, 0, 0, 0, 1};
      for (uint32_t k = 0; k < 5; k++) {
        uint32_t sk = ADDR_SKILLS + k * 0x40;
        w32(sk + 0x0, ADDR_SKILLS_TXT + txt[k] * 0x23C);
        w32(sk + 0x4, k < 4 ? sk + 0x40 : 0u);
        w32(sk + 0x28, lvl[k]);
        w32(sk + 0x34, guid[k]);
        w32(sk + 0x3C, flags[k]);
      }
      snap_add(&s, ADDR_SUNIT, 0xF4);
      snap_add(&s, ADDR_SKILL_LIST, 0x18);
      snap_add(&s, ADDR_SKILLS, 5 * 0x40);
      for (uint32_t r = 0; r < 4; r++) snap_add(&s, ADDR_SKILLS_TXT + r * 0x23C, 2);
      snap_capture(&s);
      uint32_t args[2] = {ADDR_SUNIT, (uint32_t)c[i].skill_id};
      uint32_t eax = call_fastcall2(va, args[0], args[1]);
      emit_line(fp, va, nm, c[i].id, args, 2, 0xFFFFFFFFu, eax, &s);
    }
  }
}

/* =========================================================================
 * Corpse predicates: 0x6FD9FF80 / 0x6FD9FFD0 / 0x6FDA0090 / 0x6FDA00E0 (stdcall pUnit), 0x6FDA0150 (pUnit, b)
 * ========================================================================= */

typedef struct {
  const char *id;
  int null_unit;
  uint32_t type;
  uint32_t mode;
  int32_t class_id;
  int statlist; /* 0 none, 1 non-extended, 2 extended masked, 3 extended not masked */
} CorpseCase;

static void setup_corpse(const CorpseCase *c) {
  clear_arena();
  w32(ADDR_DATATABLES + 0xC4, 183u);
  w32(ADDR_DATATABLES + 0x150, ADDR_STATEMASK);
  w32(ADDR_DATATABLES + 0xA78, ADDR_MONSTATS_TXT);
  w32(ADDR_DATATABLES + 0xA80, 4u);
  w32(ADDR_DATATABLES + 0xA90, ADDR_MONSTATS2_TXT);
  w32(ADDR_DATATABLES + 0xA98, 3u);
  /* mask: states 1 and 100 */
  w32(ADDR_STATEMASK + 0, 0x00000002u);
  w32(ADDR_STATEMASK + 12, 0x00000010u);
  /* MonStats: wMonStatsEx = i (rec3 = -1); wVelocity rec0=6, rec1=0, rec2=3, rec3=2 */
  const uint16_t ex[4] = {0, 1, 2, 0xFFFF};
  const uint16_t vel[4] = {6, 0, 3, 2};
  for (uint32_t r = 0; r < 4; r++) {
    w16(ADDR_MONSTATS_TXT + r * 0x1A8 + 0x18, ex[r]);
    w16(ADDR_MONSTATS_TXT + r * 0x1A8 + 0x32, vel[r]);
  }
  /* MonStats2 dwFlags: rec0 bit7+bit12, rec1 bit7 only, rec2 bit12 only */
  w32(ADDR_MONSTATS2_TXT + 0 * 0x134 + 4, 0x00001080u);
  w32(ADDR_MONSTATS2_TXT + 1 * 0x134 + 4, 0x00000080u);
  w32(ADDR_MONSTATS2_TXT + 2 * 0x134 + 4, 0x00001000u);

  w32(ADDR_MUNIT + 0x0, c->type);
  w32(ADDR_MUNIT + 0x4, (uint32_t)c->class_id);
  w32(ADDR_MUNIT + 0x10, c->mode);
  if (c->statlist != 0) {
    w32(ADDR_MUNIT + 0x5C, ADDR_STATLISTEX);
    w32(ADDR_STATLISTEX + 0x10, c->statlist == 1 ? 0x00000001u : 0x80000001u);
    w32(ADDR_STATLISTEX + 0x58, ADDR_STATEFLAGS);
    if (c->statlist == 2) {
      w32(ADDR_STATEFLAGS + 12, 0x00000010u); /* state 100 set and masked */
    } else {
      w32(ADDR_STATEFLAGS + 0, 0x00000004u); /* state 2 set, not masked */
      w32(ADDR_STATEFLAGS + 20, 0x00010000u);
    }
  }
}

static void snap_corpse(Snap *s) {
  snap_add(s, VA_SGPT_DATATABLES, 4);
  snap_add(s, ADDR_DATATABLES + 0xC4, 4);
  snap_add(s, ADDR_DATATABLES + 0x150, 4);
  snap_add(s, ADDR_DATATABLES + 0xA78, 0x24);
  snap_add(s, ADDR_MUNIT, 0xF4);
  snap_add(s, ADDR_STATLISTEX, 0x60);
  snap_add(s, ADDR_STATEFLAGS, 48);
  snap_add(s, ADDR_STATEMASK, 24);
  for (uint32_t r = 0; r < 4; r++) snap_add(s, ADDR_MONSTATS_TXT + r * 0x1A8 + 0x18, 0x1C);
  for (uint32_t r = 0; r < 3; r++) snap_add(s, ADDR_MONSTATS2_TXT + r * 0x134 + 4, 4);
  snap_add_bitmasks(s);
}

static void emit_corpse(FILE *fp) {
  Snap s = {0};
  const CorpseCase cases[] = {
    {"null_unit", 1, 1, 0xC, 0, 0},
    {"type0_player", 0, 0, 0xC, 0, 0},
    {"type1_mode11", 0, 1, 0xB, 0, 0},
    {"type1_mode0", 0, 1, 0x0, 0, 0},
    {"dead_flag7_flag12_rec0", 0, 1, 0xC, 0, 0},
    {"dead_flag7_only_rec1", 0, 1, 0xC, 1, 0},
    {"dead_flag12_only_rec2", 0, 1, 0xC, 2, 0},
    {"dead_monstatsex_neg_rec3", 0, 1, 0xC, 3, 0},
    {"dead_classid_oob4", 0, 1, 0xC, 4, 0},
    {"dead_classid_neg1", 0, 1, 0xC, -1, 0},
    {"dead_statlist_nonextended", 0, 1, 0xC, 0, 1},
    {"dead_state_masked", 0, 1, 0xC, 0, 2},
    {"dead_state_not_masked", 0, 1, 0xC, 1, 3},
  };
  const struct {
    uint32_t va;
    const char *nm;
  } fns[] = {
    {0x6FD9FF80u, "SKILLS_IsSelectableCorpse10501"},
    {0x6FD9FFD0u, "SKILLS_IsSelectableCorpse11157"},
    {0x6FDA0090u, "SKILLS_IsSelectableCorpse10678"},
    {0x6FDA00E0u, "SKILLS_IsSelectableCorpseWithFlag12"},
  };
  for (unsigned f = 0; f < sizeof fns / sizeof fns[0]; f++) {
    for (unsigned i = 0; i < sizeof cases / sizeof cases[0]; i++) {
      setup_corpse(&cases[i]);
      snap_corpse(&s);
      snap_capture(&s);
      uint32_t args[1] = {cases[i].null_unit ? 0u : ADDR_MUNIT};
      uint32_t eax = call_stdcall1(fns[f].va, args[0]);
      emit_line(fp, fns[f].va, fns[f].nm, cases[i].id, args, 1, 0xFFFFFFFFu, eax, &s);
    }
  }

  {
    const uint32_t va = 0x6FDA0150u;
    const char *nm = "SKILLS_IsSelectableCorpseWithVelocity";
    for (uint32_t b = 0; b < 2; b++) {
      for (unsigned i = 0; i < sizeof cases / sizeof cases[0]; i++) {
        char id[96];
        snprintf(id, sizeof id, "%s_b%u", cases[i].id, b);
        setup_corpse(&cases[i]);
        snap_corpse(&s);
        snap_capture(&s);
        uint32_t args[2] = {cases[i].null_unit ? 0u : ADDR_MUNIT, b};
        uint32_t eax = call_stdcall2(va, args[0], args[1]);
        emit_line(fp, va, nm, id, args, 2, 0xFFFFFFFFu, eax, &s);
      }
    }
    /* mode 5 with bAllowMode0 = 1 is rejected; mode 0 + b=1 with rec1 velocity 0 -> 0 */
    const CorpseCase extra[] = {
      {"type1_mode5_b1", 0, 1, 0x5, 0, 0},
      {"type1_mode0_rec1_vel0_b1", 0, 1, 0x0, 1, 0},
      {"type1_mode0_state_masked_b1", 0, 1, 0x0, 0, 2},
    };
    for (unsigned i = 0; i < sizeof extra / sizeof extra[0]; i++) {
      setup_corpse(&extra[i]);
      snap_corpse(&s);
      snap_capture(&s);
      uint32_t args[2] = {ADDR_MUNIT, 1u};
      uint32_t eax = call_stdcall2(va, args[0], args[1]);
      emit_line(fp, va, nm, extra[i].id, args, 2, 0xFFFFFFFFu, eax, &s);
    }
    /* bAllowMode0 = 0xFFFFFFFF (any non-zero) with mode 0 */
    {
      const CorpseCase c = {"type1_mode0_bneg1", 0, 1, 0x0, 0, 0};
      setup_corpse(&c);
      snap_corpse(&s);
      snap_capture(&s);
      uint32_t args[2] = {ADDR_MUNIT, 0xFFFFFFFFu};
      uint32_t eax = call_stdcall2(va, args[0], args[1]);
      emit_line(fp, va, nm, c.id, args, 2, 0xFFFFFFFFu, eax, &s);
    }
  }
}

int main(int argc, char **argv) {
  const char *dll_dir = (argc > 1) ? argv[1] : ".";
  const char *out_b = (argc > 2) ? argv[2] : "i9b-b-vectors.ndjson";

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

  FILE *fpb = fopen(out_b, "wb");
  if (!fpb) {
    fprintf(stderr, "Failed to open output file\n");
    return 4;
  }
  emit_anim(fpb);
  emit_room(fpb);
  emit_player(fpb);
  emit_skills_params(fpb);
  emit_corpse(fpb);
  fclose(fpb);
  printf("Successfully emitted %s\n", out_b);
  return 0;
}
