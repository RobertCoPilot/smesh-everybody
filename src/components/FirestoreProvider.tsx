'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { firestoreCollections } from '@/lib/firestoreCollections';
import { db } from '@/lib/firebase';
import { useGameStore } from '@/store/gameStore';
import type { Player, GameRecord } from '@/types';

export default function FirestoreProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let playersReady = false;
    let gamesReady = false;

    const done = () => {
      if (playersReady && gamesReady) setLoaded(true);
    };

    const unsubPlayers = onSnapshot(
      collection(db, firestoreCollections.players),
      (snap) => {
        useGameStore.getState()._setPlayers(
          snap.docs.map((d) => d.data() as Player)
        );
        playersReady = true;
        done();
      },
      (err) => setError(err.message)
    );

    const unsubGames = onSnapshot(
      collection(db, firestoreCollections.games),
      (snap) => {
        useGameStore.getState()._setGames(
          snap.docs.map((d) => d.data() as GameRecord)
        );
        gamesReady = true;
        done();
      },
      (err) => setError(err.message)
    );

    return () => {
      unsubPlayers();
      unsubGames();
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-4">⚡</div>
          <p className="text-red-400 text-sm font-medium mb-2">Verbindungsfehler</p>
          <p className="app-text-subtle text-xs max-w-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[var(--league-accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="app-text-muted text-sm">Daten werden geladen...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
