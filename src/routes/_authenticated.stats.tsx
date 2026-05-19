import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { PlayerStats } from "@/components/app/PlayerStats";

export const Route = createFileRoute("/_authenticated/stats")({
  component: StatsPage,
});

function StatsPage() {
  const { user } = useAuth();
  if (!user) return <div className="text-sm text-muted-foreground">Loading…</div>;
  return <PlayerStats playerId={user.id} />;
}