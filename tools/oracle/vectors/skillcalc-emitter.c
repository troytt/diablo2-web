/*
 * Milestone 34 [K3] Exit-Gate D2TV Binary Vector Emitter: SKILLCALC
 *
 * Loads the real Diablo II v1.13c DLLs (Storm.dll, Fog.dll, D2Lang.dll,
 * D2Common.dll @ 0x6FD50000, D2Net.dll, D2Game.dll @ 0x6FC20000) and MPQ
 * data tables (D2Common.#10943), then executes real D2Common.dll skill
 * formula, skill level, mana cost, physical/elemental damage, elemental
 * length, and attack rating evaluators on real D2UnitStrc + D2StatListExStrc
 * + D2SkillListStrc units across 1,470 vectors (all 210 player skills across
 * all 7 classes x 7 level/synergy/bonus/mastery configurations):
 *
 *   1.  D2Common:0x6FDA05C0 (#10306) SKILLS_EvaluateSkillLevel
 *   2.  D2Common:0x6FDA0EA0 (#11008) SKILLS_GetSkillLevelByIdWithBonus
 *   3.  D2Common:0x6FDA0560 (#11146) SKILLS_GetUnitSkillBonusBySkillId
 *   4.  D2Common:0x6FD9E6D0 (#10102) SKILLS_EvaluateSkillManaCost
 *   5.  D2Common:0x6FD9EA00 (#10090) SKILLS_EvaluateManaCost256ths
 *   6.  D2Common:0x6FDA1BF0 (#10786) SKILLS_EvaluateSkillFormula (RPN calc)
 *   7.  D2Common:0x6FDA1070 (#10147) SKILLS_GetSkillCalcFieldById (0..72)
 *   8.  D2Common:0x6FDA2100 (#10567) SKILLS_GetSkillPhysMinDamage
 *   9.  D2Common:0x6FDA1FF0 (#10297) SKILLS_GetSkillPhysMaxDamage
 *   10. D2Common:0x6FDA0460 (#10121) SKILLS_GetSkillElemMinDamage
 *   11. D2Common:0x6FDA0360 (#11091) SKILLS_GetSkillElemMaxDamage
 *   12. D2Common:0x6FD9E900 (#10510) SKILLS_GetSkillPeriodicDelayOrLength
 *   13. D2Common:0x6FD9EA50 (#10653) SKILLS_GetSkillToHitBonus
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "vector-format.h"

#define D2COM_PREF_BASE  0x6FD50000u
#define D2GAME_PREF_BASE 0x6FC20000u
#define SKILLCALC_REPS   7u
#define CLASS_SKILL_TOTAL 210u
#define SKILLCALC_COUNT  (CLASS_SKILL_TOTAL * SKILLCALC_REPS) /* 1,470 */
#define SKILLCALC_SEED   0x3334534B4C43414Cull

#pragma pack(push, 1)
typedef struct {
  /* Inputs (22 bytes, +0..+21) */
  uint16_t skillId;             /* +0  (Skills.bin row ID across all 7 classes) */
  uint8_t  charClass;           /* +2  (0..6: Ama, Sor, Nec, Pal, Bar, Dru, Ass) */
  uint8_t  baseSlvl;            /* +3  (1..30) */
  uint16_t synSkillId[3];       /* +4..+9  (synergy / cross-skill IDs or 0xFFFF) */
  uint8_t  synBaseLvl[3];       /* +10..+12 (0..20 hard points per synergy) */
  uint8_t  allSkillsBonus;      /* +13 (0..8 STAT_ITEM_ALLSKILLS = 127) */
  uint8_t  packedSkillBonuses;  /* +14 (bits0..1=class 0..3, bits2..4=tab 0..7, bits5..7=single/oskill 0..7) */
  uint8_t  elemMasteryPct;      /* +15 (0..150 STAT_PASSIVE_*_MASTERY = 329..332) */
  uint8_t  unitFlags;           /* +16 (b0=oskill, b1=skillShrine, b2=fireSkill+2, b3=applyMastery, b4=srcDmg, b5..7=weapDelta) */
  uint8_t  calcFieldCode;       /* +17 (0..72 SkillCalc.txt field code) */
  uint16_t calcSlotOff;         /* +18..+19 (byte offset into D2SkillsTxt for dwCalcOffset) */
  uint8_t  weapMinDmg;          /* +20 (1..80 base weapon min damage) */
  uint8_t  charLvl;             /* +21 (1..99 STAT_LEVEL = 12) */

  /* Outputs from real 1.13c DLL calls (42 bytes, +22..+63) */
  int16_t  effSlvl;             /* +22 (#10306 & #11008) */
  int16_t  bonusSlvl;           /* +24 (#11146) */
  int16_t  manaCost;            /* +26 (#10102) */
  int32_t  manaCost256;         /* +28 (#10090) */
  int32_t  formulaVal;          /* +32 (#10786 @ calcSlotOff) */
  int32_t  calcFieldVal;        /* +36 (#10147 @ calcFieldCode) */
  int32_t  physMinDmg;          /* +40 (#10567) */
  int32_t  physMaxDmg;          /* +44 (#10297) */
  int32_t  elemMinDmg;          /* +48 (#10121) */
  int32_t  elemMaxDmg;          /* +52 (#11091) */
  int32_t  elemLength;          /* +56 (#10510) */
  int32_t  toHitBonus;          /* +60 (#10653) */
} SkillCalcVectorRecord;
#pragma pack(pop)

