import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/perk/Logo";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. Sign in with your new password.");
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Logo />
        <h1 className="mt-6 font-display text-2xl font-bold">Reset your password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose a new password for your account.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pw">New password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="pw" type="password" required minLength={8} className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw2">Confirm password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="pw2" type="password" required minLength={8} className="pl-9" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Update password
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/auth" className="hover:text-foreground">← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
