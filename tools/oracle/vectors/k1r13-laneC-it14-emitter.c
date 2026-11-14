/*
 * k1r13-laneC-it14-emitter.c
 * Differential oracle vector emitter for D2Common.dll v1.13c — Iteration 14 Lane C (54 VAs).
 * Sub-batches:
 *   I14C-1 (15 VAs): drlg-room(2), items(6), skills(6), monsters(1)
 *   I14C-2 (21 VAs): room-tile(11), drlg-room(10)
 *   I14C-3 (18 VAs): drlg-grid(6), outdoors(4), out-jung(8)
 */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef uint8_t  u8;
typedef uint16_t u16;
typedef uint32_t u32;
typedef int32_t  i32;
typedef uintptr_t usize;

#define EXPECTED_BASE 0x6FD50000u
#define ARENA_ADDR    0x20000000u
#define ARENA_SIZE    (4u * 1024u * 1024u)
#define HEAP_ADDR     0x21000000u
#define HEAP_SIZE     (4u * 1024u * 1024u)

static u8 *g_arena = NULL;
static u32 g_arena_off = 0x100u;
static u8 *g_heap = NULL;
static u32 g_heap_off = 0;

#define MAX_FREES 1024
static u32 g_frees[MAX_FREES];
static int g_num_frees = 0;

typedef struct { u32 addr; u32 size; } HeapRec;
#define MAX_HEAP_RECS 1024
static HeapRec g_heap_recs[MAX_HEAP_RECS];
static int g_num_heap_recs = 0;
static volatile int g_alloc_in_arena = 0;

static u32 heap_alloc(u32 size);
static void track_region(u32 addr, u32 byte_len);

static u32 bump_alloc(u32 size) {
  if (size == 0u) return 0u;
  if (g_alloc_in_arena) {
    u32 p = heap_alloc(size);
    track_region(p, size);
    return p;
  }
  u32 aligned = (g_heap_off + 3u) & ~3u;
  u32 alloc_sz = size;
  if (aligned + alloc_sz > HEAP_SIZE) {
    fprintf(stderr, "HEAP OVERFLOW: %u + %u > %u\n", aligned, alloc_sz, HEAP_SIZE);
    ExitProcess(11);
  }
  u32 p = HEAP_ADDR + aligned;
  memset(g_heap + aligned, 0, alloc_sz);
  g_heap_off = aligned + alloc_sz;
  if (g_num_heap_recs < MAX_HEAP_RECS) {
    g_heap_recs[g_num_heap_recs].addr = p;
    g_heap_recs[g_num_heap_recs].size = alloc_sz;
    g_num_heap_recs++;
  }
  return p;
}

static void record_free(u32 p) {
  if (p == 0u) return;
  if (g_num_frees < MAX_FREES) g_frees[g_num_frees++] = p;
}

static u32 __attribute__((fastcall)) stub_fog_10045(u32 ecx_p, u32 edx_sz, u32 f, u32 ln, u32 z) {
  (void)ecx_p; (void)f; (void)ln; (void)z;
  return bump_alloc(edx_sz);
}

static void __attribute__((fastcall)) stub_fog_10046(u32 ecx_p, u32 edx_ptr, u32 f, u32 ln, u32 z) {
  (void)ecx_p; (void)f; (void)ln; (void)z;
  record_free(edx_ptr);
}

static u32 __attribute__((fastcall)) stub_fog_10042(u32 ecx_sz, u32 edx_file, u32 ln, u32 z) {
  (void)edx_file; (void)ln; (void)z;
  return bump_alloc(ecx_sz);
}

static u32 g_ds1_buf[128] = {
  18u, /* [0] dwVersion */
  2u,  /* [1] dwWidthMinus1 -> w=3 */
  2u,  /* [2] dwHeightMinus1 -> h=3 */
  1u,  /* [3] nAct */
  1u,  /* [4] nTagType -> 1 (sets pDs1+0x48 / +0x4c) */
  0u,  /* [5] nFiles */
  1u,  /* [6] nWalls */
  1u,  /* [7] nFloors */
  /* [8..52] = 45 dwords (9*5: wall, orient, floor, shadow, tags) */
  [53] = 0u, /* nObjects */
  [54] = 0u, /* v18 extra dword */
  [55] = 1u, /* nSubstGroups -> 1 */
  [56] = 0u, /* subst[0].x */
  [57] = 0u, /* subst[0].y */
  [58] = 2u, /* subst[0].w */
  [59] = 2u, /* subst[0].h */
};
static u32 __attribute__((fastcall)) stub_mpq_open(u32 ecx_file, u32 edx_ppHandle) {
  (void)ecx_file;
  if (edx_ppHandle) *(u32 *)(usize)edx_ppHandle = 0x12345678u;
  return 1u;
}
static u32 __attribute__((fastcall)) stub_mpq_close(u32 ecx_h) {
  (void)ecx_h;
  return 1u;
}
static u32 __attribute__((fastcall)) stub_mpq_getsize(u32 ecx_h, u32 edx_pHigh) {
  (void)ecx_h;
  if (edx_pHigh) *(u32 *)(usize)edx_pHigh = 0u;
  return sizeof(g_ds1_buf);
}
static u32 __attribute__((fastcall)) stub_mpq_read(u32 ecx_h, u32 edx_buf, u32 sz, u32 pRead, u32 a, u32 b, u32 c) {
  (void)ecx_h; (void)a; (void)b; (void)c;
  u32 n = sz < sizeof(g_ds1_buf) ? sz : (u32)sizeof(g_ds1_buf);
  memcpy((void *)(usize)edx_buf, g_ds1_buf, n);
  if (pRead) *(u32 *)(usize)pRead = n;
  return 1u;
}
static u32 __attribute__((fastcall)) stub_ctx_cb1(u32 ecx, u32 edx, u32 s1) {
  (void)ecx; (void)edx; (void)s1;
  return 0u;
}

typedef struct {
  u32 addr;
  u32 len;
  u8 *pre;
  u8 *post;
} TrackedBlock;

#define MAX_BLOCKS 1024
static TrackedBlock g_blocks[MAX_BLOCKS];
static int g_num_blocks = 0;

static u32 lookup_alloc_size(u32 ptr, u32 fallback) {
  for (int i = 0; i < g_num_heap_recs; i++) {
    if (g_heap_recs[i].addr == ptr) return g_heap_recs[i].size;
  }
  for (int i = 0; i < g_num_blocks; i++) {
    if (g_blocks[i].addr == ptr) return g_blocks[i].len;
  }
  return fallback;
}

static u32 __attribute__((fastcall)) stub_fog_10047(
  u32 ecx_p, u32 edx_old, u32 new_sz, u32 f, u32 ln, u32 z
) {
  (void)ecx_p; (void)f; (void)ln; (void)z;
  u32 pNew = bump_alloc(new_sz);
  if (edx_old != 0u && pNew != 0u) {
    u32 old_sz = lookup_alloc_size(edx_old, new_sz);
    u32 copy_sz = (old_sz < new_sz) ? old_sz : new_sz;
    memcpy((void *)(usize)pNew, (const void *)(usize)edx_old, copy_sz);
    record_free(edx_old);
  }
  return pNew;
}

static LONG WINAPI crash_filter(EXCEPTION_POINTERS *ep) {
  fprintf(stderr, "CRASH code=0x%08lX eip=0x%08lX addr=0x%08lX esp=0x%08lX\n",
    (unsigned long)ep->ExceptionRecord->ExceptionCode,
    (unsigned long)ep->ContextRecord->Eip,
    (unsigned long)(ep->ExceptionRecord->NumberParameters >= 2 ? ep->ExceptionRecord->ExceptionInformation[1] : 0),
    (unsigned long)ep->ContextRecord->Esp);
  fflush(stderr);
  return EXCEPTION_EXECUTE_HANDLER;
}
static void __attribute__((cdecl)) stub_fog_assert(const char *msg, const char *file, int line) {
  fprintf(stderr, "D2ASSERT: %s (%s:%d)\n", msg ? msg : "", file ? file : "", line);
  fflush(stderr);
  ExitProcess(253);
}
static u32 __attribute__((stdcall)) stub_d2cmp_10036(u32 pTileCache) {
  return (pTileCache != 0u) ? *(const u32 *)(usize)(pTileCache + 0x1Cu) : 0u;
}
static u32 __attribute__((stdcall)) stub_d2cmp_10045(u32 pTileCache) {
  return (pTileCache != 0u) ? *(const u32 *)(usize)(pTileCache + 0x18u) : 0u;
}
static u32 __attribute__((stdcall)) stub_d2cmp_10051(u32 pTileCache) {
  return (pTileCache != 0u) ? (u32)(*(const u16 *)(usize)(pTileCache + 0x06u)) : 0u;
}
static u32 __attribute__((stdcall)) stub_d2cmp_get_rarity(u32 pTile) {
  return (pTile != 0u) ? *(const u32 *)(usize)(pTile + 0x20u) : 0u;
}
static u32 __attribute__((stdcall)) stub_d2cmp_get_tiles(
  u32 ppTileLibraryHash, u32 nOrientation, u32 nStyle, u32 nSeq, u32 pOutArray, u32 nMax
) {
  if (ppTileLibraryHash == 0u || pOutArray == 0u || nMax == 0u) return 0u;
  u32 total = 0u;
  i32 orient = (i32)nOrientation;
  i32 style  = (i32)nStyle;
  i32 seq    = (i32)nSeq;
  u32 bucket = ((((nSeq & 0xFFu) << 1u) - (nOrientation & 0xFFu) + (nStyle & 0xFFu)) & 0x7Fu);
  for (u32 slot = 0u; slot < 32u; slot++) {
    u32 pHash = *(const u32 *)(usize)(ppTileLibraryHash + slot * 4u);
    if (pHash == 0u || total >= nMax) break;
    u32 rem = nMax - total;
    if (rem == 0u) break;
    u32 pNode = *(const u32 *)(usize)(pHash + bucket * 4u);
    while (pNode != 0u) {
      if (*(const i32 *)(usize)(pNode + 0x00u) == style &&
          *(const i32 *)(usize)(pNode + 0x04u) == seq &&
          *(const i32 *)(usize)(pNode + 0x08u) == orient) {
        u32 pBlock = *(const u32 *)(usize)(pNode + 0x0Cu);
        u32 found = 0u;
        while (pBlock != 0u) {
          u32 pEntry = *(const u32 *)(usize)pBlock;
          *(u32 *)(usize)(pOutArray + (total + found) * 4u) = pEntry;
          found++;
          if (found == rem) break;
          pBlock = *(const u32 *)(usize)(pBlock + 0x04u);
        }
        total += found;
        break;
      }
      pNode = *(const u32 *)(usize)(pNode + 0x10u);
    }
  }
  return total;
}

static void reset_heap(void) {
  if (g_arena_off > 0) memset(g_arena, 0, (g_arena_off + 15u) & ~15u);
  if (g_heap_off > 0)  memset(g_heap, 0, (g_heap_off + 3u) & ~3u);
  g_arena_off = 0x100u;
  g_heap_off = 0;
  g_num_frees = 0;
  g_num_heap_recs = 0;
  for (int i = 0; i < g_num_blocks; i++) {
    free(g_blocks[i].pre);
    free(g_blocks[i].post);
  }
  g_num_blocks = 0;
  *(u32 *)(usize)0x6FDF147Cu = 0u;
  *(u32 *)(usize)0x6FDF1480u = 0u;
}

static u32 heap_alloc(u32 size) {
  u32 aligned = (g_arena_off + 15u) & ~15u;
  u32 alloc_sz = (size == 0u) ? 4u : size;
  if (aligned + alloc_sz > ARENA_SIZE) {
    fprintf(stderr, "ARENA OVERFLOW: %u + %u > %u\n", aligned, alloc_sz, ARENA_SIZE);
    ExitProcess(14);
  }
  u32 p = ARENA_ADDR + aligned;
  memset(g_arena + aligned, 0, alloc_sz);
  g_arena_off = aligned + alloc_sz;
  return p;
}

static void track_region(u32 addr, u32 byte_len) {
  if (addr == 0u || byte_len == 0u) return;
  if (g_num_blocks >= MAX_BLOCKS) {
    fprintf(stderr, "MAX_BLOCKS OVERFLOW at 0x%08X\n", addr);
    ExitProcess(15);
  }
  TrackedBlock *b = &g_blocks[g_num_blocks++];
  b->addr = addr;
  b->len  = (byte_len + 3u) & ~3u;
  b->pre  = (u8 *)malloc(b->len);
  b->post = (u8 *)malloc(b->len);
}

static void snapshot_pre(void) {
  for (int i = 0; i < g_num_blocks; i++) {
    memcpy(g_blocks[i].pre, (const void *)(usize)g_blocks[i].addr, g_blocks[i].len);
  }
}

static void snapshot_post(void) {
  for (int i = 0; i < g_num_blocks; i++) {
    memcpy(g_blocks[i].post, (const void *)(usize)g_blocks[i].addr, g_blocks[i].len);
  }
}

static void emit_vector(
  FILE *fp, const char *vaStr, const char *fnName, int case_idx, const char *note,
  const char *argsJson, u32 eax_out, u32 retMask
) {
  int has_ret = (retMask != 0u) ? 1 : 0;
  snapshot_post();
  fprintf(fp,
    "{\"va\":\"%s\",\"name\":\"%s\",\"case\":%d,\"note\":\"%s\",\"retMask\":%u,\"in\":{\"args\":%s,\"mem\":{",
    vaStr, fnName, case_idx, note, retMask, argsJson);
  int first = 1;
  for (int b = 0; b < g_num_blocks; b++) {
    const u32 *words = (const u32 *)g_blocks[b].pre;
    u32 count = g_blocks[b].len / 4u;
    for (u32 w = 0; w < count; w++) {
      fprintf(fp, "%s\"0x%08X\":%u", first ? "" : ",", g_blocks[b].addr + w * 4u, words[w]);
      first = 0;
    }
  }
  fprintf(fp, "}},\"out\":{\"eax\":%u,\"hasRet\":%d,\"mem\":{",
    has_ret ? (eax_out & retMask) : 0u, has_ret);
  first = 1;
  for (int b = 0; b < g_num_blocks; b++) {
    const u32 *preW  = (const u32 *)g_blocks[b].pre;
    const u32 *postW = (const u32 *)g_blocks[b].post;
    u32 count = g_blocks[b].len / 4u;
    for (u32 w = 0; w < count; w++) {
      if (preW[w] != postW[w]) {
        fprintf(fp, "%s\"0x%08X\":%u", first ? "" : ",", g_blocks[b].addr + w * 4u, postW[w]);
        first = 0;
      }
    }
  }
  if (g_heap_off > 0u) {
    const u32 *hwords = (const u32 *)g_heap;
    u32 hcount = g_heap_off / 4u;
    for (u32 w = 0; w < hcount; w++) {
      if (hwords[w] != 0u) {
        fprintf(fp, "%s\"0x%08X\":%u", first ? "" : ",", HEAP_ADDR + w * 4u, hwords[w]);
        first = 0;
      }
    }
  }
  fprintf(fp, "},\"allocBytes\":%u,\"frees\":[", g_heap_off);
  for (int i = 0; i < g_num_frees; i++) {
    fprintf(fp, "%s%u", (i == 0) ? "" : ",", g_frees[i]);
  }
  fprintf(fp, "]}}\n"); fflush(fp); fprintf(stderr, "EMIT %s c=%d\n", vaStr, case_idx); fflush(stderr);
}

