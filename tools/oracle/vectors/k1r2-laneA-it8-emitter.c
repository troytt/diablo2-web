#define _WIN32_WINNT 0x0501
#include <windows.h>
#include <setjmp.h>
#include <stdio.h>
#include <stdint.h>
#include <string.h>

static uint8_t *g_arena = NULL;
#define ARENA_BASE       0x03500000u
#define ARENA_SIZE       0x00100000u

#define ARENA_SGPT       (ARENA_BASE + 0x0000u)
#define ARENA_UNIT0      (ARENA_BASE + 0x1000u)
#define ARENA_UNIT1      (ARENA_BASE + 0x1200u)
#define ARENA_ITEM0      (ARENA_BASE + 0x1400u)
#define ARENA_ITEM1      (ARENA_BASE + 0x1600u)
#define ARENA_ITEMDATA0  (ARENA_BASE + 0x1800u)
#define ARENA_ITEMDATA1  (ARENA_BASE + 0x1A00u)
#define ARENA_INV0       (ARENA_BASE + 0x1C00u)
#define ARENA_GRIDS      (ARENA_BASE + 0x1E00u)
#define ARENA_GRIDCELLS0 (ARENA_BASE + 0x2000u)
#define ARENA_GRIDCELLS1 (ARENA_BASE + 0x2200u)
#define ARENA_STATLIST0  (ARENA_BASE + 0x2400u)
#define ARENA_STATLIST1  (ARENA_BASE + 0x2600u)
#define ARENA_STATLIST2  (ARENA_BASE + 0x2800u)
#define ARENA_STATHIST   (ARENA_BASE + 0x2A00u)
#define ARENA_STATS0     (ARENA_BASE + 0x2C00u)
#define ARENA_STATS1     (ARENA_BASE + 0x2E00u)
#define ARENA_STATS2     (ARENA_BASE + 0x3000u)
#define ARENA_MODSTATS   (ARENA_BASE + 0x3200u)
#define ARENA_PATH0      (ARENA_BASE + 0x3400u)
#define ARENA_ROOM0      (ARENA_BASE + 0x3600u)
#define ARENA_SKILLINFO  (ARENA_BASE + 0x3800u)
#define ARENA_SKILL0     (ARENA_BASE + 0x3900u)
#define ARENA_MONDATA0   (ARENA_BASE + 0x3A00u)
#define ARENA_MONSEQ     (ARENA_BASE + 0x3C00u)
#define ARENA_DMG        (ARENA_BASE + 0x3E00u)
#define ARENA_OUT        (ARENA_BASE + 0x4000u)
#define ARENA_STATEMASKS (ARENA_BASE + 0x4400u)
#define ARENA_ITYPEMAT   (ARENA_BASE + 0x4800u)
#define ARENA_PCLASSTXT  (ARENA_BASE + 0x4C00u)
#define ARENA_BODYLOCS   (ARENA_BASE + 0x4E00u)
#define ARENA_ISC        (ARENA_BASE + 0x10000u)
#define ARENA_ITEMSTXT   (ARENA_BASE + 0x30000u)
#define ARENA_MONSTATS   (ARENA_BASE + 0x40000u)
#define ARENA_MONLVL     (ARENA_BASE + 0x50000u)
#define ARENA_SKILLSTXT  (ARENA_BASE + 0x60000u)

#define U32(addr) (*(volatile uint32_t *)((uintptr_t)(addr)))
#define U16(addr) (*(volatile uint16_t *)((uintptr_t)(addr)))
#define U8(addr)  (*(volatile uint8_t  *)((uintptr_t)(addr)))
#define S32(addr) (*(volatile int32_t  *)((uintptr_t)(addr)))
#define S16(addr) (*(volatile int16_t  *)((uintptr_t)(addr)))

typedef uint32_t (__stdcall *stdcall1_t)(uint32_t);
typedef uint32_t (__stdcall *stdcall2_t)(uint32_t, uint32_t);
typedef uint32_t (__stdcall *stdcall3_t)(uint32_t, uint32_t, uint32_t);
typedef uint32_t (__stdcall *stdcall5_t)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
typedef uint32_t (__stdcall *stdcall6_t)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
typedef uint32_t (__stdcall *stdcall7_t)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);

/* 0x6FD89380: eax=pStatList, esi=nStatId, [esp+4]=nLayer -> ret 4 */
static __attribute__((noinline)) uint32_t call_6FD89380(uint32_t fn, uint32_t pStatList, uint32_t nStatId, uint32_t nLayer) {
    uint32_t io_eax = pStatList, io_ecx = nLayer, io_edx = fn, io_esi = nStatId;
    __asm__ volatile (
        "pushl %%ecx\n\t"
        "call *%%edx\n\t"
        : "+a"(io_eax), "+c"(io_ecx), "+d"(io_edx), "+S"(io_esi)
        :
        : "cc", "memory"
    );
    return io_eax;
}

/* 0x6FD894E0: ecx=pStatList, eax=nStatId, [esp+4]=nLayer -> ret 4 */
static __attribute__((noinline)) uint32_t call_6FD894E0(uint32_t fn, uint32_t pStatList, uint32_t nStatId, uint32_t nLayer) {
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

/* 0x6FDBAB20: eax=pUnit, ecx=nElemType, esi=nDamage -> ret 0 */
static __attribute__((noinline)) uint32_t call_6FDBAB20(uint32_t fn, uint32_t pUnit, uint32_t nElemType, uint32_t nDamage) {
    uint32_t io_eax = pUnit, io_ecx = nElemType, io_edx = fn, io_esi = nDamage;
    __asm__ volatile (
        "call *%%edx\n\t"
        : "+a"(io_eax), "+c"(io_ecx), "+d"(io_edx), "+S"(io_esi)
        :
        : "cc", "memory"
    );
    return io_eax;
}

/* 0x6FDBABE0: esi=pDmgData, [esp+4]=pUnit, [esp+8]=nShift -> ret 8 */
static __attribute__((noinline)) void call_6FDBABE0(uint32_t fn, uint32_t pDmgData, uint32_t pUnit, uint32_t nShift) {
    uint32_t io_eax = pUnit, io_ecx = nShift, io_edx = fn, io_esi = pDmgData;
    __asm__ volatile (
        "pushl %%ecx\n\t"
        "pushl %%eax\n\t"
        "call *%%edx\n\t"
        : "+a"(io_eax), "+c"(io_ecx), "+d"(io_edx), "+S"(io_esi)
        :
        : "cc", "memory"
    );
}

/* 0x6FDBB180: eax=pUnit, [esp+4]=pWeapon -> ret 4 */
static __attribute__((noinline)) uint32_t call_6FDBB180(uint32_t fn, uint32_t pUnit, uint32_t pWeapon) {
    uint32_t io_eax = pUnit, io_ecx = pWeapon, io_edx = fn;
    __asm__ volatile (
        "pushl %%ecx\n\t"
        "call *%%edx\n\t"
        : "+a"(io_eax), "+c"(io_ecx), "+d"(io_edx)
        :
        : "cc", "memory"
    );
    return io_eax;
}

/* 0x6FD5D540: esi=pDynamicPath -> ret 0 */
static __attribute__((noinline)) void call_6FD5D540(uint32_t fn, uint32_t pDynamicPath) {
    uint32_t io_eax = fn, io_esi = pDynamicPath;
    __asm__ volatile (
        "call *%%eax\n\t"
        : "+a"(io_eax), "+S"(io_esi)
        :
        : "ecx", "edx", "cc", "memory"
    );
}

/* 0x6FD6F720: edx=pItem, [esp+4]=pGrid, [esp+8]=bUseItemDims -> ret 8 */
static __attribute__((noinline)) void call_6FD6F720(uint32_t fn, uint32_t pItem, uint32_t pGrid, uint32_t bUseItemDims) {
    uint32_t io_eax = pGrid, io_ecx = bUseItemDims, io_edx = pItem, io_esi = fn;
    __asm__ volatile (
        "pushl %%ecx\n\t"
        "pushl %%eax\n\t"
        "call *%%esi\n\t"
        : "+a"(io_eax), "+c"(io_ecx), "+d"(io_edx), "+S"(io_esi)
        :
        : "cc", "memory"
    );
}

/* 0x6FD823E0: eax=nTableIdx, [esp+4]=pUnit -> ret 4 */
static __attribute__((noinline)) uint32_t call_6FD823E0(uint32_t fn, uint32_t nTableIdx, uint32_t pUnit) {
    uint32_t io_eax = nTableIdx, io_ecx = pUnit, io_edx = fn;
    __asm__ volatile (
        "pushl %%ecx\n\t"
        "call *%%edx\n\t"
        : "+a"(io_eax), "+c"(io_ecx), "+d"(io_edx)
        :
        : "cc", "memory"
    );
    return io_eax;
}

/* 0x6FD84080: ecx=pMaskArray, [esp+4]=pUnit -> ret 4 */
static __attribute__((noinline)) void call_6FD84080(uint32_t fn, uint32_t pMaskArray, uint32_t pUnit) {
    uint32_t io_eax = pUnit, io_ecx = pMaskArray, io_edx = fn;
    __asm__ volatile (
        "pushl %%eax\n\t"
        "call *%%edx\n\t"
        : "+a"(io_eax), "+c"(io_ecx), "+d"(io_edx)
        :
        : "cc", "memory"
    );
}

typedef struct {
    uint32_t base;
    uint32_t len;
} mem_region_t;

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
    fputc(']', fp);
}

static void emit_vector(
    FILE *fp,
    const char *va,
    const char *name,
    int case_idx,
    const char *note,
    const char *args_json,
    const mem_region_t *pre_regions,
    int pre_count,
    const char *pre_hex_array,
    uint32_t ret_eax,
    uint32_t ret_mask,
    const mem_region_t *post_regions,
    int post_count
) {
    fprintf(fp, "{\"va\":\"%s\",\"name\":\"%s\",\"caseIndex\":%d,\"note\":\"%s\",\"inputs\":{\"args\":[%s],\"memory\":%s},\"outputs\":{\"eax\":\"0x%08X\",\"retMask\":\"0x%08X\",\"memory\":",
        va, name, case_idx, note, args_json, pre_hex_array, ret_eax, ret_mask);
    emit_regions_json(fp, post_regions, post_count);
    fputs("}}\n", fp);
    (void)pre_regions;
    (void)pre_count;
}

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

static void setup_common_tables(void) {
    memset(g_arena, 0, ARENA_SIZE);
    U32(0x6FDE9E1C) = ARENA_SGPT;
    U32(ARENA_SGPT + 0x000) = ARENA_PCLASSTXT;
    U32(ARENA_SGPT + 0x008) = ARENA_BODYLOCS;
    U32(ARENA_SGPT + 0x0C4) = 184;
    U32(ARENA_SGPT + 0x100) = ARENA_STATEMASKS + 0x00u;
    U32(ARENA_SGPT + 0x104) = ARENA_STATEMASKS + 0x20u;
    U32(ARENA_SGPT + 0x108) = ARENA_STATEMASKS + 0x40u;
    U32(ARENA_SGPT + 0xA78) = ARENA_MONSTATS;
    U32(ARENA_SGPT + 0xA80) = 10;
    U32(ARENA_SGPT + 0xB70) = ARENA_MONLVL;
    U32(ARENA_SGPT + 0xB74) = 10;
    U32(ARENA_SGPT + 0xB98) = ARENA_SKILLSTXT;
    U32(ARENA_SGPT + 0xBA0) = 10;
    U32(ARENA_SGPT + 0xBCC) = ARENA_ISC;
    U32(ARENA_SGPT + 0xBD4) = 359;
    U32(ARENA_SGPT + 0xBFC) = 64;
    U32(ARENA_SGPT + 0xC00) = 2;
    U32(ARENA_SGPT + 0xC04) = ARENA_ITYPEMAT;

    U32(0x6FDEFB94) = 10;
    U32(0x6FDEFB98) = ARENA_ITEMSTXT;

    /* Item 0: sword (type 0x1E, 2x3) */
    U32(ARENA_ITEMSTXT + 0 * 0x1A8u + 0x80u) = 0x2064736Cu;
    U8(ARENA_ITEMSTXT  + 0 * 0x1A8u + 0x10Fu) = 2;
    U8(ARENA_ITEMSTXT  + 0 * 0x1A8u + 0x110u) = 3;
    U16(ARENA_ITEMSTXT + 0 * 0x1A8u + 0x11Eu) = 0x1Eu;
    /* Item 1: shield (type 0x33, 2x2) */
    U32(ARENA_ITEMSTXT + 1 * 0x1A8u + 0x80u) = 0x20637562u;
    U8(ARENA_ITEMSTXT  + 1 * 0x1A8u + 0x10Fu) = 2;
    U8(ARENA_ITEMSTXT  + 1 * 0x1A8u + 0x110u) = 2;
    U16(ARENA_ITEMSTXT + 1 * 0x1A8u + 0x11Eu) = 0x33u;
    /* Item 2..7: stackables hp1, hp2, mp1, mp2, rvl, rvs */
    U32(ARENA_ITEMSTXT + 2 * 0x1A8u + 0x80u) = 0x20317068u;
    U32(ARENA_ITEMSTXT + 3 * 0x1A8u + 0x80u) = 0x20327068u;
    U32(ARENA_ITEMSTXT + 4 * 0x1A8u + 0x80u) = 0x2031706Du;
    U32(ARENA_ITEMSTXT + 5 * 0x1A8u + 0x80u) = 0x2032706Du;
    U32(ARENA_ITEMSTXT + 6 * 0x1A8u + 0x80u) = 0x206C7672u;
    U32(ARENA_ITEMSTXT + 7 * 0x1A8u + 0x80u) = 0x20737672u;

    /* ItemTypes bit matrix: row 0x1E has bit 0x1E and bit 0x2D (45 -> word 1 bit 13); row 0x33 has bit 0x33 (51 -> word 1 bit 19) */
    U32(ARENA_ITYPEMAT + 0x1Eu * 8u + 0u) = (1u << 30);
    U32(ARENA_ITYPEMAT + 0x1Eu * 8u + 4u) = (1u << (0x2Du - 32u));
    U32(ARENA_ITYPEMAT + 0x33u * 8u + 4u) = (1u << (0x33u - 32u));
}

static char g_pre_buf[262144];

static void setup_unit_with_statlist(uint32_t statId, int32_t baseVal, int32_t fullVal) {
    setup_common_tables();
    U32(ARENA_UNIT0 + 0x00) = 0; /* UNIT_PLAYER */
    U32(ARENA_UNIT0 + 0x5C) = ARENA_STATLIST0;
    U32(ARENA_STATLIST0 + 0x10) = 0x80000000u;
    U32(ARENA_STATLIST0 + 0x24) = ARENA_STATS0;
    U16(ARENA_STATLIST0 + 0x28) = 1;
    U16(ARENA_STATLIST0 + 0x2A) = 8;
    U32(ARENA_STATLIST0 + 0x44) = ARENA_UNIT0;
    U32(ARENA_STATLIST0 + 0x48) = ARENA_STATS1;
    U16(ARENA_STATLIST0 + 0x4C) = 1;
    U16(ARENA_STATLIST0 + 0x4E) = 8;
    U32(ARENA_STATS0 + 0) = (statId << 16);
    S32(ARENA_STATS0 + 4) = baseVal;
    U32(ARENA_STATS1 + 0) = (statId << 16);
    S32(ARENA_STATS1 + 4) = fullVal;
}

