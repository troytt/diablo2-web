/*
 * fn-emitter.c — Generic Data-Driven Real-DLL Function Vector Emitter (M0b).
 *
 * Reads a compiled binary `.fnreq` file produced by `fn-request.ts`, stages
 * deterministic struct images in a fixed-address arena (`0x20000000`), invokes
 * the target 1.13c `D2Common.dll` / `D2Game.dll` function through a generic
 * register+stack assembly thunk with Vectored Exception Handler (VEH) fault
 * recovery and IAT host stubs (`Fog.#10024` assert, `Fog.#10042/#10045` alloc,
 * `Fog.#10043/#10046` free, `Fog.#10047` realloc/free), verifies `espDelta`,
 * and writes deterministic NDJSON records.
 */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define ARENA_BASE_ADDR   0x20000000u
#define ARENA_TOTAL_SIZE  0x02000000u
#define ARENA_ALLOC_BASE  0x21000000u
#define ARENA_ALLOC_LIMIT 0x22000000u

#define MAX_IMAGES   64
#define MAX_GLOBALS  64
#define MAX_DUMPS    64
#define MAX_ALLOCS   256
#define MAX_FREES    256
#define MAX_STUBS    32
#define MAX_STACK    16

typedef void(__fastcall *Fog_InitLogPrefix_t)(const char *szPrefix);
typedef void(__fastcall *Fog_InitFileSystem_t)(int bDirectTxt, void *pCallback);
typedef void(__fastcall *Fog_InitSystem_t)(int bEnable, void *pUnused);
typedef void(__stdcall *Fog_VoidStd_t)(void);
typedef int(__stdcall *Fog_IsExpansion_t)(void);
typedef BOOL(__stdcall *Storm_SFileOpenArchive_t)(const char *szMpqName,
                                                  DWORD dwPriority,
                                                  DWORD dwFlags,
                                                  HANDLE *phMpq);
typedef BOOL(__stdcall *Storm_SMemFree_t)(void *pPtr,
                                          const char *szFilename,
                                          int nLine,
                                          DWORD dwFlags);
typedef int(__fastcall *D2Lang_Init_t)(int bUnusedEcx,
                                       const char *szLocaleEdx,
                                       int bExp);
typedef int(__stdcall *D2Common_InitDataTables_t)(int a0, int a1, int a2);

typedef struct {
  const char *name;
  HMODULE hMod;
  uintptr_t base;
  uintptr_t prefBase;
  uint32_t imageSize;
} LoadedMod;

static LoadedMod g_mods[8];
static int g_mod_count = 0;

static uintptr_t get_pref_base(HMODULE m) {
  IMAGE_DOS_HEADER *dos = (IMAGE_DOS_HEADER *)m;
  IMAGE_NT_HEADERS32 *nt = (IMAGE_NT_HEADERS32 *)((uint8_t *)m + dos->e_lfanew);
  return nt->OptionalHeader.ImageBase;
}

static uint32_t get_img_size(HMODULE m) {
  IMAGE_DOS_HEADER *dos = (IMAGE_DOS_HEADER *)m;
  IMAGE_NT_HEADERS32 *nt = (IMAGE_NT_HEADERS32 *)((uint8_t *)m + dos->e_lfanew);
  return nt->OptionalHeader.SizeOfImage;
}

static void register_mod(const char *name, HMODULE m) {
  if (!m || g_mod_count >= 8) return;
  g_mods[g_mod_count].name = name;
  g_mods[g_mod_count].hMod = m;
  g_mods[g_mod_count].base = (uintptr_t)m;
  g_mods[g_mod_count].prefBase = get_pref_base(m);
  g_mods[g_mod_count].imageSize = get_img_size(m);
  g_mod_count++;
}

static uintptr_t ptr_to_canon_va(uintptr_t p) {
  for (int i = 0; i < g_mod_count; i++) {
    if (p >= g_mods[i].base && p < g_mods[i].base + g_mods[i].imageSize) {
      return g_mods[i].prefBase + (p - g_mods[i].base);
    }
  }
  return p;
}

static uintptr_t canon_va_to_ptr(uintptr_t va) {
  for (int i = 0; i < g_mod_count; i++) {
    if (va >= g_mods[i].prefBase && va < g_mods[i].prefBase + g_mods[i].imageSize) {
      return g_mods[i].base + (va - g_mods[i].prefBase);
    }
  }
  return va;
}

/* ------------------------------- Thunk & Fault / Host-Stub State */

uint32_t g_thunk_target = 0;
uint32_t g_thunk_nargs = 0;
uint32_t g_thunk_args[MAX_STACK];
uint32_t g_thunk_in_eax = 0;
uint32_t g_thunk_in_ecx = 0;
uint32_t g_thunk_in_edx = 0;
uint32_t g_thunk_in_ebx = 0;
uint32_t g_thunk_in_esi = 0;
uint32_t g_thunk_in_edi = 0;

