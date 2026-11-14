#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "vector-format.h"

#define ARENA_BASE      0x20000000u
#define ARENA_SIZE      0x04000000u /* 64 MiB for DATATBLS */
#define ARENA_PAGES     (ARENA_SIZE >> 12)
#define D2COM_PREF_BASE 0x6FD50000u

#pragma pack(push, 1)
typedef struct {
  uint32_t va;
  uint8_t  data[4096];
} PageImageRecord;
#pragma pack(pop)

static uint8_t *g_arena = NULL;
static uint32_t g_cursor = 0;
static uint32_t g_datatbls_pages = 0;
static uint8_t  g_touched_arena[ARENA_PAGES];
static uint8_t  g_touched_d2com[256];
static uintptr_t g_d2com_base = 0;
static uint32_t  g_d2com_size = 0;
static volatile LONG g_in_datatbls = 0;
static volatile LONG g_trace_active = 0;

typedef void *(__fastcall *Fog10042_t)(uint32_t, const char *, int, int);
typedef int   (__fastcall *Fog10043_t)(void *, const char *, int, int);
typedef void *(__fastcall *Fog10045_t)(void *, uint32_t, const char *, int, int);
typedef int   (__fastcall *Fog10046_t)(void *, void *, const char *, int, int);
typedef void *(__fastcall *Fog10047_t)(void *, void *, uint32_t, const char *, int, int);

static Fog10042_t orig_10042;
static Fog10043_t orig_10043;
static Fog10045_t orig_10045;
static Fog10046_t orig_10046;
static Fog10047_t orig_10047;

static void *arena_alloc(uint32_t sz) {
  uint32_t realSz = sz ? sz : 4u;
  uint32_t aligned = (g_cursor + 16u + 15u) & ~15u;
  if (aligned + realSz + 16u > ARENA_SIZE) {
    TerminateProcess(GetCurrentProcess(), 5);
  }
  uint8_t *p = g_arena + aligned;
  *(uint32_t *)(p - 8) = 0xCAFEBABEu;
  *(uint32_t *)(p - 4) = realSz;
  memset(p, 0, realSz);
  g_cursor = aligned + realSz;
  return p;
}

static int in_arena(void *p) {
  uintptr_t a = (uintptr_t)p;
  return a >= ARENA_BASE && a < ARENA_BASE + ARENA_SIZE;
}

static void *__fastcall hk_fog_10042(uint32_t sz, const char *f, int l, int z) {
  if (g_in_datatbls) return arena_alloc(sz);
  return orig_10042(sz, f, l, z);
}
static int __fastcall hk_fog_10043(void *p, const char *f, int l, int z) {
  if (!p || in_arena(p)) return 1;
  return orig_10043(p, f, l, z);
}
static void *__fastcall hk_fog_10045(void *pool, uint32_t sz, const char *f, int l, int z) {
  if (g_in_datatbls) return arena_alloc(sz);
  return orig_10045(pool, sz, f, l, z);
}
static int __fastcall hk_fog_10046(void *pool, void *p, const char *f, int l, int z) {
  if (!p || in_arena(p)) return 1;
  return orig_10046(pool, p, f, l, z);
}
static void *__fastcall hk_fog_10047(void *pool, void *p, uint32_t sz, const char *f, int l, int z) {
  if (g_in_datatbls) {
    if (!p) return arena_alloc(sz);
    if (sz == 0) return NULL;
    uint32_t oldSz = *(uint32_t *)((uint8_t *)p - 4);
    void *np = arena_alloc(sz);
    memcpy(np, p, oldSz < sz ? oldSz : sz);
    return np;
  }
  return orig_10047(pool, p, sz, f, l, z);
}

static DWORD WINAPI stub_GetTickCount(void) { return 0x00010000u; }

