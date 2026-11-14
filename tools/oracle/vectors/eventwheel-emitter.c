/*
 * Event Wheel binary test vector emitter (Plan §3.6.2, Gitea Milestone 31 [K0]).
 *
 * Compiled with i686-w64-mingw32-gcc and executed under Wine against the original
 * Diablo II v1.13c D2Game.dll timer wheel routines:
 *   - 0x6FCAE630 EVENT_InitTimerQueue (ebx = pGame)
 *   - 0x6FCAE4D0 EVENT_FreeTimerQueue (edi = pGame)
 *   - 0x6FCAEA80 EVENT_SetEvent       (ecx = pGame, edx = pUnit, stack: type, frame, fn, arg14, arg18)
 *   - 0x6FCAE810 EVENT_SetPersistent  (edi = pGame, eax = pUnit, ebx = type, stack: fn, arg14, arg18)
 *   - 0x6FCAE880 EVENT_RemoveUnit     (eax = pGame, stack: pUnit)
 *   - 0x6FCAE8C0 EVENT_DeleteByType   (ecx = pGame, eax = pUnit, ebx = type, stack: fn)
 *   - 0x6FCAF070 EVENT_UpdateTimers   (esi = pGame)
 */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include "vector-format.h"

#define EVTWHEEL_RECORD_SIZE 32

#pragma pack(push, 1)
typedef struct {
  uint32_t initial_frame;
  uint32_t event_count;
  uint32_t advance_frames;
  uint32_t fired_count;
  uint32_t cancelled_count;
  uint32_t final_frame;
  uint32_t checksum;
  uint32_t reserved;
} EventWheelRecord;
#pragma pack(pop)

enum {
  ACT_NONE = 0,
  ACT_SELF_DELETE_BY_TYPE = 1,
  ACT_DELETE_UNIT_TYPE = 2,
  ACT_REMOVE_UNIT = 3,
  ACT_SPAWN_TIMED = 4
};

static uintptr_t g_d2game_rebase = 0;
static uintptr_t g_fn_init_queue = 0;
static uintptr_t g_fn_free_queue = 0;
static uintptr_t g_fn_set_event = 0;
static uintptr_t g_fn_set_persistent = 0;
static uintptr_t g_fn_remove_unit = 0;
static uintptr_t g_fn_delete_by_type = 0;
static uintptr_t g_fn_update_timers = 0;

/* Minimal 1.13c structures aligned to verified offsets:
 *   D2GameStrc: +0x1C pMemPool (NULL), +0xA8 dwGameFrame, +0xB8 pTimer
 *   D2UnitStrc: +0x00 dwUnitType, +0x0C dwUnitId, +0x5C pStatListEx (NULL), +0xDC pEventFirst
 */
static uint8_t g_game_buf[0x200];
static uint8_t g_unit_bufs[16][0x100];

static uint32_t g_event_count = 0;
static uint32_t g_fired_count = 0;
static uint32_t g_cancelled_count = 0;
static uint32_t g_checksum = 0x811C9DC5u;

static inline void fnv_mix(uint32_t v) {
  g_checksum ^= v;
  g_checksum *= 0x01000193u;
}

static void dll_init_timer_queue(void *pGame) {
  __asm__ volatile (
    "movl %[g], %%ebx\n\t"
    "call *%[fn]\n\t"
    :
    : [g]"rm"(pGame), [fn]"r"(g_fn_init_queue)
    : "eax", "ebx", "ecx", "edx", "memory", "cc"
  );
}

static void dll_free_timer_queue(void *pGame) {
  __asm__ volatile (
    "movl %[g], %%edi\n\t"
    "call *%[fn]\n\t"
    :
    : [g]"rm"(pGame), [fn]"r"(g_fn_free_queue)
    : "eax", "ecx", "edx", "edi", "memory", "cc"
  );
}

static void dll_set_event(void *pGame, void *pUnit, int nType, uint32_t dwFrame, void *pfn, uint32_t arg14, uint32_t arg18) {
  __asm__ volatile (
    "pushl %[a18]\n\t"
    "pushl %[a14]\n\t"
    "pushl %[pfn]\n\t"
    "pushl %[fr]\n\t"
    "pushl %[tp]\n\t"
    "call *%[fn]\n\t"
    : "+c"(pGame), "+d"(pUnit)
    : [tp]"rm"(nType), [fr]"rm"(dwFrame), [pfn]"rm"(pfn), [a14]"rm"(arg14), [a18]"rm"(arg18), [fn]"r"(g_fn_set_event)
    : "eax", "memory", "cc"
  );
}

