import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { MatchForm } from "@/components/app/MatchForm";

export const Route = createFileRoute("/_authenticated/matches/new")({
  component: NewMatch,
});

function NewMatch() {
  const { isAdmin } = useAuth();
  const nav = useNavigate();

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
        Only admins can record matches.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Record match</h1>
        <p className="text-sm text-muted-foreground">
          Drag players into a side, set the score. Save as draft or publish.
        </p>
      </div>
      <MatchForm onDone={() => nav({ to: "/matches" })} />
    </div>
  );
}
