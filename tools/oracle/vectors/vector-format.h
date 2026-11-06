#ifndef D2_VECTOR_FORMAT_H
#define D2_VECTOR_FORMAT_H

#include <stdint.h>
#include <string.h>

#define D2TV_MAGIC 0x56543244  /* 'D','2','T','V' */
#define D2TV_VERSION 1

#pragma pack(push, 1)
typedef struct {
  uint32_t magic;        /* 0x56543244 */
  uint16_t version;      /* 1 */
  uint16_t flags;        /* 0 */
  char     kind[8];      /* "PRNG\0\0\0\0", "EVTWHEEL", etc. */
  uint32_t record_size;  /* sizeof(Record) */
  uint32_t record_count; /* number of records */
  uint64_t seed;         /* generator seed */
} D2TVHeader;
#pragma pack(pop)

static inline void d2tv_init_header(D2TVHeader *h, const char *kind, uint32_t rec_size, uint32_t rec_count, uint64_t seed) {
  memset(h, 0, sizeof(*h));
  h->magic = D2TV_MAGIC;
  h->version = D2TV_VERSION;
  h->flags = 0;
  for (size_t i = 0; i < 8 && kind[i] != '\0'; i++) {
    h->kind[i] = kind[i];
  }
  h->record_size = rec_size;
  h->record_count = rec_count;
  h->seed = seed;
}

#endif /* D2_VECTOR_FORMAT_H */