typedef char SkillCalcSizeCheck[(sizeof(SkillCalcVectorRecord) == 64) ? 1 : -1];

typedef void(__fastcall *Fog_InitLogPrefix_t)(const char *);
typedef void(__fastcall *Fog_InitFileSystem_t)(int, void *);
typedef void(__fastcall *Fog_InitSystem_t)(int, void *);
typedef void(__stdcall *Fog_VoidStd_t)(void);
typedef int(__stdcall *Fog_IsExpansion_t)(void);
typedef BOOL(__stdcall *SFileOpenArchive_t)(const char *, DWORD, DWORD, HANDLE *);
typedef BOOL(__stdcall *SMemFree_t)(void *, const char *, int, DWORD);
typedef int(__fastcall *D2Lang_Init_t)(int, const char *, int);
typedef int(__stdcall *D2Common_InitTables_t)(int, int, int);

/* D2Common unit / statlist / state / skill setup exports */
typedef int32_t(__stdcall *D2Common_GetClassSkillCount_t)(int32_t nCharClass);
typedef int32_t(__stdcall *D2Common_GetClassSkillId_t)(int32_t nCharClass, int32_t nIndex);
typedef void *(__stdcall *D2Common_CreateStatListEx_t)(void *pOwner, uint32_t dwFlags, void *pCb, void *pGame);
typedef void *(__stdcall *D2Common_AllocStatList_t)(void *pMemPool, uint32_t dwFlags, uint32_t dwExpireFrame, int32_t eOwnerType, int32_t dwOwnerId);
typedef int32_t(__stdcall *D2Common_SetStatIfValid_t)(void *pList, int32_t nStatId, int32_t nValue, int32_t nLayer);
typedef void(__stdcall *D2Common_SetUnitStat_t)(void *pUnit, int32_t nStatId, int32_t nValue, int32_t nLayer);
typedef void(__stdcall *D2Common_MergeStatLists_t)(void *pTargetUnit, void *pSubList, int32_t bType);
typedef void(__stdcall *D2Common_ToggleGfxStateFlag_t)(void *pUnit, int32_t nStateId, int32_t bSet);
typedef void *(__stdcall *D2Common_AllocSkillList_t)(void *pMemPool);
typedef void(__stdcall *D2Common_SetSkillLevelOnUnit_t)(void *pUnit, int32_t nSkillId, int32_t nLvl, int32_t bRemZero, void *pFile, int32_t nLine);
typedef void *(__fastcall *D2Common_GetSkillById_t)(void *pUnit, int32_t nSkillId, int32_t nOwnerItemGuid);

/* D2Common skill formula & damage evaluation exports */
typedef int32_t(__stdcall *D2Common_EvaluateSkillLevel_t)(void *pUnit, void *pSkill, int32_t bBonus);
typedef int32_t(__stdcall *D2Common_GetSkillLevelByIdWithBonus_t)(void *pUnit, int32_t nSkillId);
typedef int32_t(__stdcall *D2Common_GetUnitSkillBonusBySkillId_t)(void *pUnit, int32_t nSkillId);
typedef int32_t(__stdcall *D2Common_EvaluateSkillManaCost_t)(int32_t nSkillId, int32_t nLevel);
typedef int32_t(__stdcall *D2Common_EvaluateManaCost256ths_t)(int32_t nSkillId, int32_t nSkillLevel);
typedef int32_t(__stdcall *D2Common_EvaluateSkillFormula_t)(void *pOwner, uint32_t dwCalcOffset, int32_t nSkillId, int32_t nLevel);
typedef int32_t(__stdcall *D2Common_GetSkillCalcFieldById_t)(void *pOwner, int32_t nFieldCode, int32_t nSkillId, int32_t nLevel);
typedef int32_t(__stdcall *D2Common_GetSkillPhysMinDamage_t)(void *pUnit, int32_t nSkillId, int32_t nLevel, int32_t bIncludeSrcDmg);
typedef int32_t(__stdcall *D2Common_GetSkillPhysMaxDamage_t)(void *pUnit, int32_t nSkillId, int32_t nLevel, int32_t bIncludeSrcDmg);
typedef int32_t(__stdcall *D2Common_GetSkillElemMinDamage_t)(void *pOwner, int32_t nSkillId, int32_t nLevel, int32_t bApplyMastery);
typedef int32_t(__stdcall *D2Common_GetSkillElemMaxDamage_t)(void *pOwner, int32_t nSkillId, int32_t nLevel, int32_t bApplyMastery);
typedef int32_t(__stdcall *D2Common_GetSkillElemLength_t)(void *pOwner, int32_t nSkillId, int32_t nLevel, int32_t bUnused);
typedef int32_t(__stdcall *D2Common_GetSkillToHitBonus_t)(void *pOwner, int32_t nSkillId, int32_t nLevel);

