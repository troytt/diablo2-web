/*
 * k1r11-laneA-it13-emitter.c
 *
 * Real-DLL Wine differential vector emitter for Iteration 13 Lane A:
 *   - I13A-1 (22 net-new functions -> i13a-1-vectors.ndjson)
 *   - I13A-2 (11 net-new functions -> i13a-2-vectors.ndjson)
 *
 * Inline-assembly rule: Register/immediate operands only; no memory constraints.
 * Compiles cleanly with -Wall -Wextra -Werror under both -O2 and
 * -O2 -fno-omit-frame-pointer with 100% SHA-256 identical NDJSON outputs.
 */
#define _WIN32_WINNT 0x0501
#include <windows.h>
#include <setjmp.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define ARENA_BASE           0x03500000u
#define ARENA_SIZE           0x00200000u
#define HEAP_BASE            0x40000000u
#define HEAP_SIZE            0x00100000u

#define ARENA_SGPT           (ARENA_BASE + 0x0000u)
#define ARENA_UNIT0          (ARENA_BASE + 0x1000u)
#define ARENA_UNIT1          (ARENA_BASE + 0x1200u)
#define ARENA_UNIT2          (ARENA_BASE + 0x1400u)
#define ARENA_ITEM0          (ARENA_BASE + 0x1600u)
#define ARENA_ITEM1          (ARENA_BASE + 0x1800u)
#define ARENA_ITEM2          (ARENA_BASE + 0x1A00u)
#define ARENA_ITEMDATA0      (ARENA_BASE + 0x1C00u)
#define ARENA_ITEMDATA1      (ARENA_BASE + 0x1E00u)
#define ARENA_ITEMDATA2      (ARENA_BASE + 0x2000u)
#define ARENA_INV0           (ARENA_BASE + 0x2200u)
#define ARENA_INV1           (ARENA_BASE + 0x2300u)
#define ARENA_GRIDS0         (ARENA_BASE + 0x2600u)
#define ARENA_CELLS0         (ARENA_BASE + 0x2A00u)
#define ARENA_CELLS1         (ARENA_BASE + 0x2C00u)
#define ARENA_CELLS2         (ARENA_BASE + 0x2E00u)
#define ARENA_CELLS3         (ARENA_BASE + 0x3000u)
#define ARENA_STATLIST0      (ARENA_BASE + 0x3200u)
#define ARENA_STATLIST1      (ARENA_BASE + 0x3400u)
#define ARENA_STATLIST2      (ARENA_BASE + 0x3600u)
#define ARENA_STATS0         (ARENA_BASE + 0x3800u)
#define ARENA_STATS1         (ARENA_BASE + 0x3A00u)
#define ARENA_PATH0          (ARENA_BASE + 0x3C00u)
#define ARENA_PATH1          (ARENA_BASE + 0x3D00u)
#define ARENA_PATH2          (ARENA_BASE + 0x3E00u)
#define ARENA_ROOM0          (ARENA_BASE + 0x4000u)
#define ARENA_ROOM1          (ARENA_BASE + 0x4100u)
#define ARENA_ROOMLIST0      (ARENA_BASE + 0x4180u)
#define ARENA_COLL0          (ARENA_BASE + 0x4200u)
#define ARENA_COLLMAP0       (ARENA_BASE + 0x4300u)
#define ARENA_SEARCH0        (ARENA_BASE + 0x4600u)
#define ARENA_FIELD0         (ARENA_BASE + 0x4700u)
#define ARENA_BITSTREAM      (ARENA_BASE + 0x4800u)
#define ARENA_BITDATA        (ARENA_BASE + 0x4900u)
#define ARENA_DMGDATA0       (ARENA_BASE + 0x4A00u)
#define ARENA_ANIMTABLE      (ARENA_BASE + 0x4C00u)
#define ARENA_ANIMBUCKET0    (ARENA_BASE + 0x5100u)
#define ARENA_MISDATA0       (ARENA_BASE + 0x5300u)
#define ARENA_PROPENTRY      (ARENA_BASE + 0x5400u)
#define ARENA_STATEFLAGS0    (ARENA_BASE + 0x5600u)
#define ARENA_OUT            (ARENA_BASE + 0x5C00u)
#define ARENA_OUT2           (ARENA_BASE + 0x5D00u)
#define ARENA_OUT3           (ARENA_BASE + 0x5E00u)
#define ARENA_OUT4           (ARENA_BASE + 0x5F00u)
#define ARENA_OBJDATA0       (ARENA_BASE + 0x6000u)
#define ARENA_OBJTXT         (ARENA_BASE + 0x6100u)
#define ARENA_ITYPEMAT       (ARENA_BASE + 0x6400u)
#define ARENA_CHARSTATS      (ARENA_BASE + 0x6800u)
#define ARENA_MONSEQTABLE    (ARENA_BASE + 0x7200u)
#define ARENA_SEQREC0        (ARENA_BASE + 0x7400u)
#define ARENA_BELTSTXT       (ARENA_BASE + 0x7800u)
#define ARENA_INVTXT         (ARENA_BASE + 0x8800u)
#define ARENA_ACT0           (ARENA_BASE + 0x9A00u)
#define ARENA_DRLG0          (ARENA_BASE + 0x9B00u)
#define ARENA_CB0            (ARENA_BASE + 0xA000u)
#define ARENA_CB1            (ARENA_BASE + 0xA040u)
#define ARENA_CB2            (ARENA_BASE + 0xA080u)
#define ARENA_STATESTXT      (ARENA_BASE + 0xB000u)
#define ARENA_STATEMASKS     (ARENA_BASE + 0xB800u)
#define ARENA_XFORMSTATES    (ARENA_BASE + 0xBE00u)
#define ARENA_MAGICAFFIX     (ARENA_BASE + 0xC000u)
#define ARENA_ISC            (ARENA_BASE + 0x10000u)
#define ARENA_ITEMSTXT       (ARENA_BASE + 0x30000u)
#define ARENA_ITEMTYPES      (ARENA_BASE + 0x38000u)
#define ARENA_PLRTYPETBL     (ARENA_BASE + 0x6D000u)
#define ARENA_PLRMODETBL     (ARENA_BASE + 0x6D600u)
#define ARENA_MONMODETBL     (ARENA_BASE + 0x6DC00u)
#define ARENA_SKILLSTXT      (ARENA_BASE + 0x70000u)
#define ARENA_MISSILESTXT    (ARENA_BASE + 0x74000u)
#define ARENA_ITEMSLINK      (ARENA_BASE + 0x76000u)
#define ARENA_SETITEMSTXT    (ARENA_BASE + 0x78000u)
#define ARENA_SETSTXT        (ARENA_BASE + 0x7A000u)
#define ARENA_UNIQUEITEMSTXT (ARENA_BASE + 0x7B000u)
#define ARENA_MONSTATS       (ARENA_BASE + 0x80000u)
#define ARENA_MONSTATS2      (ARENA_BASE + 0xF0000u)

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

static uint32_t g_orig_iat_assert  = 0;
static uint32_t g_orig_iat_alloc   = 0;
static uint32_t g_orig_iat_free    = 0;
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
typedef uint32_t (__stdcall *stdcall7_t)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);

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

static __attribute__((noinline)) uint32_t call_ecx_ebx_stack2(
    uint32_t fn, uint32_t ecx_val, uint32_t ebx_val, uint32_t s1, uint32_t s2) {
    g_pkt.fn = fn;
    g_pkt.r_ecx = ecx_val;
    g_pkt.r_ebx = ebx_val;
    g_pkt.s[0] = s1;
    g_pkt.s[1] = s2;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "pushl %%ebx\n\t"
        "pushl %%esi\n\t"
        "movl %%esi, %%esi\n\t"
        "pushl 32(%0)\n\t"
        "pushl 28(%0)\n\t"
        "movl 8(%0), %%ecx\n\t"
        "movl 16(%0), %%ebx\n\t"
        "movl 0(%0), %%eax\n\t"
        "call *%%eax\n\t"
        "movl %%eax, 68(%0)\n\t"
        "popl %%esi\n\t"
        "popl %%ebx\n\t"
        : "+S"(base)
        :
        : "eax", "ecx", "edx", "edi", "cc", "memory"
    );
    return g_pkt.ret;
}

static __attribute__((noinline)) uint32_t call_ebx_stack1(
    uint32_t fn, uint32_t ebx_val, uint32_t s1) {
    g_pkt.fn = fn;
    g_pkt.r_ebx = ebx_val;
    g_pkt.s[0] = s1;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "pushl %%ebx\n\t"
        "pushl 28(%0)\n\t"
        "movl 16(%0), %%ebx\n\t"
        "movl 0(%0), %%eax\n\t"
        "call *%%eax\n\t"
        "movl %%eax, 68(%0)\n\t"
        "popl %%ebx\n\t"
        : "+S"(base)
        :
        : "eax", "ecx", "edx", "edi", "cc", "memory"
    );
    return g_pkt.ret;
}

static __attribute__((noinline)) uint32_t call_ecx_edx_stack7(
    uint32_t fn, uint32_t ecx_val, uint32_t edx_val,
    uint32_t s1, uint32_t s2, uint32_t s3, uint32_t s4, uint32_t s5, uint32_t s6, uint32_t s7) {
    g_pkt.fn = fn;
    g_pkt.r_ecx = ecx_val;
    g_pkt.r_edx = edx_val;
    g_pkt.s[0] = s1; g_pkt.s[1] = s2; g_pkt.s[2] = s3;
    g_pkt.s[3] = s4; g_pkt.s[4] = s5; g_pkt.s[5] = s6; g_pkt.s[6] = s7;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "pushl 52(%0)\n\t"
        "pushl 48(%0)\n\t"
        "pushl 44(%0)\n\t"
        "pushl 40(%0)\n\t"
        "pushl 36(%0)\n\t"
        "pushl 32(%0)\n\t"
        "pushl 28(%0)\n\t"
        "movl 8(%0), %%ecx\n\t"
        "movl 12(%0), %%edx\n\t"
        "movl 0(%0), %%eax\n\t"
        "call *%%eax\n\t"
        "movl %%eax, 68(%0)\n\t"
        : "+b"(base)
        :
        : "eax", "ecx", "edx", "esi", "edi", "cc", "memory"
    );
    return g_pkt.ret;
}

static __attribute__((noinline)) uint32_t call_ecx_edx_stack9(
    uint32_t fn, uint32_t ecx_val, uint32_t edx_val,
    uint32_t s1, uint32_t s2, uint32_t s3, uint32_t s4, uint32_t s5,
    uint32_t s6, uint32_t s7, uint32_t s8, uint32_t s9) {
    g_pkt.fn = fn;
    g_pkt.r_ecx = ecx_val;
    g_pkt.r_edx = edx_val;
    g_pkt.s[0] = s1; g_pkt.s[1] = s2; g_pkt.s[2] = s3;
    g_pkt.s[3] = s4; g_pkt.s[4] = s5; g_pkt.s[5] = s6;
    g_pkt.s[6] = s7; g_pkt.s[7] = s8; g_pkt.s[8] = s9;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "pushl 60(%0)\n\t"
        "pushl 56(%0)\n\t"
        "pushl 52(%0)\n\t"
        "pushl 48(%0)\n\t"
        "pushl 44(%0)\n\t"
        "pushl 40(%0)\n\t"
        "pushl 36(%0)\n\t"
        "pushl 32(%0)\n\t"
        "pushl 28(%0)\n\t"
        "movl 8(%0), %%ecx\n\t"
        "movl 12(%0), %%edx\n\t"
        "movl 0(%0), %%eax\n\t"
        "call *%%eax\n\t"
        "movl %%eax, 68(%0)\n\t"
        : "+b"(base)
        :
        : "eax", "ecx", "edx", "esi", "edi", "cc", "memory"
    );
    return g_pkt.ret;
}

static __attribute__((noinline)) uint32_t call_eax_edi_stack2(
    uint32_t fn, uint32_t eax_val, uint32_t edi_val, uint32_t s1, uint32_t s2) {
    g_pkt.fn = fn;
    g_pkt.r_eax = eax_val;
    g_pkt.r_edi = edi_val;
    g_pkt.s[0] = s1;
    g_pkt.s[1] = s2;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
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
static __attribute__((noinline)) uint32_t safe_stdcall7(uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3, uint32_t a4, uint32_t a5, uint32_t a6, int *pAsserted) {
    SAFE_BODY(((stdcall7_t)(uintptr_t)va)(a0, a1, a2, a3, a4, a5, a6));
}
static __attribute__((noinline)) uint32_t safe_ecx_ebx_stack2(uint32_t va, uint32_t ecx, uint32_t ebx, uint32_t s1, uint32_t s2, int *pAsserted) {
    SAFE_BODY(call_ecx_ebx_stack2(va, ecx, ebx, s1, s2));
}
static __attribute__((noinline)) uint32_t safe_ebx_stack1(uint32_t va, uint32_t ebx, uint32_t s1, int *pAsserted) {
    SAFE_BODY(call_ebx_stack1(va, ebx, s1));
}
static __attribute__((noinline)) uint32_t safe_ecx_edx_stack7(
    uint32_t va, uint32_t ecx, uint32_t edx, uint32_t s1, uint32_t s2, uint32_t s3,
    uint32_t s4, uint32_t s5, uint32_t s6, uint32_t s7, int *pAsserted) {
    SAFE_BODY(call_ecx_edx_stack7(va, ecx, edx, s1, s2, s3, s4, s5, s6, s7));
}
static __attribute__((noinline)) uint32_t safe_ecx_edx_stack9(
    uint32_t va, uint32_t ecx, uint32_t edx, uint32_t s1, uint32_t s2, uint32_t s3,
    uint32_t s4, uint32_t s5, uint32_t s6, uint32_t s7, uint32_t s8, uint32_t s9, int *pAsserted) {
    SAFE_BODY(call_ecx_edx_stack9(va, ecx, edx, s1, s2, s3, s4, s5, s6, s7, s8, s9));
}
static __attribute__((noinline)) uint32_t safe_eax_edi_stack2(
    uint32_t va, uint32_t eax, uint32_t edi, uint32_t s1, uint32_t s2, int *pAsserted) {
    SAFE_BODY(call_eax_edi_stack2(va, eax, edi, s1, s2));
}

typedef struct {
    uint32_t base;
    uint32_t len;
} mem_region_t;

static char g_pre_buf[786432];

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
        fflush(fp);
    }
}

static void setup_cb_stubs(void) {
    /* ARENA_CB0: __fastcall (cand, u) -> (cand->dwClassId != 99) ? 1 : 0 */
    static const uint8_t cb0[] = { 0x8B, 0x41, 0x04, 0x83, 0xF8, 0x63, 0x0F, 0x95, 0xC0, 0x0F, 0xB6, 0xC0, 0xC3 };
    /* ARENA_CB1: __fastcall (cand, search) -> (cand->dwClassId == 77) ? 1 : 0 (rejects 77) */
    static const uint8_t cb1[] = { 0x8B, 0x41, 0x04, 0x83, 0xF8, 0x4D, 0x0F, 0x94, 0xC0, 0x0F, 0xB6, 0xC0, 0xC3 };
    /* ARENA_CB2: __fastcall (pUnit) -> pUnit->dwClassId + 10 */
    static const uint8_t cb2[] = { 0x8B, 0x41, 0x04, 0x83, 0xC0, 0x0A, 0xC3 };
    memcpy((void *)(uintptr_t)ARENA_CB0, cb0, sizeof(cb0));
    memcpy((void *)(uintptr_t)ARENA_CB1, cb1, sizeof(cb1));
    memcpy((void *)(uintptr_t)ARENA_CB2, cb2, sizeof(cb2));
}

