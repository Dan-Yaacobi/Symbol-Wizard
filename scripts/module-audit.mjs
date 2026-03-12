import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function listJsFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...listJsFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) results.push(path.relative(ROOT, full).replace(/\\/g, '/'));
  }
  return results;
}

function parseModule(source) {
  const exports = new Set();
  const imports = [];

  const importRegex = /import\s+([\s\S]*?)\s+from\s+['"](.+?)['"]\s*;/g;
  let match;
  while ((match = importRegex.exec(source)) !== null) {
    const spec = match[1].trim();
    const from = match[2];
    const entry = { from, default: null, named: [], namespace: null, raw: spec };

    if (spec.startsWith('{')) {
      const inside = spec.slice(1, -1).trim();
      if (inside) {
        for (const part of inside.split(',')) {
          const [name] = part.trim().split(/\s+as\s+/);
          if (name) entry.named.push(name.trim());
        }
      }
    } else if (spec.startsWith('* as ')) {
      entry.namespace = spec.slice(5).trim();
    } else if (spec.includes(',')) {
      const [defaultPart, restPart] = spec.split(/,(.+)/).map((v) => v.trim());
      entry.default = defaultPart;
      const namedPart = restPart?.match(/\{([\s\S]*)\}/)?.[1]?.trim();
      if (namedPart) {
        for (const part of namedPart.split(',')) {
          const [name] = part.trim().split(/\s+as\s+/);
          if (name) entry.named.push(name.trim());
        }
      }
    } else {
      entry.default = spec;
    }

    imports.push(entry);
  }

  for (const m of source.matchAll(/export\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) exports.add(m[1]);
  for (const m of source.matchAll(/export\s*\{([\s\S]*?)\}/g)) {
    const list = m[1].split(',').map((p) => p.trim()).filter(Boolean);
    for (const item of list) {
      const [, exportedName] = item.split(/\s+as\s+/);
      exports.add((exportedName ?? item).trim());
    }
  }

  const bodyWithoutImports = source.replace(importRegex, '');

  return { imports, exports, hasDefaultExport: /export\s+default\b/.test(source), bodyWithoutImports };
}

function resolveImport(file, specifier) {
  if (!specifier.startsWith('.')) return null;
  return path.normalize(path.join(path.dirname(file), specifier + (specifier.endsWith('.js') ? '' : '.js'))).replace(/\\/g, '/');
}

const files = listJsFiles(ROOT);
const graph = new Map();
for (const file of files) graph.set(file, parseModule(fs.readFileSync(path.join(ROOT, file), 'utf8')));

const brokenImports = [];
const unusedImports = [];
const inboundNamed = new Map(files.map((f) => [f, new Set()]));
const adjacency = new Map(files.map((f) => [f, new Set()]));

for (const [file, info] of graph.entries()) {
  for (const imp of info.imports) {
    const importedSymbols = [imp.default, imp.namespace, ...imp.named].filter(Boolean);
    for (const symbol of importedSymbols) {
      const used = new RegExp(`\\b${symbol.replace(/[$]/g, '\\$')}\\b`).test(info.bodyWithoutImports);
      if (!used) unusedImports.push({ file, symbol, from: imp.from });
    }

    const target = resolveImport(file, imp.from);
    if (!target || !graph.has(target)) continue;
    adjacency.get(file).add(target);

    if (imp.default && !graph.get(target).hasDefaultExport) brokenImports.push({ file, type: 'default', symbol: imp.default, target });
    for (const symbol of imp.named) {
      inboundNamed.get(target).add(symbol);
      if (!graph.get(target).exports.has(symbol)) brokenImports.push({ file, type: 'named', symbol, target });
    }
  }
}

const unusedExports = [];
for (const [file, info] of graph.entries()) {
  for (const symbol of info.exports) {
    if (!inboundNamed.get(file).has(symbol)) unusedExports.push({ file, symbol });
  }
}

const cycles = [];
const visited = new Map();
const stack = [];
function dfs(node) {
  visited.set(node, 1);
  stack.push(node);
  for (const next of adjacency.get(node)) {
    const state = visited.get(next) ?? 0;
    if (state === 0) dfs(next);
    else if (state === 1) cycles.push([...stack.slice(stack.indexOf(next)), next]);
  }
  stack.pop();
  visited.set(node, 2);
}
for (const file of files) if ((visited.get(file) ?? 0) === 0) dfs(file);

console.log(`Modules scanned: ${files.length}`);
console.log(`Broken imports: ${brokenImports.length}`);
if (brokenImports.length) console.table(brokenImports);
console.log(`Unused imports: ${unusedImports.length}`);
if (unusedImports.length) console.table(unusedImports);
console.log(`Unused exports: ${unusedExports.length}`);
if (unusedExports.length) console.table(unusedExports);
console.log(`Cycles: ${cycles.length}`);
if (cycles.length) cycles.forEach((cycle) => console.log(` - ${cycle.join(' -> ')}`));

if (brokenImports.length) process.exitCode = 1;
