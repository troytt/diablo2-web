/*
 * k1r8-laneA-it11-emitter.c
 *
 * Real-DLL Wine differential vector emitter for Iteration 11 Lane A:
 *   - I11A-1 (15 net-new diff-verified functions -> i11a-1-vectors.ndjson)
 *   - I11A-2 (17 net-new diff-verified functions -> i11a-2-vectors.ndjson)
 *
 * Inline-assembly rule: Zero "m", "=m", "+m", "rm", "mr", "g", "o" constraints.
 * Must compile cleanly with -Wall -Wextra -Werror under both -O2 and -O2 -fno-omit-frame-pointer
 * and emit 100% SHA-256 identical NDJSON outputs across both optimization flags.
 */
#define _WIN32_WINNT 0x0501
#include <windows.h>
#include <setjmp.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define ARENA_BASE        0x03500000u
#define ARENA_SIZE        0x00100000u
#define HEAP_BASE         0x40000000u
#define HEAP_SIZE         0x00100000u

#define ARENA_SGPT        (ARENA_BASE + 0x0000u)
#define ARENA_UNIT0       (ARENA_BASE + 0x1000u)
#define ARENA_UNIT1       (ARENA_BASE + 0x1200u)
#define ARENA_ITEM0       (ARENA_BASE + 0x1600u)
#define ARENA_ITEM1       (ARENA_BASE + 0x1800u)
#define ARENA_ITEM2       (ARENA_BASE + 0x1A00u)
#define ARENA_ITEMDATA0   (ARENA_BASE + 0x1C00u)
#define ARENA_ITEMDATA1   (ARENA_BASE + 0x1E00u)
#define ARENA_ITEMDATA2   (ARENA_BASE + 0x2000u)
#define ARENA_INV0        (ARENA_BASE + 0x2200u)
#define ARENA_INV1        (ARENA_BASE + 0x2300u)
#define ARENA_GRIDS0      (ARENA_BASE + 0x2600u)
#define ARENA_CELLS0      (ARENA_BASE + 0x2A00u)
#define ARENA_CELLS1      (ARENA_BASE + 0x2C00u)
#define ARENA_STATLIST0   (ARENA_BASE + 0x3200u)
#define ARENA_STATLIST1   (ARENA_BASE + 0x3400u)
#define ARENA_STATLIST2   (ARENA_BASE + 0x3600u)
#define ARENA_STATS0      (ARENA_BASE + 0x3800u)
#define ARENA_STATS1      (ARENA_BASE + 0x3A00u)
#define ARENA_PATH0       (ARENA_BASE + 0x3C00u)
#define ARENA_PATH1       (ARENA_BASE + 0x3E00u)
#define ARENA_ROOM0       (ARENA_BASE + 0x4000u)
#define ARENA_ROOM1       (ARENA_BASE + 0x4100u)
#define ARENA_COLL0       (ARENA_BASE + 0x4200u)
#define ARENA_COLLMAP0    (ARENA_BASE + 0x4300u)
#define ARENA_PLRDATA0    (ARENA_BASE + 0x4600u)
#define ARENA_SKILLLIST0  (ARENA_BASE + 0x4800u)
#define ARENA_SKILL0      (ARENA_BASE + 0x4900u)
#define ARENA_MONDATA0    (ARENA_BASE + 0x4E00u)
#define ARENA_ANIMDATA0   (ARENA_BASE + 0x5000u)
#define ARENA_PROPENTRY   (ARENA_BASE + 0x5200u)
#define ARENA_OUT         (ARENA_BASE + 0x5C00u)
#define ARENA_OUT2        (ARENA_BASE + 0x5D00u)
#define ARENA_STATEFLAGS0 (ARENA_BASE + 0x5E00u)
#define ARENA_STATEMASKS  (ARENA_BASE + 0x6000u)
#define ARENA_XFORMSTATES (ARENA_BASE + 0x6200u)
#define ARENA_ITYPEMAT    (ARENA_BASE + 0x6400u)
#define ARENA_CHARSTATS   (ARENA_BASE + 0x6800u)
#define ARENA_MONSEQTABLE (ARENA_BASE + 0x7200u)
#define ARENA_SEQREC0     (ARENA_BASE + 0x7400u)
#define ARENA_HIRELING    (ARENA_BASE + 0x7800u)
#define ARENA_HIRELINGOUT (ARENA_BASE + 0x8000u)
#define ARENA_OBJDATA0    (ARENA_BASE + 0x8200u)
#define ARENA_STATESTXT   (ARENA_BASE + 0xB000u)
#define ARENA_ISC         (ARENA_BASE + 0x10000u)
#define ARENA_ITEMSTXT    (ARENA_BASE + 0x30000u)
#define ARENA_MONSTATS    (ARENA_BASE + 0x40000u)
#define ARENA_MONSTATS2   (ARENA_BASE + 0x50000u)
#define ARENA_SKILLSTXT   (ARENA_BASE + 0x60000u)
#define ARENA_MISSILESTXT (ARENA_BASE + 0x70000u)
#define ARENA_OBJTXT0     (ARENA_BASE + 0x71000u)

#define U32(addr) (*(volatile uint32_t *)((uintptr_t)(addr)))
#define U16(addr) (*(volatile uint16_t *)((uintptr_t)(addr)))
#define U8(addr)  (*(volatile uint8_t  *)((uintptr_t)(addr)))
#define S32(addr) (*(volatile int32_t  *)((uintptr_t)(addr)))
#define S16(addr) (*(volatile int16_t  *)((uintptr_t)(addr)))

static uint8_t *g_arena = NULL;
static uint8_t *g_heap = NULL;
static jmp_buf g_jmp_buf;
static int g_in_test_call = 0;
static uint32_t g_assert_line = 0;
static uint32_t g_heap_top = HEAP_BASE;
static int g_force_alloc_null = 0;

static uint32_t g_orig_iat_assert = 0;
static uint32_t g_orig_iat_alloc  = 0;
static uint32_t g_orig_iat_free   = 0;
static uint32_t g_orig_iat_realloc = 0;

static void __cdecl stub_fog_assert_line(uint32_t line) {
    g_assert_line = line;
    if (g_in_test_call) {
        g_in_test_call = 0;
        longjmp(g_jmp_buf, 1);
    }
}

static uint32_t __fastcall stub_fog_10045(
    uint32_t pMemPool, uint32_t size, const char *szFile, uint32_t nLine, uint32_t u0) {
    (void)pMemPool; (void)szFile; (void)nLine; (void)u0;
    if (g_force_alloc_null) return 0u;
    uint32_t p = (g_heap_top + 3u) & ~3u;
    memset((void *)(uintptr_t)p, 0, size);
    g_heap_top = p + size;
    return p;
}

static uint32_t __fastcall stub_fog_10046(
    uint32_t pMemPool, uint32_t pMem, const char *szFile, uint32_t nLine, uint32_t u0) {
    (void)pMemPool; (void)pMem; (void)szFile; (void)nLine; (void)u0;
    return 1u;
}

static uint32_t __fastcall stub_fog_10047(
    uint32_t pMemPool, uint32_t pOld, uint32_t newSize,
    const char *szFile, uint32_t nLine, uint32_t u0) {
    (void)pMemPool; (void)szFile; (void)nLine; (void)u0;
    if (g_force_alloc_null) return 0u;
    uint32_t p = (g_heap_top + 3u) & ~3u;
    memset((void *)(uintptr_t)p, 0, newSize);
    if (pOld != 0u) {
        memcpy((void *)(uintptr_t)p, (const void *)(uintptr_t)pOld, newSize);
    }
    g_heap_top = p + newSize;
    return p;
}

static void install_iat_hooks(void) {
    U32(0x6FDD90D4u) = (uint32_t)(uintptr_t)&stub_fog_assert_line;
    U32(0x6FDD90D0u) = (uint32_t)(uintptr_t)&stub_fog_10045;
    U32(0x6FDD90CCu) = (uint32_t)(uintptr_t)&stub_fog_10046;
    U32(0x6FDD90ACu) = (uint32_t)(uintptr_t)&stub_fog_10047;
}

static void restore_iat_hooks(void) {
    U32(0x6FDD90D4u) = g_orig_iat_assert;
    U32(0x6FDD90D0u) = g_orig_iat_alloc;
    U32(0x6FDD90CCu) = g_orig_iat_free;
    U32(0x6FDD90ACu) = g_orig_iat_realloc;
}

typedef uint32_t (__stdcall *stdcall1_t)(uint32_t);
typedef uint32_t (__stdcall *stdcall2_t)(uint32_t, uint32_t);
typedef uint32_t (__stdcall *stdcall3_t)(uint32_t, uint32_t, uint32_t);
typedef uint32_t (__stdcall *stdcall4_t)(uint32_t, uint32_t, uint32_t, uint32_t);
typedef uint32_t (__stdcall *stdcall5_t)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
typedef uint32_t (__stdcall *stdcall6_t)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
typedef uint32_t (__fastcall *fastcall_stack4_t)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
typedef uint32_t (__fastcall *fastcall_stack6_t)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
typedef uint32_t (__fastcall *fastcall_stack7_t)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);

typedef struct {
    uint32_t fn;
    uint32_t r_eax;
    uint32_t r_ecx;
    uint32_t r_edx;
    uint32_t r_ebx;
    uint32_t r_esi;
    uint32_t r_edi;
    uint32_t s[10];
    uint32_t ret;
} CallPkt;

_Static_assert(offsetof(CallPkt, s) == 28, "CallPkt.s offset must be 28");
_Static_assert(offsetof(CallPkt, ret) == 68, "CallPkt.ret offset must be 68");

static volatile CallPkt g_pkt;

static __attribute__((noinline)) uint32_t call_find_grid_placement(
    uint32_t fn, uint32_t edi_grid, uint32_t esi_outX, uint32_t edx_outY,
    uint32_t ecx_width, uint32_t s1_inv, uint32_t s2_height) {
    g_pkt.fn = fn;
    g_pkt.r_edi = edi_grid;
    g_pkt.r_esi = esi_outX;
    g_pkt.r_edx = edx_outY;
    g_pkt.r_ecx = ecx_width;
    g_pkt.s[0] = s1_inv;
    g_pkt.s[1] = s2_height;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "pushl 32(%0)\n\t"
        "pushl 28(%0)\n\t"
        "movl 24(%0), %%edi\n\t"
        "movl 20(%0), %%esi\n\t"
        "movl 12(%0), %%edx\n\t"
        "movl 8(%0), %%ecx\n\t"
        "movl 0(%0), %%eax\n\t"
        "call *%%eax\n\t"
        "movl %%eax, 68(%0)\n\t"
        : "+b"(base)
        :
        : "eax", "ecx", "edx", "esi", "edi", "cc", "memory"
    );
    return g_pkt.ret;
}

static __attribute__((noinline)) uint32_t call_eax_stack8(
    uint32_t fn, uint32_t eax_val, uint32_t s1, uint32_t s2, uint32_t s3,
    uint32_t s4, uint32_t s5, uint32_t s6, uint32_t s7, uint32_t s8) {
    g_pkt.fn = fn;
    g_pkt.r_eax = eax_val;
    g_pkt.s[0] = s1; g_pkt.s[1] = s2; g_pkt.s[2] = s3; g_pkt.s[3] = s4;
    g_pkt.s[4] = s5; g_pkt.s[5] = s6; g_pkt.s[6] = s7; g_pkt.s[7] = s8;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "pushl 56(%0)\n\t"
        "pushl 52(%0)\n\t"
        "pushl 48(%0)\n\t"
        "pushl 44(%0)\n\t"
        "pushl 40(%0)\n\t"
        "pushl 36(%0)\n\t"
        "pushl 32(%0)\n\t"
        "pushl 28(%0)\n\t"
        "movl 4(%0), %%eax\n\t"
        "movl 0(%0), %%ecx\n\t"
        "call *%%ecx\n\t"
        "movl %%eax, 68(%0)\n\t"
        : "+b"(base)
        :
        : "eax", "ecx", "edx", "esi", "edi", "cc", "memory"
    );
    return g_pkt.ret;
}

static __attribute__((noinline)) uint32_t call_eax_ecx_edi_stack6(
    uint32_t fn, uint32_t eax_val, uint32_t ecx_val, uint32_t edi_val,
    uint32_t s1, uint32_t s2, uint32_t s3, uint32_t s4, uint32_t s5, uint32_t s6) {
    g_pkt.fn = fn;
    g_pkt.r_eax = eax_val;
    g_pkt.r_ecx = ecx_val;
    g_pkt.r_edi = edi_val;
    g_pkt.s[0] = s1; g_pkt.s[1] = s2; g_pkt.s[2] = s3;
    g_pkt.s[3] = s4; g_pkt.s[4] = s5; g_pkt.s[5] = s6;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "pushl 48(%0)\n\t"
        "pushl 44(%0)\n\t"
        "pushl 40(%0)\n\t"
        "pushl 36(%0)\n\t"
        "pushl 32(%0)\n\t"
        "pushl 28(%0)\n\t"
        "movl 4(%0), %%eax\n\t"
        "movl 8(%0), %%ecx\n\t"
        "movl 24(%0), %%edi\n\t"
        "movl 0(%0), %%edx\n\t"
        "call *%%edx\n\t"
        "movl %%eax, 68(%0)\n\t"
        : "+b"(base)
        :
        : "eax", "ecx", "edx", "esi", "edi", "cc", "memory"
    );
    return g_pkt.ret;
}

static __attribute__((noinline)) uint32_t call_eax_ecx_edx_edi_stack5(
    uint32_t fn, uint32_t eax_val, uint32_t ecx_val, uint32_t edx_val, uint32_t edi_val,
    uint32_t s1, uint32_t s2, uint32_t s3, uint32_t s4, uint32_t s5) {
    g_pkt.fn = fn;
    g_pkt.r_eax = eax_val;
    g_pkt.r_ecx = ecx_val;
    g_pkt.r_edx = edx_val;
    g_pkt.r_edi = edi_val;
    g_pkt.s[0] = s1; g_pkt.s[1] = s2; g_pkt.s[2] = s3; g_pkt.s[3] = s4; g_pkt.s[4] = s5;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "pushl 44(%0)\n\t"
        "pushl 40(%0)\n\t"
        "pushl 36(%0)\n\t"
        "pushl 32(%0)\n\t"
        "pushl 28(%0)\n\t"
        "movl 4(%0), %%eax\n\t"
        "movl 8(%0), %%ecx\n\t"
        "movl 12(%0), %%edx\n\t"
        "movl 24(%0), %%edi\n\t"
        "movl 0(%0), %%esi\n\t"
        "call *%%esi\n\t"
        "movl %%eax, 68(%0)\n\t"
        : "+b"(base)
        :
        : "eax", "ecx", "edx", "esi", "edi", "cc", "memory"
    );
    return g_pkt.ret;
}

static __attribute__((noinline)) uint32_t call_esi0(uint32_t fn, uint32_t esi_val) {
    uint32_t ret_val;
    __asm__ volatile (
        "call *%2\n\t"
        : "=&a"(ret_val), "+S"(esi_val)
        : "r"(fn)
        : "ecx", "edx", "edi", "cc", "memory"
    );
    return ret_val;
}

