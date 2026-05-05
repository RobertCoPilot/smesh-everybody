# Match Weighting Plan: ELO, Chemistry and Experience Across All Match Types

## Goal

Use every played format as signal for ELO, chemistry, rivalries, archetypes and future XP, while respecting that not every format should count equally.

A full proper 2vs2 match should matter more than a short Americano game. Big Americano should still count, because it is the format played most often, but each individual short game should have lower weight and be adjusted by playtime, score, opponent strength and match context.

## Match Types to Include

| Match type | Should count for ELO | Should count for chemistry | Suggested base weight |
| --- | ---: | ---: | ---: |
| 1vs1 full match | Yes | Player rivalry only | `0.75` |
| 2vs2 full match | Yes | Strong duo chemistry signal | `1.00` |
| 2vs2 tournament match | Yes | Strong duo chemistry signal | `1.10` |
| Americano Klein game | Yes, lightly | Medium duo chemistry signal | `0.35` |
| Americano Gross game | Yes, lightly/medium | Medium duo chemistry signal | `0.45` |
| Americano full tournament placement | Yes, aggregate bonus | Weak/moderate social signal | `0.25–0.50` |

Notes:
- A single Americano game should not swing ELO much.
- A full Americano session can matter after aggregating many games.
- Tournament matches can matter slightly more because pairing/opponent pressure is higher.

## Required Data Model Additions

Add timing fields to every scoreable match/game unit, not just top-level tournaments.

### Full 1vs1 / 2vs2

```ts
interface MatchTiming {
  startedAt?: string;
  completedAt?: string;
  durationSeconds?: number;
}
```

Add to:
- `Match1vs1`
- `Match2vs2`

### Tournament Match

Add timing to each `TournamentMatch`:

```ts
interface TournamentMatch {
  startedAt?: string;
  completedAt?: string;
  durationSeconds?: number;
}
```

### Americano Game

Add timing to each `AmericanoGame`:

```ts
interface AmericanoGame {
  startedAt?: string;
  completedAt?: string;
  durationSeconds?: number;
}
```

### Why timing matters

Playtime helps distinguish:
- quick warmup / blowout short games
- long close battles
- full proper matches
- low-signal short Americano rounds

If `durationSeconds` is missing, we can fall back to a format default.

## Derived Normalized Match Event

Before calculating ELO, chemistry or XP, convert every match format into a normalized event:

```ts
interface WeightedMatchEvent {
  id: string;
  sourceType: '1vs1' | '2vs2' | 'tournament' | 'americano-klein' | 'americano-gross';
  team1: string[];
  team2: string[];
  winner: 1 | 2;
  scoreForWinner: number;
  scoreForLoser: number;
  scoreDifference: number;
  durationSeconds: number | null;
  baseWeight: number;
  finalWeight: number;
}
```

All systems can consume this instead of scanning each format separately.

## Prototype Weight Formula

```txt
finalWeight = baseWeight
  × durationFactor
  × closenessFactor
  × scoreConfidenceFactor
  × opponentQualityFactor
  × recencyFactor
```

Clamp final result:

```txt
finalWeight = clamp(finalWeight, 0.10, 1.50)
```

## Formula Parts

### 1. Base Weight

Format importance before match-specific adjustments.

```txt
baseWeight:
  2vs2 full match        = 1.00
  tournament 2vs2 match  = 1.10
  1vs1 full match        = 0.75
  americano gross game   = 0.45
  americano klein game   = 0.35
```

### 2. Duration Factor

Longer games should count more, but not infinitely more.

```txt
durationFactor = clamp(durationMinutes / expectedMinutesForFormat, 0.50, 1.25)
```

Suggested expected durations:

```txt
2vs2 full match        = 60 min
1vs1 full match        = 45 min
tournament match       = 50 min
americano gross game   = 12 min
americano klein game   = 8 min
```

Example:
- 2vs2 full match, 75 min: `75 / 60 = 1.25`
- Americano gross, 6 min: `6 / 12 = 0.50`

### 3. Closeness Factor

Close matches should be more informative than blowouts.

```txt
closenessFactor = 1 + (1 - normalizedScoreDiff) × 0.20
```

Where:

```txt
normalizedScoreDiff = clamp(scoreDifference / expectedWinningScore, 0, 1)
```

Result range:
- very close match: up to `1.20`
- big blowout: near `1.00`

This rewards close battles without making blowouts worthless.

### 4. Score Confidence Factor

A decisive win still provides signal, especially if the score target is high.

```txt
scoreConfidenceFactor = clamp(totalPointsOrGames / expectedTotalScore, 0.70, 1.15)
```