uint32_t g_thunk_out_eax = 0;
uint32_t g_thunk_out_edx = 0;
uint32_t g_thunk_out_ebx = 0;
uint32_t g_thunk_out_esi = 0;
uint32_t g_thunk_out_edi = 0;
uint32_t g_thunk_out_ebp = 0;

uint32_t g_thunk_saved_esp = 0;
uint32_t g_thunk_saved_ebp = 0;
uint32_t g_thunk_esp_before_call = 0;
uint32_t g_thunk_esp_after_call = 0;

volatile LONG g_thunk_in_call = 0;
volatile LONG g_thunk_faulted = 0; /* 0 = ok, 1 = hardware exception, 2 = fogAssert */

uint32_t g_fault_code = 0;
uint32_t g_fault_eip_va = 0;
uint32_t g_fault_av_addr = 0;
uint32_t g_fault_av_write = 0;
uint32_t g_fault_line = 0;

uint32_t g_assert_eip = 0;
uint32_t g_assert_a0 = 0;
uint32_t g_assert_a1 = 0;
uint32_t g_assert_a2 = 0;

void thunk_resume(void);

__attribute__((naked)) static void thunk_invoke(void) {
  __asm__ volatile(
      "pushl %ebp\n\t"
      "pushl %ebx\n\t"
      "pushl %esi\n\t"
      "pushl %edi\n\t"
      "movl %esp, _g_thunk_saved_esp\n\t"
      "movl %ebp, _g_thunk_saved_ebp\n\t"
      "movl _g_thunk_nargs, %ecx\n\t"
      "1:\n\t"
      "testl %ecx, %ecx\n\t"
      "jz 2f\n\t"
      "decl %ecx\n\t"
      "pushl _g_thunk_args(,%ecx,4)\n\t"
      "jmp 1b\n\t"
      "2:\n\t"
      "movl %esp, _g_thunk_esp_before_call\n\t"
      "movl _g_thunk_in_eax, %eax\n\t"
      "movl _g_thunk_in_ecx, %ecx\n\t"
      "movl _g_thunk_in_edx, %edx\n\t"
      "movl _g_thunk_in_ebx, %ebx\n\t"
      "movl _g_thunk_in_esi, %esi\n\t"
      "movl _g_thunk_in_edi, %edi\n\t"
      "call *_g_thunk_target\n\t"
      "movl %esp, _g_thunk_esp_after_call\n\t"
      "movl %eax, _g_thunk_out_eax\n\t"
      "movl %edx, _g_thunk_out_edx\n\t"
      "movl %ebx, _g_thunk_out_ebx\n\t"
      "movl %esi, _g_thunk_out_esi\n\t"
      "movl %edi, _g_thunk_out_edi\n\t"
      "movl %ebp, _g_thunk_out_ebp\n\t"
      ".globl _thunk_resume\n"
      "_thunk_resume:\n\t"
      "movl _g_thunk_saved_ebp, %ebp\n\t"
      "movl _g_thunk_saved_esp, %esp\n\t"
      "popl %edi\n\t"
      "popl %esi\n\t"
      "popl %ebx\n\t"
      "popl %ebp\n\t"
      "ret\n\t");
}

static LONG CALLBACK fn_veh(EXCEPTION_POINTERS *ep) {
  if (!g_thunk_in_call) return EXCEPTION_CONTINUE_SEARCH;
  DWORD code = ep->ExceptionRecord->ExceptionCode;
  if (code == EXCEPTION_ACCESS_VIOLATION ||
      code == EXCEPTION_INT_DIVIDE_BY_ZERO ||
      code == EXCEPTION_INT_OVERFLOW ||
      code == EXCEPTION_ILLEGAL_INSTRUCTION ||
      code == EXCEPTION_PRIV_INSTRUCTION ||
      code == EXCEPTION_ARRAY_BOUNDS_EXCEEDED ||
      code == EXCEPTION_STACK_OVERFLOW) {
    g_thunk_in_call = 0;
    g_thunk_faulted = 1;
    g_fault_code = (uint32_t)code;
    g_fault_eip_va = (uint32_t)ptr_to_canon_va((uintptr_t)ep->ExceptionRecord->ExceptionAddress);
    if (code == EXCEPTION_ACCESS_VIOLATION && ep->ExceptionRecord->NumberParameters >= 2) {
      g_fault_av_write = (uint32_t)ep->ExceptionRecord->ExceptionInformation[0];
      g_fault_av_addr = (uint32_t)ep->ExceptionRecord->ExceptionInformation[1];
    } else {
      g_fault_av_write = 0;
      g_fault_av_addr = 0;
    }
    ep->ContextRecord->Eip = (DWORD)(uintptr_t)thunk_resume;
    ep->ContextRecord->Esp = g_thunk_saved_esp;
    ep->ContextRecord->Ebp = g_thunk_saved_ebp;
    return EXCEPTION_CONTINUE_EXECUTION;
  }
  return EXCEPTION_CONTINUE_SEARCH;
}

/* ------------------------------- Arena Allocator & Fog Host Stubs */

typedef struct {
  uint32_t addr;
  uint32_t size;
} ImageDecl;

