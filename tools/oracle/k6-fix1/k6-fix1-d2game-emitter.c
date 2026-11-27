/*
 * k6-fix1-d2game-emitter.c — [K6] Fix 1 Real-DLL Differential Emitter (47 Unlocked D2Game.dll VAs)
 *
 * Loads real Diablo II: Lord of Destruction v1.13c DLLs (Storm.dll, Fog.dll,
 * D2Lang.dll, D2CMP.dll, D2Common.dll, D2Net.dll, D2Game.dll) under headless Wine,
 * hydrates canonical sgptDataTables (0x20000000..0x206F7FFF + D2Common .data/.bss)
 * from d2game-datatbls-113c.img, hooks Fog.#10024 (assert) and Fog.#10042..10047
 * (deterministic bump allocator with per-allocation realloc size tracking), and
 * executes all 47 net-new real D2Game.dll VAs unlocked by the 9 kernel parity fixes
 * (>= 3 non-degenerate cases per VA).
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define D2COM_PREF_BASE   0x6FD50000u
#define D2GAME_PREF_BASE  0x6FC20000u

#define DATATBLS_BASE     0x20000000u
#define DATATBLS_SIZE     0x00800000u

#define STAGE_BASE        0x30000000u
#define STAGE_FIXED_SIZE  0x00009000u
#define STAGE_SETUP_BASE  0x30020000u
#define STAGE_TOTAL_SIZE  0x00040000u

#define HEAP_BASE         0x40000000u
#define HEAP_SIZE         0x00200000u

/* Fixed staged object addresses inside 0x30000000..0x30008FFF */
#define STAGE_GAME        (STAGE_BASE + 0x0000u) /* 0x2000: D2GameStrc */
#define STAGE_CLIENT      (STAGE_BASE + 0x2000u) /* 0x0600: D2ClientStrc #0 */
#define STAGE_PKTNODE0    (STAGE_BASE + 0x2600u) /* 0x0210: D2PacketDataStrc #0 */
#define STAGE_PKTNODE1    (STAGE_BASE + 0x2810u) /* 0x0210: D2PacketDataStrc #1 */
#define STAGE_UNIT0       (STAGE_BASE + 0x3000u) /* 0x0200: primary D2UnitStrc */
#define STAGE_UDATA0      (STAGE_BASE + 0x3200u) /* 0x0200: primary unit data */
#define STAGE_UNIT1       (STAGE_BASE + 0x3400u) /* 0x0200: secondary D2UnitStrc */
#define STAGE_UDATA1      (STAGE_BASE + 0x3600u) /* 0x0200: secondary unit data */
#define STAGE_UNIT2       (STAGE_BASE + 0x3800u) /* 0x0200: tertiary D2UnitStrc */
#define STAGE_UDATA2      (STAGE_BASE + 0x3A00u) /* 0x0200: tertiary unit data */
#define STAGE_PATH0       (STAGE_BASE + 0x4000u) /* 0x0300: path for UNIT0 */
#define STAGE_PATH1       (STAGE_BASE + 0x4300u) /* 0x0300: path for UNIT1 */
#define STAGE_PATH2       (STAGE_BASE + 0x4600u) /* 0x0300: path for UNIT2 */
#define STAGE_ROOM0       (STAGE_BASE + 0x5000u) /* 0x0100: D2ActiveRoomStrc #0 */
#define STAGE_ROOMEX0     (STAGE_BASE + 0x5100u) /* 0x0100: D2RoomExStrc #0 */
#define STAGE_LEVEL0      (STAGE_BASE + 0x5200u) /* 0x0200: D2DrlgLevelStrc #0 */
#define STAGE_ROOM1       (STAGE_BASE + 0x5400u) /* 0x0100: D2ActiveRoomStrc #1 */
#define STAGE_ROOMEX1     (STAGE_BASE + 0x5500u) /* 0x0100: D2RoomExStrc #1 */
#define STAGE_LEVEL1      (STAGE_BASE + 0x5600u) /* 0x0200: D2DrlgLevelStrc #1 */
#define STAGE_ACT0        (STAGE_BASE + 0x5800u) /* 0x0100: D2ActStrc #0 */
#define STAGE_ACT1        (STAGE_BASE + 0x5900u) /* 0x0100: D2ActStrc #1 */
#define STAGE_DRLG0       (STAGE_BASE + 0x5A00u) /* 0x0500: D2DrlgStrc #0 */
#define STAGE_DMG         (STAGE_BASE + 0x6000u) /* 0x0100: D2DamageStrc */
#define STAGE_QUESTCTRL   (STAGE_BASE + 0x6100u) /* 0x0100: pQuestControl */
#define STAGE_QUEST0      (STAGE_BASE + 0x6200u) /* 0x0200: D2QuestDataStrc */
#define STAGE_QUESTEX0    (STAGE_BASE + 0x6400u) /* 0x0200: pQuestDataEx */
#define STAGE_PARTYCTRL   (STAGE_BASE + 0x6A00u) /* 0x0200: pPartyControl + nodes */
#define STAGE_SCRATCH     (STAGE_BASE + 0x8000u) /* 0x1000: out-params / packets / ctx */

#define U32(addr) (*(volatile uint32_t *)((uintptr_t)(addr)))
#define U16(addr) (*(volatile uint16_t *)((uintptr_t)(addr)))
#define U8(addr)  (*(volatile uint8_t  *)((uintptr_t)(addr)))
#define S32(addr) (*(volatile int32_t  *)((uintptr_t)(addr)))
#define S16(addr) (*(volatile int16_t  *)((uintptr_t)(addr)))

#define MAX_STACK 12

static HMODULE g_hFog  = NULL;
static HMODULE g_hCom  = NULL;
static HMODULE g_hGame = NULL;
static uintptr_t g_com_rebase  = 0;
static uintptr_t g_game_rebase = 0;

/* Allocator cursor: points into STAGE_SETUP_BASE during setup, HEAP_BASE during call */
static int g_in_setup_phase = 1;
static uint32_t g_setup_top = STAGE_SETUP_BASE;
static uint32_t g_heap_top  = HEAP_BASE;

/* D2Common helper function pointers (resolved via ordinal on g_hCom) */
typedef void *(__stdcall *Com_CreateStatListEx_t)(void *pOwner, uint32_t flags, void *pfnCb, void *pGame);
typedef void  (__stdcall *Com_SetUnitStat_t)(void *pUnit, int32_t statId, int32_t val, int32_t layer);
typedef void *(__stdcall *Com_AllocStatList_t)(void *pPool, uint32_t flags, uint32_t timeout, int32_t uType, int32_t guid);
typedef int32_t(__stdcall *Com_SetStatIfValid_t)(void *pList, int32_t statId, int32_t val, uint32_t param);
typedef void  (__stdcall *Com_SetStatListState_t)(void *pList, int32_t state);
typedef void  (__stdcall *Com_MergeStatLists_t)(void *pUnit, void *pSubList, int32_t bType);
typedef void  (__stdcall *Com_ToggleGfxState_t)(void *pUnit, int32_t state, int32_t bSet);
typedef void *(__stdcall *Com_AllocSkillList_t)(void *pPool);
typedef void  (__stdcall *Com_SetSkillLevel_t)(void *pUnit, int32_t skId, int32_t lvl, int32_t bRem, int32_t u5, int32_t u6);
typedef int32_t(__stdcall *Com_HasObjectSubClassBit0_t)(void *pUnit);
typedef void  (__stdcall *Com_PathSetTargetUnit_t)(void *pPath, void *pTarget);

static Com_CreateStatListEx_t      fn_CreateStatListEx      = NULL;
static Com_SetUnitStat_t           fn_SetUnitStat           = NULL;
static Com_AllocStatList_t         fn_AllocStatList         = NULL;
static Com_SetStatIfValid_t        fn_SetStatIfValid        = NULL;
static Com_SetStatListState_t      fn_SetStatListState      = NULL;
static Com_MergeStatLists_t        fn_MergeStatLists        = NULL;
static Com_ToggleGfxState_t        fn_ToggleGfxState        = NULL;
static Com_AllocSkillList_t        fn_AllocSkillList        = NULL;
static Com_SetSkillLevel_t         fn_SetSkillLevel         = NULL;
static Com_HasObjectSubClassBit0_t fn_HasObjectSubClassBit0 = NULL;
static Com_PathSetTargetUnit_t     fn_PathSetTargetUnit     = NULL;

/* Discovered canonical table IDs */
static uint32_t g_obj_sub0     = 0;
static uint32_t g_obj_nonsub0  = 0;
static uint32_t g_obj_alt_anim = 0;

/* ------------------------------- Generic Register+Stack Thunk & VEH */

uint32_t g_thunk_target = 0;
uint32_t g_thunk_nargs  = 0;
uint32_t g_thunk_args[MAX_STACK];
uint32_t g_thunk_in_eax = 0;
uint32_t g_thunk_in_ecx = 0;
uint32_t g_thunk_in_edx = 0;
uint32_t g_thunk_in_ebx = 0;
uint32_t g_thunk_in_esi = 0;
uint32_t g_thunk_in_edi = 0;

uint32_t g_thunk_out_eax    = 0;
uint32_t g_thunk_saved_esp  = 0;
uint32_t g_thunk_saved_ebp  = 0;
uint32_t g_thunk_esp_before = 0;
uint32_t g_thunk_esp_after  = 0;

volatile LONG g_thunk_in_call = 0;
volatile LONG g_thunk_faulted = 0; /* 0 = ok, 1 = hw exception, 2 = Fog.#10024 assert */
uint32_t g_fault_code  = 0;
uint32_t g_fault_eip   = 0;
uint32_t g_fault_addr  = 0;
uint32_t g_assert_line = 0;
uint32_t g_assert_a2   = 0;
static uint32_t g_total_emitted = 0;

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
      /* Scrub 0x280 bytes below ESP for -O2 == -fno-omit-frame-pointer == -O1 parity */
      "leal -0x280(%esp), %edi\n\t"
      "xorl %eax, %eax\n\t"
      "movl $0xA0, %ecx\n\t"
      "cld\n\t"
      "rep stosl\n\t"
      "movl %esp, _g_thunk_esp_before\n\t"
      "movl _g_thunk_in_eax, %eax\n\t"
      "movl _g_thunk_in_ecx, %ecx\n\t"
      "movl _g_thunk_in_edx, %edx\n\t"
      "movl _g_thunk_in_ebx, %ebx\n\t"
      "movl _g_thunk_in_esi, %esi\n\t"
      "movl _g_thunk_in_edi, %edi\n\t"
      "call *_g_thunk_target\n\t"
      "movl %esp, _g_thunk_esp_after\n\t"
      "movl %eax, _g_thunk_out_eax\n\t"
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

void record_fog_assert(void) {
  g_thunk_in_call = 0;
  g_thunk_faulted = 2;
  g_assert_line = g_assert_a2;
}

__attribute__((naked)) static void stub_fog_10024(void) {
  __asm__ volatile(
      "movl 12(%esp), %eax\n\t"
      "movl %eax, _g_assert_a2\n\t"
      "call _record_fog_assert\n\t"
      "jmp _thunk_resume\n\t");
}

