/*
 * k6-w14-d2game-emitter.c — Milestone #37 [K6] Wave 14 Real-DLL Differential Emitter (Lo-VA Part 5)
 *
 * Loads real Diablo II: Lord of Destruction v1.13c DLLs (Storm.dll, Fog.dll,
 * D2Lang.dll, D2CMP.dll, D2Common.dll, D2Net.dll, D2Game.dll) under headless Wine,
 * hydrates canonical sgptDataTables (0x20000000..0x206F7FFF + D2Common .data/.bss)
 * from d2game-datatbls-113c.img, hooks Fog.#10024 (assert) and Fog.#10042..10047
 * (deterministic bump allocator), and executes net-new real D2Game.dll functions
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

/* Discovered real v1.13c item/object IDs */
static uint32_t g_item_ring   = 0;
static uint32_t g_item_malus  = 0; /* "hdm " Horadric Malus */
static uint32_t g_item_potion = 0; /* "ice " Malah's Potion */
static uint32_t g_item_sword  = 0; /* "ssd " Short Sword */
static uint32_t g_item_armor  = 0; /* "cap " Cap */
static uint32_t g_item_gold   = 0; /* "gld " Gold */
static uint32_t g_item_ear    = 0; /* "ear " Ear */
static uint32_t g_item_tome   = 0; /* "tbk " Tome of Town Portal */
static uint32_t g_item_scroll = 0; /* "tsc " Scroll of Town Portal */
static uint32_t g_item_charm  = 0; /* "cm1 " Small Charm */
static uint32_t g_item_throw  = 0; /* "jav " Javelin */
static uint32_t g_item_wand   = 0; /* "wnd " Wand */
static uint32_t g_item_bkd    = 0; /* "bkd " Scroll of Inifuss (decoded) */
static uint32_t g_item_trs    = 0; /* "trs " Horadric Scroll */
static uint32_t g_item_gem    = 0; /* Chipped gem */
static uint32_t g_obj_well       = 0;
static uint32_t g_obj_chest      = 0;
static uint32_t g_obj_chest1     = 0;
static uint32_t g_obj_sel        = 0;
static uint32_t g_obj_has_op     = 0;
static uint32_t g_obj_no_op      = 0;

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
              "[k6-w14] SETUP/INIT FAULT after %u emitted: code=0x%08lX eip=%p (game=0x%08lX com=0x%08lX) addr=0x%08X\n",
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
      fprintf(stderr, "[k6-w14] setup bump overflow (size=%u)\n", dwSize);
      TerminateProcess(GetCurrentProcess(), 21);
    }
    memset((void *)(uintptr_t)p, 0, dwSize);
    g_setup_top = p + dwSize;
    record_alloc_size(p, dwSize);
    return (void *)(uintptr_t)p;
  } else {
    uint32_t p = (g_heap_top + 3u) & ~3u;
    if (p + dwSize > HEAP_BASE + HEAP_SIZE) {
      fprintf(stderr, "[k6-w14] heap bump overflow (size=%u)\n", dwSize);
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
      fprintf(stderr, "[k6-w14] missing Fog.#%u\n", hooks[i].ord);
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
    fprintf(stderr, "[k6-w14] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-w14] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(D2COM_PREF_BASE + 0x99000u + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-w14] short read at page %u\n", i);
      TerminateProcess(GetCurrentProcess(), 12);
    }
    uint32_t va = *(const uint32_t *)pageBuf;
    const uint8_t *data = pageBuf + 4;
    if (va >= DATATBLS_BASE && va + 4096u <= DATATBLS_BASE + DATATBLS_SIZE) {
      memcpy((void *)(uintptr_t)va, data, 4096u);
    } else if (va >= (D2COM_PREF_BASE + 0x99000u) && va <= (D2COM_PREF_BASE + 0xA2000u)) {
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
      fprintf(stderr, "[k6-w14] JSON buffer overflow\n");
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
  if (uType == 1u && pUData != 0u) {
    uint32_t pTables = U32(D2COM_PREF_BASE + 0x99E1Cu + g_com_rebase);
    if (pTables != 0u) {
      uint32_t pMonStatsBase = U32(pTables + 0xA78u);
      uint32_t nMonStatsCnt  = U32(pTables + 0xA80u);
      if (classId < nMonStatsCnt) {
        U32(pUData + 0x00u) = pMonStatsBase + classId * 0x1A8u;
      }
    }
    U32(pUData + 0x28u) = pUData + 0x160u; /* D2AiControlStrc */
    U32(pUData + 0x2Cu) = pUData + 0x100u; /* D2AiGeneralStrc */
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

static void stage_quest_node(uint32_t questId, uint8_t bActive, uint8_t bState) {
  U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
  U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
  U32(STAGE_QUEST0 + 0x00u)    = questId;
  U32(STAGE_QUEST0 + 0x04u)    = STAGE_GAME;
  U8(STAGE_QUEST0 + 0x09u)     = bActive;
  U8(STAGE_QUEST0 + 0x0Cu)     = bState;
  U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
  U32(STAGE_QUEST0 + 0xF4u)    = 0u;
}

static void stage_room_self_adj(uint32_t pRoom, uint32_t scratchSlot) {
  U32(scratchSlot)   = pRoom;
  U32(pRoom + 0x00u) = scratchSlot;
  U32(pRoom + 0x24u) = 1u;
}

static uint32_t stage_room_collision_fill(
    uint32_t pRoom, uint32_t x0, uint32_t y0, uint32_t w, uint32_t h, uint16_t fillVal) {
  uint32_t pColl = (uint32_t)(uintptr_t)bump_alloc(0x28u);
  uint32_t pMap  = (uint32_t)(uintptr_t)bump_alloc(w * h * 2u);
  if (fillVal != 0u) {
    for (uint32_t i = 0; i < w * h; i++) {
      U16(pMap + i * 2u) = fillVal;
    }
  }
  U32(pColl + 0x00u) = x0;
  U32(pColl + 0x04u) = y0;
  U32(pColl + 0x08u) = w;
  U32(pColl + 0x0Cu) = h;
  U32(pColl + 0x10u) = x0 / 5u;
  U32(pColl + 0x14u) = y0 / 5u;
  U32(pColl + 0x18u) = w / 5u;
  U32(pColl + 0x1Cu) = h / 5u;
  U32(pColl + 0x20u) = pMap;
  U32(pRoom + 0x20u) = pColl;
  U32(pRoom + 0x4Cu) = x0;
  U32(pRoom + 0x50u) = y0;
  U32(pRoom + 0x54u) = w;
  U32(pRoom + 0x58u) = h;
  uint32_t pRex = U32(pRoom + 0x10u);
  if (pRex != 0u && U32(pRex + 0x64u) == 0u) {
    uint32_t pLog  = (uint32_t)(uintptr_t)bump_alloc(0x34u);
    uint32_t pNode = (uint32_t)(uintptr_t)bump_alloc(0x30u);
    U8(pLog + 0x00u)  = 1u;
    U32(pLog + 0x30u) = pNode;
    U32(pNode + 0x04u) = x0;
    U32(pNode + 0x08u) = y0;
    U32(pNode + 0x0Cu) = w;
    U32(pNode + 0x10u) = h;
    U32(pRex + 0x64u)  = pLog;
  }
  return pMap;
}

static uint32_t stage_room_collision(uint32_t pRoom, uint32_t x0, uint32_t y0, uint32_t w, uint32_t h) {
  return stage_room_collision_fill(pRoom, x0, y0, w, h, 0u);
}

__attribute__((unused)) static void stage_missile_unit(
    uint32_t pMissile, uint32_t pMData, uint32_t pPath, uint32_t pRoom,
    uint32_t classId, uint32_t guid, uint16_t x, uint16_t y,
    uint32_t ownerType, uint32_t ownerGuid, int16_t skillId, int16_t slvl,
    uint16_t curFrame, uint16_t maxFrame, uint32_t seedLo) {
  stage_unit_common(pMissile, pMData, pPath, pRoom, 3u, classId, guid, 0u, x, y, seedLo);
  U32(pMissile + 0x94u) = ownerType;
  U32(pMissile + 0x98u) = ownerGuid;
  S16(pMData + 0x04u)   = skillId;
  S16(pMData + 0x06u)   = slvl;
  U16(pMData + 0x08u)   = maxFrame;
  U16(pMData + 0x0Au)   = curFrame;
  U32(pMData + 0x18u)   = 0u;
}

__attribute__((unused)) static uint32_t stage_used_skill(uint32_t pUnit, uint32_t skillId, uint32_t slvl, uint32_t flags) {
  if (U32(pUnit + 0xA8u) == 0u) {
    U32(pUnit + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
  }
  fn_SetSkillLevel((void *)(uintptr_t)pUnit, (int32_t)skillId, (int32_t)slvl, 1, 0, 0);
  uint32_t pInfo = U32(pUnit + 0xA8u);
  uint32_t pSkill = (pInfo != 0u) ? U32(pInfo + 0x00u) : 0u;
  if (pInfo != 0u && pSkill != 0u) {
    U32(pInfo + 0x0Cu) = pSkill;
    U32(pSkill + 0x08u) = flags;
  }
  return pSkill;
}

__attribute__((unused)) static uint32_t stage_statlist_state(
    uint32_t pUnit, uint32_t stateId, uint32_t statId, int32_t val, uint32_t flags, uint32_t expireFrame) {
  void *pSl = fn_AllocStatList(
      NULL, flags, expireFrame, (int32_t)U32(pUnit + 0x00u), (int32_t)U32(pUnit + 0x0Cu));
  if (!pSl) return 0u;
  fn_SetStatListState(pSl, (int32_t)stateId);
  fn_MergeStatLists((void *)(uintptr_t)pUnit, pSl, 1);
  if (statId != 0xFFFFFFFFu) {
    fn_SetStatIfValid(pSl, (int32_t)statId, val, 0);
  }
  fn_ToggleGfxState((void *)(uintptr_t)pUnit, (int32_t)stateId, 1);
  return (uint32_t)(uintptr_t)pSl;
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
            "[k6-w14] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }

  if (expectAssert && g_thunk_faulted != 2) {
    fprintf(stderr, "[k6-w14] EXPECTED ASSERT did not fire at %s (0x%08X) case %d (%s)\n",
            fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!expectAssert && g_thunk_faulted == 2) {
    fprintf(stderr, "[k6-w14] UNEXPECTED Fog.#10024 assert line %u at %s (0x%08X) case %d (%s)\n",
            g_assert_line, fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 32);
  }

  if (g_thunk_faulted == 0) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-w14] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
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

/* ------------------------------- Startup Discovery of Canonical Table IDs */

static void discover_table_ids(void) {
  reset_case();
  uint32_t nItems = U32(D2COM_PREF_BASE + 0x9FB94u + g_com_rebase);
  uint32_t pItems = U32(D2COM_PREF_BASE + 0x9FB98u + g_com_rebase);

  U32(STAGE_UNIT2 + 0x00u) = 4u;
  U32(STAGE_UNIT2 + 0x14u) = STAGE_UDATA2;
  for (uint32_t id = 0; id < nItems; id++) {
    U32(STAGE_UNIT2 + 0x04u) = id;
    uint32_t code = U32(pItems + id * 0x1A8u + 0x80u);
    if (!g_item_malus  && code == 0x206D6468u) g_item_malus  = id;
    if (!g_item_potion && code == 0x20656369u) g_item_potion = id;
    if (!g_item_sword  && code == 0x20647373u) g_item_sword  = id;
    if (!g_item_armor  && code == 0x20706163u) g_item_armor  = id;
    if (!g_item_gold   && code == 0x20646C67u) g_item_gold   = id;
    if (!g_item_ear    && code == 0x20726165u) g_item_ear    = id;
    if (!g_item_tome   && code == 0x206B6274u) g_item_tome   = id;
    if (!g_item_scroll && code == 0x20637374u) g_item_scroll = id;
    if (!g_item_charm  && code == 0x20316D63u) g_item_charm  = id;
    if (!g_item_throw  && code == 0x2076616Au) g_item_throw  = id;
    if (!g_item_wand   && code == 0x20646E77u) g_item_wand   = id;
    if (!g_item_bkd    && code == 0x20646B62u) g_item_bkd    = id;
    if (!g_item_trs    && code == 0x20737274u) g_item_trs    = id;
    if (!g_item_ring   && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x0A)) g_item_ring = id;
    if (!g_item_gem    && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x14) &&
        U32(pItems + id * 0x1A8u + 0xBCu) != 0x206E6F6Eu) g_item_gem = id;
  }

  uint32_t pObjs = U32(D2COM_PREF_BASE + 0xA0B94u + g_com_rebase);
  uint32_t nObjs = U32(D2COM_PREF_BASE + 0xA0B98u + g_com_rebase);
  for (uint32_t id = 1; id < nObjs; id++) {
    uint32_t rec = pObjs + id * 0x1C0u;
    if (!g_obj_well && U32(rec + 0x180u) > 0u && U32(rec + 0x180u) <= 8u &&
        (U32(rec + 0x184u) & 3u) != 0u && U32(rec + 0x178u) > 0u) {
      g_obj_well = id;
    }
    if (!g_obj_chest && U8(rec + 0x121u) == 0u && (U32(rec + 0xDCu) >> 8) > 0u) {
      g_obj_chest = id;
    }
    if (!g_obj_chest1 && U8(rec + 0x121u) != 0u && (U32(rec + 0xDCu) >> 8) > 0u) {
      g_obj_chest1 = id;
    }
    if (!g_obj_sel && U8(rec + 0x141u) != 0u && U8(rec + 0xC5u) != 0u && (U32(rec + 0xDCu) >> 8) > 0u) {
      g_obj_sel = id;
    }
    if (!g_obj_has_op && U8(rec + 0x140u) != 0u && (U32(rec + 0xDCu) >> 8) > 0u) {
      g_obj_has_op = id;
    }
    if (!g_obj_no_op && U8(rec + 0x140u) == 0u) {
      g_obj_no_op = id;
    }
  }
}

/* ------------------------------- Batch 1: Quests (41 Lo-VAs) */

static void emit_batch_1(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [B1-01] 0x6FC799D0 ACT5Q6_CallbackSendPacket50Quest24 (ecx=pGame, edx=pPlayer, arg0=0, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(0x24u, 1u, 1u);
    U16(STAGE_QUESTEX0 + 0xA4u) = (uint16_t)(k == 1 ? 0x0042u : 0x0199u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x6Du);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 101u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    uint32_t plr = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = plr; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = plr; ts[2] = 0;
    run_and_emit(0x6FC799D0u, "ACT5Q6_CallbackSendPacket50Quest24_6FC799D0_113c", k,
                 k == 0 ? "null_player_noop" : k == 1 ? "sends_pkt50_0042" : "sends_pkt50_0199",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B1-02] 0x6FC78DA0 ACT5Q5_OnAncientsObjectOperateCompletedMsg (ecx=pOpParam, ret 0, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x78u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 102u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 0x222u, 55u, 0u, 5002u, 5002u, 103u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    if (k >= 1) set_qbit(STAGE_QBITS0, 0x27u, 0u);
    if (k == 1) set_qbit(STAGE_QBITS0, 0x27u, 4u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT1;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC78DA0u, "ACT5Q5_OnAncientsObjectOperateCompletedMsg_6FC78DA0_113c", k,
                 k == 0 ? "bit0_clear_noop" : k == 1 ? "bit4_set_noop" : "sends_msg_4ec9",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B1-03] 0x6FC76D10 ACT5Q1_SeqFilter (ecx=pQuest, ret 0, u8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(0x1Fu, (k == 0 ? 1u : 0u), (k == 0 ? 2u : 5u));
    U32(STAGE_QUEST0 + 0x10u) = (k == 1) ? 99u : 0x20u;
    if (k == 2) {
      uint32_t q2 = STAGE_QUEST0 + 0x100u;
      U32(STAGE_QUEST0 + 0xF4u) = q2;
      U32(q2 + 0x00u) = 0x20u;
      U32(q2 + 0x04u) = STAGE_GAME;
    }
    c.ecx = STAGE_QUEST0;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC76D10u, "ACT5Q1_SeqFilter_6FC76D10_113c", k,
                 k == 0 ? "active_ret1" : k == 1 ? "missing_chain_ret0" : "null_pfSeqFilter_assert",
                 &c, ts, 1, 0xFFu, (k == 2 ? 1 : 0));
  }

  /* [B1-04] 0x6FC806E0 QUESTS_CheckActiveOrChainRefresh (ecx=pQuest, ret 0, u8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(2u, (k == 0 ? 1u : 0u), (k == 0 ? 1u : 5u));
    U32(STAGE_QUEST0 + 0x10u) = (k == 1) ? 99u : 3u;
    if (k == 2) {
      uint32_t q2 = STAGE_QUEST0 + 0x100u;
      U32(STAGE_QUEST0 + 0xF4u) = q2;
      U32(q2 + 0x00u) = 3u;
      U32(q2 + 0x04u) = STAGE_GAME;
    }
    c.ecx = STAGE_QUEST0;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC806E0u, "QUESTS_CheckActiveOrChainRefresh_6FC806E0_113c", k,
                 k == 0 ? "active_ret1" : k == 1 ? "missing_chain_ret0" : "null_pfSeqFilter_assert",
                 &c, ts, 1, 0xFFu, (k == 2 ? 1 : 0));
  }

  /* [B1-05] 0x6FC76BD0 ACT5Q5_SeqFilter (ecx=pQuest, ret 0, u8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(0x23u, (k == 0 ? 1u : 0u), (k == 0 ? 0u : 5u));
    U32(STAGE_QUEST0 + 0x10u) = (k == 1) ? 99u : 0x24u;
    if (k == 2) {
      uint32_t q2 = STAGE_QUEST0 + 0x100u;
      U32(STAGE_QUEST0 + 0xF4u) = q2;
      U32(q2 + 0x00u) = 0x24u;
      U32(q2 + 0x04u) = STAGE_GAME;
    }
    c.ecx = STAGE_QUEST0;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC76BD0u, "ACT5Q5_SeqFilter_6FC76BD0_113c", k,
                 k == 0 ? "active_state0_promotes_ret1" : k == 1 ? "missing_chain_ret0" : "null_pfSeqFilter_assert",
                 &c, ts, 1, 0xFFu, (k == 2 ? 1 : 0));
  }

  /* [B1-06] 0x6FC801B0 QUESTS_CheckFirstTimeActiveOrChainRefresh (ecx=pQuest, ret 0, u8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(1u, (k == 0 ? 1u : 0u), (k == 0 ? 1u : 5u));
    U32(STAGE_QUEST0 + 0x10u) = (k == 1) ? 99u : 2u;
    if (k == 2) {
      uint32_t q2 = STAGE_QUEST0 + 0x100u;
      U32(STAGE_QUEST0 + 0xF4u) = q2;
      U32(q2 + 0x00u) = 2u;
      U32(q2 + 0x04u) = STAGE_GAME;
    }
    c.ecx = STAGE_QUEST0;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC801B0u, "QUESTS_CheckFirstTimeActiveOrChainRefresh_6FC801B0_113c", k,
                 k == 0 ? "first_time_active_ret1" : k == 1 ? "missing_chain_ret0" : "null_pfSeqFilter_assert",
                 &c, ts, 1, 0xFFu, (k == 2 ? 1 : 0));
  }

  /* [B1-07] 0x6FC7CF70 ACT5Q3_SpawnFrozenAnyaMonsterIfNeeded (ecx=pCoordInfo, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x72u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_ROOM0;
    U32(STAGE_SCRATCH + 0x14u) = 5000u;
    U32(STAGE_SCRATCH + 0x18u) = 5000u;
    if (k >= 1) {
      stage_quest_node(0x21u, 1u, 1u);
      U32(STAGE_QUESTEX0 + 0x88u) = (k == 2) ? 1u : 0u;
      U8(STAGE_QUESTEX0 + 0x92u)  = (k == 1) ? 1u : 0u;
    }
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC7CF70u, "ACT5Q3_SpawnFrozenAnyaMonsterIfNeeded_6FC7CF70_113c", k,
                 k == 0 ? "no_quest21_noop" : k == 1 ? "field88_zero_noop" : "attempts_spawn_in_room",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-08] 0x6FC7C1F0 ACT5Q2_SpawnMonster209NearUnitOffsetMinus5 (ecx=pUnit, arg0=pGame, arg1=pRoom, ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x6Fu);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u,
                      (uint16_t)(5010u + k * 5u), 5010u, 108u + (uint32_t)k);
    uint32_t rm = (k == 0) ? 0u : STAGE_ROOM0;
    c.ecx = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = rm; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = rm;
    run_and_emit(0x6FC7C1F0u, "ACT5Q2_SpawnMonster209NearUnitOffsetMinus5_6FC7C1F0_113c", k,
                 k == 0 ? "null_room" : k == 1 ? "room_at_5015" : "room_at_5020",
                 &c, ts, 3, 0u, 0);
  }

  /* [B1-09] 0x6FC88D70 ACT1Q5_OnForgottenTowerTomeOperated (ecx=pOperateArgs, ret 0, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 6u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 109u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, g_obj_chest, 50u,
                      (k >= 1 ? 1u : 0u), 5002u, 5002u, 110u);
    if (k >= 1) {
      stage_quest_node(5u, (k == 2 ? 1u : 0u), 0u);
      U8(STAGE_QUEST0 + 0x0Bu) = 0u;
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT1;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x10u) = g_obj_chest;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC88D70u, "ACT1Q5_OnForgottenTowerTomeOperated_6FC88D70_113c", k,
                 k == 0 ? "mode0_no_quest5_anim_event" : k == 1 ? "mode1_inactive_noop" : "mode1_active_sends_msg_and_advances",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B1-10] 0x6FC85A70 ACT1Q4_Callback02_OnGriswoldDeath (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x26u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 111u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x109u, 60u, 1u, 5004u, 5004u, 112u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    if (k == 0) set_qbit(STAGE_QBITS0, 4u, 0x0Au);
    if (k == 1) U32(STAGE_GAME + 0x70u) = 0u; /* Classic: checks quest 0x1A bit 0 */
    stage_quest_node(4u, 1u, 1u);
    U32(STAGE_QUESTARG + 0x00u) = (k == 2) ? 0u : STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = (k == 2) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FC85A70u, "ACT1Q4_Callback02_OnGriswoldDeath_6FC85A70_113c", k,
                 k == 0 ? "bit0a_already_set" : k == 1 ? "classic_bit1a_clear_early" : "null_game_sets_vps_assert_2503",
                 &c, ts, 2, 0u, (k == 2 ? 1 : 0));
  }

  /* [B1-11] 0x6FC7E000 ACT5Q5_ResetAncientMonsterToStatue (ebx=pGame, edi=dwMonId, ret 0, u8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x78u);
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, 0u,
                        STAGE_ROOM0, 1u, 0x21Cu, 77u, 1u, 5000u, 5000u, 113u);
      if (k == 2) {
        fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x36, 1);
      }
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    c.ebx = STAGE_GAME; c.edi = 77u;
    ts[0] = STAGE_GAME; ts[1] = 77;
    run_and_emit(0x6FC7E000u, "ACT5Q5_ResetAncientMonsterToStatue_6FC7E000_113c", k,
                 k == 0 ? "missing_monster_ret0" : k == 1 ? "no_room_state_clear_ret1" : "no_room_state36_refresh_ai_ret1",
                 &c, ts, 2, 0xFFu, 0);
  }

  /* [B1-12] 0x6FC88AB0 ACT1Q5_RecordPlayerInMalusRoomAndSpawnLightning (ecx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x25u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x6Cu, 88u, 0u, 5000u, 5000u, 114u);
    if (k >= 1) {
      stage_quest_node(5u, 1u, 1u);
      if (k == 2) {
        U8(STAGE_QUESTEX0 + 0x118u) = 1u;
        U8(STAGE_QUESTEX0 + 0x119u) = 0u;
      }
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x04u) = STAGE_UNIT0;
    c.ecx = STAGE_QUESTARG;
    ts[0] = STAGE_QUESTARG;
    run_and_emit(0x6FC88AB0u, "ACT1Q5_RecordPlayerInMalusRoomAndSpawnLightning_6FC88AB0_113c", k,
                 k == 0 ? "no_quest5_noop" : k == 1 ? "records_guid_no_event" : "records_guid_and_schedules_ev7",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-14] 0x6FC79450 ACT5Q4_Callback11_OnPlayerConnect (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x6Du);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 116u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    stage_quest_node(0x22u, 1u, 0u);
    U32(STAGE_QUEST0 + 0xE0u) = 0x26u;
    if (k == 0) set_qbit(STAGE_QBITS0, 0x26u, 0u);
    if (k == 1) set_qbit(STAGE_QBITS0, 0x26u, 4u);
    if (k == 2) set_qbit(STAGE_QBITS0, 0x26u, 3u);
    if (k == 3) set_qbit(STAGE_QBITS0, 0x26u, 2u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FC79450u, "ACT5Q4_Callback11_OnPlayerConnect_6FC79450_113c", k,
                 k == 0 ? "bit0_sets_fState5" : k == 1 ? "bit4_sets_2_3" : k == 2 ? "bit3_sets_1_3" : "bit2_sets_1_2",
                 &c, ts, 2, 0u, 0);
  }

  /* [B1-15] 0x6FC7C2A0 ACT5Q2_SpawnBarbarianSoldiersInPrison (stdcall pQuest, pCoordInfo, nGroupIdx, ret 12, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x6Fu);
    stage_quest_node(0x20u, (k == 2 ? 1u : 0u), 1u);
    U32(STAGE_SCRATCH + 0x08u) = STAGE_ROOM0;
    U32(STAGE_SCRATCH + 0x14u) = 5000u;
    U32(STAGE_SCRATCH + 0x18u) = 5000u;
    uint32_t pq = (k == 0) ? 0u : STAGE_QUEST0;
    c.nargs = 3; c.args[0] = pq; c.args[1] = STAGE_SCRATCH; c.args[2] = 0u; c.calleePop = 12u;
    ts[0] = pq; ts[1] = STAGE_SCRATCH; ts[2] = 0;
    run_and_emit(0x6FC7C2A0u, "ACT5Q2_SpawnBarbarianSoldiersInPrison_6FC7C2A0_113c", k,
                 k == 0 ? "null_quest_ret0" : k == 1 ? "inactive_quest_ret0" : "active_spawn_loop",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B1-16] 0x6FC7DDF0 ACT5Q3_TryUseThawPotionOnFrozenAnya (ecx=pGame, edx=pTarget, arg0=pPlayer, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x72u);
    stage_quest_node(0x21u, 1u, 1u);
    uint32_t target = 0u;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u,
                        (k == 1 ? 1u : 0x20Fu), 95u, 1u, 5000u, 5000u, 117u);
      uint32_t pHeadPtr = STAGE_SCRATCH + 0x100u;
      U32(STAGE_UDATA0 + 0x30u) = pHeadPtr;
      if (k == 2) {
        stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5002u, 5002u, 118u);
        U32(STAGE_UDATA1 + 0x9Cu) = 0u;
        uint32_t pNode = STAGE_SCRATCH + 0x120u;
        U32(pHeadPtr) = pNode;
        U32(pNode + 0x00u) = STAGE_UNIT1;
        U32(pNode + 0x04u) = 1u;
        U32(pNode + 0x08u) = 0u;
      }
      target = STAGE_UNIT0;
    }
    c.ecx = STAGE_GAME; c.edx = target; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = target; ts[2] = 0;
    run_and_emit(0x6FC7DDF0u, "ACT5Q3_TryUseThawPotionOnFrozenAnya_6FC7DDF0_113c", k,
                 k == 0 ? "null_target_ret0" : k == 1 ? "wrong_class_ret0" : "active_interact_closes_ret1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B1-17] 0x6FC54760 QUESTS_RefreshInventoryQuestItems (eax=pUnit, arg0=pGame, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 118u);
    if (k >= 1) {
      uint32_t cls = (k == 1) ? g_item_sword : g_item_malus;
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, cls, 200u, 0u, 0u, 0u, 119u);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 0u, 0u);
    }
    if (k == 2) {
      uint32_t pItems = U32(D2COM_PREF_BASE + 0x9FB98u + g_com_rebase);
      uint8_t qByte = U8(pItems + g_item_malus * 0x1A8u + 0x12Au);
      stage_quest_node((uint32_t)(qByte - 1u), 1u, 1u);
      U32(STAGE_QUEST0 + 0xC4u) = 0u; /* null cb9 skips callback cleanly */
    }
    c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FC54760u, "QUESTS_RefreshInventoryQuestItems_6FC54760_113c", k,
                 k == 0 ? "empty_inv" : k == 1 ? "non_quest_item" : "quest_item_null_cb9",
                 &c, ts, 2, 0u, 0);
  }

  /* [B1-18] 0x6FC7B690 QUESTS_Act1AndarielOnDeath (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x7Bu);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, (k == 1 ? 0u : STAGE_PATH0),
                      STAGE_ROOM0, 1u, 0x20Eu, 99u, 1u, 5000u, 5000u, 120u);
    stage_quest_node(0x22u, (k == 0 ? 0u : 1u), 1u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT0;
    if (k == 2) {
      U32(STAGE_QUESTCTRL + 0x08u) = 1u;
      U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS0;
      U32(STAGE_QBITS0 + 0x00u) = STAGE_QBITS0 + 0x10u;
      U32(STAGE_QBITS0 + 0x04u) = 0x60u;
    }
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FC7B690u, "QUESTS_Act1AndarielOnDeath_6FC7B690_113c", k,
                 k == 0 ? "inactive_noop" : k == 1 ? "null_room_noop" : "active_sets_state4_and_timer",
                 &c, ts, 2, 0u, 0);
  }

  /* [B1-19] 0x6FC7E0E0 ACT5Q5_ResetAncientsToStatuesAndAltar (stdcall pGame, pQuest, pQuestData, ret 12, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x78u);
    stage_quest_node(0x23u, 1u, 1u);
    U8(STAGE_QUESTEX0 + 0x48u) = 1u;
    U32(STAGE_QUESTEX0 + 0x4Cu) = 3u;
    U32(STAGE_QUESTEX0 + 0x40u) = 3u;
    U32(STAGE_QUESTEX0 + 0x44u) = 3u;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x222u, 101u, 2u, 5000u, 5000u, 121u);
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 0x223u, 102u, 2u, 5005u, 5005u, 122u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U32(STAGE_QUESTEX0 + 0x14u) = 101u;
      U32(STAGE_QUESTEX0 + 0x50u) = 102u;
    }
    if (k == 2) {
      stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, 0u, STAGE_ROOM0, 1u, 0x21Cu, 103u, 1u, 5010u, 5010u, 123u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
      U8(STAGE_QUESTEX0 + 0x2Cu)  = 1u;
      U32(STAGE_QUESTEX0 + 0x20u) = 103u;
    }
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_QUEST0; c.args[2] = STAGE_QUESTEX0; c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_QUEST0; ts[2] = STAGE_QUESTEX0;
    run_and_emit(0x6FC7E0E0u, "ACT5Q5_ResetAncientsToStatuesAndAltar_6FC7E0E0_113c", k,
                 k == 0 ? "clears_flags_only" : k == 1 ? "resets_statue_and_altar_modes" : "resets_ancient_monster_too",
                 &c, ts, 3, 0u, 0);
  }

  /* [B1-20] 0x6FC77900 ACT5Q4_CheckPlayerNearNihlathakRoom (ecx=pGame, edx=pPlayer, arg0=0, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x7Bu);
    stage_room(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 0x7Bu);
    stage_quest_node(0x22u, 1u, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, (k == 0 ? 0u : STAGE_PATH0),
                      STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 124u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    set_qbit(STAGE_QBITS0, 0x25u, 0u);
    if (k == 1) {
      U32(STAGE_QUESTEX0 + 0x8Cu) = STAGE_ROOM0;
    } else if (k == 2) {
      U32(STAGE_QUESTEX0 + 0x8Cu) = STAGE_ROOM1;
      U32(STAGE_SCRATCH + 0x00u) = STAGE_ROOM0;
      U32(STAGE_SCRATCH + 0x04u) = STAGE_ROOM1;
      U32(STAGE_ROOM0 + 0x00u)   = STAGE_SCRATCH;
      U32(STAGE_ROOM0 + 0x24u)   = 2u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC77900u, "ACT5Q4_CheckPlayerNearNihlathakRoom_6FC77900_113c", k,
                 k == 0 ? "null_room_ret0" : k == 1 ? "same_room_sets_q26" : "adj_room_sets_q26",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B1-21] 0x6FC7AE20 ACT5Q4_OnPlayerEnteredOrInitState (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x7Bu);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 125u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    U32(STAGE_UDATA0 + 0x1Cu) = STAGE_QBITS1; /* waypoint data */
    stage_quest_node(0x22u, (k == 0 ? 0u : 1u), 0u);
    U32(STAGE_QUEST0 + 0xE0u) = 0x26u;
    if (k == 1) set_qbit(STAGE_QBITS0, 0x26u, 3u);
    if (k == 2) set_qbit(STAGE_QBITS0, 0x26u, 2u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FC7AE20u, "ACT5Q4_OnPlayerEnteredOrInitState_6FC7AE20_113c", k,
                 k == 0 ? "inactive_checks_wp_sets_89" : k == 1 ? "bit3_sets_state3" : "bit2_sets_state2",
                 &c, ts, 2, 0u, 0);
  }

  /* [B1-22] 0x6FC7C480 ACT5Q4_AdvanceObjectToMonsterSpawn (ecx=pGame, edx=pQuest, ret 0, u8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x72u);
    stage_quest_node(0x21u, 1u, 1u);
    if (k == 0) U8(STAGE_QUESTEX0 + 0x90u) = 1u;
    if (k == 2) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x22Eu, 111u, 0u, 5000u, 5000u, 126u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      U32(STAGE_QUESTEX0 + 0xFCu) = 111u;
      U32(STAGE_QUESTEX0 + 0x8Cu) = 0u;
    } else if (k == 3) {
      U32(STAGE_QUESTEX0 + 0xFCu) = 999u;
      U32(STAGE_QUESTEX0 + 0x8Cu) = 1u;
    }
    uint32_t gm = (k == 1) ? 0u : STAGE_GAME;
    c.ecx = gm; c.edx = STAGE_QUEST0;
    ts[0] = gm; ts[1] = STAGE_QUEST0;
    run_and_emit(0x6FC7C480u, "ACT5Q4_AdvanceObjectToMonsterSpawn_6FC7C480_113c", k,
                 k == 0 ? "already_done_ret0" : k == 1 ? "null_game_assert_723" : k == 2 ? "step0_mode2_step1" : "step1_missing_obj_step2",
                 &c, ts, 2, 0xFFu, (k == 1 ? 1 : 0));
  }

  /* [B1-23] 0x6FC85620 ACT1Q2_OnBloodRavenKilled (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x11u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x10Bu, 120u, 1u, 5000u, 5000u, 127u);
    stage_quest_node(2u, (k == 0 ? 0u : 1u), 1u);
    U32(STAGE_QUEST0 + 0xE0u) = 2u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT0;
    if (k == 2) {
      U32(STAGE_QUESTCTRL + 0x08u) = 1u;
      U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS0;
      U32(STAGE_QBITS0 + 0x00u) = STAGE_QBITS0 + 0x10u;
      U32(STAGE_QBITS0 + 0x04u) = 0x60u;
    }
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FC85620u, "ACT1Q2_OnBloodRavenKilled_6FC85620_113c", k,
                 k == 0 ? "inactive_noop" : k == 1 ? "qc_flag8_zero_assert" : "active_completes_and_timer",
                 &c, ts, 2, 0u, (k == 1 ? 1 : 0));
  }

  /* [B1-24] 0x6FC85D40 ACT1Q5_OnTreeOfInifussOperated (ecx=pOperateArgs, ret 0, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x1Bu);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 128u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 0x6Cu, 121u, 0u, 5002u, 5002u, 129u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x0C, 5, 0);
    if (k >= 1) stage_quest_node(3u, (k == 1 ? 0u : 1u), 1u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT1;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC85D40u, "ACT1Q5_OnTreeOfInifussOperated_6FC85D40_113c", k,
                 k == 0 ? "no_quest3_noop" : k == 1 ? "inactive_mode2_snd13" : "low_level_snd13",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B1-25] 0x6FC87320 ACT1Q6_SpawnCatacombs4ReturnPortal (ecx=pGame, edx=pUnit, arg0=0, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 2 ? 0x25u : 2u));
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, (k == 0 ? 0u : STAGE_PATH0),
                      STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 130u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC87320u, "ACT1Q6_SpawnCatacombs4ReturnPortal_6FC87320_113c", k,
                 k == 0 ? "null_room_ret0" : k == 1 ? "wrong_level_ret0" : "catacombs4_ret1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B1-27] 0x6FC7C850 QUESTS_Act5RescueBarbsOnPrisonDoorOpen (ecx=pArgs, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x6Fu);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_ROOM0;
    U32(STAGE_SCRATCH + 0x14u) = 5000u;
    U32(STAGE_SCRATCH + 0x18u) = 5000u;
    stage_quest_node(0x20u, (k == 0 ? 0u : 1u), (k == 1 ? 0u : 2u));
    if (k == 1) {
      U8(STAGE_QUESTEX0 + 0x86u) = 1u;
      U8(STAGE_QUESTEX0 + 0x87u) = 1u;
      U8(STAGE_QUESTEX0 + 0x88u) = 1u;
    } else if (k == 2) {
      U8(STAGE_QUESTEX0 + 0x86u)  = 1u;
      U32(STAGE_QUESTEX0 + 0x8Cu) = 5000u;
      U32(STAGE_QUESTEX0 + 0x90u) = 5000u;
    }
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC7C850u, "QUESTS_Act5RescueBarbsOnPrisonDoorOpen_6FC7C850_113c", k,
                 k == 0 ? "inactive_quest20_noop" : k == 1 ? "all_groups_spawned_advances_state" : "dup_coord_early_return",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-28] 0x6FC88B90 ACT1Q5_OnAndarielKilled (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x25u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x9Cu, 130u, 1u, 5012u, 5024u, 132u);
    stage_quest_node(5u, (k >= 2 ? 1u : 0u), 1u);
    U32(STAGE_QUEST0 + 0xE0u) = 6u;
    U8(STAGE_QUESTEX0 + 0x119u) = (k == 0) ? 1u : 0u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT0;
    if (k == 3) {
      U32(STAGE_QUESTCTRL + 0x08u) = 1u;
      U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS0;
      U32(STAGE_QBITS0 + 0x00u) = STAGE_QBITS0 + 0x10u;
      U32(STAGE_QBITS0 + 0x04u) = 0x60u;
    }
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FC88B90u, "ACT1Q5_OnAndarielKilled_6FC88B90_113c", k,
                 k == 0 ? "inactive_flag119_1" : k == 1 ? "inactive_schedules_ev7" : k == 2 ? "qc_flag8_zero_assert" : "active_full_completion",
                 &c, ts, 2, 0u, (k == 2 ? 1 : 0));
  }

  /* [B1-29] 0x6FC7A820 ACT5Q6_RollBaalTauntMonsterIdAndBroadcastPacket50 (ecx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(0x24u, 1u, 1u);
    U8(STAGE_QUESTEX0 + 0xA0u)  = (k == 0) ? 1u : 0u;
    U32(STAGE_QUESTCTRL + 0x18u) = (k == 1) ? 0x12345679u : 0x98765431u;
    U32(STAGE_QUESTCTRL + 0x1Cu) = 0x29Au;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    c.ecx = STAGE_QUESTARG;
    ts[0] = STAGE_QUESTARG;
    run_and_emit(0x6FC7A820u, "ACT5Q6_RollBaalTauntMonsterIdAndBroadcastPacket50_6FC7A820_113c", k,
                 k == 0 ? "already_rolled_noop" : k == 1 ? "rolls_seed1" : "rolls_seed2",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-30] 0x6FC7D380 ACT5Q2_SpawnNihlathakPortalFromQuestData (eax=pUnit, arg0=pQuestData, ret 4, u8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 3 ? 0x6Du : 1u));
    if (k == 3) {
      stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH + 0x300u);
      stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 15u, 15u);
    }
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, (k == 1 ? 0u : STAGE_PATH0),
                      STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 133u);
    stage_quest_node(0x21u, 1u, 1u);
    U8(STAGE_QUESTEX0 + 0x88u) = (k == 0) ? 1u : 0u;
    c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_QUEST0; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_QUEST0;
    run_and_emit(0x6FC7D380u, "ACT5Q2_SpawnNihlathakPortalFromQuestData_6FC7D380_113c", k,
                 k == 0 ? "already_spawned_ret0" : k == 1 ? "null_room_assert_e42" : k == 2 ? "wrong_act_assert_e5c" : "act5_no_target_room_ret0",
                 &c, ts, 2, 0xFFu, (k == 1 || k == 2 ? 1 : 0));
  }

  /* [B1-31] 0x6FC7C690 ACT5Q3_SpawnFrozenAnyaAndObject189 (stdcall pQuest, pQuestData, ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x72u);
    stage_quest_node(0x21u, 1u, 1u);
    if (k == 1) {
      U8(STAGE_QUESTEX0 + 0xE1u) = 1u;
      U32(STAGE_QUEST0 + 0x04u)  = 0u; /* null pGame -> assert 723 */
    } else if (k == 2) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x22Eu, 140u, 0u, 5000u, 5000u, 134u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      U8(STAGE_QUESTEX0 + 0xE1u)  = 1u;
      U32(STAGE_QUESTEX0 + 0xE4u) = 140u;
      U8(STAGE_QUESTEX0 + 0x91u)  = 1u;
    }
    c.nargs = 2; c.args[0] = STAGE_QUEST0; c.args[1] = STAGE_QUESTEX0; c.calleePop = 8u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTEX0;
    run_and_emit(0x6FC7C690u, "ACT5Q3_SpawnFrozenAnyaAndObject189_6FC7C690_113c", k,
                 k == 0 ? "flag_e1_zero_noop" : k == 1 ? "null_game_assert_723" : "found_obj_flag91_early",
                 &c, ts, 2, 0u, (k == 1 ? 1 : 0));
  }

  /* [B1-32] 0x6FC7D760 ACT5Q6_SpawnDestructionsEndPortalObject (ecx=pGame, edx=pUnit, arg0=0, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 2 ? 0x84u : 0x6Du));
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, (k == 0 ? 0u : STAGE_PATH0),
                      STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 135u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC7D760u, "ACT5Q6_SpawnDestructionsEndPortalObject_6FC7D760_113c", k,
                 k == 0 ? "null_room_ret0" : k == 1 ? "wrong_level_ret0" : "worldstone_chamber_ret1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B1-34] 0x6FC7EC30 ACT5Q3_CleanupFrozenAnyaAndTownNpcState (stdcall pQuest, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x72u);
    stage_quest_node(0x21u, 1u, 1u);
    if (k == 1) {
      U8(STAGE_QUESTEX0 + 0x91u)  = 1u;
      U32(STAGE_QUESTEX0 + 0x94u) = 150u;
    } else if (k == 2) {
      U8(STAGE_QUESTEX0 + 0x93u)   = 1u;
      U32(STAGE_QUESTEX0 + 0x9Cu)  = 151u;
    }
    c.nargs = 1; c.args[0] = STAGE_QUEST0; c.calleePop = 4u;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC7EC30u, "ACT5Q3_CleanupFrozenAnyaAndTownNpcState_6FC7EC30_113c", k,
                 k == 0 ? "sets_88_only" : k == 1 ? "deletes_inactive_mon200_clears_91" : "deletes_inactive_mon202_clears_93",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-35] 0x6FC85B40 ACT1Q4_OperateInifussTree (ecx=pOpStrc, ret 0, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 5u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 140u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 0x1Eu, 160u, 0u, 5002u, 5002u, 141u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    if (k >= 1) stage_quest_node(4u, (k == 1 ? 0u : 1u), 1u);
    if (k == 2) {
      stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_bkd, 201u, 0u, 0u, 0u, 142u);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT2, 0u, 0u, 0u);
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT1;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC85B40u, "ACT1Q4_OperateInifussTree_6FC85B40_113c", k,
                 k == 0 ? "missing_quest4_assert" : k == 1 ? "inactive_mode1" : "already_has_scroll_snd13",
                 &c, ts, 1, 0xFFFFFFFFu, (k == 0 ? 1 : 0));
  }

  /* [B1-36] 0x6FC7CD50 ACT5Q3_Callback02_OnFrozenAnyaObjectActivate (ecx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x72u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 143u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 0x22Eu, 165u, 0u, 5002u, 5002u, 144u);
    if (k >= 1) {
      stage_quest_node(0x21u, 1u, 1u);
      U32(STAGE_QUEST0 + 0xE0u) = 0x25u;
      U8(STAGE_QUEST0 + 0x0Bu) = 1u;
    }
    if (k == 2) {
      stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_potion, 202u, 0u, 0u, 0u, 145u);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT2, 0u, 0u, 0u);
      set_qbit(STAGE_QBITS0, 0x25u, 0u); /* already completed quest 25 -> skips removeItem */
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x04u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT0;
    c.ecx = STAGE_QUESTARG;
    ts[0] = STAGE_QUESTARG;
    run_and_emit(0x6FC7CD50u, "ACT5Q3_Callback02_OnFrozenAnyaObjectActivate_6FC7CD50_113c", k,
                 k == 0 ? "no_quest21_noop" : k == 1 ? "no_potion_msg_and_fState3" : "has_potion_already_completed_early",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-37] 0x6FC7A310 ACT5Q2_Callback02_MonsterKilled (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x6Fu);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH + 0x200u);
    stage_quest_node(0x20u, (k == 0 ? 0u : 1u), 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u,
                      (k == 2 ? 0x1B2u : 0x216u), 170u, 1u, 5000u, 5000u, 146u);
    if (k == 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x216u, 171u, 1u, 5003u, 5003u, 147u);
      U32(STAGE_ROOM0 + 0x74u) = STAGE_UNIT1;
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FC7A310u, "ACT5Q2_Callback02_MonsterKilled_6FC7A310_113c", k,
                 k == 0 ? "inactive_noop" : k == 1 ? "soldier_killed_inc_a8" : "door_killed_rescues_nearby_soldier",
                 &c, ts, 2, 0u, 0);
  }

  /* [B1-38] 0x6FC85760 ACT1Q1_OnMonsterKilled (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 8u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 7u, 1u, 5000u, 5000u, 148u);
    stage_quest_node(1u, (k == 0 ? 0u : 1u), 1u);
    U32(STAGE_QUEST0 + 0xE0u) = 1u;
    if (k == 2) {
      uint32_t pDenStats = STAGE_SCRATCH + 0x300u;
      U32(STAGE_GAME + 0x110u) = pDenStats;
      U32(pDenStats + 0x04u)   = 5u;
      U32(pDenStats + 0x2CCu)  = 10u;
      U32(pDenStats + 0x2D0u)  = 7u; /* 3 remaining <= 5 */
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FC85760u, "ACT1Q1_OnMonsterKilled_6FC85760_113c", k,
                 k == 0 ? "inactive_noop" : k == 1 ? "null_denstats_assert_1e4" : "three_remaining_sets_fState4",
                 &c, ts, 2, 0u, (k == 1 ? 1 : 0));
  }

  /* [B1-39] 0x6FC85E90 ACT1Q3_SpawnCairnStonePortalLightning (stdcall pQuestData, pQuestState, ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(5u, 1u, 1u);
    if (k == 1) {
      U32(STAGE_QUEST0 + 0x04u) = 0u; /* null pGame -> assert 0x2D3 */
      U8(STAGE_QUESTEX0 + 0x118u) = 1u;
      U16(STAGE_QUESTEX0 + 0x88u) = 1u;
      U32(STAGE_QUESTEX0 + 0x68u) = 55u;
    } else if (k == 2) {
      U8(STAGE_QUESTEX0 + 0x118u) = 1u;
      U16(STAGE_QUESTEX0 + 0x88u) = 1u;
      U32(STAGE_QUESTEX0 + 0x68u) = 55u;
    }
    c.nargs = 2; c.args[0] = STAGE_QUEST0; c.args[1] = STAGE_QUESTEX0; c.calleePop = 8u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTEX0;
    run_and_emit(0x6FC85E90u, "ACT1Q3_SpawnCairnStonePortalLightning_6FC85E90_113c", k,
                 k == 0 ? "flag118_zero_noop" : k == 1 ? "null_game_assert_2d3" : "stone_not_in_hash",
                 &c, ts, 2, 0u, (k == 1 ? 1 : 0));
  }

  /* [B1-40] 0x6FC7B9B0 ACT5Q2_RescueBarbarianSoldierGroup (stdcall pGame, pPlayer, pSoldier, ret 12, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x6Fu);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH + 0x200u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 149u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x216u, 180u, 1u, 5004u, 5004u, 150u);
    if (k >= 1) {
      stage_quest_node(0x20u, 1u, 1u);
      U32(STAGE_QUESTEX0 + 0xB0u) = 180u; /* group 0 slot 0 */
      U8(STAGE_QUESTEX0 + 0x10Eu) = (k == 1) ? 1u : 0u;
    }
    if (k >= 2) {
      /* k==2: door alive (mode=1); k==3: door dead (mode=12) but distance >= 15 */
      stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 0x1B2u, 181u,
                        (k == 2 ? 1u : 0x0Cu), (k == 2 ? 5006u : 5030u), 5004u, 151u);
      U32(STAGE_ROOM0 + 0x74u) = STAGE_UNIT2;
    }
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_UNIT1; c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1;
    run_and_emit(0x6FC7B9B0u, "ACT5Q2_RescueBarbarianSoldierGroup_6FC7B9B0_113c", k,
                 k == 0 ? "no_quest20_noop" : k == 1 ? "already_rescued_noop" : k == 2 ? "door_alive_scans_room" : "dead_door_too_far_scans_room",
                 &c, ts, 3, 0u, 0);
  }

  /* [B1-41] 0x6FC864F0 ACT1Q4_Callback02_OnCairnStoneActivate (ecx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 4u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 152u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 0x11u, 190u, 0u, 5002u, 5002u, 153u);
    stage_quest_node(4u, 1u, 5u);
    U8(STAGE_QUESTEX0 + 0x4Au) = 1u; /* order already randomized */
    U16(STAGE_QUESTEX0 + 0x00u) = 0x11u;
    if (k == 0) {
      set_qbit(STAGE_QBITS0, 4u, 0u);
    } else if (k == 2) {
      stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_bkd, 205u, 0u, 0u, 0u, 154u);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT2, 0u, 0u, 0u);
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x04u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT0;
    U16(STAGE_QUESTARG + 0x10u) = 0x11u;
    c.ecx = STAGE_QUESTARG;
    ts[0] = STAGE_QUESTARG;
    run_and_emit(0x6FC864F0u, "ACT1Q4_Callback02_OnCairnStoneActivate_6FC864F0_113c", k,
                 k == 0 ? "quest_done_snd13" : k == 1 ? "no_scroll_inc_click" : "matching_stone_advances_step",
                 &c, ts, 1, 0u, 0);
  }
}