static void emit_b043_part1(FILE *fp) {
    char args[128];
    /* #01: 0x6FD81B40 UNITS_GetMonsterActiveWeapon113c */
    for (int c = 0; c < 3; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00) = (c == 0) ? 0 : 1; /* player vs monster */
        U32(ARENA_UNIT0 + 0x60) = (c >= 1) ? ARENA_INV0 : 0;
        U32(ARENA_INV0 + 0x00) = 0x01020304u;
        U32(ARENA_INV0 + 0x14) = ARENA_GRIDS;
        U32(ARENA_INV0 + 0x18) = 1;
        U32(ARENA_INV0 + 0x1C) = 0xFFFFFFFFu;
        U8(ARENA_GRIDS + 0x08) = 13;
        U8(ARENA_GRIDS + 0x09) = 1;
        U32(ARENA_GRIDS + 0x0C) = ARENA_GRIDCELLS0;
        if (c == 2) {
            U32(ARENA_GRIDCELLS0 + 4 * 4) = ARENA_ITEM0;
            U32(ARENA_ITEM0 + 0x00) = 4;
            U32(ARENA_ITEM0 + 0x04) = 0; /* sword */
            U32(ARENA_ITEM0 + 0x0C) = 101;
            U32(ARENA_ITEM0 + 0x14) = ARENA_ITEMDATA0;
        }
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDEFB94u, 8}, {0x6FDD9088u, 0xACu}, {0x6FDED378u, 0x18u},
            {ARENA_SGPT, 0xC10u}, {ARENA_UNIT0, 0x100u}, {ARENA_INV0, 0x40u},
            {ARENA_GRIDS, 0x20u}, {ARENA_GRIDCELLS0, 0x40u}, {ARENA_ITEM0, 0x40u},
            {ARENA_ITEMDATA0, 0x40u}, {ARENA_ITEMSTXT, 0x1A8u}, {ARENA_ITYPEMAT, 0x200u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 13);
        uint32_t pUnit = (c == 0) ? 0 : ARENA_UNIT0;
        uint32_t eax = ((stdcall1_t)(uintptr_t)0x6FD81B40u)(pUnit);
        snprintf(args, sizeof(args), "\"0x%08X\"", pUnit);
        emit_vector(fp, "0x6FD81B40", "UNITS_GetMonsterActiveWeapon113c", c,
            c == 0 ? "null_unit" : (c == 1 ? "monster_no_weapon" : "monster_equipped_sword"),
            args, regs, 13, g_pre_buf, eax, 0xFFFFFFFFu, regs, 13);
    }

    /* #02: 0x6FD88FF0 STATLIST_GetMaxDurabilityFromUnit113c */
    for (int c = 0; c < 2; c++) {
        setup_unit_with_statlist(0x49u, c == 0 ? 0 : 40, 55);
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {ARENA_ISC + 0x49u * 0x144u, 0x144u}, {ARENA_UNIT0, 0x80u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x20u}, {ARENA_STATS1, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
        uint32_t eax = ((stdcall1_t)(uintptr_t)0x6FD88FF0u)(ARENA_UNIT0);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
        emit_vector(fp, "0x6FD88FF0", "STATLIST_GetMaxDurabilityFromUnit113c", c,
            c == 0 ? "zero_base_durability" : "nonzero_base_durability",
            args, regs, 8, g_pre_buf, eax, 0xFFFFFFFFu, regs, 8);
    }
}

static void emit_b043_part2(FILE *fp) {
    char args[160];
    /* #03..#05: MaxStamina (0x6FD89050, 0x0B), MaxMana (0x6FD890A0, 0x09), MaxLife (0x6FD890F0, 0x07) */
    const uint32_t max_vas[3] = {0x6FD89050u, 0x6FD890A0u, 0x6FD890F0u};
    const char *max_va_strs[3] = {"0x6FD89050", "0x6FD890A0", "0x6FD890F0"};
    const char *max_names[3] = {
        "STATLIST_GetMaxStaminaFromUnit113c",
        "STATLIST_GetMaxManaFromUnit113c",
        "STATLIST_GetMaxLifeFromUnit113c"
    };
    const uint32_t max_sids[3] = {0x0Bu, 0x09u, 0x07u};
    for (int k = 0; k < 3; k++) {
        for (int c = 0; c < 2; c++) {
            setup_unit_with_statlist(max_sids[k], 100, 250 + k * 50);
            if (c == 0) U32(ARENA_UNIT0 + 0x5C) = 0;
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
                {ARENA_ISC + max_sids[k] * 0x144u, 0x144u}, {ARENA_UNIT0, 0x80u},
                {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x20u}, {ARENA_STATS1, 0x20u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
            uint32_t eax = ((stdcall1_t)(uintptr_t)max_vas[k])(ARENA_UNIT0);
            snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
            emit_vector(fp, max_va_strs[k], max_names[k], c,
                c == 0 ? "no_statlist" : "with_statlist",
                args, regs, 8, g_pre_buf, eax, 0xFFFFFFFFu, regs, 8);
        }
    }

    /* #06: 0x6FD89140 STATLIST_GetStatValue113c */
    for (int c = 0; c < 2; c++) {
        setup_unit_with_statlist(0, 42, 99);
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {ARENA_ISC, 0x144u}, {ARENA_UNIT0, 0x80u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x20u}, {ARENA_STATS1, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
        uint32_t pList = (c == 0) ? 0 : ARENA_STATLIST0;
        uint32_t eax = ((stdcall3_t)(uintptr_t)0x6FD89140u)(pList, 0, 0);
        snprintf(args, sizeof(args), "\"0x%08X\",0,0", pList);
        emit_vector(fp, "0x6FD89140", "STATLIST_GetStatValue113c", c,
            c == 0 ? "null_list" : "found_base_stat",
            args, regs, 8, g_pre_buf, eax, 0xFFFFFFFFu, regs, 8);
    }

    /* #07: 0x6FD891A0 STATLIST_GetTotalStatValueLayer0_113c */
    for (int c = 0; c < 2; c++) {
        setup_unit_with_statlist(0, 42, 99);
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {ARENA_ISC, 0x144u}, {ARENA_UNIT0, 0x80u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x20u}, {ARENA_STATS1, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
        uint32_t pList = (c == 0) ? 0 : ARENA_STATLIST0;
        uint32_t eax = ((stdcall2_t)(uintptr_t)0x6FD891A0u)(pList, 0);
        snprintf(args, sizeof(args), "\"0x%08X\",0", pList);
        emit_vector(fp, "0x6FD891A0", "STATLIST_GetTotalStatValueLayer0_113c", c,
            c == 0 ? "null_list" : "found_total_stat",
            args, regs, 8, g_pre_buf, eax, 0xFFFFFFFFu, regs, 8);
    }

    /* #08: 0x6FD89380 STATLIST_GetStatBonusFromListInline113c (61 insns >= 40) */
    for (int c = 0; c < 3; c++) {
        setup_unit_with_statlist(0, 30, 85);
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {ARENA_ISC, 0x144u}, {ARENA_UNIT0, 0x80u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x20u}, {ARENA_STATS1, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
        uint32_t pList = (c == 0) ? 0 : ARENA_STATLIST0;
        uint32_t sid = (c == 1) ? 0xFFFFFFFFu : 0u;
        uint32_t eax = call_6FD89380(0x6FD89380u, pList, sid, 0);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",0", pList, sid);
        emit_vector(fp, "0x6FD89380", "STATLIST_GetStatBonusFromListInline113c", c,
            c == 0 ? "null_list" : (c == 1 ? "neg_stat_id" : "valid_bonus_diff"),
            args, regs, 8, g_pre_buf, eax, 0xFFFFFFFFu, regs, 8);
    }

    /* #09: 0x6FD89430 STATLIST_GetUnitStatWithLayer113c */
    for (int c = 0; c < 2; c++) {
        setup_unit_with_statlist(0, 30, 85);
        if (c == 0) U32(ARENA_UNIT0 + 0x5C) = 0;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {ARENA_ISC, 0x144u}, {ARENA_UNIT0, 0x80u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x20u}, {ARENA_STATS1, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
        uint32_t eax = ((stdcall3_t)(uintptr_t)0x6FD89430u)(ARENA_UNIT0, 0, 0);
        snprintf(args, sizeof(args), "\"0x%08X\",0,0", ARENA_UNIT0);
        emit_vector(fp, "0x6FD89430", "STATLIST_GetUnitStatWithLayer113c", c,
            c == 0 ? "no_statlist" : "found_unit_stat",
            args, regs, 8, g_pre_buf, eax, 0xFFFFFFFFu, regs, 8);
    }

    /* #10: 0x6FD894E0 STATLIST_GetBaseStatFromListInline113c */
    for (int c = 0; c < 2; c++) {
        setup_unit_with_statlist(0, 44, 85);
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {ARENA_ISC, 0x144u}, {ARENA_UNIT0, 0x80u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x20u}, {ARENA_STATS1, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
        uint32_t pList = (c == 0) ? 0 : ARENA_STATLIST0;
        uint32_t eax = call_6FD894E0(0x6FD894E0u, pList, 0, 0);
        snprintf(args, sizeof(args), "\"0x%08X\",0,0", pList);
        emit_vector(fp, "0x6FD894E0", "STATLIST_GetBaseStatFromListInline113c", c,
            c == 0 ? "null_list" : "found_base_stat",
            args, regs, 8, g_pre_buf, eax, 0xFFFFFFFFu, regs, 8);
    }
}

static void emit_b043_part3(FILE *fp) {
    char args[160];
    /* #11: 0x6FD8A1D0 STATLIST_SetBaseStatEx113c (73 insns >= 40) */
    for (int c = 0; c < 3; c++) {
        setup_unit_with_statlist(2, 10, 10);
        U8(ARENA_ISC + 2 * 0x144u + 0x04u) = 0x80u; /* bKeepZero */
        U8(ARENA_ISC + 2 * 0x144u + 0x05u) = 0x10u; /* fSaved */
        U16(ARENA_STATLIST0 + 0x2A) = 4; /* cap=4 so cap - newCount <= 8 */
        U16(ARENA_STATLIST0 + 0x4E) = 4;
        U32(ARENA_STATLIST0 + 0x50) = ARENA_MODSTATS;
        U16(ARENA_STATLIST0 + 0x54) = 0;
        U16(ARENA_STATLIST0 + 0x56) = 4;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {ARENA_ISC + 2 * 0x144u, 0x144u}, {ARENA_UNIT0, 0x100u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x20u}, {ARENA_STATS1, 0x20u},
            {ARENA_MODSTATS, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
        uint32_t pList = (c == 0) ? 0 : ARENA_STATLIST0;
        uint32_t newVal = (c == 1) ? 10 : 25;
        uint32_t eax = ((stdcall5_t)(uintptr_t)0x6FD8A1D0u)(pList, 2, newVal, 0, ARENA_UNIT0);
        snprintf(args, sizeof(args), "\"0x%08X\",2,%u,0,\"0x%08X\"", pList, newVal, ARENA_UNIT0);
        emit_vector(fp, "0x6FD8A1D0", "STATLIST_SetBaseStatEx113c", c,
            c == 0 ? "null_list" : (c == 1 ? "unchanged_val" : "updated_val_and_modstat"),
            args, regs, 9, g_pre_buf, eax, 0xFFFFFFFFu, regs, 9);
    }

    /* #12: 0x6FD8A5D0 STATLIST_UnlinkUnitStatList113c */
    for (int c = 0; c < 2; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x5C) = (c == 0) ? 0 : ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10) = 0;
        mem_region_t regs[] = {
            {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 2);
        ((stdcall2_t)(uintptr_t)0x6FD8A5D0u)(0, ARENA_UNIT0);
        snprintf(args, sizeof(args), "0,\"0x%08X\"", ARENA_UNIT0);
        emit_vector(fp, "0x6FD8A5D0", "STATLIST_UnlinkUnitStatList113c", c,
            c == 0 ? "no_statlist" : "with_base_statlist",
            args, regs, 2, g_pre_buf, 0, 0u, regs, 2);
    }

    /* #13: 0x6FD8A650 STATLIST_ClearBaseStats113c (70 insns >= 40) */
    for (int c = 0; c < 2; c++) {
        setup_unit_with_statlist(2, 15, 15);
        U8(ARENA_ISC + 2 * 0x144u + 0x04u) = 0x80u; /* bKeepZero */
        U8(ARENA_ISC + 2 * 0x144u + 0x05u) = 0x10u; /* fSaved */
        U16(ARENA_STATLIST0 + 0x28) = (c == 0) ? 0 : 1;
        U16(ARENA_STATLIST0 + 0x2A) = 4;
        U16(ARENA_STATLIST0 + 0x4E) = 4;
        U32(ARENA_STATLIST0 + 0x50) = ARENA_MODSTATS;
        U16(ARENA_STATLIST0 + 0x54) = 0;
        U16(ARENA_STATLIST0 + 0x56) = 4;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {ARENA_ISC + 2 * 0x144u, 0x144u}, {ARENA_UNIT0, 0x100u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x20u}, {ARENA_STATS1, 0x20u},
            {ARENA_MODSTATS, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
        ((stdcall1_t)(uintptr_t)0x6FD8A650u)(ARENA_STATLIST0);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_STATLIST0);
        emit_vector(fp, "0x6FD8A650", "STATLIST_ClearBaseStats113c", c,
            c == 0 ? "empty_base_stats" : "clear_one_base_stat",
            args, regs, 9, g_pre_buf, 0, 0u, regs, 9);
    }

    /* #14: 0x6FD8AAB0 STATLIST_UpdateUnitStateSetFlag113c (48 insns >= 40) */
    for (int c = 0; c < 3; c++) {
        setup_unit_with_statlist(0, 10, 10);
        U32(ARENA_STATLIST0 + 0x3C) = (c == 1) ? ARENA_STATLIST1 : 0u; /* pMyLastList */
        U32(ARENA_STATLIST0 + 0x40) = (c == 2) ? ARENA_STATLIST1 : 0u; /* pMyStats */
        U32(ARENA_STATLIST1 + 0x10) = (c == 1) ? 0x00000040u : 0x00002040u;
        U32(ARENA_STATLIST1 + 0x14) = 5; /* dwStateNo = 5 */
        U32(ARENA_STATLIST1 + 0x24) = ARENA_STATS2;
        U16(ARENA_STATLIST1 + 0x28) = 0;
        U16(ARENA_STATLIST1 + 0x2A) = 4;
        U32(ARENA_STATLIST1 + 0x34) = ARENA_STATLIST0; /* pParent */
        U32(ARENA_STATLIST1 + 0x38) = ARENA_UNIT0; /* pUnit */
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {ARENA_UNIT0, 0x100u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u},
            {ARENA_STATS0, 0x20u}, {ARENA_STATS1, 0x20u}, {ARENA_STATS2, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
        uint32_t stateId = (c == 0) ? 0u : 5u;
        uint32_t bSet = (c == 1) ? 1u : 0u;
        uint32_t eax = ((stdcall3_t)(uintptr_t)0x6FD8AAB0u)(ARENA_UNIT0, stateId, bSet);
        snprintf(args, sizeof(args), "\"0x%08X\",%u,%u", ARENA_UNIT0, stateId, bSet);
        emit_vector(fp, "0x6FD8AAB0", "STATLIST_UpdateUnitStateSetFlag113c", c,
            c == 0 ? "zero_state_early" : (c == 1 ? "set_0x2000_flag" : "clear_0x2000_flag"),
            args, regs, 9, g_pre_buf, eax, 0xFFFFFFFFu, regs, 9);
    }

    /* #15: 0x6FD96D50 STATLIST_RemoveItemDurabilityStatsModHandler113c (90 insns >= 40) */
    for (int c = 0; c < 2; c++) {
        setup_unit_with_statlist(0x49u, 30, 30);
        U8(ARENA_ISC + 0x48u * 0x144u + 0x04u) = 0x80u; /* bKeepZero */
        U8(ARENA_ISC + 0x48u * 0x144u + 0x05u) = 0x10u; /* fSaved */
        U8(ARENA_ISC + 0x49u * 0x144u + 0x04u) = 0x80u; /* bKeepZero */
        U8(ARENA_ISC + 0x49u * 0x144u + 0x05u) = 0x10u; /* fSaved */
        U32(ARENA_UNIT0 + 0x00) = 4; /* UNIT_ITEM */
        U16(ARENA_STATLIST0 + 0x28) = (c == 0) ? 0 : 2;
        U16(ARENA_STATLIST0 + 0x2A) = 4;
        U32(ARENA_STATS0 + 0) = (0x48u << 16);
        S32(ARENA_STATS0 + 4) = 20;
        U32(ARENA_STATS0 + 8) = (0x49u << 16);
        S32(ARENA_STATS0 + 12) = 30;
        U16(ARENA_STATLIST0 + 0x4C) = (c == 0) ? 0 : 2;
        U16(ARENA_STATLIST0 + 0x4E) = 4;
        U32(ARENA_STATS1 + 0) = (0x48u << 16);
        S32(ARENA_STATS1 + 4) = 20;
        U32(ARENA_STATS1 + 8) = (0x49u << 16);
        S32(ARENA_STATS1 + 12) = 30;
        U32(ARENA_STATLIST0 + 0x50) = ARENA_MODSTATS;
        U16(ARENA_STATLIST0 + 0x54) = 0;
        U16(ARENA_STATLIST0 + 0x56) = 4;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {ARENA_ISC + 0x48u * 0x144u, 0x288u}, {ARENA_UNIT0, 0x100u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x20u}, {ARENA_STATS1, 0x20u},
            {ARENA_MODSTATS, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
        uint32_t eax = ((stdcall7_t)(uintptr_t)0x6FD96D50u)(ARENA_UNIT0, 0, 0, 0, 0, 0, 0);
        snprintf(args, sizeof(args), "\"0x%08X\",0,0,0,0,0,0", ARENA_UNIT0);
        emit_vector(fp, "0x6FD96D50", "STATLIST_RemoveItemDurabilityStatsModHandler113c", c,
            c == 0 ? "no_durability_stats" : "remove_dur_and_maxdur",
            args, regs, 9, g_pre_buf, eax, 0xFFFFFFFFu, regs, 9);
    }
}

static void emit_b043_part4(FILE *fp) {
    char args[180];
    /* #16: 0x6FDA4A00 DATATBLS_CalculateMonsterStatsByLevel113c (367 insns >= 40) */
    for (int c = 0; c < 3; c++) {
        setup_common_tables();
        /* Monster 1 in ARENA_MONSTATS */
        uint32_t mrec = ARENA_MONSTATS + 1 * 0x1A8u;
        U8(mrec + 0x0Cu) = (c == 2) ? 0x04u : 0x00u; /* bNoRatio on c==2 */
        for (int d = 0; d < 3; d++) {
            S16(mrec + 0xB0u + d * 2) = (int16_t)(100 + d * 20); /* MinHP */
            S16(mrec + 0xB6u + d * 2) = (int16_t)(150 + d * 20); /* MaxHP */
            S16(mrec + 0xBCu + d * 2) = (int16_t)(50 + d * 10);  /* AC */
            S16(mrec + 0xC2u + d * 2) = (int16_t)(60 + d * 10);  /* A1TH */
            S16(mrec + 0xC8u + d * 2) = (int16_t)(65 + d * 10);  /* A2TH */
            S16(mrec + 0xCEu + d * 2) = (int16_t)(70 + d * 10);  /* S1TH */
            S16(mrec + 0xD4u + d * 2) = (int16_t)(80 + d * 10);  /* Exp */
            S16(mrec + 0xDAu + d * 2) = (int16_t)(10 + d * 2);   /* A1MinD */
            S16(mrec + 0xE0u + d * 2) = (int16_t)(20 + d * 2);   /* A1MaxD */
            S16(mrec + 0xE6u + d * 2) = (int16_t)(12 + d * 2);   /* A2MinD */
            S16(mrec + 0xECu + d * 2) = (int16_t)(22 + d * 2);   /* A2MaxD */
            S16(mrec + 0xF2u + d * 2) = (int16_t)(14 + d * 2);   /* S1MinD */
            S16(mrec + 0xF8u + d * 2) = (int16_t)(24 + d * 2);   /* S1MaxD */
            S16(mrec + 0x10Eu + d * 2) = (int16_t)(8 + d * 2);   /* El1Min */
            S16(mrec + 0x114u + d * 2) = (int16_t)(9 + d * 2);   /* El2Min */
            S16(mrec + 0x11Au + d * 2) = (int16_t)(11 + d * 2);  /* El3Min */
            S16(mrec + 0x120u + d * 2) = (int16_t)(16 + d * 2);  /* El1Max */
            S16(mrec + 0x126u + d * 2) = (int16_t)(18 + d * 2);  /* El2Max */
            S16(mrec + 0x12Cu + d * 2) = (int16_t)(21 + d * 2);  /* El3Max */
            S16(mrec + 0x132u + d * 2) = (int16_t)(25 + d * 5);  /* El1Len */
            S16(mrec + 0x138u + d * 2) = (int16_t)(30 + d * 5);  /* El2Len */
            S16(mrec + 0x13Eu + d * 2) = (int16_t)(35 + d * 5);  /* El3Len */
        }
        /* Level 5 in ARENA_MONLVL (stride 0x78 = 30 int32s) */
        uint32_t lrec = ARENA_MONLVL + 5 * 0x78u;
        for (int i = 0; i < 30; i++) {
            S32(lrec + i * 4) = 120 + i * 5;
        }
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {mrec, 0x1A8u}, {lrec, 0x78u}, {ARENA_OUT, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 6);
        uint32_t monId = (c == 0) ? 0xFFFFFFFFu : 1u;
        uint32_t gtype = (c == 1) ? 1u : 0u;
        uint32_t diff  = (c == 1) ? 1u : 2u;
        uint32_t flags = (c == 1) ? 0x7Fu : 0x1BFu;
        uint32_t eax = ((stdcall6_t)(uintptr_t)0x6FDA4A00u)(monId, gtype, diff, 5, flags, ARENA_OUT);
        snprintf(args, sizeof(args), "\"0x%08X\",%u,%u,5,\"0x%08X\",\"0x%08X\"",
            monId, gtype, diff, flags, ARENA_OUT);
        emit_vector(fp, "0x6FDA4A00", "DATATBLS_CalculateMonsterStatsByLevel113c", c,
            c == 0 ? "invalid_mon_id" : (c == 1 ? "scaled_ratio_flags_7f" : "no_ratio_flags_1bf"),
            args, regs, 6, g_pre_buf, eax, 0xFFFFFFFFu, regs, 6);
    }

    /* #17: 0x6FDBAB20 MISSILE_CalculateMasteryBonus113c (47 insns >= 40) */
    const uint32_t elem_types[3] = {1u, 4u, 9u};
    const uint32_t elem_sids[3]  = {0x149u, 0x14Bu, 0x149u};
    for (int c = 0; c < 3; c++) {
        setup_unit_with_statlist(elem_sids[c], 50, 50);
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {ARENA_ISC + elem_sids[c] * 0x144u, 0x144u}, {ARENA_UNIT0, 0x80u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x20u}, {ARENA_STATS1, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
        uint32_t eax = call_6FDBAB20(0x6FDBAB20u, ARENA_UNIT0, elem_types[c], 200);
        snprintf(args, sizeof(args), "\"0x%08X\",%u,200", ARENA_UNIT0, elem_types[c]);
        emit_vector(fp, "0x6FDBAB20", "MISSILE_CalculateMasteryBonus113c", c,
            c == 0 ? "fire_mastery" : (c == 1 ? "cold_mastery" : "unhandled_elem"),
            args, regs, 8, g_pre_buf, eax, 0xFFFFFFFFu, regs, 8);
    }

    /* #18: 0x6FDBABE0 MISSILE_AddStatsToDamage113c (456 insns >= 40) */
    for (int c = 0; c < 2; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00) = 0;
        U32(ARENA_UNIT0 + 0x5C) = ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10) = 0x80000000u;
        U32(ARENA_STATLIST0 + 0x44) = ARENA_UNIT0;
        U32(ARENA_STATLIST0 + 0x48) = ARENA_STATS1;
        /* Populate sorted stats in ARENA_STATS1 */
        const uint32_t sids[] = {
            0x30u, 0x31u, 0x32u, 0x33u, 0x34u, 0x35u, 0x36u, 0x37u,
            0x38u, 0x39u, 0x3Au, 0x3Bu, 0x3Cu, 0x3Eu, 0x65u, 0x13Bu, 0x13Cu, 0x13Du, 0x146u
        };
        int n = 0;
        for (int i = 0; i < 19; i++) {
            if (c == 0 && sids[i] == 0x65u) continue; /* c==0: no poison override; c==1: with poison override */
            U32(ARENA_STATS1 + n * 8 + 0) = (sids[i] << 16);
            S32(ARENA_STATS1 + n * 8 + 4) = 10 + i;
            n++;
        }
        U16(ARENA_STATLIST0 + 0x4C) = (uint16_t)n;
        U16(ARENA_STATLIST0 + 0x4E) = 32;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {ARENA_ISC, 359 * 0x144u}, {ARENA_UNIT0, 0x80u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATS1, 0x100u}, {ARENA_DMG, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
        call_6FDBABE0(0x6FDBABE0u, ARENA_DMG, ARENA_UNIT0, 8);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",8", ARENA_DMG, ARENA_UNIT0);
        emit_vector(fp, "0x6FDBABE0", "MISSILE_AddStatsToDamage113c", c,
            c == 0 ? "normal_poison_len_and_count" : "override_poison_len",
            args, regs, 8, g_pre_buf, 0, 0u, regs, 8);
    }

    /* #19: 0x6FDBB180 MISSILE_RollCriticalStrike113c (108 insns >= 40) */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00) = 0;
        U32(ARENA_UNIT0 + 0x20) = 12345u;
        U32(ARENA_UNIT0 + 0x24) = 67890u;
        U32(ARENA_UNIT0 + 0x5C) = ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10) = 0x80000000u;
        U32(ARENA_STATLIST0 + 0x44) = ARENA_UNIT0;
        U32(ARENA_STATLIST0 + 0x48) = ARENA_STATS1;
        /* Stat 0x8D (deadly strike), 0x151 (crit strike), 0x158 (344, weapon mastery crit layer=0x1E) */
        U32(ARENA_STATS1 + 0)  = (0x8Du << 16);
        S32(ARENA_STATS1 + 4)  = (c == 1) ? 100 : 0;
        U32(ARENA_STATS1 + 8)  = (0x151u << 16);
        S32(ARENA_STATS1 + 12) = (c == 0) ? 100 : 0;
        U32(ARENA_STATS1 + 16) = (0x158u << 16) | 0x1Eu;
        S32(ARENA_STATS1 + 20) = (c == 2) ? 100 : 0;
        U16(ARENA_STATLIST0 + 0x4C) = 3;
        U16(ARENA_STATLIST0 + 0x4E) = 8;
        U32(ARENA_ITEM0 + 0x00) = 4;
        U32(ARENA_ITEM0 + 0x04) = 0; /* sword (type 0x1E) */
        U32(ARENA_ITEM0 + 0x14) = ARENA_ITEMDATA0;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDEFB94u, 8}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC10u},
            {ARENA_ISC + 0x8Du * 0x144u, 0x144u}, {ARENA_ISC + 0x151u * 0x144u, 0x144u},
            {ARENA_ISC + 0x158u * 0x144u, 0x144u}, {ARENA_UNIT0, 0xC0u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATS1, 0x40u}, {ARENA_ITEM0, 0x40u},
            {ARENA_ITEMDATA0, 0x40u}, {ARENA_ITEMSTXT, 0x1A8u}, {ARENA_ITYPEMAT, 0x200u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 14);
        uint32_t pWeap = (c >= 2) ? ARENA_ITEM0 : 0u;
        uint32_t eax = call_6FDBB180(0x6FDBB180u, ARENA_UNIT0, pWeap);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_UNIT0, pWeap);
        emit_vector(fp, "0x6FDBB180", "MISSILE_RollCriticalStrike113c", c,
            c == 0 ? "crit_strike_hit" : (c == 1 ? "deadly_strike_hit" : (c == 2 ? "weapon_mastery_crit_hit" : "all_crit_miss")),
            args, regs, 14, g_pre_buf, eax, 0xFFFFFFFFu, regs, 14);
    }
}

