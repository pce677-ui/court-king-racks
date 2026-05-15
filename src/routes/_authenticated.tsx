import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }
  if (!user) {
    return null;
  }
  return (
    <AppShell>
      <div key={pathname} className="animate-page-in">
        <Outlet />
      </div>
    </AppShell>
  );
}