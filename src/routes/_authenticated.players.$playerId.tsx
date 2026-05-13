import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RankingChart } from "@/components/app/RankingChart";
import {
  computeStreaks,
  partnerChemistry,
  playerWon,
  type AnyMatch,
} from "@/lib/stats";
import { ArrowLeft, Flame, Snowflake } from "lucide-react";

export const Route = createFileRoute("/_authenticated/players/$playerId")({
  component: PlayerPage,
});

type Profile = {
  id: string;
  full_name: string;
  age: number | null;
  height_cm: number | null;
  ranking_points: number;
};

function PlayerPage() {
  const { playerId } = Route.useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matches, setMatches] = useState<AnyMatch[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const [{ data: prof }, { data: ms }, { data: ps }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,full_name,age,height_cm,ranking_points")
          .eq("id", playerId)
          .maybeSingle(),
        supabase
          .from("matches")
          .select(
            "id,match_type,played_at,team_a_p1,team_a_p2,team_b_p1,team_b_p2,winner_side,points_delta_a,points_delta_b,score_a,score_b",
          )
          .or(
            `team_a_p1.eq.${playerId},team_a_p2.eq.${playerId},team_b_p1.eq.${playerId},team_b_p2.eq.${playerId}`,
          )
          .order("played_at", { ascending: true }),
        supabase.from("profiles").select("id,full_name"),
      ]);
      setProfile((prof as Profile) ?? null);
      setMatches((ms as AnyMatch[]) ?? []);
      setNames(Object.fromEntries((ps ?? []).map((p) => [p.id, p.full_name])));
    })();
  }, [playerId]);

  const stats = useMemo(() => {
    let w = 0, l = 0, sw = 0, sl = 0, dw = 0, dl = 0;
    for (const m of matches) {
      const won = playerWon(m, playerId);
      if (won === null) continue;
      if (won) w++; else l++;
      if (m.match_type === "singles") (won ? sw++ : sl++);
      else (won ? dw++ : dl++);
    }
    const pct = (a: number, b: number) => (a + b ? Math.round((a / (a + b)) * 100) : 0);
    return { w, l, total: w + l, wr: pct(w, l), sWr: pct(sw, sl), dWr: pct(dw, dl) };
  }, [matches, playerId]);

  const streak = useMemo(() => computeStreaks(matches, playerId), [matches, playerId]);
  const chemistry = useMemo(() => partnerChemistry(matches, playerId), [matches, playerId]);

  if (!profile) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  const best = chemistry.filter((c) => c.matches >= 2).sort((a, b) => b.winRate - a.winRate)[0];
  const worst = chemistry.filter((c) => c.matches >= 2).sort((a, b) => a.winRate - b.winRate)[0];

  return (
    <div className="space-y-5">
      <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-3.5 h-3.5" /> Leaderboard
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{profile.full_name}</h1>
        <p className="text-sm text-muted-foreground">
          {profile.age ? `${profile.age} yrs` : "—"} ·{" "}
          {profile.height_cm ? `${profile.height_cm} cm` : "—"}
        </p>
      </div>

      <div
        className="rounded-2xl p-5 border border-border/60"
        style={{ background: "var(--gradient-surface)", boxShadow: "var(--shadow-glow)" }}
      >
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Points</div>
            <div className="text-4xl font-semibold mt-1 tabular-nums">
              {Math.round(profile.ranking_points)}
            </div>
          </div>
          <StreakBadge current={streak.current} />
        </div>
        <div className="mt-4">
          <RankingChart playerId={profile.id} currentPoints={profile.ranking_points} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Matches" value={stats.total} />
        <Stat label="Win rate" value={`${stats.wr}%`} accent />
        <Stat label="W / L" value={`${stats.w}/${stats.l}`} />
        <Stat label="Singles WR" value={`${stats.sWr}%`} />
        <Stat label="Doubles WR" value={`${stats.dWr}%`} />
        <Stat label="Best streak" value={streak.longestWin} />
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Doubles chemistry
        </h2>
        {chemistry.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-4 text-xs text-muted-foreground">
            No doubles matches yet.
          </div>
        ) : (
          <>
            {(best || worst) && (
              <div className="grid grid-cols-2 gap-3">
                {best && (
                  <Highlight
                    label="Best partner"
                    name={names[best.partnerId] ?? "—"}
                    sub={`${best.winRate}% over ${best.matches}`}
                    tone="good"
                  />
                )}
                {worst && worst.partnerId !== best?.partnerId && (
                  <Highlight
                    label="Toughest pairing"
                    name={names[worst.partnerId] ?? "—"}
                    sub={`${worst.winRate}% over ${worst.matches}`}
                    tone="bad"
                  />
                )}
              </div>
            )}
            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
              {chemistry.map((c) => (
                <Link
                  key={c.partnerId}
                  to="/players/$playerId"
                  params={{ playerId: c.partnerId }}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 last:border-0 hover:bg-primary/5 transition-colors"
                >
                  <span className="flex-1 truncate text-sm">{names[c.partnerId] ?? "—"}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {c.wins}W · {c.losses}L
                  </span>
                  <span className="w-12 text-right text-sm font-medium tabular-nums text-primary">
                    {c.winRate}%
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={"text-lg font-semibold mt-0.5 tabular-nums " + (accent ? "text-primary" : "")}>
        {value}
      </div>
    </div>
  );
}

function StreakBadge({ current }: { current: number }) {
  if (current === 0) return null;
  const win = current > 0;
  const Icon = win ? Flame : Snowflake;
  return (
    <div
      className={
        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium " +
        (win ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")
      }
    >
      <Icon className="w-3.5 h-3.5" />
      {Math.abs(current)} {win ? "win" : "loss"} streak
    </div>
  );
}

function Highlight({
  label,
  name,
  sub,
  tone,
}: {
  label: string;
  name: string;
  sub: string;
  tone: "good" | "bad";
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5 truncate">{name}</div>
      <div className={"text-[11px] mt-0.5 " + (tone === "good" ? "text-primary" : "text-muted-foreground")}>
        {sub}
      </div>
    </div>
  );
}