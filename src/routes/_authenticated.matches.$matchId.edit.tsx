import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MatchForm } from "@/components/app/MatchForm";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/matches/$matchId/edit")({
  component: EditMatch,
});

type Existing = {
  id: string;
  match_type: "singles" | "doubles";
  team_a_p1: string; team_a_p2: string | null;
  team_b_p1: string; team_b_p2: string | null;
  score_a: number; score_b: number;
  notes: string | null;
  status: "draft" | "published";
};

function EditMatch() {
  const { isAdmin } = useAuth();
  const { matchId } = Route.useParams();
  const nav = useNavigate();
  const [existing, setExisting] = useState<Existing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("matches").select("*").eq("id", matchId).maybeSingle()
      .then(({ data }) => {
        setExisting((data as Existing) ?? null);
        setLoading(false);
      });
  }, [matchId]);

  if (!isAdmin) {
    return <div className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">Admins only.</div>;
  }
  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!existing) return <div className="text-sm text-muted-foreground">Match not found.</div>;

  return (
    <div className="space-y-5">
      <Link to="/matches" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-3.5 h-3.5" /> Matches
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {existing.status === "draft" ? "Edit draft" : "View match"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {existing.status === "draft" ? "Make changes, save again, or publish." : "Published match."}
        </p>
      </div>
      <MatchForm existing={existing} onDone={() => nav({ to: "/matches" })} />
    </div>
  );
}
