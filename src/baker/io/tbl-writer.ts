import { tblHash } from '../../common/formats/tbl.ts'

export type TblEntry = string | null | { key: string, value: string }

export function encodeTbl(entries: readonly TblEntry[]): Uint8Array {
  // Determine numElements (max index + 1 of non-null entries)
  let numElements = entries.length
  
  // Decide hashTableSize. Needs to be somewhat larger than active entries.
  // We'll just pick a prime roughly 1.5x larger, or just use length * 2 + 1
  const activeEntries = entries.filter((e) => e !== null)
  const hashTableSize = Math.max(17, activeEntries.length * 2 + 1)
  
  const encoder = new TextEncoder()
  const keyEncoder = new TextEncoder()
  
  // We need to build the hash table
  // Each node: 17 bytes
  // Node layout: isActive(u8), index(u16), hashValue(u32), keyOffset(u32), valOffset(u32), valLength(u16)
  
  const nodes = new Uint8Array(hashTableSize * 17)
  const nodeView = new DataView(nodes.buffer)
  
  let stringDataSize = 0
  
  type EntryTuple = { index: number, keyStr: string, keyBytes: Uint8Array, valBytes: Uint8Array, hash: number, targetBucket: number }
  const tuples: EntryTuple[] = []
  
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    if (e === null) continue
    
    let keyStr = ""
    let valStr = ""
    if (typeof e === 'string') {
      keyStr = `__auto_key_${i}`
      valStr = e
    } else {
      keyStr = e.key
      valStr = e.value
    }
    
    // Fallback encode to latin1 if it's ascii for keys
    let keyBytes = keyEncoder.encode(keyStr)
    let valBytes = encoder.encode(valStr) // for simplify, we use utf-8
    
    const h = tblHash(keyBytes, hashTableSize)
    tuples.push({ index: i, keyStr: keyStr, keyBytes, valBytes, hash: h, targetBucket: h })
  }
  
  let maxTries = 0
  
  for (const t of tuples) {
    let placed = false
    let tries = 0
    for (; tries < hashTableSize; tries++) {
      const b = (t.targetBucket + tries) % hashTableSize
      const base = b * 17
      if (nodes[base] === 0) {
        // Place it
        nodes[base] = 1 // isActive
        nodeView.setUint16(base + 1, t.index, true)
        nodeView.setUint32(base + 3, t.targetBucket, true) // Wait, is hashValue the bucket index?
        // "hashValue stores the ALREADY-MODULO'D bucket index, i.e. pjw(key) % hashTableSize"
        placed = true
        maxTries = Math.max(maxTries, tries + 1)
        break
      }
    }
    if (!placed) throw new Error("Hash table full")
  }
  
  // Now place string data
  let stringOffset = 21 + entries.length * 2 + hashTableSize * 17
  const strings: Uint8Array[] = []
  let currentStringOffset = stringOffset
  
  for (let b = 0; b < hashTableSize; b++) {
    const base = b * 17
    if (nodes[base] === 0) continue
    const index = nodeView.getUint16(base + 1, true)
    const t = tuples.find(x => x.index === index)!
    
    // key is NUL terminated
    nodeView.setUint32(base + 7, currentStringOffset, true)
    const keyBuf = new Uint8Array(t.keyBytes.length + 1)
    keyBuf.set(t.keyBytes)
    strings.push(keyBuf)
    currentStringOffset += keyBuf.length
    
    // value
    nodeView.setUint32(base + 11, currentStringOffset, true)
    // valLength includes NUL
    nodeView.setUint16(base + 15, t.valBytes.length + 1, true)
    const valBuf = new Uint8Array(t.valBytes.length + 1)
    valBuf.set(t.valBytes)
    strings.push(valBuf)
    currentStringOffset += valBuf.length
  }
  
  const out = new Uint8Array(currentStringOffset)
  const view = new DataView(out.buffer)
  
  // header
  view.setUint16(0, 0x1234, true)
  view.setUint16(2, entries.length, true)
  view.setUint32(4, hashTableSize, true)
  view.setUint8(8, 1) // version
  view.setUint32(9, stringOffset, true)
  view.setUint32(13, maxTries, true)
  view.setUint32(17, currentStringOffset, true)
  
  // indices
  for (let i = 0; i < entries.length; i++) {
    // wait! The index array in real files, what does it map? 
    // It maps string index -> bucket index.
    // If an index is not used, it typically maps to 0 or something? Or is it an array of bucket indices?
    // Let's lookup what bucket index it ended up in.
    let bucket = 0
    if (entries[i] !== null) {
      // find bucket
      for (let b = 0; b < hashTableSize; b++) {
        if (nodes[b * 17] && nodeView.getUint16(b * 17 + 1, true) === i) {
          bucket = b
          break
        }
      }
    }
    view.setUint16(21 + i * 2, bucket, true)
  }
  
  out.set(nodes, 21 + entries.length * 2)
  
  let copied = stringOffset
  for (const s of strings) {
    out.set(s, copied)
    copied += s.length
  }
  
  return out
}
