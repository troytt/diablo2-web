/*
 * k6-w11-d2game-emitter.c — Milestone #37 [K6] Wave 11 Real-DLL Differential Emitter (Lo-VA Part 3)
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
#define STAGE_QBITS1      (STAGE_BASE + 0x7E00u) /* 0x0200: secondary quest/intro bit buffers */
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
typedef int32_t(__stdcall *Com_GetItemType_t)(void *pUnit);

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

/* Discovered real v1.13c item/missile/monster IDs */
static uint32_t g_item_ring   = 0;
static uint32_t g_item_malus  = 0; /* "hdm " Horadric Malus */
static uint32_t g_item_potion = 0; /* "ice " Malah's Potion */
static uint32_t g_item_sword  = 0; /* "ssd " Short Sword (weapon with durability) */
static uint32_t g_item_armor  = 0; /* "cap " Cap */
static uint32_t g_item_gold   = 0; /* "gld " Gold */
static uint32_t g_item_ear    = 0; /* "ear " Ear (type 7) */
static uint32_t g_item_tome   = 0; /* "tbk " Tome of Town Portal (type 18) */
static uint32_t g_item_scroll = 0; /* "tsc " Scroll of Town Portal (type 22) */
static uint32_t g_item_charm  = 0; /* "cm1 " Small Charm (type 13? or discovered by type) */
static uint32_t g_item_type13 = 0;
static uint32_t g_item_type40 = 0;
static uint32_t g_item_throw  = 0; /* "jav " Javelin (throwing weapon) */
static uint32_t g_item_wand   = 0; /* "wnd " Wand (staffmods) */
static uint32_t g_item_bkd    = 0; /* "bkd " Scroll of Inifuss (Act1Q4) */

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
              "[k6-w11] SETUP/INIT FAULT after %u emitted: code=0x%08lX eip=%p (game=0x%08lX com=0x%08lX) addr=0x%08X\n",
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
      fprintf(stderr, "[k6-w11] setup bump overflow (size=%u)\n", dwSize);
      TerminateProcess(GetCurrentProcess(), 21);
    }
    memset((void *)(uintptr_t)p, 0, dwSize);
    g_setup_top = p + dwSize;
    record_alloc_size(p, dwSize);
    return (void *)(uintptr_t)p;
  } else {
    uint32_t p = (g_heap_top + 3u) & ~3u;
    if (p + dwSize > HEAP_BASE + HEAP_SIZE) {
      fprintf(stderr, "[k6-w11] heap bump overflow (size=%u)\n", dwSize);
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
      fprintf(stderr, "[k6-w11] missing Fog.#%u\n", hooks[i].ord);
      TerminateProcess(GetCurrentProcess(), 23);
    }
    hook_module_iat_ptr(g_hCom, orig, hooks[i].fn);
    hook_module_iat_ptr(g_hGame, orig, hooks[i].fn);
  }
}

/* ------------------------------- PAGEIMG Loader */

static void load_datatbls_img(const char *imgPath) {
  FILE *fp = fopen(imgPath, "rb");
  if (!fp) {
    fprintf(stderr, "[k6-w11] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-w11] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(0x6FDE9000u + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-w11] short read at page %u\n", i);
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
      fprintf(stderr, "[k6-w11] JSON buffer overflow\n");
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
  for (uint32_t i = 0; i < 24u; i++) {
    U32(pChunk + i * 0x30u + 0x1Cu) = pChunk + (i + 1u) * 0x30u;
  }
  U32(pChunk + 0x7080u) = pChunk;
  U32(pTimer + 0xA1Cu)  = pChunk;
  U32(STAGE_GAME + 0xB8u) = pTimer;
  return pTimer;
}

static void stage_mon_txt(uint32_t pUData, uint32_t classId) {
  uint32_t sgpt = U32(0x6FDE9E1Cu + g_com_rebase);
  uint32_t pMonStats = U32(sgpt + 0xA78u);
  uint32_t nMonStats = U32(sgpt + 0xA80u);
  if (pMonStats != 0u && classId < nMonStats) {
    U32(pUData + 0x00u) = pMonStats + classId * 0x1A8u;
  }
}

static void stage_room(uint32_t pRoom, uint32_t pRoomEx, uint32_t pLevel, uint32_t levelId) {
  uint32_t pAct = (pRoom == STAGE_ROOM1) ? STAGE_ACT1 : STAGE_ACT0;
  U32(pAct + 0x08u)     = 1u;
  U32(pAct + 0x10u)     = pRoom;
  U32(pAct + 0x48u)     = STAGE_DRLG0;
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
  U32(pItemData + 0x5Cu) = pInv;
  U32(pItemData + 0x60u) = 0u;
  U32(pItemData + 0x64u) = oldFirst;
  U8(pItemData + 0x69u)  = nodePosOther;
  if (oldFirst != 0u) {
    U32(U32(oldFirst + 0x14u) + 0x60u) = pItem;
  } else {
    U32(pInv + 0x10u) = pItem;
  }
  U32(pInv + 0x0Cu) = pItem;
  U32(pInv + 0x14u) = U32(pInv + 0x14u) + 1u;
}

static void stage_player_qbits(uint32_t pUData, uint32_t pRecBase, uint32_t diffIdx) {
  U32(pRecBase + 0x00u) = pRecBase + 0x10u;
  U32(pRecBase + 0x04u) = 0x60u;
  U32(pUData + 0x10u + diffIdx * 4u) = pRecBase;
}

static void set_qbit(uint32_t pRecBase, uint32_t questIdx, uint32_t bitIdx) {
  uint32_t absBit = questIdx * 16u + bitIdx;
  uint32_t byteAddr = (pRecBase + 0x10u) + (absBit >> 3);
  U8(byteAddr) = (uint8_t)(U8(byteAddr) | (1u << (absBit & 7u)));
}

static void stage_item_defaults(uint32_t pUData, uint16_t fmt, uint32_t ilvl, uint32_t seedLo) {
  U32(pUData + 0x00u) = 4u;
  U32(pUData + 0x04u) = seedLo;
  U32(pUData + 0x08u) = 0x0000029Au;
  U32(pUData + 0x0Cu) = seedLo;
  U32(pUData + 0x2Cu) = ilvl;
  U16(pUData + 0x30u) = fmt;
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
            "[k6-w11] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }

  if (expectAssert && g_thunk_faulted != 2) {
    fprintf(stderr, "[k6-w11] EXPECTED ASSERT did not fire at %s (0x%08X) case %d (%s)\n",
            fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!expectAssert && g_thunk_faulted == 2) {
    fprintf(stderr, "[k6-w11] UNEXPECTED Fog.#10024 assert line %u at %s (0x%08X) case %d (%s)\n",
            g_assert_line, fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 32);
  }

  if (g_thunk_faulted == 0) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-w11] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
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
  uint32_t nItems = U32(0x6FDEFB94u + g_com_rebase);
  uint32_t pItems = U32(0x6FDEFB98u + g_com_rebase);

  U32(STAGE_UNIT2 + 0x00u) = 4u;
  U32(STAGE_UNIT2 + 0x14u) = STAGE_UDATA2;
  for (uint32_t id = 0; id < nItems; id++) {
    U32(STAGE_UNIT2 + 0x04u) = id;
    uint32_t code = U32(pItems + id * 0x1A8u + 0x80u);
    int32_t itype = fn_GetItemType((void *)(uintptr_t)STAGE_UNIT2);
    if (!g_item_malus  && code == 0x206D6468u) g_item_malus  = id; /* "hdm " */
    if (!g_item_potion && code == 0x20656369u) g_item_potion = id; /* "ice " */
    if (!g_item_sword  && code == 0x20647373u) g_item_sword  = id; /* "ssd " */
    if (!g_item_armor  && code == 0x20706163u) g_item_armor  = id; /* "cap " */
    if (!g_item_gold   && code == 0x20646C67u) g_item_gold   = id; /* "gld " */
    if (!g_item_ear    && code == 0x20726165u) g_item_ear    = id; /* "ear " */
    if (!g_item_tome   && code == 0x206B6274u) g_item_tome   = id; /* "tbk " */
    if (!g_item_scroll && code == 0x20637374u) g_item_scroll = id; /* "tsc " */
    if (!g_item_charm  && code == 0x20316D63u) g_item_charm  = id; /* "cm1 " */
    if (!g_item_throw  && code == 0x2076616Au) g_item_throw  = id; /* "jav " */
    if (!g_item_wand   && code == 0x20646E77u) g_item_wand   = id; /* "wnd " */
    if (!g_item_bkd    && code == 0x20646B62u) g_item_bkd    = id; /* "bkd " */
    if (!g_item_type13 && itype == 13)         g_item_type13 = id;
    if (!g_item_type40 && itype == 40)         g_item_type40 = id;
    if (!g_item_ring   && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x0A)) g_item_ring = id;
  }
}

/* ------------------------------- Batch 1: VAs 1..38 (Quests + Party/Player/Client + Items/NPCs) */