static LONG CALLBACK k6_veh(EXCEPTION_POINTERS *ep) {
  DWORD code = ep->ExceptionRecord->ExceptionCode;
  if (!g_thunk_in_call) {
    if (code == EXCEPTION_ACCESS_VIOLATION ||
        code == EXCEPTION_INT_DIVIDE_BY_ZERO ||
        code == EXCEPTION_INT_OVERFLOW ||
        code == EXCEPTION_ILLEGAL_INSTRUCTION) {
      uintptr_t eip = (uintptr_t)ep->ExceptionRecord->ExceptionAddress;
      uintptr_t gameOff = (g_hGame && eip >= (uintptr_t)g_hGame && eip < (uintptr_t)g_hGame + 0x130000u)
                              ? (eip - g_game_rebase) : 0u;
      uintptr_t comOff  = (g_hCom && eip >= (uintptr_t)g_hCom && eip < (uintptr_t)g_hCom + 0xA5000u)
                              ? (eip - g_com_rebase) : 0u;
      uint32_t avAddr = (ep->ExceptionRecord->NumberParameters >= 2)
                            ? (uint32_t)ep->ExceptionRecord->ExceptionInformation[1] : 0u;
      CONTEXT *ctx = ep->ContextRecord;
      fprintf(stderr,
              "[k6-fix1] SETUP/INIT FAULT after %u emitted: code=0x%08lX eip=%p (game=0x%08lX com=0x%08lX) addr=0x%08X esp=0x%08lX ebp=0x%08lX eax=0x%08lX ecx=0x%08lX edx=0x%08lX [esp]=0x%08X\n",
              g_total_emitted, (unsigned long)code, (void *)eip,
              (unsigned long)gameOff, (unsigned long)comOff, avAddr,
              (unsigned long)ctx->Esp, (unsigned long)ctx->Ebp,
              (unsigned long)ctx->Eax, (unsigned long)ctx->Ecx, (unsigned long)ctx->Edx,
              (ctx->Esp ? U32(ctx->Esp) : 0u));
      fflush(stderr);
      TerminateProcess(GetCurrentProcess(), 99);
    }
    return EXCEPTION_CONTINUE_SEARCH;
  }
  if (code == EXCEPTION_ACCESS_VIOLATION ||
      code == EXCEPTION_INT_DIVIDE_BY_ZERO ||
      code == EXCEPTION_INT_OVERFLOW ||
      code == EXCEPTION_ILLEGAL_INSTRUCTION) {
    g_thunk_in_call = 0;
    g_thunk_faulted = 1;
    g_fault_code = (uint32_t)code;
    g_fault_eip  = (uint32_t)(uintptr_t)ep->ExceptionRecord->ExceptionAddress;
    g_fault_addr = (ep->ExceptionRecord->NumberParameters >= 2)
                       ? (uint32_t)ep->ExceptionRecord->ExceptionInformation[1]
                       : 0u;
    ep->ContextRecord->Eip = (DWORD)(uintptr_t)thunk_resume;
    ep->ContextRecord->Esp = g_thunk_saved_esp;
    ep->ContextRecord->Ebp = g_thunk_saved_ebp;
    return EXCEPTION_CONTINUE_EXECUTION;
  }
  return EXCEPTION_CONTINUE_SEARCH;
}

/* ------------------------------- Deterministic Bump Allocator */

#define MAX_TRACKED_ALLOCS 512
static uint32_t g_alloc_ptr[MAX_TRACKED_ALLOCS];
static uint32_t g_alloc_size[MAX_TRACKED_ALLOCS];
static uint32_t g_alloc_count = 0;

static void record_alloc_size(uint32_t ptr, uint32_t sz) {
  if (g_alloc_count < MAX_TRACKED_ALLOCS) {
    g_alloc_ptr[g_alloc_count] = ptr;
    g_alloc_size[g_alloc_count] = sz;
    g_alloc_count++;
  }
}

static uint32_t lookup_alloc_size(uint32_t ptr, uint32_t fallback) {
  for (uint32_t i = g_alloc_count; i > 0; i--) {
    if (g_alloc_ptr[i - 1u] == ptr) return g_alloc_size[i - 1u];
  }
  return fallback;
}

static void *bump_alloc(uint32_t dwSize) {
  if (g_in_setup_phase) {
    uint32_t p = (g_setup_top + 3u) & ~3u;
    if (p + dwSize > STAGE_BASE + STAGE_TOTAL_SIZE) {
      fprintf(stderr, "[k6-fix1] setup bump overflow (size=%u)\n", dwSize);
      TerminateProcess(GetCurrentProcess(), 21);
    }
    memset((void *)(uintptr_t)p, 0, dwSize);
    g_setup_top = p + dwSize;
    record_alloc_size(p, dwSize);
    return (void *)(uintptr_t)p;
  } else {
    uint32_t p = (g_heap_top + 3u) & ~3u;
    if (p + dwSize > HEAP_BASE + HEAP_SIZE) {
      fprintf(stderr, "[k6-fix1] heap bump overflow (size=%u)\n", dwSize);
      TerminateProcess(GetCurrentProcess(), 22);
    }
    memset((void *)(uintptr_t)p, 0, dwSize);
    g_heap_top = p + dwSize;
    record_alloc_size(p, dwSize);
    return (void *)(uintptr_t)p;
  }
}

static void *__fastcall stub_fog_10042(uint32_t dwSize, const char *szFile, int nLine, int nZero) {
  (void)szFile; (void)nLine; (void)nZero;
  return bump_alloc(dwSize);
}

static int __fastcall stub_fog_10043(void *pMem, const char *szFile, int nLine, int nZero) {
  (void)pMem; (void)szFile; (void)nLine; (void)nZero;
  return 1;
}

static void *__fastcall stub_fog_10045(void *pPool, uint32_t dwSize, const char *szFile, int nLine, int nZero) {
  (void)pPool; (void)szFile; (void)nLine; (void)nZero;
  return bump_alloc(dwSize);
}

static int __fastcall stub_fog_10046(void *pPool, void *pMem, const char *szFile, int nLine, int nZero) {
  (void)pPool; (void)pMem; (void)szFile; (void)nLine; (void)nZero;
  return 1;
}

static void *__fastcall stub_fog_10047(void *pPool, void *pMem, uint32_t dwSize, const char *szFile, int nLine, int nZero) {
  (void)pPool; (void)szFile; (void)nLine; (void)nZero;
  if (dwSize == 0) return NULL;
  void *np = bump_alloc(dwSize);
  if (pMem) {
    uint32_t oldSz = lookup_alloc_size((uint32_t)(uintptr_t)pMem, dwSize);
    uint32_t copySz = oldSz < dwSize ? oldSz : dwSize;
    memcpy(np, pMem, copySz);
  }
  return np;
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

static void install_fog_hooks(void) {
  struct { uint32_t ord; void *fn; } hooks[] = {
    { 10024u, (void *)(uintptr_t)stub_fog_10024 },
    { 10042u, (void *)(uintptr_t)stub_fog_10042 },
    { 10043u, (void *)(uintptr_t)stub_fog_10043 },
    { 10045u, (void *)(uintptr_t)stub_fog_10045 },
    { 10046u, (void *)(uintptr_t)stub_fog_10046 },
    { 10047u, (void *)(uintptr_t)stub_fog_10047 },
  };
  for (size_t i = 0; i < sizeof(hooks) / sizeof(hooks[0]); i++) {
    void *orig = (void *)(uintptr_t)GetProcAddress(g_hFog, MAKEINTRESOURCEA(hooks[i].ord));
    if (!orig) {
      fprintf(stderr, "[k6-fix1] missing Fog.#%u\n", hooks[i].ord);
      TerminateProcess(GetCurrentProcess(), 23);
    }
    hook_module_iat_ptr(g_hCom, orig, hooks[i].fn);
    hook_module_iat_ptr(g_hGame, orig, hooks[i].fn);
  }
}

/* ------------------------------- PAGEIMG Loader (d2game-datatbls-113c.img) */

static void load_datatbls_img(const char *imgPath) {
  FILE *fp = fopen(imgPath, "rb");
  if (!fp) {
    fprintf(stderr, "[k6-fix1] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-fix1] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(0x6FDE9000u + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-fix1] short read at page %u\n", i);
      TerminateProcess(GetCurrentProcess(), 12);
    }
    uint32_t va = *(const uint32_t *)pageBuf;
    const uint8_t *data = pageBuf + 4;
    if (va >= DATATBLS_BASE && va + 4096u <= DATATBLS_BASE + DATATBLS_SIZE) {
      memcpy((void *)(uintptr_t)va, data, 4096u);
    } else if (va >= 0x6FDE9000u && va <= 0x6FDF2000u) {
      memcpy((void *)(uintptr_t)(va + g_com_rebase), data, 4096u);
    }
  }
  fclose(fp);
}

/* ------------------------------- Pre/Post Snapshot & NDJSON Emission */

static char g_pre_json[131072];

static void format_mem_runs_range(char *out, size_t cap, size_t *pLen, uint32_t startAddr, uint32_t endAddr, int *pFirst) {
  static const char hexChars[] = "0123456789abcdef";
  uint32_t a = startAddr;
  while (a < endAddr) {
    uint32_t chunkEnd = (a + 16u <= endAddr) ? (a + 16u) : endAddr;
    int nz = 0;
    for (uint32_t k = a; k < chunkEnd; k++) {
      if (U8(k) != 0u) { nz = 1; break; }
    }
    if (!nz) {
      a = chunkEnd;
      continue;
    }
    uint32_t runStart = a;
    uint32_t runEnd = chunkEnd;
    while (runEnd < endAddr && (runEnd - runStart) < 512u) {
      uint32_t nextEnd = (runEnd + 16u <= endAddr) ? (runEnd + 16u) : endAddr;
      int nextNz = 0;
      for (uint32_t k = runEnd; k < nextEnd; k++) {
        if (U8(k) != 0u) { nextNz = 1; break; }
      }
      if (!nextNz) break;
      runEnd = nextEnd;
    }
    uint32_t len = runEnd - runStart;
    if (*pLen + 48u + len * 2u >= cap) {
      fprintf(stderr, "[k6-fix1] JSON buffer overflow\n");
      TerminateProcess(GetCurrentProcess(), 25);
    }
    *pLen += (size_t)snprintf(out + *pLen, cap - *pLen,
                              "%s{\"addr\":\"0x%08X\",\"hex\":\"",
                              (*pFirst ? "" : ","), runStart);
    *pFirst = 0;
    for (uint32_t k = runStart; k < runEnd; k++) {
      uint8_t b = U8(k);
      out[(*pLen)++] = hexChars[(b >> 4) & 0xFu];
      out[(*pLen)++] = hexChars[b & 0xFu];
    }
    out[(*pLen)++] = '"';
    out[(*pLen)++] = '}';
    out[*pLen] = '\0';
    a = runEnd;
  }
}

static void capture_stage_json(char *out, size_t cap, uint32_t setupTop) {
  size_t len = 0;
  int first = 1;
  out[len++] = '[';
  out[len] = '\0';
  format_mem_runs_range(out, cap, &len, STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE, &first);
  if (setupTop > STAGE_SETUP_BASE) {
    format_mem_runs_range(out, cap, &len, STAGE_SETUP_BASE, setupTop, &first);
  }
  out[len++] = ']';
  out[len] = '\0';
}

/* ------------------------------- Staged World Builders */

static void reset_case(void) {
  memset((void *)(uintptr_t)STAGE_BASE, 0, STAGE_FIXED_SIZE);
  g_in_setup_phase = 1;
  g_setup_top = STAGE_SETUP_BASE;
  g_heap_top = HEAP_BASE;
  g_alloc_count = 0;

  /* Default pGame difficulty = 0, expansion = 1, dwGameFrame = 100 */
  U8(STAGE_GAME + 0x6Du)  = 0u;
  U32(STAGE_GAME + 0x70u) = 1u;
  U32(STAGE_GAME + 0xA8u) = 100u;

  /* Pre-link 2 clean 0x208-byte S2C packet nodes on STAGE_CLIENT free-list (+0x1C0) */
  U32(STAGE_PKTNODE0 + 0x204u) = STAGE_PKTNODE1;
  U32(STAGE_CLIENT + 0x1C0u)   = STAGE_PKTNODE0;
  U32(STAGE_CLIENT + 0x1A8u)   = STAGE_GAME;
}

