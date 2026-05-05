const collectionPrefix = process.env.NEXT_PUBLIC_FIRESTORE_COLLECTION_PREFIX ?? '';

export const firestoreCollections = {
  players: `${collectionPrefix}players`,
  games: `${collectionPrefix}games`,
  awardDefinitions: `${collectionPrefix}awardDefinitions`,
  playerAwards: `${collectionPrefix}playerAwards`,
  primeSnapshots: `${collectionPrefix}primeSnapshots`,
} as const;
