/*
 * k6-w1-d2game-emitter.c
 *
 * Milestone #37 [K6] Wave 1 Real-DLL Function Differential Vector Emitter:
 * Loads real Diablo II v1.13c D2Common.dll + D2Game.dll under headless Wine,
 * hooks Fog.#10024/#10045/#10046/#10047 IATs cleanly, invokes 53 previously
 * uncovered pure/struct D2Game.dll functions across 3 non-degenerate cases
 * each (159 real-DLL vectors), and writes deterministic NDJSON.
 *
 * Inline-assembly rule: Register constraints ONLY (zero "m", "g", or "o").
 * Compiles cleanly with -Wall -Wextra -Werror under -O2, -O2 -fno-omit-frame-pointer,
 * and -O2 -ffloat-store -fexcess-precision=standard with 3-way SHA-256 identity.
 */
#define _WIN32_WINNT 0x0501
#include <windows.h>
#include <setjmp.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define D2GAME_PREF_BASE      0x6FC20000u
#define D2GAME_IAT_SGPT_VA    0x6FD1829Cu
#define D2GAME_IAT_BITMASK_VA 0x6FD18BE0u
#define D2GAME_IAT_ASSERT_VA  0x6FD18BC4u
#define D2GAME_IAT_ALLOC_VA   0x6FD18BD0u
#define D2GAME_IAT_FREE_VA    0x6FD18BCCu
#define D2GAME_IAT_REALLOC_VA 0x6FD18BC8u
#define D2COM_SGPT_PTR_VA     0x6FDE9E1Cu

#define ARENA_BASE            0x03500000u
#define ARENA_SIZE            0x00100000u

#define ARENA_SGPT            (ARENA_BASE + 0x00000u)
#define ARENA_BITMASKS        (ARENA_BASE + 0x00E00u)
#define ARENA_OVERLAY         (ARENA_BASE + 0x01000u)
#define ARENA_CHARSTATS       (ARENA_BASE + 0x01400u)
#define ARENA_PETTYPE         (ARENA_BASE + 0x01A00u)
#define ARENA_MONLVL          (ARENA_BASE + 0x02000u)
#define ARENA_UNIQUEITEMS     (ARENA_BASE + 0x02600u)
#define ARENA_MONUMOD         (ARENA_BASE + 0x03000u)
#define ARENA_MONTYPENEST     (ARENA_BASE + 0x03400u)
#define ARENA_SKILLS          (ARENA_BASE + 0x04000u)
#define ARENA_MONSTATS        (ARENA_BASE + 0x06000u)
#define ARENA_TABLES_END      (ARENA_BASE + 0x07400u)

#define ARENA_WORK            (ARENA_BASE + 0x20000u)
#define ARENA_WORK_SIZE       0x01400u

#define U32(addr) (*(volatile uint32_t *)((uintptr_t)(addr)))
#define U16(addr) (*(volatile uint16_t *)((uintptr_t)(addr)))
#define U8(addr)  (*(volatile uint8_t  *)((uintptr_t)(addr)))
#define S16(addr) (*(volatile int16_t  *)((uintptr_t)(addr)))
#define S32(addr) (*(volatile int32_t  *)((uintptr_t)(addr)))

static uintptr_t g_game_rebase = 0u;
static jmp_buf g_jmp_buf;
static int g_in_test_call = 0;
static uint32_t g_assert_line = 0u;

static uint32_t g_orig_iat_assert  = 0u;
static uint32_t g_orig_iat_alloc   = 0u;
static uint32_t g_orig_iat_free    = 0u;
static uint32_t g_orig_iat_realloc = 0u;
static uint32_t g_orig_sgpt_ptr    = 0u;

static void __cdecl stub_fog_assert_line(uint32_t line) {
    g_assert_line = line;
    if (g_in_test_call) {
        g_in_test_call = 0;
        longjmp(g_jmp_buf, 1);
    }
}

static uint32_t __fastcall stub_fog_alloc(
    uint32_t pPool, uint32_t sz, const char *f, uint32_t ln, uint32_t z) {
    (void)pPool; (void)sz; (void)f; (void)ln; (void)z;
    return 0u;
}

static uint32_t __fastcall stub_fog_free(
    uint32_t pPool, uint32_t ptr, const char *f, uint32_t ln, uint32_t z) {
    (void)pPool; (void)ptr; (void)f; (void)ln; (void)z;
    return 1u;
}

static uint32_t __fastcall stub_fog_realloc(
    uint32_t pPool, uint32_t ptr, uint32_t sz, const char *f, uint32_t ln, uint32_t z) {
    (void)pPool; (void)ptr; (void)sz; (void)f; (void)ln; (void)z;
    return 0u;
}

static void install_iat_hooks(void) {
    U32(D2GAME_IAT_ASSERT_VA  + g_game_rebase) = (uint32_t)(uintptr_t)&stub_fog_assert_line;
    U32(D2GAME_IAT_ALLOC_VA   + g_game_rebase) = (uint32_t)(uintptr_t)&stub_fog_alloc;
    U32(D2GAME_IAT_FREE_VA    + g_game_rebase) = (uint32_t)(uintptr_t)&stub_fog_free;
    U32(D2GAME_IAT_REALLOC_VA + g_game_rebase) = (uint32_t)(uintptr_t)&stub_fog_realloc;
    uint32_t pSgptGlobal = U32(D2GAME_IAT_SGPT_VA + g_game_rebase);
    U32(pSgptGlobal) = ARENA_SGPT;
}

static void restore_iat_hooks(void) {
    uint32_t pSgptGlobal = U32(D2GAME_IAT_SGPT_VA + g_game_rebase);
    U32(pSgptGlobal) = g_orig_sgpt_ptr;
    U32(D2GAME_IAT_ASSERT_VA  + g_game_rebase) = g_orig_iat_assert;
    U32(D2GAME_IAT_ALLOC_VA   + g_game_rebase) = g_orig_iat_alloc;
    U32(D2GAME_IAT_FREE_VA    + g_game_rebase) = g_orig_iat_free;
    U32(D2GAME_IAT_REALLOC_VA + g_game_rebase) = g_orig_iat_realloc;
}

typedef struct {
    uint32_t fn;
    uint32_t r_eax;
    uint32_t r_ecx;
    uint32_t r_edx;
    uint32_t r_ebx;
    uint32_t r_esi;
    uint32_t r_edi;
    uint32_t s0;
    uint32_t s1;
    uint32_t n_stack;
    uint32_t ret;
} CallPkt;