/* ---- Call helpers (0 "m"/"g"/"o" constraints, pack[] register-safe) ---- */
static __attribute__((noinline)) u32 call_eax_u32(u32 fn, u32 a_eax) {
  u32 out;
  __asm__ volatile("call *%%ecx\n\t" : "=a"(out), "+c"(fn) : "a"(a_eax) : "edx","ebx","esi","edi","memory","cc");
  return out;
}
static __attribute__((noinline)) void call_eax_void(u32 fn, u32 a_eax) {
  __asm__ volatile("call *%%ecx\n\t" : "+c"(fn) : "a"(a_eax) : "edx","ebx","esi","edi","memory","cc");
}
static __attribute__((noinline)) void call_ecx_void(u32 fn, u32 a_ecx) {
  __asm__ volatile("call *%%edx\n\t" : "+c"(a_ecx), "+d"(fn) : : "eax","ebx","esi","edi","memory","cc");
}
static __attribute__((noinline)) void call_esi_void(u32 fn, u32 a_esi) {
  __asm__ volatile("call *%%ecx\n\t" : "+S"(a_esi), "+c"(fn) : : "eax","edx","ebx","edi","memory","cc");
}
static __attribute__((noinline)) void call_edi_void(u32 fn, u32 a_edi) {
  __asm__ volatile("call *%%ecx\n\t" : "+D"(a_edi), "+c"(fn) : : "eax","edx","ebx","esi","memory","cc");
}
static __attribute__((noinline)) void call_eax_ebx_void(u32 fn, u32 a_eax, u32 a_ebx) {
  u32 pack[2] = { fn, a_ebx };
  const u32 *p = pack;
  __asm__ volatile(
    "pushl %%ebx\n\t"
    "movl 4(%%ecx), %%ebx\n\t"
    "call *0(%%ecx)\n\t"
    "popl %%ebx\n\t"
    : "+c"(p) : "a"(a_eax) : "edx","esi","edi","memory","cc");
}
static __attribute__((noinline)) void call_eax_ecx_void(u32 fn, u32 a_eax, u32 a_ecx) {
  __asm__ volatile("call *%%edx\n\t" : "+c"(a_ecx), "+d"(fn) : "a"(a_eax) : "ebx","esi","edi","memory","cc");
}
static __attribute__((noinline)) void call_ecx_dl_void(u32 fn, u32 a_ecx, u32 a_edx) {
  u32 pack[2] = { fn, a_edx };
  const u32 *p = pack;
  __asm__ volatile("movl 4(%%eax), %%edx\n\tcall *0(%%eax)\n\t" : "+a"(p), "+c"(a_ecx) : : "ebx","esi","edi","memory","cc");
}
static __attribute__((noinline)) void call_edi_bl_void(u32 fn, u32 a_edi, u32 a_ebx) {
  u32 pack[2] = { fn, a_ebx };
  const u32 *p = pack;
  __asm__ volatile(
    "pushl %%ebx\n\t"
    "movl 4(%%ecx), %%ebx\n\t"
    "call *0(%%ecx)\n\t"
    "popl %%ebx\n\t"
    : "+c"(p), "+D"(a_edi) : : "eax","edx","esi","memory","cc");
}
static __attribute__((noinline)) void call_ecx_stk1_void(u32 fn, u32 a_ecx, u32 s1) {
  u32 pack[2] = { fn, s1 };
  const u32 *p = pack;
  __asm__ volatile("pushl 4(%%edx)\n\tcall *0(%%edx)\n\t" : "+c"(a_ecx), "+d"(p) : : "eax","ebx","esi","edi","memory","cc");
}
static __attribute__((noinline)) void call_edi_stk1_void(u32 fn, u32 a_edi, u32 s1) {
  u32 pack[2] = { fn, s1 };
  const u32 *p = pack;
  __asm__ volatile("pushl 4(%%edx)\n\tcall *0(%%edx)\n\t" : "+D"(a_edi), "+d"(p) : : "eax","ecx","ebx","esi","memory","cc");
}
static __attribute__((noinline)) void call_ecx_edx_stk1_void(u32 fn, u32 a_ecx, u32 a_edx, u32 s1) {
  u32 pack[2] = { fn, s1 };
  const u32 *p = pack;
  __asm__ volatile("pushl 4(%%eax)\n\tcall *0(%%eax)\n\t" : "+a"(p), "+c"(a_ecx), "+d"(a_edx) : : "ebx","esi","edi","memory","cc");
}
static __attribute__((noinline)) void call_eax_esi_stk1_void(u32 fn, u32 a_eax, u32 a_esi, u32 s1) {
  u32 pack[2] = { fn, s1 };
  const u32 *p = pack;
  __asm__ volatile("pushl 4(%%edx)\n\tcall *0(%%edx)\n\t" : "+S"(a_esi), "+d"(p) : "a"(a_eax) : "ecx","ebx","edi","memory","cc");
}
static __attribute__((noinline)) void call_ebx_stk2_void(u32 fn, u32 a_ebx, u32 s1, u32 s2) {
  u32 pack[4] = { fn, a_ebx, s1, s2 };
  const u32 *p = pack;
  __asm__ volatile(
    "pushl %%ebx\n\t"
    "movl 4(%%ecx), %%ebx\n\t"
    "pushl 12(%%ecx)\n\t"
    "pushl 8(%%ecx)\n\t"
    "call *0(%%ecx)\n\t"
    "popl %%ebx\n\t"
    : "+c"(p) : : "eax","edx","esi","edi","memory","cc");
}
static __attribute__((noinline)) void call_eax_esi_stk2_void(u32 fn, u32 a_eax, u32 a_esi, u32 s1, u32 s2) {
  u32 pack[3] = { fn, s1, s2 };
  const u32 *p = pack;
  __asm__ volatile("pushl 8(%%edx)\n\tpushl 4(%%edx)\n\tcall *0(%%edx)\n\t" : "+S"(a_esi), "+d"(p) : "a"(a_eax) : "ecx","ebx","edi","memory","cc");
}
static __attribute__((noinline)) void call_edi_stk3_void(u32 fn, u32 a_edi, u32 s1, u32 s2, u32 s3) {
  u32 pack[4] = { fn, s1, s2, s3 };
  const u32 *p = pack;
  __asm__ volatile("pushl 12(%%edx)\n\tpushl 8(%%edx)\n\tpushl 4(%%edx)\n\tcall *0(%%edx)\n\t" : "+D"(a_edi), "+d"(p) : : "eax","ecx","ebx","esi","memory","cc");
}
static __attribute__((noinline)) void call_eax_stk4_void(u32 fn, u32 a_eax, u32 s1, u32 s2, u32 s3, u32 s4) {
  u32 pack[5] = { fn, s1, s2, s3, s4 };
  const u32 *p = pack;
  __asm__ volatile("pushl 16(%%edx)\n\tpushl 12(%%edx)\n\tpushl 8(%%edx)\n\tpushl 4(%%edx)\n\tcall *0(%%edx)\n\t" : "+d"(p) : "a"(a_eax) : "ecx","ebx","esi","edi","memory","cc");
}
static __attribute__((noinline)) u32 call_eax_ecx_stk4_u32(u32 fn, u32 a_eax, u32 a_ecx, u32 s1, u32 s2, u32 s3, u32 s4) {
  u32 pack[5] = { fn, s1, s2, s3, s4 };
  const u32 *p = pack;
  u32 out;
  __asm__ volatile("pushl 16(%%edx)\n\tpushl 12(%%edx)\n\tpushl 8(%%edx)\n\tpushl 4(%%edx)\n\tcall *0(%%edx)\n\t" : "=a"(out), "+c"(a_ecx), "+d"(p) : "a"(a_eax) : "ebx","esi","edi","memory","cc");
  return out;
}
static __attribute__((noinline)) u32 call_ecx_edx_stk5_u32(u32 fn, u32 a_ecx, u32 a_edx, u32 s1, u32 s2, u32 s3, u32 s4, u32 s5) {
  u32 pack[6] = { fn, s1, s2, s3, s4, s5 };
  const u32 *p = pack;
  u32 out;
  __asm__ volatile("pushl 20(%%eax)\n\tpushl 16(%%eax)\n\tpushl 12(%%eax)\n\tpushl 8(%%eax)\n\tpushl 4(%%eax)\n\tcall *0(%%eax)\n\t" : "=a"(out), "+c"(a_ecx), "+d"(a_edx) : "a"(p) : "ebx","esi","edi","memory","cc");
  return out;
}
static __attribute__((noinline)) void call_eax_ecx_stk6_void(u32 fn, u32 a_eax, u32 a_ecx, u32 s1, u32 s2, u32 s3, u32 s4, u32 s5, u32 s6) {
  u32 pack[7] = { fn, s1, s2, s3, s4, s5, s6 };
  const u32 *p = pack;
  __asm__ volatile("pushl 24(%%edx)\n\tpushl 20(%%edx)\n\tpushl 16(%%edx)\n\tpushl 12(%%edx)\n\tpushl 8(%%edx)\n\tpushl 4(%%edx)\n\tcall *0(%%edx)\n\t" : "+c"(a_ecx), "+d"(p) : "a"(a_eax) : "ebx","esi","edi","memory","cc");
}
static __attribute__((noinline)) void call_edi_stk5_void(u32 fn, u32 a_edi, u32 s1, u32 s2, u32 s3, u32 s4, u32 s5) {
  u32 pack[6] = { fn, s1, s2, s3, s4, s5 };
  const u32 *p = pack;
  __asm__ volatile("pushl 20(%%edx)\n\tpushl 16(%%edx)\n\tpushl 12(%%edx)\n\tpushl 8(%%edx)\n\tpushl 4(%%edx)\n\tcall *0(%%edx)\n\t" : "+D"(a_edi), "+d"(p) : : "eax","ecx","ebx","esi","memory","cc");
}
static __attribute__((noinline)) void call_eax_stk6_void(u32 fn, u32 a_eax, u32 s1, u32 s2, u32 s3, u32 s4, u32 s5, u32 s6) {
  u32 pack[7] = { fn, s1, s2, s3, s4, s5, s6 };
  const u32 *p = pack;
  __asm__ volatile("pushl 24(%%edx)\n\tpushl 20(%%edx)\n\tpushl 16(%%edx)\n\tpushl 12(%%edx)\n\tpushl 8(%%edx)\n\tpushl 4(%%edx)\n\tcall *0(%%edx)\n\t" : "+d"(p) : "a"(a_eax) : "ecx","ebx","esi","edi","memory","cc");
}
static __attribute__((noinline)) void call_ecx_ebx_esi_edi_stk3_void(u32 fn, u32 a_ecx, u32 a_ebx, u32 a_esi, u32 a_edi, u32 s1, u32 s2, u32 s3) {
  u32 pack[8] = { fn, a_ecx, a_ebx, a_esi, a_edi, s1, s2, s3 };
  const u32 *p = pack;
  __asm__ volatile(
    "pushl %%ebx\n\t"
    "pushl 28(%%eax)\n\t"
    "pushl 24(%%eax)\n\t"
    "pushl 20(%%eax)\n\t"
    "movl 4(%%eax), %%ecx\n\t"
    "movl 8(%%eax), %%ebx\n\t"
    "movl 12(%%eax), %%esi\n\t"
    "movl 16(%%eax), %%edi\n\t"
    "call *0(%%eax)\n\t"
    "popl %%ebx\n\t"
    : "+a"(p) : : "ecx","edx","esi","edi","memory","cc");
}
static __attribute__((noinline)) void call_eax_edx_ecx_edi_stk7_void(u32 fn, u32 a_eax, u32 a_edx, u32 a_ecx, u32 a_edi, u32 s1, u32 s2, u32 s3, u32 s4, u32 s5, u32 s6, u32 s7) {
  u32 pack[12] = { fn, a_eax, a_edx, a_ecx, a_edi, s1, s2, s3, s4, s5, s6, s7 };
  const u32 *p = pack;
  __asm__ volatile(
    "pushl 44(%%esi)\n\tpushl 40(%%esi)\n\tpushl 36(%%esi)\n\tpushl 32(%%esi)\n\tpushl 28(%%esi)\n\tpushl 24(%%esi)\n\tpushl 20(%%esi)\n\t"
    "movl 4(%%esi), %%eax\n\t"
    "movl 8(%%esi), %%edx\n\t"
    "movl 12(%%esi), %%ecx\n\t"
    "movl 16(%%esi), %%edi\n\t"
    "call *0(%%esi)\n\t"
    : "+S"(p) : : "eax","edx","ecx","ebx","edi","memory","cc");
}

typedef u32 (__attribute__((stdcall)) *fn_std1_u32_t)(u32);
typedef void (__attribute__((stdcall)) *fn_std1_void_t)(u32);
typedef u32 (__attribute__((stdcall)) *fn_std3_u32_t)(u32, u32, u32);
typedef void (__attribute__((stdcall)) *fn_std3_void_t)(u32, u32, u32);
typedef u32 (__attribute__((stdcall)) *fn_std4_u32_t)(u32, u32, u32, u32);
typedef void (__attribute__((stdcall)) *fn_std6_void_t)(u32, u32, u32, u32, u32, u32);
typedef void (__attribute__((stdcall)) *fn_std7_void_t)(u32, u32, u32, u32, u32, u32, u32);
typedef void (__attribute__((stdcall)) *fn_std10_void_t)(u32, u32, u32, u32, u32, u32, u32, u32, u32, u32);
typedef void (__attribute__((stdcall)) *fn_std2_void_t)(u32, u32);
typedef u32 (__attribute__((stdcall)) *fn_std2_u32_t)(u32, u32);


static u32 setup_datatables_items_skills_mon(u32 *outPropTbl, u32 *outStatTbl, u32 *outUniqTbl, u32 *outSetTbl, u32 *outSetItemTbl, u32 *outRuneTbl, u32 *outCharTbl, u32 *outSkillTbl, u32 *outMonTbl, u32 *outMon2Tbl) {
  u32 dt = heap_alloc(0x1000u);
  u32 propTbl = heap_alloc(8u * 0x2Eu);
  u32 statTbl = heap_alloc(200u * 0x144u);
  u32 uniqTbl = heap_alloc(4u * 0x14Cu);
  u32 setTbl  = heap_alloc(4u * 0x128u);
  u32 sitmTbl = heap_alloc(4u * 0x1B8u);
  u32 runeTbl = heap_alloc(4u * 0x120u);
  u32 charTbl = heap_alloc(8u * 0xC4u);
  u32 skilTbl = heap_alloc(16u * 0x23Cu);
  u32 monTbl  = heap_alloc(8u * 0x1A8u);
  u32 mon2Tbl = heap_alloc(8u * 0x134u);

  *(u32 *)(usize)(dt + 0x0A4u) = propTbl; *(u32 *)(usize)(dt + 0x0ACu) = 8u;
  *(u32 *)(usize)(dt + 0xBCCu) = statTbl; *(u32 *)(usize)(dt + 0xBD4u) = 200u;
  *(u32 *)(usize)(dt + 0xC24u) = uniqTbl; *(u32 *)(usize)(dt + 0xC28u) = 4u;
  *(u32 *)(usize)(dt + 0xC0Cu) = setTbl;  *(u32 *)(usize)(dt + 0xC10u) = 4u;
  *(u32 *)(usize)(dt + 0xC18u) = sitmTbl; *(u32 *)(usize)(dt + 0xC1Cu) = 4u;
  *(u32 *)(usize)(dt + 0xBC4u) = charTbl; *(u32 *)(usize)(dt + 0xBC8u) = 8u;
  *(u32 *)(usize)(dt + 0xB98u) = skilTbl; *(u32 *)(usize)(dt + 0xBA0u) = 16u;
  *(u32 *)(usize)(dt + 0xA78u) = monTbl;  *(u32 *)(usize)(dt + 0xA80u) = 8u;
  *(u32 *)(usize)(dt + 0xA90u) = mon2Tbl; *(u32 *)(usize)(dt + 0xA98u) = 8u;
  *(u32 *)(usize)0x6FDEFBD8u = runeTbl; *(u32 *)(usize)0x6FDEFBD4u = 4u;
  u32 itemsTbl = heap_alloc(4u * 0x1A8u);
  *(u32 *)(usize)0x6FDEFB94u = 4u; *(u32 *)(usize)0x6FDEFB98u = itemsTbl;
  *(u16 *)(usize)(itemsTbl + 1u * 0x1A8u + 0x11Eu) = 1u;
  *(u16 *)(usize)(itemsTbl + 2u * 0x1A8u + 0x11Eu) = 1u;
  u32 equivTbl = heap_alloc(16u);
  *(u32 *)(usize)(equivTbl + 4u) = 0xFFFFFFFFu;
  *(u32 *)(usize)(dt + 0xBFCu) = 4u;
  *(u32 *)(usize)(dt + 0xC00u) = 1u;
  *(u32 *)(usize)(dt + 0xC04u) = equivTbl;
  track_region(equivTbl, 16u);
  track_region(0x6FDEFBD4u, 8u);
  track_region(0x6FDEFB94u, 8u);
  track_region(itemsTbl, 4u * 0x1A8u);

  /* PropertiesTxt[1]: func[0]=1 (add), stat[0]=0 (strength); [2]: func[0]=2 (pct), stat[0]=1 */
  *(u8 *)(usize)(propTbl + 1u * 0x2Eu + 0x18u) = 1u;
  *(u16 *)(usize)(propTbl + 1u * 0x2Eu + 0x20u) = 0u;
  *(u8 *)(usize)(propTbl + 2u * 0x2Eu + 0x18u) = 1u;
  *(u16 *)(usize)(propTbl + 2u * 0x2Eu + 0x20u) = 1u;
  *(u8 *)(usize)(propTbl + 3u * 0x2Eu + 0x18u) = 1u;
  *(u16 *)(usize)(propTbl + 3u * 0x2Eu + 0x20u) = 2u;

  /* ItemStatCostTxt[0..2] and [0xC2]: encode=0, bits=8 */
  for (u32 s = 0; s < 4u; s++) {
    u32 r = statTbl + s * 0x144u;
    *(u16 *)(usize)r = (u16)s;
    *(u8 *)(usize)(r + 0x12u) = 8u;
  }
  *(u16 *)(usize)(statTbl + 0xC2u * 0x144u) = 0xC2u;
  *(u8 *)(usize)(statTbl + 0xC2u * 0x144u + 0x12u) = 8u;

  /* UniqueItems[1]: props at +0x8C (prop=1, param=0, min=5, max=5, rest -1) */
  *(u32 *)(usize)(uniqTbl + 1u * 0x14Cu + 0x8Cu) = 1u;
  *(u32 *)(usize)(uniqTbl + 1u * 0x14Cu + 0x94u) = 5u;
  *(u32 *)(usize)(uniqTbl + 1u * 0x14Cu + 0x98u) = 5u;
  for (u32 i = 1u; i < 12u; i++) *(u32 *)(usize)(uniqTbl + 1u * 0x14Cu + 0x8Cu + i * 0x10u) = 0xFFFFFFFFu;

  /* Sets[1]: nItems=0 (+0x0C), pCode[0]=1 (+0x10), fCode[0]=2 (+0x90) */
  *(u32 *)(usize)(setTbl + 1u * 0x128u + 0x0Cu) = 0u;
  *(u32 *)(usize)(setTbl + 1u * 0x128u + 0x10u) = 1u;
  *(u32 *)(usize)(setTbl + 1u * 0x128u + 0x18u) = 3u;
  *(u32 *)(usize)(setTbl + 1u * 0x128u + 0x1Cu) = 3u;
  *(u32 *)(usize)(setTbl + 1u * 0x128u + 0x20u) = 0xFFFFFFFFu;
  *(u32 *)(usize)(setTbl + 1u * 0x128u + 0x90u) = 2u;
  *(u32 *)(usize)(setTbl + 1u * 0x128u + 0x98u) = 4u;
  *(u32 *)(usize)(setTbl + 1u * 0x128u + 0x9Cu) = 4u;
  for (u32 i = 1u; i < 8u; i++) *(u32 *)(usize)(setTbl + 1u * 0x128u + 0x90u + i * 0x10u) = 0xFFFFFFFFu;

  /* SetItems[1]: wSetId=1 (+0x2C), nAddFunc=2 (+0x87), baseProps (+0x88), addProps (+0x118) */
  *(u16 *)(usize)(sitmTbl + 1u * 0x1B8u + 0x2Cu) = 1u;
  *(u8 *)(usize)(sitmTbl + 1u * 0x1B8u + 0x87u) = 2u;
  *(u32 *)(usize)(sitmTbl + 1u * 0x1B8u + 0x88u) = 1u;
  *(u32 *)(usize)(sitmTbl + 1u * 0x1B8u + 0x90u) = 7u;
  *(u32 *)(usize)(sitmTbl + 1u * 0x1B8u + 0x94u) = 7u;
  for (u32 i = 1u; i < 9u; i++) *(u32 *)(usize)(sitmTbl + 1u * 0x1B8u + 0x88u + i * 0x10u) = 0xFFFFFFFFu;
  *(u32 *)(usize)(sitmTbl + 1u * 0x1B8u + 0x118u) = 3u;
  *(u32 *)(usize)(sitmTbl + 1u * 0x1B8u + 0x120u) = 9u;
  *(u32 *)(usize)(sitmTbl + 1u * 0x1B8u + 0x124u) = 9u;
  for (u32 i = 1u; i < 10u; i++) *(u32 *)(usize)(sitmTbl + 1u * 0x1B8u + 0x118u + i * 0x10u) = 0xFFFFFFFFu;

  /* Runes[1]: bComplete=1 (+0x80), wIType[0]=1 (+0x86), dwRune[0]=2 (+0x98), props at +0xB0 */
  *(u8 *)(usize)(runeTbl + 1u * 0x120u + 0x80u) = 1u;
  *(u16 *)(usize)(runeTbl + 1u * 0x120u + 0x86u) = 1u;
  *(u32 *)(usize)(runeTbl + 1u * 0x120u + 0x98u) = 2u;
  for (u32 ri = 1u; ri < 6u; ri++) *(u32 *)(usize)(runeTbl + 1u * 0x120u + 0x98u + ri * 4u) = 0xFFFFFFFFu;
  *(u32 *)(usize)(runeTbl + 1u * 0x120u + 0xB0u) = 1u;
  *(u32 *)(usize)(runeTbl + 1u * 0x120u + 0xB8u) = 11u;
  *(u32 *)(usize)(runeTbl + 1u * 0x120u + 0xBCu) = 11u;
  for (u32 i = 1u; i < 7u; i++) *(u32 *)(usize)(runeTbl + 1u * 0x120u + 0xB0u + i * 0x10u) = 0xFFFFFFFFu;

  /* CharStats[0..2]: wStartSkill at +0xAE */
  *(u16 *)(usize)(charTbl + 0u * 0xC4u + 0xAEu) = 1u;
  *(u16 *)(usize)(charTbl + 1u * 0xC4u + 0xAEu) = 2u;
  *(u16 *)(usize)(charTbl + 2u * 0xC4u + 0xAEu) = 3u;

  /* SkillsTxt[1..5] */
  for (u32 k = 1u; k <= 5u; k++) {
    *(u32 *)(usize)(skilTbl + k * 0x23Cu) = k;
  }

  /* MonStats[1..3] -> MonStats2[1..3] + CompCode[0..7] */
  u32 compTbl = heap_alloc(8u * 4u);
  for (u32 ci = 0; ci < 8u; ci++) *(u32 *)(usize)(compTbl + ci * 4u) = 0x20746960u + ci;
  *(u32 *)(usize)0x6FDEFF54u = compTbl;
  *(u32 *)(usize)0x6FDEFF5Cu = 8u;
  track_region(0x6FDEFF54u, 12u);
  track_region(compTbl, 32u);
  for (u32 m = 1u; m <= 3u; m++) {
    *(u16 *)(usize)(monTbl + m * 0x1A8u + 0x18u) = (u16)m;
    u32 r2 = mon2Tbl + m * 0x134u;
    *(u8 *)(usize)(r2 + 0x15u + 0u) = 1u;
    *(u8 *)(usize)(r2 + 0x15u + 1u) = 2u;
    *(u8 *)(usize)(r2 + 0x26u + 0u * 12u) = (u8)m;
    *(u8 *)(usize)(r2 + 0x26u + 1u * 12u + 0u) = (u8)(m + 2u);
    *(u8 *)(usize)(r2 + 0x26u + 1u * 12u + 1u) = (u8)(m + 3u);
  }

  track_region(dt, 0x1000u);
  track_region(propTbl, 8u * 0x2Eu);
  track_region(statTbl, 8u * 0x144u);
  track_region(statTbl + 0xC2u * 0x144u, 0x144u);
  track_region(uniqTbl, 4u * 0x14Cu);
  track_region(setTbl,  4u * 0x128u);
  track_region(sitmTbl, 4u * 0x1B8u);
  track_region(runeTbl, 4u * 0x120u);
  track_region(charTbl, 8u * 0xC4u);
  track_region(skilTbl, 16u * 0x23Cu);
  track_region(monTbl,  8u * 0x1A8u);
  track_region(mon2Tbl, 8u * 0x134u);

  if (outPropTbl) *outPropTbl = propTbl;
  if (outStatTbl) *outStatTbl = statTbl;
  if (outUniqTbl) *outUniqTbl = uniqTbl;
  if (outSetTbl)  *outSetTbl  = setTbl;
  if (outSetItemTbl) *outSetItemTbl = sitmTbl;
  if (outRuneTbl) *outRuneTbl = runeTbl;
  if (outCharTbl) *outCharTbl = charTbl;
  if (outSkillTbl) *outSkillTbl = skilTbl;
  if (outMonTbl)  *outMonTbl  = monTbl;
  if (outMon2Tbl) *outMon2Tbl = mon2Tbl;
  return dt;
}

