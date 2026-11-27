/*
 * k6-fix2-d2game-emitter.c — [K6] Fix 2 Real-DLL Differential Emitter
 *
 * Loads real Diablo II: Lord of Destruction v1.13c DLLs (Storm.dll, Fog.dll,
 * D2Lang.dll, D2CMP.dll, D2Common.dll, D2Net.dll, D2Game.dll) under headless Wine,
 * hydrates canonical sgptDataTables (0x20000000..0x206F7FFF + D2Common .data/.bss)
 * from d2game-datatbls-113c.img, hooks Fog.#10024 (assert), Fog.#10042..10047
 * (deterministic bump allocator), and KERNEL32!GetTickCount (returning 0), and
 * executes Round-2 bug-unlocked D2Game.dll VAs + the MonAI / MONSTER_StartMode cluster
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
#define STAGE_TOTAL_SIZE  0x00080000u

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

/* D2Common helper function pointers (ALL resolved by ordinal on g_hCom) */
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

/* Discovered canonical table IDs */
static uint32_t g_item_sword       = 0;
static uint32_t g_item_bkd         = 0;
static uint32_t g_item_bks         = 0;
static uint32_t g_item_hdm         = 0;
static int32_t  g_skill_missile_a  = -1; /* skill with valid wSrvMissileA >= 0 and flag4=0 */
static int32_t  g_skill_missile_b  = -1; /* skill with valid wSrvMissileA >= 0 */

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

/* ------------------------------- Deterministic Allocator & Fog/K32 Hooks */

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
    fprintf(stderr, "[k6-fix2] allocator overflow (setup=%d size=%u)\n", g_in_setup_phase, sz);
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
      fprintf(stderr, "[k6-fix2] missing Fog.#%u\n", hooks[i].ord);
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
    fprintf(stderr, "[k6-fix2] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-fix2] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(0x6FDE9000u + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-fix2] short read at page %u\n", i);
      TerminateProcess(GetCurrentProcess(), 12);
    }
    uint32_t va = 0;
    memcpy(&va, pageBuf, 4);
    if (va >= DATATBLS_BASE && va < DATATBLS_BASE + DATATBLS_SIZE) {
      memcpy((void *)(uintptr_t)va, pageBuf + 4, 4096);
    } else if (va >= 0x6FDE9000u && va < 0x6FDF3000u) {
      memcpy((void *)(uintptr_t)(va + g_com_rebase), pageBuf + 4, 4096);
    }
  }
  fclose(fp);
}

/* ------------------------------- Staged Arena Memory Serializer */

static char g_pre_json[262144];

