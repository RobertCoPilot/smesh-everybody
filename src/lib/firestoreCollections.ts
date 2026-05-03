export const firestoreCollections = {
  // Production collections are intentionally kept here for reference only.
  // DO NOT use them from this fork/local development unless you explicitly intend
  // to read/write production data.
  // players: 'players',
  // games: 'games',

  // Development collections copied from production on 2026-05-02.
  players: 'dev_players',
  games: 'dev_games',
} as const;