static ImageDecl g_images[MAX_IMAGES];
static uint32_t g_num_images = 0;

typedef struct {
  uint32_t size;
  uint32_t addr;
} ArenaAllocRec;

static uint32_t g_arena_alloc_cursor = ARENA_ALLOC_BASE;
static uint8_t g_arena_alloc_fill = 0;
static ArenaAllocRec g_allocs[MAX_ALLOCS];
static uint32_t g_alloc_count = 0;
static uint32_t g_frees[MAX_FREES];
static uint32_t g_free_count = 0;

static void *arena_bump_alloc(uint32_t dwSize) {
  uint32_t aligned = (g_arena_alloc_cursor + 15u) & ~15u;
  uint32_t next = aligned + ((dwSize > 0 ? dwSize : 4u) + 64u);
  if (next > ARENA_ALLOC_LIMIT || g_alloc_count >= MAX_ALLOCS) {
    fprintf(stderr, "[fn-emitter] arena_bump_alloc exhausted (size=%u)\n", dwSize);
    ExitProcess(6);
  }
  void *ptr = (void *)(uintptr_t)aligned;
  memset(ptr, g_arena_alloc_fill, dwSize);
  g_allocs[g_alloc_count].size = dwSize;
  g_allocs[g_alloc_count].addr = aligned;
  g_alloc_count++;
  g_arena_alloc_cursor = (next + 15u) & ~15u;
  return ptr;
}

static uint32_t find_known_block_size(uint32_t addr) {
  for (uint32_t i = 0; i < g_alloc_count; i++) {
    if (g_allocs[i].addr == addr) return g_allocs[i].size;
  }
  for (uint32_t i = 0; i < g_num_images; i++) {
    if (g_images[i].addr == addr) return g_images[i].size;
  }
  return 0;
}

static void record_arena_free(uint32_t addr) {
  if (g_free_count < MAX_FREES) {
    g_frees[g_free_count++] = addr;
  }
}

void record_fog_assert(void) {
  g_thunk_in_call = 0;
  g_thunk_faulted = 2;
  g_fault_code = 0xE0000024u;
  g_fault_eip_va = (uint32_t)ptr_to_canon_va((uintptr_t)g_assert_eip);
  g_fault_line = g_assert_a2;
}

/*
 * Fog.#10024 (0x6FF61100): FOG_DisplayAssert(szMsg, szFile, nLine)
 * Evidence: D2Common 0x6FD5965B..0x6FD59670 pushes line, msg, file then calls 0x6FD59216.
 * Unwinds directly to _thunk_resume so execution never returns into the asserting function.
 */
__attribute__((naked)) static void stub_fog_10024(void) {
  __asm__ volatile(
      "movl 0(%esp), %eax\n\t"
      "movl %eax, _g_assert_eip\n\t"
      "movl 4(%esp), %eax\n\t"
      "movl %eax, _g_assert_a0\n\t"
      "movl 8(%esp), %eax\n\t"
      "movl %eax, _g_assert_a1\n\t"
      "movl 12(%esp), %eax\n\t"
      "movl %eax, _g_assert_a2\n\t"
      "call _record_fog_assert\n\t"
      "jmp _thunk_resume\n\t");
}

/*
 * Fog.#10042 (0x6FF6CD10): FOG_AllocClientMemory(ecx=dwSize, edx=szFile, stack: nLine, nZero), ret 0x8.
 * Evidence: Fog.dll 0x6FF6CD40 `ret 0x8`; D2Common 0x6FD59946..0x6FD59958.
 */
static void *__fastcall stub_fog_10042(uint32_t dwSize,
                                       const char *szFile,
                                       int nLine,
                                       int nZero) {
  (void)szFile;
  (void)nLine;
  (void)nZero;
  return arena_bump_alloc(dwSize);
}

/*
 * Fog.#10043 (0x6FF6CCF0): FOG_FreeClientMemory(ecx=pMem, edx=szFile, stack: nLine, nZero), ret 0x8.
 * Evidence: Fog.dll 0x6FF6CD0C `ret 0x8`.
 */
static int __fastcall stub_fog_10043(void *pMem,
                                     const char *szFile,
                                     int nLine,
                                     int nZero) {
  (void)szFile;
  (void)nLine;
  (void)nZero;
  record_arena_free((uint32_t)(uintptr_t)pMem);
  return 1;
}

/*
 * Fog.#10045 (0x6FF6CD50): FOG_AllocServerMemory(ecx=pMemPool, edx=dwSize, stack: szFile, nLine, nZero), ret 0xC.
 * Evidence: Fog.dll 0x6FF6CD8E `ret 0xC`; D2Common UNIT_Alloc 0x6FD7F377..0x6FD7F38A.
 */
static void *__fastcall stub_fog_10045(void *pMemPool,
                                       uint32_t dwSize,
                                       const char *szFile,
                                       int nLine,
                                       int nZero) {
  (void)pMemPool;
  (void)szFile;
  (void)nLine;
  (void)nZero;
  return arena_bump_alloc(dwSize);
}

