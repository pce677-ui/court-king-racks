import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }
  if (!user) {
    throw redirect({ to: "/login" });
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}