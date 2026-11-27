/*
 * k6-w5-d2game-emitter.c — Milestone #37 [K6] Wave 5 Real-DLL Differential Emitter (Lo-VA)
 *
 * Loads real Diablo II: Lord of Destruction v1.13c DLLs (Storm.dll, Fog.dll,
 * D2Lang.dll, D2CMP.dll, D2Common.dll, D2Net.dll, D2Game.dll) under headless Wine,
 * hydrates canonical sgptDataTables (0x20000000..0x206F7FFF + D2Common .data/.bss)
 * from d2game-datatbls-113c.img, hooks Fog.#10024 (assert) and Fog.#10042..10047
 * (deterministic bump allocator), and executes 150 net-new real D2Game.dll functions
 * strictly inside 0x6FC20000..0x6FCBFFFF (>= 3 non-degenerate cases per VA).
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
#define STAGE_QUESTARG    (STAGE_BASE + 0x6600u) /* 0x0100: D2QuestArgStrc */
#define STAGE_QBITS0      (STAGE_BASE + 0x6700u) /* 0x0100: quest bit record + buffer */
#define STAGE_PETCTRL     (STAGE_BASE + 0x6800u) /* 0x0200: pPlayerPets + buckets/nodes */
#define STAGE_PARTYCTRL   (STAGE_BASE + 0x6A00u) /* 0x0200: pPartyControl + nodes */
#define STAGE_NPCCTRL     (STAGE_BASE + 0x6C00u) /* 0x1200: pNpcControl + 64*0x44 array */
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
typedef void *(__stdcall *Com_AllocInventory_t)(void *pPool, void *pOwner);
typedef void  (__stdcall *Com_SetCursorItem_t)(void *pInv, void *pItem);
typedef int32_t(__stdcall *Com_PlaceItemInBodyLoc_t)(void *pInv, void *pItem, int32_t bodyLoc);
typedef int32_t(__stdcall *Com_CheckItemTypeId_t)(void *pItem, int32_t itemType);
typedef int32_t(__stdcall *Com_UnitsIsDoor_t)(void *pUnit);
typedef int32_t(__stdcall *Com_HasObjectSubClassBit0_t)(void *pUnit);
typedef int32_t(__stdcall *Com_CheckCompactSave_t)(int32_t itemClassId);
typedef int32_t(__stdcall *Com_GetItemType_t)(void *pItem);

static Com_CreateStatListEx_t      fn_CreateStatListEx      = NULL;
static Com_SetUnitStat_t           fn_SetUnitStat           = NULL;
static Com_AllocStatList_t         fn_AllocStatList         = NULL;
static Com_SetStatIfValid_t        fn_SetStatIfValid        = NULL;
static Com_SetStatListState_t      fn_SetStatListState      = NULL;
static Com_MergeStatLists_t        fn_MergeStatLists        = NULL;
static Com_ToggleGfxState_t        fn_ToggleGfxState        = NULL;
static Com_AllocSkillList_t        fn_AllocSkillList        = NULL;
static Com_SetSkillLevel_t         fn_SetSkillLevel         = NULL;
static Com_AllocInventory_t        fn_AllocInventory        = NULL;
static Com_SetCursorItem_t         fn_SetCursorItem         = NULL;
static Com_PlaceItemInBodyLoc_t    fn_PlaceItemInBodyLoc    = NULL;
static Com_CheckItemTypeId_t       fn_CheckItemTypeId       = NULL;
static Com_UnitsIsDoor_t           fn_UnitsIsDoor           = NULL;
static Com_HasObjectSubClassBit0_t fn_HasObjectSubClassBit0 = NULL;
static Com_CheckCompactSave_t      fn_CheckCompactSave      = NULL;
static Com_GetItemType_t           fn_GetItemType           = NULL;

/* Discovered real v1.13c item/object/missile/unique IDs */
static uint32_t g_item_claw      = 0;
static uint32_t g_item_bow       = 0;
static uint32_t g_item_ring      = 0;
static uint32_t g_item_ear       = 0;
static uint32_t g_item_metal     = 0;
static uint32_t g_item_nonmetal  = 0;
static uint32_t g_item_malus     = 0;
static uint32_t g_item_sup_f18   = 0;
static uint32_t g_item_sup_f1c   = 0;
static uint32_t g_obj_sub0       = 0;
static uint32_t g_obj_nonsub0    = 0;
static uint32_t g_mis_overlay    = 0;
static uint32_t g_mis_no_overlay = 0;
static uint32_t g_mis_pierce     = 0;
static uint32_t g_mis_nopierce   = 0;
static uint32_t g_mis_dmnund     = 0;
static uint32_t g_mis_calc90     = 0;
static uint32_t g_unique_dis     = 0;
static uint32_t g_unique_en      = 0;

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

uint32_t g_thunk_out_eax = 0;
uint32_t g_thunk_saved_esp = 0;
uint32_t g_thunk_saved_ebp = 0;
uint32_t g_thunk_esp_before = 0;
uint32_t g_thunk_esp_after  = 0;

volatile LONG g_thunk_in_call = 0;
volatile LONG g_thunk_faulted = 0; /* 0 = ok, 1 = hw exception, 2 = Fog.#10024 assert */
uint32_t g_fault_code = 0;
uint32_t g_fault_eip  = 0;
uint32_t g_fault_addr = 0;
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
      fprintf(stderr,
              "[k6-w5] SETUP/INIT FAULT after %u emitted: code=0x%08lX eip=%p (game=0x%08lX com=0x%08lX) addr=0x%08X\n",
              g_total_emitted, (unsigned long)code, (void *)eip,
              (unsigned long)gameOff, (unsigned long)comOff, avAddr);
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
      fprintf(stderr, "[k6-w5] setup bump overflow (size=%u)\n", dwSize);
      TerminateProcess(GetCurrentProcess(), 21);
    }
    memset((void *)(uintptr_t)p, 0, dwSize);
    g_setup_top = p + dwSize;
    record_alloc_size(p, dwSize);
    return (void *)(uintptr_t)p;
  } else {
    uint32_t p = (g_heap_top + 3u) & ~3u;
    if (p + dwSize > HEAP_BASE + HEAP_SIZE) {
      fprintf(stderr, "[k6-w5] heap bump overflow (size=%u)\n", dwSize);
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
      fprintf(stderr, "[k6-w5] missing Fog.#%u\n", hooks[i].ord);
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
    fprintf(stderr, "[k6-w5] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-w5] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(0x6FDE9000u + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-w5] short read at page %u\n", i);
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
      fprintf(stderr, "[k6-w5] JSON buffer overflow\n");
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
  U32(pAct + 0x08u)     = 1u; /* dwTownId */
  U32(pAct + 0x10u)     = pRoom;
  U32(pAct + 0x48u)     = STAGE_DRLG0;
  U32(STAGE_DRLG0 + 0x47Cu) = pLevel;
  if (U32(STAGE_GAME + 0xBCu) == 0u) {
    U32(STAGE_GAME + 0xBCu) = pAct;
  }
  U32(pRoom + 0x10u)    = pRoomEx;
  U32(pRoom + 0x2Cu)    = pAct; /* pAct for UNITROOM_RefreshUnit */
  U32(pRoom + 0x4Cu)    = 4800u; /* nSubtileX */
  U32(pRoom + 0x50u)    = 4800u; /* nSubtileY */
  U32(pRoom + 0x54u)    = 1000u; /* nSubtileWidth */
  U32(pRoom + 0x58u)    = 1000u; /* nSubtileHeight */
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
  U32(pPath + 0x1Cu)  = pRoom;   /* D2DynamicPathStrc.pRoom */
  U32(pPath + 0x30u)  = pUnit;   /* D2DynamicPathStrc.pUnit */
  U32(pPath + 0x7Cu)  = 0x1800u; /* D2DynamicPathStrc.dwVelocity */
}

static void stage_static_path(uint32_t pUnit, uint32_t pPath, uint32_t pRoom, int32_t x, int32_t y) {
  U32(pUnit + 0x2Cu) = pPath;
  U32(pPath + 0x00u) = pRoom;
  S32(pPath + 0x04u) = x;
  S32(pPath + 0x08u) = y;
  S32(pPath + 0x0Cu) = x;
  S32(pPath + 0x10u) = y;
}

/* Pure-C server unit hash table insertion matching SUNIT_InsertUnitInHashTable */
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
  U32(pUnit + 0xC4u) = 0x00000004u; /* UNITFLAG_TARGETABLE */
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

/* Link a single item into pUnit's inventory node list (D2ItemExtraDataStrc at pItemData+0x5C) */
static void attach_inv_item_raw(uint32_t pUnit, uint32_t pItem, uint8_t invPage, uint8_t bodyLoc, uint8_t nodePosOther) {
  uint32_t pInv = U32(pUnit + 0x60u);
  if (pInv == 0u) {
    pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)pUnit);
    U32(pUnit + 0x60u) = pInv;
  }
  uint32_t pItemData = U32(pItem + 0x14u);
  uint32_t oldFirst  = U32(pInv + 0x0Cu);
  U8(pItemData + 0x45u)  = invPage;
  U8(pItemData + 0x44u)  = bodyLoc;
  U32(pItemData + 0x5Cu) = pInv;         /* pOwnerInventory */
  U32(pItemData + 0x60u) = 0u;           /* pPrevItem */
  U32(pItemData + 0x64u) = oldFirst;     /* pNextItem */
  U8(pItemData + 0x69u)  = nodePosOther; /* nNodePosOther */
  if (oldFirst != 0u) {
    U32(U32(oldFirst + 0x14u) + 0x60u) = pItem;
  } else {
    U32(pInv + 0x10u) = pItem;
  }
  U32(pInv + 0x0Cu) = pItem;
  U32(pInv + 0x14u) = U32(pInv + 0x14u) + 1u;
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
            "[k6-w5] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }

  if (expectAssert && g_thunk_faulted != 2) {
    fprintf(stderr, "[k6-w5] EXPECTED ASSERT did not fire at %s (0x%08X) case %d (%s)\n",
            fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!expectAssert && g_thunk_faulted == 2) {
    fprintf(stderr, "[k6-w5] UNEXPECTED Fog.#10024 assert line %u at %s (0x%08X) case %d (%s)\n",
            g_assert_line, fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 32);
  }

  if (g_thunk_faulted == 0) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-w5] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
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

/* ------------------------------- Startup Discovery of Canonical Table IDs */

static void discover_table_ids(void) {
  reset_case();
  uint32_t nItems    = U32(0x6FDEFB94u + g_com_rebase);
  uint32_t pItems    = U32(0x6FDEFB98u + g_com_rebase);
  uint32_t nObjects  = U32(0x6FDF0B98u + g_com_rebase);
  uint32_t pObjects  = U32(0x6FDF0B94u + g_com_rebase);
  uint32_t pTables   = U32(0x6FDE9E1Cu + g_com_rebase); /* sgptDataTables */

  /* Discover item IDs */
  U32(STAGE_UNIT2 + 0x00u) = 4u;
  U32(STAGE_UNIT2 + 0x14u) = STAGE_UDATA2;
  for (uint32_t id = 0; id < nItems; id++) {
    U32(STAGE_UNIT2 + 0x04u) = id;
    uint32_t code = U32(pItems + id * 0x1A8u + 0x80u);
    if (!g_item_malus && code == 0x206D6468u) g_item_malus = id; /* "hdm " */
    if (!g_item_claw && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x2E)) g_item_claw = id;
    if (!g_item_bow && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x1B)) g_item_bow = id;
    if (!g_item_ring && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x0A)) g_item_ring = id;
    if (!g_item_ear && fn_GetItemType((void *)(uintptr_t)STAGE_UNIT2) == 7) g_item_ear = id;
    int32_t isCompact = fn_CheckCompactSave((int32_t)id);
    if (!g_item_metal && isCompact != 0) g_item_metal = id;
    if (!g_item_nonmetal && isCompact == 0) g_item_nonmetal = id;
  }

  /* Discover QualityItems matching item codes via D2Common.#10480 */
  {
    typedef uint32_t(__stdcall *GetQualDesc_t)(void);
    GetQualDesc_t fnQual = (GetQualDesc_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10480));
    if (fnQual) {
      uint32_t pDesc = fnQual();
      if (pDesc) {
        uint32_t cnt = U32(pDesc);
        uint32_t tbl = U32(pDesc + 4u);
        if (cnt > 0u && tbl != 0u) {
          uint32_t c18 = U32(tbl + 0x18u);
          uint32_t c1c = U32(tbl + 0x1Cu);
          for (uint32_t id = 0; id < nItems; id++) {
            uint32_t code = U32(pItems + id * 0x1A8u + 0x80u);
            if (!g_item_sup_f18 && code == c18) g_item_sup_f18 = id;
            if (!g_item_sup_f1c && code == c1c) g_item_sup_f1c = id;
          }
        }
      }
    }
  }

  /* Discover object IDs with/without SubClass bit 0 */
  U32(STAGE_UNIT2 + 0x00u) = 2u;
  U32(STAGE_UNIT2 + 0x14u) = STAGE_UDATA2;
  for (uint32_t oid = 1; oid < nObjects; oid++) {
    U32(STAGE_UNIT2 + 0x04u)  = oid;
    U32(STAGE_UDATA2 + 0x00u) = pObjects + oid * 0x1C0u;
    int32_t hasBit0 = fn_HasObjectSubClassBit0((void *)(uintptr_t)STAGE_UNIT2);
    if (!g_obj_sub0 && hasBit0 != 0) g_obj_sub0 = oid;
    if (!g_obj_nonsub0 && hasBit0 == 0) g_obj_nonsub0 = oid;
    if (g_obj_sub0 && g_obj_nonsub0) break;
  }

  /* Discover missile IDs from sgptDataTables (+0xB64 base, +0xB6C count, stride 0x1A4) */
  if (pTables != 0u) {
    uint32_t pMisBase = U32(pTables + 0xB64u);
    uint32_t nMisCnt  = U32(pTables + 0xB6Cu);
    for (uint32_t mid = 1; mid < nMisCnt; mid++) {
      uint32_t rec = pMisBase + mid * 0x1A4u;
      int16_t ov = S16(rec + 0x36u);
      uint8_t fl = U8(rec + 0x04u);
      int32_t dmn = S32(rec + 0x78u);
      int32_t und = S32(rec + 0x7Cu);
      uint32_t c90 = U32(rec + 0x90u);
      if (!g_mis_overlay && ov > 0) g_mis_overlay = mid;
      if (!g_mis_no_overlay && ov <= 0) g_mis_no_overlay = mid;
      if (!g_mis_pierce && (fl & 0x04u) != 0u) g_mis_pierce = mid;
      if (!g_mis_nopierce && (fl & 0x04u) == 0u) g_mis_nopierce = mid;
      if (!g_mis_dmnund && (dmn > 0 || und > 0)) g_mis_dmnund = mid;
      if (!g_mis_calc90 && c90 != 0u) g_mis_calc90 = mid;
    }

    /* Discover enabled/disabled UniqueItems IDs (+0xC24 base, +0xC28 count, stride 0x14C) */
    uint32_t pUniqBase = U32(pTables + 0xC24u);
    uint32_t nUniqCnt  = U32(pTables + 0xC28u);
    for (uint32_t uid = 0; uid < nUniqCnt; uid++) {
      uint8_t fl = U8(pUniqBase + uid * 0x14Cu + 0x2Cu);
      if (!g_unique_dis && (fl & 0x04u) != 0u) g_unique_dis = uid;
      if (!g_unique_en && (fl & 0x04u) == 0u) g_unique_en = uid;
      if (g_unique_dis && g_unique_en) break;
    }
  }
}

/* ------------------------------- Batch 1: VAs 1..50 */