static void emit_batch_1(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [1] 0x6FC7D080 ACT5Q5_DestroyAllPlayerPortalsInArreatSummit_6FC7D080_113c (edi=pGame, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 101u + (uint32_t)k);
      if (k == 1) {
        U32(STAGE_UNIT0 + 0x14u) = 0u; /* null pPlayerData -> asserts 0x24f */
      } else {
        U32(STAGE_UDATA0 + 0x48u) = 77u; /* non-existent portal guid -> returns cleanly */
      }
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    c.edi = STAGE_GAME;
    ts[0] = STAGE_GAME;
    run_and_emit(0x6FC7D080u, "ACT5Q5_DestroyAllPlayerPortalsInArreatSummit_6FC7D080_113c", k,
                 k == 0 ? "no_players_noop" : k == 1 ? "null_playerdata_assert_24f" : "player_no_portal_noop",
                 &c, ts, 1, 0u, (k == 1 ? 1 : 0));
  }

  /* [2] 0x6FC88250 ACT1Q4_TimerRefreshCainMonsterState_6FC88250_113c (edx=pQuestData, ret, u8=1) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    U32(STAGE_QUEST0 + 0x04u) = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    U8(STAGE_QUESTEX0 + 0x46u) = (uint8_t)(k + 1);
    if (k == 2) {
      /* Stage Cain (classId=0x92) with active interact node so 0x6FC88150 closes interaction */
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x92u, 10u, 1u, 5000u, 5000u, 201u);
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 202u);
      U32(STAGE_UDATA1 + 0x9Cu) = STAGE_CLIENT;
      U32(STAGE_UNIT1 + 0x68u)  = 10u; /* interacting with Cain */
      U8(STAGE_UNIT1 + 0x6Cu)   = 1u;
      U32(STAGE_SCRATCH + 0x00u) = STAGE_SCRATCH + 0x10u; /* pMonInteract->pFirst */
      U32(STAGE_SCRATCH + 0x10u) = STAGE_UNIT1;           /* pNode->pPlayer */
      U32(STAGE_SCRATCH + 0x18u) = 0u;                    /* pNode->pNext */
      U32(STAGE_UDATA0 + 0x30u)  = STAGE_SCRATCH;         /* pMonData->pInteract */
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    } else if (k == 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 10u, 1u, 5000u, 5000u, 203u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    c.edx = STAGE_QUEST0;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC88250u, "ACT1Q4_TimerRefreshCainMonsterState_6FC88250_113c", k,
                 k == 0 ? "no_monsters_clears_46" : k == 1 ? "non_cain_clears_46" : "cain_with_interact_clears_46",
                 &c, ts, 1, 0xFFu, 0);
  }

  /* [3] 0x6FC88150 ACT1Q4_OnCainModeOrInteract_6FC88150_113c (ecx=pGame, edx=pUnit, stack=[arg4], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t uArg = 0u;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, (k == 1 ? 1u : 0x92u), 10u, 1u, 5000u, 5000u, 301u);
      uArg = STAGE_UNIT0;
      if (k == 2) {
        stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 302u);
        U32(STAGE_UDATA1 + 0x9Cu) = STAGE_CLIENT;
        U32(STAGE_UNIT1 + 0x68u)  = 10u;
        U8(STAGE_UNIT1 + 0x6Cu)   = 1u;
        U32(STAGE_SCRATCH + 0x00u) = STAGE_SCRATCH + 0x10u;
        U32(STAGE_SCRATCH + 0x10u) = STAGE_UNIT1;
        U32(STAGE_UDATA0 + 0x30u)  = STAGE_SCRATCH;
        insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      }
    }
    c.ecx = STAGE_GAME; c.edx = uArg; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = uArg; ts[2] = 0;
    run_and_emit(0x6FC88150u, "ACT1Q4_OnCainModeOrInteract_6FC88150_113c", k,
                 k == 0 ? "null_unit_0" : k == 1 ? "non_cain_0" : "cain_active_interact_1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [4] 0x6FC83570 ACT1Q4_OnQuestActivatedUpdatePlayers_6FC83570_113c (ecx=pQuestData, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u)    = 4u;
    U32(STAGE_QUEST0 + 0x04u)    = STAGE_GAME;
    U8(STAGE_QUEST0 + 0x09u)     = (k == 0) ? 0u : 1u;
    U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 401u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    if (k == 2) set_qbit(STAGE_QBITS0, 4u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    c.ecx = STAGE_QUEST0;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC83570u, "ACT1Q4_OnQuestActivatedUpdatePlayers_6FC83570_113c", k,
                 k == 0 ? "flag09_zero_skip" : k == 1 ? "active_updates_player" : "completed_player_path",
                 &c, ts, 1, 0u, 0);
  }

  /* [5] 0x6FC83A80 ACT1Q2_TimerPromoteState3_6FC83A80_113c (edx=pQuestData, ret, u8=1) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u)    = 2u;
    U32(STAGE_QUEST0 + 0x04u)    = STAGE_GAME;
    U8(STAGE_QUEST0 + 0x0Bu)     = 1u;
    U8(STAGE_QUEST0 + 0x14u)     = 5u;
    U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 501u);
      U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
      stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
      if (k == 2) set_qbit(STAGE_QBITS0, 2u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    c.edx = STAGE_QUEST0;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC83A80u, "ACT1Q2_TimerPromoteState3_6FC83A80_113c", k,
                 k == 0 ? "no_players" : k == 1 ? "active_player_sends_5d" : "completed_player_skip_5d",
                 &c, ts, 1, 0xFFu, 0);
  }

  /* [6] 0x6FC83210 ACT1Q5_TimerPromoteState0D_6FC83210_113c (edx=pQuestData, ret, u8=1) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u)    = 5u;
    U32(STAGE_QUEST0 + 0x04u)    = STAGE_GAME;
    U8(STAGE_QUEST0 + 0x0Bu)     = 2u;
    U8(STAGE_QUEST0 + 0x0Cu)     = (k == 0) ? 1u : 5u;
    U8(STAGE_QUEST0 + 0x14u)     = 4u;
    U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
    U8(STAGE_QUESTEX0 + 0x11Cu)  = 1u;
    if (k == 2) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 1001u);
      U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
      stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    c.edx = STAGE_QUEST0;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC83210u, "ACT1Q5_TimerPromoteState0D_6FC83210_113c", k,
                 k == 0 ? "state_not_5_clear_11c" : k == 1 ? "state5_no_players" : "state5_sends_5d",
                 &c, ts, 1, 0xFFu, 0);
  }

  /* [11] 0x6FC83B50 ACT1Q1_TimerPromoteState5_6FC83B50_113c (edx=pQuestData, ret, u8=1) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u)    = 1u;
    U32(STAGE_QUEST0 + 0x04u)    = STAGE_GAME;
    U8(STAGE_QUEST0 + 0x0Bu)     = 2u;
    U8(STAGE_QUEST0 + 0x0Cu)     = (k == 0) ? 1u : 4u;
    U8(STAGE_QUEST0 + 0x14u)     = 3u;
    U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
    U8(STAGE_QUESTEX0 + 0x87u)   = 1u;
    if (k == 2) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 1101u);
      U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
      stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    c.edx = STAGE_QUEST0;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC83B50u, "ACT1Q1_TimerPromoteState5_6FC83B50_113c", k,
                 k == 0 ? "state_not_4_clear_87" : k == 1 ? "state4_no_players" : "state4_sends_5d",
                 &c, ts, 1, 0xFFu, 0);
  }

  /* [12] 0x6FC79CD0 ACT5Q4_TimerPromoteState4_6FC79CD0_113c (edx=pQuestData, ret, u8=1) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u)    = 0x22u;
    U32(STAGE_QUEST0 + 0x04u)    = STAGE_GAME;
    U8(STAGE_QUEST0 + 0x08u)     = 4u;
    U8(STAGE_QUEST0 + 0x0Bu)     = (k == 0) ? 4u : 2u;
    U8(STAGE_QUEST0 + 0x14u)     = 3u;
    U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
    U8(STAGE_QUESTEX0 + 0x85u)   = 1u;
    if (k == 2) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 1201u);
      U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
      stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    c.edx = STAGE_QUEST0;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC79CD0u, "ACT5Q4_TimerPromoteState4_6FC79CD0_113c", k,
                 k == 0 ? "already_state4" : k == 1 ? "promote_no_players" : "promote_sends_5d",
                 &c, ts, 1, 0xFFu, 0);
  }

  /* [13] 0x6FC836C0 ACT1Q5_DecrementCounterAndCheckState3_6FC836C0_113c (ecx=pQuestData, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u)    = 3u;
    U32(STAGE_QUEST0 + 0x04u)    = STAGE_GAME;
    U8(STAGE_QUEST0 + 0x09u)     = (k == 0) ? 0u : 1u;
    U8(STAGE_QUEST0 + 0x0Bu)     = 1u;
    U8(STAGE_QUEST0 + 0x0Cu)     = 2u;
    U8(STAGE_QUEST0 + 0x14u)     = 4u;
    U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
    U8(STAGE_QUESTEX0 + 0x01u)   = 1u;
    U32(STAGE_QUESTEX0 + 0x98u)  = 2u;
    U32(STAGE_QUESTEX0 + 0x9Cu)  = (k == 1) ? 3u : 1u;
    if (k == 2) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 1301u);
      U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
      stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    c.ecx = STAGE_QUEST0;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC836C0u, "ACT1Q5_DecrementCounterAndCheckState3_6FC836C0_113c", k,
                 k == 0 ? "inactive_noop" : k == 1 ? "decrement_3_to_2" : "hits_0_promotes_and_alerts",
                 &c, ts, 1, 0u, 0);
  }

  /* [14] 0x6FC79C50 ACT5Q4_OnHallsEnteredPromoteState3_6FC79C50_113c (eax=pGame, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    if (k >= 1) {
      U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
      U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
      U32(STAGE_QUEST0 + 0x00u)    = 0x22u;
      U32(STAGE_QUEST0 + 0x04u)    = STAGE_GAME;
      U8(STAGE_QUEST0 + 0x08u)     = 4u;
      U8(STAGE_QUEST0 + 0x09u)     = 1u;
      U8(STAGE_QUEST0 + 0x0Bu)     = (k == 1) ? 3u : 1u;
      U8(STAGE_QUEST0 + 0x14u)     = 2u;
      U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
      if (k == 2) {
        stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 1401u);
        U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
        stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
        insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      }
    }
    c.eax = STAGE_GAME;
    ts[0] = STAGE_GAME;
    run_and_emit(0x6FC79C50u, "ACT5Q4_OnHallsEnteredPromoteState3_6FC79C50_113c", k,
                 k == 0 ? "no_quest_ctrl" : k == 1 ? "already_state3" : "promotes_state3_and_alerts",
                 &c, ts, 1, 0u, 0);
  }

  /* [15] 0x6FC79F80 ACT5Q3_OnFrozenRiverEnteredPromoteState2_6FC79F80_113c (eax=pGame, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    if (k >= 1) {
      U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
      U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
      U32(STAGE_QUEST0 + 0x00u)    = 0x21u;
      U32(STAGE_QUEST0 + 0x04u)    = STAGE_GAME;
      U8(STAGE_QUEST0 + 0x08u)     = 4u;
      U8(STAGE_QUEST0 + 0x09u)     = 1u;
      U8(STAGE_QUEST0 + 0x0Bu)     = (k == 1) ? 2u : 1u;
      U8(STAGE_QUEST0 + 0x14u)     = 2u;
      U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
      if (k == 2) {
        stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 1501u);
        U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
        stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
        insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      }
    }
    c.eax = STAGE_GAME;
    ts[0] = STAGE_GAME;
    run_and_emit(0x6FC79F80u, "ACT5Q3_OnFrozenRiverEnteredPromoteState2_6FC79F80_113c", k,
                 k == 0 ? "no_quest_ctrl" : k == 1 ? "already_state2" : "promotes_state2_and_alerts",
                 &c, ts, 1, 0u, 0);
  }

  /* [16] 0x6FC798B0 ACT5Q6_OnWorldstoneChamberEntered_6FC798B0_113c (eax=pGame, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    if (k >= 1) {
      U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
      U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
      U32(STAGE_QUEST0 + 0x00u)    = 0x24u;
      U32(STAGE_QUEST0 + 0x04u)    = STAGE_GAME;
      U8(STAGE_QUEST0 + 0x08u)     = 4u;
      U8(STAGE_QUEST0 + 0x09u)     = (k == 1) ? 0u : 1u;
      U8(STAGE_QUEST0 + 0x0Bu)     = 1u;
      U8(STAGE_QUEST0 + 0x14u)     = 2u;
      U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
      if (k == 2) {
        stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 1601u);
        U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
        stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
        insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      }
    }
    c.eax = STAGE_GAME;
    ts[0] = STAGE_GAME;
    run_and_emit(0x6FC798B0u, "ACT5Q6_OnWorldstoneChamberEntered_6FC798B0_113c", k,
                 k == 0 ? "no_quest_ctrl" : k == 1 ? "sets_flag86_only" : "sets_flag86_promotes_and_alerts",
                 &c, ts, 1, 0u, 0);
  }

  /* [17] 0x6FC7B030 ACT5Q3_CheckPlayerOrPartyHasMalahPotion_6FC7B030_113c (eax=pPlayer, stack=[pQuestArg], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 1701u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 2u, 1u, 5000u, 5000u, 1702u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_potion, 99u, 0u, 5000u, 5000u, 1703u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);

    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u)    = 0x21u;
    U32(STAGE_QUEST0 + 0x04u)    = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;

    if (k == 0) {
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT2, 0u, 0u, 0u);
    } else if (k >= 2) {
      uint32_t pParty = STAGE_PARTYCTRL + 0x20u;
      uint32_t pMem0  = STAGE_PARTYCTRL + 0x40u;
      uint32_t pMem1  = STAGE_PARTYCTRL + 0x50u;
      U32(STAGE_GAME + 0x1D2Cu)    = STAGE_PARTYCTRL;
      U32(STAGE_PARTYCTRL + 0x04u) = pParty;
      U16(pParty + 0x00u)          = 3u;
      U32(pParty + 0x04u)          = pMem0;
      U32(pMem0 + 0x00u)           = 1u;
      U32(pMem0 + 0x04u)           = pMem1;
      U32(pMem1 + 0x00u)           = 2u;
      if (k == 2) attach_inv_item_raw(STAGE_UNIT1, STAGE_UNIT2, 0u, 0u, 0u);
    }
    c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_QUEST0; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_QUEST0;
    run_and_emit(0x6FC7B030u, "ACT5Q3_CheckPlayerOrPartyHasMalahPotion_6FC7B030_113c", k,
                 k == 0 ? "self_has_potion_1" : k == 1 ? "no_party_no_potion_0" : k == 2 ? "party_member_has_potion_1" : "party_none_has_potion_0",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [18] 0x6FC7A200 ACT5Q2_PromoteState5IfPrisonersRemaining_6FC7A200_113c (eax=pGame, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u)    = 0x20u;
    U32(STAGE_QUEST0 + 0x04u)    = STAGE_GAME;
    U8(STAGE_QUEST0 + 0x08u)     = 4u;
    U8(STAGE_QUEST0 + 0x09u)     = 1u;
    U8(STAGE_QUEST0 + 0x0Bu)     = 1u;
    U8(STAGE_QUEST0 + 0x14u)     = 2u;
    U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
    U32(STAGE_QUESTEX0 + 0xA8u)  = (k == 0) ? 5u : 2u;
    if (k == 2) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 1801u);
      U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
      stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    c.eax = STAGE_GAME;
    ts[0] = STAGE_GAME;
    run_and_emit(0x6FC7A200u, "ACT5Q2_PromoteState5IfPrisonersRemaining_6FC7A200_113c", k,
                 k == 0 ? "all_5_saved_skip" : k == 1 ? "promotes_no_players" : "promotes_and_alerts",
                 &c, ts, 1, 0u, 0);
  }

  /* [19] 0x6FC7CFF0 ACT5Q4_DestroyPlayerPortalIfInArreatSummit_6FC7CFF0_113c (ecx=pGame, edx=pPlayer, stack=[unused], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 1901u);
    uint32_t gArg = (k == 2) ? 0u : STAGE_GAME;
    uint32_t pArg = (k == 0) ? 0u : STAGE_UNIT0;
    if (k == 1) U32(STAGE_UNIT0 + 0x14u) = 0u;
    if (k == 3) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 0x3Bu, 55u, 1u, 5000u, 5000u, 1902u);
      U32(STAGE_UDATA0 + 0x48u) = 55u;
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    c.ecx = gArg; c.edx = pArg; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = gArg; ts[1] = pArg; ts[2] = 0;
    run_and_emit(0x6FC7CFF0u, "ACT5Q4_DestroyPlayerPortalIfInArreatSummit_6FC7CFF0_113c", k,
                 k == 0 ? "null_player_assert_24c" : k == 1 ? "null_pdata_assert_24f" : k == 2 ? "null_game_assert_2d3" : "portal_in_lvl109_kept",
                 &c, ts, 3, 0xFFFFFFFFu, (k < 3 ? 1 : 0));
  }

  /* [20] 0x6FC7A690 ACT5Q1_OnShenkSpottedPromoteState2_6FC7A690_113c (eax=pGame, edx=pUnit, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u)    = 0x1Fu;
    U32(STAGE_QUEST0 + 0x04u)    = STAGE_GAME;
    U8(STAGE_QUEST0 + 0x08u)     = 4u;
    U8(STAGE_QUEST0 + 0x09u)     = 1u;
    U8(STAGE_QUEST0 + 0x0Bu)     = 1u;
    U8(STAGE_QUEST0 + 0x14u)     = 2u;
    U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 10u, 1u, 5000u, 5000u, 2001u);
    U16(STAGE_UDATA1 + 0x26u) = (k == 0) ? 0x10u : 0x2Au; /* 0x2A = Shenk superunique */
    if (k == 2) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 2002u);
      U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
      stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    c.eax = STAGE_GAME; c.edx = STAGE_UNIT1;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT1;
    run_and_emit(0x6FC7A690u, "ACT5Q1_OnShenkSpottedPromoteState2_6FC7A690_113c", k,
                 k == 0 ? "non_shenk_skip" : k == 1 ? "shenk_no_players" : "shenk_promotes_and_alerts",
                 &c, ts, 2, 0u, 0);
  }

  /* [21] 0x6FC79EF0 ACT5Q3_OnFrozenAnyaSpawnedPromoteState2_6FC79EF0_113c (ecx=pQuestArg, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u)    = 0x21u;
    U32(STAGE_QUEST0 + 0x04u)    = STAGE_GAME;
    U8(STAGE_QUEST0 + 0x08u)     = 4u;
    U8(STAGE_QUEST0 + 0x09u)     = (k == 1) ? 0u : 1u;
    U8(STAGE_QUEST0 + 0x0Bu)     = 1u;
    U8(STAGE_QUEST0 + 0x14u)     = 2u;
    U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
    U32(STAGE_QUESTARG + 0x00u)  = STAGE_GAME;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, (k == 1 ? 0x77u : 0x88u), 1u, 5000u, 5000u, 2101u);
      U32(STAGE_QUESTARG + 0x04u) = STAGE_UNIT1;
    }
    if (k == 2) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 2102u);
      U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
      stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    c.ecx = STAGE_QUESTARG;
    ts[0] = STAGE_QUESTARG;
    run_and_emit(0x6FC79EF0u, "ACT5Q3_OnFrozenAnyaSpawnedPromoteState2_6FC79EF0_113c", k,
                 k == 0 ? "null_unit_ffff_promotes" : k == 1 ? "inactive_records_guid_77" : "active_records_88_and_alerts",
                 &c, ts, 1, 0u, 0);
  }

  /* [22] 0x6FC7A160 ACT5Q2_HasNearbySoldierPrisonDoorInMode12_6FC7A160_113c (eax=pPlayer, ecx=pGame, stack=[pFallback], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 111u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 0 ? 0u : STAGE_ROOM0), 0u, 0u, 1u, 1u, 5000u, 5000u, 2201u);
    if (k >= 1) {
      U32(STAGE_SCRATCH + 0x00u) = STAGE_ROOM0;
      U32(STAGE_ROOM0 + 0x00u)   = STAGE_SCRATCH;
      U32(STAGE_ROOM0 + 0x24u)   = 1u;
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x1B2u, 20u, (k == 1 ? 1u : 0x0Cu), 5000u, 5000u, 2202u);
      U32(STAGE_ROOM0 + 0x74u) = STAGE_UNIT1;
    }
    uint32_t pArg = STAGE_UNIT0;
    uint32_t fbArg = 0u;
    if (k == 3) {
      pArg = 0u;
      fbArg = STAGE_UNIT0;
    }
    c.eax = pArg; c.ecx = STAGE_GAME; c.nargs = 1; c.args[0] = fbArg; c.calleePop = 4u;
    ts[0] = pArg; ts[1] = STAGE_GAME; ts[2] = fbArg;
    run_and_emit(0x6FC7A160u, "ACT5Q2_HasNearbySoldierPrisonDoorInMode12_6FC7A160_113c", k,
                 k == 0 ? "null_room_0" : k == 1 ? "door_mode1_0" : k == 2 ? "door_mode12_1" : "fallback_unit_door_mode12_1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [23] 0x6FC79930 ACT5Q6_PromoteQuest24ToState1AndSync_6FC79930_113c (ecx=pQuestData, ret, u8=1) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u)    = 0x24u;
    U32(STAGE_QUEST0 + 0x04u)    = STAGE_GAME;
    U8(STAGE_QUEST0 + 0x08u)     = 4u;
    U8(STAGE_QUEST0 + 0x09u)     = 1u;
    U8(STAGE_QUEST0 + 0x0Bu)     = 0u;
    U8(STAGE_QUEST0 + 0x0Cu)     = (k == 0) ? 1u : 0u;
    U8(STAGE_QUEST0 + 0x14u)     = 3u;
    U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
    if (k == 2) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 2301u);
      U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
      stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    c.ecx = STAGE_QUEST0;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC79930u, "ACT5Q6_PromoteQuest24ToState1AndSync_6FC79930_113c", k,
                 k == 0 ? "last_state_nonzero_skip" : k == 1 ? "promotes_no_players" : "promotes_and_syncs_player",
                 &c, ts, 1, 0xFFu, 0);
  }

  /* [24] 0x6FC84B60 ACT1Q5_CheckPlayerOrPartyHasHoradricMalus_6FC84B60_113c (eax=pPlayer, stack=[pQuestArg], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 2401u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 2u, 1u, 5000u, 5000u, 2402u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_malus, 99u, 0u, 5000u, 5000u, 2403u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);

    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u)    = 5u;
    U32(STAGE_QUEST0 + 0x04u)    = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;

    if (k == 1) {
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT2, 0u, 0u, 0u);
    } else if (k == 3) {
      uint32_t pParty = STAGE_PARTYCTRL + 0x20u;
      uint32_t pMem0  = STAGE_PARTYCTRL + 0x40u;
      uint32_t pMem1  = STAGE_PARTYCTRL + 0x50u;
      U32(STAGE_GAME + 0x1D2Cu)    = STAGE_PARTYCTRL;
      U32(STAGE_PARTYCTRL + 0x04u) = pParty;
      U16(pParty + 0x00u)          = 2u;
      U32(pParty + 0x04u)          = pMem0;
      U32(pMem0 + 0x00u)           = 1u;
      U32(pMem0 + 0x04u)           = pMem1;
      U32(pMem1 + 0x00u)           = 2u;
      attach_inv_item_raw(STAGE_UNIT1, STAGE_UNIT2, 0u, 0u, 0u);
    }
    uint32_t pArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.eax = pArg; c.nargs = 1; c.args[0] = STAGE_QUEST0; c.calleePop = 4u;
    ts[0] = pArg; ts[1] = STAGE_QUEST0;
    run_and_emit(0x6FC84B60u, "ACT1Q5_CheckPlayerOrPartyHasHoradricMalus_6FC84B60_113c", k,
                 k == 0 ? "null_player_assert_a2a" : k == 1 ? "self_has_malus_1" : k == 2 ? "no_party_no_malus_0" : "party_has_malus_1",
                 &c, ts, 2, 0xFFFFFFFFu, (k == 0 ? 1 : 0));
  }

  /* [25] 0x6FCBBE40 PARTY_AllocPartyControl_6FCBBE40_113c (esi=pGame, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t gArg = (k == 0) ? 0u : STAGE_GAME;
    if (k == 1) U32(STAGE_GAME + 0x1D2Cu) = STAGE_PARTYCTRL;
    c.esi = gArg;
    ts[0] = gArg;
    run_and_emit(0x6FCBBE40u, "PARTY_AllocPartyControl_6FCBBE40_113c", k,
                 k == 0 ? "null_game_assert_18" : k == 1 ? "already_alloc_assert_19" : "allocs_8b_init_3",
                 &c, ts, 1, 0u, (k < 2 ? 1 : 0));
  }

  /* [26] 0x6FCBC7D0 PARTY_RemoveSubPartyById_6FCBC7D0_113c (eax=pGame, edi=wPartyId, ret, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    if (k >= 1) {
      uint32_t pP1 = STAGE_PARTYCTRL + 0x20u;
      uint32_t pP2 = STAGE_PARTYCTRL + 0x40u;
      U32(STAGE_GAME + 0x1D2Cu)    = STAGE_PARTYCTRL;
      U32(STAGE_PARTYCTRL + 0x04u) = pP1;
      U16(pP1 + 0x00u)             = 3u;
      U32(pP1 + 0x08u)             = pP2;
      U16(pP2 + 0x00u)             = 5u;
    }
    uint32_t pid = (k == 1) ? 3u : (k == 2) ? 5u : 9u;
    c.eax = STAGE_GAME; c.edi = pid;
    ts[0] = STAGE_GAME; ts[1] = pid;
    run_and_emit(0x6FCBC7D0u, "PARTY_RemoveSubPartyById_6FCBC7D0_113c", k,
                 k == 0 ? "null_ctrl_assert_b4" : k == 1 ? "unlink_head_3" : k == 2 ? "unlink_tail_5" : "missing_id_9",
                 &c, ts, 2, 0u, (k == 0 ? 1 : 0));
  }

  /* [27] 0x6FC4C060 CLIENTS_CollectAndFlushNearbyPlayerPositions_6FC4C060_113c (eax=pClient, ret, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_ROOM0;
    U32(STAGE_ROOM0 + 0x00u)   = STAGE_SCRATCH;
    U32(STAGE_ROOM0 + 0x24u)   = 1u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 1 ? 1u : 0u), 0u, 1u, 1u, 5000u, 5000u, 2701u);
    U8(STAGE_CLIENT + 0x3D4u)  = 1u;
    U32(STAGE_CLIENT + 0x174u) = STAGE_UNIT0;
    U32(STAGE_CLIENT + 0x1B0u) = 15u;
    U32(STAGE_CLIENT + 0x1B4u) = STAGE_ROOM0;
    if (k >= 1) {
      U32(STAGE_CLIENT + 0x1B8u) = STAGE_SCRATCH + 0x100u;
      if (k == 2) S32(STAGE_SCRATCH + 0x100u) = -100; /* nMaxCount > 0x37 -> assert 0xece */
      if (k == 3) {
        U32(STAGE_SCRATCH + 0x100u) = 0u;
        stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 2u, 1u, 5005u, 5005u, 2702u);
        U32(STAGE_ROOM0 + 0x74u) = STAGE_UNIT1;
      }
    }
    c.eax = STAGE_CLIENT;
    ts[0] = STAGE_CLIENT;
    run_and_emit(0x6FC4C060u, "CLIENTS_CollectAndFlushNearbyPlayerPositions_6FC4C060_113c", k,
                 k == 0 ? "null_buf_noop" : k == 1 ? "non_player_assert_ec4" : k == 2 ? "overflow_count_assert_ece" : "collect_and_flush",
                 &c, ts, 1, 0u, (k == 1 || k == 2 ? 1 : 0));
  }

  /* [28] 0x6FC4BE20 PLAYER_CheckAndSendCharSaveToClient_6FC4BE20_113c (esi=pClient, ret, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 2801u);
    U32(STAGE_UDATA0 + 0x9Cu)  = STAGE_CLIENT;
    U32(STAGE_CLIENT + 0x16Cu) = 0u;
    U32(STAGE_CLIENT + 0x170u) = 1u;
    U32(STAGE_CLIENT + 0x1B0u) = (k == 2) ? 12u : 25u;
    if (k == 0) {
      U32(STAGE_CLIENT + 0x174u) = 0u;
    } else if (k == 1) {
      U8(STAGE_CLIENT + 0x3D4u)  = 0u;
      U32(STAGE_CLIENT + 0x174u) = STAGE_UNIT0; /* not in server hash -> cleared to 0 */
    } else if (k == 2) {
      U8(STAGE_CLIENT + 0x3D4u)  = 0u;
      U32(STAGE_CLIENT + 0x174u) = STAGE_UNIT0;
      U32(STAGE_CLIENT + 0x1B8u) = STAGE_SCRATCH; /* ebx!=0 && [1b0]>=10 -> edi=1 */
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 0x1000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 0x2000, 0);
    } else {
      U8(STAGE_CLIENT + 0x3D4u)  = 1u;
      U32(STAGE_CLIENT + 0x174u) = STAGE_UNIT0;
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 0x2000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 0x2000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 0x1000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 0x1000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 10, 0x1000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 11, 0x1000, 0);
    }
    c.esi = STAGE_CLIENT;
    ts[0] = STAGE_CLIENT;
    run_and_emit(0x6FC4BE20u, "PLAYER_CheckAndSendCharSaveToClient_6FC4BE20_113c", k,
                 k == 0 ? "null_unit_noop" : k == 1 ? "unhashed_clears_174" : k == 2 ? "hashed_ebx_threshold_10" : "syncs_and_resets_1b0",
                 &c, ts, 1, 0u, 0);
  }

  /* [29] 0x6FC6AD80 CLIENTS_CollectAndRecordNearbyPlayerPositions_6FC6AD80_113c (ebx=pClient, stack=[nMaxCount], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_ROOM0;
    U32(STAGE_ROOM0 + 0x00u)   = STAGE_SCRATCH;
    U32(STAGE_ROOM0 + 0x24u)   = 1u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 2901u);
    U8(STAGE_CLIENT + 0x3D4u)  = 1u;
    U32(STAGE_CLIENT + 0x174u) = (k == 0) ? 0u : STAGE_UNIT0;
    U32(STAGE_CLIENT + 0x1B4u) = STAGE_ROOM0;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 2u, 1u, 5004u, 5003u, 2902u);
      U32(STAGE_ROOM0 + 0x74u) = STAGE_UNIT1;
      if (k == 2) {
        stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 0u, 0u, 3u, 1u, 5001u, 5002u, 2903u);
        U32(STAGE_UNIT1 + 0xE8u) = STAGE_UNIT2;
      }
    }
    c.ebx = STAGE_CLIENT; c.nargs = 1; c.args[0] = 10u; c.calleePop = 4u;
    ts[0] = STAGE_CLIENT; ts[1] = 10;
    run_and_emit(0x6FC6AD80u, "CLIENTS_CollectAndRecordNearbyPlayerPositions_6FC6AD80_113c", k,
                 k == 0 ? "null_player_noop" : k == 1 ? "one_nearby_player" : "two_nearby_players_sorted",
                 &c, ts, 2, 0u, 0);
  }

  /* [30] 0x6FCAC910 NET_CheckPartyMemberStatSyncDelta_6FCAC910_113c (eax=pPlayer, stack=[pTarget, nNewVal, dwKey], ret 0xc) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 3001u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 2u, 1u, 5000u, 5000u, 3002u);
    if (k >= 2) {
      uint32_t pParty = STAGE_PARTYCTRL + 0x20u;
      uint32_t pMem0  = STAGE_PARTYCTRL + 0x40u;
      uint32_t pMem1  = STAGE_PARTYCTRL + 0x50u;
      U32(STAGE_GAME + 0x1D2Cu)    = STAGE_PARTYCTRL;
      U32(STAGE_PARTYCTRL + 0x04u) = pParty;
      U16(pParty + 0x00u)          = 4u;
      U32(pParty + 0x04u)          = pMem0;
      U32(pMem0 + 0x00u)           = 1u;
      U32(pMem0 + 0x04u)           = pMem1;
      U32(pMem1 + 0x00u)           = 2u;
      if (k == 3) {
        uint32_t pNode = STAGE_SCRATCH;
        U32(pNode + 0x00u) = 2u;   /* target guid */
        U32(pNode + 0x04u) = 100u; /* prev val */
        U32(pNode + 0x08u) = 7u;   /* dwKey */
        U32(STAGE_UDATA0 + 0x98u) = pNode;
      }
    }
    uint32_t pArg = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t newVal = (k == 3) ? 100u : 250u;
    uint32_t key = 7u;
    c.eax = pArg; c.nargs = 3; c.args[0] = STAGE_UNIT1; c.args[1] = newVal; c.args[2] = key; c.calleePop = 12u;
    ts[0] = pArg; ts[1] = STAGE_UNIT1; ts[2] = (int64_t)newVal; ts[3] = (int64_t)key;
    run_and_emit(0x6FCAC910u, "NET_CheckPartyMemberStatSyncDelta_6FCAC910_113c", k,
                 k == 0 ? "null_player_assert_a2a" : k == 1 ? "not_partied_0" : k == 2 ? "alloc_new_node_1" : "same_key_delta_0",
                 &c, ts, 4, 0xFFFFFFFFu, (k == 0 ? 1 : 0));
  }

  /* [31] 0x6FCBC4F0 PARTY_AddPlayerToSubParty_6FCBC4F0_113c (eax=pGame, ecx=wPartyId, stack=[pPlayer], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 3101u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 2u, 1u, 5000u, 5000u, 3102u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    U32(STAGE_UDATA1 + 0x9Cu) = STAGE_CLIENT;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);

    uint32_t pParty = STAGE_PARTYCTRL + 0x20u;
    uint32_t pMem0  = STAGE_PARTYCTRL + 0x40u;
    U32(STAGE_GAME + 0x1D2Cu)    = STAGE_PARTYCTRL;
    U32(STAGE_PARTYCTRL + 0x04u) = pParty;
    U16(pParty + 0x00u)          = 3u;
    U32(pParty + 0x04u)          = pMem0;
    U32(pMem0 + 0x00u)           = 1u;

    uint32_t pid  = (k == 0) ? 9u : 3u;
    uint32_t pArg = (k == 1) ? 0u : (k == 2) ? STAGE_UNIT0 : STAGE_UNIT1;
    c.eax = STAGE_GAME; c.ecx = pid; c.nargs = 1; c.args[0] = pArg; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = pid; ts[2] = pArg;
    run_and_emit(0x6FCBC4F0u, "PARTY_AddPlayerToSubParty_6FCBC4F0_113c", k,
                 k == 0 ? "missing_subparty_assert_fe" : k == 1 ? "null_player_assert_ff" : k == 2 ? "already_member_1" : "adds_member_allocs_node_1",
                 &c, ts, 3, 0xFFFFFFFFu, (k < 2 ? 1 : 0));
  }

  /* [32] 0x6FCBC270 PARTY_DistributeGoldPickupAndReturnRemainder_6FCBC270_113c (stack=[pGame, pPlayer, nGoldAmount], ret 0xc) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 3201u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 1, 0); /* lvl 1 -> max gold 10000 */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 14, (k == 1 ? 9950 : 100), 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    if (k == 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 2u, 1u, 5000u, 5000u, 3202u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 1, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 14, 50, 0);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      uint32_t pParty = STAGE_PARTYCTRL + 0x20u;
      uint32_t pMem0  = STAGE_PARTYCTRL + 0x40u;
      uint32_t pMem1  = STAGE_PARTYCTRL + 0x50u;
      U32(STAGE_GAME + 0x1D2Cu)    = STAGE_PARTYCTRL;
      U32(STAGE_PARTYCTRL + 0x04u) = pParty;
      U16(pParty + 0x00u)          = 1u;
      U32(pParty + 0x04u)          = pMem0;
      U32(pMem0 + 0x00u)           = 1u;
      U32(pMem0 + 0x04u)           = pMem1;
      U32(pMem1 + 0x00u)           = 2u;
    }
    uint32_t amt = (k == 2) ? 200u : 120u;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = amt; c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = amt;
    run_and_emit(0x6FCBC270u, "PARTY_DistributeGoldPickupAndReturnRemainder_6FCBC270_113c", k,
                 k == 0 ? "solo_under_cap_rem_0" : k == 1 ? "solo_overflow_rem_70" : "party_split_200",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [29] 0x6FC304F0 ITEMS_FallbackToMagicQualityAndRollAffixes_6FC304F0_113c (eax=ppItem, esi=pdwSeed, ebx=pItemDrop, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, g_item_ring, 50u, 0u, 5000u, 5000u, 3301u + (uint32_t)k);
    stage_item_defaults(STAGE_UDATA0, 100u, (k == 0 ? 15u : k == 1 ? 60u : 85u), 0x13572469u + (uint32_t)k * 19u);
    uint32_t ppItem = STAGE_SCRATCH + 0x00u;
    uint32_t pSeed  = STAGE_SCRATCH + 0x10u;
    uint32_t pDrop  = STAGE_SCRATCH + 0x20u;
    U32(ppItem) = STAGE_UNIT0;
    U32(pSeed)  = 0x24681357u + (uint32_t)k * 37u;
    U32(pDrop + 0x08u) = STAGE_GAME;
    U32(pDrop + 0x0Cu) = (k == 0 ? 15u : k == 1 ? 60u : 85u);
    if (k == 1) S32(pDrop + 0x68u) = -1; /* force suffix only */
    if (k == 2) S32(pDrop + 0x74u) = -1; /* force prefix only */
    c.eax = ppItem; c.esi = pSeed; c.ebx = pDrop;
    ts[0] = ppItem; ts[1] = pSeed; ts[2] = pDrop;
    run_and_emit(0x6FC304F0u, "ITEMS_FallbackToMagicQualityAndRollAffixes_6FC304F0_113c", k,
                 k == 0 ? "ring_exp_ilvl15" : k == 1 ? "ring_exp_suffix_only" : "ring_exp_prefix_only_ilvl85",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [34] 0x6FC301E0 ITEMS_InitAndApplySuperiorQualityMods_6FC301E0_113c (eax=ppItem, ebx=pdwSeed, esi=pItemDrop, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, g_item_ring, 51u, 0u, 5000u, 5000u, 3401u + (uint32_t)k);
    stage_item_defaults(STAGE_UDATA0, (uint16_t)(k == 2 ? 0u : 100u), (k == 0 ? 10u : 50u), 0x33445567u + (uint32_t)k * 23u);
    uint32_t ppItem = STAGE_SCRATCH + 0x00u;
    uint32_t pSeed  = STAGE_SCRATCH + 0x10u;
    uint32_t pDrop  = STAGE_SCRATCH + 0x20u;
    U32(ppItem) = STAGE_UNIT0;
    U32(pSeed)  = 0x77665543u + (uint32_t)k * 41u;
    U32(pDrop + 0x08u) = STAGE_GAME;
    U32(pDrop + 0x0Cu) = (k == 0 ? 10u : 50u);
    c.eax = ppItem; c.ebx = pSeed; c.esi = pDrop;
    ts[0] = ppItem; ts[1] = pSeed; ts[2] = pDrop;
    run_and_emit(0x6FC301E0u, "ITEMS_InitAndApplySuperiorQualityMods_6FC301E0_113c", k,
                 k == 0 ? "superior_ring_ilvl10" : k == 1 ? "superior_ring_ilvl50" : "superior_ring_classic",
                 &c, ts, 3, 0u, 0);
  }

  /* [35] 0x6FC309B0 ITEMS_FallbackToNormalQualityAndFinalize_6FC309B0_113c (eax=dwSavedSeed, ecx=ppItem, esi=pItemDrop, stack=[nSpellArg], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cls = (k == 0) ? g_item_ear : g_item_ring;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, cls, 52u, 0u, 5000u, 5000u, 3501u + (uint32_t)k);
    stage_item_defaults(STAGE_UDATA0, (uint16_t)(k == 0 ? 0u : 100u), (k == 2 ? 50u : 20u), 0x11223345u + (uint32_t)k * 29u);
    uint32_t ppItem = STAGE_SCRATCH + 0x00u;
    uint32_t pDrop  = STAGE_SCRATCH + 0x20u;
    U32(ppItem) = STAGE_UNIT0;
    U32(pDrop + 0x08u) = STAGE_GAME;
    U32(pDrop + 0x0Cu) = (k == 2 ? 50u : 20u);
    U32(pDrop + 0x40u) = 9u;
    uint32_t savedSeed = 0x55AA3311u + (uint32_t)k * 17u;
    c.eax = savedSeed; c.ecx = ppItem; c.esi = pDrop; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = savedSeed; ts[1] = ppItem; ts[2] = pDrop; ts[3] = 0;
    run_and_emit(0x6FC309B0u, "ITEMS_FallbackToNormalQualityAndFinalize_6FC309B0_113c", k,
                 k == 0 ? "classic_ear_fmt0" : k == 1 ? "exp_ring_ilvl20" : "exp_ring_ilvl50",
                 &c, ts, 4, 0u, 0);
  }

  /* [36] 0x6FC30730 ITEMS_FallbackToRareQualityAndRollAffixes_6FC30730_113c (ecx=ppItem, eax=pdwSeed, ebx=pItemDrop, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cls = (k == 0) ? g_item_gold : g_item_ring;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, cls, 53u, 0u, 5000u, 5000u, 3601u + (uint32_t)k);
    stage_item_defaults(STAGE_UDATA0, 100u, (k == 2 ? 85u : 50u), 0x44556677u + (uint32_t)k * 31u);
    uint32_t ppItem = STAGE_SCRATCH + 0x00u;
    uint32_t pSeed  = STAGE_SCRATCH + 0x10u;
    uint32_t pDrop  = STAGE_SCRATCH + 0x20u;
    U32(ppItem) = STAGE_UNIT0;
    U32(pSeed)  = 0x8899AABBu + (uint32_t)k * 13u;
    U32(pDrop + 0x08u) = STAGE_GAME;
    U32(pDrop + 0x0Cu) = (k == 2 ? 85u : 50u);
    c.ecx = ppItem; c.eax = pSeed; c.ebx = pDrop;
    ts[0] = ppItem; ts[1] = pSeed; ts[2] = pDrop;
    run_and_emit(0x6FC30730u, "ITEMS_FallbackToRareQualityAndRollAffixes_6FC30730_113c", k,
                 k == 0 ? "gold_not_rare_0" : k == 1 ? "ring_exp_ilvl50_rare_1" : "ring_exp_ilvl85_rare_1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [37] 0x6FC30600 ITEMS_ApplyTypeSpecificCreatedItemMods_6FC30600_113c (ecx=pItem, eax=pItemDrop, stack=[nSpellArg], ret 4, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cls = (k == 0) ? g_item_ear : (k == 1) ? g_item_tome : (k == 2) ? g_item_scroll : g_item_ring;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, cls, 54u, 0u, 5000u, 5000u, 3701u + (uint32_t)k);
    stage_item_defaults(STAGE_UDATA0, 100u, 30u, 0x22334455u + (uint32_t)k * 17u);
    uint32_t pDrop = STAGE_SCRATCH + 0x20u;
    U32(pDrop + 0x08u) = STAGE_GAME;
    U32(pDrop + 0x0Cu) = 30u;
    U32(pDrop + 0x40u) = 7u; /* cell for ear */
    c.ecx = STAGE_UNIT0; c.eax = pDrop; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = pDrop; ts[2] = 0;
    run_and_emit(0x6FC30600u, "ITEMS_ApplyTypeSpecificCreatedItemMods_6FC30600_113c", k,
                 k == 0 ? "ear_type7" : k == 1 ? "tome_type18" : k == 2 ? "scroll_type22" : "ring_default",
                 &c, ts, 3, 0u, 0);
  }

  /* [38] 0x6FCAFAF0 NPCS_FreePlayerGambleAndMercNodesForNpc_6FCAFAF0_113c (eax=pNpcRecord, ecx=pPlayer, stack=[pGame], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 148u, 10u, 1u, 5000u, 5000u, 3801u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 7u, 1u, 5000u, 5000u, 3802u);
    uint32_t pSlots = STAGE_NPCCTRL + 0x10u;
    U32(STAGE_GAME + 0x1D24u)    = STAGE_NPCCTRL;
    U32(STAGE_NPCCTRL + 0x04u)   = pSlots;
    U32(pSlots + 0x00u)          = (k == 0) ? 999u : 148u;
    if (k >= 1) {
      uint32_t pGNode = STAGE_SCRATCH + 0x00u;
      uint32_t pGInv  = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(pGNode + 0x00u) = pGInv;
      U32(pGNode + 0x04u) = 7u;
      U32(pSlots + 0x08u) = pGNode;
      U32(pSlots + 0x0Cu) = 1u;
    }
    if (k == 2) {
      uint32_t pMNode = STAGE_SCRATCH + 0x40u;
      U32(pMNode + 0x00u) = 7u;
      U32(pSlots + 0x18u) = pMNode;
    }
    c.eax = STAGE_UNIT0; c.ecx = STAGE_UNIT1; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = STAGE_GAME;
    run_and_emit(0x6FCAFAF0u, "NPCS_FreePlayerGambleAndMercNodesForNpc_6FCAFAF0_113c", k,
                 k == 0 ? "npc_slot_not_found" : k == 1 ? "frees_gamble_node" : "frees_gamble_and_merc_nodes",
                 &c, ts, 3, 0u, 0);
  }

  /* [39] 0x6FC33C20 ITEMS_RollAndApplyUniqueItem_6FC33C20_113c (stack=[pItem, pItemDrop], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cls = (k == 0) ? g_item_gold : g_item_ring;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, cls, 55u, 0u, 5000u, 5000u, 3901u + (uint32_t)k);
    stage_item_defaults(STAGE_UDATA0, 100u, (k == 1 ? 10u : 85u), 0x13579BDFu + (uint32_t)k * 43u);
    uint32_t pDrop = STAGE_SCRATCH + 0x20u;
    U32(pDrop + 0x08u) = STAGE_GAME;
    U32(pDrop + 0x0Cu) = (k == 1 ? 10u : 85u);
    U8(pDrop + 0x80u)  = 1u; /* allow ladder/all uniques */
    c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = pDrop; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = pDrop;
    run_and_emit(0x6FC33C20u, "ITEMS_RollAndApplyUniqueItem_6FC33C20_113c", k,
                 k == 0 ? "gold_no_unique_0" : k == 1 ? "ring_ilvl10_unique_1" : "ring_ilvl85_unique_1",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [40] 0x6FC2E410 ITEMS_PopulateItemDropStruct_6FC2E410_113c (ebx=pOutDrop, esi=pItem, stack=[pUnit], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cls = (k == 0) ? g_item_gold : (k == 1) ? g_item_ear : g_item_sword;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, cls, 56u, 3u, 5010u, 5020u, 4001u + (uint32_t)k);
    stage_item_defaults(STAGE_UDATA0, 100u, 25u, 0x55667789u + (uint32_t)k);
    if (k == 0) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 14, 1234, 0);
    } else if (k == 1) {
      U8(STAGE_UDATA0 + 0x35u) = 42u; /* ear level */
      U8(STAGE_UDATA0 + 0x48u) = 'H';
      U8(STAGE_UDATA0 + 0x49u) = 'i';
      U8(STAGE_UDATA0 + 0x4Au) = 0u;
    } else {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 72, 18, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 73, 24, 0);
    }
    uint32_t pOut = STAGE_SCRATCH;
    c.ebx = pOut; c.esi = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = pOut; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME;
    run_and_emit(0x6FC2E410u, "ITEMS_PopulateItemDropStruct_6FC2E410_113c", k,
                 k == 0 ? "gold_pile" : k == 1 ? "player_ear" : "sword_with_durability",
                 &c, ts, 3, 0u, 0);
  }

  /* [41] 0x6FC335E0 ITEMS_AddStaffModSkillsByTier_6FC335E0_113c (eax=nItemLevel, ebx=pItem, stack=[nBaseSkillId], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, g_item_wand, 57u, 0u, 5000u, 5000u, 4101u + (uint32_t)k);
    stage_item_defaults(STAGE_UDATA0, 100u, (k == 0 ? 5u : k == 1 ? 20u : 50u), 0x11111111u + (uint32_t)k * 0x23456789u);
    uint32_t ilvl = (k == 0) ? 5u : (k == 1) ? 20u : 50u;
    c.eax = ilvl; c.ebx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 66u; c.calleePop = 4u; /* Necro base skill 66 */
    ts[0] = ilvl; ts[1] = STAGE_UNIT0; ts[2] = 66;
    run_and_emit(0x6FC335E0u, "ITEMS_AddStaffModSkillsByTier_6FC335E0_113c", k,
                 k == 0 ? "ilvl5_necro_wand" : k == 1 ? "ilvl20_necro_wand" : "ilvl50_necro_wand",
                 &c, ts, 3, 0u, 0);
  }

  /* [42] 0x6FC337F0 ITEMS_ApplyLowQualityItemMods_6FC337F0_113c (edi=pItem, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t pArg = 0u;
    if (k >= 1) {
      uint32_t cls = (k == 1) ? g_item_sword : (k == 2) ? g_item_armor : g_item_ring;
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, cls, 58u, 0u, 5000u, 5000u, 4201u + (uint32_t)k);
      stage_item_defaults(STAGE_UDATA0, 100u, 20u, 0x65432109u + (uint32_t)k * 17u);
      if (k == 1) {
        fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 21, 10, 0);
        fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 22, 20, 0);
        fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 23, 12, 0);
        fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 24, 24, 0);
      } else if (k == 2) {
        fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 31, 40, 0);
      }
      pArg = STAGE_UNIT0;
    }
    c.edi = pArg;
    ts[0] = pArg;
    run_and_emit(0x6FC337F0u, "ITEMS_ApplyLowQualityItemMods_6FC337F0_113c", k,
                 k == 0 ? "null_item_0" : k == 1 ? "low_qual_sword_1" : k == 2 ? "low_qual_armor_1" : "low_qual_ring_0",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }
}

/* ================================ BATCH 2: DRLG/Room/SUnit + Combat/SUnitDmg/States (33 VAs) */

