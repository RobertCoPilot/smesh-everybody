'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { useGameStore } from '@/store/gameStore';
import {
  DEFAULT_COSMETIC_PACK,
  DEFAULT_COSMETICS,
  createRewardWallet,
  deriveRewardWalletsFromMatches,
  openCosmeticPack,
  purchaseCosmetic,
  type CosmeticDefinition,
  type PlayerCosmeticInventoryItem,
  type RewardWallet,
} from '@/lib/phase4Rewards';

function rarityClass(rarity: CosmeticDefinition['rarity']): string {
  if (rarity === 'legendary') return 'border-orange-400/60 bg-orange-500/10 app-text-accent';
  if (rarity === 'epic') return 'border-fuchsia-400/50 bg-fuchsia-500/10 app-text-primary';
  if (rarity === 'rare') return 'border-sky-400/50 bg-sky-500/10 app-text-primary';
  return 'border-theme-weak bg-theme-soft app-text-muted';
}

export default function RewardsPage() {
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const players = useGameStore((state) => state.players);
  const games = useGameStore((state) => state.games);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [sessionWallets, setSessionWallets] = useState<Record<string, RewardWallet>>({});
  const [sessionInventory, setSessionInventory] = useState<PlayerCosmeticInventoryItem[]>([]);
  const [lastPackRewards, setLastPackRewards] = useState<CosmeticDefinition[]>([]);
  const [message, setMessage] = useState('');

  const derivedWallets = useMemo(() => {
    if (!hydrated) return new Map<string, RewardWallet>();
    return deriveRewardWalletsFromMatches(players, games);
  }, [hydrated, players, games]);

  const selectedPlayer = players.find((player) => player.id === (selectedPlayerId || players[0]?.id));
  const wallet = selectedPlayer
    ? sessionWallets[selectedPlayer.id] ?? derivedWallets.get(selectedPlayer.id) ?? createRewardWallet(selectedPlayer.id)
    : null;
  const inventory = selectedPlayer ? sessionInventory.filter((item) => item.playerId === selectedPlayer.id) : [];

  const saveWallet = (nextWallet: RewardWallet) => {
    setSessionWallets((current) => ({ ...current, [nextWallet.playerId]: nextWallet }));
  };

  const handleBuy = (cosmetic: CosmeticDefinition) => {
    if (!wallet) return;
    setMessage('');
    try {
      const result = purchaseCosmetic({ wallet, inventory: sessionInventory, cosmetic });
      saveWallet(result.wallet);
      setSessionInventory(result.inventory);
      setMessage(`${cosmetic.name} gekauft.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Kauf fehlgeschlagen.');
    }
  };

  const handleOpenPack = () => {
    if (!wallet) return;
    setMessage('');
    try {
      const result = openCosmeticPack({
        wallet,
        inventory: sessionInventory,
        openingId: `${wallet.playerId}-${Date.now()}`,
      });
      saveWallet(result.wallet);
      setSessionInventory(result.inventory);
      setLastPackRewards(result.rewards);
      setMessage(`${DEFAULT_COSMETIC_PACK.name} geöffnet.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Pack konnte nicht geöffnet werden.');
    }
  };

  if (!hydrated) return null;

  return (
    <div className="p-4 pt-6 pb-24 animate-fade-in">
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] app-text-accent">Phase 4</p>
        <h1 className="text-3xl font-bold gradient-text">Rewards</h1>
        <p className="mt-2 text-sm app-text-muted">Coins entstehen nur durch Match-History. Packs und Cosmetics sind rein kosmetisch.</p>
      </div>

      <div className="glass-card-static rounded-2xl p-4 mb-5">
        <label className="text-xs font-semibold uppercase tracking-wider app-text-muted">Spieler</label>
        <select
          value={selectedPlayer?.id ?? ''}
          onChange={(event) => setSelectedPlayerId(event.target.value)}
          className="input-glass mt-2 w-full px-4 py-3"
        >
          {players.map((player) => (
            <option key={player.id} value={player.id}>{player.name}</option>
          ))}
        </select>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-theme-soft p-3">
            <p className="text-xl font-black app-text-primary">🪙 {wallet?.balance ?? 0}</p>
            <p className="text-[0.65rem] app-text-muted uppercase">Coins</p>
          </div>
          <div className="rounded-xl bg-theme-soft p-3">
            <p className="text-xl font-black app-text-primary">{wallet?.transactions.length ?? 0}</p>
            <p className="text-[0.65rem] app-text-muted uppercase">Transaktionen</p>
          </div>
          <div className="rounded-xl bg-theme-soft p-3">
            <p className="text-xl font-black app-text-primary">{inventory.length}</p>
            <p className="text-[0.65rem] app-text-muted uppercase">Owned</p>
          </div>
        </div>
      </div>

      {message && <p className="mb-4 rounded-xl border border-theme-weak bg-theme-soft p-3 text-sm app-text-muted">{message}</p>}

      <section className="mb-6 glass-card-static rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold app-text-primary">Pack Opening</h2>
            <p className="text-xs app-text-muted">{DEFAULT_COSMETIC_PACK.slots} kosmetische Rewards · replay-safe via Opening-ID</p>
          </div>
          <button onClick={handleOpenPack} disabled={!wallet || wallet.balance < DEFAULT_COSMETIC_PACK.cost} className="btn-primary px-4 py-2 text-sm disabled:opacity-40">
            {DEFAULT_COSMETIC_PACK.cost} 🪙
          </button>
        </div>
        {lastPackRewards.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {lastPackRewards.map((reward, index) => (
              <div key={`${reward.id}-${index}`} className={`rounded-xl border p-3 text-center ${rarityClass(reward.rarity)}`}>
                <p className="text-xs font-black uppercase">{reward.rarity}</p>
                <p className="mt-1 text-sm font-bold">{reward.label ?? '✨'} {reward.name}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-bold app-text-primary">Cosmetic Shop</h2>
        <div className="grid grid-cols-2 gap-3">
          {DEFAULT_COSMETICS.map((cosmetic) => {
            const owned = inventory.some((item) => item.cosmeticId === cosmetic.id);
            return (
              <div key={cosmetic.id} className={`rounded-2xl border p-4 ${rarityClass(cosmetic.rarity)}`}>
                <p className="text-[0.65rem] font-black uppercase tracking-wider">{cosmetic.rarity} · {cosmetic.type}</p>
                <p className="mt-1 font-bold app-text-primary">{cosmetic.label ?? '🎴'} {cosmetic.name}</p>
                <button
                  onClick={() => handleBuy(cosmetic)}
                  disabled={owned || !wallet || wallet.balance < cosmetic.price}
                  className="mt-3 w-full rounded-xl border border-theme-weak bg-theme-soft px-3 py-2 text-xs font-bold app-text-primary disabled:opacity-40"
                >
                  {owned ? 'Owned' : `${cosmetic.price} 🪙`}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="glass-card-static rounded-2xl p-4">
        <h2 className="mb-3 text-lg font-bold app-text-primary">Audit Trail</h2>
        <div className="space-y-2">
          {(wallet?.transactions.slice().reverse() ?? []).slice(0, 8).map((tx) => (
            <div key={tx.id} className="flex items-center justify-between gap-3 rounded-xl bg-theme-soft p-3 text-xs">
              <span className="app-text-muted">{tx.reason} · {tx.sourceId}</span>
              <span className={tx.amount >= 0 ? 'app-text-accent font-bold' : 'app-text-primary font-bold'}>{tx.amount > 0 ? '+' : ''}{tx.amount}</span>
            </div>
          ))}
          {wallet?.transactions.length === 0 && <p className="text-sm app-text-faint">Noch keine Match-Rewards.</p>}
        </div>
      </section>
    </div>
  );
}
