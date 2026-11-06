/*
 * d2host-113c.c — Headless Original Diablo II 1.13c Server Host.
 *
 * Implements Plan §3.6.1 and Gitea Milestone 31 [K0]:
 *   1. Loads ONLY core server DLLs: Storm.dll, Fog.dll, D2Lang.dll,
 *      D2Common.dll, D2Net.dll, D2Game.dll (zero D2Win / D2Gfx / D2Client /
 *      D2Sound / D2CMP / GUI window).
 *   2. Initializes Fog, mounts MPQ archives in canonical priority order
 *      (d2data/d2sfx/d2speech/d2char=1000, d2exp=3000, patch_d2=5000),
 *      initializes D2Lang (ENG) and D2Common.#10943 data tables.
 *   3. Constructs the Storm TSHashTable<D2GameStrc> container passed to
 *      D2Game.#10037 (0x6FC4A370 -> [0x6FD31C24]), initializes D2Net in
 *      in-memory local loopback mode (protocol=1, zero TCP sockets), calls
 *      D2Game.#10038 (0x6FC4D4B0) and D2Game.#10017(seed) (0x6FC4A210).
 *   4. Optionally loads d2oracle.dll in synchronous headless mode
 *      (ORACLE_HEADLESS=1 -> d2oracle_headless_init), reusing 100% of
 *      trace.ndjson / fnrec / orderlog / memdump / setexp / equip / inputs.
 *   5. Drives exact SP handshake over D2Net.#10024:
 *        - C2S 0x67 (CS_CREATEGAME, 46 bytes) -> D2Game.#10040()
 *        - Frame 1 via D2Game.#10008(1) + D2Game.#10024(1, 0) (pre-join tick)
 *        - C2S 0x6B (CS_ENTER_GAME, 1 byte)  -> D2Game.#10040() (spawns player)
 *        - Frames 2..N via D2Game.#10040() + D2Game.#10008(1) + D2Game.#10024(1, 0)
 *          at full CPU speed with zero 25 fps Sleep throttle.
 *
 * Usage:
 *   d2host-113c.exe --seed <N> --frames <N> [--difficulty 0|1|2]
 *                   [--char <Name>] [--save <path.d2s>] [--oracle-dll <dll>]
 *                   [--dump-isc <out.bin>] [--dump-layout <out.ndjson>]
 *                   [--test-huffman <out.ndjson>]
 */

#include <windows.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* ------------------------------- Fog / Storm / D2Lang / D2Common typedefs */

typedef void(__fastcall *Fog_InitLogPrefix_t)(const char *szPrefix);
typedef void(__fastcall *Fog_InitSystemInfo_t)(const char *szApp,
                                               void *pHandler,
                                               const char *szVer,
                                               int bLog);
typedef void(__fastcall *Fog_InitFileSystem_t)(int bDirectTxt, void *pCallback);
typedef void(__fastcall *Fog_InitSystem_t)(int bEnable, void *pUnused);
typedef void(__stdcall *Fog_VoidStd_t)(void);
typedef int(__stdcall *Fog_IsExpansion_t)(void);
typedef int(__fastcall *Fog_OpenFile_t)(const char *szPath, HANDLE *phFile);
typedef void(__fastcall *Fog_CloseFile_t)(HANDLE hFile);

typedef BOOL(__stdcall *Storm_SFileOpenArchive_t)(const char *szMpqName,
                                                  DWORD dwPriority,
                                                  DWORD dwFlags,
                                                  HANDLE *phMpq);
typedef void *(__stdcall *Storm_SMemAlloc_t)(DWORD dwAmount,
                                             const char *szFilename,
                                             int nLine,
                                             DWORD dwFlags);
typedef BOOL(__stdcall *Storm_SMemFree_t)(void *pPtr,
                                          const char *szFilename,
                                          int nLine,
                                          DWORD dwFlags);

typedef int(__fastcall *D2Lang_Init_t)(int bUnusedEcx,
                                       const char *szLocaleEdx,
                                       int bUnusedStack);
typedef int(__stdcall *D2Common_InitDataTables_t)(int nUnused,
                                                  int bUnused2,
                                                  int bCompileTxt);
typedef const uint8_t *(__stdcall *D2Common_GetRoomFromUnit_t)(const void *pUnit);
typedef void(__stdcall *D2Common_GetRoomCoords_t)(const void *pRoom, int32_t *pCoords);
typedef int32_t(__stdcall *D2Common_GetLevelIdFromRoom_t)(const void *pRoom);
typedef uint8_t(__stdcall *D2Common_GetActFromRoom_t)(const void *pRoom);

typedef void *(__fastcall *Fog_AllocClientMemory_t)(uint32_t dwSize,
                                                    const char *szFile,
                                                    int nLine,
                                                    int nZero);
typedef void *(__fastcall *Fog_AllocServerMemory_t)(void *pMemPool,
                                                    uint32_t dwSize,
                                                    const char *szFile,
                                                    int nLine,
                                                    int nZero);
typedef int(__fastcall *Fog_CreatePacket_t)(uint8_t *pDst,
                                            int nDstCap,
                                            const uint8_t *pSrc,
                                            int nSrcLen);
typedef int(__fastcall *Fog_DecompressPacket_t)(uint8_t *pDst,
                                                int nDstCap,
                                                const uint8_t *pSrc,
                                                int nSrcLen);

/* ----------------------------------------------------- D2Net / D2Game APIs */

typedef int(__stdcall *D2Net_InitServer_t)(int nProtocol, int nMaxClients);
typedef int(__stdcall *D2Net_SendToClient_t)(int nQueue,
                                             int nClientId,
                                             const void *pBuf,
                                             int nLen);
typedef int(__stdcall *D2Net_ConnectClient_t)(int nProtocol, const char *szAddr);
typedef int(__stdcall *D2Net_GetConnStatus_t)(void);
typedef int(__stdcall *D2Net_SetAccept_t)(int bAccept);
typedef int(__stdcall *D2Net_SendToServer_t)(int nLen, int nQueue, const void *pBuf);
typedef int(__stdcall *D2Net_RecvFromServer_t)(void *pBuf, int nMaxLen);
typedef void(__stdcall *D2Net_Shutdown_t)(void);

typedef void(__stdcall *D2Game_SetGameHash_t)(void *pHashTable, void *pCallbackDummy);
typedef int(__stdcall *D2Game_InitGameData_t)(void);
typedef void(__stdcall *D2Game_SetInitSeed_t)(uint32_t dwSeed);
typedef void(__stdcall *D2Game_ReceivePackets_t)(void);
typedef int(__stdcall *D2Game_UpdateGames_t)(int bFlag);
typedef int(__stdcall *D2Game_SendUpdates_t)(int bForce, int bUnused);

typedef void(__cdecl *OracleHeadlessInit_t)(void);
typedef int(__cdecl *OracleIsDone_t)(void);

/* ------------------------ Storm TSHashTable<D2GameStrc> (0x68 bytes exact) */

typedef struct {
  int32_t linkOffset;
  uint32_t prev;
  uint32_t next;
} TSExplicitList;

typedef struct {
  void **vtable;               /* +0x00 */
  TSExplicitList fullList;     /* +0x04 (linkOffset = 0x0C) */
  uint32_t collisionCount;     /* +0x10 */
  uint32_t bucketCap;          /* +0x14 */
  uint32_t bucketCount;        /* +0x18 */
  TSExplicitList *buckets;     /* +0x1C */
  uint32_t bucketGrow;         /* +0x20 */
  uint32_t hashMask;           /* +0x24 (0x3FF -> 1024 buckets, never rehashes) */
  TSExplicitList freeList;     /* +0x28 (linkOffset = 0x04) */
  uint32_t growStep;           /* +0x34 */
  TSExplicitList chunkList;    /* +0x38 (linkOffset = 0x10) */
  uint32_t pad44;              /* +0x44 */
  uint32_t nextHashKey;        /* +0x48 */
  uint32_t keyWrapped;         /* +0x4C */
  CRITICAL_SECTION csLock;     /* +0x50..0x67 */
} D2GameHashTable;

