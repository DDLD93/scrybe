"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthPageHeader } from "@/components/brand/auth-page-header";
import { useBrand } from "@/components/brand/brand-provider";
import { Spinner } from "@/components/ui/spinner";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { name } = useBrand();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const suspended = searchParams.get("error") === "suspended";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");

      await refresh();

      const next = searchParams.get("next") ?? "/transcribe";
      if (data.user?.mustChangePassword) {
        router.push("/change-password");
      } else {
        router.push(next);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ambient-bg flex min-h-screen flex-col items-center justify-center p-4">
      <AuthPageHeader />
      <Card className="w-full max-w-md glass-card">
        <CardHeader>
          <CardTitle>Sign in to {name}</CardTitle>
          <CardDescription>Enter your email and password to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          {suspended && (
            <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Your account has been suspended. Contact an administrator.
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Spinner className="size-4" /> : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
