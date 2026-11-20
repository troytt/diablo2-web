/*
 * k1r9-laneA-it12-emitter.c
 *
 * Real-DLL Wine differential vector emitter for Iteration 12 Lane A:
 *   - I12A-1 (15 net-new diff-verified functions -> i12a-1-vectors.ndjson)
 *   - I12A-2 (20 net-new diff-verified functions -> i12a-2-vectors.ndjson)
 *
 * Inline-assembly rule: Register/immediate operands only; no memory constraints.
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
#define ARENA_GRIDS1      (ARENA_BASE + 0x2800u)
#define ARENA_CELLS0      (ARENA_BASE + 0x2A00u)
#define ARENA_CELLS1      (ARENA_BASE + 0x2C00u)
#define ARENA_CELLS2      (ARENA_BASE + 0x2E00u)
#define ARENA_CELLS3      (ARENA_BASE + 0x3000u)
#define ARENA_STATLIST0   (ARENA_BASE + 0x3200u)
#define ARENA_STATLIST1   (ARENA_BASE + 0x3400u)
#define ARENA_STATLIST2   (ARENA_BASE + 0x3600u)
#define ARENA_STATS0      (ARENA_BASE + 0x3800u)
#define ARENA_STATS1      (ARENA_BASE + 0x3A00u)
#define ARENA_PATH0       (ARENA_BASE + 0x3C00u)
#define ARENA_PATH1       (ARENA_BASE + 0x3E00u)
#define ARENA_ROOM0       (ARENA_BASE + 0x4000u)
#define ARENA_COLL0       (ARENA_BASE + 0x4200u)
#define ARENA_COLLMAP0    (ARENA_BASE + 0x4300u)
#define ARENA_ANIMDATA0   (ARENA_BASE + 0x5000u)
#define ARENA_PROPENTRY   (ARENA_BASE + 0x5200u)
#define ARENA_OUT         (ARENA_BASE + 0x5C00u)
#define ARENA_OUT2        (ARENA_BASE + 0x5D00u)
#define ARENA_ITYPEMAT    (ARENA_BASE + 0x6400u)
#define ARENA_CHARSTATS   (ARENA_BASE + 0x6800u)
#define ARENA_MONSEQTABLE (ARENA_BASE + 0x7200u)
#define ARENA_SEQREC0     (ARENA_BASE + 0x7400u)
#define ARENA_BELTSTXT    (ARENA_BASE + 0x7800u)
#define ARENA_INVTXT      (ARENA_BASE + 0x8800u)
#define ARENA_NODE0       (ARENA_BASE + 0x9800u)
#define ARENA_CORPSE0     (ARENA_BASE + 0x9900u)
#define ARENA_ACT0        (ARENA_BASE + 0x9A00u)
#define ARENA_STATESTXT   (ARENA_BASE + 0xB000u)
#define ARENA_STATEMASKS  (ARENA_BASE + 0xB800u)
#define ARENA_XFORMSTATES (ARENA_BASE + 0xBE00u)
#define ARENA_ISC         (ARENA_BASE + 0x10000u)
#define ARENA_ITEMSTXT    (ARENA_BASE + 0x30000u)
#define ARENA_ITEMTYPES   (ARENA_BASE + 0x38000u)
#define ARENA_MONSTATS    (ARENA_BASE + 0x40000u)
#define ARENA_MONSTATS2   (ARENA_BASE + 0x58000u)
#define ARENA_SKILLSTXT   (ARENA_BASE + 0x70000u)
#define ARENA_MISSILESTXT (ARENA_BASE + 0x74000u)
#define ARENA_ITEMSLINK   (ARENA_BASE + 0x76000u)

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
typedef uint32_t (__stdcall *stdcall6_t)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
typedef uint32_t (__stdcall *stdcall7_t)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
typedef uint32_t (__fastcall *fastcall_stack9_t)(
    uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);

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

static __attribute__((noinline)) uint32_t call_ebx_esi_edi(
    uint32_t fn, uint32_t ebx_val, uint32_t esi_val, uint32_t edi_val) {
    g_pkt.fn = fn;
    g_pkt.r_ebx = ebx_val;
    g_pkt.r_esi = esi_val;
    g_pkt.r_edi = edi_val;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "pushl %%ebx\n\t"
        "pushl %%ecx\n\t"
        "movl 16(%%ecx), %%ebx\n\t"
        "movl 20(%%ecx), %%esi\n\t"
        "movl 24(%%ecx), %%edi\n\t"
        "movl 0(%%ecx), %%eax\n\t"
        "call *%%eax\n\t"
        "popl %%ecx\n\t"
        "popl %%ebx\n\t"
        "movl %%eax, 68(%%ecx)\n\t"
        : "+c"(base)
        :
        : "eax", "edx", "esi", "edi", "cc", "memory"
    );
    return g_pkt.ret;
}

static __attribute__((noinline)) uint32_t call_eax_edi_stack4(
    uint32_t fn, uint32_t eax_val, uint32_t edi_val,
    uint32_t s1, uint32_t s2, uint32_t s3, uint32_t s4) {
    g_pkt.fn = fn;
    g_pkt.r_eax = eax_val;
    g_pkt.r_edi = edi_val;
    g_pkt.s[0] = s1; g_pkt.s[1] = s2; g_pkt.s[2] = s3; g_pkt.s[3] = s4;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "pushl 40(%0)\n\t"
        "pushl 36(%0)\n\t"
        "pushl 32(%0)\n\t"
        "pushl 28(%0)\n\t"
        "movl 4(%0), %%eax\n\t"
        "movl 24(%0), %%edi\n\t"
        "movl 0(%0), %%ecx\n\t"
        "call *%%ecx\n\t"
        "movl %%eax, 68(%0)\n\t"
        : "+b"(base)
        :
        : "eax", "ecx", "edx", "esi", "edi", "cc", "memory"
    );
    return g_pkt.ret;
}

static __attribute__((noinline)) uint32_t call_eax_stack2(
    uint32_t fn, uint32_t eax_val, uint32_t s1, uint32_t s2) {
    g_pkt.fn = fn;
    g_pkt.r_eax = eax_val;
    g_pkt.s[0] = s1; g_pkt.s[1] = s2;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
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

static __attribute__((noinline)) uint32_t call_eax_edi_stack1(
    uint32_t fn, uint32_t eax_val, uint32_t edi_val, uint32_t s1) {
    g_pkt.fn = fn;
    g_pkt.r_eax = eax_val;
    g_pkt.r_edi = edi_val;
    g_pkt.s[0] = s1;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "pushl 28(%0)\n\t"
        "movl 4(%0), %%eax\n\t"
        "movl 24(%0), %%edi\n\t"
        "movl 0(%0), %%ecx\n\t"
        "call *%%ecx\n\t"
        "movl %%eax, 68(%0)\n\t"
        : "+b"(base)
        :
        : "eax", "ecx", "edx", "esi", "edi", "cc", "memory"
    );
    return g_pkt.ret;
}

static __attribute__((noinline)) uint32_t call_eax_ecx_edx_stack2(
    uint32_t fn, uint32_t eax_val, uint32_t ecx_val, uint32_t edx_val,
    uint32_t s1, uint32_t s2) {
    g_pkt.fn = fn;
    g_pkt.r_eax = eax_val;
    g_pkt.r_ecx = ecx_val;
    g_pkt.r_edx = edx_val;
    g_pkt.s[0] = s1; g_pkt.s[1] = s2;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "pushl 32(%0)\n\t"
        "pushl 28(%0)\n\t"
        "movl 4(%0), %%eax\n\t"
        "movl 8(%0), %%ecx\n\t"
        "movl 12(%0), %%edx\n\t"
        "movl 0(%0), %%esi\n\t"
        "call *%%esi\n\t"
        "movl %%eax, 68(%0)\n\t"
        : "+b"(base)
        :
        : "eax", "ecx", "edx", "esi", "edi", "cc", "memory"
    );
    return g_pkt.ret;
}

static __attribute__((noinline)) uint32_t call_eax_edx_ecx(
    uint32_t fn, uint32_t eax_val, uint32_t edx_val, uint32_t ecx_val) {
    g_pkt.fn = fn;
    g_pkt.r_eax = eax_val;
    g_pkt.r_edx = edx_val;
    g_pkt.r_ecx = ecx_val;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "movl 4(%0), %%eax\n\t"
        "movl 12(%0), %%edx\n\t"
        "movl 8(%0), %%ecx\n\t"
        "movl 0(%0), %%esi\n\t"
        "call *%%esi\n\t"
        "movl %%eax, 68(%0)\n\t"
        : "+b"(base)
        :
        : "eax", "ecx", "edx", "esi", "edi", "cc", "memory"
    );
    return g_pkt.ret;
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
static __attribute__((noinline)) uint32_t safe_stdcall6(uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3, uint32_t a4, uint32_t a5, int *pAsserted) {
    SAFE_BODY(((stdcall6_t)(uintptr_t)va)(a0, a1, a2, a3, a4, a5));
}
static __attribute__((noinline)) uint32_t safe_stdcall7(uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3, uint32_t a4, uint32_t a5, uint32_t a6, int *pAsserted) {
    SAFE_BODY(((stdcall7_t)(uintptr_t)va)(a0, a1, a2, a3, a4, a5, a6));
}
static __attribute__((noinline)) uint32_t safe_ecx_edx_stack9(
    uint32_t va, uint32_t ecx, uint32_t edx, uint32_t s1, uint32_t s2, uint32_t s3,
    uint32_t s4, uint32_t s5, uint32_t s6, uint32_t s7, uint32_t s8, uint32_t s9, int *pAsserted) {
    SAFE_BODY(((fastcall_stack9_t)(uintptr_t)va)(ecx, edx, s1, s2, s3, s4, s5, s6, s7, s8, s9));
}
static __attribute__((noinline)) uint32_t safe_ebx_esi_edi(uint32_t va, uint32_t ebx, uint32_t esi, uint32_t edi, int *pAsserted) {
    SAFE_BODY(call_ebx_esi_edi(va, ebx, esi, edi));
}
static __attribute__((noinline)) uint32_t safe_eax_edi_stack4(
    uint32_t va, uint32_t eax, uint32_t edi, uint32_t s1, uint32_t s2, uint32_t s3, uint32_t s4, int *pAsserted) {
    SAFE_BODY(call_eax_edi_stack4(va, eax, edi, s1, s2, s3, s4));
}
static __attribute__((noinline)) uint32_t safe_eax_stack2(
    uint32_t va, uint32_t eax, uint32_t s1, uint32_t s2, int *pAsserted) {
    SAFE_BODY(call_eax_stack2(va, eax, s1, s2));
}
static __attribute__((noinline)) uint32_t safe_eax_edi_stack1(
    uint32_t va, uint32_t eax, uint32_t edi, uint32_t s1, int *pAsserted) {
    SAFE_BODY(call_eax_edi_stack1(va, eax, edi, s1));
}
static __attribute__((noinline)) uint32_t safe_eax_ecx_edx_stack2(
    uint32_t va, uint32_t eax, uint32_t ecx, uint32_t edx, uint32_t s1, uint32_t s2, int *pAsserted) {
    SAFE_BODY(call_eax_ecx_edx_stack2(va, eax, ecx, edx, s1, s2));
}
static __attribute__((noinline)) uint32_t safe_eax_edx_ecx(
    uint32_t va, uint32_t eax, uint32_t edx, uint32_t ecx, int *pAsserted) {
    SAFE_BODY(call_eax_edx_ecx(va, eax, edx, ecx));
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
    memset(g_heap, 0, 0x8000u);
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
    U32(ARENA_SGPT + 0xA80u) = 600u;
    U32(ARENA_SGPT + 0xA90u) = ARENA_MONSTATS2;
    U32(ARENA_SGPT + 0xA98u) = 600u;
    U32(ARENA_SGPT + 0xB98u) = ARENA_SKILLSTXT;
    U32(ARENA_SGPT + 0xBA0u) = 20u;
    U32(ARENA_SGPT + 0xBC0u) = 300u;
    U32(ARENA_SGPT + 0xBC4u) = ARENA_CHARSTATS;
    U32(ARENA_SGPT + 0xBC8u) = 7u;
    U32(ARENA_SGPT + 0xBCCu) = ARENA_ISC;
    U32(ARENA_SGPT + 0xBD4u) = 359u;
    U32(ARENA_SGPT + 0xBF8u) = ARENA_ITEMTYPES;
    U32(ARENA_SGPT + 0xBFCu) = 96u;
    U32(ARENA_SGPT + 0xC00u) = 3u;
    U32(ARENA_SGPT + 0xC04u) = ARENA_ITYPEMAT;
    U32(ARENA_SGPT + 0xC6Cu) = 6u;
    U32(ARENA_SGPT + 0xC70u) = 0x3Fu;

    U32(0x6FDEFB94u) = 14u;
    U32(0x6FDEFB98u) = ARENA_ITEMSTXT;
    U32(0x6FDEFF6Cu) = ARENA_ITEMSLINK;

    U32(0x6FDF13DCu) = ARENA_BELTSTXT;
    U8(ARENA_BELTSTXT + 2u * 0x108u + 0x04u) = 4u;
    U8(ARENA_BELTSTXT + 3u * 0x108u + 0x04u) = 16u;

    U32(0x6FDEFA58u) = 20u;
    U32(0x6FDEFA5Cu) = ARENA_INVTXT;
    for (uint32_t r = 0; r < 16u; r++) {
        U8(ARENA_INVTXT + r * 0xF0u + 0x10u) = 10u;
        U8(ARENA_INVTXT + r * 0xF0u + 0x11u) = 4u;
    }

    U32(0x6FDEEFE4u) = 7u;
    for (uint32_t c = 0; c < 7u; c++) {
        U32(0x6FDEEFE8u + c * 8u + 0u) = c;
        U32(0x6FDEEFE8u + c * 8u + 4u) = 0u;
        U32(ARENA_CHARSTATS + c * 0xC4u + 0x4Cu) = 0x20687468u;
    }

    U32(0x6FDF0A5Cu) = ARENA_MONSEQTABLE;
    U32(0x6FDF0A60u) = 8u;

    /* Weapon class code index table at 0x6FDEF020 */
    U32(0x6FDEF020u) = 6u;
    U32(0x6FDEF028u + 0u * 8u + 0u) = 0x20687468u; U16(0x6FDEF028u + 0u * 8u + 4u) = 0u;
    U32(0x6FDEF028u + 1u * 8u + 0u) = 0x20736831u; U16(0x6FDEF028u + 1u * 8u + 4u) = 2u;
    U32(0x6FDEF028u + 2u * 8u + 0u) = 0x20746831u; U16(0x6FDEF028u + 2u * 8u + 4u) = 3u;
    U32(0x6FDEF028u + 3u * 8u + 0u) = 0x20776F62u; U16(0x6FDEF028u + 3u * 8u + 4u) = 1u;
    U32(0x6FDEF028u + 4u * 8u + 0u) = 0x20736832u; U16(0x6FDEF028u + 4u * 8u + 4u) = 5u;
    U32(0x6FDEF028u + 5u * 8u + 0u) = 0x20317468u; U16(0x6FDEF028u + 5u * 8u + 4u) = 12u;

    for (uint32_t t = 0; t < 96u; t++) {
        U8(ARENA_ITEMTYPES + t * 0xE4u + 0x21u) = 0xFFu;
    }
    /* Type 0x1E (1H sword): bodyLoc 4/5 -> maps to 0x2D (weapon) */
    U8(ARENA_ITEMTYPES + 0x1Eu * 0xE4u + 0x0Au) = 4u;
    U8(ARENA_ITEMTYPES + 0x1Eu * 0xE4u + 0x0Bu) = 5u;
    U32(ARENA_ITYPEMAT + 0x1Eu * 12u + 4u) = (1u << (0x2Du - 32u));
    /* Type 0x1B (bow): shoots 0x2E, bodyLoc 4/5 -> maps to 0x2D */
    U8(ARENA_ITEMTYPES + 0x1Bu * 0xE4u + 0x0Au) = 4u;
    U8(ARENA_ITEMTYPES + 0x1Bu * 0xE4u + 0x0Bu) = 5u;
    U16(ARENA_ITEMTYPES + 0x1Bu * 0xE4u + 0x0Cu) = 0x2Eu; /* wQuiver */
    U16(ARENA_ITEMTYPES + 0x1Bu * 0xE4u + 0x0Eu) = 0x2Eu; /* wShoots */
    U32(ARENA_ITYPEMAT + 0x1Bu * 12u + 4u) = (1u << (0x2Du - 32u));
    /* Type 0x2E (quiver): shoots 0 */
    U8(ARENA_ITEMTYPES + 0x2Eu * 0xE4u + 0x0Au) = 5u;
    U8(ARENA_ITEMTYPES + 0x2Eu * 0xE4u + 0x0Bu) = 4u;
    /* Type 0x33 (shield): bodyLoc 5 */
    U8(ARENA_ITEMTYPES + 0x33u * 0xE4u + 0x0Au) = 5u;
    /* Type 0x43 (claw/hth): bodyLoc 4/5 -> maps to 0x2D and 0x43 */
    U8(ARENA_ITEMTYPES + 0x43u * 0xE4u + 0x0Au) = 4u;
    U8(ARENA_ITEMTYPES + 0x43u * 0xE4u + 0x0Bu) = 5u;
    U32(ARENA_ITYPEMAT + 0x43u * 12u + 4u) = (1u << (0x2Du - 32u));
    U32(ARENA_ITYPEMAT + 0x43u * 12u + 8u) = (1u << (0x43u - 64u));
    /* Type 0x45 (hp pot) & 0x46 (mp pot) & 0x47 (scroll): beltable=1 */
    U8(ARENA_ITEMTYPES + 0x45u * 0xE4u + 0x19u) = 1u;
    U8(ARENA_ITEMTYPES + 0x46u * 0xE4u + 0x19u) = 1u;
    U8(ARENA_ITEMTYPES + 0x47u * 0xE4u + 0x19u) = 1u;
    /* Type 0x0A (ring): bodyLoc 11/12 */
    U8(ARENA_ITEMTYPES + 0x0Au * 0xE4u + 0x0Au) = 11u;
    U8(ARENA_ITEMTYPES + 0x0Au * 0xE4u + 0x0Bu) = 12u;
    /* Type 0x13 (belt): bodyLoc 8 */
    U8(ARENA_ITEMTYPES + 0x13u * 0xE4u + 0x0Au) = 8u;
    /* Type 0x25 (helm): bodyLoc 1, maps to 0x32 (armor) */
    U8(ARENA_ITEMTYPES + 0x25u * 0xE4u + 0x0Au) = 1u;
    U32(ARENA_ITYPEMAT + 0x25u * 12u + 4u) = (1u << (0x32u - 32u));

    /* Item 0: 1H sword (1x3) */
    U32(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x80u) = 0x20736831u;
    U32(ARENA_ITEMSTXT + 0u * 0x1A8u + 0xC0u) = 0x20736831u;
    U32(ARENA_ITEMSTXT + 0u * 0x1A8u + 0xC4u) = 0x20736832u;
    U8(ARENA_ITEMSTXT + 0u * 0x1A8u + 0xFEu) = 5u;
    U8(ARENA_ITEMSTXT + 0u * 0x1A8u + 0xFFu) = 12u;
    U8(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x10Fu) = 1u;
    U8(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x110u) = 3u;
    U8(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x115u) = 5u;
    U8(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x11Cu) = 0u;
    U16(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x11Eu) = 0x1Eu;

    /* Item 1: 1H thrust (1x3) */
    U32(ARENA_ITEMSTXT + 1u * 0x1A8u + 0x80u) = 0x20746831u;
    U32(ARENA_ITEMSTXT + 1u * 0x1A8u + 0xC0u) = 0x20746831u;
    U32(ARENA_ITEMSTXT + 1u * 0x1A8u + 0xC4u) = 0x20746832u;
    U8(ARENA_ITEMSTXT + 1u * 0x1A8u + 0x10Fu) = 1u;
    U8(ARENA_ITEMSTXT + 1u * 0x1A8u + 0x110u) = 3u;
    U8(ARENA_ITEMSTXT + 1u * 0x1A8u + 0x115u) = 5u;
    U8(ARENA_ITEMSTXT + 1u * 0x1A8u + 0x11Cu) = 0u;
    U16(ARENA_ITEMSTXT + 1u * 0x1A8u + 0x11Eu) = 0x1Eu;

    /* Item 2: Bow (2x4) */
    U32(ARENA_ITEMSTXT + 2u * 0x1A8u + 0x80u) = 0x20776F62u;
    U32(ARENA_ITEMSTXT + 2u * 0x1A8u + 0xC0u) = 0x20776F62u;
    U32(ARENA_ITEMSTXT + 2u * 0x1A8u + 0xC4u) = 0x20776F62u;
    U8(ARENA_ITEMSTXT + 2u * 0x1A8u + 0x10Fu) = 2u;
    U8(ARENA_ITEMSTXT + 2u * 0x1A8u + 0x110u) = 4u;
    U8(ARENA_ITEMSTXT + 2u * 0x1A8u + 0x115u) = 5u;
    U8(ARENA_ITEMSTXT + 2u * 0x1A8u + 0x11Cu) = 1u;
    U16(ARENA_ITEMSTXT + 2u * 0x1A8u + 0x11Eu) = 0x1Bu;

    /* Item 3: 1-or-2H sword (2x3, b1or2Handed=1) */
    U32(ARENA_ITEMSTXT + 3u * 0x1A8u + 0x80u) = 0x20736832u;
    U32(ARENA_ITEMSTXT + 3u * 0x1A8u + 0xC0u) = 0x20736831u;
    U32(ARENA_ITEMSTXT + 3u * 0x1A8u + 0xC4u) = 0x20736832u;
    U8(ARENA_ITEMSTXT + 3u * 0x1A8u + 0x10Fu) = 2u;
    U8(ARENA_ITEMSTXT + 3u * 0x1A8u + 0x110u) = 3u;
    U8(ARENA_ITEMSTXT + 3u * 0x1A8u + 0x115u) = 5u;
    U8(ARENA_ITEMSTXT + 3u * 0x1A8u + 0x11Cu) = 1u;
    U16(ARENA_ITEMSTXT + 3u * 0x1A8u + 0x11Eu) = 0x1Eu;
    U8(ARENA_ITEMSTXT + 3u * 0x1A8u + 0x13Du) = 1u;

    /* Item 4: Assassin claw (1x3, type 0x43) */
    U32(ARENA_ITEMSTXT + 4u * 0x1A8u + 0x80u) = 0x20317468u;
    U32(ARENA_ITEMSTXT + 4u * 0x1A8u + 0xC0u) = 0x20317468u;
    U8(ARENA_ITEMSTXT + 4u * 0x1A8u + 0x10Fu) = 1u;
    U8(ARENA_ITEMSTXT + 4u * 0x1A8u + 0x110u) = 3u;
    U8(ARENA_ITEMSTXT + 4u * 0x1A8u + 0x115u) = 5u;
    U8(ARENA_ITEMSTXT + 4u * 0x1A8u + 0x11Cu) = 0u;
    U16(ARENA_ITEMSTXT + 4u * 0x1A8u + 0x11Eu) = 0x43u;

    /* Item 5: Shield (2x2, type 0x33) */
    U32(ARENA_ITEMSTXT + 5u * 0x1A8u + 0x80u) = 0x20637562u;
    U8(ARENA_ITEMSTXT + 5u * 0x1A8u + 0x10Fu) = 2u;
    U8(ARENA_ITEMSTXT + 5u * 0x1A8u + 0x110u) = 2u;
    U8(ARENA_ITEMSTXT + 5u * 0x1A8u + 0x115u) = 6u;
    U8(ARENA_ITEMSTXT + 5u * 0x1A8u + 0x11Cu) = 2u;
    U16(ARENA_ITEMSTXT + 5u * 0x1A8u + 0x11Eu) = 0x33u;

    /* Item 6: Quiver/Arrows (1x3, type 0x2E) */
    U32(ARENA_ITEMSTXT + 6u * 0x1A8u + 0x80u) = 0x20767161u;
    U8(ARENA_ITEMSTXT + 6u * 0x1A8u + 0x10Fu) = 1u;
    U8(ARENA_ITEMSTXT + 6u * 0x1A8u + 0x110u) = 3u;
    U16(ARENA_ITEMSTXT + 6u * 0x1A8u + 0x11Eu) = 0x2Eu;

    /* Item 7: Healing Potion (1x1, type 0x45, bAutoBelt=1) */
    U32(ARENA_ITEMSTXT + 7u * 0x1A8u + 0x80u) = 0x20317068u;
    U8(ARENA_ITEMSTXT + 7u * 0x1A8u + 0x10Fu) = 1u;
    U8(ARENA_ITEMSTXT + 7u * 0x1A8u + 0x110u) = 1u;
    U16(ARENA_ITEMSTXT + 7u * 0x1A8u + 0x11Eu) = 0x45u;
    U8(ARENA_ITEMSTXT + 7u * 0x1A8u + 0x131u) = 1u;

    /* Item 8: Mana Potion (1x1, type 0x46, bAutoBelt=1) */
    U32(ARENA_ITEMSTXT + 8u * 0x1A8u + 0x80u) = 0x2031706Du;
    U8(ARENA_ITEMSTXT + 8u * 0x1A8u + 0x10Fu) = 1u;
    U8(ARENA_ITEMSTXT + 8u * 0x1A8u + 0x110u) = 1u;
    U16(ARENA_ITEMSTXT + 8u * 0x1A8u + 0x11Eu) = 0x46u;
    U8(ARENA_ITEMSTXT + 8u * 0x1A8u + 0x131u) = 1u;

    /* Item 9: Scroll (1x1, type 0x47, bAutoBelt=0) */
    U32(ARENA_ITEMSTXT + 9u * 0x1A8u + 0x80u) = 0x20637369u;
    U8(ARENA_ITEMSTXT + 9u * 0x1A8u + 0x10Fu) = 1u;
    U8(ARENA_ITEMSTXT + 9u * 0x1A8u + 0x110u) = 1u;
    U16(ARENA_ITEMSTXT + 9u * 0x1A8u + 0x11Eu) = 0x47u;
    U8(ARENA_ITEMSTXT + 9u * 0x1A8u + 0x131u) = 0u;

    /* Item 10: Ring (1x1, type 0x0A) */
    U32(ARENA_ITEMSTXT + 10u * 0x1A8u + 0x80u) = 0x206E6972u;
    U8(ARENA_ITEMSTXT + 10u * 0x1A8u + 0x10Fu) = 1u;
    U8(ARENA_ITEMSTXT + 10u * 0x1A8u + 0x110u) = 1u;
    U16(ARENA_ITEMSTXT + 10u * 0x1A8u + 0x11Eu) = 0x0Au;

    /* Item 11: Belt (2x1, type 0x13, beltType=3 -> 16 boxes) */
    U32(ARENA_ITEMSTXT + 11u * 0x1A8u + 0x80u) = 0x206C6276u;
    U8(ARENA_ITEMSTXT + 11u * 0x1A8u + 0x10Fu) = 2u;
    U8(ARENA_ITEMSTXT + 11u * 0x1A8u + 0x110u) = 1u;
    U16(ARENA_ITEMSTXT + 11u * 0x1A8u + 0x11Eu) = 0x13u;
    U8(ARENA_ITEMSTXT + 11u * 0x1A8u + 0x130u) = 3u;

    /* Item 12: 2H weapon with 1H/2H disabled for barb (invWidth=1, b1or2H=0) */
    U32(ARENA_ITEMSTXT + 12u * 0x1A8u + 0x80u) = 0x20647773u;
    U8(ARENA_ITEMSTXT + 12u * 0x1A8u + 0x10Fu) = 2u;
    U8(ARENA_ITEMSTXT + 12u * 0x1A8u + 0x110u) = 3u;
    U8(ARENA_ITEMSTXT + 12u * 0x1A8u + 0x11Cu) = 1u;
    U16(ARENA_ITEMSTXT + 12u * 0x1A8u + 0x11Eu) = 0x1Eu;
    U8(ARENA_ITEMSTXT + 12u * 0x1A8u + 0x13Du) = 0u;

    /* Item 13: Helm (2x2, type 0x25) */
    U32(ARENA_ITEMSTXT + 13u * 0x1A8u + 0x80u) = 0x20706163u;
    U32(ARENA_ITEMSTXT + 13u * 0x1A8u + 0xD0u) = 15u;
    U8(ARENA_ITEMSTXT + 13u * 0x1A8u + 0x10Fu) = 2u;
    U8(ARENA_ITEMSTXT + 13u * 0x1A8u + 0x110u) = 2u;
    U16(ARENA_ITEMSTXT + 13u * 0x1A8u + 0x11Eu) = 0x25u;

    /* Fog sorted dwCode link table at ARENA_ITEMSLINK */
    U32(ARENA_ITEMSLINK + 0x00u) = 2u;
    U32(ARENA_ITEMSLINK + 0x08u) = ARENA_ITEMSLINK + 0x10u;
    U32(ARENA_ITEMSLINK + 0x10u) = 0x20706163u; U32(ARENA_ITEMSLINK + 0x14u) = 13u;
    U32(ARENA_ITEMSLINK + 0x18u) = 0x20736831u; U32(ARENA_ITEMSLINK + 0x1Cu) = 0u;

    U8(ARENA_ISC + 7u * 0x144u + 0x18u) = 8u;
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