static void emit_b045_part1(FILE *fp) {
    char args[180];
    /* #01: 0x6FD5D540 PATH_ResetDynamicPathRoomAndCoordsInline113c */
    for (int c = 0; c < 2; c++) {
        setup_common_tables();
        U32(ARENA_PATH0 + 0x00) = 0x11112222u;
        U32(ARENA_PATH0 + 0x04) = 0x33334444u;
        U32(ARENA_PATH0 + 0x08) = 0x55556666u;
        U32(ARENA_PATH0 + 0x0C) = 0x77778888u;
        U32(ARENA_PATH0 + 0x1C) = (c == 0) ? 0u : ARENA_ROOM0;
        U32(ARENA_PATH0 + 0x28) = 5u;
        U32(ARENA_PATH0 + 0x30) = ARENA_UNIT0;
        U32(ARENA_PATH0 + 0x34) = 0u;
        if (c == 1) {
            U32(ARENA_UNIT0 + 0x00) = 0u; /* UNIT_PLAYER */
            U32(ARENA_UNIT0 + 0x2C) = ARENA_PATH0;
            U32(ARENA_ROOM0 + 0x28) = 1u;
            U32(ARENA_ROOM0 + 0x74) = ARENA_UNIT0;
        }
        mem_region_t regs[] = {
            {0x6FDDD458u, 8}, {ARENA_PATH0, 0x60u}, {ARENA_UNIT0, 0x100u}, {ARENA_ROOM0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 4);
        call_6FD5D540(0x6FD5D540u, ARENA_PATH0);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_PATH0);
        emit_vector(fp, "0x6FD5D540", "PATH_ResetDynamicPathRoomAndCoordsInline113c", c,
            c == 0 ? "no_room" : "with_room_unlink_unit",
            args, regs, 4, g_pre_buf, 0, 0u, regs, 4);
    }

    /* #02: 0x6FD6A3D0 UNITS_GetSpawnedMonsterOrSkillSummonInfo113c (106 insns >= 40) */
    for (int c = 0; c < 3; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00) = 1u; /* UNIT_MONSTER */
        U32(ARENA_UNIT0 + 0x04) = 1u; /* classId 1 */
        U32(ARENA_UNIT0 + 0x2C) = ARENA_PATH0;
        U16(ARENA_PATH0 + 0x02) = 100u; /* x */
        U16(ARENA_PATH0 + 0x06) = 200u; /* y */
        uint32_t mrec = ARENA_MONSTATS + 1 * 0x1A8u;
        S16(mrec + 0x20u) = 42;
        U8(mrec + 0x22u)  = 3;
        U8(mrec + 0x23u)  = 5;
        U8(mrec + 0x24u)  = 8;
        uint32_t srec = ARENA_SKILLSTXT + 2 * 0x23Cu;
        S16(srec + 0xBCu) = 7;
        U8(srec + 0xBFu)  = 4;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {ARENA_SGPT, 0xC00u}, {mrec, 0x1A8u}, {srec, 0x23Cu},
            {ARENA_UNIT0, 0x60u}, {ARENA_PATH0, 0x40u}, {ARENA_OUT, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 7);
        uint32_t bMon = (c == 0) ? 1u : 0u;
        uint32_t skId = (c == 2) ? 99u : 2u;
        uint32_t eax = ((stdcall7_t)(uintptr_t)0x6FD6A3D0u)(
            ARENA_UNIT0, bMon, skId, 0, ARENA_OUT + 0, ARENA_OUT + 4, ARENA_OUT + 8);
        snprintf(args, sizeof(args), "\"0x%08X\",%u,%u,0,\"0x%08X\",\"0x%08X\",\"0x%08X\"",
            ARENA_UNIT0, bMon, skId, ARENA_OUT + 0, ARENA_OUT + 4, ARENA_OUT + 8);
        emit_vector(fp, "0x6FD6A3D0", "UNITS_GetSpawnedMonsterOrSkillSummonInfo113c", c,
            c == 0 ? "monster_spawn_branch" : (c == 1 ? "skill_summon_branch" : "invalid_skill_branch"),
            args, regs, 7, g_pre_buf, eax, 0xFFFFFFFFu, regs, 7);
    }

    /* #03: 0x6FD6E5B0 INVENTORY_GetBeltItem113c */
    for (int c = 0; c < 2; c++) {
        setup_common_tables();
        U32(ARENA_INV0 + 0x00) = 0x01020304u;
        U32(ARENA_INV0 + 0x14) = ARENA_GRIDS;
        U32(ARENA_INV0 + 0x18) = 2u;
        U8(ARENA_GRIDS + 0x10 + 0x08) = 16;
        U8(ARENA_GRIDS + 0x10 + 0x09) = 1;
        U32(ARENA_GRIDS + 0x10 + 0x0C) = ARENA_GRIDCELLS1;
        U32(ARENA_GRIDCELLS1 + 3 * 4) = ARENA_ITEM0;
        mem_region_t regs[] = {
            {0x6FDED390u, 0x18u}, {ARENA_INV0, 0x30u}, {ARENA_GRIDS, 0x30u}, {ARENA_GRIDCELLS1, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 4);
        uint32_t slot = (c == 0) ? 3u : 20u;
        uint32_t eax = ((stdcall2_t)(uintptr_t)0x6FD6E5B0u)(ARENA_INV0, slot);
        snprintf(args, sizeof(args), "\"0x%08X\",%u", ARENA_INV0, slot);
        emit_vector(fp, "0x6FD6E5B0", "INVENTORY_GetBeltItem113c", c,
            c == 0 ? "valid_belt_slot_3" : "out_of_range_slot",
            args, regs, 4, g_pre_buf, eax, 0xFFFFFFFFu, regs, 4);
    }

    /* #04: 0x6FD6E600 INVENTORY_GetItemGridXIfInInventory113c & #05: 0x6FD6E630 INVENTORY_GetItemBodyLocFromX113c */
    for (int c = 0; c < 2; c++) {
        setup_common_tables();
        U32(ARENA_INV0 + 0x00) = 0x01020304u;
        U32(ARENA_ITEM0 + 0x00) = 4u;
        U32(ARENA_ITEM0 + 0x2C) = ARENA_PATH0;
        U32(ARENA_PATH0 + 0x0C) = (c == 0) ? 5u : 12u;
        mem_region_t regs[] = {
            {ARENA_INV0, 0x20u}, {ARENA_ITEM0, 0x40u}, {ARENA_PATH0, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
        uint32_t pInv = (c == 0) ? ARENA_INV0 : 0u;
        uint32_t eax0 = ((stdcall2_t)(uintptr_t)0x6FD6E600u)(pInv, ARENA_ITEM0);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", pInv, ARENA_ITEM0);
        emit_vector(fp, "0x6FD6E600", "INVENTORY_GetItemGridXIfInInventory113c", c,
            c == 0 ? "valid_item_x_5" : "null_inventory",
            args, regs, 3, g_pre_buf, eax0, 0xFFFFFFFFu, regs, 3);

        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
        uint32_t eax1 = ((stdcall2_t)(uintptr_t)0x6FD6E630u)(ARENA_INV0, ARENA_ITEM0);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_INV0, ARENA_ITEM0);
        emit_vector(fp, "0x6FD6E630", "INVENTORY_GetItemBodyLocFromX113c", c,
            c == 0 ? "bodyloc_5_valid" : "bodyloc_12_clamped_to_0",
            args, regs, 3, g_pre_buf, eax1, 0xFFFFFFFFu, regs, 3);
    }

    /* #06: 0x6FD6F720 INVENTORY_RemoveItemFromGrid113c (173 insns >= 40) */
    for (int c = 0; c < 2; c++) {
        setup_common_tables();
        U32(ARENA_ITEM0 + 0x00) = 4u;
        U32(ARENA_ITEM0 + 0x04) = 0u; /* sword 2x3 */
        U32(ARENA_ITEM0 + 0x14) = ARENA_ITEMDATA0;
        U32(ARENA_ITEM0 + 0x2C) = ARENA_PATH0;
        U32(ARENA_PATH0 + 0x0C) = 1u; /* x = 1 */
        U32(ARENA_PATH0 + 0x10) = 0u; /* y = 0 */
        U8(ARENA_ITEMDATA0 + 0x5Cu + 0x0Cu) = 1u;
        U32(ARENA_GRIDS + 0x00) = ARENA_ITEM0; /* pFirstItem */
        U32(ARENA_GRIDS + 0x04) = ARENA_ITEM0; /* pLastItem */
        U8(ARENA_GRIDS + 0x08)  = 4u; /* gridW = 4 */
        U8(ARENA_GRIDS + 0x09)  = 4u; /* gridH = 4 */
        U32(ARENA_GRIDS + 0x0C) = ARENA_GRIDCELLS0;
        for (int i = 0; i < 16; i++) U32(ARENA_GRIDCELLS0 + i * 4) = ARENA_ITEM0;
        mem_region_t regs[] = {
            {0x6FDEFB94u, 8}, {ARENA_ITEMSTXT, 0x1A8u}, {ARENA_ITEM0, 0x40u},
            {ARENA_ITEMDATA0, 0x80u}, {ARENA_PATH0, 0x20u}, {ARENA_GRIDS, 0x20u},
            {ARENA_GRIDCELLS0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 7);
        uint32_t bUseDims = (c == 0) ? 0u : 1u;
        call_6FD6F720(0x6FD6F720u, ARENA_ITEM0, ARENA_GRIDS, bUseDims);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",%u", ARENA_ITEM0, ARENA_GRIDS, bUseDims);
        emit_vector(fp, "0x6FD6F720", "INVENTORY_RemoveItemFromGrid113c", c,
            c == 0 ? "single_slot_remove" : "multi_cell_2x3_remove",
            args, regs, 7, g_pre_buf, 0, 0u, regs, 7);
    }
}

static void emit_b045_part2(FILE *fp) {
    char args[180];
    /* #07: 0x6FD6FF40 INVENTORY_GetEquippedShield113c (81 insns >= 40) */
    for (int c = 0; c < 3; c++) {
        setup_common_tables();
        U32(ARENA_INV0 + 0x00) = 0x01020304u;
        U32(ARENA_INV0 + 0x14) = ARENA_GRIDS;
        U32(ARENA_INV0 + 0x18) = 1u;
        U8(ARENA_GRIDS + 0x08) = 13u;
        U8(ARENA_GRIDS + 0x09) = 1u;
        U32(ARENA_GRIDS + 0x0C) = ARENA_GRIDCELLS0;
        U32(ARENA_ITEM0 + 0x00) = 4u;
        U32(ARENA_ITEM0 + 0x04) = 1u; /* shield (type 0x33) */
        U32(ARENA_ITEM0 + 0x14) = ARENA_ITEMDATA0;
        if (c == 1) U32(ARENA_GRIDCELLS0 + 4 * 4) = ARENA_ITEM0;
        if (c == 2) U32(ARENA_GRIDCELLS0 + 5 * 4) = ARENA_ITEM0;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDEFB94u, 8}, {0x6FDD9088u, 0xACu}, {0x6FDED378u, 0x18u},
            {ARENA_SGPT, 0xC10u}, {ARENA_INV0, 0x30u}, {ARENA_GRIDS, 0x20u},
            {ARENA_GRIDCELLS0, 0x40u}, {ARENA_ITEM0, 0x40u}, {ARENA_ITEMDATA0, 0x40u},
            {ARENA_ITEMSTXT, 2 * 0x1A8u}, {ARENA_ITYPEMAT, 0x200u}, {ARENA_OUT, 0x10u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 13);
        uint32_t pInv = (c == 0) ? 0u : ARENA_INV0;
        uint32_t eax = ((stdcall2_t)(uintptr_t)0x6FD6FF40u)(pInv, ARENA_OUT);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", pInv, ARENA_OUT);
        emit_vector(fp, "0x6FD6FF40", "INVENTORY_GetEquippedShield113c", c,
            c == 0 ? "null_inventory" : (c == 1 ? "shield_in_right_arm" : "shield_in_left_arm"),
            args, regs, 13, g_pre_buf, eax, 0xFFFFFFFFu, regs, 13);
    }

    /* #08: 0x6FD70270 INVENTORY_GetSecondaryWeapon113c (71 insns >= 40) */
    for (int c = 0; c < 3; c++) {
        setup_common_tables();
        U32(ARENA_INV0 + 0x00) = 0x01020304u;
        U32(ARENA_INV0 + 0x14) = ARENA_GRIDS;
        U32(ARENA_INV0 + 0x18) = 1u;
        U32(ARENA_INV0 + 0x1C) = (c == 0) ? 0xFFFFFFFFu : ((c == 1) ? 101u : 102u);
        U8(ARENA_GRIDS + 0x08) = 13u;
        U8(ARENA_GRIDS + 0x09) = 1u;
        U32(ARENA_GRIDS + 0x0C) = ARENA_GRIDCELLS0;
        U32(ARENA_ITEM0 + 0x00) = 4u;
        U32(ARENA_ITEM0 + 0x04) = 0u; /* sword */
        U32(ARENA_ITEM0 + 0x0C) = 101u;
        U32(ARENA_ITEM0 + 0x14) = ARENA_ITEMDATA0;
        U32(ARENA_ITEM1 + 0x00) = 4u;
        U32(ARENA_ITEM1 + 0x04) = 0u; /* sword */
        U32(ARENA_ITEM1 + 0x0C) = 102u;
        U32(ARENA_ITEM1 + 0x14) = ARENA_ITEMDATA1;
        U32(ARENA_GRIDCELLS0 + 5 * 4) = ARENA_ITEM0; /* left */
        U32(ARENA_GRIDCELLS0 + 4 * 4) = ARENA_ITEM1; /* right */
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDEFB94u, 8}, {0x6FDD9088u, 0xACu}, {0x6FDED378u, 0x18u},
            {ARENA_SGPT, 0xC10u}, {ARENA_INV0, 0x30u}, {ARENA_GRIDS, 0x20u},
            {ARENA_GRIDCELLS0, 0x40u}, {ARENA_ITEM0, 0x40u}, {ARENA_ITEMDATA0, 0x40u},
            {ARENA_ITEM1, 0x40u}, {ARENA_ITEMDATA1, 0x40u}, {ARENA_ITEMSTXT, 0x1A8u},
            {ARENA_ITYPEMAT, 0x200u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 14);
        uint32_t eax = ((stdcall1_t)(uintptr_t)0x6FD70270u)(ARENA_INV0);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_INV0);
        emit_vector(fp, "0x6FD70270", "INVENTORY_GetSecondaryWeapon113c", c,
            c == 0 ? "no_active_guid" : (c == 1 ? "left_active_returns_right" : "right_active_returns_left"),
            args, regs, 14, g_pre_buf, eax, 0xFFFFFFFFu, regs, 14);
    }

    /* #09: 0x6FD72CD0 ITEMS_AreStackablesCompatible113c (125 insns >= 40) */
    for (int c = 0; c < 3; c++) {
        setup_common_tables();
        U32(ARENA_ITEM0 + 0x00) = 4u;
        U32(ARENA_ITEM0 + 0x04) = 2u; /* isc */
        U32(ARENA_ITEM1 + 0x00) = 4u;
        U32(ARENA_ITEM1 + 0x04) = (c == 0) ? 2u : ((c == 1) ? 3u : 6u);
        mem_region_t regs[] = {
            {0x6FDEFB94u, 8}, {0x6FDEF068u, 0x40u}, {ARENA_ITEM0, 0x20u}, {ARENA_ITEM1, 0x20u},
            {ARENA_ITEMSTXT, 8 * 0x1A8u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 5);
        uint32_t eax = ((stdcall2_t)(uintptr_t)0x6FD72CD0u)(ARENA_ITEM0, ARENA_ITEM1);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_ITEM0, ARENA_ITEM1);
        emit_vector(fp, "0x6FD72CD0", "ITEMS_AreStackablesCompatible113c", c,
            c == 0 ? "same_class_id" : (c == 1 ? "isc_and_ibk_compatible" : "isc_and_key_incompatible"),
            args, regs, 5, g_pre_buf, eax, 0xFFFFFFFFu, regs, 5);
    }

    /* #10: 0x6FD731A0 INVENTORY_GetItemDimensionsCallback113c */
    for (int c = 0; c < 2; c++) {
        setup_common_tables();
        U32(ARENA_ITEM0 + 0x00) = 4u;
        U32(ARENA_ITEM0 + 0x04) = 0u; /* 2x3 */
        mem_region_t regs[] = {
            {0x6FDEFB94u, 8}, {ARENA_ITEM0, 0x20u}, {ARENA_ITEMSTXT, 0x1A8u}, {ARENA_OUT, 0x10u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 4);
        uint32_t pItem = (c == 0) ? ARENA_ITEM0 : 0u;
        ((stdcall5_t)(uintptr_t)0x6FD731A0u)(pItem, ARENA_OUT + 0, ARENA_OUT + 4, 0, 0);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",\"0x%08X\",0,0",
            pItem, ARENA_OUT + 0, ARENA_OUT + 4);
        emit_vector(fp, "0x6FD731A0", "INVENTORY_GetItemDimensionsCallback113c", c,
            c == 0 ? "valid_item_dims" : "null_item",
            args, regs, 4, g_pre_buf, 0, 0u, regs, 4);
    }
}

