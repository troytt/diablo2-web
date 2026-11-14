/*
 * k1r13-laneA-it14-emitter.c
 *
 * Real-DLL Wine differential vector emitter for Iteration 14 Lane A (36 VAs):
 *   - I14A-1 (10 VAs -> i14a-1-vectors.ndjson)
 *   - I14A-2 (20 VAs -> i14a-2-vectors.ndjson)
 *   - I14A-3 ( 6 VAs -> i14a-3-vectors.ndjson)
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
#define ARENA_DRLG0          (ARENA_BASE + 0x1000u)
#define ARENA_LEVEL0         (ARENA_BASE + 0x1600u)
#define ARENA_LEVEL1         (ARENA_BASE + 0x1900u)
#define ARENA_LEVEL2         (ARENA_BASE + 0x1C00u)
#define ARENA_LEVEL3         (ARENA_BASE + 0x1F00u)
#define ARENA_LEVEL4         (ARENA_BASE + 0x2200u)
#define ARENA_LEVEL5         (ARENA_BASE + 0x2500u)
#define ARENA_ROOMEX0        (ARENA_BASE + 0x2800u)
#define ARENA_ROOMEX1        (ARENA_BASE + 0x2A00u)
#define ARENA_ROOMEX2        (ARENA_BASE + 0x2C00u)
#define ARENA_ROOMEX3        (ARENA_BASE + 0x2E00u)
#define ARENA_ROOM0          (ARENA_BASE + 0x3000u)
#define ARENA_ROOM1          (ARENA_BASE + 0x3200u)
#define ARENA_ROOM2          (ARENA_BASE + 0x3400u)
#define ARENA_ROOMLIST0      (ARENA_BASE + 0x3600u)
#define ARENA_UNIT0          (ARENA_BASE + 0x3800u)
#define ARENA_UNIT1          (ARENA_BASE + 0x3A00u)
#define ARENA_UNIT2          (ARENA_BASE + 0x3C00u)
#define ARENA_SEARCH0        (ARENA_BASE + 0x3E00u)
#define ARENA_MAP0           (ARENA_BASE + 0x4000u)
#define ARENA_MAP1           (ARENA_BASE + 0x4200u)
#define ARENA_GRID0          (ARENA_BASE + 0x4400u)
#define ARENA_GRID1          (ARENA_BASE + 0x4500u)
#define ARENA_CELLS0         (ARENA_BASE + 0x4600u)
#define ARENA_CELLS1         (ARENA_BASE + 0x4A00u)
#define ARENA_ROWOFS0        (ARENA_BASE + 0x4E00u)
#define ARENA_WARP0          (ARENA_BASE + 0x5000u)
#define ARENA_WARP1          (ARENA_BASE + 0x5100u)
#define ARENA_WARP2          (ARENA_BASE + 0x5200u)
#define ARENA_WARP3          (ARENA_BASE + 0x5300u)
#define ARENA_LIST0          (ARENA_BASE + 0x5400u)
#define ARENA_OUT0           (ARENA_BASE + 0x5800u)
#define ARENA_STR0           (ARENA_BASE + 0x5A00u)
#define ARENA_FILE0          (ARENA_BASE + 0x5C00u)
#define ARENA_DS1            (ARENA_BASE + 0x6000u)
#define ARENA_LEVELDEF       (ARENA_BASE + 0x10000u)
#define ARENA_LVLMAZE        (ARENA_BASE + 0x20000u)
#define ARENA_LVLPREST       (ARENA_BASE + 0x30000u)
#define ARENA_TILEGRID0      (ARENA_BASE + 0x40000u)
#define ARENA_TILECELLS0     (ARENA_BASE + 0x41000u)

#define U32(addr) (*(volatile uint32_t *)((uintptr_t)(addr)))
#define U16(addr) (*(volatile uint16_t *)((uintptr_t)(addr)))
#define U8(addr)  (*(volatile uint8_t  *)((uintptr_t)(addr)))
#define S32(addr) (*(volatile int32_t  *)((uintptr_t)(addr)))

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
static uint32_t g_orig_iat_10102   = 0;
static uint32_t g_orig_iat_10103   = 0;
static uint32_t g_orig_iat_10104   = 0;
static uint32_t g_orig_iat_10105   = 0;
static uint32_t g_orig_iat_10042   = 0;
static uint32_t g_orig_iat_10043   = 0;



static uint32_t __fastcall stub_fog_10102(uint32_t ecx_name, uint32_t edx_phFile) {
    if (ecx_name == 0u) return 0u;
    uint32_t h = U32(ecx_name + 0x10u);
    if (edx_phFile != 0u) U32(edx_phFile) = h;
    return h != 0u ? 1u : 0u;
}
static uint32_t __fastcall stub_fog_10103(uint32_t ecx_hFile) {
    (void)ecx_hFile;
    return 1u;
}
static uint32_t __fastcall stub_fog_10104(
    uint32_t ecx_hFile, uint32_t edx_pBuf, uint32_t nSize,
    uint32_t pdwRead, uint32_t a5, uint32_t a6, uint32_t a7) {
    (void)a5; (void)a6; (void)a7;
    if (ecx_hFile == 0u || edx_pBuf == 0u || (int32_t)nSize < 0) return 0u;
    memcpy((void *)(uintptr_t)edx_pBuf, (const void *)(uintptr_t)ecx_hFile, nSize);
    if (pdwRead != 0u) U32(pdwRead) = nSize;
    return 1u;
}
static uint32_t __fastcall stub_fog_10105(uint32_t ecx_hFile, uint32_t edx_lpHigh) {
    if (ecx_hFile == 0u) return 0u;
    uint32_t low = U32(ecx_hFile);
    if (edx_lpHigh != 0u) U32(edx_lpHigh) = U32(ecx_hFile + 4u);
    return low;
}

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

static uint32_t __fastcall stub_fog_10042(uint32_t size, const char *szFile, uint32_t nLine, uint32_t u0) {
    return stub_fog_10045(0u, size, szFile, nLine, u0);
}
static uint32_t __fastcall stub_fog_10043(uint32_t pMem, const char *szFile, uint32_t nLine, uint32_t u0) {
    return stub_fog_10046(0u, pMem, szFile, nLine, u0);
}

static void install_iat_hooks(void) {
    U32(0x6FDD90D4u) = (uint32_t)(uintptr_t)&stub_fog_assert_line;
    U32(0x6FDD90D0u) = (uint32_t)(uintptr_t)&stub_fog_10045;
    U32(0x6FDD90CCu) = (uint32_t)(uintptr_t)&stub_fog_10046;
    U32(0x6FDD90ACu) = (uint32_t)(uintptr_t)&stub_fog_10047;
    U32(0x6FDD90E0u) = (uint32_t)(uintptr_t)&stub_fog_10102;
    U32(0x6FDD90E8u) = (uint32_t)(uintptr_t)&stub_fog_10103;
    U32(0x6FDD90DCu) = (uint32_t)(uintptr_t)&stub_fog_10104;
    U32(0x6FDD90F0u) = (uint32_t)(uintptr_t)&stub_fog_10105;
    U32(0x6FDD90A0u) = (uint32_t)(uintptr_t)&stub_fog_10042;
    U32(0x6FDD909Cu) = (uint32_t)(uintptr_t)&stub_fog_10043;
}

static void restore_iat_hooks(void) {
    U32(0x6FDD90D4u) = g_orig_iat_assert;
    U32(0x6FDD90D0u) = g_orig_iat_alloc;
    U32(0x6FDD90CCu) = g_orig_iat_free;
    U32(0x6FDD90ACu) = g_orig_iat_realloc;
    U32(0x6FDD90E0u) = g_orig_iat_10102;
    U32(0x6FDD90E8u) = g_orig_iat_10103;
    U32(0x6FDD90DCu) = g_orig_iat_10104;
    U32(0x6FDD90F0u) = g_orig_iat_10105;
    U32(0x6FDD90A0u) = g_orig_iat_10042;
    U32(0x6FDD909Cu) = g_orig_iat_10043;
}

typedef uint32_t (__stdcall *stdcall1_t)(uint32_t);
typedef uint32_t (__stdcall *stdcall2_t)(uint32_t, uint32_t);
typedef uint32_t (__stdcall *stdcall3_t)(uint32_t, uint32_t, uint32_t);
typedef uint32_t (__stdcall *stdcall4_t)(uint32_t, uint32_t, uint32_t, uint32_t);
typedef uint32_t (__stdcall *stdcall5_t)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
typedef uint32_t (__fastcall *fastcall1_t)(uint32_t);

typedef struct {
    uint32_t fn;
    uint32_t r_eax;
    uint32_t r_ecx;
    uint32_t r_edx;
    uint32_t r_ebx;
    uint32_t r_esi;
    uint32_t r_edi;
    uint32_t s[6];
    uint32_t ret;
} CallPkt;

static volatile CallPkt g_pkt;

static __attribute__((noinline)) uint32_t call_eax(uint32_t fn, uint32_t eax_val) {
    g_pkt.fn = fn;
    g_pkt.r_eax = eax_val;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "movl 4(%0), %%eax\n\t"
        "call *0(%0)\n\t"
        "movl %%eax, 52(%0)\n\t"
        : "+S"(base)
        :
        : "eax", "ecx", "edx", "edi", "cc", "memory"
    );
    return g_pkt.ret;
}

static __attribute__((noinline)) uint32_t call_ecx(uint32_t fn, uint32_t ecx_val) {
    g_pkt.fn = fn;
    g_pkt.r_ecx = ecx_val;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "movl 8(%0), %%ecx\n\t"
        "call *0(%0)\n\t"
        "movl %%eax, 52(%0)\n\t"
        : "+S"(base)
        :
        : "eax", "ecx", "edx", "edi", "cc", "memory"
    );
    return g_pkt.ret;
}

static __attribute__((noinline)) uint32_t call_esi(uint32_t fn, uint32_t esi_val) {
    g_pkt.fn = fn;
    g_pkt.r_esi = esi_val;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "pushl %%esi\n\t"
        "movl 20(%0), %%esi\n\t"
        "call *0(%0)\n\t"
        "movl %%eax, 52(%0)\n\t"
        "popl %%esi\n\t"
        : "+D"(base)
        :
        : "eax", "ecx", "edx", "cc", "memory"
    );
    return g_pkt.ret;
}

static __attribute__((noinline)) uint32_t call_eax_stack1(uint32_t fn, uint32_t eax_val, uint32_t s1) {
    g_pkt.fn = fn;
    g_pkt.r_eax = eax_val;
    g_pkt.s[0] = s1;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "pushl 28(%0)\n\t"
        "movl 4(%0), %%eax\n\t"
        "call *0(%0)\n\t"
        "movl %%eax, 52(%0)\n\t"
        : "+S"(base)
        :
        : "eax", "ecx", "edx", "edi", "cc", "memory"
    );
    return g_pkt.ret;
}

static __attribute__((noinline)) uint32_t call_ebx_stack2(uint32_t fn, uint32_t ebx_val, uint32_t s1, uint32_t s2) {
    g_pkt.fn = fn;
    g_pkt.r_ebx = ebx_val;
    g_pkt.s[0] = s1;
    g_pkt.s[1] = s2;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "pushl %%ebx\n\t"
        "pushl 32(%0)\n\t"
        "pushl 28(%0)\n\t"
        "movl 16(%0), %%ebx\n\t"
        "call *0(%0)\n\t"
        "movl %%eax, 52(%0)\n\t"
        "popl %%ebx\n\t"
        : "+S"(base)
        :
        : "eax", "ecx", "edx", "edi", "cc", "memory"
    );
    return g_pkt.ret;
}

static __attribute__((noinline)) uint32_t call_eax_stack2(uint32_t fn, uint32_t eax_val, uint32_t s1, uint32_t s2) {
    g_pkt.fn = fn;
    g_pkt.r_eax = eax_val;
    g_pkt.s[0] = s1;
    g_pkt.s[1] = s2;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "pushl 32(%0)\n\t"
        "pushl 28(%0)\n\t"
        "movl 4(%0), %%eax\n\t"
        "call *0(%0)\n\t"
        "movl %%eax, 52(%0)\n\t"
        : "+S"(base)
        :
        : "eax", "ecx", "edx", "edi", "cc", "memory"
    );
    return g_pkt.ret;
}

static __attribute__((noinline)) uint32_t call_esi_stack2(uint32_t fn, uint32_t esi_val, uint32_t s1, uint32_t s2) {
    g_pkt.fn = fn;
    g_pkt.r_esi = esi_val;
    g_pkt.s[0] = s1;
    g_pkt.s[1] = s2;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "pushl %%esi\n\t"
        "pushl 32(%0)\n\t"
        "pushl 28(%0)\n\t"
        "movl 20(%0), %%esi\n\t"
        "call *0(%0)\n\t"
        "movl %%eax, 52(%0)\n\t"
        "popl %%esi\n\t"
        : "+D"(base)
        :
        : "eax", "ecx", "edx", "cc", "memory"
    );
    return g_pkt.ret;
}

static __attribute__((noinline)) uint32_t call_esi_stack3(uint32_t fn, uint32_t esi_val, uint32_t s1, uint32_t s2, uint32_t s3) {
    g_pkt.fn = fn;
    g_pkt.r_esi = esi_val;
    g_pkt.s[0] = s1;
    g_pkt.s[1] = s2;
    g_pkt.s[2] = s3;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "pushl %%esi\n\t"
        "pushl 36(%0)\n\t"
        "pushl 32(%0)\n\t"
        "pushl 28(%0)\n\t"
        "movl 20(%0), %%esi\n\t"
        "call *0(%0)\n\t"
        "movl %%eax, 52(%0)\n\t"
        "popl %%esi\n\t"
        : "+D"(base)
        :
        : "eax", "ecx", "edx", "cc", "memory"
    );
    return g_pkt.ret;
}

static __attribute__((noinline)) uint32_t call_eax_stack4(
    uint32_t fn, uint32_t eax_val, uint32_t s1, uint32_t s2, uint32_t s3, uint32_t s4) {
    g_pkt.fn = fn;
    g_pkt.r_eax = eax_val;
    g_pkt.s[0] = s1; g_pkt.s[1] = s2; g_pkt.s[2] = s3; g_pkt.s[3] = s4;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "pushl 40(%0)\n\t"
        "pushl 36(%0)\n\t"
        "pushl 32(%0)\n\t"
        "pushl 28(%0)\n\t"
        "movl 4(%0), %%eax\n\t"
        "call *0(%0)\n\t"
        "movl %%eax, 52(%0)\n\t"
        : "+S"(base)
        :
        : "eax", "ecx", "edx", "edi", "cc", "memory"
    );
    return g_pkt.ret;
}

_Static_assert(offsetof(CallPkt, s) == 28, "CallPkt.s offset must be 28");
_Static_assert(offsetof(CallPkt, ret) == 52, "CallPkt.ret offset must be 52");

#define SAFE_BODY(call_expr) \
    volatile uint32_t ret = 0; \
    g_assert_line = 0; \
    *pAsserted = 0; \
    install_iat_hooks(); \
    if (setjmp(g_jmp_buf) == 0) { \
        g_in_test_call = 1; \
        ret = (uint32_t)(call_expr); \
        g_in_test_call = 0; \
    } else { \
        *pAsserted = 1; \
    } \
    restore_iat_hooks(); \
    return ret

static __attribute__((noinline)) uint32_t safe_stdcall1(uint32_t va, uint32_t a0, int *pAsserted) {
    SAFE_BODY(((stdcall1_t)(uintptr_t)va)(a0));
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
static __attribute__((noinline)) uint32_t safe_fastcall1(uint32_t va, uint32_t a0, int *pAsserted) {
    SAFE_BODY(((fastcall1_t)(uintptr_t)va)(a0));
}
static __attribute__((noinline)) uint32_t safe_eax(uint32_t va, uint32_t a0, int *pAsserted) {
    SAFE_BODY(call_eax(va, a0));
}
static __attribute__((noinline)) uint32_t safe_ecx(uint32_t va, uint32_t a0, int *pAsserted) {
    SAFE_BODY(call_ecx(va, a0));
}
static __attribute__((noinline)) uint32_t safe_esi(uint32_t va, uint32_t a0, int *pAsserted) {
    SAFE_BODY(call_esi(va, a0));
}
static __attribute__((noinline)) uint32_t safe_eax_stack1(uint32_t va, uint32_t a0, uint32_t s1, int *pAsserted) {
    SAFE_BODY(call_eax_stack1(va, a0, s1));
}
static __attribute__((noinline)) uint32_t safe_ebx_stack2(uint32_t va, uint32_t a0, uint32_t s1, uint32_t s2, int *pAsserted) {
    SAFE_BODY(call_ebx_stack2(va, a0, s1, s2));
}
static __attribute__((noinline)) uint32_t safe_eax_stack2(uint32_t va, uint32_t a0, uint32_t s1, uint32_t s2, int *pAsserted) {
    SAFE_BODY(call_eax_stack2(va, a0, s1, s2));
}
static __attribute__((noinline)) uint32_t safe_esi_stack2(uint32_t va, uint32_t a0, uint32_t s1, uint32_t s2, int *pAsserted) {
    SAFE_BODY(call_esi_stack2(va, a0, s1, s2));
}
static __attribute__((noinline)) uint32_t safe_esi_stack3(uint32_t va, uint32_t a0, uint32_t s1, uint32_t s2, uint32_t s3, int *pAsserted) {
    SAFE_BODY(call_esi_stack3(va, a0, s1, s2, s3));
}
static __attribute__((noinline)) uint32_t safe_eax_stack4(uint32_t va, uint32_t a0, uint32_t s1, uint32_t s2, uint32_t s3, uint32_t s4, int *pAsserted) {
    SAFE_BODY(call_eax_stack4(va, a0, s1, s2, s3, s4));
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
            va, name, case_idx, note, args_json, g_pre_buf, ret_eax & ret_mask, ret_mask);
        emit_regions_json(fp, regions, reg_count);
        fputs("}}\n", fp);
        fflush(fp);
    }
}

static void reset_env(void) {
    memset(g_arena, 0, 0x50000u);
    memset(g_heap, 0, 0x10000u);
    g_heap_top = HEAP_BASE;
    U32(0x6FDE9E1Cu) = ARENA_SGPT;
    U32(0x6FDF0B38u) = ARENA_LEVELDEF;
    U32(0x6FDF0B3Cu) = ARENA_LVLPREST;
    U32(0x6FDF147Cu) = 0u;
    U32(0x6FDF1480u) = 0u;
    U32(0x6FDF09B4u) = 0u;
    U32(ARENA_SGPT + 0xA80u) = 100u;
    U32(ARENA_SGPT + 0xC5Cu) = 136u;
    U32(ARENA_SGPT + 0xC60u) = ARENA_LVLMAZE;
    U32(ARENA_SGPT + 0xC64u) = 136u;
    U32(ARENA_SGPT + 0xC68u) = 136u;
    U32(ARENA_SGPT + 0xCF4u) = ARENA_LVLPREST;
    U32(ARENA_SGPT + 0xCF8u) = 136u;
    for (uint32_t i = 0; i < 136u; i++) {
        uint32_t def = ARENA_LEVELDEF + i * 0x9Cu;
        uint32_t sz = (i == 76u) ? 128u : 64u;
        U32(def + 0x0Cu) = sz;
        U32(def + 0x10u) = sz;
        U32(def + 0x14u) = sz;
        U32(def + 0x18u) = sz;
        U32(def + 0x1Cu) = sz;
        U32(def + 0x20u) = sz;
        uint32_t lp = ARENA_LVLPREST + i * 0x1B0u;
        U32(lp + 0x00u) = i;
        U32(lp + 0x04u) = i;
        uint32_t mz = ARENA_LVLMAZE + i * 0x18u;
        U32(mz + 0x00u) = i;
        U32(mz + 0x04u) = 4u;
        U32(mz + 0x08u) = 4u;
        U32(mz + 0x0Cu) = 4u;
        U32(mz + 0x10u) = 16u;
        U32(mz + 0x14u) = 16u;
    }
}

static void setup_drlg_6_levels(uint32_t seedLo, uint32_t seedHi, uint8_t diff) {
    U32(ARENA_DRLG0 + 0x00u) = seedLo;
    U32(ARENA_DRLG0 + 0x04u) = seedHi;
    U8(ARENA_DRLG0 + 0x450u) = diff;
    U32(ARENA_DRLG0 + 0x478u) = 0u;
    U32(ARENA_DRLG0 + 0x47Cu) = ARENA_LEVEL0;
    U8(ARENA_DRLG0 + 0x480u) = 1u;
    uint32_t lvls[6] = { ARENA_LEVEL0, ARENA_LEVEL1, ARENA_LEVEL2, ARENA_LEVEL3, ARENA_LEVEL4, ARENA_LEVEL5 };
    for (int i = 0; i < 6; i++) {
        U32(lvls[i] + 0x00u) = 2u; /* MAZE */
        U32(lvls[i] + 0x14u) = ARENA_ROOMEX0;
        U32(lvls[i] + 0x1B4u) = ARENA_DRLG0;
        U32(lvls[i] + 0x1C0u) = 3u;
        U32(lvls[i] + 0x1C4u) = seedLo + (uint32_t)i * 17u;
        U32(lvls[i] + 0x1C8u) = seedHi;
        U32(lvls[i] + 0x1ACu) = (i < 5) ? lvls[i + 1] : 0u;
    }
    U32(ARENA_LEVEL0 + 0x1D0u) = 76u;
    U32(ARENA_LEVEL1 + 0x1D0u) = 77u;
    U32(ARENA_LEVEL2 + 0x1D0u) = 78u;
    U32(ARENA_LEVEL3 + 0x1D0u) = 79u;
    U32(ARENA_LEVEL4 + 0x1D0u) = 80u;
    U32(ARENA_LEVEL5 + 0x1D0u) = 81u;
}

