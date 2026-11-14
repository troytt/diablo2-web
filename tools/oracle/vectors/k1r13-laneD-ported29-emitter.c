/*
 * k1r13-laneD-ported29-emitter.c
 *
 * Real-DLL Wine differential vector emitter for Iteration 14 Lane D:
 * Promotes all 29 remaining "ported" D2Common.dll v1.13c functions (loaded at
 * preferred image base 0x6FD50000) to "diff-verified" -> k1r13-i14d-1.ndjson.
 *
 * Inline-assembly rule: Register constraints ONLY (0 "m", "g", or "o").
 * Compiles cleanly with -Wall -Wextra -Werror under -O2, -O2 -fno-omit-frame-pointer,
 * and -O2 -ffloat-store -fexcess-precision=standard with bit-for-bit identical SHA-256.
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
#define ARENA_BITMASKS       (ARENA_BASE + 0x0E00u)
#define ARENA_INVBITMASKS    (ARENA_BASE + 0x0F00u)
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
#define ARENA_SKINFO0        (ARENA_BASE + 0x2300u)
#define ARENA_SKILL0         (ARENA_BASE + 0x2400u)
#define ARENA_SKILL1         (ARENA_BASE + 0x2500u)
#define ARENA_GRIDS0         (ARENA_BASE + 0x2600u)
#define ARENA_QUESTREC       (ARENA_BASE + 0x2800u)
#define ARENA_CELLS0         (ARENA_BASE + 0x2A00u)
#define ARENA_CELLS1         (ARENA_BASE + 0x2C00u)
#define ARENA_CELLS2         (ARENA_BASE + 0x2E00u)
#define ARENA_PLRDATA0       (ARENA_BASE + 0x3000u)
#define ARENA_STATLIST0      (ARENA_BASE + 0x3200u)
#define ARENA_STATLIST1      (ARENA_BASE + 0x3400u)
#define ARENA_STATLIST2      (ARENA_BASE + 0x3600u)
#define ARENA_STATS0         (ARENA_BASE + 0x3800u)
#define ARENA_STATS1         (ARENA_BASE + 0x3A00u)
#define ARENA_STATS2         (ARENA_BASE + 0x3B00u)
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
#define ARENA_ROOMEX0        (ARENA_BASE + 0x4800u)
#define ARENA_LEVEL0         (ARENA_BASE + 0x4A00u)
#define ARENA_TILEGRID0      (ARENA_BASE + 0x4D00u)
#define ARENA_FLOORS0        (ARENA_BASE + 0x4E00u)
#define ARENA_LIBF0          (ARENA_BASE + 0x4F00u)
#define ARENA_COORDS0        (ARENA_BASE + 0x5000u)
#define ARENA_NEAREX0        (ARENA_BASE + 0x5100u)
#define ARENA_STR            (ARENA_BASE + 0x5200u)
#define ARENA_STATEFLAGS0    (ARENA_BASE + 0x5600u)
#define ARENA_OUT            (ARENA_BASE + 0x5C00u)
#define ARENA_OUT2           (ARENA_BASE + 0x5D00u)
#define ARENA_OUT3           (ARENA_BASE + 0x5E00u)
#define ARENA_OBJDATA0       (ARENA_BASE + 0x6000u)
#define ARENA_OBJTXT0        (ARENA_BASE + 0x6100u)
#define ARENA_ITYPEMAT       (ARENA_BASE + 0x6400u)
#define ARENA_NPCTXT         (ARENA_BASE + 0x7000u)
#define ARENA_GEMS           (ARENA_BASE + 0x7400u)
#define ARENA_RUNES          (ARENA_BASE + 0x7A00u)
#define ARENA_QUAL           (ARENA_BASE + 0x8000u)
#define ARENA_ACT0           (ARENA_BASE + 0x9A00u)
#define ARENA_CB0            (ARENA_BASE + 0xA000u)
#define ARENA_CB1            (ARENA_BASE + 0xA040u)
#define ARENA_CB2            (ARENA_BASE + 0xA080u)
#define ARENA_CB3            (ARENA_BASE + 0xA0C0u)
#define ARENA_CB4            (ARENA_BASE + 0xA100u)
#define ARENA_CB5            (ARENA_BASE + 0xA180u)
#define ARENA_CB6            (ARENA_BASE + 0xA1C0u)
#define ARENA_STATESTXT      (ARENA_BASE + 0xB000u)
#define ARENA_STATEMASKS     (ARENA_BASE + 0xDF00u)
#define ARENA_MAGICAFFIX     (ARENA_BASE + 0xE800u)
#define ARENA_ISC            (ARENA_BASE + 0x10000u)
#define ARENA_ITEMSTXT       (ARENA_BASE + 0x30000u)
#define ARENA_ITEMTYPES      (ARENA_BASE + 0x38000u)
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
static uint32_t g_d2c_nul_fp = 0;

static uint32_t g_orig_iat_assert  = 0;
static uint32_t g_orig_iat_alloc   = 0;
static uint32_t g_orig_iat_free    = 0;
static uint32_t g_orig_iat_free2   = 0;
static uint32_t g_orig_iat_realloc = 0;

typedef struct {
    uint32_t addr;
    uint32_t size;
} HeapRec;

static HeapRec g_heap_recs[256];
static int g_num_heap_recs = 0;

static void __cdecl stub_fog_assert_line(uint32_t line) {
    g_assert_line = line;
    if (g_in_test_call) {
        g_in_test_call = 0;
        longjmp(g_jmp_buf, 1);
    }
}

static uint32_t bump_heap(uint32_t size) {
    if (size == 0u) return 0u;
    uint32_t p = (g_heap_top + 3u) & ~3u;
    memset((void *)(uintptr_t)p, 0, size);
    g_heap_top = p + size;
    if (g_num_heap_recs < 256) {
        g_heap_recs[g_num_heap_recs].addr = p;
        g_heap_recs[g_num_heap_recs].size = size;
        g_num_heap_recs++;
    }
    return p;
}

static uint32_t __fastcall stub_fog_10045(
    uint32_t pMemPool, uint32_t size, const char *szFile, uint32_t nLine, uint32_t u0) {
    (void)pMemPool; (void)szFile; (void)nLine; (void)u0;
    return bump_heap(size);
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
    uint32_t p = bump_heap(newSize);
    if (pOld != 0u && p != 0u) {
        uint32_t oldSz = newSize;
        for (int i = 0; i < g_num_heap_recs; i++) {
            if (g_heap_recs[i].addr == pOld) {
                oldSz = g_heap_recs[i].size;
                break;
            }
        }
        uint32_t cp = (oldSz < newSize) ? oldSz : newSize;
        memcpy((void *)(uintptr_t)p, (const void *)(uintptr_t)pOld, cp);
    }
    return p;
}

static void install_iat_hooks(void) {
    U32(0x6FDD90D4u) = (uint32_t)(uintptr_t)&stub_fog_assert_line;
    U32(0x6FDD90D0u) = (uint32_t)(uintptr_t)&stub_fog_10045;
    U32(0x6FDD90CCu) = (uint32_t)(uintptr_t)&stub_fog_10046;
    U32(0x6FDD90A8u) = (uint32_t)(uintptr_t)&stub_fog_10046;
    U32(0x6FDD90ACu) = (uint32_t)(uintptr_t)&stub_fog_10047;
}

static void restore_iat_hooks(void) {
    U32(0x6FDD90D4u) = g_orig_iat_assert;
    U32(0x6FDD90D0u) = g_orig_iat_alloc;
    U32(0x6FDD90CCu) = g_orig_iat_free;
    U32(0x6FDD90A8u) = g_orig_iat_free2;
    U32(0x6FDD90ACu) = g_orig_iat_realloc;
}

typedef uint32_t (__stdcall *stdcall1_t)(uint32_t);
typedef uint32_t (__stdcall *stdcall2_t)(uint32_t, uint32_t);
typedef uint32_t (__stdcall *stdcall3_t)(uint32_t, uint32_t, uint32_t);
typedef uint32_t (__stdcall *stdcall4_t)(uint32_t, uint32_t, uint32_t, uint32_t);
typedef uint32_t (__stdcall *stdcall5_t)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
typedef uint32_t (__stdcall *stdcall6_t)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
typedef void     (__cdecl   *cdecl9_t)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);

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

/* Custom usercall: eax = eax_val, ebx = ebx_val, [esp+4] = s0, ret 4 (0x6FD6E1B0) */
static __attribute__((noinline)) uint32_t call_eax_ebx_stack1(
    uint32_t fn, uint32_t eax_val, uint32_t ebx_val, uint32_t s0) {
    g_pkt.fn = fn;
    g_pkt.r_eax = eax_val;
    g_pkt.r_ebx = ebx_val;
    g_pkt.s[0] = s0;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "pushl %%ebx\n\t"
        "pushl 28(%0)\n\t"
        "movl 4(%0), %%eax\n\t"
        "movl 16(%0), %%ebx\n\t"
        "movl 0(%0), %%ecx\n\t"
        "call *%%ecx\n\t"
        "movl %%eax, 68(%0)\n\t"
        "popl %%ebx\n\t"
        : "+S"(base)
        :
        : "eax", "ecx", "edx", "edi", "cc", "memory"
    );
    return g_pkt.ret;
}

/* Custom usercall: eax = eax_val, ecx = ecx_val, [esp+4]=s0, [esp+8]=s1, ret 8 (0x6FD882F0) */
static __attribute__((noinline)) uint32_t call_eax_ecx_stack2(
    uint32_t fn, uint32_t eax_val, uint32_t ecx_val, uint32_t s0, uint32_t s1) {
    g_pkt.fn = fn;
    g_pkt.r_eax = eax_val;
    g_pkt.r_ecx = ecx_val;
    g_pkt.s[0] = s0;
    g_pkt.s[1] = s1;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "pushl 32(%0)\n\t"
        "pushl 28(%0)\n\t"
        "movl 4(%0), %%eax\n\t"
        "movl 8(%0), %%ecx\n\t"
        "movl 0(%0), %%edx\n\t"
        "call *%%edx\n\t"
        "movl %%eax, 68(%0)\n\t"
        : "+b"(base)
        :
        : "eax", "ecx", "edx", "esi", "edi", "cc", "memory"
    );
    return g_pkt.ret;
}

/* Custom usercall: ebx = ebx_val, [esp+4..0x10] = s0..s3, ret 0x10 (0x6FD88940) */
static __attribute__((noinline)) uint32_t call_ebx_stack4(
    uint32_t fn, uint32_t ebx_val, uint32_t s0, uint32_t s1, uint32_t s2, uint32_t s3) {
    g_pkt.fn = fn;
    g_pkt.r_ebx = ebx_val;
    g_pkt.s[0] = s0;
    g_pkt.s[1] = s1;
    g_pkt.s[2] = s2;
    g_pkt.s[3] = s3;
    volatile CallPkt *base = &g_pkt;
    __asm__ volatile (
        "pushl %%ebx\n\t"
        "pushl 40(%0)\n\t"
        "pushl 36(%0)\n\t"
        "pushl 32(%0)\n\t"
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
static __attribute__((noinline)) uint32_t safe_eax_ebx_stack1(uint32_t va, uint32_t eax_v, uint32_t ebx_v, uint32_t s0, int *pAsserted) {
    SAFE_BODY(call_eax_ebx_stack1(va, eax_v, ebx_v, s0));
}
static __attribute__((noinline)) uint32_t safe_eax_ecx_stack2(uint32_t va, uint32_t eax_v, uint32_t ecx_v, uint32_t s0, uint32_t s1, int *pAsserted) {
    SAFE_BODY(call_eax_ecx_stack2(va, eax_v, ecx_v, s0, s1));
}
static __attribute__((noinline)) uint32_t safe_ebx_stack4(uint32_t va, uint32_t ebx_v, uint32_t s0, uint32_t s1, uint32_t s2, uint32_t s3, int *pAsserted) {
    SAFE_BODY(call_ebx_stack4(va, ebx_v, s0, s1, s2, s3));
}
static __attribute__((noinline)) void safe_cdecl9_void(
    uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3,
    uint32_t a4, uint32_t a5, uint32_t a6, uint32_t a7, uint32_t a8, int *pAsserted) {
    int * volatile out = pAsserted;
    g_assert_line = 0u;
    install_iat_hooks();
    if (setjmp(g_jmp_buf) == 0) {
        g_in_test_call = 1;
        ((cdecl9_t)(uintptr_t)va)(a0, a1, a2, a3, a4, a5, a6, a7, a8);
        g_in_test_call = 0;
        *out = 0;
    } else {
        *out = 1;
    }
    restore_iat_hooks();
}

typedef struct {
    uint32_t base;
    uint32_t len;
} mem_region_t;

static char g_pre_buf[1048576];

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
        uint32_t hlen = (g_heap_top - HEAP_BASE + 3u) & ~3u;
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
        fflush(fp);
    } else {
        uint32_t masked_eax = (ret_mask != 0u) ? (ret_eax & ret_mask) : 0u;
        fprintf(fp,
            "{\"va\":\"%s\",\"name\":\"%s\",\"caseIndex\":%d,\"note\":\"%s\","
            "\"inputs\":{\"args\":[%s],\"memory\":%s},"
            "\"outputs\":{\"eax\":\"0x%08X\",\"retMask\":\"0x%08X\",\"memory\":",
            va, name, case_idx, note, args_json, g_pre_buf, masked_eax, ret_mask);
        emit_regions_json(fp, regions, reg_count);
        fputs("}}\n", fp);
        fflush(fp);
    }
}

static void put_u32_le(uint8_t *dst, uint32_t v) {
    dst[0] = (uint8_t)(v & 0xFFu);
    dst[1] = (uint8_t)((v >> 8) & 0xFFu);
    dst[2] = (uint8_t)((v >> 16) & 0xFFu);
    dst[3] = (uint8_t)((v >> 24) & 0xFFu);
}

