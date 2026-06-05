"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthPageHeader } from "@/components/brand/auth-page-header";
import { useBrand } from "@/components/brand/brand-provider";
import { Spinner } from "@/components/ui/spinner";

export default function SetupPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { name: appName } = useBrand();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Setup failed");
      toast.success("Admin account created");
      await refresh();
      router.push("/transcribe");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ambient-bg flex min-h-screen flex-col items-center justify-center p-4">
      <AuthPageHeader />
      <Card className="w-full max-w-md glass-card">
        <CardHeader>
          <CardTitle>Welcome to {appName}</CardTitle>
          <CardDescription>
            Create the first administrator account to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
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
              <PasswordInput
                id="password"
                value={password}
                onChange={setPassword}
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || password.length < 8}>
              {loading ? <Spinner className="size-4" /> : "Create admin account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
