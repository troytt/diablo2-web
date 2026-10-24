import { getSharedDataRegistry } from '../../common/data/data-registry.ts'
import { REGISTRY_FILES, REGISTRY_PACK_DIR, registryFileOf } from '../../common/data/registry-files.ts'

export type FileFetch = (url: string) => Promise<Pick<Response, 'ok' | 'status' | 'headers' | 'arrayBuffer'>>

let loading: Promise<boolean> | null = null

async function fetchTable(fetchFile: FileFetch, file: string): Promise<readonly [string, Uint8Array]> {
  const response = await fetchFile(`/${REGISTRY_PACK_DIR}/${file}`)
  if (!response.ok || response.headers.get('content-type')?.includes('text/html')) throw new Error(`${file} is missing (HTTP ${response.status})`)
  return [file, new Uint8Array(await response.arrayBuffer())]
}

export function loadSinglePlayerData(fetchFile: FileFetch = (url) => fetch(url)): Promise<boolean> {
  loading ??= Promise.all([...REGISTRY_FILES.keys()].map((file) => fetchTable(fetchFile, file)))
    .then((files) => {
      const tables = new Map(files)
      getSharedDataRegistry({ readBytes: (path) => tables.get(registryFileOf(path)) ?? null })
      return true
    })
    .catch((error: unknown) => {
      loading = null
      console.warn(`Single Player skills need the game's data tables; run "npm run bake -- excel". ${String(error)}`)
      return false
    })
  return loading
}