Examples:
- A 21–20 Americano game has high confidence.
- A 7–2 unfinished/short game has lower confidence.
- A 6–0 6–0 full match has strong confidence but lower closeness.

### 5. Opponent Quality Factor

Beating stronger opponents should count more. Losing to much stronger players should hurt less.

```txt
opponentQualityFactor = clamp(1 + (opponentAvgElo - ownAvgElo) / 1000, 0.85, 1.15)
```

For winners:
- Underdog win gets boosted.
- Favorite win gets reduced slightly.

For losers, inverse logic can be used when applying negative ELO delta.

### 6. Recency Factor

Recent games matter more for dynamic systems like archetypes and activity, but ELO should not decay too aggressively.

```txt
recencyFactor = 1.00 for ELO
recencyFactor = clamp(1 - daysAgo / 365, 0.50, 1.00) for chemistry/form/archetypes
```

## Prototype ELO Formula

Start with existing ELO expected score calculation, but scale the K-factor by match weight.

```txt
expected = 1 / (1 + 10 ^ ((opponentAvgElo - ownAvgElo) / 400))
actual = 1 for winner, 0 for loser
weightedK = baseK × finalWeight
eloDelta = weightedK × (actual - expected)
```

Suggested `baseK`:

```txt
baseK = 32
```

Example:

```txt
Full 2vs2 match:
baseWeight = 1.00
durationFactor = 1.10
closenessFactor = 1.15
scoreConfidenceFactor = 1.05
opponentQualityFactor = 1.00
finalWeight = 1.33
weightedK = 32 × 1.33 = 42.6
```

Short Americano game:

```txt
baseWeight = 0.45
durationFactor = 0.70
closenessFactor = 1.10
scoreConfidenceFactor = 0.90
opponentQualityFactor = 1.00
finalWeight = 0.31
weightedK = 32 × 0.31 = 9.9
```

So one short Americano game moves ELO only lightly, but ten Americano games across a session still create meaningful signal.

## Prototype Chemistry Formula

Chemistry should use team-based events only: 2vs2, tournament 2vs2 and Americano pairings.

```txt
chemistryDelta = finalWeight
  × resultMultiplier
  × scoreDifferentialMultiplier
```

```txt
resultMultiplier:
  win  = +4
  loss = +1
```

Even losing together can build chemistry through shared playtime, but winning builds it faster.

```txt
scoreDifferentialMultiplier = clamp(1 + winnerScoreDiff / expectedWinningScore, 0.75, 1.25)
```

Long-term chemistry score:

```txt
chemistryScore = clamp(
  35
  + weightedMatchesPlayed × 4
  + weightedWinRateBonus
  + weightedScoreDifferentialBonus,
  0,
  100
)
```

Where:

```txt
weightedWinRateBonus = (weightedWinRate - 0.5) × 40
weightedScoreDifferentialBonus = clamp(weightedScoreDiff, -25, 25) × 0.8
```

## XP Formula Sketch

XP can be more generous than ELO because it is progression, not skill rating.

```txt
xp = 20
  + 30 × finalWeight
  + 10 × setsOrRoundsPlayed
  + winBonus
  + closeMatchBonus
```

```txt
winBonus = 15 × finalWeight
closeMatchBonus = closenessFactor > 1.15 ? 10 : 0
```

Americano games should grant small XP each, with a session completion bonus.

## Handling New / Weaker Players

New players need protection from wild swings and should still progress.

Suggested rules:
- First 5 weighted matches use provisional ELO.
- ELO delta is capped for new players.
- XP is not capped; participation should feel rewarding.
- Chemistry can grow normally even with new players.

```txt
newPlayerEloCap = 18 per event
provisionalKMultiplier = 1.25 until 5 weighted matches
```

This lets the system learn faster, without punishing beginners too harshly.

## Migration / Backfill Plan

1. Add optional timing fields to types.
2. Start writing `startedAt` when first score is added.
3. Write `completedAt` and `durationSeconds` when status becomes completed.
4. For historical games without timing, use format defaults.
5. Build `deriveWeightedMatchEvents(games, players)`.
6. Move ELO, chemistry, rivalry and archetype engines to consume weighted events.
7. Add tests for each match type and weighting edge case.

## Open Questions

- Should Americano tournament placement give an extra ELO bonus, or only individual games?
- Should 1vs1 affect 2vs2 ELO equally, or use one unified player ELO?
- Should beginners have separate confidence/provisional badges?
- Should forfeits or manually finished matches get reduced weight?
- Should duration be editable if someone forgets to start/stop scoring properly?
