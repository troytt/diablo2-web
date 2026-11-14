/*
 * K1r11 Iteration 13 Lane B real-DLL differential oracle emitter (`D2Common.dll` v1.13c).
 *
 * Emits 9 D2Common functions split into two sub-batches:
 *   I13B-1 (5 Layer-1 VAs):
 *     0x6FD71EE0 ITEMS_AutoPlaceIntoBelt
 *     0x6FD751C0 ITEMS_GetItemColorColormap
 *     0x6FD77180 ITEMS_SerializeItemBitstream
 *     0x6FD78E80 ITEMS_ComputeTransactionCost
 *     0x6FD91A20 DRLGOUTANIM_PlaceLevelPresets
 *   I13B-2 (4 Layer-2..3 VAs):
 *     0x6FD78D70 ITEMS_WriteItemStreamAndSockets
 *     0x6FD79D60 ITEMS_GetTransactionCost
 *     0x6FD7A210 ITEMS_GetRepairAllCost
 *     0x6FD79D00 ITEMS_SerializeItemToBuffer
 *
 * Usage: k1r11-laneB-it13-emitter.exe <out_i13b1.ndjson> <out_i13b2.ndjson>
 */

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <windows.h>

#define D2COMMON_BASE       0x6FD50000u
#define D2CMP_BASE_NORM     0x6FE10000u
#define FOG_BASE            0x6FF50000u

/* D2Common.dll globals */
#define VA_GDWBITMASKS_PTR  0x6FDD90B0u
#define VA_SGPT_DATATABLES  0x6FDE9E1Cu
#define VA_BODY_GRID_DEF    0x6FDED378u
#define VA_ITEMS_TXT_COUNT  0x6FDEFB94u
#define VA_ITEMS_TXT_PTR    0x6FDEFB98u
#define VA_MAGIC_COUNT      0x6FDEFBB8u
#define VA_MAGIC_PTR        0x6FDEFBBCu
#define VA_MAGIC_PREFIX     0x6FDEFBC4u
#define VA_MAGIC_AUTO       0x6FDEFBC8u
#define VA_GEMS_TXT_COUNT   0x6FDEFBCCu
#define VA_GEMS_TXT_PTR     0x6FDEFBD0u
#define VA_RUNES_TXT_COUNT  0x6FDEFBD4u
#define VA_RUNES_TXT_PTR    0x6FDEFBD8u
#define VA_QUAL_TXT_COUNT   0x6FDEFDA0u
#define VA_QUAL_TXT_PTR     0x6FDEFDA4u
#define VA_NPC_TXT_PTR      0x6FDF0880u
#define VA_NPC_TXT_COUNT    0x6FDF0884u
#define VA_LVLPREST_TXT_PTR 0x6FDF0B3Cu
#define VA_ITEMS_LINKER_PTR 0x6FDEFF6Cu

/* RWX fixed arena at 0x20000000 (1 MB) */
#define ARENA_BASE          0x20000000u
#define ARENA_SIZE          0x00100000u

#define ADDR_BITMASKS       0x20000000u /* 0x100 B */
#define ADDR_OUTDW          0x20000100u /* 0x100 B: [0]=cbCnt, [4..]=cbLog, [0x80]=outColor */
#define ADDR_BITBUF         0x20000200u /* 0x100 B */
#define ADDR_BITDATA        0x20000300u /* 0x200 B */
#define ADDR_QUESTREC       0x20000500u /* 0x100 B: +0x00 = &ADDR_QUESTBITS, +0x10 = bits */
#define ADDR_QUESTBITS      0x20000510u
#define ADDR_UNIT           0x20000600u /* 0x200 B D2UnitStrc */
#define ADDR_PLRDATA        0x20000800u /* 0x200 B D2PlayerDataStrc */
#define ADDR_PLR_SLISTEX    0x20000A00u /* 0x80 B */
#define ADDR_PLR_SLIST      0x20000A80u /* 0x40 B */
#define ADDR_PLR_STATS      0x20000AC0u /* 0x40 B */
#define ADDR_INV            0x20000B00u /* 0x40 B D2InventoryStrc */
#define ADDR_GRIDS          0x20000B80u /* 0x80 B D2InventoryGridStrc[4] */
#define ADDR_GRID_PPITEMS   0x20000C00u /* 0x80 B ppItems[16] */
#define ADDR_DATATABLES     0x20001000u /* 0x1000 B sgptDataTables */
#define ADDR_ITEMS_TXT      0x20002000u /* 16 * 0x1A8 = 0x1A80 */
#define ADDR_ITEMS_LINK     0x20004000u /* 0x200 B */
#define ADDR_ITEMTYPES_TXT  0x20005000u /* 16 * 0xE4 = 0xE40 */
#define ADDR_ITEMTYPES_EQ   0x20006000u /* 0x200 B */
#define ADDR_MAGICAFFIX_TXT 0x20007000u /* 32 * 0x90 = 0x1200 */
#define ADDR_UNIQUE_TXT     0x20009000u /* 8 * 0x14C */
#define ADDR_SETITEMS_TXT   0x2000A000u /* 4 * 0x1B8 */
#define ADDR_SETS_TXT       0x2000B000u /* 4 * 0x128 */
#define ADDR_GEMS_TXT       0x2000C000u /* 8 * 0xC0 */
#define ADDR_RUNES_TXT      0x2000D000u /* 4 * 0x120 */
#define ADDR_QUAL_TXT       0x2000E000u /* 4 * 0x30 */
#define ADDR_SKILLS_TXT     0x2000F000u /* 8 * 0x23C */
#define ADDR_NPC_TXT        0x20010800u /* 4 * 0x4C */
#define ADDR_MONSTATS_TXT   0x20011000u /* 4 * 0x1A8 */

#define ADDR_ITEM0          0x20012000u /* 0x400 B */
#define ADDR_ITEM1          0x20012400u /* 0x400 B */
#define ADDR_ITEM2          0x20012800u /* 0x400 B */
#define ADDR_ITEM3          0x20012C00u /* 0x400 B */
#define ADDR_SOCKET_GEM0    0x20013000u /* 0x400 B */
#define ADDR_SOCKET_GEM1    0x20013400u /* 0x400 B */

#define ADDR_LVL            0x20014000u /* 0x240 B D2DrlgLevelStrc */
#define ADDR_DRLG           0x20014300u /* 0x500 B */
#define ADDR_OUTDOORS       0x20014800u /* 0x280 B D2DrlgOutdoorInfoStrc */
#define ADDR_GRID0_CELLS    0x20014B00u /* 0x200 B (6x6 dwords = 144 B) */
#define ADDR_GRID0_ROWS     0x20014D00u /* 0x40 B */
#define ADDR_GRID1_CELLS    0x20014E00u /* 0x200 B */
#define ADDR_GRID1_ROWS     0x20015000u /* 0x40 B */
#define ADDR_GRID2_CELLS    0x20015100u /* 0x200 B */
#define ADDR_GRID2_ROWS     0x20015300u /* 0x40 B */
#define ADDR_PRESET_NODES   0x20015400u /* 0x400 B: up to 32 nodes * 0x10 */

#define ADDR_ISC_TXT        0x20020000u /* 256 * 0x144 = 0x14400 B */
#define ADDR_LVLPREST_TXT   0x20080000u /* 960 * 0x1B0 = 0x65400 B */
#define ADDR_REPAIR_CB_STUB 0x200FF000u /* 64 B executable callback stub */

static uint32_t g_d2cmp_base = D2CMP_BASE_NORM;
static uint32_t g_real_bitmasks[64];

static inline void w8(uint32_t a, uint8_t v) { *(volatile uint8_t *)(uintptr_t)a = v; }
static inline void w16(uint32_t a, uint16_t v) { *(volatile uint16_t *)(uintptr_t)a = v; }
static inline void w32(uint32_t a, uint32_t v) { *(volatile uint32_t *)(uintptr_t)a = v; }
static inline uint32_t r32(uint32_t a) { return *(volatile uint32_t *)(uintptr_t)a; }

/* Snapshot recorder */
#define MAX_SNAP_RANGES 64
#define SNAP_BUF_CAP (512 * 1024)
typedef struct {
  uint32_t addr;
  uint32_t len;
  uint32_t pre_off;
  uint32_t post_off;
} SnapRange;

typedef struct {
  uint32_t n;
  uint32_t used;
  SnapRange r[MAX_SNAP_RANGES];
  uint8_t buf[SNAP_BUF_CAP];
} Snap;

static Snap g_snap;

static void snap_reset(Snap *s) {
  s->n = 0;
  s->used = 0;
}

static void snap_add(Snap *s, uint32_t addr, uint32_t len) {
  if (len == 0u || s->n >= MAX_SNAP_RANGES) return;
  for (uint32_t i = 0; i < s->n; i++) {
    if (s->r[i].addr == addr && s->r[i].len == len) return;
  }
  if (s->used + len * 2u > SNAP_BUF_CAP) {
    fprintf(stderr, "FATAL: snap_buf overflow (%u + %u)\n", s->used, len * 2u);
    exit(2);
  }
  SnapRange *rg = &s->r[s->n++];
  rg->addr = addr;
  rg->len = len;
  rg->pre_off = s->used;
  memcpy(&s->buf[s->used], (const void *)(uintptr_t)addr, len);
  s->used += len;
  rg->post_off = s->used;
  s->used += len;
}

static void snap_capture_post(Snap *s) {
  for (uint32_t i = 0; i < s->n; i++) {
    memcpy(&s->buf[s->r[i].post_off], (const void *)(uintptr_t)s->r[i].addr, s->r[i].len);
  }
}

static void emit_hex_array(FILE *fp, const Snap *s, int is_post) {
  fputc('[', fp);
  for (uint32_t i = 0; i < s->n; i++) {
    if (i > 0) fputc(',', fp);
    uint32_t off = is_post ? s->r[i].post_off : s->r[i].pre_off;
    uint32_t len = s->r[i].len;
    fprintf(fp, "{\"addr\":%u,\"hex\":\"", s->r[i].addr);
    for (uint32_t j = 0; j < len; j++) {
      fprintf(fp, "%02x", s->buf[off + j]);
    }
    fputs("\"}", fp);
  }
  fputc(']', fp);
}

static void emit_line(
  FILE *fp,
  uint32_t va,
  const char *name,
  const char *case_id,
  const uint32_t *args,
  uint32_t nargs,
  uint32_t ret_mask,
  uint32_t eax_val,
  const Snap *s
) {
  fprintf(fp, "{\"va\":\"0x%08X\",\"name\":\"%s\",\"caseId\":\"%s\",\"args\":[", va, name, case_id);
  for (uint32_t i = 0; i < nargs; i++) {
    if (i > 0) fputc(',', fp);
    fprintf(fp, "%u", args[i]);
  }
  fprintf(fp, "],\"retMask\":%u,\"eax\":%u,\"pre\":", ret_mask, eax_val);
  emit_hex_array(fp, s, 0);
  fputs(",\"post\":", fp);
  emit_hex_array(fp, s, 1);
  fputs("}\n", fp);
}

static inline uint32_t norm_d2cmp_ptr(uint32_t p) {
  if (p >= g_d2cmp_base && p < g_d2cmp_base + 0x00200000u) {
    return (p - g_d2cmp_base) + D2CMP_BASE_NORM;
  }
  return p;
}

static uint32_t call_stdcall3(uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2) {
  typedef uint32_t(__stdcall * fn_t)(uint32_t, uint32_t, uint32_t);
  return ((fn_t)(uintptr_t)va)(a0, a1, a2);
}

static uint32_t call_stdcall4(uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3) {
  typedef uint32_t(__stdcall * fn_t)(uint32_t, uint32_t, uint32_t, uint32_t);
  return ((fn_t)(uintptr_t)va)(a0, a1, a2, a3);
}