static u32 make_item_with_statlist(u32 unitId, u32 quality, u32 fileIndex) {
  u32 pItem = heap_alloc(0x100u);
  u32 pItemData = heap_alloc(0x80u);
  u32 pStatListEx = heap_alloc(0x80u);
  u32 pStatsArr = heap_alloc(64u * 8u);
  *(u32 *)(usize)(pItem + 0x00u) = 4u; /* UNIT_ITEM */
  *(u32 *)(usize)(pItem + 0x04u) = 1u; /* txtFileNo */
  *(u32 *)(usize)(pItem + 0x0Cu) = unitId;
  *(u32 *)(usize)(pItem + 0x14u) = pItemData;
  *(u32 *)(usize)(pItem + 0x5Cu) = pStatListEx;
  *(u32 *)(usize)(pItemData + 0x00u) = quality;
  *(u32 *)(usize)(pItemData + 0x0Cu) = 1u; /* dwItemFlags: identified */
  *(u16 *)(usize)(pItemData + 0x30u) = 1u;
  *(u32 *)(usize)(pItemData + 0x28u) = fileIndex;
  *(u32 *)(usize)(pItemData + 0x34u) = fileIndex;
  *(u32 *)(usize)(pStatListEx + 0x0Cu) = 0x80000000u;
  *(u32 *)(usize)(pStatListEx + 0x10u) = 0x80000000u; /* STATLIST_EXTENDED */
  *(u32 *)(usize)(pStatListEx + 0x24u) = pStatsArr;
  *(u16 *)(usize)(pStatListEx + 0x28u) = 0u;
  *(u16 *)(usize)(pStatListEx + 0x2Au) = 16u;
  track_region(pItem, 0x100u);
  track_region(pItemData, 0x80u);
  track_region(pStatListEx, 0x80u);
  track_region(pStatsArr, 64u * 8u);
  return pItem;
}