static uint32_t __attribute__((fastcall)) test_uf_cb_even_unit(uint32_t pUnit, uint32_t pFilter) {
    (void)pFilter;
    return (U32(pUnit + 0x04u) & 1u) == 0u ? 1u : 0u;
}

static void emit_i14a_1(FILE *fp) {
    static const mem_region_t regs[] = {
        { 0x6FDE9E1Cu, 0x04u },
        { 0x6FDF0B38u, 0x04u },
        { 0x6FDF0B3Cu, 0x04u },
        { ARENA_SGPT + 0xC5Cu, 0xA0u },
        { ARENA_LEVELDEF, 0x5300u },
        { ARENA_LVLMAZE, 0x0D00u },
        { ARENA_LVLPREST, 0x9000u },
        { ARENA_DRLG0, 0x490u },
        { ARENA_LEVEL0, 0x240u },
        { ARENA_LEVEL1, 0x240u },
        { ARENA_LEVEL2, 0x240u },
        { ARENA_ROOMEX0, 0x100u },
        { ARENA_ROOMEX1, 0x100u },
        { ARENA_MAP0, 0x100u },
        { ARENA_MAP1, 0x100u },
        { ARENA_GRID0, 0x80u },
        { ARENA_CELLS0, 0x100u },
        { ARENA_ROWOFS0, 0x80u },
        { ARENA_DS1, 0x100u },
        { ARENA_UNIT0, 0x100u },
        { ARENA_UNIT1, 0x100u },
        { ARENA_OUT0, 0x40u },
        { ARENA_TILEGRID0, 0x100u },
        { ARENA_TILECELLS0, 0x100u },
        { ARENA_FILE0, 0x120u },
        { ARENA_STR0, 0x80u },
        { 0x6FDF09B4u, 0x04u },
        { ARENA_SGPT + 0xA80u, 0x04u },
        { 0x6FDF147Cu, 0x04u },
        { 0x6FDF1480u, 0x04u },
    };
    const int nregs = (int)(sizeof(regs)/sizeof(regs[0]));
    char args[256];
    int asserted = 0;

    /* 1. 0x6FD5A8E0: DRLGPRESET_FreeDrlgMapList113c (eax=pMemPool, [esp+4]=pDrlgMap) */
    for (int c = 0; c < 3; c++) {
        reset_env();
        if (c == 1) {
            U32(ARENA_MAP0 + 0x04u) = ARENA_CELLS0;
            U32(ARENA_MAP0 + 0x54u) = 0u;
        } else if (c == 2) {
            U32(ARENA_MAP0 + 0x04u) = ARENA_CELLS0;
            U32(ARENA_MAP0 + 0x54u) = ARENA_MAP1;
            U32(ARENA_MAP1 + 0x04u) = ARENA_CELLS1;
            U32(ARENA_MAP1 + 0x54u) = 0u;
        }
        uint32_t pMap = (c == 0) ? 0u : ARENA_MAP0;
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, nregs);
        uint32_t eax = safe_eax_stack1(0x6FD5A8E0u, 0u, pMap, &asserted);
        snprintf(args, sizeof(args), "0,\"0x%08X\"", pMap);
        emit_rec(fp, "0x6FD5A8E0", "DRLGPRESET_FreeDrlgMapList113c", c,
            c == 0 ? "null_map" : c == 1 ? "single_map" : "two_maps",
            args, regs, nregs, asserted, eax, 0x00000000u);
    }

    /* 2. 0x6FD5B320: DRLGPRESET_SpawnPresetUnits113c (esi=pSeed, [esp+4]=pMemPool, [esp+8]=pRoomEx) */
    for (int c = 0; c < 3; c++) {
        reset_env();
        U32(ARENA_LEVEL0 + 0x1C4u) = 0x12345678u + (uint32_t)c * 77u;
        U32(ARENA_LEVEL0 + 0x1C8u) = 0x9ABCDEF0u;
        U32(ARENA_ROOMEX0 + 0x0Cu) = ARENA_MAP0; /* pDrlgFile */
        U32(ARENA_ROOMEX0 + 0x10u) = 2u;
        U32(ARENA_ROOMEX0 + 0x14u) = 3u;
        U32(ARENA_MAP0 + 0x54u) = 0u;
        if (c == 1) {
            U32(ARENA_MAP0 + 0x54u) = ARENA_UNIT0;
            U32(ARENA_UNIT0 + 0x04u) = 10u;
            U32(ARENA_UNIT0 + 0x08u) = 5u;
            U32(ARENA_UNIT0 + 0x0Cu) = 0u; /* pNext */
            U32(ARENA_UNIT0 + 0x14u) = 1u; /* type 1 */
            U32(ARENA_UNIT0 + 0x18u) = 6u;
        } else if (c == 2) {
            U32(ARENA_MAP0 + 0x54u) = ARENA_UNIT0;
            U32(ARENA_UNIT0 + 0x04u) = 15u;
            U32(ARENA_UNIT0 + 0x08u) = 4u;
            U32(ARENA_UNIT0 + 0x0Cu) = ARENA_UNIT1; /* pNext */
            U32(ARENA_UNIT0 + 0x14u) = 2u; /* type 2 */
            U32(ARENA_UNIT0 + 0x18u) = 7u;
            U32(ARENA_UNIT1 + 0x04u) = 20u;
            U32(ARENA_UNIT1 + 0x0Cu) = 0u;
            U32(ARENA_UNIT1 + 0x14u) = 2u;
        }
        uint32_t pSeed = ARENA_LEVEL0 + 0x1C4u;
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, nregs);
        uint32_t eax = safe_esi_stack2(0x6FD5B320u, pSeed, 0u, ARENA_ROOMEX0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",0,\"0x%08X\"", pSeed, ARENA_ROOMEX0);
        emit_rec(fp, "0x6FD5B320", "DRLGPRESET_SpawnPresetUnits113c", c,
            c == 0 ? "no_units" : c == 1 ? "one_unit" : "two_units",
            args, regs, nregs, asserted, eax, 0x00000000u);
    }

    /* 3. 0x6FD5B560: DRLGPRESET_ParseDS1File113c (eax=pMemPool, [esp+4]=pDrlgFile, [esp+8]=szFileName) */
    for (int c = 0; c < 3; c++) {
        reset_env();
        strcpy((char *)(uintptr_t)ARENA_STR0, "test.ds1");
        U32(ARENA_STR0 + 0x10u) = ARENA_DS1;
        /* stub_fog_10105 reads [ARENA_DS1+0] as file size AND ParseDS1File reads [0] as version */
        U32(ARENA_DS1 + 0x00u) = (c == 0) ? 28u : (c == 1 ? 32u : 36u); /* size & version >= 18 */
        U32(ARENA_DS1 + 0x04u) = 0u; /* width - 1 */
        U32(ARENA_DS1 + 0x08u) = 0u; /* height - 1 */
        U32(ARENA_DS1 + 0x0Cu) = (c == 2) ? 1u : 0u; /* act */
        U32(ARENA_DS1 + 0x10u) = 0u; /* tagType */
        U32(ARENA_DS1 + 0x14u) = 0u; /* nFiles */
        U32(ARENA_DS1 + 0x18u) = 0u; /* nWalls / nFloors */
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, nregs);
        uint32_t eax = safe_eax_stack2(0x6FD5B560u, 0u, ARENA_FILE0, ARENA_STR0, &asserted);
        snprintf(args, sizeof(args), "0,\"0x%08X\",\"0x%08X\"", ARENA_FILE0, ARENA_STR0);
        emit_rec(fp, "0x6FD5B560", "DRLGPRESET_ParseDS1File113c", c,
            c == 0 ? "ds1_v28" : c == 1 ? "ds1_v32" : "ds1_v36_act1",
            args, regs, nregs, asserted, eax, 0xFFFFFFFFu);
    }

    /* 4. 0x6FD5BBC0: DRLGPRESET_AllocLevelPresetInfo113c (eax=pLevel) */
    for (int c = 0; c < 3; c++) {
        reset_env();
        setup_drlg_6_levels(100u + (uint32_t)c, 200u, (uint8_t)c);
        U32(ARENA_LEVEL0 + 0x1D0u) = (uint32_t)(1 + c * 20);
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, nregs);
        uint32_t eax = safe_eax(0x6FD5BBC0u, ARENA_LEVEL0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_LEVEL0);
        emit_rec(fp, "0x6FD5BBC0", "DRLGPRESET_AllocLevelPresetInfo113c", c,
            c == 0 ? "lvl1" : c == 1 ? "lvl21" : "lvl41",
            args, regs, nregs, asserted, eax, 0x00000000u);
    }

    /* 5. 0x6FD5BE50: DRLGPRESET_AcquireCachedPresetFile113c (ebx=ppFileData, [esp+4]=szFileName, [esp+8]=pMemPool) */
    for (int c = 0; c < 3; c++) {
        reset_env();
        strcpy((char *)(uintptr_t)ARENA_STR0, c == 0 ? "a.ds1" : c == 1 ? "b.ds1" : "c.ds1");
        U32(ARENA_STR0 + 0x10u) = ARENA_DS1;
        U32(ARENA_DS1 + 0x00u) = 32u;
        if (c > 0) {
            U32(0x6FDF147Cu) = ARENA_FILE0;
            strcpy((char *)(uintptr_t)(ARENA_FILE0 + 0x00u), c == 1 ? "b.ds1" : "c.ds1");
            U32(ARENA_FILE0 + 0x104u) = 1u;
            U32(ARENA_FILE0 + 0x108u) = ARENA_DS1;
            U32(ARENA_FILE0 + 0x10Cu) = 0u;
        }
        U32(ARENA_OUT0) = 0u;
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, nregs);
        uint32_t eax = safe_ebx_stack2(0x6FD5BE50u, ARENA_OUT0, 0u, ARENA_STR0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",0", ARENA_OUT0, ARENA_STR0);
        emit_rec(fp, "0x6FD5BE50", "DRLGPRESET_AcquireCachedPresetFile113c", c,
            c == 0 ? "miss_alloc" : c == 1 ? "hit_b" : "hit_c",
            args, regs, nregs, asserted, eax, 0x00000000u);
    }

    /* 6. 0x6FD5BF70: DRLGPRESET_LoadPresetRoomMap113c (stdcall(pRoomEx)) */
    for (int c = 0; c < 3; c++) {
        reset_env();
        setup_drlg_6_levels(10u + (uint32_t)c, 20u, 0);
        U32(ARENA_DRLG0 + 0x464u) = 0u;
        U32(ARENA_ROOMEX0 + 0x20u) = ARENA_MAP0;
        U32(ARENA_ROOMEX0 + 0x58u) = ARENA_LEVEL0;
        U32(ARENA_MAP0 + 0x08u) = ARENA_MAP1;
        U32(ARENA_MAP0 + 0xD8u + 0x00u) = ARENA_CELLS0;
        U32(ARENA_MAP0 + 0xD8u + 0x04u) = ARENA_ROWOFS0;
        U32(ARENA_MAP0 + 0xD8u + 0x08u) = 2u;
        U32(ARENA_MAP0 + 0xD8u + 0x0Cu) = 2u;
        U32(ARENA_ROWOFS0 + 0x04u) = 2u;
        U32(ARENA_MAP1 + 0x00u) = 0u; /* nType */
        U32(ARENA_MAP1 + 0x04u) = 0u; /* nFileIdx */
        U32(ARENA_MAP1 + 0x08u) = ARENA_LVLPREST; /* pLvlPrestTxt */
        strcpy((char *)(uintptr_t)(ARENA_LVLPREST + 0x44u), "b.ds1");
        U32(ARENA_LVLPREST + 0x44u + 0x10u) = ARENA_DS1;
        U32(ARENA_DS1 + 0x00u) = 32u;
        U32(ARENA_MAP1 + 0x0Cu) = (c == 0) ? ARENA_FILE0 : 0u;
        U32(ARENA_MAP1 + 0x3Cu) = (c == 2) ? 1u : 0u;
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, nregs);
        uint32_t eax = safe_stdcall1(0x6FD5BF70u, ARENA_ROOMEX0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_ROOMEX0);
        emit_rec(fp, "0x6FD5BF70", "DRLGPRESET_LoadPresetRoomMap113c", c,
            c == 0 ? "already_loaded" : c == 1 ? "load_empty_name" : "load_flags1",
            args, regs, nregs, asserted, eax, 0x00000000u);
    }

    /* 7. 0x6FD5C060: DRLGPRESET_ProcessPresetMap113c (stdcall(pLevel, pGrid, nFlags, pDrlgMap, bSingleRoom)) */
    for (int c = 0; c < 3; c++) {
        reset_env();
        setup_drlg_6_levels(30u + (uint32_t)c, 40u, 0);
        U32(ARENA_LEVEL0 + 0x1D0u) = 1u;
        U32(ARENA_GRID0 + 0x00u) = ARENA_CELLS0;
        U32(ARENA_GRID0 + 0x04u) = ARENA_ROWOFS0;
        U32(ARENA_GRID0 + 0x08u) = 2u;
        U32(ARENA_GRID0 + 0x0Cu) = 2u;
        U32(ARENA_ROWOFS0 + 0x00u) = 0u;
        U32(ARENA_ROWOFS0 + 0x04u) = 2u;
        U32(ARENA_MAP0 + 0x00u) = 0u;
        U32(ARENA_MAP0 + 0x04u) = 0u;
        U32(ARENA_MAP0 + 0x08u) = ARENA_LVLPREST;
        U32(ARENA_MAP0 + 0x18u) = 1u; /* nWidth */
        U32(ARENA_MAP0 + 0x1Cu) = 1u; /* nHeight */
        U32(ARENA_LVLPREST + 0x34u) = 0u; /* bScan */
        U32(ARENA_LVLPREST + 0x38u) = 0u; /* nPops */
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, nregs);
        uint32_t eax = safe_stdcall5(0x6FD5C060u, ARENA_LEVEL0, ARENA_GRID0, (uint32_t)(c + 1), ARENA_MAP0, c == 2 ? 1u : 0u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",%d,\"0x%08X\",%d", ARENA_LEVEL0, ARENA_GRID0, c + 1, ARENA_MAP0, c == 2 ? 1 : 0);
        emit_rec(fp, "0x6FD5C060", "DRLGPRESET_ProcessPresetMap113c", c,
            c == 0 ? "flags1" : c == 1 ? "flags2" : "single_room",
            args, regs, nregs, asserted, eax, 0x00000000u);
    }

    /* 8. 0x6FD5C690: DRLGPRESET_BuildPresetRoomsFromMap113c (stdcall(pLevel, pDrlgMap, nFlags, bSingleRoom)) */
    for (int c = 0; c < 3; c++) {
        reset_env();
        setup_drlg_6_levels(50u + (uint32_t)c, 60u, 0);
        U32(ARENA_LEVEL0 + 0x1D0u) = 1u;
        U32(ARENA_MAP0 + 0x08u) = ARENA_LVLPREST;
        U32(ARENA_MAP0 + 0x18u) = 1u;
        U32(ARENA_MAP0 + 0x1Cu) = 1u;
        U32(ARENA_LVLPREST + 0x34u) = 0u;
        U32(ARENA_LVLPREST + 0x38u) = 0u;
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, nregs);
        uint32_t eax = safe_stdcall4(0x6FD5C690u, ARENA_LEVEL0, ARENA_MAP0, (uint32_t)(c + 1), c == 2 ? 1u : 0u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",%d,%d", ARENA_LEVEL0, ARENA_MAP0, c + 1, c == 2 ? 1 : 0);
        emit_rec(fp, "0x6FD5C690", "DRLGPRESET_BuildPresetRoomsFromMap113c", c,
            c == 0 ? "flags1" : c == 1 ? "flags2" : "single_room",
            args, regs, nregs, asserted, eax, 0x00000000u);
    }

    /* 9. 0x6FD5C940: DRLGROOMTILE_BuildPresetRoomTiles113c (stdcall(pRoomEx)) */
    for (int c = 0; c < 3; c++) {
        reset_env();
        setup_drlg_6_levels(70u + (uint32_t)c, 80u, 0);
        U32(ARENA_ROOMEX0 + 0x20u) = ARENA_MAP0;
        U32(ARENA_ROOMEX0 + 0x3Cu) = 4u; /* width */
        U32(ARENA_ROOMEX0 + 0x40u) = 4u; /* height */
        U32(ARENA_ROOMEX0 + 0x54u) = (c == 0) ? 0u : ARENA_TILEGRID0;
        U32(ARENA_ROOMEX0 + 0x58u) = ARENA_LEVEL0;
        U32(ARENA_MAP0 + 0x00u) = (c == 2) ? 1u : 0u; /* nType */
        U32(ARENA_MAP0 + 0x08u) = ARENA_MAP1;
        U32(ARENA_MAP0 + 0xD8u + 0x00u) = ARENA_CELLS0;
        U32(ARENA_MAP0 + 0xD8u + 0x04u) = ARENA_ROWOFS0;
        U32(ARENA_MAP0 + 0xD8u + 0x08u) = 5u;
        U32(ARENA_MAP0 + 0xD8u + 0x0Cu) = 5u;
        for (uint32_t r = 0; r < 5u; r++) U32(ARENA_ROWOFS0 + r * 4u) = r * 5u;
        U32(ARENA_MAP1 + 0x08u) = ARENA_LVLPREST;
        U32(ARENA_MAP1 + 0x0Cu) = ARENA_FILE0;
        U32(ARENA_LVLPREST + 0x18u) = (c == 1) ? 1u : 0u; /* hasFiles */
        U32(ARENA_FILE0 + 0x0Cu) = 4u;
        U32(ARENA_FILE0 + 0x10u) = 4u;
        U32(ARENA_FILE0 + 0x14u) = 0u;
        U32(ARENA_FILE0 + 0x18u) = 0u;
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, nregs);
        uint32_t eax = safe_stdcall1(0x6FD5C940u, ARENA_ROOMEX0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_ROOMEX0);
        emit_rec(fp, "0x6FD5C940", "DRLGROOMTILE_BuildPresetRoomTiles113c", c,
            c == 0 ? "alloc_tilegrid" : c == 1 ? "has_files" : "type1_stackgrid",
            args, regs, nregs, asserted, eax, 0x00000000u);
    }

    /* 10. 0x6FD5CD10: DRLGPRESET_InitLevelPresetRooms113c (fastcall(pLevel), indirectUnknown) */
    for (int c = 0; c < 3; c++) {
        reset_env();
        setup_drlg_6_levels(90u + (uint32_t)c, 100u, (uint8_t)c);
        U32(ARENA_LEVEL0 + 0x1D0u) = (uint32_t)(1 + c);
        U32(ARENA_LEVEL0 + 0x14u) = ARENA_MAP0;
        U32(ARENA_MAP0 + 0x04u) = 0xFFFFFFFFu;
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, nregs);
        uint32_t eax = safe_fastcall1(0x6FD5CD10u, ARENA_LEVEL0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_LEVEL0);
        emit_rec(fp, "0x6FD5CD10", "DRLGPRESET_InitLevelPresetRooms113c", c,
            c == 0 ? "lvl1" : c == 1 ? "lvl2" : "lvl3",
            args, regs, nregs, asserted, eax, 0x00000000u);
    }
}