static void call_stdcall4_void(uint32_t va, uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3) {
  typedef void(__stdcall * fn_t)(uint32_t, uint32_t, uint32_t, uint32_t);
  ((fn_t)(uintptr_t)va)(a0, a1, a2, a3);
}

static uint32_t call_stdcall6(
  uint32_t va,
  uint32_t a0,
  uint32_t a1,
  uint32_t a2,
  uint32_t a3,
  uint32_t a4,
  uint32_t a5
) {
  typedef uint32_t(__stdcall * fn_t)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
  return ((fn_t)(uintptr_t)va)(a0, a1, a2, a3, a4, a5);
}

/* 0x6FD78E80: eax=pPlayer, stack=[pItem, nDiff, pQuest, nNpc, nTxType], ret 0x14 */
__attribute__((noinline)) static uint32_t call_0x6FD78E80(
  uint32_t pPlayer,
  uint32_t pItem,
  uint32_t nDiff,
  uint32_t pQuest,
  uint32_t nNpc,
  uint32_t nTxType
) {
  uint32_t argv[5] = { pItem, nDiff, pQuest, nNpc, nTxType };
  uint32_t eax_io = pPlayer;
  uint32_t ecx_io = (uint32_t)(uintptr_t)argv;
  uint32_t edx_io = 0x6FD78E80u;
  __asm__ volatile(
    "pushl 16(%1)\n\t"
    "pushl 12(%1)\n\t"
    "pushl 8(%1)\n\t"
    "pushl 4(%1)\n\t"
    "pushl (%1)\n\t"
    "call *%2"
    : "+a"(eax_io), "+c"(ecx_io), "+d"(edx_io)
    :
    : "memory", "cc");
  return eax_io;
}

/* 0x6FD78D70: ecx=pItem, edx=pBitStream, stack=[bHdr, bSock, bSimple], ret 0xC */
__attribute__((noinline)) static uint32_t call_0x6FD78D70(
  uint32_t pItem,
  uint32_t pBitStream,
  uint32_t bHdr,
  uint32_t bSock,
  uint32_t bSimple
) {
  uint32_t argv[4] = { bHdr, bSock, bSimple, 0x6FD78D70u };
  uint32_t eax_io = (uint32_t)(uintptr_t)argv;
  uint32_t ecx_io = pItem;
  uint32_t edx_io = pBitStream;
  __asm__ volatile(
    "pushl 8(%0)\n\t"
    "pushl 4(%0)\n\t"
    "pushl (%0)\n\t"
    "call *12(%0)"
    : "+a"(eax_io), "+c"(ecx_io), "+d"(edx_io)
    :
    : "memory", "cc");
  return eax_io;
}

/* 0x6FD91A20: eax=pLevel -> void, plain ret */
__attribute__((noinline)) static void call_0x6FD91A20(uint32_t pLevel) {
  uint32_t eax_io = pLevel;
  uint32_t edx_io = 0x6FD91A20u;
  __asm__ volatile(
    "call *%1"
    : "+a"(eax_io), "+d"(edx_io)
    :
    : "ecx", "memory", "cc");
}

/*
 * Machine-code callback stub installed at fixed ADDR_REPAIR_CB_STUB (0x200FF000).
 * Signature: custom(ecx=pContext, edx=pItem, [esp+4]=pUnit) -> void, ret 4.
 * Increments [ADDR_OUTDW], logs {pContext, pItem, pUnit} at ADDR_OUTDW + 4 + idx*12.
 * Note: x86 little-endian encodings avoid address randomization drift between -O2/-O2fp.
 */
static void install_repair_cb_stub(void) {
  uint8_t *p = (uint8_t *)(uintptr_t)ADDR_REPAIR_CB_STUB;
  uint32_t i = 0;
  /* push ebx */
  p[i++] = 0x53;
  /* mov eax, [ADDR_OUTDW] -> A1 <addr> */
  p[i++] = 0xA1; *(uint32_t *)(p + i) = ADDR_OUTDW; i += 4;
  /* inc dword ptr [ADDR_OUTDW] -> FF 05 <addr> */
  p[i++] = 0xFF; p[i++] = 0x05; *(uint32_t *)(p + i) = ADDR_OUTDW; i += 4;
  /* imul eax, eax, 12 -> 6B C0 0C */
  p[i++] = 0x6B; p[i++] = 0xC0; p[i++] = 0x0C;
  /* mov [eax + ADDR_OUTDW + 4], ecx -> 89 88 <addr+4> */
  p[i++] = 0x89; p[i++] = 0x88; *(uint32_t *)(p + i) = ADDR_OUTDW + 4u; i += 4;
  /* mov [eax + ADDR_OUTDW + 8], edx -> 89 90 <addr+8> */
  p[i++] = 0x89; p[i++] = 0x90; *(uint32_t *)(p + i) = ADDR_OUTDW + 8u; i += 4;
  /* mov ebx, [esp + 8] (since we pushed ebx: retip at esp+4, arg at esp+8) -> 8B 5C 24 08 */
  p[i++] = 0x8B; p[i++] = 0x5C; p[i++] = 0x24; p[i++] = 0x08;
  /* mov [eax + ADDR_OUTDW + 12], ebx -> 89 98 <addr+12> */
  p[i++] = 0x89; p[i++] = 0x98; *(uint32_t *)(p + i) = ADDR_OUTDW + 12u; i += 4;
  /* pop ebx */
  p[i++] = 0x5B;
  /* ret 4 -> C2 04 00 */
  p[i++] = 0xC2; p[i++] = 0x04; p[i++] = 0x00;
  FlushInstructionCache(GetCurrentProcess(), (const void *)(uintptr_t)ADDR_REPAIR_CB_STUB, i);
}

static void init_isc_row(uint32_t stat_id, uint8_t flags, uint8_t shift, uint8_t save_bits, int32_t save_add, uint32_t save_param_bits, int32_t min_accr) {
  uint32_t rec = ADDR_ISC_TXT + stat_id * 0x144u;
  memset((void *)(uintptr_t)rec, 0, 0x144u);
  w16(rec + 0x00u, (uint16_t)stat_id);
  w8(rec + 0x05u, flags);
  w8(rec + 0x18u, shift);
  w8(rec + 0x19u, save_bits);
  w32(rec + 0x1Cu, (uint32_t)save_add);
  w32(rec + 0x24u, save_param_bits);
  w32(rec + 0x2Cu, (uint32_t)min_accr);
  w16(rec + 0x58u, 0xFFFFu);
  w16(rec + 0x5Au, 0xFFFFu);
  w16(rec + 0x5Cu, 0xFFFFu);
  for (uint32_t j = 0u; j < 64u; j++) {
    w16(rec + 0x5Eu + j * 2u, 0xFFFFu);
  }
  for (uint32_t j = 0u; j < 16u; j++) {
    w16(rec + 0xDEu + j * 6u, 0xFFFFu);
  }
}

static void set_item_type_equiv_bit(uint32_t item_type, uint32_t equiv_id) {
  w32(ADDR_ITEMTYPES_EQ + (item_type * 2u + (equiv_id >> 5)) * 4u,
      r32(ADDR_ITEMTYPES_EQ + (item_type * 2u + (equiv_id >> 5)) * 4u) | (1u << (equiv_id & 31u)));
}

static void init_plr_unit(uint32_t u, uint32_t inv) {
  memset((void *)(uintptr_t)u, 0, 0x200u);
  memset((void *)(uintptr_t)ADDR_PLRDATA, 0, 0x200u);
  memset((void *)(uintptr_t)ADDR_PLR_SLISTEX, 0, 0x100u);
  w32(u + 0x00u, 0u); /* UNIT_PLAYER */
  w32(u + 0x04u, 0u); /* Amazon */
  w32(u + 0x0Cu, 1001u);
  w32(u + 0x14u, ADDR_PLRDATA);
  w32(u + 0x20u, 0x12345678u);
  w32(u + 0x24u, 0x00000001u);
  w32(u + 0x5Cu, ADDR_PLR_SLISTEX);
  w32(u + 0x60u, inv);

  uint32_t sl_ex = ADDR_PLR_SLISTEX;
  uint32_t sl = ADDR_PLR_SLIST;
  w32(sl_ex + 0x04u, u);
  w32(sl_ex + 0x08u, 0u);
  w32(sl_ex + 0x10u, 0x80000000u);
  w32(sl_ex + 0x24u, ADDR_PLR_STATS + 0x20u);
  w32(sl_ex + 0x3Cu, sl);
  w32(sl_ex + 0x40u, sl);
  w32(sl_ex + 0x44u, u);
  w32(sl_ex + 0x48u, ADDR_PLR_STATS);
  w16(sl_ex + 0x2Au, 8u);
  w16(sl_ex + 0x4Eu, 8u);

  w32(sl + 0x04u, u);
  w32(sl + 0x08u, 0u);
  w32(sl + 0x24u, ADDR_PLR_STATS + 0x20u);
  w16(sl + 0x2Au, 8u);
}

static void init_item_k(uint32_t base, uint32_t class_id, uint32_t uid, uint32_t qual, uint16_t fmt, uint8_t ilvl) {
  memset((void *)(uintptr_t)base, 0, 0x400u);
  uint32_t it = base;
  uint32_t data = base + 0x100u;
  uint32_t sl_ex = base + 0x180u;
  uint32_t sl = base + 0x200u;
  uint32_t full_st = base + 0x280u;
  uint32_t base_st = base + 0x2C0u;
  uint32_t spath = base + 0x380u;

  w32(it + 0x00u, 4u); /* UNIT_ITEM */
  w32(it + 0x04u, class_id);
  w32(it + 0x0Cu, uid);
  w32(it + 0x14u, data);
  w32(it + 0x20u, 0x55AA1234u);
  w32(it + 0x24u, 0x00000001u);
  w32(it + 0x28u, 0x13579BDFu); /* dwStreamSeed (+0x28) */
  w32(it + 0x2Cu, spath);
  w32(it + 0x5Cu, sl_ex);

  w16(spath + 0x02u, 3u);
  w16(spath + 0x06u, 2u);
  w32(spath + 0x0Cu, 3u);
  w32(spath + 0x10u, 2u);

  w32(data + 0x00u, qual);
  w32(data + 0x04u, 0x11223344u);
  w32(data + 0x08u, 0x00000001u);
  w32(data + 0x0Cu, 0x99887766u);
  w32(data + 0x28u, 0xFFFFFFFFu); /* dwItemCell */
  w32(data + 0x2Cu, ilvl);
  w16(data + 0x30u, fmt);

  w32(sl_ex + 0x04u, it);
  w32(sl_ex + 0x08u, 4u);
  w32(sl_ex + 0x10u, 0x80000000u);
  w32(sl_ex + 0x24u, base_st);
  w16(sl_ex + 0x2Au, 8u);
  w32(sl_ex + 0x3Cu, sl);
  w32(sl_ex + 0x40u, sl);
  w32(sl_ex + 0x44u, it);
  w32(sl_ex + 0x48u, full_st);
  w16(sl_ex + 0x4Eu, 8u);

  w32(sl + 0x04u, it);
  w32(sl + 0x08u, 4u);
  w32(sl + 0x24u, base_st);
  w16(sl + 0x2Au, 8u);
}