static uint32_t stage_timer_queue(void) {
  uint32_t pTimer = (uint32_t)(uintptr_t)bump_alloc(0xA20u);
  uint32_t pChunk = (uint32_t)(uintptr_t)bump_alloc(0x7088u);
  for (uint32_t i = 0; i < 7u; i++) {
    U32(pChunk + i * 0x30u + 0x1Cu) = pChunk + (i + 1u) * 0x30u;
  }
  U32(pChunk + 0x7080u) = pChunk;
  U32(pTimer + 0xA1Cu)  = pChunk;
  U32(STAGE_GAME + 0xB8u) = pTimer;
  return pTimer;
}

static uint32_t stage_extra_client(void) {
  uint32_t pCli = (uint32_t)(uintptr_t)bump_alloc(0x600u);
  uint32_t pN0  = (uint32_t)(uintptr_t)bump_alloc(0x210u);
  uint32_t pN1  = (uint32_t)(uintptr_t)bump_alloc(0x210u);
  U32(pN0 + 0x204u)  = pN1;
  U32(pCli + 0x1C0u) = pN0;
  U32(pCli + 0x1A8u) = STAGE_GAME;
  return pCli;
}

static void stage_room(uint32_t pRoom, uint32_t pRoomEx, uint32_t pLevel, uint32_t levelId) {
  uint32_t pAct = (pRoom == STAGE_ROOM1) ? STAGE_ACT1 : STAGE_ACT0;
  U32(pAct + 0x08u)         = 1u; /* dwTownId */
  U32(pAct + 0x10u)         = pRoom;
  U32(pAct + 0x48u)         = STAGE_DRLG0;
  U32(STAGE_DRLG0 + 0x47Cu) = pLevel;
  if (U32(STAGE_GAME + 0xBCu) == 0u) {
    U32(STAGE_GAME + 0xBCu) = pAct;
  }
  U32(pRoom + 0x10u)    = pRoomEx;
  U32(pRoom + 0x2Cu)    = pAct;
  U32(pRoom + 0x4Cu)    = 4800u;
  U32(pRoom + 0x50u)    = 4800u;
  U32(pRoom + 0x54u)    = 1000u;
  U32(pRoom + 0x58u)    = 1000u;
  U32(pRoomEx + 0x30u)  = pRoom;
  U32(pRoomEx + 0x58u)  = pLevel;
  U32(pLevel + 0x1B4u)  = STAGE_DRLG0;
  U32(pLevel + 0x1D0u)  = levelId;
}

static void stage_dynamic_path(uint32_t pUnit, uint32_t pPath, uint32_t pRoom, uint16_t x, uint16_t y) {
  U32(pUnit + 0x2Cu)  = pPath;
  U16(pPath + 0x00u)  = 0x8000u;
  U16(pPath + 0x02u)  = x;
  U16(pPath + 0x04u)  = 0x8000u;
  U16(pPath + 0x06u)  = y;
  U32(pPath + 0x1Cu)  = pRoom;
  U32(pPath + 0x30u)  = pUnit;
  U32(pPath + 0x7Cu)  = 0x1800u;
}

static void stage_static_path(uint32_t pUnit, uint32_t pPath, uint32_t pRoom, int32_t x, int32_t y) {
  U32(pUnit + 0x2Cu) = pPath;
  U32(pPath + 0x00u) = pRoom;
  S32(pPath + 0x04u) = x;
  S32(pPath + 0x08u) = y;
  S32(pPath + 0x0Cu) = x;
  S32(pPath + 0x10u) = y;
}

static void insert_server_unit(uint32_t pGame, uint32_t pUnit) {
  static const uint32_t kHashOff[6] = { 0x1120u, 0x1320u, 0x1520u, 0x1920u, 0x1720u, 0x1B20u };
  uint32_t uType = U32(pUnit + 0x00u);
  if (uType >= 6u) return;
  uint32_t guid = U32(pUnit + 0x0Cu);
  uint32_t headAddr = (uType == 5u)
                          ? (pGame + kHashOff[uType])
                          : (pGame + kHashOff[uType] + ((guid & 0x7Fu) << 2));
  uint32_t prev = 0u;
  uint32_t cur = U32(headAddr);
  while (cur != 0u && U32(cur + 0x0Cu) > guid) {
    prev = cur;
    cur = U32(cur + 0xE4u);
  }
  U32(pUnit + 0xE4u) = cur;
  if (prev == 0u) {
    U32(headAddr) = pUnit;
  } else {
    U32(prev + 0xE4u) = pUnit;
  }
}

static void stage_unit_common(
    uint32_t pUnit, uint32_t pUData, uint32_t pPath, uint32_t pRoom,
    uint32_t uType, uint32_t classId, uint32_t guid, uint32_t mode,
    uint16_t x, uint16_t y, uint32_t seedLo) {
  uint32_t pAct = (pRoom == STAGE_ROOM1) ? STAGE_ACT1 : STAGE_ACT0;
  U32(pUnit + 0x00u) = uType;
  U32(pUnit + 0x04u) = classId;
  U32(pUnit + 0x0Cu) = guid;
  U32(pUnit + 0x10u) = mode;
  U32(pUnit + 0x14u) = pUData;
  U8(pUnit + 0x18u)  = 0u;
  U32(pUnit + 0x1Cu) = pAct;
  U32(pUnit + 0x20u) = seedLo ? seedLo : 0x12345679u;
  U32(pUnit + 0x24u) = 0x0000029Au;
  U32(pUnit + 0x28u) = seedLo ? seedLo : 0x12345679u;
  U32(pUnit + 0x80u) = STAGE_GAME;
  U32(pUnit + 0xC4u) = 0x00000004u; /* UNITFLAG_CANBEATTACKED */
  if (pPath != 0u) {
    if (uType == 2u || uType == 4u || uType == 5u) {
      stage_static_path(pUnit, pPath, pRoom, (int32_t)x, (int32_t)y);
    } else {
      stage_dynamic_path(pUnit, pPath, pRoom, x, y);
    }
  }
  if (uType == 2u && pUData != 0u) {
    uint32_t pObjectsBase = U32(0x6FDF0B94u + g_com_rebase);
    uint32_t nObjectsCnt  = U32(0x6FDF0B98u + g_com_rebase);
    if (classId < nObjectsCnt) {
      U32(pUData + 0x00u) = pObjectsBase + classId * 0x1C0u;
    }
  }
  fn_CreateStatListEx((void *)(uintptr_t)pUnit, 0u, NULL, (void *)(uintptr_t)STAGE_GAME);
}

static void stage_monster_full(
    uint32_t pUnit, uint32_t pUData, uint32_t pPath, uint32_t pRoom,
    uint32_t classId, uint32_t guid, uint32_t mode,
    uint16_t x, uint16_t y, uint32_t seedLo) {
  stage_unit_common(pUnit, pUData, pPath, pRoom, 1u, classId, guid, mode, x, y, seedLo);
  if (pUData != 0u) {
    uint32_t pTables = U32(0x6FDE9E1Cu + g_com_rebase);
    uint32_t pMonBase = U32(pTables + 0xA78u);
    uint32_t nMonCnt  = U32(pTables + 0xA80u);
    if (classId < nMonCnt) {
      U32(pUData + 0x00u) = pMonBase + classId * 0x1A8u;
    }
    uint32_t pAiGen  = (uint32_t)(uintptr_t)bump_alloc(0x40u);
    uint32_t pAiCtrl = (uint32_t)(uintptr_t)bump_alloc(0x40u);
    U32(pUData + 0x28u) = pAiGen;
    U32(pUData + 0x2Cu) = pAiCtrl;
  }
}

static void stage_party_player(
    uint32_t pUnit, uint32_t pUData, uint32_t pPath, uint32_t pRoom,
    uint32_t pCli, uint32_t guid, const char *name, int32_t level) {
  stage_unit_common(pUnit, pUData, pPath, pRoom, 0u, 0u, guid, 1u, 5000u, 5000u, 0x2000u + guid);
  strcpy((char *)(uintptr_t)pUData, name);
  U32(pUData + 0x9Cu) = pCli;
  if (pCli != 0u) {
    U32(pCli + 0x04u)   = 4u;
    U32(pCli + 0x16Cu)  = 0u;
    U32(pCli + 0x170u)  = guid;
    U32(pCli + 0x174u)  = pUnit;
    U32(pCli + 0x1A8u)  = STAGE_GAME;
    U32(pCli + 0x3D4u)  = 1u;
  }
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 12, level, 0);
  insert_server_unit(STAGE_GAME, pUnit);
}

static uint32_t stage_subparty(uint16_t partyId, uint32_t guid1, uint32_t guid2) {
  U32(STAGE_GAME + 0x1D2Cu) = STAGE_PARTYCTRL;
  uint32_t pSub = (uint32_t)(uintptr_t)bump_alloc(0x20u);
  U16(pSub + 0x00u) = partyId;
  uint32_t pM1 = (uint32_t)(uintptr_t)bump_alloc(0x10u);
  U32(pM1 + 0x00u) = guid1;
  if (guid2 != 0u) {
    uint32_t pM2 = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U32(pM2 + 0x00u) = guid2;
    U32(pM1 + 0x04u) = pM2;
  }
  U32(pSub + 0x04u) = pM1;
  U32(STAGE_PARTYCTRL + 0x00u) = (uint32_t)(partyId + 1u);
  U32(STAGE_PARTYCTRL + 0x04u) = pSub;
  return pSub;
}

static void stage_relation_node(uint32_t pPlayerData, uint32_t otherGuid, uint32_t flags, uint16_t state) {
  uint32_t pRel = (uint32_t)(uintptr_t)bump_alloc(0x14u);
  U32(pRel + 0x00u) = otherGuid;
  U32(pRel + 0x04u) = flags;
  U16(pRel + 0x0Cu) = state;
  U32(pRel + 0x10u) = U32(pPlayerData + 0x38u);
  U32(pPlayerData + 0x38u) = pRel;
}

static uint32_t attach_skill(uint32_t pUnit, int32_t skillId, int32_t lvl) {
  if (U32(pUnit + 0xA8u) == 0u) {
    void *pList = fn_AllocSkillList(NULL);
    U32(pUnit + 0xA8u) = (uint32_t)(uintptr_t)pList;
  }
  fn_SetSkillLevel((void *)(uintptr_t)pUnit, skillId, lvl, 0, 0, 0);
  uint32_t pList = U32(pUnit + 0xA8u);
  uint32_t pSk = pList ? U32(pList + 0x04u) : 0u;
  while (pSk != 0u) {
    uint32_t pTxt = U32(pSk);
    if (pTxt != 0u && S16(pTxt) == (int16_t)skillId) return pSk;
    pSk = U32(pSk + 0x04u);
  }
  return 0u;
}

static void attach_combat_node(uint32_t pUnit, uint32_t attType, uint32_t attGuid) {
  uint32_t pNode = (uint32_t)(uintptr_t)bump_alloc(0x90u);
  U32(pNode + 0x04u) = attType;
  U32(pNode + 0x08u) = attGuid;
  U32(pNode + 0x84u) = U32(pUnit + 0xACu);
  U32(pUnit + 0xACu) = pNode;
}

/* ------------------------------- Call Execution & Vector Writer */

typedef struct {
  uint32_t eax, ecx, edx, ebx, esi, edi;
  uint32_t nargs;
  uint32_t args[MAX_STACK];
  uint32_t calleePop;
} X86CallSpec;

static X86CallSpec make_call(void) {
  X86CallSpec s;
  memset(&s, 0, sizeof(s));
  return s;
}

