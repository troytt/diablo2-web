/*
 * k6-fix3-d2game-emitter.c — [K6] Fix 3 Real-DLL Differential Emitter
 *
 * Loads real Diablo II: Lord of Destruction v1.13c DLLs (Storm.dll, Fog.dll,
 * D2Lang.dll, D2CMP.dll, D2Common.dll, D2Net.dll, D2Game.dll) under headless Wine,
 * hydrates canonical sgptDataTables + D2Common .data/.bss from
 * d2game-datatbls-113c.img, hooks Fog.#10024 (assert), Fog.#10042..10047
 * (deterministic bump allocator), and KERNEL32!GetTickCount (returning 0), and
 * executes:
 *   - Part A: ALL 47 remaining un-hit Hi-VAs (taking the upper half of D2Game to 100.0%)
 *   - Part B: 45 reserved Round-3 bug-unlocked Lo-VAs
 * emitting >= 3 non-degenerate real-DLL differential vectors per VA.
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
#define STAGE_TOTAL_SIZE  0x00080000u

#define HEAP_BASE         0x40000000u
#define HEAP_SIZE         0x00200000u

/* Fixed staged object addresses inside 0x30000000..0x30008FFF */
#define STAGE_GAME        (STAGE_BASE + 0x0000u) /* 0x2000: D2GameStrc */
#define STAGE_CLIENT      (STAGE_BASE + 0x2000u) /* 0x0600: D2ClientStrc #0 */
#define STAGE_PKTNODE0    (STAGE_BASE + 0x2600u) /* 0x0210: D2PacketDataStrc #0 */
#define STAGE_PKTNODE1    (STAGE_BASE + 0x2810u) /* 0x0210: D2PacketDataStrc #1 */
#define STAGE_CLIENT1     (STAGE_BASE + 0x2A20u) /* 0x0500: D2ClientStrc #1 */
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

static int g_in_setup_phase = 1;
static uint32_t g_setup_top = STAGE_SETUP_BASE;
static uint32_t g_heap_top  = HEAP_BASE;

/* Optional extra capture range (for D2Game .bss global slot verification) */
static uint32_t g_extra_cap_addr = 0u;
static uint32_t g_extra_cap_len  = 0u;

/* D2Common helper function pointers (resolved by ordinal on g_hCom) */
typedef void *(__stdcall *Com_CreateStatListEx_t)(void *pOwner, uint32_t flags, void *pfnCb, void *pGame);
typedef void  (__stdcall *Com_SetUnitStat_t)(void *pUnit, int32_t statId, int32_t val, int32_t layer);
typedef void *(__stdcall *Com_AllocStatList_t)(void *pPool, uint32_t flags, uint32_t timeout, int32_t uType, int32_t guid);
typedef int32_t(__stdcall *Com_SetStatIfValid_t)(void *pList, int32_t statId, int32_t val, uint32_t param);
typedef void  (__stdcall *Com_SetStatListState_t)(void *pList, int32_t state);
typedef void  (__stdcall *Com_MergeStatLists_t)(void *pUnit, void *pSubList, int32_t bType);
typedef void  (__stdcall *Com_ToggleGfxState_t)(void *pUnit, int32_t state, int32_t bSet);
typedef void *(__stdcall *Com_AllocSkillList_t)(void *pPool);
typedef void  (__stdcall *Com_SetSkillLevel_t)(void *pUnit, int32_t skId, int32_t lvl, int32_t bRem, int32_t u5, int32_t u6);
typedef void *(__stdcall *Com_AllocInventory_t)(void *pPool, void *pOwner);
typedef int32_t(__stdcall *Com_PlaceItemInBodyLoc_t)(void *pInv, void *pItem, int32_t bodyLoc);
typedef void  (__stdcall *Com_PathSetTargetUnit_t)(void *pPath, void *pTarget);

static Com_CreateStatListEx_t   fn_CreateStatListEx   = NULL;
static Com_SetUnitStat_t        fn_SetUnitStat        = NULL;
static Com_AllocStatList_t      fn_AllocStatList      = NULL;
static Com_SetStatIfValid_t     fn_SetStatIfValid     = NULL;
static Com_SetStatListState_t   fn_SetStatListState   = NULL;
static Com_MergeStatLists_t     fn_MergeStatLists     = NULL;
static Com_ToggleGfxState_t     fn_ToggleGfxState     = NULL;
static Com_AllocSkillList_t     fn_AllocSkillList     = NULL;
static Com_SetSkillLevel_t      fn_SetSkillLevel      = NULL;
static Com_AllocInventory_t     fn_AllocInventory     = NULL;
static Com_PlaceItemInBodyLoc_t fn_PlaceItemInBodyLoc = NULL;
static Com_PathSetTargetUnit_t  fn_PathSetTargetUnit  = NULL;

static uint32_t g_item_sword = 0;
static uint32_t g_item_bow   = 0;
static uint32_t g_item_ring  = 0;

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
volatile LONG g_thunk_faulted = 0;
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
      "leal -0x380(%esp), %edi\n\t"
      "xorl %eax, %eax\n\t"
      "movl $0xE0, %ecx\n\t"
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
      "movl %eax, _g_thunk_out_eax\n\t"
      "movl %esp, _g_thunk_esp_after\n\t"
      ".globl _thunk_resume\n\t"
      "_thunk_resume:\n\t"
      "movl _g_thunk_saved_esp, %esp\n\t"
      "movl _g_thunk_saved_ebp, %ebp\n\t"
      "popl %edi\n\t"
      "popl %esi\n\t"
      "popl %ebx\n\t"
      "popl %ebp\n\t"
      "ret\n\t");
}

static LONG WINAPI k6_veh(EXCEPTION_POINTERS *ep) {
  if (!g_thunk_in_call) return EXCEPTION_CONTINUE_SEARCH;
  DWORD code = ep->ExceptionRecord->ExceptionCode;
  if (code == EXCEPTION_ACCESS_VIOLATION ||
      code == EXCEPTION_INT_DIVIDE_BY_ZERO ||
      code == EXCEPTION_ILLEGAL_INSTRUCTION ||
      code == EXCEPTION_BREAKPOINT ||
      code == EXCEPTION_STACK_OVERFLOW ||
      code == EXCEPTION_PRIV_INSTRUCTION) {
    g_thunk_faulted = 1;
    g_fault_code    = (uint32_t)code;
    g_fault_eip     = (uint32_t)ep->ContextRecord->Eip;
    g_fault_addr    = (ep->ExceptionRecord->NumberParameters >= 2)
                          ? (uint32_t)ep->ExceptionRecord->ExceptionInformation[1]
                          : 0;
    ep->ContextRecord->Eip = (DWORD)(uintptr_t)&thunk_resume;
    ep->ContextRecord->Esp = (DWORD)g_thunk_saved_esp;
    ep->ContextRecord->Ebp = (DWORD)g_thunk_saved_ebp;
    return EXCEPTION_CONTINUE_EXECUTION;
  }
  return EXCEPTION_CONTINUE_SEARCH;
}

/* ------------------------------- Deterministic Allocator & Hooks */

typedef struct {
  uint32_t ptr;
  uint32_t size;
} AllocRec;

static AllocRec g_allocs[1024];
static uint32_t g_alloc_count = 0;

static void record_alloc(uint32_t ptr, uint32_t size) {
  if (g_alloc_count < 1024u) {
    g_allocs[g_alloc_count].ptr  = ptr;
    g_allocs[g_alloc_count].size = size;
    g_alloc_count++;
  }
}

static uint32_t lookup_alloc_size(uint32_t ptr) {
  for (uint32_t i = g_alloc_count; i > 0u; i--) {
    if (g_allocs[i - 1u].ptr == ptr) return g_allocs[i - 1u].size;
  }
  return 0u;
}

static void *bump_alloc(uint32_t size) {
  uint32_t sz = (size == 0u) ? 4u : size;
  uint32_t *cur = g_in_setup_phase ? &g_setup_top : &g_heap_top;
  uint32_t limit = g_in_setup_phase ? (STAGE_BASE + STAGE_TOTAL_SIZE) : (HEAP_BASE + HEAP_SIZE);
  uint32_t p = (*cur + 3u) & ~3u;
  if (p + sz > limit) {
    fprintf(stderr, "[k6-fix3] allocator overflow (setup=%d size=%u)\n", g_in_setup_phase, sz);
    TerminateProcess(GetCurrentProcess(), 21);
  }
  memset((void *)(uintptr_t)p, 0, sz);
  *cur = p + sz;
  record_alloc(p, sz);
  return (void *)(uintptr_t)p;
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

static void *__fastcall stub_fog_10042(uint32_t size, const char *file, int line, int z) {
  (void)file; (void)line; (void)z;
  return bump_alloc(size);
}
static void __fastcall stub_fog_10043(void *ptr, const char *file, int line, int z) {
  (void)ptr; (void)file; (void)line; (void)z;
}
static void *__fastcall stub_fog_10045(void *pool, uint32_t size, const char *file, int line, int z) {
  (void)pool; (void)file; (void)line; (void)z;
  return bump_alloc(size);
}
static void __fastcall stub_fog_10046(void *pool, void *ptr, const char *file, int line, int z) {
  (void)pool; (void)ptr; (void)file; (void)line; (void)z;
}
static void *__fastcall stub_fog_10047(void *pool, void *ptr, uint32_t newSize, const char *file, int line, int z) {
  (void)pool; (void)file; (void)line; (void)z;
  void *np = bump_alloc(newSize);
  if (ptr && newSize > 0u) {
    uint32_t oldSize = lookup_alloc_size((uint32_t)(uintptr_t)ptr);
    uint32_t copyLen = (oldSize > 0u && oldSize < newSize) ? oldSize : newSize;
    memcpy(np, ptr, copyLen);
  }
  return np;
}

static DWORD __stdcall stub_GetTickCount(void) {
  return 0u;
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
      fprintf(stderr, "[k6-fix3] missing Fog.#%u\n", hooks[i].ord);
      TerminateProcess(GetCurrentProcess(), 23);
    }
    hook_module_iat_ptr(g_hCom, orig, hooks[i].fn);
    hook_module_iat_ptr(g_hGame, orig, hooks[i].fn);
  }
  HMODULE hK32 = GetModuleHandleA("kernel32.dll");
  if (hK32) {
    void *origTick = (void *)(uintptr_t)GetProcAddress(hK32, "GetTickCount");
    if (origTick) {
      hook_module_iat_ptr(g_hCom, origTick, (void *)(uintptr_t)stub_GetTickCount);
      hook_module_iat_ptr(g_hGame, origTick, (void *)(uintptr_t)stub_GetTickCount);
    }
  }
}

/* ------------------------------- PAGEIMG Loader */

static void load_datatbls_img(const char *imgPath) {
  FILE *fp = fopen(imgPath, "rb");
  if (!fp) {
    fprintf(stderr, "[k6-fix3] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-fix3] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(D2COM_PREF_BASE + 0x99000u + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-fix3] short read at page %u\n", i);
      TerminateProcess(GetCurrentProcess(), 12);
    }
    uint32_t va = 0;
    memcpy(&va, pageBuf, 4);
    if (va >= DATATBLS_BASE && va < DATATBLS_BASE + DATATBLS_SIZE) {
      memcpy((void *)(uintptr_t)va, pageBuf + 4, 4096);
    } else if (va >= (D2COM_PREF_BASE + 0x99000u) && va < (D2COM_PREF_BASE + 0xA3000u)) {
      memcpy((void *)(uintptr_t)(va + g_com_rebase), pageBuf + 4, 4096);
    }
  }
  fclose(fp);
}

/* ------------------------------- Staged Arena Memory Serializer */

static char g_pre_json[262144];

static void format_mem_runs_range(
    char *out, size_t cap, size_t *lenPtr, uint32_t startAddr, uint32_t endAddr, int *first, uint32_t displayDelta) {
  static const char hexChars[] = "0123456789abcdef";
  size_t len = *lenPtr;
  uint32_t a = startAddr;
  while (a < endAddr) {
    uint32_t chunkEnd = (a + 16u <= endAddr) ? (a + 16u) : endAddr;
    int nz = 0;
    for (uint32_t k = a; k < chunkEnd; k++) {
      if (U8(k) != 0) { nz = 1; break; }
    }
    if (!nz) { a = chunkEnd; continue; }
    uint32_t runStart = a;
    uint32_t runEnd   = chunkEnd;
    while (runEnd < endAddr && (runEnd - runStart) < 512u) {
      uint32_t nextEnd = (runEnd + 16u <= endAddr) ? (runEnd + 16u) : endAddr;
      int nextNz = 0;
      for (uint32_t k = runEnd; k < nextEnd; k++) {
        if (U8(k) != 0) { nextNz = 1; break; }
      }
      if (!nextNz) break;
      runEnd = nextEnd;
    }
    int n = snprintf(out + len, cap - len, "%s{\"addr\":\"0x%08X\",\"hex\":\"", (*first ? "" : ","), runStart - displayDelta);
    len += (size_t)n;
    *first = 0;
    for (uint32_t k = runStart; k < runEnd; k++) {
      uint8_t b = U8(k);
      if (len + 4 >= cap) {
        fprintf(stderr, "[k6-fix3] stage json overflow\n");
        TerminateProcess(GetCurrentProcess(), 24);
      }
      out[len++] = hexChars[(b >> 4) & 0xFu];
      out[len++] = hexChars[b & 0xFu];
    }
    out[len++] = '"';
    out[len++] = '}';
    out[len] = '\0';
    a = runEnd;
  }
  *lenPtr = len;
}

