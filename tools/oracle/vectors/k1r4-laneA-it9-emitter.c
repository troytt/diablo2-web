/*
 * k1r4-laneA-it9-emitter.c
 *
 * Real-DLL Wine differential vector emitter for Iteration 9 Lane A:
 *   - B051' (20 diff-verified functions -> b051-vectors.ndjson)
 *   - B048' (15 diff-verified functions -> b048-vectors.ndjson; 0x6FD62C00 is ported)
 *
 * Inline-assembly rule: register-only constraints (+a, +b, +c, +d, +S, +D).
 * Must compile cleanly with -Wall -Wextra -Werror under both -O2 and -O2 -fno-omit-frame-pointer
 * and emit 100% SHA-256 identical NDJSON outputs across both optimization flags.
 */
#define _WIN32_WINNT 0x0501
#include <windows.h>
#include <setjmp.h>
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
#define ARENA_UNIT2       (ARENA_BASE + 0x1400u)
#define ARENA_ITEM0       (ARENA_BASE + 0x1600u)
#define ARENA_ITEM1       (ARENA_BASE + 0x1800u)
#define ARENA_ITEM2       (ARENA_BASE + 0x1A00u)
#define ARENA_ITEMDATA0   (ARENA_BASE + 0x1C00u)
#define ARENA_ITEMDATA1   (ARENA_BASE + 0x1E00u)
#define ARENA_ITEMDATA2   (ARENA_BASE + 0x2000u)
#define ARENA_INV0        (ARENA_BASE + 0x2200u)
#define ARENA_INV1        (ARENA_BASE + 0x2400u)
#define ARENA_GRIDS0      (ARENA_BASE + 0x2600u)
#define ARENA_GRIDS1      (ARENA_BASE + 0x2800u)
#define ARENA_CELLS0      (ARENA_BASE + 0x2A00u)
#define ARENA_CELLS1      (ARENA_BASE + 0x2E00u)
#define ARENA_STATLIST0   (ARENA_BASE + 0x3200u)
#define ARENA_STATLIST1   (ARENA_BASE + 0x3400u)
#define ARENA_STATHIST    (ARENA_BASE + 0x3600u)
#define ARENA_STATS0      (ARENA_BASE + 0x3800u)
#define ARENA_STATS1      (ARENA_BASE + 0x3A00u)
#define ARENA_PATH0       (ARENA_BASE + 0x3C00u)
#define ARENA_PATH1       (ARENA_BASE + 0x3E00u)
#define ARENA_ROOM0       (ARENA_BASE + 0x4000u)
#define ARENA_ROOM1       (ARENA_BASE + 0x4200u)
#define ARENA_ROOMSNEAR   (ARENA_BASE + 0x4400u)
#define ARENA_PLRDATA0    (ARENA_BASE + 0x4600u)
#define ARENA_SKILLLIST   (ARENA_BASE + 0x4800u)
#define ARENA_SKILL0      (ARENA_BASE + 0x4900u)
#define ARENA_SKILL1      (ARENA_BASE + 0x4A00u)
#define ARENA_OBJDATA0    (ARENA_BASE + 0x4B00u)
#define ARENA_OBJTXT0     (ARENA_BASE + 0x4C00u)
#define ARENA_MONDATA0    (ARENA_BASE + 0x4E00u)
#define ARENA_ANIMSEQ     (ARENA_BASE + 0x5000u)
#define ARENA_NODE0       (ARENA_BASE + 0x5200u)
#define ARENA_NODE1       (ARENA_BASE + 0x5300u)
#define ARENA_NODE2       (ARENA_BASE + 0x5400u)
#define ARENA_OWNER       (ARENA_BASE + 0x5600u)
#define ARENA_BITSTREAM   (ARENA_BASE + 0x5A00u)
#define ARENA_LINKER      (ARENA_BASE + 0x5B00u)
#define ARENA_LINKENTRIES (ARENA_BASE + 0x5B40u)
#define ARENA_OUT         (ARENA_BASE + 0x5C00u)
#define ARENA_STATEMASKS  (ARENA_BASE + 0x6000u)
#define ARENA_XFORMSTATES (ARENA_BASE + 0x6200u)
#define ARENA_ITYPEMAT    (ARENA_BASE + 0x6400u)
#define ARENA_INVTXT      (ARENA_BASE + 0x7000u)
#define ARENA_HIRELING    (ARENA_BASE + 0x9000u)
#define ARENA_STATESTXT   (ARENA_BASE + 0xB000u)
#define ARENA_ISC         (ARENA_BASE + 0x10000u)
#define ARENA_ITEMSTXT    (ARENA_BASE + 0x30000u)
#define ARENA_MONSTATS    (ARENA_BASE + 0x40000u)
#define ARENA_MONSTATS2   (ARENA_BASE + 0x50000u)
#define ARENA_SKILLSTXT   (ARENA_BASE + 0x60000u)
#define ARENA_MISSTXT     (ARENA_BASE + 0x70000u)

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

/* eax=a0 -> ret */
static __attribute__((noinline)) uint32_t call_eax1(uint32_t fn, uint32_t a0) {
    uint32_t io_eax = a0, io_edx = fn;
    __asm__ volatile (
        "call *%%edx\n\t"
        : "+a"(io_eax), "+d"(io_edx)
        :
        : "ecx", "cc", "memory"
    );
    return io_eax;
}

/* 0x6FD6E7B0: ecx=pDstInv, eax=pUnit -> ret */
static __attribute__((noinline)) uint32_t call_6FD6E7B0(uint32_t fn, uint32_t pDstInv, uint32_t pUnit) {
    uint32_t io_eax = pUnit, io_ecx = pDstInv, io_edx = fn;
    __asm__ volatile (
        "call *%%edx\n\t"
        : "+a"(io_eax), "+c"(io_ecx), "+d"(io_edx)
        :
        : "cc", "memory"
    );
    return io_eax;
}

/* 0x6FD6F370 / 0x6FD6F410 / 0x6FD6F4E0 / 0x6FD6F580:
 * bl=nHeight, [esp+4]=pGrid, [esp+8]=pOutX, [esp+0xC]=pOutY, [esp+0x10]=nWidth -> ret 0x10 */
static __attribute__((noinline)) uint32_t call_grid_fit(
    uint32_t fn, uint32_t nHeight, uint32_t pGrid, uint32_t pOutX, uint32_t pOutY, uint32_t nWidth) {
    uint32_t io_eax = pGrid, io_ebx = nHeight, io_ecx = pOutX, io_edx = pOutY, io_esi = nWidth, io_edi = fn;
    __asm__ volatile (
        "pushl %%esi\n\t"
        "pushl %%edx\n\t"
        "pushl %%ecx\n\t"
        "pushl %%eax\n\t"
        "call *%%edi\n\t"
        : "+a"(io_eax), "+b"(io_ebx), "+c"(io_ecx), "+d"(io_edx), "+S"(io_esi), "+D"(io_edi)
        :
        : "cc", "memory"
    );
    return io_eax;
}

/* 0x6FD6FB50: esi=dwCode1, edi=dwCode2 -> ret */
static __attribute__((noinline)) uint32_t call_6FD6FB50(uint32_t fn, uint32_t dwCode1, uint32_t dwCode2) {
    uint32_t io_eax = fn, io_esi = dwCode1, io_edi = dwCode2;
    __asm__ volatile (
        "call *%%eax\n\t"
        : "+a"(io_eax), "+S"(io_esi), "+D"(io_edi)
        :
        : "ecx", "edx", "cc", "memory"
    );
    return io_eax;
}

/* 0x6FD7C9E0: ecx=bExp, edx=nClassId, [esp+4]=nNameId -> ret 4 */
static __attribute__((noinline)) uint32_t call_fastcall3(uint32_t fn, uint32_t ecx, uint32_t edx, uint32_t s0) {
    uint32_t io_eax = s0, io_ecx = ecx, io_edx = edx, io_esi = fn;
    __asm__ volatile (
        "pushl %%eax\n\t"
        "call *%%esi\n\t"
        : "+a"(io_eax), "+c"(io_ecx), "+d"(io_edx), "+S"(io_esi)
        :
        : "cc", "memory"
    );
    return io_eax;
}

/* 0x6FD7F100: esi=pUnit, [esp+4]=dwPrevFrameFp8 -> ret 4 */
static __attribute__((noinline)) uint32_t call_6FD7F100(uint32_t fn, uint32_t pUnit, uint32_t prevFp8) {
    uint32_t io_eax = prevFp8, io_edx = fn, io_esi = pUnit;
    __asm__ volatile (
        "pushl %%eax\n\t"
        "call *%%edx\n\t"
        : "+a"(io_eax), "+d"(io_edx), "+S"(io_esi)
        :
        : "ecx", "cc", "memory"
    );
    return io_eax;
}

/* 0x6FD80B80: eax=dwUnitType, ecx=nMode, edx=pUnit -> ret */
static __attribute__((noinline)) uint32_t call_6FD80B80(uint32_t fn, uint32_t uType, uint32_t nMode, uint32_t pUnit) {
    uint32_t io_eax = uType, io_ecx = nMode, io_edx = pUnit, io_esi = fn;
    __asm__ volatile (
        "call *%%esi\n\t"
        : "+a"(io_eax), "+c"(io_ecx), "+d"(io_edx), "+S"(io_esi)
        :
        : "cc", "memory"
    );
    return io_eax;
}

/* 0x6FDBB140 / 0x6FD97020: ecx=a0, edx=a1, [esp+4]=s0, [esp+8]=s1 -> ret 8 */
static __attribute__((noinline)) uint32_t call_fastcall4(
    uint32_t fn, uint32_t ecx, uint32_t edx, uint32_t s0, uint32_t s1) {
    uint32_t io_eax = s0, io_ebx = s1, io_ecx = ecx, io_edx = edx, io_esi = fn;
    __asm__ volatile (
        "pushl %%ebx\n\t"
        "pushl %%eax\n\t"
        "call *%%esi\n\t"
        : "+a"(io_eax), "+b"(io_ebx), "+c"(io_ecx), "+d"(io_edx), "+S"(io_esi)
        :
        : "cc", "memory"
    );
    return io_eax;
}

/* 0x6FD97020: ecx=pItem, eax=pUnit, [esp+4]=nStateId, [esp+8]=nFlags -> ret 8 */
static __attribute__((noinline)) uint32_t call_6FD97020(
    uint32_t fn, uint32_t pItem, uint32_t pUnit, uint32_t nStateId, uint32_t nFlags) {
    uint32_t io_eax = pUnit, io_ebx = nFlags, io_ecx = pItem, io_edx = nStateId, io_esi = fn;
    __asm__ volatile (
        "pushl %%ebx\n\t"
        "pushl %%edx\n\t"
        "call *%%esi\n\t"
        : "+a"(io_eax), "+b"(io_ebx), "+c"(io_ecx), "+d"(io_edx), "+S"(io_esi)
        :
        : "cc", "memory"
    );
    return io_eax;
}

/* 0x6FD80BD0: edx=dwUnitType, ecx=nMode, [esp+4]=pUnit, [esp+8]=dwClassId -> ret 8 */
static __attribute__((noinline)) uint32_t call_6FD80BD0(
    uint32_t fn, uint32_t uType, uint32_t nMode, uint32_t pUnit, uint32_t dwClassId) {
    uint32_t io_eax = pUnit, io_ebx = dwClassId, io_ecx = nMode, io_edx = uType, io_esi = fn;
    __asm__ volatile (
        "pushl %%ebx\n\t"
        "pushl %%eax\n\t"
        "call *%%esi\n\t"
        : "+a"(io_eax), "+b"(io_ebx), "+c"(io_ecx), "+d"(io_edx), "+S"(io_esi)
        :
        : "cc", "memory"
    );
    return io_eax;
}

