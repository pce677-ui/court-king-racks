import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PlayerStats } from "@/components/app/PlayerStats";

export const Route = createFileRoute("/_authenticated/players/$playerId")({
  component: PlayerPage,
});

function PlayerPage() {
  const { playerId } = Route.useParams();
  return (
    <div className="space-y-4">
      <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-3.5 h-3.5" /> Leaderboard
      </Link>
      <PlayerStats playerId={playerId} />
    </div>
  );
}