static void capture_stage_json(char *out, size_t cap, uint32_t setupTop) {
  size_t len = 0;
  int first = 1;
  out[len++] = '[';
  out[len] = '\0';
  format_mem_runs_range(out, cap, &len, STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE, &first, 0u);
  if (setupTop > STAGE_SETUP_BASE) {
    format_mem_runs_range(out, cap, &len, STAGE_SETUP_BASE, setupTop, &first, 0u);
  }
  if (g_extra_cap_len > 0u) {
    format_mem_runs_range(out, cap, &len, g_extra_cap_addr, g_extra_cap_addr + g_extra_cap_len, &first, (uint32_t)g_game_rebase);
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
  g_extra_cap_addr = 0u;
  g_extra_cap_len  = 0u;

  U8(STAGE_GAME + 0x6Du)  = 0u;
  U32(STAGE_GAME + 0x70u) = 1u;
  U32(STAGE_GAME + 0xA8u) = 100u;

  U32(STAGE_PKTNODE0 + 0x204u) = STAGE_PKTNODE1;
  U32(STAGE_CLIENT + 0x1C0u)   = STAGE_PKTNODE0;
  U32(STAGE_CLIENT + 0x1A8u)   = STAGE_GAME;
}

static uint32_t stage_timer_queue(void) {
  uint32_t pTimer = (uint32_t)(uintptr_t)bump_alloc(0xA20u);
  uint32_t pChunk = (uint32_t)(uintptr_t)bump_alloc(0x7088u);
  for (uint32_t i = 0; i < 15u; i++) {
    U32(pChunk + i * 0x30u + 0x1Cu) = pChunk + (i + 1u) * 0x30u;
  }
  U32(pChunk + 0x7080u) = pChunk;
  U32(pTimer + 0xA1Cu)  = pChunk;
  U32(STAGE_GAME + 0xB8u) = pTimer;
  return pTimer;
}

static uint32_t stage_game_obj_control(uint32_t seedLo) {
  uint32_t pObjCtrl = (uint32_t)(uintptr_t)bump_alloc(0x40u);
  U32(pObjCtrl + 0x00u) = seedLo ? seedLo : 0x13579BDFu;
  U32(pObjCtrl + 0x04u) = 0x0000029Au;
  U32(STAGE_GAME + 0x10F0u) = pObjCtrl;
  return pObjCtrl;
}

static void stage_room(uint32_t pRoom, uint32_t pRoomEx, uint32_t pLevel, uint32_t levelId) {
  uint32_t pAct = (pRoom == STAGE_ROOM1) ? STAGE_ACT1 : STAGE_ACT0;
  U32(pAct + 0x08u)         = 1u;
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

static void stage_room_with_coll(uint32_t pRoom, uint32_t pRoomEx, uint32_t pLevel, uint32_t levelId) {
  stage_room(pRoom, pRoomEx, pLevel, levelId);
  uint32_t ppNear = (uint32_t)(uintptr_t)bump_alloc(8u);
  U32(ppNear) = pRoom;
  U32(pRoom + 0x00u) = ppNear;
  U32(pRoom + 0x24u) = 1u;
  uint32_t pColl = (uint32_t)(uintptr_t)bump_alloc(0x28u);
  uint32_t pMap  = (uint32_t)(uintptr_t)bump_alloc(32u * 32u * 2u);
  U32(pColl + 0x00u) = 4992u;
  U32(pColl + 0x04u) = 4992u;
  U32(pColl + 0x08u) = 32u;
  U32(pColl + 0x0Cu) = 32u;
  U32(pColl + 0x10u) = 998u;
  U32(pColl + 0x14u) = 998u;
  U32(pColl + 0x18u) = 6u;
  U32(pColl + 0x1Cu) = 6u;
  U32(pColl + 0x20u) = pMap;
  U32(pColl + 0x24u) = pMap + 32u * 32u * 2u;
  U32(pRoom + 0x20u) = pColl;
  U32(pRoom + 0x4Cu) = 4992u;
  U32(pRoom + 0x50u) = 4992u;
  U32(pRoom + 0x54u) = 32u;
  U32(pRoom + 0x58u) = 32u;
  U32(pRoom + 0x5Cu) = 998u;
  U32(pRoom + 0x60u) = 998u;
  U32(pRoom + 0x64u) = 6u;
  U32(pRoom + 0x68u) = 6u;
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

static void link_unit_into_room(uint32_t pRoom, uint32_t pUnit) {
  uint32_t prevHead = U32(pRoom + 0x74u);
  U32(pUnit + 0xE8u) = prevHead;
  U32(pRoom + 0x74u) = pUnit;
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
  U32(pUnit + 0xC4u) = 0x00000004u;
  if (pPath != 0u) {
    if (uType == 2u || uType == 4u || uType == 5u) {
      stage_static_path(pUnit, pPath, pRoom, (int32_t)x, (int32_t)y);
    } else {
      stage_dynamic_path(pUnit, pPath, pRoom, x, y);
    }
  }
  if (uType == 2u && pUData != 0u) {
    uint32_t pObjectsBase = U32(D2COM_PREF_BASE + 0xA0B94u + g_com_rebase);
    uint32_t nObjectsCnt  = U32(D2COM_PREF_BASE + 0xA0B98u + g_com_rebase);
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
    uint32_t pTables  = U32(D2COM_PREF_BASE + 0x99E1Cu + g_com_rebase);
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

static void stage_item_unit(
    uint32_t pUnit, uint32_t pUData, uint32_t pPath, uint32_t pRoom,
    uint32_t classId, uint32_t guid, uint32_t quality, uint32_t ilvl,
    uint16_t format, uint32_t seedLo) {
  stage_unit_common(pUnit, pUData, pPath, pRoom, 4u, classId, guid, 3u, 5000u, 5000u, seedLo);
  U32(pUData + 0x00u) = quality;
  U32(pUData + 0x04u) = seedLo ? seedLo : 0x12345679u;
  U32(pUData + 0x08u) = 0x0000029Au;
  U32(pUData + 0x0Cu) = 0u;
  U32(pUData + 0x10u) = seedLo ? seedLo : 0x12345679u;
  U32(pUData + 0x18u) = 0x00000010u; /* ITEMFLAG_IDENTIFIED */
  U32(pUData + 0x2Cu) = ilvl;
  U16(pUData + 0x30u) = format;
}

static void stage_player_quest_flags(uint32_t pPlayerData, uint32_t *outFlagBuf) {
  uint32_t pQRec = (uint32_t)(uintptr_t)bump_alloc(0x10u);
  uint32_t pBuf  = (uint32_t)(uintptr_t)bump_alloc(0x60u);
  U32(pQRec + 0x00u) = pBuf;
  U32(pQRec + 0x04u) = 0x60u;
  U32(pPlayerData + 0x10u) = pQRec;
  U32(pPlayerData + 0x14u) = pQRec;
  U32(pPlayerData + 0x18u) = pQRec;
  if (outFlagBuf) *outFlagBuf = pBuf;
}

static void set_quest_flag_bit(uint32_t pBuf, uint32_t questId, uint32_t bit) {
  uint32_t byteOff = questId * 2u + (bit >> 3);
  U8(pBuf + byteOff) |= (uint8_t)(1u << (bit & 7u));
}

static void link_player_client(uint32_t pUnit, uint32_t pUData, uint32_t pCli, uint32_t guid) {
  U32(pUData + 0x9Cu) = pCli;
  U32(pCli + 0x04u)   = 4u;
  U32(pCli + 0x16Cu)  = 0u;
  U32(pCli + 0x170u)  = guid;
  U32(pCli + 0x174u)  = pUnit;
  U32(pCli + 0x1A8u)  = STAGE_GAME;
  U32(pCli + 0x3D4u)  = 1u;
  if (U32(STAGE_GAME + 0x88u) == 0u) {
    U32(STAGE_GAME + 0x88u) = pCli;
  }
}

static void stage_client_pkt_pool(uint32_t pCli) {
  uint32_t n0 = (uint32_t)(uintptr_t)bump_alloc(0x210u);
  uint32_t n1 = (uint32_t)(uintptr_t)bump_alloc(0x210u);
  U32(n0 + 0x204u) = n1;
  U32(pCli + 0x1C0u) = n0;
  U32(pCli + 0x1A8u) = STAGE_GAME;
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

static void canonicalize_d2game_ptrs_range(uint32_t startAddr, uint32_t endAddr) {
  uint32_t lo = (uint32_t)(uintptr_t)g_hGame;
  uint32_t hi = lo + 0x117000u;
  uint32_t delta = (uint32_t)g_game_rebase;
  uint32_t stkLo = (g_thunk_saved_esp > 0x4000u) ? (g_thunk_saved_esp - 0x4000u) : 0u;
  uint32_t stkHi = g_thunk_saved_esp + 0x1000u;
  for (uint32_t a = startAddr; a + 4u <= endAddr; a += 4u) {
    uint32_t v = U32(a);
    if (delta != 0u && v >= lo && v < hi) {
      U32(a) = v - delta;
    } else if (stkLo != 0u && v >= stkLo && v < stkHi) {
      U32(a) = 0x7E000000u;
    }
  }
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
  static char postJson[262144];
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
            "[k6-fix3] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }

  if (expectAssert && g_thunk_faulted != 2) {
    fprintf(stderr, "[k6-fix3] EXPECTED ASSERT did not fire at %s (0x%08X) case %d (%s)\n",
            fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!expectAssert && g_thunk_faulted == 2) {
    fprintf(stderr, "[k6-fix3] UNEXPECTED Fog.#10024 assert line %u at %s (0x%08X) case %d (%s)\n",
            g_assert_line, fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 32);
  }

  if (g_thunk_faulted == 0) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-fix3] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
              fnName, canonVa, caseIdx, label, actualPop, spec->calleePop);
      TerminateProcess(GetCurrentProcess(), 33);
    }
  }

  canonicalize_d2game_ptrs_range(STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE);
  if (setupTop > STAGE_SETUP_BASE) {
    canonicalize_d2game_ptrs_range(STAGE_SETUP_BASE, setupTop);
  }
  if (g_heap_top > HEAP_BASE) {
    canonicalize_d2game_ptrs_range(HEAP_BASE, g_heap_top);
  }
  capture_stage_json(postJson, sizeof(postJson), setupTop);

  fprintf(g_out_fp,
          "{\"va\":\"0x%08X\",\"name\":\"%s\",\"caseIdx\":%d,\"label\":\"%s\",\"tsArgs\":[",
          canonVa, fnName, caseIdx, label);
  for (uint32_t i = 0; i < nTsArgs; i++) {
    fprintf(g_out_fp, "%s%lld", (i == 0 ? "" : ","), (long long)tsArgs[i]);
  }
  uint32_t maskedRet = g_thunk_out_eax & retMask;
  if (g_game_rebase != 0 && retMask == 0xFFFFFFFFu) {
    uint32_t lo = (uint32_t)(uintptr_t)g_hGame;
    if (maskedRet >= lo && maskedRet < lo + 0x130000u) {
      maskedRet -= (uint32_t)g_game_rebase;
    }
  }
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

typedef struct {
  uint32_t dwCode;
  int32_t  nRow;
} TxtLinkNode;

typedef struct {
  int32_t      nRecords;
  uint32_t     dwPad;
  TxtLinkNode *pNodes;
} TxtLinkHeader;

static TxtLinkNode   g_items_txtlink_nodes[1024];
static TxtLinkHeader g_items_txtlink;

static void discover_table_ids(void) {
  reset_case();
  uint32_t nItems = U32(D2COM_PREF_BASE + 0x9FB94u + g_com_rebase);
  uint32_t pItems = U32(D2COM_PREF_BASE + 0x9FB98u + g_com_rebase);
  int32_t  nLink  = 0;
  for (uint32_t id = 0; id < nItems; id++) {
    uint32_t code = U32(pItems + id * 0x1A8u + 0x80u);
    if (!g_item_sword && code == 0x20647373u) g_item_sword = id; /* 'ssd ' */
    if (!g_item_bow   && code == 0x20776273u) g_item_bow   = id; /* 'sbw ' */
    if (!g_item_ring  && code == 0x206E6972u) g_item_ring  = id; /* 'rin ' */
    if (nLink < 1024) {
      int32_t pos = nLink;
      while (pos > 0 && g_items_txtlink_nodes[pos - 1].dwCode > code) {
        g_items_txtlink_nodes[pos] = g_items_txtlink_nodes[pos - 1];
        pos--;
      }
      g_items_txtlink_nodes[pos].dwCode = code;
      g_items_txtlink_nodes[pos].nRow   = (int32_t)id;
      nLink++;
    }
  }
  g_items_txtlink.nRecords = nLink;
  g_items_txtlink.dwPad    = 0u;
  g_items_txtlink.pNodes   = g_items_txtlink_nodes;
  U32(D2COM_PREF_BASE + 0x9FF6Cu + g_com_rebase) = (uint32_t)(uintptr_t)&g_items_txtlink;
}

/* =========================================================================
 * PART A1 — 21 Clean StatusFilter / NoOp / Reject3 Hi-VAs
 * ========================================================================= */
static void emit_part_a1_clean_hivas(void) {
  X86CallSpec c;
  int64_t ts[8];
  char lbl[48];

  /* 3 ret 4 NoOps */
  static const struct { uint32_t va; const char *name; } kRet4Noops[] = {
    { 0x6FCC3920u, "MONAI_NoOpRet4_6FCC3920_113c" },
    { 0x6FCC39D0u, "MONAI_NoOpRet4_6FCC39D0_113c" },
    { 0x6FCD6C80u, "AIBAAL_NoopThink_6FCD6C80_113c" },
  };
  for (size_t i = 0; i < sizeof(kRet4Noops) / sizeof(kRet4Noops[0]); i++) {
    for (int k = 0; k < 3; k++) {
      reset_case();
      U32(STAGE_SCRATCH) = 0x10100001u + (uint32_t)k * 0x111u;
      c = make_call();
      c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
      c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
      ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
      snprintf(lbl, sizeof(lbl), "noop_ret4_k%d", k);
      run_and_emit(kRet4Noops[i].va, kRet4Noops[i].name, k, lbl, &c, ts, 3, 0u, 0);
    }
  }

  /* 5 ret 0 NoOps */
  static const struct { uint32_t va; const char *name; } kRet0Noops[] = {
    { 0x6FCE1980u, "ACT2Q4_Callback00_Noop_6FCE1980_113c" },
    { 0x6FCE2360u, "ACT2Q3_NoOpB_6FCE2360_113c" },
    { 0x6FCE2370u, "ACT2Q3_NoOpC_6FCE2370_113c" },
    { 0x6FCF1790u, "ITEMMODE_UnitTimerNoop113c" },
    { 0x6FD02EF0u, "ACT3Q7_Callback11_Noop113c" },
  };
  for (size_t i = 0; i < sizeof(kRet0Noops) / sizeof(kRet0Noops[0]); i++) {
    for (int k = 0; k < 3; k++) {
      reset_case();
      U32(STAGE_SCRATCH) = 0x20200001u + (uint32_t)k * 0x222u;
      c = make_call();
      c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
      ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
      snprintf(lbl, sizeof(lbl), "noop_ret0_k%d", k);
      run_and_emit(kRet0Noops[i].va, kRet0Noops[i].name, k, lbl, &c, ts, 2, 0u, 0);
    }
  }

  /* 7 xor al, al; ret 0xc StatusFilters */
  static const struct { uint32_t va; const char *name; } kStatusFilters[] = {
    { 0x6FCD87D0u, "ACT4Q0_StatusFilter_6FCD87D0_113c" },
    { 0x6FCD8B80u, "ACT4Prologue_StatusFilter_6FCD8B80_113c" },
    { 0x6FCE1960u, "ACT2Q5_StatusFilter_6FCE1960_113c" },
    { 0x6FCE1970u, "ACT2Q4_StatusFilter_6FCE1970_113c" },
    { 0x6FCE25C0u, "ACT2Q0_StatusFilter_6FCE25C0_113c" },
    { 0x6FD028B0u, "ACT3Q0_StatusFilter113c" },
    { 0x6FD03030u, "ACT3Q1_HratliIntroStatusFilter113c" },
  };
  for (size_t i = 0; i < sizeof(kStatusFilters) / sizeof(kStatusFilters[0]); i++) {
    for (int k = 0; k < 3; k++) {
      reset_case();
      U32(STAGE_SCRATCH) = 0x30300001u + (uint32_t)k * 0x333u;
      c = make_call();
      c.ecx = STAGE_QUEST0; c.edx = STAGE_UNIT0;
      c.nargs = 3;
      c.args[0] = STAGE_SCRATCH;
      c.args[1] = STAGE_SCRATCH + 0x20u;
      c.args[2] = STAGE_SCRATCH + 0x40u;
      c.calleePop = 0x0Cu;
      ts[0] = STAGE_QUEST0; ts[1] = STAGE_UNIT0;
      ts[2] = STAGE_SCRATCH; ts[3] = STAGE_SCRATCH + 0x20u; ts[4] = STAGE_SCRATCH + 0x40u;
      snprintf(lbl, sizeof(lbl), "status_filter_k%d", k);
      run_and_emit(kStatusFilters[i].va, kStatusFilters[i].name, k, lbl, &c, ts, 5, 0xFFu, 0);
    }
  }

  /* 5 mov eax, 3; ret 8 Reject3 handlers */
  static const struct { uint32_t va; const char *name; } kReject3[] = {
    { 0x6FCEB1E0u, "PACKET_C2S2C_Reject3_113c" },
    { 0x6FCEB490u, "PACKET_C2S52_Reject3_113c" },
    { 0x6FCEB550u, "PACKET_C2S45_Reject3_113c" },
    { 0x6FCEB560u, "PACKET_C2S39_Reject3_113c" },
    { 0x6FCEBDA0u, "PACKET_C2S2D_Reject3_113c" },
  };
  for (size_t i = 0; i < sizeof(kReject3) / sizeof(kReject3[0]); i++) {
    for (int k = 0; k < 3; k++) {
      reset_case();
      U32(STAGE_SCRATCH) = 0x40400001u + (uint32_t)k * 0x444u;
      c = make_call();
      c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
      c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = (uint32_t)(k + 1);
      c.calleePop = 8u;
      ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = k + 1;
      snprintf(lbl, sizeof(lbl), "reject3_k%d", k);
      run_and_emit(kReject3[i].va, kReject3[i].name, k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
    }
  }

  /* 1 ACT3Q7_OnOrmusNpcActivateFilter (0x6FD07050) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 2) ? 1u : 0u;
    U8(STAGE_QUEST0 + 0x09u) = (k == 1) ? 0u : 1u;
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ormus_activate_k%d", k);
    run_and_emit(0x6FD07050u, "ACT3Q7_OnOrmusNpcActivateFilter_6FD07050_113c", k, lbl, &c, ts, 2, 0xFFu, 0);
  }
}

/* =========================================================================
 * PART A2 — 7 InitQuestData Hi-VAs (m.alloc parity fix)
 * ========================================================================= */
static void emit_part_a2_init_quests(void) {
  X86CallSpec c;
  int64_t ts[4];
  char lbl[48];

  static const struct { uint32_t va; const char *name; } kInitQuests[] = {
    { 0x6FCE7080u, "ACT2Q5_InitQuestData_6FCE7080_113c" },
    { 0x6FCE7480u, "ACT2Q3_InitQuestData_6FCE7480_113c" },
    { 0x6FCE7B40u, "ACT2Q1_InitQuestData_6FCE7B40_113c" },
    { 0x6FCE9400u, "ACT2Q4_InitQuestData_6FCE9400_113c" },
    { 0x6FD06660u, "ACT3Q0_InitHratliIntroQuestTable_6FD06660_113c" },
    { 0x6FD07CE0u, "ACT3Q3_InitQuestData_6FD07CE0_113c" },
    { 0x6FD0A080u, "ACT3Q6_InitQuestData_6FD0A080_113c" },
  };
  for (size_t i = 0; i < sizeof(kInitQuests) / sizeof(kInitQuests[0]); i++) {
    for (int k = 0; k < 3; k++) {
      reset_case();
      U8(STAGE_GAME + 0x6Du) = (uint8_t)k;
      U32(STAGE_QUEST0 + 0x00u) = (uint32_t)(8 + i);
      U32(STAGE_QUEST0 + 0x04u) = STAGE_GAME;
      U8(STAGE_QUEST0 + 0x09u)  = (uint8_t)(k & 1);
      c = make_call();
      c.ecx = STAGE_QUEST0; c.calleePop = 0u;
      ts[0] = STAGE_QUEST0;
      snprintf(lbl, sizeof(lbl), "init_quest_diff%d", k);
      run_and_emit(kInitQuests[i].va, kInitQuests[i].name, k, lbl, &c, ts, 1, 0u, 0);
    }
  }
}

/* =========================================================================
 * PART A3 — 10 Skills Hi-VAs (stack-local m.alloc & assert parity fixes)
 * ========================================================================= */
static void emit_part_a3_skills_hivas(void) {
  X86CallSpec c;
  int64_t ts[10];
  char lbl[48];

  /* [1] 0x6FCC06F0 SKILLS_ForEachUnitNearTargetCoords (eax=dwSize, stack=[pGame,dwFlags,pUnit,pCbArg,pfnCb], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5000u, 5000u, 0x1111u);
    if (k != 1) {
      U16(STAGE_PATH0 + 0x10u) = 5004u;
      U16(STAGE_PATH0 + 0x12u) = 5002u;
    }
    uint32_t validCb = (uint32_t)((uintptr_t)g_hGame + 0xA3920u); /* valid code addr inside D2Game */
    uint32_t cbArg = (k == 0) ? 0u : validCb;
    c = make_call();
    c.eax = (uint32_t)(4 + k);
    c.nargs = 5;
    c.args[0] = STAGE_GAME;
    c.args[1] = 0x20003u;
    c.args[2] = STAGE_UNIT0;
    c.args[3] = STAGE_SCRATCH;
    c.args[4] = cbArg;
    c.calleePop = 0x14u;
    ts[0] = 4 + k; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT0; ts[3] = 0x20003;
    ts[4] = (k == 0) ? 0 : (int64_t)(D2GAME_PREF_BASE + 0xA3920u);
    ts[5] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), k == 0 ? "null_cb_assert" : (k == 1 ? "zero_target_coords" : "empty_room"));
    run_and_emit(0x6FCC06F0u, "SKILLS_ForEachUnitNearTargetCoords_6FCC06F0_113c", k, lbl, &c, ts, 6, 0u, (k == 0));
  }

  /* [2] 0x6FCC1000 AURA_FindClosestUnitInRadius (esi=pCenterUnit, stack=[pGame, nRadius, pfnFilter], ret 0xc) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5000u, 5000u, 0x2222u);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    if (k >= 1) {
      uint16_t mx = (k == 1) ? 5003u : 5020u;
      uint16_t my = (k == 1) ? 5002u : 5020u;
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 200u, 1u, mx, my, 0x3333u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 1000, 0);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    }
    c = make_call();
    c.esi = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = 8u; c.args[2] = 0u;
    c.calleePop = 0x0Cu;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = 8; ts[3] = 0;
    snprintf(lbl, sizeof(lbl), "find_closest_k%d", k);
    run_and_emit(0x6FCC1000u, "AURA_FindClosestUnitInRadius_6FCC1000_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [3] 0x6FCC2F90 SKILLS_ApplyStunStateAndNeutralModeToMonster (eax=nDuration, ecx=pUnit, stack=[pGame], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t u = (k == 0) ? 0u : STAGE_UNIT0;
    if (k == 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5000u, 5000u, 0x1111u);
    } else if (k >= 2) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 200u, 1u, 5000u, 5000u, 0x1111u);
      U32(STAGE_UNIT0 + 0xC4u) = 0x00000005u;
      if (k == 2) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x36, 1);
    }
    c = make_call();
    c.eax = (k == 3) ? 50u : 25u;
    c.ecx = u;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (k == 3) ? 50 : 25; ts[1] = u; ts[2] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "apply_stun_k%d", k);
    run_and_emit(0x6FCC2F90u, "SKILLS_ApplyStunStateAndNeutralModeToMonster_6FCC2F90_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [4] 0x6FCC3B50 SKILLS_CheckMonsterDeadAlongReverseVelocitySteps (stack=[pGame, pUnit], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    if (k == 0) {
      /* null room -> asserts 0x141b */
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, 0u, STAGE_ROOM0, 20u, 200u, 1u, 5000u, 5000u, 0x1111u);
    } else {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 20u, 200u, 1u, 5000u, 5000u, 0x1111u);
      if (k == 2) {
        /* dead monster of classId = 20 - 19 = 1 in STAGE_ROOM0 */
        stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 201u, 12u, 5000u, 5000u, 0x2222u);
        link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
      }
    }
    c = make_call();
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), k == 0 ? "null_room_assert" : (k == 1 ? "no_dead_mon" : "dead_mon_found"));
    run_and_emit(0x6FCC3B50u, "SKILLS_CheckMonsterDeadAlongReverseVelocitySteps_6FCC3B50_113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, (k == 0));
  }

  /* [5] 0x6FCD39F0 SKILLS_DoFindPotionOrGrimWardRadiusCurse (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 100u, 1u, 5000u, 5000u, 0x1111u);
    if (k >= 1) {
      U16(STAGE_PATH0 + 0x10u) = 5004u;
      U16(STAGE_PATH0 + 0x12u) = 5002u;
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    }
    int32_t skId = (k == 2) ? 150 : 146; /* Grim Ward / Battle Cry */
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)skId; c.args[1] = (uint32_t)(k + 1); c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = k + 1;
    snprintf(lbl, sizeof(lbl), "radius_curse_k%d", k);
    run_and_emit(0x6FCD39F0u, "SKILLS_DoFindPotionOrGrimWardRadiusCurse_6FCD39F0_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [6] 0x6FCD3B20 SKILLS_DoFeralRageOrHungerHit (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 5u, 100u, 1u, 5000u, 5000u, 0x12345u + (uint32_t)k);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 20, 0);
    if (k == 2) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 200u, 1u, 5001u, 5000u, 0x54321u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 5000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 5000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 10, 0);
      fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    int32_t skId = (k == 0) ? -1 : 232; /* Feral Rage */
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)skId; c.args[1] = 3u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 3;
    snprintf(lbl, sizeof(lbl), "feral_rage_k%d", k);
    run_and_emit(0x6FCD3B20u, "SKILLS_DoFeralRageOrHungerHit_6FCD3B20_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [7] 0x6FCD4DE0 SKILLS_DoTeethOrMultipleShotFan (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 100u, 1u, 5000u, 5000u, 0x22222u);
    if (k == 2) {
      U16(STAGE_PATH0 + 0x10u) = 5006u;
      U16(STAGE_PATH0 + 0x12u) = 5000u;
    }
    int32_t skId = (k == 0) ? -1 : 67; /* Teeth */
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)skId; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 1;
    snprintf(lbl, sizeof(lbl), "teeth_fan_k%d", k);
    run_and_emit(0x6FCD4DE0u, "SKILLS_DoTeethOrMultipleShotFan_6FCD4DE0_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [8] 0x6FCD4FF0 SKILLS_DoChargedBoltOrSpiderWebFan (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 100u, 1u, 5000u, 5000u, 0x33333u);
    if (k == 2) {
      U16(STAGE_PATH0 + 0x10u) = 5006u;
      U16(STAGE_PATH0 + 0x12u) = 5002u;
    }
    int32_t skId = (k == 0) ? -1 : 38; /* Charged Bolt */
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)skId; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 1;
    snprintf(lbl, sizeof(lbl), "cbolt_fan_k%d", k);
    run_and_emit(0x6FCD4FF0u, "SKILLS_DoChargedBoltOrSpiderWebFan_6FCD4FF0_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [9] 0x6FCD56C0 SKILLS_DoBlazeOrInfernoStepMissile (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 100u, 1u, 5000u, 5000u, 0x44444u + (uint32_t)k);
    U16(STAGE_PATH0 + 0x10u) = 5006u;
    U16(STAGE_PATH0 + 0x12u) = 5000u;
    int32_t skId = (k == 0) ? -1 : 46; /* Blaze */
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)skId; c.args[1] = (uint32_t)(k + 1); c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = k + 1;
    snprintf(lbl, sizeof(lbl), "blaze_step_k%d", k);
    run_and_emit(0x6FCD56C0u, "SKILLS_DoBlazeOrInfernoStepMissile_6FCD56C0_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [10] 0x6FCD6840 SKILLS_SrvDoInfernoChannelTick (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, (k == 1 ? 0u : STAGE_PATH0), STAGE_ROOM0, 0u, 1u, 100u, 1u, 5000u, 5000u, 0x55555u);
    if (k == 2) {
      U16(STAGE_PATH0 + 0x10u) = 5006u;
      U16(STAGE_PATH0 + 0x12u) = 5002u;
    }
    int32_t skId = (k == 0) ? -1 : 41; /* Inferno */
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)skId; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 2;
    snprintf(lbl, sizeof(lbl), "inferno_tick_k%d", k);
    run_and_emit(0x6FCD6840u, "SKILLS_SrvDoInfernoChannelTick_6FCD6840_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }
}