_Static_assert(offsetof(CallPkt, fn)      ==  0, "fn off");
_Static_assert(offsetof(CallPkt, r_eax)   ==  4, "eax off");
_Static_assert(offsetof(CallPkt, r_ecx)   ==  8, "ecx off");
_Static_assert(offsetof(CallPkt, r_edx)   == 12, "edx off");
_Static_assert(offsetof(CallPkt, r_ebx)   == 16, "ebx off");
_Static_assert(offsetof(CallPkt, r_esi)   == 20, "esi off");
_Static_assert(offsetof(CallPkt, r_edi)   == 24, "edi off");
_Static_assert(offsetof(CallPkt, s0)      == 28, "s0 off");
_Static_assert(offsetof(CallPkt, s1)      == 32, "s1 off");
_Static_assert(offsetof(CallPkt, n_stack) == 36, "n_stack off");
_Static_assert(offsetof(CallPkt, ret)     == 40, "ret off");

static volatile CallPkt g_pkt;

static __attribute__((noinline)) uint32_t invoke_pkt_raw(void) {
    volatile CallPkt *p = &g_pkt;
    __asm__ volatile(
        "pushl %%ebx\n\t"
        "pushl %%ebp\n\t"
        "movl %0, %%ebp\n\t"
        "movl 36(%%ebp), %%eax\n\t"
        "cmpl $2, %%eax\n\t"
        "jne 1f\n\t"
        "pushl 32(%%ebp)\n\t"
        "pushl 28(%%ebp)\n\t"
        "jmp 2f\n\t"
        "1:\n\t"
        "cmpl $1, %%eax\n\t"
        "jne 2f\n\t"
        "pushl 28(%%ebp)\n\t"
        "2:\n\t"
        "movl 4(%%ebp), %%eax\n\t"
        "movl 8(%%ebp), %%ecx\n\t"
        "movl 12(%%ebp), %%edx\n\t"
        "movl 16(%%ebp), %%ebx\n\t"
        "movl 20(%%ebp), %%esi\n\t"
        "movl 24(%%ebp), %%edi\n\t"
        "call *0(%%ebp)\n\t"
        "movl %%eax, 40(%%ebp)\n\t"
        "popl %%ebp\n\t"
        "popl %%ebx\n\t"
        : "+r"(p)
        :
        : "eax", "ecx", "edx", "esi", "edi", "cc", "memory");
    return g_pkt.ret;
}

static __attribute__((noinline)) uint32_t safe_invoke(
    uint32_t canon_va,
    uint32_t r_eax,
    uint32_t r_ecx,
    uint32_t r_edx,
    uint32_t r_ebx,
    uint32_t r_esi,
    uint32_t r_edi,
    uint32_t n_stack,
    uint32_t s0,
    uint32_t s1,
    int *pAsserted) {
    g_pkt.fn      = canon_va + (uint32_t)g_game_rebase;
    g_pkt.r_eax   = r_eax;
    g_pkt.r_ecx   = r_ecx;
    g_pkt.r_edx   = r_edx;
    g_pkt.r_ebx   = r_ebx;
    g_pkt.r_esi   = r_esi;
    g_pkt.r_edi   = r_edi;
    g_pkt.s0      = s0;
    g_pkt.s1      = s1;
    g_pkt.n_stack = n_stack;
    g_pkt.ret     = 0u;

    volatile uint32_t r = 0u;
    int *volatile out = pAsserted;
    g_assert_line = 0u;
    install_iat_hooks();
    if (setjmp(g_jmp_buf) == 0) {
        g_in_test_call = 1;
        r = invoke_pkt_raw();
        g_in_test_call = 0;
        *out = 0;
    } else {
        *out = 1;
    }
    restore_iat_hooks();
    return r;
}

static void init_static_tables(void) {
    memset((void *)(uintptr_t)ARENA_BASE, 0, ARENA_TABLES_END - ARENA_BASE);

    for (uint32_t i = 0; i < 32u; i++) {
        U32(ARENA_BITMASKS + i * 4u) = (1u << i);
    }

    /* OverlayTxt: count = 5, stride = 0x3C */
    U32(ARENA_SGPT + 0x00BCu) = ARENA_OVERLAY;
    U32(ARENA_SGPT + 0x00C4u) = 5u;

    /* CharStatsTxt: count = 7, stride = 0xC4 */
    U32(ARENA_SGPT + 0x0BC4u) = ARENA_CHARSTATS;
    U32(ARENA_SGPT + 0x0BC8u) = 7u;

    /* PetTypeTxt: count = 6, stride = 0xE0 */
    U32(ARENA_SGPT + 0x0BE8u) = ARENA_PETTYPE;
    U32(ARENA_SGPT + 0x0BF0u) = 6u;

    /* MonLvlTxt: count = 8, stride = 0x78 */
    U32(ARENA_SGPT + 0x0B70u) = ARENA_MONLVL;
    U32(ARENA_SGPT + 0x0B74u) = 8u;

    /* UniqueItemsTxt: count = 6, stride = 0x14C */
    U32(ARENA_SGPT + 0x0C24u) = ARENA_UNIQUEITEMS;
    U32(ARENA_SGPT + 0x0C28u) = 6u;

    /* wTableAE0[0..65] */
    for (uint32_t i = 0; i < 66u; i++) {
        U16(ARENA_SGPT + 0x0AE0u + i * 2u) = (uint16_t)(1000u + i * 17u);
    }

    /* SkillsTxt: count = 6, stride = 0x23C */
    U32(ARENA_SGPT + 0x0B98u) = ARENA_SKILLS;
    U32(ARENA_SGPT + 0x0BA0u) = 6u;
    for (uint32_t s = 0; s < 6u; s++) {
        uint32_t rec = ARENA_SKILLS + s * 0x23Cu;
        S16(rec + 0x12Cu) = (s == 0u) ? 0 : (int16_t)(15 + s * 5); /* wMaxLvl */
        S32(rec + 0x148u) = (int32_t)(10 + s * 7);                  /* dwParam1 */
        S32(rec + 0x14Cu) = (int32_t)(3 + s * 2);                   /* dwParam2 / dwDelay */
        S32(rec + 0x150u) = (int32_t)(25 + s * 11);                 /* dwParam3 */
        S32(rec + 0x154u) = (int32_t)(4 + s * 3);                   /* dwParam4 */
        S32(rec + 0x158u) = (int32_t)(50 + s * 13);                 /* dwParam5 */
        S32(rec + 0x15Cu) = (int32_t)(6 + s * 4);                   /* dwParam6 */
        S32(rec + 0x160u) = (int32_t)(100 + s * 19);                /* dwParam7 */
    }

    /* MonStatsTxt: count = 8, stride = 0x1A8 */
    U32(ARENA_SGPT + 0x0A78u) = ARENA_MONSTATS;
    U32(ARENA_SGPT + 0x0A80u) = 8u;
    S16(ARENA_MONSTATS + 0u * 0x1A8u + 0x02u) = 10;
    S16(ARENA_MONSTATS + 0u * 0x1A8u + 0x04u) = 1;
    S16(ARENA_MONSTATS + 0u * 0x1A8u + 0x1Cu) = 3;
    S16(ARENA_MONSTATS + 0u * 0x1A8u + 0x26u) = 4;
    S16(ARENA_MONSTATS + 0u * 0x1A8u + 0x170u) = 2;

    S16(ARENA_MONSTATS + 1u * 0x1A8u + 0x02u) = 10;
    S16(ARENA_MONSTATS + 1u * 0x1A8u + 0x04u) = 2;
    S16(ARENA_MONSTATS + 1u * 0x1A8u + 0x1Cu) = 35;
    S16(ARENA_MONSTATS + 1u * 0x1A8u + 0x26u) = -1;
    S16(ARENA_MONSTATS + 1u * 0x1A8u + 0x170u) = 0;

    S16(ARENA_MONSTATS + 2u * 0x1A8u + 0x02u) = 10;
    S16(ARENA_MONSTATS + 2u * 0x1A8u + 0x04u) = -1;
    S16(ARENA_MONSTATS + 2u * 0x1A8u + 0x1Cu) = 5;
    S16(ARENA_MONSTATS + 2u * 0x1A8u + 0x26u) = 6;
    S16(ARENA_MONSTATS + 2u * 0x1A8u + 0x170u) = 4;

    S16(ARENA_MONSTATS + 3u * 0x1A8u + 0x02u) = 30;
    S16(ARENA_MONSTATS + 3u * 0x1A8u + 0x04u) = 99;
    S16(ARENA_MONSTATS + 3u * 0x1A8u + 0x1Cu) = -1;
    S16(ARENA_MONSTATS + 3u * 0x1A8u + 0x26u) = 99;
    S16(ARENA_MONSTATS + 3u * 0x1A8u + 0x170u) = 99;

    /* MonTypeNest: count = 40, strideDwords = 2 (64 bits per row) */
    U32(ARENA_SGPT + 0x0C40u) = 40u;
    U32(ARENA_SGPT + 0x0C44u) = ARENA_MONTYPENEST;
    U32(ARENA_SGPT + 0x0C48u) = 2u;
    U32(ARENA_MONTYPENEST + (2u * 2u + 0u) * 4u) = (1u << 3) | (1u << 7);
    U32(ARENA_MONTYPENEST + (5u * 2u + 1u) * 4u) = (1u << 3);

    /* MonUModTxt: count = 10, stride = 0x20 */
    U32(ARENA_SGPT + 0x0C50u) = ARENA_MONUMOD;
    U32(ARENA_SGPT + 0x0C54u) = 10u;
    for (uint32_t u = 0; u < 10u; u++) {
        uint32_t urec = ARENA_MONUMOD + u * 0x20u;
        U8(urec + 0x07u) = (u % 2u == 1u) ? 1u : 0u;
        S32(urec + 0x1Cu) = (int32_t)(u * 25 - 10);
    }
}