/*
 * Fog.#10046 (0x6FF6CCC0): FOG_FreeServerMemory(ecx=pMemPool, edx=pMem, stack: szFile, nLine, nZero), ret 0xC.
 * Evidence: Fog.dll 0x6FF6CCE9 `ret 0xC`; D2Common 0x6FD59BA1..0x6FD59BBC.
 */
static int __fastcall stub_fog_10046(void *pMemPool,
                                     void *pMem,
                                     const char *szFile,
                                     int nLine,
                                     int nZero) {
  (void)pMemPool;
  (void)szFile;
  (void)nLine;
  (void)nZero;
  record_arena_free((uint32_t)(uintptr_t)pMem);
  return 1;
}

/*
 * Fog.#10047 (0x6FF6CDA0): FOG_ReallocServerMemory(ecx=pMemPool, edx=pMem, stack: dwSize, szFile, nLine, nZero), ret 0x10.
 * Evidence: Fog.dll 0x6FF6CDE1 `ret 0x10`; D2Common INVENTORY_GetOrInitGrid 0x6FD6E25D..0x6FD6E275.
 */
static void *__fastcall stub_fog_10047(void *pMemPool,
                                       void *pMem,
                                       uint32_t dwSize,
                                       const char *szFile,
                                       int nLine,
                                       int nZero) {
  (void)pMemPool;
  (void)szFile;
  (void)nLine;
  (void)nZero;
  if (dwSize == 0) {
    if (pMem) record_arena_free((uint32_t)(uintptr_t)pMem);
    return NULL;
  }
  void *newPtr = arena_bump_alloc(dwSize);
  if (pMem) {
    uint32_t oldSize = find_known_block_size((uint32_t)(uintptr_t)pMem);
    uint32_t copyLen = oldSize < dwSize ? oldSize : dwSize;
    if (copyLen > 0) {
      memcpy(newPtr, pMem, copyLen);
    }
  }
  return newPtr;
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

static void install_fog_stub(HMODULE hFog, HMODULE hD2Common, HMODULE hD2Game, uint32_t ordinal) {
  void *origFn = (void *)(uintptr_t)GetProcAddress(hFog, MAKEINTRESOURCEA(ordinal));
  void *hookFn = NULL;
  switch (ordinal) {
    case 10024: hookFn = (void *)(uintptr_t)stub_fog_10024; break;
    case 10042: hookFn = (void *)(uintptr_t)stub_fog_10042; break;
    case 10043: hookFn = (void *)(uintptr_t)stub_fog_10043; break;
    case 10045: hookFn = (void *)(uintptr_t)stub_fog_10045; break;
    case 10046: hookFn = (void *)(uintptr_t)stub_fog_10046; break;
    case 10047: hookFn = (void *)(uintptr_t)stub_fog_10047; break;
    default:
      fprintf(stderr, "[fn-emitter] Unsupported Fog hostStub ordinal %u\n", ordinal);
      ExitProcess(7);
  }
  if (!origFn) {
    fprintf(stderr, "[fn-emitter] GetProcAddress(Fog, #%u) failed\n", ordinal);
    ExitProcess(7);
  }
  hook_module_iat_ptr(hD2Common, origFn, hookFn);
  hook_module_iat_ptr(hD2Game, origFn, hookFn);
}

/* ------------------------------- MPQ Helper (for tables=="real") */

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
        fprintf(stderr, "[fn-emitter] missing required MPQ: %s\n", fullPath);
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
      fprintf(stderr, "[fn-emitter] failed to open MPQ: %s\n", target);
      return 0;
    }
  }
  return 1;
}

/* ------------------------------- Binary Reader Helpers */

static void must_read(FILE *f, void *dst, size_t n) {
  if (n == 0) return;
  if (fread(dst, 1, n, f) != n) {
    fprintf(stderr, "[fn-emitter] unexpected EOF reading .fnreq\n");
    ExitProcess(2);
  }
}

static uint32_t read_u32(FILE *f) {
  uint32_t v = 0;
  must_read(f, &v, 4);
  return v;
}

static int32_t read_i32(FILE *f) {
  int32_t v = 0;
  must_read(f, &v, 4);
  return v;
}

static char *read_str(FILE *f, uint32_t *outLen) {
  uint32_t len = read_u32(f);
  char *s = (char *)malloc(len + 1);
  if (!s) ExitProcess(2);
  must_read(f, s, len);
  s[len] = '\0';
  if (outLen) *outLen = len;
  return s;
}

static void write_json_escaped(FILE *out, const char *s) {
  fputc('"', out);
  for (; *s; s++) {
    unsigned char c = (unsigned char)*s;
    if (c == '"' || c == '\\') {
      fputc('\\', out);
      fputc(c, out);
    } else if (c < 0x20) {
      fprintf(out, "\\u%04x", c);
    } else {
      fputc(c, out);
    }
  }
  fputc('"', out);
}