/* =========================================================================
 * PART A4 — 9 Remaining Hi-VAs
 * ========================================================================= */
static void emit_part_a4_remaining_hivas(void) {
  X86CallSpec c;
  int64_t ts[10];
  char lbl[48];

  /* [1] 0x6FCC1350 SKILLS_CreateDroppedItemByCodeAtUnit (eax=dwItemCode, ebx=pUnit, stack=[pGame, nQuality], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t path = (k == 1) ? 0u : STAGE_PATH0;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, path, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5000u, 5000u, 0x11111u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 10, 0);
    uint32_t code = (k == 0) ? 0x39393939u : 0x20647373u; /* invalid vs 'ssd ' */
    c = make_call();
    c.eax = code; c.ebx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = code; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME; ts[3] = 2;
    snprintf(lbl, sizeof(lbl), k == 0 ? "bad_code" : (k == 1 ? "no_room" : "drop_ssd"));
    run_and_emit(0x6FCC1350u, "SKILLS_CreateDroppedItemByCodeAtUnit_6FCC1350_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [2] 0x6FCC66E0 MONAI_SiegeRunnerThink (ecx=pGame, edx=pUnit, stack=[pAiParam], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 110u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 460u, 200u, 1u, 5000u, 5000u, 0x13579u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5002u, 5000u, 0x2468Au);
    if (k == 0) U32(STAGE_UNIT0 + 0xD0u) = 0x0Bu; /* triggers pGame+0x1118 link */
    uint32_t pAiParam = STAGE_SCRATCH;
    uint32_t pMonStats = U32(STAGE_UDATA0 + 0x00u);
    U32(pAiParam + 0x08u) = (k == 2) ? 0u : STAGE_UNIT1;
    S32(pAiParam + 0x14u) = 3;
    S32(pAiParam + 0x18u) = (k == 0) ? 1 : 0;
    U32(pAiParam + 0x1Cu) = pMonStats;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = pAiParam; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pAiParam;
    snprintf(lbl, sizeof(lbl), "siege_runner_k%d", k);
    run_and_emit(0x6FCC66E0u, "MONAI_SiegeRunnerThink_6FCC66E0_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [3] 0x6FCC6AB0 MONAI_TryCastLeftSkillOrRunTowardTarget
     (eax=pSelf, ecx=nSkillId, esi=pTarget, edi=pCaster, stack=[pGame, bForceCast, nX, nY], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 200u, 1u, 5000u, 5000u, 0x11111u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5010u, 5004u, 0x22222u);
    uint32_t target = (k == 0) ? STAGE_UNIT0 : (k == 1 ? STAGE_UNIT2 : STAGE_UNIT1);
    uint32_t caster = (k == 1) ? STAGE_UNIT2 : STAGE_UNIT0;
    uint32_t forceCast = (k == 2) ? 1u : 0u;
    if (k == 2) {
      U32(STAGE_SCRATCH) = 0x55551234u;
    }
    c = make_call();
    c.eax = STAGE_UNIT0; c.ecx = (k == 2) ? 36u : 6u; c.esi = target; c.edi = caster;
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = forceCast; c.args[2] = 5010u; c.args[3] = 5004u;
    c.calleePop = 0x10u;
    ts[0] = STAGE_UNIT0; ts[1] = target; ts[2] = caster; ts[3] = STAGE_GAME;
    ts[4] = (k == 2) ? 36 : 6; ts[5] = forceCast; ts[6] = 5010; ts[7] = 5004;
    snprintf(lbl, sizeof(lbl), "try_cast_left_k%d", k);
    run_and_emit(0x6FCC6AB0u, "MONAI_TryCastLeftSkillOrRunTowardTarget_6FCC6AB0_113c", k, lbl, &c, ts, 8, 0xFFFFFFFFu, 0);
  }

  /* [4] 0x6FCDAFF0 ACT4Q3_SpawnLastPortalObject (eax=pNpcParams, stack=[pQuestCustomData], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 108u);
    if (k == 2) U32(STAGE_GAME + 0x70u) = 0u; /* Classic */
    uint32_t path = (k == 0) ? 0u : STAGE_PATH0;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, path, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5000u, 5000u, 0x12345u);
    uint32_t pNpcParams = STAGE_SCRATCH;
    U32(pNpcParams + 0x00u) = STAGE_GAME;
    U32(pNpcParams + 0x08u) = STAGE_UNIT0;
    c = make_call();
    c.eax = pNpcParams;
    c.nargs = 1; c.args[0] = STAGE_QUESTEX0; c.calleePop = 4u;
    ts[0] = pNpcParams; ts[1] = STAGE_QUESTEX0;
    snprintf(lbl, sizeof(lbl), k == 0 ? "no_room" : (k == 1 ? "spawn_exp" : "spawn_classic"));
    run_and_emit(0x6FCDAFF0u, "ACT4Q3_SpawnLastPortalObject_6FCDAFF0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [5] 0x6FCDB550 ACT4Q3_OnDiabloDeathPortalWarpToAct5 (ecx=pQuestArg, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 108u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5000u, 5000u, 0x11111u);
    uint32_t pQBuf = 0u;
    stage_player_quest_flags(STAGE_UDATA0, &pQBuf);
    if (k == 0) U32(STAGE_GAME + 0x70u) = 0u; /* Classic -> early 0 */
    if (k == 2) set_quest_flag_bit(pQBuf, 0x1Au, 1u); /* bit 1 set, bit 0 clear -> sound 0x13 with pPlayer */
    uint32_t pOpArg = STAGE_SCRATCH;
    U32(pOpArg + 0x00u) = STAGE_GAME;
    U32(pOpArg + 0x04u) = STAGE_UNIT1;
    U32(pOpArg + 0x08u) = STAGE_UNIT0;
    c = make_call();
    c.ecx = pOpArg; c.calleePop = 0u;
    ts[0] = pOpArg;
    snprintf(lbl, sizeof(lbl), k == 0 ? "classic_skip" : (k == 1 ? "no_quest_sound13" : "bit1_sound13"));
    run_and_emit(0x6FCDB550u, "ACT4Q3_OnDiabloDeathPortalWarpToAct5_6FCDB550_113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [6] 0x6FCE76B0 ACT2Q3_OperateTaintedSunAltar (ecx=pOpStrc, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 61u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5000u, 5000u, 0x11111u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 149u, 300u, (k == 2 ? 1u : 0u), 5002u, 5000u, 0x22222u);
    uint32_t pQBuf = 0u;
    stage_player_quest_flags(STAGE_UDATA0, &pQBuf);
    if (k >= 1) {
      U32(STAGE_QUEST0 + 0x00u) = 0x0Au;
      U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
      U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
      U32(STAGE_GAME + 0x10F4u) = STAGE_QUESTCTRL;
    }
    if (k == 1) {
      set_quest_flag_bit(pQBuf, 0x0Bu, 0u);
      set_quest_flag_bit(pQBuf, 0x0Au, 0u); /* triggers sound 0x13 & return 0 */
    }
    uint32_t pOp = STAGE_SCRATCH;
    U32(pOp + 0x00u) = STAGE_GAME;
    U32(pOp + 0x04u) = STAGE_UNIT1;
    U32(pOp + 0x08u) = STAGE_UNIT0;
    c = make_call();
    c.ecx = pOp; c.calleePop = 0u;
    ts[0] = pOp;
    snprintf(lbl, sizeof(lbl), k == 0 ? "no_qctrl" : (k == 1 ? "already_done_sound13" : "altar_already_open"));
    run_and_emit(0x6FCE76B0u, "ACT2Q3_OperateTaintedSunAltar_6FCE76B0_113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [7] 0x6FCFE8F0 SUNITDMG_ComputeExperienceGain
     (eax=pPlayer, stack=[pGame, pMonster, nPlayerLvl, nMonsterLvl, dwBaseExp], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5000u, 5000u, 0x11111u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 200u, 1u, 5002u, 5000u, 0x22222u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, (k == 2 ? 10 : 5), 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 13, 12000, 0);
    if (k >= 1) {
      link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 100u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    if (k == 2) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 85, 20, 0);
    }
    int32_t pLvl = (k == 2) ? 10 : 5;
    int32_t mLvl = (k == 2) ? 12 : 5;
    int32_t bExp = (k == 2) ? 2000 : 1000;
    c = make_call();
    c.eax = STAGE_UNIT0;
    c.nargs = 5;
    c.args[0] = STAGE_GAME;
    c.args[1] = STAGE_UNIT1;
    c.args[2] = (uint32_t)pLvl;
    c.args[3] = (uint32_t)mLvl;
    c.args[4] = (uint32_t)bExp;
    c.calleePop = 0x14u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = mLvl; ts[3] = bExp; ts[4] = STAGE_UNIT1; ts[5] = pLvl;
    snprintf(lbl, sizeof(lbl), k == 0 ? "no_party_client" : (k == 1 ? "solo_exp" : "solo_exp_bonus"));
    run_and_emit(0x6FCFE8F0u, "SUNITDMG_ComputeExperienceGain113c", k, lbl, &c, ts, 6, 0u, 0);
  }

  /* [8] 0x6FD10F40 PARTY_ToggleLootPermission
     (ecx=pGame, edx=pSource, stack=[pTarget, dwEnable, pOutErr], ret 0xc) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, (k == 1 ? 0u : 3u), 100u, 1u, 5000u, 5000u, 0x11111u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 101u, 1u, 5002u, 5000u, 0x22222u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 100u);
    stage_client_pkt_pool(STAGE_CLIENT1);
    link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT1, 101u);
    U32(STAGE_CLIENT + 0x4A8u) = STAGE_CLIENT1;
    U8(STAGE_CLIENT + 0x0Au) = (k == 0) ? 0u : 4u; /* hardcore bit 4 */
    uint32_t enable = (k == 1) ? 1u : 0u;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = STAGE_UNIT1; c.args[1] = enable; c.args[2] = STAGE_SCRATCH;
    c.calleePop = 0x0Cu;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = enable; ts[4] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), k == 0 ? "softcore_skip" : (k == 1 ? "hc_enable_zon" : "hc_disable_pal"));
    run_and_emit(0x6FD10F40u, "PARTY_ToggleLootPermission_6FD10F40_113c", k, lbl, &c, ts, 5, 0u, 0);
  }

  /* [9] 0x6FD11130 PARTY_SetOrClearPlayerHostility
     (ecx=pGame, edx=pSource, stack=[pTarget, bHostile, pOutErr], ret 0xc) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t path0 = (k == 0) ? 0u : STAGE_PATH0;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, path0, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5000u, 5000u, 0x11111u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 101u, 1u, 5002u, 5000u, 0x22222u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 12, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 12, 0);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 100u);
    stage_client_pkt_pool(STAGE_CLIENT1);
    link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT1, 101u);
    U32(STAGE_CLIENT + 0x4A8u) = STAGE_CLIENT1;
    uint32_t bHostile = (k == 1) ? 1u : 0u;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = STAGE_UNIT1; c.args[1] = bHostile; c.args[2] = STAGE_SCRATCH;
    c.calleePop = 0x0Cu;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = bHostile; ts[4] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), k == 0 ? "no_room" : (k == 1 ? "hostile_on" : "hostile_off"));
    run_and_emit(0x6FD11130u, "PARTY_SetOrClearPlayerHostility_6FD11130_113c", k, lbl, &c, ts, 5, 0u, 0);
  }
}

/* =========================================================================
 * PART B1 — Path & Missile Cluster (8 Reserved Lo-VAs)
 * ========================================================================= */
