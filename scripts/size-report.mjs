import { readFileSync } from "node:fs";
import { gzipSync, brotliCompressSync } from "node:zlib";

const path = "dist/index.mjs";
const code = readFileSync(path);

const raw = code.byteLength;
const gzip = gzipSync(code).byteLength;
const brotli = brotliCompressSync(code).byteLength;

console.log(`dist/index.mjs raw: ${raw.toLocaleString()} bytes`);
console.log(`dist/index.mjs gzip: ${gzip.toLocaleString()} bytes`);
console.log(`dist/index.mjs brotli: ${brotli.toLocaleString()} bytes`);