/* ------------------------------- Batch 2: DRLG/Room/SUnit (39 Lo-VAs) */

static void stage_op_args(
    uint32_t pOp, uint32_t pGame, uint32_t pObj, uint32_t pPlr, uint32_t pSeed, uint32_t objId) {
  U32(pOp + 0x00u) = pGame;
  U32(pOp + 0x04u) = pObj;
  U32(pOp + 0x08u) = pPlr;
  U32(pOp + 0x0Cu) = pSeed;
  U32(pOp + 0x10u) = objId;
  if (pSeed != 0u && U32(pSeed) == 0u) {
    U32(pSeed + 0x00u) = 0x13572469u;
    U32(pSeed + 0x04u) = 0x00000123u;
  }
  if (pGame != 0u && pSeed != 0u) {
    U32(pGame + 0x10F0u) = pSeed;
  }
}

static void emit_batch_2(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [B2-01] 0x6FC4F4B0 OBJRGN_PopulateRoomRandomItemDropsGrid (ecx=pGame, edx=pRoom, arg0=pRoomCoords, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH + 0x200u);
    stage_room_collision_fill(STAGE_ROOM0, 4990u, 4990u, 25u, 25u, 0xFFFFu);
    U32(STAGE_SCRATCH + 0x00u) = 4990u;
    U32(STAGE_SCRATCH + 0x04u) = 4990u;
    U32(STAGE_SCRATCH + 0x08u) = (k == 0) ? 1u : (k == 1) ? 6u : 20u;
    U32(STAGE_SCRATCH + 0x0Cu) = (k == 0) ? 1u : (k == 1) ? 6u : 20u;
    c.ecx = STAGE_GAME; c.edx = STAGE_ROOM0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_ROOM0; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FC4F4B0u, "OBJRGN_PopulateRoomRandomItemDropsGrid_6FC4F4B0_113c", k,
                 k == 0 ? "size1_empty_loop" : k == 1 ? "size6_all_blocked" : "size20_clamped12_blocked",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B2-02] 0x6FC4FA90 OBJECTS_PopulateRoomEdgeObjects (eax=nEdgeGroupIdx, ecx=pGame, arg0=pRoom, arg1=pRoomCoords, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH + 0x200u);
    stage_room_collision_fill(STAGE_ROOM0, 4990u, 4990u, 20u, 20u, 0xFFFFu);
    U32(STAGE_SCRATCH + 0x300u) = 0x2468ACE1u + (uint32_t)k;
    U32(STAGE_SCRATCH + 0x304u) = 0x111u;
    U32(STAGE_GAME + 0x10F0u)   = STAGE_SCRATCH + 0x300u;
    U32(STAGE_SCRATCH + 0x00u)  = 4990u;
    U32(STAGE_SCRATCH + 0x04u)  = 4990u;
    U32(STAGE_SCRATCH + 0x08u)  = 1u;
    U32(STAGE_SCRATCH + 0x0Cu)  = 1u;
    uint32_t grp = (k == 0) ? 2u : (k == 1) ? 0u : 1u;
    c.eax = grp; c.ecx = STAGE_GAME; c.nargs = 2; c.args[0] = STAGE_ROOM0; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_ROOM0; ts[2] = STAGE_SCRATCH; ts[3] = (int64_t)grp;
    run_and_emit(0x6FC4FA90u, "OBJECTS_PopulateRoomEdgeObjects_6FC4FA90_113c", k,
                 k == 0 ? "grp_oob_noop" : k == 1 ? "grp0_tiny_room" : "grp1_tiny_room",
                 &c, ts, 4, 0u, 0);
  }

  /* [B2-03] 0x6FC50150 OBJECTS_PopulateCrateClustersInRoom (ecx=pGame, edx=pRoom, arg0=nDensity, arg1=nObjId, arg2=wProb, ret 12, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH + 0x200u);
    stage_room_collision_fill(STAGE_ROOM0, 4990u, 4990u, 32u, 32u, 0xFFFFu);
    U32(STAGE_SCRATCH + 0x300u) = 0x13579BDFu;
    U32(STAGE_SCRATCH + 0x304u) = 0x222u;
    U32(STAGE_GAME + 0x10F0u)   = STAGE_SCRATCH + 0x300u;
    uint32_t dens = (k == 0) ? 0x81u : 0x40u;
    uint32_t objId = (k == 2) ? 0x2Eu : 0x05u;
    uint32_t prob = (k == 1) ? 0u : 100u;
    c.ecx = STAGE_GAME; c.edx = STAGE_ROOM0; c.nargs = 3;
    c.args[0] = dens; c.args[1] = objId; c.args[2] = prob; c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_ROOM0; ts[2] = (int64_t)dens; ts[3] = (int64_t)objId; ts[4] = (int64_t)prob;
    run_and_emit(0x6FC50150u, "OBJECTS_PopulateCrateClustersInRoom_6FC50150_113c", k,
                 k == 0 ? "density_gt80_assert" : k == 1 ? "prob0_skip" : "blocked_room_loop_ret0",
                 &c, ts, 5, 0xFFFFFFFFu, (k == 0 ? 1 : 0));
  }

  /* [B2-04] 0x6FC50800 OBJECTS_PopulateBarrelClustersInRoom (ecx=pGame, edx=pRoom, arg0=nDensity, arg1=7, arg2=wProb, ret 12, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH + 0x200u);
    stage_room_collision_fill(STAGE_ROOM0, 4990u, 4990u, 32u, 32u, 0xFFFFu);
    U32(STAGE_SCRATCH + 0x300u) = 0x13579BDFu;
    U32(STAGE_SCRATCH + 0x304u) = 0x222u;
    U32(STAGE_GAME + 0x10F0u)   = STAGE_SCRATCH + 0x300u;
    uint32_t dens = (k == 0) ? 0x81u : 0x40u;
    uint32_t prob = (k == 1) ? 0u : 100u;
    c.ecx = STAGE_GAME; c.edx = STAGE_ROOM0; c.nargs = 3;
    c.args[0] = dens; c.args[1] = 7u; c.args[2] = prob; c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_ROOM0; ts[2] = (int64_t)dens; ts[3] = 7; ts[4] = (int64_t)prob;
    run_and_emit(0x6FC50800u, "OBJECTS_PopulateBarrelClustersInRoom_6FC50800_113c", k,
                 k == 0 ? "density_gt80_assert" : k == 1 ? "prob0_skip" : "blocked_room_loop_ret0",
                 &c, ts, 5, 0xFFFFFFFFu, (k == 0 ? 1 : 0));
  }

  /* [B2-05] 0x6FC56B90 OBJECTS_OperateContainer (eax=pOp, ret 0, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t oid = (k == 2) ? g_obj_no_op : g_obj_has_op;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, oid, 200u, (k == 0 ? 1u : 0u), 5000u, 5000u, 201u);
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT0, 0u, STAGE_SCRATCH + 0x300u, oid);
    c.eax = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC56B90u, "OBJECTS_OperateContainer_6FC56B90_113c", k,
                 k == 0 ? "already_open_ret0" : k == 1 ? "has_op_anim_mode1_ev1" : "no_op_anim_mode2",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B2-06] 0x6FC671E0 REGPOP_SpawnMonsterFormation (stdcall pGame, pRoom, pCoordNode, nClassId, pFormation, pOutX, pOutY, ret 28, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH + 0x200u);
    stage_room_collision_fill(STAGE_ROOM0, 4990u, 4990u, 20u, 20u, 0xFFFFu);
    U32(STAGE_ROOM0 + 0x6Cu) = 0x11223345u + (uint32_t)k * 17u;
    U32(STAGE_ROOM0 + 0x70u) = 0x33u;
    uint32_t pForm = STAGE_SCRATCH + 0x00u;
    uint32_t pOutX = STAGE_SCRATCH + 0x80u;
    uint32_t pOutY = STAGE_SCRATCH + 0x84u;
    U32(pForm + 0x00u) = (k == 2) ? 1u : 0u;
    S32(pForm + 0x0Cu) = 0;
    S32(pForm + 0x10u) = 0;
    c.nargs = 7;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_ROOM0; c.args[2] = 0u;
    c.args[3] = 1u; c.args[4] = pForm; c.args[5] = pOutX; c.args[6] = pOutY;
    c.calleePop = 28u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_ROOM0; ts[2] = 0;
    ts[3] = 1; ts[4] = pForm; ts[5] = pOutX; ts[6] = pOutY;
    run_and_emit(0x6FC671E0u, "REGPOP_SpawnMonsterFormation_6FC671E0_113c", k,
                 k == 0 ? "empty_form_seedA_ret1" : k == 1 ? "empty_form_seedB_ret1" : "one_entry_blocked_ret0",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [B2-07] 0x6FC67660 REGPOP_SpawnAmbientPack113c (eax=pLevelsTxt, ecx=pRoom, edx=pGame, arg0=pMonReg, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH + 0x200u);
    stage_room_collision_fill(STAGE_ROOM0, 4990u, 4990u, 20u, 20u, 0xFFFFu);
    U32(STAGE_ROOM0 + 0x6Cu) = 0x55667789u;
    U32(STAGE_ROOM0 + 0x70u) = 0x99u;
    uint32_t pLvlTxt = STAGE_SCRATCH + 0x00u;
    uint32_t pMonReg = STAGE_SCRATCH + 0x400u;
    U8(pLvlTxt + 0x03u) = (uint8_t)(k == 0 ? 5u : k == 1 ? 1u : 0u);
    c.eax = pLvlTxt; c.ecx = STAGE_ROOM0; c.edx = STAGE_GAME;
    c.nargs = 1; c.args[0] = pMonReg; c.calleePop = 4u;
    ts[0] = pLvlTxt; ts[1] = STAGE_ROOM0; ts[2] = STAGE_GAME; ts[3] = pMonReg;
    run_and_emit(0x6FC67660u, "REGPOP_SpawnAmbientPack113c", k,
                 k == 0 ? "act5_oob_noop" : k == 1 ? "act1_zero_count_noop" : "act0_blocked_room_seed_step",
                 &c, ts, 4, 0u, 0);
  }

  /* [B2-09] 0x6FC89E50 OBJ_RollAndDispatchObjectEffectTable (ecx=nIndex, edi=pObject, arg0=pGame, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_chest, 211u, 0u, 5000u, 5000u, 203u);
    /* Seed chosen so (seedLo * 0x6AC690C5 + seedHi) % 100 == 99 (>= chance 5 for idx=3 and chance 3 for idx=18) */
    U32(STAGE_UNIT0 + 0x20u) = 0u;
    U32(STAGE_UNIT0 + 0x24u) = (k == 1) ? 99u : 50u;
    uint32_t idx = (k == 0) ? 40u : (k == 1) ? 3u : 18u;
    c.ecx = idx; c.edi = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)idx; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME;
    run_and_emit(0x6FC89E50u, "OBJ_RollAndDispatchObjectEffectTable_6FC89E50_113c", k,
                 k == 0 ? "idx_oob_ret0" : k == 1 ? "idx3_chance5_roll99_miss" : "idx18_chance3_roll50_miss",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B2-10] 0x6FC8A560 OBJ_UseWellHealPlayerAndPets (eax=pObjectsTxt, esi=pUnit, arg0=pGame, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 204u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);  /* maxhp */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, (k == 1 ? 40 : 100) << 8, 0); /* hp */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 100 << 8, 0);  /* maxmana */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, (k == 2 ? 30 : 100) << 8, 0); /* mana */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 11, 100 << 8, 0); /* maxstamina */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 10, (k == 2 ? 20 : 100) << 8, 0); /* stamina */
    if (k == 2) {
      stage_statlist_state(STAGE_UNIT0, 2u, 0xFFFFFFFFu, 0, 0x20u, 0u); /* poison */
    }
    uint32_t pObjTxt = STAGE_SCRATCH + 0x200u;
    U32(pObjTxt + 0x17Cu) = 128u; /* heal factor 50% */
    U32(pObjTxt + 0x184u) = 3u;   /* heal HP + mana/stamina */
    c.eax = pObjTxt; c.esi = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = pObjTxt; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME;
    run_and_emit(0x6FC8A560u, "OBJ_UseWellHealPlayerAndPets_6FC8A560_113c", k,
                 k == 0 ? "full_vitals_ret0" : k == 1 ? "low_hp_heals_ret1" : "low_mana_stam_poison_heals_ret1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B2-11] 0x6FC8A7A0 OBJ_OperateBookOrSpecialContainer (ecx=pOperateArgs, ret 0, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 205u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    U32(STAGE_UNIT0 + 0x60u)  = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, g_obj_chest, 215u,
                      (k == 0 ? 1u : k == 1 ? 3u : 0u), 5002u, 5002u, 206u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 1) {
      U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
      U32(STAGE_UNIT0 + 0x64u) = 215u;
      U32(STAGE_UNIT0 + 0x68u) = 2u;
    }
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT1, STAGE_UNIT0, STAGE_SCRATCH + 0x300u, g_obj_chest);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC8A7A0u, "OBJ_OperateBookOrSpecialContainer_6FC8A7A0_113c", k,
                 k == 0 ? "mode1_ret1" : k == 1 ? "mode3_interacting_closes" : "mode0_no_gem_snd13",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B2-12] 0x6FC8A960 OBJ_ApplyShrineAuraStatList (ecx=pObject, edx=pUnit, arg0=dur, arg1=val, arg2=statId, arg3=stateId, arg4=pfnRemove, ret 20, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 207u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, g_obj_chest, 219u, 0u, 5002u, 5002u, 208u);
    uint32_t dur     = (k == 0) ? 2400u : (k == 1) ? 3600u : 1800u;
    uint32_t statVal = (k == 0) ? 2u : 75u;
    uint32_t statId  = (k == 0) ? 127u : (k == 1) ? 39u : 43u;
    uint32_t st      = (k == 0) ? 134u : (k == 1) ? 131u : 132u;
    c.ecx = STAGE_UNIT1; c.edx = STAGE_UNIT0; c.nargs = 5;
    c.args[0] = dur; c.args[1] = statVal; c.args[2] = statId; c.args[3] = st; c.args[4] = 0u;
    c.calleePop = 20u;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_UNIT0; ts[2] = (int64_t)dur; ts[3] = (int64_t)statVal;
    ts[4] = (int64_t)statId; ts[5] = (int64_t)st; ts[6] = 0;
    run_and_emit(0x6FC8A960u, "OBJ_ApplyShrineAuraStatList_6FC8A960_113c", k,
                 k == 0 ? "skill_shrine_state134" : k == 1 ? "fire_res_state131" : "cold_res_state132",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [B2-13] 0x6FC8AB60 OBJ_OperateFn_SkillShrine (ecx=pOperateArgs, edx=pShrineRecord, ret 0, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 208u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, g_obj_chest, 220u, 0u, 5002u, 5002u, 209u);
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT1, STAGE_UNIT0, STAGE_SCRATCH + 0x300u, g_obj_chest);
    uint32_t pShr = STAGE_SCRATCH + 0x100u;
    U8(pShr + 0x00u)  = 0x0Cu; /* Skill shrine code */
    U32(pShr + 0x0Cu) = (k == 0) ? 2400u : (k == 1) ? 1200u : 600u;
    c.ecx = STAGE_SCRATCH; c.edx = pShr;
    ts[0] = STAGE_SCRATCH; ts[1] = pShr;
    run_and_emit(0x6FC8AB60u, "OBJ_OperateFn_SkillShrine_6FC8AB60_113c", k,
                 k == 0 ? "skill_shrine_2400f" : k == 1 ? "skill_shrine_1200f" : "skill_shrine_600f",
                 &c, ts, 2, 0u, 0);
  }

  /* [B2-14] 0x6FC8ABB0 OBJ_OperateAuraStatShrine (ecx=pOperateArgs, edx=pShrineTxt, ret 0, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 210u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, g_obj_chest, 221u, 0u, 5002u, 5002u, 211u);
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT1, STAGE_UNIT0, STAGE_SCRATCH + 0x300u, g_obj_chest);
    uint32_t pShr = STAGE_SCRATCH + 0x100u;
    U8(pShr + 0x00u)  = (uint8_t)(k == 0 ? 25u : k == 1 ? 0x08u : k == 2 ? 0x09u : 0x0Au);
    U32(pShr + 0x04u) = 75u;
    U32(pShr + 0x0Cu) = 3600u;
    c.ecx = STAGE_SCRATCH; c.edx = pShr;
    ts[0] = STAGE_SCRATCH; ts[1] = pShr;
    run_and_emit(0x6FC8ABB0u, "OBJ_OperateAuraStatShrine_6FC8ABB0_113c", k,
                 k == 0 ? "code25_assert_9f9" : k == 1 ? "resist_fire_shrine" : k == 2 ? "resist_cold_shrine" : "resist_ltng_shrine",
                 &c, ts, 2, 0xFFFFFFFFu, (k == 0 ? 1 : 0));
  }

  /* [B2-15] 0x6FC8AC30 OBJ_OperateStaminaShrine (ecx=pOperateArgs, edx=pShrineTxt, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 212u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 11, 200 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 10, (k == 2 ? 50 : 200) << 8, 0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, g_obj_chest, 222u, 0u, 5002u, 5002u, 213u);
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT1, STAGE_UNIT0, STAGE_SCRATCH + 0x300u, g_obj_chest);
    uint32_t pShr = STAGE_SCRATCH + 0x100u;
    U8(pShr + 0x00u)  = (uint8_t)(k == 0 ? 25u : 0x0Eu);
    U32(pShr + 0x04u) = 100u;
    U32(pShr + 0x0Cu) = 4800u;
    c.ecx = STAGE_SCRATCH; c.edx = pShr;
    ts[0] = STAGE_SCRATCH; ts[1] = pShr;
    run_and_emit(0x6FC8AC30u, "OBJ_OperateStaminaShrine_6FC8AC30_113c", k,
                 k == 0 ? "code25_assert_9e7" : k == 1 ? "full_stamina" : "partial_stamina_refills",
                 &c, ts, 2, 0u, (k == 0 ? 1 : 0));
  }

  /* [B2-16] 0x6FC8ACE0 OBJ_OperateCombatShrine (ecx=pOperateArgs, edx=pShrineTxt, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 214u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    U32(STAGE_UNIT0 + 0x60u)  = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    stage_used_skill(STAGE_UNIT0, 0u, 1u, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 19, 120, 0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, g_obj_chest, 223u, 0u, 5002u, 5002u, 215u);
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT1, STAGE_UNIT0, STAGE_SCRATCH + 0x300u, g_obj_chest);
    uint32_t pShr = STAGE_SCRATCH + 0x100u;
    U8(pShr + 0x00u)  = (uint8_t)(k == 0 ? 25u : 0x07u);
    U32(pShr + 0x04u) = (k == 1) ? 200u : 50u;
    U32(pShr + 0x08u) = (k == 1) ? 200u : 100u;
    U32(pShr + 0x0Cu) = 2400u;
    c.ecx = STAGE_SCRATCH; c.edx = pShr;
    ts[0] = STAGE_SCRATCH; ts[1] = pShr;
    run_and_emit(0x6FC8ACE0u, "OBJ_OperateCombatShrine_6FC8ACE0_113c", k,
                 k == 0 ? "code25_assert_9c1" : k == 1 ? "combat_200pct" : "combat_50pct",
                 &c, ts, 2, 0u, (k == 0 ? 1 : 0));
  }

  /* [B2-19] 0x6FC8B340 OBJ_OperateTomeOrScrollStand (ecx=pOperateArgs, ret 0, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_chest, 226u, (k == 0 ? 1u : 0u), 5000u, 5000u, 218u);
    U32(STAGE_SCRATCH + 0x300u) = (k == 1) ? 0u : 1u;
    U32(STAGE_SCRATCH + 0x304u) = (k == 1) ? 5u : 19u;
    stage_op_args(STAGE_SCRATCH, (k == 0 ? STAGE_GAME : 0u), STAGE_UNIT0, 0u, STAGE_SCRATCH + 0x300u, g_obj_chest);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC8B340u, "OBJ_OperateTomeOrScrollStand_6FC8B340_113c", k,
                 k == 0 ? "mode1_ret1" : k == 1 ? "mode0_rem5_null_game_assert" : "mode0_rem19_null_game_assert",
                 &c, ts, 1, 0xFFFFFFFFu, (k >= 1 ? 1 : 0));
  }

  /* [B2-20] 0x6FC8B570 OBJ_DropChestTreasureByActLevelTier (stdcall pOperateArgs, nDropArg, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, 0u, 2u, g_obj_chest, 227u, 0u, 5000u, 5000u, 219u);
    if (k == 1) U32(STAGE_UNIT0 + 0x80u) = 0u;
    uint32_t obj = (k == 0) ? 0u : STAGE_UNIT0;
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, obj, 0u, STAGE_SCRATCH + 0x300u, g_obj_chest);
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_SCRATCH; ts[1] = 0;
    run_and_emit(0x6FC8B570u, "OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c", k,
                 k == 0 ? "null_obj_assert_1313" : k == 1 ? "null_game_assert_1315" : "null_room_ret0",
                 &c, ts, 2, 0xFFFFFFFFu, (k < 2 ? 1 : 0));
  }

  /* [B2-26] 0x6FC8B930 OBJECTS_LinkHellPortalToDestinationLevel (ecx=pGame, edx=pPortalUnit, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t srcLvl = (k == 0) ? 0x6Fu : (k == 1) ? 0x70u : 0x71u;
    uint32_t dstLvl = (k == 0) ? 0x7Du : (k == 1) ? 0x7Eu : 0x7Fu;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, srcLvl);
    U32(STAGE_GAME + 0xBCu + 4u * 4u) = STAGE_ACT0; /* pAct[4] */
    U32(STAGE_DRLG0 + 0x47Cu)         = STAGE_LEVEL1;
    U32(STAGE_LEVEL1 + 0x10u)         = STAGE_ROOMEX1;
    U32(STAGE_LEVEL1 + 0x1Cu)         = 1000u; /* tileX */
    U32(STAGE_LEVEL1 + 0x20u)         = 1000u; /* tileY */
    U32(STAGE_LEVEL1 + 0x24u)         = 10u;   /* tileW */
    U32(STAGE_LEVEL1 + 0x28u)         = 10u;   /* tileH */
    U32(STAGE_LEVEL1 + 0x2Cu)         = 1000u; /* portal tileX */
    U32(STAGE_LEVEL1 + 0x30u)         = 1000u; /* portal tileY */
    U32(STAGE_LEVEL1 + 0x34u)         = 0x0Bu; /* portal entry type */
    U32(STAGE_LEVEL1 + 0x1B4u)        = STAGE_DRLG0;
    U32(STAGE_LEVEL1 + 0x1C4u)        = 0x13572469u;
    U32(STAGE_LEVEL1 + 0x1D0u)        = dstLvl;
    U32(STAGE_LEVEL1 + 0x1D8u)        = 1u;
    U32(STAGE_LEVEL1 + 0x22Cu)        = STAGE_LEVEL0;
    U32(STAGE_ROOMEX1 + 0x28u)        = 0x03100000u; /* DT1+preset+grid loaded */
    U32(STAGE_ROOMEX1 + 0x30u)        = STAGE_ROOM1;
    U32(STAGE_ROOMEX1 + 0x34u)        = 1000u;
    U32(STAGE_ROOMEX1 + 0x38u)        = 1000u;
    U32(STAGE_ROOMEX1 + 0x3Cu)        = 10u;
    U32(STAGE_ROOMEX1 + 0x40u)        = 10u;
    U32(STAGE_ROOMEX1 + 0x58u)        = STAGE_LEVEL1;
    U32(STAGE_ROOM1 + 0x10u)          = STAGE_ROOMEX1;
    U32(STAGE_ROOM1 + 0x2Cu)          = STAGE_ACT0;
    U32(STAGE_ROOM1 + 0x34u)          = 3u; /* populated + active -> skips DRLG_PopulateSingleRoom work */
    U32(STAGE_ROOM1 + 0x6Cu)          = 0x13572469u;
    stage_room_self_adj(STAGE_ROOM1, STAGE_SCRATCH + 0x200u);
    stage_room_collision_fill(STAGE_ROOM1, 5000u, 5000u, 20u, 20u, 0xFFFFu);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x3Cu, 233u, 0u, 5000u, 5000u, 225u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC8B930u, "OBJECTS_LinkHellPortalToDestinationLevel_6FC8B930_113c", k,
                 k == 0 ? "frigid_to_abaddon_assert_238" : k == 1 ? "arreat_to_acheron_assert_238" : "tundra_to_infernal_assert_238",
                 &c, ts, 2, 0u, 1);
  }

  /* [B2-27] 0x6FC8B9B0 OBJECTS_OperatePortalShrine (ecx=pOpStrc, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t lvl = (k == 0) ? 2u : (k == 1) ? 1u : 40u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvl);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH + 0x200u);
    stage_room_collision_fill(STAGE_ROOM0, 4990u, 4990u, 20u, 20u, (k == 0 ? 0xFFFFu : 0u));
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 226u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, g_obj_chest, 234u, 0u, 5002u, 5002u, 227u);
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT1, STAGE_UNIT0, STAGE_SCRATCH + 0x300u, g_obj_chest);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC8B9B0u, "OBJECTS_OperatePortalShrine_6FC8B9B0_113c", k,
                 k == 0 ? "blocked_no_free_pos" : k == 1 ? "town_act1_snd18" : "town_act2_snd18",
                 &c, ts, 1, 0u, 0);
  }

  /* [B2-31] 0x6FC8CE10 OBJ_OperateFn48_TrappedSoul (ecx=pOp, ret 0, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t r = (k == 2) ? 0u : STAGE_ROOM0;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, r, 2u, g_obj_chest, 238u, (k == 0 ? 1u : 0u), 5000u, 5000u, 235u);
    U32(STAGE_SCRATCH + 0x300u) = 0u;
    U32(STAGE_SCRATCH + 0x304u) = (k == 1) ? 95u : 10u; /* rem=95 >= 90 vs rem=10 < 90 */
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT0, 0u, STAGE_SCRATCH + 0x300u, g_obj_chest);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC8CE10u, "OBJ_OperateFn48_TrappedSoul_6FC8CE10_113c", k,
                 k == 0 ? "mode1_ret0" : k == 1 ? "rem95_mode1_ev1" : "rem10_null_room_drop0",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B2-32] 0x6FC8D7B0 OBJ_OperateFn28_Urn (ecx=pOp, ret 0, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_chest, 239u, (k == 0 ? 1u : 0u), 5000u, 5000u, 236u);
    uint32_t plr = 0u;
    if (k == 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 51u, 1u, 5002u, 5002u, 237u);
      plr = STAGE_UNIT1;
    }
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT0, plr, STAGE_SCRATCH + 0x300u, g_obj_chest);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC8D7B0u, "OBJ_OperateFn28_Urn_6FC8D7B0_113c", k,
                 k == 0 ? "mode1_ret0" : k == 1 ? "null_plr_breaks_urn" : "mon_plr_breaks_urn",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B2-33] 0x6FC8D8F0 OBJ_OperateBreakawayObject (ecx=pOperateArgs, ret 0, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t oid = (k == 2) ? g_obj_chest1 : g_obj_chest;
    if (k == 2) U32(STAGE_GAME + 0xA8u) = 250u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, oid, 240u, (k == 0 ? 1u : 0u), 5000u, 5000u, 238u);
    U32(STAGE_UNIT0 + 0xC4u) = 0x06u;
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT0, 0u, STAGE_SCRATCH + 0x300u, oid);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC8D8F0u, "OBJ_OperateBreakawayObject_6FC8D8F0_113c", k,
                 k == 0 ? "mode1_ret1" : k == 1 ? "mode0_frame100" : "mode0_frame250",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B2-35] 0x6FC8DD60 OBJ_ScheduleObjectTrapEventOrSound (edi=pOperateArgs, arg0=bTrapIndex, ret 4, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_chest, 242u, 0u, 5000u, 5000u, 240u);
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT0, 0u, STAGE_SCRATCH + 0x300u, g_obj_chest);
    uint32_t tidx = (k == 0) ? 10u : (k == 1) ? 0u : (k == 2) ? 2u : 5u;
    c.edi = STAGE_SCRATCH; c.nargs = 1; c.args[0] = tidx; c.calleePop = 4u;
    ts[0] = STAGE_SCRATCH; ts[1] = (int64_t)tidx;
    run_and_emit(0x6FC8DD60u, "OBJ_ScheduleObjectTrapEventOrSound_6FC8DD60_113c", k,
                 k == 0 ? "idx10_oob_noop" : k == 1 ? "idx0_null_noop" : k == 2 ? "idx2_ev4_snd0d" : "idx5_ev4_snd0d",
                 &c, ts, 2, 0u, 0);
  }

  /* [B2-36] 0x6FC8E150 OBJ_ThinkEventSparkyChest (ecx=pGame, edx=pObjectUnit, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t r = (k == 3) ? 0u : STAGE_ROOM0;
    uint32_t md = (k == 0) ? 1u : (k == 1) ? 3u : 2u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, r, 2u, g_obj_chest, 243u, md, 5000u, 5000u, 241u);
    if (k == 3) U8(STAGE_UDATA0 + 0x04u) = 1u; /* sparkCount 1 -> 2 -> drops chest (null room -> 0) */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC8E150u, "OBJ_ThinkEventSparkyChest_6FC8E150_113c", k,
                 k == 0 ? "mode1_ev9_plus10" : k == 1 ? "mode3_to_mode4" : k == 2 ? "mode2_spark1_ev9_plus25" : "mode2_spark2_null_room_drop0",
                 &c, ts, 2, 0u, 0);
  }

  /* [B2-37] 0x6FC8E4E0 OBJ_EventPeriodicOrTimeOfDaySync (ecx=pGame, edx=pObject, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_SCRATCH + 0x300u) = 0x13579BDFu;
    U32(STAGE_SCRATCH + 0x304u) = 0x123u;
    U32(STAGE_GAME + 0x10F0u)   = STAGE_SCRATCH + 0x300u;
    uint32_t oid = (k < 2) ? 0x18Fu : g_obj_chest;
    uint32_t md  = (k == 1) ? 1u : 0u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, oid, 244u, md, 5000u, 5000u, 242u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC8E4E0u, "OBJ_EventPeriodicOrTimeOfDaySync_6FC8E4E0_113c", k,
                 k == 0 ? "obj18f_mode0_ev8_ev1" : k == 1 ? "obj18f_mode1_to_mode2" : "other_obj_tod_sync",
                 &c, ts, 2, 0u, 0);
  }

  /* [B2-38] 0x6FC8EDB0 OBJ_OperateFn_SparklyChestOrTrapSpawner (ecx=pOperateArgs, ret 0, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t r = (k == 2) ? 0u : STAGE_ROOM0;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, r, 2u, g_obj_chest, 245u, (k < 2 ? (uint32_t)(k + 1) : 0u), 5000u, 5000u, 243u);
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT0, 0u, STAGE_SCRATCH + 0x300u, g_obj_chest);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC8EDB0u, "OBJ_OperateFn_SparklyChestOrTrapSpawner_6FC8EDB0_113c", k,
                 k == 0 ? "mode1_ret1" : k == 1 ? "mode2_ret1" : "mode0_null_room_drop0",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B2-39] 0x6FC8F040 OBJ_OperateChestAndSparkyChest (ecx=pOperateArgs, ret 0, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, (k == 2 ? 6u : 1u), 1u, 1u, 5000u, 5000u, 244u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    uint32_t objRoom = (k == 2) ? 0u : STAGE_ROOM0;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, objRoom, 2u, g_obj_chest, 246u, (k == 0 ? 1u : 0u), 5002u, 5002u, 245u);
    if (k >= 1) {
      U8(STAGE_UDATA1 + 0x04u) = 0x80u; /* locked */
    }
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT1, STAGE_UNIT0, STAGE_SCRATCH + 0x300u, g_obj_chest);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC8F040u, "OBJ_OperateChestAndSparkyChest_6FC8F040_113c", k,
                 k == 0 ? "mode1_ret1" : k == 1 ? "locked_no_key_snd16" : "locked_assassin_unlocks_null_room",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }
}

