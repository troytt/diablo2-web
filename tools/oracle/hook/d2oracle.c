/*
 * d2oracle.dll — in-process instrumentation for original Diablo II 1.13c.
 *
 * Responsibilities (v0):
 *   - drive the front-end menus from a small script (C:\oracle\menu.txt)
 *   - wait for D2Game.dll and redirect its per-game frame update calls
 *     (GAME_UpdateGameFrame, D2Game 0x6FC4E050) through on_frame()
 *   - write a per-frame NDJSON trace to C:\oracle\out\trace.ndjson
 *
 * All addresses are 1.13c preferred-base VAs and are rebased at runtime.
 * Evidence for every address lives in kb/engine/oracle-hooks-113c.md.
 */
#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

#define ORACLE_DIR "C:\\oracle\\"

static FILE *g_log;
static FILE *g_trace;
static HMODULE g_d2game;
static uintptr_t g_d2game_pref = 0x6FC20000;
static HMODULE g_d2common_mod;
static uintptr_t g_d2common_pref = 0x6FD50000;
static void *g_frame_fn; /* rebased GAME_UpdateGameFrame */
static volatile LONG g_frames;

static void logf_(const char *fmt, ...) {
  if (!g_log) return;
  va_list ap;
  va_start(ap, fmt);
  fprintf(g_log, "[%lu] ", GetTickCount());
  vfprintf(g_log, fmt, ap);
  fputc('\n', g_log);
  fflush(g_log);
  va_end(ap);
}

static uintptr_t pref_base(HMODULE m) {
  IMAGE_DOS_HEADER *dos = (IMAGE_DOS_HEADER *)m;
  IMAGE_NT_HEADERS32 *nt = (IMAGE_NT_HEADERS32 *)((uint8_t *)m + dos->e_lfanew);
  return nt->OptionalHeader.ImageBase;
}

static uintptr_t G(uintptr_t va) { /* rebase a D2Game VA */
  return va - g_d2game_pref + (uintptr_t)g_d2game;
}

static uintptr_t C(uintptr_t va) { /* rebase a D2Common VA */
  return va - g_d2common_pref + (uintptr_t)g_d2common_mod;
}

/* ---------------------------------------------------------------- frame */

/* D2Common exports (stdcall): STATLIST_GetUnitStat (accrued) #10973,
 * STATLIST_SetUnitStat #10887. */
typedef int(__stdcall *GetUnitStat_t)(void *unit, int stat, int layer);
typedef int(__stdcall *SetUnitStat_t)(void *unit, int stat, int value, int layer);
static GetUnitStat_t p_GetUnitStat;
static SetUnitStat_t p_SetUnitStat;
/* STATES_CheckState #10871 (stdcall(unit, state), ret 8). */
typedef int(__stdcall *CheckState_t)(void *unit, int state);
static CheckState_t p_CheckState;
static int g_nstates = 0; /* 0 = state sampling off */
/* UNITS_GetRoom #10331 and DUNGEON_GetLevelIdFromRoom #10826 (stdcall). */
typedef void *(__stdcall *GetRoom_t)(void *unit);
typedef int(__stdcall *LevelIdFromRoom_t)(void *room);
static GetRoom_t p_GetRoom;
static LevelIdFromRoom_t p_LevelIdFromRoom;

/* SUNITDMG_ApplyDamage 0x6FCFC0B0: stdcall(pGame, pAttacker, pDefender,
 * pDamage), ret 0x10. Wrapped at its 4 call sites. */
typedef int(__stdcall *ApplyDamage_t)(void *, void *, void *, uint32_t *);
static ApplyDamage_t p_ApplyDamage;
static char g_dmglog[65536];
static int g_dmglog_len;

/* STATLIST_SetUnitStat (#10887) call sites in MONSTER_Event3_HpRegen
 * (0x6FC9684A) and PLAYER_UpdateHpRegen (0x6FC97D12): per-frame stat 6 ticks. */
typedef struct {
  int type;
  uint32_t id;
  int hp0;
  int hp1;
} DotEntry;
static DotEntry g_dotlog[512];
static int g_dotn;

/* Stats sampled per player/monster each frame (overridable via scenario). */
static int g_stat_ids[64] = {0, 1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15};
static int g_nstats = 14;

/* D2UnitStrc 1.13c offsets (see kb/engine/oracle-hooks-113c.md). */
#define U_TYPE 0x00
#define U_CLASS 0x04
#define U_ID 0x0C
#define U_MODE 0x10
#define U_SEED_LO 0x20
#define U_SEED_HI 0x24
#define U_PATH 0x2C
#define U_GAME_NEXT 0xE4
/* D2GameStrc: per-type unit hash, 128 buckets, stride 0x200. */
#define G_FRAME 0xA8
#define G_UNITS 0x1120

#define RD32(p, o) (*(uint32_t *)((uint8_t *)(p) + (o)))

static void unit_xy(uint8_t *u, uint32_t *x, uint32_t *y) {
  uint32_t t = RD32(u, U_TYPE);
  uint8_t *path = (uint8_t *)(uintptr_t)RD32(u, U_PATH);
  *x = *y = 0;
  if (!path) return;
  if (t == 2 || t == 4 || t == 5) { /* static path */
    *x = RD32(path, 0x0C);
    *y = RD32(path, 0x10);
  } else { /* dynamic path: wPosX/wPosY */
    *x = *(uint16_t *)(path + 2);
    *y = *(uint16_t *)(path + 6);
  }
}

static void dump_states(uint8_t *game) {
  int first = 1;
  fputs(",\"st\":[", g_trace);
  for (int type = 0; type <= 1; type++) {
    for (int b = 0; b < 128; b++) {
      uint8_t *u =
          (uint8_t *)(uintptr_t)RD32(game, G_UNITS + type * 0x200 + b * 4);
      for (; u; u = (uint8_t *)(uintptr_t)RD32(u, U_GAME_NEXT)) {
        int any = 0;
        for (int st = 0; st < g_nstates; st++) {
          if (!p_CheckState(u, st)) continue;
          if (!any) {
            fprintf(g_trace, "%s[%d,%u", first ? "" : ",", type, RD32(u, U_ID));
            any = 1;
            first = 0;
          }
          fprintf(g_trace, ",%d", st);
        }
        if (any) fputc(']', g_trace);
      }
    }
  }
  fputc(']', g_trace);
}

typedef struct {
  uint32_t frame, def_type, def_id, addr;
  uint8_t bytes[0x70];
} LastDmg;
static LastDmg g_last_dmg[16];
static int g_nlast_dmg;

static int __stdcall apply_damage_hook(void *game, uint8_t *att, uint8_t *def,
                                       uint32_t *dmg) {
  int hp0 = (def && p_GetUnitStat) ? p_GetUnitStat(def, 6, 0) : 0;
  int r = p_ApplyDamage(game, att, def, dmg);
  int hp1 = (def && p_GetUnitStat) ? p_GetUnitStat(def, 6, 0) : 0;
  if (game && dmg && !IsBadReadPtr(dmg, 0x70) && g_nlast_dmg < 16) {
    LastDmg *ld = &g_last_dmg[g_nlast_dmg++];
    ld->frame = RD32(game, G_FRAME);
    ld->def_type = def ? RD32(def, U_TYPE) : 0xFFFFFFFFu;
    ld->def_id = def ? RD32(def, U_ID) : 0;
    ld->addr = (uint32_t)(uintptr_t)dmg;
    memcpy(ld->bytes, dmg, 0x70);
  }
  if (g_dmglog_len < (int)sizeof g_dmglog - 512) {
    int n = snprintf(g_dmglog + g_dmglog_len, sizeof g_dmglog - g_dmglog_len,
                     "%s{\"att\":[%d,%u],\"def\":[%d,%u],\"hp\":[%d,%d],"
                     "\"ret\":%d,\"raw\":[",
                     g_dmglog_len ? "," : "", att ? (int)RD32(att, U_TYPE) : -1,
                     att ? RD32(att, U_ID) : 0, def ? (int)RD32(def, U_TYPE) : -1,
                     def ? RD32(def, U_ID) : 0, hp0, hp1, r);
    g_dmglog_len += n;
    for (int i = 0; i < 18; i++) /* D2DamageStrc is 0x48 bytes */
      g_dmglog_len += snprintf(g_dmglog + g_dmglog_len, 16, "%s%u",
                               i ? "," : "", dmg ? dmg[i] : 0);
    g_dmglog_len += snprintf(g_dmglog + g_dmglog_len, 4, "]}");
  }
  return r;
}

/* The game keeps 5 unit hash lists (pGame+0x1120 + list*0x200). Observed:
 * list 3 holds items (dwType 4), so lists are NOT indexed by dwType; rows
 * are emitted under t<dwType> and list_histogram() logs the mapping. */
static void list_histogram(uint8_t *game) {
  for (int list = 0; list < 5; list++) {
    int cnt[8] = {0};
    for (int b = 0; b < 128; b++)
      for (uint8_t *u = (uint8_t *)(uintptr_t)RD32(game, G_UNITS + list * 0x200 + b * 4);
           u; u = (uint8_t *)(uintptr_t)RD32(u, U_GAME_NEXT))
        cnt[RD32(u, U_TYPE) & 7]++;
    logf_("list %d: types p%d m%d o%d mi%d it%d ti%d", list, cnt[0], cnt[1],
          cnt[2], cnt[3], cnt[4], cnt[5]);
  }
}

static void dump_units(uint8_t *game, int type) {
  int first = 1;
  fprintf(g_trace, ",\"t%d\":[", type);
  for (int list = 0; list < 5; list++)
  for (int b = 0; b < 128; b++) {
    uint8_t *u =
        (uint8_t *)(uintptr_t)RD32(game, G_UNITS + list * 0x200 + b * 4);
    for (; u; u = (uint8_t *)(uintptr_t)RD32(u, U_GAME_NEXT)) {
      if ((int)RD32(u, U_TYPE) != type) continue;
      uint32_t x, y;
      unit_xy(u, &x, &y);
      int lvl = -1;
      if (type != 3 && type != 4 && p_GetRoom && p_LevelIdFromRoom) {
        void *room = p_GetRoom(u);
        if (room) lvl = p_LevelIdFromRoom(room);
      }
      fprintf(g_trace, "%s[%u,%u,%u,%u,%u,%u,%u,%d", first ? "" : ",",
              RD32(u, U_ID), RD32(u, U_CLASS), RD32(u, U_MODE), x, y,
              RD32(u, U_SEED_LO), RD32(u, U_SEED_HI), lvl);
      if ((type == 0 || type == 1) && p_GetUnitStat) {
        for (int i = 0; i < g_nstats; i++)
          fprintf(g_trace, ",%d", p_GetUnitStat(u, g_stat_ids[i], 0));
      }
      fputc(']', g_trace);
      first = 0;
    }
  }
  fputc(']', g_trace);
}

/* ------------------------------------------------------------- inputs */

/* C2S dispatcher 0x6FCEC550: ebx = packet, esi = player unit,
 * stack: pGame, nSize (callee pops 8). See kb/engine/oracle-hooks-113c.md. */
void *g_c2s_dispatch;