static void setup_cb_stubs(void) {
    /* ARENA_CB0 (0x6FD62330): __fastcall(ecx=cand, edx=u) -> cand->dwClassId != 99 */
    {
        static const uint8_t cb0[] = {
            0x8B, 0x41, 0x04, 0x83, 0xF8, 0x63, 0x0F, 0x95, 0xC0, 0x0F, 0xB6, 0xC0, 0xC3
        };
        memcpy((void *)(uintptr_t)ARENA_CB0, cb0, sizeof(cb0));
    }
    /* ARENA_CB1 (0x6FD624E0): __fastcall(ecx=cand, edx=search) -> cand->dwClassId == 77 (1 = reject) */
    {
        static const uint8_t cb1[] = {
            0x8B, 0x41, 0x04, 0x83, 0xF8, 0x4D, 0x0F, 0x94, 0xC0, 0x0F, 0xB6, 0xC0, 0xC3
        };
        memcpy((void *)(uintptr_t)ARENA_CB1, cb1, sizeof(cb1));
    }
    /* ARENA_CB2 (0x6FD7A210): __fastcall(ecx=pContext, edx=pItem, [esp+4]=pUnit), ret 4 */
    {
        uint8_t *p = (uint8_t *)(uintptr_t)ARENA_CB2;
        int i = 0;
        p[i++] = 0xA1; put_u32_le(p + i, ARENA_OUT); i += 4;          /* mov eax, ds:[ARENA_OUT] */
        p[i++] = 0x6B; p[i++] = 0xC0; p[i++] = 0x0C;                  /* imul eax, eax, 12 */
        p[i++] = 0x89; p[i++] = 0x88; put_u32_le(p + i, ARENA_OUT + 4u); i += 4;
        p[i++] = 0x89; p[i++] = 0x90; put_u32_le(p + i, ARENA_OUT + 8u); i += 4;
        p[i++] = 0x53;                                                /* push ebx */
        p[i++] = 0x8B; p[i++] = 0x5C; p[i++] = 0x24; p[i++] = 0x08;   /* mov ebx, [esp+8] */
        p[i++] = 0x89; p[i++] = 0x98; put_u32_le(p + i, ARENA_OUT + 12u); i += 4;
        p[i++] = 0x5B;                                                /* pop ebx */
        p[i++] = 0xFF; p[i++] = 0x05; put_u32_le(p + i, ARENA_OUT); i += 4;
        p[i++] = 0xC2; p[i++] = 0x04; p[i++] = 0x00;                  /* ret 4 */
    }
    /* ARENA_CB3 (0x6FD88850 & 0x6FD888E0): __fastcall(ecx=pUnit, edx=nStatId, [esp+4]=nVal, [esp+8]=pArg), ret 8 */
    {
        static const uint8_t cb3[] = {
            0x53,                         /* push ebx */
            0x8B, 0x44, 0x24, 0x0C,       /* mov eax, [esp+0x0C] (pArg) */
            0x8B, 0x18,                   /* mov ebx, [eax]      (nCalls) */
            0x6B, 0xDB, 0x0C,             /* imul ebx, ebx, 12 */
            0x01, 0xC3,                   /* add ebx, eax */
            0x89, 0x4B, 0x04,             /* mov [ebx+4], ecx    (pUnit) */
            0x89, 0x53, 0x08,             /* mov [ebx+8], edx    (nStatId) */
            0x8B, 0x4C, 0x24, 0x08,       /* mov ecx, [esp+8]    (nVal) */
            0x89, 0x4B, 0x0C,             /* mov [ebx+12], ecx */
            0xFF, 0x00,                   /* inc dword ptr [eax] */
            0x5B,                         /* pop ebx */
            0xC2, 0x08, 0x00              /* ret 8 */
        };
        memcpy((void *)(uintptr_t)ARENA_CB3, cb3, sizeof(cb3));
    }
    /* ARENA_CB4 (0x6FD88940): __fastcall(ecx=pGame, edx=pOwner, [esp+4..0x10]=pUnit,dwKey,oldVal,newVal), ret 0x10 */
    {
        uint8_t *p = (uint8_t *)(uintptr_t)ARENA_CB4;
        int i = 0;
        p[i++] = 0xC7; p[i++] = 0x05; put_u32_le(p + i, ARENA_OUT); i += 4; put_u32_le(p + i, 1u); i += 4;
        p[i++] = 0x89; p[i++] = 0x0D; put_u32_le(p + i, ARENA_OUT + 4u); i += 4;
        p[i++] = 0x89; p[i++] = 0x15; put_u32_le(p + i, ARENA_OUT + 8u); i += 4;
        for (uint32_t k = 0; k < 4u; k++) {
            p[i++] = 0x8B; p[i++] = 0x44; p[i++] = 0x24; p[i++] = (uint8_t)(4u + k * 4u);
            p[i++] = 0xA3; put_u32_le(p + i, ARENA_OUT + 12u + k * 4u); i += 4;
        }
        p[i++] = 0xC2; p[i++] = 0x10; p[i++] = 0x00;
    }
    /* ARENA_CB5 (0x6FD8C720): __fastcall(ecx=pRoom), ret */
    {
        uint8_t *p = (uint8_t *)(uintptr_t)ARENA_CB5;
        int i = 0;
        p[i++] = 0x89; p[i++] = 0x0D; put_u32_le(p + i, ARENA_OUT); i += 4;
        p[i++] = 0x8B; p[i++] = 0x41; p[i++] = 0x6C;
        p[i++] = 0xA3; put_u32_le(p + i, ARENA_OUT + 4u); i += 4;
        p[i++] = 0xC3;
    }
    /* ARENA_CB6 (0x6FDCF6A0): __fastcall(ecx=pUnit, edx=pContext) -> (pUnit->dwUnitId == pContext), ret */
    {
        uint8_t *p = (uint8_t *)(uintptr_t)ARENA_CB6;
        int i = 0;
        p[i++] = 0xFF; p[i++] = 0x05; put_u32_le(p + i, ARENA_OUT); i += 4;
        p[i++] = 0x8B; p[i++] = 0x41; p[i++] = 0x0C;
        p[i++] = 0x3B; p[i++] = 0xC2;
        p[i++] = 0x0F; p[i++] = 0x94; p[i++] = 0xC0;
        p[i++] = 0x0F; p[i++] = 0xB6; p[i++] = 0xC0;
        p[i++] = 0xC3;
    }
    FlushInstructionCache(GetCurrentProcess(), (const void *)(uintptr_t)ARENA_CB0, 0x200u);
}

static void init_isc_default(uint32_t stat_id) {
    uint32_t rec = ARENA_ISC + stat_id * 0x144u;
    U16(rec + 0x00u) = (uint16_t)stat_id;
    U8(rec + 0x19u) = 8u;
    U16(rec + 0x58u) = 0xFFFFu;
    U16(rec + 0x5Au) = 0xFFFFu;
    U16(rec + 0x5Cu) = 0xFFFFu;
    for (uint32_t j = 0u; j < 64u; j++) {
        U16(rec + 0x5Eu + j * 2u) = 0xFFFFu;
    }
    for (uint32_t j = 0u; j < 16u; j++) {
        U16(rec + 0xDEu + j * 6u) = 0xFFFFu;
    }
}

static void set_itype_equiv(uint32_t t, uint32_t eq) {
    uint32_t addr = ARENA_ITYPEMAT + (t * 3u + (eq >> 5)) * 4u;
    U32(addr) = U32(addr) | (1u << (eq & 31u));
}

