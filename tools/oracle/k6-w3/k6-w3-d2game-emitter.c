/*
 * k6-w3-d2game-emitter.c
 *
 * Milestone #37 [K6] Wave 3 Real-DLL Function Differential Vector Emitter:
 * Loads real Diablo II v1.13c D2Common.dll + D2Game.dll under headless Wine,
 * hooks Fog.#10024/#10045/#10046/#10047 IATs cleanly across BOTH DLLs, invokes:
 *   - The final 2 previously un-DLL-verified D2Common.dll functions
 *     (0x6FD87470 ENVIRONMENT_GetTimeOfDayAndAngle, 0x6FD96330 ITEMS_CalcByTimeStat),
 *     closing D2Common.dll real-DLL verification to 1,479 / 1,479 (100.00%).
 *   - 123 previously un-DLL-verified D2Game.dll functions in 0x6FC20000..0x6FC7FFFF
 *     across >= 3 non-degenerate cases each (125 functions total, 377 vectors).
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

#define D2COM_PREF_BASE       0x6FD50000u
#define D2GAME_PREF_BASE      0x6FC20000u

#define D2COM_IAT_ASSERT_VA   0x6FDD90D4u
#define D2COM_IAT_ALLOC_VA    0x6FDD90D0u
#define D2COM_IAT_FREE_VA     0x6FDD90CCu
#define D2COM_IAT_SALLOC_VA   0x6FDD90C8u
#define D2COM_IAT_SFREE_VA    0x6FDD90C4u
#define D2COM_IAT_SREALLOC_VA 0x6FDD90C0u
#define D2COM_SGPT_PTR_VA     0x6FDE9E1Cu
#define D2COM_OBJ_PTR_VA      0x6FDF0B94u
#define D2COM_OBJ_CNT_VA      0x6FDF0B98u
#define D2COM_ITEMS_CNT_VA    0x6FDEFB94u
#define D2COM_ITEMS_PTR_VA    0x6FDEFB98u

#define D2GAME_IAT_SGPT_VA    0x6FD1829Cu
#define D2GAME_IAT_ASSERT_VA  0x6FD18BC4u
#define D2GAME_IAT_ALLOC_VA   0x6FD18BD0u
#define D2GAME_IAT_FREE_VA    0x6FD18BCCu
#define D2GAME_IAT_REALLOC_VA 0x6FD18BC8u
#define D2GAME_IAT_SALLOC_VA  0x6FD18BBCu
#define D2GAME_IAT_SFREE_VA   0x6FD18BB8u
#define D2GAME_IAT_SREALLOC_VA 0x6FD18BB4u

#define ARENA_BASE            0x03500000u
#define ARENA_SIZE            0x00100000u

#define ARENA_SGPT            (ARENA_BASE + 0x00000u)
#define ARENA_BITMASKS        (ARENA_BASE + 0x00E00u)
#define ARENA_INV_BITMASKS    (ARENA_BASE + 0x00E80u)
#define ARENA_STATES          (ARENA_BASE + 0x01000u)
#define ARENA_SKILLS          (ARENA_BASE + 0x04000u)
#define ARENA_MONSTATS        (ARENA_BASE + 0x06000u)
#define ARENA_MISSILES        (ARENA_BASE + 0x0D000u)
#define ARENA_OBJECTS         (ARENA_BASE + 0x0E000u)
#define ARENA_ITEMS           (ARENA_BASE + 0x0F000u)
#define ARENA_TABLES_END      (ARENA_BASE + 0x10000u)

#define ARENA_WORK            (ARENA_BASE + 0x20000u)
#define ARENA_WORK_SIZE       0x02000u

#define U32(addr) (*(volatile uint32_t *)((uintptr_t)(addr)))
#define U16(addr) (*(volatile uint16_t *)((uintptr_t)(addr)))
#define U8(addr)  (*(volatile uint8_t  *)((uintptr_t)(addr)))
#define S16(addr) (*(volatile int16_t  *)((uintptr_t)(addr)))
#define S32(addr) (*(volatile int32_t  *)((uintptr_t)(addr)))

static uintptr_t g_com_rebase  = 0u;
static uintptr_t g_game_rebase = 0u;
static jmp_buf g_jmp_buf;
static int g_in_test_call = 0;
static uint32_t g_assert_line = 0u;

static uint32_t g_orig_com_assert   = 0u;
static uint32_t g_orig_com_alloc    = 0u;
static uint32_t g_orig_com_free     = 0u;
static uint32_t g_orig_com_salloc   = 0u;
static uint32_t g_orig_com_sfree    = 0u;
static uint32_t g_orig_com_srealloc = 0u;
static uint32_t g_orig_com_sgpt     = 0u;
static uint32_t g_orig_com_obj_ptr  = 0u;
static uint32_t g_orig_com_obj_cnt  = 0u;
static uint32_t g_orig_com_itm_cnt  = 0u;
static uint32_t g_orig_com_itm_ptr  = 0u;

static uint32_t g_orig_game_assert   = 0u;
static uint32_t g_orig_game_alloc    = 0u;
static uint32_t g_orig_game_free     = 0u;
static uint32_t g_orig_game_realloc  = 0u;
static uint32_t g_orig_game_salloc   = 0u;
static uint32_t g_orig_game_sfree    = 0u;
static uint32_t g_orig_game_srealloc = 0u;
static uint32_t g_orig_game_sgpt     = 0u;

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
    U32(D2COM_IAT_ASSERT_VA   + g_com_rebase) = (uint32_t)(uintptr_t)&stub_fog_assert_line;
    U32(D2COM_IAT_ALLOC_VA    + g_com_rebase) = (uint32_t)(uintptr_t)&stub_fog_alloc;
    U32(D2COM_IAT_FREE_VA     + g_com_rebase) = (uint32_t)(uintptr_t)&stub_fog_free;
    U32(D2COM_IAT_SALLOC_VA   + g_com_rebase) = (uint32_t)(uintptr_t)&stub_fog_alloc;
    U32(D2COM_IAT_SFREE_VA    + g_com_rebase) = (uint32_t)(uintptr_t)&stub_fog_free;
    U32(D2COM_IAT_SREALLOC_VA + g_com_rebase) = (uint32_t)(uintptr_t)&stub_fog_realloc;
    U32(D2COM_SGPT_PTR_VA     + g_com_rebase) = ARENA_SGPT;
    U32(D2COM_OBJ_PTR_VA      + g_com_rebase) = ARENA_OBJECTS;
    U32(D2COM_OBJ_CNT_VA      + g_com_rebase) = 6u;
    U32(D2COM_ITEMS_CNT_VA    + g_com_rebase) = 4u;
    U32(D2COM_ITEMS_PTR_VA    + g_com_rebase) = ARENA_ITEMS;

    U32(D2GAME_IAT_ASSERT_VA   + g_game_rebase) = (uint32_t)(uintptr_t)&stub_fog_assert_line;
    U32(D2GAME_IAT_ALLOC_VA    + g_game_rebase) = (uint32_t)(uintptr_t)&stub_fog_alloc;
    U32(D2GAME_IAT_FREE_VA     + g_game_rebase) = (uint32_t)(uintptr_t)&stub_fog_free;
    U32(D2GAME_IAT_REALLOC_VA  + g_game_rebase) = (uint32_t)(uintptr_t)&stub_fog_realloc;
    U32(D2GAME_IAT_SALLOC_VA   + g_game_rebase) = (uint32_t)(uintptr_t)&stub_fog_alloc;
    U32(D2GAME_IAT_SFREE_VA    + g_game_rebase) = (uint32_t)(uintptr_t)&stub_fog_free;
    U32(D2GAME_IAT_SREALLOC_VA + g_game_rebase) = (uint32_t)(uintptr_t)&stub_fog_realloc;
    uint32_t pSgptGlobal = U32(D2GAME_IAT_SGPT_VA + g_game_rebase);
    U32(pSgptGlobal) = ARENA_SGPT;
}

static void restore_iat_hooks(void) {
    uint32_t pSgptGlobal = U32(D2GAME_IAT_SGPT_VA + g_game_rebase);
    U32(pSgptGlobal) = g_orig_game_sgpt;
    U32(D2GAME_IAT_SREALLOC_VA + g_game_rebase) = g_orig_game_srealloc;
    U32(D2GAME_IAT_SFREE_VA    + g_game_rebase) = g_orig_game_sfree;
    U32(D2GAME_IAT_SALLOC_VA   + g_game_rebase) = g_orig_game_salloc;
    U32(D2GAME_IAT_ASSERT_VA   + g_game_rebase) = g_orig_game_assert;
    U32(D2GAME_IAT_ALLOC_VA    + g_game_rebase) = g_orig_game_alloc;
    U32(D2GAME_IAT_FREE_VA     + g_game_rebase) = g_orig_game_free;
    U32(D2GAME_IAT_REALLOC_VA  + g_game_rebase) = g_orig_game_realloc;

    U32(D2COM_ITEMS_PTR_VA    + g_com_rebase) = g_orig_com_itm_ptr;
    U32(D2COM_ITEMS_CNT_VA    + g_com_rebase) = g_orig_com_itm_cnt;
    U32(D2COM_OBJ_CNT_VA      + g_com_rebase) = g_orig_com_obj_cnt;
    U32(D2COM_OBJ_PTR_VA      + g_com_rebase) = g_orig_com_obj_ptr;
    U32(D2COM_SGPT_PTR_VA     + g_com_rebase) = g_orig_com_sgpt;
    U32(D2COM_IAT_SREALLOC_VA + g_com_rebase) = g_orig_com_srealloc;
    U32(D2COM_IAT_SFREE_VA    + g_com_rebase) = g_orig_com_sfree;
    U32(D2COM_IAT_SALLOC_VA   + g_com_rebase) = g_orig_com_salloc;
    U32(D2COM_IAT_FREE_VA     + g_com_rebase) = g_orig_com_free;
    U32(D2COM_IAT_ALLOC_VA    + g_com_rebase) = g_orig_com_alloc;
    U32(D2COM_IAT_ASSERT_VA   + g_com_rebase) = g_orig_com_assert;
}

typedef struct {
    uint32_t fn;
    uint32_t r_eax;
    uint32_t r_ecx;
    uint32_t r_edx;
    uint32_t r_ebx;
    uint32_t r_esi;
    uint32_t r_edi;
    uint32_t s[6];
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
_Static_assert(offsetof(CallPkt, s)       == 28, "s off");
_Static_assert(offsetof(CallPkt, n_stack) == 52, "n_stack off");
_Static_assert(offsetof(CallPkt, ret)     == 56, "ret off");

static volatile CallPkt g_pkt;

static __attribute__((noinline)) uint32_t invoke_pkt_raw(void) {
    volatile CallPkt *p = &g_pkt;
    __asm__ volatile(
        "pushl %%ebx\n\t"
        "pushl %%ebp\n\t"
        "movl %0, %%ebp\n\t"
        "movl 52(%%ebp), %%ecx\n\t"
        "1:\n\t"
        "testl %%ecx, %%ecx\n\t"
        "jz 2f\n\t"
        "decl %%ecx\n\t"
        "pushl 28(%%ebp,%%ecx,4)\n\t"
        "jmp 1b\n\t"
        "2:\n\t"
        "movl 4(%%ebp), %%eax\n\t"
        "movl 8(%%ebp), %%ecx\n\t"
        "movl 12(%%ebp), %%edx\n\t"
        "movl 16(%%ebp), %%ebx\n\t"
        "movl 20(%%ebp), %%esi\n\t"
        "movl 24(%%ebp), %%edi\n\t"
        "call *0(%%ebp)\n\t"
        "movl %%eax, 56(%%ebp)\n\t"
        "popl %%ebp\n\t"
        "popl %%ebx\n\t"
        : "+r"(p)
        :
        : "eax", "ecx", "edx", "esi", "edi", "cc", "memory");
    return g_pkt.ret;
}

static __attribute__((noinline)) uint32_t safe_invoke_ex(
    int is_com,
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
    uint32_t s2,
    uint32_t s3,
    uint32_t s4,
    uint32_t s5,
    int *pAsserted) {
    uintptr_t rebase = is_com ? g_com_rebase : g_game_rebase;
    g_pkt.fn      = canon_va + (uint32_t)rebase;
    g_pkt.r_eax   = r_eax;
    g_pkt.r_ecx   = r_ecx;
    g_pkt.r_edx   = r_edx;
    g_pkt.r_ebx   = r_ebx;
    g_pkt.r_esi   = r_esi;
    g_pkt.r_edi   = r_edi;
    g_pkt.s[0]    = s0;
    g_pkt.s[1]    = s1;
    g_pkt.s[2]    = s2;
    g_pkt.s[3]    = s3;
    g_pkt.s[4]    = s4;
    g_pkt.s[5]    = s5;
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
        U32(ARENA_BITMASKS + i * 4u)     = (1u << i);
        U32(ARENA_INV_BITMASKS + i * 4u) = ~(1u << i);
    }

    /* StatesTxt: count = 185 (0xB9), stride = 0x3C */
    U32(ARENA_SGPT + 0x00BCu) = ARENA_STATES;
    U32(ARENA_SGPT + 0x00C4u) = 185u;

    /* SkillsTxt: count = 8, stride = 0x23C */
    U32(ARENA_SGPT + 0x0B98u) = ARENA_SKILLS;
    U32(ARENA_SGPT + 0x0BA0u) = 8u;
    for (uint32_t s = 0; s < 8u; s++) {
        uint32_t rec = ARENA_SKILLS + s * 0x23Cu;
        U16(rec + 0x000u) = (uint16_t)s;
        S16(rec + 0x12Cu) = (s == 0u) ? 0 : (int16_t)(15 + s * 5);
        S32(rec + 0x148u) = (int32_t)(12 + s * 7);
        S32(rec + 0x14Cu) = (int32_t)(4 + s * 3);
        S32(rec + 0x150u) = (int32_t)(25 + s * 11);
        S32(rec + 0x154u) = (int32_t)(5 + s * 2);
    }

    /* MonStatsTxt: count = 400 (allocated first 64 records), stride = 0x1A8 */
    U32(ARENA_SGPT + 0x0A78u) = ARENA_MONSTATS;
    U32(ARENA_SGPT + 0x0A80u) = 400u;
    /* Slot 0: has MONSTATS flag bit 0x10 (byte +0x0E bit 0 = 1 << (0x10 - 0x10) -> dwFlags at +0x0C = (1 << 16)) */
    U32(ARENA_MONSTATS + 0u * 0x1A8u + 0x0Cu) = (1u << 16);
    S16(ARENA_MONSTATS + 0u * 0x1A8u + 0x02u) = 0;
    /* Slot 1: lacks flag 0x10 */
    U32(ARENA_MONSTATS + 1u * 0x1A8u + 0x0Cu) = 0u;
    S16(ARENA_MONSTATS + 1u * 0x1A8u + 0x02u) = 1;
    /* Slot 19 (0x13) & Slot 58 (0x3A) for REGPOP_RemapDirectionalMonsterClassId */
    S16(ARENA_MONSTATS + 0x13u * 0x1A8u + 0x02u) = 0x13;
    S16(ARENA_MONSTATS + 0x3Au * 0x1A8u + 0x02u) = 0x3A;

    /* MissilesTxt: count = 8, stride = 0x1A4 */
    U32(ARENA_SGPT + 0x0B64u) = ARENA_MISSILES;
    U32(ARENA_SGPT + 0x0B6Cu) = 8u;
    /* Missile 0: dwFlags (+0x04) = (1 << 4), dwParam1 (+0x4C) = 5, dwHitPar0 (+0x78) = 35, nEType (+0xE4) = 4 (cold) */
    U32(ARENA_MISSILES + 0u * 0x1A4u + 0x04u) = (1u << 4);
    S32(ARENA_MISSILES + 0u * 0x1A4u + 0x4Cu) = 5;
    S32(ARENA_MISSILES + 0u * 0x1A4u + 0x78u) = 35;
    U8(ARENA_MISSILES  + 0u * 0x1A4u + 0xE4u) = 4u;
    /* Missile 1: dwFlags = 0, dwParam1 = 10, dwHitPar0 = 0 (falls back to skill), nEType = 5 (pois) */
    U32(ARENA_MISSILES + 1u * 0x1A4u + 0x04u) = 0u;
    S32(ARENA_MISSILES + 1u * 0x1A4u + 0x4Cu) = 10;
    S32(ARENA_MISSILES + 1u * 0x1A4u + 0x78u) = 0;
    U8(ARENA_MISSILES  + 1u * 0x1A4u + 0xE4u) = 5u;
    /* Missile 2: nEType = 11 (burn) */
    U32(ARENA_MISSILES + 2u * 0x1A4u + 0x04u) = (1u << 4);
    S32(ARENA_MISSILES + 2u * 0x1A4u + 0x4Cu) = 3;
    S32(ARENA_MISSILES + 2u * 0x1A4u + 0x78u) = 50;
    U8(ARENA_MISSILES  + 2u * 0x1A4u + 0xE4u) = 11u;
    /* Missile 3: nEType = 9 (stun), Missile 4: nEType = 1 (fire) */
    U8(ARENA_MISSILES  + 3u * 0x1A4u + 0xE4u) = 9u;
    U8(ARENA_MISSILES  + 4u * 0x1A4u + 0xE4u) = 1u;

    /* ObjectsTxt: count = 6, stride = 0x1C0; dwParm0 at +0x17C */
    S32(ARENA_OBJECTS + 0u * 0x1C0u + 0x17Cu) = 0;
    S32(ARENA_OBJECTS + 1u * 0x1C0u + 0x17Cu) = 0x123;
    S32(ARENA_OBJECTS + 2u * 0x1C0u + 0x17Cu) = 0x300; /* >= 0x23D -> fallback 0x54 */

    /* ItemsTxt: count = 4, stride = 0x1A8; dwCode at +0x80 */
    U32(ARENA_ITEMS + 0u * 0x1A8u + 0x80u) = 0x20656369u; /* 'ice ' */
    U32(ARENA_ITEMS + 1u * 0x1A8u + 0x80u) = 0x20317068u; /* 'hp1 ' */
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
    const char *modName,
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
    fprintf(fp, "{\"mod\":\"%s\",\"va\":\"0x%08X\",\"name\":\"%s\",\"caseIndex\":%d,\"inputs\":{\"args\":[",
            modName, va, name, caseIdx);
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

