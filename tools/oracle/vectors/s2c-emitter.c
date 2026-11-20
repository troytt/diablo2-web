/*
 * Milestone 35 [K4] Exit-Gate D2TV Binary Vector Emitter: S2C
 *
 * Loads the real Diablo II v1.13c DLLs (Storm.dll, Fog.dll @ 0x6FF50000,
 * D2Lang.dll, D2Common.dll @ 0x6FD50000, D2Net.dll @ 0x6FBF0000,
 * D2Game.dll @ 0x6FC20000) and MPQ data tables (D2Common.#10943), then
 * executes real D2Game.dll S2C packet builders, D2Game:0x6FC4D500 client
 * send-queue flushing, D2Net.#10002 (Fog.#10222 stats + Fog.#10223 Huffman
 * packet compression + 1-byte / 2-byte framing + raw Q0-0xAF / Q2 bypass),
 * Fog.#10224 Huffman decompression roundtrip, and D2Net.#10033 S2C packet
 * framing size resolution across 1,440 64-byte D2TV records:
 *
 *   opKind  0: D2Game:0x6FCAB8C0  0x18  HpManaPot (15B bit-packed)
 *   opKind  1: D2Game:0x6FCAB7F0  0x95  LifeManaStamina (13B bit-packed)
 *   opKind  2: D2Game:0x6FCAB750  0x96  WalkVerify (9B bit-packed)
 *   opKind  3: D2Game:0x6FCABD00  0x1D / 0x1E / 0x1F  Attribute byte/word/dword
 *   opKind  4: D2Game:0x6FCABDA0  0x1A / 0x1B / 0x1C  Experience delta/dword
 *   opKind  5: D2Game:0x6FCABE10  0x19 / 0x1D / 0x1E / 0x1F  Gold update
 *   opKind  6: D2Game:0x6FCABC20  0x9E / 0x9F / 0xA0  Unit stat byte/word/dword
 *   opKind  7: D2Game:0x6FCABB10  0xA0 / 0xA1 / 0xA2  Unit stat delta
 *   opKind  8: D2Game:0x6FC9A5E0  0xA7 / 0xA8 / 0xA9  Unit gfx state set/stats/end
 *   opKind  9: D2Game:0x6FC9A940  0xAA  Unit multi-state bitstream
 *   opKind 10: D2Game:0x6FCEBA20  0x0F  Player/unit move sync (16B)
 *   opKind 11: D2Game:0x6FCEBB10  0x15  Unit reassign position (11B)
 *   opKind 12: D2Game:0x6FCAD860  0x67  Monster coordinate move (16B)
 *   opKind 13: D2Game:0x6FCAD990  0x68  Monster target-unit move (21B)
 *   opKind 14: D2Game:0x6FCABFC0  0x6D  Unit stop position + life% (10B)
 *   opKind 15: D2Game:0x6FCAD3D0  0x9C (+ socketed 0x9D)  World item action bitstream
 *   opKind 16: D2Game:0x6FCAB0F0  0x9D (+ socketed 0x9D)  Owned item action bitstream
 *   opKind 17: D2Game:0x6FCAB010  0x3E  Item stat bitstream (34B)
 *   opKind 18: D2Game:0x6FCAADE0  0x7D  Set item flags/mask (18B)
 *   opKind 19: D2Game:0x6FCAD5F0  0x21  Skill level + bonus update (12B)
 *   opKind 20: D2Game:0x6FCAD570  0x22  Unit skill/ammo count + morph (12B)
 *   opKind 21: D2Game:0x6FCAB710  0x23  Assign skill to hand (13B)
 *   opKind 22: D2Game:0x6FCABA90 (0xA3), 0x6FCABA50 (0xAB), coalesced 2-byte
 *              >= 0xF0 wire headers, nQueue=0 0xAF raw bypass, nQueue=2 raw bypass
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "vector-format.h"

#define FOG_PREF_BASE    0x6FF50000u
#define D2COM_PREF_BASE  0x6FD50000u
#define D2GAME_PREF_BASE 0x6FC20000u
#define D2NET_PREF_BASE  0x6FBF0000u

#define S2C_COUNT        1440u
#define S2C_SEED         0x3335533243564543ull /* "35S2CVEC" */

#pragma pack(push, 1)
typedef struct {
  /* Inputs (16 bytes, +0..+15) */
  uint8_t  opKind;          /* +0  (0..22) */
  uint8_t  flags;           /* +1  (bits 0..1 = nQueue, bits 2..7 = op sub-flags) */
  uint16_t u16A;            /* +2 */
  uint32_t u32A;            /* +4 */
  uint32_t u32B;            /* +8 */
  uint16_t u16B;            /* +12 */
  uint16_t u16C;            /* +14 */

  /* Outputs from real 1.13c DLL calls (48 bytes, +16..+63) */
  uint16_t rawLen;          /* +16 (uncompressed S2C byte length queued by D2Game.dll) */
  uint16_t framedLen;       /* +18 (wire byte length returned/emitted by D2Net.#10002) */
  uint16_t decompLen;       /* +20 (roundtrip byte length from Fog.#10224 or raw bypass) */
  uint16_t firstPktSize;    /* +22 (D2Net.#10033 size of first S2C packet, or 0xFFFF if raw non-S2C) */
  uint8_t  pktCount;        /* +24 (number of S2C packets walked across raw stream via D2Net.#10033) */
  uint8_t  wireHdr0;        /* +25 (framedBuf[0]) */
  uint8_t  wireHdr1;        /* +26 (framedLen >= 2 ? framedBuf[1] : 0) */
  uint8_t  firstOpcode;     /* +27 (rawBuf[0]) */
  uint32_t rawFnv1a32;      /* +28 (FNV-1a 32-bit over rawBuf[0..rawLen)) */
  uint32_t rawMix32;        /* +32 (Murmur-style mix32 over rawBuf[0..rawLen)) */
  uint32_t framedFnv1a32;   /* +36 (FNV-1a 32-bit over framedBuf[0..framedLen)) */
  uint32_t framedMix32;     /* +40 (Murmur-style mix32 over framedBuf[0..framedLen)) */
  uint8_t  rawPrefix[12];   /* +44..+55 (first 12 raw bytes, zero-padded) */
  uint8_t  framedPrefix[8]; /* +56..+63 (first 8 framed wire bytes, zero-padded) */
} S2CVectorRecord;
#pragma pack(pop)

typedef char S2CSizeCheck[(sizeof(S2CVectorRecord) == 64) ? 1 : -1];

typedef void(__fastcall *Fog_InitLogPrefix_t)(const char *);
typedef void(__fastcall *Fog_InitFileSystem_t)(int, void *);
typedef void(__fastcall *Fog_InitSystem_t)(int, void *);
typedef void(__stdcall *Fog_VoidStd_t)(void);
typedef int(__stdcall *Fog_IsExpansion_t)(void);
typedef uint32_t(__fastcall *Fog_DecompressPacket_t)(uint8_t *dst, uint32_t dstCap, const uint8_t *src, uint32_t srcLen);
typedef BOOL(__stdcall *SFileOpenArchive_t)(const char *, DWORD, DWORD, HANDLE *);
typedef BOOL(__stdcall *SMemFree_t)(void *, const char *, int, DWORD);
typedef int(__fastcall *D2Lang_Init_t)(int, const char *, int);
typedef int(__stdcall *D2Common_InitTables_t)(int, int, int);

typedef uint8_t *(__stdcall *D2Common_GetItemsTxt_t)(int32_t itemId);
typedef int32_t(__stdcall *D2Common_CheckItemTypeId_t)(void *pItem, int32_t nItemType);
typedef void *(__stdcall *D2Common_AllocStatList_t)(void *pMemPool, uint32_t dwFlags, uint32_t dwTimeout, int32_t nUnitType, int32_t nUnitGUID);
typedef void *(__stdcall *D2Common_CreateStatListEx_t)(void *pOwner, uint32_t argFlags, void *pfnCb, void *pGame);
typedef void(__stdcall *D2Common_SetUnitStat_t)(void *pUnit, int32_t nStatId, int32_t nValue, int32_t nLayer);
typedef void(__stdcall *D2Common_SetStatIfValid_t)(void *pStatList, int32_t nStatId, int32_t nValue, uint32_t wParam);
typedef void(__stdcall *D2Common_SetStatListState_t)(void *pStatList, int32_t nState);
typedef void(__stdcall *D2Common_MergeStatLists_t)(void *pTargetUnit, void *pSubList, int32_t bType);
typedef void(__stdcall *D2Common_ToggleGfxStateFlag_t)(void *pUnit, int32_t nState, int32_t bSet);

typedef uint32_t(__stdcall *D2Net_SendPacket_t)(uint32_t nQueue, uint32_t nClientId, const uint8_t *pPacket, uint32_t nLen);
typedef int32_t(__fastcall *D2Net_GetS2CPacketSize_t)(const uint8_t *pPkt, uint32_t nMaxLen, int32_t *pOutSize);

/* Standard __stdcall / __fastcall D2Game S2C builders */
typedef int32_t(__stdcall *D2Game_Send18_t)(void *pClient, uint32_t wLife, uint32_t wMana, uint32_t wStamina,
                                            uint32_t bLifeRegen, uint32_t bManaRegen, uint32_t wX, uint32_t wY,
                                            uint32_t bDx, uint32_t bDy);
typedef int32_t(__stdcall *D2Game_Send95_t)(void *pClient, uint32_t wLife, uint32_t wMana, uint32_t wStamina,
                                            uint32_t wX, uint32_t wY, uint32_t bDx, uint32_t bDy);
typedef int32_t(__stdcall *D2Game_Send96_t)(void *pClient, uint32_t wStamina, uint32_t wX, uint32_t wY,
                                            uint32_t bDx, uint32_t bDy);
typedef void(__stdcall *D2Game_SendUnitStates_t)(void *pUnit, void *pClient);
typedef void(__fastcall *D2Game_Send0F_t)(void *pGame, void *pUnit, void *pClient, int32_t nAnimMode);

static uintptr_t g_fog_rebase = 0;
static uintptr_t g_com_rebase = 0;
static uintptr_t g_net_rebase = 0;
static uintptr_t g_game_rebase = 0;
static HMODULE g_hGame = NULL;
static HMODULE g_hCom = NULL;
static HMODULE g_hNet = NULL;
static HMODULE g_hFog = NULL;
static uint32_t g_cur_idx = 0;

static uint8_t  g_wire_buf[1024];
static uint32_t g_wire_len = 0;
static uint32_t g_wire_calls = 0;

static void write_u32(uint8_t *buf, size_t off, uint32_t v) {
  *(uint32_t *)(buf + off) = v;
}

static void write_u16(uint8_t *buf, size_t off, uint16_t v) {
  *(uint16_t *)(buf + off) = v;
}

static uint32_t read_u32(const uint8_t *buf, size_t off) {
  return *(const uint32_t *)(buf + off);
}

static uint32_t fnv1a32(const uint8_t *data, size_t len) {
  uint32_t h = 0x811C9DC5u;
  for (size_t i = 0; i < len; i++) {
    h ^= (uint32_t)data[i];
    h *= 0x01000193u;
  }
  return h;
}

static uint32_t mix32_bytes(const uint8_t *data, size_t len) {
  uint32_t h = 0x9E3779B9u ^ ((uint32_t)len * 0x85EBCA6Bu);
  for (size_t i = 0; i < len; i++) {
    uint32_t k = (uint32_t)data[i] + ((uint32_t)i * 0x27D4EB2Du);
    k *= 0xCC9E2D51u;
    k = (k << 15) | (k >> 17);
    k *= 0x1B873593u;
    h ^= k;
    h = (h << 13) | (h >> 19);
    h = h * 5u + 0xE6546B64u;
  }
  h ^= (uint32_t)len;
  h ^= h >> 16;
  h *= 0x85EBCA6Bu;
  h ^= h >> 13;
  h *= 0xC2B2AE35u;
  h ^= h >> 16;
  return h;
}

static LONG WINAPI crash_filter(EXCEPTION_POINTERS *ep) {
  uintptr_t eip = (uintptr_t)ep->ExceptionRecord->ExceptionAddress;
  uintptr_t gameCanon = (g_hGame && eip >= (uintptr_t)g_hGame && eip < (uintptr_t)g_hGame + 0x130000u)
                            ? (eip - g_game_rebase)
                            : 0;
  uintptr_t comCanon = (g_hCom && eip >= (uintptr_t)g_hCom && eip < (uintptr_t)g_hCom + 0xA0000u)
                           ? (eip - g_com_rebase)
                           : 0;
  CONTEXT *c = ep->ContextRecord;
  fprintf(stderr,
          "[s2c-emitter] CRASH idx=%u code=0x%08lx eip=%p (gameVA=0x%08lx comVA=0x%08lx) "
          "addr=%p EAX=%08lx ECX=%08lx EDX=%08lx EBX=%08lx ESI=%08lx EDI=%08lx\n",
          g_cur_idx,
          (unsigned long)ep->ExceptionRecord->ExceptionCode,
          (void *)eip, (unsigned long)gameCanon, (unsigned long)comCanon,
          (void *)ep->ExceptionRecord->ExceptionInformation[1],
          (unsigned long)c->Eax, (unsigned long)c->Ecx, (unsigned long)c->Edx,
          (unsigned long)c->Ebx, (unsigned long)c->Esi, (unsigned long)c->Edi);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 99);
  return EXCEPTION_EXECUTE_HANDLER;
}

