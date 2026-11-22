import fs from 'node:fs';
import path from 'node:path';

const src = path.resolve('node_modules/onnxruntime-web/dist');
const dest = path.resolve('public/ort-wasm');
fs.mkdirSync(dest, { recursive: true });

for (const f of fs.readdirSync(src)) {
  if (/^ort-wasm-simd-threaded\.(mjs|wasm)$/.test(f)) {
    fs.copyFileSync(path.join(src, f), path.join(dest, f));
    console.log('copied', f);
  }
}
