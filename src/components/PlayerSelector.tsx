'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';

interface PlayerSelectorProps {
  selectedPlayers: string[];
  onPlayersChange: (players: string[]) => void;
  minPlayers?: number;
  maxPlayers?: number;
  exactCount?: number;
}

export default function PlayerSelector({
  selectedPlayers,
  onPlayersChange,
  minPlayers,
  maxPlayers,
  exactCount,
}: PlayerSelectorProps) {
  const { players, addPlayer } = useGameStore();
  const [newName, setNewName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  const filteredPlayers = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = (playerId: string) => {
    if (selectedPlayers.includes(playerId)) {
      onPlayersChange(selectedPlayers.filter((id) => id !== playerId));
    } else {
      if (exactCount && selectedPlayers.length >= exactCount) return;
      if (maxPlayers && selectedPlayers.length >= maxPlayers) return;
      onPlayersChange([...selectedPlayers, playerId]);
    }
  };

  const handleAddNew = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (players.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) return;
    const player = addPlayer(trimmed);
    onPlayersChange([...selectedPlayers, player.id]);
    setNewName('');
    setShowAdd(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold app-text-primary tracking-tight">
            Spieler auswählen
          </h3>
          {exactCount && (
            <p className="text-xs app-text-muted mt-0.5">
              {selectedPlayers.length} von {exactCount} ausgewählt
            </p>
          )}
          {minPlayers && !exactCount && (
            <p className="text-xs app-text-muted mt-0.5">
              {selectedPlayers.length} ausgewählt · mind. {minPlayers}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="link-accent text-xs font-semibold flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Neuer Spieler
        </button>
      </div>

      {showAdd && (
        <div className="flex gap-2 animate-fade-in-up">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddNew()}
            placeholder="Name eingeben..."
            className="input-glass flex-1 px-4 py-2.5 text-sm"
            autoFocus
          />
          <button
            onClick={handleAddNew}
            className="btn-primary px-5 py-2.5 text-sm"
          >
            Hinzufügen
          </button>
        </div>
      )}

      {players.length > 6 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Spieler suchen..."
          className="input-glass w-full px-4 py-2.5 text-sm"
        />
      )}

      <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
        {filteredPlayers.map((player) => {
          const isSelected = selectedPlayers.includes(player.id);
          const isDisabled =
            !isSelected &&
            ((exactCount && selectedPlayers.length >= exactCount) ||
              (maxPlayers && selectedPlayers.length >= maxPlayers));

          return (
            <button
              key={player.id}
              onClick={() => handleToggle(player.id)}
              disabled={!!isDisabled}
              className={`group relative flex items-center gap-2.5 px-3 py-3 rounded-2xl text-sm font-medium transition-all duration-300 ${
                isSelected
                  ? 'player-option-selected'
                  : isDisabled
                  ? 'player-option-disabled'
                  : 'glass-card player-option'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  isSelected
                    ? 'icon-well-active'
                    : 'icon-well'
                }`}
              >
                {player.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="truncate">{player.name}</span>
              {isSelected && (
                <svg className="w-4 h-4 ml-auto app-text-accent shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {filteredPlayers.length === 0 && (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-2xl surface-muted-weak flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 app-text-faint" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <p className="app-text-subtle text-sm">
            {players.length === 0
              ? 'Noch keine Spieler. Füge deinen ersten Spieler hinzu!'
              : 'Keine passenden Spieler gefunden.'}
          </p>
        </div>
      )}
    </div>
  );
}