/*
 * Intercept Fog.#10157 (QServer_Send) called by D2Net.#10002 (0x6FBF63E0 -> 0x6FBF5EEE)
 * after real Fog.#10222 stats + Fog.#10223 Huffman compression + header framing.
 */
static int32_t __stdcall hook_Fog_QServer_Send(
    void *hQServer, uint32_t nClientId, const uint8_t *pFrame, uint32_t nFramedLen) {
  (void)hQServer;
  (void)nClientId;
  if (nFramedLen > sizeof(g_wire_buf)) {
    fprintf(stderr, "[s2c-emitter] framed packet overflow (%u bytes) at idx=%u\n", nFramedLen, g_cur_idx);
    TerminateProcess(GetCurrentProcess(), 91);
  }
  memcpy(g_wire_buf, pFrame, nFramedLen);
  g_wire_len = nFramedLen;
  g_wire_calls++;
  return 1;
}

static void install_jmp_hook(uintptr_t target_va, void *hook_fn) {
  DWORD old_prot = 0;
  uint8_t *p = (uint8_t *)target_va;
  VirtualProtect(p, 8, PAGE_EXECUTE_READWRITE, &old_prot);
  p[0] = 0xE9;
  int32_t rel = (int32_t)((uintptr_t)hook_fn - (target_va + 5));
  memcpy(p + 1, &rel, 4);
}

/*
 * Zero 0x280 bytes immediately below ESP right before invoking a D2Game.dll S2C
 * packet builder so stack-allocated packet buffers with unwritten padding bytes
 * (e.g. 0x6FCAD570 pkt[2]/pkt[10] and 0x6FCAD5F0 pkt[11]) deterministically
 * hold 0x00 regardless of compiler optimization level (-O2 vs -fno-omit-frame-pointer).
 */
static __attribute__((noinline)) void scrub_stack_below_esp(void) {
  __asm__ volatile (
    "pushl %%edi\n\t"
    "pushl %%ecx\n\t"
    "pushl %%eax\n\t"
    "leal -0x280(%%esp), %%edi\n\t"
    "xorl %%eax, %%eax\n\t"
    "movl $0xA0, %%ecx\n\t"
    "cld\n\t"
    "rep stosl\n\t"
    "popl %%eax\n\t"
    "popl %%ecx\n\t"
    "popl %%edi\n\t"
    :
    :
    : "memory", "cc"
  );
}

/* D2Game:0x6FC4D500: eax = pClient, stack (pGame, bFlush), ret 8 */
static __attribute__((noinline)) void call_D2Game_FlushClientQueue(void *pClient, void *pGame, int32_t bFlush) {
  uintptr_t fn = 0x6FC4D500u + g_game_rebase;
  __asm__ volatile (
    "pushl %[flush]\n\t"
    "pushl %[game]\n\t"
    "call *%[fn]\n\t"
    : "+a"(pClient)
    : [game] "r"(pGame), [flush] "r"(bFlush), [fn] "r"(fn)
    : "ecx", "edx", "memory", "cc"
  );
}

/* D2Game:0x6FD00310 (SUNIT_InsertServerUnit): edx = pGame, esi = pUnit, ret */
static __attribute__((noinline)) void call_D2Game_InsertServerUnit(void *pGame, void *pUnit) {
  uintptr_t fn = 0x6FD00310u + g_game_rebase;
  __asm__ volatile (
    "call *%%ecx\n\t"
    : "+d"(pGame), "+S"(pUnit), "+c"(fn)
    :
    : "eax", "memory", "cc"
  );
}

/* D2Game:0x6FCABD00 (0x1D/0x1E/0x1F): eax = pClient, edx = wStatId, ecx = dwValue, ret */
static __attribute__((noinline)) void call_D2Game_Send1D1E1F(void *pClient, uint32_t wStatId, uint32_t dwValue) {
  uintptr_t fn = 0x6FCABD00u + g_game_rebase;
  scrub_stack_below_esp();
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "+a"(pClient), "+d"(wStatId), "+c"(dwValue)
    : [fn] "S"(fn)
    : "memory", "cc"
  );
}

/* D2Game:0x6FCABDA0 (0x1A/0x1B/0x1C): eax = pClient, edx = nCurExp, esi = nLastExp, ret */
static __attribute__((noinline)) void call_D2Game_Send1A1B1C(void *pClient, int32_t nCurExp, int32_t nLastExp) {
  uintptr_t fn = 0x6FCABDA0u + g_game_rebase;
  scrub_stack_below_esp();
  __asm__ volatile (
    "call *%%ecx\n\t"
    : "+a"(pClient), "+d"(nCurExp), "+S"(nLastExp), "+c"(fn)
    :
    : "memory", "cc"
  );
}

/* D2Game:0x6FCABE10 (0x19/0x1D/0x1E/0x1F): eax = pClient, edx = nNewGold, esi = nOldGold, ret */
static __attribute__((noinline)) void call_D2Game_Send19Gold(void *pClient, int32_t nNewGold, int32_t nOldGold) {
  uintptr_t fn = 0x6FCABE10u + g_game_rebase;
  scrub_stack_below_esp();
  __asm__ volatile (
    "call *%%ecx\n\t"
    : "+a"(pClient), "+d"(nNewGold), "+S"(nOldGold), "+c"(fn)
    :
    : "memory", "cc"
  );
}

/* D2Game:0x6FCABC20 (0x9E/0x9F/0xA0): eax = wStatId, ecx = pUnit, edi = pClient, stack (dwStatVal), ret 4 */
static __attribute__((noinline)) void call_D2Game_Send9E9FA0(uint32_t wStatId, void *pUnit, void *pClient, uint32_t dwStatVal) {
  uintptr_t fn = 0x6FCABC20u + g_game_rebase;
  scrub_stack_below_esp();
  __asm__ volatile (
    "pushl %[val]\n\t"
    "call *%[fn]\n\t"
    : "+a"(wStatId), "+c"(pUnit), "+D"(pClient)
    : [val] "b"(dwStatVal), [fn] "S"(fn)
    : "edx", "memory", "cc"
  );
}

/* D2Game:0x6FCABB10 (0xA0/0xA1/0xA2): eax = pClient, ebx = wStatId, edx = nNewVal, edi = nBaseVal, stack (pUnit), ret 4 */
static __attribute__((noinline)) void call_D2Game_SendA0A1A2(void *pClient, uint32_t wStatId, int32_t nNewVal, int32_t nBaseVal, void *pUnit) {
  uintptr_t fn = 0x6FCABB10u + g_game_rebase;
  scrub_stack_below_esp();
  __asm__ volatile (
    "pushl %%ecx\n\t"
    "call *%[fn]\n\t"
    : "+a"(pClient), "+b"(wStatId), "+d"(nNewVal), "+D"(nBaseVal), "+c"(pUnit)
    : [fn] "S"(fn)
    : "memory", "cc"
  );
}

/* D2Game:0x6FCEBB10 (0x15): esi = pUnit, stack (pClient, bFlash), ret 8 */
static __attribute__((noinline)) void call_D2Game_Send15(void *pUnit, void *pClient, uint32_t bFlash) {
  uintptr_t fn = 0x6FCEBB10u + g_game_rebase;
  scrub_stack_below_esp();
  __asm__ volatile (
    "pushl %[flash]\n\t"
    "pushl %[cli]\n\t"
    "call *%[fn]\n\t"
    : "+S"(pUnit)
    : [cli] "r"(pClient), [flash] "r"(bFlash), [fn] "c"(fn)
    : "eax", "edx", "memory", "cc"
  );
}

/* D2Game:0x6FCAD860 (0x67): ebx = pClient, dl = bHdr, eax = dwMonsterGuid, stack (bMoveType, wTargetX, wTargetY, bByteA, bByteF, bByteB), ret 0x18 */
static __attribute__((noinline)) void call_D2Game_Send67(
    void *pClient, uint32_t bHdr, uint32_t dwMonsterGuid,
    uint32_t bMoveType, uint32_t wTargetX, uint32_t wTargetY,
    uint32_t bByteA, uint32_t bByteF, uint32_t bByteB) {
  uintptr_t fn = 0x6FCAD860u + g_game_rebase;
  uint32_t args[6] = { bMoveType, wTargetX, wTargetY, bByteA, bByteF, bByteB };
  scrub_stack_below_esp();
  __asm__ volatile (
    "pushl 20(%[a])\n\t"
    "pushl 16(%[a])\n\t"
    "pushl 12(%[a])\n\t"
    "pushl 8(%[a])\n\t"
    "pushl 4(%[a])\n\t"
    "pushl 0(%[a])\n\t"
    "call *%[fn]\n\t"
    : "+b"(pClient), "+d"(bHdr), "+a"(dwMonsterGuid)
    : [a] "S"(args), [fn] "D"(fn)
    : "ecx", "memory", "cc"
  );
}

/* D2Game:0x6FCAD990 (0x68): ebx = pClient, dl = bHdr, eax = dwMonsterGuid, stack (bMoveType, bTargetType, dwTargetGuid, bByteF, bByte14, bByte10), ret 0x18 */
static __attribute__((noinline)) void call_D2Game_Send68(
    void *pClient, uint32_t bHdr, uint32_t dwMonsterGuid,
    uint32_t bMoveType, uint32_t bTargetType, uint32_t dwTargetGuid,
    uint32_t bByteF, uint32_t bByte14, uint32_t bByte10) {
  uintptr_t fn = 0x6FCAD990u + g_game_rebase;
  uint32_t args[6] = { bMoveType, bTargetType, dwTargetGuid, bByteF, bByte14, bByte10 };
  scrub_stack_below_esp();
  __asm__ volatile (
    "pushl 20(%[a])\n\t"
    "pushl 16(%[a])\n\t"
    "pushl 12(%[a])\n\t"
    "pushl 8(%[a])\n\t"
    "pushl 4(%[a])\n\t"
    "pushl 0(%[a])\n\t"
    "call *%[fn]\n\t"
    : "+b"(pClient), "+d"(bHdr), "+a"(dwMonsterGuid)
    : [a] "S"(args), [fn] "D"(fn)
    : "ecx", "memory", "cc"
  );
}

/* D2Game:0x6FCABFC0 (0x6D): ecx = dwUnitId, dx = wX, stack (pClient, wY, bLifePct), ret 0x0C */
static __attribute__((noinline)) void call_D2Game_Send6D(void *pClient, uint32_t dwUnitId, uint32_t wX, uint32_t wY, uint32_t bLifePct) {
  uintptr_t fn = 0x6FCABFC0u + g_game_rebase;
  uint32_t args[3] = { (uint32_t)(uintptr_t)pClient, wY, bLifePct };
  scrub_stack_below_esp();
  __asm__ volatile (
    "pushl 8(%[a])\n\t"
    "pushl 4(%[a])\n\t"
    "pushl 0(%[a])\n\t"
    "call *%[fn]\n\t"
    : "+c"(dwUnitId), "+d"(wX)
    : [a] "S"(args), [fn] "D"(fn)
    : "eax", "memory", "cc"
  );
}

/* D2Game:0x6FCAD3D0 (0x9C): ebx = pClient, esi = pItem, stack (bAction, dwCmdFlags, bSimpleOnly), ret 0x0C */
static __attribute__((noinline)) void call_D2Game_Send9C(void *pClient, void *pItem, uint32_t bAction, uint32_t dwCmdFlags, uint32_t bSimpleOnly) {
  uintptr_t fn = 0x6FCAD3D0u + g_game_rebase;
  uint32_t args[3] = { bAction, dwCmdFlags, bSimpleOnly };
  scrub_stack_below_esp();
  __asm__ volatile (
    "pushl 8(%[a])\n\t"
    "pushl 4(%[a])\n\t"
    "pushl 0(%[a])\n\t"
    "call *%[fn]\n\t"
    : "+b"(pClient), "+S"(pItem)
    : [a] "D"(args), [fn] "c"(fn)
    : "eax", "edx", "memory", "cc"
  );
}