static uintptr_t g_game_rebase = 0;
static uintptr_t g_com_rebase = 0;
static HMODULE g_hGame = NULL;
static HMODULE g_hCom = NULL;
static uint32_t g_cur_idx = 0;

static void write_u32(uint8_t *buf, size_t off, uint32_t v) {
  *(uint32_t *)(buf + off) = v;
}

static uint32_t read_u32(const uint8_t *buf, size_t off) {
  return *(const uint32_t *)(buf + off);
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
          "[skillcalc-emitter] CRASH idx=%u code=0x%08lx eip=%p (gameVA=0x%08lx comVA=0x%08lx) "
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

static int open_mpq_if_exists(SFileOpenArchive_t fnOpen, const char *name, DWORD prio, int req) {
  if (GetFileAttributesA(name) == INVALID_FILE_ATTRIBUTES) {
    if (req) {
      fprintf(stderr, "[skillcalc-emitter] missing MPQ: %s\n", name);
      return 0;
    }
    return 1;
  }
  HANDLE hMpq = NULL;
  if (!fnOpen(name, prio, 0, &hMpq) || !hMpq) {
    if (!fnOpen(name, prio, 2, &hMpq) || !hMpq) {
      if (req) {
        fprintf(stderr, "[skillcalc-emitter] failed to open MPQ: %s\n", name);
        return 0;
      }
    }
  }
  return 1;
}

static const uint16_t kAllCalcSlotOffs[] = {
  0x138u, 0x13Cu, 0x140u, 0x144u, /* calc1..calc4 */
  0x1D8u, 0x210u, 0x224u, 0x1A0u, /* DmgSymPerCalc, EDmgSymPerCalc, ELenSymPerCalc, ToHitCalc */
  0x060u, 0x064u,                 /* auralencalc, aurarangecalc */
  0x068u, 0x06Cu, 0x070u, 0x074u, 0x078u, 0x07Cu, /* aurastatcalc1..6 */
  0x0A4u, 0x0A8u, 0x0ACu, 0x0B0u, 0x0B4u,         /* passivecalc1..5 */
  0x0C0u, 0x0D4u, 0x128u                          /* petmax, sumsk1calc, perdelay */
};
#define NUM_CALC_SLOT_OFFS (sizeof(kAllCalcSlotOffs) / sizeof(kAllCalcSlotOffs[0]))

/*
 * Scans compiled RPN bytecode at pSkillsCode + calcOff to collect cross-referenced
 * skill IDs (`skill(id, field)` fn=3 and `sklvl(id, f1, f2)` fn=6) so unit skill
 * lists populate genuine synergy / cross-bonus skills from Skills.bin.
 */
static void collect_synergy_refs(
    const uint8_t *codeBase,
    uint32_t codeSize,
    uint32_t calcOff,
    uint16_t selfSkillId,
    uint32_t totalSkills,
    uint16_t outRefs[3],
    int *pRefCount) {
  if (!codeBase || calcOff >= codeSize || *pRefCount >= 3) return;
  int32_t stack[64];
  uint8_t isConst[64];
  int sp = 0;
  uint32_t cur = calcOff;

  while (cur < codeSize && *pRefCount < 3) {
    uint8_t op = codeBase[cur++];
    if (op == 0u || op > 22u || op == 2u || op == 3u) break;
    if (op == 1u) {
      if (cur >= codeSize) break;
      uint8_t fn = codeBase[cur++];
      if (fn == 6u) {
        int ok = (sp >= 3 && isConst[sp - 3]);
        int32_t sk = (sp >= 3) ? stack[sp - 3] : -1;
        sp = (sp >= 3) ? (sp - 3) : 0;
        if (ok && sk >= 0 && (uint32_t)sk < totalSkills && (uint16_t)sk != selfSkillId) {
          int dup = 0;
          for (int k = 0; k < *pRefCount; k++) {
            if (outRefs[k] == (uint16_t)sk) dup = 1;
          }
          if (!dup && *pRefCount < 3) outRefs[(*pRefCount)++] = (uint16_t)sk;
        }
        if (sp < 64) { stack[sp] = 0; isConst[sp] = 0; sp++; }
      } else if (fn < 6u) {
        int ok = (fn == 3u && sp >= 2 && isConst[sp - 2]);
        int32_t sk = (sp >= 2) ? stack[sp - 2] : -1;
        sp = (sp >= 2) ? (sp - 2) : 0;
        if (ok && sk >= 0 && (uint32_t)sk < totalSkills && (uint16_t)sk != selfSkillId) {
          int dup = 0;
          for (int k = 0; k < *pRefCount; k++) {
            if (outRefs[k] == (uint16_t)sk) dup = 1;
          }
          if (!dup && *pRefCount < 3) outRefs[(*pRefCount)++] = (uint16_t)sk;
        }
        if (sp < 64) { stack[sp] = 0; isConst[sp] = 0; sp++; }
      } else {
        if (sp < 64) { stack[sp] = 0; isConst[sp] = 0; sp++; }
      }
    } else if (op >= 4u && op <= 6u) {
      uint32_t w = 1u << (op - 4u);
      if (cur + w > codeSize) break;
      cur += w;
      if (sp < 64) { stack[sp] = 0; isConst[sp] = 0; sp++; }
    } else if (op >= 7u && op <= 9u) {
      uint32_t w = 1u << (op - 7u);
      if (cur + w > codeSize) break;
      int32_t val = (w == 1u) ? (int8_t)codeBase[cur]
                  : (w == 2u) ? *(const int16_t *)(codeBase + cur)
                              : *(const int32_t *)(codeBase + cur);
      cur += w;
      if (sp < 64) { stack[sp] = val; isConst[sp] = 1u; sp++; }
    } else if (op == 21u) {
      if (sp >= 1 && isConst[sp - 1]) stack[sp - 1] = -stack[sp - 1];
    } else if (op == 22u) {
      sp = (sp >= 3) ? (sp - 3) : 0;
      if (sp < 64) { stack[sp] = 0; isConst[sp] = 0; sp++; }
    } else {
      sp = (sp >= 2) ? (sp - 2) : 0;
      if (sp < 64) { stack[sp] = 0; isConst[sp] = 0; sp++; }
    }
  }
}

static uint32_t derive_unit_seed_lo(const SkillCalcVectorRecord *rec) {
  uint32_t s = 0x9E3779B9u
             ^ ((uint32_t)rec->skillId * 0x85EBCA6Bu)
             ^ ((uint32_t)rec->baseSlvl * 0xC2B2AE35u)
             ^ ((uint32_t)rec->charLvl * 0x27D4EB2Fu)
             ^ ((uint32_t)rec->calcFieldCode << 16)
             ^ (uint32_t)rec->calcSlotOff;
  return (s == 0u) ? 1u : s;
}

static uint32_t derive_unit_seed_hi(const SkillCalcVectorRecord *rec) {
  return 0x0000029Au
       + ((uint32_t)rec->charClass * 7919u)
       + ((uint32_t)rec->packedSkillBonuses * 31337u)
       + ((uint32_t)rec->elemMasteryPct * 131u);
}

static uint8_t __attribute__((aligned(16))) s_unit[0x200];

int main(int argc, char **argv) {
  const char *outPath = argc > 1 ? argv[1] : "skillcalc-113c.d2tv";
  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  SetUnhandledExceptionFilter(crash_filter);

  HMODULE hStorm = LoadLibraryA("Storm.dll");
  HMODULE hFog   = LoadLibraryA("Fog.dll");
  HMODULE hLang  = LoadLibraryA("D2Lang.dll");
  HMODULE hCom   = LoadLibraryA("D2Common.dll");
  HMODULE hNet   = LoadLibraryA("D2Net.dll");
  HMODULE hGame  = LoadLibraryA("D2Game.dll");
  if (!hStorm || !hFog || !hLang || !hCom || !hNet || !hGame) {
    fprintf(stderr, "[skillcalc-emitter] failed to load 1.13c DLLs\n");
    return 2;
  }
  if ((uintptr_t)hCom != D2COM_PREF_BASE) {
    fprintf(stderr, "[skillcalc-emitter] unexpected D2Common base %p\n", (void *)hCom);
    return 3;
  }
  g_hCom = hCom;
  g_hGame = hGame;
  g_com_rebase = (uintptr_t)hCom - D2COM_PREF_BASE;
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
      pFree(*pp, "skillcalc-emitter.c", 1, 0);
      *pp = NULL;
    }
  }

  ((Fog_InitLogPrefix_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10021)))("D2");
  ((Fog_InitFileSystem_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10101)))(0, NULL);
  ((Fog_InitSystem_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10089)))(1, NULL);
  ((Fog_VoidStd_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10082)))();
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
    fprintf(stderr, "[skillcalc-emitter] D2Common.#10943 failed\n");
    return 5;
  }

  /* Bind D2Common exports by ordinal */
  D2Common_GetClassSkillCount_t pGetClassSkillCount =
      (D2Common_GetClassSkillCount_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(11120));
  D2Common_GetClassSkillId_t pGetClassSkillId =
      (D2Common_GetClassSkillId_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10044));
  D2Common_CreateStatListEx_t pCreateStatListEx =
      (D2Common_CreateStatListEx_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(11166));
  D2Common_AllocStatList_t pAllocStatList =
      (D2Common_AllocStatList_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(11013));
  D2Common_SetStatIfValid_t pSetStatIfValid =
      (D2Common_SetStatIfValid_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10188));
  D2Common_SetUnitStat_t pSetUnitStat =
      (D2Common_SetUnitStat_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10887));
  D2Common_MergeStatLists_t pMergeStatLists =
      (D2Common_MergeStatLists_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10807));
  D2Common_ToggleGfxStateFlag_t pToggleGfxStateFlag =
      (D2Common_ToggleGfxStateFlag_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10945));
  D2Common_AllocSkillList_t pAllocSkillList =
      (D2Common_AllocSkillList_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10856));
  D2Common_SetSkillLevelOnUnit_t pSetSkillLevelOnUnit =
      (D2Common_SetSkillLevelOnUnit_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10302));
  D2Common_GetSkillById_t pGetSkillById =
      (D2Common_GetSkillById_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10708));

  D2Common_EvaluateSkillLevel_t pEvaluateSkillLevel =
      (D2Common_EvaluateSkillLevel_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10306));
  D2Common_GetSkillLevelByIdWithBonus_t pGetSkillLevelByIdWithBonus =
      (D2Common_GetSkillLevelByIdWithBonus_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(11008));
  D2Common_GetUnitSkillBonusBySkillId_t pGetUnitSkillBonusBySkillId =
      (D2Common_GetUnitSkillBonusBySkillId_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(11146));
  D2Common_EvaluateSkillManaCost_t pEvaluateSkillManaCost =
      (D2Common_EvaluateSkillManaCost_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10102));
  D2Common_EvaluateManaCost256ths_t pEvaluateManaCost256ths =
      (D2Common_EvaluateManaCost256ths_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10090));
  D2Common_EvaluateSkillFormula_t pEvaluateSkillFormula =
      (D2Common_EvaluateSkillFormula_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10786));
  D2Common_GetSkillCalcFieldById_t pGetSkillCalcFieldById =
      (D2Common_GetSkillCalcFieldById_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10147));
  D2Common_GetSkillPhysMinDamage_t pGetSkillPhysMinDamage =
      (D2Common_GetSkillPhysMinDamage_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10567));
  D2Common_GetSkillPhysMaxDamage_t pGetSkillPhysMaxDamage =
      (D2Common_GetSkillPhysMaxDamage_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10297));
  D2Common_GetSkillElemMinDamage_t pGetSkillElemMinDamage =
      (D2Common_GetSkillElemMinDamage_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10121));
  D2Common_GetSkillElemMaxDamage_t pGetSkillElemMaxDamage =
      (D2Common_GetSkillElemMaxDamage_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(11091));
  D2Common_GetSkillElemLength_t pGetSkillElemLength =
      (D2Common_GetSkillElemLength_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10510));
  D2Common_GetSkillToHitBonus_t pGetSkillToHitBonus =
      (D2Common_GetSkillToHitBonus_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10653));

  /* Read sgptDataTables (0x6FDE9E1C) */
  const uint8_t *pSgpt = *(const uint8_t **)(uintptr_t)(0x6FDE9E1Cu + g_com_rebase);
  const uint8_t *pSkillsCode = *(const uint8_t **)(pSgpt + 0x40);
  uint32_t nSkillsCodeSize = read_u32(pSgpt, 0x44);
  const uint8_t *pSkillsTxtBase = *(const uint8_t **)(pSgpt + 0xB98);
  uint32_t nSkillsTxtCount = read_u32(pSgpt, 0xBA0);

  uint16_t classSkillIds[CLASS_SKILL_TOTAL];
  uint8_t  classSkillOwner[CLASS_SKILL_TOTAL];
  uint32_t discovered = 0;
  for (int32_t cls = 0; cls < 7; cls++) {
    int32_t cnt = pGetClassSkillCount(cls);
    for (int32_t i = 0; i < cnt && discovered < CLASS_SKILL_TOTAL; i++) {
      int32_t skId = pGetClassSkillId(cls, i);
      if (skId >= 0 && (uint32_t)skId < nSkillsTxtCount) {
        classSkillIds[discovered] = (uint16_t)skId;
        classSkillOwner[discovered] = (uint8_t)cls;
        discovered++;
      }
    }
  }
  if (discovered != CLASS_SKILL_TOTAL) {
    fprintf(stderr, "[skillcalc-emitter] expected %u class skills, got %u\n",
            (unsigned)CLASS_SKILL_TOTAL, (unsigned)discovered);
    return 6;
  }

  SkillCalcVectorRecord *records =
      (SkillCalcVectorRecord *)calloc(SKILLCALC_COUNT, sizeof(SkillCalcVectorRecord));
  if (!records) return 7;

  uint32_t idx = 0;
  for (uint32_t skIdx = 0; skIdx < CLASS_SKILL_TOTAL; skIdx++) {
    uint16_t skillId = classSkillIds[skIdx];
    uint8_t nativeClass = classSkillOwner[skIdx];
    const uint8_t *pSkTxt = pSkillsTxtBase + (uint32_t)skillId * 0x23Cu;

    /* Discover cross-referenced synergy skills from RPN bytecode */
    uint16_t synRefs[3] = { 0xFFFFu, 0xFFFFu, 0xFFFFu };
    int synCount = 0;
    uint16_t activeSlots[NUM_CALC_SLOT_OFFS];
    int activeSlotCount = 0;
    for (size_t s = 0; s < NUM_CALC_SLOT_OFFS; s++) {
      uint16_t slotOff = kAllCalcSlotOffs[s];
      uint32_t calcOff = read_u32(pSkTxt, slotOff);
      if (calcOff != 0xFFFFFFFFu && calcOff < nSkillsCodeSize) {
        activeSlots[activeSlotCount++] = slotOff;
        collect_synergy_refs(pSkillsCode, nSkillsCodeSize, calcOff, skillId, nSkillsTxtCount, synRefs, &synCount);
      }
    }

    for (uint32_t rep = 0; rep < SKILLCALC_REPS; rep++, idx++) {
      g_cur_idx = idx;
      SkillCalcVectorRecord *rec = &records[idx];
      rec->skillId = skillId;

      /* rep 6 tests cross-class oskill usage on every 3rd skill */
      if (rep == 6u && (skIdx % 3u) == 0u) {
        rec->charClass = (uint8_t)((nativeClass + 1u + (skIdx % 6u)) % 7u);
      } else {
        rec->charClass = nativeClass;
      }

      /* Cover all 5 progression bands (1, 2..8, 9..16, 17..22, 23..28, 29..30) across rep 0..6 */
      if (rep == 0u) {
        rec->baseSlvl = 1u;
      } else if (rep == 1u) {
        rec->baseSlvl = (uint8_t)(2u + (skIdx % 7u));
      } else if (rep == 2u) {
        rec->baseSlvl = (uint8_t)(9u + (skIdx % 8u));
      } else if (rep == 3u) {
        rec->baseSlvl = (uint8_t)(17u + (skIdx % 6u));
      } else if (rep == 4u) {
        rec->baseSlvl = (uint8_t)(23u + (skIdx % 6u));
      } else if (rep == 5u) {
        rec->baseSlvl = (uint8_t)(29u + (skIdx % 2u));
      } else {
        rec->baseSlvl = (uint8_t)(1u + ((skIdx * 5u + 11u) % 30u));
      }

      for (int k = 0; k < 3; k++) {
        rec->synSkillId[k] = synRefs[k];
        if (synRefs[k] == 0xFFFFu || rep == 0u) {
          rec->synBaseLvl[k] = 0u;
        } else if (rep == 1u) {
          rec->synBaseLvl[k] = (uint8_t)(1u + ((skIdx + (uint32_t)k * 3u) % 5u));
        } else if (rep == 2u) {
          rec->synBaseLvl[k] = (uint8_t)(5u + ((skIdx * 2u + (uint32_t)k * 5u) % 8u));
        } else if (rep == 3u) {
          rec->synBaseLvl[k] = (uint8_t)(10u + ((skIdx + (uint32_t)k * 7u) % 8u));
        } else if (rep == 4u) {
          rec->synBaseLvl[k] = 20u;
        } else {
          rec->synBaseLvl[k] = (uint8_t)(1u + ((idx * 7u + (uint32_t)k * 9u) % 20u));
        }
      }

      if (rep == 0u) {
        rec->allSkillsBonus = 0u;
        rec->packedSkillBonuses = 0u;
        rec->elemMasteryPct = 0u;
      } else {
        rec->allSkillsBonus = (uint8_t)((idx * 3u + rep) % 9u);
        uint8_t clsB = (uint8_t)((skIdx + rep) % 4u);
        uint8_t tabB = (uint8_t)((skIdx * 3u + rep) % 6u);
        uint8_t sngB = (uint8_t)((skIdx * 5u + rep * 2u) % 6u);
        rec->packedSkillBonuses = (uint8_t)((clsB & 0x03u) | ((tabB & 0x07u) << 2) | ((sngB & 0x07u) << 5));
        rec->elemMasteryPct = (uint8_t)(((rep % 2u) == 0u) ? 0u : (15u + ((idx * 13u) % 136u)));
      }

      uint8_t uFlags = 0u;
      if (rep == 6u || ((rep == 3u) && (skIdx % 4u == 0u))) uFlags |= 0x01u; /* oskill */
      if (rep == 2u || rep == 5u) uFlags |= 0x02u;                           /* skill shrine */
      if ((idx % 5u) == 0u && rep != 0u) uFlags |= 0x04u;                    /* +2 fire skills */
      if ((rep % 2u) == 1u || rep == 4u) uFlags |= 0x08u;                    /* bApplyMastery */
      if (rep >= 2u && (rep % 2u) == 0u) uFlags |= 0x10u;                    /* bIncludeSrcDmg */
      uFlags |= (uint8_t)(((idx * 5u + rep) & 0x07u) << 5);                  /* weapMaxDelta */
      rec->unitFlags = uFlags;

      /* Sweep all 73 SkillCalc.txt field codes (0..72) */
      rec->calcFieldCode = (uint8_t)((idx * 11u + rep * 3u) % 73u);

      /* Prefer active RPN calc slots on rep 0..4, and sweep calc1..calc4 / aura / passive on rep 5..6 */
      if (activeSlotCount > 0 && rep < 5u) {
        rec->calcSlotOff = activeSlots[(skIdx + rep) % (uint32_t)activeSlotCount];
      } else {
        rec->calcSlotOff = kAllCalcSlotOffs[(idx + rep * 3u) % NUM_CALC_SLOT_OFFS];
      }

      rec->weapMinDmg = (uint8_t)(5u + ((idx * 7u + skIdx) % 75u));
      rec->charLvl = (uint8_t)(1u + ((skIdx * 3u + rep * 13u) % 99u));

      /* Construct real D2UnitStrc + D2StatListExStrc + D2SkillListStrc */
      memset(s_unit, 0, sizeof(s_unit));
      write_u32(s_unit, 0x00, 0u);                     /* dwUnitType = 0 (UNIT_PLAYER) */
      write_u32(s_unit, 0x04, rec->charClass);         /* dwClassId */
      write_u32(s_unit, 0x0C, idx + 1u);               /* dwUnitId */
      uint32_t seedLo = derive_unit_seed_lo(rec);
      uint32_t seedHi = derive_unit_seed_hi(rec);
      write_u32(s_unit, 0x20, seedLo);                 /* pUnit->pSeed.lo */
      write_u32(s_unit, 0x24, seedHi);                 /* pUnit->pSeed.hi */
      write_u32(s_unit, 0x28, seedLo);                 /* dwInitSeed */

      pCreateStatListEx(s_unit, 0u, NULL, NULL);

      int32_t weapMaxDmg = (int32_t)rec->weapMinDmg + 5 + (int32_t)((rec->unitFlags >> 5) & 0x07u) * 12;
      pSetUnitStat(s_unit, 0,  30 + ((int32_t)rec->charLvl / 2), 0); /* STAT_STRENGTH */
      pSetUnitStat(s_unit, 1,  25 + ((int32_t)rec->charLvl / 3), 0); /* STAT_ENERGY */
      pSetUnitStat(s_unit, 2,  25 + (int32_t)rec->charLvl,       0); /* STAT_DEXTERITY */
      pSetUnitStat(s_unit, 3,  25 + ((int32_t)rec->charLvl / 2), 0); /* STAT_VITALITY */
      pSetUnitStat(s_unit, 12, (int32_t)rec->charLvl,            0); /* STAT_LEVEL */
      pSetUnitStat(s_unit, 21, (int32_t)rec->weapMinDmg,         0); /* STAT_MINDAMAGE */
      pSetUnitStat(s_unit, 22, weapMaxDmg,                       0); /* STAT_MAXDAMAGE */

      /* Bonus statlist for +skills, masteries, and attribute bonuses */
      void *pBonus = pAllocStatList(NULL, 0x40u, 0u, 0, (int32_t)(idx + 1u));
      pSetStatIfValid(pBonus, 0, 10 + ((int32_t)rec->baseSlvl % 15), 0);
      pSetStatIfValid(pBonus, 2, 10 + ((int32_t)rec->charLvl % 20),  0);
      if (rec->allSkillsBonus > 0u) {
        pSetStatIfValid(pBonus, 127, (int32_t)rec->allSkillsBonus, 0);
      }
      int32_t clsBonus = (int32_t)(rec->packedSkillBonuses & 0x03u);
      int32_t tabBonus = (int32_t)((rec->packedSkillBonuses >> 2) & 0x07u);
      int32_t sngBonus = (int32_t)((rec->packedSkillBonuses >> 5) & 0x07u);
      if (clsBonus > 0) {
        pSetStatIfValid(pBonus, 83, clsBonus, (int32_t)rec->charClass);
      }
      if (tabBonus > 0) {
        for (int32_t tab = 0; tab < 3; tab++) {
          pSetStatIfValid(pBonus, 188, tabBonus, (int32_t)rec->charClass * 8 + tab);
        }
      }
      if (sngBonus > 0) {
        int32_t statId = ((rec->unitFlags & 0x01u) != 0u) ? 97 : 107;
        pSetStatIfValid(pBonus, statId, sngBonus, (int32_t)rec->skillId);
      }
      if ((rec->unitFlags & 0x04u) != 0u) {
        pSetStatIfValid(pBonus, 126, 2, 1); /* +2 Fire Skills (EType = 1) */
      }
      if (rec->elemMasteryPct > 0u) {
        pSetStatIfValid(pBonus, 329, (int32_t)rec->elemMasteryPct, 0); /* Fire Mastery % */
        pSetStatIfValid(pBonus, 330, (int32_t)rec->elemMasteryPct, 0); /* Lightning Mastery % */
        pSetStatIfValid(pBonus, 331, (int32_t)rec->elemMasteryPct, 0); /* Cold Mastery % */
        pSetStatIfValid(pBonus, 332, (int32_t)rec->elemMasteryPct, 0); /* Poison Mastery % */
      }
      pMergeStatLists(s_unit, pBonus, 1);

      if ((rec->unitFlags & 0x02u) != 0u) {
        pToggleGfxStateFlag(s_unit, 134, 1); /* STATE_SHRINE_SKILL (+2) */
      }

      /* Allocate unit skill list and populate primary + synergy skills */
      void *pSkillList = pAllocSkillList(NULL);
      *(void **)(s_unit + 0xA8) = pSkillList;
      pSetSkillLevelOnUnit(s_unit, (int32_t)rec->skillId, (int32_t)rec->baseSlvl, 0, NULL, 0);
      for (int k = 0; k < 3; k++) {
        if (rec->synSkillId[k] != 0xFFFFu &&
            rec->synSkillId[k] != rec->skillId &&
            rec->synBaseLvl[k] > 0u) {
          pSetSkillLevelOnUnit(s_unit, (int32_t)rec->synSkillId[k], (int32_t)rec->synBaseLvl[k], 0, NULL, 0);
        }
      }

      /* Execute real 1.13c D2Common skill evaluation functions */
      void *pSkill = pGetSkillById(s_unit, (int32_t)rec->skillId, -1);
      int32_t effSlvl = pEvaluateSkillLevel(s_unit, pSkill, 1);
      int32_t effSlvlById = pGetSkillLevelByIdWithBonus(s_unit, (int32_t)rec->skillId);
      if (effSlvl != effSlvlById) {
        fprintf(stderr, "[skillcalc-emitter] effSlvl mismatch idx=%u: %d vs %d\n",
                idx, (int)effSlvl, (int)effSlvlById);
        return 8;
      }
      int32_t bonusSlvl = pGetUnitSkillBonusBySkillId(s_unit, (int32_t)rec->skillId);
      int32_t manaCost = pEvaluateSkillManaCost((int32_t)rec->skillId, effSlvl);
      int32_t manaCost256 = pEvaluateManaCost256ths((int32_t)rec->skillId, effSlvl);

      uint32_t dwCalcOff = read_u32(pSkTxt, rec->calcSlotOff);
      int32_t formulaVal = pEvaluateSkillFormula(s_unit, dwCalcOff, (int32_t)rec->skillId, effSlvl);
      int32_t calcFieldVal = pGetSkillCalcFieldById(
          s_unit, (int32_t)rec->calcFieldCode, (int32_t)rec->skillId, effSlvl);

      int32_t bIncludeSrcDmg = ((rec->unitFlags & 0x10u) != 0u) ? 1 : 0;
      int32_t physMinDmg = pGetSkillPhysMinDamage(s_unit, (int32_t)rec->skillId, effSlvl, bIncludeSrcDmg);
      int32_t physMaxDmg = pGetSkillPhysMaxDamage(s_unit, (int32_t)rec->skillId, effSlvl, bIncludeSrcDmg);

      int32_t bApplyMastery = ((rec->unitFlags & 0x08u) != 0u) ? 1 : 0;
      int32_t elemMinDmg = pGetSkillElemMinDamage(s_unit, (int32_t)rec->skillId, effSlvl, bApplyMastery);
      int32_t elemMaxDmg = pGetSkillElemMaxDamage(s_unit, (int32_t)rec->skillId, effSlvl, bApplyMastery);

      int32_t elemLength = pGetSkillElemLength(s_unit, (int32_t)rec->skillId, effSlvl, 0);
      int32_t toHitBonus = pGetSkillToHitBonus(s_unit, (int32_t)rec->skillId, effSlvl);

      rec->effSlvl      = (int16_t)effSlvl;
      rec->bonusSlvl    = (int16_t)bonusSlvl;
      rec->manaCost     = (int16_t)manaCost;
      rec->manaCost256  = manaCost256;
      rec->formulaVal   = formulaVal;
      rec->calcFieldVal = calcFieldVal;
      rec->physMinDmg   = physMinDmg;
      rec->physMaxDmg   = physMaxDmg;
      rec->elemMinDmg   = elemMinDmg;
      rec->elemMaxDmg   = elemMaxDmg;
      rec->elemLength   = elemLength;
      rec->toHitBonus   = toHitBonus;
    }
  }

  D2TVHeader hdr;
  d2tv_init_header(&hdr, D2TV_KIND_SKILLCALC, sizeof(SkillCalcVectorRecord), SKILLCALC_COUNT, SKILLCALC_SEED);

  FILE *fp = fopen(outPath, "wb");
  if (!fp) {
    fprintf(stderr, "[skillcalc-emitter] failed to open %s\n", outPath);
    free(records);
    return 9;
  }
  if (fwrite(&hdr, sizeof(hdr), 1, fp) != 1 ||
      fwrite(records, sizeof(SkillCalcVectorRecord), SKILLCALC_COUNT, fp) != SKILLCALC_COUNT) {
    fclose(fp);
    free(records);
    return 10;
  }
  fclose(fp);

  fprintf(stderr, "[skillcalc-emitter] wrote %u %s records (%u bytes each) to %s\n",
          (unsigned)SKILLCALC_COUNT, D2TV_KIND_SKILLCALC,
          (unsigned)sizeof(SkillCalcVectorRecord), outPath);
  free(records);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