static void setup_common_tables(void) {
    memset(g_arena, 0, ARENA_SIZE);
    memset(g_heap, 0, 0x10000u);
    g_heap_top = HEAP_BASE;
    setup_cb_stubs();

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
    U32(ARENA_SGPT + 0xB64u) = ARENA_MISSILESTXT;
    U32(ARENA_SGPT + 0xB6Cu) = 64u;
    U32(ARENA_SGPT + 0xB98u) = ARENA_SKILLSTXT;
    U32(ARENA_SGPT + 0xBA0u) = 32u;
    U32(ARENA_SGPT + 0xBC0u) = 300u;
    U32(ARENA_SGPT + 0xBC4u) = ARENA_CHARSTATS;
    U32(ARENA_SGPT + 0xBC8u) = 7u;
    U32(ARENA_SGPT + 0xBCCu) = ARENA_ISC;
    U32(ARENA_SGPT + 0xBD4u) = 359u;
    U32(ARENA_SGPT + 0xBF8u) = ARENA_ITEMTYPES;
    U32(ARENA_SGPT + 0xBFCu) = 96u;
    U32(ARENA_SGPT + 0xC00u) = 3u;
    U32(ARENA_SGPT + 0xC04u) = ARENA_ITYPEMAT;
    U32(ARENA_SGPT + 0xC0Cu) = ARENA_SETSTXT;
    U32(ARENA_SGPT + 0xC10u) = 8u;
    U32(ARENA_SGPT + 0xC18u) = ARENA_SETITEMSTXT;
    U32(ARENA_SGPT + 0xC1Cu) = 16u;
    U32(ARENA_SGPT + 0xC24u) = ARENA_UNIQUEITEMSTXT;
    U32(ARENA_SGPT + 0xC28u) = 16u;
    U32(ARENA_SGPT + 0xC6Cu) = 6u;
    U32(ARENA_SGPT + 0xC70u) = 0x3Fu;

    U32(0x6FDF0950u) = ARENA_MONSTATS;
    U32(0x6FDF0954u) = ARENA_MONSTATS2;
    U32(0x6FDF0958u) = 600u;
    U32(0x6FDF0B4Cu) = ARENA_ANIMTABLE;

    U32(0x6FDEFBBCu) = ARENA_MAGICAFFIX;
    U32(0x6FDEFBC4u) = ARENA_MAGICAFFIX + 800u * 0x90u;
    U32(0x6FDEFBC8u) = ARENA_MAGICAFFIX + 1500u * 0x90u;

    U32(0x6FDEFB94u) = 16u;
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
        U8(ARENA_CHARSTATS + c * 0xC4u + 0x3Eu) = 6u;   /* WalkVelocity */
        U8(ARENA_CHARSTATS + c * 0xC4u + 0x3Fu) = 9u;   /* RunVelocity */
        U8(ARENA_CHARSTATS + c * 0xC4u + 0x40u) = 6u;   /* RunDrain */
        U32(ARENA_CHARSTATS + c * 0xC4u + 0x28u) = 0x20314D41u + c; /* szBaseWClass */
    }

    U32(0x6FDF0A5Cu) = ARENA_MONSEQTABLE;
    U32(0x6FDF0A60u) = 8u;

    U32(0x6FDEF020u) = 7u;
    U32(0x6FDEF028u + 0u * 8u + 0u) = 0x20687468u; U16(0x6FDEF028u + 0u * 8u + 4u) = 0u;
    U32(0x6FDEF028u + 1u * 8u + 0u) = 0x20736831u; U16(0x6FDEF028u + 1u * 8u + 4u) = 2u;
    U32(0x6FDEF028u + 2u * 8u + 0u) = 0x20746831u; U16(0x6FDEF028u + 2u * 8u + 4u) = 3u;
    U32(0x6FDEF028u + 3u * 8u + 0u) = 0x20776F62u; U16(0x6FDEF028u + 3u * 8u + 4u) = 1u;
    U32(0x6FDEF028u + 4u * 8u + 0u) = 0x20736832u; U16(0x6FDEF028u + 4u * 8u + 4u) = 5u;
    U32(0x6FDEF028u + 5u * 8u + 0u) = 0x20317468u; U16(0x6FDEF028u + 5u * 8u + 4u) = 12u;
    U32(0x6FDEF028u + 6u * 8u + 0u) = 0x20776278u; U16(0x6FDEF028u + 6u * 8u + 4u) = 1u;

    /* Grid 0 info table at 0x6FDED370 & 0x6FDED378 */
    U8(0x6FDED370u + 0x00u) = 13u; U8(0x6FDED370u + 0x01u) = 1u;
    U8(0x6FDED378u + 0x00u) = 13u; U8(0x6FDED378u + 0x01u) = 1u;
    for (uint32_t iv = 0; iv < 16u; iv++) {
        U32(ARENA_INVTXT + iv * 0xF0u + 0x10u) = 10u;
        U32(ARENA_INVTXT + iv * 0xF0u + 0x14u) = 4u;
    }

    for (uint32_t t = 0; t < 96u; t++) {
        U8(ARENA_ITEMTYPES + t * 0xE4u + 0x21u) = 0xFFu;
    }
    /* Type 4: gold */
    U32(ARENA_ITYPEMAT + 4u * 12u + 0u) = (1u << 4);
    /* Type 0x12: tome (bBeltable=0, equiv=0x12) */
    U32(ARENA_ITYPEMAT + 0x12u * 12u + 0u) = (1u << 0x12);
    /* Type 0x16: scroll */
    U32(ARENA_ITYPEMAT + 0x16u * 12u + 0u) = (1u << 0x16);
    /* Type 0x1E (1H sword): bodyLoc 4/5 -> maps to 0x2D (weapon) */
    U8(ARENA_ITEMTYPES + 0x1Eu * 0xE4u + 0x0Au) = 4u;
    U8(ARENA_ITEMTYPES + 0x1Eu * 0xE4u + 0x0Bu) = 5u;
    U32(ARENA_ITYPEMAT + 0x1Eu * 12u + 4u) = (1u << (0x2Du - 32u));
    /* Type 0x1B (bow): shoots 0x2E, bodyLoc 4/5 -> maps to 0x2D */
    U8(ARENA_ITEMTYPES + 0x1Bu * 0xE4u + 0x0Au) = 4u;
    U8(ARENA_ITEMTYPES + 0x1Bu * 0xE4u + 0x0Bu) = 5u;
    U16(ARENA_ITEMTYPES + 0x1Bu * 0xE4u + 0x0Cu) = 0x2Eu;
    U16(ARENA_ITEMTYPES + 0x1Bu * 0xE4u + 0x0Eu) = 0x2Eu;
    U8(ARENA_ITEMTYPES + 0x1Bu * 0xE4u + 0x0Au) = 5u;
    U8(ARENA_ITEMTYPES + 0x1Bu * 0xE4u + 0x0Bu) = 4u;
    U32(ARENA_ITYPEMAT + 0x1Bu * 12u + 4u) = (1u << (0x2Du - 32u));
    /* Type 0x2C (throw weapon): throwable=1 (+0x10), equiv=0x2D */
    U8(ARENA_ITEMTYPES + 0x2Cu * 0xE4u + 0x10u) = 1u;
    U32(ARENA_ITYPEMAT + 0x2Cu * 12u + 4u) = (1u << (0x2Du - 32u)) | (1u << (0x2Cu - 32u));
    /* Type 0x2E (quiver): */
    U8(ARENA_ITEMTYPES + 0x2Eu * 0xE4u + 0x0Au) = 5u;
    U8(ARENA_ITEMTYPES + 0x2Eu * 0xE4u + 0x0Bu) = 4u;
    /* Type 0x33 (shield) -> maps to 0x32 (armor) */
    U8(ARENA_ITEMTYPES + 0x33u * 0xE4u + 0x0Au) = 5u;
    U32(ARENA_ITYPEMAT + 0x33u * 12u + 4u) = (1u << (0x32u - 32u)) | (1u << (0x33u - 32u));
    /* Type 0x39 (mace/hammer) -> weapon 0x2D + 0x39 */
    U32(ARENA_ITYPEMAT + 0x39u * 12u + 4u) = (1u << (0x2Du - 32u)) | (1u << (0x39u - 32u));
    /* Type 0x45, 0x46: beltable=1 */
    U8(ARENA_ITEMTYPES + 0x45u * 0xE4u + 0x19u) = 1u;
    U8(ARENA_ITEMTYPES + 0x46u * 0xE4u + 0x19u) = 1u;
    /* Type 0x25 (helm) -> maps to 0x32 (armor) */
    U8(ARENA_ITEMTYPES + 0x25u * 0xE4u + 0x0Au) = 1u;
    U32(ARENA_ITYPEMAT + 0x25u * 12u + 4u) = (1u << (0x32u - 32u));

    /* Item 0: 1H sword ('1hs ', type 0x1E) */
    U32(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x80u) = 0x20736831u;
    U32(ARENA_ITEMSTXT + 0u * 0x1A8u + 0xC0u) = 0x20736831u;
    U32(ARENA_ITEMSTXT + 0u * 0x1A8u + 0xC4u) = 0x20736832u;
    U32(ARENA_ITEMSTXT + 0u * 0x1A8u + 0xD8u) = 40u; /* maxDur / strreq */
    U8(ARENA_ITEMSTXT + 0u * 0x1A8u + 0xFEu) = 8u;
    U8(ARENA_ITEMSTXT + 0u * 0x1A8u + 0xFFu) = 16u;
    U8(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x10Fu) = 1u;
    U8(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x110u) = 3u;
    U8(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x115u) = 5u;
    U8(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x11Cu) = 0u;
    U16(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x11Eu) = 0x1Eu;
    U8(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x133u) = 0u;
    U8(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x13Cu) = 20u; /* stack max */

    /* Item 1: Throwing knife ('1th ', type 0x2C, stackable + throwable) */
    U32(ARENA_ITEMSTXT + 1u * 0x1A8u + 0x80u) = 0x20687431u;
    U32(ARENA_ITEMSTXT + 1u * 0x1A8u + 0xC0u) = 0x20687431u;
    U8(ARENA_ITEMSTXT + 1u * 0x1A8u + 0xFEu) = 4u;
    U8(ARENA_ITEMSTXT + 1u * 0x1A8u + 0xFFu) = 10u;
    U8(ARENA_ITEMSTXT + 1u * 0x1A8u + 0x101u) = 6u;
    U8(ARENA_ITEMSTXT + 1u * 0x1A8u + 0x102u) = 14u;
    U8(ARENA_ITEMSTXT + 1u * 0x1A8u + 0x10Fu) = 1u;
    U8(ARENA_ITEMSTXT + 1u * 0x1A8u + 0x110u) = 2u;
    U16(ARENA_ITEMSTXT + 1u * 0x1A8u + 0x11Eu) = 0x2Cu;
    U8(ARENA_ITEMSTXT + 1u * 0x1A8u + 0x133u) = 1u;
    U8(ARENA_ITEMSTXT + 1u * 0x1A8u + 0x13Cu) = 40u;

    /* Item 2: Bow ('bow ', type 0x1B) */
    U32(ARENA_ITEMSTXT + 2u * 0x1A8u + 0x80u) = 0x20776F62u;
    U32(ARENA_ITEMSTXT + 2u * 0x1A8u + 0xC0u) = 0x20776F62u;
    U32(ARENA_ITEMSTXT + 2u * 0x1A8u + 0xC4u) = 0x20776F62u;
    U8(ARENA_ITEMSTXT + 2u * 0x1A8u + 0xFEu) = 6u;
    U8(ARENA_ITEMSTXT + 2u * 0x1A8u + 0xFFu) = 12u;
    U8(ARENA_ITEMSTXT + 2u * 0x1A8u + 0x10Fu) = 2u;
    U8(ARENA_ITEMSTXT + 2u * 0x1A8u + 0x110u) = 4u;
    U8(ARENA_ITEMSTXT + 2u * 0x1A8u + 0x11Cu) = 1u;
    U16(ARENA_ITEMSTXT + 2u * 0x1A8u + 0x11Eu) = 0x1Bu;

    /* Item 3: Mace ('mac ', type 0x39, 1.5x dmg to undead) */
    U32(ARENA_ITEMSTXT + 3u * 0x1A8u + 0x80u) = 0x2063616Du;
    U32(ARENA_ITEMSTXT + 3u * 0x1A8u + 0xC0u) = 0x20736831u;
    U8(ARENA_ITEMSTXT + 3u * 0x1A8u + 0xFEu) = 10u;
    U8(ARENA_ITEMSTXT + 3u * 0x1A8u + 0xFFu) = 20u;
    U8(ARENA_ITEMSTXT + 3u * 0x1A8u + 0x103u) = 12u;
    U8(ARENA_ITEMSTXT + 3u * 0x1A8u + 0x104u) = 24u;
    U8(ARENA_ITEMSTXT + 3u * 0x1A8u + 0x10Fu) = 1u;
    U8(ARENA_ITEMSTXT + 3u * 0x1A8u + 0x110u) = 3u;
    U16(ARENA_ITEMSTXT + 3u * 0x1A8u + 0x11Eu) = 0x39u;

    /* Item 4: Quiver ('aqv ', type 0x2E, stackable) */
    U32(ARENA_ITEMSTXT + 4u * 0x1A8u + 0x80u) = 0x20767161u;
    U8(ARENA_ITEMSTXT + 4u * 0x1A8u + 0x10Fu) = 1u;
    U8(ARENA_ITEMSTXT + 4u * 0x1A8u + 0x110u) = 3u;
    U16(ARENA_ITEMSTXT + 4u * 0x1A8u + 0x11Eu) = 0x2Eu;
    U8(ARENA_ITEMSTXT + 4u * 0x1A8u + 0x133u) = 1u;
    U8(ARENA_ITEMSTXT + 4u * 0x1A8u + 0x13Cu) = 250u;
    U32(ARENA_ITEMSTXT + 4u * 0x1A8u + 0xC0u) = 0x20767161u;

    /* Item 5: Helm/Armor ('cap ', type 0x25) */
    U32(ARENA_ITEMSTXT + 5u * 0x1A8u + 0x80u) = 0x20706163u;
    U32(ARENA_ITEMSTXT + 5u * 0x1A8u + 0xD8u) = 12u;
    U8(ARENA_ITEMSTXT + 5u * 0x1A8u + 0x10Fu) = 2u;
    U8(ARENA_ITEMSTXT + 5u * 0x1A8u + 0x110u) = 2u;
    U8(ARENA_ITEMSTXT + 5u * 0x1A8u + 0x111u) = 15u; /* minac */
    U16(ARENA_ITEMSTXT + 5u * 0x1A8u + 0x11Eu) = 0x25u;

    /* Item 6: Tome ('tbk ', type 0x12, stackable) */
    U32(ARENA_ITEMSTXT + 6u * 0x1A8u + 0x80u) = 0x206B6274u;
    U8(ARENA_ITEMSTXT + 6u * 0x1A8u + 0x10Fu) = 1u;
    U8(ARENA_ITEMSTXT + 6u * 0x1A8u + 0x110u) = 2u;
    U16(ARENA_ITEMSTXT + 6u * 0x1A8u + 0x11Eu) = 0x12u;
    U8(ARENA_ITEMSTXT + 6u * 0x1A8u + 0x133u) = 1u;
    U8(ARENA_ITEMSTXT + 6u * 0x1A8u + 0x13Cu) = 20u;

    /* Item 7: Gold ('gld ', type 4) */
    U32(ARENA_ITEMSTXT + 7u * 0x1A8u + 0x80u) = 0x20646C67u;
    U8(ARENA_ITEMSTXT + 7u * 0x1A8u + 0x10Fu) = 1u;
    U8(ARENA_ITEMSTXT + 7u * 0x1A8u + 0x110u) = 1u;
    U16(ARENA_ITEMSTXT + 7u * 0x1A8u + 0x11Eu) = 4u;

    /* Item 8: Scroll ('tsc ', type 0x16) */
    U32(ARENA_ITEMSTXT + 8u * 0x1A8u + 0x80u) = 0x20637374u;
    U8(ARENA_ITEMSTXT + 8u * 0x1A8u + 0x10Fu) = 1u;
    U8(ARENA_ITEMSTXT + 8u * 0x1A8u + 0x110u) = 1u;
    U16(ARENA_ITEMSTXT + 8u * 0x1A8u + 0x11Eu) = 0x16u;

    /* Item 9: Ear ('ear ', type 0x25) */
    U32(ARENA_ITEMSTXT + 9u * 0x1A8u + 0x80u) = 0x20726165u;
    U8(ARENA_ITEMSTXT + 9u * 0x1A8u + 0x10Fu) = 1u;
    U8(ARENA_ITEMSTXT + 9u * 0x1A8u + 0x110u) = 1u;
    U16(ARENA_ITEMSTXT + 9u * 0x1A8u + 0x11Eu) = 0x25u;

    /* Item 10: Identify Scroll ('isc ', type 0x16) */
    U32(ARENA_ITEMSTXT + 10u * 0x1A8u + 0x80u) = 0x20637369u;
    U8(ARENA_ITEMSTXT + 10u * 0x1A8u + 0x10Fu) = 1u;
    U8(ARENA_ITEMSTXT + 10u * 0x1A8u + 0x110u) = 1u;
    U16(ARENA_ITEMSTXT + 10u * 0x1A8u + 0x11Eu) = 0x16u;

    /* Item 11: Bolts ('lit ', type 0x2E) */
    U32(ARENA_ITEMSTXT + 11u * 0x1A8u + 0x80u) = 0x2074696Cu;
    U32(ARENA_ITEMSTXT + 11u * 0x1A8u + 0x90u) = 0x2074696Cu;
    U32(ARENA_ITEMSTXT + 11u * 0x1A8u + 0xC0u) = 0x2074696Cu;
    U8(ARENA_ITEMSTXT + 11u * 0x1A8u + 0x10Fu) = 1u;
    U8(ARENA_ITEMSTXT + 11u * 0x1A8u + 0x110u) = 3u;
    U16(ARENA_ITEMSTXT + 11u * 0x1A8u + 0x11Eu) = 0x2Eu;

    /* Item 12: Crossbow ('xbw ', type 0x1B) */
    U32(ARENA_ITEMSTXT + 12u * 0x1A8u + 0x80u) = 0x20776278u;
    U32(ARENA_ITEMSTXT + 12u * 0x1A8u + 0x90u) = 0x20776278u;
    U32(ARENA_ITEMSTXT + 12u * 0x1A8u + 0xC0u) = 0x20776278u;
    U32(ARENA_ITEMSTXT + 12u * 0x1A8u + 0xC4u) = 0x20776278u;
    U8(ARENA_ITEMSTXT + 12u * 0x1A8u + 0x10Fu) = 2u;
    U8(ARENA_ITEMSTXT + 12u * 0x1A8u + 0x110u) = 3u;
    U8(ARENA_ITEMSTXT + 12u * 0x1A8u + 0x11Cu) = 1u;
    U16(ARENA_ITEMSTXT + 12u * 0x1A8u + 0x11Eu) = 0x1Bu;

    /* Fog sorted link table at ARENA_ITEMSLINK (must be sorted ascending by dwCode!) */
    U32(ARENA_ITEMSLINK + 0x00u) = 10u;
    U32(ARENA_ITEMSLINK + 0x08u) = ARENA_ITEMSLINK + 0x10u;
    U32(ARENA_ITEMSLINK + 0x10u) = 0x20637369u; U32(ARENA_ITEMSLINK + 0x14u) = 10u; /* 'isc ' */
    U32(ARENA_ITEMSLINK + 0x18u) = 0x20637374u; U32(ARENA_ITEMSLINK + 0x1Cu) = 8u;  /* 'tsc ' */
    U32(ARENA_ITEMSLINK + 0x20u) = 0x20646C67u; U32(ARENA_ITEMSLINK + 0x24u) = 7u;  /* 'gld ' */
    U32(ARENA_ITEMSLINK + 0x28u) = 0x20687431u; U32(ARENA_ITEMSLINK + 0x2Cu) = 1u;  /* '1th ' */
    U32(ARENA_ITEMSLINK + 0x30u) = 0x20706163u; U32(ARENA_ITEMSLINK + 0x34u) = 5u;  /* 'cap ' */
    U32(ARENA_ITEMSLINK + 0x38u) = 0x20726165u; U32(ARENA_ITEMSLINK + 0x3Cu) = 9u;  /* 'ear ' */
    U32(ARENA_ITEMSLINK + 0x40u) = 0x20736831u; U32(ARENA_ITEMSLINK + 0x44u) = 0u;  /* '1hs ' */
    U32(ARENA_ITEMSLINK + 0x48u) = 0x2074696Cu; U32(ARENA_ITEMSLINK + 0x4Cu) = 11u; /* 'lit ' */
    U32(ARENA_ITEMSLINK + 0x50u) = 0x20776278u; U32(ARENA_ITEMSLINK + 0x54u) = 12u; /* 'xbw ' */
    U32(ARENA_ITEMSLINK + 0x58u) = 0x20776F62u; U32(ARENA_ITEMSLINK + 0x5Cu) = 2u;  /* 'bow ' */

    /* ItemStatCost entries: set Save Bits / Save Add / ValShift for bitstream tests */
    for (uint32_t s = 0; s < 359u; s++) {
        uint32_t p = ARENA_ISC + s * 0x144u;
        U8(p + 0x19u) = 8u;   /* Save Bits */
        U8(p + 0x1Au) = 8u;   /* CSvBits */
        S32(p + 0x1Cu) = 0;   /* Save Add */
        S32(p + 0x20u) = 0;
    }
    /* Stat 0..3: strength/energy/dex/vit */
    U8(ARENA_ISC + 0u * 0x144u + 0x19u) = 7u; S32(ARENA_ISC + 0u * 0x144u + 0x1Cu) = 10;
    /* Stat 0x07 maxhp: valShift=8 */
    U8(ARENA_ISC + 7u * 0x144u + 0x18u) = 8u;
    /* Stat 0x1F defense, 0x48/0x49 dur/maxdur, 0x46 quantity */
    U8(ARENA_ISC + 0x1Fu * 0x144u + 0x19u) = 10u; S32(ARENA_ISC + 0x1Fu * 0x144u + 0x1Cu) = 10;
    U8(ARENA_ISC + 0x46u * 0x144u + 0x19u) = 9u;
    U8(ARENA_ISC + 0x48u * 0x144u + 0x19u) = 8u;
    U8(ARENA_ISC + 0x49u * 0x144u + 0x19u) = 8u;
    /* Stat 0x30/0x31 fire min/max, 0x39/0x3A/0x3B poison (valShift) */
    U8(ARENA_ISC + 0x30u * 0x144u + 0x19u) = 8u;
    U8(ARENA_ISC + 0x39u * 0x144u + 0x18u) = 8u;
    U8(ARENA_ISC + 0x3Au * 0x144u + 0x18u) = 8u;

    /* SkillsTxt[1..5] (stride 0x23C) */
    for (uint32_t sk = 1; sk <= 5u; sk++) {
        uint32_t ps = ARENA_SKILLSTXT + sk * 0x23Cu;
        U16(ps + 0x00u) = (uint16_t)sk;
        U16(ps + 0x194u) = 10u; /* reqlevel */
        U16(ps + 0x196u) = 20u; /* maxlvl */
        U8(ps + 0x1A5u) = 64u;  /* srcdmg = 64/128 */
        U8(ps + 0x1DCu) = (uint8_t)sk; /* elemType: 1=fire,2=ltng,3=magic,4=cold,5=pois */
        U32(ps + 0x1B0u) = 10u; /* minDam */
        U32(ps + 0x1C0u) = 20u; /* maxDam */
        U32(ps + 0x1E0u) = 15u; /* eMin */
        U32(ps + 0x1F0u) = 25u; /* eMax */
        U32(ps + 0x200u) = 50u; /* eLen */
    }
    /* MissilesTxt[1..4] (stride 0x1A4) */
    for (uint32_t ms = 1; ms <= 4u; ms++) {
        uint32_t pm = ARENA_MISSILESTXT + ms * 0x1A4u;
        S16(pm + 0x194u) = (ms == 1) ? 1 : (ms == 2) ? 5 : -1;
        U8(pm + 0x12Du) = (ms == 1) ? 0x80u : (ms == 3) ? 0x40u : 0x00u; /* srcDmg */
        U8(pm + 0x12Eu) = (ms == 4) ? 0x40u : 0x00u; /* scale128 */
        U8(pm + 0x12Fu) = (ms == 2) ? 3u : (ms == 3) ? 5u : 0u; /* pFlags */
        U8(pm + 0xE4u)  = (ms == 3) ? 2u : (ms == 4) ? 9u : 0u; /* elemType */
        U32(pm + 0xCCu) = 8u;  /* minDam */
        U32(pm + 0xDCu) = 16u; /* maxDam */
        U32(pm + 0xECu) = 12u; /* eMin */
        U32(pm + 0xFCu) = 24u; /* eMax */
        U32(pm + 0x10Cu) = 75u; /* eLen */
    }

    /* SetItemsTxt[0..2] (stride 0x1B8) & SetsTxt[0..1] (stride 0x128) */
    U16(ARENA_SETITEMSTXT + 0u * 0x1B8u + 0x22u) = 0u; /* setId=0 */
    U8(ARENA_SETITEMSTXT + 0u * 0x1B8u + 0x87u) = 1u;  /* addFunc=1 */
    U16(ARENA_SETITEMSTXT + 1u * 0x1B8u + 0x22u) = 0u;
    U8(ARENA_SETITEMSTXT + 1u * 0x1B8u + 0x87u) = 2u;  /* addFunc=2 */
    U16(ARENA_SETITEMSTXT + 2u * 0x1B8u + 0x22u) = 1u;
    U8(ARENA_SETITEMSTXT + 2u * 0x1B8u + 0x87u) = 0u;  /* addFunc=0 */

    /* UniqueItemsTxt[1] (stride 0x14C) */
    U32(ARENA_UNIQUEITEMSTXT + 1u * 0x14Cu + 0x20u) = 1u; /* enabled */

    /* MonStatsTxt entries for classIds used in tests (stride 0x1A8) */
    U16(ARENA_MONSTATS + 10u * 0x1A8u + 0x02u) = 10u;
    U32(ARENA_MONSTATS + 10u * 0x1A8u + 0x10u) = 0x20204B53u; /* 'SK  ' */
    U16(ARENA_MONSTATS + 10u * 0x1A8u + 0x0Cu) = 5u;
    U16(ARENA_MONSTATS + 10u * 0x1A8u + 0x0Eu) = 12u;
    U16(ARENA_MONSTATS + 0x1E4u * 0x1A8u + 0x02u) = 0x1E4u;
    U8(ARENA_MONSTATS + 0x1E4u * 0x1A8u + 0x4Bu) = 1u;
    U16(ARENA_MONSTATS + 0x1C5u * 0x1A8u + 0x02u) = 0x1C5u;
    U16(ARENA_MONSTATS + 0x1C5u * 0x1A8u + 0xB8u) = 0x1C6u; /* next in chain */
    U16(ARENA_MONSTATS + 0x1C6u * 0x1A8u + 0x02u) = 0x1C6u;
    U16(ARENA_MONSTATS + 0x1FEu * 0x1A8u + 0x02u) = 0x1FEu; /* caseHi=1 uber */
    U16(ARENA_MONSTATS + 0x1EDu * 0x1A8u + 0x02u) = 0x1EDu; /* split spawn */

    /* PlrType / PlrMode / MonMode tables (0x6FDF13A4..0x6FDF13D0) */
    U32(0x6FDF13A4u) = 16u;
    U32(0x6FDF13B0u) = ARENA_MONMODETBL;
    U32(0x6FDF13C4u) = 20u;
    U32(0x6FDF13C8u) = 1u;
    U32(0x6FDF13CCu) = ARENA_PLRTYPETBL;
    U32(0x6FDF13D0u) = ARENA_PLRMODETBL;
    for (uint32_t i = 0; i < 20u; i++) {
        U32(ARENA_PLRTYPETBL + i * 0x34u + 0x20u) = 0x20204D41u; /* 'AM  ' */
        uint32_t mc = (i == 0) ? 0x20204E54u : (i == 3) ? 0x20204E52u : (i == 10) ? 0x20204353u : 0x2020554Eu;
        U32(ARENA_PLRMODETBL + i * 0x34u + 0x20u) = mc; /* TN / RN / SC / NU */
    }
    for (uint32_t i = 0; i < 16u; i++) {
        U32(ARENA_MONMODETBL + i * 0x34u + 0x20u) = (i == 1) ? 0x2020554Eu : 0x20204C57u;
    }

    /* AnimDataTable: +0x00 pData, +0x04..+0x403 256 buckets, +0x404 default record, +0x4B0 empty bucket (count=0) */
    for (uint32_t b = 0; b < 256u; b++) {
        U32(ARENA_ANIMTABLE + 0x04u + b * 4u) = ARENA_ANIMTABLE + 0x4B0u;
    }
    U32(ARENA_ANIMTABLE + 0x40Cu) = 8u;
    U32(ARENA_ANIMTABLE + 0x410u) = 256u;
    /* "AMTNHTH" hash: 65+77+84+78+72+84+72 = 532 & 0xFF = 0x14 */
    U32(ARENA_ANIMTABLE + 0x04u + 0x14u * 4u) = ARENA_ANIMBUCKET0;
    U32(ARENA_ANIMBUCKET0 + 0u) = 1u; /* count = 1 */
    memcpy((void *)(uintptr_t)(ARENA_ANIMBUCKET0 + 4u), "AMTNHTH", 8u);
    U32(ARENA_ANIMBUCKET0 + 4u + 0x08u) = 12u; /* dwFramesPerDirection */
    U32(ARENA_ANIMBUCKET0 + 4u + 0x0Cu) = 320u; /* dwAnimSpeed */
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