static FILE *g_out_fp = NULL;

static void run_and_emit(
    uint32_t canonVa,
    const char *fnName,
    int caseIdx,
    const char *label,
    const X86CallSpec *spec,
    const int64_t *tsArgs,
    uint32_t nTsArgs,
    uint32_t retMask,
    int expectAssert) {
  static char postJson[131072];
  static const char hexChars[] = "0123456789abcdef";

  uint32_t setupTop = (g_setup_top + 15u) & ~15u;
  capture_stage_json(g_pre_json, sizeof(g_pre_json), setupTop);

  g_in_setup_phase = 0;
  g_heap_top = HEAP_BASE;

  g_thunk_target = (uint32_t)((canonVa - D2GAME_PREF_BASE) + (uintptr_t)g_hGame);
  g_thunk_in_eax = spec->eax;
  g_thunk_in_ecx = spec->ecx;
  g_thunk_in_edx = spec->edx;
  g_thunk_in_ebx = spec->ebx;
  g_thunk_in_esi = spec->esi;
  g_thunk_in_edi = spec->edi;
  g_thunk_nargs  = spec->nargs;
  for (uint32_t i = 0; i < spec->nargs; i++) {
    g_thunk_args[i] = spec->args[i];
  }
  g_thunk_out_eax = 0;
  g_thunk_faulted = 0;
  g_assert_line   = 0;
  g_thunk_in_call = 1;

  thunk_invoke();
  g_thunk_in_call = 0;

  if (g_thunk_faulted == 1) {
    uintptr_t gameOff = (g_fault_eip >= (uintptr_t)g_hGame && g_fault_eip < (uintptr_t)g_hGame + 0x130000u)
                            ? (g_fault_eip - g_game_rebase)
                            : 0;
    fprintf(stderr,
            "[k6-fix1] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }

  if (expectAssert && g_thunk_faulted != 2) {
    fprintf(stderr, "[k6-fix1] EXPECTED ASSERT did not fire at %s (0x%08X) case %d (%s)\n",
            fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!expectAssert && g_thunk_faulted == 2) {
    fprintf(stderr, "[k6-fix1] UNEXPECTED Fog.#10024 assert line %u at %s (0x%08X) case %d (%s)\n",
            g_assert_line, fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 32);
  }

  if (g_thunk_faulted == 0) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-fix1] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
              fnName, canonVa, caseIdx, label, actualPop, spec->calleePop);
      TerminateProcess(GetCurrentProcess(), 33);
    }
  }

  capture_stage_json(postJson, sizeof(postJson), setupTop);

  fprintf(g_out_fp,
          "{\"va\":\"0x%08X\",\"name\":\"%s\",\"caseIdx\":%d,\"label\":\"%s\",\"tsArgs\":[",
          canonVa, fnName, caseIdx, label);
  for (uint32_t i = 0; i < nTsArgs; i++) {
    fprintf(g_out_fp, "%s%lld", (i == 0 ? "" : ","), (long long)tsArgs[i]);
  }
  uint32_t maskedRet = g_thunk_out_eax & retMask;
  fprintf(g_out_fp,
          "],\"retMask\":\"0x%08X\",\"asserted\":%s,\"assertLine\":%u,\"ret\":\"0x%08X\","
          "\"setupTop\":\"0x%08X\",\"preMem\":%s,\"postMem\":%s,\"heapTop\":\"0x%08X\",\"heapHex\":\"",
          retMask,
          (g_thunk_faulted == 2 ? "true" : "false"),
          (g_thunk_faulted == 2 ? g_assert_line : 0u),
          maskedRet,
          setupTop,
          g_pre_json,
          postJson,
          g_heap_top);
  for (uint32_t a = HEAP_BASE; a < g_heap_top; a++) {
    uint8_t b = U8(a);
    fputc(hexChars[(b >> 4) & 0xFu], g_out_fp);
    fputc(hexChars[b & 0xFu], g_out_fp);
  }
  fprintf(g_out_fp, "\"}\n");
  g_total_emitted++;
}

static void discover_table_ids(void) {
  reset_case();
  uint32_t nObjects = U32(0x6FDF0B98u + g_com_rebase);
  uint32_t pObjects = U32(0x6FDF0B94u + g_com_rebase);
  U32(STAGE_UNIT2 + 0x00u) = 2u;
  U32(STAGE_UNIT2 + 0x14u) = STAGE_UDATA2;
  for (uint32_t oid = 1; oid < nObjects; oid++) {
    U32(STAGE_UNIT2 + 0x04u)  = oid;
    U32(STAGE_UDATA2 + 0x00u) = pObjects + oid * 0x1C0u;
    int32_t hasBit0 = fn_HasObjectSubClassBit0((void *)(uintptr_t)STAGE_UNIT2);
    if (!g_obj_sub0 && hasBit0 != 0) g_obj_sub0 = oid;
    if (!g_obj_nonsub0 && hasBit0 == 0) g_obj_nonsub0 = oid;
    if (!g_obj_alt_anim && oid > 5u && hasBit0 == 0 && oid != g_obj_nonsub0) {
      uint32_t rec = pObjects + oid * 0x1C0u;
      if (U32(rec + 0xDCu) > 0u && U16(rec + 0xFAu) > 0u) {
        g_obj_alt_anim = oid;
      }
    }
    if (g_obj_sub0 && g_obj_nonsub0 && g_obj_alt_anim) break;
  }
}

/* =========================================================================
 * GROUP 1..3 — Bugs 1, 2, 3 (18 VAs): 0x5A bColor, Stack Scratch, 0x6FCAA3E0
 * ========================================================================= */
