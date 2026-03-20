#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { convertXpToSpriteAsset } from '../data/SpriteXpImporter.js';
import { saveSpriteAsset } from '../data/SpriteAssetLoader.js';

const args = process.argv.slice(2);
const options = Object.fromEntries(args.filter((arg) => arg.startsWith('--')).map((arg) => {
  const [key, value = 'true'] = arg.slice(2).split('=');
  return [key, value];
}));
const xpPath = args.find((arg) => !arg.startsWith('--'));
if (!xpPath || !options.id) {
  console.error('Usage: node tools/importSpriteXp.js <file.xp> --id=spider [--animation=idle] [--out=assets/sprites/spider.json] [--anchorX=3 --anchorY=3]');
  process.exit(1);
}
const buffer = await fs.readFile(xpPath);
const asset = await convertXpToSpriteAsset(buffer, {
  id: options.id,
  animation: options.animation ?? 'idle',
  anchor: options.anchorX != null || options.anchorY != null ? { x: Number(options.anchorX ?? 0), y: Number(options.anchorY ?? 0) } : null,
});
const outputPath = options.out ?? path.join(process.cwd(), 'assets', 'sprites', `${options.id}.json`);
await saveSpriteAsset(asset, outputPath);
console.log(`Wrote sprite asset to ${outputPath}`);
