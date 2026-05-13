import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
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
      <Outlet />
    </AppShell>
  );
}