static Storm_SMemAlloc_t p_SMemAlloc = NULL;
static Storm_SMemFree_t p_SMemFree = NULL;
static Fog_AllocClientMemory_t g_orig_Fog10042 = NULL;
static Fog_AllocServerMemory_t g_orig_Fog10045 = NULL;

typedef struct {
  uintptr_t ptr;
  uint32_t size;
} AllocRecord;

#define MAX_ALLOC_RECORDS 65536
static AllocRecord g_alloc_records[MAX_ALLOC_RECORDS];
static uint32_t g_alloc_record_count = 0;

static void record_alloc(const void *ptr, uint32_t size) {
  if (!ptr || size == 0) return;
  uintptr_t p = (uintptr_t)ptr;
  for (uint32_t i = g_alloc_record_count; i > 0; i--) {
    if (g_alloc_records[i - 1].ptr == p) {
      g_alloc_records[i - 1].size = size;
      return;
    }
  }
  if (g_alloc_record_count < MAX_ALLOC_RECORDS) {
    g_alloc_records[g_alloc_record_count].ptr = p;
    g_alloc_records[g_alloc_record_count].size = size;
    g_alloc_record_count++;
  }
}

static uint32_t lookup_alloc_size(const void *ptr) {
  if (!ptr) return 0;
  uintptr_t p = (uintptr_t)ptr;
  for (uint32_t i = g_alloc_record_count; i > 0; i--) {
    if (g_alloc_records[i - 1].ptr == p) {
      return g_alloc_records[i - 1].size;
    }
  }
  return 0;
}

static void *__fastcall hook_Fog10042(uint32_t dwSize,
                                      const char *szFile,
                                      int nLine,
                                      int nZero) {
  void *p = g_orig_Fog10042(dwSize, szFile, nLine, nZero);
  record_alloc(p, dwSize);
  return p;
}

static void *__fastcall hook_Fog10045(void *pMemPool,
                                      uint32_t dwSize,
                                      const char *szFile,
                                      int nLine,
                                      int nZero) {
  void *p = g_orig_Fog10045(pMemPool, dwSize, szFile, nLine, nZero);
  record_alloc(p, dwSize);
  return p;
}

static void hook_module_iat_ptr(HMODULE m, void *origFn, void *hookFn) {
  if (!m || !origFn || !hookFn) return;
  uint8_t *base = (uint8_t *)m;
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
        VirtualProtect(&thunk->u1.Function, sizeof(void *), PAGE_EXECUTE_READWRITE, &oldProt);
        thunk->u1.Function = (DWORD)(uintptr_t)hookFn;
        VirtualProtect(&thunk->u1.Function, sizeof(void *), oldProt, &oldProt);
      }
    }
  }
}

static uint8_t g_captured_wire[2048];
static int g_captured_wire_len = 0;

static int __stdcall hook_qserver_send(void *pServer,
                                       int nClientId,
                                       const uint8_t *pWire,
                                       int nWireLen) {
  (void)pServer;
  (void)nClientId;
  if (pWire && nWireLen > 0 && nWireLen <= (int)sizeof(g_captured_wire)) {
    memcpy(g_captured_wire, pWire, (size_t)nWireLen);
    g_captured_wire_len = nWireLen;
  } else {
    g_captured_wire_len = 0;
  }
  return 1;
}

static void init_explicit_list(TSExplicitList *lst, int32_t linkOffset) {
  uintptr_t headAddr = (uintptr_t)&lst->prev;
  lst->linkOffset = linkOffset;
  lst->prev = (uint32_t)headAddr;
  lst->next = ~(uint32_t)headAddr;
}

static void __stdcall game_hash_dtor_stub(void *arg) { (void)arg; }

/*
 * Matches D2Client 0x6FAB1F90 -> 0x6FAB24B0 -> 0x6FAB2400:
 * Called via [vtable + 0x04] at D2Game 0x6FC220CA as __thiscall:
 *   ecx = D2GameHashTable *this
 *   stack: (TSExplicitList *pBucket, uint32_t extraBytes, uint32_t flags)
 * Allocates sizeof(D2GameStrc) == 0x1DF4 + extraBytes via Storm.#401, zeros
 * the two TSLink headers (+0x04..+0x13), and links node+0x04 into pBucket.
 */
static void *__fastcall game_hash_alloc_node(D2GameHashTable *self,
                                             void *unusedEdx,
                                             TSExplicitList *pBucket,
                                             uint32_t extraBytes,
                                             uint32_t flags) {
  (void)self;
  (void)unusedEdx;
  uint32_t totalSize = 0x1DF4u + extraBytes;
  uint8_t *node = (uint8_t *)p_SMemAlloc(totalSize, "d2host-113c.c", 120, flags | 8u);
  if (!node) return NULL;
  memset(node, 0, totalSize);
  record_alloc(node, totalSize);

  /* Link node into pBucket at linkOffset (+0x04), matching 0x6FAB2459. */
  uintptr_t headAddr = (uintptr_t)&pBucket->prev;
  uint32_t prevPtr = pBucket->prev;
  uint32_t *prevNextField = (prevPtr == (uint32_t)headAddr)
                                ? &pBucket->next
                                : (uint32_t *)(uintptr_t)(prevPtr + (uint32_t)pBucket->linkOffset + 4u);
  *(uint32_t *)(node + 0x04) = prevPtr;
  *(uint32_t *)(node + 0x08) = *prevNextField;
  *prevNextField = (uint32_t)(uintptr_t)node;
  pBucket->prev = (uint32_t)(uintptr_t)node;
  return node;
}

static void __fastcall game_hash_scalar_dtor(D2GameHashTable *self,
                                             void *unusedEdx,
                                             uint32_t flags) {
  (void)self;
  (void)unusedEdx;
  (void)flags;
}

static void __fastcall game_hash_unlink_all(D2GameHashTable *self, void *unusedEdx) {
  (void)self;
  (void)unusedEdx;
}

static void *g_game_hash_vtable[4] = {
    (void *)game_hash_dtor_stub,
    (void *)game_hash_alloc_node,
    (void *)game_hash_scalar_dtor,
    (void *)game_hash_unlink_all,
};

static TSExplicitList g_game_hash_buckets[1024];
static D2GameHashTable g_game_hash;
static uint32_t g_client_callback_dummy[16] = {1};

static void init_game_hash_table(D2GameHashTable *tbl) {
  memset(tbl, 0, sizeof(*tbl));
  tbl->vtable = g_game_hash_vtable;
  init_explicit_list(&tbl->fullList, 0x0C);
  tbl->collisionCount = 0;
  tbl->bucketCap = 1024;
  tbl->bucketCount = 1024;
  tbl->buckets = g_game_hash_buckets;
  tbl->bucketGrow = 4;
  tbl->hashMask = 0x3FF;
  for (int i = 0; i < 1024; i++) {
    init_explicit_list(&g_game_hash_buckets[i], 0x04);
  }
  init_explicit_list(&tbl->freeList, 0x04);
  tbl->growStep = 0x10;
  init_explicit_list(&tbl->chunkList, 0x10);
  tbl->nextHashKey = (~(uint32_t)(uintptr_t)tbl) & 0x0FFFFFFFu;
  tbl->keyWrapped = 0;
  InitializeCriticalSection(&tbl->csLock);
}