static void add_item_stat(uint32_t base, uint16_t stat_id, uint16_t layer, int32_t val, int add_sub) {
  uint32_t sl_ex = base + 0x180u;
  uint32_t sl = base + 0x200u;
  uint32_t full_st = base + 0x280u;
  uint32_t base_st = base + 0x2C0u;
  uint32_t cnt = r32(sl_ex + 0x4Cu) & 0xFFFFu;
  uint32_t key = ((uint32_t)stat_id << 16) | layer;
  w32(full_st + cnt * 8u, key);
  w32(full_st + cnt * 8u + 4u, (uint32_t)val);
  w16(sl_ex + 0x4Cu, (uint16_t)(cnt + 1u));
  w32(base_st + cnt * 8u, key);
  w32(base_st + cnt * 8u + 4u, (uint32_t)val);
  w16(sl_ex + 0x28u, (uint16_t)(cnt + 1u));
  w16(sl + 0x28u, (uint16_t)(cnt + 1u));
  if (add_sub) {
    uint32_t sub = base + 0x240u;
    uint32_t sub_st = base + 0x300u;
    uint32_t scnt = r32(sub + 0x28u) & 0xFFFFu;
    w32(sub + 0x10u, 0x40u);
    w32(sub + 0x24u, sub_st);
    w16(sub + 0x2Au, 8u);
    w32(sl + 0x2Cu, sub);
    w32(sub_st + scnt * 8u, key);
    w32(sub_st + scnt * 8u + 4u, (uint32_t)val);
    w16(sub + 0x28u, (uint16_t)(scnt + 1u));
  }
}

static void setup_base_tables(void) {
  memset((void *)(uintptr_t)ARENA_BASE, 0, 0x00018000u);
  memset((void *)(uintptr_t)ADDR_ISC_TXT, 0, 256u * 0x144u);
  memcpy((void *)(uintptr_t)ADDR_BITMASKS, g_real_bitmasks, 256u);

  w32(VA_GDWBITMASKS_PTR, ADDR_BITMASKS);
  w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);
  w32(VA_ITEMS_LINKER_PTR, ADDR_ITEMS_LINK);
  w32(ADDR_ITEMS_LINK + 0x00u, 7u);
  w32(ADDR_ITEMS_LINK + 0x08u, ADDR_ITEMS_LINK + 0x40u);
  /* Sorted ascending by uint32_t dwCode */
  w32(ADDR_ITEMS_LINK + 0x40u, 0x20317068u); w32(ADDR_ITEMS_LINK + 0x44u, 2u); /* 'hp1 ' */
  w32(ADDR_ITEMS_LINK + 0x48u, 0x20647773u); w32(ADDR_ITEMS_LINK + 0x4Cu, 0u); /* 'swd ' */
  w32(ADDR_ITEMS_LINK + 0x50u, 0x206D7261u); w32(ADDR_ITEMS_LINK + 0x54u, 1u); /* 'arm ' */
  w32(ADDR_ITEMS_LINK + 0x58u, 0x20726165u); w32(ADDR_ITEMS_LINK + 0x5Cu, 6u); /* 'ear ' */
  w32(ADDR_ITEMS_LINK + 0x60u, 0x20767161u); w32(ADDR_ITEMS_LINK + 0x64u, 5u); /* 'aqv ' */
  w32(ADDR_ITEMS_LINK + 0x68u, 0x20776F62u); w32(ADDR_ITEMS_LINK + 0x6Cu, 4u); /* 'bow ' */
  w32(ADDR_ITEMS_LINK + 0x70u, 0x316D6567u); w32(ADDR_ITEMS_LINK + 0x74u, 3u); /* 'gem1' */
  w32(VA_ITEMS_TXT_COUNT, 10u);
  w32(VA_ITEMS_TXT_PTR, ADDR_ITEMS_TXT);
  w32(VA_MAGIC_COUNT, 16u);
  w32(VA_MAGIC_PTR, ADDR_MAGICAFFIX_TXT);
  w32(VA_MAGIC_PREFIX, ADDR_MAGICAFFIX_TXT + 8u * 0x90u);
  w32(VA_MAGIC_AUTO, ADDR_MAGICAFFIX_TXT + 12u * 0x90u);
  w32(VA_GEMS_TXT_COUNT, 4u);
  w32(VA_GEMS_TXT_PTR, ADDR_GEMS_TXT);
  w32(VA_RUNES_TXT_COUNT, 2u);
  w32(VA_RUNES_TXT_PTR, ADDR_RUNES_TXT);
  w32(VA_QUAL_TXT_COUNT, 2u);
  w32(VA_QUAL_TXT_PTR, ADDR_QUAL_TXT);
  w32(VA_NPC_TXT_COUNT, 2u);
  w32(VA_NPC_TXT_PTR, ADDR_NPC_TXT);
  w32(VA_LVLPREST_TXT_PTR, ADDR_LVLPREST_TXT);

  /* Preserve real D2Common grid0/grid1 definitions at 0x6FDED378..0x6FDED39F */

  /* sgptDataTables */
  w32(ADDR_DATATABLES + 0xA78u, ADDR_MONSTATS_TXT);
  w32(ADDR_DATATABLES + 0xA80u, 2u);
  w32(ADDR_DATATABLES + 0xB98u, ADDR_SKILLS_TXT);
  w32(ADDR_DATATABLES + 0xBA0u, 8u);
  w32(ADDR_DATATABLES + 0xBCCu, ADDR_ISC_TXT);
  w32(ADDR_DATATABLES + 0xBD4u, 256u);
  w32(ADDR_DATATABLES + 0xBF8u, ADDR_ITEMTYPES_TXT);
  w32(ADDR_DATATABLES + 0xBFCu, 16u);
  w32(ADDR_DATATABLES + 0xC00u, 2u);
  w32(ADDR_DATATABLES + 0xC04u, ADDR_ITEMTYPES_EQ);
  w32(ADDR_DATATABLES + 0xC0Cu, ADDR_SETS_TXT);
  w32(ADDR_DATATABLES + 0xC10u, 4u);
  w32(ADDR_DATATABLES + 0xC18u, ADDR_SETITEMS_TXT);
  w32(ADDR_DATATABLES + 0xC1Cu, 4u);
  w32(ADDR_DATATABLES + 0xC24u, ADDR_UNIQUE_TXT);
  w32(ADDR_DATATABLES + 0xC28u, 4u);
  w32(ADDR_DATATABLES + 0xC68u, 960u); /* nLvlPrestTxtRecordCount */
  w32(ADDR_DATATABLES + 0xC6Cu, 0u);
  w32(ADDR_DATATABLES + 0xC70u, 0xFFFFu);

  /* Init key ISC rows */
  for (uint32_t s = 0u; s < 256u; s++) {
    init_isc_row(s, 0x00u, 0u, 8u, 0, 0u, 0);
  }
  init_isc_row(0x10u, 0x00u, 0u, 9u, 20, 0u, 0);  /* armor_percent */
  init_isc_row(0x11u, 0x00u, 0u, 9u, 0, 0u, 0);   /* maxdamage_percent */
  init_isc_row(0x12u, 0x00u, 0u, 9u, 0, 0u, 0);   /* mindamage_percent */
  init_isc_row(0x15u, 0x00u, 0u, 6u, 0, 0u, 0);
  init_isc_row(0x16u, 0x00u, 0u, 7u, 0, 0u, 0);
  init_isc_row(0x1Fu, 0x00u, 0u, 11u, 10, 0u, 0); /* defense (add 10) */
  init_isc_row(0x46u, 0x00u, 0u, 9u, 0, 0u, 0);   /* quantity */
  init_isc_row(0x48u, 0x00u, 0u, 8u, 0, 0u, 0);   /* durability */
  init_isc_row(0x49u, 0x00u, 0u, 8u, 0, 0u, 0);   /* maxdurability */
  init_isc_row(0x5Cu, 0x00u, 0u, 7u, 0, 0u, 0);   /* item_levelreq */
  init_isc_row(0xC2u, 0x00u, 0u, 3u, 0, 0u, 0);   /* item_numsockets */
  init_isc_row(0xCCu, 0x00u, 0u, 8u, 0, 16u, 0);  /* charged_skill */
  init_isc_row(0xFCu, 0x00u, 0u, 5u, 0, 0u, 0);   /* item_replenish_durability */

  /* ItemTypes:
   * Type 1: Sword/Weapon (equiv 0x2D, maxSock=4, nMagic=1, nRare=1, nNormal=0)
   * Type 2: Armor (equiv 0x32, maxSock=3, nTransform=1, nBody=1, nBodyLoc1=3)
   * Type 3: Potion/Beltable (nBeltable=1, nNormalAllowed=1, equiv 0x09)
   * Type 4: Gem (equiv 0x14, nNormalAllowed=1)
   * Type 5: Bow/Missile (equiv 0x2D, wShoots=6)
   * Type 6: Quiver (wQuiver=5)
   */
  w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x08u, 1u); /* repair */
  w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x14u, 1u); /* magic */
  w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x15u, 1u); /* rare */
  w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x1Au, 4u);
  w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x1Bu, 4u);
  w8(ADDR_ITEMTYPES_TXT + 1u * 0xE4u + 0x1Cu, 4u);
  set_item_type_equiv_bit(1u, 0x2Du);

  w8(ADDR_ITEMTYPES_TXT + 2u * 0xE4u + 0x08u, 1u); /* repair */
  w8(ADDR_ITEMTYPES_TXT + 2u * 0xE4u + 0x09u, 1u);
  w8(ADDR_ITEMTYPES_TXT + 2u * 0xE4u + 0x0Au, 3u);
  w8(ADDR_ITEMTYPES_TXT + 2u * 0xE4u + 0x1Au, 3u);
  w8(ADDR_ITEMTYPES_TXT + 2u * 0xE4u + 0x1Bu, 3u);
  w8(ADDR_ITEMTYPES_TXT + 2u * 0xE4u + 0x1Cu, 3u);
  set_item_type_equiv_bit(2u, 0x32u);

  w8(ADDR_ITEMTYPES_TXT + 3u * 0xE4u + 0x16u, 1u);
  w8(ADDR_ITEMTYPES_TXT + 3u * 0xE4u + 0x19u, 1u); /* nBeltable = 1 */
  set_item_type_equiv_bit(3u, 0x09u);

  w8(ADDR_ITEMTYPES_TXT + 4u * 0xE4u + 0x16u, 1u);
  set_item_type_equiv_bit(4u, 0x14u);

  w8(ADDR_ITEMTYPES_TXT + 5u * 0xE4u + 0x16u, 1u);
  w16(ADDR_ITEMTYPES_TXT + 5u * 0xE4u + 0x0Eu, 6u); /* wShoots */
  set_item_type_equiv_bit(5u, 0x2Du);

  w16(ADDR_ITEMTYPES_TXT + 6u * 0xE4u + 0x0Cu, 5u); /* wQuiver */

  /* ItemsTxt rows (stride 0x1A8):
   * 0: 'swd ' weapon type 1 (cost=500, gambleCost=2500, nInvTrans=5, nTransform=1)
   * 1: 'arm ' armor type 2 (cost=800, minAc=10, maxAc=20, nMinAc=10, nTransform=2, nInvTrans=3, nSubType=1)
   * 2: 'hp1 ' potion type 3 (cost=50, bStackable=0, nComponent=0xFF)
   * 3: 'gem1' gem type 4 (cost=300, dwGemOffset=1, nComponent=0xFF)
   * 4: 'bow ' bow type 5 (cost=600, maxStack=0)
   * 5: 'aqv ' arrows type 6 (cost=100, dwSpeed=250, nShoots)
   * 6: 'ear ' ear item (cost=10) -> wType1=1
   */
  {
    uint32_t r0 = ADDR_ITEMS_TXT + 0u * 0x1A8u;
    w32(r0 + 0x80u, 0x20647773u); /* 'swd ' */
    w32(r0 + 0xE0u, 500u);
    w32(r0 + 0xE4u, 2500u);
    w8(r0 + 0x10Fu, 1u); w8(r0 + 0x110u, 3u);
    w8(r0 + 0x112u, 1u);
    w16(r0 + 0x11Eu, 1u);
    w8(r0 + 0x12Au, 0xFFu);
    w8(r0 + 0x136u, 4u);
    w8(r0 + 0x137u, 1u);
    w8(r0 + 0x141u, 1u); w8(r0 + 0x142u, 5u);
  }
  {
    uint32_t r1 = ADDR_ITEMS_TXT + 1u * 0x1A8u;
    w32(r1 + 0x80u, 0x206D7261u); /* 'arm ' */
    w32(r1 + 0xCCu, 10u); w32(r1 + 0xD0u, 20u);
    w32(r1 + 0xE0u, 800u); w32(r1 + 0xE4u, 4000u);
    w8(r1 + 0x10Fu, 2u); w8(r1 + 0x110u, 3u);
    w8(r1 + 0x112u, 1u);
    w16(r1 + 0x11Eu, 2u);
    w8(r1 + 0x12Au, 0u);
    w8(r1 + 0x136u, 3u);
    w8(r1 + 0x137u, 1u);
    w8(r1 + 0x141u, 2u); w8(r1 + 0x142u, 3u);
  }
  {
    uint32_t r2 = ADDR_ITEMS_TXT + 2u * 0x1A8u;
    w32(r2 + 0x80u, 0x20317068u); /* 'hp1 ' */
    w32(r2 + 0xE0u, 50u);
    w8(r2 + 0x10Fu, 1u); w8(r2 + 0x110u, 1u);
    w16(r2 + 0x11Eu, 3u);
    w8(r2 + 0x12Au, 0xFFu);
    w8(r2 + 0x141u, 0u); w8(r2 + 0x142u, 0u);
  }
  {
    uint32_t r3 = ADDR_ITEMS_TXT + 3u * 0x1A8u;
    w32(r3 + 0x80u, 0x316D6567u); /* 'gem1' */
    w32(r3 + 0xE0u, 300u);
    w32(r3 + 0xF0u, 1u); /* dwGemOffset */
    w8(r3 + 0x10Fu, 1u); w8(r3 + 0x110u, 1u);
    w16(r3 + 0x11Eu, 4u);
    w8(r3 + 0x12Au, 0xFFu);
  }
  {
    uint32_t r4 = ADDR_ITEMS_TXT + 4u * 0x1A8u;
    w32(r4 + 0x80u, 0x20776F62u); /* 'bow ' */
    w32(r4 + 0xE0u, 600u);
    w8(r4 + 0x10Fu, 2u); w8(r4 + 0x110u, 3u);
    w16(r4 + 0x11Eu, 5u);
    w8(r4 + 0x12Au, 0u);
  }
  {
    uint32_t r5 = ADDR_ITEMS_TXT + 5u * 0x1A8u;
    w32(r5 + 0x80u, 0x20767161u); /* 'aqv ' */
    w32(r5 + 0xE0u, 100u);
    w32(r5 + 0xE8u, 250u); /* maxStack base speed */
    w8(r5 + 0x10Fu, 1u); w8(r5 + 0x110u, 3u);
    w16(r5 + 0x11Eu, 5u);
    w8(r5 + 0x12Au, 0xFFu);
    w8(r5 + 0x131u, 1u); /* stackable */
  }
  {
    uint32_t r6 = ADDR_ITEMS_TXT + 6u * 0x1A8u;
    w32(r6 + 0x80u, 0x20726165u); /* 'ear ' */
    w32(r6 + 0xE0u, 10u);
    w8(r6 + 0x10Fu, 1u); w8(r6 + 0x110u, 1u);
    w16(r6 + 0x11Eu, 1u);
    w8(r6 + 0x12Au, 0xFFu);
  }

  /* MagicAffix rows (stride 0x90): row 1..4 */
  for (uint32_t a = 0u; a < 16u; a++) {
    uint32_t p = ADDR_MAGICAFFIX_TXT + a * 0x90u;
    w8(p + 0x56u, 0xFFu); /* transformcolor = -1 */
    w32(p + 0x88u, 100u); /* priceMult */
    w32(p + 0x8Cu, 200u); /* priceAdd */
  }
  w8(ADDR_MAGICAFFIX_TXT + 1u * 0x90u + 0x56u, 4u);  /* affix 2 (1-based) color = 4 */
  w8(ADDR_MAGICAFFIX_TXT + 2u * 0x90u + 0x56u, 7u);  /* affix 3 (1-based) color = 7 */
  w32(ADDR_MAGICAFFIX_TXT + 1u * 0x90u + 0x88u, 128u);
  w32(ADDR_MAGICAFFIX_TXT + 1u * 0x90u + 0x8Cu, 350u);

  /* GemsTxt row 1 (stride 0xC0): transform color at +0x2F */
  w8(ADDR_GEMS_TXT + 1u * 0xC0u + 0x2Fu, 9u);

  /* UniqueItemsTxt row 1 (stride 0x14C): +0x38 chrTransform, +0x39 invTransform, +0x7C mult, +0x80 add */
  w8(ADDR_UNIQUE_TXT + 1u * 0x14Cu + 0x38u, 6u);
  w8(ADDR_UNIQUE_TXT + 1u * 0x14Cu + 0x39u, 11u);
  w32(ADDR_UNIQUE_TXT + 1u * 0x14Cu + 0x7Cu, 512u);
  w32(ADDR_UNIQUE_TXT + 1u * 0x14Cu + 0x80u, 1000u);

  /* SetItemsTxt row 1 (stride 0x1B8): +0x38 mult, +0x3C add, +0x40 chrTransform, +0x41 invTransform */
  w32(ADDR_SETITEMS_TXT + 1u * 0x1B8u + 0x38u, 256u);
  w32(ADDR_SETITEMS_TXT + 1u * 0x1B8u + 0x3Cu, 600u);
  w8(ADDR_SETITEMS_TXT + 1u * 0x1B8u + 0x40u, 3u);
  w8(ADDR_SETITEMS_TXT + 1u * 0x1B8u + 0x41u, 12u);

  /* QualityItemsTxt row 0, 1 (stride 0x30): numMods etc. */
  w8(ADDR_QUAL_TXT + 0u * 0x30u + 0x00u, 1u);

  /* NPC Txt row 0 (code=148='akara' style): stride 0x4C */
  /* +0x00=dwCode, +0x04=buyMult(1024), +0x08=sellMult(1024), +0x0C=repMult(1024), +0x10..0x18=qId, +0x40..0x48=maxSellCap */
  w32(ADDR_NPC_TXT + 0u * 0x4Cu + 0x00u, 148u);
  w32(ADDR_NPC_TXT + 0u * 0x4Cu + 0x04u, 1024u);
  w32(ADDR_NPC_TXT + 0u * 0x4Cu + 0x08u, 512u);
  w32(ADDR_NPC_TXT + 0u * 0x4Cu + 0x0Cu, 1024u);
  w32(ADDR_NPC_TXT + 0u * 0x4Cu + 0x10u, 1u);     /* quest 1 discount */
  w32(ADDR_NPC_TXT + 0u * 0x4Cu + 0x1Cu, 920u);   /* quest 1 buy mult */
  w32(ADDR_NPC_TXT + 0u * 0x4Cu + 0x28u, 1024u);  /* quest 1 sell mult */
  w32(ADDR_NPC_TXT + 0u * 0x4Cu + 0x34u, 900u);   /* quest 1 rep mult */
  w32(ADDR_NPC_TXT + 0u * 0x4Cu + 0x40u, 5000u);  /* norm cap */
  w32(ADDR_NPC_TXT + 0u * 0x4Cu + 0x44u, 25000u); /* nm cap */
  w32(ADDR_NPC_TXT + 0u * 0x4Cu + 0x48u, 35000u); /* hell cap */

  /* QuestRecord */
  w32(ADDR_QUESTREC, ADDR_QUESTBITS);
}