static void emit_batch_2(void) {
  X86CallSpec c;
  int64_t ts[12];
  uint32_t sgpt = U32(0x6FDE9E1Cu + g_com_rebase);

  /* [B2-01] 0x6FC4EF50 OBJECTS_InitFn57_InitSpecialChest_6FC4EF50_113c (ecx=pObjInit, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0 ? 1u : k == 1 ? 8u : 40u));
    U32(STAGE_ROOM0 + 0x6Cu) = 0x11111111u + (uint32_t)k * 0x22222223u;
    U32(STAGE_ROOM0 + 0x70u) = 0x0000029Au;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 5u, 100u + (uint32_t)k, 0u, 5000u, 5000u, 5101u + (uint32_t)k);
    uint32_t pInit = STAGE_SCRATCH;
    uint32_t pSeed = STAGE_SCRATCH + 0x40u;
    U32(pSeed + 0x00u) = 0x11111111u + (uint32_t)k * 0x22222223u;
    U32(pSeed + 0x04u) = 0x0000029Au;
    U32(pInit + 0x00u) = STAGE_GAME;
    U32(pInit + 0x04u) = STAGE_UNIT0;
    U32(pInit + 0x08u) = STAGE_ROOM0;
    U32(pInit + 0x0Cu) = pSeed;
    U32(pInit + 0x10u) = U32(STAGE_UDATA0 + 0x00u); /* pObjectsTxt */
    c.ecx = pInit;
    ts[0] = pInit;
    run_and_emit(0x6FC4EF50u, "OBJECTS_InitFn57_InitSpecialChest_6FC4EF50_113c", k,
                 k == 0 ? "lvl1_special_chest" : k == 1 ? "lvl8_special_chest" : "lvl40_special_chest",
                 &c, ts, 1, 0u, 0);
  }

  /* [B2-02] 0x6FC67820 REGPOP_RollAmbientSpawn113c (ecx=pRoom, edi=pGame, stack=[nLevelId, pLevelsTxt], ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t pMonReg = STAGE_SCRATCH;
    U32(STAGE_GAME + 0xF0u + 2u * 4u) = pMonReg;
    U32(pMonReg + 0x2C4u) = (k == 2) ? 3u : 0u; /* >=3 blocks ambient spawn when roll < 3 */
    if (k == 0) {
      U32(STAGE_ROOM0 + 0x6Cu) = 0x12345678u;
      U32(STAGE_ROOM0 + 0x70u) = 0x0000029Au;
    } else if (k == 1) {
      U32(STAGE_ROOM0 + 0x6Cu) = 0x87654321u;
      U32(STAGE_ROOM0 + 0x70u) = 0x00000111u;
    } else {
      U32(STAGE_ROOM0 + 0x6Cu) = 0u;
      U32(STAGE_ROOM0 + 0x70u) = 1u; /* 0 * mult + 1 = 1; 1 % 100 = 1 < 3 */
    }
    uint32_t pLvlsTxt = U32(sgpt + 0xC58u) + 2u * 0x220u;
    c.ecx = STAGE_ROOM0; c.edi = STAGE_GAME; c.nargs = 2; c.args[0] = 2u; c.args[1] = pLvlsTxt; c.calleePop = 8u;
    ts[0] = STAGE_ROOM0; ts[1] = STAGE_GAME; ts[2] = 2; ts[3] = pLvlsTxt;
    run_and_emit(0x6FC67820u, "REGPOP_RollAmbientSpawn113c", k,
                 k == 0 ? "seed1_roll_ge3" : k == 1 ? "seed2_roll_ge3" : "roll_lt3_ambient_capped_3",
                 &c, ts, 4, 0u, 0);
  }

  /* [B2-03] 0x6FC8B6F0 OBJ_DropChestLootFromObjectUnit_6FC8B6F0_113c (ecx=pGame, edx=pObjectUnit, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, 0u, 2u, 5u, 101u, 0u, 5000u, 5000u, 5301u);
    uint32_t pObjArg = STAGE_UNIT0;
    if (k == 0) {
      pObjArg = 0u; /* asserts 0x1313 */
    } else if (k == 1) {
      U32(STAGE_UNIT0 + 0x80u) = 0u; /* null pGame -> asserts 0x1315 */
    } else if (k == 2) {
      U32(STAGE_UDATA0 + 0x00u) = 0u; /* null pObjectsTxt -> asserts 0x1317 */
    } else {
      /* pRoom == 0 -> clean return 0 */
    }
    c.ecx = STAGE_GAME; c.edx = pObjArg;
    ts[0] = STAGE_GAME; ts[1] = pObjArg;
    run_and_emit(0x6FC8B6F0u, "OBJ_DropChestLootFromObjectUnit_6FC8B6F0_113c", k,
                 k == 0 ? "null_obj_assert_1313" : k == 1 ? "null_game_assert_1315" : k == 2 ? "null_txt_assert_1317" : "null_room_returns_0",
                 &c, ts, 2, 0xFFFFFFFFu, (k < 3 ? 1 : 0));
  }

  /* [B2-04] 0x6FC5BC00 OBJECTS_OperateFn_SpawnRandomLevelMonster_6FC5BC00_113c (ecx=pGame, edx=pUnit, stack=[pArg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0 ? 1u : k == 1 ? 2u : 3u));
    U32(STAGE_ROOM0 + 0x6Cu) = 0x13572468u + (uint32_t)k * 33u;
    U32(STAGE_ROOM0 + 0x70u) = 0x0000029Au;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 2 ? 0u : 2u), 5u, 102u, 0u, (uint16_t)(5000u + k * 5u), (uint16_t)(5000u + k * 7u), 5401u + (uint32_t)k);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC5BC00u, "OBJECTS_OperateFn_SpawnRandomLevelMonster_6FC5BC00_113c", k,
                 k == 0 ? "town_lvl1_assert_4f0" : k == 1 ? "lvl2_static_path" : "lvl3_dyn_path",
                 &c, ts, 3, 0xFFFFFFFFu, (k == 0 ? 1 : 0));
  }

  /* [B2-05] 0x6FC8A4E0 OBJ_SpawnRandomMonsterTrapFromObject_6FC8A4E0_113c (ecx=pGame, edx=pObjectUnit, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 2 ? 40u : 2u));
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 5u, 103u, 0u, 5000u, 5000u, 5501u + (uint32_t)k);
    uint32_t pObjCtrl = STAGE_SCRATCH + 0x000u;
    uint32_t pRegion  = STAGE_SCRATCH + 0x400u;
    uint32_t pMonReg  = STAGE_SCRATCH + 0x500u;
    uint32_t lvlId = (k == 2) ? 40u : 2u;
    U32(STAGE_GAME + 0x10F0u) = pObjCtrl;
    U32(pObjCtrl + 0x00u)     = 0x13579BDFu + (uint32_t)k * 0x11111111u;
    U32(pObjCtrl + 0x04u)     = 0x0000029Au;
    U32(pObjCtrl + 0x48u + lvlId * 4u) = pRegion;
    S32(pRegion + 0x1Cu) = (k == 0) ? 0xEA : -1; /* 0xEA in Act 0 -> skips spawn cleanly */
    U32(STAGE_GAME + 0xF0u + lvlId * 4u) = pMonReg;
    if (k == 1) {
      U8(pMonReg + 0x10u) = 0u; /* caches 0xEA, skips spawn in Act 0 */
    } else if (k == 2) {
      U8(pMonReg + 0x10u) = 1u;
      S16(pMonReg + 0x14u) = 0x62; /* Act 1 -> caches 0x60, calls 6FC8A050 (room has no col grid) */
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC8A4E0u, "OBJ_SpawnRandomMonsterTrapFromObject_6FC8A4E0_113c", k,
                 k == 0 ? "cached_ea_act0_skips" : k == 1 ? "empty_monreg_caches_ea" : "act1_caches_60_and_steps_seed",
                 &c, ts, 2, 0u, 0);
  }

  /* [B2-06] 0x6FC8A050 OBJ_SpawnMonsterFromObjectInRings_6FC8A050_113c (ebx=nMonsterId, esi=pOperateArgs, stack=[nMode], ret 4, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 3 ? 0u : STAGE_ROOM0), 2u, 5u, 104u, 0u, 5000u, 5000u, 5601u);
    uint32_t pArgs = STAGE_SCRATCH;
    U32(pArgs + 0x00u) = STAGE_GAME;
    U32(pArgs + 0x04u) = STAGE_UNIT0;
    uint32_t monId = (k == 0) ? 0xFFFFFFFFu : (k == 1) ? 9999u : (k == 2) ? 0xEAu : 5u;
    c.ebx = monId; c.esi = pArgs; c.nargs = 1; c.args[0] = 1u; c.calleePop = 4u;
    ts[0] = (int32_t)monId; ts[1] = pArgs; ts[2] = 1;
    run_and_emit(0x6FC8A050u, "OBJ_SpawnMonsterFromObjectInRings_6FC8A050_113c", k,
                 k == 0 ? "neg_monid_noop" : k == 1 ? "oob_monid_noop" : k == 2 ? "ea_in_act0_noop" : "valid_mon_null_room",
                 &c, ts, 3, 0u, 0);
  }

  /* [B2-07] 0x6FC8B8A0 OBJ_ShrineMonster_PromoteNearestMonster_6FC8B8A0_113c (ecx=pOperateArgs, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_SCRATCH + 0x100u) = STAGE_ROOM0;
    U32(STAGE_ROOM0 + 0x00u)    = STAGE_SCRATCH + 0x100u;
    U32(STAGE_ROOM0 + 0x24u)    = 1u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 5701u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 2u, 2u, 0u, 5002u, 5002u, 5702u);
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 1u, 3u, 1u, 5004u, 5004u, 5703u + (uint32_t)k);
      stage_mon_txt(STAGE_UDATA2, 1u);
      U8(STAGE_UDATA2 + 0x16u) = (k == 1) ? 0x04u : 0x00u; /* k=1 already champion/unique -> skipped? */
      U32(STAGE_ROOM0 + 0x74u) = STAGE_UNIT2;
    }
    uint32_t pArgs = STAGE_SCRATCH;
    U32(pArgs + 0x00u) = STAGE_GAME;
    U32(pArgs + 0x04u) = STAGE_UNIT1;
    U32(pArgs + 0x08u) = STAGE_UNIT0;
    c.ecx = pArgs;
    ts[0] = pArgs;
    run_and_emit(0x6FC8B8A0u, "OBJ_ShrineMonster_PromoteNearestMonster_6FC8B8A0_113c", k,
                 k == 0 ? "no_nearby_monster" : k == 1 ? "already_flagged_monster" : "promotes_normal_monster",
                 &c, ts, 1, 0u, 0);
  }

  /* [B2-08] 0x6FC89EE0 OBJ_CalcShrineStatBonusValue_6FC89EE0_113c (esi=pPlayerUnit, ebx=nBonusPct, stack=[nStatId], ret 4) */
  for (int k = 0; k < 5; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 5801u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 31, 200, 0); /* defense = 200 */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 21, 15, 0);  /* mindamage = 15 */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 22, 30, 0);  /* maxdamage = 30 */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 19, 120, 0); /* tohit = 120 */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 2, 40, 0);   /* dex = 40 */
    if (k == 1) {
      void *pSl = fn_AllocSkillList(NULL);
      U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)pSl;
      fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 0, 1, 1, 0, 0);
    }
    uint32_t statId = (k == 0) ? 39u : (k == 1) ? 19u : (k == 2) ? 21u : (k == 3) ? 22u : 31u;
    uint32_t pct    = (k == 0) ? 75u : (k == 1) ? 200u : (k == 2) ? 200u : (k == 3) ? 200u : 150u;
    c.esi = STAGE_UNIT0; c.ebx = pct; c.nargs = 1; c.args[0] = statId; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = (int32_t)pct; ts[2] = (int32_t)statId;
    run_and_emit(0x6FC89EE0u, "OBJ_CalcShrineStatBonusValue_6FC89EE0_113c", k,
                 k == 0 ? "direct_resist_39" : k == 1 ? "tohit_19_pct200" : k == 2 ? "mindmg_21_unarmed" : k == 3 ? "maxdmg_22_unarmed" : "default_def_31_pct150",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B2-09] 0x6FC670F0 REGPOP_SpawnMonStatsGroupPackAtSubtile_6FC670F0_113c (eax=nY, ecx=nX, ebx=nClassId, stack=[pGame, pRoom], ret 8) */
  {
    uint32_t monZeroGrp = 0u;
    uint32_t pMonStats = U32(sgpt + 0xA78u);
    uint32_t nMonStats = U32(sgpt + 0xA80u);
    for (uint32_t i = 0; i < nMonStats; i++) {
      uint32_t rec = pMonStats + i * 0x1A8u;
      if (U8(rec + 0x2Fu) == 0u) { monZeroGrp = i; break; }
    }
    for (int k = 0; k < 3; k++) {
      reset_case();
      c = make_call();
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      U32(STAGE_ROOM0 + 0x6Cu) = 0x11223344u + (uint32_t)k * 17u;
      U32(STAGE_ROOM0 + 0x70u) = 0x0000029Au;
      uint32_t cls = (k == 0) ? monZeroGrp : 1u;
      if (k == 2) {
        U32(STAGE_ROOMEX0 + 0x64u) = STAGE_SCRATCH;
        U8(STAGE_SCRATCH + 0x00u)  = 1u; /* simple coordlist returning U32(+0x30)=0 */
      }
      c.eax = 5000u; c.ecx = 5000u; c.ebx = cls; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_ROOM0; c.calleePop = 8u;
      ts[0] = 5000; ts[1] = 5000; ts[2] = (int32_t)cls; ts[3] = STAGE_GAME; ts[4] = STAGE_ROOM0;
      run_and_emit(0x6FC670F0u, "REGPOP_SpawnMonStatsGroupPackAtSubtile_6FC670F0_113c", k,
                   k == 0 ? "mingrp0_returns_0" : k == 1 ? "null_coordlist_assert_29c" : "empty_coordnode_returns_0",
                   &c, ts, 5, 0xFFFFFFFFu, (k == 1 ? 1 : 0));
    }
  }

  /* [B2-10] 0x6FC3EE50 MONREG_IsMonsterDeadAtCoords_6FC3EE50_113c (eax=nX, ecx=nY, stack=[pGame, pOriginRoom, nClassId], ret 0xc) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_SCRATCH + 0x100u) = STAGE_ROOM0;
    U32(STAGE_ROOM0 + 0x00u)    = STAGE_SCRATCH + 0x100u;
    U32(STAGE_ROOM0 + 0x24u)    = 1u;
    if (k == 1 || k == 2) {
      /* dead monster (mode=12) vs alive monster (mode=1) */
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 15u, 10u, (k == 1 ? 12u : 1u), 5000u, 5000u, 6001u);
      U32(STAGE_ROOM0 + 0x74u) = STAGE_UNIT0;
    } else if (k == 3) {
      /* wrong classId dead monster -> 0 */
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 16u, 10u, 12u, 5000u, 5000u, 6002u);
      U32(STAGE_ROOM0 + 0x74u) = STAGE_UNIT0;
    }
    c.eax = 5000u; c.ecx = 5000u; c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_ROOM0; c.args[2] = 15u; c.calleePop = 12u;
    ts[0] = 5000; ts[1] = 5000; ts[2] = STAGE_GAME; ts[3] = STAGE_ROOM0; ts[4] = 15;
    run_and_emit(0x6FC3EE50u, "MONREG_IsMonsterDeadAtCoords_6FC3EE50_113c", k,
                 k == 0 ? "empty_room_0" : k == 1 ? "dead_match_1" : k == 2 ? "alive_match_0" : "dead_wrong_class_0",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [B2-11] 0x6FC2B510 OBJRGN_ResolveMonsterShrineBaseClassId_6FC2B510_113c (eax=pArgs, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    uint32_t lvlId = (k == 3) ? 40u : 2u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvlId);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 5u, 105u, 0u, 5000u, 5000u, 6101u);
    uint32_t pArgs    = STAGE_SCRATCH + 0x000u;
    uint32_t pObjCtrl = STAGE_SCRATCH + 0x100u;
    uint32_t pRegion  = STAGE_SCRATCH + 0x500u;
    uint32_t pMonReg  = STAGE_SCRATCH + 0x600u;
    U32(pArgs + 0x00u) = STAGE_GAME;
    U32(pArgs + 0x04u) = STAGE_UNIT0;
    U32(STAGE_GAME + 0x10F0u) = pObjCtrl;
    U32(pObjCtrl + 0x48u + lvlId * 4u) = pRegion;
    U32(STAGE_GAME + 0xF0u + lvlId * 4u) = pMonReg;
    if (k == 0) {
      S32(pRegion + 0x1Cu) = 0x15; /* cached valid */
    } else if (k == 1) {
      S32(pRegion + 0x1Cu) = -1;
      U8(pMonReg + 0x10u)  = 0u; /* empty -> caches 0xEA */
    } else if (k == 2) {
      S32(pRegion + 0x1Cu) = -1;
      U8(pMonReg + 0x10u)  = 1u;
      S16(pMonReg + 0x14u) = 0x07; /* Act 0 base 5..9 -> caches 5 */
    } else {
      S32(pRegion + 0x1Cu) = -1;
      U8(pMonReg + 0x10u)  = 1u;
      S16(pMonReg + 0x14u) = 0x62; /* Act 1 base 0x60..0x64 -> caches 0x60 */
    }
    c.eax = pArgs;
    ts[0] = pArgs;
    run_and_emit(0x6FC2B510u, "OBJRGN_ResolveMonsterShrineBaseClassId_6FC2B510_113c", k,
                 k == 0 ? "cached_21" : k == 1 ? "empty_caches_ea" : k == 2 ? "act0_caches_5" : "act1_caches_60",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B2-12] 0x6FC6A460 SUNIT_InsertNearestPlayerIntoSortedList_6FC6A460_113c (eax=nX, ecx=pList, stack=[pPlayer, nY, pMaxDist, pGame, nMaxCount], ret 0x14, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, (uint16_t)(k == 3 ? 5200u : 5010u), 5005u, 6201u);
    uint32_t pList    = STAGE_SCRATCH + 0x000u;
    uint32_t pMaxDist = STAGE_SCRATCH + 0x200u;
    U32(pMaxDist) = 50u;
    if (k == 1) {
      /* empty list, curCount = 0, maxCount = 3 -> inserts at slot 1 */
      U32(STAGE_GAME + 0x3BCu) = 0u;
    } else if (k == 2) {
      /* 1 existing entry at slot 1 (dist 40), curCount = 1 < maxCount = 2 -> inserts closer (dist 15) at head */
      U32(STAGE_GAME + 0x3BCu) = 1u;
      U32(pList + 0x08u) = 1u;
      U32(pList + 1u * 12u + 0x00u) = STAGE_UNIT1;
      U32(pList + 1u * 12u + 0x04u) = 40u;
      U32(pList + 1u * 12u + 0x08u) = 0u;
    } else if (k == 3) {
      /* curCount = 2 == maxCount = 2, dist = 205 >= maxDist = 50 -> rejected */
      U32(STAGE_GAME + 0x3BCu) = 2u;
      U32(pList + 0x08u) = 1u;
      U32(pList + 1u * 12u + 0x04u) = 20u;
      U32(pList + 1u * 12u + 0x08u) = 2u;
      U32(pList + 2u * 12u + 0x04u) = 50u;
    }
    uint32_t pPlr = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t maxC = (k == 1) ? 3u : 2u;
    c.eax = 5000u; c.esi = pList; c.nargs = 5;
    c.args[0] = pPlr; c.args[1] = 5000u; c.args[2] = pMaxDist; c.args[3] = STAGE_GAME; c.args[4] = maxC;
    c.calleePop = 20u;
    ts[0] = 5000; ts[1] = pList; ts[2] = pPlr; ts[3] = 5000; ts[4] = pMaxDist; ts[5] = STAGE_GAME; ts[6] = maxC;
    run_and_emit(0x6FC6A460u, "SUNIT_InsertNearestPlayerIntoSortedList_6FC6A460_113c", k,
                 k == 0 ? "null_player_noop" : k == 1 ? "insert_first_into_empty" : k == 2 ? "insert_closer_at_head" : "full_and_too_far_noop",
                 &c, ts, 7, 0u, 0);
  }

  /* [B2-13] 0x6FC2B9A0 OBJRGN_AllocObjectControl_6FC2B9A0_113c (stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t gArg = (k == 0) ? 0u : STAGE_GAME;
    if (k >= 1) {
      U32(STAGE_GAME + 0xD0u) = (k == 1) ? 0x11223344u : 0x55667788u;
      U32(STAGE_GAME + 0xD4u) = 0x0000029Au;
    }
    c.nargs = 1; c.args[0] = gArg; c.calleePop = 4u;
    ts[0] = gArg;
    run_and_emit(0x6FC2B9A0u, "OBJRGN_AllocObjectControl_6FC2B9A0_113c", k,
                 k == 0 ? "null_game_assert_29" : k == 1 ? "alloc_objctrl_seed1" : "alloc_objctrl_seed2",
                 &c, ts, 1, 0xFFFFFFFFu, (k == 0 ? 1 : 0));
  }

  /* [B2-14] 0x6FC468C0 MONUMOD_EventScarabChargedBoltsWrapper_6FC468C0_113c (ecx=pGame, edx=pMonster, stack=[nUModId, pAttacker], ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 10u, (k == 1 ? 3u : 1u), 5000u, 5000u, 6401u);
    U32(STAGE_GAME + 0xA8u)   = 100u;
    U32(STAGE_UDATA0 + 0x18u) = 95u; /* delta = 5 < 10 -> clears bit 0 of +0x17 without spawning bolts */
    U8(STAGE_UDATA0 + 0x17u)  = 0x03u;
    uint32_t att = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 0x11u; c.args[1] = att; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0x11; ts[3] = att;
    run_and_emit(0x6FC468C0u, "MONUMOD_EventScarabChargedBoltsWrapper_6FC468C0_113c", k,
                 k == 0 ? "null_attacker_noop" : k == 1 ? "mode3_noop" : "cooldown_lt10_clears_bit0",
                 &c, ts, 4, 0u, 0);
  }

  /* [B2-15] 0x6FC46320 MONUMOD_SpawnScarabChargedBolts_6FC46320_113c (ecx=pGame, edx=pMonster, stack=[arg0, bTrigger], ret 8, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 11u, 1u, 5000u, 5000u, 6501u);
    U32(STAGE_GAME + 0xA8u)   = 100u;
    U32(STAGE_UDATA0 + 0x18u) = (k == 1) ? 95u : (k == 2) ? 108u : 91u; /* k=2 negative delta -> abs 8 < 10 */
    U8(STAGE_UDATA0 + 0x17u)  = (k == 3) ? 0x05u : 0x03u;
    uint32_t trig = (k == 0) ? 0u : 1u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 0u; c.args[1] = trig; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = trig;
    run_and_emit(0x6FC46320u, "MONUMOD_SpawnScarabChargedBolts_6FC46320_113c", k,
                 k == 0 ? "trigger0_noop" : k == 1 ? "pos_delta5_clears_bit0" : k == 2 ? "neg_delta8_clears_bit0" : "delta9_clears_bit0_mask5",
                 &c, ts, 3, 0u, 0);
  }

  /* [B2-16] 0x6FC462D0 MONUMOD_SpawnColdEnchantedFrostNova_6FC462D0_113c (ecx=pGame, edx=pMonster, stack=[arg0, bTrigger], ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, 0u, 1u, 1u, 12u, 1u, 5000u, 5000u, 6601u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, (k == 1 ? 1 : 20), 0);
    uint32_t trig = (k == 0) ? 0u : 1u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 0u; c.args[1] = trig; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = trig;
    run_and_emit(0x6FC462D0u, "MONUMOD_SpawnColdEnchantedFrostNova_6FC462D0_113c", k,
                 k == 0 ? "trigger0_noop" : k == 1 ? "mlvl1_clamped_slvl1" : "mlvl20_slvl10",
                 &c, ts, 3, 0u, 0);
  }

  /* [B2-17] 0x6FC42B10 MONUMOD_SpawnPainWormOnDeath_6FC42B10_113c (ecx=pGame, edx=pMonster, stack=[nUModId, bUnique], ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 2 ? STAGE_ROOM0 : 0u), 1u, 1u, 13u, (k == 0 ? 1u : 0u), 5000u, 5000u, 6701u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 0;
    run_and_emit(0x6FC42B10u, "MONUMOD_SpawnPainWormOnDeath_6FC42B10_113c", k,
                 k == 0 ? "mode1_skips" : k == 1 ? "mode0_null_room_sets_state68" : "mode0_room_sets_state68",
                 &c, ts, 4, 0u, 0);
  }

  /* [B2-18] 0x6FC43730 MONUMOD_UnlinkMinionAndStopSkill_6FC43730_113c (ecx=pUnit, edx=pGame, stack=[arg0], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t uArg = 0u;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 1 ? 0u : 1u), 1u, 14u, 0u, 5000u, 5000u, 6801u);
      if (k == 2) {
        uint32_t pAiGen = STAGE_SCRATCH;
        U32(STAGE_UDATA0 + 0x28u) = pAiGen;
        U32(pAiGen + 0x2Cu) = 77u;
        U32(pAiGen + 0x30u) = 0u;
      }
      uArg = STAGE_UNIT0;
    }
    c.ecx = uArg; c.edx = STAGE_GAME; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = uArg; ts[1] = STAGE_GAME; ts[2] = 0;
    run_and_emit(0x6FC43730u, "MONUMOD_UnlinkMinionAndStopSkill_6FC43730_113c", k,
                 k == 0 ? "null_unit_noop" : k == 1 ? "player_mode0_noop" : "monster_mode0_resets_aigen",
                 &c, ts, 3, 0u, 0);
  }

  /* [B2-19] 0x6FC46230 MONSTER_OnDeathSpawnPoisonCloud_6FC46230_113c (ecx=pGame, edx=pUnit, stack=[arg0, arg1], ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, 0u, (k == 2 ? 2u : 1u), 1u, 15u, 1u, (uint16_t)(5000u + k * 4u), 5000u, 6901u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, (k == 0 ? 0 : k == 1 ? 15 : 40), 0);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 0;
    run_and_emit(0x6FC46230u, "MONSTER_OnDeathSpawnPoisonCloud_6FC46230_113c", k,
                 k == 0 ? "mlvl0_clamped1" : k == 1 ? "mlvl15_mon" : "mlvl40_static_path",
                 &c, ts, 4, 0u, 0);
  }

  /* [B2-20] 0x6FC441B0 MONSTER_AssignTeleportSkill_6FC441B0_113c (ecx=pMonsterUnit, stack=[pArg], ret 4, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t uArg = 0u;
    uint32_t pArg = (k == 2) ? 0u : 1u;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 1 ? 0u : 1u), 1u, 16u, 1u, 5000u, 5000u, 7001u);
      if (k == 3) {
        void *pSl = fn_AllocSkillList(NULL);
        U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)pSl;
        uint32_t pAiGen = STAGE_SCRATCH;
        U32(STAGE_UDATA0 + 0x28u) = pAiGen;
        U8(pAiGen + 0x08u) = 0x01u;
      }
      uArg = STAGE_UNIT0;
    }
    c.ecx = uArg; c.nargs = 1; c.args[0] = pArg; c.calleePop = 4u;
    ts[0] = uArg; ts[1] = pArg;
    run_and_emit(0x6FC441B0u, "MONSTER_AssignTeleportSkill_6FC441B0_113c", k,
                 k == 0 ? "null_unit_noop" : k == 1 ? "non_monster_noop" : k == 2 ? "null_arg_noop" : "assigns_skill_b8_and_flag20",
                 &c, ts, 2, 0u, 0);
  }

  /* [B2-21] 0x6FCB85D0 STATES_RemoveFreezeOrShatterStateCallback_6FCB85D0_113c (ecx=pUnit, edx=nState, stack=[pStatList], ret 4, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    /* k=0: alive monster (mode=1) clears state 1 + state 0x6b; k=1: dead monster (mode=12) clears state 1 only;
       k=2: alive player (mode=1) clears state 1 + state 0x6b; k=3: dead player (mode=0) clears state 1 only */
    uint32_t uType = (k < 2) ? 1u : 0u;
    uint32_t mode  = (k == 0 || k == 2) ? 1u : (k == 1 ? 12u : 0u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, (uType == 1 ? 1u : 0u), 17u, mode, 5000u, 5000u, 7101u);
    fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 1, 1);
    fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x6B, 1);
    c.ecx = STAGE_UNIT0; c.edx = 1u; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = 1; ts[2] = 0;
    run_and_emit(0x6FCB85D0u, "STATES_RemoveFreezeOrShatterStateCallback_6FCB85D0_113c", k,
                 k == 0 ? "alive_mon_clears_1_and_6b" : k == 1 ? "dead_mon_clears_1_only" : k == 2 ? "alive_plr_clears_1_and_6b" : "dead_plr_clears_1_only",
                 &c, ts, 3, 0u, 0);
  }

  /* [B2-22] 0x6FC44030 MONUMOD_ApplyCursedAmplifyDamage_6FC44030_113c (ecx=pGame, edx=pAttacker, stack=[pTarget, nSkillLevel], ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 18u, 1u, 5000u, 5000u, 7201u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 0 ? 1u : 0u), (k == 0 ? 1u : 0u), 19u, 1u, 5005u, 5005u, 7202u);
    /* k=0: monster vs monster (non-hostile -> returns early); k=1/2: monster vs player slvl 1 / 5 -> applies Amplify Damage statlist! */
    uint32_t slvl = (k == 2) ? 5u : 1u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_UNIT1; c.args[1] = slvl; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = slvl;
    run_and_emit(0x6FC44030u, "MONUMOD_ApplyCursedAmplifyDamage_6FC44030_113c", k,
                 k == 0 ? "friendly_mon_noop" : k == 1 ? "hostile_plr_slvl1" : "hostile_plr_slvl5",
                 &c, ts, 4, 0u, 0);
  }

  /* [B2-23] 0x6FC44250 MONUMOD_OnHitApplyCursedAmplifyDamage_6FC44250_113c (ecx=pGame, edx=pAttacker, stack=[pDefender, bCanApply], ret 8, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_SCRATCH + 0x100u) = STAGE_ROOM0;
    U32(STAGE_ROOM0 + 0x00u)    = STAGE_SCRATCH + 0x100u;
    U32(STAGE_ROOM0 + 0x24u)    = 1u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 7301u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 21u, 1u, 5002u, 5002u, 7302u);
    U32(STAGE_ROOM0 + 0x74u) = STAGE_UNIT1;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, (k == 3 ? 25 : 5), 0);
    if (k == 1) {
      /* seed lo=0, hi=0 -> newLo = 0 -> (al & 3) == 0 < 1 -> skips curse! */
      U32(STAGE_UNIT0 + 0x20u) = 0u;
      U32(STAGE_UNIT0 + 0x24u) = 0u;
    } else if (k >= 2) {
      /* seed lo=0, hi=1 -> newLo = 1 -> (al & 3) == 1 >= 1 -> applies curse! */
      U32(STAGE_UNIT0 + 0x20u) = 0u;
      U32(STAGE_UNIT0 + 0x24u) = 1u;
    }
    uint32_t canApply = (k == 0) ? 0u : 1u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_UNIT1; c.args[1] = canApply; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = canApply;
    run_and_emit(0x6FC44250u, "MONUMOD_OnHitApplyCursedAmplifyDamage_6FC44250_113c", k,
                 k == 0 ? "bcanapply0_noop" : k == 1 ? "roll_0_misses_curse" : k == 2 ? "roll_1_curses_mlvl5" : "roll_1_curses_mlvl25",
                 &c, ts, 4, 0u, 0);
  }

  /* [B2-24] 0x6FC47190 STATES_OnSkillStateRemovedRefreshAnim_6FC47190_113c (ecx=pUnit, edx=nState, stack=[pStatList], ret 4, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t uArg = 0u;
    uint32_t stId = (k == 2) ? 15u : 10u;
    if (k >= 1) {
      uint32_t uType = (k == 3) ? 0u : 1u;
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, (uType == 1 ? 1u : 0u), 22u, 1u, 5000u, 5000u, 7401u);
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, (int32_t)stId, 1);
      uArg = STAGE_UNIT0;
    }
    c.ecx = uArg; c.edx = stId; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = uArg; ts[1] = stId; ts[2] = 0;
    run_and_emit(0x6FC47190u, "STATES_OnSkillStateRemovedRefreshAnim_6FC47190_113c", k,
                 k == 0 ? "null_unit_assert_a2a" : k == 1 ? "alive_mon_clears_state10" : k == 2 ? "alive_mon_clears_state15" : "alive_plr_clears_and_recalcs_pets",
                 &c, ts, 3, 0u, (k == 0 ? 1 : 0));
  }

  /* [B2-25] 0x6FC46520 MONUMOD_SpawnDeathNova_6FC46520_113c (ecx=pGame, edx=pMonster, stack=[pTarget, bTrigger], ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, 0u, 1u, 1u, 23u, 1u, 5000u, 5000u, 7501u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
    if (k == 2) {
      /* attach leader with skill 0x10c and low life pct */
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, 0u, 0u, 0u, 99u, 1u, 5000u, 5000u, 7502u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      void *pSl = fn_AllocSkillList(NULL);
      U32(STAGE_UNIT1 + 0xA8u) = (uint32_t)(uintptr_t)pSl;
      fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT1, 0x10C, 8, 1, 0, 0);
      uint32_t pAiGen = STAGE_SCRATCH;
      U32(STAGE_UDATA0 + 0x28u) = pAiGen;
      U32(pAiGen + 0x28u) = STAGE_GAME;
      U32(pAiGen + 0x2Cu) = 99u;
      U32(pAiGen + 0x30u) = 0u;
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 5 << 8, 0);
    }
    uint32_t trig = (k == 0) ? 0u : 1u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 0u; c.args[1] = trig; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 0; ts[4] = trig;
    run_and_emit(0x6FC46520u, "MONUMOD_SpawnDeathNova_6FC46520_113c", k,
                 k == 0 ? "trigger0_noop" : k == 1 ? "no_leader_slvl1" : "leader_skill10c_low_hp",
                 &c, ts, 5, 0u, 0);
  }

  /* [B2-26] 0x6FC2C000 STATES_OnRemoveImpregnatedSpawn_6FC2C000_113c (ecx=pUnit, edx=nState, stack=[pStatList], ret 4, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t uArg = 0u;
    uint32_t pSlArg = 0u;
    if (k >= 1) {
      /* k=1: alive monster (mode=1) -> clears state 0x6E, shouldSpawn=false;
         k=2: dead monster (mode=12) with null room -> clears state 0x6E, skips spawn;
         k=3: alive player (mode=1) -> clears state 0x6E, shouldSpawn=false */
      uint32_t uType = (k == 3) ? 0u : 1u;
      uint32_t mode  = (k == 2) ? 12u : 1u;
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, 0u, uType, (uType == 1 ? 1u : 0u), 24u, mode, 5000u, 5000u, 7601u);
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x6E, 1);
      uArg = STAGE_UNIT0;
    }
    c.ecx = uArg; c.edx = 0x6Eu; c.nargs = 1; c.args[0] = pSlArg; c.calleePop = 4u;
    ts[0] = uArg; ts[1] = 0x6E; ts[2] = pSlArg;
    run_and_emit(0x6FC2C000u, "STATES_OnRemoveImpregnatedSpawn_6FC2C000_113c", k,
                 k == 0 ? "null_unit_assert_a2a" : k == 1 ? "alive_mon_clears_6e" : k == 2 ? "dead_mon_null_room_clears_6e" : "alive_plr_clears_6e",
                 &c, ts, 3, 0u, (k == 0 ? 1 : 0));
  }

  /* [B2-27] 0x6FC44300 MONSTER_ApplyDeathExplosionSplashDamage_6FC44300_113c (ecx=pGame, edx=pUnit, stack=[arg0, arg1], ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    /* classId 0x227 / 0x208 / 1 with distinct MonStats fire damage range and seeds */
    uint32_t cls = (k == 0) ? 1u : (k == 1) ? 0x16Du : 0x227u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, 0u, 1u, cls, 25u, 1u, 5000u, 5000u, 7701u + (uint32_t)k * 31u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 10 + k * 15, 0);
    U8(STAGE_GAME + 0x6Du) = (uint8_t)k;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 0;
    run_and_emit(0x6FC44300u, "MONSTER_ApplyDeathExplosionSplashDamage_6FC44300_113c", k,
                 k == 0 ? "cls1_norm_null_room" : k == 1 ? "cls16d_nm_null_room" : "cls227_hell_null_room",
                 &c, ts, 4, 0u, 0);
  }

  /* [B2-28] 0x6FC960F0 MONSTER_NotifyOwnerOrDistributeExpOnDeath_6FC960F0_113c (eax=pMonster, stack=[pGame], ret 4, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t uArg = 0u;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 26u, 1u, 5000u, 5000u, 7801u);
      if (k >= 2) {
        U32(STAGE_UNIT0 + 0xC8u) = (1u << 10); /* flag bit 10 set */
        U32(STAGE_UNIT0 + 0x94u) = 1u;         /* owner type = monster */
        U32(STAGE_UNIT0 + 0x98u) = 55u;        /* owner guid = 55 */
      }
      if (k == 3) {
        stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 9999u, 55u, 1u, 5000u, 5000u, 7802u);
        insert_server_unit(STAGE_GAME, STAGE_UNIT1); /* owner found, oob classId -> returns cleanly */
      }
      uArg = STAGE_UNIT0;
    }
    c.eax = uArg; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = uArg; ts[1] = STAGE_GAME;
    run_and_emit(0x6FC960F0u, "MONSTER_NotifyOwnerOrDistributeExpOnDeath_6FC960F0_113c", k,
                 k == 0 ? "null_mon_noop" : k == 1 ? "bit10_clear_noop" : k == 2 ? "owner_not_found" : "owner_oob_class",
                 &c, ts, 2, 0u, 0);
  }

  /* [B2-29] 0x6FC418A0 MONUMOD_ApplyChampionBaseStats_6FC418A0_113c (ecx=pGame, edx=pMonster, stack=[nUModId, bBoss], ret 8, void) */
  for (int k = 0; k < 5; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0 ? 2u : 108u));
    /* switch on classId - 0x146: 0 (0x146), 1 (0x147), 3 (0x149), 4 (0x14A), default (1) */
    uint32_t cls = (k == 0) ? 0x146u : (k == 1) ? 0x147u : (k == 2) ? 0x149u : (k == 3) ? 0x14Au : 1u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, cls, 27u, 1u, 5000u, 5000u, 7901u);
    U8(STAGE_GAME + 0x6Du) = (k == 0) ? 0u : 2u; /* Normal vs Hell */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 0;
    run_and_emit(0x6FC418A0u, "MONUMOD_ApplyChampionBaseStats_6FC418A0_113c", k,
                 k == 0 ? "cls146_fire_norm" : k == 1 ? "cls147_phys_hell" : k == 2 ? "cls149_poison_hell" : k == 3 ? "cls14a_ltng_hell" : "cls1_default_hell",
                 &c, ts, 4, 0u, 0);
  }

  /* [B2-30] 0x6FC41FE0 MONUMOD_ApplyElementalDamageBonus_6FC41FE0_113c (edx=pGame, stack=[pUnit, nMinStatId, nMaxStatId, nLenStatId], ret 0x10, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t uType = (k == 2) ? 0u : 1u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, (uType == 1 ? 1u : 0u), 28u, 1u, 5000u, 5000u, 8001u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, (k == 0 ? 5 : k == 1 ? 45 : 75), 0);
    U8(STAGE_GAME + 0x6Du) = (uint8_t)(k == 0 ? 0u : k == 1 ? 1u : 2u);
    U8(STAGE_GAME + 0x6Au) = (k == 3) ? 1u : 0u;
    uint32_t minS = (k == 0) ? 48u : (k == 1) ? 50u : 54u; /* fire / ltng / cold */
    uint32_t maxS = minS + 1u;
    uint32_t lenS = (k >= 2) ? 56u : 0xFFFFFFFFu;
    c.edx = STAGE_GAME; c.nargs = 4; c.args[0] = STAGE_UNIT0; c.args[1] = minS; c.args[2] = maxS; c.args[3] = lenS; c.calleePop = 16u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = (int32_t)minS; ts[3] = (int32_t)maxS; ts[4] = (int32_t)lenS;
    run_and_emit(0x6FC41FE0u, "MONUMOD_ApplyElementalDamageBonus_6FC41FE0_113c", k,
                 k == 0 ? "mon_fire_norm_nolen" : k == 1 ? "mon_ltng_nm_nolen" : k == 2 ? "plr_cold_hell_with_len" : "mon_cold_exp_hell",
                 &c, ts, 5, 0u, 0);
  }

  /* [B2-31] 0x6FC43E20 MONUMOD_EventReviveOrCorpseCheck_6FC43E20_113c (ecx=pGame, edx=pUnit, stack=[arg0, arg1], ret 8, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    /* k=0: alive monster (mode=1) -> frees type2 event and returns;
       k=1: dead monster (mode=12) with flag +0x16 bit 3 -> returns;
       k=2: dead monster (mode=12) with good align (2) -> returns;
       k=3: dead monster (mode=12) with pAiGen+0x14 >= 2 (already revived twice) -> returns */
    uint32_t mode = (k == 0) ? 1u : 12u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, 0u, 1u, 1u, 29u, mode, 5000u, 5000u, 8101u);
    if (k == 1) {
      U8(STAGE_UDATA0 + 0x16u) = 0x08u;
    } else if (k == 2) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 172, 2, 0); /* alignment = 2 */
    } else if (k == 3) {
      uint32_t pAiGen = STAGE_SCRATCH;
      U32(STAGE_UDATA0 + 0x28u) = pAiGen;
      U32(pAiGen + 0x14u) = 2u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC43E20u, "MONUMOD_EventReviveOrCorpseCheck_6FC43E20_113c", k,
                 k == 0 ? "alive_mon_returns" : k == 1 ? "dead_flag8_returns" : k == 2 ? "dead_align2_returns" : "dead_revive_cap2_returns",
                 &c, ts, 2, 0u, 0);
  }
}