static void emit_batch_1_to_50(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [1] 0x6FC4A0C0 CLIENTS_CaptureFirstInGameClientCallback113c (ecx=pClient, edx=pOutClientPtr, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pCli = (k == 0) ? STAGE_CLIENT : (STAGE_CLIENT + 0x10u * (uint32_t)k);
    U32(STAGE_SCRATCH) = (k == 2) ? 0x30002100u : 0u;
    c.ecx = pCli; c.edx = STAGE_SCRATCH;
    ts[0] = pCli; ts[1] = STAGE_SCRATCH;
    run_and_emit(0x6FC4A0C0u, "CLIENTS_CaptureFirstInGameClientCallback113c", k,
                 k == 0 ? "capture_first" : k == 1 ? "capture_alt" : "keep_existing", &c, ts, 2, 0u, 0);
  }

  /* [2] 0x6FCAC490 S2C_QueueSingleBytePacket1_6FCAC490_113c (al=bPacketId, stack=[pClient], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pktId = (k == 0) ? 0x00u : (k == 1 ? 0x05u : 0xB0u);
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c.eax = pktId; c.nargs = 1; c.args[0] = pCli; c.calleePop = 4u;
    ts[0] = pktId; ts[1] = pCli;
    run_and_emit(0x6FCAC490u, "S2C_QueueSingleBytePacket1_6FCAC490_113c", k,
                 k == 0 ? "null_client" : k == 1 ? "pkt_05" : "pkt_b0", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [3] 0x6FCAAAC0 NET_SendPacket61_ByteParam_6FCAAAC0_113c (al=bParam, stack=[pClient], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t param = (k == 0) ? 0u : (k == 1 ? 3u : 0x5Au);
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c.eax = param; c.nargs = 1; c.args[0] = pCli; c.calleePop = 4u;
    ts[0] = param; ts[1] = pCli;
    run_and_emit(0x6FCAAAC0u, "NET_SendPacket61_ByteParam_6FCAAAC0_113c", k,
                 k == 0 ? "null_client" : k == 1 ? "param_3" : "param_5a", &c, ts, 2, 0u, 0);
  }

  /* [4] 0x6FCAAD10 NET_SendPacket7B_ByteAndDword_6FCAAD10_113c (al=bPacketId, cl=bByte1, edx=dwParam2, stack=[pClient], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pktId = (k == 1) ? 0x7Bu : 0x7Cu;
    uint32_t b1    = (k == 2) ? 0x02u : 0x01u;
    uint32_t p2    = 0x11223344u + (uint32_t)k * 0x101u;
    uint32_t pCli  = (k == 0) ? 0u : STAGE_CLIENT;
    c.eax = pktId; c.ecx = b1; c.edx = p2; c.nargs = 1; c.args[0] = pCli; c.calleePop = 4u;
    ts[0] = pktId; ts[1] = b1; ts[2] = p2; ts[3] = pCli;
    run_and_emit(0x6FCAAD10u, "NET_SendPacket7B_ByteAndDword_6FCAAD10_113c", k,
                 k == 0 ? "null_client" : k == 1 ? "pkt_7b" : "pkt_7c", &c, ts, 4, 0u, 0);
  }

  /* [5] 0x6FCAB1F0 NET_SendPacket79_GoldInTrade_6FCAB1F0_113c (eax=dwGoldAmount, cl=bOwnerFlag, stack=[pClient], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t gold = (k == 1) ? 5000u : 999999u;
    uint32_t own  = (k == 2) ? 1u : 0u;
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c.eax = gold; c.ecx = own; c.nargs = 1; c.args[0] = pCli; c.calleePop = 4u;
    ts[0] = gold; ts[1] = own; ts[2] = pCli;
    run_and_emit(0x6FCAB1F0u, "NET_SendPacket79_GoldInTrade_6FCAB1F0_113c", k,
                 k == 0 ? "null_client" : k == 1 ? "owner0_5000" : "owner1_999999", &c, ts, 3, 0u, 0);
  }

  /* [6] 0x6FCABF50 NET_SendPacket07_RoomTileCoords_6FCABF50_113c (ax=wTileX, cx=wTileY, stack=[pClient, bAct], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t tx = 120u + (uint32_t)k * 30u;
    uint32_t ty = 240u + (uint32_t)k * 45u;
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    uint32_t act = (uint32_t)k;
    c.eax = tx; c.ecx = ty; c.nargs = 2; c.args[0] = pCli; c.args[1] = act; c.calleePop = 8u;
    ts[0] = tx; ts[1] = ty; ts[2] = pCli; ts[3] = act;
    run_and_emit(0x6FCABF50u, "NET_SendPacket07_RoomTileCoords_6FCABF50_113c", k,
                 k == 0 ? "null_client" : k == 1 ? "act1_coords" : "act2_coords", &c, ts, 4, 0u, 0);
  }

  /* [7] 0x6FCAAB20 NET_SendPacketBuffer7B_6FCAAB20_113c (eax=pSrc, stack=[pClient], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    for (uint32_t i = 0; i < 7u; i++) U8(STAGE_SCRATCH + i) = (uint8_t)(0x40u + (uint32_t)k * 16u + i);
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c.eax = STAGE_SCRATCH; c.nargs = 1; c.args[0] = pCli; c.calleePop = 4u;
    ts[0] = STAGE_SCRATCH; ts[1] = pCli;
    run_and_emit(0x6FCAAB20u, "NET_SendPacketBuffer7B_6FCAAB20_113c", k,
                 k == 0 ? "null_client" : k == 1 ? "buf_a" : "buf_b", &c, ts, 2, 0u, 0);
  }

  /* [8] 0x6FC9A540 NET_SendRemoveUnitPacket0A113c (ecx=pUnit, stack=[pClient], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t uType = (k == 0) ? 3u : (k == 1 ? 1u : 4u); /* type 3 missile skipped */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, 1u, 0x55u + (uint32_t)k, 1u, 5000u, 5000u, 81u);
    c.ecx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_CLIENT; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_CLIENT;
    run_and_emit(0x6FC9A540u, "NET_SendRemoveUnitPacket0A113c", k,
                 k == 0 ? "skip_missile" : k == 1 ? "remove_monster" : "remove_item", &c, ts, 2, 0u, 0);
  }

  /* [9] 0x6FCAA6C0 NET_SendPacket98_UnitWordValue_6FCAA6C0_113c (ecx=dwUnitGuid, dx=wValue, stack=[pClient], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t guid = 0x100u + (uint32_t)k * 0x111u;
    uint32_t val  = 0x0042u + (uint32_t)k * 0x100u;
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c.ecx = guid; c.edx = val; c.nargs = 1; c.args[0] = pCli; c.calleePop = 4u;
    ts[0] = guid; ts[1] = val; ts[2] = pCli;
    run_and_emit(0x6FCAA6C0u, "NET_SendPacket98_UnitWordValue_6FCAA6C0_113c", k,
                 k == 0 ? "null_client" : k == 1 ? "guid_a" : "guid_b", &c, ts, 3, 0u, 0);
  }

  /* [10] 0x6FCAAC90 NET_SendPacket15B_TransactionResult_6FCAAC90_113c (al=bPktId, cl=bResult, edx=dwParam11, stack=[pClient, dwParam7, bByte1], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pktId = (k == 1) ? 0x2Au : 0x2Bu;
    uint32_t res   = (uint32_t)k;
    uint32_t p11   = 0xAABB0000u + (uint32_t)k;
    uint32_t pCli  = (k == 0) ? 0u : STAGE_CLIENT;
    uint32_t p7    = 0xCCDD0000u + (uint32_t)k;
    uint32_t b1    = 0x05u + (uint32_t)k;
    c.eax = pktId; c.ecx = res; c.edx = p11;
    c.nargs = 3; c.args[0] = pCli; c.args[1] = p7; c.args[2] = b1; c.calleePop = 0xCu;
    ts[0] = pktId; ts[1] = res; ts[2] = p11; ts[3] = pCli; ts[4] = p7; ts[5] = b1;
    run_and_emit(0x6FCAAC90u, "NET_SendPacket15B_TransactionResult_6FCAAC90_113c", k,
                 k == 0 ? "null_client" : k == 1 ? "tx_a" : "tx_b", &c, ts, 6, 0u, 0);
  }

  /* [11] 0x6FCBBF40 PARTY_CountSubPartyMembers_6FCBBF40_113c (eax=pGame, ecx=wPartyId, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_GAME + 0x1D2Cu) = STAGE_PARTYCTRL;
    uint32_t pSub = STAGE_PARTYCTRL + 0x20u;
    uint32_t pM0  = STAGE_PARTYCTRL + 0x40u;
    uint32_t pM1  = STAGE_PARTYCTRL + 0x50u;
    U32(STAGE_PARTYCTRL + 0x04u) = pSub;
    U16(pSub + 0x00u) = 7u;
    if (k == 1) {
      U32(pSub + 0x04u) = pM0;
    } else if (k == 2) {
      U32(pSub + 0x04u) = pM0;
      U32(pM0 + 0x04u)  = pM1;
    }
    uint32_t pid = (k == 0) ? 99u : 7u;
    c.eax = STAGE_GAME; c.ecx = pid;
    ts[0] = STAGE_GAME; ts[1] = pid;
    run_and_emit(0x6FCBBF40u, "PARTY_CountSubPartyMembers_6FCBBF40_113c", k,
                 k == 0 ? "missing_party" : k == 1 ? "one_member" : "two_members", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [12] 0x6FCAAA10 NET_SendPacketBuffer32B_6FCAAA10_113c (eax=pSrc, stack=[pClient], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    for (uint32_t i = 0; i < 32u; i++) U8(STAGE_SCRATCH + i) = (uint8_t)(0x10u + (uint32_t)k * 32u + i);
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c.eax = STAGE_SCRATCH; c.nargs = 1; c.args[0] = pCli; c.calleePop = 4u;
    ts[0] = STAGE_SCRATCH; ts[1] = pCli;
    run_and_emit(0x6FCAAA10u, "NET_SendPacketBuffer32B_6FCAAA10_113c", k,
                 k == 0 ? "null_client" : k == 1 ? "pkt32_a" : "pkt32_b", &c, ts, 2, 0u, 0);
  }

  /* [13] 0x6FCAABF0 NET_SendPacketBuffer15B_6FCAABF0_113c (eax=pSrc, stack=[pClient], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    for (uint32_t i = 0; i < 15u; i++) U8(STAGE_SCRATCH + i) = (uint8_t)(0x20u + (uint32_t)k * 16u + i);
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c.eax = STAGE_SCRATCH; c.nargs = 1; c.args[0] = pCli; c.calleePop = 4u;
    ts[0] = STAGE_SCRATCH; ts[1] = pCli;
    run_and_emit(0x6FCAABF0u, "NET_SendPacketBuffer15B_6FCAABF0_113c", k,
                 k == 0 ? "null_client" : k == 1 ? "pkt15_a" : "pkt15_b", &c, ts, 2, 0u, 0);
  }

  /* [14] 0x6FCAC530 S2C_Send10BytePacketToPlayerUnit_6FCAC530_113c (edx=pPlayer, stack=[pPacket], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    for (uint32_t i = 0; i < 10u; i++) U8(STAGE_SCRATCH + i) = (uint8_t)(0x50u + (uint32_t)k * 8u + i);
    uint32_t pPlr = (k == 0) ? 0u : STAGE_UNIT0;
    if (k > 0) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 1 ? 1u : 0u), 0u, 1u, 1u, 5000u, 5000u, 141u);
      U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    }
    c.edx = pPlr; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = pPlr; ts[1] = STAGE_SCRATCH;
    run_and_emit(0x6FCAC530u, "S2C_Send10BytePacketToPlayerUnit_6FCAC530_113c", k,
                 k == 0 ? "null_plr" : k == 1 ? "non_player" : "valid_player", &c, ts, 2, 0u, 0);
  }

  /* [15] 0x6FCAC5F0 S2C_Send7BytePacketToPlayerUnit_6FCAC5F0_113c (edx=pPlayer, stack=[pPacket], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    for (uint32_t i = 0; i < 7u; i++) U8(STAGE_SCRATCH + i) = (uint8_t)(0x60u + (uint32_t)k * 8u + i);
    uint32_t pPlr = (k == 0) ? 0u : STAGE_UNIT0;
    if (k > 0) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 151u);
      U32(STAGE_UDATA0 + 0x9Cu) = (k == 1) ? 0u : STAGE_CLIENT;
    }
    c.edx = pPlr; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = pPlr; ts[1] = STAGE_SCRATCH;
    run_and_emit(0x6FCAC5F0u, "S2C_Send7BytePacketToPlayerUnit_6FCAC5F0_113c", k,
                 k == 0 ? "null_plr" : k == 1 ? "null_client" : "valid_player", &c, ts, 2, 0u, 0);
  }

  /* [16] 0x6FCAC690 S2C_Send11BytePacketToPlayerUnit_6FCAC690_113c (edx=pPlayer, stack=[pPacket], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    for (uint32_t i = 0; i < 11u; i++) U8(STAGE_SCRATCH + i) = (uint8_t)(0x70u + (uint32_t)k * 8u + i);
    uint32_t pPlr = (k == 0) ? 0u : STAGE_UNIT0;
    if (k > 0) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 161u);
      U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    }
    c.edx = pPlr; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = pPlr; ts[1] = STAGE_SCRATCH;
    run_and_emit(0x6FCAC690u, "S2C_Send11BytePacketToPlayerUnit_6FCAC690_113c", k,
                 k == 0 ? "null_plr" : k == 1 ? "pkt11_a" : "pkt11_b", &c, ts, 2, 0u, 0);
  }

  /* [17] 0x6FC6B3C0 CLIENTS_UpdateCurrentRoomIfChanged_6FC6B3C0_113c (eax=pClient, edi=pRoom, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_room(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 2u);
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    uint32_t pRoom = (k == 2) ? STAGE_ROOM1 : STAGE_ROOM0;
    if (k == 1) {
      U32(STAGE_CLIENT + 0x1B4u) = STAGE_ROOM0; /* unchanged */
    } else if (k == 2) {
      U32(STAGE_CLIENT + 0x1B4u) = STAGE_ROOM0; /* changed to STAGE_ROOM1 */
    }
    c.eax = pCli; c.edi = pRoom;
    ts[0] = pCli; ts[1] = pRoom;
    run_and_emit(0x6FC6B3C0u, "CLIENTS_UpdateCurrentRoomIfChanged_6FC6B3C0_113c", k,
                 k == 0 ? "assert_null_client" : k == 1 ? "same_room" : "change_room", &c, ts, 2, 0u, k == 0);
  }

  /* [18] 0x6FCAAA70 NET_SendPacketBuffer21B_6FCAAA70_113c (eax=pSrc, stack=[pClient], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    for (uint32_t i = 0; i < 21u; i++) U8(STAGE_SCRATCH + i) = (uint8_t)(0x30u + (uint32_t)k * 16u + i);
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c.eax = STAGE_SCRATCH; c.nargs = 1; c.args[0] = pCli; c.calleePop = 4u;
    ts[0] = STAGE_SCRATCH; ts[1] = pCli;
    run_and_emit(0x6FCAAA70u, "NET_SendPacketBuffer21B_6FCAAA70_113c", k,
                 k == 0 ? "null_client" : k == 1 ? "pkt21_a" : "pkt21_b", &c, ts, 2, 0u, 0);
  }

  /* [19] 0x6FCAB2F0 NET_SendPacketBuffer21B_Alt_6FCAB2F0_113c (eax=pSrc, stack=[pClient], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    for (uint32_t i = 0; i < 21u; i++) U8(STAGE_SCRATCH + i) = (uint8_t)(0x80u + (uint32_t)k * 16u + i);
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c.eax = STAGE_SCRATCH; c.nargs = 1; c.args[0] = pCli; c.calleePop = 4u;
    ts[0] = STAGE_SCRATCH; ts[1] = pCli;
    run_and_emit(0x6FCAB2F0u, "NET_SendPacketBuffer21B_Alt_6FCAB2F0_113c", k,
                 k == 0 ? "null_client" : k == 1 ? "alt21_a" : "alt21_b", &c, ts, 2, 0u, 0);
  }

  /* [20] 0x6FCAC230 S2C_QueueUnitTargetMovePacket16_6FCAC230_113c
     (al=bPacketId, cl=bUnitType, edx=dwUnitId, stack=[pClient, bMoveType, bTargetType, dwTargetId, wX, wY], ret 0x18) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c.eax = 0x10u + (uint32_t)k; c.ecx = (uint32_t)k; c.edx = 0x1000u + (uint32_t)k;
    c.nargs = 6;
    c.args[0] = pCli; c.args[1] = 2u + (uint32_t)k; c.args[2] = 1u;
    c.args[3] = 0x2000u + (uint32_t)k; c.args[4] = 5000u + (uint32_t)k; c.args[5] = 5100u + (uint32_t)k;
    c.calleePop = 0x18u;
    ts[0] = c.eax; ts[1] = c.ecx; ts[2] = c.edx;
    ts[3] = c.args[0]; ts[4] = c.args[1]; ts[5] = c.args[2];
    ts[6] = c.args[3]; ts[7] = c.args[4]; ts[8] = c.args[5];
    run_and_emit(0x6FCAC230u, "S2C_QueueUnitTargetMovePacket16_6FCAC230_113c", k,
                 k == 0 ? "null_client" : k == 1 ? "move_a" : "move_b", &c, ts, 9, 0u, 0);
  }

  /* [21] 0x6FCAC160 S2C_QueueMonsterMovePacket12_6FCAC160_113c
     (cl=bPacketId, edx=dwUnitId, stack=[pClient, bByte5, bByte6, dwField7, bByte11], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c.ecx = 0x67u + (uint32_t)k; c.edx = 0x3000u + (uint32_t)k;
    c.nargs = 5;
    c.args[0] = pCli; c.args[1] = 0x11u + (uint32_t)k; c.args[2] = 0x22u + (uint32_t)k;
    c.args[3] = 0x55667788u + (uint32_t)k; c.args[4] = 0x99u + (uint32_t)k;
    c.calleePop = 0x14u;
    ts[0] = c.ecx; ts[1] = c.edx;
    ts[2] = c.args[0]; ts[3] = c.args[1]; ts[4] = c.args[2]; ts[5] = c.args[3]; ts[6] = c.args[4];
    run_and_emit(0x6FCAC160u, "S2C_QueueMonsterMovePacket12_6FCAC160_113c", k,
                 k == 0 ? "null_client" : k == 1 ? "monmove_a" : "monmove_b", &c, ts, 7, 0u, 0);
  }

  /* [22] 0x6FC4AC60 CLIENTS_SendHandshakeAndSetInitState1_6FC4AC60_113c (esi=pClient, eax=pGame, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_GAME + 0x1D28u) = STAGE_SCRATCH; /* pArenaCtrl */
    U32(STAGE_SCRATCH + 0x08u) = (k == 2) ? 0x12345678u : 0x00000040u;
    U8(STAGE_GAME + 0x6Du) = (uint8_t)k;
    U32(STAGE_GAME + 0x74u) = (k == 2) ? 1u : 0u;
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c.esi = pCli; c.eax = STAGE_GAME;
    ts[0] = pCli; ts[1] = STAGE_GAME;
    run_and_emit(0x6FC4AC60u, "CLIENTS_SendHandshakeAndSetInitState1_6FC4AC60_113c", k,
                 k == 0 ? "assert_null_client" : k == 1 ? "handshake_norm" : "handshake_hell", &c, ts, 2, 0u, k == 0);
  }

  /* [23] 0x6FCAAF10 NET_SendPacket42_ClearCursor_6FCAAF10_113c (eax=pUnit, stack=[pClient], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    if (k > 0) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 1 ? 0u : 4u), 1u, 0x70u + (uint32_t)k, 1u, 5000u, 5000u, 231u);
    }
    c.eax = pU; c.nargs = 1; c.args[0] = STAGE_CLIENT; c.calleePop = 4u;
    ts[0] = pU; ts[1] = STAGE_CLIENT;
    run_and_emit(0x6FCAAF10u, "NET_SendPacket42_ClearCursor_6FCAAF10_113c", k,
                 k == 0 ? "null_unit" : k == 1 ? "player_unit" : "item_unit", &c, ts, 2, 0u, 0);
  }

  /* [24] 0x6FC576F0 PLAYER_AllocPlayerDataQuestBitBuffers_6FC576F0_113c (eax=pPlayerUnit, ecx=pGame, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pPlr = (k == 0) ? 0u : STAGE_UNIT0;
    if (k > 0) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
      stage_unit_common(STAGE_UNIT0, (k == 1 ? 0u : STAGE_UDATA0), STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 241u);
      if (k == 2) {
        U32(STAGE_UDATA0 + 0x6Cu) = 0xDEADBEEFu;
      }
    }
    c.eax = pPlr; c.ecx = STAGE_GAME;
    ts[0] = pPlr; ts[1] = STAGE_GAME;
    run_and_emit(0x6FC576F0u, "PLAYER_AllocPlayerDataQuestBitBuffers_6FC576F0_113c", k,
                 k == 0 ? "assert_null_plr" : k == 1 ? "null_pdata" : "alloc_3_pairs", &c, ts, 2, 0u, k == 0);
  }

  /* [25] 0x6FC98100 PLAYER_CanInterruptCurrentSkillOrEvent113c (edi=pPlayer, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 251u);
    if (k == 0) {
      /* Event type 1 at frame 200 vs gameFrame 100 -> 100 <= 205 -> 1 */
      U8(STAGE_SCRATCH + 0x00u) = 1u;
      U32(STAGE_SCRATCH + 0x04u) = 200u;
      U32(STAGE_UNIT0 + 0xDCu) = STAGE_SCRATCH;
    } else if (k == 1) {
      /* No event -> nextEventFrame = 0; gameFrame = 100 > 5 -> 0 */
    } else {
      /* Used skill with interruptible flag (skill 36 Fire Bolt has +0x16 > 0 or fallback frame check) */
      uint32_t pSk = attach_skill(STAGE_UNIT0, 36, 1);
      U32(U32(STAGE_UNIT0 + 0xA8u) + 0x10u) = pSk;
      U32(STAGE_GAME + 0xA8u) = 100u;
    }
    c.edi = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FC98100u, "PLAYER_CanInterruptCurrentSkillOrEvent113c", k,
                 k == 0 ? "future_event_ok" : k == 1 ? "past_limit_false" : "used_skill_interrupt", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [26] 0x6FC57AC0 PLAYER_HasAnyLivingHostilePlayer_6FC57AC0_113c (ecx=pGame, eax=pPlayer, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pG = (k == 0) ? 0u : STAGE_GAME;
    uint32_t pP = STAGE_UNIT0;
    if (k > 0) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 261u);
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 2u, 1u, 5005u, 5005u, 262u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U32(STAGE_GAME + 0x88u) = STAGE_CLIENT;
      U32(STAGE_CLIENT + 0x174u) = STAGE_UNIT0;
      uint32_t pCli1 = stage_extra_client();
      U32(STAGE_CLIENT + 0x1ACu) = pCli1;
      U32(pCli1 + 0x174u) = STAGE_UNIT1;
      if (k == 2) {
        /* Mark UNIT0 and UNIT1 hostile via pUnit0->pPlayerData->pPvp (+0xA0) -> node (guid=2, flags=8) */
        uint32_t pHostile = (uint32_t)(uintptr_t)bump_alloc(0x10u);
        U32(pHostile + 0x00u) = 2u; /* target guid */
        U32(pHostile + 0x04u) = 8u; /* HOSTILE flag */
        U32(STAGE_UDATA0 + 0xA0u) = pHostile;
      }
    }
    c.ecx = pG; c.eax = pP;
    ts[0] = pG; ts[1] = pP;
    run_and_emit(0x6FC57AC0u, "PLAYER_HasAnyLivingHostilePlayer_6FC57AC0_113c", k,
                 k == 0 ? "null_game" : k == 1 ? "no_hostiles" : "hostile_present", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [27] 0x6FCAC280 NET_SendPacket13B_UnitCoordEvent_6FCAC280_113c
     (al=bUnitType, cl=bPacketId, edx=dwUnitGuid, stack=[pClient, bByte6, wX, wY, bByteB, bByteC], ret 0x18) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    c.eax = (k == 0) ? 6u : (uint32_t)k; /* >= 6 triggers assert 0x136 */
    c.ecx = 0x0Eu + (uint32_t)k;
    c.edx = 0x4444u + (uint32_t)k;
    c.nargs = 6;
    c.args[0] = STAGE_CLIENT; c.args[1] = 0x03u; c.args[2] = 5010u + (uint32_t)k;
    c.args[3] = 5020u + (uint32_t)k; c.args[4] = 0x07u; c.args[5] = 0x08u;
    c.calleePop = 0x18u;
    ts[0] = c.eax; ts[1] = c.ecx; ts[2] = c.edx;
    ts[3] = c.args[0]; ts[4] = c.args[1]; ts[5] = c.args[2];
    ts[6] = c.args[3]; ts[7] = c.args[4]; ts[8] = c.args[5];
    run_and_emit(0x6FCAC280u, "NET_SendPacket13B_UnitCoordEvent_6FCAC280_113c", k,
                 k == 0 ? "assert_bad_type" : k == 1 ? "type1_pkt" : "type2_pkt", &c, ts, 9, 0u, k == 0);
  }

  /* [28] 0x6FCAC420 NET_SendPacket8B_GameHandshake_6FCAC420_113c (eax=pGame, cl=bPacketId, stack=[pClient], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    if (k > 0) {
      U32(STAGE_GAME + 0x1D28u) = STAGE_SCRATCH;
      U32(STAGE_SCRATCH + 0x08u) = 0x00112233u * (uint32_t)k;
      U8(STAGE_GAME + 0x6Du) = (uint8_t)k;
      U32(STAGE_GAME + 0x74u) = (k == 2) ? 1u : 0u;
    }
    c.eax = STAGE_GAME; c.ecx = 0x01u; c.nargs = 1; c.args[0] = STAGE_CLIENT; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = 1; ts[2] = STAGE_CLIENT;
    run_and_emit(0x6FCAC420u, "NET_SendPacket8B_GameHandshake_6FCAC420_113c", k,
                 k == 0 ? "assert_null_arena" : k == 1 ? "handshake_nm" : "handshake_hell", &c, ts, 3, 0u, k == 0);
  }

  /* [29] 0x6FC46A30 PLRMODE_IsDualWieldingClaws_6FC46A30_113c (eax=pUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 291u);
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_claw, 10u, 1u, 0u, 0u, 292u);
      stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, (k == 2 ? g_item_claw : g_item_bow), 11u, 1u, 0u, 0u, 293u);
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
      fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT1, 4); /* RARM (hand slot 5 -> bodyLoc 4/5) */
      fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT2, 5); /* LARM */
    }
    c.eax = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    run_and_emit(0x6FC46A30u, "PLRMODE_IsDualWieldingClaws_6FC46A30_113c", k,
                 k == 0 ? "no_inv" : k == 1 ? "one_claw_one_bow" : "dual_claws", &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [30] 0x6FC696B0 CLIENTS_StoreSaveDataBuffer_6FC696B0_113c (ecx=pClient, eax=nSize, stack=[pSrcData], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    for (uint32_t i = 0; i < 16u; i++) U8(STAGE_SCRATCH + i) = (uint8_t)(0xA0u + i);
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    uint32_t sz   = (k == 1) ? 13u : 16u;
    if (k == 2) {
      U32(STAGE_CLIENT + 0x17Cu) = STAGE_SCRATCH + 0x100u; /* existing ptr -> realloc */
      U32(STAGE_CLIENT + 0x180u) = 16u;
    }
    c.ecx = pCli; c.eax = sz; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = pCli; ts[1] = sz; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FC696B0u, "CLIENTS_StoreSaveDataBuffer_6FC696B0_113c", k,
                 k == 0 ? "assert_null_client" : k == 1 ? "alloc_13b" : "realloc_16b", &c, ts, 3, 0u, k == 0);
  }

  /* [31] 0x6FC900C0 PLAYER_FreePlayerDataField5CList_6FC900C0_113c (eax=pPlayer, ebx=pGame, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 311u);
    if (k >= 1) {
      uint32_t p5c = STAGE_SCRATCH;
      U32(STAGE_UDATA0 + 0x5Cu) = p5c;
      U32(p5c + 0x04u) = STAGE_SCRATCH + 0x40u;
      if (k == 2) {
        U32(p5c + 0x08u) = STAGE_SCRATCH + 0x80u;
        U32(STAGE_SCRATCH + 0x80u + 0x08u) = STAGE_SCRATCH + 0xC0u;
      }
    }
    c.eax = STAGE_UNIT0; c.ebx = STAGE_GAME;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FC900C0u, "PLAYER_FreePlayerDataField5CList_6FC900C0_113c", k,
                 k == 0 ? "null_5c" : k == 1 ? "empty_nodes" : "two_nodes", &c, ts, 2, 0u, 0);
  }

  /* [32] 0x6FC82760 ACT1Q3_SetCompletedBeforeAlertCallback_6FC82760_113c (ecx=pGame, edx=pPlayer, stack=[pArg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 321u);
    U32(STAGE_UDATA0 + 0x9Cu) = (k == 2) ? 0u : STAGE_CLIENT;
    uint32_t pRec = STAGE_QBITS0;
    U32(pRec + 0x00u) = STAGE_QBITS0 + 0x10u;
    U32(pRec + 0x04u) = 0x60u;
    U32(STAGE_UDATA0 + 0x10u) = pRec;
    if (k == 0) {
      /* quest 5 bit 0 set -> skip */
      U8(STAGE_QBITS0 + 0x10u + (0x05u * 2u) + (0u >> 3)) = (uint8_t)(1u << (0u & 7u));
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC82760u, "ACT1Q3_SetCompletedBeforeAlertCallback_6FC82760_113c", k,
                 k == 0 ? "already_done_skip" : k == 1 ? "set_0e_send_5d" : "set_0e_null_client", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [33] 0x6FC825F0 ACT1Q6_SetCompletedBeforeAlertCallback_6FC825F0_113c (ecx=pGame, edx=pPlayer, stack=[pArg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 331u);
    U32(STAGE_UDATA0 + 0x9Cu) = (k == 2) ? 0u : STAGE_CLIENT;
    uint32_t pRec = STAGE_QBITS0;
    U32(pRec + 0x00u) = STAGE_QBITS0 + 0x10u;
    U32(pRec + 0x04u) = 0x60u;
    U32(STAGE_UDATA0 + 0x10u) = pRec;
    if (k == 0) {
      /* quest 6 bit 1 set -> skip */
      U8(STAGE_QBITS0 + 0x10u + (0x06u * 2u) + (1u >> 3)) = (uint8_t)(1u << (1u & 7u));
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC825F0u, "ACT1Q6_SetCompletedBeforeAlertCallback_6FC825F0_113c", k,
                 k == 0 ? "already_done_skip" : k == 1 ? "set_0e_send_5d" : "set_0e_null_client", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [34] 0x6FC896B0 OBJECTS_GrantUnitStrength_6FC896B0_113c (ecx=pGame, edx=pUnit, stack=[nDelta], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 1u, 1u, 5000u, 5000u, 341u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0, 30, 0);
    int32_t d = (k == 0) ? 0 : (k == 1 ? 5 : -3);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = (uint32_t)d; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = d;
    run_and_emit(0x6FC896B0u, "OBJECTS_GrantUnitStrength_6FC896B0_113c", k,
                 k == 0 ? "str_0" : k == 1 ? "str_plus5" : "str_minus3", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [35] 0x6FC896D0 OBJECTS_GrantUnitVitality_6FC896D0_113c (ecx=pGame, edx=pUnit, stack=[nDelta], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 1u, 1u, 5000u, 5000u, 351u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 3, 25, 0);
    int32_t d = (k == 0) ? 0 : (k == 1 ? 4 : 10);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = (uint32_t)d; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = d;
    run_and_emit(0x6FC896D0u, "OBJECTS_GrantUnitVitality_6FC896D0_113c", k,
                 k == 0 ? "vit_0" : k == 1 ? "vit_plus4" : "vit_plus10", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [36] 0x6FC896F0 OBJECTS_GrantUnitDexterity_6FC896F0_113c (ecx=pGame, edx=pUnit, stack=[nDelta], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 361u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 2, 20, 0);
    int32_t d = (k == 0) ? 0 : (k == 1 ? 3 : 7);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = (uint32_t)d; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = d;
    run_and_emit(0x6FC896F0u, "OBJECTS_GrantUnitDexterity_6FC896F0_113c", k,
                 k == 0 ? "dex_0" : k == 1 ? "dex_plus3" : "dex_plus7", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [37] 0x6FC89710 OBJECTS_GrantUnitEnergy_6FC89710_113c (ecx=pGame, edx=pUnit, stack=[nDelta], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 371u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 1, 35, 0);
    int32_t d = (k == 0) ? 0 : (k == 1 ? 5 : 12);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = (uint32_t)d; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = d;
    run_and_emit(0x6FC89710u, "OBJECTS_GrantUnitEnergy_6FC89710_113c", k,
                 k == 0 ? "ene_0" : k == 1 ? "ene_plus5" : "ene_plus12", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [38] 0x6FC536D0 OBJECTS_InitFn24_ScheduleEvent3_6FC536D0_113c (ecx=pObjInit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 100u + (uint32_t)k * 50u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 20u + (uint32_t)k, 0u, 5000u, 5000u, 381u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC536D0u, "OBJECTS_InitFn24_ScheduleEvent3_6FC536D0_113c", k,
                 k == 0 ? "frame_100" : k == 1 ? "frame_150" : "frame_200", &c, ts, 1, 0u, 0);
  }

  /* [39] 0x6FC8A900 OBJ_OnStaminaShrineStateRemoved_6FC8A900_113c (ecx=pUnit, edx=nState, stack=[pStatList], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 391u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 10, 20 << 8, 0); /* cur stamina */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 11, (50 + k * 25) << 8, 0); /* max stamina */
    fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x80, 1);
    c.ecx = STAGE_UNIT0; c.edx = 0x80u; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = 0x80; ts[2] = 0;
    run_and_emit(0x6FC8A900u, "OBJ_OnStaminaShrineStateRemoved_6FC8A900_113c", k,
                 k == 0 ? "max50" : k == 1 ? "max75" : "max100", &c, ts, 3, 0u, 0);
  }

  /* [40] 0x6FC89770 SHRINES_ApplyEnirhsReversePlayerName_6FC89770_113c (ecx=pObjOperate, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, (k == 0 ? 0u : STAGE_UDATA0), STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 401u);
    if (k == 1) {
      memcpy((void *)(uintptr_t)STAGE_UDATA0, "Hero", 5);
    } else if (k == 2) {
      memcpy((void *)(uintptr_t)STAGE_UDATA0, "Paladin", 8);
    }
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH; ts[1] = 0;
    run_and_emit(0x6FC89770u, "SHRINES_ApplyEnirhsReversePlayerName_6FC89770_113c", k,
                 k == 0 ? "null_pdata" : k == 1 ? "reverse_hero" : "reverse_paladin", &c, ts, 2, 0u, 0);
  }

  /* [41] 0x6FC8A930 SHRINES_OnShrineStateRemoved_6FC8A930_113c (ecx=pUnit, edx=nState, stack=[pStatList], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t uType = (k == 1) ? 1u : 0u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, 1u, 1u, 1u, 5000u, 5000u, 411u);
    fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x81 + k, 1);
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = pU; c.edx = 0x81u + (uint32_t)k; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = pU; ts[1] = (int64_t)(0x81 + k); ts[2] = 0;
    run_and_emit(0x6FC8A930u, "SHRINES_OnShrineStateRemoved_6FC8A930_113c", k,
                 k == 0 ? "assert_null_unit" : k == 1 ? "monster_unit" : "player_unit", &c, ts, 3, 0u, k == 0);
  }

  /* [42] 0x6FC82960 ACT1Q4_SetCompletedBeforeAlertCallback_6FC82960_113c (ecx=pGame, edx=pPlayer, stack=[pArg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 421u);
    U32(STAGE_UDATA0 + 0x9Cu) = (k == 2) ? 0u : STAGE_CLIENT;
    uint32_t pRec = STAGE_QBITS0;
    U32(pRec + 0x00u) = STAGE_QBITS0 + 0x10u;
    U32(pRec + 0x04u) = 0x60u;
    U32(STAGE_UDATA0 + 0x10u) = pRec;
    if (k == 0) {
      /* quest 4 bit 1 set -> skip */
      U8(STAGE_QBITS0 + 0x10u + (0x04u * 2u) + (1u >> 3)) = (uint8_t)(1u << (1u & 7u));
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC82960u, "ACT1Q4_SetCompletedBeforeAlertCallback_6FC82960_113c", k,
                 k == 0 ? "already_done_skip" : k == 1 ? "set_0e_send_5d" : "set_0e_null_client", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [43] 0x6FC82BB0 ACT1Q2_SetCompletedBeforeAlertCallback_6FC82BB0_113c (ecx=pGame, edx=pPlayer, stack=[pArg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 431u);
    U32(STAGE_UDATA0 + 0x9Cu) = (k == 2) ? 0u : STAGE_CLIENT;
    uint32_t pRec = STAGE_QBITS0;
    U32(pRec + 0x00u) = STAGE_QBITS0 + 0x10u;
    U32(pRec + 0x04u) = 0x60u;
    U32(STAGE_UDATA0 + 0x10u) = pRec;
    if (k == 0) {
      /* quest 2 bit 1 set -> skip */
      U8(STAGE_QBITS0 + 0x10u + (0x02u * 2u) + (1u >> 3)) = (uint8_t)(1u << (1u & 7u));
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC82BB0u, "ACT1Q2_SetCompletedBeforeAlertCallback_6FC82BB0_113c", k,
                 k == 0 ? "already_done_skip" : k == 1 ? "set_0e_send_5d" : "set_0e_null_client", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [44] 0x6FC532F0 OBJECTS_InitFn51_ScheduleEvent9IfOperatingOrOpened_6FC532F0_113c (ecx=pObjInit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 44u, (uint32_t)k, 5000u, 5000u, 441u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC532F0u, "OBJECTS_InitFn51_ScheduleEvent9IfOperatingOrOpened_6FC532F0_113c", k,
                 k == 0 ? "mode0_noop" : k == 1 ? "mode1_sched" : "mode2_sched", &c, ts, 1, 0u, 0);
  }

  /* [45] 0x6FC78F40 ACT5Q5_SyncPlayerQuest27State0EAlert23_6FC78F40_113c (ecx=pGame, edx=pPlayer, stack=[pArg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 451u);
    U32(STAGE_UDATA0 + 0x9Cu) = (k == 2) ? 0u : STAGE_CLIENT;
    uint32_t pRec = STAGE_QBITS0;
    U32(pRec + 0x00u) = STAGE_QBITS0 + 0x10u;
    U32(pRec + 0x04u) = 0x60u;
    U32(STAGE_UDATA0 + 0x10u) = pRec;
    if (k == 0) {
      /* quest 0x27 bit 0x0D set -> skip */
      U8(STAGE_QBITS0 + 0x10u + (0x27u * 2u) + (13u >> 3)) = (uint8_t)(1u << (13u & 7u));
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC78F40u, "ACT5Q5_SyncPlayerQuest27State0EAlert23_6FC78F40_113c", k,
                 k == 0 ? "already_done_skip" : k == 1 ? "set_0e_send_5d" : "set_0e_null_client", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [46] 0x6FC89860 SHRINES_ApplyManaRechargeEffect_6FC89860_113c (ecx=pObjOperate, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 461u);
    int32_t maxM = 80 + k * 40;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, (k == 0 ? maxM : (k == 1 ? 40 : 10)) << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, maxM << 8, 0);
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC89860u, "SHRINES_ApplyManaRechargeEffect_6FC89860_113c", k,
                 k == 0 ? "already_full_80" : k == 1 ? "recharge_to_120" : "recharge_to_160", &c, ts, 1, 0u, 0);
  }

  /* [47] 0x6FC898A0 SHRINES_ApplyHealthRechargeEffect_6FC898A0_113c (ecx=pObjOperate, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 1u, 1u, 5000u, 5000u, 471u);
    int32_t maxL = 100 + k * 50;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, (k == 0 ? maxL : (k == 1 ? 50 : 5)) << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, maxL << 8, 0);
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC898A0u, "SHRINES_ApplyHealthRechargeEffect_6FC898A0_113c", k,
                 k == 0 ? "already_full_100" : k == 1 ? "recharge_to_150" : "recharge_to_200", &c, ts, 1, 0u, 0);
  }

  /* [48] 0x6FC9A090 SUNITMSG_QueuePacketA4ToUnit_6FC9A090_113c (esi=pUnit, stack=[wMsgId], tail-call UNITROOM_RefreshUnit -> ret 4!) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 48u, 1u, 5000u, 5000u, 481u);
    if (k == 2) {
      U32(STAGE_UNIT0 + 0xECu) = STAGE_SCRATCH;
      U32(STAGE_UNIT0 + 0xF0u) = STAGE_SCRATCH;
    }
    uint32_t msgId = 0x100u + (uint32_t)k * 0x25u;
    c.esi = STAGE_UNIT0; c.nargs = 1; c.args[0] = msgId; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = msgId;
    run_and_emit(0x6FC9A090u, "SUNITMSG_QueuePacketA4ToUnit_6FC9A090_113c", k,
                 k == 0 ? "first_msg_100" : k == 1 ? "first_msg_125" : "append_existing", &c, ts, 2, 0u, 0);
  }

  /* [49] 0x6FC79060 ACT5Q4_SyncPlayerQuest26State0EAlert22_6FC79060_113c (ecx=pGame, edx=pPlayer, stack=[pArg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 491u);
    U32(STAGE_UDATA0 + 0x9Cu) = (k == 2) ? 0u : STAGE_CLIENT;
    uint32_t pRec = STAGE_QBITS0;
    U32(pRec + 0x00u) = STAGE_QBITS0 + 0x10u;
    U32(pRec + 0x04u) = 0x60u;
    U32(STAGE_UDATA0 + 0x10u) = pRec;
    if (k == 0) {
      /* quest 0x26 bit 1 set -> skip */
      U8(STAGE_QBITS0 + 0x10u + (0x26u * 2u) + (1u >> 3)) = (uint8_t)(1u << (1u & 7u));
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC79060u, "ACT5Q4_SyncPlayerQuest26State0EAlert22_6FC79060_113c", k,
                 k == 0 ? "already_done_skip" : k == 1 ? "set_0e_send_5d" : "set_0e_null_client", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [50] 0x6FC79120 ACT5Q3_SyncPlayerQuest25State0EAlert21_6FC79120_113c (ecx=pGame, edx=pPlayer, stack=[pArg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 501u);
    U32(STAGE_UDATA0 + 0x9Cu) = (k == 2) ? 0u : STAGE_CLIENT;
    uint32_t pRec = STAGE_QBITS0;
    U32(pRec + 0x00u) = STAGE_QBITS0 + 0x10u;
    U32(pRec + 0x04u) = 0x60u;
    U32(STAGE_UDATA0 + 0x10u) = pRec;
    if (k == 0) {
      /* quest 0x25 bit 0x0D set -> skip */
      U8(STAGE_QBITS0 + 0x10u + (0x25u * 2u) + (13u >> 3)) = (uint8_t)(1u << (13u & 7u));
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC79120u, "ACT5Q3_SyncPlayerQuest25State0EAlert21_6FC79120_113c", k,
                 k == 0 ? "already_done_skip" : k == 1 ? "set_0e_send_5d" : "set_0e_null_client", &c, ts, 3, 0xFFFFFFFFu, 0);
  }
}