static void emit_group_1_to_3(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [01] 0x6FD10720 NET_SendPacket5A_PartyRelationEvent_6FD10720_113c (edx=dwParam, stack=[pClient, bAction], ret 8) */
  {
    static const uint32_t acts[5] = { 3u, 5u, 7u, 8u, 9u };
    static const char *lbls[5] = { "act3_color8", "act5_color0", "act7_color2", "act8_color4", "act9_color9" };
    for (int k = 0; k < 5; k++) {
      reset_case();
      c = make_call();
      uint32_t pCli = (k == 4) ? 0u : STAGE_CLIENT;
      c.edx = 0x100u + (uint32_t)k;
      c.nargs = 2; c.args[0] = pCli; c.args[1] = acts[k]; c.calleePop = 8u;
      ts[0] = (int64_t)c.edx; ts[1] = (int64_t)pCli; ts[2] = (int64_t)acts[k];
      run_and_emit(0x6FD10720u, "NET_SendPacket5A_PartyRelationEvent_6FD10720_113c", k,
                   k == 4 ? "null_client_act9" : lbls[k], &c, ts, 3, 0xFFFFFFFFu, 0);
    }
  }

  /* [02] 0x6FD10CD0 PARTY_DeclareHostility_6FD10CD0_113c (ecx=pGame, edx=pSrc, stack=[pDst], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t pCli1 = stage_extra_client();
    stage_party_player(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, STAGE_CLIENT, 201u, "HostileSrc", k == 1 ? 5 : 15);
    stage_party_player(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, pCli1, 202u, "HostileDst", 15);
    U32(STAGE_CLIENT + 0x4A8u) = pCli1;
    U32(STAGE_GAME + 0x88u)    = STAGE_CLIENT;
    uint32_t pDst = (k == 0) ? STAGE_UNIT0 : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = pDst; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pDst;
    run_and_emit(0x6FD10CD0u, "PARTY_DeclareHostility_6FD10CD0_113c", k,
                 k == 0 ? "self_noop" : k == 1 ? "lvl5_under9_noop" : "lvl15_declare_hostile", &c, ts, 3, 0u, 0);
  }

  /* [03] 0x6FD10870 PARTY_InvitePlayerToParty_6FD10870_113c (ecx=pGame, edx=pSrc, stack=[pDst, extra, outErr], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t pCli1 = stage_extra_client();
    stage_party_player(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, STAGE_CLIENT, 301u, "Inviter", 12);
    stage_party_player(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, pCli1, 302u, "Invitee", 12);
    if (k == 1) {
      stage_relation_node(STAGE_UDATA0, 302u, 0u, 4u);
      stage_relation_node(STAGE_UDATA1, 301u, 0u, 2u);
    } else if (k == 2) {
      stage_relation_node(STAGE_UDATA0, 302u, 0u, 2u);
      stage_relation_node(STAGE_UDATA1, 301u, 0u, 4u);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = STAGE_UNIT1; c.args[1] = 0u; c.args[2] = 0u; c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = 0; ts[4] = 0;
    run_and_emit(0x6FD10870u, "PARTY_InvitePlayerToParty_6FD10870_113c", k,
                 k == 0 ? "fresh_invite_5a" : k == 1 ? "already_state4" : "already_state2", &c, ts, 5, 0u, 0);
  }

  /* [04] 0x6FD10B90 PARTY_SyncJoinedPartyRelationsCallback_6FD10B90_113c (ecx=pGame, edx=pPlayer, stack=[pJoinCtx], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t pCli1 = stage_extra_client();
    stage_party_player(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, STAGE_CLIENT, 401u, "Mate", 10);
    stage_party_player(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, pCli1, 402u, "Joiner", 10);
    if (k != 2) {
      stage_subparty(3u, 401u, 402u);
    } else {
      U32(STAGE_GAME + 0x1D2Cu) = STAGE_PARTYCTRL;
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT1;
    U16(STAGE_SCRATCH + 0x08u) = 3u;
    uint32_t pArgPlr = (k == 1) ? STAGE_UNIT1 : STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = pArgPlr; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = pArgPlr; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FD10B90u, "PARTY_SyncJoinedPartyRelationsCallback_6FD10B90_113c", k,
                 k == 0 ? "same_party_send_5a_7" : k == 1 ? "joining_self" : "unpartied_skip_5a", &c, ts, 3, 0u, 0);
  }

  /* [05] 0x6FD10FF0 PARTY_DeclareHostilityBetweenPlayers_6FD10FF0_113c (eax=pTarget, stack=[pSource, pGame], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t pCli1 = stage_extra_client();
    stage_party_player(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, STAGE_CLIENT, 501u, "AttPlr", 15);
    stage_party_player(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, pCli1, 502u, "DefPlr", 15);
    U32(STAGE_CLIENT + 0x4A8u) = pCli1;
    U32(STAGE_GAME + 0x88u)    = STAGE_CLIENT;
    U32(STAGE_GAME + 0x1D2Cu)  = STAGE_PARTYCTRL;
    if (k == 2) {
      stage_subparty(5u, 502u, 0u);
    }
    uint32_t pSrc = (k == 0) ? 0u : STAGE_UNIT0;
    /* Disasm: push ebx; push ebp; mov ebp,[esp+0x10] (=args[1]=pSource); push esi; push edi; mov edi,[esp+0x14] (=args[0]=pGame). */
    c.eax = STAGE_UNIT1; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = pSrc; c.calleePop = 8u;
    ts[0] = STAGE_UNIT1; ts[1] = pSrc; ts[2] = STAGE_GAME;
    run_and_emit(0x6FD10FF0u, "PARTY_DeclareHostilityBetweenPlayers_6FD10FF0_113c", k,
                 k == 0 ? "null_src_assert_24" : k == 1 ? "unpartied_mutual_hostile" : "partied_target_broadcast",
                 &c, ts, 3, 0u, (k == 0 ? 1 : 0));
  }

  /* [06] 0x6FD10D50 PARTY_AcceptInviteAndSyncParty_6FD10D50_113c (ecx=pGame, edx=pAccepter, stack=[pInviter, u1, u2], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t pCli1 = stage_extra_client();
    stage_party_player(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, STAGE_CLIENT, 601u, "Accepter", 12);
    stage_party_player(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, pCli1, 602u, "Inviter", 12);
    U32(STAGE_CLIENT + 0x4A8u) = pCli1;
    U32(STAGE_GAME + 0x88u)    = STAGE_CLIENT;
    U32(STAGE_GAME + 0x1D2Cu)  = STAGE_PARTYCTRL;
    U32(STAGE_PARTYCTRL + 0x00u) = 1u;
    if (k == 1) {
      stage_relation_node(STAGE_UDATA0, 602u, 0u, 2u);
      stage_relation_node(STAGE_UDATA1, 601u, 0u, 4u);
    } else if (k == 2) {
      stage_subparty(4u, 602u, 0u);
      stage_relation_node(STAGE_UDATA0, 602u, 0u, 2u);
      stage_relation_node(STAGE_UDATA1, 601u, 0u, 4u);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = STAGE_UNIT1; c.args[1] = 0u; c.args[2] = 0u; c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = 0; ts[4] = 0;
    run_and_emit(0x6FD10D50u, "PARTY_AcceptInviteAndSyncParty_6FD10D50_113c", k,
                 k == 0 ? "no_invite_8b_only" : k == 1 ? "accept_create_party" : "accept_join_existing", &c, ts, 5, 0u, 0);
  }

  /* [07] 0x6FD10C60 PARTY_UpdateRelationFlagAndSyncRoster_6FD10C60_113c (eax=pTarget, ecx=pSource, edx=pGame, stack=[wMask, dwEn], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t pCli1 = stage_extra_client();
    stage_party_player(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, STAGE_CLIENT, 701u, "SrcA", 14);
    stage_party_player(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, pCli1, 702u, "TgtB", 18);
    if (k >= 1) {
      stage_relation_node(STAGE_UDATA0, 702u, 0x01u, 0u);
      stage_relation_node(STAGE_UDATA1, 701u, 0x00u, 0u);
    }
    uint32_t dwEn = (k == 1) ? 0u : 1u;
    c.eax = STAGE_UNIT1; c.ecx = STAGE_UNIT0; c.edx = STAGE_GAME;
    c.nargs = 2; c.args[0] = 0x01u; c.args[1] = dwEn; c.calleePop = 8u;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME; ts[3] = 0x01; ts[4] = dwEn;
    run_and_emit(0x6FD10C60u, "PARTY_UpdateRelationFlagAndSyncRoster_6FD10C60_113c", k,
                 k == 0 ? "enable_flag1" : k == 1 ? "disable_flag1" : "already_enabled_roster", &c, ts, 5, 0u, 0);
  }

  /* [08] 0x6FD10E80 PARTY_UpdateSquelchFlag04AndSyncRoster_6FD10E80_113c (ecx=pGame, edx=pSource, stack=[pTarget, dwEn, pOutErr], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t pCli1 = stage_extra_client();
    stage_party_player(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, STAGE_CLIENT, 801u, "SqlSrc", 11);
    stage_party_player(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, pCli1, 802u, "SqlTgt", 12);
    if (k >= 1) {
      stage_relation_node(STAGE_UDATA0, 802u, 0x04u, 0u);
      stage_relation_node(STAGE_UDATA1, 801u, 0x00u, 0u);
    }
    uint32_t dwEn = (k == 1) ? 0u : 1u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = STAGE_UNIT1; c.args[1] = dwEn; c.args[2] = 0u; c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = dwEn; ts[4] = 0;
    run_and_emit(0x6FD10E80u, "PARTY_UpdateSquelchFlag04AndSyncRoster_6FD10E80_113c", k,
                 k == 0 ? "squelch_on" : k == 1 ? "squelch_off" : "squelch_idempotent", &c, ts, 5, 0u, 0);
  }

  /* [09] 0x6FD10EE0 PARTY_UpdateMuteFlag02AndSyncRoster_6FD10EE0_113c (ecx=pGame, edx=pSource, stack=[pTarget, dwEn, pOutErr], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t pCli1 = stage_extra_client();
    stage_party_player(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, STAGE_CLIENT, 901u, "MuteSrc", 13);
    stage_party_player(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, pCli1, 902u, "MuteTgt", 14);
    if (k >= 1) {
      stage_relation_node(STAGE_UDATA0, 902u, 0x02u, 0u);
      stage_relation_node(STAGE_UDATA1, 901u, 0x00u, 0u);
    }
    uint32_t dwEn = (k == 1) ? 0u : 1u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = STAGE_UNIT1; c.args[1] = dwEn; c.args[2] = 0u; c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = dwEn; ts[4] = 0;
    run_and_emit(0x6FD10EE0u, "PARTY_UpdateMuteFlag02AndSyncRoster_6FD10EE0_113c", k,
                 k == 0 ? "mute_on" : k == 1 ? "mute_off" : "mute_idempotent", &c, ts, 5, 0u, 0);
  }

  /* [10] 0x6FCD9030 ACT4Q3_ActivateHarrogathWaypointForPlayer_6FCD9030_113c (stdcall [pGame, pPlayer], ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1001u, 1u, 5000u, 5000u, 1001u);
    uint8_t diff = (uint8_t)(k < 3 ? k : 0);
    U8(STAGE_GAME + 0x6Du) = diff;
    if (k < 3) {
      U32(STAGE_UDATA0 + 0x1Cu + (uint32_t)diff * 4u) = STAGE_SCRATCH + (uint32_t)diff * 0x20u;
    }
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FCD9030u, "ACT4Q3_ActivateHarrogathWaypointForPlayer_6FCD9030_113c", k,
                 k == 0 ? "diff0_norm" : k == 1 ? "diff1_nm" : k == 2 ? "diff2_hell" : "null_wp_assert_ed",
                 &c, ts, 2, 0u, (k == 3 ? 1 : 0));
  }

  /* [11] 0x6FCD3EB0 SKILLS_SrvSt_AllocZeroDamageCombatForTarget_6FCD3EB0_113c (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1101u, 1u, 5000u, 5000u, 1101u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 19u, 1102u, 1u, 5004u, 5000u, 1102u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 1) {
      fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT0);
    } else if (k == 2) {
      fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 6u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 6; ts[3] = 1;
    run_and_emit(0x6FCD3EB0u, "SKILLS_SrvSt_AllocZeroDamageCombatForTarget_6FCD3EB0_113c", k,
                 k == 0 ? "no_target_ret0" : k == 1 ? "self_target_ret0" : "valid_target_alloc_combat",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [12] 0x6FCAD120 NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c (eax=pTarget, ebx=pRecipient, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t pCli1 = stage_extra_client();
    stage_party_player(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, STAGE_CLIENT, 1201u, "RosA", 25);
    stage_party_player(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, pCli1, 1202u, "RosB", 30);
    if (k == 0) {
      stage_subparty(2u, 1201u, 1202u);
      stage_relation_node(STAGE_UDATA0, 1202u, 0x05u, 1u);
    }
    uint32_t pTgt = (k == 1) ? 0u : (k == 2 ? STAGE_UNIT0 : STAGE_UNIT1);
    uint32_t pRec = (k == 3) ? 0u : STAGE_UNIT0;
    c.eax = pTgt; c.ebx = pRec;
    ts[0] = pTgt; ts[1] = pRec;
    run_and_emit(0x6FCAD120u, "NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c", k,
                 k == 0 ? "full_roster_13" : k == 1 ? "null_target_13" : k == 2 ? "self_roster_13" : "null_recip_assert_fb4",
                 &c, ts, 2, 0xFFFFFFFFu, (k == 3 ? 1 : 0));
  }

  /* [13] 0x6FCAD570 NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c (esi=pClient, al=uType, edx=guid, cx=skId, stack=[bCount], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_party_player(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, STAGE_CLIENT, 1301u, "AmmoPlr", 20);
    if (k == 3) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 7, 1); /* STATE_MORPH */
    }
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    uint32_t guid = (k == 1) ? 9999u : 1301u;
    c.esi = pCli; c.eax = 0u; c.edx = guid; c.ecx = 12u;
    c.nargs = 1; c.args[0] = (uint32_t)(5u + k); c.calleePop = 4u;
    ts[0] = pCli; ts[1] = 0; ts[2] = guid; ts[3] = 12; ts[4] = 5 + k;
    run_and_emit(0x6FCAD570u, "NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c", k,
                 k == 0 ? "null_client_assert_996" : k == 1 ? "missing_unit_morph0" : k == 2 ? "found_morph0" : "found_morph1",
                 &c, ts, 5, 0xFFFFFFFFu, (k == 0 ? 1 : 0));
  }

  /* [14] 0x6FCAD5F0 NET_SendPacket21_UpdateUnitSkill_6FCAD5F0_113c (eax=pClient, esi=pUnit, bx=skId, stack=[bBaseLvl, bArg2], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_party_player(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, STAGE_CLIENT, 1401u, "SkPlr", 20);
    attach_skill(STAGE_UNIT0, 36, 5);
    if (k == 2) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 19u, 1402u, 1u, 5002u, 5002u, 1402u);
      attach_skill(STAGE_UNIT1, 36, 3);
      uint32_t pAiGen = U32(STAGE_UDATA1 + 0x28u);
      U32(pAiGen + 0x28u) = STAGE_GAME;
      U32(pAiGen + 0x2Cu) = 1401u;
      U32(pAiGen + 0x30u) = 0u; /* owned by STAGE_UNIT0 */
    }
    uint32_t pCli = (k == 1) ? STAGE_CLIENT : 0u;
    uint32_t pU   = (k == 0) ? 0u : (k == 1 ? STAGE_UNIT0 : STAGE_UNIT1);
    c.eax = pCli; c.esi = pU; c.ebx = 36u;
    c.nargs = 2; c.args[0] = 5u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = pCli; ts[1] = pU; ts[2] = 36; ts[3] = 5; ts[4] = 1;
    run_and_emit(0x6FCAD5F0u, "NET_SendPacket21_UpdateUnitSkill_6FCAD5F0_113c", k,
                 k == 0 ? "null_unit_noop" : k == 1 ? "player_direct_client" : "monster_owner_client",
                 &c, ts, 5, 0u, 0);
  }

  /* [15] 0x6FCEB580 NET_SendChatMessagePacket26Wrapper_6FCEB580_113c (ecx=pClient, edx=pChatMsg, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U8(STAGE_SCRATCH + 0x00u) = 0x26u;
    U8(STAGE_SCRATCH + 0x01u) = 0x01u;
    U32(STAGE_SCRATCH + 0x04u) = 0x11223344u;
    if (k == 0) {
      strcpy((char *)(uintptr_t)(STAGE_SCRATCH + 0x0Au), "Ama");
      strcpy((char *)(uintptr_t)(STAGE_SCRATCH + 0x1Au), "Hi");
    } else {
      strcpy((char *)(uintptr_t)(STAGE_SCRATCH + 0x0Au), "Sorceress");
      strcpy((char *)(uintptr_t)(STAGE_SCRATCH + 0x1Au), "Stay awhile");
    }
    uint32_t pCli = (k == 2) ? 0u : STAGE_CLIENT;
    c.ecx = pCli; c.edx = STAGE_SCRATCH;
    ts[0] = pCli; ts[1] = STAGE_SCRATCH;
    run_and_emit(0x6FCEB580u, "NET_SendChatMessagePacket26Wrapper_6FCEB580_113c", k,
                 k == 0 ? "short_chat_len" : k == 1 ? "long_chat_len" : "null_client_ret0",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [16] 0x6FCAA3E0 NET_QueuePacketToClientBuffer113c (eax=pClient, stack=[pPacket, nSize], ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    for (uint32_t i = 0; i < 16u; i++) U8(STAGE_SCRATCH + i) = (uint8_t)(0xA0u + i);
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    uint32_t sz   = (k == 1) ? 7u : 12u;
    if (k == 2) {
      /* Tail full (0x1FC bytes) + dirty recycled node on free-list (+0x1C0) -> recycles & zeroes! */
      U32(STAGE_CLIENT + 0x1B8u) = STAGE_PKTNODE0;
      U32(STAGE_CLIENT + 0x1BCu) = STAGE_PKTNODE0;
      U32(STAGE_PKTNODE0 + 0x00u) = 0x1FCu;
      U32(STAGE_PKTNODE0 + 0x204u) = 0u;
      U32(STAGE_CLIENT + 0x1C0u) = STAGE_PKTNODE1;
      U32(STAGE_PKTNODE1 + 0x00u) = 0x99u;
      U32(STAGE_PKTNODE1 + 0x40u) = 0xDEADBEEFu;
    } else if (k == 3) {
      /* Empty free-list -> allocates fresh 0x208 node on heap */
      U32(STAGE_CLIENT + 0x1C0u) = 0u;
    }
    c.eax = pCli; c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = sz; c.calleePop = 8u;
    ts[0] = pCli; ts[1] = 1; ts[2] = STAGE_SCRATCH; ts[3] = sz;
    run_and_emit(0x6FCAA3E0u, "NET_QueuePacketToClientBuffer113c", k,
                 k == 0 ? "null_client_0" : k == 1 ? "queue_7b" : k == 2 ? "recycle_and_zero_12b" : "heap_alloc_node_12b",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [17] 0x6FCAB400 NET_SendFixed40BytePacketToClient113c (eax=pSrcPacket40, stack=[pClient], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U8(STAGE_SCRATCH + 0x00u) = 0x5Au;
    U8(STAGE_SCRATCH + 0x01u) = 0x07u;
    if (k == 2) {
      memset((void *)(uintptr_t)(STAGE_SCRATCH + 0x08u), 'A', 16u);
      U8(STAGE_SCRATCH + 0x18u) = 0u;
    } else {
      strcpy((char *)(uintptr_t)(STAGE_SCRATCH + 0x08u), "Hero");
    }
    uint32_t pCli = (k == 1) ? 0u : STAGE_CLIENT;
    c.eax = STAGE_SCRATCH; c.nargs = 1; c.args[0] = pCli; c.calleePop = 4u;
    ts[0] = pCli; ts[1] = STAGE_SCRATCH;
    run_and_emit(0x6FCAB400u, "NET_SendFixed40BytePacketToClient113c", k,
                 k == 0 ? "valid_40b" : k == 1 ? "null_client_0" : "long_name_assert_5da",
                 &c, ts, 2, 0xFFFFFFFFu, (k == 2 ? 1 : 0));
  }

  /* [18] 0x6FCAB470 NET_SendPacket26_ChatMessage_6FCAB470_113c (eax=pChatMsg, stack=[pClient], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U8(STAGE_SCRATCH + 0x00u) = 0x26u;
    strcpy((char *)(uintptr_t)(STAGE_SCRATCH + 0x0Au), "Paladin");
    if (k == 2) {
      memset((void *)(uintptr_t)(STAGE_SCRATCH + 0x1Au), 'X', 0x100u);
      U8(STAGE_SCRATCH + 0x11Au) = 0u;
    } else {
      strcpy((char *)(uintptr_t)(STAGE_SCRATCH + 0x1Au), "Hello");
    }
    uint32_t pCli = (k == 1) ? 0u : STAGE_CLIENT;
    c.eax = STAGE_SCRATCH; c.nargs = 1; c.args[0] = pCli; c.calleePop = 4u;
    ts[0] = STAGE_SCRATCH; ts[1] = pCli;
    run_and_emit(0x6FCAB470u, "NET_SendPacket26_ChatMessage_6FCAB470_113c", k,
                 k == 0 ? "valid_chat_len" : k == 1 ? "null_client_0" : "overlong_assert_5ba",
                 &c, ts, 2, 0xFFFFFFFFu, (k == 2 ? 1 : 0));
  }
}

/* =========================================================================
 * GROUP 4..8 — Bugs 4, 5, 6, 7, 8 (13 VAs): Combat Side Effects, Exp, Align, Neutral, Asserts/AI
 * ========================================================================= */
static void emit_group_4_to_8(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [19] 0x6FCCD7B0 ITEMMODS_ApplyAttackerTakesFireDamage_6FCCD7B0_113c (ecx=pGame, stack=[pUnit, pAtt, arg3, statParam, arg5], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1901u, 1u, 5000u, 5000u, 1901u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 19u, 1902u, 1u, 5002u, 5000u, 1902u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 78, 12, 0); /* stat 78 = 0x4E */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 500 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 500 << 8, 0);
    if (k == 1) {
      U32(STAGE_UNIT1 + 0xC4u) = 0u; /* clear UNITFLAG_CANBEATTACKED */
    }
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t param = (78u << 16);
    c.ecx = STAGE_GAME;
    c.nargs = 5; c.args[0] = pU; c.args[1] = STAGE_UNIT1; c.args[2] = 0u; c.args[3] = param; c.args[4] = 0u;
    c.calleePop = 20u;
    ts[0] = STAGE_GAME; ts[1] = pU; ts[2] = STAGE_UNIT1; ts[3] = 0; ts[4] = param;
    run_and_emit(0x6FCCD7B0u, "ITEMMODS_ApplyAttackerTakesFireDamage_6FCCD7B0_113c", k,
                 k == 0 ? "null_unit_0" : k == 1 ? "not_attackable_0" : "apply_fire_thorns_set54",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [20] 0x6FCCD860 ITEMMODS_ApplyAttackerTakesLightningDamage_6FCCD860_113c (ecx=pGame, stack=[pUnit, pAtt, arg3, statParam, arg5], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 2001u, 1u, 5000u, 5000u, 2001u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 19u, 2002u, 1u, 5002u, 5000u, 2002u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 129, (k == 1 ? 0 : 15), 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 500 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 500 << 8, 0);
    uint32_t pAtt = (k == 0) ? 0u : STAGE_UNIT1;
    uint32_t param = (129u << 16);
    c.ecx = STAGE_GAME;
    c.nargs = 5; c.args[0] = STAGE_UNIT0; c.args[1] = pAtt; c.args[2] = 0u; c.args[3] = param; c.args[4] = 0u;
    c.calleePop = 20u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pAtt; ts[3] = 0; ts[4] = param;
    run_and_emit(0x6FCCD860u, "ITEMMODS_ApplyAttackerTakesLightningDamage_6FCCD860_113c", k,
                 k == 0 ? "null_att_0" : k == 1 ? "zero_stat_0" : "apply_ltng_thorns_set54",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [21] 0x6FCFCF20 SUNITDMG_ApplySideEffectsAndKill113c (eax=pDef, stack=[pGame, pAtt, pDmg], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 2101u, 1u, 5000u, 5000u, 2101u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 19u, 2102u, 1u, 5002u, 5000u, 2102u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 400 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 500 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x160, 102, 0); /* matching life pct */
    U16(STAGE_DMG + 0x04u) = (k == 0) ? 0x4001u : (k == 1 ? 0x4011u : 0x0001u);
    U32(STAGE_DMG + 0x60u) = 0x2Du;
    c.eax = STAGE_UNIT1; c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_DMG;
    c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = STAGE_DMG;
    run_and_emit(0x6FCFCF20u, "SUNITDMG_ApplySideEffectsAndKill113c", k,
                 k == 0 ? "flag4000_set54_8000" : k == 1 ? "flag4010_block_fallback_54" : "small_hit_no_8000",
                 &c, ts, 4, 0u, 0);
  }

  /* [22] 0x6FCFE870 SUNITDMG_GrantExpToPlayerOrHireling_6FCFE870_113c (esi=pUnit, ebx=nExpGain, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 2201u, 1u, 5000u, 5000u, 2201u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    U32(STAGE_GAME + 0x1D24u) = STAGE_SCRATCH + 0x400u;
    attach_skill(STAGE_UNIT0, 6, 1);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 1, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 13, 100, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 50 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 50 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 15 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 15 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 10, 80 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 11, 80 << 8, 0);
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t xp = (k == 2) ? 600u : 150u;
    c.esi = pU; c.ebx = xp; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = pU; ts[1] = xp; ts[2] = STAGE_GAME;
    run_and_emit(0x6FCFE870u, "SUNITDMG_GrantExpToPlayerOrHireling_6FCFE870_113c", k,
                 k == 0 ? "null_unit_noop" : k == 1 ? "player_exp_no_lvlup" : "player_exp_levelup_to_2",
                 &c, ts, 3, 0u, 0);
  }

  /* [23] 0x6FCFE6D0 SUNITDMG_AddPlayerExperienceAndCheckLevelUp113c (eax=pPlayer, stack=[pGame, nOldLevel, nExpGain], ret 0xC) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 2301u, 1u, 5000u, 5000u, 2301u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    U32(STAGE_GAME + 0x1D24u) = STAGE_SCRATCH + 0x400u;
    attach_skill(STAGE_UNIT0, 6, 1);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, k == 3 ? 99 : 1, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 13, k == 3 ? (int32_t)3520485244u : 100, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 50 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 50 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 15 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 15 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 10, 80 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 11, 80 << 8, 0);
    uint32_t pPlr = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t oldLvl = (k == 3) ? 99u : 1u;
    uint32_t gain = (k == 2) ? 600u : (k == 3 ? 500u : 120u);
    c.eax = pPlr; c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = oldLvl; c.args[2] = gain; c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = pPlr; ts[2] = gain; ts[3] = oldLvl;
    run_and_emit(0x6FCFE6D0u, "SUNITDMG_AddPlayerExperienceAndCheckLevelUp113c", k,
                 k == 0 ? "null_plr_noop" : k == 1 ? "add_120_lastexp" : k == 2 ? "levelup_nextexp_1e" : "clamp_maxcap",
                 &c, ts, 4, 0u, 0);
  }

  /* [24] 0x6FC6EB90 SKILLS_OnCurseExpireResetAlignmentA_6FC6EB90_113c (ecx=pUnit, edx=nStateId, stack=[pArg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_ROOM0 + 0x28u) = 3u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 2401u, 1u, 5000u, 5000u, 2401u);
    if (k < 2) {
      void *pSub = fn_AllocStatList(NULL, 0u, 0u, 1, 2401);
      fn_SetStatListState(pSub, 0x69);
      fn_SetStatIfValid(pSub, 0xAC, k == 0 ? 2 : 1, 0u);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSub, 1);
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x69, 1);
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, k == 0 ? 0x70 : 0x59, 1);
    }
    uint32_t pU = (k == 2) ? 0u : STAGE_UNIT0;
    uint32_t st = (k == 0) ? 0x70u : 0x59u;
    c.ecx = pU; c.edx = st; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = pU; ts[1] = st; ts[2] = 0;
    run_and_emit(0x6FC6EB90u, "SKILLS_OnCurseExpireResetAlignmentA_6FC6EB90_113c", k,
                 k == 0 ? "align2_to_0_state70" : k == 1 ? "align1_to_0_state59" : "null_assert_a2a",
                 &c, ts, 3, 0u, (k == 2 ? 1 : 0));
  }

  /* [25] 0x6FC6EBE0 SKILLS_OnCurseExpireResetAlignmentB_6FC6EBE0_113c (ecx=pUnit, edx=nStateId, stack=[pArg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_ROOM0 + 0x28u) = 3u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 2501u, 1u, 5000u, 5000u, 2501u);
    if (k < 2) {
      void *pSub = fn_AllocStatList(NULL, 0u, 0u, 1, 2501);
      fn_SetStatListState(pSub, 0x69);
      fn_SetStatIfValid(pSub, 0xAC, k == 0 ? 2 : 1, 0u);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSub, 1);
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x69, 1);
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, k == 0 ? 0x70 : 0x59, 1);
    }
    uint32_t pU = (k == 2) ? 0u : STAGE_UNIT0;
    uint32_t st = (k == 0) ? 0x70u : 0x59u;
    c.ecx = pU; c.edx = st; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = pU; ts[1] = st; ts[2] = 0;
    run_and_emit(0x6FC6EBE0u, "SKILLS_OnCurseExpireResetAlignmentB_6FC6EBE0_113c", k,
                 k == 0 ? "align2_to_0_state70" : k == 1 ? "align1_to_0_state59" : "null_assert_a2a",
                 &c, ts, 3, 0u, (k == 2 ? 1 : 0));
  }

  /* [26] 0x6FD00460 SUNIT_SetMonsterAlignmentState113c (eax=pUnit, bl=nAlign, stack=[bRefresh], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_ROOM0 + 0x28u) = 3u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 2601u, 1u, 5000u, 5000u, 2601u);
    if (k == 3) {
      void *pSub = fn_AllocStatList(NULL, 0u, 0u, 1, 2601);
      fn_SetStatListState(pSub, 0x69);
      fn_SetStatIfValid(pSub, 0xAC, 2, 0u);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSub, 1);
    }
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t align = (k == 1) ? 3u : (k == 2 ? 2u : 1u);
    c.eax = pU; c.ebx = align; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = pU; ts[1] = align; ts[2] = 0;
    run_and_emit(0x6FD00460u, "SUNIT_SetMonsterAlignmentState113c", k,
                 k == 0 ? "null_noop" : k == 1 ? "align3_assert_bb3" : k == 2 ? "alloc_align2_no_flag_drift" : "reuse_align2_to_1",
                 &c, ts, 3, 0u, (k == 1 ? 1 : 0));
  }

  /* [27] 0x6FC94E60 MONSTER_StartNeutral113c (ecx=pGame, edx=pModeChange, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 2701u, 2u, 5000u, 5000u, 2701u);
    if (k == 0) {
      U32(STAGE_UNIT0 + 0x14u) = 0u; /* null pMonData -> no AI_THINK scheduled */
    } else if (k == 1) {
      U32(STAGE_UDATA0 + 0x00u) = 0u; /* null pMonStatsTxt -> no AI_THINK scheduled */
    } else if (k == 3) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x15, 1); /* STATE_STUNNED -> +45 frames */
    }
    U32(STAGE_SCRATCH + 0x00u) = 1u;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC94E60u, "MONSTER_StartNeutral113c", k,
                 k == 0 ? "null_mondata_no_ev2" : k == 1 ? "null_montxt_no_ev2" : k == 2 ? "real_aidel_ev2" : "stunned_45_ev2",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [28] 0x6FC4BED0 CLIENT_BroadcastPlayerLeftPacket5C_6FC4BED0_113c (eax=pLeavingCli, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t pCli1 = stage_extra_client();
    uint32_t pCli2 = stage_extra_client();
    stage_party_player(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, STAGE_CLIENT, 2801u, "Leaver", 10);
    U32(pCli1 + 0x04u) = 4u; /* in-game -> receives 0x5C */
    U32(pCli2 + 0x04u) = 2u; /* not in-game -> skipped */
    U32(STAGE_CLIENT + 0x4A8u) = pCli1;
    U32(pCli1 + 0x4A8u)        = pCli2;
    U32(STAGE_GAME + 0x88u)    = STAGE_CLIENT;
    if (k == 2) {
      /* Clear flag 1 and remove unit from hash -> zeroes +0x174, no broadcast */
      U32(STAGE_CLIENT + 0x3D4u) = 0u;
      U32(STAGE_CLIENT + 0x170u) = 9999u;
    }
    uint32_t pLeave = (k == 0) ? 0u : STAGE_CLIENT;
    c.eax = pLeave; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = pLeave; ts[1] = STAGE_GAME;
    run_and_emit(0x6FC4BED0u, "CLIENT_BroadcastPlayerLeftPacket5C_6FC4BED0_113c", k,
                 k == 0 ? "null_assert_fb" : k == 1 ? "broadcast_5c_ingame" : "missing_unit_zero_174",
                 &c, ts, 2, 0u, (k == 0 ? 1 : 0));
  }

  /* [29] 0x6FC54370 OBJECTS_InitFn23_SyncQuest0FObjectAnimMode_6FC54370_113c (ecx=pObjInit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_nonsub0, 2901u, 0u, 5000u, 5000u, 2901u);
    if (k >= 1) {
      U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
      U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
      U32(STAGE_QUEST0 + 0x00u)    = 0x0Fu;
      U8(STAGE_QUEST0 + 0x09u)     = (uint8_t)(k == 2 ? 1u : 0u);
      U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
      U32(STAGE_QUESTEX0 + 0x18u)  = 1u;
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC54370u, "OBJECTS_InitFn23_SyncQuest0FObjectAnimMode_6FC54370_113c", k,
                 k == 0 ? "missing_q0f_assert_983" : k == 1 ? "intro_mode2" : "not_intro_ex_mode1",
                 &c, ts, 1, 0xFFFFFFFFu, (k == 0 ? 1 : 0));
  }

  /* [30] 0x6FC53AF0 QUESTS_AppendQuestTimer_6FC53AF0_113c (ebx=nPeriod, stack=[pQuest, pfnCb], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_QUEST0 + 0x04u) = STAGE_GAME;
    if (k >= 1) {
      U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
      U32(STAGE_QUESTCTRL + 0x04u) = (k == 1) ? 1u : 0u; /* bExecuting */
      U32(STAGE_QUESTCTRL + 0x14u) = 500u; /* dwTick */
    }
    c.ebx = 25u; c.nargs = 2; c.args[0] = STAGE_QUEST0; c.args[1] = 0x6FC80000u; c.calleePop = 8u;
    ts[0] = 25; ts[1] = STAGE_QUEST0; ts[2] = 0x6FC80000;
    run_and_emit(0x6FC53AF0u, "QUESTS_AppendQuestTimer_6FC53AF0_113c", k,
                 k == 0 ? "null_qctrl_noop" : k == 1 ? "executing_assert_417" : "append_timer_node",
                 &c, ts, 3, 0u, (k == 1 ? 1 : 0));
  }

  /* [31] 0x6FCC5B30 MONAI_NestOrMeleeWanderThink_6FCC5B30_113c (ecx=pGame, edx=pUnit, stack=[pAiParam], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    /* k=0: bInMeleeRange=0, roll>=20 -> AI_Stall(10); k=1: bInMeleeRange=0, different seed; k=2: bInMeleeRange=1 -> attack mode 4 */
    uint32_t seed = (k == 0) ? 0x00000005u : (k == 1 ? 0x12345679u : 0x55555555u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 3101u, 1u, 5000u, 5000u, seed);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 3102u, 1u, 5002u, 5000u, 3102u);
    /* Build D2AiParamStrc at STAGE_SCRATCH */
    U32(STAGE_SCRATCH + 0x00u) = U32(STAGE_UDATA0 + 0x2Cu); /* pAiControl */
    U32(STAGE_SCRATCH + 0x04u) = 0x6FCC5B30u;               /* pAiFn */
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT1;               /* pTarget */
    U32(STAGE_SCRATCH + 0x10u) = 1u;                        /* bEngaged */
    U32(STAGE_SCRATCH + 0x14u) = (k == 2) ? 2u : 12u;       /* nDistance */
    U32(STAGE_SCRATCH + 0x18u) = (k == 2) ? 1u : 0u;        /* bInMeleeRange */
    U32(STAGE_SCRATCH + 0x1Cu) = U32(STAGE_UDATA0 + 0x00u); /* pMonStatsTxt */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FCC5B30u, "MONAI_NestOrMeleeWanderThink_6FCC5B30_113c", k,
                 k == 0 ? "out_of_range_seedA" : k == 1 ? "out_of_range_seedB" : "in_melee_attack_mode4",
                 &c, ts, 3, 0u, 0);
  }
}

