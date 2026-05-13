import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { computeRankingDelta, teamRating } from "@/lib/ranking";

export const Route = createFileRoute("/_authenticated/matches/new")({
  component: NewMatch,
});

type Player = { id: string; full_name: string; ranking_points: number };

function NewMatch() {
  const { isAdmin, user } = useAuth();
  const nav = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [type, setType] = useState<"singles" | "doubles">("singles");
  const [a1, setA1] = useState<string>("");
  const [a2, setA2] = useState<string>("");
  const [b1, setB1] = useState<string>("");
  const [b2, setB2] = useState<string>("");
  const [scoreA, setScoreA] = useState("21");
  const [scoreB, setScoreB] = useState("19");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id,full_name,ranking_points")
      .order("full_name")
      .then(({ data }) => setPlayers((data as Player[]) ?? []));
  }, []);

  const byId = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);

  const preview = useMemo(() => {
    if (!a1 || !b1) return null;
    if (type === "doubles" && (!a2 || !b2)) return null;
    const sA = Number(scoreA);
    const sB = Number(scoreB);
    if (Number.isNaN(sA) || Number.isNaN(sB) || sA === sB) return null;
    const rA = teamRating(byId[a1]?.ranking_points ?? 1000, type === "doubles" ? byId[a2]?.ranking_points : null);
    const rB = teamRating(byId[b1]?.ranking_points ?? 1000, type === "doubles" ? byId[b2]?.ranking_points : null);
    return computeRankingDelta({ ratingA: rA, ratingB: rB, scoreA: sA, scoreB: sB });
  }, [a1, a2, b1, b2, scoreA, scoreB, type, byId]);

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
        Only admins can record matches.
      </div>
    );
  }

  const validate = (): string | null => {
    if (!a1 || !b1) return "Pick both sides";
    if (type === "doubles" && (!a2 || !b2)) return "Pick all four players";
    const all = [a1, b1, ...(type === "doubles" ? [a2, b2] : [])];
    if (new Set(all).size !== all.length) return "A player can't appear twice";
    const sA = Number(scoreA);
    const sB = Number(scoreB);
    if (Number.isNaN(sA) || Number.isNaN(sB) || sA < 0 || sB < 0) return "Invalid scores";
    if (sA === sB) return "Scores can't tie";
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) return toast.error(err);
    if (!preview) return;
    setBusy(true);
    const sA = Number(scoreA);
    const sB = Number(scoreB);
    const winner: "A" | "B" = sA > sB ? "A" : "B";

    // Insert match
    const { data: match, error: insErr } = await supabase
      .from("matches")
      .insert({
        match_type: type,
        team_a_p1: a1,
        team_a_p2: type === "doubles" ? a2 : null,
        team_b_p1: b1,
        team_b_p2: type === "doubles" ? b2 : null,
        score_a: sA,
        score_b: sB,
        winner_side: winner,
        points_delta_a: preview.deltaA,
        points_delta_b: preview.deltaB,
        notes: notes.trim() || null,
        created_by: user?.id,
      })
      .select()
      .single();

    if (insErr || !match) {
      setBusy(false);
      return toast.error(insErr?.message ?? "Could not save match");
    }

    // Update each player's points + write ranking history
    const sideAPlayers = [a1, ...(type === "doubles" ? [a2] : [])];
    const sideBPlayers = [b1, ...(type === "doubles" ? [b2] : [])];
    const updates: Promise<unknown>[] = [];

    const apply = (pid: string, delta: number) => {
      const before = byId[pid].ranking_points;
      const after = before + delta;
      updates.push(
        supabase.from("profiles").update({ ranking_points: after }).eq("id", pid),
      );
      updates.push(
        supabase.from("ranking_history").insert({
          player_id: pid,
          match_id: match.id,
          points_before: before,
          points_after: after,
          delta,
        }),
      );
    };
    sideAPlayers.forEach((p) => apply(p, preview.deltaA));
    sideBPlayers.forEach((p) => apply(p, preview.deltaB));

    await Promise.all(updates);
    setBusy(false);
    toast.success("Match recorded");
    nav({ to: "/matches" });
  };

  const renderPlayerSelect = (
    value: string,
    set: (v: string) => void,
    placeholder: string,
    exclude: string[],
  ) => (
    <Select value={value} onValueChange={set}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {players
          .filter((p) => !exclude.includes(p.id) || p.id === value)
          .map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.full_name} · {Math.round(p.ranking_points)}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );

  const used = (skip: string) =>
    [a1, a2, b1, b2].filter((x) => x && x !== skip) as string[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New match</h1>
        <p className="text-sm text-muted-foreground">Record a result. Ranking updates instantly.</p>
      </div>

      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-border/60 bg-card p-5">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as "singles" | "doubles")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="singles">Singles</SelectItem>
              <SelectItem value="doubles">Doubles</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-primary">Side A</Label>
            {renderPlayerSelect(a1, setA1, "Player 1", used(a1))}
            {type === "doubles" && renderPlayerSelect(a2, setA2, "Player 2", used(a2))}
            <Input
              inputMode="numeric"
              type="number"
              min={0}
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              className="text-2xl h-14 text-center font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label>Side B</Label>
            {renderPlayerSelect(b1, setB1, "Player 1", used(b1))}
            {type === "doubles" && renderPlayerSelect(b2, setB2, "Player 2", used(b2))}
            <Input
              inputMode="numeric"
              type="number"
              min={0}
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              className="text-2xl h-14 text-center font-mono"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Comeback from 5-15…"
            rows={2}
          />
        </div>

        {preview && (
          <div className="rounded-xl bg-muted/40 border border-border/60 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Predicted change</span>
              {preview.closeMatch && (
                <span className="text-[10px] uppercase tracking-wider text-primary">
                  close-match protected
                </span>
              )}
            </div>
            <div className="mt-1 flex justify-between font-mono">
              <span>
                A: {preview.deltaA > 0 ? "+" : ""}
                {preview.deltaA}
              </span>
              <span>
                B: {preview.deltaB > 0 ? "+" : ""}
                {preview.deltaB}
              </span>
            </div>
          </div>
        )}

        <Button type="submit" className="w-full h-11" disabled={busy}>
          {busy ? "Saving…" : "Record match"}
        </Button>
      </form>
    </div>
  );
}