static void emit_batch_51_to_100(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [51] 0x6FC53680 OBJECTS_InitFn58_ScheduleRandomEvent8_6FC53680_113c (ecx=pObjInit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 51u, 0u, 5000u, 5000u, 511u);
    U32(STAGE_GAME + 0x10F0u) = STAGE_SCRATCH + 0x100u;
    U32(STAGE_SCRATCH + 0x100u) = 0x12345u + (uint32_t)k * 999u;
    U32(STAGE_SCRATCH + 0x104u) = 0x17u + (uint32_t)k;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC53680u, "OBJECTS_InitFn58_ScheduleRandomEvent8_6FC53680_113c", k,
                 k == 0 ? "seed_a" : k == 1 ? "seed_b" : "seed_c", &c, ts, 1, 0u, 0);
  }

  /* [52] 0x6FC9A570 UNIT_SendStatB2Packet11ToClient_6FC9A570_113c (esi=pUnit, stack=[pClient], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 52u, 1u, 5000u, 5000u, 521u);
    if (k >= 1) {
      void *sl = fn_AllocStatList(NULL, 0x80u, 0u, 1, 52);
      fn_SetStatIfValid(sl, 0xB2, (k == 1) ? -1 : 5, 0u);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, sl, 1);
    }
    c.esi = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_CLIENT; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_CLIENT;
    run_and_emit(0x6FC9A570u, "UNIT_SendStatB2Packet11ToClient_6FC9A570_113c", k,
                 k == 0 ? "no_flag80_list" : k == 1 ? "neg_stat" : "send_pkt11", &c, ts, 2, 0u, 0);
  }

  /* [53] 0x6FC9A440 UNITMSG_QueuePacket9ACoords_6FC9A440_113c (esi=pUnit, stack=[wX, bByte0A, wY, wWord0E, bByte10], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 53u, 1u, 5000u, 5000u, 531u);
    if (k == 2) {
      U32(STAGE_UNIT0 + 0xECu) = STAGE_SCRATCH;
      U32(STAGE_UNIT0 + 0xF0u) = STAGE_SCRATCH;
    }
    c.esi = STAGE_UNIT0;
    c.nargs = 5;
    c.args[0] = 5100u + (uint32_t)k; c.args[1] = 2u + (uint32_t)k;
    c.args[2] = 5200u + (uint32_t)k; c.args[3] = 0x33u + (uint32_t)k; c.args[4] = 0x05u + (uint32_t)k;
    c.calleePop = 0x14u;
    ts[0] = STAGE_UNIT0;
    ts[1] = c.args[0]; ts[2] = c.args[1]; ts[3] = c.args[2]; ts[4] = c.args[3]; ts[5] = c.args[4];
    run_and_emit(0x6FC9A440u, "UNITMSG_QueuePacket9ACoords_6FC9A440_113c", k,
                 k == 0 ? "queue_a" : k == 1 ? "queue_b" : "append_tail", &c, ts, 6, 0u, 0);
  }

  /* [54] 0x6FC79390 ACT5Q2_SyncPlayerQuest24State0EAlert20_6FC79390_113c (ecx=pGame, edx=pPlayer, stack=[pArg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 541u);
    U32(STAGE_UDATA0 + 0x9Cu) = (k == 2) ? 0u : STAGE_CLIENT;
    uint32_t pRec = STAGE_QBITS0;
    U32(pRec + 0x00u) = STAGE_QBITS0 + 0x10u;
    U32(pRec + 0x04u) = 0x60u;
    U32(STAGE_UDATA0 + 0x10u) = pRec;
    if (k == 0) {
      /* quest 0x24 bit 1 set -> skip */
      U8(STAGE_QBITS0 + 0x10u + (0x24u * 2u) + (1u >> 3)) = (uint8_t)(1u << (1u & 7u));
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC79390u, "ACT5Q2_SyncPlayerQuest24State0EAlert20_6FC79390_113c", k,
                 k == 0 ? "already_done_skip" : k == 1 ? "set_0e_send_5d" : "set_0e_null_client", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [55] 0x6FC898E0 OBJECTS_HasItemOfTypeInInventory_6FC898E0_113c (eax=pUnit, edi=nItemType, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 551u);
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, (k == 2 ? g_item_claw : g_item_bow), 10u, 0u, 0u, 0u, 552u);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 0u, 0u);
    }
    c.eax = STAGE_UNIT0; c.edi = 0x2Eu;
    ts[0] = STAGE_UNIT0; ts[1] = 0x2E;
    run_and_emit(0x6FC898E0u, "OBJECTS_HasItemOfTypeInInventory_6FC898E0_113c", k,
                 k == 0 ? "assert_no_inv" : k == 1 ? "bow_not_claw" : "has_claw", &c, ts, 2, 0xFFFFFFFFu, k == 0);
  }

  /* [56] 0x6FC89800 SHRINES_ApplyHealthExchangeEffect_6FC89800_113c (ecx=pObjOperate, edx=pShrinesTxt, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 561u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, (100 + k * 50) << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 20 << 8, 0);
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT0;
    uint32_t pShr = STAGE_SCRATCH + 0x40u;
    U32(pShr + 0x04u) = (k == 0) ? 25u : (k == 1 ? 50u : 75u);
    U32(pShr + 0x08u) = 50u;
    c.ecx = STAGE_SCRATCH; c.edx = pShr;
    ts[0] = STAGE_SCRATCH; ts[1] = pShr;
    run_and_emit(0x6FC89800u, "SHRINES_ApplyHealthExchangeEffect_6FC89800_113c", k,
                 k == 0 ? "exch_25pct" : k == 1 ? "exch_50pct" : "exch_75pct", &c, ts, 2, 0u, 0);
  }

  /* [57] 0x6FC8A1A0 OBJ_ClearObject151OwnerIfMatchingPlayer_6FC8A1A0_113c (eax=pGame, ecx=pObject, edi=pPlayer, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, (k == 0 ? 1u : 0x151u), 57u, 0u, 5000u, 5000u, 571u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 10u, 1u, 5000u, 5000u, 572u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    U32(STAGE_UNIT0 + 0x7Cu) = STAGE_SCRATCH;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_SCRATCH + 0x20u;
    U32(STAGE_SCRATCH + 0x20u) = 10u; /* matches STAGE_UNIT1 */
    uint32_t pG = (k == 1) ? 0u : STAGE_GAME;
    uint32_t pP = (k == 2) ? 0u : STAGE_UNIT1;
    c.eax = pG; c.ecx = STAGE_UNIT0; c.edi = pP;
    ts[0] = pG; ts[1] = STAGE_UNIT0; ts[2] = pP;
    run_and_emit(0x6FC8A1A0u, "OBJ_ClearObject151OwnerIfMatchingPlayer_6FC8A1A0_113c", k,
                 k == 0 ? "wrong_class" : k == 1 ? "assert_null_game" : k == 2 ? "null_plr_clears" : "matching_plr_clears",
                 &c, ts, 3, 0u, k == 1);
  }

  /* [58] 0x6FC9A3A0 UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c (esi=pUnit, bx=wStatId, stack=[dwStatValue], tail-call ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 58u, 1u, 5000u, 5000u, 581u);
    uint32_t stId = (k == 0) ? 0xFFu : (k == 1 ? 6u : 12u);
    uint32_t val  = 1000u + (uint32_t)k * 500u;
    c.esi = STAGE_UNIT0; c.ebx = stId; c.nargs = 1; c.args[0] = val; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = stId; ts[2] = val;
    run_and_emit(0x6FC9A3A0u, "UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c", k,
                 k == 0 ? "assert_stat_ff" : k == 1 ? "stat_hp" : "stat_lvl", &c, ts, 3, 0u, k == 0);
  }

  /* [59] 0x6FC9A0F0 UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c (esi=pUnit, stack=[wSkillId], tail-call ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 59u, 1u, 5000u, 5000u, 591u);
    fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x12, 1);
    if (k == 2) {
      U32(STAGE_UNIT0 + 0xECu) = STAGE_SCRATCH;
      U32(STAGE_UNIT0 + 0xF0u) = STAGE_SCRATCH;
    }
    uint32_t sk = 36u + (uint32_t)k * 10u;
    c.esi = STAGE_UNIT0; c.nargs = 1; c.args[0] = sk; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = sk;
    run_and_emit(0x6FC9A0F0u, "UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c", k,
                 k == 0 ? "sk36" : k == 1 ? "sk46" : "append_sk56", &c, ts, 2, 0u, 0);
  }

  /* [60] 0x6FC9A190 UNITMSG_QueuePacketA3AuraTargetFx_6FC9A190_113c
     (esi=pUnit, edi=pTargetUnit, stack=[wAuraState, wSkillId, nX, nY, bSkillLevel], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 3u, 60u, 1u, 5000u, 5000u, 601u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0u, 61u, 1u, 5005u, 5005u, 602u);
    uint32_t pTgt = (k == 0) ? 0u : STAGE_UNIT1;
    c.esi = STAGE_UNIT0; c.edi = pTgt;
    c.nargs = 5;
    c.args[0] = 0x20u + (uint32_t)k; c.args[1] = 98u + (uint32_t)k;
    c.args[2] = 5010u + (uint32_t)k; c.args[3] = 5020u + (uint32_t)k; c.args[4] = 5u + (uint32_t)k;
    c.calleePop = 0x14u;
    ts[0] = STAGE_UNIT0; ts[1] = pTgt;
    ts[2] = c.args[0]; ts[3] = c.args[1]; ts[4] = c.args[2]; ts[5] = c.args[3]; ts[6] = c.args[4];
    run_and_emit(0x6FC9A190u, "UNITMSG_QueuePacketA3AuraTargetFx_6FC9A190_113c", k,
                 k == 0 ? "null_target" : k == 1 ? "with_target_a" : "with_target_b", &c, ts, 7, 0u, 0);
  }

  /* [61] 0x6FC89DE0 OBJ_HealLifeCurePoisonFreezeAndPurgeStates_6FC89DE0_113c (stack=[pUnit, pbHealedOut], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 611u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, (k == 0 ? 100 : 40) << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
    if (k == 2) {
      void *slP = fn_AllocStatList(NULL, 0u, 0u, 0, 1);
      fn_SetStatListState(slP, 2); /* STATE_POISON */
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, slP, 1);
      void *slF = fn_AllocStatList(NULL, 0u, 0u, 0, 1);
      fn_SetStatListState(slF, 1); /* STATE_FREEZE */
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, slF, 1);
    }
    c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_SCRATCH;
    run_and_emit(0x6FC89DE0u, "OBJ_HealLifeCurePoisonFreezeAndPurgeStates_6FC89DE0_113c", k,
                 k == 0 ? "already_full" : k == 1 ? "heal_injured" : "heal_and_cure_poison_freeze", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [62] 0x6FC8A440 OBJ_IsEligibleMonsterForShrineUpgrade_6FC8A440_113c (ecx=pCandidate, edx=pSource, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 621u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0u, 2u, 1u, 5005u, 5005u, 622u); /* Zombie */
    if (k == 1) {
      U8(STAGE_UDATA1 + 0x16u) = 0x08u; /* boss flag -> ineligible */
    }
    uint32_t pCand = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = pCand; c.edx = STAGE_UNIT0;
    ts[0] = pCand; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC8A440u, "OBJ_IsEligibleMonsterForShrineUpgrade_6FC8A440_113c", k,
                 k == 0 ? "null_cand" : k == 1 ? "boss_ineligible" : "normal_zombie_ok", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [63] 0x6FCB0F00 STATES_ClearGfxStateFlagCallback_6FCB0F00_113c (ecx=pUnit, edx=nState, stack=[pStatList], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 631u);
    fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 10 + k, 1);
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = pU; c.edx = (uint32_t)(10 + k); c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = pU; ts[1] = 10 + k; ts[2] = 0;
    run_and_emit(0x6FCB0F00u, "STATES_ClearGfxStateFlagCallback_6FCB0F00_113c", k,
                 k == 0 ? "assert_null_unit" : k == 1 ? "clear_11" : "clear_12", &c, ts, 3, 0u, k == 0);
  }

  /* [64] 0x6FCB0F10 STATES_ClearGfxStateFlagAndSetUpdate40_6FCB0F10_113c (ecx=pUnit, edx=nState, stack=[pStatList], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 2u, 1u, 5000u, 5000u, 641u);
    fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 15 + k, 1);
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = pU; c.edx = (uint32_t)(15 + k); c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = pU; ts[1] = 15 + k; ts[2] = 0;
    run_and_emit(0x6FCB0F10u, "STATES_ClearGfxStateFlagAndSetUpdate40_6FCB0F10_113c", k,
                 k == 0 ? "assert_null_unit" : k == 1 ? "clear16_flag40" : "clear17_flag40", &c, ts, 3, 0u, k == 0);
  }

  /* [65] 0x6FC94E40 MONSTER_Event10_ClearMonsterFields34And38_113c (ecx=pGame, edx=pUnit, stack=[a1, a2], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 1 ? 0u : 1u), 0u, 65u, 1u, 5000u, 5000u, 651u);
    U32(STAGE_UDATA0 + 0x34u) = 0x1111u;
    U32(STAGE_UDATA0 + 0x38u) = 0x2222u;
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = pU; c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = pU; ts[2] = 0; ts[3] = 0;
    run_and_emit(0x6FC94E40u, "MONSTER_Event10_ClearMonsterFields34And38_113c", k,
                 k == 0 ? "null_unit" : k == 1 ? "non_monster" : "clear_fields", &c, ts, 4, 0u, 0);
  }

  /* [66] 0x6FC795C0 ACT5Q1_SyncPlayerQuest23State0EAlert1F_6FC795C0_113c (ecx=pGame, edx=pPlayer, stack=[pArg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 661u);
    U32(STAGE_UDATA0 + 0x9Cu) = (k == 2) ? 0u : STAGE_CLIENT;
    uint32_t pRec = STAGE_QBITS0;
    U32(pRec + 0x00u) = STAGE_QBITS0 + 0x10u;
    U32(pRec + 0x04u) = 0x60u;
    U32(STAGE_UDATA0 + 0x10u) = pRec;
    if (k == 0) {
      /* quest 0x23 bit 1 set -> skip */
      U8(STAGE_QBITS0 + 0x10u + (0x23u * 2u) + (1u >> 3)) = (uint8_t)(1u << (1u & 7u));
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC795C0u, "ACT5Q1_SyncPlayerQuest23State0EAlert1F_6FC795C0_113c", k,
                 k == 0 ? "already_done_skip" : k == 1 ? "set_0e_send_5d" : "set_0e_null_client", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [67] 0x6FC82A30 ACT1Q5_SendTowerTomeQuestAlert5D_6FC82A30_113c (ecx=pPlayer, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 1 ? 1u : 0u), 0u, 1u, 1u, 5000u, 5000u, 671u);
    if (k == 2) U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    uint32_t pPlr = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = pPlr;
    ts[0] = pPlr;
    run_and_emit(0x6FC82A30u, "ACT1Q5_SendTowerTomeQuestAlert5D_6FC82A30_113c", k,
                 k == 0 ? "null_player" : k == 1 ? "non_player" : "valid_player_send_5d", &c, ts, 1, 0u, 0);
  }

  /* [68] 0x6FC41AD0 MONUMOD_ScheduleGetHitEvent2ForUnique_6FC41AD0_113c (ecx=pGame, edx=pMonster, stack=[nUModId, bUnique], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 68u, (k == 1 ? 1u : 3u), 5000u, 5000u, 681u);
    uint32_t bUniq = (k == 0) ? 0u : 1u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 5u; c.args[1] = bUniq; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 5; ts[3] = bUniq;
    run_and_emit(0x6FC41AD0u, "MONUMOD_ScheduleGetHitEvent2ForUnique_6FC41AD0_113c", k,
                 k == 0 ? "not_unique" : k == 1 ? "mode1_skip" : "mode3_unique_sched", &c, ts, 4, 0u, 0);
  }

  /* [69] 0x6FC41B00 MONUMOD_ScheduleGetHitOrDeathEvent2_6FC41B00_113c (ecx=pGame, edx=pMonster, stack=[nUModId, bUnique], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mode = (k == 0) ? 1u : (k == 1 ? 3u : 0u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 69u, mode, 5000u, 5000u, 691u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 6u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 6; ts[3] = 1;
    run_and_emit(0x6FC41B00u, "MONUMOD_ScheduleGetHitOrDeathEvent2_6FC41B00_113c", k,
                 k == 0 ? "mode1_skip" : k == 1 ? "mode3_sched" : "mode0_sched", &c, ts, 4, 0u, 0);
  }

  /* [70] 0x6FC41BB0 MONUMOD_ScheduleDeathEvent4ForUnique_6FC41BB0_113c (ecx=pGame, edx=pMonster, stack=[nUModId, bUnique], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 70u, (k == 1 ? 1u : 0u), 5000u, 5000u, 701u);
    uint32_t bUniq = (k == 0) ? 0u : 1u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 9u; c.args[1] = bUniq; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 9; ts[3] = bUniq;
    run_and_emit(0x6FC41BB0u, "MONUMOD_ScheduleDeathEvent4ForUnique_6FC41BB0_113c", k,
                 k == 0 ? "not_unique" : k == 1 ? "mode1_skip" : "mode0_unique_sched", &c, ts, 4, 0u, 0);
  }

  /* [71] 0x6FC469F0 MONUMOD_InitUMod41ScheduleEvent7_6FC469F0_113c (ecx=pUnit, stack=[bUnique], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 1 ? 0u : 1u), 0u, 71u, 1u, 5000u, 5000u, 711u);
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = pU; c.nargs = 1; c.args[0] = 1u; c.calleePop = 4u;
    ts[0] = pU; ts[1] = 1;
    run_and_emit(0x6FC469F0u, "MONUMOD_InitUMod41ScheduleEvent7_6FC469F0_113c", k,
                 k == 0 ? "null_unit" : k == 1 ? "non_monster" : "monster_sched_75", &c, ts, 2, 0u, 0);
  }

  /* [72] 0x6FC805F0 ACT1Q4_StoreTristramPortalUnitIfInTristram_6FC805F0_113c (ecx=pGame, edx=pUnit, stack=[uUnused], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0 ? 1u : 0x26u)); /* 0x26 = Tristram */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 60u, 72u, 1u, 5000u, 5000u, 721u);
    if (k == 2) {
      U32(STAGE_GAME + 0x10F4u) = STAGE_QUESTCTRL;
      U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
      U32(STAGE_QUEST0 + 0x00u) = 4u;
      U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC805F0u, "ACT1Q4_StoreTristramPortalUnitIfInTristram_6FC805F0_113c", k,
                 k == 0 ? "wrong_lvl1_ret0" : k == 1 ? "tristram_no_q4_ret0" : "tristram_q4_stored_ret1", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [73] 0x6FC9B510 MONSTER_GetOrRollRegionSubVariant113c (eax=pUnit, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t lvl = (k == 0) ? 2u : (k == 1 ? 0x28u : 0x2Au);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvl);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 73u, 1u, 5000u, 5000u, 731u + (uint32_t)k * 777u);
    uint32_t pMonReg = (uint32_t)(uintptr_t)bump_alloc(0x300u);
    U32(STAGE_GAME + 0xF0u + lvl * 4u) = pMonReg;
    S32(pMonReg + 0x2D4u) = (k == 2) ? 2 : -1; /* unset (<0) vs pre-set 2 */
    c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FC9B510u, "MONSTER_GetOrRollRegionSubVariant113c", k,
                 k == 0 ? "lvl2_zero" : k == 1 ? "lvl40_roll" : "already_set_2", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [74] 0x6FC42880 MONUMOD_ApplyExtraFastVelocity_6FC42880_113c (ecx=pMonster, edx=nUModId, stack=[bUnique], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t cid = (k == 1) ? 0u : 19u; /* Zombie vs Fallen */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, cid, 74u, 1u, 5000u, 5000u, 741u);
    uint32_t pM = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = pM; c.edx = 5u; c.nargs = 1; c.args[0] = 1u; c.calleePop = 4u;
    ts[0] = pM; ts[1] = 5; ts[2] = 1;
    run_and_emit(0x6FC42880u, "MONUMOD_ApplyExtraFastVelocity_6FC42880_113c", k,
                 k == 0 ? "null_mon" : k == 1 ? "zombie" : "fallen", &c, ts, 3, 0u, 0);
  }

  /* [75] 0x6FC43320 MONUMOD_ScheduleInitialAiAndEvent7_6FC43320_113c (ecx=pGame, edx=pUnit, stack=[nUMod, bUnique], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 75u, (k == 1 ? 0u : 1u), 5000u, 5000u, 751u);
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = pU; c.nargs = 2; c.args[0] = 1u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = pU; ts[2] = 1; ts[3] = 1;
    run_and_emit(0x6FC43320u, "MONUMOD_ScheduleInitialAiAndEvent7_6FC43320_113c", k,
                 k == 0 ? "null_unit" : k == 1 ? "dead_skip" : "alive_sched_ai_ev7", &c, ts, 4, 0u, 0);
  }

  /* [76] 0x6FC43390 MONUMOD_GetHitForceDeathAndScheduleEvent7_6FC43390_113c (ecx=pGame, edx=pUnit, stack=[nUMod, bUnique], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 76u, (k == 0 ? 1u : (k == 1 ? 0u : 0x0Cu)), 5000u, 5000u, 761u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 1u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 1; ts[3] = 1;
    run_and_emit(0x6FC43390u, "MONUMOD_GetHitForceDeathAndScheduleEvent7_6FC43390_113c", k,
                 k == 0 ? "mode1_skip" : k == 1 ? "mode0_sched" : "mode12_sched", &c, ts, 4, 0u, 0);
  }

  /* [77] 0x6FC950F0 MONSTER_NullModeEventFallback113c (esi=pUnit, edi=mode, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t uMode = (k == 0) ? 0u : 1u; /* dead vs alive */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 77u, uMode, 5000u, 5000u, 771u);
    /* Stage pMonsterData->pMonstatsTxt with classId=0 (skeleton1) aidel=15 at +0x4F..+0x51 */
    U32(STAGE_UDATA0 + 0x00u) = STAGE_SCRATCH + 0x100u;
    U8(STAGE_SCRATCH + 0x14Fu) = 15u;
    U8(STAGE_SCRATCH + 0x150u) = 15u;
    U8(STAGE_SCRATCH + 0x151u) = 15u;
    uint32_t argMode = (k == 0) ? 3u : (k == 1 ? 0u : 2u);
    c.esi = STAGE_UNIT0; c.edi = argMode; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = argMode;
    run_and_emit(0x6FC950F0u, "MONSTER_NullModeEventFallback113c", k,
                 k == 0 ? "dead_ret1" : k == 1 ? "mode0_neutral" : "alive_neutral", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [78] 0x6FC98150 MONMODE_SetUnitAnimModeAndRescheduleEvents_6FC98150_113c (ecx=pGame, edx=pUnit, stack=[nMode, a8, aC], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 78u, 1u, 5000u, 5000u, 781u);
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t nm = (k == 1) ? 2u : 4u;
    c.ecx = STAGE_GAME; c.edx = pU; c.nargs = 3; c.args[0] = nm; c.args[1] = 0u; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_GAME; ts[1] = pU; ts[2] = nm; ts[3] = 0; ts[4] = 0;
    run_and_emit(0x6FC98150u, "MONMODE_SetUnitAnimModeAndRescheduleEvents_6FC98150_113c", k,
                 k == 0 ? "assert_null_unit" : k == 1 ? "mode_2" : "mode_4", &c, ts, 5, 0u, k == 0);
  }

  /* [79] 0x6FC437C0 MONUMOD_ApplyChampionBerserkerStats_6FC437C0_113c (ecx=pUnit, edx=nUModId, stack=[bBoss], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 79u, 1u, 5000u, 5000u, 791u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
    U8(STAGE_GAME + 0x6Du) = (k == 2) ? 2u : 0u;
    uint32_t bBoss = (k == 0) ? 0u : 1u;
    c.ecx = STAGE_UNIT0; c.edx = 0x26u; c.nargs = 1; c.args[0] = bBoss; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = 0x26; ts[2] = bBoss;
    run_and_emit(0x6FC437C0u, "MONUMOD_ApplyChampionBerserkerStats_6FC437C0_113c", k,
                 k == 0 ? "not_boss" : k == 1 ? "norm_berserk" : "hell_berserk", &c, ts, 3, 0u, 0);
  }

  /* [80] 0x6FC42D00 MONUMOD_ApplyGhostlyStats_6FC42D00_113c (ecx=pMonster, edx=nUModId, stack=[bBoss], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t cid = (k == 2) ? 0x76u : 0u; /* Gloam (halves dmg bonus) vs Zombie */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, cid, 80u, 1u, 5000u, 5000u, 801u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 200 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 200 << 8, 0);
    uint32_t bBoss = (k == 0) ? 0u : 1u;
    c.ecx = STAGE_UNIT0; c.edx = 0x24u; c.nargs = 1; c.args[0] = bBoss; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = 0x24; ts[2] = bBoss;
    run_and_emit(0x6FC42D00u, "MONUMOD_ApplyGhostlyStats_6FC42D00_113c", k,
                 k == 0 ? "not_boss" : k == 1 ? "zombie_ghostly" : "gloam_ghostly", &c, ts, 3, 0u, 0);
  }

  /* [81] 0x6FC217E0 ITEMS_IsUniqueItemDisabled_6FC217E0_113c (esi=pItem, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, g_item_ring, 81u, 3u, 5000u, 5000u, 811u);
    U32(STAGE_UDATA0 + 0x00u) = (k == 0) ? 4u : 7u; /* quality 4=magic vs 7=unique */
    S32(STAGE_UDATA0 + 0x34u) = (k == 2) ? (int32_t)g_unique_dis : (int32_t)g_unique_en; /* dwFileIndex */
    c.esi = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    run_and_emit(0x6FC217E0u, "ITEMS_IsUniqueItemDisabled_6FC217E0_113c", k,
                 k == 0 ? "not_unique" : k == 1 ? "enabled_unique" : "disabled_unique", &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [82] 0x6FC2E210 ITEMS_ClearAffixesAndItemCell_6FC2E210_113c (edi=ppItem, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, g_item_ring, 82u, 3u, 5000u, 5000u, 821u);
    if (k >= 1) {
      U16(STAGE_UDATA0 + 0x38u) = 10u; /* wRarePrefix */
      U16(STAGE_UDATA0 + 0x3Au) = 20u; /* wRareSuffix */
      U16(STAGE_UDATA0 + 0x3Cu) = 30u; /* wMagicPrefix[0] */
      U16(STAGE_UDATA0 + 0x42u) = 40u; /* wMagicSuffix[0] */
      S32(STAGE_UDATA0 + 0x34u) = (k == 2) ? 77 : 12;
    }
    U32(STAGE_SCRATCH) = (k == 0) ? 0u : STAGE_UNIT0;
    c.edi = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC2E210u, "ITEMS_ClearAffixesAndItemCell_6FC2E210_113c", k,
                 k == 0 ? "assert_null_item_ptr" : k == 1 ? "clear_affixes_a" : "clear_affixes_b", &c, ts, 1, 0u, k == 0);
  }

  /* [83] 0x6FC332A0 ITEMS_FindSuperiorQualityRecordIndex113c (eax=pItem, ebx=bCheckField18, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t itemId = (k == 0) ? g_item_ring : (k == 1 ? g_item_sup_f1c : g_item_sup_f18);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, itemId, 83u, 3u, 5000u, 5000u, 831u);
    uint32_t check18 = (k == 2) ? 1u : 0u;
    c.eax = STAGE_UNIT0; c.ebx = check18;
    ts[0] = STAGE_UNIT0; ts[1] = check18;
    run_and_emit(0x6FC332A0u, "ITEMS_FindSuperiorQualityRecordIndex113c", k,
                 k == 0 ? "not_found_ring" : k == 1 ? "match_f1c" : "match_f18", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [84] 0x6FC90080 PLRTRADE_HasAnyCubePageItemOnUnit113c (eax=pUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 841u);
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, 10u, 0u, 0u, 0u, 842u);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, (k == 2 ? 3u : 0u), 0u, 0u);
    }
    c.eax = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    run_and_emit(0x6FC90080u, "PLRTRADE_HasAnyCubePageItemOnUnit113c", k,
                 k == 0 ? "empty_inv" : k == 1 ? "page0_item" : "cube_page3_item", &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [85] 0x6FC901F0 PLRTRADE_CanModifyBeltDuringTrade113c (eax=pUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 851u);
    U8(STAGE_UNIT0 + 0x6Cu) = (k == 0) ? 0u : 1u; /* bInTrade flag */
    U32(STAGE_UNIT0 + 0x68u) = 0u;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, 10u, 0u, 0u, 0u, 852u);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 0u, (k == 2 ? 2u : 1u)); /* nNodePosOther == 2 blocks */
    }
    c.eax = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    run_and_emit(0x6FC901F0u, "PLRTRADE_CanModifyBeltDuringTrade113c", k,
                 k == 0 ? "not_trading" : k == 1 ? "pos1_allow" : "pos2_block", &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [86] 0x6FC90010 PLRTRADE_SyncClonedItemEarOrPersonalizedData113c (esi=pDstItem, edi=pSrcItem, stack=[bSetCmdFlag8000], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t itemId = (k == 0) ? g_item_ear : g_item_ring;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, itemId, 86u, 3u, 5000u, 5000u, 861u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, itemId, 87u, 3u, 5000u, 5000u, 862u);
    memcpy((void *)(uintptr_t)(STAGE_UDATA1 + 0x48u), "Slayer", 7); /* szName */
    U8(STAGE_UDATA1 + 0x47u) = 85u; /* nEarLevel */
    if (k == 1) {
      U32(STAGE_UDATA0 + 0x18u) = 0x01000000u; /* personalized flag */
    }
    c.esi = STAGE_UNIT0; c.edi = STAGE_UNIT1; c.nargs = 1; c.args[0] = 1u; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = 1;
    run_and_emit(0x6FC90010u, "PLRTRADE_SyncClonedItemEarOrPersonalizedData113c", k,
                 k == 0 ? "sync_ear" : k == 1 ? "sync_personalized" : "plain_item_noop", &c, ts, 3, 0u, 0);
  }

  /* [87] 0x6FC90C90 PLRTRADE_BroadcastClearMercUnitCallback113c (ecx=pGame, edx=pTargetPlayer, stack=[pSourcePlayer], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 10u, 1u, 5000u, 5000u, 871u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 20u, 1u, 5005u, 5005u, 872u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    uint32_t pSrc = (k == 0) ? STAGE_UNIT0 : (k == 1 ? 0u : STAGE_UNIT1);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = pSrc; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pSrc;
    run_and_emit(0x6FC90C90u, "PLRTRADE_BroadcastClearMercUnitCallback113c", k,
                 k == 0 ? "same_player_skip" : k == 1 ? "null_src" : "other_src", &c, ts, 3, 0u, 0);
  }

  /* [88] 0x6FC90B70 PLRTRADE_SendTradeAcceptButtonAndSetState3_113c (eax=pPlayer1, esi=pPlayer2, stack=[pTrade1, pTrade2], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 10u, 1u, 5000u, 5000u, 881u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 20u, 1u, 5005u, 5005u, 882u);
    uint32_t pCli1 = stage_extra_client();
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    U32(STAGE_UDATA1 + 0x9Cu) = pCli1;
    uint32_t pTr1 = STAGE_SCRATCH;
    uint32_t pTr2 = STAGE_SCRATCH + 0x80u;
    uint32_t p1 = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t p2 = (k == 1) ? 0u : STAGE_UNIT1;
    c.eax = p1; c.esi = p2; c.nargs = 2; c.args[0] = pTr1; c.args[1] = pTr2; c.calleePop = 8u;
    ts[0] = p1; ts[1] = p2; ts[2] = pTr1; ts[3] = pTr2;
    run_and_emit(0x6FC90B70u, "PLRTRADE_SendTradeAcceptButtonAndSetState3_113c", k,
                 k == 0 ? "null_p1" : k == 1 ? "null_p2" : "both_players", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [89] 0x6FCADEB0 ITEMS_SendSwapContainerItemPacket0D_6FCADEB0_113c (eax=pPlayer, ecx=pClient, esi=pItem, stack=[nCmdFlags], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 891u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, 89u, 0u, 5000u, 5000u, 892u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    U32(STAGE_UDATA0 + 0x9Cu)  = STAGE_CLIENT;
    U32(STAGE_CLIENT + 0x16Cu) = 0u;
    U32(STAGE_CLIENT + 0x170u) = 1u;
    U32(STAGE_CLIENT + 0x174u) = STAGE_UNIT0;
    U8(STAGE_CLIENT + 0x3D4u)  = 1u;
    U32(STAGE_UDATA1 + 0x00u)  = 2u;
    U32(STAGE_UDATA1 + 0x18u)  = 0x00200010u; /* simple + identified */
    uint32_t cliArg = (k == 0) ? 0u : STAGE_CLIENT;
    uint32_t flags  = (k == 2) ? 0x10u : 0u;
    c.eax = STAGE_UNIT0; c.ecx = cliArg; c.esi = STAGE_UNIT1; c.nargs = 1; c.args[0] = flags; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = cliArg; ts[2] = STAGE_UNIT1; ts[3] = flags;
    run_and_emit(0x6FCADEB0u, "ITEMS_SendSwapContainerItemPacket0D_6FCADEB0_113c", k,
                 k == 0 ? "assert_mismatch_cli" : k == 1 ? "send_0d_f0" : "send_0d_f10", &c, ts, 4, 0u, k == 0);
  }

  /* [90] 0x6FCADF10 ITEMS_SendRemoveContainerItemPacket0A_6FCADF10_113c (eax=pPlayer, ecx=pClient, esi=pItem, stack=[nCmdFlags], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 901u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, 90u, 0u, 5000u, 5000u, 902u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    U32(STAGE_UDATA0 + 0x9Cu)  = STAGE_CLIENT;
    U32(STAGE_CLIENT + 0x16Cu) = 0u;
    U32(STAGE_CLIENT + 0x170u) = 1u;
    U32(STAGE_CLIENT + 0x174u) = STAGE_UNIT0;
    U8(STAGE_CLIENT + 0x3D4u)  = 1u;
    U32(STAGE_UDATA1 + 0x00u)  = 2u;
    U32(STAGE_UDATA1 + 0x18u)  = 0x00200010u;
    uint32_t cliArg = (k == 0) ? 0u : STAGE_CLIENT;
    uint32_t flags  = (k == 2) ? 0x10u : 0u;
    c.eax = STAGE_UNIT0; c.ecx = cliArg; c.esi = STAGE_UNIT1; c.nargs = 1; c.args[0] = flags; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = cliArg; ts[2] = STAGE_UNIT1; ts[3] = flags;
    run_and_emit(0x6FCADF10u, "ITEMS_SendRemoveContainerItemPacket0A_6FCADF10_113c", k,
                 k == 0 ? "assert_mismatch_cli" : k == 1 ? "send_0a_f0" : "send_0a_f10", &c, ts, 4, 0u, k == 0);
  }

  /* [91] 0x6FCADFD0 ITEMS_SendGroundItemPacket03_6FCADFD0_113c (eax=pPlayer, ecx=pClient, esi=pItem, stack=[nCmdFlags], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 911u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, 91u, 3u, 5010u, 5020u, 912u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    U32(STAGE_UDATA0 + 0x9Cu)  = STAGE_CLIENT;
    U32(STAGE_CLIENT + 0x16Cu) = 0u;
    U32(STAGE_CLIENT + 0x170u) = 1u;
    U32(STAGE_CLIENT + 0x174u) = STAGE_UNIT0;
    U8(STAGE_CLIENT + 0x3D4u)  = 1u;
    U32(STAGE_UDATA1 + 0x00u)  = 2u;
    U32(STAGE_UDATA1 + 0x18u)  = 0x00200010u;
    uint32_t cliArg = (k == 0) ? 0u : STAGE_CLIENT;
    uint32_t flags  = (k == 2) ? 0x10u : 0u;
    c.eax = STAGE_UNIT0; c.ecx = cliArg; c.esi = STAGE_UNIT1; c.nargs = 1; c.args[0] = flags; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = cliArg; ts[2] = STAGE_UNIT1; ts[3] = flags;
    run_and_emit(0x6FCADFD0u, "ITEMS_SendGroundItemPacket03_6FCADFD0_113c", k,
                 k == 0 ? "assert_mismatch_cli" : k == 1 ? "send_03_f0" : "send_03_f10", &c, ts, 4, 0u, k == 0);
  }

  /* [92] 0x6FCAE090 ITEMS_ZeroStaticPosAndSendPickupPacket01_6FCAE090_113c (eax=pPlayer, ecx=pItem, edx=pClient, stack=[nCmdFlags], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 921u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, 92u, 3u, 5010u, 5020u, 922u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    U32(STAGE_UDATA0 + 0x9Cu)  = STAGE_CLIENT;
    U32(STAGE_CLIENT + 0x16Cu) = 0u;
    U32(STAGE_CLIENT + 0x170u) = 1u;
    U32(STAGE_CLIENT + 0x174u) = STAGE_UNIT0;
    U8(STAGE_CLIENT + 0x3D4u)  = 1u;
    U32(STAGE_UDATA1 + 0x00u)  = 2u;
    U32(STAGE_UDATA1 + 0x18u)  = 0x00200010u;
    uint32_t cliArg = (k == 0) ? 0u : STAGE_CLIENT;
    uint32_t flags  = (k == 2) ? 0x10u : 0u;
    c.eax = STAGE_UNIT0; c.ecx = STAGE_UNIT1; c.edx = cliArg; c.nargs = 1; c.args[0] = flags; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = cliArg; ts[3] = flags;
    run_and_emit(0x6FCAE090u, "ITEMS_ZeroStaticPosAndSendPickupPacket01_6FCAE090_113c", k,
                 k == 0 ? "assert_mismatch_cli" : k == 1 ? "zero_and_send_f0" : "zero_and_send_f10", &c, ts, 4, 0u, k == 0);
  }

  /* [93] 0x6FCB02E0 NPCS_ResetVendorSlotInventory_6FCB02E0_113c (edi=pGame, esi=pNpcSlot, stack=[pNpcUnit], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 148u, 93u, 1u, 5000u, 5000u, 931u);
    uint32_t pSlot = STAGE_SCRATCH;
    U8(pSlot + 0x20u)  = 1u;
    U32(pSlot + 0x28u) = 0x99u;
    if (k == 2) {
      U32(pSlot + 0x04u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    }
    uint32_t pNpc = (k == 0) ? 0u : STAGE_UNIT0;
    c.edi = STAGE_GAME; c.esi = pSlot; c.nargs = 1; c.args[0] = pNpc; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = pSlot; ts[2] = pNpc;
    run_and_emit(0x6FCB02E0u, "NPCS_ResetVendorSlotInventory_6FCB02E0_113c", k,
                 k == 0 ? "null_npc" : k == 1 ? "fresh_slot_with_npc" : "free_old_and_reset", &c, ts, 3, 0u, 0);
  }

  /* [94] 0x6FC58FF0 MISSILES_SrvHit_ApplyProgOverlay_6FC58FF0_113c (ecx=pGame, edx=pMissile, stack=[pTarget, pDamage], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mid = (k == 1) ? g_mis_no_overlay : g_mis_overlay;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, mid, 94u, 0u, 5000u, 5000u, 941u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0u, 95u, 1u, 5005u, 5005u, 942u);
    uint32_t pM = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = pM; c.nargs = 2; c.args[0] = STAGE_UNIT1; c.args[1] = STAGE_DMG; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = pM; ts[2] = STAGE_UNIT1; ts[3] = STAGE_DMG;
    run_and_emit(0x6FC58FF0u, "MISSILES_SrvHit_ApplyProgOverlay_6FC58FF0_113c", k,
                 k == 0 ? "null_missile" : k == 1 ? "no_overlay" : "apply_overlay", &c, ts, 4, 0u, 0);
  }

  /* [95] 0x6FC58F40 MISSILES_ConsumePierceStat_6FC58F40_113c (esi=pMissile, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mid = (k == 0) ? g_mis_nopierce : g_mis_pierce;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, mid, 95u, 0u, 5000u, 5000u, 951u);
    if (k == 2) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x148, 3, 0);
    }
    c.esi = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    run_and_emit(0x6FC58F40u, "MISSILES_ConsumePierceStat_6FC58F40_113c", k,
                 k == 0 ? "no_pierce_flag" : k == 1 ? "pierce_stat_zero" : "consume_pierce_3_to_2", &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [96] 0x6FC59210 MISSILES_InitDrunkenPath_6FC59210_113c (ecx=pMissile, edx=nUnused, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pM = (k == 0) ? 0u : STAGE_UNIT0;
    if (k > 0) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 67u, 96u, 0u, 5100u, 5100u, 961u);
      U16(STAGE_PATH0 + 0x10u) = 5115u;
      U16(STAGE_PATH0 + 0x12u) = 5110u;
      U16(STAGE_UDATA0 + 0x08u) = (k == 1) ? 40u : 300u;
      U16(STAGE_UDATA0 + 0x0Au) = (k == 1) ? 40u : 300u;
    }
    c.ecx = pM; c.edx = 0u;
    ts[0] = pM; ts[1] = 0;
    run_and_emit(0x6FC59210u, "MISSILES_InitDrunkenPath_6FC59210_113c", k,
                 k == 0 ? "null_missile" : k == 1 ? "frames_40" : "clamp_255", &c, ts, 2, 0u, 0);
  }

  /* [97] 0x6FC5ADD0 MISSILES_TargetFilter_MonstersOnly_6FC5ADD0_113c (ecx=pTargetUnit, edx=pFilterCtx, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 971u); /* owner player */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 1 ? 0u : 1u), 0u, 2u, 1u, 5005u, 5005u, 972u); /* target */
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 3u, 67u, 3u, 0u, 5002u, 5002u, 973u); /* missile */
    uint32_t pTables = U32(0x6FDE9E1Cu + g_com_rebase);
    uint32_t pMisTxt = U32(pTables + 0xB64u) + 67u * 0x1A4u;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_UNIT2;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x08u) = pMisTxt;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    uint32_t pCtx = (k == 0) ? 0u : STAGE_SCRATCH;
    c.ecx = STAGE_UNIT1; c.edx = pCtx;
    ts[0] = STAGE_UNIT1; ts[1] = pCtx;
    run_and_emit(0x6FC5ADD0u, "MISSILES_TargetFilter_MonstersOnly_6FC5ADD0_113c", k,
                 k == 0 ? "null_ctx" : k == 1 ? "player_reject" : "monster_accept", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [98] 0x6FC5AD70 MISSILES_TargetFilter_PlayersAndAlignedMonsters_6FC5AD70_113c (ecx=pTargetUnit, edx=pFilterCtx, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 1u, 1u, 5000u, 5000u, 981u); /* monster owner */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 2 ? 0u : 1u), 0u, 2u, 1u, 5005u, 5005u, 982u); /* target */
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 3u, 67u, 3u, 0u, 5002u, 5002u, 983u);
    uint32_t pTables = U32(0x6FDE9E1Cu + g_com_rebase);
    uint32_t pMisTxt = U32(pTables + 0xB64u) + 67u * 0x1A4u;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_UNIT2;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x08u) = pMisTxt;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    uint32_t pCtx = (k == 0) ? 0u : STAGE_SCRATCH;
    c.ecx = STAGE_UNIT1; c.edx = pCtx;
    ts[0] = STAGE_UNIT1; ts[1] = pCtx;
    run_and_emit(0x6FC5AD70u, "MISSILES_TargetFilter_PlayersAndAlignedMonsters_6FC5AD70_113c", k,
                 k == 0 ? "null_ctx" : k == 1 ? "unaligned_mon_reject" : "player_target", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [99] 0x6FC59BD0 MISSILES_SrvHit_ClampRemainingPoisonLen_6FC59BD0_113c (ecx=pGame, edx=pMissile, stack=[pTarget, pDamage], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 991u); /* Necro owner */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 3u, 67u, 2u, 0u, 5002u, 5002u, 992u); /* missile */
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 0u, 3u, 1u, 5005u, 5005u, 993u); /* target */
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    U32(STAGE_DMG + 0x28u) = 500u; /* poisDmg */
    U32(STAGE_DMG + 0x2Cu) = 200u; /* poisLen */
    if (k >= 1) {
      U32(STAGE_UNIT1 + 0xC8u) = 0x400u; /* has owner */
      U32(STAGE_UNIT1 + 0x94u) = 0u;
      U32(STAGE_UNIT1 + 0x98u) = 1u;
      S16(STAGE_UDATA1 + 0x06u) = 83; /* Poison Explosion (has len) */
      S16(STAGE_UDATA1 + 0x0Cu) = 5;  /* skill level */
      S32(STAGE_UDATA1 + 0x10u) = (k == 1) ? 105 : 130; /* expireFrame vs gameFrame=100 (rem 5 < 10 vs 30) */
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT1; c.nargs = 2; c.args[0] = STAGE_UNIT2; c.args[1] = STAGE_DMG; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT1; ts[2] = STAGE_UNIT2; ts[3] = STAGE_DMG;
    run_and_emit(0x6FC59BD0u, "MISSILES_SrvHit_ClampRemainingPoisonLen_6FC59BD0_113c", k,
                 k == 0 ? "no_owner_zero" : k == 1 ? "rem5_zero" : "rem30_clamp", &c, ts, 4, 0u, 0);
  }

  /* [100] 0x6FC5A790 MISSILES_ApplyDemonUndeadElemBonus_6FC5A790_113c (ecx=pGame, edx=pMissile, stack=[pTargetUnit, pDamage], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, g_mis_dmnund, 100u, 0u, 5000u, 5000u, 1001u);
    /* Target: class 0 = Zombie (undead), class 19 = Fallen (demon) */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, (k == 1 ? 19u : 0u), 101u, 1u, 5005u, 5005u, 1002u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 48, 20 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 49, 40 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 52, 20 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 53, 40 << 8, 0);
    uint32_t pM = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = pM; c.nargs = 2; c.args[0] = STAGE_UNIT1; c.args[1] = STAGE_DMG; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = pM; ts[2] = STAGE_UNIT1; ts[3] = STAGE_DMG;
    run_and_emit(0x6FC5A790u, "MISSILES_ApplyDemonUndeadElemBonus_6FC5A790_113c", k,
                 k == 0 ? "null_missile" : k == 1 ? "demon_target" : "undead_target", &c, ts, 4, 0u, 0);
  }
}