typedef struct {
  uint32_t frame;
  uint32_t len;
  uint8_t data[64];
} Input;
static Input g_inputs[4096];
static int g_ninputs, g_next_input;
static uint32_t g_max_frames; /* 0 = unlimited */
/* Exploration helper ("steer DX DY PERIOD FROM TO"): every PERIOD frames in
 * [FROM, TO] inject RunToLocation(player + (DX, DY)). The injected bytes are
 * logged in the trace "in" key so a deterministic scenario can be extracted
 * from the run (tools/oracle/extract-inputs.py). */
typedef struct {
  int dx, dy;
  uint32_t period, from, to;
} Steer;
static Steer g_steer[64];
static int g_nsteer;
/* "setexp FRAME EXP": set the player's experience (stat 13) through
 * STATLIST_SetUnitStat (#10887) and run the original PLAYER_LevelUp
 * (0x6FD0B090: esi = player, stack pGame, ret 4) - the same sequence as the
 * D2Game path at 0x6FC7C033..0x6FC7C03D. Used only to author save fixtures. */
void *g_levelup_fn, *g_lu_game, *g_lu_player; /* referenced from asm */
static uint32_t g_setexp_frame, g_setexp_value;
/* "setgold FRAME GOLD": set inventory gold (stat 14) for save-authoring
 * flows such as genuine C2S 0x36 mercenary hiring. */
static uint32_t g_setgold_frame, g_setgold_value;
/* "equip FRAME CODE BODYLOC QUALITY ILVL": spawn a genuine 1.13c item via
 * D2GAME_CreateItemEx (0x6FC31490), identify it via ITEMS_SetItemFlag
 * (0x6FC2A65E, IFLAG_IDENTIFIED=0x10), and equip via ITEMS_EquipOnBody
 * (0x6FCF60D0: eax=itemId, ecx=player, stack: game, bodyloc, 0, &swapped).
 * Strictly gated on g_nequip > 0 for save-fixture authoring only. */
typedef int(__stdcall *GetItemIdx_t)(uint32_t code);
typedef uint8_t *(__stdcall *CreateItemEx_t)(void *game, void *drop, int zero);
typedef int(__stdcall *SetItemFlag_t)(void *item, uint32_t flag, int set);
static GetItemIdx_t p_GetItemIdx;
static CreateItemEx_t p_CreateItemEx;
static SetItemFlag_t p_SetItemFlag;
void *g_equip_fn, *g_eq_game, *g_eq_player, *g_eq_swapped;
uint32_t g_eq_itemid, g_eq_bodyloc, g_eq_ret;
typedef struct {
  uint32_t frame, bodyloc, quality, ilvl;
  char code[5];
} Equip;
static Equip g_equip[16];
static int g_nequip;
/* "dumpcoll FRAME RADIUS": write the collision map around the player. */
static uint32_t g_coll_frame, g_coll_radius;
/* "animdump CLASS FROM TO": per frame in [FROM, TO], log every monster of MonStats class CLASS as
 * `frame id mode cof frames recSpeed unitSpeed` to out\anim.txt. unit+0x50 is the AnimData record
 * chosen by UNITS_UpdateAnimRateAndVelocity (D2Common 0x6FD83140 -> 0x6FD91F70: name[8], +0x08 frames,
 * +0x0C speed) and unit+0x4C the resulting anim speed WORD. Diagnostics only; off by default. */
static uint32_t g_anim_class = 0xFFFFFFFFu, g_anim_from, g_anim_to;
static FILE *g_anim;
/* "orderlog FROM TO": per frame in [FROM, TO], log the order of monster event dispatches
 * (EVENT_UpdateTimers monster partition default handler 0x6FC969A0: kind 1 = slot list call
 * 0x6FCAEC25, kind 2 = persistent list call 0x6FCAEC89; entry [kind, eventType, unitType,
 * unitId, mode]) and of PATH_StepDynamicPath (#10226 call 0x6FCC02B1: [3, 0, unitType, unitId,
 * mode]) into the trace key "ord". Route-2 pilot step 0 (kb/engine/d2game-event-wheel-and-room-
 * units-113c.md); off unless the scenario asks for it. */
static uint32_t g_ord_from = 0xFFFFFFFFu, g_ord_to;
static char g_ordlog[16384];
static int g_ordlog_len;
void *g_evt_fn, *g_step_fn; /* referenced from asm */
/* "memdump FRAME TYPE ID": at the end of FRAME, dump raw memory around one unit into the trace key
 * "mem" (route-2 pilot layout checks): the unit (0x100), its unit data (0x100), pAiGeneral and
 * pAiControl (0x40 each, monsters), its event nodes (0x30 each, via unit+0xDC / node+0x24), its room
 * (#10331, 0x80) and pGame (0x100 + timer block pGame+0xB8, 0xA1C). Addresses are raw pointers. */
typedef struct { uint32_t frame, type, id; } MemDump;
static MemDump g_memdump[64];
static int g_nmemdump;
/* "fnrec setevent FROM TO MAX": record EVENT_SetEvent (0x6FCAEA80) calls in frames [FROM, TO] (at most
 * MAX) to out\fnrec.ndjson for the route-2 replay (tools/oracle/route2-replay.ts). Entry detour on
 * the 5-byte prologue (push ebx; mov ebx,[esp+8]); pre/post blocks: pGame (0x100), timer block (0xA20, incl. the node
 * pool pointer +0xA1C), every pool chunk's free/next words (+0x7080, 8 bytes), the free-list head node,
 * the unit (0x100), its statlistex/stateflags, its first event node, and the old head of the target slot / persistent list. */
static uint32_t g_rec_from = 0xFFFFFFFFu, g_rec_to, g_rec_max, g_rec_n;
static uint32_t g_de_from = 0xFFFFFFFFu, g_de_to, g_de_max, g_de_n;
static uint32_t g_ss_from = 0xFFFFFFFFu, g_ss_to, g_ss_max, g_ss_n;
static uint32_t g_ts_from = 0xFFFFFFFFu, g_ts_to, g_ts_max, g_ts_n;
static FILE *g_rec;
void *g_se_tramp, *g_de_tramp, *g_ss_tramp, *g_ts_tramp; /* referenced from asm */
/* "fnrec timers FROM TO": at the EVENT_UpdateTimers call (0x6FC4E0D5) of every frame in [FROM, TO], write
 * the wheel state it will walk (timer block + every node of the persistent lists and of the current
 * slot, 0x30 each) as a record {"fn":"EVENT_UpdateTimers"} to out\\fnrec.ndjson. */
static uint32_t g_tm_from = 0xFFFFFFFFu, g_tm_to;
void *g_timers_fn; /* referenced from asm */
static char g_inlog[8192];
static int g_inlog_len;

/* Arguments are staged in globals so the asm never depends on how the
 * compiler allocated registers or esp-relative locals. */
void *g_cd_game, *g_cd_player, *g_cd_pkt; /* referenced from asm */
uint32_t g_cd_len, g_cd_ret;

static uint32_t c2s_dispatch(void *game, void *player, uint8_t *pkt,
                             uint32_t len) {
  g_cd_game = game;
  g_cd_player = player;
  g_cd_pkt = pkt;
  g_cd_len = len;
  __asm__ volatile(
      "pushal\n\t"
      "mov _g_cd_pkt, %%ebx\n\t"
      "mov _g_cd_player, %%esi\n\t"
      "push _g_cd_len\n\t"
      "push _g_cd_game\n\t"
      "call *_g_c2s_dispatch\n\t"
      "mov %%eax, _g_cd_ret\n\t"
      "popal\n\t" ::: "memory");
  return g_cd_ret;
}

static void load_scenario(void) {
  FILE *f = fopen(ORACLE_DIR "scenario.txt", "r");
  if (!f) return;
  char line[512];
  while (fgets(line, sizeof line, f)) {
    char hex[256];
    unsigned fr;
    if (sscanf(line, "in %u %255s", &fr, hex) == 2 && g_ninputs < 4096) {
      Input *in = &g_inputs[g_ninputs];
      in->frame = fr;
      in->len = 0;
      for (char *h = hex; h[0] && h[1] && in->len < 64; h += 2) {
        unsigned b;
        sscanf(h, "%2x", &b);
        in->data[in->len++] = (uint8_t)b;
      }
      g_ninputs++;
    } else if (!strncmp(line, "steer ", 6) && g_nsteer < 64) {
      Steer *st = &g_steer[g_nsteer];
      if (sscanf(line, "steer %d %d %u %u %u", &st->dx, &st->dy, &st->period,
                 &st->from, &st->to) == 5 &&
          st->period)
        g_nsteer++;
    } else if (sscanf(line, "setexp %u %u", &fr, &g_setexp_value) == 2) {
      g_setexp_frame = fr;
    } else if (sscanf(line, "setgold %u %u", &fr, &g_setgold_value) == 2) {
      g_setgold_frame = fr;
    } else if (!strncmp(line, "equip ", 6) && g_nequip < 16) {
      Equip *eq = &g_equip[g_nequip];
      if (sscanf(line, "equip %u %4s %u %u %u", &eq->frame, eq->code,
                 &eq->bodyloc, &eq->quality, &eq->ilvl) == 5)
        g_nequip++;
    } else if (sscanf(line, "dumpcoll %u %u", &fr, &g_coll_radius) == 2) {
      g_coll_frame = fr;
    } else if (g_nmemdump < 64 &&
               sscanf(line, "memdump %u %u %u", &g_memdump[g_nmemdump].frame,
                      &g_memdump[g_nmemdump].type, &g_memdump[g_nmemdump].id) == 3) {
      g_nmemdump++;
    } else if (sscanf(line, "fnrec setevent %u %u %u", &g_rec_from, &g_rec_to, &g_rec_max) == 3) {
      if (!g_rec) g_rec = fopen(ORACLE_DIR "out\\fnrec.ndjson", "w");
    } else if (sscanf(line, "fnrec delevent %u %u %u", &g_de_from, &g_de_to, &g_de_max) == 3) {
      if (!g_rec) g_rec = fopen(ORACLE_DIR "out\\fnrec.ndjson", "w");
    } else if (sscanf(line, "fnrec setstat %u %u %u", &g_ss_from, &g_ss_to, &g_ss_max) == 3) {
      if (!g_rec) g_rec = fopen(ORACLE_DIR "out\\fnrec.ndjson", "w");
    } else if (sscanf(line, "fnrec togglestate %u %u %u", &g_ts_from, &g_ts_to, &g_ts_max) == 3) {
      if (!g_rec) g_rec = fopen(ORACLE_DIR "out\\fnrec.ndjson", "w");
    } else if (sscanf(line, "fnrec timers %u %u", &g_tm_from, &g_tm_to) == 2) {
      if (!g_rec) g_rec = fopen(ORACLE_DIR "out\\fnrec.ndjson", "w");
    } else if (sscanf(line, "orderlog %u %u", &g_ord_from, &g_ord_to) == 2) {
      logf_("orderlog %u..%u", g_ord_from, g_ord_to);
    } else if (sscanf(line, "animdump %u %u %u", &g_anim_class, &g_anim_from,
                      &g_anim_to) == 3) {
      g_anim = fopen(ORACLE_DIR "out\\anim.txt", "w");
    } else if (sscanf(line, "states %u", &fr) == 1) {
      g_nstates = (int)fr;
    } else if (sscanf(line, "frames %u", &fr) == 1) {
      g_max_frames = fr;
    } else if (!strncmp(line, "stats ", 6)) {
      g_nstats = 0;
      for (char *t = strtok(line + 6, ", \r\n"); t && g_nstats < 64;
           t = strtok(NULL, ", \r\n"))
        g_stat_ids[g_nstats++] = atoi(t);
    }
  }
  fclose(f);
  logf_("scenario: %d inputs, %d stats", g_ninputs, g_nstats);
}

