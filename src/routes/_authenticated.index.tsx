import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Trophy, Crown, Medal, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { LeaderboardChart } from "@/components/app/LeaderboardChart";

export const Route = createFileRoute("/_authenticated/")({
  component: Leaderboard,
});

type Row = {
  id: string;
  full_name: string;
  ranking_points: number;
  wins: number;
  losses: number;
  trend: number; // sum of last up-to-3 deltas
};

function Leaderboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,full_name,ranking_points")
      .order("ranking_points", { ascending: false });
    const { data: matches } = await supabase
      .from("matches")
      .select("team_a_p1,team_a_p2,team_b_p1,team_b_p2,winner_side")
      .eq("status", "published");
    const { data: history } = await supabase
      .from("ranking_history")
      .select("player_id,delta,created_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    const trends = new Map<string, number[]>();
    history?.forEach((h) => {
      const arr = trends.get(h.player_id) ?? [];
      if (arr.length < 3) arr.push(Number(h.delta));
      trends.set(h.player_id, arr);
    });
    const stats = new Map<string, { w: number; l: number }>();
    matches?.forEach((m) => {
      const a = [m.team_a_p1, m.team_a_p2].filter(Boolean) as string[];
      const b = [m.team_b_p1, m.team_b_p2].filter(Boolean) as string[];
      const winners = m.winner_side === "A" ? a : b;
      const losers = m.winner_side === "A" ? b : a;
      winners.forEach((p) => {
        const s = stats.get(p) ?? { w: 0, l: 0 };
        s.w += 1;
        stats.set(p, s);
      });
      losers.forEach((p) => {
        const s = stats.get(p) ?? { w: 0, l: 0 };
        s.l += 1;
        stats.set(p, s);
      });
    });
    setRows(
      (profiles ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        ranking_points: Number(p.ranking_points),
        wins: stats.get(p.id)?.w ?? 0,
        losses: stats.get(p.id)?.l ?? 0,
        trend: (trends.get(p.id) ?? []).reduce((a, b) => a + b, 0),
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("leaderboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
          <p className="text-sm text-muted-foreground">Live ranking, updates after every match.</p>
        </div>
        <Trophy className="w-5 h-5 text-primary" />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        {loading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
        {!loading && rows.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No players yet. Invite your friends to sign up.
          </div>
        )}
        {rows.map((r, i) => {
          const total = r.wins + r.losses;
          const wr = total ? Math.round((r.wins / total) * 100) : 0;
          const isMe = r.id === user?.id;
          const trendUp = r.trend > 0.5;
          const trendDown = r.trend < -0.5;
          return (
            <Link
              key={r.id}
              to="/players/$playerId"
              params={{ playerId: r.id }}
              style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
              className={cn(
                "flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-0 hover:bg-primary/5 hover:pl-5 animate-row-in",
                isMe && "bg-primary/5",
              )}
            >
              <div className="w-8 text-center font-mono text-sm text-muted-foreground flex items-center justify-center">
                {i === 0 ? (
                  <Crown className="w-5 h-5 text-primary" />
                ) : i === 1 ? (
                  <Medal className="w-4 h-4 text-accent" />
                ) : i === 2 ? (
                  <Medal className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{r.full_name}</span>
                  {isMe && (
                    <span className="text-[10px] uppercase tracking-wider text-primary">you</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.wins}W · {r.losses}L · {wr}% WR
                </div>
              </div>
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-medium tabular-nums px-1.5 py-0.5 rounded-md",
                  trendUp && "text-emerald-600 bg-emerald-500/10",
                  trendDown && "text-red-600 bg-red-500/10",
                  !trendUp && !trendDown && "text-muted-foreground",
                )}
                title="Sum of last 3 ranking changes"
              >
                {trendUp ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : trendDown ? (
                  <TrendingDown className="w-3.5 h-3.5" />
                ) : (
                  <Minus className="w-3.5 h-3.5" />
                )}
                <span>
                  {r.trend > 0 ? "+" : ""}
                  {Math.round(r.trend)}
                </span>
              </div>
              <div className="text-right">
                <div className="font-semibold tabular-nums">
                  {Math.round(r.ranking_points)}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  pts
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {!loading && rows.length > 0 && (
        <section className="rounded-2xl border border-border/60 bg-card p-4 space-y-2">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Ranking progression</h2>
              <p className="text-[11px] text-muted-foreground">Top 7 players over time</p>
            </div>
          </div>
          <LeaderboardChart players={rows} />
        </section>
      )}
    </div>
  );
}