static void emit_i14a_2(FILE *fp) {
    static const mem_region_t regs[] = {
        { 0x6FDE9E1Cu, 0x04u },
        { 0x6FDF0B38u, 0x04u },
        { 0x6FDF0B3Cu, 0x04u },
        { ARENA_SGPT + 0xC5Cu, 0xA0u },
        { ARENA_LEVELDEF, 0x5300u },
        { ARENA_LVLMAZE, 0x0D00u },
        { ARENA_LVLPREST, 0x9000u },
        { ARENA_DRLG0, 0x490u },
        { ARENA_LEVEL0, 0x240u },
        { ARENA_LEVEL1, 0x240u },
        { ARENA_LEVEL2, 0x240u },
        { ARENA_ROOMEX0, 0x100u },
        { ARENA_ROOMEX1, 0x100u },
        { ARENA_ROOMEX2, 0x100u },
        { ARENA_ROOMEX3, 0x100u },
        { ARENA_MAP0, 0x100u },
    };
    const int nregs = (int)(sizeof(regs)/sizeof(regs[0]));
    char args[256];
    int asserted = 0;

    /* 11. 0x6FD5F110: DRLGMAZE_ReplaceMazeRoomWithPresetRooms113c (eax=pLevel, [esp+4]=pRoomEx) */
    for (int c = 0; c < 3; c++) {
        reset_env();
        setup_drlg_6_levels(1000u + (uint32_t)c, 1u, 0);
        U32(ARENA_LEVEL0 + 0x04u) = ARENA_ROOMEX0;
        U32(ARENA_ROOMEX0 + 0x00u) = ARENA_ROOMEX1;
        U32(ARENA_ROOMEX0 + 0x20u) = ARENA_MAP0;
        U32(ARENA_ROOMEX0 + 0x58u) = ARENA_LEVEL0;
        U32(ARENA_ROOMEX0 + 0x14u) = 10u;
        U32(ARENA_ROOMEX0 + 0x18u) = 10u;
        U32(ARENA_ROOMEX0 + 0x3Cu) = 8u;
        U32(ARENA_ROOMEX0 + 0x40u) = 8u;
        U32(ARENA_ROOMEX1 + 0x20u) = ARENA_MAP0;
        U32(ARENA_ROOMEX1 + 0x58u) = ARENA_LEVEL0;
        uint32_t target = (c == 0) ? ARENA_ROOMEX0 : ARENA_ROOMEX1;
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, nregs);
        uint32_t eax = safe_eax_stack1(0x6FD5F110u, ARENA_LEVEL0, target, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_LEVEL0, target);
        emit_rec(fp, "0x6FD5F110", "DRLGMAZE_ReplaceMazeRoomWithPresetRooms113c", c,
            c == 0 ? "head_room" : c == 1 ? "second_room" : "second_room_alt",
            args, regs, nregs, asserted, eax, 0x00000000u);
    }

    /* 12. 0x6FD5F220: DRLGMAZE_BuildSpiderCavernRing113c (ecx=pLevel) */
    for (int c = 0; c < 3; c++) {
        reset_env();
        setup_drlg_6_levels(2000u + (uint32_t)c * 99u, 7u, (uint8_t)c);
        U32(ARENA_LEVEL0 + 0x1D0u) = 85u;
        U32(ARENA_LEVEL0 + 0x10u) = ARENA_ROOMEX0;
        U32(ARENA_LEVEL0 + 0x14u) = ARENA_MAP0;
        U32(ARENA_MAP0 + 0x10u) = 8u;
        U32(ARENA_MAP0 + 0x14u) = 8u;
        U32(ARENA_ROOMEX0 + 0x20u) = ARENA_MAP0;
        U32(ARENA_ROOMEX0 + 0x58u) = ARENA_LEVEL0;
        U32(ARENA_ROOMEX0 + 0x34u) = 100u;
        U32(ARENA_ROOMEX0 + 0x38u) = 100u;
        U32(ARENA_ROOMEX0 + 0x3Cu) = 8u;
        U32(ARENA_ROOMEX0 + 0x40u) = 8u;
        U32(ARENA_LEVEL0 + 0x1Cu) = 100u;
        U32(ARENA_LEVEL0 + 0x20u) = 100u;
        U32(ARENA_LEVEL0 + 0x24u) = 32u;
        U32(ARENA_LEVEL0 + 0x28u) = 32u;
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, nregs);
        uint32_t eax = safe_ecx(0x6FD5F220u, ARENA_LEVEL0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_LEVEL0);
        emit_rec(fp, "0x6FD5F220", "DRLGMAZE_BuildSpiderCavernRing113c", c,
            c == 0 ? "seed0" : c == 1 ? "seed1" : "seed2",
            args, regs, nregs, asserted, eax, 0x00000000u);
    }

    /* 13. 0x6FD602F0: DRLGMAZE_BuildSquarePerimeterRooms113c (eax=pLevel, [esp+4]=nSide) */
    for (int c = 0; c < 3; c++) {
        reset_env();
        setup_drlg_6_levels(3000u + (uint32_t)c, 3u, 0);
        U32(ARENA_LEVEL0 + 0x1D0u) = 132u;
        U32(ARENA_LEVEL0 + 0x10u) = ARENA_ROOMEX0;
        U32(ARENA_LEVEL0 + 0x14u) = ARENA_MAP0;
        U32(ARENA_MAP0 + 0x10u) = 8u;
        U32(ARENA_MAP0 + 0x14u) = 8u;
        U32(ARENA_ROOMEX0 + 0x20u) = ARENA_MAP0;
        U32(ARENA_ROOMEX0 + 0x58u) = ARENA_LEVEL0;
        U32(ARENA_ROOMEX0 + 0x3Cu) = 8u;
        U32(ARENA_ROOMEX0 + 0x40u) = 8u;
        U32(ARENA_LEVEL0 + 0x1Cu) = 0u;
        U32(ARENA_LEVEL0 + 0x20u) = 0u;
        uint32_t side = (uint32_t)(c + 1);
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, nregs);
        uint32_t eax = safe_eax_stack1(0x6FD602F0u, ARENA_LEVEL0, side, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",%u", ARENA_LEVEL0, side);
        emit_rec(fp, "0x6FD602F0", "DRLGMAZE_BuildSquarePerimeterRooms113c", c,
            c == 0 ? "side1" : c == 1 ? "side2" : "side3",
            args, regs, nregs, asserted, eax, 0x00000000u);
    }

    /* 14..29: All 16 single-arg pLevel preset-placement helpers */
    struct {
        uint32_t va;
        const char *va_str;
        const char *name;
        uint8_t cc; /* 0=esi, 1=ecx, 2=stdcall1, 3=eax */
        uint32_t lvl_id;
    } maze_helpers[] = {
        { 0x6FD60BE0u, "0x6FD60BE0", "DRLGMAZE_PlaceAct5IceCavesPresets113c", 0, 113u },
        { 0x6FD60CA0u, "0x6FD60CA0", "DRLGMAZE_FinalizeAct5HellBarrow113c", 2, 125u },
        { 0x6FD60EB0u, "0x6FD60EB0", "DRLGMAZE_FinalizeAct1JailConnect113c", 2, 29u },
        { 0x6FD61170u, "0x6FD61170", "DRLGMAZE_PlaceAct5GlacialPresets113c", 0, 115u },
        { 0x6FD611E0u, "0x6FD611E0", "DRLGMAZE_PlaceAct5BaalKeepPresets113c", 0, 128u },
        { 0x6FD61280u, "0x6FD61280", "DRLGMAZE_PlaceAct3DurancePresets113c", 0, 100u },
        { 0x6FD61320u, "0x6FD61320", "DRLGMAZE_PlaceAct3SewersPresets113c", 0, 92u },
        { 0x6FD61380u, "0x6FD61380", "DRLGMAZE_PlaceAct3FlayerDungeonPresets113c", 0, 88u },
        { 0x6FD613E0u, "0x6FD613E0", "DRLGMAZE_PlaceAct2PalaceCellarPresets113c", 1, 52u },
        { 0x6FD61430u, "0x6FD61430", "DRLGMAZE_PlaceAct2MaggotLairPresets113c", 0, 62u },
        { 0x6FD614C0u, "0x6FD614C0", "DRLGMAZE_PlaceAct2TombPresets113c", 0, 66u },
        { 0x6FD616B0u, "0x6FD616B0", "DRLGMAZE_PlaceAct2SewersPresets113c", 0, 47u },
        { 0x6FD61940u, "0x6FD61940", "DRLGMAZE_PlaceAct1CatacombsPresets113c", 0, 34u },
        { 0x6FD619B0u, "0x6FD619B0", "DRLGMAZE_PlaceAct1JailPresets113c", 0, 29u },
        { 0x6FD61A70u, "0x6FD61A70", "DRLGMAZE_PlaceAct1CryptsPresets113c", 0, 18u },
        { 0x6FD61B30u, "0x6FD61B30", "DRLGMAZE_PlaceAct1CavesPresets113c", 0, 9u },
        { 0x6FD61BF0u, "0x6FD61BF0", "DRLGMAZE_GenerateMazeLevel113c", 3, 29u },
    };

    for (size_t h = 0; h < sizeof(maze_helpers)/sizeof(maze_helpers[0]); h++) {
        for (int c = 0; c < 3; c++) {
            reset_env();
            setup_drlg_6_levels(4000u + (uint32_t)h * 100u + (uint32_t)c * 13u, 5u + (uint32_t)c, (uint8_t)c);
            uint32_t lid = maze_helpers[h].lvl_id + (uint32_t)c;
            U32(ARENA_LEVEL0 + 0x1D0u) = lid;
            U32(ARENA_LEVEL1 + 0x1D0u) = 0x1Bu;
            U32(ARENA_LEVEL1 + 0x10u) = ARENA_ROOMEX0;
            U32(ARENA_LEVEL1 + 0x14u) = ARENA_MAP0;
            U32(ARENA_LEVEL2 + 0x1D0u) = 0x6Cu;
            U32(ARENA_LEVEL2 + 0x10u) = ARENA_ROOMEX0;
            U32(ARENA_LEVEL2 + 0x14u) = ARENA_MAP0;
            U32(ARENA_MAP0 + 0x04u) = 0u;
            U32(ARENA_LEVEL0 + 0x04u) = ARENA_ROOMEX0;
            U32(ARENA_LEVEL0 + 0x10u) = ARENA_ROOMEX0;
            U32(ARENA_LEVEL0 + 0x14u) = ARENA_MAP0;
            U32(ARENA_MAP0 + 0x10u) = 8u;
            U32(ARENA_MAP0 + 0x14u) = 8u;
            U32(ARENA_ROOMEX0 + 0x20u) = ARENA_MAP0;
            U32(ARENA_ROOMEX0 + 0x58u) = ARENA_LEVEL0;
            U32(ARENA_ROOMEX0 + 0x14u) = 0u;
            U32(ARENA_ROOMEX0 + 0x18u) = 0u;
            U32(ARENA_ROOMEX0 + 0x3Cu) = 8u;
            U32(ARENA_ROOMEX0 + 0x40u) = 8u;
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, nregs);
            uint32_t eax = 0u;
            if (maze_helpers[h].cc == 0) eax = safe_esi(maze_helpers[h].va, ARENA_LEVEL0, &asserted);
            else if (maze_helpers[h].cc == 1) eax = safe_ecx(maze_helpers[h].va, ARENA_LEVEL0, &asserted);
            else if (maze_helpers[h].cc == 2) eax = safe_stdcall1(maze_helpers[h].va, ARENA_LEVEL0, &asserted);
            else eax = safe_eax(maze_helpers[h].va, ARENA_LEVEL0, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_LEVEL0);
            emit_rec(fp, maze_helpers[h].va_str, maze_helpers[h].name, c,
                c == 0 ? "case0" : c == 1 ? "case1" : "case2",
                args, regs, nregs, asserted, eax, 0x00000000u);
        }
    }
}

