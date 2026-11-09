// Build an isolated, credential-free test page from the actual client components.
// It is never copied into Next's public/ or app/ routes.
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
const output = resolve(process.argv[2] || '.next/chess-feedback-fixture');
await mkdir(output, {recursive:true});
const shim = resolve('scripts/qa/fixtures/chess-next-shim.tsx');
await build({
  entryPoints:['scripts/qa/fixtures/chess-feedback.tsx'], outdir:output, bundle:true,
  format:'esm', jsx:'automatic', tsconfig:'tsconfig.json',
  alias:{'next/link':shim,'next/image':shim,'next/navigation':shim},
  define:{'process.env.NODE_ENV':'"production"', 'process.env.NEXT_PUBLIC_SUPABASE_URL':'undefined',
    'process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY':'undefined', 'process.env.CHESS_UI_ENABLED':'"true"',
    'process.env.OMOK_UI_ENABLED':'"true"', 'process.env.FRIENDS_UI_ENABLED':'"false"',
    'process.env.MESSAGES_UI_ENABLED':'"false"','process.env.COSMETICS_UI_ENABLED':'"false"'},
});
const inputs = ['src/app/globals.css','src/app/arena.css','src/components/chess/chess.css'];
const css = (await Promise.all(inputs.map(p=>readFile(p,'utf8')))).join('\n');
const compiled = await postcss([tailwind()]).process(css,{from:resolve(inputs[0])});
await writeFile(resolve(output,'chess.css'),compiled.css);
await writeFile(resolve(output,'index.html'),'<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>체스 UI 회귀 검증</title><link rel="stylesheet" href="chess.css"><link rel="stylesheet" href="chess-feedback.css"><body><div id="root"></div><script type="module" src="chess-feedback.js"></script></body></html>');
console.log(output);