/* 0x6FDB6630: esi=pRoom, edi=pUnit, [esp+4]=bAssertIfPresent -> ret 4 */
static __attribute__((noinline)) uint32_t call_6FDB6630(
    uint32_t fn, uint32_t pRoom, uint32_t pUnit, uint32_t bAssert) {
    uint32_t io_eax = bAssert, io_edx = fn, io_esi = pRoom, io_edi = pUnit;
    __asm__ volatile (
        "pushl %%eax\n\t"
        "call *%%edx\n\t"
        : "+a"(io_eax), "+d"(io_edx), "+S"(io_esi), "+D"(io_edi)
        :
        : "ecx", "cc", "memory"
    );
    return io_eax;
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
static __attribute__((noinline)) uint32_t safe_stdcall6(
    uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3, uint32_t a4, uint32_t a5, int *pAsserted) {
    SAFE_BODY(((stdcall6_t)(uintptr_t)va)(a0, a1, a2, a3, a4, a5));
}
static __attribute__((noinline)) uint32_t safe_eax1(uint32_t va, uint32_t a0, int *pAsserted) {
    SAFE_BODY(call_eax1(va, a0));
}
static __attribute__((noinline)) uint32_t safe_6FD6E7B0(uint32_t va, uint32_t a0, uint32_t a1, int *pAsserted) {
    SAFE_BODY(call_6FD6E7B0(va, a0, a1));
}
static __attribute__((noinline)) uint32_t safe_grid_fit(
    uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3, uint32_t a4, int *pAsserted) {
    SAFE_BODY(call_grid_fit(va, a0, a1, a2, a3, a4));
}
static __attribute__((noinline)) uint32_t safe_6FD6FB50(uint32_t va, uint32_t a0, uint32_t a1, int *pAsserted) {
    SAFE_BODY(call_6FD6FB50(va, a0, a1));
}
static __attribute__((noinline)) uint32_t safe_fastcall3(uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2, int *pAsserted) {
    SAFE_BODY(call_fastcall3(va, a0, a1, a2));
}
static __attribute__((noinline)) uint32_t safe_6FD7F100(uint32_t va, uint32_t a0, uint32_t a1, int *pAsserted) {
    SAFE_BODY(call_6FD7F100(va, a0, a1));
}
static __attribute__((noinline)) uint32_t safe_6FD80B80(uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2, int *pAsserted) {
    SAFE_BODY(call_6FD80B80(va, a0, a1, a2));
}
static __attribute__((noinline)) uint32_t safe_fastcall4(
    uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3, int *pAsserted) {
    SAFE_BODY(call_fastcall4(va, a0, a1, a2, a3));
}
static __attribute__((noinline)) uint32_t safe_6FD97020(
    uint32_t va, uint32_t pItem, uint32_t pUnit, uint32_t nStateId, uint32_t nFlags, int *pAsserted) {
    SAFE_BODY(call_6FD97020(va, pItem, pUnit, nStateId, nFlags));
}
static __attribute__((noinline)) uint32_t safe_6FD80BD0(
    uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3, int *pAsserted) {
    SAFE_BODY(call_6FD80BD0(va, a0, a1, a2, a3));
}
static __attribute__((noinline)) uint32_t safe_6FDB6630(
    uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2, int *pAsserted) {
    SAFE_BODY(call_6FDB6630(va, a0, a1, a2));
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
    memset(g_heap, 0, 0x2000u);
    g_heap_top = HEAP_BASE;
    g_force_alloc_null = 0;

    U32(0x6FDE9E1Cu) = ARENA_SGPT;
    U32(ARENA_SGPT + 0x0BCu) = ARENA_STATESTXT;
    U32(ARENA_SGPT + 0x0C4u) = 185u;
    U32(ARENA_SGPT + 0x150u) = ARENA_STATEMASKS;
    U32(ARENA_SGPT + 0x17Cu) = ARENA_XFORMSTATES;
    U16(ARENA_SGPT + 0x180u) = 0u;
    U32(ARENA_SGPT + 0xA78u) = ARENA_MONSTATS;
    U32(ARENA_SGPT + 0xA80u) = 120u;
    U32(ARENA_SGPT + 0xA90u) = ARENA_MONSTATS2;
    U32(ARENA_SGPT + 0xA98u) = 10u;
    U32(ARENA_SGPT + 0xB64u) = ARENA_MISSTXT;
    U32(ARENA_SGPT + 0xB6Cu) = 10u;
    U32(ARENA_SGPT + 0xB98u) = ARENA_SKILLSTXT;
    U32(ARENA_SGPT + 0xBA0u) = 20u;
    U32(ARENA_SGPT + 0xBCCu) = ARENA_ISC;
    U32(ARENA_SGPT + 0xBD4u) = 359u;
    U32(ARENA_SGPT + 0xBFCu) = 64u;
    U32(ARENA_SGPT + 0xC00u) = 2u;
    U32(ARENA_SGPT + 0xC04u) = ARENA_ITYPEMAT;

    U32(0x6FDEFA58u) = 15u;
    U32(0x6FDEFA5Cu) = ARENA_INVTXT;
    U32(0x6FDEFB94u) = 10u;
    U32(0x6FDEFB98u) = ARENA_ITEMSTXT;
    U32(0x6FDEFF6Cu) = ARENA_LINKER;
    U32(0x6FDF0078u) = ARENA_HIRELING;
    U32(0x6FDF007Cu) = 4u;

    /* Default InventoryTxt rec 0 (player class 0 -> rec 0 in sgptCharInvRecTable) & rec 5 (monster): 4x3 */
    U8(ARENA_INVTXT + 0u * 0xF0u + 0x10u) = 4u;
    U8(ARENA_INVTXT + 0u * 0xF0u + 0x11u) = 3u;
    U8(ARENA_INVTXT + 5u * 0xF0u + 0x10u) = 4u;
    U8(ARENA_INVTXT + 5u * 0xF0u + 0x11u) = 3u;

    /* Item 0: sword (type 0x1E -> weapon 0x2D), Item 1: missile weapon (type 0x1F -> 0x2D + 0x26),
     * Item 2: shield (type 0x33), Item 3: potion 'hp1 ', Item 4: potion 'hp2 ', Item 5: 'isc ', Item 6: 'tsc ' */
    U32(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x80u) = 0x2064736Cu;
    U8(ARENA_ITEMSTXT  + 0u * 0x1A8u + 0x10Fu) = 2u;
    U8(ARENA_ITEMSTXT  + 0u * 0x1A8u + 0x110u) = 3u;
    U16(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x11Eu) = 0x1Eu;

    U32(ARENA_ITEMSTXT + 1u * 0x1A8u + 0x80u) = 0x2076616Au;
    U8(ARENA_ITEMSTXT  + 1u * 0x1A8u + 0x10Fu) = 1u;
    U8(ARENA_ITEMSTXT  + 1u * 0x1A8u + 0x110u) = 3u;
    U16(ARENA_ITEMSTXT + 1u * 0x1A8u + 0x11Eu) = 0x1Fu;

    U32(ARENA_ITEMSTXT + 2u * 0x1A8u + 0x80u) = 0x20637562u;
    U8(ARENA_ITEMSTXT  + 2u * 0x1A8u + 0x10Fu) = 2u;
    U8(ARENA_ITEMSTXT  + 2u * 0x1A8u + 0x110u) = 2u;
    U16(ARENA_ITEMSTXT + 2u * 0x1A8u + 0x11Eu) = 0x33u;

    U32(ARENA_ITEMSTXT + 3u * 0x1A8u + 0x80u) = 0x20317068u;
    U16(ARENA_ITEMSTXT + 3u * 0x1A8u + 0x11Eu) = 0x09u;
    U32(ARENA_ITEMSTXT + 4u * 0x1A8u + 0x80u) = 0x20327068u;
    U16(ARENA_ITEMSTXT + 4u * 0x1A8u + 0x11Eu) = 0x09u;
    U32(ARENA_ITEMSTXT + 5u * 0x1A8u + 0x80u) = 0x20637369u;
    U16(ARENA_ITEMSTXT + 5u * 0x1A8u + 0x11Eu) = 0x16u;
    U32(ARENA_ITEMSTXT + 6u * 0x1A8u + 0x80u) = 0x20637374u;
    U16(ARENA_ITEMSTXT + 6u * 0x1A8u + 0x11Eu) = 0x16u;

    U32(ARENA_ITYPEMAT + 0x1Eu * 8u + 0u) = (1u << 30);
    U32(ARENA_ITYPEMAT + 0x1Eu * 8u + 4u) = (1u << (0x2Du - 32u));
    U32(ARENA_ITYPEMAT + 0x1Fu * 8u + 4u) = (1u << (0x2Du - 32u)) | (1u << (0x26u - 32u));
    U32(ARENA_ITYPEMAT + 0x33u * 8u + 4u) = (1u << (0x33u - 32u));
    U32(ARENA_ITYPEMAT + 0x09u * 8u + 0u) = (1u << 9);

    /* Stackable group 0 at 0x6FDEF08C / 0x6FDEF090: 'hp1 ', 'hp2 ' */
    U32(0x6FDEF08Cu) = 2u;
    U32(0x6FDEF090u) = 0x20317068u;
    U32(0x6FDEF094u) = 0x20327068u;
    U32(0x6FDEF074u) = 0u;
    U32(0x6FDEF068u) = 0u;

    /* Items code linker: 2 sorted entries ('ear ' 0x20726165, 'neg ' 0x2067656E, 'nec ' 0x2063656E) */
    U32(ARENA_LINKER + 0x00u) = 3u;
    U32(ARENA_LINKER + 0x08u) = ARENA_LINKENTRIES;
    U32(ARENA_LINKENTRIES + 0u) = 0x2063656Eu; U32(ARENA_LINKENTRIES + 4u) = 11u;
    U32(ARENA_LINKENTRIES + 8u) = 0x2067656Eu; U32(ARENA_LINKENTRIES + 12u) = 22u;
    U32(ARENA_LINKENTRIES + 16u) = 0x20726165u; U32(ARENA_LINKENTRIES + 20u) = 33u;
}

static void emit_b051_inv_part1(FILE *fp) {
    char args[160];
    uint32_t eax = 0u; (void)eax;
    int asserted = 0;

    /* #1: 0x6FD6E7B0 INVENTORY_CopyGrid2Cells113c */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        U32(ARENA_INV0 + 0x00u) = (c == 1) ? 0xBAD00000u : 0x01020304u;
        U32(ARENA_INV0 + 0x14u) = ARENA_GRIDS0;
        U32(ARENA_INV0 + 0x18u) = (c == 5) ? 0u : 3u;
        U8(ARENA_GRIDS0 + 0x20u + 0x08u) = 4u;
        U8(ARENA_GRIDS0 + 0x20u + 0x09u) = 3u;
        U32(ARENA_GRIDS0 + 0x20u + 0x0Cu) = ARENA_CELLS0;

        U32(ARENA_UNIT0 + 0x00u) = 1u; /* monster -> recId 5 */
        U32(ARENA_UNIT0 + 0x60u) = (c == 2) ? 0u : ARENA_INV1;
        U32(ARENA_INV1 + 0x00u) = 0x01020304u;
        U32(ARENA_INV1 + 0x14u) = ARENA_GRIDS1;
        U32(ARENA_INV1 + 0x18u) = 3u;
        U8(ARENA_GRIDS1 + 0x20u + 0x08u) = (c == 3) ? 2u : 4u;
        U8(ARENA_GRIDS1 + 0x20u + 0x09u) = 3u;
        U32(ARENA_GRIDS1 + 0x20u + 0x0Cu) = ARENA_CELLS1;
        for (int i = 0; i < 12; i++) U32(ARENA_CELLS1 + (uint32_t)i * 4u) = 0xAA00u + (uint32_t)i;

        mem_region_t regs[] = {
            {0x6FDEEFE4u, 0x3Cu}, {0x6FDEFA58u, 8u},
            {ARENA_INVTXT + 5u * 0xF0u, 0xF0u},
            {ARENA_UNIT0, 0x80u}, {ARENA_INV0, 0x40u}, {ARENA_INV1, 0x40u},
            {ARENA_GRIDS0, 0x40u}, {ARENA_GRIDS1, 0x40u},
            {ARENA_CELLS0, 0x40u}, {ARENA_CELLS1, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 10);
        uint32_t pDst = (c == 0) ? 0u : ARENA_INV0;
        uint32_t pU = (c == 4) ? 0u : ARENA_UNIT0;
        eax = safe_6FD6E7B0(0x6FD6E7B0u, pDst, pU, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", pDst, pU);
        emit_rec(fp, "0x6FD6E7B0", "INVENTORY_CopyGrid2Cells113c", c,
            c == 0 ? "null_dst" : (c == 1 ? "bad_sig_dst" : (c == 2 ? "null_src_inv" :
            (c == 3 ? "dim_mismatch" : (c == 4 ? "null_unit_asserts" : "lazy_alloc_and_copy_12_cells")))),
            args, regs, 10, asserted, eax, 0xFFFFFFFFu);
    }

    /* #2: 0x6FD6EEE0 INVENTORY_CanStackIntoBeltRow113c */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        U32(ARENA_INV0 + 0x00u) = (c == 0) ? 0u : 0x01020304u;
        U32(ARENA_INV0 + 0x14u) = ARENA_GRIDS0;
        U32(ARENA_INV0 + 0x18u) = 2u;
        U8(ARENA_GRIDS0 + 0x10u + 0x08u) = 16u;
        U8(ARENA_GRIDS0 + 0x10u + 0x09u) = 1u;
        U32(ARENA_GRIDS0 + 0x10u + 0x0Cu) = ARENA_CELLS0;

        U32(ARENA_ITEM0 + 0x00u) = (c == 1) ? 1u : 4u;
        U32(ARENA_ITEM0 + 0x04u) = (c == 2) ? 5u : ((c == 3) ? 6u : 3u); /* 5='isc ', 6='tsc ', 3='hp1 ' */
        U32(ARENA_ITEM1 + 0x00u) = 4u;
        U32(ARENA_ITEM1 + 0x04u) = (c == 4) ? 0u : 4u; /* 0=sword incompatible, 4='hp2 ' compatible */
        U32(ARENA_CELLS0 + 3u * 4u) = ARENA_ITEM1; /* slot 3 in first belt row */

        mem_region_t regs[] = {
            {0x6FDEFB94u, 8u}, {0x6FDED390u, 0x18u}, {0x6FDEF068u, 0x40u},
            {ARENA_ITEMSTXT, 7u * 0x1A8u},
            {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x30u}, {ARENA_CELLS0, 0x40u},
            {ARENA_ITEM0, 0x20u}, {ARENA_ITEM1, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
        eax = safe_stdcall2(0x6FD6EEE0u, ARENA_INV0, ARENA_ITEM0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_INV0, ARENA_ITEM0);
        emit_rec(fp, "0x6FD6EEE0", "INVENTORY_CanStackIntoBeltRow113c", c,
            c == 0 ? "bad_sig" : (c == 1 ? "non_item" : (c == 2 ? "isc_rejected" :
            (c == 3 ? "tsc_rejected" : (c == 4 ? "slot3_incompatible" : "slot3_compatible_potion")))),
            args, regs, 9, asserted, eax, 0xFFFFFFFFu);
    }

    /* #3..#6: 0x6FD6F370, 0x6FD6F410, 0x6FD6F4E0, 0x6FD6F580 grid placement fitters */
    {
        static const uint32_t fit_vas[4] = {0x6FD6F370u, 0x6FD6F410u, 0x6FD6F4E0u, 0x6FD6F580u};
        static const char *fit_names[4] = {
            "INVENTORY_FindFirstFitColMajor113c",
            "INVENTORY_FindBestFitRowMajor113c",
            "INVENTORY_FindFirstFitRightToLeft113c",
            "INVENTORY_FindBestFitReverse113c"
        };
        for (int fi = 0; fi < 4; fi++) {
            for (int c = 0; c < 5; c++) {
                setup_common_tables();
                uint8_t gw = (c == 0) ? 0u : 4u;
                uint8_t gh = (c == 1) ? 0u : 3u;
                U8(ARENA_GRIDS0 + 0x08u) = gw;
                U8(ARENA_GRIDS0 + 0x09u) = gh;
                U32(ARENA_GRIDS0 + 0x0Cu) = ARENA_CELLS0;
                U32(ARENA_OUT + 0u) = 0xDEADu;
                U32(ARENA_OUT + 4u) = 0xBEEFu;
                uint32_t w = 2u, h = 2u;
                if (c == 2) {
                    /* All cells occupied -> returns 0 */
                    for (int i = 0; i < 12; i++) U32(ARENA_CELLS0 + (uint32_t)i * 4u) = ARENA_ITEM0;
                } else if (c == 3) {
                    /* Occupy (0,0) and (3,0), leave middle & bottom open -> distinct choices per scan order */
                    U32(ARENA_CELLS0 + 0u * 4u) = ARENA_ITEM0;
                    U32(ARENA_CELLS0 + 3u * 4u) = ARENA_ITEM0;
                } else if (c == 4) {
                    /* Exact 1x1 surrounded pocket at (1,1) -> max perimeter score 0xFF */
                    w = 1u; h = 1u;
                    for (int i = 0; i < 12; i++) U32(ARENA_CELLS0 + (uint32_t)i * 4u) = ARENA_ITEM0;
                    U32(ARENA_CELLS0 + (1u * 4u + 1u) * 4u) = 0u;
                    U32(ARENA_CELLS0 + (0u * 4u + 0u) * 4u) = 0u;
                }
                mem_region_t regs[] = {
                    {ARENA_GRIDS0, 0x20u}, {ARENA_CELLS0, 0x40u}, {ARENA_OUT, 0x10u}
                };
                capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
                eax = safe_grid_fit(fit_vas[fi], h, ARENA_GRIDS0, ARENA_OUT, ARENA_OUT + 4u, w, &asserted);
                snprintf(args, sizeof(args), "%u,\"0x%08X\",\"0x%08X\",\"0x%08X\",%u",
                    h, ARENA_GRIDS0, ARENA_OUT, ARENA_OUT + 4u, w);
                emit_rec(fp, fi == 0 ? "0x6FD6F370" : (fi == 1 ? "0x6FD6F410" : (fi == 2 ? "0x6FD6F4E0" : "0x6FD6F580")),
                    fit_names[fi], c,
                    c == 0 ? "zero_width" : (c == 1 ? "zero_height" : (c == 2 ? "full_grid_no_fit" :
                    (c == 3 ? "partial_grid_2x2_fit" : "pocket_1x1_max_score"))),
                    args, regs, 3, asserted, eax, 0xFFFFFFFFu);
            }
        }
    }

    /* #7: 0x6FD6FB50 INVENTORY_FindItemGfxCodeIndex113c */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        U32(0x6FDF1488u) = (c == 3) ? 0u : 1u;
        memset((void *)(uintptr_t)0x6FDF0BA8u, 0, 255u * 8u);
        if (c < 3) {
            U32(0x6FDF0BA8u + 1u * 8u) = 0x2074696Cu; /* 'lit ' at idx 1 */
            U32(0x6FDF0BA8u + 5u * 8u) = 0x2064736Cu; /* 'lsd ' at idx 5 */
        } else {
            U32(0x6FDEFB94u) = 1u; /* lazy init 1 item: sword 'lsd ' */
        }
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDEFB94u, 8u}, {0x6FDD9088u, 0xACu},
            {0x6FDED888u, 255u * 8u}, {0x6FDF0BA8u, 255u * 8u},
            {0x6FDF13A0u, 4u}, {0x6FDF1488u, 4u},
            {ARENA_SGPT, 0xC10u}, {ARENA_ITEMSTXT, 0x1A8u}, {ARENA_ITYPEMAT, 0x200u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 10);
        uint32_t c1 = (c == 0) ? 0x30303030u : ((c == 1) ? 0x2064736Cu : 0x30303030u);
        uint32_t c2 = (c == 2 || c == 3) ? 0x2064736Cu : 0x31313131u;
        eax = safe_6FD6FB50(0x6FD6FB50u, c1, c2, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", c1, c2);
        emit_rec(fp, "0x6FD6FB50", "INVENTORY_FindItemGfxCodeIndex113c", c,
            c == 0 ? "not_found" : (c == 1 ? "match_code1" : (c == 2 ? "match_code2" : "lazy_init_table_match")),
            args, regs, 10, asserted, eax, 0xFFFFFFFFu);
    }

    /* #8: 0x6FD6FC70 INVENTORY_UpdateWeaponGuidOnRemoval113c */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        U32(ARENA_INV0 + 0x00u) = 0x01020304u;
        U32(ARENA_INV0 + 0x14u) = ARENA_GRIDS0;
        U32(ARENA_INV0 + 0x18u) = 1u;
        U32(ARENA_INV0 + 0x1Cu) = 77u;
        U8(ARENA_GRIDS0 + 0x08u) = 13u;
        U8(ARENA_GRIDS0 + 0x09u) = 1u;
        U32(ARENA_GRIDS0 + 0x0Cu) = ARENA_CELLS0;

        U32(ARENA_ITEM0 + 0x00u) = 4u;
        U32(ARENA_ITEM0 + 0x04u) = (c == 1) ? 2u : 0u; /* 2=shield (non-weapon), 0=sword */
        U32(ARENA_ITEM0 + 0x0Cu) = 77u;
        U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
        U8(ARENA_ITEMDATA0 + 0x44u) = (c == 3) ? 5u : ((c == 4) ? 1u : 4u);

        if (c == 2 || c == 3) {
            U32(ARENA_ITEM1 + 0x00u) = 4u;
            U32(ARENA_ITEM1 + 0x04u) = 0u;
            U32(ARENA_ITEM1 + 0x0Cu) = 88u;
            U32(ARENA_ITEM1 + 0x14u) = ARENA_ITEMDATA1;
            if (c == 2) U32(ARENA_CELLS0 + 5u * 4u) = ARENA_ITEM1;
            if (c == 3) U32(ARENA_CELLS0 + 4u * 4u) = ARENA_ITEM1;
        }
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDEFB94u, 8u}, {0x6FDD9088u, 0xACu}, {0x6FDED378u, 0x18u},
            {ARENA_SGPT, 0xC10u}, {ARENA_ITEMSTXT, 3u * 0x1A8u}, {ARENA_ITYPEMAT, 0x200u},
            {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x20u}, {ARENA_CELLS0, 0x40u},
            {ARENA_ITEM0, 0x40u}, {ARENA_ITEMDATA0, 0x80u},
            {ARENA_ITEM1, 0x40u}, {ARENA_ITEMDATA1, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 14);
        uint32_t pInv = (c == 0) ? 0u : ARENA_INV0;
        eax = safe_stdcall2(0x6FD6FC70u, pInv, ARENA_ITEM0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", pInv, ARENA_ITEM0);
        emit_rec(fp, "0x6FD6FC70", "INVENTORY_UpdateWeaponGuidOnRemoval113c", c,
            c == 0 ? "null_inv" : (c == 1 ? "non_weapon_ignored" : (c == 2 ? "bodyloc4_promotes_slot5" :
            (c == 3 ? "bodyloc5_promotes_slot4" : "bodyloc1_clears_guid_to_minus1"))),
            args, regs, 14, asserted, 0u, 0u);
    }

    /* #9: 0x6FD6FE10 INVENTORY_FindBackpackItemByType113c */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = (c == 4) ? 1u : 0u; /* player vs monster owner */
        U32(ARENA_UNIT0 + 0x04u) = 0u;
        U32(ARENA_INV0 + 0x00u) = 0x01020304u;
        U32(ARENA_INV0 + 0x08u) = ARENA_UNIT0;
        U32(ARENA_INV0 + 0x14u) = ARENA_GRIDS0;
        U32(ARENA_INV0 + 0x18u) = 3u;
        U32(ARENA_GRIDS0 + 0x20u + 0x00u) = ARENA_ITEM0;
        U8(ARENA_GRIDS0 + 0x20u + 0x08u) = 10u; /* matches real player Amazon InvTxt grid 2 (10x4) */
        U8(ARENA_GRIDS0 + 0x20u + 0x09u) = 4u;
        U32(ARENA_GRIDS0 + 0x20u + 0x0Cu) = ARENA_CELLS0;
        /* Set all InvTxt records 0..15 to 10x4 so player class lookup matches */
        for (uint32_t r = 0; r < 16u; r++) {
            U8(ARENA_INVTXT + r * 0xF0u + 0x10u) = 10u;
            U8(ARENA_INVTXT + r * 0xF0u + 0x11u) = 4u;
        }
        U32(ARENA_ITEM0 + 0x00u) = 4u; U32(ARENA_ITEM0 + 0x04u) = 2u; /* shield 0x33 */
        U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
        U32(ARENA_ITEMDATA0 + 0x5Cu + 0x14u) = ARENA_ITEM1;
        U32(ARENA_ITEM1 + 0x00u) = 4u; U32(ARENA_ITEM1 + 0x04u) = 0u; /* sword 0x2D */
        U32(ARENA_ITEM1 + 0x14u) = ARENA_ITEMDATA1;
        U32(ARENA_ITEMDATA1 + 0x5Cu + 0x14u) = 0u;

        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDEFB94u, 8u}, {0x6FDD9088u, 0xACu},
            {0x6FDEEFE4u, 0x3Cu}, {0x6FDEFA58u, 8u},
            {ARENA_SGPT, 0xC10u}, {ARENA_INVTXT, 16u * 0xF0u},
            {ARENA_ITEMSTXT, 3u * 0x1A8u}, {ARENA_ITYPEMAT, 0x200u},
            {ARENA_UNIT0, 0x80u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u}, {ARENA_CELLS0, 0x100u},
            {ARENA_ITEM0, 0x40u}, {ARENA_ITEMDATA0, 0x80u},
            {ARENA_ITEM1, 0x40u}, {ARENA_ITEMDATA1, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 17);
        uint32_t pInv = (c == 0) ? 0u : ARENA_INV0;
        uint32_t pAfter = (c == 2) ? ARENA_ITEM0 : ((c == 3) ? ARENA_ITEM2 : 0u);
        uint32_t tId = 0x2Du;
        eax = safe_stdcall3(0x6FD6FE10u, pInv, tId, pAfter, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",%u,\"0x%08X\"", pInv, tId, pAfter);
        emit_rec(fp, "0x6FD6FE10", "INVENTORY_FindBackpackItemByType113c", c,
            c == 0 ? "null_inv" : (c == 1 ? "finds_second_item_sword" : (c == 2 ? "after_item0_finds_item1" :
            (c == 3 ? "after_missing_returns_0" : "monster_owner_uses_existing_grid2"))),
            args, regs, 17, asserted, eax, 0xFFFFFFFFu);
    }

    /* #10: 0x6FD70620 INVENTORY_UpdateWeaponGuidOnInsert113c */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        U32(ARENA_INV0 + 0x00u) = 0x01020304u;
        U32(ARENA_INV0 + 0x14u) = ARENA_GRIDS0;
        U32(ARENA_INV0 + 0x18u) = 1u;
        U32(ARENA_INV0 + 0x1Cu) = (c == 2 || c == 5) ? 55u : ((c == 4) ? 66u : 0xFFFFFFFFu);
        U8(ARENA_GRIDS0 + 0x08u) = 13u;
        U8(ARENA_GRIDS0 + 0x09u) = 1u;
        U32(ARENA_GRIDS0 + 0x0Cu) = ARENA_CELLS0;

        U32(ARENA_ITEM0 + 0x00u) = 4u;
        U32(ARENA_ITEM0 + 0x04u) = 0u; /* sword */
        U32(ARENA_ITEM0 + 0x0Cu) = 55u;
        U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
        U8(ARENA_ITEMDATA0 + 0x44u) = (c == 1) ? 3u : 4u;
        if (c == 2) U32(ARENA_ITEMDATA0 + 0x18u) = 0x100u; /* broken */

        if (c == 4 || c == 5) {
            U32(ARENA_ITEM1 + 0x00u) = 4u;
            U32(ARENA_ITEM1 + 0x04u) = (c == 4) ? 1u : 0u; /* c==4: type 0x26 missile weapon; c==5: normal sword */
            U32(ARENA_ITEM1 + 0x0Cu) = (c == 4) ? 66u : 55u;
            U32(ARENA_ITEM1 + 0x14u) = ARENA_ITEMDATA1;
            U32(ARENA_CELLS0 + 5u * 4u) = ARENA_ITEM1;
        }

        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDEFB94u, 8u}, {0x6FDD9088u, 0xACu}, {0x6FDED378u, 0x18u},
            {ARENA_SGPT, 0xC10u}, {ARENA_ITEMSTXT, 3u * 0x1A8u}, {ARENA_ITYPEMAT, 0x200u},
            {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x20u}, {ARENA_CELLS0, 0x40u},
            {ARENA_ITEM0, 0x40u}, {ARENA_ITEMDATA0, 0x80u},
            {ARENA_ITEM1, 0x40u}, {ARENA_ITEMDATA1, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 14);
        uint32_t pInv = (c == 0) ? 0u : ARENA_INV0;
        eax = safe_stdcall2(0x6FD70620u, pInv, ARENA_ITEM0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", pInv, ARENA_ITEM0);
        emit_rec(fp, "0x6FD70620", "INVENTORY_UpdateWeaponGuidOnInsert113c", c,
            c == 0 ? "null_inv" : (c == 1 ? "non_hand_bodyloc" : (c == 2 ? "broken_clears_active_guid" :
            (c == 3 ? "no_composit_sets_guid" : (c == 4 ? "type26_composit_overwritten" : "existing_melee_composit_clears_same_guid")))),
            args, regs, 14, asserted, 0u, 0u);
    }

    /* #11: 0x6FD71640 INVENTORY_RemoveItemInternal113c */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = 0u;
        U32(ARENA_INV0 + 0x00u) = (c == 1) ? 0u : 0x01020304u;
        U32(ARENA_INV0 + 0x08u) = ARENA_UNIT0;
        U32(ARENA_INV0 + 0x0Cu) = (c == 3) ? 0u : ARENA_ITEM0;
        U32(ARENA_INV0 + 0x10u) = (c == 3) ? 0u : ARENA_ITEM0;
        U32(ARENA_INV0 + 0x14u) = ARENA_GRIDS0;
        U32(ARENA_INV0 + 0x18u) = 2u;
        U32(ARENA_INV0 + 0x1Cu) = 99u;
        U32(ARENA_INV0 + 0x20u) = (c == 3) ? ARENA_ITEM0 : 0u;
        U32(ARENA_INV0 + 0x28u) = 3u;

        U32(ARENA_GRIDS0 + 0x10u + 0x00u) = ARENA_ITEM0;
        U32(ARENA_GRIDS0 + 0x10u + 0x04u) = ARENA_ITEM0;
        U8(ARENA_GRIDS0 + 0x10u + 0x08u) = 4u;
        U8(ARENA_GRIDS0 + 0x10u + 0x09u) = 4u;
        U32(ARENA_GRIDS0 + 0x10u + 0x0Cu) = ARENA_CELLS0;
        for (int i = 0; i < 16; i++) U32(ARENA_CELLS0 + (uint32_t)i * 4u) = ARENA_ITEM0;

        U32(ARENA_ITEM0 + 0x00u) = 4u;
        U32(ARENA_ITEM0 + 0x04u) = 0u; /* 2x3 sword */
        U32(ARENA_ITEM0 + 0x0Cu) = 99u;
        U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
        U32(ARENA_ITEM0 + 0x2Cu) = ARENA_PATH0;
        U32(ARENA_PATH0 + 0x0Cu) = 1u;
        U32(ARENA_PATH0 + 0x10u) = 0u;
        U32(ARENA_ITEMDATA0 + 0x5Cu + 0x00u) = ARENA_INV0;
        U8(ARENA_ITEMDATA0 + 0x5Cu + 0x0Cu) = (c == 2) ? 2u : 0u; /* nodePos=2 -> gridIdx=1 (bUseDims=1) */
        U8(ARENA_ITEMDATA0 + 0x5Cu + 0x0Du) = 7u;

        mem_region_t regs[] = {
            {0x6FDEFB94u, 8u}, {ARENA_ITEMSTXT, 0x1A8u},
            {ARENA_UNIT0, 0x80u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x30u}, {ARENA_CELLS0, 0x40u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_PATH0, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
        uint32_t pItm = (c == 0) ? 0u : ARENA_ITEM0;
        eax = safe_eax1(0x6FD71640u, pItm, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", pItm);
        emit_rec(fp, "0x6FD71640", "INVENTORY_RemoveItemInternal113c", c,
            c == 0 ? "null_item" : (c == 1 ? "bad_inv_sig" : (c == 2 ? "grid1_list_item_removed" : "cursor_item_removed")),
            args, regs, 9, asserted, eax, 0xFFFFFFFFu);
    }

    /* #12: 0x6FD72150 ITEMS_DecodeItemCompactBitstreamV96_113c */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        /* Build bitstream at ARENA_BITSTREAM:
         * c==0: bad header 0x1234 with bCheckHeader=1 -> 0
         * c==1: valid 'JM' (0x4D4A), flags=0x00010000 (ear), mode=0, bodyLoc=3, gx=2, gy=1, page=4, sockets=5
         * c==2: bCheckHeader=0, flags=0x02000000 (compact -> 0 sockets), mode=3 (ground), posX=0x123, posY=0x456, code='nec ' (v96 > 0x5C keeps 'nec ' -> idx 11!)
         * c==3: valid 'JM', flags=0, mode=1, code='neg ' -> idx 22, sockets=3 */
        uint32_t bitpos = 0u;
        #define PUT_BITS(val, nbits) do { \
            uint32_t _v = (uint32_t)(val); \
            for (int _b = 0; _b < (nbits); _b++) { \
                if ((_v >> _b) & 1u) U8(ARENA_BITSTREAM + (bitpos >> 3)) |= (uint8_t)(1u << (bitpos & 7u)); \
                bitpos++; \
            } \
        } while (0)
        if (c != 2) PUT_BITS(c == 0 ? 0x1234u : 0x4D4Au, 16);
        uint32_t flg = (c == 1) ? 0x00010000u : ((c == 2) ? 0x02000000u : 0u);
        PUT_BITS(flg, 32);
        PUT_BITS(0x155u, 10);
        uint32_t md = (c == 2) ? 3u : 1u;
        PUT_BITS(md, 3);
        if (md == 3u) {
            PUT_BITS(0x0123u, 16);
            PUT_BITS(0x0456u, 16);
        } else {
            PUT_BITS(3u, 4);
            PUT_BITS(2u, 4);
            PUT_BITS(1u, 4);
            PUT_BITS(4u, 3);
        }
        if ((flg & 0x00010000u) == 0u) {
            PUT_BITS(c == 2 ? 0x2063656Eu : 0x2067656Eu, 32);
        }
        if ((flg & 0x02200000u) == 0u) {
            PUT_BITS(c == 1 ? 5u : 3u, 3);
        }
        #undef PUT_BITS

        mem_region_t regs[] = {
            {0x6FDEFF6Cu, 4u}, {ARENA_LINKER, 0x10u}, {ARENA_LINKENTRIES, 0x20u},
            {ARENA_BITSTREAM, 0x20u}, {ARENA_OUT, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 5);
        uint32_t bChk = (c == 2) ? 0u : 1u;
        eax = safe_stdcall4(0x6FD72150u, ARENA_BITSTREAM, 0x20u, bChk, ARENA_OUT, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",32,%u,\"0x%08X\"", ARENA_BITSTREAM, bChk, ARENA_OUT);
        emit_rec(fp, "0x6FD72150", "ITEMS_DecodeItemCompactBitstreamV96_113c", c,
            c == 0 ? "bad_jm_header" : (c == 1 ? "ear_inv_with_sockets" : (c == 2 ? "no_hdr_ground_nec_kept_v96" : "neg_code_with_sockets")),
            args, regs, 5, asserted, eax, 0xFFFFFFFFu);
    }
}

