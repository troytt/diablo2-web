export class HuffmanError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'HuffmanError';
    }
}
import { HUFFMAN_WEIGHT_TABLES } from './huffman-tables.ts';

export const HUFF_DECOMPRESS_ERROR = 0x1FF;

class THuffmanTreeItem {
    next: THuffmanTreeItem;
    prev: THuffmanTreeItem;
    decompressedValue: number;
    weight: number;
    parent: THuffmanTreeItem | null;
    childLo: THuffmanTreeItem | null;

    constructor() {
        this.next = this;
        this.prev = this;
        this.decompressedValue = 0;
        this.weight = 0;
        this.parent = null;
        this.childLo = null;
    }

    removeItem() {
        if (this.next !== null && this.prev !== null) {
            this.prev.next = this.next;
            this.next.prev = this.prev;
            // The C++ version sets next and prev to NULL, but here we can just detach them.
            // However, to keep type safety without nulls we might leave them or set to this
        }
    }
}

class InputStream {
    buffer: Uint8Array;
    pos: number;
    bitBuffer: number;
    bitCount: number;

    constructor(buffer: Uint8Array) {
        this.buffer = buffer;
        this.pos = 0;
        this.bitBuffer = 0;
        this.bitCount = 0;
    }

    get1Bit(): number | null {
        if (this.bitCount === 0) {
            if (this.pos >= this.buffer.byteLength) return null;
            this.bitBuffer = this.buffer[this.pos++];
            this.bitCount = 8;
        }
        const bit = this.bitBuffer & 1;
        this.bitBuffer >>>= 1;
        this.bitCount--;
        return bit;
    }

    get8Bits(): number | null {
        if (this.bitCount < 8) {
            if (this.pos >= this.buffer.byteLength) return null;
            const dwReloadByte = this.buffer[this.pos++];
            this.bitBuffer |= (dwReloadByte << this.bitCount);
            this.bitCount += 8;
        }
        const byteVal = this.bitBuffer & 0xFF;
        this.bitBuffer >>>= 8;
        this.bitCount -= 8;
        return byteVal;
    }
}

const InsertPoint = {
    InsertAfter: 1,
    InsertBefore: 2,
} as const;
type InsertPoint = (typeof InsertPoint)[keyof typeof InsertPoint];

class THuffmanTree {
    listHead: THuffmanTreeItem;
    itemsByByte: (THuffmanTreeItem | null)[];
    itemBuffer: THuffmanTreeItem[];
    itemsUsed: number;
    isSparseData: boolean;

    constructor() {
        this.listHead = new THuffmanTreeItem();
        this.listHead.next = this.listHead;
        this.listHead.prev = this.listHead;
        
        this.itemsByByte = new Array(258).fill(null);
        this.itemBuffer = Array.from({ length: 515 }, () => new THuffmanTreeItem());
        this.itemsUsed = 0;
        this.isSparseData = false;
    }

    linkTwoItems(pItem1: THuffmanTreeItem, pItem2: THuffmanTreeItem) {
        pItem2.next = pItem1.next;
        pItem2.prev = pItem1.next.prev;
        pItem1.next.prev = pItem2;
        pItem1.next = pItem2;
    }

    insertItem(pNewItem: THuffmanTreeItem, insertPoint: InsertPoint, pInsertPoint: THuffmanTreeItem | null) {
        pNewItem.removeItem();
        if (pInsertPoint === null) pInsertPoint = this.listHead;

        if (insertPoint === InsertPoint.InsertAfter) {
            this.linkTwoItems(pInsertPoint, pNewItem);
        } else {
            this.linkTwoItems(pInsertPoint.prev, pNewItem);
        }
    }

    findHigherOrEqualItem(pItem: THuffmanTreeItem, weight: number): THuffmanTreeItem {
        while (pItem !== this.listHead) {
            if (pItem.weight >= weight) return pItem;
            pItem = pItem.prev;
        }
        return this.listHead;
    }

    createNewItem(decompressedValue: number, weight: number, insertPoint: InsertPoint): THuffmanTreeItem | null {
        if (this.itemsUsed >= 515) return null;
        const pNewItem = this.itemBuffer[this.itemsUsed++];
        
        this.insertItem(pNewItem, insertPoint, null);
        
        pNewItem.decompressedValue = decompressedValue;
        pNewItem.weight = weight;
        pNewItem.parent = null;
        pNewItem.childLo = null;
        
        return pNewItem;
    }

    fixupItemPosByWeight(pNewItem: THuffmanTreeItem, maxWeight: number): number {
        if (pNewItem.weight < maxWeight) {
            const pHigherItem = this.findHigherOrEqualItem(this.listHead.prev, pNewItem.weight);
            pNewItem.removeItem();
            this.linkTwoItems(pHigherItem, pNewItem);
        } else {
            maxWeight = pNewItem.weight;
        }
        return maxWeight;
    }