static __attribute__((noinline)) uint32_t call_eax0(uint32_t fn, uint32_t eax_val) {
    uint32_t ret_val = eax_val;
    __asm__ volatile (
        "call *%1\n\t"
        : "+a"(ret_val)
        : "r"(fn)
        : "ecx", "edx", "esi", "edi", "cc", "memory"
    );
    return ret_val;
}

#define SAFE_BODY(call_expr)                                  \
    volatile uint32_t r = 0u;                                 \
    int * volatile out = pAsserted;                           \
    g_assert_line = 0u;                                       \
    install_iat_hooks();                                      \
    if (setjmp(g_jmp_buf) == 0) {                             \
        g_in_test_call = 1;                                   \
        r = (call_expr);                                      \
        g_in_test_call = 0;                                   \
        *out = 0;                                             \
    } else {                                                  \
        *out = 1;                                             \
    }                                                         \
    restore_iat_hooks();                                      \
    return r

static __attribute__((noinline)) uint32_t safe_stdcall1(uint32_t va, uint32_t a0, int *pAsserted) {
    SAFE_BODY(((stdcall1_t)(uintptr_t)va)(a0));
}
static __attribute__((noinline)) uint32_t safe_stdcall2(uint32_t va, uint32_t a0, uint32_t a1, int *pAsserted) {
    SAFE_BODY(((stdcall2_t)(uintptr_t)va)(a0, a1));
}
static __attribute__((noinline)) uint32_t safe_stdcall3(uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2, int *pAsserted) {
    SAFE_BODY(((stdcall3_t)(uintptr_t)va)(a0, a1, a2));
}
static __attribute__((noinline)) uint32_t safe_stdcall4(uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3, int *pAsserted) {
    SAFE_BODY(((stdcall4_t)(uintptr_t)va)(a0, a1, a2, a3));
}
static __attribute__((noinline)) uint32_t safe_stdcall5(uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3, uint32_t a4, int *pAsserted) {
    SAFE_BODY(((stdcall5_t)(uintptr_t)va)(a0, a1, a2, a3, a4));
}
static __attribute__((noinline)) uint32_t safe_stdcall6(uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3, uint32_t a4, uint32_t a5, int *pAsserted) {
    SAFE_BODY(((stdcall6_t)(uintptr_t)va)(a0, a1, a2, a3, a4, a5));
}
static __attribute__((noinline)) uint32_t safe_ecx_edx_stack4(
    uint32_t va, uint32_t ecx, uint32_t edx, uint32_t s1, uint32_t s2, uint32_t s3, uint32_t s4, int *pAsserted) {
    SAFE_BODY(((fastcall_stack4_t)(uintptr_t)va)(ecx, edx, s1, s2, s3, s4));
}
static __attribute__((noinline)) uint32_t safe_ecx_edx_stack6(
    uint32_t va, uint32_t ecx, uint32_t edx, uint32_t s1, uint32_t s2, uint32_t s3, uint32_t s4, uint32_t s5, uint32_t s6, int *pAsserted) {
    SAFE_BODY(((fastcall_stack6_t)(uintptr_t)va)(ecx, edx, s1, s2, s3, s4, s5, s6));
}
static __attribute__((noinline)) uint32_t safe_ecx_edx_stack7(
    uint32_t va, uint32_t ecx, uint32_t edx, uint32_t s1, uint32_t s2, uint32_t s3, uint32_t s4, uint32_t s5, uint32_t s6, uint32_t s7, int *pAsserted) {
    SAFE_BODY(((fastcall_stack7_t)(uintptr_t)va)(ecx, edx, s1, s2, s3, s4, s5, s6, s7));
}
static __attribute__((noinline)) uint32_t safe_find_grid(
    uint32_t va, uint32_t edi, uint32_t esi, uint32_t edx, uint32_t ecx, uint32_t s1, uint32_t s2, int *pAsserted) {
    SAFE_BODY(call_find_grid_placement(va, edi, esi, edx, ecx, s1, s2));
}
static __attribute__((noinline)) uint32_t safe_eax_stack8(
    uint32_t va, uint32_t eax, uint32_t s1, uint32_t s2, uint32_t s3, uint32_t s4,
    uint32_t s5, uint32_t s6, uint32_t s7, uint32_t s8, int *pAsserted) {
    SAFE_BODY(call_eax_stack8(va, eax, s1, s2, s3, s4, s5, s6, s7, s8));
}
static __attribute__((noinline)) uint32_t safe_eax_ecx_edi_stack6(
    uint32_t va, uint32_t eax, uint32_t ecx, uint32_t edi,
    uint32_t s1, uint32_t s2, uint32_t s3, uint32_t s4, uint32_t s5, uint32_t s6, int *pAsserted) {
    SAFE_BODY(call_eax_ecx_edi_stack6(va, eax, ecx, edi, s1, s2, s3, s4, s5, s6));
}
static __attribute__((noinline)) uint32_t safe_eax_ecx_edx_edi_stack5(
    uint32_t va, uint32_t eax, uint32_t ecx, uint32_t edx, uint32_t edi,
    uint32_t s1, uint32_t s2, uint32_t s3, uint32_t s4, uint32_t s5, int *pAsserted) {
    SAFE_BODY(call_eax_ecx_edx_edi_stack5(va, eax, ecx, edx, edi, s1, s2, s3, s4, s5));
}
static __attribute__((noinline)) uint32_t safe_esi0(uint32_t va, uint32_t esi, int *pAsserted) {
    SAFE_BODY(call_esi0(va, esi));
}
static __attribute__((noinline)) uint32_t safe_eax0(uint32_t va, uint32_t eax, int *pAsserted) {
    SAFE_BODY(call_eax0(va, eax));
}

typedef struct {
    uint32_t base;
    uint32_t len;
} mem_region_t;

static char g_pre_buf[524288];

static void capture_pre_json(char *buf, size_t cap, const mem_region_t *regions, int count) {
    size_t pos = 0;
    pos += (size_t)snprintf(buf + pos, cap - pos, "[");
    for (int i = 0; i < count; i++) {
        if (i > 0) pos += (size_t)snprintf(buf + pos, cap - pos, ",");
        pos += (size_t)snprintf(buf + pos, cap - pos, "{\"base\":\"0x%08X\",\"hex\":\"", regions[i].base);
        const uint8_t *p = (const uint8_t *)(uintptr_t)regions[i].base;
        for (uint32_t b = 0; b < regions[i].len; b++) {
            pos += (size_t)snprintf(buf + pos, cap - pos, "%02x", p[b]);
        }
        pos += (size_t)snprintf(buf + pos, cap - pos, "\"}");
        if (regions[i].base == 0x6FDD9088u) {
            uint32_t bm_ptr = *(const uint32_t *)(uintptr_t)0x6FDD90B0u;
            pos += (size_t)snprintf(buf + pos, cap - pos, ",{\"base\":\"0x%08X\",\"hex\":\"", bm_ptr);
            const uint8_t *bp = (const uint8_t *)(uintptr_t)bm_ptr;
            for (uint32_t b = 0; b < 0x80u; b++) {
                pos += (size_t)snprintf(buf + pos, cap - pos, "%02x", bp[b]);
            }
            pos += (size_t)snprintf(buf + pos, cap - pos, "\"}");
        }
    }
    snprintf(buf + pos, cap - pos, "]");
}

static void emit_regions_json(FILE *fp, const mem_region_t *regions, int count) {
    fputc('[', fp);
    for (int i = 0; i < count; i++) {
        if (i > 0) fputc(',', fp);
        fprintf(fp, "{\"base\":\"0x%08X\",\"hex\":\"", regions[i].base);
        const uint8_t *p = (const uint8_t *)(uintptr_t)regions[i].base;
        for (uint32_t b = 0; b < regions[i].len; b++) {
            fprintf(fp, "%02x", p[b]);
        }
        fputs("\"}", fp);
        if (regions[i].base == 0x6FDD9088u) {
            uint32_t bm_ptr = *(const uint32_t *)(uintptr_t)0x6FDD90B0u;
            fprintf(fp, ",{\"base\":\"0x%08X\",\"hex\":\"", bm_ptr);
            const uint8_t *bp = (const uint8_t *)(uintptr_t)bm_ptr;
            for (uint32_t b = 0; b < 0x80u; b++) {
                fprintf(fp, "%02x", bp[b]);
            }
            fputs("\"}", fp);
        }
    }
    if (g_heap_top > HEAP_BASE) {
        if (count > 0) fputc(',', fp);
        uint32_t hlen = g_heap_top - HEAP_BASE;
        fprintf(fp, "{\"base\":\"0x%08X\",\"hex\":\"", HEAP_BASE);
        const uint8_t *hp = (const uint8_t *)(uintptr_t)HEAP_BASE;
        for (uint32_t b = 0; b < hlen; b++) {
            fprintf(fp, "%02x", hp[b]);
        }
        fputs("\"}", fp);
    }
    fputc(']', fp);
}

static void emit_rec(
    FILE *fp,
    const char *va,
    const char *name,
    int case_idx,
    const char *note,
    const char *args_json,
    const mem_region_t *regions,
    int reg_count,
    int asserted,
    uint32_t ret_eax,
    uint32_t ret_mask
) {
    if (asserted) {
        fprintf(fp,
            "{\"va\":\"%s\",\"name\":\"%s\",\"caseIndex\":%d,\"note\":\"%s\","
            "\"inputs\":{\"args\":[%s],\"memory\":%s},"
            "\"expectedAssert\":{\"line\":%u},"
            "\"outputs\":{\"eax\":\"0x00000000\",\"retMask\":\"0x00000000\",\"memory\":[]}}\n",
            va, name, case_idx, note, args_json, g_pre_buf, g_assert_line);
    } else {
        fprintf(fp,
            "{\"va\":\"%s\",\"name\":\"%s\",\"caseIndex\":%d,\"note\":\"%s\","
            "\"inputs\":{\"args\":[%s],\"memory\":%s},"
            "\"outputs\":{\"eax\":\"0x%08X\",\"retMask\":\"0x%08X\",\"memory\":",
            va, name, case_idx, note, args_json, g_pre_buf, ret_eax, ret_mask);
        emit_regions_json(fp, regions, reg_count);
        fputs("}}\n", fp);
    }
}