/* =========================================================================
 * GROUP 9 — Bug 9 (16 VAs): D2Common.#11090 (0x6FD83920) UNITS_ChangeAnimMode
 * ========================================================================= */
static void emit_group_9(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [32] 0x6FCFF980 SUNIT_FreeCombatListAndChangeAnimMode_6FCFF980_113c (ecx=pUnit, eax=pGame, stack=[nMode], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    if (k == 0) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 3201u, 1u, 5000u, 5000u, 3201u);
      attach_combat_node(STAGE_UNIT0, 1u, 3201u);
    } else if (k == 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_nonsub0, 3202u, 0u, 5000u, 5000u, 3202u);
    } else {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 3203u, 2u, 5000u, 5000u, 3203u);
    }
    uint32_t nextMode = (k == 1) ? 1u : 2u;
    c.ecx = STAGE_UNIT0; c.eax = STAGE_GAME; c.nargs = 1; c.args[0] = nextMode; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = nextMode;
    run_and_emit(0x6FCFF980u, "SUNIT_FreeCombatListAndChangeAnimMode_6FCFF980_113c", k,
                 k == 0 ? "mon_free_combat_mode2" : k == 1 ? "obj_mode0_to_1" : "mon_same_mode_ret0",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [33] 0x6FCEB420 PACKET_Srv54_TurnOffRunToWalk_6FCEB420_113c (ecx=pGame, edx=pPlayer, stack=[pPkt, nLen], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 3301u, (k == 1 ? 3u : 1u), 5000u, 5000u, 3301u);
    uint32_t nLen = (k == 0) ? 2u : 1u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = nLen; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = nLen;
    run_and_emit(0x6FCEB420u, "PACKET_Srv54_TurnOffRunToWalk_6FCEB420_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "run3_to_walk2" : "neutral1_noop",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [34] 0x6FCEB450 PACKET_Srv53_TurnOnWalkToRun_6FCEB450_113c (ecx=pGame, edx=pPlayer, stack=[pPkt, nLen], ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 3401u, (k == 3 ? 1u : 2u), 5000u, 5000u, 3401u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 10, (k == 1 ? (50 << 8) : 0), 0);
    uint32_t nLen = (k == 0) ? 2u : 1u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = nLen; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = nLen;
    run_and_emit(0x6FCEB450u, "PACKET_Srv53_TurnOnWalkToRun_6FCEB450_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "walk2_to_run3_with_stam" : k == 2 ? "walk2_zero_stam_noop" : "neutral1_noop",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [35] 0x6FC4E730 OBJECTS_InitFn26_SetAnimMode1_6FC4E730_113c (ecx=pObjInit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t oid = (k == 2) ? g_obj_alt_anim : g_obj_nonsub0;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, oid, 3501u, (k == 1 ? 1u : 0u), 5000u, 5000u, 3501u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC4E730u, "OBJECTS_InitFn26_SetAnimMode1_6FC4E730_113c", k,
                 k == 0 ? "objA_0_to_1" : k == 1 ? "objA_already_1" : "objB_0_to_1",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [36] 0x6FC4E740 OBJECTS_InitFn14_SetAnimMode1_6FC4E740_113c (ecx=pObjInit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t oid = (k == 2) ? g_obj_alt_anim : g_obj_nonsub0;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, oid, 3601u, (k == 1 ? 1u : 0u), 5000u, 5000u, 3601u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC4E740u, "OBJECTS_InitFn14_SetAnimMode1_6FC4E740_113c", k,
                 k == 0 ? "objA_0_to_1" : k == 1 ? "objA_already_1" : "objB_0_to_1",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [37] 0x6FC88F90 OBJECTS_InitOperatingObjectWithTimer25_6FC88F90_113c (ecx=pObjInit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_GAME + 0xA8u) = (k == 1) ? 250u : 100u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_nonsub0, 3701u, (k == 2 ? 1u : 0u), 5000u, 5000u, 3701u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC88F90u, "OBJECTS_InitOperatingObjectWithTimer25_6FC88F90_113c", k,
                 k == 0 ? "frame100_mode0_to_1" : k == 1 ? "frame250_mode0_to_1" : "already_mode1_timer25",
                 &c, ts, 1, 0u, 0);
  }

  /* [38] 0x6FC89D60 OBJ_ResetSubClassBit0ObjectToNeutral_6FC89D60_113c (ecx=pGame, edx=pObject, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t oid = (k == 2) ? g_obj_nonsub0 : g_obj_sub0;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, oid, 3801u, (k == 0 ? 1u : 0u), 5000u, 5000u, 3801u);
    U32(STAGE_UDATA0 + 0x0Cu) = 999u; /* dwShrineFrame */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC89D60u, "OBJ_ResetSubClassBit0ObjectToNeutral_6FC89D60_113c", k,
                 k == 0 ? "sub0_mode1_reset_0" : k == 1 ? "sub0_mode0_clear_frame" : "nonsub0_noop",
                 &c, ts, 2, 0u, 0);
  }

  /* [39] 0x6FC89AD0 OBJ_ToggleNeutralAndOperatingMode_6FC89AD0_113c (ecx=pOperateArgs, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_nonsub0, 3901u, (uint32_t)k, 5000u, 5000u, 3901u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC89AD0u, "OBJ_ToggleNeutralAndOperatingMode_6FC89AD0_113c", k,
                 k == 0 ? "mode0_to_1" : k == 1 ? "mode1_to_0" : "mode2_noop",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [40] 0x6FC4EC70 OBJECTS_InitFn34_RandomSetAnimMode1_6FC4EC70_113c (ecx=pObjInit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_nonsub0, 4001u, (k == 2 ? 1u : 0u), 5000u, 5000u, 4001u);
    /* pObjectControl->tSeed: nextLo = lo * 0x6AC690C5 + hi. lo=1, hi=0 -> odd (bit0=1); lo=2, hi=0 -> even (bit0=0) */
    uint32_t pObjCtrl = STAGE_SCRATCH + 0x40u;
    U32(pObjCtrl + 0x00u) = (k == 1) ? 2u : 1u;
    U32(pObjCtrl + 0x04u) = 0u;
    U32(STAGE_GAME + 0x10F0u)  = pObjCtrl;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC4EC70u, "OBJECTS_InitFn34_RandomSetAnimMode1_6FC4EC70_113c", k,
                 k == 0 ? "odd_seed_set_mode1" : k == 1 ? "even_seed_keep_mode0" : "odd_seed_already_mode1",
                 &c, ts, 1, 0u, 0);
  }

  /* [41] 0x6FC89A80 OBJECTS_OperateToggleObjectMode012_6FC89A80_113c (ecx=pObjOperate, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_nonsub0, 4101u, (uint32_t)k, 5000u, 5000u, 4101u);
    U32(STAGE_UNIT0 + 0xC4u) = 0x00000006u; /* bit 1 + bit 2 */
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC89A80u, "OBJECTS_OperateToggleObjectMode012_6FC89A80_113c", k,
                 k == 0 ? "mode0_to_1_clear_flag2" : k == 1 ? "mode1_to_0" : "mode2_to_0",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [42] 0x6FC53740 OBJECTS_InitFn10_InitRogueFireAndScheduleEvent_6FC53740_113c (ecx=pObjInit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0 ? 1u : 2u));
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_nonsub0, 4201u, (k == 2 ? 2u : 0u), 5000u, 5000u, 4201u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_ROOM0;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC53740u, "OBJECTS_InitFn10_InitRogueFireAndScheduleEvent_6FC53740_113c", k,
                 k == 0 ? "lvl1_ev8_plus60" : k == 1 ? "lvl2_mode2_ev0_plus25" : "lvl2_already_mode2_ev0",
                 &c, ts, 1, 0u, 0);
  }

  /* [43] 0x6FC94C10 MONMODE_EnterAnimMode6_6FC94C10_113c (ecx=pGame, edx=pModeChange, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 4301u, (k == 2 ? 6u : 1u), 5000u, 5000u, 4301u);
    if (k == 1) attach_combat_node(STAGE_UNIT0, 1u, 4301u);
    U32(STAGE_SCRATCH + 0x00u) = 6u;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_GAME; ts[1] = STAGE_SCRATCH;
    run_and_emit(0x6FC94C10u, "MONMODE_EnterAnimMode6_6FC94C10_113c", k,
                 k == 0 ? "mode1_to_6" : k == 1 ? "free_combat_mode6" : "already_mode6",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [44] 0x6FC94C90 MONMODE_EnterAnimMode10_6FC94C90_113c (ecx=pGame, edx=pModeChange, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 4401u, (k == 2 ? 10u : 1u), 5000u, 5000u, 4401u);
    if (k == 1) attach_combat_node(STAGE_UNIT0, 1u, 4401u);
    U32(STAGE_SCRATCH + 0x00u) = 10u;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_GAME; ts[1] = STAGE_SCRATCH;
    run_and_emit(0x6FC94C90u, "MONMODE_EnterAnimMode10_6FC94C90_113c", k,
                 k == 0 ? "mode1_to_10" : k == 1 ? "free_combat_mode10" : "already_mode10",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [45] 0x6FC96700 MONMODE_EnterMode11AndScheduleEndAnim15_6FC96700_113c (ecx=pGame, edx=pModeChange, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_GAME + 0xA8u) = (k == 1) ? 250u : 100u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 4501u, (k == 2 ? 11u : 1u), 5000u, 5000u, 4501u);
    if (k == 1) attach_combat_node(STAGE_UNIT0, 1u, 4501u);
    U32(STAGE_SCRATCH + 0x00u) = 11u;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_GAME; ts[1] = STAGE_SCRATCH;
    run_and_emit(0x6FC96700u, "MONMODE_EnterMode11AndScheduleEndAnim15_6FC96700_113c", k,
                 k == 0 ? "mode1_to_11_ev2_115" : k == 1 ? "free_combat_ev2_265" : "already_mode11_ev2",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [46] 0x6FC764D0 ACT5Q6_InitWorldstoneChamberObject9C_6FC764D0_113c (ecx=pObjInit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 132u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_nonsub0, 4601u, (k == 2 ? 1u : 0u), 5000u, 5000u, 4601u);
    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u)    = 0x24u;
    U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
    U32(STAGE_QUESTEX0 + 0x9Cu)  = (k == 0) ? 1u : (k == 1 ? 2u : 0u);
    U32(STAGE_SCRATCH + 0x00u)   = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u)   = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC764D0u, "ACT5Q6_InitWorldstoneChamberObject9C_6FC764D0_113c", k,
                 k == 0 ? "ex9c_1_set_mode1" : k == 1 ? "ex9c_2_set_mode2" : "ex9c_0_set_mode0",
                 &c, ts, 1, 0u, 0);
  }

  /* [47] 0x6FC76520 ACT5Q6_InitWorldstoneChamberObject94_6FC76520_113c (ecx=pObjInit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 132u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_nonsub0, 4701u, (k == 2 ? 1u : 0u), 5000u, 5000u, 4701u);
    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u)    = 0x24u;
    U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
    U32(STAGE_QUESTEX0 + 0x94u)  = (k == 0) ? 1u : (k == 1 ? 2u : 0u);
    U32(STAGE_SCRATCH + 0x00u)   = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u)   = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC76520u, "ACT5Q6_InitWorldstoneChamberObject94_6FC76520_113c", k,
                 k == 0 ? "ex94_1_set_mode1" : k == 1 ? "ex94_2_set_mode2" : "ex94_0_set_mode0",
                 &c, ts, 1, 0u, 0);
  }
}

int main(int argc, char **argv) {
  const char *imgPath = (argc > 1) ? argv[1] : "d2game-datatbls-113c.img";
  const char *outPath = (argc > 2) ? argv[2] : "k6-fix1-d2game-vectors.ndjson";

  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  AddVectoredExceptionHandler(1, k6_veh);

  void *pTbls  = VirtualAlloc((void *)DATATBLS_BASE, DATATBLS_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pStage = VirtualAlloc((void *)STAGE_BASE, STAGE_TOTAL_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pHeap  = VirtualAlloc((void *)HEAP_BASE, HEAP_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if ((uintptr_t)pTbls != DATATBLS_BASE || (uintptr_t)pStage != STAGE_BASE || (uintptr_t)pHeap != HEAP_BASE) {
    fprintf(stderr, "[k6-fix1] VirtualAlloc failed (%p %p %p)\n", pTbls, pStage, pHeap);
    fflush(stderr);
    return 1;
  }

  HMODULE hStorm = LoadLibraryA("Storm.dll");
  g_hFog         = LoadLibraryA("Fog.dll");
  HMODULE hLang  = LoadLibraryA("D2Lang.dll");
  HMODULE hCmp   = LoadLibraryA("D2CMP.dll");
  g_hCom         = LoadLibraryA("D2Common.dll");
  HMODULE hNet   = LoadLibraryA("D2Net.dll");
  g_hGame        = LoadLibraryA("D2Game.dll");
  if (!hStorm || !g_hFog || !hLang || !hCmp || !g_hCom || !hNet || !g_hGame) {
    fprintf(stderr, "[k6-fix1] LoadLibraryA failed\n");
    fflush(stderr);
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-fix1] unexpected D2Common rebase: %p\n", (void *)g_hCom);
    fflush(stderr);
    return 3;
  }

  {
    typedef void(__fastcall *FogInitSys_t)(int, void *);
    FogInitSys_t pInit = (FogInitSys_t)(uintptr_t)GetProcAddress(g_hFog, MAKEINTRESOURCEA(10089));
    if (pInit) pInit(1, NULL);
  }

  load_datatbls_img(imgPath);
  install_fog_hooks();

  fn_CreateStatListEx      = (Com_CreateStatListEx_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11166));
  fn_SetUnitStat           = (Com_SetUnitStat_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10887));
  fn_AllocStatList         = (Com_AllocStatList_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11013));
  fn_SetStatIfValid        = (Com_SetStatIfValid_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10188));
  fn_SetStatListState      = (Com_SetStatListState_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10785));
  fn_MergeStatLists        = (Com_MergeStatLists_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10807));
  fn_ToggleGfxState        = (Com_ToggleGfxState_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10945));
  fn_AllocSkillList        = (Com_AllocSkillList_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10856));
  fn_SetSkillLevel         = (Com_SetSkillLevel_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10302));
  fn_HasObjectSubClassBit0 = (Com_HasObjectSubClassBit0_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10934));
  fn_PathSetTargetUnit     = (Com_PathSetTargetUnit_t)(uintptr_t)(0x6FD85040u + g_com_rebase);

  if (!fn_CreateStatListEx || !fn_SetUnitStat || !fn_AllocStatList || !fn_SetStatIfValid ||
      !fn_SetStatListState || !fn_MergeStatLists || !fn_ToggleGfxState || !fn_AllocSkillList ||
      !fn_SetSkillLevel || !fn_HasObjectSubClassBit0 || !fn_PathSetTargetUnit) {
    fprintf(stderr, "[k6-fix1] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-fix1] failed to open %s for writing\n", outPath);
    return 5;
  }

  emit_group_1_to_3();
  emit_group_4_to_8();
  emit_group_9();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-fix1] emitted %u vectors across 47 D2Game.dll VAs\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