static void emit_part_b1_path_missile(void) {
  X86CallSpec c;
  int64_t ts[10];
  char lbl[48];

  /* [1] 0x6FC8F930 MISSILE_CreateServerProjectile (ecx=pGame, edx=pParams, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 100u, 1u, 5000u, 5000u, 0x11111u);
    uint32_t pParams = STAGE_SCRATCH;
    if (k >= 1) {
      U32(pParams + 0x00u) = 0x20u; /* flags */
      U32(pParams + 0x04u) = STAGE_UNIT0;
      U32(pParams + 0x08u) = STAGE_UNIT0;
      S32(pParams + 0x10u) = (k == 1) ? 1 : 58; /* arrow vs firebolt/collideType8 */
      S32(pParams + 0x14u) = 5000;
      S32(pParams + 0x18u) = 5000;
      S32(pParams + 0x1Cu) = 5008;
      S32(pParams + 0x20u) = 5002;
      S32(pParams + 0x2Cu) = 36;
      S32(pParams + 0x30u) = 1;
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = pParams; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = pParams;
    snprintf(lbl, sizeof(lbl), k == 0 ? "null_owner" : (k == 1 ? "arrow_missile" : "bolt_missile"));
    run_and_emit(0x6FC8F930u, "MISSILE_CreateServerProjectile113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [2] 0x6FC656B0 SKILLS_SrvDo051_SpawnMultipleBowOrCrossbowProjectiles (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5000u, 5000u, 0x12345u);
    if (k == 2) {
      U16(STAGE_PATH0 + 0x10u) = 5008u;
      U16(STAGE_PATH0 + 0x12u) = 5000u;
    }
    int32_t skId = (k == 0) ? -1 : 12; /* Multiple Shot */
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)skId; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 2;
    snprintf(lbl, sizeof(lbl), "multishot_k%d", k);
    run_and_emit(0x6FC656B0u, "SKILLS_SrvDo051_SpawnMultipleBowOrCrossbowProjectiles_6FC656B0_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [3] 0x6FCB5040 SKILLS_SrvDo_SpawnChargedNovaOnTarget (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 100u, 1u, 5000u, 5000u, 0x12345u);
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 200u, 1u, 5001u, 5000u, 0x22222u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 5000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 5000, 0);
      fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    int32_t skId = (k == 1) ? -1 : 254; /* Tiger Strike / Claws of Thunder */
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)skId; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 2;
    snprintf(lbl, sizeof(lbl), "charged_nova_k%d", k);
    run_and_emit(0x6FCB5040u, "SKILLS_SrvDo_SpawnChargedNovaOnTarget_6FCB5040_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [4] 0x6FC5B210 MISSILE_SrvHit_RadialStatsDamageAndSubMissile (ecx=pGame, edx=pMissile, stack=[pHitUnit], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mis = (k == 0) ? 0u : STAGE_UNIT0;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, (k == 1 ? 0xFFFFFFFFu : 58u), 300u, 0u, 5000u, 5000u, 0x11111u);
      U32(STAGE_UDATA0 + 0x08u) = 1u; /* nSkillLevel */
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = mis;
    c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = mis; ts[2] = 0;
    snprintf(lbl, sizeof(lbl), "srvhit_radial_k%d", k);
    run_and_emit(0x6FC5B210u, "MISSILE_SrvHit_RadialStatsDamageAndSubMissile_6FC5B210_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [5] 0x6FC5C5B0 MISSILES_SrvHit_SpawnScaledBurstSubMissiles (ecx=pGame, edx=pMissile, stack=[pHitTarget], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mis = (k == 0) ? 0u : STAGE_UNIT0;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, (k == 1 ? 0xFFFFFFFFu : 100u), 300u, 0u, 5000u, 5000u, 0x11111u);
      U32(STAGE_UDATA0 + 0x08u) = 2u;
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = mis;
    c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = mis; ts[2] = 0;
    snprintf(lbl, sizeof(lbl), "srvhit_burst_k%d", k);
    run_and_emit(0x6FC5C5B0u, "MISSILES_SrvHit_SpawnScaledBurstSubMissiles_6FC5C5B0_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [6] 0x6FC2D370 SKILLS_SrvDo005_PerpendicularLineMissiles (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 100u, 1u, 5000u, 5000u, 0x12345u);
    if (k == 2) {
      U16(STAGE_PATH0 + 0x10u) = 5006u;
      U16(STAGE_PATH0 + 0x12u) = 5002u;
    }
    int32_t skId = (k == 0) ? -1 : 51; /* Fire Wall */
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)skId; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 1;
    snprintf(lbl, sizeof(lbl), "perp_line_k%d", k);
    run_and_emit(0x6FC2D370u, "SKILLS_SrvDo005_PerpendicularLineMissiles_6FC2D370_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [7] 0x6FC2D5D0 SKILLS_SpawnChargedBoltFanMissiles
     (edx=pUnit, stack=[pGame, nMissileId, nCount, nSkillId, nSkillLevel], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 100u, 1u, 5000u, 5000u, 0x12345u);
    if (k >= 1) {
      U16(STAGE_PATH0 + 0x10u) = 5006u;
      U16(STAGE_PATH0 + 0x12u) = 5002u;
    }
    int32_t nCount = (k == 2) ? 3 : 1;
    c = make_call();
    c.edx = STAGE_UNIT0;
    c.nargs = 5;
    c.args[0] = STAGE_GAME;
    c.args[1] = 58u;
    c.args[2] = (uint32_t)nCount;
    c.args[3] = 38u;
    c.args[4] = 1u;
    c.calleePop = 0x14u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = 58; ts[3] = nCount; ts[4] = 38; ts[5] = 1;
    snprintf(lbl, sizeof(lbl), "cbolt_spawn_k%d", k);
    run_and_emit(0x6FC2D5D0u, "SKILLS_SpawnChargedBoltFanMissiles_6FC2D5D0_113c", k, lbl, &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* [8] 0x6FC6D040 SKILLS_SrvDo_ChargedStrikeBolts (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5000u, 5000u, 0x12345u);
    if (k == 2) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 200u, 1u, 5001u, 5000u, 0x22222u);
      fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    int32_t skId = (k == 0) ? -1 : 24; /* Charged Strike */
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)skId; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 1;
    snprintf(lbl, sizeof(lbl), "charged_strike_k%d", k);
    run_and_emit(0x6FC6D040u, "SKILLS_SrvDo_ChargedStrikeBolts_6FC6D040_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }
}

/* =========================================================================
 * PART B2 — 9 Stack-local m.alloc Lo-VAs
 * ========================================================================= */
static void emit_part_b2_stack_local_lovas(void) {
  X86CallSpec c;
  int64_t ts[10];
  char lbl[48];

  /* [1] 0x6FCB2A60 SKILLS_RollHitAndAllocProgressiveChargeCombat
     (eax=pAttacker, stack=[pGame, pTarget, nSkillId, nSkillLevel], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 100u, 1u, 5000u, 5000u, 0x11111u + (uint32_t)k);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 200u, 1u, 5001u, 5000u, 0x22222u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 20, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 5, 0);
    int32_t skId = (k == 0) ? -1 : 254; /* Tiger Strike */
    c = make_call();
    c.eax = STAGE_UNIT0;
    c.nargs = 4;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.args[2] = (uint32_t)skId; c.args[3] = (uint32_t)(k + 1);
    c.calleePop = 0x10u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT1; ts[3] = skId; ts[4] = k + 1;
    snprintf(lbl, sizeof(lbl), "prog_charge_k%d", k);
    run_and_emit(0x6FCB2A60u, "SKILLS_RollHitAndAllocProgressiveChargeCombat_6FCB2A60_113c", k, lbl, &c, ts, 5, 0u, 0);
  }

  /* [2] 0x6FCB5690 SKILLS_SrvDo_AllocProgressiveChargeAttack (ecx=pGame, edx=pAttacker, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 100u, 1u, 5000u, 5000u, 0x11111u + (uint32_t)k);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 20, 0);
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 200u, 1u, 5001u, 5000u, 0x22222u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 5, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 5000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 5000, 0);
      fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    int32_t skId = (k == 1) ? -1 : 254;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)skId; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 2;
    snprintf(lbl, sizeof(lbl), "srvdo_prog_k%d", k);
    run_and_emit(0x6FCB5690u, "SKILLS_SrvDo_AllocProgressiveChargeAttack_6FCB5690_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [3] 0x6FCB2CC0 SKILLS_RadialAvoidAndApplyDamageCallback (ecx=pAuraCtx, edx=pDefender, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 100u, 1u, 5000u, 5000u, 0x11111u + (uint32_t)k);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 200u, 1u, 5002u, 5000u, 0x22222u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 5000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 5000, 0);
    U32(STAGE_DMG + 0x00u) = 0x00000001u;
    U16(STAGE_DMG + 0x04u) = 0x0001u;
    U32(STAGE_DMG + 0x08u) = (uint32_t)(256 * (k + 1));
    uint32_t pAura = STAGE_SCRATCH;
    U32(pAura + 0x00u) = STAGE_GAME;
    U32(pAura + 0x04u) = STAGE_UNIT0;
    U32(pAura + 0x0Cu) = STAGE_DMG;
    c = make_call();
    c.ecx = pAura; c.edx = STAGE_UNIT1; c.calleePop = 0u;
    ts[0] = pAura; ts[1] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "radial_avoid_k%d", k);
    run_and_emit(0x6FCB2CC0u, "SKILLS_RadialAvoidAndApplyDamageCallback_6FCB2CC0_113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [4] 0x6FCB3040 SKILLS_ApplyRadialDamageCallback (ecx=pAuraCtx, edx=pTarget, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 100u, 1u, 5000u, 5000u, 0x11111u + (uint32_t)k);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 200u, 1u, 5000u, 5000u, 0x22222u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 20, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 5, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 5000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 5000, 0);
    U32(STAGE_DMG + 0x00u) = 0x00000003u;
    U32(STAGE_DMG + 0x08u) = 256u;
    U32(STAGE_DMG + 0x14u) = 256u;
    uint32_t pSub = STAGE_SCRATCH + 0x40u;
    U32(pSub + 0x00u) = STAGE_DMG;
    S32(pSub + 0x04u) = 100 * (k + 1);
    U16(pSub + 0x08u) = (k == 2) ? 0x0002u : 0x0000u;
    U32(pSub + 0x0Cu) = 0x00000001u;
    U8(pSub + 0x10u)  = 0u;
    uint32_t pAura = STAGE_SCRATCH;
    U32(pAura + 0x00u) = STAGE_GAME;
    U32(pAura + 0x04u) = STAGE_UNIT0;
    U32(pAura + 0x0Cu) = pSub;
    c = make_call();
    c.ecx = pAura; c.edx = STAGE_UNIT1; c.calleePop = 0u;
    ts[0] = pAura; ts[1] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "radial_dmg_k%d", k);
    run_and_emit(0x6FCB3040u, "SKILLS_ApplyRadialDamageCallback_6FCB3040_113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [5] 0x6FCB0560 NPCS_UpdateTownVendorSlotsOnPlayerLeave (eax=pGame, stack=[pPlayer], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t lvlId = (k == 2) ? 2u : 1u; /* town vs wilderness */
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvlId);
    uint32_t pNpcCtrl = (uint32_t)(uintptr_t)bump_alloc(0x20u);
    U32(STAGE_GAME + 0x1D24u) = pNpcCtrl;
    if (k == 0) U8(STAGE_GAME + 0x6Au) = 3u; /* game type 3 -> skip */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5000u, 5000u, 0x11111u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 100u);
    c = make_call();
    c.eax = STAGE_GAME;
    c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), k == 0 ? "type3_skip" : (k == 1 ? "act1_town" : "non_town"));
    run_and_emit(0x6FCB0560u, "NPCS_UpdateTownVendorSlotsOnPlayerLeave_6FCB0560_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [6] 0x6FCB8E30 SKILLS_FindClosestTargetInRadius3 (eax=nFilterUnitId, ecx=pCenterUnit, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 3u, 100u, 1u, 5000u, 5000u, 0x11111u);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 200u, 1u, 5002u, 5000u, 0x22222u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 5000, 0);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    }
    uint32_t filt = (k == 2) ? 200u : 999u;
    c = make_call();
    c.eax = filt; c.ecx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = filt; ts[2] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "find_r3_k%d", k);
    run_and_emit(0x6FCB8E30u, "SKILLS_FindClosestTargetInRadius3_6FCB8E30_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [7] 0x6FCB2770 SKILLS_SrvDo_ApplyDirectDamageAndKnockbackRoll (ecx=pGame, edx=pAttacker, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 100u, 1u, 5000u, 5000u, 0x11111u + (uint32_t)k);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 20, 0);
    if (k == 2) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 200u, 1u, 5001u, 5000u, 0x22222u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 5, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 5000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 5000, 0);
      fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    int32_t skId = (k == 0) ? -1 : 255; /* Dragon Talon */
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)skId; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 2;
    snprintf(lbl, sizeof(lbl), "dtalon_kb_k%d", k);
    run_and_emit(0x6FCB2770u, "SKILLS_SrvDo_ApplyDirectDamageAndKnockbackRoll_6FCB2770_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [8] 0x6FCB3BC0 SKILLS_SrvDo_SpawnChargeScaledClusterMissiles (ecx=pGame, edx=pCaster, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 100u, 1u, 5000u, 5000u, 0x11111u + (uint32_t)k);
    if (k == 2) {
      U16(STAGE_PATH0 + 0x10u) = 5004u;
      U16(STAGE_PATH0 + 0x12u) = 5002u;
    }
    int32_t skId = (k == 0) ? -1 : 259; /* Fists of Fire */
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)skId; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 1;
    snprintf(lbl, sizeof(lbl), "cluster_mis_k%d", k);
    run_and_emit(0x6FCB3BC0u, "SKILLS_SrvDo_SpawnChargeScaledClusterMissiles_6FCB3BC0_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [9] 0x6FCB4970 SKILLS_SrvDo_SpawnChargeScaledAreaRainMissiles (ecx=pGame, edx=pCaster, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 100u, 1u, 5000u, 5000u, 0x22222u + (uint32_t)k);
    if (k == 2) {
      U16(STAGE_PATH0 + 0x10u) = 5004u;
      U16(STAGE_PATH0 + 0x12u) = 5002u;
    }
    int32_t skId = (k == 0) ? -1 : 274; /* Blades of Ice */
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)skId; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 1;
    snprintf(lbl, sizeof(lbl), "area_rain_k%d", k);
    run_and_emit(0x6FCB4970u, "SKILLS_SrvDo_SpawnChargeScaledAreaRainMissiles_6FCB4970_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }
}