static void dll_set_persistent(void *pGame, void *pUnit, int nType, void *pfn, uint32_t arg14, uint32_t arg18) {
  __asm__ volatile (
    "movl %[g], %%edi\n\t"
    "movl %[t], %%ebx\n\t"
    "pushl %[a18]\n\t"
    "pushl %[a14]\n\t"
    "pushl %[pfn]\n\t"
    "movl %[u], %%eax\n\t"
    "call *%[fn]\n\t"
    :
    : [g]"m"(pGame), [u]"m"(pUnit), [t]"m"(nType), [pfn]"m"(pfn), [a14]"m"(arg14), [a18]"m"(arg18), [fn]"m"(g_fn_set_persistent)
    : "eax", "ebx", "ecx", "edx", "edi", "memory", "cc"
  );
}

static void dll_remove_unit_events(void *pGame, void *pUnit) {
  __asm__ volatile (
    "pushl %[u]\n\t"
    "call *%[fn]\n\t"
    : "+a"(pGame)
    : [u]"rm"(pUnit), [fn]"r"(g_fn_remove_unit)
    : "ecx", "edx", "memory", "cc"
  );
}

static void dll_delete_by_type(void *pGame, void *pUnit, int nType, void *pfn) {
  __asm__ volatile (
    "movl %[t], %%ebx\n\t"
    "pushl %[pfn]\n\t"
    "call *%[fn]\n\t"
    : "+c"(pGame), "+a"(pUnit)
    : [t]"m"(nType), [pfn]"m"(pfn), [fn]"m"(g_fn_delete_by_type)
    : "ebx", "edx", "memory", "cc"
  );
}

static void dll_update_timers(void *pGame) {
  __asm__ volatile (
    "movl %[g], %%esi\n\t"
    "call *%[fn]\n\t"
    :
    : [g]"rm"(pGame), [fn]"r"(g_fn_update_timers)
    : "eax", "ecx", "edx", "esi", "memory", "cc"
  );
}

static void __fastcall custom_event_handler(void *pGame, void *pUnit, int nEventType, uint32_t dwArg14, uint32_t dwArg18) {
  uint32_t curFrame = *(uint32_t *)((uint8_t *)pGame + 0xA8);
  uint32_t unitType = pUnit ? *(uint32_t *)((uint8_t *)pUnit + 0x00) : 6u;
  uint32_t unitId   = pUnit ? *(uint32_t *)((uint8_t *)pUnit + 0x0C) : 0xFFFFFFFFu;

  g_fired_count++;
  fnv_mix(curFrame);
  fnv_mix(unitType);
  fnv_mix(unitId);
  fnv_mix((uint32_t)(nEventType & 0xFF));
  fnv_mix(dwArg14);
  fnv_mix(dwArg18);

  uint32_t actKind  = dwArg18 & 0xFFu;
  uint32_t actParam1 = (dwArg18 >> 8) & 0xFFu;
  uint32_t actParam2 = (dwArg18 >> 16) & 0xFFFFu;

  if (actKind == ACT_SELF_DELETE_BY_TYPE) {
    if (pUnit) {
      dll_delete_by_type(pGame, pUnit, nEventType & 0xFF, (void *)custom_event_handler);
      g_cancelled_count++;
    }
  } else if (actKind == ACT_DELETE_UNIT_TYPE) {
    void *targetUnit = g_unit_bufs[actParam1 & 15u];
    int targetType = (int)(actParam2 % 14u);
    dll_delete_by_type(pGame, targetUnit, targetType, (void *)custom_event_handler);
    g_cancelled_count++;
  } else if (actKind == ACT_REMOVE_UNIT) {
    void *targetUnit = g_unit_bufs[actParam1 & 15u];
    dll_remove_unit_events(pGame, targetUnit);
    g_cancelled_count++;
  } else if (actKind == ACT_SPAWN_TIMED) {
    void *targetUnit = g_unit_bufs[actParam1 & 15u];
    uint32_t delay = actParam2 & 0xFFu;
    uint32_t targetFrame = curFrame + delay;
    if (targetFrame == 0xFFFFFFFFu) targetFrame = 0u;
    int nextType = (int)(((uint32_t)nEventType + 1u) % 14u);
    dll_set_event(pGame, targetUnit, nextType, targetFrame, (void *)custom_event_handler, dwArg14 + 0x10000u, 0u);
    g_event_count++;
  }
}