/* ------------------------------- Batch 3: Skills, Missiles, Combat, Trade & MonAI (37 Lo-VAs) */

static void stage_ai_param(
    uint32_t pAiParam, uint32_t pAiCtrl, uint32_t pTarget, uint32_t nDist, uint32_t pMonStatsTxt) {
  U32(pAiParam + 0x00u) = pAiCtrl;
  U32(pAiParam + 0x08u) = pTarget;
  U32(pAiParam + 0x14u) = nDist;
  U32(pAiParam + 0x1Cu) = pMonStatsTxt;
}

static void emit_batch_3(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [B3-01] 0x6FC2D850 SKILLS_MorphMonsterAndApplyState142 (eax=nSkillId, ecx=pMonster, arg0=pGame, arg1=pSourceUnit, arg2=nSkillLevel, ret 12, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 301u + (uint32_t)k, 1u,
                      (uint16_t)(5000u + (uint32_t)k), 5000u, 301u + (uint32_t)k);
    int32_t sk = (k == 0) ? -1 : (k == 1) ? 9999 : 6; /* -1, oob, or Magic Arrow (non-summon -> ResolveSummon < 0) */
    c.eax = (uint32_t)sk; c.ecx = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = 1u; c.calleePop = 12u;
    ts[0] = sk; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME; ts[3] = 1; ts[4] = STAGE_UNIT0;
    run_and_emit(0x6FC2D850u, "SKILLS_MorphMonsterAndApplyState142_6FC2D850_113c", k,
                 k == 0 ? "neg_skill_noop" : k == 1 ? "oob_skill_noop" : "non_summon_skill_noop",
                 &c, ts, 5, 0u, 0);
  }

  /* [B3-02] 0x6FC2DE70 SKILLS_SrvDo139_ChanneledHoseTick (ecx=pGame, edx=pUnit, arg0=nSkillId, arg1=nSkillLevel, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u + (uint32_t)k, 1u,
                      (uint16_t)(5000u + (uint32_t)k), 5000u, 302u + (uint32_t)k);
    int32_t sk = (k == 0) ? -1 : (k == 1) ? 32 : 41; /* -1, Teleport (no missile), Inferno (no used skill) */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 3u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 3;
    run_and_emit(0x6FC2DE70u, "SKILLS_SrvDo139_ChanneledHoseTick_6FC2DE70_113c", k,
                 k == 0 ? "neg_skill_ret0" : k == 1 ? "no_srv_missile_ret0" : "no_used_skill_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-03] 0x6FC44440 MONUMOD_KnockBeltPotionToGround (ecx=pGame, edx=pUnit, arg0=nUMod, arg1=bUnique, ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 303u, 1u, 5000u, 5000u, 303u);
    /* Seed so roll = newLo % 100: k==1 -> 5 (< 30 returns early), k==2 -> 50 (>= 30 proceeds) */
    U32(STAGE_UNIT0 + 0x20u) = 0u;
    U32(STAGE_UNIT0 + 0x24u) = (k == 1) ? 5u : 50u;
    uint32_t bUniq = (k == 0) ? 0u : 1u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 0u; c.args[1] = bUniq; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = (int64_t)bUniq;
    run_and_emit(0x6FC44440u, "MONUMOD_KnockBeltPotionToGround_6FC44440_113c", k,
                 k == 0 ? "not_unique_noop" : k == 1 ? "roll5_lt30_noop" : "no_target_noop",
                 &c, ts, 4, 0u, 0);
  }

  /* [B3-04] 0x6FC45AD0 MISSILE_SplitForkedProjectilesOnTarget (ecx=pGame, edx=pMissile, arg0=pHitTarget, arg1=bAllowSplit, ret 8, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 305u, 5000u, 5000u, 1u, 306u, 1, 1, 0u, 20u, 305u);
    if (k >= 2) U32(STAGE_UNIT0 + 0xC8u) |= (1u << 10);
    if (k == 3) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 306u, 1u, 5000u, 5000u, 306u);
      U8(STAGE_UDATA1 + 0x16u) = 0x80u; /* already split flag -> returns early */
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    uint32_t allow = (k == 0) ? 0u : 1u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 0u; c.args[1] = allow; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = (int64_t)allow;
    run_and_emit(0x6FC45AD0u, "MISSILE_SplitForkedProjectilesOnTarget_6FC45AD0_113c", k,
                 k == 0 ? "disallow_noop" : k == 1 ? "no_owner_flag_noop" : k == 2 ? "owner_missing_noop" : "owner_already_split_flag80",
                 &c, ts, 4, 0u, 0);
  }

  /* [B3-05] 0x6FC47C90 SKILLS_SrvDo_SpawnCorpseMissile (ecx=pGame, edx=pUnit, arg0=nSkillId, arg1=nSkillLevel, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u + (uint32_t)k, 1u,
                      (uint16_t)(5000u + (uint32_t)k), 5000u, 307u + (uint32_t)k);
    int32_t sk = (k == 0) ? -1 : (k == 1) ? 9999 : 74; /* -1, oob, or Corpse Explosion */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 1;
    run_and_emit(0x6FC47C90u, "SKILLS_SrvDo_SpawnCorpseMissile_6FC47C90_113c", k,
                 k == 0 ? "neg_skill_ret0" : k == 1 ? "oob_skill_ret0" : "no_target_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-06] 0x6FC5BED0 MISSILES_SrvDmg01_SpawnRandomOffsetSubMissile (ecx=pGame, edx=pMissile, arg0=pTargetUnit, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mis = 0u;
    if (k >= 1) {
      stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                         (k == 1 ? 9999u : 0u), 309u, 5000u, 5000u, 0u, 99u, 1, 1, 0u, 20u, 309u);
      if (k == 2) U32(STAGE_UNIT0 + 0xC8u) |= (1u << 10);
      mis = STAGE_UNIT0;
    }
    c.ecx = STAGE_GAME; c.edx = mis; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = mis; ts[2] = 0;
    run_and_emit(0x6FC5BED0u, "MISSILES_SrvDmg01_SpawnRandomOffsetSubMissile_6FC5BED0_113c", k,
                 k == 0 ? "null_missile_ret1" : k == 1 ? "oob_missile_ret1" : "no_sub_or_owner_ret1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B3-07] 0x6FC5C030 MISSILES_SrvDmg02_PlagueJavelin8WaySubMissiles (ecx=pGame, edx=pMissile, arg0=pTargetUnit, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mis = 0u;
    if (k >= 1) {
      stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                         (k == 1 ? 9999u : 0u), 310u, 5000u, 5000u, 0u, 99u, 1, 1, 0u, 20u, 310u);
      if (k == 2) U32(STAGE_UNIT0 + 0xC8u) |= (1u << 10);
      mis = STAGE_UNIT0;
    }
    c.ecx = STAGE_GAME; c.edx = mis; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = mis; ts[2] = 0;
    run_and_emit(0x6FC5C030u, "MISSILES_SrvDmg02_PlagueJavelin8WaySubMissiles_6FC5C030_113c", k,
                 k == 0 ? "null_missile_ret1" : k == 1 ? "oob_missile_ret1" : "no_sub_or_owner_ret1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B3-08] 0x6FC5C260 MISSILES_SrvDmg04_SpawnSubMissileAlongPath (ecx=pGame, edx=pMissile, arg0=pTargetUnit, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mis = 0u;
    if (k >= 1) {
      stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                         (k == 1 ? 9999u : 0u), 311u, 5000u, 5000u, 0u, 99u, 1, 1, 0u, 20u, 311u);
      mis = STAGE_UNIT0;
    }
    c.ecx = STAGE_GAME; c.edx = mis; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = mis; ts[2] = 0;
    run_and_emit(0x6FC5C260u, "MISSILES_SrvDmg04_SpawnSubMissileAlongPath_6FC5C260_113c", k,
                 k == 0 ? "null_missile_ret1" : k == 1 ? "oob_missile_ret1" : "no_submissile_ret1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B3-09] 0x6FC5C700 MISSILES_SrvDmg12_Nova64RingSubMissiles (ecx=pGame, edx=pMissile, arg0=pTargetUnit, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mis = 0u;
    if (k >= 1) {
      stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                         (k == 1 ? 9999u : 0u), 312u, 5000u, 5000u, 0u, 99u, 1, 1, 0u, 20u, 312u);
      if (k == 2) U32(STAGE_UNIT0 + 0xC8u) |= (1u << 10);
      mis = STAGE_UNIT0;
    }
    c.ecx = STAGE_GAME; c.edx = mis; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = mis; ts[2] = 0;
    run_and_emit(0x6FC5C700u, "MISSILES_SrvDmg12_Nova64RingSubMissiles_6FC5C700_113c", k,
                 k == 0 ? "null_missile_ret1" : k == 1 ? "oob_missile_ret1" : "no_sub_or_owner_ret1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B3-10] 0x6FC5C990 MISSILES_SrvDmg13_PoisonExplosionCloud (ecx=pGame, edx=pMissile, arg0=pTargetUnit, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mis = 0u;
    if (k >= 1) {
      stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                         (k == 1 ? 9999u : 0u), 313u, 5000u, 5000u, 0u, 99u, -1, 1, 0u, 20u, 313u);
      if (k == 2) U32(STAGE_UNIT0 + 0xC8u) |= (1u << 10);
      mis = STAGE_UNIT0;
    }
    c.ecx = STAGE_GAME; c.edx = mis; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = mis; ts[2] = 0;
    run_and_emit(0x6FC5C990u, "MISSILES_SrvDmg13_PoisonExplosionCloud_6FC5C990_113c", k,
                 k == 0 ? "null_missile_ret1" : k == 1 ? "oob_missile_ret1" : "no_sub_or_owner_ret1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B3-11] 0x6FC5D320 MISSILES_SpawnTrailingSubMissileIfMoved (esi=pMissile, ebx=nRangeOverride, arg0=pGame, arg1=nSubMissile, arg2=nVelFlag, ret 12, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 315u, 5000u, 5000u, 0u, 99u, 1, 1, 0u, 20u, 315u);
    if (k >= 1) {
      U32(STAGE_PATH0 + 0x38u) = 0u;
      U32(STAGE_PATH0 + 0x48u) = 0x08u; /* dwFlags bit 3 -> PATH_CheckFlag08 != 0 */
    }
    uint32_t rng = (k == 2) ? 10u : 0u;
    uint32_t vf  = (k == 2) ? 5u : 0u;
    c.esi = STAGE_UNIT0; c.ebx = rng;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = 0u; c.args[2] = vf; c.calleePop = 12u;
    ts[0] = STAGE_UNIT0; ts[1] = (int64_t)rng; ts[2] = STAGE_GAME; ts[3] = 0; ts[4] = (int64_t)vf;
    run_and_emit(0x6FC5D320u, "MISSILES_SpawnTrailingSubMissileIfMoved_6FC5D320_113c", k,
                 k == 0 ? "flag08_clear_ret0" : k == 1 ? "moved_no_owner_ret0" : "moved_range_vel_no_owner_ret0",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [B3-13] 0x6FC5D680 MISSILES_SpawnRing16WithOptionalInnerRingSubMissiles (eax=pOriginUnit, edx=nSubMissile, arg0..6, ret 28, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u + (uint32_t)k, 1u,
                      (uint16_t)(5000u + (uint32_t)k), 5000u, 316u + (uint32_t)k);
    uint32_t orig = (k == 2) ? 0u : STAGE_UNIT0;
    int32_t subId = (k == 0) ? -1 : 0;
    uint32_t own  = (k == 1) ? 0u : STAGE_UNIT0;
    c.eax = orig; c.edx = (uint32_t)subId;
    c.nargs = 7;
    c.args[0] = STAGE_GAME; c.args[1] = own; c.args[2] = 1u; c.args[3] = 2u; c.args[4] = 0u; c.args[5] = 4u; c.args[6] = 0u;
    c.calleePop = 28u;
    ts[0] = orig; ts[1] = subId; ts[2] = STAGE_GAME; ts[3] = own; ts[4] = 1; ts[5] = 2; ts[6] = 0; ts[7] = 4; ts[8] = 0;
    run_and_emit(0x6FC5D680u, "MISSILES_SpawnRing16WithOptionalInnerRingSubMissiles_6FC5D680_113c", k,
                 k == 0 ? "neg_sub_ret0" : k == 1 ? "null_owner_ret0" : "null_origin_ret0",
                 &c, ts, 9, 0xFFFFFFFFu, 0);
  }

  /* [B3-14] 0x6FC5EC10 MISSILES_SrvDmg30_ApplySkillStateAndAuraStatsCalc4 (ecx=pGame, edx=pMissile, arg0=pTargetUnit, ret 4, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 1u, 1u, 5000u, 5000u, 317u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 318u, 1u, 5002u, 5002u, 318u);
    /* Skill 146 = Battle Cry (has aura state 0x57 = 87!) */
    int16_t sk = (k == 0) ? -1 : 146;
    stage_missile_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 0u, 319u, 5000u, 5000u, 0u, 1u, sk, 5, 0u, 20u, 319u);
    if (k >= 2) U32(STAGE_UNIT2 + 0xC8u) |= (1u << 10);
    if (k == 3) {
      stage_statlist_state(STAGE_UNIT1, 87u, 0xFFFFFFFFu, 0, 2u, 150u);
    }
    uint32_t tgt = (k == 3) ? STAGE_UNIT1 : 0u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT2; c.nargs = 1; c.args[0] = tgt; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT2; ts[2] = tgt;
    run_and_emit(0x6FC5EC10u, "MISSILES_SrvDmg30_ApplySkillStateAndAuraStatsCalc4_6FC5EC10_113c", k,
                 k == 0 ? "neg_skill_ret1" : k == 1 ? "no_owner_flag_ret1" : k == 2 ? "null_target_ret0" : "applies_battlecry_state87",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B3-15] 0x6FC5F890 MISSILES_SrvDo12_RandomWalkStepProjectile (ecx=pGame, edx=pMissile, ret 0, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH + 0x200u);
    stage_room_collision(STAGE_ROOM0, 4980u, 4980u, 40u, 40u);
    uint32_t mis = 0u;
    if (k >= 1) {
      stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                         (k == 1 ? 9999u : 0u), 320u, 5000u, 5000u, 0u, 1u, 1, 1, 0u, 20u, 320u);
      U32(STAGE_UDATA0 + 0x20u) = 0x12345679u; /* targetX / seedLo */
      U32(STAGE_UDATA0 + 0x24u) = 0x00020003u; /* packed dx=3, dy=2 */
      mis = STAGE_UNIT0;
    }
    c.ecx = STAGE_GAME; c.edx = mis;
    ts[0] = STAGE_GAME; ts[1] = mis;
    run_and_emit(0x6FC5F890u, "MISSILES_SrvDo12_RandomWalkStepProjectile_6FC5F890_113c", k,
                 k == 0 ? "null_missile_ret2" : k == 1 ? "oob_missile_ret2" : "random_walk_step",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B3-16] 0x6FC67900 PALADIN_FindAndSpawnBlessedHammerOrAuraSubMissile (eax=pRoom, edi=nClassId, esi=pFormation, arg0=pGame, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH + 0x200u);
    stage_room_collision_fill(STAGE_ROOM0, 4990u, 4990u, 20u, 20u, 0xFFFFu);
    U32(STAGE_ROOM0 + 0x6Cu) = 0x11223345u + (uint32_t)k * 31u;
    U32(STAGE_ROOM0 + 0x70u) = 0x77u;
    uint32_t pForm = STAGE_SCRATCH + 0x00u;
    U32(pForm + 0x00u) = 1u; /* 1 entry -> blocked room returns 0 cleanly */
    c.eax = STAGE_ROOM0; c.edi = (uint32_t)(1 + k); c.esi = pForm;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_ROOM0; ts[2] = pForm; ts[3] = (int64_t)(1 + k);
    run_and_emit(0x6FC67900u, "PALADIN_FindAndSpawnBlessedHammerOrAuraSubMissile_6FC67900_113c", k,
                 k == 0 ? "cls1_blocked_ret0" : k == 1 ? "cls2_blocked_ret0" : "cls3_blocked_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-16] 0x6FC709E0 SKILLS_ConvertMonsterAndScheduleExpire (eax=pCaster, arg0=pGame, arg1=pTarget, arg2=nSkillId, arg3=nLevel, ret 16, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 322u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 323u, 1u, 5002u, 5002u, 323u);
    uint32_t caster = (k == 1) ? 0u : STAGE_UNIT0;
    uint32_t sk = (k == 0) ? 0u : 95u; /* 0 = early return, 95 = Revive */
    c.eax = caster; c.nargs = 4;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.args[2] = sk; c.args[3] = 3u;
    c.calleePop = 16u;
    ts[0] = caster; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT1; ts[3] = (int64_t)sk; ts[4] = 3;
    run_and_emit(0x6FC709E0u, "SKILLS_ConvertMonsterAndScheduleExpire_6FC709E0_113c", k,
                 k == 0 ? "skill0_noop" : k == 1 ? "null_caster_converts" : "player_caster_converts_revive",
                 &c, ts, 5, 0u, 0);
  }

  /* [B3-17] 0x6FC71340 SKILLS_SrvDo_MonsterConvert (ecx=pGame, edx=pPlayerUnit, arg0=nSkillId, arg1=nSkillLevel, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u,
                      (uint16_t)(5000u + (uint32_t)k), 5000u, 324u);
    int32_t sk = (k == 0) ? 0 : (k == 1) ? 70 : 95;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 2;
    run_and_emit(0x6FC71340u, "SKILLS_SrvDo_MonsterConvert_6FC71340_113c", k,
                 k == 0 ? "skill0_ret0" : k == 1 ? "skill70_no_target_ret0" : "skill95_no_target_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-18] 0x6FCB2CF0 SKILLS_SrvDo_ApplyChargeScaledRadialSkillDamage (ecx=pGame, edx=pAttacker, arg0=nSkillId, arg1=nSkillLevel, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH + 0x200u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 328u);
    int32_t sk = (k == 0) ? -1 : 254; /* Tiger Strike / Dragon Tail */
    uint32_t lvl = (k == 2) ? 5u : 1u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = (int64_t)lvl;
    run_and_emit(0x6FCB2CF0u, "SKILLS_SrvDo_ApplyChargeScaledRadialSkillDamage_6FCB2CF0_113c", k,
                 k == 0 ? "neg_skill_ret0" : k == 1 ? "empty_room_slvl1" : "empty_room_slvl5",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-19] 0x6FCB3340 SKILLS_SrvDo_ExecuteEventsAndTargetRadialDamage (ecx=pGame, edx=pAttacker, arg0=nSkillId, arg1=nSkillLevel, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH + 0x200u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 329u);
    U16(STAGE_PATH0 + 0x10u) = 5004u;
    U16(STAGE_PATH0 + 0x12u) = 5004u;
    int32_t sk = (k == 0) ? -1 : 255; /* Dragon Tail */
    uint32_t lvl = (k == 2) ? 5u : 1u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = (int64_t)lvl;
    run_and_emit(0x6FCB3340u, "SKILLS_SrvDo_ExecuteEventsAndTargetRadialDamage_6FCB3340_113c", k,
                 k == 0 ? "neg_skill_ret0" : k == 1 ? "empty_room_slvl1" : "empty_room_slvl5",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-20] 0x6FCBE420 SKILLS_DispatchSrvDoFunc (eax=nSrvDoFunc, ecx=pGame, edx=pUnit, arg0=nSkillId, arg1=nSkillLevel, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    int32_t idx = (k == 0) ? -1 : (k == 1) ? 0xBF : 0;
    c.eax = (uint32_t)idx; c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 1u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = idx; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT0; ts[3] = 1; ts[4] = 1;
    run_and_emit(0x6FCBE420u, "SKILLS_DispatchSrvDoFunc_6FCBE420_113c", k,
                 k == 0 ? "idx_neg1_ret_neg1" : k == 1 ? "idx_oob_ret_bf" : "idx0_null_ret0",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [B3-21] 0x6FC8FFA0 PLRTRADE_WalkTradeItemList (eax=pPlayer, ret 0, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 332u);
    if (k >= 1) {
      U32(STAGE_UDATA0 + 0x5Cu) = STAGE_SCRATCH + 0x00u;
      if (k == 2) {
        U32(STAGE_SCRATCH + 0x08u) = STAGE_SCRATCH + 0x20u;
        U32(STAGE_SCRATCH + 0x28u) = STAGE_SCRATCH + 0x40u;
        U32(STAGE_SCRATCH + 0x48u) = 0u;
      }
    }
    c.eax = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    run_and_emit(0x6FC8FFA0u, "PLRTRADE_WalkTradeItemList_6FC8FFA0_113c", k,
                 k == 0 ? "no_trade_ret0" : k == 1 ? "empty_list_ret0" : "two_nodes_walked_ret0",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B3-22] 0x6FC90FB0 PLRTRADE_SavePlayerInventorySnapshot (ebx=pPlayer, edi=pGame, ret 0, u8 al) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 333u);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    if (k == 0) {
      U32(STAGE_UDATA0 + 0x5Cu) = STAGE_SCRATCH; /* already has snapshot -> xor al, al */
    } else if (k == 2) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 14, 12345, 0); /* gold */
    }
    c.ebx = STAGE_UNIT0; c.edi = STAGE_GAME;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FC90FB0u, "PLRTRADE_SavePlayerInventorySnapshot_6FC90FB0_113c", k,
                 k == 0 ? "already_has_snap_ret0" : k == 1 ? "saves_empty_inv_snap" : "saves_inv_with_gold",
                 &c, ts, 2, 0xFFu, 0);
  }

  /* [B3-23] 0x6FC915E0 PLRTRADE_RestorePlayerInventoryAndGoldFromSnapshot (eax=pPlayerUnit, ecx=pGame, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 334u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    U32(STAGE_UNIT0 + 0x60u)  = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    uint32_t plr = (k == 0) ? 0u : STAGE_UNIT0;
    if (k == 2) {
      /* Valid empty JM snapshot: 'J','M', 0x00, 0x00 (4 bytes) */
      uint32_t pSnap = STAGE_SCRATCH + 0x00u;
      uint32_t pBuf  = STAGE_SCRATCH + 0x40u;
      U8(pBuf + 0u) = 'J'; U8(pBuf + 1u) = 'M'; U16(pBuf + 2u) = 0u;
      U32(pSnap + 0x00u) = 4u;
      U32(pSnap + 0x04u) = pBuf;
      U32(pSnap + 0x10u) = 777u; /* saved gold */
      U32(STAGE_UDATA0 + 0x5Cu) = pSnap;
    }
    c.eax = plr; c.ecx = STAGE_GAME;
    ts[0] = plr; ts[1] = STAGE_GAME;
    run_and_emit(0x6FC915E0u, "PLRTRADE_RestorePlayerInventoryAndGoldFromSnapshot_6FC915E0_113c", k,
                 k == 0 ? "null_plr_assert_87d" : k == 1 ? "no_snap_assert_885" : "restores_empty_jm_and_gold777",
                 &c, ts, 2, 0u, (k <= 1 ? 1 : 0));
  }

  /* [B3-24] 0x6FC916D0 PLRTRADE_RollbackPlayerItemsToSnapshot (stdcall pGame, pPlayerUnit, ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 335u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    U32(STAGE_UNIT0 + 0x60u)  = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    if (k >= 1) {
      uint32_t pSnap = STAGE_SCRATCH + 0x00u;
      uint32_t pBuf  = STAGE_SCRATCH + 0x40u;
      U8(pBuf + 0u) = 'J'; U8(pBuf + 1u) = 'M'; U16(pBuf + 2u) = 0u;
      U32(pSnap + 0x00u) = 4u;
      U32(pSnap + 0x04u) = pBuf;
      U32(pSnap + 0x10u) = (k == 2) ? 555u : 0u;
      U32(STAGE_UDATA0 + 0x5Cu) = pSnap;
    }
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC916D0u, "PLRTRADE_RollbackPlayerItemsToSnapshot_6FC916D0_113c", k,
                 k == 0 ? "no_snap_noop" : k == 1 ? "rollback_empty_snap_gold0" : "rollback_empty_snap_gold555",
                 &c, ts, 2, 0u, 0);
  }

  /* [B3-25] 0x6FC41590 AIGENERAL_FreeBossMinionListAndClearRefs (eax=pMonster, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mon = 0u;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 336u, 1u, 5000u, 5000u, 336u);
      uint32_t pAiGen = U32(STAGE_UDATA0 + 0x28u);
      U32(pAiGen + 0x28u) = STAGE_GAME;
      U32(pAiGen + 0x2Cu) = 336u;
      U32(pAiGen + 0x30u) = 1u;
      if (k == 2) {
        insert_server_unit(STAGE_GAME, STAGE_UNIT0);
        stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 337u, 1u, 5002u, 5002u, 337u);
        uint32_t pMemAi = U32(STAGE_UDATA1 + 0x28u);
        U32(pMemAi + 0x2Cu) = 336u;
        insert_server_unit(STAGE_GAME, STAGE_UNIT1);
        U32(STAGE_SCRATCH + 0x00u) = 337u;
        U32(STAGE_SCRATCH + 0x04u) = 0u;
        U32(pAiGen + 0x34u) = STAGE_SCRATCH;
      }
      mon = STAGE_UNIT0;
    }
    c.eax = mon;
    ts[0] = mon;
    run_and_emit(0x6FC41590u, "AIGENERAL_FreeBossMinionListAndClearRefs_6FC41590_113c", k,
                 k == 0 ? "null_mon_noop" : k == 1 ? "leader_not_in_hash" : "frees_minion_list_and_clears_ref",
                 &c, ts, 1, 0u, 0);
  }

  /* [B3-26] 0x6FC35730 AI_SelectBaalThroneSpawnClassId113c (ecx=pMonster, arg0=pGame, arg1=pOutClassId, ret 8, u8 al) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 338u, 1u, 5000u, 5000u, 338u);
    uint32_t pMonReg = STAGE_SCRATCH + 0x100u;
    U32(STAGE_UDATA0 + 0x58u) = 2u; /* level index 2 */
    U32(STAGE_GAME + 0xF0u + 2u * 4u) = pMonReg;
    U8(pMonReg + 0x10u) = (uint8_t)(k == 0 ? 0u : k == 1 ? 1u : 4u);
    U16(pMonReg + 0x14u + 0u * 0x34u) = (uint16_t)(k == 0 ? 0xFFFFu : 5u);
    U16(pMonReg + 0x14u + 1u * 0x34u) = 12u;
    U16(pMonReg + 0x14u + 2u * 0x34u) = 24u;
    U16(pMonReg + 0x14u + 3u * 0x34u) = 33u;
    uint32_t pOut = STAGE_SCRATCH + 0x00u;
    c.ecx = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = pOut; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = pOut;
    run_and_emit(0x6FC35730u, "AI_SelectBaalThroneSpawnClassId113c", k,
                 k == 0 ? "empty_reg_fallback_1c5" : k == 1 ? "single_entry_cls5" : "four_entries_rolled",
                 &c, ts, 3, 0xFFu, 0);
  }

  /* [B3-27] 0x6FC37BC0 AI_ThinkMinionSpawner (ecx=pGame, edx=pUnit, arg0=pAiThinkArg, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 339u, 1u, 5000u, 5000u, 339u);
    uint32_t pAiCtrl = STAGE_SCRATCH + 0x100u;
    uint32_t pMonTxt = STAGE_SCRATCH + 0x200u;
    U16(pMonTxt + 0x56u) = 5u;  /* max count */
    U16(pMonTxt + 0x5Cu) = 15u; /* stall frames */
    U16(pMonTxt + 0x68u) = 20u; /* max dist */
    U32(pAiCtrl + 0x18u) = (k == 0) ? 5u : 1u;
    U32(pAiCtrl + 0x14u) = (k == 2) ? 200u : 50u; /* cooldown > gameFrame=100 on k==2 */
    stage_ai_param(STAGE_SCRATCH, pAiCtrl, 0u, (k == 1 ? 30u : 10u), pMonTxt);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FC37BC0u, "AI_ThinkMinionSpawner_6FC37BC0_113c", k,
                 k == 0 ? "at_cap_noop" : k == 1 ? "too_far_stalls" : "on_cooldown_stalls",
                 &c, ts, 3, 0u, 0);
  }

  /* [B3-28] 0x6FC9C340 AI_WallTrapHorizontalY (ecx=pGame, edx=pUnit, arg0=pAiParam, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 344u, 1u, 5000u, 5000u, 344u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5004u,
                      (k == 1 ? 5010u : 5001u), 345u);
    uint32_t pAiCtrl = STAGE_SCRATCH + 0x100u;
    uint32_t pMonTxt = STAGE_SCRATCH + 0x200u;
    U16(pMonTxt + 0x56u) = 2u;  /* aip1 min dist */
    U16(pMonTxt + 0x5Cu) = 15u; /* aip2 max dist */
    U16(pMonTxt + 0x62u) = 20u; /* aip3 cooldown */
    U32(pAiCtrl + 0x14u) = (k == 2) ? 200u : 50u; /* cooldown > gameFrame=100 on k==2 */
    stage_ai_param(STAGE_SCRATCH, pAiCtrl, STAGE_UNIT1, (k == 0 ? 30u : 5u), pMonTxt);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FC9C340u, "AI_WallTrapHorizontalY_6FC9C340_113c", k,
                 k == 0 ? "dist_oob_stalls" : k == 1 ? "dy_gt2_stalls" : "on_cooldown_stalls",
                 &c, ts, 3, 0u, 0);
  }
}

