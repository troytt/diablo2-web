/*
 * K1r13 Iteration 14 Lane B real-DLL differential oracle emitter (D2Common.dll v1.13c).
 * Emits 54 D2Common functions split into 3 sub-batches:
 *   I14B-1 (18 VAs), I14B-2 (19 VAs), I14B-3 (17 VAs).
 * Usage: k1r13-laneB-it14-emitter.exe <out1.ndjson> <out2.ndjson> <out3.ndjson>
 */
#include <setjmp.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <windows.h>

#define D2COMMON_BASE       0x6FD50000u
#define VA_FOG_ALLOC_THUNK  0x6FD59222u
#define VA_GDWBITMASKS_PTR  0x6FDD90B0u
#define VA_SGPT_DATATABLES  0x6FDE9E1Cu
#define VA_ITEMS_TXT_COUNT  0x6FDEFB94u
#define VA_ITEMS_TXT_PTR    0x6FDEFB98u
#define VA_LVLWARP_TXT_PTR  0x6FDEFBBCu
#define VA_LVLWARP_TXT_CNT  0x6FDEFBC0u
#define VA_ITEMS_LINKER_PTR 0x6FDEFF6Cu
#define VA_LEVEL_DEF_BIN    0x6FDF0B38u
#define VA_LVLPREST_TXT_PTR 0x6FDF0B3Cu
#define VA_OBJECTS_TXT_PTR  0x6FDF0B94u
#define VA_OBJECTS_TXT_CNT  0x6FDF0B98u
#define VA_LVLTYPES_TXT_PTR 0x6FDF142Cu
#define VA_LVLTYPES_TXT_CNT 0x6FDF1430u
#define VA_WALL_CACHE_PTR   0x6FDF1434u
#define VA_WALL_CACHE_CNT   0x6FDF1438u
#define VA_LVLSUB_TXT_PTR   0x6FDF143Cu
#define VA_LVLSUB_TXT_CNT   0x6FDF1440u
#define VA_LVLSUB_IDX_PTR   0x6FDF1444u

#define ARENA_BASE          0x20000000u
#define ARENA_SIZE          0x00200000u

#define ADDR_BITMASKS       0x20000000u
#define ADDR_OUT0           0x20000100u
#define ADDR_OUT1           0x20000180u
#define ADDR_OUT_COMP       0x20000200u
#define ADDR_OUT_COLOR      0x20000240u
#define ADDR_LVLMAZE_TXT    0x20000400u
#define ADDR_LVLSUB_IDX     0x20000800u
#define ADDR_DATATABLES     0x20001000u
#define ADDR_ITEMS_TXT      0x20002000u
#define ADDR_ITEMTYPES_EQ   0x20006000u
#define ADDR_SETITEMS_TXT   0x2000A000u
#define ADDR_SETS_TXT       0x2000B000u
#define ADDR_CHARSTATS_TXT  0x2000C000u
#define ADDR_ISC_TXT        0x2000E000u
#define ADDR_LEVEL_DEFS     0x20010000u
#define ADDR_OBJECTS_TXT    0x20016000u

#define ADDR_ACT            0x20020000u
#define ADDR_DRLG           0x20020200u
#define ADDR_LVL0           0x20020800u
#define ADDR_LVL1           0x20020B00u
#define ADDR_LVL2           0x20020E00u
#define ADDR_OUTDOORS       0x20021100u
#define ADDR_RX0            0x20021500u
#define ADDR_RX1            0x20021700u
#define ADDR_RX2            0x20021900u
#define ADDR_ROOM0          0x20021B00u
#define ADDR_ROOM1          0x20021D00u
#define ADDR_NEAR_ARR       0x20021F00u
#define ADDR_GRID0_CELLS    0x20022000u
#define ADDR_GRID0_ROWS     0x20022400u
#define ADDR_GRID1_CELLS    0x20022500u
#define ADDR_GRID1_ROWS     0x20022900u
#define ADDR_GRID2_CELLS    0x20022A00u
#define ADDR_GRID2_ROWS     0x20022E00u
#define ADDR_GRID3_CELLS    0x20022F00u
#define ADDR_GRID3_ROWS     0x20023300u
#define ADDR_V0             0x20023400u
#define ADDR_V1             0x20023440u
#define ADDR_V2             0x20023480u
#define ADDR_V3             0x200234C0u
#define ADDR_ORTH0          0x20023500u
#define ADDR_ORTH1          0x20023540u
#define ADDR_PRESET0        0x20023600u
#define ADDR_TILE0          0x20023700u
#define ADDR_MAZEGRID       0x20023800u
#define ADDR_MGRID_CELLS    0x20023900u
#define ADDR_MGRID_ROWS     0x20023D00u
#define ADDR_RECT           0x20023E00u

#define ADDR_UNIT0          0x20024000u
#define ADDR_INV0           0x20024200u
#define ADDR_ITEM0          0x20024300u
#define ADDR_ITEMDATA0      0x20024500u
#define ADDR_SLISTEX        0x20024600u
#define ADDR_SLIST0         0x20024700u
#define ADDR_STATS0         0x20024800u
#define ADDR_PATH0          0x20024900u
#define ADDR_CTX            0x20030000u
#define ADDR_COLLMAP_BUF    0x20040000u
#define ADDR_MONSTATS_TXT   0x20050000u
#define ADDR_LVLTYPES_TXT   0x20060000u
#define ADDR_ITEMTYPES_TXT  0x20068000u
#define ADDR_LVLSUB_TXT     0x20070000u
#define ADDR_LVLWARP_TXT    0x20078000u
#define ADDR_LVLPREST_TXT   0x20080000u

static uint8_t *g_arena = NULL;

static jmp_buf g_assert_jmp;
static volatile int g_in_call = 0;
static volatile uint32_t g_caught_exc = 0;

static LONG CALLBACK veh_handler(EXCEPTION_POINTERS *ep) {
  if (g_in_call) {
    g_caught_exc = ep->ExceptionRecord->ExceptionCode;
    g_in_call = 0;
    longjmp(g_assert_jmp, 1);
  }
  return EXCEPTION_CONTINUE_SEARCH;
}

static inline void w32(uint32_t addr, uint32_t v) { *(volatile uint32_t *)(uintptr_t)addr = v; }
static inline uint32_t r32(uint32_t addr) { return *(volatile uint32_t *)(uintptr_t)addr; }
static inline void w16(uint32_t addr, uint16_t v) { *(volatile uint16_t *)(uintptr_t)addr = v; }
static inline uint16_t r16(uint32_t addr) { return *(volatile uint16_t *)(uintptr_t)addr; }
static inline void w8(uint32_t addr, uint8_t v) { *(volatile uint8_t *)(uintptr_t)addr = v; }
static inline uint8_t r8(uint32_t addr) { return *(volatile uint8_t *)(uintptr_t)addr; }

typedef uint32_t (__fastcall *fog_alloc_t)(uint32_t pool, uint32_t size, const char *file, uint32_t line, uint32_t flags);

static uint32_t fog_alloc_zero(uint32_t size) {
  uint32_t p = ((fog_alloc_t)VA_FOG_ALLOC_THUNK)(0u, size, "emit", 1u, 0u);
  memset((void *)(uintptr_t)p, 0, size);
  return p;
}

static int is_outdoor_link_level(int lid) {
  if (lid >= 1 && lid <= 8) return 1;
  if (lid == 17 || lid == 26 || lid == 27 || lid == 28 || lid == 32 || lid == 33 || lid == 39) return 1;
  if (lid >= 40 && lid <= 46) return 1;
  if (lid >= 75 && lid <= 83) return 1;
  if (lid >= 103 && lid <= 112) return 1;
  if (lid == 117 || lid == 134 || lid == 136) return 1;
  return 0;
}

static void reset_arena(void) {
  memset(g_arena, 0, 0x00100000u);
  for (int i = 0; i < 32; i++) {
    w32(ADDR_BITMASKS + (uint32_t)i * 4u, 1u << i);
  }
  w32(VA_GDWBITMASKS_PTR, ADDR_BITMASKS);
  w32(VA_SGPT_DATATABLES, ADDR_DATATABLES);
  w32(VA_ITEMS_TXT_COUNT, 16u);
  w32(VA_ITEMS_TXT_PTR, ADDR_ITEMS_TXT);
  w32(VA_LVLWARP_TXT_PTR, ADDR_LVLWARP_TXT);
  w32(VA_LVLWARP_TXT_CNT, 16u);
  w32(VA_LEVEL_DEF_BIN, ADDR_LEVEL_DEFS);
  w32(VA_LVLPREST_TXT_PTR, ADDR_LVLPREST_TXT);
  w32(VA_OBJECTS_TXT_PTR, ADDR_OBJECTS_TXT);
  w32(VA_OBJECTS_TXT_CNT, 64u);
  w32(VA_LVLTYPES_TXT_PTR, ADDR_LVLTYPES_TXT);
  w32(VA_LVLTYPES_TXT_CNT, 40u);
  w32(VA_WALL_CACHE_PTR, ADDR_LVLMAZE_TXT);
  w32(VA_WALL_CACHE_CNT, 16u);
  w32(VA_LVLSUB_TXT_PTR, ADDR_LVLSUB_TXT);
  w32(VA_LVLSUB_TXT_CNT, 16u);
  w32(VA_LVLSUB_IDX_PTR, ADDR_LVLSUB_IDX);

  w32(ADDR_LVLMAZE_TXT + 0u, 2u);
  for (int i = 0; i < 16; i++) {
    w32(ADDR_LVLSUB_TXT + (uint32_t)i * 0x15Cu, 0xFFFFFFFFu);
  }
  for (int i = 0; i < 1000; i++) {
    uint32_t p = ADDR_LVLPREST_TXT + (uint32_t)i * 0x1B0u;
    w32(p + 0x00u, (uint32_t)i);
    w32(p + 0x28u, 8u);
    w32(p + 0x2Cu, 8u);
    w32(p + 0x40u, 2u);
  }

  /* sgptDataTables fields */
  w32(ADDR_DATATABLES + 0xA78u, ADDR_MONSTATS_TXT);
  w32(ADDR_DATATABLES + 0xA80u, 512u);
  w32(ADDR_DATATABLES + 0xBC4u, ADDR_CHARSTATS_TXT);
  w32(ADDR_DATATABLES + 0xBC8u, 7u);
  w32(ADDR_DATATABLES + 0xBCCu, ADDR_ISC_TXT);
  w32(ADDR_DATATABLES + 0xBD4u, 32u);
  w32(ADDR_DATATABLES + 0xBF8u, ADDR_ITEMTYPES_TXT);
  w32(ADDR_DATATABLES + 0xBFCu, 80u);
  w32(ADDR_DATATABLES + 0xC00u, 4u);
  w32(ADDR_DATATABLES + 0xC04u, ADDR_ITEMTYPES_EQ);
  w32(ADDR_DATATABLES + 0xC08u, ADDR_SETITEMS_TXT);
  w32(ADDR_DATATABLES + 0xC0Cu, ADDR_SETS_TXT);
  w32(ADDR_DATATABLES + 0xC10u, 4u);
  w32(ADDR_DATATABLES + 0xC14u, ADDR_SETS_TXT);
  w32(ADDR_DATATABLES + 0xC18u, ADDR_SETITEMS_TXT);
  w32(ADDR_DATATABLES + 0xC1Cu, 4u);
  w32(ADDR_DATATABLES + 0xC5Cu, 137u);
  w32(ADDR_DATATABLES + 0xC64u, ADDR_LVLPREST_TXT);
  w32(ADDR_DATATABLES + 0xC68u, 1000u);

  for (int lid = 0; lid < 137; lid++) {
    uint32_t base = ADDR_LEVEL_DEFS + (uint32_t)lid * 0x9Cu;
    uint32_t sz = (lid >= 0x4b && lid <= 0x53) ? 80u : 16u;
    w32(base + 0x0Cu, sz); w32(base + 0x10u, sz + 8u); w32(base + 0x14u, sz + 16u);
    w32(base + 0x18u, sz); w32(base + 0x1Cu, sz + 8u); w32(base + 0x20u, sz + 16u);
    w32(base + 0x24u, 100u + (uint32_t)(lid % 16) * 128u); w32(base + 0x28u, 200u + (uint32_t)(lid / 16) * 128u);
    w32(base + 0x38u, 0xFFFFFFFFu);
    w32(base + 0x3Cu, 0xFFFFFFFFu);
    if (is_outdoor_link_level(lid)) {
      w32(base + 0x30u, 3u);
    }
  }
}