static uint32_t lcg_next(uint32_t *state) {
  *state = (*state) * 1103515245u + 12345u;
  return *state;
}

static inline uint32_t pack_action(uint32_t kind, uint32_t p1, uint32_t p2) {
  return (kind & 0xFFu) | ((p1 & 0xFFu) << 8) | ((p2 & 0xFFFFu) << 16);
}

static void run_scenario(uint32_t scenarioId, uint32_t masterSeed, EventWheelRecord *out) {
  memset(g_game_buf, 0, sizeof(g_game_buf));
  for (uint32_t u = 0; u < 16u; u++) {
    memset(g_unit_bufs[u], 0, sizeof(g_unit_bufs[u]));
    *(uint32_t *)(g_unit_bufs[u] + 0x00) = u % 5u;
    *(uint32_t *)(g_unit_bufs[u] + 0x0C) = 100u + u;
  }

  g_event_count = 0;
  g_fired_count = 0;
  g_cancelled_count = 0;
  g_checksum = 0x811C9DC5u;

  uint32_t gen = masterSeed ^ ((scenarioId + 1u) * 0x9E3779B9u);
  uint32_t family = (scenarioId >> 6) & 3u;
  uint32_t sub = scenarioId & 63u;

  static const uint32_t baseFrames[16] = {
    0u, 1u, 31u, 62u, 63u, 64u, 65u, 127u,
    128u, 511u, 789u, 820u, 1023u, 2048u, 4095u, 8192u
  };
  static const int32_t wrapDelays[16] = {
    -5, -2, 0, 1, 2, 3, 62, 63, 64, 65, 66, 126, 127, 128, 129, 192
  };

  uint32_t initialFrame = 0;
  uint32_t advanceFrames = 64;

  if (family == 0u) {
    initialFrame = baseFrames[sub & 15u] + (sub >> 4) * 7u;
    advanceFrames = 140u + (sub % 70u);
  } else if (family == 1u) {
    initialFrame = 100u + scenarioId * 3u;
    advanceFrames = 72u;
  } else if (family == 2u) {
    initialFrame = 780u + sub;
    advanceFrames = 80u;
  } else {
    initialFrame = 200u + sub * 11u;
    advanceFrames = (sub < 8u) ? 48u : 96u;
  }

  *(uint32_t *)(g_game_buf + 0xA8) = initialFrame;
  dll_init_timer_queue(g_game_buf);

  if (family == 0u) {
    /* Cross-64-slot wraparound & clamp (`frame <= gameFrame` -> `gameFrame + 1`) */
    uint32_t numEvents = 16u + (sub % 16u);
    for (uint32_t e = 0; e < numEvents; e++) {
      uint32_t r = lcg_next(&gen);
      uint32_t uIdx = r % 17u;
      void *pUnit = (uIdx < 16u) ? (void *)g_unit_bufs[uIdx] : NULL;
      int evType = (int)((r >> 8) % 14u);
      int32_t d = wrapDelays[(e + (r >> 16)) & 15u];
      int32_t targetSigned = (int32_t)initialFrame + d;
      if (targetSigned == -1) targetSigned = -2;
      dll_set_event(g_game_buf, pUnit, evType, (uint32_t)targetSigned, (void *)custom_event_handler, e + 1u, 0u);
      g_event_count++;
    }
  } else if (family == 1u) {
    /* Multi-event same-slot FIFO + persistent LIFO across all 5 partitions */
    uint32_t numPersist = 4u + (sub % 7u);
    for (uint32_t p = 0; p < numPersist; p++) {
      uint32_t r = lcg_next(&gen);
      void *pUnit = g_unit_bufs[r & 15u];
      int evType = (int)((r >> 4) % 14u);
      uint32_t act = ((r >> 12) & 1u) ? pack_action(ACT_SELF_DELETE_BY_TYPE, 0u, 0u) : 0u;
      dll_set_persistent(g_game_buf, pUnit, evType, (void *)custom_event_handler, 0x100u + p, act);
      g_event_count++;
    }
    static const uint32_t sameSlotOffsets[4] = { 1u, 2u, 65u, 66u };
    uint32_t numTimed = 18u + (sub % 15u);
    for (uint32_t e = 0; e < numTimed; e++) {
      uint32_t r = lcg_next(&gen);
      uint32_t uIdx = r % 17u;
      void *pUnit = (uIdx < 16u) ? (void *)g_unit_bufs[uIdx] : NULL;
      int evType = (int)((r >> 5) % 14u);
      uint32_t targetFrame = initialFrame + sameSlotOffsets[(r >> 10) & 3u];
      dll_set_event(g_game_buf, pUnit, evType, targetFrame, (void *)custom_event_handler, 0x200u + e, 0u);
      g_event_count++;
    }
    /* Pre-step cancellations */
    if ((sub & 1u) != 0u) {
      dll_delete_by_type(g_game_buf, g_unit_bufs[sub & 15u], (int)(sub % 14u), (void *)custom_event_handler);
      g_cancelled_count++;
    }
    if ((sub & 2u) != 0u) {
      dll_remove_unit_events(g_game_buf, g_unit_bufs[(sub + 5u) & 15u]);
      g_cancelled_count++;
    }
  } else if (family == 2u) {
    /* In-execution deletion: self-delete, sibling delete (`pSavedNext`), cross-partition unit removal, spawn */
    uint32_t numPersist = 5u + (sub % 6u);
    for (uint32_t p = 0; p < numPersist; p++) {
      uint32_t r = lcg_next(&gen);
      uint32_t uIdx = r & 15u;
      int evType = (int)((r >> 4) % 14u);
      uint32_t actChoice = (r >> 8) & 3u;
      uint32_t act = 0u;
      if (actChoice == 0u) act = pack_action(ACT_SELF_DELETE_BY_TYPE, 0u, 0u);
      else if (actChoice == 1u) act = pack_action(ACT_DELETE_UNIT_TYPE, (uIdx + 1u) & 15u, (uint32_t)evType);
      else if (actChoice == 2u) act = pack_action(ACT_REMOVE_UNIT, (uIdx + 3u) & 15u, 0u);
      else act = pack_action(ACT_SPAWN_TIMED, (uIdx + 2u) & 15u, 1u + ((r >> 16) & 65u));
      dll_set_persistent(g_game_buf, g_unit_bufs[uIdx], evType, (void *)custom_event_handler, 0x300u + p, act);
      g_event_count++;
    }
    uint32_t numTimed = 24u + (sub % 16u);
    for (uint32_t e = 0; e < numTimed; e++) {
      uint32_t r = lcg_next(&gen);
      uint32_t uIdx = r & 15u;
      int evType = (int)((r >> 4) % 6u); /* concentrate types 0..5 to trigger sibling hits */
      uint32_t delay = ((r >> 10) & 3u) == 0u ? (64u + ((r >> 12) & 3u)) : (1u + ((r >> 12) & 7u));
      uint32_t actKind = (r >> 16) % 5u;
      uint32_t act = pack_action(actKind, (r >> 20) & 15u, ((r >> 24) & 0x7Fu));
      dll_set_event(g_game_buf, g_unit_bufs[uIdx], evType, initialFrame + delay, (void *)custom_event_handler, 0x400u + e, act);
      g_event_count++;
    }
  } else {
    /* >600-node chunk pool overflow (sub 0..7) + mixed stress (sub 8..63) */
    uint32_t totalInitial = (sub < 8u) ? (650u + sub * 40u) : (32u + (sub % 48u));
    for (uint32_t e = 0; e < totalInitial; e++) {
      uint32_t r = lcg_next(&gen);
      uint32_t uIdx = r % 17u;
      void *pUnit = (uIdx < 16u) ? (void *)g_unit_bufs[uIdx] : NULL;
      int evType = (int)((r >> 5) % 14u);
      if ((r & 15u) == 0u && pUnit != NULL) {
        uint32_t act = pack_action(ACT_SELF_DELETE_BY_TYPE, 0u, 0u);
        dll_set_persistent(g_game_buf, pUnit, evType, (void *)custom_event_handler, 0x500u + e, act);
      } else {
        uint32_t delay = (r >> 10) % 132u;
        uint32_t actKind = ((r >> 20) & 7u) < 4u ? ((r >> 20) & 3u) : ((r >> 20) == 4u ? ACT_SPAWN_TIMED : ACT_NONE);
        if (pUnit == NULL && actKind == ACT_SELF_DELETE_BY_TYPE) actKind = ACT_NONE;
        uint32_t act = pack_action(actKind, (r >> 24) & 15u, (r >> 16) & 0x7Fu);
        uint32_t targetFrame = initialFrame + delay;
        if (targetFrame == 0xFFFFFFFFu) targetFrame = 0u;
        dll_set_event(g_game_buf, pUnit, evType, targetFrame, (void *)custom_event_handler, 0x600u + e, act);
      }
      g_event_count++;
    }
  }

  uint32_t curFrame = initialFrame;
  for (uint32_t step = 0; step < advanceFrames; step++) {
    curFrame = (curFrame + 1u);
    *(uint32_t *)(g_game_buf + 0xA8) = curFrame;
    dll_update_timers(g_game_buf);
  }

  dll_free_timer_queue(g_game_buf);

  out->initial_frame = initialFrame;
  out->event_count = g_event_count;
  out->advance_frames = advanceFrames;
  out->fired_count = g_fired_count;
  out->cancelled_count = g_cancelled_count;
  out->final_frame = curFrame;
  out->checksum = g_checksum;
  out->reserved = 0u;
}