static void format_mem_runs_range(
    char *out, size_t cap, size_t *lenPtr, uint32_t startAddr, uint32_t endAddr, int *first) {
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
    int n = snprintf(out + len, cap - len, "%s{\"addr\":\"0x%08X\",\"hex\":\"", (*first ? "" : ","), runStart);
    len += (size_t)n;
    *first = 0;
    for (uint32_t k = runStart; k < runEnd; k++) {
      uint8_t b = U8(k);
      if (len + 4 >= cap) {
        fprintf(stderr, "[k6-fix2] stage json overflow\n");
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
  for (uint32_t i = 0; i < 15u; i++) {
    U32(pChunk + i * 0x30u + 0x1Cu) = pChunk + (i + 1u) * 0x30u;
  }
  U32(pChunk + 0x7080u) = pChunk;
  U32(pTimer + 0xA1Cu)  = pChunk;
  U32(STAGE_GAME + 0xB8u) = pTimer;
  return pTimer;
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
  U32(pRoom + 0x24u) = 1u; /* nRoomsNear */
  /* 32x32 open collision map at (4992..5024, 4992..5024) */
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
  U32(pRoom + 0x20u) = pColl; /* pCollisionGrid */
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
    uint32_t pTables  = U32(0x6FDE9E1Cu + g_com_rebase);
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

static void stage_player_waypoints(uint32_t pPlayerData) {
  for (uint32_t i = 0; i < 3u; i++) {
    uint32_t pWp = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U16(pWp) = 0x0102u;
    U32(pPlayerData + 0x1Cu + i * 4u) = pWp;
  }
}

static void link_player_client(uint32_t pUnit, uint32_t pUData, uint32_t pCli, uint32_t guid) {
  U32(pUData + 0x9Cu) = pCli;
  U32(pCli + 0x04u)   = 4u;
  U32(pCli + 0x16Cu)  = 0u;
  U32(pCli + 0x170u)  = guid;
  U32(pCli + 0x174u)  = pUnit;
  U32(pCli + 0x1A8u)  = STAGE_GAME;
  U32(pCli + 0x3D4u)  = 1u;
  U32(STAGE_GAME + 0x88u) = pCli;
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
  if (g_game_rebase == 0) return;
  uint32_t lo = (uint32_t)(uintptr_t)g_hGame;
  uint32_t hi = lo + 0x130000u;
  uint32_t delta = (uint32_t)g_game_rebase;
  for (uint32_t a = startAddr; a + 4u <= endAddr; a += 4u) {
    uint32_t v = U32(a);
    if (v >= lo && v < hi) {
      U32(a) = v - delta;
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
            "[k6-fix2] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }

  if (expectAssert && g_thunk_faulted != 2) {
    fprintf(stderr, "[k6-fix2] EXPECTED ASSERT did not fire at %s (0x%08X) case %d (%s)\n",
            fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!expectAssert && g_thunk_faulted == 2) {
    fprintf(stderr, "[k6-fix2] UNEXPECTED Fog.#10024 assert line %u at %s (0x%08X) case %d (%s)\n",
            g_assert_line, fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 32);
  }

  if (g_thunk_faulted == 0) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-fix2] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
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

static void discover_table_ids(void) {
  reset_case();
  uint32_t nItems = U32(0x6FDEFB94u + g_com_rebase);
  uint32_t pItems = U32(0x6FDEFB98u + g_com_rebase);
  for (uint32_t id = 0; id < nItems; id++) {
    uint32_t code = U32(pItems + id * 0x1A8u + 0x80u);
    if (!g_item_sword && code == 0x20647373u) g_item_sword = id; /* 'ssd ' Short Sword */
    if (!g_item_bkd && code == 0x20646B62u)   g_item_bkd = id;   /* 'bkd ' */
    if (!g_item_bks && code == 0x20736B62u)   g_item_bks = id;   /* 'bks ' */
    if (!g_item_hdm && code == 0x206D6468u)   g_item_hdm = id;   /* 'hdm ' Horadric Malus */
  }

  uint32_t pSgpt = U32(0x6FDE9E1Cu + g_com_rebase);
  uint32_t pSkills = U32(pSgpt + 0xB98u);
  int32_t  nSkills = S32(pSgpt + 0xBA0u);
  int32_t  nMiss   = S32(pSgpt + 0xB6Cu);
  for (int32_t sid = 1; sid < nSkills; sid++) {
    uint32_t rec = pSkills + (uint32_t)sid * 0x23Cu;
    int16_t mId = S16(rec + 0x48u);
    if (mId >= 0 && (int32_t)mId + 2 < nMiss) {
      if (g_skill_missile_a < 0 && (U8(rec + 4u) & 0x10u) == 0u) {
        g_skill_missile_a = sid;
      } else if (g_skill_missile_b < 0 && sid != g_skill_missile_a) {
        g_skill_missile_b = sid;
      }
      if (g_skill_missile_a >= 0 && g_skill_missile_b >= 0) break;
    }
  }
}

/* =========================================================================
 * GROUP 1 — Round-2 Bug-Unlocked & Wave-R Residual VAs (15 VAs)
 * ========================================================================= */
static void emit_group_1(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [01] 0x6FC81540 ACT1Q4_Callback13_RefreshQuestState_6FC81540_113c (ecx=pQuest, edx=pQuestArg, ret) */
  for (int k = 0; k < 5; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 101u, 1u, 5000u, 5000u, 101u);
    uint32_t pFlagBuf = 0u;
    stage_player_quest_flags(STAGE_UDATA0, &pFlagBuf);
    uint32_t pGameQRec = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    uint32_t pGameQBuf = (uint32_t)(uintptr_t)bump_alloc(0x60u);
    U32(pGameQRec + 0x00u) = pGameQBuf;
    U32(pGameQRec + 0x04u) = 0x60u;
    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUESTCTRL + 0x08u) = (k == 4) ? 0u : 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = pGameQRec;
    U32(STAGE_QUEST0 + 0x00u)    = 4u;
    U32(STAGE_QUEST0 + 0x04u)    = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
    if (k == 0 || k == 4) set_quest_flag_bit(pFlagBuf, 4u, 0u);
    else if (k == 1)      set_quest_flag_bit(pFlagBuf, 4u, 0x0Fu);
    else if (k == 2)      set_quest_flag_bit(pFlagBuf, 4u, 4u);
    else                  set_quest_flag_bit(pFlagBuf, 4u, 3u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    run_and_emit(0x6FC81540u, "ACT1Q4_Callback13_RefreshQuestState_6FC81540_113c", k,
                 k == 0 ? "bit0_complete" : k == 1 ? "bit0f_saved" : k == 2 ? "bit4_portal_open" : k == 3 ? "bit3_scroll" : "bit0_assert_0x820",
                 &c, ts, 2, 0u, (k == 4 ? 1 : 0));
  }

  /* [02] 0x6FC81A80 ACT1Q5_Callback13_RefreshQuestState_6FC81A80_113c (ecx=pQuest, edx=pQuestArg, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 102u, 1u, 5000u, 5000u, 102u);
    uint32_t pFlagBuf = 0u;
    stage_player_quest_flags(STAGE_UDATA0, &pFlagBuf);
    U32(STAGE_QUEST0 + 0x00u) = 3u;
    U32(STAGE_QUEST0 + 0x04u) = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    if (k == 0)      set_quest_flag_bit(pFlagBuf, 3u, 0u);
    else if (k == 1) set_quest_flag_bit(pFlagBuf, 3u, 3u);
    else if (k == 2) set_quest_flag_bit(pFlagBuf, 3u, 2u);
    else             set_quest_flag_bit(pFlagBuf, 3u, 1u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    run_and_emit(0x6FC81A80u, "ACT1Q5_Callback13_RefreshQuestState_6FC81A80_113c", k,
                 k == 0 ? "bit0_done" : k == 1 ? "bit3_bState1" : k == 2 ? "bit2_started" : "bit1_imbue_ready",
                 &c, ts, 2, 0u, 0);
  }

  /* [03] 0x6FC579E0 PLAYER_FreePlayerCorpses_6FC579E0_113c (eax=pPlayer, ebx=pGame, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 201u, 1u, 5000u, 5000u, 201u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    if (k >= 1) {
      uint32_t pCorpseRec = (uint32_t)(uintptr_t)bump_alloc(0x10u);
      U32(pCorpseRec + 0x04u) = 202u;
      U32((uint32_t)(uintptr_t)pInv + 0x34u) = pCorpseRec;
      U32((uint32_t)(uintptr_t)pInv + 0x38u) = pCorpseRec;
      U32((uint32_t)(uintptr_t)pInv + 0x3Cu) = 1u;
      if (k == 1) {
        stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 202u, 17u, 5002u, 5000u, 202u);
        stage_player_waypoints(STAGE_UDATA1);
        U32(STAGE_UDATA1 + 0x60u) = (uint32_t)(uintptr_t)bump_alloc(0x10u);
        U32(STAGE_UDATA1 + 0x64u) = (uint32_t)(uintptr_t)bump_alloc(0x10u);
        U32(STAGE_UDATA1 + 0x68u) = (uint32_t)(uintptr_t)bump_alloc(0x10u);
        insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      }
    }
    uint32_t gArg = (k == 2) ? 0u : STAGE_GAME;
    c.eax = STAGE_UNIT0; c.ebx = gArg;
    ts[0] = STAGE_UNIT0; ts[1] = gArg;
    run_and_emit(0x6FC579E0u, "PLAYER_FreePlayerCorpses_6FC579E0_113c", k,
                 k == 0 ? "no_corpses_noop" : k == 1 ? "free_corpse_in_room" : "null_game_assert_0x2d3",
                 &c, ts, 2, 0u, (k == 2 ? 1 : 0));
  }

  /* [04] 0x6FCEFE40 PLAYER_TeleportToCoordsWithRateLimitDelay_6FCEFE40_113c (eax=nY, ecx=nX, ebx=pPlayer, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 301u, 1u, 5000u, 5000u, 301u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 301u);
    uint32_t tx = (k == 0) ? 9000u : (k == 1 ? 5004u : 5008u);
    uint32_t ty = (k == 0) ? 9000u : (k == 1 ? 5004u : 5006u);
    if (k == 2) {
      U32(STAGE_CLIENT + 0x3D4u) |= 1u;
      U32(STAGE_GAME + 0xA8u) = 200u;
    }
    c.eax = ty; c.ecx = tx; c.ebx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = ty; ts[1] = tx; ts[2] = STAGE_UNIT0; ts[3] = STAGE_GAME;
    run_and_emit(0x6FCEFE40u, "PLAYER_TeleportToCoordsWithRateLimitDelay_6FCEFE40_113c", k,
                 k == 0 ? "oob_coords_ret0" : k == 1 ? "valid_teleport_frame100" : "valid_teleport_frame200",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [05] 0x6FCDAD40 ACT4Q2_InitQuestData_6FCDAD40_113c (ecx=pQuest, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_QUEST0 + 0x04u) = STAGE_GAME;
    U8(STAGE_QUEST0 + 0x0Bu)  = (uint8_t)(k + 1);
    U8(STAGE_QUEST0 + 0x0Cu)  = (uint8_t)(k + 2);
    U32(STAGE_QUEST0 + 0xE8u) = (k == 2) ? 0x12345678u : (uint32_t)k;
    U32(STAGE_QUEST0 + 0x18u) = (k == 1) ? 0xDEADBEEFu : 0u;
    c.ecx = STAGE_QUEST0;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FCDAD40u, "ACT4Q2_InitQuestData_6FCDAD40_113c", k,
                 k == 0 ? "fresh_init" : k == 1 ? "clears_stale_ex_ptr" : "clears_b0b_b0c_e8",
                 &c, ts, 1, 0u, 0);
  }

  /* [06] 0x6FCD5600 SKILLS_SrvDo132_MeleeAndDirectionalMissile_6FCD5600_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 601u, 1u, 5000u, 5000u, 601u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 602u, 1u, 5006u, 5002u, 602u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
    }
    int32_t sid = (k == 0) ? -1 : (k == 1 ? g_skill_missile_a : g_skill_missile_b);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)sid; c.args[1] = 3u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sid; ts[3] = 3;
    run_and_emit(0x6FCD5600u, "SKILLS_SrvDo132_MeleeAndDirectionalMissile_6FCD5600_113c", k,
                 k == 0 ? "neg_skill_ret0" : k == 1 ? "launch_missile_a" : "launch_missile_b",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [07] 0x6FCD4C20 SKILLS_SrvDo122_LaunchMonsterVariantMissile0E_6FCD4C20_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 701u, 1u, 5000u, 5000u, 701u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 702u, 1u, 5006u, 5002u, 702u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
      U8(STAGE_UDATA0 + 0x0Eu) = (k == 2) ? 1u : 0u;
    }
    int32_t sid = (k == 0) ? -1 : g_skill_missile_a;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)sid; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sid; ts[3] = 2;
    run_and_emit(0x6FCD4C20u, "SKILLS_SrvDo122_LaunchMonsterVariantMissile0E_6FCD4C20_113c", k,
                 k == 0 ? "neg_skill_ret0" : k == 1 ? "variant0_launch" : "variant1_launch",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [08] 0x6FCFAB00 SUNITDMG_OpenMatchingObjectAtUnitPos_6FCFAB00_113c (ebx=pUnit, stack=[dwObjectClassId], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 801u, 1u, 5000u, 5000u, 801u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 5u, 802u, 0u, (k == 2 ? 5004u : 5000u), 5000u, 802u);
    U32(STAGE_ROOM0 + 0x74u) = STAGE_UNIT1;
    uint32_t wantClass = (k == 1) ? 99u : 5u;
    c.ebx = STAGE_UNIT0; c.nargs = 1; c.args[0] = wantClass; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = wantClass;
    run_and_emit(0x6FCFAB00u, "SUNITDMG_OpenMatchingObjectAtUnitPos_6FCFAB00_113c", k,
                 k == 0 ? "match_open_mode2" : k == 1 ? "class_mismatch_noop" : "pos_mismatch_noop",
                 &c, ts, 2, 0u, 0);
  }

  /* [09] 0x6FCFBD90 SUNITDMG_OnStunOrFreezeEndNeutralCallback_6FCFBD90_113c (ecx=pUnit, edx=nState, stack=[pStatList], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 901u, (k == 0 ? 6u : (k == 1 ? 0u : 1u)), 5000u, 5000u, 901u);
    if (k == 0) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 1, 1);
    }
    uint32_t uArg = (k == 2) ? 0u : STAGE_UNIT0;
    c.ecx = uArg; c.edx = 1u; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = uArg; ts[1] = 1; ts[2] = 0;
    run_and_emit(0x6FCFBD90u, "SUNITDMG_OnStunOrFreezeEndNeutralCallback_6FCFBD90_113c", k,
                 k == 0 ? "living_mon_clear_state_resched" : k == 1 ? "dead_mon_still_clears_when_mask0" : "null_unit_assert_0xa2a",
                 &c, ts, 3, 0u, (k == 2 ? 1 : 0));
  }

  /* [10] 0x6FCF2840 ITEMS_SetDroppedItemGroundModeAndRefreshOwner_6FCF2840_113c (esi=pItem, edi=pOwnerUnit, stack=[wActionType], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1001u, 1u, 5000u, 5000u, 1001u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_sword, 1002u, 0u, 5000u, 5000u, 1002u);
    uint32_t ownerArg = (k == 2) ? 0u : STAGE_UNIT0;
    uint32_t actType  = (k == 1) ? 7u : 5u;
    c.esi = STAGE_UNIT1; c.edi = ownerArg; c.nargs = 1; c.args[0] = actType; c.calleePop = 4u;
    ts[0] = STAGE_UNIT1; ts[1] = ownerArg; ts[2] = actType;
    run_and_emit(0x6FCF2840u, "ITEMS_SetDroppedItemGroundModeAndRefreshOwner_6FCF2840_113c", k,
                 k == 0 ? "drop_act5" : k == 1 ? "drop_act7" : "null_owner_assert_0x558",
                 &c, ts, 3, 0u, (k == 2 ? 1 : 0));
  }

  /* [11] 0x6FCCD6C0 ITEMMODS_ApplyAttackerTakesDamage_6FCCD6C0_113c (ecx=pGame, stack=[pUnit, pAttacker, pArg3, nStatParam, 0], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1101u, 1u, 5000u, 5000u, 1101u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 19u, 1102u, 1u, 5002u, 5000u, 1102u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 10, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 5, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 500 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 500 << 8, 0);
    if (k >= 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 78, (k == 1) ? 12 : 25, 0);
    }
    uint32_t statParam = (78u << 16);
    c.ecx = STAGE_GAME;
    c.nargs = 5; c.args[0] = STAGE_UNIT0; c.args[1] = STAGE_UNIT1; c.args[2] = 0u; c.args[3] = statParam; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = 0; ts[4] = statParam;
    run_and_emit(0x6FCCD6C0u, "ITEMMODS_ApplyAttackerTakesDamage_6FCCD6C0_113c", k,
                 k == 0 ? "zero_stat_ret0" : k == 1 ? "cold_thorns_12" : "cold_thorns_25",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [12] 0x6FC73B40 PLAYERSAVE_WriteInventoryOrCachedSaveBuffer_6FC73B40_113c (ebx=pPlayer, stack=[pGame, pBuf, nMax, bCached, a4, a5], ret 0x18) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1201u, 1u, 5000u, 5000u, 1201u);
    uint32_t pCached = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    uint32_t pSrc    = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U32(pSrc + 0x00u) = 0xDEADBEEFu;
    U32(pSrc + 0x04u) = 0x13579BDFu;
    U32(pCached + 0x00u) = (k == 1) ? 8u : 4u;
    U32(pCached + 0x04u) = pSrc;
    U32(STAGE_UDATA0 + 0x5Cu) = (k == 2) ? 0u : pCached;
    uint32_t pDst = STAGE_SCRATCH + 0x40u;
    c.ebx = STAGE_UNIT0;
    c.nargs = 6;
    c.args[0] = STAGE_GAME; c.args[1] = pDst; c.args[2] = 16u; c.args[3] = 1u; c.args[4] = 0u; c.args[5] = 0u;
    c.calleePop = 0x18u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = pDst; ts[3] = 16; ts[4] = 1; ts[5] = 0; ts[6] = 0;
    run_and_emit(0x6FC73B40u, "PLAYERSAVE_WriteInventoryOrCachedSaveBuffer_6FC73B40_113c", k,
                 k == 0 ? "cached_4bytes" : k == 1 ? "cached_8bytes" : "null_cache_ret0",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [13] 0x6FD020A0 SUNIT_FreeUnit113c (ecx=pGame, edx=pUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    if (k == 0) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1301u, 1u, 5000u, 5000u, 1301u);
      stage_player_waypoints(STAGE_UDATA0);
      U32(STAGE_UDATA0 + 0x60u) = (uint32_t)(uintptr_t)bump_alloc(0x10u);
      U32(STAGE_UDATA0 + 0x64u) = (uint32_t)(uintptr_t)bump_alloc(0x10u);
      U32(STAGE_UDATA0 + 0x68u) = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    } else if (k == 1) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 1302u, 1u, 5000u, 5000u, 1302u);
      U32(STAGE_UDATA0 + 0x30u) = STAGE_SCRATCH + 0x100u; /* valid pInteract */
    }
    uint32_t uArg = (k == 2) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = uArg;
    ts[0] = STAGE_GAME; ts[1] = uArg;
    run_and_emit(0x6FD020A0u, "SUNIT_FreeUnit113c", k,
                 k == 0 ? "free_player_unit" : k == 1 ? "free_monster_unit" : "null_unit_assert_93",
                 &c, ts, 2, 0u, (k == 2 ? 1 : 0));
  }

  /* [14] 0x6FD019C0 DUNGEON_TeleportUnitToRoomAndCoords_6FD019C0_113c (ecx=nX, edx=pTargetRoom, eax=nY, stack=[pGame, pUnit, bKeepExact, bUseFlag800], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1401u, 1u, 5000u, 5000u, 1401u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1401u);
    uint32_t tx = (k == 0) ? 5004u : 5008u;
    uint32_t ty = (k == 0) ? 5006u : 5005u;
    uint32_t keepExact = (k == 1) ? 1u : 0u;
    uint32_t uArg = (k == 2) ? 0u : STAGE_UNIT0;
    c.ecx = tx; c.edx = STAGE_ROOM0; c.eax = ty;
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = uArg; c.args[2] = keepExact; c.args[3] = 1u; c.calleePop = 0x10u;
    ts[0] = tx; ts[1] = STAGE_ROOM0; ts[2] = ty; ts[3] = STAGE_GAME; ts[4] = uArg; ts[5] = keepExact; ts[6] = 1;
    run_and_emit(0x6FD019C0u, "DUNGEON_TeleportUnitToRoomAndCoords_6FD019C0_113c", k,
                 k == 0 ? "find_free_pos_stack_scratch" : k == 1 ? "keep_exact_coords" : "null_unit_assert_0xc22",
                 &c, ts, 7, 0xFFFFFFFFu, (k == 2 ? 1 : 0));
  }

  /* [15] 0x6FC98A90 PLAYER_StartModeCast113c (ebx=pPlayer, stack=[pGame], ret 4, bCheckBrokenOnly=true) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1501u, 7u, 5000u, 5000u, 1501u);
    U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1501u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_sword, 1502u, 1u, 0u, 0u, 1502u);
      fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT2, 4);
      U32(STAGE_UNIT2 + 0x10u) = 1u;
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 0x48, (k == 1) ? 0 : 12, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 0x49, 20, 0);
    }
    c.ebx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC98A90u, "PLAYER_StartModeCast113c", k,
                 k == 0 ? "empty_inv_noop" : k == 1 ? "zero_dur_weapon_breaks" : "intact_weapon_noop",
                 &c, ts, 2, 0u, 0);
  }
}

/* =========================================================================
 * GROUP 2 — Core MonAI MONSTER_StartMode113c Helpers (11 UNHIT VAs)
 * ========================================================================= */
static void emit_group_2(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [16] 0x6FD11C30 AI_WalkToLeashDistanceFromUnit_6FD11C30_113c (eax=pFromUnit, edi=pUnit, stack=[pGame, nDistance], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint16_t mx = (k == 0) ? 5000u : 5012u;
    uint16_t my = (k == 0) ? 5000u : 5004u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 1601u, 1u, mx, my, 1601u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1602u, 1u, 5000u, 5000u, 1602u);
    uint32_t dist = (k == 2) ? 6u : 3u;
    c.eax = STAGE_UNIT1; c.edi = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = dist; c.calleePop = 8u;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME; ts[3] = dist;
    run_and_emit(0x6FD11C30u, "AI_WalkToLeashDistanceFromUnit_6FD11C30_113c", k,
                 k == 0 ? "zero_dist_ret0" : k == 1 ? "leash_dist3" : "leash_dist6",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [17] 0x6FD11FA0 AI_StartModeAtCoordsStep0_6FD11FA0_113c (ecx=pUnit, eax=nMode, stack=[pGame, nX, nY], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 1701u, 1u, 5000u, 5000u, 1701u);
    uint32_t mode = (k == 0) ? 2u : (k == 1 ? 4u : 15u);
    c.ecx = STAGE_UNIT0; c.eax = mode;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = 5006u; c.args[2] = 5004u; c.calleePop = 0xCu;
    ts[0] = STAGE_UNIT0; ts[1] = mode; ts[2] = STAGE_GAME; ts[3] = 5006; ts[4] = 5004;
    run_and_emit(0x6FD11FA0u, "AI_StartModeAtCoordsStep0_6FD11FA0_113c", k,
                 k == 0 ? "walk_mode2_step0" : k == 1 ? "attack_mode4_step0" : "run_mode15_step0",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [18] 0x6FD11FF0 AI_StartModeAtCoordsStep1_6FD11FF0_113c (ecx=pUnit, eax=nMode, stack=[pGame, nX, nY], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 1801u, 1u, 5000u, 5000u, 1801u);
    uint32_t mode = (k == 0) ? 2u : (k == 1 ? 4u : 15u);
    c.ecx = STAGE_UNIT0; c.eax = mode;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = 5006u; c.args[2] = 5004u; c.calleePop = 0xCu;
    ts[0] = STAGE_UNIT0; ts[1] = mode; ts[2] = STAGE_GAME; ts[3] = 5006; ts[4] = 5004;
    run_and_emit(0x6FD11FF0u, "AI_StartModeAtCoordsStep1_6FD11FF0_113c", k,
                 k == 0 ? "walk_mode2_step1" : k == 1 ? "attack_mode4_step1" : "run_mode15_step1",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [19] 0x6FD12120 AI_CastSkillMode14_113c (esi=pUnit, edi=nSkillId, stack=[pGame, pTarget, x, y], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 1901u, 1u, 5000u, 5000u, 1901u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1902u, 1u, 5004u, 5000u, 1902u);
    if (k >= 1) attach_skill(STAGE_UNIT0, 36, 1);
    int32_t sid = (k == 0) ? -1 : (k == 1 ? 36 : 9999);
    c.esi = STAGE_UNIT0; c.edi = (uint32_t)sid;
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.args[2] = 5004u; c.args[3] = 5000u; c.calleePop = 0x10u;
    ts[0] = STAGE_UNIT0; ts[1] = sid; ts[2] = STAGE_GAME; ts[3] = STAGE_UNIT1; ts[4] = 5004; ts[5] = 5000;
    run_and_emit(0x6FD12120u, "AI_CastSkillMode14_113c", k,
                 k == 0 ? "neg_skill_ret0" : k == 1 ? "cast_firebolt_mode14" : "oob_skill_ret0",
                 &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* [20] 0x6FD121E0 AI_StartModeAtCoordsKeepSteps_6FD121E0_113c (edi=pUnit, eax=nMode, stack=[pGame, nX, nY], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 2001u, 1u, 5000u, 5000u, 2001u);
    U8(STAGE_PATH0 + 0x93u) = 3u; /* existing nStepNum preserved */
    uint32_t mode = (k == 0) ? 2u : (k == 1 ? 4u : 15u);
    c.edi = STAGE_UNIT0; c.eax = mode;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = 5006u; c.args[2] = 5004u; c.calleePop = 0xCu;
    ts[0] = STAGE_UNIT0; ts[1] = mode; ts[2] = STAGE_GAME; ts[3] = 5006; ts[4] = 5004;
    run_and_emit(0x6FD121E0u, "AI_StartModeAtCoordsKeepSteps_6FD121E0_113c", k,
                 k == 0 ? "walk_keep_steps" : k == 1 ? "attack_keep_steps" : "run_keep_steps",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [21] 0x6FD12420 AI_CastSkillWithModeRandomScatter_6FD12420_113c (esi=pUnit, stack=[nRadius, nSkillId, nMode], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 2101u, 1u, 5000u, 5000u, 2101u + (uint32_t)k);
    attach_skill(STAGE_UNIT0, 36, 1);
    uint32_t rad = (k == 0) ? 0u : (k == 1 ? 4u : 6u);
    uint32_t mode = (k == 2) ? 4u : 7u;
    c.esi = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = rad; c.args[1] = 36u; c.args[2] = mode; c.calleePop = 0xCu;
    ts[0] = STAGE_UNIT0; ts[1] = rad; ts[2] = 36; ts[3] = mode;
    run_and_emit(0x6FD12420u, "AI_CastSkillWithModeRandomScatter_6FD12420_113c", k,
                 k == 0 ? "rad0_mode7" : k == 1 ? "rad4_pow2_mode7" : "rad6_nonpow2_mode4",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [22] 0x6FD126B0 AI_CircleStrafeTarget_6FD126B0_113c (ecx=pUnit, eax=bClearAiThinkOnFail, stack=[pGame, pTarget, nDistance], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t seed = (k == 0) ? 1u : (k == 1 ? 3u : 7u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 2201u, 1u, 5000u, 5000u, seed);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 2202u, 1u, 5006u, 5002u, 2202u);
    uint32_t dist = (k == 2) ? 100u : 8u; /* k=2 tests clamping >= 0x4E -> 0x4D */
    uint32_t clr  = (k == 1) ? 1u : 0u;
    c.ecx = STAGE_UNIT0; c.eax = clr;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.args[2] = dist; c.calleePop = 0xCu;
    ts[0] = STAGE_UNIT0; ts[1] = clr; ts[2] = STAGE_GAME; ts[3] = STAGE_UNIT1; ts[4] = dist;
    run_and_emit(0x6FD126B0u, "AI_CircleStrafeTarget_6FD126B0_113c", k,
                 k == 0 ? "strafe_seed1_dist8" : k == 1 ? "strafe_seed3_clear" : "strafe_dist_clamp_4d",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [23] 0x6FD12750 AI_RunWanderAroundUnit_6FD12750_113c (ecx=pOriginUnit, eax=nRange, stack=[pGame, pUnit], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 2301u, 1u, 5000u, 5000u, 2301u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 2302u, 1u, 5002u, 5002u, 2302u);
    uint32_t rng = (k == 0) ? 4u : (k == 1 ? 6u : 8u);
    c.ecx = STAGE_UNIT1; c.eax = rng;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = STAGE_UNIT1; ts[1] = rng; ts[2] = STAGE_GAME; ts[3] = STAGE_UNIT0;
    run_and_emit(0x6FD12750u, "AI_RunWanderAroundUnit_6FD12750_113c", k,
                 k == 0 ? "wander_r4_seedA" : k == 1 ? "wander_r6_seedB" : "wander_r8_seedC",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [24] 0x6FD12C10 AI_RunFleeFromUnit_6FD12C10_113c (eax=pFromUnit, ebx=pUnit, stack=[pGame, nDistSteps, bClearAiThinkOnFail], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 2401u, 1u, 5004u, 5004u, 2401u);
    uint16_t fx = (k == 0) ? 5000u : 5008u;
    uint16_t fy = (k == 0) ? 5000u : 5008u;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 2402u, 1u, fx, fy, 2402u);
    uint32_t dSteps = (k == 0) ? 4u : (k == 1 ? 10u : 100u);
    uint32_t clr    = (k == 2) ? 1u : 0u;
    c.eax = STAGE_UNIT1; c.ebx = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = dSteps; c.args[2] = clr; c.calleePop = 0xCu;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME; ts[3] = dSteps; ts[4] = clr;
    run_and_emit(0x6FD12C10u, "AI_RunFleeFromUnit_6FD12C10_113c", k,
                 k == 0 ? "flee_pos_d4" : k == 1 ? "flee_neg_d10" : "flee_clamp_4d_clear",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [25] 0x6FD12F00 AI_RunTowardTarget_6FD12F00_113c (edx=pUnit, ecx=pTarget, stack=[pGame, nStepNum], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 2501u, 1u, 5000u, 5000u, 2501u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 2502u, 1u, 5008u, 5004u, 2502u);
    uint32_t step = (k == 0) ? 0u : (k == 1 ? 2u : 5u);
    c.edx = STAGE_UNIT0; c.ecx = STAGE_UNIT1;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = step; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = STAGE_GAME; ts[3] = step;
    run_and_emit(0x6FD12F00u, "AI_RunTowardTarget_6FD12F00_113c", k,
                 k == 0 ? "step0_default1" : k == 1 ? "step2" : "step5",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [26] 0x6FD12F30 AI_WalkTowardTarget_6FD12F30_113c (edx=pUnit, ecx=pTarget, stack=[pGame, nStepNum], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 2601u, 1u, 5000u, 5000u, 2601u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 2602u, 1u, 5008u, 5004u, 2602u);
    uint32_t step = (k == 0) ? 0u : (k == 1 ? 2u : 5u);
    c.edx = STAGE_UNIT0; c.ecx = STAGE_UNIT1;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = step; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = STAGE_GAME; ts[3] = step;
    run_and_emit(0x6FD12F30u, "AI_WalkTowardTarget_6FD12F30_113c", k,
                 k == 0 ? "step0_default1" : k == 1 ? "step2" : "step5",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }
}


/* ============================================================================
 * GROUP 3: MonAI Thinkers Unlocked by Wave R / Round-2 MONSTER_StartMode113c
 *          & Stack-Scratch Sweeps (91 un-hit standard __fastcall thinkers,
 *          4 canonical cases each: far_s0, melee_s0, mid_s1, long_lowhp_s2)
 * ============================================================================ */

typedef struct {
  uint32_t va;
  const char *name;
  uint32_t classId;
  int32_t skills[4];
} MonAiThinkerSpec;

static const MonAiThinkerSpec kGroup3MonAi[91] = {
  { 0x6FC355C0u, "AI_InitShadowMasterSkillSlot113c", 19u, { 36, 0, 0, 0 } },
  { 0x6FC36060u, "AI_InitClearFreezeAndStall_6FC36060_113c", 271u, { 206, 336, 0, 0 } },
  { 0x6FC360B0u, "AI_ThinkSingleStrikeTurret_6FC360B0_113c", 401u, { 223, 0, 0, 0 } },
  { 0x6FC36190u, "AI_ThinkStaticTrapAttack_6FC36190_113c", 497u, { 0, 0, 0, 0 } },
  { 0x6FC36270u, "AI_ThinkBloodLordFrenzy_6FC36270_113c", 371u, { 204, 49, 0, 0 } },
  { 0x6FC372B0u, "AI_ThinkMeleeOrApproach7_6FC372B0_113c", 365u, { 223, 0, 0, 0 } },
  { 0x6FC373D0u, "AI_ThinkPackIdlePatrol_6FC373D0_113c", 19u, { 36, 0, 0, 0 } },
  { 0x6FC376B0u, "AI_ThinkBloodHawk_6FC376B0_113c", 402u, { 223, 0, 0, 0 } },
  { 0x6FC377E0u, "AI_ThinkGiantSpider_6FC377E0_113c", 506u, { 226, 328, 0, 0 } },
  { 0x6FC379A0u, "AI_ThinkThornedHulk_6FC379A0_113c", 501u, { 231, 33, 323, 0 } },
  { 0x6FC37CB0u, "AI_Think_Overlord_6FC37CB0_113c", 479u, { 223, 290, 291, 295 } },
  { 0x6FC381A0u, "AI_ThinkDualAttack95Pct_6FC381A0_113c", 19u, { 36, 0, 0, 0 } },
  { 0x6FC38360u, "AI_ThinkDelayedMeleeAttack_6FC38360_113c", 461u, { 223, 0, 0, 0 } },
  { 0x6FC389E0u, "AI_ThinkPutridDefiler_6FC389E0_113c", 435u, { 0, 0, 0, 0 } },
  { 0x6FC38A90u, "AI_Thinker_MeleeRangedApproachStall_6FC38A90_113c", 436u, { 231, 293, 107, 0 } },
  { 0x6FC38CE0u, "AI_ThinkClawViper_6FC38CE0_113c", 360u, { 223, 319, 0, 0 } },
  { 0x6FC39080u, "AI_ThinkZakarumHealerOrPriest_6FC39080_113c", 345u, { 231, 62, 179, 0 } },
  { 0x6FC39740u, "AI_ThinkTownRogueGuard_6FC39740_113c", 270u, { 206, 0, 0, 0 } },
  { 0x6FC39E70u, "AI_ThinkHomeLeashedCaster_6FC39E70_113c", 267u, { 223, 167, 168, 0 } },
  { 0x6FC3A550u, "AI_ThinkPutridDefiler_6FC3A550_113c", 492u, { 223, 330, 322, 283 } },
  { 0x6FC3A9F0u, "AI_ThinkSuccubus_6FC3A9F0_113c", 474u, { 223, 66, 72, 309 } },
  { 0x6FC3B2F0u, "AI_ThinkMinionCommandSkirmisher_6FC3B2F0_113c", 396u, { 223, 158, 0, 0 } },
  { 0x6FC3B780u, "AI_ThinkPackRegroupSkirmisher_6FC3B780_113c", 373u, { 223, 0, 0, 0 } },
  { 0x6FC3C1E0u, "AI_StepTurnAndCastSkill4_6FC3C1E0_113c", 348u, { 206, 203, 0, 0 } },
  { 0x6FC9BF50u, "AI_StationaryMeleeTrap_6FC9BF50_113c", 354u, { 0, 0, 0, 0 } },
  { 0x6FC9C460u, "AI_WallTrapVerticalX_6FC9C460_113c", 327u, { 200, 207, 0, 0 } },
  { 0x6FC9C580u, "AI_TentacleMeleeAttack_6FC9C580_113c", 326u, { 0, 0, 0, 0 } },
  { 0x6FC9C8C0u, "AI_ClearState12InitThinkFnAndStall1_6FC9C8C0_113c", 278u, { 223, 178, 177, 327 } },
  { 0x6FC9C910u, "AI_CardinalBeamTurret_6FC9C910_113c", 273u, { 206, 172, 0, 0 } },
  { 0x6FC9CE40u, "AI_ThinkWakeOrUnburrowSkill_6FC9CE40_113c", 247u, { 223, 176, 180, 0 } },
  { 0x6FC9CFD0u, "AI_MosquitoNestSpawner_6FC9CFD0_113c", 228u, { 167, 0, 0, 0 } },
  { 0x6FC9D310u, "AI_OneShotSkillTrap_6FC9D310_113c", 190u, { 206, 159, 0, 0 } },
  { 0x6FC9D400u, "AI_CastSkillAtRandomOffsetAroundSelf_6FC9D400_113c", 153u, { 213, 0, 0, 0 } },
  { 0x6FC9D7C0u, "AI_BasicMeleeOrStepApproach_6FC9D7C0_113c", 38u, { 0, 0, 0, 0 } },
  { 0x6FC9D910u, "AI_PackBroadcastOrMeleeApproach_6FC9D910_113c", 313u, { 0, 0, 0, 0 } },
  { 0x6FC9DF00u, "AI_MeleeOrPathType13Approach_6FC9DF00_113c", 310u, { 231, 0, 0, 0 } },
  { 0x6FC9E070u, "AI_ThinkLowLifeFleeCaster_6FC9E070_113c", 304u, { 231, 196, 0, 0 } },
  { 0x6FC9E4D0u, "AI_InitialStall5ThenMeleeApproach_6FC9E4D0_113c", 301u, { 223, 0, 0, 0 } },
  { 0x6FC9E640u, "AI_AuraBuffAndLineOfSightSkillCaster_6FC9E640_113c", 706u, { 231, 44, 60, 184 } },
  { 0x6FC9ED90u, "AI_ThinkFetishMelee_6FC9ED90_113c", 235u, { 223, 0, 0, 0 } },
  { 0x6FC9F370u, "AI_MeleeStrafeOrStepApproach_6FC9F370_113c", 234u, { 107, 0, 0, 0 } },
  { 0x6FC9F5A0u, "AI_ThreeStageSuicideMinion_6FC9F5A0_113c", 230u, { 0, 0, 0, 0 } },
  { 0x6FC9F760u, "AI_ComboMeleeAndDualSkill_6FC9F760_113c", 186u, { 223, 97, 0, 0 } },
  { 0x6FC9F9A0u, "AI_AlternatingMeleeOrApproach_6FC9F9A0_113c", 180u, { 223, 0, 0, 0 } },
  { 0x6FC9FE60u, "AI_MeleeOrDualSkillPathType7_6FC9FE60_113c", 156u, { 164, 201, 0, 0 } },
  { 0x6FCA0450u, "AI_RegeneratingMultiStateMonster_6FCA0450_113c", 136u, { 223, 0, 0, 0 } },
  { 0x6FCA0B00u, "AI_ThinkSelfBuffRetreatSkirmisher_6FCA0B00_113c", 122u, { 231, 173, 0, 0 } },
  { 0x6FCA0F20u, "MONAI_GloamPackLightningDanceThink_6FCA0F20_113c", 118u, { 53, 0, 0, 0 } },
  { 0x6FCA1C80u, "MONAI_SandMaggotThink_6FCA1C80_113c", 114u, { 223, 206, 0, 0 } },
  { 0x6FCA1F50u, "AI_ThinkMeleeBasic_6FCA1F50_113c", 96u, { 231, 0, 0, 0 } },
  { 0x6FCA20D0u, "AI_ThinkPackLeaderCommand1Melee_6FCA20D0_113c", 91u, { 231, 10, 0, 0 } },
  { 0x6FCA2430u, "AI_ThinkSimpleMeleeVariantA_6FCA2430_113c", 87u, { 223, 166, 0, 0 } },
  { 0x6FCA2990u, "AI_ThinkRegenBoostRetreatMelee_6FCA2990_113c", 48u, { 223, 0, 0, 0 } },
  { 0x6FCA3CE0u, "MONAI_BlunderboreThink_6FCA3CE0_113c", 24u, { 223, 0, 0, 0 } },
  { 0x6FCA43F0u, "MONAI_TentacleBeastHeadThink_6FCA43F0_113c", 298u, { 223, 167, 0, 0 } },
  { 0x6FCA4A90u, "AI_ThinkChargeStateIconMelee_6FCA4A90_113c", 29u, { 216, 156, 0, 0 } },
  { 0x6FCA4DB0u, "AI_ThinkOblivionKnightCaster_6FCA4DB0_113c", 312u, { 231, 335, 210, 211 } },
  { 0x6FCA51E0u, "MONAI_SkirmishApproachFleeAttackThink_6FCA51E0_113c", 274u, { 231, 158, 0, 0 } },
  { 0x6FCA64A0u, "AI_ThinkThornHulk_6FCA64A0_113c", 160u, { 223, 0, 0, 0 } },
  { 0x6FCA6900u, "AI_ThinkVampire_6FCA6900_113c", 131u, { 231, 169, 170, 171 } },
  { 0x6FCA7010u, "AI_ThinkWillowisp_6FCA7010_113c", 68u, { 223, 161, 162, 163 } },
  { 0x6FCA74A0u, "AI_ThinkSlinger_6FCA74A0_113c", 10u, { 223, 0, 0, 0 } },
  { 0x6FCA7A60u, "AI_ThinkMonsterSpawnerNest_6FCA7A60_113c", 284u, { 223, 161, 162, 163 } },
  { 0x6FCA7E60u, "MONAI_OblivionKnightThink_6FCA7E60_113c", 238u, { 223, 179, 332, 184 } },
  { 0x6FCA8380u, "AI_GreaterMummyThink_6FCA8380_113c", 101u, { 231, 327, 182, 157 } },
  { 0x6FCA8810u, "AI_ThinkBloodLord_6FCA8810_113c", 78u, { 223, 132, 0, 0 } },
  { 0x6FCA8A70u, "MONAI_SuccubusThink_6FCA8A70_113c", 594u, { 216, 107, 0, 0 } },
  { 0x6FCA8D80u, "MONAI_FetishShamanOrCasterThink_6FCA8D80_113c", 73u, { 216, 352, 0, 0 } },
  { 0x6FCA9430u, "MONAI_AuraKnightOrZealotThink_6FCA9430_113c", 211u, { 236, 107, 10, 97 } },
  { 0x6FCA9870u, "AI_Think_SandMaggot_6FCA9870_113c", 247u, { 223, 176, 180, 0 } },
  { 0x6FCA9C30u, "AI_Think_BurrowingScarabOrFrog_6FCA9C30_113c", 110u, { 223, 0, 0, 0 } },
  { 0x6FCC4B90u, "AI_AttackWestOffsetThenDie_6FCC4B90_113c", 355u, { 0, 0, 0, 0 } },
  { 0x6FCC4FD0u, "AI_ReverseCheckAndCastRandomPosSkill_6FCC4FD0_113c", 516u, { 287, 288, 303, 304 } },
  { 0x6FCC5580u, "AI_TickEmergeQuadrantAttackAndSubmerge_6FCC5580_113c", 403u, { 0, 0, 0, 0 } },
  { 0x6FCC58D0u, "AI_TickAmbientMode8OrStall30_6FCC58D0_113c", 204u, { 0, 0, 0, 0 } },
  { 0x6FCC59B0u, "MONAI_UnburrowThink_6FCC59B0_113c", 243u, { 246, 193, 194, 195 } },
  { 0x6FCC5C80u, "MONAI_MinionSwitchToBaseAiThink_6FCC5C80_113c", 19u, { 36, 0, 0, 0 } },
  { 0x6FCC5D70u, "MONAI_MeleeSkillOrApproachWithTimerThink_6FCC5D70_113c", 571u, { 223, 97, 0, 0 } },
  { 0x6FCC6530u, "MONAI_MeleeAndRangedSkillThink_6FCC6530_113c", 529u, { 223, 308, 0, 0 } },
  { 0x6FCC6E60u, "MONAI_DarkWandererThink_6FCC6E60_113c", 368u, { 0, 0, 0, 0 } },
  { 0x6FCC7410u, "MONAI_WorldstoneMinionThink_6FCC7410_113c", 559u, { 223, 0, 0, 0 } },
  { 0x6FCC7580u, "MONAI_NihlathakThink_6FCC7580_113c", 526u, { 223, 330, 295, 351 } },
  { 0x6FCC7A10u, "MONAI_RescuedBarbarianSoldierThink_6FCC7A10_113c", 534u, { 206, 0, 0, 0 } },
  { 0x6FCC8270u, "MONAI_StationaryMeleeWithin25ThinkA_6FCC8270_113c", 19u, { 36, 0, 0, 0 } },
  { 0x6FCC8350u, "MONAI_StationaryMeleeWithin25ThinkB_6FCC8350_113c", 272u, { 206, 0, 0, 0 } },
  { 0x6FCC8430u, "MONAI_BaalThroneThink_6FCC8430_113c", 543u, { 87, 285, 309, 310 } },
  { 0x6FCC9610u, "AIBAAL_CombatThink_6FCC9610_113c", 243u, { 246, 193, 194, 195 } },
  { 0x6FCCA1D0u, "AI_Think_Raven_6FCCA1D0_113c", 419u, { 206, 221, 0, 0 } },
  { 0x6FCCC8E0u, "AI_MercOrShadowWarriorThink_6FCCC8E0_113c", 420u, { 206, 292, 0, 0 } },
  { 0x6FCD78A0u, "AIBAAL_ReinitAiThinkAndRestoreCmd10_6FCD78A0_113c", 544u, { 241, 316, 317, 315 } },
  { 0x6FCD8610u, "AIBAAL_ThroneRoomThink_6FCD8610_113c", 544u, { 241, 316, 317, 315 } },
};

static void emit_group_3_monai(void) {
  X86CallSpec c;
  int64_t ts[10];
  static const uint32_t kSeeds[4] = { 0x00000005u, 0x55555555u, 0x12345679u, 0x9ABCDEF1u };
  static const uint32_t kDists[4] = { 12u, 2u, 6u, 16u };
  static const uint32_t kMelee[4] = { 0u, 1u, 0u, 0u };
  static const uint16_t kTx[4]    = { 5012u, 5002u, 5006u, 5016u };
  static const char *kLbl[4]      = { "far_s0", "melee_s0", "mid_s1", "long_lowhp_s2" };
  size_t n = sizeof(kGroup3MonAi) / sizeof(kGroup3MonAi[0]);
  for (size_t i = 0; i < n; i++) {
    for (int k = 0; k < 4; k++) {
      reset_case();
      c = make_call();
      stage_timer_queue();
      stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                         kGroup3MonAi[i].classId, 4001u + (uint32_t)i, 1u, 5000u, 5000u, kSeeds[k]);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 20, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, (k == 3 ? 40 : 200) << 8, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 200 << 8, 0);
      for (int s = 0; s < 4; s++) {
        if (kGroup3MonAi[i].skills[s] > 0) {
          attach_skill(STAGE_UNIT0, kGroup3MonAi[i].skills[s], 3);
        }
      }
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0,
                        0u, 0u, 5001u + (uint32_t)i, 1u, kTx[k], 5000u, 5001u + (uint32_t)i);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 20, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 200 << 8, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 200 << 8, 0);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U32(STAGE_UNIT0 + 0xE8u) = STAGE_UNIT1;
      U32(STAGE_ROOM0 + 0x74u) = STAGE_UNIT0;
      uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
      if (k == 2) U32(pAiCtrl + 0x00u) = 1u;
      if (k == 3) U32(pAiCtrl + 0x00u) = 2u;
      U32(STAGE_SCRATCH + 0x00u) = pAiCtrl;
      U32(STAGE_SCRATCH + 0x04u) = kGroup3MonAi[i].va;
      U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT1;
      U32(STAGE_SCRATCH + 0x10u) = 1u;
      U32(STAGE_SCRATCH + 0x14u) = kDists[k];
      U32(STAGE_SCRATCH + 0x18u) = kMelee[k];
      U32(STAGE_SCRATCH + 0x1Cu) = U32(STAGE_UDATA0 + 0x00u);
      c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
      c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
      ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
      run_and_emit(kGroup3MonAi[i].va, kGroup3MonAi[i].name, k, kLbl[k], &c, ts, 3, 0u, 0);
    }
  }
}

int main(int argc, char **argv) {
  const char *imgPath = (argc > 1) ? argv[1] : "d2game-datatbls-113c.img";
  const char *outPath = (argc > 2) ? argv[2] : "k6-fix2-d2game-vectors.ndjson";

  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  AddVectoredExceptionHandler(1, k6_veh);

  void *pTbls  = VirtualAlloc((void *)DATATBLS_BASE, DATATBLS_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pStage = VirtualAlloc((void *)STAGE_BASE, STAGE_TOTAL_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pHeap  = VirtualAlloc((void *)HEAP_BASE, HEAP_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if ((uintptr_t)pTbls != DATATBLS_BASE || (uintptr_t)pStage != STAGE_BASE || (uintptr_t)pHeap != HEAP_BASE) {
    fprintf(stderr, "[k6-fix2] VirtualAlloc failed (%p %p %p)\n", pTbls, pStage, pHeap);
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
    fprintf(stderr, "[k6-fix2] LoadLibraryA failed\n");
    fflush(stderr);
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-fix2] unexpected D2Common rebase: %p\n", (void *)g_hCom);
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
    fprintf(stderr, "[k6-fix2] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-fix2] failed to open %s for writing\n", outPath);
    return 5;
  }

  emit_group_1();
  emit_group_2();
  emit_group_3_monai();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-fix2] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