static void setup_item_unit(uint32_t item, uint32_t id, uint32_t cls, uint32_t item_data, uint32_t inv) {
    U32(item + 0x00u) = 4u;
    U32(item + 0x04u) = cls;
    U32(item + 0x0Cu) = id;
    U32(item + 0x14u) = item_data;
    U32(item_data + 0x5Cu) = inv;
}

static void setup_unit_with_statlist(uint32_t unit, uint32_t type, uint32_t cls, uint32_t id,
                                     uint32_t sl, uint32_t stats, uint32_t stateflags, uint32_t path) {
    U32(unit + 0x00u) = type;
    U32(unit + 0x04u) = cls;
    U32(unit + 0x0Cu) = id;
    U32(unit + 0x2Cu) = path;
    U32(unit + 0x5Cu) = sl;
    if (sl != 0u) {
        U32(sl + 0x08u) = type;
        U32(sl + 0x0Cu) = id;
        U32(sl + 0x10u) = 0x80000000u; /* extended */
        U32(sl + 0x24u) = stats;
        U16(sl + 0x2Au) = 8u;
        U32(sl + 0x48u) = stats;
        U16(sl + 0x4Eu) = 8u;
        U32(sl + 0x58u) = stateflags;
    }
    if (path != 0u) {
        U32(path + 0x0Cu) = 100u; /* posX */
        U32(path + 0x10u) = 200u; /* posY */
    }
}