/* =========================================================================
 * PART B3 — 3 Classic Item Quality Roll Lo-VAs
 * ========================================================================= */
static void emit_part_b3_classic_items(void) {
  X86CallSpec c;
  int64_t ts[8];
  char lbl[48];

  /* [1] 0x6FC2EE90 ITEMS_RollItemQualityOnCreatedItem (stack=[pItem, pItemDrop], ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5000u, 5000u, 0x11111u);
    uint16_t fmt = (k == 3) ? 101u : 0u; /* Classic (0) vs Expansion (101) */
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_item_sword, 500u, 0u, 20u, fmt, 0x13579BDFu + (uint32_t)k * 0x10101u);
    uint32_t pDrop = STAGE_SCRATCH;
    U32(pDrop + 0x00u) = STAGE_UNIT1;
    U32(pDrop + 0x08u) = STAGE_GAME;
    U32(pDrop + 0x0Cu) = 20u;
    U32(pDrop + 0x14u) = g_item_sword;
    U32(pDrop + 0x24u) = STAGE_ROOM0;
    U16(pDrop + 0x2Au) = fmt;
    U32(pDrop + 0x30u) = (k == 3) ? 4u : 0u;
    U32(pDrop + 0x80u) = (k == 2) ? 0x40u : 0u;
    uint32_t pItem = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.nargs = 2; c.args[0] = pItem; c.args[1] = pDrop; c.calleePop = 8u;
    ts[0] = pItem; ts[1] = pDrop;
    snprintf(lbl, sizeof(lbl), k == 0 ? "null_item_assert" : (k == 1 ? "classic_roll_a" : (k == 2 ? "classic_roll_b" : "exp_forced_q4")));
    run_and_emit(0x6FC2EE90u, "ITEMS_RollItemQualityOnCreatedItem_6FC2EE90_113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, (k == 0));
  }

  /* [2] 0x6FC304F0 ITEMS_FallbackToMagicQualityAndRollAffixes (eax=ppItem, esi=pdwSeed, ebx=pItemDrop, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5000u, 5000u, 0x11111u);
    uint16_t fmt = (k == 0) ? 0u : 101u;
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_item_sword, 500u, 2u, 20u, fmt, 0x2468ACE1u + (uint32_t)k * 77u);
    uint32_t ppItem = STAGE_SCRATCH;
    uint32_t pdwSeed = STAGE_SCRATCH + 0x08u;
    uint32_t pDrop = STAGE_SCRATCH + 0x20u;
    U32(ppItem) = STAGE_UNIT0;
    U32(pdwSeed) = 0x2468ACE1u + (uint32_t)k * 77u;
    U32(pDrop + 0x00u) = STAGE_UNIT1;
    U32(pDrop + 0x08u) = STAGE_GAME;
    U32(pDrop + 0x0Cu) = 20u;
    U32(pDrop + 0x14u) = g_item_sword;
    U32(pDrop + 0x24u) = STAGE_ROOM0;
    U16(pDrop + 0x2Au) = fmt;
    c = make_call();
    c.eax = ppItem; c.esi = pdwSeed; c.ebx = pDrop; c.calleePop = 0u;
    ts[0] = ppItem; ts[1] = pdwSeed; ts[2] = pDrop;
    snprintf(lbl, sizeof(lbl), "fallback_magic_k%d", k);
    run_and_emit(0x6FC304F0u, "ITEMS_FallbackToMagicQualityAndRollAffixes_6FC304F0_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [3] 0x6FC30730 ITEMS_FallbackToRareQualityAndRollAffixes (ecx=ppItem, eax=pdwSeed, ebx=pItemDrop, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5000u, 5000u, 0x11111u);
    uint16_t fmt = (k == 0) ? 0u : 101u;
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_item_sword, 500u, 2u, 20u, fmt, 0x369CF258u + (uint32_t)k * 99u);
    uint32_t ppItem = STAGE_SCRATCH;
    uint32_t pdwSeed = STAGE_SCRATCH + 0x08u;
    uint32_t pDrop = STAGE_SCRATCH + 0x20u;
    U32(ppItem) = STAGE_UNIT0;
    U32(pdwSeed) = 0x369CF258u + (uint32_t)k * 99u;
    U32(pDrop + 0x00u) = STAGE_UNIT1;
    U32(pDrop + 0x08u) = STAGE_GAME;
    U32(pDrop + 0x0Cu) = 20u;
    U32(pDrop + 0x14u) = g_item_sword;
    U32(pDrop + 0x24u) = STAGE_ROOM0;
    U16(pDrop + 0x2Au) = fmt;
    c = make_call();
    c.ecx = ppItem; c.eax = pdwSeed; c.ebx = pDrop; c.calleePop = 0u;
    ts[0] = ppItem; ts[1] = pdwSeed; ts[2] = pDrop;
    snprintf(lbl, sizeof(lbl), "fallback_rare_k%d", k);
    run_and_emit(0x6FC30730u, "ITEMS_FallbackToRareQualityAndRollAffixes_6FC30730_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }
}

/* =========================================================================
 * PART B4 — 25 High-ROI Wave-W Bug-Unlocked Lo-VAs & Extras
 * ========================================================================= */