static void emit_b051_unit_part2(FILE *fp) {
    char args[160];
    uint32_t eax = 0u; (void)eax;
    int asserted = 0;

    /* #13: 0x6FD7C9E0 HIRELING_GetActIndex113c */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        /* Rec 0: classic (ver=0), class=271, act=2, name 10..15; Rec 1: exp (ver=100), class=338, act=5, name 40..45 */
        U16(ARENA_HIRELING + 0u * 0x118u + 0x00u) = 0u;
        U32(ARENA_HIRELING + 0u * 0x118u + 0x08u) = 271u;
        U32(ARENA_HIRELING + 0u * 0x118u + 0x0Cu) = 2u;
        U16(ARENA_HIRELING + 0u * 0x118u + 0x114u) = 10u;
        U16(ARENA_HIRELING + 0u * 0x118u + 0x116u) = 15u;

        U16(ARENA_HIRELING + 1u * 0x118u + 0x00u) = 100u;
        U32(ARENA_HIRELING + 1u * 0x118u + 0x08u) = 338u;
        U32(ARENA_HIRELING + 1u * 0x118u + 0x0Cu) = 5u;
        U16(ARENA_HIRELING + 1u * 0x118u + 0x114u) = 40u;
        U16(ARENA_HIRELING + 1u * 0x118u + 0x116u) = 45u;

        mem_region_t regs[] = {
            {0x6FDF0078u, 8u}, {ARENA_HIRELING, 4u * 0x118u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 2);
        uint32_t bExp = (c >= 1) ? 1u : 0u;
        uint32_t clsId = (c == 0) ? 271u : ((c == 1) ? 338u : 999u);
        uint32_t nameId = (c == 2) ? 42u : 99u;
        eax = safe_fastcall3(0x6FD7C9E0u, bExp, clsId, nameId, &asserted);
        snprintf(args, sizeof(args), "%u,%u,%u", bExp, clsId, nameId);
        emit_rec(fp, "0x6FD7C9E0", "HIRELING_GetActIndex113c", c,
            c == 0 ? "classic_class_match_act1" : (c == 1 ? "exp_class_match_act4" :
            (c == 2 ? "exp_name_fallback_act4" : "neither_matches_returns_0")),
            args, regs, 2, asserted, eax, 0xFFFFFFFFu);
    }

    /* #14: 0x6FD7F100 UNITS_StepAnimSeqFrame113c */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x30u) = (c == 0) ? 0u : ARENA_ANIMSEQ;
        U32(ARENA_UNIT0 + 0x38u) = (c == 1) ? 0x0100u : 0x0300u; /* currFp8: idx 1 or idx 3 */
        U32(ARENA_UNIT0 + 0x40u) = (c == 3) ? 5u : 2u; /* oldSeqMode */
        /* Populate 5 anim-seq records (6 bytes each: +2=mode, +3=frame, +4=dir, +5=event) */
        for (uint32_t i = 0; i < 5u; i++) {
            U8(ARENA_ANIMSEQ + i * 6u + 2u) = 5u;
            U8(ARENA_ANIMSEQ + i * 6u + 3u) = (uint8_t)(10u + i);
            U8(ARENA_ANIMSEQ + i * 6u + 5u) = (i == 2u) ? 9u : ((i == 1u) ? 4u : 0u);
        }
        mem_region_t regs[] = {
            {ARENA_UNIT0, 0x60u}, {ARENA_ANIMSEQ, 0x30u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 2);
        uint32_t prevFp8 = (c == 1) ? 0x0100u : ((c == 2) ? 0x0100u : 0x0400u);
        eax = safe_6FD7F100(0x6FD7F100u, ARENA_UNIT0, prevFp8, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",%u", ARENA_UNIT0, prevFp8);
        emit_rec(fp, "0x6FD7F100", "UNITS_StepAnimSeqFrame113c", c,
            c == 0 ? "null_seq_clears_mode" : (c == 1 ? "same_fp8_direct_event" :
            (c == 2 ? "sweeps_intermediate_events" : "prev_gt_curr_no_mode_change")),
            args, regs, 2, asserted, eax, 0xFFFFFFFFu);
    }

    /* #15: 0x6FD80B80 UNITS_IsCastAnimMode113c */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0xA8u) = ARENA_SKILLLIST;
        U32(ARENA_SKILLLIST + 0x10u) = (c == 2) ? 0u : ARENA_SKILL0;
        U32(ARENA_SKILL0 + 0x00u) = ARENA_SKILLSTXT + 2u * 0x23Cu;
        U16(ARENA_SKILLSTXT + 2u * 0x23Cu + 0x00u) = 2u;
        U8(ARENA_SKILLSTXT + 2u * 0x23Cu + 0x12u) = (c == 3) ? 0x0Au : 0x05u;

        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {ARENA_SGPT, 0xBA8u}, {ARENA_SKILLSTXT, 4u * 0x23Cu},
            {ARENA_UNIT0, 0xC0u}, {ARENA_SKILLLIST, 0x20u}, {ARENA_SKILL0, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 6);
        uint32_t uType = (c <= 4) ? 0u : 1u;
        uint32_t md = (c == 0) ? 0x0Au : ((c == 1) ? 0x04u : ((c <= 4) ? 0x12u : 7u));
        uint32_t pU = (c == 2 && md == 0x12u) ? ARENA_UNIT0 : ((c == 3 || c == 4) ? ARENA_UNIT0 : 0u);
        eax = safe_6FD80B80(0x6FD80B80u, uType, md, pU, &asserted);
        snprintf(args, sizeof(args), "%u,%u,\"0x%08X\"", uType, md, pU);
        emit_rec(fp, "0x6FD80B80", "UNITS_IsCastAnimMode113c", c,
            c == 0 ? "plr_mode_10_true" : (c == 1 ? "plr_mode_4_false" : (c == 2 ? "plr_seq_no_skill" :
            (c == 3 ? "plr_seq_skill_anim_10_true" : (c == 4 ? "plr_seq_skill_anim_5_false" : "mon_mode_7_true")))),
            args, regs, 6, asserted, eax, 0xFFFFFFFFu);
    }

    /* #16: 0x6FD80F80 UNITS_GetUnitSizeX113c */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = (uint32_t)(c == 0 ? 0 : c - 1);
        U32(ARENA_UNIT0 + 0x04u) = 1u;
        U16(ARENA_MONSTATS + 1u * 0x1A8u + 0x18u) = 2u;
        U8(ARENA_MONSTATS2 + 2u * 0x134u + 0x08u) = 3u;
        U32(ARENA_UNIT0 + 0x14u) = ARENA_OBJDATA0;
        U32(ARENA_OBJDATA0 + 0x00u) = ARENA_OBJTXT0;
        U32(ARENA_OBJTXT0 + 0xD0u) = 5u;
        U8(ARENA_MISSTXT + 0u * 0x1A4u + 0x18Au) = 3u;
        U8(ARENA_MISSTXT + 1u * 0x1A4u + 0x18Au) = 7u;

        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {ARENA_SGPT, 0xB80u},
            {ARENA_MONSTATS, 2u * 0x1A8u}, {ARENA_MONSTATS2, 3u * 0x134u},
            {ARENA_MISSTXT, 2u * 0x1A4u}, {ARENA_UNIT0, 0x40u},
            {ARENA_OBJDATA0, 0x20u}, {ARENA_OBJTXT0, 0x100u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
        uint32_t pU = (c == 0) ? 0u : ARENA_UNIT0;
        eax = safe_stdcall1(0x6FD80F80u, pU, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", pU);
        emit_rec(fp, "0x6FD80F80", "UNITS_GetUnitSizeX113c", c,
            c == 0 ? "null_unit" : (c == 1 ? "player_size_2" : (c == 2 ? "monster_size_3" :
            (c == 3 ? "object_size_5" : (c == 4 ? "missile_size_7" : "item_size_1")))),
            args, regs, 8, asserted, eax, 0xFFFFFFFFu);
    }

    /* #17: 0x6FD811B0 UNITS_IsCorpseUseable113c */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = (c == 1) ? 0u : 1u;
        U32(ARENA_UNIT0 + 0x04u) = 1u;
        U32(ARENA_UNIT0 + 0x10u) = (c == 2) ? 5u : 0x0Cu;
        U16(ARENA_MONSTATS + 1u * 0x1A8u + 0x18u) = 2u;
        U8(ARENA_MONSTATS2 + 2u * 0x134u + 0x06u) = (c == 3) ? 0x08u : 0u; /* bit 3 blocks corpse */
        U8(ARENA_MONSTATS2 + 2u * 0x134u + 0x04u) = (c == 4) ? 0u : 0x80u; /* bit 7 required */
        if (c == 5) {
            U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST0 + 0x58u) = ARENA_STATHIST;
            U32(ARENA_STATHIST + 0u) = 0x10u;
            U32(ARENA_STATEMASKS + 0u) = 0x10u; /* state mask 33 active -> blocks corpse */
        }

        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xAA0u},
            {ARENA_MONSTATS, 2u * 0x1A8u}, {ARENA_MONSTATS2, 3u * 0x134u},
            {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u},
            {ARENA_STATHIST, 0x30u}, {ARENA_STATEMASKS, 0x30u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
        uint32_t pU = (c == 0) ? 0u : ARENA_UNIT0;
        eax = safe_stdcall1(0x6FD811B0u, pU, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", pU);
        emit_rec(fp, "0x6FD811B0", "UNITS_IsCorpseUseable113c", c,
            c == 0 ? "null_unit" : (c == 1 ? "non_monster" : (c == 2 ? "alive_mode" :
            (c == 3 ? "flag06_bit3_blocks" : (c == 4 ? "Useable_ok" : "state_mask33_blocks")))),
            args, regs, 9, asserted, eax, 0xFFFFFFFFu);
    }

    /* Fix c==4 vs c==5 ordering for 0x6FD811B0: also emit explicit useable=1 vector when bit 7 set and no mask33! */
    {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = 1u;
        U32(ARENA_UNIT0 + 0x04u) = 1u;
        U32(ARENA_UNIT0 + 0x10u) = 0x0Cu;
        U16(ARENA_MONSTATS + 1u * 0x1A8u + 0x18u) = 2u;
        U8(ARENA_MONSTATS2 + 2u * 0x134u + 0x04u) = 0x80u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xAA0u},
            {ARENA_MONSTATS, 2u * 0x1A8u}, {ARENA_MONSTATS2, 3u * 0x134u},
            {ARENA_UNIT0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 6);
        eax = safe_stdcall1(0x6FD811B0u, ARENA_UNIT0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
        emit_rec(fp, "0x6FD811B0", "UNITS_IsCorpseUseable113c", 6,
            "corpse_useable_returns_1", args, regs, 6, asserted, eax, 0xFFFFFFFFu);
    }

    /* #18: 0x6FD83D60 STATES_CheckStateMask33OnUnit113c */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        U32(ARENA_SGPT + 0x0C4u) = (c == 3) ? 200u : 185u; /* c==3: 7th dword (index 6) dynamic test! */
        U32(ARENA_UNIT0 + 0x5Cu) = (c == 0) ? 0u : ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10u) = (c == 1) ? 0u : 0x80000000u;
        U32(ARENA_STATLIST0 + 0x58u) = ARENA_STATHIST;
        if (c == 2) {
            U32(ARENA_STATHIST + 8u) = 0x0400u;
            U32(ARENA_STATEMASKS + 8u) = 0x0400u;
        } else if (c == 3) {
            U32(ARENA_STATHIST + 24u) = 0x01u;
            U32(ARENA_STATEMASKS + 24u) = 0x01u;
        }
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {ARENA_SGPT, 0x160u}, {ARENA_UNIT0, 0x80u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATHIST, 0x30u}, {ARENA_STATEMASKS, 0x30u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 6);
        eax = safe_stdcall1(0x6FD83D60u, ARENA_UNIT0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
        emit_rec(fp, "0x6FD83D60", "STATES_CheckStateMask33OnUnit113c", c,
            c == 0 ? "no_statlist" : (c == 1 ? "not_extended" : (c == 2 ? "match_word2" : "match_dynamic_word6")),
            args, regs, 6, asserted, eax, 0xFFFFFFFFu);
    }

    /* #19: 0x6FDA01E0 UNITS_GetTransformGfx113c */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = (c == 3 || c == 4) ? 1u : 0u;
        U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
        U32(ARENA_UNIT0 + 0xC8u) = (c == 1) ? 0u : 0x08u; /* disguise bit */
        U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
        U32(ARENA_STATLIST0 + 0x58u) = ARENA_STATHIST;
        U16(ARENA_SGPT + 0x180u) = 1u;
        U16(ARENA_XFORMSTATES + 0u) = 5u;
        U32(ARENA_STATHIST + 0u) = (1u << 5);
        U8(ARENA_STATESTXT + 5u * 0x3Cu + 0x2Du) = (c >= 3) ? 2u : 1u; /* 1=monster xform, 2=player xform */
        U16(ARENA_STATESTXT + 5u * 0x3Cu + 0x2Eu) = (c == 3) ? 6u : 2u;
        U16(ARENA_MONSTATS + 2u * 0x1A8u + 0x18u) = 1u;
        U32(ARENA_MONSTATS2 + 1u * 0x134u + 0xF0u) = 0xFFFFFFFFu;
        U32(ARENA_OUT + 0u) = 99u;
        U32(ARENA_OUT + 4u) = 99u;
        U32(ARENA_OUT + 8u) = (c == 3) ? 4u : 1u;

        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDE3088u, 0x90u},
            {ARENA_SGPT, 0xAA0u}, {ARENA_XFORMSTATES, 0x10u}, {ARENA_STATESTXT, 6u * 0x3Cu},
            {ARENA_MONSTATS, 3u * 0x1A8u}, {ARENA_MONSTATS2, 2u * 0x134u},
            {ARENA_UNIT0, 0xE0u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATHIST, 0x20u}, {ARENA_OUT, 0x10u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 12);
        uint32_t pU = (c == 0) ? 0u : ARENA_UNIT0;
        eax = safe_stdcall6(0x6FDA01E0u, pU, ARENA_OUT, ARENA_OUT + 4u, ARENA_OUT + 8u, 0u, 0u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",\"0x%08X\",\"0x%08X\",0,0",
            pU, ARENA_OUT, ARENA_OUT + 4u, ARENA_OUT + 8u);
        emit_rec(fp, "0x6FDA01E0", "UNITS_GetTransformGfx113c", c,
            c == 0 ? "null_unit" : (c == 1 ? "no_disguise_flag" : (c == 2 ? "plr_to_mon_gfxtype1" :
            (c == 3 ? "mon_assassin_mode4_to_12" : "mon_to_plr_table_mode"))),
            args, regs, 12, asserted, 0u, 0u);
    }

    /* #20: 0x6FDBB140 MISSILE_RollLimitedFromUnitSeed113c */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x20u) = 0x12345678u;
        U32(ARENA_UNIT0 + 0x24u) = 0x0000029Au;
        mem_region_t regs[] = { {ARENA_UNIT0, 0x40u} };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 1);
        uint32_t pU = (c == 0) ? 0u : ARENA_UNIT0;
        uint32_t nMin = (c == 1) ? 10u : ((c == 2) ? 5u : 10u);
        uint32_t nMax = (c == 1) ? 5u : ((c == 2) ? 12u : 18u); /* c==2 range 7 (non-pow2), c==3 range 8 (pow2) */
        eax = safe_fastcall4(0x6FDBB140u, nMin, nMax, 0xDEADu, pU, &asserted);
        snprintf(args, sizeof(args), "%u,%u,57005,\"0x%08X\"", nMin, nMax, pU);
        emit_rec(fp, "0x6FDBB140", "MISSILE_RollLimitedFromUnitSeed113c", c,
            c == 0 ? "null_unit_returns_0" : (c == 1 ? "max_lt_min_clamps" :
            (c == 2 ? "non_pow2_range_7" : "pow2_range_8")),
            args, regs, 1, asserted, eax, 0xFFFFFFFFu);
    }
}