static void emit_i14c_1(FILE *fp) {
  char args[256], note[64];
  u32 *pSgpt = (u32 *)(usize)0x6FDE9E1Cu;
  u32 savedSgpt = *pSgpt;

  /* 1. 0x6FD953D0 DRLGWARP_LinkWarpRoomExByDir113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pAct = heap_alloc(0x40u);
    u32 pRoomEx = heap_alloc(0x100u);
    u32 pLevel = heap_alloc(0x200u);
    u32 pDstLevel = heap_alloc(0x200u);
    u32 pDrlg = heap_alloc(0x490u);
    u32 pWarp1 = heap_alloc(0x48u);
    u32 pWarp2 = heap_alloc(0x48u);
    u32 pOther = heap_alloc(0x100u);
    u32 srcId = (u32)(2 + c);
    u32 dstId = (u32)(10 + c);
    *(u32 *)(usize)(pWarp1 + 0x00u) = srcId;
    *(u32 *)(usize)(pWarp1 + 0x04u + (u32)c * 4u) = dstId;
    *(u32 *)(usize)(pWarp1 + 0x24u + (u32)c * 4u) = 0xFFFFFFFFu;
    *(u32 *)(usize)(pWarp1 + 0x44u) = pWarp2;
    *(u32 *)(usize)(pWarp2 + 0x00u) = dstId;
    *(u32 *)(usize)(pWarp2 + 0x04u + (u32)c * 4u) = srcId;
    *(u32 *)(usize)(pDrlg + 0x90u) = pWarp1;
    *(u32 *)(usize)(pDrlg + 0x47Cu) = pDstLevel;
    *(u32 *)(usize)(pDstLevel + 0x1D0u) = dstId;
    *(u32 *)(usize)(pDstLevel + 0x10u) = pOther;
    *(u32 *)(usize)(pOther + 0x28u) = (c == 2) ? 0u : 0xFF0u;
    *(u32 *)(usize)(pOther + 0x34u) = 10u;
    *(u32 *)(usize)(pOther + 0x38u) = 10u;
    *(u32 *)(usize)(pOther + 0x3Cu) = 4u;
    *(u32 *)(usize)(pOther + 0x40u) = 4u;
    *(u32 *)(usize)(pRoomEx + 0x58u) = pLevel;
    *(u32 *)(usize)(pRoomEx + 0x34u) = 10u;
    *(u32 *)(usize)(pRoomEx + 0x38u) = 10u;
    *(u32 *)(usize)(pRoomEx + 0x3Cu) = 4u;
    *(u32 *)(usize)(pRoomEx + 0x40u) = 4u;
    *(u32 *)(usize)(pLevel + 0x1B4u) = pDrlg;
    *(u32 *)(usize)(pLevel + 0x1D0u) = srcId;
    track_region(pAct, 0x40u); track_region(pRoomEx, 0x100u);
    track_region(pLevel, 0x200u); track_region(pDstLevel, 0x200u);
    track_region(pDrlg, 0x490u); track_region(pWarp1, 0x48u);
    track_region(pWarp2, 0x48u); track_region(pOther, 0x100u);
    snapshot_pre();
    fn_std3_u32_t fn = (fn_std3_u32_t)(usize)0x6FD953D0u;
    u32 ret = fn(pAct, pRoomEx, (u32)c);
    snprintf(note, sizeof(note), "i14c1_link_warp_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u,%d]", pAct, pRoomEx, c);
    emit_vector(fp, "0x6FD953D0", "DRLGWARP_LinkWarpRoomExByDir113c", c, note, args, ret, 0xFFFFFFFFu);
  }

  /* 2. 0x6FD95550 DRLGROOM_LinkRoomAndWarps113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 dt = setup_datatables_items_skills_mon(0,0,0,0,0,0,0,0,0,0);
    u32 lvlTbl = heap_alloc(16u * 0x9Cu);
    *(u32 *)(usize)(dt + 0xC5Cu) = 16u;
    *(u32 *)(usize)0x6FDF0B38u = lvlTbl;
    *pSgpt = dt;
    track_region(lvlTbl, 16u * 0x9Cu);
    track_region(0x6FDE9E1Cu, 4u);
    track_region(0x6FDF0B38u, 4u);
    u32 pRoomEx = heap_alloc(0x100u);
    u32 pLevel = heap_alloc(0x200u);
    u32 pDstLevel = heap_alloc(0x200u);
    u32 pDrlg = heap_alloc(0x490u);
    u32 pWarp1 = heap_alloc(0x48u);
    u32 pWarp2 = heap_alloc(0x48u);
    u32 pOther = heap_alloc(0x100u);
    u32 pNear1 = heap_alloc(16u);
    u32 pNear2 = heap_alloc(16u);
    u32 srcId = (u32)(2 + c);
    u32 dstId = (u32)(10 + c);
    *(u32 *)(usize)(pWarp1 + 0x00u) = srcId;
    for (u32 d = 0; d < 8u; d++) {
      *(u32 *)(usize)(pWarp1 + 0x04u + d * 4u) = dstId;
      *(u8 *)(usize)(pWarp1 + 0x24u + d) = 1u;
    }
    *(u32 *)(usize)(pWarp1 + 0x44u) = pWarp2;
    *(u32 *)(usize)(pWarp2 + 0x00u) = dstId;
    *(u32 *)(usize)(pDrlg + 0x90u) = pWarp1;
    *(u32 *)(usize)(pDrlg + 0x47Cu) = pDstLevel;
    *(u32 *)(usize)(pDstLevel + 0x1D0u) = dstId;
    *(u32 *)(usize)(pDstLevel + 0x10u) = pOther;
    *(u32 *)(usize)(pOther + 0x08u) = pNear2;
    *(u32 *)(usize)(pOther + 0x34u) = (u32)(8 + c * 4);
    *(u32 *)(usize)(pOther + 0x38u) = (u32)(8 + c * 4);
    *(u32 *)(usize)(pOther + 0x3Cu) = 4u;
    *(u32 *)(usize)(pOther + 0x40u) = 4u;
    *(u32 *)(usize)(pOther + 0x58u) = pDstLevel;
    *(u32 *)(usize)(pRoomEx + 0x08u) = pNear1;
    *(u32 *)(usize)(pRoomEx + 0x58u) = pLevel;
    *(u32 *)(usize)(pRoomEx + 0x34u) = (u32)(8 + c * 4);
    *(u32 *)(usize)(pRoomEx + 0x38u) = (u32)(8 + c * 4);
    *(u32 *)(usize)(pRoomEx + 0x3Cu) = 4u;
    *(u32 *)(usize)(pRoomEx + 0x40u) = 4u;
    *(u32 *)(usize)(pLevel + 0x1B4u) = pDrlg;
    *(u32 *)(usize)(pLevel + 0x1D0u) = srcId;
    if (c == 2) {
      *(u32 *)(usize)(pLevel + 0x10u) = pRoomEx;
    }
    track_region(pRoomEx, 0x100u); track_region(pLevel, 0x200u); track_region(pDstLevel, 0x200u);
    track_region(pDrlg, 0x490u); track_region(pWarp1, 0x48u); track_region(pWarp2, 0x48u);
    track_region(pOther, 0x100u); track_region(pNear1, 16u); track_region(pNear2, 16u);
    snapshot_pre();
    call_eax_ebx_void(0x6FD95550u, pRoomEx, 0u);
    snprintf(note, sizeof(note), "i14c1_link_room_warps_c%d", c);
    snprintf(args, sizeof(args), "[%u,0]", pRoomEx);
    emit_vector(fp, "0x6FD95550", "DRLGROOM_LinkRoomAndWarps113c", c, note, args, 0u, 0u);
  }

  /* 3. 0x6FD95990 ITEMMODS_ApplyPropertyById113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 dt = setup_datatables_items_skills_mon(0,0,0,0,0,0,0,0,0,0);
    *pSgpt = dt;
    u32 pItem = make_item_with_statlist(100u + (u32)c, 2u, 0u);
    u32 pProp = heap_alloc(0x10u);
    *(u32 *)(usize)(pProp + 0x00u) = (u32)(1 + (c % 2)); /* prop 1 or 2 */
    *(u32 *)(usize)(pProp + 0x04u) = 0u;
    *(u32 *)(usize)(pProp + 0x08u) = (u32)(5 + c * 3);
    *(u32 *)(usize)(pProp + 0x0Cu) = (u32)(5 + c * 3);
    track_region(pProp, 0x10u);
    track_region(0x6FDE9E1Cu, 4u);
    snapshot_pre();
    fn_std10_void_t fn = (fn_std10_void_t)(usize)0x6FD95990u;
    fn(1u, pItem, 0u, 0u, 0u, 0u, pProp, 0u, 0x40u, 0u);
    snprintf(note, sizeof(note), "i14c1_apply_prop_id_c%d", c);
    snprintf(args, sizeof(args), "[1,%u,0,0,0,0,%u,0,64,0]", pItem, pProp);
    emit_vector(fp, "0x6FD95990", "ITEMMODS_ApplyPropertyById113c", c, note, args, 0u, 0u);
  }

  /* 4. 0x6FD95AA0 ITEMMODS_ApplyItemProperty113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 dt = setup_datatables_items_skills_mon(0,0,0,0,0,0,0,0,0,0);
    *pSgpt = dt;
    u32 pItem = make_item_with_statlist(200u + (u32)c, 2u, 0u);
    u32 pProp = heap_alloc(0x10u);
    *(u32 *)(usize)(pProp + 0x00u) = (u32)(1 + c);
    *(u32 *)(usize)(pProp + 0x04u) = 0u;
    *(u32 *)(usize)(pProp + 0x08u) = (u32)(10 + c * 5);
    *(u32 *)(usize)(pProp + 0x0Cu) = (u32)(10 + c * 5);
    track_region(pProp, 0x10u);
    track_region(0x6FDE9E1Cu, 4u);
    snapshot_pre();
    call_eax_edx_ecx_edi_stk7_void(0x6FD95AA0u, pItem, 0x40u, 0u, pProp, 0u, 0u, 0u, 0u, 0u, 0u, 0u);
    snprintf(note, sizeof(note), "i14c1_apply_item_prop_c%d", c);
    snprintf(args, sizeof(args), "[%u,64,0,%u,0,0,0,0,0,0,0]", pItem, pProp);
    emit_vector(fp, "0x6FD95AA0", "ITEMMODS_ApplyItemProperty113c", c, note, args, 0u, 0u);
  }

  /* 5. 0x6FD95F90 ITEMMODS_ApplySetItemBonusProps113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 dt = setup_datatables_items_skills_mon(0,0,0,0,0,0,0,0,0,0);
    *pSgpt = dt;
    u32 pItem = make_item_with_statlist(300u + (u32)c, 5u, 1u);
    u32 pStatListEx = *(u32 *)(usize)(pItem + 0x5Cu);
    u32 pSubList = heap_alloc(0x40u);
    u32 pSubStats = heap_alloc(32u * 8u);
    *(u32 *)(usize)(pSubList + 0x04u) = pItem;
    *(u32 *)(usize)(pSubList + 0x10u) = 0x40u;
    *(u32 *)(usize)(pSubList + 0x14u) = 0xABu;
    *(u32 *)(usize)(pSubList + 0x24u) = pSubStats;
    *(u16 *)(usize)(pSubList + 0x28u) = 0u;
    *(u16 *)(usize)(pSubList + 0x2Au) = 16u;
    *(u32 *)(usize)(pSubList + 0x34u) = pStatListEx;
    *(u32 *)(usize)(pStatListEx + 0x3Cu) = pSubList;
    *(u32 *)(usize)(pStatListEx + 0x40u) = pSubList;
    u32 nSetItems = (u32)(2 + (c & 1));
    u32 pUnit = heap_alloc(0x100u);
    track_region(pUnit, 0x100u);
    track_region(pSubList, 0x40u);
    track_region(pSubStats, 32u * 8u);
    track_region(0x6FDE9E1Cu, 4u);
    snapshot_pre();
    call_ebx_stk2_void(0x6FD95F90u, pItem, pUnit, nSetItems);
    snprintf(note, sizeof(note), "i14c1_set_bonus_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u,%u]", pItem, pUnit, nSetItems);
    emit_vector(fp, "0x6FD95F90", "ITEMMODS_ApplySetItemBonusProps113c", c, note, args, 0u, 0u);
  }

  /* 6. 0x6FD960B0 ITEMS_ApplyItemQualityMods113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 dt = setup_datatables_items_skills_mon(0,0,0,0,0,0,0,0,0,0);
    *pSgpt = dt;
    u32 qual = (c == 0) ? 3u : (c == 1) ? 4u : 0u; /* unique, set, magic0 */
    u32 pItem = make_item_with_statlist(400u + (u32)c, qual, 1u);
    u32 pSeed = heap_alloc(0x08u);
    *(u32 *)(usize)pSeed = 0x12345678u + (u32)c;
    *(u32 *)(usize)(pSeed + 4u) = 0x0000029Au;
    u32 pMagicProps = heap_alloc(0x80u);
    *(u32 *)(usize)(pMagicProps + 0x24u) = 1u;
    *(u32 *)(usize)(pMagicProps + 0x2Cu) = 4u;
    *(u32 *)(usize)(pMagicProps + 0x30u) = 4u;
    *(u32 *)(usize)(pMagicProps + 0x34u) = 0xFFFFFFFFu;
    *(u32 *)(usize)(pMagicProps + 0x44u) = 0xFFFFFFFFu;
    track_region(pSeed, 0x08u); track_region(pMagicProps, 0x80u);
    track_region(0x6FDE9E1Cu, 4u);
    snapshot_pre();
    fn_std6_void_t fn = (fn_std6_void_t)(usize)0x6FD960B0u;
    fn(qual, 0u, pItem, pMagicProps, pSeed, 0u);
    snprintf(note, sizeof(note), "i14c1_item_quality_mods_c%d", c);
    snprintf(args, sizeof(args), "[%u,0,%u,%u,%u,0]", qual, pItem, pMagicProps, pSeed);
    emit_vector(fp, "0x6FD960B0", "ITEMS_ApplyItemQualityMods113c", c, note, args, 0u, 0u);
  }

  /* 7. 0x6FD96770 ITEMS_ApplyRunewordProps113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 runeTbl = 0u;
    u32 dt = setup_datatables_items_skills_mon(0,0,0,0,0,&runeTbl,0,0,0,0);
    *pSgpt = dt;
    *(u32 *)(usize)(runeTbl + 1u * 0x120u + 0xB0u) = (u32)(1 + c);
    *(u32 *)(usize)(runeTbl + 1u * 0x120u + 0xB8u) = (u32)(11 + c * 3);
    *(u32 *)(usize)(runeTbl + 1u * 0x120u + 0xBCu) = (u32)(11 + c * 3);
    u32 pItem = make_item_with_statlist(500u + (u32)c, 2u, 1u);
    u32 pItemData = *(u32 *)(usize)(pItem + 0x14u);
    u32 pStatListEx = *(u32 *)(usize)(pItem + 0x5Cu);
    u32 pStatsArr = *(u32 *)(usize)(pStatListEx + 0x24u);
    u32 pFullStatsArr = heap_alloc(64u * 8u);
    track_region(pFullStatsArr, 64u * 8u);
    *(u16 *)(usize)(pStatListEx + 0x28u) = 1u;
    *(u32 *)(usize)(pStatListEx + 0x48u) = pFullStatsArr;
    *(u16 *)(usize)(pStatListEx + 0x4Cu) = 1u;
    *(u16 *)(usize)(pStatListEx + 0x4Eu) = 16u;
    *(u16 *)(usize)(pStatsArr + 2u) = 0xC2u;
    *(u32 *)(usize)(pStatsArr + 4u) = 1u;
    *(u16 *)(usize)(pFullStatsArr + 2u) = 0xC2u;
    *(u32 *)(usize)(pFullStatsArr + 4u) = 1u;
    u32 pInv = heap_alloc(0x40u);
    u32 pSock = heap_alloc(0x100u);
    u32 pSockData = heap_alloc(0x80u);
    *(u32 *)(usize)pInv = 0x01020304u;
    *(u32 *)(usize)(pInv + 0x0Cu) = pSock;
    *(u32 *)(usize)(pItem + 0x60u) = pInv;
    *(u32 *)(usize)(pSock + 0x00u) = 4u;
    *(u32 *)(usize)(pSock + 0x04u) = 2u;
    *(u32 *)(usize)(pSock + 0x14u) = pSockData;
    track_region(pInv, 0x40u);
    track_region(pSock, 0x100u);
    track_region(pSockData, 0x80u);
    *(u32 *)(usize)(pItemData + 0x0Cu) = 1u;
    *(u16 *)(usize)(pItemData + 0x26u) = 1u;
    track_region(0x6FDE9E1Cu, 4u);
    snapshot_pre();
    fn_std3_u32_t fn = (fn_std3_u32_t)(usize)0x6FD96770u;
    u32 ret = fn(pItem, pItem, 0u);
    snprintf(note, sizeof(note), "i14c1_runeword_props_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u,0]", pItem, pItem);
    emit_vector(fp, "0x6FD96770", "ITEMS_ApplyRunewordProps113c", c, note, args, ret, 0xFFFFFFFFu);
  }

  /* 8. 0x6FD97730 ITEMS_ApplySinglePropAndEthereal113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 dt = setup_datatables_items_skills_mon(0,0,0,0,0,0,0,0,0,0);
    *pSgpt = dt;
    u32 pItem = make_item_with_statlist(600u + (u32)c, 2u, 1u);
    u32 pProp = heap_alloc(0x10u);
    *(u32 *)(usize)(pProp + 0x00u) = (u32)(1 + (c % 2));
    *(u32 *)(usize)(pProp + 0x08u) = (u32)(3 + c * 2);
    *(u32 *)(usize)(pProp + 0x0Cu) = (u32)(3 + c * 2);
    track_region(pProp, 0x10u);
    track_region(0x6FDE9E1Cu, 4u);
    snapshot_pre();
    fn_std3_void_t fn = (fn_std3_void_t)(usize)0x6FD97730u;
    fn(pItem, pProp, 0u);
    snprintf(note, sizeof(note), "i14c1_single_prop_eth_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u,0]", pItem, pProp);
    emit_vector(fp, "0x6FD97730", "ITEMS_ApplySinglePropAndEthereal113c", c, note, args, 0u, 0u);
  }

  /* 9. 0x6FDA1870 SKILLS_FindMeleeTargetPosition113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 dt = setup_datatables_items_skills_mon(0,0,0,0,0,0,0,0,0,0);
    *pSgpt = dt;
    track_region(0x6FDE9E1Cu, 4u);
    u32 pUnit = heap_alloc(0x100u);
    u32 pTarget = heap_alloc(0x100u);
    u32 pPathU = heap_alloc(0x80u);
    u32 pPathT = heap_alloc(0x80u);
    u32 pOutX = heap_alloc(0x04u);
    u32 pOutY = heap_alloc(0x04u);
    u32 pRoom = heap_alloc(0x80u);
    u32 pCoords = heap_alloc(0x20u);
    u32 pColl = heap_alloc(0x30u);
    u32 pMap = heap_alloc(32u * 32u * 2u);
    u32 pRoom2 = heap_alloc(0xA0u);
    u32 pLvl = heap_alloc(0x200u);
    *(u32 *)(usize)(pCoords + 0x00u) = 90u; *(u32 *)(usize)(pCoords + 0x04u) = 90u;
    *(u32 *)(usize)(pCoords + 0x08u) = 64u; *(u32 *)(usize)(pCoords + 0x0Cu) = 64u;
    *(u32 *)(usize)(pColl + 0x00u) = 90u; *(u32 *)(usize)(pColl + 0x04u) = 90u;
    *(u32 *)(usize)(pColl + 0x08u) = 32u; *(u32 *)(usize)(pColl + 0x0Cu) = 32u;
    *(u32 *)(usize)(pColl + 0x20u) = pMap;
    *(u32 *)(usize)(pRoom2 + 0x58u) = pLvl;
    *(u32 *)(usize)(pLvl + 0x1D0u) = 2u; /* Blood Moor (not town) */
    *(u32 *)(usize)(pRoom + 0x10u) = pRoom2;
    *(u32 *)(usize)(pRoom + 0x20u) = pColl;
    *(u32 *)(usize)(pRoom + 0x4Cu) = 90u;
    *(u32 *)(usize)(pRoom + 0x50u) = 90u;
    *(u32 *)(usize)(pRoom + 0x54u) = 64u;
    *(u32 *)(usize)(pRoom + 0x58u) = 64u;
    *(u32 *)(usize)(pUnit + 0x00u) = 0u; /* player */
    *(u32 *)(usize)(pUnit + 0x2Cu) = pPathU;
    *(u16 *)(usize)(pPathU + 0x02u) = (u16)(100 + c * 5);
    *(u16 *)(usize)(pPathU + 0x06u) = (u16)(100 + c * 5);
    *(u32 *)(usize)(pPathU + 0x1Cu) = pRoom;
    *(u32 *)(usize)(pPathU + 0x48u) = 1u;
    *(u32 *)(usize)(pTarget + 0x00u) = (c == 2) ? 0u : 1u; /* monster or player */
    *(u32 *)(usize)(pTarget + 0x2Cu) = pPathT;
    *(u16 *)(usize)(pPathT + 0x02u) = (u16)(105 + c * 5);
    *(u16 *)(usize)(pPathT + 0x06u) = (u16)(102 + c * 5);
    *(u32 *)(usize)(pPathT + 0x1Cu) = pRoom;
    track_region(pRoom, 0x80u); track_region(pCoords, 0x20u);
    track_region(pColl, 0x30u); track_region(pMap, 32u * 32u * 2u);
    track_region(pRoom2, 0xA0u); track_region(pLvl, 0x200u);
    track_region(pUnit, 0x100u); track_region(pTarget, 0x100u);
    track_region(pPathU, 0x80u); track_region(pPathT, 0x80u);
    track_region(pOutX, 4u); track_region(pOutY, 4u);
    snapshot_pre();
    fn_std4_u32_t fn = (fn_std4_u32_t)(usize)0x6FDA1870u;
    u32 ret = fn(pUnit, pTarget, pOutX, pOutY);
    snprintf(note, sizeof(note), "i14c1_melee_pos_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u]", pUnit, pTarget, pOutX, pOutY);
    emit_vector(fp, "0x6FDA1870", "SKILLS_FindMeleeTargetPosition113c", c, note, args, ret, 0xFFFFFFFFu);
  }

  /* 10. 0x6FDA2660 SKILLS_AddSkillToUnit113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 dt = setup_datatables_items_skills_mon(0,0,0,0,0,0,0,0,0,0);
    *pSgpt = dt;
    u32 pUnit = heap_alloc(0x100u);
    u32 pInfo = heap_alloc(0x40u);
    *(u32 *)(usize)(pUnit + 0xA8u) = pInfo;
    *(u32 *)(usize)(pInfo + 0x00u) = 0u; /* pMemPool = 0 */
    track_region(pUnit, 0x100u); track_region(pInfo, 0x40u);
    track_region(0x6FDE9E1Cu, 4u);
    snapshot_pre();
    fn_std2_u32_t fn = (fn_std2_u32_t)(usize)0x6FDA2660u;
    u32 ret = fn(pUnit, (u32)(1 + c));
    snprintf(note, sizeof(note), "i14c1_add_skill_c%d", c);
    snprintf(args, sizeof(args), "[%u,%d]", pUnit, 1 + c);
    emit_vector(fp, "0x6FDA2660", "SKILLS_AddSkillToUnit113c", c, note, args, ret, 0xFFFFFFFFu);
  }

  /* 11. 0x6FDA28B0 SKILLS_RemoveOrDecrementSkillFromUnit113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 dt = setup_datatables_items_skills_mon(0,0,0,0,0,0,0,0,0,0);
    *pSgpt = dt;
    u32 pUnit = heap_alloc(0x100u);
    u32 pInfo = heap_alloc(0x40u);
    u32 pSkill = heap_alloc(0x40u);
    *(u32 *)(usize)(pUnit + 0xA8u) = pInfo;
    *(u32 *)(usize)(pInfo + 0x04u) = pSkill;
    u32 skilTbl = *(u32 *)(usize)(dt + 0xB98u);
    *(u32 *)(usize)(pSkill + 0x00u) = skilTbl + (u32)(1 + c) * 0x23Cu;
    *(u32 *)(usize)(pSkill + 0x28u) = (c == 0) ? 1u : 3u;
    *(u32 *)(usize)(pSkill + 0x34u) = 0xFFFFFFFFu;
    track_region(pUnit, 0x100u); track_region(pInfo, 0x40u); track_region(pSkill, 0x40u);
    track_region(0x6FDE9E1Cu, 4u);
    snapshot_pre();
    call_ebx_stk2_void(0x6FDA28B0u, pUnit, (u32)(1 + c), (c == 1) ? 1u : 0u);
    snprintf(note, sizeof(note), "i14c1_rem_skill_c%d", c);
    snprintf(args, sizeof(args), "[%u,%d,%d]", pUnit, 1 + c, (c == 1) ? 1 : 0);
    emit_vector(fp, "0x6FDA28B0", "SKILLS_RemoveOrDecrementSkillFromUnit113c", c, note, args, 0u, 0u);
  }

  /* 12. 0x6FDA29E0 SKILLS_InitCharStartSkills113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 dt = setup_datatables_items_skills_mon(0,0,0,0,0,0,0,0,0,0);
    *pSgpt = dt;
    u32 pUnit = heap_alloc(0x100u);
    u32 pInfo = heap_alloc(0x40u);
    *(u32 *)(usize)(pUnit + 0x00u) = 0u; /* UNIT_PLAYER */
    *(u32 *)(usize)(pUnit + 0x04u) = (u32)c; /* charClass */
    *(u32 *)(usize)(pUnit + 0xA8u) = pInfo;
    track_region(pUnit, 0x100u); track_region(pInfo, 0x40u);
    track_region(0x6FDE9E1Cu, 4u);
    snapshot_pre();
    fn_std1_void_t fn = (fn_std1_void_t)(usize)0x6FDA29E0u;
    fn(pUnit);
    snprintf(note, sizeof(note), "i14c1_init_start_skills_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pUnit);
    emit_vector(fp, "0x6FDA29E0", "SKILLS_InitCharStartSkills113c", c, note, args, 0u, 0u);
  }

  /* 13. 0x6FDA2AE0 SKILLS_RefreshPassiveAuraSkills113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 dt = setup_datatables_items_skills_mon(0,0,0,0,0,0,0,0,0,0);
    *pSgpt = dt;
    u32 pUnit = heap_alloc(0x100u);
    u32 pInfo = heap_alloc(0x40u);
    u32 pSkill = heap_alloc(0x40u);
    u32 pAuraIds = heap_alloc(8u);
    u32 pStatesTxt = heap_alloc(8u * 0x3Cu);
    u32 pStatListEx = heap_alloc(0x80u);
    u32 pStateFlags = heap_alloc(16u);
    u32 pSub = heap_alloc(0x40u);
    u32 skilTbl = *(u32 *)(usize)(dt + 0xB98u);
    u32 pSkTxt = skilTbl + (u32)(1 + c) * 0x23Cu;
    *(u16 *)(usize)(pSkTxt + 0x00u) = (u16)(1 + c);
    *(u16 *)(usize)(pSkTxt + 0x80u) = (u16)(1 + c);
    *(u16 *)(usize)(pSkTxt + 0x94u) = (u16)(c == 2 ? 0 : (1 + c));
    *(u32 *)(usize)(dt + 0xBB0u) = 1u;
    *(u32 *)(usize)(dt + 0xBB4u) = pAuraIds;
    *(u16 *)(usize)pAuraIds = (u16)(1 + c);
    *(u32 *)(usize)(dt + 0xBCu) = pStatesTxt;
    *(u32 *)(usize)(dt + 0xC4u) = 8u;
    *(u32 *)(usize)(pUnit + 0x5Cu) = pStatListEx;
    *(u32 *)(usize)(pUnit + 0xA8u) = pInfo;
    *(u32 *)(usize)(pInfo + 0x04u) = pSkill;
    *(u32 *)(usize)(pSkill + 0x00u) = pSkTxt;
    *(u32 *)(usize)(pSkill + 0x28u) = (u32)(2 + c);
    *(u32 *)(usize)(pSkill + 0x34u) = 0xFFFFFFFFu;
    *(u32 *)(usize)(pStatListEx + 0x10u) = 0x80000000u;
    *(u32 *)(usize)(pStatListEx + 0x58u) = pStateFlags;
    *(u32 *)(usize)pStateFlags = 0xFFFFFFFFu;
    *(u32 *)(usize)(pSub + 0x04u) = pUnit;
    *(u32 *)(usize)(pSub + 0x14u) = (u32)(1 + c);
    *(u32 *)(usize)(pSub + 0x34u) = pStatListEx;
    *(u32 *)(usize)(pStatListEx + 0x3Cu) = pSub;
    track_region(pUnit, 0x100u); track_region(pInfo, 0x40u); track_region(pSkill, 0x40u);
    track_region(pAuraIds, 8u); track_region(pStatesTxt, 8u * 0x3Cu);
    track_region(pStatListEx, 0x80u); track_region(pStateFlags, 16u); track_region(pSub, 0x40u);
    track_region(0x6FDE9E1Cu, 4u);
    snapshot_pre();
    fn_std1_void_t fn = (fn_std1_void_t)(usize)0x6FDA2AE0u;
    fn(pUnit);
    snprintf(note, sizeof(note), "i14c1_refresh_aura_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pUnit);
    emit_vector(fp, "0x6FDA2AE0", "SKILLS_RefreshPassiveAuraSkills113c", c, note, args, 0u, 0u);
  }

  /* 14. 0x6FDA2BC0 SKILLS_SetSkillLevelOnUnit113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 dt = setup_datatables_items_skills_mon(0,0,0,0,0,0,0,0,0,0);
    *pSgpt = dt;
    u32 pUnit = heap_alloc(0x100u);
    u32 pInfo = heap_alloc(0x40u);
    *(u32 *)(usize)(pUnit + 0xA8u) = pInfo;
    track_region(pUnit, 0x100u); track_region(pInfo, 0x40u);
    track_region(0x6FDE9E1Cu, 4u);
    snapshot_pre();
    fn_std6_void_t fn = (fn_std6_void_t)(usize)0x6FDA2BC0u;
    fn(pUnit, (u32)(1 + c), (u32)(5 + c * 2), 1u, 0u, 0u);
    snprintf(note, sizeof(note), "i14c1_set_skill_lvl_c%d", c);
    snprintf(args, sizeof(args), "[%u,%d,%d,1,0,0]", pUnit, 1 + c, 5 + c * 2);
    emit_vector(fp, "0x6FDA2BC0", "SKILLS_SetSkillLevelOnUnit113c", c, note, args, 0u, 0u);
  }

  /* 15. 0x6FDD4C70 MONSTERS_GetCompCode113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 dt = setup_datatables_items_skills_mon(0,0,0,0,0,0,0,0,0,0);
    *pSgpt = dt;
    u32 pUnit = heap_alloc(0x100u);
    *(u32 *)(usize)(pUnit + 0x00u) = 1u; /* UNIT_MONSTER */
    *(u32 *)(usize)(pUnit + 0x04u) = (u32)(1 + (c % 2));
    track_region(pUnit, 0x100u);
    track_region(0x6FDE9E1Cu, 4u);
    snapshot_pre();
    fn_std3_u32_t fn = (fn_std3_u32_t)(usize)0x6FDD4C70u;
    u32 ret = fn(pUnit, (u32)(c % 2), 0u);
    snprintf(note, sizeof(note), "i14c1_mon_comp_code_c%d", c);
    snprintf(args, sizeof(args), "[%u,%d,0]", pUnit, c % 2);
    emit_vector(fp, "0x6FDD4C70", "MONSTERS_GetCompCode113c", c, note, args, ret, 0xFFFFFFFFu);
  }

  *pSgpt = savedSgpt;
}