static void hook_iat_entry(HMODULE mod, void *origFn, void *newFn) {
  uint8_t *base = (uint8_t *)mod;
  IMAGE_DOS_HEADER *dos = (IMAGE_DOS_HEADER *)base;
  IMAGE_NT_HEADERS32 *nt = (IMAGE_NT_HEADERS32 *)(base + dos->e_lfanew);
  DWORD impRva = nt->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_IMPORT].VirtualAddress;
  if (!impRva) return;
  IMAGE_IMPORT_DESCRIPTOR *imp = (IMAGE_IMPORT_DESCRIPTOR *)(base + impRva);
  for (; imp->Name; imp++) {
    IMAGE_THUNK_DATA32 *thunk = (IMAGE_THUNK_DATA32 *)(base + imp->FirstThunk);
    for (; thunk->u1.Function; thunk++) {
      if ((void *)(uintptr_t)thunk->u1.Function == origFn) {
        DWORD oldProt = 0;
        VirtualProtect(&thunk->u1.Function, 4, PAGE_READWRITE, &oldProt);
        thunk->u1.Function = (DWORD)(uintptr_t)newFn;
        VirtualProtect(&thunk->u1.Function, 4, oldProt, &oldProt);
      }
    }
  }
}

static LONG CALLBACK trace_veh(EXCEPTION_POINTERS *ep) {
  if (!g_trace_active) return EXCEPTION_CONTINUE_SEARCH;
  if (ep->ExceptionRecord->ExceptionCode == EXCEPTION_ACCESS_VIOLATION &&
      ep->ExceptionRecord->NumberParameters >= 2) {
    uintptr_t av = (uintptr_t)ep->ExceptionRecord->ExceptionInformation[1];
    uintptr_t page = av & ~0xFFFu;
    if (page >= ARENA_BASE && page < ARENA_BASE + (g_datatbls_pages << 12)) {
      DWORD old = 0;
      VirtualProtect((void *)page, 4096, PAGE_READWRITE, &old);
      g_touched_arena[(page - ARENA_BASE) >> 12] = 1;
      return EXCEPTION_CONTINUE_EXECUTION;
    }
    if (page >= g_d2com_base && page < g_d2com_base + g_d2com_size) {
      DWORD old = 0;
      VirtualProtect((void *)page, 4096, PAGE_EXECUTE_READWRITE, &old);
      g_touched_d2com[(page - g_d2com_base) >> 12] = 1;
      return EXCEPTION_CONTINUE_EXECUTION;
    }
  }
  return EXCEPTION_CONTINUE_SEARCH;
}

typedef void(__fastcall *Fog_InitLogPrefix_t)(const char *);
typedef void(__fastcall *Fog_InitFileSystem_t)(int, void *);
typedef void(__fastcall *Fog_InitSystem_t)(int, void *);
typedef void(__stdcall *Fog_VoidStd_t)(void);
typedef int(__stdcall *Fog_IsExpansion_t)(void);
typedef BOOL(__stdcall *SFileOpenArchive_t)(const char *, DWORD, DWORD, HANDLE *);
typedef BOOL(__stdcall *SMemFree_t)(void *, const char *, int, DWORD);
typedef int(__fastcall *D2Lang_Init_t)(int, const char *, int);
typedef int(__stdcall *InitTables_t)(int, int, int);
typedef void *(__stdcall *LoadAct_t)(uint32_t, uint32_t, uint32_t, void *, uint32_t, void *, uint32_t, void *, void *);
typedef void(__stdcall *UnloadAct_t)(void *);
typedef uint8_t *(__fastcall *AllocLevel_t)(void *, int);
typedef void(__stdcall *InitLevel_t)(void *);

static uint8_t *call_activate_roomex(uintptr_t fnActivate, uint8_t *pRoomEx) {
  uint8_t *activeRoom = NULL;
  __asm__ volatile("call *%[fn]" : "=a"(activeRoom) : "a"(pRoomEx), [fn] "r"(fnActivate) : "ecx", "edx", "memory", "cc");
  return activeRoom;
}