static void emit_b048_all(FILE *fp) {
    char args[160];
    uint32_t eax = 0u; (void)eax;
    int asserted = 0;

    /* #21: 0x6FD62450 UNITS_AreInAdjacentRooms113c */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = 0u;
        U32(ARENA_UNIT0 + 0x2Cu) = ARENA_PATH0;
        U32(ARENA_PATH0 + 0x1Cu) = ARENA_ROOM0;

        U32(ARENA_UNIT1 + 0x00u) = 0u;
        U32(ARENA_UNIT1 + 0x2Cu) = ARENA_PATH1;
        U32(ARENA_PATH1 + 0x1Cu) = (c == 2) ? 0u : ARENA_ROOM1;

        U32(ARENA_ROOM1 + 0x00u) = ARENA_ROOMSNEAR;
        U32(ARENA_ROOM1 + 0x24u) = 2u;
        U32(ARENA_ROOMSNEAR + 0u) = 0x11111111u;
        U32(ARENA_ROOMSNEAR + 4u) = (c == 4) ? ARENA_ROOM0 : 0x22222222u;

        mem_region_t regs[] = {
            {ARENA_UNIT0, 0x40u}, {ARENA_UNIT1, 0x40u},
            {ARENA_PATH0, 0x40u}, {ARENA_PATH1, 0x40u},
            {ARENA_ROOM0, 0x80u}, {ARENA_ROOM1, 0x80u}, {ARENA_ROOMSNEAR, 0x10u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 7);
        uint32_t u1 = (c == 0) ? 0u : ARENA_UNIT0;
        uint32_t u2 = (c == 1) ? 0u : ARENA_UNIT1;
        eax = safe_stdcall2(0x6FD62450u, u1, u2, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", u1, u2);
        emit_rec(fp, "0x6FD62450", "UNITS_AreInAdjacentRooms113c", c,
            c == 0 ? "null_u1_asserts_18" : (c == 1 ? "null_u2_asserts_19" : (c == 2 ? "null_room2_returns_0" :
            (c == 3 ? "not_adjacent" : "adjacent_room_found"))),
            args, regs, 7, asserted, eax, 0xFFFFFFFFu);
    }

    /* #23: 0x6FD69A50 SEED_PickRandomListNode113c */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        U32(ARENA_OWNER + 0x08u) = (c == 2) ? 1u : 3u;
        U32(ARENA_OWNER + 0x10u) = (c == 1) ? 0u : ARENA_NODE0;
        U32(ARENA_OWNER + 0x1C4u) = 0x98765432u;
        U32(ARENA_OWNER + 0x1C8u) = 0x0000029Au;
        U32(ARENA_NODE0 + 0x24u) = ARENA_NODE1;
        U32(ARENA_NODE1 + 0x24u) = ARENA_NODE2;
        U32(ARENA_NODE2 + 0x24u) = 0u;

        mem_region_t regs[] = {
            {ARENA_OWNER, 0x1D0u}, {ARENA_NODE0, 0x30u}, {ARENA_NODE1, 0x30u}, {ARENA_NODE2, 0x30u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 4);
        uint32_t pOwn = (c == 0) ? 0u : ARENA_OWNER;
        eax = safe_eax1(0x6FD69A50u, pOwn, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", pOwn);
        emit_rec(fp, "0x6FD69A50", "SEED_PickRandomListNode113c", c,
            c == 0 ? "null_owner_asserts_13e" : (c == 1 ? "null_first_asserts_13f" :
            (c == 2 ? "count_1_picks_head" : "count_3_advances_list")),
            args, regs, 4, asserted, eax, 0xFFFFFFFFu);
    }

    /* #24: 0x6FD6E4F0 INVENTORY_AppendItemGuidNode113c */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        U32(ARENA_INV0 + 0x00u) = 0x01020304u;
        U32(ARENA_ITEM0 + 0x00u) = (c == 1) ? 0u : 4u;
        U32(ARENA_ITEM0 + 0x0Cu) = 0x7788u;
        if (c == 2 || c == 3) {
            U32(ARENA_NODE0 + 0x00u) = (c == 2) ? 0x7788u : 0x1122u;
            U32(ARENA_NODE0 + 0x04u) = 0u;
            U32(ARENA_INV0 + 0x2Cu) = ARENA_NODE0;
            U32(ARENA_INV0 + 0x30u) = ARENA_NODE0;
        }
        if (c == 4) g_force_alloc_null = 1;

        mem_region_t regs[] = {
            {ARENA_INV0, 0x40u}, {ARENA_ITEM0, 0x20u}, {ARENA_NODE0, 0x10u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
        uint32_t pInv = (c == 0) ? 0u : ARENA_INV0;
        eax = safe_stdcall2(0x6FD6E4F0u, pInv, ARENA_ITEM0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", pInv, ARENA_ITEM0);
        emit_rec(fp, "0x6FD6E4F0", "INVENTORY_AppendItemGuidNode113c", c + 1,
            c == 0 ? "null_inv" : (c == 1 ? "non_item" : (c == 2 ? "duplicate_guid_skipped" :
            (c == 3 ? "appends_after_existing_node" : "alloc_null_asserts_d0b"))),
            args, regs, 3, asserted, 0u, 0u);
    }
    /* Also empty-list case 0 for 0x6FD6E4F0 */
    {
        setup_common_tables();
        U32(ARENA_INV0 + 0x00u) = 0x01020304u;
        U32(ARENA_ITEM0 + 0x00u) = 4u;
        U32(ARENA_ITEM0 + 0x0Cu) = 0x99AAu;
        mem_region_t regs[] = { {ARENA_INV0, 0x40u}, {ARENA_ITEM0, 0x20u} };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 2);
        eax = safe_stdcall2(0x6FD6E4F0u, ARENA_INV0, ARENA_ITEM0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_INV0, ARENA_ITEM0);
        emit_rec(fp, "0x6FD6E4F0", "INVENTORY_AppendItemGuidNode113c", 0,
            "empty_list_sets_first_and_last", args, regs, 2, asserted, 0u, 0u);
    }

    /* #25..#28: 0x6FD80590, 0x6FD80600, 0x6FD80670, 0x6FD806D0 PLAYER_Store*Skill113c */
    {
        static const uint32_t sk_vas[4] = {0x6FD80590u, 0x6FD80600u, 0x6FD80670u, 0x6FD806D0u};
        static const char *sk_names[4] = {
            "PLAYER_StoreSwitchLeftSkill113c",
            "PLAYER_StoreSwitchRightSkill113c",
            "PLAYER_StoreLeftSkill113c",
            "PLAYER_StoreRightSkill113c"
        };
        static const char *null_pd_notes[4] = {
            "null_plrdata_asserts_1424",
            "null_plrdata_asserts_1414",
            "null_plrdata_asserts_1405",
            "null_plrdata_asserts_13f6"
        };
        for (int si = 0; si < 4; si++) {
            int is_left = (si == 0 || si == 2);
            for (int c = 0; c < 7; c++) {
                setup_common_tables();
                for (uint32_t off = 0x70u; off <= 0x8Cu; off += 4u) {
                    U32(ARENA_PLRDATA0 + off) = 0xA0A00000u | off;
                }
                U32(ARENA_UNIT0 + 0x00u) = (c == 1) ? 1u : 0u;
                U32(ARENA_UNIT0 + 0x14u) = (c == 4) ? 0u : ARENA_PLRDATA0;
                U32(ARENA_UNIT0 + 0xA8u) = (c == 5) ? 0u : ARENA_SKILLLIST;
                U32(ARENA_SKILLLIST + 0x08u) = (c == 2 && is_left) ? 0u : ARENA_SKILL0;  /* pLeftSkill */
                U32(ARENA_SKILLLIST + 0x0Cu) = (c == 2 && !is_left) ? 0u : ARENA_SKILL1; /* pRightSkill */

                U32(ARENA_SKILL0 + 0x00u) = ARENA_SKILLSTXT + 3u * 0x23Cu;
                U32(ARENA_SKILL0 + 0x30u) = 0xDEAD3000u;
                U32(ARENA_SKILL0 + 0x34u) = (c == 6) ? 0xCAFEBABEu : 0x11223344u; /* dwOwnerGuid */
                U32(ARENA_SKILL0 + 0x38u) = 0xDEAD3800u;
                U16(ARENA_SKILLSTXT + 3u * 0x23Cu + 0x00u) = (c == 6) ? 0xFFFEu : 37u;

                U32(ARENA_SKILL1 + 0x00u) = ARENA_SKILLSTXT + 5u * 0x23Cu;
                U32(ARENA_SKILL1 + 0x30u) = 0xDEAD3001u;
                U32(ARENA_SKILL1 + 0x34u) = (c == 6) ? 0x8BADF00Du : 0x55667788u; /* dwOwnerGuid */
                U32(ARENA_SKILL1 + 0x38u) = 0xDEAD3801u;
                U16(ARENA_SKILLSTXT + 5u * 0x23Cu + 0x00u) = (c == 6) ? 0xFFFDu : 54u;

                mem_region_t regs[] = {
                    {ARENA_UNIT0, 0xC0u}, {ARENA_PLRDATA0, 0xA0u}, {ARENA_SKILLLIST, 0x20u},
                    {ARENA_SKILL0, 0x40u}, {ARENA_SKILL1, 0x40u},
                    {ARENA_SKILLSTXT + 3u * 0x23Cu, 0x10u}, {ARENA_SKILLSTXT + 5u * 0x23Cu, 0x10u}
                };
                capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 7);
                uint32_t pU = (c == 0) ? 0u : ARENA_UNIT0;
                eax = safe_stdcall1(sk_vas[si], pU, &asserted);
                snprintf(args, sizeof(args), "\"0x%08X\"", pU);
                const char *note =
                    (c == 0) ? "null_unit" :
                    (c == 1) ? "non_player" :
                    (c == 2) ? "null_skill_asserts_638" :
                    (c == 3) ? "stores_skill_and_owner" :
                    (c == 4) ? null_pd_notes[si] :
                    (c == 5) ? (is_left ? "null_pskills_asserts_3ea" : "null_pskills_asserts_40f") :
                               "stores_neg_skill_id_signext";
                emit_rec(fp, si == 0 ? "0x6FD80590" : (si == 1 ? "0x6FD80600" : (si == 2 ? "0x6FD80670" : "0x6FD806D0")),
                    sk_names[si], c, note, args, regs, 7, asserted, 0u, 0u);
            }
        }
    }

    /* #29: 0x6FD80BD0 UNITS_IsAttackAnimMode113c */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0xA8u) = ARENA_SKILLLIST;
        U32(ARENA_SKILLLIST + 0x10u) = (c == 3) ? 0u : ARENA_SKILL0;
        U32(ARENA_SKILL0 + 0x00u) = ARENA_SKILLSTXT + 2u * 0x23Cu;
        U16(ARENA_SKILLSTXT + 2u * 0x23Cu + 0x00u) = 2u;
        U8(ARENA_SKILLSTXT + 2u * 0x23Cu + 0x06u) = (c == 4) ? 0x08u : 0x00u; /* bit 3 */

        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDDC5F8u, 0x420u},
            {ARENA_SGPT, 0xBA8u}, {ARENA_SKILLSTXT, 3u * 0x23Cu},
            {ARENA_UNIT0, 0xC0u}, {ARENA_SKILLLIST, 0x20u}, {ARENA_SKILL0, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
        uint32_t uType = (c == 0) ? 2u : ((c == 5) ? 1u : 0u);
        uint32_t md = (c == 1) ? 4u : ((c == 2) ? 1u : ((c == 5) ? 4u : 0x12u));
        uint32_t clsId = (c == 5) ? 500u : 0u; /* >= 0x19A high monster table */
        eax = safe_6FD80BD0(0x6FD80BD0u, uType, md, ARENA_UNIT0, clsId, &asserted);
        snprintf(args, sizeof(args), "%u,%u,\"0x%08X\",%u", uType, md, ARENA_UNIT0, clsId);
        emit_rec(fp, "0x6FD80BD0", "UNITS_IsAttackAnimMode113c", c,
            c == 0 ? "invalid_utype_asserts_bef" : (c == 1 ? "plr_attack_mode_1" :
            (c == 2 ? "plr_neutral_mode_0" : (c == 3 ? "plr_seq_no_skill_0" :
            (c == 4 ? "plr_seq_skill_bit3_nonzero" : "mon_high_table_attack_1")))),
            args, regs, 8, asserted, eax, 0xFFFFFFFFu);
    }

    /* #30: 0x6FD80EE0 UNITS_GetUnitSizeY113c */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = (uint32_t)(c == 0 ? 0 : c - 1);
        U32(ARENA_UNIT0 + 0x04u) = 1u;
        U16(ARENA_MONSTATS + 1u * 0x1A8u + 0x18u) = 2u;
        U8(ARENA_MONSTATS2 + 2u * 0x134u + 0x09u) = 4u;
        U32(ARENA_UNIT0 + 0x14u) = ARENA_OBJDATA0;
        U32(ARENA_OBJDATA0 + 0x00u) = ARENA_OBJTXT0;
        U32(ARENA_OBJTXT0 + 0xD4u) = 6u;
        U8(ARENA_MISSTXT + 0u * 0x1A4u + 0x18Au) = 3u;
        U8(ARENA_MISSTXT + 1u * 0x1A4u + 0x18Au) = 8u;

        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {ARENA_SGPT, 0xB80u},
            {ARENA_MONSTATS, 2u * 0x1A8u}, {ARENA_MONSTATS2, 3u * 0x134u},
            {ARENA_MISSTXT, 2u * 0x1A4u}, {ARENA_UNIT0, 0x40u},
            {ARENA_OBJDATA0, 0x20u}, {ARENA_OBJTXT0, 0x100u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
        uint32_t pU = (c == 0) ? 0u : ARENA_UNIT0;
        eax = safe_stdcall1(0x6FD80EE0u, pU, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", pU);
        emit_rec(fp, "0x6FD80EE0", "UNITS_GetUnitSizeY113c", c,
            c == 0 ? "null_unit_asserts_74b" : (c == 1 ? "player_size_2" : (c == 2 ? "monster_size_4" :
            (c == 3 ? "object_size_6" : (c == 4 ? "missile_size_8" : "item_size_1")))),
            args, regs, 8, asserted, eax, 0xFFFFFFFFu);
    }

    /* #31: 0x6FD813F0 UNITS_IsInMovingMode113c */
    for (int c = 0; c < 7; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = (c == 1 || c == 2) ? 0u : ((c == 6) ? 3u : 1u);
        U32(ARENA_UNIT0 + 0x04u) = (c == 4) ? 0x6Eu : 5u;
        U32(ARENA_UNIT0 + 0x10u) = (c == 1) ? 3u : ((c == 2) ? 1u : ((c == 3) ? 2u : ((c == 4 || c == 5) ? 8u : 0u)));
        if (c == 2) {
            U32(ARENA_UNIT0 + 0x30u) = ARENA_ANIMSEQ;
            U32(ARENA_UNIT0 + 0x40u) = 6u; /* seq mode 6 -> moving! */
        }
        U16(ARENA_MONSTATS + 0x6Eu * 0x1A8u + 0x02u) = 0x6Eu;
        U16(ARENA_MONSTATS + 5u * 0x1A8u + 0x02u) = 5u;

        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {ARENA_SGPT, 0xA88u},
            {ARENA_MONSTATS, 112u * 0x1A8u}, {ARENA_UNIT0, 0x60u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 4);
        uint32_t pU = (c == 0) ? 0u : ARENA_UNIT0;
        eax = safe_stdcall1(0x6FD813F0u, pU, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", pU);
        emit_rec(fp, "0x6FD813F0", "UNITS_IsInMovingMode113c", c,
            c == 0 ? "null_unit" : (c == 1 ? "plr_walk_mode3" : (c == 2 ? "plr_seq_mode6" :
            (c == 3 ? "mon_mode2_moving" : (c == 4 ? "mon_mode8_vulture_6e_true" :
            (c == 5 ? "mon_mode8_other_false" : "missile_asserts_1325"))))),
            args, regs, 4, asserted, eax, 0xFFFFFFFFu);
    }

    /* #32: 0x6FD83990 UNITS_FreeUnit113c */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = (c == 3) ? 1u : 0u;
        U32(ARENA_UNIT0 + 0x0Cu) = 0x42u;
        U32(ARENA_UNIT0 + 0x14u) = (c == 3) ? ARENA_MONDATA0 : 0u;
        U32(ARENA_UNIT0 + 0x5Cu) = (c >= 2) ? ARENA_STATLIST0 : 0u;
        U32(ARENA_STATLIST0 + 0x10u) = (c == 2) ? 0x80000000u : 0u;
        U32(ARENA_UNIT0 + 0xA8u) = (c == 2) ? ARENA_SKILLLIST : 0u;
        U32(ARENA_SKILLLIST + 0x04u) = ARENA_SKILL0;

        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {ARENA_UNIT0, 0xF0u}, {ARENA_STATLIST0, 0x80u},
            {ARENA_SKILLLIST, 0x20u}, {ARENA_SKILL0, 0x40u}, {ARENA_MONDATA0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
        uint32_t pU = (c == 0) ? 0u : ARENA_UNIT0;
        eax = safe_stdcall1(0x6FD83990u, pU, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", pU);
        emit_rec(fp, "0x6FD83990", "UNITS_FreeUnit113c", c,
            c == 0 ? "null_unit" : (c == 1 ? "plain_unit_sets_type6_guid_ff" :
            (c == 2 ? "extended_statlist_and_skills" : "monster_nonext_statlist")),
            args, regs, 8, asserted, 0u, 0u);
    }

    /* #33: 0x6FD97020 ITEMMODS_GetOrCreateStatList113c */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = 0u;
        U32(ARENA_UNIT0 + 0x0Cu) = 0x5566u;
        U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;

        U32(ARENA_ITEM0 + 0x00u) = 4u;
        U32(ARENA_ITEM0 + 0x0Cu) = 0x8899u;
        if (c == 0) {
            /* pItem == 0 -> falls back to pUnit; stateId == 0 -> searches by flag 0x40 */
            U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST1 + 0x10u) = 0x40u;
        } else if (c == 1) {
            U32(ARENA_ITEM0 + 0x5Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST1 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST0 + 0x10u) = 0x40u;
            U32(ARENA_STATLIST0 + 0x14u) = 7u;
            U32(ARENA_STATLIST1 + 0x3Cu) = ARENA_STATLIST0;
        } else if (c == 2) {
            /* pItem == 0, pUnit creates new statlist */
        } else if (c == 4) {
            g_force_alloc_null = 1;
        }
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {ARENA_UNIT0, 0x80u}, {ARENA_ITEM0, 0x80u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 7);
        uint32_t pItm = (c == 0 || c == 2) ? 0u : ARENA_ITEM0;
        uint32_t pOwn = ARENA_UNIT0;
        uint32_t stId = (c == 0) ? 0u : 7u;
        eax = safe_6FD97020(0x6FD97020u, pItm, pOwn, stId, 0x40u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",%u,64", pItm, pOwn, stId);
        emit_rec(fp, "0x6FD97020", "ITEMMODS_GetOrCreateStatList113c", c,
            c == 0 ? "null_item_uses_unit_flag_lookup" : (c == 1 ? "existing_on_item_state_returned" :
            (c == 2 ? "null_item_allocates_on_unit" : (c == 3 ? "allocates_on_item" : "alloc_null_asserts_201"))),
            args, regs, 7, asserted, eax, 0xFFFFFFFFu);
    }

    /* #34: 0x6FDB6410 UNITROOM_UnlinkUnitFromUpdateList113c */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = 0u;
        U32(ARENA_UNIT0 + 0x2Cu) = ARENA_PATH0;
        U32(ARENA_PATH0 + 0x1Cu) = (c == 1 || c == 2) ? 0u : ARENA_ROOM0;
        U32(ARENA_UNIT0 + 0xE0u) = (c == 1) ? ARENA_UNIT1 : ((c == 3) ? ARENA_UNIT1 : 0u);
        if (c == 3) {
            U32(ARENA_ROOM0 + 0x1Cu) = ARENA_UNIT0;
        } else if (c == 4) {
            U32(ARENA_ROOM0 + 0x1Cu) = ARENA_UNIT1;
            U32(ARENA_UNIT1 + 0xE0u) = ARENA_UNIT0;
            U32(ARENA_UNIT0 + 0xE0u) = ARENA_UNIT2;
        }
        mem_region_t regs[] = {
            {ARENA_UNIT0, 0xF0u}, {ARENA_UNIT1, 0xF0u}, {ARENA_UNIT2, 0xF0u},
            {ARENA_PATH0, 0x40u}, {ARENA_ROOM0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 5);
        uint32_t pU = (c == 0) ? 0u : ARENA_UNIT0;
        eax = safe_stdcall1(0x6FDB6410u, pU, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", pU);
        emit_rec(fp, "0x6FDB6410", "UNITROOM_UnlinkUnitFromUpdateList113c", c,
            c == 0 ? "null_unit_asserts_127" : (c == 1 ? "no_room_dangling_next_asserts_132" :
            (c == 2 ? "no_room_clean_noop" : (c == 3 ? "unlinks_head_of_updatelist" : "unlinks_middle_of_updatelist"))),
            args, regs, 5, asserted, 0u, 0u);
    }

    /* #35: 0x6FDB6630 UNITROOM_ValidateUnitInRoom113c */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = (c == 5) ? 2u : 0u; /* static object vs dynamic player */
        U32(ARENA_UNIT0 + 0x2Cu) = ARENA_PATH0;
        if (c == 5) {
            U32(ARENA_PATH0 + 0x0Cu) = 15u;
            U32(ARENA_PATH0 + 0x10u) = 25u;
        } else {
            U16(ARENA_PATH0 + 0x02u) = (c == 1) ? 50u : 15u;
            U16(ARENA_PATH0 + 0x06u) = (c == 2) ? 2u : 25u;
        }
        U32(ARENA_ROOM0 + 0x4Cu) = 10u;
        U32(ARENA_ROOM0 + 0x50u) = 20u;
        U32(ARENA_ROOM0 + 0x54u) = 30u;
        U32(ARENA_ROOM0 + 0x58u) = 30u;
        if (c == 3 || c == 4) U32(ARENA_ROOM0 + 0x74u) = ARENA_UNIT0;

        mem_region_t regs[] = {
            {ARENA_UNIT0, 0xF0u}, {ARENA_PATH0, 0x40u}, {ARENA_ROOM0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
        uint32_t pRm = (c == 0) ? 0u : ARENA_ROOM0;
        uint32_t bAs = (c == 3) ? 1u : 0u;
        eax = safe_6FDB6630(0x6FDB6630u, pRm, ARENA_UNIT0, bAs, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",%u", pRm, ARENA_UNIT0, bAs);
        emit_rec(fp, "0x6FDB6630", "UNITROOM_ValidateUnitInRoom113c", c,
            c == 0 ? "null_room_asserts_2e" : (c == 1 ? "x_out_of_bounds_asserts_2e" :
            (c == 2 ? "y_out_of_bounds_asserts_2e" : (c == 3 ? "present_with_assert_36" :
            (c == 4 ? "present_no_assert_returns_0" : "static_unit_valid_returns_1")))),
            args, regs, 3, asserted, eax, 0xFFFFFFFFu);
    }

    /* #36: 0x6FDB68A0 UNITROOM_ClearUnitRoom113c */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = (c == 1 || c == 2) ? 2u : 0u; /* object vs player */
        U32(ARENA_UNIT0 + 0x2Cu) = ARENA_PATH0;
        if (c == 1) {
            U32(ARENA_PATH0 + 0x00u) = ARENA_ROOM0;
            U32(ARENA_ROOM0 + 0x74u) = ARENA_UNIT0;
        } else if (c == 3) {
            U32(ARENA_PATH0 + 0x1Cu) = ARENA_ROOM0;
            U32(ARENA_PATH0 + 0x30u) = ARENA_UNIT0;
            U32(ARENA_ROOM0 + 0x28u) = 1u;
            U32(ARENA_ROOM0 + 0x74u) = ARENA_UNIT0;
            U32(ARENA_PATH0 + 0x10u) = 0x12345678u;
            U32(ARENA_PATH0 + 0x14u) = 0x9ABCDEF0u;
        }
        mem_region_t regs[] = {
            {0x6FDDD458u, 8u}, {ARENA_UNIT0, 0xF0u}, {ARENA_PATH0, 0x40u}, {ARENA_ROOM0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 4);
        uint32_t pU = (c == 0) ? 0u : ARENA_UNIT0;
        eax = safe_stdcall1(0x6FDB68A0u, pU, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", pU);
        emit_rec(fp, "0x6FDB68A0", "UNITROOM_ClearUnitRoom113c", c,
            c == 0 ? "null_unit_asserts_cc" : (c == 1 ? "static_unit_unlinks_room" :
            (c == 2 ? "static_unit_no_room" : "dynamic_unit_resets_path_and_room")),
            args, regs, 4, asserted, 0u, 0u);
    }
}

static void emit_b051_extra(FILE *fp) {
    char args[160];
    uint32_t eax = 0u; (void)eax;
    int asserted = 0;

    /* 0x6FD6EEE0: (a) pItem == 0 -> 0; (b) slot 4 (off 0x10, 2nd belt row) has compatible potion -> still 0 (< 0x10)! */
    for (int c = 0; c < 2; c++) {
        setup_common_tables();
        U32(ARENA_INV0 + 0x00u) = 0x01020304u;
        U32(ARENA_INV0 + 0x14u) = ARENA_GRIDS0;
        U32(ARENA_INV0 + 0x18u) = 2u;
        U8(ARENA_GRIDS0 + 0x10u + 0x08u) = 16u;
        U8(ARENA_GRIDS0 + 0x10u + 0x09u) = 1u;
        U32(ARENA_GRIDS0 + 0x10u + 0x0Cu) = ARENA_CELLS0;
        U32(ARENA_ITEM0 + 0x00u) = 4u; U32(ARENA_ITEM0 + 0x04u) = 3u; /* 'hp1 ' */
        U32(ARENA_ITEM1 + 0x00u) = 4u; U32(ARENA_ITEM1 + 0x04u) = 4u; /* 'hp2 ' */
        U32(ARENA_CELLS0 + 4u * 4u) = ARENA_ITEM1; /* slot 4 = off 0x10 */
        mem_region_t regs[] = {
            {0x6FDEFB94u, 8u}, {0x6FDED390u, 0x18u}, {0x6FDEF068u, 0x40u},
            {ARENA_ITEMSTXT, 7u * 0x1A8u}, {ARENA_INV0, 0x40u},
            {ARENA_GRIDS0, 0x30u}, {ARENA_CELLS0, 0x40u},
            {ARENA_ITEM0, 0x20u}, {ARENA_ITEM1, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
        uint32_t pItm = (c == 0) ? 0u : ARENA_ITEM0;
        eax = safe_stdcall2(0x6FD6EEE0u, ARENA_INV0, pItm, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_INV0, pItm);
        emit_rec(fp, "0x6FD6EEE0", "INVENTORY_CanStackIntoBeltRow113c", 6 + c,
            c == 0 ? "null_item_returns_0" : "slot4_second_row_ignored",
            args, regs, 9, asserted, eax, 0xFFFFFFFFu);
    }

    /* Grid fitters #3..#6 exact boundary vectors:
     * c==0: gw=1, gh=2, w=1, h=1 empty -> fits at (0,0) (kills gw <= 0 -> gw <= 1)
     * c==1: gw=2, gh=2, col 0 occupied, w=1, h=2 -> fits only at x=1 (w+x == gw == 2, kills <= -> <)
     * c==2: gw=2, gh=2, col 0 occupied, w=2, h=1 -> does NOT fit (w+x = 3 > 2, kills + -> -)
     * c==3: gw=2, gh=2, col 1 occupied, w=1, h=1 -> fits only at x=0 (kills x >= 0 -> x >= 1)
     * c==4: gw=3, gh=1, cell (2,0) occupied, w=3, h=1 (odd width!) -> does NOT fit (kills 0xff -> 0xfe) */
    {
        static const uint32_t fit_vas[4] = {0x6FD6F370u, 0x6FD6F410u, 0x6FD6F4E0u, 0x6FD6F580u};
        static const char *fit_names[4] = {
            "INVENTORY_FindFirstFitColMajor113c",
            "INVENTORY_FindBestFitRowMajor113c",
            "INVENTORY_FindFirstFitRightToLeft113c",
            "INVENTORY_FindBestFitReverse113c"
        };
        for (int fi = 0; fi < 4; fi++) {
            for (int c = 0; c < 5; c++) {
                setup_common_tables();
                uint8_t gw = (c == 0) ? 1u : ((c == 4) ? 3u : 2u);
                uint8_t gh = (c == 4) ? 1u : 2u;
                uint32_t w = (c == 2) ? 2u : ((c == 4) ? 3u : 1u);
                uint32_t h = (c == 1) ? 2u : 1u;
                U8(ARENA_GRIDS0 + 0x08u) = gw;
                U8(ARENA_GRIDS0 + 0x09u) = gh;
                U32(ARENA_GRIDS0 + 0x0Cu) = ARENA_CELLS0;
                if (c == 1 || c == 2) {
                    U32(ARENA_CELLS0 + 0u * 4u) = ARENA_ITEM0;
                    U32(ARENA_CELLS0 + 2u * 4u) = ARENA_ITEM0;
                } else if (c == 3) {
                    U32(ARENA_CELLS0 + 1u * 4u) = ARENA_ITEM0;
                    U32(ARENA_CELLS0 + 3u * 4u) = ARENA_ITEM0;
                } else if (c == 4) {
                    U32(ARENA_CELLS0 + 2u * 4u) = ARENA_ITEM0;
                }
                uint32_t exact_cells_len = (uint32_t)gw * (uint32_t)gh * 4u;
                mem_region_t regs[] = {
                    {ARENA_GRIDS0, 0x10u}, {ARENA_CELLS0, exact_cells_len}, {ARENA_OUT, 0x08u}
                };
                capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
                eax = safe_grid_fit(fit_vas[fi], h, ARENA_GRIDS0, ARENA_OUT, ARENA_OUT + 4u, w, &asserted);
                snprintf(args, sizeof(args), "%u,\"0x%08X\",\"0x%08X\",\"0x%08X\",%u",
                    h, ARENA_GRIDS0, ARENA_OUT, ARENA_OUT + 4u, w);
                emit_rec(fp, fi == 0 ? "0x6FD6F370" : (fi == 1 ? "0x6FD6F410" : (fi == 2 ? "0x6FD6F4E0" : "0x6FD6F580")),
                    fit_names[fi], 5 + c,
                    c == 0 ? "gw_eq_1_fits" : (c == 1 ? "right_edge_exact_fit" :
                    (c == 2 ? "right_edge_2w_overflow" : (c == 3 ? "left_col0_only_fit" : "odd_width_3_blocked"))),
                    args, regs, 3, asserted, eax, 0xFFFFFFFFu);
            }
        }
    }

    /* 0x6FD6FB50: pass code1=0xFF when 0x6FDF13A0=0xFF -> idx < 0xFF stops at 254 (returns 0)! */
    {
        setup_common_tables();
        U32(0x6FDF1488u) = 1u;
        U32(0x6FDF13A0u) = 0xFFu;
        memset((void *)(uintptr_t)0x6FDF0BA8u, 0, 255u * 8u);
        mem_region_t regs[] = {
            {0x6FDF0BA8u, 255u * 8u}, {0x6FDF13A0u, 4u}, {0x6FDF1488u, 4u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
        eax = safe_6FD6FB50(0x6FD6FB50u, 0xFFu, 0xFEu, &asserted);
        snprintf(args, sizeof(args), "\"0x000000FF\",\"0x000000FE\"");
        emit_rec(fp, "0x6FD6FB50", "INVENTORY_FindItemGfxCodeIndex113c", 4,
            "stops_before_slot_255_count_dword", args, regs, 3, asserted, eax, 0xFFFFFFFFu);
    }

    /* 0x6FD6FE10: (a) pFirstItem has pUnitData==0, pAfter=pFirstItem -> pAfterExtra==0 returns 0;
     * (b) pFirstItem is shield with pUnitData==0, pAfter=0 -> pExtra==0 returns 0 */
    for (int c = 0; c < 2; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = 1u;
        U32(ARENA_INV0 + 0x00u) = 0x01020304u;
        U32(ARENA_INV0 + 0x08u) = ARENA_UNIT0;
        U32(ARENA_INV0 + 0x14u) = ARENA_GRIDS0;
        U32(ARENA_INV0 + 0x18u) = 3u;
        U32(ARENA_GRIDS0 + 0x20u + 0x00u) = ARENA_ITEM0;
        U32(ARENA_GRIDS0 + 0x20u + 0x0Cu) = ARENA_CELLS0;
        U32(ARENA_ITEM0 + 0x00u) = 4u;
        U32(ARENA_ITEM0 + 0x04u) = 2u; /* shield (not 0x2D) */
        U32(ARENA_ITEM0 + 0x14u) = 0u; /* null pItemData -> pExtra == 0! */
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDEFB94u, 8u}, {0x6FDD9088u, 0xACu},
            {ARENA_SGPT, 0xC10u}, {ARENA_ITEMSTXT, 3u * 0x1A8u}, {ARENA_ITYPEMAT, 0x200u},
            {ARENA_UNIT0, 0x20u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x30u}, {ARENA_ITEM0, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 10);
        uint32_t pAfter = (c == 0) ? ARENA_ITEM0 : 0u;
        eax = safe_stdcall3(0x6FD6FE10u, ARENA_INV0, 0x2Du, pAfter, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",45,\"0x%08X\"", ARENA_INV0, pAfter);
        emit_rec(fp, "0x6FD6FE10", "INVENTORY_FindBackpackItemByType113c", 5 + c,
            c == 0 ? "after_item_null_itemdata_returns_0" : "scan_item_null_itemdata_returns_0",
            args, regs, 10, asserted, eax, 0xFFFFFFFFu);
    }

    /* 0x6FD71640: (a) pOwner != 0 unlinks item statlist from owner; (b) pOwner == 0; (c) nodePos=3 (gridIdx=2 == nGridCount=2) skips grid! */
    for (int c = 0; c < 2; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = 0u;
        U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
        U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
        U32(ARENA_STATLIST1 + 0x34u) = ARENA_STATLIST0;

        U32(ARENA_INV0 + 0x00u) = 0x01020304u;
        U32(ARENA_INV0 + 0x08u) = (c == 0) ? ARENA_UNIT0 : 0u;
        U32(ARENA_INV0 + 0x14u) = ARENA_GRIDS0;
        U32(ARENA_INV0 + 0x18u) = 2u; /* nGridCount = 2 */
        U32(ARENA_INV0 + 0x20u) = ARENA_ITEM0;

        U32(ARENA_ITEM0 + 0x00u) = 4u;
        U32(ARENA_ITEM0 + 0x0Cu) = 12u;
        U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
        U32(ARENA_ITEM0 + 0x5Cu) = ARENA_STATLIST1;
        U32(ARENA_ITEMDATA0 + 0x5Cu + 0x00u) = ARENA_INV0;
        U8(ARENA_ITEMDATA0 + 0x5Cu + 0x0Cu) = 3u; /* gridIdx = 2 == nGridCount -> must NOT read ARENA_GRIDS0 + 0x20! */

        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u},
            {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x20u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 10);
        eax = safe_eax1(0x6FD71640u, ARENA_ITEM0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_ITEM0);
        emit_rec(fp, "0x6FD71640", "INVENTORY_RemoveItemInternal113c", 4 + c,
            c == 0 ? "unlinks_item_statlist_and_skips_eq_gridcount" : "null_owner_keeps_statlist_linked",
            args, regs, 10, asserted, eax, 0xFFFFFFFFu);
    }

    /* 0x6FD7F100: startIdx == currIdx (prevFp8=0x0100, currFp8=0x0200 -> startIdx=2==currIdx=2) picks event at idx 2 */
    {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x30u) = ARENA_ANIMSEQ;
        U32(ARENA_UNIT0 + 0x38u) = 0x0200u;
        U32(ARENA_UNIT0 + 0x40u) = 5u;
        U8(ARENA_ANIMSEQ + 2u * 6u + 2u) = 5u;
        U8(ARENA_ANIMSEQ + 2u * 6u + 3u) = 12u;
        U8(ARENA_ANIMSEQ + 2u * 6u + 5u) = 9u;
        mem_region_t regs[] = { {ARENA_UNIT0, 0x60u}, {ARENA_ANIMSEQ, 0x30u} };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 2);
        eax = safe_6FD7F100(0x6FD7F100u, ARENA_UNIT0, 0x0100u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",256", ARENA_UNIT0);
        emit_rec(fp, "0x6FD7F100", "UNITS_StepAnimSeqFrame113c", 4,
            "startIdx_eq_currIdx_captures_event", args, regs, 2, asserted, eax, 0xFFFFFFFFu);
    }

    /* 0x6FD80B80: uType == 2 (object) -> returns 0 */
    {
        setup_common_tables();
        mem_region_t regs[] = { {ARENA_UNIT0, 0x20u} };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 1);
        eax = safe_6FD80B80(0x6FD80B80u, 2u, 7u, 0u, &asserted);
        snprintf(args, sizeof(args), "2,7,\"0x00000000\"");
        emit_rec(fp, "0x6FD80B80", "UNITS_IsCastAnimMode113c", 6,
            "object_utype2_returns_0", args, regs, 1, asserted, eax, 0xFFFFFFFFu);
    }
}

static void emit_b048_extra(FILE *fp) {
    char args[160];
    uint32_t eax = 0u; (void)eax;
    int asserted = 0;

    /* 0x6FD62450: match at index 2 (ppRoomsNear + 8, kills i*4 -> i+4) */
    {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = 0u; U32(ARENA_UNIT0 + 0x2Cu) = ARENA_PATH0; U32(ARENA_PATH0 + 0x1Cu) = ARENA_ROOM0;
        U32(ARENA_UNIT1 + 0x00u) = 0u; U32(ARENA_UNIT1 + 0x2Cu) = ARENA_PATH1; U32(ARENA_PATH1 + 0x1Cu) = ARENA_ROOM1;
        U32(ARENA_ROOM1 + 0x00u) = ARENA_ROOMSNEAR;
        U32(ARENA_ROOM1 + 0x24u) = 3u;
        U32(ARENA_ROOMSNEAR + 0u) = 0x11111111u;
        U32(ARENA_ROOMSNEAR + 4u) = 0x22222222u;
        U32(ARENA_ROOMSNEAR + 8u) = ARENA_ROOM0;
        mem_region_t regs[] = {
            {ARENA_UNIT0, 0x40u}, {ARENA_UNIT1, 0x40u},
            {ARENA_PATH0, 0x40u}, {ARENA_PATH1, 0x40u},
            {ARENA_ROOM0, 0x80u}, {ARENA_ROOM1, 0x80u}, {ARENA_ROOMSNEAR, 0x10u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 7);
        eax = safe_stdcall2(0x6FD62450u, ARENA_UNIT0, ARENA_UNIT1, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_UNIT0, ARENA_UNIT1);
        emit_rec(fp, "0x6FD62450", "UNITS_AreInAdjacentRooms113c", 5,
            "adjacent_at_index_2", args, regs, 7, asserted, eax, 0xFFFFFFFFu);
    }

    /* 0x6FD6E4F0: pFirst (+0x2C) == 0 while pLast (+0x30) == 0xDEAD -> tests +0x2C directly! */
    {
        setup_common_tables();
        U32(ARENA_INV0 + 0x00u) = 0x01020304u;
        U32(ARENA_INV0 + 0x2Cu) = 0u;
        U32(ARENA_INV0 + 0x30u) = 0xDEADu;
        U32(ARENA_ITEM0 + 0x00u) = 4u;
        U32(ARENA_ITEM0 + 0x0Cu) = 0x3344u;
        mem_region_t regs[] = { {ARENA_INV0, 0x40u}, {ARENA_ITEM0, 0x20u} };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 2);
        eax = safe_stdcall2(0x6FD6E4F0u, ARENA_INV0, ARENA_ITEM0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_INV0, ARENA_ITEM0);
        emit_rec(fp, "0x6FD6E4F0", "INVENTORY_AppendItemGuidNode113c", 5,
            "null_first_with_stale_last_resets_both", args, regs, 2, asserted, 0u, 0u);
    }

    /* 0x6FD80BD0: dwClassId == 0x199 vs 0x19A (410) boundary against untouched real .rdata (mode 16 -> 0 vs 1)! */
    for (int c = 0; c < 2; c++) {
        setup_common_tables();
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDDC5F8u, 0x430u},
            {ARENA_SGPT, 0xBA8u}, {ARENA_UNIT0, 0xC0u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 5);
        uint32_t clsId = (c == 0) ? 0x199u : 0x19Au;
        eax = safe_6FD80BD0(0x6FD80BD0u, 1u, 16u, ARENA_UNIT0, clsId, &asserted);
        snprintf(args, sizeof(args), "1,16,\"0x%08X\",%u", ARENA_UNIT0, clsId);
        emit_rec(fp, "0x6FD80BD0", "UNITS_IsAttackAnimMode113c", 6 + c,
            c == 0 ? "cls_0x199_uses_low_table" : "cls_0x19A_uses_high_table",
            args, regs, 5, asserted, eax, 0xFFFFFFFFu);
    }

    /* 0x6FD813F0: monster dwAnimMode == 15 (idx == 0x0D) -> moving (returns 1), dwAnimMode == 16 (idx == 0x0E) -> 0 */
    for (int c = 0; c < 2; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = 1u;
        U32(ARENA_UNIT0 + 0x10u) = (c == 0) ? 15u : 16u;
        mem_region_t regs[] = { {ARENA_UNIT0, 0x40u} };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 1);
        eax = safe_stdcall1(0x6FD813F0u, ARENA_UNIT0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
        emit_rec(fp, "0x6FD813F0", "UNITS_IsInMovingMode113c", 7 + c,
            c == 0 ? "mon_mode15_idx_0d_moving" : "mon_mode16_idx_0e_not_moving",
            args, regs, 1, asserted, eax, 0xFFFFFFFFu);
    }

    /* 0x6FD83990: pStatListEx with dwFlags == 0 and pPrevLink != 0 -> NOT freed (ARENA_STATLIST1 untouched!) */
    {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = 0u;
        U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10u) = 0u; /* non-negative -> must NOT call FreeStatListImpl! */
        U32(ARENA_STATLIST0 + 0x2Cu) = ARENA_STATLIST1;
        U32(ARENA_STATLIST1 + 0x30u) = ARENA_STATLIST0;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {ARENA_UNIT0, 0xF0u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 6);
        eax = safe_stdcall1(0x6FD83990u, ARENA_UNIT0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
        emit_rec(fp, "0x6FD83990", "UNITS_FreeUnit113c", 4,
            "zero_flags_statlist_not_freed", args, regs, 6, asserted, 0u, 0u);
    }

    /* 0x6FD97020: pTarget->pStatListEx has dwFlags == 0 (not extended!) -> allocates new statlist instead of searching */
    {
        setup_common_tables();
        U32(ARENA_ITEM0 + 0x00u) = 4u;
        U32(ARENA_ITEM0 + 0x0Cu) = 0x8899u;
        U32(ARENA_ITEM0 + 0x5Cu) = ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10u) = 0u; /* dwFlags == 0 >= 0 */
        U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
        U32(ARENA_STATLIST1 + 0x10u) = 0x40u;
        U32(ARENA_STATLIST1 + 0x14u) = 7u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {ARENA_ITEM0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 6);
        eax = safe_6FD97020(0x6FD97020u, ARENA_ITEM0, 0u, 7u, 0x40u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x00000000\",7,64", ARENA_ITEM0);
        emit_rec(fp, "0x6FD97020", "ITEMMODS_GetOrCreateStatList113c", 4,
            "non_extended_statlist_allocates_new", args, regs, 6, asserted, eax, 0xFFFFFFFFu);
    }

    /* 0x6FDB6630: exact x == roomX && y == roomY boundary, with ARENA_ROOM0 sized to 0x78u (kills 8 -> 12 loop!) */
    {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = 0u;
        U32(ARENA_UNIT0 + 0x2Cu) = ARENA_PATH0;
        U16(ARENA_PATH0 + 0x02u) = 10u; /* x == roomX */
        U16(ARENA_PATH0 + 0x06u) = 20u; /* y == roomY */
        U32(ARENA_ROOM0 + 0x4Cu) = 10u;
        U32(ARENA_ROOM0 + 0x50u) = 20u;
        U32(ARENA_ROOM0 + 0x54u) = 30u;
        U32(ARENA_ROOM0 + 0x58u) = 30u;
        mem_region_t regs[] = {
            {ARENA_UNIT0, 0xF0u}, {ARENA_PATH0, 0x40u}, {ARENA_ROOM0, 0x78u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
        eax = safe_6FDB6630(0x6FDB6630u, ARENA_ROOM0, ARENA_UNIT0, 0u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",0", ARENA_ROOM0, ARENA_UNIT0);
        emit_rec(fp, "0x6FDB6630", "UNITROOM_ValidateUnitInRoom113c", 6,
            "exact_origin_x_eq_roomX_and_strict_0x78_room_span", args, regs, 3, asserted, eax, 0xFFFFFFFFu);
    }

    /* 0x6FDB68A0: uType == 3 (missile -> dynamic path reset, NOT static!) */
    {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = 3u;
        U32(ARENA_UNIT0 + 0x2Cu) = ARENA_PATH0;
        U32(ARENA_PATH0 + 0x1Cu) = ARENA_ROOM0;
        U32(ARENA_PATH0 + 0x30u) = ARENA_UNIT0;
        U32(ARENA_ROOM0 + 0x74u) = ARENA_UNIT0;
        mem_region_t regs[] = {
            {0x6FDDD458u, 8u}, {ARENA_UNIT0, 0xF0u}, {ARENA_PATH0, 0x40u}, {ARENA_ROOM0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 4);
        eax = safe_stdcall1(0x6FDB68A0u, ARENA_UNIT0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
        emit_rec(fp, "0x6FDB68A0", "UNITROOM_ClearUnitRoom113c", 4,
            "missile_utype3_uses_dynamic_path_reset", args, regs, 4, asserted, 0u, 0u);
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
    }

    g_orig_iat_assert  = U32(0x6FDD90D4u);
    g_orig_iat_alloc   = U32(0x6FDD90D0u);
    g_orig_iat_free    = U32(0x6FDD90CCu);
    g_orig_iat_realloc = U32(0x6FDD90ACu);

    const char *b051_path = (argc > 1) ? argv[1] : "b051-vectors.ndjson";
    const char *b048_path = (argc > 2) ? argv[2] : "b048-vectors.ndjson";

    FILE *fp51 = fopen(b051_path, "wb");
    if (!fp51) return 1;
    emit_b051_inv_part1(fp51);
    emit_b051_unit_part2(fp51);
    emit_b051_extra(fp51);
    fclose(fp51);

    FILE *fp48 = fopen(b048_path, "wb");
    if (!fp48) return 1;
    emit_b048_all(fp48);
    emit_b048_extra(fp48);
    fclose(fp48);

    TerminateProcess(GetCurrentProcess(), 0);
    return 0;
}