static void emit_b045_part3(FILE *fp) {
    char args[180];
    /* #11: 0x6FD80DC0 UNITS_SetUnitUpdateFlags113c */
    for (int c = 0; c < 2; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00) = 0u; /* UNIT_PLAYER */
        U32(ARENA_UNIT0 + 0x2C) = ARENA_PATH0;
        U32(ARENA_UNIT0 + 0xC8) = (c == 0) ? 3u : 0u;
        mem_region_t regs[] = {
            {ARENA_UNIT0, 0x100u}, {ARENA_PATH0, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 2);
        ((stdcall2_t)(uintptr_t)0x6FD80DC0u)(ARENA_UNIT0, (uint32_t)c);
        snprintf(args, sizeof(args), "\"0x%08X\",%d", ARENA_UNIT0, c);
        emit_vector(fp, "0x6FD80DC0", "UNITS_SetUnitUpdateFlags113c", c,
            c == 0 ? "clear_update_flag" : "set_player_update_flags",
            args, regs, 2, g_pre_buf, 0, 0u, regs, 2);
    }

    /* #12: 0x6FD823E0 UNITS_GetDiminishingStatBonusInline113c (44 insns >= 40) */
    for (int c = 0; c < 2; c++) {
        setup_unit_with_statlist(93u, 50, (c == 0) ? 50 : 0);
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDD9088u, 0xACu}, {0x6FDE4608u, 0x3Cu},
            {ARENA_SGPT, 0xC00u}, {ARENA_ISC + 93u * 0x144u, 0x144u},
            {ARENA_UNIT0, 0x80u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS1, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
        uint32_t eax = call_6FD823E0(0x6FD823E0u, 0, ARENA_UNIT0);
        snprintf(args, sizeof(args), "0,\"0x%08X\"", ARENA_UNIT0);
        emit_vector(fp, "0x6FD823E0", "UNITS_GetDiminishingStatBonusInline113c", c,
            c == 0 ? "diminishing_bonus_50" : "zero_stat_bonus",
            args, regs, 8, g_pre_buf, eax, 0xFFFFFFFFu, regs, 8);
    }

    /* #13: 0x6FD84080 UNITS_TransferStateMaskToRemoved113c (71 insns >= 40) */
    for (int c = 0; c < 2; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00) = 0u;
        U32(ARENA_UNIT0 + 0x2C) = ARENA_PATH0;
        U32(ARENA_UNIT0 + 0x5C) = ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10) = 0x80000000u;
        U32(ARENA_STATLIST0 + 0x58) = ARENA_STATHIST;
        U32(ARENA_STATHIST + 0) = 0x000000FFu;
        U32(ARENA_STATHIST + 4) = 0x0000FF00u;
        U32(ARENA_STATEMASKS + 0) = 0x0000000Fu;
        U32(ARENA_STATEMASKS + 4) = 0x00000F00u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {ARENA_SGPT, 0x120u}, {ARENA_UNIT0, 0x100u},
            {ARENA_PATH0, 0x40u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATHIST, 0x40u},
            {ARENA_STATEMASKS, 0x60u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 7);
        uint32_t pUnit = (c == 0) ? 0u : ARENA_UNIT0;
        call_6FD84080(0x6FD84080u, ARENA_STATEMASKS, pUnit);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_STATEMASKS, pUnit);
        emit_vector(fp, "0x6FD84080", "UNITS_TransferStateMaskToRemoved113c", c,
            c == 0 ? "null_unit" : "transfer_active_to_removed",
            args, regs, 7, g_pre_buf, 0, 0u, regs, 7);
    }

    /* #14: 0x6FD84150 STATES_UpdateGfxStateFlagsByMask113c (125 insns >= 40) */
    for (int c = 0; c < 3; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00) = (c == 2) ? 1u : 0u; /* player vs monster */
        U32(ARENA_UNIT0 + 0x2C) = ARENA_PATH0;
        U32(ARENA_UNIT0 + 0x5C) = ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10) = 0x80000000u;
        U32(ARENA_STATLIST0 + 0x58) = ARENA_STATHIST;
        U32(ARENA_STATHIST + 0) = 0x000000FFu;
        U32(ARENA_STATEMASKS + 0x00) = 0x0000000Fu; /* fStateMasks[0] */
        U32(ARENA_STATEMASKS + 0x20) = 0x00000033u; /* fStateMasks[1] */
        U32(ARENA_STATEMASKS + 0x40) = 0x00000055u; /* fStateMasks[2] */
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {ARENA_SGPT, 0x120u}, {ARENA_UNIT0, 0x100u},
            {ARENA_PATH0, 0x40u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATHIST, 0x40u},
            {ARENA_STATEMASKS, 0x60u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 7);
        uint32_t bBoss = (c == 0) ? 1u : 0u;
        ((stdcall2_t)(uintptr_t)0x6FD84150u)(ARENA_UNIT0, bBoss);
        snprintf(args, sizeof(args), "\"0x%08X\",%u", ARENA_UNIT0, bBoss);
        emit_vector(fp, "0x6FD84150", "STATES_UpdateGfxStateFlagsByMask113c", c,
            c == 0 ? "boss_or_town_mask" : (c == 1 ? "player_gfx_mask" : "monster_gfx_mask"),
            args, regs, 7, g_pre_buf, 0, 0u, regs, 7);
    }

    /* #15: 0x6FDB6900 UNITROOM_SortUnitListByY113c */
    for (int c = 0; c < 2; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00) = (c == 0) ? 0u : 1u; /* player vs monster */
        U32(ARENA_UNIT0 + 0x2C) = ARENA_PATH0;
        U16(ARENA_PATH0 + 0x02) = 10u; /* x */
        U16(ARENA_PATH0 + 0x06) = 20u; /* y */
        U32(ARENA_ROOM0 + 0x4C) = 0u;
        U32(ARENA_ROOM0 + 0x50) = 0u;
        U32(ARENA_ROOM0 + 0x54) = 40u;
        U32(ARENA_ROOM0 + 0x58) = 40u;
        mem_region_t regs[] = {
            {ARENA_UNIT0, 0x100u}, {ARENA_PATH0, 0x40u}, {ARENA_ROOM0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
        uint32_t eax = ((stdcall2_t)(uintptr_t)0x6FDB6900u)(ARENA_UNIT0, ARENA_ROOM0);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_UNIT0, ARENA_ROOM0);
        emit_vector(fp, "0x6FDB6900", "UNITROOM_SortUnitListByY113c", c,
            c == 0 ? "add_player_to_room" : "add_monster_to_room",
            args, regs, 3, g_pre_buf, eax, 0xFFFFFFFFu, regs, 3);
    }

    /* #16: 0x6FDD4D30 UNITS_AreUnitsAligned113c */
    for (int c = 0; c < 3; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00) = 2u; /* object -> alignment 2 */
        U32(ARENA_UNIT0 + 0x5C) = ARENA_STATLIST0;
        U32(ARENA_UNIT1 + 0x00) = (c == 1) ? 2u : 1u; /* object (2) vs monster (0) */
        U32(ARENA_UNIT1 + 0x5C) = ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10) = 0x80000000u;
        mem_region_t regs[] = {
            {ARENA_UNIT0, 0x80u}, {ARENA_UNIT1, 0x80u}, {ARENA_STATLIST0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
        uint32_t u2 = (c == 0) ? ARENA_UNIT0 : ARENA_UNIT1;
        uint32_t eax = ((stdcall2_t)(uintptr_t)0x6FDD4D30u)(ARENA_UNIT0, u2);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_UNIT0, u2);
        emit_vector(fp, "0x6FDD4D30", "UNITS_AreUnitsAligned113c", c,
            c == 0 ? "same_unit" : (c == 1 ? "both_alignment_2" : "mismatched_alignment"),
            args, regs, 3, g_pre_buf, eax, 0xFFFFFFFFu, regs, 3);
    }
}