static void stage_common(Snap *s) {
  snap_reset(s);
  snap_add(s, VA_GDWBITMASKS_PTR, 4u);
  snap_add(s, VA_SGPT_DATATABLES, 4u);
  snap_add(s, VA_BODY_GRID_DEF, 0x30u);
  snap_add(s, VA_ITEMS_TXT_COUNT, 8u);
  snap_add(s, VA_MAGIC_COUNT, 0x28u);
  snap_add(s, VA_QUAL_TXT_COUNT, 8u);
  snap_add(s, VA_NPC_TXT_PTR, 8u);
  snap_add(s, VA_LVLPREST_TXT_PTR, 4u);
  snap_add(s, VA_ITEMS_LINKER_PTR, 4u);

  snap_add(s, ADDR_BITMASKS, 0x100u);
  snap_add(s, ADDR_DATATABLES, 0xD00u);
  snap_add(s, ADDR_ITEMS_TXT, 7u * 0x1A8u);
  snap_add(s, ADDR_ITEMS_LINK, 0x100u);
  snap_add(s, ADDR_ITEMTYPES_TXT, 8u * 0xE4u);
  snap_add(s, ADDR_ITEMTYPES_EQ, 0x80u);
  snap_add(s, ADDR_MAGICAFFIX_TXT, 16u * 0x90u);
  snap_add(s, ADDR_UNIQUE_TXT, 4u * 0x14Cu);
  snap_add(s, ADDR_SETITEMS_TXT, 4u * 0x1B8u);
  snap_add(s, ADDR_SETS_TXT, 4u * 0x128u);
  snap_add(s, ADDR_GEMS_TXT, 4u * 0xC0u);
  snap_add(s, ADDR_RUNES_TXT, 2u * 0x120u);
  snap_add(s, ADDR_QUAL_TXT, 2u * 0x30u);
  snap_add(s, ADDR_SKILLS_TXT, 4u * 0x23Cu);
  snap_add(s, ADDR_NPC_TXT, 2u * 0x4Cu);
  snap_add(s, ADDR_MONSTATS_TXT, 2u * 0x1A8u);
  snap_add(s, ADDR_QUESTREC, 0x80u);
  snap_add(s, ADDR_OUTDW, 0x100u);
  snap_add(s, ADDR_PLR_SLISTEX, 0x100u);
}

static void setup_inv_with_belt(uint32_t owner) {
  memset((void *)(uintptr_t)ADDR_INV, 0, 0x200u);
  w32(ADDR_INV + 0x00u, 0x01020304u); /* signature */
  w32(ADDR_INV + 0x08u, owner);
  w32(ADDR_INV + 0x14u, ADDR_GRIDS);
  w32(ADDR_INV + 0x18u, 2u); /* nGridCount >= 2 */
  /* Grid 0: body (from D2Common 0x6FDED378) */
  w8(ADDR_GRIDS + 0x08u, *(volatile uint8_t *)0x6FDED378u);
  w8(ADDR_GRIDS + 0x09u, *(volatile uint8_t *)0x6FDED379u);
  w32(ADDR_GRIDS + 0x0Cu, ADDR_GRID_PPITEMS + 0x40u);
  /* Grid 1: belt (from D2Common 0x6FDED390) */
  w8(ADDR_GRIDS + 0x18u, *(volatile uint8_t *)0x6FDED390u);
  w8(ADDR_GRIDS + 0x19u, *(volatile uint8_t *)0x6FDED391u);
  w32(ADDR_GRIDS + 0x1Cu, ADDR_GRID_PPITEMS);
}