/* ----------------------------------------------------------- MPQ & .d2s I/O */

static int open_mpq_if_exists(Storm_SFileOpenArchive_t fnOpen,
                              const char *exeDir,
                              const char *name,
                              DWORD priority,
                              int required) {
  char fullPath[MAX_PATH];
  snprintf(fullPath, sizeof(fullPath), "%s%s", exeDir, name);
  const char *target = fullPath;
  if (GetFileAttributesA(target) == INVALID_FILE_ATTRIBUTES) {
    target = name;
    if (GetFileAttributesA(target) == INVALID_FILE_ATTRIBUTES) {
      if (required) {
        fprintf(stderr, "[d2host-113c] missing required MPQ: %s\n", fullPath);
        return 0;
      }
      return 1;
    }
  }
  HANDLE hMpq = NULL;
  BOOL ok = fnOpen(target, priority, 0, &hMpq);
  if (!ok || !hMpq) {
    ok = fnOpen(target, priority, 2, &hMpq);
    if ((!ok || !hMpq) && required) {
      fprintf(stderr, "[d2host-113c] failed to open MPQ: %s (err=%lu)\n",
              target, (unsigned long)GetLastError());
      return 0;
    }
  }
  return 1;
}

static int read_d2s_meta(const char *path,
                         char outName[16],
                         uint8_t *outClassId,
                         uint8_t *outStatus) {
  FILE *f = fopen(path, "rb");
  if (!f) return 0;
  uint8_t hdr[48];
  size_t n = fread(hdr, 1, sizeof(hdr), f);
  fclose(f);
  if (n < 44) return 0;
  uint32_t magic = *(uint32_t *)(hdr + 0);
  if (magic != 0xAA55AA55u) return 0;
  memcpy(outName, hdr + 20, 16);
  outName[15] = '\0';
  *outStatus = hdr[0x24];
  *outClassId = hdr[0x28];
  return 1;
}

static uintptr_t pref_base(HMODULE m) {
  IMAGE_DOS_HEADER *dos = (IMAGE_DOS_HEADER *)m;
  IMAGE_NT_HEADERS32 *nt = (IMAGE_NT_HEADERS32 *)((uint8_t *)m + dos->e_lfanew);
  return nt->OptionalHeader.ImageBase;
}

static uint32_t img_size(HMODULE m) {
  IMAGE_DOS_HEADER *dos = (IMAGE_DOS_HEADER *)m;
  IMAGE_NT_HEADERS32 *nt = (IMAGE_NT_HEADERS32 *)((uint8_t *)m + dos->e_lfanew);
  return nt->OptionalHeader.SizeOfImage;
}

static HMODULE g_loaded_mods[8];
static const char *g_loaded_names[8];
static int g_loaded_count = 0;

static void record_mod(const char *name, HMODULE m) {
  if (m && g_loaded_count < 8) {
    g_loaded_names[g_loaded_count] = name;
    g_loaded_mods[g_loaded_count] = m;
    g_loaded_count++;
  }
}

static LONG WINAPI crash_filter(EXCEPTION_POINTERS *ep) {
  uintptr_t eip = (uintptr_t)ep->ExceptionRecord->ExceptionAddress;
  const char *modName = "unknown";
  uintptr_t canonVa = eip;
  for (int i = 0; i < g_loaded_count; i++) {
    uintptr_t base = (uintptr_t)g_loaded_mods[i];
    if (eip >= base && eip < base + img_size(g_loaded_mods[i])) {
      modName = g_loaded_names[i];
      canonVa = pref_base(g_loaded_mods[i]) + (eip - base);
      break;
    }
  }
  CONTEXT *c = ep->ContextRecord;
  fprintf(stderr,
          "[d2host-113c] EXCEPTION 0x%08lx at %p (%s VA 0x%08lx) "
          "EAX=%08lx ECX=%08lx EDX=%08lx EBX=%08lx ESI=%08lx EDI=%08lx ESP=%08lx EBP=%08lx\n",
          (unsigned long)ep->ExceptionRecord->ExceptionCode,
          (void *)eip, modName, (unsigned long)canonVa,
          (unsigned long)c->Eax, (unsigned long)c->Ecx, (unsigned long)c->Edx,
          (unsigned long)c->Ebx, (unsigned long)c->Esi, (unsigned long)c->Edi,
          (unsigned long)c->Esp, (unsigned long)c->Ebp);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 99);
  return EXCEPTION_EXECUTE_HANDLER;
}

static void write_json_hex_block(FILE *f,
                                 const char *name,
                                 const void *ptr,
                                 size_t len,
                                 int *first) {
  if (!ptr || len == 0) return;
  if (!*first) fprintf(f, ",");
  *first = 0;
  fprintf(f, "{\"n\":\"%s\",\"a\":%u,\"h\":\"", name, (uint32_t)(uintptr_t)ptr);
  const uint8_t *b = (const uint8_t *)ptr;
  for (size_t i = 0; i < len; i++) {
    fprintf(f, "%02x", b[i]);
  }
  fprintf(f, "\"}");
}

/* --------------------------------------------------------------------- main */