static void setup_common_tables(void) {
    memset(g_arena, 0, ARENA_SIZE);
    memset(g_heap, 0, 0x20000u);
    g_heap_top = HEAP_BASE;
    g_num_heap_recs = 0;

    for (uint32_t b = 0; b < 32u; b++) {
        U32(ARENA_BITMASKS + b * 4u) = (1u << b);
        U32(ARENA_INVBITMASKS + b * 4u) = ~(1u << b);
    }
    U32(0x6FDD90B0u) = ARENA_BITMASKS;
    U32(0x6FDD9078u) = ARENA_INVBITMASKS;

    setup_cb_stubs();

    U32(0x6FDE9E1Cu) = ARENA_SGPT;
    U32(ARENA_SGPT + 0x0BCu) = ARENA_STATESTXT;
    U32(ARENA_SGPT + 0x0C4u) = 185u;
    for (uint32_t m = 0; m < 40u; m++) {
        U32(ARENA_SGPT + 0x0CCu + m * 4u) = ARENA_STATEMASKS + m * 24u;
    }
    U32(ARENA_SGPT + 0xA78u) = ARENA_MONSTATS;
    U32(ARENA_SGPT + 0xA80u) = 32u;
    U32(ARENA_SGPT + 0xA90u) = ARENA_MONSTATS2;
    U32(ARENA_SGPT + 0xA98u) = 32u;
    U32(ARENA_SGPT + 0xB64u) = ARENA_MISSILESTXT;
    U32(ARENA_SGPT + 0xB6Cu) = 16u;
    U32(ARENA_SGPT + 0xB98u) = ARENA_SKILLSTXT;
    U32(ARENA_SGPT + 0xBA0u) = 16u;
    U32(ARENA_SGPT + 0xBCCu) = ARENA_ISC;
    U32(ARENA_SGPT + 0xBD4u) = 359u;
    U32(ARENA_SGPT + 0xBF8u) = ARENA_ITEMTYPES;
    U32(ARENA_SGPT + 0xBFCu) = 96u;
    U32(ARENA_SGPT + 0xC00u) = 3u;
    U32(ARENA_SGPT + 0xC04u) = ARENA_ITYPEMAT;
    U32(ARENA_SGPT + 0xC0Cu) = ARENA_SETSTXT;
    U32(ARENA_SGPT + 0xC10u) = 4u;
    U32(ARENA_SGPT + 0xC18u) = ARENA_SETITEMSTXT;
    U32(ARENA_SGPT + 0xC1Cu) = 4u;
    U32(ARENA_SGPT + 0xC24u) = ARENA_UNIQUEITEMSTXT;
    U32(ARENA_SGPT + 0xC28u) = 4u;

    U32(0x6FDF0950u) = ARENA_MONSTATS;
    U32(0x6FDF0954u) = ARENA_MONSTATS2;
    U32(0x6FDF0958u) = 32u;

    U32(0x6FDEFB94u) = 16u;
    U32(0x6FDEFB98u) = ARENA_ITEMSTXT;
    U32(0x6FDEFF6Cu) = ARENA_ITEMSLINK;

    U32(0x6FDEFBB8u) = 16u;
    U32(0x6FDEFBBCu) = ARENA_MAGICAFFIX;
    U32(0x6FDEFBC4u) = ARENA_MAGICAFFIX + 8u * 0x90u;
    U32(0x6FDEFBC8u) = ARENA_MAGICAFFIX + 12u * 0x90u;
    U32(0x6FDEFBCCu) = 4u;
    U32(0x6FDEFBD0u) = ARENA_GEMS;
    U32(0x6FDEFBD4u) = 2u;
    U32(0x6FDEFBD8u) = ARENA_RUNES;
    U32(0x6FDEFDA0u) = 2u;
    U32(0x6FDEFDA4u) = ARENA_QUAL;
    U32(0x6FDF0880u) = ARENA_NPCTXT;
    U32(0x6FDF0884u) = 2u;

    /* Grid 0 def at 0x6FDED378 = 13 x 1 */
    U8(0x6FDED378u + 0u) = 13u;
    U8(0x6FDED378u + 1u) = 1u;

    /* Weapon class code table at 0x6FDEF020..0x6FDEF060 */
    U32(0x6FDEF020u) = 6u;
    U32(0x6FDEF028u + 0u * 8u + 0u) = 0x20687468u; U16(0x6FDEF028u + 0u * 8u + 4u) = 0u;  /* 'hth ' */
    U32(0x6FDEF028u + 1u * 8u + 0u) = 0x20776F62u; U16(0x6FDEF028u + 1u * 8u + 4u) = 1u;  /* 'bow ' */
    U32(0x6FDEF028u + 2u * 8u + 0u) = 0x20736831u; U16(0x6FDEF028u + 2u * 8u + 4u) = 2u;  /* '1hs ' */
    U32(0x6FDEF028u + 3u * 8u + 0u) = 0x20746831u; U16(0x6FDEF028u + 3u * 8u + 4u) = 3u;  /* '1ht ' */
    U32(0x6FDEF028u + 4u * 8u + 0u) = 0x20736832u; U16(0x6FDEF028u + 4u * 8u + 4u) = 5u;  /* '2hs ' */
    U32(0x6FDEF028u + 5u * 8u + 0u) = 0x20317468u; U16(0x6FDEF028u + 5u * 8u + 4u) = 12u; /* 'ht1 ' */

    /* ItemTypes:
     * 0x1E (30): 1H sword (repair=1, equiv={0x1E, 0x2D})
     * 0x1B (27): Bow (repair=1, equiv={0x1B, 0x2D})
     * 0x25 (37): Helm/Armor (repair=1, equiv={0x25, 0x32})
     * 0x2C (44): Throwing knife (repair=1, nThrows=1, equiv={0x2C, 0x2D, 0x30})
     * 0x33 (51): Shield (repair=1, equiv={0x33, 0x32})
     */
    U8(ARENA_ITEMTYPES + 0x1Eu * 0xE4u + 0x08u) = 1u;
    U8(ARENA_ITEMTYPES + 0x1Eu * 0xE4u + 0x14u) = 1u;
    U8(ARENA_ITEMTYPES + 0x1Eu * 0xE4u + 0x15u) = 1u;
    set_itype_equiv(0x1Eu, 0x1Eu);
    set_itype_equiv(0x1Eu, 0x2Du);

    U8(ARENA_ITEMTYPES + 0x1Bu * 0xE4u + 0x08u) = 1u;
    set_itype_equiv(0x1Bu, 0x1Bu);
    set_itype_equiv(0x1Bu, 0x2Du);

    U8(ARENA_ITEMTYPES + 0x25u * 0xE4u + 0x08u) = 1u;
    U8(ARENA_ITEMTYPES + 0x25u * 0xE4u + 0x09u) = 1u;
    U8(ARENA_ITEMTYPES + 0x25u * 0xE4u + 0x0Au) = 3u;
    set_itype_equiv(0x25u, 0x25u);
    set_itype_equiv(0x25u, 0x32u);

    U8(ARENA_ITEMTYPES + 0x2Cu * 0xE4u + 0x08u) = 1u;
    U8(ARENA_ITEMTYPES + 0x2Cu * 0xE4u + 0x10u) = 1u; /* nThrows = 1 */
    set_itype_equiv(0x2Cu, 0x2Cu);
    set_itype_equiv(0x2Cu, 0x2Du);
    set_itype_equiv(0x2Cu, 0x30u);

    U8(ARENA_ITEMTYPES + 0x33u * 0xE4u + 0x08u) = 1u;
    set_itype_equiv(0x33u, 0x33u);
    set_itype_equiv(0x33u, 0x32u);

    /* ItemsTxt rows (stride 0x1A8):
     * 0: 1H sword ('1hs ', type0=0x1E, wStr=100, wDex=50, cost=500)
     * 1: Throwing knife ('1th ', type0=0x2C, wStr=75, wDex=75, stackable=1, cost=400)
     * 2: Bow ('bow ', type0=0x1B, wStr=1 -> defaults 100, wDex=100, bComponent=5)
     * 3: Armor ('arm ', type0=0x25, wStr=0, wDex=0, cost=800)
     * 4: Hybrid item (type0=0x33 shield, type1=0x25 helm -> bit 5 = 0x20, wStr=1, wDex=1)
     * 5: Claw ('ht1 ', type0=0x1E, wclass='ht1 '=12)
     */
    {
        uint32_t r0 = ARENA_ITEMSTXT + 0u * 0x1A8u;
        U32(r0 + 0x80u) = 0x20736831u;
        U32(r0 + 0xC0u) = 0x20736831u;
        U32(r0 + 0xE0u) = 500u;
        U32(r0 + 0xE4u) = 2500u;
        U16(r0 + 0x106u) = 110u; /* wStrBonus */
        U16(r0 + 0x108u) = 50u;  /* wDexBonus */
        U8(r0 + 0x10Fu) = 1u; U8(r0 + 0x110u) = 3u;
        U8(r0 + 0x112u) = 1u;
        U8(r0 + 0x115u) = 5u;
        U16(r0 + 0x11Eu) = 0x1Eu;
        U8(r0 + 0x12Au) = 0xFFu;
    }
    {
        uint32_t r1 = ARENA_ITEMSTXT + 1u * 0x1A8u;
        U32(r1 + 0x80u) = 0x20746831u;
        U32(r1 + 0xC0u) = 0x20746831u;
        U32(r1 + 0xE0u) = 400u;
        U32(r1 + 0xE8u) = 120u;
        U16(r1 + 0x106u) = 75u;
        U16(r1 + 0x108u) = 75u;
        U8(r1 + 0x10Fu) = 1u; U8(r1 + 0x110u) = 2u;
        U8(r1 + 0x112u) = 1u;
        U8(r1 + 0x115u) = 5u;
        U16(r1 + 0x11Eu) = 0x2Cu;
        U8(r1 + 0x12Au) = 0xFFu;
        U8(r1 + 0x131u) = 1u;
    }
    {
        uint32_t r2 = ARENA_ITEMSTXT + 2u * 0x1A8u;
        U32(r2 + 0x80u) = 0x20776F62u;
        U32(r2 + 0xC0u) = 0x20776F62u;
        U32(r2 + 0xE0u) = 600u;
        U16(r2 + 0x106u) = 1u;
        U16(r2 + 0x108u) = 1u;
        U8(r2 + 0x10Fu) = 2u; U8(r2 + 0x110u) = 3u;
        U8(r2 + 0x115u) = 7u; /* component = 7 */
        U16(r2 + 0x11Eu) = 0x1Bu;
        U8(r2 + 0x12Au) = 0xFFu;
    }
    {
        uint32_t r3 = ARENA_ITEMSTXT + 3u * 0x1A8u;
        U32(r3 + 0x80u) = 0x206D7261u;
        U32(r3 + 0xCCu) = 10u; U32(r3 + 0xD0u) = 20u;
        U32(r3 + 0xE0u) = 800u; U32(r3 + 0xE4u) = 4000u;
        U16(r3 + 0x106u) = 0u;
        U16(r3 + 0x108u) = 0u;
        U8(r3 + 0x10Fu) = 2u; U8(r3 + 0x110u) = 3u;
        U8(r3 + 0x112u) = 1u;
        U16(r3 + 0x11Eu) = 0x25u;
        U8(r3 + 0x12Au) = 0u;
    }
    {
        uint32_t r4 = ARENA_ITEMSTXT + 4u * 0x1A8u;
        U32(r4 + 0x80u) = 0x20646873u;
        U16(r4 + 0x11Eu) = 0x33u; /* wType[0] = shield */
        U16(r4 + 0x120u) = 0x25u; /* wType[1] = 37 (helm, bit 5 in word 1) */
    }
    {
        uint32_t r5 = ARENA_ITEMSTXT + 5u * 0x1A8u;
        U32(r5 + 0x80u) = 0x20317468u;
        U32(r5 + 0xC0u) = 0x20317468u; /* 'ht1 ' -> wc = 12 */
        U16(r5 + 0x11Eu) = 0x1Eu;
    }

    /* Sorted link table (for ITEMS_IsTome ear check) */
    U32(ARENA_ITEMSLINK + 0x00u) = 4u;
    U32(ARENA_ITEMSLINK + 0x08u) = ARENA_ITEMSLINK + 0x10u;
    U32(ARENA_ITEMSLINK + 0x10u) = 0x206D7261u; U32(ARENA_ITEMSLINK + 0x14u) = 3u;
    U32(ARENA_ITEMSLINK + 0x18u) = 0x20736831u; U32(ARENA_ITEMSLINK + 0x1Cu) = 0u;
    U32(ARENA_ITEMSLINK + 0x20u) = 0x20746831u; U32(ARENA_ITEMSLINK + 0x24u) = 1u;
    U32(ARENA_ITEMSLINK + 0x28u) = 0x20776F62u; U32(ARENA_ITEMSLINK + 0x2Cu) = 2u;

    for (uint32_t s = 0; s < 359u; s++) {
        init_isc_default(s);
    }
    /* Stat 0 (strength): saved bit (0x10 at +5) */
    U8(ARENA_ISC + 0u * 0x144u + 0x05u) = 0x10u;
    /* MagicAffix & NPC rows for repair cost */
    for (uint32_t a = 0; a < 16u; a++) {
        U8(ARENA_MAGICAFFIX + a * 0x90u + 0x56u) = 0xFFu;
        U32(ARENA_MAGICAFFIX + a * 0x90u + 0x88u) = 128u;
        U32(ARENA_MAGICAFFIX + a * 0x90u + 0x8Cu) = 350u;
    }
    U32(ARENA_NPCTXT + 0x00u) = 148u;
    U32(ARENA_NPCTXT + 0x04u) = 1024u;
    U32(ARENA_NPCTXT + 0x08u) = 512u;
    U32(ARENA_NPCTXT + 0x0Cu) = 1024u;
    U32(ARENA_QUESTREC + 0x00u) = ARENA_QUESTREC + 0x10u;

    /* MonStats[1] & MonStats[10] */
    U16(ARENA_MONSTATS + 1u * 0x1A8u + 0x02u) = 1u;
    U16(ARENA_MONSTATS + 1u * 0x1A8u + 0x18u) = 1u;
    U8(ARENA_MONSTATS2 + 1u * 0x134u + 0x08u) = 2u; /* sizeX = 2 */
    U16(ARENA_MONSTATS + 2u * 0x1A8u + 0x02u) = 2u;
    U16(ARENA_MONSTATS + 2u * 0x1A8u + 0x18u) = 2u;
    U8(ARENA_MONSTATS2 + 2u * 0x134u + 0x08u) = 3u; /* sizeX = 3 */
    U16(ARENA_MONSTATS + 10u * 0x1A8u + 0x02u) = 10u;

    /* MissilesTxt[0..2] */
    U8(ARENA_MISSILESTXT + 0u * 0x1A4u + 0x18Au) = 1u; /* size = 1 */
    U8(ARENA_MISSILESTXT + 1u * 0x1A4u + 0x04u) = 0x00u;
    U8(ARENA_MISSILESTXT + 2u * 0x1A4u + 0x04u) = 0x10u; /* bit 4 -> blocked in MatchUnitCandidate */

    /* SkillsTxt[1]: throwing skill (nAnim +0x14 == 2, wITypea1 +0x18 == 0x2C equiv 0x30) */
    U16(ARENA_SKILLSTXT + 1u * 0x23Cu + 0x00u) = 1u;
    U8(ARENA_SKILLSTXT + 1u * 0x23Cu + 0x14u) = 2u;
    S16(ARENA_SKILLSTXT + 1u * 0x23Cu + 0x18u) = 0x2C;
    /* SkillsTxt[2]: melee skill (nAnim == 1) */
    U16(ARENA_SKILLSTXT + 2u * 0x23Cu + 0x00u) = 2u;
    U8(ARENA_SKILLSTXT + 2u * 0x23Cu + 0x14u) = 1u;
    S16(ARENA_SKILLSTXT + 2u * 0x23Cu + 0x18u) = 0x1E;
}

static void setup_inv_body(uint32_t inv, uint32_t grids, uint32_t cells0) {
    U32(inv + 0x00u) = 0x01020304u;
    U32(inv + 0x04u) = 0xCAFE0001u;
    U32(inv + 0x14u) = grids;
    U32(inv + 0x18u) = 1u;
    U32(inv + 0x1Cu) = 0xFFFFFFFFu;
    U8(grids + 0x08u) = 13u;
    U8(grids + 0x09u) = 1u;
    U32(grids + 0x0Cu) = cells0;
}

static void setup_item_basic(uint32_t item, uint32_t uid, uint32_t cls, uint32_t item_data) {
    U32(item + 0x00u) = 4u;
    U32(item + 0x04u) = cls;
    U32(item + 0x0Cu) = uid;
    U32(item + 0x14u) = item_data;
}