static uint8_t *first_player(uint8_t *game) {
  for (int b = 0; b < 128; b++) {
    uint8_t *u = (uint8_t *)(uintptr_t)RD32(game, G_UNITS + b * 4);
    if (u) return u;
  }
  return NULL;
}

/* Runs before GAME_UpdateGameFrame: inputs tagged frame F are delivered
 * while dwGameFrame == F-1, i.e. "at the start of frame F". */
static void log_input(uint32_t r, const uint8_t *d, uint32_t len) {
  int n = snprintf(g_inlog + g_inlog_len, sizeof g_inlog - g_inlog_len,
                   "%s[%u,\"", g_inlog_len ? "," : "", r);
  g_inlog_len += n;
  for (uint32_t i = 0; i < len && g_inlog_len < (int)sizeof g_inlog - 8; i++)
    g_inlog_len += snprintf(g_inlog + g_inlog_len, 4, "%02x", d[i]);
  g_inlog_len += snprintf(g_inlog + g_inlog_len, 3, "\"]");
}

static void level_up(void *game, void *player) {
  g_lu_game = game;
  g_lu_player = player;
  __asm__ volatile(
      "pushal\n\t"
      "mov _g_lu_player, %%esi\n\t"
      "push _g_lu_game\n\t"
      "call *_g_levelup_fn\n\t"
      "popal\n\t" ::: "memory");
}

static void author_equip_item(uint8_t *game, uint8_t *pl, const Equip *eq) {
  if (!p_GetItemIdx || !p_CreateItemEx || !p_SetItemFlag || !g_equip_fn) return;
  uint32_t code = 0x20202020u;
  for (int i = 0; i < 4 && eq->code[i]; i++)
    code = (code & ~(0xFFu << (i * 8))) | ((uint32_t)(uint8_t)eq->code[i] << (i * 8));
  int idx = p_GetItemIdx(code);
  if (idx < 0) {
    logf_("equip %s: unknown code", eq->code);
    return;
  }
  uint8_t drop[0x84];
  memset(drop, 0, sizeof drop);
  *(uint32_t *)(drop + 0x00) = (uintptr_t)pl;
  *(uint32_t *)(drop + 0x08) = (uintptr_t)game;
  *(uint32_t *)(drop + 0x0C) = eq->ilvl;
  *(uint32_t *)(drop + 0x14) = (uint32_t)idx;
  *(uint32_t *)(drop + 0x18) = 4; /* IMODE_ONCURSOR */
  *(uint16_t *)(drop + 0x28) = 1;
  *(uint16_t *)(drop + 0x2A) = *(uint16_t *)(game + 0x78);
  *(uint32_t *)(drop + 0x30) = eq->quality;
  uint8_t *item = p_CreateItemEx(game, drop, 0);
  if (!item) {
    logf_("equip %s: CreateItemEx failed", eq->code);
    return;
  }
  p_SetItemFlag(item, 0x10u, 1); /* IFLAG_IDENTIFIED */
  uint32_t swapped = 0;
  g_eq_game = game;
  g_eq_player = pl;
  g_eq_itemid = RD32(item, U_ID);
  g_eq_bodyloc = eq->bodyloc;
  g_eq_swapped = &swapped;
  __asm__ volatile(
      "pushal\n\t"
      "push _g_eq_swapped\n\t"
      "push $0\n\t"
      "push _g_eq_bodyloc\n\t"
      "push _g_eq_game\n\t"
      "mov _g_eq_itemid, %%eax\n\t"
      "mov _g_eq_player, %%ecx\n\t"
      "call *_g_equip_fn\n\t"
      "mov %%eax, _g_eq_ret\n\t"
      "popal\n\t" ::: "memory");
  logf_("equip %s idx=%d id=%u loc=%u q=%u -> ret=%u swap=%u", eq->code, idx,
        g_eq_itemid, eq->bodyloc, eq->quality, g_eq_ret, swapped);
}

void __cdecl on_pre_frame(uint8_t *game) {
  uint32_t next = RD32(game, G_FRAME) + 1;
  g_inlog_len = 0;
  if (g_setexp_frame && next == g_setexp_frame && p_SetUnitStat) {
    uint8_t *pl = first_player(game);
    if (pl) {
      p_SetUnitStat(pl, 13, (int)g_setexp_value, 0);
      level_up(game, pl);
      logf_("setexp %u -> level %d", g_setexp_value,
            p_GetUnitStat ? p_GetUnitStat(pl, 12, 0) : -1);
    }
  }
  if (g_setgold_frame && next == g_setgold_frame && p_SetUnitStat) {
    uint8_t *pl = first_player(game);
    if (pl) {
      p_SetUnitStat(pl, 14, (int)g_setgold_value, 0);
      logf_("setgold %u -> gold %d", g_setgold_value,
            p_GetUnitStat ? p_GetUnitStat(pl, 14, 0) : -1);
    }
  }
  if (g_nequip > 0) {
    for (int i = 0; i < g_nequip; i++) {
      if (g_equip[i].frame == next) {
        uint8_t *pl = first_player(game);
        if (pl) author_equip_item(game, pl, &g_equip[i]);
      }
    }
  }
  for (int i = 0; i < g_nsteer; i++) {
    Steer *st = &g_steer[i];
    if (next < st->from || next > st->to || (next - st->from) % st->period)
      continue;
    uint8_t *pl = first_player(game);
    if (!pl) continue;
    uint32_t x, y;
    unit_xy(pl, &x, &y);
    uint8_t pkt[5] = {0x03};
    uint16_t tx = (uint16_t)(x + st->dx), ty = (uint16_t)(y + st->dy);
    memcpy(pkt + 1, &tx, 2);
    memcpy(pkt + 3, &ty, 2);
    log_input(c2s_dispatch(game, pl, pkt, 5), pkt, 5);
  }
  while (g_next_input < g_ninputs && g_inputs[g_next_input].frame <= next) {
    Input *in = &g_inputs[g_next_input++];
    uint8_t *pl = first_player(game);
    uint32_t r = pl ? c2s_dispatch(game, pl, in->data, in->len) : 0xFFFFFFFF;
    log_input(r, in->data, in->len);
  }
}

/* ----------------------------------------------------------- collision */
/* D2ActiveRoomStrc: +0x00 ppRoomsNear, +0x20 pCollisionGrid, +0x24 nRoomsNear,
 * +0x4C/+0x50 subtile origin, +0x54/+0x58 subtile size. Grid: +0x00 x,
 * +0x04 y, +0x08 width, +0x20 u16 masks. Mirrors D2Common 0x6FD51330 /
 * 0x6FD9C570 (kb/engine/oracle-hooks-113c.md). */
static int room_has(uint8_t *r, int x, int y) {
  int rx = (int)RD32(r, 0x4C), ry = (int)RD32(r, 0x50);
  return x >= rx && x < rx + (int)RD32(r, 0x54) && y >= ry &&
         y < ry + (int)RD32(r, 0x58);
}

static uint8_t *room_at(uint8_t *hint, int x, int y) {
  if (!hint) return NULL;
  if (room_has(hint, x, y)) return hint;
  uint8_t **nearby = (uint8_t **)(uintptr_t)RD32(hint, 0x00);
  uint32_t n = RD32(hint, 0x24);
  for (uint32_t i = 0; i < n; i++)
    if (nearby[i] && room_has(nearby[i], x, y)) return nearby[i];
  return NULL;
}

static void dump_collision(uint8_t *game, uint32_t frame) {
  uint8_t *pl = first_player(game);
  if (!pl || !p_GetRoom) return;
  uint32_t px, py;
  unit_xy(pl, &px, &py);
  int R = (int)g_coll_radius, W = 2 * R + 1;
  int x0 = (int)px - R, y0 = (int)py - R;
  uint8_t **hint = calloc((size_t)W * W, sizeof *hint);
  uint16_t *mask = malloc((size_t)W * W * 2);
  int16_t *lvl = malloc((size_t)W * W * 2);
  int *queue = malloc((size_t)W * W * sizeof(int));
  if (!hint || !mask || !lvl || !queue) return;
  for (int i = 0; i < W * W; i++) {
    mask[i] = 0xFFFF;
    lvl[i] = -1;
  }
  int qh = 0, qt = 0, start = R * W + R;
  hint[start] = p_GetRoom(pl);
  queue[qt++] = start;
  while (qh < qt) {
    int c = queue[qh++];
    int cx = c % W, cy = c / W;
    uint8_t *room = room_at(hint[c], x0 + cx, y0 + cy);
    if (room) {
      uint8_t *grid = (uint8_t *)(uintptr_t)RD32(room, 0x20);
      if (grid && RD32(grid, 0x20)) {
        int idx = ((y0 + cy) - (int)RD32(grid, 4)) * (int)RD32(grid, 8) -
                  (int)RD32(grid, 0) + (x0 + cx);
        mask[c] = ((uint16_t *)(uintptr_t)RD32(grid, 0x20))[idx];
      }
      lvl[c] = (int16_t)(p_LevelIdFromRoom ? p_LevelIdFromRoom(room) : -1);
    }
    static const int d[4][2] = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
    for (int k = 0; k < 4; k++) {
      int nx = cx + d[k][0], ny = cy + d[k][1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= W) continue;
      int nc = ny * W + nx;
      if (hint[nc] || !room) continue;
      hint[nc] = room;
      queue[qt++] = nc;
    }
  }
  char path[MAX_PATH];
  snprintf(path, sizeof path, ORACLE_DIR "out\\coll_%u.bin", frame);
  FILE *f = fopen(path, "wb");
  if (f) {
    int32_t hdr[4] = {x0, y0, W, W};
    fwrite(hdr, 4, 4, f);
    fwrite(mask, 2, (size_t)W * W, f);
    fwrite(lvl, 2, (size_t)W * W, f);
    fclose(f);
  }
  logf_("collision dump %s (%d cells reached)", path, qt);
  free(hint);
  free(mask);
  free(lvl);
  free(queue);
}

static int __stdcall dot_setstat_hook(uint8_t *u, int stat, int val,
                                      int layer) {
  int hp0 = (u && stat == 6 && p_GetUnitStat) ? p_GetUnitStat(u, 6, 0) : val;
  int ret = p_SetUnitStat(u, stat, val, layer);
  if (u && stat == 6 && val != hp0 && g_dotn < 512) {
    g_dotlog[g_dotn].type = (int)RD32(u, U_TYPE);
    g_dotlog[g_dotn].id = RD32(u, U_ID);
    g_dotlog[g_dotn].hp0 = hp0;
    g_dotlog[g_dotn].hp1 = val;
    g_dotn++;
  }
  return ret;
}

static void mem_block(const char *name, const void *p, uint32_t len, int *first) {
  if (!p || IsBadReadPtr(p, len)) {
    fprintf(g_trace, "%s{\"n\":\"%s\",\"a\":%u,\"h\":null}", *first ? "" : ",", name,
            (uint32_t)(uintptr_t)p);
    *first = 0;
    return;
  }
  fprintf(g_trace, "%s{\"n\":\"%s\",\"a\":%u,\"h\":\"", *first ? "" : ",", name,
          (uint32_t)(uintptr_t)p);
  for (uint32_t i = 0; i < len; i++) fprintf(g_trace, "%02x", ((const uint8_t *)p)[i]);
  fputs("\"}", g_trace);
  *first = 0;
}