static void setup_common_tables(void) {
    memset(g_arena, 0, ARENA_SIZE);
    memset(g_heap, 0, 0x4000u);
    g_heap_top = HEAP_BASE;
    g_force_alloc_null = 0;

    U32(0x6FDE9E1Cu) = ARENA_SGPT;
    U32(ARENA_SGPT + 0x0BCu) = ARENA_STATESTXT;
    U32(ARENA_SGPT + 0x0C4u) = 185u;
    for (uint32_t m = 0; m < 40u; m++) {
        U32(ARENA_SGPT + 0x0CCu + m * 4u) = ARENA_STATEMASKS + m * 24u;
    }
    U32(ARENA_SGPT + 0x17Cu) = ARENA_XFORMSTATES;
    U16(ARENA_SGPT + 0x180u) = 0u;
    U32(ARENA_SGPT + 0xA78u) = ARENA_MONSTATS;
    U32(ARENA_SGPT + 0xA80u) = 300u;
    U32(ARENA_SGPT + 0xA90u) = ARENA_MONSTATS2;
    U32(ARENA_SGPT + 0xA98u) = 300u;
    U32(ARENA_SGPT + 0xB98u) = ARENA_SKILLSTXT;
    U32(ARENA_SGPT + 0xBA0u) = 20u;
    U32(ARENA_SGPT + 0xBC0u) = 300u;
    U32(ARENA_SGPT + 0xBC4u) = ARENA_CHARSTATS;
    U32(ARENA_SGPT + 0xBC8u) = 7u;
    U32(ARENA_SGPT + 0xBCCu) = ARENA_ISC;
    U32(ARENA_SGPT + 0xBD4u) = 359u;
    U32(ARENA_SGPT + 0xBFCu) = 64u;
    U32(ARENA_SGPT + 0xC00u) = 2u;
    U32(ARENA_SGPT + 0xC04u) = ARENA_ITYPEMAT;
    U32(ARENA_SGPT + 0xC6Cu) = 6u;     /* nSkillShift for stat 0xCC */
    U32(ARENA_SGPT + 0xC70u) = 0x3Fu;  /* nSkillMask */

    U32(0x6FDEFB94u) = 10u;
    U32(0x6FDEFB98u) = ARENA_ITEMSTXT;
    U32(0x6FDEFF6Cu) = ARENA_OUT2; /* ITEMS link ptr (count=0) */

    U32(0x6FDF0078u) = ARENA_HIRELING;
    U32(0x6FDF007Cu) = 0u;

    U32(0x6FDF0A5Cu) = ARENA_MONSEQTABLE;
    U32(0x6FDF0A60u) = 8u;

    /* Weapon class code index table at 0x6FDEF020 */
    U32(0x6FDEF020u) = 6u;
    U32(0x6FDEF028u + 0u * 8u + 0u) = 0x20687468u; U16(0x6FDEF028u + 0u * 8u + 4u) = 0u;  /* 'hth ' -> 0 */
    U32(0x6FDEF028u + 1u * 8u + 0u) = 0x20736831u; U16(0x6FDEF028u + 1u * 8u + 4u) = 2u;  /* '1hs ' -> 2 */
    U32(0x6FDEF028u + 2u * 8u + 0u) = 0x20746831u; U16(0x6FDEF028u + 2u * 8u + 4u) = 3u;  /* '1ht ' -> 3 */
    U32(0x6FDEF028u + 3u * 8u + 0u) = 0x20776F62u; U16(0x6FDEF028u + 3u * 8u + 4u) = 1u;  /* 'bow ' -> 1 */
    U32(0x6FDEF028u + 4u * 8u + 0u) = 0x20736832u; U16(0x6FDEF028u + 4u * 8u + 4u) = 5u;  /* '2hs ' -> 5 */
    U32(0x6FDEF028u + 5u * 8u + 0u) = 0x20317468u; U16(0x6FDEF028u + 5u * 8u + 4u) = 12u; /* 'ht1 ' -> 12 */

    /* CharStats: 7 classes default base wclass = 'hth ' */
    for (uint32_t c = 0; c < 7u; c++) {
        U32(ARENA_CHARSTATS + c * 0xC4u + 0x4Cu) = 0x20687468u;
    }

    /* Item 0: 1H sword ('1hs ', type 0x1E -> weapon 0x2D, bComp=5, invWidth=0, quiver=1) */
    U32(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x80u) = 0x20736831u;
    U32(ARENA_ITEMSTXT + 0u * 0x1A8u + 0xC0u) = 0x20736831u;
    U32(ARENA_ITEMSTXT + 0u * 0x1A8u + 0xC4u) = 0x20736832u;
    U8(ARENA_ITEMSTXT  + 0u * 0x1A8u + 0x104u) = 1u;   /* quiver/adder = 1 */
    U8(ARENA_ITEMSTXT  + 0u * 0x1A8u + 0x115u) = 5u;   /* nComponent = 5 */
    U8(ARENA_ITEMSTXT  + 0u * 0x1A8u + 0x11Cu) = 0u;   /* invWidth / b2H = 0 */
    U16(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x11Eu) = 0x1Eu;
    U8(ARENA_ITEMSTXT  + 0u * 0x1A8u + 0x13Du) = 0u;

    /* Item 1: 1H thrust ('1ht ', type 0x1E -> weapon 0x2D, bComp=5, invWidth=0, quiver=2) */
    U32(ARENA_ITEMSTXT + 1u * 0x1A8u + 0x80u) = 0x20746831u;
    U32(ARENA_ITEMSTXT + 1u * 0x1A8u + 0xC0u) = 0x20746831u;
    U32(ARENA_ITEMSTXT + 1u * 0x1A8u + 0xC4u) = 0x20746832u;
    U8(ARENA_ITEMSTXT  + 1u * 0x1A8u + 0x104u) = 2u;
    U8(ARENA_ITEMSTXT  + 1u * 0x1A8u + 0x115u) = 5u;
    U8(ARENA_ITEMSTXT  + 1u * 0x1A8u + 0x11Cu) = 0u;
    U16(ARENA_ITEMSTXT + 1u * 0x1A8u + 0x11Eu) = 0x1Eu;
    U8(ARENA_ITEMSTXT  + 1u * 0x1A8u + 0x13Du) = 0u;

    /* Item 2: Bow ('bow ', type 0x1B -> weapon 0x2D, bComp=5) */
    U32(ARENA_ITEMSTXT + 2u * 0x1A8u + 0x80u) = 0x20776F62u;
    U32(ARENA_ITEMSTXT + 2u * 0x1A8u + 0xC0u) = 0x20776F62u;
    U32(ARENA_ITEMSTXT + 2u * 0x1A8u + 0xC4u) = 0x20776F62u;
    U8(ARENA_ITEMSTXT  + 2u * 0x1A8u + 0x104u) = 0u;
    U8(ARENA_ITEMSTXT  + 2u * 0x1A8u + 0x115u) = 5u;
    U8(ARENA_ITEMSTXT  + 2u * 0x1A8u + 0x11Cu) = 1u;
    U16(ARENA_ITEMSTXT + 2u * 0x1A8u + 0x11Eu) = 0x1Bu;

    /* Item 3: 1-or-2H sword ('1hs '/'2hs ', type 0x1E, b1or2Handed=1) */
    U32(ARENA_ITEMSTXT + 3u * 0x1A8u + 0x80u) = 0x20736832u;
    U32(ARENA_ITEMSTXT + 3u * 0x1A8u + 0xC0u) = 0x20736831u;
    U32(ARENA_ITEMSTXT + 3u * 0x1A8u + 0xC4u) = 0x20736832u;
    U8(ARENA_ITEMSTXT  + 3u * 0x1A8u + 0x104u) = 3u;
    U8(ARENA_ITEMSTXT  + 3u * 0x1A8u + 0x115u) = 5u;
    U8(ARENA_ITEMSTXT  + 3u * 0x1A8u + 0x11Cu) = 1u;
    U16(ARENA_ITEMSTXT + 3u * 0x1A8u + 0x11Eu) = 0x1Eu;
    U8(ARENA_ITEMSTXT  + 3u * 0x1A8u + 0x13Du) = 1u;

    /* Item 4: Assassin claw ('ht1 ', type 0x1E, bComp=5) */
    U32(ARENA_ITEMSTXT + 4u * 0x1A8u + 0x80u) = 0x20317468u;
    U32(ARENA_ITEMSTXT + 4u * 0x1A8u + 0xC0u) = 0x20317468u;
    U8(ARENA_ITEMSTXT  + 4u * 0x1A8u + 0x115u) = 5u;
    U8(ARENA_ITEMSTXT  + 4u * 0x1A8u + 0x11Cu) = 0u;
    U16(ARENA_ITEMSTXT + 4u * 0x1A8u + 0x11Eu) = 0x1Eu;

    /* Item 5: Shield (type 0x33, bComp=6, invWidth=2) */
    U32(ARENA_ITEMSTXT + 5u * 0x1A8u + 0x80u) = 0x20637562u;
    U8(ARENA_ITEMSTXT  + 5u * 0x1A8u + 0x115u) = 6u;
    U8(ARENA_ITEMSTXT  + 5u * 0x1A8u + 0x11Cu) = 2u;
    U16(ARENA_ITEMSTXT + 5u * 0x1A8u + 0x11Eu) = 0x33u;

    /* ItemType equiv matrix: 0x1E and 0x1B both map to weapon 0x2D (bit 13 of word 1) */
    U32(ARENA_ITYPEMAT + 0x1Eu * 8u + 4u) = (1u << (0x2Du - 32u));
    U32(ARENA_ITYPEMAT + 0x1Bu * 8u + 4u) = (1u << (0x2Du - 32u));

    /* ItemStatCost minimal entries: stat 7 (maxhp), stat 12 (level), stat 0x3A (item_mindamage_percent),
     * stat 0xCC (item_charged_skill), stat 0x146 (stat 326), stat 0x149 (329), stat 0x14A (330) */
    U8(ARENA_ISC + 7u * 0x144u + 0x18u) = 8u;     /* valShift 8? note in ISC +0x18 is ValShift for 0x6FD975E0 */
    U8(ARENA_ISC + 0x3Au * 0x144u + 0x18u) = 0u;
    U8(ARENA_ISC + 0xCCu * 0x144u + 0x18u) = 0u;
    U8(ARENA_ISC + 0x146u * 0x144u + 0x18u) = 0u;
    U8(ARENA_ISC + 0x149u * 0x144u + 0x18u) = 0u;
    U8(ARENA_ISC + 0x14Au * 0x144u + 0x18u) = 0u;
}

static void setup_room_coll(uint32_t room, uint32_t coll, uint32_t map) {
    U32(room + 0x20u) = coll;
    S32(room + 0x4Cu) = 0;
    S32(room + 0x50u) = 0;
    S32(room + 0x54u) = 10;
    S32(room + 0x58u) = 10;
    U32(coll + 0x08u) = 10u;
    U32(coll + 0x0Cu) = 10u;
    U32(coll + 0x20u) = map;
}

static void setup_player_weapon_inv(uint32_t unit, uint32_t cls, uint32_t mode, uint32_t inv,
                                    uint32_t right_item, uint32_t left_item) {
    U32(unit + 0x00u) = 0u; /* PLAYER */
    U32(unit + 0x04u) = cls;
    U32(unit + 0x0Cu) = 100u;
    U32(unit + 0x10u) = mode;
    U32(unit + 0x60u) = inv;
    U32(inv + 0x00u) = 0x01020304u;
    U32(inv + 0x08u) = unit;
    U32(inv + 0x14u) = ARENA_GRIDS0;
    U32(inv + 0x18u) = 1u;
    U32(inv + 0x1Cu) = 0xFFFFFFFFu;
    U8(ARENA_GRIDS0 + 0x08u) = 13u;
    U8(ARENA_GRIDS0 + 0x09u) = 1u;
    U32(ARENA_GRIDS0 + 0x0Cu) = ARENA_CELLS0;
    U32(ARENA_CELLS0 + 0x10u) = right_item;
    U32(ARENA_CELLS0 + 0x14u) = left_item;
    if (right_item != 0u) {
        U32(inv + 0x0Cu) = right_item;
        U32(inv + 0x10u) = left_item ? left_item : right_item;
        U32(inv + 0x28u) = left_item ? 2u : 1u;
    }
}

static void setup_item_rec(uint32_t item, uint32_t id, uint32_t cls_id, uint32_t item_data, uint32_t inv, uint32_t body_loc) {
    U32(item + 0x00u) = 4u;
    U32(item + 0x04u) = cls_id;
    U32(item + 0x0Cu) = id;
    U32(item + 0x14u) = item_data;
    U8(item_data + 0x44u) = (uint8_t)body_loc;
    U32(item_data + 0x5Cu) = inv;
}