static void setup_item_rec(uint32_t item, uint32_t id, uint32_t cls_id, uint32_t item_data, uint32_t inv) {
    U32(item + 0x00u) = 4u;
    U32(item + 0x04u) = cls_id;
    U32(item + 0x0Cu) = id;
    U32(item + 0x14u) = item_data;
    U32(item_data + 0x5Cu) = inv;
}

static void setup_inv_3grids(uint32_t inv, uint32_t owner, uint32_t grids, uint32_t c0, uint32_t c1, uint32_t c2) {
    U32(inv + 0x00u) = 0x01020304u;
    U32(inv + 0x04u) = 0u;
    U32(inv + 0x08u) = owner;
    U32(inv + 0x14u) = grids;
    U32(inv + 0x18u) = 3u;
    U32(inv + 0x1Cu) = 0xFFFFFFFFu;
    U8(grids + 0x00u + 0x08u) = 13u; U8(grids + 0x00u + 0x09u) = 1u; U32(grids + 0x00u + 0x0Cu) = c0;
    U8(grids + 0x10u + 0x08u) = 16u; U8(grids + 0x10u + 0x09u) = 1u; U32(grids + 0x10u + 0x0Cu) = c1;
    U8(grids + 0x20u + 0x08u) = 10u; U8(grids + 0x20u + 0x09u) = 4u; U32(grids + 0x20u + 0x0Cu) = c2;
}