/* D2Game:0x6FCAB0F0 (0x9D): al = bAction, ecx = pOwnerUnit, esi = pItemUnit, stack (pClient, dwCmdFlags, bGamble), ret 0x0C */
static __attribute__((noinline)) void call_D2Game_Send9D(uint32_t bAction, void *pOwnerUnit, void *pItemUnit, void *pClient, uint32_t dwCmdFlags, uint32_t bGamble) {
  uintptr_t fn = 0x6FCAB0F0u + g_game_rebase;
  uint32_t args[3] = { (uint32_t)(uintptr_t)pClient, dwCmdFlags, bGamble };
  scrub_stack_below_esp();
  __asm__ volatile (
    "pushl 8(%[a])\n\t"
    "pushl 4(%[a])\n\t"
    "pushl 0(%[a])\n\t"
    "call *%[fn]\n\t"
    : "+a"(bAction), "+c"(pOwnerUnit), "+S"(pItemUnit)
    : [a] "D"(args), [fn] "b"(fn)
    : "edx", "memory", "cc"
  );
}

/* D2Game:0x6FCAB010 (0x3E): eax = pItem, bx = wLayer, stack (pClient, bFlag, nStatId, dwValue), ret 0x10 */
static __attribute__((noinline)) void call_D2Game_Send3E(void *pItem, uint32_t wLayer, void *pClient, uint32_t bFlag, uint32_t nStatId, uint32_t dwValue) {
  uintptr_t fn = 0x6FCAB010u + g_game_rebase;
  uint32_t args[4] = { (uint32_t)(uintptr_t)pClient, bFlag, nStatId, dwValue };
  scrub_stack_below_esp();
  __asm__ volatile (
    "pushl 12(%[a])\n\t"
    "pushl 8(%[a])\n\t"
    "pushl 4(%[a])\n\t"
    "pushl 0(%[a])\n\t"
    "call *%[fn]\n\t"
    : "+a"(pItem), "+b"(wLayer)
    : [a] "S"(args), [fn] "D"(fn)
    : "ecx", "edx", "memory", "cc"
  );
}

/* D2Game:0x6FCAADE0 (0x7D): eax = pOwner, edx = pItem, stack (pClient, dwFlags, dwMask), ret 0x0C */
static __attribute__((noinline)) void call_D2Game_Send7D(void *pOwner, void *pItem, void *pClient, uint32_t dwFlags, uint32_t dwMask) {
  uintptr_t fn = 0x6FCAADE0u + g_game_rebase;
  uint32_t args[3] = { (uint32_t)(uintptr_t)pClient, dwFlags, dwMask };
  scrub_stack_below_esp();
  __asm__ volatile (
    "pushl 8(%[a])\n\t"
    "pushl 4(%[a])\n\t"
    "pushl 0(%[a])\n\t"
    "call *%[fn]\n\t"
    : "+a"(pOwner), "+d"(pItem)
    : [a] "S"(args), [fn] "D"(fn)
    : "ecx", "memory", "cc"
  );
}

/* D2Game:0x6FCAD5F0 (0x21): eax = pClient, esi = pUnit, bx = wSkillId, stack (bBaseLevel, bArg2), ret 8 */
static __attribute__((noinline)) void call_D2Game_Send21(void *pClient, void *pUnit, uint32_t wSkillId, uint32_t bBaseLevel, uint32_t bArg2) {
  uintptr_t fn = 0x6FCAD5F0u + g_game_rebase;
  uint32_t args[2] = { bBaseLevel, bArg2 };
  scrub_stack_below_esp();
  __asm__ volatile (
    "pushl 4(%[a])\n\t"
    "pushl 0(%[a])\n\t"
    "call *%[fn]\n\t"
    : "+a"(pClient), "+S"(pUnit), "+b"(wSkillId)
    : [a] "D"(args), [fn] "c"(fn)
    : "edx", "memory", "cc"
  );
}

/* D2Game:0x6FCAD570 (0x22): esi = pClient, al = bUnitType, edx = dwUnitGuid, cx = wSkillId, stack (bCount), ret 4 */
static __attribute__((noinline)) void call_D2Game_Send22(void *pClient, uint32_t bUnitType, uint32_t dwUnitGuid, uint32_t wSkillId, uint32_t bCount) {
  uintptr_t fn = 0x6FCAD570u + g_game_rebase;
  scrub_stack_below_esp();
  __asm__ volatile (
    "pushl %[cnt]\n\t"
    "call *%[fn]\n\t"
    : "+S"(pClient), "+a"(bUnitType), "+d"(dwUnitGuid), "+c"(wSkillId)
    : [cnt] "b"(bCount), [fn] "D"(fn)
    : "memory", "cc"
  );
}

/* D2Game:0x6FCAB710 (0x23): al = bUnitType, edx = dwUnitGuid, stack (pClient, nHand, wSkillId, dwItemGuid), ret 0x10 */
static __attribute__((noinline)) void call_D2Game_Send23(uint32_t bUnitType, uint32_t dwUnitGuid, void *pClient, uint32_t nHand, uint32_t wSkillId, uint32_t dwItemGuid) {
  uintptr_t fn = 0x6FCAB710u + g_game_rebase;
  uint32_t args[4] = { (uint32_t)(uintptr_t)pClient, nHand, wSkillId, dwItemGuid };
  scrub_stack_below_esp();
  __asm__ volatile (
    "pushl 12(%[a])\n\t"
    "pushl 8(%[a])\n\t"
    "pushl 4(%[a])\n\t"
    "pushl 0(%[a])\n\t"
    "call *%[fn]\n\t"
    : "+a"(bUnitType), "+d"(dwUnitGuid)
    : [a] "S"(args), [fn] "D"(fn)
    : "ecx", "memory", "cc"
  );
}

/* D2Game:0x6FCABA90 (0xA3): cl = bUnitType, dx = wSkillId, stack (pClient, wSkillLevel, bTargetType, dwUnitGuid, bByteB, dwTargetGuid, nTargetX, nTargetY), ret 0x20 */
static __attribute__((noinline)) void call_D2Game_SendA3(
    uint32_t bUnitType, uint32_t wSkillId, void *pClient,
    uint32_t wSkillLevel, uint32_t bTargetType, uint32_t dwUnitGuid,
    uint32_t bByteB, uint32_t dwTargetGuid, uint32_t nTargetX, uint32_t nTargetY) {
  uintptr_t fn = 0x6FCABA90u + g_game_rebase;
  uint32_t args[8] = {
    (uint32_t)(uintptr_t)pClient, wSkillLevel, bTargetType, dwUnitGuid,
    bByteB, dwTargetGuid, nTargetX, nTargetY
  };
  scrub_stack_below_esp();
  __asm__ volatile (
    "pushl 28(%[a])\n\t"
    "pushl 24(%[a])\n\t"
    "pushl 20(%[a])\n\t"
    "pushl 16(%[a])\n\t"
    "pushl 12(%[a])\n\t"
    "pushl 8(%[a])\n\t"
    "pushl 4(%[a])\n\t"
    "pushl 0(%[a])\n\t"
    "call *%[fn]\n\t"
    : "+c"(bUnitType), "+d"(wSkillId)
    : [a] "S"(args), [fn] "D"(fn)
    : "eax", "memory", "cc"
  );
}

/* D2Game:0x6FCABA50 (0xAB): cl = bUnitType, edx = dwUnitGuid, stack (pClient, bLifePct), ret 8 */
static __attribute__((noinline)) void call_D2Game_SendAB(uint32_t bUnitType, uint32_t dwUnitGuid, void *pClient, uint32_t bLifePct) {
  uintptr_t fn = 0x6FCABA50u + g_game_rebase;
  scrub_stack_below_esp();
  __asm__ volatile (
    "pushl %[pct]\n\t"
    "pushl %[cli]\n\t"
    "call *%[fn]\n\t"
    : "+c"(bUnitType), "+d"(dwUnitGuid)
    : [cli] "S"(pClient), [pct] "r"(bLifePct), [fn] "D"(fn)
    : "eax", "memory", "cc"
  );
}

static int open_mpq_if_exists(SFileOpenArchive_t fnOpen, const char *name, DWORD prio, int req) {
  if (GetFileAttributesA(name) == INVALID_FILE_ATTRIBUTES) {
    if (req) {
      fprintf(stderr, "[s2c-emitter] missing MPQ: %s\n", name);
      return 0;
    }
    return 1;
  }
  HANDLE hMpq = NULL;
  if (!fnOpen(name, prio, 0, &hMpq) || !hMpq) {
    if (!fnOpen(name, prio, 2, &hMpq) || !hMpq) {
      if (req) {
        fprintf(stderr, "[s2c-emitter] failed to open MPQ: %s\n", name);
        return 0;
      }
    }
  }
  return 1;
}

static uint8_t __attribute__((aligned(16))) s_game[0x2000];
static uint8_t __attribute__((aligned(16))) s_client[0x600];
static uint8_t __attribute__((aligned(16))) s_pkt_nodes[4][0x208];
static uint8_t __attribute__((aligned(16))) s_unit[0x200];
static uint8_t __attribute__((aligned(16))) s_owner[0x200];
static uint8_t __attribute__((aligned(16))) s_path[0x200];
static uint8_t __attribute__((aligned(16))) s_item[0x200];
static uint8_t __attribute__((aligned(16))) s_item_data[0x100];
static uint8_t __attribute__((aligned(16))) s_item_path[0x40];
static uint8_t __attribute__((aligned(16))) s_item_inv[0x40];
static uint8_t __attribute__((aligned(16))) s_gem1[0x200];
static uint8_t __attribute__((aligned(16))) s_gem1_data[0x100];
static uint8_t __attribute__((aligned(16))) s_gem1_path[0x40];
static uint8_t __attribute__((aligned(16))) s_gem2[0x200];
static uint8_t __attribute__((aligned(16))) s_gem2_data[0x100];
static uint8_t __attribute__((aligned(16))) s_gem2_path[0x40];
static uint8_t __attribute__((aligned(16))) s_skill_list[0x20];
static uint8_t __attribute__((aligned(16))) s_skill_node[0x40];