static void emit_part_b4_wavew_lovas(void) {
  X86CallSpec c;
  int64_t ts[10];
  char lbl[48];

  /* [1] 0x6FC8BD60 OBJ_TeleportPlayerToRoomPad (ecx=pObject, esi=pPlayer, edi=pTargetRoom, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 300u, 0u, 5004u, 5004u, 0x11111u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5000u, 5000u, 0x22222u);
    link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT, 100u);
    U32(STAGE_ROOM0 + 0x2Cu) = STAGE_ACT0;
    U32(STAGE_ACT0 + 0x18u)  = STAGE_SCRATCH + 0x200u; /* pActUpdateFlag */
    if (k == 2) U32(STAGE_UNIT1 + 0xC4u) |= 0x2000u; /* already has UNITFLAG_ISUPDATE */
    uint32_t plr = (k == 0) ? 0u : STAGE_UNIT1;
    c = make_call();
    c.ecx = STAGE_UNIT0; c.esi = plr; c.edi = STAGE_ROOM0; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0; ts[1] = plr; ts[2] = STAGE_ROOM0;
    snprintf(lbl, sizeof(lbl), k == 0 ? "null_plr_assert" : (k == 1 ? "warp_link_update" : "warp_already_updated"));
    run_and_emit(0x6FC8BD60u, "OBJ_TeleportPlayerToRoomPad_6FC8BD60_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, (k == 0));
  }

  /* [2..4] 3 Lo-VA InitQuestData (0x6FC7FB50, 0x6FC7D5C0, 0x6FC88060) */
  static const struct { uint32_t va; const char *name; } kLoInitQ[] = {
    { 0x6FC7FB50u, "ACT5Q5_InitQuestData_6FC7FB50_113c" },
    { 0x6FC7D5C0u, "ACT5Q4_InitQuestData_6FC7D5C0_113c" },
    { 0x6FC88060u, "ACT1Q6_InitQuestData_6FC88060_113c" },
  };
  for (size_t i = 0; i < 3; i++) {
    for (int k = 0; k < 3; k++) {
      reset_case();
      U8(STAGE_GAME + 0x6Du) = (uint8_t)k;
      U32(STAGE_QUEST0 + 0x00u) = (uint32_t)(30 + i);
      U32(STAGE_QUEST0 + 0x04u) = STAGE_GAME;
      c = make_call();
      c.ecx = STAGE_QUEST0; c.calleePop = 0u;
      ts[0] = STAGE_QUEST0;
      snprintf(lbl, sizeof(lbl), "lo_init_q_diff%d", k);
      run_and_emit(kLoInitQ[i].va, kLoInitQ[i].name, k, lbl, &c, ts, 1, 0u, 0);
    }
  }

  /* [5] 0x6FC847B0 ACT1Q4_SendScrollOfInifussOrderPacket50 (eax=pGame, edi=pPlayer, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 4u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5000u, 5000u, 0x11111u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 100u);
    if (k >= 1) {
      U32(STAGE_QUEST0 + 0x00u) = 4u;
      U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
      U8(STAGE_QUESTEX0 + 0x4Au) = 1u;
      for (uint32_t s = 0; s < 5u; s++) {
        U16(STAGE_QUESTEX0 + s * 2u) = (uint16_t)(0x11u + ((s + (uint32_t)k) % 5u));
      }
      U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
      U32(STAGE_GAME + 0x10F4u) = STAGE_QUESTCTRL;
    }
    c = make_call();
    c.eax = STAGE_GAME; c.edi = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), k == 0 ? "no_quest" : (k == 1 ? "send_order_a" : "send_order_b"));
    run_and_emit(0x6FC847B0u, "ACT1Q4_SendScrollOfInifussOrderPacket50_6FC847B0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [6..7] 0x6FC52790 & 0x6FC527B0 OBJECTS_PopulateRoomEdgeObjectsMode1/Mode0
     (ecx=pGame, edx=pRoom, stack=[pRoomCoords], ret 4) */
  static const struct { uint32_t va; const char *name; } kEdgePop[] = {
    { 0x6FC52790u, "OBJECTS_PopulateRoomEdgeObjectsMode1_6FC52790_113c" },
    { 0x6FC527B0u, "OBJECTS_PopulateRoomEdgeObjectsMode0_6FC527B0_113c" },
  };
  for (size_t i = 0; i < 2; i++) {
    for (int k = 0; k < 3; k++) {
      reset_case();
      stage_game_obj_control(0x12345679u + (uint32_t)k * 17u);
      stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0 ? 1u : 2u));
      uint32_t pCoords = STAGE_SCRATCH;
      U32(pCoords + 0x00u) = 4992u;
      U32(pCoords + 0x04u) = 4992u;
      U32(pCoords + 0x08u) = (uint32_t)(2 + k * 2);
      U32(pCoords + 0x0Cu) = (uint32_t)(2 + k * 2);
      c = make_call();
      c.ecx = STAGE_GAME; c.edx = STAGE_ROOM0;
      c.nargs = 1; c.args[0] = pCoords; c.calleePop = 4u;
      ts[0] = STAGE_GAME; ts[1] = STAGE_ROOM0; ts[2] = pCoords;
      snprintf(lbl, sizeof(lbl), "edge_objs_k%d", k);
      run_and_emit(kEdgePop[i].va, kEdgePop[i].name, k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
    }
  }

  /* [8] 0x6FC50E50 OBJECTS_TrySpawnTargetSpotObject67 (eax=pUnit, ecx=pGame, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    /* pick seeds that fail (<=70) vs pass (>70) */
    uint32_t seeds[3] = { 1u, 3u, 9u };
    stage_game_obj_control(seeds[k]);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5000u, 5000u, 0x11111u);
    c = make_call();
    c.eax = STAGE_UNIT0; c.ecx = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "spawn_obj67_k%d", k);
    run_and_emit(0x6FC50E50u, "OBJECTS_TrySpawnTargetSpotObject67_6FC50E50_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [9] 0x6FC522B0 OBJECTS_SpawnPresetTorchOrBrazier
     (ecx=pGame, edx=pRoom, stack=[nObjectId, x, y, bSkipInit], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_game_obj_control(0x13579BDFu + (uint32_t)k * 31u);
    uint32_t lvls[3] = { 2u, 45u, 76u };
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvls[k]);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_ROOM0;
    c.nargs = 4; c.args[0] = 10u; c.args[1] = 5002u; c.args[2] = 5002u; c.args[3] = 1u;
    c.calleePop = 0x10u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_ROOM0; ts[2] = 10; ts[3] = 5002; ts[4] = 5002; ts[5] = 1;
    snprintf(lbl, sizeof(lbl), "preset_torch_k%d", k);
    run_and_emit(0x6FC522B0u, "OBJECTS_SpawnPresetTorchOrBrazier_6FC522B0_113c", k, lbl, &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* [10] 0x6FC531B0 OBJECTS_SpawnPresetBrazierOrTorch244
     (ecx=pGame, edx=pRoom, stack=[nObjectId, x, y, bSkipInit], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_game_obj_control(0x2468ACE1u + (uint32_t)k * 37u);
    uint32_t lvls[3] = { 2u, 25u, 62u };
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvls[k]);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_ROOM0;
    c.nargs = 4; c.args[0] = 10u; c.args[1] = 5002u; c.args[2] = 5002u; c.args[3] = 1u;
    c.calleePop = 0x10u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_ROOM0; ts[2] = 10; ts[3] = 5002; ts[4] = 5002; ts[5] = 1;
    snprintf(lbl, sizeof(lbl), "preset_brazier_k%d", k);
    run_and_emit(0x6FC531B0u, "OBJECTS_SpawnPresetBrazierOrTorch244_6FC531B0_113c", k, lbl, &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* [11] 0x6FC3EE50 MONREG_IsMonsterDeadAtCoords (eax=nY, ecx=nX, stack=[pGame, pOriginRoom, nClassId], ret 0xc) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    if (k == 3) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 5u, 200u, 12u, 5000u, 5000u, 0x11111u);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    }
    uint32_t nx = (k == 0) ? 0u : 5000u;
    uint32_t ny = 5000u;
    uint32_t gm = (k == 1) ? 0u : STAGE_GAME;
    c = make_call();
    c.eax = ny; c.ecx = nx;
    c.nargs = 3; c.args[0] = gm; c.args[1] = STAGE_ROOM0; c.args[2] = 5u;
    c.calleePop = 0x0Cu;
    ts[0] = nx; ts[1] = ny; ts[2] = gm; ts[3] = STAGE_ROOM0; ts[4] = 5;
    snprintf(lbl, sizeof(lbl), k == 0 ? "zero_x_assert" : (k == 1 ? "null_game_assert" : (k == 2 ? "no_mon" : "dead_mon")));
    run_and_emit(0x6FC3EE50u, "MONREG_IsMonsterDeadAtCoords_6FC3EE50_113c", k, lbl, &c, ts, 5, 0xFFFFFFFFu, (k <= 1));
  }

  /* [12] 0x6FC4BE20 PLAYER_CheckAndSendCharSaveToClient (esi=pClient, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5000u, 5000u, 0x11111u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 200u, 1u, 5002u, 5000u, 0x22222u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 100u);
    if (k == 0) {
      U32(STAGE_CLIENT + 0x3D4u) = 0u;
      U32(STAGE_CLIENT + 0x174u) = 0u;
    } else if (k == 1) {
      U32(STAGE_CLIENT + 0x3D4u) = 1u;
      U32(STAGE_CLIENT + 0x174u) = STAGE_UNIT1; /* non-player unit -> assert 0xeb0 */
    } else {
      U32(STAGE_CLIENT + 0x3D4u) = 1u;
      U32(STAGE_CLIENT + 0x1B8u) = 0u;
    }
    c = make_call();
    c.esi = STAGE_CLIENT; c.calleePop = 0u;
    ts[0] = STAGE_CLIENT;
    snprintf(lbl, sizeof(lbl), k == 0 ? "inactive_null" : (k == 1 ? "non_player_assert" : "no_save_buf"));
    run_and_emit(0x6FC4BE20u, "PLAYER_CheckAndSendCharSaveToClient_6FC4BE20_113c", k, lbl, &c, ts, 1, 0u, (k == 1));
  }

  /* [13] 0x6FC7DEF0 ACT5Q3_FindQuest21AndThawFrozenAnya (eax=pGame, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    if (k >= 1) {
      U32(STAGE_QUEST0 + 0x00u) = (k == 1) ? 0x20u : 0x21u;
      U32(STAGE_QUEST0 + 0x04u) = STAGE_GAME;
      U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
      U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
      U32(STAGE_GAME + 0x10F4u) = STAGE_QUESTCTRL;
    }
    c = make_call();
    c.eax = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), k == 0 ? "no_qctrl" : (k == 1 ? "wrong_qid" : "q21_no_anya"));
    run_and_emit(0x6FC7DEF0u, "ACT5Q3_FindQuest21AndThawFrozenAnya_6FC7DEF0_113c", k, lbl, &c, ts, 1, 0u, 0);
  }

  /* [14] 0x6FC6AD80 CLIENTS_CollectAndRecordNearbyPlayerPositions (ebx=pClient, stack=[nMaxCount], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5000u, 5000u, 0x11111u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 101u, 1u, 5003u, 5002u, 0x22222u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 100u);
    if (k == 0) {
      U32(STAGE_CLIENT + 0x1B4u) = 0u; /* null room -> assert 0x6f7 */
    } else if (k == 1) {
      U32(STAGE_CLIENT + 0x1B4u) = STAGE_ROOM0;
      U32(STAGE_ROOM0 + 0x00u) = 0u; /* null ppNear -> assert 0x6f9 */
    } else {
      U32(STAGE_CLIENT + 0x1B4u) = STAGE_ROOM0;
      U32(STAGE_ROOM0 + 0x74u) = STAGE_UNIT1;
    }
    c = make_call();
    c.ebx = STAGE_CLIENT;
    c.nargs = 1; c.args[0] = 4u; c.calleePop = 4u;
    ts[0] = STAGE_CLIENT; ts[1] = 4;
    snprintf(lbl, sizeof(lbl), k == 0 ? "null_room_assert" : (k == 1 ? "null_ppnear_assert" : "collect_valid"));
    run_and_emit(0x6FC6AD80u, "CLIENTS_CollectAndRecordNearbyPlayerPositions_6FC6AD80_113c", k, lbl, &c, ts, 2, 0u, (k <= 1));
  }

  /* [15] 0x6FC4EF50 OBJECTS_InitFn57_InitSpecialChest (ecx=pObjInit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pObjCtrl = stage_game_obj_control(0x11223344u + (uint32_t)k * 13u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (uint32_t)(2 + k * 20));
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 5u, 300u, 0u, 5000u, 5000u, 0x11111u + (uint32_t)k);
    uint32_t pInit = STAGE_SCRATCH;
    U32(pInit + 0x00u) = STAGE_GAME;
    U32(pInit + 0x04u) = STAGE_UNIT0;
    U32(pInit + 0x08u) = STAGE_ROOM0;
    U32(pInit + 0x0Cu) = pObjCtrl;
    U32(pInit + 0x10u) = U32(STAGE_UDATA0 + 0x00u);
    c = make_call();
    c.ecx = pInit; c.calleePop = 0u;
    ts[0] = pInit;
    snprintf(lbl, sizeof(lbl), "special_chest_k%d", k);
    run_and_emit(0x6FC4EF50u, "OBJECTS_InitFn57_InitSpecialChest_6FC4EF50_113c", k, lbl, &c, ts, 1, 0u, 0);
  }

  /* [16] 0x6FC4A2D0 GAME_CommitGlobalGameSlot (stack=[dwGameValue, wSlotIndex], ret 8) */
  {
    uint32_t slotsBase = (uint32_t)((D2GAME_PREF_BASE + 0x110C04u) + g_game_rebase);
    for (int k = 0; k < 3; k++) {
      reset_case();
      uint32_t slot = (uint32_t)(1 + k);
      uint32_t slotAddr = slotsBase + slot * 4u;
      uint32_t savedVal = U32(slotAddr);
      U32(slotAddr) = (k == 0) ? 0x12345678u : 0xFFFFFFFFu;
      g_extra_cap_addr = slotsBase;
      g_extra_cap_len  = 0x20u;
      uint32_t gameVal = 0x30000000u + (uint32_t)k * 0x100u;
      c = make_call();
      c.nargs = 2; c.args[0] = gameVal; c.args[1] = slot; c.calleePop = 8u;
      ts[0] = gameVal; ts[1] = slot;
      snprintf(lbl, sizeof(lbl), k == 0 ? "occupied_assert" : (k == 1 ? "commit_slot2" : "commit_slot3"));
      run_and_emit(0x6FC4A2D0u, "GAME_CommitGlobalGameSlot_6FC4A2D0_113c", k, lbl, &c, ts, 2, 0u, (k == 0));
      U32(slotAddr) = savedVal;
    }
  }

  /* [17] 0x6FC651B0 SKILLS_ApplySkillDamageWithElemDuration
     (eax=nSkillId, ebx=pAttacker, stack=[pGame, pDefender, nDuration, pSkillsTxt, nSkillLevel], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5000u, 5000u, 0x11111u + (uint32_t)k);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 200u, 1u, 5002u, 5000u, 0x22222u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 20, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 5, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 5000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 5000, 0);
    uint32_t pSgpt = U32(D2COM_PREF_BASE + 0x99E1Cu + g_com_rebase);
    uint32_t pSkills = U32(pSgpt + 0xB98u);
    int32_t skId = (k == 2) ? 11 : 7; /* Cold Arrow vs Fire Arrow */
    uint32_t pSkTxt = pSkills + (uint32_t)skId * 0x23Cu;
    int32_t dur = (k == 0) ? 5 : 25; /* tests clamp <10 -> 10 */
    c = make_call();
    c.eax = (uint32_t)skId; c.ebx = STAGE_UNIT0;
    c.nargs = 5;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.args[2] = (uint32_t)dur;
    c.args[3] = pSkTxt; c.args[4] = (uint32_t)(k + 1);
    c.calleePop = 0x14u;
    ts[0] = skId; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = STAGE_GAME;
    ts[4] = dur; ts[5] = pSkTxt; ts[6] = k + 1;
    snprintf(lbl, sizeof(lbl), "skill_elem_dur_k%d", k);
    run_and_emit(0x6FC651B0u, "SKILLS_ApplySkillDamageWithElemDuration_6FC651B0_113c", k, lbl, &c, ts, 7, 0u, 0);
  }

  /* [18] 0x6FCB3110 SKILLS_SrvDo_DragonTailFireSplash (ecx=pGame, edx=pAttacker, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 100u, 1u, 5000u, 5000u, 0x11111u);
    if (k == 2) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 200u, 1u, 5001u, 5000u, 0x22222u);
      fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    int32_t skId = (k == 0) ? -1 : 270; /* Dragon Tail */
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)skId; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 2;
    snprintf(lbl, sizeof(lbl), "dtail_splash_k%d", k);
    run_and_emit(0x6FCB3110u, "SKILLS_SrvDo_DragonTailFireSplash_6FCB3110_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [19] 0x6FC5F6D0 MISSILE_SrvDo_RedemptionCorpsePulseAndStep (ecx=pGame, edx=pMissile, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 100u, 300u, 0u, 5000u, 5000u, 0x11111u);
    U16(STAGE_UDATA0 + 0x06u) = (k == 0) ? 1u : (k == 1 ? 30u : 10u); /* nFramesLeft <=1, >=25, or in-range */
    U16(STAGE_UDATA0 + 0x08u) = 1u;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "redemp_pulse_k%d", k);
    run_and_emit(0x6FC5F6D0u, "MISSILE_SrvDo_RedemptionCorpsePulseAndStep_6FC5F6D0_113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [20] 0x6FC2CA20 SKILLS_SrvDo004_NihlathakCorpseExplosion (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 124u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 526u, 200u, 1u, (uint16_t)(5000u + k), 5000u, 0x11111u + (uint32_t)k);
    if (k == 2) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 201u, 12u, 5003u, 5000u, 0x22222u);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    }
    int32_t skId = (k == 0) ? -1 : 74;
    int32_t skLvl = (k == 2) ? 5 : 1;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)skId; c.args[1] = (uint32_t)skLvl; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = skLvl;
    snprintf(lbl, sizeof(lbl), "nihl_ce_k%d", k);
    run_and_emit(0x6FC2CA20u, "SKILLS_SrvDo004_NihlathakCorpseExplosion_6FC2CA20_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [21] 0x6FC476D0 SKILLS_SrvDo_FindItemCorpseDrop (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 100u, 1u, 5000u, 5000u, 0x11111u);
    if (k == 2) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 200u, 12u, 5001u, 5000u, 0x22222u);
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT1, 0x76, 1); /* already horked -> returns 0 */
      fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    int32_t skId = (k == 0) ? -1 : 142; /* Find Item */
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)skId; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 1;
    snprintf(lbl, sizeof(lbl), "find_item_k%d", k);
    run_and_emit(0x6FC476D0u, "SKILLS_SrvDo_FindItemCorpseDrop_6FC476D0_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [22] 0x6FC448A0 MONUMOD_InitBossAndMinionPackUMods
     (eax=bSpawnMinions, ecx=pCoordNode, edx=pGame, edi=pBoss, stack=[pRoom, uMin, uMax], ret 0xc) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t boss = (k == 0) ? 0u : STAGE_UNIT0;
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 200u, 1u, 5000u, 5000u, 0x11111u + (uint32_t)k);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 1000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 1000, 0);
      if (k == 2) U8(STAGE_UDATA0 + 0x1Cu) = 5u; /* Extra Strong umod */
    }
    c = make_call();
    c.eax = 0u; c.ecx = 0u; c.edx = STAGE_GAME; c.edi = boss;
    c.nargs = 3; c.args[0] = STAGE_ROOM0; c.args[1] = 0u; c.args[2] = 0u;
    c.calleePop = 0x0Cu;
    ts[0] = 0; ts[1] = STAGE_ROOM0; ts[2] = STAGE_GAME; ts[3] = boss; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "init_umods_k%d", k);
    run_and_emit(0x6FC448A0u, "MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c", k, lbl, &c, ts, 5, 0u, 0);
  }

  /* [23] 0x6FC44B70 MONUMOD_PromoteToRandomBossOrChampion (eax=pMonster, ecx=pGame, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mon = (k == 0) ? 0u : STAGE_UNIT0;
    if (k == 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5000u, 5000u, 0x11111u);
    } else if (k == 2) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 200u, 1u, 5000u, 5000u, 0x11111u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 1000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 1000, 0);
    }
    c = make_call();
    c.eax = mon; c.ecx = STAGE_GAME; c.calleePop = 0u;
    ts[0] = mon; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), k == 0 ? "null_mon" : (k == 1 ? "non_monster" : "promote_boss"));
    run_and_emit(0x6FC44B70u, "MONUMOD_PromoteToRandomBossOrChampion_6FC44B70_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [24] 0x6FCBD230 AI_InitMonsterAiThinkFn (ecx=pGame, edx=pUnit, stack=[pAiGen, nAiIdx], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 200u, 1u, 5000u, 5000u, 0x11111u + (uint32_t)k);
    if (k == 0) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x36, 1); /* state 0x36 -> assert 0x1a6 */
    uint32_t pAiGen = U32(STAGE_UDATA0 + 0x28u);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = pAiGen; c.args[1] = (k == 2) ? 1u : 0u;
    c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = pAiGen; ts[3] = (k == 2) ? 1 : 0;
    snprintf(lbl, sizeof(lbl), k == 0 ? "state36_assert" : (k == 1 ? "init_ai_0" : "init_ai_1"));
    run_and_emit(0x6FCBD230u, "AI_InitMonsterAiThinkFn113c", k, lbl, &c, ts, 4, 0u, (k == 0));
  }

  /* [25] 0x6FCE9CB0 ACT2Q2_OnHoradricStaffOrificeActivate (eax=pPlayer, stack=[pGame, pOrificeObj], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 66u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 100u, 1u, 5000u, 5000u, 0x11111u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 152u, 300u, 0u, 5015u, 5005u, 0x22222u);
    uint32_t pQBuf = 0u;
    stage_player_quest_flags(STAGE_UDATA0, &pQBuf);
    U32(STAGE_QUEST0 + 0x00u) = 0x0Du;
    U32(STAGE_QUEST0 + 0x04u) = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    U8(STAGE_QUESTEX0 + 0x03u) = (k == 0) ? 1u : 0u;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_GAME + 0x10F4u) = STAGE_QUESTCTRL;
    U8(STAGE_GAME + 0x6Du) = (uint8_t)k;
    c = make_call();
    c.eax = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "orifice_act_k%d", k);
    run_and_emit(0x6FCE9CB0u, "ACT2Q2_OnHoradricStaffOrificeActivate_6FCE9CB0_113c", k, lbl, &c, ts, 3, 0u, 0);
  }
}

int main(int argc, char **argv) {
  if (argc < 3) {
    fprintf(stderr, "Usage: %s <d2game-datatbls-113c.img> <out.ndjson>\n", argv[0]);
    return 1;
  }
  const char *imgPath = argv[1];
  const char *outPath = argv[2];

  AddVectoredExceptionHandler(1, k6_veh);

  void *pTbls  = VirtualAlloc((void *)DATATBLS_BASE, DATATBLS_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pStage = VirtualAlloc((void *)STAGE_BASE, STAGE_TOTAL_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pHeap  = VirtualAlloc((void *)HEAP_BASE, HEAP_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if ((uintptr_t)pTbls != DATATBLS_BASE || (uintptr_t)pStage != STAGE_BASE || (uintptr_t)pHeap != HEAP_BASE) {
    fprintf(stderr, "[k6-fix3] VirtualAlloc failed (%p %p %p)\n", pTbls, pStage, pHeap);
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
    fprintf(stderr, "[k6-fix3] LoadLibraryA failed\n");
    fflush(stderr);
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-fix3] unexpected D2Common rebase: %p\n", (void *)g_hCom);
    fflush(stderr);
    return 3;
  }

  {
    typedef void(__fastcall *FogInitSys_t)(int, void *);
    FogInitSys_t pInit = (FogInitSys_t)(uintptr_t)GetProcAddress(g_hFog, MAKEINTRESOURCEA(10089));
    if (pInit) pInit(1, NULL);
  }

  /* Initialize D2Game global game-slot critical section for 0x6FC4A2D0 */
  InitializeCriticalSection((CRITICAL_SECTION *)(uintptr_t)((D2GAME_PREF_BASE + 0x110BE8u) + g_game_rebase));

  load_datatbls_img(imgPath);
  install_fog_hooks();

  fn_CreateStatListEx   = (Com_CreateStatListEx_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11166));
  fn_SetUnitStat        = (Com_SetUnitStat_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10887));
  fn_AllocStatList      = (Com_AllocStatList_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11013));
  fn_SetStatIfValid     = (Com_SetStatIfValid_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10188));
  fn_SetStatListState   = (Com_SetStatListState_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10785));
  fn_MergeStatLists     = (Com_MergeStatLists_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10807));
  fn_ToggleGfxState     = (Com_ToggleGfxState_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10945));
  fn_AllocSkillList     = (Com_AllocSkillList_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10856));
  fn_SetSkillLevel      = (Com_SetSkillLevel_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10302));
  fn_AllocInventory     = (Com_AllocInventory_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10387));
  fn_PlaceItemInBodyLoc = (Com_PlaceItemInBodyLoc_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11041));
  fn_PathSetTargetUnit  = (Com_PathSetTargetUnit_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10336));

  if (!fn_CreateStatListEx || !fn_SetUnitStat || !fn_AllocStatList || !fn_SetStatIfValid ||
      !fn_SetStatListState || !fn_MergeStatLists || !fn_ToggleGfxState || !fn_AllocSkillList ||
      !fn_SetSkillLevel || !fn_AllocInventory || !fn_PlaceItemInBodyLoc || !fn_PathSetTargetUnit) {
    fprintf(stderr, "[k6-fix3] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-fix3] failed to open %s for writing\n", outPath);
    return 5;
  }

  emit_part_a1_clean_hivas();
  emit_part_a2_init_quests();
  emit_part_a3_skills_hivas();
  emit_part_a4_remaining_hivas();
  emit_part_b1_path_missile();
  emit_part_b2_stack_local_lovas();
  emit_part_b3_classic_items();
  emit_part_b4_wavew_lovas();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-fix3] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