static void setup_grid(uint32_t cells, uint32_t rows, int w, int h) {
  for (int y = 0; y < h; y++) {
    w32(rows + (uint32_t)y * 4u, (uint32_t)(y * w));
  }
  (void)cells;
}

static void emit_vec_hdr(FILE *f, const char *va, const char *name, const char *cid,
                         uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3) {
  fprintf(f, "{\"va\":\"%s\",\"name\":\"%s\",\"case\":\"%s\",\"args\":[%u,%u,%u,%u]",
          va, name, cid, a0, a1, a2, a3);
}

static void emit_vec_end(FILE *f, uint32_t ret, uint32_t exc,
                         uint32_t o0, uint32_t o1, uint32_t o2, uint32_t o3) {
  fprintf(f, ",\"ret\":%u,\"exc\":%u,\"out\":[%u,%u,%u,%u]}\n",
          ret, exc, o0, o1, o2, o3);
  fflush(f);
}

/* Register trampoline helpers (zero memory operand constraints) */
static uint32_t call_eax(uint32_t va, uint32_t eax_val) {
  uint32_t ret;
  asm volatile("call *%1" : "=a"(ret) : "r"(va), "a"(eax_val) : "ecx", "edx", "memory", "cc");
  return ret;
}

static uint32_t call_esi(uint32_t va, uint32_t esi_val) {
  uint32_t ret;
  asm volatile(
    "push %%esi\n\tmov %1, %%esi\n\tcall *%%eax\n\tpop %%esi"
    : "=a"(ret) : "r"(esi_val), "a"(va) : "ecx", "edx", "memory", "cc");
  return ret;
}

static __attribute__((noinline)) uint32_t call_edi_ebx(uint32_t va, uint32_t edi_val, uint32_t ebx_val) {
  volatile uint32_t regs[2] = { edi_val, ebx_val };
  uint32_t ret;
  asm volatile(
    "push %%ebx\n\tpush %%edi\n\t"
    "mov (%%esi), %%edi\n\tmov 4(%%esi), %%ebx\n\t"
    "call *%%eax\n\t"
    "pop %%edi\n\tpop %%ebx"
    : "=a"(ret) : "S"(regs), "a"(va) : "ecx", "edx", "memory", "cc");
  return ret;
}

static uint32_t call_esi_s1(uint32_t va, uint32_t esi_val, uint32_t s0) {
  uint32_t ret;
  asm volatile(
    "push %%esi\n\tpush %2\n\tmov %1, %%esi\n\tcall *%%eax\n\tpop %%esi"
    : "=a"(ret) : "r"(esi_val), "r"(s0), "a"(va) : "ecx", "edx", "memory", "cc");
  return ret;
}

static uint32_t call_esi_s2(uint32_t va, uint32_t esi_val, uint32_t s0, uint32_t s1) {
  uint32_t ret;
  asm volatile(
    "push %%esi\n\tpush %3\n\tpush %2\n\tmov %1, %%esi\n\tcall *%%eax\n\tpop %%esi"
    : "=a"(ret) : "r"(esi_val), "r"(s0), "r"(s1), "a"(va) : "ecx", "edx", "memory", "cc");
  return ret;
}

static uint32_t call_eax_s2(uint32_t va, uint32_t eax_val, uint32_t s0, uint32_t s1) {
  uint32_t ret;
  asm volatile(
    "push %3\n\tpush %2\n\tcall *%1"
    : "=a"(ret) : "r"(va), "r"(s0), "r"(s1), "a"(eax_val) : "ecx", "edx", "memory", "cc");
  return ret;
}

static __attribute__((noinline)) uint32_t call_eax_s4(uint32_t va, uint32_t eax_val, uint32_t s0, uint32_t s1, uint32_t s2, uint32_t s3) {
  volatile uint32_t args[4] = { s0, s1, s2, s3 };
  uint32_t ret;
  asm volatile(
    "push 12(%%esi)\n\tpush 8(%%esi)\n\tpush 4(%%esi)\n\tpush (%%esi)\n\tcall *%1"
    : "=a"(ret) : "r"(va), "S"(args), "a"(eax_val) : "ecx", "edx", "memory", "cc");
  return ret;
}

static __attribute__((noinline)) uint32_t call_ecx_ebx_s2(uint32_t va, uint32_t ecx_val, uint32_t ebx_val, uint32_t s0, uint32_t s1) {
  volatile uint32_t args[2] = { s0, s1 };
  uint32_t ret;
  asm volatile(
    "push %%ebx\n\tpush 4(%%esi)\n\tpush (%%esi)\n\tpush %3\n\tmov %1, %%eax\n\tpop %%ebx\n\tcall *%%eax\n\tpop %%ebx"
    : "=a"(ret) : "r"(va), "c"(ecx_val), "r"(ebx_val), "S"(args) : "edx", "memory", "cc");
  return ret;
}

static __attribute__((noinline)) uint32_t call_eax_ecx_edx_s2(uint32_t va, uint32_t eax_val, uint32_t ecx_val, uint32_t edx_val, uint32_t s0, uint32_t s1) {
  volatile uint32_t args[2] = { s0, s1 };
  uint32_t ret;
  asm volatile(
    "push 4(%%esi)\n\tpush (%%esi)\n\tcall *%1"
    : "=a"(ret) : "r"(va), "S"(args), "a"(eax_val), "c"(ecx_val), "d"(edx_val) : "memory", "cc");
  return ret;
}

static __attribute__((noinline)) uint32_t call_eax_ecx_edx_s3(uint32_t va, uint32_t eax_val, uint32_t ecx_val, uint32_t edx_val, uint32_t s0, uint32_t s1, uint32_t s2) {
  volatile uint32_t args[3] = { s0, s1, s2 };
  uint32_t ret;
  asm volatile(
    "push 8(%%esi)\n\tpush 4(%%esi)\n\tpush (%%esi)\n\tcall *%1"
    : "=a"(ret) : "r"(va), "S"(args), "a"(eax_val), "c"(ecx_val), "d"(edx_val) : "memory", "cc");
  return ret;
}

static uint32_t call_ebx_s1(uint32_t va, uint32_t ebx_val, uint32_t s0) {
  uint32_t ret;
  asm volatile(
    "push %%ebx\n\tpush %2\n\tmov %1, %%ebx\n\tcall *%%eax\n\tpop %%ebx"
    : "=a"(ret) : "r"(ebx_val), "r"(s0), "a"(va) : "ecx", "edx", "memory", "cc");
  return ret;
}

static __attribute__((noinline)) uint32_t call_edi_s5(uint32_t va, uint32_t edi_val, uint32_t s0, uint32_t s1, uint32_t s2, uint32_t s3, uint32_t s4) {
  volatile uint32_t args[5] = { s0, s1, s2, s3, s4 };
  uint32_t ret;
  asm volatile(
    "push %%edi\n\t"
    "push 16(%%esi)\n\tpush 12(%%esi)\n\tpush 8(%%esi)\n\tpush 4(%%esi)\n\tpush (%%esi)\n\t"
    "push %2\n\tmov %1, %%eax\n\tpop %%edi\n\t"
    "call *%%eax\n\tpop %%edi"
    : "=a"(ret) : "r"(va), "r"(edi_val), "S"(args) : "ecx", "edx", "memory", "cc");
  return ret;
}

typedef uint32_t (__stdcall *std1_t)(uint32_t);
typedef uint32_t (__stdcall *std2_t)(uint32_t, uint32_t);
typedef uint32_t (__stdcall *std3_t)(uint32_t, uint32_t, uint32_t);
typedef uint32_t (__stdcall *std4_t)(uint32_t, uint32_t, uint32_t, uint32_t);
typedef uint32_t (__stdcall *std5_t)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
typedef uint32_t (__stdcall *std6_t)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
typedef uint32_t (__stdcall *std9_t)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
typedef uint32_t (__fastcall *fast2_t)(uint32_t, uint32_t);
typedef uint32_t (__fastcall *fast4_t)(uint32_t, uint32_t, uint32_t, uint32_t);
typedef uint32_t (__fastcall *fast10_t)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);

#define CALL_GUARDED(fn_expr, out_ret, out_exc) do { \
  g_caught_exc = 0; \
  if (setjmp(g_assert_jmp) == 0) { \
    g_in_call = 1; \
    out_ret = (fn_expr); \
    g_in_call = 0; \
    out_exc = 0; \
  } else { \
    out_ret = 0; \
    out_exc = g_caught_exc ? g_caught_exc : 1u; \
  } \
} while (0)

static void setup_outdoors_basic(uint32_t level_id, uint32_t level_type, int gw, int gh) {
  w32(ADDR_LVL0 + 0x00u, 3u);
  w32(ADDR_LVL0 + 0x14u, ADDR_OUTDOORS);
  w32(ADDR_LVL0 + 0x1Cu, 100u);
  w32(ADDR_LVL0 + 0x20u, 200u);
  w32(ADDR_LVL0 + 0x24u, (uint32_t)(gw * 8));
  w32(ADDR_LVL0 + 0x28u, (uint32_t)(gh * 8));
  w32(ADDR_LVL0 + 0x1B4u, ADDR_DRLG);
  w32(ADDR_LVL0 + 0x1C0u, level_type);
  w32(ADDR_LVL0 + 0x1C4u, 0x12345678u);
  w32(ADDR_LVL0 + 0x1C8u, 0x29Au);
  w32(ADDR_LVL0 + 0x1D0u, level_id);

  w32(ADDR_DRLG + 0x00u, 0x12345678u);
  w32(ADDR_DRLG + 0x04u, 0x29Au);
  w32(ADDR_DRLG + 0x454u, 0x12345678u);
  w32(ADDR_DRLG + 0x458u, 0x9ABCDEF0u);
  w32(ADDR_DRLG + 0x46Cu, ADDR_ACT);
  w32(ADDR_DRLG + 0x470u, 0x1111u);
  w32(ADDR_DRLG + 0x47Cu, ADDR_LVL0);

  w32(ADDR_OUTDOORS + 0x04u, ADDR_GRID0_CELLS);
  w32(ADDR_OUTDOORS + 0x08u, ADDR_GRID0_ROWS);
  w32(ADDR_OUTDOORS + 0x0Cu, (uint32_t)gw);
  w32(ADDR_OUTDOORS + 0x10u, (uint32_t)gh);
  w32(ADDR_OUTDOORS + 0x18u, ADDR_GRID1_CELLS);
  w32(ADDR_OUTDOORS + 0x1Cu, ADDR_GRID1_ROWS);
  w32(ADDR_OUTDOORS + 0x20u, (uint32_t)gw);
  w32(ADDR_OUTDOORS + 0x24u, (uint32_t)gh);
  w32(ADDR_OUTDOORS + 0x2Cu, ADDR_GRID2_CELLS);
  w32(ADDR_OUTDOORS + 0x30u, ADDR_GRID2_ROWS);
  w32(ADDR_OUTDOORS + 0x34u, (uint32_t)gw);
  w32(ADDR_OUTDOORS + 0x38u, (uint32_t)gh);
  w32(ADDR_OUTDOORS + 0x40u, ADDR_GRID3_CELLS);
  w32(ADDR_OUTDOORS + 0x44u, ADDR_GRID3_ROWS);
  w32(ADDR_OUTDOORS + 0x48u, (uint32_t)gw);
  w32(ADDR_OUTDOORS + 0x4Cu, (uint32_t)gh);
  w32(ADDR_OUTDOORS + 0x5Cu, (uint32_t)gw);
  w32(ADDR_OUTDOORS + 0x60u, (uint32_t)gh);
  w32(ADDR_OUTDOORS + 0x64u, ADDR_V0);
  setup_grid(ADDR_GRID0_CELLS, ADDR_GRID0_ROWS, gw, gh);
  setup_grid(ADDR_GRID1_CELLS, ADDR_GRID1_ROWS, gw, gh);
  setup_grid(ADDR_GRID2_CELLS, ADDR_GRID2_ROWS, gw, gh);
  setup_grid(ADDR_GRID3_CELLS, ADDR_GRID3_ROWS, gw, gh);

  w32(ADDR_V0 + 0x00u, 1u); w32(ADDR_V0 + 0x04u, 1u); w8(ADDR_V0 + 0x08u, 0u); w32(ADDR_V0 + 0x0Cu, 2u); w32(ADDR_V0 + 0x10u, ADDR_V1);
  w32(ADDR_V1 + 0x00u, 5u); w32(ADDR_V1 + 0x04u, 1u); w8(ADDR_V1 + 0x08u, 0u); w32(ADDR_V1 + 0x0Cu, 2u); w32(ADDR_V1 + 0x10u, ADDR_V2);
  w32(ADDR_V2 + 0x00u, 5u); w32(ADDR_V2 + 0x04u, 5u); w8(ADDR_V2 + 0x08u, 0u); w32(ADDR_V2 + 0x0Cu, 2u); w32(ADDR_V2 + 0x10u, ADDR_V3);
  w32(ADDR_V3 + 0x00u, 1u); w32(ADDR_V3 + 0x04u, 5u); w8(ADDR_V3 + 0x08u, 0u); w32(ADDR_V3 + 0x0Cu, 2u); w32(ADDR_V3 + 0x10u, ADDR_V0);
}