static void emit_b1_01_autobelt(FILE *fp) {
  const uint32_t va = 0x6FD71EE0u;
  const char *nm = "ITEMS_AutoPlaceIntoBelt113c";
  Snap *s = &g_snap;

  /* v0: non-beltable sword (class 0) -> returns 0 */
  setup_base_tables();
  init_plr_unit(ADDR_UNIT, ADDR_INV);
  setup_inv_with_belt(ADDR_UNIT);
  init_item_k(ADDR_ITEM0, 0u, 2001u, 2u, 100u, 10u);
  stage_common(s);
  snap_add(s, ADDR_UNIT, 0x100u); snap_add(s, ADDR_INV, 0x200u); snap_add(s, ADDR_ITEM0, 0x400u);
  uint32_t a0[3] = { ADDR_INV, ADDR_ITEM0, 0u };
  uint32_t e0 = call_stdcall3(va, a0[0], a0[1], a0[2]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "not_beltable_sword", a0, 3, 0xFFFFFFFFu, e0, s);

  /* v1: beltable potion (class 2) into belt slot 0 -> returns 1 */
  setup_base_tables();
  init_plr_unit(ADDR_UNIT, ADDR_INV);
  setup_inv_with_belt(ADDR_UNIT);
  init_item_k(ADDR_ITEM0, 2u, 2002u, 2u, 100u, 10u);
  stage_common(s);
  snap_add(s, ADDR_UNIT, 0x100u); snap_add(s, ADDR_INV, 0x200u); snap_add(s, ADDR_ITEM0, 0x400u);
  uint32_t a1[3] = { ADDR_INV, ADDR_ITEM0, 0u };
  uint32_t e1 = call_stdcall3(va, a1[0], a1[1], a1[2]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "beltable_slot0", a1, 3, 0xFFFFFFFFu, e1, s);

  /* v2: beltable potion into belt slot 5 -> returns 1 */
  setup_base_tables();
  init_plr_unit(ADDR_UNIT, ADDR_INV);
  setup_inv_with_belt(ADDR_UNIT);
  init_item_k(ADDR_ITEM0, 2u, 2003u, 2u, 100u, 10u);
  stage_common(s);
  snap_add(s, ADDR_UNIT, 0x100u); snap_add(s, ADDR_INV, 0x200u); snap_add(s, ADDR_ITEM0, 0x400u);
  uint32_t a2[3] = { ADDR_INV, ADDR_ITEM0, 5u };
  uint32_t e2 = call_stdcall3(va, a2[0], a2[1], a2[2]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "beltable_slot5", a2, 3, 0xFFFFFFFFu, e2, s);

  /* v3: invalid belt slot 20 -> returns 0 */
  setup_base_tables();
  init_plr_unit(ADDR_UNIT, ADDR_INV);
  setup_inv_with_belt(ADDR_UNIT);
  init_item_k(ADDR_ITEM0, 2u, 2004u, 2u, 100u, 10u);
  stage_common(s);
  snap_add(s, ADDR_UNIT, 0x100u); snap_add(s, ADDR_INV, 0x200u); snap_add(s, ADDR_ITEM0, 0x400u);
  uint32_t a3[3] = { ADDR_INV, ADDR_ITEM0, 20u };
  uint32_t e3 = call_stdcall3(va, a3[0], a3[1], a3[2]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "slot_out_of_range", a3, 3, 0xFFFFFFFFu, e3, s);
}

static void emit_b1_02_colormap(FILE *fp) {
  const uint32_t va = 0x6FD751C0u;
  const char *nm = "ITEMS_GetItemColorColormap113c";
  Snap *s = &g_snap;
  uint32_t out_ptr = ADDR_OUTDW + 0x80u;

  /* v0: UNIQUE (qual=7, dwItemCell=1) inventory view -> invCol=11, drawTrans=nInvTrans */
  setup_base_tables();
  init_plr_unit(ADDR_UNIT, 0u);
  init_item_k(ADDR_ITEM0, 0u, 3001u, 7u, 100u, 30u);
  w32(ADDR_ITEM0 + 0x100u + 0x28u, 1u); /* dwItemCell */
  w8(out_ptr, 0xFFu);
  stage_common(s); snap_add(s, ADDR_UNIT, 0x100u); snap_add(s, ADDR_ITEM0, 0x200u);
  uint32_t a0[4] = { ADDR_UNIT, ADDR_ITEM0, out_ptr, 1u };
  uint32_t e0 = norm_d2cmp_ptr(call_stdcall4(va, a0[0], a0[1], a0[2], a0[3]));
  snap_capture_post(s);
  emit_line(fp, va, nm, "unique_inv_color", a0, 4, 0xFFFFFFFFu, e0, s);

  /* v1: SET (qual=5, dwItemCell=1) ground/char view -> chrCol=3, drawTrans=nTransform */
  setup_base_tables();
  init_plr_unit(ADDR_UNIT, 0u);
  init_item_k(ADDR_ITEM0, 1u, 3002u, 5u, 100u, 30u);
  w32(ADDR_ITEM0 + 0x100u + 0x28u, 1u);
  w8(out_ptr, 0xFFu);
  stage_common(s); snap_add(s, ADDR_UNIT, 0x100u); snap_add(s, ADDR_ITEM0, 0x200u);
  uint32_t a1[4] = { ADDR_UNIT, ADDR_ITEM0, out_ptr, 0u };
  uint32_t e1 = norm_d2cmp_ptr(call_stdcall4(va, a1[0], a1[1], a1[2], a1[3]));
  snap_capture_post(s);
  emit_line(fp, va, nm, "set_char_color", a1, 4, 0xFFFFFFFFu, e1, s);

  /* v2: MAGIC (qual=4) with prefix color (wMagicPrefix[0]=2 -> color=4) & suffix */
  setup_base_tables();
  init_plr_unit(ADDR_UNIT, 0u);
  init_item_k(ADDR_ITEM0, 0u, 3003u, 4u, 100u, 30u);
  w16(ADDR_ITEM0 + 0x100u + 0x38u, 2u); /* prefix 2 -> row 1 -> color 4 */
  w16(ADDR_ITEM0 + 0x100u + 0x3Eu, 3u); /* suffix 3 -> row 2 -> color 7 */
  w8(out_ptr, 0xFFu);
  stage_common(s); snap_add(s, ADDR_UNIT, 0x100u); snap_add(s, ADDR_ITEM0, 0x200u);
  uint32_t a2[4] = { ADDR_UNIT, ADDR_ITEM0, out_ptr, 1u };
  uint32_t e2 = norm_d2cmp_ptr(call_stdcall4(va, a2[0], a2[1], a2[2], a2[3]));
  snap_capture_post(s);
  emit_line(fp, va, nm, "magic_prefix_color", a2, 4, 0xFFFFFFFFu, e2, s);

  /* v3: NORMAL socketed armor (qual=2, cmdFlags|=0x800) with gem1 -> gem color=9 */
  setup_base_tables();
  init_plr_unit(ADDR_UNIT, 0u);
  init_item_k(ADDR_ITEM0, 1u, 3004u, 2u, 100u, 20u);
  init_item_k(ADDR_SOCKET_GEM0, 3u, 3005u, 2u, 100u, 1u);
  w32(ADDR_ITEM0 + 0x100u + 0x18u, 0x800u); /* socketed */
  w32(ADDR_ITEM0 + 0x60u, ADDR_ITEM0 + 0x340u); /* pInventory */
  w32(ADDR_ITEM0 + 0x340u + 0x00u, 0x01020304u);
  w32(ADDR_ITEM0 + 0x340u + 0x0Cu, ADDR_SOCKET_GEM0);
  w8(out_ptr, 0xFFu);
  stage_common(s); snap_add(s, ADDR_UNIT, 0x100u); snap_add(s, ADDR_ITEM0, 0x400u); snap_add(s, ADDR_SOCKET_GEM0, 0x200u);
  uint32_t a3[4] = { ADDR_UNIT, ADDR_ITEM0, out_ptr, 0u };
  uint32_t e3 = norm_d2cmp_ptr(call_stdcall4(va, a3[0], a3[1], a3[2], a3[3]));
  snap_capture_post(s);
  emit_line(fp, va, nm, "socketed_gem_color", a3, 4, 0xFFFFFFFFu, e3, s);

  /* v4: NORMAL auto-affix fallback (wAutoAffix=2 -> color=4) */
  setup_base_tables();
  init_plr_unit(ADDR_UNIT, 0u);
  init_item_k(ADDR_ITEM0, 0u, 3006u, 2u, 100u, 10u);
  w16(ADDR_ITEM0 + 0x100u + 0x36u, 2u); /* wAutoAffix = 2 */
  w8(out_ptr, 0xFFu);
  stage_common(s); snap_add(s, ADDR_UNIT, 0x100u); snap_add(s, ADDR_ITEM0, 0x200u);
  uint32_t a4[4] = { ADDR_UNIT, ADDR_ITEM0, out_ptr, 0u };
  uint32_t e4 = norm_d2cmp_ptr(call_stdcall4(va, a4[0], a4[1], a4[2], a4[3]));
  snap_capture_post(s);
  emit_line(fp, va, nm, "normal_autoaffix_fallback", a4, 4, 0xFFFFFFFFu, e4, s);

  /* v5: NORMAL plain item with no color -> returns 0 */
  setup_base_tables();
  init_plr_unit(ADDR_UNIT, 0u);
  init_item_k(ADDR_ITEM0, 2u, 3007u, 2u, 100u, 1u);
  w8(out_ptr, 0xFFu);
  stage_common(s); snap_add(s, ADDR_UNIT, 0x100u); snap_add(s, ADDR_ITEM0, 0x200u);
  uint32_t a5[4] = { ADDR_UNIT, ADDR_ITEM0, out_ptr, 0u };
  uint32_t e5 = norm_d2cmp_ptr(call_stdcall4(va, a5[0], a5[1], a5[2], a5[3]));
  snap_capture_post(s);
  emit_line(fp, va, nm, "plain_no_color_zero", a5, 4, 0xFFFFFFFFu, e5, s);
}

static void init_bitbuf(uint32_t max_bytes) {
  memset((void *)(uintptr_t)ADDR_BITBUF, 0, 0x40u);
  memset((void *)(uintptr_t)ADDR_BITDATA, 0, 0x200u);
  w32(ADDR_BITBUF + 0x00u, ADDR_BITDATA);
  w32(ADDR_BITBUF + 0x04u, max_bytes * 8u);
}

