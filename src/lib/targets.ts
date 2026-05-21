// Per-player "goal" target system.
//
// Each player's target is the player ranked immediately above them on the
// leaderboard. If a player is #1, their target is #2 (defend the throne).
// Beating your target in a published match awards a bonus on top of the
// normal ranking delta.

export const TARGET_BONUS = 5;

export type RankedPlayer = {
  id: string;
  full_name: string;
  ranking_points: number;
};

/** Build a map of playerId -> targetPlayerId from a leaderboard-ordered list. */
export function buildTargetMap(ranked: RankedPlayer[]): Map<string, string> {
  const sorted = [...ranked].sort((a, b) => b.ranking_points - a.ranking_points);
  const map = new Map<string, string>();
  sorted.forEach((p, i) => {
    if (i === 0 && sorted[1]) map.set(p.id, sorted[1].id); // #1 defends vs #2
    else if (i > 0) map.set(p.id, sorted[i - 1].id);
  });
  return map;
}

export function getTargetFor(
  playerId: string,
  ranked: RankedPlayer[],
): RankedPlayer | null {
  const map = buildTargetMap(ranked);
  const targetId = map.get(playerId);
  if (!targetId) return null;
  return ranked.find((p) => p.id === targetId) ?? null;
}