static void emit_all_29(FILE *fp) {
    char args[512];
    int asserted = 0;
    uint32_t eax = 0;

    /* 01/29: 0x6FD62330 UNITFINDS_FindNearestUnitInRange113c */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x2Cu) = ARENA_PATH0;
        U32(ARENA_PATH0 + 0x1Cu) = (c == 0) ? 0u : ARENA_ROOM0;
        U32(ARENA_PATH0 + 0x0Cu) = (10u << 16); U32(ARENA_PATH0 + 0x10u) = (10u << 16);
        U32(ARENA_ROOM0 + 0x00u) = ARENA_ROOMLIST0;
        U32(ARENA_ROOM0 + 0x24u) = 1u;
        S32(ARENA_ROOM0 + 0x4Cu) = 0; S32(ARENA_ROOM0 + 0x50u) = 0;
        S32(ARENA_ROOM0 + 0x54u) = 50; S32(ARENA_ROOM0 + 0x58u) = 50;
        U32(ARENA_ROOMLIST0 + 0u) = ARENA_ROOM0;

        U32(ARENA_UNIT1 + 0x00u) = 1u; U32(ARENA_UNIT1 + 0x04u) = (c == 5) ? 10u : 99u;
        U32(ARENA_UNIT1 + 0x0Cu) = 2u; U32(ARENA_UNIT1 + 0x2Cu) = ARENA_PATH1;
        U32(ARENA_PATH1 + 0x0Cu) = (c == 5) ? (13u << 16) : (11u << 16);
        U32(ARENA_PATH1 + 0x10u) = (c == 5) ? (10u << 16) : (11u << 16);

        U32(ARENA_UNIT2 + 0x00u) = 1u; U32(ARENA_UNIT2 + 0x04u) = 10u;
        U32(ARENA_UNIT2 + 0x0Cu) = 3u; U32(ARENA_UNIT2 + 0x2Cu) = ARENA_PATH2;
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

    /* 02/29: 0x6FD624E0 UNITFINDS_MatchUnitCandidate113c */
    for (int c = 0; c < 8; c++) {
        setup_common_tables();
        U32(ARENA_SEARCH0 + 0x0Cu) = 20u; U32(ARENA_SEARCH0 + 0x10u) = 20u;
        U32(ARENA_SEARCH0 + 0x14u) = 15u;
        U32(ARENA_SEARCH0 + 0x18u) = 5u;
        U32(ARENA_SEARCH0 + 0x1Cu) = (c == 1) ? 5u : 0u;
        U32(ARENA_SEARCH0 + 0x24u) = ARENA_CB1;

        uint32_t uType = (c == 2) ? 0u : (c == 4) ? 3u : (c == 7) ? 4u : 1u;
        uint32_t uCls  = (c == 4) ? 1u : (c == 6) ? 77u : 10u;
        U32(ARENA_UNIT0 + 0x00u) = uType; U32(ARENA_UNIT0 + 0x04u) = uCls;
        U32(ARENA_UNIT0 + 0x10u) = (c == 2) ? 5u : 1u;
        U32(ARENA_UNIT0 + 0x2Cu) = ARENA_PATH0;
        U32(ARENA_UNIT0 + 0xC4u) = (c == 7) ? 0x0Cu : 0u;
        uint32_t px = (c == 3) ? 45u : 22u;
        if (uType == 4u) {
            U32(ARENA_PATH0 + 0x00u) = ARENA_ROOM0;
            U32(ARENA_PATH0 + 0x0Cu) = px;
            U32(ARENA_PATH0 + 0x10u) = 22u;
        } else {
            U16(ARENA_PATH0 + 0x02u) = (uint16_t)px;
            U16(ARENA_PATH0 + 0x06u) = 22u;
            U32(ARENA_PATH0 + 0x1Cu) = ARENA_ROOM0;
        }
        U32(ARENA_ROOM0 + 0x10u) = ARENA_ROOMEX0;
        U32(ARENA_ROOMEX0 + 0x58u) = ARENA_LEVEL0;
        U32(ARENA_LEVEL0 + 0x1D0u) = 2u; /* Blood Moor (not town) */

        if (c == 1) U32(ARENA_SEARCH0 + 0x00u) = 0x42u;
        else if (c == 2) U32(ARENA_SEARCH0 + 0x00u) = 0x01u;
        else if (c == 4) U32(ARENA_SEARCH0 + 0x00u) = 0x08u;
        else if (c == 5) {
            U32(ARENA_SEARCH0 + 0x00u) = 0x06u;
            U32(ARENA_MONSTATS + 10u * 0x1A8u + 0x11Cu) = 0x200u;
        } else if (c == 6) U32(ARENA_SEARCH0 + 0x00u) = 0x802u;
        else if (c == 7) U32(ARENA_SEARCH0 + 0x00u) = 0xD80u | 0x20u; /* item + 0x80 + 0x100 + 0x400 + 0x800 */
        else U32(ARENA_SEARCH0 + 0x00u) = 0x02u;

        uint32_t sArg = (c == 0) ? 0u : ARENA_SEARCH0;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD90B0u, 4u}, {ARENA_BITMASKS, 0x80u},
            {ARENA_SGPT, 0xC78u}, {ARENA_MONSTATS, 0x1500u}, {ARENA_MISSILESTXT, 0x600u},
            {ARENA_UNIT0, 0xF0u}, {ARENA_PATH0, 0x40u}, {ARENA_ROOM0, 0x80u},
            {ARENA_ROOMEX0, 0x80u}, {ARENA_LEVEL0, 0x200u}, {ARENA_SEARCH0, 0x40u}, {ARENA_CB1, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 13);
        eax = safe_stdcall2(0x6FD624E0u, ARENA_UNIT0, sArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_UNIT0, sArg);
        emit_rec(fp, "0x6FD624E0", "UNITFINDS_MatchUnitCandidate113c", c,
            c == 0 ? "null_search" : c == 1 ? "cap_reached_0" : c == 2 ? "player_match_1" :
            c == 3 ? "out_of_range_0" : c == 4 ? "missile_match_1" : c == 5 ? "demon_match_1" :
            c == 6 ? "cb_rejects_77" : "item_flags_nontown_cb_accept_1",
            args, regs, 13, asserted, eax, 0xFFFFFFFFu);
    }

    /* 03/29: 0x6FD62C00 LOGGING_WriteLockedEntry113c */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        const char *fstr = (c == 3) ? "src/long_module_test.cpp" : "test.cpp";
        const char *mstr = (c == 2) ? "plain_msg" : (c == 3) ? "v=%d%% w=%d" : "unused";
        memcpy((void *)(uintptr_t)ARENA_STR, fstr, strlen(fstr) + 1u);
        memcpy((void *)(uintptr_t)(ARENA_STR + 0x80u), mstr, strlen(mstr) + 1u);
        uint32_t va0 = (c == 3) ? 123u : 0u;
        uint32_t va1 = (c == 3) ? 456u : 0u;
        U32(ARENA_OUT + 0u) = va0;
        U32(ARENA_OUT + 4u) = va1;
        U32(0x6FDF1470u) = (c == 0) ? 0u : g_d2c_nul_fp;
        U32(0x6FDF1474u) = (c >= 2) ? 1u : 0u;
        mem_region_t regs[] = {
            {0x6FDF1470u, 8u}, {ARENA_STR, 0x100u}, {ARENA_OUT, 0x10u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
        safe_cdecl9_void(0x6FD62C00u, 1u, 2u, 3u, 4u, ARENA_STR, 100u + (uint32_t)c, ARENA_STR + 0x80u, va0, va1, &asserted);
        snprintf(args, sizeof(args), "1,2,3,4,\"0x%08X\",%u,\"0x%08X\",%u,%u",
            ARENA_STR, 100u + (uint32_t)c, ARENA_STR + 0x80u, va0, va1);
        emit_rec(fp, "0x6FD62C00", "LOGGING_WriteLockedEntry113c", c,
            c == 0 ? "lock_ptr_null" : c == 1 ? "log_disabled" : c == 2 ? "plain_format" : "percent_format_args",
            args, regs, 3, asserted, 0u, 0x00000000u);
        U32(0x6FDF1470u) = 0u;
        U32(0x6FDF1474u) = 0u;
    }

    /* 04/29: 0x6FD6E1B0 INVENTORY_GetOrInitGridMemPort113c */
    for (int c = 0; c < 7; c++) {
        setup_common_tables();
        U32(ARENA_INV0 + 0x00u) = 0x01020304u;
        U32(ARENA_INV0 + 0x04u) = 0x12340000u;
        uint32_t gridIdx = 0u;
        uint32_t pDef = 0x6FDED378u;
        if (c == 0) {
            U32(ARENA_INV0 + 0x18u) = 0u;
            pDef = 0u;
        } else if (c == 1) {
            U32(ARENA_INV0 + 0x18u) = 0u;
        } else if (c == 2) {
            U32(ARENA_INV0 + 0x14u) = ARENA_GRIDS0;
            U32(ARENA_INV0 + 0x18u) = 1u;
            U8(ARENA_GRIDS0 + 0x08u) = 13u; U8(ARENA_GRIDS0 + 0x09u) = 1u;
            U32(ARENA_GRIDS0 + 0x0Cu) = ARENA_CELLS0;
            U8(ARENA_STR + 0u) = 10u; U8(ARENA_STR + 1u) = 4u;
            gridIdx = 2u;
            pDef = ARENA_STR;
        } else if (c == 3) {
            setup_inv_body(ARENA_INV0, ARENA_GRIDS0, ARENA_CELLS0);
            pDef = 0u;
        } else if (c == 4) {
            setup_inv_body(ARENA_INV0, ARENA_GRIDS0, 0u);
            pDef = 0u;
        } else if (c == 5) {
            U32(ARENA_INV0 + 0x14u) = ARENA_GRIDS0;
            U32(ARENA_INV0 + 0x18u) = 1u;
            U32(ARENA_GRIDS0 + 0x0Cu) = 0u;
        } else {
            setup_inv_body(ARENA_INV0, ARENA_GRIDS0, ARENA_CELLS0);
            U8(ARENA_GRIDS0 + 0x08u) = 10u; /* mismatch 10 != 13 */
        }
        mem_region_t regs[] = {
            {0x6FDED378u, 4u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x40u},
            {ARENA_CELLS0, 0x40u}, {ARENA_STR, 0x10u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 5);
        eax = safe_eax_ebx_stack1(0x6FD6E1B0u, gridIdx, ARENA_INV0, pDef, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",%u,\"0x%08X\"", ARENA_INV0, gridIdx, pDef);
        emit_rec(fp, "0x6FD6E1B0", "INVENTORY_GetOrInitGridMemPort113c", c,
            c == 0 ? "unalloc_null_def" : c == 1 ? "alloc_grid0_fresh" : c == 2 ? "realloc_expand_grid2" :
            c == 3 ? "existing_null_def_ok" : c == 4 ? "existing_null_ppitems_null_def" :
            c == 5 ? "lazy_alloc_ppitems" : "dim_mismatch_returns_0",
            args, regs, 5, asserted, eax, 0xFFFFFFFFu);
    }

    /* 05/29: 0x6FD6E670 INVENTORY_GetItemFromBodyLocMemPort113c */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        setup_inv_body(ARENA_INV0, ARENA_GRIDS0, ARENA_CELLS0);
        U32(ARENA_CELLS0 + 4u * 4u) = ARENA_ITEM0;
        if (c == 1) U32(ARENA_INV0 + 0x00u) = 0xDEADBEEFu;
        if (c == 5) { U32(ARENA_INV0 + 0x14u) = 0u; U32(ARENA_INV0 + 0x18u) = 0u; }
        uint32_t invArg = (c == 0) ? 0u : ARENA_INV0;
        int32_t locArg = (c == 2) ? -1 : (c == 3) ? 13 : (c == 4) ? 4 : 1;
        mem_region_t regs[] = {
            {0x6FDED378u, 4u}, {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x20u}, {ARENA_CELLS0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 4);
        eax = safe_stdcall2(0x6FD6E670u, invArg, (uint32_t)locArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",%d", invArg, locArg);
        emit_rec(fp, "0x6FD6E670", "INVENTORY_GetItemFromBodyLocMemPort113c", c,
            c == 0 ? "null_inv" : c == 1 ? "bad_sig" : c == 2 ? "neg_loc" :
            c == 3 ? "loc_13_oob" : c == 4 ? "rarm_hit" : "lazy_init_empty_slot",
            args, regs, 4, asserted, eax, 0xFFFFFFFFu);
    }

    /* 06/29: 0x6FD70320 INVENTORY_GetCompositWeaponMemPort113c */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        setup_inv_body(ARENA_INV0, ARENA_GRIDS0, ARENA_CELLS0);
        setup_item_basic(ARENA_ITEM0, 101u, 0u, ARENA_ITEMDATA0); /* sword */
        setup_item_basic(ARENA_ITEM1, 102u, 0u, ARENA_ITEMDATA1); /* sword */
        setup_item_basic(ARENA_ITEM2, 101u, 3u, ARENA_ITEMDATA2); /* armor (not weapon) */
        if (c == 1) {
            U32(ARENA_INV0 + 0x1Cu) = 0xFFFFFFFFu;
        } else if (c == 2) {
            U32(ARENA_INV0 + 0x1Cu) = 101u;
            U32(ARENA_CELLS0 + 0x14u) = ARENA_ITEM0;
        } else if (c == 3) {
            U32(ARENA_INV0 + 0x1Cu) = 102u;
            U32(ARENA_CELLS0 + 0x14u) = ARENA_ITEM2;
            U32(ARENA_CELLS0 + 0x10u) = ARENA_ITEM1;
        } else if (c == 4) {
            U32(ARENA_INV0 + 0x1Cu) = 999u;
            U32(ARENA_CELLS0 + 0x14u) = ARENA_ITEM0;
            U32(ARENA_CELLS0 + 0x10u) = ARENA_ITEM1;
        }
        uint32_t invArg = (c == 0) ? 0u : ARENA_INV0;
        mem_region_t regs[] = {
            {0x6FDED378u, 4u}, {0x6FDE9E1Cu, 4u}, {0x6FDD90B0u, 4u}, {0x6FDEFB94u, 8u}, {0x6FDEFF6Cu, 4u},
            {ARENA_BITMASKS, 0x80u}, {ARENA_SGPT, 0xC10u}, {ARENA_ITYPEMAT, 0x500u},
            {ARENA_ITEMSTXT, 0x800u}, {ARENA_ITEMSLINK, 0x40u},
            {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x20u}, {ARENA_CELLS0, 0x40u},
            {ARENA_ITEM0, 0x20u}, {ARENA_ITEM1, 0x20u}, {ARENA_ITEM2, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 16);
        eax = safe_stdcall1(0x6FD70320u, invArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", invArg);
        emit_rec(fp, "0x6FD70320", "INVENTORY_GetCompositWeaponMemPort113c", c,
            c == 0 ? "null_inv" : c == 1 ? "weapid_neg1" : c == 2 ? "larm_match" :
            c == 3 ? "rarm_match" : "id_mismatch_0",
            args, regs, 16, asserted, eax, 0xFFFFFFFFu);
    }

    /* 07/29: 0x6FD70700 INVENTORY_GetActiveWeaponMemPort113c */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        setup_inv_body(ARENA_INV0, ARENA_GRIDS0, ARENA_CELLS0);
        setup_item_basic(ARENA_ITEM0, 201u, 0u, ARENA_ITEMDATA0);
        setup_item_basic(ARENA_ITEM1, 202u, 1u, ARENA_ITEMDATA1);
        setup_item_basic(ARENA_ITEM2, 203u, 3u, ARENA_ITEMDATA2); /* armor */
        U32(ARENA_OUT) = 0x11111111u;
        U32(ARENA_OUT2) = 0x22222222u;
        U32(ARENA_OUT3) = 0x33333333u;
        if (c == 1) {
            U32(ARENA_INV0 + 0x1Cu) = 201u;
            U32(ARENA_CELLS0 + 0x10u) = ARENA_ITEM0;
        } else if (c == 2) {
            U32(ARENA_ITEMDATA0 + 0x18u) = 0x100u; /* broken */
            U32(ARENA_CELLS0 + 0x10u) = ARENA_ITEM0;
            U32(ARENA_CELLS0 + 0x14u) = ARENA_ITEM1;
        } else if (c == 3) {
            U32(ARENA_ITEMDATA0 + 0x18u) = 0x4000u; /* unequipping */
            U32(ARENA_INV0 + 0x1Cu) = 202u;
            U32(ARENA_CELLS0 + 0x10u) = ARENA_ITEM0;
            U32(ARENA_CELLS0 + 0x14u) = ARENA_ITEM1;
        } else if (c == 4) {
            U32(ARENA_CELLS0 + 0x14u) = ARENA_ITEM2; /* non-weapon */
        } else if (c == 5) {
            U32(ARENA_INV0 + 0x00u) = 0xBAD00000u; /* bad sig -> still zeroes *pbIsActive and *ppWeapon */
        }
        uint32_t invArg = (c == 0) ? 0u : ARENA_INV0;
        mem_region_t regs[] = {
            {0x6FDED378u, 4u}, {0x6FDE9E1Cu, 4u}, {0x6FDD90B0u, 4u}, {0x6FDEFB94u, 8u}, {0x6FDEFF6Cu, 4u},
            {ARENA_BITMASKS, 0x80u}, {ARENA_SGPT, 0xC10u}, {ARENA_ITYPEMAT, 0x500u},
            {ARENA_ITEMSTXT, 0x800u}, {ARENA_ITEMSLINK, 0x40u},
            {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x20u}, {ARENA_CELLS0, 0x40u},
            {ARENA_ITEM0, 0x20u}, {ARENA_ITEM1, 0x20u}, {ARENA_ITEM2, 0x20u},
            {ARENA_ITEMDATA0, 0x20u}, {ARENA_ITEMDATA1, 0x20u}, {ARENA_ITEMDATA2, 0x20u},
            {ARENA_OUT, 8u}, {ARENA_OUT2, 8u}, {ARENA_OUT3, 8u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 22);
        eax = safe_stdcall4(0x6FD70700u, invArg, ARENA_OUT, ARENA_OUT2, ARENA_OUT3, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",\"0x%08X\",\"0x%08X\"",
            invArg, ARENA_OUT, ARENA_OUT2, ARENA_OUT3);
        emit_rec(fp, "0x6FD70700", "INVENTORY_GetActiveWeaponMemPort113c", c,
            c == 0 ? "null_inv" : c == 1 ? "rarm_active_1" : c == 2 ? "rarm_broken_larm_inactive" :
            c == 3 ? "rarm_unequip_larm_active" : c == 4 ? "non_weapon_none" : "bad_sig_clears_outs",
            args, regs, 22, asserted, eax, 0xFFFFFFFFu);
    }

    /* 08/29: 0x6FD70830 INVENTORY_GetWeaponByHandSlotMemPort113c */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        setup_inv_body(ARENA_INV0, ARENA_GRIDS0, ARENA_CELLS0);
        setup_item_basic(ARENA_ITEM0, 301u, 0u, ARENA_ITEMDATA0); /* 1hs wc=2 */
        setup_item_basic(ARENA_ITEM1, 302u, 5u, ARENA_ITEMDATA1); /* ht1 wc=12 */
        setup_item_basic(ARENA_ITEM2, 303u, 2u, ARENA_ITEMDATA2); /* bow wc=1, comp=7 */
        uint32_t slotArg = 5u;
        if (c == 1) {
            U32(ARENA_INV0 + 0x1Cu) = 302u;
            U32(ARENA_CELLS0 + 0x10u) = ARENA_ITEM0;
            U32(ARENA_CELLS0 + 0x14u) = ARENA_ITEM1;
            slotArg = 5u; /* primary -> ITEM1 */
        } else if (c == 2) {
            U32(ARENA_INV0 + 0x1Cu) = 302u;
            U32(ARENA_CELLS0 + 0x10u) = ARENA_ITEM0;
            U32(ARENA_CELLS0 + 0x14u) = ARENA_ITEM1;
            slotArg = 6u; /* secondary -> ITEM0 */
        } else if (c == 3) {
            U32(ARENA_INV0 + 0x1Cu) = 302u;
            U32(ARENA_CELLS0 + 0x10u) = ARENA_ITEM0;
            slotArg = 7u; /* 1H weapon with slot=7 -> 0 */
        } else if (c == 4) {
            U32(ARENA_CELLS0 + 0x10u) = ARENA_ITEM2;
            slotArg = 7u; /* bow component=7 -> ITEM2 */
        } else if (c == 5) {
            U32(ARENA_CELLS0 + 0x10u) = ARENA_ITEM2;
            slotArg = 5u; /* bow component=7 != 5 -> 0 */
        }
        uint32_t invArg = (c == 0) ? 0u : ARENA_INV0;
        mem_region_t regs[] = {
            {0x6FDED378u, 4u}, {0x6FDE9E1Cu, 4u}, {0x6FDD90B0u, 4u}, {0x6FDEFB94u, 8u},
            {0x6FDEFF6Cu, 4u}, {0x6FDEF020u, 0x40u},
            {ARENA_BITMASKS, 0x80u}, {ARENA_SGPT, 0xC10u}, {ARENA_ITYPEMAT, 0x500u},
            {ARENA_ITEMSTXT, 0xB00u}, {ARENA_ITEMSLINK, 0x40u},
            {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x20u}, {ARENA_CELLS0, 0x40u},
            {ARENA_ITEM0, 0x20u}, {ARENA_ITEM1, 0x20u}, {ARENA_ITEM2, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 17);
        eax = safe_stdcall2(0x6FD70830u, invArg, slotArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",%u", invArg, slotArg);
        emit_rec(fp, "0x6FD70830", "INVENTORY_GetWeaponByHandSlotMemPort113c", c,
            c == 0 ? "null_inv" : c == 1 ? "dual_primary_5" : c == 2 ? "dual_secondary_6" :
            c == 3 ? "dual_other_slot_0" : c == 4 ? "bow_component_match" : "bow_component_miss",
            args, regs, 17, asserted, eax, 0xFFFFFFFFu);
    }

    /* 09/29: 0x6FD72970 ITEMS_GetDexBonusMemPort113c (retMask = 0xFFFF) */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        uint32_t cls = (c == 2) ? 99u : (c == 3) ? 2u : (c == 4) ? 0u : 3u;
        U32(ARENA_ITEM0 + 0x00u) = (c == 1) ? 1u : 4u;
        U32(ARENA_ITEM0 + 0x04u) = cls;
        uint32_t itmArg = (c == 0) ? 0u : ARENA_ITEM0;
        mem_region_t regs[] = {
            {0x6FDEFB94u, 8u}, {ARENA_ITEMSTXT, 0x800u}, {ARENA_ITEM0, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
        eax = safe_stdcall1(0x6FD72970u, itmArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", itmArg);
        emit_rec(fp, "0x6FD72970", "ITEMS_GetDexBonusMemPort113c", c,
            c == 0 ? "null_item_100" : c == 1 ? "non_item_100" : c == 2 ? "oob_cls_100" :
            c == 3 ? "dex1_maps_100" : c == 4 ? "dex_50" : "dex_0",
            args, regs, 3, asserted, eax, 0x0000FFFFu);
    }

    /* 10/29: 0x6FD729A0 ITEMS_GetStrBonusMemPort113c (retMask = 0xFFFF) */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        uint32_t cls = (c == 2) ? 99u : (c == 3) ? 2u : (c == 4) ? 0u : 3u;
        U32(ARENA_ITEM0 + 0x00u) = (c == 1) ? 1u : 4u;
        U32(ARENA_ITEM0 + 0x04u) = cls;
        uint32_t itmArg = (c == 0) ? 0u : ARENA_ITEM0;
        mem_region_t regs[] = {
            {0x6FDEFB94u, 8u}, {ARENA_ITEMSTXT, 0x800u}, {ARENA_ITEM0, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
        eax = safe_stdcall1(0x6FD729A0u, itmArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", itmArg);
        emit_rec(fp, "0x6FD729A0", "ITEMS_GetStrBonusMemPort113c", c,
            c == 0 ? "null_item_100" : c == 1 ? "non_item_100" : c == 2 ? "oob_cls_100" :
            c == 3 ? "str1_maps_100" : c == 4 ? "str_110" : "str_0",
            args, regs, 3, asserted, eax, 0x0000FFFFu);
    }

    /* 11/29: 0x6FD74430 ITEMS_CheckItemTypeIdMemPort113c */
    for (int c = 0; c < 7; c++) {
        setup_common_tables();
        U32(ARENA_ITEM0 + 0x00u) = 4u;
        U32(ARENA_ITEM0 + 0x04u) = (c >= 4) ? 4u : 0u;
        if (c == 6) U16(ARENA_ITEMSTXT + 4u * 0x1A8u + 0x120u) = 120u; /* wType1 >= 96 */
        uint32_t itmArg = (c == 0) ? 0u : ARENA_ITEM0;
        int32_t tArg = (c == 1) ? -1 : (c == 2) ? 96 : (c == 3) ? 0x2D :
                       (c == 4) ? 0x25 : (c == 5) ? 0x2D : 0x25;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD90B0u, 4u}, {0x6FDEFB94u, 8u}, {0x6FDEFF6Cu, 4u},
            {ARENA_BITMASKS, 0x80u}, {ARENA_SGPT, 0xC10u}, {ARENA_ITYPEMAT, 0x500u},
            {ARENA_ITEMSTXT, 0x900u}, {ARENA_ITEMSLINK, 0x40u}, {ARENA_ITEM0, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 10);
        eax = safe_stdcall2(0x6FD74430u, itmArg, (uint32_t)tArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",%d", itmArg, tArg);
        emit_rec(fp, "0x6FD74430", "ITEMS_CheckItemTypeIdMemPort113c", c,
            c == 0 ? "null_item" : c == 1 ? "neg_type" : c == 2 ? "oob_type" :
            c == 3 ? "type0_hit_1" : c == 4 ? "type1_rawmask_0x20" : c == 5 ? "both_miss_0" : "type1_oob_0",
            args, regs, 10, asserted, eax, 0xFFFFFFFFu);
    }

    /* 12/29: 0x6FD74C30 ITEMS_CheckIfThrowItemMemPort113c */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        U32(ARENA_ITEM0 + 0x00u) = (c == 1) ? 1u : 4u;
        U32(ARENA_ITEM0 + 0x04u) = (c == 5) ? 1u : 0u;
        if (c == 2) S16(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x11Eu) = -1;
        if (c == 3) U16(ARENA_ITEMSTXT + 0u * 0x1A8u + 0x11Eu) = 100u;
        uint32_t itmArg = (c == 0) ? 0u : ARENA_ITEM0;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDEFB94u, 8u}, {0x6FDEFF6Cu, 4u},
            {ARENA_SGPT, 0xC10u}, {ARENA_ITEMTYPES, 0x3000u}, {ARENA_ITEMSTXT, 0x400u},
            {ARENA_ITEMSLINK, 0x40u}, {ARENA_ITEM0, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
        eax = safe_stdcall1(0x6FD74C30u, itmArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", itmArg);
        emit_rec(fp, "0x6FD74C30", "ITEMS_CheckIfThrowItemMemPort113c", c,
            c == 0 ? "null_item" : c == 1 ? "non_item" : c == 2 ? "neg_wtype0" :
            c == 3 ? "oob_wtype0" : c == 4 ? "melee_sword_0" : "throw_knife_1",
            args, regs, 8, asserted, eax, 0xFFFFFFFFu);
    }

    /* 13/29: 0x6FD7A210 ITEMS_GetRepairAllCost113c */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00u) = 0u;
        U32(ARENA_UNIT0 + 0x0Cu) = 1001u;
        U32(ARENA_UNIT0 + 0x14u) = ARENA_PLRDATA0;
        U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
        U32(ARENA_STATLIST0 + 0x24u) = ARENA_STATS0; U16(ARENA_STATLIST0 + 0x2Au) = 4u;
        U32(ARENA_STATLIST0 + 0x48u) = ARENA_STATS0; U16(ARENA_STATLIST0 + 0x4Eu) = 4u;
        U32(ARENA_UNIT0 + 0x60u) = (c == 1) ? 0u : ARENA_INV0;
        setup_inv_body(ARENA_INV0, ARENA_GRIDS0, ARENA_CELLS0);

        /* Item 0: sword (class 0), statlist1 */
        setup_item_basic(ARENA_ITEM0, 8001u, 0u, ARENA_ITEMDATA0);
        U32(ARENA_ITEMDATA0 + 0x00u) = 2u; U32(ARENA_ITEMDATA0 + 0x18u) = 0x10u;
        U32(ARENA_ITEMDATA0 + 0x2Cu) = 20u; U16(ARENA_ITEMDATA0 + 0x30u) = 100u;
        U32(ARENA_ITEM0 + 0x5Cu) = ARENA_STATLIST1;
        U32(ARENA_STATLIST1 + 0x08u) = 4u; U32(ARENA_STATLIST1 + 0x10u) = 0x80000000u;
        U32(ARENA_STATLIST1 + 0x24u) = ARENA_STATS1; U16(ARENA_STATLIST1 + 0x28u) = 2u; U16(ARENA_STATLIST1 + 0x2Au) = 4u;
        U32(ARENA_STATLIST1 + 0x48u) = ARENA_STATS1; U16(ARENA_STATLIST1 + 0x4Cu) = 2u; U16(ARENA_STATLIST1 + 0x4Eu) = 4u;
        U32(ARENA_STATS1 + 0u) = 0x00480000u; U32(ARENA_STATS1 + 4u) = (c == 2) ? 20u : 5u;
        U32(ARENA_STATS1 + 8u) = 0x00490000u; U32(ARENA_STATS1 + 12u) = 20u;
        U32(ARENA_CELLS0 + 4u * 4u) = ARENA_ITEM0;

        /* Item 1: damaged armor (class 3) in c >= 3 */
        if (c >= 3) {
            setup_item_basic(ARENA_ITEM1, 8002u, 3u, ARENA_ITEMDATA1);
            U32(ARENA_ITEMDATA1 + 0x00u) = 2u; U32(ARENA_ITEMDATA1 + 0x18u) = 0x10u;
            U32(ARENA_ITEMDATA1 + 0x2Cu) = 20u; U16(ARENA_ITEMDATA1 + 0x30u) = 100u;
            U32(ARENA_ITEM1 + 0x5Cu) = ARENA_STATLIST2;
            U32(ARENA_STATLIST2 + 0x08u) = 4u; U32(ARENA_STATLIST2 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST2 + 0x24u) = ARENA_STATS2; U16(ARENA_STATLIST2 + 0x28u) = 2u; U16(ARENA_STATLIST2 + 0x2Au) = 4u;
            U32(ARENA_STATLIST2 + 0x48u) = ARENA_STATS2; U16(ARENA_STATLIST2 + 0x4Cu) = 2u; U16(ARENA_STATLIST2 + 0x4Eu) = 4u;
            U32(ARENA_STATS2 + 0u) = 0x00480000u; U32(ARENA_STATS2 + 4u) = 10u;
            U32(ARENA_STATS2 + 8u) = 0x00490000u; U32(ARENA_STATS2 + 12u) = 30u;
            U32(ARENA_CELLS0 + 3u * 4u) = ARENA_ITEM1;
        }

        uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
        uint32_t cbArg = (c == 4) ? ARENA_CB2 : 0u;
        mem_region_t regs[] = {
            {0x6FDED378u, 4u}, {0x6FDE9E1Cu, 4u}, {0x6FDD90B0u, 4u}, {0x6FDEFB94u, 8u},
            {0x6FDEFF6Cu, 4u}, {0x6FDEFBB8u, 0x24u}, {0x6FDEFDA0u, 8u}, {0x6FDF0880u, 8u},
            {ARENA_BITMASKS, 0x80u}, {ARENA_SGPT, 0xC80u}, {ARENA_ISC, 359u * 0x144u},
            {ARENA_ITEMTYPES, 0x3500u}, {ARENA_ITYPEMAT, 0x500u}, {ARENA_ITEMSTXT, 0x900u},
            {ARENA_ITEMSLINK, 0x40u}, {ARENA_MAGICAFFIX, 0x1000u}, {ARENA_GEMS, 0x300u},
            {ARENA_RUNES, 0x300u}, {ARENA_QUAL, 0x80u}, {ARENA_NPCTXT, 0xA0u},
            {ARENA_QUESTREC, 0x40u}, {ARENA_UNIT0, 0x100u}, {ARENA_PLRDATA0, 0x80u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}, {ARENA_STATLIST2, 0x80u},
            {ARENA_STATS0, 0x40u}, {ARENA_STATS1, 0x40u}, {ARENA_STATS2, 0x40u},
            {ARENA_INV0, 0x40u}, {ARENA_GRIDS0, 0x20u}, {ARENA_CELLS0, 0x40u},
            {ARENA_ITEM0, 0x80u}, {ARENA_ITEM1, 0x80u}, {ARENA_ITEMDATA0, 0x60u}, {ARENA_ITEMDATA1, 0x60u},
            {ARENA_OUT, 0x40u}, {ARENA_CB2, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 38);
        eax = safe_stdcall6(0x6FD7A210u, 0xCAFEBABEu, uArg, 148u, 0u, ARENA_QUESTREC, cbArg, &asserted);
        snprintf(args, sizeof(args), "\"0xCAFEBABE\",\"0x%08X\",148,0,\"0x%08X\",\"0x%08X\"",
            uArg, ARENA_QUESTREC, cbArg);
        emit_rec(fp, "0x6FD7A210", "ITEMS_GetRepairAllCost113c", c,
            c == 0 ? "null_unit" : c == 1 ? "null_inv" : c == 2 ? "full_dur_0" :
            c == 3 ? "two_damaged_no_cb" : "two_damaged_with_cb",
            args, regs, 38, asserted, eax, 0xFFFFFFFFu);
    }

    /* 14/29: 0x6FD803A0 SKILLS_GetUsedSkillMemPort113c */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0xA8u) = (c == 0) ? 0u : ARENA_SKINFO0;
        U32(ARENA_SKINFO0 + 0x10u) = (c == 1) ? 0u : (c == 2) ? ARENA_SKILL0 : ARENA_SKILL1;
        uint32_t uArg = (c == 4) ? 0u : ARENA_UNIT0;
        mem_region_t regs[] = { {ARENA_UNIT0, 0xC0u}, {ARENA_SKINFO0, 0x20u} };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 2);
        eax = safe_stdcall1(0x6FD803A0u, uArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", uArg);
        emit_rec(fp, "0x6FD803A0", "SKILLS_GetUsedSkillMemPort113c", c,
            c == 0 ? "null_pskills" : c == 1 ? "null_used_skill" :
            c == 2 ? "skill0" : c == 3 ? "skill1" : "null_unit_assert_0x65c",
            args, regs, 2, asserted, eax, 0xFFFFFFFFu);
    }

    /* 15/29: 0x6FD803E0 SKILLS_SetUsedSkillMemPort113c */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0xA8u) = (c == 0) ? 0u : ARENA_SKINFO0;
        U32(ARENA_SKINFO0 + 0x10u) = (c == 2) ? ARENA_SKILL0 : 0u;
        uint32_t uArg = (c == 4) ? 0u : ARENA_UNIT0;
        uint32_t skArg = (c == 2) ? 0u : (c == 3) ? ARENA_SKILL1 : ARENA_SKILL0;
        mem_region_t regs[] = { {ARENA_UNIT0, 0xC0u}, {ARENA_SKINFO0, 0x20u} };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 2);
        eax = safe_stdcall2(0x6FD803E0u, uArg, skArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", uArg, skArg);
        emit_rec(fp, "0x6FD803E0", "SKILLS_SetUsedSkillMemPort113c", c,
            c == 0 ? "null_pskills_noop" : c == 1 ? "set_skill0" :
            c == 2 ? "clear_used_skill" : c == 3 ? "set_skill1" : "null_unit_assert_0x653",
            args, regs, 2, asserted, eax, 0x00000000u);
    }

    /* 16/29: 0x6FD882F0 STATLIST_GetStatsByIdFromList113c */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        U32(ARENA_STATLIST0 + 0x10u) = (c == 1) ? 0u : 0x80000000u;
        uint32_t hdr = (c == 1) ? (ARENA_STATLIST0 + 0x24u) : (ARENA_STATLIST0 + 0x48u);
        U32(hdr + 0u) = ARENA_STATS0;
        U16(hdr + 4u) = (c == 4) ? 0u : 4u;
        U16(hdr + 6u) = 8u;
        U32(ARENA_STATS0 + 0u)  = (0x156u << 16) | 1u;  U32(ARENA_STATS0 + 4u)  = 11u;
        U32(ARENA_STATS0 + 8u)  = (0x156u << 16) | 30u; U32(ARENA_STATS0 + 12u) = 22u;
        U32(ARENA_STATS0 + 16u) = (0x156u << 16) | 44u; U32(ARENA_STATS0 + 20u) = 33u;
        U32(ARENA_STATS0 + 24u) = (0x157u << 16) | 30u; U32(ARENA_STATS0 + 28u) = 99u;

        uint32_t listArg = (c == 0) ? 0u : ARENA_STATLIST0;
        uint32_t statArg = (c == 3) ? 0x155u : 0x156u;
        uint32_t maxArg  = (c == 2) ? 2u : 8u;
        mem_region_t regs[] = { {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x40u}, {ARENA_OUT, 0x40u} };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
        eax = safe_eax_ecx_stack2(0x6FD882F0u, listArg, ARENA_OUT, statArg, maxArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",%u,%u,\"0x%08X\"", listArg, statArg, maxArg, ARENA_OUT);
        emit_rec(fp, "0x6FD882F0", "STATLIST_GetStatsByIdFromList113c", c,
            c == 0 ? "null_list" : c == 1 ? "base_list_copy_3" : c == 2 ? "ext_list_capped_2" :
            c == 3 ? "absent_stat_0" : "empty_list_0",
            args, regs, 3, asserted, eax, 0xFFFFFFFFu);
    }

    /* 17/29: 0x6FD88520 STATLIST_GetStatListFromUnitAndStateMemPort113c */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x5Cu) = (c == 0) ? 0u : ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10u) = (c == 1) ? 0x40u : 0x80000000u;
        U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
        U32(ARENA_STATLIST0 + 0x40u) = ARENA_STATLIST2;
        U32(ARENA_STATLIST1 + 0x14u) = 12u;
        U32(ARENA_STATLIST2 + 0x14u) = 25u;
        uint32_t stArg = (c == 2) ? 12u : (c == 3) ? 25u : (c == 4) ? 99u : 12u;
        mem_region_t regs[] = {
            {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x40u}, {ARENA_STATLIST2, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 4);
        eax = safe_stdcall2(0x6FD88520u, ARENA_UNIT0, stArg, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",%u", ARENA_UNIT0, stArg);
        emit_rec(fp, "0x6FD88520", "STATLIST_GetStatListFromUnitAndStateMemPort113c", c,
            c == 0 ? "null_listex" : c == 1 ? "non_extended" : c == 2 ? "found_lastlist" :
            c == 3 ? "found_mystats" : "state_not_found",
            args, regs, 4, asserted, eax, 0xFFFFFFFFu);
    }

    /* 18/29: 0x6FD88850 STATLIST_EnumerateCopyListStats113c */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10u) = (c == 2) ? 0u : 0x80000000u;
        U32(ARENA_STATLIST0 + 0x24u) = ARENA_STATS0;
        U16(ARENA_STATLIST0 + 0x28u) = 1u; U16(ARENA_STATLIST0 + 0x2Au) = 4u;
        U32(ARENA_STATS0 + 0u) = (c == 4) ? ((7u << 16) | 3u) : (2u << 16);
        S32(ARENA_STATS0 + 4u) = (c == 4) ? -15 : 42;
        U32(ARENA_STATLIST0 + 0x50u) = ARENA_STATS1;
        U16(ARENA_STATLIST0 + 0x54u) = (c == 3) ? 2u : 1u;
        U16(ARENA_STATLIST0 + 0x56u) = 4u;
        U32(ARENA_STATS1 + 0u) = (c == 4) ? ((7u << 16) | 3u) : (2u << 16);
        U32(ARENA_STATS1 + 4u) = (9u << 16); /* absent in pStat -> value 0 */

        uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
        uint32_t pArg = (c == 1) ? 0u : ARENA_OUT;
        mem_region_t regs[] = {
            {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x40u},
            {ARENA_STATS1, 0x40u}, {ARENA_OUT, 0x40u}, {ARENA_CB3, 0x30u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 6);
        eax = safe_stdcall3(0x6FD88850u, uArg, pArg, ARENA_CB3, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",\"0x%08X\"", uArg, pArg, ARENA_CB3);
        emit_rec(fp, "0x6FD88850", "STATLIST_EnumerateCopyListStats113c", c,
            c == 0 ? "null_unit" : c == 1 ? "null_arg_nonzero_cb" : c == 2 ? "non_extended" :
            c == 3 ? "two_keys_present_and_absent" : "layered_negative_val",
            args, regs, 6, asserted, eax, 0x00000000u);
    }

    /* 19/29: 0x6FD888E0 STATLIST_NotifyIfStatModified113c */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10u) = (c == 1) ? 0u : 0x80000000u;
        if (c >= 3) {
            U32(ARENA_STATLIST0 + 0x50u) = ARENA_STATS1;
            U16(ARENA_STATLIST0 + 0x54u) = 1u;
            U16(ARENA_STATLIST0 + 0x56u) = 4u;
            U32(ARENA_STATS1 + 0u) = 0x00090000u;
        }
        if (c == 4) {
            U32(ARENA_STATLIST0 + 0x24u) = ARENA_STATS0;
            U16(ARENA_STATLIST0 + 0x28u) = 1u;
            U16(ARENA_STATLIST0 + 0x2Au) = 4u;
            U32(ARENA_STATS0 + 0u) = 0x00090000u;
            S32(ARENA_STATS0 + 4u) = 777;
        }
        uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
        mem_region_t regs[] = {
            {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x40u},
            {ARENA_STATS1, 0x40u}, {ARENA_OUT, 0x40u}, {ARENA_CB3, 0x30u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 6);
        eax = safe_stdcall4(0x6FD888E0u, uArg, ARENA_OUT, 9u, ARENA_CB3, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",9,\"0x%08X\"", uArg, ARENA_OUT, ARENA_CB3);
        emit_rec(fp, "0x6FD888E0", "STATLIST_NotifyIfStatModified113c", c,
            c == 0 ? "null_unit" : c == 1 ? "non_extended" : c == 2 ? "not_in_modstat" :
            c == 3 ? "in_modstat_absent_base" : "fires_callback",
            args, regs, 6, asserted, eax, 0x00000000u);
    }

    /* 20/29: 0x6FD88940 STATLIST_SetFullStatEntry113c */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        uint32_t pIsc = ARENA_ISC + 5u * 0x144u;
        U8(pIsc + 0x05u) = 0x08u; /* bit 3 -> callback gate */
        U8(pIsc + 0x50u) = (c == 3) ? 1u : 0u; /* bKeepZero */
        U8(pIsc + 0x53u) = (c == 1) ? 1u : 0u; /* bHasDynamicOp */

        U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
        U32(ARENA_STATLIST0 + 0x44u) = ARENA_UNIT0;
        U32(ARENA_STATLIST0 + 0x5Cu) = ARENA_CB4;
        U32(ARENA_STATLIST0 + 0x60u) = 0x77889900u;
        if (c >= 2) {
            U32(ARENA_STATLIST0 + 0x48u) = ARENA_STATS0;
            U16(ARENA_STATLIST0 + 0x4Cu) = 1u;
            U16(ARENA_STATLIST0 + 0x4Eu) = 4u;
            U32(ARENA_STATS0 + 0u) = 0x00050000u;
            S32(ARENA_STATS0 + 4u) = 30;
        }
        int32_t nVal = (c == 1) ? 55 : (c == 4) ? 30 : 0;
        mem_region_t regs[] = {
            {0x6FDD90B0u, 4u}, {ARENA_BITMASKS, 0x80u}, {pIsc, 0x144u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x40u}, {ARENA_UNIT0, 0x40u},
            {ARENA_OUT, 0x40u}, {ARENA_CB4, 0x60u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
        eax = safe_ebx_stack4(0x6FD88940u, ARENA_STATLIST0, 0x00050000u, (uint32_t)nVal, pIsc, ARENA_UNIT0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x00050000\",%d,\"0x%08X\",\"0x%08X\"",
            ARENA_STATLIST0, nVal, pIsc, ARENA_UNIT0);
        emit_rec(fp, "0x6FD88940", "STATLIST_SetFullStatEntry113c", c,
            c == 0 ? "missing_zero_noop" : c == 1 ? "insert_dynop_fires_cb" :
            c == 2 ? "zero_removes_fires_cb" : c == 3 ? "zero_keepzero_fires_cb" : "same_val_no_cb",
            args, regs, 8, asserted, eax, 0x00000000u);
    }

    /* 21/29: 0x6FD8A330 STATLIST_AddStatMemPort113c */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        if (c == 1) {
            /* Non-extended list (eOwnerType=0): must NOT touch +0x50 */
            U32(ARENA_STATLIST0 + 0x08u) = 0u;
            U32(ARENA_STATLIST0 + 0x10u) = 0u;
            U32(ARENA_STATLIST0 + 0x24u) = ARENA_STATS0;
            U16(ARENA_STATLIST0 + 0x2Au) = 4u;
        } else {
            U32(ARENA_STATLIST0 + 0x08u) = (c == 3) ? 1u : 0u;
            U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
            U32(ARENA_STATLIST0 + 0x24u) = ARENA_STATS0; U16(ARENA_STATLIST0 + 0x2Au) = 4u;
            U32(ARENA_STATLIST0 + 0x48u) = ARENA_STATS1; U16(ARENA_STATLIST0 + 0x4Eu) = 4u;
            U32(ARENA_STATLIST0 + 0x50u) = ARENA_STATS2; U16(ARENA_STATLIST0 + 0x56u) = 4u;
            if (c == 3) {
                U16(ARENA_STATLIST0 + 0x28u) = 1u; U32(ARENA_STATS0 + 0u) = 0u; S32(ARENA_STATS0 + 4u) = 10;
                U16(ARENA_STATLIST0 + 0x4Cu) = 1u; U32(ARENA_STATS1 + 0u) = 0u; S32(ARENA_STATS1 + 4u) = 10;
            }
            if (c == 4) {
                /* Sublist ARENA_STATLIST1 linked to parent ARENA_STATLIST0 */
                U32(ARENA_STATLIST1 + 0x10u) = 0x40u;
                U32(ARENA_STATLIST1 + 0x24u) = ARENA_OUT; U16(ARENA_STATLIST1 + 0x2Au) = 4u;
                U32(ARENA_STATLIST1 + 0x34u) = ARENA_STATLIST0;
            }
        }
        uint32_t listArg = (c == 0) ? 0u : (c == 4) ? ARENA_STATLIST1 : ARENA_STATLIST0;
        int32_t delta = (c == 0) ? 0 : (c == 1) ? 25 : (c == 2) ? 15 : (c == 3) ? -10 : 12;
        uint32_t layer = (c == 4) ? 2u : 0u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD90B0u, 4u}, {ARENA_BITMASKS, 0x80u},
            {ARENA_SGPT, 0xBD8u}, {ARENA_ISC, 4u * 0x144u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x40u},
            {ARENA_STATS0, 0x40u}, {ARENA_STATS1, 0x40u}, {ARENA_STATS2, 0x40u}, {ARENA_OUT, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 11);
        eax = safe_stdcall4(0x6FD8A330u, listArg, 0u, (uint32_t)delta, layer, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",0,%d,%u", listArg, delta, layer);
        emit_rec(fp, "0x6FD8A330", "STATLIST_AddStatMemPort113c", c,
            c == 0 ? "null_or_zero_delta" : c == 1 ? "non_extended_base_only" :
            c == 2 ? "ext_player_records_mod" : c == 3 ? "ext_monster_cancels_to_zero" : "sublist_propagates_parent",
            args, regs, 11, asserted, eax, 0x00000000u);
    }

    /* 22/29: 0x6FD8A710 STATLIST_AddUnitStatMemPort113c */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x5Cu) = (c == 1) ? 0u : ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x08u) = (c == 3) ? 1u : 0u;
        U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
        U32(ARENA_STATLIST0 + 0x24u) = ARENA_STATS0; U16(ARENA_STATLIST0 + 0x2Au) = 4u;
        U32(ARENA_STATLIST0 + 0x48u) = ARENA_STATS1; U16(ARENA_STATLIST0 + 0x4Eu) = 4u;
        U32(ARENA_STATLIST0 + 0x50u) = ARENA_STATS2; U16(ARENA_STATLIST0 + 0x56u) = 4u;
        if (c == 3) {
            U16(ARENA_STATLIST0 + 0x28u) = 1u; U32(ARENA_STATS0 + 0u) = 0u; S32(ARENA_STATS0 + 4u) = 20;
            U16(ARENA_STATLIST0 + 0x4Cu) = 1u; U32(ARENA_STATS1 + 0u) = 0u; S32(ARENA_STATS1 + 4u) = 20;
        }
        int32_t delta = (c == 0) ? 0 : (c == 3) ? -7 : 40;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD90B0u, 4u}, {ARENA_BITMASKS, 0x80u},
            {ARENA_SGPT, 0xBD8u}, {ARENA_ISC, 4u * 0x144u},
            {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u},
            {ARENA_STATS0, 0x40u}, {ARENA_STATS1, 0x40u}, {ARENA_STATS2, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 10);
        eax = safe_stdcall4(0x6FD8A710u, ARENA_UNIT0, 0u, (uint32_t)delta, 0u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",0,%d,0", ARENA_UNIT0, delta);
        emit_rec(fp, "0x6FD8A710", "STATLIST_AddUnitStatMemPort113c", c,
            c == 0 ? "zero_delta_noop" : c == 1 ? "null_unit_statlist" :
            c == 2 ? "player_adds_40" : "monster_subtracts_7",
            args, regs, 10, asserted, eax, 0x00000000u);
    }

    /* 23/29: 0x6FD8AE60 STATLIST_ExpireStateListsOnModeChangeMemPort113c */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x2Cu) = ARENA_PATH0;
        U32(ARENA_PATH0 + 0x1Cu) = ARENA_ROOM0;
        U32(ARENA_ROOM0 + 0x2Cu) = ARENA_ACT0;
        U32(ARENA_UNIT0 + 0x5Cu) = (c == 0) ? 0u : ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10u) = (c == 0) ? 0x80000000u : 0x80000002u;
        U32(ARENA_STATLIST0 + 0x24u) = ARENA_STATS0; U16(ARENA_STATLIST0 + 0x2Au) = 4u;
        U32(ARENA_STATLIST0 + 0x48u) = ARENA_STATS1; U16(ARENA_STATLIST0 + 0x4Eu) = 4u;
        U32(ARENA_STATLIST0 + 0x58u) = ARENA_STATEFLAGS0;

        if (c == 2) {
            /* sub1 (has 0x04, state 5) -> prev sub2 (no 0x04, kept) */
            U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST1 + 0x04u) = ARENA_UNIT0;
            U32(ARENA_STATLIST1 + 0x10u) = 0x04u;
            U32(ARENA_STATLIST1 + 0x14u) = 5u;
            U32(ARENA_STATLIST1 + 0x24u) = ARENA_STATS2; U16(ARENA_STATLIST1 + 0x2Au) = 4u;
            U32(ARENA_STATLIST1 + 0x2Cu) = ARENA_STATLIST2;
            U32(ARENA_STATLIST1 + 0x34u) = ARENA_STATLIST0;
            U32(ARENA_STATLIST2 + 0x10u) = 0x40u;
            U32(ARENA_STATLIST2 + 0x30u) = ARENA_STATLIST1;
            U32(ARENA_STATLIST2 + 0x34u) = ARENA_STATLIST0;
            U32(ARENA_STATEFLAGS0 + 0u) = (1u << 5);
        } else if (c == 3) {
            /* Disguise state 10 -> clears dwFlags2 bit 0x08 */
            U8(ARENA_STATESTXT + 10u * 0x3Cu + 0x12u) = 1u;
            U32(ARENA_UNIT0 + 0xC8u) = 0x08u;
            U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST1 + 0x04u) = ARENA_UNIT0;
            U32(ARENA_STATLIST1 + 0x10u) = 0x04u;
            U32(ARENA_STATLIST1 + 0x14u) = 10u;
            U32(ARENA_STATLIST1 + 0x34u) = ARENA_STATLIST0;
            U32(ARENA_STATEFLAGS0 + 0u) = (1u << 10);
        } else if (c == 4) {
            /* Expired sub-list with stateNo == 0 -> skips toggle, still frees & clears 0x02 */
            U32(ARENA_STATLIST0 + 0x3Cu) = ARENA_STATLIST1;
            U32(ARENA_STATLIST1 + 0x04u) = ARENA_UNIT0;
            U32(ARENA_STATLIST1 + 0x10u) = 0x04u;
            U32(ARENA_STATLIST1 + 0x14u) = 0u;
            U32(ARENA_STATLIST1 + 0x34u) = ARENA_STATLIST0;
        }
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD9078u, 0x3Cu},
            {ARENA_BITMASKS, 0x80u}, {ARENA_INVBITMASKS, 0x80u},
            {ARENA_SGPT, 0x200u}, {ARENA_STATESTXT, 16u * 0x40u}, {ARENA_STATEMASKS, 40u * 24u},
            {ARENA_UNIT0, 0xF0u}, {ARENA_PATH0, 0x40u}, {ARENA_ROOM0, 0x80u}, {ARENA_ACT0, 0x40u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x40u}, {ARENA_STATLIST2, 0x40u},
            {ARENA_STATS0, 0x20u}, {ARENA_STATS1, 0x20u}, {ARENA_STATS2, 0x20u}, {ARENA_STATEFLAGS0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 18);
        eax = safe_stdcall1(0x6FD8AE60u, ARENA_UNIT0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
        emit_rec(fp, "0x6FD8AE60", "STATLIST_ExpireStateListsOnModeChangeMemPort113c", c,
            c == 0 ? "null_listex_noop" : c == 1 ? "flag2_empty_sublist" :
            c == 2 ? "expires_state5_keeps_other" : c == 3 ? "expires_disguise_clears_flag2" : "state0_skips_toggle_frees",
            args, regs, 18, asserted, eax, 0x00000000u);
    }

    /* 24/29: 0x6FD8C390 DUNGEON_CheckRoomIsTownMemPort113c */
    {
        static const uint32_t lvls[7] = { 0u, 1u, 2u, 40u, 75u, 103u, 109u };
        for (int c = 0; c < 7; c++) {
            setup_common_tables();
            U32(ARENA_ROOM0 + 0x10u) = ARENA_ROOMEX0;
            U32(ARENA_ROOMEX0 + 0x58u) = ARENA_LEVEL0;
            U32(ARENA_LEVEL0 + 0x1D0u) = lvls[c];
            uint32_t rArg = (c == 0) ? 0u : ARENA_ROOM0;
            mem_region_t regs[] = { {ARENA_ROOM0, 0x40u}, {ARENA_ROOMEX0, 0x80u}, {ARENA_LEVEL0, 0x200u} };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
            eax = safe_stdcall1(0x6FD8C390u, rArg, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\"", rArg);
            emit_rec(fp, "0x6FD8C390", "DUNGEON_CheckRoomIsTownMemPort113c", c,
                c == 0 ? "null_room" : c == 1 ? "act1_town_1" : c == 2 ? "blood_moor_0" :
                c == 3 ? "act2_town_40" : c == 4 ? "act3_town_75" : c == 5 ? "act4_town_103" : "act5_town_109",
                args, regs, 3, asserted, eax, 0xFFFFFFFFu);
        }
    }

    /* 25/29: 0x6FD8C720 DUNGEON_AllocActiveRoom113c */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        U8(ARENA_LIBF0 + 0x28u) = 0x02u;
        U32(ARENA_ACT0 + 0x10u) = (c == 1) ? ARENA_ROOM1 : 0u;
        U32(ARENA_ACT0 + 0x4Cu) = (c == 2) ? ARENA_CB5 : 0u;
        U32(ARENA_ACT0 + 0x5Cu) = 0x1111u;
        U32(ARENA_COORDS0 + 0x00u) = 50u; U32(ARENA_COORDS0 + 0x04u) = 50u;
        U32(ARENA_COORDS0 + 0x08u) = 10u; U32(ARENA_COORDS0 + 0x0Cu) = 10u;
        U32(ARENA_COORDS0 + 0x10u) = 10u; U32(ARENA_COORDS0 + 0x14u) = 10u;
        U32(ARENA_COORDS0 + 0x18u) = 2u;  U32(ARENA_COORDS0 + 0x1Cu) = 2u;
        U32(ARENA_NEAREX0 + 0u) = ARENA_ROOMEX0;
        U32(ARENA_ROOMEX0 + 0x08u) = ARENA_NEAREX0;
        U32(ARENA_ROOMEX0 + 0x2Cu) = (c == 0) ? 0u : 1u;
        if (c == 3) {
            U32(ARENA_TILEGRID0 + 0x08u) = ARENA_FLOORS0;
            U32(ARENA_TILEGRID0 + 0x0Cu) = 1u;
            U32(ARENA_FLOORS0 + 0x14u) = 0x02u;
            U32(ARENA_FLOORS0 + 0x18u) = ARENA_LIBF0;
        }
        uint32_t seedArg = 0x55AA00u + (uint32_t)c;
        mem_region_t regs[] = {
            {ARENA_ACT0, 0x60u}, {ARENA_ROOM1, 0x80u}, {ARENA_ROOMEX0, 0xECu},
            {ARENA_COORDS0, 0x20u}, {ARENA_TILEGRID0, 0x20u}, {ARENA_FLOORS0, 0x30u},
            {ARENA_LIBF0, 0x50u}, {ARENA_NEAREX0, 0x10u}, {ARENA_OUT, 0x10u}, {ARENA_CB5, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 10);
        eax = safe_stdcall6(0x6FD8C720u, ARENA_ACT0, ARENA_ROOMEX0, ARENA_COORDS0, ARENA_TILEGRID0, seedArg, 4u, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",\"0x%08X\",\"0x%08X\",\"0x%08X\",4",
            ARENA_ACT0, ARENA_ROOMEX0, ARENA_COORDS0, ARENA_TILEGRID0, seedArg);
        emit_rec(fp, "0x6FD8C720", "DUNGEON_AllocActiveRoom113c", c,
            c == 0 ? "zero_neighbors" : c == 1 ? "links_prev_room" :
            c == 2 ? "invokes_act_cb" : "populates_floor_coll",
            args, regs, 10, asserted, eax, 0xFFFFFFFFu);
    }

    /* 26/29: 0x6FD9F200 SKILLS_GetThrowingWeaponMasteryBonus113c */
    for (int c = 0; c < 7; c++) {
        setup_common_tables();
        U32(ARENA_SKILL0 + 0x00u) = ARENA_SKILLSTXT + 1u * 0x23Cu; /* throwing skill */
        U32(ARENA_SKILL1 + 0x00u) = ARENA_SKILLSTXT + 2u * 0x23Cu; /* melee skill */
        U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
        U32(ARENA_UNIT0 + 0xA8u) = ARENA_SKINFO0;
        U32(ARENA_SKINFO0 + 0x10u) = (c == 1) ? 0u : ARENA_SKILL0;
        U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
        U32(ARENA_STATLIST0 + 0x48u) = ARENA_STATS0;
        U16(ARENA_STATLIST0 + 0x4Cu) = 3u; U16(ARENA_STATLIST0 + 0x4Eu) = 8u;
        U32(ARENA_STATS0 + 0u)  = (0x159u << 16) | 0x1Eu; U32(ARENA_STATS0 + 4u)  = 90u; /* wrong type for knife */
        U32(ARENA_STATS0 + 8u)  = (0x159u << 16) | 0x2Cu; U32(ARENA_STATS0 + 12u) = 25u;
        U32(ARENA_STATS0 + 16u) = (0x15Au << 16) | 0x2Cu; U32(ARENA_STATS0 + 20u) = 60u;
        U16(ARENA_STATLIST0 + 0x4Cu) = 4u;
        U32(ARENA_STATS0 + 24u) = (0x15Bu << 16) | 0x2Cu; U32(ARENA_STATS0 + 28u) = 35u;

        setup_item_basic(ARENA_ITEM0, 501u, (c == 2) ? 0u : 1u, ARENA_ITEMDATA0);
        U32(ARENA_OUT) = 0x77777777u;

        uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
        uint32_t skArg = (c <= 1) ? 0u : ARENA_SKILL0;
        uint32_t bType = (c == 4) ? 1u : (c == 5) ? 2u : (c == 6) ? 3u : 0u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD90B0u, 4u}, {0x6FDEFB94u, 8u}, {0x6FDEFF6Cu, 4u},
            {ARENA_BITMASKS, 0x80u}, {ARENA_SGPT, 0xC10u}, {ARENA_ITEMTYPES, 0x3000u},
            {ARENA_ITYPEMAT, 0x500u}, {ARENA_ITEMSTXT, 0x400u}, {ARENA_ITEMSLINK, 0x40u},
            {ARENA_SKILLSTXT, 3u * 0x23Cu}, {ARENA_UNIT0, 0xC0u}, {ARENA_SKINFO0, 0x20u},
            {ARENA_SKILL0, 0x20u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x40u},
            {ARENA_ITEM0, 0x20u}, {ARENA_OUT, 8u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 18);
        eax = safe_stdcall5(0x6FD9F200u, uArg, ARENA_ITEM0, skArg, bType, ARENA_OUT, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",\"0x%08X\",%u,\"0x%08X\"",
            uArg, ARENA_ITEM0, skArg, bType, ARENA_OUT);
        emit_rec(fp, "0x6FD9F200", "SKILLS_GetThrowingWeaponMasteryBonus113c", c,
            c == 0 ? "null_unit_null_skill_assert" : c == 1 ? "no_used_skill_0" :
            c == 2 ? "melee_weapon_not_throw" : c == 3 ? "throw_th_25" :
            c == 4 ? "throw_dmg_60" : c == 5 ? "throw_crit_35" : "invalid_btype_0",
            args, regs, 18, asserted, eax, 0xFFFFFFFFu);
    }

    /* 27/29: 0x6FD9F640 SKILLS_GetWeaponMasteryBonusMemPort113c */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        U32(ARENA_SKILL0 + 0x00u) = ARENA_SKILLSTXT + 1u * 0x23Cu;
        U32(ARENA_SKILL1 + 0x00u) = ARENA_SKILLSTXT + 2u * 0x23Cu;
        U32(ARENA_UNIT0 + 0x5Cu) = ARENA_STATLIST0;
        U32(ARENA_UNIT0 + 0xA8u) = ARENA_SKINFO0;
        U32(ARENA_SKINFO0 + 0x10u) = (c == 1) ? ARENA_SKILL0 : ARENA_SKILL1;
        U32(ARENA_STATLIST0 + 0x10u) = 0x80000000u;
        U32(ARENA_STATLIST0 + 0x48u) = ARENA_STATS0;
        U16(ARENA_STATLIST0 + 0x4Cu) = 5u; U16(ARENA_STATLIST0 + 0x4Eu) = 8u;
        /* Sorted ascending by dwKey: 0x156, 0x157, 0x158, 0x159 */
        U32(ARENA_STATS0 + 0u)  = (0x156u << 16) | 0x1Eu; U32(ARENA_STATS0 + 4u)  = 50u;
        U32(ARENA_STATS0 + 8u)  = (0x156u << 16) | 0x2Cu; U32(ARENA_STATS0 + 12u) = 95u; /* non-matching for sword */
        U32(ARENA_STATS0 + 16u) = (0x157u << 16) | 0x1Eu; U32(ARENA_STATS0 + 20u) = 80u;
        U32(ARENA_STATS0 + 24u) = (0x158u << 16) | 0x1Eu; U32(ARENA_STATS0 + 28u) = 22u;
        U32(ARENA_STATS0 + 32u) = (0x159u << 16) | 0x2Cu; U32(ARENA_STATS0 + 36u) = 45u;

        setup_item_basic(ARENA_ITEM0, 601u, (c == 1) ? 1u : 0u, ARENA_ITEMDATA0);
        uint32_t uArg = (c == 0) ? 0u : ARENA_UNIT0;
        uint32_t bType = (c == 3) ? 1u : (c == 4) ? 2u : (c == 5) ? 5u : 0u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDD90B0u, 4u}, {0x6FDEFB94u, 8u}, {0x6FDEFF6Cu, 4u},
            {ARENA_BITMASKS, 0x80u}, {ARENA_SGPT, 0xC10u}, {ARENA_ITEMTYPES, 0x3000u},
            {ARENA_ITYPEMAT, 0x500u}, {ARENA_ITEMSTXT, 0x400u}, {ARENA_ITEMSLINK, 0x40u},
            {ARENA_SKILLSTXT, 3u * 0x23Cu}, {ARENA_UNIT0, 0xC0u}, {ARENA_SKINFO0, 0x20u},
            {ARENA_SKILL0, 0x20u}, {ARENA_SKILL1, 0x20u}, {ARENA_STATLIST0, 0x80u},
            {ARENA_STATS0, 0x40u}, {ARENA_ITEM0, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 18);
        eax = safe_stdcall4(0x6FD9F640u, uArg, ARENA_ITEM0, 0u, bType, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",0,%u", uArg, ARENA_ITEM0, bType);
        emit_rec(fp, "0x6FD9F640", "SKILLS_GetWeaponMasteryBonusMemPort113c", c,
            c == 0 ? "null_unit_0" : c == 1 ? "throwing_mastery_45" : c == 2 ? "melee_th_50" :
            c == 3 ? "melee_dmg_80" : c == 4 ? "melee_crit_22" : "invalid_btype_0",
            args, regs, 18, asserted, eax, 0xFFFFFFFFu);
    }

    /* 28/29: 0x6FDC19A0 DATATBLS_GetItemsTxtRecordMemPort113c */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        if (c == 4) U32(0x6FDEFB98u) = 0u;
        uint32_t idArg = (c == 0 || c == 4) ? 0u : (c == 1) ? 5u : (c == 2) ? 16u : 0xFFFFFFFFu;
        mem_region_t regs[] = { {0x6FDEFB94u, 8u} };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 1);
        eax = safe_stdcall1(0x6FDC19A0u, idArg, &asserted);
        snprintf(args, sizeof(args), "%u", idArg);
        emit_rec(fp, "0x6FDC19A0", "DATATBLS_GetItemsTxtRecordMemPort113c", c,
            c == 0 ? "id_0_base" : c == 1 ? "id_5_stride" : c == 2 ? "id_eq_count_0" :
            c == 3 ? "id_neg1_0" : "null_table_assert_0x1ef",
            args, regs, 1, asserted, eax, 0xFFFFFFFFu);
    }

    /* 29/29: 0x6FDCF6A0 COLLISION_FindAdjacentUnitWithCallback113c */
    for (int c = 0; c < 6; c++) {
        setup_common_tables();
        U32(ARENA_ROOM0 + 0x00u) = ARENA_ROOMLIST0;
        U32(ARENA_ROOM0 + 0x20u) = ARENA_COLL0;
        U32(ARENA_ROOM0 + 0x24u) = 1u;
        U32(ARENA_ROOM0 + 0x2Cu) = ARENA_ACT0;
        S32(ARENA_ROOM0 + 0x4Cu) = 100; S32(ARENA_ROOM0 + 0x50u) = 100;
        S32(ARENA_ROOM0 + 0x54u) = 10;  S32(ARENA_ROOM0 + 0x58u) = 10;
        S32(ARENA_COLL0 + 0x00u) = 100; S32(ARENA_COLL0 + 0x04u) = 100;
        S32(ARENA_COLL0 + 0x08u) = 10;  S32(ARENA_COLL0 + 0x0Cu) = 10;
        U32(ARENA_COLL0 + 0x20u) = ARENA_COLLMAP0;
        U32(ARENA_ROOMLIST0 + 0u) = ARENA_ROOM0;

        /* u0: dead player (mode 17 -> skipped) */
        U32(ARENA_UNIT0 + 0x00u) = 0u; U32(ARENA_UNIT0 + 0x10u) = 17u; U32(ARENA_UNIT0 + 0x0Cu) = 0x5555u;
        U32(ARENA_UNIT0 + 0x2Cu) = ARENA_PATH0; U16(ARENA_PATH0 + 0x02u) = 105u; U16(ARENA_PATH0 + 0x06u) = 104u;

        /* u1: monster size 2 (or size 3 in c==5, dead in c==4) at (105, 104) */
        U32(ARENA_UNIT1 + 0x00u) = 1u;
        U32(ARENA_UNIT1 + 0x04u) = (c == 5) ? 2u : 1u;
        U32(ARENA_UNIT1 + 0x10u) = (c == 4) ? 12u : 1u;
        U32(ARENA_UNIT1 + 0x0Cu) = 0x5555u;
        U32(ARENA_UNIT1 + 0x2Cu) = ARENA_PATH1;
        U16(ARENA_PATH1 + 0x02u) = 105u; U16(ARENA_PATH1 + 0x06u) = 104u;

        /* u2: missile size 1 at (105, 105) (or object in c==4) */
        U32(ARENA_UNIT2 + 0x00u) = (c == 4) ? 2u : 3u;
        U32(ARENA_UNIT2 + 0x04u) = 0u;
        U32(ARENA_UNIT2 + 0x0Cu) = 0x7777u;
        U32(ARENA_UNIT2 + 0x2Cu) = ARENA_PATH2;
        if (c == 4) {
            U32(ARENA_PATH2 + 0x00u) = ARENA_ROOM0;
            U32(ARENA_PATH2 + 0x0Cu) = 105u;
            U32(ARENA_PATH2 + 0x10u) = 105u;
            U32(ARENA_UNIT2 + 0x14u) = ARENA_OBJDATA0;
            U32(ARENA_OBJDATA0 + 0x00u) = ARENA_OBJTXT0;
            U32(ARENA_OBJTXT0 + 0xD0u) = 1u;
        } else {
            U16(ARENA_PATH2 + 0x02u) = 105u;
            U16(ARENA_PATH2 + 0x06u) = 105u;
        }

        U32(ARENA_UNIT0 + 0xE8u) = ARENA_UNIT1;
        U32(ARENA_UNIT1 + 0xE8u) = ARENA_UNIT2;
        U32(ARENA_ROOM0 + 0x74u) = ARENA_UNIT0;

        uint32_t roomArg = (c == 0) ? 0u : ARENA_ROOM0;
        uint32_t qx = (c == 1) ? 105u : (c == 5) ? 107u : 104u;
        uint32_t qy = (c == 1) ? 105u : (c == 5) ? 102u : 104u;
        uint32_t rType = (c == 0) ? 4u : (c == 1) ? 1u : (c == 2 || c == 4) ? 2u : 3u;
        uint32_t ctx = (c == 1 || c == 3) ? 0x7777u : 0x5555u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4u}, {0x6FDF0950u, 12u}, {ARENA_SGPT, 0xB80u},
            {ARENA_MONSTATS, 4u * 0x1A8u}, {ARENA_MONSTATS2, 4u * 0x134u}, {ARENA_MISSILESTXT, 0x200u},
            {ARENA_ROOM0, 0x80u}, {ARENA_ACT0, 0x40u}, {ARENA_ROOMLIST0, 0x20u}, {ARENA_COLL0, 0x30u}, {ARENA_COLLMAP0, 0x100u},
            {ARENA_UNIT0, 0xF0u}, {ARENA_UNIT1, 0xF0u}, {ARENA_UNIT2, 0xF0u},
            {ARENA_OBJDATA0, 0x20u}, {ARENA_OBJTXT0, 0xE0u},
            {ARENA_PATH0, 0x40u}, {ARENA_PATH1, 0x40u}, {ARENA_PATH2, 0x40u},
            {ARENA_OUT, 0x10u}, {ARENA_CB6, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 21);
        eax = safe_stdcall6(0x6FDCF6A0u, roomArg, qx, qy, ARENA_CB6, ctx, rType, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",%u,%u,\"0x%08X\",\"0x%08X\",%u",
            roomArg, qx, qy, ARENA_CB6, ctx, rType);
        emit_rec(fp, "0x6FDCF6A0", "COLLISION_FindAdjacentUnitWithCallback113c", c,
            c == 0 ? "null_room_or_bad_range" : c == 1 ? "range1_size1_exact" :
            c == 2 ? "range2_size2_manhattan" : c == 3 ? "range3_cb_skips_u1_hits_u2" :
            c == 4 ? "skips_dead_and_obj_0" : "range3_size3_box_corner",
            args, regs, 21, asserted, eax, 0xFFFFFFFFu);
    }
}