int main(int argc, char **argv) {
  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  SetUnhandledExceptionFilter(crash_filter);
  uint32_t seed = 12345;
  uint32_t maxFrames = 0;
  uint8_t difficulty = 0;
  char charName[16] = "Oracle";
  const char *savePathArg = NULL;
  const char *oracleDllPath = NULL;
  const char *dumpIscPath = NULL;
  const char *dumpLayoutPath = NULL;
  const char *testHuffmanPath = NULL;

  for (int i = 1; i < argc; i++) {
    if (!strcmp(argv[i], "--seed") && i + 1 < argc) {
      seed = (uint32_t)strtoul(argv[++i], NULL, 0);
    } else if (!strcmp(argv[i], "--frames") && i + 1 < argc) {
      maxFrames = (uint32_t)strtoul(argv[++i], NULL, 0);
    } else if (!strcmp(argv[i], "--difficulty") && i + 1 < argc) {
      difficulty = (uint8_t)strtoul(argv[++i], NULL, 0);
    } else if (!strcmp(argv[i], "--char") && i + 1 < argc) {
      strncpy(charName, argv[++i], 15);
      charName[15] = '\0';
    } else if (!strcmp(argv[i], "--save") && i + 1 < argc) {
      savePathArg = argv[++i];
    } else if (!strcmp(argv[i], "--oracle-dll") && i + 1 < argc) {
      oracleDllPath = argv[++i];
    } else if (!strcmp(argv[i], "--dump-isc") && i + 1 < argc) {
      dumpIscPath = argv[++i];
    } else if (!strcmp(argv[i], "--dump-layout") && i + 1 < argc) {
      dumpLayoutPath = argv[++i];
    } else if (!strcmp(argv[i], "--test-huffman") && i + 1 < argc) {
      testHuffmanPath = argv[++i];
    }
  }

  LARGE_INTEGER qpf, t0, tInit, tEnd;
  QueryPerformanceFrequency(&qpf);
  QueryPerformanceCounter(&t0);

  /* 1. Load ONLY core server DLLs (no D2Win / D2Gfx / D2Client / D2Sound). */
  HMODULE hStorm = LoadLibraryA("Storm.dll");
  HMODULE hFog = LoadLibraryA("Fog.dll");
  HMODULE hD2Lang = LoadLibraryA("D2Lang.dll");
  HMODULE hD2Common = LoadLibraryA("D2Common.dll");
  HMODULE hD2Net = LoadLibraryA("D2Net.dll");
  HMODULE hD2Game = LoadLibraryA("D2Game.dll");

  if (!hStorm || !hFog || !hD2Lang || !hD2Common || !hD2Net || !hD2Game) {
    fprintf(stderr,
            "[d2host-113c] Failed to load server DLLs "
            "(Storm=%p Fog=%p Lang=%p Common=%p Net=%p Game=%p)\n",
            (void *)hStorm, (void *)hFog, (void *)hD2Lang,
            (void *)hD2Common, (void *)hD2Net, (void *)hD2Game);
    return 1;
  }
  record_mod("Storm.dll", hStorm);
  record_mod("Fog.dll", hFog);
  record_mod("D2Lang.dll", hD2Lang);
  record_mod("D2Common.dll", hD2Common);
  record_mod("D2Net.dll", hD2Net);
  record_mod("D2Game.dll", hD2Game);

  p_SMemAlloc = (Storm_SMemAlloc_t)(void (*)(void))GetProcAddress(
      hStorm, MAKEINTRESOURCEA(401));
  p_SMemFree = (Storm_SMemFree_t)(void (*)(void))GetProcAddress(
      hStorm, MAKEINTRESOURCEA(403));
  Storm_SFileOpenArchive_t p_SFileOpenArchive =
      (Storm_SFileOpenArchive_t)(void (*)(void))GetProcAddress(
          hStorm, MAKEINTRESOURCEA(266));

  /*
   * Storm.dll DllMain (0x6FC15CD6..0x6FC15CE3) checks lpvReserved ([esp+0xC]):
   * when Storm.dll is loaded dynamically via LoadLibraryA (lpvReserved == NULL),
   * DllMain intentionally initializes the MPQ crypt table ([0x6FC43120]) with
   * poison seed 0x10000100 instead of 0x00100001 (0x6FC1A117). Clear [0x6FC43120]
   * so SFileOpenArchive (0x6FC1A10E..0x6FC1A11C) initializes it with 0x00100001.
   */
  {
    uintptr_t stormRebase = (uintptr_t)hStorm - pref_base(hStorm);
    void **ppCryptTable = (void **)(0x6FC43120u + stormRebase);
    if (*ppCryptTable) {
      if (p_SMemFree) p_SMemFree(*ppCryptTable, "d2host-113c.c", 380, 0);
      *ppCryptTable = NULL;
    }
  }

  /* 2. Initialize Fog (matching Game.exe 0x00408291 + 0x0040761B..0x00407631). */
  Fog_InitLogPrefix_t p_FogInitLog =
      (Fog_InitLogPrefix_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10021));
  Fog_InitFileSystem_t p_FogInitFS =
      (Fog_InitFileSystem_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10101));
  Fog_InitSystem_t p_FogInitSystem =
      (Fog_InitSystem_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10089));
  Fog_VoidStd_t p_FogInitAsync =
      (Fog_VoidStd_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10082));
  Fog_VoidStd_t p_FogInitMasks =
      (Fog_VoidStd_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10218));
  Fog_IsExpansion_t p_FogIsExpansion =
      (Fog_IsExpansion_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10227));

  if (p_FogInitLog) p_FogInitLog("D2");
  if (p_FogInitFS) p_FogInitFS(0, NULL);
  if (p_FogInitSystem) p_FogInitSystem(1, NULL);
  if (p_FogInitAsync) p_FogInitAsync();
  if (p_FogInitMasks) p_FogInitMasks();
  SetUnhandledExceptionFilter(crash_filter);

  if (dumpLayoutPath && dumpLayoutPath[0]) {
    g_orig_Fog10042 = (Fog_AllocClientMemory_t)(void (*)(void))GetProcAddress(
        hFog, MAKEINTRESOURCEA(10042));
    g_orig_Fog10045 = (Fog_AllocServerMemory_t)(void (*)(void))GetProcAddress(
        hFog, MAKEINTRESOURCEA(10045));
    hook_module_iat_ptr(hD2Common, (void *)g_orig_Fog10042, (void *)hook_Fog10042);
    hook_module_iat_ptr(hD2Common, (void *)g_orig_Fog10045, (void *)hook_Fog10045);
    hook_module_iat_ptr(hD2Game, (void *)g_orig_Fog10042, (void *)hook_Fog10042);
    hook_module_iat_ptr(hD2Game, (void *)g_orig_Fog10045, (void *)hook_Fog10045);
  }

  /* Optional Fog.#10218/#10223/#10224 + D2Net.#10006 server-mode Huffman & framing oracle. */
  if (testHuffmanPath && testHuffmanPath[0]) {
    Fog_CreatePacket_t p_FogCreatePacket =
        (Fog_CreatePacket_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10223));
    Fog_DecompressPacket_t p_FogDecompressPacket =
        (Fog_DecompressPacket_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10224));
    D2Net_SendToClient_t p_NetSendToClient =
        (D2Net_SendToClient_t)(void (*)(void))GetProcAddress(hD2Net, MAKEINTRESOURCEA(10002));
    if (!p_FogCreatePacket || !p_FogDecompressPacket || !p_NetSendToClient) {
      fprintf(stderr, "[d2host-113c] missing Fog.#10223/#10224 or D2Net.#10002\n");
      return 11;
    }
    uintptr_t d2netRebase = (uintptr_t)hD2Net - pref_base(hD2Net);
    uintptr_t fogRebase = (uintptr_t)hFog - pref_base(hFog);
    /* Force D2Net server mode ([0x6FBFB418] = 0) and hook IAT slot 0x6FBF8080 (QServer_Send). */
    *(uint32_t *)(0x6FBFB418u + d2netRebase) = 0u;
    void **ppQServerSend = (void **)(0x6FBF8080u + d2netRebase);
    DWORD oldProt = 0;
    VirtualProtect(ppQServerSend, sizeof(void *), PAGE_EXECUTE_READWRITE, &oldProt);
    *ppQServerSend = (void *)hook_qserver_send;
    VirtualProtect(ppQServerSend, sizeof(void *), oldProt, &oldProt);

    FILE *fHuff = fopen(testHuffmanPath, "wb");
    if (!fHuff) {
      fprintf(stderr, "[d2host-113c] failed to open %s\n", testHuffmanPath);
      return 12;
    }
    const uint8_t *pBitLens = (const uint8_t *)(0x6FF7F210u + fogRebase);
    uint8_t sym8 = 0x04;
    for (int s = 0; s < 256; s++) {
      if (pBitLens[s] == 8 && s != 0xAF) {
        sym8 = (uint8_t)s;
        break;
      }
    }
    uint8_t rawBuf[520];
    uint8_t compBuf[1032];
    uint8_t decompBuf[1032];
    int vecIdx = 0;
    /* Total vectors:
     *   0..255:   all 256 single-byte payloads (nQueue = (b == 0xAF ? 1 : 0))
     *   256..257: raw 0xAF handshake bypass on nQueue = 0 ([0xAF, 0x01], [0xAF, 0x00])
     *   258..773: deterministic payloads of lengths 1..0x204 (516 lengths)
     *   774..777: compressedLen = 237, 238 (-> header 0xEF), 239 (-> header 0xF0 0xF1), 240
     */
    for (int step = 0; step < 778; step++) {
      int nQueue = 0;
      int rawLen = 1;
      if (step < 256) {
        rawBuf[0] = (uint8_t)step;
        rawLen = 1;
        nQueue = (step == 0xAF) ? 1 : 0;
      } else if (step == 256) {
        rawBuf[0] = 0xAF;
        rawBuf[1] = 0x01;
        rawLen = 2;
        nQueue = 0;
      } else if (step == 257) {
        rawBuf[0] = 0xAF;
        rawBuf[1] = 0x00;
        rawLen = 2;
        nQueue = 0;
      } else if (step < 258 + 0x204) {
        rawLen = (step - 258) + 1;
        nQueue = 0;
        for (int k = 0; k < rawLen; k++) {
          uint8_t v = (uint8_t)((rawLen * 37 + k * 131 + 19) & 0xFF);
          if (k == 0 && v == 0xAF) v = 0xAE;
          rawBuf[k] = v;
        }
      } else {
        int rep = 237 + (step - (258 + 0x204));
        rawLen = rep;
        nQueue = 0;
        memset(rawBuf, sym8, (size_t)rawLen);
      }

      int compLen = p_FogCreatePacket(compBuf, 0x408, rawBuf, rawLen);
      int decLen = p_FogDecompressPacket(decompBuf, rawLen, compBuf, compLen);
      if (decLen != rawLen || memcmp(decompBuf, rawBuf, (size_t)rawLen) != 0) {
        fprintf(stderr, "[d2host-113c] Fog.#10224 roundtrip mismatch at step=%d\n", step);
        fclose(fHuff);
        return 13;
      }
      g_captured_wire_len = 0;
      int ret = p_NetSendToClient(nQueue, 1, rawBuf, rawLen);
      if (ret != g_captured_wire_len || g_captured_wire_len <= 0) {
        fprintf(stderr, "[d2host-113c] D2Net.#10006 wire capture mismatch at step=%d (ret=%d len=%d)\n",
                step, ret, g_captured_wire_len);
        fclose(fHuff);
        return 14;
      }
      fprintf(fHuff, "{\"idx\":%d,\"q\":%d,\"ret\":%d,\"raw\":\"", vecIdx++, nQueue, ret);
      for (int k = 0; k < rawLen; k++) fprintf(fHuff, "%02x", rawBuf[k]);
      fprintf(fHuff, "\",\"comp\":\"");
      for (int k = 0; k < compLen; k++) fprintf(fHuff, "%02x", compBuf[k]);
      fprintf(fHuff, "\",\"wire\":\"");
      for (int k = 0; k < g_captured_wire_len; k++) fprintf(fHuff, "%02x", g_captured_wire[k]);
      fprintf(fHuff, "\"}\n");
    }
    fclose(fHuff);
    ExitProcess(0);
  }

  /* 3. Mount MPQ archives in exact priority order (D2Win.#10086 + #10005). */
  char exeDir[MAX_PATH] = {0};
  if (GetModuleFileNameA(NULL, exeDir, sizeof(exeDir))) {
    char *slash = strrchr(exeDir, '\\');
    if (slash) slash[1] = '\0';
    else exeDir[0] = '\0';
  }
  if (!open_mpq_if_exists(p_SFileOpenArchive, exeDir, "d2data.mpq", 1000, 1) ||
      !open_mpq_if_exists(p_SFileOpenArchive, exeDir, "d2char.mpq", 1000, 0) ||
      !open_mpq_if_exists(p_SFileOpenArchive, exeDir, "d2sfx.mpq", 1000, 0) ||
      !open_mpq_if_exists(p_SFileOpenArchive, exeDir, "d2speech.mpq", 1000, 0) ||
      !open_mpq_if_exists(p_SFileOpenArchive, exeDir, "d2exp.mpq", 3000, 1) ||
      !open_mpq_if_exists(p_SFileOpenArchive, exeDir, "Patch_D2.mpq", 5000, 1)) {
    return 2;
  }
  int isExp = p_FogIsExpansion ? p_FogIsExpansion() : 1;

  /* 4. Initialize D2Lang (matching D2Client 0x6FAC0CE4: ecx=0, edx=NULL, bExp) and D2Common.#10943. */
  D2Lang_Init_t p_D2LangInit =
      (D2Lang_Init_t)(void (*)(void))GetProcAddress(hD2Lang, MAKEINTRESOURCEA(10008));
  D2Common_InitDataTables_t p_InitDataTables =
      (D2Common_InitDataTables_t)(void (*)(void))GetProcAddress(
          hD2Common, MAKEINTRESOURCEA(10943));
  if (p_D2LangInit) p_D2LangInit(0, NULL, isExp);
  if (!p_InitDataTables || !p_InitDataTables(0, 0, 0)) {
    fprintf(stderr, "[d2host-113c] D2Common.#10943 failed\n");
    return 3;
  }

  /* Optional post-load D2Common ItemStatCostTxt (359 x 0x144) memory dump. */
  if (dumpIscPath && dumpIscPath[0]) {
    uintptr_t d2commonRebase = (uintptr_t)hD2Common - pref_base(hD2Common);
    const uint8_t *pIsc = *(const uint8_t **)(0x6FDF0AA4u + d2commonRebase);
    uint32_t nIsc = *(const uint32_t *)(0x6FDF0AACu + d2commonRebase);
    if (!pIsc || nIsc == 0) {
      fprintf(stderr, "[d2host-113c] pItemStatCostTxt missing (%p, n=%u)\n",
              (const void *)pIsc, nIsc);
      return 7;
    }
    FILE *fOut = fopen(dumpIscPath, "wb");
    if (!fOut) {
      fprintf(stderr, "[d2host-113c] failed to open %s\n", dumpIscPath);
      return 8;
    }
    fwrite(&nIsc, sizeof(uint32_t), 1, fOut);
    fwrite(pIsc, 0x144u, nIsc, fOut);
    fclose(fOut);
    ExitProcess(0);
  }

  /* 5. Initialize D2Net in local memory queue mode (protocol=1, maxClients=1),
   *    matching D2Client 0x6FB5FE24..0x6FB5FEF6. */
  D2Net_InitServer_t p_NetInitServer =
      (D2Net_InitServer_t)(void (*)(void))GetProcAddress(hD2Net, MAKEINTRESOURCEA(10005));
  D2Net_ConnectClient_t p_NetConnect =
      (D2Net_ConnectClient_t)(void (*)(void))GetProcAddress(hD2Net, MAKEINTRESOURCEA(10034));
  D2Net_GetConnStatus_t p_NetGetStatus =
      (D2Net_GetConnStatus_t)(void (*)(void))GetProcAddress(hD2Net, MAKEINTRESOURCEA(10019));
  D2Net_SetAccept_t p_NetSetAccept =
      (D2Net_SetAccept_t)(void (*)(void))GetProcAddress(hD2Net, MAKEINTRESOURCEA(10012));
  D2Net_SendToServer_t p_NetSend =
      (D2Net_SendToServer_t)(void (*)(void))GetProcAddress(hD2Net, MAKEINTRESOURCEA(10024));
  D2Net_RecvFromServer_t p_NetRecv =
      (D2Net_RecvFromServer_t)(void (*)(void))GetProcAddress(hD2Net, MAKEINTRESOURCEA(10020));

  p_NetInitServer(1, 1);
  p_NetConnect(1, NULL);
  if (p_NetGetStatus) {
    for (int i = 0; i < 2000 && p_NetGetStatus() != 2; i++) {
      Sleep(1);
    }
  }
  p_NetSetAccept(0);

  /* 6. Initialize D2Game hash table, game tables, and fixed seed override. */
  init_game_hash_table(&g_game_hash);
  D2Game_SetGameHash_t p_SetGameHash =
      (D2Game_SetGameHash_t)(void (*)(void))GetProcAddress(hD2Game, MAKEINTRESOURCEA(10037));
  D2Game_InitGameData_t p_InitGameData =
      (D2Game_InitGameData_t)(void (*)(void))GetProcAddress(hD2Game, MAKEINTRESOURCEA(10038));
  D2Game_SetInitSeed_t p_SetInitSeed =
      (D2Game_SetInitSeed_t)(void (*)(void))GetProcAddress(hD2Game, MAKEINTRESOURCEA(10017));
  D2Game_ReceivePackets_t p_RecvPackets =
      (D2Game_ReceivePackets_t)(void (*)(void))GetProcAddress(hD2Game, MAKEINTRESOURCEA(10040));
  D2Game_UpdateGames_t p_UpdateGames =
      (D2Game_UpdateGames_t)(void (*)(void))GetProcAddress(hD2Game, MAKEINTRESOURCEA(10008));
  D2Game_SendUpdates_t p_SendUpdates =
      (D2Game_SendUpdates_t)(void (*)(void))GetProcAddress(hD2Game, MAKEINTRESOURCEA(10024));

  p_SetGameHash(&g_game_hash, g_client_callback_dummy);
  p_InitGameData();
  p_SetInitSeed(seed);

  uintptr_t d2gameRebase = (uintptr_t)hD2Game - pref_base(hD2Game);
  /* Force deterministic 0x400 (1.0x 40ms) frame delta in D2Game.#10008 (0x6FC4E26F). */
  *(uint32_t *)(0x6FD2E35Cu + d2gameRebase) = 1u;
  volatile uint32_t *pLastTickMs = (volatile uint32_t *)(0x6FD31C44u + d2gameRebase);

  /* Accept client 1 into D2Game (0x6FC4E4AF) and drain S2C 0xAF BEFORE sending 0x67! */
  uint8_t s2cDrain[1024];
  for (int i = 0; i < 200; i++) {
    p_RecvPackets();
    int gotAf = 0;
    int nRead;
    while ((nRead = p_NetRecv(s2cDrain, sizeof(s2cDrain))) > 0) {
      if (s2cDrain[0] == 0xAF) gotAf = 1;
    }
    if (gotAf) break;
    Sleep(1);
  }

  /* 7. Optionally attach d2oracle.dll in synchronous headless mode. */
  OracleIsDone_t p_OracleIsDone = NULL;
  if (oracleDllPath && oracleDllPath[0]) {
    SetEnvironmentVariableA("ORACLE_HEADLESS", "1");
    HMODULE hOracle = LoadLibraryA(oracleDllPath);
    if (!hOracle) {
      fprintf(stderr, "[d2host-113c] Failed to load oracle DLL: %s (err=%lu)\n",
              oracleDllPath, GetLastError());
      return 4;
    }
    OracleHeadlessInit_t p_HeadlessInit =
        (OracleHeadlessInit_t)(void (*)(void))GetProcAddress(
            hOracle, "d2oracle_headless_init");
    p_OracleIsDone =
        (OracleIsDone_t)(void (*)(void))GetProcAddress(hOracle, "d2oracle_is_done");
    if (!p_HeadlessInit) {
      fprintf(stderr, "[d2host-113c] d2oracle_headless_init missing in %s\n",
              oracleDllPath);
      return 5;
    }
    p_HeadlessInit();
  }

  /* 8. Inspect Save\<charName>.d2s for classId & expansion/hardcore flags. */
  char saveFilePath[260];
  if (savePathArg && savePathArg[0]) {
    snprintf(saveFilePath, sizeof(saveFilePath), "%s", savePathArg);
  } else {
    snprintf(saveFilePath, sizeof(saveFilePath), "Save\\%s.d2s", charName);
  }
  uint8_t charClassId = 4;
  uint8_t charStatus = 0x20;
  char parsedName[16] = {0};
  if (read_d2s_meta(saveFilePath, parsedName, &charClassId, &charStatus)) {
    if (parsedName[0]) {
      memcpy(charName, parsedName, 16);
    }
  }

  QueryPerformanceCounter(&tInit);

  /* 9. Send C2S 0x67 (CS_CREATEGAME, 0x2E bytes, matching D2Client 0x6FAC4C20). */
  uint8_t pkt67[0x2E];
  memset(pkt67, 0, sizeof(pkt67));
  pkt67[0x00] = 0x67;
  memcpy(pkt67 + 0x01, charName, 15); /* szGameName (pkt67[0x10] stays 0) */
  pkt67[0x11] = 0x03;                 /* Single Player gameType=3 */
  pkt67[0x12] = charClassId;
  pkt67[0x13] = (charStatus & 0x04) ? 0x04 : 0x00;
  pkt67[0x14] = difficulty;
  memcpy(pkt67 + 0x15, charName, 15); /* szCharName (pkt67[0x24] stays 0) */
  uint32_t arenaFlags = ((charStatus & 0x20) && isExp) ? 0x00100004u : 0x00000004u;
  if (charStatus & 0x04) arenaFlags |= 0x00000800u;
  *(uint32_t *)(pkt67 + 0x27) = arenaFlags;
  pkt67[0x2D] = 0x00; /* locale ENG */

  p_NetSend((int)sizeof(pkt67), 0, pkt67);
  for (int i = 0; i < 200; i++) {
    p_RecvPackets();
    if (p_SendUpdates) p_SendUpdates(1, 0);
    while (p_NetRecv(s2cDrain, sizeof(s2cDrain)) > 0) {
    }
    uint32_t slotKey = *(uint32_t *)(0x6FD30C08u + d2gameRebase);
    if (slotKey && slotKey != 0xFFFFFFFFu) break;
    Sleep(1);
  }
  uint32_t gameHashKey = *(uint32_t *)(0x6FD30C08u + d2gameRebase);
  if (!gameHashKey || gameHashKey == 0xFFFFFFFFu) {
    fprintf(stderr, "[d2host-113c] ERROR: C2S 0x67 did not create game (slotKey=0x%08x)\n",
            gameHashKey);
    return 6;
  }

  /* 10. Execute Frame 1 BEFORE C2S 0x6B (matches Game.exe SP logon order!). */
  *pLastTickMs = ((GetTickCount() & 0x7FFFFFFFu) - 40u);
  p_UpdateGames(1);
  if (p_SendUpdates) p_SendUpdates(1, 0);
  while (p_NetRecv(s2cDrain, sizeof(s2cDrain)) > 0) {
  }

  /* 11. Send C2S 0x6B (CS_ENTER_GAME, 1 byte) and process immediately so
   *     player #1 and Rogue Encampment rooms spawn before Frame 2. */
  uint8_t pkt6B[1] = {0x6B};
  p_NetSend(1, 0, pkt6B);
  for (int i = 0; i < 200; i++) {
    p_RecvPackets();
    if (p_SendUpdates) p_SendUpdates(1, 0);
    while (p_NetRecv(s2cDrain, sizeof(s2cDrain)) > 0) {
    }
    int hasPlayer = 0;
    for (int b = 0; b < 1024 && !hasPlayer; b++) {
      uintptr_t headAddr = (uintptr_t)&g_game_hash_buckets[b].prev;
      uint32_t first = g_game_hash_buckets[b].next;
      if (first != 0 && first != ~(uint32_t)headAddr) {
        const uint8_t *g0 = (const uint8_t *)(uintptr_t)first;
        for (int h = 0; h < 128; h++) {
          if (*(const uint32_t *)(g0 + 0x1120 + h * 4) != 0) {
            hasPlayer = 1;
            break;
          }
        }
      }
    }
    if (hasPlayer) break;
    Sleep(1);
  }

  /* 12. Run unthrottled server frame loop (Frames 2..N). */
  if (dumpLayoutPath && dumpLayoutPath[0] && maxFrames == 0) {
    maxFrames = 35;
  }
  uint32_t executedFrames = 1;
  for (;;) {
    if (p_OracleIsDone && p_OracleIsDone()) break;
    if (maxFrames > 0 && executedFrames >= maxFrames) break;
    p_RecvPackets();
    *pLastTickMs = ((GetTickCount() & 0x7FFFFFFFu) - 40u);
    if (p_UpdateGames(1)) {
      executedFrames++;
    }
    if (p_SendUpdates) p_SendUpdates(1, 0);
    while (p_NetRecv(s2cDrain, sizeof(s2cDrain)) > 0) {
    }
  }

  /* Optional live server struct layout dump (Game, Act, Env, Room1, RoomEx, CollGrid, CoordList, Monster/AI, alloc_sizes, oracle getters). */
  if (dumpLayoutPath && dumpLayoutPath[0]) {
    const uint8_t *pGame = NULL;
    for (int b = 0; b < 1024 && !pGame; b++) {
      uintptr_t headAddr = (uintptr_t)&g_game_hash_buckets[b].prev;
      uint32_t first = g_game_hash_buckets[b].next;
      if (first != 0 && first != ~(uint32_t)headAddr) {
        pGame = (const uint8_t *)(uintptr_t)first;
      }
    }
    if (!pGame) {
      fprintf(stderr, "[d2host-113c] --dump-layout: no live D2GameStrc\n");
      return 9;
    }
    const uint8_t *pTimer = *(const uint8_t *const *)(pGame + 0xB8);
    const uint8_t *pAct = *(const uint8_t *const *)(pGame + 0xBC);
    const uint8_t *pEnv = pAct ? *(const uint8_t *const *)(pAct + 0x04) : NULL;
    const uint8_t *pUnit = NULL;
    for (int h = 0; h < 128 && !pUnit; h++) {
      pUnit = *(const uint8_t *const *)(pGame + 0x1120 + h * 4);
    }
    const uint8_t *pData = pUnit ? *(const uint8_t *const *)(pUnit + 0x14) : NULL;
    const uint8_t *pPath = pUnit ? *(const uint8_t *const *)(pUnit + 0x2C) : NULL;
    const uint8_t *pSlex = pUnit ? *(const uint8_t *const *)(pUnit + 0x5C) : NULL;
    const uint8_t *pStateFlags = pSlex ? *(const uint8_t *const *)(pSlex + 0x58) : NULL;
    const uint8_t *pMyStats = pSlex ? *(const uint8_t *const *)(pSlex + 0x24) : NULL;
    uint16_t myCnt = pSlex ? *(const uint16_t *)(pSlex + 0x28) : 0;
    const uint8_t *pFullStats = pSlex ? *(const uint8_t *const *)(pSlex + 0x48) : NULL;
    uint16_t fullCnt = pSlex ? *(const uint16_t *)(pSlex + 0x4C) : 0;
    const uint8_t *pRoom = pPath ? *(const uint8_t *const *)(pPath + 0x1C) : NULL;
    if (!pRoom && pAct) {
      pRoom = *(const uint8_t *const *)(pAct + 0x10);
    }
    const uint8_t *pRoomEx = pRoom ? *(const uint8_t *const *)(pRoom + 0x10) : NULL;
    const uint8_t *pCollGrid = pRoom ? *(const uint8_t *const *)(pRoom + 0x20) : NULL;
    const uint8_t *pLogic = pRoomEx ? *(const uint8_t *const *)(pRoomEx + 0x64) : NULL;
    const uint8_t *pCoordList = pLogic ? *(const uint8_t *const *)(pLogic + 0x30) : NULL;

    const uint8_t *pMonUnit = NULL;
    const uint8_t *pMonData = NULL;
    const uint8_t *pAiGeneral = NULL;
    const uint8_t *pAiControl = NULL;
    for (int h = 0; h < 128; h++) {
      const uint8_t *m = *(const uint8_t *const *)(pGame + 0x1320 + h * 4);
      while (m) {
        const uint8_t *md = *(const uint8_t *const *)(m + 0x14);
        const uint8_t *ag = md ? *(const uint8_t *const *)(md + 0x28) : NULL;
        const uint8_t *ac = md ? *(const uint8_t *const *)(md + 0x2C) : NULL;
        if (md && !pMonUnit) {
          pMonUnit = m;
          pMonData = md;
        }
        if (ag && !pAiGeneral) pAiGeneral = ag;
        if (ac && !pAiControl) pAiControl = ac;
        m = *(const uint8_t *const *)(m + 0xE4);
      }
    }

    D2Common_GetRoomFromUnit_t p_GetRoomFromUnit =
        (D2Common_GetRoomFromUnit_t)(void (*)(void))GetProcAddress(
            hD2Common, MAKEINTRESOURCEA(10331));
    D2Common_GetRoomCoords_t p_GetRoomCoords =
        (D2Common_GetRoomCoords_t)(void (*)(void))GetProcAddress(
            hD2Common, MAKEINTRESOURCEA(10561));
    D2Common_GetLevelIdFromRoom_t p_GetLevelIdFromRoom =
        (D2Common_GetLevelIdFromRoom_t)(void (*)(void))GetProcAddress(
            hD2Common, MAKEINTRESOURCEA(10826));
    D2Common_GetActFromRoom_t p_GetActFromRoom =
        (D2Common_GetActFromRoom_t)(void (*)(void))GetProcAddress(
            hD2Common, MAKEINTRESOURCEA(10057));

    uint32_t oracleUnitRoom = (p_GetRoomFromUnit && pUnit)
                                  ? (uint32_t)(uintptr_t)p_GetRoomFromUnit(pUnit)
                                  : 0;
    int32_t oracleRoomCoords[8] = {0};
    if (p_GetRoomCoords && pRoom) {
      p_GetRoomCoords(pRoom, oracleRoomCoords);
    }
    int32_t oracleRoomLevelId = (p_GetLevelIdFromRoom && pRoom)
                                    ? p_GetLevelIdFromRoom(pRoom)
                                    : 0;
    uint32_t oracleRoomAct = (p_GetActFromRoom && pRoom)
                                 ? (uint32_t)p_GetActFromRoom(pRoom)
                                 : 0;

    uint32_t gameFrame = *(const uint32_t *)(pGame + 0xA8);
    uint32_t gsLo = *(const uint32_t *)(pGame + 0xD0);
    uint32_t gsHi = *(const uint32_t *)(pGame + 0xD4);
    uint32_t uId = pUnit ? *(const uint32_t *)(pUnit + 0x0C) : 1;
    uint32_t uCls = pUnit ? *(const uint32_t *)(pUnit + 0x04) : 0;
    uint32_t uMode = pUnit ? *(const uint32_t *)(pUnit + 0x10) : 0;
    uint16_t uPosX = pPath ? *(const uint16_t *)(pPath + 0x02) : 0;
    uint16_t uPosY = pPath ? *(const uint16_t *)(pPath + 0x06) : 0;
    uint32_t uSeedLo = pUnit ? *(const uint32_t *)(pUnit + 0x20) : 0;
    uint32_t uSeedHi = pUnit ? *(const uint32_t *)(pUnit + 0x24) : 0;

    const uint8_t *pBaseSub = NULL;
    if (pSlex) {
      const uint8_t *pSub = *(const uint8_t *const *)(pSlex + 0x3C);
      for (int guard = 0; pSub && guard < 32; guard++) {
        uint32_t subFlags = *(const uint32_t *)(pSub + 0x10);
        if ((subFlags & 0x80000000u) == 0 && !pBaseSub) {
          pBaseSub = pSub;
        }
        pSub = *(const uint8_t *const *)(pSub + 0x2C);
      }
      if (!pBaseSub) pBaseSub = *(const uint8_t *const *)(pSlex + 0x3C);
    }
    const uint8_t *pEventPoolChunk = pTimer ? *(const uint8_t *const *)(pTimer + 0xA1C) : NULL;

    FILE *fOut = fopen(dumpLayoutPath, "wb");
    if (!fOut) {
      fprintf(stderr, "[d2host-113c] failed to open %s\n", dumpLayoutPath);
      return 10;
    }
    fprintf(fOut,
            "{\"frame\":%u,\"gs\":[%u,%u],\"t0\":[[%u,%u,%u,%u,%u,%u,%u]],"
            "\"oracle\":{\"unitRoom\":%u,\"roomCoords\":[%d,%d,%d,%d,%d,%d,%d,%d],\"roomLevelId\":%d,\"roomAct\":%u},"
            "\"alloc_sizes\":{\"D2GameStrc\":%u,\"D2TimerStrc\":%u,\"D2EventPoolChunk\":%u,"
            "\"D2UnitStrc\":%u,\"D2DynamicPathStrc\":%u,\"D2StatListExStrc\":%u,\"D2StatListStrc\":%u,"
            "\"D2ActStrc\":%u,\"D2EnvironmentStrc\":%u,\"D2ActiveRoomStrc\":%u,\"D2RoomExStrc\":%u,"
            "\"D2RoomCollisionGridAlloc\":%u,\"D2RoomCoordListStrc\":%u,"
            "\"D2MonsterDataStrc\":%u,\"D2AiGeneralStrc\":%u,\"D2AiControlStrc\":%u},"
            "\"mem\":[{\"type\":0,\"id\":%u,\"blocks\":[",
            gameFrame, gsLo, gsHi, uId, uCls, uMode,
            (unsigned)uPosX, (unsigned)uPosY, uSeedLo, uSeedHi,
            oracleUnitRoom,
            oracleRoomCoords[0], oracleRoomCoords[1], oracleRoomCoords[2], oracleRoomCoords[3],
            oracleRoomCoords[4], oracleRoomCoords[5], oracleRoomCoords[6], oracleRoomCoords[7],
            oracleRoomLevelId, oracleRoomAct,
            lookup_alloc_size(pGame),
            lookup_alloc_size(pTimer),
            lookup_alloc_size(pEventPoolChunk),
            lookup_alloc_size(pUnit),
            lookup_alloc_size(pPath),
            lookup_alloc_size(pSlex),
            lookup_alloc_size(pBaseSub),
            lookup_alloc_size(pAct),
            lookup_alloc_size(pEnv),
            lookup_alloc_size(pRoom),
            lookup_alloc_size(pRoomEx),
            lookup_alloc_size(pCollGrid),
            lookup_alloc_size(pCoordList),
            lookup_alloc_size(pMonData),
            lookup_alloc_size(pAiGeneral),
            lookup_alloc_size(pAiControl),
            uId);
    int first = 1;
    write_json_hex_block(fOut, "game", pGame, 0x1DF4u, &first);
    write_json_hex_block(fOut, "timer", pTimer, 0xA20u, &first);
    write_json_hex_block(fOut, "unit", pUnit, 0xF4u, &first);
    write_json_hex_block(fOut, "data", pData, 0x28u, &first);
    write_json_hex_block(fOut, "path", pPath, 0x200u, &first);
    write_json_hex_block(fOut, "statlistex", pSlex, 0x64u, &first);
    write_json_hex_block(fOut, "stateflags", pStateFlags, 0x20u, &first);
    if (pMyStats && myCnt > 0) {
      write_json_hex_block(fOut, "mystats", pMyStats, (size_t)myCnt * 8u, &first);
    }
    if (pFullStats && fullCnt > 0) {
      write_json_hex_block(fOut, "fullstats", pFullStats, (size_t)fullCnt * 8u, &first);
    }
    if (pSlex) {
      const uint8_t *pSub = *(const uint8_t *const *)(pSlex + 0x3C);
      for (int guard = 0; pSub && guard < 32; guard++) {
        write_json_hex_block(fOut, "childstatlist", pSub, 0x3Cu, &first);
        pSub = *(const uint8_t *const *)(pSub + 0x2C);
      }
    }
    write_json_hex_block(fOut, "act", pAct, 0x60u, &first);
    write_json_hex_block(fOut, "env", pEnv, 0x38u, &first);
    write_json_hex_block(fOut, "room", pRoom, 0x80u, &first);
    write_json_hex_block(fOut, "roomex", pRoomEx, 0xECu, &first);
    write_json_hex_block(fOut, "collgrid", pCollGrid, 0x24u, &first);
    write_json_hex_block(fOut, "coordlist", pCoordList, 0x30u, &first);
    write_json_hex_block(fOut, "monunit", pMonUnit, 0xF4u, &first);
    write_json_hex_block(fOut, "mondata", pMonData, 0x60u, &first);
    write_json_hex_block(fOut, "aigeneral", pAiGeneral, 0x40u, &first);
    write_json_hex_block(fOut, "aicontrol", pAiControl, 0x24u, &first);
    if (pRoom) {
      const uint32_t *ppNear = *(const uint32_t *const *)(pRoom + 0x00);
      uint32_t nNear = *(const uint32_t *)(pRoom + 0x24);
      if (ppNear && nNear <= 64) {
        for (uint32_t r = 0; r < nNear; r++) {
          const uint8_t *adj = (const uint8_t *)(uintptr_t)ppNear[r];
          if (adj && adj != pRoom) {
            write_json_hex_block(fOut, "adjroom", adj, 0x80u, &first);
          }
        }
      }
      const uint8_t *pRoomUnit = *(const uint8_t *const *)(pRoom + 0x74);
      for (int guard = 0; pRoomUnit && guard < 64; guard++) {
        write_json_hex_block(fOut, "roomunit", pRoomUnit, 0xF4u, &first);
        pRoomUnit = *(const uint8_t *const *)(pRoomUnit + 0xE8);
      }
    }
    const uint8_t *pEv = pUnit ? *(const uint8_t *const *)(pUnit + 0xDC) : NULL;
    for (int guard = 0; pEv && guard < 32; guard++) {
      write_json_hex_block(fOut, "event", pEv, 0x30u, &first);
      pEv = *(const uint8_t *const *)(pEv + 0x24);
    }
    fprintf(fOut, "]}]}\n");
    fclose(fOut);
    ExitProcess(0);
  }

  QueryPerformanceCounter(&tEnd);
  double initMs = (double)(tInit.QuadPart - t0.QuadPart) * 1000.0 / (double)qpf.QuadPart;
  double simMs = (double)(tEnd.QuadPart - tInit.QuadPart) * 1000.0 / (double)qpf.QuadPart;
  double totalMs = (double)(tEnd.QuadPart - t0.QuadPart) * 1000.0 / (double)qpf.QuadPart;
  double fps = simMs > 0.0 ? ((double)executedFrames * 1000.0 / simMs) : 0.0;

  printf("[d2host-113c] done: frames=%u seed=%u diff=%u init_ms=%.2f sim_ms=%.2f total_ms=%.2f effective_fps=%.1f\n",
         executedFrames, seed, (unsigned)difficulty, initMs, simMs, totalMs, fps);
  fflush(stdout);

  /* Terminate cleanly without waiting for background D2Net worker threads. */
  ExitProcess(0);
  return 0;
}