static u32 setup_roomex_with_tilegrid(u32 w, u32 h, u32 nFloors, u32 nWalls, u32 nRoofs, u32 *outLevel, u32 *outDrlg, u32 *outTileGrid) {
  u32 pRoomEx = heap_alloc(0x100u);
  u32 pLevel  = heap_alloc(0x200u);
  u32 pDrlg   = heap_alloc(0x640u);
  for (u32 st = 1u; st < 4u; st++) {
    u32 head = pDrlg + 0x0A0u + st * 0xECu;
    *(u32 *)(usize)(head + 0xE8u) = head;
    *(u32 *)(usize)(head + 0x1Cu) = head;
  }
  u32 pTG     = heap_alloc(0x40u);
  u32 pOutdoorRoom = heap_alloc(0x100u);
  u32 pCells0 = heap_alloc(w * h * 4u);
  u32 pRows0  = heap_alloc(h * 4u);
  u32 pCells1 = heap_alloc(w * h * 4u);
  u32 pRows1  = heap_alloc(h * 4u);
  u32 pCells2 = heap_alloc(w * h * 4u);
  u32 pRows2  = heap_alloc(h * 4u);

  for (u32 y = 0; y < h; y++) {
    *(u32 *)(usize)(pRows0 + y * 4u) = y * w;
    *(u32 *)(usize)(pRows1 + y * 4u) = y * w;
    *(u32 *)(usize)(pRows2 + y * 4u) = y * w;
  }
  *(u32 *)(usize)(pOutdoorRoom + 0x00u + 0x00u) = pCells0;
  *(u32 *)(usize)(pOutdoorRoom + 0x00u + 0x04u) = pRows0;
  *(u32 *)(usize)(pOutdoorRoom + 0x00u + 0x08u) = w;
  *(u32 *)(usize)(pOutdoorRoom + 0x00u + 0x0Cu) = h;
  *(u32 *)(usize)(pOutdoorRoom + 0x14u + 0x00u) = pCells1;
  *(u32 *)(usize)(pOutdoorRoom + 0x14u + 0x04u) = pRows1;
  *(u32 *)(usize)(pOutdoorRoom + 0x14u + 0x08u) = w;
  *(u32 *)(usize)(pOutdoorRoom + 0x14u + 0x0Cu) = h;
  *(u32 *)(usize)(pOutdoorRoom + 0x28u + 0x00u) = pCells2;
  *(u32 *)(usize)(pOutdoorRoom + 0x28u + 0x04u) = pRows2;
  *(u32 *)(usize)(pOutdoorRoom + 0x28u + 0x08u) = w;
  *(u32 *)(usize)(pOutdoorRoom + 0x28u + 0x0Cu) = h;
  *(i32 *)(usize)(pOutdoorRoom + 0x64u) = -1;

  *(u32 *)(usize)(pRoomEx + 0x48u) = 1u; /* nType = OUTDOOR */
  *(u32 *)(usize)(pRoomEx + 0x20u) = pOutdoorRoom;
  *(u32 *)(usize)(pRoomEx + 0x28u) = 0x01000000u; /* skip LoadDt1Files */
  *(u32 *)(usize)(pRoomEx + 0x34u) = 8u;
  *(u32 *)(usize)(pRoomEx + 0x38u) = 8u;
  *(u32 *)(usize)(pRoomEx + 0x3Cu) = w;
  *(u32 *)(usize)(pRoomEx + 0x40u) = h;
  *(u32 *)(usize)(pRoomEx + 0x54u) = pTG;
  *(u32 *)(usize)(pRoomEx + 0x58u) = pLevel;
  *(u32 *)(usize)(pLevel + 0x1B4u) = pDrlg;
  *(u32 *)(usize)(pLevel + 0x1D0u) = 2u;
  u32 pAct = heap_alloc(0x80u);
  *(u32 *)(usize)(pDrlg + 0x46Cu) = pAct;
  track_region(pAct, 0x80u);
  u32 pOutdoors = heap_alloc(0x280u);
  *(u32 *)(usize)(pLevel + 0x14u) = pOutdoors;
  track_region(pOutdoors, 0x280u);
  u32 pWarp = heap_alloc(0x80u);
  *(u32 *)(usize)(pWarp + 0x00u) = 2u;
  *(u32 *)(usize)(pDrlg + 0x90u) = pWarp;
  track_region(pWarp, 0x80u);
  u32 pLvlTypes = heap_alloc(0x1000u);
  *(u32 *)(usize)0x6FDF141Cu = pLvlTypes;
  track_region(pLvlTypes, 0x1000u);
  track_region(0x6FDF141Cu, 4u);
  u32 dt = heap_alloc(0x1000u);
  u32 lvlTbl = heap_alloc(136u * 0x9Cu);
  *(u32 *)(usize)(dt + 0xC5Cu) = 136u;
  *(u32 *)(usize)0x6FDE9E1Cu = dt;
  *(u32 *)(usize)0x6FDF0B38u = lvlTbl;
  u32 lvlSubTbl = heap_alloc(4u * 0x15Cu);
  u32 lvlSubIdx = heap_alloc(16u * 4u);
  for (u32 si = 0; si < 4u; si++) {
    *(u32 *)(usize)(lvlSubTbl + si * 0x15Cu + 0x00u) = 0xFFFFFFFFu;
    *(u32 *)(usize)(lvlSubTbl + si * 0x15Cu + 0x4Cu) = 4u;
  }
  *(u32 *)(usize)0x6FDF143Cu = lvlSubTbl;
  *(u32 *)(usize)0x6FDF1440u = 4u;
  *(u32 *)(usize)0x6FDF1444u = lvlSubIdx;
  track_region(dt, 0x1000u);
  track_region(lvlTbl, 136u * 0x9Cu);
  track_region(lvlSubTbl, 4u * 0x15Cu);
  track_region(lvlSubIdx, 64u);
  track_region(0x6FDE9E1Cu, 4u);
  track_region(0x6FDF0B38u, 4u);
  track_region(0x6FDF143Cu, 12u);
  track_region(0x6FDE4020u, 32u);
  track_region(0x6FDDCAB8u, 16u);

  u32 pWalls  = heap_alloc((nWalls + 4u) * 0x30u);
  u32 pFloors = heap_alloc((nFloors + 4u) * 0x30u);
  u32 pRoofs  = heap_alloc((nRoofs + 4u) * 0x30u);
  *(u32 *)(usize)(pTG + 0x08u) = 0u; /* nWalls */
  *(u32 *)(usize)(pTG + 0x0Cu) = 0u; /* nFloors */
  *(u32 *)(usize)(pTG + 0x10u) = 0u; /* nRoofs */
  *(u32 *)(usize)(pTG + 0x18u) = nWalls + 4u;
  *(u32 *)(usize)(pTG + 0x1Cu) = pFloors;
  *(u32 *)(usize)(pTG + 0x20u) = nFloors + 4u;
  *(u32 *)(usize)(pTG + 0x24u) = pRoofs;
  *(u32 *)(usize)(pTG + 0x28u) = nRoofs + 4u;
  *(u32 *)(usize)(pTG + 0x14u) = pWalls;

  u32 pHash = heap_alloc(0x200u);
  u32 pEntry = heap_alloc(0x30u);
  u32 pBlock = heap_alloc(8u);
  *(u16 *)(usize)(pEntry + 0x06u) = 1u;
  *(u32 *)(usize)(pEntry + 0x18u) = 1u;
  *(u32 *)(usize)(pEntry + 0x1Cu) = 0u;
  *(u32 *)(usize)(pEntry + 0x20u) = 1u;
  *(u32 *)(usize)(pBlock + 0x00u) = pEntry;
  *(u32 *)(usize)(pBlock + 0x04u) = 0u;
  track_region(pHash, 0x200u);
  track_region(pEntry, 0x30u);
  track_region(pBlock, 8u);
  for (u32 st = 0u; st <= 1u; st++) {
    for (u32 or_i = 0u; or_i < 16u; or_i++) {
      u32 node = heap_alloc(0x14u);
      u32 bucket = (((st << 1u) - or_i + st) & 0x7Fu);
      *(u32 *)(usize)(node + 0x00u) = st;
      *(u32 *)(usize)(node + 0x04u) = st;
      *(u32 *)(usize)(node + 0x08u) = or_i;
      *(u32 *)(usize)(node + 0x0Cu) = pBlock;
      *(u32 *)(usize)(node + 0x10u) = *(u32 *)(usize)(pHash + bucket * 4u);
      *(u32 *)(usize)(pHash + bucket * 4u) = node;
      track_region(node, 0x14u);
    }
  }
  {
    u32 node30 = heap_alloc(0x14u);
    u32 bucket30 = 30u & 0x7Fu;
    *(u32 *)(usize)(node30 + 0x00u) = 30u;
    *(u32 *)(usize)(node30 + 0x04u) = 0u;
    *(u32 *)(usize)(node30 + 0x08u) = 0u;
    *(u32 *)(usize)(node30 + 0x0Cu) = pBlock;
    *(u32 *)(usize)(node30 + 0x10u) = *(u32 *)(usize)(pHash + bucket30 * 4u);
    *(u32 *)(usize)(pHash + bucket30 * 4u) = node30;
    track_region(node30, 0x14u);
  }
  *(u32 *)(usize)(pRoomEx + 0x68u) = pHash;
  *(u32 *)(usize)(pRoomEx + 0xDCu) = pEntry;

  track_region(pRoomEx, 0x100u);
  track_region(pLevel, 0x200u);
  track_region(pDrlg, 0x480u);
  track_region(pTG, 0x40u);
  track_region(pOutdoorRoom, 0x100u);
  track_region(pCells0, w * h * 4u);
  track_region(pRows0, h * 4u);
  track_region(pCells1, w * h * 4u);
  track_region(pRows1, h * 4u);
  track_region(pCells2, w * h * 4u);
  track_region(pRows2, h * 4u);
  track_region(pWalls, (nWalls + 4u) * 0x30u);
  track_region(pFloors, (nFloors + 4u) * 0x30u);
  track_region(pRoofs, (nRoofs + 4u) * 0x30u);

  if (outLevel) *outLevel = pLevel;
  if (outDrlg) *outDrlg = pDrlg;
  if (outTileGrid) *outTileGrid = pTG;
  return pRoomEx;
}

