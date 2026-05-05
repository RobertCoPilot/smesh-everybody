const collectionPrefix = process.env.NEXT_PUBLIC_FIRESTORE_COLLECTION_PREFIX ?? '';

export const firestoreCollections = {
  players: `${collectionPrefix}players`,
  games: `${collectionPrefix}games`,
  awardDefinitions: `${collectionPrefix}awardDefinitions`,
  playerAwards: `${collectionPrefix}playerAwards`,
  primeSnapshots: `${collectionPrefix}primeSnapshots`,
  chemistrySummaries: `${collectionPrefix}chemistrySummaries`,
  rivalrySummaries: `${collectionPrefix}rivalrySummaries`,
  playerArchetypes: `${collectionPrefix}playerArchetypes`,
  teamBalancePreviews: `${collectionPrefix}teamBalancePreviews`,
} as const;