static void emit_b1_03_serialize(FILE *fp) {
  const uint32_t va = 0x6FD77180u;
  const char *nm = "ITEMS_SerializeItemBitstream113c";
  Snap *s = &g_snap;

  /* v0: NORMAL (qual=2) unidentified weapon, no server fields */
  setup_base_tables();
  init_bitbuf(256u);
  init_item_k(ADDR_ITEM0, 0u, 4001u, 2u, 100u, 25u);
  add_item_stat(ADDR_ITEM0, 0x48u, 0u, 20, 0); /* durability */
  add_item_stat(ADDR_ITEM0, 0x49u, 0u, 32, 0); /* max dur */
  stage_common(s); snap_add(s, ADDR_ISC_TXT, 256u * 0x144u);
  snap_add(s, ADDR_BITBUF, 0x20u); snap_add(s, ADDR_BITDATA, 0x80u); snap_add(s, ADDR_ITEM0, 0x400u);
  uint32_t a0[4] = { ADDR_ITEM0, ADDR_BITBUF, 0u, 0u };
  call_stdcall4_void(va, a0[0], a0[1], a0[2], a0[3]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "normal_sword_no_srv", a0, 4, 0u, 0u, s);

  /* v1: MAGIC (qual=4) armor with prefix+suffix, AC, server fields=1, simple=0 */
  setup_base_tables();
  init_bitbuf(256u);
  init_item_k(ADDR_ITEM0, 1u, 4002u, 4u, 100u, 45u);
  w32(ADDR_ITEM0 + 0x100u + 0x18u, 0x10u); /* identified */
  w16(ADDR_ITEM0 + 0x100u + 0x38u, 2u); /* prefix */
  w16(ADDR_ITEM0 + 0x100u + 0x3Eu, 3u); /* suffix */
  add_item_stat(ADDR_ITEM0, 0x1Fu, 0u, 25, 1); /* defense */
  add_item_stat(ADDR_ITEM0, 0x48u, 0u, 15, 0);
  add_item_stat(ADDR_ITEM0, 0x49u, 0u, 30, 0);
  add_item_stat(ADDR_ITEM0, 0x10u, 0u, 50, 1); /* edef */
  stage_common(s); snap_add(s, ADDR_ISC_TXT, 256u * 0x144u);
  snap_add(s, ADDR_BITBUF, 0x20u); snap_add(s, ADDR_BITDATA, 0x80u); snap_add(s, ADDR_ITEM0, 0x400u);
  uint32_t a1[4] = { ADDR_ITEM0, ADDR_BITBUF, 1u, 0u };
  call_stdcall4_void(va, a1[0], a1[1], a1[2], a1[3]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "magic_armor_srv", a1, 4, 0u, 0u, s);

  /* v2: RARE (qual=6) weapon with rarePrefix/rareSuffix, 2 affixes, socketed=1 */
  setup_base_tables();
  init_bitbuf(256u);
  init_item_k(ADDR_ITEM0, 0u, 4003u, 6u, 100u, 60u);
  w32(ADDR_ITEM0 + 0x100u + 0x18u, 0x810u); /* identified + socketed */
  w16(ADDR_ITEM0 + 0x100u + 0x32u, 12u); /* rarePrefix */
  w16(ADDR_ITEM0 + 0x100u + 0x34u, 25u); /* rareSuffix */
  w16(ADDR_ITEM0 + 0x100u + 0x38u, 1u);
  w16(ADDR_ITEM0 + 0x100u + 0x3Eu, 2u);
  add_item_stat(ADDR_ITEM0, 0x48u, 0u, 10, 0);
  add_item_stat(ADDR_ITEM0, 0x49u, 0u, 20, 0);
  add_item_stat(ADDR_ITEM0, 0xC2u, 0u, 2, 1); /* sockets=2 */
  stage_common(s); snap_add(s, ADDR_ISC_TXT, 256u * 0x144u);
  snap_add(s, ADDR_BITBUF, 0x20u); snap_add(s, ADDR_BITDATA, 0x80u); snap_add(s, ADDR_ITEM0, 0x400u);
  uint32_t a2[4] = { ADDR_ITEM0, ADDR_BITBUF, 0u, 0u };
  call_stdcall4_void(va, a2[0], a2[1], a2[2], a2[3]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "rare_socketed_sword", a2, 4, 0u, 0u, s);

  /* v3: UNIQUE (qual=7) personalized + charged skill stat 0xCC, stackable arrows, simple=1 */
  setup_base_tables();
  init_bitbuf(256u);
  init_item_k(ADDR_ITEM0, 5u, 4004u, 7u, 100u, 75u);
  w32(ADDR_ITEM0 + 0x100u + 0x18u, 0x01000010u); /* personalized + identified */
  w32(ADDR_ITEM0 + 0x100u + 0x28u, 1u); /* uniqueId */
  memcpy((void *)(uintptr_t)(ADDR_ITEM0 + 0x100u + 0x4Au), "Hero", 5);
  add_item_stat(ADDR_ITEM0, 0x46u, 0u, 120, 0); /* quantity */
  add_item_stat(ADDR_ITEM0, 0xCCu, 0x1405u, 0x0A0Au, 1); /* charged skill */
  stage_common(s); snap_add(s, ADDR_ISC_TXT, 256u * 0x144u);
  snap_add(s, ADDR_BITBUF, 0x20u); snap_add(s, ADDR_BITDATA, 0x80u); snap_add(s, ADDR_ITEM0, 0x400u);
  uint32_t a3[4] = { ADDR_ITEM0, ADDR_BITBUF, 1u, 1u };
  call_stdcall4_void(va, a3[0], a3[1], a3[2], a3[3]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "unique_personalized_stack", a3, 4, 0u, 0u, s);

  /* v4: SET (qual=5) + HIGH (qual=3) armor? Test SET with maxDur=0 (indestructible!) */
  setup_base_tables();
  init_bitbuf(256u);
  init_item_k(ADDR_ITEM0, 1u, 4005u, 5u, 100u, 50u);
  w32(ADDR_ITEM0 + 0x100u + 0x18u, 0x10u);
  w32(ADDR_ITEM0 + 0x100u + 0x28u, 1u);
  add_item_stat(ADDR_ITEM0, 0x1Fu, 0u, 40, 1);
  add_item_stat(ADDR_ITEM0, 0x49u, 0u, 0, 0); /* max dur 0 -> indestructible */
  stage_common(s); snap_add(s, ADDR_ISC_TXT, 256u * 0x144u);
  snap_add(s, ADDR_BITBUF, 0x20u); snap_add(s, ADDR_BITDATA, 0x80u); snap_add(s, ADDR_ITEM0, 0x400u);
  uint32_t a4[4] = { ADDR_ITEM0, ADDR_BITBUF, 0u, 0u };
  call_stdcall4_void(va, a4[0], a4[1], a4[2], a4[3]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "set_indestructible_armor", a4, 4, 0u, 0u, s);
}

static void emit_b1_04_cost(FILE *fp) {
  const uint32_t va = 0x6FD78E80u;
  const char *nm = "ITEMS_ComputeTransactionCost113c";
  Snap *s = &g_snap;

  /* v0: BUY (txType=0) identified magic armor with defense & edef */
  setup_base_tables();
  init_plr_unit(ADDR_UNIT, 0u);
  init_item_k(ADDR_ITEM0, 1u, 5001u, 4u, 100u, 25u);
  w32(ADDR_ITEM0 + 0x100u + 0x18u, 0x10u);
  w16(ADDR_ITEM0 + 0x100u + 0x38u, 2u);
  add_item_stat(ADDR_ITEM0, 0x1Fu, 0u, 15, 0);
  add_item_stat(ADDR_ITEM0, 0x10u, 0u, 20, 1);
  stage_common(s); snap_add(s, ADDR_ISC_TXT, 256u * 0x144u);
  snap_add(s, ADDR_UNIT, 0x200u); snap_add(s, ADDR_ITEM0, 0x400u);
  uint32_t a0[6] = { ADDR_UNIT, ADDR_ITEM0, 0u, ADDR_QUESTREC, 148u, 0u };
  uint32_t e0 = call_0x6FD78E80(a0[0], a0[1], a0[2], a0[3], a0[4], a0[5]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "buy_magic_armor", a0, 6, 0xFFFFFFFFu, e0, s);

  /* v1: SELL (txType=1) unique sword with quest 1 discount bit set in Hell (diff=2) */
  setup_base_tables();
  init_plr_unit(ADDR_UNIT, 0u);
  w8(ADDR_QUESTBITS + (1u * 16u / 8u), 1u << ((1u * 16u) & 7u));
  init_item_k(ADDR_ITEM0, 0u, 5002u, 7u, 100u, 50u);
  w32(ADDR_ITEM0 + 0x100u + 0x18u, 0x10u);
  w32(ADDR_ITEM0 + 0x100u + 0x28u, 1u); /* unique idx 1 */
  add_item_stat(ADDR_ITEM0, 0x48u, 0u, 15, 0);
  add_item_stat(ADDR_ITEM0, 0x49u, 0u, 30, 0);
  stage_common(s); snap_add(s, ADDR_ISC_TXT, 256u * 0x144u);
  snap_add(s, ADDR_UNIT, 0x200u); snap_add(s, ADDR_ITEM0, 0x400u);
  uint32_t a1[6] = { ADDR_UNIT, ADDR_ITEM0, 2u, ADDR_QUESTREC, 148u, 1u };
  uint32_t e1 = call_0x6FD78E80(a1[0], a1[1], a1[2], a1[3], a1[4], a1[5]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "sell_unique_hell_capped", a1, 6, 0xFFFFFFFFu, e1, s);

  /* v2: GAMBLE (txType=2) sword (gambleCost=2500) */
  setup_base_tables();
  init_plr_unit(ADDR_UNIT, 0u);
  w32(ADDR_PLR_STATS + 0x00u, ((uint32_t)12u << 16) | 0u); /* stat 0x0C = level = 50 */
  w32(ADDR_PLR_STATS + 0x04u, 50u);
  w16(ADDR_PLR_SLISTEX + 0x4Cu, 1u);
  init_item_k(ADDR_ITEM0, 0u, 5003u, 2u, 100u, 50u);
  stage_common(s); snap_add(s, ADDR_ISC_TXT, 256u * 0x144u);
  snap_add(s, ADDR_UNIT, 0x200u); snap_add(s, ADDR_PLR_SLISTEX, 0x100u); snap_add(s, ADDR_ITEM0, 0x400u);
  uint32_t a2[6] = { ADDR_UNIT, ADDR_ITEM0, 0u, ADDR_QUESTREC, 148u, 2u };
  uint32_t e2 = call_0x6FD78E80(a2[0], a2[1], a2[2], a2[3], a2[4], a2[5]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "gamble_sword", a2, 6, 0xFFFFFFFFu, e2, s);

  /* v3: REPAIR (txType=3) partial durability + replenish stat 0xFC=1 */
  setup_base_tables();
  init_plr_unit(ADDR_UNIT, 0u);
  init_item_k(ADDR_ITEM0, 1u, 5004u, 6u, 100u, 40u);
  w32(ADDR_ITEM0 + 0x100u + 0x18u, 0x10u);
  add_item_stat(ADDR_ITEM0, 0x1Fu, 0u, 18, 0);
  add_item_stat(ADDR_ITEM0, 0x48u, 0u, 10, 0); /* curDur = 10 */
  add_item_stat(ADDR_ITEM0, 0x49u, 0u, 40, 0); /* maxDur = 40 */
  add_item_stat(ADDR_ITEM0, 0xFCu, 0u, 1, 1);  /* replenish durability -> uses maxDur-1 */
  stage_common(s); snap_add(s, ADDR_ISC_TXT, 256u * 0x144u);
  snap_add(s, ADDR_UNIT, 0x200u); snap_add(s, ADDR_ITEM0, 0x400u);
  uint32_t a3[6] = { ADDR_UNIT, ADDR_ITEM0, 0u, ADDR_QUESTREC, 148u, 3u };
  uint32_t e3 = call_0x6FD78E80(a3[0], a3[1], a3[2], a3[3], a3[4], a3[5]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "repair_replenish_armor", a3, 6, 0xFFFFFFFFu, e3, s);

  /* v4: SELL (txType=1) quiver/bow with quantity (maxStack=250, cur=100) */
  setup_base_tables();
  init_plr_unit(ADDR_UNIT, 0u);
  init_item_k(ADDR_ITEM0, 5u, 5005u, 2u, 100u, 10u);
  add_item_stat(ADDR_ITEM0, 0x46u, 0u, 100, 0);
  stage_common(s); snap_add(s, ADDR_ISC_TXT, 256u * 0x144u);
  snap_add(s, ADDR_UNIT, 0x200u); snap_add(s, ADDR_ITEM0, 0x400u);
  uint32_t a4[6] = { ADDR_UNIT, ADDR_ITEM0, 0u, ADDR_QUESTREC, 148u, 1u };
  uint32_t e4 = call_0x6FD78E80(a4[0], a4[1], a4[2], a4[3], a4[4], a4[5]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "sell_arrows_stack", a4, 6, 0xFFFFFFFFu, e4, s);
}