/* Shared deterministic setup of an item unit for opKind 15 (0x9C) & opKind 16 (0x9D) */
static void setup_test_item_from_input(
    const S2CVectorRecord *inRec,
    D2Common_GetItemsTxt_t pGetItemsTxt,
    D2Common_CheckItemTypeId_t pCheckItemTypeId,
    D2Common_CreateStatListEx_t pCreateStatListEx,
    D2Common_AllocStatList_t pAllocStatList,
    D2Common_SetUnitStat_t pSetUnitStat,
    D2Common_SetStatIfValid_t pSetStatIfValid,
    D2Common_MergeStatLists_t pMergeStatLists) {
  memset(s_item, 0, sizeof(s_item));
  memset(s_item_data, 0, sizeof(s_item_data));
  memset(s_item_path, 0, sizeof(s_item_path));
  memset(s_item_inv, 0, sizeof(s_item_inv));
  memset(s_gem1, 0, sizeof(s_gem1));
  memset(s_gem1_data, 0, sizeof(s_gem1_data));
  memset(s_gem1_path, 0, sizeof(s_gem1_path));
  memset(s_gem2, 0, sizeof(s_gem2));
  memset(s_gem2_data, 0, sizeof(s_gem2_data));
  memset(s_gem2_path, 0, sizeof(s_gem2_path));

  uint16_t itemId = inRec->u16A;
  uint32_t itemGuid = inRec->u32A;
  uint32_t cfg = inRec->u32B;
  uint16_t gemItemId = inRec->u16C;

  uint8_t quality = (uint8_t)(cfg & 0x0Fu);         /* 1,2,3,4,6,7 */
  uint8_t animMode = (uint8_t)((cfg >> 4) & 0x07u); /* 0=inv, 1=equip, 3=ground, 5=drop */
  uint8_t bodyLoc = (uint8_t)((cfg >> 7) & 0x0Fu);  /* 0..10 (not 4/5) */
  uint8_t invPage = (uint8_t)((cfg >> 11) & 0x07u); /* 0,3,4 or 7->0xFF */
  if (invPage == 7u) invPage = 0xFFu;
  uint16_t itemFormat = ((cfg >> 14) & 1u) ? 0u : 100u;
  uint8_t ilvl = (uint8_t)(1u + ((cfg >> 15) & 0x3Fu));
  uint8_t numGems = (uint8_t)((cfg >> 21) & 0x03u); /* 0, 1, or 2 socketed gems */
  uint8_t isEth = (uint8_t)((cfg >> 23) & 1u);
  uint8_t isIdent = (uint8_t)((cfg >> 24) & 1u);
  uint8_t posX = (uint8_t)((cfg >> 25) & 0x0Fu);
  uint8_t posY = (uint8_t)((cfg >> 29) & 0x07u);

  uint32_t cmdFlags = 0u;
  if (isIdent) cmdFlags |= 0x10u;
  if (isEth) cmdFlags |= 0x400000u;
  if (numGems > 0u) cmdFlags |= 0x800u;

  write_u32(s_item, 0x00, 4u);
  write_u32(s_item, 0x04, itemId);
  write_u32(s_item, 0x0C, itemGuid);
  write_u32(s_item, 0x10, animMode);
  write_u32(s_item, 0x14, (uint32_t)(uintptr_t)s_item_data);
  write_u32(s_item, 0x20, itemGuid ^ 0x13579BDFu);
  write_u32(s_item, 0x24, 0x0000029Au);
  write_u32(s_item, 0x28, itemGuid ^ 0x2468ACE0u);
  write_u32(s_item, 0x2C, (uint32_t)(uintptr_t)s_item_path);

  if (animMode == 3u || animMode == 5u) {
    write_u32(s_item_path, 0x0C, 5100u + posX * 7u);
    write_u32(s_item_path, 0x10, 5200u + posY * 9u);
  } else {
    write_u32(s_item_path, 0x0C, posX % 10u);
    write_u32(s_item_path, 0x10, posY % 4u);
  }

  write_u32(s_item_data, 0x00, quality);
  write_u32(s_item_data, 0x04, itemGuid ^ 0x55AA55AAu);
  write_u32(s_item_data, 0x08, 0x0000029Au);
  write_u32(s_item_data, 0x0C, itemGuid);
  write_u32(s_item_data, 0x18, cmdFlags);
  write_u32(s_item_data, 0x28, (quality == 1u || quality == 3u) ? (itemGuid % 4u) : (quality == 7u ? 5u : 0xFFFFFFFFu));
  write_u32(s_item_data, 0x2C, ilvl);
  write_u16(s_item_data, 0x30, itemFormat);
  if (quality == 4u) {
    write_u16(s_item_data, 0x38, (uint16_t)(10u + (itemGuid % 40u)));
    write_u16(s_item_data, 0x3E, (uint16_t)(5u + ((itemGuid >> 4) % 40u)));
  } else if (quality == 6u) {
    write_u16(s_item_data, 0x32, (uint16_t)(1u + (itemGuid % 20u)));
    write_u16(s_item_data, 0x34, (uint16_t)(1u + ((itemGuid >> 3) % 20u)));
    write_u16(s_item_data, 0x38, (uint16_t)(12u + (itemGuid % 30u)));
    write_u16(s_item_data, 0x3E, (uint16_t)(8u + ((itemGuid >> 5) % 30u)));
  }
  s_item_data[0x44] = bodyLoc;
  s_item_data[0x45] = invPage;

  pCreateStatListEx(s_item, 0u, NULL, s_game);
  uint8_t *pTxt = pGetItemsTxt(itemId);
  if (pTxt && pTxt[0x137] == 0u) {
    if (pCheckItemTypeId(s_item, 0x32)) {
      pSetUnitStat(s_item, 0x1F, 15 + (int32_t)(itemGuid % 80u), 0); /* STAT_ARMORCLASS */
    }
    if (pTxt[0x113] == 0u && pTxt[0x112] != 0u) {
      int32_t maxDur = pTxt[0x112];
      int32_t curDur = (int32_t)(1u + (itemGuid % (uint32_t)maxDur));
      pSetUnitStat(s_item, 0x49, maxDur, 0);
      pSetUnitStat(s_item, 0x48, curDur, 0);
    }
    if (pTxt[0x132] != 0u) {
      pSetUnitStat(s_item, 0x46, 10 + (int32_t)(itemGuid % 20u), 0); /* STAT_QUANTITY */
    }
    if (numGems > 0u) {
      pSetUnitStat(s_item, 0xC2, (int32_t)numGems + 1, 0); /* STAT_ITEM_NUMSOCKETS */
    }
    if (isIdent && (quality == 4u || quality == 6u)) {
      void *pBonus = pAllocStatList(NULL, 0x40u, 0u, 4, (int32_t)itemGuid);
      pSetStatIfValid(pBonus, 0, 5 + (int32_t)(itemGuid % 15u), 0u);  /* STAT_STRENGTH */
      pSetStatIfValid(pBonus, 7, (10 + (int32_t)(itemGuid % 30u)) << 8, 0u); /* STAT_MAXHP */
      if (quality == 6u) {
        pSetStatIfValid(pBonus, 39, 10 + (int32_t)((itemGuid >> 3) % 25u), 0u); /* STAT_FIRERESIST */
      }
      pMergeStatLists(s_item, pBonus, 1);
    }
  }

  if (numGems > 0u && pTxt && pTxt[0x137] == 0u) {
    write_u32(s_item_inv, 0x00, 0x01020304u); /* INVENTORY_SIGNATURE_113C */
    write_u32(s_item_inv, 0x08, (uint32_t)(uintptr_t)s_item);
    write_u32(s_item_inv, 0x0C, (uint32_t)(uintptr_t)s_gem1);
    write_u32(s_item_inv, 0x10, (uint32_t)(uintptr_t)(numGems >= 2u ? s_gem2 : s_gem1));
    write_u32(s_item, 0x60, (uint32_t)(uintptr_t)s_item_inv);

    /* Gem 1 */
    write_u32(s_gem1, 0x00, 4u);
    write_u32(s_gem1, 0x04, gemItemId);
    write_u32(s_gem1, 0x0C, itemGuid + 10000u);
    write_u32(s_gem1, 0x10, 6u); /* ITEMMODE_SOCKETED */
    write_u32(s_gem1, 0x14, (uint32_t)(uintptr_t)s_gem1_data);
    write_u32(s_gem1, 0x2C, (uint32_t)(uintptr_t)s_gem1_path);
    write_u32(s_gem1_data, 0x00, 2u);
    write_u32(s_gem1_data, 0x18, 0x10u);
    write_u32(s_gem1_data, 0x2C, ilvl);
    write_u16(s_gem1_data, 0x30, itemFormat);
    s_gem1_data[0x45] = 0xFFu;
    write_u32(s_gem1_data, 0x5C, (uint32_t)(uintptr_t)s_item_inv);
    write_u32(s_gem1_data, 0x64, numGems >= 2u ? (uint32_t)(uintptr_t)s_gem2 : 0u);
    pCreateStatListEx(s_gem1, 0u, NULL, s_game);

    if (numGems >= 2u) {
      write_u32(s_gem2, 0x00, 4u);
      write_u32(s_gem2, 0x04, gemItemId);
      write_u32(s_gem2, 0x0C, itemGuid + 20000u);
      write_u32(s_gem2, 0x10, 6u);
      write_u32(s_gem2, 0x14, (uint32_t)(uintptr_t)s_gem2_data);
      write_u32(s_gem2, 0x2C, (uint32_t)(uintptr_t)s_gem2_path);
      write_u32(s_gem2_data, 0x00, 2u);
      write_u32(s_gem2_data, 0x18, 0x10u);
      write_u32(s_gem2_data, 0x2C, ilvl);
      write_u16(s_gem2_data, 0x30, itemFormat);
      s_gem2_data[0x45] = 0xFFu;
      write_u32(s_gem2_data, 0x5C, (uint32_t)(uintptr_t)s_item_inv);
      write_u32(s_gem2_data, 0x60, (uint32_t)(uintptr_t)s_gem1);
      pCreateStatListEx(s_gem2, 0u, NULL, s_game);
    }
  }
}

