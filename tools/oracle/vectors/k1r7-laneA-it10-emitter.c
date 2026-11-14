/*
 * k1r7-laneA-it10-emitter.c
 *
 * Real-DLL Wine differential vector emitter for Iteration 10 Lane A:
 *   - I10A-1 (20 diff-verified functions -> i10a-1-vectors.ndjson)
 *   - I10A-2 (19 diff-verified functions -> i10a-2-vectors.ndjson)
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
#define CB_BASE           0x03600000u
#define CB_SIZE           0x00001000u
#define CB_NOTIFY_ADDR    0x03600000u
#define CB_SETSTAT_ADDR   0x03600100u
#define HEAP_BASE         0x40000000u
#define HEAP_SIZE         0x00100000u

#define ARENA_SGPT        (ARENA_BASE + 0x0000u)
#define ARENA_UNIT0       (ARENA_BASE + 0x1000u)
#define ARENA_UNIT1       (ARENA_BASE + 0x1200u)
#define ARENA_ITEM0       (ARENA_BASE + 0x1600u)
#define ARENA_ITEM1       (ARENA_BASE + 0x1800u)
#define ARENA_ITEMDATA0   (ARENA_BASE + 0x1C00u)
#define ARENA_ITEMDATA1   (ARENA_BASE + 0x1E00u)
#define ARENA_INV0        (ARENA_BASE + 0x2200u)
#define ARENA_GRIDS0      (ARENA_BASE + 0x2600u)
#define ARENA_CELLS0      (ARENA_BASE + 0x2A00u)
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
#define ARENA_PLRDATA0    (ARENA_BASE + 0x4600u)
#define ARENA_SKILLLIST   (ARENA_BASE + 0x4800u)
#define ARENA_SKILL0      (ARENA_BASE + 0x4900u)
#define ARENA_OBJDATA0    (ARENA_BASE + 0x4B00u)
#define ARENA_OBJTXT0     (ARENA_BASE + 0x4C00u)
#define ARENA_MONDATA0    (ARENA_BASE + 0x4E00u)
#define ARENA_OUT         (ARENA_BASE + 0x5C00u)
#define ARENA_STATEFLAGS0 (ARENA_BASE + 0x5E00u)
#define ARENA_STATEMASKS  (ARENA_BASE + 0x6000u)
#define ARENA_XFORMSTATES (ARENA_BASE + 0x6200u)
#define ARENA_ITYPEMAT    (ARENA_BASE + 0x6400u)
#define ARENA_LEVEL0      (ARENA_BASE + 0x6800u)
#define ARENA_DRLG0       (ARENA_BASE + 0x6B00u)
#define ARENA_OUTDOORS0   (ARENA_BASE + 0x7000u)
#define ARENA_GRIDCELLS04 (ARENA_BASE + 0x7100u)
#define ARENA_GRIDROWS04  (ARENA_BASE + 0x7300u)
#define ARENA_GRIDCELLS2C (ARENA_BASE + 0x7400u)
#define ARENA_GRIDROWS2C  (ARENA_BASE + 0x7600u)
#define ARENA_JUNGDEFS0   (ARENA_BASE + 0x7700u)
#define ARENA_PRESTNODE0  (ARENA_BASE + 0x7800u)
#define ARENA_STATESTXT   (ARENA_BASE + 0xB000u)
#define ARENA_ISC         (ARENA_BASE + 0x10000u)
#define ARENA_ITEMSTXT    (ARENA_BASE + 0x30000u)
#define ARENA_MONSTATS    (ARENA_BASE + 0x40000u)
#define ARENA_MONSTATS2   (ARENA_BASE + 0x50000u)
#define ARENA_SKILLSTXT   (ARENA_BASE + 0x60000u)
#define ARENA_MISSTXT     (ARENA_BASE + 0x70000u)
#define ARENA_LEVELDEF    (ARENA_BASE + 0x80000u)
#define ARENA_LVLPREST    (ARENA_BASE + 0x88000u)

#define U32(addr) (*(volatile uint32_t *)((uintptr_t)(addr)))
#define U16(addr) (*(volatile uint16_t *)((uintptr_t)(addr)))
#define U8(addr)  (*(volatile uint8_t  *)((uintptr_t)(addr)))
#define S32(addr) (*(volatile int32_t  *)((uintptr_t)(addr)))
#define S16(addr) (*(volatile int16_t  *)((uintptr_t)(addr)))

static uint8_t *g_arena = NULL;
static uint8_t *g_cb_page = NULL;
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

static void init_cb_trampolines(void) {
    /* CB_NOTIFY_ADDR (0x03600000): __fastcall(ecx=pUnit, edx=nStatId, [esp+4]=nVal, [esp+8]=pArg), ret 8 */
    static const uint8_t k_notify_tramp[] = {
        0x8B, 0x44, 0x24, 0x08,                         /* mov eax, [esp+8] (pArg) */
        0x89, 0x08,                                     /* mov [eax+0], ecx (pUnit) */
        0x89, 0x50, 0x04,                               /* mov [eax+4], edx (nStatId) */
        0x8B, 0x4C, 0x24, 0x04,                         /* mov ecx, [esp+4] (nVal) */
        0x89, 0x48, 0x08,                               /* mov [eax+8], ecx */
        0xC7, 0x40, 0x0C, 0x01, 0x00, 0xFE, 0xCA,       /* mov dword [eax+12], 0xCAFE0001 */
        0xC2, 0x08, 0x00                                /* ret 8 */
    };
    /* CB_SETSTAT_ADDR (0x03600100): __fastcall(ecx=pGame, edx=pOwner, [esp+4]=pUnit, [esp+8]=dwKey, [esp+12]=oldVal, [esp+16]=newVal), ret 16 */
    static const uint8_t k_setstat_tramp[] = {
        0xB8, 0x00, 0x5C, 0x50, 0x03,                   /* mov eax, 0x03505C00 (ARENA_OUT) */
        0x89, 0x08,                                     /* mov [eax+0], ecx (pGame) */
        0x89, 0x50, 0x04,                               /* mov [eax+4], edx (pOwner) */
        0x8B, 0x4C, 0x24, 0x04, 0x89, 0x48, 0x08,       /* mov ecx, [esp+4]; mov [eax+8], ecx (pUnit) */
        0x8B, 0x4C, 0x24, 0x08, 0x89, 0x48, 0x0C,       /* mov ecx, [esp+8]; mov [eax+12], ecx (dwKey) */
        0x8B, 0x4C, 0x24, 0x0C, 0x89, 0x48, 0x10,       /* mov ecx, [esp+12]; mov [eax+16], ecx (oldVal) */
        0x8B, 0x4C, 0x24, 0x10, 0x89, 0x48, 0x14,       /* mov ecx, [esp+16]; mov [eax+20], ecx (newVal) */
        0xC2, 0x10, 0x00                                /* ret 16 */
    };
    memset(g_cb_page, 0xCC, CB_SIZE);
    memcpy((void *)(uintptr_t)CB_NOTIFY_ADDR, k_notify_tramp, sizeof(k_notify_tramp));
    memcpy((void *)(uintptr_t)CB_SETSTAT_ADDR, k_setstat_tramp, sizeof(k_setstat_tramp));
}

typedef uint32_t (__stdcall *stdcall1_t)(uint32_t);
typedef uint32_t (__stdcall *stdcall2_t)(uint32_t, uint32_t);
typedef uint32_t (__stdcall *stdcall3_t)(uint32_t, uint32_t, uint32_t);
typedef uint32_t (__stdcall *stdcall4_t)(uint32_t, uint32_t, uint32_t, uint32_t);
typedef uint32_t (__stdcall *stdcall5_t)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);

/* #04 0x6FD82CA0: edi=pUnit, [esp+4]=nSrcType, [esp+8]=nSrcId -> ret 8 */
static __attribute__((noinline)) uint32_t call_6FD82CA0(
    uint32_t fn, uint32_t pUnit, uint32_t nSrcType, uint32_t nSrcId) {
    uint32_t io_eax = nSrcType, io_edx = nSrcId, io_esi = fn, io_edi = pUnit;
    __asm__ volatile (
        "pushl %%edx\n\t"
        "pushl %%eax\n\t"
        "call *%%esi\n\t"
        : "+a"(io_eax), "+d"(io_edx), "+S"(io_esi), "+D"(io_edi)
        :
        : "ecx", "cc", "memory"
    );
    return io_eax;
}