int main(int argc, char **argv) {
    SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX);
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
        if (!VirtualProtect((LPVOID)0x6FDE3000u, 0xB000u, PAGE_READWRITE, &rdataProt)) return 1;
    }

    g_orig_iat_assert  = U32(0x6FDD90D4u);
    g_orig_iat_alloc   = U32(0x6FDD90D0u);
    g_orig_iat_free    = U32(0x6FDD90CCu);
    g_orig_iat_free2   = U32(0x6FDD90A8u);
    g_orig_iat_realloc = U32(0x6FDD90ACu);

    /* Initialize D2Common log critical section 0x6FDF13E0 & obtain internal libcmt FILE* on "NUL" */
    ((stdcall1_t)(uintptr_t)0x6FD62C90u)((uint32_t)(uintptr_t)"NUL");
    g_d2c_nul_fp = U32(0x6FDF1470u);
    U32(0x6FDF1470u) = 0u;
    U32(0x6FDF1474u) = 0u;

    const char *out1 = (argc > 1) ? argv[1] : "k1r13-i14d-1.ndjson";
    FILE *fp1 = fopen(out1, "wb");
    if (!fp1) return 1;
    emit_all_29(fp1);
    fclose(fp1);

    TerminateProcess(GetCurrentProcess(), 0);
    return 0;
}