static void emit_i14a_3(FILE *fp) {
    static const mem_region_t regs[] = {
        { 0x6FDE9E1Cu, 0x04u },
        { 0x6FDF0B38u, 0x04u },
        { 0x6FDF0B3Cu, 0x04u },
        { ARENA_SGPT + 0xC5Cu, 0xA0u },
        { ARENA_LEVELDEF, 0x5300u },
        { ARENA_LVLMAZE, 0x0D00u },
        { ARENA_LVLPREST, 0x9000u },
        { ARENA_DRLG0, 0x490u },
        { ARENA_LEVEL0, 0x240u },
        { ARENA_LEVEL1, 0x240u },
        { ARENA_LEVEL2, 0x240u },
        { ARENA_LEVEL3, 0x240u },
        { ARENA_LEVEL4, 0x240u },
        { ARENA_LEVEL5, 0x240u },
        { ARENA_ROOMEX0, 0x100u },
        { ARENA_ROOM0, 0x100u },
        { ARENA_ROOM1, 0x100u },
        { ARENA_ROOMLIST0, 0x40u },
        { ARENA_UNIT0, 0x100u },
        { ARENA_UNIT1, 0x100u },
        { ARENA_SEARCH0, 0x80u },
        { ARENA_WARP0, 0x80u },
        { ARENA_WARP1, 0x80u },
        { ARENA_WARP2, 0x80u },
        { ARENA_LIST0, 0x80u },
        { ARENA_TILEGRID0, 0x100u },
        { ARENA_TILECELLS0, 0x100u },
    };
    const int nregs = (int)(sizeof(regs)/sizeof(regs[0]));
    char args[256];
    int asserted = 0;

    /* 31. 0x6FD62720: UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c (stdcall(pUnitFindData)) */
    for (int c = 0; c < 3; c++) {
        reset_env();
        setup_drlg_6_levels(10u, 20u, 0);
        U32(ARENA_LEVEL0 + 0x1D0u) = 2u; /* wilderness, not town */
        U32(ARENA_ROOMEX0 + 0x58u) = ARENA_LEVEL0;
        U32(ARENA_ROOM0 + 0x00u) = ARENA_ROOMLIST0;
        U32(ARENA_ROOM0 + 0x10u) = ARENA_ROOMEX0;
        U32(ARENA_ROOM0 + 0x24u) = 2u;
        U32(ARENA_ROOM0 + 0x4Cu) = 0u; /* x */
        U32(ARENA_ROOM0 + 0x50u) = 0u; /* y */
        U32(ARENA_ROOM0 + 0x54u) = 32u;
        U32(ARENA_ROOM0 + 0x58u) = 32u;
        U32(ARENA_ROOM0 + 0x74u) = ARENA_UNIT0;
        U32(ARENA_ROOM1 + 0x10u) = ARENA_ROOMEX0;
        U32(ARENA_ROOM1 + 0x4Cu) = 32u;
        U32(ARENA_ROOM1 + 0x50u) = 0u;
        U32(ARENA_ROOM1 + 0x54u) = 32u;
        U32(ARENA_ROOM1 + 0x58u) = 32u;
        U32(ARENA_ROOM1 + 0x74u) = ARENA_UNIT1;
        U32(ARENA_ROOMLIST0 + 0x00u) = ARENA_ROOM0;
        U32(ARENA_ROOMLIST0 + 0x04u) = ARENA_ROOM1;

        U32(ARENA_UNIT0 + 0x00u) = 1u;
        U32(ARENA_UNIT0 + 0x04u) = 2u;
        U32(ARENA_UNIT0 + 0xE8u) = 0u;
        U32(ARENA_UNIT1 + 0x00u) = 1u;
        U32(ARENA_UNIT1 + 0x04u) = 3u;
        U32(ARENA_UNIT1 + 0xE8u) = 0u;

        U32(ARENA_SEARCH0 + 0x04u) = ARENA_LIST0; /* pUnitsArray */
        U32(ARENA_SEARCH0 + 0x08u) = (c == 0) ? 0u : ARENA_ROOM0; /* pRoom */
        U32(ARENA_SEARCH0 + 0x0Cu) = (c == 2) ? (uint32_t)(uintptr_t)&test_uf_cb_even_unit : 0u;
        U32(ARENA_SEARCH0 + 0x10u) = 0u;
        U32(ARENA_SEARCH0 + 0x14u) = (c == 1) ? 0x2000u : 0u;
        U32(ARENA_SEARCH0 + 0x1Cu) = 15u; /* nMaxCount */
        U32(ARENA_SEARCH0 + 0x20u) = 16u; /* nX */
        U32(ARENA_SEARCH0 + 0x24u) = 16u; /* nY */
        U32(ARENA_SEARCH0 + 0x28u) = 20u; /* dwSize */

        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, nregs);
        uint32_t eax = safe_stdcall1(0x6FD62720u, ARENA_SEARCH0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",%d", ARENA_SEARCH0, c == 2 ? 1 : 0);
        emit_rec(fp, "0x6FD62720", "UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c", c,
            c == 0 ? "null_room" : c == 1 ? "adjacent_no_cb" : "with_cb",
            args, regs, nregs, asserted, eax, 0xFFFFFFFFu);
    }

    /* 32. 0x6FD62F80: DRLGPRESET_UpdateRoomTileAnims113c (eax=pRoomEx, stack4=(pTileGrid, bWalls, bRoofs, bFloors)) */
    for (int c = 0; c < 3; c++) {
        reset_env();
        setup_drlg_6_levels(10u, 20u, 0);
        U32(ARENA_ROOMEX0 + 0x3Cu) = 4u;
        U32(ARENA_ROOMEX0 + 0x40u) = 4u;
        U32(ARENA_ROOMEX0 + 0x58u) = ARENA_LEVEL0;
        U32(ARENA_TILEGRID0 + 0x00u) = ARENA_TILECELLS0;
        U32(ARENA_TILEGRID0 + 0x04u) = 1u; /* nWalls */
        U32(ARENA_TILEGRID0 + 0x08u) = 0u;
        U32(ARENA_TILEGRID0 + 0x0Cu) = 0u;
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, nregs);
        uint32_t td = (c == 0) ? 0u : ARENA_TILEGRID0;
        uint32_t cnt = (c == 2) ? 2u : 1u;
        uint32_t eax = safe_eax_stack4(0x6FD62F80u, td, ARENA_ROOMEX0, 0u, cnt, ARENA_GRID0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",0,%u,\"0x%08X\"", td, ARENA_ROOMEX0, cnt, ARENA_GRID0);
        emit_rec(fp, "0x6FD62F80", "DRLGPRESET_UpdateRoomTileAnims113c", c,
            c == 0 ? "floors_only" : c == 1 ? "floors_walls" : "floors_roofs",
            args, regs, nregs, asserted, eax, 0x00000000u);
    }

    /* 33. 0x6FD65980: DRLGOUTPLACE_PlaceAct4Levels113c (stdcall(pLevel)) */
    for (int c = 0; c < 3; c++) {
        reset_env();
        setup_drlg_6_levels(111u, 222u, (uint8_t)c);
        U32(ARENA_LEVEL0 + 0x1D0u) = 78u;
        U32(ARENA_LEVEL0 + 0x1Cu) = 500u;
        U32(ARENA_LEVEL0 + 0x20u) = 500u;
        U32(ARENA_LEVEL0 + 0x24u) = 32u + (uint32_t)c * 16u;
        U32(ARENA_LEVEL0 + 0x28u) = 32u;
        U32(ARENA_LEVEL1 + 0x1D0u) = 79u;
        U32(ARENA_LEVEL2 + 0x1D0u) = 80u;
        U32(ARENA_LEVEL3 + 0x1D0u) = 81u;
        U32(ARENA_LEVEL4 + 0x1D0u) = 82u;
        U32(ARENA_LEVEL5 + 0x1D0u) = 83u;
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, nregs);
        uint32_t eax = safe_stdcall1(0x6FD65980u, ARENA_LEVEL0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_LEVEL0);
        emit_rec(fp, "0x6FD65980", "DRLGOUTPLACE_PlaceAct4Levels113c", c,
            c == 0 ? "diff0" : c == 1 ? "diff1" : "diff2",
            args, regs, nregs, asserted, eax, 0x00000000u);
    }

    /* 34. 0x6FD65A80: DRLGOUTPLACE_PlaceAct5OutdoorLevels113c (eax=pLevel) */
    for (int c = 0; c < 3; c++) {
        reset_env();
        setup_drlg_6_levels(12345u + (uint32_t)c * 777u, 98765u, (uint8_t)c);
        U32(ARENA_LEVEL0 + 0x1Cu) = 256u;
        U32(ARENA_LEVEL0 + 0x20u) = 512u;
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, nregs);
        uint32_t eax = safe_eax(0x6FD65A80u, ARENA_LEVEL0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_LEVEL0);
        emit_rec(fp, "0x6FD65A80", "DRLGOUTPLACE_PlaceAct5OutdoorLevels113c", c,
            c == 0 ? "act5_diff0" : c == 1 ? "act5_diff1" : "act5_diff2",
            args, regs, nregs, asserted, eax, 0xFFFFFFFFu);
    }

    /* 35. 0x6FD66CF0: DRLGOUTPLACE_LinkAct5OutdoorLevels113c (stdcall(pDrlg, nStartLevelId, nEndLevelId)) */
    for (int c = 0; c < 3; c++) {
        reset_env();
        setup_drlg_6_levels(1u, 2u, 0);
        U32(ARENA_LEVEL0 + 0x1Cu) = 0u;   U32(ARENA_LEVEL0 + 0x20u) = 0u;   U32(ARENA_LEVEL0 + 0x24u) = 64u; U32(ARENA_LEVEL0 + 0x28u) = 64u;
        U32(ARENA_LEVEL1 + 0x1Cu) = 64u;  U32(ARENA_LEVEL1 + 0x20u) = 0u;   U32(ARENA_LEVEL1 + 0x24u) = 64u; U32(ARENA_LEVEL1 + 0x28u) = 64u;
        U32(ARENA_LEVEL2 + 0x1Cu) = 64u;  U32(ARENA_LEVEL2 + 0x20u) = 64u;  U32(ARENA_LEVEL2 + 0x24u) = 64u; U32(ARENA_LEVEL2 + 0x28u) = 64u;
        uint32_t sId = (c == 0) ? 78u : 76u;
        uint32_t eId = (c == 0) ? 76u : (c == 1 ? 77u : 78u);
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, nregs);
        uint32_t eax = safe_stdcall3(0x6FD66CF0u, ARENA_DRLG0, sId, eId, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",%u,%u", ARENA_DRLG0, sId, eId);
        emit_rec(fp, "0x6FD66CF0", "DRLGOUTPLACE_LinkAct5OutdoorLevels113c", c,
            c == 0 ? "empty_range" : c == 1 ? "pair_adjacent" : "triple_adjacent",
            args, regs, nregs, asserted, eax, 0x00000000u);
    }

    /* 36. 0x6FD66E10: DRLGOUTPLACE_PlaceActLevelsByList113c (esi=pDrlg, stack3=(pList, pfnValidate, pfnPost), indirectUnknown) */
    for (int c = 0; c < 3; c++) {
        reset_env();
        setup_drlg_6_levels(555u + (uint32_t)c, 666u, 0);
        if (c == 0) {
            U32(ARENA_LIST0 + 0x04u) = 0u; /* empty list */
        } else {
            /* Note: pfnPlace at +0x00 is null only if +0x04 == 0; with +0x04 != 0, +0x00 must be a valid fn!
               We can point +0x00 to a tiny real stub in C! */
            U32(ARENA_LIST0 + 0x04u) = 0u;
        }
        if (c == 1) U8(ARENA_DRLG0 + 0x480u) = 4u;
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, nregs);
        uint32_t eax = safe_esi_stack3(0x6FD66E10u, ARENA_DRLG0, ARENA_LIST0, 0u, 0u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_DRLG0, ARENA_LIST0);
        emit_rec(fp, "0x6FD66E10", "DRLGOUTPLACE_PlaceActLevelsByList113c", c,
            c == 0 ? "empty_act1" : c == 1 ? "empty_act5" : "empty_alt",
            args, regs, nregs, asserted, eax, 0x00000000u);
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
    VirtualProtect((LPVOID)0x6FD51000u, 0x84000u, PAGE_EXECUTE_READWRITE, &oldProt);
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
    g_orig_iat_10102   = U32(0x6FDD90E0u);
    g_orig_iat_10103   = U32(0x6FDD90E8u);
    g_orig_iat_10104   = U32(0x6FDD90DCu);
    g_orig_iat_10105   = U32(0x6FDD90F0u);
    g_orig_iat_10042   = U32(0x6FDD90A0u);
    g_orig_iat_10043   = U32(0x6FDD909Cu);

    const char *out1 = (argc > 1) ? argv[1] : "i14a-1-vectors.ndjson";
    const char *out2 = (argc > 2) ? argv[2] : "i14a-2-vectors.ndjson";
    const char *out3 = (argc > 3) ? argv[3] : "i14a-3-vectors.ndjson";

    FILE *fp1 = fopen(out1, "wb");
    if (!fp1) return 1;
    emit_i14a_1(fp1);
    fclose(fp1);

    FILE *fp2 = fopen(out2, "wb");
    if (!fp2) return 1;
    emit_i14a_2(fp2);
    fclose(fp2);

    FILE *fp3 = fopen(out3, "wb");
    if (!fp3) return 1;
    emit_i14a_3(fp3);
    fclose(fp3);

    TerminateProcess(GetCurrentProcess(), 0);
    return 0;
}
