export type AnyMatch = {
  id: string;
  match_type: "singles" | "doubles";
  played_at: string;
  team_a_p1: string;
  team_a_p2: string | null;
  team_b_p1: string;
  team_b_p2: string | null;
  winner_side: "A" | "B";
  points_delta_a: number;
  points_delta_b: number;
  score_a: number;
  score_b: number;
};

export function playerSide(m: AnyMatch, uid: string): "A" | "B" | null {
  if (m.team_a_p1 === uid || m.team_a_p2 === uid) return "A";
  if (m.team_b_p1 === uid || m.team_b_p2 === uid) return "B";
  return null;
}

export function playerWon(m: AnyMatch, uid: string): boolean | null {
  const side = playerSide(m, uid);
  if (!side) return null;
  return side === m.winner_side;
}

export function partnerOf(m: AnyMatch, uid: string): string | null {
  if (m.match_type !== "doubles") return null;
  if (m.team_a_p1 === uid) return m.team_a_p2;
  if (m.team_a_p2 === uid) return m.team_a_p1;
  if (m.team_b_p1 === uid) return m.team_b_p2;
  if (m.team_b_p2 === uid) return m.team_b_p1;
  return null;
}

export function opponentsOf(m: AnyMatch, uid: string): string[] {
  const side = playerSide(m, uid);
  if (!side) return [];
  const opp = side === "A"
    ? [m.team_b_p1, m.team_b_p2]
    : [m.team_a_p1, m.team_a_p2];
  return opp.filter(Boolean) as string[];
}

export type StreakInfo = {
  current: number; // positive = win streak, negative = loss streak
  longestWin: number;
  longestLoss: number;
};

/** matches assumed sorted oldest -> newest */
export function computeStreaks(matches: AnyMatch[], uid: string): StreakInfo {
  let longestWin = 0;
  let longestLoss = 0;
  let runWin = 0;
  let runLoss = 0;
  let current = 0;
  for (const m of matches) {
    const won = playerWon(m, uid);
    if (won === null) continue;
    if (won) {
      runWin += 1;
      runLoss = 0;
      longestWin = Math.max(longestWin, runWin);
      current = current >= 0 ? current + 1 : 1;
    } else {
      runLoss += 1;
      runWin = 0;
      longestLoss = Math.max(longestLoss, runLoss);
      current = current <= 0 ? current - 1 : -1;
    }
  }
  return { current, longestWin, longestLoss };
}

export type PartnerStat = {
  partnerId: string;
  matches: number;
  wins: number;
  losses: number;
  winRate: number; // 0..100
};

export function partnerChemistry(matches: AnyMatch[], uid: string): PartnerStat[] {
  const map = new Map<string, PartnerStat>();
  for (const m of matches) {
    const partner = partnerOf(m, uid);
    if (!partner) continue;
    const won = playerWon(m, uid);
    if (won === null) continue;
    const s = map.get(partner) ?? { partnerId: partner, matches: 0, wins: 0, losses: 0, winRate: 0 };
    s.matches += 1;
    if (won) s.wins += 1; else s.losses += 1;
    s.winRate = Math.round((s.wins / s.matches) * 100);
    map.set(partner, s);
  }
  return Array.from(map.values()).sort((a, b) => b.matches - a.matches);
}

export type OpponentStat = {
  opponentId: string;
  matches: number;
  wins: number;
  losses: number;
  winRate: number; // 0..100 from this player's perspective
};

export function opponentRecord(matches: AnyMatch[], uid: string): OpponentStat[] {
  const map = new Map<string, OpponentStat>();
  for (const m of matches) {
    const won = playerWon(m, uid);
    if (won === null) continue;
    for (const opp of opponentsOf(m, uid)) {
      const s = map.get(opp) ?? { opponentId: opp, matches: 0, wins: 0, losses: 0, winRate: 0 };
      s.matches += 1;
      if (won) s.wins += 1; else s.losses += 1;
      s.winRate = Math.round((s.wins / s.matches) * 100);
      map.set(opp, s);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.matches - a.matches);
}