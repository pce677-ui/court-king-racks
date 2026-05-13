// ELO-inspired badminton ranking with close-match protection, upset bonus,
// and expected-win dampening.
//
// Inputs: ratings of two sides + scores. For doubles, use the average of the
// two partner ratings as the team rating, then split the delta evenly.

export type RankInput = {
  ratingA: number;
  ratingB: number;
  scoreA: number;
  scoreB: number;
};

export type RankOutput = {
  deltaA: number; // points change for side A (positive if A won)
  deltaB: number; // points change for side B
  expectedA: number;
  marginFactor: number;
  closeMatch: boolean;
};

const K_BASE = 32;

export function computeRankingDelta({ ratingA, ratingB, scoreA, scoreB }: RankInput): RankOutput {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;

  const winnerA = scoreA > scoreB;
  const high = Math.max(scoreA, scoreB);
  const low = Math.min(scoreA, scoreB);
  const diff = high - low;

  // Margin factor: bigger blowouts move points more. Capped at ~1.5x.
  // 21-19 (diff 2) → ~0.55, 21-15 → ~1.0, 21-5 → ~1.45.
  const marginFactor = Math.min(1.5, 0.4 + Math.log2(1 + diff) / 2.6);
  const closeMatch = diff <= 2 && high >= 19; // 21-19, 22-20, 30-29, etc.

  const actualA = winnerA ? 1 : 0;
  let deltaA = K_BASE * marginFactor * (actualA - expectedA);
  let deltaB = -deltaA;

  if (closeMatch) {
    // Close-match protection: shrink loser's loss to almost nothing,
    // and trim the winner's gain. Loser may even gain a tiny bit.
    if (winnerA) {
      deltaA = deltaA * 0.5; // winner gains less
      deltaB = Math.max(deltaB * 0.15, -2) + 1; // loser barely loses, may gain ~+1
    } else {
      deltaB = deltaB * 0.5;
      deltaA = Math.max(deltaA * 0.15, -2) + 1;
    }
  }

  // Round to 1 decimal
  return {
    deltaA: Math.round(deltaA * 10) / 10,
    deltaB: Math.round(deltaB * 10) / 10,
    expectedA,
    marginFactor,
    closeMatch,
  };
}

// Average two ratings into a team rating for doubles.
export function teamRating(r1: number, r2?: number | null): number {
  if (r2 == null) return r1;
  return (r1 + r2) / 2;
}