static void setup_act5_level(uint32_t lvl_id, uint32_t w, uint32_t h) {
  memset((void *)(uintptr_t)ADDR_LVL, 0, 0x1800u);
  memset((void *)(uintptr_t)(ADDR_LVLPREST_TXT + 935u * 0x1B0u), 0, 30u * 0x1B0u);

  /* Preset records 938..958: sizeX=8, sizeY=8 (1x1 grid cell), nFiles=1 */
  for (uint32_t pid = 938u; pid <= 958u; pid++) {
    uint32_t pr = ADDR_LVLPREST_TXT + pid * 0x1B0u;
    w32(pr + 0x00u, pid);
    w32(pr + 0x28u, 8u);
    w32(pr + 0x2Cu, 8u);
    w32(pr + 0x40u, 1u);
  }
  /* Pre-link D2DrlgPresetNodeStrc list at ADDR_LVL+0x1CC so PickPresetFileIndex113c never FogAllocs */
  uint32_t head = 0u;
  for (uint32_t idx = 0u; idx <= 20u; idx++) {
    uint32_t pid = 938u + idx;
    uint32_t node = ADDR_PRESET_NODES + idx * 0x10u;
    w32(node + 0x00u, pid);
    w32(node + 0x04u, 1u);
    w32(node + 0x08u, 0u);
    w32(node + 0x0Cu, head);
    head = node;
  }

  w32(ADDR_LVL + 0x14u, ADDR_OUTDOORS);
  w32(ADDR_LVL + 0x24u, w);
  w32(ADDR_LVL + 0x28u, h);
  w32(ADDR_LVL + 0x1B4u, ADDR_DRLG);
  w32(ADDR_LVL + 0x1C4u, 0x13572468u);
  w32(ADDR_LVL + 0x1C8u, 0x00000001u);
  w32(ADDR_LVL + 0x1CCu, head);
  w32(ADDR_LVL + 0x1D0u, lvl_id);

  /* Outdoors grids 0, 1, 2: 6x6 */
  for (uint32_t row = 0u; row < 6u; row++) {
    w32(ADDR_GRID0_ROWS + row * 4u, row * 6u);
    w32(ADDR_GRID1_ROWS + row * 4u, row * 6u);
    w32(ADDR_GRID2_ROWS + row * 4u, row * 6u);
  }
  /* Grid0 at +0x04, Grid1 at +0x18, Grid2 at +0x2C, nGridWidth/Height at +0x5C/+0x60 */
  w32(ADDR_OUTDOORS + 0x04u, ADDR_GRID0_CELLS);
  w32(ADDR_OUTDOORS + 0x08u, ADDR_GRID0_ROWS);
  w32(ADDR_OUTDOORS + 0x0Cu, 6u);
  w32(ADDR_OUTDOORS + 0x10u, 6u);

  w32(ADDR_OUTDOORS + 0x18u, ADDR_GRID1_CELLS);
  w32(ADDR_OUTDOORS + 0x1Cu, ADDR_GRID1_ROWS);
  w32(ADDR_OUTDOORS + 0x20u, 6u);
  w32(ADDR_OUTDOORS + 0x24u, 6u);

  w32(ADDR_OUTDOORS + 0x2Cu, ADDR_GRID2_CELLS);
  w32(ADDR_OUTDOORS + 0x30u, ADDR_GRID2_ROWS);
  w32(ADDR_OUTDOORS + 0x34u, 6u);
  w32(ADDR_OUTDOORS + 0x38u, 6u);

  w32(ADDR_OUTDOORS + 0x5Cu, 6u);
  w32(ADDR_OUTDOORS + 0x60u, 6u);
}

static void emit_b1_05_presets(FILE *fp) {
  const uint32_t va = 0x6FD91A20u;
  const char *nm = "DRLGOUTANIM_PlaceLevelPresets113c";
  Snap *s = &g_snap;

  /* v0: non-Act5 level (id=109) -> no-op */
  setup_base_tables();
  setup_act5_level(109u, 32u, 40u);
  stage_common(s);
  snap_add(s, ADDR_LVL, 0x1800u);
  snap_add(s, ADDR_LVLPREST_TXT + 935u * 0x1B0u, 30u * 0x1B0u);
  uint32_t a0[1] = { ADDR_LVL };
  call_0x6FD91A20(a0[0]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "non_act5_noop", a0, 1, 0u, 0u, s);

  /* v1: Act5 level 111 narrow (w=24 < h=48) -> uses nPrestA */
  setup_base_tables();
  setup_act5_level(111u, 24u, 48u);
  stage_common(s);
  snap_add(s, ADDR_LVL, 0x1800u);
  snap_add(s, ADDR_LVLPREST_TXT + 935u * 0x1B0u, 30u * 0x1B0u);
  uint32_t a1[1] = { ADDR_LVL };
  call_0x6FD91A20(a1[0]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "lvl111_narrow_prestA", a1, 1, 0u, 0u, s);

  /* v2: Act5 level 112 wide (w=48 >= h=32) -> uses nPrestB */
  setup_base_tables();
  setup_act5_level(112u, 48u, 32u);
  stage_common(s);
  snap_add(s, ADDR_LVL, 0x1800u);
  snap_add(s, ADDR_LVLPREST_TXT + 935u * 0x1B0u, 30u * 0x1B0u);
  uint32_t a2[1] = { ADDR_LVL };
  call_0x6FD91A20(a2[0]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "lvl112_wide_prestB", a2, 1, 0u, 0u, s);
}

static void emit_b2_01_stream_sockets(FILE *fp) {
  const uint32_t va = 0x6FD78D70u;
  const char *nm = "ITEMS_WriteItemStreamAndSockets113c";
  Snap *s = &g_snap;

  /* v0: bHdr=0, bSock=0, bSimple=0, normal sword */
  setup_base_tables();
  init_bitbuf(256u);
  init_item_k(ADDR_ITEM0, 0u, 6001u, 2u, 100u, 15u);
  add_item_stat(ADDR_ITEM0, 0x48u, 0u, 12, 0);
  add_item_stat(ADDR_ITEM0, 0x49u, 0u, 24, 0);
  stage_common(s); snap_add(s, ADDR_ISC_TXT, 256u * 0x144u);
  snap_add(s, ADDR_BITBUF, 0x20u); snap_add(s, ADDR_BITDATA, 0x80u); snap_add(s, ADDR_ITEM0, 0x400u);
  uint32_t a0[5] = { ADDR_ITEM0, ADDR_BITBUF, 0u, 0u, 0u };
  uint32_t e0 = call_0x6FD78D70(a0[0], a0[1], a0[2], a0[3], a0[4]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "no_hdr_no_sock", a0, 5, 0xFFFFFFFFu, e0, s);

  /* v1: bHdr=1, bSock=1, socketed armor with 1 gem, magic sword? Test normal socketed armor */
  setup_base_tables();
  init_bitbuf(256u);
  init_item_k(ADDR_ITEM0, 1u, 6002u, 2u, 100u, 30u);
  init_item_k(ADDR_SOCKET_GEM0, 3u, 6003u, 2u, 100u, 1u);
  w32(ADDR_ITEM0 + 0x100u + 0x18u, 0x810u); /* socketed + id */
  w32(ADDR_ITEM0 + 0x60u, ADDR_ITEM0 + 0x340u);
  w32(ADDR_ITEM0 + 0x340u + 0x00u, 0x01020304u);
  w32(ADDR_ITEM0 + 0x340u + 0x0Cu, ADDR_SOCKET_GEM0);
  add_item_stat(ADDR_ITEM0, 0x1Fu, 0u, 20, 0);
  add_item_stat(ADDR_ITEM0, 0xC2u, 0u, 2, 1);
  stage_common(s); snap_add(s, ADDR_ISC_TXT, 256u * 0x144u);
  snap_add(s, ADDR_BITBUF, 0x20u); snap_add(s, ADDR_BITDATA, 0x80u);
  snap_add(s, ADDR_ITEM0, 0x400u); snap_add(s, ADDR_SOCKET_GEM0, 0x400u);
  uint32_t a1[5] = { ADDR_ITEM0, ADDR_BITBUF, 1u, 1u, 0u };
  uint32_t e1 = call_0x6FD78D70(a1[0], a1[1], a1[2], a1[3], a1[4]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "hdr_and_1_socket_gem", a1, 5, 0xFFFFFFFFu, e1, s);

  /* v2: bHdr=1, bSock=0, bSimple=1 */
  setup_base_tables();
  init_bitbuf(256u);
  init_item_k(ADDR_ITEM0, 2u, 6004u, 2u, 100u, 1u);
  stage_common(s); snap_add(s, ADDR_ISC_TXT, 256u * 0x144u);
  snap_add(s, ADDR_BITBUF, 0x20u); snap_add(s, ADDR_BITDATA, 0x80u); snap_add(s, ADDR_ITEM0, 0x400u);
  uint32_t a2[5] = { ADDR_ITEM0, ADDR_BITBUF, 1u, 0u, 1u };
  uint32_t e2 = call_0x6FD78D70(a2[0], a2[1], a2[2], a2[3], a2[4]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "hdr_simple_potion", a2, 5, 0xFFFFFFFFu, e2, s);
}

static void emit_b2_02_txcost_wrapper(FILE *fp) {
  const uint32_t va = 0x6FD79D60u;
  const char *nm = "ITEMS_GetTransactionCost113c";
  Snap *s = &g_snap;

  /* v0: BUY sword */
  setup_base_tables();
  init_plr_unit(ADDR_UNIT, 0u);
  init_item_k(ADDR_ITEM0, 0u, 7001u, 2u, 100u, 10u);
  stage_common(s); snap_add(s, ADDR_ISC_TXT, 256u * 0x144u);
  snap_add(s, ADDR_UNIT, 0x200u); snap_add(s, ADDR_ITEM0, 0x400u);
  uint32_t a0[6] = { ADDR_UNIT, ADDR_ITEM0, 0u, ADDR_QUESTREC, 148u, 0u };
  uint32_t e0 = call_stdcall6(va, a0[0], a0[1], a0[2], a0[3], a0[4], a0[5]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "buy_normal_sword", a0, 6, 0xFFFFFFFFu, e0, s);

  /* v1: SELL rare armor */
  setup_base_tables();
  init_plr_unit(ADDR_UNIT, 0u);
  init_item_k(ADDR_ITEM0, 1u, 7002u, 6u, 100u, 40u);
  w32(ADDR_ITEM0 + 0x100u + 0x18u, 0x10u);
  w16(ADDR_ITEM0 + 0x100u + 0x38u, 2u);
  add_item_stat(ADDR_ITEM0, 0x1Fu, 0u, 30, 0);
  stage_common(s); snap_add(s, ADDR_ISC_TXT, 256u * 0x144u);
  snap_add(s, ADDR_UNIT, 0x200u); snap_add(s, ADDR_ITEM0, 0x400u);
  uint32_t a1[6] = { ADDR_UNIT, ADDR_ITEM0, 1u, ADDR_QUESTREC, 148u, 1u };
  uint32_t e1 = call_stdcall6(va, a1[0], a1[1], a1[2], a1[3], a1[4], a1[5]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "sell_rare_armor_nm", a1, 6, 0xFFFFFFFFu, e1, s);

  /* v2: REPAIR damaged sword */
  setup_base_tables();
  init_plr_unit(ADDR_UNIT, 0u);
  init_item_k(ADDR_ITEM0, 0u, 7003u, 4u, 100u, 30u);
  w32(ADDR_ITEM0 + 0x100u + 0x18u, 0x10u);
  w16(ADDR_ITEM0 + 0x100u + 0x38u, 2u);
  add_item_stat(ADDR_ITEM0, 0x48u, 0u, 5, 0);
  add_item_stat(ADDR_ITEM0, 0x49u, 0u, 25, 0);
  stage_common(s); snap_add(s, ADDR_ISC_TXT, 256u * 0x144u);
  snap_add(s, ADDR_UNIT, 0x200u); snap_add(s, ADDR_ITEM0, 0x400u);
  uint32_t a2[6] = { ADDR_UNIT, ADDR_ITEM0, 0u, ADDR_QUESTREC, 148u, 3u };
  uint32_t e2 = call_stdcall6(va, a2[0], a2[1], a2[2], a2[3], a2[4], a2[5]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "repair_damaged_sword", a2, 6, 0xFFFFFFFFu, e2, s);
}