/* ------------------------------- Batch 3 Helpers (Missiles & Skills) */

static uint32_t stage_used_skill(uint32_t pUnit, int32_t skillId, int32_t lvl) {
  uint32_t pInfo = U32(pUnit + 0xA8u);
  if (pInfo == 0u) {
    pInfo = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    U32(pUnit + 0xA8u) = pInfo;
  }
  fn_SetSkillLevel((void *)(uintptr_t)pUnit, skillId, lvl, 1, 0, 0);
  uint32_t pSkill = U32(pInfo + 0x04u); /* pFirstSkill */
  U32(pInfo + 0x10u) = pSkill;          /* pUsedSkill */
  return pSkill;
}

static void stage_path_target(uint32_t pPath, uint32_t pTarget) {
  U32(pPath + 0x58u) = pTarget;
  U32(pPath + 0x5Cu) = pTarget ? U32(pTarget + 0x00u) : 0u;
  U32(pPath + 0x60u) = pTarget ? U32(pTarget + 0x0Cu) : 0u;
}

static void stage_missile_unit(
    uint32_t pUnit, uint32_t pUData, uint32_t pPath, uint32_t pRoom,
    uint32_t misCls, uint32_t guid, uint16_t x, uint16_t y, uint32_t seedLo,
    int hasOwner, uint32_t ownerType, uint32_t ownerGuid,
    uint16_t skillId, uint16_t skillLvl, uint16_t totalFr, uint16_t remFr, uint32_t targetX) {
  stage_unit_common(pUnit, pUData, pPath, pRoom, 3u, misCls, guid, 0u, x, y, seedLo);
  U16(pUData + 0x0Au) = skillId;
  U16(pUData + 0x0Cu) = skillLvl;
  U16(pUData + 0x0Eu) = totalFr;
  U16(pUData + 0x10u) = remFr;
  U32(pUData + 0x28u) = targetX;
  if (hasOwner) {
    U32(pUnit + 0x94u) = ownerType;
    U32(pUnit + 0x98u) = ownerGuid;
    U32(pUnit + 0xC8u) = (1u << 10);
  }
}

