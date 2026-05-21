import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { computeRankingDelta, teamRating } from "@/lib/ranking";
import { buildTargetMap, TARGET_BONUS } from "@/lib/targets";
import { X, GripVertical, Search } from "lucide-react";

type Player = { id: string; full_name: string; ranking_points: number };
type SlotKey = "a1" | "a2" | "b1" | "b2";
type MatchStatus = "draft" | "published";

type Existing = {
  id: string;
  match_type: "singles" | "doubles";
  team_a_p1: string; team_a_p2: string | null;
  team_b_p1: string; team_b_p2: string | null;
  score_a: number; score_b: number;
  notes: string | null;
  status: MatchStatus;
};

export function MatchForm({
  existing,
  onDone,
}: {
  existing?: Existing;
  onDone: (status: MatchStatus) => void;
}) {
  const { user } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [type, setType] = useState<"singles" | "doubles">(existing?.match_type ?? "singles");
  const [slots, setSlots] = useState<Record<SlotKey, string>>({
    a1: existing?.team_a_p1 ?? "",
    a2: existing?.team_a_p2 ?? "",
    b1: existing?.team_b_p1 ?? "",
    b2: existing?.team_b_p2 ?? "",
  });
  const [scoreA, setScoreA] = useState(String(existing?.score_a ?? "21"));
  const [scoreB, setScoreB] = useState(String(existing?.score_b ?? "19"));
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [busy, setBusy] = useState<null | "draft" | "publish">(null);
  const [query, setQuery] = useState("");
  const [dragOver, setDragOver] = useState<SlotKey | null>(null);

  const lockedPublished = existing?.status === "published";

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id,full_name,ranking_points")
      .order("full_name")
      .then(({ data }) => setPlayers((data as Player[]) ?? []));
  }, []);

  const byId = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);
  const used = useMemo(() => new Set(Object.values(slots).filter(Boolean)), [slots]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter((p) => !used.has(p.id))
      .filter((p) => !q || p.full_name.toLowerCase().includes(q));
  }, [players, used, query]);

  const setSlot = (s: SlotKey, id: string) => setSlots((prev) => ({ ...prev, [s]: id }));

  const onDrop = (s: SlotKey) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/player-id");
    if (!id) return;
    setSlots((prev) => {
      const next = { ...prev };
      (Object.keys(next) as SlotKey[]).forEach((k) => { if (next[k] === id) next[k] = ""; });
      next[s] = id;
      return next;
    });
  };

  const a1 = slots.a1, a2 = slots.a2, b1 = slots.b1, b2 = slots.b2;

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

  const validate = (forPublish: boolean): string | null => {
    if (!a1 || !b1) return "Pick at least one player on each side";
    if (type === "doubles" && forPublish && (!a2 || !b2)) return "Pick all four players";
    if (forPublish) {
      const sA = Number(scoreA), sB = Number(scoreB);
      if (Number.isNaN(sA) || Number.isNaN(sB) || sA < 0 || sB < 0) return "Invalid scores";
      if (sA === sB) return "Scores can't tie";
    }
    return null;
  };

  const save = async (target: MatchStatus) => {
    if (lockedPublished) return;
    const err = validate(target === "published");
    if (err) return toast.error(err);
    setBusy(target === "published" ? "publish" : "draft");

    const sA = Number(scoreA);
    const sB = Number(scoreB);
    const winner: "A" | "B" = sA >= sB ? "A" : "B";
    const payload = {
      match_type: type,
      team_a_p1: a1,
      team_a_p2: type === "doubles" ? (a2 || null) : null,
      team_b_p1: b1,
      team_b_p2: type === "doubles" ? (b2 || null) : null,
      score_a: Number.isNaN(sA) ? 0 : sA,
      score_b: Number.isNaN(sB) ? 0 : sB,
      winner_side: winner,
      points_delta_a: target === "published" && preview ? preview.deltaA : 0,
      points_delta_b: target === "published" && preview ? preview.deltaB : 0,
      notes: notes.trim() || null,
      status: target,
    };

    let matchId = existing?.id;
    if (existing) {
      const { error } = await supabase.from("matches").update(payload).eq("id", existing.id);
      if (error) { setBusy(null); return toast.error(error.message); }
    } else {
      const { data, error } = await supabase
        .from("matches")
        .insert({ ...payload, created_by: user?.id })
        .select("id")
        .single();
      if (error || !data) { setBusy(null); return toast.error(error?.message ?? "Save failed"); }
      matchId = data.id;
    }

    // Apply ranking only on transition to published
    if (target === "published" && preview && matchId) {
      const sideA = [a1, ...(type === "doubles" ? [a2] : [])];
      const sideB = [b1, ...(type === "doubles" ? [b2] : [])];
      const winners = winner === "A" ? sideA : sideB;
      const losers = winner === "A" ? sideB : sideA;
      const targetMap = buildTargetMap(players);
      const loserSet = new Set(losers);
      const bonusFor = (pid: string) => {
        const t = targetMap.get(pid);
        return t && loserSet.has(t) ? TARGET_BONUS : 0;
      };
      const ops: Array<Promise<unknown>> = [];
      const apply = (pid: string, baseDelta: number, bonus = 0) => {
        const delta = baseDelta + bonus;
        const before = byId[pid].ranking_points;
        const after = before + delta;
        ops.push(Promise.resolve(supabase.from("profiles").update({ ranking_points: after }).eq("id", pid)));
        ops.push(Promise.resolve(supabase.from("ranking_history").insert({
          player_id: pid, match_id: matchId, points_before: before, points_after: after, delta,
        })));
      };
      sideA.forEach((p) => apply(p, preview.deltaA, winner === "A" ? bonusFor(p) : 0));
      sideB.forEach((p) => apply(p, preview.deltaB, winner === "B" ? bonusFor(p) : 0));
      await Promise.all(ops);
      const bonusWinners = winners.filter((p) => bonusFor(p) > 0).map((p) => byId[p]?.full_name).filter(Boolean);
      if (bonusWinners.length) {
        toast.success(`Target bonus +${TARGET_BONUS} for ${bonusWinners.join(", ")}`);
      }
    }

    setBusy(null);
    toast.success(target === "published" ? "Match published" : "Draft saved");
    onDone(target);
  };

  const slotLabel = (s: SlotKey) => (s === "a1" || s === "b1" ? "Player 1" : "Player 2");

  const SlotBox = ({ s }: { s: SlotKey }) => {
    const id = slots[s];
    const p = id ? byId[id] : null;
    const active = dragOver === s;
    return (
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(s); }}
        onDragLeave={() => setDragOver((cur) => (cur === s ? null : cur))}
        onDrop={onDrop(s)}
        className={
          "min-h-12 rounded-lg border-2 border-dashed px-3 py-2 transition-colors " +
          (active
            ? "border-primary bg-primary/10"
            : p
              ? "border-primary/40 bg-card border-solid"
              : "border-border/70 bg-muted/30")
        }
      >
        {p ? (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{p.full_name}</div>
              <div className="text-[10px] text-muted-foreground tabular-nums">
                {Math.round(p.ranking_points)} pts
              </div>
            </div>
            {!lockedPublished && (
              <button type="button" onClick={() => setSlot(s, "")}
                className="text-muted-foreground hover:text-destructive" aria-label="Remove">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{slotLabel(s)} — drop or pick</span>
            <Select value="" onValueChange={(v) => setSlot(s, v)} disabled={lockedPublished}>
              <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder="Pick" /></SelectTrigger>
              <SelectContent>
                {players.filter((pl) => !used.has(pl.id)).map((pl) => (
                  <SelectItem key={pl.id} value={pl.id}>{pl.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  };

  return (
    <fieldset disabled={lockedPublished} className="space-y-5 rounded-2xl border border-border/60 bg-card p-5 shadow-sm disabled:opacity-90">
      {lockedPublished && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-700">
          This match is published. To edit, delete and recreate as a draft.
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Type</Label>
        <Tabs value={type} onValueChange={(v) => setType(v as "singles" | "doubles")}>
          <TabsList className="grid grid-cols-2 w-full h-10">
            <TabsTrigger value="singles" className="text-sm">Singles</TabsTrigger>
            <TabsTrigger value="doubles" className="text-sm">Doubles</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-2">
        <Label>Players</Label>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…" className="pl-8 h-9" />
        </div>
        <div className="flex flex-wrap gap-2 rounded-lg border border-border/60 bg-muted/30 p-2 min-h-[3rem]">
          {filtered.length === 0 ? (
            <span className="text-xs text-muted-foreground px-1 py-1.5">
              {used.size === players.length ? "All players placed." : "No matches."}
            </span>
          ) : (
            filtered.map((p) => (
              <button key={p.id} type="button" draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/player-id", p.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                className="group inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-2.5 py-1 text-xs cursor-grab active:cursor-grabbing hover:border-primary/60 hover:bg-primary/5 transition">
                <GripVertical className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
                <span className="font-medium">{p.full_name}</span>
                <span className="text-muted-foreground tabular-nums">{Math.round(p.ranking_points)}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-primary">Side A</Label>
          <SlotBox s="a1" />
          {type === "doubles" && <SlotBox s="a2" />}
          <Input inputMode="numeric" type="number" min={0} value={scoreA}
            onChange={(e) => setScoreA(e.target.value)}
            className="text-2xl h-14 text-center font-mono" />
        </div>
        <div className="space-y-2">
          <Label>Side B</Label>
          <SlotBox s="b1" />
          {type === "doubles" && <SlotBox s="b2" />}
          <Input inputMode="numeric" type="number" min={0} value={scoreB}
            onChange={(e) => setScoreB(e.target.value)}
            className="text-2xl h-14 text-center font-mono" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Comeback from 5-15…" rows={2} />
      </div>

      {preview && (
        <div className="rounded-xl bg-muted/40 border border-border/60 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Predicted change on publish</span>
            {preview.closeMatch && (
              <span className="text-[10px] uppercase tracking-wider text-primary">close-match protected</span>
            )}
          </div>
          <div className="mt-1 flex justify-between font-mono">
            <span>A: {preview.deltaA > 0 ? "+" : ""}{preview.deltaA}</span>
            <span>B: {preview.deltaB > 0 ? "+" : ""}{preview.deltaB}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-11"
          disabled={!!busy || lockedPublished}
          onClick={() => save("draft")}>
          {busy === "draft" ? "Saving…" : "Save draft"}
        </Button>
        <Button type="button" className="h-11"
          disabled={!!busy || lockedPublished}
          onClick={() => save("published")}>
          {busy === "publish" ? "Publishing…" : "Publish"}
        </Button>
      </div>
    </fieldset>
  );
}
