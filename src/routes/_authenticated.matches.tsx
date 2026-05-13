import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/matches")({
  component: MatchesPage,
});

type MatchRow = {
  id: string;
  match_type: "singles" | "doubles";
  played_at: string;
  score_a: number;
  score_b: number;
  winner_side: "A" | "B";
  points_delta_a: number;
  points_delta_b: number;
  notes: string | null;
  team_a_p1: string;
  team_a_p2: string | null;
  team_b_p1: string;
  team_b_p2: string | null;
};

function MatchesPage() {
  const { isAdmin } = useAuth();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data: m }, { data: p }] = await Promise.all([
      supabase.from("matches").select("*").order("played_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("id,full_name"),
    ]);
    setMatches((m as MatchRow[]) ?? []);
    setNames(Object.fromEntries((p ?? []).map((x) => [x.id, x.full_name])));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("matches-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const remove = async (id: string) => {
    if (!confirm("Delete this match? Ranking points won't be recalculated.")) return;
    const { error } = await supabase.from("matches").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Match deleted");
  };

  const team = (p1: string, p2: string | null) =>
    p2 ? `${names[p1] ?? "?"} & ${names[p2] ?? "?"}` : names[p1] ?? "?";

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Matches</h1>
          <p className="text-sm text-muted-foreground">All recorded games, newest first.</p>
        </div>
        {isAdmin && (
          <Link to="/matches/new">
            <Button size="sm" className="rounded-full">
              <Plus className="w-4 h-4 mr-1" /> New
            </Button>
          </Link>
        )}
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!loading && matches.length === 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
          No matches yet.
          {isAdmin && " Tap New to record the first one."}
        </div>
      )}

      <div className="space-y-2">
        {matches.map((m) => {
          const winA = m.winner_side === "A";
          return (
            <div key={m.id} className="rounded-xl border border-border/60 bg-card p-3">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
                <span>
                  {m.match_type} · {format(new Date(m.played_at), "MMM d, HH:mm")}
                </span>
                {isAdmin && (
                  <button
                    onClick={() => remove(m.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Delete match"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className={winA ? "font-semibold" : "text-muted-foreground"}>
                  {team(m.team_a_p1, m.team_a_p2)}
                  <div className="text-[11px] text-muted-foreground font-normal">
                    {m.points_delta_a > 0 ? "+" : ""}
                    {m.points_delta_a} pts
                  </div>
                </div>
                <div className="text-lg font-mono tabular-nums px-2">
                  <span className={winA ? "text-primary" : ""}>{m.score_a}</span>
                  <span className="text-muted-foreground mx-1">:</span>
                  <span className={!winA ? "text-primary" : ""}>{m.score_b}</span>
                </div>
                <div className={"text-right " + (!winA ? "font-semibold" : "text-muted-foreground")}>
                  {team(m.team_b_p1, m.team_b_p2)}
                  <div className="text-[11px] text-muted-foreground font-normal">
                    {m.points_delta_b > 0 ? "+" : ""}
                    {m.points_delta_b} pts
                  </div>
                </div>
              </div>
              {m.notes && <p className="mt-2 text-xs text-muted-foreground">{m.notes}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}