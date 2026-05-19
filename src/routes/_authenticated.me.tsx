import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/me")({
  component: MePage,
});

function MePage() {
  const { user, profile, refresh } = useAuth();
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAge(profile?.age?.toString() ?? "");
    setHeight(profile?.height_cm?.toString() ?? "");
  }, [profile]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        age: age ? Number(age) : null,
        height_cm: height ? Number(height) : null,
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    refresh();
  };

  if (!profile || !user) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{profile.full_name}</h1>
        <p className="text-sm text-muted-foreground">Your stats and profile.</p>
      </div>

      <div className="rounded-2xl p-5 border border-border/60" style={{ background: "var(--gradient-surface)", boxShadow: "var(--shadow-glow)" }}>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Ranking points</div>
        <div className="text-4xl font-semibold mt-1 tabular-nums">
          {Math.round(profile.ranking_points)}
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
        <h2 className="font-medium">Profile</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="age">Age</Label>
            <Input id="age" inputMode="numeric" type="number" value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h">Height (cm)</Label>
            <Input id="h" inputMode="numeric" type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
          </div>
        </div>
        <Button onClick={save} disabled={busy} className="w-full">
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}