static void emit_i14b1(FILE *f) {
  uint32_t ret = 0, exc = 0;

  /* 1. 0x6FD67180 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    uint32_t lids[3] = {0x11u, 41u, 110u};
    uint32_t ltypes[3] = {2u, 16u, 30u};
    setup_outdoors_basic(lids[k], ltypes[k], 8, 8);
    w32(ADDR_GRID2_CELLS + (0u * 8u + 0u) * 4u, 1u);
    w32(ADDR_GRID2_CELLS + (0u * 8u + 7u) * 4u, 1u);
    w32(ADDR_GRID2_CELLS + (7u * 8u + 0u) * 4u, 1u);
    w32(ADDR_GRID2_CELLS + (7u * 8u + 7u) * 4u, 1u);
    uint32_t vf = (k == 2) ? 2u : 1u;
    w32(ADDR_V0 + 0x00u, 1u); w32(ADDR_V0 + 0x04u, 1u); w8(ADDR_V0 + 0x08u, (uint8_t)(k & 1)); w32(ADDR_V0 + 0x0Cu, vf); w32(ADDR_V0 + 0x10u, ADDR_V1);
    w32(ADDR_V1 + 0x00u, 5u); w32(ADDR_V1 + 0x04u, 1u); w8(ADDR_V1 + 0x08u, 0u); w32(ADDR_V1 + 0x0Cu, vf); w32(ADDR_V1 + 0x10u, ADDR_V2);
    w32(ADDR_V2 + 0x00u, 5u); w32(ADDR_V2 + 0x04u, 5u); w8(ADDR_V2 + 0x08u, 1u); w32(ADDR_V2 + 0x0Cu, vf); w32(ADDR_V2 + 0x10u, ADDR_V3);
    w32(ADDR_V3 + 0x00u, 1u); w32(ADDR_V3 + 0x04u, 5u); w8(ADDR_V3 + 0x08u, 0u); w32(ADDR_V3 + 0x0Cu, vf); w32(ADDR_V3 + 0x10u, ADDR_V0);
    CALL_GUARDED(((std1_t)0x6FD67180u)(ADDR_LVL0), ret, exc);
    emit_vec_hdr(f, "0x6FD67180", "DRLGROOM_SpawnOutdoorBorderPresets", k == 0 ? "act1_burial" : (k == 1 ? "act2_pair" : "act5_high"), ADDR_LVL0, lids[k], ltypes[k], (uint32_t)k);
    emit_vec_end(f, ret, exc, r32(ADDR_GRID2_CELLS + (1u * 8u + 3u) * 4u), r32(ADDR_GRID0_CELLS + (1u * 8u + 3u) * 4u), r32(ADDR_GRID0_CELLS + (1u * 8u + 5u) * 4u), r32(ADDR_GRID2_CELLS + (1u * 8u + 5u) * 4u));
  }

  /* 2. 0x6FD67760 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    setup_outdoors_basic(2u, 2u, 6, 6);
    w32(ADDR_LVL0 + 0x00u, (k == 2) ? 2u : 3u);
    uint32_t s = (k == 0) ? 3u : 2u, e = (k == 0) ? 1u : 2u;
    CALL_GUARDED(((std3_t)0x6FD67760u)(ADDR_DRLG, s, e), ret, exc);
    emit_vec_hdr(f, "0x6FD67760", "DRLGROOM_ConnectOutdoorLevelOrthNodes", k == 0 ? "empty_range" : (k == 1 ? "outdoors" : "preset_skip"), ADDR_DRLG, s, e, 0u);
    emit_vec_end(f, ret, exc, r32(ADDR_OUTDOORS + 0x264u), 0u, 0u, 0u);
  }

  /* 3..7. 0x6FD67930..0x6FD67AE0 (Act1..5 link setups) */
  const uint32_t act_vas[5] = {0x6FD67930u, 0x6FD67990u, 0x6FD67A00u, 0x6FD67AA0u, 0x6FD67AE0u};
  const char *act_names[5] = {
    "DRLGROOM_SetupAct2OutdoorLinks", "DRLGROOM_SetupAct1OutdoorLinks",
    "DRLGROOM_SetupAct3OutdoorLinks", "DRLGROOM_SetupAct4OutdoorLinks",
    "DRLGROOM_SetupAct5OutdoorLinks"
  };
  const char *act_va_strs[5] = {"0x6FD67930", "0x6FD67990", "0x6FD67A00", "0x6FD67AA0", "0x6FD67AE0"};
  for (int i = 0; i < 5; i++) {
    for (int k = 0; k < 3; k++) {
      reset_arena();
      w32(ADDR_LEVEL_DEFS + 2u * 0x9Cu + 0x30u, 3u);
      setup_outdoors_basic(1u, 1u, 4, 4);
      w8(ADDR_DRLG + 0x450u, (uint8_t)k);
      uint32_t init_seed = (i == 2) ? (0x3456789Au + (uint32_t)k * 0x44444444u) : (0x12345678u + (uint32_t)k * 0x11111111u);
      w32(ADDR_DRLG + 0x00u, init_seed);
      if (i == 2) {
        w32(ADDR_LVL0 + 0x1D0u, 0x4Bu);
        CALL_GUARDED(call_esi(act_vas[i], ADDR_DRLG), ret, exc);
      } else {
        if (i == 1) w32(ADDR_LVL0 + 0x1D0u, 0x68u);
        CALL_GUARDED(call_eax(act_vas[i], ADDR_DRLG), ret, exc);
      }
      emit_vec_hdr(f, act_va_strs[i], act_names[i], k == 0 ? "norm" : (k == 1 ? "nm" : "hell"), ADDR_DRLG, (uint32_t)k, init_seed, 0u);
      emit_vec_end(f, ret, exc, r32(ADDR_DRLG + 0x00u), r32(ADDR_LVL0 + 0x20u), r32(ADDR_LVL0 + 0x24u), r32(ADDR_LVL0 + 0x28u));
    }
  }

  /* 8. 0x6FD67D00 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    setup_outdoors_basic(2u, 2u, 6, 6);
    uint32_t root = ADDR_CTX + 4u;
    w32(ADDR_CTX, root);
    w32(ADDR_CTX + 0x8CA4u, 1u);
    w32(root + 0x0Cu, 2u); w32(root + 0x10u, 2u);
    w32(root + 0x14u, 0xFFFFFFFFu);
    w32(root + 0x18u, 0x6FDDCAB8u);
    w8(root + 0x1Cu, 0u);
    w32(ADDR_OUT0, (k == 0) ? 2u : (k == 1 ? 3u : 5u));
    w32(ADDR_OUT0 + 4u, 2u);
    uint32_t max_c = (k == 2) ? 2u : 20u;
    CALL_GUARDED(((std4_t)0x6FD67D00u)(ADDR_CTX, max_c, ADDR_LVL0, ADDR_OUT0), ret, exc);
    emit_vec_hdr(f, "0x6FD67D00", "DRLGOUTPLACE_ExpandMazeLinkPath", k == 0 ? "at_goal" : (k == 1 ? "one_step" : "budget_fail"), ADDR_CTX, max_c, ADDR_LVL0, ADDR_OUT0);
    emit_vec_end(f, ret, exc, r32(ADDR_CTX + 0x8CA4u), ret ? r32(ret + 0x0Cu) : 0u, ret ? r32(ret + 0x10u) : 0u, 0u);
  }

  /* 9. 0x6FD67EB0 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    setup_outdoors_basic(2u, 2u, 8, 8);
    uint32_t sx[3] = {108u, 108u, 108u}, gx[3] = {108u, 132u, 148u};
    w32(ADDR_OUTDOORS + 0xF8u, sx[k]); w32(ADDR_OUTDOORS + 0xFCu, 208u);
    w32(ADDR_OUTDOORS + 0x170u, gx[k]); w32(ADDR_OUTDOORS + 0x174u, 208u);
    CALL_GUARDED(call_ebx_s1(0x6FD67EB0u, 0u, ADDR_LVL0), ret, exc);
    uint32_t vh = r32(ADDR_OUTDOORS + 0x68u);
    emit_vec_hdr(f, "0x6FD67EB0", "DRLGOUTPLACE_BuildOutdoorMazeLinkPath", k == 0 ? "short" : (k == 1 ? "med" : "long"), ADDR_LVL0, 0u, gx[k], 0u);
    emit_vec_end(f, ret, exc, vh ? r32(vh) : 0u, vh ? r32(vh + 4u) : 0u, vh ? r32(vh + 0x10u) : 0u, 0u);
  }

  /* 10. 0x6FD69B60 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    setup_outdoors_basic(2u, 2u, 6, 6);
    w32(ADDR_LVL0 + 0x1D8u, (k == 0) ? 0u : 2u);
    w32(ADDR_LVL0 + 0x2Cu, 111u); w32(ADDR_LVL0 + 0x30u, 222u); w32(ADDR_LVL0 + 0x34u, 1u);
    w32(ADDR_LVL0 + 0x38u, 333u); w32(ADDR_LVL0 + 0x3Cu, 444u); w32(ADDR_LVL0 + 0x40u, 2u);
    w32(ADDR_LVL0 + 0x10u, ADDR_RX0);
    w32(ADDR_RX0 + 0x34u, 0u); w32(ADDR_RX0 + 0x38u, 0u); w32(ADDR_RX0 + 0x3Cu, 500u); w32(ADDR_RX0 + 0x40u, 500u);
    uint32_t pt = (k == 2) ? 2u : 1u;
    CALL_GUARDED(call_ecx_ebx_s2(0x6FD69B60u, ADDR_LVL0, pt, ADDR_OUT0, ADDR_OUT1), ret, exc);
    emit_vec_hdr(f, "0x6FD69B60", "DRLG_FindPortalTargetRoomEx", k == 0 ? "zero_entries" : (k == 1 ? "match_1" : "match_2"), ADDR_LVL0, pt, ADDR_OUT0, ADDR_OUT1);
    emit_vec_end(f, ret, exc, r32(ADDR_OUT0), r32(ADDR_OUT1), 0u, 0u);
  }

  /* 11. 0x6FD69FA0 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    w32(ADDR_LVL0 + 0x10u, (k == 0) ? 0u : ADDR_RX0);
    w32(ADDR_RX0 + 0x28u, (k == 1) ? 0u : 0x03110000u);
    w32(ADDR_RX0 + 0x30u, ADDR_ROOM0);
    w32(ADDR_RX0 + 0x34u, 10u); w32(ADDR_RX0 + 0x38u, 20u);
    w32(ADDR_RX0 + 0x5Cu, (k == 2) ? ADDR_PRESET0 : 0u);
    w32(ADDR_PRESET0 + 0x04u, 5u); w32(ADDR_PRESET0 + 0x08u, 25u); w32(ADDR_PRESET0 + 0x14u, 2u); w32(ADDR_PRESET0 + 0x18u, 35u);
    w8(ADDR_OBJECTS_TXT + 5u * 0x1C0u + 0x167u, 0x40u);
    CALL_GUARDED(call_eax_s2(0x6FD69FA0u, ADDR_LVL0, ADDR_OUT0, ADDR_OUT1), ret, exc);
    emit_vec_hdr(f, "0x6FD69FA0", "DRLG_FindWaypointRoomExAndPos", k == 0 ? "no_room" : (k == 1 ? "no_wp_flag" : "found_wp"), ADDR_LVL0, ADDR_OUT0, ADDR_OUT1, 0u);
    emit_vec_end(f, ret, exc, r32(ADDR_OUT0), r32(ADDR_OUT1), 0u, 0u);
  }

  /* 12. 0x6FD6A080 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    w32(ADDR_RX0 + 0x28u, (k == 0) ? 0x03100000u : (k == 1 ? 0x01100000u : 0x00100000u));
    w32(ADDR_RX0 + 0x30u, 0x12340000u + (uint32_t)k);
    w32(ADDR_RX0 + 0x48u, 1u);
    w32(ADDR_RX0 + 0x58u, ADDR_LVL0);
    w32(ADDR_LVL0 + 0x1B4u, ADDR_DRLG);
    CALL_GUARDED(call_eax(0x6FD6A080u, ADDR_RX0), ret, exc);
    emit_vec_hdr(f, "0x6FD6A080", "DRLG_EnsureRoomExActiveAndLoaded", k == 0 ? "all_loaded" : (k == 1 ? "dt1_only" : "load_dt1"), ADDR_RX0, 0u, 0u, 0u);
    emit_vec_end(f, ret, exc, r32(ADDR_RX0 + 0x28u), 0u, 0u, 0u);
  }

  /* 13. 0x6FD6A0D0 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    if (k >= 1) {
      w32(ADDR_RX0 + 0x4Cu, ADDR_TILE0);
      w32(ADDR_TILE0 + 0x00u, ADDR_RX1);
      w32(ADDR_TILE0 + 0x10u, ADDR_V0);
      w32(ADDR_V0, 77u);
    }
    if (k == 2) {
      w32(ADDR_RX1 + 0x28u, 0x03100000u);
      w32(ADDR_RX1 + 0x4Cu, ADDR_TILE0 + 0x20u);
      w32(ADDR_TILE0 + 0x20u, ADDR_RX0);
      w32(ADDR_TILE0 + 0x30u, ADDR_V1);
      w32(ADDR_V1, 88u);
      w32(ADDR_RX1 + 0x30u, ADDR_ROOM1);
    }
    CALL_GUARDED(((fast4_t)0x6FD6A0D0u)(77u, ADDR_RX0, ADDR_OUT0, ADDR_OUT1), ret, exc);
    emit_vec_hdr(f, "0x6FD6A0D0", "DRLG_FindWarpTargetRoom", k == 0 ? "no_tiles" : (k == 1 ? "no_backlink" : "found_room"), 77u, ADDR_RX0, ADDR_OUT0, ADDR_OUT1);
    emit_vec_end(f, ret, exc, r32(ADDR_OUT0), r32(ADDR_OUT1), 0u, 0u);
  }

  /* 14. 0x6FD6A130 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    setup_outdoors_basic(2u, 2u, 6, 6);
    w32(ADDR_LVL0 + 0x10u, ADDR_RX0);
    w32(ADDR_LVL0 + 0x1D8u, 1u);
    w32(ADDR_LVL0 + 0x2Cu, 108u); w32(ADDR_LVL0 + 0x30u, 212u); w32(ADDR_LVL0 + 0x34u, 1u);
    w32(ADDR_RX0 + 0x28u, 0x03110000u);
    w32(ADDR_RX0 + 0x30u, ADDR_ROOM0);
    w32(ADDR_RX0 + 0x34u, 100u); w32(ADDR_RX0 + 0x38u, 200u); w32(ADDR_RX0 + 0x3Cu, 20u); w32(ADDR_RX0 + 0x40u, 20u);
    w32(ADDR_RX0 + 0x5Cu, ADDR_PRESET0);
    w32(ADDR_PRESET0 + 0x04u, 5u); w32(ADDR_PRESET0 + 0x08u, 15u); w32(ADDR_PRESET0 + 0x14u, 2u); w32(ADDR_PRESET0 + 0x18u, 25u);
    w8(ADDR_OBJECTS_TXT + 5u * 0x1C0u + 0x167u, 0x40u);
    w32(ADDR_LEVEL_DEFS + 2u * 0x9Cu + 0x90u, (k == 0) ? 0u : 1u);
    uint32_t pt = (k == 2) ? 0x0Du : 1u;
    CALL_GUARDED(call_eax_ecx_edx_s2(0x6FD6A130u, ADDR_OUT0, ADDR_DRLG, 2u, pt, ADDR_OUT1), ret, exc);
    emit_vec_hdr(f, "0x6FD6A130", "DRLG_FindLevelSpawnRoom", k == 0 ? "no_wp_flag" : (k == 1 ? "portal_1" : "portal_13"), ADDR_OUT0, ADDR_DRLG, 2u, pt);
    emit_vec_end(f, ret, exc, r32(ADDR_OUT0), r32(ADDR_OUT1), 0u, 0u);
  }

  /* 15. 0x6FD71300 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    w32(ADDR_UNIT0 + 0x60u, (k == 0) ? 0u : ADDR_INV0);
    w32(ADDR_ITEM0 + 0x00u, 4u);
    w32(ADDR_ITEM0 + 0x04u, (k == 2) ? 99u : 1u);
    w32(ADDR_ITEMS_TXT + 1u * 0x1A8u + 0x80u, 0x206B6362u);
    w32(ADDR_ITEMS_TXT + 1u * 0x1A8u + 0x90u, 0x206B6362u);
    memset((void *)(uintptr_t)ADDR_OUT_COMP, 0, 16);
    memset((void *)(uintptr_t)ADDR_OUT_COLOR, 0, 16);
    CALL_GUARDED(((std4_t)0x6FD71300u)(ADDR_UNIT0, ADDR_OUT_COMP, ADDR_OUT_COLOR, ADDR_ITEM0), ret, exc);
    emit_vec_hdr(f, "0x6FD71300", "INVENTORY_UpdateItemBodyLocGfx", k == 0 ? "null_inv" : (k == 1 ? "valid_item" : "assert_oob"), ADDR_UNIT0, ADDR_OUT_COMP, ADDR_OUT_COLOR, ADDR_ITEM0);
    emit_vec_end(f, ret, exc, r32(ADDR_OUT_COMP), r32(ADDR_OUT_COLOR), 0u, 0u);
  }

  /* 16. 0x6FD71420 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    w32(ADDR_UNIT0 + 0x60u, (k == 0) ? 0u : ADDR_INV0);
    w32(ADDR_INV0 + 0x00u, (k == 0) ? 0u : 0x01020304u);
    w32(ADDR_INV0 + 0x0Cu, (k == 1) ? 0u : ADDR_ITEM0);
    w32(ADDR_ITEM0 + 0x00u, 4u); w32(ADDR_ITEM0 + 0x04u, 1u); w32(ADDR_ITEM0 + 0x10u, 1u);
    w32(ADDR_ITEM0 + 0x14u, ADDR_ITEMDATA0);
    w8(ADDR_ITEMDATA0 + 0x44u, 1u);
    w32(ADDR_ITEMS_TXT + 1u * 0x1A8u + 0x80u, 0x2074696Cu);
    w32(ADDR_ITEMS_TXT + 1u * 0x1A8u + 0x90u, 0x2074696Cu);
    w8(ADDR_ITEMS_TXT + 1u * 0x1A8u + 0x115u, 2u);
    w16(ADDR_ITEMS_TXT + 1u * 0x1A8u + 0x11Eu, 0xFFFFu);
    memset((void *)(uintptr_t)ADDR_OUT_COMP, 0, 16);
    memset((void *)(uintptr_t)ADDR_OUT_COLOR, 0, 16);
    CALL_GUARDED(((std3_t)0x6FD71420u)(ADDR_UNIT0, ADDR_OUT_COMP, ADDR_OUT_COLOR), ret, exc);
    emit_vec_hdr(f, "0x6FD71420", "INVENTORY_UpdateEquippedGfxAndColor", k == 0 ? "null_inv" : (k == 1 ? "empty_inv" : "one_item"), ADDR_UNIT0, ADDR_OUT_COMP, ADDR_OUT_COLOR, 0u);
    emit_vec_end(f, ret, exc, r32(ADDR_OUT_COMP), r32(ADDR_OUT_COLOR), 0u, 0u);
  }

  /* 17. 0x6FD7C630 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    w32(ADDR_UNIT0 + 0x00u, 0u);
    w32(ADDR_UNIT0 + 0x08u, 0u);
    w32(ADDR_UNIT0 + 0x5Cu, ADDR_SLISTEX);
    w32(ADDR_SLISTEX + 0x10u, 0x80000000u);
    w32(ADDR_ITEM0 + 0x00u, 4u);
    w32(ADDR_ITEM0 + 0x0Cu, 42u);
    w32(ADDR_ITEM0 + 0x14u, ADDR_ITEMDATA0);
    w32(ADDR_ITEMDATA0 + 0x00u, (k == 0) ? 1u : 5u); /* dwQuality: 1=normal, 5=set */
    w16(ADDR_SETITEMS_TXT + 0x2Cu, 1u);
    w32(ADDR_SETS_TXT + 0x10u, 1u);
    uint32_t mode = (k == 0) ? 1u : (k == 1 ? 0u : 2u);
    CALL_GUARDED(call_eax_s2(0x6FD7C630u, ADDR_UNIT0, ADDR_ITEM0, mode), ret, exc);
    emit_vec_hdr(f, "0x6FD7C630", "ITEMMODS_ToggleSetItemStateList", k == 0 ? "not_set" : (k == 1 ? "add_set" : "bad_mode"), ADDR_UNIT0, ADDR_ITEM0, mode, 0u);
    emit_vec_end(f, ret, exc, r32(ADDR_SLISTEX + 0x3Cu) != 0 ? 1u : 0u, 0u, 0u, 0u);
  }

  /* 18. 0x6FD7C910 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    w32(ADDR_UNIT0 + 0x00u, 0u);
    w32(ADDR_UNIT0 + 0x60u, (k == 1) ? 0u : ADDR_INV0);
    w32(ADDR_ITEM0 + 0x00u, 4u);
    w32(ADDR_ITEM0 + 0x14u, (k == 1) ? 0u : ADDR_ITEMDATA0);
    w32(ADDR_ITEMDATA0 + 0x00u, 1u);
    uint32_t u = (k == 0) ? 0u : ADDR_UNIT0;
    CALL_GUARDED(((std4_t)0x6FD7C910u)(u, ADDR_ITEM0, 1u, 0u), ret, exc);
    emit_vec_hdr(f, "0x6FD7C910", "ITEMMODS_UpdateSetItemEquipmentState", k == 0 ? "null_unit" : (k == 1 ? "null_inv" : "mode1_nonset"), u, ADDR_ITEM0, 1u, 0u);
    emit_vec_end(f, ret, exc, 0u, 0u, 0u, 0u);
  }
}

static void emit_i14b2(FILE *f) {
  uint32_t ret = 0, exc = 0;

  /* 19. 0x6FD7D890 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    w8(ADDR_DRLG + 0x450u, (uint8_t)k);
    w32(ADDR_DRLG + 0x47Cu, ADDR_LVL1);
    w32(ADDR_LVL0 + 0x1D0u, 2u);
    w32(ADDR_LVL1 + 0x1D0u, 1u);
    w32(ADDR_LVL1 + 0x1Cu, 50u); w32(ADDR_LVL1 + 0x20u, 60u);
    w32(ADDR_LEVEL_DEFS + 2u * 0x9Cu + 0x0Cu + (uint32_t)k * 4u, 32u + (uint32_t)k * 8u);
    w32(ADDR_LEVEL_DEFS + 2u * 0x9Cu + 0x18u + (uint32_t)k * 4u, 40u + (uint32_t)k * 8u);
    w32(ADDR_LEVEL_DEFS + 2u * 0x9Cu + 0x24u, 10u);
    w32(ADDR_LEVEL_DEFS + 2u * 0x9Cu + 0x28u, 20u);
    w32(ADDR_LEVEL_DEFS + 2u * 0x9Cu + 0x2Cu, (k == 0) ? 0u : 1u);
    CALL_GUARDED(call_edi_ebx(0x6FD7D890u, ADDR_LVL0, ADDR_DRLG), ret, exc);
    emit_vec_hdr(f, "0x6FD7D890", "DRLG_InitLevelCoordsFromLevelsTxt", k == 0 ? "no_depend" : (k == 1 ? "dep_nm" : "dep_hell"), ADDR_LVL0, ADDR_DRLG, (uint32_t)k, 0u);
    emit_vec_end(f, ret, exc, r32(ADDR_LVL0 + 0x1Cu), r32(ADDR_LVL0 + 0x20u), r32(ADDR_LVL0 + 0x24u), r32(ADDR_LVL0 + 0x28u));
  }

  /* 20. 0x6FD7D9B0 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    uint32_t dt[3] = {0u, 3u, 1u};
    w32(ADDR_LEVEL_DEFS + 2u * 0x9Cu + 0x30u, dt[k]);
    w32(ADDR_LEVEL_DEFS + 2u * 0x9Cu + 0x34u, 5u);
    w32(ADDR_DRLG + 0x8Cu, (uint32_t)k & 1u);
    w32(ADDR_DRLG + 0x470u, 0x100u);
    CALL_GUARDED(((fast2_t)0x6FD7D9B0u)(ADDR_DRLG, 2u), ret, exc);
    emit_vec_hdr(f, "0x6FD7D9B0", "DRLG_AllocAndInitLevel", k == 0 ? "type0" : (k == 1 ? "type3_outdoors" : "type1_maze"), ADDR_DRLG, 2u, dt[k], 0u);
    emit_vec_end(f, ret ? r32(ret) : 0u, exc, ret ? r32(ret + 4u) : 0u, ret ? r32(ret + 0x1C0u) : 0u, ret ? r32(ret + 0x1C4u) : 0u, r32(ADDR_DRLG + 0x47Cu) != 0 ? 1u : 0u);
  }

  /* 21. 0x6FD7DAF0 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    setup_outdoors_basic(2u, 2u, 4, 4);
    w32(ADDR_LVL0 + 0x00u, (k == 0) ? 0u : (k == 1 ? 1u : 2u));
    if (k == 0) {
      w32(ADDR_LVL0 + 0x14u, 0u);
    } else if (k == 1) {
      w32(ADDR_LVL0 + 0x14u, ADDR_OUTDOORS);
    } else {
      uint32_t pPreset = fog_alloc_zero(8u);
      w32(pPreset, 99u);
      w32(ADDR_LVL0 + 0x14u, pPreset);
    }
    w32(ADDR_LVL0 + 0x1D8u, (uint32_t)(k + 1));
    CALL_GUARDED(call_esi_s2(0x6FD7DAF0u, ADDR_LVL0, 0u, (uint32_t)(k & 1)), ret, exc);
    emit_vec_hdr(f, "0x6FD7DAF0", "DRLG_FreeLevelData", k == 0 ? "type0_free" : (k == 1 ? "type1_keep" : "type2_free"), ADDR_LVL0, 0u, (uint32_t)(k & 1), 0u);
    emit_vec_end(f, ret, exc, r32(ADDR_LVL0 + 0x14u), r32(ADDR_LVL0 + 0x1D8u), 0u, 0u);
  }

  /* 22. 0x6FD7DD80 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    w32(ADDR_DRLG + 0x47Cu, (k == 0) ? 0u : ADDR_LVL0);
    w32(ADDR_LVL0 + 0x1D0u, 2u); w32(ADDR_LVL0 + 0x1ACu, ADDR_LVL1);
    w32(ADDR_LVL1 + 0x1D0u, 5u);
    uint32_t lid = (k == 2) ? 5u : 2u;
    CALL_GUARDED(((std2_t)0x6FD7DD80u)(ADDR_DRLG, lid), ret, exc);
    emit_vec_hdr(f, "0x6FD7DD80", "DRLG_GetLevel", k == 0 ? "alloc_new" : (k == 1 ? "find_head" : "find_next"), ADDR_DRLG, lid, 0u, 0u);
    emit_vec_end(f, ret ? r32(ret + 0x1D0u) : 0u, exc, r32(ADDR_DRLG + 0x47Cu) != 0 ? 1u : 0u, 0u, 0u, 0u);
  }

  /* 23. 0x6FD7DDB0 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    setup_outdoors_basic(2u, 2u, 4, 4);
    w32(ADDR_LVL0 + 0x10u, (k == 0) ? 0u : ADDR_RX0);
    w8(ADDR_RX0 + 0x44u, (k == 1) ? 2u : 4u);
    w32(ADDR_RX0 + 0x28u, (k == 2) ? 0x100000u : 0u);
    CALL_GUARDED(((std1_t)0x6FD7DDB0u)(ADDR_LVL0), ret, exc);
    emit_vec_hdr(f, "0x6FD7DDB0", "DRLG_TryDeactivateLevelRooms", k == 0 ? "empty_ok" : (k == 1 ? "active_status2" : "flag_100000"), ADDR_LVL0, (uint32_t)k, 0u, 0u);
    emit_vec_end(f, ret, exc, 0u, 0u, 0u, 0u);
  }

  /* 24. 0x6FD7DF80 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    w32(ADDR_DRLG + 0x47Cu, ADDR_LVL0);
    w32(ADDR_LVL0 + 0x1B4u, ADDR_DRLG);
    w32(ADDR_LVL0 + 0x1D0u, 2u);
    w32(ADDR_LVL0 + 0x0Cu, (k == 0) ? 0u : 3u);
    uint32_t delta = (k == 0) ? 0xFFFFFFFFu : (k == 1 ? 2u : 0xFFFFFFFEu);
    CALL_GUARDED(call_esi_s1(0x6FD7DF80u, ADDR_LVL0, delta), ret, exc);
    emit_vec_hdr(f, "0x6FD7DF80", "DRLG_UpdateLevelActiveCount", k == 0 ? "clamp_zero" : (k == 1 ? "inc_2" : "dec_2"), ADDR_LVL0, delta, 0u, 0u);
    emit_vec_end(f, ret, exc, r32(ADDR_LVL0 + 0x0Cu), r32(ADDR_LVL0 + 0x1D4u), 0u, 0u);
  }

  /* 25. 0x6FD7E1A0 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    w32(ADDR_DRLG + 0x47Cu, ADDR_LVL0);
    w32(ADDR_LVL0 + 0x1D0u, 2u);
    w32(ADDR_LVL0 + 0x10u, (k == 0) ? 0u : ADDR_RX0);
    w32(ADDR_RX0 + 0x28u, (k == 1) ? 0x800000u : 0u);
    w32(ADDR_RX0 + 0x24u, (k == 2) ? ADDR_RX1 : 0u);
    w32(ADDR_RX1 + 0x28u, 0u);
    CALL_GUARDED(((fast2_t)0x6FD7E1A0u)(ADDR_DRLG, 2u), ret, exc);
    emit_vec_hdr(f, "0x6FD7E1A0", "DRLG_CountNonPresetRoomsInLevel", k == 0 ? "zero_rooms" : (k == 1 ? "preset_skipped" : "two_rooms"), ADDR_DRLG, 2u, 0u, 0u);
    emit_vec_end(f, ret, exc, 0u, 0u, 0u, 0u);
  }

  /* 26. 0x6FD7E2C0 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    w32(ADDR_DRLG + 0x47Cu, ADDR_LVL0);
    w32(ADDR_LVL0 + 0x1B4u, ADDR_DRLG);
    w32(ADDR_LVL0 + 0x1D0u, 2u);
    w32(ADDR_LVL0 + 0x0Cu, (k == 0) ? 1u : 0u);
    w32(ADDR_LVL0 + 0x1D4u, (k == 1) ? 5u : 0u);
    if (k == 2) {
      uint32_t rx = fog_alloc_zero(0xF0u);
      w32(rx + 0x58u, ADDR_LVL0);
      w8(rx + 0x44u, 4u);
      w32(ADDR_LVL0 + 0x10u, rx);
    } else {
      w32(ADDR_RX0 + 0x58u, ADDR_LVL0);
      w8(ADDR_RX0 + 0x44u, 4u);
      w32(ADDR_LVL0 + 0x10u, ADDR_RX0);
    }
    CALL_GUARDED(call_eax(0x6FD7E2C0u, ADDR_DRLG), ret, exc);
    emit_vec_hdr(f, "0x6FD7E2C0", "DRLG_UpdateInactiveLevels", k == 0 ? "active_skip" : (k == 1 ? "tick_timer" : "expire_free"), ADDR_DRLG, 0u, 0u, 0u);
    emit_vec_end(f, ret, exc, r32(ADDR_LVL0 + 0x1D4u), r32(ADDR_LVL0 + 0x10u), 0u, 0u);
  }

  /* 27. 0x6FD7E360 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    w32(ADDR_DRLG + 0x470u, 0x5555u + (uint32_t)k * 0x1111u);
    w32(ADDR_LVL0 + 0x1B4u, ADDR_DRLG);
    w32(ADDR_LVL0 + 0x1D0u, 2u);
    w32(ADDR_LVL0 + 0x00u, (k == 0) ? 0u : (k == 1 ? 4u : 9u));
    CALL_GUARDED(((std1_t)0x6FD7E360u)(ADDR_LVL0), ret, exc);
    emit_vec_hdr(f, "0x6FD7E360", "DRLG_InitLevelRooms", k == 0 ? "type0" : (k == 1 ? "type4" : "type9"), ADDR_LVL0, 0u, 0u, 0u);
    emit_vec_end(f, ret, exc, r32(ADDR_LVL0 + 0x1C4u), r32(ADDR_LVL0 + 0x1C8u), 0u, 0u);
  }

  /* 28. 0x6FD7E3E0 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    uint32_t act_nos[3] = {3u, 4u, 5u};
    uint32_t seeds[3] = {0x1234u, 0x2345u, 0x3456u};
    CALL_GUARDED(((fast10_t)0x6FD7E3E0u)(ADDR_ACT, act_nos[k], 0u, seeds[k], 0u, (uint32_t)(k & 1), 0u, 0u, 0u, 0u), ret, exc);
    emit_vec_hdr(f, "0x6FD7E3E0", "DRLG_AllocAndInitDrlg", k == 0 ? "act3" : (k == 1 ? "act4" : "act5"), ADDR_ACT, act_nos[k], seeds[k], (uint32_t)(k & 1));
    emit_vec_end(f, ret ? r32(ret) : 0u, exc, ret ? r32(ret + 0x470u) : 0u, ret ? r8(ret + 0x480u) : 0u, (ret && r32(ret + 0x47Cu)) ? 1u : 0u, 0u);
  }

  /* 29. 0x6FD7E5C0 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    w32(ADDR_RX0 + 0x34u, 10u); w32(ADDR_RX0 + 0x38u, 20u); w32(ADDR_RX0 + 0x3Cu, 8u); w32(ADDR_RX0 + 0x40u, 8u);
    w32(ADDR_RX0 + 0x2Cu, 1u); w32(ADDR_RX0 + 0x08u, ADDR_NEAR_ARR);
    w32(ADDR_NEAR_ARR, ADDR_RX1);
    w32(ADDR_RX1 + 0x34u, 18u); w32(ADDR_RX1 + 0x38u, 20u); w32(ADDR_RX1 + 0x3Cu, 8u); w32(ADDR_RX1 + 0x40u, 8u);
    w32(ADDR_LVL0 + 0x10u, ADDR_RX0);
    w32(ADDR_RX0 + 0x24u, ADDR_RX1);
    uint32_t qx[3] = {12u, 20u, 999u};
    CALL_GUARDED(call_eax_s4(0x6FD7E5C0u, ADDR_RX0, qx[k], 22u, ADDR_DRLG, ADDR_LVL0), ret, exc);
    emit_vec_hdr(f, "0x6FD7E5C0", "DRLG_FindRoomExAtCoords", k == 0 ? "in_self" : (k == 1 ? "in_near" : "miss"), ADDR_RX0, qx[k], 22u, ADDR_LVL0);
    emit_vec_end(f, ret ? r32(ret + 0x34u) : 0u, exc, 0u, 0u, 0u, 0u);
  }

  /* 30. 0x6FD81680 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    uint32_t cids[3] = {0xF3u, 0x167u, 0x136u};
    w32(ADDR_UNIT0 + 0x00u, 1u);
    w32(ADDR_UNIT0 + 0x04u, cids[k]);
    CALL_GUARDED(call_eax(0x6FD81680u, ADDR_UNIT0), ret, exc);
    emit_vec_hdr(f, "0x6FD81680", "UNITS_IsMonsterShieldEquipped", k == 0 ? "cid_243" : (k == 1 ? "cid_359" : "cid_310"), ADDR_UNIT0, cids[k], 0u, 0u);
    emit_vec_end(f, ret, exc, 0u, 0u, 0u, 0u);
  }

  /* 31. 0x6FD81D20 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    w32(ADDR_UNIT0 + 0x00u, (k == 0) ? 2u : (k == 1 ? 0u : 1u));
    w32(ADDR_UNIT0 + 0x04u, (k == 2) ? 0xF3u : 0u);
    w32(ADDR_UNIT0 + 0x60u, ADDR_INV0);
    w32(ADDR_UNIT0 + 0x5Cu, ADDR_SLISTEX);
    w32(ADDR_SLISTEX + 0x24u, ADDR_STATS0);
    w16(ADDR_SLISTEX + 0x28u, 1u);
    w32(ADDR_STATS0 + 0x00u, 0x140000u);
    w32(ADDR_STATS0 + 0x04u, 25u);
    w8(ADDR_CHARSTATS_TXT + 0x49u, 15u);
    CALL_GUARDED(((std2_t)0x6FD81D20u)(ADDR_UNIT0, 0u), ret, exc);
    emit_vec_hdr(f, "0x6FD81D20", "UNITS_GetBlockChance", k == 0 ? "obj_0" : (k == 1 ? "plr_no_shield" : "mon_cid243"), ADDR_UNIT0, 0u, 0u, 0u);
    emit_vec_end(f, ret, exc, 0u, 0u, 0u, 0u);
  }

  /* 32. 0x6FD8C7E0 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    w32(ADDR_ACT + 0x48u, ADDR_DRLG);
    w32(ADDR_DRLG + 0x47Cu, ADDR_LVL0);
    w32(ADDR_LVL0 + 0x1D0u, 2u);
    w32(ADDR_LVL0 + 0x10u, (k == 0) ? 0u : ADDR_RX0);
    w32(ADDR_RX0 + 0x28u, (k == 1) ? 0x800000u : 0u);
    CALL_GUARDED(((std2_t)0x6FD8C7E0u)(ADDR_ACT, 2u), ret, exc);
    emit_vec_hdr(f, "0x6FD8C7E0", "DUNGEON_CountNonPresetRoomsInLevel", k == 0 ? "zero" : (k == 1 ? "preset" : "one"), ADDR_ACT, 2u, 0u, 0u);
    emit_vec_end(f, ret, exc, 0u, 0u, 0u, 0u);
  }

  /* 33. 0x6FD8C800 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    w32(ADDR_ACT + 0x48u, ADDR_DRLG);
    w32(ADDR_DRLG + 0x47Cu, ADDR_LVL0);
    w32(ADDR_LVL0 + 0x0Cu, (k == 0) ? 1u : 0u);
    w32(ADDR_LVL0 + 0x10u, ADDR_RX0);
    w32(ADDR_LVL0 + 0x1D4u, (uint32_t)k * 3u);
    CALL_GUARDED(((std1_t)0x6FD8C800u)(ADDR_ACT), ret, exc);
    emit_vec_hdr(f, "0x6FD8C800", "DUNGEON_UpdateInactiveLevels", k == 0 ? "active" : (k == 1 ? "timer3" : "timer6"), ADDR_ACT, (uint32_t)k, 0u, 0u);
    emit_vec_end(f, ret, exc, r32(ADDR_LVL0 + 0x1D4u), 0u, 0u, 0u);
  }

  /* 34. 0x6FD8C810 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    w32(ADDR_DRLG + 0x47Cu, ADDR_LVL0);
    w32(ADDR_LVL0 + 0x1B4u, ADDR_DRLG); w32(ADDR_LVL0 + 0x1D0u, 2u); w32(ADDR_LVL0 + 0x0Cu, 2u);
    w32(ADDR_LVL0 + 0x1ACu, ADDR_LVL1);
    w32(ADDR_LVL1 + 0x1B4u, ADDR_DRLG); w32(ADDR_LVL1 + 0x1D0u, 3u); w32(ADDR_LVL1 + 0x0Cu, 0u);
    w32(ADDR_ROOM0 + 0x10u, ADDR_RX0); w32(ADDR_RX0 + 0x58u, ADDR_LVL0);
    w32(ADDR_ROOM1 + 0x10u, ADDR_RX1); w32(ADDR_RX1 + 0x58u, (k == 0) ? ADDR_LVL0 : ADDR_LVL1);
    uint32_t rnew = (k == 2) ? 0u : ADDR_ROOM1;
    CALL_GUARDED(((std2_t)0x6FD8C810u)(ADDR_ROOM0, rnew), ret, exc);
    emit_vec_hdr(f, "0x6FD8C810", "DUNGEON_UpdateRoomLevelChange", k == 0 ? "same_lvl" : (k == 1 ? "move_lvl" : "leave_null"), ADDR_ROOM0, rnew, 0u, 0u);
    emit_vec_end(f, ret, exc, r32(ADDR_LVL0 + 0x0Cu), r32(ADDR_LVL1 + 0x0Cu), r32(ADDR_LVL0 + 0x1D4u), r32(ADDR_LVL1 + 0x1D4u));
  }

  /* 35. 0x6FD8CA20 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    w32(ADDR_RX0 + 0x58u, ADDR_LVL0);
    w32(ADDR_LVL0 + 0x1B4u, ADDR_DRLG);
    uint32_t rm = 0u;
    if (k == 1) {
      rm = ADDR_ROOM0;
      w32(ADDR_ACT + 0x10u, 0u);
    } else if (k == 2) {
      rm = fog_alloc_zero(0x80u);
      w32(rm + 0x10u, ADDR_RX0);
      w32(rm + 0x2Cu, ADDR_ACT);
      w32(rm + 0x34u, 1u);
      w32(ADDR_RX0 + 0x30u, rm);
      w32(ADDR_ACT + 0x10u, rm);
    } else {
      w32(ADDR_ACT + 0x10u, ADDR_ROOM0);
    }
    CALL_GUARDED(((std2_t)0x6FD8CA20u)(ADDR_ACT, rm), ret, exc);
    emit_vec_hdr(f, "0x6FD8CA20", "DUNGEON_FreeActiveRoom", k == 0 ? "assert_null" : (k == 1 ? "assert_not_in_act" : "free_ok"), ADDR_ACT, (uint32_t)k, 0u, 0u);
    emit_vec_end(f, ret, exc, r32(ADDR_ACT + 0x10u), r32(ADDR_RX0 + 0x60u), r32(ADDR_RX0 + 0x30u), 0u);
  }

  /* 36. 0x6FD8CB30 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    uint32_t act_nos[3] = {3u, 4u, 5u};
    uint32_t flgs[3] = {0u, 1u, 2u};
    uint32_t towns[3] = {0u, 0u, 0u};
    CALL_GUARDED(((std9_t)0x6FD8CB30u)(act_nos[k], 0x1234u + (uint32_t)k, flgs[k], 0u, 0u, 0u, towns[k], 0u, 0u), ret, exc);
    emit_vec_hdr(f, "0x6FD8CB30", "DUNGEON_AllocAct", k == 0 ? "act3_flags0" : (k == 1 ? "act4_flags1" : "act5_flags2"), act_nos[k], 0x1234u + (uint32_t)k, flgs[k], towns[k]);
    emit_vec_end(f, ret ? r8(ret + 0x14u) : 0u, exc, ret ? r32(ret + 0x0Cu) : 0u, ret ? r32(ret + 0x50u) : 0u, ret ? r32(ret + 0x08u) : 0u, (ret && r32(ret + 0x48u)) ? 1u : 0u);
  }

  /* 37. 0x6FD8CC40 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    w32(ADDR_RX0 + 0x58u, ADDR_LVL0);
    w32(ADDR_LVL0 + 0x1B4u, ADDR_DRLG);
    w32(ADDR_ROOM0 + 0x10u, ADDR_RX0);
    w32(ADDR_ROOM1 + 0x10u, (k == 0) ? ADDR_RX0 : 0u);
    w16(ADDR_RX0 + 0x0Cu, (k == 1) ? 0u : 2u);
    CALL_GUARDED(((std2_t)0x6FD8CC40u)(ADDR_ROOM0, (k == 2) ? 0u : ADDR_ROOM1), ret, exc);
    emit_vec_hdr(f, "0x6FD8CC40", "DUNGEON_SyncActiveRoomStatusChange", k == 0 ? "same_rx" : (k == 1 ? "old_zero_cnt" : "old_dec"), ADDR_ROOM0, (k == 2) ? 0u : ADDR_ROOM1, 0u, 0u);
    emit_vec_end(f, ret, exc, r16(ADDR_RX0 + 0x0Cu), 0u, 0u, 0u);
  }
}

static void emit_i14b3(FILE *f) {
  uint32_t ret = 0, exc = 0;

  /* 38. 0x6FD8CD00 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    w32(ADDR_ROOM0 + 0x10u, ADDR_RX0);
    if (k >= 1) {
      w32(ADDR_RX0 + 0x4Cu, ADDR_TILE0);
      w32(ADDR_TILE0, ADDR_RX1);
      w32(ADDR_TILE0 + 0x10u, ADDR_V0);
      w32(ADDR_V0, 77u);
      w32(ADDR_RX1 + 0x28u, 0x03100000u);
      w32(ADDR_RX1 + 0x4Cu, ADDR_TILE0 + 0x20u);
      w32(ADDR_TILE0 + 0x20u, ADDR_RX0);
      w32(ADDR_TILE0 + 0x30u, ADDR_V1);
      w32(ADDR_V1, 88u);
      w32(ADDR_RX1 + 0x30u, ADDR_ROOM1);
      if (k == 2) {
        w32(ADDR_ROOM1 + 0x74u, ADDR_UNIT0);
        w32(ADDR_UNIT0 + 0x00u, 5u); w32(ADDR_UNIT0 + 0x04u, 88u);
      }
    }
    uint32_t rm = (k == 0) ? 0u : ADDR_ROOM0;
    CALL_GUARDED(((std3_t)0x6FD8CD00u)(rm, 77u, ADDR_OUT0), ret, exc);
    emit_vec_hdr(f, "0x6FD8CD00", "DUNGEON_FindWarpPortalUnitInTargetLevel", k == 0 ? "assert_null" : (k == 1 ? "no_unit" : "found"), rm, 77u, ADDR_OUT0, 0u);
    emit_vec_end(f, ret, exc, r32(ADDR_OUT0), 0u, 0u, 0u);
  }

  /* 39. 0x6FD8CDA0 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    w32(ADDR_ACT + 0x48u, ADDR_DRLG);
    w32(ADDR_DRLG + 0x47Cu, ADDR_LVL0);
    w32(ADDR_LVL0 + 0x10u, ADDR_RX0);
    w32(ADDR_RX0 + 0x28u, 0x03100000u);
    w32(ADDR_RX0 + 0x34u, 10u); w32(ADDR_RX0 + 0x38u, 20u); w32(ADDR_RX0 + 0x3Cu, 8u); w32(ADDR_RX0 + 0x40u, 8u);
    w32(ADDR_RX0 + 0x30u, ADDR_ROOM0);
    uint32_t act = (k == 0) ? 0u : ADDR_ACT;
    uint32_t x = (k == 1) ? 12u : 999u;
    CALL_GUARDED(((std3_t)0x6FD8CDA0u)(act, x, 22u), ret, exc);
    emit_vec_hdr(f, "0x6FD8CDA0", "DUNGEON_FindRoomBySubtileCoords", k == 0 ? "assert_null" : (k == 1 ? "found" : "miss"), act, x, 22u, 0u);
    emit_vec_end(f, ret, exc, 0u, 0u, 0u, 0u);
  }

  /* 40. 0x6FD8CDF0 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    setup_outdoors_basic(2u, 2u, 6, 6);
    w32(ADDR_ACT + 0x48u, ADDR_DRLG);
    w32(ADDR_LVL0 + 0x10u, ADDR_RX0);
    w32(ADDR_RX0 + 0x28u, 0x03100000u);
    w32(ADDR_RX0 + 0x30u, ADDR_ROOM0);
    w32(ADDR_RX0 + 0x34u, 10u); w32(ADDR_RX0 + 0x38u, 15u); w32(ADDR_RX0 + 0x3Cu, 10u); w32(ADDR_RX0 + 0x40u, 10u);
    w32(ADDR_ROOM0 + 0x00u, ADDR_NEAR_ARR);
    w32(ADDR_ROOM0 + 0x24u, 1u);
    w32(ADDR_NEAR_ARR + 0x00u, ADDR_ROOM0);
    w32(ADDR_ROOM0 + 0x20u, ADDR_OUT_COMP);
    w32(ADDR_ROOM0 + 0x4Cu, 50u); w32(ADDR_ROOM0 + 0x50u, 50u);
    w32(ADDR_ROOM0 + 0x54u, 100u); w32(ADDR_ROOM0 + 0x58u, 100u);
    w32(ADDR_OUT_COMP + 0x00u, 50u); w32(ADDR_OUT_COMP + 0x04u, 50u);
    w32(ADDR_OUT_COMP + 0x08u, 100u); w32(ADDR_OUT_COMP + 0x0Cu, 100u);
    w32(ADDR_OUT_COMP + 0x10u, 50u); w32(ADDR_OUT_COMP + 0x14u, 50u);
    w32(ADDR_OUT_COMP + 0x18u, 100u); w32(ADDR_OUT_COMP + 0x1Cu, 100u);
    w32(ADDR_OUT_COMP + 0x20u, ADDR_COLLMAP_BUF);
    w32(ADDR_OUT_COMP + 0x24u, ADDR_COLLMAP_BUF + 20000u);
    if (k == 2) {
      w16(ADDR_COLLMAP_BUF + ((103u - 50u) * 100u + (78u - 50u)) * 2u, 1u);
    }
    uint32_t act = (k == 0) ? 0u : ADDR_ACT;
    CALL_GUARDED(((std6_t)0x6FD8CDF0u)(act, 2u, 1u, ADDR_OUT0, ADDR_OUT1, 1u), ret, exc);
    emit_vec_hdr(f, "0x6FD8CDF0", "DUNGEON_FindFreeSpawnPositionInLevel", k == 0 ? "assert_null" : (k == 1 ? "center_free" : "center_blocked"), act, 2u, 1u, 1u);
    emit_vec_end(f, ret, exc, r32(ADDR_OUT0), r32(ADDR_OUT1), 0u, 0u);
  }

  /* 41. 0x6FD8CEE0 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    setup_outdoors_basic(2u, 2u, 4, 4);
    w32(ADDR_ACT + 0x48u, ADDR_DRLG);
    w32(ADDR_LVL0 + 0x10u, ADDR_RX0);
    w32(ADDR_RX0 + 0x28u, 0x03110000u);
    w32(ADDR_RX0 + 0x30u, ADDR_ROOM0);
    w32(ADDR_RX0 + 0x34u, 10u); w32(ADDR_RX0 + 0x38u, 20u); w32(ADDR_RX0 + 0x3Cu, 8u); w32(ADDR_RX0 + 0x40u, 8u);
    uint32_t act = (k == 0) ? 0u : ADDR_ACT;
    CALL_GUARDED(((std5_t)0x6FD8CEE0u)(act, 2u, (uint32_t)k, ADDR_OUT0, ADDR_OUT1), ret, exc);
    emit_vec_hdr(f, "0x6FD8CEE0", "DUNGEON_FindLevelSpawnRoom", k == 0 ? "assert_null" : (k == 1 ? "pt1" : "pt2"), act, 2u, (uint32_t)k, 0u);
    emit_vec_end(f, ret ? 1u : 0u, exc, r32(ADDR_OUT0), r32(ADDR_OUT1), 0u, 0u);
  }

  /* 42. 0x6FD8D5A0 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    setup_outdoors_basic(2u, 2u, 4, 4);
    if (k >= 1) {
      w32(ADDR_OUTDOORS + 0x264u, ADDR_ORTH0);
      w32(ADDR_ORTH0 + 0x00u, ADDR_LVL1);
      w32(ADDR_ORTH0 + 0x04u, (uint32_t)(k - 1));
      w32(ADDR_LVL1 + 0x1D0u, (k == 1) ? 1u : 0x1Bu);
      w32(ADDR_LVL1 + 0x1Cu, 200u); w32(ADDR_LVL1 + 0x20u, 300u);
    }
    CALL_GUARDED(((std1_t)0x6FD8D5A0u)(ADDR_LVL0), ret, exc);
    emit_vec_hdr(f, "0x6FD8D5A0", "DRLGVER_CollectOutdoorRoomLinks", k == 0 ? "empty" : (k == 1 ? "lvl1_dir0" : "lvl27"), ADDR_LVL0, (uint32_t)k, 0u, 0u);
    emit_vec_end(f, ret, exc, r32(ADDR_OUTDOORS + 0x260u), r32(ADDR_OUTDOORS + 0x80u), r32(ADDR_OUTDOORS + 0x84u), r8(ADDR_OUTDOORS + 0x88u));
  }

  /* 43. 0x6FD8DB20 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    w32(ADDR_RX0 + 0x20u, ADDR_OUTDOORS);
    w32(ADDR_RX0 + 0x3Cu, (k == 0) ? 0xFFFFFFFEu : 3u);
    w32(ADDR_RX0 + 0x40u, 3u);
    w32(ADDR_OUTDOORS + 0x28u, ADDR_GRID0_CELLS);
    w32(ADDR_OUTDOORS + 0x2Cu, ADDR_GRID0_ROWS);
    w32(ADDR_OUTDOORS + 0x34u, 6u);
    w32(ADDR_OUTDOORS + 0x38u, 6u);
    w32(ADDR_OUTDOORS + 0x3Cu, ADDR_MGRID_CELLS);
    w32(ADDR_OUTDOORS + 0x40u, ADDR_MGRID_ROWS);
    w32(ADDR_OUTDOORS + 0x48u, 6u);
    w32(ADDR_OUTDOORS + 0x4Cu, 6u);
    setup_grid(ADDR_GRID0_CELLS, ADDR_GRID0_ROWS, 6, 6);
    setup_grid(ADDR_MGRID_CELLS, ADDR_MGRID_ROWS, 6, 6);
    if (k == 1) {
      w32(ADDR_MGRID_CELLS + (2u * 6u + 2u) * 4u, 1u);
      w32(ADDR_MGRID_CELLS + (2u * 6u + 1u) * 4u, 1u);
    } else if (k == 2) {
      w32(ADDR_MGRID_CELLS + (2u * 6u + 0u) * 4u, 1u);
      w32(ADDR_MGRID_CELLS + (1u * 6u + 0u) * 4u, 1u);
      w32(ADDR_MGRID_CELLS + (0u * 6u + 0u) * 4u, 1u);
      w32(ADDR_MGRID_CELLS + (2u * 6u + 1u) * 4u, 1u);
      w32(ADDR_MGRID_CELLS + (1u * 6u + 1u) * 4u, 1u);
      w32(ADDR_MGRID_CELLS + (1u * 6u + 2u) * 4u, 1u);
    }
    CALL_GUARDED(((std1_t)0x6FD8DB20u)(ADDR_RX0), ret, exc);
    emit_vec_hdr(f, "0x6FD8DB20", "DRLGVER_ApplyMazeBorderTiles", k == 0 ? "empty" : (k == 1 ? "pair_wall" : "mask79_wall"), ADDR_RX0, (uint32_t)k, 0u, 0u);
    emit_vec_end(f, ret, exc, r32(ADDR_GRID0_CELLS + 0u), r32(ADDR_GRID0_CELLS + (1u * 6u + 1u) * 4u), 0u, 0u);
  }

  /* 44. 0x6FD8DD40 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    setup_outdoors_basic(2u, 2u, 6, 6);
    w32(ADDR_OUTDOORS + 0x260u, (k == 0) ? 0u : (uint32_t)k);
    w32(ADDR_OUTDOORS + 0x80u, 100u); w32(ADDR_OUTDOORS + 0x84u, 200u);
    w32(ADDR_OUTDOORS + 0x94u, 116u); w32(ADDR_OUTDOORS + 0x98u, 216u);
    CALL_GUARDED(((std1_t)0x6FD8DD40u)(ADDR_LVL0), ret, exc);
    emit_vec_hdr(f, "0x6FD8DD40", "DRLGOUTWILD_ResolveOutdoorRoomBridgeTargets", k == 0 ? "zero_rooms" : (k == 1 ? "one_room" : "two_rooms"), ADDR_LVL0, (uint32_t)k, 0u, 0u);
    emit_vec_end(f, ret, exc, r32(ADDR_OUTDOORS + 0x1E8u), r32(ADDR_OUTDOORS + 0x1ECu), r8(ADDR_OUTDOORS + 0x1F0u), 0u);
  }

  /* 45. 0x6FD8E000 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    setup_outdoors_basic(2u, 2u, 6, 6);
    if (k >= 1) {
      w32(ADDR_OUTDOORS + 0x264u, ADDR_ORTH0);
      w32(ADDR_ORTH0 + 0x00u, ADDR_LVL1);
      w32(ADDR_ORTH0 + 0x04u, (uint32_t)(k - 1));
      w32(ADDR_LVL1 + 0x1D0u, 1u);
      w32(ADDR_LVL1 + 0x1Cu, 100u); w32(ADDR_LVL1 + 0x20u, 200u);
    }
    CALL_GUARDED(call_eax(0x6FD8E000u, ADDR_LVL0), ret, exc);
    emit_vec_hdr(f, "0x6FD8E000", "DRLGOUTWILD_BuildOutdoorPathsAndEnv", k == 0 ? "empty" : (k == 1 ? "dir0" : "dir1"), ADDR_LVL0, (uint32_t)k, 0u, 0u);
    emit_vec_end(f, ret, exc, r32(ADDR_OUTDOORS + 0x260u), r32(ADDR_OUTDOORS + 0x68u) != 0 ? 1u : 0u, 0u, 0u);
  }

  /* 46. 0x6FD91AD0 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    uint32_t lid = (k == 0) ? 0x6Eu : (k == 1 ? 0x6Fu : 0x70u);
    setup_outdoors_basic(lid, 30u, 4, 4);
    CALL_GUARDED(call_eax(0x6FD91AD0u, ADDR_LVL0), ret, exc);
    emit_vec_hdr(f, "0x6FD91AD0", "DRLGOUTANIM_BuildAct5PresetContext", k == 0 ? "lvl_110_skip" : (k == 1 ? "lvl_111" : "lvl_112"), ADDR_LVL0, lid, 0u, 0u);
    emit_vec_end(f, ret, exc, 0u, 0u, 0u, 0u);
  }

  /* 47. 0x6FD91CA0 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    uint32_t lid = (k == 0) ? 0x6Eu : (k == 1 ? 0x6Fu : 0x70u);
    if (k == 0) {
      setup_outdoors_basic(lid, 30u, 16, 8);
    } else {
      setup_outdoors_basic(lid, 30u, 4, 4);
      w32(ADDR_V0 + 0x00u, 0u); w32(ADDR_V0 + 0x04u, 0u); w8(ADDR_V0 + 0x08u, 0u); w32(ADDR_V0 + 0x0Cu, 2u); w32(ADDR_V0 + 0x10u, ADDR_V1);
      w32(ADDR_V1 + 0x00u, 2u); w32(ADDR_V1 + 0x04u, 0u); w8(ADDR_V1 + 0x08u, 0u); w32(ADDR_V1 + 0x0Cu, 2u); w32(ADDR_V1 + 0x10u, ADDR_V0);
      w32(ADDR_GRID2_CELLS + (0u * 4u + 0u) * 4u, 1u);
      w32(ADDR_GRID2_CELLS + (0u * 4u + 3u) * 4u, 1u);
      w32(ADDR_GRID2_CELLS + (3u * 4u + 0u) * 4u, 1u);
      w32(ADDR_GRID2_CELLS + (3u * 4u + 3u) * 4u, 1u);
      w32(ADDR_GRID0_CELLS + 2u * 4u, 0x371u);
      w32(ADDR_GRID0_CELLS + 0u, 0x374u);
    }
    CALL_GUARDED(call_eax(0x6FD91CA0u, ADDR_LVL0), ret, exc);
    emit_vec_hdr(f, "0x6FD91CA0", "DRLGOUTANIM_BuildAct5Outdoors", k == 0 ? "lvl_110" : (k == 1 ? "lvl_111" : "lvl_112"), ADDR_LVL0, lid, 0u, 0u);
    emit_vec_end(f, ret, exc, r32(ADDR_GRID0_CELLS + 0u), r32(ADDR_GRID0_CELLS + 2u * 4u), r32(ADDR_GRID2_CELLS + 0u), r32(ADDR_LVL0 + 0x1C4u));
  }

  /* 48. 0x6FD926A0 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    setup_outdoors_basic((k == 0) ? 3u : 2u, 2u, (k == 2) ? 2 : 6, (k == 2) ? 2 : 6);
    if (k == 0) {
      w32(ADDR_GRID1_CELLS + (2u * 6u + 2u) * 4u, 0x10u);
      w32(ADDR_GRID2_CELLS + (2u * 6u + 2u) * 4u, 0x400u);
    }
    CALL_GUARDED(call_eax(0x6FD926A0u, ADDR_LVL0), ret, exc);
    emit_vec_hdr(f, "0x6FD926A0", "DRLGOUTDOORS_PlaceRandomOutdoorShrineOrSpecial", k == 0 ? "lvl3" : (k == 1 ? "lvl2_open" : "lvl2_small"), ADDR_LVL0, (uint32_t)k, 0u, 0u);
    uint32_t marked = 0;
    for (int i = 0; i < 36; i++) if (r32(ADDR_GRID2_CELLS + (uint32_t)i * 4u) & 0x800u) marked++;
    emit_vec_end(f, ret, exc, marked, r32(ADDR_LVL0 + 0x1C4u), 0u, 0u);
  }

  /* 49. 0x6FD92EB0 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    setup_outdoors_basic(2u, 2u, 8, 8);
    if (k == 0) {
      for (int i = 0; i < 64; i++) w32(ADDR_GRID2_CELLS + (uint32_t)i * 4u, 0x800u);
    }
    w32(ADDR_RECT + 0x00u, (k == 2) ? 156u : 100u);
    w32(ADDR_RECT + 0x04u, (k == 2) ? 256u : 200u);
    w32(ADDR_RECT + 0x08u, 8u);
    w32(ADDR_RECT + 0x0Cu, 8u);
    CALL_GUARDED(call_edi_s5(0x6FD92EB0u, ADDR_LVL0, ADDR_RECT, 5u, 0x200u, 0u, 15u), ret, exc);
    uint32_t placed_idx = 0xFFFFFFFFu;
    for (int i = 0; i < 64; i++) {
      if (r32(ADDR_GRID0_CELLS + (uint32_t)i * 4u) == 5u) { placed_idx = (uint32_t)i; break; }
    }
    emit_vec_hdr(f, "0x6FD92EB0", "DRLGOUTDOORS_PlaceClosestOutdoorPresetToRect", k == 0 ? "all_blocked" : (k == 1 ? "rect_near_origin" : "rect_far"), ADDR_LVL0, ADDR_RECT, 5u, (uint32_t)k);
    emit_vec_end(f, ret, exc, placed_idx, r32(ADDR_LVL0 + 0x1C4u), 0u, 0u);
  }

  /* 50. 0x6FD93100 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    setup_outdoors_basic(2u, 2u, 4, 4);
    uint32_t sub_idx = (k == 0) ? 0xFFFFFFFFu : (uint32_t)k;
    CALL_GUARDED(call_eax_s2(0x6FD93100u, ADDR_LVL0, sub_idx, 0x10u), ret, exc);
    emit_vec_hdr(f, "0x6FD93100", "DRLGOUTDOORS_BuildOutdoorSubstContext", k == 0 ? "assert_neg" : (k == 1 ? "sub1" : "sub2"), ADDR_LVL0, sub_idx, 0x10u, 0u);
    emit_vec_end(f, ret, exc, 0u, 0u, 0u, 0u);
  }

  /* 51. 0x6FD93190 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    uint32_t lt[3] = {2u, 16u, 21u};
    setup_outdoors_basic(2u, lt[k], 4 + k, 4 + k);
    for (int i = 0; i < 36; i++) w32(ADDR_GRID2_CELLS + (uint32_t)i * 4u, 0x100u);
    if (k == 2) w32(ADDR_GRID2_CELLS + 0u, 0u);
    CALL_GUARDED(((std1_t)0x6FD93190u)(ADDR_LVL0), ret, exc);
    emit_vec_hdr(f, "0x6FD93190", "DRLGOUTDOORS_BuildOutdoorRoomExList", k == 0 ? "lt2" : (k == 1 ? "lt16" : "lt21"), ADDR_LVL0, lt[k], 0u, 0u);
    uint32_t head_rx = r32(ADDR_LVL0 + 0x10u);
    emit_vec_end(f, ret, exc, head_rx ? 1u : 0u, head_rx ? r32(head_rx + 0x28u) : 0u, 0u, 0u);
  }

  /* 52. 0x6FD93350 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    setup_outdoors_basic(2u, 2u, 6, 6);
    if (k == 0) {
      for (int i = 0; i < 36; i++) w32(ADDR_GRID2_CELLS + (uint32_t)i * 4u, 0x800u);
    } else if (k == 2) {
      for (int i = 0; i < 36; i++) w32(ADDR_GRID2_CELLS + (uint32_t)i * 4u, 0x800u);
      w32(ADDR_GRID2_CELLS + (2u * 6u + 2u) * 4u, 0x880u); /* seed at (px=2, py=2) */
      w32(ADDR_GRID2_CELLS + (2u * 6u + 1u) * 4u, 0u);     /* open ONLY at d=0: (nx=1, ny=2)! */
    }
    CALL_GUARDED(call_eax_s2(0x6FD93350u, ADDR_LVL0, 5u + (uint32_t)k, 0x01u), ret, exc);
    emit_vec_hdr(f, "0x6FD93350", "DRLGOUTDOORS_PlaceRandomOutdoorPresetNearSeed", k == 0 ? "blocked" : (k == 1 ? "fallback_open" : "seed_d0_west"), ADDR_LVL0, 5u + (uint32_t)k, 0x01u, 0u);
    emit_vec_end(f, ret, exc, r32(ADDR_LVL0 + 0x1C4u), r32(ADDR_GRID0_CELLS + (2u * 6u + 1u) * 4u), 0u, 0u);
  }

  /* 53. 0x6FD93580 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    uint32_t lids[3] = {0x11u, 0x6Bu, 0x6Eu};
    uint32_t ltypes[3] = {2u, 27u, 30u};
    setup_outdoors_basic(lids[k], ltypes[k], 8, 8);
    w32(ADDR_OUTDOORS + 0x264u, 0u);
    CALL_GUARDED(call_eax(0x6FD93580u, ADDR_LVL0), ret, exc);
    emit_vec_hdr(f, "0x6FD93580", "DRLGOUTDOORS_InitOutdoorLevel", k == 0 ? "act1_17" : (k == 1 ? "act4_107" : "act5_110"), ADDR_LVL0, lids[k], ltypes[k], 0u);
    emit_vec_end(f, ret, exc, r32(ADDR_OUTDOORS + 0x5Cu), r32(ADDR_OUTDOORS + 0x60u), r32(ADDR_LVL0 + 0x08u), r32(ADDR_LVL0 + 0x1C4u));
  }

  /* 54. 0x6FD952C0 */
  for (int k = 0; k < 3; k++) {
    reset_arena();
    w32(ADDR_RX0 + 0x28u, (k == 2) ? 0x10u : 0u);
    w32(ADDR_RX0 + 0x34u, 10u); w32(ADDR_RX0 + 0x38u, 10u); w32(ADDR_RX0 + 0x3Cu, 8u); w32(ADDR_RX0 + 0x40u, 8u);
    w32(ADDR_RX1 + 0x34u, 18u); w32(ADDR_RX1 + 0x38u, 10u); w32(ADDR_RX1 + 0x3Cu, 8u); w32(ADDR_RX1 + 0x40u, 8u);
    uint32_t list = (k == 0) ? 0u : ADDR_RX0;
    CALL_GUARDED(call_eax_ecx_edx_s3(0x6FD952C0u, list, 0u, ADDR_RX1, 0u, 0u, 0xFFFFFFFFu), ret, exc);
    emit_vec_hdr(f, "0x6FD952C0", "DRLGROOM_LinkAdjacentWarpRooms", k == 0 ? "null_list" : (k == 1 ? "no_bit" : "linked"), list, 0u, ADDR_RX1, 0xFFFFFFFFu);
    emit_vec_end(f, ret, exc, r32(ADDR_RX1 + 0x2Cu), 0u, 0u, 0u);
  }
}

