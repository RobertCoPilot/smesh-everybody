#!/usr/bin/env node
import { importCollections, parseArgs } from './firestore-backup-utils.mjs';

const args = parseArgs(process.argv.slice(2));
const file = args.file;
const target = args.target || 'dev';
const dryRun = args['dry-run'] !== false && args['dry-run'] !== 'false' && !args.write;
const allowProduction = Boolean(args['allow-production']);

try {
  const result = await importCollections({ file, target, dryRun, allowProduction });
  console.log(`${dryRun ? 'Dry run' : 'Import'} for ${target} Firestore collections`);
  for (const planned of result.plannedWrites) {
    console.log(`- ${planned.logicalName} -> ${planned.firestoreName}: ${planned.count} documents`);
  }
  if (dryRun) {
    console.log('\nNo data was written. Re-run with --write to import.');
  } else {
    console.log(`\nWrote ${result.written} documents. Import is idempotent because original document IDs are preserved.`);
  }
  process.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