static void emit_b2_03_repair_all(FILE *fp) {
  const uint32_t va = 0x6FD7A210u;
  const char *nm = "ITEMS_GetRepairAllCost113c";
  Snap *s = &g_snap;

  /* v0: player with no damaged equipped items -> returns 0 */
  setup_base_tables();
  init_plr_unit(ADDR_UNIT, ADDR_INV);
  setup_inv_with_belt(ADDR_UNIT);
  init_item_k(ADDR_ITEM0, 0u, 8001u, 2u, 100u, 20u);
  w32(ADDR_ITEM0 + 0x100u + 0x18u, 0x10u);
  add_item_stat(ADDR_ITEM0, 0x48u, 0u, 20, 0);
  add_item_stat(ADDR_ITEM0, 0x49u, 0u, 20, 0);
  w32(ADDR_GRID_PPITEMS + 0x40u + 4u * 4u, ADDR_ITEM0); /* bodyLoc 4 */
  stage_common(s); snap_add(s, ADDR_ISC_TXT, 256u * 0x144u);
  snap_add(s, ADDR_UNIT, 0x200u); snap_add(s, ADDR_INV, 0x200u); snap_add(s, ADDR_ITEM0, 0x400u);
  uint32_t a0[6] = { 0x1234u, ADDR_UNIT, 148u, 0u, ADDR_QUESTREC, 0u };
  uint32_t e0 = call_stdcall6(va, a0[0], a0[1], a0[2], a0[3], a0[4], a0[5]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "full_durability_zero", a0, 6, 0xFFFFFFFFu, e0, s);

  /* v1: player with damaged armor + damaged sword, pfnCallback = 0 */
  setup_base_tables();
  init_plr_unit(ADDR_UNIT, ADDR_INV);
  setup_inv_with_belt(ADDR_UNIT);
  init_item_k(ADDR_ITEM0, 0u, 8002u, 4u, 100u, 20u);
  w32(ADDR_ITEM0 + 0x100u + 0x18u, 0x10u);
  w16(ADDR_ITEM0 + 0x100u + 0x38u, 2u);
  add_item_stat(ADDR_ITEM0, 0x48u, 0u, 5, 0);
  add_item_stat(ADDR_ITEM0, 0x49u, 0u, 20, 0);
  init_item_k(ADDR_ITEM1, 1u, 8003u, 2u, 100u, 20u);
  w32(ADDR_ITEM1 + 0x100u + 0x18u, 0x10u);
  add_item_stat(ADDR_ITEM1, 0x1Fu, 0u, 15, 0);
  add_item_stat(ADDR_ITEM1, 0x48u, 0u, 10, 0);
  add_item_stat(ADDR_ITEM1, 0x49u, 0u, 30, 0);
  w32(ADDR_GRID_PPITEMS + 0x40u + 3u * 4u, ADDR_ITEM1);
  w32(ADDR_GRID_PPITEMS + 0x40u + 4u * 4u, ADDR_ITEM0);
  stage_common(s); snap_add(s, ADDR_ISC_TXT, 256u * 0x144u);
  snap_add(s, ADDR_UNIT, 0x200u); snap_add(s, ADDR_INV, 0x200u);
  snap_add(s, ADDR_ITEM0, 0x400u); snap_add(s, ADDR_ITEM1, 0x400u);
  uint32_t a1[6] = { 0xCAFEBABEu, ADDR_UNIT, 148u, 0u, ADDR_QUESTREC, 0u };
  uint32_t e1 = call_stdcall6(va, a1[0], a1[1], a1[2], a1[3], a1[4], a1[5]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "two_damaged_no_cb", a1, 6, 0xFFFFFFFFu, e1, s);

  /* v2: same two damaged items + fixed-address callback stub 0x200FF000 */
  setup_base_tables();
  init_plr_unit(ADDR_UNIT, ADDR_INV);
  setup_inv_with_belt(ADDR_UNIT);
  init_item_k(ADDR_ITEM0, 0u, 8004u, 4u, 100u, 20u);
  w32(ADDR_ITEM0 + 0x100u + 0x18u, 0x10u);
  w16(ADDR_ITEM0 + 0x100u + 0x38u, 2u);
  add_item_stat(ADDR_ITEM0, 0x48u, 0u, 5, 0);
  add_item_stat(ADDR_ITEM0, 0x49u, 0u, 20, 0);
  init_item_k(ADDR_ITEM1, 1u, 8005u, 2u, 100u, 20u);
  w32(ADDR_ITEM1 + 0x100u + 0x18u, 0x10u);
  add_item_stat(ADDR_ITEM1, 0x1Fu, 0u, 15, 0);
  add_item_stat(ADDR_ITEM1, 0x48u, 0u, 10, 0);
  add_item_stat(ADDR_ITEM1, 0x49u, 0u, 30, 0);
  w32(ADDR_GRID_PPITEMS + 0x40u + 3u * 4u, ADDR_ITEM1);
  w32(ADDR_GRID_PPITEMS + 0x40u + 4u * 4u, ADDR_ITEM0);
  stage_common(s); snap_add(s, ADDR_ISC_TXT, 256u * 0x144u);
  snap_add(s, ADDR_UNIT, 0x200u); snap_add(s, ADDR_INV, 0x200u);
  snap_add(s, ADDR_ITEM0, 0x400u); snap_add(s, ADDR_ITEM1, 0x400u);
  uint32_t a2[6] = { 0xCAFEBABEu, ADDR_UNIT, 148u, 0u, ADDR_QUESTREC, ADDR_REPAIR_CB_STUB };
  uint32_t e2 = call_stdcall6(va, a2[0], a2[1], a2[2], a2[3], a2[4], a2[5]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "two_damaged_with_cb", a2, 6, 0xFFFFFFFFu, e2, s);
}

static void emit_b2_04_serialize_buf(FILE *fp) {
  const uint32_t va = 0x6FD79D00u;
  const char *nm = "ITEMS_SerializeItemToBuffer113c";
  Snap *s = &g_snap;

  /* v0: serialize normal sword into buffer (max=128) */
  setup_base_tables();
  memset((void *)(uintptr_t)ADDR_BITDATA, 0xAA, 128u);
  init_item_k(ADDR_ITEM0, 0u, 9001u, 2u, 100u, 12u);
  add_item_stat(ADDR_ITEM0, 0x48u, 0u, 10, 0);
  add_item_stat(ADDR_ITEM0, 0x49u, 0u, 20, 0);
  stage_common(s); snap_add(s, ADDR_ISC_TXT, 256u * 0x144u);
  snap_add(s, ADDR_BITDATA, 0x80u); snap_add(s, ADDR_ITEM0, 0x400u);
  uint32_t a0[6] = { ADDR_ITEM0, ADDR_BITDATA, 128u, 0u, 0u, 0u };
  uint32_t e0 = call_stdcall6(va, a0[0], a0[1], a0[2], a0[3], a0[4], a0[5]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "buf_normal_sword", a0, 6, 0xFFFFFFFFu, e0, s);

  /* v1: serialize socketed armor with header + sockets into buffer */
  setup_base_tables();
  memset((void *)(uintptr_t)ADDR_BITDATA, 0xAA, 128u);
  init_item_k(ADDR_ITEM0, 1u, 9002u, 4u, 100u, 35u);
  w32(ADDR_ITEM0 + 0x100u + 0x18u, 0x10u);
  w16(ADDR_ITEM0 + 0x100u + 0x38u, 2u);
  add_item_stat(ADDR_ITEM0, 0x1Fu, 0u, 25, 0);
  stage_common(s); snap_add(s, ADDR_ISC_TXT, 256u * 0x144u);
  snap_add(s, ADDR_BITDATA, 0x80u); snap_add(s, ADDR_ITEM0, 0x400u);
  uint32_t a1[6] = { ADDR_ITEM0, ADDR_BITDATA, 128u, 1u, 1u, 0u };
  uint32_t e1 = call_stdcall6(va, a1[0], a1[1], a1[2], a1[3], a1[4], a1[5]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "buf_hdr_magic_armor", a1, 6, 0xFFFFFFFFu, e1, s);

  /* v2: tiny buffer overflow (nMaxBytes=4) -> full flag clamped */
  setup_base_tables();
  memset((void *)(uintptr_t)ADDR_BITDATA, 0xAA, 16u);
  init_item_k(ADDR_ITEM0, 0u, 9003u, 2u, 100u, 10u);
  stage_common(s); snap_add(s, ADDR_ISC_TXT, 256u * 0x144u);
  snap_add(s, ADDR_BITDATA, 0x20u); snap_add(s, ADDR_ITEM0, 0x400u);
  uint32_t a2[6] = { ADDR_ITEM0, ADDR_BITDATA, 4u, 1u, 0u, 0u };
  uint32_t e2 = call_stdcall6(va, a2[0], a2[1], a2[2], a2[3], a2[4], a2[5]);
  snap_capture_post(s);
  emit_line(fp, va, nm, "buf_small_4b", a2, 6, 0xFFFFFFFFu, e2, s);
}

int main(int argc, char **argv) {
  if (argc < 3) {
    fprintf(stderr, "Usage: %s <out_i13b1.ndjson> <out_i13b2.ndjson>\n", argv[0]);
    return 1;
  }

  HMODULE hFog = LoadLibraryA("Fog.dll");
  HMODULE hCmp = LoadLibraryA("D2CMP.dll");
  HMODULE hCom = LoadLibraryA("D2Common.dll");
  if (!hFog || !hCmp || !hCom) {
    fprintf(stderr, "LoadLibrary failed: Fog=%p D2CMP=%p D2Common=%p err=%lu\n",
            (void *)hFog, (void *)hCmp, (void *)hCom, GetLastError());
    return 1;
  }
  if ((uint32_t)(uintptr_t)hCom != D2COMMON_BASE) {
    fprintf(stderr, "D2Common relocated to %p (expected 0x%08X)\n", (void *)hCom, D2COMMON_BASE);
    return 1;
  }
  g_d2cmp_base = (uint32_t)(uintptr_t)hCmp;

  DWORD oldProt = 0;
  if (!VirtualProtect((void *)0x6FDD9000u, 0x0001A000u, PAGE_EXECUTE_READWRITE, &oldProt)) {
    fprintf(stderr, "VirtualProtect D2Common failed err=%lu\n", GetLastError());
    return 1;
  }

  void *arena = VirtualAlloc((void *)(uintptr_t)ARENA_BASE, ARENA_SIZE,
                             MEM_RESERVE | MEM_COMMIT, PAGE_EXECUTE_READWRITE);
  if (arena != (void *)(uintptr_t)ARENA_BASE) {
    fprintf(stderr, "VirtualAlloc(0x20000000) got %p err=%lu\n", arena, GetLastError());
    return 1;
  }

  uint32_t real_bm = r32(VA_GDWBITMASKS_PTR);
  memcpy(g_real_bitmasks, (const void *)(uintptr_t)real_bm, 256u);
  install_repair_cb_stub();

  FILE *fp1 = fopen(argv[1], "wb");
  FILE *fp2 = fopen(argv[2], "wb");
  if (!fp1 || !fp2) {
    fprintf(stderr, "fopen output failed\n");
    return 1;
  }

  emit_b1_01_autobelt(fp1);
  emit_b1_02_colormap(fp1);
  emit_b1_03_serialize(fp1);
  emit_b1_04_cost(fp1);
  emit_b1_05_presets(fp1);

  emit_b2_01_stream_sockets(fp2);
  emit_b2_02_txcost_wrapper(fp2);
  emit_b2_03_repair_all(fp2);
  emit_b2_04_serialize_buf(fp2);

  fclose(fp1);
  fclose(fp2);
  fprintf(stderr, "OK d2cmp=%p fog=%p com=%p\n", (void *)hCmp, (void *)hFog, (void *)hCom);
  return 0;
}