int main(int argc, char **argv) {
  const char *imgPath = (argc > 1) ? argv[1] : "d2game-datatbls-113c.img";
  const char *outPath = (argc > 2) ? argv[2] : "k6-w14-d2game-vectors.ndjson";

  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  AddVectoredExceptionHandler(1, k6_veh);

  void *pTbls  = VirtualAlloc((void *)DATATBLS_BASE, DATATBLS_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pStage = VirtualAlloc((void *)STAGE_BASE, STAGE_TOTAL_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pHeap  = VirtualAlloc((void *)HEAP_BASE, HEAP_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if ((uintptr_t)pTbls != DATATBLS_BASE || (uintptr_t)pStage != STAGE_BASE || (uintptr_t)pHeap != HEAP_BASE) {
    fprintf(stderr, "[k6-w14] VirtualAlloc failed (%p %p %p)\n", pTbls, pStage, pHeap);
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
    fprintf(stderr, "[k6-w14] LoadLibraryA failed (%p %p %p %p %p %p %p)\n",
            (void *)hStorm, (void *)g_hFog, (void *)hLang, (void *)hCmp,
            (void *)g_hCom, (void *)hNet, (void *)g_hGame);
    fflush(stderr);
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-w14] unexpected D2Common rebase: %p\n", (void *)g_hCom);
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
    fprintf(stderr, "[k6-w14] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-w14] failed to open %s for writing\n", outPath);
    return 5;
  }

  emit_batch_1();
  emit_batch_2();
  emit_batch_3();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-w14] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