/* =========================================================================
 * k1r3 remediation vectors: DLL null/assert paths and callee parity paths.
 * Fog.#10265 (0x6FD5921C -> IAT 0x6FDD90D4) receives the assert line as its
 * only stack argument; the stub records it and longjmps out of the DLL call
 * so the vector can record `expectedAssert` instead of terminating.
 * ========================================================================= */
#define ARENA_GRID_ODD   (ARENA_BASE + 0x5003u) /* grid whose address low byte is 3 */
#define ARENA_CELLS_BIG  (ARENA_BASE + 0x5100u) /* 8x8 cell array */
#define ARENA_ITYPESTXT  (ARENA_BASE + 0x70000u)
#define ARENA_SUBLIST    (ARENA_BASE + 0x5400u)
#define ARENA_PARENTLIST (ARENA_BASE + 0x5500u)
#define ARENA_SUBSTATS   (ARENA_BASE + 0x5600u)
#define ARENA_PARSTATS   (ARENA_BASE + 0x5700u)
#define ARENA_ITEM2      (ARENA_BASE + 0x5800u)
#define ARENA_ITEMDATA2  (ARENA_BASE + 0x5900u)

static jmp_buf g_assert_jmp;
static volatile int g_in_dll_call = 0;
static volatile uint32_t g_assert_line = 0;

static void __cdecl stub_fog_assert_line(uint32_t line) {
    g_assert_line = line;
    if (g_in_dll_call) {
        g_in_dll_call = 0;
        longjmp(g_assert_jmp, 1);
    }
}

/* Each safe_* helper runs one DLL call under setjmp with the Fog.#10265 IAT slot temporarily pointed at
 * stub_fog_assert_line (restored afterwards, so captured memory never contains the stub address);
 * returns eax (0 for void) and sets *pAsserted. */
#define SAFE_BODY(call_expr)                                  \
    volatile uint32_t r = 0;                                  \
    int * volatile out = pAsserted;                           \
    volatile uint32_t savedIat = U32(0x6FDD90D4u);            \
    U32(0x6FDD90D4u) = (uint32_t)(uintptr_t)&stub_fog_assert_line; \
    g_assert_line = 0;                                        \
    if (setjmp(g_assert_jmp) == 0) {                          \
        g_in_dll_call = 1;                                    \
        r = (call_expr);                                      \
        g_in_dll_call = 0;                                    \
        *out = 0;                                             \
    } else {                                                  \
        *out = 1;                                             \
    }                                                         \
    U32(0x6FDD90D4u) = savedIat;                              \
    return r

static __attribute__((noinline)) uint32_t safe_stdcall1(uint32_t va, uint32_t a0, int *pAsserted) {
    SAFE_BODY(((stdcall1_t)(uintptr_t)va)(a0));
}
static __attribute__((noinline)) uint32_t safe_stdcall2(uint32_t va, uint32_t a0, uint32_t a1, int *pAsserted) {
    SAFE_BODY(((stdcall2_t)(uintptr_t)va)(a0, a1));
}
static __attribute__((noinline)) uint32_t safe_stdcall5(
    uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3, uint32_t a4, int *pAsserted) {
    SAFE_BODY(((stdcall5_t)(uintptr_t)va)(a0, a1, a2, a3, a4));
}
static __attribute__((noinline)) uint32_t safe_6FD84080(uint32_t pMask, uint32_t pUnit, int *pAsserted) {
    SAFE_BODY((call_6FD84080(0x6FD84080u, pMask, pUnit), 0u));
}
static __attribute__((noinline)) uint32_t safe_6FD6F720(uint32_t pItem, uint32_t pGrid, uint32_t bUse, int *pAsserted) {
    SAFE_BODY((call_6FD6F720(0x6FD6F720u, pItem, pGrid, bUse), 0u));
}
static __attribute__((noinline)) uint32_t safe_6FD5D540(uint32_t pPath, int *pAsserted) {
    SAFE_BODY((call_6FD5D540(0x6FD5D540u, pPath), 0u));
}
static __attribute__((noinline)) uint32_t safe_6FDBB180(uint32_t pUnit, uint32_t pWeapon, int *pAsserted) {
    SAFE_BODY(call_6FDBB180(0x6FDBB180u, pUnit, pWeapon));
}

static void emit_vector_assert(
    FILE *fp, const char *va, const char *name, int case_idx, const char *note,
    const char *args_json, const char *pre_hex_array, uint32_t line
) {
    fprintf(fp, "{\"va\":\"%s\",\"name\":\"%s\",\"caseIndex\":%d,\"note\":\"%s\",\"inputs\":{\"args\":[%s],\"memory\":%s},\"expectedAssert\":{\"line\":%u},\"outputs\":{\"eax\":\"0x00000000\",\"retMask\":\"0x00000000\",\"memory\":[]}}\n",
        va, name, case_idx, note, args_json, pre_hex_array, line);
}

/* Emits either a normal vector or an assert vector depending on `asserted`. */
static void emit_vector_or_assert(
    FILE *fp, const char *va, const char *name, int case_idx, const char *note,
    const char *args_json, const mem_region_t *regs, int nregs, const char *pre_hex_array,
    int asserted, uint32_t eax, uint32_t ret_mask
) {
    if (asserted) {
        emit_vector_assert(fp, va, name, case_idx, note, args_json, pre_hex_array, g_assert_line);
    } else {
        emit_vector(fp, va, name, case_idx, note, args_json, regs, nregs, pre_hex_array, eax, ret_mask, regs, nregs);
    }
}