/* #12 0x6FD88940: ebx=pListEx, [esp+4]=dwKey, [esp+8]=nVal, [esp+0xC]=pIscRec, [esp+0x10]=pUnit -> ret 0x10 */
static __attribute__((noinline)) uint32_t call_6FD88940(
    uint32_t fn, uint32_t pListEx, uint32_t dwKey, uint32_t nVal, uint32_t pIscRec, uint32_t pUnit) {
    uint32_t io_eax = dwKey, io_ebx = pListEx, io_ecx = nVal, io_edx = pIscRec, io_esi = pUnit, io_edi = fn;
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

/* #13 0x6FD88BD0: ecx=pStatList, eax=nStatId, [esp+4]=nLayer -> ret 4 */
static __attribute__((noinline)) uint32_t call_6FD88BD0(
    uint32_t fn, uint32_t pStatList, uint32_t nStatId, uint32_t nLayer) {
    uint32_t io_eax = nStatId, io_ecx = pStatList, io_edx = nLayer, io_esi = fn;
    __asm__ volatile (
        "pushl %%edx\n\t"
        "call *%%esi\n\t"
        : "+a"(io_eax), "+c"(io_ecx), "+d"(io_edx), "+S"(io_esi)
        :
        : "cc", "memory"
    );
    return io_eax;
}

/* #20 0x6FDD54C0: esi=pLevel -> ret */
static __attribute__((noinline)) uint32_t call_6FDD54C0(uint32_t fn, uint32_t pLevel) {
    uint32_t io_eax = fn, io_esi = pLevel;
    __asm__ volatile (
        "call *%%eax\n\t"
        : "+a"(io_eax), "+S"(io_esi)
        :
        : "ecx", "edx", "cc", "memory"
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
static __attribute__((noinline)) uint32_t safe_stdcall5(
    uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3, uint32_t a4, int *pAsserted) {
    SAFE_BODY(((stdcall5_t)(uintptr_t)va)(a0, a1, a2, a3, a4));
}
static __attribute__((noinline)) uint32_t safe_6FD82CA0(
    uint32_t va, uint32_t pUnit, uint32_t nSrcType, uint32_t nSrcId, int *pAsserted) {
    SAFE_BODY(call_6FD82CA0(va, pUnit, nSrcType, nSrcId));
}
static __attribute__((noinline)) uint32_t safe_6FD88940(
    uint32_t va, uint32_t pListEx, uint32_t dwKey, uint32_t nVal, uint32_t pIscRec, uint32_t pUnit, int *pAsserted) {
    SAFE_BODY(call_6FD88940(va, pListEx, dwKey, nVal, pIscRec, pUnit));
}
static __attribute__((noinline)) uint32_t safe_6FD88BD0(
    uint32_t va, uint32_t pStatList, uint32_t nStatId, uint32_t nLayer, int *pAsserted) {
    SAFE_BODY(call_6FD88BD0(va, pStatList, nStatId, nLayer));
}
static __attribute__((noinline)) uint32_t safe_6FDD54C0(
    uint32_t va, uint32_t pLevel, int *pAsserted) {
    SAFE_BODY(call_6FDD54C0(va, pLevel));
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
    for (uint32_t m = 0; m < 40u; m++) {
        U32(ARENA_SGPT + 0x0CCu + m * 4u) = ARENA_STATEMASKS + m * 24u;
    }
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
    U32(ARENA_SGPT + 0xBC0u) = 300u; /* nSkillsTxtRecordCount */
    U32(ARENA_SGPT + 0xBCCu) = ARENA_ISC;
    U32(ARENA_SGPT + 0xBD4u) = 359u;
    U32(ARENA_SGPT + 0xBFCu) = 64u;
    U32(ARENA_SGPT + 0xC00u) = 2u;
    U32(ARENA_SGPT + 0xC04u) = ARENA_ITYPEMAT;
    U32(ARENA_SGPT + 0xC5Cu) = 100u; /* nLevelsTxtRecordCount */
    U32(ARENA_SGPT + 0xC68u) = 605u; /* nLvlPrestTxtRecordCount */

    U32(0x6FDEFB94u) = 10u;
    U32(0x6FDEFB98u) = ARENA_ITEMSTXT;
    U32(0x6FDF0B38u) = ARENA_LEVELDEF;
    U32(0x6FDF0B3Cu) = ARENA_LVLPREST;

    U32(0x6FDEF020u) = 3u;
    U32(0x6FDEF028u + 0u * 8u + 0u) = 0x20687468u; U16(0x6FDEF028u + 0u * 8u + 4u) = 0u; /* 'hth ' -> 0 */
    U32(0x6FDEF028u + 1u * 8u + 0u) = 0x20736831u; U16(0x6FDEF028u + 1u * 8u + 4u) = 2u; /* '1hs ' -> 2 */
    U32(0x6FDEF028u + 2u * 8u + 0u) = 0x20736832u; U16(0x6FDEF028u + 2u * 8u + 4u) = 1u; /* '2hs ' -> 1 */

    /* Item 0: 1H sword ('1hs ', type 0x1E -> weapon 0x2D), Item 1: 2H sword ('2hs ', b2Handed=1),
     * Item 2: Barbarian 1-or-2H sword ('2hs ', b2Handed=1, b1or2Handed=1), Item 3: shield (type 0x33) */
    U32(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x80u) = 0x20736831u;
    U32(ARENA_ITEMSTXT + 0u * 0x1A8u + 0xC0u) = 0x20736831u; /* '1hs ' -> wclass 2 */
    U16(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x11Eu) = 0x1Eu;
    U8(ARENA_ITEMSTXT  + 0u * 0x1A8u + 0x11Cu) = 0u;
    U8(ARENA_ITEMSTXT  + 0u * 0x1A8u + 0x13Du) = 0u;

    U32(ARENA_ITEMSTXT + 1u * 0x1A8u + 0x80u) = 0x20736832u;
    U32(ARENA_ITEMSTXT + 1u * 0x1A8u + 0xC0u) = 0x20736832u; /* '2hs ' -> wclass 1 */
    U16(ARENA_ITEMSTXT + 1u * 0x1A8u + 0x11Eu) = 0x1Eu;
    U8(ARENA_ITEMSTXT  + 1u * 0x1A8u + 0x11Cu) = 1u; /* b2Handed = 1 */
    U8(ARENA_ITEMSTXT  + 1u * 0x1A8u + 0x13Du) = 0u;

    U32(ARENA_ITEMSTXT + 2u * 0x1A8u + 0x80u) = 0x20736832u;
    U32(ARENA_ITEMSTXT + 2u * 0x1A8u + 0xC0u) = 0x20736832u;
    U16(ARENA_ITEMSTXT + 2u * 0x1A8u + 0x11Eu) = 0x1Eu;
    U8(ARENA_ITEMSTXT  + 2u * 0x1A8u + 0x11Cu) = 1u; /* b2Handed = 1 */
    U8(ARENA_ITEMSTXT  + 2u * 0x1A8u + 0x13Du) = 1u; /* b1or2Handed = 1 */

    U32(ARENA_ITEMSTXT + 3u * 0x1A8u + 0x80u) = 0x20637562u;
    U16(ARENA_ITEMSTXT + 3u * 0x1A8u + 0x11Eu) = 0x33u; /* shield (not weapon) */

    /* Type 0x1E is equiv to weapon (0x2D -> bit 45 = word 1 bit 13) */
    U32(ARENA_ITYPEMAT + 0x1Eu * 8u + 0u) = (1u << 30);
    U32(ARENA_ITYPEMAT + 0x1Eu * 8u + 4u) = (1u << 13);
}

static void setup_unit_with_stat(uint32_t uType, uint32_t statId, int32_t val, int isEx) {
    setup_common_tables();
    U32(ARENA_UNIT0 + 0x00u) = uType;
    U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
    U32(ARENA_STATLIST0 + 0x10u) = isEx ? 0x80000000u : 0u;
    uint32_t hdr = isEx ? (ARENA_STATLIST0 + 0x48u) : (ARENA_STATLIST0 + 0x24u);
    U32(hdr + 0x00u) = ARENA_STATS0;
    U16(hdr + 0x04u) = 1u;
    U16(hdr + 0x06u) = 4u;
    U32(ARENA_STATS0 + 0x00u) = (statId << 16);
    S32(ARENA_STATS0 + 0x04u) = val;
}

static void emit_i10a_1(FILE *fp) {
    int asserted = 0;
    uint32_t eax = 0u;
    char args[256];

    /* =========================================================================
     * #01 0x6FD7CC60 STATLIST_GetUnitHirelingResurrectCost113c
     * ========================================================================= */
    {
        setup_common_tables();
        mem_region_t regs[] = { {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u} };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
        eax = safe_stdcall1(0x6FD7CC60u, 0u, &asserted);
        emit_rec(fp, "0x6FD7CC60", "STATLIST_GetUnitHirelingResurrectCost113c", 0,
            "null_unit_zero", "\"0x00000000\"", regs, 3, asserted, eax, 0xFFFFFFFFu);
    }
    {
        /* pList == 0 -> lvl=0 -> 0 */
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x5Cu) = 0u;
        mem_region_t regs[] = { {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u}, {ARENA_UNIT0, 0x80u} };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 4);
        eax = safe_stdcall1(0x6FD7CC60u, ARENA_UNIT0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
        emit_rec(fp, "0x6FD7CC60", "STATLIST_GetUnitHirelingResurrectCost113c", 1,
            "null_statlist_zero", args, regs, 4, asserted, eax, 0xFFFFFFFFu);
    }
    {
        /* nItemStatCostTxtRecordCount == 12 (boundary <= 0x0C) -> lvl=0 -> 0 */
        setup_unit_with_stat(0u, 0x0Cu, 10, 0);
        U32(ARENA_SGPT + 0xBD4u) = 12u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u},
            {ARENA_ISC, 0x1100u}, {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 7);
        eax = safe_stdcall1(0x6FD7CC60u, ARENA_UNIT0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
        emit_rec(fp, "0x6FD7CC60", "STATLIST_GetUnitHirelingResurrectCost113c", 2,
            "isc_count_12_boundary", args, regs, 7, asserted, eax, 0xFFFFFFFFu);
    }
    {
        const int32_t lvls[4] = { 10, 81, 82, 70000 };
        const char *notes[4] = { "lvl_10_even_750", "lvl_81_odd_sq_49200", "lvl_82_capped_50000", "lvl_70000_unsigned_overflow_cap" };
        for (int i = 0; i < 4; i++) {
            setup_unit_with_stat(0u, 0x0Cu, lvls[i], 1);
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u},
                {ARENA_ISC, 0x1100u}, {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x40u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 7);
            eax = safe_stdcall1(0x6FD7CC60u, ARENA_UNIT0, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
            emit_rec(fp, "0x6FD7CC60", "STATLIST_GetUnitHirelingResurrectCost113c", 3 + i,
                notes[i], args, regs, 7, asserted, eax, 0xFFFFFFFFu);
        }
    }

    /* =========================================================================
     * #02 0x6FD81940 STATLIST_GetUnitGoldBankLimit113c
     * ========================================================================= */
    {
        setup_common_tables();
        mem_region_t regs[] = { {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u} };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
        eax = safe_stdcall1(0x6FD81940u, 0u, &asserted);
        emit_rec(fp, "0x6FD81940", "STATLIST_GetUnitGoldBankLimit113c", 0,
            "null_unit_zero", "\"0x00000000\"", regs, 3, asserted, eax, 0xFFFFFFFFu);
    }
    {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x5Cu) = 0u;
        mem_region_t regs[] = { {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u}, {ARENA_UNIT0, 0x80u} };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 4);
        eax = safe_stdcall1(0x6FD81940u, ARENA_UNIT0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
        emit_rec(fp, "0x6FD81940", "STATLIST_GetUnitGoldBankLimit113c", 1,
            "null_statlist_zero", args, regs, 4, asserted, eax, 0xFFFFFFFFu);
    }
    {
        setup_unit_with_stat(0u, 0x0Cu, 25, 0);
        U32(ARENA_SGPT + 0xBD4u) = 12u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u},
            {ARENA_ISC, 0x1100u}, {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 7);
        eax = safe_stdcall1(0x6FD81940u, ARENA_UNIT0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
        emit_rec(fp, "0x6FD81940", "STATLIST_GetUnitGoldBankLimit113c", 2,
            "isc_count_12_boundary", args, regs, 7, asserted, eax, 0xFFFFFFFFu);
    }
    {
        /* lvl=25 -> 250000; lvl=1 with fMin=15 -> 150000 */
        for (int c = 0; c < 2; c++) {
            setup_unit_with_stat(0u, 0x0Cu, c == 0 ? 25 : 1, 1);
            if (c == 1) {
                U8(ARENA_ISC + 0xF30u + 0x04u) = 0x02u; /* fMin active */
                S32(ARENA_ISC + 0xF30u + 0x10u) = 15;   /* dwMinAccr = 15 */
            }
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u},
                {ARENA_ISC, 0x1100u}, {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x40u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 7);
            eax = safe_stdcall1(0x6FD81940u, ARENA_UNIT0, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
            emit_rec(fp, "0x6FD81940", "STATLIST_GetUnitGoldBankLimit113c", 3 + c,
                c == 0 ? "lvl_25_250000" : "lvl_1_clamped_by_fmin_15",
                args, regs, 7, asserted, eax, 0xFFFFFFFFu);
        }
    }

    /* =========================================================================
     * #03 0x6FD82330 STATLIST_GetUnitLifePercent113c
     * ========================================================================= */
    {
        setup_common_tables();
        mem_region_t regs[] = { {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u} };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
        eax = safe_stdcall1(0x6FD82330u, 0u, &asserted);
        emit_rec(fp, "0x6FD82330", "STATLIST_GetUnitLifePercent113c", 0,
            "null_unit_zero", "\"0x00000000\"", regs, 3, asserted, eax, 0xFFFFFFFFu);
    }
    {
        const int32_t hpVals[4]    = { (50 << 8), (75 << 8), (33 << 8), -(25 << 8) };
        const int32_t maxHpVals[4] = { 128,       (100 << 8), (100 << 8), (100 << 8) };
        const char *notes[4] = { "maxhp_sub256_div0_guard", "hp_75_of_100", "hp_33_of_100", "negative_hp_signed_idiv" };
        for (int i = 0; i < 4; i++) {
            setup_common_tables();
            U32(ARENA_UNIT0 + 0x00u) = 0u;
            U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = 0u;
            U32(ARENA_STATLIST0 + 0x24u) = ARENA_STATS0;
            U16(ARENA_STATLIST0 + 0x28u) = 2u;
            U16(ARENA_STATLIST0 + 0x2Au) = 4u;
            U32(ARENA_STATS0 + 0x00u) = 0x00060000u;
            S32(ARENA_STATS0 + 0x04u) = hpVals[i];
            U32(ARENA_STATS0 + 0x08u) = 0x00070000u;
            S32(ARENA_STATS0 + 0x0Cu) = maxHpVals[i];
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u},
                {ARENA_ISC, 0xB00u}, {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x40u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 7);
            eax = safe_stdcall1(0x6FD82330u, ARENA_UNIT0, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
            emit_rec(fp, "0x6FD82330", "STATLIST_GetUnitLifePercent113c", 1 + i,
                notes[i], args, regs, 7, asserted, eax, 0xFFFFFFFFu);
        }
    }
    {
        /* nItemStatCostTxtRecordCount == 7 -> stat 6 valid, stat 7 out of bounds -> maxHp=0 -> 0 */
        setup_common_tables();
        U32(ARENA_SGPT + 0xBD4u) = 7u;
        U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x24u) = ARENA_STATS0;
        U16(ARENA_STATLIST0 + 0x28u) = 2u;
        U32(ARENA_STATS0 + 0x00u) = 0x00060000u;
        S32(ARENA_STATS0 + 0x04u) = (50 << 8);
        U32(ARENA_STATS0 + 0x08u) = 0x00070000u;
        S32(ARENA_STATS0 + 0x0Cu) = (100 << 8);
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u},
            {ARENA_ISC, 0xB00u}, {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 7);
        eax = safe_stdcall1(0x6FD82330u, ARENA_UNIT0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
        emit_rec(fp, "0x6FD82330", "STATLIST_GetUnitLifePercent113c", 5,
            "isc_count_7_blocks_stat7", args, regs, 7, asserted, eax, 0xFFFFFFFFu);
    }

    /* =========================================================================
     * #04 0x6FD82CA0 STATES_SetUnitSourceUnit113c
     * ========================================================================= */
    {
        setup_common_tables();
        mem_region_t regs[] = { {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u} };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
        eax = safe_6FD82CA0(0x6FD82CA0u, 0u, 1u, 42u, &asserted);
        emit_rec(fp, "0x6FD82CA0", "STATES_SetUnitSourceUnit113c", 0,
            "null_unit_noop", "\"0x00000000\",1,42", regs, 3, asserted, 0u, 0u);
    }
    {
        /* pStatListEx == 0: writes +0x94, +0x98, and ORs 0x400 into +0xC8 */
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x5Cu) = 0u;
        U32(ARENA_UNIT0 + 0xC8u) = 0x02u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u}, {ARENA_UNIT0, 0xF0u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 4);
        eax = safe_6FD82CA0(0x6FD82CA0u, ARENA_UNIT0, 1u, 0x1234u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",1,4660", ARENA_UNIT0);
        emit_rec(fp, "0x6FD82CA0", "STATES_SetUnitSourceUnit113c", 1,
            "no_statlist_sets_src_and_flag400", args, regs, 4, asserted, 0u, 0u);
    }
    {
        /* First-time state 0x62 on extended unit with StatesTxt[98]+0x12 bit 0 set:
         * sets primary & gfx state bit, sets unit+0xC8 |= 8, allocates sublist, sets stats 0x161 & 0x162 */
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = 1u;
        U32(ARENA_UNIT0 + 0x0Cu) = 0x77u;
        U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
        U32(ARENA_STATLIST0 + 0x58u) = ARENA_STATEFLAGS0;
        U8(ARENA_STATESTXT + 0x16F8u + 0x12u) = 0x01u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u},
            {ARENA_STATESTXT + 0x16E0u, 0x60u}, {ARENA_ISC + 0x1BD00u, 0x500u},
            {ARENA_UNIT0, 0xF0u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATEFLAGS0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
        eax = safe_6FD82CA0(0x6FD82CA0u, ARENA_UNIT0, 0u, 99u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",0,99", ARENA_UNIT0);
        emit_rec(fp, "0x6FD82CA0", "STATES_SetUnitSourceUnit113c", 2,
            "first_time_state98_allocs_sublist_and_sets_stats", args, regs, 8, asserted, 0u, 0u);
    }
    {
        /* Repeat call when state 0x62 bit & sublist already exist: reuses ARENA_STATLIST1 */
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = 1u;
        U32(ARENA_UNIT0 + 0x0Cu) = 0x77u;
        U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
        U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
        U32(ARENA_STATLIST0 + 0x58u) = ARENA_STATEFLAGS0;
        U32(ARENA_STATEFLAGS0 + 0x0Cu) = 0x04u; /* state 0x62 already set */
        U32(ARENA_STATLIST1 + 0x10u) = 0u;
        U32(ARENA_STATLIST1 + 0x14u) = 0x62u;
        U32(ARENA_STATLIST1 + 0x34u) = ARENA_STATLIST0;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u},
            {ARENA_STATESTXT + 0x16E0u, 0x60u}, {ARENA_ISC + 0x1BD00u, 0x500u},
            {ARENA_UNIT0, 0xF0u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}, {ARENA_STATEFLAGS0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
        eax = safe_6FD82CA0(0x6FD82CA0u, ARENA_UNIT0, 2u, 555u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",2,555", ARENA_UNIT0);
        emit_rec(fp, "0x6FD82CA0", "STATES_SetUnitSourceUnit113c", 3,
            "existing_state98_and_sublist_updates_stats", args, regs, 9, asserted, 0u, 0u);
    }

    /* =========================================================================
     * #05 0x6FD83D10 STATES_CheckStateMaskByIndexOnUnit113c
     * ========================================================================= */
    {
        setup_common_tables();
        mem_region_t regs[] = { {0x6FDE9E1Cu, 4u}, {ARENA_SGPT, 0x200u} };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 2);
        eax = safe_stdcall2(0x6FD83D10u, 0u, 2u, &asserted);
        emit_rec(fp, "0x6FD83D10", "STATES_CheckStateMaskByIndexOnUnit113c", 0,
            "null_unit_zero", "\"0x00000000\",2", regs, 2, asserted, eax, 0xFFFFFFFFu);
    }
    {
        const int32_t idxs[4] = { -1, 40, 0, 39 };
        const uint32_t hits[4] = { 0u, 0u, 1u, 1u };
        const char *notes[4] = { "neg_idx_zero", "idx_40_out_of_bounds_zero", "idx_0_match_one", "idx_39_word5_match_one" };
        for (int i = 0; i < 4; i++) {
            setup_common_tables();
            U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST0 + 0x58u) = ARENA_STATEFLAGS0;
            if (hits[i]) {
                uint32_t mIdx = (uint32_t)idxs[i];
                uint32_t wIdx = (mIdx == 39u) ? 5u : 1u;
                U32(ARENA_STATEMASKS + mIdx * 24u + wIdx * 4u) = 0x00100000u;
                U32(ARENA_STATEFLAGS0 + wIdx * 4u) = 0x00100000u;
            }
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {ARENA_SGPT, 0x200u}, {ARENA_STATEMASKS, 0x400u},
                {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATEFLAGS0, 0x40u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 6);
            eax = safe_stdcall2(0x6FD83D10u, ARENA_UNIT0, (uint32_t)idxs[i], &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\",%d", ARENA_UNIT0, idxs[i]);
            emit_rec(fp, "0x6FD83D10", "STATES_CheckStateMaskByIndexOnUnit113c", 1 + i,
                notes[i], args, regs, 6, asserted, eax, 0xFFFFFFFFu);
        }
    }
    {
        /* Valid idx=5 but state bits do not overlap mask -> 0 */
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
        U32(ARENA_STATLIST0 + 0x58u) = ARENA_STATEFLAGS0;
        U32(ARENA_STATEMASKS + 5u * 24u + 0u) = 0x01u;
        U32(ARENA_STATEFLAGS0 + 0u) = 0x02u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {ARENA_SGPT, 0x200u}, {ARENA_STATEMASKS, 0x400u},
            {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATEFLAGS0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 6);
        eax = safe_stdcall2(0x6FD83D10u, ARENA_UNIT0, 5u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",5", ARENA_UNIT0);
        emit_rec(fp, "0x6FD83D10", "STATES_CheckStateMaskByIndexOnUnit113c", 5,
            "idx_5_no_overlap_zero", args, regs, 6, asserted, eax, 0xFFFFFFFFu);
    }

    /* =========================================================================
     * #06..#10: STATES_CheckStateMask{32,30,6,2,4}OnUnit113c
     * ========================================================================= */
    {
        const uint32_t vas[5]   = { 0x6FD83D80u, 0x6FD83DC0u, 0x6FD83FE0u, 0x6FD84020u, 0x6FD84040u };
        const char *names[5]    = {
            "STATES_CheckStateMask32OnUnit113c",
            "STATES_CheckStateMask30OnUnit113c",
            "STATES_CheckStateMask6OnUnit113c",
            "STATES_CheckStateMask2OnUnit113c",
            "STATES_CheckStateMask4OnUnit113c"
        };
        const uint32_t mIdxs[5] = { 32u, 30u, 6u, 2u, 4u };
        for (int f = 0; f < 5; f++) {
            for (int c = 0; c < 3; c++) {
                setup_common_tables();
                U32(ARENA_STATEMASKS + mIdxs[f] * 24u + 4u) = 0x00000080u;
                U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
                U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
                U32(ARENA_STATLIST0 + 0x58u) = ARENA_STATEFLAGS0;
                if (c == 2) {
                    U32(ARENA_STATEFLAGS0 + 4u) = 0x00000080u;
                } else if (c == 1) {
                    U32(ARENA_STATEFLAGS0 + 4u) = 0x00000001u;
                }
                uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
                mem_region_t regs[] = {
                    {0x6FDE9E1Cu, 4u}, {ARENA_SGPT, 0x200u}, {ARENA_STATEMASKS, 0x400u},
                    {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATEFLAGS0, 0x40u}
                };
                capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 6);
                eax = safe_stdcall1(vas[f], uArg, &asserted);
                snprintf(args, sizeof(args), "\"0x%08X\"", uArg);
                emit_rec(fp,
                    f == 0 ? "0x6FD83D80" : f == 1 ? "0x6FD83DC0" : f == 2 ? "0x6FD83FE0" : f == 3 ? "0x6FD84020" : "0x6FD84040",
                    names[f], c,
                    c == 0 ? "null_unit" : c == 1 ? "mask_miss" : "mask_hit",
                    args, regs, 6, asserted, eax, 0xFFFFFFFFu);
            }
        }
    }

    /* =========================================================================
     * #11 0x6FD888E0 STATLIST_NotifyIfStatModified113c
     * #12 0x6FD88940 STATLIST_SetFullStatEntry113c
     * (Status "ported" in k1r7-I10A-1.json per sync-gates.py:241 indirectUnknown
     * caller-callback rule; real-DLL vectors are embedded in PORTED_REAL_DLL_VECTORS
     * in tests/oracle/k1/laneA-I10A-1.test.ts and emitted when EMIT_PORTED_VAS=1.)
     * ========================================================================= */
    if (getenv("EMIT_PORTED_VAS")) {
        /* 0: null unit; 1: non-extended; 2: not in pModStat; 3: in pModStat but not in pBaseStat; 4: in both -> callback fires */
        for (int c = 0; c < 5; c++) {
            setup_common_tables();
            U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = (c == 1) ? 0u : 0x80000000u;
            if (c >= 3) {
                U32(ARENA_STATLIST0 + 0x50u) = ARENA_STATS1;
                U16(ARENA_STATLIST0 + 0x54u) = 1u;
                U16(ARENA_STATLIST0 + 0x56u) = 4u;
                U32(ARENA_STATS1 + 0x00u) = 0x00090000u;
            }
            if (c == 4) {
                U32(ARENA_STATLIST0 + 0x24u) = ARENA_STATS0;
                U16(ARENA_STATLIST0 + 0x28u) = 1u;
                U16(ARENA_STATLIST0 + 0x2Au) = 4u;
                U32(ARENA_STATS0 + 0x00u) = 0x00090000u;
                S32(ARENA_STATS0 + 0x04u) = 777;
            }
            uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
            mem_region_t regs[] = {
                {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x40u}, {ARENA_STATS1, 0x40u}, {ARENA_OUT, 0x20u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 5);
            eax = safe_stdcall4(0x6FD888E0u, uArg, ARENA_OUT, 9u, CB_NOTIFY_ADDR, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",9,\"0x%08X\"", uArg, ARENA_OUT, CB_NOTIFY_ADDR);
            emit_rec(fp, "0x6FD888E0", "STATLIST_NotifyIfStatModified113c", c,
                c == 0 ? "null_unit" : c == 1 ? "non_extended_list" : c == 2 ? "stat_not_in_modstat" : c == 3 ? "in_modstat_absent_base" : "in_modstat_and_base_invokes_cb",
                args, regs, 5, asserted, 0u, 0u);
        }

        /* 0: missing key & nVal==0 -> no-op
         * 1: insert new key with bHasDynamicOp=1 -> allocates array, sets 0x20000000, fires callback (ISC+5 bit 3 set)
         * 2: existing key set to 0 with bKeepZero=0 -> removes entry, fires callback
         * 3: existing key set to 0 with bKeepZero=1 -> keeps entry with 0, fires callback
         * 4: existing key set to same value -> no callback */
        for (int c = 0; c < 5; c++) {
            setup_common_tables();
            uint32_t pIsc = ARENA_ISC + 5u * 0x144u;
            U8(pIsc + 0x05u) = 0x08u; /* bit 3 -> callback gate */
            U8(pIsc + 0x50u) = (c == 3) ? 1u : 0u; /* bKeepZero */
            U8(pIsc + 0x53u) = (c == 1) ? 1u : 0u; /* bHasDynamicOp */
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST0 + 0x44u) = ARENA_UNIT1;
            U32(ARENA_STATLIST0 + 0x5Cu) = CB_SETSTAT_ADDR;
            U32(ARENA_STATLIST0 + 0x60u) = 0x11223344u;
            if (c >= 2) {
                U32(ARENA_STATLIST0 + 0x48u) = ARENA_STATS0;
                U16(ARENA_STATLIST0 + 0x4Cu) = 1u;
                U16(ARENA_STATLIST0 + 0x4Eu) = 4u;
                U32(ARENA_STATS0 + 0x00u) = 0x00050000u;
                S32(ARENA_STATS0 + 0x04u) = 50;
            }
            int32_t newVal = (c == 1) ? 42 : (c == 4) ? 50 : 0;
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u},
                {ARENA_ISC, 0x900u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x40u}, {ARENA_OUT, 0x20u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 7);
            eax = safe_6FD88940(0x6FD88940u, ARENA_STATLIST0, 0x00050000u, (uint32_t)newVal, pIsc, ARENA_UNIT0, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\",327680,%d,\"0x%08X\",\"0x%08X\"", ARENA_STATLIST0, newVal, pIsc, ARENA_UNIT0);
            emit_rec(fp, "0x6FD88940", "STATLIST_SetFullStatEntry113c", c,
                c == 0 ? "missing_zero_noop" : c == 1 ? "insert_new_dynop_and_cb" : c == 2 ? "zero_remove_and_cb" : c == 3 ? "zero_keep_and_cb" : "same_val_no_cb",
                args, regs, 7, asserted, 0u, 0u);
        }
    }


    /* =========================================================================
     * #13 0x6FD88BD0 STATLIST_GetTotalStatWithLayerInline113c
     * ========================================================================= */
    {
        for (int c = 0; c < 5; c++) {
            setup_common_tables();
            U32(ARENA_STATLIST0 + 0x08u) = 0u; /* player owner type */
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST0 + 0x48u) = ARENA_STATS0;
            U16(ARENA_STATLIST0 + 0x4Cu) = 1u;
            U16(ARENA_STATLIST0 + 0x4Eu) = 4u;
            U32(ARENA_STATS0 + 0x00u) = 0x000A0003u; /* stat 10, layer 3 */
            S32(ARENA_STATS0 + 0x04u) = (c == 4) ? 2 : 88;
            if (c == 4) {
                U8(ARENA_ISC + 10u * 0x144u + 0x04u) = 0x02u; /* fMin */
                S32(ARENA_ISC + 10u * 0x144u + 0x10u) = 25;
            }
            uint32_t pList = (c == 0) ? 0u : ARENA_STATLIST0;
            int32_t statId = (c == 1) ? -1 : (c == 2) ? 359 : 10;
            uint32_t layer = 3u;
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u},
                {ARENA_ISC, 0x1000u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x40u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 6);
            eax = safe_6FD88BD0(0x6FD88BD0u, pList, (uint32_t)statId, layer, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\",%d,%u", pList, statId, layer);
            emit_rec(fp, "0x6FD88BD0", "STATLIST_GetTotalStatWithLayerInline113c", c,
                c == 0 ? "null_list" : c == 1 ? "neg_statid" : c == 2 ? "oob_statid_359" : c == 3 ? "hit_stat10_layer3" : "clamped_by_fmin_25",
                args, regs, 6, asserted, eax, 0xFFFFFFFFu);
        }
    }

    /* =========================================================================
     * #14 0x6FD88ED0 STATLIST_GetUnitMinDamage113c & #15 0x6FD88F60 STATLIST_GetUnitMaxDamage113c
     * ========================================================================= */
    {
        for (int fnIdx = 0; fnIdx < 2; fnIdx++) {
            uint32_t va = (fnIdx == 0) ? 0x6FD88ED0u : 0x6FD88F60u;
            const char *vaStr = (fnIdx == 0) ? "0x6FD88ED0" : "0x6FD88F60";
            const char *name = (fnIdx == 0) ? "STATLIST_GetUnitMinDamage113c" : "STATLIST_GetUnitMaxDamage113c";
            for (int c = 0; c < 4; c++) {
                setup_common_tables();
                U32(ARENA_UNIT0 + 0x5Cu) = (c == 1) ? 0u : ARENA_STATLIST0;
                U32(ARENA_STATLIST0 + 0x24u) = ARENA_STATS0;
                U16(ARENA_STATLIST0 + 0x28u) = 4u;
                U16(ARENA_STATLIST0 + 0x2Au) = 4u;
                U32(ARENA_STATS0 + 0x00u) = 0x00150000u; S32(ARENA_STATS0 + 0x04u) = 11;
                U32(ARENA_STATS0 + 0x08u) = 0x00160000u; S32(ARENA_STATS0 + 0x0Cu) = 22;
                U32(ARENA_STATS0 + 0x10u) = 0x00170000u; S32(ARENA_STATS0 + 0x14u) = 33;
                U32(ARENA_STATS0 + 0x18u) = 0x00180000u; S32(ARENA_STATS0 + 0x1Cu) = 44;
                uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
                uint32_t twoH = (c == 3) ? 1u : 0u;
                mem_region_t regs[] = {
                    {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u},
                    {ARENA_ISC, 0x2000u}, {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x40u}
                };
                capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 7);
                eax = safe_stdcall2(va, uArg, twoH, &asserted);
                snprintf(args, sizeof(args), "\"0x%08X\",%u", uArg, twoH);
                emit_rec(fp, vaStr, name, c,
                    c == 0 ? "null_unit" : c == 1 ? "null_statlist" : c == 2 ? "one_handed" : "two_handed",
                    args, regs, 7, asserted, eax, 0xFFFFFFFFu);
            }
        }
    }

    /* =========================================================================
     * #16 0x6FD8A030 STATLIST_DeactivateWeaponDamageStats113c
     * #17 0x6FD8A100 STATLIST_ReactivateWeaponDamageStats113c
     * #18 0x6FD8AC90 STATLIST_SetWeaponStatListActive113c
     * ========================================================================= */
    {
        /* #16: 0=null, 1=already_deactivated, 2=deactivate_attached_subtracts_dmg_stat, 3=unattached_merges_deactivated */
        for (int c = 0; c < 4; c++) {
            setup_common_tables();
            U8(ARENA_ISC + 0x15u * 0x144u + 0x04u) = 0x04u; /* stat 0x15 is damage-related (bit 2) */
            U8(ARENA_ISC + 0x00u * 0x144u + 0x04u) = 0x00u; /* stat 0x00 (strength) is NOT damage-related */
            U32(ARENA_UNIT0 + 0x00u) = 0u;
            U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST0 + 0x3Cu) = (c == 3) ? 0u : ARENA_STATLIST1;
            U32(ARENA_STATLIST0 + 0x48u) = ARENA_STATS0;
            U16(ARENA_STATLIST0 + 0x4Cu) = 2u;
            U16(ARENA_STATLIST0 + 0x4Eu) = 4u;
            U32(ARENA_STATS0 + 0x00u) = 0x00000000u; S32(ARENA_STATS0 + 0x04u) = 10;
            U32(ARENA_STATS0 + 0x08u) = 0x00150000u; S32(ARENA_STATS0 + 0x0Cu) = 25;

            U32(ARENA_ITEM0 + 0x00u) = 4u;
            U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
            U8(ARENA_ITEMDATA0 + 0x45u) = 4u; /* bodyloc 4 (right arm, not 11/12) */
            U32(ARENA_ITEM0 + 0x5Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST1 + 0x04u) = (c == 3) ? 0u : ARENA_UNIT0;
            U32(ARENA_STATLIST1 + 0x10u) = (c == 1) ? 0x40000040u : 0x00000040u;
            U32(ARENA_STATLIST1 + 0x24u) = ARENA_STATS1;
            U16(ARENA_STATLIST1 + 0x28u) = 2u;
            U16(ARENA_STATLIST1 + 0x2Au) = 4u;
            U32(ARENA_STATLIST1 + 0x34u) = (c == 3) ? 0u : ARENA_STATLIST0;
            U32(ARENA_STATS1 + 0x00u) = 0x00000000u; S32(ARENA_STATS1 + 0x04u) = 10;
            U32(ARENA_STATS1 + 0x08u) = 0x00150000u; S32(ARENA_STATS1 + 0x0Cu) = 15;

            uint32_t ownerArg = (c == 0) ? 0u : ARENA_UNIT0;
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u},
                {ARENA_ISC, 0x2000u}, {ARENA_UNIT0, 0x80u}, {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x60u},
                {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}, {ARENA_STATS0, 0x40u}, {ARENA_STATS1, 0x40u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 11);
            eax = safe_stdcall2(0x6FD8A030u, ownerArg, ARENA_ITEM0, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ownerArg, ARENA_ITEM0);
            emit_rec(fp, "0x6FD8A030", "STATLIST_DeactivateWeaponDamageStats113c", c,
                c == 0 ? "null_owner" : c == 1 ? "already_deactivated" : c == 2 ? "deactivate_attached_subtracts_dmg" : "unattached_merges_inactive",
                args, regs, 11, asserted, eax, 0xFFFFFFFFu);
        }

        /* #17: 0=null, 1=already_active, 2=reactivate_attached_adds_dmg_stat, 3=unattached_merges_active */
        for (int c = 0; c < 4; c++) {
            setup_common_tables();
            U8(ARENA_ISC + 0x15u * 0x144u + 0x04u) = 0x04u;
            U32(ARENA_UNIT0 + 0x00u) = 0u;
            U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST0 + 0x3Cu) = (c == 3) ? 0u : ARENA_STATLIST1;
            U32(ARENA_STATLIST0 + 0x48u) = ARENA_STATS0;
            U16(ARENA_STATLIST0 + 0x4Cu) = 2u;
            U16(ARENA_STATLIST0 + 0x4Eu) = 4u;
            U32(ARENA_STATS0 + 0x00u) = 0x00000000u; S32(ARENA_STATS0 + 0x04u) = 10;
            U32(ARENA_STATS0 + 0x08u) = 0x00150000u; S32(ARENA_STATS0 + 0x0Cu) = 10;

            U32(ARENA_ITEM0 + 0x00u) = 4u;
            U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
            U8(ARENA_ITEMDATA0 + 0x45u) = 4u;
            U32(ARENA_ITEM0 + 0x5Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST1 + 0x04u) = (c == 3) ? 0u : ARENA_UNIT0;
            U32(ARENA_STATLIST1 + 0x10u) = (c == 1) ? 0x00000040u : 0x40000040u;
            U32(ARENA_STATLIST1 + 0x24u) = ARENA_STATS1;
            U16(ARENA_STATLIST1 + 0x28u) = 2u;
            U16(ARENA_STATLIST1 + 0x2Au) = 4u;
            U32(ARENA_STATLIST1 + 0x34u) = (c == 3) ? 0u : ARENA_STATLIST0;
            U32(ARENA_STATS1 + 0x00u) = 0x00000000u; S32(ARENA_STATS1 + 0x04u) = 10;
            U32(ARENA_STATS1 + 0x08u) = 0x00150000u; S32(ARENA_STATS1 + 0x0Cu) = 15;

            uint32_t ownerArg = (c == 0) ? 0u : ARENA_UNIT0;
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u},
                {ARENA_ISC, 0x2000u}, {ARENA_UNIT0, 0x80u}, {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x60u},
                {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}, {ARENA_STATS0, 0x40u}, {ARENA_STATS1, 0x40u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 11);
            eax = safe_stdcall2(0x6FD8A100u, ownerArg, ARENA_ITEM0, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ownerArg, ARENA_ITEM0);
            emit_rec(fp, "0x6FD8A100", "STATLIST_ReactivateWeaponDamageStats113c", c,
                c == 0 ? "null_owner" : c == 1 ? "already_active" : c == 2 ? "reactivate_attached_adds_dmg" : "unattached_merges_active",
                args, regs, 11, asserted, eax, 0xFFFFFFFFu);
        }

        /* #18: 0=null, 1=bodyloc_11_unlinks, 2=bodyloc_12_unlinks, 3=attached_toggle_off, 4=attached_toggle_on, 5=unattached_merge_active */
        for (int c = 0; c < 6; c++) {
            setup_common_tables();
            U8(ARENA_ISC + 0x15u * 0x144u + 0x04u) = 0x04u;
            U32(ARENA_UNIT0 + 0x00u) = 0u;
            U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST0 + 0x3Cu) = (c == 5) ? 0u : ARENA_STATLIST1;
            U32(ARENA_STATLIST0 + 0x48u) = ARENA_STATS0;
            U16(ARENA_STATLIST0 + 0x4Cu) = 1u;
            U16(ARENA_STATLIST0 + 0x4Eu) = 4u;
            U32(ARENA_STATS0 + 0x00u) = 0x00150000u; S32(ARENA_STATS0 + 0x04u) = 25;

            U32(ARENA_ITEM0 + 0x00u) = 4u;
            U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
            U8(ARENA_ITEMDATA0 + 0x44u) = (c == 1) ? 11u : (c == 2) ? 12u : 4u;
            U32(ARENA_ITEM0 + 0x5Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST1 + 0x04u) = (c == 5) ? 0u : ARENA_UNIT0;
            U32(ARENA_STATLIST1 + 0x10u) = (c == 4) ? 0x40000040u : 0x00000040u;
            U32(ARENA_STATLIST1 + 0x24u) = ARENA_STATS1;
            U16(ARENA_STATLIST1 + 0x28u) = 1u;
            U16(ARENA_STATLIST1 + 0x2Au) = 4u;
            U32(ARENA_STATLIST1 + 0x34u) = (c == 5) ? 0u : ARENA_STATLIST0;
            U32(ARENA_STATS1 + 0x00u) = 0x00150000u; S32(ARENA_STATS1 + 0x04u) = 15;

            uint32_t ownerArg = (c == 0) ? 0u : ARENA_UNIT0;
            uint32_t bActive = (c == 3) ? 0u : 1u;
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u},
                {ARENA_ISC, 0x2000u}, {ARENA_UNIT0, 0x80u}, {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x60u},
                {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}, {ARENA_STATS0, 0x40u}, {ARENA_STATS1, 0x40u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 11);
            eax = safe_stdcall3(0x6FD8AC90u, ownerArg, ARENA_ITEM0, bActive, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",%u", ownerArg, ARENA_ITEM0, bActive);
            emit_rec(fp, "0x6FD8AC90", "STATLIST_SetWeaponStatListActive113c", c,
                c == 0 ? "null_owner" : c == 1 ? "switch_slot_11_unlinks" : c == 2 ? "switch_slot_12_unlinks" : c == 3 ? "attached_deactivate" : c == 4 ? "attached_reactivate" : "unattached_merge",
                args, regs, 11, asserted, 0u, 0u);
        }
    }

    /* =========================================================================
     * #19 0x6FD6FB80 INVENTORY_GetEquippedWeaponHandClass113c
     * ========================================================================= */
    {
        /* 0: pInv==0 -> -1
         * 1: empty hands -> -1
         * 2: dual wield with Barb 1-or-2H sword (class 2) on Barbarian (class 4) -> 1
         * 3: dual wield 2H swords -> 2
         * 4: dual wield 1H swords -> -1
         * 5: single left-hand 2H sword -> 2
         * 6: single right-hand Barb 1-or-2H sword -> 2
         * 7: single left-hand 1H sword -> -1 */
        for (int c = 0; c < 8; c++) {
            setup_common_tables();
            U32(ARENA_UNIT0 + 0x00u) = 0u; /* player */
            U32(ARENA_UNIT0 + 0x04u) = 4u; /* Barbarian */
            U32(ARENA_INV0 + 0x00u) = 0x01020304u;
            U32(ARENA_INV0 + 0x08u) = ARENA_UNIT0;
            U32(ARENA_INV0 + 0x14u) = ARENA_GRIDS0;
            U32(ARENA_INV0 + 0x18u) = 1u;
            U8(ARENA_GRIDS0 + 0x08u) = 13u;
            U8(ARENA_GRIDS0 + 0x09u) = 1u;
            U32(ARENA_GRIDS0 + 0x0Cu) = ARENA_CELLS0;

            U32(ARENA_ITEM0 + 0x00u) = 4u;
            U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
            U32(ARENA_ITEM1 + 0x00u) = 4u;
            U32(ARENA_ITEM1 + 0x14u) = ARENA_ITEMDATA1;

            if (c == 2) {
                /* dual: right(slot 4)=1H(0), left(slot 5)=Barb1or2H(2) */
                U32(ARENA_ITEM0 + 0x04u) = 0u;
                U32(ARENA_ITEM1 + 0x04u) = 2u;
                U32(ARENA_CELLS0 + 4u * 4u) = ARENA_ITEM0;
                U32(ARENA_CELLS0 + 5u * 4u) = ARENA_ITEM1;
            } else if (c == 3) {
                /* dual: right(slot 4)=1H(0), left(slot 5)=2H(1) */
                U32(ARENA_ITEM0 + 0x04u) = 0u;
                U32(ARENA_ITEM1 + 0x04u) = 1u;
                U32(ARENA_CELLS0 + 4u * 4u) = ARENA_ITEM0;
                U32(ARENA_CELLS0 + 5u * 4u) = ARENA_ITEM1;
            } else if (c == 4) {
                /* dual: right(slot 4)=1H(0), left(slot 5)=1H(0) */
                U32(ARENA_ITEM0 + 0x04u) = 0u;
                U32(ARENA_ITEM1 + 0x04u) = 0u;
                U32(ARENA_CELLS0 + 4u * 4u) = ARENA_ITEM0;
                U32(ARENA_CELLS0 + 5u * 4u) = ARENA_ITEM1;
            } else if (c == 5) {
                /* single left(slot 5)=2H(1) */
                U32(ARENA_ITEM1 + 0x04u) = 1u;
                U32(ARENA_CELLS0 + 5u * 4u) = ARENA_ITEM1;
            } else if (c == 6) {
                /* single right(slot 4)=Barb1or2H(2) */
                U32(ARENA_ITEM0 + 0x04u) = 2u;
                U32(ARENA_CELLS0 + 4u * 4u) = ARENA_ITEM0;
            } else if (c == 7) {
                /* single left(slot 5)=1H(0) */
                U32(ARENA_ITEM1 + 0x04u) = 0u;
                U32(ARENA_CELLS0 + 5u * 4u) = ARENA_ITEM1;
            }
            uint32_t invArg = (c == 0) ? 0u : ARENA_INV0;
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u}, {0x6FDED378u, 0x18u},
                {ARENA_SGPT, 0xC70u}, {ARENA_ITYPEMAT, 0x200u}, {ARENA_ITEMSTXT, 4u * 0x1A8u},
                {ARENA_UNIT0, 0x80u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u}, {ARENA_CELLS0, 0x40u},
                {ARENA_ITEM0, 0x80u}, {ARENA_ITEM1, 0x80u}, {ARENA_ITEMDATA0, 0x60u}, {ARENA_ITEMDATA1, 0x60u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 15);
            eax = safe_stdcall2(0x6FD6FB80u, ARENA_UNIT0, invArg, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_UNIT0, invArg);
            emit_rec(fp, "0x6FD6FB80", "INVENTORY_GetEquippedWeaponHandClass113c", c,
                c == 0 ? "null_inv" : c == 1 ? "empty_hands" : c == 2 ? "dual_barb_1or2h_ret1" : c == 3 ? "dual_2h_ret2" : c == 4 ? "dual_1h_ret_neg1" : c == 5 ? "single_left_2h_ret2" : c == 6 ? "single_right_1or2h_ret2" : "single_left_1h_ret_neg1",
                args, regs, 15, asserted, eax, 0xFFFFFFFFu);
        }
    }

    /* =========================================================================
     * #20 0x6FDD54C0 DRLGOUTJUNG_BuildJunglePresets113c
     * ========================================================================= */
    {
        /* 0: lvl 75 (< 76) -> early return
         * 1: lvl 79 (> 78) -> early return
         * 2: lvl 76, pJungDefs == 0 -> assert line 39 (0x27)
         * 3: lvl 76, blocksX=2, blocksY=2, lastCell==0 -> spawns 0x23D on last row with pickedFile=1
         * 4: lvl 76, blocksX=2, blocksY=2, lastCell!=0 -> spawns 0x23D on last row with pickedFile=0
         * 5: lvl 77, nLevelType=3 (6 perms), 3 special presets (>0x23E) -> adds +10
         * 6: lvl 78, row 0 cell1==0 vs !=0 -> spawns 0x23E on row 0 and adds +20 on row 1
         * 7: lvl 77, 4 special presets (>0x23E) -> assert line 71 (0x47) */
        for (int c = 0; c < 8; c++) {
            setup_common_tables();
            /* Populate LevelDef 76 (+0x2E50): dwSizeX[0]=64 (blocksX=2), dwSizeY[0]=64 (blocksY=2) */
            U32(ARENA_LEVELDEF + 0x2E50u + 0x0Cu) = 64u;
            U32(ARENA_LEVELDEF + 0x2E50u + 0x18u) = 64u;
            /* Populate LvlPrestTxt 573..598: dwDef=id, nSizeX=8 (1 cell), nSizeY=8 (1 cell), dwFiles=2 */
            for (uint32_t pid = 573u; pid <= 598u; pid++) {
                uint32_t pRec = ARENA_LVLPREST + pid * 0x1B0u;
                U32(pRec + 0x00u) = pid;
                U32(pRec + 0x28u) = 8u;
                U32(pRec + 0x2Cu) = 8u;
                U32(pRec + 0x40u) = 2u;
            }
            /* Setup 8x8 outdoor grids at ARENA_OUTDOORS0 */
            U32(ARENA_OUTDOORS0 + 0x04u) = ARENA_GRIDCELLS04;
            U32(ARENA_OUTDOORS0 + 0x08u) = ARENA_GRIDROWS04;
            U32(ARENA_OUTDOORS0 + 0x2Cu) = ARENA_GRIDCELLS2C;
            U32(ARENA_OUTDOORS0 + 0x30u) = ARENA_GRIDROWS2C;
            for (uint32_t r = 0u; r < 8u; r++) {
                U32(ARENA_GRIDROWS04 + r * 4u) = r * 8u;
                U32(ARENA_GRIDROWS2C + r * 4u) = r * 8u;
            }
            U32(ARENA_LEVEL0 + 0x14u)  = ARENA_OUTDOORS0;
            U32(ARENA_LEVEL0 + 0x1B4u) = ARENA_DRLG0;
            U8(ARENA_DRLG0 + 0x450u)   = 0u; /* diff 0 */
            U32(ARENA_LEVEL0 + 0x1B8u) = (c == 5) ? 3u : 1u;
            U32(ARENA_LEVEL0 + 0x1BCu) = (c == 2) ? 0u : ARENA_JUNGDEFS0;
            U32(ARENA_LEVEL0 + 0x1C4u) = 0x12345678u;
            U32(ARENA_LEVEL0 + 0x1C8u) = 0x0000029Au;
            U32(ARENA_LEVEL0 + 0x1CCu) = 0u;
            U32(ARENA_LEVEL0 + 0x1D0u) = (c == 0) ? 75u : (c == 1) ? 79u : (c <= 4) ? 76u : (c == 6) ? 78u : 77u;

            if (c == 3) {
                U32(ARENA_JUNGDEFS0 + 0u) = 573u;
                U32(ARENA_JUNGDEFS0 + 4u) = 575u;
                U32(ARENA_JUNGDEFS0 + 8u) = 0u;
                U32(ARENA_JUNGDEFS0 + 12u) = 0u; /* lastCell == 0 */
            } else if (c == 4) {
                U32(ARENA_JUNGDEFS0 + 0u) = 0u;
                U32(ARENA_JUNGDEFS0 + 4u) = 576u;
                U32(ARENA_JUNGDEFS0 + 8u) = 0u;
                U32(ARENA_JUNGDEFS0 + 12u) = 575u; /* lastCell != 0 */
            } else if (c == 5) {
                U32(ARENA_JUNGDEFS0 + 0u) = 575u;
                U32(ARENA_JUNGDEFS0 + 4u) = 576u;
                U32(ARENA_JUNGDEFS0 + 8u) = 577u;
                U32(ARENA_JUNGDEFS0 + 12u) = 0u;
            } else if (c == 6) {
                U32(ARENA_JUNGDEFS0 + 0u) = 0u;
                U32(ARENA_JUNGDEFS0 + 4u) = 0u; /* cell1 == 0 -> pickedFile=1 on row 0 */
                U32(ARENA_JUNGDEFS0 + 8u) = 575u; /* +20 -> 595 */
                U32(ARENA_JUNGDEFS0 + 12u) = 574u; /* <= 0x23E -> pickedFile=-1 */
            } else if (c == 7) {
                U32(ARENA_JUNGDEFS0 + 0u) = 575u;
                U32(ARENA_JUNGDEFS0 + 4u) = 575u;
                U32(ARENA_JUNGDEFS0 + 8u) = 575u;
                U32(ARENA_JUNGDEFS0 + 12u) = 575u; /* 4th > 0x23E -> assert line 71 */
            }

            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {0x6FDF0B38u, 8u}, {ARENA_SGPT, 0xC70u},
                {ARENA_LEVELDEF + 0x2E50u, 0x40u}, {ARENA_LVLPREST + 573u * 0x1B0u, 26u * 0x1B0u},
                {ARENA_LEVEL0, 0x200u}, {ARENA_DRLG0, 0x480u}, {ARENA_OUTDOORS0, 0x60u},
                {ARENA_GRIDCELLS04, 0x100u}, {ARENA_GRIDROWS04, 0x20u},
                {ARENA_GRIDCELLS2C, 0x100u}, {ARENA_GRIDROWS2C, 0x20u},
                {ARENA_JUNGDEFS0, 0x40u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 13);
            eax = safe_6FDD54C0(0x6FDD54C0u, ARENA_LEVEL0, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_LEVEL0);
            emit_rec(fp, "0x6FDD54C0", "DRLGOUTJUNG_BuildJunglePresets113c", c,
                c == 0 ? "lvl_75_noop" : c == 1 ? "lvl_79_noop" : c == 2 ? "null_jungdefs_assert_39" : c == 3 ? "lvl76_lastcell_zero" : c == 4 ? "lvl76_lastcell_nonzero" : c == 5 ? "lvl77_type3_three_specials" : c == 6 ? "lvl78_row0_and_plus20" : "fourth_special_assert_71",
                args, regs, 13, asserted, 0u, 0u);
        }
    }
}

