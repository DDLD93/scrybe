"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";
import { toast } from "sonner";
import { PermissionCheckboxes } from "@/components/settings/permission-checkboxes";
import { SettingsPermissionGuard } from "@/components/settings/settings-permission-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import type { UserPermission } from "@/lib/db/schema";

export default function NewUserPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, permissions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create user");
      toast.success("User created and welcome email sent");
      router.push(`/transcribe/settings/users/${data.user.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsPermissionGuard permissions={["user:create"]}>
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/transcribe/settings/users">
              <IconArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-lg font-medium">Create user</h2>
            <p className="text-sm text-muted-foreground">
              The password will be emailed to the user via SMTP.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border/50 p-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={saving}
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
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              value={password}
              onChange={setPassword}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label>Permissions</Label>
            <PermissionCheckboxes
              value={permissions}
              onChange={setPermissions}
              disabled={saving}
            />
          </div>
          <Button type="submit" disabled={saving || password.length < 8}>
            {saving ? <Spinner className="size-4" /> : "Create user"}
          </Button>
        </form>
      </div>
    </SettingsPermissionGuard>
  );
}
