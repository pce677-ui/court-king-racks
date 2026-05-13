import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/me")({
  component: MePage,
});

type Match = {
  id: string;
  match_type: "singles" | "doubles";
  team_a_p1: string;
  team_a_p2: string | null;
  team_b_p1: string;
  team_b_p2: string | null;
  winner_side: "A" | "B";
  points_delta_a: number;
  points_delta_b: number;
};

function MePage() {
  const { user, profile, refresh } = useAuth();
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAge(profile?.age?.toString() ?? "");
    setHeight(profile?.height_cm?.toString() ?? "");
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("matches")
      .select("id,match_type,team_a_p1,team_a_p2,team_b_p1,team_b_p2,winner_side,points_delta_a,points_delta_b")
      .or(
        `team_a_p1.eq.${user.id},team_a_p2.eq.${user.id},team_b_p1.eq.${user.id},team_b_p2.eq.${user.id}`,
      )
      .then(({ data }) => setMatches((data as Match[]) ?? []));
  }, [user]);

  const stats = useMemo(() => {
    if (!user) return null;
    let w = 0, l = 0, sw = 0, sl = 0, dw = 0, dl = 0;
    for (const m of matches) {
      const onA = m.team_a_p1 === user.id || m.team_a_p2 === user.id;
      const won = (onA && m.winner_side === "A") || (!onA && m.winner_side === "B");
      if (won) w++; else l++;
      if (m.match_type === "singles") {
        if (won) sw++; else sl++;
      } else {
        if (won) dw++; else dl++;
      }
    }
    const pct = (a: number, b: number) => (a + b ? Math.round((a / (a + b)) * 100) : 0);
    return {
      total: w + l,
      w, l,
      wr: pct(w, l),
      singlesWr: pct(sw, sl),
      doublesWr: pct(dw, dl),
    };
  }, [matches, user]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        age: age ? Number(age) : null,
        height_cm: height ? Number(height) : null,
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    refresh();
  };

  if (!profile) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{profile.full_name}</h1>
        <p className="text-sm text-muted-foreground">Your stats and profile.</p>
      </div>

      <div className="rounded-2xl p-5 border border-border/60" style={{ background: "var(--gradient-surface)", boxShadow: "var(--shadow-glow)" }}>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Ranking points</div>
        <div className="text-4xl font-semibold mt-1 tabular-nums">
          {Math.round(profile.ranking_points)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Matches" value={stats?.total ?? 0} />
        <Stat label="Win rate" value={`${stats?.wr ?? 0}%`} />
        <Stat label="Wins" value={stats?.w ?? 0} accent />
        <Stat label="Losses" value={stats?.l ?? 0} />
        <Stat label="Singles WR" value={`${stats?.singlesWr ?? 0}%`} />
        <Stat label="Doubles WR" value={`${stats?.doublesWr ?? 0}%`} />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
        <h2 className="font-medium">Profile</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="age">Age</Label>
            <Input id="age" inputMode="numeric" type="number" value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h">Height (cm)</Label>
            <Input id="h" inputMode="numeric" type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
          </div>
        </div>
        <Button onClick={save} disabled={busy} className="w-full">
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={"text-xl font-semibold mt-0.5 tabular-nums " + (accent ? "text-primary" : "")}>
        {value}
      </div>
    </div>
  );
}