static void mem_block_at(const char *name, uint32_t addr, const uint8_t *bytes, uint32_t len, int *first) {
  fprintf(g_trace, "%s{\"n\":\"%s\",\"a\":%u,\"h\":\"", *first ? "" : ",", name, addr);
  for (uint32_t i = 0; i < len; i++) fprintf(g_trace, "%02x", bytes[i]);
  fputs("\"}", g_trace);
  *first = 0;
}

static void dump_memory(uint8_t *game, uint32_t fr) {
  int any = 0;
  for (int i = 0; i < g_nmemdump; i++) {
    if (g_memdump[i].frame != fr || g_memdump[i].type > 4) continue;
    uint8_t *u = NULL;
    for (int list = 0; list < 5 && !u; list++) {
      uint8_t *cand = (uint8_t *)(uintptr_t)RD32(game, G_UNITS + list * 0x200 +
                                                           (g_memdump[i].id & 0x7F) * 4);
      for (; cand; cand = (uint8_t *)(uintptr_t)RD32(cand, U_GAME_NEXT)) {
        if (RD32(cand, U_TYPE) == g_memdump[i].type && RD32(cand, U_ID) == g_memdump[i].id) {
          u = cand;
          break;
        }
      }
    }
    fputs(any ? "," : ",\"mem\":[", g_trace);
    any = 1;
    fprintf(g_trace, "{\"type\":%u,\"id\":%u,\"blocks\":[", g_memdump[i].type, g_memdump[i].id);
    int first = 1;
    mem_block("game", game, 0x100, &first);
    mem_block("timer", (void *)(uintptr_t)RD32(game, 0xB8), 0xA20, &first);
    if (u) {
      mem_block("unit", u, 0x100, &first);
      uint8_t *data = (uint8_t *)(uintptr_t)RD32(u, 0x14);
      mem_block("data", data, 0x100, &first);
      uint32_t ut = RD32(u, U_TYPE);
      uint8_t *path = (uint8_t *)(uintptr_t)RD32(u, 0x2C);
      if (path) {
        mem_block("path", path, (ut == 0 || ut == 1 || ut == 3) ? 0x200 : 0x20, &first);
      }
      uint8_t *slex = (uint8_t *)(uintptr_t)RD32(u, 0x5C);
      if (slex && !IsBadReadPtr(slex, 0x3C)) {
        if ((RD32(slex, 0x10) & 0x80000000u) && !IsBadReadPtr(slex, 0x64)) {
          mem_block("statlistex", slex, 0x64, &first);
          uint16_t myCnt = *(uint16_t *)(slex + 0x28);
          if (myCnt > 0 && myCnt <= 256)
            mem_block("mystats", (void *)(uintptr_t)RD32(slex, 0x24), (uint32_t)myCnt * 8u, &first);
          uint16_t fullCnt = *(uint16_t *)(slex + 0x4C);
          if (fullCnt > 0 && fullCnt <= 256)
            mem_block("fullstats", (void *)(uintptr_t)RD32(slex, 0x48), (uint32_t)fullCnt * 8u, &first);
          mem_block("stateflags", (void *)(uintptr_t)RD32(slex, 0x58), 0x30, &first);
          uint8_t *cl = (uint8_t *)(uintptr_t)RD32(slex, 0x3C);
          for (int ck = 0; cl && ck < 8 && !IsBadReadPtr(cl, 0x3C); ck++) {
            uint32_t clSz = ((RD32(cl, 0x10) & 0x80000000u) && !IsBadReadPtr(cl, 0x64)) ? 0x64u : 0x3Cu;
            mem_block("childstatlist", cl, clSz, &first);
            uint16_t clCnt = *(uint16_t *)(cl + 0x28);
            if (clCnt > 0 && clCnt <= 256)
              mem_block("childstats", (void *)(uintptr_t)RD32(cl, 0x24), (uint32_t)clCnt * 8u, &first);
            if (clSz == 0x64u) {
              uint16_t cfCnt = *(uint16_t *)(cl + 0x4C);
              if (cfCnt > 0 && cfCnt <= 256)
                mem_block("childfullstats", (void *)(uintptr_t)RD32(cl, 0x48), (uint32_t)cfCnt * 8u, &first);
            }
            cl = (uint8_t *)(uintptr_t)RD32(cl, 0x2C);
          }
        } else {
          mem_block("statlist", slex, 0x3C, &first);
          uint16_t stCnt = *(uint16_t *)(slex + 0x28);
          if (stCnt > 0 && stCnt <= 256)
            mem_block("mystats", (void *)(uintptr_t)RD32(slex, 0x24), (uint32_t)stCnt * 8u, &first);
        }
      }
      if (ut == 0) {
        if (data && !IsBadReadPtr(data, 0xA0)) {
          uint8_t *cl = (uint8_t *)(uintptr_t)RD32(data, 0x9C);
          if (cl && !IsBadReadPtr(cl, 0x200))
            mem_block("client", cl, 0x200, &first);
        }
        uint8_t *inv = (uint8_t *)(uintptr_t)RD32(u, 0x60);
        if (inv && !IsBadReadPtr(inv, 0x40)) {
          mem_block("inventory", inv, 0x40, &first);
          int32_t nGrids = (int32_t)RD32(inv, 0x18);
          uint8_t *grids = (uint8_t *)(uintptr_t)RD32(inv, 0x14);
          if (grids && nGrids > 0 && nGrids <= 8 && !IsBadReadPtr(grids, (uint32_t)nGrids * 0x10u)) {
            mem_block("invgrids", grids, (uint32_t)nGrids * 0x10u, &first);
            uint8_t **ppItems = (uint8_t **)(uintptr_t)RD32(grids, 0x0C);
            if (ppItems && !IsBadReadPtr(ppItems, 13 * 4u)) {
              mem_block("bodyitems", ppItems, 13 * 4u, &first);
              for (int loc = 0; loc < 13; loc++) {
                uint8_t *it = ppItems[loc];
                if (it && !IsBadReadPtr(it, 0x100)) {
                  mem_block("itemunit", it, 0x100, &first);
                  uint8_t *itdata = (uint8_t *)(uintptr_t)RD32(it, 0x14);
                  if (itdata && !IsBadReadPtr(itdata, 0x74))
                    mem_block("itemdata", itdata, 0x74, &first);
                }
              }
            }
          }
        }
        uint8_t *pskills = (uint8_t *)(uintptr_t)RD32(u, 0xA8);
        if (pskills && !IsBadReadPtr(pskills, 0x20)) {
          mem_block("pskills", pskills, 0x20, &first);
          uint8_t *leftSkill = (uint8_t *)(uintptr_t)RD32(pskills, 0x04);
          if (leftSkill && !IsBadReadPtr(leftSkill, 0x40)) {
            mem_block("leftskill", leftSkill, 0x40, &first);
            uint8_t *stxt = (uint8_t *)(uintptr_t)RD32(leftSkill, 0x00);
            if (stxt && !IsBadReadPtr(stxt, 0x23C))
              mem_block("skillstxt", stxt, 0x23C, &first);
          }
          uint8_t *usedSkill = (uint8_t *)(uintptr_t)RD32(pskills, 0x10);
          if (usedSkill && usedSkill != leftSkill && !IsBadReadPtr(usedSkill, 0x40))
            mem_block("usedskill", usedSkill, 0x40, &first);
        }
      }
      if (ut == 1 && data && !IsBadReadPtr(data, 0x30)) {
        uint8_t *aig = (uint8_t *)(uintptr_t)RD32(data, 0x28);
        mem_block("aigeneral", aig, 0x40, &first);
        mem_block("aicontrol", (void *)(uintptr_t)RD32(data, 0x2C), 0x40, &first);
        if (aig && !IsBadReadPtr(aig, 0x40)) {
          uint8_t *cmdHead = (uint8_t *)(uintptr_t)RD32(aig, 0x20);
          uint8_t *cmd = cmdHead;
          for (int ck = 0; cmd && ck < 8 && !IsBadReadPtr(cmd, 0x1C); ck++) {
            mem_block("aicmd", cmd, 0x1C, &first);
            cmd = (uint8_t *)(uintptr_t)RD32(cmd, 0x00);
            if (cmd == cmdHead) break;
          }
          uint8_t *mn = (uint8_t *)(uintptr_t)RD32(aig, 0x34);
          for (int mk = 0; mn && mk < 16 && !IsBadReadPtr(mn, 0x08); mk++) {
            mem_block("aiminion", mn, 0x08, &first);
            mn = (uint8_t *)(uintptr_t)RD32(mn, 0x04);
          }
        }
      }
      uint8_t *ev = (uint8_t *)(uintptr_t)RD32(u, 0xDC);
      for (int k = 0; ev && k < 16 && !IsBadReadPtr(ev, 0x30); k++) {
        mem_block("event", ev, 0x30, &first);
        ev = (uint8_t *)(uintptr_t)RD32(ev, 0x24);
      }
      if (p_GetRoom) {
        uint8_t *rm = (uint8_t *)p_GetRoom(u);
        if (rm && !IsBadReadPtr(rm, 0x80)) {
          uint8_t *q[64];
          int q_depth[64];
          int nq = 0;
          q[nq] = rm;
          q_depth[nq] = 0;
          nq++;
          for (int qi = 0; qi < nq; qi++) {
            uint8_t *cur = q[qi];
            int depth = q_depth[qi];
            mem_block(qi == 0 ? "room" : (depth == 1 ? "adjroom" : "nearroom"), cur, 0x80, &first);
            uint8_t *rex = (uint8_t *)(uintptr_t)RD32(cur, 0x10);
            if (rex && !IsBadReadPtr(rex, 0xEC)) {
              mem_block(qi == 0 ? "roomex" : "nearroomex", rex, 0xEC, &first);
              uint8_t *lvl = (uint8_t *)(uintptr_t)RD32(rex, 0x58);
              if (lvl && !IsBadReadPtr(lvl, 0x230))
                mem_block(qi == 0 ? "level" : "nearlevel", lvl, 0x230, &first);
            }
            uint8_t **adj_rooms = (uint8_t **)(uintptr_t)RD32(cur, 0x00);
            uint32_t nnear = RD32(cur, 0x24);
            if (adj_rooms && nnear > 0 && nnear <= 32 && !IsBadReadPtr(adj_rooms, nnear * 4u)) {
              mem_block("roomsnear", adj_rooms, nnear * 4u, &first);
              if (depth < 3) {
                for (uint32_t nk = 0; nk < nnear; nk++) {
                  uint8_t *nr = adj_rooms[nk];
                  if (nr && !IsBadReadPtr(nr, 0x80)) {
                    int seen = 0;
                    for (int sj = 0; sj < nq; sj++) {
                      if (q[sj] == nr) { seen = 1; break; }
                    }
                    if (!seen && nq < 64) {
                      q[nq] = nr;
                      q_depth[nq] = depth + 1;
                      nq++;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    for (int dk = 0; dk < g_nlast_dmg; dk++) {
      if (g_last_dmg[dk].frame == fr && g_last_dmg[dk].def_type == g_memdump[i].type &&
          g_last_dmg[dk].def_id == g_memdump[i].id) {
        mem_block_at("damage", g_last_dmg[dk].addr, g_last_dmg[dk].bytes, 0x70, &first);
      }
    }
    fputs("]}", g_trace);
  }
  if (any) fputc(']', g_trace);
}

void __cdecl on_frame(uint8_t *game) {
  LONG n = InterlockedIncrement(&g_frames);
  if (g_coll_frame && RD32(game, G_FRAME) == g_coll_frame)
    dump_collision(game, g_coll_frame);
  if (g_anim) {
    uint32_t fr = RD32(game, G_FRAME);
    if (fr >= g_anim_from && fr <= g_anim_to) {
      for (int list = 0; list < 5; list++)
        for (int b = 0; b < 128; b++) {
          uint8_t *u = (uint8_t *)(uintptr_t)RD32(game, G_UNITS + list * 0x200 + b * 4);
          for (; u; u = (uint8_t *)(uintptr_t)RD32(u, U_GAME_NEXT)) {
            if (RD32(u, U_TYPE) != 1 || RD32(u, U_CLASS) != g_anim_class) continue;
            uint8_t *rec = (uint8_t *)(uintptr_t)RD32(u, 0x50);
            char cof[9] = {0};
            uint32_t frames = 0, speed = 0;
            if (rec) {
              memcpy(cof, rec, 8);
              frames = RD32(rec, 0x08);
              speed = RD32(rec, 0x0C);
            }
            fprintf(g_anim, "%u %u %u %s %u %u %d\n", fr, RD32(u, U_ID), RD32(u, U_MODE),
                    rec ? cof : "-", frames, speed, (int)*(int16_t *)(u + 0x4C));
          }
        }
      fflush(g_anim);
    }
  }
  if (!g_trace) {
    g_dotn = 0;
    g_nlast_dmg = 0;
    return;
  }
  if (n == 1) {
    fprintf(g_trace,
            "{\"schema\":\"d2oracle/1\",\"source\":\"oracle\","
            "\"initSeed\":%u,\"seedOverride\":%u,\"dot\":true,"
            "\"unitFields\":[\"id\",\"class\",\"mode\",\"x\",\"y\","
            "\"seedLo\",\"seedHi\",\"level\"],\"statIds\":[",
            RD32(game, 0x7C), RD32(game, 0x84));
    for (int i = 0; i < g_nstats; i++)
      fprintf(g_trace, "%s%d", i ? "," : "", g_stat_ids[i]);
    fputs("]}\n", g_trace);
  }
  fprintf(g_trace, "{\"frame\":%u", RD32(game, G_FRAME));
  dump_units(game, 0);
  dump_units(game, 1);
  dump_units(game, 3); /* scans all lists: missiles' list is unconfirmed */
  if (RD32(game, G_FRAME) % 250 == 0) list_histogram(game);
  fprintf(g_trace, ",\"gs\":[%u,%u]", RD32(game, 0xD0), RD32(game, 0xD4));
  if (g_nstates && p_CheckState) dump_states(game);
  if (g_dmglog_len) {
    fprintf(g_trace, ",\"dmg\":[%s]", g_dmglog);
    g_dmglog_len = 0;
  }
  if (g_dotn > 0) {
    fputs(",\"dot\":[", g_trace);
    for (int i = 0; i < g_dotn; i++) {
      fprintf(g_trace, "%s[%d,%u,%d,%d]", i ? "," : "", g_dotlog[i].type,
              g_dotlog[i].id, g_dotlog[i].hp0, g_dotlog[i].hp1);
    }
    fputc(']', g_trace);
    g_dotn = 0;
  }
  if (g_nmemdump) dump_memory(game, RD32(game, G_FRAME));
  g_nlast_dmg = 0;
  if (g_ordlog_len) {
    fprintf(g_trace, ",\"ord\":[%s]", g_ordlog);
    g_ordlog_len = 0;
  }
  if (g_inlog_len) fprintf(g_trace, ",\"in\":[%s]", g_inlog);
  fputs("}\n", g_trace);
  if (g_max_frames && RD32(game, G_FRAME) >= g_max_frames) {
    fclose(g_trace);
    g_trace = NULL;
    FILE *d = fopen(ORACLE_DIR "out\\done", "w");
    if (d) fclose(d);
    if (g_rec) {
      fclose(g_rec);
      g_rec = NULL;
    }
    logf_("reached %u frames", g_max_frames);
  }
  if ((n & 31) == 0) fflush(g_trace);
}

/* Original: eax = pGame, no stack args, caller-saved regs clobbered. */
__attribute__((naked)) static void frame_stub(void) {
  __asm__ volatile(
      "pushal\n\t"
      "push %%eax\n\t"
      "call _on_pre_frame\n\t"
      "add $4, %%esp\n\t"
      "popal\n\t"
      "push %%eax\n\t"
      "call *%0\n\t"
      "pop %%eax\n\t"
      "pushal\n\t"
      "push %%eax\n\t"
      "call _on_frame\n\t"
      "add $4, %%esp\n\t"
      "popal\n\t"
      "ret\n\t" ::"m"(g_frame_fn));
}

static void ord_append(int kind, int evtype, uint8_t *u) {
  if (!u) return;
  uint8_t *game = (uint8_t *)(uintptr_t)RD32(u, 0x80);
  if (!game) return;
  uint32_t fr = RD32(game, G_FRAME);
  if (fr < g_ord_from || fr > g_ord_to) return;
  if (g_ordlog_len > (int)sizeof g_ordlog - 64) return;
  g_ordlog_len += snprintf(g_ordlog + g_ordlog_len, sizeof g_ordlog - g_ordlog_len,
                           "%s[%d,%d,%u,%u,%u]", g_ordlog_len ? "," : "", kind, evtype,
                           RD32(u, U_TYPE), RD32(u, U_ID), RD32(u, U_MODE));
}
void __cdecl ord_evt(int kind, int evtype, uint8_t *u) { ord_append(kind, evtype, u); }
void __cdecl ord_step(uint8_t *u) { ord_append(3, 0, u); }

/* 0x6FC969A0: esi = event type, edi = pUnit, stack (pGame, a, b), ret 0xC. */
__attribute__((naked)) static void evt_stub_slot(void) {
  __asm__ volatile(
      "pushal\n\t"
      "push %%edi\n\t"
      "push %%esi\n\t"
      "push $1\n\t"
      "call _ord_evt\n\t"
      "add $12, %%esp\n\t"
      "popal\n\t"
      "jmp *%0\n\t" ::"m"(g_evt_fn));
}
__attribute__((naked)) static void evt_stub_persist(void) {
  __asm__ volatile(
      "pushal\n\t"
      "push %%edi\n\t"
      "push %%esi\n\t"
      "push $2\n\t"
      "call _ord_evt\n\t"
      "add $12, %%esp\n\t"
      "popal\n\t"
      "jmp *%0\n\t" ::"m"(g_evt_fn));
}
/* #10226 thunk: stdcall(pUnit, ...); pUnit at [esp+4] on entry (+32 after pushal). */
__attribute__((naked)) static void step_stub(void) {
  __asm__ volatile(
      "pushal\n\t"
      "push 36(%%esp)\n\t"
      "call _ord_step\n\t"
      "add $4, %%esp\n\t"
      "popal\n\t"
      "jmp *%0\n\t" ::"m"(g_step_fn));
}

/* ---------------------------------------------------------- fnrec (route 2) */
typedef struct { uint32_t addr, len; } RecBlk;
static RecBlk g_rec_blk[1024];
static int g_rec_nblk;
static int g_rec_active;
static uint32_t g_rec_args[8];

static void rec_add(uint32_t addr, uint32_t len) {
  if (!addr || g_rec_nblk >= 1024) return;
  for (int i = 0; i < g_rec_nblk; i++)
    if (g_rec_blk[i].addr == addr) return;
  g_rec_blk[g_rec_nblk].addr = addr;
  g_rec_blk[g_rec_nblk].len = len;
  g_rec_nblk++;
}

static void rec_dump_blocks(const char *key) {
  fprintf(g_rec, ",\"%s\":[", key);
  for (int i = 0; i < g_rec_nblk; i++) {
    const uint8_t *p = (const uint8_t *)(uintptr_t)g_rec_blk[i].addr;
    fprintf(g_rec, "%s[%u,\"", i ? "," : "", g_rec_blk[i].addr);
    if (!IsBadReadPtr(p, g_rec_blk[i].len))
      for (uint32_t k = 0; k < g_rec_blk[i].len; k++) fprintf(g_rec, "%02x", p[k]);
    fputs("\"]", g_rec);
  }
  fputc(']', g_rec);
}

static void rec_collect(uint8_t *game, uint8_t *unit, uint32_t type, uint32_t frame) {
  uint8_t *timer = (uint8_t *)(uintptr_t)RD32(game, 0xB8);
  rec_add((uint32_t)(uintptr_t)game, 0x100);
  rec_add((uint32_t)(uintptr_t)timer, 0xA20);
  for (uint8_t *chunk = (uint8_t *)(uintptr_t)RD32(timer, 0xA1C); chunk;
       chunk = (uint8_t *)(uintptr_t)RD32(chunk, 0x7084)) {
    rec_add((uint32_t)(uintptr_t)chunk + 0x7080, 8);
    uint32_t freeHead = RD32(chunk, 0x7080);
    if (freeHead) {
      rec_add(freeHead, 0x30);
      uint32_t nextFree = RD32((const uint8_t *)(uintptr_t)freeHead, 0x1C);
      if (nextFree) rec_add(nextFree, 0x30);
    }
  }
  if (unit) {
    rec_add((uint32_t)(uintptr_t)unit, 0x100);
    for (uint32_t ev = RD32(unit, 0xDC), lim = 0;
         ev && lim < 32 && !IsBadReadPtr((const void *)(uintptr_t)ev, 0x30);
         ev = RD32((const uint8_t *)(uintptr_t)ev, 0x24), lim++) {
      rec_add(ev, 0x30);
      rec_add(RD32((const uint8_t *)(uintptr_t)ev, 0x1C), 0x30);
      rec_add(RD32((const uint8_t *)(uintptr_t)ev, 0x20), 0x30);
    }
    uint8_t *slex = (uint8_t *)(uintptr_t)RD32(unit, 0x5C);
    if (slex && !IsBadReadPtr(slex, 0x64)) {
      rec_add((uint32_t)(uintptr_t)slex, 0x64);
      if (RD32(slex, 0x10) & 0x80000000u)
        rec_add(RD32(slex, 0x58), 0x30);
    }
  }
  static const int part_by_type[7] = {0, 1, 3, 2, 4, -1, 0};
  uint32_t ut = unit ? RD32(unit, U_TYPE) : 6;
  int part = ut < 7 ? part_by_type[ut] : 0;
  if (part < 0 || type >= 15) return;
  if (frame == 0xFFFFFFFFu) {
    rec_add(RD32(timer, 0xA04 + part * 4), 0x30);
  } else {
    uint32_t gf = RD32(game, G_FRAME);
    if (frame <= gf) frame = gf + 1;
    rec_add(RD32(timer, 0x504 + (part * 64 + (frame & 63)) * 4), 0x30);
  }
}

/* stack: [0] ret, [1] type, [2] frame, [3] handler, [4] arg14, [5] arg18 */
void __cdecl se_pre(uint8_t *game, uint8_t *unit, uint32_t *stack) {
  g_rec_active = 0;
  if (!g_rec || !game || g_rec_n >= g_rec_max) return;
  uint32_t fr = RD32(game, G_FRAME);
  if (fr < g_rec_from || fr > g_rec_to) return;
  g_rec_active = 1;
  g_rec_nblk = 0;
  g_rec_args[0] = (uint32_t)(uintptr_t)game;
  g_rec_args[1] = (uint32_t)(uintptr_t)unit;
  for (int i = 1; i <= 5; i++) g_rec_args[1 + i] = stack[i];
  rec_collect(game, unit, stack[1], stack[2]);
  fprintf(g_rec, "{\"fn\":\"EVENT_SetEvent\",\"va\":%u,\"frame\":%u,\"args\":[", 0x6FCAEA80u, fr);
  for (int i = 0; i < 7; i++) fprintf(g_rec, "%s%u", i ? "," : "", g_rec_args[i]);
  fputc(']', g_rec);
  rec_dump_blocks("pre");
}

void __cdecl se_post(void) {
  if (!g_rec_active) return;
  g_rec_active = 0;
  uint8_t *game = (uint8_t *)(uintptr_t)g_rec_args[0];
  uint8_t *unit = (uint8_t *)(uintptr_t)g_rec_args[1];
  /* The new node is now the head of its list: add it (and anything else that moved) to the set. */
  rec_collect(game, unit, g_rec_args[2], g_rec_args[3]);
  rec_dump_blocks("post");
  fputs("}\n", g_rec);
  g_rec_n++;
  if ((g_rec_n & 15) == 0) fflush(g_rec);
}

__attribute__((naked)) static void se_wrap(void) {
  __asm__ volatile(
      "pushal\n\t"
      "lea 32(%%esp), %%eax\n\t"
      "push %%eax\n\t"
      "push %%edx\n\t"
      "push %%ecx\n\t"
      "call _se_pre\n\t"
      "add $12, %%esp\n\t"
      "popal\n\t"
      "push 20(%%esp)\n\t"
      "push 20(%%esp)\n\t"
      "push 20(%%esp)\n\t"
      "push 20(%%esp)\n\t"
      "push 20(%%esp)\n\t"
      "call *%0\n\t"
      "pushal\n\t"
      "call _se_post\n\t"
      "popal\n\t"
      "ret $0x14\n\t" ::"m"(g_se_tramp));
}

/* Staged atomic pre-snapshot buffer for nested-safe fnrec hooks (delevent, setstat, togglestate). */
static int g_fnrec_busy;
static RecBlk g_st_pre_blk[512];
static int g_st_pre_nblk;
static uint8_t g_st_pre_data[262144];
static uint32_t g_st_pre_off[512];
static uint32_t g_st_pre_used;
static uint32_t g_st_args[8];
static uint32_t g_st_frame;
static uint32_t g_st_aux[4];

static void st_pre_reset(void) {
  g_st_pre_nblk = 0;
  g_st_pre_used = 0;
}

static void st_pre_add(uint32_t addr, uint32_t len) {
  if (!addr || !len || g_st_pre_nblk >= 512 || g_st_pre_used + len > sizeof g_st_pre_data) return;
  for (int i = 0; i < g_st_pre_nblk; i++)
    if (g_st_pre_blk[i].addr == addr) return;
  const uint8_t *p = (const uint8_t *)(uintptr_t)addr;
  if (IsBadReadPtr(p, len)) return;
  g_st_pre_blk[g_st_pre_nblk].addr = addr;
  g_st_pre_blk[g_st_pre_nblk].len = len;
  g_st_pre_off[g_st_pre_nblk] = g_st_pre_used;
  memcpy(g_st_pre_data + g_st_pre_used, p, len);
  g_st_pre_used += len;
  g_st_pre_nblk++;
}

static void st_dump_staged_pre(void) {
  fputs(",\"pre\":[", g_rec);
  for (int i = 0; i < g_st_pre_nblk; i++) {
    fprintf(g_rec, "%s[%u,\"", i ? "," : "", g_st_pre_blk[i].addr);
    const uint8_t *p = g_st_pre_data + g_st_pre_off[i];
    for (uint32_t k = 0; k < g_st_pre_blk[i].len; k++) fprintf(g_rec, "%02x", p[k]);
    fputs("\"]", g_rec);
  }
  fputc(']', g_rec);
}

static int st_has_mutation(void) {
  for (int i = 0; i < g_st_pre_nblk; i++) {
    const uint8_t *cur = (const uint8_t *)(uintptr_t)g_st_pre_blk[i].addr;
    const uint8_t *pre = g_st_pre_data + g_st_pre_off[i];
    if (!IsBadReadPtr(cur, g_st_pre_blk[i].len) &&
        memcmp(cur, pre, g_st_pre_blk[i].len) != 0) {
      return 1;
    }
  }
  return 0;
}

static uint16_t g_ss_stat_cnt[512];
static uint8_t g_ts_seen[256][2];

/* MONSTER_ClearModeEvents (0x6FD00750): eax=pGame, ebx=pUnit, ret */
static void de_collect(uint8_t *game, uint8_t *unit, int to_pre) {
  uint8_t *timer = (uint8_t *)(uintptr_t)RD32(game, 0xB8);
  void (*add)(uint32_t, uint32_t) = to_pre ? st_pre_add : rec_add;
  add((uint32_t)(uintptr_t)game, 0x100);
  add((uint32_t)(uintptr_t)timer, 0xA20);
  for (uint8_t *chunk = (uint8_t *)(uintptr_t)RD32(timer, 0xA1C); chunk;
       chunk = (uint8_t *)(uintptr_t)RD32(chunk, 0x7084)) {
    add((uint32_t)(uintptr_t)chunk + 0x7080, 8);
    uint32_t freeHead = RD32(chunk, 0x7080);
    if (freeHead) {
      add(freeHead, 0x30);
      uint32_t nextFree = RD32((const uint8_t *)(uintptr_t)freeHead, 0x1C);
      if (nextFree) add(nextFree, 0x30);
    }
  }
  if (unit && !IsBadReadPtr(unit, 0x100)) {
    add((uint32_t)(uintptr_t)unit, 0x100);
    uint8_t *ev = (uint8_t *)(uintptr_t)RD32(unit, 0xDC);
    for (int k = 0; ev && k < 64 && !IsBadReadPtr(ev, 0x30); k++) {
      add((uint32_t)(uintptr_t)ev, 0x30);
      add(RD32(ev, 0x1C), 0x30);
      add(RD32(ev, 0x20), 0x30);
      add(RD32(ev, 0x24), 0x30);
      add(RD32(ev, 0x28), 0x30);
      ev = (uint8_t *)(uintptr_t)RD32(ev, 0x24);
    }
  }
  if (!to_pre) {
    for (int i = 0; i < g_st_pre_nblk; i++) add(g_st_pre_blk[i].addr, g_st_pre_blk[i].len);
  }
}

void __cdecl de_pre(uint8_t *game, uint8_t *unit) {
  if (g_fnrec_busy || g_rec_active || !g_rec || !game || !unit || g_de_n >= g_de_max) return;
  uint32_t fr = RD32(game, G_FRAME);
  if (fr < g_de_from || fr > g_de_to || !RD32(unit, 0xDC)) return;
  g_fnrec_busy = 1;
  g_st_frame = fr;
  g_st_args[0] = (uint32_t)(uintptr_t)game;
  g_st_args[1] = (uint32_t)(uintptr_t)unit;
  st_pre_reset();
  de_collect(game, unit, 1);
}

void __cdecl de_post(uint32_t ret) {
  if (g_fnrec_busy != 1) return;
  g_fnrec_busy = 0;
  if (!st_has_mutation()) return;
  g_rec_nblk = 0;
  de_collect((uint8_t *)(uintptr_t)g_st_args[0], (uint8_t *)(uintptr_t)g_st_args[1], 0);
  fprintf(g_rec, "{\"fn\":\"MONSTER_DeleteModeEvents\",\"va\":%u,\"frame\":%u,\"ret\":%u,\"args\":[%u,%u]",
          0x6FD00750u, g_st_frame, ret, g_st_args[0], g_st_args[1]);
  st_dump_staged_pre();
  rec_dump_blocks("post");
  fputs("}\n", g_rec);
  g_de_n++;
  fflush(g_rec);
}

__attribute__((naked)) static void de_wrap(void) {
  __asm__ volatile(
      "pushal\n\t"
      "push %%ebx\n\t"
      "push %%eax\n\t"
      "call _de_pre\n\t"
      "add $8, %%esp\n\t"
      "popal\n\t"
      "call *%0\n\t"
      "pushal\n\t"
      "push %%eax\n\t"
      "call _de_post\n\t"
      "add $4, %%esp\n\t"
      "popal\n\t"
      "ret\n\t" ::"m"(g_de_tramp));
}

/* STATLIST_SetUnitStat (D2Common 0x6FD8A740): stdcall(pUnit, nStat, nValue, wLayer), ret 0x10 */
static void ss_collect(uint8_t *unit, int to_pre) {
  void (*add)(uint32_t, uint32_t) = to_pre ? st_pre_add : rec_add;
  add((uint32_t)(uintptr_t)unit, 0x100);
  uint8_t *slex = (uint8_t *)(uintptr_t)RD32(unit, 0x5C);
  if (!slex || IsBadReadPtr(slex, 0x64) || !(RD32(slex, 0x10) & 0x80000000u)) return;
  add((uint32_t)(uintptr_t)slex, 0x64);
  uint16_t myCap = *(uint16_t *)(slex + 0x2A);
  if (myCap > 0 && myCap <= 256) add(RD32(slex, 0x24), (uint32_t)myCap * 8u);
  uint16_t fullCap = *(uint16_t *)(slex + 0x4E);
  if (fullCap > 0 && fullCap <= 256) add(RD32(slex, 0x48), (uint32_t)fullCap * 8u);
  uint16_t modCap = *(uint16_t *)(slex + 0x56);
  if (modCap > 0 && modCap <= 256) add(RD32(slex, 0x50), (uint32_t)modCap * 8u);
  uint8_t *cl = (uint8_t *)(uintptr_t)RD32(slex, 0x3C);
  for (int ck = 0; cl && ck < 32 && !IsBadReadPtr(cl, 0x3C); ck++) {
    add((uint32_t)(uintptr_t)cl, 0x3C);
    uint16_t clCap = *(uint16_t *)(cl + 0x2A);
    if (clCap > 0 && clCap <= 256) add(RD32(cl, 0x24), (uint32_t)clCap * 8u);
    cl = (uint8_t *)(uintptr_t)RD32(cl, 0x2C);
  }
  if (!to_pre) {
    for (int i = 0; i < g_st_pre_nblk; i++) add(g_st_pre_blk[i].addr, g_st_pre_blk[i].len);
  }
}

void __cdecl ss_pre(uint32_t *stack) {
  if (g_fnrec_busy || g_rec_active || !g_rec || g_ss_n >= g_ss_max) return;
  uint8_t *unit = (uint8_t *)(uintptr_t)stack[1];
  if (!unit || IsBadReadPtr(unit, 0x100)) return;
  uint32_t ut = RD32(unit, U_TYPE);
  if (ut != 1 && ut != 4) return; /* monster & item stat updates without player client-dirty list */
  uint32_t stat_id = stack[2];
  if (stat_id == 7 || stat_id == 9 || stat_id == 11 || stat_id >= 359) return; /* skip fCallback stats */
  uint32_t per_stat_cap = 12;
  if (stat_id < 512 && g_ss_stat_cnt[stat_id] >= per_stat_cap) return;
  uint8_t *game = (uint8_t *)(uintptr_t)RD32(unit, 0x80);
  if (!game || IsBadReadPtr(game, 0x100)) return;
  uint32_t fr = RD32(game, G_FRAME);
  if (fr < g_ss_from || fr > g_ss_to) return;
  uint8_t *slex = (uint8_t *)(uintptr_t)RD32(unit, 0x5C);
  if (!slex || IsBadReadPtr(slex, 0x64) || !(RD32(slex, 0x10) & 0x80000000u)) return;
  if (RD32(slex, 0x34) != 0) return; /* skip attached item sub-lists whose pParent owner wasn't staged */
  if (RD32(slex, 0x5C) != 0) {
    if (!g_d2common_mod) return;
    uint8_t *sgpt = *(uint8_t **)(uintptr_t)C(0x6FDE9E1C);
    if (!sgpt || IsBadReadPtr(sgpt, 0xBD8)) return;
    uint8_t *isc = *(uint8_t **)(sgpt + 0xBCC);
    if (!isc || (isc[stat_id * 0x144u + 0x05u] & 0x08u) != 0) return;
  }
  g_fnrec_busy = 2;
  g_st_frame = fr;
  for (int i = 0; i < 4; i++) g_st_args[i] = stack[1 + i];
  g_st_aux[0] = RD32(slex, 0x24);
  g_st_aux[1] = RD32(slex, 0x48);
  g_st_aux[2] = RD32(slex, 0x50);
  g_st_aux[3] = ((uint32_t)*(uint16_t *)(slex + 0x2A) << 16) | (uint32_t)*(uint16_t *)(slex + 0x4E);
  st_pre_reset();
  ss_collect(unit, 1);
}

void __cdecl ss_post(uint32_t ret) {
  if (g_fnrec_busy != 2) return;
  g_fnrec_busy = 0;
  uint8_t *unit = (uint8_t *)(uintptr_t)g_st_args[0];
  uint8_t *slex = (uint8_t *)(uintptr_t)RD32(unit, 0x5C);
  uint32_t post_caps = slex ? (((uint32_t)*(uint16_t *)(slex + 0x2A) << 16) | (uint32_t)*(uint16_t *)(slex + 0x4E)) : 0u;
  if (!slex || RD32(slex, 0x24) != g_st_aux[0] || RD32(slex, 0x48) != g_st_aux[1] ||
      RD32(slex, 0x50) != g_st_aux[2] || post_caps != g_st_aux[3]) {
    return; /* skip calls that grew/shrunk heap array capacity via Fog.Alloc / Fog.ReAlloc */
  }
  if (!st_has_mutation()) return;
  if (g_st_args[1] < 512) g_ss_stat_cnt[g_st_args[1]]++;
  g_rec_nblk = 0;
  ss_collect(unit, 0);
  fprintf(g_rec, "{\"fn\":\"STATLIST_SetUnitStat\",\"va\":%u,\"frame\":%u,\"ret\":%u,\"args\":[%u,%u,%d,%u]",
          0x6FD8A740u, g_st_frame, ret, g_st_args[0], g_st_args[1], (int32_t)g_st_args[2], g_st_args[3]);
  st_dump_staged_pre();
  rec_dump_blocks("post");
  fputs("}\n", g_rec);
  g_ss_n++;
  fflush(g_rec);
}

__attribute__((naked)) static void ss_wrap(void) {
  __asm__ volatile(
      "pushal\n\t"
      "lea 32(%%esp), %%eax\n\t"
      "push %%eax\n\t"
      "call _ss_pre\n\t"
      "add $4, %%esp\n\t"
      "popal\n\t"
      "push 16(%%esp)\n\t"
      "push 16(%%esp)\n\t"
      "push 16(%%esp)\n\t"
      "push 16(%%esp)\n\t"
      "call *%0\n\t"
      "pushal\n\t"
      "push %%eax\n\t"
      "call _ss_post\n\t"
      "add $4, %%esp\n\t"
      "popal\n\t"
      "ret $0x10\n\t" ::"m"(g_ss_tramp));
}

/* STATES_ToggleState (D2Common 0x6FD88730): ebx=stateId, stdcall(pUnit, bSet), ret 8 */
static void ts_collect(uint8_t *unit, int to_pre) {
  void (*add)(uint32_t, uint32_t) = to_pre ? st_pre_add : rec_add;
  add((uint32_t)(uintptr_t)unit, 0x100);
  uint8_t *slex = (uint8_t *)(uintptr_t)RD32(unit, 0x5C);
  if (slex && !IsBadReadPtr(slex, 0x64) && (RD32(slex, 0x10) & 0x80000000u)) {
    add((uint32_t)(uintptr_t)slex, 0x64);
    add(RD32(slex, 0x58), 0x30);
  }
}

void __cdecl ts_pre(uint32_t stateId, uint32_t *stack) {
  if (g_fnrec_busy || g_rec_active || !g_rec || g_ts_n >= g_ts_max) return;
  uint32_t bset = stack[2] ? 1u : 0u;
  if (stateId < 256 && g_ts_seen[stateId][bset] >= 3) return;
  uint8_t *unit = (uint8_t *)(uintptr_t)stack[1];
  if (!unit || IsBadReadPtr(unit, 0x100)) return;
  uint8_t *game = (uint8_t *)(uintptr_t)RD32(unit, 0x80);
  if (!game || IsBadReadPtr(game, 0x100)) return;
  uint32_t fr = RD32(game, G_FRAME);
  if (fr < g_ts_from || fr > g_ts_to) return;
  g_fnrec_busy = 3;
  g_st_frame = fr;
  g_st_args[0] = (uint32_t)(uintptr_t)unit;
  g_st_args[1] = stateId;
  g_st_args[2] = stack[2];
  st_pre_reset();
  ts_collect(unit, 1);
}

void __cdecl ts_post(uint32_t ret) {
  if (g_fnrec_busy != 3) return;
  g_fnrec_busy = 0;
  if (!st_has_mutation()) return;
  if (g_st_args[1] < 256) g_ts_seen[g_st_args[1]][g_st_args[2] ? 1 : 0]++;
  g_rec_nblk = 0;
  ts_collect((uint8_t *)(uintptr_t)g_st_args[0], 0);
  fprintf(g_rec, "{\"fn\":\"STATES_ToggleState\",\"va\":%u,\"frame\":%u,\"ret\":%u,\"args\":[%u,%u,%u]",
          0x6FD88730u, g_st_frame, ret, g_st_args[0], g_st_args[1], g_st_args[2]);
  st_dump_staged_pre();
  rec_dump_blocks("post");
  fputs("}\n", g_rec);
  g_ts_n++;
  fflush(g_rec);
}

__attribute__((naked)) static void ts_wrap(void) {
  __asm__ volatile(
      "pushal\n\t"
      "lea 32(%%esp), %%eax\n\t"
      "push %%eax\n\t"
      "push %%ebx\n\t"
      "call _ts_pre\n\t"
      "add $8, %%esp\n\t"
      "popal\n\t"
      "push 8(%%esp)\n\t"
      "push 8(%%esp)\n\t"
      "call *%0\n\t"
      "pushal\n\t"
      "push %%eax\n\t"
      "call _ts_post\n\t"
      "add $4, %%esp\n\t"
      "popal\n\t"
      "ret $8\n\t" ::"m"(g_ts_tramp));
}

void __cdecl rec_timers(uint8_t *game) {
  if (!g_rec || !game) return;
  uint32_t fr = RD32(game, G_FRAME);
  if (fr < g_tm_from || fr > g_tm_to) return;
  uint8_t *timer = (uint8_t *)(uintptr_t)RD32(game, 0xB8);
  g_rec_nblk = 0;
  rec_add((uint32_t)(uintptr_t)game, 0x100);
  rec_add((uint32_t)(uintptr_t)timer, 0xA20);
  for (int part = 0; part < 5; part++) {
    uint8_t *n = (uint8_t *)(uintptr_t)RD32(timer, 0xA04 + part * 4);
    for (int k = 0; n && k < 200; k++, n = (uint8_t *)(uintptr_t)RD32(n, 0x1C))
      rec_add((uint32_t)(uintptr_t)n, 0x30);
    n = (uint8_t *)(uintptr_t)RD32(timer, 0x004 + (part * 64 + (fr & 63)) * 4);
    for (int k = 0; n && k < 400; k++, n = (uint8_t *)(uintptr_t)RD32(n, 0x1C))
      rec_add((uint32_t)(uintptr_t)n, 0x30);
  }
  fprintf(g_rec, "{\"fn\":\"EVENT_UpdateTimers\",\"va\":%u,\"frame\":%u,\"args\":[%u]", 0x6FCAF070u, fr,
          (uint32_t)(uintptr_t)game);
  rec_dump_blocks("pre");
  fputs(",\"post\":[]}\n", g_rec);
}

/* call 0x6FCAF070 with esi = pGame (0x6FC4E0D5). */
__attribute__((naked)) static void timers_stub(void) {
  __asm__ volatile(
      "pushal\n\t"
      "push %%esi\n\t"
      "call _rec_timers\n\t"
      "add $4, %%esp\n\t"
      "popal\n\t"
      "jmp *%0\n\t" ::"m"(g_timers_fn));
}

static int patch_entry_jmp(uintptr_t fn, const uint8_t *expect, int n, void *target, void **tramp_out) {
  uint8_t *p = (uint8_t *)fn;
  if (memcmp(p, expect, n) != 0) {
    logf_("entry patch %p: prologue mismatch", p);
    return 0;
  }
  uint8_t *t = (uint8_t *)VirtualAlloc(NULL, 32, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
  if (!t) return 0;
  memcpy(t, p, n);
  t[n] = 0xE9;
  *(int32_t *)(t + n + 1) = (int32_t)((uintptr_t)(p + n) - (uintptr_t)(t + n + 5));
  DWORD old;
  VirtualProtect(p, n, PAGE_EXECUTE_READWRITE, &old);
  p[0] = 0xE9;
  *(int32_t *)(p + 1) = (int32_t)((uintptr_t)target - (uintptr_t)(p + 5));
  for (int i = 5; i < n; i++) p[i] = 0x90;
  VirtualProtect(p, n, old, &old);
  FlushInstructionCache(GetCurrentProcess(), p, n);
  *tramp_out = t;
  return 1;
}

static int patch_call(uintptr_t site, void *target, uintptr_t expect) {
  uint8_t *p = (uint8_t *)site;
  if (p[0] != 0xE8) {
    logf_("patch %p: not a call (%02x)", p, p[0]);
    return 0;
  }
  uintptr_t cur = site + 5 + *(int32_t *)(p + 1);
  if (cur != expect) {
    logf_("patch %p: target %p != expected %p", p, (void *)cur, (void *)expect);
    return 0;
  }
  DWORD old;
  VirtualProtect(p, 5, PAGE_EXECUTE_READWRITE, &old);
  *(int32_t *)(p + 1) = (int32_t)((uintptr_t)target - (site + 5));
  VirtualProtect(p, 5, old, &old);
  FlushInstructionCache(GetCurrentProcess(), p, 5);
  return 1;
}

static void install_d2game_hooks(void) {
  g_d2game_pref = pref_base(g_d2game);
  g_frame_fn = (void *)G(0x6FC4E050);
  g_c2s_dispatch = (void *)G(0x6FCEC550);
  HMODULE common = GetModuleHandleA("D2Common.dll");
  if (common) {
    g_d2common_mod = common;
    g_d2common_pref = pref_base(common);
  }
  if (common)
    p_GetUnitStat = (GetUnitStat_t)(void (*)(void))GetProcAddress(
        common, MAKEINTRESOURCEA(10973));
  if (common) {
    p_GetRoom = (GetRoom_t)(void (*)(void))GetProcAddress(
        common, MAKEINTRESOURCEA(10331));
    p_LevelIdFromRoom = (LevelIdFromRoom_t)(void (*)(void))GetProcAddress(
        common, MAKEINTRESOURCEA(10826));
  }
  if (common)
    p_CheckState = (CheckState_t)(void (*)(void))GetProcAddress(
        common, MAKEINTRESOURCEA(10871));
  logf_("D2Common %p GetUnitStat %p CheckState %p", (void *)common,
        (void *)p_GetUnitStat, (void *)p_CheckState);
  p_ApplyDamage = (ApplyDamage_t)G(0x6FCFC0B0);
  g_levelup_fn = (void *)G(0x6FD0B090);
  p_GetItemIdx = (GetItemIdx_t)G(0x6FC2AE74);
  p_CreateItemEx = (CreateItemEx_t)G(0x6FC31490);
  p_SetItemFlag = (SetItemFlag_t)G(0x6FC2A65E);
  g_equip_fn = (void *)G(0x6FCF60D0);
  if (common)
    p_SetUnitStat = (SetUnitStat_t)(void (*)(void))GetProcAddress(
        common, MAKEINTRESOURCEA(10887));
  int ok = 0;
  /* GAME_UpdateGames (#10008) and the single-step path (#10002). */
  ok += patch_call(G(0x6FC4E2DB), frame_stub, (uintptr_t)g_frame_fn);
  ok += patch_call(G(0x6FC72712), frame_stub, (uintptr_t)g_frame_fn);
  logf_("D2Game at %p (pref %p): %d/2 frame hooks", (void *)g_d2game,
        (void *)g_d2game_pref, ok);
  static const uintptr_t dmg_sites[] = {0x6FC95645, 0x6FCFDE2D, 0x6FCFE1A0,
                                        0x6FD14478};
  int dk = 0;
  for (int i = 0; i < 4; i++)
    dk += patch_call(G(dmg_sites[i]), (void *)apply_damage_hook,
                     (uintptr_t)p_ApplyDamage);
  logf_("%d/4 damage hooks", dk);
  static const uintptr_t dot_sites[] = {0x6FC9684A, 0x6FC97D12};
  int dotk = 0;
  for (int i = 0; i < 2; i++)
    dotk += patch_call(G(dot_sites[i]), (void *)dot_setstat_hook,
                       G(0x6FC2A472));
  logf_("%d/2 dot hooks", dotk);
  if (g_rec && g_rec_from != 0xFFFFFFFFu) {
    static const uint8_t se_prologue[5] = {0x53, 0x8B, 0x5C, 0x24, 0x08};
    int rk = patch_entry_jmp(G(0x6FCAEA80), se_prologue, 5, (void *)se_wrap, &g_se_tramp);
    logf_("%d/1 fnrec setevent hooks", rk);
  }
  if (g_rec && g_de_from != 0xFFFFFFFFu) {
    static const uint8_t de_prologue[5] = {0x85, 0xDB, 0x57, 0x8B, 0xF8};
    int dk2 = patch_entry_jmp(G(0x6FD00750), de_prologue, 5, (void *)de_wrap, &g_de_tramp);
    logf_("%d/1 fnrec delevent hooks", dk2);
  }
  if (g_rec && g_ss_from != 0xFFFFFFFFu && g_d2common_mod) {
    static const uint8_t ss_prologue[5] = {0x8B, 0x44, 0x24, 0x0C, 0x53};
    int ssk = patch_entry_jmp(C(0x6FD8A740), ss_prologue, 5, (void *)ss_wrap, &g_ss_tramp);
    logf_("%d/1 fnrec setstat hooks", ssk);
  }
  if (g_rec && g_ts_from != 0xFFFFFFFFu && g_d2common_mod) {
    static const uint8_t ts_prologue[6] = {0x8B, 0x44, 0x24, 0x04, 0x85, 0xC0};
    int tsk = patch_entry_jmp(C(0x6FD88730), ts_prologue, 6, (void *)ts_wrap, &g_ts_tramp);
    logf_("%d/1 fnrec togglestate hooks", tsk);
  }
  if (g_rec && g_tm_from != 0xFFFFFFFFu) {
    g_timers_fn = (void *)G(0x6FCAF070);
    int tk = patch_call(G(0x6FC4E0D5), (void *)timers_stub, (uintptr_t)g_timers_fn);
    logf_("%d/1 fnrec timers hooks", tk);
  }
  if (g_ord_from != 0xFFFFFFFFu) {
    g_evt_fn = (void *)G(0x6FC969A0);
    g_step_fn = (void *)G(0x6FC2AE9E);
    int ordk = patch_call(G(0x6FCAEC25), (void *)evt_stub_slot, (uintptr_t)g_evt_fn) +
               patch_call(G(0x6FCAEC89), (void *)evt_stub_persist, (uintptr_t)g_evt_fn) +
               patch_call(G(0x6FCC02B1), (void *)step_stub, (uintptr_t)g_step_fn);
    logf_("%d/3 orderlog hooks", ordk);
  }
}

/* ----------------------------------------------------------------- menu */

static HWND find_game_window(void) {
  HWND h = FindWindowA("Diablo II", NULL);
  return h;
}

/* Real (hardware-like) input through SendInput: D2Win tracks the cursor
 * itself, so posted mouse messages are ignored. Coordinates are client
 * coordinates of the 800x600 game window. */
static void move_to(HWND h, int x, int y) {
  POINT p = {x, y};
  ClientToScreen(h, &p);
  SetCursorPos(p.x, p.y);
  INPUT in;
  ZeroMemory(&in, sizeof in);
  in.type = INPUT_MOUSE;
  in.mi.dx = p.x * 65535 / (GetSystemMetrics(SM_CXSCREEN) - 1);
  in.mi.dy = p.y * 65535 / (GetSystemMetrics(SM_CYSCREEN) - 1);
  in.mi.dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE;
  SendInput(1, &in, sizeof in);
}

static void mouse_btn(DWORD flags) {
  INPUT in;
  ZeroMemory(&in, sizeof in);
  in.type = INPUT_MOUSE;
  in.mi.dwFlags = flags;
  SendInput(1, &in, sizeof in);
}

static void click(HWND h, int x, int y) {
  SetForegroundWindow(h);
  move_to(h, x, y);
  Sleep(120);
  mouse_btn(MOUSEEVENTF_LEFTDOWN);
  Sleep(80);
  mouse_btn(MOUSEEVENTF_LEFTUP);
}

static void key_vk(WORD vk) {
  INPUT in[2];
  ZeroMemory(in, sizeof in);
  in[0].type = in[1].type = INPUT_KEYBOARD;
  in[0].ki.wVk = in[1].ki.wVk = vk;
  in[1].ki.dwFlags = KEYEVENTF_KEYUP;
  SendInput(2, in, sizeof in[0]);
}

static void type_text(const char *s) {
  for (; *s; s++) {
    INPUT in[2];
    ZeroMemory(in, sizeof in);
    in[0].type = in[1].type = INPUT_KEYBOARD;
    in[0].ki.wScan = in[1].ki.wScan = (unsigned char)*s;
    in[0].ki.dwFlags = KEYEVENTF_UNICODE;
    in[1].ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
    SendInput(2, in, sizeof in[0]);
    Sleep(60);
  }
}

static void run_menu_script(void) {
  FILE *f = fopen(ORACLE_DIR "menu.txt", "r");
  if (!f) {
    logf_("no menu.txt");
    return;
  }
  HWND h = NULL;
  for (int i = 0; i < 600 && !h; i++) {
    h = find_game_window();
    if (!h) Sleep(100);
  }
  logf_("game window %p", (void *)h);
  char line[256];
  while (fgets(line, sizeof line, f)) {
    char op[32];
    int a = 0, b = 0;
    char s[200] = {0};
    if (line[0] == '#' || sscanf(line, "%31s", op) != 1) continue;
    if (!strcmp(op, "wait") && sscanf(line, "%*s %d", &a) == 1) {
      Sleep(a);
    } else if (!strcmp(op, "click") && sscanf(line, "%*s %d %d", &a, &b) == 2) {
      click(h, a, b);
    } else if (!strcmp(op, "dclick") && sscanf(line, "%*s %d %d", &a, &b) == 2) {
      click(h, a, b);
      Sleep(100);
      click(h, a, b);
    } else if (!strcmp(op, "key") && sscanf(line, "%*s %d", &a) == 1) {
      SetForegroundWindow(h);
      key_vk((WORD)a);
    } else if (!strcmp(op, "text") && sscanf(line, "%*s %199s", s) == 1) {
      SetForegroundWindow(h);
      type_text(s);
    } else if (!strcmp(op, "done")) {
      FILE *d = fopen(ORACLE_DIR "out\\done", "w");
      if (d) fclose(d);
    }
    logf_("menu: %s", strtok(line, "\r\n"));
  }
  fclose(f);
}

/* --------------------------------------------------------------- thread */

static DWORD WINAPI oracle_thread(LPVOID unused) {
  (void)unused;
  CreateDirectoryA(ORACLE_DIR "out", NULL);
  g_log = fopen(ORACLE_DIR "out\\log.txt", "w");
  g_trace = fopen(ORACLE_DIR "out\\trace.ndjson", "wb");
  logf_("d2oracle loaded");
  load_scenario();
  HANDLE menu = CreateThread(NULL, 0, (LPTHREAD_START_ROUTINE)run_menu_script,
                             NULL, 0, NULL);
  (void)menu;
  for (;;) {
    HMODULE m = GetModuleHandleA("D2Game.dll");
    if (m) {
      g_d2game = m;
      install_d2game_hooks();
      break;
    }
    Sleep(1);
  }
  for (;;) {
    Sleep(1000);
    logf_("frames=%ld", g_frames);
  }
  return 0;
}

__declspec(dllexport) void __cdecl d2oracle_headless_init(void) {
  CreateDirectoryA(ORACLE_DIR "out", NULL);
  g_log = fopen(ORACLE_DIR "out\\log.txt", "w");
  g_trace = fopen(ORACLE_DIR "out\\trace.ndjson", "wb");
  logf_("d2oracle headless init");
  load_scenario();
  g_d2game = GetModuleHandleA("D2Game.dll");
  if (g_d2game) {
    install_d2game_hooks();
  } else {
    logf_("ERROR: D2Game.dll not loaded before d2oracle_headless_init");
  }
}

__declspec(dllexport) int __cdecl d2oracle_is_done(void) {
  return (g_max_frames && !g_trace) ? 1 : 0;
}

BOOL WINAPI DllMain(HINSTANCE h, DWORD reason, LPVOID r) {
  (void)r;
  if (reason == DLL_PROCESS_ATTACH) {
    DisableThreadLibraryCalls(h);
    char headless[8] = {0};
    if (GetEnvironmentVariableA("ORACLE_HEADLESS", headless, sizeof headless) > 0 &&
        headless[0] == '1') {
      return TRUE;
    }
    CreateThread(NULL, 0, oracle_thread, NULL, 0, NULL);
  }
  return TRUE;
}