static void emit_batch_101_to_150(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [101] 0x6FC5A850 MISSILES_ConvertPhysToElemByCalc90_6FC5A850_113c (ecx=pGame, edx=pMissile, stack=[pTargetUnit, pDamage], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 1011u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 3u, g_mis_calc90, 2u, 0u, 5002u, 5002u, 1012u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 0u, 3u, 1u, 5005u, 5005u, 1013u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    U32(STAGE_UNIT1 + 0xC8u) = 0x400u;
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 1u;
    S16(STAGE_UDATA1 + 0x06u) = 7; /* Fire Arrow */
    S16(STAGE_UDATA1 + 0x0Cu) = (k == 2) ? 10 : 2;
    U32(STAGE_DMG + 0x08u) = (k == 2) ? (100u << 8) : (40u << 8); /* physDmg */
    uint32_t pM = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = pM; c.nargs = 2; c.args[0] = STAGE_UNIT2; c.args[1] = STAGE_DMG; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = pM; ts[2] = STAGE_UNIT2; ts[3] = STAGE_DMG;
    run_and_emit(0x6FC5A850u, "MISSILES_ConvertPhysToElemByCalc90_6FC5A850_113c", k,
                 k == 0 ? "null_missile" : k == 1 ? "lvl2_40phys" : "lvl10_100phys", &c, ts, 4, 0u, 0);
  }

  /* [102] 0x6FC9B4F0 AIINIT_SpawnerResetFrameTimers113c (ecx=pGame, edx=pUnit, stack=[pAiParam], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_GAME + 0xA8u) = 100u + (uint32_t)k * 77u;
    uint32_t pAiGen = STAGE_SCRATCH + 0x40u;
    U32(STAGE_SCRATCH) = pAiGen;
    U32(pAiGen + 0x18u) = 999u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FC9B4F0u, "AIINIT_SpawnerResetFrameTimers113c", k,
                 k == 0 ? "frame100" : k == 1 ? "frame177" : "frame254", &c, ts, 3, 0u, 0);
  }

  /* [103] 0x6FC9BD00 AI_FilterLivingGloamUnit113c (ecx=pUnit, edx=pCtx, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t cid  = (k == 0) ? 0u : 0x76u; /* Zombie vs Gloam */
    uint32_t mode = (k == 1) ? 0u : 1u;    /* dead vs alive */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, cid, 103u, mode, 5000u, 5000u, 1031u);
    c.ecx = STAGE_UNIT0; c.edx = 0u;
    ts[0] = STAGE_UNIT0; ts[1] = 0;
    run_and_emit(0x6FC9BD00u, "AI_FilterLivingGloamUnit113c", k,
                 k == 0 ? "zombie_false" : k == 1 ? "dead_gloam_false" : "living_gloam_true", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [104] 0x6FC35890 AI_CountNearbyMinion453Or461Callback_6FC35890_113c (ecx=pGame, edx=pOrigin, stack=[pCand, pOutCount], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 1u, 1u, 5000u, 5000u, 1041u);
    uint32_t cid = (k == 0) ? 0u : (k == 1 ? 0x1C5u : 0x1CDu);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, cid, 2u, 1u, 5005u, 5005u, 1042u);
    U32(STAGE_SCRATCH) = (uint32_t)k;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_UNIT1; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = STAGE_SCRATCH;
    run_and_emit(0x6FC35890u, "AI_CountNearbyMinion453Or461Callback_6FC35890_113c", k,
                 k == 0 ? "other_class" : k == 1 ? "class_1c5_inc" : "class_1cd_inc", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [105] 0x6FCAFAA0 SUNITPROXY_GetPlayerNodeItemInNpcSlot_6FCAFAA0_113c (eax=pNpcUnit, ecx=pGame, edi=pPlayerUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 148u, 10u, 1u, 5000u, 5000u, 1051u); /* Akara */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 77u, 1u, 5005u, 5005u, 1052u);
    U32(STAGE_GAME + 0x1D24u) = STAGE_NPCCTRL;
    U32(STAGE_NPCCTRL + 0x04u) = STAGE_NPCCTRL + 0x10u;
    uint32_t pSlot0 = STAGE_NPCCTRL + 0x10u;
    U32(pSlot0 + 0x00u) = 148u;
    U32(pSlot0 + 0x0Cu) = (k >= 1) ? 1u : 0u;
    if (k == 2) {
      uint32_t pNode = STAGE_SCRATCH;
      U32(pSlot0 + 0x08u) = pNode;
      U32(pNode + 0x00u) = STAGE_SCRATCH + 0x100u; /* item ptr */
      U32(pNode + 0x04u) = 77u;                    /* matches player guid */
    }
    uint32_t pNpc = (k == 0) ? 0u : STAGE_UNIT0;
    c.eax = pNpc; c.ecx = STAGE_GAME; c.edi = STAGE_UNIT1;
    ts[0] = pNpc; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT1;
    run_and_emit(0x6FCAFAA0u, "SUNITPROXY_GetPlayerNodeItemInNpcSlot_6FCAFAA0_113c", k,
                 k == 0 ? "null_npc" : k == 1 ? "no_player_node" : "found_item_ptr", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [106] 0x6FC35660 AI_FindLowestLifeInjuredAllyCallback_6FC35660_113c (ecx=pGame, edx=pHealer, stack=[pCand, pCtx], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 1u, 1u, 5000u, 5000u, 1061u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0u, 2u, 1u, 5004u, 5004u, 1062u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, (k == 0 ? 90 : (k == 1 ? 50 : 25)) << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 100 << 8, 0);
    U32(STAGE_SCRATCH + 0x00u) = 0u;    /* bestUnit */
    U32(STAGE_SCRATCH + 0x04u) = 100u;  /* bestLifePct */
    U32(STAGE_SCRATCH + 0x08u) = 200u;  /* maxSqDist */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_UNIT1; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = STAGE_SCRATCH;
    run_and_emit(0x6FC35660u, "AI_FindLowestLifeInjuredAllyCallback_6FC35660_113c", k,
                 k == 0 ? "healthy_90pct" : k == 1 ? "injured_50pct" : "injured_25pct", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [107] 0x6FC9BB00 AI_ScanCallbackNearestSelectableCorpse_6FC9BB00_113c (ecx=pGame, edx=pUnit, stack=[pCand, pCtx], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 1u, 1u, 5000u, 5000u, 1071u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0u, 2u, (k == 0 ? 1u : 0x0Cu),
                      (uint16_t)(5000 + k * 3), 5000u, 1072u);
    U32(STAGE_UNIT1 + 0xC4u) = 0x00000006u; /* bit 1 selectable, bit 9 clear */
    U32(STAGE_SCRATCH + 0x00u) = 0u;
    U32(STAGE_SCRATCH + 0x04u) = 500u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_UNIT1; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FC9BB00u, "AI_ScanCallbackNearestSelectableCorpse_6FC9BB00_113c", k,
                 k == 0 ? "alive_skip" : k == 1 ? "corpse_dist9" : "corpse_dist36", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [108] 0x6FC9BC70 AI_ScanCallbackLowestLifeBaseIdEBOrEE_6FC9BC70_113c (ecx=pGame, edx=pUnit, stack=[pCand, pCtx], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0xEBu, 1u, 1u, 5000u, 5000u, 1081u);
    uint32_t cid = (k == 0) ? 0u : (k == 1 ? 0xEBu : 0xEEu);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, cid, 2u, 1u, 5002u, 5002u, 1082u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 30 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 100 << 8, 0);
    U32(STAGE_SCRATCH + 0x08u) = (k == 2) ? 50u : 0u; /* threshold 0 -> initialized to 0x7FFFFFFF */
    U32(STAGE_SCRATCH + 0x0Cu) = 100u; /* maxSqDist */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_UNIT1; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FC9BC70u, "AI_ScanCallbackLowestLifeBaseIdEBOrEE_6FC9BC70_113c", k,
                 k == 0 ? "wrong_class" : k == 1 ? "class_eb_init_thresh" : "class_ee_update", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [109] 0x6FC9BD50 AI_FallenShamanCorpseFilter113c (ecx=pGame, edx=pShaman, stack=[pCand, pScanCtx], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 58u, 1u, 1u, 5000u, 5000u, 1091u);
    uint32_t cid = (k == 0) ? 0u : (k == 1 ? 0x13u : 0x3Au);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, cid, 2u, 0x0Cu,
                      (uint16_t)(5000 + k * 2), 5000u, 1092u);
    U32(STAGE_UNIT1 + 0xC4u) = 0x00000006u; /* selectable */
    U32(STAGE_SCRATCH + 0x0Cu) = 200u; /* maxSqDist */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_UNIT1; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FC9BD50u, "AI_FallenShamanCorpseFilter113c", k,
                 k == 0 ? "non_fallen" : k == 1 ? "fallen_13_ok" : "fallen_3a_ok", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [110] 0x6FC9BA40 AI_ScanCallbackNearestBaseId136_6FC9BA40_113c (ecx=pGame, edx=pUnit, stack=[pCand, pCtx], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x136u, 1u, 1u, 5000u, 5000u, 1101u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, (k == 0 ? 0u : 0x136u), 2u, 1u, 5003u, 5000u, 1102u);
    U32(STAGE_UNIT1 + 0xC4u) = 0x00000006u;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, (k == 2 ? 20 : 80) << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 100 << 8, 0);
    U32(STAGE_SCRATCH + 0x08u) = 100u; /* maxSqDist */
    U32(STAGE_SCRATCH + 0x0Cu) = 500u; /* bestDist */
    U32(STAGE_SCRATCH + 0x10u) = 500u; /* bestLowHpDist */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_UNIT1; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FC9BA40u, "AI_ScanCallbackNearestBaseId136_6FC9BA40_113c", k,
                 k == 0 ? "wrong_class" : k == 1 ? "healthy_80pct" : "low_hp_20pct", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [111] 0x6FC9CF10 AI_ScanCallbackHostileTargetsMetrics_6FC9CF10_113c (ecx=pGame, edx=pUnit, stack=[pCand, pCtx], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 2 ? 0u : 1u), 0u, 1u, 1u, 5000u, 5000u, 1111u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 2 ? 1u : 0u), 0u, 2u, 1u,
                      (uint16_t)(k == 0 ? 5000 : (k == 1 ? 5005 : 5020)), 5000u, 1112u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 80 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 100 << 8, 0);
    U32(STAGE_SCRATCH + 0x04u) = 1000u;
    U32(STAGE_SCRATCH + 0x10u) = 1000u;
    U32(STAGE_SCRATCH + 0x18u) = 1000u;
    uint32_t pCand = (k == 0) ? STAGE_UNIT0 : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = pCand; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pCand; ts[3] = STAGE_SCRATCH;
    run_and_emit(0x6FC9CF10u, "AI_ScanCallbackHostileTargetsMetrics_6FC9CF10_113c", k,
                 k == 0 ? "self_skip" : k == 1 ? "close_hostile" : "far_hostile_plr_unit", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [112] 0x6FC35B00 AI_CheckTargetIsUnboundPutridDefiler_6FC35B00_113c (ecx=pGame, edx=pUnit, stack=[pCand, pMaxDistSq], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 1u, 1u, 5000u, 5000u, 1121u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, (k == 0 ? 0u : 0x1ECu), 2u, 1u, 5004u, 5000u, 1122u);
    uint32_t pAiGen = STAGE_SCRATCH + 0x40u;
    U32(STAGE_UDATA1 + 0x28u) = pAiGen;
    S32(pAiGen + 0x14u) = (k == 1) ? 5 : -1; /* bound vs unbound (-1) */
    U32(STAGE_SCRATCH) = 100u; /* maxDistSq */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_UNIT1; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = STAGE_SCRATCH;
    run_and_emit(0x6FC35B00u, "AI_CheckTargetIsUnboundPutridDefiler_6FC35B00_113c", k,
                 k == 0 ? "not_defiler" : k == 1 ? "bound_defiler" : "unbound_defiler_ok", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [113] 0x6FCBE600 SKILLS_IncrementUnitFindCountCallback_6FCBE600_113c (ecx=pFindData, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_SCRATCH + 0x40u;
    U32(STAGE_SCRATCH + 0x40u) = (uint32_t)k * 10u;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FCBE600u, "SKILLS_IncrementUnitFindCountCallback_6FCBE600_113c", k,
                 k == 0 ? "cnt_0_to_1" : k == 1 ? "cnt_10_to_11" : "cnt_20_to_21", &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [114] 0x6FC62290 SKILLS_StatListExpireClearState_6FC62290_113c (ecx=pUnit, edx=nState, stack=[pStatList], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 1141u);
    fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 20 + k, 1);
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = pU; c.edx = (uint32_t)(20 + k); c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = pU; ts[1] = 20 + k; ts[2] = 0;
    run_and_emit(0x6FC62290u, "SKILLS_StatListExpireClearState_6FC62290_113c", k,
                 k == 0 ? "assert_null_unit" : k == 1 ? "clear_21" : "clear_22", &c, ts, 3, 0u, k == 0);
  }

  /* [115] 0x6FC6DF60 SKILLS_DivideValueByMonLvlHp113c (al=nLevelByte, esi=nValue, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t lvl = (k == 0) ? 0u : (k == 1 ? 10u : 50u);
    int32_t val  = 100000;
    c.eax = lvl; c.esi = (uint32_t)val;
    ts[0] = lvl; ts[1] = val;
    run_and_emit(0x6FC6DF60u, "SKILLS_DivideValueByMonLvlHp113c", k,
                 k == 0 ? "lvl0" : k == 1 ? "lvl10" : "lvl50", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [116] 0x6FC6C190 SKILLS_AddDamagePercentStat_6FC6C190_113c (ecx=pUnit, edx=nDelta, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 1u, 1u, 5000u, 5000u, 1161u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x19, 50, 0);
    int32_t delta = (k == 0) ? 0 : (k == 1 ? 35 : -20);
    c.ecx = STAGE_UNIT0; c.edx = (uint32_t)delta;
    ts[0] = STAGE_UNIT0; ts[1] = delta;
    run_and_emit(0x6FC6C190u, "SKILLS_AddDamagePercentStat_6FC6C190_113c", k,
                 k == 0 ? "delta_0" : k == 1 ? "delta_plus35" : "delta_minus20", &c, ts, 2, 0u, 0);
  }

  /* [117] 0x6FC47240 SKILLS_SrvSt34_CheckSelectableCorpseTarget_6FC47240_113c (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 1171u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0u, 2u, (k == 2 ? 0x0Cu : 1u), 5005u, 5005u, 1172u);
    U32(STAGE_UNIT1 + 0xC4u) = 0x00000006u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1; U32(STAGE_PATH0 + 0x5Cu) = 1u; U32(STAGE_PATH0 + 0x60u) = 2u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 74u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 74; ts[3] = 1;
    run_and_emit(0x6FC47240u, "SKILLS_SrvSt34_CheckSelectableCorpseTarget_6FC47240_113c", k,
                 k == 0 ? "no_target" : k == 1 ? "alive_mon_reject" : "dead_corpse_ok", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [118] 0x6FCB2030 SKILLS_SrvSt23_ValidateMeleeTarget_6FCB2030_113c (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 1u, 1u, 5000u, 5000u, 1181u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0u, 2u, 1u,
                      (uint16_t)(k == 2 ? 5001 : 5040), 5000u, 1182u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1; U32(STAGE_PATH0 + 0x5Cu) = 1u; U32(STAGE_PATH0 + 0x60u) = 2u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 126u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 126; ts[3] = 1;
    run_and_emit(0x6FCB2030u, "SKILLS_SrvSt23_ValidateMeleeTarget_6FCB2030_113c", k,
                 k == 0 ? "no_target" : k == 1 ? "out_of_range" : "in_melee_range", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [119] 0x6FC2C170 SKILLS_SrvDo147_SyncOwnerPos_6FC2C170_113c (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 1u, 1u, 5000u, 5000u, 1191u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0u, 2u, 1u,
                      (uint16_t)(5020 + k * 5), 5030u, 1192u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      U32(STAGE_UNIT0 + 0xC8u) = 0x400u;
      U32(STAGE_UNIT0 + 0x94u) = 1u;
      U32(STAGE_UNIT0 + 0x98u) = 2u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 0u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 1;
    run_and_emit(0x6FC2C170u, "SKILLS_SrvDo147_SyncOwnerPos_6FC2C170_113c", k,
                 k == 0 ? "no_owner" : k == 1 ? "sync_pos_a" : "sync_pos_b", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [120] 0x6FCB83B0 SKILLS_FindFirstZeroByteOffsetInSeqRecord_6FCB83B0_113c (esi=pUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 3u, 1u, 1u, 5000u, 5000u, 1201u); /* Paladin */
    if (k == 2) {
      uint32_t pSk = attach_skill(STAGE_UNIT0, 106, 4); /* Zeal (sequence skill) */
      U32(U32(STAGE_UNIT0 + 0xA8u) + 0x10u) = pSk;
    }
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c.esi = pU;
    ts[0] = pU;
    run_and_emit(0x6FCB83B0u, "SKILLS_FindFirstZeroByteOffsetInSeqRecord_6FCB83B0_113c", k,
                 k == 0 ? "assert_null_unit" : k == 1 ? "no_skill_ret7" : "paladin_zeal_seq", &c, ts, 1, 0xFFFFFFFFu, k == 0);
  }

  /* [121] 0x6FC6EC30 SKILLS_IsMonsterCorpseUsableForRaise_6FC6EC30_113c (esi=pUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 121u, (k == 2 ? 0x0Cu : 1u), 5000u, 5000u, 1211u);
    U32(STAGE_UNIT0 + 0xC4u) = 0x00000006u;
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c.esi = pU;
    ts[0] = pU;
    run_and_emit(0x6FC6EC30u, "SKILLS_IsMonsterCorpseUsableForRaise_6FC6EC30_113c", k,
                 k == 0 ? "null_unit" : k == 1 ? "alive_zombie_0" : "dead_zombie_1", &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [122] 0x6FC2DE20 SKILLS_ResetUnitAiThinkEvent_6FC2DE20_113c (eax=pGame, ebx=pUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pTimer = stage_timer_queue();
    (void)pTimer;
    U32(STAGE_GAME + 0xA8u) = 100u + (uint32_t)k * 20u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 122u, 1u, 5000u, 5000u, 1221u);
    if (k == 2) {
      /* Pre-attach an existing nType==0 event node on unit+0xDC so EVENT_FreeNode runs */
      uint32_t pEv = (uint32_t)(uintptr_t)bump_alloc(0x30u);
      U8(pEv + 0x00u)  = 0u; /* nType == 0 */
      U32(pEv + 0x04u) = 120u;
      U32(pEv + 0x08u) = STAGE_UNIT0;
      U32(pEv + 0x0Cu) = 122u;
      U32(pEv + 0x10u) = 1u;
      U32(STAGE_UNIT0 + 0xDCu) = pEv;
    }
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c.eax = STAGE_GAME; c.ebx = pU;
    ts[0] = STAGE_GAME; ts[1] = pU;
    run_and_emit(0x6FC2DE20u, "SKILLS_ResetUnitAiThinkEvent_6FC2DE20_113c", k,
                 k == 0 ? "null_unit_sched" : k == 1 ? "no_old_ev" : "free_old_ev0_and_sched", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [123] 0x6FC6EEE0 SKILLS_SrvSt17_CheckSelectableCorpseOutsideTown_6FC6EEE0_113c (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 1 ? 1u : 2u)); /* town vs wild */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 1231u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0u, 2u, 0x0Cu, 5005u, 5005u, 1232u);
    U32(STAGE_UNIT1 + 0xC4u) = 0x00000006u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1; U32(STAGE_PATH0 + 0x5Cu) = 1u; U32(STAGE_PATH0 + 0x60u) = 2u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 74u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 74; ts[3] = 1;
    run_and_emit(0x6FC6EEE0u, "SKILLS_SrvSt17_CheckSelectableCorpseOutsideTown_6FC6EEE0_113c", k,
                 k == 0 ? "no_target" : k == 1 ? "town_reject" : "wild_corpse_ok", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [124] 0x6FC54AA0 QUESTS_SendQuestStateAlert5D_113c (esi=pPlayer, stack=[uQuestId, uMinAct], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0 ? 1u : 40u)); /* Act 0 vs Act 1 */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 2 ? 0u : STAGE_ROOM0), 0u, 0u, 1u, 1u, 5000u, 5000u, 1241u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    uint32_t qid = (k == 2) ? 0x23u : 0x04u;
    uint32_t minAct = (k == 0) ? 2u : 1u;
    c.esi = STAGE_UNIT0; c.nargs = 2; c.args[0] = qid; c.args[1] = minAct; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = qid; ts[2] = minAct;
    run_and_emit(0x6FC54AA0u, "QUESTS_SendQuestStateAlert5D_113c", k,
                 k == 0 ? "below_min_act_skip" : k == 1 ? "act_ok_send_5d_q4" : "no_room_send_5d_q23", &c, ts, 3, 0u, 0);
  }

  /* [125] 0x6FC81D40 ACT1Q5_GrantImbueRewardIfLevel8Callback_6FC81D40_113c (ecx=pGame, edx=pPlayer, stack=[pArg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 1251u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, (k == 0 ? 5 : 8), 0); /* stat 12 = level */
    uint32_t pRec = STAGE_QBITS0;
    U32(pRec + 0x00u) = STAGE_QBITS0 + 0x10u;
    U32(pRec + 0x04u) = 0x60u;
    U32(STAGE_UDATA0 + 0x10u) = pRec;
    if (k == 1) {
      U8(STAGE_QBITS0 + 0x10u + (3u * 2u)) = 0x01u; /* bit 0 already set */
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC81D40u, "ACT1Q5_GrantImbueRewardIfLevel8Callback_6FC81D40_113c", k,
                 k == 0 ? "lvl5_skip" : k == 1 ? "already_done_skip" : "lvl8_grants_0d_and_1", &c, ts, 3, 0u, 0);
  }

  /* [126] 0x6FC649F0 SKILLS_GetNonPlayerTransformAnimMode_6FC649F0_113c (eax=pUnit, stack=[nAnimMode], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 0 ? 0u : 1u), 0u, 126u, 1u, 5000u, 5000u, 1261u);
    if (k == 2) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 139, 1); /* STATE_WOLF */
    }
    uint32_t animMode = (k == 0) ? 7u : (k == 1 ? 4u : 5u);
    c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = animMode; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = animMode;
    run_and_emit(0x6FC649F0u, "SKILLS_GetNonPlayerTransformAnimMode_6FC649F0_113c", k,
                 k == 0 ? "player_passthrough" : k == 1 ? "mon_no_transform" : "mon_wolf_transform", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [127] 0x6FC47270 SKILLS_SrvSt33_CheckSelectableCorpseNoState76_6FC47270_113c (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 1u, 1u, 5000u, 5000u, 1271u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0u, 2u, 0x0Cu, 5005u, 5005u, 1272u);
    U32(STAGE_UNIT1 + 0xC4u) = 0x00000006u;
    if (k == 1) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT1, 0x76, 1); /* already horked -> reject */
    }
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1; U32(STAGE_PATH0 + 0x5Cu) = 1u; U32(STAGE_PATH0 + 0x60u) = 2u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 142u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 142; ts[3] = 1;
    run_and_emit(0x6FC47270u, "SKILLS_SrvSt33_CheckSelectableCorpseNoState76_6FC47270_113c", k,
                 k == 0 ? "no_target" : k == 1 ? "has_state76_reject" : "clean_corpse_ok", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [128] 0x6FC6DF20 SKILLS_HealUnitLifeClampedToMax_6FC6DF20_113c (eax=nHealAmount, ebx=pUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 1u, 1u, 5000u, 5000u, 1281u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 50 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
    int32_t heal = (k == 0) ? 0 : (k == 1 ? (20 << 8) : (80 << 8));
    c.eax = (uint32_t)heal; c.ebx = STAGE_UNIT0;
    ts[0] = heal; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC6DF20u, "SKILLS_HealUnitLifeClampedToMax_6FC6DF20_113c", k,
                 k == 0 ? "heal_0" : k == 1 ? "heal_20_unclamped" : "heal_80_clamped_50", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [129] 0x6FC6EE80 SKILLS_CanConvertOrMindBlastTarget_6FC6EE80_113c
     NOTE: Real DLL has esi=pTargetUnit, stack=[pGame, pCasterUnit] (ret 8), whereas TS has (m, pTargetUnit, pCasterUnit, pGame)! */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 1 ? 1u : 2u));
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 1291u); /* caster */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0u, 2u, 1u, 5005u, 5005u, 1292u); /* target zombie */
    uint32_t pTgt = (k == 0) ? 0u : STAGE_UNIT1;
    c.esi = pTgt; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = pTgt; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME;
    run_and_emit(0x6FC6EE80u, "SKILLS_CanConvertOrMindBlastTarget_6FC6EE80_113c", k,
                 k == 0 ? "null_target" : k == 1 ? "town_reject" : "wild_zombie_ok", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [130] 0x6FC2C110 SKILLS_CanMonsterBeImpregnated_6FC2C110_113c (esi=pUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t cid = (k == 1) ? 0x222u : 0u; /* Baal excluded vs Zombie ok */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, cid, 130u, 1u, 5000u, 5000u, 1301u);
    if (k == 0) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x6E, 1); /* already impregnated */
    }
    c.esi = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    run_and_emit(0x6FC2C110u, "SKILLS_CanMonsterBeImpregnated_6FC2C110_113c", k,
                 k == 0 ? "has_state6e_0" : k == 1 ? "excluded_222_0" : "zombie_ok_1", &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [131] 0x6FC47130 SKILLS_CanUnownedMonsterUseSkillInMode12_6FC47130_113c (ecx=pGame, edx=pUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 131u, 1u, 5000u, 5000u, 1311u);
    uint32_t pAiGen = STAGE_SCRATCH;
    U32(STAGE_UDATA0 + 0x28u) = pAiGen;
    if (k == 1) {
      U32(pAiGen + 0x28u) = 1u; /* has owner */
      U32(pAiGen + 0x2Cu) = 5u; /* ownerId != -1 */
      U32(pAiGen + 0x30u) = 0u; /* ownerType == 0 (player) -> returns 0 */
    }
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = pU;
    ts[0] = STAGE_GAME; ts[1] = pU;
    run_and_emit(0x6FC47130u, "SKILLS_CanUnownedMonsterUseSkillInMode12_6FC47130_113c", k,
                 k == 0 ? "null_unit" : k == 1 ? "player_owned_0" : "unowned_zombie_1", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [132] 0x6FC6ED60 SKILLS_SrvSt_ValidateTargetMonsterCorpse_6FC6ED60_113c (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 1321u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0u, 2u, (k == 2 ? 0x0Cu : 1u), 5005u, 5005u, 1322u);
    U32(STAGE_UNIT1 + 0xC4u) = 0x00000006u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1; U32(STAGE_PATH0 + 0x5Cu) = 1u; U32(STAGE_PATH0 + 0x60u) = 2u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 70u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 70; ts[3] = 1;
    run_and_emit(0x6FC6ED60u, "SKILLS_SrvSt_ValidateTargetMonsterCorpse_6FC6ED60_113c", k,
                 k == 0 ? "no_target" : k == 1 ? "alive_0" : "dead_corpse_1", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [133] 0x6FC6EDD0 SKILLS_SrvSt20_CanCreateIronGolemOnItem_6FC6EDD0_113c (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 1331u);
    uint32_t itemId = (k == 1) ? g_item_nonmetal : g_item_metal;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, itemId, 2u, 3u, 5005u, 5005u, 1332u);
    U32(STAGE_UDATA1 + 0x18u) = 0x10u; /* identified */
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1; U32(STAGE_PATH0 + 0x5Cu) = 4u; U32(STAGE_PATH0 + 0x60u) = 2u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 90u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 90; ts[3] = 1;
    run_and_emit(0x6FC6EDD0u, "SKILLS_SrvSt20_CanCreateIronGolemOnItem_6FC6EDD0_113c", k,
                 k == 0 ? "no_target" : k == 1 ? "nonmetal_0" : "metal_ground_1", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [134] 0x6FC63CA0 SKILLS_ClearState0CAndScheduleMonStats2Event_6FC63CA0_113c (eax=pGame, ebx=pUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, (k == 2 ? 19u : 0u), 134u, 1u, 5000u, 5000u, 1341u);
    fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x0C, 1);
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c.eax = STAGE_GAME; c.ebx = pU;
    ts[0] = STAGE_GAME; ts[1] = pU;
    run_and_emit(0x6FC63CA0u, "SKILLS_ClearState0CAndScheduleMonStats2Event_6FC63CA0_113c", k,
                 k == 0 ? "assert_null_unit" : k == 1 ? "zombie_delay" : "fallen_delay", &c, ts, 2, 0u, k == 0);
  }

  /* [135] 0x6FC80810 ACT4_EndgameStatusFilter_6FC80810_113c (ecx=pQuest, edx=pPlr, stack=[pGFlags, pPFlags, pOutStatus], ret 0xC, retMask=0xFF) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U8(STAGE_SCRATCH + 0u)  = 0xAAu;
    U8(STAGE_SCRATCH + 16u) = 0xBBu;
    U8(STAGE_SCRATCH + 32u) = 0xCCu;
    uint32_t outAddr = STAGE_SCRATCH + (uint32_t)k * 16u;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = 0u; c.args[1] = 0u; c.args[2] = outAddr; c.calleePop = 0xCu;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 0; ts[4] = outAddr;
    run_and_emit(0x6FC80810u, "ACT4_EndgameStatusFilter_6FC80810_113c", k,
                 k == 0 ? "zero_off0" : k == 1 ? "zero_off16" : "zero_off32", &c, ts, 5, 0xFFu, 0);
  }

  /* [136] 0x6FC81F30 QUESTS_Callback11_RemovePlayerFromQuestGuidList_6FC81F30_113c (ecx=pQuest, edx=pQuestArg, tail-call ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 42u, 1u, 5000u, 5000u, 1361u);
    uint32_t pList = STAGE_QUEST0 + 0x1Cu;
    U32(pList + 0x00u) = 42u;
    U32(pList + 0x04u) = 99u;
    U16(pList + 0x80u) = (k == 0) ? 0u : 2u;
    U32(STAGE_QUESTARG + 0x0Cu) = (k == 1) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FC81F30u, "QUESTS_Callback11_RemovePlayerFromQuestGuidList_6FC81F30_113c", k,
                 k == 0 ? "empty_list" : k == 1 ? "null_plr_not_found" : "remove_guid42", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [137] 0x6FC81860 ACT1Q4_RecordInifussTreeObjectGuid_6FC81860_113c (eax=pQuest, ecx=pObject, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 30u, 100u + (uint32_t)k * 50u, 0u, 5000u, 5000u, 1371u);
    uint32_t pObj = (k == 0) ? 0u : STAGE_UNIT0;
    c.eax = STAGE_QUEST0; c.ecx = pObj;
    ts[0] = STAGE_QUEST0; ts[1] = pObj;
    run_and_emit(0x6FC81860u, "ACT1Q4_RecordInifussTreeObjectGuid_6FC81860_113c", k,
                 k == 0 ? "null_obj_ffff" : k == 1 ? "guid_150" : "guid_200", &c, ts, 2, 0u, 0);
  }

  /* [138] 0x6FC81BE0 ACT1Q5_Callback11_RemovePlayerGuid_6FC81BE0_113c (ecx=pQuest, edx=pQuestArg, tail-call ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 55u, 1u, 5000u, 5000u, 1381u);
    uint32_t pList = STAGE_QUESTEX0 + 0x14u;
    U32(pList + 0x00u) = 55u;
    U32(pList + 0x04u) = 88u;
    U16(pList + 0x80u) = (k == 0) ? 0u : 2u;
    U32(STAGE_QUESTARG + 0x0Cu) = (k == 1) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FC81BE0u, "ACT1Q5_Callback11_RemovePlayerGuid_6FC81BE0_113c", k,
                 k == 0 ? "empty_list" : k == 1 ? "null_plr" : "remove_guid55", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [139] 0x6FC803D0 ACT1Q4_MarkPortalOpenedFlag92_6FC803D0_113c (eax=pGame, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    if (k >= 1) {
      U32(STAGE_GAME + 0x10F4u) = STAGE_QUESTCTRL;
      U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
      U32(STAGE_QUEST0 + 0x00u) = (k == 1) ? 2u : 4u;
      U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    }
    c.eax = STAGE_GAME;
    ts[0] = STAGE_GAME;
    run_and_emit(0x6FC803D0u, "ACT1Q4_MarkPortalOpenedFlag92_6FC803D0_113c", k,
                 k == 0 ? "no_questctrl" : k == 1 ? "wrong_qid" : "set_flag92", &c, ts, 1, 0u, 0);
  }

  /* [140] 0x6FC80590 ACT1Q4_MarkFlag52_6FC80590_113c (eax=pGame, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    if (k >= 1) {
      U32(STAGE_GAME + 0x10F4u) = STAGE_QUESTCTRL;
      U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
      U32(STAGE_QUEST0 + 0x00u) = (k == 1) ? 3u : 4u;
      U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    }
    c.eax = STAGE_GAME;
    ts[0] = STAGE_GAME;
    run_and_emit(0x6FC80590u, "ACT1Q4_MarkFlag52_6FC80590_113c", k,
                 k == 0 ? "no_questctrl" : k == 1 ? "wrong_qid" : "set_flag52", &c, ts, 1, 0u, 0);
  }

  /* [141] 0x6FC805C0 ACT1Q4_MarkFlag63_6FC805C0_113c (eax=pGame, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    if (k >= 1) {
      U32(STAGE_GAME + 0x10F4u) = STAGE_QUESTCTRL;
      U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
      U32(STAGE_QUEST0 + 0x00u) = (k == 1) ? 5u : 4u;
      U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    }
    c.eax = STAGE_GAME;
    ts[0] = STAGE_GAME;
    run_and_emit(0x6FC805C0u, "ACT1Q4_MarkFlag63_6FC805C0_113c", k,
                 k == 0 ? "no_questctrl" : k == 1 ? "wrong_qid" : "set_flag63", &c, ts, 1, 0u, 0);
  }

  /* [142] 0x6FC82340 ACT1Q1_CompleteAkaraRespecReward_6FC82340_113c (eax=pPlayer, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U8(STAGE_GAME + 0x6Du) = (uint8_t)k; /* diff 0, 1, 2 */
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 1421u);
    uint32_t pRec = STAGE_QBITS0 + (uint32_t)k * 8u;
    U32(pRec + 0x00u) = STAGE_QBITS0 + 0x20u + (uint32_t)k * 0x60u;
    U32(pRec + 0x04u) = 0x60u;
    U32(STAGE_UDATA0 + 0x10u + (uint32_t)k * 4u) = pRec;
    c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FC82340u, "ACT1Q1_CompleteAkaraRespecReward_6FC82340_113c", k,
                 k == 0 ? "diff_norm" : k == 1 ? "diff_nm" : "diff_hell", &c, ts, 2, 0u, 0);
  }

  /* [143] 0x6FC81420 ACT1Q4_RemovePlayerFromCainPortalGuidList_6FC81420_113c (eax=pGame, edx=pPlayer, tail-call ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_GAME + 0x10F4u) = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u) = 4u;
    U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 66u, 1u, 5000u, 5000u, 1431u);
    uint32_t pList = STAGE_QUESTEX0 + 0xB4u;
    U32(pList + 0x00u) = 66u;
    U32(pList + 0x04u) = 77u;
    U16(pList + 0x80u) = (k == 0) ? 0u : 2u;
    uint32_t pPlr = (k == 1) ? 0u : STAGE_UNIT0;
    c.eax = STAGE_GAME; c.edx = pPlr;
    ts[0] = STAGE_GAME; ts[1] = pPlr;
    run_and_emit(0x6FC81420u, "ACT1Q4_RemovePlayerFromCainPortalGuidList_6FC81420_113c", k,
                 k == 0 ? "empty_list" : k == 1 ? "null_plr" : "remove_guid66", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [144] 0x6FC82170 QUESTS_Callback11_RemovePlayerFromQuestAndExGuidLists_6FC82170_113c (ecx=pQuest, edx=pQuestArg, tail-call ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 33u, 1u, 5000u, 5000u, 1441u);
    U32(STAGE_QUEST0 + 0x1Cu) = 33u;
    U16(STAGE_QUEST0 + 0x1Cu + 0x80u) = (k >= 1) ? 1u : 0u;
    U32(STAGE_QUESTEX0 + 0x00u) = 33u;
    U16(STAGE_QUESTEX0 + 0x80u) = (k == 2) ? 1u : 0u;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FC82170u, "QUESTS_Callback11_RemovePlayerFromQuestAndExGuidLists_6FC82170_113c", k,
                 k == 0 ? "both_empty" : k == 1 ? "only_q_list" : "both_lists_remove33", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [145] 0x6FC816F0 ACT1Q4_SetCainRescuedByPartyCallback_6FC816F0_113c (ecx=pGame, edx=pPlayer, stack=[pArg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0 ? 40u : 1u)); /* Act 1 vs Act 0 */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 1451u);
    uint32_t pRec = STAGE_QBITS0;
    U32(pRec + 0x00u) = STAGE_QBITS0 + 0x10u;
    U32(pRec + 0x04u) = 0x60u;
    U32(STAGE_UDATA0 + 0x10u) = pRec;
    if (k == 1) {
      U8(STAGE_QBITS0 + 0x10u + (4u * 2u)) = 0x02u; /* bit 1 already set */
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC816F0u, "ACT1Q4_SetCainRescuedByPartyCallback_6FC816F0_113c", k,
                 k == 0 ? "act2_skip" : k == 1 ? "bit1_done_skip" : "act1_sets_bit4", &c, ts, 3, 0u, 0);
  }

  /* [146] 0x6FC81C00 ACT1Q5_Callback14_PlayerJoinedWithMalus_6FC81C00_113c (ecx=pQuest, edx=pQuestArg, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 1461u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, (k == 0 ? g_item_ring : g_item_malus), 10u, 0u, 0u, 0u, 1462u);
    attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 0u, 0u);
    U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    U8(STAGE_QUEST0 + 0x09u)  = 1u; /* bActive */
    U8(STAGE_QUEST0 + 0x0Cu)  = 1u; /* != 5 */
    U32(STAGE_QUESTEX0 + 0x9Cu) = (k == 1) ? 1u : 0u; /* nMalusCount: 1->2 vs 0->1 */
    U8(STAGE_QUESTEX0 + 0x01u)  = 1u;
    U32(STAGE_QUESTEX0 + 0x98u) = 2u;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    run_and_emit(0x6FC81C00u, "ACT1Q5_Callback14_PlayerJoinedWithMalus_6FC81C00_113c", k,
                 k == 0 ? "no_malus" : k == 1 ? "second_malus_inc_only" : "first_malus_sets_0b_2", &c, ts, 2, 0u, 0);
  }

  /* [147] 0x6FC81500 ACT1Q4_SetTristramEnteredQuestStateCallback_6FC81500_113c (ecx=pGame, edx=pPlayer, stack=[pArg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0 ? 1u : 0x27u));
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 1471u);
    U8(STAGE_GAME + 0x6Du) = (k == 2) ? 1u : 0u;
    uint32_t pRec = STAGE_QBITS0;
    U32(pRec + 0x00u) = STAGE_QBITS0 + 0x10u;
    U32(pRec + 0x04u) = 0x60u;
    U32(STAGE_UDATA0 + 0x10u + (uint32_t)(k == 2 ? 4u : 0u)) = pRec;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC81500u, "ACT1Q4_SetTristramEnteredQuestStateCallback_6FC81500_113c", k,
                 k == 0 ? "lvl1_noop" : k == 1 ? "tristram_norm" : "tristram_nm", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [148] 0x6FC81B20 ACT1Q5_CheckPlayerHasHoradricMalusCallback_6FC81B20_113c (ecx=pGame, edx=pPlayer, stack=[pArg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 1481u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, (k == 0 ? g_item_ring : g_item_malus), 10u, 0u, 0u, 0u, 1482u);
    attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 0u, 0u);
    if (k == 2) {
      U32(STAGE_GAME + 0x10F4u) = STAGE_QUESTCTRL;
      U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
      U32(STAGE_QUEST0 + 0x00u) = 3u;
      U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC81B20u, "ACT1Q5_CheckPlayerHasHoradricMalusCallback_6FC81B20_113c", k,
                 k == 0 ? "no_malus" : k == 1 ? "has_malus_no_q3" : "has_malus_mark_a0", &c, ts, 3, 0u, 0);
  }

  /* [149] 0x6FC78BA0 ACT5Q6_SyncPlayerQuest28State0EAlert24_6FC78BA0_113c (ecx=pGame, edx=pPlayer, stack=[pArg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 1491u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    uint32_t pRec = STAGE_QBITS0;
    U32(pRec + 0x00u) = STAGE_QBITS0 + 0x10u;
    U32(pRec + 0x04u) = 0x60u;
    U32(STAGE_UDATA0 + 0x10u) = pRec;
    if (k == 0) {
      /* Quest 0x28 bit 0 already set -> skip */
      U8(STAGE_QBITS0 + 0x10u + (0x28u * 2u)) = 0x01u;
    } else if (k == 2) {
      U32(STAGE_UDATA0 + 0x9Cu) = 0u; /* null client still sets bit 0x0E */
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC78BA0u, "ACT5Q6_SyncPlayerQuest28State0EAlert24_6FC78BA0_113c", k,
                 k == 0 ? "already_completed" : k == 1 ? "set_0e_and_alert" : "set_0e_null_client", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [150] 0x6FC79180 ACT5Q3_SendQuest21State20Packet5D_6FC79180_113c (ecx=pPlayer, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 1 ? 1u : 0u), 0u, 1u, 1u, 5000u, 5000u, 1501u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    uint32_t pPlr = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = pPlr;
    ts[0] = pPlr;
    run_and_emit(0x6FC79180u, "ACT5Q3_SendQuest21State20Packet5D_6FC79180_113c", k,
                 k == 0 ? "null_plr" : k == 1 ? "non_player" : "send_pkt5d", &c, ts, 1, 0u, 0);
  }
}