int main(int argc, char **argv) {
  const char *outPath = argc > 1 ? argv[1] : "s2c-113c.d2tv";
  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  SetUnhandledExceptionFilter(crash_filter);

  HMODULE hStorm = LoadLibraryA("Storm.dll");
  HMODULE hFog   = LoadLibraryA("Fog.dll");
  HMODULE hLang  = LoadLibraryA("D2Lang.dll");
  HMODULE hCom   = LoadLibraryA("D2Common.dll");
  HMODULE hNet   = LoadLibraryA("D2Net.dll");
  HMODULE hGame  = LoadLibraryA("D2Game.dll");
  if (!hStorm || !hFog || !hLang || !hCom || !hNet || !hGame) {
    fprintf(stderr, "[s2c-emitter] failed to load DLLs\n");
    return 2;
  }
  if ((uintptr_t)hCom != D2COM_PREF_BASE) {
    fprintf(stderr, "[s2c-emitter] unexpected D2Common base %p\n", (void *)hCom);
    return 3;
  }
  g_hFog = hFog;
  g_hCom = hCom;
  g_hNet = hNet;
  g_hGame = hGame;
  g_fog_rebase = (uintptr_t)hFog - FOG_PREF_BASE;
  g_com_rebase = (uintptr_t)hCom - D2COM_PREF_BASE;
  g_net_rebase = (uintptr_t)hNet - D2NET_PREF_BASE;
  g_game_rebase = (uintptr_t)hGame - D2GAME_PREF_BASE;

  SMemFree_t pFree = (SMemFree_t)(void (*)(void))GetProcAddress(hStorm, MAKEINTRESOURCEA(403));
  SFileOpenArchive_t pOpen =
      (SFileOpenArchive_t)(void (*)(void))GetProcAddress(hStorm, MAKEINTRESOURCEA(266));
  {
    IMAGE_DOS_HEADER *dos = (IMAGE_DOS_HEADER *)hStorm;
    IMAGE_NT_HEADERS32 *nt = (IMAGE_NT_HEADERS32 *)((uint8_t *)hStorm + dos->e_lfanew);
    uintptr_t rb = (uintptr_t)hStorm - nt->OptionalHeader.ImageBase;
    void **pp = (void **)(0x6FC43120u + rb);
    if (*pp) {
      pFree(*pp, "s2c-emitter.c", 1, 0);
      *pp = NULL;
    }
  }

  ((Fog_InitLogPrefix_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10021)))("D2");
  ((Fog_InitFileSystem_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10101)))(0, NULL);
  ((Fog_InitSystem_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10089)))(1, NULL);
  ((Fog_VoidStd_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10082)))();
  /* Fog.#10218 builds runtime Huffman code table (0x6FF80DD0) & decode tree (0x6FF806D0) */
  ((Fog_VoidStd_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10218)))();
  SetUnhandledExceptionFilter(crash_filter);

  if (!open_mpq_if_exists(pOpen, "d2data.mpq", 1000, 1) ||
      !open_mpq_if_exists(pOpen, "d2char.mpq", 1000, 0) ||
      !open_mpq_if_exists(pOpen, "d2sfx.mpq", 1000, 0) ||
      !open_mpq_if_exists(pOpen, "d2speech.mpq", 1000, 0) ||
      !open_mpq_if_exists(pOpen, "d2exp.mpq", 3000, 1) ||
      !open_mpq_if_exists(pOpen, "Patch_D2.mpq", 5000, 1)) {
    return 4;
  }

  int isExp = ((Fog_IsExpansion_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10227)))();
  ((D2Lang_Init_t)(void (*)(void))GetProcAddress(hLang, MAKEINTRESOURCEA(10008)))(0, NULL, isExp);
  D2Common_InitTables_t pInitTables =
      (D2Common_InitTables_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10943));
  if (!pInitTables || !pInitTables(0, 0, 0)) {
    fprintf(stderr, "[s2c-emitter] D2Common.#10943 failed\n");
    return 5;
  }

  /* Put D2Net into server QServer mode (gnNetMode = 0) and hook Fog.#10157 (QServer_Send) */
  *(uint32_t *)(0x6FBFB418u + g_net_rebase) = 0u;
  *(uint32_t *)(0x6FBFB424u + g_net_rebase) = 0x12345678u;
  install_jmp_hook((uintptr_t)(0x6FBF5EEEu + g_net_rebase), (void *)hook_Fog_QServer_Send);

  Fog_DecompressPacket_t fnDecompress =
      (Fog_DecompressPacket_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10224));
  D2Net_SendPacket_t fnNetSendPacket =
      (D2Net_SendPacket_t)(void (*)(void))GetProcAddress(hNet, MAKEINTRESOURCEA(10002));
  D2Net_GetS2CPacketSize_t fnGetS2CSize =
      (D2Net_GetS2CPacketSize_t)(void (*)(void))GetProcAddress(hNet, MAKEINTRESOURCEA(10033));

  D2Common_GetItemsTxt_t pGetItemsTxt =
      (D2Common_GetItemsTxt_t)(uintptr_t)(0x6FC2A53Eu + g_game_rebase);
  D2Common_CheckItemTypeId_t pCheckItemTypeId =
      (D2Common_CheckItemTypeId_t)(uintptr_t)(0x6FC2A430u + g_game_rebase);
  D2Common_AllocStatList_t pAllocStatList =
      (D2Common_AllocStatList_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(11013));
  D2Common_CreateStatListEx_t pCreateStatListEx =
      (D2Common_CreateStatListEx_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(11166));
  D2Common_SetUnitStat_t pSetUnitStat =
      (D2Common_SetUnitStat_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10887));
  D2Common_SetStatIfValid_t pSetStatIfValid =
      (D2Common_SetStatIfValid_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10188));
  D2Common_SetStatListState_t pSetStatListState =
      (D2Common_SetStatListState_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10785));
  D2Common_MergeStatLists_t pMergeStatLists =
      (D2Common_MergeStatLists_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10807));
  D2Common_ToggleGfxStateFlag_t pToggleGfxStateFlag =
      (D2Common_ToggleGfxStateFlag_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10945));

  D2Game_Send18_t fnSend18 = (D2Game_Send18_t)(uintptr_t)(0x6FCAB8C0u + g_game_rebase);
  D2Game_Send95_t fnSend95 = (D2Game_Send95_t)(uintptr_t)(0x6FCAB7F0u + g_game_rebase);
  D2Game_Send96_t fnSend96 = (D2Game_Send96_t)(uintptr_t)(0x6FCAB750u + g_game_rebase);
  D2Game_SendUnitStates_t fnSendGfxStates = (D2Game_SendUnitStates_t)(uintptr_t)(0x6FC9A5E0u + g_game_rebase);
  D2Game_SendUnitStates_t fnSendAllStates = (D2Game_SendUnitStates_t)(uintptr_t)(0x6FC9A940u + g_game_rebase);
  D2Game_Send0F_t fnSend0F = (D2Game_Send0F_t)(uintptr_t)(0x6FCEBA20u + g_game_rebase);

  /* Discover compact items, non-compact equippable items, gems, and sendable states */
  uint16_t compactItems[128];
  int numCompact = 0;
  uint16_t fullItems[256];
  int numFull = 0;
  uint16_t gemItems[32];
  int numGems = 0;
  memset(s_item, 0, sizeof(s_item));
  write_u32(s_item, 0x00, 4u);
  for (int id = 0; id < 650; id++) {
    uint8_t *pTxt = pGetItemsTxt(id);
    if (!pTxt) continue;
    uint32_t code = read_u32(pTxt, 0x80);
    if (code == 0x20766367u || code == 0x20777067u || code == 0x20726367u || code == 0x313072u || code == 0x20313072u) {
      if (numGems < 32) gemItems[numGems++] = (uint16_t)id;
    }
    if (pTxt[0x137] != 0u) {
      if (numCompact < 128 && id >= 500) compactItems[numCompact++] = (uint16_t)id;
    } else {
      write_u32(s_item, 0x04, (uint32_t)id);
      if ((pCheckItemTypeId(s_item, 45) || pCheckItemTypeId(s_item, 2) ||
           pCheckItemTypeId(s_item, 10) || pCheckItemTypeId(s_item, 12)) && numFull < 256) {
        fullItems[numFull++] = (uint16_t)id;
      }
    }
  }
  if (numCompact == 0 || numFull == 0 || numGems == 0) {
    fprintf(stderr, "[s2c-emitter] item discovery failed (%d/%d/%d)\n", numCompact, numFull, numGems);
    return 6;
  }

  uint8_t *sgpt = *(uint8_t **)(0x6FDE9E1Cu + g_com_rebase);
  uint8_t *pStatesTxt = *(uint8_t **)(sgpt + 0xBC);
  uint32_t nStatesCount = read_u32(sgpt, 0xC4);
  uint8_t *pSkillsTxt = *(uint8_t **)(sgpt + 0xB98);
  uint32_t nSkillsCount = read_u32(sgpt, 0xB9C);

  uint8_t sendableStates[192];
  int numSendableStates = 0;
  uint8_t nosendStates[32];
  int numNosendStates = 0;
  for (uint32_t st = 1; st < nStatesCount; st++) {
    uint8_t flagsByte = pStatesTxt[st * 0x3Cu + 0x10u];
    if ((flagsByte & 1u) == 0u) {
      if (numSendableStates < 192) sendableStates[numSendableStates++] = (uint8_t)st;
    } else {
      if (numNosendStates < 32) nosendStates[numNosendStates++] = (uint8_t)st;
    }
  }

  /* Sendable stats with positive bSendBits in ItemStatCost.txt (0=str, 1=ene, 2=dex, 3=vit, 7=maxhp, 9=maxmana, 21=mindmg, 31=ac, 39=fireres, 67=velpct, 93=ias) */
  static const uint16_t kSendableStats[10] = { 0, 1, 2, 3, 7, 9, 21, 31, 39, 93 };

  /* Exact schedule summing to 1,440 records across opKind 0..22 */
  static const uint32_t kOpCounts[23] = {
    80, /*  0: 0x18 */
    80, /*  1: 0x95 */
    50, /*  2: 0x96 */
    90, /*  3: 0x1D/0x1E/0x1F */
    60, /*  4: 0x1A/0x1B/0x1C */
    60, /*  5: 0x19/0x1D/0x1E/0x1F */
    60, /*  6: 0x9E/0x9F/0xA0 */
    60, /*  7: 0xA0/0xA1/0xA2 */
    90, /*  8: 0xA7/0xA8/0xA9 */
    90, /*  9: 0xAA */
    60, /* 10: 0x0F */
    60, /* 11: 0x15 */
    70, /* 12: 0x67 */
    50, /* 13: 0x68 */
    60, /* 14: 0x6D */
    90, /* 15: 0x9C */
    90, /* 16: 0x9D */
    45, /* 17: 0x3E */
    35, /* 18: 0x7D */
    40, /* 19: 0x21 */
    40, /* 20: 0x22 */
    40, /* 21: 0x23 */
    40  /* 22: 0xA3, 0xAB, >=0xF0 coalesced, Q0 0xAF, Q2 raw */
  };

  S2CVectorRecord *records = (S2CVectorRecord *)calloc(S2C_COUNT, sizeof(S2CVectorRecord));
  if (!records) return 7;

  uint32_t recIdx = 0;
  for (uint8_t op = 0; op < 23; op++) {
    uint32_t count = kOpCounts[op];
    for (uint32_t k = 0; k < count; k++, recIdx++) {
      g_cur_idx = recIdx;
      S2CVectorRecord *rec = &records[recIdx];
      rec->opKind = op;

      /* Deterministic PRNG mix per (op, k) for diverse edge-case + random inputs */
      uint32_t h1 = fnv1a32((const uint8_t *)&recIdx, 4) ^ ((uint32_t)op * 0x9E3779B9u + k * 0x85EBCA6Bu);
      uint32_t h2 = mix32_bytes((const uint8_t *)&h1, 4);

      /* Populate 16-byte inputs per opKind */
      rec->flags = 1u; /* default nQueue = 1 */
      rec->u16A = (uint16_t)(h1 & 0xFFFFu);
      rec->u32A = h1 ^ (h2 << 7);
      rec->u32B = h2 ^ (h1 >> 3);
      rec->u16B = (uint16_t)((h2 >> 16) & 0xFFFFu);
      rec->u16C = (uint16_t)((h1 >> 16) & 0xFFFFu);

      if (op == 0u) {
        rec->flags = (uint8_t)(1u | (((k * 7u) & 0x3Fu) << 2));
        if (k == 0u) { rec->u16A = 0u; rec->u32A = 0u; rec->u32B = 0u; rec->u16B = 5000u; rec->u16C = 5000u; }
        else if (k == 1u) { rec->u16A = 0xFFFFu; rec->u32A = 0xFFFFFFFFu; rec->u32B = 0xFFFFFFFFu; rec->u16B = 0x7FFFu; rec->u16C = 0x7FFFu; }
      } else if (op == 3u) {
        rec->u16A = (uint16_t)((k * 11u) % 255u);
        if (k % 3u == 0u) rec->u32A = (k == 0u) ? 0u : (k == 3u ? 254u : (h1 % 255u));
        else if (k % 3u == 1u) rec->u32A = (k == 1u) ? 255u : (k == 4u ? 65534u : (255u + (h1 % 65280u)));
        else rec->u32A = (k == 2u) ? 65535u : (k == 5u ? 0xFFFFFFFFu : (65535u + (h1 & 0x7FFFFFFFu)));
      } else if (op == 4u) {
        if (k % 3u == 0u) { rec->u32B = 1000u + k * 50u; rec->u32A = rec->u32B + (k == 0u ? 0u : (k == 3u ? 254u : (k * 7u) % 255u)); }
        else if (k % 3u == 1u) { rec->u32B = 5000u + k * 100u; rec->u32A = rec->u32B + (k == 1u ? 255u : (k == 4u ? 65534u : 255u + (h1 % 65000u))); }
        else if (k % 6u == 2u) { rec->u32B = 10000u; rec->u32A = 10000u + 65535u + (h1 & 0x00FFFFFFu); }
        else { rec->u32B = 50000u; rec->u32A = 49999u - (k * 13u); } /* negative delta -> 0x1C */
      } else if (op == 5u) {
        if (k % 4u == 0u) { rec->u32B = 500u; rec->u32A = 500u + 1u + ((k * 9u) % 253u); } /* 0x19 */
        else if (k % 4u == 1u) { rec->u32A = (k * 13u) % 255u; rec->u32B = rec->u32A; } /* delta 0 -> 0x1D */
        else if (k % 4u == 2u) { rec->u32A = 255u + ((h1) % 65000u); rec->u32B = rec->u32A + 10u; } /* neg delta -> 0x1E */
        else { rec->u32A = 65535u + (h1 % 2000000u); rec->u32B = 0u; } /* delta >= 255 & >= 65535 -> 0x1F */
      } else if (op == 6u) {
        rec->flags = (uint8_t)(1u | ((k % 9u == 0u) ? 4u : 0u));
        rec->u16A = (uint16_t)((k * 7u) % 255u);
        if (k % 3u == 0u) rec->u32A = (k * 11u) % 255u;
        else if (k % 3u == 1u) rec->u32A = 255u + (h1 % 65280u);
        else rec->u32A = 65535u + (h1 & 0x7FFFFFFFu);
      } else if (op == 7u) {
        rec->flags = (uint8_t)(1u | ((k % 9u == 0u) ? 4u : 0u));
        rec->u16A = (uint16_t)((k * 5u) % 255u);
        if (k % 3u == 0u) { rec->u32B = 100u + k; rec->u32A = rec->u32B + ((k * 9u) % 255u); } /* 0xA1 */
        else if (k % 3u == 1u) { rec->u32B = 200u + k; rec->u32A = rec->u32B + 255u + (h1 % 65000u); } /* 0xA2 */
        else { rec->u32B = 1000u + (h2 % 90000u); rec->u32A = rec->u32B - 5u; } /* unsigned wrap >= 0xFFFF -> 0xA0 */
      } else if (op == 8u) {
        uint8_t uType = (uint8_t)(k & 1u);
        uint8_t modeA = (uint8_t)(k % 4u);
        uint8_t hasSecond = (uint8_t)((k % 5u == 0u) ? 1u : 0u);
        uint8_t secondEnded = (uint8_t)((k % 10u == 0u) ? 1u : 0u);
        rec->flags = (uint8_t)(1u | (uType << 2) | (modeA << 3) | (hasSecond << 5) | (secondEnded << 6));
        uint8_t stA = sendableStates[(k * 5u) % (uint32_t)numSendableStates];
        uint8_t stB = (k % 15u == 0u && numNosendStates > 0)
                          ? nosendStates[k % (uint32_t)numNosendStates]
                          : sendableStates[(k * 5u + 17u) % (uint32_t)numSendableStates];
        if (stB == stA) stB = sendableStates[(k * 5u + 19u) % (uint32_t)numSendableStates];
        rec->u16A = (uint16_t)(stA | ((uint16_t)stB << 8));
        rec->u16B = kSendableStats[k % 10u];
        rec->u16C = (uint16_t)(1u + (k * 7u) % 60u);
        uint16_t stat2 = kSendableStats[(k + 3u) % 10u];
        if (stat2 == rec->u16B) stat2 = kSendableStats[(k + 4u) % 10u];
        rec->u32B = ((uint32_t)stat2 << 16);
        rec->u32A = 100u + k;
      } else if (op == 9u) {
        uint8_t uType = (uint8_t)(k & 1u);
        uint8_t hasStats0 = (uint8_t)((k % 2u == 0u) ? 1u : 0u);
        uint8_t hasTwoStats0 = (uint8_t)((k % 4u == 0u) ? 1u : 0u);
        uint8_t hasStats1 = (uint8_t)((k % 3u == 0u) ? 1u : 0u);
        rec->flags = (uint8_t)(1u | (uType << 2) | (hasStats0 << 3) | (hasTwoStats0 << 4) | (hasStats1 << 5));
        if (k == 0u) {
          rec->u16A = 0u; /* empty active state set -> minimal 8B 0xAA */
        } else {
          uint8_t s0 = sendableStates[(k * 7u) % (uint32_t)numSendableStates];
          uint8_t s1 = (k % 3u == 1u) ? 0u : sendableStates[(k * 7u + 23u) % (uint32_t)numSendableStates];
          if (s1 == s0) s1 = 0u;
          rec->u16A = (uint16_t)(s0 | ((uint16_t)s1 << 8));
        }
        rec->u16B = kSendableStats[k % 10u];
        rec->u16C = (uint16_t)(2u + (k * 5u) % 50u);
        uint16_t stat2 = kSendableStats[(k + 5u) % 10u];
        if (stat2 == rec->u16B) stat2 = kSendableStats[(k + 6u) % 10u];
        rec->u32B = ((uint32_t)stat2 << 16);
        rec->u32A = 500u + k;
      } else if (op == 10u) {
        rec->flags = (uint8_t)(1u | (((k * 13u) & 0x3Fu) << 2));
        rec->u16A = (uint16_t)(k % 20u); /* nAnimMode 0..19 */
        rec->u16B = (uint16_t)(5000u + (k * 17u) % 2000u);
        rec->u16C = (uint16_t)(5100u + (k * 23u) % 2000u);
        rec->u32B = ((5200u + k * 7u) & 0xFFFFu) | (((5300u + k * 11u) & 0xFFFFu) << 16);
      } else if (op == 11u) {
        rec->flags = (uint8_t)(1u | ((k % 3u) << 2)); /* unitType 0, 1, 2 */
        rec->u16A = (uint16_t)(k & 1u);               /* bFlash 0 or 1 */
        rec->u16B = (uint16_t)(4800u + k * 19u);
        rec->u16C = (uint16_t)(4900u + k * 29u);
      } else if (op == 12u) {
        static const uint8_t kPathTypes[7] = { 0, 1, 4, 5, 6, 7, 8 };
        uint8_t pt = kPathTypes[k % 7u];
        uint8_t extremeVel = (uint8_t)((k % 7u == 3u || k % 7u == 4u) ? 1u : 0u);
        rec->flags = (uint8_t)(1u | (extremeVel << 2) | (((k * 3u) & 7u) << 3));
        rec->u16A = (uint16_t)(pt | (((k * 17u) & 0xFFu) << 4) | (((k * 5u) & 0x0Fu) << 12));
        rec->u16B = (uint16_t)(5100u + k * 13u);
        rec->u16C = (uint16_t)(5200u + k * 17u);
        if (pt == 5u || pt == 6u) {
          rec->u32B = ((5400u + k * 3u) & 0xFFFFu) | (((5500u + k * 5u) & 0xFFFFu) << 16);
        } else if (extremeVel) {
          rec->u32B = (k % 2u == 0u) ? (uint32_t)(-50000) : 50000u;
        } else {
          rec->u32B = (uint32_t)(uint16_t)((int16_t)((int32_t)(k * 19u % 300u) - 100));
        }
        rec->u32A = 1u + k * 3u;
      } else if (op == 13u) {
        static const uint8_t kPathTypes2[5] = { 0, 2, 4, 7, 8 };
        uint8_t pt = kPathTypes2[k % 5u];
        uint8_t extremeVel = (uint8_t)((k % 8u == 0u) ? 1u : 0u);
        rec->flags = (uint8_t)(1u | (extremeVel << 2) | (((k) & 7u) << 3) | (((k % 3u) & 3u) << 6));
        rec->u16A = (uint16_t)(pt | (((k * 23u) & 0xFFu) << 8));
        rec->u16B = (uint16_t)(5050u + k * 11u);
        rec->u16C = (uint16_t)(5150u + k * 15u);
        rec->u32A = 200u + k;
        rec->u32B = 1u + k * 7u;
      } else if (op == 14u) {
        rec->u32A = 300u + k * 5u;
        rec->u16B = (uint16_t)(5000u + k * 9u);
        rec->u16C = (uint16_t)(5100u + k * 11u);
        rec->u16A = (uint16_t)((k * 17u) % 129u); /* life pct 0..128 */
      } else if (op == 15u || op == 16u) {
        int useCompact = (k % 4u == 0u);
        uint16_t itemId = useCompact
                              ? compactItems[(k * 3u) % (uint32_t)numCompact]
                              : fullItems[(k * 7u) % (uint32_t)numFull];
        static const uint8_t kQuals[6] = { 1, 2, 3, 4, 6, 7 };
        static const uint8_t kModes[4] = { 0, 1, 3, 5 };
        static const uint8_t kBodyLocs[6] = { 0, 1, 2, 3, 6, 8 }; /* avoid 4/5 dual-wield grid */
        static const uint8_t kPages[4] = { 0, 3, 4, 7 };
        uint8_t qual = useCompact ? 2u : kQuals[k % 6u];
        uint8_t animMode = (op == 15u) ? kModes[k % 4u] : kModes[k % 2u];
        uint8_t bodyLoc = (animMode == 1u) ? kBodyLocs[k % 6u] : 0u;
        uint8_t invPage = kPages[k % 4u];
        uint32_t fmtBit = (k % 9u == 0u) ? 1u : 0u;
        uint32_t ilvl = 1u + ((k * 11u) % 63u);
        uint32_t nGems = (!useCompact && (k % 5u == 4u)) ? (1u + (k & 1u)) : 0u;
        uint32_t isEth = (!useCompact && (k % 7u == 0u)) ? 1u : 0u;
        uint32_t isIdent = (!useCompact && (k % 3u != 0u)) ? 1u : 0u;
        uint32_t posX = (k * 3u) & 0x0Fu;
        uint32_t posY = (k * 5u) & 0x07u;

        uint32_t cfg = (uint32_t)qual
                     | ((uint32_t)animMode << 4)
                     | ((uint32_t)bodyLoc << 7)
                     | ((uint32_t)invPage << 11)
                     | (fmtBit << 14)
                     | (ilvl << 15)
                     | (nGems << 21)
                     | (isEth << 23)
                     | (isIdent << 24)
                     | (posX << 25)
                     | (posY << 29);

        static const uint8_t kAct9C[8] = { 0x00, 0x01, 0x02, 0x03, 0x04, 0x0A, 0x0B, 0x0E };
        static const uint8_t kAct9D[8] = { 0x06, 0x07, 0x08, 0x09, 0x11, 0x14, 0x15, 0x17 };
        uint8_t bAction = (op == 15u) ? kAct9C[k % 8u] : kAct9D[k % 8u];
        uint8_t simpleBit = (!useCompact && nGems == 0u && (k % 11u == 5u)) ? 1u : 0u;
        uint8_t clientActBit = (k & 1u);
        uint8_t ownerMode = (uint8_t)((k / 2u) % 4u); /* 0=player, 1=monster, 2=item, 3=NULL */
        rec->flags = (uint8_t)(1u | (simpleBit << 2) | (clientActBit << 3) | (ownerMode << 4));
        rec->u16A = itemId;
        rec->u32A = 1000u + k * 13u + (uint32_t)op * 100u;
        rec->u32B = cfg;
        rec->u16B = (uint16_t)(bAction | ((isIdent ? 0x10u : 0u) << 8));
        rec->u16C = gemItems[k % (uint32_t)numGems];
      } else if (op == 17u) {
        uint8_t nullItem = (uint8_t)((k % 9u == 0u) ? 1u : 0u);
        uint8_t flagBit = (uint8_t)(k & 1u);
        rec->flags = (uint8_t)(1u | (nullItem << 2) | (flagBit << 3));
        rec->u16A = (uint16_t)((k * 13u) & 0x1FFu);
        rec->u16B = (k % 2u == 0u) ? (uint16_t)(k * 5u % 256u) : (uint16_t)(256u + k * 197u);
        if (k % 4u == 0u) rec->u32B = 0u;
        else if (k % 4u == 1u) rec->u32B = 1u + (k * 7u);
        else if (k % 4u == 2u) rec->u32B = 0x12345u + k * 999u;
        else rec->u32B = 0x80000000u | (h1 & 0x7FFFFFFFu);
        rec->u32A = (k % 5u == 0u) ? 0u : (1u + k * 37u);
      } else if (op == 18u) {
        uint8_t nullOwner = (uint8_t)((k % 7u == 0u) ? 1u : 0u);
        uint8_t ownerType = (uint8_t)(k % 4u);
        uint8_t nullItem = (uint8_t)((k % 11u == 0u) ? 1u : 0u);
        rec->flags = (uint8_t)(1u | (nullOwner << 2) | (ownerType << 3) | (nullItem << 5));
      } else if (op == 19u) {
        uint8_t uType = (uint8_t)(k & 1u);
        uint8_t cClass = (uint8_t)((k / 2u) % 7u);
        uint8_t itemOwnedSkill = (uint8_t)((k % 5u == 0u) ? 1u : 0u);
        rec->flags = (uint8_t)(1u | (uType << 2) | ((cClass & 7u) << 3) | (itemOwnedSkill << 6));
        rec->u16A = (uint16_t)(1u + ((k * 9u) % (nSkillsCount > 1u ? (nSkillsCount - 1u) : 1u)));
        rec->u16B = (uint16_t)((1u + (k % 20u)) | (((k * 3u) & 0xFFu) << 8));
        rec->u16C = (uint16_t)(k % 6u);
        rec->u32B = k % 5u;
        rec->u32A = 700u + k;
      } else if (op == 20u) {
        uint8_t uType = (uint8_t)(k & 1u);
        uint8_t regUnit = (uint8_t)((k % 3u != 0u) ? 1u : 0u);
        uint8_t morph = (uint8_t)((regUnit && (k % 2u == 1u)) ? 1u : 0u);
        rec->flags = (uint8_t)(1u | (uType << 2) | (regUnit << 3) | (morph << 4));
        rec->u16A = (uint16_t)(6u + k * 5u);
        rec->u16B = (uint16_t)((k * 7u) & 0xFFu);
        rec->u32A = 800u + k;
      } else if (op == 21u) {
        rec->flags = (uint8_t)(1u | ((k & 3u) << 2) | (((k >> 2) & 1u) << 4));
        rec->u16A = (uint16_t)(k * 9u % 350u);
        rec->u32A = 900u + k;
        rec->u32B = (k % 3u == 0u) ? 0xFFFFFFFFu : (5000u + k);
      } else if (op == 22u) {
        if (k < 10u) {
          /* subMode 0: 0xA3 (24B) */
          rec->flags = (uint8_t)(1u | (0u << 2));
          rec->u16A = (uint16_t)((k & 3u) | (((k >> 2) & 3u) << 2) | (((k * 13u) & 0xFFu) << 8));
          rec->u16B = (uint16_t)(1u + k * 11u);
          rec->u16C = (uint16_t)(1u + k);
        } else if (k < 20u) {
          /* subMode 1: 0xAB (7B) */
          rec->flags = (uint8_t)(1u | (1u << 2));
          rec->u16A = (uint16_t)(k & 3u);
          rec->u16B = (uint16_t)((k * 13u) % 129u);
        } else if (k < 32u) {
          /* subMode 2: multi-packet coalescing across 1-byte (< 0xF0) & 2-byte (>= 0xF0) wire headers */
          rec->flags = (uint8_t)(1u | (2u << 2));
          rec->u16A = (uint16_t)(6u + (k - 20u)); /* 6..17 packets coalesced in one node (<= 432B <= 0x200) */
        } else if (k < 36u) {
          /* subMode 3: nQueue = 0, opcode 0xAF raw unframed bypass */
          rec->flags = (uint8_t)(0u | (3u << 2));
          rec->u16A = (uint16_t)(k - 32u); /* [0xAF, 0..3] */
        } else {
          /* subMode 4: nQueue = 2, raw unframed bypass */
          rec->flags = (uint8_t)(2u | (4u << 2));
          rec->u16A = (uint16_t)(10u + (k - 36u));
        }
      }

      /* === Execute purely from the 16-byte record inputs === */
      memset(s_game, 0, sizeof(s_game));
      memset(s_client, 0, sizeof(s_client));
      memset(s_pkt_nodes, 0, sizeof(s_pkt_nodes));
      memset(s_unit, 0, sizeof(s_unit));
      memset(s_owner, 0, sizeof(s_owner));
      memset(s_path, 0, sizeof(s_path));
      memset(s_skill_list, 0, sizeof(s_skill_list));
      memset(s_skill_node, 0, sizeof(s_skill_node));

      /* Link static free list of 4 0x208-byte packet nodes on s_client + 0x1C0 */
      for (int n = 0; n < 3; n++) {
        write_u32(s_pkt_nodes[n], 0x204, (uint32_t)(uintptr_t)s_pkt_nodes[n + 1]);
      }
      write_u32(s_client, 0x00, 1u); /* dwClientId = 1 */
      write_u32(s_client, 0x1A8, (uint32_t)(uintptr_t)s_game);
      write_u32(s_client, 0x1C0, (uint32_t)(uintptr_t)s_pkt_nodes[0]);
      s_game[0x6A] = 0u; /* nGameType = 0 so 0x6FC4D500 flushes queue directly */

      g_wire_len = 0u;
      g_wire_calls = 0u;
      memset(g_wire_buf, 0, sizeof(g_wire_buf));

      uint8_t rawBuf[512];
      uint32_t rawLen = 0u;
      uint32_t nQueue = rec->flags & 3u;
      int isDirectNetSend = 0;

      switch (rec->opKind) {
        case 0: {
          uint32_t wLife = rec->u16A & 0x7FFFu;
          uint32_t wMana = rec->u32A & 0x7FFFu;
          uint32_t wStam = (rec->u32A >> 15) & 0x7FFFu;
          uint32_t bLifeReg = ((rec->flags >> 2) & 0x3Fu) | (((rec->u16A >> 15) & 1u) << 6);
          uint32_t bManaReg = ((rec->u32A >> 30) & 3u) | ((rec->u32B & 0x1Fu) << 2);
          scrub_stack_below_esp();
          fnSend18(s_client, wLife, wMana, wStam, bLifeReg, bManaReg,
                   rec->u16B, rec->u16C, (rec->u32B >> 8) & 0xFFu, (rec->u32B >> 16) & 0xFFu);
          break;
        }
        case 1: {
          scrub_stack_below_esp();
          fnSend95(s_client, rec->u16A & 0x7FFFu, rec->u32A & 0x7FFFu, (rec->u32A >> 15) & 0x7FFFu,
                   rec->u16B, rec->u16C, rec->u32B & 0xFFu, (rec->u32B >> 8) & 0xFFu);
          break;
        }
        case 2: {
          scrub_stack_below_esp();
          fnSend96(s_client, rec->u16A & 0x7FFFu, rec->u16B, rec->u16C,
                   rec->u32A & 0xFFu, (rec->u32A >> 8) & 0xFFu);
          break;
        }
        case 3: {
          call_D2Game_Send1D1E1F(s_client, rec->u16A % 255u, rec->u32A);
          break;
        }
        case 4: {
          call_D2Game_Send1A1B1C(s_client, (int32_t)rec->u32A, (int32_t)rec->u32B);
          break;
        }
        case 5: {
          call_D2Game_Send19Gold(s_client, (int32_t)rec->u32A, (int32_t)rec->u32B);
          break;
        }
        case 6: {
          void *pU = NULL;
          if ((rec->flags & 4u) == 0u) {
            write_u32(s_unit, 0x0C, rec->u32B);
            pU = s_unit;
          }
          call_D2Game_Send9E9FA0(rec->u16A % 255u, pU, s_client, rec->u32A);
          break;
        }
        case 7: {
          void *pU = NULL;
          if ((rec->flags & 4u) == 0u) {
            write_u32(s_unit, 0x0C, ((uint32_t)rec->u16B << 16) | rec->u16C);
            pU = s_unit;
          }
          call_D2Game_SendA0A1A2(s_client, rec->u16A % 255u, (int32_t)rec->u32A, (int32_t)rec->u32B, pU);
          break;
        }
        case 8: {
          uint32_t uType = (rec->flags >> 2) & 1u;
          uint32_t modeA = (rec->flags >> 3) & 3u;
          uint32_t hasSecond = (rec->flags >> 5) & 1u;
          uint32_t secondEnded = (rec->flags >> 6) & 1u;
          uint8_t stA = (uint8_t)(rec->u16A & 0xFFu);
          uint8_t stB = (uint8_t)((rec->u16A >> 8) & 0xFFu);

          write_u32(s_unit, 0x00, uType);
          write_u32(s_unit, 0x0C, rec->u32A);
          pCreateStatListEx(s_unit, 0u, NULL, s_game);

          if (modeA == 0u) {
            pToggleGfxStateFlag(s_unit, stA, 1);
            pToggleGfxStateFlag(s_unit, stA, 0);
          } else if (modeA == 1u) {
            pToggleGfxStateFlag(s_unit, stA, 1);
          } else {
            pToggleGfxStateFlag(s_unit, stA, 1);
            void *pSub = pAllocStatList(NULL, 0u, 0u, (int32_t)uType, (int32_t)rec->u32A);
            pSetStatListState(pSub, stA);
            int32_t v1 = (int32_t)(int16_t)rec->u16C;
            if (rec->u16B == 7u || rec->u16B == 9u) v1 <<= 8;
            pSetStatIfValid(pSub, rec->u16B, v1, rec->u32B & 0xFFFFu);
            if (modeA == 3u) {
              uint16_t st2 = (uint16_t)((rec->u32B >> 16) & 0x1FFu);
              int32_t v2 = (int32_t)((rec->u16C * 3u + 7u) & 0x3Fu) + 1;
              if (st2 == 7u || st2 == 9u) v2 <<= 8;
              pSetStatIfValid(pSub, st2, v2, 0u);
            }
            pMergeStatLists(s_unit, pSub, 1);
          }

          if (hasSecond && stB != 0u && stB != stA) {
            pToggleGfxStateFlag(s_unit, stB, 1);
            if (secondEnded) pToggleGfxStateFlag(s_unit, stB, 0);
          }

          scrub_stack_below_esp();
          fnSendGfxStates(s_unit, s_client);
          break;
        }
        case 9: {
          uint32_t uType = (rec->flags >> 2) & 1u;
          uint32_t hasStats0 = (rec->flags >> 3) & 1u;
          uint32_t hasTwo0 = (rec->flags >> 4) & 1u;
          uint32_t hasStats1 = (rec->flags >> 5) & 1u;
          uint8_t s0 = (uint8_t)(rec->u16A & 0xFFu);
          uint8_t s1 = (uint8_t)((rec->u16A >> 8) & 0xFFu);

          write_u32(s_unit, 0x00, uType);
          write_u32(s_unit, 0x0C, rec->u32A);
          pCreateStatListEx(s_unit, 0u, NULL, s_game);

          if (s0 != 0u) {
            pToggleGfxStateFlag(s_unit, s0, 1);
            if (hasStats0) {
              void *pSub0 = pAllocStatList(NULL, 0u, 0u, (int32_t)uType, (int32_t)rec->u32A);
              pSetStatListState(pSub0, s0);
              int32_t v1 = (int32_t)(int16_t)rec->u16C;
              if (rec->u16B == 7u || rec->u16B == 9u) v1 <<= 8;
              pSetStatIfValid(pSub0, rec->u16B, v1, rec->u32B & 0xFFFFu);
              if (hasTwo0) {
                uint16_t st2 = (uint16_t)((rec->u32B >> 16) & 0x1FFu);
                int32_t v2 = (int32_t)((rec->u16C & 0x3Fu) + 1u);
                if (st2 == 7u || st2 == 9u) v2 <<= 8;
                pSetStatIfValid(pSub0, st2, v2, 0u);
              }
              pMergeStatLists(s_unit, pSub0, 1);
            }
          }
          if (s1 != 0u && s1 != s0) {
            pToggleGfxStateFlag(s_unit, s1, 1);
            if (hasStats1) {
              void *pSub1 = pAllocStatList(NULL, 0u, 0u, (int32_t)uType, (int32_t)rec->u32A);
              pSetStatListState(pSub1, s1);
              pSetStatIfValid(pSub1, 21, (int32_t)((rec->u16C & 0x1Fu) + 1u), 0u);
              pMergeStatLists(s_unit, pSub1, 1);
            }
          }

          scrub_stack_below_esp();
          fnSendAllStates(s_unit, s_client);
          break;
        }
        case 10: {
          write_u32(s_unit, 0x00, 0u);
          write_u32(s_unit, 0x0C, rec->u32A);
          write_u32(s_unit, 0x2C, (uint32_t)(uintptr_t)s_path);
          s_unit[0xB0] = (uint8_t)((rec->flags >> 2) & 0x3Fu);
          write_u16(s_path, 0x02, rec->u16B);
          write_u16(s_path, 0x06, rec->u16C);
          write_u16(s_path, 0x10, (uint16_t)(rec->u32B & 0xFFFFu));
          write_u16(s_path, 0x12, (uint16_t)((rec->u32B >> 16) & 0xFFFFu));
          scrub_stack_below_esp();
          fnSend0F(s_game, s_unit, s_client, (int32_t)(rec->u16A % 20u));
          break;
        }
        case 11: {
          uint32_t uType = (rec->flags >> 2) % 3u;
          write_u32(s_unit, 0x00, uType);
          write_u32(s_unit, 0x0C, rec->u32A);
          write_u32(s_unit, 0x2C, (uint32_t)(uintptr_t)s_path);
          if (uType == 2u) {
            write_u32(s_path, 0x0C, rec->u16B);
            write_u32(s_path, 0x10, rec->u16C);
          } else {
            write_u16(s_path, 0x02, rec->u16B);
            write_u16(s_path, 0x06, rec->u16C);
          }
          call_D2Game_Send15(s_unit, s_client, rec->u16A & 0xFFu);
          break;
        }
        case 12: {
          uint32_t pt = rec->u16A & 0x0Fu;
          uint32_t extremeVel = (rec->flags >> 2) & 1u;
          uint32_t moveType = (rec->flags >> 3) & 7u;
          uint32_t bByteA = (rec->u16A >> 4) & 0xFFu;
          uint32_t bByteF = (rec->u16A >> 12) & 0x0Fu;
          uint32_t bByteB = ((rec->flags >> 2) * 17u) & 0xFFu;

          write_u32(s_unit, 0x00, 1u);
          write_u32(s_unit, 0x0C, rec->u32A);
          write_u32(s_unit, 0x2C, (uint32_t)(uintptr_t)s_path);
          write_u32(s_path, 0x3C, pt);
          if (pt == 5u || pt == 6u) {
            write_u32(s_path, 0x28, 2u); /* dwPathPoints = 2 -> last point at +0x98 + 8 = +0xA0 */
            write_u16(s_path, 0xA0, (uint16_t)(rec->u32B & 0xFFFFu));
            write_u16(s_path, 0xA2, (uint16_t)((rec->u32B >> 16) & 0xFFFFu));
          }
          pCreateStatListEx(s_unit, 0u, NULL, s_game);
          int32_t vel = (pt == 5u || pt == 6u)
                            ? (extremeVel ? 40000 : 25)
                            : (extremeVel ? (int32_t)rec->u32B : (int32_t)(int16_t)(rec->u32B & 0xFFFFu));
          pSetUnitStat(s_unit, 0x43, vel, 0);
          call_D2Game_InsertServerUnit(s_game, s_unit);
          call_D2Game_Send67(s_client, 0x67u, rec->u32A, moveType, rec->u16B, rec->u16C, bByteA, bByteF, bByteB);
          break;
        }
        case 13: {
          uint32_t pt = rec->u16A & 0x0Fu;
          uint32_t extremeVel = (rec->flags >> 2) & 1u;
          uint32_t moveType = (rec->flags >> 3) & 7u;
          uint32_t targetType = (rec->flags >> 6) & 3u;
          uint32_t bByteF = rec->u16A & 0xFFu;
          uint32_t bByte14 = (rec->u16A >> 8) & 0xFFu;
          uint32_t bByte10 = (rec->u32B ^ rec->u32A) & 0xFFu;

          write_u32(s_unit, 0x00, 1u);
          write_u32(s_unit, 0x0C, rec->u32A);
          write_u32(s_unit, 0x2C, (uint32_t)(uintptr_t)s_path);
          write_u16(s_path, 0x02, rec->u16B);
          write_u16(s_path, 0x06, rec->u16C);
          write_u32(s_path, 0x3C, pt);
          pCreateStatListEx(s_unit, 0u, NULL, s_game);
          int32_t vel = extremeVel ? ((rec->u32A & 1u) ? -45000 : 45000) : (int32_t)((int8_t)bByte14) * 3;
          pSetUnitStat(s_unit, 0x43, vel, 0);
          call_D2Game_InsertServerUnit(s_game, s_unit);
          call_D2Game_Send68(s_client, 0x68u, rec->u32A, moveType, targetType, rec->u32B, bByteF, bByte14, bByte10);
          break;
        }
        case 14: {
          call_D2Game_Send6D(s_client, rec->u32A, rec->u16B, rec->u16C, rec->u16A & 0xFFu);
          break;
        }
        case 15: {
          setup_test_item_from_input(
              rec, pGetItemsTxt, pCheckItemTypeId, pCreateStatListEx,
              pAllocStatList, pSetUnitStat, pSetStatIfValid, pMergeStatLists);
          uint32_t bSimple = (rec->flags >> 2) & 1u;
          uint32_t clientActive = (rec->flags >> 3) & 1u;
          uint32_t bAction = rec->u16B & 0xFFu;
          uint32_t extraCmdFlags = ((uint32_t)(rec->u16B >> 8) & 0xFFu);

          write_u32(s_owner, 0x00, 0u);
          write_u32(s_owner, 0x0C, 77u);
          call_D2Game_InsertServerUnit(s_game, s_owner);
          write_u32(s_client, 0x16C, 0u);
          write_u32(s_client, 0x170, 77u);
          write_u32(s_client, 0x174, (uint32_t)(uintptr_t)s_owner);
          s_client[0x3D4] = (uint8_t)clientActive;

          call_D2Game_Send9C(s_client, s_item, bAction, extraCmdFlags, bSimple);
          break;
        }
        case 16: {
          setup_test_item_from_input(
              rec, pGetItemsTxt, pCheckItemTypeId, pCreateStatListEx,
              pAllocStatList, pSetUnitStat, pSetStatIfValid, pMergeStatLists);
          uint32_t bGamble = (rec->flags >> 2) & 1u;
          uint32_t ownerMode = (rec->flags >> 4) & 3u;
          uint32_t bAction = rec->u16B & 0xFFu;
          uint32_t extraCmdFlags = ((uint32_t)(rec->u16B >> 8) & 0xFFu);

          void *pOwner = NULL;
          if (ownerMode < 3u) {
            uint32_t oType = (ownerMode == 0u) ? 0u : (ownerMode == 1u ? 1u : 4u);
            write_u32(s_owner, 0x00, oType);
            write_u32(s_owner, 0x0C, 500u + (rec->u32A & 0xFFu));
            pOwner = s_owner;
          }
          call_D2Game_Send9D(bAction, pOwner, s_item, s_client, extraCmdFlags, bGamble);
          break;
        }
        case 17: {
          void *pIt = NULL;
          if (((rec->flags >> 2) & 1u) == 0u) {
            write_u32(s_item, 0x00, 4u);
            write_u32(s_item, 0x0C, rec->u32A);
            pIt = s_item;
          }
          call_D2Game_Send3E(pIt, rec->u16B, s_client, (rec->flags >> 3) & 1u, rec->u16A & 0x1FFu, rec->u32B);
          break;
        }
        case 18: {
          void *pOw = NULL;
          if (((rec->flags >> 2) & 1u) == 0u) {
            write_u32(s_owner, 0x00, (rec->flags >> 3) & 3u);
            write_u32(s_owner, 0x0C, ((uint32_t)rec->u16A << 16) | rec->u16B);
            pOw = s_owner;
          }
          void *pIt = NULL;
          if (((rec->flags >> 5) & 1u) == 0u) {
            write_u32(s_item, 0x00, 4u);
            write_u32(s_item, 0x0C, ((uint32_t)rec->u16C << 16) | (rec->u16A ^ rec->u16B));
            pIt = s_item;
          }
          call_D2Game_Send7D(pOw, pIt, s_client, rec->u32A, rec->u32B);
          break;
        }
        case 19: {
          uint32_t uType = (rec->flags >> 2) & 1u;
          uint32_t cClass = (rec->flags >> 3) & 7u;
          uint32_t itemOwned = (rec->flags >> 6) & 1u;
          uint16_t skId = rec->u16A;
          uint8_t baseLvl = (uint8_t)(rec->u16B & 0xFFu);
          uint8_t arg2 = (uint8_t)((rec->u16B >> 8) & 0xFFu);

          write_u32(s_unit, 0x00, uType);
          write_u32(s_unit, 0x04, cClass);
          write_u32(s_unit, 0x0C, rec->u32A);
          pCreateStatListEx(s_unit, 0u, NULL, s_game);
          if ((rec->u32B & 7u) != 0u) {
            pSetUnitStat(s_unit, 0x7F, (int32_t)(rec->u32B & 7u), 0); /* STAT_ALLSKILLS */
          }
          if (skId < nSkillsCount) {
            write_u32(s_skill_node, 0x00, (uint32_t)(uintptr_t)(pSkillsTxt + (uint32_t)skId * 0x23Cu));
            write_u32(s_skill_node, 0x28, baseLvl);
            write_u32(s_skill_node, 0x2C, rec->u16C & 0x0Fu);
            write_u32(s_skill_node, 0x34, itemOwned ? 123u : 0xFFFFFFFFu);
            write_u32(s_skill_list, 0x04, (uint32_t)(uintptr_t)s_skill_node);
            write_u32(s_unit, 0xA8, (uint32_t)(uintptr_t)s_skill_list);
          }
          call_D2Game_Send21(s_client, s_unit, skId, baseLvl, arg2);
          break;
        }
        case 20: {
          uint32_t uType = (rec->flags >> 2) & 1u;
          uint32_t regUnit = (rec->flags >> 3) & 1u;
          uint32_t morph = (rec->flags >> 4) & 1u;
          if (regUnit) {
            write_u32(s_unit, 0x00, uType);
            write_u32(s_unit, 0x0C, rec->u32A);
            pCreateStatListEx(s_unit, 0u, NULL, s_game);
            if (morph) {
              pToggleGfxStateFlag(s_unit, 7, 1); /* STATE_MORPH = 7 */
            }
            call_D2Game_InsertServerUnit(s_game, s_unit);
          }
          call_D2Game_Send22(s_client, uType, rec->u32A, rec->u16A, rec->u16B & 0xFFu);
          break;
        }
        case 21: {
          uint32_t uType = (rec->flags >> 2) & 3u;
          uint32_t nHand = (rec->flags >> 4) & 3u;
          call_D2Game_Send23(uType, rec->u32A, s_client, nHand, rec->u16A, rec->u32B);
          break;
        }
        case 22: {
          uint32_t subMode = (rec->flags >> 2) & 7u;
          if (subMode == 0u) {
            call_D2Game_SendA3(
                rec->u16A & 3u, rec->u16B, s_client, rec->u16C,
                (rec->u16A >> 2) & 3u, rec->u32A, (rec->u16A >> 8) & 0xFFu,
                rec->u32B, (rec->u32A ^ 0x1234u) & 0x7FFFu, (rec->u32B ^ 0x5678u) & 0x7FFFu);
          } else if (subMode == 1u) {
            call_D2Game_SendAB(rec->u16A & 3u, rec->u32A, s_client, rec->u16B & 0xFFu);
          } else if (subMode == 2u) {
            uint32_t nPkts = rec->u16A;
            for (uint32_t p = 0; p < nPkts; p++) {
              uint32_t g1 = rec->u32A + p * 0x9E3779B9u;
              uint32_t g2 = rec->u32B ^ (p * 0x85EBCA6Bu);
              call_D2Game_SendA3(
                  p & 3u, (uint16_t)(10u + p * 7u), s_client, (uint16_t)(1u + (p % 20u)),
                  (p + 1u) & 3u, g1, (uint8_t)(0x5Au ^ (p * 19u)),
                  g2, (g1 >> 5) ^ (p * 331u), (g2 >> 3) ^ (p * 733u));
            }
          } else if (subMode == 3u) {
            /* Direct Queue 0 0xAF compression-negotiation raw bypass */
            rawBuf[0] = 0xAFu;
            rawBuf[1] = (uint8_t)(rec->u16A & 0xFFu);
            rawLen = 2u;
            isDirectNetSend = 1;
          } else {
            /* Direct Queue 2 raw bypass */
            call_D2Game_Send6D(s_client, rec->u32A, rec->u16B, rec->u16C, rec->u16A & 0xFFu);
            uint8_t *pHead = *(uint8_t **)(s_client + 0x1B8);
            rawLen = read_u32(pHead, 0x00);
            memcpy(rawBuf, pHead + 0x04, rawLen);
            isDirectNetSend = 1;
          }
          break;
        }
        default:
          return 9;
      }

      uint32_t netRet = 0u;
      if (!isDirectNetSend) {
        uint8_t *pHead = *(uint8_t **)(s_client + 0x1B8);
        if (!pHead || read_u32(pHead, 0x00) == 0u || read_u32(pHead, 0x204) != 0u) {
          fprintf(stderr, "[s2c-emitter] unexpected queue state at idx=%u op=%u\n", recIdx, op);
          return 10;
        }
        rawLen = read_u32(pHead, 0x00);
        memcpy(rawBuf, pHead + 0x04, rawLen);
        call_D2Game_FlushClientQueue(s_client, s_game, 0);
        netRet = g_wire_len;
      } else {
        netRet = fnNetSendPacket(nQueue, 1u, rawBuf, rawLen);
      }

      if (g_wire_calls != 1u || g_wire_len == 0u || netRet != g_wire_len) {
        fprintf(stderr, "[s2c-emitter] wire capture mismatch at idx=%u op=%u calls=%u len=%u ret=%u\n",
                recIdx, op, g_wire_calls, g_wire_len, netRet);
        return 11;
      }

      /* Verify Fog.#10224 decompression roundtrip on compressed frames */
      uint8_t decompBuf[516];
      memset(decompBuf, 0, sizeof(decompBuf));
      uint32_t decompLen = 0u;
      int isRawBypass = ((nQueue == 0u && rawBuf[0] == 0xAFu) || nQueue == 2u);
      if (isRawBypass) {
        if (g_wire_len != rawLen || memcmp(g_wire_buf, rawBuf, rawLen) != 0) {
          fprintf(stderr, "[s2c-emitter] raw bypass mismatch at idx=%u\n", recIdx);
          return 12;
        }
        decompLen = g_wire_len;
      } else {
        uint32_t hdrBytes = (g_wire_buf[0] < 0xF0u) ? 1u : 2u;
        uint32_t expectedFramed = (hdrBytes == 1u)
                                      ? (uint32_t)g_wire_buf[0]
                                      : ((((uint32_t)(g_wire_buf[0] & 0x0Fu) << 8) | g_wire_buf[1]));
        if (expectedFramed != g_wire_len) {
          fprintf(stderr, "[s2c-emitter] frame header mismatch at idx=%u exp=%u got=%u\n",
                  recIdx, expectedFramed, g_wire_len);
          return 13;
        }
        decompLen = fnDecompress(decompBuf, rawLen, g_wire_buf + hdrBytes, g_wire_len - hdrBytes);
        if (decompLen != rawLen || memcmp(decompBuf, rawBuf, rawLen) != 0) {
          fprintf(stderr, "[s2c-emitter] Fog.#10224 roundtrip mismatch at idx=%u op=%u decomp=%u raw=%u\n",
                  recIdx, op, decompLen, rawLen);
          return 14;
        }
      }

      /* Walk S2C packet boundaries across rawBuf via D2Net.#10033 */
      uint16_t firstPktSize = 0xFFFFu;
      uint8_t pktCount = 0u;
      uint32_t curOff = 0u;
      while (curOff < rawLen) {
        int32_t outSz = 0;
        int32_t ok = fnGetS2CSize(rawBuf + curOff, rawLen - curOff, &outSz);
        if (!ok || outSz <= 0 || curOff + (uint32_t)outSz > rawLen) {
          if (curOff == 0u) firstPktSize = 0xFFFFu;
          break;
        }
        if (pktCount == 0u) firstPktSize = (uint16_t)outSz;
        pktCount++;
        curOff += (uint32_t)outSz;
      }
      if (!isRawBypass && curOff != rawLen) {
        fprintf(stderr, "[s2c-emitter] D2Net.#10033 stream walk incomplete at idx=%u op=%u (%u/%u) opc=0x%02x\n",
                recIdx, op, curOff, rawLen, rawBuf[0]);
        return 15;
      }

      /* Populate 48-byte output section */
      rec->rawLen        = (uint16_t)rawLen;
      rec->framedLen     = (uint16_t)g_wire_len;
      rec->decompLen     = (uint16_t)decompLen;
      rec->firstPktSize  = firstPktSize;
      rec->pktCount      = pktCount;
      rec->wireHdr0      = g_wire_buf[0];
      rec->wireHdr1      = (g_wire_len >= 2u) ? g_wire_buf[1] : 0u;
      rec->firstOpcode   = rawBuf[0];
      rec->rawFnv1a32    = fnv1a32(rawBuf, rawLen);
      rec->rawMix32      = mix32_bytes(rawBuf, rawLen);
      rec->framedFnv1a32 = fnv1a32(g_wire_buf, g_wire_len);
      rec->framedMix32   = mix32_bytes(g_wire_buf, g_wire_len);
      memset(rec->rawPrefix, 0, sizeof(rec->rawPrefix));
      memcpy(rec->rawPrefix, rawBuf, rawLen < 12u ? rawLen : 12u);
      memset(rec->framedPrefix, 0, sizeof(rec->framedPrefix));
      memcpy(rec->framedPrefix, g_wire_buf, g_wire_len < 8u ? g_wire_len : 8u);
    }
  }

  if (recIdx != S2C_COUNT) {
    fprintf(stderr, "[s2c-emitter] expected %u records, generated %u\n", S2C_COUNT, recIdx);
    free(records);
    return 16;
  }

  D2TVHeader hdr;
  d2tv_init_header(&hdr, "S2C", sizeof(S2CVectorRecord), S2C_COUNT, S2C_SEED);

  FILE *fp = fopen(outPath, "wb");
  if (!fp) {
    fprintf(stderr, "[s2c-emitter] failed to open %s\n", outPath);
    free(records);
    return 17;
  }
  fwrite(&hdr, sizeof(hdr), 1, fp);
  fwrite(records, sizeof(S2CVectorRecord), S2C_COUNT, fp);
  fclose(fp);

  fprintf(stderr, "[s2c-emitter] wrote %u S2C records (%u bytes each) to %s\n",
          (unsigned)S2C_COUNT, (unsigned)sizeof(S2CVectorRecord), outPath);
  free(records);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