static void write_hex_pair(FILE *out, uint32_t addr, const uint8_t *bytes, uint32_t len, int *first) {
  if (!*first) fputc(',', out);
  *first = 0;
  fprintf(out, "[%u,\"", addr);
  for (uint32_t i = 0; i < len; i++) {
    fprintf(out, "%02x", bytes[i]);
  }
  fprintf(out, "\"]");
}

typedef struct {
  uint32_t va;
  uintptr_t realPtr;
  uint32_t len;
  uint8_t *patchBytes;
  uint8_t *origBytes;
  uint8_t *preBytes;
  uint8_t *postBytes;
} GlobalPatchState;

typedef struct {
  uint32_t len;
  uint32_t chainLen;
  int32_t chain[8];
  uint32_t resolvedVa;
  int valid;
  uint8_t *preBytes;
} DumpState;

static int resolve_dump_chain(const DumpState *d, uint32_t *outCanonVa, uintptr_t *outRealPtr) {
  if (d->chainLen == 0) return 0;
  uint32_t curVa = (uint32_t)d->chain[0];
  uintptr_t curPtr = canon_va_to_ptr(curVa);
  for (uint32_t k = 1; k < d->chainLen; k++) {
    if (curPtr == 0 || IsBadReadPtr((const void *)curPtr, 4)) return 0;
    uint32_t derefVal = *(const uint32_t *)curPtr;
    if (derefVal == 0) return 0;
    curVa = (uint32_t)((int32_t)derefVal + d->chain[k]);
    curPtr = canon_va_to_ptr(curVa);
  }
  if (curPtr == 0 || IsBadReadPtr((const void *)curPtr, d->len)) return 0;
  *outCanonVa = curVa;
  *outRealPtr = curPtr;
  return 1;
}