int main(int argc, char **argv) {
  const char *outPath = argc > 1 ? argv[1] : "drlg-datatbls-113c.img";
  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX);
  g_arena = (uint8_t *)VirtualAlloc((void *)ARENA_BASE, ARENA_SIZE, MEM_RESERVE | MEM_COMMIT, PAGE_READWRITE);
  if ((uintptr_t)g_arena != ARENA_BASE) return 2;

  HMODULE hStorm = LoadLibraryA("Storm.dll");
  HMODULE hFog   = LoadLibraryA("Fog.dll");
  HMODULE hLang  = LoadLibraryA("D2Lang.dll");
  HMODULE hCom   = LoadLibraryA("D2Common.dll");
  HMODULE hK32   = GetModuleHandleA("kernel32.dll");
  if (!hStorm || !hFog || !hLang || !hCom || !hK32) return 3;
  if ((uintptr_t)hCom != D2COM_PREF_BASE) return 3;

  IMAGE_NT_HEADERS32 *ntCom = (IMAGE_NT_HEADERS32 *)((uint8_t *)hCom + ((IMAGE_DOS_HEADER *)hCom)->e_lfanew);
  g_d2com_base = (uintptr_t)hCom;
  g_d2com_size = ntCom->OptionalHeader.SizeOfImage;
  *(uint32_t *)((uint8_t *)hCom - D2COM_PREF_BASE + 0x6FDE9950u) = 0xBB40E64Eu;

  orig_10042 = (Fog10042_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10042));
  orig_10043 = (Fog10043_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10043));
  orig_10045 = (Fog10045_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10045));
  orig_10046 = (Fog10046_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10046));
  orig_10047 = (Fog10047_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10047));

  hook_iat_entry(hCom, (void *)orig_10042, (void *)hk_fog_10042);
  hook_iat_entry(hCom, (void *)orig_10043, (void *)hk_fog_10043);
  hook_iat_entry(hCom, (void *)orig_10045, (void *)hk_fog_10045);
  hook_iat_entry(hCom, (void *)orig_10046, (void *)hk_fog_10046);
  hook_iat_entry(hCom, (void *)orig_10047, (void *)hk_fog_10047);
  hook_iat_entry(hCom, (void *)GetProcAddress(hK32, "GetTickCount"), (void *)stub_GetTickCount);

  SMemFree_t pFree = (SMemFree_t)(void (*)(void))GetProcAddress(hStorm, MAKEINTRESOURCEA(403));
  SFileOpenArchive_t pOpen = (SFileOpenArchive_t)(void (*)(void))GetProcAddress(hStorm, MAKEINTRESOURCEA(266));
  {
    IMAGE_DOS_HEADER *dos = (IMAGE_DOS_HEADER *)hStorm;
    IMAGE_NT_HEADERS32 *nt = (IMAGE_NT_HEADERS32 *)((uint8_t *)hStorm + dos->e_lfanew);
    uintptr_t rb = (uintptr_t)hStorm - nt->OptionalHeader.ImageBase;
    void **pp = (void **)(0x6FC43120u + rb);
    if (*pp) { pFree(*pp, "p", 1, 0); *pp = NULL; }
  }
  ((Fog_InitLogPrefix_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10021)))("D2");
  ((Fog_InitFileSystem_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10101)))(0, NULL);
  ((Fog_InitSystem_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10089)))(1, NULL);
  ((Fog_VoidStd_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10082)))();
  ((Fog_VoidStd_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10218)))();

  static const char *const kMpqs[6] = {
    "d2data.mpq", "d2char.mpq", "d2sfx.mpq", "d2speech.mpq", "d2exp.mpq", "Patch_D2.mpq"
  };
  static const DWORD kPrio[6] = {1000, 1000, 1000, 1000, 3000, 5000};
  for (int i = 0; i < 6; i++) {
    HANDLE h = 0;
    if (!pOpen(kMpqs[i], kPrio[i], 0, &h)) pOpen(kMpqs[i], kPrio[i], 2, &h);
  }
  int isExp = ((Fog_IsExpansion_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10227)))();
  ((D2Lang_Init_t)(void (*)(void))GetProcAddress(hLang, MAKEINTRESOURCEA(10008)))(0, NULL, isExp);

  g_in_datatbls = 1;
  if (!((InitTables_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10943)))(0, 0, 0)) return 4;
  g_in_datatbls = 0;

  uint32_t datatblsEnd = (g_cursor + 0xFFFu) & ~0xFFFu;
  g_datatbls_pages = datatblsEnd >> 12;

  uint8_t *snapArena = (uint8_t *)malloc(datatblsEnd);
  uint32_t d2comDataOff = 0x89000u;
  uint32_t d2comDataLen = g_d2com_size - d2comDataOff;
  uint8_t *snapD2Com = (uint8_t *)malloc(d2comDataLen);
  memcpy(snapArena, g_arena, datatblsEnd);
  memcpy(snapD2Com, (uint8_t *)hCom + d2comDataOff, d2comDataLen);

  AddVectoredExceptionHandler(1, trace_veh);
  DWORD oldProt = 0;
  VirtualProtect(g_arena, datatblsEnd, PAGE_NOACCESS, &oldProt);
  VirtualProtect((uint8_t *)hCom + d2comDataOff, d2comDataLen, PAGE_NOACCESS, &oldProt);
  g_trace_active = 1;

  LoadAct_t LoadAct       = (LoadAct_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10951));
  UnloadAct_t UnloadAct   = (UnloadAct_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10868));
  AllocLevel_t AllocLevel = (AllocLevel_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10207));
  InitLevel_t InitLevel   = (InitLevel_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10322));
  uintptr_t fnActivate    = (uintptr_t)hCom - D2COM_PREF_BASE + 0x6FDCC270u;
  void *pGame = VirtualAlloc(NULL, 0x2000, MEM_RESERVE | MEM_COMMIT, PAGE_NOACCESS);

  static const uint32_t kSeeds[4] = {12345u, 0u, 1u, 0xDEADBEEFu};
  static const int kActLo[5] = {1, 40, 75, 103, 109};
  static const int kActHi[5] = {39, 74, 102, 108, 136};

  for (int si = 0; si < 4; si++) {
    for (uint8_t diff = 0; diff < 3; diff++) {
      for (uint8_t act = 0; act < 5; act++) {
        uint8_t *pAct = (uint8_t *)LoadAct(act, kSeeds[si], 0, pGame, diff, NULL, (uint32_t)kActLo[act], NULL, NULL);
        uint8_t *pDrlg = *(uint8_t **)(pAct + 0x48);
        uint8_t *levels[137] = {0};
        for (int L = kActLo[act]; L <= kActHi[act]; L++) {
          uint8_t *pLevel = *(uint8_t **)(pDrlg + 0x47C);
          while (pLevel && *(int32_t *)(pLevel + 0x1D0) != L) pLevel = *(uint8_t **)(pLevel + 0x1AC);
          if (!pLevel) pLevel = AllocLevel(pDrlg, L);
          if (*(uint32_t *)(pLevel + 0x10) == 0u) InitLevel(pLevel);
          levels[L] = pLevel;
        }
        if (si == 0 && diff == 0) {
          for (int L = kActLo[act]; L <= kActHi[act]; L++) {
            for (uint8_t *r = *(uint8_t **)(levels[L] + 0x10); r; r = *(uint8_t **)(r + 0x24)) {
              call_activate_roomex(fnActivate, r);
            }
          }
        }
        UnloadAct(pAct);
      }
    }
  }
  g_trace_active = 0;

  uint32_t nArenaTouched = 0, nComTouched = 0;
  for (uint32_t p = 0; p < g_datatbls_pages; p++) if (g_touched_arena[p]) nArenaTouched++;
  uint32_t nComPages = g_d2com_size >> 12;
  for (uint32_t p = (d2comDataOff >> 12); p < nComPages; p++) if (g_touched_d2com[p]) nComTouched++;

  uint32_t totalPages = nArenaTouched + nComTouched;
  PageImageRecord *out = (PageImageRecord *)calloc(totalPages, sizeof(PageImageRecord));
  uint32_t idx = 0;
  for (uint32_t p = 0; p < g_datatbls_pages; p++) {
    if (!g_touched_arena[p]) continue;
    out[idx].va = ARENA_BASE + (p << 12);
    memcpy(out[idx].data, snapArena + (p << 12), 4096);
    idx++;
  }
  for (uint32_t p = (d2comDataOff >> 12); p < nComPages; p++) {
    if (!g_touched_d2com[p]) continue;
    out[idx].va = D2COM_PREF_BASE + (p << 12);
    memcpy(out[idx].data, snapD2Com + ((p << 12) - d2comDataOff), 4096);
    idx++;
  }

  FILE *fp = fopen(outPath, "wb");
  if (!fp) return 6;
  D2TVHeader hdr;
  d2tv_init_header(&hdr, "PAGEIMG", sizeof(PageImageRecord), totalPages, 12345ULL);
  hdr.flags = 1u;
  fwrite(&hdr, sizeof(hdr), 1, fp);
  fwrite(out, sizeof(PageImageRecord), totalPages, fp);
  fclose(fp);
  printf("[emit-datatbls] Done: datatblsEnd=0x%x (%u pages), touched=%u arena + %u d2com = %u pages\n",
         datatblsEnd, g_datatbls_pages, nArenaTouched, nComTouched, totalPages);
  fflush(stdout);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
