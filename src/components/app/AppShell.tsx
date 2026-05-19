import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Trophy, ListOrdered, User2, LogOut, Plus, Sparkles, BarChart3 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/" as const, label: "Ranking", icon: Trophy },
  { to: "/matches" as const, label: "Matches", icon: ListOrdered },
  { to: "/stats" as const, label: "Stats", icon: BarChart3 },
  { to: "/me" as const, label: "Me", icon: User2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, isAdmin, signOut } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 backdrop-blur-xl bg-background/80">
        <div className="mx-auto max-w-3xl px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span
              className="grid place-items-center w-7 h-7 rounded-lg"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </span>
            <span>Smash</span>
          </Link>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                size="sm"
                className="h-8 rounded-full"
                onClick={() => navigate({ to: "/matches/new" })}
              >
                <Plus className="w-4 h-4 mr-1" /> Match
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => signOut()}
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {profile && (
          <div className="mx-auto max-w-3xl px-4 pb-2 -mt-1 text-xs text-muted-foreground">
            <span className="text-foreground font-medium">{profile.full_name}</span> ·{" "}
            <span className="text-primary">{Math.round(profile.ranking_points)} pts</span>
            {isAdmin && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-primary/15 text-primary uppercase tracking-wider text-[10px]">
                admin
              </span>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-5 pb-24">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border/60 backdrop-blur-xl bg-background/85">
        <div className="mx-auto max-w-3xl grid grid-cols-4">
          {NAV.map((n) => {
            const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-xs transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="w-5 h-5" />
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}