int main(int argc, char **argv) {
  const char *imgPath = (argc > 1) ? argv[1] : "d2game-datatbls-113c.img";
  const char *outPath = (argc > 2) ? argv[2] : "k6-w5-d2game-vectors.ndjson";

  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  AddVectoredExceptionHandler(1, k6_veh);

  void *pTbls  = VirtualAlloc((void *)DATATBLS_BASE, DATATBLS_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pStage = VirtualAlloc((void *)STAGE_BASE, STAGE_TOTAL_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pHeap  = VirtualAlloc((void *)HEAP_BASE, HEAP_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if ((uintptr_t)pTbls != DATATBLS_BASE || (uintptr_t)pStage != STAGE_BASE || (uintptr_t)pHeap != HEAP_BASE) {
    fprintf(stderr, "[k6-w5] VirtualAlloc failed (%p %p %p)\n", pTbls, pStage, pHeap);
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
    fprintf(stderr, "[k6-w5] LoadLibraryA failed (%p %p %p %p %p %p %p)\n",
            (void *)hStorm, (void *)g_hFog, (void *)hLang, (void *)hCmp,
            (void *)g_hCom, (void *)hNet, (void *)g_hGame);
    fflush(stderr);
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-w5] unexpected D2Common rebase: %p\n", (void *)g_hCom);
    fflush(stderr);
    return 3;
  }

  /* Initialize Fog bitmasks & system tables before installing deterministic alloc/assert hooks */
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
  fn_AllocInventory        = (Com_AllocInventory_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10387));
  fn_SetCursorItem         = (Com_SetCursorItem_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10466));
  fn_PlaceItemInBodyLoc    = (Com_PlaceItemInBodyLoc_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11041));
  fn_CheckItemTypeId       = (Com_CheckItemTypeId_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10744));
  fn_UnitsIsDoor           = (Com_UnitsIsDoor_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11020));
  fn_HasObjectSubClassBit0 = (Com_HasObjectSubClassBit0_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10934));
  fn_CheckCompactSave      = (Com_CheckCompactSave_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11064));
  fn_GetItemType           = (Com_GetItemType_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11088));

  if (!fn_CreateStatListEx || !fn_SetUnitStat || !fn_AllocStatList || !fn_SetStatIfValid ||
      !fn_SetStatListState || !fn_MergeStatLists || !fn_ToggleGfxState || !fn_AllocSkillList ||
      !fn_SetSkillLevel || !fn_AllocInventory || !fn_SetCursorItem || !fn_PlaceItemInBodyLoc ||
      !fn_CheckItemTypeId || !fn_UnitsIsDoor || !fn_HasObjectSubClassBit0 ||
      !fn_CheckCompactSave || !fn_GetItemType) {
    fprintf(stderr, "[k6-w5] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-w5] failed to open %s for writing\n", outPath);
    return 5;
  }

  emit_batch_1_to_50();
  emit_batch_51_to_100();
  emit_batch_101_to_150();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-w5] emitted %u vectors across 150 D2Game.dll VAs\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