static void fprint_hex(FILE *fp, const uint8_t *buf, size_t len) {
    for (size_t i = 0; i < len; i++) {
        fprintf(fp, "%02x", buf[i]);
    }
}

static void emit_tables_header(FILE *fp) {
    fprintf(fp, "{\"k\":\"tables\",\"arenaBase\":\"0x%08x\",\"workBase\":\"0x%08x\",\"tablesHex\":\"",
            ARENA_BASE, ARENA_WORK);
    fprint_hex(fp, (const uint8_t *)(uintptr_t)ARENA_BASE, ARENA_TABLES_END - ARENA_BASE);
    fprintf(fp, "\"}\n");
}

static void emit_case_line(
    FILE *fp,
    uint32_t va,
    const char *name,
    int caseIdx,
    const uint32_t *tsArgs,
    int nTsArgs,
    const uint8_t *preWork,
    size_t workLen,
    int asserted,
    uint32_t assertLine,
    uint32_t eaxOut,
    uint32_t retMask,
    const uint8_t *postWork) {
    fprintf(fp, "{\"va\":\"0x%08X\",\"name\":\"%s\",\"caseIndex\":%d,\"inputs\":{\"args\":[",
            va, name, caseIdx);
    for (int i = 0; i < nTsArgs; i++) {
        if (i > 0) fputc(',', fp);
        fprintf(fp, "\"0x%08x\"", tsArgs[i]);
    }
    fprintf(fp, "],\"workHex\":\"");
    fprint_hex(fp, preWork, workLen);
    fprintf(fp, "\"}");
    if (asserted) {
        fprintf(fp, ",\"expectedAssert\":{\"line\":%u}", assertLine);
    }
    fprintf(fp, ",\"outputs\":{\"eax\":\"0x%08x\",\"retMask\":\"0x%08x\",\"workHex\":\"",
            eaxOut & retMask, retMask);
    fprint_hex(fp, postWork, workLen);
    fprintf(fp, "\"}}\n");
}

static void reset_work(void) {
    memset((void *)(uintptr_t)ARENA_WORK, 0, ARENA_WORK_SIZE);
}

#define RUN_AND_EMIT(va, nm, cidx, args_arr, nargs, r_eax, r_ecx, r_edx, r_ebx, r_esi, r_edi, nstk, st0, st1, mask, wlen) \
    do {                                                                                                                    \
        uint8_t pre_snap[ARENA_WORK_SIZE];                                                                                  \
        uint8_t post_snap[ARENA_WORK_SIZE];                                                                                 \
        memcpy(pre_snap, (const void *)(uintptr_t)ARENA_WORK, (wlen));                                                      \
        int did_assert = 0;                                                                                                 \
        uint32_t rv = safe_invoke((va), (r_eax), (r_ecx), (r_edx), (r_ebx), (r_esi), (r_edi), (nstk), (st0), (st1), &did_assert); \
        memcpy(post_snap, (const void *)(uintptr_t)ARENA_WORK, (wlen));                                                     \
        emit_case_line(fp, (va), (nm), (cidx), (args_arr), (nargs), pre_snap, (wlen), did_assert, g_assert_line, rv, (mask), post_snap); \
    } while (0)