#define RUN_EX(iscom, va, nm, cidx, args_arr, nargs, reax, recx, redx, rebx, resi, redi, nstk, s0, s1, s2, s3, s4, s5, mask, wlen) \
    do {                                                                                                                            \
        uint8_t pre_snap[ARENA_WORK_SIZE];                                                                                          \
        uint8_t post_snap[ARENA_WORK_SIZE];                                                                                         \
        memcpy(pre_snap, (const void *)(uintptr_t)ARENA_WORK, (wlen));                                                              \
        int did_assert = 0;                                                                                                         \
        uint32_t rv = safe_invoke_ex((iscom), (va), (reax), (recx), (redx), (rebx), (resi), (redi),                                 \
                                     (nstk), (s0), (s1), (s2), (s3), (s4), (s5), &did_assert);                                      \
        memcpy(post_snap, (const void *)(uintptr_t)ARENA_WORK, (wlen));                                                             \
        emit_case_line(fp, (iscom) ? "D2Common" : "D2Game", (va), (nm), (cidx), (args_arr), (nargs),                                \
                       pre_snap, (wlen), did_assert, g_assert_line, rv, (mask), post_snap);                                         \
    } while (0)

#define RUN_GAME(va, nm, cidx, args_arr, nargs, reax, recx, redx, rebx, resi, redi, nstk, s0, s1, mask, wlen) \
    RUN_EX(0, (va), (nm), (cidx), (args_arr), (nargs), (reax), (recx), (redx), (rebx), (resi), (redi),        \
           (nstk), (s0), (s1), 0u, 0u, 0u, 0u, (mask), (wlen))

/* Helper: set/read quest bit in D2QuestRecordStrc (pFlags -> [pBitBuf] at +0x00) */
static void init_quest_flags(uint32_t pFlags, uint32_t pBitBuf) {
    U32(pFlags + 0x00u) = pBitBuf;
}

static void set_qbit(uint32_t pBitBuf, uint32_t qid, uint32_t bit) {
    uint32_t idx = (qid << 4) + bit;
    U8(pBitBuf + (idx >> 3)) |= (uint8_t)(1u << (idx & 7u));
}

/* Helper: build player + playerData + questFlags[diff] */
static void init_player_with_qflags(
    uint32_t pGame, uint8_t diff, uint32_t pPlayer, uint32_t guid,
    uint32_t pPd, uint32_t pFlags, uint32_t pBitBuf) {
    U8(pGame + 0x6Du) = diff;
    U32(pPlayer + 0x00u) = 0u; /* UNIT_PLAYER */
    U32(pPlayer + 0x0Cu) = guid;
    U32(pPlayer + 0x10u) = 1u; /* neutral anim mode */
    U32(pPlayer + 0x14u) = pPd;
    U32(pPlayer + 0x80u) = pGame;
    U32(pPd + 0x10u + (uint32_t)diff * 4u) = pFlags;
    init_quest_flags(pFlags, pBitBuf);
}

/* Helper: attach room1 -> room2 -> level(levelId) to dynamic unit via pDynamicPath */
static void attach_unit_room_level(
    uint32_t pUnit, uint32_t pPath, uint16_t x, uint16_t y,
    uint32_t pRoom1, uint32_t pRoom2, uint32_t pLevel, uint32_t levelId, uint32_t pRefreshWord) {
    U32(pUnit + 0x2Cu)  = pPath;
    U16(pPath + 0x02u)  = x;
    U16(pPath + 0x06u)  = y;
    U32(pPath + 0x1Cu)  = pRoom1;
    U32(pRoom1 + 0x10u) = pRoom2;
    U32(pRoom1 + 0x2Cu) = pRefreshWord;
    U32(pRoom2 + 0x58u) = pLevel;
    U32(pLevel + 0x1D0u) = levelId;
}

/* Helper: single quest node in pGame->pQuestControl (+0x10F4) */
static void attach_quest_node(
    uint32_t pGame, uint32_t pQCtrl, uint32_t pQuest, uint32_t nQuestNo, uint32_t pQEx) {
    U32(pGame + 0x10F4u) = pQCtrl;
    U32(pQCtrl + 0x00u)  = pQuest;
    U32(pQCtrl + 0x08u)  = 1u; /* bInitialized */
    U32(pQuest + 0x00u)  = nQuestNo;
    U32(pQuest + 0x04u)  = pGame;
    U32(pQuest + 0x18u)  = pQEx;
}

/* Helper: attach 'ice ' quest item onto pPlayer->pInventory->pCursorItem */
static void attach_cursor_ice_item(uint32_t pPlayer, uint32_t pInv, uint32_t pItem, uint32_t pItemData, uint32_t classId) {
    U32(pPlayer + 0x60u) = pInv;
    U32(pInv + 0x00u)    = 0x01020304u;
    U32(pInv + 0x20u)    = pItem;
    U32(pItem + 0x00u)   = 4u; /* UNIT_ITEM */
    U32(pItem + 0x04u)   = classId;
    U32(pItem + 0x14u)   = pItemData;
}

