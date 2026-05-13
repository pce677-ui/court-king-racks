import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: name.trim() },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created");
    nav({ to: "/" });
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <span
            className="grid place-items-center w-9 h-9 rounded-xl"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </span>
          <span className="text-xl font-semibold tracking-tight">Smash</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-center">Create account</h1>
        <form
          onSubmit={onSubmit}
          className="mt-6 space-y-4 rounded-2xl border border-border/60 bg-card p-5"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Player name</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">Password</Label>
            <Input
              id="pw"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </Button>
        </form>
        <p className="text-sm text-muted-foreground text-center mt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}