static void emit_i12a_1(FILE *fp) {
    char args[512];
    int asserted = 0;
    uint32_t eax = 0;

    /* #01 0x6FD6F980 INVENTORY_CanDualWieldItems113c */
    for (int c = 0; c < 14; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = ((c >= 6 && c <= 8) || c == 13) ? 1u : 0u;
        U32(ARENA_UNIT0 + 0x04u) = (c == 6) ? 540u : (c == 7) ? 417u : (c == 8) ? 10u :
                                   (c == 13) ? 418u : (c == 3) ? 1u : (c == 4 || c == 5) ? 6u : 4u;
        uint32_t cls0 = (c == 1 || c == 2) ? 2u : (c == 4 || c == 7 || c == 13) ? 4u :
                        (c == 11) ? 12u : (c == 12) ? 6u : 0u;
        uint32_t cls1 = (c == 1) ? 6u : (c == 4 || c == 5 || c == 7 || c == 13) ? 4u :
                        (c == 9 || c == 10) ? 5u : (c == 12) ? 2u : 1u;
        if (c == 10) cls0 = 5u;
        if (c == 2) cls0 = 0u;
        if (c == 11) cls1 = 0u;
        setup_item_rec(ARENA_ITEM0, 1u, cls0, ARENA_ITEMDATA0, 0u);
        setup_item_rec(ARENA_ITEM1, 2u, cls1, ARENA_ITEMDATA1, 0u);
        uint32_t i1 = (c == 0) ? 0u : ARENA_ITEM0;
        uint32_t i2 = ARENA_ITEM1;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u},
            {ARENA_SGPT, 0xC78u}, {ARENA_ITEMSTXT, 0x1A00u}, {ARENA_ITEMTYPES, 0x5600u},
            {ARENA_ITYPEMAT, 0x500u}, {ARENA_UNIT0, 0xD0u}, {ARENA_ITEM0, 0x80u}, {ARENA_ITEM1, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 10);
        eax = safe_ebx_esi_edi(0x6FD6F980u, ARENA_UNIT0, i1, i2, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",\"0x%08X\"", ARENA_UNIT0, i1, i2);
        emit_rec(fp, "0x6FD6F980", "INVENTORY_CanDualWieldItems113c", c,
            c == 0 ? "null_item1_returns_1" : c == 1 ? "bow_and_quiver_returns_1" :
            c == 2 ? "barb_dual_swords_1" : c == 3 ? "sorc_dual_swords_0" :
            c == 4 ? "sin_dual_claws_1" : c == 5 ? "sin_sword_claw_0" :
            c == 6 ? "mon_540_dual_1" : c == 7 ? "mon_417_claws_1" :
            c == 8 ? "mon_10_dual_0" : c == 9 ? "weapon_and_shield_1" :
            c == 10 ? "two_shields_0" : c == 11 ? "barb_non1or2h_0" :
            c == 12 ? "quiver_and_bow_1" : "mon_418_claws_1",
            args, regs, 10, asserted, eax, 0xFFFFFFFFu);
    }

    /* #02 0x6FD700D0 INVENTORY_GetBeltAutoPlaceSlot113c */
    for (int c = 0; c < 8; c++) {
        setup_common_tables();
        setup_inv_3grids(ARENA_INV0, ARENA_UNIT0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
        U32(ARENA_UNIT0 + 0x00u) = 0u; U32(ARENA_UNIT0 + 0x60u) = ARENA_INV0;
        setup_item_rec(ARENA_ITEM0, 10u, (c == 1) ? 0u : (c == 2) ? 5u : (c == 4 || c == 7) ? 9u : 7u, ARENA_ITEMDATA0, 0u);
        setup_item_rec(ARENA_ITEM1, 11u, (c == 7) ? 9u : 8u, ARENA_ITEMDATA1, ARENA_INV0);
        setup_item_rec(ARENA_ITEM2, 12u, 11u, ARENA_ITEMDATA2, ARENA_INV0);
        if (c == 3) {
            U32(ARENA_CELLS0 + 8u * 4u) = ARENA_ITEM2; /* belt with 16 boxes */
            U32(ARENA_ITEM0 + 0x04u) = 8u; /* mp1 */
            U32(ARENA_CELLS1 + 0u) = ARENA_ITEM1; /* slot 0 has mp1 */
        } else if (c == 5) {
            U32(ARENA_CELLS1 + 0u) = ARENA_ITEM1; /* slot 0 has mp1, slot 1 free */
        } else if (c == 6) {
            for (uint32_t s = 0; s < 4u; s++) U32(ARENA_CELLS1 + s * 4u) = ARENA_ITEM1;
            U32(ARENA_ITEM1 + 0x04u) = 7u; /* compatible hp1, but default belt only has 4 boxes */
        } else if (c == 7) {
            U32(ARENA_CELLS0 + 8u * 4u) = ARENA_ITEM2; /* 16-box belt so slot 4..15 are valid */
            U32(ARENA_CELLS1 + 4u * 4u) = ARENA_ITEM1; /* slot 4 has scroll, cols 0..3 empty -> col<4 returns 0 */
        }
        uint32_t invArg = (c == 0) ? 0u : ARENA_INV0;
        U32(ARENA_OUT) = 0xDEADBEEFu;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u}, {0x6FDF13DCu, 4u}, {0x6FDED370u, 0x28u},
            {0x6FDEF068u, 0x48u},
            {ARENA_SGPT, 0xC78u}, {ARENA_ITEMSTXT, 0x1A00u}, {ARENA_ITEMTYPES, 0x5600u},
            {ARENA_BELTSTXT, 0x500u}, {ARENA_UNIT0, 0xD0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u},
            {ARENA_CELLS0, 0x40u}, {ARENA_CELLS1, 0x40u}, {ARENA_ITEM0, 0x80u}, {ARENA_ITEM1, 0x80u},
            {ARENA_ITEM2, 0x80u}, {ARENA_OUT, 0x10u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 19);
        eax = safe_stdcall3(0x6FD700D0u, invArg, ARENA_ITEM0, ARENA_OUT, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",\"0x%08X\"", invArg, ARENA_ITEM0, ARENA_OUT);
        emit_rec(fp, "0x6FD700D0", "INVENTORY_GetBeltAutoPlaceSlot113c", c,
            c == 0 ? "null_inv_0" : c == 1 ? "not_beltable_0" : c == 2 ? "non_1x1_0" :
            c == 3 ? "stacks_in_col0_slot4" : c == 4 ? "scroll_no_match_0" :
            c == 5 ? "potion_empty_slot1" : c == 6 ? "belt4_full_0" : "slot4_not_col_0",
            args, regs, 19, asserted, eax, 0xFFFFFFFFu);
    }

    /* #03 0x6FD70490 INVENTORY_GetSwapWeaponItem113c (retMask = 0) */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        setup_inv_3grids(ARENA_INV0, ARENA_UNIT0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
        U32(ARENA_UNIT0 + 0x00u) = 0u; U32(ARENA_UNIT0 + 0x04u) = 1u; U32(ARENA_UNIT0 + 0x60u) = ARENA_INV0;
        setup_item_rec(ARENA_ITEM0, 20u, 3u, ARENA_ITEMDATA0, ARENA_INV0); /* 2H sword on sorc */
        setup_item_rec(ARENA_ITEM1, 21u, 0u, ARENA_ITEMDATA1, ARENA_INV0);
        U32(ARENA_CELLS0 + 4u * 4u) = ARENA_ITEM0;
        U32(ARENA_CELLS0 + 5u * 4u) = ARENA_ITEM1;
        if (c == 4) {
            U32(ARENA_INV0 + 0x14u) = 0u;
            U32(ARENA_INV0 + 0x18u) = 0u;
        }
        U32(ARENA_OUT) = (c == 2) ? 0x12345678u : 0u;
        uint32_t invArg = (c == 3) ? 0u : ARENA_INV0;
        uint32_t loc = (c == 1) ? 5u : (c == 4) ? 0u : 4u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u}, {0x6FDED370u, 0x28u},
            {ARENA_SGPT, 0xC78u}, {ARENA_ITEMSTXT, 0x1A00u}, {ARENA_ITEMTYPES, 0x5600u}, {ARENA_ITYPEMAT, 0x500u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u}, {ARENA_CELLS0, 0x40u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEM1, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_ITEMDATA1, 0x80u},
            {ARENA_OUT, 0x10u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 17);
        eax = safe_stdcall4(0x6FD70490u, ARENA_UNIT0, invArg, ARENA_OUT, loc, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",\"0x%08X\",%u", ARENA_UNIT0, invArg, ARENA_OUT, loc);
        emit_rec(fp, "0x6FD70490", "INVENTORY_GetSwapWeaponItem113c", c,
            c == 0 ? "loc4_2h_writes_loc5" : c == 1 ? "loc5_2h_writes_loc4" :
            c == 2 ? "already_set_noop" : c == 3 ? "null_inv_noop" : "loc0_inits_grid0",
            args, regs, 17, asserted, eax, 0x00000000u);
    }

    /* #04 0x6FD708E0 INVENTORY_GetFreePosition113c */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        setup_inv_3grids(ARENA_INV0, ARENA_UNIT0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
        U32(ARENA_UNIT0 + 0x00u) = (c == 4) ? 1u : 0u; /* player vs monster col-major */
        uint32_t cls = (c == 1) ? 7u : (c == 2) ? 5u : (c == 3) ? 0u : 2u; /* 1x1, 2x2, 1x3, 2x4 */
        setup_item_rec(ARENA_ITEM0, 30u, cls, ARENA_ITEMDATA0, 0u);
        if (c == 5) {
            for (uint32_t k = 0; k < 40u; k++) U32(ARENA_CELLS2 + k * 4u) = ARENA_ITEM1;
        }
        uint32_t invArg = (c == 0) ? 0u : ARENA_INV0;
        U32(ARENA_OUT) = 0xFFFFFFFFu; U32(ARENA_OUT + 4u) = 0xFFFFFFFFu;
        mem_region_t regs[] = {
            {0x6FDEFB94u, 8u}, {0x6FDEFA58u, 8u}, {ARENA_ITEMSTXT, 0x1A00u}, {ARENA_INVTXT, 0x1000u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u}, {ARENA_CELLS2, 0x100u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_OUT, 0x10u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 11);
        eax = safe_stdcall6(0x6FD708E0u, invArg, ARENA_ITEM0, 0u, ARENA_OUT, ARENA_OUT + 4u, 0u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",0,\"0x%08X\",\"0x%08X\",0", invArg, ARENA_ITEM0, ARENA_OUT, ARENA_OUT + 4u);
        emit_rec(fp, "0x6FD708E0", "INVENTORY_GetFreePosition113c", c,
            c == 0 ? "null_inv_0" : c == 1 ? "mode3_1x1" : c == 2 ? "mode1_2x2" :
            c == 3 ? "mode2_1x3" : c == 4 ? "mode0_2x4_mon" : "full_grid_0",
            args, regs, 11, asserted, eax, 0xFFFFFFFFu);
    }
    /* #05 0x6FD717F0 INVENTORY_PlaceItemInSocket113c */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = 0u; /* player owner */
        setup_item_rec(ARENA_ITEM0, 40u, 5u, ARENA_ITEMDATA0, 0u);
        setup_item_rec(ARENA_ITEM1, 41u, 7u, ARENA_ITEMDATA1, 0u);
        U32(ARENA_ITEM1 + 0x2Cu) = ARENA_PATH0;
        setup_inv_3grids(ARENA_INV0, (c == 4) ? 0u : (c == 1) ? ARENA_UNIT0 : ARENA_ITEM0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
        U32(ARENA_INV0 + 0x28u) = 2u;
        uint32_t invArg = (c == 0) ? 0u : ARENA_INV0;
        uint32_t itmArg = (c == 3) ? 0u : ARENA_ITEM1;
        mem_region_t regs[] = {
            {0x6FDD9088u, 0xACu}, {ARENA_UNIT0, 0xD0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_ITEM1, 0x80u},
            {ARENA_ITEMDATA1, 0x80u}, {ARENA_PATH0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
        eax = safe_stdcall3(0x6FD717F0u, invArg, itmArg, 0u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",0", invArg, itmArg);
        emit_rec(fp, "0x6FD717F0", "INVENTORY_PlaceItemInSocket113c", c,
            c == 0 ? "null_inv_0" : c == 1 ? "player_owner_noop_1" :
            c == 2 ? "item_owner_links_socket_1" : c == 3 ? "null_item_0" : "null_owner_1",
            args, regs, 9, asserted, eax, 0xFFFFFFFFu);
    }

    /* #06 0x6FD718A0 INVENTORY_PlaceItemInGridPage113c */
    for (int c = 0; c < 9; c++) {
        setup_common_tables();
        setup_inv_3grids(ARENA_INV0, ARENA_UNIT0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
        U32(ARENA_UNIT0 + 0x00u) = 0u; U32(ARENA_UNIT0 + 0x0Cu) = 0x777u; U32(ARENA_UNIT0 + 0x60u) = ARENA_INV0;
        uint32_t cls = (c == 1 || c == 5 || c == 6) ? 5u : (c == 4) ? 7u : 0u; /* 2x2 or 1x1 or 1x3 */
        setup_item_rec(ARENA_ITEM0, 50u, cls, ARENA_ITEMDATA0, 0u);
        U32(ARENA_ITEM0 + 0x2Cu) = ARENA_PATH0;
        if (c == 6) U32(ARENA_CELLS2 + (1u * 10u + 1u) * 4u) = ARENA_ITEM1;
        if (c == 7) {
            U32(ARENA_ITEM0 + 0x10u) = 3u; /* onground */
            U32(ARENA_ITEM0 + 0xC8u) = 0x04000000u; /* portal bit */
            U32(ARENA_PATH0 + 0x00u) = ARENA_ROOM0;
            U32(ARENA_PATH0 + 0x0Cu) = 4u;
            U32(ARENA_PATH0 + 0x10u) = 5u;
            setup_room_coll(ARENA_ROOM0, ARENA_COLL0, ARENA_COLLMAP0);
            U32(ARENA_ROOM0 + 0x2Cu) = ARENA_ACT0;
            U32(ARENA_ROOM0 + 0x74u) = ARENA_ITEM0;
        }
        uint32_t invArg = (c == 0) ? 0u : ARENA_INV0;
        uint32_t itmArg = (c == 8) ? 0u : ARENA_ITEM0;
        uint32_t px = (c == 2) ? 4u : (c == 3) ? 11u : (c == 4) ? 2u : (c == 5) ? 9u : 1u;
        uint32_t py = (c == 1 || c == 5 || c == 6 || c == 7) ? 1u : 0u;
        uint32_t pg = (c == 2 || c == 3) ? 0u : (c == 4) ? 1u : 2u;
        mem_region_t regs[] = {
            {0x6FDEFB94u, 8u}, {0x6FDEFA58u, 8u}, {0x6FDED370u, 0x28u}, {0x6FDD9088u, 0xACu}, {0x6FDD9388u, 0x68u},
            {ARENA_SGPT, 0xC78u}, {ARENA_ITEMSTXT, 0x1A00u}, {ARENA_INVTXT, 0x1000u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u},
            {ARENA_CELLS0, 0x40u}, {ARENA_CELLS1, 0x40u}, {ARENA_CELLS2, 0x100u},
            {ARENA_ITEM0, 0xF4u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_PATH0, 0x40u},
            {ARENA_ROOM0, 0x80u}, {ARENA_ACT0, 0x80u}, {ARENA_COLL0, 0x40u}, {ARENA_COLLMAP0, 0x200u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 21);
        eax = safe_eax_edi_stack4(0x6FD718A0u, invArg, itmArg, px, py, pg, 0u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",%u,%u,%u,0", invArg, itmArg, px, py, pg);
        emit_rec(fp, "0x6FD718A0", "INVENTORY_PlaceItemInGridPage113c", c,
            c == 0 ? "null_inv_0" : c == 1 ? "page2_places_2x2" : c == 2 ? "page0_loc4_other3" :
            c == 3 ? "page0_loc11_other4" : c == 4 ? "page1_belt2_other2" :
            c == 5 ? "page2_oob_0" : c == 6 ? "page2_occupied_0" :
            c == 7 ? "onground_room_portal_unlink" : "null_item_0",
            args, regs, 21, asserted, eax, 0xFFFFFFFFu);
    }

    /* #07 0x6FD71B40 INVENTORY_FreeInventory113c (retMask = 0) */
    for (int c = 0; c < 2; c++) {
        setup_common_tables();
        setup_inv_3grids(ARENA_INV0, ARENA_UNIT0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
        U32(ARENA_UNIT0 + 0x60u) = ARENA_INV0;
        setup_item_rec(ARENA_ITEM0, 60u, 7u, ARENA_ITEMDATA0, ARENA_INV0);
        setup_item_rec(ARENA_ITEM1, 61u, 7u, ARENA_ITEMDATA1, ARENA_INV0);
        U32(ARENA_ITEM0 + 0x2Cu) = ARENA_PATH0;
        U32(ARENA_ITEM1 + 0x2Cu) = ARENA_PATH1;
        U8(ARENA_ITEMDATA1 + 0x5Cu + 0x0Cu) = 3u; /* grid 2 + 1 */
        U32(ARENA_INV0 + 0x0Cu) = ARENA_ITEM1;
        U32(ARENA_INV0 + 0x10u) = ARENA_ITEM1;
        U32(ARENA_INV0 + 0x20u) = ARENA_ITEM0; /* cursor item */
        U32(ARENA_INV0 + 0x2Cu) = ARENA_NODE0;
        U32(ARENA_INV0 + 0x34u) = ARENA_CORPSE0;
        uint32_t invArg = (c == 0) ? 0u : ARENA_INV0;
        mem_region_t regs[] = {
            {0x6FDEFB94u, 8u}, {ARENA_ITEMSTXT, 0x1A00u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x30u},
            {ARENA_CELLS0, 0x40u}, {ARENA_CELLS1, 0x40u}, {ARENA_CELLS2, 0x100u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_ITEM1, 0x80u},
            {ARENA_ITEMDATA1, 0x80u}, {ARENA_PATH0, 0x40u}, {ARENA_PATH1, 0x40u},
            {ARENA_NODE0, 0x10u}, {ARENA_CORPSE0, 0x10u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 16);
        eax = safe_stdcall1(0x6FD71B40u, invArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", invArg);
        emit_rec(fp, "0x6FD71B40", "INVENTORY_FreeInventory113c", c,
            c == 0 ? "null_inv_noop" : "frees_all_lists_and_clears_owner",
            args, regs, 16, asserted, eax, 0x00000000u);
    }

    /* #08 0x6FD819C0 UNITS_TestCollisionBetweenUnits113c */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        setup_room_coll(ARENA_ROOM0, ARENA_COLL0, ARENA_COLLMAP0);
        U32(ARENA_MONSTATS + 0x14u) = 0u;
        U8(ARENA_MONSTATS2 + 0x08u) = 1u;
        U32(ARENA_UNIT0 + 0x00u) = (c == 4) ? 4u : (c == 5) ? 5u : 1u;
        U32(ARENA_UNIT0 + 0x10u) = 1u;
        U32(ARENA_UNIT0 + 0x2Cu) = ARENA_PATH0;
        U32(ARENA_UNIT1 + 0x00u) = (c == 4) ? 2u : (c == 5) ? 5u : 1u;
        U32(ARENA_UNIT1 + 0x10u) = 1u;
        U32(ARENA_UNIT1 + 0x2Cu) = ARENA_PATH1;
        if (c == 4 || c == 5) {
            if (c == 4) {
                U32(ARENA_UNIT1 + 0x14u) = ARENA_BASE + 0x9C00u;
                U32(ARENA_BASE + 0x9C00u) = ARENA_BASE + 0x9E00u;
                U8(ARENA_BASE + 0x9E00u + 0x13Au) = 1u;
                U8(ARENA_BASE + 0x9E00u + 0x13Bu) = 1u;
            }
            U32(ARENA_PATH0 + 0x00u) = ARENA_ROOM0; U32(ARENA_PATH0 + 0x0Cu) = 2u; U32(ARENA_PATH0 + 0x10u) = 2u;
            U32(ARENA_PATH1 + 0x00u) = ARENA_ROOM0; U32(ARENA_PATH1 + 0x0Cu) = (c == 5) ? 2u : 6u; U32(ARENA_PATH1 + 0x10u) = 2u;
            if (c == 5) {
                U16(ARENA_PATH1 + 0x06u) = 8u; /* traps wrong dynamic y2 read */
                U16(ARENA_COLLMAP0 + (2u * 10u + 1u) * 2u) = 0x0001u; /* blocks (0,2)->(2,2) */
                U16(ARENA_COLLMAP0 + (5u * 10u + 2u) * 2u) = 0x0001u; /* blocks (2,2)->(2,8) */
            }
        } else {
            U16(ARENA_PATH0 + 0x02u) = 2u; U16(ARENA_PATH0 + 0x06u) = 2u;
            U32(ARENA_PATH0 + 0x1Cu) = (c == 1) ? 0u : ARENA_ROOM0;
            U16(ARENA_PATH1 + 0x02u) = 6u; U16(ARENA_PATH1 + 0x06u) = 2u;
            U32(ARENA_PATH1 + 0x1Cu) = ARENA_ROOM0;
        }
        if (c == 3) U16(ARENA_COLLMAP0 + (2u * 10u + 4u) * 2u) = 0x0001u;
        uint32_t u1Arg = (c == 0) ? 0u : ARENA_UNIT0;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDD9388u, 0x68u},
            {ARENA_SGPT, 0xC78u}, {ARENA_MONSTATS, 0x200u}, {ARENA_MONSTATS2, 0x200u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_UNIT1, 0xD0u}, {ARENA_PATH0, 0x60u}, {ARENA_PATH1, 0x60u},
            {ARENA_ROOM0, 0x80u}, {ARENA_COLL0, 0x40u}, {ARENA_COLLMAP0, 0x200u},
            {ARENA_BASE + 0x9C00u, 0x20u}, {ARENA_BASE + 0x9E00u, 0x150u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 15);
        eax = safe_stdcall3(0x6FD819C0u, u1Arg, ARENA_UNIT1, 1u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",1", u1Arg, ARENA_UNIT1);
        emit_rec(fp, "0x6FD819C0", "UNITS_TestCollisionBetweenUnits113c", c,
            c == 0 ? "null_unit_0" : c == 1 ? "null_room_0" : c == 2 ? "dyn_clear_0" :
            c == 3 ? "dyn_blocked_nonzero" : c == 4 ? "static_item_object_clear" : "static_missile_overlap",
            args, regs, 15, asserted, eax, 0xFFFFFFFFu);
    }

    /* #09 0x6FD82460 UNITS_AdvanceAnimFrame113c (retMask = 0) */
    for (int c = 0; c < 3; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = 1u; /* monster */
        U32(ARENA_UNIT0 + 0x04u) = 0u;
        U32(ARENA_UNIT0 + 0x10u) = 1u;
        U8(ARENA_UNIT0 + 0x4Eu) = 9u;
        if (c == 0) {
            U32(ARENA_UNIT0 + 0x30u) = ARENA_SEQREC0;
            U32(ARENA_UNIT0 + 0x34u) = 0x0A00u;
            U32(ARENA_UNIT0 + 0x38u) = 0x0800u;
            U32(ARENA_UNIT0 + 0x3Cu) = 0x0400u;
            U32(ARENA_UNIT0 + 0x48u) = 0x1000u;
            U8(ARENA_SEQREC0 + 2u * 6u + 0u) = 1u;
            U8(ARENA_SEQREC0 + 2u * 6u + 1u) = 2u;
            U8(ARENA_SEQREC0 + 2u * 6u + 2u) = 3u;
        } else {
            U32(ARENA_UNIT0 + 0x30u) = 0u;
            U32(ARENA_UNIT0 + 0x44u) = (c == 1) ? 0x0100u : 0x0480u;
            U32(ARENA_UNIT0 + 0x48u) = 0x0500u;
            U16(ARENA_UNIT0 + 0x4Cu) = 0x0100u;
            U32(ARENA_UNIT0 + 0x50u) = ARENA_ANIMDATA0;
            U8(ARENA_ANIMDATA0 + 0x10u + 2u) = 2u;
            U8(ARENA_ANIMDATA0 + 0x10u + 4u) = 3u;
        }
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {ARENA_SGPT, 0xC78u}, {ARENA_UNIT0, 0xD0u},
            {ARENA_SEQREC0, 0x80u}, {ARENA_ANIMDATA0, 0x100u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 5);
        eax = safe_stdcall1(0x6FD82460u, ARENA_UNIT0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
        emit_rec(fp, "0x6FD82460", "UNITS_AdvanceAnimFrame113c", c,
            c == 0 ? "seq_mode_wraps_sets_flag" : c == 1 ? "normal_sets_action2" : "normal_wraps_frameMax",
            args, regs, 5, asserted, eax, 0x00000000u);
    }
    /* #10..#15 ItemMods.cpp property applicators (I12A-1) */
    {
        static const uint32_t vas[6] = {
            0x6FD98100u, 0x6FD98190u, 0x6FD98220u, 0x6FD982B0u, 0x6FD98470u, 0x6FD984F0u
        };
        static const char *va_strs[6] = {
            "0x6FD98100", "0x6FD98190", "0x6FD98220", "0x6FD982B0", "0x6FD98470", "0x6FD984F0"
        };
        static const char *names[6] = {
            "ITEMMODS_ApplyPropertySkillOnHit113c",
            "ITEMMODS_ApplyPropertyAura113c",
            "ITEMMODS_ApplyPropertyClassSkill113c",
            "ITEMMODS_ApplyPropertySingleSkill113c",
            "ITEMMODS_ApplyPropertyClassSkillTab113c",
            "ITEMMODS_ApplyPropertySimpleStat113c"
        };
        for (int p = 0; p < 6; p++) {
            for (int c = 0; c < 4; c++) {
                setup_common_tables();
                U32(ARENA_ITEM0 + 0x00u) = 4u;
                U32(ARENA_ITEM0 + 0x0Cu) = 77u;
                U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
                U32(ARENA_ITEM0 + 0x5Cu) = ARENA_STATLIST0;
                U32(ARENA_ITEMDATA0 + 0x04u) = 0x13572468u;
                U32(ARENA_ITEMDATA0 + 0x08u) = 0x24681357u;
                U32(ARENA_UNIT0 + 0x00u) = 1u;
                U32(ARENA_UNIT0 + 0x20u) = 0x89ABCDEFu;
                U32(ARENA_UNIT0 + 0x24u) = 0x10203040u;
                U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST1;
                U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
                U32(ARENA_STATLIST1 + 0x10u) = 0x80000000u;
                S32(ARENA_PROPENTRY + 0x04u) = (p == 4 && c == 3) ? 10 : 7;
                S32(ARENA_PROPENTRY + 0x08u) = (c == 1) ? 5 : (c == 2) ? 3 : (p == 4 && c == 3) ? 0 : 10;
                S32(ARENA_PROPENTRY + 0x0Cu) = (c == 1) ? 5 : (c == 2) ? 12 : (p == 4 && c == 3) ? 0 : 2;
                uint32_t propArg = (c == 0) ? 0u : ARENA_PROPENTRY;
                uint32_t unitArg = (c == 3 && p < 4) ? ARENA_UNIT0 : ARENA_ITEM0;
                uint32_t valArg = (p >= 4 && c == 1) ? 9u : 0u;
                uint32_t paramArg = 4u;
                uint32_t statId = (p == 0) ? 0xC6u : (p == 1) ? 0x97u : (p == 2) ? 0x53u :
                                  (p == 3) ? 0x6Bu : (p == 4) ? 0xBCu : 0x6Cu;
                mem_region_t regs[] = {
                    {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu},
                    {ARENA_SGPT, 0xC78u}, {ARENA_ISC, 0x1000u}, {ARENA_ISC + statId * 0x144u, 0x144u},
                    {ARENA_PROPENTRY, 0x20u},
                    {ARENA_UNIT0, 0xD0u}, {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u},
                    {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}
                };
                capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 11);
                eax = safe_ecx_edx_stack9(vas[p], 0u, ARENA_ITEM0, unitArg, propArg, 0u, statId,
                    paramArg, valArg, 0u, 0x40u, 0u, &asserted);
                snprintf(args, sizeof(args), "0,\"0x%08X\",\"0x%08X\",\"0x%08X\",0,%u,%u,%u,0,64,0",
                    ARENA_ITEM0, unitArg, propArg, statId, paramArg, valArg);
                emit_rec(fp, va_strs[p], names[p], c,
                    c == 0 ? "null_prop_0" : c == 1 ? "fixed_range_or_val" :
                    c == 2 ? "rolls_min_max_item" : "rolls_nonitem_or_zero",
                    args, regs, 11, asserted, eax, 0xFFFFFFFFu);
            }
        }
    }
}

static void emit_i12a_2(FILE *fp) {
    char args[512];
    int asserted = 0;
    uint32_t eax = 0;

    /* #01 0x6FD70A30 INVENTORY_ReserveGridFreePosition113c */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        setup_inv_3grids(ARENA_INV0, ARENA_UNIT0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
        U32(ARENA_UNIT0 + 0x00u) = 0u;
        setup_item_rec(ARENA_ITEM0, 100u, (c == 3) ? 7u : 5u, ARENA_ITEMDATA0, 0u); /* 1x1 or 2x2 */
        if (c == 2) {
            for (uint32_t k = 0; k < 40u; k++) U32(ARENA_CELLS2 + k * 4u) = ARENA_ITEM1;
        }
        uint32_t invArg = (c == 0) ? 0u : ARENA_INV0;
        mem_region_t regs[] = {
            {0x6FDEFB94u, 8u}, {0x6FDEFA58u, 8u}, {0x6FDEEFE4u, 0x40u},
            {ARENA_ITEMSTXT, 0x1A00u}, {ARENA_INVTXT, 0x1000u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u}, {ARENA_CELLS2, 0x100u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 11);
        eax = safe_eax_stack2(0x6FD70A30u, invArg, ARENA_UNIT0, ARENA_ITEM0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",\"0x%08X\"", invArg, ARENA_UNIT0, ARENA_ITEM0);
        emit_rec(fp, "0x6FD70A30", "INVENTORY_ReserveGridFreePosition113c", c,
            c == 0 ? "null_inv_0" : c == 1 ? "reserves_2x2_neg1" :
            c == 2 ? "full_grid_0" : "reserves_1x1_neg1",
            args, regs, 11, asserted, eax, 0xFFFFFFFFu);
    }

    /* #02 0x6FD70B50 INVENTORY_CanBodyLocFitInGrid113c */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        setup_inv_3grids(ARENA_INV0, ARENA_UNIT0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
        setup_item_rec(ARENA_ITEM0, 110u, 5u, ARENA_ITEMDATA0, ARENA_INV0); /* 2x2 */
        setup_item_rec(ARENA_ITEM1, 111u, 0u, ARENA_ITEMDATA1, 0u);
        if (c == 4) U32(ARENA_CELLS0 + 13u * 4u) = ARENA_ITEM0;
        else if (c != 1) U32(ARENA_CELLS0 + 5u * 4u) = ARENA_ITEM0;
        if (c == 3) {
            for (uint32_t k = 0; k < 40u; k++) U32(ARENA_CELLS2 + k * 4u) = ARENA_ITEM1;
        }
        uint32_t invArg = (c == 0) ? 0u : ARENA_INV0;
        uint32_t loc = (c == 4) ? 0x0Du : 5u;
        mem_region_t regs[] = {
            {0x6FDEFB94u, 8u}, {0x6FDEFA58u, 8u}, {0x6FDED370u, 0x28u},
            {ARENA_ITEMSTXT, 0x1A00u}, {ARENA_INVTXT, 0x1000u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u},
            {ARENA_CELLS0, 0x40u}, {ARENA_CELLS2, 0x100u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_ITEM1, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 13);
        eax = safe_stdcall4(0x6FD70B50u, invArg, ARENA_ITEM1, loc, 0u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",%u,0", invArg, ARENA_ITEM1, loc);
        emit_rec(fp, "0x6FD70B50", "INVENTORY_CanBodyLocFitInGrid113c", c,
            c == 0 ? "null_inv_0" : c == 1 ? "empty_bodyloc_0" : c == 2 ? "fits_1" :
            c == 3 ? "grid_full_0" : "oob_loc_0",
            args, regs, 13, asserted, eax, 0xFFFFFFFFu);
    }

    /* #03 0x6FD70D20 INVENTORY_CheckGrid2ItemsFitClone113c */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        setup_inv_3grids(ARENA_INV0, ARENA_UNIT0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
        setup_inv_3grids(ARENA_INV1, ARENA_UNIT1, ARENA_GRIDS1, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS3);
        U32(ARENA_UNIT0 + 0x00u) = 0u;
        U32(ARENA_UNIT0 + 0x60u) = (c == 0) ? 0u : ARENA_INV0;
        U32(ARENA_UNIT1 + 0x00u) = 0u;
        U32(ARENA_UNIT1 + 0x60u) = ARENA_INV1;
        setup_item_rec(ARENA_ITEM0, 120u, 5u, ARENA_ITEMDATA0, ARENA_INV0); /* 2x2 */
        U8(ARENA_ITEMDATA0 + 0x45u) = (c == 3) ? 0u : 2u; /* nInvPage */
        U32(ARENA_ITEMDATA0 + 0x54u) = 0xDEADBEEFu;
        U32(ARENA_ITEM1 + 0x00u) = 1u; /* non-item unit for c==4 */
        U32(ARENA_INV0 + 0x0Cu) = (c == 4) ? ARENA_ITEM1 : ARENA_ITEM0;
        if (c == 2) {
            for (uint32_t k = 0; k < 40u; k++) U32(ARENA_CELLS3 + k * 4u) = ARENA_ITEM1;
        }
        mem_region_t regs[] = {
            {0x6FDEFB94u, 8u}, {0x6FDEFA58u, 8u}, {0x6FDEEFE4u, 0x40u},
            {ARENA_ITEMSTXT, 0x1A00u}, {ARENA_INVTXT, 0x1000u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_UNIT1, 0xD0u},
            {ARENA_INV0, 0x40u}, {ARENA_INV1, 0x40u},
            {ARENA_GRIDS0, 0x40u}, {ARENA_GRIDS1, 0x40u}, {ARENA_CELLS3, 0x100u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_ITEM1, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 15);
        eax = safe_eax_edi_stack1(0x6FD70D20u, ARENA_UNIT0, ARENA_INV1, ARENA_UNIT1, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",\"0x%08X\"", ARENA_UNIT0, ARENA_INV1, ARENA_UNIT1);
        emit_rec(fp, "0x6FD70D20", "INVENTORY_CheckGrid2ItemsFitClone113c", c,
            c == 0 ? "null_inv_1" : c == 1 ? "page2_fits_1" : c == 2 ? "page2_full_0" :
            c == 3 ? "non_page2_skipped_1" : "non_item_node_skipped_1",
            args, regs, 15, asserted, eax, 0xFFFFFFFFu);
    }

    /* #04 0x6FD70DB0 INVENTORY_CanAutoEquipToBodyLoc113c (covers all 8 return values 0..7) */
    for (int c = 0; c < 8; c++) {
        setup_common_tables();
        setup_inv_3grids(ARENA_INV0, ARENA_UNIT0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
        U32(ARENA_UNIT0 + 0x00u) = 0u;
        U32(ARENA_UNIT0 + 0x04u) = (c == 5) ? 4u : 1u; /* barb for dual wield (5), sorc otherwise */
        U32(ARENA_UNIT0 + 0x60u) = ARENA_INV0;
        setup_item_rec(ARENA_ITEM0, 130u, 0u, ARENA_ITEMDATA0, ARENA_INV0); /* pItemA: 1H sword */
        setup_item_rec(ARENA_ITEM1, 131u, (c == 4) ? 2u : 0u, ARENA_ITEMDATA1, ARENA_INV0); /* pItemB: bow(2H) or 1H */
        setup_item_rec(ARENA_ITEM2, 132u, (c == 6) ? 0u : 1u, ARENA_ITEMDATA2, 0u); /* pItemNew */
        if (c == 6) {
            U8(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x132u) = 1u;
            U32(ARENA_ITEMDATA0 + 0x00u) = 2u;
            U32(ARENA_ITEMDATA2 + 0x00u) = 2u;
            U8(ARENA_ITEMTYPES + 0x1Eu * 0xE4u + 0x11u) = 1u; /* nReload = 1 */
        }
        uint32_t itemA = (c == 3 || c == 5 || c == 6 || c == 7) ? ARENA_ITEM0 : 0u;
        uint32_t itemB = (c == 2 || c == 4 || c == 5 || c == 7) ? ARENA_ITEM1 : 0u;
        uint32_t itemNew = (c == 0 || c == 3 || c == 4) ? 0u : ARENA_ITEM2;
        if (c == 7) U32(ARENA_CELLS0 + 5u * 4u) = ARENA_ITEM1;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u}, {0x6FDEFA58u, 8u},
            {0x6FDED370u, 0x28u}, {0x6FDEEFE4u, 0x40u},
            {ARENA_SGPT, 0xC78u}, {ARENA_ITEMSTXT, 0x1A00u}, {ARENA_ITEMTYPES, 0x5600u},
            {ARENA_ITYPEMAT, 0x500u}, {ARENA_INVTXT, 0x1000u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u},
            {ARENA_CELLS0, 0x40u}, {ARENA_CELLS2, 0x100u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u},
            {ARENA_ITEM1, 0x80u}, {ARENA_ITEMDATA1, 0x80u},
            {ARENA_ITEM2, 0x80u}, {ARENA_ITEMDATA2, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 22);
        eax = safe_eax_ecx_edx_stack2(0x6FD70DB0u, itemA, itemB, itemNew, ARENA_UNIT0, 5u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",\"0x%08X\",\"0x%08X\",5", itemA, itemB, itemNew, ARENA_UNIT0);
        emit_rec(fp, "0x6FD70DB0", "INVENTORY_CanAutoEquipToBodyLoc113c", c,
            c == 0 ? "ret_0" : c == 1 ? "ret_1" : c == 2 ? "ret_2" : c == 3 ? "ret_3" :
            c == 4 ? "ret_4" : c == 5 ? "ret_5" : c == 6 ? "ret_6" : "ret_7",
            args, regs, 22, asserted, eax, 0xFFFFFFFFu);
    }
    /* #05 0x6FD711D0 INVENTORY_CanAutoEquipItem113c */
    for (int c = 0; c < 10; c++) {
        setup_common_tables();
        setup_inv_3grids(ARENA_INV0, ARENA_UNIT0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
        U32(ARENA_UNIT0 + 0x00u) = 0u;
        U32(ARENA_UNIT0 + 0x04u) = 1u;
        U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
        U32(ARENA_UNIT0 + 0x60u) = ARENA_INV0;
        U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
        U32(ARENA_STATLIST0 + 0x24u) = ARENA_STATS0;
        U16(ARENA_STATLIST0 + 0x28u) = 3u; U16(ARENA_STATLIST0 + 0x2Au) = 8u;
        U32(ARENA_STATLIST0 + 0x48u) = ARENA_STATS0;
        U16(ARENA_STATLIST0 + 0x4Cu) = 3u; U16(ARENA_STATLIST0 + 0x4Eu) = 8u;
        U32(ARENA_STATS0 + 0x00u) = 0x00000000u; S32(ARENA_STATS0 + 0x04u) = 30;
        U32(ARENA_STATS0 + 0x08u) = 0x00020000u; S32(ARENA_STATS0 + 0x0Cu) = 30;
        U32(ARENA_STATS0 + 0x10u) = 0x000C0000u; S32(ARENA_STATS0 + 0x14u) = 30;
        uint32_t cls = (c == 5 || c == 9) ? 10u : (c == 6 || c == 7) ? 13u : 0u; /* ring=10, helm=13, sword=0 */
        setup_item_rec(ARENA_ITEM0, 140u, cls, ARENA_ITEMDATA0, 0u);
        setup_item_rec(ARENA_ITEM1, 141u, cls, ARENA_ITEMDATA1, ARENA_INV0);
        U32(ARENA_ITEMDATA0 + 0x18u) = 0x10u; /* IFLAG_IDENTIFIED */
        U32(ARENA_ITEMDATA1 + 0x18u) = 0x10u;
        if (c == 3) U16(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x10Au) = 99u; /* reqStr=99 fails */
        if (c == 7) U32(ARENA_CELLS0 + 1u * 4u) = ARENA_ITEM1; /* helm occupied */
        if (c == 9) U32(ARENA_CELLS0 + 11u * 4u) = ARENA_ITEM1; /* ring1 occupied, ring2 free -> returns 2 */
        uint32_t unitArg = (c == 0) ? 0u : ARENA_UNIT0;
        uint32_t loc = (c == 1 || c == 8) ? 0u : (c == 2) ? 1u : (c == 5 || c == 9) ? 11u : (c == 6 || c == 7) ? 1u : 4u;
        uint32_t itmArg = (c == 7 || c == 8) ? 0u : ARENA_ITEM0;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u}, {0x6FDEFA58u, 8u},
            {0x6FDED370u, 0x28u}, {0x6FDEEFE4u, 0x40u}, {0x6FDF1F10u, 4u},
            {ARENA_SGPT, 0xC78u}, {ARENA_ISC, 0x1200u}, {ARENA_ITEMSTXT, 0x1A00u}, {ARENA_ITEMTYPES, 0x5600u},
            {ARENA_ITYPEMAT, 0x500u}, {ARENA_INVTXT, 0x1000u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x40u},
            {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u},
            {ARENA_CELLS0, 0x40u}, {ARENA_CELLS2, 0x100u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_ITEM1, 0x80u}, {ARENA_ITEMDATA1, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 24);
        eax = safe_stdcall4(0x6FD711D0u, unitArg, loc, itmArg, 0u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",%u,\"0x%08X\",0", unitArg, loc, itmArg);
        emit_rec(fp, "0x6FD711D0", "INVENTORY_CanAutoEquipItem113c", c,
            c == 0 ? "null_unit_0" : c == 1 ? "loc0_0" : c == 2 ? "wrong_loc_0" :
            c == 3 ? "req_fail_0" : c == 4 ? "loc4_empty_1" : c == 5 ? "loc11_ring_1" :
            c == 6 ? "loc1_helm_empty_1" : c == 7 ? "loc1_remove_3" :
            c == 8 ? "loc0_null_item_0" : "loc11_ring_swap_2",
            args, regs, 24, asserted, eax, 0xFFFFFFFFu);
    }

    /* #06 0x6FD71C50 INVENTORY_CanTradeInventoriesSwap113c */
    for (int c = 0; c < 3; c++) {
        setup_common_tables();
        setup_inv_3grids(ARENA_INV0, ARENA_UNIT0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
        setup_inv_3grids(ARENA_INV1, ARENA_UNIT1, ARENA_GRIDS1, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS3);
        U32(ARENA_UNIT0 + 0x00u) = 0u; U32(ARENA_UNIT0 + 0x60u) = ARENA_INV0;
        U32(ARENA_UNIT1 + 0x00u) = 0u; U32(ARENA_UNIT1 + 0x60u) = ARENA_INV1;
        setup_item_rec(ARENA_ITEM0, 150u, 5u, ARENA_ITEMDATA0, ARENA_INV0); /* 2x2 */
        U8(ARENA_ITEMDATA0 + 0x45u) = 2u; /* nInvPage=2 */
        U32(ARENA_INV0 + 0x0Cu) = ARENA_ITEM0;
        setup_item_rec(ARENA_ITEM1, 151u, 5u, ARENA_ITEMDATA1, ARENA_INV1);
        U8(ARENA_ITEMDATA1 + 0x45u) = 2u;
        U32(ARENA_INV1 + 0x0Cu) = ARENA_ITEM1;
        if (c == 1) {
            for (uint32_t k = 0; k < 40u; k++) U32(ARENA_CELLS3 + k * 4u) = ARENA_ITEM2; /* unit2 grid full -> side 0 */
        } else if (c == 2) {
            for (uint32_t k = 0; k < 40u; k++) U32(ARENA_CELLS2 + k * 4u) = ARENA_ITEM2; /* unit1 grid full -> side 1 */
        }
        U32(ARENA_OUT) = 0xFFFFFFFFu;
        mem_region_t regs[] = {
            {0x6FDEFB94u, 8u}, {0x6FDEFA58u, 8u}, {0x6FDEEFE4u, 0x40u},
            {ARENA_ITEMSTXT, 0x1A00u}, {ARENA_INVTXT, 0x1000u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_UNIT1, 0xD0u},
            {ARENA_INV0, 0x40u}, {ARENA_INV1, 0x40u},
            {ARENA_GRIDS0, 0x40u}, {ARENA_GRIDS1, 0x40u},
            {ARENA_CELLS2, 0x100u}, {ARENA_CELLS3, 0x100u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u},
            {ARENA_ITEM1, 0x80u}, {ARENA_ITEMDATA1, 0x80u},
            {ARENA_OUT, 0x10u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 18);
        eax = safe_stdcall4(0x6FD71C50u, 0u, ARENA_UNIT0, ARENA_UNIT1, ARENA_OUT, &asserted);
        snprintf(args, sizeof(args), "0,\"0x%08X\",\"0x%08X\",\"0x%08X\"", ARENA_UNIT0, ARENA_UNIT1, ARENA_OUT);
        emit_rec(fp, "0x6FD71C50", "INVENTORY_CanTradeInventoriesSwap113c", c,
            c == 0 ? "both_fit_1" : c == 1 ? "unit1_fails_side0" : "unit2_fails_side1",
            args, regs, 18, asserted, eax, 0xFFFFFFFFu);
    }

    /* #07 0x6FD71D70 INVENTORY_AutoPlaceItemInBeltSlot113c (custom eax=pInv, edx=pItem, ecx=slot) */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        setup_inv_3grids(ARENA_INV0, ARENA_UNIT0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
        U32(ARENA_UNIT0 + 0x00u) = 0u; U32(ARENA_UNIT0 + 0x0Cu) = 0x555u;
        setup_item_rec(ARENA_ITEM0, 160u, 7u, ARENA_ITEMDATA0, 0u);
        U32(ARENA_ITEM0 + 0x2Cu) = ARENA_PATH0;
        if (c == 2) U32(ARENA_CELLS1 + 3u * 4u) = ARENA_ITEM1;
        uint32_t slot = (c == 0) ? 16u : (c == 3) ? 0xFFFFFFFFu : (c == 4) ? 0u : 3u;
        mem_region_t regs[] = {
            {0x6FDEFB94u, 8u}, {0x6FDED370u, 0x28u},
            {ARENA_ITEMSTXT, 0x1A00u}, {ARENA_UNIT0, 0xD0u},
            {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u}, {ARENA_CELLS1, 0x40u},
            {ARENA_ITEM0, 0xD0u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_PATH0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 10);
        eax = safe_eax_edx_ecx(0x6FD71D70u, ARENA_INV0, ARENA_ITEM0, slot, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",%u", ARENA_INV0, ARENA_ITEM0, slot);
        emit_rec(fp, "0x6FD71D70", "INVENTORY_AutoPlaceItemInBeltSlot113c", c,
            c == 0 ? "oob_slot_0" : c == 1 ? "places_slot3_1" :
            c == 2 ? "occupied_0" : c == 3 ? "neg_slot_0" : "places_slot0_1",
            args, regs, 10, asserted, eax, 0xFFFFFFFFu);
    }

    /* #08 0x6FD71DA0 INVENTORY_PlaceItemInBodyLoc113c */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        setup_inv_3grids(ARENA_INV0, ARENA_UNIT0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
        U32(ARENA_UNIT0 + 0x00u) = 0u; U32(ARENA_UNIT0 + 0x0Cu) = 0x555u;
        setup_item_rec(ARENA_ITEM0, 170u, 0u, ARENA_ITEMDATA0, 0u);
        U32(ARENA_ITEM0 + 0x2Cu) = ARENA_PATH0;
        if (c == 2) U32(ARENA_CELLS0 + 4u * 4u) = ARENA_ITEM1;
        uint32_t loc = (c == 0) ? 13u : (c == 3) ? 0u : 4u;
        mem_region_t regs[] = {
            {0x6FDEFB94u, 8u}, {0x6FDED370u, 0x28u},
            {ARENA_ITEMSTXT, 0x1A00u}, {ARENA_UNIT0, 0xD0u},
            {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u}, {ARENA_CELLS0, 0x40u},
            {ARENA_ITEM0, 0xD0u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_PATH0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 10);
        eax = safe_stdcall3(0x6FD71DA0u, ARENA_INV0, ARENA_ITEM0, loc, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",%u", ARENA_INV0, ARENA_ITEM0, loc);
        emit_rec(fp, "0x6FD71DA0", "INVENTORY_PlaceItemInBodyLoc113c", c,
            c == 0 ? "oob_loc_0" : c == 1 ? "places_loc4_1" : c == 2 ? "occupied_0" : "places_loc0_1",
            args, regs, 10, asserted, eax, 0xFFFFFFFFu);
    }

    /* #09 0x6FD71DD0 INVENTORY_PlaceItemInGridCell113c */
    for (int c = 0; c < 3; c++) {
        setup_common_tables();
        setup_inv_3grids(ARENA_INV0, ARENA_UNIT0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
        U32(ARENA_UNIT0 + 0x00u) = 0u; U32(ARENA_UNIT0 + 0x0Cu) = 0x555u;
        setup_item_rec(ARENA_ITEM0, 180u, 5u, ARENA_ITEMDATA0, 0u);
        U32(ARENA_ITEM0 + 0x2Cu) = ARENA_PATH0;
        uint32_t invArg = (c == 0) ? 0u : ARENA_INV0;
        uint32_t px = (c == 2) ? 9u : 2u;
        mem_region_t regs[] = {
            {0x6FDEFB94u, 8u}, {0x6FDEFA58u, 8u},
            {ARENA_ITEMSTXT, 0x1A00u}, {ARENA_INVTXT, 0x1000u}, {ARENA_UNIT0, 0xD0u},
            {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u}, {ARENA_CELLS2, 0x100u},
            {ARENA_ITEM0, 0xD0u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_PATH0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 11);
        eax = safe_stdcall7(0x6FD71DD0u, invArg, ARENA_ITEM0, px, 1u, 0u, 0u, 0u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",%u,1,0,0,0", invArg, ARENA_ITEM0, px);
        emit_rec(fp, "0x6FD71DD0", "INVENTORY_PlaceItemInGridCell113c", c,
            c == 0 ? "null_inv_0" : c == 1 ? "places_2x2_1" : "oob_0",
            args, regs, 11, asserted, eax, 0xFFFFFFFFu);
    }

    /* #10 0x6FD71E10 INVENTORY_AutoPlaceItemInGrid113c */
    for (int c = 0; c < 3; c++) {
        setup_common_tables();
        setup_inv_3grids(ARENA_INV0, ARENA_UNIT0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
        U32(ARENA_UNIT0 + 0x00u) = 0u; U32(ARENA_UNIT0 + 0x0Cu) = 0x555u;
        setup_item_rec(ARENA_ITEM0, 190u, 5u, ARENA_ITEMDATA0, 0u);
        U32(ARENA_ITEM0 + 0x2Cu) = ARENA_PATH0;
        if (c == 2) {
            for (uint32_t k = 0; k < 40u; k++) U32(ARENA_CELLS2 + k * 4u) = ARENA_ITEM1;
        }
        uint32_t invArg = (c == 0) ? 0u : ARENA_INV0;
        mem_region_t regs[] = {
            {0x6FDEFB94u, 8u}, {0x6FDEFA58u, 8u},
            {ARENA_ITEMSTXT, 0x1A00u}, {ARENA_INVTXT, 0x1000u}, {ARENA_UNIT0, 0xD0u},
            {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u}, {ARENA_CELLS2, 0x100u},
            {ARENA_ITEM0, 0xD0u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_PATH0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 11);
        eax = safe_stdcall7(0x6FD71E10u, invArg, ARENA_ITEM0, 0u, 0u, 0u, 0u, 0u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",0,0,0,0,0", invArg, ARENA_ITEM0);
        emit_rec(fp, "0x6FD71E10", "INVENTORY_AutoPlaceItemInGrid113c", c,
            c == 0 ? "null_inv_0" : c == 1 ? "auto_places_1" : "full_0",
            args, regs, 11, asserted, eax, 0xFFFFFFFFu);
    }

    /* #11 0x6FD71E80 INVENTORY_AutoPlaceItemInBelt113c */
    for (int c = 0; c < 3; c++) {
        setup_common_tables();
        setup_inv_3grids(ARENA_INV0, ARENA_UNIT0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
        U32(ARENA_UNIT0 + 0x00u) = 0u; U32(ARENA_UNIT0 + 0x0Cu) = 0x555u;
        setup_item_rec(ARENA_ITEM0, 200u, (c == 0) ? 0u : 7u, ARENA_ITEMDATA0, 0u);
        U32(ARENA_ITEM0 + 0x2Cu) = ARENA_PATH0;
        if (c == 2) {
            for (uint32_t s = 0; s < 4u; s++) U32(ARENA_CELLS1 + s * 4u) = ARENA_ITEM1;
        }
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u}, {0x6FDF13DCu, 4u}, {0x6FDED370u, 0x28u},
            {0x6FDEF068u, 0x48u},
            {ARENA_SGPT, 0xC78u}, {ARENA_ITEMSTXT, 0x1A00u}, {ARENA_ITEMTYPES, 0x5600u},
            {ARENA_BELTSTXT, 0x500u}, {ARENA_UNIT0, 0xD0u},
            {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u}, {ARENA_CELLS0, 0x40u}, {ARENA_CELLS1, 0x40u},
            {ARENA_ITEM0, 0xD0u}, {ARENA_ITEM1, 0xD0u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_PATH0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 19);
        eax = safe_stdcall2(0x6FD71E80u, ARENA_INV0, ARENA_ITEM0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_INV0, ARENA_ITEM0);
        emit_rec(fp, "0x6FD71E80", "INVENTORY_AutoPlaceItemInBelt113c", c,
            c == 0 ? "non_beltable_0" : c == 1 ? "auto_places_belt_1" : "belt_full_0",
            args, regs, 19, asserted, eax, 0xFFFFFFFFu);
    }
    /* #12..#17 ItemMods.cpp property applicators (I12A-2, logging.ts) */
    {
        static const uint32_t vas[6] = {
            0x6FD98550u, 0x6FD985D0u, 0x6FD98960u, 0x6FD989D0u, 0x6FD98A40u, 0x6FD98AE0u
        };
        static const char *va_strs[6] = {
            "0x6FD98550", "0x6FD985D0", "0x6FD98960", "0x6FD989D0", "0x6FD98A40", "0x6FD98AE0"
        };
        static const char *names[6] = {
            "ITEMMODS_ApplyPropertyOskill113c",
            "ITEMMODS_ApplyPropertySimpleLayer0_113c",
            "ITEMMODS_ApplyPropertyResetAndRoll113c",
            "ITEMMODS_ApplyPropertyCondResetAndRoll113c",
            "ITEMMODS_ApplyPropertyResetAndSeedRoll113c",
            "ITEMMODS_ApplyPropertyCondResetAndSeedRoll113c"
        };
        for (int p = 0; p < 6; p++) {
            for (int c = 0; c < 4; c++) {
                setup_common_tables();
                U32(ARENA_ITEM0 + 0x00u) = 4u; U32(ARENA_ITEM0 + 0x04u) = (p >= 2) ? 13u : 0u;
                U32(ARENA_ITEM0 + 0x0Cu) = 77u; U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
                U32(ARENA_ITEM0 + 0x5Cu) = ARENA_STATLIST0;
                U32(ARENA_ITEMDATA0 + 0x04u) = 0x13572468u;
                U32(ARENA_ITEMDATA0 + 0x08u) = 0x24681357u;
                U32(ARENA_UNIT0 + 0x00u) = 1u; U32(ARENA_UNIT0 + 0x20u) = 0x11223344u;
                U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST1;
                U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
                U32(ARENA_STATLIST1 + 0x10u) = 0x80000000u;
                S32(ARENA_PROPENTRY + 0x04u) = (p == 0 && c == 3) ? 20 : 5;
                S32(ARENA_PROPENTRY + 0x08u) = (c == 1) ? 4 : (c == 2) ? 2 : (p == 0 && c == 3) ? 3 : 0;
                S32(ARENA_PROPENTRY + 0x0Cu) = (c == 1) ? 4 : (c == 2) ? 10 : (p == 0 && c == 3) ? 3 : 0;
                uint32_t propArg = (c == 0) ? 0u : ARENA_PROPENTRY;
                uint32_t unitArg = (p >= 2 && c == 3) ? ARENA_UNIT0 : ARENA_ITEM0;
                uint32_t valArg = (p < 4 && c == 1) ? 8u : 0u;
                uint32_t bForce = (c == 2) ? 1u : 0u;
                uint32_t statId = (p == 0) ? 0x6Bu : 0x10u;
                mem_region_t regs[] = {
                    {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u}, {0x6FDEFF6Cu, 4u},
                    {ARENA_SGPT, 0xC78u}, {ARENA_ITEMSTXT, 0x1A00u}, {ARENA_ITEMTYPES, 0x5600u},
                    {ARENA_ITYPEMAT, 0x500u}, {ARENA_ITEMSLINK, 0x40u},
                    {ARENA_ISC, 0x1000u}, {ARENA_ISC + statId * 0x144u, 0x144u},
                    {ARENA_ISC + 0x1Fu * 0x144u, 0x144u}, {ARENA_PROPENTRY, 0x20u},
                    {ARENA_UNIT0, 0xD0u}, {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u},
                    {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}
                };
                capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 18);
                eax = safe_ecx_edx_stack9(vas[p], bForce, ARENA_ITEM0, unitArg, propArg, 0u, statId,
                    0u, valArg, 0u, 0x40u, 0u, &asserted);
                snprintf(args, sizeof(args), "%u,\"0x%08X\",\"0x%08X\",\"0x%08X\",0,%u,0,%u,0,64,0",
                    bForce, ARENA_ITEM0, unitArg, propArg, statId, valArg);
                emit_rec(fp, va_strs[p], names[p], c,
                    c == 0 ? "null_prop_0" : c == 1 ? "fixed_or_val" :
                    c == 2 ? "bforce1_rolls" : "alt_path",
                    args, regs, 18, asserted, eax, 0xFFFFFFFFu);
            }
        }
    }

    /* #18 0x6FD972E0 ITEMMODS_ApplyPropertyIndestructible113c */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        if (c == 3) U32(ARENA_SGPT + 0xBD4u) = 0x98u;
        U32(ARENA_ITEM0 + 0x00u) = (c == 1) ? 1u : 4u;
        U32(ARENA_ITEM0 + 0x0Cu) = 77u;
        U32(ARENA_ITEM0 + 0x5Cu) = ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
        uint32_t unitArg = (c == 0) ? 0u : ARENA_ITEM0;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu},
            {ARENA_SGPT, 0xC78u}, {ARENA_ISC, 0x1000u}, {ARENA_ISC + 0x98u * 0x144u, 0x144u},
            {ARENA_PROPENTRY, 0x20u}, {ARENA_ITEM0, 0x80u}, {ARENA_STATLIST0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
        eax = safe_ecx_edx_stack9(0x6FD972E0u, 0u, 0u, unitArg, ARENA_PROPENTRY, 0u, 0x98u,
            0u, 0u, 0u, 0x40u, 0u, &asserted);
        snprintf(args, sizeof(args), "0,0,\"0x%08X\",\"0x%08X\",0,152,0,0,0,64,0", unitArg, ARENA_PROPENTRY);
        emit_rec(fp, "0x6FD972E0", "ITEMMODS_ApplyPropertyIndestructible113c", c,
            c == 0 ? "null_unit_0" : c == 1 ? "non_item_0" :
            c == 2 ? "adds_indestructible_1" : "isc_count_boundary_0",
            args, regs, 8, asserted, eax, 0xFFFFFFFFu);
    }

    /* #19 0x6FD97350 ITEMMODS_ApplyPropertyPackedDuration113c */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        U32(ARENA_ITEM0 + 0x00u) = 4u; U32(ARENA_ITEM0 + 0x0Cu) = 77u;
        U32(ARENA_ITEM0 + 0x5Cu) = ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
        S32(ARENA_PROPENTRY + 0x04u) = (c == 2) ? 9 : 2;
        S32(ARENA_PROPENTRY + 0x08u) = (c == 2) ? -500 : 10;
        S32(ARENA_PROPENTRY + 0x0Cu) = (c == 2) ? 2000 : 50;
        uint32_t propArg = (c == 0) ? 0u : ARENA_PROPENTRY;
        uint32_t statId = (c == 1) ? 0xFFFFu : 0x10u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu},
            {ARENA_SGPT, 0xC78u}, {ARENA_ISC, 0x1000u},
            {ARENA_ISC + 0x10u * 0x144u, 0x144u}, {ARENA_PROPENTRY, 0x20u},
            {ARENA_ITEM0, 0x80u}, {ARENA_STATLIST0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
        eax = safe_ecx_edx_stack9(0x6FD97350u, 0u, 0u, ARENA_ITEM0, propArg, 0u, statId,
            0u, 0u, 0u, 0x40u, 0u, &asserted);
        snprintf(args, sizeof(args), "0,0,\"0x%08X\",\"0x%08X\",0,%u,0,0,0,64,0", ARENA_ITEM0, propArg, statId);
        emit_rec(fp, "0x6FD97350", "ITEMMODS_ApplyPropertyPackedDuration113c", c,
            c == 0 ? "null_prop_0" : c == 1 ? "oob_stat_0" : c == 2 ? "clamps_bounds" : "packs_normal",
            args, regs, 8, asserted, eax, 0xFFFFFFFFu);
    }

    /* #20 0x6FD98070 ITEMMODS_ApplyPropertyCondResetRollDurability113c */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        U32(ARENA_ITEM0 + 0x00u) = 4u; U32(ARENA_ITEM0 + 0x04u) = 0u;
        U32(ARENA_ITEM0 + 0x0Cu) = 77u; U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
        U32(ARENA_ITEM0 + 0x5Cu) = ARENA_STATLIST0;
        U32(ARENA_ITEMDATA0 + 0x04u) = 0x13572468u;
        U32(ARENA_ITEMDATA0 + 0x08u) = 0x24681357u;
        U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
        U32(ARENA_STATLIST0 + 0x24u) = ARENA_STATS0;
        U16(ARENA_STATLIST0 + 0x28u) = 2u; U16(ARENA_STATLIST0 + 0x2Au) = 8u;
        U32(ARENA_STATS0 + 0x00u) = 0x00480000u; S32(ARENA_STATS0 + 0x04u) = 25;
        U32(ARENA_STATS0 + 0x08u) = 0x00490000u; S32(ARENA_STATS0 + 0x0Cu) = (c == 3) ? 0 : 45;
        S32(ARENA_PROPENTRY + 0x08u) = (c == 1) ? 0 : 5;
        S32(ARENA_PROPENTRY + 0x0Cu) = (c == 1) ? 0 : 12;
        uint32_t propArg = (c == 0) ? 0u : ARENA_PROPENTRY;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u}, {0x6FDEFF6Cu, 4u},
            {ARENA_SGPT, 0xC78u}, {ARENA_ITEMSTXT, 0x1A00u}, {ARENA_ITEMTYPES, 0x5600u},
            {ARENA_ITYPEMAT, 0x500u}, {ARENA_ITEMSLINK, 0x40u},
            {ARENA_ISC, 0x1000u}, {ARENA_ISC + 0x15u * 0x144u, 0x144u}, {ARENA_ISC + 0x48u * 0x144u, 0x300u},
            {ARENA_PROPENTRY, 0x20u}, {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 17);
        eax = safe_ecx_edx_stack9(0x6FD98070u, 1u, ARENA_ITEM0, ARENA_ITEM0, propArg, 0u, 0x15u,
            0u, 0u, 0u, 0x40u, 0u, &asserted);
        snprintf(args, sizeof(args), "1,\"0x%08X\",\"0x%08X\",\"0x%08X\",0,21,0,0,0,64,0",
            ARENA_ITEM0, ARENA_ITEM0, propArg);
        emit_rec(fp, "0x6FD98070", "ITEMMODS_ApplyPropertyCondResetRollDurability113c", c,
            c == 0 ? "null_prop_0" : c == 1 ? "zero_roll_0" :
            c == 2 ? "resets_rolls_and_sets_durability" : "zero_maxdur_skips_48",
            args, regs, 17, asserted, eax, 0xFFFFFFFFu);
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
        if (!VirtualProtect((LPVOID)0x6FDD9000u, 0x1000u, PAGE_READWRITE, &iatProt)) return 1;
        DWORD rdataProt = 0;
        if (!VirtualProtect((LPVOID)0x6FDE3000u, 0x1000u, PAGE_READWRITE, &rdataProt)) return 1;
    }

    g_orig_iat_assert  = U32(0x6FDD90D4u);
    g_orig_iat_alloc   = U32(0x6FDD90D0u);
    g_orig_iat_free    = U32(0x6FDD90CCu);
    g_orig_iat_realloc = U32(0x6FDD90ACu);

    const char *out1 = (argc > 1) ? argv[1] : "i12a-1-vectors.ndjson";
    const char *out2 = (argc > 2) ? argv[2] : "i12a-2-vectors.ndjson";

    FILE *fp1 = fopen(out1, "wb");
    if (!fp1) return 1;
    emit_i12a_1(fp1);
    fclose(fp1);

    FILE *fp2 = fopen(out2, "wb");
    if (!fp2) return 1;
    emit_i12a_2(fp2);
    fclose(fp2);

    TerminateProcess(GetCurrentProcess(), 0);
    return 0;
}
