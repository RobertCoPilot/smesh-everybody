import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, setDoc } from 'firebase/firestore';

export const COLLECTION_SETS = {
  dev: {
    players: 'dev_players',
    games: 'dev_games',
  },
  production: {
    players: 'players',
    games: 'games',
  },
};

export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAWmLZys9lbH5IYOTjZFHbyt0NTdpjKfHA',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'smesh-everybody.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'smesh-everybody',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'smesh-everybody.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '767791181149',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:767791181149:web:9834d6ad1263162b824cb4',
};

export function parseArgs(argv) {
  const args = {};
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const [key, ...valueParts] = raw.slice(2).split('=');
    args[key] = valueParts.length > 0 ? valueParts.join('=') : true;
  }
  return args;
}

export function getCollectionSet(name) {
  if (name !== 'dev' && name !== 'production') {
    throw new Error(`Invalid collection set "${name}". Use "dev" or "production".`);
  }
  return COLLECTION_SETS[name];
}

export function getDb(appName = 'firestore-backup') {
  const existing = getApps().find((app) => app.name === appName);
  const app = existing ?? initializeApp(DEFAULT_FIREBASE_CONFIG, appName);
  return getFirestore(app);
}

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

export function hashData(data) {
  return createHash('sha256').update(stableStringify(data)).digest('hex');
}

export function safeDate(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

export async function readBackup(file) {
  const backup = JSON.parse(await readFile(file, 'utf8'));
  validateBackupShape(backup);
  return backup;
}

export async function writeBackup(backup, outDir = '.firebase-backups') {
  await mkdir(outDir, { recursive: true });
  const file = path.join(outDir, `firestore-${backup.source}-${safeDate(new Date(backup.createdAt))}.json`);
  await writeFile(file, `${JSON.stringify(backup, null, 2)}\n`);
  return file;
}

export function validateBackupShape(backup) {
  if (!backup || typeof backup !== 'object') throw new Error('Backup must be an object.');
  if (!backup.collections || typeof backup.collections !== 'object') throw new Error('Backup missing collections object.');
  for (const logicalName of ['players', 'games']) {
    const docs = backup.collections[logicalName];
    if (!Array.isArray(docs)) throw new Error(`Backup missing collections.${logicalName} array.`);
    for (const entry of docs) {
      if (!entry || typeof entry !== 'object') throw new Error(`Invalid ${logicalName} entry.`);
      if (typeof entry.id !== 'string' || entry.id.length === 0) throw new Error(`Invalid ${logicalName} document id.`);
      if (!entry.data || typeof entry.data !== 'object') throw new Error(`Invalid ${logicalName} document data for ${entry.id}.`);
    }
  }
}

export function collectBackupIssues(backup) {
  const issues = [];

  for (const [logicalName, docs] of Object.entries(backup.collections)) {
    const ids = new Set();
    const hashes = new Map();
    const playerNames = new Map();

    for (const entry of docs) {
      if (ids.has(entry.id)) issues.push(`${logicalName}: duplicate document id ${entry.id}`);
      ids.add(entry.id);

      const hash = entry.hash || hashData(entry.data);
      const duplicateHash = hashes.get(hash);
      if (duplicateHash) issues.push(`${logicalName}: documents ${duplicateHash} and ${entry.id} have identical data hash ${hash}`);
      hashes.set(hash, entry.id);

      if (logicalName === 'players' && typeof entry.data.name === 'string') {
        const normalizedName = entry.data.name.trim().toLowerCase();
        const duplicateName = playerNames.get(normalizedName);
        if (duplicateName) issues.push(`players: duplicate normalized name "${normalizedName}" in ${duplicateName} and ${entry.id}`);
        playerNames.set(normalizedName, entry.id);
      }
    }
  }

  return issues;
}

export async function exportCollections({ source = 'dev', outDir = '.firebase-backups' } = {}) {
  const db = getDb(`export-${source}`);
  const collections = getCollectionSet(source);
  const backup = {
    version: 1,
    createdAt: new Date().toISOString(),
    source,
    sourceProjectId: DEFAULT_FIREBASE_CONFIG.projectId,
    collections: {},
  };

  for (const [logicalName, firestoreName] of Object.entries(collections)) {
    const snap = await getDocs(collection(db, firestoreName));
    backup.collections[logicalName] = snap.docs.map((snapshot) => {
      const data = snapshot.data();
      return {
        id: snapshot.id,
        hash: hashData(data),
        data,
      };
    });
  }

  const issues = collectBackupIssues(backup);
  if (issues.length > 0) {
    backup.validationIssues = issues;
  }

  const file = await writeBackup(backup, outDir);
  return { backup, file, issues };
}

export async function importCollections({ file, target = 'dev', dryRun = true, allowProduction = false } = {}) {
  if (!file) throw new Error('Missing --file=path/to/backup.json');
  if (target === 'production' && !allowProduction) {
    throw new Error('Refusing to import into production without --allow-production. Prefer importing into dev.');
  }

  const backup = await readBackup(file);
  const issues = collectBackupIssues(backup);
  if (issues.length > 0) {
    throw new Error(`Backup validation failed:\n- ${issues.join('\n- ')}`);
  }

  const collections = getCollectionSet(target);
  const plannedWrites = Object.entries(backup.collections).map(([logicalName, docs]) => ({
    logicalName,
    firestoreName: collections[logicalName],
    count: docs.length,
  }));

  if (dryRun) return { backup, plannedWrites, written: 0, dryRun: true };

  const db = getDb(`import-${target}`);
  let written = 0;
  for (const [logicalName, docs] of Object.entries(backup.collections)) {
    const firestoreName = collections[logicalName];
    for (const entry of docs) {
      await setDoc(doc(db, firestoreName, entry.id), entry.data);
      written += 1;
    }
  }

  return { backup, plannedWrites, written, dryRun: false };
}