static void emit_i14c_2(FILE *fp) {
  char args[256], note[64];

  /* 16. 0x6FD9A670 DRLGROOMTILE_InitOutdoorRoomTilesAndWallGrids113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pTG;
    u32 pRoomEx = setup_roomex_with_tilegrid(8u, 8u, 16u, 16u, 8u, &pLevel, &pDrlg, &pTG);
    u32 dt = heap_alloc(0x1000u);
    u32 lvlTbl = heap_alloc(136u * 0x9Cu);
    *(u32 *)(usize)(dt + 0xC5Cu) = 136u;
    *(u32 *)(usize)0x6FDE9E1Cu = dt;
    *(u32 *)(usize)0x6FDF0B38u = lvlTbl;
    *(u32 *)(usize)(pLevel + 0x1D0u) = (u32)(45 + c * 30); /* Act 2..4 so bPreset != 0 */
    *(u32 *)(usize)(pRoomEx + 0x28u) = 0x00009000u; /* nWallCount = 8 */
    *(i32 *)(usize)(*(u32 *)(usize)(pRoomEx + 0x20u) + 0x64u) = -1;
    *(i32 *)(usize)(lvlTbl + (45u + (u32)c * 30u) * 0x9Cu + 0x40u) = -1;
    *(i32 *)(usize)(lvlTbl + (45u + (u32)c * 30u) * 0x9Cu + 0x44u) = -1;
    *(i32 *)(usize)(lvlTbl + (45u + (u32)c * 30u) * 0x9Cu + 0x48u) = -1;
    *(i32 *)(usize)(lvlTbl + (45u + (u32)c * 30u) * 0x9Cu + 0x4Cu) = -1;
    *(u32 *)(usize)(pRoomEx + 0x48u) = 1u;
    if (c == 0) *(u32 *)(usize)(pRoomEx + 0x54u) = 0u;
    track_region(dt, 0x1000u); track_region(lvlTbl, 136u * 0x9Cu);
    u32 lvlSubTbl = heap_alloc(4u * 0x15Cu);
    u32 lvlSubIdx = heap_alloc(16u * 4u);
    u32 lvlSubFile = heap_alloc(0x80u);
    for (u32 si = 0; si < 4u; si++) {
      *(u32 *)(usize)(lvlSubTbl + si * 0x15Cu + 0x50u) = lvlSubFile;
    }
    track_region(lvlSubFile, 0x80u);
    *(u32 *)(usize)0x6FDF143Cu = lvlSubTbl;
    *(u32 *)(usize)0x6FDF1440u = 4u;
    *(u32 *)(usize)0x6FDF1444u = lvlSubIdx;
    track_region(lvlSubTbl, 4u * 0x15Cu);
    track_region(lvlSubIdx, 64u);
    track_region(0x6FDF143Cu, 12u);
    track_region(0x6FDE9E1Cu, 4u); track_region(0x6FDF0B38u, 4u);
    snapshot_pre();
    call_eax_void(0x6FD9A670u, pRoomEx);
    snprintf(note, sizeof(note), "i14c2_init_outdoor_tiles_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pRoomEx);
    emit_vector(fp, "0x6FD9A670", "DRLGROOMTILE_InitOutdoorRoomTilesAndWallGrids113c", c, note, args, 0u, 0u);
  }

  /* 17. 0x6FD9A9B0 DRLGROOMTILE_BuildOutdoorRoomTileData113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pTG;
    u32 pRoomEx = setup_roomex_with_tilegrid(4u, 4u, (u32)(8u + c * 4u), 16u, 8u, &pLevel, &pDrlg, &pTG);
    u32 pOutdoorRoom = *(u32 *)(usize)(pRoomEx + 0x20u);
    u32 pCells1 = *(u32 *)(usize)(pOutdoorRoom + 0x14u);
    *(u32 *)(usize)(pCells1 + (u32)c * 4u) = 0x00000000u; /* empty cells so no tile cache lookup needed */
    snapshot_pre();
    call_esi_void(0x6FD9A9B0u, pRoomEx);
    snprintf(note, sizeof(note), "i14c2_build_outdoor_tiles_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pRoomEx);
    emit_vector(fp, "0x6FD9A9B0", "DRLGROOMTILE_BuildOutdoorRoomTileData113c", c, note, args, 0u, 0u);
  }

  /* 18. 0x6FDB88B0 DRLGROOMTILE_FreeRoomResources113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pTG;
    u32 pRoomEx = setup_roomex_with_tilegrid(4u, 4u, 4u, 4u, 4u, &pLevel, &pDrlg, &pTG);
    *(u32 *)(usize)(pRoomEx + 0x28u) = 0x100100u + (u32)c;
    *(u32 *)(usize)(pRoomEx + 0x48u) = 0u;
    *(u32 *)(usize)(pRoomEx + 0x54u) = 0u; /* avoid freeing stack/arena TG arrays unless allocated */
    snapshot_pre();
    call_edi_stk1_void(0x6FDB88B0u, pRoomEx, (u32)(c & 1));
    snprintf(note, sizeof(note), "i14c2_free_room_res_c%d", c);
    snprintf(args, sizeof(args), "[%u,%d]", pRoomEx, c & 1);
    emit_vector(fp, "0x6FDB88B0", "DRLGROOMTILE_FreeRoomResources113c", c, note, args, 0u, 0u);
  }

  /* 19. 0x6FDB8F00 DRLGROOMTILE_AddWallTileData113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pTG;
    u32 pRoomEx = setup_roomex_with_tilegrid(4u, 4u, 8u, 8u, 8u, &pLevel, &pDrlg, &pTG);
    u32 ppHead = heap_alloc(4u);
    u32 pCache = heap_alloc(0x30u);
    *(u16 *)(usize)(pCache + 0x06u) = (u16)(1 + c);
    *(u32 *)(usize)(pCache + 0x18u) = (u32)(10 + c);
    *(u32 *)(usize)(pCache + 0x1Cu) = (u32)c;
    track_region(ppHead, 4u); track_region(pCache, 0x30u);
    snapshot_pre();
    u32 ret = call_ecx_edx_stk5_u32(0x6FDB8F00u, pRoomEx, ppHead, (u32)(2 + c), (u32)(3 + c), 0x00100101u, pCache, (u32)(1 + (c % 2)));
    snprintf(note, sizeof(note), "i14c2_add_wall_tile_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u,%d,%d,1048833,%u,%d]", pRoomEx, ppHead, 2 + c, 3 + c, pCache, 1 + (c % 2));
    emit_vector(fp, "0x6FDB8F00", "DRLGROOMTILE_AddWallTileData113c", c, note, args, ret, 0xFFFFFFFFu);
  }

  /* 20. 0x6FDB91C0 DRLGROOMTILE_AddLinkedWarpTileData113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pTG;
    u32 pRoomEx = setup_roomex_with_tilegrid(4u, 4u, 8u, 8u, 8u, &pLevel, &pDrlg, &pTG);
    /* No matching pRoomTile -> early return cleanly after checking list */
    u32 pRoomTile = heap_alloc(0x30u);
    u32 pLvlWarp = heap_alloc(0x20u);
    *(u32 *)(usize)(pLvlWarp + 0x00u) = 999u; /* non-matching warp id */
    *(u32 *)(usize)(pRoomTile + 0x10u) = pLvlWarp;
    *(u32 *)(usize)(pRoomEx + 0x4Cu) = pRoomTile;
    if (c == 2) *(u32 *)(usize)(pRoomEx + 0x28u) |= 0x2000u;
    track_region(pRoomTile, 0x30u);
    track_region(pLvlWarp, 0x20u);
    snapshot_pre();
    call_eax_stk4_void(0x6FDB91C0u, 0x00100101u + (u32)c, pRoomEx, (u32)(1 + c), (u32)(2 + c), 0u);
    snprintf(note, sizeof(note), "i14c2_add_linked_warp_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u,%d,%d,0]", 0x00100101u + (u32)c, pRoomEx, 1 + c, 2 + c);
    emit_vector(fp, "0x6FDB91C0", "DRLGROOMTILE_AddLinkedWarpTileData113c", c, note, args, 0u, 0u);
  }

  /* 21. 0x6FDB9360 DRLGROOMTILE_LinkWarpTileToDoorPreset113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pTG;
    u32 pRoomEx = setup_roomex_with_tilegrid(4u, 4u, 8u, 8u, 8u, &pLevel, &pDrlg, &pTG);
    u32 pRoomTile = heap_alloc(0x30u);
    u32 pLvlWarp = heap_alloc(0x40u);
    *(u32 *)(usize)(pLvlWarp + 0x00u) = 0u; /* matches pWarp->dwLevelIds[0] == 0 */
    *(u8 *)(usize)(pLvlWarp + 0x2Cu) = 0x62u; /* 'b' -> skip LvlWarp table reload */
    *(u32 *)(usize)(pRoomTile + 0x10u) = pLvlWarp;
    if (c == 2) *(u32 *)(usize)(pRoomTile + 0x0Cu) = 0x12340000u;
    *(u32 *)(usize)(pRoomEx + 0x4Cu) = pRoomTile;
    u32 pTileData = heap_alloc(0x30u);
    *(u32 *)(usize)(pTileData + 0x00u) = (u32)(10 + c);
    *(u32 *)(usize)(pTileData + 0x04u) = (u32)(10 + c);
    *(u32 *)(usize)(pTileData + 0x08u) = (u32)(1 + c);
    *(u32 *)(usize)(pTileData + 0x0Cu) = (u32)(1 + c);
    track_region(pRoomTile, 0x30u);
    track_region(pLvlWarp, 0x40u);
    track_region(pTileData, 0x30u);
    snapshot_pre();
    call_edi_stk3_void(0x6FDB9360u, pRoomEx, pTileData, 0x00100101u + (u32)c, 0u);
    snprintf(note, sizeof(note), "i14c2_link_warp_door_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u,%u,0]", pRoomEx, pTileData, 0x00100101u + (u32)c);
    emit_vector(fp, "0x6FDB9360", "DRLGROOMTILE_LinkWarpTileToDoorPreset113c", c, note, args, 0u, 0u);
  }

  /* 22. 0x6FDB9470 DRLGROOMTILE_AddTileDataToRoomLink113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pTG;
    u32 pRoomEx = setup_roomex_with_tilegrid(4u, 4u, 8u, 8u, 8u, &pLevel, &pDrlg, &pTG);
    snapshot_pre();
    u32 ret = call_eax_ecx_stk4_u32(0x6FDB9470u, (u32)(1 + (c % 2)), pRoomEx, 0x00100101u, 0u, (u32)(2 + c), (u32)(3 + c));
    snprintf(note, sizeof(note), "i14c2_add_tile_link_c%d", c);
    snprintf(args, sizeof(args), "[%d,%u,1048833,0,%d,%d]", 1 + (c % 2), pRoomEx, 2 + c, 3 + c);
    emit_vector(fp, "0x6FDB9470", "DRLGROOMTILE_AddTileDataToRoomLink113c", c, note, args, ret, 0xFFFFFFFFu);
  }

  /* 23. 0x6FDB95D0 DRLGROOMTILE_UpdateTileData113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pTG;
    u32 pRoomEx = setup_roomex_with_tilegrid(4u, 4u, 8u, 8u, 8u, &pLevel, &pDrlg, &pTG);
    u32 pTileData = heap_alloc(0x30u);
    u32 nTileType = (c == 0) ? 2u : (c == 1) ? 1u : 5u;
    u32 dwFlags = (c == 2) ? 0x00100181u : 0x00100101u;
    *(u32 *)(usize)(pTileData + 0x14u) = 0x00u;
    *(u32 *)(usize)(pTileData + 0x18u) = *(u32 *)(usize)(pRoomEx + 0xDCu);
    *(u32 *)(usize)(pTileData + 0x1Cu) = (c == 1) ? 2u : 1u;
    track_region(pTileData, 0x30u);
    snapshot_pre();
    call_eax_ecx_stk6_void(0x6FDB95D0u, nTileType, pTileData, 0u, pRoomEx, pRoomEx, dwFlags, 8u, 8u);
    snprintf(note, sizeof(note), "i14c2_update_tile_data_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u,0,%u,%u,%u,8,8]", nTileType, pTileData, pRoomEx, pRoomEx, dwFlags);
    emit_vector(fp, "0x6FDB95D0", "DRLGROOMTILE_UpdateTileData113c", c, note, args, 0u, 0u);
  }

  /* 24. 0x6FDB97C0 DRLGROOMTILE_InsertOrUpdateTileAtCoord113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pTG;
    u32 pRoomEx = setup_roomex_with_tilegrid(4u, 4u, 8u, 8u, 8u, &pLevel, &pDrlg, &pTG);
    snapshot_pre();
    call_ecx_ebx_esi_edi_stk3_void(0x6FDB97C0u, pRoomEx, 0x00100101u, (u32)(8 + c), (u32)(8 + c), 0u, pRoomEx, 1u);
    snprintf(note, sizeof(note), "i14c2_insert_update_coord_c%d", c);
    snprintf(args, sizeof(args), "[%u,1048833,%d,%d,0,%u,1]", pRoomEx, 8 + c, 8 + c, pRoomEx);
    emit_vector(fp, "0x6FDB97C0", "DRLGROOMTILE_InsertOrUpdateTileAtCoord113c", c, note, args, 0u, 0u);
  }

  /* 25. 0x6FDB9820 DRLGROOMTILE_ProcessGridCellTile113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pTG;
    u32 pRoomEx = setup_roomex_with_tilegrid(4u, 4u, 8u, 8u, 8u, &pLevel, &pDrlg, &pTG);
    u32 dwFlags = (c == 0) ? 0x00100101u : (c == 1) ? 0x00100102u : 0x08100104u;
    snapshot_pre();
    call_eax_stk6_void(0x6FDB9820u, dwFlags, 0u, pRoomEx, 1u, 0u, (u32)(8 + c), (u32)(8 + c));
    snprintf(note, sizeof(note), "i14c2_proc_grid_cell_c%d", c);
    snprintf(args, sizeof(args), "[%u,0,%u,1,0,%d,%d]", dwFlags, pRoomEx, 8 + c, 8 + c);
    emit_vector(fp, "0x6FDB9820", "DRLGROOMTILE_ProcessGridCellTile113c", c, note, args, 0u, 0u);
  }

  /* 26. 0x6FDB9B50 DRLGROOMTILE_PopulateRoomTileGrid113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pTG;
    u32 pRoomEx = setup_roomex_with_tilegrid(4u, 4u, 16u, 16u, 8u, &pLevel, &pDrlg, &pTG);
    u32 pOutdoorRoom = *(u32 *)(usize)(pRoomEx + 0x20u);
    u32 pGrid1 = pOutdoorRoom + 0x14u;
    u32 pGrid2 = pOutdoorRoom + 0x28u;
    u32 pCells1 = *(u32 *)(usize)pGrid1;
    *(u32 *)(usize)(pCells1 + (u32)c * 4u) = 0x00100102u;
    snapshot_pre();
    call_edi_stk5_void(0x6FDB9B50u, pRoomEx, pGrid1, pGrid2, 0u, (u32)(c & 1), (u32)((c >> 1) & 1));
    snprintf(note, sizeof(note), "i14c2_pop_room_grid_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u,%u,0,%d,%d]", pRoomEx, pGrid1, pGrid2, c & 1, (c >> 1) & 1);
    emit_vector(fp, "0x6FDB9B50", "DRLGROOMTILE_PopulateRoomTileGrid113c", c, note, args, 0u, 0u);
  }

  /* 27..36: drlg-room.ts (10 VAs: 0x6FDCBB20..0x6FDCC470) */
  for (int c = 0; c < 3; c++) {
    /* 27. 0x6FDCBB20 DRLGROOM_DecrementNearRoomsStatus113c */
    reset_heap();
    u32 pLevel, pDrlg, pTG;
    u32 pRoomEx = setup_roomex_with_tilegrid(4u, 4u, 4u, 4u, 4u, &pLevel, &pDrlg, &pTG);
    u32 pNear = heap_alloc(8u);
    u32 pOther = heap_alloc(0x100u);
    *(u32 *)(usize)(pOther + 0x58u) = pLevel;
    *(u8 *)(usize)(pOther + 0x44u) = 0u;
    *(u16 *)(usize)(pOther + 0x0Cu + (u32)c * 2u) = (u16)(2 + c);
    *(u32 *)(usize)(pRoomEx + 0x2Cu) = 1u; /* nRoomsNear */
    *(u32 *)(usize)(pRoomEx + 0x08u) = pNear; /* ppRoomsNear */
    *(u32 *)(usize)pNear = pOther;
    track_region(pNear, 8u); track_region(pOther, 0x100u);
    snapshot_pre();
    call_ecx_dl_void(0x6FDCBB20u, pRoomEx, (u32)c);
    snprintf(note, sizeof(note), "i14c2_dec_near_status_c%d", c);
    snprintf(args, sizeof(args), "[%u,%d]", pRoomEx, c);
    emit_vector(fp, "0x6FDCBB20", "DRLGROOM_DecrementNearRoomsStatus113c", c, note, args, 0u, 0u);
  }

  for (int c = 0; c < 3; c++) {
    /* 28. 0x6FDCBDB0 DRLGROOM_FreeOrUnloadRoomIfStatus4_113c */
    reset_heap();
    u32 pLevel, pDrlg, pTG;
    u32 pRoomEx = setup_roomex_with_tilegrid(4u, 4u, 4u, 4u, 4u, &pLevel, &pDrlg, &pTG);
    *(u32 *)(usize)(pRoomEx + 0x28u) = 0x1000u;
    *(u32 *)(usize)(pRoomEx + 0x54u) = 0u;
    *(u8 *)(usize)(pRoomEx + 0x44u) = (u8)(c == 0 ? 4 : 2);
    snapshot_pre();
    call_ecx_void(0x6FDCBDB0u, pRoomEx);
    snprintf(note, sizeof(note), "i14c2_free_unload_s4_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pRoomEx);
    emit_vector(fp, "0x6FDCBDB0", "DRLGROOM_FreeOrUnloadRoomIfStatus4_113c", c, note, args, 0u, 0u);
  }

  for (int c = 0; c < 3; c++) {
    /* 29. 0x6FDCBEE0 DRLGROOM_EnsureRoomStatus3_113c */
    reset_heap();
    u32 pLevel, pDrlg, pTG;
    u32 pRoomEx = setup_roomex_with_tilegrid(4u, 4u, 4u, 4u, 4u, &pLevel, &pDrlg, &pTG);
    *(u32 *)(usize)(pRoomEx + 0x28u) |= 0x01000000u; /* skip LoadDt1Files */
    *(u8 *)(usize)(pRoomEx + 0x44u) = (u8)(c == 2 ? 3 : (4 + c));
    *(u16 *)(usize)(pRoomEx + 0x10u) = (u16)(c == 1 ? 1 : 0);
    snapshot_pre();
    call_ecx_void(0x6FDCBEE0u, pRoomEx);
    snprintf(note, sizeof(note), "i14c2_ensure_s3_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pRoomEx);
    emit_vector(fp, "0x6FDCBEE0", "DRLGROOM_EnsureRoomStatus3_113c", c, note, args, 0u, 0u);
  }

  for (int c = 0; c < 3; c++) {
    /* 30. 0x6FDCBFA0 DRLGROOM_PropagateRoomStatusIncrement113c */
    reset_heap();
    u32 pLevel, pDrlg, pTG;
    u32 pRoomEx = setup_roomex_with_tilegrid(4u, 4u, 4u, 4u, 4u, &pLevel, &pDrlg, &pTG);
    u32 pNear = heap_alloc(8u);
    u32 pOther = heap_alloc(0x100u);
    *(u32 *)(usize)(pOther + 0x58u) = pLevel;
    *(u8 *)(usize)(pOther + 0x44u) = 0u;
    *(u16 *)(usize)(pOther + 0x0Cu) = 1u;
    *(u32 *)(usize)(pOther + 0x2Cu) = 1u;
    *(u32 *)(usize)(pOther + 0x08u) = pNear;
    *(u32 *)(usize)(pRoomEx + 0x2Cu) = 1u;
    *(u32 *)(usize)(pRoomEx + 0x08u) = pNear;
    *(u32 *)(usize)pNear = pOther;
    track_region(pNear, 8u); track_region(pOther, 0x100u);
    snapshot_pre();
    call_ecx_edx_stk1_void(0x6FDCBFA0u, 0u, pRoomEx, (u32)(1 + c));
    snprintf(note, sizeof(note), "i14c2_prop_status_inc_c%d", c);
    snprintf(args, sizeof(args), "[0,%u,%d]", pRoomEx, 1 + c);
    emit_vector(fp, "0x6FDCBFA0", "DRLGROOM_PropagateRoomStatusIncrement113c", c, note, args, 0u, 0u);
  }

  for (int c = 0; c < 3; c++) {
    /* 31. 0x6FDCC090 DRLGROOM_IncrementRoomAndNeighborsStatus113c */
    reset_heap();
    u32 pLevel, pDrlg, pTG;
    u32 pRoomEx = setup_roomex_with_tilegrid(4u, 4u, 4u, 4u, 4u, &pLevel, &pDrlg, &pTG);
    *(u8 *)(usize)(pRoomEx + 0x04u + (u32)c) = 1u;
    snapshot_pre();
    call_edi_bl_void(0x6FDCC090u, pRoomEx, (u32)c);
    snprintf(note, sizeof(note), "i14c2_inc_room_nbr_c%d", c);
    snprintf(args, sizeof(args), "[%u,%d]", pRoomEx, c);
    emit_vector(fp, "0x6FDCC090", "DRLGROOM_IncrementRoomAndNeighborsStatus113c", c, note, args, 0u, 0u);
  }

  for (int c = 0; c < 3; c++) {
    /* 32. 0x6FDCC0E0 DRLGROOM_BuildRoomGridsAndTiles113c */
    reset_heap();
    u32 pLevel, pDrlg, pTG;
    u32 pRoomEx = setup_roomex_with_tilegrid(8u, 8u, 16u, 16u, 8u, &pLevel, &pDrlg, &pTG);
    *(u32 *)(usize)(pRoomEx + 0x48u) = 1u; /* nType = OUTDOOR */
    *(u32 *)(usize)(pRoomEx + 0x04u) = 0x1111u + (u32)c;
    snapshot_pre();
    call_eax_ecx_void(0x6FDCC0E0u, pRoomEx, 0u);
    snprintf(note, sizeof(note), "i14c2_build_room_grids_c%d", c);
    snprintf(args, sizeof(args), "[%u,0]", pRoomEx);
    emit_vector(fp, "0x6FDCC0E0", "DRLGROOM_BuildRoomGridsAndTiles113c", c, note, args, 0u, 0u);
  }

  for (int c = 0; c < 3; c++) {
    /* 33. 0x6FDCC270 DRLGROOM_EnsureRoomAndGetRoom1_113c */
    reset_heap();
    u32 pLevel, pDrlg, pTG;
    u32 pRoomEx = setup_roomex_with_tilegrid(8u, 8u, 16u, 16u, 8u, &pLevel, &pDrlg, &pTG);
    u32 pRoom1 = heap_alloc(0x80u);
    *(u32 *)(usize)(pRoomEx + 0x30u) = pRoom1; /* already has pRoom1, or test status */
    *(u32 *)(usize)(pRoomEx + 0x48u) = 1u;
    *(u32 *)(usize)(pRoomEx + 0x04u) = 0x2222u + (u32)c;
    track_region(pRoom1, 0x80u);
    snapshot_pre();
    u32 ret = call_eax_u32(0x6FDCC270u, pRoomEx);
    snprintf(note, sizeof(note), "i14c2_ensure_get_r1_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pRoomEx);
    emit_vector(fp, "0x6FDCC270", "DRLGROOM_EnsureRoomAndGetRoom1_113c", c, note, args, ret, 0xFFFFFFFFu);
  }

  for (int c = 0; c < 3; c++) {
    /* 34. 0x6FDCC370 DRLGROOM_InitAndLinkRoomStatus1_113c */
    reset_heap();
    u32 pLevel, pDrlg, pTG;
    u32 pRoomEx = setup_roomex_with_tilegrid(8u, 8u, 16u, 16u, 8u, &pLevel, &pDrlg, &pTG);
    *(u32 *)(usize)(pRoomEx + 0x48u) = 1u;
    *(u8 *)(usize)(pRoomEx + 0x44u) = (u8)c;
    snapshot_pre();
    call_ecx_void(0x6FDCC370u, pRoomEx);
    snprintf(note, sizeof(note), "i14c2_init_link_s1_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pRoomEx);
    emit_vector(fp, "0x6FDCC370", "DRLGROOM_InitAndLinkRoomStatus1_113c", c, note, args, 0u, 0u);
  }

  for (int c = 0; c < 3; c++) {
    /* 35. 0x6FDCC3D0 DRLGROOM_SetRoomStatus2AndInitIfNear_113c */
    reset_heap();
    u32 pLevel, pDrlg, pTG;
    u32 pRoomEx = setup_roomex_with_tilegrid(8u, 8u, 16u, 16u, 8u, &pLevel, &pDrlg, &pTG);
    *(u32 *)(usize)(pRoomEx + 0x48u) = 1u;
    *(u8 *)(usize)(pRoomEx + 0x44u) = (u8)(c == 2 ? 2 : (3 + c));
    snapshot_pre();
    call_ecx_void(0x6FDCC3D0u, pRoomEx);
    snprintf(note, sizeof(note), "i14c2_set_s2_init_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pRoomEx);
    emit_vector(fp, "0x6FDCC3D0", "DRLGROOM_SetRoomStatus2AndInitIfNear_113c", c, note, args, 0u, 0u);
  }

  for (int c = 0; c < 3; c++) {
    /* 36. 0x6FDCC470 DRLGROOM_SetRoomStatus2IfReady_113c */
    reset_heap();
    u32 pLevel, pDrlg, pTG;
    u32 pRoomEx = setup_roomex_with_tilegrid(8u, 8u, 16u, 16u, 8u, &pLevel, &pDrlg, &pTG);
    *(u32 *)(usize)(pRoomEx + 0x48u) = 1u;
    *(u8 *)(usize)(pRoomEx + 0x44u) = (u8)(c == 2 ? 2 : (3 + c));
    snapshot_pre();
    call_ecx_void(0x6FDCC470u, pRoomEx);
    snprintf(note, sizeof(note), "i14c2_set_s2_ready_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pRoomEx);
    emit_vector(fp, "0x6FDCC470", "DRLGROOM_SetRoomStatus2IfReady_113c", c, note, args, 0u, 0u);
  }
}


static u32 setup_outdoors_level_i14(
  u32 *outLevel, u32 *outDrlg, u32 *outOutdoors, u32 *outPrestTbl, u32 *outDt,
  u32 gw, u32 gh, u32 nPrestCount, u32 seedLo
) {
  u32 pLevel    = heap_alloc(0x200u);
  u32 pDrlg     = heap_alloc(0x480u);
  u32 pOutdoors = heap_alloc(0x280u);
  u32 pVtx      = heap_alloc(0x20u);
  u32 dt        = heap_alloc(0x1000u);
  u32 prestTbl  = heap_alloc(nPrestCount * 0x1B0u);

  u32 cells1 = heap_alloc(gw * gh * 4u);
  u32 rows1  = heap_alloc(gh * 4u);
  u32 cells2 = heap_alloc(gw * gh * 4u);
  u32 rows2  = heap_alloc(gh * 4u);
  u32 cells3 = heap_alloc(gw * gh * 4u);
  u32 rows3  = heap_alloc(gh * 4u);
  for (u32 y = 0; y < gh; y++) {
    *(u32 *)(usize)(rows1 + y * 4u) = y * gw;
    *(u32 *)(usize)(rows2 + y * 4u) = y * gw;
    *(u32 *)(usize)(rows3 + y * 4u) = y * gw;
    for (u32 x = 0; x < gw; x++) {
      if (x == 0u || y == 0u || x == gw - 1u || y == gh - 1u) {
        u32 idx = y * gw + x;
        *(u32 *)(usize)(cells1 + idx * 4u) = 1u;
        *(u32 *)(usize)(cells2 + idx * 4u) = 1u;
        *(u32 *)(usize)(cells3 + idx * 4u) = 1u;
      }
    }
  }

  /* Circular 1-node vertex (0,0) -> (0,0) so 0x6FD67180 and 0x6FD676F0 terminate cleanly */
  *(u32 *)(usize)(pVtx + 0x10u) = pVtx;

  *(u32 *)(usize)(pLevel + 0x14u)  = pOutdoors;
  *(u32 *)(usize)(pLevel + 0x24u)  = gw * 8u;
  *(u32 *)(usize)(pLevel + 0x28u)  = gh * 8u;
  *(u32 *)(usize)(pLevel + 0x1B4u) = pDrlg;
  *(u32 *)(usize)(pLevel + 0x1C4u) = seedLo;
  *(u32 *)(usize)(pLevel + 0x1C8u) = 0x29Au;
  *(u32 *)(usize)(pLevel + 0x1D0u) = 2u;
  u32 pLevel1 = heap_alloc(0x200u);
  *(u32 *)(usize)(pLevel1 + 0x24u) = gw * 8u;
  *(u32 *)(usize)(pLevel1 + 0x28u) = gh * 8u;
  *(u32 *)(usize)(pLevel1 + 0x1D0u) = 1u;
  *(u32 *)(usize)(pLevel1 + 0x1F8u) = pLevel;
  *(u32 *)(usize)(pDrlg + 0x47Cu) = pLevel1;
  track_region(pLevel1, 0x200u);

  /* pOutdoors grids at +0x04, +0x18, +0x2C; dims at +0x5C, +0x60; pVertexHead at +0x64 */
  *(u32 *)(usize)(pOutdoors + 0x04u + 0x00u) = cells1;
  *(u32 *)(usize)(pOutdoors + 0x04u + 0x04u) = rows1;
  *(u32 *)(usize)(pOutdoors + 0x04u + 0x08u) = gw;
  *(u32 *)(usize)(pOutdoors + 0x04u + 0x0Cu) = gh;
  *(u32 *)(usize)(pOutdoors + 0x18u + 0x00u) = cells2;
  *(u32 *)(usize)(pOutdoors + 0x18u + 0x04u) = rows2;
  *(u32 *)(usize)(pOutdoors + 0x18u + 0x08u) = gw;
  *(u32 *)(usize)(pOutdoors + 0x18u + 0x0Cu) = gh;
  *(u32 *)(usize)(pOutdoors + 0x2Cu + 0x00u) = cells3;
  *(u32 *)(usize)(pOutdoors + 0x2Cu + 0x04u) = rows3;
  *(u32 *)(usize)(pOutdoors + 0x2Cu + 0x08u) = gw;
  *(u32 *)(usize)(pOutdoors + 0x2Cu + 0x0Cu) = gh;
  *(u32 *)(usize)(pOutdoors + 0x5Cu) = gw;
  *(u32 *)(usize)(pOutdoors + 0x60u) = gh;
  *(u32 *)(usize)(pOutdoors + 0x64u) = pVtx;
  *(i32 *)(usize)(pOutdoors + 0x268u) = -1;

  for (u32 i = 0; i < nPrestCount; i++) {
    u32 rec = prestTbl + i * 0x1B0u;
    *(u32 *)(usize)(rec + 0x00u) = i;
    *(u32 *)(usize)(rec + 0x34u) = 1u;
    *(u32 *)(usize)(rec + 0x38u) = 1u;
    *(u32 *)(usize)(rec + 0x40u) = 1u;
    *(u32 *)(usize)(rec + 0x44u) = 1u;
  }
  *(u32 *)(usize)(dt + 0xC68u) = nPrestCount;
  *(u32 *)(usize)(dt + 0xC64u) = prestTbl;
  u32 lvlTbl = heap_alloc(136u * 0x9Cu);
  *(u32 *)(usize)(dt + 0xC5Cu) = 136u;
  *(u32 *)(usize)0x6FDF0B38u = lvlTbl;
  u32 lvlSubTbl = heap_alloc(4u * 0x15Cu);
  u32 lvlSubIdx = heap_alloc(16u * 4u);
  for (u32 si = 0; si < 4u; si++) {
    *(u32 *)(usize)(lvlSubTbl + si * 0x15Cu + 0x00u) = 0xFFFFFFFFu;
    *(u32 *)(usize)(lvlSubTbl + si * 0x15Cu + 0x4Cu) = 4u;
  }
  *(u32 *)(usize)0x6FDF143Cu = lvlSubTbl;
  *(u32 *)(usize)0x6FDF1440u = 4u;
  *(u32 *)(usize)0x6FDF1444u = lvlSubIdx;
  track_region(lvlTbl, 136u * 0x9Cu);
  track_region(lvlSubTbl, 4u * 0x15Cu);
  track_region(lvlSubIdx, 64u);
  track_region(0x6FDF0B38u, 4u);
  track_region(0x6FDF143Cu, 12u);
  track_region(0x6FDE4020u, 32u);
  track_region(0x6FDDCAB8u, 16u);

  track_region(pLevel, 0x200u);
  track_region(pDrlg, 0x480u);
  track_region(pOutdoors, 0x280u);
  track_region(pVtx, 0x20u);
  track_region(dt, 0x1000u);
  track_region(prestTbl, nPrestCount * 0x1B0u);
  track_region(cells1, gw * gh * 4u); track_region(rows1, gh * 4u);
  track_region(cells2, gw * gh * 4u); track_region(rows2, gh * 4u);
  track_region(cells3, gw * gh * 4u); track_region(rows3, gh * 4u);

  if (outLevel)    *outLevel    = pLevel;
  if (outDrlg)     *outDrlg     = pDrlg;
  if (outOutdoors) *outOutdoors = pOutdoors;
  if (outPrestTbl) *outPrestTbl = prestTbl;
  if (outDt)       *outDt       = dt;
  return pLevel;
}

static u32 setup_subst_ctx(u32 gw, u32 gh, u32 *outLvlSub, u32 *outBox) {
  u32 ctx    = heap_alloc(0x40u);
  u32 pLevel = heap_alloc(0x200u);
  u32 pDrlg  = heap_alloc(0x480u);
  u32 pGrid0 = heap_alloc(0x14u);
  u32 pGrid1 = heap_alloc(0x14u);
  u32 pGrid2 = heap_alloc(0x14u);
  u32 c0 = heap_alloc(gw * gh * 4u); u32 r0 = heap_alloc(gh * 4u);
  u32 c1 = heap_alloc(gw * gh * 4u); u32 r1 = heap_alloc(gh * 4u);
  u32 c2 = heap_alloc(gw * gh * 4u); u32 r2 = heap_alloc(gh * 4u);
  for (u32 y = 0; y < gh; y++) {
    *(u32 *)(usize)(r0 + y * 4u) = y * gw;
    *(u32 *)(usize)(r1 + y * 4u) = y * gw;
    *(u32 *)(usize)(r2 + y * 4u) = y * gw;
  }
  *(u32 *)(usize)(pGrid0 + 0u) = c0; *(u32 *)(usize)(pGrid0 + 4u) = r0; *(u32 *)(usize)(pGrid0 + 8u) = gw; *(u32 *)(usize)(pGrid0 + 12u) = gh;
  *(u32 *)(usize)(pGrid1 + 0u) = c1; *(u32 *)(usize)(pGrid1 + 4u) = r1; *(u32 *)(usize)(pGrid1 + 8u) = gw; *(u32 *)(usize)(pGrid1 + 12u) = gh;
  *(u32 *)(usize)(pGrid2 + 0u) = c2; *(u32 *)(usize)(pGrid2 + 4u) = r2; *(u32 *)(usize)(pGrid2 + 8u) = gw; *(u32 *)(usize)(pGrid2 + 12u) = gh;

  u32 pOutdoors = heap_alloc(0x280u);
  *(u32 *)(usize)(pLevel + 0x14u) = pOutdoors;
  *(u32 *)(usize)(pLevel + 0x1B4u) = pDrlg;
  *(u32 *)(usize)(pLevel + 0x1C4u) = 0x5555u;
  *(u32 *)(usize)(pLevel + 0x1C8u) = 0x29Au;
  track_region(pOutdoors, 0x280u);

  *(u32 *)(usize)(ctx + 0x00u) = pLevel;
  *(u32 *)(usize)(ctx + 0x04u) = pGrid0;
  *(u32 *)(usize)(ctx + 0x08u) = pGrid1;
  *(u32 *)(usize)(ctx + 0x0Cu) = pGrid2;
  *(i32 *)(usize)(ctx + 0x14u) = -1; /* nSubTheme */
  *(u32 *)(usize)(ctx + 0x18u) = 0u; /* nSubType */
  *(u32 *)(usize)(ctx + 0x2Cu) = (u32)(usize)&stub_ctx_cb1;
  *(u32 *)(usize)(ctx + 0x30u) = (u32)(usize)&stub_ctx_cb1;
  *(u32 *)(usize)(ctx + 0x34u) = (u32)(usize)&stub_ctx_cb1;

  u32 pLvlSub = heap_alloc(0x180u);
  *(i32 *)(usize)(pLvlSub + 0x00u) = 0;
  *(u32 *)(usize)(pLvlSub + 0x04u) = 1u; /* bLoaded */
  *(u32 *)(usize)(pLvlSub + 0x0Cu) = 0u; /* nBlocks = 0 */

  u32 pBox = heap_alloc(0x20u);
  *(u32 *)(usize)(pBox + 0x00u) = 0u;
  *(u32 *)(usize)(pBox + 0x04u) = 0u;
  *(u32 *)(usize)(pBox + 0x08u) = 2u;
  *(u32 *)(usize)(pBox + 0x0Cu) = 2u;

  track_region(ctx, 0x40u); track_region(pLevel, 0x200u); track_region(pDrlg, 0x480u);
  track_region(pGrid0, 0x14u); track_region(pGrid1, 0x14u); track_region(pGrid2, 0x14u);
  track_region(c0, gw * gh * 4u); track_region(r0, gh * 4u);
  track_region(c1, gw * gh * 4u); track_region(r1, gh * 4u);
  track_region(c2, gw * gh * 4u); track_region(r2, gh * 4u);
  track_region(pLvlSub, 0x180u); track_region(pBox, 0x20u);
  track_region(0x6FDF147Cu, 8u);
  if (outLvlSub) *outLvlSub = pLvlSub;
  if (outBox) *outBox = pBox;
  return ctx;
}

static void emit_i14c_3(FILE *fp) {
  char args[256], note[64];
  u32 *pSgpt = (u32 *)(usize)0x6FDE9E1Cu;
  u32 *pPrestGlobal = (u32 *)(usize)0x6FDF0B3Cu;
  u32 savedSgpt = *pSgpt;
  u32 savedPrest = *pPrestGlobal;

  /* 37. 0x6FDD3CA0 DRLGTILESUB_LoadLvlSubDs1Grids113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLvlSub, pBox;
    u32 ctx = setup_subst_ctx(8u, 8u, &pLvlSub, &pBox);
    (void)ctx;
    *(u32 *)(usize)(pLvlSub + 0x17Cu) = 0u; /* bAlreadyLoaded/flag */
    *(i32 *)(usize)(pLvlSub + 0x138u) = -1; /* nSubTheme */
    *(u32 *)(usize)(pLvlSub + 0x04u) = (u32)c;
    snapshot_pre();
    call_ecx_stk1_void(0x6FDD3CA0u, 0u, pLvlSub);
    snprintf(note, sizeof(note), "i14c3_load_lvlsub_c%d", c);
    snprintf(args, sizeof(args), "[0,%u]", pLvlSub);
    emit_vector(fp, "0x6FDD3CA0", "DRLGTILESUB_LoadLvlSubDs1Grids113c", c, note, args, 0u, 0u);
  }

  /* 38. 0x6FDD4190 DRLGTILESUB_ApplySubThemeByIndex113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLvlSub, pBox;
    u32 ctx = setup_subst_ctx(8u, 8u, &pLvlSub, &pBox);
    *(i32 *)(usize)(ctx + 0x14u) = -1; /* nSubTheme = -1 -> no-op after checking table */
    *(u32 *)(usize)(ctx + 0x18u) = (u32)c;
    u32 dt = heap_alloc(0x1000u);
    *pSgpt = dt;
    u32 lvlSubTbl = heap_alloc(4u * 0x15Cu);
    u32 lvlSubIdx = heap_alloc(16u * 4u);
    for (u32 si = 0; si < 4u; si++) {
      *(u32 *)(usize)(lvlSubTbl + si * 0x15Cu + 0x00u) = si;
      *(u32 *)(usize)(lvlSubTbl + si * 0x15Cu + 0x4Cu) = 4u;
      *(u32 *)(usize)(lvlSubIdx + si * 4u) = si;
    }
    *(u32 *)(usize)0x6FDF143Cu = lvlSubTbl;
    *(u32 *)(usize)0x6FDF1440u = 4u;
    *(u32 *)(usize)0x6FDF1444u = lvlSubIdx;
    track_region(dt, 0x1000u);
    track_region(lvlSubTbl, 4u * 0x15Cu);
    track_region(lvlSubIdx, 64u);
    track_region(0x6FDE9E1Cu, 4u);
    track_region(0x6FDF143Cu, 12u);
    snapshot_pre();
    call_esi_void(0x6FDD4190u, ctx);
    snprintf(note, sizeof(note), "i14c3_apply_subtheme_c%d", c);
    snprintf(args, sizeof(args), "[%u]", ctx);
    emit_vector(fp, "0x6FDD4190", "DRLGTILESUB_ApplySubThemeByIndex113c", c, note, args, 0u, 0u);
  }

  /* 39. 0x6FDD4220 DRLGTILESUB_StampRoomTemplate113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLvlSub, pBox;
    u32 ctx = setup_subst_ctx(8u, 8u, &pLvlSub, &pBox);
    u32 pRoomEx = heap_alloc(0x100u);
    u32 pTG = heap_alloc(0x40u);
    u32 pWalls = heap_alloc(16u * 0x30u);
    u32 pFloors = heap_alloc(16u * 0x30u);
    u32 pRoofs = heap_alloc(16u * 0x30u);
    *(u32 *)(usize)(pTG + 0x14u) = pWalls; *(u32 *)(usize)(pTG + 0x18u) = 16u;
    *(u32 *)(usize)(pTG + 0x1Cu) = pFloors; *(u32 *)(usize)(pTG + 0x20u) = 16u;
    *(u32 *)(usize)(pTG + 0x24u) = pRoofs; *(u32 *)(usize)(pTG + 0x28u) = 16u;
    *(u32 *)(usize)(pRoomEx + 0x54u) = pTG;
    *(u32 *)(usize)(ctx + 0x00u) = pRoomEx;
    g_alloc_in_arena = 1;
    call_ecx_stk1_void(0x6FDD3CA0u, 0u, pLvlSub);
    g_alloc_in_arena = 0;
    *(u32 *)(usize)(*(u32 *)(usize)(pLvlSub + 0x54u) + 0u) = 0x100u + (u32)c * 0x100u;
    track_region(pRoomEx, 0x100u); track_region(pTG, 0x40u);
    track_region(pWalls, 16u * 0x30u); track_region(pFloors, 16u * 0x30u); track_region(pRoofs, 16u * 0x30u);
    snapshot_pre();
    fn_std7_void_t fn = (fn_std7_void_t)(usize)0x6FDD4220u;
    fn((u32)c, (u32)c, 0u, ctx, pBox, pLvlSub, 0u);
    snprintf(note, sizeof(note), "i14c3_stamp_room_tpl_c%d", c);
    snprintf(args, sizeof(args), "[%d,%d,0,%u,%u,%u,0]", c, c, ctx, pBox, pLvlSub);
    emit_vector(fp, "0x6FDD4220", "DRLGTILESUB_StampRoomTemplate113c", c, note, args, 0u, 0u);
  }

  /* 40. 0x6FDD4500 DRLGTILESUB_StampRandomTemplates113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLvlSub, pBox;
    u32 ctx = setup_subst_ctx(8u, 8u, &pLvlSub, &pBox);
    u32 pLevel = *(u32 *)(usize)(ctx + 0x00u);
    u32 pRoomEx = heap_alloc(0x100u);
    u32 pTG = heap_alloc(0x40u);
    u32 pWalls = heap_alloc(16u * 0x30u);
    u32 pFloors = heap_alloc(16u * 0x30u);
    u32 pRoofs = heap_alloc(16u * 0x30u);
    *(u32 *)(usize)(pTG + 0x14u) = pWalls; *(u32 *)(usize)(pTG + 0x18u) = 16u;
    *(u32 *)(usize)(pTG + 0x1Cu) = pFloors; *(u32 *)(usize)(pTG + 0x20u) = 16u;
    *(u32 *)(usize)(pTG + 0x24u) = pRoofs; *(u32 *)(usize)(pTG + 0x28u) = 16u;
    *(u32 *)(usize)(pRoomEx + 0x14u) = 0x5555u + (u32)c;
    *(u32 *)(usize)(pRoomEx + 0x18u) = 0x29Au;
    *(u32 *)(usize)(pRoomEx + 0x3Cu) = 8u;
    *(u32 *)(usize)(pRoomEx + 0x40u) = 8u;
    *(u32 *)(usize)(pRoomEx + 0x54u) = pTG;
    *(u32 *)(usize)(pRoomEx + 0x58u) = pLevel;
    *(u32 *)(usize)(ctx + 0x00u) = pRoomEx;
    *(u32 *)(usize)(ctx + 0x34u) = 0u; /* nDifficulty = 0 */
    g_alloc_in_arena = 1;
    call_ecx_stk1_void(0x6FDD3CA0u, 0u, pLvlSub);
    g_alloc_in_arena = 0;
    *(u32 *)(usize)(pLvlSub + 0x0Cu) = 0u;
    *(i32 *)(usize)(pLvlSub + 0x144u) = 1 + c;
    track_region(pRoomEx, 0x100u); track_region(pTG, 0x40u);
    track_region(pWalls, 16u * 0x30u); track_region(pFloors, 16u * 0x30u); track_region(pRoofs, 16u * 0x30u);
    snapshot_pre();
    fn_std2_void_t fn = (fn_std2_void_t)(usize)0x6FDD4500u;
    fn(ctx, pLvlSub);
    snprintf(note, sizeof(note), "i14c3_stamp_rand_tpl_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u]", ctx, pLvlSub);
    emit_vector(fp, "0x6FDD4500", "DRLGTILESUB_StampRandomTemplates113c", c, note, args, 0u, 0u);
  }

  /* 41. 0x6FDD4890 DRLGTILESUB_StampMatchedTemplates113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLvlSub, pBox;
    u32 ctx = setup_subst_ctx(8u, 8u, &pLvlSub, &pBox);
    u32 pLevel = *(u32 *)(usize)(ctx + 0x00u);
    u32 pRoomEx = heap_alloc(0x100u);
    u32 pTG = heap_alloc(0x40u);
    u32 pWalls = heap_alloc(16u * 0x30u);
    u32 pFloors = heap_alloc(16u * 0x30u);
    u32 pRoofs = heap_alloc(16u * 0x30u);
    *(u32 *)(usize)(pTG + 0x14u) = pWalls; *(u32 *)(usize)(pTG + 0x18u) = 16u;
    *(u32 *)(usize)(pTG + 0x1Cu) = pFloors; *(u32 *)(usize)(pTG + 0x20u) = 16u;
    *(u32 *)(usize)(pTG + 0x24u) = pRoofs; *(u32 *)(usize)(pTG + 0x28u) = 16u;
    *(u32 *)(usize)(pRoomEx + 0x14u) = 0x5555u + (u32)c;
    *(u32 *)(usize)(pRoomEx + 0x18u) = 0x29Au;
    *(u32 *)(usize)(pRoomEx + 0x3Cu) = 8u;
    *(u32 *)(usize)(pRoomEx + 0x40u) = 8u;
    *(u32 *)(usize)(pRoomEx + 0x54u) = pTG;
    *(u32 *)(usize)(pRoomEx + 0x58u) = pLevel;
    *(u32 *)(usize)(ctx + 0x00u) = pRoomEx;
    *(u32 *)(usize)(ctx + 0x34u) = 0u; /* nDifficulty = 0 */
    g_alloc_in_arena = 1;
    call_ecx_stk1_void(0x6FDD3CA0u, 0u, pLvlSub);
    g_alloc_in_arena = 0;
    *(u32 *)(usize)(*(u32 *)(usize)(pLvlSub + 0x54u) + 0u) = 0x200u + (u32)c * 0x100u;
    *(u32 *)(usize)(pLvlSub + 0x0Cu) = 0u;
    *(i32 *)(usize)(pLvlSub + 0x144u) = 1 + c;
    track_region(pRoomEx, 0x100u); track_region(pTG, 0x40u);
    track_region(pWalls, 16u * 0x30u); track_region(pFloors, 16u * 0x30u); track_region(pRoofs, 16u * 0x30u);
    snapshot_pre();
    fn_std2_void_t fn = (fn_std2_void_t)(usize)0x6FDD4890u;
    fn(ctx, pLvlSub);
    snprintf(note, sizeof(note), "i14c3_stamp_match_tpl_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u]", ctx, pLvlSub);
    emit_vector(fp, "0x6FDD4890", "DRLGTILESUB_StampMatchedTemplates113c", c, note, args, 0u, 0u);
  }

  /* 42. 0x6FDD4AD0 DRLGTILESUB_InitSubTheme113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLvlSub, pBox;
    u32 ctx = setup_subst_ctx(8u, 8u, &pLvlSub, &pBox);
    u32 pLevel = *(u32 *)(usize)(ctx + 0x00u);
    u32 pRoomEx = heap_alloc(0x100u);
    *(u32 *)(usize)(pRoomEx + 0x14u) = 0x5555u + (u32)c;
    *(u32 *)(usize)(pRoomEx + 0x18u) = 0x29Au;
    *(u32 *)(usize)(pRoomEx + 0x3Cu) = 8u;
    *(u32 *)(usize)(pRoomEx + 0x40u) = 8u;
    *(u32 *)(usize)(pRoomEx + 0x58u) = pLevel;
    *(u32 *)(usize)(ctx + 0x00u) = pRoomEx;
    *(i32 *)(usize)(ctx + 0x30u) = c;
    *(u32 *)(usize)(ctx + 0x34u) = 0u;
    *(u32 *)(usize)(ctx + 0x38u) = 1u;
    u32 dt = heap_alloc(0x1000u);
    *pSgpt = dt;
    u32 lvlSubTbl = heap_alloc(4u * 0x15Cu);
    u32 lvlSubIdx = heap_alloc(16u * 4u);
    for (u32 si = 0; si < 4u; si++) {
      *(u32 *)(usize)(lvlSubIdx + si * 4u) = si;
      *(u32 *)(usize)(lvlSubTbl + si * 0x15Cu + 0x00u) = si;
      *(u32 *)(usize)(lvlSubTbl + si * 0x15Cu + 0x04u) = si;
    }
    *(u32 *)(usize)0x6FDF143Cu = lvlSubTbl;
    *(u32 *)(usize)0x6FDF1440u = 4u;
    *(u32 *)(usize)0x6FDF1444u = lvlSubIdx;
    track_region(pRoomEx, 0x100u);
    track_region(dt, 0x1000u);
    track_region(lvlSubTbl, 4u * 0x15Cu);
    track_region(lvlSubIdx, 64u);
    track_region(0x6FDE9E1Cu, 4u);
    track_region(0x6FDF143Cu, 12u);
    snapshot_pre();
    call_edi_void(0x6FDD4AD0u, ctx);
    snprintf(note, sizeof(note), "i14c3_init_subtheme_c%d", c);
    snprintf(args, sizeof(args), "[%u]", ctx);
    emit_vector(fp, "0x6FDD4AD0", "DRLGTILESUB_InitSubTheme113c", c, note, args, 0u, 0u);
  }

  /* 43. 0x6FDCEDC0 DRLGOUTWILD_SpawnOptionalBorderPair113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pOutdoors, prestTbl, dt;
    setup_outdoors_level_i14(&pLevel, &pDrlg, &pOutdoors, &prestTbl, &dt, 10u, 10u, 200u, 0x1111u + (u32)c);
    *pSgpt = dt; *pPrestGlobal = prestTbl;
    track_region(0x6FDE9E1Cu, 4u); track_region(0x6FDF0B3Cu, 4u);
    snapshot_pre();
    call_eax_esi_stk1_void(0x6FDCEDC0u, (u32)(20u + c), pLevel, (u32)(c & 1));
    snprintf(note, sizeof(note), "i14c3_opt_border_pair_c%d", c);
    snprintf(args, sizeof(args), "[%d,%u,%d]", 20 + c, pLevel, c & 1);
    emit_vector(fp, "0x6FDCEDC0", "DRLGOUTWILD_SpawnOptionalBorderPair113c", c, note, args, 0u, 0u);
  }

  /* 44. 0x6FDCEE50 DRLGOUTWILD_SpawnSpecialOutdoorEdgesAndWaypoint113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pOutdoors, prestTbl, dt;
    setup_outdoors_level_i14(&pLevel, &pDrlg, &pOutdoors, &prestTbl, &dt, 10u, 10u, 200u, 0x2222u + (u32)c);
    *pSgpt = dt; *pPrestGlobal = prestTbl;
    *(u32 *)(usize)(pLevel + 0x1D0u) = (u32)(2 + c);
    track_region(0x6FDE9E1Cu, 4u); track_region(0x6FDF0B3Cu, 4u);
    snapshot_pre();
    call_eax_void(0x6FDCEE50u, pLevel);
    snprintf(note, sizeof(note), "i14c3_special_edges_wp_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pLevel);
    emit_vector(fp, "0x6FDCEE50", "DRLGOUTWILD_SpawnSpecialOutdoorEdgesAndWaypoint113c", c, note, args, 0u, 0u);
  }

  /* 45. 0x6FDCF180 DRLGOUTWILD_SpawnAct1OutdoorPresetsByLevel113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pOutdoors, prestTbl, dt;
    setup_outdoors_level_i14(&pLevel, &pDrlg, &pOutdoors, &prestTbl, &dt, 10u, 10u, 200u, 0x3333u + (u32)c);
    *pSgpt = dt; *pPrestGlobal = prestTbl;
    *(u32 *)(usize)(pLevel + 0x1D0u) = (u32)(3 + c);
    track_region(0x6FDE9E1Cu, 4u); track_region(0x6FDF0B3Cu, 4u);
    snapshot_pre();
    call_eax_void(0x6FDCF180u, pLevel);
    snprintf(note, sizeof(note), "i14c3_act1_presets_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pLevel);
    emit_vector(fp, "0x6FDCF180", "DRLGOUTWILD_SpawnAct1OutdoorPresetsByLevel113c", c, note, args, 0u, 0u);
  }

  /* 46. 0x6FDCF3A0 DRLGOUTWILD_InitAct1OutdoorLevel113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pOutdoors, prestTbl, dt;
    setup_outdoors_level_i14(&pLevel, &pDrlg, &pOutdoors, &prestTbl, &dt, 10u, 10u, 200u, 0x4444u + (u32)c);
    *pSgpt = dt; *pPrestGlobal = prestTbl;
    *(u32 *)(usize)(pLevel + 0x1D0u) = (u32)(3 + c);
    track_region(0x6FDE9E1Cu, 4u); track_region(0x6FDF0B3Cu, 4u);
    snapshot_pre();
    call_eax_void(0x6FDCF3A0u, pLevel);
    snprintf(note, sizeof(note), "i14c3_init_act1_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pLevel);
    emit_vector(fp, "0x6FDCF3A0", "DRLGOUTWILD_InitAct1OutdoorLevel113c", c, note, args, 0u, 0u);
  }

  /* 47. 0x6FDD4E40 DRLGOUTJUNG_SpawnRandomPresetRange113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pOutdoors, prestTbl, dt;
    setup_outdoors_level_i14(&pLevel, &pDrlg, &pOutdoors, &prestTbl, &dt, 8u, 8u, 700u, 0x5555u + (u32)c);
    *pSgpt = dt; *pPrestGlobal = prestTbl;
    track_region(0x6FDE9E1Cu, 4u); track_region(0x6FDF0B3Cu, 4u);
    snapshot_pre();
    call_eax_esi_stk2_void(0x6FDD4E40u, 0x269u, pLevel, 0x268u, (u32)(1 + c));
    snprintf(note, sizeof(note), "i14c3_jung_rand_range_c%d", c);
    snprintf(args, sizeof(args), "[%u,617,616,%d]", pLevel, 1 + c);
    emit_vector(fp, "0x6FDD4E40", "DRLGOUTJUNG_SpawnRandomPresetRange113c", c, note, args, 0u, 0u);
  }

  /* 48. 0x6FDD50D0 DRLGOUTJUNG_SpawnAct3KurastBazaarBorders113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pOutdoors, prestTbl, dt;
    setup_outdoors_level_i14(&pLevel, &pDrlg, &pOutdoors, &prestTbl, &dt, 10u + (u32)c * 2u, 10u + (u32)c * 2u, 700u, 0x6666u + (u32)c);
    *pSgpt = dt; *pPrestGlobal = prestTbl;
    *(u32 *)(usize)(pDrlg + 0x474u) = (u32)(c & 1);
    track_region(0x6FDE9E1Cu, 4u); track_region(0x6FDF0B3Cu, 4u);
    snapshot_pre();
    call_esi_void(0x6FDD50D0u, pLevel);
    snprintf(note, sizeof(note), "i14c3_kurast_bazaar_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pLevel);
    emit_vector(fp, "0x6FDD50D0", "DRLGOUTJUNG_SpawnAct3KurastBazaarBorders113c", c, note, args, 0u, 0u);
  }

  /* 49. 0x6FDD5220 DRLGOUTJUNG_SpawnAct3LowerKurastBorders113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pOutdoors, prestTbl, dt;
    setup_outdoors_level_i14(&pLevel, &pDrlg, &pOutdoors, &prestTbl, &dt, 10u + (u32)c * 2u, 10u + (u32)c * 2u, 700u, 0x7777u + (u32)c);
    *pSgpt = dt; *pPrestGlobal = prestTbl;
    *(u32 *)(usize)(pDrlg + 0x474u) = (u32)(c & 1);
    track_region(0x6FDE9E1Cu, 4u); track_region(0x6FDF0B3Cu, 4u);
    snapshot_pre();
    call_edi_void(0x6FDD5220u, pLevel);
    snprintf(note, sizeof(note), "i14c3_lower_kurast_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pLevel);
    emit_vector(fp, "0x6FDD5220", "DRLGOUTJUNG_SpawnAct3LowerKurastBorders113c", c, note, args, 0u, 0u);
  }

  /* 50. 0x6FDD5360 DRLGOUTJUNG_SpawnAct3GreatMarshBorders113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pOutdoors, prestTbl, dt;
    setup_outdoors_level_i14(&pLevel, &pDrlg, &pOutdoors, &prestTbl, &dt, 10u + (u32)c * 2u, 10u + (u32)c * 2u, 700u, 0x8888u + (u32)c);
    *pSgpt = dt; *pPrestGlobal = prestTbl;
    *(u32 *)(usize)(pDrlg + 0x474u) = (u32)(c & 1);
    track_region(0x6FDE9E1Cu, 4u); track_region(0x6FDF0B3Cu, 4u);
    snapshot_pre();
    call_edi_void(0x6FDD5360u, pLevel);
    snprintf(note, sizeof(note), "i14c3_great_marsh_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pLevel);
    emit_vector(fp, "0x6FDD5360", "DRLGOUTJUNG_SpawnAct3GreatMarshBorders113c", c, note, args, 0u, 0u);
  }

  /* 51. 0x6FDD56C0 DRLGOUTJUNG_SpawnAct3CityPresetsByLevel113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pOutdoors, prestTbl, dt;
    setup_outdoors_level_i14(&pLevel, &pDrlg, &pOutdoors, &prestTbl, &dt, 12u, 12u, 700u, 0x9999u + (u32)c);
    *pSgpt = dt; *pPrestGlobal = prestTbl;
    *(u32 *)(usize)(pLevel + 0x1D0u) = (u32)(0x4Fu + c);
    track_region(0x6FDE9E1Cu, 4u); track_region(0x6FDF0B3Cu, 4u);
    snapshot_pre();
    call_eax_void(0x6FDD56C0u, pLevel);
    snprintf(note, sizeof(note), "i14c3_act3_city_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pLevel);
    emit_vector(fp, "0x6FDD56C0", "DRLGOUTJUNG_SpawnAct3CityPresetsByLevel113c", c, note, args, 0u, 0u);
  }

  /* 52. 0x6FDD5DF0 DRLGOUTJUNG_SpawnAct2DryHillsBorders113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pOutdoors, prestTbl, dt;
    setup_outdoors_level_i14(&pLevel, &pDrlg, &pOutdoors, &prestTbl, &dt, 10u + (u32)c * 2u, 10u + (u32)c * 2u, 700u, 0xAAAAu + (u32)c);
    *pSgpt = dt; *pPrestGlobal = prestTbl;
    u32 lvlSubTbl = *(u32 *)(usize)0x6FDF143Cu;
    u32 lvlSubIdx = *(u32 *)(usize)0x6FDF1444u;
    u32 pSubData = heap_alloc(0x80u);
    u32 pSubGroups = heap_alloc(2u * 24u);
    *(u32 *)(usize)(lvlSubIdx + 2u * 4u) = 0u;
    *(u32 *)(usize)(lvlSubTbl + 0x00u) = 2u;
    *(u32 *)(usize)(lvlSubTbl + 0x44u) = 0u;
    *(u32 *)(usize)(lvlSubTbl + 0x4Cu) = 1u;
    *(u32 *)(usize)(lvlSubTbl + 0x50u) = pSubData;
    *(u32 *)(usize)(pSubData + 0x4Cu) = 2u;
    *(u32 *)(usize)(pSubData + 0x50u) = pSubGroups;
    *(u32 *)(usize)(pSubGroups + 0x08u) = 2u;
    *(u32 *)(usize)(pSubGroups + 0x0Cu) = 2u;
    *(u32 *)(usize)(pSubGroups + 24u + 0x08u) = 2u;
    *(u32 *)(usize)(pSubGroups + 24u + 0x0Cu) = 2u;
    track_region(pSubData, 0x80u);
    track_region(pSubGroups, 48u);
    track_region(0x6FDE9E1Cu, 4u); track_region(0x6FDF0B3Cu, 4u);
    snapshot_pre();
    call_esi_void(0x6FDD5DF0u, pLevel);
    snprintf(note, sizeof(note), "i14c3_act2_dry_hills_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pLevel);
    emit_vector(fp, "0x6FDD5DF0", "DRLGOUTJUNG_SpawnAct2DryHillsBorders113c", c, note, args, 0u, 0u);
  }

  /* 53. 0x6FDD5E20 DRLGOUTJUNG_InitAct2OutdoorLevel113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pOutdoors, prestTbl, dt;
    setup_outdoors_level_i14(&pLevel, &pDrlg, &pOutdoors, &prestTbl, &dt, 12u, 12u, 700u, 0xBBBBu + (u32)c);
    *pSgpt = dt; *pPrestGlobal = prestTbl;
    *(u32 *)(usize)(pLevel + 0x1D0u) = (c == 2) ? 0x86u : (u32)(0x2Du + c); /* 0x2D = case 4, 0x2E = case 5, 0x86 = case 6 */
    track_region(0x6FDE9E1Cu, 4u); track_region(0x6FDF0B3Cu, 4u);
    snapshot_pre();
    call_eax_void(0x6FDD5E20u, pLevel);
    snprintf(note, sizeof(note), "i14c3_init_act2_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pLevel);
    emit_vector(fp, "0x6FDD5E20", "DRLGOUTJUNG_InitAct2OutdoorLevel113c", c, note, args, 0u, 0u);
  }

  /* 54. 0x6FDD61A0 DRLGOUTJUNG_InitAct4OutdoorLevel113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pOutdoors, prestTbl, dt;
    setup_outdoors_level_i14(&pLevel, &pDrlg, &pOutdoors, &prestTbl, &dt, 16u, 16u, 900u, 0xCCCCu + (u32)c);
    *pSgpt = dt; *pPrestGlobal = prestTbl;
    *(u32 *)(usize)(pLevel + 0x1D0u) = (c == 0) ? 0x6Cu : (c == 1) ? 0x68u : 0x69u;
    track_region(0x6FDE9E1Cu, 4u); track_region(0x6FDF0B3Cu, 4u);
    snapshot_pre();
    call_eax_void(0x6FDD61A0u, pLevel);
    snprintf(note, sizeof(note), "i14c3_init_act4_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pLevel);
    emit_vector(fp, "0x6FDD61A0", "DRLGOUTJUNG_InitAct4OutdoorLevel113c", c, note, args, 0u, 0u);
  }

  *pSgpt = savedSgpt; *pPrestGlobal = savedPrest;
}

int main(int argc, char **argv) {
  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX);
  SetUnhandledExceptionFilter(crash_filter);
  const char *out1 = (argc > 1) ? argv[1] : "tests/fixtures/oracle/k1/i14c-1-vectors.ndjson";
  const char *out2 = (argc > 2) ? argv[2] : "tests/fixtures/oracle/k1/i14c-2-vectors.ndjson";
  const char *out3 = (argc > 3) ? argv[3] : "tests/fixtures/oracle/k1/i14c-3-vectors.ndjson";

  const char *d2_dir = getenv("D2_DATA_DIR");
  if (d2_dir && d2_dir[0]) SetDllDirectoryA(d2_dir);
  else SetDllDirectoryA("samples/d2");

  HMODULE hDll = LoadLibraryA("D2Common.dll");
  if (!hDll && d2_dir && d2_dir[0]) {
    char fullPath[512];
    snprintf(fullPath, sizeof(fullPath), "%s/D2Common.dll", d2_dir);
    hDll = LoadLibraryA(fullPath);
  }
  if (!hDll) hDll = LoadLibraryA("samples/d2/D2Common.dll");
  if (!hDll || (usize)hDll != EXPECTED_BASE) {
    fprintf(stderr, "Failed to load D2Common.dll at 0x6FD50000 (got %p)\n", (void *)hDll);
    return 2;
  }

  g_arena = (u8 *)VirtualAlloc((void *)(usize)ARENA_ADDR, ARENA_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
  g_heap  = (u8 *)VirtualAlloc((void *)(usize)HEAP_ADDR,  HEAP_SIZE,  MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
  if (!g_arena || !g_heap) return 3;

  DWORD oldProt = 0;
  VirtualProtect((LPVOID)(usize)0x6FDD9000u, 0x1000u, PAGE_EXECUTE_READWRITE, &oldProt);
  VirtualProtect((LPVOID)(usize)0x6FDE9000u, 0x9000u, PAGE_EXECUTE_READWRITE, &oldProt);
  *(u32 *)(usize)0x6FDD9004u = (u32)(usize)&stub_d2cmp_10036;
  *(u32 *)(usize)0x6FDD9008u = (u32)(usize)&stub_d2cmp_get_rarity;
  *(u32 *)(usize)0x6FDD900Cu = (u32)(usize)&stub_d2cmp_get_tiles;
  *(u32 *)(usize)0x6FDD9010u = (u32)(usize)&stub_d2cmp_10045;
  *(u32 *)(usize)0x6FDD9014u = (u32)(usize)&stub_d2cmp_10051;
  *(u32 *)(usize)0x6FDD90A0u = (u32)(usize)&stub_fog_10042;
  *(u32 *)(usize)0x6FDD90A8u = (u32)(usize)&stub_fog_10046;
  *(u32 *)(usize)0x6FDD90ACu = (u32)(usize)&stub_fog_10047;
  *(u32 *)(usize)0x6FDD90CCu = (u32)(usize)&stub_fog_10046;
  *(u32 *)(usize)0x6FDD90D0u = (u32)(usize)&stub_fog_10045;
  *(u32 *)(usize)0x6FDD90D8u = (u32)(usize)&stub_fog_assert;
  *(u32 *)(usize)0x6FDD90DCu = (u32)(usize)&stub_mpq_read;
  *(u32 *)(usize)0x6FDD90E0u = (u32)(usize)&stub_mpq_open;
  *(u32 *)(usize)0x6FDD90E8u = (u32)(usize)&stub_mpq_close;
  *(u32 *)(usize)0x6FDD90F0u = (u32)(usize)&stub_mpq_getsize;

  FILE *fp1 = fopen(out1, "wb");
  if (!fp1) return 4;
  emit_i14c_1(fp1);
  fclose(fp1);

  FILE *fp2 = fopen(out2, "wb");
  if (!fp2) return 5;
  emit_i14c_2(fp2);
  fclose(fp2);

  FILE *fp3 = fopen(out3, "wb");
  if (!fp3) return 6;
  emit_i14c_3(fp3);
  fclose(fp3);

  return 0;
}