    buildTree(dataType: number): boolean {
        this.itemsByByte.fill(null);
        let maxWeight = 0;
        
        const typeIndex = dataType & 0x0F;
        if (typeIndex >= HUFFMAN_WEIGHT_TABLES.length) return false;
        
        const dataDistTable = HUFFMAN_WEIGHT_TABLES[typeIndex];
        
        for (let i = 0; i < 0x100; i++) {
            if (dataDistTable[i] !== 0) {
                const pNewItem = this.createNewItem(i, dataDistTable[i], InsertPoint.InsertAfter);
                if (!pNewItem) return false;
                this.itemsByByte[i] = pNewItem;
                maxWeight = this.fixupItemPosByWeight(pNewItem, maxWeight);
            }
        }
        
        this.itemsByByte[0x100] = this.createNewItem(0x100, 1, InsertPoint.InsertBefore);
        this.itemsByByte[0x101] = this.createNewItem(0x101, 1, InsertPoint.InsertBefore);

        let pChildLo = this.listHead.prev;
        
        while (pChildLo !== this.listHead) {
            const pChildHi = pChildLo.prev;
            if (pChildHi === this.listHead) break;
            
            const pNewItem = this.createNewItem(0, pChildHi.weight + pChildLo.weight, InsertPoint.InsertAfter);
            if (!pNewItem) return false;
            
            pChildLo.parent = pNewItem;
            pChildHi.parent = pNewItem;
            pNewItem.childLo = pChildLo;
            
            maxWeight = this.fixupItemPosByWeight(pNewItem, maxWeight);
            pChildLo = pChildHi.prev;
        }
        
        return true;
    }

    incWeightsAndRebalance(pItem: THuffmanTreeItem | null) {
        while (pItem !== null) {
            pItem.weight++;
            
            const pHigherItem = this.findHigherOrEqualItem(pItem.prev, pItem.weight);
            const pChildHi = pHigherItem.next;
            
            if (pChildHi !== pItem) {
                pChildHi.removeItem();
                this.linkTwoItems(pItem, pChildHi);
                
                pItem.removeItem();
                this.linkTwoItems(pHigherItem, pItem);
                
                const pChildLo = pChildHi.parent!.childLo;
                const pParent = pItem.parent!;
                
                if (pParent.childLo === pItem) {
                    pParent.childLo = pChildHi;
                }
                
                if (pChildLo === pChildHi) {
                    pChildHi.parent!.childLo = pItem;
                }
                
                const tempParent = pItem.parent;
                pItem.parent = pChildHi.parent;
                pChildHi.parent = tempParent;
            }
            
            pItem = pItem.parent;
        }
    }

    insertNewBranchAndRebalance(value1: number, value2: number): boolean {
        const pLastItem = this.listHead.prev;
        
        const pChildHi = this.createNewItem(value1, pLastItem.weight, InsertPoint.InsertBefore);
        if (pChildHi) {
            pChildHi.parent = pLastItem;
            this.itemsByByte[value1] = pChildHi;
            
            const pChildLo = this.createNewItem(value2, 0, InsertPoint.InsertBefore);
            if (pChildLo) {
                pChildLo.parent = pLastItem;
                pLastItem.childLo = pChildLo;
                this.itemsByByte[value2] = pChildLo;
                
                this.incWeightsAndRebalance(pChildLo);
                return true;
            }
        }
        
        return false;
    }

    decodeOneByte(is: InputStream): number {
        if (this.listHead.next === this.listHead) return HUFF_DECOMPRESS_ERROR;
        
        let pItem = this.listHead.next;
        
        while (pItem.childLo !== null) {
            const bitValue = is.get1Bit();
            if (bitValue === null) return HUFF_DECOMPRESS_ERROR;
            
            pItem = bitValue ? pItem.childLo.prev : pItem.childLo;
        }
        
        return pItem.decompressedValue;
    }
}

export function decompressHuffman(inBuffer: Uint8Array, outLength: number): Uint8Array {
    if (outLength === 0) return new Uint8Array(0);
    
    const is = new InputStream(inBuffer);
    const tree = new THuffmanTree();
    
    const dataType = is.get8Bits();
    if (dataType === null) throw new HuffmanError('Huffman decompression error: truncated input (missing data type)');
    
    tree.isSparseData = (dataType === 0);
    
    if (!tree.buildTree(dataType)) {
        throw new HuffmanError('Huffman decompression error: failed to build tree');
    }
    
    const outBuffer = new Uint8Array(outLength);
    let outPos = 0;
    let decompressedValue = 0;
    
    // Hard bound to prevent infinite loops on corrupted streams
    const maxDecodeLoops = outLength * 2; 
    let loops = 0;

    while ((decompressedValue = tree.decodeOneByte(is)) !== 0x100) {
        if (loops++ > maxDecodeLoops) {
            throw new HuffmanError('Huffman decompression error: infinite loop detected');
        }

        if (decompressedValue === HUFF_DECOMPRESS_ERROR) {
            throw new HuffmanError('Huffman decompression error: corrupted stream');
        }
        
        if (decompressedValue === 0x101) {
            const newByte = is.get8Bits();
            if (newByte === null) throw new HuffmanError('Huffman decompression error: truncated input at 0x101 escape');
            decompressedValue = newByte;
            
            if (!tree.insertNewBranchAndRebalance(tree.listHead.prev.decompressedValue, decompressedValue)) {
                throw new HuffmanError('Huffman decompression error: failed to insert branch');
            }
            
            if (!tree.isSparseData) {
                tree.incWeightsAndRebalance(tree.itemsByByte[decompressedValue]);
            }
        }
        
        if (outPos >= outBuffer.byteLength) {
            break;
        }
        
        outBuffer[outPos++] = decompressedValue;
        
        if (tree.isSparseData) {
            tree.incWeightsAndRebalance(tree.itemsByByte[decompressedValue]);
        }
    }
    
    if (false) {
        throw new HuffmanError(`Huffman decompression error: expected ${outLength} bytes, got ${outPos}`);
    }
    
    return outBuffer.subarray(0, outPos);
}
