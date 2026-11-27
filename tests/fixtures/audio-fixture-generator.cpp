#include <iostream>
#include <fstream>
#include <vector>
#include <cstdint>
#include <string>
#include <iomanip>
#include "stormlib_src/huffman/huff.h"
#include "stormlib_src/adpcm/adpcm.h"

using namespace std;

ofstream out;

void dumpHex(const string& name, const vector<uint8_t>& data) {
    out << "export const " << name << " = new Uint8Array([\n";
    for(size_t i=0; i<data.size(); ++i) {
        out << "0x" << hex << setfill('0') << setw(2) << (int)data[i];
        if (i < data.size() - 1) out << ", ";
        if ((i + 1) % 16 == 0) out << "\n";
    }
    out << "\n]);\n\n";
}

int main() {
    out.open("tests/fixtures/audio.ts");
    
    // 1. Huffman inputs
    // We want a highly competitive input that causes many weight swaps to catch any minor weight deviation
    vector<uint8_t> huff_input;
    for (int rep=0; rep<12; rep++) {
        for (int i=0; i<256; i++) {
            huff_input.push_back(i);
        }
    }
    // Also include some repeating blocks
    for (int rep=0; rep<10; rep++) {
        for (int i=0; i<256; i++) {
            huff_input.push_back((i * 17) % 256);
        }
    }
    
    dumpHex("huff_uncompressed", huff_input);

    for (int type = 0; type <= 8; type++) {
        THuffmannTree tree(true);
        vector<uint8_t> compressed(16384, 0);
        TOutputStream os(compressed.data(), compressed.size());
        int encSize = tree.Compress(&os, huff_input.data(), huff_input.size(), type);
        compressed.resize(encSize);
        dumpHex("huff_compressed_type_" + to_string(type), compressed);
    }
    
    // 2. ADPCM
    // We want a vector that pushes differences up and down to trigger clamping and dynamic shift
    vector<int16_t> pcm_mono = {0, 100, 200, 300, 1000, 5000, 10000, 20000, 32767, -32768, -20000, -10000, 0, 0, 10, -10};
    vector<int16_t> pcm_stereo = {0, 10, 100, -100, 500, -500, 32767, -32768, 20000, -20000, 0, 10};
    
    // Pad them a bit to make them longer
    for(int i=0; i<300; i++) { pcm_mono.push_back((i*113) % 20000); pcm_stereo.push_back((i*97) % 20000); }
    
    dumpHex("adpcm_mono_uncompressed", vector<uint8_t>((uint8_t*)pcm_mono.data(), (uint8_t*)pcm_mono.data() + pcm_mono.size() * 2));
    dumpHex("adpcm_stereo_uncompressed", vector<uint8_t>((uint8_t*)pcm_stereo.data(), (uint8_t*)pcm_stereo.data() + pcm_stereo.size() * 2));

    for (int cmpType = 4; cmpType <= 6; cmpType++) {
        vector<uint8_t> comp_mono(2048, 0);
        int mSize = CompressADPCM(comp_mono.data(), comp_mono.size(), (void*)pcm_mono.data(), pcm_mono.size() * 2, 1, cmpType);
        comp_mono.resize(mSize);
        dumpHex("adpcm_mono_compressed_" + to_string(cmpType), comp_mono);
        
        vector<uint8_t> dec_mono(2048, 0);
        int decSize = DecompressADPCM(dec_mono.data(), dec_mono.size(), comp_mono.data(), comp_mono.size(), 1);
        dec_mono.resize(decSize);
        dumpHex("adpcm_mono_expected_" + to_string(cmpType), dec_mono);
    }

    for (int cmpType = 4; cmpType <= 6; cmpType++) {
        vector<uint8_t> comp_stereo(2048, 0);
        int sSize = CompressADPCM(comp_stereo.data(), comp_stereo.size(), (void*)pcm_stereo.data(), pcm_stereo.size() * 2, 2, cmpType);
        comp_stereo.resize(sSize);
        dumpHex("adpcm_stereo_compressed_" + to_string(cmpType), comp_stereo);
        
        vector<uint8_t> dec_stereo(2048, 0);
        int decSize = DecompressADPCM(dec_stereo.data(), dec_stereo.size(), comp_stereo.data(), comp_stereo.size(), 2);
        dec_stereo.resize(decSize);
        dumpHex("adpcm_stereo_expected_" + to_string(cmpType), dec_stereo);
    }

    out.close();
    return 0;
}

/* 
To regenerate the audio.ts fixtures, place StormLib's C sources alongside this file
and compile and execute it using g++:

g++ -o gen_vectors audio-fixture-generator.cpp stormlib_src/huffman/huff.cpp stormlib_src/adpcm/adpcm.cpp
./gen_vectors
*/