static void emit_b045_part4(FILE *fp) {
    char args[200];
    int asserted = 0;
    uint32_t eax = 0;

    /* 0x6FD80DC0: pUnit == 0 -> `test esi, esi; je` (no flag write); bSet != 0 still calls 0x6FDB65C0(0) -> assert 0x75 */
    for (int c = 0; c < 2; c++) {
        setup_common_tables();
        mem_region_t regs[] = { {ARENA_UNIT0, 0x100u} };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 1);
        uint32_t bSet = (uint32_t)c;
        eax = safe_stdcall2(0x6FD80DC0u, 0u, bSet, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",%u", 0u, bSet);
        emit_vector_or_assert(fp, "0x6FD80DC0", "UNITS_SetUnitUpdateFlags113c", 2 + c,
            c == 0 ? "null_unit_clear" : "null_unit_set_refresh_asserts",
            args, regs, 1, g_pre_buf, asserted, 0u, 0u);
    }

    /* 0x6FD84150: pUnit == 0 -> `je 0x6FD842C4; pop ebp; ret 8` for both modes; then a wrapped state count */
    for (int c = 0; c < 3; c++) {
        setup_common_tables();
        uint32_t pUnit = 0u;
        if (c == 2) {
            pUnit = ARENA_UNIT0;
            U32(ARENA_SGPT + 0x0C4) = 0x7FFFFFF0u; /* (count + 0x1F) wraps negative -> dword count < 0 */
            U32(ARENA_UNIT0 + 0x00) = 0u;
            U32(ARENA_UNIT0 + 0x5C) = ARENA_STATLIST0;
            U32(ARENA_STATLIST0 + 0x10) = 0x80000000u;
            U32(ARENA_STATLIST0 + 0x58) = ARENA_STATHIST;
            U32(ARENA_STATHIST + 0) = 0x000000FFu;
        }
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {ARENA_SGPT, 0x120u}, {ARENA_UNIT0, 0x100u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATHIST, 0x40u}, {ARENA_STATEMASKS, 0x60u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 6);
        uint32_t bBoss = (c == 1) ? 1u : 0u;
        eax = safe_stdcall2(0x6FD84150u, pUnit, bBoss, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",%u", pUnit, bBoss);
        emit_vector_or_assert(fp, "0x6FD84150", "STATES_UpdateGfxStateFlagsByMask113c", 3 + c,
            c == 0 ? "null_unit_mode0" : (c == 1 ? "null_unit_boss_mode" : "state_count_wraps_negative"),
            args, regs, 6, g_pre_buf, asserted, 0u, 0u);
    }

    /* 0x6FD84080: same wrapped state count (dword count < 0 -> no loop, tail-calls 0x6FDB65C0), plus exact nDwords boundary */
    for (int c = 0; c < 2; c++) {
        setup_common_tables();
        U32(ARENA_SGPT + 0x0C4) = (c == 0) ? 0x7FFFFFF0u : 32u; /* c==1: nStates=32 -> nDwords=1, word[1] must NOT be touched */
        U32(ARENA_UNIT0 + 0x00) = 0u;
        U32(ARENA_UNIT0 + 0x2C) = ARENA_PATH0;
        U32(ARENA_UNIT0 + 0x5C) = ARENA_STATLIST0;
        U32(ARENA_STATLIST0 + 0x10) = 0x80000000u;
        U32(ARENA_STATLIST0 + 0x58) = ARENA_STATHIST;
        U32(ARENA_STATHIST + 0) = 0x000000FFu;
        U32(ARENA_STATHIST + 4) = 0x0000FF00u;
        U32(ARENA_STATEMASKS + 0) = 0x0000000Fu;
        U32(ARENA_STATEMASKS + 4) = 0x00000F00u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {ARENA_SGPT, 0x120u}, {ARENA_UNIT0, 0x100u},
            {ARENA_PATH0, 0x40u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATHIST, 0x40u},
            {ARENA_STATEMASKS, 0x60u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 7);
        eax = safe_6FD84080(ARENA_STATEMASKS, ARENA_UNIT0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_STATEMASKS, ARENA_UNIT0);
        emit_vector_or_assert(fp, "0x6FD84080", "UNITS_TransferStateMaskToRemoved113c", 2 + c,
            c == 0 ? "state_count_wraps_negative" : "exact_one_dword_boundary",
            args, regs, 7, g_pre_buf, asserted, 0u, 0u);
    }

    /* 0x6FDB6900 -> 0x6FDB6800: pUnit == 0 (0x42), pRoom == 0 (0x43), out of room (0x6FDB6630: 0x2E), already listed (0x36), plus x==roomX / y==roomY boundary */
    for (int c = 0; c < 5; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00) = 0u;
        U32(ARENA_UNIT0 + 0x2C) = ARENA_PATH0;
        U16(ARENA_PATH0 + 0x02) = (c == 2) ? 50u : ((c == 4) ? 5u : 10u);
        U16(ARENA_PATH0 + 0x06) = (c == 4) ? 5u : 20u;
        U32(ARENA_ROOM0 + 0x4C) = (c == 4) ? 5u : 0u;
        U32(ARENA_ROOM0 + 0x50) = (c == 4) ? 5u : 0u;
        U32(ARENA_ROOM0 + 0x54) = 40u;
        U32(ARENA_ROOM0 + 0x58) = 40u;
        if (c == 3) U32(ARENA_ROOM0 + 0x74) = ARENA_UNIT0;
        mem_region_t regs[] = {
            {ARENA_UNIT0, 0x100u}, {ARENA_PATH0, 0x40u}, {ARENA_ROOM0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
        uint32_t pUnit = (c == 0) ? 0u : ARENA_UNIT0;
        uint32_t pRoom = (c == 1) ? 0u : ARENA_ROOM0;
        eax = safe_stdcall2(0x6FDB6900u, pUnit, pRoom, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", pUnit, pRoom);
        emit_vector_or_assert(fp, "0x6FDB6900", "UNITROOM_SortUnitListByY113c", 2 + c,
            c == 0 ? "null_unit_asserts" : (c == 1 ? "null_room_asserts" : (c == 2 ? "unit_outside_room_asserts" : (c == 3 ? "unit_already_in_room_asserts" : "unit_at_exact_room_origin_boundary"))),
            args, regs, 3, g_pre_buf, asserted, eax, 0xFFFFFFFFu);
    }

    /* 0x6FD6F720: (c==0) NULL ItemsTxt record fallback; (c==1) NULL ItemsTxt table asserts 0x1EF;
     * (c==2) middle item in 3-item grid chain unlinks prev/next and clears +0x10/+0x14/+0x0C */
    for (int c = 0; c < 3; c++) {
        setup_common_tables();
        if (c == 1) U32(0x6FDEFB98) = 0u;
        if (c < 2) {
            U32(ARENA_ITEM0 + 0x00) = 4u;
            U32(ARENA_ITEM0 + 0x04) = (c == 0) ? 0x7FFFu : 0u;
            U32(ARENA_ITEM0 + 0x14) = ARENA_ITEMDATA0;
            U32(ARENA_ITEM0 + 0x2C) = ARENA_PATH0;
            U32(ARENA_PATH0 + 0x0C) = 1u;
            U32(ARENA_PATH0 + 0x10) = 1u;
            U8(ARENA_ITEMDATA0 + 0x5Cu + 0x0Cu) = 1u;
            U32(ARENA_GRID_ODD + 0x00) = ARENA_ITEM0;
            U32(ARENA_GRID_ODD + 0x04) = ARENA_ITEM0;
            U8(ARENA_GRID_ODD + 0x08) = 8u;
            U8(ARENA_GRID_ODD + 0x09) = 8u;
            U32(ARENA_GRID_ODD + 0x0C) = ARENA_CELLS_BIG;
            for (int i = 0; i < 64; i++) U32(ARENA_CELLS_BIG + i * 4) = ARENA_ITEM0;
            mem_region_t regs[] = {
                {0x6FDEFB94u, 8}, {ARENA_ITEMSTXT, 0x1A8u}, {ARENA_ITEM0, 0x40u},
                {ARENA_ITEMDATA0, 0x80u}, {ARENA_PATH0, 0x20u}, {ARENA_GRID_ODD, 0x20u},
                {ARENA_CELLS_BIG, 0x100u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 7);
            eax = safe_6FD6F720(ARENA_ITEM0, ARENA_GRID_ODD, 1u, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",%u", ARENA_ITEM0, ARENA_GRID_ODD, 1u);
            emit_vector_or_assert(fp, "0x6FD6F720", "INVENTORY_RemoveItemFromGrid113c", 2 + c,
                c == 0 ? "null_itemstxt_record_uses_grid_low_byte_dims" : "null_itemstxt_table_asserts_1ef",
                args, regs, 7, g_pre_buf, asserted, 0u, 0u);
        } else {
            U32(ARENA_ITEM0 + 0x00) = 4u;
            U32(ARENA_ITEM0 + 0x14) = ARENA_ITEMDATA0;
            U8(ARENA_ITEMDATA0 + 0x5Cu + 0x0Cu) = 1u;
            U32(ARENA_ITEMDATA0 + 0x5Cu + 0x10u) = 0u;
            U32(ARENA_ITEMDATA0 + 0x5Cu + 0x14u) = ARENA_ITEM1;

            U32(ARENA_ITEM1 + 0x00) = 4u;
            U32(ARENA_ITEM1 + 0x04) = 0u;
            U32(ARENA_ITEM1 + 0x14) = ARENA_ITEMDATA1;
            U32(ARENA_ITEM1 + 0x2C) = ARENA_PATH0;
            U32(ARENA_PATH0 + 0x0C) = 2u;
            U8(ARENA_ITEMDATA1 + 0x5Cu + 0x0Cu) = 1u;
            U32(ARENA_ITEMDATA1 + 0x5Cu + 0x10u) = ARENA_ITEM0;
            U32(ARENA_ITEMDATA1 + 0x5Cu + 0x14u) = ARENA_ITEM2;

            U32(ARENA_ITEM2 + 0x00) = 4u;
            U32(ARENA_ITEM2 + 0x14) = ARENA_ITEMDATA2;
            U8(ARENA_ITEMDATA2 + 0x5Cu + 0x0Cu) = 1u;
            U32(ARENA_ITEMDATA2 + 0x5Cu + 0x10u) = ARENA_ITEM1;
            U32(ARENA_ITEMDATA2 + 0x5Cu + 0x14u) = 0u;

            U32(ARENA_GRIDS + 0x00) = ARENA_ITEM0;
            U32(ARENA_GRIDS + 0x04) = ARENA_ITEM2;
            U8(ARENA_GRIDS + 0x08) = 4u;
            U8(ARENA_GRIDS + 0x09) = 1u;
            U32(ARENA_GRIDS + 0x0C) = ARENA_GRIDCELLS0;
            U32(ARENA_GRIDCELLS0 + 2 * 4) = ARENA_ITEM1;

            mem_region_t regs[] = {
                {ARENA_ITEM0, 0x40u}, {ARENA_ITEMDATA0, 0x80u},
                {ARENA_ITEM1, 0x40u}, {ARENA_ITEMDATA1, 0x80u},
                {ARENA_ITEM2, 0x40u}, {ARENA_ITEMDATA2, 0x80u},
                {ARENA_PATH0, 0x20u}, {ARENA_GRIDS, 0x20u}, {ARENA_GRIDCELLS0, 0x20u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
            eax = safe_6FD6F720(ARENA_ITEM1, ARENA_GRIDS, 0u, &asserted);
            snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",0", ARENA_ITEM1, ARENA_GRIDS);
            emit_vector_or_assert(fp, "0x6FD6F720", "INVENTORY_RemoveItemFromGrid113c", 4,
                "middle_item_unlink_updates_prev_and_next",
                args, regs, 9, g_pre_buf, asserted, 0u, 0u);
        }
    }

    /* 0x6FD731A0: NULL ItemsTxt table base with classId < count -> 0x6FDC19A0 asserts 0x1EF */
    {
        setup_common_tables();
        U32(0x6FDEFB98) = 0u;
        U32(ARENA_ITEM0 + 0x00) = 4u;
        U32(ARENA_ITEM0 + 0x04) = 0u;
        mem_region_t regs[] = { {0x6FDEFB94u, 8}, {ARENA_ITEM0, 0x20u}, {ARENA_OUT, 0x10u} };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
        eax = safe_stdcall5(0x6FD731A0u, ARENA_ITEM0, ARENA_OUT + 0, ARENA_OUT + 4, 0, 0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\",\"0x%08X\",0,0", ARENA_ITEM0, ARENA_OUT + 0, ARENA_OUT + 4);
        emit_vector_or_assert(fp, "0x6FD731A0", "INVENTORY_GetItemDimensionsCallback113c", 2,
            "null_itemstxt_table_asserts_1ef", args, regs, 3, g_pre_buf, asserted, 0u, 0u);
    }

    /* 0x6FD72CD0: (a) NULL ItemsTxt records with empty stack groups -> 0 without dereferencing;
     * (b) group 3 (0x6FDEF068/0x6FDEF06C) lists both codes -> 1;
     * (c) null first item -> 0 */
    for (int c = 0; c < 3; c++) {
        setup_common_tables();
        U32(0x6FDEF08Cu) = 0u;
        U32(0x6FDEF074u) = 0u;
        U32(0x6FDEF068u) = 0u;
        U32(ARENA_ITEM0 + 0x00) = 4u;
        U32(ARENA_ITEM1 + 0x00) = 4u;
        if (c == 0) {
            U32(ARENA_ITEM0 + 0x04) = 0x7FFFu;
            U32(ARENA_ITEM1 + 0x04) = 0x7FFEu;
        } else {
            U32(ARENA_ITEM0 + 0x04) = 2u; /* hp1 */
            U32(ARENA_ITEM1 + 0x04) = 3u; /* hp2 */
            U32(0x6FDEF068u) = 2u;
            U32(0x6FDEF06Cu) = 0x20327068u;
            U32(0x6FDEF070u) = 0x20317068u;
        }
        mem_region_t regs[] = {
            {0x6FDEFB94u, 8}, {0x6FDEF068u, 0x40u}, {ARENA_ITEM0, 0x20u}, {ARENA_ITEM1, 0x20u},
            {ARENA_ITEMSTXT, 8 * 0x1A8u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 5);
        uint32_t p1 = (c == 2) ? 0u : ARENA_ITEM0;
        eax = safe_stdcall2(0x6FD72CD0u, p1, ARENA_ITEM1, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", p1, ARENA_ITEM1);
        emit_vector_or_assert(fp, "0x6FD72CD0", "ITEMS_AreStackablesCompatible113c", 3 + c,
            c == 0 ? "null_records_empty_groups" : (c == 1 ? "group3_lists_both_codes" : "null_first_item_returns_0"),
            args, regs, 5, g_pre_buf, asserted, eax, 0xFFFFFFFFu);
        U32(0x6FDEF068u) = 0u;
        U32(0x6FDEF06Cu) = 0u;
        U32(0x6FDEF070u) = 0u;
    }

    /* 0x6FD70270: 0x6FD74430 has no broken check (broken left still counts) and falls back to wType[1] (+0x120) */
    for (int c = 0; c < 2; c++) {
        setup_common_tables();
        U32(ARENA_INV0 + 0x00) = 0x01020304u;
        U32(ARENA_INV0 + 0x14) = ARENA_GRIDS;
        U32(ARENA_INV0 + 0x18) = 1u;
        U32(ARENA_INV0 + 0x1C) = 101u;
        U8(ARENA_GRIDS + 0x08) = 13u;
        U8(ARENA_GRIDS + 0x09) = 1u;
        U32(ARENA_GRIDS + 0x0C) = ARENA_GRIDCELLS0;
        U32(ARENA_ITEM0 + 0x00) = 4u;
        U32(ARENA_ITEM0 + 0x04) = 0u; /* sword */
        U32(ARENA_ITEM0 + 0x0C) = 101u;
        U32(ARENA_ITEM0 + 0x14) = ARENA_ITEMDATA0;
        U32(ARENA_ITEM1 + 0x00) = 4u;
        U32(ARENA_ITEM1 + 0x04) = (c == 0) ? 0u : 1u; /* sword, or shield whose wType[1] is the sword type */
        U32(ARENA_ITEM1 + 0x0C) = 102u;
        U32(ARENA_ITEM1 + 0x14) = ARENA_ITEMDATA1;
        if (c == 0) U32(ARENA_ITEMDATA0 + 0x18) = 0x100u; /* broken left weapon */
        if (c == 1) U16(ARENA_ITEMSTXT + 1 * 0x1A8u + 0x120u) = 0x1Eu;
        U32(ARENA_GRIDCELLS0 + 5 * 4) = ARENA_ITEM0;
        U32(ARENA_GRIDCELLS0 + 4 * 4) = ARENA_ITEM1;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDEFB94u, 8}, {0x6FDD9088u, 0xACu}, {0x6FDED378u, 0x18u},
            {ARENA_SGPT, 0xC10u}, {ARENA_INV0, 0x30u}, {ARENA_GRIDS, 0x20u},
            {ARENA_GRIDCELLS0, 0x40u}, {ARENA_ITEM0, 0x40u}, {ARENA_ITEMDATA0, 0x40u},
            {ARENA_ITEM1, 0x40u}, {ARENA_ITEMDATA1, 0x40u}, {ARENA_ITEMSTXT, 2 * 0x1A8u},
            {ARENA_ITYPEMAT, 0x200u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 14);
        eax = safe_stdcall1(0x6FD70270u, ARENA_INV0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_INV0);
        emit_vector_or_assert(fp, "0x6FD70270", "INVENTORY_GetSecondaryWeapon113c", 3 + c,
            c == 0 ? "broken_left_still_typed_weapon" : "right_weapon_via_wtype1",
            args, regs, 14, g_pre_buf, asserted, eax, 0xFFFFFFFFu);
    }

    /* 0x6FD6FF40: right-arm item is a shield only through wType[1] (+0x120) */
    {
        setup_common_tables();
        U32(ARENA_INV0 + 0x00) = 0x01020304u;
        U32(ARENA_INV0 + 0x14) = ARENA_GRIDS;
        U32(ARENA_INV0 + 0x18) = 1u;
        U8(ARENA_GRIDS + 0x08) = 13u;
        U8(ARENA_GRIDS + 0x09) = 1u;
        U32(ARENA_GRIDS + 0x0C) = ARENA_GRIDCELLS0;
        U32(ARENA_ITEM0 + 0x00) = 4u;
        U32(ARENA_ITEM0 + 0x04) = 0u;
        U32(ARENA_ITEM0 + 0x14) = ARENA_ITEMDATA0;
        U16(ARENA_ITEMSTXT + 0 * 0x1A8u + 0x120u) = 0x33u;
        U32(ARENA_GRIDCELLS0 + 4 * 4) = ARENA_ITEM0;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDEFB94u, 8}, {0x6FDD9088u, 0xACu}, {0x6FDED378u, 0x18u},
            {ARENA_SGPT, 0xC10u}, {ARENA_INV0, 0x30u}, {ARENA_GRIDS, 0x20u},
            {ARENA_GRIDCELLS0, 0x40u}, {ARENA_ITEM0, 0x40u}, {ARENA_ITEMDATA0, 0x40u},
            {ARENA_ITEMSTXT, 2 * 0x1A8u}, {ARENA_ITYPEMAT, 0x200u}, {ARENA_OUT, 0x10u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 13);
        eax = safe_stdcall2(0x6FD6FF40u, ARENA_INV0, ARENA_OUT, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_INV0, ARENA_OUT);
        emit_vector_or_assert(fp, "0x6FD6FF40", "INVENTORY_GetEquippedShield113c", 3,
            "right_arm_shield_via_wtype1", args, regs, 13, g_pre_buf, asserted, eax, 0xFFFFFFFFu);
    }

    /* 0x6FD5D540 -> 0x6FDB6700: allied count 0 for a player (0x6FD8B650 asserts 0x27C); NULL path unit (asserts 0xEF);
     * plus unit in room update list (0x6FDB6410 unlinks pRoomUpdateHead) */
    for (int c = 0; c < 3; c++) {
        setup_common_tables();
        U32(ARENA_PATH0 + 0x1C) = ARENA_ROOM0;
        U32(ARENA_PATH0 + 0x30) = (c == 1) ? 0u : ARENA_UNIT0;
        U32(ARENA_UNIT0 + 0x00) = 0u;
        U32(ARENA_UNIT0 + 0x2C) = ARENA_PATH0;
        U32(ARENA_ROOM0 + 0x28) = (c == 0) ? 0u : 1u;
        U32(ARENA_ROOM0 + 0x74) = ARENA_UNIT0;
        if (c == 2) {
            U32(ARENA_UNIT0 + 0xC4) = 0x200u; /* UNITFLAG_UPDATING */
            U32(ARENA_ROOM0 + 0x6C) = ARENA_UNIT0; /* pRoomUpdateHead */
        }
        mem_region_t regs[] = {
            {0x6FDDD458u, 8}, {ARENA_PATH0, 0x60u}, {ARENA_UNIT0, 0x100u}, {ARENA_ROOM0, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 4);
        eax = safe_6FD5D540(ARENA_PATH0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_PATH0);
        emit_vector_or_assert(fp, "0x6FD5D540", "PATH_ResetDynamicPathRoomAndCoordsInline113c", 2 + c,
            c == 0 ? "allied_count_zero_asserts_27c" : (c == 1 ? "null_path_unit_asserts_ef" : "unlinks_unit_from_room_update_list"),
            args, regs, 4, g_pre_buf, asserted, 0u, 0u);
    }

    /* 0x6FD6A3D0: monster spawn with classId == 0 boundary */
    {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00) = 1u;
        U32(ARENA_UNIT0 + 0x04) = 0u; /* classId 0 */
        U32(ARENA_UNIT0 + 0x2C) = ARENA_PATH0;
        U16(ARENA_PATH0 + 0x02) = 100u;
        U16(ARENA_PATH0 + 0x06) = 200u;
        uint32_t mrec0 = ARENA_MONSTATS + 0 * 0x1A8u;
        S16(mrec0 + 0x20u) = 19;
        U8(mrec0 + 0x22u)  = 2;
        U8(mrec0 + 0x23u)  = 4;
        U8(mrec0 + 0x24u)  = 6;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {ARENA_SGPT, 0xC00u}, {mrec0, 0x1A8u},
            {ARENA_UNIT0, 0x60u}, {ARENA_PATH0, 0x40u}, {ARENA_OUT, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 6);
        eax = ((stdcall7_t)(uintptr_t)0x6FD6A3D0u)(
            ARENA_UNIT0, 1u, 0u, 0u, ARENA_OUT + 0, ARENA_OUT + 4, ARENA_OUT + 8);
        snprintf(args, sizeof(args), "\"0x%08X\",1,0,0,\"0x%08X\",\"0x%08X\",\"0x%08X\"",
            ARENA_UNIT0, ARENA_OUT + 0, ARENA_OUT + 4, ARENA_OUT + 8);
        emit_vector(fp, "0x6FD6A3D0", "UNITS_GetSpawnedMonsterOrSkillSummonInfo113c", 3,
            "monster_class_id_0_boundary", args, regs, 6, g_pre_buf, eax, 0xFFFFFFFFu, regs, 6);
    }

    /* 0x6FD6E5B0: exact belt slot 16 boundary when cell 16 is non-zero */
    {
        setup_common_tables();
        U32(ARENA_INV0 + 0x00) = 0x01020304u;
        U32(ARENA_INV0 + 0x14) = ARENA_GRIDS;
        U32(ARENA_INV0 + 0x18) = 2u;
        U8(ARENA_GRIDS + 0x10 + 0x08) = 16;
        U8(ARENA_GRIDS + 0x10 + 0x09) = 1;
        U32(ARENA_GRIDS + 0x10 + 0x0C) = ARENA_GRIDCELLS1;
        U32(ARENA_GRIDCELLS1 + 16 * 4) = ARENA_ITEM0;
        mem_region_t regs[] = {
            {0x6FDED390u, 0x18u}, {ARENA_INV0, 0x30u}, {ARENA_GRIDS, 0x30u}, {ARENA_GRIDCELLS1, 0x50u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 4);
        eax = ((stdcall2_t)(uintptr_t)0x6FD6E5B0u)(ARENA_INV0, 16u);
        snprintf(args, sizeof(args), "\"0x%08X\",16", ARENA_INV0);
        emit_vector(fp, "0x6FD6E5B0", "INVENTORY_GetBeltItem113c", 2,
            "exact_slot_16_boundary", args, regs, 4, g_pre_buf, eax, 0xFFFFFFFFu, regs, 4);
    }

    /* 0x6FD6E600 & 0x6FD6E630: non-item unit returns 0, and exact x==11 boundary for BodyLocFromX */
    for (int c = 0; c < 2; c++) {
        setup_common_tables();
        U32(ARENA_INV0 + 0x00) = 0x01020304u;
        U32(ARENA_ITEM0 + 0x00) = (c == 0) ? 0u : 4u; /* c==0: UNIT_PLAYER (non-item), c==1: UNIT_ITEM */
        U32(ARENA_ITEM0 + 0x2C) = ARENA_PATH0;
        U32(ARENA_PATH0 + 0x0C) = (c == 0) ? 5u : 11u;
        mem_region_t regs[] = {
            {ARENA_INV0, 0x20u}, {ARENA_ITEM0, 0x40u}, {ARENA_PATH0, 0x20u}
        };
        if (c == 0) {
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
            uint32_t eax0 = ((stdcall2_t)(uintptr_t)0x6FD6E600u)(ARENA_INV0, ARENA_ITEM0);
            snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_INV0, ARENA_ITEM0);
            emit_vector(fp, "0x6FD6E600", "INVENTORY_GetItemGridXIfInInventory113c", 2,
                "non_item_unit_returns_0", args, regs, 3, g_pre_buf, eax0, 0xFFFFFFFFu, regs, 3);
        }
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
        uint32_t eax1 = ((stdcall2_t)(uintptr_t)0x6FD6E630u)(ARENA_INV0, ARENA_ITEM0);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_INV0, ARENA_ITEM0);
        emit_vector(fp, "0x6FD6E630", "INVENTORY_GetItemBodyLocFromX113c", 2 + c,
            c == 0 ? "non_item_unit_returns_0" : "bodyloc_exact_11_boundary",
            args, regs, 3, g_pre_buf, eax1, 0xFFFFFFFFu, regs, 3);
    }
}

static void emit_b043_part5(FILE *fp) {
    char args[200];
    int asserted = 0;
    uint32_t eax = 0;

    /* 0x6FD81B40 -> 0x6FD70700: slot 4 (+0x10) wins over slot 5 regardless of dwWeaponId, plus monster with null pInventory */
    for (int c = 0; c < 3; c++) {
        setup_common_tables();
        U32(ARENA_UNIT0 + 0x00) = 1u;
        U32(ARENA_UNIT0 + 0x60) = (c == 2) ? 0u : ARENA_INV0;
        U32(ARENA_INV0 + 0x00) = 0x01020304u;
        U32(ARENA_INV0 + 0x14) = ARENA_GRIDS;
        U32(ARENA_INV0 + 0x18) = 1u;
        U32(ARENA_INV0 + 0x1C) = (c == 0) ? 0xFFFFFFFFu : 101u;
        U8(ARENA_GRIDS + 0x08) = 13u;
        U8(ARENA_GRIDS + 0x09) = 1u;
        U32(ARENA_GRIDS + 0x0C) = ARENA_GRIDCELLS0;
        U32(ARENA_ITEM0 + 0x00) = 4u;
        U32(ARENA_ITEM0 + 0x04) = 0u;
        U32(ARENA_ITEM0 + 0x0C) = 101u;
        U32(ARENA_ITEM0 + 0x14) = ARENA_ITEMDATA0;
        U32(ARENA_ITEM1 + 0x00) = 4u;
        U32(ARENA_ITEM1 + 0x04) = 0u;
        U32(ARENA_ITEM1 + 0x0C) = 102u;
        U32(ARENA_ITEM1 + 0x14) = ARENA_ITEMDATA1;
        U32(ARENA_GRIDCELLS0 + 5 * 4) = ARENA_ITEM0;
        U32(ARENA_GRIDCELLS0 + 4 * 4) = ARENA_ITEM1;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDEFB94u, 8}, {0x6FDD9088u, 0xACu}, {0x6FDED378u, 0x18u},
            {ARENA_SGPT, 0xC10u}, {ARENA_UNIT0, 0x100u}, {ARENA_INV0, 0x40u},
            {ARENA_GRIDS, 0x20u}, {ARENA_GRIDCELLS0, 0x40u}, {ARENA_ITEM0, 0x40u},
            {ARENA_ITEMDATA0, 0x40u}, {ARENA_ITEM1, 0x40u}, {ARENA_ITEMDATA1, 0x40u},
            {ARENA_ITEMSTXT, 0x1A8u}, {ARENA_ITYPEMAT, 0x200u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 15);
        eax = safe_stdcall1(0x6FD81B40u, ARENA_UNIT0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
        emit_vector_or_assert(fp, "0x6FD81B40", "UNITS_GetMonsterActiveWeapon113c", 3 + c,
            c == 0 ? "both_arms_weapons_slot4_first" : (c == 1 ? "weapon_id_matches_left_slot4_still_first" : "monster_null_inventory"),
            args, regs, 15, g_pre_buf, asserted, eax, 0xFFFFFFFFu);
    }

    /* 0x6FD88FF0, 0x6FD89050, 0x6FD890A0, 0x6FD890F0: exact ISC count boundary (count == statId returns 0; count == 0x0C for stamina returns 250) */
    {
        const uint32_t bvas[5] = {0x6FD88FF0u, 0x6FD89050u, 0x6FD89050u, 0x6FD890A0u, 0x6FD890F0u};
        const char *bva_strs[5] = {"0x6FD88FF0", "0x6FD89050", "0x6FD89050", "0x6FD890A0", "0x6FD890F0"};
        const char *bnames[5] = {
            "STATLIST_GetMaxDurabilityFromUnit113c",
            "STATLIST_GetMaxStaminaFromUnit113c",
            "STATLIST_GetMaxStaminaFromUnit113c",
            "STATLIST_GetMaxManaFromUnit113c",
            "STATLIST_GetMaxLifeFromUnit113c"
        };
        const uint32_t bsids[5] = {0x49u, 0x0Bu, 0x0Bu, 0x09u, 0x07u};
        const uint32_t bcnts[5] = {0x49u, 0x0Bu, 0x0Cu, 0x09u, 0x07u};
        const int bcidx[5] = {2, 2, 3, 2, 2};
        const char *bnotes[5] = {
            "isc_count_eq_0x49_boundary",
            "isc_count_eq_0x0b_boundary",
            "isc_count_eq_0x0c_boundary",
            "isc_count_eq_0x09_boundary",
            "isc_count_eq_0x07_boundary"
        };
        for (int k = 0; k < 5; k++) {
            setup_unit_with_statlist(bsids[k], 40, 250);
            U32(ARENA_SGPT + 0xBD4) = bcnts[k];
            mem_region_t regs[] = {
                {0x6FDE9E1Cu, 4}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
                {ARENA_ISC + bsids[k] * 0x144u, 0x144u}, {ARENA_UNIT0, 0x80u},
                {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x20u}, {ARENA_STATS1, 0x20u}
            };
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
            eax = ((stdcall1_t)(uintptr_t)bvas[k])(ARENA_UNIT0);
            snprintf(args, sizeof(args), "\"0x%08X\"", ARENA_UNIT0);
            emit_vector(fp, bva_strs[k], bnames[k], bcidx[k], bnotes[k],
                args, regs, 8, g_pre_buf, eax, 0xFFFFFFFFu, regs, 8);
        }
    }

    /* 0x6FD89140, 0x6FD891A0, 0x6FD89430, 0x6FD894E0: non-zero statId/layer composition & statId==count boundaries */
    {
        /* 0x6FD89140: statId=7, nLayer=1 */
        setup_unit_with_statlist(7u, 42, 99);
        U32(ARENA_STATS0 + 0) = (7u << 16) | 1u;
        mem_region_t regs7[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {ARENA_ISC + 7u * 0x144u, 0x144u}, {ARENA_UNIT0, 0x80u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x20u}, {ARENA_STATS1, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs7, 8);
        eax = ((stdcall3_t)(uintptr_t)0x6FD89140u)(ARENA_STATLIST0, 7u, 1u);
        snprintf(args, sizeof(args), "\"0x%08X\",7,1", ARENA_STATLIST0);
        emit_vector(fp, "0x6FD89140", "STATLIST_GetStatValue113c", 2,
            "stat7_layer1_odd_layer", args, regs7, 8, g_pre_buf, eax, 0xFFFFFFFFu, regs7, 8);

        /* 0x6FD891A0: statId==count boundary */
        setup_unit_with_statlist(7u, 42, 99);
        U32(ARENA_SGPT + 0xBD4) = 7u;
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs7, 8);
        eax = ((stdcall2_t)(uintptr_t)0x6FD891A0u)(ARENA_STATLIST0, 7u);
        snprintf(args, sizeof(args), "\"0x%08X\",7", ARENA_STATLIST0);
        emit_vector(fp, "0x6FD891A0", "STATLIST_GetTotalStatValueLayer0_113c", 2,
            "stat_eq_count_boundary", args, regs7, 8, g_pre_buf, eax, 0xFFFFFFFFu, regs7, 8);

        /* 0x6FD89430: statId==count boundary */
        setup_unit_with_statlist(7u, 42, 99);
        U32(ARENA_SGPT + 0xBD4) = 7u;
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs7, 8);
        eax = ((stdcall3_t)(uintptr_t)0x6FD89430u)(ARENA_UNIT0, 7u, 0u);
        snprintf(args, sizeof(args), "\"0x%08X\",7,0", ARENA_UNIT0);
        emit_vector(fp, "0x6FD89430", "STATLIST_GetUnitStatWithLayer113c", 2,
            "stat_eq_count_boundary", args, regs7, 8, g_pre_buf, eax, 0xFFFFFFFFu, regs7, 8);

        /* 0x6FD894E0: statId=7, nLayer=2 found, and statId==count boundary */
        for (int c = 0; c < 2; c++) {
            setup_unit_with_statlist(7u, 44, 85);
            U32(ARENA_STATS0 + 0) = (7u << 16) | 2u;
            if (c == 1) U32(ARENA_SGPT + 0xBD4) = 7u;
            capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs7, 8);
            eax = call_6FD894E0(0x6FD894E0u, ARENA_STATLIST0, 7u, 2u);
            snprintf(args, sizeof(args), "\"0x%08X\",7,2", ARENA_STATLIST0);
            emit_vector(fp, "0x6FD894E0", "STATLIST_GetBaseStatFromListInline113c", 2 + c,
                c == 0 ? "stat7_layer2_found" : "stat_eq_count_boundary",
                args, regs7, 8, g_pre_buf, eax, 0xFFFFFFFFu, regs7, 8);
        }
    }

    /* 0x6FD8A1D0: update second entry (idx == 1) in base stats */
    {
        setup_unit_with_statlist(1u, 5, 5);
        U8(ARENA_ISC + 2u * 0x144u + 0x04u) = 0x80u;
        U8(ARENA_ISC + 2u * 0x144u + 0x05u) = 0x10u;
        U16(ARENA_STATLIST0 + 0x28) = 2u;
        U16(ARENA_STATLIST0 + 0x2A) = 4u;
        U32(ARENA_STATS0 + 8) = (2u << 16);
        S32(ARENA_STATS0 + 12) = 10;
        U16(ARENA_STATLIST0 + 0x4C) = 2u;
        U16(ARENA_STATLIST0 + 0x4E) = 4u;
        U32(ARENA_STATS1 + 8) = (2u << 16);
        S32(ARENA_STATS1 + 12) = 10;
        U32(ARENA_STATLIST0 + 0x50) = ARENA_MODSTATS;
        U16(ARENA_STATLIST0 + 0x54) = 0u;
        U16(ARENA_STATLIST0 + 0x56) = 4u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {ARENA_ISC + 1u * 0x144u, 2 * 0x144u}, {ARENA_UNIT0, 0x100u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x20u}, {ARENA_STATS1, 0x20u},
            {ARENA_MODSTATS, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
        eax = ((stdcall5_t)(uintptr_t)0x6FD8A1D0u)(ARENA_STATLIST0, 2u, 25u, 0u, ARENA_UNIT0);
        snprintf(args, sizeof(args), "\"0x%08X\",2,25,0,\"0x%08X\"", ARENA_STATLIST0, ARENA_UNIT0);
        emit_vector(fp, "0x6FD8A1D0", "STATLIST_SetBaseStatEx113c", 3,
            "update_second_entry_idx1", args, regs, 9, g_pre_buf, eax, 0xFFFFFFFFu, regs, 9);
    }

    /* 0x6FD8AAB0: non-extended statlist (dwFlags == 0) returns 0 */
    {
        setup_unit_with_statlist(0u, 10, 10);
        U32(ARENA_STATLIST0 + 0x10) = 0u; /* non-extended */
        U32(ARENA_STATLIST0 + 0x3C) = ARENA_STATLIST1;
        U32(ARENA_STATLIST1 + 0x10) = 0x00000040u;
        U32(ARENA_STATLIST1 + 0x14) = 5u;
        mem_region_t regs[] = {
            {ARENA_UNIT0, 0x100u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATLIST1, 0x80u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 3);
        eax = ((stdcall3_t)(uintptr_t)0x6FD8AAB0u)(ARENA_UNIT0, 5u, 1u);
        snprintf(args, sizeof(args), "\"0x%08X\",5,1", ARENA_UNIT0);
        emit_vector(fp, "0x6FD8AAB0", "STATLIST_UpdateUnitStateSetFlag113c", 3,
            "non_extended_statlist_returns_0", args, regs, 3, g_pre_buf, eax, 0xFFFFFFFFu, regs, 3);
    }

    /* 0x6FD96D50: eOwnerType (+0x08) == 0 with non-zero dwOwnerId (+0x0C) == 7 still records mod stats */
    {
        setup_unit_with_statlist(0x49u, 30, 30);
        U8(ARENA_ISC + 0x48u * 0x144u + 0x04u) = 0x80u;
        U8(ARENA_ISC + 0x48u * 0x144u + 0x05u) = 0x10u;
        U8(ARENA_ISC + 0x49u * 0x144u + 0x04u) = 0x80u;
        U8(ARENA_ISC + 0x49u * 0x144u + 0x05u) = 0x10u;
        U32(ARENA_UNIT0 + 0x00) = 4u;
        U32(ARENA_STATLIST0 + 0x08) = 0u; /* eOwnerType = UNIT_PLAYER */
        U32(ARENA_STATLIST0 + 0x0C) = 7u; /* dwOwnerId != 0 */
        U16(ARENA_STATLIST0 + 0x28) = 2u;
        U16(ARENA_STATLIST0 + 0x2A) = 4u;
        U32(ARENA_STATS0 + 0) = (0x48u << 16);
        S32(ARENA_STATS0 + 4) = 20;
        U32(ARENA_STATS0 + 8) = (0x49u << 16);
        S32(ARENA_STATS0 + 12) = 30;
        U16(ARENA_STATLIST0 + 0x4C) = 2u;
        U16(ARENA_STATLIST0 + 0x4E) = 4u;
        U32(ARENA_STATS1 + 0) = (0x48u << 16);
        S32(ARENA_STATS1 + 4) = 20;
        U32(ARENA_STATS1 + 8) = (0x49u << 16);
        S32(ARENA_STATS1 + 12) = 30;
        U32(ARENA_STATLIST0 + 0x50) = ARENA_MODSTATS;
        U16(ARENA_STATLIST0 + 0x54) = 0u;
        U16(ARENA_STATLIST0 + 0x56) = 4u;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {ARENA_ISC + 0x48u * 0x144u, 0x288u}, {ARENA_UNIT0, 0x100u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x20u}, {ARENA_STATS1, 0x20u},
            {ARENA_MODSTATS, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
        eax = ((stdcall7_t)(uintptr_t)0x6FD96D50u)(ARENA_UNIT0, 0, 0, 0, 0, 0, 0);
        snprintf(args, sizeof(args), "\"0x%08X\",0,0,0,0,0,0", ARENA_UNIT0);
        emit_vector(fp, "0x6FD96D50", "STATLIST_RemoveItemDurabilityStatsModHandler113c", 2,
            "owner_type_0_nonzero_owner_id_records_modstat", args, regs, 9, g_pre_buf, eax, 0xFFFFFFFFu, regs, 9);
    }

    /* 0x6FDA4A00: nLevel >= monLvlCount clamps to monLvlCount-1; monLvlCount==0 returns 0 */
    for (int c = 0; c < 2; c++) {
        setup_common_tables();
        U32(ARENA_SGPT + 0xB74) = (c == 0) ? 6u : 0u;
        uint32_t mrec = ARENA_MONSTATS + 1 * 0x1A8u;
        for (int d = 0; d < 3; d++) {
            S16(mrec + 0xB0u + d * 2) = (int16_t)(100 + d * 20);
            S16(mrec + 0xB6u + d * 2) = (int16_t)(150 + d * 20);
        }
        uint32_t lrec = ARENA_MONLVL + 5 * 0x78u;
        for (int i = 0; i < 30; i++) {
            S32(lrec + i * 4) = 120 + i * 5;
        }
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {mrec, 0x1A8u}, {lrec, 0xF0u}, {ARENA_OUT, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 6);
        uint32_t lvl = (c == 0) ? 6u : 0u;
        eax = ((stdcall6_t)(uintptr_t)0x6FDA4A00u)(1u, 1u, 1u, lvl, 0x01u, ARENA_OUT);
        snprintf(args, sizeof(args), "\"0x00000001\",1,1,%u,\"0x00000001\",\"0x%08X\"", lvl, ARENA_OUT);
        emit_vector(fp, "0x6FDA4A00", "DATATBLS_CalculateMonsterStatsByLevel113c", 3 + c,
            c == 0 ? "level_clamped_to_monlvl_count_minus_1" : "zero_monlvl_count_returns_0",
            args, regs, 6, g_pre_buf, eax, 0xFFFFFFFFu, regs, 6);
    }

    /* 0x6FDBAB20: elemType == 5 (poison mastery, stat 0x14C) */
    {
        setup_unit_with_statlist(0x14Cu, 50, 50);
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {ARENA_ISC + 0x14Cu * 0x144u, 0x144u}, {ARENA_UNIT0, 0x80u},
            {ARENA_STATLIST0, 0x80u}, {ARENA_STATS0, 0x20u}, {ARENA_STATS1, 0x20u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 8);
        eax = call_6FDBAB20(0x6FDBAB20u, ARENA_UNIT0, 5u, 200u);
        snprintf(args, sizeof(args), "\"0x%08X\",5,200", ARENA_UNIT0);
        emit_vector(fp, "0x6FDBAB20", "MISSILE_CalculateMasteryBonus113c", 3,
            "poison_mastery_elem5", args, regs, 8, g_pre_buf, eax, 0xFFFFFFFFu, regs, 8);
    }

    /* 0x6FDBB180 -> 0x6FD9F640 -> 0x6FD9F200: throwing mastery (stat 0x15B) applies; melee 0x158 absent;
     * plus exact r3 == masteryCritPct (37) boundary, and nType == dwItemTypesCount (0x1E) boundary */
    for (int c = 0; c < 4; c++) {
        setup_common_tables();
        U32(ARENA_SGPT + 0xBF8) = ARENA_ITYPESTXT;
        if (c == 3) U32(ARENA_SGPT + 0xBFC) = 0x1Eu; /* nType == dwItemTypesCount boundary */
        U8(ARENA_ITYPESTXT + 0x1Eu * 0xE4u + 0x10u) = 1u;          /* type 0x1E throwable */
        U32(ARENA_ITYPEMAT + 0x1Eu * 8u + 4u) |= (1u << (0x30u - 32u)); /* 0x1E equivalent to 0x30 */
        U32(ARENA_UNIT0 + 0x00) = 0u;
        U32(ARENA_UNIT0 + 0x20) = 5u; /* first roll r3 == 37 */
        U32(ARENA_UNIT0 + 0x24) = 0u;
        U32(ARENA_UNIT0 + 0x5C) = ARENA_STATLIST0;
        U32(ARENA_UNIT0 + 0xA8) = ARENA_SKILLINFO;
        U32(ARENA_SKILLINFO + 0x10) = ARENA_SKILL0;
        uint32_t stxt = ARENA_SKILLSTXT + 3u * 0x23Cu;
        U32(ARENA_SKILL0 + 0x00) = stxt;
        S16(stxt + 0x18u) = 0x1E;
        U8(stxt + 0x14u) = (c == 1) ? 1u : 2u;                      /* c == 1: not a throwing skill */
        U32(ARENA_STATLIST0 + 0x10) = 0x80000000u;
        U32(ARENA_STATLIST0 + 0x44) = ARENA_UNIT0;
        U32(ARENA_STATLIST0 + 0x48) = ARENA_STATS1;
        U16(ARENA_STATLIST0 + 0x4C) = 1u;
        U16(ARENA_STATLIST0 + 0x4E) = 8u;
        U32(ARENA_STATS1 + 0) = (0x15Bu << 16) | 0x1Eu;
        S32(ARENA_STATS1 + 4) = (c == 2) ? 37 : 100;
        U32(ARENA_ITEM0 + 0x00) = 4u;
        U32(ARENA_ITEM0 + 0x04) = 0u;
        U32(ARENA_ITEM0 + 0x08) = 1u; /* dwMode = 1 so +4 != +8 */
        U32(ARENA_ITEM0 + 0x14) = ARENA_ITEMDATA0;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDEFB94u, 8}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC10u},
            {ARENA_UNIT0, 0x100u}, {ARENA_STATLIST0, 0x80u}, {ARENA_STATS1, 0x20u},
            {ARENA_SKILLINFO, 0x20u}, {ARENA_SKILL0, 0x20u}, {stxt, 0x23Cu},
            {ARENA_ITEM0, 0x40u}, {ARENA_ITEMDATA0, 0x40u}, {ARENA_ITEMSTXT, 0x1A8u},
            {ARENA_ITYPEMAT, 0x200u}, {ARENA_ITYPESTXT + 0x1Eu * 0xE4u, 0xE4u},
            {ARENA_ISC + 0x151u * 0x144u, 0x144u}, {ARENA_ISC + 0x8Du * 0x144u, 0x144u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 17);
        eax = safe_6FDBB180(ARENA_UNIT0, ARENA_ITEM0, &asserted);
        snprintf(args, sizeof(args), "\"0x%08X\",\"0x%08X\"", ARENA_UNIT0, ARENA_ITEM0);
        emit_vector_or_assert(fp, "0x6FDBB180", "MISSILE_RollCriticalStrike113c", 4 + c,
            c == 0 ? "throwing_mastery_crit_100" : (c == 1 ? "non_throwing_skill_no_melee_mastery" : (c == 2 ? "r3_eq_mastery_crit_37_misses" : "item_type_eq_count_no_throwing_mastery")),
            args, regs, 17, g_pre_buf, asserted, eax, 0xFFFFFFFFu);
    }

    /* 0x6FD8A5D0 -> 0x6FD8A3B0: a merged (0x40000000) sub-list does not remove damage-related stats from its parent */
    for (int c = 0; c < 2; c++) {
        setup_common_tables();
        uint32_t statId = 21u; /* ISC +0x04 bit 0x04 = damage related (gdwBitMasks[2]) */
        U8(ARENA_ISC + statId * 0x144u + 0x04u) = 0x04u;
        U32(ARENA_UNIT0 + 0x00) = 1u;
        U32(ARENA_UNIT0 + 0x5C) = ARENA_SUBLIST;
        U32(ARENA_SUBLIST + 0x10) = (c == 0) ? 0x40000000u : 0u;
        U32(ARENA_SUBLIST + 0x24) = ARENA_SUBSTATS;
        U16(ARENA_SUBLIST + 0x28) = 1u;
        U16(ARENA_SUBLIST + 0x2A) = 4u;
        U32(ARENA_SUBLIST + 0x34) = ARENA_PARENTLIST;
        U32(ARENA_SUBSTATS + 0) = statId << 16;
        S32(ARENA_SUBSTATS + 4) = 5;
        U32(ARENA_PARENTLIST + 0x10) = 0x80000000u;
        U32(ARENA_PARENTLIST + 0x3C) = ARENA_SUBLIST;
        U32(ARENA_PARENTLIST + 0x48) = ARENA_PARSTATS;
        U16(ARENA_PARENTLIST + 0x4C) = 1u;
        U16(ARENA_PARENTLIST + 0x4E) = 8u;
        U32(ARENA_PARSTATS + 0) = statId << 16;
        S32(ARENA_PARSTATS + 4) = 7;
        mem_region_t regs[] = {
            {0x6FDE9E1Cu, 4}, {0x6FDD9088u, 0xACu}, {ARENA_SGPT, 0xC00u},
            {ARENA_ISC + statId * 0x144u, 0x144u}, {ARENA_UNIT0, 0x80u},
            {ARENA_SUBLIST, 0x80u}, {ARENA_PARENTLIST, 0x80u}, {ARENA_SUBSTATS, 0x20u},
            {ARENA_PARSTATS, 0x40u}
        };
        capture_pre_json(g_pre_buf, sizeof(g_pre_buf), regs, 9);
        eax = safe_stdcall2(0x6FD8A5D0u, 0u, ARENA_UNIT0, &asserted);
        snprintf(args, sizeof(args), "0,\"0x%08X\"", ARENA_UNIT0);
        emit_vector_or_assert(fp, "0x6FD8A5D0", "STATLIST_UnlinkUnitStatList113c", 2 + c,
            c == 0 ? "merged_sublist_keeps_damage_stat" : "unmerged_sublist_removes_damage_stat",
            args, regs, 9, g_pre_buf, asserted, 0u, 0u);
    }
}

int main(int argc, char **argv) {
    g_arena = (uint8_t *)VirtualAlloc((LPVOID)ARENA_BASE, ARENA_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
    if (!g_arena || (uintptr_t)g_arena != ARENA_BASE) {
        fprintf(stderr, "Failed to allocate arena at 0x%08X\n", ARENA_BASE);
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
    /* Make the IAT page writable for the Fog.#10265 assert hook used by the safe_* helpers. */
    {
        DWORD iatProt = 0;
        if (!VirtualProtect((LPVOID)0x6FDD9000u, 0x1000u, PAGE_READWRITE, &iatProt)) {
            fprintf(stderr, "VirtualProtect(IAT) failed\n");
            return 1;
        }
    }

    const char *b043_path = (argc > 1) ? argv[1] : "b043-vectors.ndjson";
    const char *b045_path = (argc > 2) ? argv[2] : "b045-vectors.ndjson";

    FILE *fp43 = fopen(b043_path, "wb");
    if (!fp43) return 1;
    emit_b043_part1(fp43);
    emit_b043_part2(fp43);
    emit_b043_part3(fp43);
    emit_b043_part4(fp43);
    emit_b043_part5(fp43);
    fclose(fp43);

    FILE *fp45 = fopen(b045_path, "wb");
    if (!fp45) return 1;
    emit_b045_part1(fp45);
    emit_b045_part2(fp45);
    emit_b045_part3(fp45);
    emit_b045_part4(fp45);
    fclose(fp45);

    TerminateProcess(GetCurrentProcess(), 0);
    return 0;
}

