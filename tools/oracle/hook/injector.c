/*
 * d2oracle injector: starts Game.exe, injects d2oracle.dll via
 * CreateRemoteThread(LoadLibraryA) shortly after the process starts.
 *
 * Usage: oracle-inject.exe <dll-path> [game args...]
 * Must be run with the D2 install dir as the current directory.
 */
#include <windows.h>
#include <stdio.h>
#include <string.h>

int main(int argc, char **argv) {
  if (argc < 2) {
    fprintf(stderr, "usage: %s <dll> [game args]\n", argv[0]);
    return 2;
  }
  char cmd[4096] = "Game.exe";
  for (int i = 2; i < argc; i++) {
    strncat(cmd, " ", sizeof(cmd) - strlen(cmd) - 1);
    strncat(cmd, argv[i], sizeof(cmd) - strlen(cmd) - 1);
  }
  char dll[MAX_PATH];
  if (!GetFullPathNameA(argv[1], MAX_PATH, dll, NULL)) return 3;

  STARTUPINFOA si;
  ZeroMemory(&si, sizeof(si));
  si.cb = sizeof(si);
  PROCESS_INFORMATION pi;
  if (!CreateProcessA(NULL, cmd, NULL, NULL, FALSE, CREATE_SUSPENDED, NULL,
                      NULL, &si, &pi)) {
    fprintf(stderr, "CreateProcess failed %lu\n", GetLastError());
    return 4;
  }
  /* Let the loader initialize before injecting. */
  ResumeThread(pi.hThread);
  Sleep(300);

  SIZE_T n = strlen(dll) + 1;
  LPVOID mem = VirtualAllocEx(pi.hProcess, NULL, n, MEM_COMMIT | MEM_RESERVE,
                              PAGE_READWRITE);
  if (!mem || !WriteProcessMemory(pi.hProcess, mem, dll, n, NULL)) {
    fprintf(stderr, "remote write failed %lu\n", GetLastError());
    return 5;
  }
  LPTHREAD_START_ROUTINE ll = (LPTHREAD_START_ROUTINE)(void (*)(void))GetProcAddress(
      GetModuleHandleA("kernel32.dll"), "LoadLibraryA");
  HANDLE th = CreateRemoteThread(pi.hProcess, NULL, 0, ll, mem, 0, NULL);
  if (!th) {
    fprintf(stderr, "CreateRemoteThread failed %lu\n", GetLastError());
    return 6;
  }
  WaitForSingleObject(th, 10000);
  DWORD mod = 0;
  GetExitCodeThread(th, &mod);
  printf("injected %s -> module 0x%08lx\n", dll, mod);
  fflush(stdout);
  WaitForSingleObject(pi.hProcess, INFINITE);
  DWORD code = 0;
  GetExitCodeProcess(pi.hProcess, &code);
  printf("game exited %lu\n", code);
  return 0;
}