static void emit_i13a_1(FILE *fp) {
    char args[512];
    int asserted = 0;
    uint32_t eax = 0;

    /* #01 0x6FD62330 UNITFINDS_FindNearestUnitInRange */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_UNIT0, 0u, 0u, 1u, 0u, 0u, 0u, ARENA_PATH0);
        U32(ARENA_PATH0 + 0x1Cu) = (c == 0) ? 0u : ARENA_ROOM0; /* pRoom */
        U32(ARENA_PATH0 + 0x0Cu) = (10u << 16); U32(ARENA_PATH0 + 0x10u) = (10u << 16);
        U32(ARENA_ROOM0 + 0x00u) = ARENA_ROOMLIST0;
        U32(ARENA_ROOM0 + 0x24u) = 1u; /* nRooms */
        S32(ARENA_ROOM0 + 0x4Cu) = 0; S32(ARENA_ROOM0 + 0x50u) = 0;
        S32(ARENA_ROOM0 + 0x54u) = 50; S32(ARENA_ROOM0 + 0x58u) = 50;
        U32(ARENA_ROOMLIST0 + 0u) = ARENA_ROOM0;
        /* Candidate 1: unit1 classId=(c==5?10:99) at (11,11) or (13,10) */
        setup_unit_with_statlist(ARENA_UNIT1, 1u, (c == 5) ? 10u : 99u, 2u, 0u, 0u, 0u, ARENA_PATH1);
        U32(ARENA_PATH1 + 0x0Cu) = (c == 5) ? (13u << 16) : (11u << 16);
        U32(ARENA_PATH1 + 0x10u) = (c == 5) ? (10u << 16) : (11u << 16);
        /* Candidate 2: unit2 classId=10 at (13,13) or tie-dist (7,10) */
        setup_unit_with_statlist(ARENA_UNIT2, 1u, 10u, 3u, 0u, 0u, 0u, ARENA_PATH2);
        U32(ARENA_PATH2 + 0x0Cu) = (c == 3) ? (40u << 16) : (c == 5) ? (7u << 16) : (13u << 16);
        U32(ARENA_PATH2 + 0x10u) = (c == 3) ? (40u << 16) : (c == 5) ? (10u << 16) : (13u << 16);
        U32(ARENA_ROOM0 + 0x74u) = ARENA_UNIT1;
        U32(ARENA_UNIT1 + 0xE8u) = ARENA_UNIT2;
        uint32_t cbArg = (c == 1) ? 0u : ARENA_CB0;
        uint32_t maxDist = (c == 3) ? 5u : (c == 4) ? 0u : 20u;
        mem_region_t regs[] = {
            {ARENA_UNIT0, 0xF0u}, {ARENA_UNIT1, 0xF0u}, {ARENA_UNIT2, 0xF0u},
            {ARENA_PATH0, 0x40u}, {ARENA_PATH1, 0x40u}, {ARENA_PATH2, 0x40u},
            {ARENA_ROOM0, 0x80u}, {ARENA_ROOMLIST0, 0x20u}, {ARENA_CB0, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
        eax = safe_stdcall5(0x6FD62330u, ARENA_UNIT0, 10u, 10u, maxDist, cbArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",10,10,%u,\"0x%08X\"", ARENA_UNIT0, maxDist, cbArg);
        emit_rec(fp, "0x6FD62330", "UNITFINDS_FindNearestUnitInRange113c", c,
            c == 0 ? "null_room_assert" : c == 1 ? "null_cb_assert" :
            c == 2 ? "picks_unit2_skips_99" : c == 3 ? "out_of_range_0" :
            c == 4 ? "maxdist0_defaults" : "tie_dist_keeps_first",
            args, regs, 9, asserted, eax, 0xFFFFFFFFu);
    }

    /* #02 0x6FD624E0 UNITFINDS_MatchUnitCandidate */
    for (int c = 0; c < 10; c++) {
        setup_common_tables();
        U32(ARENA_SEARCH0 + 0x0Cu) = 20u; U32(ARENA_SEARCH0 + 0x10u) = 20u;
        U32(ARENA_SEARCH0 + 0x14u) = (c == 9) ? 5u : 15u; /* range */
        U32(ARENA_SEARCH0 + 0x18u) = 5u;  /* max count */
        U32(ARENA_SEARCH0 + 0x1Cu) = 0u;  /* cur count */
        U32(ARENA_SEARCH0 + 0x24u) = ARENA_CB1;
        uint32_t uType = (c == 1) ? 0u : (c == 4 || c == 7) ? 3u : 1u;
        uint32_t uCls  = (c == 6) ? 77u : (c == 7) ? 9999u : 10u;
        setup_unit_with_statlist(ARENA_UNIT0, uType, uCls, 5u, 0u, 0u, 0u, ARENA_PATH0);
        U32(ARENA_UNIT0 + 0x10u) = (c == 1 || c == 2) ? 5u : 1u;
        U32(ARENA_UNIT0 + 0xC4u) = (c == 8) ? 8u : 0u;
        uint32_t px = (c == 3) ? 45u : (c == 9) ? 25u : 22u;
        uint32_t py = (c == 9) ? 20u : 22u;
        U16(ARENA_PATH0 + 0x02u) = (uint16_t)px; U16(ARENA_PATH0 + 0x06u) = (uint16_t)py;
        U32(ARENA_PATH0 + 0x0Cu) = (px << 16); U32(ARENA_PATH0 + 0x10u) = (py << 16);
        U32(ARENA_PATH0 + 0x1Cu) = ARENA_ROOM0;
        U32(ARENA_SEARCH0 + 0x00u) = (c == 1) ? 0x01u : (c == 4 || c == 7) ? 0x08u :
                                     (c == 6) ? 0x802u : (c == 8) ? 0x402u : 0x02u;
        if (c == 5) {
            U32(ARENA_SEARCH0 + 0x00u) = 0x06u; /* requires demon or undead */
            U32(ARENA_MONSTATS + 10u * 0x1A8u + 0x11Cu) = 0x200u; /* demon bit */
        }
        uint32_t sArg = (c == 0) ? 0u : ARENA_SEARCH0;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC78u},
            {ARENA_MONSTATS, 0x5000u}, {ARENA_MISSILESTXT, 0x2000u},
            {ARENA_UNIT0, 0xF0u}, {ARENA_PATH0, 0x40u}, {ARENA_ROOM0, 0x80u},
            {ARENA_SEARCH0, 0x40u}, {ARENA_CB1, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 10);
        eax = safe_stdcall2(0x6FD624E0u, ARENA_UNIT0, sArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_UNIT0, sArg);
        emit_rec(fp, "0x6FD624E0", "UNITFINDS_MatchUnitCandidate113c", c,
            c == 0 ? "null_search_0" : c == 1 ? "player_match_1" : c == 2 ? "monster_match_1" :
            c == 3 ? "out_of_range_0" : c == 4 ? "missile_match_1" :
            c == 5 ? "demon_filter_1" : c == 6 ? "cb_rejects_77" :
            c == 7 ? "oob_missile_0" : c == 8 ? "flag_0x400_bit3_1" : "exact_range_eq_1",
            args, regs, 10, asserted, eax, 0xFFFFFFFFu);
    }

    /* #03 0x6FD6AA00 UNITS_GetMonsterSplitSpawnParams (void) */
    for (int c = 0; c < 7; c++) {
        setup_common_tables();
        uint32_t cls = (c == 0 || c == 5) ? 0u : (c == 1) ? 0x1E4u :
                       (c == 2 || c == 3) ? 0x1FEu : (c == 6) ? 0x219u : 0x1EDu;
        if (c == 5) {
            U16(ARENA_MONSTATS + 0u * 0x1A8u + 0x02u) = 0x1FEu; /* caseHi=1 for rawClass=0 */
        }
        if (c == 6) {
            U16(ARENA_MONSTATS + 0x219u * 0x1A8u + 0x02u) = 0x219u;
            U8(ARENA_STATESTXT + 0x2238u + 0x12u) = 1u; /* state 0x92+1 flag bit 0 */
        }
        setup_unit_with_statlist(ARENA_UNIT0, (c == 0) ? 0u : 1u, cls, 9u,
                                 ARENA_STATLIST0, ARENA_STATS0, ARENA_STATEFLAGS0, ARENA_PATH0);
        U32(ARENA_PATH0 + 0x0Cu) = 50u; U32(ARENA_PATH0 + 0x10u) = 60u;
        U32(ARENA_PATH0 + 0x1Cu) = (c == 6) ? 0u : ARENA_ROOM0;
        U32(ARENA_UNIT0 + 0x20u) = 0x12345678u; U32(ARENA_UNIT0 + 0x24u) = 0x87654321u;
        uint32_t cbArg = (c == 2) ? ARENA_CB2 : 0u;
        U32(ARENA_OUT) = 0xAAAAAAAAu; U32(ARENA_OUT2) = 0u; U32(ARENA_OUT3) = 0u; U32(ARENA_OUT4) = 0u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDF0950u, 12u}, {ARENA_SGPT, 0xC78u},
            {ARENA_MONSTATS, 0x3A000u}, {ARENA_STATESTXT, 0x3000u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATEFLAGS0, 0x40u},
            {ARENA_PATH0, 0x40u}, {ARENA_ROOM0, 0x80u}, {ARENA_CB2, 0x20u},
            {ARENA_OUT, 0x10u}, {ARENA_OUT2, 0x10u}, {ARENA_OUT3, 0x10u}, {ARENA_OUT4, 0x10u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 16);
        eax = safe_stdcall7(0x6FD6AA00u, ARENA_UNIT0, ARENA_OUT, ARENA_OUT2, ARENA_OUT3, ARENA_OUT4, 1u, cbArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",\"0x%08X\",\"0x%08X\",\"0x%08X\",1,\"0x%08X\"",
            ARENA_UNIT0, ARENA_OUT, ARENA_OUT2, ARENA_OUT3, ARENA_OUT4, cbArg);
        emit_rec(fp, "0x6FD6AA00", "UNITS_GetMonsterSplitSpawnParams113c", c,
            c == 0 ? "player_default" : c == 1 ? "caseHi0_chain_walk" :
            c == 2 ? "caseHi1_uber_cb" : c == 3 ? "caseHi1_null_cb" :
            c == 4 ? "split_0x1ED" : c == 5 ? "rawclass0_baseid_split" : "caseHi2_state_flag8",
            args, regs, 16, asserted, eax, 0x00000000u);
    }

    /* #04 0x6FD70BC0 INVENTORY_FindReagentForTome */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        setup_inv_3grids(ARENA_INV0, ARENA_UNIT0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
        U32(ARENA_UNIT0 + 0x00u) = (c == 5) ? 1u : 0u; U32(ARENA_UNIT0 + 0x60u) = ARENA_INV0;
        setup_item_unit(ARENA_ITEM0, 20u, 6u, ARENA_ITEMDATA0, 0u); /* match tome */
        U16(ARENA_ITEMDATA0 + 0x3Eu) = 1u; /* town portal */
        setup_item_unit(ARENA_ITEM1, 21u, (c == 4) ? 0u : 6u, ARENA_ITEMDATA1, ARENA_INV0); /* grid tome or sword */
        U16(ARENA_ITEMDATA1 + 0x3Eu) = (c == 3) ? 2u : 1u;
        U32(ARENA_GRIDS0 + 0x20u) = ARENA_ITEM1;
        setup_unit_with_statlist(ARENA_ITEM1, 4u, (c == 4) ? 0u : 6u, 21u, ARENA_STATLIST0, ARENA_STATS0, 0u, 0u);
        U16(ARENA_STATLIST0 + 0x4Cu) = 1u;
        U32(ARENA_STATS0 + 0u) = 0x00460000u; U32(ARENA_STATS0 + 4u) = (c == 2) ? 20u : 5u;
        uint32_t invArg = (c == 0) ? 0u : ARENA_INV0;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u}, {0x6FDEFA58u, 8u}, {0x6FDEEFE4u, 0x48u},
            {ARENA_SGPT, 0xC78u}, {ARENA_ITEMSTXT, 0x2000u}, {ARENA_ITEMTYPES, 0x5600u}, {ARENA_INVTXT, 0x1000u},
            {ARENA_ISC + 0x46u * 0x144u, 0x144u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u},
            {ARENA_ITEM1, 0x80u}, {ARENA_ITEMDATA1, 0x80u},
            {ARENA_STATLIST0, 0x60u}, {ARENA_STATS0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 19);
        eax = safe_stdcall3(0x6FD70BC0u, invArg, ARENA_ITEM0, 0u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",0", invArg, ARENA_ITEM0);
        emit_rec(fp, "0x6FD70BC0", "INVENTORY_FindReagentForTome113c", c,
            c == 0 ? "null_inv_0" : c == 1 ? "matches_tome" : c == 2 ? "full_qty_0" :
            c == 3 ? "suffix_mismatch_0" : c == 4 ? "non_tome_skipped" : "monster_owner_match",
            args, regs, 19, asserted, eax, 0xFFFFFFFFu);
    }

    /* #05 0x6FD70E80 INVENTORY_UpdateQuiverComponentDisplay (ecx=pPlayer, ebx=pItem, s1=arr1, s2=arr2, void) */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        setup_inv_3grids(ARENA_INV0, ARENA_UNIT0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
        U32(ARENA_UNIT0 + 0x00u) = 0u; U32(ARENA_UNIT0 + 0x60u) = ARENA_INV0;
        setup_item_unit(ARENA_ITEM0, 30u, (c == 4 || c == 5) ? 12u : (c == 3) ? 0u : 2u, ARENA_ITEMDATA0, ARENA_INV0); /* xbw / 1hs / bow */
        U8(ARENA_ITEMDATA0 + 0x44u) = 4u;
        setup_item_unit(ARENA_ITEM1, 31u, (c == 4 || c == 5) ? 11u : 4u, ARENA_ITEMDATA1, ARENA_INV0); /* lit / quiver */
        U8(ARENA_ITEMDATA1 + 0x44u) = 5u;
        U32(ARENA_CELLS0 + 4u * 4u) = ARENA_ITEM0;
        U32(ARENA_CELLS0 + 5u * 4u) = (c == 2 || c == 4 || c == 5) ? ARENA_ITEM1 : 0u;
        U32(ARENA_INV0 + 0x1Cu) = 4u; /* active hand slot 4 */
        if (c == 4) U32(0x6FDE3368u) = 0x2074696Cu; /* 'lit ' gfx idx 0 -> wait: put at idx 1 for >0 */
        if (c == 4) { U32(0x6FDE3368u) = 0x20787878u; U32(0x6FDE3368u + 4u) = 0x2074696Cu; }
        if (c == 5) { U32(0x6FDE3368u) = 0u; U32(0x6FDE3368u + 4u) = 0u; }
        U32(ARENA_OUT + 4u) = 0x55555555u; U32(ARENA_OUT2 + 4u) = 0x55555555u;
        uint32_t itmArg = (c == 0) ? 0u : (c == 4 || c == 5) ? ARENA_ITEM1 : ARENA_ITEM0;
        if (c == 1) U8(ARENA_ITEMDATA0 + 0x44u) = 2u; /* non-hand bodyLoc */
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u}, {0x6FDEF020u, 0x40u}, {0x6FDED370u, 0x28u}, {0x6FDE3368u, 0x68u},
            {ARENA_SGPT, 0xC78u}, {ARENA_ITEMSTXT, 0x2000u}, {ARENA_ITEMTYPES, 0x5600u}, {ARENA_ITYPEMAT, 0x500u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u}, {ARENA_CELLS0, 0x40u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_ITEM1, 0x80u}, {ARENA_ITEMDATA1, 0x80u},
            {ARENA_OUT, 0x10u}, {ARENA_OUT2, 0x10u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 20);
        eax = safe_ecx_ebx_stack2(0x6FD70E80u, ARENA_UNIT0, itmArg, ARENA_OUT, ARENA_OUT2, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",\"0x%08X\",\"0x%08X\"",
            ARENA_UNIT0, itmArg, ARENA_OUT, ARENA_OUT2);
        emit_rec(fp, "0x6FD70E80", "INVENTORY_UpdateQuiverComponentDisplay113c", c,
            c == 0 ? "null_item_assert" : c == 1 ? "non_hand_loc_noop" :
            c == 2 ? "bow_with_quiver" : c == 3 ? "non_bow_clears" :
            c == 4 ? "xbw_lit_gfx_pos" : "xbw_lit_gfx_0",
            args, regs, 20, asserted, eax, 0x00000000u);
    }

    /* #06 0x6FD70FD0 INVENTORY_FindStackableCompatItemInGrid0 */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        setup_inv_3grids(ARENA_INV0, ARENA_UNIT0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
        setup_item_unit(ARENA_ITEM0, 40u, 1u, ARENA_ITEMDATA0, 0u);
        setup_item_unit(ARENA_ITEM1, 41u, 1u, ARENA_ITEMDATA1, ARENA_INV0);
        setup_item_unit(ARENA_ITEM2, 42u, 1u, ARENA_ITEMDATA2, ARENA_INV0);
        U32(ARENA_GRIDS0 + 0x00u) = ARENA_ITEM1;
        if (c == 4) {
            U32(ARENA_ITEMDATA1 + 0x60u) = ARENA_ITEM2; /* item1 -> item2 -> item3(unused, use ITEM0? no, use ITEM2 as start and ITEM1 as match?): item1->item2, start=item1 returns item1; to test loop, item2->item3? Let's make item1 (qty=40 full) -> item2 -> item0? No, item2 has qty=5, start=item2 returns item2; if item1->item2 and start=item2: while(cur!=start) advances from item1 to item2! */
            setup_unit_with_statlist(ARENA_ITEM2, 4u, 1u, 42u, ARENA_STATLIST1, ARENA_STATS1, 0u, 0u);
            U16(ARENA_STATLIST1 + 0x4Cu) = 1u;
            U32(ARENA_STATS1 + 0u) = 0x00460000u; U32(ARENA_STATS1 + 4u) = 5u;
        }
        setup_unit_with_statlist(ARENA_ITEM1, 4u, 1u, 41u, ARENA_STATLIST0, ARENA_STATS0, 0u, 0u);
        U16(ARENA_STATLIST0 + 0x4Cu) = 1u;
        U32(ARENA_STATS0 + 0u) = 0x00460000u; U32(ARENA_STATS0 + 4u) = (c == 2) ? 40u : 5u;
        uint32_t invArg = (c == 0) ? 0u : ARENA_INV0;
        uint32_t startArg = (c == 3 || c == 4) ? ARENA_ITEM2 : 0u;
        if (c == 3) U32(ARENA_ITEMDATA1 + 0x60u) = 0u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDEFB94u, 8u}, {0x6FDED370u, 0x28u},
            {ARENA_SGPT, 0xC78u}, {ARENA_ITEMSTXT, 0x2000u}, {ARENA_ISC + 0x46u * 0x144u, 0x144u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_ITEM1, 0x80u}, {ARENA_ITEMDATA1, 0x80u},
            {ARENA_ITEM2, 0x80u}, {ARENA_ITEMDATA2, 0x80u},
            {ARENA_STATLIST0, 0x60u}, {ARENA_STATLIST1, 0x60u}, {ARENA_STATS0, 0x40u}, {ARENA_STATS1, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 19);
        eax = safe_stdcall3(0x6FD70FD0u, invArg, ARENA_ITEM0, startArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",\"0x%08X\"", invArg, ARENA_ITEM0, startArg);
        emit_rec(fp, "0x6FD70FD0", "INVENTORY_FindStackableCompatItemInGrid0_113c", c,
            c == 0 ? "null_inv_0" : c == 1 ? "matches_stack" : c == 2 ? "full_stack_0" :
            c == 3 ? "start_after_missing_0" : "advances_to_item2",
            args, regs, 19, asserted, eax, 0xFFFFFFFFu);
    }

    /* #07 0x6FD710B0 INVENTORY_FindStackableCompatItemInBelt */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        setup_inv_3grids(ARENA_INV0, ARENA_UNIT0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
        U32(ARENA_UNIT0 + 0x00u) = (c == 2) ? 1u : 0u; U32(ARENA_UNIT0 + 0x60u) = ARENA_INV0;
        setup_item_unit(ARENA_ITEM0, 42u, 1u, ARENA_ITEMDATA0, 0u);
        setup_item_unit(ARENA_ITEM1, 43u, 1u, ARENA_ITEMDATA1, ARENA_INV0);
        setup_item_unit(ARENA_ITEM2, 44u, 1u, ARENA_ITEMDATA2, ARENA_INV0);
        U32(ARENA_GRIDS0 + 0x20u) = ARENA_ITEM1;
        if (c == 4) {
            U32(ARENA_ITEMDATA1 + 0x60u) = ARENA_ITEM2;
            setup_unit_with_statlist(ARENA_ITEM2, 4u, 1u, 44u, ARENA_STATLIST1, ARENA_STATS1, 0u, 0u);
            U16(ARENA_STATLIST1 + 0x4Cu) = 1u;
            U32(ARENA_STATS1 + 0u) = 0x00460000u; U32(ARENA_STATS1 + 4u) = 5u;
        }
        setup_unit_with_statlist(ARENA_ITEM1, 4u, 1u, 43u, ARENA_STATLIST0, ARENA_STATS0, 0u, 0u);
        U16(ARENA_STATLIST0 + 0x4Cu) = 1u;
        U32(ARENA_STATS0 + 0u) = 0x00460000u; U32(ARENA_STATS0 + 4u) = (c == 5) ? 40u : 5u;
        uint32_t invArg = (c == 0) ? 0u : ARENA_INV0;
        uint32_t startArg = (c == 3 || c == 4) ? ARENA_ITEM2 : 0u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDEFB94u, 8u}, {0x6FDEFA58u, 8u}, {0x6FDEEFE4u, 0x48u},
            {ARENA_SGPT, 0xC78u}, {ARENA_ITEMSTXT, 0x2000u}, {ARENA_INVTXT, 0x1000u},
            {ARENA_ISC + 0x46u * 0x144u, 0x144u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_ITEM1, 0x80u}, {ARENA_ITEMDATA1, 0x80u},
            {ARENA_ITEM2, 0x80u}, {ARENA_ITEMDATA2, 0x80u},
            {ARENA_STATLIST0, 0x60u}, {ARENA_STATLIST1, 0x60u}, {ARENA_STATS0, 0x40u}, {ARENA_STATS1, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 21);
        eax = safe_stdcall3(0x6FD710B0u, invArg, ARENA_ITEM0, startArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",\"0x%08X\"", invArg, ARENA_ITEM0, startArg);
        emit_rec(fp, "0x6FD710B0", "INVENTORY_FindStackableCompatItemInBelt113c", c,
            c == 0 ? "null_inv_0" : c == 1 ? "player_grid2_match" : c == 2 ? "monster_grid2_match" :
            c == 3 ? "start_missing_0" : c == 4 ? "advances_to_item2" : "full_stack_0",
            args, regs, 21, asserted, eax, 0xFFFFFFFFu);
    }

    /* #08 0x6FD7C7C0 ITEMMODS_UpdateSetItemBonusStates (ebx=pItem, s1=dwMask) */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_ITEM0, (c == 0) ? 0u : 4u, 0u, 50u, ARENA_STATLIST0, ARENA_STATS0, ARENA_STATEFLAGS0, 0u);
        U32(ARENA_ITEM0 + 0x14u) = (c == 4) ? 0u : ARENA_ITEMDATA0;
        U32(ARENA_ITEMDATA0 + 0x00u) = 5u; /* set quality */
        U32(ARENA_ITEMDATA0 + 0x34u) = (c == 1) ? 0u : (c == 2 || c == 5) ? 1u : 2u; /* file index into SetItemsTxt */
        /* Pre-create one sublist for state 0xA5 (165) in case 2/5 so addFunc=2 exercises removal & partial */
        U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
        U32(ARENA_STATLIST0 + 0x40u) = ARENA_STATLIST1;
        U32(ARENA_STATLIST1 + 0x08u) = 4u; U32(ARENA_STATLIST1 + 0x0Cu) = 50u;
        U32(ARENA_STATLIST1 + 0x10u) = (c == 5) ? 0x0040u : 0x2040u;
        U32(ARENA_STATLIST1 + 0x14u) = 0xA5u;
        U32(ARENA_STATLIST1 + 0x24u) = ARENA_STATS1; U16(ARENA_STATLIST1 + 0x2Au) = 4u;
        U32(ARENA_STATLIST1 + 0x34u) = ARENA_STATLIST0; /* pParent */
        U32(ARENA_STATLIST1 + 0x38u) = ARENA_ITEM0;     /* pUnit */
        uint32_t maskArg = (c == 1) ? 0x05u : 0x01u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC78u},
            {ARENA_SETITEMSTXT, 0x800u}, {ARENA_SETSTXT, 0x600u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u},
            {ARENA_STATS0, 0x40u}, {ARENA_STATS1, 0x40u}, {ARENA_STATEFLAGS0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 12);
        eax = safe_ebx_stack1(0x6FD7C7C0u, ARENA_ITEM0, maskArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",%u", ARENA_ITEM0, maskArg);
        emit_rec(fp, "0x6FD7C7C0", "ITEMMODS_UpdateSetItemBonusStates113c", c,
            c == 0 ? "non_item_0" : c == 1 ? "addFunc1_partial_mask" :
            c == 2 ? "addFunc2_remove_sublist" : c == 3 ? "addFunc0_returns_0" :
            c == 4 ? "null_itemdata_0" : "addFunc2_mask5_all",
            args, regs, 12, asserted, eax, 0xFFFFFFFFu);
    }

    /* #09 0x6FD81000 UNITS_IsUnitInObjRectRange */
    for (int c = 0; c < 7; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_UNIT0, 0u, 0u, 60u, 0u, 0u, 0u, ARENA_PATH0);
        setup_unit_with_statlist(ARENA_UNIT1, (c == 6) ? 1u : 2u, 0u, 61u, 0u, 0u, 0u, ARENA_PATH1);
        U32(ARENA_UNIT1 + 0x14u) = ARENA_OBJDATA0;
        U32(ARENA_OBJDATA0 + 0x00u) = ARENA_OBJTXT;
        U8(ARENA_OBJTXT + 0xFAu) = (c == 4) ? 0u : 6u; /* nSizeX */
        U8(ARENA_OBJTXT + 0xFBu) = (c == 4) ? 0u : 6u; /* nSizeY */
        U32(ARENA_PATH1 + 0x0Cu) = 50u; U32(ARENA_PATH1 + 0x10u) = 50u;
        uint32_t ox = (c == 1) ? 51u : (c == 2) ? 70u : (c == 4) ? 49u : (c == 5) ? 57u : 52u;
        uint32_t oy = (c == 3) ? 70u : (c == 4) ? 50u : 51u;
        U16(ARENA_PATH0 + 0x02u) = (uint16_t)ox; U16(ARENA_PATH0 + 0x06u) = (uint16_t)oy;
        U32(ARENA_PATH0 + 0x0Cu) = ox; U32(ARENA_PATH0 + 0x10u) = oy;
        uint32_t objArg = (c == 0) ? 0u : ARENA_UNIT1;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {ARENA_SGPT, 0xC78u}, {ARENA_CHARSTATS, 0x600u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_UNIT1, 0xD0u}, {ARENA_PATH0, 0x40u}, {ARENA_PATH1, 0x40u},
            {ARENA_OBJDATA0, 0x40u}, {ARENA_OBJTXT, 0x120u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
        eax = safe_stdcall2(0x6FD81000u, ARENA_UNIT0, objArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_UNIT0, objArg);
        emit_rec(fp, "0x6FD81000", "UNITS_IsUnitInObjRectRange113c", c,
            c == 0 ? "null_obj_0" : c == 1 ? "inside_rect_1" :
            c == 2 ? "x_outside_0" : c == 3 ? "y_outside_0" :
            c == 4 ? "size0_left_edge_0" : c == 5 ? "right_edge_x0_w_1" : "non_obj_0",
            args, regs, 9, asserted, eax, 0xFFFFFFFFu);
    }

    /* #10 0x6FD82890 UNITS_GetVelocity (Unit Defense/Armor calculation) */
    for (int c = 0; c < 8; c++) {
        setup_common_tables();
        uint32_t uType = (c == 1) ? 4u : (c == 4) ? 1u : (c == 6) ? 3u : 0u;
        uint32_t uCls  = (c == 4) ? 10u : 0u;
        uint32_t slPtr = (c == 0) ? 0u : ARENA_STATLIST0;
        setup_unit_with_statlist(ARENA_UNIT0, uType, uCls, 70u, slPtr, ARENA_STATS0, ARENA_STATEFLAGS0, ARENA_PATH0);
        if (c >= 2) {
            U16(ARENA_STATLIST0 + 0x28u) = 5u;
            U16(ARENA_STATLIST0 + 0x4Cu) = 5u;
            U32(ARENA_STATS0 + 0x00u) = 0x00020000u; S32(ARENA_STATS0 + 0x04u) = 40;   /* dex -> +10 */
            U32(ARENA_STATS0 + 0x08u) = 0x00100000u; S32(ARENA_STATS0 + 0x0Cu) = (c == 3) ? 50 : 25; /* def% */
            U32(ARENA_STATS0 + 0x10u) = 0x001F0000u; S32(ARENA_STATS0 + 0x14u) = (c == 7) ? 0x100000 : (c == 3) ? 200 : 80; /* base def */
            U32(ARENA_STATS0 + 0x18u) = 0x00AB0000u; S32(ARENA_STATS0 + 0x1Cu) = 20;   /* item_armor_percent */
            U32(ARENA_STATS0 + 0x20u) = 0x00B60000u; S32(ARENA_STATS0 + 0x24u) = (c == 3 || c == 7) ? 10 : 0; /* armor_bonus */
            if (c == 7) { S32(ARENA_STATS0 + 0x04u) = 0; S32(ARENA_STATS0 + 0x0Cu) = 0; S32(ARENA_STATS0 + 0x1Cu) = 0; }
        }
        if (c == 5) {
            /* Holy Shield state 0x65 active + sublist + equipped shield */
            U32(ARENA_STATEFLAGS0 + (0x65u >> 5) * 4u) = (1u << (0x65u & 31u));
            U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST1 + 0x14u) = 0x65u;
            U32(ARENA_STATLIST1 + 0x24u) = ARENA_STATS1;
            U16(ARENA_STATLIST1 + 0x28u) = 2u; U16(ARENA_STATLIST1 + 0x2Au) = 4u;
            U32(ARENA_STATS1 + 0x00u) = 0x015E0000u; S32(ARENA_STATS1 + 0x04u) = 2; /* skId=2 */
            U32(ARENA_STATS1 + 0x08u) = 0x015F0000u; S32(ARENA_STATS1 + 0x0Cu) = 3; /* skLvl=3 */
            setup_inv_3grids(ARENA_INV0, ARENA_UNIT0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
            U32(ARENA_UNIT0 + 0x60u) = ARENA_INV0;
            setup_item_unit(ARENA_ITEM0, 71u, 5u, ARENA_ITEMDATA0, ARENA_INV0); /* type 0x25/0x33 shield? set cls=13 or type 0x33 */
            U16(ARENA_ITEMSTXT + 5u * 0x1A8u + 0x11Eu) = 0x33u; /* shield type for this case */
            U8(ARENA_ITEMDATA0 + 0x44u) = 5u;
            U32(ARENA_CELLS0 + 5u * 4u) = ARENA_ITEM0;
        }
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u}, {0x6FDED370u, 0x28u}, {ARENA_SGPT, 0xC78u},
            {ARENA_STATESTXT, 0x800u}, {ARENA_SKILLSTXT, 0x1000u}, {ARENA_ISC, 0x1D000u},
            {ARENA_ITEMSTXT, 0x2000u}, {ARENA_ITEMTYPES, 0x5600u}, {ARENA_ITYPEMAT, 0x500u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_PATH0, 0x40u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u}, {ARENA_CELLS0, 0x40u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u},
            {ARENA_STATS0, 0x60u}, {ARENA_STATS1, 0x40u}, {ARENA_STATEFLAGS0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 23);
        eax = safe_stdcall1(0x6FD82890u, ARENA_UNIT0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
        emit_rec(fp, "0x6FD82890", "UNITS_GetVelocity113c", c,
            c == 0 ? "no_statlist_0" : c == 1 ? "item_no_stats_0" :
            c == 2 ? "player_def_dex_pct" : c == 3 ? "player_b6_bonus" :
            c == 4 ? "monster_def_pct" : c == 5 ? "holy_shield_0x65" :
            c == 6 ? "missile_def" : "exact_0x100000_boundary",
            args, regs, 23, asserted, eax, 0xFFFFFFFFu);
    }

    /* #11 0x6FD91F70 UNITS_FindUnitAnimDataRecord */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_UNIT0, 0u, 0u, 80u, 0u, 0u, 0u, 0u);
        uint32_t mode = (c == 1) ? 1u : (c == 2) ? 5u : 0u; /* AM TN 1HS for player mode 0/1 */
        uint32_t utype = (c == 3) ? 1u : 0u;
        uint32_t ucls = (c == 3) ? 10u : 0u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDF0B4Cu, 4u}, {0x6FDF0950u, 12u}, {0x6FDEFB94u, 8u}, {0x6FDF13A4u, 0x34u}, {0x6FDE3368u, 0x68u},
            {ARENA_SGPT, 0xC78u}, {ARENA_CHARSTATS, 0x600u}, {ARENA_MONSTATS, 0x2000u}, {ARENA_MONSTATS2, 0x2000u},
            {ARENA_PLRTYPETBL, 0x480u}, {ARENA_PLRMODETBL, 0x480u}, {ARENA_MONMODETBL, 0x380u},
            {ARENA_ANIMTABLE, 0x4C0u}, {ARENA_ANIMBUCKET0, 0xC0u}, {ARENA_UNIT0, 0xD0u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 16);
        eax = safe_stdcall5(0x6FD91F70u, ARENA_UNIT0, ucls, mode, utype, 0u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",%u,%u,%u,0", ARENA_UNIT0, ucls, mode, utype);
        emit_rec(fp, "0x6FD91F70", "UNITS_FindUnitAnimDataRecord113c", c,
            c == 0 ? "player_tn_bucket_hit" : c == 1 ? "player_fallback_default" :
            c == 2 ? "player_mode5_default" : "monster_default",
            args, regs, 16, asserted, eax, 0xFFFFFFFFu);
    }

    /* #12 0x6FD96600 INVENTORY_FindEquippedSkillChargeItem */
    for (int c = 0; c < 7; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_ITEM0, (c == 0) ? 0u : 4u, 0u, 90u, ARENA_STATLIST0, ARENA_STATS0, 0u, 0u);
        U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
        U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
        U32(ARENA_STATLIST1 + 0x08u) = 4u; U32(ARENA_STATLIST1 + 0x0Cu) = 90u;
        U32(ARENA_STATLIST1 + 0x10u) = 0x40u;
        U32(ARENA_STATLIST1 + 0x24u) = ARENA_STATS1;
        U16(ARENA_STATLIST1 + 0x28u) = 1u; U16(ARENA_STATLIST1 + 0x2Au) = 4u;
        /* stat 0xCC (charges), layer = (skill=2 << 6) | level */
        U32(ARENA_STATS1 + 0u) = (c == 6) ? 0x00CC00BFu : 0x00CC0083u;
        U32(ARENA_STATS1 + 4u) = (c == 4) ? 0u : ((10u << 8) | 5u);
        if (c == 4) {
            /* socketed item in ARENA_ITEM0->pInventory holds the charge! */
            setup_inv_3grids(ARENA_INV0, ARENA_ITEM0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
            U32(ARENA_ITEM0 + 0x60u) = ARENA_INV0;
            U32(ARENA_INV0 + 0x0Cu) = ARENA_ITEM1; /* first item in inv */
            setup_unit_with_statlist(ARENA_ITEM1, 4u, 0u, 91u, ARENA_STATLIST2, ARENA_STATS0, 0u, 0u);
            U32(ARENA_ITEM1 + 0x14u) = ARENA_ITEMDATA1;
            U32(ARENA_ITEMDATA1 + 0x5Cu) = ARENA_INV0;
            U32(ARENA_STATLIST2 + 0x3Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST1 + 0x08u) = 4u; U32(ARENA_STATLIST1 + 0x0Cu) = 91u;
            U32(ARENA_STATLIST1 + 0x10u) = 0x40u;
            U32(ARENA_STATLIST1 + 0x24u) = ARENA_STATS0;
            U16(ARENA_STATLIST1 + 0x28u) = 1u; U16(ARENA_STATLIST1 + 0x2Au) = 4u;
            U32(ARENA_STATS0 + 0u) = 0x00CC0083u; U32(ARENA_STATS0 + 4u) = (8u << 8) | 4u;
        }
        uint32_t skArg = (c == 1) ? 999u : (c == 5) ? 0xFFFFFFFFu : 2u;
        uint32_t lvArg = (c == 2) ? 0u : (c == 6) ? 0x3Fu : 3u;
        U32(ARENA_OUT) = 0x1234u; U32(ARENA_OUT2) = 0x5678u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC78u}, {ARENA_ISC + 0xCCu * 0x144u, 0x144u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_ITEM1, 0x80u}, {ARENA_ITEMDATA1, 0x80u},
            {ARENA_INV0, 0x40u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}, {ARENA_STATLIST2, 0x80u},
            {ARENA_STATS0, 0x40u}, {ARENA_STATS1, 0x40u}, {ARENA_OUT, 0x10u}, {ARENA_OUT2, 0x10u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 16);
        eax = safe_stdcall5(0x6FD96600u, ARENA_ITEM0, skArg, lvArg, ARENA_OUT, ARENA_OUT2, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",%u,%u,\"0x%08X\",\"0x%08X\"",
            ARENA_ITEM0, skArg, lvArg, ARENA_OUT, ARENA_OUT2);
        emit_rec(fp, "0x6FD96600", "INVENTORY_FindEquippedSkillChargeItem113c", c,
            c == 0 ? "non_item_0" : c == 1 ? "oob_skill_0" : c == 2 ? "oob_lvl_0" :
            c == 3 ? "found_on_item_1" : c == 4 ? "found_in_socket_1" :
            c == 5 ? "neg_skill_0" : "lvl_0x3f_boundary_1",
            args, regs, 16, asserted, eax, 0xFFFFFFFFu);
    }

    /* #13 0x6FD97420 ITEMMODS_ApplyCastSkillPropStat (ecx=0, edx=pUnit, s1..s9) */
    for (int c = 0; c < 7; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_ITEM0, 4u, 0u, 100u, ARENA_STATLIST0, ARENA_STATS0, 0u, 0u);
        U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
        U32(ARENA_ITEMDATA0 + 0x04u) = 0x12345678u; U32(ARENA_ITEMDATA0 + 0x08u) = 0x9ABCDEF0u;
        U32(ARENA_ITEMDATA0 + 0x2Cu) = 35u;
        U32(ARENA_PROPENTRY + 0x04u) = (c == 1) ? 999u : (c == 5) ? 0u : (c == 6) ? 32u : 2u; /* skillId */
        S32(ARENA_PROPENTRY + 0x08u) = (c == 3) ? -25 : (c == 4) ? 1 : 20;  /* chance */
        S32(ARENA_PROPENTRY + 0x0Cu) = (c == 2) ? 0 : (c == 3) ? -2 : 6; /* lvl */
        uint32_t propArg = (c == 0) ? 0u : ARENA_PROPENTRY;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC78u},
            {ARENA_SKILLSTXT, 0x2000u}, {ARENA_ISC, 0x10000u},
            {ARENA_PROPENTRY, 0x20u}, {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 10);
        eax = safe_ecx_edx_stack9(0x6FD97420u, 0u, 0u, ARENA_ITEM0, propArg, 0u, 0xC3u, 0u, 0u, 0u, 0x40u, 0u, &asserted);
        snprintf(args, sizeof(args), "0,0,\"0x%08X\",\"0x%08X\",0,195,0,0,0,64,0", ARENA_ITEM0, propArg);
        emit_rec(fp, "0x6FD97420", "ITEMMODS_ApplyCastSkillPropStat113c", c,
            c == 0 ? "null_prop_0" : c == 1 ? "oob_skill_0" : c == 2 ? "lvl0_scaled" :
            c == 3 ? "neg_lvl_neg_chance" : c == 4 ? "chance_1_applied" :
            c == 5 ? "skill_0_applied" : "skill_32_boundary_0",
            args, regs, 10, asserted, eax, 0xFFFFFFFFu);
    }

    /* #14 0x6FD97780 ITEMMODS_ApplyClassSkillsPropStat (ecx=0, edx=pUnit, s1..s7) */
    for (int c = 0; c < 7; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_ITEM0, 4u, 0u, 101u, ARENA_STATLIST0, ARENA_STATS0, 0u, 0u);
        U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
        U32(ARENA_ITEMDATA0 + 0x04u) = 0x11223344u; U32(ARENA_ITEMDATA0 + 0x08u) = 0x55667788u;
        S32(ARENA_PROPENTRY + 0x08u) = (c == 0) ? 0 : 2;
        S32(ARENA_PROPENTRY + 0x0Cu) = (c == 0) ? 0 : 2;
        if (c == 5) {
            U16(ARENA_STATLIST0 + 0x4Cu) = 1u;
            U32(ARENA_STATS0 + 0x00u) = 0x00550000u; S32(ARENA_STATS0 + 0x04u) = 3;
        }
        if (c == 6) U32(ARENA_SGPT + 0xBD4u) = 0x56u;
        uint32_t itemArg = ARENA_ITEM0;
        if (c == 4) U32(ARENA_ITEM0 + 0x5Cu) = 0u; /* null pStatListEx */
        uint32_t statArg = (c == 2) ? 0xB4u : 0x55u; /* 0xB4 maps via +0x61 LUT entry to class 6 */
        uint32_t bNeg = (c == 3 || c == 5) ? 1u : 0u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC78u},
            {ARENA_ISC + 0x53u * 0x144u, 0x144u}, {ARENA_PROPENTRY, 0x20u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
        eax = safe_ecx_edx_stack7(0x6FD97780u, 0u, 0u, itemArg, ARENA_PROPENTRY, statArg, bNeg, 0u, 0x40u, 0u, &asserted);
        snprintf(args, sizeof(args), "0,0,\"0x%08X\",\"0x%08X\",%u,%u,0,64,0", itemArg, ARENA_PROPENTRY, statArg, bNeg);
        emit_rec(fp, "0x6FD97780", "ITEMMODS_ApplyClassSkillsPropStat113c", c,
            c == 0 ? "rolled_0" : c == 1 ? "necro_0x55_1" : c == 2 ? "asn_0xB4_lut_1" :
            c == 3 ? "negate_1" : c == 4 ? "null_item_0" : c == 5 ? "negate_existing_3" : "isc_0x53_boundary",
            args, regs, 9, asserted, eax, 0xFFFFFFFFu);
    }

    /* #15 0x6FD978F0 ITEMMODS_ApplyAmazonSkillsPropStat */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_ITEM0, 4u, 0u, 102u, ARENA_STATLIST0, ARENA_STATS0, 0u, 0u);
        U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
        S32(ARENA_PROPENTRY + 0x08u) = (c == 0) ? 0 : 3;
        S32(ARENA_PROPENTRY + 0x0Cu) = (c == 0) ? 0 : 3;
        if (c == 4) U32(ARENA_SGPT + 0xBD4u) = 0x7Eu;
        uint32_t itemArg = ARENA_ITEM0;
        if (c == 3) U32(ARENA_ITEM0 + 0x5Cu) = 0u; /* null pStatListEx */
        uint32_t bNeg = (c == 2 || c == 4) ? 1u : 0u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC78u},
            {ARENA_ISC + 0x7Eu * 0x144u, 0x144u}, {ARENA_PROPENTRY, 0x20u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
        eax = safe_ecx_edx_stack7(0x6FD978F0u, 0u, 0u, itemArg, ARENA_PROPENTRY, 0x7Eu, bNeg, 0u, 0x40u, 0u, &asserted);
        snprintf(args, sizeof(args), "0,0,\"0x%08X\",\"0x%08X\",126,%u,0,64,0", itemArg, ARENA_PROPENTRY, bNeg);
        emit_rec(fp, "0x6FD978F0", "ITEMMODS_ApplyAmazonSkillsPropStat113c", c,
            c == 0 ? "rolled_0" : c == 1 ? "adds_amazon_3" : c == 2 ? "negate_1" :
            c == 3 ? "null_item_0" : "isc_0x7e_boundary",
            args, regs, 9, asserted, eax, 0xFFFFFFFFu);
    }

    /* #16 0x6FD97980 ITEMMODS_ApplyAddSingleSkillPropStat */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_ITEM0, 4u, 0u, 103u, ARENA_STATLIST0, ARENA_STATS0, 0u, 0u);
        U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
        U32(ARENA_PROPENTRY + 0x04u) = (c == 1) ? 999u : (c == 4) ? 0u : (c == 5) ? 32u : 2u;
        S32(ARENA_PROPENTRY + 0x08u) = (c == 0) ? 0 : 4;
        S32(ARENA_PROPENTRY + 0x0Cu) = (c == 0) ? 0 : 4;
        uint32_t bNeg = (c == 3) ? 1u : 0u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC78u},
            {ARENA_SKILLSTXT, 0x2000u}, {ARENA_ISC + 0x6Bu * 0x144u, 0x144u}, {ARENA_PROPENTRY, 0x20u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 10);
        eax = safe_ecx_edx_stack7(0x6FD97980u, 0u, 0u, ARENA_ITEM0, ARENA_PROPENTRY, 0x6Bu, bNeg, 0u, 0x40u, 0u, &asserted);
        snprintf(args, sizeof(args), "0,0,\"0x%08X\",\"0x%08X\",107,%u,0,64,0", ARENA_ITEM0, ARENA_PROPENTRY, bNeg);
        emit_rec(fp, "0x6FD97980", "ITEMMODS_ApplyAddSingleSkillPropStat113c", c,
            c == 0 ? "rolled_0" : c == 1 ? "oob_skill" : c == 2 ? "applies_skill_4" :
            c == 3 ? "negate_1" : c == 4 ? "skill_0_applies" : "skill_32_boundary_0",
            args, regs, 10, asserted, eax, 0xFFFFFFFFu);
    }

    /* #17 0x6FD97A10 ITEMMODS_ApplyAddDamageTripletPropStat */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_ITEM0, 4u, 0u, 104u, ARENA_STATLIST0, ARENA_STATS0, 0u, 0u);
        U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
        if (c == 1) {
            U16(ARENA_STATLIST0 + 0x4Cu) = 1u;
            U32(ARENA_STATS0 + 0x00u) = 0x00360000u; S32(ARENA_STATS0 + 0x04u) = 15;
        }
        U32(ARENA_PROPENTRY + 0x04u) = (c == 2) ? 0u : 25u; /* len */
        S32(ARENA_PROPENTRY + 0x08u) = 10; /* min */
        S32(ARENA_PROPENTRY + 0x0Cu) = 20; /* max */
        uint32_t baseStat = (c == 3) ? 0x39u : 0x36u; /* cold 0x36..0x38 vs poison 0x39..0x3B */
        uint32_t bNeg = (c == 1) ? 1u : 0u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC78u},
            {ARENA_ISC, 0x10000u}, {ARENA_PROPENTRY, 0x20u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
        eax = safe_ecx_edx_stack7(0x6FD97A10u, 0u, 0u, ARENA_ITEM0, ARENA_PROPENTRY, baseStat, bNeg, 0u, 0x40u, 0u, &asserted);
        snprintf(args, sizeof(args), "0,0,\"0x%08X\",\"0x%08X\",%u,%u,0,64,0", ARENA_ITEM0, ARENA_PROPENTRY, baseStat, bNeg);
        emit_rec(fp, "0x6FD97A10", "ITEMMODS_ApplyAddDamageTripletPropStat113c", c,
            c == 0 ? "cold_triplet" : c == 1 ? "negate_triplet" : c == 2 ? "zero_len" : "poison_triplet",
            args, regs, 9, asserted, eax, 0xFFFFFFFFu);
    }

    /* #18 0x6FD97B20 ITEMMODS_ApplyPackedDamageRangePropStat */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_ITEM0, 4u, 0u, 105u, ARENA_STATLIST0, ARENA_STATS0, 0u, 0u);
        U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
        S32(ARENA_PROPENTRY + 0x08u) = (c == 1) ? -5 : (c == 3) ? 0x500 : 15;
        S32(ARENA_PROPENTRY + 0x0Cu) = (c == 1) ? 30 : (c == 3) ? 0x600 : 45;
        uint32_t statArg = (c == 2) ? 0x32u : 0x30u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC78u},
            {ARENA_ISC, 0x10000u}, {ARENA_PROPENTRY, 0x20u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
        eax = safe_ecx_edx_stack7(0x6FD97B20u, 0u, 0u, ARENA_ITEM0, ARENA_PROPENTRY, statArg, 0u, 0u, 0x40u, 0u, &asserted);
        snprintf(args, sizeof(args), "0,0,\"0x%08X\",\"0x%08X\",%u,0,0,64,0", ARENA_ITEM0, ARENA_PROPENTRY, statArg);
        emit_rec(fp, "0x6FD97B20", "ITEMMODS_ApplyPackedDamageRangePropStat113c", c,
            c == 0 ? "fire_range_pair" : c == 1 ? "clamped_min_range" :
            c == 2 ? "ltng_range_pair" : "oob_min_0x500_assert",
            args, regs, 9, asserted, eax, 0xFFFFFFFFu);
    }

    /* #19 0x6FD97C00 ITEMMODS_ApplyCastSkillOnItemPropStat */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_ITEM0, 4u, 0u, 106u, ARENA_STATLIST0, ARENA_STATS0, 0u, 0u);
        U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
        U32(ARENA_ITEMDATA0 + 0x04u) = 0x1234u; U32(ARENA_ITEMDATA0 + 0x08u) = 0x5678u;
        U32(ARENA_ITEMDATA0 + 0x2Cu) = 40u;
        U32(ARENA_PROPENTRY + 0x04u) = (c == 1) ? 999u : (c == 4) ? 32u : 2u;
        S32(ARENA_PROPENTRY + 0x08u) = (c == 2) ? 0 : 12;
        S32(ARENA_PROPENTRY + 0x0Cu) = (c == 3) ? -3 : 5;
        uint32_t propArg = (c == 0) ? 0u : ARENA_PROPENTRY;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC78u},
            {ARENA_SKILLSTXT, 0x2000u}, {ARENA_ISC, 0x18000u}, {ARENA_PROPENTRY, 0x20u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 10);
        eax = safe_ecx_edx_stack7(0x6FD97C00u, 0u, 0u, ARENA_ITEM0, propArg, 0xCCu, 0u, 0u, 0x40u, 0u, &asserted);
        snprintf(args, sizeof(args), "0,0,\"0x%08X\",\"0x%08X\",204,0,0,64,0", ARENA_ITEM0, propArg);
        emit_rec(fp, "0x6FD97C00", "ITEMMODS_ApplyCastSkillOnItemPropStat113c", c,
            c == 0 ? "null_prop_0" : c == 1 ? "oob_skill_0" : c == 2 ? "zero_charges_default" :
            c == 3 ? "neg_lvl_scaled" : "skill_32_boundary_0",
            args, regs, 10, asserted, eax, 0xFFFFFFFFu);
    }

    /* #20 0x6FD97E20 ITEMMODS_ApplyBaseStatOverridePropStat (ecx=bResetToMin, edx=pUnit, s1..s7) */
    for (int c = 0; c < 7; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_ITEM0, 4u, 5u, 107u, ARENA_STATLIST0, ARENA_STATS0, 0u, 0u);
        U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
        if (c == 6) {
            U16(ARENA_STATLIST0 + 0x4Cu) = 1u;
            U32(ARENA_STATS0 + 0x00u) = 0x00200000u;
            S32(ARENA_STATS0 + 0x04u) = 99;
        }
        U32(ARENA_PROPENTRY + 0x04u) = (c == 1) ? 0u : 25u;
        S32(ARENA_PROPENTRY + 0x08u) = 15;
        S32(ARENA_PROPENTRY + 0x0Cu) = 25;
        uint32_t propArg = (c == 0) ? 0u : ARENA_PROPENTRY;
        uint32_t statArg = (c == 4 || c == 5) ? 0x10u : (c == 6) ? 0x20u : 0x00u;
        uint32_t bReset = (c == 2 || c == 5) ? 1u : 0u;
        uint32_t bNeg   = (c == 3 || c == 5) ? 1u : 0u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u}, {0x6FDEFF6Cu, 4u}, {ARENA_SGPT, 0xC78u},
            {ARENA_ITEMSTXT, 0x2000u}, {ARENA_ITEMTYPES, 0x5600u}, {ARENA_ITYPEMAT, 0x500u}, {ARENA_ITEMSLINK, 0x80u},
            {ARENA_ISC, 0x10000u}, {ARENA_PROPENTRY, 0x20u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 15);
        eax = safe_ecx_edx_stack7(0x6FD97E20u, bReset, 0u, ARENA_ITEM0, propArg, statArg, bNeg, 0u, 0x40u, 0u, &asserted);
        snprintf(args, sizeof(args), "%u,0,\"0x%08X\",\"0x%08X\",%u,%u,0,64,0", bReset, ARENA_ITEM0, propArg, statArg, bNeg);
        emit_rec(fp, "0x6FD97E20", "ITEMMODS_ApplyBaseStatOverridePropStat113c", c,
            c == 0 ? "null_prop_0" : c == 1 ? "val0_returns_0" : c == 2 ? "reset_to_min_1" :
            c == 3 ? "negate_1" : c == 4 ? "ac_0x10_applies" :
            c == 5 ? "ac_0x10_reset_neg" : "stat_0x20_no_reset",
            args, regs, 15, asserted, eax, 0xFFFFFFFFu);
    }

    /* #21 0x6FD996F0 ITEMMODS_ApplyDmgToUndeadPropStat (ecx=bCheckItem, edx=pUnit, s1..s7) */
    for (int c = 0; c < 7; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_ITEM0, (c == 2) ? 0u : 4u, 3u, 108u, ARENA_STATLIST0, ARENA_STATS0, 0u, 0u);
        U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
        if (c == 3) {
            U16(ARENA_STATLIST0 + 0x4Cu) = 1u;
            U32(ARENA_STATS0 + 0x00u) = 0x007F0000u; S32(ARENA_STATS0 + 0x04u) = 25;
        }
        if (c == 6) U32(ARENA_SGPT + 0xBD4u) = 0x7Fu;
        S32(ARENA_PROPENTRY + 0x08u) = 50; S32(ARENA_PROPENTRY + 0x0Cu) = 50;
        uint32_t itemArg = (c == 5) ? 0u : ARENA_ITEM0;
        uint32_t bChk = (c == 2 || c == 4 || c == 5) ? 1u : 0u;
        uint32_t bNeg = (c == 3 || c == 6) ? 1u : 0u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u}, {0x6FDEFF6Cu, 4u}, {ARENA_SGPT, 0xC78u},
            {ARENA_ITEMSTXT, 0x2000u}, {ARENA_ITEMTYPES, 0x5600u}, {ARENA_ITYPEMAT, 0x500u}, {ARENA_ITEMSLINK, 0x80u},
            {ARENA_ISC, 0x10000u}, {ARENA_PROPENTRY, 0x20u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 15);
        eax = safe_ecx_edx_stack7(0x6FD996F0u, bChk, 0u, itemArg, ARENA_PROPENTRY, 7u, bNeg, 0u, 0x40u, 0u, &asserted);
        snprintf(args, sizeof(args), "%u,0,\"0x%08X\",\"0x%08X\",7,%u,0,64,0", bChk, itemArg, ARENA_PROPENTRY, bNeg);
        emit_rec(fp, "0x6FD996F0", "ITEMMODS_ApplyDmgToUndeadPropStat113c", c,
            c == 0 ? "adds_undead_50" : c == 1 ? "adds_undead_ret7" : c == 2 ? "check_non_item_skip" :
            c == 3 ? "negate_undead" : c == 4 ? "check_valid_mace_1" :
            c == 5 ? "check_null_item_assert" : "isc_0x7f_boundary",
            args, regs, 15, asserted, eax, 0xFFFFFFFFu);
    }

    /* #22 0x6FDA2480 STATES_ApplyMonSkillIconToUnit (void) */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_UNIT0, (c == 1) ? 0u : 1u, 10u, 110u, ARENA_STATLIST0, ARENA_STATS0, ARENA_STATEFLAGS0, 0u);
        uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
        uint32_t skId = (c == 3) ? 999u : (c == 5) ? 0u : 2u;
        U16(ARENA_SKILLSTXT + skId * 0x23Cu + 0x16u) = 5u; /* aura state 5 */
        if (c >= 4) {
            /* Attach D2Info (ARENA_OUT3) -> pFirstSkill (ARENA_OUT4) + pre-existing sublist ARENA_STATLIST1 */
            uint32_t ps = ARENA_SKILLSTXT + skId * 0x23Cu;
            U16(ps + 0x96u) = 7u; /* wAuraEvent = 7 */
            U16(ps + 0x98u) = 0x10u; /* wPassiveStat[0] */
            U16(ps + 0x9Au) = 0xFFFFu; /* end */
            U32(ARENA_UNIT0 + 0xA8u) = ARENA_OUT3;
            U32(ARENA_OUT3 + 0x04u) = ARENA_OUT4; /* pFirstSkill */
            U32(ARENA_OUT4 + 0x00u) = ps;
            U32(ARENA_OUT4 + 0x28u) = 3u; /* slvl = 3 at +0x28 */
            U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST0 + 0x40u) = ARENA_STATLIST1;
            U32(ARENA_STATLIST1 + 0x08u) = 1u; U32(ARENA_STATLIST1 + 0x0Cu) = 110u;
            U32(ARENA_STATLIST1 + 0x10u) = 0x40u;
            U32(ARENA_STATLIST1 + 0x14u) = 5u; /* wAuraState = 5 */
            U32(ARENA_STATLIST1 + 0x24u) = ARENA_STATS1;
            U16(ARENA_STATLIST1 + 0x2Au) = 8u;
            U32(ARENA_STATLIST1 + 0x34u) = ARENA_STATLIST0;
            U32(ARENA_STATLIST1 + 0x38u) = ARENA_UNIT0;
        }
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC78u},
            {ARENA_SKILLSTXT, 0x2000u}, {ARENA_STATESTXT, 0x800u}, {ARENA_ISC, 0x1E000u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u},
            {ARENA_STATS0, 0x40u}, {ARENA_STATS1, 0x40u}, {ARENA_STATEFLAGS0, 0x40u},
            {ARENA_OUT3, 0x20u}, {ARENA_OUT4, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 14);
        eax = safe_stdcall2(0x6FDA2480u, uArg, skId, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",%u", uArg, skId);
        emit_rec(fp, "0x6FDA2480", "STATES_ApplyMonSkillIconToUnit113c", c,
            c == 0 ? "null_unit_noop" : c == 1 ? "player_noop" : c == 2 ? "applies_skill2_icon" :
            c == 3 ? "oob_skill_noop" : c == 4 ? "active_skill2_sets_stats" : "active_skill0_sets_stats",
            args, regs, 14, asserted, eax, 0x00000000u);
    }
}