static void emit_all_vectors(FILE *fp) {
    /* 1. Lookup table record fast (eax = idx -> eax): 5 functions */
    {
        struct { uint32_t va; const char *name; int32_t idxs[3]; } tbl_fns[5] = {
            {0x6FC210A0u, "CHARSTATS_GetRecordPtrFast_6FC210A0_113c",   {-1, 2, 7}},
            {0x6FC216F0u, "UNIQUEITEMS_GetRecordPtrFast_6FC216F0_113c", {-1, 3, 6}},
            {0x6FC21AE0u, "OVERLAY_GetRecordPtrFast_6FC21AE0_113c",     {-2, 1, 5}},
            {0x6FC21B60u, "PETTYPE_GetRecordPtrFast_6FC21B60_113c",     {-1, 4, 9}},
            {0x6FC21E90u, "MONLVL_GetRecordPtrFast_6FC21E90_113c",      {-1, 5, 8}},
        };
        for (int f = 0; f < 5; f++) {
            for (int c = 0; c < 3; c++) {
                reset_work();
                uint32_t a0 = (uint32_t)tbl_fns[f].idxs[c];
                uint32_t args[1] = {a0};
                RUN_AND_EMIT(tbl_fns[f].va, tbl_fns[f].name, c, args, 1,
                             a0, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 32u);
            }
        }
    }

    /* 2. SEED_StepSeed64Fast_6FC21160 (ecx = pSeed -> eax) */
    {
        const uint32_t seeds[3][2] = {
            {0x00003039u, 0x0000029Au},
            {0xDEADBEEFu, 0x12345678u},
            {0xFFFFFFFFu, 0xFFFFFFFFu},
        };
        for (int c = 0; c < 3; c++) {
            reset_work();
            U32(ARENA_WORK + 0x00u) = seeds[c][0];
            U32(ARENA_WORK + 0x04u) = seeds[c][1];
            uint32_t args[1] = {ARENA_WORK};
            RUN_AND_EMIT(0x6FC21160u, "SEED_StepSeed64Fast_6FC21160_113c", c, args, 1,
                         0u, ARENA_WORK, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 32u);
        }
    }

    /* 3. MonsterData pointer getters (eax = pUnit -> eax): 4 functions */
    {
        struct { uint32_t va; const char *name; uint32_t off; } md_fns[4] = {
            {0x6FC21370u, "MONSTER_GetInteractDataPtr_6FC21370_113c",     0x30u},
            {0x6FC21540u, "MONSTER_GetMonStatsTxtFromUnit_6FC21540_113c", 0x00u},
            {0x6FC218E0u, "MONSTER_GetAiGeneralPtr_6FC218E0_113c",        0x28u},
            {0x6FC21DD0u, "MONSTER_GetMonsterDataField2C_6FC21DD0_113c",  0x2Cu},
        };
        for (int f = 0; f < 4; f++) {
            for (int c = 0; c < 3; c++) {
                reset_work();
                uint32_t pUnit = 0u;
                if (c == 1) {
                    pUnit = ARENA_WORK;
                    U32(pUnit + 0x00u) = 0u;
                    U32(pUnit + 0x14u) = ARENA_WORK + 0x100u;
                } else if (c == 2) {
                    pUnit = ARENA_WORK;
                    uint32_t pMd = ARENA_WORK + 0x100u;
                    U32(pUnit + 0x00u) = 1u;
                    U32(pUnit + 0x14u) = pMd;
                    U32(pMd + md_fns[f].off) = 0x03520400u + (uint32_t)f * 16u;
                }
                uint32_t args[1] = {pUnit};
                RUN_AND_EMIT(md_fns[f].va, md_fns[f].name, c, args, 1,
                             pUnit, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x140u);
            }
        }
    }

    /* 4. MONTYPE_TestNestedBit_6FC21620 (ecx = nBitMonType, eax = nRowMonType -> eax) */
    {
        const int32_t pairs[3][2] = {{3, 2}, {35, 5}, {4, 2}};
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t bitT = (uint32_t)pairs[c][0];
            uint32_t rowT = (uint32_t)pairs[c][1];
            uint32_t args[2] = {bitT, rowT};
            RUN_AND_EMIT(0x6FC21620u, "MONTYPE_TestNestedBit_6FC21620_113c", c, args, 2,
                         rowT, bitT, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 32u);
        }
    }

    /* 5. SKILLS_GetMaxSkillLevel_6FC21740 & DATATBLS_GetTableWordAE0_6FC21830 */
    {
        const int32_t sids[3] = {-1, 0, 3};
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t a0 = (uint32_t)sids[c];
            uint32_t args[1] = {a0};
            RUN_AND_EMIT(0x6FC21740u, "SKILLS_GetMaxSkillLevel_6FC21740_113c", c, args, 1,
                         a0, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 32u);
        }
        const int32_t ae_idxs[3] = {-1, 5, 66};
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t a0 = (uint32_t)ae_idxs[c];
            uint32_t args[1] = {a0};
            RUN_AND_EMIT(0x6FC21830u, "DATATBLS_GetTableWordAE0_6FC21830_113c", c, args, 1,
                         a0, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 32u);
        }
    }

    /* 6. SKILLS_EvalLinearParam{34,56,12} (eax = nSkillId, edx = nLevel -> eax) */
    {
        struct { uint32_t va; const char *name; } lin_fns[3] = {
            {0x6FC21A40u, "SKILLS_EvalLinearParam34_6FC21A40_113c"},
            {0x6FC21A90u, "SKILLS_EvalLinearParam56_6FC21A90_113c"},
            {0x6FC21B10u, "SKILLS_EvalLinearParam12_6FC21B10_113c"},
        };
        const int32_t cases[3][2] = {{2, 0}, {2, 1}, {4, 7}};
        for (int f = 0; f < 3; f++) {
            for (int c = 0; c < 3; c++) {
                reset_work();
                uint32_t sid = (uint32_t)cases[c][0];
                uint32_t lvl = (uint32_t)cases[c][1];
                uint32_t args[2] = {sid, lvl};
                RUN_AND_EMIT(lin_fns[f].va, lin_fns[f].name, c, args, 2,
                             sid, 0u, lvl, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 32u);
            }
        }
    }

    /* 7. SKILLS_GetParam{1..7}Fast (eax = nSkillId -> eax): 7 functions */
    {
        struct { uint32_t va; const char *name; } p_fns[7] = {
            {0x6FC21B90u, "SKILLS_GetParam1Fast_6FC21B90_113c"},
            {0x6FC21BC0u, "SKILLS_GetParam2Fast_6FC21BC0_113c"},
            {0x6FC21BF0u, "SKILLS_GetParam3Fast_6FC21BF0_113c"},
            {0x6FC21C20u, "SKILLS_GetParam4Fast_6FC21C20_113c"},
            {0x6FC21C50u, "SKILLS_GetParam5Fast_6FC21C50_113c"},
            {0x6FC21EC0u, "SKILLS_GetParam6Fast_6FC21EC0_113c"},
            {0x6FC21EF0u, "SKILLS_GetParam7Fast_6FC21EF0_113c"},
        };
        const int32_t sids[3] = {-1, 1, 5};
        for (int f = 0; f < 7; f++) {
            for (int c = 0; c < 3; c++) {
                reset_work();
                uint32_t a0 = (uint32_t)sids[c];
                uint32_t args[1] = {a0};
                RUN_AND_EMIT(p_fns[f].va, p_fns[f].name, c, args, 1,
                             a0, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 32u);
            }
        }
    }

    /* 8. MONSTATS_FollowSubClassChain_6FC21D30 (ecx = nClassId, ebx = nSteps -> eax) */
    {
        const int32_t cases[3][2] = {{-1, 1}, {0, 0}, {0, 2}};
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t cls = (uint32_t)cases[c][0];
            uint32_t stp = (uint32_t)cases[c][1];
            uint32_t args[2] = {cls, stp};
            RUN_AND_EMIT(0x6FC21D30u, "MONSTATS_FollowSubClassChain_6FC21D30_113c", c, args, 2,
                         0u, cls, 0u, stp, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 32u);
        }
    }

    /* 9. STORM_TSHashTableLookup_6FC22130 (edx = pHashTable, esi = dwKey -> eax) */
    {
        const uint32_t keys[3] = {0x11110001u, 0x22220001u, 0x99990001u};
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pTbl = ARENA_WORK;
            uint32_t pBuckets = ARENA_WORK + 0x40u;
            uint32_t pNodeA = ARENA_WORK + 0x100u;
            uint32_t pNodeB = ARENA_WORK + 0x140u;
            U32(pTbl + 0x1Cu) = pBuckets;
            U32(pTbl + 0x24u) = 3u;
            uint32_t b1 = pBuckets + 12u;
            U32(b1 + 0x00u) = 4u;
            U32(b1 + 0x04u) = pNodeB + 4u;
            U32(b1 + 0x08u) = pNodeA;
            U32(pNodeA + 0x00u) = 0x11110001u;
            U32(pNodeA + 0x04u) = b1 + 4u;
            U32(pNodeA + 0x08u) = pNodeB;
            U32(pNodeB + 0x00u) = 0x22220001u;
            U32(pNodeB + 0x04u) = pNodeA + 4u;
            U32(pNodeB + 0x08u) = ~(b1 + 4u);
            uint32_t args[2] = {pTbl, keys[c]};
            RUN_AND_EMIT(0x6FC22130u, "STORM_TSHashTableLookup_6FC22130_113c", c, args, 2,
                         0u, 0u, pTbl, 0u, keys[c], 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x180u);
        }
    }

    /* 10. STORM_TSListUnlinkAll_6FC22180 (edi = pList -> void) */
    {
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pList = ARENA_WORK;
            uint32_t term = pList + 4u;
            U32(pList + 0x00u) = 4u;
            if (c == 0) {
                U32(term) = term;
                U32(pList + 0x08u) = ~term;
            } else if (c == 1) {
                uint32_t n0 = ARENA_WORK + 0x40u;
                U32(term) = n0 + 4u;
                U32(pList + 0x08u) = n0;
                U32(n0 + 0x00u) = 0xAAu;
                U32(n0 + 0x04u) = term;
                U32(n0 + 0x08u) = ~term;
            } else {
                uint32_t n0 = ARENA_WORK + 0x40u;
                uint32_t n1 = ARENA_WORK + 0x80u;
                U32(term) = n1 + 4u;
                U32(pList + 0x08u) = n0;
                U32(n0 + 0x00u) = 0xBBu;
                U32(n0 + 0x04u) = term;
                U32(n0 + 0x08u) = n1;
                U32(n1 + 0x00u) = 0xCCu;
                U32(n1 + 0x04u) = n0 + 4u;
                U32(n1 + 0x08u) = ~term;
            }
            uint32_t args[1] = {pList};
            RUN_AND_EMIT(0x6FC22180u, "STORM_TSListUnlinkAll_6FC22180_113c", c, args, 1,
                         0u, 0u, 0u, 0u, 0u, pList, 0u, 0u, 0u, 0x00000000u, 0xA0u);
        }
    }

    /* 11. STORM_TSListInitDefault_6FC224B0 ([esp+4] = pList, ret 4 -> eax) */
    {
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pList = ARENA_WORK + (uint32_t)c * 0x20u;
            uint32_t args[1] = {pList};
            RUN_AND_EMIT(0x6FC224B0u, "STORM_TSListInitDefault_6FC224B0_113c", c, args, 1,
                         0u, 0u, 0u, 0u, 0u, 0u, 1u, pList, 0u, 0xFFFFFFFFu, 0x60u);
        }
    }

    /* 12. STORM_TSArrayCalcChunkSize_6FC225F0 (eax = nCount, [esp+4] = pArray, ret 4 -> eax) */
    {
        const uint32_t counts[3] = {0u, 13u, 25u};
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pArr = ARENA_WORK;
            uint32_t args[2] = {counts[c], pArr};
            RUN_AND_EMIT(0x6FC225F0u, "STORM_TSArrayCalcChunkSize_6FC225F0_113c", c, args, 2,
                         counts[c], 0u, 0u, 0u, 0u, 0u, 1u, pArr, 0u, 0xFFFFFFFFu, 32u);
        }
    }

    /* 13. STORM_TSListInitFromPrototype_6FC22740 ([esp+4] = pDst, [esp+8] = pSrc, ret 8 -> eax) */
    {
        const uint32_t offs[3] = {0x04u, 0x10u, 0x28u};
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pDst = ARENA_WORK + (uint32_t)c * 0x20u;
            uint32_t pSrc = ARENA_WORK + 0x80u;
            U32(pSrc) = offs[c];
            uint32_t args[2] = {pDst, pSrc};
            RUN_AND_EMIT(0x6FC22740u, "STORM_TSListInitFromPrototype_6FC22740_113c", c, args, 2,
                         0u, 0u, 0u, 0u, 0u, 0u, 2u, pDst, pSrc, 0xFFFFFFFFu, 0x90u);
        }
    }

    /* 14. MONSTER_TestUnitMonTypeFlag_6FC22790 (eax = pUnit, edi = nMonType -> eax) */
    {
        const int32_t cases[3][2] = {{0, 2}, {1, 5}, {2, 2}};
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pUnit = ARENA_WORK;
            U32(pUnit + 0x00u) = 1u;
            U32(pUnit + 0x04u) = (uint32_t)cases[c][0];
            uint32_t rowT = (uint32_t)cases[c][1];
            uint32_t args[2] = {pUnit, rowT};
            RUN_AND_EMIT(0x6FC22790u, "MONSTER_TestUnitMonTypeFlag_6FC22790_113c", c, args, 2,
                         pUnit, 0u, 0u, 0u, 0u, rowT, 0u, 0u, 0u, 0xFFFFFFFFu, 32u);
        }
    }

    /* 15. CHECKSUM_ComputeCrc32_6FC2B470 (ecx = pData, edx = nLen -> eax; asserts line 0x40 on nLen==0) */
    {
        for (int c = 0; c < 3; c++) {
            reset_work();
            const char *msg = (c == 1) ? "123456789" : "DiabloII-113c";
            uint32_t nLen = (c == 0) ? 0u : (uint32_t)strlen(msg);
            if (nLen > 0u) {
                memcpy((void *)(uintptr_t)ARENA_WORK, msg, nLen);
            }
            uint32_t args[2] = {ARENA_WORK, nLen};
            RUN_AND_EMIT(0x6FC2B470u, "CHECKSUM_ComputeCrc32_6FC2B470_113c", c, args, 2,
                         0u, ARENA_WORK, nLen, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 32u);
        }
    }

    /* 16. OBJRGN_CheckCoordSpacing40_6FC2B670 & OBJRGN_CheckCoordSpacing20_6FC2B700
     *     (ecx = pGame, edx = nAct, [esp+4] = nX, [esp+8] = nY, ret 8 -> eax) */
    {
        const int32_t xy40[3][2] = {{500, 500}, {520, 700}, {600, 600}};
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pGame = ARENA_WORK;
            uint32_t pObjCtrl = ARENA_WORK + 0x100u;
            uint32_t pRegion  = ARENA_WORK + 0x200u;
            U32(pGame + 0x10F0u) = pObjCtrl;
            U32(pObjCtrl + 1u * 4u + 0x48u) = pRegion;
            U32(pRegion + 0x14u) = 2u;
            S32(pRegion + 0x40u) = 500;
            S32(pRegion + 0x44u) = 500;
            S32(pRegion + 0x48u) = 800;
            S32(pRegion + 0x4Cu) = 800;
            uint32_t nx = (uint32_t)xy40[c][0];
            uint32_t ny = (uint32_t)xy40[c][1];
            uint32_t args[4] = {pGame, 1u, nx, ny};
            RUN_AND_EMIT(0x6FC2B670u, "OBJRGN_CheckCoordSpacing40_6FC2B670_113c", c, args, 4,
                         0u, pGame, 1u, 0u, 0u, 0u, 2u, nx, ny, 0xFFFFFFFFu, 0x1100u);
        }
        const int32_t xy20[3][2] = {{500, 500}, {580, 900}, {700, 700}};
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pGame = ARENA_WORK;
            uint32_t pObjCtrl = ARENA_WORK + 0x100u;
            uint32_t pRegion  = ARENA_WORK + 0x200u;
            U32(pGame + 0x10F0u) = pObjCtrl;
            U32(pObjCtrl + 2u * 4u + 0x48u) = pRegion;
            U32(pRegion + 0x18u) = 1u;
            S32(pRegion + 0x20u) = 500;
            S32(pRegion + 0x24u) = 500;
            uint32_t nx = (uint32_t)xy20[c][0];
            uint32_t ny = (uint32_t)xy20[c][1];
            uint32_t args[4] = {pGame, 2u, nx, ny};
            RUN_AND_EMIT(0x6FC2B700u, "OBJRGN_CheckCoordSpacing20_6FC2B700_113c", c, args, 4,
                         0u, pGame, 2u, 0u, 0u, 0u, 2u, nx, ny, 0xFFFFFFFFu, 0x1100u);
        }
    }

    /* 17. ITEMS_ScaleStatByPercentWithMin_6FC33230 (eax = nValue, esi = nMinValue, [esp+4] = nPercent, ret 4) */
    {
        const int32_t cases[3][3] = {{250, 10, 150}, {30, 50, 80}, {-200, -500, 125}};
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t v = (uint32_t)cases[c][0];
            uint32_t mn = (uint32_t)cases[c][1];
            uint32_t pct = (uint32_t)cases[c][2];
            uint32_t args[3] = {v, mn, pct};
            RUN_AND_EMIT(0x6FC33230u, "ITEMS_ScaleStatByPercentWithMin113c", c, args, 3,
                         v, 0u, 0u, 0u, mn, 0u, 1u, pct, 0u, 0xFFFFFFFFu, 32u);
        }
    }

    /* 18. AI_InitMonster{ClearAiParam3,ResetAiStateNeg1,BaalMinionSpawnState,SkillDelayFrame} */
    {
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pParam = ARENA_WORK;
            uint32_t pCtrl  = ARENA_WORK + 0x40u + (uint32_t)c * 0x40u;
            U32(pParam) = pCtrl;
            U32(pCtrl + 0x1Cu) = 0x12340000u + (uint32_t)c;
            uint32_t args[3] = {0u, 0u, pParam};
            RUN_AND_EMIT(0x6FC35520u, "AI_InitMonsterClearAiParam3_113c", c, args, 3,
                         0u, 0u, 0u, 0u, 0u, 0u, 1u, pParam, 0u, 0x00000000u, 0x120u);
        }
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pParam = ARENA_WORK;
            uint32_t pCtrl  = ARENA_WORK + 0x40u + (uint32_t)c * 0x40u;
            U32(pParam) = pCtrl;
            U32(pCtrl + 0x14u) = (uint32_t)c * 77u;
            uint32_t args[3] = {0u, 0u, pParam};
            RUN_AND_EMIT(0x6FC35530u, "AI_InitMonsterResetAiStateNeg1_113c", c, args, 3,
                         0u, 0u, 0u, 0u, 0u, 0u, 1u, pParam, 0u, 0x00000000u, 0x120u);
        }
        const uint32_t frames[3] = {10u, 250u, 9999u};
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pGame  = ARENA_WORK;
            uint32_t pParam = ARENA_WORK + 0x100u;
            uint32_t pCtrl  = ARENA_WORK + 0x140u;
            U32(pGame + 0xA8u) = frames[c];
            U32(pParam) = pCtrl;
            U32(pCtrl + 0x18u) = 0x7777u;
            uint32_t args[3] = {pGame, 0u, pParam};
            RUN_AND_EMIT(0x6FC35540u, "AI_InitBaalMinionSpawnState113c", c, args, 3,
                         0u, pGame, 0u, 0u, 0u, 0u, 1u, pParam, 0u, 0x00000000u, 0x1A0u);
        }
        const uint32_t monRecs[3] = {
            ARENA_MONSTATS + 0u * 0x1A8u, /* wSkill0 = 2 -> delay = 7 */
            ARENA_MONSTATS + 1u * 0x1A8u, /* wSkill0 = 0 -> untouched */
            ARENA_MONSTATS + 2u * 0x1A8u, /* wSkill0 = 4 -> delay = 11 */
        };
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pGame  = ARENA_WORK;
            uint32_t pParam = ARENA_WORK + 0x100u;
            uint32_t pCtrl  = ARENA_WORK + 0x140u;
            U32(pGame + 0xA8u) = 500u + (uint32_t)c * 100u;
            U32(pParam + 0x00u) = pCtrl;
            U32(pParam + 0x1Cu) = monRecs[c];
            U32(pCtrl + 0x14u) = 0x55u;
            uint32_t args[3] = {pGame, 0u, pParam};
            RUN_AND_EMIT(0x6FC356C0u, "AI_InitMonsterSkillDelayFrame113c", c, args, 3,
                         0u, pGame, 0u, 0u, 0u, 0u, 1u, pParam, 0u, 0x00000000u, 0x180u);
        }
    }

    /* 19. AIGENERAL_GetField3C_6FC40C60 (ecx = pUnit) & AIGENERAL_GetQuestDataPtr38_6FC40DE0 (eax = pUnit) */
    {
        const uint32_t vals[3] = {0x11u, 0x22334455u, 0xFFFFFFFFu};
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pUnit = ARENA_WORK;
            uint32_t pMd   = ARENA_WORK + 0x40u;
            uint32_t pAiG  = ARENA_WORK + 0x80u;
            U32(pUnit + 0x00u) = 1u;
            U32(pUnit + 0x14u) = pMd;
            U32(pMd + 0x28u)   = pAiG;
            U32(pAiG + 0x3Cu)  = vals[c];
            uint32_t args[1] = {pUnit};
            RUN_AND_EMIT(0x6FC40C60u, "AIGENERAL_GetField3C_113c", c, args, 1,
                         0u, pUnit, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0xE0u);
        }
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pUnit = (c == 0) ? 0u : ARENA_WORK;
            if (c == 1) {
                U32(pUnit + 0x00u) = 0u; /* non-monster -> returns 0x38 */
            } else if (c == 2) {
                uint32_t pMd  = ARENA_WORK + 0x40u;
                uint32_t pAiG = ARENA_WORK + 0x80u;
                U32(pUnit + 0x00u) = 1u;
                U32(pUnit + 0x14u) = pMd;
                U32(pMd + 0x28u)   = pAiG;
            }
            uint32_t args[1] = {pUnit};
            RUN_AND_EMIT(0x6FC40DE0u, "AIGENERAL_GetQuestDataPtr38_113c", c, args, 1,
                         pUnit, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0xE0u);
        }
    }

    /* 20. MONUMOD helpers: 0x6FC41860, 0x6FC41F60, 0x6FC41FB0, 0x6FC42920, 0x6FC42A10, 0x6FC42AF0,
     *     0x6FC43020, 0x6FC43060, 0x6FC43260 */
    {
        /* 0x6FC41860: MONUMOD_CountUnitUMods (ecx = pUModBytes -> eax) */
        for (int c = 0; c < 3; c++) {
            reset_work();
            int n = (c == 0) ? 0 : (c == 1 ? 4 : 11);
            for (int i = 0; i < n; i++) U8(ARENA_WORK + (uint32_t)i) = (uint8_t)(i + 1);
            uint32_t args[1] = {ARENA_WORK};
            RUN_AND_EMIT(0x6FC41860u, "MONUMOD_CountUnitUMods113c", c, args, 1,
                         0u, ARENA_WORK, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 32u);
        }

        /* 0x6FC41F60: MONUMOD_GetMinionClassIdForBoss (eax = pUnit -> eax) */
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pUnit = (c == 0) ? 0u : ARENA_WORK;
            if (c == 1) U32(pUnit + 0x04u) = 0u; /* wMinion0 = 4 */
            if (c == 2) U32(pUnit + 0x04u) = 1u; /* wMinion0 = -1 -> fallback classId = 1 */
            uint32_t args[1] = {pUnit};
            RUN_AND_EMIT(0x6FC41F60u, "MONUMOD_GetMinionClassIdForBoss113c", c, args, 1,
                         pUnit, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 32u);
        }

        /* 0x6FC41FB0: MONUMOD_GetConstantValue (eax = nConstIndex -> eax) */
        const int32_t cidxs[3] = {-1, 3, 12};
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t a0 = (uint32_t)cidxs[c];
            uint32_t args[1] = {a0};
            RUN_AND_EMIT(0x6FC41FB0u, "MONUMOD_GetConstantValue113c", c, args, 1,
                         a0, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 32u);
        }

        /* 0x6FC42920: MONUMOD_AppendUModToMonster (eax = pMonster, [esp+4] = nUModId, ret 4) */
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pMon = ARENA_WORK;
            uint32_t pMd  = ARENA_WORK + 0x40u;
            U32(pMon + 0x00u) = (c == 0) ? 0u : 1u;
            U32(pMon + 0x14u) = pMd;
            if (c == 2) {
                U8(pMd + 0x1Cu) = 5u;
                U8(pMd + 0x1Du) = 8u;
            }
            uint32_t umod = 17u + (uint32_t)c;
            uint32_t args[2] = {pMon, umod};
            RUN_AND_EMIT(0x6FC42920u, "MONUMOD_AppendUModToMonster113c", c, args, 2,
                         pMon, 0u, 0u, 0u, 0u, 0u, 1u, umod, 0u, 0x00000000u, 0x80u);
        }

        /* 0x6FC42A10: MONUMOD_SetSuperUniqueId (eax = pMonster, [esp+4] = wSuperUniqueId, ret 4) */
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pMon = ARENA_WORK;
            uint32_t pMd  = ARENA_WORK + 0x40u;
            U32(pMon + 0x00u) = (c == 0) ? 0u : 1u;
            U32(pMon + 0x14u) = pMd;
            uint32_t suId = (c == 1) ? 42u : 0x1234u;
            uint32_t args[2] = {pMon, suId};
            RUN_AND_EMIT(0x6FC42A10u, "MONUMOD_SetSuperUniqueId113c", c, args, 2,
                         pMon, 0u, 0u, 0u, 0u, 0u, 1u, suId, 0u, 0x00000000u, 0x80u);
        }

        /* 0x6FC42AF0: MONUMOD_GetUModListPtr (eax = pMonster -> eax) */
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pMon = (c == 0) ? 0u : ARENA_WORK;
            if (c == 1) {
                U32(pMon + 0x00u) = 0u;
            } else if (c == 2) {
                U32(pMon + 0x00u) = 1u;
                U32(pMon + 0x14u) = ARENA_WORK + 0x40u;
            }
            uint32_t args[1] = {pMon};
            RUN_AND_EMIT(0x6FC42AF0u, "MONUMOD_GetUModListPtr113c", c, args, 1,
                         pMon, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x80u);
        }

        /* 0x6FC43020: MONUMOD_RollBossOrMinionNameSeed (ecx = pMonster, edx = nUModId, [esp+4] = bBoss, ret 4) */
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pMon = ARENA_WORK;
            uint32_t pMd  = ARENA_WORK + 0x40u;
            U32(pMon + 0x00u) = 1u;
            U32(pMon + 0x14u) = pMd;
            U32(pMon + 0x20u) = 0x1000u + (uint32_t)c * 0x777u;
            U32(pMon + 0x24u) = 0x29Au;
            uint32_t bBoss = (c == 0) ? 0u : 1u;
            uint32_t args[3] = {pMon, 1u, bBoss};
            RUN_AND_EMIT(0x6FC43020u, "MONUMOD_RollBossOrMinionNameSeed113c", c, args, 3,
                         0u, pMon, 1u, 0u, 0u, 0u, 1u, bBoss, 0u, 0x00000000u, 0x80u);
        }

        /* 0x6FC43060: MONUMOD_CopyMinionEligibleUMods (eax = pBoss, ecx = pMinion, [esp+4] = bOverwrite, ret 4) */
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pBoss   = ARENA_WORK;
            uint32_t pBossMd = ARENA_WORK + 0x40u;
            uint32_t pMin    = ARENA_WORK + 0x80u;
            uint32_t pMinMd  = ARENA_WORK + 0xC0u;
            U32(pBoss + 0x00u) = (c == 0) ? 0u : 1u;
            U32(pBoss + 0x14u) = pBossMd;
            U8(pBossMd + 0x1Cu) = 2u; /* fMin = 0 */
            U8(pBossMd + 0x1Du) = 3u; /* fMin = 1 */
            U8(pBossMd + 0x1Eu) = 5u; /* fMin = 1 */
            U32(pMin + 0x00u) = 1u;
            U32(pMin + 0x14u) = pMinMd;
            U8(pMinMd + 0x1Cu) = 9u;
            uint32_t bOverwrite = (c == 2) ? 1u : 0u;
            uint32_t args[3] = {pBoss, pMin, bOverwrite};
            RUN_AND_EMIT(0x6FC43060u, "MONUMOD_CopyMinionEligibleUMods113c", c, args, 3,
                         pBoss, pMin, 0u, 0u, 0u, 0u, 1u, bOverwrite, 0u, 0x00000000u, 0x100u);
        }

        /* 0x6FC43260: MONUMOD_MarkBossAndIncrementUniqueCount (eax = pMonster, esi = pGame) */
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pGame   = ARENA_WORK;
            uint32_t pMon    = ARENA_WORK + 0x120u;
            uint32_t pMd     = ARENA_WORK + 0x160u;
            uint32_t pMonReg = ARENA_WORK + 0x200u;
            U32(pMon + 0x00u) = (c == 0) ? 0u : 1u;
            U32(pMon + 0x14u) = pMd;
            U32(pMd + 0x58u)  = 1u; /* nAct = 1 */
            U8(pMd + 0x16u)   = (c == 2) ? 0x08u : 0x02u;
            U32(pGame + 0xF0u + 1u * 4u) = pMonReg;
            U32(pMonReg + 0x2C8u) = 7u;
            uint32_t args[2] = {pMon, pGame};
            RUN_AND_EMIT(0x6FC43260u, "MONUMOD_MarkBossAndIncrementUniqueCount113c", c, args, 2,
                         pMon, 0u, 0u, 0u, pGame, 0u, 0u, 0u, 0u, 0x00000000u, 0x500u);
        }
    }

    /* 21. OBJECTS_InitFn16_6FC4E760 & OBJECTS_InitFn27_6FC4E9F0 (ecx = pInitParam) */
    {
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pInit   = ARENA_WORK;
            uint32_t pObj    = ARENA_WORK + 0x40u;
            uint32_t pObjDat = ARENA_WORK + 0x80u;
            uint32_t pObjTxt = ARENA_WORK + 0xC0u;
            U32(pInit + 0x04u)   = pObj;
            U32(pInit + 0x10u)   = pObjTxt;
            U32(pObj + 0x14u)    = pObjDat;
            U8(pObjTxt + 0x180u) = (uint8_t)(c * 2 + 1);
            uint32_t args[1] = {pInit};
            RUN_AND_EMIT(0x6FC4E760u, "OBJECTS_InitFn16_DoubleActToSubType113c", c, args, 1,
                         0u, pInit, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0x00000000u, 0x260u);
        }
        const uint32_t seeds[3] = {1u, 7u, 12345u};
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pInit    = ARENA_WORK;
            uint32_t pObj     = ARENA_WORK + 0x40u;
            uint32_t pObjDat  = ARENA_WORK + 0x80u;
            uint32_t pObjCtrl = ARENA_WORK + 0xC0u;
            U32(pInit + 0x04u) = pObj;
            U32(pInit + 0x0Cu) = pObjCtrl;
            U32(pObj + 0x14u)  = pObjDat;
            U32(pObjCtrl + 0x00u) = seeds[c];
            U32(pObjCtrl + 0x04u) = 0x29Au;
            uint32_t args[1] = {pInit};
            RUN_AND_EMIT(0x6FC4E9F0u, "OBJECTS_InitFn27_RollSubType3_113c", c, args, 1,
                         0u, pInit, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0x00000000u, 0x100u);
        }
    }

    /* 22. QUESTS_HasPlayerGuidInQuest_6FC537D0 & QUESTS_GuidListContains_6FC53800 */
    {
        const uint32_t qguids[3] = {101u, 202u, 999u};
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pQuest = ARENA_WORK;
            U16(pQuest + 0x9Cu) = (c == 0) ? 0u : 2u;
            U32(pQuest + 0x1Cu) = 101u;
            U32(pQuest + 0x20u) = 202u;
            uint32_t args[2] = {pQuest, qguids[c]};
            RUN_AND_EMIT(0x6FC537D0u, "QUESTS_HasPlayerGuidInQuest113c", c, args, 2,
                         0u, 0u, pQuest, 0u, qguids[c], 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0xC0u);
        }
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t pList = ARENA_WORK;
            U16(pList + 0x80u) = (c == 0) ? 0u : 2u;
            U32(pList + 0x00u) = 101u;
            U32(pList + 0x04u) = 202u;
            uint32_t args[2] = {pList, qguids[c]};
            RUN_AND_EMIT(0x6FC53800u, "QUESTS_GuidListContains113c", c, args, 2,
                         0u, 0u, pList, 0u, qguids[c], 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x90u);
        }
    }
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "Usage: %s <out.ndjson>\n", argv[0]);
        return 2;
    }

    void *mem = VirtualAlloc(
        (void *)(uintptr_t)ARENA_BASE, ARENA_SIZE, MEM_RESERVE | MEM_COMMIT, PAGE_READWRITE);
    if (mem != (void *)(uintptr_t)ARENA_BASE) {
        fprintf(stderr, "VirtualAlloc(0x%08x) failed (got %p, err=%lu)\n",
                ARENA_BASE, mem, (unsigned long)GetLastError());
        return 3;
    }

    HMODULE hGame = LoadLibraryA("D2Game.dll");
    if (!hGame) {
        fprintf(stderr, "LoadLibraryA(D2Game.dll) failed (err=%lu)\n", (unsigned long)GetLastError());
        return 4;
    }
    g_game_rebase = (uintptr_t)hGame - (uintptr_t)D2GAME_PREF_BASE;

    DWORD oldProt = 0;
    if (!VirtualProtect((void *)((uintptr_t)0x6FD18000u + g_game_rebase), 0x1000u, PAGE_READWRITE, &oldProt)) {
        fprintf(stderr, "VirtualProtect(D2Game IAT) failed (err=%lu)\n", (unsigned long)GetLastError());
        return 5;
    }

    g_orig_iat_assert  = U32(D2GAME_IAT_ASSERT_VA  + g_game_rebase);
    g_orig_iat_alloc   = U32(D2GAME_IAT_ALLOC_VA   + g_game_rebase);
    g_orig_iat_free    = U32(D2GAME_IAT_FREE_VA    + g_game_rebase);
    g_orig_iat_realloc = U32(D2GAME_IAT_REALLOC_VA + g_game_rebase);
    uint32_t pSgptGlobal = U32(D2GAME_IAT_SGPT_VA + g_game_rebase);
    g_orig_sgpt_ptr    = U32(pSgptGlobal);

    init_static_tables();

    FILE *fp = fopen(argv[1], "wb");
    if (!fp) {
        fprintf(stderr, "fopen(%s) failed\n", argv[1]);
        return 6;
    }

    emit_tables_header(fp);
    emit_all_vectors(fp);
    fclose(fp);
    return 0;
}
