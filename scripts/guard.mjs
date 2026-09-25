// non-negotiable PR checks that are cheap to grep (brief §8). exit 1 on any violation.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BANNED = [/^openai$/, /^@anthropic-ai\//, /^anthropic$/, /^@google\/(generative-ai|genai)$/, /^langchain/, /^@langchain\//,
  /^ai$/, /^@ai-sdk\//, /^cohere-ai$/, /^@mistralai\//, /^replicate$/, /^ollama$/, /^llamaindex$/, /^@huggingface\//, /^@xenova\/transformers$/];
const errors = [];

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }))
  if (BANNED.some((b) => b.test(dep))) errors.push(`banned LLM/AI dependency: ${dep}`);

function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (f === 'node_modules' || f.startsWith('.')) continue;
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|js|mjs|svelte)$/.test(f)) yield p;
  }
}
const importRe = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;
for (const dir of ['src', 'pipeline', 'scripts']) for (const file of walk(dir)) {
  const src = readFileSync(file, 'utf8');
  for (const [, mod] of src.matchAll(importRe)) {
    const name = mod.startsWith('@') ? mod.split('/').slice(0, 2).join('/') : mod.split('/')[0];
    if (BANNED.some((b) => b.test(name))) errors.push(`${file}: imports ${mod}`);
    // client firebase is only allowed on /login; menu pages get data from the server load
    if (/^firebase(\/|$)/.test(mod) && !file.includes(join('routes', 'login'))) errors.push(`${file}: client firebase import (${mod})`);
  }
  if (/\bparseFloat\([^)]*price/i.test(src)) errors.push(`${file}: parseFloat on a price — prices are integer cents`);
}

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('guard: ok');