int main(int argc, char **argv) {
  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  if (argc < 3) {
    fprintf(stderr, "Usage: fn-emitter.exe <in.fnreq> <out.ndjson>\n");
    return 2;
  }
  const char *reqPath = argv[1];
  const char *outPath = argv[2];

  FILE *fReq = fopen(reqPath, "rb");
  if (!fReq) {
    fprintf(stderr, "[fn-emitter] cannot open %s\n", reqPath);
    return 2;
  }

  char magic[4];
  must_read(fReq, magic, 4);
  if (memcmp(magic, "D2FR", 4) != 0) {
    fprintf(stderr, "[fn-emitter] bad .fnreq magic\n");
    return 2;
  }
  uint32_t version = read_u32(fReq);
  if (version != 1) {
    fprintf(stderr, "[fn-emitter] unsupported .fnreq version %u\n", version);
    return 2;
  }
  uint32_t moduleId = read_u32(fReq);
  uint32_t targetVa = read_u32(fReq);
  uint32_t fnSize = read_u32(fReq);
  (void)fnSize;
  uint32_t tablesMode = read_u32(fReq);
  int32_t calleePops = read_i32(fReq);
  uint32_t returnsMode = read_u32(fReq);
  g_arena_alloc_fill = (uint8_t)(read_u32(fReq) & 0xFFu);

  uint32_t numStubs = read_u32(fReq);
  uint32_t stubDllIds[MAX_STUBS], stubOrdinals[MAX_STUBS], stubKinds[MAX_STUBS];
  if (numStubs > MAX_STUBS) return 2;
  for (uint32_t i = 0; i < numStubs; i++) {
    stubDllIds[i] = read_u32(fReq);
    stubOrdinals[i] = read_u32(fReq);
    stubKinds[i] = read_u32(fReq);
  }

  g_num_images = read_u32(fReq);
  if (g_num_images > MAX_IMAGES) return 2;
  for (uint32_t i = 0; i < g_num_images; i++) {
    g_images[i].addr = read_u32(fReq);
    g_images[i].size = read_u32(fReq);
  }

  char *headerJson = read_str(fReq, NULL);
  char *fnName = read_str(fReq, NULL);
  uint32_t numVectors = read_u32(fReq);

  /* 1. Reserve fixed-address arena at 0x20000000 */
  void *arena = VirtualAlloc((void *)(uintptr_t)ARENA_BASE_ADDR,
                             ARENA_TOTAL_SIZE,
                             MEM_RESERVE | MEM_COMMIT,
                             PAGE_READWRITE);
  if (arena != (void *)(uintptr_t)ARENA_BASE_ADDR) {
    fprintf(stderr, "[fn-emitter] VirtualAlloc at 0x20000000 failed (got %p, err=%lu)\n",
            arena, (unsigned long)GetLastError());
    return 4;
  }

  /* 2. Load Storm -> Fog -> D2Lang -> D2Common -> D2Net -> D2Game */
  HMODULE hStorm = LoadLibraryA("Storm.dll");
  HMODULE hFog = LoadLibraryA("Fog.dll");
  HMODULE hD2Lang = LoadLibraryA("D2Lang.dll");
  HMODULE hD2Common = LoadLibraryA("D2Common.dll");
  HMODULE hD2Net = LoadLibraryA("D2Net.dll");
  HMODULE hD2Game = LoadLibraryA("D2Game.dll");
  if (!hStorm || !hFog || !hD2Lang || !hD2Common || !hD2Net || !hD2Game) {
    fprintf(stderr, "[fn-emitter] Failed to load DLLs (Storm=%p Fog=%p Lang=%p Common=%p Net=%p Game=%p)\n",
            (void *)hStorm, (void *)hFog, (void *)hD2Lang,
            (void *)hD2Common, (void *)hD2Net, (void *)hD2Game);
    return 3;
  }
  register_mod("Storm.dll", hStorm);
  register_mod("Fog.dll", hFog);
  register_mod("D2Lang.dll", hD2Lang);
  register_mod("D2Common.dll", hD2Common);
  register_mod("D2Net.dll", hD2Net);
  register_mod("D2Game.dll", hD2Game);

  if ((uintptr_t)hD2Common != get_pref_base(hD2Common) ||
      (uintptr_t)hFog != get_pref_base(hFog)) {
    fprintf(stderr, "[fn-emitter] D2Common (%p) or Fog (%p) not at preferred ImageBase\n",
            (void *)hD2Common, (void *)hFog);
    return 3;
  }

  Storm_SMemFree_t p_SMemFree =
      (Storm_SMemFree_t)(void (*)(void))GetProcAddress(hStorm, MAKEINTRESOURCEA(403));
  Storm_SFileOpenArchive_t p_SFileOpenArchive =
      (Storm_SFileOpenArchive_t)(void (*)(void))GetProcAddress(hStorm, MAKEINTRESOURCEA(266));

  /* Clear Storm.dll dynamic-load MPQ crypt-table poison pointer at 0x6FC43120 */
  {
    uintptr_t stormRebase = (uintptr_t)hStorm - get_pref_base(hStorm);
    void **ppCryptTable = (void **)(0x6FC43120u + stormRebase);
    if (*ppCryptTable) {
      if (p_SMemFree) p_SMemFree(*ppCryptTable, "fn-emitter.c", 1, 0);
      *ppCryptTable = NULL;
    }
  }

  /* Initialize Fog */
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

  if (tablesMode == 2) {
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
      return 3;
    }
    int isExp = p_FogIsExpansion ? p_FogIsExpansion() : 1;
    D2Lang_Init_t p_D2LangInit =
        (D2Lang_Init_t)(void (*)(void))GetProcAddress(hD2Lang, MAKEINTRESOURCEA(10008));
    D2Common_InitDataTables_t p_InitDataTables =
        (D2Common_InitDataTables_t)(void (*)(void))GetProcAddress(hD2Common, MAKEINTRESOURCEA(10943));
    if (p_D2LangInit) p_D2LangInit(0, NULL, isExp);
    if (!p_InitDataTables || !p_InitDataTables(0, 0, 0)) {
      fprintf(stderr, "[fn-emitter] D2Common.#10943 failed\n");
      return 3;
    }
  }

  /* 3. Install VEH and requested IAT host stubs */
  AddVectoredExceptionHandler(1, fn_veh);
  for (uint32_t i = 0; i < numStubs; i++) {
    if (stubDllIds[i] != 0) {
      fprintf(stderr, "[fn-emitter] Only fog.dll hostStubs are currently supported\n");
      return 7;
    }
    uint32_t ord = stubOrdinals[i];
    install_fog_stub(hFog, hD2Common, hD2Game, ord);
    /* If caller specified fog.dll:10047 as arena-free or fog.dll:10046, ensure both 10046 (Free) and 10047 (Realloc) are hooked */
    if (ord == 10047 && stubKinds[i] == 3) {
      install_fog_stub(hFog, hD2Common, hD2Game, 10046);
    }
  }

  HMODULE targetMod = (moduleId == 0) ? hD2Game : hD2Common;
  uintptr_t targetFnPtr = (uintptr_t)targetMod - get_pref_base(targetMod) + (uintptr_t)targetVa;

  FILE *fOut = fopen(outPath, "wb");
  if (!fOut) {
    fprintf(stderr, "[fn-emitter] cannot open output %s\n", outPath);
    return 2;
  }

  fprintf(fOut, "%s\n", headerJson);

  uint8_t *imgPreSnapshots[MAX_IMAGES];
  for (uint32_t j = 0; j < g_num_images; j++) {
    imgPreSnapshots[j] = (uint8_t *)malloc(g_images[j].size);
  }

  /* 4. Execute vectors */
  for (uint32_t vIdx = 0; vIdx < numVectors; vIdx++) {
    char *label = read_str(fReq, NULL);
    uint32_t regs[6];
    for (int r = 0; r < 6; r++) regs[r] = read_u32(fReq);
    uint32_t nStack = read_u32(fReq);
    if (nStack > MAX_STACK) return 2;
    uint32_t stackArgs[MAX_STACK];
    for (uint32_t s = 0; s < nStack; s++) stackArgs[s] = read_u32(fReq);

    /* Stage images into fixed arena */
    memset((void *)(uintptr_t)ARENA_BASE_ADDR, 0, ARENA_ALLOC_BASE - ARENA_BASE_ADDR);
    for (uint32_t j = 0; j < g_num_images; j++) {
      void *dst = (void *)(uintptr_t)g_images[j].addr;
      must_read(fReq, dst, g_images[j].size);
      memcpy(imgPreSnapshots[j], dst, g_images[j].size);
    }

    /* Read and apply global patches */
    uint32_t numGlobals = read_u32(fReq);
    if (numGlobals > MAX_GLOBALS) return 2;
    GlobalPatchState gStates[MAX_GLOBALS];
    for (uint32_t g = 0; g < numGlobals; g++) {
      gStates[g].va = read_u32(fReq);
      gStates[g].len = read_u32(fReq);
      gStates[g].realPtr = canon_va_to_ptr(gStates[g].va);
      gStates[g].patchBytes = (uint8_t *)malloc(gStates[g].len);
      gStates[g].origBytes = (uint8_t *)malloc(gStates[g].len);
      gStates[g].preBytes = (uint8_t *)malloc(gStates[g].len);
      gStates[g].postBytes = (uint8_t *)malloc(gStates[g].len);
      must_read(fReq, gStates[g].patchBytes, gStates[g].len);

      DWORD oldProt = 0;
      VirtualProtect((void *)gStates[g].realPtr, gStates[g].len, PAGE_EXECUTE_READWRITE, &oldProt);
      memcpy(gStates[g].origBytes, (const void *)gStates[g].realPtr, gStates[g].len);
      memcpy((void *)gStates[g].realPtr, gStates[g].patchBytes, gStates[g].len);
      memcpy(gStates[g].preBytes, (const void *)gStates[g].realPtr, gStates[g].len);
    }

    /* Read and snapshot pre-dumps */
    uint32_t numDumps = read_u32(fReq);
    if (numDumps > MAX_DUMPS) return 2;
    DumpState dStates[MAX_DUMPS];
    for (uint32_t d = 0; d < numDumps; d++) {
      dStates[d].len = read_u32(fReq);
      dStates[d].chainLen = read_u32(fReq);
      for (uint32_t k = 0; k < dStates[d].chainLen; k++) {
        dStates[d].chain[k] = read_i32(fReq);
      }
      uintptr_t rPtr = 0;
      uint32_t rVa = 0;
      dStates[d].valid = resolve_dump_chain(&dStates[d], &rVa, &rPtr);
      dStates[d].resolvedVa = rVa;
      dStates[d].preBytes = NULL;
      if (dStates[d].valid) {
        dStates[d].preBytes = (uint8_t *)malloc(dStates[d].len);
        memcpy(dStates[d].preBytes, (const void *)rPtr, dStates[d].len);
      }
    }

    /* Reset bump allocator */
    g_arena_alloc_cursor = ARENA_ALLOC_BASE;
    g_alloc_count = 0;
    g_free_count = 0;

    /* Stage thunk registers and stack args */
    g_thunk_target = (uint32_t)targetFnPtr;
    g_thunk_nargs = nStack;
    for (uint32_t s = 0; s < nStack; s++) g_thunk_args[s] = stackArgs[s];
    g_thunk_in_eax = regs[0];
    g_thunk_in_ecx = regs[1];
    g_thunk_in_edx = regs[2];
    g_thunk_in_ebx = regs[3];
    g_thunk_in_esi = regs[4];
    g_thunk_in_edi = regs[5];

    g_thunk_faulted = 0;
    g_thunk_in_call = 1;
    thunk_invoke();
    g_thunk_in_call = 0;

    int32_t espDelta = 0;
    if (g_thunk_faulted == 0) {
      espDelta = (int32_t)(g_thunk_esp_after_call - g_thunk_esp_before_call);
      if (espDelta != calleePops) {
        fprintf(stderr,
                "[fn-emitter] %s vec #%u (%s): espDelta mismatch: got %d, expected calleePops=%d\n",
                fnName, vIdx, label, (int)espDelta, (int)calleePops);
        fclose(fOut);
        return 5;
      }
    }

    /* Capture post bytes of globals and restore originals */
    for (uint32_t g = 0; g < numGlobals; g++) {
      memcpy(gStates[g].postBytes, (const void *)gStates[g].realPtr, gStates[g].len);
    }
    for (int g = (int)numGlobals - 1; g >= 0; g--) {
      memcpy((void *)gStates[g].realPtr, gStates[g].origBytes, gStates[g].len);
    }

    /* Serialize deterministic NDJSON line */
    fprintf(fOut, "{\"idx\":%u,\"label\":", vIdx);
    write_json_escaped(fOut, label);
    fprintf(fOut, ",\"fn\":");
    write_json_escaped(fOut, fnName);
    fprintf(fOut, ",\"va\":%u,\"frame\":%u,\"args\":[", targetVa, vIdx);
    for (uint32_t s = 0; s < nStack; s++) {
      if (s > 0) fputc(',', fOut);
      fprintf(fOut, "%u", stackArgs[s]);
    }
    fprintf(fOut, "],\"regs\":{\"eax\":%u,\"ecx\":%u,\"edx\":%u,\"ebx\":%u,\"esi\":%u,\"edi\":%u}",
            regs[0], regs[1], regs[2], regs[3], regs[4], regs[5]);

    if (g_thunk_faulted == 0) {
      if (returnsMode == 1) {
        fprintf(fOut, ",\"ret\":%d", (int32_t)g_thunk_out_eax);
      }
      fprintf(fOut, ",\"edx\":%d,\"espDelta\":%d,\"clobbers\":[",
              (int32_t)g_thunk_out_edx, (int)espDelta);
      int firstClob = 1;
      if (g_thunk_out_ebx != regs[3]) {
        fprintf(fOut, "%s\"ebx\"", firstClob ? "" : ",");
        firstClob = 0;
      }
      if (g_thunk_out_esi != regs[4]) {
        fprintf(fOut, "%s\"esi\"", firstClob ? "" : ",");
        firstClob = 0;
      }
      if (g_thunk_out_edi != regs[5]) {
        fprintf(fOut, "%s\"edi\"", firstClob ? "" : ",");
        firstClob = 0;
      }
      if (g_thunk_out_ebp != g_thunk_saved_ebp) {
        fprintf(fOut, "%s\"ebp\"", firstClob ? "" : ",");
        firstClob = 0;
      }
      fputc(']', fOut);
    } else if (g_thunk_faulted == 1) {
      fprintf(fOut,
              ",\"espDelta\":0,\"clobbers\":[],\"fault\":{\"kind\":\"exception\",\"code\":\"0x%08X\",\"eipVa\":\"0x%08X\",\"avAddr\":\"0x%08X\",\"avWrite\":%u}",
              g_fault_code, g_fault_eip_va, g_fault_av_addr, g_fault_av_write);
    } else {
      fprintf(fOut,
              ",\"espDelta\":0,\"clobbers\":[],\"fault\":{\"kind\":\"fogAssert\",\"code\":\"0x%08X\",\"eipVa\":\"0x%08X\",\"line\":%u}",
              g_fault_code, g_fault_eip_va, g_fault_line);
    }

    /* pre blocks */
    fputs(",\"pre\":[", fOut);
    int firstPre = 1;
    for (uint32_t j = 0; j < g_num_images; j++) {
      write_hex_pair(fOut, g_images[j].addr, imgPreSnapshots[j], g_images[j].size, &firstPre);
    }
    for (uint32_t g = 0; g < numGlobals; g++) {
      write_hex_pair(fOut, gStates[g].va, gStates[g].preBytes, gStates[g].len, &firstPre);
    }
    for (uint32_t d = 0; d < numDumps; d++) {
      if (dStates[d].valid) {
        write_hex_pair(fOut, dStates[d].resolvedVa, dStates[d].preBytes, dStates[d].len, &firstPre);
      }
    }

    /* post blocks */
    fputs("],\"post\":[", fOut);
    int firstPost = 1;
    for (uint32_t j = 0; j < g_num_images; j++) {
      write_hex_pair(fOut, g_images[j].addr, (const uint8_t *)(uintptr_t)g_images[j].addr, g_images[j].size, &firstPost);
    }
    for (uint32_t g = 0; g < numGlobals; g++) {
      write_hex_pair(fOut, gStates[g].va, gStates[g].postBytes, gStates[g].len, &firstPost);
    }
    for (uint32_t d = 0; d < numDumps; d++) {
      uintptr_t rPtr = 0;
      uint32_t rVa = 0;
      if (resolve_dump_chain(&dStates[d], &rVa, &rPtr)) {
        write_hex_pair(fOut, rVa, (const uint8_t *)rPtr, dStates[d].len, &firstPost);
      }
    }
    for (uint32_t a = 0; a < g_alloc_count; a++) {
      write_hex_pair(fOut, g_allocs[a].addr, (const uint8_t *)(uintptr_t)g_allocs[a].addr, g_allocs[a].size, &firstPost);
    }

    /* allocs and frees */
    fputs("],\"allocs\":[", fOut);
    for (uint32_t a = 0; a < g_alloc_count; a++) {
      if (a > 0) fputc(',', fOut);
      fprintf(fOut, "[%u,%u]", g_allocs[a].size, g_allocs[a].addr);
    }
    fputs("],\"frees\":[", fOut);
    for (uint32_t fr = 0; fr < g_free_count; fr++) {
      if (fr > 0) fputc(',', fOut);
      fprintf(fOut, "%u", g_frees[fr]);
    }
    fputs("]}\n", fOut);

    /* Free per-vector buffers */
    free(label);
    for (uint32_t g = 0; g < numGlobals; g++) {
      free(gStates[g].patchBytes);
      free(gStates[g].origBytes);
      free(gStates[g].preBytes);
      free(gStates[g].postBytes);
    }
    for (uint32_t d = 0; d < numDumps; d++) {
      if (dStates[d].preBytes) free(dStates[d].preBytes);
    }
  }

  fflush(fOut);
  fclose(fOut);
  fclose(fReq);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