int main(int argc, char **argv) {
  uint32_t count = 256u;
  uint32_t master_seed = 0xD2113CE7u;
  const char *out_path = "eventwheel-113c.d2tv";
  if (argc > 1) out_path = argv[1];
  if (argc > 2) count = (uint32_t)atoi(argv[2]);

  LoadLibraryA("Storm.dll");
  HMODULE hFog = LoadLibraryA("Fog.dll");
  if (hFog) {
    typedef void (__fastcall *FogInitSysFn)(int, void *);
    FogInitSysFn pInitSys = (FogInitSysFn)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10089));
    if (pInitSys) pInitSys(1, NULL);
  }
  HMODULE hD2Common = LoadLibraryA("D2Common.dll");
  HMODULE hD2Game = LoadLibraryA("D2Game.dll");
  if (!hD2Common || !hD2Game) {
    fprintf(stderr, "Failed to load D2Common.dll / D2Game.dll (err=%lu)\n", GetLastError());
    return 2;
  }

  IMAGE_NT_HEADERS32 *ntGame = (IMAGE_NT_HEADERS32 *)((uint8_t *)hD2Game + ((IMAGE_DOS_HEADER *)hD2Game)->e_lfanew);
  g_d2game_rebase     = (uintptr_t)hD2Game - ntGame->OptionalHeader.ImageBase;
  g_fn_init_queue     = g_d2game_rebase + 0x6FCAE630u;
  g_fn_free_queue     = g_d2game_rebase + 0x6FCAE4D0u;
  g_fn_set_event      = g_d2game_rebase + 0x6FCAEA80u;
  g_fn_set_persistent = g_d2game_rebase + 0x6FCAE810u;
  g_fn_remove_unit    = g_d2game_rebase + 0x6FCAE880u;
  g_fn_delete_by_type = g_d2game_rebase + 0x6FCAE8C0u;
  g_fn_update_timers  = g_d2game_rebase + 0x6FCAF070u;

  FILE *fp = fopen(out_path, "wb");
  if (!fp) {
    perror("fopen");
    return 1;
  }

  D2TVHeader hdr;
  d2tv_init_header(&hdr, "EVTWHEEL", sizeof(EventWheelRecord), count, (uint64_t)master_seed);
  fwrite(&hdr, 1, sizeof(hdr), fp);

  uint32_t totalFired = 0;
  for (uint32_t i = 0; i < count; i++) {
    EventWheelRecord rec;
    run_scenario(i, master_seed, &rec);
    totalFired += rec.fired_count;
    fwrite(&rec, 1, sizeof(rec), fp);
  }

  fclose(fp);
  printf("Wrote %u DLL-verified EVTWHEEL scenario vectors (%u total fired events) to %s\n",
         count, totalFired, out_path);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