static void emit_i10a_2(FILE *fp) {
    int asserted = 0;
    uint32_t eax = 0u;
    char args[256];

    /* =========================================================================
     * #21 0x6FD82EF0 UNITS_SyncDualWieldWeaponStatLists113c
     * ========================================================================= */
    {
        /* 0: non-dual-wield unit (class 0 Amazon) -> no-op
         * 1: Barbarian (class 4), active==0, composit attached -> activates composit
         * 2: Barbarian, active==composit, secondary attached -> activates composit, deactivates secondary
         * 3: Barbarian, active!=composit -> activates active, deactivates composit */
        for (int c = 0; c < 4; c++) {
            setup_common_tables();
            U8(ARENA_ISC + 0x15u * 0x144u + 0x04u) = 0x04u;
            U32(ARENA_UNIT0 + 0x00u) = 0u;
            U32(ARENA_UNIT0 + 0x04u) = (c == 0) ? 0u : 4u; /* 0=Ama, 4=Barb */
            U32(ARENA_UNIT0 + 0x10u) = 7u; /* attack1 mode */
            U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_UNIT0 + 0x60u) = ARENA_INV0;
            U32(ARENA_UNIT0 + 0xA8u) = ARENA_SKILLLIST;

            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST0 + 0x44u) = ARENA_UNIT0;
            U32(ARENA_STATLIST0 + 0x48u) = ARENA_STATS0;
            U16(ARENA_STATLIST0 + 0x4Cu) = 1u;
            U16(ARENA_STATLIST0 + 0x4Eu) = 4u;
            U32(ARENA_STATS0 + 0x00u) = 0x00150000u; S32(ARENA_STATS0 + 0x04u) = 20;

            U32(ARENA_INV0 + 0x00u) = 0x01020304u;
            U32(ARENA_INV0 + 0x08u) = ARENA_UNIT0;
            U32(ARENA_INV0 + 0x14u) = ARENA_GRIDS0;
            U32(ARENA_INV0 + 0x18u) = 1u;
            U32(ARENA_INV0 + 0x1Cu) = 0x101u; /* composit weapon guid = ITEM0 */
            U8(ARENA_GRIDS0 + 0x08u) = 13u;
            U8(ARENA_GRIDS0 + 0x09u) = 1u;
            U32(ARENA_GRIDS0 + 0x0Cu) = ARENA_CELLS0;

            /* ITEM0 (slot 4, guid 0x101) & ITEM1 (slot 5, guid 0x102) */
            U32(ARENA_ITEM0 + 0x00u) = 4u;
            U32(ARENA_ITEM0 + 0x04u) = 0u; /* 1H sword */
            U32(ARENA_ITEM0 + 0x0Cu) = 0x101u;
            U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
            U8(ARENA_ITEMDATA0 + 0x45u) = 4u;
            U32(ARENA_ITEMDATA0 + 0x5Cu + 0x00u) = ARENA_INV0;
            U32(ARENA_ITEMDATA0 + 0x5Cu + 0x08u) = ARENA_ITEM1;
            U32(ARENA_ITEM0 + 0x5Cu) = ARENA_STATLIST1;

            U32(ARENA_ITEM1 + 0x00u) = 4u;
            U32(ARENA_ITEM1 + 0x04u) = 0u; /* 1H sword */
            U32(ARENA_ITEM1 + 0x0Cu) = 0x102u;
            U32(ARENA_ITEM1 + 0x14u) = ARENA_ITEMDATA1;
            U8(ARENA_ITEMDATA1 + 0x45u) = 5u;
            U32(ARENA_ITEMDATA1 + 0x5Cu + 0x00u) = ARENA_INV0;
            U32(ARENA_ITEMDATA1 + 0x5Cu + 0x04u) = ARENA_ITEM0;
            U32(ARENA_ITEM1 + 0x5Cu) = ARENA_STATLIST2;

            U32(ARENA_INV0 + 0x0Cu) = ARENA_ITEM0;
            U32(ARENA_INV0 + 0x10u) = ARENA_ITEM1;
            U32(ARENA_CELLS0 + 4u * 4u) = (c == 1) ? 0u : (c == 2) ? ARENA_ITEM0 : ARENA_ITEM1;
            U32(ARENA_CELLS0 + 5u * 4u) = (c == 1) ? ARENA_ITEM0 : (c == 2) ? ARENA_ITEM1 : ARENA_ITEM0;

            U32(ARENA_STATLIST1 + 0x04u) = ARENA_UNIT0;
            U32(ARENA_STATLIST1 + 0x10u) = (c <= 2) ? 0x40000040u : 0x00000040u;
            U32(ARENA_STATLIST1 + 0x24u) = ARENA_STATS1;
            U16(ARENA_STATLIST1 + 0x28u) = 1u;
            U16(ARENA_STATLIST1 + 0x2Au) = 4u;
            U32(ARENA_STATLIST1 + 0x2Cu) = ARENA_STATLIST2;
            U32(ARENA_STATLIST1 + 0x34u) = ARENA_STATLIST0;
            U32(ARENA_STATS1 + 0x00u) = 0x00150000u; S32(ARENA_STATS1 + 0x04u) = 7;

            U32(ARENA_STATLIST2 + 0x04u) = ARENA_UNIT0;
            U32(ARENA_STATLIST2 + 0x10u) = (c == 3) ? 0x40000040u : 0x00000040u;
            U32(ARENA_STATLIST2 + 0x24u) = ARENA_STATS1;
            U16(ARENA_STATLIST2 + 0x28u) = 1u;
            U16(ARENA_STATLIST2 + 0x2Au) = 4u;
            U32(ARENA_STATLIST2 + 0x30u) = ARENA_STATLIST1;
            U32(ARENA_STATLIST2 + 0x34u) = ARENA_STATLIST0;

            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u}, {0x6FDED378u, 0x18u},
                {ARENA_SGPT, 0xC70u}, {ARENA_ITYPEMAT, 0x200u}, {ARENA_ITEMSTXT, 4u * 0x1A8u}, {ARENA_ISC, 0x2000u},
                {ARENA_UNIT0, 0xF0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u}, {ARENA_CELLS0, 0x40u},
                {ARENA_ITEM0, 0x80u}, {ARENA_ITEM1, 0x80u}, {ARENA_ITEMDATA0, 0x80u}, {ARENA_ITEMDATA1, 0x80u},
                {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}, {ARENA_STATLIST2, 0x80u},
                {ARENA_STATS0, 0x40u}, {ARENA_STATS1, 0x40u}, {ARENA_SKILLLIST, 0x20u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 22);
            eax = safe_stdcall2(0x6FD82EF0u, ARENA_UNIT0, 0u, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\",0", ARENA_UNIT0);
            emit_rec(fp, "0x6FD82EF0", "UNITS_SyncDualWieldWeaponStatLists113c", c,
                c == 0 ? "non_dual_wield_noop" : c == 1 ? "active_zero_activates_composit" : c == 2 ? "active_eq_composit_deactivates_secondary" : "active_ne_composit_swaps_active",
                args, regs, 22, asserted, 0u, 0u);
        }
    }

    /* =========================================================================
     * #22 0x6FDCFCD0 UNITS_GetDistanceToOtherUnit113c
     * ========================================================================= */
    {
        /* 0: (0,0) vs (0,0) -> table[0]==-1 -> 0
         * 1: (10,10) sz=2 vs (14,13) sz=2 (dx=4, dy=3, sz=2) -> table[28]==4
         * 2: (10,10) sz=1 vs (14,13) sz=2 (sz1<=1 -> d+1 = 5)
         * 3: (10,10) sz=3 vs (14,13) sz=2 (sz1==3 -> d-1 = 3)
         * 4: (10,10) sz=2 vs (25,14) sz=2 (dx=15 >= 8, dy=4, dx > dy -> (4-2) + (15-2)*2 = 28)
         * 5: static object (type 2) at (10,10) sz=4 vs (14,25) sz=2 (dx <= dy octagonal) */
        for (int c = 0; c < 6; c++) {
            setup_common_tables();
            /* MonStats[0] ->MonStats2[0] with nSizeX */
            U16(ARENA_MONSTATS + 0x16u) = 0u;
            U16(ARENA_MONSTATS + 0x00u * 0x1A8u + 0x02u) = 0u;
            U8(ARENA_MONSTATS2 + 0x08u) = (c == 2) ? 1u : (c == 3) ? 3u : 2u;

            if (c == 5) {
                U32(ARENA_UNIT0 + 0x00u) = 2u; /* object */
                U32(ARENA_UNIT0 + 0x14u) = ARENA_OBJDATA0;
                U32(ARENA_OBJDATA0 + 0x00u) = ARENA_OBJTXT0;
                U32(ARENA_OBJTXT0 + 0xE0u) = 4u; /* szX = 4 */
                U32(ARENA_UNIT0 + 0x2Cu) = ARENA_PATH0;
                U32(ARENA_PATH0 + 0x0Cu) = 10u;
                U32(ARENA_PATH0 + 0x10u) = 10u;
            } else {
                U32(ARENA_UNIT0 + 0x00u) = 1u; /* monster */
                U32(ARENA_UNIT0 + 0x04u) = 0u;
                U32(ARENA_UNIT0 + 0x2Cu) = ARENA_PATH0;
                U16(ARENA_PATH0 + 0x02u) = 10u;
                U16(ARENA_PATH0 + 0x06u) = 10u;
            }
            U32(ARENA_UNIT1 + 0x00u) = 0u; /* player (szX=2) */
            U32(ARENA_UNIT1 + 0x2Cu) = ARENA_PATH1;
            U16(ARENA_PATH1 + 0x02u) = (c == 0) ? 10u : (c == 4) ? 25u : 14u;
            U16(ARENA_PATH1 + 0x06u) = (c == 0) ? 10u : (c == 4) ? 14u : (c == 5) ? 25u : 13u;

            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {ARENA_SGPT, 0xC70u}, {ARENA_MONSTATS, 0x200u}, {ARENA_MONSTATS2, 0x40u},
                {ARENA_UNIT0, 0x80u}, {ARENA_UNIT1, 0x80u}, {ARENA_PATH0, 0x40u}, {ARENA_PATH1, 0x40u},
                {ARENA_OBJDATA0, 0x20u}, {ARENA_OBJTXT0, 0x100u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 10);
            eax = safe_stdcall2(0x6FDCFCD0u, ARENA_UNIT0, ARENA_UNIT1, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_UNIT0, ARENA_UNIT1);
            emit_rec(fp, "0x6FDCFCD0", "UNITS_GetDistanceToOtherUnit113c", c,
                c == 0 ? "same_pos_zero" : c == 1 ? "table_sz2_d4" : c == 2 ? "table_sz1_plus1" : c == 3 ? "table_sz3_minus1" : c == 4 ? "octagonal_dx_gt_dy" : "octagonal_static_dy_gt_dx",
                args, regs, 10, asserted, eax, 0xFFFFFFFFu);
        }
    }

    /* =========================================================================
     * #23 0x6FD82220 UNITS_GetAnimStartFrame113c
     * ========================================================================= */
    {
        /* 0: null unit -> 0
         * 1: monster unit -> 0
         * 2: player (class 0 Amazon), mode 6 (< 7) -> 0
         * 3: player (class 4 Barbarian), mode 7 (A1), unarmed (wclass 0) -> table[0*7+4]=0
         * 4: player (class 0 Amazon), mode 7 (A1), unarmed (wclass 0) -> table[0*7+0]=1
         * 5: player (class 0 Amazon), mode 7 (A1), 1hs (wclass 2) -> table[2*7+0]=2
         * 6: player (class 0 Amazon, non-dual-wield), mode 15 -> 0
         * 7: player (class 4 Barbarian), mode 9 (in [7..16] but not {7,8,15,16}) -> 0 */
        for (int c = 0; c < 8; c++) {
            setup_common_tables();
            U32(ARENA_UNIT0 + 0x00u) = (c == 1) ? 1u : 0u;
            U32(ARENA_UNIT0 + 0x04u) = (c == 3 || c == 7) ? 4u : 0u;
            U32(ARENA_UNIT0 + 0x10u) = (c == 2) ? 6u : (c == 6) ? 15u : (c == 7) ? 9u : 7u;
            U32(ARENA_UNIT0 + 0x60u) = ARENA_INV0;
            U32(ARENA_UNIT0 + 0xA8u) = ARENA_SKILLLIST;

            U32(ARENA_INV0 + 0x00u) = 0x01020304u;
            U32(ARENA_INV0 + 0x08u) = ARENA_UNIT0;
            U32(ARENA_INV0 + 0x14u) = ARENA_GRIDS0;
            U32(ARENA_INV0 + 0x18u) = 1u;
            U32(ARENA_INV0 + 0x1Cu) = 0xFFFFFFFFu;
            U8(ARENA_GRIDS0 + 0x08u) = 13u;
            U8(ARENA_GRIDS0 + 0x09u) = 1u;
            U32(ARENA_GRIDS0 + 0x0Cu) = ARENA_CELLS0;

            if (c == 5) {
                U32(ARENA_ITEM0 + 0x00u) = 4u;
                U32(ARENA_ITEM0 + 0x04u) = 0u; /* 0=1hs ('1hs ' -> wclass 2) */
                U32(ARENA_ITEM0 + 0x0Cu) = 0x101u;
                U32(ARENA_ITEM0 + 0x14u) = ARENA_ITEMDATA0;
                U8(ARENA_ITEMDATA0 + 0x44u) = 4u;
                U32(ARENA_CELLS0 + 4u * 4u) = ARENA_ITEM0;
            }

            uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {0x6FDEFB94u, 8u}, {0x6FDED378u, 0x18u}, {0x6FDEF020u, 0x20u},
                {ARENA_SGPT, 0xC70u}, {ARENA_ITYPEMAT, 0x200u}, {ARENA_ITEMSTXT, 4u * 0x1A8u},
                {ARENA_UNIT0, 0xF0u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u}, {ARENA_CELLS0, 0x40u},
                {ARENA_ITEM0, 0x80u}, {ARENA_ITEMDATA0, 0x60u}, {ARENA_SKILLLIST, 0x20u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 15);
            eax = safe_stdcall1(0x6FD82220u, uArg, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\"", uArg);
            emit_rec(fp, "0x6FD82220", "UNITS_GetAnimStartFrame113c", c,
                c == 0 ? "null_unit" : c == 1 ? "monster_unit" : c == 2 ? "mode6_below_range" : c == 3 ? "barb_unarmed_a1_zero" : c == 4 ? "ama_unarmed_a1_one" : c == 5 ? "ama_1hs_a1_two" : c == 6 ? "ama_mode15_no_dual" : "barb_mode9_zero",
                args, regs, 15, asserted, eax, 0xFFFFFFFFu);
        }
    }

    /* =========================================================================
     * #24 0x6FD814A0 UNITS_HasCollisionBetweenUnits113c
     * ========================================================================= */
    {
        /* 0: pUnit1 == 0 -> assert line 4752 (0x1290)
         * 1: pUnit2 == 0 -> assert line 4753 (0x1291)
         * 2: pRoom == 0 -> 0
         * 3: clear ray between (12,12) and (18,12) -> 0
         * 4: blocked ray between (12,12) and (18,12) -> 1 */
        for (int c = 0; c < 5; c++) {
            setup_common_tables();
            U32(ARENA_ROOM0 + 0x20u) = ARENA_COLL0;
            U32(ARENA_ROOM0 + 0x4Cu) = 10u;
            U32(ARENA_ROOM0 + 0x50u) = 10u;
            U32(ARENA_ROOM0 + 0x54u) = 20u;
            U32(ARENA_ROOM0 + 0x58u) = 20u;
            U32(ARENA_COLL0 + 0x00u) = 10u;
            U32(ARENA_COLL0 + 0x04u) = 10u;
            U32(ARENA_COLL0 + 0x08u) = 20u;
            U32(ARENA_COLL0 + 0x0Cu) = 20u;
            U32(ARENA_COLL0 + 0x20u) = ARENA_COLLMAP0;
            if (c == 4) {
                /* Block cells along y=12 (rel y=2) at x=14..16 (rel x=4..6 -> idx = 2*20 + 4..6 = 44..46) */
                U16(ARENA_COLLMAP0 + 44u * 2u) = 0x0001u;
                U16(ARENA_COLLMAP0 + 45u * 2u) = 0x0001u;
                U16(ARENA_COLLMAP0 + 46u * 2u) = 0x0001u;
            }
            U32(ARENA_UNIT0 + 0x00u) = 0u;
            U32(ARENA_UNIT0 + 0x2Cu) = ARENA_PATH0;
            U16(ARENA_PATH0 + 0x02u) = 12u;
            U16(ARENA_PATH0 + 0x06u) = 12u;
            U32(ARENA_PATH0 + 0x1Cu) = (c == 2) ? 0u : ARENA_ROOM0;

            U32(ARENA_UNIT1 + 0x00u) = 0u;
            U32(ARENA_UNIT1 + 0x2Cu) = ARENA_PATH1;
            U16(ARENA_PATH1 + 0x02u) = 18u;
            U16(ARENA_PATH1 + 0x06u) = 12u;
            U32(ARENA_PATH1 + 0x1Cu) = ARENA_ROOM0;

            uint32_t u1 = (c == 0) ? 0u : ARENA_UNIT0;
            uint32_t u2 = (c == 1) ? 0u : ARENA_UNIT1;
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {ARENA_SGPT, 0xC70u},
                {ARENA_UNIT0, 0x80u}, {ARENA_UNIT1, 0x80u}, {ARENA_PATH0, 0x40u}, {ARENA_PATH1, 0x40u},
                {ARENA_ROOM0, 0x80u}, {ARENA_COLL0, 0x30u}, {ARENA_COLLMAP0, 0x380u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
            eax = safe_stdcall3(0x6FD814A0u, u1, u2, 0x0001u, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",1", u1, u2);
            emit_rec(fp, "0x6FD814A0", "UNITS_HasCollisionBetweenUnits113c", c,
                c == 0 ? "null_u1_assert" : c == 1 ? "null_u2_assert" : c == 2 ? "null_room_zero" : c == 3 ? "clear_ray_zero" : "blocked_ray_one",
                args, regs, 9, asserted, eax, 0xFFFFFFFFu);
        }
    }

    /* =========================================================================
     * #25 0x6FD81850 UNITS_SetCollisionMaskAtCoords113c
     * ========================================================================= */
    {
        /* 0: pUnit == 0 -> assert line 2129 (0x851)
         * 1: object with szX == 0 -> no-op
         * 2: player (szX=2, szY=2, mask=0x80) at (13, 13) -> sets collision cells */
        for (int c = 0; c < 3; c++) {
            setup_common_tables();
            U32(ARENA_ROOM0 + 0x20u) = ARENA_COLL0;
            U32(ARENA_ROOM0 + 0x4Cu) = 10u;
            U32(ARENA_ROOM0 + 0x50u) = 10u;
            U32(ARENA_ROOM0 + 0x54u) = 20u;
            U32(ARENA_ROOM0 + 0x58u) = 20u;
            U32(ARENA_COLL0 + 0x00u) = 10u;
            U32(ARENA_COLL0 + 0x04u) = 10u;
            U32(ARENA_COLL0 + 0x08u) = 20u;
            U32(ARENA_COLL0 + 0x0Cu) = 20u;
            U32(ARENA_COLL0 + 0x20u) = ARENA_COLLMAP0;
            if (c == 1) {
                U32(ARENA_UNIT0 + 0x00u) = 2u; /* object */
                U32(ARENA_UNIT0 + 0x14u) = ARENA_OBJDATA0;
                U32(ARENA_OBJDATA0 + 0x00u) = ARENA_OBJTXT0;
                U32(ARENA_OBJTXT0 + 0xE0u) = 0u; /* szX = 0 */
                U32(ARENA_OBJTXT0 + 0xE4u) = 2u;
            } else {
                U32(ARENA_UNIT0 + 0x00u) = 0u; /* player */
            }
            uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {ARENA_SGPT, 0xC70u},
                {ARENA_UNIT0, 0x80u}, {ARENA_OBJDATA0, 0x20u}, {ARENA_OBJTXT0, 0x100u},
                {ARENA_ROOM0, 0x80u}, {ARENA_COLL0, 0x30u}, {ARENA_COLLMAP0, 0x380u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
            eax = safe_stdcall4(0x6FD81850u, uArg, ARENA_ROOM0, 13u, 13u, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",13,13", uArg, ARENA_ROOM0);
            emit_rec(fp, "0x6FD81850", "UNITS_SetCollisionMaskAtCoords113c", c,
                c == 0 ? "null_unit_assert" : c == 1 ? "zero_sizex_noop" : "player_sets_mask_0x80",
                args, regs, 8, asserted, 0u, 0u);
        }
    }

    /* =========================================================================
     * #26 0x6FD819A0 UNITS_IsUnitMovingBool113c
     * ========================================================================= */
    {
        for (int c = 0; c < 3; c++) {
            setup_common_tables();
            U32(ARENA_UNIT0 + 0x00u) = 0u;
            U32(ARENA_UNIT0 + 0x10u) = (c == 2) ? 2u : 1u; /* 2=walk(moving), 1=neutral(idle) */
            U32(ARENA_UNIT0 + 0x2Cu) = ARENA_PATH0;
            uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
            mem_region_t regs[] = { {ARENA_UNIT0, 0x80u}, {ARENA_PATH0, 0x40u} };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 2);
            eax = safe_stdcall1(0x6FD819A0u, uArg, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\"", uArg);
            emit_rec(fp, "0x6FD819A0", "UNITS_IsUnitMovingBool113c", c,
                c == 0 ? "null_unit_zero" : c == 1 ? "idle_zero" : "walking_one",
                args, regs, 2, asserted, eax, 0xFFFFFFFFu);
        }
    }

    /* =========================================================================
     * #27 0x6FD886E0 STATLIST_GetExtendedUnitStatsById113c
     * ========================================================================= */
    {
        /* 0: non-extended list -> 0
         * 1: extended list, 2 layers of stat 0x30, nMax=4 -> copies 2
         * 2: extended list, 2 layers of stat 0x30, nMax=1 -> copies 1 */
        for (int c = 0; c < 3; c++) {
            setup_common_tables();
            U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = (c == 0) ? 0u : 0x80000000u;
            U32(ARENA_STATLIST0 + 0x48u) = ARENA_STATS0;
            U16(ARENA_STATLIST0 + 0x4Cu) = 3u;
            U16(ARENA_STATLIST0 + 0x4Eu) = 4u;
            U32(ARENA_STATS0 + 0x00u) = 0x00300001u; S32(ARENA_STATS0 + 0x04u) = 10;
            U32(ARENA_STATS0 + 0x08u) = 0x00300002u; S32(ARENA_STATS0 + 0x0Cu) = 20;
            U32(ARENA_STATS0 + 0x10u) = 0x00310000u; S32(ARENA_STATS0 + 0x14u) = 99;
            uint32_t nMax = (c == 2) ? 1u : 4u;
            mem_region_t regs[] = {
                {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x40u}, {ARENA_OUT, 0x30u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 4);
            eax = safe_stdcall4(0x6FD886E0u, ARENA_UNIT0, 0x30u, ARENA_OUT, nMax, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\",48,\"0x%08X\",%u", ARENA_UNIT0, ARENA_OUT, nMax);
            emit_rec(fp, "0x6FD886E0", "STATLIST_GetExtendedUnitStatsById113c", c,
                c == 0 ? "non_extended_zero" : c == 1 ? "copies_two_layers" : "capped_by_nmax_one",
                args, regs, 4, asserted, eax, 0xFFFFFFFFu);
        }
    }

    /* =========================================================================
     * #28 0x6FD6B1D0 MONSTERS_ApplyClassicConversionStats113c
     * ========================================================================= */
    {
        /* 0: bExpansion=1 -> no-op
         * 1: nMode=0 -> no-op
         * 2: bAlign=1 -> no-op
         * 3: nMode=1 (Nightmare): maxhp*1/2, ac*10/12, exp*10/17, lvl=wLevel+25
         * 4: nMode=2 (Hell): maxhp*1/2, ac*10/12, exp*10/26, lvl=wLevel+50 */
        for (int c = 0; c < 5; c++) {
            setup_common_tables();
            U8(ARENA_MONSTATS + 0x00u * 0x1A8u + 0x4Cu) = (c == 2) ? 1u : 0u; /* bAlign */
            S16(ARENA_MONSTATS + 0x00u * 0x1A8u + 0xAAu) = 15; /* wLevel = 15 */
            U32(ARENA_UNIT0 + 0x00u) = 1u; /* monster */
            U32(ARENA_UNIT0 + 0x04u) = 0u;
            U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST0 + 0x24u) = ARENA_STATS0;
            U16(ARENA_STATLIST0 + 0x28u) = 4u;
            U16(ARENA_STATLIST0 + 0x2Au) = 4u;
            U32(ARENA_STATLIST0 + 0x48u) = ARENA_STATS1;
            U16(ARENA_STATLIST0 + 0x4Cu) = 4u;
            U16(ARENA_STATLIST0 + 0x4Eu) = 4u;
            U32(ARENA_STATS0 + 0x00u) = 0x00070000u; S32(ARENA_STATS0 + 0x04u) = 200;
            U32(ARENA_STATS0 + 0x08u) = 0x000C0000u; S32(ARENA_STATS0 + 0x0Cu) = 15;
            U32(ARENA_STATS0 + 0x10u) = 0x000D0000u; S32(ARENA_STATS0 + 0x14u) = 170;
            U32(ARENA_STATS0 + 0x18u) = 0x001F0000u; S32(ARENA_STATS0 + 0x1Cu) = 120;
            memcpy((void *)(uintptr_t)ARENA_STATS1, (const void *)(uintptr_t)ARENA_STATS0, 0x20u);

            uint32_t bExp = (c == 0) ? 1u : 0u;
            uint32_t nMode = (c == 1) ? 0u : (c == 4) ? 2u : 1u;
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u},
                {ARENA_MONSTATS, 0x1A8u}, {ARENA_ISC, 0x3000u},
                {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x40u}, {ARENA_STATS1, 0x40u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
            eax = safe_stdcall3(0x6FD6B1D0u, ARENA_UNIT0, bExp, nMode, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\",%u,%u", ARENA_UNIT0, bExp, nMode);
            emit_rec(fp, "0x6FD6B1D0", "MONSTERS_ApplyClassicConversionStats113c", c,
                c == 0 ? "expansion_noop" : c == 1 ? "mode0_noop" : c == 2 ? "align1_noop" : c == 3 ? "mode1_scales_stats" : "mode2_scales_stats",
                args, regs, 9, asserted, 0u, 0u);
        }
    }

    /* =========================================================================
     * #29 0x6FD82C10 STATES_SetMonsterSkillIconOnUnit113c
     * ========================================================================= */
    {
        /* 0: nSkillId = -1 -> early return (even with pUnit=0)
         * 1: nSkillId = 300 (>= count) -> early return
         * 2: creates new 0x80 sublist, sets 0x100 on pEx, sets stat 0xB2 = nSkillId
         * 3: reuses existing 0x80 sublist */
        for (int c = 0; c < 4; c++) {
            setup_common_tables();
            U32(ARENA_UNIT0 + 0x00u) = 1u;
            U32(ARENA_UNIT0 + 0x0Cu) = 0x55u;
            U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
            if (c == 3) {
                U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
                U32(ARENA_STATLIST1 + 0x10u) = 0x80u;
                U32(ARENA_STATLIST1 + 0x34u) = ARENA_STATLIST0;
            }
            uint32_t uArg = (c <= 1) ? 0u : ARENA_UNIT0;
            int32_t skId = (c == 0) ? -1 : (c == 1) ? 300 : (c == 2) ? 45 : 77;
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u},
                {ARENA_ISC + 0xB2u * 0x144u, 0x144u},
                {ARENA_UNIT0, 0xF0u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 7);
            eax = safe_stdcall3(0x6FD82C10u, uArg, (uint32_t)skId, 0u, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\",%d,0", uArg, skId);
            emit_rec(fp, "0x6FD82C10", "STATES_SetMonsterSkillIconOnUnit113c", c,
                c == 0 ? "neg_skill_noop" : c == 1 ? "oob_skill_noop" : c == 2 ? "allocs_0x80_sublist_and_sets_0xb2" : "reuses_0x80_sublist",
                args, regs, 7, asserted, 0u, 0u);
        }
    }

    /* =========================================================================
     * #30 0x6FD884B0 STATLIST_GetStatListFromUnitStateOrFlag113c
     * #31 0x6FD884F0 STATLIST_GetStatListFromUnitAndFlag113c
     * ========================================================================= */
    {
        for (int c = 0; c < 4; c++) {
            setup_common_tables();
            U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = (c == 0) ? 0u : 0x80000000u;
            U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST1 + 0x10u) = 0x40u;
            U32(ARENA_STATLIST1 + 0x14u) = 12u;
            U32(ARENA_STATLIST1 + 0x2Cu) = ARENA_STATLIST2;
            U32(ARENA_STATLIST2 + 0x10u) = 0x80u;
            U32(ARENA_STATLIST2 + 0x14u) = 0u;
            uint32_t nState = (c == 1) ? 12u : (c == 2) ? 0u : 99u;
            uint32_t dwFlags = 0x80u;
            mem_region_t regs[] = {
                {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}, {ARENA_STATLIST2, 0x80u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 4);
            eax = safe_stdcall3(0x6FD884B0u, ARENA_UNIT0, nState, dwFlags, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\",%u,%u", ARENA_UNIT0, nState, dwFlags);
            emit_rec(fp, "0x6FD884B0", "STATLIST_GetStatListFromUnitStateOrFlag113c", c,
                c == 0 ? "non_extended_zero" : c == 1 ? "by_state_12_hit" : c == 2 ? "state0_by_flag_0x80_hit" : "state_miss_zero",
                args, regs, 4, asserted, eax, 0xFFFFFFFFu);
        }
        for (int c = 0; c < 3; c++) {
            setup_common_tables();
            U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = (c == 0) ? 0u : 0x80000000u;
            U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST1 + 0x10u) = 0x80u;
            uint32_t dwFlags = (c == 1) ? 0x80u : 0x04u;
            mem_region_t regs[] = {
                {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
            eax = safe_stdcall2(0x6FD884F0u, ARENA_UNIT0, dwFlags, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\",%u", ARENA_UNIT0, dwFlags);
            emit_rec(fp, "0x6FD884F0", "STATLIST_GetStatListFromUnitAndFlag113c", c,
                c == 0 ? "non_extended_zero" : c == 1 ? "flag_0x80_hit" : "flag_0x04_miss",
                args, regs, 3, asserted, eax, 0xFFFFFFFFu);
        }
    }

    /* =========================================================================
     * #32 0x6FD89B60 STATLIST_UpdateUnitByTimeStats113c
     * ========================================================================= */
    {
        /* 0: null unit -> no-op
         * 1: non-player/monster (type 2) -> no-op
         * 2: item with op=6 (by-time) targeting stat 0 (strength) -> evaluates and updates unit full stat */
        for (int c = 0; c < 3; c++) {
            setup_common_tables();
            /* Stat 10 has bOp=6 (+0x54), wOpStats[0]=0 (+0x58), wOpStats[1]=0xFFFF (+0x5A) */
            U8(ARENA_ISC + 10u * 0x144u + 0x54u) = (c == 2) ? 6u : 1u;
            U16(ARENA_ISC + 10u * 0x144u + 0x58u) = 0u;
            U16(ARENA_ISC + 10u * 0x144u + 0x5Au) = 0xFFFFu;

            U32(ARENA_UNIT0 + 0x00u) = (c == 1) ? 2u : 0u;
            U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST0 + 0x24u) = ARENA_STATS0;
            U16(ARENA_STATLIST0 + 0x28u) = 1u;
            U16(ARENA_STATLIST0 + 0x2Au) = 4u;
            U32(ARENA_STATLIST0 + 0x48u) = ARENA_STATS0 + 0x20u;
            U16(ARENA_STATLIST0 + 0x4Cu) = 1u;
            U16(ARENA_STATLIST0 + 0x4Eu) = 4u;
            U32(ARENA_STATS0 + 0x00u) = 0x00000000u; S32(ARENA_STATS0 + 0x04u) = 55;
            U32(ARENA_STATS0 + 0x20u) = 0x00000000u; S32(ARENA_STATS0 + 0x24u) = 10;

            U32(ARENA_ITEM0 + 0x00u) = 4u;
            U32(ARENA_ITEM0 + 0x5Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST1 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST1 + 0x48u) = ARENA_STATS1;
            U16(ARENA_STATLIST1 + 0x4Cu) = 1u;
            U16(ARENA_STATLIST1 + 0x4Eu) = 4u;
            U32(ARENA_STATS1 + 0x00u) = 0x000A0000u; S32(ARENA_STATS1 + 0x04u) = 1;

            uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u},
                {ARENA_ISC, 0x1000u}, {ARENA_UNIT0, 0x80u}, {ARENA_ITEM0, 0x80u},
                {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}, {ARENA_STATS0, 0x40u}, {ARENA_STATS1, 0x40u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 10);
            eax = safe_stdcall2(0x6FD89B60u, uArg, ARENA_ITEM0, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", uArg, ARENA_ITEM0);
            emit_rec(fp, "0x6FD89B60", "STATLIST_UpdateUnitByTimeStats113c", c,
                c == 0 ? "null_unit_noop" : c == 1 ? "non_plr_mon_noop" : "op6_recomputes_target_stat0",
                args, regs, 10, asserted, 0u, 0u);
        }
    }

    /* =========================================================================
     * #33 0x6FD89CC0 STATLIST_GetUnitStatBonus113c
     * #34 0x6FD8A790 STATLIST_SetBaseStatExIfValid113c
     * ========================================================================= */
    {
        for (int c = 0; c < 3; c++) {
            setup_common_tables();
            U32(ARENA_UNIT0 + 0x5Cu) = (c == 0) ? 0u : ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = (c == 1) ? 0u : 0x80000000u;
            U32(ARENA_STATLIST0 + 0x24u) = ARENA_STATS0;
            U16(ARENA_STATLIST0 + 0x28u) = 1u;
            U16(ARENA_STATLIST0 + 0x2Au) = 4u;
            U32(ARENA_STATLIST0 + 0x48u) = ARENA_STATS1;
            U16(ARENA_STATLIST0 + 0x4Cu) = 1u;
            U16(ARENA_STATLIST0 + 0x4Eu) = 4u;
            U32(ARENA_STATS0 + 0x00u) = 0x00020000u; S32(ARENA_STATS0 + 0x04u) = 30;
            U32(ARENA_STATS1 + 0x00u) = 0x00020000u; S32(ARENA_STATS1 + 0x04u) = 45;
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u},
                {ARENA_ISC, 0x600u}, {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x40u}, {ARENA_STATS1, 0x40u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
            eax = safe_stdcall3(0x6FD89CC0u, ARENA_UNIT0, 2u, 0u, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\",2,0", ARENA_UNIT0);
            emit_rec(fp, "0x6FD89CC0", "STATLIST_GetUnitStatBonus113c", c,
                c == 0 ? "null_list_zero" : c == 1 ? "non_extended_zero" : "bonus_45_minus_30_eq_15",
                args, regs, 8, asserted, eax, 0xFFFFFFFFu);
        }
        for (int c = 0; c < 3; c++) {
            setup_common_tables();
            U32(ARENA_STATLIST0 + 0x24u) = ARENA_STATS0;
            U16(ARENA_STATLIST0 + 0x28u) = 1u;
            U16(ARENA_STATLIST0 + 0x2Au) = 4u;
            U32(ARENA_STATS0 + 0x00u) = 0x00020000u; S32(ARENA_STATS0 + 0x04u) = 10;
            uint32_t pList = (c == 0) ? 0u : ARENA_STATLIST0;
            int32_t newVal = (c == 1) ? 10 : 25;
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u},
                {ARENA_ISC, 0x600u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x40u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 6);
            eax = safe_stdcall5(0x6FD8A790u, pList, 2u, (uint32_t)newVal, 0u, 0u, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\",2,%d,0,\"0x00000000\"", pList, newVal);
            emit_rec(fp, "0x6FD8A790", "STATLIST_SetBaseStatExIfValid113c", c,
                c == 0 ? "null_list_zero" : c == 1 ? "unchanged_zero" : "changed_one",
                args, regs, 6, asserted, eax, 0xFFFFFFFFu);
        }
    }

    /* =========================================================================
     * #35 0x6FD8AB30 STATLIST_ClampUnitPoolStatsToMax113c
     * ========================================================================= */
    {
        /* 0: null unit -> no-op
         * 1: cur <= max on all 3 -> no-op
         * 2: stamina(10) > maxstamina(11), mana(8) > maxmana(9), hp(6) > maxhp(7) -> clamps all 3 */
        for (int c = 0; c < 3; c++) {
            setup_common_tables();
            U32(ARENA_UNIT0 + 0x00u) = 1u; /* monster */
            U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST0 + 0x24u) = ARENA_STATS0;
            U16(ARENA_STATLIST0 + 0x28u) = 6u;
            U16(ARENA_STATLIST0 + 0x2Au) = 8u;
            U32(ARENA_STATLIST0 + 0x48u) = ARENA_STATS1;
            U16(ARENA_STATLIST0 + 0x4Cu) = 6u;
            U16(ARENA_STATLIST0 + 0x4Eu) = 8u;
            int32_t curBonus = (c == 2) ? 500 : 0;
            U32(ARENA_STATS0 + 0x00u) = 0x00060000u; S32(ARENA_STATS0 + 0x04u) = 1000 + curBonus;
            U32(ARENA_STATS0 + 0x08u) = 0x00070000u; S32(ARENA_STATS0 + 0x0Cu) = 1000;
            U32(ARENA_STATS0 + 0x10u) = 0x00080000u; S32(ARENA_STATS0 + 0x14u) = 800 + curBonus;
            U32(ARENA_STATS0 + 0x18u) = 0x00090000u; S32(ARENA_STATS0 + 0x1Cu) = 800;
            U32(ARENA_STATS0 + 0x20u) = 0x000A0000u; S32(ARENA_STATS0 + 0x24u) = 600 + curBonus;
            U32(ARENA_STATS0 + 0x28u) = 0x000B0000u; S32(ARENA_STATS0 + 0x2Cu) = 600;
            memcpy((void *)(uintptr_t)ARENA_STATS1, (const void *)(uintptr_t)ARENA_STATS0, 0x30u);

            uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u},
                {ARENA_ISC, 0x1000u}, {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x40u}, {ARENA_STATS1, 0x40u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
            eax = safe_stdcall1(0x6FD8AB30u, uArg, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\"", uArg);
            emit_rec(fp, "0x6FD8AB30", "STATLIST_ClampUnitPoolStatsToMax113c", c,
                c == 0 ? "null_unit_noop" : c == 1 ? "at_max_noop" : "clamps_stamina_mana_hp_to_max",
                args, regs, 8, asserted, 0u, 0u);
        }
    }

    /* =========================================================================
     * #36 0x6FD8AC50 STATLIST_ClearMonsterSkillIconStatList113c
     * #37 0x6FD8AD40 STATLIST_FreeStatListIfNonExtended113c
     * #38 0x6FD8AD60 STATLIST_ExpireOrphanStateSubLists113c
     * #39 0x6FD8ADD0 STATLIST_ExpireTimedSubLists113c
     * ========================================================================= */
    {
        /* #36: 0=null, 1=clears_0x100_and_0x80_sublist_stats */
        for (int c = 0; c < 2; c++) {
            setup_common_tables();
            U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000100u;
            U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST1 + 0x10u) = 0x80u;
            U32(ARENA_STATLIST1 + 0x24u) = ARENA_STATS0;
            U16(ARENA_STATLIST1 + 0x28u) = 1u;
            U16(ARENA_STATLIST1 + 0x2Au) = 4u;
            U32(ARENA_STATLIST1 + 0x34u) = ARENA_STATLIST0;
            U32(ARENA_STATS0 + 0x00u) = 0x00B20000u; S32(ARENA_STATS0 + 0x04u) = 45;
            uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u},
                {ARENA_ISC + 0xB2u * 0x144u, 0x144u},
                {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}, {ARENA_STATS0, 0x40u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
            eax = safe_stdcall1(0x6FD8AC50u, uArg, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\"", uArg);
            emit_rec(fp, "0x6FD8AC50", "STATLIST_ClearMonsterSkillIconStatList113c", c,
                c == 0 ? "null_unit_noop" : "clears_0x100_and_sublist_stats",
                args, regs, 8, asserted, 0u, 0u);
        }

        /* #37: 0=null, 1=extended_not_freed, 2=non_extended_unlinked_and_freed */
        for (int c = 0; c < 3; c++) {
            setup_common_tables();
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST1 + 0x10u) = (c == 1) ? 0x80000000u : 0x00000040u;
            U32(ARENA_STATLIST1 + 0x34u) = ARENA_STATLIST0;
            uint32_t pList = (c == 0) ? 0u : ARENA_STATLIST1;
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u},
                {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 5);
            eax = safe_stdcall1(0x6FD8AD40u, pList, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\"", pList);
            emit_rec(fp, "0x6FD8AD40", "STATLIST_FreeStatListIfNonExtended113c", c,
                c == 0 ? "null_noop" : c == 1 ? "extended_preserved" : "non_extended_unlinked",
                args, regs, 5, asserted, 0u, 0u);
        }

        /* #38: 0=null, 1=item_or_0x181_or_masked_kept, 2=orphan_state_freed */
        for (int c = 0; c < 3; c++) {
            setup_common_tables();
            U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST0 + 0x58u) = ARENA_STATEFLAGS0;
            U32(ARENA_STATLIST1 + 0x08u) = (c == 1) ? 4u : 0u; /* 4=item kept, 0=player */
            U32(ARENA_STATLIST1 + 0x10u) = 0u;
            U32(ARENA_STATLIST1 + 0x14u) = 5u;
            U32(ARENA_STATLIST1 + 0x2Cu) = ARENA_STATLIST2;
            U32(ARENA_STATLIST1 + 0x34u) = ARENA_STATLIST0;
            U32(ARENA_STATLIST2 + 0x08u) = 0u;
            U32(ARENA_STATLIST2 + 0x10u) = 0x80u; /* 0x80 & 0x181 != 0 -> kept */
            U32(ARENA_STATLIST2 + 0x14u) = 6u;
            U32(ARENA_STATLIST2 + 0x30u) = ARENA_STATLIST1;
            U32(ARENA_STATLIST2 + 0x34u) = ARENA_STATLIST0;
            uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u}, {ARENA_STATEMASKS, 0x3C0u},
                {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}, {ARENA_STATLIST2, 0x80u},
                {ARENA_STATEFLAGS0, 0x40u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
            eax = safe_stdcall1(0x6FD8AD60u, uArg, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\"", uArg);
            emit_rec(fp, "0x6FD8AD60", "STATLIST_ExpireOrphanStateSubLists113c", c,
                c == 0 ? "null_noop" : c == 1 ? "item_and_0x80_kept" : "orphan_sublist1_freed",
                args, regs, 9, asserted, 0u, 0u);
        }

        /* #39: 0=null, 1=nFrame_10_expires_le10_keeps_gt10, 2=nFrame_0_decrements_and_expires_le0 */
        for (int c = 0; c < 3; c++) {
            setup_common_tables();
            U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST1 + 0x10u) = 0x02u; /* timed */
            U32(ARENA_STATLIST1 + 0x18u) = (c == 1) ? 10u : 1u; /* expires */
            U32(ARENA_STATLIST1 + 0x2Cu) = ARENA_STATLIST2;
            U32(ARENA_STATLIST1 + 0x34u) = ARENA_STATLIST0;
            U32(ARENA_STATLIST2 + 0x10u) = 0x02u; /* timed */
            U32(ARENA_STATLIST2 + 0x18u) = (c == 1) ? 11u : 2u; /* survives (decrements to 1 when nFrame==0) */
            U32(ARENA_STATLIST2 + 0x30u) = ARENA_STATLIST1;
            U32(ARENA_STATLIST2 + 0x34u) = ARENA_STATLIST0;
            uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
            uint32_t nFrame = (c == 1) ? 10u : 0u;
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4u}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC70u},
                {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}, {ARENA_STATLIST2, 0x80u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 7);
            eax = safe_stdcall2(0x6FD8ADD0u, uArg, nFrame, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\",%u", uArg, nFrame);
            emit_rec(fp, "0x6FD8ADD0", "STATLIST_ExpireTimedSubLists113c", c,
                c == 0 ? "null_noop" : c == 1 ? "frame10_expires_le10" : "frame0_decrements_and_expires",
                args, regs, 7, asserted, 0u, 0u);
        }
    }
}