typedef struct {
    uint8_t *buf;
    uint32_t bitpos;
} bs_writer_t;

static void bs_put(bs_writer_t *w, uint32_t val, int nbits) {
    for (int i = 0; i < nbits; i++) {
        if ((val >> i) & 1u) {
            w->buf[w->bitpos >> 3] |= (uint8_t)(1u << (w->bitpos & 7u));
        }
        w->bitpos++;
    }
}

static void emit_i13a_2(FILE *fp) {
    char args[512];
    int asserted = 0;
    uint32_t eax = 0;

    /* Helper bitstream payload bytes at ARENA_BITDATA: valid 1.13c compact/full packets */
    /* We can call ITEMS_ReadItemBitstream directly with initialized D2BitBufferStrc at ARENA_BITSTREAM */

    /* #01 0x6FD7A600 ITEMS_ReadItemBitstream */
    for (int c = 0; c < 9; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_ITEM0, (c == 8) ? 0u : 4u, 0u, 200u, ARENA_STATLIST0, ARENA_STATS0, 0u, ARENA_PATH0);
        U32(ARENA_STATLIST0 + 0x24u) = ARENA_STATS1; /* keep pStats and pMyStats distinct */
        U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
        memset((void *)(uintptr_t)ARENA_BITDATA, 0, 0x80u);
        /* Build valid bits in ARENA_BITDATA depending on c */
        if (c == 0 || c == 8) {
            /* Simple item, mode=3 ground (x=12, y=34), code='1hs ' (0x20736831) */
            uint8_t raw[16] = { 0x00, 0x0C, 0x18, 0x00, 0x44, 0x00, 0x62, 0xD0, 0xE6, 0x40, 0x00 };
            memcpy((void *)(uintptr_t)ARENA_BITDATA, raw, sizeof(raw));
        } else if (c == 1) {
            /* Mode=0 inv, bodyLoc=0, gX=1, gY=2, page=1 (val 2), code='1hs ', sockets=1, dwId, ilvl=30, qual=2(normal) */
            uint8_t raw[24] = { 0x00, 0x00, 0x20, 0x02, 0x08, 0x99, 0x9C, 0x4D, 0x08, 0x12, 0x34, 0x56, 0x78, 0x1E, 0x10, 0x00, 0xFF, 0xFF };
            memcpy((void *)(uintptr_t)ARENA_BITDATA, raw, sizeof(raw));
        } else if (c == 5) {
            /* Throw weapon '1th ' with bHasVersionCoords=1, rare qual=6, 92-bit timestamp, stack qty=12, poison triplet 0x39 */
            bs_writer_t w = { (uint8_t *)(uintptr_t)ARENA_BITDATA, 0u };
            bs_put(&w, 0u, 10); bs_put(&w, 0u, 3); bs_put(&w, 0u, 4); bs_put(&w, 1u, 4); bs_put(&w, 2u, 4); bs_put(&w, 2u, 3);
            bs_put(&w, 0x20687431u, 32); bs_put(&w, 0u, 3); bs_put(&w, 0x11223344u, 32); bs_put(&w, 40u, 7); bs_put(&w, 6u, 4);
            bs_put(&w, 0u, 1); bs_put(&w, 0u, 1);
            bs_put(&w, 1u, 8); bs_put(&w, 2u, 8); bs_put(&w, 0u, 6);
            bs_put(&w, 1u, 1); bs_put(&w, 0x12345678u, 32); bs_put(&w, 0x9ABCDEF0u, 32); bs_put(&w, 0x0F0E0D0Cu, 32);
            bs_put(&w, 12u, 9); bs_put(&w, 1u, 1);
            bs_put(&w, 0x39u, 9); bs_put(&w, 10u, 8); bs_put(&w, 20u, 8); bs_put(&w, 50u, 8);
            bs_put(&w, 0x1FFu, 9);
        } else if (c == 6 || c == 9) {
            /* Armor 'cap ' with AC + stats */
            bs_writer_t w = { (uint8_t *)(uintptr_t)ARENA_BITDATA, 0u };
            bs_put(&w, 0u, 10); bs_put(&w, 0u, 3); bs_put(&w, 0u, 4); bs_put(&w, 0u, 4); bs_put(&w, 0u, 4); bs_put(&w, 1u, 3);
            bs_put(&w, 0x20706163u, 32); /* 'cap ' */
            bs_put(&w, 0u, 3); bs_put(&w, 0x55667788u, 32); bs_put(&w, 25u, 7); bs_put(&w, 2u, 4);
            bs_put(&w, 0u, 1); bs_put(&w, 0u, 1);
            bs_put(&w, 0u, 1); /* 92-bit ts = 0 */
            bs_put(&w, 25u, 10); /* AC */
            bs_put(&w, 12u, 8); bs_put(&w, 10u, 8); bs_put(&w, 0u, 1);
            if (c == 9) U32(ARENA_SGPT + 0xBD4u) = 0x1Fu; /* nIscCount <= 0x1F boundary */
        } else if (c == 7) {
            /* Mace 'mac ' (Item 3, 0x2063616D) has max2=24 at +0x104 -> stat 0x18 */
            U32(ARENA_ITEMSLINK + 0x00u) = 11u;
            U32(ARENA_ITEMSLINK + 0x60u) = 0x2063616Du; U32(ARENA_ITEMSLINK + 0x64u) = 3u;
            /* Note: 'mac ' is < 'cap ', so put at start and shift or just replace slot 0 ('isc ') for this test */
            U32(ARENA_ITEMSLINK + 0x00u) = 10u;
            U32(ARENA_ITEMSLINK + 0x10u) = 0x2063616Du; U32(ARENA_ITEMSLINK + 0x14u) = 3u; /* 'mac ' < 'tsc ' */
            bs_writer_t w = { (uint8_t *)(uintptr_t)ARENA_BITDATA, 0u };
            bs_put(&w, 0u, 10); bs_put(&w, 0u, 3); bs_put(&w, 0u, 4); bs_put(&w, 0u, 4); bs_put(&w, 0u, 4); bs_put(&w, 1u, 3);
            bs_put(&w, 0x2063616Du, 32); /* 'mac ' */
            bs_put(&w, 0u, 3); bs_put(&w, 0x11223344u, 32); bs_put(&w, 25u, 7); bs_put(&w, 2u, 4);
            bs_put(&w, 0u, 1); bs_put(&w, 0u, 1); bs_put(&w, 0u, 1); bs_put(&w, 0u, 1);
        } else {
            /* Normal equip mode, code='cap ', ilvl=50, qual=4 (magic) or 7 (unique), etc. */
            uint8_t raw[24] = { 0x00, 0x00, 0x00, 0x04, 0x18, 0x8B, 0x9B, 0x0B, 0x20, 0xAA, 0xBB, 0xCC, 0xDD, 0x32, (c == 2) ? 0x20u : (c == 3) ? 0x38u : 0x28u, 0x01, 0xFF, 0xFF, 0xFF };
            memcpy((void *)(uintptr_t)ARENA_BITDATA, raw, sizeof(raw));
        }
        U32(ARENA_BITSTREAM + 0x00u) = ARENA_BITDATA;
        U32(ARENA_BITSTREAM + 0x04u) = 0x80u * 8u;
        U32(ARENA_BITSTREAM + 0x08u) = 0u;
        U32(ARENA_BITSTREAM + 0x0Cu) = 0u;
        U32(ARENA_BITSTREAM + 0x10u) = 0u;
        uint32_t bSimp = (c == 0 || c == 8) ? 1u : 0u;
        uint32_t bHas = (c == 1 || c == 5 || c == 6 || c == 7 || c == 9) ? 1u : 0u;
        uint32_t ver = (c == 4) ? 0x5Au : 0x60u;
        U32(ARENA_OUT) = 0u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u}, {0x6FDEFF6Cu, 4u}, {0x6FDEFBBCu, 0x10u},
            {ARENA_SGPT, 0xC78u}, {ARENA_ITEMSTXT, 0x3000u}, {ARENA_ITEMTYPES, 0x5600u}, {ARENA_ITYPEMAT, 0x500u},
            {ARENA_ITEMSLINK, 0x80u}, {ARENA_UNIQUEITEMSTXT, 0x400u}, {ARENA_SETITEMSTXT, 0x800u},
            {ARENA_ISC, 0x10000u}, {ARENA_BITSTREAM, 0x20u}, {ARENA_BITDATA, 0x80u},
            {ARENA_ITEM0, 0xD0u}, {ARENA_ITEMDATA0, 0xA0u}, {ARENA_PATH0, 0x40u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x80u}, {ARENA_STATS1, 0x80u}, {ARENA_OUT, 0x10u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 22);
        eax = safe_stdcall6(0x6FD7A600u, ARENA_ITEM0, ARENA_BITSTREAM, bHas, bSimp, ARENA_OUT, ver, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",%u,%u,\"0x%08X\",%u",
            ARENA_ITEM0, ARENA_BITSTREAM, bHas, bSimp, ARENA_OUT, ver);
        emit_rec(fp, "0x6FD7A600", "ITEMS_ReadItemBitstream113c", c,
            c == 0 ? "simple_ground" : c == 1 ? "normal_with_coords" :
            c == 2 ? "magic_cap" : c == 3 ? "unique_cap" :
            c == 4 ? "ver_0x5a" : c == 5 ? "rare_throw_ts_poison" :
            c == 6 ? "armor_cap_ac" : c == 7 ? "mace_2h_max2" :
            c == 8 ? "non_item_simple_skip" : "isc_0x1f_boundary",
            args, regs, 22, asserted, eax, 0xFFFFFFFFu);
    }

    /* #02 0x6FD7C0C0 ITEMS_ReadCompactEarItemFromBitstream (eax=pItem, edi=pBitStream, s1=bHasCoords, s2=nVersion) */
    for (int c = 0; c < 8; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_ITEM0, (c == 5) ? 0u : 4u, 0u, 205u, ARENA_STATLIST0, ARENA_STATS0, 0u, ARENA_PATH0);
        U32(ARENA_ITEM0 + 0x14u) = (c == 7) ? 0u : ARENA_ITEMDATA0;
        U32(ARENA_ITEMDATA0 + 0x18u) = (c == 1 || c == 5) ? 0x10000u : 0u; /* ear flag */
        memset((void *)(uintptr_t)ARENA_BITDATA, 0, 0x40u);
        if (c == 1) {
            /* Ear: fmt(10)=1, mode(3)=0, bodyLoc(4)=0, gX(4)=2, gY(4)=3, page(3)=2, earCls(3)=1, earLvl(7)=42, name="ab\0" */
            uint8_t raw[16] = { 0x01, 0x00, 0x00, 0x20, 0x64, 0x2A, 0x88, 0x2B, 0x06, 0x00 };
            memcpy((void *)(uintptr_t)ARENA_BITDATA, raw, sizeof(raw));
        } else if (c == 2) {
            /* Ground mode=3 (x=100, y=200), code='gld ' (0x20646C67), 1-bit=0, 12-bit=500 */
            uint8_t raw[16] = { 0x00, 0x0C, 0xC8, 0x00, 0x90, 0x01, 0xCE, 0xD8, 0xC8, 0x40, 0x00, 0x00 };
            memcpy((void *)(uintptr_t)ARENA_BITDATA, raw, sizeof(raw));
        } else if (c == 4) {
            /* Scroll 'isc ' with bHasCoords=1, mode=0, bodyLoc=0, gX=2, gY=3, page=2 */
            bs_writer_t w = { (uint8_t *)(uintptr_t)ARENA_BITDATA, 0u };
            bs_put(&w, 0u, 10); bs_put(&w, 0u, 3);
            bs_put(&w, 0u, 4); bs_put(&w, 2u, 4); bs_put(&w, 3u, 4); bs_put(&w, 2u, 3);
            bs_put(&w, 0x20637369u, 32); /* 'isc ' */
        } else {
            /* Scroll 'tsc ' in inv */
            uint8_t raw[16] = { 0x00, 0x00, 0x00, 0x04, 0xE8, 0xE6, 0xC6, 0x40, 0x00 };
            memcpy((void *)(uintptr_t)ARENA_BITDATA, raw, sizeof(raw));
        }
        if (c == 6) {
            U8(ARENA_ITEMSTXT + 8u * 0x1A8u + 0x12Au) = 1u;
            U8(ARENA_ITEMSTXT + 8u * 0x1A8u + 0x12Bu) = 1u;
            U32(ARENA_SGPT + 0xBD4u) = 0x164u; /* boundary nIscCount <= 0x164 asserts */
        }
        U32(ARENA_BITSTREAM + 0x00u) = ARENA_BITDATA;
        U32(ARENA_BITSTREAM + 0x04u) = 0x40u * 8u;
        U32(ARENA_BITSTREAM + 0x08u) = 0u; U32(ARENA_BITSTREAM + 0x0Cu) = 0u; U32(ARENA_BITSTREAM + 0x10u) = 0u;
        uint32_t itemArg = (c == 0) ? 0u : ARENA_ITEM0;
        uint32_t bHasC = (c == 4 || c == 7) ? 1u : 0u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u}, {0x6FDEFF6Cu, 4u},
            {ARENA_SGPT, 0xC78u}, {ARENA_ITEMSTXT, 0x3000u}, {ARENA_ITEMTYPES, 0x5600u}, {ARENA_ITYPEMAT, 0x500u},
            {ARENA_ITEMSLINK, 0x80u}, {ARENA_ISC, 0x2000u}, {ARENA_BITSTREAM, 0x20u}, {ARENA_BITDATA, 0x40u},
            {ARENA_ITEM0, 0xD0u}, {ARENA_ITEMDATA0, 0xA0u}, {ARENA_PATH0, 0x40u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 17);
        eax = safe_eax_edi_stack2(0x6FD7C0C0u, itemArg, ARENA_BITSTREAM, bHasC, 0x60u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",%u,96", itemArg, ARENA_BITSTREAM, bHasC);
        emit_rec(fp, "0x6FD7C0C0", "ITEMS_ReadCompactEarItemFromBitstream113c", c,
            c == 0 ? "null_item_assert" : c == 1 ? "ear_with_name" : c == 2 ? "gold_ground" :
            c == 3 ? "scroll_tsc" : c == 4 ? "scroll_isc_coords" :
            c == 5 ? "non_item_ear_flag_skip" : c == 6 ? "isc_count_0x164_assert" : "null_pdata_coords",
            args, regs, 17, asserted, eax, 0xFFFFFFFFu);
    }

    /* #03 0x6FD7C470 ITEMS_LoadStatsFromBitstream */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_ITEM0, 4u, 0u, 210u, ARENA_STATLIST0, ARENA_STATS0, 0u, ARENA_PATH0);
        U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
        memset((void *)(uintptr_t)ARENA_BITDATA, 0, 0x40u);
        uint32_t bHasHdr = (c == 0 || c == 1) ? 1u : 0u;
        if (c == 0) {
            /* Bad header != "JM" (0x4D4A) */
            U16(ARENA_BITDATA) = 0x1234u;
        } else if (c == 1) {
            /* "JM" + simple flag 0x02000000 + compact simple ground item */
            U16(ARENA_BITDATA) = 0x4D4Au;
            U32(ARENA_BITDATA + 2u) = 0x02000000u;
            uint8_t rest[12] = { 0x00, 0x0C, 0x18, 0x00, 0x44, 0x00, 0x62, 0xD0, 0xE6, 0x40 };
            memcpy((void *)(uintptr_t)(ARENA_BITDATA + 6u), rest, sizeof(rest));
        } else if (c == 2) {
            /* Ear flag 0x00210000 (no JM header) */
            U32(ARENA_BITDATA) = 0x00210000u;
            uint8_t rest[12] = { 0x01, 0x00, 0x00, 0x20, 0x64, 0x2A, 0x88, 0x2B, 0x06, 0x00 };
            memcpy((void *)(uintptr_t)(ARENA_BITDATA + 4u), rest, sizeof(rest));
        } else if (c == 4) {
            /* Simple item with unknown code 'zzzz' -> ReadItemBitstream returns 0 -> outFail=1 */
            U32(ARENA_BITDATA) = 0x02000010u;
            bs_writer_t w = { (uint8_t *)(uintptr_t)(ARENA_BITDATA + 4u), 0u };
            bs_put(&w, 0u, 10); bs_put(&w, 0u, 3); bs_put(&w, 0u, 4); bs_put(&w, 0u, 4); bs_put(&w, 0u, 4); bs_put(&w, 1u, 3);
            bs_put(&w, 0x7A7A7A7Au, 32);
        } else {
            /* Non-ear normal simple item without JM */
            U32(ARENA_BITDATA) = 0x02000010u;
            uint8_t rest[12] = { 0x00, 0x00, 0x00, 0x04, 0xE8, 0xE6, 0xC6, 0x40 };
            memcpy((void *)(uintptr_t)(ARENA_BITDATA + 4u), rest, sizeof(rest));
        }
        U32(ARENA_OUT) = 99u; U32(ARENA_OUT2) = 99u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u}, {0x6FDEFF6Cu, 4u}, {0x6FDEFBBCu, 0x10u},
            {ARENA_SGPT, 0xC78u}, {ARENA_ITEMSTXT, 0x3000u}, {ARENA_ITEMTYPES, 0x5600u}, {ARENA_ITYPEMAT, 0x500u},
            {ARENA_ITEMSLINK, 0x80u}, {ARENA_BITDATA, 0x40u},
            {ARENA_ITEM0, 0xD0u}, {ARENA_ITEMDATA0, 0xA0u}, {ARENA_PATH0, 0x40u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x80u}, {ARENA_OUT, 0x10u}, {ARENA_OUT2, 0x10u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 18);
        eax = safe_stdcall7(0x6FD7C470u, ARENA_ITEM0, ARENA_BITDATA, 0x40u, bHasHdr, ARENA_OUT, 0x60u, ARENA_OUT2, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",64,%u,\"0x%08X\",96,\"0x%08X\"",
            ARENA_ITEM0, ARENA_BITDATA, bHasHdr, ARENA_OUT, ARENA_OUT2);
        emit_rec(fp, "0x6FD7C470", "ITEMS_LoadStatsFromBitstream113c", c,
            c == 0 ? "bad_jm_fails" : c == 1 ? "jm_simple_ground" : c == 2 ? "ear_compact" :
            c == 3 ? "simple_cap" : "bad_code_res0_fail1",
            args, regs, 18, asserted, eax, 0xFFFFFFFFu);
    }

    /* #04 0x6FD82670 UNITS_GetAnimDataRecord */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_UNIT0, 0u, 0u, 220u, 0u, 0u, 0u, 0u);
        uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
        uint32_t uType = (c == 3) ? 1u : 0u;
        uint32_t uCls = (c == 3) ? 10u : 0u;
        uint32_t mode = (c == 2) ? 5u : 0u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDF0B4Cu, 4u}, {0x6FDF0950u, 12u}, {0x6FDEFB94u, 8u}, {0x6FDF13A4u, 0x34u}, {0x6FDE3368u, 0x68u},
            {ARENA_SGPT, 0xC78u}, {ARENA_CHARSTATS, 0x600u}, {ARENA_MONSTATS, 0x2000u}, {ARENA_MONSTATS2, 0x2000u},
            {ARENA_PLRTYPETBL, 0x480u}, {ARENA_PLRMODETBL, 0x480u}, {ARENA_MONMODETBL, 0x380u},
            {ARENA_ANIMTABLE, 0x4C0u}, {ARENA_ANIMBUCKET0, 0xC0u}, {ARENA_UNIT0, 0xD0u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 16);
        eax = safe_stdcall4(0x6FD82670u, uArg, uType, uCls, mode, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",%u,%u,%u", uArg, uType, uCls, mode);
        emit_rec(fp, "0x6FD82670", "UNITS_GetAnimDataRecord113c", c,
            c == 0 ? "null_unit_assert" : c == 1 ? "player_bucket_sets_u50" :
            c == 2 ? "player_fallback_default" : "monster_default",
            args, regs, 16, asserted, eax, 0xFFFFFFFFu);
    }

    /* #05 0x6FD83110 UNITS_SetUnitAnimMode (void) */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        uint32_t uType = (c == 0) ? 4u : (c == 3) ? 1u : 0u;
        setup_unit_with_statlist(ARENA_UNIT0, uType, (c == 3) ? 10u : 0u, 225u,
                                 ARENA_STATLIST0, ARENA_STATS0, ARENA_STATEFLAGS0, ARENA_PATH0);
        U32(ARENA_UNIT0 + 0x10u) = (c == 1) ? 10u : (c == 2) ? 7u : (c == 4) ? 2u : 1u; /* 2=WL, 10=SC, 7=A1 */
        if (c == 4) {
            U32(ARENA_STATEFLAGS0 + (0x65u >> 5) * 4u) = (1u << (0x65u & 31u));
        }
        U16(ARENA_STATLIST0 + 0x4Cu) = 1u;
        U32(ARENA_STATS0 + 0u) = 0x00450000u; U32(ARENA_STATS0 + 4u) = 120u; /* skill_attack_rate */
        uint32_t uArg = (c == 0) ? ARENA_UNIT0 : ARENA_UNIT0;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDF0B4Cu, 4u}, {0x6FDF0950u, 12u}, {0x6FDEFB94u, 8u}, {0x6FDF13A4u, 0x34u}, {0x6FDE3368u, 0x68u}, {0x6FDDC5F8u, 0x420u}, {0x6FDE4608u, 0x40u},
            {ARENA_SGPT, 0xC78u}, {ARENA_CHARSTATS, 0x600u}, {ARENA_MONSTATS, 0x2000u}, {ARENA_MONSTATS2, 0x2000u},
            {ARENA_PLRTYPETBL, 0x480u}, {ARENA_PLRMODETBL, 0x480u}, {ARENA_MONMODETBL, 0x380u},
            {ARENA_STATESTXT, 0x800u}, {ARENA_STATEMASKS, 0x400u}, {ARENA_ANIMTABLE, 0x4C0u}, {ARENA_ANIMBUCKET0, 0xC0u},
            {ARENA_ISC, 0x10000u}, {ARENA_UNIT0, 0xD0u}, {ARENA_PATH0, 0xA0u}, {ARENA_STATLIST0, 0x80u},
            {ARENA_STATS0, 0x40u}, {ARENA_STATEFLAGS0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 26);
        eax = safe_stdcall3(0x6FD83110u, uArg, 0u, 0u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",0,0", uArg);
        emit_rec(fp, "0x6FD83110", "UNITS_SetUnitAnimMode113c", c,
            c == 0 ? "item_noop" : c == 1 ? "player_cast_mode" :
            c == 2 ? "player_weapon_speed" : c == 3 ? "monster_anim_rate" : "player_walk_state_0x65",
            args, regs, 26, asserted, eax, 0x00000000u);
    }

    /* #06 0x6FD835F0 UNITS_UpdateAnimFrame */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        uint32_t uType = (c == 3) ? 1u : (c == 5) ? 2u : 0u;
        setup_unit_with_statlist(ARENA_UNIT0, uType, (c == 3) ? 10u : 0u, 230u,
                                 ARENA_STATLIST0, ARENA_STATS0, ARENA_STATEFLAGS0, ARENA_PATH0);
        U32(ARENA_UNIT0 + 0x10u) = (c == 1) ? 3u : (c == 2) ? 0x12u : (c == 4) ? 0u : (c == 5) ? 8u : 1u;
        U32(ARENA_UNIT0 + 0x30u) = 5u;
        uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDF0B4Cu, 4u}, {0x6FDF0950u, 12u},
            {0x6FDEFB94u, 8u}, {0x6FDF0A5Cu, 8u}, {0x6FDF13A4u, 0x34u}, {0x6FDE3368u, 0x68u}, {0x6FDDC5F8u, 0x420u}, {0x6FDE4608u, 0x40u},
            {ARENA_SGPT, 0xC78u}, {ARENA_CHARSTATS, 0x600u}, {ARENA_MONSTATS, 0x2000u}, {ARENA_MONSTATS2, 0x2000u},
            {ARENA_PLRTYPETBL, 0x480u}, {ARENA_PLRMODETBL, 0x480u}, {ARENA_MONMODETBL, 0x380u},
            {ARENA_STATESTXT, 0x800u}, {ARENA_STATEMASKS, 0x400u}, {ARENA_ANIMTABLE, 0x4C0u}, {ARENA_ANIMBUCKET0, 0xC0u},
            {ARENA_MONSEQTABLE, 0x200u}, {ARENA_ISC, 0x10000u}, {ARENA_UNIT0, 0xD0u}, {ARENA_PATH0, 0xA0u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x40u}, {ARENA_STATEFLAGS0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 28);
        eax = safe_stdcall1(0x6FD835F0u, uArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", uArg);
        emit_rec(fp, "0x6FD835F0", "UNITS_UpdateAnimFrame113c", c,
            c == 0 ? "null_unit_assert" : c == 1 ? "player_run_mode3" :
            c == 2 ? "player_seq_mode12" : c == 3 ? "monster_neutral" :
            c == 4 ? "player_mode0_resets_frame" : "object_mode8_assert",
            args, regs, 28, asserted, eax, 0xFFFFFFFFu);
    }

    /* #07 0x6FD98BD0 ITEMMODS_ApplyStateSkillTripletMod (ecx=bReset, edx=pUnit, s1..s7) */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_ITEM0, 4u, (c == 1) ? 1u : 0u, 240u, ARENA_STATLIST0, ARENA_STATS0, 0u, 0u);
        U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
        S32(ARENA_PROPENTRY + 0x08u) = 10; S32(ARENA_PROPENTRY + 0x0Cu) = 25;
        uint32_t baseStat = (c == 0 || c == 1) ? 0x15u : 0x39u; /* 0x15 weapon dmg vs 0x39 poison */
        uint32_t bNeg = (c == 3) ? 1u : 0u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u}, {ARENA_SGPT, 0xC78u},
            {ARENA_ITEMSTXT, 0x2000u}, {ARENA_ITEMTYPES, 0x5600u}, {ARENA_ITYPEMAT, 0x500u},
            {ARENA_ISC, 0x20000u}, {ARENA_PROPENTRY, 0x20u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 13);
        eax = safe_ecx_edx_stack7(0x6FD98BD0u, 0u, 0u, ARENA_ITEM0, ARENA_PROPENTRY, baseStat, bNeg, 0u, 0x40u, 0u, &asserted);
        snprintf(args, sizeof(args), "0,0,\"0x%08X\",\"0x%08X\",%u,%u,0,64,0", ARENA_ITEM0, ARENA_PROPENTRY, baseStat, bNeg);
        emit_rec(fp, "0x6FD98BD0", "ITEMMODS_ApplyStateSkillTripletMod113c", c,
            c == 0 ? "weapon_1hs_dmg" : c == 1 ? "throw_weapon_dmg" : c == 2 ? "poison_triplet" : "negate_poison",
            args, regs, 13, asserted, eax, 0xFFFFFFFFu);
    }

    /* #08 0x6FD99AF0 ITEMMODS_ApplyItemModProperty (ecx=bCheckItem, edx=pUnit, s1..s7) */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_ITEM0, (c == 2) ? 0u : 4u, 0u, 245u, ARENA_STATLIST0, ARENA_STATS0, 0u, 0u);
        U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
        S32(ARENA_PROPENTRY + 0x08u) = (c == 3) ? 0 : 15;
        S32(ARENA_PROPENTRY + 0x0Cu) = (c == 3) ? 0 : 15;
        uint32_t bChk = (c == 2) ? 1u : 0u;
        uint32_t bNeg = (c == 1) ? 1u : 0u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC78u},
            {ARENA_ISC, 0x10000u}, {ARENA_PROPENTRY, 0x20u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
        eax = safe_ecx_edx_stack7(0x6FD99AF0u, bChk, 0u, ARENA_ITEM0, ARENA_PROPENTRY, 11u, bNeg, 0u, 0x40u, 0u, &asserted);
        snprintf(args, sizeof(args), "%u,0,\"0x%08X\",\"0x%08X\",11,%u,0,64,0", bChk, ARENA_ITEM0, ARENA_PROPENTRY, bNeg);
        emit_rec(fp, "0x6FD99AF0", "ITEMMODS_ApplyItemModProperty113c", c,
            c == 0 ? "all_maxres_15" : c == 1 ? "negate_maxres" : c == 2 ? "check_non_item_skip" : "rolled_0_noop",
            args, regs, 9, asserted, eax, 0xFFFFFFFFu);
    }

    /* #09 0x6FD99F30 ITEMMODS_RemoveItemModProperty (ecx=bCheckItem, edx=pUnit, s1..s7) */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_ITEM0, (c == 2) ? 0u : 4u, 0u, 246u, ARENA_STATLIST0, ARENA_STATS0, 0u, 0u);
        U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
        S32(ARENA_PROPENTRY + 0x08u) = (c == 3) ? 0 : 20;
        S32(ARENA_PROPENTRY + 0x0Cu) = (c == 3) ? 0 : 20;
        uint32_t bChk = (c == 2) ? 1u : 0u;
        uint32_t bNeg = (c == 1) ? 1u : 0u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC78u},
            {ARENA_ISC, 0x10000u}, {ARENA_PROPENTRY, 0x20u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
        eax = safe_ecx_edx_stack7(0x6FD99F30u, bChk, 0u, ARENA_ITEM0, ARENA_PROPENTRY, 13u, bNeg, 0u, 0x40u, 0u, &asserted);
        snprintf(args, sizeof(args), "%u,0,\"0x%08X\",\"0x%08X\",13,%u,0,64,0", bChk, ARENA_ITEM0, ARENA_PROPENTRY, bNeg);
        emit_rec(fp, "0x6FD99F30", "ITEMMODS_RemoveItemModProperty113c", c,
            c == 0 ? "all_res_20" : c == 1 ? "negate_res" : c == 2 ? "check_non_item_skip" : "rolled_0_noop",
            args, regs, 9, asserted, eax, 0xFFFFFFFFu);
    }

    /* #10 0x6FDBB4A0 MISSILE_ApplyDamageDataToStatList (void) */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_UNIT0, 0u, 0u, 250u, ARENA_STATLIST0, ARENA_STATS0, 0u, 0u);
        setup_unit_with_statlist(ARENA_UNIT1, (c == 0) ? 0u : 3u, 1u, 251u, ARENA_STATLIST1, ARENA_STATS1, 0u, 0u);
        U32(ARENA_UNIT1 + 0x14u) = ARENA_MISDATA0;
        U32(ARENA_DMGDATA0 + 0x00u) = (c == 2) ? 0x707u : 0x101u; /* flags */
        U32(ARENA_DMGDATA0 + 0x04u) = 100u; U32(ARENA_DMGDATA0 + 0x08u) = 200u;
        U32(ARENA_DMGDATA0 + 0x0Cu) = 50u;  U32(ARENA_DMGDATA0 + 0x10u) = 90u;
        if (c == 3) {
            /* Source unit has 0xB4 skill stats on pStatListEx +0x48 */
            U16(ARENA_STATLIST0 + 0x4Cu) = 2u;
            U32(ARENA_STATS0 + 0x00u) = 0x00B40001u; U32(ARENA_STATS0 + 0x04u) = 10u;
            U32(ARENA_STATS0 + 0x08u) = 0x00B40002u; U32(ARENA_STATS0 + 0x0Cu) = 20u;
        }
        uint32_t srcArg = (c == 1) ? 0u : ARENA_UNIT0;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC78u}, {ARENA_ISC, 0x18000u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_UNIT1, 0xD0u}, {ARENA_MISDATA0, 0x40u}, {ARENA_DMGDATA0, 0x80u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}, {ARENA_STATS0, 0x40u}, {ARENA_STATS1, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 12);
        eax = safe_stdcall4(0x6FDBB4A0u, srcArg, ARENA_UNIT1, ARENA_DMGDATA0, 64u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",\"0x%08X\",64", srcArg, ARENA_UNIT1, ARENA_DMGDATA0);
        emit_rec(fp, "0x6FDBB4A0", "MISSILE_ApplyDamageDataToStatList113c", c,
            c == 0 ? "non_missile_noop" : c == 1 ? "null_src_dmg" : c == 2 ? "flags_707_all" : "copies_0xb4_stats",
            args, regs, 12, asserted, eax, 0x00000000u);
    }

    /* #11 0x6FDBBAA0 MISSILE_CalculateDamageData (void) */
    for (int c = 0; c < 11; c++) {
        setup_common_tables();
        setup_unit_with_statlist(ARENA_UNIT0, 0u, 0u, 260u, ARENA_STATLIST0, ARENA_STATS0, 0u, 0u);
        uint32_t mCls = (c == 2 || c == 5 || c == 8 || c == 9) ? 2u : (c == 3 || c == 6) ? 3u : (c == 4 || c == 10) ? 4u : 1u;
        setup_unit_with_statlist(ARENA_UNIT1, (c == 0) ? 0u : 3u, mCls, 261u, ARENA_STATLIST1, ARENA_STATS1, 0u, 0u);
        uint32_t altStatsAddr = (c >= 8) ? (ARENA_STATS0 + 0x80u) : ARENA_STATS0;
        setup_unit_with_statlist(ARENA_UNIT2, 0u, 0u, 262u, ARENA_STATLIST2, altStatsAddr, 0u, 0u);
        U32(ARENA_UNIT1 + 0x14u) = ARENA_MISDATA0;
        U16(ARENA_STATLIST0 + 0x4Cu) = 2u;
        U16(ARENA_STATLIST2 + 0x4Cu) = 2u;
        U32(ARENA_STATS0 + 0x00u) = 0x00150000u; S32(ARENA_STATS0 + 0x04u) = (c == 4) ? -20 : 20; /* min */
        U32(ARENA_STATS0 + 0x08u) = 0x00160000u; S32(ARENA_STATS0 + 0x0Cu) = 40; /* max */
        if (c == 5 || c == 8 || c == 9) {
            U8(ARENA_SKILLSTXT + 5u * 0x23Cu + 0x1A5u) = 0u; /* srcDmg=0 */
        }
        if (c == 8 || c == 9) {
            /* Distinguish pOwner (-200 or 50) vs pMissile (17 or -200) stat 0x19 */
            U16(ARENA_STATLIST0 + 0x4Cu) = 1u;
            U32(ARENA_STATS0 + 0x00u) = 0x00190000u; S32(ARENA_STATS0 + 0x04u) = (c == 8) ? -200 : 50;
            U16(ARENA_STATLIST1 + 0x4Cu) = 1u;
            U32(ARENA_STATS1 + 0x00u) = 0x00190000u; S32(ARENA_STATS1 + 0x04u) = (c == 8) ? 17 : -200;
        }
        if (c == 10) {
            /* Distinguish pOwner vs pAltUnit vs pMissile across 0x11,0x12,0x15,0x16,0x19,0x78,0x79,0x7a */
            U16(ARENA_STATLIST0 + 0x4Cu) = 1u;
            U32(ARENA_STATS0 + 0x00u) = 0x00190000u; S32(ARENA_STATS0 + 0x04u) = -200;
            U16(ARENA_STATLIST2 + 0x4Cu) = 8u;
            U32(altStatsAddr + 0x00u) = 0x00110000u; S32(altStatsAddr + 0x04u) = 10;
            U32(altStatsAddr + 0x08u) = 0x00120000u; S32(altStatsAddr + 0x0Cu) = 40;
            U32(altStatsAddr + 0x10u) = 0x00150000u; S32(altStatsAddr + 0x14u) = 20;
            U32(altStatsAddr + 0x18u) = 0x00160000u; S32(altStatsAddr + 0x1Cu) = 50;
            U32(altStatsAddr + 0x20u) = 0x00190000u; S32(altStatsAddr + 0x24u) = 25;
            U32(altStatsAddr + 0x28u) = 0x00780000u; S32(altStatsAddr + 0x2Cu) = 5;
            U32(altStatsAddr + 0x30u) = 0x00790000u; S32(altStatsAddr + 0x34u) = 3;
            U32(altStatsAddr + 0x38u) = 0x007A0000u; S32(altStatsAddr + 0x3Cu) = 4;
            U16(ARENA_STATLIST1 + 0x4Cu) = 8u;
            U32(ARENA_STATS1 + 0x00u) = 0x00110000u; S32(ARENA_STATS1 + 0x04u) = 88;
            U32(ARENA_STATS1 + 0x08u) = 0x00120000u; S32(ARENA_STATS1 + 0x0Cu) = 99;
            U32(ARENA_STATS1 + 0x10u) = 0x00150000u; S32(ARENA_STATS1 + 0x14u) = 100;
            U32(ARENA_STATS1 + 0x18u) = 0x00160000u; S32(ARENA_STATS1 + 0x1Cu) = 200;
            U32(ARENA_STATS1 + 0x20u) = 0x00190000u; S32(ARENA_STATS1 + 0x24u) = 7;
            U32(ARENA_STATS1 + 0x28u) = 0x00780000u; S32(ARENA_STATS1 + 0x2Cu) = 33;
            U32(ARENA_STATS1 + 0x30u) = 0x00790000u; S32(ARENA_STATS1 + 0x34u) = 11;
            U32(ARENA_STATS1 + 0x38u) = 0x007A0000u; S32(ARENA_STATS1 + 0x3Cu) = 22;
        }
        if (c == 6) {
            /* Equip bow (item 2, invWidth=2) in ARENA_INV0 + MissilesTxt[3]+5 bitMasks+0x18 */
            setup_inv_3grids(ARENA_INV0, ARENA_UNIT0, ARENA_GRIDS0, ARENA_CELLS0, ARENA_CELLS1, ARENA_CELLS2);
            U32(ARENA_UNIT0 + 0x60u) = ARENA_INV0;
            setup_item_unit(ARENA_ITEM0, 263u, 2u, ARENA_ITEMDATA0, ARENA_INV0);
            U8(ARENA_ITEMDATA0 + 0x44u) = 4u;
            U32(ARENA_CELLS0 + 4u * 4u) = ARENA_ITEM0;
            U32(ARENA_INV0 + 0x1Cu) = 4u; /* cursor/active hand slot */
            U8(ARENA_MISSILESTXT + 3u * 0x1A4u + 5u) = 0x40u; /* bit 6 -> bitMasks+0x18 */
        }
        if (c == 7) {
            S16(ARENA_MISSILESTXT + 1u * 0x1A4u + 0x194u) = 0; /* wSkill == 0 */
            U8(ARENA_SKILLSTXT + 0u * 0x23Cu + 0x1A5u) = 99u;
            U8(ARENA_MISSILESTXT + 1u * 0x1A4u + 0x12Du) = 11u;
        }
        uint32_t ownerArg = (c == 0) ? 0u : ARENA_UNIT0;
        uint32_t altArg   = (c == 4 || c == 10) ? ARENA_UNIT2 : 0u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u}, {0x6FDEF020u, 0x40u}, {0x6FDED370u, 0x28u},
            {ARENA_SGPT, 0xC78u}, {ARENA_SKILLSTXT, 0x2000u}, {ARENA_MISSILESTXT, 0x2000u}, {ARENA_ISC, 0x18000u},
            {ARENA_ITEMSTXT, 0x2000u}, {ARENA_ITEMTYPES, 0x5600u}, {ARENA_ITYPEMAT, 0x500u},
            {ARENA_UNIT0, 0xD0u}, {ARENA_UNIT1, 0xD0u}, {ARENA_UNIT2, 0xD0u},
            {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u}, {ARENA_CELLS0, 0x40u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u},
            {ARENA_MISDATA0, 0x40u}, {ARENA_DMGDATA0, 0x80u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}, {ARENA_STATLIST2, 0x80u},
            {ARENA_STATS0, 0x100u}, {ARENA_STATS1, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 27);
        eax = safe_stdcall5(0x6FDBBAA0u, ARENA_DMGDATA0, ownerArg, altArg, ARENA_UNIT1, 5u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",\"0x%08X\",\"0x%08X\",5",
            ARENA_DMGDATA0, ownerArg, altArg, ARENA_UNIT1);
        emit_rec(fp, "0x6FDBBAA0", "MISSILE_CalculateDamageData113c", c,
            c == 0 ? "null_owner_zeroes" : c == 1 ? "skill1_fire_srcdmg" :
            c == 2 ? "skill5_poison_pflags3" : c == 3 ? "nonskill_ltng_srcdmg" :
            c == 4 ? "scale128_alt_stun" : c == 5 ? "skill5_srcdmg0" :
            c == 6 ? "weapon_bow_half_srcdmg" : c == 7 ? "wskill0_uses_missile" :
            c == 8 ? "owner_vs_missile_0x19" : c == 9 ? "missile_0x19_clamp_neg90" :
            "scale128_alt_vs_missile_stats",
            args, regs, 27, asserted, eax, 0x00000000u);
    }
}

int main(int argc, char **argv) {
    g_arena = (uint8_t *)VirtualAlloc((LPVOID)ARENA_BASE, ARENA_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
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

    const char *out1 = (argc > 1) ? argv[1] : "i13a-1-vectors.ndjson";
    const char *out2 = (argc > 2) ? argv[2] : "i13a-2-vectors.ndjson";

    FILE *fp1 = fopen(out1, "wb");
    if (!fp1) return 1;
    emit_i13a_1(fp1);
    fclose(fp1);

    FILE *fp2 = fopen(out2, "wb");
    if (!fp2) return 1;
    emit_i13a_2(fp2);
    fclose(fp2);

    TerminateProcess(GetCurrentProcess(), 0);
    return 0;
}