int main(int argc, char **argv) {
  if (argc < 4) return 1;
  HMODULE hFog = LoadLibraryA("Fog.dll");
  HMODULE hD2Cmp = LoadLibraryA("D2CMP.dll");
  HMODULE hD2Lang = LoadLibraryA("D2Lang.dll");
  HMODULE hD2Com = LoadLibraryA("D2Common.dll");
  if (!hFog || !hD2Cmp || !hD2Lang || !hD2Com) {
    fprintf(stderr, "LoadLibrary failed\n");
    return 1;
  }
  g_arena = (uint8_t *)VirtualAlloc((void *)(uintptr_t)ARENA_BASE, ARENA_SIZE, MEM_RESERVE | MEM_COMMIT, PAGE_EXECUTE_READWRITE);
  if (!g_arena) {
    fprintf(stderr, "VirtualAlloc failed\n");
    return 1;
  }
  DWORD oldProt = 0;
  if (!VirtualProtect((void *)0x6FDD9000u, 0x0001A000u, PAGE_EXECUTE_READWRITE, &oldProt)) {
    fprintf(stderr, "VirtualProtect D2Common failed err=%lu\n", GetLastError());
    return 1;
  }
  AddVectoredExceptionHandler(1, veh_handler);
  {
    void *pAssert = (void *)GetProcAddress(hFog, (LPCSTR)10023);
    void *pErr = (void *)GetProcAddress(hFog, (LPCSTR)10024);
    DWORD op = 0;
    if (pAssert && VirtualProtect(pAssert, 16, PAGE_EXECUTE_READWRITE, &op)) *(volatile uint8_t *)pAssert = 0xCCu;
    if (pErr && VirtualProtect(pErr, 16, PAGE_EXECUTE_READWRITE, &op)) *(volatile uint8_t *)pErr = 0xCCu;
  }

  FILE *f1 = fopen(argv[1], "wb");
  FILE *f2 = fopen(argv[2], "wb");
  FILE *f3 = fopen(argv[3], "wb");
  if (!f1 || !f2 || !f3) return 1;

  emit_i14b1(f1);
  emit_i14b2(f2);
  emit_i14b3(f3);

  fclose(f1);
  fclose(f2);
  fclose(f3);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
