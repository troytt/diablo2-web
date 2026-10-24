import { NEXT_STEP_TABLE, STEP_SIZE_TABLE } from './adpcm-tables.ts';

export class AdpcmError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AdpcmError';
    }
}

const INITIAL_ADPCM_STEP_INDEX = 0x2C;
const MAX_ADPCM_CHANNEL_COUNT = 2;

function decodeSample(predictedSample: number, encodedSample: number, stepSize: number, difference: number): number {
    if (encodedSample & 0x01) difference += stepSize;
    if (encodedSample & 0x02) difference += (stepSize >> 1);
    if (encodedSample & 0x04) difference += (stepSize >> 2);
    if (encodedSample & 0x08) difference += (stepSize >> 3);
    if (encodedSample & 0x10) difference += (stepSize >> 4);
    if (encodedSample & 0x20) difference += (stepSize >> 5);

    if (encodedSample & 0x40) {
        predictedSample -= difference;
        if (predictedSample <= -32768) predictedSample = -32768;
    } else {
        predictedSample += difference;
        if (predictedSample >= 32767) predictedSample = 32767;
    }

    return predictedSample | 0;
}

export function decompressAdpcm(inBuffer: Uint8Array, outLength: number, channelCount: number): Uint8Array {
    if (outLength === 0) return new Uint8Array(0);
    
    // Output must be multiple of 2 bytes per sample
    const outBuffer = new Uint8Array(outLength);
    const outView = new DataView(outBuffer.buffer, outBuffer.byteOffset, outBuffer.byteLength);
    let outPos = 0;
    
    let inPos = 0;
    
    const readByte = () => {
        if (inPos >= inBuffer.length) return null;
        return inBuffer[inPos++];
    };
    
    const readWord = () => {
        if (inPos + 1 >= inBuffer.length) return null;
        const result = inBuffer[inPos] | (inBuffer[inPos + 1] << 8);
        inPos += 2;
        // Need signed 16-bit
        return (result << 16) >> 16;
    };
    
    const writeWord = (sample: number) => {
        if (outPos + 1 >= outLength) return false;
        outView.setInt16(outPos, sample, true); // little-endian
        outPos += 2;
        return true;
    };

    const predictedSamples = new Int32Array(MAX_ADPCM_CHANNEL_COUNT);
    const stepIndexes = new Int32Array(MAX_ADPCM_CHANNEL_COUNT);
    
    predictedSamples[0] = 0;
    predictedSamples[1] = 0;
    stepIndexes[0] = INITIAL_ADPCM_STEP_INDEX;
    stepIndexes[1] = INITIAL_ADPCM_STEP_INDEX;
    
    let bitShift = readByte(); // first byte (discarded normally, should be 0)
    if (bitShift === null) throw new AdpcmError('ADPCM block too short (no header)');
    
    bitShift = readByte();
    if (bitShift === null) throw new AdpcmError('ADPCM block too short (no bitshift)');
    
    for (let i = 0; i < channelCount; i++) {
        const initialSample = readWord();
        if (initialSample === null) throw new AdpcmError('ADPCM block too short (missing initial sample)');
        predictedSamples[i] = initialSample;
        if (!writeWord(initialSample)) return outBuffer;
    }
    
    let channelIndex = channelCount - 1;
    let encodedSample: number | null;
    
    while ((encodedSample = readByte()) !== null) {
        channelIndex = (channelIndex + 1) % channelCount;
        
        if (encodedSample === 0x80) {
            if (stepIndexes[channelIndex] !== 0) {
                stepIndexes[channelIndex]--;
            }
            if (!writeWord(predictedSamples[channelIndex])) {
                break; // Output full
            }
        } else if (encodedSample === 0x81) {
            stepIndexes[channelIndex] += 8;
            if (stepIndexes[channelIndex] > 0x58) {
                stepIndexes[channelIndex] = 0x58;
            }
            channelIndex = (channelIndex + 1) % channelCount;
        } else {
            const stepIndex = stepIndexes[channelIndex];
            const stepSize = STEP_SIZE_TABLE[stepIndex];
            
            const initialDifference = stepSize >> bitShift;
            
            predictedSamples[channelIndex] = decodeSample(
                predictedSamples[channelIndex],
                encodedSample,
                stepSize,
                initialDifference
            );
            
            if (!writeWord(predictedSamples[channelIndex])) {
                break;
            }
            
            let nextStepIndex = stepIndex + NEXT_STEP_TABLE[encodedSample & 0x1F];
            if (nextStepIndex < 0) nextStepIndex = 0;
            else if (nextStepIndex > 88) nextStepIndex = 88;
            
            stepIndexes[channelIndex] = nextStepIndex;
        }
    }
    
    return outBuffer;
}