static void emit_i11a_1(FILE *fp) {
    char args[512];
    int asserted = 0;
    uint32_t eax = 0;

    /* =========================================================================
     * #01 0x6FD9D760 UNITS_TestCollisionBetweenUnitsWithDoors113c (ret 0x18, mask 0xFFFF)
     * ecx=pRoom, edx=nX1, [esp+4..0x18]=(nY1, nX2, nY2, nUnitSize, dwPattern, dwMoveMask)
     * ========================================================================= */
    for (int c = 0; c < 3; c++) {
        setup_common_tables();
        setup_room_coll(ARENA_ROOM0, ARENA_COLL0, ARENA_COLLMAP0);
        U16(ARENA_COLLMAP0 + (2u * 10u + 2u) * 2u) = 0x0001u;
        if (c == 1) U16(ARENA_COLLMAP0 + (2u * 10u + 5u) * 2u) = 0x0001u;
        if (c == 2) U16(ARENA_COLLMAP0 + (2u * 10u + 5u) * 2u) = 0x0004u;
        mem_region_t regs[] = {
            {0x6FDD9388u, 0x68u}, {ARENA_ROOM0, 0x80u}, {ARENA_COLL0, 0x40u}, {ARENA_COLLMAP0, 0x200u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 4);
        eax = safe_ecx_edx_stack6(0x6FD9D760u, ARENA_ROOM0, 2u, 2u, 5u, 2u, 1u, 1u, 5u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",2,2,5,2,1,1,5", ARENA_ROOM0);
        emit_rec(fp, "0x6FD9D760", "UNITS_TestCollisionBetweenUnitsWithDoors113c", c,
            c == 0 ? "clear_moves_pattern" : c == 1 ? "blocked_bit1_restores" : "blocked_bit4_restores",
            args, regs, 4, asserted, eax, 0x0000FFFFu);
    }

    /* =========================================================================
     * #02 0x6FD815E0 UNITS_FindFreeCoords113c (stdcall ret 0x10)
     * ========================================================================= */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        setup_room_coll(ARENA_ROOM0, ARENA_COLL0, ARENA_COLLMAP0);
        U32(ARENA_MONSTATS + 0x14u) = 0u;
        U8(ARENA_MONSTATS2 + 0x08u) = 1u;
        U32(ARENA_SGPT + 0xB64u) = ARENA_MISSILESTXT;
        U32(ARENA_SGPT + 0xB6Cu) = 10u;
        U8(ARENA_MISSILESTXT + 0x18Au) = 1u;
        U32(ARENA_UNIT0 + 0x00u) = (c == 3) ? 4u : (c == 4) ? 3u : 1u; /* static item / missile / monster */
        U32(ARENA_UNIT0 + 0x04u) = 0u;
        U32(ARENA_UNIT0 + 0x2Cu) = ARENA_PATH0;
        if (c == 3) {
            U32(ARENA_PATH0 + 0x00u) = ARENA_ROOM0;
            U32(ARENA_PATH0 + 0x0Cu) = 2u;
            U32(ARENA_PATH0 + 0x10u) = 2u;
        } else {
            U16(ARENA_PATH0 + 0x02u) = 2u;
            U16(ARENA_PATH0 + 0x06u) = (c == 4) ? 7u : 2u;
            U32(ARENA_PATH0 + 0x0Cu) = (c == 4) ? 2u : 0u;
            U32(ARENA_PATH0 + 0x10u) = (c == 4) ? 2u : 0u;
            U32(ARENA_PATH0 + 0x1Cu) = (c == 1) ? 0u : ARENA_ROOM0;
        }
        /* Case 2: (2,2)->(6,2) clear; Case 3: blocked at (4,2); Case 4: missile dyn (2,7)->(6,2) blocked (row 2 clear) */
        if (c == 3) U16(ARENA_COLLMAP0 + (2u * 10u + 4u) * 2u) = 0x0001u;
        if (c == 4) {
            for (uint32_t yy = 4u; yy <= 7u; yy++) {
                for (uint32_t xx = 2u; xx <= 6u; xx++) {
                    U16(ARENA_COLLMAP0 + (yy * 10u + xx) * 2u) = 0x0001u;
                }
            }
        }
        uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDD9388u, 0x68u},
            {ARENA_SGPT, 0xC78u}, {ARENA_MONSTATS, 0x200u}, {ARENA_MONSTATS2, 0x200u},
            {ARENA_MISSILESTXT, 0x200u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_PATH0, 0x60u}, {ARENA_ROOM0, 0x80u},
            {ARENA_COLL0, 0x40u}, {ARENA_COLLMAP0, 0x200u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 12);
        eax = safe_stdcall4(0x6FD815E0u, uArg, 6u, 2u, 1u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",6,2,1", uArg);
        emit_rec(fp, "0x6FD815E0", "UNITS_FindFreeCoords113c", c,
            c == 0 ? "null_unit_zero" : c == 1 ? "null_room_zero" : c == 2 ? "dyn_clear_zero" :
            c == 3 ? "static_blocked_one" : "missile_type3_blocked_one",
            args, regs, 12, asserted, eax, 0xFFFFFFFFu);
    }

    /* =========================================================================
     * #03 0x6FD818C0 UNITS_SetTargetUnitForDynamicUnitEx113c (stdcall ret 4, void)
     * ========================================================================= */
    for (int c = 0; c < 7; c++) {
        setup_common_tables();
        setup_room_coll(ARENA_ROOM0, ARENA_COLL0, ARENA_COLLMAP0);
        U32(ARENA_MONSTATS + 0x14u) = 0u;
        U8(ARENA_MONSTATS2 + 0x08u) = 1u; /* sizeX */
        U8(ARENA_MONSTATS2 + 0x09u) = 1u; /* sizeY */
        U32(ARENA_SGPT + 0xB64u) = ARENA_MISSILESTXT;
        U32(ARENA_SGPT + 0xB6Cu) = 10u;
        U8(ARENA_MISSILESTXT + 0x18Au) = 1u;
        U32(ARENA_UNIT0 + 0x00u) = (c == 1) ? 4u : (c == 3) ? 3u : (c == 4) ? 2u : (c == 6) ? 5u : 1u;
        U32(ARENA_UNIT0 + 0x04u) = 0u;
        U32(ARENA_UNIT0 + 0x2Cu) = (c == 5) ? 0u : ARENA_PATH0;
        if (c == 4) {
            U32(ARENA_UNIT0 + 0x14u) = ARENA_OBJDATA0;
            U32(ARENA_OBJDATA0 + 0x00u) = ARENA_OBJTXT0;
            U32(ARENA_OBJTXT0 + 0xD0u) = 1u;  /* dwSizeX */
            U32(ARENA_OBJTXT0 + 0xD4u) = 1u;  /* dwSizeY */
            U8(ARENA_OBJTXT0 + 0x13Au) = 1u;  /* nOperateFn -> mask 0x806 */
            U8(ARENA_OBJTXT0 + 0x13Bu) = 1u;  /* bBlocksVis */
        }
        if (c == 1 || c == 4 || c == 6) {
            U32(ARENA_PATH0 + 0x00u) = ARENA_ROOM0;
            U32(ARENA_PATH0 + 0x0Cu) = 3u;
            U32(ARENA_PATH0 + 0x10u) = 4u;
        } else if (c != 5) {
            U16(ARENA_PATH0 + 0x02u) = 3u;
            U16(ARENA_PATH0 + 0x06u) = 4u;
            U32(ARENA_PATH0 + 0x0Cu) = (c == 3) ? 1u : 0u;
            U32(ARENA_PATH0 + 0x10u) = (c == 3) ? 1u : 0u;
            U32(ARENA_PATH0 + 0x1Cu) = (c == 2) ? 0u : ARENA_ROOM0;
            U32(ARENA_PATH0 + 0x4Cu) = 0xFFFFu; /* nFootprintCollisionMask */
        }
        U16(ARENA_COLLMAP0 + (4u * 10u + 3u) * 2u) = 0xFFFFu;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDD9388u, 0x68u},
            {ARENA_SGPT, 0xC78u}, {ARENA_MONSTATS, 0x200u}, {ARENA_MONSTATS2, 0x200u},
            {ARENA_MISSILESTXT, 0x200u}, {ARENA_OBJDATA0, 0x40u}, {ARENA_OBJTXT0, 0x1C0u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_PATH0, 0x60u}, {ARENA_ROOM0, 0x80u},
            {ARENA_COLL0, 0x40u}, {ARENA_COLLMAP0, 0x200u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 14);
        safe_stdcall1(0x6FD818C0u, ARENA_UNIT0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
        emit_rec(fp, "0x6FD818C0", "UNITS_SetTargetUnitForDynamicUnitEx113c", c,
            c == 0 ? "dyn_unit_resets_mask" : c == 1 ? "static_unit_resets_mask" :
            c == 2 ? "null_room_noop" : c == 3 ? "missile_type3_resets_mask" :
            c == 4 ? "obj_type2_resets_mask" : c == 5 ? "null_path_noop" : "tile_type5_size0_noop",
            args, regs, 14, asserted, 0u, 0u);
    }

    /* =========================================================================
     * #04 0x6FD93860 COMPOSIT_GetWeaponClassCode113c (stdcall ret 0x18)
     * (pUnit, nUnitType, nClass, nMode, pInventory, pOutWeaponClassId)
     * ========================================================================= */
    for (int c = 0; c < 8; c++) {
        setup_common_tables();
        U32(ARENA_OUT) = 0xDEADBEEFu;
        uint32_t uType = 0u, cls = 0u, mode = 1u, inv = 0u;
        if (c == 0) {
            uType = 0u; cls = 0u; mode = 1u; inv = 0u; /* player unarmed -> hth */
        } else if (c == 1) {
            uType = 0u; cls = 0u; mode = 1u; inv = ARENA_INV0; /* player 1hs right */
            setup_player_weapon_inv(ARENA_UNIT0, 0u, 1u, ARENA_INV0, ARENA_ITEM0, 0u);
            setup_item_rec(ARENA_ITEM0, 1u, 0u, ARENA_ITEMDATA0, ARENA_INV0, 4u);
        } else if (c == 2) {
            uType = 0u; cls = 4u; mode = 1u; inv = ARENA_INV0; /* barb dual 1hs+1ht -> 1js (8) */
            setup_player_weapon_inv(ARENA_UNIT0, 4u, 1u, ARENA_INV0, ARENA_ITEM0, ARENA_ITEM1);
            U32(ARENA_INV0 + 0x1Cu) = 1u;
            setup_item_rec(ARENA_ITEM0, 1u, 0u, ARENA_ITEMDATA0, ARENA_INV0, 4u);
            setup_item_rec(ARENA_ITEM1, 2u, 1u, ARENA_ITEMDATA1, ARENA_INV0, 5u);
        } else if (c == 3) {
            uType = 0u; cls = 6u; mode = 1u; inv = ARENA_INV0; /* sin dual claw -> ht2 (13) */
            setup_player_weapon_inv(ARENA_UNIT0, 6u, 1u, ARENA_INV0, ARENA_ITEM0, ARENA_ITEM1);
            setup_item_rec(ARENA_ITEM0, 1u, 4u, ARENA_ITEMDATA0, ARENA_INV0, 4u);
            setup_item_rec(ARENA_ITEM1, 2u, 4u, ARENA_ITEMDATA1, ARENA_INV0, 5u);
        } else if (c == 4) {
            uType = 1u; cls = 0u; mode = 1u; inv = 0u; /* monster mode 1 -> monStats2+0x10 */
            U32(ARENA_MONSTATS + 0x14u) = 0u;
            U32(ARENA_MONSTATS2 + 0x10u) = 0x20776F62u; /* 'bow ' */
        } else if (c == 5) {
            uType = 1u; cls = 0u; mode = 0u; inv = 0u; /* monster mode 0 with mask bit=0 -> hth */
            U32(ARENA_MONSTATS + 0x14u) = 0u;
            U32(ARENA_MONSTATS2 + 0x10u) = 0x20776F62u;
        } else if (c == 6) {
            uType = 2u; cls = 0u; mode = 0u; inv = 0u; /* object -> hth, wcid 0 */
        } else {
            uType = 3u; cls = 0u; mode = 0u; inv = 0u; /* missile -> 0, wcid 0 */
        }
        mem_region_t regs[] = {
            {0x6FDE3368u, 0x68u}, {0x6FDED378u, 24u}, {0x6FDD9088u, 0xACu},
            {0x6FDE9E1Cu, 4u}, {0x6FDEFB94u, 8u}, {0x6FDEF020u, 0x40u},
            {ARENA_SGPT, 0xC78u}, {ARENA_CHARSTATS, 0x600u}, {ARENA_ITYPEMAT, 0x200u},
            {ARENA_ITEMSTXT, 0xB00u}, {ARENA_MONSTATS, 0x400u}, {ARENA_MONSTATS2, 0x400u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x20u}, {ARENA_CELLS0, 0x40u},
            {ARENA_ITEM0, 0x40u}, {ARENA_ITEM1, 0x40u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_ITEMDATA1, 0x80u},
            {ARENA_OUT, 0x10u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 21);
        eax = safe_stdcall6(0x6FD93860u, ARENA_UNIT0, uType, cls, mode, inv, ARENA_OUT, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",%u,%u,%u,\"0x%08X\",\"0x%08X\"",
            ARENA_UNIT0, uType, cls, mode, inv, ARENA_OUT);
        const char *note = c == 0 ? "player_unarmed_hth" : c == 1 ? "player_1hs" :
            c == 2 ? "barb_dual_1js" : c == 3 ? "sin_dual_ht2" : c == 4 ? "monster_bow" :
            c == 5 ? "monster_mode0_hth" : c == 6 ? "object_hth" : "missile_zero";
        emit_rec(fp, "0x6FD93860", "COMPOSIT_GetWeaponClassCode113c", c, note,
            args, regs, 21, asserted, eax, 0xFFFFFFFFu);
    }

    /* =========================================================================
     * #05 0x6FD81260 INVENTORY_GetItemEquipLocation113c (stdcall(pItem, pUnit), ret 8, mask 0xFF)
     * ========================================================================= */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        uint32_t itemArg = ARENA_ITEM1, unitArg = ARENA_UNIT0;
        if (c == 0) {
            itemArg = 0u; /* asserts 0x635 */
        } else if (c == 1) {
            U32(ARENA_ITEM1 + 0x00u) = 1u; /* non-item asserts 0x636 */
        } else if (c == 2) {
            U32(ARENA_ITEM1 + 0x00u) = 4u;
            U32(ARENA_ITEM1 + 0x04u) = 999u; /* invalid cls asserts 0x639 */
        } else if (c == 3) {
            U32(ARENA_UNIT0 + 0x00u) = 0u; U32(ARENA_UNIT0 + 0x04u) = 0u;
            setup_item_rec(ARENA_ITEM1, 2u, 0u, ARENA_ITEMDATA1, ARENA_INV0, 4u); /* returns 5 */
        } else {
            /* Dual-wielding barb: ARENA_ITEM0 in RARM (composit weapon), ARENA_ITEM1 offhand -> returns 6 */
            setup_player_weapon_inv(ARENA_UNIT0, 4u, 1u, ARENA_INV0, ARENA_ITEM0, ARENA_ITEM1);
            U32(ARENA_INV0 + 0x1Cu) = 1u;
            setup_item_rec(ARENA_ITEM0, 1u, 0u, ARENA_ITEMDATA0, ARENA_INV0, 4u);
            setup_item_rec(ARENA_ITEM1, 2u, 1u, ARENA_ITEMDATA1, ARENA_INV0, 5u);
        }
        mem_region_t regs[] = {
            {0x6FDD9088u, 0xACu}, {0x6FDE9E1Cu, 4u}, {0x6FDED378u, 24u}, {0x6FDEFB94u, 8u},
            {ARENA_SGPT, 0xC78u}, {ARENA_ITYPEMAT, 0x200u}, {ARENA_ITEMSTXT, 0xB00u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x20u}, {ARENA_CELLS0, 0x40u},
            {ARENA_ITEM0, 0x40u}, {ARENA_ITEM1, 0x40u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_ITEMDATA1, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 15);
        eax = safe_stdcall2(0x6FD81260u, unitArg, itemArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", unitArg, itemArg);
        const char *note = c == 0 ? "null_item_asserts_635" : c == 1 ? "non_item_asserts_636" :
            c == 2 ? "bad_txt_asserts_639" : c == 3 ? "normal_returns_comp5" : "dual_wield_offhand_6";
        emit_rec(fp, "0x6FD81260", "INVENTORY_GetItemEquipLocation113c", c, note,
            args, regs, 15, asserted, eax, 0x000000FFu);
    }

    /* =========================================================================
     * #06..#09 0x6FD70520, 0x6FD70560, 0x6FD705A0, 0x6FD705E0
     * edi=pGrid, esi=pOutX, edx=pOutY, ecx=nWidth, [esp+4]=pInventory, [esp+8]=nHeight
     * ========================================================================= */
    {
        static const uint32_t grid_vas[4] = {0x6FD70520u, 0x6FD70560u, 0x6FD705A0u, 0x6FD705E0u};
        static const char *grid_va_strs[4] = {"0x6FD70520", "0x6FD70560", "0x6FD705A0", "0x6FD705E0"};
        static const char *grid_names[4] = {
            "INVENTORY_FindGridPlacementMode0_113c",
            "INVENTORY_FindGridPlacementMode1_113c",
            "INVENTORY_FindGridPlacementMode2_113c",
            "INVENTORY_FindGridPlacementMode3_113c",
        };
        for (int g = 0; g < 4; g++) {
            for (int c = 0; c < 5; c++) {
                setup_common_tables();
                U8(ARENA_GRIDS0 + 0x08u) = 4u;
                U8(ARENA_GRIDS0 + 0x09u) = 4u;
                U32(ARENA_GRIDS0 + 0x0Cu) = ARENA_CELLS0;
                U32(ARENA_INV0 + 0x00u) = 0x01020304u;
                U32(ARENA_INV0 + 0x08u) = (c == 2) ? 0u : ARENA_UNIT0;
                U32(ARENA_UNIT0 + 0x00u) = (c == 4) ? 1u : 0u; /* PLAYER (0) vs MONSTER (1) */
                if (c == 1 || c == 2) {
                    for (uint32_t r = 0; r < 4u; r++) {
                        U32(ARENA_CELLS0 + (r * 4u + 0u) * 4u) = ARENA_ITEM0;
                    }
                } else if (c == 3) {
                    for (uint32_t k = 0; k < 16u; k++) {
                        U32(ARENA_CELLS0 + k * 4u) = ARENA_ITEM0;
                    }
                } else if (c == 4) {
                    /* Col 0 rows 0..3 open (1x4 gap); Col 1 rows 2..3 occupied -> (1,0) exact 1x2 vs (0,0) */
                    U32(ARENA_CELLS0 + (2u * 4u + 1u) * 4u) = ARENA_ITEM0;
                    U32(ARENA_CELLS0 + (3u * 4u + 1u) * 4u) = ARENA_ITEM0;
                    for (uint32_t r = 0; r < 4u; r++) {
                        U32(ARENA_CELLS0 + (r * 4u + 2u) * 4u) = ARENA_ITEM0;
                        U32(ARENA_CELLS0 + (r * 4u + 3u) * 4u) = ARENA_ITEM0;
                    }
                }
                U32(ARENA_OUT) = 0xDEADu;
                U32(ARENA_OUT2) = 0xBEEFu;
                uint32_t invArg = (c == 0) ? 0u : ARENA_INV0;
                mem_region_t regs[] = {
                    {ARENA_GRIDS0, 0x20u}, {ARENA_CELLS0, 0x50u}, {ARENA_INV0, 0x30u},
                    {ARENA_UNIT0, 0x20u}, {ARENA_OUT, 0x10u}, {ARENA_OUT2, 0x10u}
                };
                capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 6);
                eax = safe_find_grid(grid_vas[g], ARENA_GRIDS0, ARENA_OUT, ARENA_OUT2, 1u, invArg, 2u, &asserted);
                snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",\"0x%08X\",1,\"0x%08X\",2",
                    ARENA_GRIDS0, ARENA_OUT, ARENA_OUT2, invArg);
                const char *note = c == 0 ? "null_inv_zero" : c == 1 ? "player_best_fit" :
                    c == 2 ? "non_player_first_fit" : c == 3 ? "full_grid_zero" : "monster_owner_first_fit";
                emit_rec(fp, grid_va_strs[g], grid_names[g], c, note,
                    args, regs, 6, asserted, eax, 0xFFFFFFFFu);
            }
        }
    }

    /* =========================================================================
     * #10 0x6FD71710 INVENTORY_EmptyInventory113c (stdcall ret 4)
     * ========================================================================= */
    for (int c = 0; c < 3; c++) {
        setup_common_tables();
        U32(ARENA_INV0 + 0x00u) = (c == 1) ? 0x99999999u : 0x01020304u;
        U32(ARENA_INV0 + 0x0Cu) = ARENA_ITEM0;
        U32(ARENA_INV0 + 0x10u) = ARENA_ITEM1;
        U32(ARENA_INV0 + 0x1Cu) = 1u;
        U32(ARENA_INV0 + 0x20u) = ARENA_ITEM0;
        U32(ARENA_INV0 + 0x28u) = 2u;
        setup_item_rec(ARENA_ITEM0, 1u, 0u, ARENA_ITEMDATA0, ARENA_INV0, 0u);
        setup_item_rec(ARENA_ITEM1, 2u, 1u, ARENA_ITEMDATA1, ARENA_INV0, 0u);
        U32(ARENA_ITEMDATA0 + 0x5Cu + 0x08u) = ARENA_ITEM1; /* pNextItem */
        U32(ARENA_ITEMDATA1 + 0x5Cu + 0x04u) = ARENA_ITEM0; /* pPrevItem */
        uint32_t invArg = (c == 0) ? 0u : ARENA_INV0;
        mem_region_t regs[] = {
            {ARENA_INV0, 0x40u}, {ARENA_ITEM0, 0x40u}, {ARENA_ITEM1, 0x40u},
            {ARENA_ITEMDATA0, 0x80u}, {ARENA_ITEMDATA1, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 5);
        eax = safe_stdcall1(0x6FD71710u, invArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", invArg);
        emit_rec(fp, "0x6FD71710", "INVENTORY_EmptyInventory113c", c,
            c == 0 ? "null_inv_zero" : c == 1 ? "bad_sig_zero" : "empties_all_items",
            args, regs, 5, asserted, eax, 0xFFFFFFFFu);
    }

    /* =========================================================================
     * #11 0x6FD71790 INVENTORY_SetCursorItem113c (stdcall ret 8, void)
     * ========================================================================= */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        U32(ARENA_INV0 + 0x00u) = (c == 0) ? 0u : 0x01020304u;
        setup_item_rec(ARENA_ITEM0, 1u, 0u, ARENA_ITEMDATA0, (c == 2) ? ARENA_INV0 : 0u, 0u);
        if (c == 2) U32(ARENA_INV0 + 0x20u) = ARENA_ITEM0;
        if (c == 3) {
            U32(ARENA_INV0 + 0x20u) = ARENA_ITEM0;
            U32(ARENA_ITEM0 + 0x00u) = 1u; /* non-item in cursor slot -> itemExtraOrZero returns 0 */
        }
        uint32_t itemArg = (c == 2 || c == 3) ? 0u : ARENA_ITEM0;
        mem_region_t regs[] = {
            {ARENA_INV0, 0x40u}, {ARENA_ITEM0, 0x40u}, {ARENA_ITEMDATA0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
        safe_stdcall2(0x6FD71790u, ARENA_INV0, itemArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_INV0, itemArg);
        emit_rec(fp, "0x6FD71790", "INVENTORY_SetCursorItem113c", c,
            c == 0 ? "bad_sig_noop" : c == 1 ? "sets_cursor_item" : c == 2 ? "clears_cursor_item" : "clear_nonitem_noop",
            args, regs, 3, asserted, 0u, 0u);
    }

    /* =========================================================================
     * #12 0x6FD71B00 INVENTORY_RemoveItemFromInventory113c (stdcall ret 8)
     * ========================================================================= */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        U32(ARENA_INV0 + 0x00u) = 0x01020304u;
        U32(ARENA_INV0 + 0x0Cu) = ARENA_ITEM0;
        U32(ARENA_INV0 + 0x10u) = ARENA_ITEM0;
        U32(ARENA_INV0 + 0x28u) = 1u;
        setup_item_rec(ARENA_ITEM0, 1u, 0u, ARENA_ITEMDATA0, (c == 1) ? ARENA_INV1 : ARENA_INV0, 0u);
        if (c == 4) U32(ARENA_ITEM0 + 0x00u) = 1u; /* non-item returns 0 */
        uint32_t invArg = (c == 0) ? 0u : ARENA_INV0;
        uint32_t itemArg = (c == 3) ? 0u : ARENA_ITEM0;
        mem_region_t regs[] = {
            {ARENA_INV0, 0x40u}, {ARENA_ITEM0, 0x40u}, {ARENA_ITEMDATA0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
        eax = safe_stdcall2(0x6FD71B00u, invArg, itemArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", invArg, itemArg);
        emit_rec(fp, "0x6FD71B00", "INVENTORY_RemoveItemFromInventory113c", c,
            c == 0 ? "null_inv_zero" : c == 1 ? "unowned_zero" : c == 2 ? "removes_owned_item" :
            c == 3 ? "null_item_zero" : "non_item_zero",
            args, regs, 3, asserted, eax, 0xFFFFFFFFu);
    }

    /* =========================================================================
     * #13 0x6FD975E0 ITEMS_AddOrSetStatOnStatList113c
     * eax=bApply, [esp+4..0x20]=(pItem, pUnit, bSetStat, wStatId, nLayer, nValue, nStateId, fStatListFlags)
     * ========================================================================= */
    for (int c = 0; c < 8; c++) {
        setup_common_tables();
        U32(ARENA_ITEM0 + 0x00u) = 4u;
        U32(ARENA_ITEM0 + 0x0Cu) = 77u;
        U32(ARENA_ITEM0 + 0x5Cu) = ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10u) = (c == 7) ? 0u : 0x80000000u; /* extended unless c==7 */
        U32(ARENA_STATLIST0 + 0x24u) = ARENA_STATS0;
        U16(ARENA_STATLIST0 + 0x28u) = 1u;
        U16(ARENA_STATLIST0 + 0x2Au) = 8u;
        U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
        U32(ARENA_STATLIST1 + 0x10u) = (c == 7) ? 0u : 0x40u;
        U32(ARENA_STATLIST1 + 0x24u) = ARENA_STATS1;
        U16(ARENA_STATLIST1 + 0x28u) = (c == 6) ? 2u : 1u;
        U16(ARENA_STATLIST1 + 0x2Au) = 8u;
        U32(ARENA_STATLIST1 + 0x34u) = ARENA_STATLIST0;
        U32(ARENA_STATS0 + 0x00u) = 0x00070000u; S32(ARENA_STATS0 + 0x04u) = 0x100;
        U32(ARENA_STATS1 + 0x00u) = 0x00070000u; S32(ARENA_STATS1 + 0x04u) = 0x200;
        if (c == 6) {
            U32(ARENA_STATS1 + 0x08u) = 0x01460000u; S32(ARENA_STATS1 + 0x0Cu) = 5;
        }

        uint32_t bApply = (c == 0) ? 0u : 1u;
        uint32_t bSetStat = (c == 4 || c == 6 || c == 7) ? 1u : 0u;
        uint32_t wStatId = (c == 2) ? 999u : (c >= 4) ? 0x3Au : 7u;
        uint32_t nValue = (c == 1) ? 0u : 15u;
        uint32_t fFlags = (c == 7) ? 0u : 0x40u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC78u},
            {ARENA_ISC, 0x1000u}, {ARENA_ISC + 0x3Au * 0x144u, 0x144u},
            {ARENA_ISC + 0x146u * 0x144u, 0x144u},
            {ARENA_ITEM0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u},
            {ARENA_STATS0, 0x80u}, {ARENA_STATS1, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 11);
        eax = safe_eax_stack8(0x6FD975E0u, bApply, ARENA_ITEM0, 0u, bSetStat, wStatId, 0u, nValue, 0u, fFlags, &asserted);
        snprintf(args, sizeof(args), "%u,\"0x%08X\",0,%u,%u,0,%u,0,%u", bApply, ARENA_ITEM0, bSetStat, wStatId, nValue, fFlags);
        const char *note = c == 0 ? "bApply_zero" : c == 1 ? "nValue_zero" : c == 2 ? "bad_stat_zero" :
            c == 3 ? "add_stat7_shifted" : c == 4 ? "set_stat3a_sets_146" :
            c == 5 ? "add_stat3a_adds_146" : c == 6 ? "set_stat3a_preserves_existing_146" : "set_stat3a_flags0_nomodbit";
        emit_rec(fp, "0x6FD975E0", "ITEMS_AddOrSetStatOnStatList113c", c, note,
            args, regs, 11, asserted, eax, 0xFFFFFFFFu);
    }

    /* =========================================================================
     * #14 0x6FD97EF0 ITEMS_ApplySkillBonusStat113c
     * eax=bRoll, ecx=pUnit, edi=nStatId, [esp+4..0x18]=(bForceRoll, pItem, nValue, bNegateCur, nStateId, fStatListFlags)
     * ========================================================================= */
    for (int c = 0; c < 8; c++) {
        setup_common_tables();
        U32(ARENA_ITEM0 + 0x00u) = 4u;
        U32(ARENA_ITEM0 + 0x04u) = 0u;
        U32(ARENA_ITEM0 + 0x0Cu) = 77u;
        U32(ARENA_UNIT0 + 0x00u) = 1u; /* non-item unit for c==5/c==6 */
        U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
        if (c != 4) {
            U32(ARENA_ITEM0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST1 + 0x10u) = 0x40u;
            U32(ARENA_STATLIST1 + 0x24u) = ARENA_STATS1;
            U16(ARENA_STATLIST1 + 0x28u) = 1u;
            U16(ARENA_STATLIST1 + 0x2Au) = 8u;
            U32(ARENA_STATLIST1 + 0x34u) = ARENA_STATLIST0;
            U32(ARENA_STATS1 + 0x00u) = 0x00070000u; S32(ARENA_STATS1 + 0x04u) = 0x500;
        } else {
            U32(ARENA_ITEM0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
        }
        uint32_t bRoll = (c == 3 || c == 6) ? 1u : 0u;
        uint32_t bForceRoll = (c == 3) ? 1u : 0u;
        uint32_t unitArg = (c == 5 || c == 6) ? ARENA_UNIT0 : ARENA_ITEM0;
        uint32_t statId = (c == 7) ? 0xD9u : 7u;
        uint32_t nVal = (c == 0) ? 0u : 12u;
        uint32_t bNeg = (c == 2) ? 1u : 0u;
        uint32_t nState = (c == 4) ? 5u : 0u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u}, {0x6FDEFF6Cu, 4u}, {ARENA_OUT2, 0x10u},
            {ARENA_SGPT, 0xC78u}, {ARENA_ITEMSTXT, 0x300u}, {ARENA_ISC, 0x1000u}, {ARENA_ISC + 0xD9u * 0x144u, 0x144u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_ITEM0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}, {ARENA_STATS1, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 14);
        eax = safe_eax_ecx_edi_stack6(0x6FD97EF0u, bRoll, unitArg, statId,
            bForceRoll, ARENA_ITEM0, nVal, bNeg, nState, 0x40u, &asserted);
        snprintf(args, sizeof(args), "%u,\"0x%08X\",%u,%u,\"0x%08X\",%u,%u,%u,64",
            bRoll, unitArg, statId, bForceRoll, ARENA_ITEM0, nVal, bNeg, nState);
        const char *note = c == 0 ? "val_zero_returns_0" : c == 1 ? "adds_shifted_stat7" :
            c == 2 ? "negates_existing_stat7" : c == 3 ? "bRoll_resets_and_adds" :
            c == 4 ? "creates_state5_sublist" : c == 5 ? "noroll_nonitem_unit_ok" :
            c == 6 ? "bRoll_nonitem_asserts_61c" : "stat_d9_shifted_by_8";
        emit_rec(fp, "0x6FD97EF0", "ITEMS_ApplySkillBonusStat113c", c, note,
            args, regs, 14, asserted, eax, 0xFFFFFFFFu);
    }

    /* =========================================================================
     * #15 0x6FD97FA0 ITEMS_ApplyElemMasteryOrPierceStat113c
     * eax=bIsMinToMax, ecx=pPropEntry, edx=pUnit, edi=nStatId,
     * [esp+4..0x14]=(bForceRoll, pItem, bNegateCur, nStateId, fStatListFlags)
     * ========================================================================= */
    for (int c = 0; c < 7; c++) {
        setup_common_tables();
        U32(ARENA_ITEM0 + 0x00u) = 4u;
        U32(ARENA_ITEM0 + 0x04u) = 0u;
        U32(ARENA_ITEM0 + 0x0Cu) = 77u;
        U32(ARENA_ITEM0 + 0x20u) = 0x12345678u; /* loSeed */
        U32(ARENA_ITEM0 + 0x24u) = 0x9ABCDEF0u; /* hiSeed */
        U32(ARENA_UNIT0 + 0x00u) = 1u; /* non-item unit for c==5 */
        S32(ARENA_PROPENTRY + 0x08u) = (c == 3 || c == 5) ? 0 : 10;
        S32(ARENA_PROPENTRY + 0x0Cu) = (c == 3 || c == 5) ? 0 : 10;
        if (c != 4) {
            U32(ARENA_ITEM0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST1 + 0x10u) = 0x40u;
            U32(ARENA_STATLIST1 + 0x24u) = ARENA_STATS1;
            U16(ARENA_STATLIST1 + 0x28u) = 1u;
            U16(ARENA_STATLIST1 + 0x2Au) = 8u;
            U32(ARENA_STATLIST1 + 0x34u) = ARENA_STATLIST0;
            U32(ARENA_STATS1 + 0x00u) = 0x00070000u; S32(ARENA_STATS1 + 0x04u) = 0x500;
        } else {
            U32(ARENA_ITEM0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
        }
        uint32_t bMinToMax = (c == 0) ? 1u : 0u;
        uint32_t unitArg = (c == 5) ? ARENA_UNIT0 : ARENA_ITEM0;
        uint32_t statId = (c == 2) ? 0x3Au : (c == 6) ? 0xD9u : 7u;
        uint32_t bNeg = (c == 1) ? 1u : 0u;
        uint32_t nState = (c == 4) ? 5u : 0u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u}, {0x6FDEFF6Cu, 4u}, {ARENA_OUT2, 0x10u},
            {ARENA_SGPT, 0xC78u}, {ARENA_ITEMSTXT, 0x300u}, {ARENA_ISC, 0x1000u},
            {ARENA_ISC + 0x3Au * 0x144u, 0x144u}, {ARENA_ISC + 0xD9u * 0x144u, 0x144u}, {ARENA_ISC + 0x146u * 0x144u, 0x144u},
            {ARENA_PROPENTRY, 0x20u}, {ARENA_UNIT0, 0xD0u}, {ARENA_ITEM0, 0x80u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}, {ARENA_STATS1, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 17);
        eax = safe_eax_ecx_edx_edi_stack5(0x6FD97FA0u, bMinToMax, ARENA_PROPENTRY, unitArg, statId,
            0u, ARENA_ITEM0, bNeg, nState, 0x40u, &asserted);
        snprintf(args, sizeof(args), "%u,\"0x%08X\",\"0x%08X\",%u,0,\"0x%08X\",%u,%u,64",
            bMinToMax, ARENA_PROPENTRY, unitArg, statId, ARENA_ITEM0, bNeg, nState);
        const char *note = c == 0 ? "bMinToMax_1_adds_stat7" : c == 1 ? "bNegateCur_negates_stat7" :
            c == 2 ? "stat3a_also_adds_146" : c == 3 ? "rolled_zero_returns_0" :
            c == 4 ? "creates_state5_sublist" : c == 5 ? "bMin0_bForce0_nonitem_zero" : "stat_d9_shifted_by_8";
        emit_rec(fp, "0x6FD97FA0", "ITEMS_ApplyElemMasteryOrPierceStat113c", c, note,
            args, regs, 17, asserted, eax, 0xFFFFFFFFu);
    }
}

static void setup_unit_seq_env(uint32_t unit, uint32_t uType, uint32_t cls, uint32_t mode,
                               uint32_t seqMode, uint32_t skillId, uint32_t seqId, uint32_t inv) {
    U32(unit + 0x00u) = uType;
    U32(unit + 0x04u) = cls;
    U32(unit + 0x10u) = mode;
    U32(unit + 0x40u) = seqMode;
    U32(unit + 0x60u) = inv;
    U32(unit + 0xA8u) = ARENA_SKILLLIST0;
    U32(ARENA_SKILLLIST0 + 0x10u) = ARENA_SKILL0;
    U32(ARENA_SKILL0 + 0x00u) = ARENA_SKILLSTXT;
    U16(ARENA_SKILLSTXT + 0x00u) = (uint16_t)skillId;
    U8(ARENA_SKILLSTXT + 0x13u) = (uint8_t)seqId;
    if (uType == 1u) {
        U16(ARENA_MONSTATS + cls * 0x1A8u + 0x170u) = (uint16_t)skillId;
        U16(ARENA_MONSTATS + cls * 0x1A8u + 0x188u) = (uint16_t)seqId;
        U32(ARENA_MONSEQTABLE + seqId * 12u + 0x00u) = ARENA_SEQREC0;
        U32(ARENA_MONSEQTABLE + seqId * 12u + 0x04u) = 8u;
        U32(ARENA_MONSEQTABLE + seqId * 12u + 0x08u) = 99u;
    }
    /* Populate ARENA_SEQREC0 with 8 x 6-byte D2AnimSeqTxt records; frame 2 has nEvent = 7 */
    U8(ARENA_SEQREC0 + 2u * 6u + 0x05u) = 7u;
}

static void emit_i11a_2(FILE *fp) {
    char args[512];
    int asserted = 0;
    uint32_t eax = 0;

    /* =========================================================================
     * #16 0x6FD7E790 ANIMSEQ_GetPlayerSeqWeaponClassIdx113c (esi=pUnit, plain ret)
     * ========================================================================= */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        uint32_t orig_wcode = U32(0x6FDE3368u + 12u * 8u + 0u);
        uint32_t orig_wcid  = U32(0x6FDE3368u + 12u * 8u + 4u);
        if (c == 0) {
            setup_player_weapon_inv(ARENA_UNIT0, 0u, 1u, ARENA_INV0, 0u, 0u); /* hth -> 0 */
        } else if (c == 1 || c == 3) {
            setup_player_weapon_inv(ARENA_UNIT0, 0u, 1u, ARENA_INV0, ARENA_ITEM0, 0u);
            setup_item_rec(ARENA_ITEM0, 1u, 0u, ARENA_ITEMDATA0, ARENA_INV0, 4u); /* 1hs -> wcid 2 -> idx 3 */
            if (c == 3) U32(ARENA_UNIT0 + 0xC8u) = 8u; /* transform bit set, nTransformStates=0 */
        } else if (c == 2) {
            setup_player_weapon_inv(ARENA_UNIT0, 0u, 1u, ARENA_INV0, ARENA_ITEM0, 0u);
            setup_item_rec(ARENA_ITEM0, 1u, 2u, ARENA_ITEMDATA0, ARENA_INV0, 4u); /* bow -> wcid 1 -> idx 5 */
        } else {
            U32(0x6FDE3368u + 12u * 8u + 0u) = 0x206F6F66u; /* 'foo ' -> wcid 14 (not in 0..13) */
            U32(0x6FDE3368u + 12u * 8u + 4u) = 14u;
            U32(ARENA_UNIT0 + 0x00u) = 1u; /* monster unknown wclass -> -1 */
            U32(ARENA_UNIT0 + 0x04u) = 0u;
            U32(ARENA_UNIT0 + 0x10u) = 1u;
            U32(ARENA_MONSTATS + 0x14u) = 0u;
            U32(ARENA_MONSTATS2 + 0x10u) = 0x206F6F66u; /* 'foo ' */
        }
        mem_region_t regs[] = {
            {0x6FDE3368u, 0x68u}, {0x6FDED378u, 24u}, {0x6FDECFA0u, 0x70u}, {0x6FDD9088u, 0xACu},
            {0x6FDE9E1Cu, 4u}, {0x6FDEFB94u, 8u}, {0x6FDEF020u, 0x48u},
            {ARENA_SGPT, 0xC78u}, {ARENA_CHARSTATS, 0x600u}, {ARENA_ITYPEMAT, 0x200u}, {ARENA_ITEMSTXT, 0xB00u},
            {ARENA_MONSTATS, 0x200u}, {ARENA_MONSTATS2, 0x200u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x20u}, {ARENA_CELLS0, 0x40u},
            {ARENA_ITEM0, 0x40u}, {ARENA_ITEMDATA0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 19);
        eax = safe_esi0(0x6FD7E790u, ARENA_UNIT0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
        emit_rec(fp, "0x6FD7E790", "ANIMSEQ_GetPlayerSeqWeaponClassIdx113c", c,
            c == 0 ? "hth_idx_0" : c == 1 ? "1hs_idx_3" : c == 2 ? "bow_idx_5" :
            c == 3 ? "c8_bit3_1hs_idx_3" : "unknown_wcid_neg1",
            args, regs, 19, asserted, eax, 0xFFFFFFFFu);
        U32(0x6FDE3368u + 12u * 8u + 0u) = orig_wcode;
        U32(0x6FDE3368u + 12u * 8u + 4u) = orig_wcid;
    }

    /* =========================================================================
     * #17 0x6FD941E0 COMPOSIT_GetUnitWeaponClassCode113c (stdcall ret 0x14)
     * ========================================================================= */
    for (int c = 0; c < 3; c++) {
        setup_common_tables();
        U32(ARENA_OUT) = 0xDEADBEEFu;
        setup_player_weapon_inv(ARENA_UNIT0, 0u, 1u, ARENA_INV0, ARENA_ITEM0, 0u);
        setup_item_rec(ARENA_ITEM0, 1u, 0u, ARENA_ITEMDATA0, ARENA_INV0, 4u);
        if (c == 2) {
            U32(ARENA_UNIT0 + 0x30u) = ARENA_SEQREC0; /* active seq -> uses +0x40 = 1 */
            U32(ARENA_UNIT0 + 0x10u) = 0u;
            U32(ARENA_UNIT0 + 0x40u) = 1u;
        }
        uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
        uint32_t modeArg = (c == 1) ? 1u : 0xFFFFFFFFu;
        mem_region_t regs[] = {
            {0x6FDE3368u, 0x68u}, {0x6FDED378u, 24u}, {0x6FDE9E1Cu, 4u}, {0x6FDEFB94u, 8u}, {0x6FDEF020u, 0x40u},
            {ARENA_SGPT, 0xC78u}, {ARENA_CHARSTATS, 0x600u}, {ARENA_ITYPEMAT, 0x200u}, {ARENA_ITEMSTXT, 0xB00u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x20u}, {ARENA_CELLS0, 0x40u},
            {ARENA_ITEM0, 0x40u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_OUT, 0x10u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 16);
        eax = safe_stdcall5(0x6FD941E0u, uArg, ARENA_INV0, ARENA_OUT, modeArg, 0u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",\"0x%08X\",%d,0",
            uArg, ARENA_INV0, ARENA_OUT, (int32_t)modeArg);
        emit_rec(fp, "0x6FD941E0", "COMPOSIT_GetUnitWeaponClassCode113c", c,
            c == 0 ? "null_unit_hth" : c == 1 ? "explicit_mode_1hs" : "neg1_uses_seqmode_1hs",
            args, regs, 16, asserted, eax, 0xFFFFFFFFu);
    }

    /* =========================================================================
     * #18 0x6FD94350 COMPOSIT_IsUnitUsingBowOrCrossbow113c (stdcall ret 4)
     * ========================================================================= */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        if (c == 0) {
            setup_player_weapon_inv(ARENA_UNIT0, 0u, 1u, ARENA_INV0, 0u, 0u);
        } else if (c == 1) {
            setup_player_weapon_inv(ARENA_UNIT0, 0u, 1u, ARENA_INV0, ARENA_ITEM0, 0u);
            setup_item_rec(ARENA_ITEM0, 1u, 2u, ARENA_ITEMDATA0, ARENA_INV0, 4u); /* bow -> 1 */
        } else if (c == 2) {
            U32(ARENA_UNIT0 + 0x00u) = 1u; /* monster */
            U32(ARENA_UNIT0 + 0x04u) = 0u;
            U32(ARENA_UNIT0 + 0x10u) = 1u;
            U32(ARENA_MONSTATS + 0x14u) = 0u;
            U32(ARENA_MONSTATS2 + 0x10u) = 0x20776278u; /* 'xbw ' -> 7 */
        } else if (c == 3) {
            /* Monster transformed into player class 0 with bow via c8 bit 3 */
            setup_player_weapon_inv(ARENA_UNIT0, 0u, 1u, ARENA_INV0, ARENA_ITEM0, 0u);
            setup_item_rec(ARENA_ITEM0, 1u, 2u, ARENA_ITEMDATA0, ARENA_INV0, 4u);
            U32(ARENA_UNIT0 + 0x00u) = 1u;
            U32(ARENA_UNIT0 + 0xC8u) = 8u;
            U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST0 + 0x58u) = ARENA_STATEFLAGS0;
            U32(ARENA_STATEFLAGS0 + 0x00u) = 2u;
            U16(ARENA_SGPT + 0x180u) = 1u;
            U16(ARENA_XFORMSTATES + 0x00u) = 1u;
            U8(ARENA_STATESTXT + 0x3Cu + 0x2Du) = 2u;
            U16(ARENA_STATESTXT + 0x3Cu + 0x2Eu) = 0u;
            U32(ARENA_MONSTATS + 0x14u) = 0u;
            U32(ARENA_MONSTATS2 + 0x10u) = 0x20687468u; /* untransformed = hth -> 0 */
        } else {
            /* Player with active seq: +0x40=1 (bow), +0x44=0 (hth) */
            setup_player_weapon_inv(ARENA_UNIT0, 0u, 0u, ARENA_INV0, ARENA_ITEM0, 0u);
            setup_item_rec(ARENA_ITEM0, 1u, 2u, ARENA_ITEMDATA0, ARENA_INV0, 4u);
            U32(ARENA_UNIT0 + 0x30u) = ARENA_SEQREC0;
            U32(ARENA_UNIT0 + 0x40u) = 1u;
            U32(ARENA_UNIT0 + 0x44u) = 0u;
        }
        mem_region_t regs[] = {
            {0x6FDE30D4u, 0x40u}, {0x6FDE3368u, 0x68u}, {0x6FDED378u, 24u}, {0x6FDD9088u, 0xACu},
            {0x6FDE9E1Cu, 4u}, {0x6FDEFB94u, 8u}, {0x6FDEF020u, 0x40u},
            {ARENA_SGPT, 0xC78u}, {ARENA_CHARSTATS, 0x600u}, {ARENA_ITYPEMAT, 0x200u}, {ARENA_ITEMSTXT, 0xB00u},
            {ARENA_MONSTATS, 0x200u}, {ARENA_MONSTATS2, 0x200u},
            {ARENA_XFORMSTATES, 0x20u}, {ARENA_STATESTXT, 0x100u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATEFLAGS0, 0x20u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x20u}, {ARENA_CELLS0, 0x40u},
            {ARENA_ITEM0, 0x40u}, {ARENA_ITEMDATA0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 23);
        eax = safe_stdcall1(0x6FD94350u, ARENA_UNIT0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
        emit_rec(fp, "0x6FD94350", "COMPOSIT_IsUnitUsingBowOrCrossbow113c", c,
            c == 0 ? "hth_false" : c == 1 ? "player_bow_true" : c == 2 ? "monster_xbw_true" :
            c == 3 ? "c8_xform_bow_true" : "seqmode40_bow_true",
            args, regs, 23, asserted, eax, 0xFFFFFFFFu);
    }

    /* =========================================================================
     * #19..#22 0x6FD7E840, 0x6FD7E900, 0x6FD7E920, 0x6FD7E940
     * ========================================================================= */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        if (c == 2) {
            setup_player_weapon_inv(ARENA_UNIT0, 0u, 1u, ARENA_INV0, 0u, 0u);
            setup_unit_seq_env(ARENA_UNIT0, 0u, 0u, 1u, 0u, 5u, 1u, ARENA_INV0);
        } else if (c == 3) {
            setup_unit_seq_env(ARENA_UNIT0, 1u, 0u, 1u, 0u, 10u, 2u, 0u);
        } else if (c == 4) {
            setup_player_weapon_inv(ARENA_UNIT0, 0u, 1u, ARENA_INV0, ARENA_ITEM0, 0u);
            setup_item_rec(ARENA_ITEM0, 1u, 0u, ARENA_ITEMDATA0, ARENA_INV0, 4u); /* 1hs -> idx 3 */
            setup_unit_seq_env(ARENA_UNIT0, 0u, 0u, 1u, 0u, 5u, 0u, ARENA_INV0); /* seqId = 0 -> 0 */
        }
        uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
        mem_region_t regs[] = {
            {0x6FDE3368u, 0x68u}, {0x6FDED378u, 24u}, {0x6FDD9088u, 0xACu}, {0x6FDECF40u, 0x60u}, {0x6FDECFA0u, 0x70u},
            {0x6FDEB3F8u, 0xA8u}, {0x6FDE9E1Cu, 4u}, {0x6FDEFB94u, 8u}, {0x6FDEF020u, 0x40u}, {0x6FDF0A5Cu, 8u},
            {ARENA_SGPT, 0xC78u}, {ARENA_CHARSTATS, 0x600u}, {ARENA_ITYPEMAT, 0x200u}, {ARENA_ITEMSTXT, 0xB00u},
            {ARENA_MONSTATS, 0x200u}, {ARENA_MONSEQTABLE, 0x80u}, {ARENA_SKILLLIST0, 0x20u}, {ARENA_SKILL0, 0x20u},
            {ARENA_SKILLSTXT, 0x40u}, {ARENA_UNIT0, 0xD0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x20u},
            {ARENA_CELLS0, 0x40u}, {ARENA_ITEM0, 0x40u}, {ARENA_ITEMDATA0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 25);
        eax = safe_eax0(0x6FD7E840u, uArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", uArg);
        emit_rec(fp, "0x6FD7E840", "ANIMSEQ_GetUnitSeqLookupEntry113c", c,
            c == 0 ? "null_asserts_65c" : c == 1 ? "no_skills_zero" :
            c == 2 ? "player_seq1" : c == 3 ? "monster_seq2" : "seq0_returns_zero",
            args, regs, 25, asserted, eax, 0xFFFFFFFFu);
    }
    {
        static const uint32_t seq_vas[3] = {0x6FD7E900u, 0x6FD7E920u, 0x6FD7E940u};
        static const char *seq_va_strs[3] = {"0x6FD7E900", "0x6FD7E920", "0x6FD7E940"};
        static const char *seq_names[3] = {
            "ANIMSEQ_GetUnitSeqFrameDataField8_113c",
            "ANIMSEQ_GetUnitSeqFrameCountFp8_113c",
            "ANIMSEQ_GetUnitSeqRecordPtr113c",
        };
        for (int s = 0; s < 3; s++) {
            for (int c = 0; c < 3; c++) {
                setup_common_tables();
                if (c == 1) {
                    setup_player_weapon_inv(ARENA_UNIT0, 0u, 1u, ARENA_INV0, 0u, 0u);
                    setup_unit_seq_env(ARENA_UNIT0, 0u, 0u, 1u, 0u, 5u, 1u, ARENA_INV0);
                } else if (c == 2) {
                    setup_unit_seq_env(ARENA_UNIT0, 1u, 0u, 1u, 0u, 10u, 2u, 0u);
                }
                mem_region_t regs[] = {
                    {0x6FDE3368u, 0x68u}, {0x6FDED378u, 24u}, {0x6FDECF40u, 0x60u}, {0x6FDECFA0u, 0x70u},
                    {0x6FDEB3F8u, 0xA8u}, {0x6FDE9E1Cu, 4u}, {0x6FDF0A5Cu, 8u},
                    {ARENA_SGPT, 0xC78u}, {ARENA_CHARSTATS, 0x600u}, {ARENA_MONSTATS, 0x200u},
                    {ARENA_MONSEQTABLE, 0x80u}, {ARENA_SKILLLIST0, 0x20u}, {ARENA_SKILL0, 0x20u}, {ARENA_SKILLSTXT, 0x40u},
                    {ARENA_UNIT0, 0xD0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x20u}, {ARENA_CELLS0, 0x40u}
                };
                capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 18);
                eax = safe_stdcall1(seq_vas[s], ARENA_UNIT0, &asserted);
                snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
                emit_rec(fp, seq_va_strs[s], seq_names[s], c,
                    c == 0 ? "no_skills_zero" : c == 1 ? "player_seq1" : "monster_seq2",
                    args, regs, 18, asserted, eax, 0xFFFFFFFFu);
            }
        }
    }

    /* =========================================================================
     * #23 0x6FDCFBD0 UNITS_GetApproximateDistance113c (stdcall ret 8)
     * ========================================================================= */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        U32(ARENA_MONSTATS + 0x14u) = 0u;
        U8(ARENA_MONSTATS2 + 0x08u) = 2u;
        U32(ARENA_UNIT0 + 0x00u) = (c == 3) ? 5u : 0u;
        U32(ARENA_UNIT0 + 0x04u) = 0u;
        U32(ARENA_UNIT0 + 0x2Cu) = ARENA_PATH0;
        if (c == 3) {
            U32(ARENA_PATH0 + 0x0Cu) = 10u; U32(ARENA_PATH0 + 0x10u) = 20u;
        } else {
            U16(ARENA_PATH0 + 0x02u) = 10u; U16(ARENA_PATH0 + 0x06u) = 20u;
        }
        U32(ARENA_UNIT1 + 0x00u) = (c == 1) ? 2u : 1u;
        U32(ARENA_UNIT1 + 0x04u) = 0u; U32(ARENA_UNIT1 + 0x2Cu) = ARENA_PATH1;
        if (c == 1) {
            U32(ARENA_UNIT1 + 0x14u) = ARENA_ITEMDATA1;
            U32(ARENA_ITEMDATA1 + 0x00u) = ARENA_MONSTATS2;
            U32(ARENA_MONSTATS2 + 0xD0u) = 1u;
            U32(ARENA_PATH1 + 0x0Cu) = 20u; U32(ARENA_PATH1 + 0x10u) = 32u;
        } else {
            U16(ARENA_PATH1 + 0x02u) = (c == 2) ? 10u : 16u;
            U16(ARENA_PATH1 + 0x06u) = (c == 2) ? 20u : 28u;
        }
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {ARENA_SGPT, 0xC78u}, {ARENA_MONSTATS, 0x200u}, {ARENA_MONSTATS2, 0x200u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_UNIT1, 0xD0u}, {ARENA_ITEMDATA1, 0x20u}, {ARENA_PATH0, 0x40u}, {ARENA_PATH1, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
        eax = safe_stdcall2(0x6FDCFBD0u, ARENA_UNIT0, ARENA_UNIT1, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_UNIT0, ARENA_UNIT1);
        emit_rec(fp, "0x6FDCFBD0", "UNITS_GetApproximateDistance113c", c,
            c == 0 ? "dyn_player_monster" : c == 1 ? "static_obj" : c == 2 ? "overlapping_zero" : "tile_type5_dist",
            args, regs, 9, asserted, eax, 0xFFFFFFFFu);
    }

    /* =========================================================================
     * #24 0x6FD82820 UNITS_InitSkillAnimSequence113c (stdcall ret 4, void)
     * ========================================================================= */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        if (c == 1) {
            U32(ARENA_UNIT0 + 0x30u) = 0xDEADBEEFu;
        } else if (c == 2) {
            setup_player_weapon_inv(ARENA_UNIT0, 0u, 1u, ARENA_INV0, 0u, 0u);
            setup_unit_seq_env(ARENA_UNIT0, 0u, 0u, 1u, 0u, 5u, 1u, ARENA_INV0);
        } else if (c == 3) {
            setup_unit_seq_env(ARENA_UNIT0, 1u, 0u, 1u, 0u, 10u, 2u, 0u);
            U8(ARENA_SEQREC0 + 0x05u) = 99u; /* frame 0 event so dwPrevFrameFp8==0 sets 0x4E=99 */
        }
        uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
        mem_region_t regs[] = {
            {0x6FDE3368u, 0x68u}, {0x6FDED378u, 24u}, {0x6FDECF40u, 0x60u}, {0x6FDECFA0u, 0x70u},
            {0x6FDEB3F8u, 0xA8u}, {0x6FDEB260u, 0x60u}, {0x6FDE9E1Cu, 4u}, {0x6FDF0A5Cu, 8u},
            {ARENA_SGPT, 0xC78u}, {ARENA_CHARSTATS, 0x600u}, {ARENA_MONSTATS, 0x200u},
            {ARENA_MONSEQTABLE, 0x80u}, {ARENA_SEQREC0, 0x60u}, {ARENA_SKILLLIST0, 0x20u}, {ARENA_SKILL0, 0x20u}, {ARENA_SKILLSTXT, 0x40u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x20u}, {ARENA_CELLS0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 20);
        safe_stdcall1(0x6FD82820u, uArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", uArg);
        emit_rec(fp, "0x6FD82820", "UNITS_InitSkillAnimSequence113c", c,
            c == 0 ? "null_noop" : c == 1 ? "no_seq_clears_30" : c == 2 ? "initializes_seq_fields" : "monster_seq_frame0_event99",
            args, regs, 20, asserted, 0u, 0u);
    }

    /* =========================================================================
     * #25 0x6FD82770 UNITS_GetAnimOrSeqEventAtFrame113c (stdcall ret 8)
     * ========================================================================= */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x50u) = ARENA_ANIMDATA0;
        U8(ARENA_ANIMDATA0 + 0x10u + 5u) = 0x2Au;
        if (c == 2 || c == 4) {
            setup_unit_seq_env(ARENA_UNIT0, 1u, 0u, 0x0Eu, 0u, 10u, 2u, 0u);
            U8(ARENA_SEQREC0 + 0x05u) = 55u;
        } else if (c == 5) {
            U32(ARENA_UNIT0 + 0x00u) = 1u;
            U32(ARENA_UNIT0 + 0x10u) = 0x0Eu; /* seq mode with no pSkills -> pSeqRec = 0 */
        }
        uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
        uint32_t frameIdx = (c == 1) ? 0x90u : (c == 2) ? 2u : (c == 4 || c == 5) ? 0u : 5u;
        mem_region_t regs[] = {
            {0x6FDE3368u, 0x68u}, {0x6FDED378u, 24u}, {0x6FDECF40u, 0x60u}, {0x6FDECFA0u, 0x70u},
            {0x6FDEB3F8u, 0xA8u}, {0x6FDE9E1Cu, 4u}, {0x6FDF0A5Cu, 8u},
            {ARENA_SGPT, 0xC78u}, {ARENA_CHARSTATS, 0x600u}, {ARENA_MONSTATS, 0x200u},
            {ARENA_MONSEQTABLE, 0x80u}, {ARENA_SEQREC0, 0x60u}, {ARENA_SKILLLIST0, 0x20u},
            {ARENA_SKILL0, 0x20u}, {ARENA_SKILLSTXT, 0x40u}, {ARENA_ANIMDATA0, 0xA0u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x20u}, {ARENA_CELLS0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 20);
        eax = safe_stdcall2(0x6FD82770u, uArg, frameIdx, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",%u", uArg, frameIdx);
        emit_rec(fp, "0x6FD82770", "UNITS_GetAnimOrSeqEventAtFrame113c", c,
            c == 0 ? "null_asserts_dcc" : c == 1 ? "oob_frame_zero" : c == 2 ? "seq_mode_event_7" :
            c == 3 ? "animdata_event_42" : c == 4 ? "seq_frame0_event_55" : "seq_null_returns_0",
            args, regs, 20, asserted, eax, 0xFFFFFFFFu);
    }

    /* =========================================================================
     * #26 0x6FD825C0 UNITS_GetEquippedWeaponAdder113c (stdcall ret 4)
     * ========================================================================= */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        if (c == 1) {
            setup_player_weapon_inv(ARENA_UNIT0, 0u, 1u, ARENA_INV0, ARENA_ITEM0, 0u);
            setup_item_rec(ARENA_ITEM0, 1u, 1u, ARENA_ITEMDATA0, ARENA_INV0, 4u); /* quiver = 2 */
        } else if (c == 2) {
            U32(ARENA_UNIT0 + 0x00u) = 1u;
            U32(ARENA_UNIT0 + 0x04u) = 0u;
            U32(ARENA_MONSTATS + 0x14u) = 0u;
            U8(ARENA_MONSTATS2 + 0x0Eu) = 4u;
        } else if (c == 3) {
            U32(ARENA_UNIT0 + 0x00u) = 1u;
            U32(ARENA_UNIT0 + 0x04u) = 0u;
            U32(ARENA_UNIT0 + 0x10u) = 1u;
            U32(ARENA_MONSTATS + 0x14u) = 0u;
            U8(ARENA_MONSTATS2 + 0x0Eu) = 0xFFu;
            U32(ARENA_MONSTATS2 + 0x10u) = 0x20746832u; /* '2ht ' -> wcid 6 -> adder 2 */
        } else if (c == 4) {
            U32(ARENA_UNIT0 + 0x00u) = 1u;
            U32(ARENA_UNIT0 + 0x04u) = 999u; /* pMonStats2 = 0 -> returns 0 */
        }
        uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
        mem_region_t regs[] = {
            {0x6FDE3368u, 0x68u}, {0x6FDED378u, 24u}, {0x6FDD9088u, 0xACu}, {0x6FDE9E1Cu, 4u}, {0x6FDEFB94u, 8u},
            {ARENA_SGPT, 0xC78u}, {ARENA_ITYPEMAT, 0x200u}, {ARENA_ITEMSTXT, 0xB00u}, {ARENA_MONSTATS, 0x200u}, {ARENA_MONSTATS2, 0x200u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x20u}, {ARENA_CELLS0, 0x40u},
            {ARENA_ITEM0, 0x40u}, {ARENA_ITEMDATA0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 16);
        eax = safe_stdcall1(0x6FD825C0u, uArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", uArg);
        emit_rec(fp, "0x6FD825C0", "UNITS_GetEquippedWeaponAdder113c", c,
            c == 0 ? "null_asserts_11be" : c == 1 ? "player_quiver_2" : c == 2 ? "monster_range_4" :
            c == 3 ? "monster_2ht_adder_2" : "bad_monstats2_zero",
            args, regs, 16, asserted, eax, 0xFFFFFFFFu);
    }

    /* =========================================================================
     * #27 0x6FD826C0 UNITS_CanUnitMeleeAttackTarget113c (stdcall ret 0xC)
     * ========================================================================= */
    for (int c = 0; c < 9; c++) {
        setup_common_tables();
        setup_room_coll(ARENA_ROOM0, ARENA_COLL0, ARENA_COLLMAP0);
        U32(ARENA_MONSTATS + 0x14u) = 0u;
        U16(ARENA_MONSTATS + 1u * 0x1A8u + 0x02u) = 0x102u;
        U32(ARENA_MONSTATS + 1u * 0x1A8u + 0x14u) = 0u;
        U16(ARENA_MONSTATS + 2u * 0x1A8u + 0x02u) = 0x102u;
        U32(ARENA_MONSTATS + 2u * 0x1A8u + 0x14u) = 0u;
        U8(ARENA_MONSTATS2 + 0x08u) = 1u;
        U8(ARENA_MONSTATS2 + 0x0Eu) = 1u;
        if (c == 5) U8(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x104u) = 3u; /* adder = 3 -> 11<=14<15 */
        if (c == 8) U32(ARENA_SGPT + 0xA80u) = 2u; /* class 2 >= count 2 */
        setup_player_weapon_inv(ARENA_UNIT0, 0u, 1u, ARENA_INV0, ARENA_ITEM0, 0u);
        setup_item_rec(ARENA_ITEM0, 1u, (c == 5) ? 0u : 1u, ARENA_ITEMDATA0, ARENA_INV0, 4u);
        U32(ARENA_UNIT0 + 0x2Cu) = ARENA_PATH0;
        U16(ARENA_PATH0 + 0x02u) = (c == 5) ? 1u : 2u; U16(ARENA_PATH0 + 0x06u) = 2u;
        U32(ARENA_UNIT0 + 0x60u) = ARENA_INV0;
        U32(ARENA_PATH0 + 0x1Cu) = ARENA_ROOM0;

        U32(ARENA_UNIT1 + 0x00u) = (c == 6) ? 2u : 1u; /* object vs monster */
        U32(ARENA_UNIT1 + 0x04u) = (c == 4 || c == 5 || c == 6) ? 1u : (c == 8) ? 2u : 0u;
        U32(ARENA_UNIT1 + 0x2Cu) = ARENA_PATH1;
        if (c == 6) {
            U32(ARENA_UNIT1 + 0x14u) = ARENA_ITEMDATA1;
            U32(ARENA_ITEMDATA1 + 0x00u) = ARENA_MONSTATS2;
            U32(ARENA_PATH1 + 0x00u) = ARENA_ROOM0;
            U32(ARENA_PATH1 + 0x0Cu) = 7u;
            U32(ARENA_PATH1 + 0x10u) = 2u;
        } else {
            U16(ARENA_PATH1 + 0x02u) = (c == 2) ? 9u : (c == 4 || c == 8) ? 7u :
                (c == 5) ? 9u : (c == 7) ? 5u : (c == 3) ? 5u : 4u;
            U16(ARENA_PATH1 + 0x06u) = 2u;
            U32(ARENA_PATH1 + 0x1Cu) = ARENA_ROOM0;
        }
        if (c == 3) {
            U16(ARENA_COLLMAP0 + (2u * 10u + 3u) * 2u) = 0x0804u;
            U16(ARENA_COLLMAP0 + (2u * 10u + 4u) * 2u) = 0x0804u;
        }

        uint32_t u1 = (c == 0) ? 0u : ARENA_UNIT0;
        uint32_t nAdder = (c == 3) ? 3u : (c == 7) ? 2u : 1u;
        mem_region_t regs[] = {
            {0x6FDE3368u, 0x68u}, {0x6FDED378u, 24u}, {0x6FDD9088u, 0xACu}, {0x6FDD9388u, 0x68u},
            {0x6FDDABC0u, 0x100u}, {0x6FDE9E1Cu, 4u}, {0x6FDEFB94u, 8u},
            {ARENA_SGPT, 0xC78u}, {ARENA_ITYPEMAT, 0x200u}, {ARENA_ITEMSTXT, 0xB00u}, {ARENA_MONSTATS, 0x580u}, {ARENA_MONSTATS2, 0x200u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_UNIT1, 0xD0u}, {ARENA_PATH0, 0x60u}, {ARENA_PATH1, 0x60u},
            {ARENA_ROOM0, 0x80u}, {ARENA_COLL0, 0x40u}, {ARENA_COLLMAP0, 0x200u},
            {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x20u}, {ARENA_CELLS0, 0x40u},
            {ARENA_ITEM0, 0x40u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_ITEMDATA1, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 25);
        eax = safe_stdcall3(0x6FD826C0u, u1, ARENA_UNIT1, nAdder, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",%u", u1, ARENA_UNIT1, nAdder);
        const char *note = c == 0 ? "null_zero" : c == 1 ? "in_range_clear_1" : c == 2 ? "out_of_range_0" :
            c == 3 ? "coll_blocked_0" : c == 4 ? "baseId_102_special_range_1" :
            c == 5 ? "baseId_102_x9_oob_0" : c == 6 ? "object_uType2_oob_0" :
            c == 7 ? "adder2_dist4_in_range_1" : "mon_class_eq_count_oob_0";
        emit_rec(fp, "0x6FD826C0", "UNITS_CanUnitMeleeAttackTarget113c", c, note,
            args, regs, 25, asserted, eax, 0xFFFFFFFFu);
    }

    /* =========================================================================
     * #28 0x6FD7CCC0 HIRELING_RollAndPopulateStatsEntry113c
     * ecx=bExpansion, edx=pUnit, [esp+4..0x10]=(dwSeed, nAct, nDifficulty, pOutStats)
     * ========================================================================= */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        if (c == 3) U32(ARENA_SGPT + 0xBD4u) = 0x0Cu; /* exactly 12: >12 false -> unitLvl=0 */
        U32(0x6FDF007Cu) = (c == 0) ? 0u : 2u;
        for (uint32_t k = 0; k < 2u; k++) {
            uint32_t h = ARENA_HIRELING + k * 0x118u;
            U16(h + 0x00u) = 100u; /* expansion */
            U32(h + 0x04u) = 10u + k;
            U32(h + 0x0Cu) = 2u;   /* act = 1 + 1 */
            U32(h + 0x10u) = 1u;   /* diff = 0 + 1 */
            U32(h + 0x18u) = 500u;
            U32(h + 0x1Cu) = 3u;
            U32(h + 0x20u) = 120u;
            U32(h + 0x24u) = 80u;
            U32(h + 0x28u) = 12u;
            U32(h + 0x2Cu) = 25u;
            U32(h + 0x30u) = 5u;
            U32(h + 0x34u) = 30u;
            U32(h + 0x38u) = 16u;
            U32(h + 0x3Cu) = 24u;
            U32(h + 0x40u) = 12u;
            U32(h + 0x4Cu) = 40u;
            U32(h + 0x50u) = 5u;
            U32(h + 0x54u) = 10u;
            U32(h + 0x58u) = 8u;
            U32(h + 0x5Cu) = 15u;
            U8(h + 0xD2u) = (uint8_t)(2u + k);
        }
        U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
        U32(ARENA_STATLIST0 + 0x48u) = ARENA_STATS0;
        U16(ARENA_STATLIST0 + 0x4Cu) = 1u;
        U16(ARENA_STATLIST0 + 0x4Eu) = 4u;
        U32(ARENA_STATS0 + 0x00u) = 0x000C0000u; S32(ARENA_STATS0 + 0x04u) = (c >= 2) ? 25 : 5;
        mem_region_t regs[] = {
            {0x6FDD9088u, 0xACu}, {0x6FDE9E1Cu, 4u}, {0x6FDF0078u, 8u}, {ARENA_SGPT, 0xC78u},
            {ARENA_ISC + 0x0Cu * 0x144u, 0x144u}, {ARENA_HIRELING, 0x240u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x40u}, {ARENA_HIRELINGOUT, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 10);
        eax = safe_ecx_edx_stack4(0x6FD7CCC0u, 1u, ARENA_UNIT0, 0x12345u + (uint32_t)c, 1u, 0u, ARENA_HIRELINGOUT, &asserted);
        snprintf(args, sizeof(args), "1,\"0x%08X\",%u,1,0,\"0x%08X\"", ARENA_UNIT0, 0x12345u + (uint32_t)c, ARENA_HIRELINGOUT);
        emit_rec(fp, "0x6FD7CCC0", "HIRELING_RollAndPopulateStatsEntry113c", c,
            c == 0 ? "no_records_zero" : c == 1 ? "lvl5_hireling_stats" :
            c == 2 ? "lvl25_scaled_stats" : "isc_count12_boundary_lvl2",
            args, regs, 10, asserted, eax, 0xFFFFFFFFu);
    }

    /* =========================================================================
     * #29 0x6FD97120 ITEMS_AddChargedSkillStatToItemOrSocket113c (stdcall ret 0x10)
     * ========================================================================= */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        /* Stat 0xCC with layer = (1 << 6) | 2 = 0x42 -> key 0x00CC0042, val = (20 << 8) | 5 = 0x1405 */
        if (c == 1 || c == 3) {
            U32(ARENA_ITEM0 + 0x00u) = 4u;
            U32(ARENA_ITEM0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST1 + 0x10u) = 0x40u;
            U32(ARENA_STATLIST1 + 0x24u) = ARENA_STATS0;
            U16(ARENA_STATLIST1 + 0x28u) = 1u;
            U16(ARENA_STATLIST1 + 0x2Au) = 8u;
            U32(ARENA_STATLIST1 + 0x34u) = ARENA_STATLIST0;
            U32(ARENA_STATS0 + 0x00u) = 0x00CC0042u; S32(ARENA_STATS0 + 0x04u) = 0x1405;
        } else if (c == 2) {
            U32(ARENA_ITEM0 + 0x00u) = 4u;
            U32(ARENA_ITEM0 + 0x60u) = ARENA_INV0;
            U32(ARENA_INV0 + 0x00u) = 0x01020304u;
            U32(ARENA_INV0 + 0x0Cu) = ARENA_ITEM1;
            U32(ARENA_ITEM1 + 0x00u) = 4u;
            U32(ARENA_ITEM1 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST1 + 0x10u) = 0x40u;
            U32(ARENA_STATLIST1 + 0x24u) = ARENA_STATS0;
            U16(ARENA_STATLIST1 + 0x28u) = 1u;
            U16(ARENA_STATLIST1 + 0x2Au) = 8u;
            U32(ARENA_STATLIST1 + 0x34u) = ARENA_STATLIST0;
            U32(ARENA_STATS0 + 0x00u) = 0x00CC0042u; S32(ARENA_STATS0 + 0x04u) = 0x1405;
        } else if (c == 4) {
            /* Walk pPrevLink chain across ARENA_STATLIST1 (no 0xCC) -> ARENA_STATLIST2 (0x40 flag at +0x10, +0x14=0) */
            U32(ARENA_ITEM0 + 0x00u) = 4u;
            U32(ARENA_ITEM0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST1 + 0x10u) = 0x40u;
            U32(ARENA_STATLIST1 + 0x2Cu) = ARENA_STATLIST2;
            U32(ARENA_STATLIST1 + 0x34u) = ARENA_STATLIST0;
            U32(ARENA_STATLIST2 + 0x10u) = 0x40u;
            U32(ARENA_STATLIST2 + 0x14u) = 0u;
            U32(ARENA_STATLIST2 + 0x24u) = ARENA_STATS0;
            U16(ARENA_STATLIST2 + 0x28u) = 1u;
            U16(ARENA_STATLIST2 + 0x2Au) = 8u;
            U32(ARENA_STATLIST2 + 0x34u) = ARENA_STATLIST0;
            U32(ARENA_STATS0 + 0x00u) = 0x00CC0042u; S32(ARENA_STATS0 + 0x04u) = 0x1405;
        }
        uint32_t itemArg = (c == 0) ? 0u : ARENA_ITEM0;
        int32_t chgArg = (c == 3) ? -5 : 99;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC78u},
            {ARENA_ISC + 0xCCu * 0x144u, 0x144u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEM1, 0x80u}, {ARENA_INV0, 0x40u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}, {ARENA_STATLIST2, 0x80u}, {ARENA_STATS0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 11);
        eax = safe_stdcall4(0x6FD97120u, itemArg, 1u, 2u, (uint32_t)chgArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",1,2,%d", itemArg, chgArg);
        emit_rec(fp, "0x6FD97120", "ITEMS_AddChargedSkillStatToItemOrSocket113c", c,
            c == 0 ? "null_item_zero" : c == 1 ? "clamps_to_max20" : c == 2 ? "recurses_socket_item" :
            c == 3 ? "neg_clamps_to_0" : "walks_prevlink_to_statlist2",
            args, regs, 11, asserted, eax, 0xFFFFFFFFu);
    }

    /* =========================================================================
     * #30..#32 0x6FD98B80, 0x6FD99140, 0x6FD99190
     * ecx=bForceRoll, edx=pItem, [esp+4..0x1C]=(pUnit, pPropEntry, nStatId, bNegateCur, nStateId, fStatListFlags, _unused)
     * ========================================================================= */
    {
        static const uint32_t prop_vas[3] = {0x6FD98B80u, 0x6FD99140u, 0x6FD99190u};
        static const char *prop_va_strs[3] = {"0x6FD98B80", "0x6FD99140", "0x6FD99190"};
        static const char *prop_names[3] = {
            "ITEMS_RollAndApplySkillBonusStat113c",
            "ITEMS_ApplyElemMasteryOrPierceMinToMax113c",
            "ITEMS_ApplyElemMasteryOrPierceMaxOnly113c",
        };
        for (int p = 0; p < 3; p++) {
            int ncases = (p == 2) ? 5 : 4;
            for (int c = 0; c < ncases; c++) {
                setup_common_tables();
                U32(ARENA_ITEM0 + 0x00u) = 4u;
                U32(ARENA_ITEM0 + 0x04u) = 0u;
                U32(ARENA_ITEM0 + 0x0Cu) = 77u;
                U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
                U32(ARENA_ITEM0 + 0x20u) = 0x11223344u;
                U32(ARENA_ITEM0 + 0x24u) = 0x55667788u;
                U32(ARENA_ITEM0 + 0x5Cu) = ARENA_STATLIST0;
                U32(ARENA_ITEMDATA0 + 0x04u) = 0x12345678u;
                U32(ARENA_ITEMDATA0 + 0x08u) = 0x9ABCDEF0u;
                U16(ARENA_ITEMDATA0 + 0x30u) = 1u;
                U32(ARENA_ITEM1 + 0x00u) = 4u;
                U32(ARENA_ITEM1 + 0x0Cu) = 88u;
                U32(ARENA_ITEM1 + 0x5Cu) = ARENA_STATLIST2;
                U32(ARENA_STATLIST2 + 0x10u) = 0x80000000u;
                U32(ARENA_UNIT0 + 0x00u) = 1u; /* non-item unit for c==4 on MaxOnly */
                U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
                U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
                U32(ARENA_STATLIST1 + 0x10u) = 0x40u;
                U32(ARENA_STATLIST1 + 0x24u) = ARENA_STATS0;
                U16(ARENA_STATLIST1 + 0x28u) = 1u;
                U16(ARENA_STATLIST1 + 0x2Au) = 8u;
                U32(ARENA_STATLIST1 + 0x34u) = ARENA_STATLIST0;
                U32(ARENA_STATS0 + 0x00u) = 0x00070000u; S32(ARENA_STATS0 + 0x04u) = 0x300;
                S32(ARENA_PROPENTRY + 0x08u) = (c == 0 || c == 4) ? 0 : 12;
                S32(ARENA_PROPENTRY + 0x0Cu) = (c == 0 || c == 4) ? 0 : 18;
                uint32_t itemArg = (c == 3) ? ARENA_ITEM1 : ARENA_ITEM0;
                uint32_t unitArg = (c == 4) ? ARENA_UNIT0 : ARENA_ITEM0;
                uint32_t bNeg = (c == 2) ? 1u : 0u;
                mem_region_t regs[] = {
                    {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u}, {0x6FDEFF6Cu, 4u}, {ARENA_OUT2, 0x10u},
                    {ARENA_SGPT, 0xC78u}, {ARENA_ITEMSTXT, 0x300u}, {ARENA_ISC, 0x1000u},
                    {ARENA_PROPENTRY, 0x20u}, {ARENA_UNIT0, 0xD0u}, {ARENA_ITEM0, 0x80u}, {ARENA_ITEM1, 0x80u},
                    {ARENA_ITEMDATA0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u},
                    {ARENA_STATLIST2, 0x80u}, {ARENA_STATS0, 0x80u}
                };
                capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 17);
                eax = safe_ecx_edx_stack7(prop_vas[p], 0u, itemArg,
                    unitArg, ARENA_PROPENTRY, 7u, bNeg, 0u, 0x40u, 0u, &asserted);
                snprintf(args, sizeof(args), "0,\"0x%08X\",\"0x%08X\",\"0x%08X\",7,%u,0,64,0",
                    itemArg, unitArg, ARENA_PROPENTRY, bNeg);
                const char *note = c == 0 ? "zero_roll_returns_0" : c == 1 ? "rolls_and_adds_stat7" :
                    c == 2 ? "negates_existing_stat7" : c == 3 ? "distinct_pItem_gets_statlist" : "maxonly_bForce0_nonitem_zero";
                emit_rec(fp, prop_va_strs[p], prop_names[p], c, note,
                    args, regs, 17, asserted, eax, 0xFFFFFFFFu);
            }
        }
    }
}

int main(int argc, char **argv) {
    g_arena = (uint8_t *)VirtualAlloc((LPVOID)ARENA_BASE, ARENA_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
    if (!g_arena || (uintptr_t)g_arena != ARENA_BASE) {
        fprintf(stderr, "Failed to allocate arena at 0x%08X\n", ARENA_BASE);
        return 1;
    }
    g_heap = (uint8_t *)VirtualAlloc((LPVOID)HEAP_BASE, HEAP_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
    if (!g_heap || (uintptr_t)g_heap != HEAP_BASE) {
        fprintf(stderr, "Failed to allocate heap at 0x%08X\n", HEAP_BASE);
        return 1;
    }

    LoadLibraryA("Storm.dll");
    HMODULE hFog = LoadLibraryA("Fog.dll");
    if (hFog) {
        typedef void (__fastcall *FogInitSysFn)(int, void *);
        FogInitSysFn pInitSys = (FogInitSysFn)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10089));
        if (pInitSys) pInitSys(1, NULL);
    }
    HMODULE hCommon = LoadLibraryA("D2Common.dll");
    if (!hCommon || (uintptr_t)hCommon != 0x6FD50000u) {
        fprintf(stderr, "Failed to load D2Common.dll at 0x6FD50000 (got %p)\n", (void *)hCommon);
        return 1;
    }

    DWORD oldProt = 0;
    VirtualProtect((LPVOID)0x6FDD5000u, 0x28000u, PAGE_EXECUTE_READWRITE, &oldProt);
    {
        DWORD iatProt = 0;
        if (!VirtualProtect((LPVOID)0x6FDD9000u, 0x1000u, PAGE_READWRITE, &iatProt)) {
            fprintf(stderr, "VirtualProtect(IAT) failed\n");
            return 1;
        }
        DWORD rdataProt = 0;
        if (!VirtualProtect((LPVOID)0x6FDE3000u, 0x1000u, PAGE_READWRITE, &rdataProt)) {
            fprintf(stderr, "VirtualProtect(0x6FDE3000) failed\n");
            return 1;
        }
    }

    g_orig_iat_assert  = U32(0x6FDD90D4u);
    g_orig_iat_alloc   = U32(0x6FDD90D0u);
    g_orig_iat_free    = U32(0x6FDD90CCu);
    g_orig_iat_realloc = U32(0x6FDD90ACu);

    const char *i11a1_path = (argc > 1) ? argv[1] : "i11a-1-vectors.ndjson";
    const char *i11a2_path = (argc > 2) ? argv[2] : "i11a-2-vectors.ndjson";

    FILE *fp1 = fopen(i11a1_path, "wb");
    if (!fp1) return 1;
    emit_i11a_1(fp1);
    fclose(fp1);

    FILE *fp2 = fopen(i11a2_path, "wb");
    if (!fp2) return 1;
    emit_i11a_2(fp2);
    fclose(fp2);

    TerminateProcess(GetCurrentProcess(), 0);
    return 0;
}
