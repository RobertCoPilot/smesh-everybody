#!/usr/bin/env node
import { collectBackupIssues, parseArgs, readBackup } from './firestore-backup-utils.mjs';

const args = parseArgs(process.argv.slice(2));
const file = args.file;

if (!file) {
  console.error('Missing --file=path/to/backup.json');
  process.exit(1);
}

try {
  const backup = await readBackup(file);
  const issues = collectBackupIssues(backup);
  console.log(`Validated backup ${file}`);
  console.log(`- source: ${backup.source ?? backup.sourceProjectId ?? 'unknown'}`);
  for (const [name, docs] of Object.entries(backup.collections)) {
    console.log(`- ${name}: ${docs.length} documents`);
  }

  if (issues.length > 0) {
    console.error('\nValidation failed:');
    for (const issue of issues) console.error(`- ${issue}`);
    process.exit(1);
  }

  console.log('\nNo duplicate IDs, duplicate player names, or duplicate document hashes found.');
  process.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