static void stage_room_self_adj(uint32_t pRoom, uint32_t scratchSlot) {
  U32(scratchSlot)     = pRoom;
  U32(pRoom + 0x00u)   = scratchSlot;
  U32(pRoom + 0x24u)   = 1u;
}

static void stage_existing_aura_statlist(uint32_t pTarget, uint32_t flags, int32_t stateId, uint32_t skId, uint32_t skLvl) {
  void *pSl = fn_AllocStatList(NULL, flags, 0u, (int32_t)U32(pTarget + 0x00u), (int32_t)U32(pTarget + 0x0Cu));
  fn_SetStatListState(pSl, stateId);
  U32((uintptr_t)pSl + 0x1Cu) = skId;
  U32((uintptr_t)pSl + 0x20u) = skLvl;
  fn_MergeStatLists((void *)(uintptr_t)pTarget, pSl, 1);
}

/* ------------------------------- Batch 3: 61 VAs (28 Missiles + 33 Skills) */

static void emit_batch_3(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [B3-01] 0x6FC59910 MISSILES_RedeemCorpseWithSkill124_6FC59910_113c (ecx=pGame, edx=pCaster, stack=[pCorpse, nLevel, 0], ret 0xc) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 3u, 1u, 1u, 5000u, 5000u, 9001u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 0x1000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 0x8000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 0x1000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 0x8000, 0);
    uint32_t corpseArg = 0u;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, (k == 1 ? 1u : 12u), 5002u, 5002u, 9002u);
      stage_mon_txt(STAGE_UDATA1, 1u);
      corpseArg = STAGE_UNIT1;
    }
    uint32_t lvl = (k == 2) ? 20u : 5u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 3; c.args[0] = corpseArg; c.args[1] = lvl; c.args[2] = 0u; c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = corpseArg; ts[3] = lvl; ts[4] = 0;
    run_and_emit(0x6FC59910u, "MISSILES_RedeemCorpseWithSkill124_6FC59910_113c", k,
                 k == 0 ? "null_corpse_0" : k == 1 ? "alive_mon_not_corpse_0" : "redeems_dead_corpse",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [B3-02] 0x6FC5BE70 MISSILE_SrvHit_SpawnPortalOnGroundImpact_6FC5BE70_113c (ecx=pGame, edx=pMissile, stack=[pTarget], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u); /* Town level 1 */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 2u, 1u, 5002u, 5002u, 9102u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    /* mis 288 has dwParam4=38; k=2 null room -> assert 0xe42; k=3 town+owner -> TargetX=1 + sound 0x18 + portal flag! */
    stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 2 ? 0u : STAGE_ROOM0), 288u, 20u, 5000u, 5000u, 9101u,
                       (k == 3 ? 1 : 0), 0u, 2u, 0u, 1u, 20u, 10u, 0u);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t tgtArg = (k == 1) ? STAGE_UNIT1 : 0u;
    c.ecx = STAGE_GAME; c.edx = misArg; c.nargs = 1; c.args[0] = tgtArg; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = misArg; ts[2] = tgtArg;
    run_and_emit(0x6FC5BE70u, "MISSILE_SrvHit_SpawnPortalOnGroundImpact_6FC5BE70_113c", k,
                 k == 0 ? "null_missile_0" : k == 1 ? "nonnull_target_skips" : k == 2 ? "null_room_assert_e42" : "town_owner_toggles_targetx_and_portal_flag",
                 &c, ts, 3, 0xFFFFFFFFu, (k == 2 ? 1 : 0));
  }

  /* [B3-03] 0x6FC5BD10 MISSILES_SrvDo_SpawnMissileParam0Monster_6FC5BD10_113c (ecx=pGame, edx=pMissile, stack=[bCollided], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t cls = (k == 1) ? 9999u : 43u; /* mis 43: dwHitParam0=1 (skeleton), dwHitParam1=2 */
    stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 2 ? STAGE_ROOM0 : 0u), cls, 20u, 5000u, 5000u, 9201u, 0, 0u, 0u, 0u, 1u, 20u, 10u, 0u);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = misArg; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = misArg; ts[2] = 0;
    run_and_emit(0x6FC5BD10u, "MISSILES_SrvDo_SpawnMissileParam0Monster_6FC5BD10_113c", k,
                 k == 0 ? "null_missile_1" : k == 1 ? "oob_class_1" : "spawns_param0_mon",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B3-04] 0x6FC5BC80 MISSILES_SrvDo_SpawnSkillParam1Monster_6FC5BC80_113c (ecx=pGame, edx=pMissile, stack=[bCollided], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 9301u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    if (k == 2) {
      uint32_t pSk = stage_used_skill(STAGE_UNIT0, 70, 3);
      U32(pSk + 0x18u) = 1u; /* dwParam1 = monster classId 1 */
    }
    stage_missile_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 20u, 5002u, 5002u, 9302u,
                       (k >= 1 ? 1 : 0), 0u, 1u, 70u, 3u, 20u, 10u, 0u);
    uint32_t col = (k == 0) ? 1u : 0u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT1; c.nargs = 1; c.args[0] = col; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT1; ts[2] = col;
    run_and_emit(0x6FC5BC80u, "MISSILES_SrvDo_SpawnSkillParam1Monster_6FC5BC80_113c", k,
                 k == 0 ? "collided1_skip" : k == 1 ? "owner_lacks_skill_skip" : "spawns_skill_param1_mon",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B3-05] 0x6FC61EB0 MISSILE_SrvDo_BlazeTrailAndFollowOwner_6FC61EB0_113c (ecx=pGame, edx=pMissile, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    /* Place missile at (5200,5200) > 100 subtiles from owner so 0x6FCC0000 exits before its TS m.alloc(0x5c) bug */
    uint16_t ox = (k == 2) ? 5040u : 5020u;
    uint16_t oy = (k == 2) ? 5050u : 5030u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, ox, oy, 9401u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_missile_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 106u, 20u, 5200u, 5200u, 9402u,
                       1, 0u, 1u, 46u, 3u, 20u, 10u, 0u);
    if (k == 2) U32(STAGE_PATH1 + 0x34u) = 0x08u; /* PATH flag 08 set */
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = misArg;
    ts[0] = STAGE_GAME; ts[1] = misArg;
    run_and_emit(0x6FC61EB0u, "MISSILE_SrvDo_BlazeTrailAndFollowOwner_6FC61EB0_113c", k,
                 k == 0 ? "null_missile_2" : k == 1 ? "flag08_clear_warps_1" : "flag08_set_dist_gt100_warps_1",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B3-06] 0x6FC61670 MISSILE_SrvDo_LinearWithParamScaledSubMissileMask05_6FC61670_113c (ecx=pGame, edx=pMissile, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    /* Avoid pMissile=0 because real 1.13c DLL derefs ds:0x18 on null pMissilesTxt */
    uint16_t lvl = (k == 0) ? 1u : 12u;
    uint16_t rem = (k == 2) ? 0u : 10u;
    stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 106u, 20u, 5000u, 5000u, 9501u,
                       0, 0u, 0u, 46u, lvl, 20u, rem, 0u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC61670u, "MISSILE_SrvDo_LinearWithParamScaledSubMissileMask05_6FC61670_113c", k,
                 k == 0 ? "lvl1_active_1" : k == 1 ? "lvl12_active_1" : "lvl12_expired_0",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B3-07] 0x6FC60420 MISSILE_SrvDo_PeriodicSubMissile1AndStep_6FC60420_113c (ecx=pGame, edx=pMissile, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 9601u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    /* mis 106: sub1=107, par1=5; place missile at (5200,5200) > 100 from owner to avoid TS 0x6FCC0000 m.alloc(0x5c) */
    uint16_t rem = (k == 1) ? 19u : (k == 2) ? 15u : 0u;
    stage_missile_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 106u, 20u, 5200u, 5200u, 9602u,
                       1, 0u, 1u, 46u, 3u, 20u, rem, 0u);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = misArg;
    ts[0] = STAGE_GAME; ts[1] = misArg;
    run_and_emit(0x6FC60420u, "MISSILE_SrvDo_PeriodicSubMissile1AndStep_6FC60420_113c", k,
                 k == 0 ? "null_missile_2" : k == 1 ? "elapsed1_no_spawn_1" : k == 2 ? "elapsed5_dist_gt100_steps_1" : "elapsed20_expired_0",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B3-08] 0x6FC60B20 MISSILE_SrvDo_RadamentDeathPortalAndSubMissiles_6FC60B20_113c (ecx=pGame, edx=pMissile, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    /* mis 288: sub1=289, rng=300, par=(40,2,17,38) */
    uint16_t rem = (k == 1) ? 280u : 0u;
    stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 288u, 20u, 5000u, 5000u, 9701u,
                       0, 0u, 0u, 0u, 1u, 300u, rem, 1u);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = misArg;
    ts[0] = STAGE_GAME; ts[1] = misArg;
    run_and_emit(0x6FC60B20u, "MISSILE_SrvDo_RadamentDeathPortalAndSubMissiles_6FC60B20_113c", k,
                 k == 0 ? "null_missile_2" : k == 1 ? "rem280_steps_1" : "rem0_expired_0",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B3-09] 0x6FC61B80 MISSILE_SrvDo_LinearWithTrailingCalc80SubMissile_6FC61B80_113c (ecx=pGame, edx=pMissile, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 9801u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t cls = (k == 2) ? 106u : 1u; /* 1: sub1=-1, 106: sub1=107 */
    uint16_t rem = (k == 1) ? 0u : 8u;
    stage_missile_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, cls, 20u, 5002u, 5002u, 9802u,
                       1, 0u, 1u, 46u, 3u, 20u, rem, 0u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT1;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT1;
    run_and_emit(0x6FC61B80u, "MISSILE_SrvDo_LinearWithTrailingCalc80SubMissile_6FC61B80_113c", k,
                 k == 0 ? "no_sub1_steps_1" : k == 1 ? "no_sub1_expired_0" : "sub1_107_trailing_1",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B3-10] 0x6FC5D800 MISSILE_SrvDmg_SpawnRing16SubMissiles_6FC5D800_113c (ecx=pGame, edx=pMissile, stack=[pTarget], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 9901u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    /* mis 564: hitSub1=563 (flg=0x21, srvDo=1, vel=(0,0), par1=0), hitPar=[1,0,0] */
    stage_missile_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 564u, 20u, 5002u, 5002u, 9902u,
                       (k == 2 ? 1 : 0), 0u, 1u, 36u, 2u, 20u, 10u, 0u);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = misArg; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = misArg; ts[2] = 0;
    run_and_emit(0x6FC5D800u, "MISSILE_SrvDmg_SpawnRing16SubMissiles_6FC5D800_113c", k,
                 k == 0 ? "null_missile_1" : k == 1 ? "no_owner_bit_1" : "spawns_ring_step1_vel0",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B3-11] 0x6FC5E330 MISSILE_SrvDmg_SpawnRing16WithOuterStepAndVel_6FC5E330_113c (ecx=pGame, edx=pMissile, stack=[pTarget], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 10001u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    /* mis 564: hitSub1=563 (flg=0x21, srvDo=1, vel=(0,0), par1=0), hitPar=[1,0,0] */
    stage_missile_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 564u, 20u, 5002u, 5002u, 10002u,
                       1, 0u, 1u, 36u, 2u, 20u, 10u, 0u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 1u, 2u, 1u, 5010u, 5015u, 10003u);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT1;
    uint32_t tgtArg = (k == 2) ? STAGE_UNIT2 : 0u;
    c.ecx = STAGE_GAME; c.edx = misArg; c.nargs = 1; c.args[0] = tgtArg; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = misArg; ts[2] = tgtArg;
    run_and_emit(0x6FC5E330u, "MISSILE_SrvDmg_SpawnRing16WithOuterStepAndVel_6FC5E330_113c", k,
                 k == 0 ? "null_missile_3" : k == 1 ? "origin_missile_spawns_ring" : "origin_target_spawns_ring",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B3-12] 0x6FC61DE0 MISSILE_SrvDo_GuidedWithPathFlag08SubMissile_6FC61DE0_113c (ecx=pGame, edx=pMissile, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 10101u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_missile_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 106u, 20u, 5002u, 5002u, 10102u,
                       1, 0u, 1u, 46u, 3u, 20u, (uint16_t)(k == 2 ? 0u : 8u), 0u);
    if (k == 2) U32(STAGE_PATH1 + 0x34u) = 0x08u;
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = misArg;
    ts[0] = STAGE_GAME; ts[1] = misArg;
    run_and_emit(0x6FC61DE0u, "MISSILE_SrvDo_GuidedWithPathFlag08SubMissile_6FC61DE0_113c", k,
                 k == 0 ? "null_missile_2" : k == 1 ? "flag08_clear_steps" : "flag08_set_spawns_sub",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B3-13] 0x6FC5B070 MISSILES_RetargetGuidedProjectileInRadius_6FC5B070_113c (eax=pMissile, stack=[pGame], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 10201u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_missile_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 106u, 20u, 5002u, 5002u, 10202u,
                       (k == 2 ? 0 : 1), 0u, 1u, 22u, 3u, 20u, 10u, (k == 1 ? 4u : 0u));
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT1;
    c.eax = misArg; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = misArg; ts[1] = STAGE_GAME;
    run_and_emit(0x6FC5B070u, "MISSILES_RetargetGuidedProjectileInRadius_6FC5B070_113c", k,
                 k == 0 ? "null_missile_1" : k == 1 ? "targetx_bit4_1" : k == 2 ? "no_owner_bit_1" : "scans_and_reinits_path_0",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B3-14] 0x6FC5CD00 MISSILES_AuraCallback_SpawnSubMissileStrictCount_6FC5CD00_113c (ecx=pAuraCtx, edx=pTarget, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 10301u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, 1u, (uint16_t)(5010u + k * 5u), (uint16_t)(5012u + k * 3u), 10302u);
    uint32_t pAura = STAGE_SCRATCH;
    uint32_t pUser = STAGE_SCRATCH + 0x40u;
    U32(pAura + 0x00u) = STAGE_GAME;
    U32(pAura + 0x08u) = (k == 0) ? 3u : (uint32_t)(k - 1); /* current count */
    U32(pAura + 0x0Cu) = pUser;
    U32(pUser + 0x00u) = STAGE_UNIT0; /* owner */
    U32(pUser + 0x04u) = STAGE_UNIT0; /* origin */
    U32(pUser + 0x08u) = 36u;         /* skillId */
    U32(pUser + 0x0Cu) = 3u;          /* level */
    U32(pUser + 0x10u) = 3u;          /* max count */
    U32(pUser + 0x14u) = 107u;        /* subMissileId */
    c.ecx = pAura; c.edx = STAGE_UNIT1;
    ts[0] = pAura; ts[1] = STAGE_UNIT1;
    run_and_emit(0x6FC5CD00u, "MISSILES_AuraCallback_SpawnSubMissileStrictCount_6FC5CD00_113c", k,
                 k == 0 ? "cap_reached_0" : k == 1 ? "spawns_sub_at_t1_1" : "spawns_sub_at_t2_1",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B3-15] 0x6FC5CC30 MISSILES_AuraCallback_SpawnSubMissileOnTarget_6FC5CC30_113c (ecx=pAuraCtx, edx=pTarget, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 10401u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, 1u, (uint16_t)(5015u + k * 4u), (uint16_t)(5018u + k * 2u), 10402u);
    uint32_t pAura = STAGE_SCRATCH;
    uint32_t pUser = STAGE_SCRATCH + 0x40u;
    U32(pAura + 0x00u) = STAGE_GAME;
    U32(pAura + 0x08u) = (k == 0) ? 2u : 5u;
    U32(pAura + 0x0Cu) = pUser;
    U32(pUser + 0x00u) = STAGE_UNIT0;
    U32(pUser + 0x04u) = STAGE_UNIT0;
    U32(pUser + 0x08u) = 36u;
    U32(pUser + 0x0Cu) = 4u;
    U32(pUser + 0x10u) = (k == 0) ? 2u : (k == 1) ? 0u : 10u; /* 0 = unlimited */
    U32(pUser + 0x14u) = 107u;
    c.ecx = pAura; c.edx = STAGE_UNIT1;
    ts[0] = pAura; ts[1] = STAGE_UNIT1;
    run_and_emit(0x6FC5CC30u, "MISSILES_AuraCallback_SpawnSubMissileOnTarget_6FC5CC30_113c", k,
                 k == 0 ? "cap_reached_0" : k == 1 ? "max0_unlimited_spawns_1" : "under_cap_spawns_1",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B3-16] 0x6FC5DA60 MISSILE_SrvDmg_SpawnRadial8SubMissiles_6FC5DA60_113c (ecx=pGame, edx=pMissile, stack=[pTarget], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 10501u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    /* mis 564: hitSub1=563 (flg=0x21, srvDo=1, vel=(0,0), par1=0), hitPar=[1,0,0] */
    stage_missile_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 564u, 20u, 5002u, 5002u, 10502u,
                       (k == 1 ? 0 : 1), 0u, 1u, 36u, 2u, 20u, 10u, 0u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 1u, 2u, 1u, 5012u, 5014u, 10503u);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT1;
    uint32_t tgtArg = (k == 3) ? STAGE_UNIT2 : 0u;
    c.ecx = STAGE_GAME; c.edx = misArg; c.nargs = 1; c.args[0] = tgtArg; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = misArg; ts[2] = tgtArg;
    run_and_emit(0x6FC5DA60u, "MISSILE_SrvDmg_SpawnRadial8SubMissiles_6FC5DA60_113c", k,
                 k == 0 ? "null_missile_1" : k == 1 ? "no_owner_bit_1" : k == 2 ? "radial8_from_missile_3" : "radial8_from_target_3",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B3-17] 0x6FC605E0 MISSILE_SrvDo_TrailSubMissile_6FC605E0_113c (ecx=pGame, edx=pMissile, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 10601u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_missile_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 106u, 20u, 5002u, 5002u, 10602u,
                       1, 0u, 1u, 46u, 3u, 20u, (uint16_t)(k == 3 ? 0u : 10u), 0u);
    if (k == 2) U32(STAGE_PATH1 + 0x34u) = 0x08u;
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = misArg;
    ts[0] = STAGE_GAME; ts[1] = misArg;
    run_and_emit(0x6FC605E0u, "MISSILE_SrvDo_TrailSubMissile_6FC605E0_113c", k,
                 k == 0 ? "null_missile_2" : k == 1 ? "flag08_clear_steps_1" : k == 2 ? "flag08_set_spawns_trail_1" : "expired_0",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B3-18] 0x6FC5CDD0 MISSILES_SrvDmg10_SpawnSubMissileAtSelfPos_6FC5CDD0_113c (ecx=pGame, edx=pMissile, stack=[pTarget], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 10701u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_missile_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 43u, 20u, 5004u, 5006u, 10702u,
                       (k == 1 ? 0 : 1), 0u, 1u, 36u, 2u, 20u, 10u, 0u);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = misArg; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = misArg; ts[2] = 0;
    run_and_emit(0x6FC5CDD0u, "MISSILES_SrvDmg10_SpawnSubMissileAtSelfPos_6FC5CDD0_113c", k,
                 k == 0 ? "null_missile_1" : k == 1 ? "no_owner_bit_1" : "spawns_sub221_at_self",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B3-19] 0x6FC5F120 MISSILES_SrvDmg35_SpawnSubMissilesAndCollide_6FC5F120_113c (ecx=pGame, edx=pMissile, stack=[pTarget], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 10801u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t cls = (k == 1) ? 1u : 43u;
    stage_missile_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, cls, 20u, 5002u, 5002u, 10802u,
                       1, 0u, 1u, 36u, 2u, 20u, 10u, 0u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 1u, 2u, 1u, 5005u, 5005u, 10803u);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = misArg; c.nargs = 1; c.args[0] = STAGE_UNIT2; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = misArg; ts[2] = STAGE_UNIT2;
    run_and_emit(0x6FC5F120u, "MISSILES_SrvDmg35_SpawnSubMissilesAndCollide_6FC5F120_113c", k,
                 k == 0 ? "null_missile_1" : k == 1 ? "no_hitsub_1" : "spawns_hitsub_and_collides",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B3-20] 0x6FC5C160 MISSILES_SrvDmg03_SpawnSubMissiles123_6FC5C160_113c (ecx=pGame, edx=pMissile, stack=[pTarget], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 10901u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t cls = (k == 1) ? 1u : 43u;
    stage_missile_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, cls, 20u, 5002u, 5002u, 10902u,
                       1, 0u, 1u, 36u, 2u, 20u, 10u, 0u);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = misArg; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = misArg; ts[2] = 0;
    run_and_emit(0x6FC5C160u, "MISSILES_SrvDmg03_SpawnSubMissiles123_6FC5C160_113c", k,
                 k == 0 ? "null_missile_1" : k == 1 ? "no_hitsub_1" : "spawns_hitsub221",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B3-21] 0x6FC604D0 MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask45_6FC604D0_113c (ecx=pGame, edx=pMissile, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 11001u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint16_t skId = (k == 1) ? 999u : 12u; /* 12 has valid c1/c2 */
    uint16_t rem  = (k == 3) ? 0u : 10u;
    stage_missile_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 106u, 20u, 5002u, 5002u, 11002u,
                       1, 0u, 1u, skId, 3u, 20u, rem, 0u);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = misArg;
    ts[0] = STAGE_GAME; ts[1] = misArg;
    run_and_emit(0x6FC604D0u, "MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask45_6FC604D0_113c", k,
                 k == 0 ? "null_missile_2" : k == 1 ? "oob_skill_2" : k == 2 ? "active_steps_1" : "expired_0",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B3-22] 0x6FC5F550 MISSILE_SrvDo_SpawnTimedSubMissilesAndStep_6FC5F550_113c (ecx=pGame, edx=pMissile, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 11101u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    /* mis 106: sub1=107, par1=5; place missile at (5200,5200) > 100 from owner to avoid TS 0x6FCC0000 m.alloc(0x5c) */
    uint16_t rem = (k == 1) ? 18u : (k == 2) ? 15u : 0u;
    stage_missile_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 106u, 20u, 5200u, 5200u, 11102u,
                       1, 0u, 1u, 46u, 3u, 20u, rem, 0u);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = misArg;
    ts[0] = STAGE_GAME; ts[1] = misArg;
    run_and_emit(0x6FC5F550u, "MISSILE_SrvDo_SpawnTimedSubMissilesAndStep_6FC5F550_113c", k,
                 k == 0 ? "null_missile_2" : k == 1 ? "elapsed2_steps_only_1" : k == 2 ? "elapsed5_dist_gt100_steps_1" : "elapsed20_expired_0",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B3-23] 0x6FC5FD30 MISSILES_SrvDo16_RedemptionManaHealOnFrame_6FC5FD30_113c (ecx=pGame, edx=pMissile, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 3u, 1u, 1u, 5000u, 5000u, 11201u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 0x1000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 0x8000, 0);
    /* mis 106: par1=5; sk 124 Redemption */
    uint16_t rem = (k == 1) ? 18u : 15u;
    stage_missile_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 106u, 20u, 5002u, 5002u, 11202u,
                       1, 0u, 1u, 124u, 5u, 20u, rem, 0u);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = misArg;
    ts[0] = STAGE_GAME; ts[1] = misArg;
    run_and_emit(0x6FC5FD30u, "MISSILES_SrvDo16_RedemptionManaHealOnFrame_6FC5FD30_113c", k,
                 k == 0 ? "null_missile_2" : k == 1 ? "elapsed2_no_heal" : "elapsed5_heals_owner_mana",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B3-24] 0x6FC5FED0 MISSILES_SrvDo17_RedemptionLifeHealOnFrame_6FC5FED0_113c (ecx=pGame, edx=pMissile, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 3u, 1u, 1u, 5000u, 5000u, 11301u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 0x1000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 0x8000, 0);
    uint16_t rem = (k == 1) ? 18u : 15u;
    stage_missile_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 106u, 20u, 5002u, 5002u, 11302u,
                       1, 0u, 1u, 124u, 5u, 20u, rem, 0u);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = misArg;
    ts[0] = STAGE_GAME; ts[1] = misArg;
    run_and_emit(0x6FC5FED0u, "MISSILES_SrvDo17_RedemptionLifeHealOnFrame_6FC5FED0_113c", k,
                 k == 0 ? "null_missile_2" : k == 1 ? "elapsed2_no_heal" : "elapsed5_heals_owner_life",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B3-25] 0x6FC5E670 MISSILES_SrvDo_OpenTownPortalObject_6FC5E670_113c (ecx=pGame, edx=pMissile, stack=[bCollided], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 20u, 5000u, 5000u, 11401u,
                       0, 0u, 0u, 0u, 1u, 20u, 10u, (k == 2 ? 999u : 55u));
    if (k == 3) {
      /* mode=1 avoids UNITS_ChangeAnimMode113c while toggling room portal flag! */
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 0x3Bu, 55u, 1u, 5000u, 5000u, 11402u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    uint32_t gArg = (k == 1) ? 0u : STAGE_GAME;
    uint32_t col  = (k == 0) ? 1u : 0u;
    c.ecx = gArg; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = col; c.calleePop = 4u;
    ts[0] = gArg; ts[1] = STAGE_UNIT0; ts[2] = col;
    run_and_emit(0x6FC5E670u, "MISSILES_SrvDo_OpenTownPortalObject_6FC5E670_113c", k,
                 k == 0 ? "collided1_0" : k == 1 ? "null_game_assert_2d3" : k == 2 ? "portal_not_found_0" : "portal_mode1_toggles_room_flag",
                 &c, ts, 3, 0xFFFFFFFFu, (k == 1 ? 1 : 0));
  }

  /* [B3-26] 0x6FC5C030 skipped: spawns hardcoded missile 0 (vel=24) hitting TS PATH_Compute113c dwVelocityChangeCounter=0x0F bug */

  /* [B3-27] 0x6FC61110 MISSILE_SrvDo_TrailOwnerSubMissile_6FC61110_113c (ecx=pGame, edx=pMissile, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 11601u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_missile_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 106u, 20u, 5002u, 5002u, 11602u,
                       1, 0u, 1u, 46u, 3u, 20u, 10u, 0u);
    if (k == 2) U32(STAGE_PATH1 + 0x34u) = 0x08u;
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = misArg;
    ts[0] = STAGE_GAME; ts[1] = misArg;
    run_and_emit(0x6FC61110u, "MISSILE_SrvDo_TrailOwnerSubMissile_6FC61110_113c", k,
                 k == 0 ? "null_missile_2" : k == 1 ? "flag08_clear_steps_1" : "flag08_set_spawns_trail_1",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B3-28] 0x6FC61520 MISSILE_SrvDo_TrailInlineCoordSubMissile_6FC61520_113c (ecx=pGame, edx=pMissile, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 11701u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    /* Avoid pMissile=0 because real 1.13c DLL derefs ds:0x18 on null pMissilesTxt */
    stage_missile_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 106u, 20u, 5002u, 5004u, 11702u,
                       1, 0u, 1u, 46u, 3u, 20u, (uint16_t)(k == 1 ? 0u : 10u), 0u);
    if (k == 2) U32(STAGE_PATH1 + 0x34u) = 0x08u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT1;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT1;
    run_and_emit(0x6FC61520u, "MISSILE_SrvDo_TrailInlineCoordSubMissile_6FC61520_113c", k,
                 k == 0 ? "flag08_clear_steps_1" : k == 1 ? "flag08_clear_expired_0" : "flag08_set_spawns_trail_1",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* ---- Batch 3B: Skills (33 VAs) ---- */

  /* [B3-29] 0x6FC2C8D0 SKILLS_SetTargetAndDoNihlathakCorpseExplosion_6FC2C8D0_113c (ecx=pGame, edx=pUnit, stack=[pTarget, nLvl, 0], ret 0xc) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 1u, 1u, 5000u, 5000u, 11801u);
    uint32_t tgtArg = 0u;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, (k == 1 ? 1u : 12u), 5002u, 5002u, 11802u);
      stage_mon_txt(STAGE_UDATA1, 1u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x4000, 0);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      tgtArg = STAGE_UNIT1;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 3; c.args[0] = tgtArg; c.args[1] = 5u; c.args[2] = 0u; c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = tgtArg; ts[3] = 5; ts[4] = 0;
    run_and_emit(0x6FC2C8D0u, "SKILLS_SetTargetAndDoNihlathakCorpseExplosion_6FC2C8D0_113c", k,
                 k == 0 ? "null_target_0" : k == 1 ? "alive_target_not_corpse_0" : "explodes_dead_corpse_1",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [B3-30] 0x6FC2D530 SKILLS_SrvDo006_SpawnSubClassIndexedMissile_6FC2D530_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 1u, 1u, 5000u, 5000u, 11901u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 2u, 1u, 5008u, 5006u, 11902u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    uint32_t skId = (k == 0) ? 999u : (k == 1) ? 6u : 59u; /* 6: srvMis=-1; 59: srvMis=158 (158/159 vel=(0,0)) */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = skId; c.args[1] = 3u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 3;
    run_and_emit(0x6FC2D530u, "SKILLS_SrvDo006_SpawnSubClassIndexedMissile_6FC2D530_113c", k,
                 k == 0 ? "oob_skill_0" : k == 1 ? "no_srvmis_0" : "spawns_indexed_missile_1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-31] 0x6FC2D7B0 SKILLS_SrvDo_SpawnChargedBoltFanByCalc1_6FC2D7B0_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 12001u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, 1u, 5008u, 5006u, 12002u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    uint32_t skId = (k == 0) ? 999u : (k == 1) ? 6u : 56u; /* 56 = Meteor: srvMis=101 (vel=(0,0)), calc1 > 0 */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = skId; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 1;
    run_and_emit(0x6FC2D7B0u, "SKILLS_SrvDo_SpawnChargedBoltFanByCalc1_6FC2D7B0_113c", k,
                 k == 0 ? "oob_skill_0" : k == 1 ? "no_srvmis_0" : "spawns_vel0_fan_1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-32] 0x6FC2C6B0 SKILLS_ApplyAuraStateWithStatCalcs_6FC2C6B0_113c (edi=nSkillId, edx=pTarget, ebx=nLvl, stack=[pUnit], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 12101u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, 1u, 5004u, 5004u, 12102u);
    /* sk 66 = Amplify Damage (wAuraState2=9, curse flag 0x20), sk 99 = Prayer (wAuraState2=34, flag 0x02) */
    uint32_t skId = (k == 0) ? 999u : (k == 1) ? 66u : 99u;
    uint32_t lvl  = (k == 2) ? 5u : 1u;
    if (k == 1) stage_existing_aura_statlist(STAGE_UNIT1, 0x20u, 9, 66u, 1u);
    if (k == 2) stage_existing_aura_statlist(STAGE_UNIT1, 0x02u, 34, 99u, 5u);
    c.edi = skId; c.edx = STAGE_UNIT1; c.ebx = lvl; c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = skId; ts[1] = STAGE_UNIT1; ts[2] = lvl; ts[3] = STAGE_UNIT0;
    run_and_emit(0x6FC2C6B0u, "SKILLS_ApplyAuraStateWithStatCalcs_6FC2C6B0_113c", k,
                 k == 0 ? "oob_skill_noop" : k == 1 ? "amp_damage_state9" : "prayer_state34",
                 &c, ts, 4, 0u, 0);
  }

  /* [B3-33] 0x6FC2DD50 SKILLS_SrvDo009_CorpseConsumeAuraBuff_6FC2DD50_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLvl], ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 1u, 1u, 5000u, 5000u, 12201u);
    if (k >= 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, (k == 2 ? 1u : 12u), 5002u, 5002u, 12202u);
      stage_mon_txt(STAGE_UDATA1, 1u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    }
    uint32_t skId = (k == 0) ? 999u : 151u; /* 151: auraState=174 */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = skId; c.args[1] = 3u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 3;
    run_and_emit(0x6FC2DD50u, "SKILLS_SrvDo009_CorpseConsumeAuraBuff_6FC2DD50_113c", k,
                 k == 0 ? "oob_skill_0" : k == 1 ? "no_target_0" : k == 2 ? "alive_target_not_corpse_0" : "consumes_corpse_and_buffs",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-34] 0x6FC65410 SKILLS_SpawnChargedSrvMissileWithTargetId_6FC65410_113c (eax=nSkillId, ebx=pUnit, stack=[pGame, pTarget, nLvl, nSub], ret 0x10, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 12301u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 42u, 1u, 5004u, 5004u, 12302u);
    /* k=2: sk 59 (srvMis=158, vel=(0,0)) with pTarget=0; k=3: sk 46 (srvMis=67, vel=(0,0)) with pTarget=UNIT1 */
    uint32_t skId = (k == 0) ? 999u : (k == 1) ? 6u : (k == 2) ? 59u : 46u;
    uint32_t tgt  = (k == 3) ? STAGE_UNIT1 : 0u;
    c.eax = skId; c.ebx = STAGE_UNIT0; c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = tgt; c.args[2] = 5u; c.args[3] = 1u; c.calleePop = 16u;
    ts[0] = skId; ts[1] = STAGE_UNIT0; ts[2] = tgt; ts[3] = STAGE_GAME; ts[4] = 5; ts[5] = 1;
    run_and_emit(0x6FC65410u, "SKILLS_SpawnChargedSrvMissileWithTargetId_6FC65410_113c", k,
                 k == 0 ? "oob_skill_noop" : k == 1 ? "no_charged_mis_noop" : k == 2 ? "spawns_null_target_6_neg1" : "spawns_with_target_1_42",
                 &c, ts, 6, 0u, 0);
  }

  /* [B3-35] 0x6FC2D290 SKILLS_SrvDo004_SpawnMissileWithDeltaTargetXY_6FC2D290_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 12401u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, 1u, 5008u, 5004u, 12402u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    uint32_t skId = (k == 0) ? 999u : (k == 1) ? 6u : 59u; /* sk 59: srvMis=158 vel=(0,0) */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = skId; c.args[1] = 3u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 3;
    run_and_emit(0x6FC2D290u, "SKILLS_SrvDo004_SpawnMissileWithDeltaTargetXY_6FC2D290_113c", k,
                 k == 0 ? "oob_skill_0" : k == 1 ? "no_srvmis_0" : "spawns_delta_xy_missile_1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-36] 0x6FC2C310 SKILLS_SrvDo128_MinionAttackCmd_6FC2C310_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLvl], ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t uType = (k == 2) ? 0u : 1u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, (uType == 1 ? 1u : 0u), 1u, 1u, 5000u, 5000u, 12501u);
    if (k >= 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 2u, 1u, 5004u, 5004u, 12502u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    }
    uint32_t skId = (k == 0) ? 999u : 12u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = skId; c.args[1] = 3u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 3;
    run_and_emit(0x6FC2C310u, "SKILLS_SrvDo128_MinionAttackCmd_6FC2C310_113c", k,
                 k == 0 ? "oob_skill_0" : k == 1 ? "no_target_0" : k == 2 ? "non_monster_caster_0" : "broadcasts_minion_cmd_1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-37] 0x6FC59930 SKILLS_RedemptionCorpseCallback_6FC59930_113c (ecx=pGame, edx=pOwner, stack=[pCorpse, nLevel, 0], ret 0xc, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 3u, 1u, 1u, 5000u, 5000u, 12601u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 0x1000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 0x8000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 0x1000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 0x8000, 0);
    uint32_t corpseArg = 0u;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, (k == 1 ? 1u : 12u), 5002u, 5002u, 12602u);
      stage_mon_txt(STAGE_UDATA1, 1u);
      corpseArg = STAGE_UNIT1;
    }
    uint32_t lvl = (k == 2) ? 20u : 5u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 3; c.args[0] = corpseArg; c.args[1] = lvl; c.args[2] = 0u; c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = corpseArg; ts[3] = lvl; ts[4] = 0;
    run_and_emit(0x6FC59930u, "SKILLS_RedemptionCorpseCallback_6FC59930_113c", k,
                 k == 0 ? "null_corpse_noop" : k == 1 ? "alive_mon_noop" : "redeems_and_heals_owner",
                 &c, ts, 5, 0u, 0);
  }

  /* [B3-38] 0x6FC651B0 skipped: TS passes stack pDmg directly to SUNITDMG_ExecuteEvents113c instead of 0 */

  /* [B3-39] 0x6FC63610 SKILLS_SrvDo042_SpawnSrvMissileWithDeltaAndRange_6FC63610_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 12801u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, 1u, 5008u, 5004u, 12802u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    uint32_t skId = (k == 0) ? 999u : (k == 1) ? 6u : 59u; /* sk 59: srvMis=158 vel=(0,0) */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = skId; c.args[1] = 3u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 3;
    run_and_emit(0x6FC63610u, "SKILLS_SrvDo042_SpawnSrvMissileWithDeltaAndRange_6FC63610_113c", k,
                 k == 0 ? "oob_skill_0" : k == 1 ? "no_srvmis_0" : "spawns_delta_range_missile_1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-40] 0x6FC6C720 SKILLS_SrvDo054_MeleeHitZeroBonus_6FC6C720_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 3u, 1u, 1u, 5000u, 5000u, 12901u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 20, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 19, 500, 0);
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, 1u, 5002u, 5002u, 12902u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x8000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x8000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 5, 0);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    }
    uint32_t skId = (k == 1) ? 999u : 97u; /* Smite */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = skId; c.args[1] = 4u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 4;
    run_and_emit(0x6FC6C720u, "SKILLS_SrvDo054_MeleeHitZeroBonus_6FC6C720_113c", k,
                 k == 0 ? "no_target_0" : k == 1 ? "oob_skill_0" : "melee_hit_zero_bonus_1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-41] 0x6FC62C70 SKILLS_SrvEvent02_ApplyCalcFreezeAndState_6FC62C70_113c (ecx=pGame, edx=nEvent, stack=[pUnit, pTarget, pDmg, nSkillId, nLvl], ret 0x14) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 13001u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 1 ? 2u : 1u), 1u, 2u, 1u, 5002u, 5002u, 13002u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x8000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x8000, 0);
    S32(STAGE_DMG + 0x08u) = (k == 2) ? 0 : 100;
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = 2u; c.nargs = 5;
    c.args[0] = uArg; c.args[1] = STAGE_UNIT1; c.args[2] = STAGE_DMG; c.args[3] = 50u; c.args[4] = 5u; /* sk 50 Shiver Armor */
    c.calleePop = 20u;
    ts[0] = STAGE_GAME; ts[1] = 2; ts[2] = uArg; ts[3] = STAGE_UNIT1; ts[4] = STAGE_DMG; ts[5] = 50; ts[6] = 5;
    run_and_emit(0x6FC62C70u, "SKILLS_SrvEvent02_ApplyCalcFreezeAndState_6FC62C70_113c", k,
                 k == 0 ? "null_unit_0" : k == 1 ? "object_target_0" : k == 2 ? "zero_dmg_0" : "applies_freeze_and_state_1",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [B3-42] 0x6FC2C1F0 SKILLS_FindHostileUseableCorpseInRange_6FC2C1F0_113c (esi=pUnit, stack=[pGame, nRange], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 13101u);
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, (k == 1 ? 1u : 12u), 5003u, 5003u, 13102u);
      stage_mon_txt(STAGE_UDATA1, 1u);
      U32(STAGE_ROOM0 + 0x74u) = STAGE_UNIT1;
    }
    c.esi = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = 15u; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = 15;
    run_and_emit(0x6FC2C1F0u, "SKILLS_FindHostileUseableCorpseInRange_6FC2C1F0_113c", k,
                 k == 0 ? "empty_room_0" : k == 1 ? "alive_mon_not_corpse_0" : "finds_dead_corpse_unit1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B3-43] 0x6FC2D170 SKILLS_SrvDo_PackLeaderMarkAndFireMissile_6FC2D170_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLvl], ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t uType = (k == 0) ? 0u : 1u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, (uType == 1 ? 1u : 0u), 1u, 1u, 5000u, 5000u, 13201u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 99u, 1u, 5001u, 5001u, 13202u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 0u, 0u, 2u, 1u, 5006u, 5006u, 13203u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    if (k >= 2) {
      uint32_t pAiGen = STAGE_SCRATCH;
      U32(STAGE_UDATA0 + 0x28u) = pAiGen;
      U32(pAiGen + 0x28u) = STAGE_GAME;
      U32(pAiGen + 0x2Cu) = 99u;
      U32(pAiGen + 0x30u) = 1u;
      stage_path_target(STAGE_PATH0, STAGE_UNIT2);
      if (k == 2) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT2, 0x76, 1); /* already marked -> returns 0 */
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 59u; c.args[1] = 3u; c.calleePop = 8u; /* sk 59: vel=(0,0) */
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 59; ts[3] = 3;
    run_and_emit(0x6FC2D170u, "SKILLS_SrvDo_PackLeaderMarkAndFireMissile_6FC2D170_113c", k,
                 k == 0 ? "non_monster_0" : k == 1 ? "no_leader_0" : k == 2 ? "target_already_state76_0" : "marks_76_and_fires_1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-44] 0x6FC46E40 SKILLS_CalcWhirlwindFrameInterval_6FC46E40_113c (esi=pUnit, stack=[pGame, pSkill], ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t uType = (k == 0) ? 1u : 0u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, (uType == 1 ? 1u : 4u), 1u, 1u, 5000u, 5000u, 13301u);
    uint32_t pSk = stage_used_skill(STAGE_UNIT0, 151, 5);
    if (k == 1) {
      U32(STAGE_GAME + 0x70u) = 0u; /* Classic -> always 1 */
    } else if (k == 2) {
      U32(pSk + 0x24u) = 120u; /* nNextFrame=120 > dwCurFrame=100 -> 0 */
    } else if (k == 3) {
      U32(pSk + 0x24u) = 0u;   /* first hit -> sets nextFrame=104, returns 1 */
    }
    c.esi = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = pSk; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = pSk;
    run_and_emit(0x6FC46E40u, "SKILLS_CalcWhirlwindFrameInterval_6FC46E40_113c", k,
                 k == 0 ? "monster_coinflip" : k == 1 ? "classic_1" : k == 2 ? "waiting_next_frame_0" : "init_next_frame_104_1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B3-45] 0x6FC2DB00 SKILLS_DismountImpFromSiegeBeast_6FC2DB00_113c (esi=pBeast, eax=pImp, stack=[pGame, 0], ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    /* 0x1EC = Siege Beast, 0x1B3 = Demon Imp */
    uint32_t beastCls = (k == 0) ? 1u : 0x1ECu;
    uint32_t impCls   = (k == 1) ? 1u : 0x1B3u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, beastCls, 1u, 1u, 5000u, 5000u, 13401u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, impCls, 2u, 1u, 5000u, 5000u, 13402u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 0x4000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 0x8000, 0); /* 50% life >= 10 -> non-kill path */
    fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x8F, 1);
    c.esi = STAGE_UNIT0; c.eax = STAGE_UNIT1; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = STAGE_GAME; ts[3] = 0;
    run_and_emit(0x6FC2DB00u, "SKILLS_DismountImpFromSiegeBeast_6FC2DB00_113c", k,
                 k == 0 ? "wrong_beast_noop" : k == 1 ? "wrong_imp_noop" : "dismounts_clears_8f_and_sets_flags",
                 &c, ts, 4, 0u, 0);
  }

  /* [B3-46] 0x6FC47600 SKILLS_SrvDo018_FindPotion_6FC47600_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLvl], ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 1u, 1u, 5000u, 5000u, 13501u);
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, (k == 1 ? 1u : 12u), 5002u, 5002u, 13502u);
      stage_mon_txt(STAGE_UDATA1, 1u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
      if (k == 2) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT1, 0x76, 1);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 131u; c.args[1] = 1u; c.calleePop = 8u; /* 131 = Find Potion */
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 131; ts[3] = 1;
    run_and_emit(0x6FC47600u, "SKILLS_SrvDo018_FindPotion_6FC47600_113c", k,
                 k == 0 ? "no_target_0" : k == 1 ? "alive_mon_0" : k == 2 ? "already_marked_76_0" : "marks_corpse_76_and_rolls",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-47] 0x6FC64ED0 SKILLS_SrvDo035_MeleeSkillHitWithWeaponFill_6FC64ED0_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 1u, 1u, 5000u, 5000u, 13601u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 20, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 19, 500, 0);
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, 1u, 5002u, 5002u, 13602u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x8000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x8000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 5, 0);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    }
    uint32_t skId = (k == 0) ? 999u : 133u; /* Double Swing */
    uint32_t lvl  = (k == 2) ? 8u : 3u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = skId; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = lvl;
    run_and_emit(0x6FC64ED0u, "SKILLS_SrvDo035_MeleeSkillHitWithWeaponFill_6FC64ED0_113c", k,
                 k == 0 ? "oob_skill_0" : k == 1 ? "melee_hit_lvl3_1" : "melee_hit_lvl8_1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-48] 0x6FC634E0 SKILLS_ItemEvent_CounterMissileOnMissileHit_6FC634E0_113c (ecx=pGame, edx=nEvent, stack=[pDef, pMis, pDmg, nSkillId, nLvl], ret 0x14) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 1u, 1u, 5008u, 5006u, 13701u); /* hostile owner */
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 2u, 1u, 5000u, 5000u, 13702u); /* defender player */
    stage_missile_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 20u, 5001u, 5001u, 13703u,
                       (k == 1 ? 0 : 1), 1u, 1u, 12u, 1u, 20u, 10u, 0u);
    uint32_t defArg = (k == 0) ? 0u : STAGE_UNIT1;
    uint32_t skId   = (k == 2) ? 6u : 12u; /* 6: srvMis=-1 -> 0; 12: srvMis=213 -> spawns counter missile! */
    c.ecx = STAGE_GAME; c.edx = 0u; c.nargs = 5;
    c.args[0] = defArg; c.args[1] = STAGE_UNIT2; c.args[2] = 0u; c.args[3] = skId; c.args[4] = 3u;
    c.calleePop = 20u;
    ts[0] = STAGE_GAME; ts[1] = 0; ts[2] = defArg; ts[3] = STAGE_UNIT2; ts[4] = 0; ts[5] = skId; ts[6] = 3;
    run_and_emit(0x6FC634E0u, "SKILLS_ItemEvent_CounterMissileOnMissileHit_6FC634E0_113c", k,
                 k == 0 ? "null_defender_0" : k == 1 ? "no_owner_bit_0" : k == 2 ? "no_srvmis_0" : "spawns_counter_missile_1",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [B3-49] 0x6FC48170 SKILLS_EndChargeOrLeapMovement_6FC48170_113c (eax=pSkill, ecx=nSkillId, edx=pUnit, stack=[nPosX, nPosY], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t uType = (k == 2) ? 1u : 0u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, (uType == 1 ? 1u : 3u), 1u, 1u, 5000u, 5000u, 13801u);
    uint32_t pSk = stage_used_skill(STAGE_UNIT0, 107, 5); /* Charge */
    U32(pSk + 0x0Cu) = 77u; /* dwParam0C gets cleared to 0 */
    if (k == 0) U32(STAGE_UNIT0 + 0x2Cu) = 0u; /* null path -> returns 0 */
    c.eax = pSk; c.ecx = 107u; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = pSk; ts[1] = 107; ts[2] = STAGE_UNIT0; ts[3] = 0; ts[4] = 0;
    run_and_emit(0x6FC48170u, "SKILLS_EndChargeOrLeapMovement_6FC48170_113c", k,
                 k == 0 ? "null_path_0" : k == 1 ? "player_masks_80_1c09_1" : "monster_masks_100_3c01_1",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [B3-50] 0x6FC2D040 SKILLS_MountImpOnSiegeBeast_6FC2D040_113c (esi=pBeast, eax=dwArg14, ecx=pImp, stack=[pGame, dwArg18], ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    uint32_t beastCls = (k == 0) ? 1u : 0x1ECu;
    uint32_t impCls   = (k == 1) ? 1u : 0x1B3u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, beastCls, 1u, 1u, 5000u, 5000u, 13901u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, impCls, 2u, 1u, 5000u, 5000u, 13902u);
    c.esi = STAGE_UNIT0; c.ecx = STAGE_UNIT1; c.eax = 0x11u; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = 0x22u; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = 0x11; ts[3] = STAGE_GAME; ts[4] = 0x22;
    run_and_emit(0x6FC2D040u, "SKILLS_MountImpOnSiegeBeast_6FC2D040_113c", k,
                 k == 0 ? "wrong_beast_noop" : k == 1 ? "wrong_imp_noop" : "mounts_imp_sets_8f_and_event",
                 &c, ts, 5, 0u, 0);
  }

  /* [B3-51] 0x6FC2CDC0 SKILLS_SrvDo129_SpawnSummonFromParams_6FC2CDC0_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 1u, 1u, 5000u, 5000u, 14001u);
    if (k == 2) {
      uint32_t pSk = stage_used_skill(STAGE_UNIT0, 70, 3);
      U32(pSk + 0x18u) = 1u;    /* nMonId = skeleton */
      U32(pSk + 0x1Cu) = 5002u; /* nX inside STAGE_ROOM0 [4800..5800] */
      U32(pSk + 0x20u) = 5002u; /* nY */
      U32(pSk + 0x24u) = 1u;    /* nMode */
    }
    uint32_t skId = (k == 0) ? 999u : 70u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = skId; c.args[1] = 3u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 3;
    run_and_emit(0x6FC2CDC0u, "SKILLS_SrvDo129_SpawnSummonFromParams_6FC2CDC0_113c", k,
                 k == 0 ? "oob_skill_0" : k == 1 ? "no_used_skill_0" : "spawns_summon_from_params",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-52] 0x6FC2CF00 SKILLS_SrvDo133_LeaderLifeLeechHit_6FC2CF00_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 1u, 1u, 5000u, 5000u, 14101u);
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 2u, 1u, 5002u, 5002u, 14102u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    }
    uint32_t skId = (k == 0) ? 999u : (k == 1) ? 12u : 133u;
    if (k == 2) {
      /* attach combat node so SUNITDMG_FindCombatDamageData succeeds */
      uint32_t pCombat = STAGE_SCRATCH;
      U32(STAGE_UNIT0 + 0xC0u) = pCombat;
      U32(pCombat + 0x00u) = STAGE_GAME;
      U32(pCombat + 0x04u) = 1u; /* attacker type */
      U32(pCombat + 0x08u) = 1u; /* attacker guid */
      U32(pCombat + 0x0Cu) = 0u; /* defender type */
      U32(pCombat + 0x10u) = 2u; /* defender guid */
      U16(pCombat + 0x18u) = 1u; /* wResultFlags bit 0 = hit */
      U32(pCombat + 0x1Cu) = 0x1000u; /* dmgTotal */
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 0x2000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 0x8000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x4000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x8000, 0);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = skId; c.args[1] = 3u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 3;
    run_and_emit(0x6FC2CF00u, "SKILLS_SrvDo133_LeaderLifeLeechHit_6FC2CF00_113c", k,
                 k == 0 ? "oob_skill_0" : k == 1 ? "no_combat_node_0" : "leeches_life_and_execs_1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-53] 0x6FC2D9C0 SKILLS_SrvDo_ApplyAuraOrMorphMinion_6FC2D9C0_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLvl], ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 1u, 1u, 5000u, 5000u, 14201u);
    if (k >= 2) {
      /* k=2: dead target -> returns 0; k=3: alive player target -> updates aura state 34 (sk 99) */
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 2u, (k == 2 ? 0u : 1u), 5002u, 5002u, 14202u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
      if (k == 3) stage_existing_aura_statlist(STAGE_UNIT1, 0x02u, 34, 99u, 3u);
    }
    uint32_t skId = (k == 0) ? 999u : 99u; /* sk 99: wAuraState2=34 */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = skId; c.args[1] = 3u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 3;
    run_and_emit(0x6FC2D9C0u, "SKILLS_SrvDo_ApplyAuraOrMorphMinion_6FC2D9C0_113c", k,
                 k == 0 ? "oob_skill_0" : k == 1 ? "no_target_0" : k == 2 ? "dead_target_0" : "applies_aura_to_player_1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-54] 0x6FC476D0 SKILLS_SrvDo_FindItemCorpseDrop_6FC476D0_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLvl], ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 1u, 1u, 5000u, 5000u, 14301u);
    if (k == 3) {
      /* Seed (0, 99) rolls 99 >= nChance so corpse is marked 0x76 + room refreshed without hitting TS drop-false bug */
      U32(STAGE_UNIT0 + 0x20u) = 0u;
      U32(STAGE_UNIT0 + 0x24u) = 99u;
    }
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, (k == 1 ? 1u : 12u), 5002u, 5002u, 14302u);
      stage_mon_txt(STAGE_UDATA1, 1u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
      if (k == 2) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT1, 0x76, 1);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 142u; c.args[1] = 1u; c.calleePop = 8u; /* 142 = Find Item */
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 142; ts[3] = 1;
    run_and_emit(0x6FC476D0u, "SKILLS_SrvDo_FindItemCorpseDrop_6FC476D0_113c", k,
                 k == 0 ? "no_target_0" : k == 1 ? "alive_mon_0" : k == 2 ? "already_marked_76_0" : "marks_corpse_76_and_misses_roll",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-55] 0x6FC6C3A0 SKILLS_SrvSt_MeleeWithSkillElemDamage_6FC6C3A0_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 3u, 1u, 1u, 5000u, 5000u, 14401u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 20, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 19, 500, 0);
    if (k >= 1) stage_used_skill(STAGE_UNIT0, 106, 5);
    if (k == 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, 1u, 5002u, 5002u, 14402u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x8000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x8000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 5, 0);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 106u; c.args[1] = 5u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 106; ts[3] = 5;
    run_and_emit(0x6FC6C3A0u, "SKILLS_SrvSt_MeleeWithSkillElemDamage_6FC6C3A0_113c", k,
                 k == 0 ? "no_used_skill_0" : k == 1 ? "no_target_0" : "rolls_melee_and_elem_dmg_1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-56] 0x6FC6C600 SKILLS_SrvSt31_CappedMultiHitMeleeStart_6FC6C600_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 3u, 1u, 1u, 5000u, 5000u, 14501u);
    if (k >= 1) stage_used_skill(STAGE_UNIT0, 106, 5);
    if (k == 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, 1u, 5002u, 5002u, 14502u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U32(STAGE_ROOM0 + 0x74u) = STAGE_UNIT1;
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    }
    uint32_t skId = (k == 0) ? 999u : 106u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = skId; c.args[1] = 5u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 5;
    run_and_emit(0x6FC6C600u, "SKILLS_SrvSt31_CappedMultiHitMeleeStart_6FC6C600_113c", k,
                 k == 0 ? "oob_skill_0" : k == 1 ? "no_nearby_targets" : "capped_multihit_with_target",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-57] 0x6FC6CB00 SKILLS_SrvDo055_MeleeHitWithMonsterElemStatsAndEvents_6FC6CB00_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 2 ? 1u : 0u), 1u, 1u, 1u, 5000u, 5000u, 14601u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 20, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 19, 500, 0);
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 2 ? 0u : 1u), 1u, 2u, 1u, 5002u, 5002u, 14602u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x8000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x8000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 5, 0);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 106u; c.args[1] = 3u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 106; ts[3] = 3;
    run_and_emit(0x6FC6CB00u, "SKILLS_SrvDo055_MeleeHitWithMonsterElemStatsAndEvents_6FC6CB00_113c", k,
                 k == 0 ? "no_target_0" : k == 1 ? "player_melee_hit_1" : "monster_melee_elem_hit_1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-58] 0x6FC64AC0 SKILLS_RollAuraStateToHitAndAllocCombat_6FC64AC0_113c (stdcall [pGame, pUnit, nLvl], ret 0xc) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 14701u + (uint32_t)k * 13u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 20, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 19, 500, 0);
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, 1u, 5002u, 5002u, 14702u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x8000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x8000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 5, 0);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    }
    uint32_t lvl = (k == 2) ? 10u : 3u;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = lvl; c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = lvl;
    run_and_emit(0x6FC64AC0u, "SKILLS_RollAuraStateToHitAndAllocCombat_6FC64AC0_113c", k,
                 k == 0 ? "no_target_0" : k == 1 ? "rolls_and_allocs_combat_lvl3_1" : "rolls_and_allocs_combat_lvl10_1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B3-59] 0x6FC64C20 SKILLS_SrvSt_DruidChargeUpMelee_6FC64C20_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLvl], ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 5u, 1u, 1u, 5000u, 5000u, 14801u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 30, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 19, 2000, 0);
    if (k >= 1) stage_used_skill(STAGE_UNIT0, 232, 5); /* Feral Rage: auraState=120 */
    if (k >= 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, 1u, 5002u, 5002u, 14802u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x8000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x8000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 1, 0);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    }
    if (k == 3) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 120, 1); /* has required werewolf aura state */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 232u; c.args[1] = 5u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 232; ts[3] = 5;
    run_and_emit(0x6FC64C20u, "SKILLS_SrvSt_DruidChargeUpMelee_6FC64C20_113c", k,
                 k == 0 ? "no_used_skill_0" : k == 1 ? "no_target_0" : k == 2 ? "missing_aura_state_0" : "charge_up_hit_sets_param1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-60] 0x6FC64D70 SKILLS_SrvSt_MeleeWithElemConversion_6FC64D70_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 5u, 1u, 1u, 5000u, 5000u, 14901u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 30, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 19, 2000, 0);
    if (k >= 1) stage_used_skill(STAGE_UNIT0, 238, 5); /* Rabies / Fire Claws: conv=5 */
    if (k == 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, 1u, 5002u, 5002u, 14902u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x8000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x8000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 1, 0);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 238u; c.args[1] = 5u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 238; ts[3] = 5;
    run_and_emit(0x6FC64D70u, "SKILLS_SrvSt_MeleeWithElemConversion_6FC64D70_113c", k,
                 k == 0 ? "no_used_skill_0" : k == 1 ? "no_target_0" : "elem_conv_combat_alloc_1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-61] 0x6FC66A20 SKILLS_SrvDo_ReleaseChargedMeleeHitWithSecondaryAura_6FC66A20_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLvl], ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 15001u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 30, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 19, 2000, 0);
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, 1u, 5002u, 5002u, 15002u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x8000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x8000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 1, 0);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    }
    if (k >= 2) {
      /* sk 254 Tiger Strike has wAuraState2 = -1, so 0x6FC65EE0 returns 0 cleanly without relocated callback */
      uint32_t pSk = stage_used_skill(STAGE_UNIT0, 254, 5);
      U32(pSk + 0x18u) = (k == 2) ? 0u : 2u; /* nChargeCount = 0 vs 2 */
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 254u; c.args[1] = 5u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 254; ts[3] = 5;
    run_and_emit(0x6FC66A20u, "SKILLS_SrvDo_ReleaseChargedMeleeHitWithSecondaryAura_6FC66A20_113c", k,
                 k == 0 ? "no_target_0" : k == 1 ? "no_used_skill_0" : k == 2 ? "zero_charges_0" : "releases_2_charges_1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }
}

/* ------------------------------- Batch 4: 22 VAs (Quests + MonAI + Skills + Missiles -> 150 Total) */

static void stage_quest_node(uint32_t questId, uint8_t bActive, uint8_t bState) {
  U32(STAGE_GAME + 0x10F4u)  = STAGE_QUESTCTRL;
  U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
  U32(STAGE_QUEST0 + 0x00u)  = questId;
  U32(STAGE_QUEST0 + 0x04u)  = STAGE_GAME;
  U8(STAGE_QUEST0 + 0x09u)   = bActive;
  U8(STAGE_QUEST0 + 0x0Cu)   = bState;
  U32(STAGE_QUEST0 + 0x18u)  = STAGE_QUESTEX0;
  U32(STAGE_QUEST0 + 0xF4u)  = 0u;
}

static void emit_batch_4(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [B4-01] 0x6FC56050 QUESTS_TriggerAct5PortalTransitionIfBelowLevel108_6FC56050_113c (esi=pPlayer, stack=[pGame], ret 4, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    uint32_t lvl = (k == 0) ? 108u : 83u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvl);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 11u, 1u, 5000u, 5000u, 15101u);
    if (k == 2) {
      stage_quest_node(0x13u, 0u, 0u);
    } else if (k == 3) {
      stage_quest_node(0x13u, 1u, 2u);
      U32(STAGE_QUESTEX0 + 0x30u) = 6u; /* sets pQuestExt+0x05 = 1 cleanly */
    }
    c.esi = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FC56050u, "QUESTS_TriggerAct5PortalTransitionIfBelowLevel108_6FC56050_113c", k,
                 k == 0 ? "lvl108_ge_6c_noop" : k == 1 ? "lvl83_no_questctrl" : k == 2 ? "lvl83_quest13_inactive" : "lvl83_quest13_sets_flag05",
                 &c, ts, 2, 0u, 0);
  }

  /* [B4-02] 0x6FC7CC30 ACT5Q3_TriggerFrozenAnyaSpawn_6FC7CC30_113c (ecx=pGame, ret, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    if (k == 1) {
      stage_quest_node(0x10u, 1u, 1u);
    } else if (k == 2) {
      stage_quest_node(0x21u, 1u, 1u);
      U8(STAGE_QUESTEX0 + 0xE1u) = 0u; /* 0x6FC7C690 returns early after +0xAD=1, +0x84=2 */
    } else if (k == 3) {
      stage_quest_node(0x21u, 1u, 1u);
      U8(STAGE_QUESTEX0 + 0xE1u) = 1u;
      U32(STAGE_QUESTEX0 + 0xE4u) = 77u; /* object guid not in hash -> returns early */
    }
    c.ecx = STAGE_GAME;
    ts[0] = STAGE_GAME;
    run_and_emit(0x6FC7CC30u, "ACT5Q3_TriggerFrozenAnyaSpawn_6FC7CC30_113c", k,
                 k == 0 ? "no_questctrl_noop" : k == 1 ? "quest21_not_found" : k == 2 ? "sets_ad_and_84_flag0" : "sets_ad_and_84_flag1_missing_obj",
                 &c, ts, 1, 0u, 0);
  }

  /* [B4-03] 0x6FC88D20 ACT1Q5_OnPortalLightningTimerEvent_6FC88D20_113c (esi=pQuestData, stack=[pUnit], ret 4, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 4u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 17u, 12u, 0u, 5000u, 5000u, 15301u);
    stage_quest_node(4u, 1u, 3u);
    U8(STAGE_QUESTEX0 + 0x118u) = (k == 0) ? 0u : 1u;
    U8(STAGE_QUESTEX0 + 0x119u) = (k == 1) ? 1u : 0u;
    U16(STAGE_QUESTEX0 + 0x88u) = 0u;
    U32(STAGE_GAME + 0xA8u)     = (k == 3) ? 250u : 100u;
    c.esi = STAGE_QUEST0; c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC88D20u, "ACT1Q5_OnPortalLightningTimerEvent_6FC88D20_113c", k,
                 k == 0 ? "flag118_zero_noop" : k == 1 ? "flag119_one_noop" : k == 2 ? "reschedules_event7_110" : "reschedules_event7_260",
                 &c, ts, 2, 0u, 0);
  }

  /* [B4-04] 0x6FC7E790 ACT5Q4_TrySpawnNihlathakPortalOrRescheduleEvent7_6FC7E790_113c (esi=pGame, edi=pUnit, ret, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 5u, 13u, 0u, 5000u, 5000u, 15401u);
    if (k >= 1) {
      stage_quest_node(0x22u, 1u, 2u);
      U8(STAGE_QUESTEX0 + 0x87u) = (k == 1) ? 0u : 1u;
      U8(STAGE_QUESTEX0 + 0x88u) = 1u; /* 0x6FC7D380 returns 0 -> reschedules event 7 */
    }
    U32(STAGE_GAME + 0xA8u) = (k == 3) ? 300u : 100u;
    c.esi = STAGE_GAME; c.edi = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC7E790u, "ACT5Q4_TrySpawnNihlathakPortalOrRescheduleEvent7_6FC7E790_113c", k,
                 k == 0 ? "no_questctrl_noop" : k == 1 ? "flag87_zero_noop" : k == 2 ? "reschedules_event7_112" : "reschedules_event7_312",
                 &c, ts, 2, 0u, 0);
  }

  /* [B4-05] 0x6FC854A0 ACT1Q4_OnScrollPickedUpOrDropped_6FC854A0_113c (ecx=pQuestData, edx=pQuestArg, ret, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, g_item_bkd, 14u, 0u, 5000u, 5000u, 15501u);
    stage_quest_node(4u, (k == 0 ? 0u : 1u), (k == 1 ? 6u : 2u));
    U32(STAGE_QUESTEX0 + 0x7Cu) = (k == 2) ? 2u : 1u;
    U8(STAGE_QUESTEX0 + 0x4Fu)  = 0u;
    U8(STAGE_QUESTEX0 + 0x47u)  = 1u;
    U32(STAGE_QUESTEX0 + 0x30u) = 999u; /* tree obj not in hash -> safe */
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FC854A0u, "ACT1Q4_OnScrollPickedUpOrDropped_6FC854A0_113c", k,
                 k == 0 ? "inactive_noop" : k == 1 ? "state6_noop" : k == 2 ? "decrements_count_2_to_1" : "decrements_to_0_promotes_state3",
                 &c, ts, 2, 0u, 0);
  }

  /* [B4-06] 0x6FC799E0 ACT5Q6_CheckLevel84AndCompleteQuest28_6FC799E0_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    uint32_t lvl = (k == 2) ? 109u : 0x84u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvl);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 1 ? 0u : STAGE_ROOM0), 0u, 0u, 15u, 1u, 5000u, 5000u, 15601u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    U16(STAGE_CLIENT + 0x0Au) = 0x0020u; /* LoD expansion bit */
    stage_quest_node(0x24u, 1u, 2u);
    if (k == 0) set_qbit(STAGE_QBITS0, 0x28u, 0u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC799E0u, "ACT5Q6_CheckLevel84AndCompleteQuest28_6FC799E0_113c", k,
                 k == 0 ? "bit0_already_set" : k == 1 ? "null_room_skips" : k == 2 ? "wrong_level_109" : "lvl84_completes_q28_and_prog",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B4-07] 0x6FC7C080 ACT5Q5_CheckAndGrantAncientsRewardInAct5_6FC7C080_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    uint32_t lvl = (k == 2) ? 2u : 109u; /* 2 = Act 1 (act 0), 109 = Act 5 (act 4) */
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvl);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 16u, 1u, 5000u, 5000u, 15701u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    /* pClient=0 so QUESTS_RecordPlayerGUID_6FC54C00 skips packet queue; clvl=99 avoids levelup effects */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, (k == 1 ? 15 : 99), 0);
    if (k == 0) set_qbit(STAGE_QBITS0, 0x27u, 0u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC7C080u, "ACT5Q5_CheckAndGrantAncientsRewardInAct5_6FC7C080_113c", k,
                 k == 0 ? "bit0_already_set" : k == 1 ? "clvl15_lt20_noop" : k == 2 ? "act0_not_act4_noop" : "act5_clvl99_sets_q27_bits",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-08] 0x6FC848B0 ACT1Q4_CompleteCainRescueInTristramAndParty_6FC848B0_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    uint32_t lvl = (k == 2) ? 2u : 0x26u; /* 0x26 = Tristram */
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvl);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 17u, 1u, 5000u, 5000u, 15801u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    if (k == 0) set_qbit(STAGE_QBITS0, 4u, 0u);
    if (k == 1) set_qbit(STAGE_QBITS0, 4u, 1u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC848B0u, "ACT1Q4_CompleteCainRescueInTristramAndParty_6FC848B0_113c", k,
                 k == 0 ? "bit0_set_noop" : k == 1 ? "bit1_set_noop" : k == 2 ? "wrong_lvl2_noop" : "tristram_sets_q4_bits_1_and_0d",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B4-09] 0x6FC55E90 QUESTS_SetGameQuestFlag20AndSyncPlayers_6FC55E90_113c (eax=pGame, ecx=bFlag, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(4u, 1u, 2u);
    U8(STAGE_QUESTCTRL + 0x20u) = (k == 0) ? 1u : 0u;
    uint32_t flag = (k == 0) ? 0u : (k == 1) ? 1u : 0x7Fu;
    c.eax = STAGE_GAME; c.ecx = flag;
    ts[0] = STAGE_GAME; ts[1] = flag;
    run_and_emit(0x6FC55E90u, "QUESTS_SetGameQuestFlag20AndSyncPlayers_6FC55E90_113c", k,
                 k == 0 ? "clears_flag20" : k == 1 ? "sets_flag20_1" : "sets_flag20_7f",
                 &c, ts, 2, 0u, 0);
  }

  /* [B4-10] 0x6FC830D0 ACT1Q6_SyncCompletionInCatacombs4_6FC830D0_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    uint32_t lvl = (k == 2) ? 2u : 0x25u; /* 0x25 = Catacombs Level 4 */
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvl);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 19u, 1u, 5000u, 5000u, 16001u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    U16(STAGE_CLIENT + 0x0Au) = 0x0020u;
    stage_quest_node(6u, 1u, 2u);
    if (k == 0) set_qbit(STAGE_QBITS0, 6u, 0u);
    if (k == 1) set_qbit(STAGE_QBITS0, 6u, 0x0Fu);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC830D0u, "ACT1Q6_SyncCompletionInCatacombs4_6FC830D0_113c", k,
                 k == 0 ? "bit0_set_noop" : k == 1 ? "bit0f_set_noop" : k == 2 ? "wrong_lvl2_noop" : "cata4_records_guids_and_prog",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B4-11] 0x6FC80F70 ACT1Q3_OnCatacombsLevel4EnteredCallback_6FC80F70_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    uint32_t lvl = (k == 1) ? 2u : 0x19u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvl);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 21u, 1u, 5000u, 5000u, 16101u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    stage_quest_node(5u, 1u, 2u);
    if (k == 0) set_qbit(STAGE_QBITS0, 5u, 0u);
    if (k == 3) {
      /* Pre-populate GUID 21 in pQuestDataEx+0x8C guid list (list+0x80 = count, list+0x00 = guids[]) */
      U32(STAGE_QUESTEX0 + 0x8Cu + 0x00u) = 21u;
      U16(STAGE_QUESTEX0 + 0x8Cu + 0x80u) = 1u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC80F70u, "ACT1Q3_OnCatacombsLevel4EnteredCallback_6FC80F70_113c", k,
                 k == 0 ? "bit0_set_noop" : k == 1 ? "wrong_lvl2_noop" : k == 2 ? "lvl19_adds_guid_and_bits" : "lvl19_existing_guid_sets_bits",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B4-12] 0x6FC70190 SKILLS_SrvDo_CorpseRing16SubMissiles_6FC70190_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLvl], ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 16201u);
    if (k >= 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, (k == 2 ? 1u : 12u), 5004u, 5004u, 16202u);
      stage_mon_txt(STAGE_UDATA1, 1u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    }
    /* sk 59 = Blizzard: wSrvMissileA = 158 (vel=(0,0), par1=0 -> avoids PATH_Compute bug) */
    uint32_t skId = (k == 0) ? 0u : (k == 1) ? 6u : 59u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = skId; c.args[1] = 3u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 3;
    run_and_emit(0x6FC70190u, "SKILLS_SrvDo_CorpseRing16SubMissiles_6FC70190_113c", k,
                 k == 0 ? "skill0_returns_0" : k == 1 ? "no_srvmis_returns_1" : k == 2 ? "alive_mon_not_corpse_0" : "corpse_ring16_vel0_1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B4-13] 0x6FC479C0 PLRMODE_ExecuteMonsterMeleeSkillHit_6FC479C0_113c (eax=pDefender, ecx=pAttacker, ebx=pSkill, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 22u, 1u, 5000u, 5000u, 16301u);
    stage_mon_txt(STAGE_UDATA0, 1u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 10, 0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 42u, 1u, 5002u, 5002u, 16302u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x8000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x8000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 10, 0);
    /* Leave pPath->pTargetUnit == 0 so MONSTER_ExecuteMeleeSwing113c exits cleanly in both DLL and TS */
    uint32_t pSk = (k == 1) ? 0u : stage_used_skill(STAGE_UNIT0, 158, 3);
    uint32_t defArg = (k == 0) ? 0u : STAGE_UNIT1;
    c.eax = defArg; c.ecx = STAGE_UNIT0; c.ebx = pSk; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = defArg; ts[1] = STAGE_UNIT0; ts[2] = pSk; ts[3] = STAGE_GAME;
    run_and_emit(0x6FC479C0u, "PLRMODE_ExecuteMonsterMeleeSkillHit_6FC479C0_113c", k,
                 k == 0 ? "null_defender_0" : k == 1 ? "null_skill_0" : "melee_hit_records_def_type_and_id_1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B4-14] 0x6FC5BDA0 QUESTS_SpawnPortalFromMissileAtCoords_6FC5BDA0_113c (esi=pMissile, stack=[pGame, nDestLevelId], ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u); /* Town level 1 */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 2u, 1u, 5002u, 5002u, 16402u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 2) {
      /* Type 2 unit exercises static-path X/Y branch inside 0x6FC5BDA0 */
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 5u, 23u, 0u, 5004u, 5006u, 16403u);
      U32(STAGE_UNIT0 + 0x94u) = 0u;
      U32(STAGE_UNIT0 + 0x98u) = 2u;
      U32(STAGE_UNIT0 + 0xC8u) = (1u << 10);
    } else {
      stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 0 ? 0u : STAGE_ROOM0), 288u, 23u, 5000u, 5000u, 16401u,
                         1, 0u, 2u, 0u, 1u, 20u, 10u, 0u);
    }
    uint32_t destLvl = (k == 2) ? 3u : 2u;
    c.esi = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = destLvl; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = destLvl;
    run_and_emit(0x6FC5BDA0u, "QUESTS_SpawnPortalFromMissileAtCoords_6FC5BDA0_113c", k,
                 k == 0 ? "null_room_assert_e42" : k == 1 ? "town_missile_dyn_path" : "town_object_static_path",
                 &c, ts, 3, 0u, (k == 0 ? 1 : 0));
  }

  /* [B4-15] 0x6FC77CB0 ACT5Q3_EnsureAnyaTownPortalSpawned_6FC77CB0_113c (ecx=pGame, edx=pUnit, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 24u, 1u, 5000u, 5000u, 16501u);
    if (k >= 1) {
      stage_quest_node(0x21u, 1u, 2u);
      U8(STAGE_QUESTEX0 + 0xB1u)  = (k == 1) ? 1u : 0u;
      U32(STAGE_QUESTEX0 + 0x84u) = (k == 3) ? 2u : 0u;
      U32(STAGE_QUESTEX0 + 0xC4u) = 100u; /* outside STAGE_ROOM0 [4800..5800] -> +3 */
      U32(STAGE_QUESTEX0 + 0xC8u) = 200u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC77CB0u, "ACT5Q3_EnsureAnyaTownPortalSpawned_6FC77CB0_113c", k,
                 k == 0 ? "no_questctrl_0" : k == 1 ? "already_spawned_1" : k == 2 ? "flag84_zero_0" : "probe_miss_advances_xy_by_3",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B4-16] 0x6FC827A0 ACT1Q3_CompleteCharsiImbueInCatacombsCallback_6FC827A0_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    uint32_t lvl = (k == 1) ? 2u : 0x19u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvl);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 25u, 1u, 5000u, 5000u, 16601u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    stage_quest_node(5u, 1u, 2u);
    if (k == 0) set_qbit(STAGE_QBITS0, 5u, 0u);
    if (k >= 2) set_qbit(STAGE_QBITS0, 5u, 1u); /* cleared on completion */
    if (k == 3) U16(STAGE_QUESTEX0 + 0x64u) = 0x0Cu; /* full -> no write to +0x34 */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC827A0u, "ACT1Q3_CompleteCharsiImbueInCatacombsCallback_6FC827A0_113c", k,
                 k == 0 ? "bit0_set_noop" : k == 1 ? "other_lvl_sets_bit0e" : k == 2 ? "lvl19_completes_and_appends_guid" : "lvl19_completes_list_full",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B4-17] 0x6FC4D790 CLIENTS_DrainAllPendingSaveChunks_6FC4D790_113c (edi=pGame, esi=pClient, ret, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    U8(STAGE_GAME + 0x6Au) = (k == 0) ? 0u : (k == 2) ? 2u : 1u; /* bGameType */
    if (k == 3) {
      U8(STAGE_CLIENT + 0x3D4u)  = 0x10u; /* flag10 set, but pending chunk +0x17C == 0 */
      U32(STAGE_CLIENT + 0x17Cu) = 0u;
    }
    uint32_t cliArg = (k == 1) ? 0u : STAGE_CLIENT;
    c.edi = STAGE_GAME; c.esi = cliArg;
    ts[0] = STAGE_GAME; ts[1] = cliArg;
    run_and_emit(0x6FC4D790u, "CLIENTS_DrainAllPendingSaveChunks_6FC4D790_113c", k,
                 k == 0 ? "gametype0_noop" : k == 1 ? "null_client_assert_b8a" : k == 2 ? "flag10_clear_noop" : "flag10_set_no_chunks",
                 &c, ts, 2, 0u, (k == 1 ? 1 : 0));
  }

  /* [B4-18] 0x6FCB2230 SKILLS_SrvDo_SpawnChargedProjectileAtTarget_6FCB2230_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLvl], ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 16801u);
    if (k >= 1) {
      /* Target at (5200,5200) > 100 subtiles from caster avoids TS 0x6FCC0000 m.alloc(0x5c) while returning 1 */
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, 1u, 5200u, 5200u, 16802u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    }
    uint32_t skId = (k == 2) ? 6u : 59u;
    uint32_t lvl  = (k == 1) ? 0u : 4u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = skId; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = lvl;
    run_and_emit(0x6FCB2230u, "SKILLS_SrvDo_SpawnChargedProjectileAtTarget_6FCB2230_113c", k,
                 k == 0 ? "no_target_coords_0" : k == 1 ? "lvl0_returns_0" : k == 2 ? "no_srvmis_0" : "dist_gt100_returns_1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B4-19] 0x6FC663A0 SKILLS_ApplySecondaryAuraAndSpawnChargedMissile_6FC663A0_113c (eax=pUnit, edi=nSkillId, esi=nCharge, stack=[pGame, pTarget, nLvl], ret 0xc) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 16901u);
    /* sk 254 (Tiger Strike) has wAuraState2=-1 -> 0x6FC65EE0 returns 0 cleanly without relocated callback */
    int32_t charge = (k == 0) ? 0 : (k == 1) ? -2 : (k == 2) ? 1 : 3;
    uint32_t lvl   = (k == 3) ? 10u : 5u;
    c.eax = STAGE_UNIT0; c.edi = 254u; c.esi = (uint32_t)charge;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = lvl; c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = lvl; ts[3] = 254; ts[4] = lvl; ts[5] = charge; ts[6] = STAGE_UNIT0;
    run_and_emit(0x6FC663A0u, "SKILLS_ApplySecondaryAuraAndSpawnChargedMissile_6FC663A0_113c", k,
                 k == 0 ? "charge0_returns_0" : k == 1 ? "charge_neg2_returns_0" : k == 2 ? "charge1_sk254_returns_1" : "charge3_sk254_returns_1",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [B4-20] 0x6FC786C0 ACT5Q1_CheckPlayerNearShenkRoomCallback_6FC786C0_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4) */
  for (int k = 0; k < 5; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 110u);
    stage_room(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 110u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 0 ? 0u : STAGE_ROOM0), 0u, 0u, 29u, 1u, 5000u, 5000u, 17001u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    stage_quest_node(0x1Fu, 1u, 2u);
    if (k == 1) set_qbit(STAGE_QBITS0, 0x23u, 0u);
    U32(STAGE_QUESTEX0 + 0x04u) = (k == 2) ? STAGE_ROOM0 : STAGE_ROOM1;
    if (k == 3) {
      /* Put STAGE_ROOM1 in STAGE_ROOM0's adjacent rooms list */
      U32(STAGE_SCRATCH + 0x00u) = STAGE_ROOM1;
      U32(STAGE_ROOM0 + 0x00u)   = STAGE_SCRATCH + 0x00u;
      U32(STAGE_ROOM0 + 0x24u)   = 1u;
    } else if (k == 4) {
      /* Adjacent list only has STAGE_ROOM0 -> not near STAGE_ROOM1 */
      stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC786C0u, "ACT5Q1_CheckPlayerNearShenkRoomCallback_6FC786C0_113c", k,
                 k == 0 ? "null_room_noop" : k == 1 ? "bit0_set_noop" : k == 2 ? "same_room_sets_q23" : k == 3 ? "adj_room_sets_q23" : "far_room_noop",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B4-21] 0x6FCB61A0 SKILLS_SrvDo_DualClawProgressiveChargeAttack_6FCB61A0_113c (ecx=pGame, edx=pAttacker, stack=[nSkillId, nLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 17101u);
    /* No path target so 0x6FCB5690 exits before its TS m.alloc(0x70) bug while 0x6FCB61A0 still toggles +0xC4 bit 0x40 */
    if (k == 0) {
      /* pInv == 0, even frame -> clears 0x40 */
      U32(STAGE_UNIT0 + 0x38u) = 0x0200u;
      U32(STAGE_UNIT0 + 0xC4u) = 0x0044u;
    } else if (k == 1) {
      /* pInv == 0, odd frame -> sets 0x40 */
      U32(STAGE_UNIT0 + 0x38u) = 0x0300u;
      U32(STAGE_UNIT0 + 0xC4u) = 0x0004u;
    } else {
      /* empty pInv (non-dual-claw) -> sets 0x40 even on even frame */
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
      U32(STAGE_UNIT0 + 0x38u) = 0x0200u;
      U32(STAGE_UNIT0 + 0xC4u) = 0x0004u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 254u; c.args[1] = 4u; c.calleePop = 8u; /* 254 = Tiger Strike */
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 254; ts[3] = 4;
    run_and_emit(0x6FCB61A0u, "SKILLS_SrvDo_DualClawProgressiveChargeAttack_6FCB61A0_113c", k,
                 k == 0 ? "null_inv_even_clears_40" : k == 1 ? "null_inv_odd_sets_40" : "empty_inv_sets_40",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B4-22] 0x6FC5C3B0 MISSILES_SrvHit_SpawnBurstSubMissiles_6FC5C3B0_113c (ecx=pGame, edx=pMissile, stack=[pHitTarget], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 17201u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    /* mis 564: hitSub1=563 (flg=0x21, srvDo=1, vel=(0,0)), hitPar=[1,0,0] -> spawns 1 zero-vel linear sub-missile */
    uint32_t cls = (k == 1) ? 1u : 564u;
    stage_missile_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, cls, 30u, 5004u, 5006u, 17202u,
                       1, 0u, 1u, 36u, 2u, 20u, 10u, 0u);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = misArg; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = misArg; ts[2] = 0;
    run_and_emit(0x6FC5C3B0u, "MISSILES_SrvHit_SpawnBurstSubMissiles_6FC5C3B0_113c", k,
                 k == 0 ? "null_missile_1" : k == 1 ? "no_hitsub_1" : "spawns_burst_sub563_1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }
}

int main(int argc, char **argv) {
  const char *imgPath = (argc > 1) ? argv[1] : "d2game-datatbls-113c.img";
  const char *outPath = (argc > 2) ? argv[2] : "k6-w11-d2game-vectors.ndjson";

  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  AddVectoredExceptionHandler(1, k6_veh);

  void *pTbls  = VirtualAlloc((void *)DATATBLS_BASE, DATATBLS_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pStage = VirtualAlloc((void *)STAGE_BASE, STAGE_TOTAL_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pHeap  = VirtualAlloc((void *)HEAP_BASE, HEAP_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if ((uintptr_t)pTbls != DATATBLS_BASE || (uintptr_t)pStage != STAGE_BASE || (uintptr_t)pHeap != HEAP_BASE) {
    fprintf(stderr, "[k6-w11] VirtualAlloc failed (%p %p %p)\n", pTbls, pStage, pHeap);
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
    fprintf(stderr, "[k6-w11] LoadLibraryA failed (%p %p %p %p %p %p %p)\n",
            (void *)hStorm, (void *)g_hFog, (void *)hLang, (void *)hCmp,
            (void *)g_hCom, (void *)hNet, (void *)g_hGame);
    fflush(stderr);
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-w11] unexpected D2Common rebase: %p\n", (void *)g_hCom);
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
    fprintf(stderr, "[k6-w11] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-w11] failed to open %s for writing\n", outPath);
    return 5;
  }

  emit_batch_1();
  emit_batch_2();
  emit_batch_3();
  emit_batch_4();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-w11] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
