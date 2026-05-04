#!/usr/bin/env node
import { exportCollections, parseArgs } from './firestore-backup-utils.mjs';

const args = parseArgs(process.argv.slice(2));
const source = args.source || 'dev';
const outDir = args.outDir || '.firebase-backups';

try {
  const { backup, file, issues } = await exportCollections({ source, outDir });
  console.log(`Exported ${source} Firestore data to ${file}`);
  for (const [name, docs] of Object.entries(backup.collections)) {
    console.log(`- ${name}: ${docs.length} documents`);
  }
  if (issues.length > 0) {
    console.warn('\nValidation warnings:');
    for (const issue of issues) console.warn(`- ${issue}`);
  }
  process.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