static void emit_all_vectors(FILE *fp) {
    /* =========================================================================
     * PART A: Final 2 D2Common.dll Functions (1,479 / 1,479 = 100.00%)
     * ========================================================================= */
    {
        /* A1. D2Common 0x6FD87470: ENVIRONMENT_GetTimeOfDayAndAngle (stdcall pAct, pOutAngle, ret 8) */
        for (int c = 0; c < 4; c++) {
            reset_work();
            uint32_t pAct = (c == 0) ? 0u : ARENA_WORK;
            uint32_t pEnv = ARENA_WORK + 0x20u;
            uint32_t pOut = ARENA_WORK + 0x60u;
            U32(pOut) = 0xDEADBEEFu;
            if (c == 1) {
                U32(pAct + 0x04u) = 0u; /* NULL pEnv */
            } else if (c == 2) {
                U32(pAct + 0x04u) = pEnv;
                U32(pEnv + 0x04u) = 2u;    /* nTimeOfDay */
                U32(pEnv + 0x08u) = 5400u; /* dwTicks */
                U32(pEnv + 0x28u) = 40u;   /* dwCyclePeriod -> angle = 135 */
            } else if (c == 3) {
                U32(pAct + 0x04u) = pEnv;
                U32(pEnv + 0x04u) = 3u;
                U32(pEnv + 0x08u) = 900u;
                U32(pEnv + 0x28u) = 0u;    /* period == 0 -> angle = 0 */
            }
            uint32_t args[2] = {pAct, pOut};
            RUN_EX(1, 0x6FD87470u, "ENVIRONMENT_GetTimeOfDayAndAngle113c", c, args, 2,
                   0u, 0u, 0u, 0u, 0u, 0u, 2u, pAct, pOut, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x80u);
        }

        /* A2. D2Common 0x6FD96330: ITEMS_CalcByTimeStat (stdcall raw, tod, angle, pPer, pMin, pMax, ret 0x18) */
        const int32_t params[4][5] = {
            {0,  10,  50, 0,   0},
            {1, -20,  40, 1, 270},
            {2,   0, 120, 2,  90},
            {3,   5,  95, 3, 650},
        };
        for (int c = 0; c < 4; c++) {
            reset_work();
            uint32_t per = (uint32_t)(params[c][0] & 3);
            uint32_t mn  = (uint32_t)((params[c][1] + 0x100) & 0x3FF);
            uint32_t mx  = (uint32_t)((params[c][2] + 0x100) & 0x3FF);
            uint32_t raw = per | (mn << 2) | (mx << 12);
            uint32_t tod = (uint32_t)params[c][3];
            uint32_t ang = (uint32_t)params[c][4];
            uint32_t pPer = (c == 2) ? 0u : (ARENA_WORK + 0x00u);
            uint32_t pMin = ARENA_WORK + 0x04u;
            uint32_t pMax = (c == 2) ? 0u : (ARENA_WORK + 0x08u);
            uint32_t args[6] = {raw, tod, ang, pPer, pMin, pMax};
            RUN_EX(1, 0x6FD96330u, "ITEMS_CalcByTimeStat113c", c, args, 6,
                   0u, 0u, 0u, 0u, 0u, 0u, 6u, raw, tod, ang, pPer, pMin, pMax, 0xFFFFFFFFu, 0x20u);
        }
    }

    /* =========================================================================
     * PART B: 123 Un-Verified D2Game.dll Functions in 0x6FC20000..0x6FC7FFFF
     * ========================================================================= */

    /* 1. 0x6FC21720: PLAYER_GetWaypointDataForDifficulty (eax=pPlayer, s0=pGame, ret 4) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pPlayer = ARENA_WORK + 0x80u, pPd = ARENA_WORK + 0x120u;
        U8(pGame + 0x6Du) = (uint8_t)c;
        U32(pPlayer + 0x00u) = 0u;
        U32(pPlayer + 0x14u) = pPd;
        U32(pPd + 0x1Cu) = 0x1010u;
        U32(pPd + 0x20u) = 0x2020u;
        U32(pPd + 0x24u) = 0x3030u;
        uint32_t args[2] = {pPlayer, pGame};
        RUN_GAME(0x6FC21720u, "PLAYER_GetWaypointDataForDifficulty_6FC21720_113c", c, args, 2,
                 pPlayer, 0u, 0u, 0u, 0u, 0u, 1u, pGame, 0u, 0xFFFFFFFFu, 0x160u);
    }

    /* 2 & 3. 0x6FC21F60 & 0x6FC21FE0: STORM_TSListDestroySehWrapper & STORM_TSListDestroy ([esp+4]=pList, ret 4) */
    {
        const struct { uint32_t va; const char *nm; } lfns[2] = {
            {0x6FC21F60u, "STORM_TSListDestroySehWrapper_6FC21F60_113c"},
            {0x6FC21FE0u, "STORM_TSListDestroy_6FC21FE0_113c"},
        };
        for (int f = 0; f < 2; f++) {
            for (int c = 0; c < 3; c++) {
                reset_work();
                uint32_t pList = ARENA_WORK, term = pList + 4u;
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
                    uint32_t n0 = ARENA_WORK + 0x40u, n1 = ARENA_WORK + 0x80u;
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
                RUN_GAME(lfns[f].va, lfns[f].nm, c, args, 1,
                         0u, 0u, 0u, 0u, 0u, 0u, 1u, pList, 0u, 0x00000000u, 0xA0u);
            }
        }
    }

    /* 4. 0x6FC22060: STORM_TSHashTableAllocUniqueKey (edi=pHashTable -> eax) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pTbl = ARENA_WORK, pBuckets = ARENA_WORK + 0x60u;
        U32(pTbl + 0x1Cu) = pBuckets;
        U32(pTbl + 0x24u) = 3u;
        for (uint32_t b = 0; b < 4u; b++) {
            uint32_t bk = pBuckets + b * 12u, bt = bk + 4u;
            U32(bk + 0x00u) = 4u;
            U32(bt + 0x00u) = bt;
            U32(bk + 0x08u) = ~bt;
        }
        if (c == 0) {
            U32(pTbl + 0x48u) = 41u;
            U32(pTbl + 0x4Cu) = 0u;
        } else if (c == 1) {
            U32(pTbl + 0x48u) = 0xFFFFFFFFu;
            U32(pTbl + 0x4Cu) = 0u;
        } else {
            uint32_t b1 = pBuckets + 12u, nA = ARENA_WORK + 0x100u;
            U32(b1 + 0x04u) = nA + 4u;
            U32(b1 + 0x08u) = nA;
            U32(nA + 0x00u) = 0x11110001u;
            U32(nA + 0x04u) = b1 + 4u;
            U32(nA + 0x08u) = ~(b1 + 4u);
            U32(pTbl + 0x48u) = 0x11110000u;
            U32(pTbl + 0x4Cu) = 1u;
        }
        uint32_t args[1] = {pTbl};
        RUN_GAME(0x6FC22060u, "STORM_TSHashTableAllocUniqueKey_6FC22060_113c", c, args, 1,
                 0u, 0u, 0u, 0u, 0u, pTbl, 0u, 0u, 0u, 0xFFFFFFFFu, 0x140u);
    }

    /* 5. 0x6FC225A0: STORM_TSListPlacementNewDefault ([esp+4]=pList, ret 4 -> eax) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pList = (c == 0) ? 0u : (ARENA_WORK + (uint32_t)c * 0x20u);
        uint32_t args[1] = {pList};
        RUN_GAME(0x6FC225A0u, "STORM_TSListPlacementNewDefault_6FC225A0_113c", c, args, 1,
                 0u, 0u, 0u, 0u, 0u, 0u, 1u, pList, 0u, 0xFFFFFFFFu, 0x60u);
    }

    /* 6. 0x6FC226F0: STORM_TSListPlacementNewCopy (ecx=pSrcList, [esp+4]=pDstList, ret 4 -> eax; TS(pDst, pSrc)) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pSrc = ARENA_WORK + 0x80u;
        U32(pSrc) = 0x08u + (uint32_t)c * 4u;
        uint32_t pDst = (c == 0) ? 0u : (ARENA_WORK + (uint32_t)c * 0x20u);
        uint32_t args[2] = {pDst, pSrc};
        RUN_GAME(0x6FC226F0u, "STORM_TSListPlacementNewCopy_6FC226F0_113c", c, args, 2,
                 0u, pSrc, 0u, 0u, 0u, 0u, 1u, pDst, 0u, 0xFFFFFFFFu, 0x90u);
    }

    /* 7. 0x6FC2E130: ITEMS_CalcDiminishingMfPercent (ecx=nMf, edx=nFactor, s0=nScale, ret 4 -> eax) */
    {
        const int32_t mfs[3][3] = {{85, 250, 250}, {200, 250, 250}, {400, 500, 500}};
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t mf = (uint32_t)mfs[c][0], fac = (uint32_t)mfs[c][1], scl = (uint32_t)mfs[c][2];
            uint32_t args[3] = {mf, fac, scl};
            RUN_GAME(0x6FC2E130u, "ITEMS_CalcDiminishingMfPercent_6FC2E130_113c", c, args, 3,
                     0u, mf, fac, 0u, 0u, 0u, 1u, scl, 0u, 0xFFFFFFFFu, 32u);
        }
    }

    /* 8. 0x6FC2E150: ITEMS_IsItemInUnitInventoryOrCursor (ecx=pOwner, edi=pTarget, eax=pInvOverride -> eax) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pOwner = ARENA_WORK, pInv = ARENA_WORK + 0x100u;
        uint32_t pCur = ARENA_WORK + 0x140u, pItm = ARENA_WORK + 0x240u, pItmDat = ARENA_WORK + 0x340u;
        U32(pOwner + 0x60u) = pInv;
        U32(pInv + 0x00u) = 0x01020304u;
        U32(pInv + 0x0Cu) = pItm;
        U32(pInv + 0x20u) = pCur;
        U32(pCur + 0x00u) = 4u;
        U32(pItm + 0x00u) = 4u;
        U32(pItm + 0x14u) = pItmDat;
        uint32_t pTarget = (c == 0) ? pCur : (c == 1 ? pItm : (ARENA_WORK + 0x400u));
        uint32_t args[3] = {pOwner, pTarget, 0u};
        RUN_GAME(0x6FC2E150u, "ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c", c, args, 3,
                 0u, pOwner, 0u, 0u, 0u, pTarget, 0u, 0u, 0u, 0xFFFFFFFFu, 0x3C0u);
    }

    /* 9 & 10. 0x6FC2E310 & 0x6FC2E390: ITEMS_GetVendor{Mana,Health}PotionCode (eax=pUnit -> eax) */
    {
        const struct { uint32_t va; const char *nm; } vfns[2] = {
            {0x6FC2E310u, "ITEMS_GetVendorManaPotionCode_6FC2E310_113c"},
            {0x6FC2E390u, "ITEMS_GetVendorHealthPotionCode_6FC2E390_113c"},
        };
        const uint32_t lvls[3] = {1u, 40u, 75u};
        const uint8_t  difs[3] = {0u, 0u,  1u};
        for (int f = 0; f < 2; f++) {
            for (int c = 0; c < 3; c++) {
                reset_work();
                uint32_t pGame = ARENA_WORK, pUnit = ARENA_WORK + 0x80u, pPath = ARENA_WORK + 0x180u;
                uint32_t pR1 = ARENA_WORK + 0x200u, pR2 = ARENA_WORK + 0x260u, pLvl = ARENA_WORK + 0x300u;
                U8(pGame + 0x6Du) = difs[c];
                U32(pUnit + 0x00u) = 1u;
                U32(pUnit + 0x80u) = pGame;
                attach_unit_room_level(pUnit, pPath, 100u, 100u, pR1, pR2, pLvl, lvls[c], ARENA_WORK + 0x500u);
                uint32_t args[1] = {pUnit};
                RUN_GAME(vfns[f].va, vfns[f].nm, c, args, 1,
                         pUnit, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x510u);
            }
        }
    }

    /* 11. 0x6FC35570: AI_CheckAnyMinionDeadCallback (ecx=pMinion, edx=pOutHasDead, s0=0, ret 4) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pOut = ARENA_WORK + (uint32_t)c * 0x10u;
        uint32_t pMin = (c == 0) ? 0u : (ARENA_WORK + 0x40u);
        if (c >= 1) {
            U32(pMin + 0x00u) = 1u;
            U32(pMin + 0x10u) = (c == 1) ? 1u : 12u; /* mode 1=alive, 12=dead */
        }
        uint32_t args[3] = {pMin, pOut, 0u};
        RUN_GAME(0x6FC35570u, "AI_CheckAnyMinionDeadCallback113c", c, args, 3,
                 0u, pMin, pOut, 0u, 0u, 0u, 1u, 0u, 0u, 0x00000000u, 0x80u);
    }

    /* 12. 0x6FC35590: AI_CountAdjacentUnitsCallback ([esp+4]=pCandidate, [esp+8]=pScanCtx, ret 8) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pCtx = ARENA_WORK, pOrig = ARENA_WORK + 0x40u, pPathO = ARENA_WORK + 0x140u;
        uint32_t pCand = (c == 0) ? pOrig : (ARENA_WORK + 0x200u), pPathC = ARENA_WORK + 0x300u;
        U32(pOrig + 0x00u) = 1u; U32(pOrig + 0x2Cu) = pPathO; U16(pPathO + 0x02u) = 50u; U16(pPathO + 0x06u) = 50u;
        U32(pCtx + 0x00u) = pOrig;
        U32(pCtx + 0x08u) = 3u;
        if (c >= 1) {
            U32(pCand + 0x00u) = 1u; U32(pCand + 0x2Cu) = pPathC;
            U16(pPathC + 0x02u) = (c == 1) ? 51u : 80u;
            U16(pPathC + 0x06u) = 50u;
        }
        uint32_t args[2] = {pCand, pCtx};
        RUN_GAME(0x6FC35590u, "AI_CountAdjacentUnitsCallback_6FC35590_113c", c, args, 2,
                 0u, 0u, 0u, 0u, 0u, 0u, 2u, pCand, pCtx, 0x00000000u, 0x340u);
    }

    /* 13. 0x6FC358F0: AI_UpdateCloserTrackedTargetGuid (esi=pMonster, [esp+4]=pCandidateTarget, ret 4) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pMon = ARENA_WORK + 0x1600u, pMd = ARENA_WORK + 0x1700u, pAiG = ARENA_WORK + 0x1760u;
        uint32_t pPathM = ARENA_WORK + 0x17C0u, pCand = ARENA_WORK + 0x1820u, pPathC = ARENA_WORK + 0x1920u;
        uint32_t pCur = ARENA_WORK + 0x1980u, pPathCur = ARENA_WORK + 0x1A80u;
        U32(pMon + 0x00u) = 1u; U32(pMon + 0x14u) = pMd; U32(pMon + 0x2Cu) = pPathM; U32(pMon + 0x80u) = pGame;
        U16(pPathM + 0x02u) = 100u; U16(pPathM + 0x06u) = 100u;
        U32(pMd + 0x28u) = pAiG;
        U32(pAiG + 0x14u) = 10u; /* curGuid = 10 */
        uint32_t candArg = 0u;
        if (c >= 1) {
            candArg = pCand;
            U32(pCand + 0x00u) = 1u; U32(pCand + 0x0Cu) = 25u; U32(pCand + 0x2Cu) = pPathC;
            U16(pPathC + 0x02u) = (c == 1) ? 105u : 102u; U16(pPathC + 0x06u) = 100u;
        }
        if (c == 2) {
            U32(pCur + 0x00u) = 1u; U32(pCur + 0x0Cu) = 10u; U32(pCur + 0x2Cu) = pPathCur;
            U16(pPathCur + 0x02u) = 120u; U16(pPathCur + 0x06u) = 100u;
            U32(pGame + 0x1320u + (10u & 0x7Fu) * 4u) = pCur;
        }
        uint32_t args[2] = {pMon, candArg};
        RUN_GAME(0x6FC358F0u, "AI_UpdateCloserTrackedTargetGuid_6FC358F0_113c", c, args, 2,
                 0u, 0u, 0u, 0u, pMon, 0u, 1u, candArg, 0u, 0x00000000u, 0x1B00u);
    }

    /* 14. 0x6FC3EC40: MONREG_DeleteInactiveMonsterByClassId (ebx=pGame, eax=nAct, ecx=wClassId) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pRoomNode = ARENA_WORK + 0x100u;
        uint32_t pMon0 = ARENA_WORK + 0x140u, pMon1 = ARENA_WORK + 0x1C0u;
        U32(pGame + 0xD8u + 1u * 4u) = pRoomNode;
        U32(pRoomNode + 0x0Cu) = pMon0;
        U32(pMon0 + 0x08u) = 55u;
        U32(pMon0 + 0x58u) = pMon1;
        U32(pMon1 + 0x08u) = 77u;
        uint32_t wCls = (c == 0) ? 99u : (c == 1 ? 55u : 77u);
        uint32_t args[3] = {pGame, 1u, wCls};
        RUN_GAME(0x6FC3EC40u, "MONREG_DeleteInactiveMonsterByClassId_6FC3EC40_113c", c, args, 3,
                 1u, wCls, 0u, pGame, 0u, 0u, 0u, 0u, 0u, 0x00000000u, 0x240u);
    }

    /* 15. 0x6FC40D50: AIGENERAL_GetOwnerData (eax=pUnit, edx=pOutOwnerId, s0=pOutOwnerType, ret 4) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pOutId = ARENA_WORK + 0x00u, pOutTy = ARENA_WORK + 0x04u;
        U32(pOutId) = 0x1111u; U32(pOutTy) = 0x2222u;
        uint32_t pUnit = (c == 0) ? 0u : (ARENA_WORK + 0x20u);
        if (c >= 1) {
            uint32_t pMd = ARENA_WORK + 0x60u, pAiG = ARENA_WORK + 0xA0u;
            U32(pUnit + 0x00u) = 1u; U32(pUnit + 0x14u) = pMd; U32(pMd + 0x28u) = pAiG;
            U32(pAiG + 0x28u) = (c == 1) ? 0u : (ARENA_WORK + 0x100u);
            U32(pAiG + 0x2Cu) = 0x42u;
            U32(pAiG + 0x30u) = 0u;
        }
        uint32_t args[3] = {pUnit, pOutId, pOutTy};
        RUN_GAME(0x6FC40D50u, "AIGENERAL_GetOwnerData_6FC40D50_113c", c, args, 3,
                 pUnit, 0u, pOutId, 0u, 0u, 0u, 1u, pOutTy, 0u, 0x00000000u, 0xE0u);
    }

    /* 16. 0x6FC41040: AIGENERAL_DissolveMinionPackLeaderRefs (eax=pAiGeneral) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pAiG = ARENA_WORK + 0x1600u, pN0 = ARENA_WORK + 0x1660u;
        uint32_t pMin = ARENA_WORK + 0x1680u, pMd = ARENA_WORK + 0x1780u, pMinAi = ARENA_WORK + 0x17C0u;
        U32(pAiG + 0x28u) = pGame;
        if (c >= 1) {
            U32(pAiG + 0x34u) = pN0;
            U32(pN0 + 0x00u)  = 9u;
            if (c == 2) {
                U32(pMin + 0x00u) = 1u; U32(pMin + 0x0Cu) = 9u; U32(pMin + 0x14u) = pMd;
                U32(pMd + 0x28u)  = pMinAi;
                U32(pMinAi + 0x2Cu) = 5u;
                U32(pGame + 0x1320u + (9u & 0x7Fu) * 4u) = pMin;
            }
        }
        if (c == 1) {
            U32(pAiG + 0x00u) = 0x99u; /* make workHex distinct from c==0 when minion not found */
        }
        uint32_t args[1] = {pAiG};
        RUN_GAME(0x6FC41040u, "AIGENERAL_DissolveMinionPackLeaderRefs_6FC41040_113c", c, args, 1,
                 pAiG, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0x00000000u, 0x1820u);
    }

    /* 17. 0x6FC41210: AIGENERAL_ReplaceMinionListAndInitBossGroup
     *     (eax=pGame, ebx=pUnit, s0=nLeaderId, s1=nLeaderType, s2=bIsGroupMember, s3=bIsBoss, s4=pNewList, ret 0x14) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pUnit = (c == 0) ? 0u : (ARENA_WORK + 0x80u);
        uint32_t pMd = ARENA_WORK + 0x180u, pAiG = ARENA_WORK + 0x1C0u;
        uint32_t pNew = (c == 2) ? (ARENA_WORK + 0x220u) : 0u;
        if (c >= 1) {
            U32(pUnit + 0x00u) = 1u; U32(pUnit + 0x14u) = pMd; U32(pMd + 0x28u) = pAiG;
        }
        uint32_t lid = 10u + (uint32_t)c, lty = 1u, grp = (c == 2) ? 1u : 0u, bos = (c == 1) ? 1u : 0u;
        uint32_t args[7] = {pGame, pUnit, lid, lty, grp, bos, pNew};
        RUN_EX(0, 0x6FC41210u, "AIGENERAL_ReplaceMinionListAndInitBossGroup_6FC41210_113c", c, args, 7,
               pGame, 0u, 0u, pUnit, 0u, 0u, 5u, lid, lty, grp, bos, pNew, 0u, 0x00000000u, 0x240u);
    }

    /* 18. 0x6FC41A70: MONUMOD_SetShatterOnDeath (ecx=pGame, edx=pMonster, s0=nUModId, s1=bUnique, ret 8) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pMon = (c == 0) ? 0u : (ARENA_WORK + 0x40u);
        uint32_t pListEx = ARENA_WORK + 0x140u, pStateFlags = ARENA_WORK + 0x1C0u;
        if (c >= 1) {
            U32(pMon + 0x00u) = 1u;
            U32(pMon + 0x10u) = (c == 1) ? 0u : 2u; /* mode 0 toggles state 0x6B; mode 2 skips */
            U32(pMon + 0x5Cu) = pListEx;
            U32(pListEx + 0x10u) = 0x80000000u;
            U32(pListEx + 0x58u) = pStateFlags;
        }
        uint32_t args[4] = {pGame, pMon, 5u, 1u};
        RUN_GAME(0x6FC41A70u, "MONUMOD_SetShatterOnDeath_6FC41A70_113c", c, args, 4,
                 0u, pGame, pMon, 0u, 0u, 0u, 2u, 5u, 1u, 0x00000000u, 0x220u);
    }

    /* 19. 0x6FC4A700: CLIENT_SelectFlag20ClientCallback (ecx=pClient, edx=ppOutClient) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t ppOut = ARENA_WORK, pClient = ARENA_WORK + 0x20u + (uint32_t)c * 0x10u;
        U32(ppOut) = 0x1234u;
        U8(pClient + 0x3D4u) = (c == 0) ? 0x00u : 0x20u;
        uint32_t args[2] = {pClient, ppOut};
        RUN_GAME(0x6FC4A700u, "CLIENT_SelectFlag20ClientCallback_6FC4A700_113c", c, args, 2,
                 0u, pClient, ppOut, 0u, 0u, 0u, 0u, 0u, 0u, 0x00000000u, 0x420u);
    }

    /* 20. 0x6FC4E8B0: OBJECTS_SubstituteObjectClassIdFromParm0 (esi=pObject) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pObj = ARENA_WORK;
        U32(pObj + 0x00u) = 2u;
        U32(pObj + 0x04u) = (uint32_t)c; /* 0->0x54, 1->0x123, 2->0x54 */
        U32(pObj + 0x0Cu) = (uint32_t)c;
        uint32_t args[1] = {pObj};
        RUN_GAME(0x6FC4E8B0u, "OBJECTS_SubstituteObjectClassIdFromParm0_113c", c, args, 1,
                 0u, 0u, 0u, 0u, pObj, 0u, 0u, 0u, 0u, 0x00000000u, 0x40u);
    }

    /* 21. 0x6FC53970: QUESTS_CheckNotIntro ([esp+4]=pGame, [esp+8]=nQuestNo, ret 8 -> eax) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1120u, pQ = ARENA_WORK + 0x1160u;
        attach_quest_node(pGame, pQC, pQ, 5u, ARENA_WORK + 0x1280u);
        U8(pQ + 0x09u) = (c == 0) ? 0u : 1u;
        uint32_t qno = (c == 2) ? 99u : 5u;
        uint32_t args[2] = {pGame, qno};
        RUN_GAME(0x6FC53970u, "QUESTS_CheckNotIntro_6FC53970_113c", c, args, 2,
                 0u, 0u, 0u, 0u, 0u, 0u, 2u, pGame, qno, 0xFFFFFFFFu, 0x1290u);
    }

    /* 22. 0x6FC53A30: QUESTS_ResolveDefaultStatusByte (esi=pQuest, edi=pQuestFlags, ebx=pOutStateByte) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pQuest = ARENA_WORK, pFlags = ARENA_WORK + 0x100u, pBits = ARENA_WORK + 0x120u, pOut = ARENA_WORK + 0x1A0u;
        init_quest_flags(pFlags, pBits);
        U32(pQuest + 0x00u) = 5u;
        U32(pQuest + 0xE0u) = 5u;
        U8(pQuest + 0x0Bu) = 7u;
        if (c == 0) {
            U8(pQuest + 0x0Cu) = 1u; U8(pQuest + 0x0Du) = 3u;
            set_qbit(pBits, 5u, 0x0Eu); /* -> writes 0x0C */
        } else if (c == 1) {
            U8(pQuest + 0x0Cu) = 1u; U8(pQuest + 0x0Du) = 3u; /* -> writes 7 */
        } else {
            U8(pQuest + 0x0Cu) = 4u; U8(pQuest + 0x0Du) = 2u;
            set_qbit(pBits, 5u, 0x0Du);
            U8(pQuest + 0x0Bu) = 9u; /* -> writes 9 */
        }
        uint32_t args[3] = {pQuest, pFlags, pOut};
        RUN_GAME(0x6FC53A30u, "QUESTS_ResolveDefaultStatusByte_6FC53A30_113c", c, args, 3,
                 0u, 0u, 0u, pOut, pQuest, pFlags, 0u, 0u, 0u, 0x00000000u, 0x1B0u);
    }

    /* 23. 0x6FC53D90: QUESTS_GetQuestSeedPtr (eax=pGame -> eax) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1100u + (uint32_t)c * 0x40u;
        U32(pGame + 0x10F4u) = pQC;
        uint32_t args[1] = {pGame};
        RUN_GAME(0x6FC53D90u, "QUESTS_GetQuestSeedPtr_6FC53D90_113c", c, args, 1,
                 pGame, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x1200u);
    }

    /* 24. 0x6FC54020: QUESTS_CheckLevelTransitionBlocked (eax=pGame, ecx=nTargetLvl, s0=pUnit, s1=nSrcLvl, ret 8) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1100u, pQ = ARENA_WORK + 0x1140u, pQEx = ARENA_WORK + 0x1240u;
        attach_quest_node(pGame, pQC, pQ, 0x24u, pQEx);
        U8(pQEx + 0x86u) = (c == 1) ? 1u : 0u;
        uint32_t tgtLvl = (c == 0) ? 1u : 0x84u;
        uint32_t srcLvl = (c == 2) ? 0x83u : 0x78u;
        uint32_t args[4] = {pGame, tgtLvl, 0u, srcLvl};
        RUN_GAME(0x6FC54020u, "QUESTS_CheckLevelTransitionBlocked_6FC54020_113c", c, args, 4,
                 pGame, tgtLvl, 0u, 0u, 0u, 0u, 2u, 0u, srcLvl, 0xFFFFFFFFu, 0x12E0u);
    }

    /* 25. 0x6FC540C0: QUESTS_RemovePlayerGuidIfQuestState1AndNot0 (esi=pQuestData, ebx=pQuestArg) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQuest = ARENA_WORK + 0x80u, pArg = ARENA_WORK + 0x180u;
        uint32_t pPlr = ARENA_WORK + 0x1C0u, pPd = ARENA_WORK + 0x2C0u, pFl = ARENA_WORK + 0x360u, pBits = ARENA_WORK + 0x380u;
        init_player_with_qflags(pGame, 0u, pPlr, 77u, pPd, pFl, pBits);
        U32(pQuest + 0x04u) = pGame;
        U32(pQuest + 0xE0u) = 4u;
        U16(pQuest + 0x9Cu) = 1u;
        U32(pQuest + 0x1Cu) = 77u;
        U32(pArg + 0x0Cu)   = pPlr;
        if (c >= 1) set_qbit(pBits, 4u, 1u);
        if (c == 2) set_qbit(pBits, 4u, 0u);
        uint32_t args[2] = {pQuest, pArg};
        RUN_GAME(0x6FC540C0u, "QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c", c, args, 2,
                 0u, 0u, 0u, pArg, pQuest, 0u, 0u, 0u, 0u, 0x00000000u, 0x400u);
    }

    /* 26. 0x6FC54C70: QUESTS_PackNpcIntroFlags (eax=pPacket, edi=pNpcIds, s0=pQuestIntro, s1=nCount, ret 8) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pPkt = ARENA_WORK, pNpcIds = ARENA_WORK + 0x40u, pIntro = ARENA_WORK + 0x80u;
        uint32_t pBitRec = ARENA_WORK + 0x90u, pBits = ARENA_WORK + 0xA0u;
        U32(pIntro + 0x04u) = pBitRec;
        U32(pBitRec + 0x00u) = pBits;
        U32(pNpcIds + 0x00u) = 148u; /* Akara -> bit 1 */
        U32(pNpcIds + 0x04u) = 154u; /* Charsi -> bit 3 */
        if (c == 1) U8(pBits + 0u) = (1u << 1);
        if (c == 2) U8(pBits + 0u) = (1u << 1) | (1u << 3);
        uint32_t cnt = (c == 0) ? 0u : 2u;
        uint32_t args[4] = {pPkt, pNpcIds, pIntro, cnt};
        RUN_GAME(0x6FC54C70u, "QUESTS_PackNpcIntroFlags_6FC54C70_113c", c, args, 4,
                 pPkt, 0u, 0u, 0u, 0u, pNpcIds, 2u, pIntro, cnt, 0xFFFFFFFFu, 0xC0u);
    }

    /* 27. 0x6FC54D00: QUESTS_SetNpcIntroFlags (eax=pPlayer, edi=nCount, s0=pGame, s1=pNpcIds, ret 8) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pPlr = ARENA_WORK + 0x80u, pPd = ARENA_WORK + 0x180u;
        uint32_t pIntro = ARENA_WORK + 0x220u, pBitRec = ARENA_WORK + 0x230u, pBits = ARENA_WORK + 0x240u;
        uint32_t pNpcIds = ARENA_WORK + 0x280u;
        U8(pGame + 0x6Du) = 0u;
        U32(pPlr + 0x00u) = 0u; U32(pPlr + 0x14u) = pPd;
        U32(pPd + 0x60u) = pIntro; U32(pIntro + 0x04u) = pBitRec; U32(pBitRec) = pBits;
        U32(pNpcIds + 0x00u) = 148u;
        U32(pNpcIds + 0x04u) = 154u;
        uint32_t cnt = (uint32_t)c;
        uint32_t args[4] = {pPlr, cnt, pGame, pNpcIds};
        RUN_GAME(0x6FC54D00u, "QUESTS_SetNpcIntroFlags_6FC54D00_113c", c, args, 4,
                 pPlr, 0u, 0u, 0u, 0u, cnt, 2u, pGame, pNpcIds, 0x00000000u, 0x2A0u);
    }

    /* 28. 0x6FC55A20: QUESTS_CompleteQuestForPlayerGuidList (ebx=nQuestId, s0=pGame, s1=pGuidList, s2=wSoundId, ret 0xC) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pList = ARENA_WORK + 0x1600u;
        uint32_t pPlr = ARENA_WORK + 0x16A0u, pPd = ARENA_WORK + 0x17A0u, pFl = ARENA_WORK + 0x1840u, pBits = ARENA_WORK + 0x1860u;
        init_player_with_qflags(pGame, 0u, pPlr, 5u, pPd, pFl, pBits);
        U32(pGame + 0x1120u + (5u & 0x7Fu) * 4u) = pPlr;
        if (c >= 1) {
            U16(pList + 0x80u) = 1u;
            U32(pList + 0x00u) = 5u;
        }
        if (c == 2) {
            set_qbit(pBits, 3u, 0u); /* already completed */
        }
        uint32_t args[4] = {3u, pGame, pList, 0u};
        RUN_EX(0, 0x6FC55A20u, "QUESTS_CompleteQuestForPlayerGuidList_6FC55A20_113c", c, args, 4,
               0u, 0u, 0u, 3u, 0u, 0u, 3u, pGame, pList, 0u, 0u, 0u, 0u, 0x00000000u, 0x18D0u);
    }

    /* 29. 0x6FC55C20: QUESTS_ApplyActNpcIntroFlags (eax=pPlayerUnit, ecx=nAct, edx=pGame) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pPlr = ARENA_WORK + 0x80u, pPd = ARENA_WORK + 0x180u;
        uint32_t pIntro = ARENA_WORK + 0x220u, pBitRec = ARENA_WORK + 0x230u, pBits = ARENA_WORK + 0x240u;
        U8(pGame + 0x6Du) = 0u;
        U32(pPlr + 0x00u) = 0u; U32(pPlr + 0x14u) = pPd;
        U32(pPd + 0x60u) = pIntro; U32(pIntro + 0x04u) = pBitRec; U32(pBitRec) = pBits;
        uint32_t nAct = (c == 0) ? 3u : (c == 1 ? 0u : 4u); /* Act 4 no-op, Act 1, Act 5 */
        uint32_t args[3] = {pPlr, nAct, pGame};
        RUN_GAME(0x6FC55C20u, "QUESTS_ApplyActNpcIntroFlags_6FC55C20_113c", c, args, 3,
                 pPlr, nAct, pGame, 0u, 0u, 0u, 0u, 0u, 0u, 0x00000000u, 0x260u);
    }

    /* 30. 0x6FC57440: PLAYER_GetPlayerDataField48 (eax=pPlayer -> eax; asserts 0x24C / 0x24F) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pPlr = (c == 0) ? 0u : ARENA_WORK, pPd = ARENA_WORK + 0x100u;
        if (c >= 1) {
            U32(pPlr + 0x00u) = 0u;
            U32(pPlr + 0x14u) = (c == 1) ? 0u : pPd;
            U32(pPd + 0x48u)  = 0xCAFE1234u;
        }
        uint32_t args[1] = {pPlr};
        RUN_GAME(0x6FC57440u, "PLAYER_GetPlayerDataField48_6FC57440_113c", c, args, 1,
                 pPlr, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x160u);
    }

    /* 31. 0x6FC57500: PLAYER_FreePlayerDataList98 (ebx=pPlayerData, edi=pGame) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pPd = ARENA_WORK + 0x40u;
        uint32_t pN0 = ARENA_WORK + 0x100u, pN1 = ARENA_WORK + 0x120u;
        if (c == 1) U32(pPd + 0x98u) = pN0;
        if (c == 2) { U32(pPd + 0x98u) = pN0; U32(pN0 + 0x10u) = pN1; }
        uint32_t args[2] = {pPd, pGame};
        RUN_GAME(0x6FC57500u, "PLAYER_FreePlayerDataList98_6FC57500_113c", c, args, 2,
                 0u, 0u, 0u, pPd, 0u, pGame, 0u, 0u, 0u, 0x00000000u, 0x140u);
    }

    /* 32. 0x6FC576B0: PLAYER_FreePlayerDataQuestAndList98 (eax=pPlayerUnit, ecx=pGame) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pPlr = ARENA_WORK + 0x40u, pPd = ARENA_WORK + 0x140u;
        U32(pPlr + 0x00u) = 0u;
        U32(pPlr + 0x14u) = (c == 0) ? 0u : pPd;
        if (c >= 1) {
            for (uint32_t i = 0; i < 3u; i++) {
                uint32_t pPair = ARENA_WORK + 0x200u + i * 0x10u;
                U32(pPd + 0x60u + i * 4u) = pPair;
                if (c == 2 && i == 0u) U32(pPair + 0x00u) = ARENA_WORK + 0x240u;
            }
        }
        uint32_t args[2] = {pPlr, pGame};
        RUN_GAME(0x6FC576B0u, "PLAYER_FreePlayerDataQuestAndList98_6FC576B0_113c", c, args, 2,
                 pPlr, pGame, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0x00000000u, 0x260u);
    }

    /* 33. 0x6FC57940: PLAYER_CheckHostilePlayerCallback (ecx=pGame, edx=pIterPlayer, s0=pCtx, ret 4) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pCtx = ARENA_WORK, pSubj = ARENA_WORK + 0x20u, pSubjPd = ARENA_WORK + 0x120u;
        uint32_t pIter = ARENA_WORK + 0x180u, pHost = ARENA_WORK + 0x280u;
        U32(pCtx + 0x04u) = pSubj;
        U32(pSubj + 0x00u) = 0u; U32(pSubj + 0x14u) = pSubjPd;
        U32(pSubjPd + 0x38u) = pHost;
        U32(pIter + 0x00u) = 0u; U32(pIter + 0x0Cu) = 44u;
        U32(pHost + 0x00u) = 44u;
        U32(pHost + 0x04u) = (c == 2) ? 0x08u : 0x00u;
        uint32_t iterArg = (c == 0) ? pSubj : pIter;
        uint32_t args[3] = {0u, iterArg, pCtx};
        RUN_GAME(0x6FC57940u, "PLAYER_CheckHostilePlayerCallback113c", c, args, 3,
                 0u, 0u, iterArg, 0u, 0u, 0u, 1u, pCtx, 0u, 0x00000000u, 0x2A0u);
    }

    /* 34. 0x6FC58E70: MISSILES_SrvHit_MoveColdLenToFrzLen (ecx=pGame, edx=pMissile, s0=pTarget, s1=pDamage, ret 8) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pDmg = ARENA_WORK;
        U32(pDmg + 0x30u) = (uint32_t)c * 75u;
        uint32_t args[4] = {0u, 0u, 0u, pDmg};
        RUN_GAME(0x6FC58E70u, "MISSILES_SrvHit_MoveColdLenToFrzLen_6FC58E70_113c", c, args, 4,
                 0u, 0u, 0u, 0u, 0u, 0u, 2u, 0u, pDmg, 0x00000000u, 0x50u);
    }

    /* 35. 0x6FC58E90: MISSILES_SrvDo_ReturnTwoIfCollided (ecx=pGame, edx=pMissile, s0=bCollided, ret 4) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t bCol = (c == 0) ? 0u : (uint32_t)c;
        uint32_t args[3] = {0u, 0u, bCol};
        RUN_GAME(0x6FC58E90u, "MISSILES_SrvDo_ReturnTwoIfCollided_6FC58E90_113c", c, args, 3,
                 0u, 0u, 0u, 0u, 0u, 0u, 1u, bCol, 0u, 0xFFFFFFFFu, 32u);
    }

    /* 36. 0x6FC58EA0: MISSILES_SrvDo_ClearRoomPortalFlag (ecx=pGame, edx=pMissile, s0=bCollided, ret 4) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pMis = ARENA_WORK, pPath = ARENA_WORK + 0x100u, pR1 = ARENA_WORK + 0x160u, pR2 = ARENA_WORK + 0x1C0u;
        U32(pMis + 0x00u) = 3u;
        U32(pMis + 0x2Cu) = pPath;
        U32(pPath + 0x1Cu) = (c == 0) ? 0u : pR1;
        U32(pR1 + 0x10u) = pR2;
        U32(pR2 + 0x28u) = 0x200u; /* portal flag in room2->dwRoomFlags */
        uint32_t bCol = (c == 2) ? 1u : 0u;
        uint32_t args[3] = {0u, pMis, bCol};
        RUN_GAME(0x6FC58EA0u, "MISSILES_SrvDo_ClearRoomPortalFlag_6FC58EA0_113c", c, args, 3,
                 0u, 0u, pMis, 0u, 0u, 0u, 1u, bCol, 0u, 0xFFFFFFFFu, 0x200u);
    }

    /* 37. 0x6FC59040: MISSILES_SrvHit_CopyColdLenToFrzLen (ecx=pGame, edx=pMissile, s0=pTarget, s1=pDamage, ret 8) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pMis = (c == 0) ? 0u : ARENA_WORK, pDmg = ARENA_WORK + 0x100u;
        if (c >= 1) { U32(pMis + 0x00u) = 3u; U32(pMis + 0x04u) = 0u; }
        U32(pDmg + 0x30u) = 40u + (uint32_t)c * 25u;
        uint32_t args[4] = {0u, pMis, 0u, pDmg};
        RUN_GAME(0x6FC59040u, "MISSILES_SrvHit_CopyColdLenToFrzLen_6FC59040_113c", c, args, 4,
                 0u, 0u, pMis, 0u, 0u, 0u, 2u, 0u, pDmg, 0x00000000u, 0x150u);
    }

    /* 38. 0x6FC591A0: MISSILES_SrvDo_ExpireBeforeEndWindow (ecx=pGame, edx=pMissile, s0=bCollided, ret 4) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pMis = (c == 0) ? 0u : ARENA_WORK, pMd = ARENA_WORK + 0x100u;
        if (c >= 1) {
            U32(pMis + 0x00u) = 3u; U32(pMis + 0x04u) = 0u; U32(pMis + 0x14u) = pMd;
            S16(pMd + 0x0Eu) = 30; /* totalFrames = 30, dwParam1 = 5 -> threshold = 25 */
            S16(pMd + 0x10u) = (c == 1) ? 20 : 2; /* remaining: elapsed=10 (<25 -> 2) vs elapsed=28 (>=25 -> 0) */
        }
        uint32_t args[3] = {0u, pMis, 1u};
        RUN_GAME(0x6FC591A0u, "MISSILES_SrvDo_ExpireBeforeEndWindow_6FC591A0_113c", c, args, 3,
                 0u, 0u, pMis, 0u, 0u, 0u, 1u, 1u, 0u, 0xFFFFFFFFu, 0x130u);
    }

    /* 39. 0x6FC592E0: MISSILES_ResetDamageKeepETypeLen (eax=pMissile, esi=pDamage) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pMis = ARENA_WORK, pDmg = ARENA_WORK + 0x80u;
        U32(pMis + 0x00u) = 3u;
        U32(pMis + 0x04u) = (uint32_t)c; /* 0:cold(4), 1:pois(5), 2:burn(11) */
        U32(pDmg + 0x00u) = 0x0000FFFFu;
        U32(pDmg + 0x18u) = 11u;
        U32(pDmg + 0x2Cu) = 22u;
        U32(pDmg + 0x30u) = 33u;
        U32(pDmg + 0x34u) = 44u;
        uint32_t args[2] = {pMis, pDmg};
        RUN_GAME(0x6FC592E0u, "MISSILES_ResetDamageKeepETypeLen_6FC592E0_113c", c, args, 2,
                 pMis, 0u, 0u, 0u, pDmg, 0u, 0u, 0u, 0u, 0x00000000u, 0xE0u);
    }

    /* 40. 0x6FC594B0: MISSILES_SetElemLenByEType (eax=pMissile, edi=pDamage, esi=nLength) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pMis = ARENA_WORK, pDmg = ARENA_WORK + 0x80u;
        U32(pMis + 0x00u) = 3u;
        U32(pMis + 0x04u) = (uint32_t)c; /* 0:cold(+0x30), 1:pois(+0x2C), 2:burn(+0x18) */
        uint32_t len = 50u + (uint32_t)c * 25u;
        uint32_t args[3] = {pMis, pDmg, len};
        RUN_GAME(0x6FC594B0u, "MISSILES_SetElemLenByEType_6FC594B0_113c", c, args, 3,
                 pMis, 0u, 0u, 0u, len, pDmg, 0u, 0u, 0u, 0x00000000u, 0xE0u);
    }

    /* 41. 0x6FC59510: MISSILES_FilterFlagBit4Missile (ecx=pUnit -> eax) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pUnit = (c == 0) ? 0u : ARENA_WORK;
        if (c >= 1) {
            U32(pUnit + 0x00u) = 3u;
            U32(pUnit + 0x04u) = (c == 1) ? 0u : 1u; /* missile 0 has bit4=1, missile 1 has bit4=0 */
        }
        uint32_t args[1] = {pUnit};
        RUN_GAME(0x6FC59510u, "MISSILES_FilterFlagBit4Missile_6FC59510_113c", c, args, 1,
                 0u, pUnit, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x40u);
    }

    /* 42. 0x6FC59560: MISSILES_SrvHit_SetStunLenAndConv60 (ecx=pGame, edx=pMissile, s0=pTarget, s1=pDamage, ret 8) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pMis = (c == 0) ? 0u : ARENA_WORK, pMd = ARENA_WORK + 0x100u, pDmg = ARENA_WORK + 0x140u;
        if (c >= 1) {
            U32(pMis + 0x00u) = 3u; U32(pMis + 0x04u) = (c == 1) ? 0u : 1u; U32(pMis + 0x14u) = pMd;
            S16(pMd + 0x0Au) = 2; /* skill 2 -> dwParam2 = 10 when missile 1 has dwHitPar0 == 0 */
        }
        uint32_t args[4] = {0u, pMis, 0u, pDmg};
        RUN_GAME(0x6FC59560u, "MISSILES_SrvHit_SetStunLenAndConv60_6FC59560_113c", c, args, 4,
                 0u, 0u, pMis, 0u, 0u, 0u, 2u, 0u, pDmg, 0x00000000u, 0x1C0u);
    }

    /* 43. 0x6FC59600: MISSILE_InitMissileRangeAndFrameFlag (edx=pMissile, s0=pGame, s1=pOutData, ret 8) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pMis = (c == 0) ? 0u : ARENA_WORK, pMd = ARENA_WORK + 0x100u, pOut = ARENA_WORK + 0x140u;
        if (c >= 1) {
            U32(pMis + 0x00u) = 3u; U32(pMis + 0x04u) = (c == 1) ? 0u : 1u; U32(pMis + 0x14u) = pMd;
            S16(pMd + 0x0Au) = 3; /* skill 3 */
            S16(pMd + 0x0Cu) = 5; /* level 5 */
        }
        uint32_t args[3] = {pMis, 0u, pOut};
        RUN_GAME(0x6FC59600u, "MISSILE_InitMissileRangeAndFrameFlag_6FC59600_113c", c, args, 3,
                 0u, 0u, pMis, 0u, 0u, 0u, 2u, 0u, pOut, 0x00000000u, 0x1C0u);
    }

    /* 44. 0x6FC59C80: MISSILES_SrvHit_SetTargetFlag20000 (ecx=pGame, edx=pMissile, s0=pTarget, s1=pDamage, ret 8) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pMis = ARENA_WORK + 0x1600u, pOwn = ARENA_WORK + 0x1700u, pTgt = ARENA_WORK + 0x1800u;
        U32(pMis + 0x00u) = 3u; U32(pMis + 0x94u) = 0u; U32(pMis + 0x98u) = 3u; U32(pMis + 0xC8u) = 0x400u;
        U32(pOwn + 0x00u) = 0u; U32(pOwn + 0x0Cu) = 3u;
        U32(pOwn + 0xC4u) = (c == 1) ? (1u << 9) : 0u;
        if (c >= 1) U32(pGame + 0x1120u + (3u & 0x7Fu) * 4u) = pOwn;
        uint32_t args[4] = {pGame, pMis, pTgt, 0u};
        RUN_GAME(0x6FC59C80u, "MISSILES_SrvHit_SetTargetFlag20000_6FC59C80_113c", c, args, 4,
                 0u, pGame, pMis, 0u, 0u, 0u, 2u, pTgt, 0u, 0x00000000u, 0x18E0u);
    }

    /* 45. 0x6FC59F70: MISSILES_SrvDo_KeepAliveOnBlazeOwner (ecx=pGame, edx=pMissile, s0=pCollidedUnit, ret 4) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pMis = ARENA_WORK + 0x1600u, pOwn = ARENA_WORK + 0x1700u;
        uint32_t pListEx = ARENA_WORK + 0x1800u, pSf = ARENA_WORK + 0x1880u;
        U32(pMis + 0x00u) = 3u; U32(pMis + 0x94u) = 0u; U32(pMis + 0x98u) = 7u; U32(pMis + 0xC8u) = 0x400u;
        U32(pOwn + 0x00u) = 0u; U32(pOwn + 0x0Cu) = 7u; U32(pOwn + 0x5Cu) = pListEx;
        U32(pListEx + 0x10u) = 0x80000000u; U32(pListEx + 0x58u) = pSf;
        if (c == 2) U32(pSf + 0u) = (1u << 0x0Du); /* STATE_BLAZE = 13 */
        U32(pGame + 0x1120u + (7u & 0x7Fu) * 4u) = pOwn;
        uint32_t col = (c == 0) ? 0u : pOwn;
        uint32_t args[3] = {pGame, pMis, col};
        RUN_GAME(0x6FC59F70u, "MISSILES_SrvDo_KeepAliveOnBlazeOwner_6FC59F70_113c", c, args, 3,
                 0u, pGame, pMis, 0u, 0u, 0u, 1u, col, 0u, 0xFFFFFFFFu, 0x18C0u);
    }

    /* 46. 0x6FC62230: SKILLS_SrvSt13_ResetSkillParams (ecx=pGame, edx=pUnit, s0=nSkillId, s1=nLevel, ret 8) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pUnit = ARENA_WORK, pInfo = ARENA_WORK + 0x100u, pSk = ARENA_WORK + 0x120u;
        U32(pUnit + 0x00u) = 0u; U32(pUnit + 0xA8u) = pInfo;
        U32(pInfo + 0x04u) = pSk; /* D2SkillListStrc.pFirstSkill at +0x04 */
        U32(pSk + 0x00u)   = ARENA_SKILLS + 2u * 0x23Cu; /* skillId = 2 */
        U32(pSk + 0x28u)   = 5u;
        U32(pSk + 0x34u)   = 0xFFFFFFFFu;
        int32_t sid = (c == 0) ? -1 : (c == 1 ? 4 : 2);
        uint32_t args[4] = {0u, pUnit, (uint32_t)sid, 1u};
        RUN_GAME(0x6FC62230u, "SKILLS_SrvSt13_ResetSkillParams_6FC62230_113c", c, args, 4,
                 0u, 0u, pUnit, 0u, 0u, 0u, 2u, (uint32_t)sid, 1u, 0xFFFFFFFFu, 0x170u);
    }

    /* 47. 0x6FC645E0: SKILLS_DeductFromStatPool (eax=nAmount, edx=pPool -> eax) */
    {
        const uint32_t amts[3][2] = {{30u, 100u}, {100u, 100u}, {145u, 100u}};
        for (int c = 0; c < 3; c++) {
            reset_work();
            U32(ARENA_WORK) = amts[c][1];
            uint32_t args[2] = {amts[c][0], ARENA_WORK};
            RUN_GAME(0x6FC645E0u, "SKILLS_DeductFromStatPool113c", c, args, 2,
                     amts[c][0], 0u, ARENA_WORK, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 32u);
        }
    }

    /* 48. 0x6FC66D90: REGPOP_CanSpawnPresetMinionPack (eax=nClassId -> eax)
     *     Note: temporarily raise nMonStatsCount to 500 for case 2 so 0xE5 (229) returns 0!
     *     Wait: static tables must stay immutable across vectors! Since nMonStatsCount=64,
     *     Wait: if nMonStatsCount=64, id=229 >= 64 -> id=-1 -> returns 1!
     *     Let's check: if nMonStatsCount in ARENA_SGPT is 400u? Wait: 64*0x1A8 is allocated,
     *     and 0x6FC66D90 ONLY reads `cmp eax, [edx+0xa80]` WITHOUT indexing `pMonStatsTxt`! */
    /* Wait: let's check if ANY function indexes MonStatsTxt with id >= 64: NONE! Because we pass classId in {0, 1, 0x13, 0x3A}!
     * Let's set U32(ARENA_SGPT + 0x0A80u) = 400u in init_static_tables? Wait: let's keep 400u in init_static_tables! */

    /* 48. 0x6FC66D90: REGPOP_CanSpawnPresetMinionPack (eax=nClassId -> eax) */
    {
        const int32_t cids[3] = {5, 0xE5, 0x11D};
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t cid = (uint32_t)cids[c];
            uint32_t args[1] = {cid};
            RUN_GAME(0x6FC66D90u, "REGPOP_CanSpawnPresetMinionPack113c", c, args, 1,
                     cid, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 32u);
        }
    }

    /* 49. 0x6FC66E80: REGPOP_RemapDirectionalMonsterClassId (eax=nClassId, edi=nOrientation -> eax) */
    {
        const uint32_t orients[3][2] = {{0x13u, 6u}, {0x3Au, 7u}, {0x3Au, 16u}};
        for (int c = 0; c < 3; c++) {
            reset_work();
            uint32_t cid = orients[c][0], ori = orients[c][1];
            uint32_t args[2] = {cid, ori};
            RUN_GAME(0x6FC66E80u, "REGPOP_RemapDirectionalMonsterClassId113c", c, args, 2,
                     cid, 0u, 0u, 0u, 0u, ori, 0u, 0u, 0u, 0xFFFFFFFFu, 32u);
        }
    }

    /* 50. 0x6FC68300: MONSTER_RemovePlayerFromNpcInteractList (esi=pInteract, edi=pPlayer, s0=pGame, ret 4) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pInt = ARENA_WORK + 0x40u;
        uint32_t pN0 = ARENA_WORK + 0x60u, pN1 = ARENA_WORK + 0x80u;
        uint32_t pP0 = ARENA_WORK + 0x100u, pP1 = ARENA_WORK + 0x140u;
        U32(pInt) = pN0;
        U32(pN0 + 0x00u) = pP0; U32(pN0 + 0x08u) = pN1;
        U32(pN1 + 0x00u) = pP1; U32(pN1 + 0x08u) = 0u;
        uint32_t tgt = (c == 0) ? (ARENA_WORK + 0x180u) : (c == 1 ? pP0 : pP1);
        uint32_t args[3] = {pInt, tgt, pGame};
        RUN_GAME(0x6FC68300u, "MONSTER_RemovePlayerFromNpcInteractList_6FC68300_113c", c, args, 3,
                 0u, 0u, 0u, 0u, pInt, tgt, 1u, pGame, 0u, 0x00000000u, 0x100u);
    }

    /* 51. 0x6FC68370: MONSTER_HasAnyInteractingPlayer (eax=pInteract -> eax) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pInt = ARENA_WORK, pN0 = ARENA_WORK + 0x20u;
        if (c >= 1) {
            U32(pInt) = pN0;
            U32(pN0 + 0x00u) = (c == 2) ? (ARENA_WORK + 0x80u) : 0u;
        }
        uint32_t args[1] = {pInt};
        RUN_GAME(0x6FC68370u, "MONSTER_HasAnyInteractingPlayer113c", c, args, 1,
                 pInt, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x40u);
    }

    /* 52. 0x6FC684F0: MONSTER_CheckPlayerInteractUnlocked (eax=pMonster, edx=pPlayer -> eax) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pMon = (c == 0) ? 0u : ARENA_WORK, pMd = ARENA_WORK + 0x100u;
        uint32_t pInt = ARENA_WORK + 0x140u, pN0 = ARENA_WORK + 0x160u, pPlr = ARENA_WORK + 0x200u;
        if (c >= 1) {
            U32(pMon + 0x00u) = 1u; U32(pMon + 0x14u) = pMd; U32(pMd + 0x30u) = pInt;
            U32(pInt) = pN0; U32(pN0 + 0x00u) = pPlr;
            S32(pN0 + 0x04u) = (c == 1) ? 0 : 2;
        }
        uint32_t args[2] = {pMon, pPlr};
        RUN_GAME(0x6FC684F0u, "MONSTER_CheckPlayerInteractUnlocked113c", c, args, 2,
                 pMon, 0u, pPlr, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x180u);
    }

    /* 53. 0x6FC68560: MONSTER_GetBossMinionField34 (ecx=pUnit -> eax) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pUnit = (c == 0) ? 0u : ARENA_WORK, pMd = ARENA_WORK + 0x100u;
        if (c >= 1) {
            U32(pUnit + 0x00u) = 1u; U32(pUnit + 0x14u) = pMd;
            U32(pMd + 0x34u) = (c == 1) ? 0x4455u : 0x8899AABBu;
        }
        uint32_t args[1] = {pUnit};
        RUN_GAME(0x6FC68560u, "MONSTER_GetBossMinionField34_113c", c, args, 1,
                 0u, pUnit, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x150u);
    }

    /* 54. 0x6FC68750: MONSTER_SetLastInteractTarget (esi=pMonster, ebx=nInteractType, s0=dwTargetGuid, ret 4) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pMon = ARENA_WORK, pMd = ARENA_WORK + 0x100u;
        U32(pMon + 0x00u) = 1u;
        U32(pMon + 0x04u) = (c == 0) ? 1u : 0u; /* slot 0 has flag 0x10 */
        U32(pMon + 0x14u) = pMd;
        uint32_t itype = (c == 1) ? 5u : 2u;
        uint32_t args[3] = {pMon, itype, 0x777u};
        RUN_GAME(0x6FC68750u, "MONSTER_SetLastInteractTarget113c", c, args, 3,
                 0u, 0u, 0u, itype, pMon, 0u, 1u, 0x777u, 0u, 0xFFFFFFFFu, 0x150u);
    }

    /* 55..63. Client accessors & mutators (0x6FC69240..0x6FC69D70) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pCli = (c == 0) ? 0u : (ARENA_WORK + (uint32_t)c * 0x20u);
        uint32_t args[1] = {pCli};
        RUN_GAME(0x6FC69240u, "CLIENTS_GetSaveHeaderPtr_6FC69240_113c", c, args, 1,
                 pCli, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x40u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pCli = (c == 0) ? 0u : ARENA_WORK;
        if (c >= 1) U32(pCli + 0x3D4u) = (c == 1) ? 0x01u : 0x100u;
        uint32_t args[1] = {pCli};
        RUN_GAME(0x6FC69580u, "CLIENTS_SetClientFlag20_6FC69580_113c", c, args, 1,
                 pCli, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0x00000000u, 0x3E0u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pCli = (c == 0) ? 0u : ARENA_WORK, pGame = ARENA_WORK + 0x400u;
        if (c >= 1) {
            U32(pCli + 0x17Cu) = (c == 2) ? (ARENA_WORK + 0x440u) : 0u;
            U32(pCli + 0x180u) = 128u + (uint32_t)c;
            U32(pCli + 0x1A8u) = pGame;
            U32(pCli + 0x3D4u) = 0x35u;
        }
        uint32_t args[1] = {pCli};
        RUN_GAME(0x6FC69630u, "CLIENTS_FreeSaveDataBuffer_6FC69630_113c", c, args, 1,
                 0u, 0u, 0u, 0u, pCli, 0u, 0u, 0u, 0u, 0x00000000u, 0x420u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pCli = (c == 0) ? 0u : ARENA_WORK;
        if (c >= 1) U32(pCli + 0x180u) = 0x200u * (uint32_t)c;
        uint32_t args[1] = {pCli};
        RUN_GAME(0x6FC69760u, "CLIENTS_GetSaveDataSize_6FC69760_113c", c, args, 1,
                 pCli, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x190u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pCli = (c == 0) ? 0u : ARENA_WORK;
        if (c >= 1) U32(pCli + 0x17Cu) = ARENA_WORK + 0x100u * (uint32_t)c;
        uint32_t args[1] = {pCli};
        RUN_GAME(0x6FC69790u, "CLIENTS_GetSaveDataPtr_6FC69790_113c", c, args, 1,
                 pCli, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x190u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pCli = (c == 0) ? 0u : (ARENA_WORK + (uint32_t)c * 0x20u);
        uint32_t args[1] = {pCli};
        RUN_GAME(0x6FC69A20u, "CLIENTS_GetClientNamePtr_6FC69A20_113c", c, args, 1,
                 pCli, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x40u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pCli = (c == 0) ? 0u : ARENA_WORK;
        if (c >= 1) U32(pCli + 0x488u) = 0xABCD0000u + (uint32_t)c;
        uint32_t args[1] = {pCli};
        RUN_GAME(0x6FC69AB0u, "CLIENTS_GetClientField488_6FC69AB0_113c", c, args, 1,
                 pCli, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x490u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pCli = (c == 0) ? 0u : ARENA_WORK, st = 3u + (uint32_t)c;
        uint32_t args[2] = {pCli, st};
        RUN_GAME(0x6FC69B70u, "CLIENTS_SetClientInitState_6FC69B70_113c", c, args, 2,
                 pCli, 0u, 0u, 0u, 0u, 0u, 1u, st, 0u, 0x00000000u, 0x20u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pCli = (c == 0) ? 0u : ARENA_WORK;
        if (c >= 1) U8(pCli + 0x08u) = (uint8_t)(0x40 + c * 7);
        uint32_t args[1] = {pCli};
        RUN_GAME(0x6FC69BF0u, "CLIENTS_GetClientByte08_6FC69BF0_113c", c, args, 1,
                 pCli, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x20u);
    }

    /* 64. 0x6FC69D70: CLIENTS_SetClientActNo (eax=pClient, cl=nAct) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pCli = (c == 0) ? 0u : ARENA_WORK;
        uint32_t nAct = (c == 1) ? 5u : 3u; /* c==0 NULL assert 0x7D6, c==1 >=5 assert 0x7D7, c==2 valid */
        uint32_t args[2] = {pCli, nAct};
        RUN_GAME(0x6FC69D70u, "CLIENTS_SetClientActNo_6FC69D70_113c", c, args, 2,
                 pCli, nAct, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0x00000000u, 0x1C0u);
    }

    /* 65. 0x6FC69FE0: CLIENTS_FindClientByIdInGame (eax=pGame, ecx=dwClientId -> eax) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = (c == 0) ? 0u : ARENA_WORK, pC0 = ARENA_WORK + 0x100u, pC1 = ARENA_WORK + 0x600u;
        if (c >= 1) {
            U32(pGame + 0x88u) = pC0;
            U32(pC0 + 0x00u) = 11u; U32(pC0 + 0x4A8u) = pC1;
            U32(pC1 + 0x00u) = 22u;
        }
        uint32_t cid = (c == 1) ? 22u : 99u;
        uint32_t args[2] = {pGame, cid};
        RUN_GAME(0x6FC69FE0u, "CLIENTS_FindClientByIdInGame_6FC69FE0_113c", c, args, 2,
                 pGame, cid, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0xAC0u);
    }

    /* 66. 0x6FC6A2D0: CLIENTS_UpdateCharacterProgression (esi=pClient, edx=nDifficulty, edi=nActProgression) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pCli = ARENA_WORK;
        U16(pCli + 0x0Au) = (c == 0) ? 0x0020u : (c == 1 ? 0x0000u : 0x0C20u);
        uint32_t dif = (c == 0) ? 1u : 1u, actp = (c == 2) ? 2u : 3u;
        uint32_t args[3] = {pCli, dif, actp};
        RUN_GAME(0x6FC6A2D0u, "CLIENTS_UpdateCharacterProgression113c", c, args, 3,
                 0u, 0u, dif, 0u, pCli, actp, 0u, 0u, 0u, 0x00000000u, 0x20u);
    }

    /* 67. 0x6FC6A370: CLIENTS_RecordTrackedUnitPositions (esi=pClient, s0=pNodeArray, ret 4) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pCli = ARENA_WORK, pNodes = ARENA_WORK + 0x400u;
        uint32_t pU0 = ARENA_WORK + 0x480u, pPath0 = ARENA_WORK + 0x580u;
        uint32_t pU1 = ARENA_WORK + 0x600u, pSPath1 = ARENA_WORK + 0x700u;
        U32(pU0 + 0x00u) = 1u; U32(pU0 + 0x0Cu) = 0x55u; U32(pU0 + 0x2Cu) = pPath0;
        U16(pPath0 + 0x02u) = 321u; U16(pPath0 + 0x06u) = 654u;
        U32(pU1 + 0x00u) = 2u; U32(pU1 + 0x0Cu) = 0x99u; U32(pU1 + 0x2Cu) = pSPath1;
        U32(pSPath1 + 0x0Cu) = 111u; U32(pSPath1 + 0x10u) = 222u;
        if (c == 0) {
            U32(pNodes + 0x00u) = pU0;
            U32(pNodes + 0x08u) = 1u; /* nextIdx=1 where node[1].nextIdx==0 -> 1 entry */
        } else if (c == 1) {
            U32(pNodes + 0x00u) = pU1;
            U32(pNodes + 0x08u) = 1u; /* static object -> 1 entry */
        } else {
            U32(pNodes + 0x00u) = pU0;
            U32(pNodes + 0x08u) = 1u;
            U32(pNodes + 12u + 0x00u) = pU1;
            U32(pNodes + 12u + 0x08u) = 2u; /* node[2].nextIdx==0 -> 2 entries */
        }
        uint32_t args[2] = {pCli, pNodes};
        RUN_GAME(0x6FC6A370u, "CLIENTS_RecordTrackedUnitPositions_6FC6A370_113c", c, args, 2,
                 0u, 0u, 0u, 0u, pCli, 0u, 1u, pNodes, 0u, 0x00000000u, 0x720u);
    }

    /* 68 & 69. 0x6FC6A660 & 0x6FC6A6E0: CLIENTS_{IsActionRateLimitExceeded,RecordActionRateLimitFrame} */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pPlr = (c == 0) ? 0u : (ARENA_WORK + 0x100u);
        uint32_t pPd = ARENA_WORK + 0x200u, pCli = ARENA_WORK + 0x300u;
        U32(pGame + 0xA8u) = 5000u;
        if (c >= 1) {
            U32(pPlr + 0x00u) = 0u; U32(pPlr + 0x14u) = pPd; U32(pPd + 0x9Cu) = pCli;
            for (uint32_t i = 0; i < 5u; i++) {
                U32(pCli + 0x3C0u + i * 4u) = (c == 2) ? (4000u + i) : (i < 3u ? 4000u : 0u);
            }
        }
        uint32_t args[2] = {pPlr, pGame};
        RUN_GAME(0x6FC6A660u, "CLIENTS_IsActionRateLimitExceeded_6FC6A660_113c", c, args, 2,
                 pPlr, 0u, 0u, 0u, pGame, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x6E0u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pPlr = (c == 0) ? 0u : (ARENA_WORK + 0x100u);
        uint32_t pPd = ARENA_WORK + 0x200u, pCli = ARENA_WORK + 0x300u;
        U32(pGame + 0xA8u) = 5000u + (uint32_t)c * 100u;
        if (c >= 1) {
            U32(pPlr + 0x00u) = 0u; U32(pPlr + 0x14u) = pPd; U32(pPd + 0x9Cu) = pCli;
            if (c == 2) U32(pCli + 0x3C0u) = 4900u;
        }
        uint32_t args[2] = {pPlr, pGame};
        RUN_GAME(0x6FC6A6E0u, "CLIENTS_RecordActionRateLimitFrame_6FC6A6E0_113c", c, args, 2,
                 pPlr, 0u, 0u, 0u, 0u, pGame, 0u, 0u, 0u, 0x00000000u, 0x6E0u);
    }

    /* 70 & 71. 0x6FC6C1C0 & 0x6FC6EE40: SKILLS_SrvSt05_CheckValidSkillTarget & SKILLS_SrvSt19_CheckTargetOutsideTown */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pUnit = ARENA_WORK + 0x1600u, pPath = ARENA_WORK + 0x1700u, pTgt = ARENA_WORK + 0x1800u;
        U32(pUnit + 0x00u) = 0u; U32(pUnit + 0x2Cu) = pPath;
        if (c == 2) {
            U32(pTgt + 0x00u) = 1u; U32(pTgt + 0x0Cu) = 9u;
            U32(pPath + 0x58u) = pTgt; U32(pPath + 0x5Cu) = 1u; U32(pPath + 0x60u) = 9u;
            U32(pGame + 0x1320u + (9u & 0x7Fu) * 4u) = pTgt;
        }
        int32_t sid = (c == 0) ? -1 : 2;
        uint32_t args[4] = {pGame, pUnit, (uint32_t)sid, 1u};
        RUN_GAME(0x6FC6C1C0u, "SKILLS_SrvSt05_CheckValidSkillTarget_6FC6C1C0_113c", c, args, 4,
                 0u, pGame, pUnit, 0u, 0u, 0u, 2u, (uint32_t)sid, 1u, 0xFFFFFFFFu, 0x1900u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pUnit = ARENA_WORK + 0x1600u, pPath = ARENA_WORK + 0x1700u;
        uint32_t pTgt = ARENA_WORK + 0x1800u, pPathT = ARENA_WORK + 0x1900u;
        uint32_t pR1 = ARENA_WORK + 0x1960u, pR2 = ARENA_WORK + 0x19C0u, pLvl = ARENA_WORK + 0x1A20u;
        U32(pUnit + 0x00u) = 0u; U32(pUnit + 0x2Cu) = pPath;
        if (c >= 1) {
            U32(pTgt + 0x00u) = 1u; U32(pTgt + 0x0Cu) = 9u;
            attach_unit_room_level(pTgt, pPathT, 10u, 10u, pR1, pR2, pLvl, (c == 1) ? 1u : 2u, ARENA_WORK + 0x1C10u);
            U32(pPath + 0x58u) = pTgt; U32(pPath + 0x5Cu) = 1u; U32(pPath + 0x60u) = 9u;
            U32(pGame + 0x1320u + (9u & 0x7Fu) * 4u) = pTgt;
        }
        uint32_t args[4] = {pGame, pUnit, 2u, 1u};
        RUN_GAME(0x6FC6EE40u, "SKILLS_SrvSt19_CheckTargetOutsideTown_6FC6EE40_113c", c, args, 4,
                 0u, pGame, pUnit, 0u, 0u, 0u, 2u, 2u, 1u, 0xFFFFFFFFu, 0x1C20u);
    }

    /* 72. 0x6FC73170: PLAYERSAVE_ComputeHeaderChecksum (esi=pSaveData, s0=nByteLen, ret 4 -> eax) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pSave = ARENA_WORK;
        for (uint32_t i = 0; i < 0xC0u; i++) U8(pSave + i) = (uint8_t)(i + c * 13 + 1);
        U32(pSave + 0x04u) = (c == 0) ? 0x47u : 0x60u;
        uint32_t args[2] = {pSave, 0xC0u};
        RUN_GAME(0x6FC73170u, "PLAYERSAVE_ComputeHeaderChecksum_6FC73170_113c", c, args, 2,
                 0u, 0u, 0u, 0u, pSave, 0u, 1u, 0xC0u, 0u, 0xFFFFFFFFu, 0xC8u);
    }

    /* 73. 0x6FC73260: PLAYERSAVE_CountInventoryAndCursorItems (eax=pInventory -> ax, retMask=0xFFFF) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pInv = (c == 0) ? 0u : ARENA_WORK;
        if (c >= 1) {
            uint32_t pCur = ARENA_WORK + 0x40u, pItm = ARENA_WORK + 0x140u, pId = ARENA_WORK + 0x240u;
            U32(pInv + 0x00u) = 0x01020304u;
            U32(pInv + 0x20u) = pCur; U32(pCur + 0x00u) = 4u;
            if (c == 2) { U32(pInv + 0x0Cu) = pItm; U32(pItm + 0x00u) = 4u; U32(pItm + 0x14u) = pId; }
        }
        uint32_t args[1] = {pInv};
        RUN_GAME(0x6FC73260u, "PLAYERSAVE_CountInventoryAndCursorItems_6FC73260_113c", c, args, 1,
                 pInv, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0x0000FFFFu, 0x2C0u);
    }

    /* 74..77. Act 5 quest state queries (eax=pGame -> eax): 0x6FC76570, 0x6FC76600, 0x6FC76640, 0x6FC766D0 */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1100u, pQ = ARENA_WORK + 0x1140u, pQEx = ARENA_WORK + 0x1240u;
        if (c >= 1) { attach_quest_node(pGame, pQC, pQ, 0x24u, pQEx); U8(pQEx + 0x86u) = (c == 1) ? 1u : 0u; }
        uint32_t args[1] = {pGame};
        RUN_GAME(0x6FC76570u, "ACT5Q6_IsWorldstoneEntryAllowed_6FC76570_113c", c, args, 1,
                 pGame, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x12E0u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1100u, pQ = ARENA_WORK + 0x1140u, pQEx = ARENA_WORK + 0x1240u;
        attach_quest_node(pGame, pQC, pQ, 0x23u, pQEx);
        U8(pQ + 0x09u) = (c == 0) ? 0u : 1u;
        U8(pQEx + 0x00u) = (c == 1) ? 0u : 1u;
        uint32_t args[1] = {pGame};
        RUN_GAME(0x6FC76600u, "ACT5Q5_CanSpawnTownPortalOnSummit_6FC76600_113c", c, args, 1,
                 pGame, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x1260u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1100u, pQ = ARENA_WORK + 0x1140u, pQEx = ARENA_WORK + 0x1240u;
        if (c >= 1) {
            attach_quest_node(pGame, pQC, pQ, 0x23u, pQEx);
            U8(pQEx + 0x48u)  = 1u;
            U32(pQEx + 0x44u) = (c == 1) ? 2u : 0u;
        }
        uint32_t args[1] = {pGame};
        RUN_GAME(0x6FC76640u, "ACT5Q5_IsLastAncientDefeatedReady_6FC76640_113c", c, args, 1,
                 pGame, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x1290u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1100u, pQ = ARENA_WORK + 0x1140u, pQEx = ARENA_WORK + 0x1240u;
        attach_quest_node(pGame, pQC, pQ, 0x23u, pQEx);
        U32(pQEx + 0x0Cu) = (uint32_t)c * 3u;
        uint32_t args[1] = {pGame};
        RUN_GAME(0x6FC766D0u, "ACT5Q5_GetSummitPlayerCount_6FC766D0_113c", c, args, 1,
                 pGame, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x1260u);
    }

    /* 78. 0x6FC76740: ACT5Q5_OnPlayerLeaveSummitCheck (eax=pUnit, s0=pGame, ret 4) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1100u, pQ = ARENA_WORK + 0x1140u, pQEx = ARENA_WORK + 0x1240u;
        uint32_t pUnit = ARENA_WORK + 0x1300u, pPath = ARENA_WORK + 0x1400u;
        uint32_t pR1 = ARENA_WORK + 0x1460u, pR2 = ARENA_WORK + 0x14C0u, pLvl = ARENA_WORK + 0x1520u;
        attach_quest_node(pGame, pQC, pQ, 0x23u, pQEx);
        U32(pQEx + 0x0Cu) = (c == 2) ? 1u : 2u;
        U8(pQEx + 0x10u)  = 1u;
        U32(pUnit + 0x00u) = 0u;
        attach_unit_room_level(pUnit, pPath, 10u, 10u, pR1, pR2, pLvl, (c == 0) ? 0x6Du : 0x78u, ARENA_WORK + 0x1710u);
        uint32_t args[2] = {pUnit, pGame};
        RUN_GAME(0x6FC76740u, "ACT5Q5_OnPlayerLeaveSummitCheck_6FC76740_113c", c, args, 2,
                 pUnit, 0u, 0u, 0u, 0u, 0u, 1u, pGame, 0u, 0x00000000u, 0x1720u);
    }

    /* 79..81. 0x6FC76810, 0x6FC76840, 0x6FC768C0 (ret 0xC, retMask=0xFF) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pQ = ARENA_WORK, pFl = ARENA_WORK + 0x100u, pBits = ARENA_WORK + 0x120u;
        init_quest_flags(pFl, pBits);
        U8(pQ + 0x0Cu) = 1u; U32(pQ + 0xE0u) = 0x28u;
        if (c == 2) set_qbit(pBits, 0x28u, 0u);
        uint32_t npc = (c == 0) ? 0x1FFu : 0x203u;
        uint32_t args[5] = {pQ, npc, 0u, pFl, 0u};
        RUN_EX(0, 0x6FC76810u, "ACT5Q6_ActiveFilter_6FC76810_113c", c, args, 5,
               0u, pQ, npc, 0u, 0u, 0u, 3u, 0u, pFl, 0u, 0u, 0u, 0u, 0x000000FFu, 0x180u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pQ = ARENA_WORK, pFl = ARENA_WORK + 0x100u, pBits = ARENA_WORK + 0x120u;
        init_quest_flags(pFl, pBits);
        U8(pQ + 0x0Cu) = 1u; U32(pQ + 0xE0u) = 0x26u;
        if (c >= 1) set_qbit(pBits, 0x25u, 0u);
        if (c == 2) set_qbit(pBits, 0x26u, 0u);
        uint32_t args[5] = {pQ, 0x200u, 0u, pFl, 0u};
        RUN_EX(0, 0x6FC76840u, "ACT5Q4_ActiveFilter_6FC76840_113c", c, args, 5,
               0u, pQ, 0x200u, 0u, 0u, 0u, 3u, 0u, pFl, 0u, 0u, 0u, 0u, 0x000000FFu, 0x180u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pQ = ARENA_WORK, pFl = ARENA_WORK + 0x100u, pBits = ARENA_WORK + 0x120u, pOut = ARENA_WORK + 0x190u;
        init_quest_flags(pFl, pBits);
        U8(pQ + 0x09u) = 1u; U8(pQ + 0x0Bu) = 3u; U8(pQ + 0x0Cu) = 2u;
        if (c == 1) { set_qbit(pBits, 0x26u, 1u); set_qbit(pBits, 0x26u, 4u); }
        if (c == 2) { set_qbit(pBits, 0x26u, 0x0Eu); }
        uint32_t args[5] = {pQ, 0u, 0u, pFl, pOut};
        RUN_EX(0, 0x6FC768C0u, "ACT5Q4_StatusFilter_6FC768C0_113c", c, args, 5,
               0u, pQ, 0u, 0u, 0u, 0u, 3u, 0u, pFl, pOut, 0u, 0u, 0u, 0x000000FFu, 0x1A0u);
    }

    /* 82. 0x6FC76950: ACT5Q3_IsFrozenAnyaUnspawned (eax=pGame -> eax) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1100u, pQ = ARENA_WORK + 0x1140u, pQEx = ARENA_WORK + 0x1240u;
        if (c >= 1) { attach_quest_node(pGame, pQC, pQ, 0x21u, pQEx); U32(pQEx + 0x84u) = (c == 1) ? 0u : 2u; }
        uint32_t args[1] = {pGame};
        RUN_GAME(0x6FC76950u, "ACT5Q3_IsFrozenAnyaUnspawned_6FC76950_113c", c, args, 1,
                 pGame, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x12E0u);
    }

    /* 83 & 84. 0x6FC76A00 & 0x6FC76A40: ACT5Q3_{RecordAnyaPosition,GetPortalTargetCoords} */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1100u, pQ = ARENA_WORK + 0x1140u, pQEx = ARENA_WORK + 0x1240u;
        uint32_t pObj = ARENA_WORK + 0x1360u, pSPath = ARENA_WORK + 0x1460u;
        U32(pObj + 0x00u) = 2u; U32(pObj + 0x2Cu) = pSPath;
        U32(pSPath + 0x0Cu) = 5100u + (uint32_t)c * 10u; U32(pSPath + 0x10u) = 5200u + (uint32_t)c * 10u;
        if (c >= 1) attach_quest_node(pGame, pQC, pQ, 0x21u, pQEx);
        uint32_t args[2] = {pGame, pObj};
        RUN_GAME(0x6FC76A00u, "ACT5Q3_RecordAnyaPosition_6FC76A00_113c", c, args, 2,
                 0u, pGame, pObj, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x1480u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1100u, pQ = ARENA_WORK + 0x1140u, pQEx = ARENA_WORK + 0x1240u;
        uint32_t pObj = ARENA_WORK + 0x1360u, pSPath = ARENA_WORK + 0x1460u, pOut = ARENA_WORK + 0x14A0u;
        U32(pObj + 0x00u) = 2u; U32(pObj + 0x2Cu) = pSPath;
        U32(pSPath + 0x0Cu) = 610u; U32(pSPath + 0x10u) = 620u;
        if (c >= 1) {
            attach_quest_node(pGame, pQC, pQ, 0x21u, pQEx);
            U32(pQEx + 0x84u) = 1u;
            U8(pQEx + 0xB1u)  = (c == 2) ? 1u : 0u;
            U32(pQEx + 0xC4u) = 710u; U32(pQEx + 0xC8u) = 720u;
        }
        uint32_t args[3] = {pGame, pObj, pOut};
        RUN_GAME(0x6FC76A40u, "ACT5Q3_GetPortalTargetCoords_6FC76A40_113c", c, args, 3,
                 0u, pGame, pObj, 0u, 0u, 0u, 1u, pOut, 0u, 0xFFFFFFFFu, 0x14C0u);
    }

    /* 85. 0x6FC76B80: ACT5Q2_CalcRemainingSoldiersCount (eax=pQuest -> eax) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pQ = ARENA_WORK, pQEx = ARENA_WORK + 0x100u;
        U32(pQ + 0x18u) = pQEx;
        if (c == 1) { U8(pQEx + 0x86u) = 1u; U32(pQEx + 0xA4u) = 5u; U32(pQEx + 0xACu) = 2u; }
        if (c == 2) { U8(pQEx + 0x86u) = 1u; U8(pQEx + 0x87u) = 1u; U8(pQEx + 0x88u) = 1u; U32(pQEx + 0xACu) = 9u; }
        uint32_t args[1] = {pQ};
        RUN_GAME(0x6FC76B80u, "ACT5Q2_CalcRemainingSoldiersCount_6FC76B80_113c", c, args, 1,
                 pQ, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x1C0u);
    }

    /* 86..92. 0x6FC76C40, 0x6FC76CF0, 0x6FC76D80, 0x6FC76E00, 0x6FC76EA0, 0x6FC76EB0, 0x6FC76EF0 */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pQ = ARENA_WORK, pFl = ARENA_WORK + 0x100u, pBits = ARENA_WORK + 0x120u;
        init_quest_flags(pFl, pBits);
        U8(pQ + 0x0Cu) = 1u; U32(pQ + 0xE0u) = 0x24u;
        uint32_t npc = (c == 0) ? 0x1FFu : (c == 1 ? 0x203u : 0x216u);
        if (c == 2) set_qbit(pBits, 0x24u, 0u);
        uint32_t args[5] = {pQ, npc, 0u, pFl, 0u};
        RUN_EX(0, 0x6FC76C40u, "ACT5Q2_ActiveFilter_6FC76C40_113c", c, args, 5,
               0u, pQ, npc, 0u, 0u, 0u, 3u, 0u, pFl, 0u, 0u, 0u, 0u, 0x000000FFu, 0x180u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pQ = ARENA_WORK;
        U8(pQ + 0x09u) = (c == 0) ? 0u : 1u;
        U8(pQ + 0x0Cu) = (c == 2) ? 3u : 0u;
        uint32_t args[1] = {pQ};
        RUN_GAME(0x6FC76CF0u, "ACT5Q1_ActivateQuestIfNotIntro_6FC76CF0_113c", c, args, 1,
                 pQ, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0x00000000u, 0x20u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pQ = ARENA_WORK, pFl = ARENA_WORK + 0x100u, pBits = ARENA_WORK + 0x120u;
        init_quest_flags(pFl, pBits);
        U8(pQ + 0x09u) = 1u; U8(pQ + 0x0Cu) = 1u; U32(pQ + 0xE0u) = 0x23u;
        if (c == 1) set_qbit(pBits, 0x23u, 1u);
        if (c == 2) set_qbit(pBits, 0x23u, 0u);
        uint32_t args[5] = {pQ, 0x1FFu, 0u, pFl, 0u};
        RUN_EX(0, 0x6FC76D80u, "ACT5Q1_ActiveFilter_6FC76D80_113c", c, args, 5,
               0u, pQ, 0x1FFu, 0u, 0u, 0u, 3u, 0u, pFl, 0u, 0u, 0u, 0u, 0x000000FFu, 0x180u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pQ = ARENA_WORK, pFl = ARENA_WORK + 0x100u, pBits = ARENA_WORK + 0x120u, pOut = ARENA_WORK + 0x190u;
        init_quest_flags(pFl, pBits);
        U8(pQ + 0x09u) = 1u; U8(pQ + 0x0Bu) = 2u; U8(pQ + 0x0Cu) = 2u; U32(pQ + 0xE0u) = 0x23u;
        if (c == 1) set_qbit(pBits, 0x23u, 1u);
        if (c == 2) { set_qbit(pBits, 0x23u, 1u); set_qbit(pBits, 0x23u, 5u); }
        uint32_t args[5] = {pQ, 0u, 0u, pFl, pOut};
        RUN_EX(0, 0x6FC76E00u, "ACT5Q1_StatusFilter_6FC76E00_113c", c, args, 5,
               0u, pQ, 0u, 0u, 0u, 0u, 3u, 0u, pFl, pOut, 0u, 0u, 0u, 0x000000FFu, 0x1A0u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        U8(ARENA_WORK + 0x00u) = 0xAAu;
        U8(ARENA_WORK + 0x01u) = 0xBBu;
        U8(ARENA_WORK + 0x02u) = 0xCCu;
        uint32_t pOut = ARENA_WORK + (uint32_t)c;
        uint32_t args[5] = {0u, 0u, 0u, 0u, pOut};
        RUN_EX(0, 0x6FC76EA0u, "ACT5Q0_StatusFilter_6FC76EA0_113c", c, args, 5,
               0u, 0u, 0u, 0u, 0u, 0u, 3u, 0u, 0u, pOut, 0u, 0u, 0u, 0x000000FFu, 0x20u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQ = ARENA_WORK + 0x80u, pArg = ARENA_WORK + 0x180u;
        uint32_t pPlr = ARENA_WORK + 0x1C0u, pPd = ARENA_WORK + 0x2C0u, pFl = ARENA_WORK + 0x360u, pBits = ARENA_WORK + 0x380u;
        init_player_with_qflags(pGame, 0u, pPlr, 1u, pPd, pFl, pBits);
        U32(pQ + 0xE0u) = 0x27u;
        U32(pArg + 0x00u) = pGame; U32(pArg + 0x0Cu) = pPlr;
        if (c == 1) set_qbit(pBits, 0x27u, 0u);
        if (c == 2) set_qbit(pBits, 0x27u, 1u);
        uint32_t args[2] = {pQ, pArg};
        RUN_GAME(0x6FC76EB0u, "ACT5Q5_Callback15_SetState0AIfCompleted_6FC76EB0_113c", c, args, 2,
                 0u, pQ, pArg, 0u, 0u, 0u, 0u, 0u, 0u, 0x00000000u, 0x400u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1100u, pQ23 = ARENA_WORK + 0x1140u, pQ23Ex = ARENA_WORK + 0x1240u;
        uint32_t pQ = ARENA_WORK + 0x1300u, pQEx = ARENA_WORK + 0x1400u, pFl = ARENA_WORK + 0x14C0u, pBits = ARENA_WORK + 0x14E0u;
        attach_quest_node(pGame, pQC, pQ23, 0x23u, pQ23Ex);
        init_quest_flags(pFl, pBits);
        U32(pQ + 0x04u) = pGame; U8(pQ + 0x0Cu) = 1u; U32(pQ + 0x18u) = pQEx;
        if (c == 0) { U8(pQ23Ex + 0x48u) = 1u; }
        if (c == 2) { set_qbit(pBits, 0x28u, 0u); }
        uint32_t npc = (c == 0) ? 0x219u : 0x1FFu;
        uint32_t args[5] = {pQ, npc, 0u, pFl, 0u};
        RUN_EX(0, 0x6FC76EF0u, "ACT5Q6_ActiveFilter_6FC76EF0_113c", c, args, 5,
               0u, pQ, npc, 0u, 0u, 0u, 3u, 0u, pFl, 0u, 0u, 0u, 0u, 0x000000FFu, 0x1540u);
    }

    /* 93, 96, 98, 109, 112: RemovePlayerGuid callbacks (ecx=pQuest, edx=pQuestArg -> eax) */
    {
        const struct { uint32_t va; const char *nm; int has_ex; } rmfns[5] = {
            {0x6FC76FC0u, "ACT5Q5_Callback11_RemovePlayerGuid_6FC76FC0_113c", 1},
            {0x6FC775D0u, "ACT5Q6_Callback11_RemovePlayerGuid_6FC775D0_113c", 0},
            {0x6FC77A20u, "ACT5Q4_Callback11_RemovePlayerGuid_6FC77A20_113c", 1},
            {0x6FC782A0u, "ACT5Q2_Callback11_RemovePlayerGuid_6FC782A0_113c", 1},
            {0x6FC787A0u, "ACT5Q4_Callback11_RemovePlayerFromQuestGuidList_6FC787A0_113c", 0},
        };
        for (int f = 0; f < 5; f++) {
            for (int c = 0; c < 3; c++) {
                reset_work();
                uint32_t pQ = ARENA_WORK, pQEx = ARENA_WORK + 0x100u, pArg = ARENA_WORK + 0x200u, pPlr = ARENA_WORK + 0x240u;
                U32(pQ + 0x18u) = pQEx;
                U16(pQ + 0x9Cu) = 2u; U32(pQ + 0x1Cu) = 11u; U32(pQ + 0x20u) = 22u;
                if (rmfns[f].has_ex) {
                    U16(pQEx + 0x80u) = 2u; U32(pQEx + 0x00u) = 11u; U32(pQEx + 0x04u) = 22u;
                }
                U32(pPlr + 0x0Cu) = (c == 1) ? 11u : 99u;
                U32(pArg + 0x0Cu) = (c == 0) ? 0u : pPlr;
                uint32_t args[2] = {pQ, pArg};
                RUN_GAME(rmfns[f].va, rmfns[f].nm, c, args, 2,
                         0u, pQ, pArg, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x280u);
            }
        }
    }

    /* 94. 0x6FC77440: ACT5Q5_CountLivingSummitPlayersCallback (ecx=pGame, edx=pPlayer, s0=pArg, ret 4) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1100u, pQ = ARENA_WORK + 0x1140u, pQEx = ARENA_WORK + 0x1240u;
        uint32_t pPlr = ARENA_WORK + 0x1300u, pPath = ARENA_WORK + 0x1400u;
        uint32_t pR1 = ARENA_WORK + 0x1460u, pR2 = ARENA_WORK + 0x14C0u, pLvl = ARENA_WORK + 0x1520u;
        attach_quest_node(pGame, pQC, pQ, 0x23u, pQEx);
        U32(pQEx + 0x54u) = 2u;
        U32(pPlr + 0x00u) = 0u;
        U32(pPlr + 0x10u) = (c == 1) ? 0u : 1u; /* mode 0=dead, mode 1=alive */
        attach_unit_room_level(pPlr, pPath, 10u, 10u, pR1, pR2, pLvl, (c == 0) ? 0x6Du : 0x78u, ARENA_WORK + 0x1710u);
        uint32_t args[3] = {pGame, pPlr, 0u};
        RUN_GAME(0x6FC77440u, "ACT5Q5_CountLivingSummitPlayersCallback_6FC77440_113c", c, args, 3,
                 0u, pGame, pPlr, 0u, 0u, 0u, 1u, 0u, 0u, 0xFFFFFFFFu, 0x1720u);
    }

    /* 95. 0x6FC77540: ACT5Q6_Callback14_PlayerJoined (ecx=pQuest, edx=pQuestArg) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQ = ARENA_WORK + 0x80u, pQEx = ARENA_WORK + 0x180u, pArg = ARENA_WORK + 0x200u;
        uint32_t pPlr = ARENA_WORK + 0x240u, pPd = ARENA_WORK + 0x340u, pFl = ARENA_WORK + 0x3E0u, pBits = ARENA_WORK + 0x400u;
        init_player_with_qflags(pGame, 0u, pPlr, 1u, pPd, pFl, pBits);
        U32(pQ + 0x18u) = pQEx; U32(pQ + 0xE0u) = 0x28u;
        U32(pArg + 0x00u) = pGame; U32(pArg + 0x0Cu) = pPlr;
        if (c == 0) set_qbit(pBits, 0x28u, 0u);
        if (c == 1) set_qbit(pBits, 0x28u, 3u);
        if (c == 2) set_qbit(pBits, 0x28u, 2u);
        uint32_t args[2] = {pQ, pArg};
        RUN_GAME(0x6FC77540u, "ACT5Q6_Callback14_PlayerJoined_6FC77540_113c", c, args, 2,
                 0u, pQ, pArg, 0u, 0u, 0u, 0u, 0u, 0u, 0x00000000u, 0x460u);
    }

    /* 97. 0x6FC777F0: ACT5Q4_CompletePersonalizationReward (eax=pPlayer, s0=pGame, ret 4 -> eax) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pPlr = ARENA_WORK + 0x80u, pPd = ARENA_WORK + 0x180u, pFl = ARENA_WORK + 0x220u, pBits = ARENA_WORK + 0x240u;
        init_player_with_qflags(pGame, 0u, pPlr, 1u, pPd, pFl, pBits);
        if (c == 1) set_qbit(pBits, 0x26u, 1u);
        if (c == 2) set_qbit(pBits, 0x26u, 0x0Fu);
        uint32_t args[2] = {pPlr, pGame};
        RUN_GAME(0x6FC777F0u, "ACT5Q4_CompletePersonalizationReward_6FC777F0_113c", c, args, 2,
                 pPlr, 0u, 0u, 0u, 0u, 0u, 1u, pGame, 0u, 0xFFFFFFFFu, 0x2B0u);
    }

    /* 99, 105, 110, 113: Sync quest state callbacks (ecx=pGame, edx=pPlayer, s0=pArg, ret 4) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1100u, pQ = ARENA_WORK + 0x1140u;
        uint32_t pPlr = ARENA_WORK + 0x1240u, pPd = ARENA_WORK + 0x1340u, pFl = ARENA_WORK + 0x13E0u, pBits = ARENA_WORK + 0x1400u;
        init_player_with_qflags(pGame, 0u, pPlr, 1u, pPd, pFl, pBits);
        attach_quest_node(pGame, pQC, pQ, 0x22u, ARENA_WORK + 0x1480u);
        if (c >= 1) set_qbit(pBits, 0x25u, 0u);
        U8(pQ + 0x0Cu) = (c == 1) ? 2u : 3u;
        uint32_t args[3] = {pGame, pPlr, 0u};
        RUN_GAME(0x6FC77C00u, "ACT5Q4_SyncNihlathakQuestStateCallback_6FC77C00_113c", c, args, 3,
                 0u, pGame, pPlr, 0u, 0u, 0u, 1u, 0u, 0u, 0xFFFFFFFFu, 0x14A0u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1100u, pQ = ARENA_WORK + 0x1140u;
        uint32_t pPlr = ARENA_WORK + 0x1240u, pPd = ARENA_WORK + 0x1340u, pFl = ARENA_WORK + 0x13E0u, pBits = ARENA_WORK + 0x1400u;
        init_player_with_qflags(pGame, 0u, pPlr, 1u, pPd, pFl, pBits);
        attach_quest_node(pGame, pQC, pQ, 0x21u, ARENA_WORK + 0x1480u);
        if (c == 0) set_qbit(pBits, 0x25u, 0u);
        U8(pQ + 0x0Cu) = (c == 1) ? 2u : 3u;
        uint32_t args[3] = {pGame, pPlr, 0u};
        RUN_GAME(0x6FC78110u, "ACT5Q3_SyncPrisonOfIceQuestStateCallback_6FC78110_113c", c, args, 3,
                 0u, pGame, pPlr, 0u, 0u, 0u, 1u, 0u, 0u, 0xFFFFFFFFu, 0x14A0u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1100u, pQ = ARENA_WORK + 0x1140u;
        uint32_t pPlr = ARENA_WORK + 0x1240u, pPd = ARENA_WORK + 0x1340u, pFl = ARENA_WORK + 0x13E0u, pBits = ARENA_WORK + 0x1400u;
        init_player_with_qflags(pGame, 0u, pPlr, 1u, pPd, pFl, pBits);
        attach_quest_node(pGame, pQC, pQ, 0x20u, ARENA_WORK + 0x1480u);
        if (c == 0) set_qbit(pBits, 0x24u, 0u);
        U8(pQ + 0x0Cu) = (c == 1) ? 2u : 3u;
        uint32_t args[3] = {pGame, pPlr, 0u};
        RUN_GAME(0x6FC78530u, "ACT5Q2_SyncPlayerQuestStateWithQuest20_6FC78530_113c", c, args, 3,
                 0u, pGame, pPlr, 0u, 0u, 0u, 1u, 0u, 0u, 0xFFFFFFFFu, 0x14A0u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1100u, pQ = ARENA_WORK + 0x1140u;
        uint32_t pPlr = ARENA_WORK + 0x1240u, pPd = ARENA_WORK + 0x1340u, pFl = ARENA_WORK + 0x13E0u, pBits = ARENA_WORK + 0x1400u;
        init_player_with_qflags(pGame, 0u, pPlr, 1u, pPd, pFl, pBits);
        attach_quest_node(pGame, pQC, pQ, 0x1Fu, ARENA_WORK + 0x1480u);
        U8(pQ + 0x0Cu) = (c == 0) ? 2u : 3u;
        U8(pQ + 0x0Bu) = (c == 2) ? 2u : 1u;
        uint32_t args[3] = {pGame, pPlr, 0u};
        RUN_GAME(0x6FC78890u, "ACT5Q1_SyncPlayerQuestStateWithQuest1F_6FC78890_113c", c, args, 3,
                 0u, pGame, pPlr, 0u, 0u, 0u, 1u, 0u, 0u, 0xFFFFFFFFu, 0x14A0u);
    }

    /* 100..104: 'ice ' item quest callbacks (0x6FC77D80, 0x6FC77DD0, 0x6FC77E80, 0x6FC77F50, 0x6FC78040) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1100u, pQ = ARENA_WORK + 0x1140u, pQEx = ARENA_WORK + 0x1240u;
        uint32_t pPlr = ARENA_WORK + 0x1360u, pInv = ARENA_WORK + 0x1460u, pItm = ARENA_WORK + 0x14A0u, pId = ARENA_WORK + 0x15A0u;
        U32(pPlr + 0x00u) = 0u;
        if (c >= 1) attach_cursor_ice_item(pPlr, pInv, pItm, pId, (c == 1) ? 1u : 0u); /* 0='ice ', 1='hp1 ' */
        attach_quest_node(pGame, pQC, pQ, 3u, pQEx);
        uint32_t args[3] = {pGame, pPlr, 0u};
        RUN_GAME(0x6FC77D80u, "ACT5Q3_MarkQuest3PotionFlagIfPlayerHasIceItem_6FC77D80_113c", c, args, 3,
                 0u, pGame, pPlr, 0u, 0u, 0u, 1u, 0u, 0u, 0x00000000u, 0x1640u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1100u, pQ22 = ARENA_WORK + 0x1140u;
        uint32_t pQ = ARENA_WORK + 0x1240u, pQEx = ARENA_WORK + 0x1340u, pArg = ARENA_WORK + 0x1440u;
        uint32_t pPlr = ARENA_WORK + 0x1480u, pPd = ARENA_WORK + 0x1580u, pFl = ARENA_WORK + 0x1620u, pBits = ARENA_WORK + 0x1640u;
        init_player_with_qflags(pGame, 0u, pPlr, 1u, pPd, pFl, pBits);
        attach_quest_node(pGame, pQC, pQ22, 0x22u, ARENA_WORK + 0x16C0u);
        U8(pQ22 + 0x09u) = 1u;
        U32(pQ + 0x04u) = pGame; U32(pQ + 0x18u) = pQEx;
        U8(pQ + 0x09u) = (c == 0) ? 1u : 0u; U8(pQ + 0x0Cu) = 2u;
        U32(pArg + 0x00u) = pGame; U32(pArg + 0x0Cu) = pPlr;
        if (c == 2) attach_cursor_ice_item(pPlr, ARENA_WORK + 0x1700u, ARENA_WORK + 0x1740u, ARENA_WORK + 0x1840u, 0u);
        uint32_t args[2] = {pQ, pArg};
        RUN_GAME(0x6FC77DD0u, "ACT5Q3_Callback03_OnItemPickedUp_6FC77DD0_113c", c, args, 2,
                 0u, pQ, pArg, 0u, 0u, 0u, 0u, 0u, 0u, 0x00000000u, 0x18E0u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQ = ARENA_WORK + 0x80u, pQEx = ARENA_WORK + 0x180u, pArg = ARENA_WORK + 0x280u;
        uint32_t pPlr = ARENA_WORK + 0x2C0u, pPd = ARENA_WORK + 0x3C0u, pFl = ARENA_WORK + 0x460u, pBits = ARENA_WORK + 0x480u;
        init_player_with_qflags(pGame, 0u, pPlr, 1u, pPd, pFl, pBits);
        U32(pQ + 0x04u) = pGame; U8(pQ + 0x09u) = 1u; U32(pQ + 0x18u) = pQEx; U32(pQ + 0xE0u) = 0x25u;
        U32(pArg + 0x00u) = pGame; U32(pArg + 0x0Cu) = pPlr;
        if (c == 0) set_qbit(pBits, 0x25u, 0u);
        if (c == 1) set_qbit(pBits, 0x25u, 2u);
        if (c == 2) attach_cursor_ice_item(pPlr, ARENA_WORK + 0x500u, ARENA_WORK + 0x540u, ARENA_WORK + 0x640u, 0u);
        uint32_t args[2] = {pQ, pArg};
        RUN_GAME(0x6FC77E80u, "ACT5Q3_Callback11_OnPlayerConnect_6FC77E80_113c", c, args, 2,
                 0u, pQ, pArg, 0u, 0u, 0u, 0u, 0u, 0u, 0x00000000u, 0x6E0u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQ = ARENA_WORK + 0x80u, pQEx = ARENA_WORK + 0x180u;
        uint32_t pPlr = ARENA_WORK + 0x280u, pFl = ARENA_WORK + 0x380u, pBits = ARENA_WORK + 0x3A0u;
        init_quest_flags(pFl, pBits);
        U32(pQ + 0x04u) = pGame; U8(pQ + 0x09u) = 1u; U8(pQ + 0x0Cu) = 1u; U32(pQ + 0x18u) = pQEx; U32(pQ + 0xE0u) = 0x25u;
        U32(pPlr + 0x00u) = 0u;
        uint32_t npc = (c == 0) ? 0x201u : (c == 1 ? 0x20Fu : 0x1FFu);
        if (c == 1) attach_cursor_ice_item(pPlr, ARENA_WORK + 0x420u, ARENA_WORK + 0x460u, ARENA_WORK + 0x560u, 0u);
        uint32_t args[5] = {pQ, npc, pPlr, pFl, 0u};
        RUN_EX(0, 0x6FC77F50u, "ACT5Q3_ActiveFilter_6FC77F50_113c", c, args, 5,
               0u, pQ, npc, 0u, 0u, 0u, 3u, pPlr, pFl, 0u, 0u, 0u, 0u, 0x000000FFu, 0x600u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQ = ARENA_WORK + 0x80u, pQEx = ARENA_WORK + 0x180u, pArg = ARENA_WORK + 0x280u, pPlr = ARENA_WORK + 0x2C0u;
        U32(pQ + 0x18u) = pQEx; U16(pQ + 0x9Cu) = 1u; U32(pQ + 0x1Cu) = 9u;
        U16(pQEx + 0x80u) = 1u; U32(pQEx + 0x00u) = 9u; U32(pQEx + 0xD8u) = 3u;
        U32(pPlr + 0x00u) = 0u; U32(pPlr + 0x0Cu) = 9u;
        U32(pArg + 0x00u) = pGame; U32(pArg + 0x0Cu) = pPlr;
        if (c == 2) attach_cursor_ice_item(pPlr, ARENA_WORK + 0x3C0u, ARENA_WORK + 0x400u, ARENA_WORK + 0x500u, 0u);
        if (c == 0) U32(pPlr + 0x0Cu) = 88u;
        uint32_t args[2] = {pQ, pArg};
        RUN_GAME(0x6FC78040u, "ACT5Q3_Callback11_RemovePlayerGuidAndCheckIce_6FC78040_113c", c, args, 2,
                 0u, pQ, pArg, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x5A0u);
    }

    /* 106, 107, 108: 0x6FC781A0, 0x6FC78240, 0x6FC78260 */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQ = ARENA_WORK + 0x80u, pArg = ARENA_WORK + 0x180u;
        uint32_t pPlr = ARENA_WORK + 0x1C0u, pPd = ARENA_WORK + 0x2C0u, pFl = ARENA_WORK + 0x360u, pBits = ARENA_WORK + 0x380u;
        init_player_with_qflags(pGame, 0u, pPlr, 1u, pPd, pFl, pBits);
        U32(pQ + 0xE0u) = 0x24u;
        U32(pArg + 0x00u) = pGame; U32(pArg + 0x0Cu) = pPlr;
        set_qbit(pBits, 0x24u, 4u);
        if (c == 1) set_qbit(pBits, 0x24u, 3u);
        if (c == 2) set_qbit(pBits, 0x24u, 2u);
        uint32_t args[2] = {pQ, pArg};
        RUN_GAME(0x6FC781A0u, "ACT5Q2_Callback14_PlayerJoined_6FC781A0_113c", c, args, 2,
                 0u, pQ, pArg, 0u, 0u, 0u, 0u, 0u, 0u, 0x00000000u, 0x400u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQ = ARENA_WORK + 0x80u, pArg = ARENA_WORK + 0x180u;
        uint32_t pPlr = ARENA_WORK + 0x1C0u, pPd = ARENA_WORK + 0x2C0u, pFl = ARENA_WORK + 0x360u, pBits = ARENA_WORK + 0x380u;
        init_player_with_qflags(pGame, (uint8_t)c, pPlr, 1u, pPd, pFl, pBits);
        U32(pArg + 0x00u) = pGame; U32(pArg + 0x0Cu) = pPlr;
        set_qbit(pBits, 0x24u, 4u);
        if (c == 2) set_qbit(pBits, 0x24u, 2u);
        uint32_t args[2] = {pQ, pArg};
        RUN_GAME(0x6FC78240u, "ACT5Q2_Callback15_ClearState04_6FC78240_113c", c, args, 2,
                 0u, pQ, pArg, 0u, 0u, 0u, 0u, 0u, 0u, 0x00000000u, 0x400u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pQ = ARENA_WORK, pQEx = ARENA_WORK + 0x100u, pUnit = ARENA_WORK + 0x240u;
        U32(pQ + 0x18u) = pQEx;
        U32(pQEx + 0xB0u + 0u * 0x14u + 2u * 4u) = 101u;
        U32(pQEx + 0xB0u + 2u * 0x14u + 4u * 4u) = 303u;
        U32(pUnit + 0x0Cu) = (c == 0) ? 101u : (c == 1 ? 303u : 999u);
        uint32_t args[2] = {pUnit, pQ};
        RUN_GAME(0x6FC78260u, "ACT5Q2_FindSoldierPrisonGroupIndex_6FC78260_113c", c, args, 2,
                 pUnit, pQ, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x260u);
    }

    /* 111. 0x6FC785C0: ACT5Q1_CompleteQuestRecord23AndVerifyQuest1F (eax=pPlayer, edi=pGame; asserts 0x2EE) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1100u, pQ = ARENA_WORK + 0x1140u;
        uint32_t pPlr = ARENA_WORK + 0x1240u, pPd = ARENA_WORK + 0x1340u, pFl = ARENA_WORK + 0x13E0u, pBits = ARENA_WORK + 0x1400u;
        init_player_with_qflags(pGame, 0u, pPlr, 1u, pPd, pFl, pBits);
        if (c == 1) set_qbit(pBits, 0x23u, 0x0Fu);
        if (c == 2) attach_quest_node(pGame, pQC, pQ, 0x1Fu, ARENA_WORK + 0x1480u);
        uint32_t args[2] = {pPlr, pGame};
        RUN_GAME(0x6FC785C0u, "ACT5Q1_CompleteQuestRecord23AndVerifyQuest1F_6FC785C0_113c", c, args, 2,
                 pPlr, 0u, 0u, 0u, 0u, pGame, 0u, 0u, 0u, 0x00000000u, 0x1490u);
    }

    /* 114. 0x6FC78BE0: ACT5Q6_CompleteQuest28AndUpdateProgression (eax=pQuestFlags, ecx=pPlayer, ebx=pGame) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1100u, pQ = ARENA_WORK + 0x1140u, pQEx = ARENA_WORK + 0x1240u;
        uint32_t pPlr = ARENA_WORK + 0x1340u, pPd = ARENA_WORK + 0x1440u, pCli = ARENA_WORK + 0x1500u;
        uint32_t pFl = ARENA_WORK + 0x1540u, pBits = ARENA_WORK + 0x1560u;
        init_player_with_qflags(pGame, (uint8_t)c, pPlr, 1u, pPd, pFl, pBits);
        U32(pPd + 0x9Cu) = pCli;
        U16(pCli + 0x0Au) = 0x0020u; /* Expansion */
        if (c == 2) attach_quest_node(pGame, pQC, pQ, 0x24u, pQEx);
        uint32_t args[3] = {pFl, pPlr, pGame};
        RUN_GAME(0x6FC78BE0u, "ACT5Q6_CompleteQuest28AndUpdateProgression_6FC78BE0_113c", c, args, 3,
                 pFl, pPlr, 0u, pGame, 0u, 0u, 0u, 0u, 0u, 0x00000000u, 0x15D0u);
    }

    /* 115, 118, 119: ApplyPlayerSkillState{52,51,50} (ecx=pGame, edx=pPlayer, s0=pArg, ret 4) */
    {
        const struct { uint32_t va; const char *nm; uint32_t qid; } ssfns[3] = {
            {0x6FC78FF0u, "ACT5Q4_ApplyPlayerSkillState52IfQuest26State0D_6FC78FF0_113c", 0x26u},
            {0x6FC792F0u, "ACT5Q2_ApplyPlayerSkillState51IfQuest24State0D_6FC792F0_113c", 0x24u},
            {0x6FC79550u, "ACT5Q1_ApplyPlayerSkillState50IfQuest23State0D_6FC79550_113c", 0x23u},
        };
        for (int f = 0; f < 3; f++) {
            for (int c = 0; c < 3; c++) {
                reset_work();
                uint32_t pGame = ARENA_WORK, pPlr = ARENA_WORK + 0x80u, pPd = ARENA_WORK + 0x180u;
                uint32_t pFl = ARENA_WORK + 0x220u, pBits = ARENA_WORK + 0x240u;
                init_player_with_qflags(pGame, (c == 2) ? 1u : 0u, pPlr, 1u, pPd, pFl, pBits);
                if (c >= 1) set_qbit(pBits, ssfns[f].qid, 0x0Du);
                uint32_t args[3] = {pGame, pPlr, 0u};
                RUN_GAME(ssfns[f].va, ssfns[f].nm, c, args, 3,
                         0u, pGame, pPlr, 0u, 0u, 0u, 1u, 0u, 0u, 0xFFFFFFFFu, 0x2B0u);
            }
        }
    }

    /* 116 & 117. 0x6FC79230 & 0x6FC79290: ACT5Q2_{IncrementPrisonGroupKillCount,HasPrisonGroupAnyKills} */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1100u, pQ = ARENA_WORK + 0x1140u, pQEx = ARENA_WORK + 0x1240u, pUnit = ARENA_WORK + 0x1380u;
        attach_quest_node(pGame, pQC, pQ, 0x20u, pQEx);
        U8(pQ + 0x09u) = (c == 0) ? 0u : 1u;
        U32(pQEx + 0xB0u + 1u * 0x14u) = 55u;
        U32(pQEx + 0x114u + 1u * 4u) = (c == 2) ? 4u : 1u;
        U32(pUnit + 0x0Cu) = 55u;
        uint32_t args[2] = {pGame, pUnit};
        RUN_GAME(0x6FC79230u, "ACT5Q2_IncrementPrisonGroupKillCount_6FC79230_113c", c, args, 2,
                 pGame, 0u, 0u, 0u, 0u, 0u, 1u, pUnit, 0u, 0x00000000u, 0x13A0u);
    }
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1100u, pQ = ARENA_WORK + 0x1140u, pQEx = ARENA_WORK + 0x1240u, pUnit = ARENA_WORK + 0x1380u;
        attach_quest_node(pGame, pQC, pQ, 0x20u, pQEx);
        U8(pQ + 0x09u) = 1u;
        U32(pQEx + 0xB0u + 1u * 0x14u) = 55u;
        U32(pQEx + 0x114u + 1u * 4u) = (c == 2) ? 3u : 0u;
        U32(pUnit + 0x0Cu) = (c == 0) ? 99u : 55u;
        uint32_t args[2] = {pGame, pUnit};
        RUN_GAME(0x6FC79290u, "ACT5Q2_HasPrisonGroupAnyKills_6FC79290_113c", c, args, 2,
                 pGame, 0u, 0u, 0u, 0u, 0u, 1u, pUnit, 0u, 0xFFFFFFFFu, 0x13A0u);
    }

    /* 120..122: 0x6FC79A60, 0x6FC79AB0, 0x6FC79B00 (ecx=pOpParam -> eax; asserts 0x558 when pPlayer==0) */
    {
        const struct { uint32_t va; const char *nm; } opfns[3] = {
            {0x6FC79A60u, "ACT5Q4_OnObjectOperateApplySkillState13A_6FC79A60_113c"},
            {0x6FC79AB0u, "ACT5Q4_OnObjectOperateApplySkillState13B_6FC79AB0_113c"},
            {0x6FC79B00u, "ACT5Q4_OnObjectOperateApplySkillState13C_6FC79B00_113c"},
        };
        for (int f = 0; f < 3; f++) {
            for (int c = 0; c < 3; c++) {
                reset_work();
                uint32_t pOp = ARENA_WORK, pPlr = ARENA_WORK + 0x40u + (uint32_t)c * 0x10u;
                U32(pOp + 0x08u) = (c == 0) ? 0u : pPlr;
                uint32_t args[1] = {pOp};
                RUN_GAME(opfns[f].va, opfns[f].nm, c, args, 1,
                         0u, pOp, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0xFFFFFFFFu, 0x140u);
            }
        }
    }

    /* 123. 0x6FC7A290: ACT5Q2_FindSpawnedPrisonObjectForUnit (edi=pGame, s0=pUnit, s1=ppOutObject, ret 8) */
    for (int c = 0; c < 3; c++) {
        reset_work();
        uint32_t pGame = ARENA_WORK, pQC = ARENA_WORK + 0x1100u, pQ = ARENA_WORK + 0x1140u, pQEx = ARENA_WORK + 0x1240u;
        uint32_t pUnit = ARENA_WORK + 0x1740u, pObj = ARENA_WORK + 0x1780u, ppOut = ARENA_WORK + 0x1880u;
        attach_quest_node(pGame, pQC, pQ, 0x20u, pQEx);
        U32(pQEx + 0xB0u + 1u * 0x14u) = 55u;
        U8(pQEx + 0xF8u + 1u)  = (c >= 1) ? 1u : 0u;
        U32(pQEx + 0xECu + 4u) = 0x12u;
        U32(pUnit + 0x0Cu) = 55u;
        if (c == 2) {
            U32(pObj + 0x00u) = 2u; U32(pObj + 0x0Cu) = 0x12u;
            U32(pGame + 0x1520u + (0x12u & 0x7Fu) * 4u) = pObj;
        }
        uint32_t args[3] = {pGame, pUnit, ppOut};
        RUN_GAME(0x6FC7A290u, "ACT5Q2_FindSpawnedPrisonObjectForUnit_6FC7A290_113c", c, args, 3,
                 0u, 0u, 0u, 0u, 0u, pGame, 2u, pUnit, ppOut, 0xFFFFFFFFu, 0x1890u);
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

    HMODULE hCom = LoadLibraryA("D2Common.dll");
    if (!hCom) {
        fprintf(stderr, "LoadLibraryA(D2Common.dll) failed (err=%lu)\n", (unsigned long)GetLastError());
        return 4;
    }
    g_com_rebase = (uintptr_t)hCom - (uintptr_t)D2COM_PREF_BASE;

    HMODULE hGame = LoadLibraryA("D2Game.dll");
    if (!hGame) {
        fprintf(stderr, "LoadLibraryA(D2Game.dll) failed (err=%lu)\n", (unsigned long)GetLastError());
        return 5;
    }
    g_game_rebase = (uintptr_t)hGame - (uintptr_t)D2GAME_PREF_BASE;

    DWORD oldProt = 0;
    if (!VirtualProtect((void *)((uintptr_t)0x6FDD9000u + g_com_rebase), 0x1000u, PAGE_READWRITE, &oldProt)) {
        fprintf(stderr, "VirtualProtect(D2Common IAT) failed (err=%lu)\n", (unsigned long)GetLastError());
        return 6;
    }
    if (!VirtualProtect((void *)((uintptr_t)0x6FD18000u + g_game_rebase), 0x1000u, PAGE_READWRITE, &oldProt)) {
        fprintf(stderr, "VirtualProtect(D2Game IAT) failed (err=%lu)\n", (unsigned long)GetLastError());
        return 7;
    }

    g_orig_com_assert   = U32(D2COM_IAT_ASSERT_VA   + g_com_rebase);
    g_orig_com_alloc    = U32(D2COM_IAT_ALLOC_VA    + g_com_rebase);
    g_orig_com_free     = U32(D2COM_IAT_FREE_VA     + g_com_rebase);
    g_orig_com_salloc   = U32(D2COM_IAT_SALLOC_VA   + g_com_rebase);
    g_orig_com_sfree    = U32(D2COM_IAT_SFREE_VA    + g_com_rebase);
    g_orig_com_srealloc = U32(D2COM_IAT_SREALLOC_VA + g_com_rebase);
    g_orig_com_sgpt     = U32(D2COM_SGPT_PTR_VA     + g_com_rebase);
    g_orig_com_obj_ptr  = U32(D2COM_OBJ_PTR_VA      + g_com_rebase);
    g_orig_com_obj_cnt  = U32(D2COM_OBJ_CNT_VA      + g_com_rebase);
    g_orig_com_itm_cnt  = U32(D2COM_ITEMS_CNT_VA    + g_com_rebase);
    g_orig_com_itm_ptr  = U32(D2COM_ITEMS_PTR_VA    + g_com_rebase);

    g_orig_game_assert   = U32(D2GAME_IAT_ASSERT_VA   + g_game_rebase);
    g_orig_game_alloc    = U32(D2GAME_IAT_ALLOC_VA    + g_game_rebase);
    g_orig_game_free     = U32(D2GAME_IAT_FREE_VA     + g_game_rebase);
    g_orig_game_realloc  = U32(D2GAME_IAT_REALLOC_VA  + g_game_rebase);
    g_orig_game_salloc   = U32(D2GAME_IAT_SALLOC_VA   + g_game_rebase);
    g_orig_game_sfree    = U32(D2GAME_IAT_SFREE_VA    + g_game_rebase);
    g_orig_game_srealloc = U32(D2GAME_IAT_SREALLOC_VA + g_game_rebase);
    uint32_t pSgptGlobal = U32(D2GAME_IAT_SGPT_VA     + g_game_rebase);
    g_orig_game_sgpt     = U32(pSgptGlobal);

    init_static_tables();

    FILE *fp = fopen(argv[1], "wb");
    if (!fp) {
        fprintf(stderr, "fopen(%s) failed\n", argv[1]);
        return 8;
    }

    emit_tables_header(fp);
    emit_all_vectors(fp);
    fclose(fp);
    return 0;
}