int main(int argc, char **argv) {
    g_arena = (uint8_t *)VirtualAlloc((LPVOID)ARENA_BASE, ARENA_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
    if (!g_arena || (uintptr_t)g_arena != ARENA_BASE) {
        fprintf(stderr, "Failed to allocate arena at 0x%08X\n", ARENA_BASE);
        return 1;
    }
    g_cb_page = (uint8_t *)VirtualAlloc((LPVOID)CB_BASE, CB_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
    if (!g_cb_page || (uintptr_t)g_cb_page != CB_BASE) {
        fprintf(stderr, "Failed to allocate cb_page at 0x%08X\n", CB_BASE);
        return 1;
    }
    g_heap = (uint8_t *)VirtualAlloc((LPVOID)HEAP_BASE, HEAP_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
    if (!g_heap || (uintptr_t)g_heap != HEAP_BASE) {
        fprintf(stderr, "Failed to allocate heap at 0x%08X\n", HEAP_BASE);
        return 1;
    }
    init_cb_trampolines();

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

    const char *i10a1_path = (argc > 1) ? argv[1] : "i10a-1-vectors.ndjson";
    const char *i10a2_path = (argc > 2) ? argv[2] : "i10a-2-vectors.ndjson";

    FILE *fp1 = fopen(i10a1_path, "wb");
    if (!fp1) return 1;
    emit_i10a_1(fp1);
    fclose(fp1);

    FILE *fp2 = fopen(i10a2_path, "wb");
    if (!fp2) return 1;
    emit_i10a_2(fp2);
    fclose(fp2);

    TerminateProcess(GetCurrentProcess(), 0);
    return 0;
}
